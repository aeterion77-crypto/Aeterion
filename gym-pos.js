/* ============================================================
   AETERION GYM · punto de venta, inventario, historial de ventas,
   reportes (Excel y PDF), respaldo, ticket y productos Aeterion.
   Se apoya en window.__aetGym (gym.js).
============================================================ */
(function () {
'use strict';
const A = window.__aetGym; if (!A) return;
const { VISTAS, llamar, esc, money, fCorta, fechaHora, hoyMx, sumaDias, toast, titulo, METODOS, barras, PALETA, puede } = A;
const $ = (id) => document.getElementById(id);
const G = () => A.G, INFO = () => A.INFO;
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; };

/* ---------------- Punto de venta ---------------- */
let PROD = [], CARRO = [], ultima = null, autoTicket = true;
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
  const met = (($('gvMet') || document).querySelector('.on') || { dataset: { x: 'efectivo' } }).dataset.x;
  const con = num(($('gvCon') || {}).value);
  el.innerHTML = CARRO.length ? CARRO.map((it, i) => `<div class="gy-carro-f"><div><b>${esc(it.p.nombre)}</b><small>${money(it.p.precio)} c/u</small></div>
      <div class="gy-cant"><button data-g="pos-menos" data-x="${i}" aria-label="Quitar uno">−</button><span>${it.n}</span><button data-g="pos-mas" data-x="${i}" aria-label="Agregar uno">+</button></div><strong>${money(it.p.precio * it.n)}</strong></div>`).join('')
    : '<p class="gy-peq gy-centro">Escanea o toca un producto para agregarlo.</p>';
  const t = $('gyTotales'); if (t) t.innerHTML = `<div class="gy-kv"><span>Subtotal</span><b>${money(sub)}</b></div>${des ? `<div class="gy-kv"><span>Descuento</span><b>−${money(des)}</b></div>` : ''}<div class="gy-kv gy-tot"><span>Total</span><b>${money(tot)}</b></div>${met === 'efectivo' && con >= tot && CARRO.length ? `<div class="gy-kv"><span>Cambio</span><b class="ok">${money(con - tot)}</b></div>` : ''}`;
  const c = $('gvConFila'); if (c) c.style.display = met === 'efectivo' ? '' : 'none';
  const b = $('gvCobrar'); if (b) { b.disabled = !CARRO.length; b.textContent = CARRO.length ? 'Cobrar ' + money(tot) : 'Cobrar'; }
}
function gridProductos(q) {
  const b = (q || '').toLowerCase();
  const L = PROD.filter((p) => !b || p.nombre.toLowerCase().includes(b) || (p.codigo || '') === b || (p.categoria || '').toLowerCase().includes(b));
  return L.length ? L.slice(0, 60).map((p) => `<button class="gy-prod ${p.existencia <= 0 ? 'agotado' : ''}" data-g="pos-agregar" data-x="${p.id}" ${p.existencia <= 0 ? 'disabled' : ''}><b>${esc(p.nombre)}</b><span>${money(p.precio)}</span><small>${p.existencia <= 0 ? 'Agotado' : p.existencia + ' en existencia'}</small></button>`).join('')
    : `<p class="gy-peq">${PROD.length ? 'Sin coincidencias.' : 'Aún no hay productos.'}${puede.administrar() && !PROD.length ? ' Agrégalos en Inventario.' : ''}</p>`;
}
VISTAS['g-vender'] = async () => {
  PROD = await llamar('gym_productos_listar', { p_gym: G(), p_busca: null });
  CARRO = CARRO.filter((it) => PROD.some((p) => p.id === it.p.id)).map((it) => ({ p: PROD.find((p) => p.id === it.p.id), n: it.n }));
  let h = titulo('Punto de venta', 'Suplementos, bebidas, accesorios y lo que vendas en tu gimnasio', `<button class="gy-btn gy-mini gy-sec-btn" data-g="ir" data-x="g-ventas">Historial</button>`);
  if (ultima) h += `<div class="gy-card gy-venta-ok"><b>Venta #${ultima.folio} registrada · ${money(ultima.total)}</b>${ultima.cambio != null ? `<p>Cambio: <b>${money(ultima.cambio)}</b></p>` : ''}<div class="gy-fila2"><button class="gy-btn gy-mini" data-g="pos-ticket">Imprimir ticket</button><button class="gy-btn gy-mini gy-sec-btn" data-g="pos-cerrar-ok">Listo</button></div></div>`;
  h += `<div class="gy-pos"><div class="gy-pos-izq"><input class="gy-in" id="gvBusca" type="search" placeholder="Buscar o escanear código de barras" autocomplete="off"><div class="gy-prods" id="gyProds">${gridProductos('')}</div></div>
    <div class="gy-pos-der gy-card"><b>Venta actual</b><div id="gyCarro"></div>
      <div class="gy-fila2"><label>Descuento $<input class="gy-in" id="gvDesc" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0"></label><label>Socio # <span class="gy-peq">(opcional)</span><input class="gy-in" id="gvSocio" inputmode="numeric" placeholder="—"></label></div>
      <div class="gy-seg" id="gvMet">${Object.keys(METODOS).map((k, i) => `<button class="${i === 0 ? 'on' : ''}" data-g="pos-metodo" data-x="${k}">${METODOS[k]}</button>`).join('')}</div>
      <div id="gvConFila"><label>Recibe en efectivo<input class="gy-in" id="gvCon" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Para calcular el cambio"></label></div>
      <div id="gyTotales"></div>
      <button class="gy-btn gy-grande" id="gvCobrar" data-g="pos-cobrar" disabled>Cobrar</button>
      <label class="gy-check"><input type="checkbox" id="gvAuto" ${autoTicket ? 'checked' : ''}> Imprimir ticket al cobrar</label>
      ${CARRO.length ? '<button class="gy-link" data-g="pos-vaciar">Vaciar venta</button>' : ''}</div></div>`;
  A.vista.despues = () => { pintarCarro(); const b = $('gvBusca'); if (b && matchMedia('(pointer:fine)').matches) b.focus(); };
  return h;
};

VISTAS['g-ventas'] = async (v) => {
  const hoy = hoyMx(); const r = v.r || 'hoy';
  const R = { hoy: [hoy, hoy], ayer: [sumaDias(hoy, -1), sumaDias(hoy, -1)], semana: [sumaDias(hoy, -6), hoy], mes: [hoy.slice(0, 8) + '01', hoy] };
  const ops = puede.administrar() ? ['hoy', 'ayer', 'semana', 'mes'] : ['hoy', 'ayer'];
  const L = await llamar('gym_ventas_listar', { p_gym: G(), p_desde: R[r][0], p_hasta: R[r][1] });
  const ok = L.filter((x) => !x.cancelada);
  let h = titulo('Historial de ventas', `${ok.length} ${ok.length === 1 ? 'venta' : 'ventas'} · ${money(ok.reduce((a, x) => a + Number(x.total), 0))}`);
  h += `<div class="gy-chips">${ops.map((k) => `<button class="gy-chip ${r === k ? 'on' : ''}" data-g="rango" data-x="${k}">${{ hoy: 'Hoy', ayer: 'Ayer', semana: '7 días', mes: 'Este mes' }[k]}</button>`).join('')}</div>`;
  h += L.length ? '<div class="gy-card">' + L.map((x) => `<button class="gy-pago ${x.cancelada ? 'anulado' : ''}" data-g="venta" data-x="${x.id}"><div><b>#${x.folio} · ${x.items.map((i) => i.cantidad + ' ' + esc(i.nombre)).join(', ')}</b><small>${fechaHora(x.fecha)} · ${METODOS[x.metodo]}${x.socio ? ' · ' + esc(x.socio.nombre) : ''}${x.vendedor ? ' · ' + esc(x.vendedor) : ''}${x.cancelada ? ' · CANCELADA: ' + esc(x.motivo || '') : ''}</small></div><strong>${money(x.total)}</strong></button>`).join('') + '</div>'
    : '<div class="gy-card gy-vacio"><b>Sin ventas en este periodo</b></div>';
  return h;
};
VISTAS['g-venta'] = async (v) => {
  const x = await llamar('gym_venta_detalle', { p_gym: G(), p_venta: v.id }); A.vista.venta = x;
  return titulo('Venta #' + x.folio, fechaHora(x.fecha) + (x.cancelada ? ' · CANCELADA' : '')) + `<div class="gy-card">
    ${x.items.map((i) => `<div class="gy-kv"><span>${i.cantidad} × ${esc(i.nombre)}</span><b>${money(i.importe)}</b></div>`).join('')}
    <div class="gy-kv"><span>Subtotal</span><b>${money(x.subtotal)}</b></div>${Number(x.descuento) ? `<div class="gy-kv"><span>Descuento</span><b>−${money(x.descuento)}</b></div>` : ''}
    <div class="gy-kv gy-tot"><span>Total · ${METODOS[x.metodo]}</span><b>${money(x.total)}</b></div>${x.cambio != null ? `<div class="gy-kv"><span>Recibió / cambio</span><b>${money(x.pago_con)} / ${money(x.cambio)}</b></div>` : ''}
    ${x.socio ? `<div class="gy-kv"><span>Socio</span><b>#${x.socio.numero} ${esc(x.socio.nombre)}</b></div>` : ''}${x.vendedor ? `<div class="gy-kv"><span>Atendió</span><b>${esc(x.vendedor)}</b></div>` : ''}
    ${x.cancelada ? `<p class="gy-debe">Cancelada: ${esc(x.motivo || '')}</p>` : ''}</div>
    <div class="gy-acciones"><button class="gy-btn" data-g="reimprimir">Reimprimir ticket</button>${!x.cancelada && puede.administrar() ? '<button class="gy-btn gy-peligro" style="margin:0" data-g="cancelar-venta">Cancelar venta</button>' : ''}</div>
    ${!x.cancelada && !puede.administrar() ? '<p class="gy-peq">Para cancelar una venta pide ayuda a un administrador.</p>' : ''}`;
};

/* ---------------- Inventario ---------------- */
VISTAS['g-inventario'] = async (v) => {
  const L = await llamar('gym_productos_listar', { p_gym: G(), p_busca: v.q || null });
  const valor = L.reduce((a, p) => a + Number(p.costo || 0) * Math.max(0, p.existencia), 0), bajos = L.filter((p) => p.bajo);
  let h = titulo('Inventario', `${L.length} productos · valor en costo ${money(valor)}`, puede.administrar() ? '<button class="gy-btn gy-mini" data-g="ir" data-x="g-producto">Nuevo producto</button>' : '');
  if (bajos.length) h += `<div class="gy-aviso">Por agotarse: ${bajos.map((p) => esc(p.nombre) + ' (' + p.existencia + ')').join(', ')}</div>`;
  h += `<input class="gy-in" id="gyBuscaProd" type="search" placeholder="Buscar por nombre, código o categoría" value="${esc(v.q || '')}">`;
  h += L.length ? `<div class="gy-card gy-tabla-w"><table class="gy-tabla"><thead><tr><th>Producto</th><th>Precio</th><th class="gy-solo-pc-t">Costo</th><th>Existencia</th><th></th></tr></thead><tbody>
      ${L.map((p) => `<tr class="${p.bajo ? 'bajo' : ''}"><td><b>${esc(p.nombre)}</b><small>${esc([p.categoria, p.codigo].filter(Boolean).join(' · '))}</small></td><td>${money(p.precio)}</td><td class="gy-solo-pc-t">${money(p.costo)}</td><td><b>${p.existencia}</b>${p.bajo ? '<small>mín. ' + p.minimo + '</small>' : ''}</td>
        <td class="gy-acc-t"><button class="gy-link" data-g="inv-entrada" data-x="${p.id}">+ Entrada</button><button class="gy-link" data-g="ir-prod" data-x="${p.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>`
    : '<div class="gy-card gy-vacio"><b>Aún no tienes productos</b><p>Agrega lo que vendes: agua, bebidas, suplementos, toallas, candados…</p></div>';
  return h;
};
VISTAS['g-producto'] = async (v) => {
  const p = v.id ? (await llamar('gym_productos_listar', { p_gym: G(), p_busca: null })).find((x) => x.id === v.id) : {};
  A.vista.prod = p;
  let h = titulo(p.id ? 'Editar producto' : 'Nuevo producto') + `<div class="gy-card gy-form">
    <label>Nombre<input class="gy-in" id="gpNomP" maxlength="80" value="${esc(p.nombre || '')}"></label>
    <div class="gy-fila2"><label>Código de barras <span class="gy-peq">(opcional)</span><input class="gy-in" id="gpCod" maxlength="40" value="${esc(p.codigo || '')}"></label><label>Categoría<input class="gy-in" id="gpCat" maxlength="40" placeholder="Bebidas, suplementos…" value="${esc(p.categoria || '')}"></label></div>
    <div class="gy-fila2"><label>Precio de venta<input class="gy-in" id="gpPre" type="number" min="0" step="0.01" value="${p.precio != null ? p.precio : ''}"></label><label>Costo<input class="gy-in" id="gpCos" type="number" min="0" step="0.01" value="${p.costo != null ? p.costo : ''}"></label></div>
    <div class="gy-fila2">${p.id ? '' : '<label>Existencia inicial<input class="gy-in" id="gpEx" type="number" min="0" step="1" value="0"></label>'}<label>Avisar cuando queden<input class="gy-in" id="gpMin" type="number" min="0" step="1" value="${p.minimo != null ? p.minimo : 3}"></label></div>
    <p class="gy-peq" id="gpMargen"></p>
    <button class="gy-btn gy-grande" data-g="guardar-prod" data-x="${p.id || ''}">${p.id ? 'Guardar' : 'Agregar producto'}</button>
    ${p.id ? '<button class="gy-link" data-g="baja-prod">Ya no lo vendo</button>' : ''}</div>`;
  if (p.id) h += `<div class="gy-card"><b>Existencia: ${p.existencia}</b><div class="gy-fila2"><button class="gy-btn gy-mini" data-g="inv-entrada" data-x="${p.id}">Entrada de mercancía</button><button class="gy-btn gy-mini gy-sec-btn" data-g="inv-ajuste" data-x="${p.id}">Ajustar por conteo</button><button class="gy-btn gy-mini gy-sec-btn" data-g="ir-kardex" data-x="${p.id}">Movimientos</button></div></div>`;
  return h;
};
VISTAS['g-kardex'] = async (v) => {
  const L = await llamar('gym_inventario_movs', { p_gym: G(), p_producto: v.id });
  const T = { entrada: 'Entrada', ajuste: 'Ajuste', venta: 'Venta', cancelacion: 'Cancelación' };
  return titulo('Movimientos', 'Últimos 60 movimientos del producto') + (L.length ? '<div class="gy-card">' + L.map((m) => `<div class="gy-kv"><span>${fechaHora(m.fecha)} · ${T[m.tipo]}${m.nota ? ' · ' + esc(m.nota) : ''}</span><b class="${m.cantidad < 0 ? 'mal' : 'ok'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad} → ${m.existencia}</b></div>`).join('') + '</div>' : '<p class="gy-peq">Sin movimientos.</p>');
};

/* ---------------- Reportes ---------------- */
function rangoRep(r, v) {
  const hoy = hoyMx(), y = hoy.slice(0, 4), m = hoy.slice(0, 8);
  const pm = new Date(hoy.slice(0, 7) + '-01T12:00:00Z'); pm.setUTCMonth(pm.getUTCMonth() - 1); const pmi = pm.toISOString().slice(0, 8) + '01'; const pmf = sumaDias(m + '01', -1);
  return { d7: [sumaDias(hoy, -6), hoy], d30: [sumaDias(hoy, -29), hoy], mes: [m + '01', hoy], mesp: [pmi, pmf], anio: [y + '-01-01', hoy], otro: [v.d1 || sumaDias(hoy, -29), v.d2 || hoy] }[r];
}
VISTAS['g-reportes'] = async (v) => {
  const r = v.r || 'd30'; const [d, h2] = rangoRep(r, v);
  const R = await llamar('gym_reporte', { p_gym: G(), p_desde: d, p_hasta: h2 }); A.vista.rep = R;
  const ingresos = Number(R.membresias) + Number(R.ventas), gan = Number(R.ventas) - Number(R.costo_ventas);
  let h = titulo('Reportes', `${fCorta(R.desde)} a ${fCorta(R.hasta)}`);
  h += `<div class="gy-chips">${[['d7', '7 días'], ['d30', '30 días'], ['mes', 'Este mes'], ['mesp', 'Mes pasado'], ['anio', 'Este año'], ['otro', 'Elegir fechas']].map(([k, n]) => `<button class="gy-chip ${r === k ? 'on' : ''}" data-g="rep-rango" data-x="${k}">${n}</button>`).join('')}</div>`;
  if (r === 'otro') h += `<div class="gy-fila2"><label>Desde<input class="gy-in" type="date" id="grD1" value="${d}"></label><label>Hasta<input class="gy-in" type="date" id="grD2" value="${h2}"></label><button class="gy-btn" data-g="rep-fechas">Ver</button></div>`;
  h += `<div class="gy-kpis"><div><b>${money(ingresos)}</b><span>Ingresos totales</span></div><div><b>${money(R.membresias)}</b><span>Membresías</span></div><div><b>${money(R.ventas)}</b><span>Ventas</span></div>
    <div><b class="ok">${money(gan)}</b><span>Ganancia en ventas</span></div><div><b>${R.altas}</b><span>Altas</span></div><div><b>${R.asistencias}</b><span>Asistencias</span></div></div>`;
  let serie = R.serie.map((x) => ({ etiqueta: x.d.slice(8, 10) + '/' + x.d.slice(5, 7), m: Number(x.m), v: Number(x.v), a: x.a }));
  if (serie.length > 62) { const g = {}; serie = []; R.serie.forEach((x) => { const k = x.d.slice(0, 7); if (!g[k]) { g[k] = { etiqueta: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][Number(x.d.slice(5, 7)) - 1], m: 0, v: 0, a: 0 }; serie.push(g[k]); } g[k].m += Number(x.m); g[k].v += Number(x.v); g[k].a += x.a; }); }
  h += `<div class="gy-graficas"><div class="gy-card"><b>Ingresos</b><div class="gy-leyenda"><span><i style="background:#c9a84c"></i>Membresías</span><span><i style="background:#7fb3d5"></i>Ventas</span></div>${barras(serie.map((x) => ({ etiqueta: x.etiqueta, valores: [x.m, x.v] })), ['#c9a84c', '#7fb3d5'], { alto: 150, fmt: money, titulo: 'Ingresos por día' })}</div>
    <div class="gy-card"><b>Asistencias</b>${barras(serie.map((x) => ({ etiqueta: x.etiqueta, valores: [x.a] })), ['#4cc38a'], { alto: 150, titulo: 'Asistencias por día' })}</div></div>`;
  const met = Object.keys(R.por_metodo || {});
  h += `<div class="gy-graficas"><div class="gy-card"><b>Por forma de pago</b>${met.length ? met.map((k, i) => `<div class="gy-barra-h"><span>${METODOS[k]}</span><div><i style="width:${(Number(R.por_metodo[k]) * 100 / Math.max(1, ingresos)).toFixed(1)}%;background:${PALETA[i]}"></i></div><b>${money(R.por_metodo[k])}</b></div>`).join('') : '<p class="gy-peq">Sin movimientos.</p>'}</div>
    <div class="gy-card"><b>Membresías vendidas</b>${R.por_plan.length ? R.por_plan.map((p) => `<div class="gy-kv"><span>${esc(p.plan)} · ${p.n}</span><b>${money(p.monto)}</b></div>`).join('') : '<p class="gy-peq">Sin pagos.</p>'}</div></div>`;
  h += `<div class="gy-card"><b>Productos más vendidos</b>${R.top_productos.length ? `<table class="gy-tabla"><thead><tr><th>Producto</th><th>Cant.</th><th>Importe</th><th>Ganancia</th></tr></thead><tbody>${R.top_productos.map((p) => `<tr><td>${esc(p.nombre)}</td><td>${p.cantidad}</td><td>${money(p.importe)}</td><td>${money(p.ganancia)}</td></tr>`).join('')}</tbody></table>` : '<p class="gy-peq">Sin ventas en el periodo.</p>'}
    <p class="gy-peq">Descuentos dados: ${money(R.descuentos)} · ${R.num_ventas} ventas · ${R.num_pagos} pagos de membresía · ${R.bajas} bajas.</p></div>`;
  h += `<div class="gy-card"><b>Exportar</b><div class="gy-fila2"><button class="gy-btn" data-g="rep-excel">Excel del periodo</button><button class="gy-btn gy-sec-btn" data-g="rep-pdf">PDF del periodo</button></div>
    ${puede.administrar() ? '<button class="gy-btn gy-sec-btn gy-grande" data-g="respaldo">Descargar respaldo completo (Excel)</button><p class="gy-peq">Tus datos están guardados en la nube de Aeterion con copias automáticas. El respaldo te deja una copia en tu computadora: socios, pagos, ventas, inventario y asistencias.</p>' : ''}</div>`;
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
  A.imprimir(`<div style="text-align:left;max-width:760px;margin:0 auto"><div class="marca">${esc(INFO().nombre.toUpperCase())}</div><h1 style="font-size:24px">Reporte ${fCorta(R.desde)} a ${fCorta(R.hasta)}</h1>
    <table class="rep"><tbody>${filas([['Ingresos totales', money(ing)], ['Membresías', money(R.membresias)], ['Ventas', money(R.ventas)], ['Costo de lo vendido', money(R.costo_ventas)], ['Ganancia en ventas', money(Number(R.ventas) - Number(R.costo_ventas))], ['Descuentos', money(R.descuentos)], ['Altas / bajas', R.altas + ' / ' + R.bajas], ['Asistencias', R.asistencias]])}</tbody></table>
    <h2>Por forma de pago</h2><table class="rep"><tbody>${filas(Object.keys(R.por_metodo || {}).map((k) => [METODOS[k], money(R.por_metodo[k])]))}</tbody></table>
    <h2>Membresías vendidas</h2><table class="rep"><tbody>${filas(R.por_plan.map((p) => [esc(p.plan) + ' (' + p.n + ')', money(p.monto)]))}</tbody></table>
    <h2>Productos más vendidos</h2><table class="rep"><thead><tr><th>Producto</th><th>Cantidad</th><th>Importe</th><th>Ganancia</th></tr></thead><tbody>${filas(R.top_productos.map((p) => [esc(p.nombre), p.cantidad, money(p.importe), money(p.ganancia)]))}</tbody></table>
    <h2>Por día</h2><table class="rep"><thead><tr><th>Fecha</th><th>Membresías</th><th>Ventas</th><th>Asistencias</th></tr></thead><tbody>${filas(R.serie.filter((x) => Number(x.m) || Number(x.v) || x.a).map((x) => [fCorta(x.d), money(x.m), money(x.v), x.a]))}</tbody></table>
    <p style="font-size:11px;color:#777">Generado ${esc(fechaHora(new Date().toISOString()))} con Aeterion Gym. Para guardarlo como PDF elige «Guardar como PDF» al imprimir.</p>
    <style>.rep{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13px}.rep td,.rep th{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}.rep td:last-child,.rep th:last-child{text-align:right}h2{font-size:15px;margin:18px 0 4px}</style></div>`, 'Reporte ' + INFO().nombre);
}

/* ---------------- Ajustes (ticket y datos) ---------------- */
VISTAS['g-ajustes'] = async () => {
  const a = INFO().ajustes || {};
  return titulo('Ticket y datos del gimnasio', 'Aparecen en tus tickets y comprobantes') + `<div class="gy-card gy-form">
    <label>Ancho del papel de tu impresora</label><div class="gy-seg" id="gaAncho"><button data-g="seg" data-x="58" class="${Number(a.ticket_ancho) === 58 ? 'on' : ''}">58 mm</button><button data-g="seg" data-x="80" class="${Number(a.ticket_ancho) !== 58 ? 'on' : ''}">80 mm</button></div>
    <label>Encabezado<input class="gy-in" id="gaEnc" maxlength="200" placeholder="Ej. Horario L-V 6 a 22 h · Tel. 55…" value="${esc(a.ticket_encabezado || '')}"></label>
    <label>Dirección<input class="gy-in" id="gaDir" maxlength="160" value="${esc(a.direccion || '')}"></label>
    <label>RFC <span class="gy-peq">(opcional)</span><input class="gy-in" id="gaRfc" maxlength="13" value="${esc(a.rfc || '')}" style="text-transform:uppercase"></label>
    <label>Mensaje al pie<input class="gy-in" id="gaPie" maxlength="200" placeholder="¡Gracias por entrenar con nosotros!" value="${esc(a.ticket_pie || '')}"></label>
    <label>Si llega un socio vencido</label><div class="gy-seg" id="gaPol"><button data-g="seg" data-x="avisar" class="${a.politica_vencidos !== 'bloquear' ? 'on' : ''}">Avisar y dejar pasar</button><button data-g="seg" data-x="bloquear" class="${a.politica_vencidos === 'bloquear' ? 'on' : ''}">Pedir que renueve</button></div>
    <button class="gy-btn gy-grande" data-g="guardar-ajustes">Guardar</button><button class="gy-link" style="color:var(--oro,#c9a84c)" data-g="ticket-prueba">Imprimir ticket de prueba</button></div>
    <p class="gy-peq">Funciona con impresoras térmicas USB o Bluetooth instaladas en la computadora o el teléfono: el ticket se abre listo para imprimir. Los tickets no son facturas.</p>`;
};

/* ---------------- Productos Aeterion (mayoreo) ---------------- */
VISTAS['g-aeterion'] = async () => titulo('Vender productos Aeterion', 'Suplementos y accesorios para tu mostrador') + `<div class="gy-card gy-dest">
    <b>¿Cómo funciona?</b><ol class="gy-doc"><li>Pides precios de mayoreo y eliges productos.</li><li>Aeterion te los envía; tú los das de alta en tu Inventario con tu precio de venta.</li><li>Los vendes en tu Punto de venta y ves tu ganancia en Reportes.</li></ol>
    <p class="gy-peq">Tus socios también pueden comprarlos en la tienda de la app.</p></div>
    <div class="gy-card gy-form"><b>Solicitar precios de mayoreo</b><label>¿Qué te interesa y cuántas piezas aproximadamente?<textarea class="gy-in" id="gaMay" rows="4" maxlength="1000" placeholder="Ej. Proteína y creatina, unas 20 piezas al mes"></textarea></label>
    <button class="gy-btn" data-g="pedir-mayoreo">Enviar a Aeterion</button><p class="gy-peq">Te contestamos por correo o WhatsApp.</p></div>`;

/* ---------------- Acciones ---------------- */
window.__gymAccion = async function (a, x, el, ocupado) {
  switch (a) {
    case 'pos-agregar': { const p = PROD.find((q) => String(q.id) === x); if (p) agregar(p, 1); return; }
    case 'pos-mas': { const it = CARRO[Number(x)]; if (it) agregar(it.p, 1); return; }
    case 'pos-menos': { const it = CARRO[Number(x)]; if (!it) return; it.n -= 1; if (it.n <= 0) CARRO.splice(Number(x), 1); pintarCarro(); return; }
    case 'pos-vaciar': CARRO = []; return A.pintar();
    case 'pos-metodo': el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); pintarCarro(); return;
    case 'pos-cerrar-ok': ultima = null; return A.pintar();
    case 'pos-ticket': if (ultima) A.ticketVenta(ultima); return;
    case 'pos-cobrar': return ocupado(async () => {
      if (!CARRO.length) throw new Error('Agrega al menos un producto.');
      const met = ($('gvMet').querySelector('.on') || { dataset: { x: 'efectivo' } }).dataset.x, des = num($('gvDesc').value), sub = totalCarro();
      if (des > sub) throw new Error('El descuento no puede ser mayor que el total.');
      const con = met === 'efectivo' && $('gvCon').value !== '' ? num($('gvCon').value) : null;
      if (con != null && con < sub - des) throw new Error('El efectivo recibido no alcanza.');
      let socio = null; const sn = ($('gvSocio').value || '').trim();
      if (sn) { const L = await llamar('gym_socios_listar', { p_gym: G(), p_filtro: 'activos', p_busca: sn }); const s = L.find((q) => String(q.numero) === sn); if (!s) throw new Error('No encontramos al socio #' + sn + '.'); socio = s.id; }
      autoTicket = $('gvAuto').checked; try { localStorage.setItem('aet_gym_autoticket', autoTicket ? '1' : '0'); } catch (e) {}
      ultima = await llamar('gym_venta_crear', { p_gym: G(), p_items: CARRO.map((it) => ({ producto_id: it.p.id, cantidad: it.n })), p_descuento: des, p_metodo: met, p_pago_con: con, p_socio: socio, p_sede: null });
      CARRO = []; if (autoTicket) A.ticketVenta(ultima); toast('Venta #' + ultima.folio + ' registrada'); await A.pintar();
    });
    case 'venta': return A.ir('g-venta', { id: Number(x) });
    case 'reimprimir': return A.ticketVenta(A.vista.venta);
    case 'cancelar-venta': { const m = prompt('¿Por qué se cancela la venta? (los productos regresan al inventario)'); if (m == null) return; return ocupado(async () => { await llamar('gym_venta_cancelar', { p_gym: G(), p_venta: A.vista.venta.id, p_motivo: m }); toast('Venta cancelada'); await A.pintar(); }); }
    case 'ir-prod': return A.ir('g-producto', { id: Number(x) });
    case 'ir-kardex': return A.ir('g-kardex', { id: Number(x) });
    case 'guardar-prod': return ocupado(async () => {
      const p = { id: x || null, nombre: $('gpNomP').value, codigo: $('gpCod').value, categoria: $('gpCat').value, precio: String($('gpPre').value || ''), costo: String($('gpCos').value || '0'), minimo: String($('gpMin').value || '0'), existencia: $('gpEx') ? String($('gpEx').value || '0') : undefined };
      await llamar('gym_producto_guardar', { p_gym: G(), p }); toast(x ? 'Producto guardado' : 'Producto agregado'); A.volver();
    });
    case 'baja-prod': { const p = A.vista.prod; if (!confirm('¿Dejar de vender «' + p.nombre + '»? Su historial se conserva.')) return; return ocupado(async () => { await llamar('gym_producto_guardar', { p_gym: G(), p: { id: p.id, nombre: p.nombre, codigo: p.codigo || '', categoria: p.categoria || '', precio: String(p.precio), costo: String(p.costo || 0), minimo: String(p.minimo), activo: false } }); A.volver(); }); }
    case 'inv-entrada': { const n = prompt('¿Cuántas piezas entraron?'); if (n == null) return; const nota = prompt('Nota (proveedor, factura…)', '') || ''; return ocupado(async () => { const r = await llamar('gym_inventario_mov', { p_gym: G(), p_producto: Number(x), p_tipo: 'entrada', p_cantidad: Math.round(num(n)), p_nota: nota }); toast('Ahora hay ' + r.existencia); await A.pintar(); }); }
    case 'inv-ajuste': { const n = prompt('¿Cuántas piezas contaste físicamente?'); if (n == null) return; const nota = prompt('Motivo del ajuste (merma, caducidad, conteo…)'); if (nota == null) return; return ocupado(async () => { const r = await llamar('gym_inventario_mov', { p_gym: G(), p_producto: Number(x), p_tipo: 'ajuste', p_cantidad: Math.round(num(n)), p_nota: nota }); toast('Existencia ajustada a ' + r.existencia); await A.pintar(); }); }
    case 'rep-rango': A.vista.r = x; return A.pintar();
    case 'rep-fechas': A.vista.d1 = $('grD1').value; A.vista.d2 = $('grD2').value; return A.pintar();
    case 'rep-excel': return ocupado(excelPeriodo);
    case 'rep-pdf': return pdfPeriodo();
    case 'respaldo': return ocupado(respaldo);
    case 'seg': el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); return;
    case 'guardar-ajustes': return ocupado(async () => {
      const on = (id) => ($(id).querySelector('.on') || { dataset: {} }).dataset.x;
      A.INFO = await llamar('gym_ajustes_guardar', { p_gym: G(), p: { ticket_ancho: on('gaAncho'), ticket_encabezado: $('gaEnc').value, direccion: $('gaDir').value, rfc: $('gaRfc').value, ticket_pie: $('gaPie').value, politica_vencidos: on('gaPol') } });
      toast('Guardado');
    });
    case 'ticket-prueba': return A.ticketVenta({ folio: 0, fecha: new Date().toISOString(), items: [{ cantidad: 1, nombre: 'Agua 1 L', importe: 15 }, { cantidad: 2, nombre: 'Barra de proteína', importe: 70 }], subtotal: 85, descuento: 0, total: 85, metodo: 'efectivo', pago_con: 100, cambio: 15 });
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
});

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
#gymApp .gy-pos{display:grid;gap:.8rem} #gymApp .gy-prods{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.5rem;margin-top:.6rem;max-height:52vh;overflow:auto}
#gymApp .gy-prod{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.65rem;text-align:left;color:inherit;font:inherit;cursor:pointer;min-height:84px;display:flex;flex-direction:column;gap:.15rem}
#gymApp .gy-prod b{color:#fff;font-size:13px;line-height:1.25} #gymApp .gy-prod span{color:var(--oro,#c9a84c);font-weight:700} #gymApp .gy-prod small{font-size:11px;color:var(--gris,#999);margin-top:auto}
#gymApp .gy-prod:active{transform:scale(.98)} #gymApp .gy-prod.agotado{opacity:.4;cursor:not-allowed}
#gymApp .gy-pos-der > b{display:block;color:#fff;margin-bottom:.4rem} #gymApp .gy-pos-der label{display:block;font-size:12.5px;color:#fff;font-weight:600;margin-top:.5rem}
#gymApp .gy-carro-f{display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid rgba(255,255,255,.06)} #gymApp .gy-carro-f > div:first-child{flex:1;min-width:0}
#gymApp .gy-carro-f b{display:block;color:#fff;font-size:13px} #gymApp .gy-carro-f small{font-size:11px;color:var(--gris,#999)} #gymApp .gy-carro-f strong{min-width:64px;text-align:right;color:#fff}
#gymApp .gy-cant{display:flex;align-items:center;gap:.3rem} #gymApp .gy-cant button{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#fff;font-size:16px;cursor:pointer} #gymApp .gy-cant span{min-width:20px;text-align:center;color:#fff}
#gymApp .gy-tot b{font-size:20px;color:var(--oro,#c9a84c)} #gymApp b.ok{color:#4cc38a} #gymApp b.mal{color:#e5866f}
#gymApp .gy-check{display:flex!important;align-items:center;gap:.5rem;font-weight:400!important;color:var(--gris,#999)!important;font-size:12.5px}
#gymApp .gy-venta-ok{border-color:rgba(76,195,138,.5);background:rgba(76,195,138,.08)}
#gymApp .gy-tabla-w{padding:.3rem .6rem;overflow-x:auto} #gymApp .gy-tabla{width:100%;border-collapse:collapse;font-size:13px}
#gymApp .gy-tabla th{text-align:left;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris,#999);font-weight:600;padding:.5rem .4rem;border-bottom:1px solid rgba(255,255,255,.1)}
#gymApp .gy-tabla td{padding:.55rem .4rem;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top} #gymApp .gy-tabla td b{color:#fff} #gymApp .gy-tabla td small{display:block;font-size:11px;color:var(--gris,#999)}
#gymApp .gy-tabla tr.bajo td{background:rgba(229,134,111,.07)} #gymApp .gy-acc-t{text-align:right;white-space:nowrap} #gymApp .gy-acc-t .gy-link{color:var(--oro,#c9a84c);margin-left:.6rem}
#gymApp .gy-solo-pc-t{display:none}
#gymApp .gy-leyenda{display:flex;gap:.9rem;font-size:11.5px;color:var(--gris,#999);margin-top:.3rem} #gymApp .gy-leyenda i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:.3rem}
#gymApp .gy-barra-h{display:grid;grid-template-columns:96px 1fr auto;gap:.6rem;align-items:center;margin:.45rem 0;font-size:12.5px} #gymApp .gy-barra-h > div{height:8px;background:rgba(255,255,255,.06);border-radius:5px;overflow:hidden} #gymApp .gy-barra-h i{display:block;height:100%;border-radius:5px} #gymApp .gy-barra-h b{color:#fff}
#gymApp textarea.gy-in{resize:vertical;min-height:90px}
@media (min-width:900px){ #gymApp .gy-pos{grid-template-columns:1fr 360px;align-items:start} #gymApp .gy-pos-der{position:sticky;top:76px} #gymApp .gy-prods{max-height:none} #gymApp .gy-solo-pc-t{display:table-cell} }
`;
document.head.appendChild(css);
})();
