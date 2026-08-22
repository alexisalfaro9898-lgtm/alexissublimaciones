-- ============================================================
-- MIGRACIÓN v14: vincular los 1364 productos a Disershop
-- ============================================================
-- QUÉ HACE: crea la relación producto_proveedores para CADA producto
--   cuyo proveedor_nombre = 'Disershop', usando el registro real de la
--   tabla proveedores. precio_compra inicial = precio_costo existente.
-- REGLAS:
--   * SOLO Disershop (dato real confirmado: proveedor_nombre = 'Disershop').
--   * NO se asignan productos a BR Importaciones ni Comodines Mayorista.
--   * NO se inventan precios: precio_compra = precio_costo (o NULL si no hay).
--   * NO se modifica/elimina proveedor_nombre (se conserva).
--   * NO se tocan productos, pedidos, pedido_detalles ni variantes.
-- IDEMPOTENTE: sí (INSERT ... WHERE NOT EXISTS).
-- REVERSIBLE: sí (DELETE de las relaciones creadas, ver abajo).

BEGIN;

-- Guarda: debe existir EXACTAMENTE 1 proveedor activo llamado 'Disershop'.
-- Si hay 0 o más de 1, aborta sin tocar nada.
DO $$
DECLARE
  v_cantidad integer;
BEGIN
  SELECT count(*) INTO v_cantidad FROM public.proveedores
   WHERE nombre = 'Disershop' AND activo = true;

  IF v_cantidad <> 1 THEN
    RAISE EXCEPTION 'Se requiere exactamente 1 proveedor activo "Disershop" (encontrados: %). Migración abortada.', v_cantidad;
  END IF;
END $$;

-- Inserta la relación (una sola fila por par producto-proveedor).
INSERT INTO public.producto_proveedores
  (producto_id, proveedor_id, codigo_proveedor, precio_compra,
   es_principal, activo_sincronizacion, disponible, moneda,
   ultimo_cambio_precio, observaciones)
SELECT
  p.id,
  pr.id,
  p.codigo_interno,
  p.precio_costo,
  true,                                   -- es_principal
  true,                                   -- activo_sincronizacion
  true,                                   -- disponible
  'UYU',
  NULL,                                   -- ultimo_cambio_precio: sin fecha de cambio real
  'Vincular: migración v14 desde proveedor_nombre.'
FROM public.productos p
JOIN public.proveedores pr
  ON pr.nombre = 'Disershop' AND pr.activo = true
WHERE p.proveedor_nombre = 'Disershop'
  AND NOT EXISTS (
    SELECT 1 FROM public.producto_proveedores pp
    WHERE pp.producto_id = p.id AND pp.proveedor_id = pr.id
  );

COMMIT;

-- ============================================================
-- VERIFICACIÓN (solo lectura, después de aplicar)
-- 1) Cantidad de relaciones creadas (debe ser 1364):
--    SELECT count(*) FROM public.producto_proveedores;
-- 2) Productos con proveedor_nombre = 'Disershop' sin relación (debe ser 0):
--    SELECT count(*) FROM public.productos p
--    WHERE p.proveedor_nombre = 'Disershop'
--      AND NOT EXISTS (SELECT 1 FROM public.producto_proveedores pp
--                      WHERE pp.producto_id = p.id AND pp.proveedor_id = (SELECT id FROM proveedores WHERE nombre='Disershop'));
-- 3) Sin duplicados (debe ser 0):
--    SELECT count(*) FROM (SELECT producto_id, proveedor_id, count(*)
--    FROM public.producto_proveedores
--    GROUP BY producto_id, proveedor_id HAVING count(*) > 1) d;
-- 4) precio_compra = precio_costo donde existía (discrepancias esperadas: 0):
--    SELECT count(*) FROM public.producto_proveedores pp
--    JOIN public.productos p ON p.id = pp.producto_id
--    JOIN public.proveedores pr ON pr.id = pp.proveedor_id
--    WHERE pr.nombre = 'Disershop' AND p.precio_costo IS NOT NULL
--      AND pp.precio_compra IS DISTINCT FROM p.precio_costo;
-- 5) Ningún producto quedó con proveedor distinto de Disershop:
--    SELECT DISTINCT pr.nombre FROM public.producto_proveedores pp
--    JOIN public.proveedores pr ON pr.id = pp.proveedor_id;
-- 6) proveedor_nombre intacto:
--    SELECT proveedor_nombre, count(*) FROM public.productos GROUP BY 1;
-- ============================================================
-- REVERSIÓN (requiere autorización explícita, no se ejecuta):
--   DELETE FROM public.producto_proveedores
--   WHERE proveedor_id = (SELECT id FROM public.proveedores WHERE nombre = 'Disershop');
-- ============================================================
