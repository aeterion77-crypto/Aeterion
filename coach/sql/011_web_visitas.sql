-- 011 · Contador de visitas de la página web (anónimo: sin nombre, correo ni IP).
create table if not exists public.web_visitas (
  id bigserial primary key,
  creado_en timestamptz not null default now(),
  visitante text not null,            -- id aleatorio guardado en el navegador
  tipo text not null default 'vista', -- vista | wa_mayoreo | wa | carrito | app
  ruta text,
  origen text,
  disp text,
  nuevo boolean not null default false
);
create index if not exists web_visitas_fecha on public.web_visitas (creado_en);
create index if not exists web_visitas_visitante on public.web_visitas (visitante, creado_en);
alter table public.web_visitas enable row level security;
revoke all on public.web_visitas from public, anon, authenticated;

create or replace function public.web_registrar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text := left(coalesce(p->>'v', ''), 40); t text := coalesce(p->>'t', 'vista'); d text := p->>'d';
begin
  if v !~ '^[a-z0-9]{8,40}$' then return jsonb_build_object('ok', false); end if;
  if t not in ('vista', 'wa_mayoreo', 'wa', 'carrito', 'app') then return jsonb_build_object('ok', false); end if;
  if d not in ('movil', 'tablet', 'pc') then d := null; end if;
  -- freno: máximo 40 registros por minuto por visitante
  if (select count(*) from public.web_visitas where visitante = v and creado_en > now() - interval '1 minute') >= 40 then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.web_visitas (visitante, tipo, ruta, origen, disp, nuevo)
  values (v, t, left(regexp_replace(coalesce(p->>'r', ''), '[^a-z0-9/_-]', '', 'g'), 60), left(coalesce(p->>'o', ''), 40), d, coalesce((p->>'n')::boolean, false));
  if random() < 0.005 then delete from public.web_visitas where creado_en < now() - interval '400 days'; end if;
  return jsonb_build_object('ok', true);
exception when others then return jsonb_build_object('ok', false);
end $$;

create or replace function public.admin_web_visitas(p_dias int default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
declare dias int := greatest(1, least(coalesce(p_dias, 30), 365)); z text := 'America/Mexico_City';
  desde timestamptz; r jsonb;
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  desde := (date_trunc('day', now() at time zone z) - make_interval(days => dias - 1)) at time zone z;
  with b as (select * from public.web_visitas where creado_en >= desde),
  vis as (select * from b where tipo = 'vista')
  select jsonb_build_object(
    'dias', dias,
    'resumen', jsonb_build_object(
      'visitantes', (select count(distinct visitante) from vis),
      'vistas', (select count(*) from vis),
      'nuevos', (select count(distinct visitante) from vis where nuevo),
      'hoy', (select count(distinct visitante) from vis where creado_en >= date_trunc('day', now() at time zone z) at time zone z),
      'en_linea', (select count(distinct visitante) from public.web_visitas where creado_en > now() - interval '5 minutes'),
      'wa_mayoreo', (select count(*) from b where tipo = 'wa_mayoreo'),
      'wa', (select count(*) from b where tipo = 'wa'),
      'carrito', (select count(*) from b where tipo = 'carrito'),
      'app', (select count(*) from b where tipo = 'app')),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('d', g.d::date, 'visitantes', coalesce(x.visitantes, 0), 'vistas', coalesce(x.vistas, 0)) order by g.d)
        from generate_series((now() at time zone z)::date - (dias - 1), (now() at time zone z)::date, interval '1 day') g(d)
        left join (select (creado_en at time zone z)::date d, count(distinct visitante) visitantes, count(*) vistas from vis group by 1) x on x.d = g.d::date), '[]'),
    'secciones', coalesce((select jsonb_agg(s) from (select coalesce(nullif(ruta, ''), 'inicio') ruta, count(*) vistas, count(distinct visitante) visitantes from vis group by 1 order by 2 desc limit 12) s), '[]'),
    'origenes', coalesce((select jsonb_agg(s) from (select coalesce(nullif(origen, ''), 'Directo') origen, count(distinct visitante) visitantes from vis group by 1 order by 2 desc limit 10) s), '[]'),
    'dispositivos', coalesce((select jsonb_agg(s) from (select coalesce(disp, 'otro') disp, count(distinct visitante) visitantes from vis group by 1 order by 2 desc) s), '[]')
  ) into r;
  return r;
end $$;

revoke all on function public.web_registrar(jsonb), public.admin_web_visitas(int) from public;
grant execute on function public.web_registrar(jsonb) to anon, authenticated;
revoke all on function public.admin_web_visitas(int) from anon;
grant execute on function public.admin_web_visitas(int) to authenticated;
