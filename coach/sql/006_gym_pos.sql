-- =====================================================================
-- Aeterion Gym · migración 006: foto del socio, abonos y pagos parciales,
-- punto de venta, inventario, tickets, reportes y exportación.
-- Solo toca objetos de Aeterion Gym (005).
-- =====================================================================

-- ---------- Cambios a tablas de 005 ----------
alter table public.gym_socios add column foto text check (foto is null or (char_length(foto) <= 120000 and foto like 'data:image/%'));
alter table public.gym_pagos add column total numeric(10,2) check (total is null or (total >= 0 and total <= 100000));
alter table public.gym_pagos add column pago_de bigint references public.gym_pagos (id) on delete cascade;
alter table public.gym_pagos alter column desde drop not null, alter column hasta drop not null;
update public.gym_pagos set total = monto where total is null;
create index gym_pagos_de on public.gym_pagos (pago_de);
alter table public.gyms add column ajustes jsonb not null default '{}';

-- ---------- Punto de venta ----------
create table public.gym_productos (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 80),
  codigo text check (char_length(codigo) <= 40),
  categoria text check (char_length(categoria) <= 40),
  precio numeric(10,2) not null check (precio >= 0 and precio <= 100000),
  costo numeric(10,2) not null default 0 check (costo >= 0 and costo <= 100000),
  existencia int not null default 0,
  minimo int not null default 0 check (minimo >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index gym_productos_gym on public.gym_productos (gym_id, activo);
create unique index gym_productos_codigo on public.gym_productos (gym_id, codigo) where codigo is not null and activo;

create table public.gym_ventas (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  folio int not null,
  sede_id bigint references public.gym_sedes (id) on delete set null,
  socio_id bigint references public.gym_socios (id) on delete set null,
  subtotal numeric(10,2) not null,
  descuento numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  metodo text not null check (metodo in ('efectivo','tarjeta','transferencia','otro')),
  pago_con numeric(10,2),
  vendedor uuid,
  creado_en timestamptz not null default now(),
  cancelada_en timestamptz,
  cancelada_por uuid,
  motivo text,
  unique (gym_id, folio)
);
create index gym_ventas_gym on public.gym_ventas (gym_id, creado_en);

create table public.gym_venta_items (
  id bigserial primary key,
  venta_id bigint not null references public.gym_ventas (id) on delete cascade,
  producto_id bigint references public.gym_productos (id) on delete set null,
  nombre text not null,
  precio numeric(10,2) not null,
  costo numeric(10,2) not null default 0,
  cantidad int not null check (cantidad between 1 and 999)
);
create index gym_venta_items_venta on public.gym_venta_items (venta_id);

create table public.gym_inv_movs (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  producto_id bigint not null references public.gym_productos (id) on delete cascade,
  tipo text not null check (tipo in ('entrada','ajuste','venta','cancelacion')),
  cantidad int not null,
  existencia_final int not null,
  nota text,
  venta_id bigint,
  por uuid,
  creado_en timestamptz not null default now()
);
create index gym_inv_movs_prod on public.gym_inv_movs (producto_id, creado_en);

alter table public.gym_productos enable row level security;
alter table public.gym_ventas enable row level security;
alter table public.gym_venta_items enable row level security;
alter table public.gym_inv_movs enable row level security;
revoke all on public.gym_productos, public.gym_ventas, public.gym_venta_items, public.gym_inv_movs from anon, authenticated;

-- ---------- Socio: saldo y foto ----------
create or replace function public._gym_saldo(p_socio bigint) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when pago_de is null then coalesce(total, monto) - monto else -monto end), 0)
  from public.gym_pagos where socio_id = p_socio and anulado_en is null
    and (pago_de is null or pago_de in (select id from public.gym_pagos where socio_id = p_socio and anulado_en is null)) $$;

create or replace function public._gym_socio_json(s public.gym_socios) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'numero', s.numero, 'nombre', s.nombre, 'telefono', s.telefono, 'email', s.email,
    'vence_en', s.vence_en, 'activo', s.activo, 'nota', s.nota, 'sede_id', s.sede_id, 'vinculado', s.user_id is not null,
    'plan', (select nombre from public.gym_planes where id = s.plan_id), 'plan_id', s.plan_id, 'tiene_foto', s.foto is not null,
    'saldo', public._gym_saldo(s.id),
    'estado', case when not s.activo then 'baja' when s.vence_en is null then 'sin_pago' when s.vence_en < public._gym_hoy() then 'vencido'
                   when s.vence_en < public._gym_hoy() + public._gym_regla('por_vencer_dias')::int then 'por_vencer' else 'al_corriente' end,
    'dias', case when s.vence_en is not null then s.vence_en - public._gym_hoy() end,
    'ultima', (select max(entrada) from public.gym_asistencias a where a.socio_id = s.id)) $$;

create or replace function public.gym_socio_foto(p_gym uuid, p_socio bigint, p_foto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion']); s public.gym_socios;
begin
  if p_foto is not null and (char_length(p_foto) > 120000 or p_foto not like 'data:image/%') then raise exception 'foto_invalida'; end if;
  update public.gym_socios set foto = p_foto where id = p_socio and gym_id = p_gym returning * into s;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  return public._gym_socio_json(s);
end $$;

create or replace function public.gym_socio_detalle(p_gym uuid, p_socio bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); s public.gym_socios;
begin
  select * into s from public.gym_socios where id = p_socio and gym_id = p_gym;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  return public._gym_socio_json(s) || jsonb_build_object('codigo_vincular', s.codigo_vincular, 'creado_en', s.creado_en, 'foto', s.foto,
    'token', case when rol <> 'coach' then s.token end,
    'pagos', case when rol in ('dueno','admin','recepcion') then coalesce((select jsonb_agg(jsonb_build_object('id', id, 'monto', monto, 'total', coalesce(total, monto), 'metodo', metodo,
        'desde', desde, 'hasta', hasta, 'pago_de', pago_de, 'fecha', creado_en, 'anulado', anulado_en is not null, 'motivo', motivo,
        'plan', (select nombre from public.gym_planes where id = p.plan_id), 'concepto', concepto,
        'abonado', case when pago_de is null then monto + coalesce((select sum(a.monto) from public.gym_pagos a where a.pago_de = p.id and a.anulado_en is null), 0) end) order by creado_en desc)
       from (select * from public.gym_pagos where socio_id = p_socio order by creado_en desc limit 40) p), '[]') end,
    'compras', case when rol in ('dueno','admin','recepcion') then coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'folio', v.folio, 'total', v.total, 'fecha', v.creado_en, 'cancelada', v.cancelada_en is not null) order by v.creado_en desc)
       from (select * from public.gym_ventas where socio_id = p_socio order by creado_en desc limit 20) v), '[]') end,
    'asistencias', coalesce((select jsonb_agg(entrada order by entrada desc) from (select entrada from public.gym_asistencias where socio_id = p_socio order by entrada desc limit 30) a), '[]'),
    'asistencias_30', (select count(*) from public.gym_asistencias where socio_id = p_socio and entrada > now() - interval '30 days'));
end $$;

-- ---------- Pagos con total (parciales) y abonos ----------
drop function if exists public.gym_pago_registrar(uuid, bigint, bigint, numeric, text, text);
create or replace function public.gym_pago_registrar(p_gym uuid, p_socio bigint, p_plan bigint, p_monto numeric, p_metodo text, p_concepto text default null, p_total numeric default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion']); s public.gym_socios; pl public.gym_planes; d date; h date; hoy date := public._gym_hoy(); t numeric;
begin
  select * into s from public.gym_socios where id = p_socio and gym_id = p_gym and activo for update;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  select * into pl from public.gym_planes where id = p_plan and gym_id = p_gym and activo;
  if pl.id is null then raise exception 'plan_invalido'; end if;
  t := coalesce(p_total, p_monto);
  if p_monto is null or p_monto < 0 or p_monto > 100000 or t < 0 or t > 100000 or p_monto > t then raise exception 'monto_invalido'; end if;
  if p_metodo not in ('efectivo','tarjeta','transferencia','otro') then raise exception 'metodo_invalido'; end if;
  d := greatest(hoy, coalesce(s.vence_en + 1, hoy)); h := d + pl.dias - 1;
  insert into public.gym_pagos (gym_id, socio_id, plan_id, concepto, monto, total, metodo, desde, hasta, registrado_por)
  values (p_gym, p_socio, pl.id, nullif(left(trim(coalesce(p_concepto, '')), 80), ''), p_monto, t, p_metodo, d, h, auth.uid());
  update public.gym_socios set vence_en = h, plan_id = pl.id where id = p_socio returning * into s;
  return public._gym_socio_json(s);
end $$;

-- Abono a un pago con saldo pendiente
create or replace function public.gym_abono_registrar(p_gym uuid, p_pago bigint, p_monto numeric, p_metodo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion']); pg public.gym_pagos; pend numeric; s public.gym_socios;
begin
  select * into pg from public.gym_pagos where id = p_pago and gym_id = p_gym and pago_de is null and anulado_en is null for update;
  if pg.id is null then raise exception 'pago_no_encontrado'; end if;
  pend := coalesce(pg.total, pg.monto) - pg.monto - coalesce((select sum(monto) from public.gym_pagos where pago_de = pg.id and anulado_en is null), 0);
  if p_monto is null or p_monto <= 0 or p_monto > pend then raise exception 'monto_invalido'; end if;
  if p_metodo not in ('efectivo','tarjeta','transferencia','otro') then raise exception 'metodo_invalido'; end if;
  insert into public.gym_pagos (gym_id, socio_id, plan_id, concepto, monto, total, metodo, pago_de, registrado_por)
  values (p_gym, pg.socio_id, null, 'Abono', p_monto, p_monto, p_metodo, pg.id, auth.uid());
  select * into s from public.gym_socios where id = pg.socio_id;
  return public._gym_socio_json(s);
end $$;

create or replace function public.gym_pago_anular(p_gym uuid, p_pago bigint, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); pg public.gym_pagos; s public.gym_socios;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'falta_motivo'; end if;
  update public.gym_pagos set anulado_en = now(), anulado_por = auth.uid(), motivo = left(trim(p_motivo), 160)
   where id = p_pago and gym_id = p_gym and anulado_en is null returning * into pg;
  if pg.id is null then raise exception 'pago_no_encontrado'; end if;
  if pg.pago_de is null then
    update public.gym_pagos set anulado_en = now(), anulado_por = auth.uid(), motivo = 'Se anuló el pago principal' where pago_de = pg.id and anulado_en is null;
    update public.gym_socios set vence_en = (select max(hasta) from public.gym_pagos where socio_id = pg.socio_id and anulado_en is null and pago_de is null)
     where id = pg.socio_id;
  end if;
  select * into s from public.gym_socios where id = pg.socio_id;
  return public._gym_socio_json(s);
end $$;

-- ---------- Entrada (con foto para recepción) ----------
create or replace function public.gym_checkin(p_gym uuid, p_sede bigint, p_dato text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach']); s public.gym_socios; d text := trim(coalesce(p_dato, '')); met text; prev timestamptz; hoy date := public._gym_hoy();
begin
  if d ~ '^[0-9]{1,7}$' then select * into s from public.gym_socios where gym_id = p_gym and numero = d::int; met := 'numero';
  else d := lower(regexp_replace(d, '^aet-gym:', '', 'i')); select * into s from public.gym_socios where gym_id = p_gym and token = d; met := 'qr'; end if;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  if not s.activo then return jsonb_build_object('ok', false, 'motivo', 'baja', 'socio', public._gym_socio_json(s) || jsonb_build_object('foto', s.foto)); end if;
  select max(entrada) into prev from public.gym_asistencias where socio_id = s.id;
  if prev is not null and prev > now() - make_interval(mins => public._gym_regla('checkin_repetido_min')::int) then
    return jsonb_build_object('ok', true, 'repetido', true, 'socio', public._gym_socio_json(s) || jsonb_build_object('foto', s.foto));
  end if;
  insert into public.gym_asistencias (gym_id, sede_id, socio_id, metodo, registrado_por)
  values (p_gym, case when p_sede is not null and exists (select 1 from public.gym_sedes where id = p_sede and gym_id = p_gym) then p_sede else s.sede_id end, s.id, met, auth.uid());
  return jsonb_build_object('ok', true, 'repetido', false, 'al_corriente', coalesce(s.vence_en >= hoy, false), 'socio', public._gym_socio_json(s) || jsonb_build_object('foto', s.foto));
end $$;

-- ---------- Productos e inventario ----------
create or replace function public._gym_producto_json(p public.gym_productos) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'codigo', p.codigo, 'categoria', p.categoria, 'precio', p.precio, 'costo', p.costo,
    'existencia', p.existencia, 'minimo', p.minimo, 'activo', p.activo, 'bajo', p.existencia <= p.minimo) $$;

create or replace function public.gym_productos_listar(p_gym uuid, p_busca text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion'], false); b text := nullif(trim(p_busca), '');
begin
  return coalesce((select jsonb_agg(public._gym_producto_json(p) || case when rol = 'recepcion' then '{"costo":null}'::jsonb else '{}'::jsonb end order by p.nombre)
    from public.gym_productos p where p.gym_id = p_gym and p.activo
      and (b is null or p.nombre ilike '%' || b || '%' or p.codigo = b or p.categoria ilike '%' || b || '%')), '[]');
end $$;

create or replace function public.gym_producto_guardar(p_gym uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); pid bigint := nullif(p ->> 'id', '')::bigint; r public.gym_productos;
  nom text := left(trim(coalesce(p ->> 'nombre', '')), 80); cod text := nullif(left(trim(coalesce(p ->> 'codigo', '')), 40), '');
  pre numeric; cos numeric; ini int; mn int;
begin
  if char_length(nom) < 2 then raise exception 'falta_nombre'; end if;
  if coalesce(p ->> 'precio', '') !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' then raise exception 'monto_invalido'; end if;
  if coalesce(nullif(p ->> 'costo', ''), '0') !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' then raise exception 'monto_invalido'; end if;
  if coalesce(nullif(p ->> 'minimo', ''), '0') !~ '^[0-9]{1,5}$' or coalesce(nullif(p ->> 'existencia', ''), '0') !~ '^[0-9]{1,5}$' then raise exception 'cantidad_invalida'; end if;
  pre := (p ->> 'precio')::numeric; cos := coalesce(nullif(p ->> 'costo', ''), '0')::numeric; mn := coalesce(nullif(p ->> 'minimo', ''), '0')::int; ini := coalesce(nullif(p ->> 'existencia', ''), '0')::int;
  if cod is not null and exists (select 1 from public.gym_productos where gym_id = p_gym and codigo = cod and activo and id is distinct from pid) then raise exception 'codigo_repetido'; end if;
  if pid is null then
    if (select count(*) from public.gym_productos where gym_id = p_gym and activo) >= 1000 then raise exception 'demasiados_productos'; end if;
    insert into public.gym_productos (gym_id, nombre, codigo, categoria, precio, costo, existencia, minimo)
    values (p_gym, nom, cod, nullif(left(trim(coalesce(p ->> 'categoria', '')), 40), ''), pre, cos, ini, mn) returning * into r;
    if ini <> 0 then insert into public.gym_inv_movs (gym_id, producto_id, tipo, cantidad, existencia_final, nota, por) values (p_gym, r.id, 'entrada', ini, ini, 'Existencia inicial', auth.uid()); end if;
  else
    update public.gym_productos set nombre = nom, codigo = cod, categoria = nullif(left(trim(coalesce(p ->> 'categoria', '')), 40), ''), precio = pre, costo = cos, minimo = mn,
      activo = coalesce((p ->> 'activo')::boolean, true) where id = pid and gym_id = p_gym returning * into r;
    if r.id is null then raise exception 'producto_no_encontrado'; end if;
  end if;
  return public._gym_producto_json(r);
end $$;

-- Entrada de mercancía (cantidad > 0) o ajuste por conteo físico (nueva existencia)
create or replace function public.gym_inventario_mov(p_gym uuid, p_producto bigint, p_tipo text, p_cantidad int, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); r public.gym_productos; delta int;
begin
  select * into r from public.gym_productos where id = p_producto and gym_id = p_gym for update;
  if r.id is null then raise exception 'producto_no_encontrado'; end if;
  if p_tipo = 'entrada' then if p_cantidad is null or p_cantidad < 1 or p_cantidad > 99999 then raise exception 'cantidad_invalida'; end if; delta := p_cantidad;
  elsif p_tipo = 'ajuste' then if p_cantidad is null or p_cantidad < 0 or p_cantidad > 99999 then raise exception 'cantidad_invalida'; end if; delta := p_cantidad - r.existencia;
    if char_length(trim(coalesce(p_nota, ''))) < 3 then raise exception 'falta_motivo'; end if;
  else raise exception 'tipo_invalido'; end if;
  update public.gym_productos set existencia = existencia + delta where id = r.id returning * into r;
  insert into public.gym_inv_movs (gym_id, producto_id, tipo, cantidad, existencia_final, nota, por) values (p_gym, r.id, p_tipo, delta, r.existencia, nullif(left(trim(coalesce(p_nota, '')), 160), ''), auth.uid());
  return public._gym_producto_json(r);
end $$;

create or replace function public.gym_inventario_movs(p_gym uuid, p_producto bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin'], false);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('tipo', tipo, 'cantidad', cantidad, 'existencia', existencia_final, 'nota', nota, 'fecha', creado_en, 'venta_id', venta_id) order by creado_en desc)
    from (select * from public.gym_inv_movs where gym_id = p_gym and producto_id = p_producto order by creado_en desc limit 60) m), '[]');
end $$;

-- ---------- Ventas ----------
create or replace function public._gym_venta_json(v public.gym_ventas) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', v.id, 'folio', v.folio, 'fecha', v.creado_en, 'subtotal', v.subtotal, 'descuento', v.descuento, 'total', v.total,
    'metodo', v.metodo, 'pago_con', v.pago_con, 'cambio', case when v.pago_con is not null then v.pago_con - v.total end,
    'cancelada', v.cancelada_en is not null, 'motivo', v.motivo,
    'socio', (select jsonb_build_object('id', s.id, 'numero', s.numero, 'nombre', s.nombre) from public.gym_socios s where s.id = v.socio_id),
    'vendedor', (select coalesce(nullif(pf.nombre, ''), split_part(u.email, '@', 1)) from auth.users u left join public.perfiles pf on pf.id = u.id where u.id = v.vendedor),
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'precio', i.precio, 'cantidad', i.cantidad, 'importe', i.precio * i.cantidad) order by i.id)
      from public.gym_venta_items i where i.venta_id = v.id), '[]')) $$;

-- p_items: [{ "producto_id": 1, "cantidad": 2 }]
create or replace function public.gym_venta_crear(p_gym uuid, p_items jsonb, p_descuento numeric, p_metodo text, p_pago_con numeric default null, p_socio bigint default null, p_sede bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion']); it jsonb; pr public.gym_productos; n int; sub numeric := 0; v public.gym_ventas; fol int; cnt int := 0; tot numeric; des numeric := coalesce(p_descuento, 0);
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'venta_vacia'; end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'venta_larga'; end if;
  if p_metodo not in ('efectivo','tarjeta','transferencia','otro') then raise exception 'metodo_invalido'; end if;
  if p_socio is not null and not exists (select 1 from public.gym_socios where id = p_socio and gym_id = p_gym) then raise exception 'socio_no_encontrado'; end if;
  perform 1 from public.gyms where id = p_gym for update;   -- folio consecutivo sin choques
  select coalesce(max(folio), 0) + 1 into fol from public.gym_ventas where gym_id = p_gym;
  insert into public.gym_ventas (gym_id, folio, sede_id, socio_id, subtotal, descuento, total, metodo, pago_con, vendedor)
  values (p_gym, fol, case when p_sede is not null and exists (select 1 from public.gym_sedes where id = p_sede and gym_id = p_gym) then p_sede end, p_socio, 0, 0, 0, p_metodo, null, auth.uid())
  returning * into v;
  for it in select * from jsonb_array_elements(p_items) loop
    n := nullif(it ->> 'cantidad', '')::int;
    if n is null or n < 1 or n > 999 then raise exception 'cantidad_invalida'; end if;
    select * into pr from public.gym_productos where id = nullif(it ->> 'producto_id', '')::bigint and gym_id = p_gym and activo for update;
    if pr.id is null then raise exception 'producto_no_encontrado'; end if;
    if pr.existencia < n then raise exception 'sin_existencia: %', pr.nombre; end if;
    update public.gym_productos set existencia = existencia - n where id = pr.id;
    insert into public.gym_venta_items (venta_id, producto_id, nombre, precio, costo, cantidad) values (v.id, pr.id, pr.nombre, pr.precio, pr.costo, n);
    insert into public.gym_inv_movs (gym_id, producto_id, tipo, cantidad, existencia_final, venta_id, por) values (p_gym, pr.id, 'venta', -n, pr.existencia - n, v.id, auth.uid());
    sub := sub + pr.precio * n; cnt := cnt + 1;
  end loop;
  if des < 0 or des > sub then raise exception 'descuento_invalido'; end if;
  tot := sub - des;
  if p_pago_con is not null and (p_metodo <> 'efectivo' or p_pago_con < tot or p_pago_con > 1000000) then raise exception 'pago_con_invalido'; end if;
  update public.gym_ventas set subtotal = sub, descuento = des, total = tot, pago_con = p_pago_con where id = v.id returning * into v;
  return public._gym_venta_json(v);
end $$;

create or replace function public.gym_venta_cancelar(p_gym uuid, p_venta bigint, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); v public.gym_ventas; it public.gym_venta_items; ex int;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'falta_motivo'; end if;
  update public.gym_ventas set cancelada_en = now(), cancelada_por = auth.uid(), motivo = left(trim(p_motivo), 160)
   where id = p_venta and gym_id = p_gym and cancelada_en is null returning * into v;
  if v.id is null then raise exception 'venta_no_encontrada'; end if;
  for it in select * from public.gym_venta_items where venta_id = v.id and producto_id is not null loop
    update public.gym_productos set existencia = existencia + it.cantidad where id = it.producto_id returning existencia into ex;
    insert into public.gym_inv_movs (gym_id, producto_id, tipo, cantidad, existencia_final, venta_id, nota, por) values (p_gym, it.producto_id, 'cancelacion', it.cantidad, ex, v.id, 'Venta #' || v.folio || ' cancelada', auth.uid());
  end loop;
  return public._gym_venta_json(v);
end $$;

create or replace function public.gym_venta_detalle(p_gym uuid, p_venta bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion'], false); v public.gym_ventas;
begin
  select * into v from public.gym_ventas where id = p_venta and gym_id = p_gym;
  if v.id is null then raise exception 'venta_no_encontrada'; end if;
  return public._gym_venta_json(v);
end $$;

create or replace function public.gym_ventas_listar(p_gym uuid, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion'], false); d date := coalesce(p_desde, public._gym_hoy()); h date := coalesce(p_hasta, public._gym_hoy());
begin
  if rol = 'recepcion' then d := greatest(d, public._gym_hoy() - 1); end if;
  if h - d > 370 then raise exception 'rango_largo'; end if;
  return coalesce((select jsonb_agg(public._gym_venta_json(v) order by v.creado_en desc)
    from (select * from public.gym_ventas where gym_id = p_gym and (creado_en at time zone 'America/Mexico_City')::date between d and h order by creado_en desc limit 500) v), '[]');
end $$;

-- ---------- Ajustes del gimnasio (ticket) ----------
create or replace function public.gym_ajustes_guardar(p_gym uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); a jsonb;
begin
  a := jsonb_build_object(
    'ticket_ancho', case when p ->> 'ticket_ancho' in ('58','80') then (p ->> 'ticket_ancho')::int else 80 end,
    'ticket_encabezado', left(coalesce(p ->> 'ticket_encabezado', ''), 200),
    'ticket_pie', left(coalesce(p ->> 'ticket_pie', ''), 200),
    'direccion', left(coalesce(p ->> 'direccion', ''), 160),
    'rfc', left(upper(coalesce(p ->> 'rfc', '')), 13),
    'politica_vencidos', case when p ->> 'politica_vencidos' in ('avisar','bloquear') then p ->> 'politica_vencidos' else 'avisar' end);
  update public.gyms set ajustes = a where id = p_gym;
  return public.gym_info(p_gym);
end $$;

-- ---------- Caja (membresías, abonos y ventas) ----------
create or replace function public.gym_caja(p_gym uuid, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion'], false); d date := coalesce(p_desde, public._gym_hoy()); h date := coalesce(p_hasta, public._gym_hoy());
begin
  if rol = 'recepcion' then d := greatest(d, public._gym_hoy() - 1); end if;
  if h - d > 370 then raise exception 'rango_largo'; end if;
  return (with mov as (
      select 'pago' tipo, p.id, p.creado_en fecha, p.monto, p.metodo, p.anulado_en is not null anulado, s.nombre socio, s.numero, s.id socio_id,
        case when p.pago_de is not null then 'Abono' else coalesce((select nombre from public.gym_planes where id = p.plan_id), p.concepto, 'Membresía') end concepto
      from public.gym_pagos p join public.gym_socios s on s.id = p.socio_id
      where p.gym_id = p_gym and (p.creado_en at time zone 'America/Mexico_City')::date between d and h
      union all
      select 'venta', v.id, v.creado_en, v.total, v.metodo, v.cancelada_en is not null, s.nombre, s.numero, s.id, 'Venta #' || v.folio
      from public.gym_ventas v left join public.gym_socios s on s.id = v.socio_id
      where v.gym_id = p_gym and (v.creado_en at time zone 'America/Mexico_City')::date between d and h)
    select jsonb_build_object('desde', d, 'hasta', h,
      'total', coalesce((select sum(monto) from mov where not anulado), 0),
      'membresias', coalesce((select sum(monto) from mov where not anulado and tipo = 'pago'), 0),
      'ventas', coalesce((select sum(monto) from mov where not anulado and tipo = 'venta'), 0),
      'por_metodo', coalesce((select jsonb_object_agg(metodo, t) from (select metodo, sum(monto) t from mov where not anulado group by metodo) x), '{}'),
      'pagos', coalesce((select jsonb_agg(jsonb_build_object('tipo', tipo, 'id', id, 'fecha', fecha, 'socio', socio, 'numero', numero, 'socio_id', socio_id,
          'monto', monto, 'metodo', metodo, 'plan', concepto, 'anulado', anulado) order by fecha desc) from (select * from mov order by fecha desc limit 600) m), '[]')));
end $$;

-- ---------- Panel: gráficas ----------
create or replace function public.gym_resumen(p_gym uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); hoy date := public._gym_hoy();
  pv int := public._gym_regla('por_vencer_dias')::int; dinero boolean := rol in ('dueno','admin','recepcion'); mes timestamptz := date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
begin
  return jsonb_build_object(
    'rol', rol,
    'al_corriente', (select count(*) from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy),
    'por_vencer_n', (select count(*) from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy and vence_en < hoy + pv),
    'vencidos_n', (select count(*) from public.gym_socios where gym_id = p_gym and activo and (vence_en < hoy or vence_en is null)),
    'socios', (select count(*) from public.gym_socios where gym_id = p_gym and activo),
    'con_saldo', case when dinero then (select count(*) from public.gym_socios s where gym_id = p_gym and activo and public._gym_saldo(s.id) > 0) end,
    'asistencias_hoy', (select count(*) from public.gym_asistencias where gym_id = p_gym and (entrada at time zone 'America/Mexico_City')::date = hoy),
    'asistencias_7', (select count(*) from public.gym_asistencias where gym_id = p_gym and entrada > now() - interval '7 days'),
    'altas_mes', (select count(*) from public.gym_socios where gym_id = p_gym and creado_en >= mes),
    'ingresos_hoy', case when dinero then
      (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and (creado_en at time zone 'America/Mexico_City')::date = hoy)
      + (select coalesce(sum(total), 0) from public.gym_ventas where gym_id = p_gym and cancelada_en is null and (creado_en at time zone 'America/Mexico_City')::date = hoy) end,
    'ingresos_mes', case when dinero then
      (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and creado_en >= mes)
      + (select coalesce(sum(total), 0) from public.gym_ventas where gym_id = p_gym and cancelada_en is null and creado_en >= mes) end,
    'ventas_hoy', case when dinero then (select coalesce(sum(total), 0) from public.gym_ventas where gym_id = p_gym and cancelada_en is null and (creado_en at time zone 'America/Mexico_City')::date = hoy) end,
    'stock_bajo', case when dinero then (select count(*) from public.gym_productos where gym_id = p_gym and activo and existencia <= minimo) end,
    'serie_asis', (select jsonb_agg(jsonb_build_object('d', d, 'n', (select count(*) from public.gym_asistencias a where a.gym_id = p_gym and (a.entrada at time zone 'America/Mexico_City')::date = d)) order by d)
       from generate_series(hoy - 6, hoy, interval '1 day') g(x), lateral (select x::date d) z),
    'membresias', coalesce((select jsonb_agg(jsonb_build_object('plan', coalesce(p.nombre, 'Sin plan'), 'n', c) order by c desc)
       from (select plan_id, count(*) c from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy group by plan_id) x left join public.gym_planes p on p.id = x.plan_id), '[]'),
    'por_vencer', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.vence_en) from (select * from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy and vence_en < hoy + pv order by vence_en limit 30) s), '[]'),
    'vencidos', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.vence_en desc) from (select * from public.gym_socios where gym_id = p_gym and activo and vence_en < hoy and vence_en >= hoy - 30 order by vence_en desc limit 30) s), '[]'),
    'entradas', coalesce((select jsonb_agg(jsonb_build_object('hora', a.entrada, 'nombre', s.nombre, 'numero', s.numero, 'metodo', a.metodo, 'socio_id', s.id,
        'al_corriente', coalesce(s.vence_en >= hoy, false)) order by a.entrada desc)
       from (select * from public.gym_asistencias where gym_id = p_gym and (entrada at time zone 'America/Mexico_City')::date = hoy order by entrada desc limit 20) a
       join public.gym_socios s on s.id = a.socio_id), '[]'));
end $$;

-- ---------- Reportes (dueño y administrador) ----------
create or replace function public.gym_reporte(p_gym uuid, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin'], false); d date := coalesce(p_desde, public._gym_hoy() - 29); h date := coalesce(p_hasta, public._gym_hoy());
begin
  if h < d then raise exception 'rango_invalido'; end if;
  if h - d > 370 then raise exception 'rango_largo'; end if;
  return (with
    pg as (select * from public.gym_pagos where gym_id = p_gym and anulado_en is null and (creado_en at time zone 'America/Mexico_City')::date between d and h),
    vt as (select * from public.gym_ventas where gym_id = p_gym and cancelada_en is null and (creado_en at time zone 'America/Mexico_City')::date between d and h),
    it as (select i.* from public.gym_venta_items i join vt on vt.id = i.venta_id),
    dias as (select x::date dia from generate_series(d, h, interval '1 day') x)
  select jsonb_build_object('desde', d, 'hasta', h,
    'membresias', (select coalesce(sum(monto), 0) from pg),
    'ventas', (select coalesce(sum(total), 0) from vt),
    'costo_ventas', (select coalesce(sum(costo * cantidad), 0) from it),
    'descuentos', (select coalesce(sum(descuento), 0) from vt),
    'num_ventas', (select count(*) from vt),
    'num_pagos', (select count(*) from pg where pago_de is null),
    'altas', (select count(*) from public.gym_socios where gym_id = p_gym and (creado_en at time zone 'America/Mexico_City')::date between d and h),
    'bajas', (select count(*) from public.gym_socios where gym_id = p_gym and (baja_en at time zone 'America/Mexico_City')::date between d and h),
    'asistencias', (select count(*) from public.gym_asistencias where gym_id = p_gym and (entrada at time zone 'America/Mexico_City')::date between d and h),
    'por_metodo', coalesce((select jsonb_object_agg(metodo, t) from (select metodo, sum(m) t from (select metodo, monto m from pg union all select metodo, total from vt) z group by metodo) x), '{}'),
    'serie', (select jsonb_agg(jsonb_build_object('d', dia,
        'm', (select coalesce(sum(monto), 0) from pg where (creado_en at time zone 'America/Mexico_City')::date = dia),
        'v', (select coalesce(sum(total), 0) from vt where (creado_en at time zone 'America/Mexico_City')::date = dia),
        'a', (select count(*) from public.gym_asistencias a where a.gym_id = p_gym and (a.entrada at time zone 'America/Mexico_City')::date = dia)) order by dia) from dias),
    'top_productos', coalesce((select jsonb_agg(x order by (x ->> 'importe')::numeric desc) from (select jsonb_build_object('nombre', nombre, 'cantidad', sum(cantidad), 'importe', sum(precio * cantidad), 'ganancia', sum((precio - costo) * cantidad)) x
        from it group by nombre order by sum(precio * cantidad) desc limit 10) t), '[]'),
    'por_plan', coalesce((select jsonb_agg(jsonb_build_object('plan', coalesce(p.nombre, 'Abonos'), 'n', x.n, 'monto', x.t) order by x.t desc)
        from (select plan_id, count(*) n, sum(monto) t from pg group by plan_id) x left join public.gym_planes p on p.id = x.plan_id), '[]')));
end $$;

-- Exportar para Excel / respaldo (dueño y administrador)
create or replace function public.gym_exportar(p_gym uuid, p_tipo text, p_desde date default null, p_hasta date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin'], false); d date := coalesce(p_desde, '2000-01-01'); h date := coalesce(p_hasta, public._gym_hoy());
begin
  if p_tipo = 'socios' then
    return coalesce((select jsonb_agg(jsonb_build_object('Número', s.numero, 'Nombre', s.nombre, 'Teléfono', s.telefono, 'Correo', s.email,
      'Plan', (select nombre from public.gym_planes where id = s.plan_id), 'Vence', s.vence_en, 'Saldo', public._gym_saldo(s.id), 'Activo', case when s.activo then 'Sí' else 'No' end,
      'Usa la app', case when s.user_id is not null then 'Sí' else 'No' end, 'Alta', (s.creado_en at time zone 'America/Mexico_City')::date, 'Nota', s.nota) order by s.numero)
      from public.gym_socios s where s.gym_id = p_gym), '[]');
  elsif p_tipo = 'pagos' then
    return coalesce((select jsonb_agg(jsonb_build_object('Fecha', to_char(p.creado_en at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI'), 'Socio', s.numero || ' ' || s.nombre,
      'Concepto', case when p.pago_de is not null then 'Abono' else coalesce((select nombre from public.gym_planes where id = p.plan_id), p.concepto) end,
      'Total', coalesce(p.total, p.monto), 'Pagado', p.monto, 'Método', p.metodo, 'Desde', p.desde, 'Hasta', p.hasta, 'Anulado', case when p.anulado_en is not null then 'Sí: ' || coalesce(p.motivo, '') else '' end) order by p.creado_en)
      from public.gym_pagos p join public.gym_socios s on s.id = p.socio_id where p.gym_id = p_gym and (p.creado_en at time zone 'America/Mexico_City')::date between d and h), '[]');
  elsif p_tipo = 'ventas' then
    return coalesce((select jsonb_agg(jsonb_build_object('Folio', v.folio, 'Fecha', to_char(v.creado_en at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI'),
      'Producto', i.nombre, 'Cantidad', i.cantidad, 'Precio', i.precio, 'Importe', i.precio * i.cantidad, 'Costo', i.costo * i.cantidad, 'Ganancia', (i.precio - i.costo) * i.cantidad,
      'Descuento de la venta', v.descuento, 'Total de la venta', v.total, 'Método', v.metodo, 'Cancelada', case when v.cancelada_en is not null then 'Sí: ' || coalesce(v.motivo, '') else '' end) order by v.folio, i.id)
      from public.gym_ventas v join public.gym_venta_items i on i.venta_id = v.id where v.gym_id = p_gym and (v.creado_en at time zone 'America/Mexico_City')::date between d and h), '[]');
  elsif p_tipo = 'asistencias' then
    return coalesce((select jsonb_agg(jsonb_build_object('Fecha', to_char(a.entrada at time zone 'America/Mexico_City', 'YYYY-MM-DD HH24:MI'), 'Socio', s.numero || ' ' || s.nombre, 'Método', a.metodo) order by a.entrada)
      from (select * from public.gym_asistencias where gym_id = p_gym and (entrada at time zone 'America/Mexico_City')::date between d and h order by entrada limit 50000) a join public.gym_socios s on s.id = a.socio_id), '[]');
  elsif p_tipo = 'productos' then
    return coalesce((select jsonb_agg(jsonb_build_object('Producto', nombre, 'Código', codigo, 'Categoría', categoria, 'Precio', precio, 'Costo', costo, 'Existencia', existencia, 'Mínimo', minimo,
      'Valor de inventario', costo * greatest(existencia, 0)) order by nombre) from public.gym_productos where gym_id = p_gym and activo), '[]');
  end if;
  raise exception 'tipo_invalido';
end $$;

-- ---------- Socio en su app: membresía completa ----------
create or replace function public.socio_mio() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._gym_socio_json(s) || jsonb_build_object('gym', g.nombre, 'token', s.token, 'foto', s.foto,
      'sede', (select nombre from public.gym_sedes where id = s.sede_id),
      'asistencias_30', (select count(*) from public.gym_asistencias a where a.socio_id = s.id and a.entrada > now() - interval '30 days'),
      'asistencias_mes', (select count(*) from public.gym_asistencias a where a.socio_id = s.id and a.entrada >= date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'),
      'precio_plan', (select precio from public.gym_planes where id = s.plan_id),
      'pagos', coalesce((select jsonb_agg(jsonb_build_object('fecha', p.creado_en, 'monto', p.monto, 'concepto', case when p.pago_de is not null then 'Abono' else (select nombre from public.gym_planes where id = p.plan_id) end, 'hasta', p.hasta) order by p.creado_en desc)
        from (select * from public.gym_pagos where socio_id = s.id and anulado_en is null order by creado_en desc limit 6) p), '[]'))
    order by g.nombre), '[]')
  from public.gym_socios s join public.gyms g on g.id = s.gym_id and g.estado in ('prueba','activo','suspendido')
  where s.user_id = auth.uid() and s.activo $$;

-- ---------- Permisos ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like '\_gym%' or p.proname like 'gym\_%' or p.proname like 'socio\_%') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not like '\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
