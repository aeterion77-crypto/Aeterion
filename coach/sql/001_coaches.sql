-- =====================================================================
-- Aeterion Coaches · migración 001
-- Solo crea objetos NUEVOS (prefijo coach_). No modifica tablas ni
-- funciones existentes. Todo queda apagado por la bandera coach_config.activo.
-- Lee: auth.users, perfiles, progreso. Escribe en accesos SOLO filas
-- con origen = 'coach' (Premium personal del coach).
-- =====================================================================

-- ---------- Configuración ----------
create table public.coach_config (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz not null default now()
);
insert into public.coach_config (clave, valor) values
  ('activo', 'false'),                                   -- interruptor general
  ('testers', '[]'),                                     -- uuid que pueden usarlo con el interruptor apagado
  ('cobro_requerido', 'true'),                           -- exige pagar el primer mes ($349) antes de revisión y membresía vigente
  ('precios', '{"mensual":349,"curso_base_incluido":true}'),
  ('topes', '{"1":{"sesion":350,"mensual":900},"2":{"sesion":600,"mensual":1500},"3":{"sesion":1000,"mensual":2500}}'),
  ('comisiones', '{"premium_nueva":0.30,"premium_renovacion":0.15,"producto":0.10,"meses_renovacion":12}'),
  ('reglas', '{"dias_validacion":15,"minimo_pago":300,"horas_cancelacion":24,"faltas_max":3,"faltas_dias":90,"horas_reporte":48,"dias_gracia":7}');

create or replace function public._coach_cfg(p_clave text) returns jsonb
language sql stable security definer set search_path = public as $$
  select valor from public.coach_config where clave = p_clave $$;

-- ¿Puede este usuario usar el módulo? (interruptor, testers o admin)
create or replace function public._coach_disponible(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_uid is not null and not public.bloqueado_app(p_uid) and (
    coalesce((public._coach_cfg('activo'))::text = 'true', false)
    or coalesce(public._coach_cfg('testers') ? p_uid::text, false)
    or exists (select 1 from public.admins where user_id = p_uid)
  ) $$;

create or replace function public._coach_exigir() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no_autenticado'; end if;
  if not public._coach_disponible(v) then raise exception 'coach_no_disponible'; end if;
  return v;
end $$;

-- ---------- Tablas ----------
create table public.coaches (
  user_id uuid primary key references auth.users (id) on delete cascade,
  estado text not null default 'borrador'
    check (estado in ('borrador','revision','activo','suspendido','rechazado','baja')),
  nivel smallint not null default 1 check (nivel between 1 and 3),
  nombre_publico text check (char_length(nombre_publico) <= 60),
  bio text check (char_length(bio) <= 400),
  especialidades text[] not null default '{}',
  modalidades text[] not null default '{}',
  zona text check (char_length(zona) <= 80),
  gimnasio text check (char_length(gimnasio) <= 80),
  horario text check (char_length(horario) <= 120),
  experiencia_anios smallint check (experiencia_anios between 0 and 60),
  rfc text,
  telefono text,
  precio_sesion numeric(10,2) check (precio_sesion > 0),
  precio_mensual numeric(10,2) check (precio_mensual > 0),
  codigo text unique,
  acepto_terminos_en timestamptz,
  curso_aprobado_en timestamptz,
  primer_pago_en timestamptz,
  membresia_hasta timestamptz,
  stripe_account_id text,
  cobros_habilitados boolean not null default false,
  motivo text,
  nota_admin text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  enviado_en timestamptz,
  aprobado_en timestamptz,
  suspendido_en timestamptz
);
create index coaches_estado on public.coaches (estado);

create table public.coach_documentos (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  tipo text not null check (tipo in ('identificacion','certificacion','licenciatura','rfc','otro')),
  nombre text not null check (char_length(nombre) between 2 and 120),
  emisor text check (char_length(emisor) <= 120),
  archivo text not null check (char_length(archivo) <= 300),
  vence date,
  estado text not null default 'pendiente' check (estado in ('pendiente','valido','rechazado')),
  nota text,
  creado_en timestamptz not null default now(),
  revisado_en timestamptz,
  revisado_por uuid
);
create index coach_documentos_coach on public.coach_documentos (coach_id);

create table public.coach_vinculos (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente','activo','rechazado','terminado')),
  modalidad text not null default 'presencial' check (modalidad in ('presencial','linea')),
  permisos jsonb not null default '{"entrenos":true,"medidas":true,"comidas":false,"mente":false}',
  consentimiento_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  respondido_en timestamptz,
  terminado_en timestamptz,
  terminado_por text
);
-- Un cliente tiene como máximo un coach (pendiente o activo) a la vez
create unique index coach_vinculos_un_coach on public.coach_vinculos (cliente_id) where estado in ('pendiente','activo');
create index coach_vinculos_coach on public.coach_vinculos (coach_id, estado);

create table public.coach_referidos (
  cliente_id uuid primary key references auth.users (id) on delete cascade,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  codigo text,
  creado_en timestamptz not null default now()
);

create table public.coach_sesiones (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  vinculo_id bigint references public.coach_vinculos (id) on delete set null,
  inicio timestamptz not null,
  minutos smallint not null default 60 check (minutos between 15 and 240),
  modalidad text not null check (modalidad in ('presencial','linea')),
  precio numeric(10,2) not null check (precio > 0),
  estado text not null default 'por_pagar' check (estado in
    ('por_pagar','pagada','dada','cancelada_cliente','cancelada_coach','no_show_cliente','no_show_coach','disputa','expirada')),
  reembolso text check (reembolso in ('pendiente','hecho','no_aplica')),
  stripe_pi text unique,
  nota text check (char_length(nota) <= 200),
  calificacion smallint check (calificacion between 1 and 5),
  comentario text check (char_length(comentario) <= 300),
  creado_en timestamptz not null default now(),
  pagada_en timestamptz,
  cerrada_en timestamptz
);
create index coach_sesiones_coach on public.coach_sesiones (coach_id, inicio);
create index coach_sesiones_cliente on public.coach_sesiones (cliente_id, inicio);

create table public.coach_membresia_pagos (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  tipo text not null check (tipo in ('primer_mes','mensual')),
  monto numeric(10,2) not null,
  periodo_fin timestamptz not null,
  referencia text unique not null,
  creado_en timestamptz not null default now(),
  reembolsado_en timestamptz
);

create table public.coach_liquidaciones (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  periodo text not null,
  monto numeric(10,2) not null,
  estado text not null default 'por_pagar' check (estado in ('por_pagar','pagada')),
  referencia text,
  factura text,
  creado_en timestamptz not null default now(),
  pagada_en timestamptz,
  unique (coach_id, periodo)
);

create table public.coach_comisiones (
  id bigserial primary key,
  coach_id uuid not null references public.coaches (user_id) on delete cascade,
  cliente_id uuid references auth.users (id) on delete set null,
  tipo text not null check (tipo in ('premium_nueva','premium_renovacion','producto')),
  referencia text unique not null,
  base numeric(10,2) not null check (base >= 0),
  tasa numeric(5,4) not null,
  monto numeric(10,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','validada','pagada','cancelada')),
  valida_desde timestamptz not null,
  liquidacion_id bigint references public.coach_liquidaciones (id),
  motivo text,
  creado_en timestamptz not null default now()
);
create index coach_comisiones_coach on public.coach_comisiones (coach_id, estado);

-- ---------- Seguridad: lectura propia, escritura solo por funciones ----------
alter table public.coach_config enable row level security;
alter table public.coaches enable row level security;
alter table public.coach_documentos enable row level security;
alter table public.coach_vinculos enable row level security;
alter table public.coach_referidos enable row level security;
alter table public.coach_sesiones enable row level security;
alter table public.coach_membresia_pagos enable row level security;
alter table public.coach_liquidaciones enable row level security;
alter table public.coach_comisiones enable row level security;

revoke all on public.coach_config, public.coaches, public.coach_documentos, public.coach_vinculos,
  public.coach_referidos, public.coach_sesiones, public.coach_membresia_pagos,
  public.coach_liquidaciones, public.coach_comisiones from anon, authenticated;
grant select on public.coaches, public.coach_documentos, public.coach_vinculos, public.coach_sesiones,
  public.coach_membresia_pagos, public.coach_liquidaciones, public.coach_comisiones to authenticated;

create policy coach_propio on public.coaches for select to authenticated using (user_id = auth.uid());
create policy coach_docs_propios on public.coach_documentos for select to authenticated using (coach_id = auth.uid());
create policy coach_vinculo_partes on public.coach_vinculos for select to authenticated using (coach_id = auth.uid() or cliente_id = auth.uid());
create policy coach_sesion_partes on public.coach_sesiones for select to authenticated using (coach_id = auth.uid() or cliente_id = auth.uid());
create policy coach_membresia_propia on public.coach_membresia_pagos for select to authenticated using (coach_id = auth.uid());
create policy coach_liq_propia on public.coach_liquidaciones for select to authenticated using (coach_id = auth.uid());
create policy coach_com_propia on public.coach_comisiones for select to authenticated using (coach_id = auth.uid());

-- ---------- Utilidades ----------
create or replace function public._coach_vigente(c public.coaches) returns boolean
language sql stable security definer set search_path = public as $$
  select c.estado = 'activo' and (
    coalesce((public._coach_cfg('cobro_requerido'))::text, 'true') = 'false'
    or (c.membresia_hasta is not null and c.membresia_hasta > now())) $$;

create or replace function public._coach_tope(p_nivel int, p_tipo text) returns numeric
language sql stable security definer set search_path = public as $$
  select (public._coach_cfg('topes') -> p_nivel::text ->> p_tipo)::numeric $$;

create or replace function public._coach_regla(p text) returns numeric
language sql stable security definer set search_path = public as $$
  select (public._coach_cfg('reglas') ->> p)::numeric $$;

create or replace function public._coach_faltas(p_coach uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.coach_sesiones
  where coach_id = p_coach and estado in ('cancelada_coach','no_show_coach')
    and pagada_en is not null
    and coalesce(cerrada_en, inicio) > now() - make_interval(days => public._coach_regla('faltas_dias')::int) $$;

-- Calificación pública: solo de sesiones pagadas y dadas
create or replace function public._coach_calif(p_coach uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('promedio', round(avg(calificacion)::numeric, 1), 'resenas', count(calificacion))
  from public.coach_sesiones where coach_id = p_coach and estado = 'dada' and calificacion is not null $$;

-- Premium personal del coach: una fila en accesos con origen 'coach'
create or replace function public._coach_premium(p_coach uuid, p_hasta timestamptz) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_hasta is null or p_hasta <= now() then
    update public.accesos set revocado_en = now(), cortado_por = 'coach_fin'
      where user_id = p_coach and origen = 'coach' and revocado_en is null;
    return;
  end if;
  update public.accesos set hasta = p_hasta
    where user_id = p_coach and origen = 'coach' and revocado_en is null;
  if not found then
    insert into public.accesos (user_id, origen, referencia, inicio, hasta)
    values (p_coach, 'coach', 'membresia_coach', now(), p_hasta);
  end if;
end $$;

create or replace function public._coach_publico(c public.coaches) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.user_id, 'nombre', c.nombre_publico, 'bio', c.bio, 'nivel', c.nivel,
    'especialidades', c.especialidades, 'modalidades', c.modalidades, 'zona', c.zona,
    'gimnasio', c.gimnasio, 'horario', c.horario, 'experiencia_anios', c.experiencia_anios,
    'precio_sesion', c.precio_sesion, 'precio_mensual', c.precio_mensual,
    'curso_aprobado', c.curso_aprobado_en is not null,
    'cobros_habilitados', c.cobros_habilitados,
    'credenciales', coalesce((select jsonb_agg(jsonb_build_object('tipo', d.tipo, 'nombre', d.nombre, 'emisor', d.emisor, 'vence', d.vence) order by d.tipo)
       from public.coach_documentos d where d.coach_id = c.user_id and d.estado = 'valido'
         and d.tipo in ('certificacion','licenciatura') and (d.vence is null or d.vence >= current_date)), '[]'),
    'calificacion', public._coach_calif(c.user_id)) $$;

-- =====================================================================
-- Funciones para el COACH
-- =====================================================================
create or replace function public.coach_estado() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid(); c public.coaches; vin record; r jsonb;
begin
  if v is null then return jsonb_build_object('disponible', false); end if;
  select * into c from public.coaches where user_id = v;
  select vi.*, co.nombre_publico into vin from public.coach_vinculos vi join public.coaches co on co.user_id = vi.coach_id
    where vi.cliente_id = v and vi.estado in ('pendiente','activo');
  r := jsonb_build_object(
    'disponible', public._coach_disponible(v),
    'precios', public._coach_cfg('precios'),
    'topes', public._coach_cfg('topes'),
    'cobro_requerido', coalesce((public._coach_cfg('cobro_requerido'))::text, 'true') = 'true',
    'mi_coach', case when vin.id is null then null else jsonb_build_object(
       'vinculo', vin.id, 'coach_id', vin.coach_id, 'nombre', vin.nombre_publico, 'estado', vin.estado,
       'modalidad', vin.modalidad, 'permisos', vin.permisos) end,
    'coach', null);
  if c.user_id is not null then
    r := r || jsonb_build_object('coach', to_jsonb(c) - 'stripe_account_id' - 'nota_admin' || jsonb_build_object(
      'vigente', public._coach_vigente(c),
      'faltas', public._coach_faltas(v),
      'tope_sesion', public._coach_tope(c.nivel, 'sesion'),
      'tope_mensual', public._coach_tope(c.nivel, 'mensual'),
      'documentos', coalesce((select jsonb_agg(to_jsonb(d) - 'revisado_por' order by d.id) from public.coach_documentos d where d.coach_id = v), '[]'),
      'clientes_activos', (select count(*) from public.coach_vinculos where coach_id = v and estado = 'activo'),
      'solicitudes', (select count(*) from public.coach_vinculos where coach_id = v and estado = 'pendiente')));
  end if;
  return r;
end $$;

-- Crea o edita la solicitud / el perfil del coach
create or replace function public.coach_guardar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches; esp text[]; modal text[]; ps numeric; pm numeric; vrfc text;
begin
  select * into c from public.coaches where user_id = v;
  if c.user_id is null then
    insert into public.coaches (user_id) values (v) returning * into c;
  end if;
  if c.estado in ('baja','suspendido') then raise exception 'coach_bloqueado'; end if;

  esp := coalesce(array(select left(trim(x), 30) from jsonb_array_elements_text(coalesce(p -> 'especialidades', to_jsonb(c.especialidades))) x where trim(x) <> '' limit 6), '{}');
  modal := coalesce(array(select x from jsonb_array_elements_text(coalesce(p -> 'modalidades', to_jsonb(c.modalidades))) x where x in ('presencial','linea')), '{}');
  ps := coalesce(nullif(p ->> 'precio_sesion', '')::numeric, c.precio_sesion);
  pm := coalesce(nullif(p ->> 'precio_mensual', '')::numeric, c.precio_mensual);
  if ps is not null and ps > public._coach_tope(c.nivel, 'sesion') then raise exception 'precio_sobre_tope'; end if;
  if pm is not null and pm > public._coach_tope(c.nivel, 'mensual') then raise exception 'precio_sobre_tope'; end if;

  vrfc := c.rfc;
  if p ? 'rfc' then
    if c.estado = 'activo' and upper(trim(p ->> 'rfc')) is distinct from c.rfc then raise exception 'rfc_bloqueado'; end if;
    vrfc := upper(regexp_replace(p ->> 'rfc', '\s', '', 'g'));
    if vrfc !~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$' then raise exception 'rfc_invalido'; end if;
  end if;

  update public.coaches set
    nombre_publico = coalesce(nullif(left(trim(p ->> 'nombre_publico'), 60), ''), nombre_publico),
    bio = case when p ? 'bio' then nullif(left(trim(p ->> 'bio'), 400), '') else bio end,
    especialidades = esp, modalidades = modal,
    zona = case when p ? 'zona' then nullif(left(trim(p ->> 'zona'), 80), '') else zona end,
    gimnasio = case when p ? 'gimnasio' then nullif(left(trim(p ->> 'gimnasio'), 80), '') else gimnasio end,
    horario = case when p ? 'horario' then nullif(left(trim(p ->> 'horario'), 120), '') else horario end,
    experiencia_anios = coalesce(nullif(p ->> 'experiencia_anios', '')::smallint, experiencia_anios),
    telefono = case when p ? 'telefono' then nullif(left(regexp_replace(p ->> 'telefono', '[^0-9+]', '', 'g'), 15), '') else telefono end,
    rfc = vrfc, precio_sesion = ps, precio_mensual = pm,
    acepto_terminos_en = case when (p ->> 'acepto_terminos')::boolean then coalesce(acepto_terminos_en, now()) else acepto_terminos_en end,
    estado = case when estado = 'rechazado' then 'borrador' else estado end,
    actualizado_en = now()
  where user_id = v;
  return public.coach_estado();
end $$;

create or replace function public.coach_documento_agregar(p_tipo text, p_nombre text, p_emisor text, p_archivo text, p_vence date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  if not exists (select 1 from public.coaches where user_id = v and estado not in ('baja','suspendido')) then raise exception 'sin_solicitud'; end if;
  if (select count(*) from public.coach_documentos where coach_id = v) >= 12 then raise exception 'demasiados_documentos'; end if;
  -- El archivo debe estar en la carpeta del propio coach dentro del almacenamiento
  if p_archivo is null or position(v::text || '/' in p_archivo) <> 1 then raise exception 'archivo_invalido'; end if;
  insert into public.coach_documentos (coach_id, tipo, nombre, emisor, archivo, vence)
  values (v, p_tipo, trim(p_nombre), nullif(trim(p_emisor), ''), p_archivo, p_vence);
  return public.coach_estado();
end $$;

create or replace function public.coach_documento_borrar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  delete from public.coach_documentos where id = p_id and coach_id = v and estado <> 'valido';
  if not found then raise exception 'no_se_puede_borrar'; end if;
  return public.coach_estado();
end $$;

create or replace function public.coach_enviar_revision() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches;
begin
  select * into c from public.coaches where user_id = v for update;
  if c.user_id is null or c.estado not in ('borrador') then raise exception 'estado_invalido'; end if;
  if c.nombre_publico is null or c.rfc is null or c.precio_sesion is null or cardinality(c.modalidades) = 0 then raise exception 'faltan_datos'; end if;
  if c.acepto_terminos_en is null then raise exception 'faltan_terminos'; end if;
  if not exists (select 1 from public.coach_documentos where coach_id = v and tipo = 'identificacion' and estado <> 'rechazado')
     or not exists (select 1 from public.coach_documentos where coach_id = v and tipo in ('certificacion','licenciatura') and estado <> 'rechazado')
  then raise exception 'faltan_documentos'; end if;
  if coalesce((public._coach_cfg('cobro_requerido'))::text, 'true') = 'true' and c.primer_pago_en is null then raise exception 'falta_pago'; end if;
  update public.coaches set estado = 'revision', enviado_en = now(), actualizado_en = now() where user_id = v;
  return public.coach_estado();
end $$;

-- ---------- Directorio (cualquier usuario con sesión) ----------
create or replace function public.coach_directorio(p_texto text default null, p_especialidad text default null,
  p_modalidad text default null, p_limite int default 30, p_desde int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  return coalesce((select jsonb_agg(public._coach_publico(c) order by c.nivel desc, c.aprobado_en)
    from (select * from public.coaches c
      where public._coach_vigente(c) and c.user_id <> v
        and (p_especialidad is null or p_especialidad = any (c.especialidades))
        and (p_modalidad is null or p_modalidad = any (c.modalidades))
        and (p_texto is null or (coalesce(c.nombre_publico,'') || ' ' || coalesce(c.zona,'') || ' ' || coalesce(c.gimnasio,'') || ' ' || array_to_string(c.especialidades, ' ')) ilike '%' || p_texto || '%')
      order by c.nivel desc, c.aprobado_en
      limit least(greatest(p_limite, 1), 50) offset greatest(p_desde, 0)) c), '[]');
end $$;

create or replace function public.coach_perfil(p_coach uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches;
begin
  select * into c from public.coaches where user_id = p_coach;
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'coach_no_encontrado'; end if;
  return public._coach_publico(c) || jsonb_build_object('resenas_recientes', coalesce((
    select jsonb_agg(jsonb_build_object('estrellas', s.calificacion, 'comentario', s.comentario,
      'fecha', s.inicio, 'cliente', coalesce(split_part(pf.nombre, ' ', 1), 'Cliente')) order by s.inicio desc)
    from (select * from public.coach_sesiones where coach_id = p_coach and estado = 'dada' and comentario is not null order by inicio desc limit 5) s
    left join public.perfiles pf on pf.id = s.cliente_id), '[]'));
end $$;

-- =====================================================================
-- Vínculo cliente ↔ coach (el cliente decide qué comparte)
-- =====================================================================
create or replace function public._coach_permisos(p jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'entrenos', coalesce(p -> 'entrenos' = 'true'::jsonb, false),
    'medidas',  coalesce(p -> 'medidas' = 'true'::jsonb, false),
    'comidas',  coalesce(p -> 'comidas' = 'true'::jsonb, false),
    'mente',    coalesce(p -> 'mente' = 'true'::jsonb, false)) $$;

create or replace function public.vinculo_solicitar(p_coach uuid, p_modalidad text, p_permisos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches;
begin
  if p_coach = v then raise exception 'no_contigo'; end if;
  select * into c from public.coaches where user_id = p_coach;
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'coach_no_encontrado'; end if;
  if not (p_modalidad = any (c.modalidades)) then raise exception 'modalidad_no_disponible'; end if;
  if exists (select 1 from public.coach_vinculos where cliente_id = v and estado in ('pendiente','activo')) then raise exception 'ya_tienes_coach'; end if;
  insert into public.coach_vinculos (coach_id, cliente_id, modalidad, permisos)
  values (p_coach, v, p_modalidad, public._coach_permisos(p_permisos));
  return public.coach_estado();
end $$;

create or replace function public.vinculo_permisos(p_permisos jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no_autenticado'; end if;
  update public.coach_vinculos set permisos = public._coach_permisos(p_permisos), consentimiento_en = now()
   where cliente_id = v and estado in ('pendiente','activo');
  if not found then raise exception 'sin_coach'; end if;
  return public.coach_estado();
end $$;

create or replace function public.vinculo_responder(p_vinculo bigint, p_aceptar boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches;
begin
  select * into c from public.coaches where user_id = v;
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'coach_no_vigente'; end if;
  update public.coach_vinculos set estado = case when p_aceptar then 'activo' else 'rechazado' end, respondido_en = now()
   where id = p_vinculo and coach_id = v and estado = 'pendiente';
  if not found then raise exception 'solicitud_no_encontrada'; end if;
  -- Al aceptar, el cliente queda referido a este coach si no tenía otro
  if p_aceptar then
    insert into public.coach_referidos (cliente_id, coach_id, codigo)
    select cliente_id, coach_id, 'vinculo' from public.coach_vinculos where id = p_vinculo
    on conflict (cliente_id) do nothing;
  end if;
  return public.coach_estado();
end $$;

-- Cualquiera de las dos partes puede terminar el vínculo
create or replace function public.vinculo_terminar(p_vinculo bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); vin public.coach_vinculos;
begin
  if v is null then raise exception 'no_autenticado'; end if;
  select * into vin from public.coach_vinculos where id = p_vinculo and estado in ('pendiente','activo') and (coach_id = v or cliente_id = v);
  if vin.id is null then raise exception 'vinculo_no_encontrado'; end if;
  update public.coach_vinculos set estado = 'terminado', terminado_en = now(),
    terminado_por = case when vin.coach_id = v then 'coach' else 'cliente' end where id = p_vinculo;
  -- Sesiones pagadas futuras se reembolsan; las no pagadas se cancelan
  update public.coach_sesiones set estado = case when estado = 'pagada' then
      case when vin.coach_id = v then 'cancelada_coach' else 'cancelada_cliente' end else 'expirada' end,
    reembolso = case when estado = 'pagada' then 'pendiente' else reembolso end, cerrada_en = now()
   where vinculo_id = p_vinculo and estado in ('por_pagar','pagada') and inicio > now();
  -- Cambiar de coach mueve la atribución de ventas nuevas
  delete from public.coach_referidos where cliente_id = vin.cliente_id and coach_id = vin.coach_id;
  return public.coach_estado();
end $$;

create or replace function public.coach_mis_clientes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'vinculo', vi.id, 'cliente_id', vi.cliente_id, 'estado', vi.estado, 'modalidad', vi.modalidad,
      'permisos', vi.permisos, 'desde', coalesce(vi.respondido_en, vi.creado_en),
      'nombre', coalesce(nullif(pf.nombre, ''), 'Cliente'),
      'sesiones_dadas', (select count(*) from public.coach_sesiones s where s.vinculo_id = vi.id and s.estado = 'dada'),
      'proxima', (select min(inicio) from public.coach_sesiones s where s.vinculo_id = vi.id and s.estado in ('por_pagar','pagada') and s.inicio > now()))
    order by vi.estado desc, vi.creado_en desc)
    from public.coach_vinculos vi left join public.perfiles pf on pf.id = vi.cliente_id
    where vi.coach_id = v and vi.estado in ('pendiente','activo')), '[]');
end $$;

-- Datos de progreso del cliente, SOLO las categorías que autorizó
create or replace function public.coach_cliente_datos(p_cliente uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); vin public.coach_vinculos; perm jsonb;
begin
  select * into vin from public.coach_vinculos where coach_id = v and cliente_id = p_cliente and estado = 'activo';
  if vin.id is null then raise exception 'sin_permiso'; end if;
  perm := vin.permisos;
  return jsonb_build_object('permisos', perm, 'datos', coalesce((select jsonb_object_agg(p.clave, p.valor) from public.progreso p
    where p.user_id = p_cliente and (
      (coalesce((perm ->> 'entrenos')::boolean, false) and (p.clave like 'gym\_%' or p.clave like 'mma%' or p.clave in ('aet_log_entreno','aet_programa','aet_actividad')))
      or (coalesce((perm ->> 'medidas')::boolean, false) and p.clave in ('medidas_historial','medidas_meta','aet_composicion','aet_metas'))
      or (coalesce((perm ->> 'comidas')::boolean, false) and (p.clave like 'dieta\_%' or p.clave in ('aet_perfil_agua','aet_dia','aet_habitos')))
      or (coalesce((perm ->> 'mente')::boolean, false) and p.clave = 'aet_mente'))), '{}'));
end $$;

-- =====================================================================
-- Sesiones: se reservan y se pagan en la app (el pago lo confirma el servidor)
-- =====================================================================
create or replace function public.sesion_crear(p_vinculo bigint, p_inicio timestamptz, p_minutos int, p_precio numeric, p_nota text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); vin public.coach_vinculos; c public.coaches; id_ bigint;
begin
  select * into c from public.coaches where user_id = v;
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'coach_no_vigente'; end if;
  select * into vin from public.coach_vinculos where id = p_vinculo and coach_id = v and estado = 'activo';
  if vin.id is null then raise exception 'vinculo_no_encontrado'; end if;
  if p_inicio < now() + interval '1 hour' or p_inicio > now() + interval '90 days' then raise exception 'fecha_invalida'; end if;
  if p_precio is null or p_precio <= 0 or p_precio > public._coach_tope(c.nivel, 'sesion') then raise exception 'precio_sobre_tope'; end if;
  if (select count(*) from public.coach_sesiones where vinculo_id = p_vinculo and estado = 'por_pagar') >= 10 then raise exception 'demasiadas_pendientes'; end if;
  insert into public.coach_sesiones (coach_id, cliente_id, vinculo_id, inicio, minutos, modalidad, precio, nota)
  values (v, vin.cliente_id, vin.id, p_inicio, coalesce(p_minutos, 60), vin.modalidad, p_precio, nullif(left(trim(p_nota), 200), ''))
  returning id into id_;
  return jsonb_build_object('id', id_);
end $$;

create or replace function public.sesiones_mias() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no_autenticado'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'inicio', s.inicio, 'minutos', s.minutos, 'modalidad', s.modalidad, 'precio', s.precio,
      'estado', s.estado, 'reembolso', s.reembolso, 'nota', s.nota, 'calificacion', s.calificacion,
      'rol', case when s.coach_id = v then 'coach' else 'cliente' end,
      'con', case when s.coach_id = v then coalesce(nullif(pf.nombre, ''), 'Cliente') else co.nombre_publico end)
    order by s.inicio desc)
    from public.coach_sesiones s
    join public.coaches co on co.user_id = s.coach_id
    left join public.perfiles pf on pf.id = s.cliente_id
    where (s.coach_id = v or s.cliente_id = v) and s.inicio > now() - interval '120 days'), '[]');
end $$;

-- Cancelar: el cliente con 24 h o más recibe reembolso; con menos, no.
-- Si cancela el coach una sesión pagada, siempre hay reembolso y cuenta como falta.
create or replace function public.sesion_cancelar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); s public.coach_sesiones; es_coach boolean; con_reembolso boolean; nuevo text;
begin
  if v is null then raise exception 'no_autenticado'; end if;
  select * into s from public.coach_sesiones where id = p_id and (coach_id = v or cliente_id = v) for update;
  if s.id is null then raise exception 'sesion_no_encontrada'; end if;
  if s.estado not in ('por_pagar','pagada') or s.inicio <= now() then raise exception 'no_se_puede_cancelar'; end if;
  es_coach := s.coach_id = v;
  if s.estado = 'por_pagar' then
    update public.coach_sesiones set estado = 'expirada', cerrada_en = now() where id = p_id;
    return jsonb_build_object('estado', 'expirada', 'reembolso', false);
  end if;
  con_reembolso := es_coach or s.inicio - now() >= make_interval(hours => public._coach_regla('horas_cancelacion')::int);
  nuevo := case when es_coach then 'cancelada_coach' else 'cancelada_cliente' end;
  update public.coach_sesiones set estado = nuevo, cerrada_en = now(),
    reembolso = case when con_reembolso then 'pendiente' else 'no_aplica' end where id = p_id;
  if es_coach then perform public._coach_revisar_faltas(s.coach_id); end if;
  return jsonb_build_object('estado', nuevo, 'reembolso', con_reembolso);
end $$;

-- Después de la hora: el coach marca dada o inasistencia del cliente
create or replace function public.sesion_cerrar(p_id bigint, p_resultado text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  if p_resultado not in ('dada','no_show_cliente') then raise exception 'resultado_invalido'; end if;
  update public.coach_sesiones set estado = p_resultado, cerrada_en = now(), reembolso = 'no_aplica'
   where id = p_id and coach_id = v and estado = 'pagada' and inicio <= now();
  if not found then raise exception 'no_se_puede_cerrar'; end if;
  return jsonb_build_object('estado', p_resultado);
end $$;

-- El cliente reporta que el coach no llegó (hasta 48 h después); lo resuelve admin
create or replace function public.sesion_reportar(p_id bigint, p_detalle text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no_autenticado'; end if;
  update public.coach_sesiones set estado = 'disputa', nota = left(coalesce(nullif(trim(p_detalle), ''), 'El coach no llegó'), 200)
   where id = p_id and cliente_id = v and estado in ('pagada','dada','no_show_cliente') and inicio <= now()
     and inicio > now() - make_interval(hours => public._coach_regla('horas_reporte')::int);
  if not found then raise exception 'no_se_puede_reportar'; end if;
  return jsonb_build_object('estado', 'disputa');
end $$;

create or replace function public.sesion_calificar(p_id bigint, p_estrellas int, p_comentario text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'no_autenticado'; end if;
  if p_estrellas not between 1 and 5 then raise exception 'calificacion_invalida'; end if;
  update public.coach_sesiones set calificacion = p_estrellas, comentario = nullif(left(trim(p_comentario), 300), '')
   where id = p_id and cliente_id = v and estado = 'dada' and calificacion is null;
  if not found then raise exception 'no_se_puede_calificar'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public._coach_revisar_faltas(p_coach uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public._coach_faltas(p_coach) >= public._coach_regla('faltas_max') then
    update public.coaches set estado = 'suspendido', suspendido_en = now(), motivo = 'faltas', actualizado_en = now()
     where user_id = p_coach and estado = 'activo';
    if found then perform public._coach_premium(p_coach, null); end if;
  end if;
end $$;

-- =====================================================================
-- Referidos y comisiones
-- =====================================================================
-- El cliente escribe el código del coach (la primera atribución gana)
create or replace function public.coach_usar_codigo(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v uuid := public._coach_exigir(); c public.coaches;
begin
  select * into c from public.coaches where codigo = upper(trim(p_codigo));
  if c.user_id is null or not public._coach_vigente(c) then raise exception 'codigo_invalido'; end if;
  if c.user_id = v then raise exception 'no_contigo'; end if;
  insert into public.coach_referidos (cliente_id, coach_id, codigo) values (v, c.user_id, c.codigo)
  on conflict (cliente_id) do nothing;
  return jsonb_build_object('coach', c.nombre_publico, 'aplicado', found);
end $$;

-- Lo llama el servidor (webhook) cuando se confirma una venta. No accesible a usuarios.
create or replace function public.coach_comision_registrar(p_cliente uuid, p_tipo text, p_referencia text, p_base numeric, p_comprador_tarjeta text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; c public.coaches; tasa numeric; meses int;
begin
  select * into r from public.coach_referidos where cliente_id = p_cliente;
  if r.cliente_id is null then return jsonb_build_object('registrada', false, 'motivo', 'sin_coach'); end if;
  select * into c from public.coaches where user_id = r.coach_id;
  if c.user_id is null or not public._coach_vigente(c) then return jsonb_build_object('registrada', false, 'motivo', 'coach_no_vigente'); end if;
  if p_cliente = c.user_id then return jsonb_build_object('registrada', false, 'motivo', 'autocompra'); end if;
  if p_tipo = 'premium_renovacion' then
    meses := (public._coach_cfg('comisiones') ->> 'meses_renovacion')::int;
    if r.creado_en < now() - make_interval(months => meses) then return jsonb_build_object('registrada', false, 'motivo', 'fuera_de_plazo'); end if;
  end if;
  tasa := (public._coach_cfg('comisiones') ->> p_tipo)::numeric;
  if tasa is null then raise exception 'tipo_invalido'; end if;
  insert into public.coach_comisiones (coach_id, cliente_id, tipo, referencia, base, tasa, monto, valida_desde)
  values (c.user_id, p_cliente, p_tipo, p_referencia, p_base, tasa, round(p_base * tasa, 2),
          now() + make_interval(days => public._coach_regla('dias_validacion')::int))
  on conflict (referencia) do nothing;
  return jsonb_build_object('registrada', found);
end $$;

-- Reembolso o contracargo: cancela la comisión; si ya se pagó, se descuenta después
create or replace function public.coach_comision_cancelar(p_referencia text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k public.coach_comisiones;
begin
  select * into k from public.coach_comisiones where referencia = p_referencia for update;
  if k.id is null then return jsonb_build_object('ok', false); end if;
  if k.estado in ('pendiente','validada') then
    update public.coach_comisiones set estado = 'cancelada', motivo = p_motivo where id = k.id;
  elsif k.estado = 'pagada' then
    insert into public.coach_comisiones (coach_id, cliente_id, tipo, referencia, base, tasa, monto, estado, valida_desde, motivo)
    values (k.coach_id, k.cliente_id, k.tipo, k.referencia || ':ajuste', 0, k.tasa, -k.monto, 'validada', now(), 'descuento: ' || p_motivo)
    on conflict (referencia) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Tarea diaria: valida comisiones vencidas y arma liquidaciones que superen el mínimo
create or replace function public.coach_procesar_comisiones(p_periodo text default to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM'))
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_val int; n_liq int := 0; r record; liq bigint; minimo numeric := public._coach_regla('minimo_pago');
begin
  update public.coach_comisiones set estado = 'validada' where estado = 'pendiente' and valida_desde <= now();
  get diagnostics n_val = row_count;
  for r in select coach_id, sum(monto) total from public.coach_comisiones
           where estado = 'validada' and liquidacion_id is null group by coach_id having sum(monto) >= minimo loop
    insert into public.coach_liquidaciones (coach_id, periodo, monto) values (r.coach_id, p_periodo, r.total)
    on conflict (coach_id, periodo) do nothing returning id into liq;
    if liq is not null then
      update public.coach_comisiones set liquidacion_id = liq, estado = 'pagada'
       where coach_id = r.coach_id and estado = 'validada' and liquidacion_id is null;
      n_liq := n_liq + 1;
    end if;
  end loop;
  return jsonb_build_object('validadas', n_val, 'liquidaciones', n_liq);
end $$;

create or replace function public.coach_mis_comisiones() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public._coach_exigir();
begin
  return jsonb_build_object(
    'pendiente', coalesce((select sum(monto) from public.coach_comisiones where coach_id = v and estado = 'pendiente'), 0),
    'validada',  coalesce((select sum(monto) from public.coach_comisiones where coach_id = v and estado = 'validada'), 0),
    'pagada',    coalesce((select sum(monto) from public.coach_liquidaciones where coach_id = v and estado = 'pagada'), 0),
    'por_cobrar', coalesce((select sum(monto) from public.coach_liquidaciones where coach_id = v and estado = 'por_pagar'), 0),
    'minimo', public._coach_regla('minimo_pago'),
    'codigo', (select codigo from public.coaches where user_id = v),
    'referidos', (select count(*) from public.coach_referidos where coach_id = v),
    'movimientos', coalesce((select jsonb_agg(jsonb_build_object('tipo', tipo, 'monto', monto, 'estado', estado, 'fecha', creado_en, 'valida_desde', valida_desde) order by creado_en desc)
       from (select * from public.coach_comisiones where coach_id = v order by creado_en desc limit 50) k), '[]'));
end $$;

-- Membresía pagada (la registra el webhook de Stripe)
create or replace function public.coach_membresia_registrar(p_coach uuid, p_tipo text, p_monto numeric, p_referencia text, p_periodo_fin timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.coaches;
begin
  select * into c from public.coaches where user_id = p_coach for update;
  if c.user_id is null then raise exception 'coach_no_encontrado'; end if;
  insert into public.coach_membresia_pagos (coach_id, tipo, monto, periodo_fin, referencia)
  values (p_coach, p_tipo, p_monto, p_periodo_fin, p_referencia) on conflict (referencia) do nothing;
  if not found then return jsonb_build_object('duplicado', true); end if;
  update public.coaches set membresia_hasta = greatest(coalesce(membresia_hasta, p_periodo_fin), p_periodo_fin),
    primer_pago_en = case when p_tipo = 'primer_mes' then coalesce(primer_pago_en, now()) else primer_pago_en end,
    estado = case when estado = 'suspendido' and motivo = 'pago' then 'activo' else estado end,
    actualizado_en = now()
   where user_id = p_coach returning * into c;
  if c.estado = 'activo' then perform public._coach_premium(p_coach, c.membresia_hasta); end if;
  return jsonb_build_object('ok', true, 'membresia_hasta', c.membresia_hasta);
end $$;

-- Tarea diaria: suspende a quien pasó los días de gracia sin pagar
create or replace function public.coach_revisar_membresias() returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  if coalesce((public._coach_cfg('cobro_requerido'))::text, 'true') = 'false' then return jsonb_build_object('suspendidos', 0); end if;
  for r in select user_id from public.coaches where estado = 'activo'
     and membresia_hasta < now() - make_interval(days => public._coach_regla('dias_gracia')::int) loop
    update public.coaches set estado = 'suspendido', suspendido_en = now(), motivo = 'pago', actualizado_en = now() where user_id = r.user_id;
    perform public._coach_premium(r.user_id, null);
    n := n + 1;
  end loop;
  return jsonb_build_object('suspendidos', n);
end $$;

-- =====================================================================
-- ADMIN
-- =====================================================================
create or replace function public._coach_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  return auth.uid();
end $$;

create or replace function public.admin_coaches(p_estado text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public._coach_admin();
begin
  return jsonb_build_object(
    'resumen', (select jsonb_build_object(
       'revision', count(*) filter (where estado = 'revision'),
       'activos', count(*) filter (where estado = 'activo'),
       'suspendidos', count(*) filter (where estado = 'suspendido'),
       'clientes', (select count(*) from public.coach_vinculos where estado = 'activo'),
       'comisiones_por_pagar', (select coalesce(sum(monto), 0) from public.coach_liquidaciones where estado = 'por_pagar'),
       'disputas', (select count(*) from public.coach_sesiones where estado = 'disputa'))
      from public.coaches),
    'config', (select jsonb_object_agg(clave, valor) from public.coach_config),
    'lista', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.user_id, 'nombre', c.nombre_publico, 'email', u.email, 'estado', c.estado, 'nivel', c.nivel,
        'modalidades', c.modalidades, 'enviado_en', c.enviado_en, 'membresia_hasta', c.membresia_hasta,
        'docs_pendientes', (select count(*) from public.coach_documentos d where d.coach_id = c.user_id and d.estado = 'pendiente'))
      order by (c.estado = 'revision') desc, c.enviado_en nulls last, c.creado_en desc)
      from public.coaches c join auth.users u on u.id = c.user_id
      where p_estado is null or c.estado = p_estado), '[]'));
end $$;

create or replace function public.admin_coach_detalle(p_coach uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public._coach_admin(); c public.coaches;
begin
  select * into c from public.coaches where user_id = p_coach;
  if c.user_id is null then raise exception 'coach_no_encontrado'; end if;
  return to_jsonb(c) || jsonb_build_object(
    'email', (select email from auth.users where id = p_coach),
    'faltas', public._coach_faltas(p_coach),
    'calificacion', public._coach_calif(p_coach),
    'documentos', coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.coach_documentos d where d.coach_id = p_coach), '[]'),
    'clientes', (select count(*) from public.coach_vinculos where coach_id = p_coach and estado = 'activo'),
    'pagos', coalesce((select jsonb_agg(to_jsonb(m) order by m.creado_en desc) from public.coach_membresia_pagos m where m.coach_id = p_coach), '[]'),
    'disputas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'inicio', s.inicio, 'precio', s.precio, 'nota', s.nota))
       from public.coach_sesiones s where s.coach_id = p_coach and s.estado = 'disputa'), '[]'));
end $$;

create or replace function public.admin_coach_documento(p_doc bigint, p_estado text, p_nota text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public._coach_admin(); d public.coach_documentos;
begin
  if p_estado not in ('valido','rechazado','pendiente') then raise exception 'estado_invalido'; end if;
  update public.coach_documentos set estado = p_estado, nota = nullif(trim(p_nota), ''), revisado_en = now(), revisado_por = a
   where id = p_doc returning * into d;
  if d.id is null then raise exception 'documento_no_encontrado'; end if;
  return public.admin_coach_detalle(d.coach_id);
end $$;

create or replace function public._coach_nuevo_codigo(p_nombre text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare base text; cod text; i int := 0;
begin
  base := upper(left(regexp_replace(translate(coalesce(p_nombre, 'COACH'), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '[^A-Za-z]', '', 'g'), 6));
  if char_length(base) < 3 then base := 'COACH'; end if;
  loop
    cod := base || lpad((floor(random() * 900) + 100)::int::text, 3, '0');
    exit when not exists (select 1 from public.coaches where codigo = cod);
    i := i + 1; if i > 30 then raise exception 'sin_codigo'; end if;
  end loop;
  return cod;
end $$;

-- aprobar | rechazar | pedir_documento | suspender | reactivar | nivel | curso | baja
create or replace function public.admin_coach_decidir(p_coach uuid, p_accion text, p_motivo text default null, p_nivel int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public._coach_admin(); c public.coaches; hasta timestamptz;
begin
  select * into c from public.coaches where user_id = p_coach for update;
  if c.user_id is null then raise exception 'coach_no_encontrado'; end if;
  if p_accion = 'aprobar' then
    if c.estado <> 'revision' then raise exception 'estado_invalido'; end if;
    if not exists (select 1 from public.coach_documentos where coach_id = p_coach and tipo = 'identificacion' and estado = 'valido')
       or not exists (select 1 from public.coach_documentos where coach_id = p_coach and tipo in ('certificacion','licenciatura') and estado = 'valido')
    then raise exception 'documentos_sin_validar'; end if;
    hasta := coalesce(c.membresia_hasta, case when coalesce((public._coach_cfg('cobro_requerido'))::text, 'true') = 'false' then now() + interval '30 days' end);
    update public.coaches set estado = 'activo', aprobado_en = coalesce(aprobado_en, now()), motivo = null,
      codigo = coalesce(codigo, public._coach_nuevo_codigo(c.nombre_publico)), membresia_hasta = hasta, actualizado_en = now()
     where user_id = p_coach;
    perform public._coach_premium(p_coach, hasta);
  elsif p_accion = 'rechazar' then
    if c.estado <> 'revision' then raise exception 'estado_invalido'; end if;
    update public.coaches set estado = 'rechazado', motivo = coalesce(nullif(trim(p_motivo), ''), 'Sin motivo'), actualizado_en = now() where user_id = p_coach;
  elsif p_accion = 'pedir_documento' then
    if c.estado <> 'revision' then raise exception 'estado_invalido'; end if;
    update public.coaches set estado = 'borrador', motivo = coalesce(nullif(trim(p_motivo), ''), 'Falta un documento'), actualizado_en = now() where user_id = p_coach;
  elsif p_accion = 'suspender' then
    update public.coaches set estado = 'suspendido', suspendido_en = now(), motivo = coalesce(nullif(trim(p_motivo), ''), 'admin'), actualizado_en = now() where user_id = p_coach;
    perform public._coach_premium(p_coach, null);
  elsif p_accion = 'reactivar' then
    if c.estado <> 'suspendido' then raise exception 'estado_invalido'; end if;
    update public.coaches set estado = 'activo', motivo = null, suspendido_en = null, actualizado_en = now() where user_id = p_coach returning * into c;
    perform public._coach_premium(p_coach, c.membresia_hasta);
  elsif p_accion = 'nivel' then
    if p_nivel not between 1 and 3 then raise exception 'nivel_invalido'; end if;
    update public.coaches set nivel = p_nivel,
      precio_sesion = least(precio_sesion, public._coach_tope(p_nivel, 'sesion')),
      precio_mensual = least(precio_mensual, public._coach_tope(p_nivel, 'mensual')), actualizado_en = now()
     where user_id = p_coach;
  elsif p_accion = 'curso' then
    update public.coaches set curso_aprobado_en = coalesce(curso_aprobado_en, now()), actualizado_en = now() where user_id = p_coach;
  elsif p_accion = 'baja' then
    update public.coaches set estado = 'baja', motivo = coalesce(nullif(trim(p_motivo), ''), 'baja'), actualizado_en = now() where user_id = p_coach;
    perform public._coach_premium(p_coach, null);
    update public.coach_vinculos set estado = 'terminado', terminado_en = now(), terminado_por = 'admin'
     where coach_id = p_coach and estado in ('pendiente','activo');
    if coalesce(nullif(trim(p_motivo), ''), '') ilike '%falso%' then
      update public.coach_comisiones set estado = 'cancelada', motivo = 'documentacion_falsa' where coach_id = p_coach and estado in ('pendiente','validada');
    end if;
  else
    raise exception 'accion_invalida';
  end if;
  return public.admin_coach_detalle(p_coach);
end $$;

-- Resolver una disputa: el coach sí faltó (reembolso + falta) o no (se da por dada)
create or replace function public.admin_sesion_resolver(p_id bigint, p_coach_falto boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public._coach_admin(); s public.coach_sesiones;
begin
  update public.coach_sesiones set estado = case when p_coach_falto then 'no_show_coach' else 'dada' end,
    reembolso = case when p_coach_falto then 'pendiente' else 'no_aplica' end, cerrada_en = now()
   where id = p_id and estado = 'disputa' returning * into s;
  if s.id is null then raise exception 'sesion_no_encontrada'; end if;
  if p_coach_falto then perform public._coach_revisar_faltas(s.coach_id); end if;
  return jsonb_build_object('estado', s.estado);
end $$;

create or replace function public.admin_coach_config(p_clave text, p_valor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public._coach_admin();
begin
  if p_clave not in ('activo','testers','cobro_requerido','precios','topes','comisiones','reglas') then raise exception 'clave_invalida'; end if;
  if p_clave in ('activo','cobro_requerido') and jsonb_typeof(p_valor) <> 'boolean' then raise exception 'valor_invalido'; end if;
  if p_clave = 'testers' and jsonb_typeof(p_valor) <> 'array' then raise exception 'valor_invalido'; end if;
  if p_clave in ('precios','topes','comisiones','reglas') and jsonb_typeof(p_valor) <> 'object' then raise exception 'valor_invalido'; end if;
  update public.coach_config set valor = p_valor, actualizado_en = now() where clave = p_clave;
  return (select jsonb_object_agg(clave, valor) from public.coach_config);
end $$;

create or replace function public.admin_coach_liquidaciones() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public._coach_admin();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'coach', c.nombre_publico, 'rfc', c.rfc, 'periodo', l.periodo,
      'monto', l.monto, 'estado', l.estado, 'referencia', l.referencia, 'factura', l.factura) order by l.estado desc, l.creado_en desc)
    from public.coach_liquidaciones l join public.coaches c on c.user_id = l.coach_id), '[]');
end $$;

create or replace function public.admin_coach_liquidacion_pagada(p_id bigint, p_referencia text, p_factura text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public._coach_admin();
begin
  update public.coach_liquidaciones set estado = 'pagada', pagada_en = now(), referencia = nullif(trim(p_referencia), ''), factura = nullif(trim(p_factura), '')
   where id = p_id and estado = 'por_pagar';
  if not found then raise exception 'liquidacion_no_encontrada'; end if;
  return public.admin_coach_liquidaciones();
end $$;

-- ---------- Permisos de ejecución ----------
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like '\_coach%' or p.proname like 'coach\_%' or p.proname like 'vinculo\_%'
                 or p.proname like 'sesion%' or p.proname like 'admin\_coach%' or p.proname = 'admin_sesion_resolver') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not like '\_%' and f.proname not in ('coach_comision_registrar','coach_comision_cancelar','coach_procesar_comisiones',
         'coach_membresia_registrar','coach_revisar_membresias') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
