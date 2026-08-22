-- ============================================================
-- MIGRACIÓN v17: RPC de lectura alertas_precio
-- ============================================================
-- QUÉ HACE: reporte SOLO LECTURA de aumentos de costo que
--   superaron el umbral del proveedor (porcentaje_alerta_precio).
--   Se basa en proveedor_historial (origen 'compra', tipo
--   'precio_costo') + producto_proveedores + proveedores.
--   NO envía notificaciones, NO modifica nada.
-- REGLA: alerta cuando
--   precio_nuevo > precio_anterior * (1 + porcentaje_alerta_precio / 100)
--   (con precio_anterior > 0).
-- SEGURIDAD: SECURITY DEFINER con guarda es_personal().
-- IDEMPOTENTE: sí (CREATE OR REPLACE FUNCTION).
-- REVERSIBLE: sí (DROP FUNCTION public.alertas_precio()).

CREATE OR REPLACE FUNCTION public.alertas_precio()
RETURNS TABLE (
  producto_id bigint,
  producto text,
  proveedor text,
  proveedor_id bigint,
  precio_anterior numeric,
  precio_nuevo numeric,
  porcentaje_alerta numeric,
  aumento_porcentaje numeric,
  fecha_cambio timestamptz,
  observaciones text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT es_personal() THEN
    RAISE EXCEPTION 'Acceso restringido al personal';
  END IF;

  RETURN QUERY
    SELECT
      pr.producto_id,
      p.nombre AS producto,
      prov.nombre AS proveedor,
      prov.id AS proveedor_id,
      h.precio_anterior,
      h.precio_nuevo,
      prov.porcentaje_alerta_precio,
      ROUND(
        (h.precio_nuevo - h.precio_anterior)
        / h.precio_anterior * 100,
        2
      ) AS aumento_porcentaje,
      h.fecha_cambio,
      h.observaciones
    FROM public.proveedor_historial h
    JOIN public.producto_proveedores pr
      ON pr.id = h.producto_proveedor_id
    JOIN public.productos p
      ON p.id = pr.producto_id
    JOIN public.proveedores prov
      ON prov.id = pr.proveedor_id
    WHERE h.tipo_cambio = 'precio_costo'
      AND h.precio_anterior > 0
      AND h.precio_nuevo > h.precio_anterior
      AND h.precio_nuevo > h.precio_anterior
          * (1 + prov.porcentaje_alerta_precio / 100)
    ORDER BY h.fecha_cambio DESC, h.id DESC;
END $$;

-- ============================================================
-- REVERSIÓN (requiere autorización explícita, no se ejecuta):
--   DROP FUNCTION IF EXISTS public.alertas_precio();
-- ============================================================