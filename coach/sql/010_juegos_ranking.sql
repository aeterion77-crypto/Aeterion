-- =====================================================================
-- Aeterion · migración 010: ranking de Juegos (Trivia y Memorama).
-- Cada usuario sube sus mejores marcas; aparece con el nombre que puso
-- en la app y puede ocultarse cuando quiera. Acceso solo por funciones.
-- =====================================================================

create table public.juegos_puntajes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  visible boolean not null default true,
  oculto_admin boolean not null default false,
  trivia_puntos int not null default 0 check (trivia_puntos between 0 and 81000),
  trivia_nivel int not null default 1 check (trivia_nivel between 1 and 15),
  memo_estrellas int not null default 0 check (memo_estrellas between 0 and 300),
  memo_nivel int not null default 1 check (memo_nivel between 1 and 100),
  memo_infinito int not null default 0 check (memo_infinito between 0 and 2000),
  diario_fecha date,
  diario_mov int check (diario_mov between 7 and 500),
  diario_seg int check (diario_seg between 1 and 36000),
  actualizado timestamptz not null default now()
);
create index juegos_trivia on public.juegos_puntajes (trivia_puntos desc) where visible and not oculto_admin;
create index juegos_memo on public.juegos_puntajes (memo_estrellas desc, memo_nivel desc) where visible and not oculto_admin;
alter table public.juegos_puntajes enable row level security;
revoke all on public.juegos_puntajes from anon, authenticated;

create or replace function public._juegos_hoy() returns date language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

-- Nombre público: el que el usuario puso en la app (sin correos), máximo 24 caracteres
create or replace function public._juegos_nombre(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(left(trim(regexp_replace(n, '\s+', ' ', 'g')), 24), ''), 'Atleta Aeterion')
  from (select case when position('@' in coalesce(nombre, '')) > 0 then null else nombre end n from public.perfiles where id = p_user) x
  union all select 'Atleta Aeterion' limit 1 $$;

-- Sube las marcas. Solo pueden mejorar (salvo el reto diario, que es por día).
create or replace function public.juegos_reportar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); hoy date := public._juegos_hoy(); r public.juegos_puntajes;
  tp int := least(greatest(coalesce((p ->> 'trivia_puntos')::int, 0), 0), 81000);
  tn int := least(greatest(coalesce((p ->> 'trivia_nivel')::int, 1), 1), 15);
  me int := least(greatest(coalesce((p ->> 'memo_estrellas')::int, 0), 0), 300);
  mn int := least(greatest(coalesce((p ->> 'memo_nivel')::int, 1), 1), 100);
  mi int := least(greatest(coalesce((p ->> 'memo_infinito')::int, 0), 0), 2000);
  df date; dm int; ds int;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  begin df := nullif(p ->> 'diario_fecha', '')::date; dm := (p ->> 'diario_mov')::int; ds := (p ->> 'diario_seg')::int; exception when others then df := null; end;
  if df is distinct from hoy or dm is null or dm not between 7 and 500 then df := null; end if;
  insert into public.juegos_puntajes (user_id) values (uid) on conflict (user_id) do nothing;
  select * into r from public.juegos_puntajes where user_id = uid for update;
  update public.juegos_puntajes set
    trivia_puntos = greatest(r.trivia_puntos, tp), trivia_nivel = greatest(r.trivia_nivel, tn),
    memo_estrellas = greatest(r.memo_estrellas, me), memo_nivel = greatest(r.memo_nivel, mn), memo_infinito = greatest(r.memo_infinito, mi),
    diario_fecha = case when df is not null then df else r.diario_fecha end,
    diario_mov = case when df is null then r.diario_mov when r.diario_fecha = hoy and r.diario_mov <= dm then r.diario_mov else dm end,
    diario_seg = case when df is null then r.diario_seg when r.diario_fecha = hoy and r.diario_mov <= dm then r.diario_seg else least(greatest(coalesce(ds, 1), 1), 36000) end,
    actualizado = now()
  where user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.juegos_visible(p_visible boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  insert into public.juegos_puntajes (user_id, visible) values (uid, coalesce(p_visible, true))
  on conflict (user_id) do update set visible = coalesce(p_visible, true);
  return jsonb_build_object('visible', coalesce(p_visible, true));
end $$;

-- Tablas: trivia (puntos), memo (estrellas), infinito (parejas en contrarreloj), diario (menos movimientos hoy)
create or replace function public.juegos_ranking(p_tabla text, p_limite int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); hoy date := public._juegos_hoy(); lim int := least(greatest(coalesce(p_limite, 50), 1), 100); res jsonb; yo jsonb; mio public.juegos_puntajes;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_tabla not in ('trivia', 'memo', 'infinito', 'diario') then raise exception 'tipo_invalido'; end if;
  with base as (
    select j.user_id, case p_tabla when 'trivia' then j.trivia_puntos when 'memo' then j.memo_estrellas when 'infinito' then j.memo_infinito else j.diario_mov end valor,
      case p_tabla when 'trivia' then j.trivia_nivel when 'memo' then j.memo_nivel when 'diario' then j.diario_seg else null end extra, j.actualizado
    from public.juegos_puntajes j
    where j.visible and not j.oculto_admin
      and case p_tabla when 'trivia' then j.trivia_puntos > 0 when 'memo' then j.memo_estrellas > 0 when 'infinito' then j.memo_infinito > 0 else j.diario_fecha = hoy and j.diario_mov is not null end),
  orden as (
    select b.*, row_number() over (order by
      case when p_tabla = 'diario' then b.valor end asc, case when p_tabla = 'diario' then b.extra end asc,
      case when p_tabla <> 'diario' then b.valor end desc, case when p_tabla = 'memo' then b.extra end desc, b.actualizado asc) pos
    from base b)
  select jsonb_build_object(
    'lista', coalesce((select jsonb_agg(jsonb_build_object('pos', o.pos, 'nombre', public._juegos_nombre(o.user_id), 'valor', o.valor, 'extra', o.extra, 'yo', o.user_id = uid) order by o.pos) from orden o where o.pos <= lim), '[]'),
    'total', (select count(*) from orden),
    'mi_pos', (select pos from orden where user_id = uid)) into res;
  select * into mio from public.juegos_puntajes where user_id = uid;
  yo := jsonb_build_object('nombre', public._juegos_nombre(uid), 'visible', coalesce(mio.visible, true), 'oculto_admin', coalesce(mio.oculto_admin, false),
    'valor', case p_tabla when 'trivia' then mio.trivia_puntos when 'memo' then mio.memo_estrellas when 'infinito' then mio.memo_infinito else case when mio.diario_fecha = hoy then mio.diario_mov end end,
    'extra', case p_tabla when 'trivia' then mio.trivia_nivel when 'memo' then mio.memo_nivel when 'diario' then case when mio.diario_fecha = hoy then mio.diario_seg end else null end);
  return res || jsonb_build_object('tabla', p_tabla, 'yo', yo);
end $$;

-- Administración: ocultar a alguien del ranking (nombre ofensivo o marcas imposibles)
create or replace function public.admin_juegos_ocultar(p_user uuid, p_ocultar boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  update public.juegos_puntajes set oculto_admin = coalesce(p_ocultar, true) where user_id = p_user;
  return jsonb_build_object('ok', found);
end $$;

revoke all on function public._juegos_hoy(), public._juegos_nombre(uuid) from public, anon, authenticated;
revoke all on function public.juegos_reportar(jsonb), public.juegos_visible(boolean), public.juegos_ranking(text, int), public.admin_juegos_ocultar(uuid, boolean) from public, anon;
grant execute on function public.juegos_reportar(jsonb), public.juegos_visible(boolean), public.juegos_ranking(text, int), public.admin_juegos_ocultar(uuid, boolean) to authenticated;
