-- ============================================================
-- SISTEMA DE PEDIDOS — MIGRACIÓN v2: SEGURIDAD + MODELO DEFINITIVO
-- Fecha: 2026-08-15
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotente: puede volver a ejecutarse sin romper nada.
-- NO elimina tablas, ni columnas, ni datos de pedidos.
-- Solo corrige constraints, elimina un trigger legacy,
-- repunta una FK y agrega políticas RLS.
--
-- Diseño de permisos:
--   CLIENTE  = usuario autenticado con fila en clientes
--              (solo ve/crea sus propios pedidos)
--   PERSONAL = usuario autenticado con fila en usuarios.activo=true
--              (ve y gestiona todo; la app trata igual a todos los
--              roles 1..4 de la tabla roles)
--   anónimo  = solo lectura del catálogo público
-- ============================================================

-- ============================================================
-- 1) FUNCIÓN AUXILIAR: ¿el usuario es personal?
--    SECURITY DEFINER: ejecuta como postgres y EVITA la recursión
--    infinita de RLS cuando las políticas consultan usuarios.
--    auth.uid() va calificada (auth.uid()) para no depender del
--    search_path. search_path fijo = public (seguridad).
-- ============================================================

create or replace function public.es_personal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.activo = true
  )
$$;

grant execute on function public.es_personal() to anon, authenticated;

-- ============================================================
-- 2) ESTADOS DEFINITIVOS
--    estados_pedido tiene 8 filas (Nuevo→Cancelado). La app deriva
--    el slug con slugificar(): nuevo, revisar, diseno, aprobacion,
--    produccion, listo, entregado, cancelado.
--    El CHECK actual permitía un conjunto distinto
--    (nuevo, en_revision, aprobado, ...) que rechazaba 'revisar',
--    'diseno' y 'aprobacion' usados por la aplicación.
-- ============================================================

alter table public.pedidos drop constraint if exists pedidos_estado_check;

alter table public.pedidos add constraint pedidos_estado_check
  check (estado in (
    'nuevo',
    'revisar',
    'diseno',
    'aprobacion',
    'produccion',
    'listo',
    'entregado',
    'cancelado'
  ));

-- ============================================================
-- 3) MODELO DEFINITIVO: pedido_detalles (NO pedido_items)
--    La aplicación escribe pedido_detalles (y nunca pedido_items).
--    pedido_respuestas.pedido_item_id apuntaba a la tabla legacy
--    pedido_items, por lo que toda respuesta fallaba por FK.
--    Se repunta la FK a pedido_detalles.
--
--    Limpieza previa REQUERIDA: pedido_respuestas.id=1 es data de
--    seed huérfana (su pedido_id=1 fue eliminado; referencia
--    pedido_items.id=1) e incompatible con pedido_detalles
--    (no existe el detalle id=1). Se elimina esa única fila.
-- ============================================================

delete from public.pedido_respuestas
where pedido_item_id not in (select id from public.pedido_detalles);

alter table public.pedido_respuestas
  drop constraint if exists pedido_respuestas_pedido_item_id_fkey;

alter table public.pedido_respuestas
  add constraint pedido_respuestas_pedido_item_id_fkey
  foreign key (pedido_item_id) references public.pedido_detalles (id);

-- ============================================================
-- 4) TRIGGER LEGACY EN pedidos (UPDATE)
--    Un trigger escribía en pedido_historial (tabla vieja) en cada
--    cambio de estado; ese INSERT fallaba por RLS y rompía TODO
--    cambio de estado del panel admin. La aplicación ya registra el
--    historial en historial_pedidos (modelo oficial), por lo que el
--    trigger sobra.
--    Se eliminan SOLO los triggers cuyo código referencia
--    pedido_historial (verificado empíricamente). La tabla
--    pedido_historial y sus datos se conservan intactos.
-- ============================================================

do $$
declare
  t record;
begin
  for t in
    select oid, tgname, tgfoid
    from pg_trigger
    where tgrelid = 'public.pedidos'::regclass
      and not tgisinternal
  loop
    if pg_get_triggerdef(t.oid) ilike '%pedido_historial%'
       or pg_get_functiondef(t.tgfoid) ilike '%pedido_historial%'
    then
      execute format('drop trigger %I on public.pedidos', t.tgname);
    end if;
  end loop;
end $$;

-- ============================================================
-- 5) HABILITAR RLS EN TODAS LAS TABLAS DE LA APP
--    (idempotente: las ya habilitadas no cambian)
-- ============================================================

alter table public.pedidos enable row level security;
alter table public.pedido_detalles enable row level security;
alter table public.pedido_personalizaciones enable row level security;
alter table public.pedido_respuestas enable row level security;
alter table public.pedido_archivos enable row level security;
alter table public.historial_pedidos enable row level security;
alter table public.estados_pedido enable row level security;
alter table public.clientes enable row level security;
alter table public.usuarios enable row level security;
alter table public.roles enable row level security;
alter table public.productos enable row level security;
alter table public.categorias enable row level security;
alter table public.producto_variantes enable row level security;
alter table public.producto_personalizaciones enable row level security;
alter table public.tipos_personalizacion enable row level security;
alter table public.preguntas enable row level security;
alter table public.producto_preguntas enable row level security;
alter table public.pregunta_opciones enable row level security;
alter table public.precios_productos enable row level security;
alter table public.producto_proveedores enable row level security;
alter table public.proveedores enable row level security;
alter table public.configuracion enable row level security;
alter table public.proveedor_historial enable row level security;
alter table public.proveedor_filtros enable row level security;
alter table public.proveedor_sincronizaciones enable row level security;
alter table public.pedido_items enable row level security;
alter table public.pedido_historial enable row level security;
alter table public.pedido_respuesta_archivos enable row level security;
alter table public.disenos enable row level security;
alter table public.aprobaciones enable row level security;
alter table public.pedido_revisiones enable row level security;
alter table public.diseno_versiones enable row level security;

-- Vista: en PostgreSQL no existen políticas RLS sobre vistas.
-- security_invoker=true hace que la RLS de las tablas subyacentes
-- (pedidos, pedido_detalles) se aplique al usuario que consulta,
-- que es exactamente el comportamiento deseado.
alter view public.vista_pedidos set (security_invoker = true);

-- ============================================================
-- 6) LIMPIEZA DE POLÍTICAS PREVIAS
--    Elimina cualquier política existente (incluidas las
--    permisivas creadas a mano) de las tablas reconstruidas abajo.
--    Así queda garantizado que el único control es el de esta
--    migración. (Las políticas de storage.objects no se tocan.)
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'pedidos', 'pedido_detalles', 'pedido_personalizaciones',
        'pedido_respuestas', 'pedido_archivos', 'historial_pedidos',
        'estados_pedido', 'clientes', 'usuarios', 'roles',
        'productos', 'categorias', 'producto_variantes',
        'producto_personalizaciones', 'tipos_personalizacion',
        'preguntas', 'producto_preguntas', 'pregunta_opciones',
        'precios_productos', 'producto_proveedores', 'proveedores',
        'configuracion', 'proveedor_historial', 'proveedor_filtros',
        'proveedor_sincronizaciones', 'pedido_items',
        'pedido_historial', 'pedido_respuesta_archivos', 'disenos',
        'aprobaciones', 'pedido_revisiones', 'diseno_versiones'
      )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ============================================================
-- 7) POLÍTICAS — CADENA DE PEDIDOS
--    CLIENTE: solo sus propios pedidos (su clientes.email coincide
--    con pedidos.cliente_email, comparación insensible a mayúsculas).
--    PERSONAL: todo.
--    "cliente_email" puede ser NULL (pedidos cargados por el local):
--    ningún cliente puede verlos, solo el personal.
-- ============================================================

-- ---------- pedidos ----------

create policy pedidos_select_own_personal on public.pedidos
  for select to authenticated
  using (
    public.es_personal()
    or exists (
      select 1 from public.clientes c
      where c.auth_user_id = auth.uid()
        and lower(c.email) = lower(pedidos.cliente_email)
    )
  );

create policy pedidos_insert_own_personal on public.pedidos
  for insert to authenticated
  with check (
    public.es_personal()
    or exists (
      select 1 from public.clientes c
      where c.auth_user_id = auth.uid()
        and lower(c.email) = lower(cliente_email)
    )
  );

create policy pedidos_update_personal on public.pedidos
  for update to authenticated
  using (public.es_personal())
  with check (public.es_personal());

create policy pedidos_delete_own_personal on public.pedidos
  for delete to authenticated
  using (
    public.es_personal()
    or exists (
      select 1 from public.clientes c
      where c.auth_user_id = auth.uid()
        and lower(c.email) = lower(pedidos.cliente_email)
    )
  );

-- ---------- pedido_detalles ----------

create policy detalles_select_own_personal on public.pedido_detalles
  for select to authenticated
  using (
    public.es_personal()
    or exists (
      select 1 from public.pedidos p
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where p.id = pedido_detalles.pedido_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy detalles_insert_own_personal on public.pedido_detalles
  for insert to authenticated
  with check (
    public.es_personal()
    or exists (
      select 1 from public.pedidos p
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where p.id = pedido_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy detalles_update_personal on public.pedido_detalles
  for update to authenticated
  using (public.es_personal())
  with check (public.es_personal());

create policy detalles_delete_personal on public.pedido_detalles
  for delete to authenticated
  using (public.es_personal());

-- ---------- pedido_personalizaciones ----------

create policy pers_select_own_personal on public.pedido_personalizaciones
  for select to authenticated
  using (
    public.es_personal()
    or exists (
      select 1 from public.pedido_detalles d
      join public.pedidos p on p.id = d.pedido_id
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where d.id = pedido_personalizaciones.pedido_detalle_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy pers_insert_own_personal on public.pedido_personalizaciones
  for insert to authenticated
  with check (
    public.es_personal()
    or exists (
      select 1 from public.pedido_detalles d
      join public.pedidos p on p.id = d.pedido_id
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where d.id = pedido_detalle_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy pers_update_personal on public.pedido_personalizaciones
  for update to authenticated
  using (public.es_personal())
  with check (public.es_personal());

create policy pers_delete_personal on public.pedido_personalizaciones
  for delete to authenticated
  using (public.es_personal());

-- ---------- pedido_respuestas ----------

create policy respuestas_select_own_personal on public.pedido_respuestas
  for select to authenticated
  using (
    public.es_personal()
    or exists (
      select 1 from public.pedido_detalles d
      join public.pedidos p on p.id = d.pedido_id
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where d.id = pedido_respuestas.pedido_item_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy respuestas_insert_own_personal on public.pedido_respuestas
  for insert to authenticated
  with check (
    public.es_personal()
    or exists (
      select 1 from public.pedido_detalles d
      join public.pedidos p on p.id = d.pedido_id
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where d.id = pedido_item_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy respuestas_update_personal on public.pedido_respuestas
  for update to authenticated
  using (public.es_personal())
  with check (public.es_personal());

create policy respuestas_delete_personal on public.pedido_respuestas
  for delete to authenticated
  using (public.es_personal());

-- ---------- pedido_archivos ----------

create policy archivos_select_own_personal on public.pedido_archivos
  for select to authenticated
  using (
    public.es_personal()
    or exists (
      select 1 from public.pedidos p
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where p.id = pedido_archivos.pedido_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy archivos_insert_own_personal on public.pedido_archivos
  for insert to authenticated
  with check (
    public.es_personal()
    or exists (
      select 1 from public.pedidos p
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where p.id = pedido_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy archivos_update_personal on public.pedido_archivos
  for update to authenticated
  using (public.es_personal())
  with check (public.es_personal());

create policy archivos_delete_personal on public.pedido_archivos
  for delete to authenticated
  using (public.es_personal());

-- ---------- historial_pedidos ----------

create policy historial_select_own_personal on public.historial_pedidos
  for select to authenticated
  using (
    public.es_personal()
    or exists (
      select 1 from public.pedidos p
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where p.id = historial_pedidos.pedido_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy historial_insert_own_personal on public.historial_pedidos
  for insert to authenticated
  with check (
    public.es_personal()
    or exists (
      select 1 from public.pedidos p
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where p.id = pedido_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy historial_update_personal on public.historial_pedidos
  for update to authenticated
  using (public.es_personal())
  with check (public.es_personal());

create policy historial_delete_personal on public.historial_pedidos
  for delete to authenticated
  using (public.es_personal());

-- ============================================================
-- 8) POLÍTICAS — IDENTIDAD
--    clientes: el cliente ve/edita su propia fila; el personal todo.
--    usuarios: el cliente solo consulta su propia fila (el flujo de
--    login la consulta para saber si es staff); el personal todo.
-- ============================================================

create policy clientes_select_own_personal on public.clientes
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.es_personal()
  );

create policy clientes_insert_own_personal on public.clientes
  for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    or public.es_personal()
  );

create policy clientes_update_own_personal on public.clientes
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or public.es_personal()
  )
  with check (
    auth_user_id = auth.uid()
    or public.es_personal()
  );

create policy clientes_delete_personal on public.clientes
  for delete to authenticated
  using (public.es_personal());

create policy usuarios_select_own_personal on public.usuarios
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.es_personal()
  );

create policy usuarios_insert_personal on public.usuarios
  for insert to authenticated
  with check (public.es_personal());

create policy usuarios_update_personal on public.usuarios
  for update to authenticated
  using (public.es_personal())
  with check (public.es_personal());

create policy usuarios_delete_personal on public.usuarios
  for delete to authenticated
  using (public.es_personal());

-- ============================================================
-- 9) POLÍTICAS — CATÁLOGOS PÚBLICOS
--    Lectura para todos (anon incluido): son los datos que ve el
--    cliente en el catálogo. Escritura solo personal.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'estados_pedido', 'roles', 'categorias', 'productos',
    'producto_variantes', 'preguntas', 'producto_preguntas',
    'pregunta_opciones', 'tipos_personalizacion',
    'producto_personalizaciones'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select using (true)',
      t || '_select_publico', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.es_personal())',
      t || '_insert_personal', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.es_personal()) with check (public.es_personal())',
      t || '_update_personal', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.es_personal())',
      t || '_delete_personal', t
    );
  end loop;
end $$;

-- ============================================================
-- 10) POLÍTICAS — TABLAS INTERNAS / LEGACY
--     Solo personal. Cubren datos de costos/proveedores (sensibles),
--     configuración y las tablas legacy no usadas por la app
--     (pedido_items, pedido_historial, disenos, aprobaciones, ...):
--     quedan bloqueadas para anon/clientes y disponibles para staff.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'precios_productos', 'producto_proveedores', 'proveedores',
    'configuracion', 'proveedor_historial', 'proveedor_filtros',
    'proveedor_sincronizaciones', 'pedido_items', 'pedido_historial',
    'pedido_respuesta_archivos', 'disenos', 'aprobaciones',
    'pedido_revisiones', 'diseno_versiones'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.es_personal())',
      t || '_select_personal', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.es_personal())',
      t || '_insert_personal', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.es_personal()) with check (public.es_personal())',
      t || '_update_personal', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.es_personal())',
      t || '_delete_personal', t
    );
  end loop;
end $$;

-- ============================================================
-- 11) STORAGE — bucket pedido-archivos (privado)
--     Las rutas subidas por la app tienen el formato:
--       pedidos/<id_pedido>/detalle-<id>/<timestamp>-<nombre>
--     La política extrae el id del pedido de la ruta y verifica
--     que pertenezca al cliente autenticado (o que sea personal).
--
--     INSERT: el cliente sube archivos solo de sus pedidos.
--     SELECT: el cliente (y el personal) pueden generar signed URLs
--             de sus archivos (createSignedUrl).
--     DELETE: el cliente puede borrar archivos de sus pedidos
--             (usado por el rollback de crearPedido); personal todo.
--
--     Limpieza: se elimina la política legacy "Permitir subir
--     archivos de pedidos" (era solo un check de bucket, sin
--     verificación de pertenencia) y se recrean las nuevas de
--     forma idempotente.
-- ============================================================

drop policy if exists "Permitir subir archivos de pedidos" on storage.objects;
drop policy if exists archivos_storage_insert_own on storage.objects;
drop policy if exists archivos_storage_select_own_personal on storage.objects;
drop policy if exists archivos_storage_delete_own_personal on storage.objects;

create policy archivos_storage_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pedido-archivos'
    and exists (
      select 1
      from public.pedidos p
      join public.clientes c on lower(c.email) = lower(p.cliente_email)
      where c.auth_user_id = auth.uid()
        and p.id = (
          select (regexp_match(name, '^pedidos/([0-9]+)/'))[1]::bigint
        )
    )
  );

create policy archivos_storage_select_own_personal on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pedido-archivos'
    and (
      public.es_personal()
      or exists (
        select 1
        from public.pedidos p
        join public.clientes c on lower(c.email) = lower(p.cliente_email)
        where c.auth_user_id = auth.uid()
          and p.id = (
            select (regexp_match(name, '^pedidos/([0-9]+)/'))[1]::bigint
          )
      )
    )
  );

create policy archivos_storage_delete_own_personal on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pedido-archivos'
    and (
      public.es_personal()
      or exists (
        select 1
        from public.pedidos p
        join public.clientes c on lower(c.email) = lower(p.cliente_email)
        where c.auth_user_id = auth.uid()
          and p.id = (
            select (regexp_match(name, '^pedidos/([0-9]+)/'))[1]::bigint
          )
      )
    )
  );

-- ============================================================
-- 12) VERIFICACIÓN (debe devolver solo filas de esta migración)
-- ============================================================

select schemaname, tablename, policyname
from pg_policies
order by tablename, policyname;
