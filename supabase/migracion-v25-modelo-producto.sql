-- Migración v25: Campo 'modelo' para agrupar variantes del mismo producto
-- El modelo se extrae del codigo_interno:
--   SU-MG-NEO-04   → modelo: SU-MG-NEO   (guion antes del número final)
--   SU-AZ01        → modelo: SU-AZ        (letras pegadas al número)
--   203000102      → modelo: 2030001     (solo números, quitar últimos 2)
--   SU-AGENDA      → modelo: SU-AGENDA   (sin número = modelo único)

ALTER TABLE productos ADD COLUMN IF NOT EXISTS modelo text;

-- Poblar modelo desde codigo_interno
UPDATE productos
SET modelo = CASE
  -- 1) XX-MODEL-NN: guion antes del número final
  WHEN codigo_interno ~ '^.+-[0-9]+$' THEN
    substring(codigo_interno from '^(.+)-[0-9]+$')
  -- 2) XX-ABC123: letras pegadas al número (SU-AZ01, CI-DRY100)
  WHEN codigo_interno ~ '^[A-Z]+-[A-Z]+[0-9]+$' THEN
    regexp_replace(codigo_interno, '[0-9]+$', '')
  -- 3) Solo números (203000102): quitar últimos 2 dígitos
  WHEN codigo_interno ~ '^[0-9]+$' THEN
    CASE
      WHEN length(codigo_interno) >= 9 THEN substring(codigo_interno from 1 for length(codigo_interno)-2)
      WHEN length(codigo_interno) = 8 THEN substring(codigo_interno from 1 for 6)
      WHEN length(codigo_interno) = 7 THEN substring(codigo_interno from 1 for 5)
      WHEN length(codigo_interno) = 6 THEN substring(codigo_interno from 1 for 4)
      WHEN length(codigo_interno) = 5 THEN substring(codigo_interno from 1 for 3)
      ELSE codigo_interno
    END
  -- 4) Otro patrón con guiones: strip último segmento
  WHEN codigo_interno ~ '^.+-[A-Za-z0-9]+$' THEN
    substring(codigo_interno from '^(.+)-[A-Za-z0-9]+$')
  -- 5) Sin número: es modelo único, usar código completo
  ELSE codigo_interno
END
WHERE codigo_interno IS NOT NULL;

-- Para productos sin codigo_interno, usar nombre como modelo (fallback)
UPDATE productos
SET modelo = lower(nombre)
WHERE codigo_interno IS NULL AND modelo IS NULL;

-- Índice para búsquedas rápidas por modelo
CREATE INDEX IF NOT EXISTS idx_productos_modelo ON productos(modelo) WHERE activo;
