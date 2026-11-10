-- 012 · Promoción "Paquete Aeterion": creatina + magnesio + vitamina D3 a precio especial por tiempo limitado.
-- Se configura en ajustes_publicos (clave promo_paquete). Es un descuento automático: los productos siguen
-- siendo líneas normales (existencias, envío y reportes no cambian). No se suma con cupones: gana el mayor.
insert into public.ajustes_publicos (clave, valor) values ('promo_paquete',
  '{"activa": true, "nombre": "Paquete Aeterion", "precio": 849, "fin": "2026-12-12", "ids": ["creatina", "magnesio", "vitd"]}'::jsonb)
on conflict (clave) do update set valor = excluded.valor;

create or replace function public.calcular_carrito(p_items jsonb, p_codigo text default null::text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_lineas jsonb := '[]'::jsonb; v_sub numeric := 0; v_desc numeric := 0;
  r record; pr public.productos%rowtype; cu public.cupones%rowtype;
  v_cod text := upper(trim(coalesce(p_codigo,'')));
  v_n int; v_qty int; v_its jsonb := '[]'::jsonb;
  cfg jsonb; v_sets int; v_base numeric; v_promo numeric := 0; v_promo_nom text; v_id text;
begin
  if coalesce((select (valor ->> 'abierta')::boolean from public.ajustes_publicos where clave = 'tienda'), true) = false then
    return jsonb_build_object('ok', false, 'error', 'tienda_cerrada');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return jsonb_build_object('ok', false, 'error', 'carrito_invalido'); end if;
  v_n := jsonb_array_length(p_items);
  if v_n < 1 or v_n > 10 then return jsonb_build_object('ok', false, 'error', 'carrito_invalido'); end if;
  for r in
    select it->>'id' as id, sum(case when (it->>'qty') ~ '^[0-9]{1,3}$' then (it->>'qty')::int else 0 end) as qty, min(o) as o
    from jsonb_array_elements(p_items) with ordinality as t(it, o)
    group by it->>'id' order by min(o)
  loop
    select * into pr from public.productos where id = r.id;
    v_qty := r.qty;
    if not found or not pr.activo then return jsonb_build_object('ok', false, 'error', 'producto_invalido', 'id', r.id); end if;
    if v_qty < 1 or v_qty > 20 then return jsonb_build_object('ok', false, 'error', 'producto_invalido', 'id', r.id); end if;
    if pr.stock is not null and v_qty > pr.stock then
      return jsonb_build_object('ok', false, 'error', 'sin_stock', 'id', r.id, 'quedan', pr.stock);
    end if;
    v_lineas := v_lineas || jsonb_build_object('id', pr.id, 'nombre', pr.nombre, 'precio', pr.precio, 'qty', v_qty);
    v_its := v_its || jsonb_build_object('id', pr.id, 'qty', v_qty);
    v_sub := v_sub + pr.precio * v_qty;
  end loop;

  if v_cod <> '' then
    select * into cu from public.cupones where codigo = v_cod;
    if not found or not cu.activo then return jsonb_build_object('ok', false, 'error', 'cupon_invalido'); end if;
    if cu.vence_en is not null and cu.vence_en <= now() then return jsonb_build_object('ok', false, 'error', 'cupon_vencido'); end if;
    if cu.max_usos is not null and cu.usos >= cu.max_usos then return jsonb_build_object('ok', false, 'error', 'cupon_agotado'); end if;
    if v_sub < cu.minimo_compra then return jsonb_build_object('ok', false, 'error', 'cupon_minimo', 'minimo', cu.minimo_compra); end if;
    v_desc := case when cu.tipo = 'porcentaje' then round(v_sub * cu.valor / 100) else cu.valor end;
    v_desc := greatest(0, least(v_desc, v_sub - 10));
  end if;

  -- Promoción de paquete: cada juego completo (uno de cada producto) cuesta el precio especial
  select valor into cfg from public.ajustes_publicos where clave = 'promo_paquete';
  if cfg is not null and coalesce((cfg->>'activa')::boolean, false) and (cfg->>'precio') ~ '^[0-9]+(\.[0-9]+)?$'
     and now() < (((cfg->>'fin')::date + 1)::timestamp at time zone 'America/Mexico_City') then
    v_sets := null; v_base := 0;
    for v_id in select jsonb_array_elements_text(cfg->'ids') loop
      v_qty := coalesce((select (l->>'qty')::int from jsonb_array_elements(v_lineas) l where l->>'id' = v_id), 0);
      v_sets := least(coalesce(v_sets, v_qty), v_qty);
      v_base := v_base + coalesce((select (l->>'precio')::numeric from jsonb_array_elements(v_lineas) l where l->>'id' = v_id), 0);
    end loop;
    if coalesce(v_sets, 0) > 0 then
      v_promo := v_sets * greatest(0, v_base - (cfg->>'precio')::numeric);
      v_promo_nom := coalesce(nullif(cfg->>'nombre', ''), 'Promoción');
    end if;
  end if;
  if v_promo > v_desc then v_desc := v_promo; v_cod := ''; else v_promo_nom := null; end if;

  return jsonb_build_object('ok', true, 'lineas', v_lineas, 'items', v_its, 'subtotal', v_sub,
    'descuento', v_desc, 'cupon', case when v_cod <> '' then v_cod end, 'promo', v_promo_nom);
end $function$;

create or replace function public.validar_carrito_publico(p_items jsonb, p_codigo text default null::text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare r jsonb;
begin
  r := public.calcular_carrito(p_items, p_codigo);
  if (r->>'ok')::boolean then
    return jsonb_build_object('ok', true, 'subtotal', r->'subtotal', 'descuento', r->'descuento', 'cupon', r->'cupon', 'promo', r->'promo');
  end if;
  return jsonb_build_object('ok', false, 'error', r->>'error', 'id', r->'id', 'quedan', r->'quedan', 'minimo', r->'minimo');
end $function$;
