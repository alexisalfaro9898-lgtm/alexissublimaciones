-- ============================================================
-- MIGRACIÓN v13: columnas nuevas en producto_proveedores
-- ============================================================
-- QUÉ HACE: agrega moneda (default 'UYU'), cantidad_minima (mínimo de
--   compra) y tiempo_entrega (texto) a la relación producto-proveedor.
-- IDEMPOTENTE: sí (ADD COLUMN IF NOT EXISTS).
-- REVERSIBLE: sí (DROP COLUMN, ver abajo).
-- NO toca productos, pedidos ni ningún dato existente.

ALTER TABLE public.producto_proveedores
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'UYU';

ALTER TABLE public.producto_proveedores
  ADD COLUMN IF NOT EXISTS cantidad_minima numeric(12,2);

ALTER TABLE public.producto_proveedores
  ADD COLUMN IF NOT EXISTS tiempo_entrega text;

COMMENT ON COLUMN public.producto_proveedores.moneda IS 'Moneda del precio de compra (UYU por defecto).';
COMMENT ON COLUMN public.producto_proveedores.cantidad_minima IS 'Cantidad mínima de compra exigida por el proveedor.';
COMMENT ON COLUMN public.producto_proveedores.tiempo_entrega IS 'Tiempo estimado de entrega del proveedor (ej: "3-5 días").';

-- Verificación (solo lectura)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'producto_proveedores'
  AND column_name IN ('moneda', 'cantidad_minima', 'tiempo_entrega');

-- ============================================================
-- REVERSIÓN (requiere autorización explícita, no se ejecuta):
--   ALTER TABLE public.producto_proveedores DROP COLUMN IF EXISTS tiempo_entrega;
--   ALTER TABLE public.producto_proveedores DROP COLUMN IF EXISTS cantidad_minima;
--   ALTER TABLE public.producto_proveedores DROP COLUMN IF EXISTS moneda;
-- ============================================================
