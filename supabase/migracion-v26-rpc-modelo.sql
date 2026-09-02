-- Migración v26: RPCs por modelo (reemplaza RPCs por familia)
DROP FUNCTION IF EXISTS public.catalogo_agrupado(text, bigint, integer);
DROP FUNCTION IF EXISTS public.variaciones_familia(text, bigint);

-- RPC: Catálogo agrupado por MODELO
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
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT
      pr.modelo,
      pr.nombre,
      pr.imagen_principal,
      pr.precio,
      pr.id,
      pr.categoria_id
    FROM public.productos pr
    WHERE pr.activo
      AND pr.imagen_principal IS NOT NULL
      AND pr.modelo IS NOT NULL
      AND (p_busqueda IS NULL OR pr.nombre ILIKE '%' || p_busqueda || '%')
      AND (p_categoria_id IS NULL OR pr.categoria_id = p_categoria_id)
  ),
  agrupado AS (
    SELECT
      modelo,
      MAX(nombre) AS nombre_familia,
      COUNT(*) AS variantes,
      MAX(imagen_principal) AS imagen_principal,
      MIN(precio) AS precio_desde,
      MAX(precio) AS precio_hasta,
      (ARRAY_AGG(id ORDER BY id))[1] AS producto_ejemplo_id,
      (ARRAY_AGG(categoria_id ORDER BY id))[1] AS categoria_id
    FROM base
    GROUP BY modelo
  )
  SELECT
    a.modelo,
    a.nombre_familia,
    a.variantes,
    a.imagen_principal,
    a.precio_desde,
    a.precio_hasta,
    a.producto_ejemplo_id,
    a.categoria_id
  FROM agrupado a
  ORDER BY a.variantes DESC, a.nombre_familia
  LIMIT GREATEST(1, LEAST(p_limite, 500));
$$;

-- RPC: Variaciones de un MODELO específico
CREATE OR REPLACE FUNCTION public.variaciones_modelo(
  p_modelo text,
  p_categoria_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  nombre text,
  imagen_principal text,
  precio numeric,
  precio_publico numeric,
  precio_mayorista numeric,
  descripcion text,
  categoria_id bigint,
  stock integer,
  codigo_interno text,
  permite_personalizacion boolean
)
LANGUAGE sql STABLE AS $$
  SELECT
    pr.id,
    pr.nombre,
    pr.imagen_principal,
    pr.precio,
    pr.precio_publico,
    pr.precio_mayorista,
    pr.descripcion,
    pr.categoria_id,
    pr.stock,
    pr.codigo_interno,
    pr.permite_personalizacion
  FROM public.productos pr
  WHERE pr.activo
    AND pr.modelo = p_modelo
    AND (p_categoria_id IS NULL OR pr.categoria_id = p_categoria_id)
  ORDER BY pr.precio ASC, pr.nombre;
$$;

-- SECURITY DEFINER para que anon/authenticated puedan leer (RLS en productos)
ALTER FUNCTION public.catalogo_agrupado(text, bigint, integer) SECURITY DEFINER;
ALTER FUNCTION public.variaciones_modelo(text, bigint) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.catalogo_agrupado(text, bigint, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.variaciones_modelo(text, bigint) TO anon, authenticated;
