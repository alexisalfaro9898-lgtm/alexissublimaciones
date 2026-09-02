-- Migración v27: mejorar nombre representativo de cada modelo
CREATE OR REPLACE FUNCTION public.catalogo_agrupado(
  p_busqueda text DEFAULT NULL,
  p_categoria_id bigint DEFAULT NULL,
  p_limite integer DEFAULT 100
)
RETURNS TABLE (
  modelo text,
  nombre_familia text,
  variantes bigint,
  imagen_principal text,
  precio_desde numeric,
  precio_hasta numeric,
  producto_ejemplo_id bigint,
  categoria_id bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH base AS (
    SELECT
      pr.modelo,
      pr.nombre,
      pr.imagen_principal,
      pr.precio,
      pr.id,
      pr.categoria_id,
      row_number() OVER (PARTITION BY pr.modelo ORDER BY pr.id) AS rn
    FROM public.productos pr
    WHERE pr.activo
      AND pr.imagen_principal IS NOT NULL
      AND pr.modelo IS NOT NULL
      AND (p_busqueda IS NULL OR pr.nombre ILIKE '%' || p_busqueda || '%')
      AND (p_categoria_id IS NULL OR pr.categoria_id = p_categoria_id)
  ),
  ejemplo AS (
    SELECT * FROM base WHERE rn = 1
  ),
  agg AS (
    SELECT
      modelo,
      COUNT(*) AS variantes,
      MIN(precio) AS precio_desde,
      MAX(precio) AS precio_hasta,
      MIN(id) AS producto_ejemplo_id
    FROM base
    GROUP BY modelo
  )
  SELECT
    a.modelo,
    e.nombre AS nombre_familia,
    a.variantes,
    e.imagen_principal,
    a.precio_desde,
    a.precio_hasta,
    a.producto_ejemplo_id,
    e.categoria_id
  FROM agg a
  JOIN ejemplo e ON e.modelo = a.modelo
  ORDER BY a.variantes DESC, e.nombre
  LIMIT GREATEST(1, LEAST(p_limite, 500));
$$;

GRANT EXECUTE ON FUNCTION public.catalogo_agrupado(text, bigint, integer) TO anon, authenticated;
