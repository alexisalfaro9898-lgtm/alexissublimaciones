-- ============================================================
-- MIGRACIÓN v21: catálogo público muestra mockups
-- ============================================================
-- La vitrina lee producto.imagen_principal del RPC.
-- Modifico el RPC catalogo_publico para que devuelva primero
-- imagen_mockup (generado en v20) y, si no existe, la foto en
-- blanco original. Expone además imagen_mockup/imagen_original
-- para usos futuros. Sin cambios en el frontend.
-- Idempotente (CREATE OR REPLACE). Reversible.
-- ============================================================

CREATE OR REPLACE FUNCTION public.catalogo_publico(
  p_busqueda text DEFAULT NULL,
  p_categoria_id bigint DEFAULT NULL,
  p_limite integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
      'imagen_principal', CASE
          WHEN pr.usa_mockup THEN COALESCE(pr.imagen_mockup, pr.imagen_original, pr.imagen_principal)
          ELSE COALESCE(pr.imagen_original, pr.imagen_principal)
        END,
      'imagen_mockup', pr.imagen_mockup,
      'imagen_original', pr.imagen_original,
      'usa_mockup', pr.usa_mockup,
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