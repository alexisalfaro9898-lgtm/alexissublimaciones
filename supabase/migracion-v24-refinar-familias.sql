-- Migración v24: Refinar el agrupamiento por familia
-- Corrige: Inscripcion/Inscripción, Tabla/TABLA, Neceser/Necessaire,
-- Jarra/Jarro, Imán case-insensitive, Lapicera/Lapicero (quedan juntos)

CREATE OR REPLACE FUNCTION public.familia_producto(p_nombre text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  WITH normalizado AS (
    SELECT lower(btrim(p_nombre)) AS n
  ),
  base AS (
    SELECT CASE
      -- fusiones por concepto
      WHEN n ~* '^inscripc'           THEN 'Inscripciones'
      WHEN n ~* '^tabla'              THEN 'Tabla'
      WHEN n ~* '^jarra|^jarro'       THEN 'Jarra'
      WHEN n ~* '^necessaire|^neceser' THEN 'Neceser'
      WHEN n ~* '^lapicera|^lapicero' THEN 'Lapicera'
      WHEN n ~* '^im[áa]n'            THEN 'Imán'
      -- familias textiles principales
      WHEN n ~* '^canguro'            THEN 'Canguro'
      WHEN n ~* '^buzo'               THEN 'Buzo'
      WHEN n ~* '^camiseta'           THEN 'Camiseta'
      WHEN n ~* '^body'               THEN 'Body'
      WHEN n ~* '^gorro'              THEN 'Gorro'
      WHEN n ~* '^toalla'             THEN 'Toalla'
      WHEN n ~* '^mochila'            THEN 'Mochila'
      WHEN n ~* '^musculosa'          THEN 'Musculosa'
      WHEN n ~* '^delantal'           THEN 'Delantal'
      WHEN n ~* '^lunchera'           THEN 'Lunchera'
      WHEN n ~* '^top'                THEN 'Top'
      WHEN n ~* '^remera'             THEN 'Remera'
      WHEN n ~* '^sudadera'           THEN 'Sudadera'
      WHEN n ~* '^bolsa'              THEN 'Bolsa'
      WHEN n ~* '^bolso'              THEN 'Bolso'
      WHEN n ~* '^pollera'            THEN 'Pollera'
      WHEN n ~* '^bermuda'            THEN 'Bermuda'
      -- bebibles / vajilla
      WHEN n ~* '^botella'            THEN 'Botella'
      WHEN n ~* '^vaso'               THEN 'Vaso'
      WHEN n ~* '^termin'             THEN 'Termo'
      WHEN n ~* '^taza'               THEN 'Taza'
      WHEN n ~* '^mate'               THEN 'Mate'
      WHEN n ~* '^frasco'             THEN 'Frasco'
      WHEN n ~* '^cantimplora'        THEN 'Cantimplora'
      WHEN n ~* '^posavaso'           THEN 'Posavaso'
      WHEN n ~* '^destapador'         THEN 'Destapador'
      -- escritorio / oficina
      WHEN n ~* '^lapicera|^lapicero' THEN 'Lapicera'
      WHEN n ~* '^agenda'             THEN 'Agenda'
      WHEN n ~* '^block'              THEN 'Block'
      WHEN n ~* '^cuaderno'           THEN 'Cuaderno'
      WHEN n ~* '^libreta'            THEN 'Libreta'
      WHEN n ~* '^cartuchera'         THEN 'Cartuchera'
      WHEN n ~* '^carpeta'            THEN 'Carpeta'
      WHEN n ~* '^cuadro'             THEN 'Cuadro'
      WHEN n ~* '^marcador'           THEN 'Marcador'
      -- hogar / decoración
      WHEN n ~* '^azulejo'            THEN 'Azulejo'
      WHEN n ~* '^chapa'              THEN 'Chapa'
      WHEN n ~* '^placa'              THEN 'Placa'
      WHEN n ~* '^adorno'             THEN 'Adorno'
      WHEN n ~* '^bandera'            THEN 'Bandera'
      WHEN n ~* '^caja'               THEN 'Caja'
      WHEN n ~* '^molde'              THEN 'Molde'
      WHEN n ~* '^tablero'            THEN 'Tablero'
      WHEN n ~* '^mosqu'              THEN 'Mosquetón'
      WHEN n ~* '^tateti'             THEN 'Tateti'
      WHEN n ~* '^puzzle'             THEN 'Puzzle'
      WHEN n ~* '^memo'               THEN 'Memo'
      WHEN n ~* '^reloj'              THEN 'Reloj'
      WHEN n ~* '^trofeo'             THEN 'Trofeo'
      WHEN n ~* '^medalla'            THEN 'Medalla'
      WHEN n ~* '^plato'              THEN 'Plato'
      WHEN n ~* '^porta'              THEN 'Porta'
      WHEN n ~* '^soporte'            THEN 'Soporte'
      WHEN n ~* '^mo[nñ]a'            THEN 'Moña'
      WHEN n ~* '^kit'                THEN 'Kit'
      WHEN n ~* '^set'                THEN 'Set'
      WHEN n ~* '^pack'               THEN 'Pack'
      WHEN n ~* '^pie'                THEN 'Pie'
      WHEN n ~* '^mini'               THEN 'Mini'
      -- accesorios / otros
      WHEN n ~* '^pin'                THEN 'Pin'
      WHEN n ~* '^llavero'            THEN 'Llavero'
      WHEN n ~* '^bombilla'           THEN 'Bombilla'
      WHEN n ~* '^funda'              THEN 'Funda'
      WHEN n ~* '^sobre'              THEN 'Sobre'
      WHEN n ~* '^caramañola'         THEN 'Caramañola'
      WHEN n ~* '^ri[nñ]onera'        THEN 'Riñonera'
      WHEN n ~* '^prendedor'          THEN 'Prendedor'
      WHEN n ~* '^cartera'            THEN 'Cartera'
      WHEN n ~* '^cinta'              THEN 'Cinta'
      WHEN n ~* '^mouse'              THEN 'Mouse'
      WHEN n ~* '^neceser|^necessaire' THEN 'Neceser'
      WHEN n ~* '^mochila'            THEN 'Mochila'
      WHEN n ~* '^base'               THEN 'Base'
      WHEN n ~* '^suduv'              THEN 'Sudadera'
      WHEN n ~* '^barbijo'            THEN 'Barbijo'
      -- fallback: primera palabra con primera letra en mayúscula
      ELSE
        upper(substring(split_part(n, ' ', 1) FROM 1 FOR 1)) ||
        substring(split_part(n, ' ', 1) FROM 2)
    END AS fam
    FROM normalizado
  )
  SELECT fam FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.familia_producto(text) TO anon, authenticated;
