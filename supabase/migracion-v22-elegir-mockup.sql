-- ============================================================
-- MIGRACIÓN v22: elegir imagen por producto
-- ============================================================
-- Permite que cada producto decida si la vitrina muestra el
-- mockup generado o la foto original en blanco.
-- usa_mockup = true  -> imagen_mockup (si existe), si no original
-- usa_mockup = false -> imagen_original (si existe), si no la foto
-- Idempotente (IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS usa_mockup BOOLEAN NOT NULL DEFAULT true;

-- el administrador (authenticated) debe poder leer/editar el flag
-- (las políticas existentes de productos ya cubren authenticated;
-- este ALTER solo garantiza la columna).