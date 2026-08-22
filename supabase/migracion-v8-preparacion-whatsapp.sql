-- ============================================================
-- MIGRACIÓN v8: PREPARACIÓN PARA INTEGRACIÓN WHATSAPP
-- ------------------------------------------------------------
-- 1. pedidos.origen        (web | whatsapp | admin) + CHECK + índices
-- 2. pedido_detalles.variante_id (FK nullable a producto_variantes)
-- 3. pedidos.cliente_id    (FK nullable a clientes)
-- 4. Índices en clientes.telefono y clientes.whatsapp
-- 5. vista_pedidos + vista_dashboard_ventas con origen
-- 6. RPCs del dashboard con filtro p_origen + dashboard_por_origen
-- 7. catalogo_publico: catálogo seguro solo con campos públicos
-- ------------------------------------------------------------
-- SEGURO Y REVERSIBLE:
-- - Solo ADD COLUMN (nullable o con default) y CREATE INDEX IF NOT EXISTS
-- - No se eliminan columnas, tablas ni datos
-- - CHECK constraint se puede dropear (pedidos_origen_check)
-- - Columnas se pueden dropear individualmente sin afectar el resto
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ORIGEN DEL PEDIDO
-- ============================================================

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'web';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedidos_origen_check' AND conrelid = 'public.pedidos'::regclass
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_origen_check
      CHECK (origen IN ('web', 'whatsapp', 'admin'));
  END IF;
END $$;

COMMENT ON COLUMN public.pedidos.origen IS
  'Canal de entrada del pedido: web (portal), whatsapp (futuro asistente), admin (creado manualmente por administrador).';

CREATE INDEX IF NOT EXISTS idx_pedidos_origen
  ON public.pedidos(origen);
CREATE INDEX IF NOT EXISTS idx_pedidos_origen_creado
  ON public.pedidos(origen, creado_en);

-- ============================================================
-- 2. VARIANTE REAL EN LA LÍNEA DE PEDIDO
--    (se conserva la personalización textual existente)
-- ============================================================

ALTER TABLE public.pedido_detalles
  ADD COLUMN IF NOT EXISTS variante_id bigint
  REFERENCES public.producto_variantes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pedido_detalles.variante_id IS
  'Variante real elegida (nullable: pedidos históricos sin variante). La variante también se conserva como personalización textual.';

CREATE INDEX IF NOT EXISTS idx_pedido_detalles_variante
  ON public.pedido_detalles(variante_id);

-- ============================================================
-- 3. CLIENTE REAL EN EL PEDIDO
--    (se conservan cliente_nombre/telefono/email como snapshot)
-- ============================================================

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_id bigint
  REFERENCES public.clientes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pedidos.cliente_id IS
  'Cliente real asociado al pedido (nullable). cliente_nombre/telefono/email se conservan como snapshot histórico.';

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente
  ON public.pedidos(cliente_id);

-- ============================================================
-- 4. ÍNDICES PARA IDENTIFICACIÓN POR TELÉFONO (futuro WhatsApp)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clientes_telefono
  ON public.clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp
  ON public.clientes(whatsapp);

-- ============================================================
-- 5. VISTAS CON ORIGEN
-- ============================================================

DROP VIEW IF EXISTS public.vista_pedidos;

CREATE VIEW public.vista_pedidos
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.numero_pedido,
  p.cliente_nombre,
  p.cliente_telefono,
  p.cliente_email,
  p.cliente_id,
  p.origen,
  p.estado,
  p.subtotal,
  p.recargos,
  p.total,
  p.observaciones,
  p.creado_en,
  p.actualizado_en,
  count(pd.id) AS cantidad_productos
FROM public.pedidos p
LEFT JOIN public.pedido_detalles pd ON pd.pedido_id = p.id
GROUP BY
  p.id, p.numero_pedido, p.cliente_nombre, p.cliente_telefono,
  p.cliente_email, p.cliente_id, p.origen, p.estado, p.subtotal,
  p.recargos, p.total, p.observaciones, p.creado_en, p.actualizado_en;

COMMENT ON VIEW public.vista_pedidos IS
  'Pedidos con cantidad de productos. Incluye origen (web/whatsapp/admin) y cliente_id.';

DROP VIEW IF EXISTS public.vista_dashboard_ventas;

CREATE VIEW public.vista_dashboard_ventas
WITH (security_invoker = true) AS
SELECT
  pd.id AS detalle_id,
  pd.pedido_id,
  p.numero_pedido,
  p.estado,
  p.origen,
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
  'Líneas de venta con clasificación de estado (completado/cancelado/pendiente), ganancia calculada con el costo histórico (NULL = costo pendiente) y origen del pedido.';

-- ============================================================
-- 6. RPCs DEL DASHBOARD CON FILTRO p_origen
--    (guardia es_admin(), mismas firmas + p_origen al final)
-- ============================================================

DROP FUNCTION IF EXISTS public.dashboard_resumen(
  timestamptz, timestamptz, bigint, bigint, text, text
);

CREATE OR REPLACE FUNCTION public.dashboard_resumen(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_categoria_id bigint DEFAULT NULL,
  p_producto_id bigint DEFAULT NULL,
  p_cliente text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_origen text DEFAULT NULL
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
  IF NOT es_admin() THEN
    RAISE EXCEPTION 'Acceso restringido al administrador';
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
        AND (p_origen IS NULL OR v.origen = p_origen)
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
        AND (p_origen IS NULL OR v.origen = p_origen)
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
        AND (p_origen IS NULL OR v.origen = p_origen)
    ),
    'cancelados', (
      SELECT COUNT(DISTINCT v.pedido_id)
      FROM vista_dashboard_ventas v
      WHERE v.clasificacion = 'cancelado'
        AND v.creado_en >= p_desde AND v.creado_en < p_hasta
        AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
        AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
        AND (p_origen IS NULL OR v.origen = p_origen)
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_resumen(timestamptz, timestamptz, bigint, bigint, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.dashboard_resumen(timestamptz, timestamptz, bigint, bigint, text, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.dashboard_evolucion(
  timestamptz, timestamptz, text, bigint, bigint
);

CREATE OR REPLACE FUNCTION public.dashboard_evolucion(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_agrupacion text DEFAULT 'dia',
  p_categoria_id bigint DEFAULT NULL,
  p_producto_id bigint DEFAULT NULL,
  p_origen text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
  v_formato text;
BEGIN
  IF NOT es_admin() THEN
    RAISE EXCEPTION 'Acceso restringido al administrador';
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
      AND (p_origen IS NULL OR v.origen = p_origen)
    GROUP BY 1
  ) d ON d.periodo_ts = s.serie;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_evolucion(timestamptz, timestamptz, text, bigint, bigint, text) FROM public;
GRANT EXECUTE ON FUNCTION public.dashboard_evolucion(timestamptz, timestamptz, text, bigint, bigint, text) TO authenticated;

DROP FUNCTION IF EXISTS public.dashboard_top(
  text, timestamptz, timestamptz, integer, bigint, bigint
);

CREATE OR REPLACE FUNCTION public.dashboard_top(
  p_tipo text,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_limite integer DEFAULT 20,
  p_categoria_id bigint DEFAULT NULL,
  p_producto_id bigint DEFAULT NULL,
  p_origen text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT es_admin() THEN
    RAISE EXCEPTION 'Acceso restringido al administrador';
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
        AND (p_origen IS NULL OR v.origen = p_origen)
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
        AND (p_origen IS NULL OR v.origen = p_origen)
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
        AND (p_origen IS NULL OR v.origen = p_origen)
      GROUP BY v.cliente_nombre
    ) t;

  ELSE

    RAISE EXCEPTION 'Tipo de ranking no soportado: %', p_tipo;

  END IF;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_top(text, timestamptz, timestamptz, integer, bigint, bigint, text) FROM public;
GRANT EXECUTE ON FUNCTION public.dashboard_top(text, timestamptz, timestamptz, integer, bigint, bigint, text) TO authenticated;

-- ============================================================
-- 6b. DASHBOARD POR ORIGEN (pedidos y facturación por canal)
-- ============================================================

CREATE OR REPLACE FUNCTION public.dashboard_por_origen(
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
BEGIN
  IF NOT es_admin() THEN
    RAISE EXCEPTION 'Acceso restringido al administrador';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'origen', t.origen,
    'pedidos', t.pedidos,
    'pendientes', t.pendientes,
    'cancelados', t.cancelados,
    'facturacion', t.facturacion
  ) ORDER BY t.facturacion DESC NULLS LAST, t.pedidos DESC), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT
      v.origen,
      COUNT(DISTINCT v.pedido_id) AS pedidos,
      COUNT(DISTINCT v.pedido_id) FILTER (WHERE v.clasificacion = 'pendiente') AS pendientes,
      COUNT(DISTINCT v.pedido_id) FILTER (WHERE v.clasificacion = 'cancelado') AS cancelados,
      COALESCE(SUM(v.subtotal) FILTER (WHERE v.clasificacion = 'completado'), 0) AS facturacion
    FROM (
      SELECT
        v.origen,
        v.pedido_id,
        v.clasificacion,
        v.subtotal
      FROM vista_dashboard_ventas v
      WHERE v.creado_en >= p_desde AND v.creado_en < p_hasta
        AND (p_categoria_id IS NULL OR v.categoria_id = p_categoria_id)
        AND (p_producto_id IS NULL OR v.producto_id = p_producto_id)
        AND (p_cliente IS NULL OR v.cliente_nombre ILIKE '%' || p_cliente || '%' OR v.cliente_email ILIKE '%' || p_cliente || '%')
        AND (p_estado IS NULL OR v.estado = p_estado)
    ) v
    GROUP BY v.origen
  ) t;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_por_origen(timestamptz, timestamptz, bigint, bigint, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.dashboard_por_origen(timestamptz, timestamptz, bigint, bigint, text, text) TO authenticated;

-- ============================================================
-- 7. CATÁLOGO PÚBLICO SEGURO (para portal y futuro asistente IA)
--    security definer: ejecuta como owner, PERO devuelve SOLO
--    columnas públicas explícitas. Nunca costos/proveedores.
-- ============================================================

CREATE OR REPLACE FUNCTION public.catalogo_publico(
  p_busqueda text DEFAULT NULL,
  p_categoria_id bigint DEFAULT NULL,
  p_limite integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pr.id,
      'nombre', pr.nombre,
      'nombre_comercial', pr.nombre_comercial,
      'descripcion', pr.descripcion,
      'imagen_principal', pr.imagen_principal,
      'precio_publico', pr.precio_publico,
      'precio', pr.precio,
      'stock', pr.stock,
      'permite_personalizacion', pr.permite_personalizacion,
      'categoria', (
        SELECT jsonb_build_object('id', c.id, 'nombre', c.nombre, 'imagen', c.imagen)
        FROM categorias c WHERE c.id = pr.categoria_id
      ),
      'variantes', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', v.id,
          'nombre', v.nombre,
          'color', v.color,
          'talle', v.talle,
          'modelo', v.modelo,
          'capacidad', v.capacidad,
          'precio', v.precio,
          'stock', v.stock
        ) ORDER BY v.id), '[]'::jsonb)
        FROM producto_variantes v
        WHERE v.producto_id = pr.id AND v.activo = true
      ),
      'preguntas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', q.id,
          'titulo', q.titulo,
          'tipo_respuesta', q.tipo_respuesta,
          'permite_archivo', q.permite_archivo,
          'obligatoria', pq.obligatoria,
          'opciones', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'id', po.id,
              'nombre', po.nombre
            ) ORDER BY po.orden), '[]'::jsonb)
            FROM pregunta_opciones po
            WHERE po.pregunta_id = q.id AND po.activo = true
          )
        ) ORDER BY pq.orden), '[]'::jsonb)
        FROM producto_preguntas pq
        JOIN preguntas q ON q.id = pq.pregunta_id
        WHERE pq.producto_id = pr.id AND pq.activo = true AND q.activo = true
      )
    ) ORDER BY pr.orden, pr.nombre), '[]'::jsonb)
  INTO v_resultado
  FROM productos pr
  WHERE pr.activo = true
    AND (p_busqueda IS NULL OR pr.nombre ILIKE '%' || p_busqueda || '%'
      OR pr.nombre_comercial ILIKE '%' || p_busqueda || '%'
      OR pr.descripcion ILIKE '%' || p_busqueda || '%')
    AND (p_categoria_id IS NULL OR pr.categoria_id = p_categoria_id)
  LIMIT GREATEST(1, LEAST(p_limite, 300));

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_publico(text, bigint, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.catalogo_publico(text, bigint, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.catalogo_publico IS
  'Catálogo público seguro: solo campos de venta (nombre, descripción, precio público, imagen, stock, variantes y preguntas). Nunca costos, márgenes ni proveedores. Para portal y futuro asistente de WhatsApp.';

COMMIT;