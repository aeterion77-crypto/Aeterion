-- Imitación mínima de Supabase para probar en local (PGlite). NUNCA se aplica a producción.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Tablas existentes en producción que el módulo usa (mismas columnas relevantes)
create table public.perfiles (id uuid primary key, email text, nombre text, creado_en timestamptz default now());
create table public.progreso (user_id uuid, clave text, valor text, version bigint default 1, actualizado_en timestamptz default now(), primary key (user_id, clave));
create table public.accesos (id bigserial primary key, user_id uuid not null, origen text not null, referencia text, inicio timestamptz default now(), hasta timestamptz not null, revocado_en timestamptz, creado_en timestamptz default now(), cortado_por text, aviso1_en timestamptz, aviso2_en timestamptz,
  constraint accesos_origen_check check (origen = any (array['codigo','pago','admin','promo'])));
create unique index accesos_promo_unico on public.accesos (user_id) where origen = 'promo';
create table public.admins (user_id uuid primary key);
create table public.usuarios_bloqueos (user_id uuid primary key);
create function public.bloqueado_app(p uuid) returns boolean language sql stable as $$
  select exists (select 1 from public.usuarios_bloqueos where user_id = p) $$;
-- es_admin real exige clave y dispositivo; aquí basta con estar en admins
create function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid()) $$;
create function public.tiene_acceso() returns boolean language sql stable security definer set search_path = public as $$
  select not public.bloqueado_app(auth.uid()) and exists (select 1 from public.accesos a
    where a.user_id = auth.uid() and a.revocado_en is null and a.inicio <= now() and a.hasta > now()) $$;
alter table public.progreso enable row level security;
alter table public.accesos enable row level security;
grant select, insert, update on public.progreso to authenticated;
grant select on public.accesos, public.perfiles to authenticated;
create policy progreso_propio on public.progreso for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy accesos_propios on public.accesos for select to authenticated using (user_id = auth.uid());
