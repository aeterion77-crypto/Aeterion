-- =====================================================================
-- Aeterion Gym · migración 005: software para gimnasios
-- Socios y vencimientos, pagos registrados (no se cobran en la app),
-- asistencia con QR, staff por rol (dueño, admin, recepción, coach),
-- planes por sede controlados por Aeterion. Solo objetos nuevos.
-- Cada gimnasio ve únicamente sus propios datos.
-- =====================================================================

create table public.gym_config (clave text primary key, valor jsonb not null, actualizado_en timestamptz not null default now());
insert into public.gym_config (clave, valor) values
  ('planes', '{"piloto":{"nombre":"Piloto","precio":999,"socios":150,"staff":3},"profesional":{"nombre":"Profesional","precio":1499,"socios":500,"staff":8},"avanzado":{"nombre":"Avanzado","precio":2499,"socios":2000,"staff":25}}'),
  ('reglas', '{"dias_gracia":7,"por_vencer_dias":7,"checkin_repetido_min":120}');

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 2 and 80),
  ciudad text check (char_length(ciudad) <= 80),
  telefono text check (char_length(telefono) <= 20),
  plan text not null default 'piloto' check (plan in ('piloto','profesional','avanzado')),
  sedes_max smallint not null default 1 check (sedes_max between 1 and 20),
  estado text not null default 'prueba' check (estado in ('prueba','activo','suspendido','baja')),
  pagado_hasta timestamptz,
  creado_en timestamptz not null default now()
);

create table public.gym_sedes (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  direccion text check (char_length(direccion) <= 160),
  activa boolean not null default true
);
create index gym_sedes_gym on public.gym_sedes (gym_id);

create table public.gym_staff (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rol text not null check (rol in ('dueno','admin','recepcion','coach')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (gym_id, user_id)
);
create index gym_staff_user on public.gym_staff (user_id) where activo;

create table public.gym_planes (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 50),
  precio numeric(10,2) not null check (precio >= 0 and precio <= 100000),
  dias smallint not null check (dias between 1 and 400),
  activo boolean not null default true
);
create index gym_planes_gym on public.gym_planes (gym_id);

create table public.gym_socios (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  sede_id bigint references public.gym_sedes (id) on delete set null,
  numero int not null,
  nombre text not null check (char_length(nombre) between 2 and 80),
  telefono text check (char_length(telefono) <= 20),
  email text check (char_length(email) <= 120),
  user_id uuid references auth.users (id) on delete set null,
  token text not null unique,
  codigo_vincular text not null unique,
  plan_id bigint references public.gym_planes (id) on delete set null,
  vence_en date,
  nota text check (char_length(nota) <= 300),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  baja_en timestamptz,
  unique (gym_id, numero)
);
create index gym_socios_gym on public.gym_socios (gym_id, activo);
create index gym_socios_user on public.gym_socios (user_id);

create table public.gym_pagos (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  socio_id bigint not null references public.gym_socios (id) on delete cascade,
  plan_id bigint references public.gym_planes (id) on delete set null,
  concepto text,
  monto numeric(10,2) not null check (monto >= 0 and monto <= 100000),
  metodo text not null check (metodo in ('efectivo','tarjeta','transferencia','otro')),
  desde date not null,
  hasta date not null,
  registrado_por uuid,
  creado_en timestamptz not null default now(),
  anulado_en timestamptz,
  anulado_por uuid,
  motivo text
);
create index gym_pagos_gym on public.gym_pagos (gym_id, creado_en);
create index gym_pagos_socio on public.gym_pagos (socio_id);

create table public.gym_asistencias (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  sede_id bigint references public.gym_sedes (id) on delete set null,
  socio_id bigint not null references public.gym_socios (id) on delete cascade,
  entrada timestamptz not null default now(),
  metodo text not null check (metodo in ('qr','numero','manual')),
  registrado_por uuid
);
create index gym_asis_gym on public.gym_asistencias (gym_id, entrada);
create index gym_asis_socio on public.gym_asistencias (socio_id, entrada);

alter table public.gym_config enable row level security;
alter table public.gyms enable row level security;
alter table public.gym_sedes enable row level security;
alter table public.gym_staff enable row level security;
alter table public.gym_planes enable row level security;
alter table public.gym_socios enable row level security;
alter table public.gym_pagos enable row level security;
alter table public.gym_asistencias enable row level security;
revoke all on public.gym_config, public.gyms, public.gym_sedes, public.gym_staff, public.gym_planes,
  public.gym_socios, public.gym_pagos, public.gym_asistencias from anon, authenticated;

-- ---------- Utilidades ----------
create or replace function public._gym_hoy() returns date language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;
create or replace function public._gym_regla(p text) returns numeric language sql stable security definer set search_path = public as $$
  select (valor ->> p)::numeric from public.gym_config where clave = 'reglas' $$;
create or replace function public._gym_plan(p_plan text) returns jsonb language sql stable security definer set search_path = public as $$
  select valor -> p_plan from public.gym_config where clave = 'planes' $$;
create or replace function public._gym_azar(n int) returns text language sql volatile as $$
  select upper(substr(translate(md5(random()::text || clock_timestamp()::text || random()::text), '01oil', ''), 1, n)) $$;

-- Rol del usuario en el gimnasio; exige que esté entre los permitidos
create or replace function public._gym_exigir(p_gym uuid, p_roles text[], p_escribe boolean default true) returns text
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid(); r text; g public.gyms;
begin
  if v is null then raise exception 'no_autenticado'; end if;
  select rol into r from public.gym_staff where gym_id = p_gym and user_id = v and activo;
  if r is null or not (r = any (p_roles)) then raise exception 'sin_permiso'; end if;
  select * into g from public.gyms where id = p_gym;
  if g.estado = 'baja' then raise exception 'gym_baja'; end if;
  if p_escribe and g.estado = 'suspendido' then raise exception 'gym_suspendido'; end if;
  return r;
end $$;

create or replace function public._gym_socio_json(s public.gym_socios) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'numero', s.numero, 'nombre', s.nombre, 'telefono', s.telefono, 'email', s.email,
    'vence_en', s.vence_en, 'activo', s.activo, 'nota', s.nota, 'sede_id', s.sede_id, 'vinculado', s.user_id is not null,
    'plan', (select nombre from public.gym_planes where id = s.plan_id), 'plan_id', s.plan_id,
    'estado', case when not s.activo then 'baja' when s.vence_en is null then 'sin_pago' when s.vence_en < public._gym_hoy() then 'vencido'
                   when s.vence_en < public._gym_hoy() + public._gym_regla('por_vencer_dias')::int then 'por_vencer' else 'al_corriente' end,
    'dias', case when s.vence_en is not null then s.vence_en - public._gym_hoy() end,
    'ultima', (select max(entrada) from public.gym_asistencias a where a.socio_id = s.id)) $$;

-- =====================================================================
-- STAFF
-- =====================================================================
create or replace function public.gym_mis() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nombre', g.nombre, 'rol', st.rol, 'plan', g.plan, 'estado', g.estado) order by g.nombre), '[]')
  from public.gym_staff st join public.gyms g on g.id = st.gym_id
  where st.user_id = auth.uid() and st.activo and g.estado <> 'baja' $$;

create or replace function public.gym_info(p_gym uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); g public.gyms;
begin
  select * into g from public.gyms where id = p_gym;
  return to_jsonb(g) || jsonb_build_object('rol', rol, 'plan_info', public._gym_plan(g.plan),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'direccion', direccion) order by id) from public.gym_sedes where gym_id = p_gym and activa), '[]'),
    'planes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'precio', precio, 'dias', dias) order by precio) from public.gym_planes where gym_id = p_gym and activo), '[]'),
    'socios_activos', (select count(*) from public.gym_socios where gym_id = p_gym and activo),
    'staff_activo', (select count(*) from public.gym_staff where gym_id = p_gym and activo));
end $$;

create or replace function public.gym_resumen(p_gym uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); hoy date := public._gym_hoy();
  pv int := public._gym_regla('por_vencer_dias')::int; dinero boolean := rol in ('dueno','admin','recepcion');
begin
  return jsonb_build_object(
    'rol', rol,
    'al_corriente', (select count(*) from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy),
    'por_vencer_n', (select count(*) from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy and vence_en < hoy + pv),
    'vencidos_n', (select count(*) from public.gym_socios where gym_id = p_gym and activo and (vence_en < hoy or vence_en is null)),
    'socios', (select count(*) from public.gym_socios where gym_id = p_gym and activo),
    'asistencias_hoy', (select count(*) from public.gym_asistencias where gym_id = p_gym and (entrada at time zone 'America/Mexico_City')::date = hoy),
    'asistencias_7', (select count(*) from public.gym_asistencias where gym_id = p_gym and entrada > now() - interval '7 days'),
    'altas_mes', (select count(*) from public.gym_socios where gym_id = p_gym and creado_en >= date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'),
    'ingresos_hoy', case when dinero then (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and (creado_en at time zone 'America/Mexico_City')::date = hoy) end,
    'ingresos_mes', case when dinero then (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and creado_en >= date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City') end,
    'por_vencer', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.vence_en) from (select * from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy and vence_en < hoy + pv order by vence_en limit 30) s), '[]'),
    'vencidos', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.vence_en desc) from (select * from public.gym_socios where gym_id = p_gym and activo and vence_en < hoy and vence_en >= hoy - 30 order by vence_en desc limit 30) s), '[]'),
    'entradas', coalesce((select jsonb_agg(jsonb_build_object('hora', a.entrada, 'nombre', s.nombre, 'numero', s.numero, 'metodo', a.metodo,
        'al_corriente', coalesce(s.vence_en >= hoy, false)) order by a.entrada desc)
       from (select * from public.gym_asistencias where gym_id = p_gym and (entrada at time zone 'America/Mexico_City')::date = hoy order by entrada desc limit 20) a
       join public.gym_socios s on s.id = a.socio_id), '[]'));
end $$;

create or replace function public.gym_socios_listar(p_gym uuid, p_filtro text default 'activos', p_busca text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); hoy date := public._gym_hoy(); pv int := public._gym_regla('por_vencer_dias')::int; b text := nullif(trim(p_busca), '');
begin
  return coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.nombre) from (
    select * from public.gym_socios s where s.gym_id = p_gym
      and case p_filtro when 'baja' then not s.activo
                        when 'al_corriente' then s.activo and s.vence_en >= hoy
                        when 'por_vencer' then s.activo and s.vence_en >= hoy and s.vence_en < hoy + pv
                        when 'vencidos' then s.activo and (s.vence_en < hoy or s.vence_en is null)
                        else s.activo end
      and (b is null or s.nombre ilike '%' || b || '%' or s.numero::text = b or coalesce(s.telefono, '') like '%' || b || '%')
    order by s.nombre limit 300) s), '[]');
end $$;

create or replace function public.gym_socio_guardar(p_gym uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion']); g public.gyms; s public.gym_socios; sid bigint := nullif(p ->> 'id', '')::bigint;
  nom text := left(trim(coalesce(p ->> 'nombre', '')), 80); tel text := nullif(left(regexp_replace(coalesce(p ->> 'telefono', ''), '[^0-9+]', '', 'g'), 20), '');
  mail text := nullif(lower(left(trim(coalesce(p ->> 'email', '')), 120)), ''); sede bigint := nullif(p ->> 'sede_id', '')::bigint; n int; tok text; cod text;
begin
  if char_length(nom) < 2 then raise exception 'falta_nombre'; end if;
  if mail is not null and mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_invalido'; end if;
  if sede is not null and not exists (select 1 from public.gym_sedes where id = sede and gym_id = p_gym) then raise exception 'sede_invalida'; end if;
  if sid is not null then
    update public.gym_socios set nombre = nom, telefono = tel, email = mail, sede_id = coalesce(sede, sede_id), nota = nullif(left(trim(coalesce(p ->> 'nota', '')), 300), '')
     where id = sid and gym_id = p_gym returning * into s;
    if s.id is null then raise exception 'socio_no_encontrado'; end if;
    return public._gym_socio_json(s);
  end if;
  select * into g from public.gyms where id = p_gym for update;
  if (select count(*) from public.gym_socios where gym_id = p_gym and activo) >= coalesce((public._gym_plan(g.plan) ->> 'socios')::int, 150) * g.sedes_max then raise exception 'limite_socios'; end if;
  select coalesce(max(numero), 0) + 1 into n from public.gym_socios where gym_id = p_gym;
  loop tok := lower(public._gym_azar(20)); exit when not exists (select 1 from public.gym_socios where token = tok); end loop;
  loop cod := public._gym_azar(6); exit when not exists (select 1 from public.gym_socios where codigo_vincular = cod); end loop;
  insert into public.gym_socios (gym_id, sede_id, numero, nombre, telefono, email, token, codigo_vincular, nota)
  values (p_gym, coalesce(sede, (select min(id) from public.gym_sedes where gym_id = p_gym and activa)), n, nom, tel, mail, tok, cod, nullif(left(trim(coalesce(p ->> 'nota', '')), 300), ''))
  returning * into s;
  return public._gym_socio_json(s);
end $$;

create or replace function public.gym_socio_detalle(p_gym uuid, p_socio bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); s public.gym_socios;
begin
  select * into s from public.gym_socios where id = p_socio and gym_id = p_gym;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  return public._gym_socio_json(s) || jsonb_build_object('codigo_vincular', s.codigo_vincular, 'creado_en', s.creado_en, 'token', case when rol <> 'coach' then s.token end,
    'pagos', case when rol in ('dueno','admin','recepcion') then coalesce((select jsonb_agg(jsonb_build_object('id', id, 'monto', monto, 'metodo', metodo, 'desde', desde, 'hasta', hasta,
        'fecha', creado_en, 'anulado', anulado_en is not null, 'motivo', motivo, 'plan', (select nombre from public.gym_planes where id = p.plan_id), 'concepto', concepto) order by creado_en desc)
       from (select * from public.gym_pagos where socio_id = p_socio order by creado_en desc limit 24) p), '[]') end,
    'asistencias', coalesce((select jsonb_agg(entrada order by entrada desc) from (select entrada from public.gym_asistencias where socio_id = p_socio order by entrada desc limit 30) a), '[]'),
    'asistencias_30', (select count(*) from public.gym_asistencias where socio_id = p_socio and entrada > now() - interval '30 days'));
end $$;

create or replace function public.gym_socio_baja(p_gym uuid, p_socio bigint, p_activo boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); s public.gym_socios;
begin
  update public.gym_socios set activo = p_activo, baja_en = case when p_activo then null else now() end where id = p_socio and gym_id = p_gym returning * into s;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  return public._gym_socio_json(s);
end $$;

-- Registrar un pago: extiende el vencimiento desde hoy o desde el vencimiento vigente
create or replace function public.gym_pago_registrar(p_gym uuid, p_socio bigint, p_plan bigint, p_monto numeric, p_metodo text, p_concepto text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion']); s public.gym_socios; pl public.gym_planes; d date; h date; hoy date := public._gym_hoy();
begin
  select * into s from public.gym_socios where id = p_socio and gym_id = p_gym and activo for update;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  select * into pl from public.gym_planes where id = p_plan and gym_id = p_gym and activo;
  if pl.id is null then raise exception 'plan_invalido'; end if;
  if p_monto is null or p_monto < 0 or p_monto > 100000 then raise exception 'monto_invalido'; end if;
  if p_metodo not in ('efectivo','tarjeta','transferencia','otro') then raise exception 'metodo_invalido'; end if;
  d := greatest(hoy, coalesce(s.vence_en + 1, hoy)); h := d + pl.dias - 1;
  insert into public.gym_pagos (gym_id, socio_id, plan_id, concepto, monto, metodo, desde, hasta, registrado_por)
  values (p_gym, p_socio, pl.id, nullif(left(trim(coalesce(p_concepto, '')), 80), ''), p_monto, p_metodo, d, h, auth.uid());
  update public.gym_socios set vence_en = h, plan_id = pl.id where id = p_socio returning * into s;
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
  update public.gym_socios set vence_en = (select max(hasta) from public.gym_pagos where socio_id = pg.socio_id and anulado_en is null)
   where id = pg.socio_id returning * into s;
  return public._gym_socio_json(s);
end $$;

create or replace function public.gym_caja(p_gym uuid, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion'], false); d date := coalesce(p_desde, public._gym_hoy()); h date := coalesce(p_hasta, public._gym_hoy());
begin
  if rol = 'recepcion' then d := greatest(d, public._gym_hoy() - 1); end if;   -- recepción solo ve hoy y ayer
  if h - d > 370 then raise exception 'rango_largo'; end if;
  return jsonb_build_object('desde', d, 'hasta', h,
    'total', (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and (creado_en at time zone 'America/Mexico_City')::date between d and h),
    'por_metodo', coalesce((select jsonb_object_agg(metodo, t) from (select metodo, sum(monto) t from public.gym_pagos where gym_id = p_gym and anulado_en is null and (creado_en at time zone 'America/Mexico_City')::date between d and h group by metodo) x), '{}'),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'fecha', p.creado_en, 'socio', s.nombre, 'numero', s.numero, 'socio_id', s.id, 'monto', p.monto, 'metodo', p.metodo,
        'plan', (select nombre from public.gym_planes where id = p.plan_id), 'anulado', p.anulado_en is not null, 'motivo', p.motivo) order by p.creado_en desc)
       from (select * from public.gym_pagos where gym_id = p_gym and (creado_en at time zone 'America/Mexico_City')::date between d and h order by creado_en desc limit 500) p
       join public.gym_socios s on s.id = p.socio_id), '[]'));
end $$;

-- Entrada al gimnasio: por QR (token) o por número de socio
create or replace function public.gym_checkin(p_gym uuid, p_sede bigint, p_dato text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach']); s public.gym_socios; d text := trim(coalesce(p_dato, '')); met text; prev timestamptz; hoy date := public._gym_hoy();
begin
  if d ~ '^[0-9]{1,7}$' then select * into s from public.gym_socios where gym_id = p_gym and numero = d::int; met := 'numero';
  else d := lower(regexp_replace(d, '^aet-gym:', '', 'i')); select * into s from public.gym_socios where gym_id = p_gym and token = d; met := 'qr'; end if;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  if not s.activo then return jsonb_build_object('ok', false, 'motivo', 'baja', 'socio', public._gym_socio_json(s)); end if;
  select max(entrada) into prev from public.gym_asistencias where socio_id = s.id;
  if prev is not null and prev > now() - make_interval(mins => public._gym_regla('checkin_repetido_min')::int) then
    return jsonb_build_object('ok', true, 'repetido', true, 'socio', public._gym_socio_json(s));
  end if;
  insert into public.gym_asistencias (gym_id, sede_id, socio_id, metodo, registrado_por)
  values (p_gym, case when p_sede is not null and exists (select 1 from public.gym_sedes where id = p_sede and gym_id = p_gym) then p_sede else s.sede_id end, s.id, met, auth.uid());
  return jsonb_build_object('ok', true, 'repetido', false, 'al_corriente', coalesce(s.vence_en >= hoy, false), 'socio', public._gym_socio_json(s));
end $$;

-- ---------- Planes que el gimnasio vende a sus socios ----------
create or replace function public.gym_plan_guardar(p_gym uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); pid bigint := nullif(p ->> 'id', '')::bigint;
begin
  if char_length(trim(coalesce(p ->> 'nombre', ''))) < 2 then raise exception 'falta_nombre'; end if;
  if (p ->> 'dias') !~ '^[0-9]{1,3}$' or (p ->> 'dias')::int not between 1 and 400 then raise exception 'dias_invalidos'; end if;
  if (p ->> 'precio') !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' then raise exception 'monto_invalido'; end if;
  if pid is null then
    if (select count(*) from public.gym_planes where gym_id = p_gym and activo) >= 20 then raise exception 'demasiados_planes'; end if;
    insert into public.gym_planes (gym_id, nombre, precio, dias) values (p_gym, left(trim(p ->> 'nombre'), 50), (p ->> 'precio')::numeric, (p ->> 'dias')::int);
  else
    update public.gym_planes set nombre = left(trim(p ->> 'nombre'), 50), precio = (p ->> 'precio')::numeric, dias = (p ->> 'dias')::int,
      activo = coalesce((p ->> 'activo')::boolean, true) where id = pid and gym_id = p_gym;
    if not found then raise exception 'plan_invalido'; end if;
  end if;
  return public.gym_info(p_gym);
end $$;

create or replace function public.gym_sede_guardar(p_gym uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno']); g public.gyms; sid bigint := nullif(p ->> 'id', '')::bigint;
begin
  if char_length(trim(coalesce(p ->> 'nombre', ''))) < 2 then raise exception 'falta_nombre'; end if;
  select * into g from public.gyms where id = p_gym;
  if sid is null then
    if (select count(*) from public.gym_sedes where gym_id = p_gym and activa) >= g.sedes_max then raise exception 'limite_sedes'; end if;
    insert into public.gym_sedes (gym_id, nombre, direccion) values (p_gym, left(trim(p ->> 'nombre'), 60), nullif(left(trim(coalesce(p ->> 'direccion', '')), 160), ''));
  else
    update public.gym_sedes set nombre = left(trim(p ->> 'nombre'), 60), direccion = nullif(left(trim(coalesce(p ->> 'direccion', '')), 160), '') where id = sid and gym_id = p_gym;
  end if;
  return public.gym_info(p_gym);
end $$;

-- ---------- Equipo ----------
create or replace function public.gym_staff_listar(p_gym uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin'], false);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'rol', st.rol, 'activo', st.activo, 'email', u.email,
      'nombre', coalesce(nullif(pf.nombre, ''), split_part(u.email, '@', 1)), 'yo', st.user_id = auth.uid(),
      'coach_aeterion', exists (select 1 from public.coaches c where c.user_id = st.user_id and c.estado = 'activo')) order by st.activo desc, st.rol, st.creado_en)
    from public.gym_staff st join auth.users u on u.id = st.user_id left join public.perfiles pf on pf.id = st.user_id
    where st.gym_id = p_gym), '[]');
end $$;

create or replace function public.gym_staff_agregar(p_gym uuid, p_email text, p_rol text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); g public.gyms; u uuid;
begin
  if p_rol not in ('admin','recepcion','coach') then raise exception 'rol_invalido'; end if;
  if rol = 'admin' and p_rol = 'admin' then raise exception 'sin_permiso'; end if;
  select id into u from auth.users where lower(email) = lower(trim(p_email));
  if u is null then raise exception 'cuenta_no_encontrada'; end if;
  select * into g from public.gyms where id = p_gym;
  if (select count(*) from public.gym_staff where gym_id = p_gym and activo) >= coalesce((public._gym_plan(g.plan) ->> 'staff')::int, 3) * g.sedes_max
     and not exists (select 1 from public.gym_staff where gym_id = p_gym and user_id = u and activo) then raise exception 'limite_staff'; end if;
  insert into public.gym_staff (gym_id, user_id, rol) values (p_gym, u, p_rol)
  on conflict (gym_id, user_id) do update set rol = case when public.gym_staff.rol = 'dueno' then 'dueno' else excluded.rol end, activo = true;
  return public.gym_staff_listar(p_gym);
end $$;

create or replace function public.gym_staff_quitar(p_gym uuid, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); st public.gym_staff;
begin
  select * into st from public.gym_staff where id = p_id and gym_id = p_gym;
  if st.id is null then raise exception 'no_encontrado'; end if;
  if st.rol = 'dueno' or st.user_id = auth.uid() then raise exception 'sin_permiso'; end if;
  if rol = 'admin' and st.rol = 'admin' then raise exception 'sin_permiso'; end if;
  update public.gym_staff set activo = false where id = p_id;
  return public.gym_staff_listar(p_gym);
end $$;

-- =====================================================================
-- SOCIO (en su app)
-- =====================================================================
create or replace function public.socio_vincular(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); s public.gym_socios;
begin
  if v is null then raise exception 'no_autenticado'; end if;
  select * into s from public.gym_socios where codigo_vincular = upper(trim(p_codigo)) and activo for update;
  if s.id is null then raise exception 'codigo_invalido'; end if;
  if s.user_id is not null and s.user_id <> v then raise exception 'codigo_usado'; end if;
  update public.gym_socios set user_id = v where id = s.id;
  return public.socio_mio();
end $$;

create or replace function public.socio_mio() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._gym_socio_json(s) || jsonb_build_object('gym', g.nombre, 'token', s.token,
      'sede', (select nombre from public.gym_sedes where id = s.sede_id),
      'asistencias_30', (select count(*) from public.gym_asistencias a where a.socio_id = s.id and a.entrada > now() - interval '30 days'))
    order by g.nombre), '[]')
  from public.gym_socios s join public.gyms g on g.id = s.gym_id and g.estado in ('prueba','activo','suspendido')
  where s.user_id = auth.uid() and s.activo $$;

create or replace function public.socio_desvincular(p_socio bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.gym_socios set user_id = null where id = p_socio and user_id = auth.uid();
  if not found then raise exception 'socio_no_encontrado'; end if;
  return public.socio_mio();
end $$;

-- Una sola consulta al abrir la app: ¿es staff de algún gym o socio vinculado?
create or replace function public.gym_estado() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('gyms', public.gym_mis(), 'socio', public.socio_mio(),
    'abierto', exists (select 1 from public.gyms where estado = 'activo')) $$;

-- =====================================================================
-- ADMIN DE AETERION
-- =====================================================================
create or replace function public.admin_gyms() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  return jsonb_build_object('config', (select jsonb_object_agg(clave, valor) from public.gym_config),
    'lista', coalesce((select jsonb_agg(to_jsonb(g) || jsonb_build_object(
        'dueno', (select u.email from public.gym_staff st join auth.users u on u.id = st.user_id where st.gym_id = g.id and st.rol = 'dueno' and st.activo limit 1),
        'socios', (select count(*) from public.gym_socios where gym_id = g.id and activo),
        'al_corriente', (select count(*) from public.gym_socios where gym_id = g.id and activo and vence_en >= public._gym_hoy()),
        'staff', (select count(*) from public.gym_staff where gym_id = g.id and activo),
        'asistencias_30', (select count(*) from public.gym_asistencias where gym_id = g.id and entrada > now() - interval '30 days')) order by g.creado_en desc)
      from public.gyms g where g.estado <> 'baja'), '[]'));
end $$;

-- p: { id?, nombre, ciudad, telefono, plan, sedes_max, estado, pagado_hasta, dueno_email }
create or replace function public.admin_gym_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g public.gyms; gid uuid := nullif(p ->> 'id', '')::uuid; u uuid;
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  if char_length(trim(coalesce(p ->> 'nombre', ''))) < 2 then raise exception 'falta_nombre'; end if;
  if nullif(p ->> 'dueno_email', '') is not null then
    select id into u from auth.users where lower(email) = lower(trim(p ->> 'dueno_email'));
    if u is null then raise exception 'cuenta_no_encontrada'; end if;
  end if;
  if gid is null then
    if u is null then raise exception 'falta_dueno'; end if;
    insert into public.gyms (nombre, ciudad, telefono, plan, sedes_max, estado, pagado_hasta)
    values (left(trim(p ->> 'nombre'), 80), nullif(left(trim(coalesce(p ->> 'ciudad', '')), 80), ''), nullif(left(trim(coalesce(p ->> 'telefono', '')), 20), ''),
      coalesce(nullif(p ->> 'plan', ''), 'piloto'), coalesce(nullif(p ->> 'sedes_max', '')::int, 1), coalesce(nullif(p ->> 'estado', ''), 'prueba'), nullif(p ->> 'pagado_hasta', '')::timestamptz)
    returning * into g;
    insert into public.gym_sedes (gym_id, nombre) values (g.id, 'Principal');
    insert into public.gym_planes (gym_id, nombre, precio, dias) values (g.id, 'Mensual', 0, 30);
  else
    update public.gyms set nombre = left(trim(p ->> 'nombre'), 80), ciudad = nullif(left(trim(coalesce(p ->> 'ciudad', '')), 80), ''),
      telefono = nullif(left(trim(coalesce(p ->> 'telefono', '')), 20), ''), plan = coalesce(nullif(p ->> 'plan', ''), plan),
      sedes_max = coalesce(nullif(p ->> 'sedes_max', '')::int, sedes_max), estado = coalesce(nullif(p ->> 'estado', ''), estado),
      pagado_hasta = case when p ? 'pagado_hasta' then nullif(p ->> 'pagado_hasta', '')::timestamptz else pagado_hasta end
     where id = gid returning * into g;
    if g.id is null then raise exception 'gym_no_encontrado'; end if;
  end if;
  if u is not null then
    update public.gym_staff set rol = 'admin' where gym_id = g.id and rol = 'dueno' and user_id <> u;
    insert into public.gym_staff (gym_id, user_id, rol) values (g.id, u, 'dueno')
    on conflict (gym_id, user_id) do update set rol = 'dueno', activo = true;
  end if;
  return public.admin_gyms();
end $$;

create or replace function public.admin_gym_config(p_planes jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  if jsonb_typeof(p_planes) <> 'object' or not (p_planes ? 'piloto' and p_planes ? 'profesional' and p_planes ? 'avanzado') then raise exception 'valor_invalido'; end if;
  update public.gym_config set valor = p_planes, actualizado_en = now() where clave = 'planes';
  return public.admin_gyms();
end $$;

-- ---------- Permisos de ejecución ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like '\_gym%' or p.proname like 'gym\_%' or p.proname like 'socio\_%' or p.proname in ('admin_gyms','admin_gym_guardar','admin_gym_config')) loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not like '\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
