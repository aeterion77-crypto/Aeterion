-- =====================================================================
-- Tienda Aeterion · migración 008: ventas en persona
-- Reutiliza ventas_gimnasio con una columna «tipo» (gimnasio | personal).
-- Las ventas en persona descuentan inventario y cuentan en Números.
-- =====================================================================
alter table public.ventas_gimnasio add column tipo text not null default 'gimnasio' check (tipo in ('gimnasio','personal'));
alter table public.ventas_gimnasio add column metodo text check (metodo in ('efectivo','tarjeta','transferencia','otro'));

drop function if exists public.panel_venta_gim_registrar(text, jsonb, boolean, text, date);
create or replace function public.panel_venta_gim_registrar(p_gimnasio text, p_items jsonb, p_pagado boolean default false, p_nota text default null, p_fecha date default null,
  p_tipo text default 'gimnasio', p_metodo text default null)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare tipo text := coalesce(nullif(p_tipo, ''), 'gimnasio'); g text; it jsonb; pr public.productos%rowtype; q int; precio numeric;
  lineas jsonb := '[]'::jsonb; tot numeric := 0; cos numeric := 0; nid bigint; nuevo int;
begin
  if not public.es_admin() then raise exception 'no autorizado' using errcode = '42501'; end if;
  if tipo not in ('gimnasio','personal') then return jsonb_build_object('ok', false, 'error', 'tipo_invalido'); end if;
  if p_metodo is not null and p_metodo not in ('efectivo','tarjeta','transferencia','otro') then return jsonb_build_object('ok', false, 'error', 'metodo_invalido'); end if;
  g := btrim(coalesce(p_gimnasio, ''));
  if tipo = 'personal' and g = '' then g := 'Venta en persona'; end if;
  if char_length(g) < 2 or char_length(g) > 80 then return jsonb_build_object('ok', false, 'error', 'gimnasio_invalido'); end if;
  if p_fecha is not null and (p_fecha > (now() at time zone 'America/Mexico_City')::date or p_fecha < (now() at time zone 'America/Mexico_City')::date - 366) then return jsonb_build_object('ok', false, 'error', 'fecha_invalida'); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then return jsonb_build_object('ok', false, 'error', 'sin_productos'); end if;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'qty')::int;
    if q is null or q < 1 or q > 10000 then return jsonb_build_object('ok', false, 'error', 'cantidad_invalida'); end if;
    select * into pr from public.productos where id = it->>'id' for update;
    if pr.id is null then return jsonb_build_object('ok', false, 'error', 'producto_invalido'); end if;
    precio := coalesce(nullif(it->>'precio', '')::numeric, case when tipo = 'personal' then pr.precio else coalesce(pr.precio_gimnasio, pr.precio) end);
    if precio is null or precio < 0 or precio > 100000 then return jsonb_build_object('ok', false, 'error', 'precio_invalido'); end if;
    if pr.stock is not null and pr.stock < q then return jsonb_build_object('ok', false, 'error', 'stock_insuficiente', 'producto', pr.nombre, 'stock', pr.stock); end if;
    lineas := lineas || jsonb_build_object('id', pr.id, 'nombre', pr.nombre, 'qty', q, 'precio', precio, 'costo', coalesce(pr.costo, 0));
    tot := tot + q * precio; cos := cos + q * coalesce(pr.costo, 0);
  end loop;
  insert into public.ventas_gimnasio (fecha, gimnasio, items, total, costo, pagado, nota, por, tipo, metodo)
  values (coalesce(p_fecha, (now() at time zone 'America/Mexico_City')::date), g, lineas, tot, cos, coalesce(p_pagado, false), nullif(left(btrim(coalesce(p_nota, '')), 300), ''), auth.uid(), tipo, p_metodo)
  returning id into nid;
  for it in select * from jsonb_array_elements(lineas) loop
    update public.productos set stock = stock - (it->>'qty')::int, actualizado_en = now() where id = it->>'id' and stock is not null returning stock into nuevo;
    if found then insert into public.inventario_movs (producto, tipo, cantidad, saldo, nota)
      values (it->>'id', 'salida', (it->>'qty')::int, nuevo, left(case when tipo = 'personal' then 'Venta en persona' || case when g <> 'Venta en persona' then ' a ' || g else '' end else 'Venta a ' || g end || ' #' || nid, 200)); end if;
  end loop;
  perform public.admin_log(case when tipo = 'personal' then 'Registró venta en persona' else 'Registró venta a gimnasio' end, g || ' · $' || tot || ' · #' || nid);
  return jsonb_build_object('ok', true, 'id', nid, 'total', tot, 'costo', cos);
end $function$;
revoke all on function public.panel_venta_gim_registrar(text, jsonb, boolean, text, date, text, text) from public, anon;
grant execute on function public.panel_venta_gim_registrar(text, jsonb, boolean, text, date, text, text) to authenticated, service_role;

create or replace function public.panel_negocio(p_desde date, p_hasta date)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare d date := coalesce(p_desde, date_trunc('month', now() at time zone 'America/Mexico_City')::date); h date := coalesce(p_hasta, (now() at time zone 'America/Mexico_City')::date);
  ini timestamptz := (d::timestamp at time zone 'America/Mexico_City'); fin timestamptz := ((h + 1)::timestamp at time zone 'America/Mexico_City');
  res jsonb;
begin
  if not public.es_admin() then raise exception 'no autorizado' using errcode = '42501'; end if;
  with ped as (
    select o.* from public.pedidos o where o.clip_id like 'cs\_%' and o.estado <> 'cancelado' and o.created_at >= ini and o.created_at < fin
  ), uds as (
    select u.producto, sum(u.qty) qty, sum(coalesce(u.importe, 0)) importe from ped cross join lateral public._unidades_pedido(ped.productos) u group by u.producto
  ), gim as (
    select (x->>'id') producto, sum((x->>'qty')::int) qty, sum((x->>'qty')::int * (x->>'precio')::numeric) importe, sum((x->>'qty')::int * (x->>'costo')::numeric) costo
    from public.ventas_gimnasio v cross join lateral jsonb_array_elements(v.items) x where not v.anulado and v.tipo = 'gimnasio' and v.fecha between d and h group by 1
  ), per as (
    select (x->>'id') producto, sum((x->>'qty')::int) qty, sum((x->>'qty')::int * (x->>'precio')::numeric) importe, sum((x->>'qty')::int * (x->>'costo')::numeric) costo
    from public.ventas_gimnasio v cross join lateral jsonb_array_elements(v.items) x where not v.anulado and v.tipo = 'personal' and v.fecha between d and h group by 1
  ), vel as (
    select producto, sum(qty)::numeric / 30 dia from (
      select u.producto, u.qty from public.pedidos o cross join lateral public._unidades_pedido(o.productos) u where o.clip_id like 'cs\_%' and o.estado <> 'cancelado' and o.created_at >= now() - interval '30 days'
      union all select (x->>'id'), (x->>'qty')::int from public.ventas_gimnasio v cross join lateral jsonb_array_elements(v.items) x where not v.anulado and v.fecha >= ((now() at time zone 'America/Mexico_City')::date - 30)) z group by producto
  )
  select jsonb_build_object(
    'desde', d, 'hasta', h,
    'productos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'precio', p.precio, 'precio_gimnasio', p.precio_gimnasio, 'costo', p.costo, 'peso_g', p.peso_g, 'stock', p.stock, 'stock_minimo', p.stock_minimo,
        'uds_tienda', coalesce(u.qty, 0), 'ingreso_tienda', coalesce(u.importe, 0), 'uds_gim', coalesce(g.qty, 0), 'ingreso_gim', coalesce(g.importe, 0), 'costo_gim', coalesce(g.costo, 0),
        'uds_personal', coalesce(pe.qty, 0), 'ingreso_personal', coalesce(pe.importe, 0), 'costo_personal', coalesce(pe.costo, 0),
        'por_dia', round(coalesce(vel.dia, 0), 3)) order by p.id)
      from public.productos p left join uds u on u.producto = p.id left join gim g on g.producto = p.id left join per pe on pe.producto = p.id left join vel on vel.producto = p.id), '[]'::jsonb),
    'tienda', (select jsonb_build_object('pedidos', count(*), 'subtotal', coalesce(sum(subtotal), 0), 'descuento', coalesce(sum(descuento), 0), 'envio_cobrado', coalesce(sum(envio), 0),
        'envio_pagado', coalesce(sum(envio_costo), 0), 'pedidos_con_costo_envio', count(envio_costo), 'total', coalesce(sum(total), 0),
        'comision', coalesce(round(sum((total * 0.036 + 3) * 1.16), 2), 0)) from ped),
    'gimnasios', jsonb_build_object(
        'total', coalesce((select sum(total) from public.ventas_gimnasio where not anulado and tipo = 'gimnasio' and fecha between d and h), 0),
        'costo', coalesce((select sum(costo) from public.ventas_gimnasio where not anulado and tipo = 'gimnasio' and fecha between d and h), 0),
        'por_cobrar', coalesce((select sum(total) from public.ventas_gimnasio where not anulado and not pagado), 0),
        'ventas', coalesce((select jsonb_agg(v order by v.fecha desc, v.id desc) from (select id, fecha, gimnasio, items, total, costo, pagado, nota, tipo, metodo from public.ventas_gimnasio where not anulado and (fecha between d and h or not pagado) order by fecha desc, id desc limit 200) v), '[]'::jsonb),
        'nombres', coalesce((select jsonb_agg(distinct n) from (select gimnasio n from public.ventas_gimnasio where tipo = 'gimnasio' union select gimnasio from public.lotes_codigos where gimnasio <> 'Sin asignar') q), '[]'::jsonb)),
    'personal', jsonb_build_object(
        'total', coalesce((select sum(total) from public.ventas_gimnasio where not anulado and tipo = 'personal' and fecha between d and h), 0),
        'costo', coalesce((select sum(costo) from public.ventas_gimnasio where not anulado and tipo = 'personal' and fecha between d and h), 0),
        'ventas', coalesce((select count(*) from public.ventas_gimnasio where not anulado and tipo = 'personal' and fecha between d and h), 0)),
    'gastos', jsonb_build_object(
        'total', coalesce((select sum(monto) from public.gastos where not anulado and fecha between d and h), 0),
        'por_categoria', coalesce((select jsonb_object_agg(categoria, s) from (select categoria, sum(monto) s from public.gastos where not anulado and fecha between d and h group by 1) c), '{}'::jsonb),
        'lista', coalesce((select jsonb_agg(x order by x.fecha desc, x.id desc) from (select id, fecha, concepto, categoria, monto from public.gastos where not anulado and fecha between d and h order by fecha desc, id desc limit 300) x), '[]'::jsonb))
  ) into res;
  return res;
end $function$;

-- 008b: Inventario muestra precio, costo y las últimas ventas en persona
create or replace function public.panel_inventario() returns jsonb
language plpgsql security definer set search_path = public as $function$
begin
  if not public.es_admin() then raise exception 'no autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'productos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'stock', p.stock, 'stock_minimo', p.stock_minimo, 'precio', p.precio, 'costo', p.costo,
        'codigos_disponibles', (select count(*) from public.codigos c join public.lotes_codigos l on l.id = c.lote_id where l.producto = p.id and c.estado = 'disponible'))
        order by p.id) from public.productos p), '[]'::jsonb),
    'movs', coalesce((select jsonb_agg(m order by m.creado_en desc) from (select id, producto, tipo, cantidad, saldo, nota, creado_en from public.inventario_movs order by creado_en desc limit 60) m), '[]'::jsonb),
    'ventas_persona', coalesce((select jsonb_agg(v order by v.fecha desc, v.id desc) from (select id, fecha, gimnasio cliente, items, total, costo, metodo, nota from public.ventas_gimnasio
        where tipo = 'personal' and not anulado order by fecha desc, id desc limit 20) v), '[]'::jsonb));
end $function$;
