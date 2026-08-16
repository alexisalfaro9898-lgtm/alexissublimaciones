-- ============================================================
-- MIGRACIÓN v7: Acceso al Dashboard solo Administrador
-- ------------------------------------------------------------
-- 1. Función es_admin(): usuario interno activo con rol_id = 1
-- 2. Guardia es_admin() en las 3 funciones RPC del dashboard
--    (se dropean los overloads date duplicados y se recrean
--     las versiones timestamptz originales con la nueva guardia)
-- 3. RLS de compras/compra_items restringida a administradores
-- ============================================================

-- ---------- 1. es_admin() ----------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.activo = true
      and u.rol_id = 1
  )
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

-- ---------- 2. Limpieza de overloads date duplicados ----------

drop function if exists public.dashboard_resumen(date, date, bigint, bigint, text, text);
drop function if exists public.dashboard_evolucion(date, date, text, bigint, bigint, text, text);
drop function if exists public.dashboard_top(text, date, date, integer, bigint, bigint, text, text);

-- ---------- 3. RPC del dashboard (versión timestamptz) con guardia es_admin() ----------

create or replace function public.dashboard_resumen(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_categoria_id bigint default null,
  p_producto_id bigint default null,
  p_cliente text default null,
  p_estado text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_resultado jsonb;
  v_anterior_desde timestamptz;
  v_anterior_hasta timestamptz;
begin
  if not es_admin() then
    raise exception 'Acceso restringido al administrador';
  end if;

  v_anterior_hasta := p_desde - interval '1 second';
  v_anterior_desde := v_anterior_hasta - (p_hasta - p_desde);

  select jsonb_build_object(
    'actual', (
      select jsonb_build_object(
        'facturacion', coalesce(sum(v.subtotal), 0),
        'costo', coalesce(sum(v.costo_unitario * v.cantidad), 0),
        'ganancia', coalesce(sum(v.ganancia), 0),
        'pedidos', count(distinct v.pedido_id),
        'unidades', coalesce(sum(v.cantidad), 0),
        'facturacion_sin_costo', coalesce(sum(v.subtotal) filter (where v.costo_unitario is null), 0),
        'items_con_costo', count(*) filter (where v.costo_unitario is not null),
        'items_total', count(*)
      )
      from vista_dashboard_ventas v
      where v.clasificacion = 'completado'
        and v.creado_en >= p_desde and v.creado_en < p_hasta
        and (p_categoria_id is null or v.categoria_id = p_categoria_id)
        and (p_producto_id is null or v.producto_id = p_producto_id)
        and (p_cliente is null or v.cliente_nombre ilike '%' || p_cliente || '%' or v.cliente_email ilike '%' || p_cliente || '%')
        and (p_estado is null or v.estado = p_estado)
    ),
    'anterior', (
      select jsonb_build_object(
        'facturacion', coalesce(sum(v.subtotal), 0),
        'ganancia', coalesce(sum(v.ganancia), 0),
        'pedidos', count(distinct v.pedido_id),
        'unidades', coalesce(sum(v.cantidad), 0)
      )
      from vista_dashboard_ventas v
      where v.clasificacion = 'completado'
        and v.creado_en >= v_anterior_desde and v.creado_en < v_anterior_hasta
        and (p_categoria_id is null or v.categoria_id = p_categoria_id)
        and (p_producto_id is null or v.producto_id = p_producto_id)
        and (p_cliente is null or v.cliente_nombre ilike '%' || p_cliente || '%' or v.cliente_email ilike '%' || p_cliente || '%')
        and (p_estado is null or v.estado = p_estado)
    ),
    'pendientes', (
      select jsonb_build_object(
        'pedidos', count(distinct v.pedido_id),
        'facturacion', coalesce(sum(v.subtotal), 0)
      )
      from vista_dashboard_ventas v
      where v.clasificacion = 'pendiente'
        and v.creado_en >= p_desde and v.creado_en < p_hasta
        and (p_categoria_id is null or v.categoria_id = p_categoria_id)
        and (p_producto_id is null or v.producto_id = p_producto_id)
    ),
    'cancelados', (
      select count(distinct v.pedido_id)
      from vista_dashboard_ventas v
      where v.clasificacion = 'cancelado'
        and v.creado_en >= p_desde and v.creado_en < p_hasta
        and (p_categoria_id is null or v.categoria_id = p_categoria_id)
        and (p_producto_id is null or v.producto_id = p_producto_id)
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.dashboard_resumen(timestamptz, timestamptz, bigint, bigint, text, text) from public;
grant execute on function public.dashboard_resumen(timestamptz, timestamptz, bigint, bigint, text, text) to authenticated;

create or replace function public.dashboard_evolucion(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_agrupacion text default 'dia',
  p_categoria_id bigint default null,
  p_producto_id bigint default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_resultado jsonb;
  v_formato text;
begin
  if not es_admin() then
    raise exception 'Acceso restringido al administrador';
  end if;

  v_formato := case p_agrupacion
    when 'semana' then 'IYYY-IW'
    when 'mes' then 'YYYY-MM'
    else 'YYYY-MM-DD'
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'periodo', to_char(serie, v_formato),
    'fecha', serie,
    'facturacion', coalesce(d.facturacion, 0),
    'costo', coalesce(d.costo, 0),
    'ganancia', coalesce(d.ganancia, 0),
    'pedidos', coalesce(d.pedidos, 0)
  ) order by serie), '[]'::jsonb)
  into v_resultado
  from (
    select generate_series(
      date_trunc('day', p_desde),
      date_trunc('day', p_hasta) - interval '1 day',
      case p_agrupacion
        when 'semana' then interval '1 week'
        when 'mes' then interval '1 month'
        else interval '1 day'
      end
    ) as serie
  ) s
  left join (
    select
      case p_agrupacion
        when 'semana' then date_trunc('week', v.creado_en)
        when 'mes' then date_trunc('month', v.creado_en)
        else date_trunc('day', v.creado_en)
      end as periodo_ts,
      sum(v.subtotal) as facturacion,
      sum(v.costo_unitario * v.cantidad) as costo,
      sum(v.ganancia) as ganancia,
      count(distinct v.pedido_id) as pedidos
    from vista_dashboard_ventas v
    where v.clasificacion = 'completado'
      and v.creado_en >= p_desde and v.creado_en < p_hasta
      and (p_categoria_id is null or v.categoria_id = p_categoria_id)
      and (p_producto_id is null or v.producto_id = p_producto_id)
    group by 1
  ) d on d.periodo_ts = s.serie;

  return v_resultado;
end;
$$;

revoke all on function public.dashboard_evolucion(timestamptz, timestamptz, text, bigint, bigint) from public;
grant execute on function public.dashboard_evolucion(timestamptz, timestamptz, text, bigint, bigint) to authenticated;

create or replace function public.dashboard_top(
  p_tipo text,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_limite integer default 20,
  p_categoria_id bigint default null,
  p_producto_id bigint default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if not es_admin() then
    raise exception 'Acceso restringido al administrador';
  end if;

  if p_tipo = 'productos' then

    select coalesce(jsonb_agg(jsonb_build_object(
      'producto_id', t.producto_id,
      'nombre', t.nombre,
      'nombre_comercial', t.nombre_comercial,
      'unidades', t.unidades,
      'facturacion', t.facturacion,
      'costo', t.costo,
      'ganancia', t.ganancia,
      'margen', case when t.facturacion > 0
        then round(t.ganancia / t.facturacion * 100, 1) else null end,
      'pedidos', t.pedidos,
      'items_sin_costo', t.items_sin_costo
    ) order by t.ganancia desc nulls last, t.facturacion desc), '[]'::jsonb)
    into v_resultado
    from (
      select
        v.producto_id,
        coalesce(max(v.nombre_comercial), max(v.producto_nombre)) as nombre,
        max(v.nombre_comercial) as nombre_comercial,
        sum(v.cantidad) as unidades,
        sum(v.subtotal) as facturacion,
        sum(v.costo_unitario * v.cantidad) as costo,
        sum(v.ganancia) as ganancia,
        count(distinct v.pedido_id) as pedidos,
        count(*) filter (where v.costo_unitario is null) as items_sin_costo
      from vista_dashboard_ventas v
      where v.clasificacion = 'completado'
        and v.creado_en >= p_desde and v.creado_en < p_hasta
        and (p_categoria_id is null or v.categoria_id = p_categoria_id)
        and (p_producto_id is null or v.producto_id = p_producto_id)
      group by v.producto_id
    ) t;

  elsif p_tipo = 'categorias' then

    select coalesce(jsonb_agg(jsonb_build_object(
      'categoria_id', t.categoria_id,
      'nombre', t.nombre,
      'unidades', t.unidades,
      'facturacion', t.facturacion,
      'costo', t.costo,
      'ganancia', t.ganancia,
      'margen', case when t.facturacion > 0
        then round(t.ganancia / t.facturacion * 100, 1) else null end,
      'pedidos', t.pedidos
    ) order by t.facturacion desc), '[]'::jsonb)
    into v_resultado
    from (
      select
        v.categoria_id,
        max(c.nombre) as nombre,
        sum(v.cantidad) as unidades,
        sum(v.subtotal) as facturacion,
        sum(v.costo_unitario * v.cantidad) as costo,
        sum(v.ganancia) as ganancia,
        count(distinct v.pedido_id) as pedidos
      from vista_dashboard_ventas v
      left join categorias c on c.id = v.categoria_id
      where v.clasificacion = 'completado'
        and v.creado_en >= p_desde and v.creado_en < p_hasta
        and (p_categoria_id is null or v.categoria_id = p_categoria_id)
        and (p_producto_id is null or v.producto_id = p_producto_id)
      group by v.categoria_id
    ) t;

  elsif p_tipo = 'clientes' then

    select coalesce(jsonb_agg(jsonb_build_object(
      'cliente', t.cliente_nombre,
      'email', t.cliente_email,
      'pedidos', t.pedidos,
      'facturacion', t.facturacion,
      'ultima_compra', t.ultima_compra
    ) order by t.facturacion desc), '[]'::jsonb)
    into v_resultado
    from (
      select
        v.cliente_nombre,
        max(v.cliente_email) as cliente_email,
        count(distinct v.pedido_id) as pedidos,
        sum(v.subtotal) as facturacion,
        max(v.creado_en) as ultima_compra
      from vista_dashboard_ventas v
      where v.clasificacion = 'completado'
        and v.creado_en >= p_desde and v.creado_en < p_hasta
      group by v.cliente_nombre
    ) t;

  else

    raise exception 'Tipo de ranking no soportado: %', p_tipo;

  end if;

  return v_resultado;
end;
$$;

revoke all on function public.dashboard_top(text, timestamptz, timestamptz, integer, bigint, bigint) from public;
grant execute on function public.dashboard_top(text, timestamptz, timestamptz, integer, bigint, bigint) to authenticated;

-- ---------- 4. RLS de compras/compra_items solo administradores ----------

drop policy if exists "personal_select_own" on public.compras;
drop policy if exists "personal_insert_own" on public.compras;
drop policy if exists "personal_update_own" on public.compras;
drop policy if exists "personal_delete_own" on public.compras;

create policy "personal_select_own" on public.compras
  for select to authenticated
  using (public.es_admin());

create policy "personal_insert_own" on public.compras
  for insert to authenticated
  with check (public.es_admin());

create policy "personal_update_own" on public.compras
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy "personal_delete_own" on public.compras
  for delete to authenticated
  using (public.es_admin());

drop policy if exists "personal_select_own" on public.compra_items;
drop policy if exists "personal_insert_own" on public.compra_items;
drop policy if exists "personal_update_own" on public.compra_items;
drop policy if exists "personal_delete_own" on public.compra_items;

create policy "personal_select_own" on public.compra_items
  for select to authenticated
  using (public.es_admin());

create policy "personal_insert_own" on public.compra_items
  for insert to authenticated
  with check (public.es_admin());

create policy "personal_update_own" on public.compra_items
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy "personal_delete_own" on public.compra_items
  for delete to authenticated
  using (public.es_admin());