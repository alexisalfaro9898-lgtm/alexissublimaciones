-- ============================================================
-- MIGRACIÓN v12: RLS de tablas administrativas de proveedores y costos
-- ============================================================
-- QUÉ HACE: habilita SELECT / INSERT / DELETE (es_personal) en las 5
--   tablas que hoy solo tienen política UPDATE. Sin cambios de estructura.
-- IDEMPOTENTE: sí (DO + IF NOT EXISTS sobre pg_policies).
-- REVERSIBLE: sí (DROP POLICY de las políticas creadas, ver abajo).
-- SEGURIDAD: solo el personal (es_personal) puede leer/escribir.
--   Los clientes (authenticated sin es_personal) siguen bloqueados.

DO $$
BEGIN
  -- ---------- proveedores ----------
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedores'
                   AND policyname = 'proveedores_select_personal') THEN
    CREATE POLICY proveedores_select_personal ON public.proveedores
      FOR SELECT TO authenticated USING (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedores'
                   AND policyname = 'proveedores_insert_personal') THEN
    CREATE POLICY proveedores_insert_personal ON public.proveedores
      FOR INSERT TO authenticated WITH CHECK (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedores'
                   AND policyname = 'proveedores_delete_personal') THEN
    CREATE POLICY proveedores_delete_personal ON public.proveedores
      FOR DELETE TO authenticated USING (es_personal());
  END IF;

  -- ---------- producto_proveedores ----------
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'producto_proveedores'
                   AND policyname = 'producto_proveedores_select_personal') THEN
    CREATE POLICY producto_proveedores_select_personal ON public.producto_proveedores
      FOR SELECT TO authenticated USING (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'producto_proveedores'
                   AND policyname = 'producto_proveedores_insert_personal') THEN
    CREATE POLICY producto_proveedores_insert_personal ON public.producto_proveedores
      FOR INSERT TO authenticated WITH CHECK (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'producto_proveedores'
                   AND policyname = 'producto_proveedores_delete_personal') THEN
    CREATE POLICY producto_proveedores_delete_personal ON public.producto_proveedores
      FOR DELETE TO authenticated USING (es_personal());
  END IF;

  -- ---------- proveedor_historial ----------
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedor_historial'
                   AND policyname = 'proveedor_historial_select_personal') THEN
    CREATE POLICY proveedor_historial_select_personal ON public.proveedor_historial
      FOR SELECT TO authenticated USING (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedor_historial'
                   AND policyname = 'proveedor_historial_insert_personal') THEN
    CREATE POLICY proveedor_historial_insert_personal ON public.proveedor_historial
      FOR INSERT TO authenticated WITH CHECK (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedor_historial'
                   AND policyname = 'proveedor_historial_delete_personal') THEN
    CREATE POLICY proveedor_historial_delete_personal ON public.proveedor_historial
      FOR DELETE TO authenticated USING (es_personal());
  END IF;

  -- ---------- proveedor_sincronizaciones ----------
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedor_sincronizaciones'
                   AND policyname = 'proveedor_sincronizaciones_select_personal') THEN
    CREATE POLICY proveedor_sincronizaciones_select_personal ON public.proveedor_sincronizaciones
      FOR SELECT TO authenticated USING (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedor_sincronizaciones'
                   AND policyname = 'proveedor_sincronizaciones_insert_personal') THEN
    CREATE POLICY proveedor_sincronizaciones_insert_personal ON public.proveedor_sincronizaciones
      FOR INSERT TO authenticated WITH CHECK (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'proveedor_sincronizaciones'
                   AND policyname = 'proveedor_sincronizaciones_delete_personal') THEN
    CREATE POLICY proveedor_sincronizaciones_delete_personal ON public.proveedor_sincronizaciones
      FOR DELETE TO authenticated USING (es_personal());
  END IF;

  -- ---------- precios_productos ----------
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'precios_productos'
                   AND policyname = 'precios_productos_select_personal') THEN
    CREATE POLICY precios_productos_select_personal ON public.precios_productos
      FOR SELECT TO authenticated USING (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'precios_productos'
                   AND policyname = 'precios_productos_insert_personal') THEN
    CREATE POLICY precios_productos_insert_personal ON public.precios_productos
      FOR INSERT TO authenticated WITH CHECK (es_personal());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'precios_productos'
                   AND policyname = 'precios_productos_delete_personal') THEN
    CREATE POLICY precios_productos_delete_personal ON public.precios_productos
      FOR DELETE TO authenticated USING (es_personal());
  END IF;
END $$;

-- ============================================================
-- REVERSIÓN (requiere autorización explícita, no se ejecuta):
--   DROP POLICY IF EXISTS proveedores_select_personal ON public.proveedores;
--   DROP POLICY IF EXISTS proveedores_insert_personal ON public.proveedores;
--   DROP POLICY IF EXISTS proveedores_delete_personal ON public.proveedores;
--   DROP POLICY IF EXISTS producto_proveedores_select_personal ON public.producto_proveedores;
--   DROP POLICY IF EXISTS producto_proveedores_insert_personal ON public.producto_proveedores;
--   DROP POLICY IF EXISTS producto_proveedores_delete_personal ON public.producto_proveedores;
--   DROP POLICY IF EXISTS proveedor_historial_select_personal ON public.proveedor_historial;
--   DROP POLICY IF EXISTS proveedor_historial_insert_personal ON public.proveedor_historial;
--   DROP POLICY IF EXISTS proveedor_historial_delete_personal ON public.proveedor_historial;
--   DROP POLICY IF EXISTS proveedor_sincronizaciones_select_personal ON public.proveedor_sincronizaciones;
--   DROP POLICY IF EXISTS proveedor_sincronizaciones_insert_personal ON public.proveedor_sincronizaciones;
--   DROP POLICY IF EXISTS proveedor_sincronizaciones_delete_personal ON public.proveedor_sincronizaciones;
--   DROP POLICY IF EXISTS precios_productos_select_personal ON public.precios_productos;
--   DROP POLICY IF EXISTS precios_productos_insert_personal ON public.precios_productos;
--   DROP POLICY IF EXISTS precios_productos_delete_personal ON public.precios_productos;
-- ============================================================
