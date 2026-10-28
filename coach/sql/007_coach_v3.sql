-- =====================================================================
-- Aeterion Coaches · migración 007
-- Casos para Aeterion (reportes, reembolsos, mensajes, mayoreo),
-- bloqueos, evaluación mutua, plan de alimentación (solo coaches
-- autorizados), calendario del coach. Solo objetos de este módulo.
-- =====================================================================

-- ---------- Casos: reportes y mensajes a Aeterion ----------
create table public.aet_casos (
  id bigserial primary key,
  autor uuid not null references auth.users (id) on delete cascade,
  rol text not null check (rol in ('cliente','coach','gym','socio','usuario')),
  tipo text not null check (tipo in ('conducta','reembolso','pago','seguridad','acoso','mensaje','mayoreo','otro')),
  contra uuid references auth.users (id) on delete set null,
  texto text not null check (char_length(texto) between 5 and 2000),
  ref jsonb not null default '{}',
  estado text not null default 'abierto' check (estado in ('abierto','en_revision','resuelto','cerrado')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index aet_casos_autor on public.aet_casos (autor, creado_en desc);
create index aet_casos_estado on public.aet_casos (estado, creado_en desc);

create table public.aet_caso_mensajes (
  id bigserial primary key,
  caso_id bigint not null references public.aet_casos (id) on delete cascade,
  de_admin boolean not null default false,
  texto text not null check (char_length(texto) between 1 and 2000),
  creado_en timestamptz not null default now(),
  leido_en timestamptz
);
create index aet_caso_mensajes_caso on public.aet_caso_mensajes (caso_id, creado_en);

-- ---------- Bloqueos entre cliente y coach ----------
create table public.coach_bloqueos (
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  por text not null check (por in ('cliente','coach')),
  motivo text check (char_length(motivo) <= 300),
  creado_en timestamptz not null default now(),
  primary key (coach_id, cliente_id)
);

-- ---------- Evaluación mutua (una por mes y por lado) ----------
create table public.coach_evaluaciones (
  id bigserial primary key,
  vinculo_id bigint not null references public.coach_vinculos (id) on delete cascade,
  autor text not null check (autor in ('coach','cliente')),
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),
  estrellas smallint not null check (estrellas between 1 and 5),
  aspectos jsonb not null default '{}',
  comentario text check (char_length(comentario) <= 400),
  creado_en timestamptz not null default now(),
  unique (vinculo_id, autor, periodo)
);

-- ---------- Plan de alimentación del coach ----------
alter table public.coaches add column puede_nutricion boolean not null default false;
create table public.coach_nutricion (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  kcal int check (kcal between 800 and 6000),
  proteina_g int check (proteina_g between 0 and 400),
  carbos_g int check (carbos_g between 0 and 900),
  grasas_g int check (grasas_g between 0 and 300),
  comidas jsonb not null default '[]',
  nota text check (char_length(nota) <= 600),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index coach_nutricion_uno on public.coach_nutricion (cliente_id) where activo;

-- ---------- Calendario del coach ----------
create table public.coach_eventos (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  cliente_id uuid references auth.users (id) on delete set null,
  tipo text not null default 'revision' check (tipo in ('revision','llamada','evaluacion','recordatorio','personal')),
  titulo text not null check (char_length(titulo) between 2 and 80),
  inicio timestamptz not null,
  minutos smallint not null default 30 check (minutos between 5 and 480),
  nota text check (char_length(nota) <= 300),
  hecho boolean not null default false,
  creado_en timestamptz not null default now()
);
create index coach_eventos_coach on public.coach_eventos (coach_id, inicio);
create index coach_eventos_cliente on public.coach_eventos (cliente_id, inicio);

alter table public.aet_casos enable row level security;
alter table public.aet_caso_mensajes enable row level security;
alter table public.coach_bloqueos enable row level security;
alter table public.coach_evaluaciones enable row level security;
alter table public.coach_nutricion enable row level security;
alter table public.coach_eventos enable row level security;
revoke all on public.aet_casos, public.aet_caso_mensajes, public.coach_bloqueos, public.coach_evaluaciones, public.coach_nutricion, public.coach_eventos from anon, authenticated;

-- =====================================================================
-- Casos
-- =====================================================================
create or replace function public._caso_json(c public.aet_casos, p_admin boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'tipo', c.tipo, 'rol', c.rol, 'estado', c.estado, 'texto', c.texto, 'ref', c.ref, 'creado_en', c.creado_en, 'actualizado_en', c.actualizado_en,
    'contra_nombre', (select coalesce(co.nombre_publico, nullif(pf.nombre, ''), 'Usuario') from auth.users u left join public.perfiles pf on pf.id = u.id left join public.coaches co on co.user_id = u.id where u.id = c.contra),
    'mensajes', coalesce((select jsonb_agg(jsonb_build_object('de_admin', m.de_admin, 'texto', m.texto, 'fecha', m.creado_en) order by m.creado_en) from public.aet_caso_mensajes m where m.caso_id = c.id), '[]'),
    'sin_leer', (select count(*) from public.aet_caso_mensajes m where m.caso_id = c.id and m.leido_en is null and m.de_admin <> p_admin))
  || case when p_admin then jsonb_build_object('autor_id', c.autor, 'contra', c.contra,
      'autor_email', (select email from auth.users where id = c.autor), 'autor_nombre', (select coalesce(nullif(nombre, ''), '—') from public.perfiles where id = c.autor),
      'contra_email', (select email from auth.users where id = c.contra)) else '{}'::jsonb end $$;

-- p_contra: la otra parte (coach o cliente) si el caso es sobre alguien; debe existir relación
create or replace function public.caso_crear(p_tipo text, p_texto text, p_contra uuid default null, p_ref jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); r text := 'usuario'; t text := trim(coalesce(p_texto, '')); c public.aet_casos; ref jsonb := coalesce(p_ref, '{}');
begin
  if v is null then raise exception 'no_autenticado'; end if;
  if p_tipo not in ('conducta','reembolso','pago','seguridad','acoso','mensaje','mayoreo','otro') then raise exception 'tipo_invalido'; end if;
  if char_length(t) < 5 then raise exception 'texto_corto'; end if;
  if jsonb_typeof(ref) <> 'object' or length(ref::text) > 1000 then raise exception 'tipo_invalido'; end if;
  if (select count(*) from public.aet_casos where autor = v and creado_en > now() - interval '1 day') >= 8 then raise exception 'demasiados_casos'; end if;
  if p_contra is not null and not exists (select 1 from public.coach_vinculos where (coach_id = v and cliente_id = p_contra) or (cliente_id = v and coach_id = p_contra)) then
    raise exception 'sin_relacion';
  end if;
  if p_tipo = 'mayoreo' then
    if not exists (select 1 from public.gym_staff where user_id = v and activo and rol in ('dueno','admin') and gym_id::text = ref ->> 'gym_id') then raise exception 'sin_permiso'; end if;
    r := 'gym';
  elsif exists (select 1 from public.coaches where user_id = v and estado in ('activo','suspendido','revision')) and (p_contra is null or exists (select 1 from public.coach_vinculos where coach_id = v and cliente_id = p_contra)) then r := 'coach';
  elsif p_contra is not null then r := 'cliente';
  end if;
  insert into public.aet_casos (autor, rol, tipo, contra, texto, ref) values (v, r, p_tipo, p_contra, left(t, 2000), ref) returning * into c;
  return public._caso_json(c, false);
end $$;

create or replace function public.mis_casos() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); r jsonb;
begin
  if v is null then raise exception 'no_autenticado'; end if;
  r := coalesce((select jsonb_agg(public._caso_json(c, false) order by c.actualizado_en desc) from (select * from public.aet_casos where autor = v order by actualizado_en desc limit 50) c), '[]');
  update public.aet_caso_mensajes set leido_en = now() where de_admin and leido_en is null and caso_id in (select id from public.aet_casos where autor = v);
  return r;
end $$;

create or replace function public.caso_escribir(p_caso bigint, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); c public.aet_casos; t text := trim(coalesce(p_texto, ''));
begin
  select * into c from public.aet_casos where id = p_caso and autor = v;
  if c.id is null then raise exception 'caso_no_encontrado'; end if;
  if c.estado = 'cerrado' then raise exception 'caso_cerrado'; end if;
  if char_length(t) < 1 then raise exception 'texto_corto'; end if;
  if (select count(*) from public.aet_caso_mensajes where caso_id = p_caso and not de_admin and creado_en > now() - interval '1 hour') >= 15 then raise exception 'demasiados_mensajes'; end if;
  insert into public.aet_caso_mensajes (caso_id, de_admin, texto) values (p_caso, false, left(t, 2000));
  update public.aet_casos set actualizado_en = now(), estado = case when estado = 'resuelto' then 'abierto' else estado end where id = p_caso returning * into c;
  return public._caso_json(c, false);
end $$;

create or replace function public.casos_sin_leer() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.aet_caso_mensajes m join public.aet_casos c on c.id = m.caso_id where c.autor = auth.uid() and m.de_admin and m.leido_en is null $$;

create or replace function public.admin_casos(p_estado text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public._coach_admin();
begin
  return jsonb_build_object(
    'resumen', (select jsonb_build_object('abiertos', count(*) filter (where estado = 'abierto'), 'en_revision', count(*) filter (where estado = 'en_revision'),
       'reembolsos', count(*) filter (where tipo = 'reembolso' and estado in ('abierto','en_revision')), 'mayoreo', count(*) filter (where tipo = 'mayoreo' and estado in ('abierto','en_revision'))) from public.aet_casos),
    'lista', coalesce((select jsonb_agg(public._caso_json(c, true) order by (c.estado = 'abierto') desc, c.actualizado_en desc)
      from (select * from public.aet_casos where (p_estado is null and estado in ('abierto','en_revision')) or estado = p_estado order by actualizado_en desc limit 200) c), '[]'));
end $$;

create or replace function public.admin_caso_responder(p_caso bigint, p_texto text, p_estado text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public._coach_admin(); c public.aet_casos;
begin
  if p_estado is not null and p_estado not in ('abierto','en_revision','resuelto','cerrado') then raise exception 'estado_invalido'; end if;
  select * into c from public.aet_casos where id = p_caso for update;
  if c.id is null then raise exception 'caso_no_encontrado'; end if;
  if char_length(trim(coalesce(p_texto, ''))) > 0 then insert into public.aet_caso_mensajes (caso_id, de_admin, texto) values (p_caso, true, left(trim(p_texto), 2000)); end if;
  update public.aet_caso_mensajes set leido_en = now() where caso_id = p_caso and not de_admin and leido_en is null;
  update public.aet_casos set estado = coalesce(p_estado, estado), actualizado_en = now() where id = p_caso returning * into c;
  return public._caso_json(c, true);
end $$;

-- =====================================================================
-- Bloqueos
-- =====================================================================
create or replace function public._coach_bloqueado(p_coach uuid, p_cliente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coach_bloqueos where coach_id = p_coach and cliente_id = p_cliente) $$;

-- Cualquiera de los dos bloquea: termina el vínculo y ya no pueden volver a conectarse ni escribirse
create or replace function public.vinculo_bloquear(p_vinculo bigint, p_motivo text, p_reportar boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); vin public.coach_vinculos; lado text;
begin
  if v is null then raise exception 'no_autenticado'; end if;
  select * into vin from public.coach_vinculos where id = p_vinculo and (coach_id = v or cliente_id = v);
  if vin.id is null then raise exception 'vinculo_no_encontrado'; end if;
  lado := case when vin.coach_id = v then 'coach' else 'cliente' end;
  if vin.estado in ('pendiente','activo') then perform public.vinculo_terminar(p_vinculo); end if;
  insert into public.coach_bloqueos (coach_id, cliente_id, por, motivo) values (vin.coach_id, vin.cliente_id, lado, nullif(left(trim(coalesce(p_motivo, '')), 300), ''))
  on conflict (coach_id, cliente_id) do nothing;
  if p_reportar and char_length(trim(coalesce(p_motivo, ''))) >= 5 then
    insert into public.aet_casos (autor, rol, tipo, contra, texto, ref)
    values (v, lado, 'conducta', case when lado = 'coach' then vin.cliente_id else vin.coach_id end, left(trim(p_motivo), 2000), jsonb_build_object('vinculo', p_vinculo, 'bloqueo', true));
  end if;
  return public.coach_estado();
end $$;

create or replace function public.coach_mis_bloqueos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('coach_id', b.coach_id, 'cliente_id', b.cliente_id, 'fecha', b.creado_en,
      'nombre', case when b.coach_id = v then coalesce(nullif(pf.nombre, ''), 'Cliente') else co.nombre_publico end) order by b.creado_en desc)
    from public.coach_bloqueos b left join public.perfiles pf on pf.id = b.cliente_id left join public.coaches co on co.user_id = b.coach_id
    where (b.coach_id = v and b.por = 'coach') or (b.cliente_id = v and b.por = 'cliente')), '[]');
end $$;

create or replace function public.coach_desbloquear(p_coach uuid, p_cliente uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  delete from public.coach_bloqueos where coach_id = p_coach and cliente_id = p_cliente and ((por = 'coach' and coach_id = v) or (por = 'cliente' and cliente_id = v));
  if not found then raise exception 'no_encontrado'; end if;
  return public.coach_mis_bloqueos();
end $$;

-- Reemplazos de 001/004 con la regla de bloqueo
create or replace function public.vinculo_solicitar(p_coach uuid, p_modalidad text, p_permisos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches;
begin
  if p_coach = v then raise exception 'no_contigo'; end if;
  select * into c from public.coaches where user_id = p_coach;
  if c.user_id is null or not public._coach_vigente(c) or public._coach_bloqueado(p_coach, v) then raise exception 'coach_no_encontrado'; end if;
  if not (p_modalidad = any (c.modalidades)) then raise exception 'modalidad_no_disponible'; end if;
  if exists (select 1 from public.coach_vinculos where cliente_id = v and estado in ('pendiente','activo')) then raise exception 'ya_tienes_coach'; end if;
  insert into public.coach_vinculos (coach_id, cliente_id, modalidad, permisos)
  values (p_coach, v, p_modalidad, public._coach_permisos(p_permisos));
  return public.coach_estado();
end $$;

create or replace function public.vinculo_por_codigo(p_codigo text, p_modalidad text, p_permisos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches; m text;
begin
  select * into c from public.coaches where codigo = upper(trim(p_codigo));
  if c.user_id is null or not public._coach_vigente(c) or public._coach_bloqueado(c.user_id, v) then raise exception 'codigo_invalido'; end if;
  if c.user_id = v then raise exception 'no_contigo'; end if;
  if exists (select 1 from public.coach_vinculos where cliente_id = v and estado in ('pendiente','activo')) then raise exception 'ya_tienes_coach'; end if;
  m := case when p_modalidad = any (c.modalidades) then p_modalidad else c.modalidades[1] end;
  if m is null then raise exception 'modalidad_no_disponible'; end if;
  insert into public.coach_vinculos (coach_id, cliente_id, modalidad, permisos, estado, respondido_en)
  values (c.user_id, v, m, public._coach_permisos(p_permisos), 'activo', now());
  insert into public.coach_referidos (cliente_id, coach_id, codigo) values (v, c.user_id, c.codigo) on conflict (cliente_id) do nothing;
  return public.coach_estado();
end $$;

create or replace function public.coach_directorio(p_texto text default null, p_especialidad text default null,
  p_modalidad text default null, p_limite int default 30, p_desde int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  return coalesce((select jsonb_agg(public._coach_publico(c) order by c.nivel desc, c.aprobado_en)
    from (select * from public.coaches c
      where public._coach_vigente(c) and c.user_id <> v and not public._coach_bloqueado(c.user_id, v)
        and (p_especialidad is null or p_especialidad = any (c.especialidades))
        and (p_modalidad is null or p_modalidad = any (c.modalidades))
        and (p_texto is null or (coalesce(c.nombre_publico,'') || ' ' || coalesce(c.zona,'') || ' ' || coalesce(c.gimnasio,'') || ' ' || array_to_string(c.especialidades, ' ')) ilike '%' || p_texto || '%')
      order by c.nivel desc, c.aprobado_en
      limit least(greatest(p_limite, 1), 50) offset greatest(p_desde, 0)) c), '[]');
end $$;

-- =====================================================================
-- Evaluación mutua
-- =====================================================================
-- Calificación pública del coach: sesiones calificadas + evaluaciones mensuales de sus clientes
create or replace function public._coach_calif(p_coach uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('promedio', round(avg(e)::numeric, 1), 'resenas', count(e)) from (
    select calificacion e from public.coach_sesiones where coach_id = p_coach and estado = 'dada' and calificacion is not null
    union all
    select ev.estrellas from public.coach_evaluaciones ev join public.coach_vinculos vi on vi.id = ev.vinculo_id where vi.coach_id = p_coach and ev.autor = 'cliente') x $$;

-- Reputación de un cliente según los coaches que lo han evaluado (solo la ve un coach con relación)
create or replace function public._cliente_reputacion(p_cliente uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('promedio', round(avg(ev.estrellas)::numeric, 1), 'evaluaciones', count(*))
  from public.coach_evaluaciones ev join public.coach_vinculos vi on vi.id = ev.vinculo_id where vi.cliente_id = p_cliente and ev.autor = 'coach' $$;

create or replace function public.evaluacion_guardar(p_vinculo bigint, p_estrellas int, p_aspectos jsonb, p_comentario text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); vin public.coach_vinculos; lado text; per text := to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM'); asp jsonb := '{}'; k text;
begin
  if v is null then raise exception 'no_autenticado'; end if;
  select * into vin from public.coach_vinculos where id = p_vinculo and (coach_id = v or cliente_id = v)
    and (estado = 'activo' or (estado = 'terminado' and terminado_en > now() - interval '30 days'));
  if vin.id is null then raise exception 'vinculo_no_encontrado'; end if;
  if coalesce(vin.respondido_en, vin.creado_en) > now() - interval '7 days' then raise exception 'muy_pronto'; end if;
  lado := case when vin.coach_id = v then 'coach' else 'cliente' end;
  if p_estrellas is null or p_estrellas not between 1 and 5 then raise exception 'calificacion_invalida'; end if;
  for k in select jsonb_object_keys(coalesce(p_aspectos, '{}')) loop
    if k in ('comunicacion','conocimiento','puntualidad','resultados','trato','constancia','compromiso','respeto')
       and (p_aspectos ->> k) ~ '^[1-5]$' then asp := asp || jsonb_build_object(k, (p_aspectos ->> k)::int); end if;
  end loop;
  insert into public.coach_evaluaciones (vinculo_id, autor, periodo, estrellas, aspectos, comentario)
  values (p_vinculo, lado, per, p_estrellas, asp, nullif(left(trim(coalesce(p_comentario, '')), 400), ''))
  on conflict (vinculo_id, autor, periodo) do update set estrellas = excluded.estrellas, aspectos = excluded.aspectos, comentario = excluded.comentario, creado_en = now();
  return public.evaluaciones_vinculo(p_vinculo);
end $$;

-- Lo que cada lado puede ver: lo que escribió y lo que la otra parte le escribió a él
create or replace function public.evaluaciones_vinculo(p_vinculo bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid(); vin public.coach_vinculos; lado text; per text := to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM');
begin
  select * into vin from public.coach_vinculos where id = p_vinculo and (coach_id = v or cliente_id = v);
  if vin.id is null then raise exception 'vinculo_no_encontrado'; end if;
  lado := case when vin.coach_id = v then 'coach' else 'cliente' end;
  return jsonb_build_object('lado', lado, 'periodo', per,
    'puede', (vin.estado = 'activo' or (vin.estado = 'terminado' and vin.terminado_en > now() - interval '30 days')) and coalesce(vin.respondido_en, vin.creado_en) <= now() - interval '7 days',
    'mia', (select to_jsonb(e) - 'vinculo_id' from public.coach_evaluaciones e where e.vinculo_id = p_vinculo and e.autor = lado and e.periodo = per),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('autor', e.autor, 'periodo', e.periodo, 'estrellas', e.estrellas, 'aspectos', e.aspectos, 'comentario', e.comentario, 'mia', e.autor = lado) order by e.periodo desc, e.autor)
       from public.coach_evaluaciones e where e.vinculo_id = p_vinculo), '[]'));
end $$;

-- =====================================================================
-- Plan de alimentación (solo coaches autorizados por Aeterion)
-- =====================================================================
create or replace function public._nutricion_valida(p jsonb) returns boolean
language plpgsql immutable as $$
declare c jsonb;
begin
  if jsonb_typeof(coalesce(p -> 'comidas', '[]')) <> 'array' or jsonb_array_length(coalesce(p -> 'comidas', '[]')) > 8 then return false; end if;
  for c in select * from jsonb_array_elements(coalesce(p -> 'comidas', '[]')) loop
    if char_length(coalesce(c ->> 'nombre', '')) not between 1 and 40 or char_length(coalesce(c ->> 'texto', '')) not between 1 and 500 then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.coach_nutricion_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches; cli uuid := nullif(p ->> 'cliente_id', '')::uuid; r public.coach_nutricion;
  num text := '^[0-9]{1,4}$';
begin
  select * into c from public.coaches where user_id = v;
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'coach_no_vigente'; end if;
  if not c.puede_nutricion then raise exception 'nutricion_no_autorizada'; end if;
  if cli is null or not exists (select 1 from public.coach_vinculos where coach_id = v and cliente_id = cli and estado = 'activo') then raise exception 'sin_permiso'; end if;
  if not public._nutricion_valida(p) then raise exception 'plan_invalido'; end if;
  if coalesce(nullif(p ->> 'kcal', ''), '0') !~ num or coalesce(nullif(p ->> 'proteina_g', ''), '0') !~ num or coalesce(nullif(p ->> 'carbos_g', ''), '0') !~ num or coalesce(nullif(p ->> 'grasas_g', ''), '0') !~ num then raise exception 'plan_invalido'; end if;
  update public.coach_nutricion set activo = false, actualizado_en = now() where cliente_id = cli and activo;
  insert into public.coach_nutricion (coach_id, cliente_id, kcal, proteina_g, carbos_g, grasas_g, comidas, nota)
  values (v, cli, nullif(p ->> 'kcal', '')::int, nullif(p ->> 'proteina_g', '')::int, nullif(p ->> 'carbos_g', '')::int, nullif(p ->> 'grasas_g', '')::int,
    coalesce(p -> 'comidas', '[]'), nullif(left(trim(coalesce(p ->> 'nota', '')), 600), ''))
  returning * into r;
  return to_jsonb(r);
exception when check_violation then raise exception 'plan_invalido';
end $$;

create or replace function public.coach_nutricion_ver(p_cliente uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  if not exists (select 1 from public.coach_vinculos where coach_id = v and cliente_id = p_cliente and estado = 'activo') then raise exception 'sin_permiso'; end if;
  return jsonb_build_object('puede', (select puede_nutricion from public.coaches where user_id = v),
    'plan', (select to_jsonb(n) from public.coach_nutricion n where n.cliente_id = p_cliente and n.coach_id = v and n.activo));
end $$;

create or replace function public.coach_nutricion_quitar(p_cliente uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  update public.coach_nutricion set activo = false, actualizado_en = now() where cliente_id = p_cliente and coach_id = v and activo;
  return public.coach_nutricion_ver(p_cliente);
end $$;

create or replace function public.nutricion_mia() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no_autenticado'; end if;
  return (select to_jsonb(n) - 'coach_id' || jsonb_build_object('coach', co.nombre_publico)
    from public.coach_nutricion n join public.coach_vinculos vi on vi.cliente_id = n.cliente_id and vi.coach_id = n.coach_id and vi.estado = 'activo'
    join public.coaches co on co.user_id = n.coach_id and co.puede_nutricion
    where n.cliente_id = v and n.activo limit 1);
end $$;

create or replace function public.admin_coach_nutricion(p_coach uuid, p_valor boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public._coach_admin();
begin
  update public.coaches set puede_nutricion = coalesce(p_valor, false), actualizado_en = now() where user_id = p_coach;
  if not found then raise exception 'coach_no_encontrado'; end if;
  return public.admin_coach_detalle(p_coach);
end $$;

-- =====================================================================
-- Calendario
-- =====================================================================
create or replace function public.coach_calendario(p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); d timestamptz := (p_desde::timestamp at time zone 'America/Mexico_City'); h timestamptz := ((p_hasta + 1)::timestamp at time zone 'America/Mexico_City');
begin
  if p_hasta < p_desde or p_hasta - p_desde > 62 then raise exception 'rango_invalido'; end if;
  return jsonb_build_object(
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'titulo', e.titulo, 'inicio', e.inicio, 'minutos', e.minutos, 'nota', e.nota, 'hecho', e.hecho,
        'cliente_id', e.cliente_id, 'cliente', coalesce(nullif(pf.nombre, ''), case when e.cliente_id is not null then 'Cliente' end)) order by e.inicio)
       from public.coach_eventos e left join public.perfiles pf on pf.id = e.cliente_id where e.coach_id = v and e.inicio >= d and e.inicio < h), '[]'),
    'sesiones', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'inicio', s.inicio, 'minutos', s.minutos, 'estado', s.estado, 'modalidad', s.modalidad, 'precio', s.precio,
        'cliente_id', s.cliente_id, 'cliente', coalesce(nullif(pf.nombre, ''), 'Cliente')) order by s.inicio)
       from public.coach_sesiones s left join public.perfiles pf on pf.id = s.cliente_id where s.coach_id = v and s.inicio >= d and s.inicio < h
         and s.estado not in ('expirada')), '[]'));
end $$;

create or replace function public.coach_evento_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); eid bigint := nullif(p ->> 'id', '')::bigint; cli uuid := nullif(p ->> 'cliente_id', '')::uuid; r public.coach_eventos;
begin
  if cli is not null and not exists (select 1 from public.coach_vinculos where coach_id = v and cliente_id = cli and estado = 'activo') then raise exception 'sin_permiso'; end if;
  if (p ->> 'inicio') is null then raise exception 'fecha_invalida'; end if;
  if eid is null then
    if (select count(*) from public.coach_eventos where coach_id = v and inicio > now()) >= 500 then raise exception 'demasiados_eventos'; end if;
    insert into public.coach_eventos (coach_id, cliente_id, tipo, titulo, inicio, minutos, nota)
    values (v, cli, coalesce(nullif(p ->> 'tipo', ''), 'revision'), trim(p ->> 'titulo'), (p ->> 'inicio')::timestamptz, coalesce(nullif(p ->> 'minutos', '')::int, 30), nullif(left(trim(coalesce(p ->> 'nota', '')), 300), ''))
    returning * into r;
  else
    update public.coach_eventos set cliente_id = case when p ? 'cliente_id' then cli else cliente_id end, tipo = coalesce(nullif(p ->> 'tipo', ''), tipo), titulo = trim(p ->> 'titulo'), inicio = (p ->> 'inicio')::timestamptz,
      minutos = coalesce(nullif(p ->> 'minutos', '')::int, minutos), nota = nullif(left(trim(coalesce(p ->> 'nota', '')), 300), ''), hecho = coalesce((p ->> 'hecho')::boolean, hecho)
     where id = eid and coach_id = v returning * into r;
    if r.id is null then raise exception 'evento_no_encontrado'; end if;
  end if;
  return to_jsonb(r);
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or invalid_datetime_format then raise exception 'evento_invalido';
end $$;

create or replace function public.coach_evento_borrar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  delete from public.coach_eventos where id = p_id and coach_id = v;
  if not found then raise exception 'evento_no_encontrado'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- El cliente ve sus próximas citas con su coach actual
create or replace function public.mis_citas_coach() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no_autenticado'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'titulo', e.titulo, 'inicio', e.inicio, 'minutos', e.minutos, 'nota', e.nota) order by e.inicio)
    from public.coach_eventos e join public.coach_vinculos vi on vi.coach_id = e.coach_id and vi.cliente_id = e.cliente_id and vi.estado = 'activo'
    where e.cliente_id = v and e.tipo <> 'personal' and e.inicio > now() - interval '2 hours' and e.inicio < now() + interval '60 days'), '[]');
end $$;

-- =====================================================================
-- Ficha del cliente para el coach (todo en una llamada)
-- =====================================================================
create or replace function public.coach_ficha(p_cliente uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); vin public.coach_vinculos; pf public.perfiles;
begin
  select * into vin from public.coach_vinculos where coach_id = v and cliente_id = p_cliente and estado = 'activo';
  if vin.id is null then raise exception 'sin_permiso'; end if;
  select * into pf from public.perfiles where id = p_cliente;
  return jsonb_build_object('vinculo', vin.id, 'desde', coalesce(vin.respondido_en, vin.creado_en), 'modalidad', vin.modalidad, 'permisos', vin.permisos,
    'nombre', coalesce(nullif(pf.nombre, ''), 'Cliente'),
    'reputacion', public._cliente_reputacion(p_cliente),
    'evaluaciones', public.evaluaciones_vinculo(vin.id),
    'nutricion', public.coach_nutricion_ver(p_cliente),
    'proximas', coalesce((select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'titulo', e.titulo, 'inicio', e.inicio) order by e.inicio)
       from public.coach_eventos e where e.coach_id = v and e.cliente_id = p_cliente and e.inicio > now() and e.inicio < now() + interval '30 days'), '[]'));
end $$;

-- ---------- Permisos de ejecución ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('_caso_json','caso_crear','mis_casos','caso_escribir','casos_sin_leer','admin_casos','admin_caso_responder',
             '_coach_bloqueado','vinculo_bloquear','coach_mis_bloqueos','coach_desbloquear','vinculo_solicitar','vinculo_por_codigo','coach_directorio',
             '_coach_calif','_cliente_reputacion','evaluacion_guardar','evaluaciones_vinculo','_nutricion_valida','coach_nutricion_guardar','coach_nutricion_ver',
             'coach_nutricion_quitar','nutricion_mia','admin_coach_nutricion','coach_calendario','coach_evento_guardar','coach_evento_borrar','mis_citas_coach','coach_ficha') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not like '\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
