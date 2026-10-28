/* ============================================================
   AETERION GYM · punto de venta, inventario, historial de ventas,
   reportes (Excel y PDF), respaldo y productos Aeterion.
   Se apoya en window.__aetGym (gym.js) y usa su diseño (gx-).
============================================================ */
(function () {
'use strict';
const A = window.__aetGym; if (!A) return;
const { VISTAS, llamar, esc, money, moneyK, fCorta, fechaHora, hoyMx, sumaDias, toast, titulo, METODOS, barras, linea, PALETA, puede, ico, kpi, vacio, abrirModal, cerrarModal, segHtml, segVal } = A;
const $ = (id) => document.getElementById(id);
const G = () => A.G, INFO = () => A.INFO;
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; };

/* ---------------- Punto de venta ---------------- */
let PROD = [], CARRO = [], ultima = null, autoTicket = true, CAT = '';
try { autoTicket = localStorage.getItem('aet_gym_autoticket') !== '0'; } catch (e) {}
const totalCarro = () => CARRO.reduce((a, it) => a + Number(it.p.precio) * it.n, 0);
function agregar(p, n) {
  const it = CARRO.find((x) => x.p.id === p.id); const ya = it ? it.n : 0;
  if (ya + (n || 1) > p.existencia) { toast(`Solo hay ${p.existencia} de ${p.nombre}.`); return; }
  if (it) it.n += (n || 1); else CARRO.push({ p, n: n || 1 });
  pintarCarro();
}
function pintarCarro() {
  const el = $('gyCarro'); if (!el) return;
  const sub = totalCarro(), des = Math.min(num(($('gvDesc') || {}).value), sub), tot = sub - des;
  const met = segVal('gvMet') || 'efectivo';
  const con = num(($('gvCon') || {}).value);
  el.innerHTML = CARRO.length ? CARRO.map((it, i) => `<div class="gx-carro-f"><div><b>${esc(it.p.nombre)}</b><small>${money(it.p.precio)} c/u</small></div>
      <div class="gx-cant"><button data-g="pos-menos" data-x="${i}" aria-label="Quitar uno">−</button><span>${it.n}</span><button data-g="pos-mas" data-x="${i}" aria-label="Agregar uno">+</button></div><strong>${money(it.p.precio * it.n)}</strong></div>`).join('')
    : `<div class="gx-carro-vacio">${ico('carrito', 34)}<p>Escanea o toca un producto para agregarlo.</p></div>`;
  const t = $('gyTotales'); if (t) t.innerHTML = `<div class="gx-kv"><span>Subtotal</span><b>${money(sub)}</b></div>${des ? `<div class="gx-kv"><span>Descuento</span><b>−${money(des)}</b></div>` : ''}<div class="gx-kv gx-tot"><span>Total</span><b>${money(tot)}</b></div>${met === 'efectivo' && con >= tot && CARRO.length ? `<div class="gx-kv"><span>Cambio</span><b class="gx-txt-ok">${money(con - tot)}</b></div>` : ''}`;
  const c = $('gvConFila'); if (c) c.style.display = met === 'efectivo' ? '' : 'none';
  const b = $('gvCobrar'); if (b) { b.disabled = !CARRO.length; b.textContent = CARRO.length ? 'Cobrar ' + money(tot) : 'Cobrar'; }
  const n = $('gvNum'); if (n) n.textContent = CARRO.reduce((a, it) => a + it.n, 0);
}
function gridProductos(q) {
  const b = (q || '').toLowerCase();
  const L = PROD.filter((p) => (!CAT || (p.categoria || 'Otros') === CAT) && (!b || p.nombre.toLowerCase().includes(b) || (p.codigo || '') === b || (p.categoria || '').toLowerCase().includes(b)));
  return L.length ? L.slice(0, 80).map((p, i) => `<button class="gx-prod ${p.existencia <= 0 ? 'agotado' : ''}" data-g="pos-agregar" data-x="${p.id}" ${p.existencia <= 0 ? 'disabled' : ''} style="--k:${PALETA[(p.categoria || '').length % PALETA.length]}"><span class="gx-prod-ini">${esc((p.nombre || '?').slice(0, 1).toUpperCase())}</span><b>${esc(p.nombre)}</b><strong>${money(p.precio)}</strong><small class="${p.bajo ? 'gx-txt-warn' : ''}">${p.existencia <= 0 ? 'Agotado' : p.existencia + ' en existencia'}</small></button>`).join('')
    : `<div class="gx-vacio" style="grid-column:1/-1"><b>${PROD.length ? 'Sin coincidencias' : 'Aún no hay productos'}</b>${puede.administrar() && !PROD.length ? '<p>Agrégalos en Inventario.</p><button class="gx-btn" data-g="tab" data-x="g-inventario">Ir a inventario</button>' : ''}</div>`;
}
VISTAS['g-vender'] = async () => {
  PROD = await llamar('gym_productos_listar', { p_gym: G(), p_busca: null });
  CARRO = CARRO.filter((it) => PROD.some((p) => p.id === it.p.id)).map((it) => ({ p: PROD.find((p) => p.id === it.p.id), n: it.n }));
  const cats = [...new Set(PROD.map((p) => p.categoria || 'Otros'))].sort(); if (CAT && !cats.includes(CAT)) CAT = '';
  let h = titulo('Punto de venta', 'Suplementos, bebidas, accesorios y lo que vendas en tu gimnasio', `<button class="gx-btn gx-sec gx-btn-sm" data-g="tab" data-x="g-ventas">${ico('recibo', 18)}Historial</button>`);
  if (ultima) h += `<section class="gx-card gx-venta-ok"><div><b>Venta #${ultima.folio} registrada · ${money(ultima.total)}</b>${ultima.cambio != null ? `<p>Cambio: <b>${money(ultima.cambio)}</b></p>` : ''}</div><div class="gx-fila-btns" style="margin:0"><button class="gx-btn gx-btn-sm" data-g="pos-ticket">Imprimir ticket</button><button class="gx-btn gx-sec gx-btn-sm" data-g="pos-cerrar-ok">Listo</button></div></section>`;
  h += `<div class="gx-pos"><div class="gx-pos-izq"><div class="gx-buscar gx-buscar-in gx-card-lite">${ico('buscar', 18)}<input class="gx-in" id="gvBusca" type="search" placeholder="Buscar o escanear código de barras" autocomplete="off"></div>
      ${cats.length > 1 ? `<div class="gx-chips gx-mt">${[['', 'Todo']].concat(cats.map((c) => [c, c])).map(([k, n]) => `<button class="gx-chip ${CAT === k ? 'on' : ''}" data-g="pos-cat" data-x="${esc(k)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="gx-prods" id="gyProds">${gridProductos('')}</div></div>
    <section class="gx-pos-der gx-card"><div class="gx-card-cab"><b>${ico('carrito', 18)}Venta actual <em class="gx-badge-n" id="gvNum">0</em></b>${CARRO.length ? '<button class="gx-link mal" data-g="pos-vaciar">Vaciar</button>' : ''}</div><div id="gyCarro"></div>
      <div class="gx-form gx-form-2 gx-pos-campos"><label>Descuento $<input class="gx-in" id="gvDesc" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0"></label><label>Socio # <span class="gx-tenue">(opcional)</span><input class="gx-in" id="gvSocio" inputmode="numeric" placeholder="—"></label></div>
      <span class="gx-lab">Método</span>${segHtml('gvMet', Object.entries(METODOS), 'efectivo').replace(/data-g="seg"/g, 'data-g="pos-metodo"')}
      <div id="gvConFila" class="gx-form"><label>Recibe en efectivo<input class="gx-in" id="gvCon" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Para calcular el cambio"></label></div>
      <div id="gyTotales" class="gx-totales"></div>
      <button class="gx-btn gx-btn-xl gx-ancho" id="gvCobrar" data-g="pos-cobrar" disabled>Cobrar</button>
      <label class="gx-check"><input type="checkbox" id="gvAuto" ${autoTicket ? 'checked' : ''}> Imprimir ticket al cobrar</label></section></div>`;
  A.vista.despues = () => { pintarCarro(); const b = $('gvBusca'); if (b && matchMedia('(pointer:fine)').matches) b.focus(); };
  return h;
};

VISTAS['g-ventas'] = async (v) => {
  const hoy = hoyMx(); const r = ['hoy', 'ayer', 'semana', 'mes'].includes(v.r) ? v.r : 'hoy';
  const R = { hoy: [hoy, hoy], ayer: [sumaDias(hoy, -1), sumaDias(hoy, -1)], semana: [sumaDias(hoy, -6), hoy], mes: [hoy.slice(0, 8) + '01', hoy] };
  const ops = puede.administrar() ? ['hoy', 'ayer', 'semana', 'mes'] : ['hoy', 'ayer'];
  const L = await llamar('gym_ventas_listar', { p_gym: G(), p_desde: R[r][0], p_hasta: R[r][1] });
  const ok = L.filter((x) => !x.cancelada); const tot = ok.reduce((a, x) => a + Number(x.total), 0);
  let h = titulo('Ventas', 'Historial del punto de venta', puede.cobrar() ? `<button class="gx-btn" data-g="tab" data-x="g-vender">${ico('carrito', 18)}Nueva venta</button>` : '');
  h += `<div class="gx-chips gx-mb">${ops.map((k) => `<button class="gx-chip ${r === k ? 'on' : ''}" data-g="rango" data-x="${k}">${{ hoy: 'Hoy', ayer: 'Ayer', semana: '7 días', mes: 'Este mes' }[k]}</button>`).join('')}</div>`;
  h += `<div class="gx-kpis gx-kpis-3">${kpi('pagos', '#22c55e', money(tot), 'Vendido', '')}${kpi('recibo', '#3b82f6', ok.length, 'Ventas', '')}${kpi('carrito', '#f97316', money(ok.length ? tot / ok.length : 0), 'Ticket promedio', '')}</div>`;
  h += L.length ? `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Folio</th><th>Fecha</th><th>Productos</th><th class="gx-col-md">Método</th><th class="gx-col-md">Atendió</th><th>Total</th></tr></thead><tbody>${L.map((x) => `<tr data-g="venta" data-x="${x.id}" class="${x.cancelada ? 'gx-anulado' : ''}"><td><b>#${x.folio}</b></td><td>${fechaHora(x.fecha)}</td><td>${x.items.map((i) => i.cantidad + ' ' + esc(i.nombre)).join(', ')}${x.socio ? `<br><small class="gx-tenue">#${x.socio.numero} ${esc(x.socio.nombre)}</small>` : ''}${x.cancelada ? `<br><small class="gx-txt-mal">Cancelada: ${esc(x.motivo || '')}</small>` : ''}</td><td class="gx-col-md">${METODOS[x.metodo]}</td><td class="gx-col-md">${esc(x.vendedor || '')}</td><td><b>${money(x.total)}</b></td></tr>`).join('')}</tbody></table></div></section>`
    : vacio('Sin ventas en este periodo');
  return h;
};
VISTAS['g-venta'] = async (v) => {
  const x = await llamar('gym_venta_detalle', { p_gym: G(), p_venta: v.id }); A.vista.venta = x;
  return titulo('Venta #' + x.folio, fechaHora(x.fecha), x.cancelada ? '<em class="gx-pill mal">Cancelada</em>' : '<em class="gx-pill ok">Pagada</em>') + `<section class="gx-card gx-recibo">
    ${x.items.map((i) => `<div class="gx-kv"><span>${i.cantidad} × ${esc(i.nombre)}</span><b>${money(i.importe)}</b></div>`).join('')}
    <div class="gx-kv"><span>Subtotal</span><b>${money(x.subtotal)}</b></div>${Number(x.descuento) ? `<div class="gx-kv"><span>Descuento</span><b>−${money(x.descuento)}</b></div>` : ''}
    <div class="gx-kv gx-tot"><span>Total · ${METODOS[x.metodo]}</span><b>${money(x.total)}</b></div>${x.cambio != null ? `<div class="gx-kv"><span>Recibió / cambio</span><b>${money(x.pago_con)} / ${money(x.cambio)}</b></div>` : ''}
    ${x.socio ? `<div class="gx-kv"><span>Socio</span><b>#${x.socio.numero} ${esc(x.socio.nombre)}</b></div>` : ''}${x.vendedor ? `<div class="gx-kv"><span>Atendió</span><b>${esc(x.vendedor)}</b></div>` : ''}
    ${x.cancelada ? `<p class="gx-txt-mal">Cancelada: ${esc(x.motivo || '')}</p>` : ''}</section>
    <div class="gx-fila-btns"><button class="gx-btn" data-g="reimprimir">${ico('recibo', 18)}Reimprimir ticket</button>${!x.cancelada && puede.administrar() ? '<button class="gx-btn gx-peligro" data-g="cancelar-abrir">Cancelar venta</button>' : ''}</div>
    ${!x.cancelada && !puede.administrar() ? '<p class="gx-tenue gx-peq">Para cancelar una venta pide ayuda a un administrador.</p>' : ''}`;
};

/* ---------------- Inventario ---------------- */
VISTAS['g-inventario'] = async (v) => {
  const L = await llamar('gym_productos_listar', { p_gym: G(), p_busca: v.q || null });
  const valor = L.reduce((a, p) => a + Number(p.costo || 0) * Math.max(0, p.existencia), 0), venta = L.reduce((a, p) => a + Number(p.precio || 0) * Math.max(0, p.existencia), 0);
  const bajos = L.filter((p) => p.bajo), agot = L.filter((p) => p.existencia <= 0);
  let h = titulo('Inventario', 'Existencias, entradas de mercancía y ajustes por conteo', puede.administrar() ? `<button class="gx-btn" data-g="ir" data-x="g-producto">${ico('mas1', 18)}Nuevo producto</button>` : '');
  h += `<div class="gx-kpis">${kpi('caja', '#3b82f6', L.length, 'Productos', '')}${kpi('pagos', '#8b5cf6', moneyK(valor), 'Valor en costo', '')}${kpi('grafica', '#22c55e', moneyK(venta - valor), 'Ganancia posible', '<span class="gx-kpi-sub">si vendes todo</span>')}${kpi('alerta', '#ef4444', bajos.length, 'Por agotarse', agot.length ? `<span class="gx-kpi-sub">${agot.length} agotados</span>` : '')}</div>`;
  h += `<div class="gx-barra-filtros"><div class="gx-buscar gx-buscar-in gx-card-lite">${ico('buscar', 18)}<input class="gx-in" id="gyBuscaProd" type="search" placeholder="Buscar por nombre, código o categoría" value="${esc(v.q || '')}"></div></div>`;
  h += L.length ? `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Producto</th><th>Precio</th><th class="gx-col-md">Costo</th><th class="gx-col-md">Margen</th><th>Existencia</th><th></th></tr></thead><tbody>
      ${L.map((p) => { const mg = Number(p.precio) ? Math.round((Number(p.precio) - Number(p.costo || 0)) * 100 / Number(p.precio)) : 0; const pct = Math.min(100, Math.round(p.existencia * 100 / Math.max(1, (p.minimo || 1) * 4)));
        return `<tr><td data-g="ir-prod" data-x="${p.id}"><b>${esc(p.nombre)}</b><br><small class="gx-tenue">${esc([p.categoria, p.codigo].filter(Boolean).join(' · ') || '—')}</small></td><td>${money(p.precio)}</td><td class="gx-col-md">${money(p.costo)}</td><td class="gx-col-md">${Number(p.costo) ? mg + '%' : '—'}</td>
        <td><div class="gx-stock ${p.existencia <= 0 ? 'mal' : p.bajo ? 'warn' : 'ok'}"><b>${p.existencia}</b><div><i style="width:${pct}%"></i></div></div>${p.bajo ? `<small class="gx-tenue">mín. ${p.minimo}</small>` : ''}</td>
        <td class="gx-acc-cel">${puede.administrar() ? `<button class="gx-btn gx-btn-sm gx-sec" data-g="inv-abrir" data-x="${p.id}" data-t="entrada">+ Entrada</button><button class="gx-link" data-g="ir-prod" data-x="${p.id}">Editar</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></section>`
    : vacio(v.q ? 'Sin resultados' : 'Aún no tienes productos', v.q ? '' : 'Agrega lo que vendes: agua, bebidas, suplementos, toallas, candados…', puede.administrar() && !v.q ? '<button class="gx-btn" data-g="ir" data-x="g-producto">Agregar el primero</button>' : '');
  A.vista.prods = L;
  return h;
};
VISTAS['g-producto'] = async (v) => {
  const p = v.id ? (await llamar('gym_productos_listar', { p_gym: G(), p_busca: null })).find((x) => x.id === v.id) || {} : {};
  A.vista.prod = p; A.vista.prods = p.id ? [p] : [];
  let h = titulo(p.id ? esc(p.nombre) : 'Nuevo producto', p.id ? 'Editar producto' : '');
  if (p.id) h += `<div class="gx-kpis gx-kpis-3">${kpi('caja', p.existencia <= 0 ? '#ef4444' : p.bajo ? '#f59e0b' : '#22c55e', p.existencia, 'Existencia', `<span class="gx-kpi-sub">aviso al llegar a ${p.minimo}</span>`)}${kpi('pagos', '#3b82f6', money(p.precio), 'Precio', '')}${kpi('grafica', '#8b5cf6', money(Number(p.precio) - Number(p.costo || 0)), 'Ganancia por pieza', '')}</div>
    <div class="gx-fila-btns gx-mb"><button class="gx-btn" data-g="inv-abrir" data-x="${p.id}" data-t="entrada">${ico('mas1', 18)}Entrada de mercancía</button><button class="gx-btn gx-sec" data-g="inv-abrir" data-x="${p.id}" data-t="ajuste">Ajustar por conteo</button><button class="gx-btn gx-sec" data-g="ir-kardex" data-x="${p.id}">Movimientos</button></div>`;
  h += `<section class="gx-card gx-form gx-form-2">
    <label class="gx-ancho2">Nombre<input class="gx-in" id="gpNomP" maxlength="80" value="${esc(p.nombre || '')}"></label>
    <label>Código de barras <span class="gx-tenue">(opcional)</span><input class="gx-in" id="gpCod" maxlength="40" value="${esc(p.codigo || '')}"></label><label>Categoría<input class="gx-in" id="gpCat" maxlength="40" placeholder="Bebidas, suplementos…" value="${esc(p.categoria || '')}"></label>
    <label>Precio de venta<input class="gx-in" id="gpPre" type="number" min="0" step="0.01" value="${p.precio != null ? p.precio : ''}"></label><label>Costo<input class="gx-in" id="gpCos" type="number" min="0" step="0.01" value="${p.costo != null ? p.costo : ''}"></label>
    ${p.id ? '' : '<label>Existencia inicial<input class="gx-in" id="gpEx" type="number" min="0" step="1" value="0"></label>'}<label>Avisar cuando queden<input class="gx-in" id="gpMin" type="number" min="0" step="1" value="${p.minimo != null ? p.minimo : 3}"></label>
    <p class="gx-tenue gx-peq gx-ancho2" id="gpMargen"></p>
    <div class="gx-ancho2 gx-fila-btns"><button class="gx-btn gx-btn-lg" data-g="guardar-prod" data-x="${p.id || ''}">${p.id ? 'Guardar' : 'Agregar producto'}</button>${p.id ? '<button class="gx-link mal" data-g="baja-prod">Ya no lo vendo</button>' : ''}</div></section>`;
  return h;
};
VISTAS['g-kardex'] = async (v) => {
  const L = await llamar('gym_inventario_movs', { p_gym: G(), p_producto: v.id });
  const T = { entrada: ['Entrada', 'ok'], ajuste: ['Ajuste', 'info'], venta: ['Venta', 'gris'], cancelacion: ['Cancelación', 'warn'] };
  return titulo('Movimientos', 'Últimos 60 movimientos del producto') + (L.length ? `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Fecha</th><th>Tipo</th><th class="gx-col-md">Nota</th><th>Cantidad</th><th>Queda</th></tr></thead><tbody>${L.map((m) => `<tr><td>${fechaHora(m.fecha)}</td><td><em class="gx-pill ${(T[m.tipo] || ['', 'gris'])[1]}">${(T[m.tipo] || [m.tipo])[0]}</em></td><td class="gx-col-md">${esc(m.nota || '')}</td><td><b class="${m.cantidad < 0 ? 'gx-txt-mal' : 'gx-txt-ok'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</b></td><td>${m.existencia}</td></tr>`).join('')}</tbody></table></div></section>` : vacio('Sin movimientos'));
};

/* ---------------- Reportes ---------------- */
function rangoRep(r, v) {
  const hoy = hoyMx(), y = hoy.slice(0, 4), m = hoy.slice(0, 8);
  const pm = new Date(hoy.slice(0, 7) + '-01T12:00:00Z'); pm.setUTCMonth(pm.getUTCMonth() - 1); const pmi = pm.toISOString().slice(0, 8) + '01'; const pmf = sumaDias(m + '01', -1);
  return { d7: [sumaDias(hoy, -6), hoy], d30: [sumaDias(hoy, -29), hoy], mes: [m + '01', hoy], mesp: [pmi, pmf], anio: [y + '-01-01', hoy], otro: [v.d1 || sumaDias(hoy, -29), v.d2 || hoy] }[r];
}
VISTAS['g-reportes'] = async (v) => {
  const r = v.r && rangoRep(v.r, v) ? v.r : 'd30'; const [d, h2] = rangoRep(r, v);
  const R = await llamar('gym_reporte', { p_gym: G(), p_desde: d, p_hasta: h2 }); A.vista.rep = R;
  const ingresos = Number(R.membresias) + Number(R.ventas), gan = Number(R.ventas) - Number(R.costo_ventas);
  let h = titulo('Reportes', `${fCorta(R.desde)} a ${fCorta(R.hasta)}`, `<button class="gx-btn gx-sec gx-btn-sm" data-g="rep-excel">${ico('caja', 18)}Excel</button><button class="gx-btn gx-sec gx-btn-sm" data-g="rep-pdf">${ico('recibo', 18)}PDF</button>`);
  h += `<div class="gx-chips gx-mb">${[['d7', '7 días'], ['d30', '30 días'], ['mes', 'Este mes'], ['mesp', 'Mes pasado'], ['anio', 'Este año'], ['otro', 'Elegir fechas']].map(([k, n]) => `<button class="gx-chip ${r === k ? 'on' : ''}" data-g="rep-rango" data-x="${k}">${n}</button>`).join('')}</div>`;
  if (r === 'otro') h += `<section class="gx-card gx-form gx-rep-fechas"><label>Desde<input class="gx-in" type="date" id="grD1" value="${d}"></label><label>Hasta<input class="gx-in" type="date" id="grD2" value="${h2}"></label><button class="gx-btn" data-g="rep-fechas">Ver</button></section>`;
  h += `<div class="gx-kpis">${kpi('pagos', '#22c55e', moneyK(ingresos), 'Ingresos totales', `<span class="gx-kpi-sub">${R.num_pagos} pagos · ${R.num_ventas} ventas</span>`)}${kpi('tarjeta', 'var(--gx-ac)', moneyK(R.membresias), 'Membresías', '')}${kpi('carrito', '#3b82f6', moneyK(R.ventas), 'Ventas', `<span class="gx-kpi-sub">ganancia ${money(gan)}</span>`)}${kpi('socios', '#8b5cf6', R.altas, 'Altas', `<span class="gx-kpi-sub">${R.bajas} bajas · ${R.asistencias} asistencias</span>`)}</div>`;
  let serie = R.serie.map((x) => ({ etiqueta: x.d.slice(8, 10) + '/' + x.d.slice(5, 7), m: Number(x.m), v: Number(x.v), a: x.a }));
  if (serie.length > 62) { const g = {}; serie = []; R.serie.forEach((x) => { const k = x.d.slice(0, 7); if (!g[k]) { g[k] = { etiqueta: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][Number(x.d.slice(5, 7)) - 1], m: 0, v: 0, a: 0 }; serie.push(g[k]); } g[k].m += Number(x.m); g[k].v += Number(x.v); g[k].a += x.a; }); }
  h += `<div class="gx-grid-2"><section class="gx-card"><div class="gx-card-cab"><b>Ingresos</b><span class="gx-ley"><i style="background:var(--gx-ac)"></i>Membresías<i style="background:#3b82f6"></i>Ventas</span></div>${barras(serie.map((x) => ({ etiqueta: x.etiqueta, valores: [x.m, x.v] })), ['var(--gx-ac)', '#3b82f6'], { alto: 170, fmt: money, titulo: 'Ingresos por día' })}</section>
    <section class="gx-card"><div class="gx-card-cab"><b>Asistencias</b><span class="gx-tenue">${R.asistencias} en el periodo</span></div>${linea(serie.map((x) => ({ e: x.etiqueta, v: x.a })), { alto: 170, color: '#8b5cf6', titulo: 'Asistencias por día' })}</section></div>`;
  const met = Object.keys(R.por_metodo || {});
  h += `<div class="gx-grid-2"><section class="gx-card"><div class="gx-card-cab"><b>Por forma de pago</b></div>${met.length ? met.map((k, i) => `<div class="gx-barra-h"><span>${METODOS[k]}</span><div><i style="width:${(Number(R.por_metodo[k]) * 100 / Math.max(1, ingresos)).toFixed(1)}%;background:${PALETA[i]}"></i></div><b>${money(R.por_metodo[k])}</b></div>`).join('') : vacio('Sin movimientos')}</section>
    <section class="gx-card"><div class="gx-card-cab"><b>Membresías vendidas</b></div>${R.por_plan.length ? R.por_plan.map((p, i) => `<div class="gx-barra-h"><span>${esc(p.plan)} · ${p.n}</span><div><i style="width:${(Number(p.monto) * 100 / Math.max(1, Number(R.membresias))).toFixed(1)}%;background:${PALETA[(i + 2) % PALETA.length]}"></i></div><b>${money(p.monto)}</b></div>`).join('') : vacio('Sin pagos')}</section></div>`;
  h += `<section class="gx-card gx-sin-pad"><div class="gx-card-cab gx-pad"><b>Productos más vendidos</b></div>${R.top_productos.length ? `<div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Producto</th><th>Cant.</th><th>Importe</th><th>Ganancia</th></tr></thead><tbody>${R.top_productos.map((p) => `<tr><td><b>${esc(p.nombre)}</b></td><td>${p.cantidad}</td><td>${money(p.importe)}</td><td class="gx-txt-ok">${money(p.ganancia)}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin ventas en el periodo')}
    <p class="gx-tenue gx-peq gx-pad" style="padding-bottom:.9rem">Descuentos dados: ${money(R.descuentos)}.</p></section>`;
  if (puede.administrar()) h += `<section class="gx-card gx-dest"><div><b>Respaldo completo</b><p>Socios, pagos, ventas, inventario y asistencias en un Excel para tu computadora.</p></div><button class="gx-btn" data-g="respaldo">Descargar respaldo</button></section>`;
  return h;
};

function cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = A.base + 'vendor/xlsx.mini.min.js?v=1'; s.onload = () => ok(window.XLSX); s.onerror = () => no(new Error('No se pudo cargar el exportador.')); document.head.appendChild(s); });
}
async function excel(nombre, hojas) {
  const X = await cargarXLSX(); const wb = X.utils.book_new();
  hojas.forEach(([n, filas]) => { const ws = X.utils.json_to_sheet(filas.length ? filas : [{ '': 'Sin datos' }]);
    const cols = Object.keys(filas[0] || { '': '' }); ws['!cols'] = cols.map((c) => ({ wch: Math.min(40, Math.max(10, c.length + 2, ...filas.slice(0, 200).map((f) => String(f[c] == null ? '' : f[c]).length))) }));
    X.utils.book_append_sheet(wb, ws, n.slice(0, 31)); });
  X.writeFile(wb, nombre);
}
const archivo = (t) => (INFO().nombre + ' ' + t).replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, '').replace(/\s+/g, '_');
async function excelPeriodo() {
  const R = A.vista.rep; const [p, v, a] = await Promise.all(['pagos', 'ventas', 'asistencias'].map((t) => llamar('gym_exportar', { p_gym: G(), p_tipo: t, p_desde: R.desde, p_hasta: R.hasta })));
  const resumen = [{ Concepto: 'Periodo', Valor: R.desde + ' a ' + R.hasta }, { Concepto: 'Ingresos totales', Valor: Number(R.membresias) + Number(R.ventas) }, { Concepto: 'Membresías', Valor: Number(R.membresias) },
    { Concepto: 'Ventas', Valor: Number(R.ventas) }, { Concepto: 'Costo de lo vendido', Valor: Number(R.costo_ventas) }, { Concepto: 'Ganancia en ventas', Valor: Number(R.ventas) - Number(R.costo_ventas) },
    { Concepto: 'Descuentos', Valor: Number(R.descuentos) }, { Concepto: 'Altas', Valor: R.altas }, { Concepto: 'Bajas', Valor: R.bajas }, { Concepto: 'Asistencias', Valor: R.asistencias }]
    .concat(Object.keys(R.por_metodo || {}).map((k) => ({ Concepto: 'Cobrado en ' + METODOS[k].toLowerCase(), Valor: Number(R.por_metodo[k]) })));
  const dia = R.serie.map((x) => ({ Fecha: x.d, Membresías: Number(x.m), Ventas: Number(x.v), Total: Number(x.m) + Number(x.v), Asistencias: x.a }));
  await excel(archivo('reporte ' + R.desde + ' a ' + R.hasta) + '.xlsx', [['Resumen', resumen], ['Por día', dia], ['Pagos', p], ['Ventas', v], ['Asistencias', a]]);
}
async function respaldo() {
  const tipos = ['socios', 'pagos', 'ventas', 'productos', 'asistencias'];
  const datos = await Promise.all(tipos.map((t) => llamar('gym_exportar', { p_gym: G(), p_tipo: t, p_desde: null, p_hasta: null })));
  await excel(archivo('respaldo ' + hoyMx()) + '.xlsx', [['Socios', datos[0]], ['Pagos', datos[1]], ['Ventas', datos[2]], ['Inventario', datos[3]], ['Asistencias', datos[4]]]);
}
function pdfPeriodo() {
  const R = A.vista.rep; const ing = Number(R.membresias) + Number(R.ventas);
  const filas = (L) => L.map((x) => `<tr>${x.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  const lg = (INFO().ajustes || {}).logo;
  A.imprimir(`<div style="text-align:left;max-width:760px;margin:0 auto">${lg ? `<div class="logo"><img src="${lg}" alt=""></div>` : ''}<div class="marca">${esc(INFO().nombre.toUpperCase())}</div><h1 style="font-size:24px">Reporte ${fCorta(R.desde)} a ${fCorta(R.hasta)}</h1>
    <table class="rep"><tbody>${filas([['Ingresos totales', money(ing)], ['Membresías', money(R.membresias)], ['Ventas', money(R.ventas)], ['Costo de lo vendido', money(R.costo_ventas)], ['Ganancia en ventas', money(Number(R.ventas) - Number(R.costo_ventas))], ['Descuentos', money(R.descuentos)], ['Altas / bajas', R.altas + ' / ' + R.bajas], ['Asistencias', R.asistencias]])}</tbody></table>
    <h2>Por forma de pago</h2><table class="rep"><tbody>${filas(Object.keys(R.por_metodo || {}).map((k) => [METODOS[k], money(R.por_metodo[k])]))}</tbody></table>
    <h2>Membresías vendidas</h2><table class="rep"><tbody>${filas(R.por_plan.map((p) => [esc(p.plan) + ' (' + p.n + ')', money(p.monto)]))}</tbody></table>
    <h2>Productos más vendidos</h2><table class="rep"><thead><tr><th>Producto</th><th>Cantidad</th><th>Importe</th><th>Ganancia</th></tr></thead><tbody>${filas(R.top_productos.map((p) => [esc(p.nombre), p.cantidad, money(p.importe), money(p.ganancia)]))}</tbody></table>
    <h2>Por día</h2><table class="rep"><thead><tr><th>Fecha</th><th>Membresías</th><th>Ventas</th><th>Asistencias</th></tr></thead><tbody>${filas(R.serie.filter((x) => Number(x.m) || Number(x.v) || x.a).map((x) => [fCorta(x.d), money(x.m), money(x.v), x.a]))}</tbody></table>
    <p style="font-size:11px;color:#777">Generado ${esc(fechaHora(new Date().toISOString()))} con Aeterion Gym. Para guardarlo como PDF elige «Guardar como PDF» al imprimir.</p>
    <style>.rep{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px}.rep td,.rep th{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}.rep td:last-child,.rep th:last-child{text-align:right}h2{font-size:15px;margin:18px 0 4px}</style></div>`, 'Reporte ' + INFO().nombre);
}

/* ---------------- Productos Aeterion (mayoreo) ---------------- */
VISTAS['g-aeterion'] = async () => titulo('Vender productos Aeterion', 'Suplementos y accesorios para tu mostrador') + `<section class="gx-card gx-dest"><div>
    <b>¿Cómo funciona?</b><ol class="gx-doc-l"><li>Pides precios de mayoreo y eliges productos.</li><li>Aeterion te los envía; tú los das de alta en Inventario con tu precio de venta.</li><li>Los vendes en tu Punto de venta y ves tu ganancia en Reportes.</li></ol>
    <p class="gx-tenue gx-peq">Tus socios también pueden comprarlos en la tienda de la app.</p></div></section>
    <section class="gx-card gx-form"><b>Solicitar precios de mayoreo</b><label>¿Qué te interesa y cuántas piezas aproximadamente?<textarea class="gx-in" id="gaMay" rows="4" maxlength="1000" placeholder="Ej. Proteína y creatina, unas 20 piezas al mes"></textarea></label>
    <div class="gx-form-acc"><button class="gx-btn" data-g="pedir-mayoreo">Enviar a Aeterion</button></div><p class="gx-tenue gx-peq">Te contestamos por correo o WhatsApp.</p></section>`;

/* ---------------- Acciones ---------------- */
window.__gymAccion = async function (a, x, el, ocupado) {
  switch (a) {
    case 'pos-agregar': { const p = PROD.find((q) => String(q.id) === x); if (p) agregar(p, 1); return; }
    case 'pos-mas': { const it = CARRO[Number(x)]; if (it) agregar(it.p, 1); return; }
    case 'pos-menos': { const it = CARRO[Number(x)]; if (!it) return; it.n -= 1; if (it.n <= 0) CARRO.splice(Number(x), 1); pintarCarro(); return; }
    case 'pos-vaciar': CARRO = []; return A.pintar();
    case 'pos-cat': CAT = x || ''; el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); { const g = $('gyProds'); if (g) g.innerHTML = gridProductos(($('gvBusca') || {}).value || ''); } return;
    case 'pos-metodo': el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); pintarCarro(); return;
    case 'pos-cerrar-ok': ultima = null; return A.pintar();
    case 'pos-ticket': if (ultima) A.ticketVenta(ultima); return;
    case 'pos-cobrar': return ocupado(async () => {
      if (!CARRO.length) throw new Error('Agrega al menos un producto.');
      const met = segVal('gvMet') || 'efectivo', des = num($('gvDesc').value), sub = totalCarro();
      if (des > sub) throw new Error('El descuento no puede ser mayor que el total.');
      const con = met === 'efectivo' && $('gvCon').value !== '' ? num($('gvCon').value) : null;
      if (con != null && con < sub - des) throw new Error('El efectivo recibido no alcanza.');
      let socio = null; const sn = ($('gvSocio').value || '').trim();
      if (sn) { const L = await llamar('gym_socios_listar', { p_gym: G(), p_filtro: 'activos', p_busca: sn }); const s = L.find((q) => String(q.numero) === sn); if (!s) throw new Error('No encontramos al socio #' + sn + '.'); socio = s.id; }
      autoTicket = $('gvAuto').checked; try { localStorage.setItem('aet_gym_autoticket', autoTicket ? '1' : '0'); } catch (e) {}
      ultima = await llamar('gym_venta_crear', { p_gym: G(), p_items: CARRO.map((it) => ({ producto_id: it.p.id, cantidad: it.n })), p_descuento: des, p_metodo: met, p_pago_con: con, p_socio: socio, p_sede: null });
      CARRO = []; if (autoTicket) A.ticketVenta(ultima); toast('Venta #' + ultima.folio + ' registrada'); await A.pintar();
    });
    case 'venta': if (!x) return; cerrarModal(); return A.ir('g-venta', { id: Number(x) });
    case 'reimprimir': return A.ticketVenta(A.vista.venta);
    case 'cancelar-abrir': abrirModal('Cancelar venta #' + A.vista.venta.folio, `<p>La venta queda marcada como cancelada y los productos regresan al inventario.</p><div class="gx-form"><label>Motivo<input class="gx-in" id="gnMotV" maxlength="160" placeholder="Ej. Devolución del cliente"></label></div>`, `<button class="gx-btn gx-sec" data-g="modal-cerrar">Volver</button><button class="gx-btn gx-peligro" data-g="cancelar-venta">Cancelar venta</button>`); return;
    case 'cancelar-venta': return ocupado(async () => { const m = $('gnMotV').value.trim(); if (!m) throw new Error('Escribe el motivo.'); await llamar('gym_venta_cancelar', { p_gym: G(), p_venta: A.vista.venta.id, p_motivo: m }); cerrarModal(); toast('Venta cancelada'); await A.pintar(); });
    case 'ir-prod': return A.ir('g-producto', { id: Number(x) });
    case 'ir-kardex': return A.ir('g-kardex', { id: Number(x) });
    case 'guardar-prod': return ocupado(async () => {
      const p = { id: x || null, nombre: $('gpNomP').value, codigo: $('gpCod').value, categoria: $('gpCat').value, precio: String($('gpPre').value || ''), costo: String($('gpCos').value || '0'), minimo: String($('gpMin').value || '0'), existencia: $('gpEx') ? String($('gpEx').value || '0') : undefined };
      await llamar('gym_producto_guardar', { p_gym: G(), p }); toast(x ? 'Producto guardado' : 'Producto agregado'); A.volver();
    });
    case 'baja-prod': { const p = A.vista.prod; if (!confirm('¿Dejar de vender «' + p.nombre + '»? Su historial se conserva.')) return; return ocupado(async () => { await llamar('gym_producto_guardar', { p_gym: G(), p: { id: p.id, nombre: p.nombre, codigo: p.codigo || '', categoria: p.categoria || '', precio: String(p.precio), costo: String(p.costo || 0), minimo: String(p.minimo), activo: false } }); A.volver(); }); }
    case 'inv-abrir': {
      const t = el.dataset.t === 'ajuste' ? 'ajuste' : 'entrada'; const p = (A.vista.prods || []).find((q) => String(q.id) === x) || A.vista.prod || {};
      A.vista.inv = { id: Number(x), tipo: t };
      abrirModal(t === 'entrada' ? 'Entrada de mercancía' : 'Ajustar por conteo', `<p><b>${esc(p.nombre || '')}</b> · hay <b>${p.existencia != null ? p.existencia : '—'}</b> en el sistema</p><div class="gx-form"><label>${t === 'entrada' ? '¿Cuántas piezas entraron?' : '¿Cuántas piezas contaste físicamente?'}<input class="gx-in gx-in-xl" id="giCant" type="number" min="${t === 'entrada' ? 1 : 0}" step="1" inputmode="numeric"></label>
        <label>${t === 'entrada' ? 'Nota (proveedor, factura…)' : 'Motivo (merma, caducidad, conteo…)'}<input class="gx-in" id="giNota" maxlength="160"></label></div>`,
        `<button class="gx-btn gx-sec" data-g="modal-cerrar">Cancelar</button><button class="gx-btn" data-g="inv-guardar">${t === 'entrada' ? 'Registrar entrada' : 'Ajustar existencia'}</button>`); return; }
    case 'inv-guardar': return ocupado(async () => {
      const I = A.vista.inv; const v = $('giCant').value; const n = Math.round(num(v)); const nota = $('giNota').value.trim();
      if (v === '' || (I.tipo === 'entrada' && n < 1)) throw new Error('Escribe la cantidad.'); if (I.tipo === 'ajuste' && !nota) throw new Error('Escribe el motivo del ajuste.');
      const r = await llamar('gym_inventario_mov', { p_gym: G(), p_producto: I.id, p_tipo: I.tipo, p_cantidad: n, p_nota: nota });
      cerrarModal(); toast(I.tipo === 'entrada' ? 'Ahora hay ' + r.existencia : 'Existencia ajustada a ' + r.existencia); await A.pintar(); });
    case 'rep-rango': A.vista.r = x; return A.pintar();
    case 'rep-fechas': A.vista.d1 = $('grD1').value; A.vista.d2 = $('grD2').value; return A.pintar();
    case 'rep-excel': return ocupado(excelPeriodo);
    case 'rep-pdf': return pdfPeriodo();
    case 'respaldo': return ocupado(respaldo);
    case 'pedir-mayoreo': return ocupado(async () => { const t = ($('gaMay').value || '').trim(); if (t.length < 5) throw new Error('Cuéntanos qué te interesa.'); await llamar('caso_crear', { p_tipo: 'mayoreo', p_texto: t, p_contra: null, p_ref: { gym_id: G(), gym: INFO().nombre } }); $('gaMay').value = ''; toast('Enviado. Aeterion te contactará pronto.'); });
  }
};
document.addEventListener('input', (e) => {
  const id = e.target && e.target.id;
  if (id === 'gvBusca') { const g = $('gyProds'); if (g) g.innerHTML = gridProductos(e.target.value.trim()); }
  if (id === 'gvDesc' || id === 'gvCon') pintarCarro();
  if (id === 'gpPre' || id === 'gpCos') { const p = num(($('gpPre') || {}).value), c = num(($('gpCos') || {}).value), el = $('gpMargen'); if (el) el.textContent = p && c ? `Ganancia por pieza: ${money(p - c)} (${Math.round((p - c) * 100 / p)}%)` : ''; }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target) return;
  if (e.target.id === 'gvBusca') { e.preventDefault(); const q = e.target.value.trim(); if (!q) return;
    const exacto = PROD.find((p) => p.codigo && p.codigo === q), L = PROD.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()));
    const p = exacto || (L.length === 1 ? L[0] : null); if (p) { agregar(p, 1); e.target.value = ''; const g = $('gyProds'); if (g) g.innerHTML = gridProductos(''); } else toast(L.length ? 'Hay varios: toca el que quieres.' : 'No encontramos ese producto.'); }
  if (e.target.id === 'gyBuscaProd') { A.vista.q = e.target.value.trim(); A.pintar(); }
  if (e.target.id === 'giCant' || e.target.id === 'giNota') { const b = document.querySelector('[data-g="inv-guardar"]'); if (b) b.click(); }
});

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
.gx-raiz .gx-card-lite{background:var(--gx-panel);border:1px solid var(--gx-borde);border-radius:12px;padding:0 .8rem}
.gx-raiz .gx-pos{display:grid;gap:1rem}
.gx-raiz .gx-prods{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem;margin-top:.8rem}
.gx-raiz .gx-prod{position:relative;background:var(--gx-panel);border:1px solid var(--gx-borde);border-radius:14px;padding:.75rem;text-align:left;color:inherit;font:inherit;cursor:pointer;min-height:118px;display:flex;flex-direction:column;gap:.2rem;box-shadow:var(--gx-sombra);transition:border-color .15s,transform .1s}
.gx-raiz .gx-prod:hover{border-color:var(--gx-ac)} .gx-raiz .gx-prod:active{transform:scale(.97)}
.gx-raiz .gx-prod-ini{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-weight:900;background:color-mix(in srgb,var(--k) 18%,transparent);color:var(--k);margin-bottom:.2rem}
.gx-raiz .gx-prod b{font-size:13.5px;line-height:1.25} .gx-raiz .gx-prod strong{color:var(--gx-ac);font-size:16px} .gx-raiz .gx-prod small{font-size:11.5px;color:var(--gx-txt2);margin-top:auto}
.gx-raiz .gx-prod.agotado{opacity:.4;cursor:not-allowed}
.gx-raiz .gx-pos-der{margin:0} .gx-raiz .gx-badge-n{font-style:normal;font-size:11px;background:var(--gx-ac);color:var(--gx-ac-txt);border-radius:20px;padding:1px 8px}
.gx-raiz .gx-carro-vacio{text-align:center;color:var(--gx-txt2);padding:1.2rem 0;border:2px dashed var(--gx-borde2);border-radius:14px} .gx-raiz .gx-carro-vacio p{font-size:13px;margin:.3rem 0 0}
.gx-raiz .gx-carro-f{display:flex;align-items:center;gap:.5rem;padding:.55rem 0;border-bottom:1px solid var(--gx-borde)} .gx-raiz .gx-carro-f > div:first-child{flex:1;min-width:0}
.gx-raiz .gx-carro-f b{display:block;font-size:13.5px} .gx-raiz .gx-carro-f small{font-size:11.5px;color:var(--gx-txt2)} .gx-raiz .gx-carro-f strong{min-width:70px;text-align:right}
.gx-raiz .gx-cant{display:flex;align-items:center;gap:.3rem} .gx-raiz .gx-cant button{width:34px;height:34px;border-radius:10px;border:1px solid var(--gx-borde2);background:var(--gx-panel2);color:var(--gx-txt);font-size:17px;cursor:pointer} .gx-raiz .gx-cant span{min-width:22px;text-align:center;font-weight:700}
.gx-raiz .gx-pos-campos{margin-top:.2rem} .gx-raiz .gx-totales{background:var(--gx-panel2);border-radius:12px;padding:.3rem .8rem;margin:.9rem 0}
.gx-raiz .gx-tot b{font-size:24px;color:var(--gx-ac)} .gx-raiz .gx-txt-ok{color:#16a34a;font-weight:700} .gx-raiz:not(.gx-claro) .gx-txt-ok{color:#4ade80}
.gx-raiz .gx-check{display:flex!important;align-items:center;gap:.5rem;font-size:13px;color:var(--gx-txt2);margin-top:.7rem;font-weight:500}
.gx-raiz .gx-venta-ok{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;border-color:rgba(34,197,94,.5);background:rgba(34,197,94,.08)}
.gx-raiz .gx-stock{display:flex;align-items:center;gap:.5rem;min-width:90px} .gx-raiz .gx-stock b{min-width:28px} .gx-raiz .gx-stock div{flex:1;height:6px;border-radius:6px;background:var(--gx-panel2);overflow:hidden;max-width:70px}
.gx-raiz .gx-stock i{display:block;height:100%;border-radius:6px} .gx-raiz .gx-stock.ok i{background:#22c55e} .gx-raiz .gx-stock.warn i{background:#f59e0b} .gx-raiz .gx-stock.mal i{background:#ef4444} .gx-raiz .gx-stock.mal b{color:#ef4444} .gx-raiz .gx-stock.warn b{color:#d97706}
.gx-raiz .gx-barra-h{display:grid;grid-template-columns:120px 1fr auto;gap:.7rem;align-items:center;margin:.55rem 0;font-size:13px} .gx-raiz .gx-barra-h > div{height:10px;background:var(--gx-panel2);border-radius:6px;overflow:hidden} .gx-raiz .gx-barra-h i{display:block;height:100%;border-radius:6px}
.gx-raiz .gx-rep-fechas{display:flex;gap:.8rem;align-items:flex-end;flex-wrap:wrap} .gx-raiz .gx-rep-fechas label{margin:0;flex:1;min-width:140px}
.gx-raiz .gx-recibo{max-width:560px} .gx-raiz .gx-doc-l{padding-left:1.2rem;margin:.4rem 0} .gx-raiz .gx-doc-l li{margin:.35rem 0}
.gx-raiz textarea.gx-in{resize:vertical;min-height:100px}
@media (min-width:1000px){ .gx-raiz .gx-pos{grid-template-columns:minmax(0,1fr) 380px;align-items:start} .gx-raiz .gx-pos-der{position:sticky;top:84px} }
`;
document.head.appendChild(css);
})();
