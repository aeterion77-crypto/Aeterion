-- =====================================================================
-- Aeterion Gym · migración 009 «Pro»: control de accesos (denegados),
-- congelar membresías, datos extra del socio, color por plan, marca del
-- gimnasio (logo, color, tema), panel con comparativos y actividad,
-- bitácora de accesos, pagos y deudores, membresías y notificaciones.
-- Solo toca objetos de Aeterion Gym.
-- =====================================================================

alter table public.gym_socios add column fecha_nac date check (fecha_nac is null or fecha_nac between '1900-01-01' and '2100-01-01');
alter table public.gym_socios add column emergencia text check (char_length(emergencia) <= 120);
alter table public.gym_socios add column congelado_hasta date;
alter table public.gym_planes add column color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

create table public.gym_accesos_denegados (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  socio_id bigint not null references public.gym_socios (id) on delete cascade,
  motivo text not null check (motivo in ('vencido','sin_pago','baja','congelado')),
  intento timestamptz not null default now(),
  registrado_por uuid
);
create index gym_acc_den_gym on public.gym_accesos_denegados (gym_id, intento);

create table public.gym_congelaciones (
  id bigserial primary key,
  gym_id uuid not null references public.gyms (id) on delete cascade,
  socio_id bigint not null references public.gym_socios (id) on delete cascade,
  desde date not null,
  hasta date not null,
  dias int not null check (dias between 1 and 90),
  motivo text check (char_length(motivo) <= 160),
  terminada_en timestamptz,
  por uuid,
  creado_en timestamptz not null default now()
);
create index gym_cong_socio on public.gym_congelaciones (socio_id);

alter table public.gym_accesos_denegados enable row level security;
alter table public.gym_congelaciones enable row level security;
revoke all on public.gym_accesos_denegados, public.gym_congelaciones from anon, authenticated;

-- Días de aviso «por vencer» configurables por gimnasio
create or replace function public._gym_aviso(p_gym uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(ajustes ->> 'aviso_dias', '')::int from public.gyms where id = p_gym), public._gym_regla('por_vencer_dias')::int, 7) $$;

create or replace function public._gym_socio_json(s public.gym_socios) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'numero', s.numero, 'nombre', s.nombre, 'telefono', s.telefono, 'email', s.email,
    'vence_en', s.vence_en, 'activo', s.activo, 'nota', s.nota, 'sede_id', s.sede_id, 'vinculado', s.user_id is not null,
    'plan', (select nombre from public.gym_planes where id = s.plan_id), 'plan_id', s.plan_id, 'plan_color', (select color from public.gym_planes where id = s.plan_id),
    'tiene_foto', s.foto is not null, 'saldo', public._gym_saldo(s.id),
    'fecha_nac', s.fecha_nac, 'emergencia', s.emergencia, 'congelado_hasta', case when s.congelado_hasta >= public._gym_hoy() then s.congelado_hasta end,
    'creado_en', s.creado_en,
    'estado', case when not s.activo then 'baja'
                   when s.congelado_hasta >= public._gym_hoy() then 'congelado'
                   when s.vence_en is null then 'sin_pago' when s.vence_en < public._gym_hoy() then 'vencido'
                   when s.vence_en < public._gym_hoy() + public._gym_aviso(s.gym_id) then 'por_vencer' else 'al_corriente' end,
    'dias', case when s.vence_en is not null then s.vence_en - public._gym_hoy() end,
    'ultima', (select max(entrada) from public.gym_asistencias a where a.socio_id = s.id)) $$;

-- ---------- Alta y edición con datos extra ----------
create or replace function public.gym_socio_guardar(p_gym uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion']); g public.gyms; s public.gym_socios; sid bigint := nullif(p ->> 'id', '')::bigint;
  nom text := left(trim(coalesce(p ->> 'nombre', '')), 80); tel text := nullif(left(regexp_replace(coalesce(p ->> 'telefono', ''), '[^0-9+]', '', 'g'), 20), '');
  mail text := nullif(lower(left(trim(coalesce(p ->> 'email', '')), 120)), ''); sede bigint := nullif(p ->> 'sede_id', '')::bigint; n int; tok text; cod text;
  fn date; em text := nullif(left(trim(coalesce(p ->> 'emergencia', '')), 120), '');
begin
  if char_length(nom) < 2 then raise exception 'falta_nombre'; end if;
  if mail is not null and mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_invalido'; end if;
  begin fn := nullif(p ->> 'fecha_nac', '')::date; exception when others then raise exception 'fecha_invalida'; end;
  if fn is not null and (fn < '1900-01-01' or fn > public._gym_hoy()) then raise exception 'fecha_invalida'; end if;
  if sede is not null and not exists (select 1 from public.gym_sedes where id = sede and gym_id = p_gym) then raise exception 'sede_invalida'; end if;
  if sid is not null then
    update public.gym_socios set nombre = nom, telefono = tel, email = mail, sede_id = coalesce(sede, sede_id), nota = nullif(left(trim(coalesce(p ->> 'nota', '')), 300), ''),
      fecha_nac = case when p ? 'fecha_nac' then fn else fecha_nac end, emergencia = case when p ? 'emergencia' then em else emergencia end
     where id = sid and gym_id = p_gym returning * into s;
    if s.id is null then raise exception 'socio_no_encontrado'; end if;
    return public._gym_socio_json(s);
  end if;
  select * into g from public.gyms where id = p_gym for update;
  if (select count(*) from public.gym_socios where gym_id = p_gym and activo) >= coalesce((public._gym_plan(g.plan) ->> 'socios')::int, 150) * g.sedes_max then raise exception 'limite_socios'; end if;
  select coalesce(max(numero), 0) + 1 into n from public.gym_socios where gym_id = p_gym;
  loop tok := lower(public._gym_azar(20)); exit when not exists (select 1 from public.gym_socios where token = tok); end loop;
  loop cod := public._gym_azar(6); exit when not exists (select 1 from public.gym_socios where codigo_vincular = cod); end loop;
  insert into public.gym_socios (gym_id, sede_id, numero, nombre, telefono, email, token, codigo_vincular, nota, fecha_nac, emergencia)
  values (p_gym, coalesce(sede, (select min(id) from public.gym_sedes where gym_id = p_gym and activa)), n, nom, tel, mail, tok, cod, nullif(left(trim(coalesce(p ->> 'nota', '')), 300), ''), fn, em)
  returning * into s;
  return public._gym_socio_json(s);
end $$;

-- ---------- Planes con color ----------
create or replace function public.gym_plan_guardar(p_gym uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); pid bigint := nullif(p ->> 'id', '')::bigint; col text := nullif(p ->> 'color', '');
begin
  if char_length(trim(coalesce(p ->> 'nombre', ''))) < 2 then raise exception 'falta_nombre'; end if;
  if (p ->> 'dias') !~ '^[0-9]{1,3}$' or (p ->> 'dias')::int not between 1 and 400 then raise exception 'dias_invalidos'; end if;
  if (p ->> 'precio') !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' then raise exception 'monto_invalido'; end if;
  if col is not null and col !~ '^#[0-9a-fA-F]{6}$' then raise exception 'color_invalido'; end if;
  if pid is null then
    if (select count(*) from public.gym_planes where gym_id = p_gym and activo) >= 20 then raise exception 'demasiados_planes'; end if;
    insert into public.gym_planes (gym_id, nombre, precio, dias, color) values (p_gym, left(trim(p ->> 'nombre'), 50), (p ->> 'precio')::numeric, (p ->> 'dias')::int, col);
  else
    update public.gym_planes set nombre = left(trim(p ->> 'nombre'), 50), precio = (p ->> 'precio')::numeric, dias = (p ->> 'dias')::int,
      color = coalesce(col, color), activo = coalesce((p ->> 'activo')::boolean, true) where id = pid and gym_id = p_gym;
    if not found then raise exception 'plan_invalido'; end if;
  end if;
  return public.gym_info(p_gym);
end $$;

create or replace function public.gym_info(p_gym uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); g public.gyms;
begin
  select * into g from public.gyms where id = p_gym;
  return to_jsonb(g) || jsonb_build_object('rol', rol, 'plan_info', public._gym_plan(g.plan), 'aviso_dias', public._gym_aviso(p_gym),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'direccion', direccion) order by id) from public.gym_sedes where gym_id = p_gym and activa), '[]'),
    'planes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'precio', precio, 'dias', dias, 'color', color) order by precio) from public.gym_planes where gym_id = p_gym and activo), '[]'),
    'socios_activos', (select count(*) from public.gym_socios where gym_id = p_gym and activo),
    'staff_activo', (select count(*) from public.gym_staff where gym_id = p_gym and activo));
end $$;

-- ---------- Marca y configuración ----------
create or replace function public.gym_ajustes_guardar(p_gym uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); a jsonb; actual jsonb; logo text;
begin
  select ajustes into actual from public.gyms where id = p_gym;
  logo := case when p ? 'logo' then nullif(p ->> 'logo', '') else actual ->> 'logo' end;
  if logo is not null and (char_length(logo) > 150000 or logo not like 'data:image/%') then raise exception 'foto_invalida'; end if;
  if nullif(p ->> 'color', '') is not null and (p ->> 'color') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'color_invalido'; end if;
  if nullif(p ->> 'aviso_dias', '') is not null and ((p ->> 'aviso_dias') !~ '^[0-9]{1,2}$' or (p ->> 'aviso_dias')::int not between 1 and 30) then raise exception 'dias_invalidos'; end if;
  a := jsonb_build_object(
    'ticket_ancho', case when coalesce(p ->> 'ticket_ancho', actual ->> 'ticket_ancho') in ('58','80') then coalesce(p ->> 'ticket_ancho', actual ->> 'ticket_ancho')::int else 80 end,
    'ticket_encabezado', left(coalesce(p ->> 'ticket_encabezado', actual ->> 'ticket_encabezado', ''), 200),
    'ticket_pie', left(coalesce(p ->> 'ticket_pie', actual ->> 'ticket_pie', ''), 200),
    'direccion', left(coalesce(p ->> 'direccion', actual ->> 'direccion', ''), 160),
    'telefono', left(regexp_replace(coalesce(p ->> 'telefono', actual ->> 'telefono', ''), '[^0-9+ ]', '', 'g'), 20),
    'rfc', left(upper(coalesce(p ->> 'rfc', actual ->> 'rfc', '')), 13),
    'politica_vencidos', case when coalesce(p ->> 'politica_vencidos', actual ->> 'politica_vencidos') in ('avisar','bloquear') then coalesce(p ->> 'politica_vencidos', actual ->> 'politica_vencidos') else 'avisar' end,
    'color', coalesce(nullif(p ->> 'color', ''), actual ->> 'color', '#c9a84c'),
    'tema', case when coalesce(p ->> 'tema', actual ->> 'tema') in ('oscuro','claro') then coalesce(p ->> 'tema', actual ->> 'tema') else 'oscuro' end,
    'aviso_dias', coalesce(nullif(p ->> 'aviso_dias', '')::int, nullif(actual ->> 'aviso_dias', '')::int, 7),
    'logo', logo);
  update public.gyms set ajustes = a where id = p_gym;
  return public.gym_info(p_gym);
end $$;

-- ---------- Entrada con control ----------
create or replace function public.gym_checkin(p_gym uuid, p_sede bigint, p_dato text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach']); s public.gym_socios; d text := trim(coalesce(p_dato, '')); met text; prev timestamptz;
  hoy date := public._gym_hoy(); pol text; mot text; j jsonb;
begin
  if d ~ '^[0-9]{1,7}$' then select * into s from public.gym_socios where gym_id = p_gym and numero = d::int; met := 'numero';
  else d := lower(regexp_replace(d, '^aet-gym:', '', 'i')); select * into s from public.gym_socios where gym_id = p_gym and token = d; met := 'qr'; end if;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  j := public._gym_socio_json(s) || jsonb_build_object('foto', s.foto);
  select coalesce(ajustes ->> 'politica_vencidos', 'avisar') into pol from public.gyms where id = p_gym;
  mot := case when not s.activo then 'baja' when s.congelado_hasta >= hoy then 'congelado'
              when pol = 'bloquear' and s.vence_en is null then 'sin_pago' when pol = 'bloquear' and s.vence_en < hoy then 'vencido' end;
  if mot is not null then
    insert into public.gym_accesos_denegados (gym_id, socio_id, motivo, registrado_por) values (p_gym, s.id, mot, auth.uid());
    return jsonb_build_object('ok', false, 'motivo', mot, 'socio', j);
  end if;
  select max(entrada) into prev from public.gym_asistencias where socio_id = s.id;
  if prev is not null and prev > now() - make_interval(mins => public._gym_regla('checkin_repetido_min')::int) then
    return jsonb_build_object('ok', true, 'repetido', true, 'socio', j);
  end if;
  insert into public.gym_asistencias (gym_id, sede_id, socio_id, metodo, registrado_por)
  values (p_gym, case when p_sede is not null and exists (select 1 from public.gym_sedes where id = p_sede and gym_id = p_gym) then p_sede else s.sede_id end, s.id, met, auth.uid());
  return jsonb_build_object('ok', true, 'repetido', false, 'al_corriente', coalesce(s.vence_en >= hoy, false), 'socio', j);
end $$;

-- ---------- Congelar membresía ----------
create or replace function public.gym_socio_congelar(p_gym uuid, p_socio bigint, p_dias int, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); s public.gym_socios; hoy date := public._gym_hoy();
begin
  if p_dias is null or p_dias not between 1 and 90 then raise exception 'dias_invalidos'; end if;
  select * into s from public.gym_socios where id = p_socio and gym_id = p_gym and activo for update;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  if s.vence_en is null or s.vence_en < hoy then raise exception 'no_vigente'; end if;
  if s.congelado_hasta >= hoy then raise exception 'ya_congelado'; end if;
  insert into public.gym_congelaciones (gym_id, socio_id, desde, hasta, dias, motivo, por) values (p_gym, s.id, hoy, hoy + p_dias - 1, p_dias, nullif(left(trim(coalesce(p_motivo, '')), 160), ''), auth.uid());
  update public.gym_socios set congelado_hasta = hoy + p_dias - 1, vence_en = vence_en + p_dias where id = s.id returning * into s;
  return public._gym_socio_json(s);
end $$;

create or replace function public.gym_socio_descongelar(p_gym uuid, p_socio bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin']); s public.gym_socios; hoy date := public._gym_hoy(); resto int;
begin
  select * into s from public.gym_socios where id = p_socio and gym_id = p_gym for update;
  if s.id is null then raise exception 'socio_no_encontrado'; end if;
  if s.congelado_hasta is null or s.congelado_hasta < hoy then raise exception 'no_congelado'; end if;
  resto := s.congelado_hasta - hoy + 1;   -- días que no usó: se le quitan del vencimiento
  update public.gym_congelaciones set terminada_en = now() where socio_id = s.id and terminada_en is null and hasta >= hoy;
  update public.gym_socios set congelado_hasta = null, vence_en = vence_en - resto where id = s.id returning * into s;
  return public._gym_socio_json(s);
end $$;

-- ---------- Panel con comparativos ----------
create or replace function public.gym_panel(p_gym uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); hoy date := public._gym_hoy(); pv int := public._gym_aviso(p_gym);
  dinero boolean := rol in ('dueno','admin','recepcion'); tz text := 'America/Mexico_City';
  mes timestamptz := date_trunc('month', now() at time zone tz) at time zone tz; mes_ant timestamptz := (date_trunc('month', now() at time zone tz) - interval '1 month') at time zone tz;
  ant_fin timestamptz; hoy_ini timestamptz := hoy::timestamp at time zone tz;
begin
  ant_fin := mes_ant + (now() - mes);
  return jsonb_build_object(
    'rol', rol, 'aviso_dias', pv,
    'socios', (select count(*) from public.gym_socios where gym_id = p_gym and activo),
    'socios_antes', (select count(*) from public.gym_socios where gym_id = p_gym and creado_en < now() - interval '30 days' and (activo or baja_en >= now() - interval '30 days')),
    'vigentes', (select count(*) from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy),
    'vigentes_antes', (select count(distinct socio_id) from public.gym_pagos where gym_id = p_gym and anulado_en is null and pago_de is null and desde <= hoy - 30 and hasta >= hoy - 30),
    'asis_hoy', (select count(*) from public.gym_asistencias where gym_id = p_gym and entrada >= hoy_ini),
    'asis_ayer', (select count(*) from public.gym_asistencias where gym_id = p_gym and entrada >= hoy_ini - interval '1 day' and entrada < now() - interval '1 day'),
    'denegados_hoy', (select count(*) from public.gym_accesos_denegados where gym_id = p_gym and intento >= hoy_ini),
    'ingresos_mes', case when dinero then (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and creado_en >= mes)
      + (select coalesce(sum(total), 0) from public.gym_ventas where gym_id = p_gym and cancelada_en is null and creado_en >= mes) end,
    'ingresos_ant', case when dinero then (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and creado_en >= mes_ant and creado_en < ant_fin)
      + (select coalesce(sum(total), 0) from public.gym_ventas where gym_id = p_gym and cancelada_en is null and creado_en >= mes_ant and creado_en < ant_fin) end,
    'ingresos_hoy', case when dinero then (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and creado_en >= hoy_ini)
      + (select coalesce(sum(total), 0) from public.gym_ventas where gym_id = p_gym and cancelada_en is null and creado_en >= hoy_ini) end,
    'por_vencer_n', (select count(*) from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy and vence_en < hoy + pv),
    'vencidos_n', (select count(*) from public.gym_socios where gym_id = p_gym and activo and (vence_en < hoy or vence_en is null)),
    'con_saldo', case when dinero then (select count(*) from public.gym_socios s where gym_id = p_gym and activo and public._gym_saldo(s.id) > 0) end,
    'stock_bajo', case when dinero then (select count(*) from public.gym_productos where gym_id = p_gym and activo and existencia <= minimo) end,
    'cumple_hoy', (select count(*) from public.gym_socios where gym_id = p_gym and activo and to_char(fecha_nac, 'MM-DD') = to_char(hoy, 'MM-DD')),
    'altas_mes', (select count(*) from public.gym_socios where gym_id = p_gym and creado_en >= mes),
    'serie_asis', (select jsonb_agg(jsonb_build_object('d', z.d, 'n', (select count(*) from public.gym_asistencias a where a.gym_id = p_gym and (a.entrada at time zone tz)::date = z.d)) order by z.d)
       from (select (hoy - i) d from generate_series(0, 6) i) z),
    'serie_ing', case when dinero then (select jsonb_agg(jsonb_build_object('d', z.d,
        'm', (select coalesce(sum(monto), 0) from public.gym_pagos p where p.gym_id = p_gym and p.anulado_en is null and (p.creado_en at time zone tz)::date = z.d),
        'v', (select coalesce(sum(total), 0) from public.gym_ventas v where v.gym_id = p_gym and v.cancelada_en is null and (v.creado_en at time zone tz)::date = z.d)) order by z.d)
       from (select (hoy - i) d from generate_series(0, 29) i) z) end,
    'membresias', coalesce((select jsonb_agg(jsonb_build_object('plan', coalesce(p.nombre, 'Sin plan'), 'color', p.color, 'n', c) order by c desc)
       from (select plan_id, count(*) c from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy group by plan_id) x left join public.gym_planes p on p.id = x.plan_id), '[]'),
    'actividad', coalesce((select jsonb_agg(e order by (e ->> 'f') desc) from (
        (select jsonb_build_object('t', 'entrada', 'f', a.entrada, 'nombre', s.nombre, 'socio_id', s.id, 'numero', s.numero) e from public.gym_asistencias a join public.gym_socios s on s.id = a.socio_id where a.gym_id = p_gym order by a.entrada desc limit 12)
        union all (select jsonb_build_object('t', 'denegado', 'f', d.intento, 'nombre', s.nombre, 'socio_id', s.id, 'numero', s.numero, 'motivo', d.motivo) from public.gym_accesos_denegados d join public.gym_socios s on s.id = d.socio_id where d.gym_id = p_gym order by d.intento desc limit 6)
        union all (select jsonb_build_object('t', case when p.pago_de is not null then 'abono' else 'pago' end, 'f', p.creado_en, 'nombre', s.nombre, 'socio_id', s.id, 'numero', s.numero,
            'monto', case when dinero then p.monto end, 'plan', (select nombre from public.gym_planes where id = p.plan_id)) from public.gym_pagos p join public.gym_socios s on s.id = p.socio_id where p.gym_id = p_gym and p.anulado_en is null order by p.creado_en desc limit 8)
        union all (select jsonb_build_object('t', 'venta', 'f', v.creado_en, 'nombre', s.nombre, 'socio_id', s.id, 'folio', v.folio, 'venta_id', v.id, 'monto', case when dinero then v.total end) from public.gym_ventas v left join public.gym_socios s on s.id = v.socio_id where v.gym_id = p_gym and v.cancelada_en is null order by v.creado_en desc limit 6)
        union all (select jsonb_build_object('t', 'alta', 'f', s.creado_en, 'nombre', s.nombre, 'socio_id', s.id, 'numero', s.numero) from public.gym_socios s where s.gym_id = p_gym order by s.creado_en desc limit 6)
      ) q limit 14), '[]'),
    'ultimos', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.creado_en desc) from (select * from public.gym_socios where gym_id = p_gym order by creado_en desc limit 8) s), '[]'),
    'por_vencer', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.vence_en) from (select * from public.gym_socios where gym_id = p_gym and activo and vence_en >= hoy and vence_en < hoy + pv order by vence_en limit 12) s), '[]'));
end $$;

-- ---------- Bitácora de accesos ----------
create or replace function public.gym_accesos(p_gym uuid, p_dia date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); d date := coalesce(p_dia, public._gym_hoy()); tz text := 'America/Mexico_City';
begin
  if d > public._gym_hoy() or d < public._gym_hoy() - 400 then raise exception 'rango_invalido'; end if;
  return jsonb_build_object('dia', d,
    'permitidos', (select count(*) from public.gym_asistencias where gym_id = p_gym and (entrada at time zone tz)::date = d),
    'unicos', (select count(distinct socio_id) from public.gym_asistencias where gym_id = p_gym and (entrada at time zone tz)::date = d),
    'denegados', (select count(*) from public.gym_accesos_denegados where gym_id = p_gym and (intento at time zone tz)::date = d),
    'por_hora', (select jsonb_agg((select count(*) from public.gym_asistencias a where a.gym_id = p_gym and (a.entrada at time zone tz)::date = d and extract(hour from a.entrada at time zone tz) = h) order by h) from generate_series(0, 23) h),
    'lista', coalesce((select jsonb_agg(x order by (x ->> 'f') desc) from (
        select jsonb_build_object('f', a.entrada, 'ok', true, 'nombre', s.nombre, 'numero', s.numero, 'socio_id', s.id, 'metodo', a.metodo, 'plan', (select nombre from public.gym_planes where id = s.plan_id),
          'vence_en', s.vence_en, 'al_corriente', coalesce(s.vence_en >= d, false)) x
          from public.gym_asistencias a join public.gym_socios s on s.id = a.socio_id where a.gym_id = p_gym and (a.entrada at time zone tz)::date = d
        union all
        select jsonb_build_object('f', n.intento, 'ok', false, 'nombre', s.nombre, 'numero', s.numero, 'socio_id', s.id, 'motivo', n.motivo, 'vence_en', s.vence_en)
          from public.gym_accesos_denegados n join public.gym_socios s on s.id = n.socio_id where n.gym_id = p_gym and (n.intento at time zone tz)::date = d
        limit 800) q), '[]'));
end $$;

-- ---------- Pagos y deudores ----------
create or replace function public.gym_pagos_listar(p_gym uuid, p_desde date, p_hasta date, p_metodo text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion'], false); d date := coalesce(p_desde, public._gym_hoy() - 29); h date := coalesce(p_hasta, public._gym_hoy()); tz text := 'America/Mexico_City';
begin
  if rol = 'recepcion' then d := greatest(d, public._gym_hoy() - 1); end if;
  if h - d > 370 then raise exception 'rango_largo'; end if;
  return jsonb_build_object('desde', d, 'hasta', h,
    'total', (select coalesce(sum(monto), 0) from public.gym_pagos where gym_id = p_gym and anulado_en is null and (creado_en at time zone tz)::date between d and h and (p_metodo is null or metodo = p_metodo)),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'fecha', p.creado_en, 'socio', s.nombre, 'numero', s.numero, 'socio_id', s.id,
        'concepto', case when p.pago_de is not null then 'Abono' else coalesce((select nombre from public.gym_planes where id = p.plan_id), p.concepto, 'Membresía') end,
        'total', coalesce(p.total, p.monto), 'monto', p.monto, 'metodo', p.metodo, 'desde', p.desde, 'hasta', p.hasta, 'anulado', p.anulado_en is not null, 'abono', p.pago_de is not null,
        'por', (select coalesce(nullif(pf.nombre, ''), split_part(u.email, '@', 1)) from auth.users u left join public.perfiles pf on pf.id = u.id where u.id = p.registrado_por)) order by p.creado_en desc)
       from (select * from public.gym_pagos where gym_id = p_gym and (creado_en at time zone tz)::date between d and h and (p_metodo is null or metodo = p_metodo) order by creado_en desc limit 500) p
       join public.gym_socios s on s.id = p.socio_id), '[]'),
    'deudores', coalesce((select jsonb_agg(x order by (x ->> 'saldo')::numeric desc) from (
        select public._gym_socio_json(s) x from public.gym_socios s where s.gym_id = p_gym and s.activo and public._gym_saldo(s.id) > 0 limit 200) q), '[]'));
end $$;

-- ---------- Membresías (planes con números) ----------
create or replace function public.gym_membresias(p_gym uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); hoy date := public._gym_hoy(); dinero boolean := rol in ('dueno','admin');
  mes timestamptz := date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'precio', p.precio, 'dias', p.dias, 'color', p.color,
      'vigentes', (select count(*) from public.gym_socios s where s.plan_id = p.id and s.activo and s.vence_en >= hoy),
      'por_vencer', (select count(*) from public.gym_socios s where s.plan_id = p.id and s.activo and s.vence_en >= hoy and s.vence_en < hoy + public._gym_aviso(p_gym)),
      'vendidas_mes', (select count(*) from public.gym_pagos g where g.plan_id = p.id and g.anulado_en is null and g.pago_de is null and g.creado_en >= mes),
      'ingresos_mes', case when dinero then (select coalesce(sum(g.monto), 0) from public.gym_pagos g where g.plan_id = p.id and g.anulado_en is null and g.creado_en >= mes) end)
    order by p.precio) from public.gym_planes p where p.gym_id = p_gym and p.activo), '[]');
end $$;

-- ---------- Notificaciones ----------
create or replace function public.gym_notificaciones(p_gym uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rol text := public._gym_exigir(p_gym, array['dueno','admin','recepcion','coach'], false); hoy date := public._gym_hoy(); dinero boolean := rol in ('dueno','admin','recepcion');
begin
  return jsonb_build_object(
    'vencen_hoy', coalesce((select jsonb_agg(public._gym_socio_json(s)) from (select * from public.gym_socios where gym_id = p_gym and activo and vence_en = hoy limit 60) s), '[]'),
    'vencen_semana', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.vence_en) from (select * from public.gym_socios where gym_id = p_gym and activo and vence_en > hoy and vence_en <= hoy + 7 order by vence_en limit 60) s), '[]'),
    'vencidos', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.vence_en desc) from (select * from public.gym_socios where gym_id = p_gym and activo and vence_en < hoy and vence_en >= hoy - 30 order by vence_en desc limit 60) s), '[]'),
    'cumpleanos', coalesce((select jsonb_agg(public._gym_socio_json(s) order by to_char(s.fecha_nac, 'MM-DD')) from (select * from public.gym_socios where gym_id = p_gym and activo and fecha_nac is not null
        and to_char(fecha_nac, 'MM-DD') in (select to_char(hoy + i, 'MM-DD') from generate_series(0, 7) i) limit 60) s), '[]'),
    'inactivos', coalesce((select jsonb_agg(public._gym_socio_json(s)) from (select * from public.gym_socios s where s.gym_id = p_gym and s.activo and s.vence_en >= hoy
        and (s.congelado_hasta is null or s.congelado_hasta < hoy) and s.creado_en < now() - interval '10 days'
        and coalesce((select max(entrada) from public.gym_asistencias a where a.socio_id = s.id), '-infinity') < now() - interval '10 days' limit 60) s), '[]'),
    'saldos', case when dinero then coalesce((select jsonb_agg(public._gym_socio_json(s)) from (select * from public.gym_socios s where s.gym_id = p_gym and s.activo and public._gym_saldo(s.id) > 0 limit 60) s), '[]') else '[]' end,
    'congelados', coalesce((select jsonb_agg(public._gym_socio_json(s) order by s.congelado_hasta) from (select * from public.gym_socios where gym_id = p_gym and activo and congelado_hasta >= hoy order by congelado_hasta limit 60) s), '[]'),
    'stock', case when dinero then coalesce((select jsonb_agg(public._gym_producto_json(p)) from public.gym_productos p where p.gym_id = p_gym and p.activo and p.existencia <= p.minimo), '[]') else '[]' end);
end $$;

-- ---------- Socio: marca de su gimnasio ----------
create or replace function public.socio_mio() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._gym_socio_json(s) || jsonb_build_object('gym', g.nombre, 'token', s.token, 'foto', s.foto,
      'gym_logo', g.ajustes ->> 'logo', 'gym_color', g.ajustes ->> 'color', 'gym_telefono', g.ajustes ->> 'telefono',
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
