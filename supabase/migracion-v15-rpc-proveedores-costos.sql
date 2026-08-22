-- ============================================================
-- MIGRACIÓN v15: RPCs de proveedores, costos y rentabilidad
-- ============================================================
-- QUÉ HACE: crea funciones de lectura para el módulo de proveedores/
--   compras/costos. NO tocan tablas (solo leen).
-- SEGURIDAD: todas son SECURITY DEFINER con guarda es_personal()
--   explícita al inicio → un cliente (authenticated) que las invoque
--   recibe 'Acceso restringido al personal' y NO ve proveedores,
--   costos, compras, márgenes ni rentabilidad.
-- IDEMPOTENTE: sí (CREATE OR REPLACE FUNCTION).
-- REVERSIBLE: sí (DROP FUNCTION, ver abajo).

-- ============================================================
-- 1) mejor_precio_producto(p_producto_id)
--    Devuelve todos los proveedores del producto con:
--    precio actual, último precio pagado (compra_items), fecha del
--    precio, disponibilidad, cuál es el mejor (activo + disponible)
--    y la diferencia contra el mejor.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mejor_precio_producto(p_producto_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'proveedor_id', t.proveedor_id,
    'proveedor_nombre', t.proveedor_nombre,
    'codigo_proveedor', t.codigo_proveedor,
    'precio_actual', t.precio_actual,
    'ultimo_pagado', t.ultimo_pagado,
    'fecha_precio', t.fecha_precio,
    'disponible', t.disponible,
    'es_principal', t.es_principal,
    'es_mejor', t.es_mejor,
    'diferencia_vs_mejor', t.diferencia_vs_mejor
  ) ORDER BY t.es_mejor DESC NULLS LAST, t.precio_actual ASC NULLS LAST), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT
      pr.id AS proveedor_id,
      pr.nombre AS proveedor_nombre,
      pp.codigo_proveedor,
      pp.precio_compra AS precio_actual,
      (SELECT ci.costo_unitario
         FROM public.compra_items ci
         JOIN public.compras c ON c.id = ci.compra_id
        WHERE ci.producto_id = pp.producto_id
          AND c.proveedor_id = pr.id
          AND ci.costo_unitario IS NOT NULL
        ORDER BY c.fecha DESC, c.id DESC
        LIMIT 1) AS ultimo_pagado,
      pp.ultimo_cambio_precio AS fecha_precio,
      pp.disponible,
      pp.es_principal,
      (pp.activo_sincronizacion
       AND pp.disponible
       AND pp.precio_compra IS NOT NULL
       AND pp.precio_compra = MIN(pp.precio_compra) FILTER (
             WHERE pp.activo_sincronizacion AND pp.disponible)
             OVER (PARTITION BY pp.producto_id)) AS es_mejor,
      (pp.precio_compra - MIN(pp.precio_compra) FILTER (
             WHERE pp.activo_sincronizacion AND pp.disponible)
             OVER (PARTITION BY pp.producto_id)) AS diferencia_vs_mejor
    FROM public.producto_proveedores pp
    JOIN public.proveedores pr ON pr.id = pp.proveedor_id
    WHERE pp.producto_id = p_producto_id
      AND pr.activo = true
  ) t;

  RETURN v_resultado;
END $$;

-- ============================================================
-- 2) productos_con_mejor_precio()
--    Por cada producto: proveedor más barato activo/disponible,
--    precio del proveedor principal, proveedor más caro, diferencia
--    y ahorro unitario. Ordenado por mayor ahorro posible.
-- ============================================================
CREATE OR REPLACE FUNCTION public.productos_con_mejor_precio()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal';
  END IF;

  WITH mejor AS (
    SELECT DISTINCT ON (pp.producto_id)
      pp.producto_id,
      pp.proveedor_id,
      pp.precio_compra AS precio
    FROM public.producto_proveedores pp
    WHERE pp.activo_sincronizacion AND pp.disponible
      AND pp.precio_compra IS NOT NULL
    ORDER BY pp.producto_id, pp.precio_compra ASC, pp.proveedor_id
  ),
  caro AS (
    SELECT DISTINCT ON (pp.producto_id)
      pp.producto_id,
      pp.proveedor_id,
      pp.precio_compra AS precio
    FROM public.producto_proveedores pp
    WHERE pp.activo_sincronizacion AND pp.disponible
      AND pp.precio_compra IS NOT NULL
    ORDER BY pp.producto_id, pp.precio_compra DESC, pp.proveedor_id
  ),
  actual AS (
    SELECT DISTINCT ON (pp.producto_id)
      pp.producto_id,
      pr.nombre AS proveedor_actual,
      pp.precio_compra AS precio_actual
    FROM public.producto_proveedores pp
    JOIN public.proveedores pr ON pr.id = pp.proveedor_id
    WHERE pp.es_principal
    ORDER BY pp.producto_id, pp.precio_compra NULLS LAST
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'producto_id', p.id,
    'producto_nombre', COALESCE(p.nombre_comercial, p.nombre),
    'codigo_interno', p.codigo_interno,
    'proveedor_id', m.proveedor_id,
    'proveedor_nombre', prm.nombre,
    'precio_mejor', m.precio,
    'proveedor_caro', prc.nombre,
    'precio_caro', c.precio,
    'diferencia', ROUND((c.precio - m.precio)::numeric, 2),
    'proveedor_actual', a.proveedor_actual,
    'precio_actual', a.precio_actual,
    'ahorro_unitario', CASE WHEN a.precio_actual IS NOT NULL AND a.precio_actual > m.precio
                            THEN ROUND((a.precio_actual - m.precio)::numeric, 2) ELSE NULL END
  ) ORDER BY (a.precio_actual - m.precio) DESC NULLS LAST), '[]'::jsonb)
  INTO v_resultado
  FROM public.productos p
  JOIN mejor m ON m.producto_id = p.id
  JOIN public.proveedores prm ON prm.id = m.proveedor_id
  LEFT JOIN caro c ON c.producto_id = p.id
  LEFT JOIN public.proveedores prc ON prc.id = c.proveedor_id
  LEFT JOIN actual a ON a.producto_id = p.id;

  RETURN v_resultado;
END $$;

-- ============================================================
-- 3) compras_proveedor_resumen()
--    Por proveedor: total comprado, cantidad de compras, última
--    compra, productos distintos comprados y costo promedio.
-- ============================================================
CREATE OR REPLACE FUNCTION public.compras_proveedor_resumen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'proveedor_id', pr.id,
    'proveedor_nombre', pr.nombre,
    'activo', pr.activo,
    'total_comprado', t.total,
    'cantidad_compras', t.compras,
    'ultima_compra', t.ultima,
    'productos_comprados', t.productos,
    'costo_promedio', t.promedio
  ) ORDER BY t.total DESC NULLS LAST), '[]'::jsonb)
  INTO v_resultado
  FROM public.proveedores pr
  LEFT JOIN (
    SELECT
      c.proveedor_id,
      SUM(ci.costo_total) AS total,
      COUNT(DISTINCT c.id) AS compras,
      MAX(c.fecha) AS ultima,
      COUNT(DISTINCT ci.producto_id) AS productos,
      AVG(ci.costo_unitario) AS promedio
    FROM public.compras c
    JOIN public.compra_items ci ON ci.compra_id = c.id
    GROUP BY c.proveedor_id
  ) t ON t.proveedor_id = pr.id;

  RETURN v_resultado;
END $$;

-- ============================================================
-- 4) evolucion_costo_producto(p_producto_id)
--    Serie cronológica real de costos pagados (compra_items):
--    fecha, proveedor, costo unitario, cantidad, total y comprobante.
--    El historial NO se sobrescribe: cada compra es un registro.
-- ============================================================
CREATE OR REPLACE FUNCTION public.evolucion_costo_producto(p_producto_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'compra_id', c.id,
    'fecha', c.fecha,
    'comprobante', c.comprobante,
    'proveedor_id', c.proveedor_id,
    'proveedor_nombre', pr.nombre,
    'variante_id', ci.variante_id,
    'cantidad', ci.cantidad,
    'costo_unitario', ci.costo_unitario,
    'costo_total', ci.costo_total
  ) ORDER BY c.fecha DESC, c.id DESC), '[]'::jsonb)
  INTO v_resultado
  FROM public.compra_items ci
  JOIN public.compras c ON c.id = ci.compra_id
  JOIN public.proveedores pr ON pr.id = c.proveedor_id
  WHERE ci.producto_id = p_producto_id
    AND ci.costo_unitario IS NOT NULL;

  RETURN v_resultado;
END $$;

-- ============================================================
-- 5) dashboard_oportunidades()
--    Productos donde el mejor proveedor activo/disponible es más
--    barato que el proveedor principal actual: ahorro por unidad y
--    ahorro potencial total (precio_actual - mejor) * stock.
--    Recomendaciones calculadas con datos reales.
-- ============================================================
CREATE OR REPLACE FUNCTION public.dashboard_oportunidades()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal';
  END IF;

  WITH mejor AS (
    SELECT DISTINCT ON (pp.producto_id)
      pp.producto_id,
      pp.proveedor_id,
      pp.precio_compra AS precio
    FROM public.producto_proveedores pp
    WHERE pp.activo_sincronizacion AND pp.disponible
      AND pp.precio_compra IS NOT NULL
    ORDER BY pp.producto_id, pp.precio_compra ASC, pp.proveedor_id
  ),
  actual AS (
    SELECT DISTINCT ON (pp.producto_id)
      pp.producto_id,
      pr.nombre AS proveedor_actual,
      pp.precio_compra AS precio_actual
    FROM public.producto_proveedores pp
    JOIN public.proveedores pr ON pr.id = pp.proveedor_id
    WHERE pp.es_principal
    ORDER BY pp.producto_id, pp.precio_compra NULLS LAST
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'producto_id', p.id,
    'producto_nombre', COALESCE(p.nombre_comercial, p.nombre),
    'codigo_interno', p.codigo_interno,
    'proveedor_actual', a.proveedor_actual,
    'costo_actual', a.precio_actual,
    'proveedor_alternativo', prm.nombre,
    'costo_alternativo', m.precio,
    'ahorro_unitario', ROUND((a.precio_actual - m.precio)::numeric, 2),
    'stock', p.stock,
    'ahorro_potencial', ROUND((a.precio_actual - m.precio)::numeric * COALESCE(p.stock, 0), 2)
  ) ORDER BY (a.precio_actual - m.precio) DESC NULLS LAST), '[]'::jsonb)
  INTO v_resultado
  FROM public.productos p
  JOIN mejor m ON m.producto_id = p.id
  JOIN public.proveedores prm ON prm.id = m.proveedor_id
  JOIN actual a ON a.producto_id = p.id
  WHERE a.precio_actual IS NOT NULL
    AND m.precio < a.precio_actual;

  RETURN v_resultado;
END $$;

-- ============================================================
-- 6) proveedor_detalle(p_proveedor_id)
--    Ficha del proveedor: datos, productos que vende (con precio,
--    código y disponibilidad) y compras registradas (fecha, número,
--    total y cantidad de ítems).
-- ============================================================
CREATE OR REPLACE FUNCTION public.proveedor_detalle(p_proveedor_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proveedor jsonb;
  v_productos jsonb;
  v_compras jsonb;
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal';
  END IF;

  SELECT jsonb_build_object(
    'id', pr.id,
    'nombre', pr.nombre,
    'telefono', pr.telefono,
    'whatsapp', pr.whatsapp,
    'email', pr.email,
    'web', pr.web,
    'observaciones', pr.observaciones,
    'activo', pr.activo,
    'creado', pr.created_at
  ) INTO v_proveedor
  FROM public.proveedores pr
  WHERE pr.id = p_proveedor_id;

  IF v_proveedor IS NULL THEN
    RAISE EXCEPTION 'Proveedor no encontrado';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'producto_id', p.id,
    'producto_nombre', COALESCE(p.nombre_comercial, p.nombre),
    'codigo_interno', p.codigo_interno,
    'codigo_proveedor', pp.codigo_proveedor,
    'precio_compra', pp.precio_compra,
    'disponible', pp.disponible,
    'es_principal', pp.es_principal,
    'moneda', pp.moneda,
    'cantidad_minima', pp.cantidad_minima,
    'tiempo_entrega', pp.tiempo_entrega,
    'ultimo_cambio_precio', pp.ultimo_cambio_precio
  ) ORDER BY p.nombre), '[]'::jsonb)
  INTO v_productos
  FROM public.producto_proveedores pp
  JOIN public.productos p ON p.id = pp.producto_id
  WHERE pp.proveedor_id = p_proveedor_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'compra_id', c.id,
    'fecha', c.fecha,
    'comprobante', c.comprobante,
    'observaciones', c.observaciones,
    'total', (SELECT SUM(ci2.costo_total) FROM public.compra_items ci2 WHERE ci2.compra_id = c.id),
    'items', (SELECT COUNT(*) FROM public.compra_items ci2 WHERE ci2.compra_id = c.id)
  ) ORDER BY c.fecha DESC, c.id DESC), '[]'::jsonb)
  INTO v_compras
  FROM public.compras c
  WHERE c.proveedor_id = p_proveedor_id;

  RETURN jsonb_build_object(
    'proveedor', v_proveedor,
    'productos', v_productos,
    'compras', v_compras
  );
END $$;

-- ============================================================
-- REVERSIÓN (requiere autorización explícita, no se ejecuta):
--   DROP FUNCTION IF EXISTS public.mejor_precio_producto(bigint);
--   DROP FUNCTION IF EXISTS public.productos_con_mejor_precio();
--   DROP FUNCTION IF EXISTS public.compras_proveedor_resumen();
--   DROP FUNCTION IF EXISTS public.evolucion_costo_producto(bigint);
--   DROP FUNCTION IF EXISTS public.dashboard_oportunidades();
--   DROP FUNCTION IF EXISTS public.proveedor_detalle(bigint);
-- ============================================================
