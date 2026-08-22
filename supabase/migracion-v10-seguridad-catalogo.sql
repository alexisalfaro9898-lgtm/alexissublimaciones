-- ============================================================
-- migracion-v10-seguridad-catalogo.sql
-- CORRECCIÓN: ANON podía leer productos completos (incl.
-- precio_costo, proveedor_nombre) vía la política PUBLIC.
-- Se restringe el SELECT directo a la rol authenticated
-- (portal con sesión y admin). ANON queda con 0 filas y solo
-- puede usar catalogo_publico() (security definer, campos
-- públicos). No rompe admin ni portal (ambos usan
-- authenticated). Reversible: recrear las políticas PUBLIC.
-- ============================================================

DROP POLICY IF EXISTS productos_select_publico ON public.productos;
DROP POLICY IF EXISTS productos_select_authenticated ON public.productos;

CREATE POLICY productos_select_authenticated
  ON public.productos
  FOR SELECT
  TO authenticated
  USING ((activo = true) OR es_personal());

DROP POLICY IF EXISTS producto_variantes_select_publico ON public.producto_variantes;
DROP POLICY IF EXISTS producto_variantes_select_authenticated ON public.producto_variantes;

CREATE POLICY producto_variantes_select_authenticated
  ON public.producto_variantes
  FOR SELECT
  TO authenticated
  USING (true);