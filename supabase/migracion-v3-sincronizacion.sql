-- Migración v3: sincronización con proveedor (Disershop)
-- Agrega control de stock y origen del proveedor a productos.

alter table public.productos
  add column if not exists stock integer,
  add column if not exists stock_actualizado_at timestamp with time zone,
  add column if not exists proveedor_url text,
  add column if not exists proveedor_nombre text;