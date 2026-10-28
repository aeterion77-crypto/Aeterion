/* ============================================================
   AETERION GYM — software para gimnasios
   Staff (dueño, admin, recepción, coach): socios y vencimientos,
   entrada con QR o número, pagos registrados, caja, equipo, planes.
   Socio (en su app): su membresía y su QR de entrada.
   Funciona dentro de la app (#gymApp) y en la página de recepción
   (gym/index.html), que define window.AET_GYM_ENV.
============================================================ */
(function () {
'use strict';
const ENV = window.AET_GYM_ENV || {};
const PAGINA = !!ENV.standalone;
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const toast = (t) => { try { (ENV.toast || aetToast)(t); } catch (e) { console.log(t); } };
const hoyMx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const sumaDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fCorta = (f) => { if (!f) return '—'; try { return new Date(String(f).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return f; } };
const hora = (iso) => { try { return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const fechaHora = (iso) => { try { return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
const ROLES = { dueno: 'Dueño', admin: 'Administrador', recepcion: 'Recepción', coach: 'Coach' };
const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' };
const ESTADOS = { al_corriente: ['Al corriente', 'ok'], por_vencer: ['Por vencer', 'warn'], vencido: ['Vencido', 'mal'], sin_pago: ['Sin pago', 'mal'], baja: ['Baja', 'gris'] };
const ERR = {
  sin_permiso: 'No tienes permiso para esto.', no_autenticado: 'Inicia sesión para continuar.', gym_suspendido: 'El gimnasio está suspendido: solo puedes consultar. Escríbele a Aeterion.',
  gym_baja: 'Este gimnasio ya no está activo.', falta_nombre: 'Escribe el nombre.', email_invalido: 'Revisa el correo.', socio_no_encontrado: 'No encontramos a ese socio.',
  limite_socios: 'Llegaste al límite de socios de tu plan. Habla con Aeterion para subir de plan.', limite_staff: 'Llegaste al límite de personas de tu plan.',
  limite_sedes: 'Tu plan no incluye más sedes.', plan_invalido: 'Elige un plan válido.', monto_invalido: 'Revisa el monto.', metodo_invalido: 'Elige cómo pagó.',
  falta_motivo: 'Escribe el motivo.', pago_no_encontrado: 'Ese pago ya no existe o ya estaba anulado.', dias_invalidos: 'Los días deben ser de 1 a 400.',
  cuenta_no_encontrada: 'Esa persona aún no tiene cuenta en Aeterion. Pídele que se registre en la app con ese correo.', rol_invalido: 'Rol inválido.',
  codigo_invalido: 'Ese código no existe o ya no está activo.', codigo_usado: 'Ese código ya está vinculado a otra cuenta.', rango_largo: 'Elige un rango de hasta un año.',
  demasiados_planes: 'Tienes el máximo de planes.', sede_invalida: 'Sede inválida.',
};
const api = (fn, args) => (ENV.rpc ? ENV.rpc(fn, args || {}) : _rpc(fn, args || {}));
async function llamar(fn, args) {
  const r = await api(fn, args);
  if (!r.ok) { const m = r.data && (r.data.message || r.data.msg); throw new Error(ERR[m] || (r.red ? 'Sin conexión. Inténtalo de nuevo.' : 'No se pudo completar. Inténtalo de nuevo.')); }
  return r.data;
}
function cargarQR() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = (ENV.base || '') + 'vendor/qrcode.js?v=1'; s.onload = () => ok(window.qrcode); s.onerror = no; document.head.appendChild(s); });
}
async function qrSvg(texto, celda) { const qr = await cargarQR(); const q = qr(0, 'M'); q.addData(texto); q.make(); return q.createSvgTag({ cellSize: celda || 6, margin: 3, scalable: true }); }
const tel = (t) => String(t || '').replace(/\D/g, '');
const waLink = (t, msg) => { let n = tel(t); if (n.length === 10) n = '52' + n; return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg); };
const appUrl = () => (ENV.appUrl || (location.origin + location.pathname)).replace(/gym\/(index\.html)?$/, '');

/* ---------------- Estado ---------------- */
let EST = null, G = null, INFO = null, vista = { v: 'g-hoy' }, pila = [], cargando = false, _seq = 0, camara = null;
const raiz = () => $('gymApp');
const rol = () => (INFO && INFO.rol) || '';
const puede = { cobrar: () => ['dueno', 'admin', 'recepcion'].includes(rol()), administrar: () => ['dueno', 'admin'].includes(rol()), dueno: () => rol() === 'dueno' };
async function refrescar() {
  try { EST = await llamar('gym_estado'); } catch (e) { EST = EST || { gyms: [], socio: [] }; }
  try {
    document.body.classList.toggle('gym-on', !!(EST.gyms && EST.gyms.length));
    document.body.classList.toggle('socio-on', !!((EST.socio && EST.socio.length) || EST.abierto));
    const m = $('appGymMeta'); if (m && EST.gyms && EST.gyms[0]) m.textContent = EST.gyms.length > 1 ? EST.gyms.length + ' gimnasios' : EST.gyms[0].nombre;
    const sm = $('appSocioMeta'); if (sm) { const s = EST.socio && EST.socio[0]; sm.textContent = s ? (ESTADOS[s.estado] ? ESTADOS[s.estado][0] : '') : 'Vincular'; }
  } catch (e) {}
  return EST;
}
async function elegir(id) { G = id; INFO = await llamar('gym_info', { p_gym: id }); try { localStorage.setItem('aet_gym_sel', id); } catch (e) {} }
function ir(v, extra) { pararCamara(); pila.push(vista); vista = Object.assign({ v }, extra || {}); pintar(); window.scrollTo(0, 0); }
function volver() { pararCamara(); vista = pila.pop() || { v: 'g-hoy' }; pintar(); }
function raizV(v) { pararCamara(); pila = []; vista = Object.assign({ v }, {}); pintar(); window.scrollTo(0, 0); }

async function pintar() {
  const r = raiz(); if (!r) return; const yo = ++_seq;
  const enGym = vista.v.indexOf('g-') === 0;
  document.body.classList.toggle('modo-gym', enGym && !PAGINA);
  try {
    if (!EST) { r.innerHTML = '<div class="gy-cargando">Cargando…</div>'; await refrescar(); }
    if (enGym) {
      if (!EST.gyms.length) { if (yo === _seq) r.innerHTML = marco('<div class="gy-card"><b>No perteneces a ningún gimnasio</b><p>Si tu gimnasio usa Aeterion, pide al dueño que te agregue con el correo de tu cuenta.</p></div>', true); return; }
      if (!G) { let sel = null; try { sel = localStorage.getItem('aet_gym_sel'); } catch (e) {} await elegir(EST.gyms.some((g) => g.id === sel) ? sel : EST.gyms[0].id); }
    }
    const f = VISTAS[vista.v] || VISTAS['g-hoy'];
    const html = await f(vista);
    if (yo !== _seq) return;
    r.innerHTML = enGym ? marco(html) : html;
    if (vista.despues) { const d = vista.despues; vista.despues = null; d(); }
    if (vista.v === 'g-entrada' && (PAGINA || matchMedia('(pointer:fine)').matches)) { const n = $('gyNum'); if (n) n.focus(); }
  } catch (e) {
    if (yo !== _seq) return;
    const err = `<div class="gy-card gy-error"><b>No se pudo cargar</b><p>${esc(e.message)}</p><button class="gy-btn" data-g="reintentar">Reintentar</button></div>`;
    r.innerHTML = enGym ? marco(err) : err;
  }
}
const NAV = [['g-hoy', 'Hoy', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'], ['g-entrada', 'Entrada', '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7h-7"/>'],
  ['g-socios', 'Socios', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/>'],
  ['g-caja', 'Caja', '<rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19M7 15h3"/>'], ['g-mas', 'Más', '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>']];
const RAIZ_DE = { 'g-socio': 'g-socios', 'g-nuevo': 'g-socios', 'g-equipo': 'g-mas', 'g-planes': 'g-mas', 'g-sedes': 'g-mas', 'g-material': 'g-mas', 'g-doc': 'g-mas', 'g-plan': 'g-mas', 'g-elegir': 'g-mas' };
function marco(html, sinNav) {
  const nav = NAV.filter((n) => n[0] !== 'g-caja' || puede.cobrar());
  const act = nav.some((n) => n[0] === vista.v) ? vista.v : (RAIZ_DE[vista.v] || 'g-hoy');
  return `<div class="gy-top"><div class="gy-marca"><span>AETERION <b>GYM</b></span>${INFO ? `<small>${esc(INFO.nombre)} · ${ROLES[rol()] || ''}</small>` : ''}</div>
      ${PAGINA ? '<button class="gy-salir" data-g="salir-pagina">Salir</button>' : '<button class="gy-salir" data-g="salir">Mi entreno</button>'}</div>
    <div class="gy-cuerpo">${INFO && INFO.estado === 'suspendido' ? '<div class="gy-aviso">Gimnasio suspendido: solo consulta. Contacta a Aeterion.</div>' : ''}${pila.length ? '<button class="gy-atras" data-g="volver">‹ Volver</button>' : ''}${html}</div>
    ${sinNav ? '' : `<nav class="gy-nav">${nav.map(([k, n, ico]) => `<button class="${k === act ? 'on' : ''}" data-g="tab" data-x="${k}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico}</svg><span>${n}</span></button>`).join('')}</nav>`}`;
}
const titulo = (t, sub, extra) => `<div class="gy-titulo"><div><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${extra || ''}</div>`;
const pill = (e) => { const x = ESTADOS[e] || ['', 'gris']; return `<em class="gy-pill ${x[1]}">${x[0]}</em>`; };
const venceTxt = (s) => s.estado === 'baja' ? 'Dado de baja' : !s.vence_en ? 'Sin pagos registrados' : s.dias < 0 ? `Venció hace ${-s.dias} ${s.dias === -1 ? 'día' : 'días'} (${fCorta(s.vence_en)})` : s.dias === 0 ? 'Vence hoy' : `Vence en ${s.dias} ${s.dias === 1 ? 'día' : 'días'} (${fCorta(s.vence_en)})`;
const filaSocio = (s) => `<button class="gy-socio" data-g="socio" data-x="${s.id}"><span class="gy-num">${s.numero}</span><div><b>${esc(s.nombre)}${s.vinculado ? ' <i title="Usa la app">📱</i>' : ''}</b><small>${esc(venceTxt(s))}${s.plan ? ' · ' + esc(s.plan) : ''}</small></div>${pill(s.estado)}</button>`;

/* ---------------- Vistas del staff ---------------- */
const VISTAS = {};
VISTAS['g-hoy'] = async () => {
  const R = await llamar('gym_resumen', { p_gym: G });
  let h = `<p class="gy-fecha">${esc(new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>`;
  h += `<button class="gy-btn gy-grande gy-entrar" data-g="tab" data-x="g-entrada">Registrar entrada</button>`;
  h += `<div class="gy-kpis"><button data-g="filtro-socios" data-x="al_corriente"><b>${R.al_corriente}</b><span>Al corriente</span></button><button data-g="filtro-socios" data-x="por_vencer"><b class="warn">${R.por_vencer_n}</b><span>Por vencer</span></button><button data-g="filtro-socios" data-x="vencidos"><b class="mal">${R.vencidos_n}</b><span>Vencidos</span></button>
    <div><b>${R.asistencias_hoy}</b><span>Entradas hoy</span></div>${R.ingresos_hoy != null ? `<div><b>${money(R.ingresos_hoy)}</b><span>Cobrado hoy</span></div><div><b>${money(R.ingresos_mes)}</b><span>Este mes</span></div>` : `<div><b>${R.asistencias_7}</b><span>Entradas 7 días</span></div><div><b>${R.socios}</b><span>Socios</span></div>`}</div>`;
  if (INFO.plan_info && R.socios >= (INFO.plan_info.socios * INFO.sedes_max) * 0.9) h += `<div class="gy-aviso">Vas en ${R.socios} de ${INFO.plan_info.socios * INFO.sedes_max} socios de tu plan ${esc(INFO.plan_info.nombre)}.</div>`;
  if (!INFO.planes.some((p) => Number(p.precio) > 0) && puede.administrar()) h += `<div class="gy-card gy-dest"><b>Primer paso: tus precios</b><p>Configura tus planes (mensual, trimestral, visita) para poder registrar pagos.</p><button class="gy-btn" data-g="ir" data-x="g-planes">Configurar planes</button></div>`;
  if (!R.socios && puede.cobrar()) h += `<div class="gy-card gy-dest"><b>Da de alta a tus socios</b><p>Con su nombre y teléfono basta. Cada socio recibe un número y un código para ver su membresía y su QR en la app.</p><button class="gy-btn" data-g="ir" data-x="g-nuevo">Nuevo socio</button></div>`;
  h += `<div class="gy-sec">Por vencer (${R.por_vencer_n})</div>`;
  h += R.por_vencer.length ? '<div class="gy-card gy-lista">' + R.por_vencer.map((s) => `<div class="gy-fila">${filaSocio(s)}${s.telefono ? `<a class="gy-wa" href="${waLink(s.telefono, `Hola ${s.nombre.split(' ')[0]}, te recordamos que tu membresía de ${INFO.nombre} vence el ${fCorta(s.vence_en)}. ¡Te esperamos!`)}" target="_blank" rel="noopener" aria-label="Recordar por WhatsApp">WhatsApp</a>` : ''}</div>`).join('') + '</div>' : '<p class="gy-peq">Nadie vence en los próximos días.</p>';
  h += `<div class="gy-sec">Entradas de hoy (${R.asistencias_hoy})</div>`;
  h += R.entradas.length ? '<div class="gy-card">' + R.entradas.map((e) => `<div class="gy-entrada-f"><b>${hora(e.hora)}</b><span>#${e.numero} ${esc(e.nombre)}</span>${e.al_corriente ? '' : '<em class="gy-pill mal">Sin pago al día</em>'}</div>`).join('') + '</div>' : '<p class="gy-peq">Aún no hay entradas hoy.</p>';
  if (R.vencidos.length) h += `<div class="gy-sec">Vencieron en los últimos 30 días</div><div class="gy-card gy-lista">` + R.vencidos.slice(0, 10).map((s) => `<div class="gy-fila">${filaSocio(s)}${s.telefono ? `<a class="gy-wa" href="${waLink(s.telefono, `Hola ${s.nombre.split(' ')[0]}, te extrañamos en ${INFO.nombre}. Tu membresía venció el ${fCorta(s.vence_en)}; cuando quieras te ayudamos a renovarla.`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>`).join('') + '</div>';
  return h;
};

VISTAS['g-entrada'] = async (v) => {
  const sedes = INFO.sedes;
  let h = titulo('Registrar entrada', 'Escanea el QR de la app del socio o escribe su número');
  if (sedes.length > 1) h += `<select class="gy-in" id="gySede">${sedes.map((s) => `<option value="${s.id}" ${String(v.sede || '') === String(s.id) ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>`;
  const scan = 'BarcodeDetector' in window;
  h += `<div class="gy-fila2 gy-num-in"><input class="gy-in" id="gyNum" inputmode="numeric" maxlength="40" placeholder="Número de socio o lector de QR" autocomplete="off" autofocus><button class="gy-btn" data-g="checkin">Registrar</button></div>
    <div id="gyResultado">${v.res ? resultado(v.res) : ''}</div>
    ${scan ? `<div class="gy-scan ${camara ? 'on' : ''}"><video id="gyVideo" playsinline muted></video><div class="gy-scan-ayuda" id="gyScanAyuda">Apunta la cámara al QR del socio.</div></div>
    <button class="gy-btn gy-sec-btn gy-grande" data-g="camara">${camara ? 'Cerrar cámara' : 'Escanear con la cámara'}</button>` : '<p class="gy-peq">Para escanear con la cámara usa Chrome en Android o computadora. También sirve un lector de códigos USB: escribe en el campo de arriba.</p>'}`;
  return h;
};
function resultado(r) {
  const s = r.socio;
  if (!r.ok) return `<div class="gy-res mal"><b>${esc(s.nombre)}</b><span>Socio dado de baja</span></div>`;
  const cls = s.estado === 'al_corriente' ? 'ok' : s.estado === 'por_vencer' ? 'warn' : 'mal';
  return `<div class="gy-res ${cls}"><small>#${s.numero}</small><b>${esc(s.nombre)}</b><span>${cls === 'mal' ? '⚠️ ' : ''}${esc(venceTxt(s))}</span>${r.repetido ? '<small>Ya había registrado su entrada hace poco.</small>' : '<small>Entrada registrada ' + hora(new Date().toISOString()) + '</small>'}
    <div class="gy-fila2">${cls !== 'ok' && puede.cobrar() ? `<button class="gy-btn" data-g="socio" data-x="${s.id}" data-c="1">Cobrar</button>` : ''}<button class="gy-btn gy-sec-btn" data-g="socio" data-x="${s.id}">Ver socio</button></div></div>`;
}
async function checkin(dato, metodo) {
  const sede = $('gySede') ? Number($('gySede').value) : null;
  const r = await llamar('gym_checkin', { p_gym: G, p_sede: sede, p_dato: dato });
  vista.res = r; vista.sede = sede;
  const el = $('gyResultado'); if (el) el.innerHTML = resultado(r);
  try { navigator.vibrate && navigator.vibrate(r.ok && r.socio.estado !== 'vencido' && r.socio.estado !== 'sin_pago' ? 60 : [80, 60, 80]); } catch (e) {}
  const n = $('gyNum'); if (n) { n.value = ''; if (metodo !== 'qr') n.focus(); }
}
async function abrirCamara() {
  if (camara) { pararCamara(); return pintar(); }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const det = new window.BarcodeDetector({ formats: ['qr_code'] });
    camara = { stream, det, ultimo: '', t: 0 };
    await pintar();
    const vid = $('gyVideo'); vid.srcObject = stream; await vid.play(); vid.classList.add('on');
    const ay = $('gyScanAyuda'); if (ay) ay.textContent = 'Buscando QR…';
    const ciclo = async () => {
      if (!camara || !$('gyVideo')) return;
      try {
        const cods = await camara.det.detect($('gyVideo'));
        const val = cods && cods[0] && cods[0].rawValue;
        if (val && /^aet-gym:/i.test(val) && (val !== camara.ultimo || Date.now() - camara.t > 4000)) { camara.ultimo = val; camara.t = Date.now(); await checkin(val, 'qr').catch((e) => toast(e.message)); }
      } catch (e) {}
      if (camara) camara.raf = setTimeout(ciclo, 350);
    };
    ciclo();
  } catch (e) { camara = null; toast('No se pudo abrir la cámara. Revisa el permiso o escribe el número.'); pintar(); }
}
function pararCamara() { if (!camara) return; try { clearTimeout(camara.raf); camara.stream.getTracks().forEach((t) => t.stop()); } catch (e) {} camara = null; }

VISTAS['g-socios'] = async (v) => {
  const f = v.f || 'activos';
  const L = await llamar('gym_socios_listar', { p_gym: G, p_filtro: f, p_busca: v.q || null });
  const F = [['activos', 'Activos'], ['al_corriente', 'Al corriente'], ['por_vencer', 'Por vencer'], ['vencidos', 'Vencidos'], ['baja', 'Bajas']];
  let h = titulo('Socios', `${INFO.socios_activos} activos`, puede.cobrar() ? '<button class="gy-btn gy-mini" data-g="ir" data-x="g-nuevo">Nuevo socio</button>' : '');
  h += `<input class="gy-in" id="gyBusca" type="search" placeholder="Buscar por nombre, número o teléfono" value="${esc(v.q || '')}" autocomplete="off">
    <div class="gy-chips">${F.map(([k, n]) => `<button class="gy-chip ${f === k ? 'on' : ''}" data-g="filtro" data-x="${k}">${n}</button>`).join('')}</div>`;
  h += L.length ? '<div class="gy-card gy-lista">' + L.map(filaSocio).join('') + `</div>${L.length >= 300 ? '<p class="gy-peq">Mostrando 300. Usa la búsqueda.</p>' : ''}` : `<div class="gy-card gy-vacio"><b>Sin resultados</b>${puede.cobrar() && !v.q ? '<p>Da de alta a tu primer socio.</p>' : ''}</div>`;
  return h;
};

VISTAS['g-nuevo'] = async (v) => {
  const s = v.s || {};
  return titulo(s.id ? 'Editar socio' : 'Nuevo socio') + `<div class="gy-card gy-form">
    <label>Nombre completo<input class="gy-in" id="gsNom" maxlength="80" value="${esc(s.nombre || '')}" autocomplete="off"></label>
    <label>Teléfono (WhatsApp)<input class="gy-in" id="gsTel" type="tel" maxlength="20" value="${esc(s.telefono || '')}"></label>
    <label>Correo <span class="gy-peq">(opcional)</span><input class="gy-in" id="gsMail" type="email" maxlength="120" value="${esc(s.email || '')}"></label>
    ${INFO.sedes.length > 1 ? `<label>Sede<select class="gy-in" id="gsSede">${INFO.sedes.map((x) => `<option value="${x.id}" ${x.id === s.sede_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>` : ''}
    <label>Nota <span class="gy-peq">(opcional, solo la ve tu equipo)</span><input class="gy-in" id="gsNota" maxlength="300" value="${esc(s.nota || '')}"></label>
    <button class="gy-btn gy-grande" data-g="guardar-socio" data-x="${s.id || ''}">${s.id ? 'Guardar' : 'Dar de alta y cobrar'}</button></div>
    <p class="gy-peq">Solo guarda los datos necesarios para dar el servicio. El socio puede pedir que se corrijan o borren.</p>`;
};

VISTAS['g-socio'] = async (v) => {
  const s = await llamar('gym_socio_detalle', { p_gym: G, p_socio: v.id }); vista.s = s;
  let h = `<div class="gy-ficha"><span class="gy-num gy-num-g">${s.numero}</span><div><h2>${esc(s.nombre)}</h2><p>${pill(s.estado)} ${esc(venceTxt(s))}</p></div></div>`;
  if (s.estado !== 'baja' && puede.cobrar()) {
    const planes = INFO.planes; const sel = planes.find((p) => p.id === s.plan_id) || planes.find((p) => Number(p.dias) === 30) || planes[0];
    h += `<div class="gy-card gy-cobro" id="gyCobro"><b>Registrar pago</b>${planes.length ? `
      <label>Plan<select class="gy-in" id="gpPlan">${planes.map((p) => `<option value="${p.id}" data-precio="${p.precio}" ${sel && p.id === sel.id ? 'selected' : ''}>${esc(p.nombre)} · ${p.dias} días · ${money(p.precio)}</option>`).join('')}</select></label>
      <label>Monto cobrado<input class="gy-in" id="gpMonto" type="number" min="0" step="0.01" inputmode="decimal" value="${sel ? sel.precio : ''}"></label>
      <div class="gy-seg" id="gpMet">${Object.keys(METODOS).map((k, i) => `<button class="${i === 0 ? 'on' : ''}" data-g="metodo" data-x="${k}">${METODOS[k]}</button>`).join('')}</div>
      <p class="gy-peq">${s.vence_en && s.dias >= 0 ? `Se suma desde el ${fCorta(sumaDias(s.vence_en, 1))}.` : 'Empieza hoy.'} El cobro lo haces tú en el gimnasio; aquí solo se registra.</p>
      <button class="gy-btn gy-grande" data-g="cobrar">Registrar pago</button>` : `<p>Primero configura tus planes.</p>${puede.administrar() ? '<button class="gy-btn" data-g="ir" data-x="g-planes">Configurar planes</button>' : ''}`}</div>`;
  }
  h += `<div class="gy-acciones">${s.estado !== 'baja' ? '<button class="gy-btn gy-sec-btn" data-g="entrada-manual">Registrar entrada</button>' : ''}${puede.cobrar() ? '<button class="gy-btn gy-sec-btn" data-g="editar-socio">Editar</button>' : ''}</div>`;
  if (s.token && s.estado !== 'baja') {
    const link = appUrl() + '?modo=app&socio=' + s.codigo_vincular;
    h += `<div class="gy-card"><b>App del socio</b>${s.vinculado ? '<p>✅ Ya usa la app: ve su membresía y muestra su QR al entrar.</p>' : `<p>Código para la app: <b class="gy-codigo">${esc(s.codigo_vincular)}</b></p><p class="gy-peq">Con la app ve cuándo vence su membresía y entra mostrando su QR. Es gratis para tu socio.</p>`}
      <div class="gy-fila2">${!s.vinculado && s.telefono ? `<a class="gy-btn gy-wa-b" href="${waLink(s.telefono, `Hola ${s.nombre.split(' ')[0]}, ya puedes ver tu membresía de ${INFO.nombre} y entrar con tu QR en la app Aeterion. Abre este enlace: ${link}`)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>` : ''}<button class="gy-btn gy-sec-btn" data-g="credencial">Credencial con QR</button></div></div>`;
  }
  if (s.pagos) h += `<div class="gy-sec">Pagos</div>` + (s.pagos.length ? '<div class="gy-card">' + s.pagos.map((p) => `<div class="gy-pago ${p.anulado ? 'anulado' : ''}"><div><b>${money(p.monto)} · ${METODOS[p.metodo]}</b><small>${esc(p.plan || p.concepto || '')} · ${fCorta(p.desde)} a ${fCorta(p.hasta)} · registrado ${fechaHora(p.fecha)}${p.anulado ? ' · ANULADO: ' + esc(p.motivo || '') : ''}</small></div>${!p.anulado && puede.administrar() ? `<button class="gy-link" data-g="anular" data-x="${p.id}">Anular</button>` : ''}</div>`).join('') + '</div>' : '<p class="gy-peq">Sin pagos registrados.</p>');
  h += `<div class="gy-sec">Asistencia · ${s.asistencias_30} en 30 días</div>` + (s.asistencias.length ? `<div class="gy-card gy-asis">${s.asistencias.map((a) => `<span>${fechaHora(a)}</span>`).join('')}</div>` : '<p class="gy-peq">Aún no registra entradas.</p>');
  if (s.nota) h += `<div class="gy-card"><b>Nota</b><p>${esc(s.nota)}</p></div>`;
  if (puede.administrar()) h += `<button class="gy-btn gy-peligro" data-g="baja" data-x="${s.estado === 'baja' ? '1' : '0'}">${s.estado === 'baja' ? 'Reactivar socio' : 'Dar de baja'}</button>`;
  return h;
};

VISTAS['g-caja'] = async (v) => {
  const hoy = hoyMx(); const r = v.r || 'hoy';
  const R = { hoy: [hoy, hoy], ayer: [sumaDias(hoy, -1), sumaDias(hoy, -1)], semana: [sumaDias(hoy, -6), hoy], mes: [hoy.slice(0, 8) + '01', hoy] };
  const opciones = puede.administrar() ? ['hoy', 'ayer', 'semana', 'mes'] : ['hoy', 'ayer'];
  const C = await llamar('gym_caja', { p_gym: G, p_desde: R[r][0], p_hasta: R[r][1] });
  let h = titulo('Caja', 'Pagos registrados en Aeterion');
  h += `<div class="gy-chips">${opciones.map((k) => `<button class="gy-chip ${r === k ? 'on' : ''}" data-g="rango" data-x="${k}">${{ hoy: 'Hoy', ayer: 'Ayer', semana: '7 días', mes: 'Este mes' }[k]}</button>`).join('')}</div>`;
  h += `<div class="gy-card gy-total"><span>Total</span><b>${money(C.total)}</b><div class="gy-metodos">${Object.keys(METODOS).filter((k) => C.por_metodo[k]).map((k) => `<div><small>${METODOS[k]}</small><b>${money(C.por_metodo[k])}</b></div>`).join('') || '<small>Sin pagos en este periodo</small>'}</div></div>`;
  h += C.pagos.length ? '<div class="gy-card">' + C.pagos.map((p) => `<button class="gy-pago ${p.anulado ? 'anulado' : ''}" data-g="socio" data-x="${p.socio_id}"><div><b>#${p.numero} ${esc(p.socio)}</b><small>${fechaHora(p.fecha)} · ${esc(p.plan || '')} · ${METODOS[p.metodo]}${p.anulado ? ' · ANULADO' : ''}</small></div><strong>${money(p.monto)}</strong></button>`).join('') + '</div>' : '';
  h += '<p class="gy-peq">Para tu corte de caja: compara el total en efectivo con lo que hay en la caja.</p>';
  return h;
};

VISTAS['g-mas'] = async () => {
  let h = titulo(esc(INFO.nombre), `${ROLES[rol()]} · plan ${esc((INFO.plan_info || {}).nombre || INFO.plan)}`);
  const op = [];
  if (puede.administrar()) op.push(['g-equipo', 'Equipo', 'Recepción, administradores y coaches']);
  if (puede.administrar()) op.push(['g-planes', 'Planes y precios', 'Lo que cobras a tus socios']);
  if (puede.dueno()) op.push(['g-sedes', 'Sedes', 'Sucursales de tu gimnasio']);
  op.push(['g-material', 'Material útil', 'Guías, cartel de entrada y consejos']);
  if (puede.dueno()) op.push(['g-plan', 'Mi plan Aeterion', 'Plan, límites y pagos']);
  if (EST.gyms.length > 1) op.push(['g-elegir', 'Cambiar de gimnasio', EST.gyms.length + ' gimnasios']);
  h += op.map(([k, t, s]) => `<button class="gy-op" data-g="ir" data-x="${k}"><b>${t}</b><span>${s}</span><i>›</i></button>`).join('');
  if (!PAGINA) h += '<p class="gy-peq">Para la computadora de recepción abre <b>' + esc(appUrl().replace(/^https?:\/\//, '')) + 'gym/</b> e inicia sesión con tu correo.</p>';
  return h;
};
VISTAS['g-elegir'] = async () => titulo('Cambiar de gimnasio') + EST.gyms.map((g) => `<button class="gy-op" data-g="elegir" data-x="${g.id}"><b>${esc(g.nombre)}</b><span>${ROLES[g.rol]}</span><i>${g.id === G ? '✓' : '›'}</i></button>`).join('');

VISTAS['g-equipo'] = async () => {
  const L = await llamar('gym_staff_listar', { p_gym: G });
  const lim = (INFO.plan_info.staff || 3) * INFO.sedes_max, act = L.filter((x) => x.activo).length;
  let h = titulo('Equipo', `${act} de ${lim} personas en tu plan`);
  h += '<div class="gy-card">' + L.map((x) => `<div class="gy-staff ${x.activo ? '' : 'inactivo'}"><div><b>${esc(x.nombre)}${x.yo ? ' (tú)' : ''}</b><small>${esc(x.email)} · ${ROLES[x.rol]}${x.coach_aeterion ? ' · Coach Aeterion verificado' : ''}${x.activo ? '' : ' · sin acceso'}</small></div>${x.activo && !x.yo && x.rol !== 'dueno' && (puede.dueno() || x.rol !== 'admin') ? `<button class="gy-link" data-g="quitar-staff" data-x="${x.id}">Quitar</button>` : ''}</div>`).join('') + '</div>';
  h += `<div class="gy-card gy-form"><b>Agregar persona</b><p class="gy-peq">Debe tener cuenta en la app Aeterion con ese correo.</p>
    <label>Correo<input class="gy-in" id="geMail" type="email" maxlength="120" autocomplete="off"></label>
    <label>Rol<select class="gy-in" id="geRol">${puede.dueno() ? '<option value="admin">Administrador: todo menos sedes y plan</option>' : ''}<option value="recepcion" selected>Recepción: entradas, altas y pagos</option><option value="coach">Coach: ve socios y registra entradas</option></select></label>
    <button class="gy-btn" data-g="agregar-staff">Agregar</button></div>`;
  return h;
};

VISTAS['g-planes'] = async (v) => {
  const ed = v.edit || null;
  let h = titulo('Planes y precios', 'Lo que vendes a tus socios. Los cambios no afectan pagos ya registrados.');
  h += INFO.planes.length ? '<div class="gy-card">' + INFO.planes.map((p) => `<div class="gy-staff"><div><b>${esc(p.nombre)}</b><small>${p.dias} días · ${money(p.precio)}</small></div><button class="gy-link" data-g="editar-plan" data-x="${p.id}">Editar</button></div>`).join('') + '</div>' : '';
  h += `<div class="gy-card gy-form"><b>${ed ? 'Editar plan' : 'Nuevo plan'}</b>
    <label>Nombre<input class="gy-in" id="gpNom" maxlength="50" placeholder="Ej. Mensual, Trimestral, Visita" value="${esc(ed ? ed.nombre : '')}"></label>
    <div class="gy-fila2"><label>Precio<input class="gy-in" id="gpPrecio" type="number" min="0" step="0.01" value="${ed ? ed.precio : ''}"></label><label>Días que cubre<input class="gy-in" id="gpDias" type="number" min="1" max="400" value="${ed ? ed.dias : 30}"></label></div>
    <button class="gy-btn" data-g="guardar-plan" data-x="${ed ? ed.id : ''}">${ed ? 'Guardar' : 'Agregar plan'}</button>${ed ? `<button class="gy-link" data-g="desactivar-plan" data-x="${ed.id}">Ya no lo vendo</button>` : ''}</div>
    <p class="gy-peq">Ejemplos: Visita = 1 día · Semana = 7 · Mensual = 30 · Trimestral = 90 · Anual = 365.</p>`;
  return h;
};

VISTAS['g-sedes'] = async () => titulo('Sedes', `${INFO.sedes.length} de ${INFO.sedes_max} en tu plan`) +
  '<div class="gy-card">' + INFO.sedes.map((s) => `<div class="gy-staff"><div><b>${esc(s.nombre)}</b><small>${esc(s.direccion || 'Sin dirección')}</small></div></div>`).join('') + '</div>' +
  (INFO.sedes.length < INFO.sedes_max ? `<div class="gy-card gy-form"><b>Agregar sede</b><label>Nombre<input class="gy-in" id="gdNom" maxlength="60"></label><label>Dirección<input class="gy-in" id="gdDir" maxlength="160"></label><button class="gy-btn" data-g="guardar-sede">Agregar</button></div>`
    : '<p class="gy-peq">Para agregar otra sede, habla con Aeterion: el plan se cobra por sede.</p>');

VISTAS['g-plan'] = async () => {
  const P = INFO.plan_info || {}; const lim = (P.socios || 0) * INFO.sedes_max;
  return titulo('Mi plan Aeterion') + `<div class="gy-card gy-total"><span>Plan ${esc(P.nombre || INFO.plan)}</span><b>${money((P.precio || 0) * INFO.sedes_max)}<small>/mes</small></b><small>${money(P.precio)} por sede × ${INFO.sedes_max} ${INFO.sedes_max === 1 ? 'sede' : 'sedes'}</small></div>
    <div class="gy-card"><div class="gy-kv"><span>Estado</span><b>${{ prueba: 'Periodo de prueba', activo: 'Activo', suspendido: 'Suspendido' }[INFO.estado] || INFO.estado}</b></div>
    <div class="gy-kv"><span>Pagado hasta</span><b>${INFO.pagado_hasta ? fCorta(INFO.pagado_hasta) : '—'}</b></div>
    <div class="gy-kv"><span>Socios activos</span><b>${INFO.socios_activos} de ${lim}</b></div>
    <div class="gy-kv"><span>Equipo</span><b>${INFO.staff_activo} de ${(P.staff || 0) * INFO.sedes_max}</b></div></div>
    <p class="gy-peq">Para cambiar de plan, agregar sedes o pagar tu mensualidad, escríbenos desde Ayuda en la app. Planes: Piloto, Profesional y Avanzado; cada uno con más socios y personas.</p>`;
};

/* ---------------- Material útil ---------------- */
const DOCS = {
  arranque: ['Arranque en un día', 'Lo mínimo para empezar a usar Aeterion Gym', `<ol><li><b>Planes:</b> en Más › Planes y precios captura lo que vendes (visita, mensual, trimestral…).</li><li><b>Equipo:</b> agrega a tu recepción con el correo de su cuenta Aeterion. Recepción puede dar altas, registrar pagos y entradas, pero no anular pagos ni ver la caja del mes.</li><li><b>Socios:</b> da de alta a cada socio cuando venga o pague. Basta nombre y teléfono.</li><li><b>Pagos:</b> cobra como siempre (efectivo, terminal, transferencia) y regístralo en su ficha. Aeterion calcula su nuevo vencimiento.</li><li><b>Entrada:</b> en la computadora de recepción abre la página de Aeterion Gym, o usa el teléfono. Escanea el QR del socio o escribe su número.</li><li><b>Cierre del día:</b> en Caja compara el efectivo registrado con el de tu caja.</li></ol>`],
  recepcion: ['Guion para recepción', 'Cómo atender la entrada en 10 segundos', `<ol><li>Saluda por su nombre: Aeterion te lo muestra al escanear.</li><li><b>Verde:</b> todo bien. <b>Amarillo:</b> recuérdale que vence pronto. <b>Rojo:</b> invítalo amablemente a renovar antes de pasar, según la política del gimnasio.</li><li>Si no trae la app, búscalo por número o nombre.</li><li>A quien aún no usa la app, mándale su código por WhatsApp desde su ficha: así ve su vencimiento y entra más rápido la próxima vez.</li></ol>`],
  retencion: ['Cómo reducir bajas', 'Prácticas simples que puedes aplicar desde hoy', `<ul><li><b>Primeras semanas:</b> son las más frágiles. Revisa en la ficha que el socio nuevo venga al menos 2 veces por semana; si no, escríbele.</li><li><b>Antes de que venza:</b> usa la lista «Por vencer» de Hoy y manda el recordatorio por WhatsApp con un día de anticipación.</li><li><b>Después de vencer:</b> un mensaje amable en la primera semana recupera más que uno al mes.</li><li><b>Planes largos:</b> ofrece trimestral o anual con un precio mejor a quien ya viene seguido.</li><li><b>Medir:</b> en Hoy ves altas del mes, al corriente y vencidos. Compáralos cada mes.</li></ul><p class="nota">Son recomendaciones generales de operación, no garantías de resultados.</p>`],
  privacidad: ['Datos de tus socios', 'Lo que debes saber para cuidarlos', `<ul><li>Pide solo lo necesario: nombre y teléfono bastan para dar el servicio.</li><li>Dile a tu socio para qué usas sus datos (avisos de vencimiento y control de acceso) y ten tu aviso de privacidad a la vista.</li><li>Quita el acceso a quien deje de trabajar contigo desde Equipo.</li><li>Tu equipo no ve los datos de salud ni el progreso de tus socios en su app: eso es privado de cada persona.</li></ul><p class="nota">Esto no es asesoría legal. La ley de protección de datos personales aplica a tu gimnasio.</p>`],
};
VISTAS['g-material'] = async () => titulo('Material útil') +
  `<button class="gy-op" data-g="cartel"><b>Cartel de entrada</b><span>Imprímelo: «Descarga Aeterion y entra con tu QR»</span><i>Imprimir ›</i></button>` +
  Object.keys(DOCS).map((k) => `<button class="gy-op" data-g="doc" data-x="${k}"><b>${DOCS[k][0]}</b><span>${DOCS[k][1]}</span><i>Leer ›</i></button>`).join('');
VISTAS['g-doc'] = async (v) => { const d = DOCS[v.id]; return d ? titulo(d[0], d[1]) + `<div class="gy-card gy-doc">${d[2]}</div>` : ''; };

async function imprimir(html, titulo) {
  const w = window.open('', '_blank'); if (!w) { toast('Permite las ventanas emergentes para imprimir.'); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#111;text-align:center}h1{font-size:34px;margin:.3em 0}p{font-size:18px}.qr svg{width:260px;height:260px}.marca{letter-spacing:.3em;font-weight:800;color:#8a6d1f}.cred{display:inline-block;border:2px solid #c9a84c;border-radius:16px;padding:18px 24px;width:300px}.cred .qr svg{width:200px;height:200px}.num{font-size:28px;font-weight:800}@media print{button{display:none}}</style></head><body>${html}<p><button onclick="print()">Imprimir</button></p></body></html>`);
  w.document.close();
}

/* ---------------- Socio (en su app) ---------------- */
VISTAS['s-mio'] = async () => {
  await refrescar(); const L = EST.socio || [];
  if (!L.length) return `<div class="gy-titulo"><div><h2>Mi gimnasio</h2></div></div><div class="gy-card"><b>¿Tu gimnasio usa Aeterion?</b><p>Escribe el código que te dio recepción para ver tu membresía y entrar con tu QR.</p><div class="gy-fila2"><input class="gy-in" id="gyCodSocio" maxlength="8" placeholder="Ej. 7KQ2MX" style="text-transform:uppercase"><button class="gy-btn" data-g="vincular">Vincular</button></div></div>`;
  let h = '<div class="gy-titulo"><div><h2>Mi gimnasio</h2></div></div>';
  for (const s of L) {
    const svg = await qrSvg('AET-GYM:' + s.token, 7).catch(() => '');
    const cls = s.estado === 'al_corriente' ? 'ok' : s.estado === 'por_vencer' ? 'warn' : 'mal';
    h += `<div class="gy-card gy-socio-app"><div class="gy-top2"><b>${esc(s.gym)}</b>${pill(s.estado)}</div>
      <div class="gy-qr">${svg}</div><p class="gy-centro">Muéstralo en recepción al entrar</p>
      <div class="gy-res ${cls}"><small>Socio #${s.numero}${s.plan ? ' · ' + esc(s.plan) : ''}</small><b>${esc(venceTxt(s))}</b><small>${s.asistencias_30} ${s.asistencias_30 === 1 ? 'entrada' : 'entradas'} en los últimos 30 días</small></div>
      <p class="gy-peq">Tu gimnasio solo ve tu membresía y tus entradas. Tu progreso y tus datos de salud en Aeterion son privados.</p>
      <button class="gy-link" data-g="desvincular" data-x="${s.id}">Desvincular de este gimnasio</button></div>`;
  }
  h += '<div class="gy-card"><b>¿Otro gimnasio?</b><div class="gy-fila2"><input class="gy-in" id="gyCodSocio" maxlength="8" placeholder="Código" style="text-transform:uppercase"><button class="gy-btn gy-sec-btn" data-g="vincular">Vincular</button></div></div>';
  return h;
};

/* ---------------- Acciones ---------------- */
async function alClic(ev) {
  const el = ev.target.closest('[data-g]'); if (!el || !raiz() || !raiz().contains(el) || el.disabled) return;
  const a = el.dataset.g, x = el.dataset.x;
  if (cargando && !['metodo', 'filtro', 'rango'].includes(a)) return;
  const ocupado = async (fn) => { cargando = true; el.classList.add('gy-ocupado'); try { await fn(); } catch (e) { toast(e.message); } finally { cargando = false; el.classList.remove('gy-ocupado'); } };
  switch (a) {
    case 'tab': return raizV(x);
    case 'ir': return ir(x);
    case 'volver': return volver();
    case 'reintentar': EST = null; INFO = null; G = null; return pintar();
    case 'salir': pararCamara(); document.body.classList.remove('modo-gym'); pila = []; vista = { v: 'g-hoy' }; if (typeof aetIr === 'function') aetIr('inicio'); return;
    case 'salir-pagina': pararCamara(); if (ENV.salir) ENV.salir(); return;
    case 'filtro-socios': pararCamara(); pila = []; vista = { v: 'g-socios', f: x }; pintar(); window.scrollTo(0, 0); return;
    case 'filtro': vista.f = x; vista.q = ($('gyBusca') || {}).value || ''; return pintar();
    case 'rango': vista.r = x; return pintar();
    case 'socio': return ir('g-socio', { id: Number(x), despues: el.dataset.c ? () => { const c = $('gyCobro'); if (c) c.scrollIntoView({ behavior: 'smooth' }); } : null });
    case 'elegir': return ocupado(async () => { await elegir(x); raizV('g-hoy'); });
    case 'camara': return abrirCamara();
    case 'checkin': return ocupado(async () => { const d = ($('gyNum').value || '').trim(); if (!d) throw new Error('Escribe el número del socio.'); await checkin(d, 'numero'); });
    case 'entrada-manual': return ocupado(async () => { const r = await llamar('gym_checkin', { p_gym: G, p_sede: null, p_dato: String(vista.s.numero) }); toast(r.repetido ? 'Ya tenía entrada registrada hace poco' : 'Entrada registrada'); await pintar(); });
    case 'guardar-socio': return ocupado(async () => {
      const p = { id: x || null, nombre: $('gsNom').value, telefono: $('gsTel').value, email: $('gsMail').value, nota: $('gsNota').value, sede_id: $('gsSede') ? $('gsSede').value : null };
      const s = await llamar('gym_socio_guardar', { p_gym: G, p });
      INFO = await llamar('gym_info', { p_gym: G });
      toast(x ? 'Guardado' : `Socio #${s.numero} dado de alta`);
      pila.pop(); vista = { v: 'g-socio', id: s.id, despues: x ? null : () => { const c = $('gyCobro'); if (c) c.scrollIntoView({ behavior: 'smooth' }); } }; pintar();
    });
    case 'editar-socio': return ir('g-nuevo', { s: vista.s });
    case 'metodo': el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); return;
    case 'cobrar': return ocupado(async () => {
      const plan = Number($('gpPlan').value), monto = Number($('gpMonto').value), met = ($('gpMet').querySelector('.on') || {}).dataset;
      if (!(monto >= 0) || $('gpMonto').value === '') throw new Error('Escribe el monto cobrado.');
      const s = await llamar('gym_pago_registrar', { p_gym: G, p_socio: vista.s.id, p_plan: plan, p_monto: monto, p_metodo: met ? met.x : 'efectivo', p_concepto: null });
      toast(`Pago registrado. Vence el ${fCorta(s.vence_en)}`); await pintar();
    });
    case 'anular': { const m = prompt('¿Por qué se anula este pago? (queda registrado)'); if (m == null) return; return ocupado(async () => { await llamar('gym_pago_anular', { p_gym: G, p_pago: Number(x), p_motivo: m }); toast('Pago anulado'); await pintar(); }); }
    case 'baja': if (!confirm(x === '1' ? '¿Reactivar a este socio?' : '¿Dar de baja a este socio? Ya no podrá registrar entradas.')) return; return ocupado(async () => { await llamar('gym_socio_baja', { p_gym: G, p_socio: vista.s.id, p_activo: x === '1' }); INFO = await llamar('gym_info', { p_gym: G }); await pintar(); });
    case 'credencial': return ocupado(async () => { const s = vista.s; const svg = await qrSvg('AET-GYM:' + s.token, 6); imprimir(`<div class="cred"><div class="marca">${esc(INFO.nombre.toUpperCase())}</div><div class="qr">${svg}</div><div class="num">#${s.numero}</div><div>${esc(s.nombre)}</div><p style="font-size:12px">Muestra este código al entrar · Aeterion Gym</p></div>`, 'Credencial ' + s.nombre); });
    case 'cartel': return ocupado(async () => { const svg = await qrSvg(appUrl() + '?instalar', 8); imprimir(`<div class="marca">${esc(INFO.nombre.toUpperCase())}</div><h1>Entra con tu QR</h1><p>1. Escanea y descarga la app Aeterion (gratis)<br>2. Pide tu código en recepción<br>3. Muestra tu QR al entrar</p><div class="qr">${svg}</div><p style="font-size:14px">Ve cuándo vence tu membresía y entrena con programas basados en evidencia.</p>`, 'Cartel de entrada'); });
    case 'doc': return ir('g-doc', { id: x });
    case 'agregar-staff': return ocupado(async () => { const m = $('geMail').value.trim(); if (!m) throw new Error('Escribe el correo.'); await llamar('gym_staff_agregar', { p_gym: G, p_email: m, p_rol: $('geRol').value }); INFO = await llamar('gym_info', { p_gym: G }); toast('Agregado al equipo'); await pintar(); });
    case 'quitar-staff': if (!confirm('¿Quitarle el acceso a esta persona?')) return; return ocupado(async () => { await llamar('gym_staff_quitar', { p_gym: G, p_id: Number(x) }); INFO = await llamar('gym_info', { p_gym: G }); await pintar(); });
    case 'editar-plan': vista.edit = INFO.planes.find((p) => String(p.id) === x); return pintar();
    case 'guardar-plan': return ocupado(async () => { INFO = Object.assign(INFO, await llamar('gym_plan_guardar', { p_gym: G, p: { id: x || null, nombre: $('gpNom').value, precio: $('gpPrecio').value, dias: $('gpDias').value } })); INFO = await llamar('gym_info', { p_gym: G }); vista.edit = null; toast('Plan guardado'); await pintar(); });
    case 'desactivar-plan': if (!confirm('¿Dejar de vender este plan? Los pagos anteriores no cambian.')) return; return ocupado(async () => { const p = INFO.planes.find((q) => String(q.id) === x); await llamar('gym_plan_guardar', { p_gym: G, p: { id: p.id, nombre: p.nombre, precio: String(p.precio), dias: String(p.dias), activo: false } }); INFO = await llamar('gym_info', { p_gym: G }); vista.edit = null; await pintar(); });
    case 'guardar-sede': return ocupado(async () => { await llamar('gym_sede_guardar', { p_gym: G, p: { nombre: $('gdNom').value, direccion: $('gdDir').value } }); INFO = await llamar('gym_info', { p_gym: G }); toast('Sede agregada'); await pintar(); });
    case 'vincular': return ocupado(async () => { const c = ($('gyCodSocio').value || '').trim(); if (!c) throw new Error('Escribe tu código.'); await llamar('socio_vincular', { p_codigo: c }); toast('¡Listo! Ya ves tu membresía'); await refrescar(); await pintar(); });
    case 'desvincular': if (!confirm('¿Desvincular tu cuenta de este gimnasio? Tu membresía sigue igual en el gimnasio.')) return; return ocupado(async () => { await llamar('socio_desvincular', { p_socio: Number(x) }); await refrescar(); await pintar(); });
  }
}
document.addEventListener('click', alClic);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target) return;
  if (e.target.id === 'gyNum') { e.preventDefault(); const b = document.querySelector('[data-g="checkin"]'); if (b) b.click(); }
  if (e.target.id === 'gyBusca') { vista.q = e.target.value.trim(); pintar(); }
});
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'gpPlan') { const o = e.target.selectedOptions[0]; const m = $('gpMonto'); if (o && m) m.value = o.dataset.precio; } });
document.addEventListener('visibilitychange', () => { if (document.hidden) pararCamara(); });

/* ---------------- API pública ---------------- */
window.gymEstado = async function () {
  const e = await refrescar();
  try { // vínculo pendiente por enlace (?socio=CODIGO)
    const cod = localStorage.getItem('aet_socio_inv');
    if (cod) { localStorage.removeItem('aet_socio_inv'); await llamar('socio_vincular', { p_codigo: cod }); await refrescar(); toast('Tu membresía quedó vinculada'); pila = []; vista = { v: 's-mio' }; if (typeof aetIr === 'function') aetIr('gym'); else pintar(); }
  } catch (x) { toast(x.message); }
  return e;
};
window.gymRender = function () { pintar(); };
window.gymAbrir = function (v) { pararCamara(); pila = []; vista = { v: v || 'g-hoy' }; pintar(); };
window.gymSub = function () { return pila.length > 0; };
window.gymVolver = function () { if (pila.length) { volver(); return true; } return false; };
window.aetGymEntrar = function (v) { pararCamara(); pila = []; vista = { v: v || 'g-hoy' }; if (typeof aetIr === 'function') aetIr('gym'); else pintar(); };

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
body.modo-gym .app-bottomnav,body.modo-gym .app-header{display:none!important}
#gymApp{font-family:var(--font-ui,system-ui,sans-serif);color:var(--texto,#ddd);padding-bottom:84px}
#gymApp .gy-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:.6rem;background:var(--negro,#0b0b0c);padding:.6rem 0;border-bottom:1px solid rgba(201,168,76,.15);margin-bottom:.6rem}
#gymApp .gy-marca{flex:1;min-width:0} #gymApp .gy-marca span{display:block;font-family:var(--font-display,serif);letter-spacing:.2em;font-size:13px;color:var(--oro,#c9a84c);font-weight:700} #gymApp .gy-marca b{color:#fff}
#gymApp .gy-marca small{display:block;font-size:11.5px;color:var(--gris,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gymApp .gy-salir{border:1px solid rgba(201,168,76,.45);background:transparent;color:var(--oro,#c9a84c);border-radius:20px;padding:.4rem .8rem;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;min-height:36px}
#gymApp .gy-atras{border:0;background:none;color:var(--oro,#c9a84c);font:inherit;font-size:14px;font-weight:600;padding:.3rem 0 .6rem;cursor:pointer}
#gymApp .gy-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;background:rgba(11,11,12,.97);border-top:1px solid rgba(201,168,76,.18);padding-bottom:env(safe-area-inset-bottom)}
#gymApp .gy-nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;color:var(--gris,#999);font:inherit;font-size:10.5px;padding:.55rem 0 .5rem;cursor:pointer;min-height:56px}
#gymApp .gy-nav button.on{color:var(--oro,#c9a84c)}
#gymApp .gy-titulo{display:flex;justify-content:space-between;align-items:flex-start;gap:.6rem;margin:.2rem 0 .9rem}
#gymApp .gy-titulo h2,#gymApp .gy-ficha h2{margin:0;color:#fff;font-family:var(--font-display,serif);font-size:22px} #gymApp .gy-titulo p{margin:.25rem 0 0;font-size:13px;color:var(--gris,#999)}
#gymApp .gy-fecha{margin:.3rem 0 .7rem;font-size:13px;color:var(--gris,#999);text-transform:capitalize}
#gymApp .gy-card{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.95rem 1rem;margin-bottom:.8rem;font-size:13.5px;line-height:1.5}
#gymApp .gy-card > b{display:block;color:#fff;font-size:14px;margin-bottom:.3rem} #gymApp .gy-card p{margin:.25rem 0 0}
#gymApp .gy-dest{border-color:rgba(201,168,76,.45);background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.02))}
#gymApp .gy-error{border-color:rgba(229,115,115,.45)}
#gymApp .gy-aviso{background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.35);color:#e8cf86;border-radius:12px;padding:.6rem .8rem;font-size:12.5px;margin-bottom:.8rem}
#gymApp .gy-btn{background:var(--oro,#c9a84c);color:#141109;border:0;border-radius:12px;padding:.75rem 1.1rem;font:inherit;font-weight:700;font-size:14px;cursor:pointer;min-height:44px;margin-top:.5rem;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
#gymApp .gy-grande{width:100%;padding:.95rem;font-size:15.5px} #gymApp .gy-mini{padding:.5rem .8rem;font-size:12.5px;min-height:38px;margin:0}
#gymApp .gy-sec-btn{background:transparent;color:var(--oro,#c9a84c);border:1px solid rgba(201,168,76,.5)}
#gymApp .gy-peligro{width:100%;background:transparent;color:#e5866f;border:1px solid rgba(229,134,111,.45);margin-top:1rem}
#gymApp .gy-link{background:none;border:0;color:#e5866f;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:.4rem 0}
#gymApp .gy-ocupado{opacity:.55;pointer-events:none}
#gymApp .gy-entrar{margin:0 0 1rem;font-size:17px;min-height:56px}
#gymApp .gy-in{width:100%;box-sizing:border-box;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#fff;font:inherit;font-size:16px;padding:.65rem .75rem;margin-top:.35rem;min-height:44px}
#gymApp .gy-in:focus{outline:none;border-color:var(--oro,#c9a84c)}
#gymApp .gy-form label{display:block;font-size:13px;color:#fff;font-weight:600;margin-top:.7rem}
#gymApp .gy-fila2{display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap} #gymApp .gy-fila2 > *{flex:1;min-width:120px} #gymApp .gy-fila2 .gy-btn{flex:none}
#gymApp .gy-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:1rem}
#gymApp .gy-kpis > *{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.7rem .3rem;text-align:center;color:inherit;font:inherit;cursor:default;min-width:0}
#gymApp .gy-kpis button{cursor:pointer}
#gymApp .gy-kpis b{display:block;font-size:1.25rem;color:var(--oro,#c9a84c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #gymApp .gy-kpis b.warn{color:#e8b64c} #gymApp .gy-kpis b.mal{color:#e5866f}
#gymApp .gy-kpis span{display:block;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris,#999);margin-top:.2rem}
#gymApp .gy-sec{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--oro,#c9a84c);margin:1.2rem 0 .55rem;font-weight:700}
#gymApp .gy-peq{font-size:12px;color:var(--gris,#999)} #gymApp .gy-centro{text-align:center}
#gymApp .gy-lista{padding:.2rem .8rem}
#gymApp .gy-fila{display:flex;align-items:center;gap:.4rem;border-top:1px solid rgba(255,255,255,.07)} #gymApp .gy-fila:first-child{border-top:0} #gymApp .gy-fila .gy-socio{border-top:0}
#gymApp .gy-socio{display:flex;align-items:center;gap:.7rem;width:100%;background:none;border:0;border-top:1px solid rgba(255,255,255,.07);padding:.7rem 0;text-align:left;color:inherit;font:inherit;cursor:pointer}
#gymApp .gy-lista > .gy-socio:first-child{border-top:0}
#gymApp .gy-socio > div{flex:1;min-width:0} #gymApp .gy-socio b{display:block;color:#fff;font-size:14px} #gymApp .gy-socio b i{font-style:normal;font-size:12px}
#gymApp .gy-socio small{display:block;font-size:12px;color:var(--gris,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gymApp .gy-num{flex:none;min-width:38px;height:38px;border-radius:10px;background:#2a2620;color:#e8cf86;font-weight:800;font-size:13px;display:grid;place-items:center;padding:0 .3rem}
#gymApp .gy-num-g{min-width:56px;height:56px;font-size:18px;border-radius:14px}
#gymApp .gy-pill{flex:none;font-style:normal;font-size:10.5px;font-weight:800;border-radius:20px;padding:3px 8px;white-space:nowrap}
#gymApp .gy-pill.ok{background:rgba(76,195,138,.15);color:#4cc38a} #gymApp .gy-pill.warn{background:rgba(232,182,76,.15);color:#e8b64c} #gymApp .gy-pill.mal{background:rgba(229,134,111,.15);color:#e5866f} #gymApp .gy-pill.gris{background:rgba(255,255,255,.08);color:var(--gris,#999)}
#gymApp .gy-wa,#gymApp .gy-wa-b{background:#25d366;color:#08130b;text-decoration:none;font-weight:700;font-size:12px;border-radius:20px;padding:.4rem .7rem;flex:none}
#gymApp .gy-wa-b{border-radius:12px;font-size:14px}
#gymApp .gy-entrada-f{display:flex;gap:.7rem;align-items:center;padding:.45rem 0;border-top:1px solid rgba(255,255,255,.06)} #gymApp .gy-entrada-f:first-child{border-top:0}
#gymApp .gy-entrada-f b{flex:none;width:72px;white-space:nowrap;color:var(--oro,#c9a84c)} #gymApp .gy-entrada-f span{flex:1;color:#fff}
#gymApp .gy-chips{display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none;margin:.6rem 0 .8rem} #gymApp .gy-chips::-webkit-scrollbar{display:none}
#gymApp .gy-chip{flex:none;background:transparent;border:1px solid rgba(255,255,255,.14);color:var(--texto,#ddd);border-radius:30px;padding:.45rem .85rem;font:inherit;font-size:12.5px;cursor:pointer;min-height:36px}
#gymApp .gy-chip.on{background:rgba(201,168,76,.18);border-color:var(--oro,#c9a84c);color:#fff}
#gymApp .gy-scan{position:relative;background:#000;border:1px solid rgba(255,255,255,.1);border-radius:16px;overflow:hidden;aspect-ratio:4/3;max-width:520px;margin:1rem auto .4rem;display:none;place-items:center}
#gymApp .gy-scan.on{display:grid}
#gymApp .gy-num-in .gy-in{font-size:20px;min-height:54px;margin-top:0} #gymApp .gy-num-in .gy-btn{min-height:54px;margin-top:0}
#gymApp .gy-scan video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none} #gymApp .gy-scan video.on{display:block}
#gymApp .gy-scan-ayuda{position:relative;z-index:1;color:var(--gris,#999);font-size:13px;text-align:center;padding:1rem;background:rgba(0,0,0,.45);border-radius:10px}
#gymApp .gy-res{border-radius:16px;padding:1rem;margin-top:.8rem;text-align:center;border:2px solid}
#gymApp .gy-res b{display:block;font-size:22px;color:#fff;margin:.15rem 0} #gymApp .gy-res span{display:block;font-size:15px;font-weight:600} #gymApp .gy-res small{display:block;font-size:12px;color:var(--gris,#999);margin-top:.2rem}
#gymApp .gy-res.ok{border-color:#4cc38a;background:rgba(76,195,138,.1)} #gymApp .gy-res.ok span{color:#4cc38a}
#gymApp .gy-res.warn{border-color:#e8b64c;background:rgba(232,182,76,.1)} #gymApp .gy-res.warn span{color:#e8b64c}
#gymApp .gy-res.mal{border-color:#e5866f;background:rgba(229,134,111,.1)} #gymApp .gy-res.mal span{color:#e5866f}
#gymApp .gy-ficha{display:flex;gap:.9rem;align-items:center;margin:.2rem 0 1rem} #gymApp .gy-ficha p{margin:.3rem 0 0;font-size:13px;color:var(--gris,#999)}
#gymApp .gy-cobro{border-color:rgba(201,168,76,.4)} #gymApp .gy-cobro label{display:block;font-size:13px;color:#fff;font-weight:600;margin-top:.6rem}
#gymApp .gy-seg{display:flex;gap:4px;background:rgba(255,255,255,.04);border-radius:12px;padding:4px;margin-top:.7rem;flex-wrap:wrap}
#gymApp .gy-seg button{flex:1;min-width:70px;height:40px;border-radius:9px;border:0;font:inherit;font-size:12.5px;font-weight:700;background:transparent;color:var(--gris,#999);cursor:pointer}
#gymApp .gy-seg button.on{background:var(--oro,#c9a84c);color:#141109}
#gymApp .gy-acciones{display:flex;gap:.5rem;margin-bottom:.8rem} #gymApp .gy-acciones .gy-btn{flex:1;margin:0}
#gymApp .gy-codigo{font-size:18px;letter-spacing:.12em;color:var(--oro,#c9a84c)}
#gymApp .gy-pago{display:flex;justify-content:space-between;align-items:center;gap:.6rem;width:100%;background:none;border:0;border-top:1px solid rgba(255,255,255,.06);padding:.6rem 0;text-align:left;color:inherit;font:inherit;cursor:pointer}
#gymApp .gy-card > .gy-pago:first-child{border-top:0} #gymApp .gy-pago > div{flex:1;min-width:0} #gymApp .gy-pago b{display:block;color:#fff;font-size:13.5px} #gymApp .gy-pago small{display:block;font-size:11.5px;color:var(--gris,#999)} #gymApp .gy-pago strong{color:#fff}
#gymApp .gy-pago.anulado{opacity:.5} #gymApp .gy-pago.anulado b{text-decoration:line-through}
#gymApp .gy-asis{display:flex;flex-wrap:wrap;gap:.35rem} #gymApp .gy-asis span{font-size:11.5px;background:rgba(255,255,255,.05);border-radius:8px;padding:.25rem .5rem}
#gymApp .gy-total{text-align:center;border-color:rgba(201,168,76,.4)} #gymApp .gy-total > span{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gris,#999)} #gymApp .gy-total > b{display:block;font-size:32px;color:#fff;margin:.2rem 0} #gymApp .gy-total > b small{font-size:13px;color:var(--gris,#999)}
#gymApp .gy-metodos{display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;margin-top:.4rem} #gymApp .gy-metodos small{display:block;font-size:11px;color:var(--gris,#999)} #gymApp .gy-metodos b{font-size:14px;color:#e8cf86}
#gymApp .gy-op{display:flex;flex-direction:column;width:100%;text-align:left;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.85rem 1rem;margin-bottom:.6rem;color:inherit;font:inherit;cursor:pointer;position:relative}
#gymApp .gy-op b{color:#fff;font-size:14px} #gymApp .gy-op span{font-size:12px;color:var(--gris,#999);margin-top:.15rem;padding-right:4rem} #gymApp .gy-op i{position:absolute;right:1rem;top:50%;transform:translateY(-50%);font-style:normal;font-size:12px;color:var(--oro,#c9a84c);font-weight:700}
#gymApp .gy-staff{display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding:.6rem 0;border-top:1px solid rgba(255,255,255,.06)} #gymApp .gy-staff:first-child{border-top:0}
#gymApp .gy-staff b{display:block;color:#fff;font-size:13.5px} #gymApp .gy-staff small{font-size:11.5px;color:var(--gris,#999)} #gymApp .gy-staff.inactivo{opacity:.5}
#gymApp .gy-kv{display:flex;justify-content:space-between;padding:.45rem 0;border-top:1px solid rgba(255,255,255,.06)} #gymApp .gy-kv:first-child{border-top:0} #gymApp .gy-kv b{color:#fff}
#gymApp .gy-doc ol,#gymApp .gy-doc ul{padding-left:1.1rem;margin:.3rem 0} #gymApp .gy-doc li{margin:.4rem 0;line-height:1.5} #gymApp .gy-doc .nota{font-size:12px;color:var(--gris,#999);border-top:1px solid rgba(255,255,255,.07);padding-top:.6rem;margin-top:.8rem}
#gymApp .gy-socio-app .gy-top2{display:flex;justify-content:space-between;align-items:center} #gymApp .gy-socio-app .gy-top2 b{color:#fff;font-size:16px}
#gymApp .gy-qr{background:#fff;border-radius:16px;padding:12px;width:min(260px,80%);margin:1rem auto .4rem} #gymApp .gy-qr svg{display:block;width:100%;height:auto}
#gymApp .gy-cargando{padding:3rem 0;text-align:center;color:var(--gris,#999)}
@media (min-width:900px){
  #gymApp{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:180px minmax(0,1fr);column-gap:28px;align-items:start}
  #gymApp .gy-top{grid-column:1/-1;grid-row:1}
  #gymApp .gy-nav{grid-column:1;grid-row:2;position:sticky;top:72px;left:auto;right:auto;bottom:auto;flex-direction:column;background:none;border:0;padding:0}
  #gymApp .gy-nav button{flex-direction:row;justify-content:flex-start;gap:.7rem;font-size:14px;padding:.7rem .8rem;border-radius:10px;min-height:44px}
  #gymApp .gy-nav button.on{background:rgba(201,168,76,.12)}
  #gymApp .gy-cuerpo{grid-column:2;grid-row:2;min-width:0}
  #gymApp .gy-cargando,#gymApp > .gy-card{grid-column:1/-1}
  #gymApp .gy-kpis{grid-template-columns:repeat(6,1fr)}
  #gymApp{padding-bottom:2rem}
}
`;
document.head.appendChild(css);
})();
