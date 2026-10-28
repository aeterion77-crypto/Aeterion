-- =====================================================================
-- Aeterion Coaches · migración 004: espacio de trabajo del coach
-- Programas (plantillas y asignados), mensajes coach ↔ cliente, notas
-- privadas, invitación por código y resumen del día. Solo objetos nuevos
-- (y reemplazo de coach_mis_clientes, que es de este mismo módulo).
-- =====================================================================

create table public.coach_programas (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  cliente_id uuid references auth.users (id) on delete cascade,      -- null = plantilla del coach
  nombre text not null check (char_length(nombre) between 2 and 60),
  base text check (char_length(base) <= 30),                         -- programa Aeterion de origen (entrenamiento, h3, m5…)
  dias jsonb not null,
  nota text check (char_length(nota) <= 400),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index coach_programas_coach on public.coach_programas (coach_id);
create unique index coach_programas_uno_activo on public.coach_programas (cliente_id) where cliente_id is not null and activo;

create table public.coach_mensajes (
  id bigserial primary key,
  vinculo_id bigint not null references public.coach_vinculos (id) on delete cascade,
  autor text not null check (autor in ('coach','cliente')),
  texto text not null check (char_length(texto) between 1 and 1000),
  creado_en timestamptz not null default now(),
  leido_en timestamptz
);
create index coach_mensajes_vinculo on public.coach_mensajes (vinculo_id, creado_en);

create table public.coach_notas (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  creado_en timestamptz not null default now()
);
create index coach_notas_par on public.coach_notas (coach_id, cliente_id);

alter table public.coach_programas enable row level security;
alter table public.coach_mensajes enable row level security;
alter table public.coach_notas enable row level security;
revoke all on public.coach_programas, public.coach_mensajes, public.coach_notas from anon, authenticated;

-- ---------- Validación de un programa ----------
create or replace function public._coach_programa_valido(d jsonb) returns boolean
language plpgsql immutable as $$
declare dia jsonb; e jsonb;
begin
  if jsonb_typeof(d) <> 'array' or jsonb_array_length(d) not between 1 and 7 or length(d::text) > 30000 then return false; end if;
  for dia in select * from jsonb_array_elements(d) loop
    if jsonb_typeof(dia) <> 'object' or char_length(coalesce(dia ->> 'nombre', '')) not between 1 and 60 then return false; end if;
    if jsonb_typeof(dia -> 'ejercicios') <> 'array' or jsonb_array_length(dia -> 'ejercicios') not between 1 and 15 then return false; end if;
    for e in select * from jsonb_array_elements(dia -> 'ejercicios') loop
      if char_length(coalesce(e ->> 'n', '')) not between 2 and 60 then return false; end if;
      if (e ->> 's') !~ '^[0-9]{1,2}$' or (e ->> 's')::int not between 1 and 10 then return false; end if;
      if char_length(coalesce(e ->> 'r', '')) not between 1 and 15 then return false; end if;
      if e ? 'rir' and e -> 'rir' <> 'null'::jsonb and ((e ->> 'rir') !~ '^[0-5]$') then return false; end if;
      if e ? 'kg' and e -> 'kg' <> 'null'::jsonb and ((e ->> 'kg') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' or (e ->> 'kg')::numeric > 1000) then return false; end if;
      if char_length(coalesce(e ->> 'nota', '')) > 120 then return false; end if;
    end loop;
  end loop;
  return true;
end $$;

-- ---------- Actividad del cliente (solo si comparte sus entrenos) ----------
create or replace function public._coach_actividad(p_cliente uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v text; j jsonb; ult date; n30 int;
begin
  select valor into v from public.progreso where user_id = p_cliente and clave = 'aet_actividad';
  if v is null then return jsonb_build_object('ultimo', null, 'n30', 0); end if;
  begin j := v::jsonb; exception when others then return jsonb_build_object('ultimo', null, 'n30', 0); end;
  if jsonb_typeof(j) <> 'object' then return jsonb_build_object('ultimo', null, 'n30', 0); end if;
  select max(k::date), count(*) filter (where k::date > current_date - 30) into ult, n30
    from jsonb_each(j) as t(k, val)
   where k ~ '^\d{4}-\d{2}-\d{2}$' and jsonb_typeof(val) = 'array' and val ? 'e';
  return jsonb_build_object('ultimo', ult, 'n30', coalesce(n30, 0));
end $$;

-- ---------- Clientes del coach (reemplaza la versión de 001) ----------
create or replace function public.coach_mis_clientes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  return coalesce((select jsonb_agg(x order by (x ->> 'estado') desc, (x ->> 'desde') desc) from (
    select jsonb_build_object(
      'vinculo', vi.id, 'cliente_id', vi.cliente_id, 'estado', vi.estado, 'modalidad', vi.modalidad,
      'permisos', vi.permisos, 'desde', coalesce(vi.respondido_en, vi.creado_en),
      'nombre', coalesce(nullif(pf.nombre, ''), 'Cliente'),
      'actividad', case when vi.estado = 'activo' and coalesce((vi.permisos ->> 'entrenos')::boolean, false) then public._coach_actividad(vi.cliente_id) end,
      'programa', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'dias', jsonb_array_length(p.dias)) from public.coach_programas p where p.cliente_id = vi.cliente_id and p.coach_id = v and p.activo),
      'no_leidos', (select count(*) from public.coach_mensajes m where m.vinculo_id = vi.id and m.autor = 'cliente' and m.leido_en is null),
      'sesiones_dadas', (select count(*) from public.coach_sesiones s where s.vinculo_id = vi.id and s.estado = 'dada'),
      'proxima', (select min(inicio) from public.coach_sesiones s where s.vinculo_id = vi.id and s.estado in ('por_pagar','pagada') and s.inicio > now())) x
    from public.coach_vinculos vi left join public.perfiles pf on pf.id = vi.cliente_id
    where vi.coach_id = v and vi.estado in ('pendiente','activo')) t), '[]');
end $$;

-- ---------- Resumen del día ----------
create or replace function public.coach_resumen() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); cl jsonb; hoy date := (now() at time zone 'America/Mexico_City')::date;
  alertas jsonb := '[]'; x jsonb; dias int; const_sum numeric := 0; const_n int := 0; esperado numeric;
begin
  cl := public.coach_mis_clientes();
  for x in select * from jsonb_array_elements(cl) loop
    if x ->> 'estado' = 'pendiente' then
      alertas := alertas || jsonb_build_object('tipo', 'solicitud', 'nombre', x ->> 'nombre', 'cliente_id', x ->> 'cliente_id', 'vinculo', x -> 'vinculo');
      continue;
    end if;
    if (x ->> 'no_leidos')::int > 0 then
      alertas := alertas || jsonb_build_object('tipo', 'mensaje', 'nombre', x ->> 'nombre', 'cliente_id', x ->> 'cliente_id', 'vinculo', x -> 'vinculo', 'n', (x ->> 'no_leidos')::int);
    end if;
    if x -> 'actividad' is not null and jsonb_typeof(x -> 'actividad') = 'object' then
      dias := coalesce(hoy - (x -> 'actividad' ->> 'ultimo')::date, hoy - (x ->> 'desde')::timestamptz::date);
      if dias >= 5 then
        alertas := alertas || jsonb_build_object('tipo', 'inactivo', 'nombre', x ->> 'nombre', 'cliente_id', x ->> 'cliente_id', 'vinculo', x -> 'vinculo', 'dias', dias, 'nunca', (x -> 'actividad' ->> 'ultimo') is null);
      end if;
      esperado := coalesce((x -> 'programa' ->> 'dias')::numeric, 4) * 30 / 7;
      const_sum := const_sum + least(1, (x -> 'actividad' ->> 'n30')::numeric / esperado);
      const_n := const_n + 1;
    end if;
    if x -> 'programa' is null or jsonb_typeof(x -> 'programa') = 'null' then
      alertas := alertas || jsonb_build_object('tipo', 'sin_programa', 'nombre', x ->> 'nombre', 'cliente_id', x ->> 'cliente_id', 'vinculo', x -> 'vinculo');
    end if;
  end loop;
  return jsonb_build_object(
    'clientes', (select count(*) from jsonb_array_elements(cl) e where e ->> 'estado' = 'activo'),
    'constancia', case when const_n > 0 then round(const_sum / const_n * 100) end,
    'ganado_mes', coalesce((select sum(monto) from public.coach_comisiones where coach_id = v and estado <> 'cancelada'
       and creado_en >= date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'), 0),
    'alertas', alertas,
    'sesiones_hoy', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'inicio', s.inicio, 'minutos', s.minutos, 'modalidad', s.modalidad,
        'estado', s.estado, 'nota', s.nota, 'nombre', coalesce(nullif(pf.nombre, ''), 'Cliente')) order by s.inicio)
       from public.coach_sesiones s left join public.perfiles pf on pf.id = s.cliente_id
       where s.coach_id = v and s.estado in ('por_pagar','pagada','dada') and (s.inicio at time zone 'America/Mexico_City')::date = hoy), '[]'));
end $$;

-- ---------- Programas ----------
-- p: { id?, nombre, base?, dias, nota?, cliente_id? (null = plantilla) }
create or replace function public.coach_programa_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches; cli uuid := nullif(p ->> 'cliente_id', '')::uuid; pid bigint := nullif(p ->> 'id', '')::bigint; r public.coach_programas;
begin
  select * into c from public.coaches where user_id = v;
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'coach_no_vigente'; end if;
  if not public._coach_programa_valido(p -> 'dias') then raise exception 'programa_invalido'; end if;
  if char_length(coalesce(trim(p ->> 'nombre'), '')) not between 2 and 60 then raise exception 'programa_invalido'; end if;
  if cli is not null and not exists (select 1 from public.coach_vinculos where coach_id = v and cliente_id = cli and estado = 'activo') then raise exception 'sin_permiso'; end if;
  if cli is null and pid is null and (select count(*) from public.coach_programas where coach_id = v and cliente_id is null) >= 30 then raise exception 'demasiadas_plantillas'; end if;
  if pid is not null then
    update public.coach_programas set nombre = trim(p ->> 'nombre'), base = nullif(p ->> 'base', ''), dias = p -> 'dias',
      nota = nullif(left(trim(p ->> 'nota'), 400), ''), actualizado_en = now()
     where id = pid and coach_id = v and cliente_id is not distinct from cli returning * into r;
    if r.id is null then raise exception 'programa_no_encontrado'; end if;
  else
    if cli is not null then update public.coach_programas set activo = false, actualizado_en = now() where cliente_id = cli and activo; end if;
    insert into public.coach_programas (coach_id, cliente_id, nombre, base, dias, nota)
    values (v, cli, trim(p ->> 'nombre'), nullif(p ->> 'base', ''), p -> 'dias', nullif(left(trim(p ->> 'nota'), 400), ''))
    returning * into r;
  end if;
  return to_jsonb(r);
end $$;

create or replace function public.coach_programas_listar() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  return jsonb_build_object(
    'plantillas', coalesce((select jsonb_agg(to_jsonb(p) order by p.actualizado_en desc) from public.coach_programas p where p.coach_id = v and p.cliente_id is null), '[]'),
    'asignados', coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('cliente', coalesce(nullif(pf.nombre, ''), 'Cliente')) order by p.actualizado_en desc)
       from public.coach_programas p left join public.perfiles pf on pf.id = p.cliente_id
       where p.coach_id = v and p.cliente_id is not null and p.activo
         and exists (select 1 from public.coach_vinculos vi where vi.coach_id = v and vi.cliente_id = p.cliente_id and vi.estado = 'activo')), '[]'));
end $$;

create or replace function public.coach_programa_borrar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  delete from public.coach_programas where id = p_id and coach_id = v and cliente_id is null;
  if not found then
    update public.coach_programas set activo = false, actualizado_en = now() where id = p_id and coach_id = v and activo;
    if not found then raise exception 'programa_no_encontrado'; end if;
  end if;
  return public.coach_programas_listar();
end $$;

-- El cliente ve el programa que le asignó su coach actual
create or replace function public.programa_mio() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no_autenticado'; end if;
  return (select to_jsonb(p) - 'coach_id' || jsonb_build_object('coach', co.nombre_publico)
    from public.coach_programas p join public.coach_vinculos vi on vi.cliente_id = p.cliente_id and vi.coach_id = p.coach_id and vi.estado = 'activo'
    join public.coaches co on co.user_id = p.coach_id
    where p.cliente_id = v and p.activo limit 1);
end $$;

-- ---------- Mensajes ----------
create or replace function public._coach_lado(p_vinculo bigint) returns text
language sql stable security definer set search_path = public as $$
  select case when coach_id = auth.uid() then 'coach' when cliente_id = auth.uid() then 'cliente' end
  from public.coach_vinculos where id = p_vinculo and estado = 'activo' $$;

create or replace function public.mensajes_listar(p_vinculo bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lado text := public._coach_lado(p_vinculo);
begin
  if lado is null then raise exception 'sin_permiso'; end if;
  update public.coach_mensajes set leido_en = now() where vinculo_id = p_vinculo and autor <> lado and leido_en is null;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'autor', autor, 'texto', texto, 'fecha', creado_en, 'mio', autor = lado) order by creado_en)
    from (select * from public.coach_mensajes where vinculo_id = p_vinculo order by creado_en desc limit 100) m), '[]');
end $$;

create or replace function public.mensaje_enviar(p_vinculo bigint, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lado text := public._coach_lado(p_vinculo); t text := left(trim(coalesce(p_texto, '')), 1000);
begin
  if lado is null then raise exception 'sin_permiso'; end if;
  if t = '' then raise exception 'mensaje_vacio'; end if;
  if (select count(*) from public.coach_mensajes where vinculo_id = p_vinculo and autor = lado and creado_en > now() - interval '1 hour') >= 40 then raise exception 'demasiados_mensajes'; end if;
  insert into public.coach_mensajes (vinculo_id, autor, texto) values (p_vinculo, lado, t);
  return public.mensajes_listar(p_vinculo);
end $$;

create or replace function public.mensajes_no_leidos() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.coach_mensajes m join public.coach_vinculos vi on vi.id = m.vinculo_id and vi.estado = 'activo'
  where m.leido_en is null and ((vi.cliente_id = auth.uid() and m.autor = 'coach') or (vi.coach_id = auth.uid() and m.autor = 'cliente')) $$;

-- ---------- Notas privadas del coach ----------
create or replace function public.coach_notas_listar(p_cliente uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  if not exists (select 1 from public.coach_vinculos where coach_id = v and cliente_id = p_cliente and estado = 'activo') then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'texto', texto, 'fecha', creado_en) order by creado_en desc)
    from public.coach_notas where coach_id = v and cliente_id = p_cliente), '[]');
end $$;

create or replace function public.coach_nota_agregar(p_cliente uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  if not exists (select 1 from public.coach_vinculos where coach_id = v and cliente_id = p_cliente and estado = 'activo') then raise exception 'sin_permiso'; end if;
  if char_length(trim(coalesce(p_texto, ''))) = 0 then raise exception 'mensaje_vacio'; end if;
  if (select count(*) from public.coach_notas where coach_id = v and cliente_id = p_cliente) >= 300 then raise exception 'demasiadas_notas'; end if;
  insert into public.coach_notas (coach_id, cliente_id, texto) values (v, p_cliente, left(trim(p_texto), 1000));
  return public.coach_notas_listar(p_cliente);
end $$;

create or replace function public.coach_nota_borrar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); cli uuid;
begin
  delete from public.coach_notas where id = p_id and coach_id = v returning cliente_id into cli;
  if cli is null then raise exception 'nota_no_encontrada'; end if;
  return public.coach_notas_listar(cli);
end $$;

-- ---------- Invitación: el cliente entra con el código o enlace del coach ----------
-- El coach ya lo invitó, así que el vínculo queda activo de inmediato; el cliente elige qué comparte.
create or replace function public.vinculo_por_codigo(p_codigo text, p_modalidad text, p_permisos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches; m text;
begin
  select * into c from public.coaches where codigo = upper(trim(p_codigo));
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'codigo_invalido'; end if;
  if c.user_id = v then raise exception 'no_contigo'; end if;
  if exists (select 1 from public.coach_vinculos where cliente_id = v and estado in ('pendiente','activo')) then raise exception 'ya_tienes_coach'; end if;
  m := case when p_modalidad = any (c.modalidades) then p_modalidad else c.modalidades[1] end;
  if m is null then raise exception 'modalidad_no_disponible'; end if;
  insert into public.coach_vinculos (coach_id, cliente_id, modalidad, permisos, estado, respondido_en)
  values (c.user_id, v, m, public._coach_permisos(p_permisos), 'activo', now());
  insert into public.coach_referidos (cliente_id, coach_id, codigo) values (v, c.user_id, c.codigo) on conflict (cliente_id) do nothing;
  return public.coach_estado();
end $$;

-- Vista pública mínima de un coach por su código (para la pantalla de invitación)
create or replace function public.coach_por_codigo(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches;
begin
  select * into c from public.coaches where codigo = upper(trim(p_codigo));
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'codigo_invalido'; end if;
  return public._coach_publico(c) || jsonb_build_object('codigo', c.codigo);
end $$;

-- ---------- Permisos de ejecución ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('_coach_programa_valido','_coach_actividad','_coach_lado','coach_mis_clientes','coach_resumen',
             'coach_programa_guardar','coach_programas_listar','coach_programa_borrar','programa_mio','mensajes_listar','mensaje_enviar',
             'mensajes_no_leidos','coach_notas_listar','coach_nota_agregar','coach_nota_borrar','vinculo_por_codigo','coach_por_codigo') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not like '\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
