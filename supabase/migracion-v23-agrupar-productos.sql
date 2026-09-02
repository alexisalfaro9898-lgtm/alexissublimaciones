-- Migración v23: Agrupar productos por familia en la vitrina
-- Objetivo: En vez de mostrar 935 productos sueltos, mostrar UNO por familia
-- y al hacer clic ver todas las variaciones (tamaños, colores, precios)

-- Función para extraer la "familia" de un producto
CREATE OR REPLACE FUNCTION public.familia_producto(p_nombre text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_nombre ~* '^azulejo'        THEN 'Azulejo'
    WHEN p_nombre ~* '^taza'           THEN 'Taza'
    WHEN p_nombre ~* '^botella'        THEN 'Botella'
    WHEN p_nombre ~* '^vaso'           THEN 'Vaso'
    WHEN p_nombre ~* '^mate'           THEN 'Mate'
    WHEN p_nombre ~* '^termo'          THEN 'Termo'
    WHEN p_nombre ~* '^lapicera'       THEN 'Lapicera'
    WHEN p_nombre ~* '^camiseta'       THEN 'Camiseta'
    WHEN p_nombre ~* '^gorro'          THEN 'Gorro'
    WHEN p_nombre ~* '^body'           THEN 'Body'
    WHEN p_nombre ~* '^bolso'          THEN 'Bolso'
    WHEN p_nombre ~* '^chapa'          THEN 'Chapa'
    WHEN p_nombre ~* '^posavaso'       THEN 'Posavaso'
    WHEN p_nombre ~* '^frasco'         THEN 'Frasco'
    WHEN p_nombre ~* '^neceser'        THEN 'Neceser'
    WHEN p_nombre ~* '^agenda'         THEN 'Agenda'
    WHEN p_nombre ~* '^caramañola'     THEN 'Caramañola'
    WHEN p_nombre ~* '^jarro'          THEN 'Jarro'
    WHEN p_nombre ~* '^base para'      THEN 'Base para'
    WHEN p_nombre ~* '^peine'          THEN 'Peine'
    WHEN p_nombre ~* '^pin'            THEN 'Pin'
    WHEN p_nombre ~* '^adorno'         THEN 'Adorno'
    WHEN p_nombre ~* '^canguro'        THEN 'Canguro'
    WHEN p_nombre ~* '^buzo'           THEN 'Buzo'
    WHEN p_nombre ~* '^toalla'         THEN 'Toalla'
    WHEN p_nombre ~* '^mochila'        THEN 'Mochila'
    WHEN p_nombre ~* '^bolsa'          THEN 'Bolsa'
    WHEN p_nombre ~* '^bandera'        THEN 'Bandera'
    WHEN p_nombre ~* '^caja'           THEN 'Caja'
    WHEN p_nombre ~* '^musculosa'      THEN 'Musculosa'
    WHEN p_nombre ~* '^delantal'       THEN 'Delantal'
    WHEN p_nombre ~* '^lunchera'       THEN 'Lunchera'
    WHEN p_nombre ~* '^top'            THEN 'Top'
    WHEN p_nombre ~* '^placa'          THEN 'Placa'
    WHEN p_nombre ~* '^llavero'        THEN 'Llavero'
    WHEN p_nombre ~* '^bombilla'       THEN 'Bombilla'
    WHEN p_nombre ~* '^porta'          THEN 'Porta'
    WHEN p_nombre ~* '^carpeta'        THEN 'Carpeta'
    WHEN p_nombre ~* '^acordeon'       THEN 'Acordeon'
    WHEN p_nombre ~* '^cartera'        THEN 'Cartera'
    WHEN p_nombre ~* '^funda'          THEN 'Funda'
    WHEN p_nombre ~* '^cinta'          THEN 'Cinta'
    WHEN p_nombre ~* '^imAN'           THEN 'Iman'
    WHEN p_nombre ~* '^tablero'        THEN 'Tablero'
    WHEN p_nombre ~* '^remera'         THEN 'Remera'
    WHEN p_nombre ~* '^saco'           THEN 'Saco'
    WHEN p_nombre ~* '^bermuda'        THEN 'Bermuda'
    WHEN p_nombre ~* '^pollera'        THEN 'Pollera'
    WHEN p_nombre ~* '^jacket'         THEN 'Jacket'
    WHEN p_nombre ~* '^campera'        THEN 'Campera'
    WHEN p_nombre ~* '^whisky'         THEN 'Whisky'
    WHEN p_nombre ~* '^vaso sublimable' THEN 'Vaso sublimable'
    WHEN p_nombre ~* '^taza termica'   THEN 'Taza termica'
    WHEN p_nombre ~* '^taza sublimable' THEN 'Taza sublimable'
    WHEN p_nombre ~* '^taza personalizada' THEN 'Taza personalizada'
    WHEN p_nombre ~* '^botella acero'  THEN 'Botella acero'
    WHEN p_nombre ~* '^botella degrad' THEN 'Botella degrade'
    WHEN p_nombre ~* '^botella sublimable' THEN 'Botella sublimable'
    WHEN p_nombre ~* '^gorro 5013'     THEN 'Gorro 5013'
    WHEN p_nombre ~* '^gorro 5001'     THEN 'Gorro 5001'
    WHEN p_nombre ~* '^gorro 5012'     THEN 'Gorro 5012'
    WHEN p_nombre ~* '^gorro 5016'     THEN 'Gorro 5016'
    WHEN p_nombre ~* '^gorro 5018'     THEN 'Gorro 5018'
    WHEN p_nombre ~* '^camiseta dry'   THEN 'Camiseta dry'
    WHEN p_nombre ~* '^camiseta fashion' THEN 'Camiseta fashion'
    WHEN p_nombre ~* '^camiseta niño'  THEN 'Camiseta niño'
    WHEN p_nombre ~* '^camiseta sublimable' THEN 'Camiseta sublimable'
    WHEN p_nombre ~* '^camiseta solo'  THEN 'Camiseta solo'
    WHEN p_nombre ~* '^lapicera ls'    THEN 'Lapicera'
    WHEN p_nombre ~* '^jarro apilable' THEN 'Jarro apilable'
    WHEN p_nombre ~* '^jarro esmaltado' THEN 'Jarro esmaltado'
    WHEN p_nombre ~* '^mate imperial'  THEN 'Mate imperial'
    WHEN p_nombre ~* '^mate de acero'  THEN 'Mate de acero'
    WHEN p_nombre ~* '^mate curvo'     THEN 'Mate curvo'
    WHEN p_nombre ~* '^mate ceremonia' THEN 'Mate ceremonia'
    WHEN p_nombre ~* '^termo de acero' THEN 'Termo de acero'
    WHEN p_nombre ~* '^termo sublimable' THEN 'Termo sublimable'
    WHEN p_nombre ~* '^bolso yute'     THEN 'Bolso yute'
    WHEN p_nombre ~* '^bolso tote'     THEN 'Bolso tote'
    WHEN p_nombre ~* '^bolsa paper'    THEN 'Bolsa paper'
    WHEN p_nombre ~* '^bolsa non woven' THEN 'Bolsa non woven'
    WHEN p_nombre ~* '^canguro sublimable' THEN 'Canguro sublimable'
    WHEN p_nombre ~* '^toalla sublimable' THEN 'Toalla sublimable'
    WHEN p_nombre ~* '^mochila sublimable' THEN 'Mochila sublimable'
    WHEN p_nombre ~* '^musculosa sublimable' THEN 'Musculosa sublimable'
    WHEN p_nombre ~* '^delantal sublimable' THEN 'Delantal sublimable'
    WHEN p_nombre ~* '^lunchera sublimable' THEN 'Lunchera sublimable'
    WHEN p_nombre ~* '^placa sublimable' THEN 'Placa sublimable'
    WHEN p_nombre ~* '^caramañola infantil' THEN 'Caramañola infantil'
    WHEN p_nombre ~* '^frasco esmerilado' THEN 'Frasco esmerilado'
    WHEN p_nombre ~* '^neceser sublimable' THEN 'Neceser sublimable'
    WHEN p_nombre ~* '^agenda 2026'    THEN 'Agenda 2026'
    WHEN p_nombre ~* '^agenda perpetua' THEN 'Agenda perpetua'
    WHEN p_nombre ~* '^posavaso sublimable irregular' THEN 'Posavaso irregular'
    WHEN p_nombre ~* '^posavaso sublimable rectangular' THEN 'Posavaso rectangular'
    WHEN p_nombre ~* '^posavaso sublimable' THEN 'Posavaso sublimable'
    WHEN p_nombre ~* '^chapa sublimable' THEN 'Chapa sublimable'
    WHEN p_nombre ~* '^adorno arbolito' THEN 'Adorno arbolito'
    WHEN p_nombre ~* '^adorno'         THEN 'Adorno'
    WHEN p_nombre ~* '^pin boton'      THEN 'Pin boton'
    WHEN p_nombre ~* '^bandera sublimable' THEN 'Bandera sublimable'
    WHEN p_nombre ~* '^caja sublimable' THEN 'Caja sublimable'
    WHEN p_nombre ~* '^llavero sublimable' THEN 'Llavero sublimable'
    WHEN p_nombre ~* '^bombilla acero' THEN 'Bombilla acero'
    WHEN p_nombre ~* '^porta espejo'   THEN 'Porta espejo'
    WHEN p_nombre ~* '^porta retrato'  THEN 'Porta retrato'
    WHEN p_nombre ~* '^carpeta a4'     THEN 'Carpeta a4'
    WHEN p_nombre ~* '^acordeon a4'    THEN 'Acordeon a4'
    WHEN p_nombre ~* '^cartera sublimable' THEN 'Cartera sublimable'
    WHEN p_nombre ~* '^funda sublimable' THEN 'Funda sublimable'
    WHEN p_nombre ~* '^cinta sublimable' THEN 'Cinta sublimable'
    WHEN p_nombre ~* '^imAN sublimable' THEN 'Iman sublimable'
    WHEN p_nombre ~* '^tablero sublimable' THEN 'Tablero sublimable'
    WHEN p_nombre ~* '^remera sublimable' THEN 'Remera sublimable'
    WHEN p_nombre ~* '^saco sublimable' THEN 'Saco sublimable'
    WHEN p_nombre ~* '^bermuda sublimable' THEN 'Bermuda sublimable'
    WHEN p_nombre ~* '^pollera sublimable' THEN 'Pollera sublimable'
    WHEN p_nombre ~* '^jacket sublimable' THEN 'Jacket sublimable'
    WHEN p_nombre ~* '^campera sublimable' THEN 'Campera sublimable'
    WHEN p_nombre ~* '^whisky sublimable' THEN 'Whisky sublimable'
    ELSE split_part(p_nombre, ' ', 1)
  END;
$$;

-- RPC: Catálogo agrupado por familia (UNO por familia)
-- Devuelve: familia, cantidad de variantes, imagen representativa, precio base
CREATE OR REPLACE FUNCTION public.catalogo_agrupado(
  p_busqueda text DEFAULT NULL,
  p_categoria_id bigint DEFAULT NULL,
  p_limite integer DEFAULT 100
)
RETURNS TABLE (
  familia text,
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
      familia_producto(pr.nombre) AS fam,
      pr.imagen_principal,
      pr.precio,
      pr.id,
      pr.categoria_id,
      pr.nombre
    FROM public.productos pr
    WHERE pr.activo
      AND pr.imagen_principal IS NOT NULL
      AND (p_busqueda IS NULL OR pr.nombre ILIKE '%' || p_busqueda || '%')
      AND (p_categoria_id IS NULL OR pr.categoria_id = p_categoria_id)
  ),
  agrupado AS (
    SELECT
      fam,
      COUNT(*) AS variantes,
      MAX(imagen_principal) AS imagen_principal,
      MIN(precio) AS precio_desde,
      MAX(precio) AS precio_hasta,
      (ARRAY_AGG(id ORDER BY id))[1] AS producto_ejemplo_id,
      (ARRAY_AGG(categoria_id ORDER BY id))[1] AS categoria_id
    FROM base
    GROUP BY fam
  )
  SELECT
    a.fam,
    a.variantes,
    a.imagen_principal,
    a.precio_desde,
    a.precio_hasta,
    a.producto_ejemplo_id,
    a.categoria_id
  FROM agrupado a
  ORDER BY variantes DESC, a.fam
  LIMIT GREATEST(1, LEAST(p_limite, 300));
$$;

-- RPC: Todas las variaciones de una familia específica
CREATE OR REPLACE FUNCTION public.variaciones_familia(
  p_familia text,
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
    AND familia_producto(pr.nombre) = p_familia
    AND (p_categoria_id IS NULL OR pr.categoria_id = p_categoria_id)
  ORDER BY pr.precio ASC, pr.nombre;
$$;

-- Habilitar RLS (las funciones son SECURITY DEFINER por defecto, pero por si acaso)
ALTER FUNCTION public.catalogo_agrupado SECURITY DEFINER;
ALTER FUNCTION public.variaciones_familia SECURITY DEFINER;
