-- ============================================================
-- MIGRACIÓN v6: DASHBOARD DE INTELIGENCIA COMERCIAL
--
-- 1. pedido_detalles.costo_unitario (costo histórico de la venta)
-- 2. Tablas compras + compra_items (módulo de compras mínimo)
-- 3. Vista vista_dashboard_ventas (líneas de venta + clasificación)
-- 4. Funciones RPC: dashboard_resumen, dashboard_evolucion, dashboard_top
-- 5. Índices para agregaciones del dashboard
--
-- Estados de pedido (documentación):
--   'listo' y 'entregado'  -> venta COMPLETADA (se contabiliza)
--   'cancelado'            -> CANCELADA (no se contabiliza)
--   resto (nuevo, revisar, diseno, aprobacion, produccion) -> PENDIENTE
-- ============================================================

BEGIN;

-- ============================================================
-- 1. COSTO HISTÓRICO EN LÍNEA DE VENTA
-- ============================================================

ALTER TABLE public.pedido_detalles
  ADD COLUMN IF NOT EXISTS costo_unitario numeric;

COMMENT ON COLUMN public.pedido_detalles.costo_unitario IS
  'Costo del producto al momento de la venta (costo histórico). Se completa automáticamente al crear el pedido. NULL = costo pendiente.';

-- ============================================================
-- 2. MÓDULO DE COMPRAS (estructura mínima)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.compras (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proveedor_id bigint REFERENCES public.proveedores(id) ON DELETE RESTRICT,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  comprobante text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compra_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compra_id bigint NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  producto_id bigint REFERENCES public.productos(id) ON DELETE RESTRICT,
  variante_id bigint REFERENCES public.producto_variantes(id) ON DELETE RESTRICT,
  cantidad numeric NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  costo_unitario numeric,
  costo_total numeric
);

COMMENT ON TABLE public.compras IS
  'Compras realizadas a proveedores. Registra proveedor, fecha, comprobante y observaciones.';
COMMENT ON TABLE public.compra_items IS
  'Líneas de cada compra: producto, variante, cantidad y costo unitario/total.';

CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON public.compras(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON public.compras(fecha);
CREATE INDEX IF NOT EXISTS idx_compra_items_compra ON public.compra_items(compra_id);
CREATE INDEX IF NOT EXISTS idx_compra_items_producto ON public.compra_items(producto_id);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compras_select_personal ON public.compras;
CREATE POLICY compras_select_personal ON public.compras
  FOR SELECT TO authenticated USING (es_personal());
DROP POLICY IF EXISTS compras_insert_personal ON public.compras;
CREATE POLICY compras_insert_personal ON public.compras
  FOR INSERT TO authenticated WITH CHECK (es_personal());
DROP POLICY IF EXISTS compras_update_personal ON public.compras;
CREATE POLICY compras_update_personal ON public.compras
  FOR UPDATE TO authenticated USING (es_personal()) WITH CHECK (es_personal());
DROP POLICY IF EXISTS compras_delete_personal ON public.compras;
CREATE POLICY compras_delete_personal ON public.compras
  FOR DELETE TO authenticated USING (es_personal());

DROP POLICY IF EXISTS compra_items_select_personal ON public.compra_items;
CREATE POLICY compra_items_select_personal ON public.compra_items
  FOR SELECT TO authenticated USING (es_personal());
DROP POLICY IF EXISTS compra_items_insert_personal ON public.compra_items;
CREATE POLICY compra_items_insert_personal ON public.compra_items
  FOR INSERT TO authenticated WITH CHECK (es_personal());
DROP POLICY IF EXISTS compra_items_update_personal ON public.compra_items;
CREATE POLICY compra_items_update_personal ON public.compra_items
  FOR UPDATE TO authenticated USING (es_personal()) WITH CHECK (es_personal());
DROP POLICY IF EXISTS compra_items_delete_personal ON public.compra_items;
CREATE POLICY compra_items_delete_personal ON public.compra_items
  FOR DELETE TO authenticated USING (es_personal());

-- ============================================================
-- 3. VISTA DE VENTAS PARA EL DASHBOARD
--    (única fuente para métricas de ventas/rentabilidad)
-- ============================================================

CREATE OR REPLACE VIEW public.vista_dashboard_ventas
WITH (security_invoker = true) AS
SELECT
  pd.id AS detalle_id,
  pd.pedido_id,
  p.numero_pedido,
  p.estado,
  CASE
    WHEN p.estado IN ('listo', 'entregado') THEN 'completado'
    WHEN p.estado = 'cancelado' THEN 'cancelado'
    ELSE 'pendiente'
  END AS clasificacion,
  p.creado_en,
  p.cliente_nombre,
  p.cliente_email,
  pd.producto_id,
  pr.nombre AS producto_nombre,
  pr.nombre_comercial,
  pr.categoria_id,
  pd.cantidad,
  pd.precio_unitario,
  pd.subtotal,
  pd.costo_unitario,
  CASE
    WHEN pd.costo_unitario IS NOT NULL
      THEN pd.subtotal - (pd.costo_unitario * pd.cantidad)
    ELSE NULL
  END AS ganancia
FROM public.pedido_detalles pd
JOIN public.pedidos p ON p.id = pd.pedido_id
LEFT JOIN public.productos pr ON pr.id = pd.producto_id;

COMMENT ON VIEW public.vista_dashboard_ventas IS
  'Líneas de venta con clasificación de estado (completado/cancelado/pendiente) y ganancia calculada con el costo histórico (NULL = costo pendiente).';

-- ============================================================
-- 4. FUNCIONES RPC DEL DASHBOARD
--    Todas con guardia es_personal(): solo personal interno.
-- ============================================================

CREATE OR REPLACE FUNCTION public.dashboard_resumen(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_categoria_id bigint DEFAULT NULL,
  p_producto_id bigint DEFAULT NULL,
  p_cliente text DEFAULT NULL,
  p_estado text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
  v_anterior_desde timestamptz;
  v_anterior_hasta timestamptz;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal interno';
  END IF;

  v_anterior_hasta := p_desde - interval '1 second';
  v_anterior_desde := v_anterior_hasta - (p_hasta - p_desde);

  SELECT jsonb_build_object(
    'actual', (
      SELECT jsonb_build_object(
        'facturacion', COALESCE(SUM(v.subtotal), 0),
        'costo', COALESCE(SUM(v.costo_unitario * v.cantidad), 0),
        'ganancia', COALESCE(SUM(v.ganancia), 0),
        'pedidos', COUNT(DISTINCT v.pedido_id),
        'unidades', COALESCE(SUM(v.cantidad), 0),
        'facturacion_sin_costo', COALESCE(SUM(v.subtotal) FILTER (WHERE v.costo_unitario IS NULL), 0),
        'items_con_costo', COUNT(*) FILTER (WHERE v.costo_unitario IS NOT NULL),
        'items_total', COUNT(*)
      )
      FROM vista_dashboard_ventas v
      WHERE v.clasificacion = 'completado'
        AND v.creado_en >= p_desde AND v.creado_en < p_hasta
        AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
        AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
        AND (p_cliente IS NULL OR v.cliente_nombre ILIKE '%' || p_cliente || '%' OR v.cliente_email ILIKE '%' || p_cliente || '%')
        AND (p_estado IS NULL OR v.estado = p_estado)
    ),
    'anterior', (
      SELECT jsonb_build_object(
        'facturacion', COALESCE(SUM(v.subtotal), 0),
        'ganancia', COALESCE(SUM(v.ganancia), 0),
        'pedidos', COUNT(DISTINCT v.pedido_id),
        'unidades', COALESCE(SUM(v.cantidad), 0)
      )
      FROM vista_dashboard_ventas v
      WHERE v.clasificacion = 'completado'
        AND v.creado_en >= v_anterior_desde AND v.creado_en < v_anterior_hasta
        AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
        AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
        AND (p_cliente IS NULL OR v.cliente_nombre ILIKE '%' || p_cliente || '%' OR v.cliente_email ILIKE '%' || p_cliente || '%')
        AND (p_estado IS NULL OR v.estado = p_estado)
    ),
    'pendientes', (
      SELECT jsonb_build_object(
        'pedidos', COUNT(DISTINCT v.pedido_id),
        'facturacion', COALESCE(SUM(v.subtotal), 0)
      )
      FROM vista_dashboard_ventas v
      WHERE v.clasificacion = 'pendiente'
        AND v.creado_en >= p_desde AND v.creado_en < p_hasta
        AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
        AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
    ),
    'cancelados', (
      SELECT COUNT(DISTINCT v.pedido_id)
      FROM vista_dashboard_ventas v
      WHERE v.clasificacion = 'cancelado'
        AND v.creado_en >= p_desde AND v.creado_en < p_hasta
        AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
        AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.dashboard_resumen IS
  'Métricas principales del dashboard (actual vs período anterior equivalente). Solo personal interno.';

CREATE OR REPLACE FUNCTION public.dashboard_evolucion(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_agrupacion text DEFAULT 'dia',
  p_categoria_id bigint DEFAULT NULL,
  p_producto_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
  v_formato text;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal interno';
  END IF;

  v_formato := CASE p_agrupacion
    WHEN 'semana' THEN 'IYYY-IW'
    WHEN 'mes' THEN 'YYYY-MM'
    ELSE 'YYYY-MM-DD'
  END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'periodo', to_char(serie, v_formato),
    'fecha', serie,
    'facturacion', COALESCE(d.facturacion, 0),
    'costo', COALESCE(d.costo, 0),
    'ganancia', COALESCE(d.ganancia, 0),
    'pedidos', COALESCE(d.pedidos, 0)
  ) ORDER BY serie), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT generate_series(
      date_trunc('day', p_desde),
      date_trunc('day', p_hasta) - interval '1 day',
      CASE p_agrupacion
        WHEN 'semana' THEN interval '1 week'
        WHEN 'mes' THEN interval '1 month'
        ELSE interval '1 day'
      END
    ) AS serie
  ) s
  LEFT JOIN (
    SELECT
      CASE p_agrupacion
        WHEN 'semana' THEN date_trunc('week', v.creado_en)
        WHEN 'mes' THEN date_trunc('month', v.creado_en)
        ELSE date_trunc('day', v.creado_en)
      END AS periodo_ts,
      SUM(v.subtotal) AS facturacion,
      SUM(v.costo_unitario * v.cantidad) AS costo,
      SUM(v.ganancia) AS ganancia,
      COUNT(DISTINCT v.pedido_id) AS pedidos
    FROM vista_dashboard_ventas v
    WHERE v.clasificacion = 'completado'
      AND v.creado_en >= p_desde AND v.creado_en < p_hasta
      AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
      AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
    GROUP BY 1
) d ON d.periodo_ts = s.serie;

  RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.dashboard_evolucion IS
  'Serie de evolución (facturación, costo, ganancia, pedidos) agrupada por día/semana/mes. Solo personal interno.';

CREATE OR REPLACE FUNCTION public.dashboard_top(
  p_tipo text,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_limite integer DEFAULT 20,
  p_categoria_id bigint DEFAULT NULL,
  p_producto_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal interno';
  END IF;

  IF p_tipo = 'productos' THEN

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'producto_id', t.producto_id,
      'nombre', t.nombre,
      'nombre_comercial', t.nombre_comercial,
      'unidades', t.unidades,
      'facturacion', t.facturacion,
      'costo', t.costo,
      'ganancia', t.ganancia,
      'margen', CASE WHEN t.facturacion > 0
        THEN ROUND(t.ganancia / t.facturacion * 100, 1) ELSE NULL END,
      'pedidos', t.pedidos,
      'items_sin_costo', t.items_sin_costo
    ) ORDER BY t.ganancia DESC NULLS LAST, t.facturacion DESC), '[]'::jsonb)
    INTO v_resultado
    FROM (
      SELECT
        v.producto_id,
        COALESCE(MAX(v.nombre_comercial), MAX(v.producto_nombre)) AS nombre,
        MAX(v.nombre_comercial) AS nombre_comercial,
        SUM(v.cantidad) AS unidades,
        SUM(v.subtotal) AS facturacion,
        SUM(v.costo_unitario * v.cantidad) AS costo,
        SUM(v.ganancia) AS ganancia,
        COUNT(DISTINCT v.pedido_id) AS pedidos,
        COUNT(*) FILTER (WHERE v.costo_unitario IS NULL) AS items_sin_costo
      FROM vista_dashboard_ventas v
      WHERE v.clasificacion = 'completado'
        AND v.creado_en >= p_desde AND v.creado_en < p_hasta
        AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
        AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
      GROUP BY v.producto_id
    ) t;

  ELSIF p_tipo = 'categorias' THEN

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'categoria_id', t.categoria_id,
      'nombre', t.nombre,
      'unidades', t.unidades,
      'facturacion', t.facturacion,
      'costo', t.costo,
      'ganancia', t.ganancia,
      'margen', CASE WHEN t.facturacion > 0
        THEN ROUND(t.ganancia / t.facturacion * 100, 1) ELSE NULL END,
      'pedidos', t.pedidos
    ) ORDER BY t.facturacion DESC), '[]'::jsonb)
    INTO v_resultado
    FROM (
      SELECT
        v.categoria_id,
        MAX(c.nombre) AS nombre,
        SUM(v.cantidad) AS unidades,
        SUM(v.subtotal) AS facturacion,
        SUM(v.costo_unitario * v.cantidad) AS costo,
        SUM(v.ganancia) AS ganancia,
        COUNT(DISTINCT v.pedido_id) AS pedidos
      FROM vista_dashboard_ventas v
      LEFT JOIN categorias c ON c.id = v.categoria_id
      WHERE v.clasificacion = 'completado'
        AND v.creado_en >= p_desde AND v.creado_en < p_hasta
        AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
        AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
      GROUP BY v.categoria_id
    ) t;

  ELSIF p_tipo = 'clientes' THEN

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'cliente', t.cliente_nombre,
      'email', t.cliente_email,
      'pedidos', t.pedidos,
      'facturacion', t.facturacion,
      'ultima_compra', t.ultima_compra
    ) ORDER BY t.facturacion DESC), '[]'::jsonb)
    INTO v_resultado
    FROM (
      SELECT
        v.cliente_nombre,
        MAX(v.cliente_email) AS cliente_email,
        COUNT(DISTINCT v.pedido_id) AS pedidos,
        SUM(v.subtotal) AS facturacion,
        MAX(v.creado_en) AS ultima_compra
      FROM vista_dashboard_ventas v
      WHERE v.clasificacion = 'completado'
        AND v.creado_en >= p_desde AND v.creado_en < p_hasta
      GROUP BY v.cliente_nombre
    ) t;

  ELSE

    RAISE EXCEPTION 'Tipo de ranking no soportado: %', p_tipo;

  END IF;

  RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.dashboard_top IS
  'Rankings: productos (cantidad/facturación/ganancia/margen), categorías y clientes. Solo personal interno.';

-- ============================================================
-- 5. ÍNDICES PARA AGREGACIONES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pedidos_estado_creado
  ON public.pedidos(estado, creado_en);

COMMIT;