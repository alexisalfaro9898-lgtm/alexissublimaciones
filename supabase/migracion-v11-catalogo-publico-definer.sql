-- ============================================================
-- migracion-v11-catalogo-publico-definer.sql
-- CORRECCIÓN: catalogo_publico se creó sin SECURITY DEFINER
-- (era SECURITY INVOKER). Tras la corrección v10 (políticas
-- de productos/variantes restringidas a authenticated), un
-- usuario ANON que llama al RPC ve 0 filas (RLS filtra todo)
-- y el catálogo público devuelve []. Con SECURITY DEFINER el
-- RPC lee con privilegios del owner y expone SOLO las columnas
-- públicas listadas explícitamente (nunca precio_costo,
-- proveedor_nombre ni márgenes).
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