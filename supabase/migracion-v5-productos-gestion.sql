-- ============================================================
-- SISTEMA DE PEDIDOS — MIGRACIÓN v5: GESTIÓN DE PRODUCTOS
-- Fecha: 2026-08-16
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotente: puede volver a ejecutarse sin romper nada.
--
-- Cambios:
--   1) El catálogo público (anon/cliente) solo puede LEER
--      productos ACTIVOS. El personal (es_personal) ve todo
--      (activos e inactivos) para administrar.
--   2) INSERT / UPDATE / DELETE de productos siguen siendo
--      EXCLUSIVOS del personal (es_personal). No se otorga
--      ningún permiso de escritura a anon ni a clientes.
-- ============================================================

drop policy if exists productos_select_publico on public.productos;

create policy productos_select_publico on public.productos
  for select using (
    activo = true or public.es_personal()
  );

-- ============================================================
-- VERIFICACIÓN: las políticas de escritura de productos
-- deben seguir siendo solo para personal (no se tocan).
-- Esta consulta debe mostrar, para la tabla productos:
--   select_publico   -> using (activo = true or es_personal())
--   insert_personal  -> to authenticated, with check es_personal()
--   update_personal  -> to authenticated, es_personal()
--   delete_personal  -> to authenticated, es_personal()
-- ============================================================

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'productos'
order by policyname;