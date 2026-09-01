-- ============================================================
-- MIGRACIÓN v19: Eliminar productos inactivos físicamente
-- ============================================================
-- Borra productos con activo = false.
-- Para poder borrarlos se elimina primero su vínculo en
-- producto_proveedores (verificado: son vínculos vacíos, sin
-- precio_compra, stock, imagen ni sincronización; no aportan
-- datos al dashboard ni a la comparación de proveedores).
-- Los inactivos NO tienen pedidos, compras, variantes,
-- precios_productos, preguntas ni personalizaciones.

-- 1. Reporte ANTES
DO $$
DECLARE
  v_activos INT;
  v_inactivos INT;
  v_vinculos INT;
BEGIN
  SELECT count(*) INTO v_activos FROM productos WHERE activo = true;
  SELECT count(*) INTO v_inactivos FROM productos WHERE activo = false;
  SELECT count(*) INTO v_vinculos
  FROM producto_proveedores pp JOIN productos p ON p.id = pp.producto_id
  WHERE p.activo = false;

  RAISE NOTICE '=== ANTES DEL BORRADO ===';
  RAISE NOTICE 'Productos activos: %', v_activos;
  RAISE NOTICE 'Productos inactivos a borrar: %', v_inactivos;
  RAISE NOTICE 'Vínculos a proveedor (vacíos) a borrar: %', v_vinculos;
END $$;

-- 2. Eliminar vínculos a proveedor de los productos inactivos
DELETE FROM producto_proveedores pp
USING productos p
WHERE pp.producto_id = p.id AND p.activo = false;

-- 3. Eliminar los productos inactivos
DELETE FROM productos WHERE activo = false;

-- 4. Reporte DESPUÉS
DO $$
DECLARE
  v_activos INT;
  v_inactivos INT;
  v_total INT;
BEGIN
  SELECT count(*) INTO v_activos FROM productos WHERE activo = true;
  SELECT count(*) INTO v_inactivos FROM productos WHERE activo = false;
  SELECT count(*) INTO v_total FROM productos;

  RAISE NOTICE '=== DESPUÉS DEL BORRADO ===';
  RAISE NOTICE 'Productos activos: %', v_activos;
  RAISE NOTICE 'Productos inactivos restantes: %', v_inactivos;
  RAISE NOTICE 'Total productos: %', v_total;
END $$;