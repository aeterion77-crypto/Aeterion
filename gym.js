/* ============================================================
   AETERION GYM — software para gimnasios (versión Pro)
   Panel con comparativos · Accesos con control · Socios con ficha
   Membresías · Pagos y deudores · Notificaciones · Usuarios y
   seguridad · Configuración con marca (logo, color, tema).
   Punto de venta, inventario, ventas y reportes: gym-pos.js.
   Funciona en la app (#gymApp) y en la página de recepción
   (gym/index.html, que define window.AET_GYM_ENV).
============================================================ */
(function () {
'use strict';
const ENV = window.AET_GYM_ENV || {};
const PAGINA = !!ENV.standalone;
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const moneyK = (n) => { n = Number(n || 0); return Math.abs(n) >= 100000 ? '$' + (n / 1000).toLocaleString('es-MX', { maximumFractionDigits: 0 }) + 'k' : money(n); };
const toast = (t) => { try { (ENV.toast || aetToast)(t); } catch (e) { console.log(t); } };
const hoyMx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const sumaDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fCorta = (f) => { if (!f) return '—'; try { return new Date(String(f).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return f; } };
const fDia = (f) => { try { return new Date(String(f).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); } catch (e) { return f; } };
const hora = (iso) => { try { return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const fechaHora = (iso) => { try { return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
const hace = (iso) => { if (!iso) return 'nunca'; const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return 'ahora'; if (m < 60) return `hace ${m} min`; const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`; const d = Math.round(h / 24); return d === 1 ? 'ayer' : `hace ${d} días`; };
const ROLES = { dueno: 'Dueño', admin: 'Administrador', recepcion: 'Recepción', coach: 'Entrenador' };
const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', otro: 'Otro' };
const ESTADOS = { al_corriente: ['Vigente', 'ok'], por_vencer: ['Por vencer', 'warn'], vencido: ['Vencido', 'mal'], sin_pago: ['Sin pago', 'mal'], baja: ['Baja', 'gris'], congelado: ['Congelado', 'info'] };
const MOTIVOS = { vencido: 'Membresía vencida', sin_pago: 'Sin pago registrado', baja: 'Socio dado de baja', congelado: 'Membresía congelada' };
const COLORES = ['#c9a84c', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#eab308', '#64748b'];
const ERR = {
  sin_permiso: 'No tienes permiso para esto.', no_autenticado: 'Inicia sesión para continuar.', gym_suspendido: 'El gimnasio está suspendido: solo puedes consultar. Escríbele a Aeterion.',
  gym_baja: 'Este gimnasio ya no está activo.', falta_nombre: 'Escribe el nombre.', email_invalido: 'Revisa el correo.', socio_no_encontrado: 'No encontramos a ese socio.',
  limite_socios: 'Llegaste al límite de socios de tu plan. Habla con Aeterion para subir de plan.', limite_staff: 'Llegaste al límite de personas de tu plan.',
  limite_sedes: 'Tu plan no incluye más sedes.', plan_invalido: 'Elige un plan válido.', monto_invalido: 'Revisa el monto.', metodo_invalido: 'Elige cómo pagó.',
  falta_motivo: 'Escribe el motivo.', pago_no_encontrado: 'Ese pago ya no existe o ya estaba anulado.', dias_invalidos: 'Revisa los días.',
  cuenta_no_encontrada: 'Esa persona aún no tiene cuenta en Aeterion. Pídele que se registre en la app con ese correo.', rol_invalido: 'Rol inválido.',
  codigo_invalido: 'Ese código no existe o ya no está activo.', codigo_usado: 'Ese código ya está vinculado a otra cuenta.', rango_largo: 'Elige un rango de hasta un año.',
  demasiados_planes: 'Tienes el máximo de planes.', sede_invalida: 'Sede inválida.', foto_invalida: 'La imagen no es válida o es muy grande.', venta_vacia: 'Agrega al menos un producto.',
  venta_larga: 'Demasiados productos en una venta.', cantidad_invalida: 'Revisa la cantidad.', producto_no_encontrado: 'Ese producto ya no está disponible.',
  descuento_invalido: 'El descuento no puede ser mayor que el total.', pago_con_invalido: 'El efectivo recibido debe cubrir el total.', venta_no_encontrada: 'Esa venta no existe o ya estaba cancelada.',
  codigo_repetido: 'Ya tienes otro producto con ese código.', demasiados_productos: 'Llegaste al máximo de productos.', tipo_invalido: 'Opción inválida.', rango_invalido: 'Revisa las fechas.',
  color_invalido: 'Elige un color válido.', fecha_invalida: 'Revisa la fecha.', no_vigente: 'Solo se puede congelar una membresía vigente.', ya_congelado: 'La membresía ya está congelada.', no_congelado: 'La membresía no está congelada.',
};
const api = (fn, args) => (ENV.rpc ? ENV.rpc(fn, args || {}) : _rpc(fn, args || {}));
async function llamar(fn, args) {
  const r = await api(fn, args);
  if (!r.ok) { const m = String((r.data && (r.data.message || r.data.msg)) || ''); if (/^sin_existencia: /.test(m)) throw new Error('No hay suficiente existencia de ' + m.slice(16) + '.'); throw new Error(ERR[m] || (r.red ? 'Sin conexión. Inténtalo de nuevo.' : 'No se pudo completar. Inténtalo de nuevo.')); }
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
const nombre1 = (n) => String(n || '').split(' ')[0];
const iniciales = (n) => String(n || '?').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();

/* ---------------- Íconos (trazo, 24×24) ---------------- */
const P = {
  panel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  acceso: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7h-7"/>',
  socios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/>',
  tarjeta: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  pagos: '<path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 1.6 2.6 4.5 3.2 4.5 1.6 4.5 3.5-2 3.3-4.5 3.3-4.5-1.4-4.5-3.2"/>',
  carrito: '<path d="M3 4h2.5l2.2 11h10.6L21 7.5H6.4"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  caja: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  recibo: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  grafica: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  escudo: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  engrane: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  libro: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5V4.5"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
  mas1: '<path d="M12 5v14M5 12h14"/>',
  entrar: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
  alerta: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>',
  pastel: '<path d="M4 21h16M5 21v-7h14v7M12 14V9"/><path d="M12 6.5c-1-1-1-2.5 0-3.5 1 1 1 2.5 0 3.5z"/><path d="M5 17c2.3 1 4.7-1 7 0s4.7 1 7 0"/>',
  hielo: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/>',
  whats: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.5 2 2 3.5 4 4l1.2-1.2 2 1-.5 1.6c-3.5.3-7-3-6.7-6.6L10.6 8l1 2z"/>',
  dorm: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  salir: '<path d="M14 17l5-5-5-5M19 12H8"/><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/>',
};
const ico = (n, t) => `<svg class="gx-i" width="${t || 20}" height="${t || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* ---------------- Estado ---------------- */
let EST = null, G = null, INFO = null, vista = { v: 'g-hoy' }, pila = [], cargando = false, _seq = 0, camara = null, CUENTAS = null;
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
async function elegir(id) { G = id; INFO = await llamar('gym_info', { p_gym: id }); CUENTAS = null; try { localStorage.setItem('aet_gym_sel', id); } catch (e) {} aplicarTema(); }
function ir(v, extra) { pararCamara(); cerrarModal(); pila.push(vista); vista = Object.assign({ v }, extra || {}); pintar(); window.scrollTo(0, 0); }
function volver() { pararCamara(); cerrarModal(); vista = pila.pop() || { v: 'g-hoy' }; pintar(); }
function raizV(v, extra) { pararCamara(); cerrarModal(); pila = []; vista = Object.assign({ v }, extra || {}); pintar(); window.scrollTo(0, 0); }

/* ---------------- Tema y marca ---------------- */
function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [201, 168, 76]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function temaLocal() { try { return localStorage.getItem('aet_gym_tema'); } catch (e) { return null; } }
function aplicarTema() {
  const A = (INFO && INFO.ajustes) || {}; const col = A.color || '#c9a84c'; const [r, g, b] = hexRgb(col);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; const tema = temaLocal() || A.tema || 'oscuro';
  [raiz(), $('gyModalRoot')].forEach((el) => { if (!el) return;
    el.style.setProperty('--gx-ac', col); el.style.setProperty('--gx-ac-rgb', `${r},${g},${b}`); el.style.setProperty('--gx-ac-txt', lum > 0.6 ? '#111' : '#fff');
    el.classList.toggle('gx-claro', tema === 'claro'); el.classList.add('gx-raiz'); });
  document.body.classList.toggle('gx-claro-body', tema === 'claro' && PAGINA);
}

async function pintar() {
  const r = raiz(); if (!r) return; const yo = ++_seq;
  const enGym = vista.v.indexOf('g-') === 0;
  document.body.classList.toggle('modo-gym', enGym && !PAGINA);
  r.classList.add('gx-raiz');
  try {
    if (!EST) { r.innerHTML = '<div class="gx-cargando"><span></span>Cargando…</div>'; await refrescar(); }
    if (enGym) {
      if (!EST.gyms.length) { if (yo === _seq) r.innerHTML = '<div class="gx-solo"><div class="gx-card"><b>No perteneces a ningún gimnasio</b><p>Si tu gimnasio usa Aeterion, pide al dueño que te agregue con el correo de tu cuenta.</p></div></div>'; return; }
      if (!G) { let sel = null; try { sel = localStorage.getItem('aet_gym_sel'); } catch (e) {} await elegir(EST.gyms.some((g) => g.id === sel) ? sel : EST.gyms[0].id); }
      else aplicarTema();
    }
    const f = VISTAS[vista.v] || VISTAS['g-hoy'];
    const html = await f(vista);
    if (yo !== _seq) return;
    r.innerHTML = enGym ? marco(html) : html;
    if (vista.despues) { const d = vista.despues; vista.despues = null; d(); }
    if (vista.v === 'g-entrada' && (PAGINA || matchMedia('(pointer:fine)').matches)) { const n = $('gyNum'); if (n) n.focus(); }
  } catch (e) {
    if (yo !== _seq) return;
    const err = `<div class="gx-card gx-error"><b>No se pudo cargar</b><p>${esc(e.message)}</p><button class="gx-btn" data-g="reintentar">Reintentar</button></div>`;
    r.innerHTML = enGym && INFO ? marco(err) : err;
  }
}

/* ---------------- Marco: barra lateral, barra superior y navegación móvil ---------------- */
const SECCIONES = [
  ['Principal', [['g-hoy', 'Panel', 'panel'], ['g-entrada', 'Accesos', 'acceso'], ['g-socios', 'Socios', 'socios'], ['g-membresias', 'Membresías', 'tarjeta'], ['g-pagos', 'Pagos', 'pagos', 'cobrar']]],
  ['Tienda', [['g-vender', 'Punto de venta', 'carrito', 'cobrar'], ['g-inventario', 'Inventario', 'caja', 'administrar'], ['g-ventas', 'Ventas', 'recibo', 'cobrar']]],
  ['Análisis', [['g-reportes', 'Reportes', 'grafica', 'administrar'], ['g-notif', 'Notificaciones', 'campana']]],
  ['Gestión', [['g-equipo', 'Usuarios y seguridad', 'escudo', 'administrar'], ['g-config', 'Configuración', 'engrane', 'administrar'], ['g-material', 'Material útil', 'libro']]],
];
const MOVIL = [['g-hoy', 'Panel', 'panel'], ['g-entrada', 'Accesos', 'acceso'], ['g-socios', 'Socios', 'socios'], ['g-vender', 'Vender', 'carrito', 'cobrar'], ['g-mas', 'Más', 'mas']];
const RAIZ_DE = { 'g-socio': 'g-socios', 'g-nuevo': 'g-socios', 'g-producto': 'g-inventario', 'g-kardex': 'g-inventario', 'g-venta': 'g-ventas', 'g-caja': 'g-pagos', 'g-doc': 'g-material', 'g-aeterion': 'g-material', 'g-elegir': 'g-mas' };
const visible = (it) => !it[3] || puede[it[3]]();
function marco(html) {
  const act = RAIZ_DE[vista.v] || vista.v; const A = INFO.ajustes || {};
  const tema = temaLocal() || A.tema || 'oscuro';
  const logo = A.logo ? `<img src="${esc(A.logo)}" alt="">` : `<span>${esc(iniciales(INFO.nombre))}</span>`;
  const lado = `<aside class="gx-lado"><div class="gx-marca"><div class="gx-logo">${logo}</div><div><b>${esc(INFO.nombre)}</b><small>${ROLES[rol()] || ''}</small></div></div>
    ${SECCIONES.map(([t, items]) => { const v = items.filter(visible); return v.length ? `<div class="gx-sec-lado">${t}</div>` + v.map(([k, n, i]) => `<button class="gx-nav-i ${k === act ? 'on' : ''}" data-g="tab" data-x="${k}">${ico(i)}<span>${n}</span>${k === 'g-notif' && CUENTAS && CUENTAS.notif ? `<em class="gx-badge">${CUENTAS.notif}</em>` : ''}</button>`).join('') : ''; }).join('')}
    <div class="gx-lado-pie">${EST.gyms.length > 1 ? '<button class="gx-nav-i" data-g="ir" data-x="g-elegir">' + ico('socios') + '<span>Cambiar de gimnasio</span></button>' : ''}<span>AETERION GYM</span></div></aside>`;
  const top = `<header class="gx-top"><div class="gx-top-marca"><div class="gx-logo gx-logo-s">${logo}</div><b>${esc(INFO.nombre)}</b></div>
    <div class="gx-buscar">${ico('buscar', 18)}<input id="gxBuscar" type="search" placeholder="Buscar socio por nombre, número o teléfono" autocomplete="off"><div class="gx-res-busca" id="gxResBusca"></div></div>
    <div class="gx-top-acc">
      <button class="gx-btn gx-btn-sm gx-solo-pc" data-g="tab" data-x="g-entrada">${ico('entrar', 18)}<span>Entrada</span></button>
      ${puede.cobrar() ? `<button class="gx-btn gx-btn-sm gx-sec gx-solo-pc" data-g="ir" data-x="g-nuevo">${ico('mas1', 18)}<span>Socio</span></button>` : ''}
      <button class="gx-ico-btn" data-g="tema" title="Cambiar a tema ${tema === 'claro' ? 'oscuro' : 'claro'}" aria-label="Cambiar tema">${ico(tema === 'claro' ? 'luna' : 'sol')}</button>
      ${PAGINA ? `<button class="gx-ico-btn" data-g="salir-pagina" title="Salir" aria-label="Salir">${ico('salir')}</button>` : '<button class="gx-salir" data-g="salir">Mi entreno</button>'}
    </div></header>`;
  const nav = `<nav class="gx-nav-movil">${MOVIL.filter(visible).map(([k, n, i]) => `<button class="${k === act || (k === 'g-mas' && !MOVIL.some((m) => m[0] === act)) ? 'on' : ''}" data-g="tab" data-x="${k}">${ico(i, 22)}<span>${n}</span></button>`).join('')}</nav>`;
  const aviso = INFO.estado === 'suspendido' ? '<div class="gx-aviso mal">Gimnasio suspendido: solo consulta. Contacta a Aeterion.</div>' : '';
  return `${lado}<div class="gx-main">${top}<main class="gx-cuerpo">${aviso}${pila.length ? `<button class="gx-atras" data-g="volver">‹ Volver</button>` : ''}${html}</main></div>${nav}`;
}
const titulo = (t, sub, extra) => `<div class="gx-titulo"><div><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${extra ? `<div class="gx-titulo-acc">${extra}</div>` : ''}</div>`;
const pill = (e) => { const x = ESTADOS[e] || ['', 'gris']; return `<em class="gx-pill ${x[1]}">${x[0]}</em>`; };
const venceTxt = (s) => s.estado === 'baja' ? 'Dado de baja' : s.estado === 'congelado' ? `Congelada hasta el ${fCorta(s.congelado_hasta)}` : !s.vence_en ? 'Sin pagos registrados' : s.dias < 0 ? `Venció hace ${-s.dias} ${s.dias === -1 ? 'día' : 'días'}` : s.dias === 0 ? 'Vence hoy' : `Vence en ${s.dias} ${s.dias === 1 ? 'día' : 'días'}`;
const avatar = (s, cls) => s && s.foto ? `<img class="gx-av ${cls || ''}" src="${esc(s.foto)}" alt="">` : `<span class="gx-av ${cls || ''}" style="--h:${(Number(s && s.numero) * 47) % 360}">${esc(iniciales(s && s.nombre))}</span>`;
const plantag = (s) => s.plan ? `<span class="gx-plan"><i style="background:${esc(s.plan_color || 'var(--gx-ac)')}"></i>${esc(s.plan)}</span>` : '<span class="gx-tenue">Sin plan</span>';
function delta(a, b, invertir) {
  a = Number(a || 0); b = Number(b || 0);
  if (!b) return a ? '<em class="gx-delta sube">nuevo</em>' : '<em class="gx-delta">—</em>';
  const p = Math.round((a - b) / b * 100); const bueno = invertir ? p <= 0 : p >= 0;
  return `<em class="gx-delta ${p === 0 ? '' : bueno ? 'sube' : 'baja'}">${p > 0 ? '▲' : p < 0 ? '▼' : ''} ${Math.abs(p)}%</em>`;
}
const kpi = (i, color, valor, etiq, extra, accion) => `<${accion ? `button data-g="${accion[0]}" data-x="${accion[1]}"` : 'div'} class="gx-kpi" style="--k:${color}"><span class="gx-kpi-i">${ico(i, 22)}</span><div><small>${etiq}</small><b>${valor}</b>${extra || ''}</div></${accion ? 'button' : 'div'}>`;
const vacio = (t, s, btn) => `<div class="gx-vacio"><b>${t}</b>${s ? `<p>${s}</p>` : ''}${btn || ''}</div>`;

/* ---------------- Gráficas (SVG) ---------------- */
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const diaCorto = (f) => DIAS[new Date(String(f).slice(0, 10) + 'T12:00:00').getDay()];
const PALETA = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#06b6d4', '#ec4899', '#eab308', '#64748b'];
function linea(datos, opts) {
  opts = opts || {}; const n = datos.length; if (!n) return ''; const W = 560, H = opts.alto || 170, pl = 30, pb = 22, pt = 12;
  const max = Math.max(1, ...datos.map((d) => d.v)); const tope = Math.ceil(max * 1.15) || 1;
  const X = (i) => pl + (n === 1 ? (W - pl) / 2 : i * (W - pl - 8) / (n - 1)), Y = (v) => pt + (H - pt - pb) * (1 - v / tope);
  const pts = datos.map((d, i) => [X(i), Y(d.v)]); const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const id = 'g' + Math.random().toString(36).slice(2, 7); const c = opts.color || 'var(--gx-ac)';
  let h = `<svg viewBox="0 0 ${W} ${H}" class="gx-graf" role="img" aria-label="${esc(opts.titulo || '')}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>`;
  [0, 0.5, 1].forEach((f) => { const y = Y(tope * f); h += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" class="gx-rejilla"/><text x="${pl - 6}" y="${y + 3}" text-anchor="end" class="gx-eje">${Math.round(tope * f)}</text>`; });
  h += `<path d="${path} L${pts[n - 1][0]} ${H - pb} L${pts[0][0]} ${H - pb} Z" fill="url(#${id})"/><path d="${path}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p, i) => { h += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--gx-panel)" stroke="${c}" stroke-width="2"><title>${esc(datos[i].e)}: ${datos[i].v}</title></circle>`; if (n <= 10 || i % Math.ceil(n / 8) === 0) h += `<text x="${p[0]}" y="${H - 6}" text-anchor="middle" class="gx-eje">${esc(datos[i].e)}</text>`; });
  return h + '</svg>';
}
function barras(datos, colores, opts) {
  opts = opts || {}; const n = datos.length; if (!n) return ''; const W = Math.max(320, n * 20), H = opts.alto || 160, pb = 22;
  const tot = datos.map((d) => d.valores.reduce((a, b) => a + Number(b || 0), 0)); const max = Math.max(1, ...tot);
  const bw = (W - 8) / n; let h = `<svg viewBox="0 0 ${W} ${H}" class="gx-graf" role="img" aria-label="${esc(opts.titulo || 'Gráfica')}">`;
  [0.5, 1].forEach((f) => { const y = (H - pb) - (H - pb - 10) * f; h += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="gx-rejilla"/>`; });
  datos.forEach((d, i) => {
    let y = H - pb; const x = 4 + i * bw + bw * 0.16, w = Math.max(2, bw * 0.68);
    d.valores.forEach((v, k) => { const hh = (H - pb - 10) * Number(v || 0) / max; if (hh <= 0) return; y -= hh; h += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" fill="${colores[k]}"><title>${esc(d.etiqueta)}: ${esc(opts.fmt ? opts.fmt(v) : v)}</title></rect>`; });
    if (opts.numeros && tot[i]) h += `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" class="gx-eje">${esc(opts.fmt ? opts.fmt(tot[i]) : tot[i])}</text>`;
    if (n <= 14 || i % Math.ceil(n / 10) === 0) h += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="gx-eje">${esc(d.etiqueta)}</text>`;
  });
  return h + '</svg>';
}
function dona(items) {
  const tot = items.reduce((a, b) => a + Number(b.n || 0), 0); if (!tot) return vacio('Sin membresías vigentes', 'Cuando registres pagos verás aquí cómo se reparten tus planes.');
  let a0 = -Math.PI / 2, h = '<div class="gx-dona"><svg viewBox="0 0 120 120" aria-hidden="true">';
  items.forEach((it, i) => {
    const c = it.color || PALETA[i % PALETA.length]; const f = Number(it.n) / tot, a1 = a0 + f * Math.PI * 2, gr = f > 0.5 ? 1 : 0;
    if (f >= 0.999) h += `<circle cx="60" cy="60" r="44" fill="none" stroke="${c}" stroke-width="16"/>`;
    else h += `<path d="M${60 + 44 * Math.cos(a0)} ${60 + 44 * Math.sin(a0)} A44 44 0 ${gr} 1 ${60 + 44 * Math.cos(a1)} ${60 + 44 * Math.sin(a1)}" fill="none" stroke="${c}" stroke-width="16"/>`;
    a0 = a1;
  });
  h += `<text x="60" y="58" text-anchor="middle" class="gx-dona-n">${tot}</text><text x="60" y="74" text-anchor="middle" class="gx-eje">vigentes</text></svg><ul>`;
  items.forEach((it, i) => { h += `<li><i style="background:${it.color || PALETA[i % PALETA.length]}"></i><span>${esc(it.plan)}</span><b>${Math.round(Number(it.n) * 100 / tot)}%</b><small>${it.n}</small></li>`; });
  return h + '</ul></div>';
}

/* ---------------- PANEL ---------------- */
const VISTAS = {};
const ACT = { entrada: ['entrar', '#22c55e', (a) => `<b>${esc(a.nombre)}</b> entró al gimnasio`], denegado: ['x', '#ef4444', (a) => `<b>${esc(a.nombre)}</b>: acceso denegado (${esc((MOTIVOS[a.motivo] || '').toLowerCase())})`],
  pago: ['pagos', '#3b82f6', (a) => `<b>${esc(a.nombre)}</b> pagó ${esc(a.plan || 'membresía')}${a.monto != null ? ' · ' + money(a.monto) : ''}`], abono: ['pagos', '#06b6d4', (a) => `<b>${esc(a.nombre)}</b> abonó${a.monto != null ? ' ' + money(a.monto) : ''}`],
  venta: ['carrito', '#f97316', (a) => `${a.nombre ? '<b>' + esc(a.nombre) + '</b> compró' : 'Venta'} en punto de venta${a.monto != null ? ' · ' + money(a.monto) : ''}`], alta: ['mas1', '#8b5cf6', (a) => `<b>${esc(a.nombre)}</b> se registró como socio`] };
VISTAS['g-hoy'] = async () => {
  const R = await llamar('gym_panel', { p_gym: G }); CUENTAS = { notif: (R.por_vencer_n || 0) + (R.cumple_hoy || 0) + (R.stock_bajo || 0), vigentes: R.vigentes, por_vencer: R.por_vencer_n, vencidos: R.vencidos_n, socios: R.socios };
  const hr = new Date().getHours(); const saludo = hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches';
  const d = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  let h = titulo(`${saludo}`, `Resumen de ${esc(INFO.nombre)} · ${esc(d)}`, `<button class="gx-btn" data-g="tab" data-x="g-entrada">${ico('entrar', 18)}Registrar entrada</button>`);
  h += `<div class="gx-kpis">
    ${kpi('socios', '#3b82f6', R.socios, 'Socios activos', delta(R.socios, R.socios_antes) + '<span class="gx-kpi-sub">vs. hace 30 días</span>', ['filtro-socios', 'activos'])}
    ${kpi('tarjeta', '#22c55e', R.vigentes, 'Membresías vigentes', delta(R.vigentes, R.vigentes_antes) + '<span class="gx-kpi-sub">vs. hace 30 días</span>', ['filtro-socios', 'al_corriente'])}
    ${kpi('entrar', '#8b5cf6', R.asis_hoy, 'Asistencias hoy', delta(R.asis_hoy, R.asis_ayer) + '<span class="gx-kpi-sub">vs. ayer a esta hora</span>', ['tab', 'g-entrada'])}
    ${R.ingresos_mes != null ? kpi('pagos', '#f59e0b', moneyK(R.ingresos_mes), 'Ingresos del mes', delta(R.ingresos_mes, R.ingresos_ant) + '<span class="gx-kpi-sub">vs. mes anterior</span>', puede.cobrar() ? ['tab', 'g-pagos'] : null)
      : kpi('alerta', '#f59e0b', R.por_vencer_n, 'Por vencer', `<span class="gx-kpi-sub">próximos ${R.aviso_dias} días</span>`, ['filtro-socios', 'por_vencer'])}</div>`;
  const chips = [];
  if (R.ingresos_hoy != null) chips.push(['ok', 'pagos', `Hoy: ${money(R.ingresos_hoy)} cobrados`, 'tab', 'g-pagos']);
  if (R.por_vencer_n) chips.push(['warn', 'alerta', `${R.por_vencer_n} por vencer`, 'filtro-socios', 'por_vencer']);
  if (R.vencidos_n) chips.push(['mal', 'x', `${R.vencidos_n} vencidos o sin pago`, 'filtro-socios', 'vencidos']);
  if (R.denegados_hoy) chips.push(['mal', 'escudo', `${R.denegados_hoy} ${R.denegados_hoy === 1 ? 'acceso denegado' : 'accesos denegados'} hoy`, 'tab', 'g-entrada']);
  if (R.cumple_hoy) chips.push(['info', 'pastel', `${R.cumple_hoy} ${R.cumple_hoy === 1 ? 'cumpleaños' : 'cumpleaños'} hoy`, 'tab', 'g-notif']);
  if (R.con_saldo) chips.push(['warn', 'pagos', `${R.con_saldo} con saldo pendiente`, 'tab', 'g-pagos']);
  if (R.stock_bajo) chips.push(['mal', 'caja', `${R.stock_bajo} ${R.stock_bajo === 1 ? 'producto por agotarse' : 'productos por agotarse'}`, 'tab', 'g-inventario']);
  if (chips.length) h += `<div class="gx-chips-al">${chips.map(([c, i, t, a, x]) => `<button class="gx-chip-al ${c}" data-g="${a}" data-x="${x}">${ico(i, 16)}${t}</button>`).join('')}</div>`;
  if (!INFO.planes.some((p) => Number(p.precio) > 0) && puede.administrar()) h += `<div class="gx-card gx-dest"><div><b>Primer paso: tus membresías</b><p>Captura los planes que vendes (mensual, trimestral, visita…) para poder cobrar.</p></div><button class="gx-btn" data-g="tab" data-x="g-membresias">Configurar membresías</button></div>`;
  h += `<div class="gx-grid-2">
    <section class="gx-card"><div class="gx-card-cab"><b>Asistencias últimos 7 días</b><span class="gx-tenue">${(() => { const n = R.serie_asis.reduce((a, x) => a + x.n, 0); return n + (n === 1 ? ' entrada' : ' entradas'); })()}</span></div>${linea(R.serie_asis.map((x) => ({ e: diaCorto(x.d), v: x.n })), { titulo: 'Asistencias últimos 7 días' })}</section>
    <section class="gx-card"><div class="gx-card-cab"><b>Distribución de membresías</b><button class="gx-link" data-g="tab" data-x="g-membresias">Ver planes ›</button></div>${dona(R.membresias)}</section></div>`;
  h += `<div class="gx-grid-2">
    ${R.serie_ing ? `<section class="gx-card"><div class="gx-card-cab"><b>Ingresos de los últimos 30 días</b><span class="gx-ley"><i style="background:var(--gx-ac)"></i>Membresías<i style="background:#3b82f6"></i>Ventas</span></div>${barras(R.serie_ing.map((x) => ({ etiqueta: fDia(x.d).split(' ')[0], valores: [Number(x.m), Number(x.v)] })), ['var(--gx-ac)', '#3b82f6'], { fmt: money, titulo: 'Ingresos 30 días' })}</section>` : ''}
    <section class="gx-card"><div class="gx-card-cab"><b>Actividad reciente</b></div>${R.actividad.length ? '<ul class="gx-feed">' + R.actividad.map((a) => { const t = ACT[a.t] || ACT.entrada; return `<li data-g="${a.venta_id ? 'venta' : 'socio'}" data-x="${a.venta_id || a.socio_id || ''}"><span class="gx-feed-i" style="--k:${t[1]}">${ico(t[0], 16)}</span><div><p>${t[2](a)}</p><small>${esc(hace(a.f))}</small></div></li>`; }).join('') + '</ul>' : vacio('Aún no hay actividad', 'Aquí verás entradas, pagos y ventas al momento.')}</section></div>`;
  h += `<div class="gx-grid-2">
    <section class="gx-card"><div class="gx-card-cab"><b>Por vencer</b><button class="gx-link" data-g="tab" data-x="g-notif">Avisar a todos ›</button></div>${R.por_vencer.length ? '<div class="gx-filas">' + R.por_vencer.map((s) => filaSocio(s, true)).join('') + '</div>' : vacio('Nadie vence pronto', `Próximos ${R.aviso_dias} días.`)}</section>
    <section class="gx-card gx-sin-pad"><div class="gx-card-cab gx-pad"><b>Últimos socios registrados</b><button class="gx-link" data-g="tab" data-x="g-socios">Ver todos ›</button></div>${R.ultimos.length ? tablaSocios(R.ultimos, true) : vacio('Aún no hay socios', '', puede.cobrar() ? '<button class="gx-btn" data-g="ir" data-x="g-nuevo">Registrar el primero</button>' : '')}</section></div>`;
  return h;
};
function filaSocio(s, wa) {
  const msg = s.estado === 'por_vencer' ? `Hola ${nombre1(s.nombre)}, te recordamos que tu membresía de ${INFO.nombre} vence el ${fCorta(s.vence_en)}. ¡Te esperamos!` : `Hola ${nombre1(s.nombre)}, te extrañamos en ${INFO.nombre}. Cuando quieras te ayudamos a renovar tu membresía.`;
  return `<div class="gx-fila"><button class="gx-fila-p" data-g="socio" data-x="${s.id}">${avatar(s)}<div><b>${esc(s.nombre)}</b><small>#${s.numero} · ${esc(venceTxt(s))}</small></div>${pill(s.estado)}</button>${wa && s.telefono ? `<a class="gx-wa" href="${waLink(s.telefono, msg)}" target="_blank" rel="noopener" aria-label="WhatsApp a ${esc(s.nombre)}">${ico('whats', 18)}</a>` : ''}</div>`;
}
function tablaSocios(L, corta) {
  return `<div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Socio</th><th>Membresía</th>${corta ? '<th class="gx-col-md">Registro</th>' : '<th>Vence</th><th class="gx-col-md">Saldo</th><th class="gx-col-md">Última visita</th>'}<th>Estado</th></tr></thead><tbody>
    ${L.map((s) => `<tr data-g="socio" data-x="${s.id}"><td><div class="gx-cel-socio">${avatar(s)}<div><b>${esc(s.nombre)}</b><small>#${s.numero}${s.vinculado ? ' · usa la app' : ''}</small></div></div></td><td>${plantag(s)}</td>
      ${corta ? `<td class="gx-col-md">${fCorta(s.creado_en)}</td>` : `<td>${s.vence_en ? `<span class="${s.dias < 0 ? 'gx-txt-mal' : s.estado === 'por_vencer' ? 'gx-txt-warn' : ''}">${fCorta(s.vence_en)}</span>` : '—'}</td><td class="gx-col-md">${Number(s.saldo) > 0 ? `<span class="gx-txt-warn">${money(s.saldo)}</span>` : '—'}</td><td class="gx-col-md">${esc(hace(s.ultima))}</td>`}
      <td>${pill(s.estado)}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------------- ACCESOS ---------------- */
VISTAS['g-entrada'] = async (v) => {
  const dia = v.dia || hoyMx(); const A = await llamar('gym_accesos', { p_gym: G, p_dia: dia });
  const pol = (INFO.ajustes || {}).politica_vencidos === 'bloquear';
  let h = titulo('Accesos', `Control de entrada · ${pol ? 'a los vencidos se les niega el acceso' : 'a los vencidos se les avisa y pasan'}`, puede.administrar() ? '<button class="gx-btn gx-sec gx-btn-sm" data-g="config-ir" data-x="acceso">Cambiar política</button>' : '');
  const scan = 'BarcodeDetector' in window;
  h += `<div class="gx-acceso"><section class="gx-card gx-estacion">
      ${INFO.sedes.length > 1 ? `<select class="gx-in" id="gySede">${INFO.sedes.map((s) => `<option value="${s.id}" ${String(v.sede || '') === String(s.id) ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>` : ''}
      <label class="gx-lab" for="gyNum">Número de socio o lector de QR</label>
      <div class="gx-fila-in"><input class="gx-in gx-in-xl" id="gyNum" inputmode="numeric" maxlength="40" placeholder="Ej. 125" autocomplete="off"><button class="gx-btn gx-btn-xl" data-g="checkin">Registrar</button></div>
      ${scan ? `<div class="gx-scan ${camara ? 'on' : ''}"><video id="gyVideo" playsinline muted></video><div class="gx-scan-ayuda" id="gyScanAyuda">Apunta la cámara al QR del socio.</div></div><button class="gx-btn gx-sec gx-ancho" data-g="camara">${ico('acceso', 18)}${camara ? 'Cerrar cámara' : 'Escanear QR con la cámara'}</button>` : '<p class="gx-tenue gx-peq">También funciona un lector de códigos USB: escanea y se registra solo.</p>'}
    </section><section id="gyResultado" class="gx-resultado">${v.res ? resultado(v.res) : `<div class="gx-res-espera">${ico('acceso', 48)}<p>Escanea el QR del socio o escribe su número.</p></div>`}</section></div>`;
  const ayer = sumaDias(dia, -1), man = sumaDias(dia, 1);
  h += `<section class="gx-card"><div class="gx-card-cab"><b>Bitácora del ${dia === hoyMx() ? 'día de hoy' : fCorta(dia)}</b><div class="gx-pager"><button data-g="acc-dia" data-x="${ayer}" aria-label="Día anterior">‹</button><input type="date" class="gx-in gx-in-sm" id="gyAccDia" value="${dia}" max="${hoyMx()}"><button data-g="acc-dia" data-x="${man}" ${dia >= hoyMx() ? 'disabled' : ''} aria-label="Día siguiente">›</button></div></div>
    <div class="gx-mini-kpis"><div><b>${A.permitidos}</b><span>Entradas</span></div><div><b>${A.unicos}</b><span>Personas</span></div><div class="mal"><b>${A.denegados}</b><span>Denegados</span></div></div>
    ${A.permitidos ? `<div class="gx-horas"><small class="gx-tenue">Entradas por hora</small>${barras(A.por_hora.map((n, i) => ({ etiqueta: String(i), valores: [n] })).slice(5, 23), ['var(--gx-ac)'], { alto: 110, titulo: 'Entradas por hora' })}</div>` : ''}
    ${A.lista.length ? `<div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Hora</th><th>Socio</th><th class="gx-col-md">Membresía</th><th>Resultado</th></tr></thead><tbody>${A.lista.map((x) => `<tr data-g="socio" data-x="${x.socio_id}"><td><b>${hora(x.f)}</b></td><td>#${x.numero} ${esc(x.nombre)}</td><td class="gx-col-md">${esc(x.plan || '—')}</td><td>${x.ok ? (x.al_corriente ? '<em class="gx-pill ok">Permitido</em>' : '<em class="gx-pill warn">Pasó sin pago al día</em>') : `<em class="gx-pill mal">Denegado · ${esc(MOTIVOS[x.motivo] || '')}</em>`}</td></tr>`).join('')}</tbody></table></div>` : vacio('Sin movimientos este día')}</section>`;
  return h;
};
function resultado(r) {
  const s = r.socio;
  if (!r.ok) return `<div class="gx-res mal"><div class="gx-res-banda">${ico('x', 22)} ACCESO DENEGADO</div>${avatar(s, 'gx-av-xl')}<b>${esc(s.nombre)}</b><span>#${s.numero} · ${esc(MOTIVOS[r.motivo] || '')}</span><small>${esc(venceTxt(s))}</small>
    <div class="gx-res-acc">${r.motivo !== 'baja' && r.motivo !== 'congelado' && puede.cobrar() ? `<button class="gx-btn" data-g="cobrar-abrir" data-x="${s.id}">Renovar ahora</button>` : ''}<button class="gx-btn gx-sec" data-g="socio" data-x="${s.id}">Ver socio</button></div></div>`;
  const cls = s.estado === 'al_corriente' ? 'ok' : s.estado === 'por_vencer' ? 'warn' : 'mal';
  return `<div class="gx-res ${cls}"><div class="gx-res-banda">${cls === 'ok' ? ico('escudo', 22) + ' BIENVENIDO' : cls === 'warn' ? ico('alerta', 22) + ' POR VENCER' : ico('alerta', 22) + ' SIN PAGO AL DÍA'}</div>
    ${avatar(s, 'gx-av-xl')}<b>${esc(s.nombre)}</b><span>#${s.numero} · ${s.plan ? esc(s.plan) : 'Sin plan'}</span><small>${esc(venceTxt(s))}${s.vence_en ? ' · ' + fCorta(s.vence_en) : ''}</small>
    ${Number(s.saldo) > 0 ? `<div class="gx-res-saldo">Saldo pendiente ${money(s.saldo)}</div>` : ''}
    <small class="gx-tenue">${r.repetido ? 'Ya había registrado su entrada hace poco.' : 'Entrada registrada a las ' + hora(new Date().toISOString())}</small>
    <div class="gx-res-acc">${cls !== 'ok' && puede.cobrar() ? `<button class="gx-btn" data-g="cobrar-abrir" data-x="${s.id}">Cobrar</button>` : ''}<button class="gx-btn gx-sec" data-g="socio" data-x="${s.id}">Ver socio</button></div></div>`;
}
async function checkin(dato, metodo) {
  const sede = $('gySede') ? Number($('gySede').value) : null;
  const r = await llamar('gym_checkin', { p_gym: G, p_sede: sede, p_dato: dato });
  vista.res = r; vista.sede = sede;
  const el = $('gyResultado'); if (el) el.innerHTML = resultado(r);
  try { navigator.vibrate && navigator.vibrate(r.ok && ['al_corriente', 'por_vencer'].includes(r.socio.estado) ? 60 : [90, 60, 90]); } catch (e) {}
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
      try { const cods = await camara.det.detect($('gyVideo')); const val = cods && cods[0] && cods[0].rawValue;
        if (val && /^aet-gym:/i.test(val) && (val !== camara.ultimo || Date.now() - camara.t > 4000)) { camara.ultimo = val; camara.t = Date.now(); await checkin(val, 'qr').catch((e) => toast(e.message)); } } catch (e) {}
      if (camara) camara.raf = setTimeout(ciclo, 350);
    };
    ciclo();
  } catch (e) { camara = null; toast('No se pudo abrir la cámara. Revisa el permiso o escribe el número.'); pintar(); }
}
function pararCamara() { if (!camara) return; try { clearTimeout(camara.raf); camara.stream.getTracks().forEach((t) => t.stop()); } catch (e) {} camara = null; }

/* ---------------- SOCIOS ---------------- */
VISTAS['g-socios'] = async (v) => {
  const f = v.f || 'activos';
  const L = await llamar('gym_socios_listar', { p_gym: G, p_filtro: f, p_busca: v.q || null });
  if (!CUENTAS) { try { const R = await llamar('gym_panel', { p_gym: G }); CUENTAS = { vigentes: R.vigentes, por_vencer: R.por_vencer_n, vencidos: R.vencidos_n, socios: R.socios, notif: (R.por_vencer_n || 0) + (R.cumple_hoy || 0) + (R.stock_bajo || 0) }; } catch (e) { CUENTAS = {}; } }
  const C = CUENTAS || {};
  const F = [['activos', 'Activos', C.socios], ['al_corriente', 'Vigentes', C.vigentes], ['por_vencer', 'Por vencer', C.por_vencer], ['vencidos', 'Vencidos / sin pago', C.vencidos], ['baja', 'Bajas']];
  let h = titulo('Socios', `${INFO.socios_activos} activos de ${(INFO.plan_info.socios || 0) * INFO.sedes_max} en tu plan`, puede.cobrar() ? `<button class="gx-btn" data-g="ir" data-x="g-nuevo">${ico('mas1', 18)}Nuevo socio</button>` : '');
  h += `<div class="gx-barra-filtros"><div class="gx-buscar gx-buscar-in">${ico('buscar', 18)}<input class="gx-in" id="gyBusca" type="search" placeholder="Buscar por nombre, número o teléfono" value="${esc(v.q || '')}" autocomplete="off"></div>
    <div class="gx-chips">${F.map(([k, n, c]) => `<button class="gx-chip ${f === k ? 'on' : ''}" data-g="filtro" data-x="${k}">${n}${c != null ? ` <em>${c}</em>` : ''}</button>`).join('')}</div></div>`;
  h += `<section class="gx-card gx-sin-pad">${L.length ? tablaSocios(L) : vacio(v.q ? 'Sin resultados' : 'No hay socios en este filtro', '', puede.cobrar() && !v.q && f === 'activos' ? '<button class="gx-btn" data-g="ir" data-x="g-nuevo">Registrar socio</button>' : '')}</section>${L.length >= 300 ? '<p class="gx-tenue gx-peq">Mostrando 300. Usa la búsqueda.</p>' : ''}`;
  return h;
};

VISTAS['g-nuevo'] = async (v) => {
  const s = v.s || {};
  return titulo(s.id ? 'Editar socio' : 'Nuevo socio', s.id ? '#' + s.numero : 'Al guardar te llevamos a cobrar su membresía') + `<section class="gx-card gx-form gx-form-2">
    <label class="gx-ancho2">Nombre completo<input class="gx-in" id="gsNom" maxlength="80" value="${esc(s.nombre || '')}" autocomplete="off"></label>
    <label>Teléfono (WhatsApp)<input class="gx-in" id="gsTel" type="tel" maxlength="20" value="${esc(s.telefono || '')}"></label>
    <label>Correo <span class="gx-tenue">(opcional)</span><input class="gx-in" id="gsMail" type="email" maxlength="120" value="${esc(s.email || '')}"></label>
    <label>Fecha de nacimiento <span class="gx-tenue">(para felicitarlo)</span><input class="gx-in" id="gsNac" type="date" max="${hoyMx()}" value="${esc(s.fecha_nac || '')}"></label>
    <label>Contacto de emergencia<input class="gx-in" id="gsEmer" maxlength="120" placeholder="Nombre y teléfono" value="${esc(s.emergencia || '')}"></label>
    ${INFO.sedes.length > 1 ? `<label>Sede<select class="gx-in" id="gsSede">${INFO.sedes.map((x) => `<option value="${x.id}" ${x.id === s.sede_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></label>` : ''}
    <label class="gx-ancho2">Nota interna <span class="gx-tenue">(solo la ve tu equipo)</span><input class="gx-in" id="gsNota" maxlength="300" value="${esc(s.nota || '')}"></label>
    <div class="gx-ancho2 gx-form-acc"><button class="gx-btn gx-btn-lg" data-g="guardar-socio" data-x="${s.id || ''}">${s.id ? 'Guardar cambios' : 'Registrar y cobrar'}</button></div></section>
    <p class="gx-tenue gx-peq">Guarda solo los datos necesarios para dar el servicio. El socio puede pedir que se corrijan o borren.</p>`;
};

VISTAS['g-socio'] = async (v) => {
  const s = await llamar('gym_socio_detalle', { p_gym: G, p_socio: v.id }); vista.s = s;
  const tab = v.tab || 'resumen';
  const congelado = s.estado === 'congelado';
  let h = `<section class="gx-card gx-ficha"><div class="gx-ficha-foto">${avatar(s, 'gx-av-xxl')}${puede.cobrar() ? `<label class="gx-foto-btn" title="Cambiar foto" aria-label="Cambiar foto">${ico('mas1', 16)}<input type="file" accept="image/*" capture="user" id="gyFoto" hidden></label>` : ''}</div>
    <div class="gx-ficha-d"><h1>${esc(s.nombre)}</h1><p>#${s.numero} · ${plantag(s)} ${pill(s.estado)}</p><p class="gx-tenue">${esc(venceTxt(s))}${s.vence_en ? ' · ' + fCorta(s.vence_en) : ''}${s.telefono ? ' · ' + esc(s.telefono) : ''}</p></div>
    <div class="gx-ficha-acc">
      ${s.estado !== 'baja' && puede.cobrar() ? `<button class="gx-btn" data-g="cobrar-abrir" data-x="${s.id}">${ico('pagos', 18)}${s.vence_en && s.dias >= 0 ? 'Renovar' : 'Cobrar'}</button>` : ''}
      ${s.estado !== 'baja' ? `<button class="gx-btn gx-sec" data-g="entrada-manual">${ico('entrar', 18)}Entrada</button>` : ''}
      ${s.telefono ? `<a class="gx-btn gx-sec" href="${waLink(s.telefono, `Hola ${nombre1(s.nombre)}, te escribimos de ${INFO.nombre}.`)}" target="_blank" rel="noopener">${ico('whats', 18)}WhatsApp</a>` : ''}
      ${s.token && s.estado !== 'baja' ? `<button class="gx-btn gx-sec" data-g="credencial">${ico('acceso', 18)}Credencial</button>` : ''}
      ${puede.administrar() && s.estado !== 'baja' ? (congelado ? `<button class="gx-btn gx-sec" data-g="descongelar">${ico('hielo', 18)}Descongelar</button>` : s.vence_en && s.dias >= 0 ? `<button class="gx-btn gx-sec" data-g="congelar-abrir">${ico('hielo', 18)}Congelar</button>` : '') : ''}
    </div></section>`;
  const TABS = [['resumen', 'Resumen'], ['pagos', 'Pagos'], ['asistencias', 'Asistencias'], ['compras', 'Compras'], ['datos', 'Datos']].filter((t) => (t[0] !== 'pagos' && t[0] !== 'compras') || s.pagos);
  h += `<div class="gx-tabs">${TABS.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-g="ficha-tab" data-x="${k}">${n}</button>`).join('')}</div>`;
  if (tab === 'resumen') {
    const ult = (s.pagos || []).find((p) => !p.anulado && !p.pago_de);
    let prog = ''; if (ult && ult.desde && ult.hasta) { const tot = Math.max(1, (new Date(ult.hasta) - new Date(ult.desde)) / 864e5 + 1), usado = Math.min(tot, Math.max(0, (new Date(hoyMx()) - new Date(ult.desde)) / 864e5 + 1)); prog = `<div class="gx-prog"><i style="width:${Math.round(usado / tot * 100)}%"></i></div><small class="gx-tenue">${fCorta(ult.desde)} → ${fCorta(ult.hasta)}</small>`; }
    const dias30 = new Set((s.asistencias || []).map((a) => new Date(a).toLocaleDateString('en-CA')));
    const celdas = Array.from({ length: 30 }, (_, i) => { const f = sumaDias(hoyMx(), i - 29); return `<i class="${dias30.has(f) ? 'si' : ''}" title="${fDia(f)}"></i>`; }).join('');
    h += `<div class="gx-grid-3">
      <section class="gx-card gx-mem" style="--k:${esc(s.plan_color || 'var(--gx-ac)')}"><small>Membresía</small><b>${esc(s.plan || 'Sin plan')}</b>${pill(s.estado)}<p>${esc(venceTxt(s))}</p>${prog}</section>
      <section class="gx-card"><small class="gx-tenue">Saldo pendiente</small><b class="gx-num-g ${Number(s.saldo) > 0 ? 'gx-txt-warn' : ''}">${money(s.saldo)}</b>${Number(s.saldo) > 0 && puede.cobrar() ? `<button class="gx-btn gx-btn-sm" data-g="abonar-abrir">Registrar abono</button>` : '<p class="gx-tenue gx-peq">Al corriente con sus pagos.</p>'}</section>
      <section class="gx-card"><small class="gx-tenue">Asistencia · últimos 30 días</small><b class="gx-num-g">${s.asistencias_30}</b><div class="gx-calor">${celdas}</div><small class="gx-tenue">Última visita: ${esc(hace(s.ultima))}</small></section></div>`;
    if (s.token && s.estado !== 'baja') {
      const link = appUrl() + '?modo=app&socio=' + s.codigo_vincular;
      h += `<section class="gx-card gx-app-socio"><div><b>App del socio</b>${s.vinculado ? '<p>✓ Ya usa la app: ve su membresía, su próximo pago y entra con su QR.</p>' : `<p>Código para vincular: <b class="gx-codigo">${esc(s.codigo_vincular)}</b></p><p class="gx-tenue gx-peq">Con la app ve cuándo vence, su próximo pago y entra mostrando su QR. Es gratis.</p>`}</div>
        ${!s.vinculado && s.telefono ? `<a class="gx-btn gx-wa-b" href="${waLink(s.telefono, `Hola ${nombre1(s.nombre)}, ya puedes ver tu membresía de ${INFO.nombre} y entrar con tu QR en la app Aeterion: ${link}`)}" target="_blank" rel="noopener">${ico('whats', 18)}Enviar enlace</a>` : ''}</section>`;
    }
    if (s.nota) h += `<section class="gx-card"><small class="gx-tenue">Nota interna</small><p>${esc(s.nota)}</p></section>`;
  } else if (tab === 'pagos') {
    h += s.pagos.length ? `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Fecha</th><th>Concepto</th><th>Pagado</th><th class="gx-col-md">Método</th><th class="gx-col-md">Vigencia</th><th></th></tr></thead><tbody>${s.pagos.map((p) => {
      const pend = p.pago_de ? 0 : Number(p.total) - Number(p.abonado || 0);
      return `<tr class="${p.anulado ? 'gx-anulado' : ''}"><td>${fechaHora(p.fecha)}</td><td>${p.pago_de ? 'Abono' : esc(p.plan || p.concepto || 'Membresía')}${!p.anulado && pend > 0 ? `<br><small class="gx-txt-warn">Pendiente ${money(pend)}</small>` : ''}${p.anulado ? `<br><small>Anulado: ${esc(p.motivo || '')}</small>` : ''}</td>
        <td><b>${money(p.monto)}</b>${!p.pago_de && Number(p.total) !== Number(p.monto) ? `<br><small class="gx-tenue">de ${money(p.total)}</small>` : ''}</td><td class="gx-col-md">${METODOS[p.metodo]}</td><td class="gx-col-md">${p.desde ? fDia(p.desde) + ' → ' + fCorta(p.hasta) : '—'}</td>
        <td class="gx-acc-cel">${!p.anulado ? `<button class="gx-link" data-g="ticket-pago" data-x="${p.id}">Recibo</button>` : ''}${!p.anulado && pend > 0 && puede.cobrar() ? `<button class="gx-link" data-g="abonar-abrir" data-x="${p.id}">Abonar</button>` : ''}${!p.anulado && puede.administrar() ? `<button class="gx-link mal" data-g="anular-abrir" data-x="${p.id}">Anular</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></section>` : vacio('Sin pagos registrados', '', puede.cobrar() ? `<button class="gx-btn" data-g="cobrar-abrir" data-x="${s.id}">Cobrar membresía</button>` : '');
  } else if (tab === 'asistencias') {
    h += s.asistencias.length ? `<section class="gx-card"><div class="gx-card-cab"><b>${s.asistencias_30} entradas en 30 días</b></div><div class="gx-asis">${s.asistencias.map((a) => `<span>${ico('entrar', 14)}${fechaHora(a)}</span>`).join('')}</div></section>` : vacio('Aún no registra entradas');
  } else if (tab === 'compras') {
    h += s.compras && s.compras.length ? `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Folio</th><th>Fecha</th><th>Total</th><th></th></tr></thead><tbody>${s.compras.map((c) => `<tr data-g="venta" data-x="${c.id}" class="${c.cancelada ? 'gx-anulado' : ''}"><td>#${c.folio}</td><td>${fechaHora(c.fecha)}</td><td><b>${money(c.total)}</b></td><td>${c.cancelada ? '<em class="gx-pill gris">Cancelada</em>' : ''}</td></tr>`).join('')}</tbody></table></div></section>` : vacio('Sin compras en el punto de venta');
  } else {
    h += `<section class="gx-card gx-datos"><div><small>Teléfono</small><b>${esc(s.telefono || '—')}</b></div><div><small>Correo</small><b>${esc(s.email || '—')}</b></div><div><small>Cumpleaños</small><b>${s.fecha_nac ? fCorta(s.fecha_nac) : '—'}</b></div><div><small>Emergencia</small><b>${esc(s.emergencia || '—')}</b></div><div><small>Socio desde</small><b>${fCorta(s.creado_en)}</b></div><div><small>Usa la app</small><b>${s.vinculado ? 'Sí' : 'No'}</b></div></section>
      <div class="gx-fila-btns">${puede.cobrar() ? '<button class="gx-btn gx-sec" data-g="editar-socio">Editar datos</button>' : ''}${puede.administrar() ? `<button class="gx-btn gx-peligro" data-g="baja" data-x="${s.estado === 'baja' ? '1' : '0'}">${s.estado === 'baja' ? 'Reactivar socio' : 'Dar de baja'}</button>` : ''}</div>`;
  }
  return h;
};

/* ---------------- MEMBRESÍAS ---------------- */
VISTAS['g-membresias'] = async () => {
  const M = await llamar('gym_membresias', { p_gym: G });
  let h = titulo('Membresías', 'Los planes que vendes, cuántos socios tiene cada uno y cuánto te dejan', puede.administrar() ? `<button class="gx-btn" data-g="plan-abrir">${ico('mas1', 18)}Nuevo plan</button>` : '');
  h += M.length ? '<div class="gx-planes">' + M.map((p, i) => `<section class="gx-card gx-plan-c" style="--k:${esc(p.color || PALETA[i % PALETA.length])}"><div class="gx-plan-cab"><div><b>${esc(p.nombre)}</b><small>${p.dias} ${p.dias === 1 ? 'día' : 'días'}</small></div><strong>${money(p.precio)}</strong></div>
      <div class="gx-plan-n"><div><b>${p.vigentes}</b><span>Vigentes</span></div><div><b class="gx-txt-warn">${p.por_vencer}</b><span>Por vencer</span></div><div><b>${p.vendidas_mes}</b><span>Vendidas este mes</span></div>${p.ingresos_mes != null ? `<div><b>${moneyK(p.ingresos_mes)}</b><span>Ingresos del mes</span></div>` : ''}</div>
      ${puede.administrar() ? `<div class="gx-fila-btns"><button class="gx-btn gx-sec gx-btn-sm" data-g="plan-abrir" data-x="${p.id}">Editar</button><button class="gx-link mal" data-g="plan-quitar" data-x="${p.id}">Ya no lo vendo</button></div>` : ''}</section>`).join('') + '</div>'
    : vacio('Aún no tienes planes', 'Ejemplos: Visita (1 día), Semana (7), Mensual (30), Trimestral (90), Semestral (180), Anual (365).', puede.administrar() ? '<button class="gx-btn" data-g="plan-abrir">Crear el primero</button>' : '');
  return h;
};

/* ---------------- PAGOS ---------------- */
function rangoTxt(r) { const hoy = hoyMx(); return { hoy: [hoy, hoy], ayer: [sumaDias(hoy, -1), sumaDias(hoy, -1)], semana: [sumaDias(hoy, -6), hoy], mes: [hoy.slice(0, 8) + '01', hoy], d30: [sumaDias(hoy, -29), hoy] }[r]; }
VISTAS['g-pagos'] = async (v) => {
  const tab = v.tab || 'pagos';
  let h = titulo('Pagos', 'Membresías, abonos, quién te debe y corte de caja', puede.cobrar() ? `<button class="gx-btn" data-g="tab" data-x="g-socios">${ico('pagos', 18)}Cobrar a un socio</button>` : '');
  h += `<div class="gx-tabs">${[['pagos', 'Historial'], ['deudores', 'Quién debe'], ['caja', 'Corte de caja']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-g="pagos-tab" data-x="${k}">${n}</button>`).join('')}</div>`;
  if (tab === 'caja') return h + await cajaHtml(v);
  const r = v.r || (puede.administrar() ? 'd30' : 'hoy'); const [d, hs] = rangoTxt(r) || rangoTxt('hoy');
  const R = await llamar('gym_pagos_listar', { p_gym: G, p_desde: d, p_hasta: hs, p_metodo: v.met || null });
  if (tab === 'deudores') {
    const tot = R.deudores.reduce((a, s) => a + Number(s.saldo), 0);
    return h + `<div class="gx-kpis gx-kpis-2">${kpi('pagos', '#f59e0b', money(tot), 'Por cobrar', '')}${kpi('socios', '#ef4444', R.deudores.length, 'Socios con saldo', '')}</div>` + (R.deudores.length ? `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Socio</th><th>Debe</th><th class="gx-col-md">Membresía</th><th></th></tr></thead><tbody>${R.deudores.map((s) => `<tr><td data-g="socio" data-x="${s.id}"><div class="gx-cel-socio">${avatar(s)}<div><b>${esc(s.nombre)}</b><small>#${s.numero}</small></div></div></td><td><b class="gx-txt-warn">${money(s.saldo)}</b></td><td class="gx-col-md">${plantag(s)}</td>
      <td class="gx-acc-cel">${puede.cobrar() ? `<button class="gx-btn gx-btn-sm" data-g="abonar-socio" data-x="${s.id}">Abonar</button>` : ''}${s.telefono ? `<a class="gx-wa" href="${waLink(s.telefono, `Hola ${nombre1(s.nombre)}, te recordamos que tienes un saldo pendiente de ${money(s.saldo)} en ${INFO.nombre}. ¡Gracias!`)}" target="_blank" rel="noopener" aria-label="Recordar por WhatsApp">${ico('whats', 18)}</a>` : ''}</td></tr>`).join('')}</tbody></table></div></section>` : vacio('Nadie te debe', 'Los pagos parciales aparecen aquí hasta que se liquiden.'));
  }
  const ops = puede.administrar() ? [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', '7 días'], ['mes', 'Este mes'], ['d30', '30 días']] : [['hoy', 'Hoy'], ['ayer', 'Ayer']];
  h += `<div class="gx-barra-filtros"><div class="gx-chips">${ops.map(([k, n]) => `<button class="gx-chip ${r === k ? 'on' : ''}" data-g="rango" data-x="${k}">${n}</button>`).join('')}</div>
    <select class="gx-in gx-in-sm" id="gyMet" aria-label="Método de pago"><option value="">Todos los métodos</option>${Object.keys(METODOS).map((k) => `<option value="${k}" ${v.met === k ? 'selected' : ''}>${METODOS[k]}</option>`).join('')}</select></div>`;
  const pg = R.pagos.filter((p) => !p.anulado);
  h += `<div class="gx-kpis gx-kpis-3">${kpi('pagos', '#22c55e', money(R.total), 'Cobrado', '')}${kpi('recibo', '#3b82f6', pg.filter((p) => !p.abono).length, 'Membresías', '')}${kpi('pagos', '#06b6d4', pg.filter((p) => p.abono).length, 'Abonos', '')}</div>`;
  h += R.pagos.length ? `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Fecha</th><th>Socio</th><th>Concepto</th><th>Monto</th><th class="gx-col-md">Método</th><th class="gx-col-md">Registró</th></tr></thead><tbody>${R.pagos.map((p) => `<tr data-g="socio" data-x="${p.socio_id}" class="${p.anulado ? 'gx-anulado' : ''}"><td>${fechaHora(p.fecha)}</td><td>#${p.numero} ${esc(p.socio)}</td><td>${esc(p.concepto)}${Number(p.total) !== Number(p.monto) && !p.abono ? ` <small class="gx-tenue">(de ${money(p.total)})</small>` : ''}</td><td><b>${money(p.monto)}</b></td><td class="gx-col-md">${METODOS[p.metodo]}</td><td class="gx-col-md">${esc(p.por || '')}</td></tr>`).join('')}</tbody></table></div></section>` : vacio('Sin pagos en este periodo');
  return h;
};
async function cajaHtml(v) {
  const r = ['hoy', 'ayer', 'semana', 'mes'].includes(v.r) ? v.r : 'hoy'; const R = rangoTxt(r); const ops = puede.administrar() ? ['hoy', 'ayer', 'semana', 'mes'] : ['hoy', 'ayer'];
  const C = await llamar('gym_caja', { p_gym: G, p_desde: R[0], p_hasta: R[1] });
  let h = `<div class="gx-chips gx-mb">${ops.map((k) => `<button class="gx-chip ${r === k ? 'on' : ''}" data-g="rango" data-x="${k}">${{ hoy: 'Hoy', ayer: 'Ayer', semana: '7 días', mes: 'Este mes' }[k]}</button>`).join('')}</div>`;
  h += `<div class="gx-kpis gx-kpis-5">${kpi('pagos', '#22c55e', money(C.total), 'Total', '')}${Object.keys(METODOS).map((k, i) => kpi(k === 'tarjeta' ? 'tarjeta' : k === 'efectivo' ? 'pagos' : 'recibo', ['#f59e0b', '#3b82f6', '#8b5cf6', '#64748b'][i], money(C.por_metodo[k] || 0), METODOS[k], '')).join('')}</div>`;
  h += `<p class="gx-tenue gx-peq">Membresías y abonos ${money(C.membresias)} · Ventas ${money(C.ventas)}. Para tu corte: compara el efectivo con lo que hay en caja.</p>`;
  h += C.pagos.length ? `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Hora</th><th>Concepto</th><th>Método</th><th>Monto</th></tr></thead><tbody>${C.pagos.map((p) => `<tr data-g="${p.tipo === 'venta' ? 'venta' : 'socio'}" data-x="${p.tipo === 'venta' ? p.id : p.socio_id}" class="${p.anulado ? 'gx-anulado' : ''}"><td>${fechaHora(p.fecha)}</td><td>${esc(p.plan)}${p.socio ? ' · ' + esc(p.socio) : ''}</td><td>${METODOS[p.metodo]}</td><td><b>${money(p.monto)}</b></td></tr>`).join('')}</tbody></table></div></section>` : vacio('Sin movimientos en este periodo');
  return h;
}
VISTAS['g-caja'] = async (v) => VISTAS['g-pagos'](Object.assign(v, { tab: 'caja' }));

/* ---------------- NOTIFICACIONES ---------------- */
VISTAS['g-notif'] = async () => {
  const N = await llamar('gym_notificaciones', { p_gym: G });
  const g = INFO.nombre;
  const SEC = [['vencen_hoy', 'Vencen hoy', 'alerta', '#ef4444', (s) => `Hola ${nombre1(s.nombre)}, tu membresía de ${g} vence hoy. Renuévala en recepción y sigue entrenando 💪`],
    ['vencen_semana', 'Vencen esta semana', 'campana', '#f59e0b', (s) => `Hola ${nombre1(s.nombre)}, te recordamos que tu membresía de ${g} vence el ${fCorta(s.vence_en)}. ¡Te esperamos!`],
    ['vencidos', 'Vencidos (últimos 30 días)', 'x', '#ef4444', (s) => `Hola ${nombre1(s.nombre)}, te extrañamos en ${g}. Tu membresía venció el ${fCorta(s.vence_en)}; cuando quieras te ayudamos a renovarla.`],
    ['cumpleanos', 'Cumpleaños', 'pastel', '#ec4899', (s) => `¡Feliz cumpleaños, ${nombre1(s.nombre)}! 🎉 Todo el equipo de ${g} te desea un gran día.`],
    ['inactivos', 'Dejaron de venir (10+ días)', 'dorm', '#8b5cf6', (s) => `Hola ${nombre1(s.nombre)}, ¿todo bien? Hace unos días no te vemos en ${g}. ¡Tu lugar te espera!`],
    ['saldos', 'Saldo pendiente', 'pagos', '#f59e0b', (s) => `Hola ${nombre1(s.nombre)}, tienes un saldo pendiente de ${money(s.saldo)} en ${g}. ¡Gracias!`],
    ['congelados', 'Membresías congeladas', 'hielo', '#06b6d4', (s) => `Hola ${nombre1(s.nombre)}, tu membresía en ${g} se reactiva el ${fCorta(sumaDias(String(s.congelado_hasta).slice(0, 10), 1))}. ¡Te esperamos!`]];
  const total = SEC.reduce((a, [k]) => a + N[k].length, 0) + N.stock.length;
  if (CUENTAS) CUENTAS.notif = total;
  let h = titulo('Notificaciones', total ? `${total} avisos pendientes` : 'Todo en orden');
  h += `<div class="gx-notif-res">${SEC.map(([k, t, i, c]) => `<button class="gx-notif-chip" data-g="ancla" data-x="n-${k}" style="--k:${c}">${ico(i, 16)}<b>${N[k].length}</b><span>${t}</span></button>`).join('')}${N.stock.length ? `<button class="gx-notif-chip" data-g="ancla" data-x="n-stock" style="--k:#ef4444">${ico('caja', 16)}<b>${N.stock.length}</b><span>Productos por agotarse</span></button>` : ''}</div>`;
  SEC.forEach(([k, t, i, c, msg]) => {
    const L = N[k]; if (!L.length) return;
    h += `<section class="gx-card" id="n-${k}"><div class="gx-card-cab"><b><span class="gx-ico-c" style="--k:${c}">${ico(i, 16)}</span>${t} · ${L.length}</b></div><div class="gx-filas">${L.map((s) => `<div class="gx-fila"><button class="gx-fila-p" data-g="socio" data-x="${s.id}">${avatar(s)}<div><b>${esc(s.nombre)}</b><small>#${s.numero} · ${k === 'cumpleanos' ? fDia(s.fecha_nac) : k === 'saldos' ? 'debe ' + money(s.saldo) : k === 'inactivos' ? 'última visita ' + hace(s.ultima) : esc(venceTxt(s))}</small></div>${pill(s.estado)}</button>${s.telefono ? `<a class="gx-wa" href="${waLink(s.telefono, msg(s))}" target="_blank" rel="noopener" aria-label="WhatsApp">${ico('whats', 18)}</a>` : '<span class="gx-tenue gx-peq">sin tel.</span>'}</div>`).join('')}</div></section>`;
  });
  if (N.stock.length) h += `<section class="gx-card" id="n-stock"><div class="gx-card-cab"><b><span class="gx-ico-c" style="--k:#ef4444">${ico('caja', 16)}</span>Productos por agotarse · ${N.stock.length}</b><button class="gx-link" data-g="tab" data-x="g-inventario">Ir a inventario ›</button></div>${N.stock.map((p) => `<div class="gx-kv"><span>${esc(p.nombre)}</span><b class="gx-txt-mal">${p.existencia} pzas</b></div>`).join('')}</section>`;
  if (!total) h += vacio('Sin avisos pendientes', 'Aquí aparecerán vencimientos, cumpleaños, saldos y más.');
  h += '<p class="gx-tenue gx-peq">El botón verde abre WhatsApp con el mensaje listo. Tú decides si lo envías.</p>';
  return h;
};

/* ---------------- USUARIOS Y SEGURIDAD ---------------- */
const PERMISOS = [['Registrar entradas', 1, 1, 1, 1], ['Ver socios y su ficha', 1, 1, 1, 1], ['Dar de alta y editar socios', 1, 1, 1, 0], ['Cobrar membresías y abonos', 1, 1, 1, 0], ['Vender en punto de venta', 1, 1, 1, 0],
  ['Ver caja de hoy y ayer', 1, 1, 1, 0], ['Ver caja e ingresos de cualquier periodo', 1, 1, 0, 0], ['Anular pagos y cancelar ventas', 1, 1, 0, 0], ['Dar de baja y congelar', 1, 1, 0, 0],
  ['Inventario y productos', 1, 1, 0, 0], ['Reportes, Excel y respaldo', 1, 1, 0, 0], ['Membresías y precios', 1, 1, 0, 0], ['Configuración y marca', 1, 1, 0, 0], ['Agregar y quitar personal', 1, 1, 0, 0], ['Sedes y plan de Aeterion', 1, 0, 0, 0]];
VISTAS['g-equipo'] = async () => {
  const L = await llamar('gym_staff_listar', { p_gym: G });
  const lim = (INFO.plan_info.staff || 3) * INFO.sedes_max, act = L.filter((x) => x.activo).length;
  let h = titulo('Usuarios y seguridad', `${act} de ${lim} personas en tu plan · cada quien entra con su propia cuenta`, `<button class="gx-btn" data-g="staff-abrir">${ico('mas1', 18)}Agregar persona</button>`);
  h += `<section class="gx-card gx-sin-pad"><div class="gx-tabla-w"><table class="gx-tabla"><thead><tr><th>Persona</th><th>Puesto</th><th class="gx-col-md">Estado</th><th></th></tr></thead><tbody>${L.map((x) => `<tr class="${x.activo ? '' : 'gx-anulado'}"><td><div class="gx-cel-socio"><span class="gx-av" style="--h:${(x.id * 61) % 360}">${esc(iniciales(x.nombre))}</span><div><b>${esc(x.nombre)}${x.yo ? ' (tú)' : ''}</b><small>${esc(x.email)}</small></div></div></td><td><em class="gx-pill ${x.rol === 'dueno' ? 'ac' : x.rol === 'admin' ? 'info' : 'gris'}">${ROLES[x.rol]}</em></td><td class="gx-col-md">${x.activo ? '<em class="gx-pill ok">Con acceso</em>' : '<em class="gx-pill gris">Sin acceso</em>'}</td>
    <td class="gx-acc-cel">${x.activo && !x.yo && x.rol !== 'dueno' && (puede.dueno() || x.rol !== 'admin') ? `<button class="gx-link mal" data-g="quitar-staff" data-x="${x.id}">Quitar acceso</button>` : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
  h += `<section class="gx-card gx-sin-pad"><div class="gx-card-cab gx-pad"><b>Qué puede hacer cada puesto</b></div><div class="gx-tabla-w"><table class="gx-tabla gx-permisos"><thead><tr><th>Permiso</th><th>Dueño</th><th>Admin.</th><th>Recepción</th><th>Entrenador</th></tr></thead><tbody>${PERMISOS.map(([t, ...r]) => `<tr><td>${t}</td>${r.map((x) => `<td>${x ? '<span class="gx-si">✓</span>' : '<span class="gx-no">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
    <p class="gx-tenue gx-peq">Cada acción queda registrada con quién la hizo (pagos, anulaciones, ventas). Si alguien deja de trabajar contigo, quítale el acceso: su cuenta deja de ver tu gimnasio al instante.</p>`;
  return h;
};

/* ---------------- CONFIGURACIÓN ---------------- */
VISTAS['g-config'] = async (v) => {
  const A = INFO.ajustes || {}; const P = INFO.plan_info || {}; const sec = v.sec || 'marca';
  let h = titulo('Configuración');
  h += `<div class="gx-tabs">${[['marca', 'Marca'], ['acceso', 'Acceso'], ['ticket', 'Ticket y datos'], ['sedes', 'Sedes'], ['plan', 'Mi plan Aeterion'], ['respaldo', 'Respaldo']].filter((t) => (t[0] !== 'sedes' && t[0] !== 'plan') || puede.dueno()).map(([k, n]) => `<button class="${sec === k ? 'on' : ''}" data-g="config-sec" data-x="${k}">${n}</button>`).join('')}</div>`;
  if (sec === 'marca') {
    const col = A.color || '#c9a84c';
    h += `<section class="gx-card gx-form"><b>Logo</b><div class="gx-logo-conf"><div class="gx-logo gx-logo-g">${A.logo ? `<img src="${esc(A.logo)}" alt="">` : `<span>${esc(iniciales(INFO.nombre))}</span>`}</div>
        <div><label class="gx-btn gx-sec gx-btn-sm">Subir logo<input type="file" accept="image/*" id="gyLogo" hidden></label>${A.logo ? ' <button class="gx-link mal" data-g="logo-quitar">Quitar</button>' : ''}<p class="gx-tenue gx-peq">Aparece en el sistema, los tickets, las credenciales y la app de tus socios.</p></div></div>
      <b>Color de tu marca</b><div class="gx-colores" id="gyColores">${COLORES.map((c) => `<button class="${c === col ? 'on' : ''}" style="background:${c}" data-g="color" data-x="${c}" aria-label="Color ${c}"></button>`).join('')}<label class="gx-color-otro" title="Otro color"><input type="color" id="gyColorOtro" value="${esc(col)}">Otro</label></div>
      <b>Tema</b><div class="gx-seg" id="gyTema"><button class="${(A.tema || 'oscuro') === 'oscuro' ? 'on' : ''}" data-g="seg" data-x="oscuro">${ico('luna', 16)} Oscuro</button><button class="${A.tema === 'claro' ? 'on' : ''}" data-g="seg" data-x="claro">${ico('sol', 16)} Claro</button></div>
      <div class="gx-form-acc"><button class="gx-btn gx-btn-lg" data-g="guardar-marca">Guardar marca</button></div></section>`;
  } else if (sec === 'acceso') {
    h += `<section class="gx-card gx-form"><b>Si llega un socio vencido o sin pago</b><div class="gx-seg" id="gaPol"><button data-g="seg" data-x="avisar" class="${A.politica_vencidos !== 'bloquear' ? 'on' : ''}">Avisar y dejar pasar</button><button data-g="seg" data-x="bloquear" class="${A.politica_vencidos === 'bloquear' ? 'on' : ''}">Negar el acceso</button></div>
      <p class="gx-tenue gx-peq">Con «Negar el acceso» la entrada no se registra, recepción ve la alerta en rojo y el intento queda en la bitácora. Los socios dados de baja o con membresía congelada nunca pasan.</p>
      <label>Avisar «por vencer» con cuántos días de anticipación<input class="gx-in" id="gaAviso" type="number" min="1" max="30" value="${INFO.aviso_dias || 7}"></label>
      <div class="gx-form-acc"><button class="gx-btn gx-btn-lg" data-g="guardar-acceso">Guardar</button></div></section>`;
  } else if (sec === 'ticket') {
    h += `<section class="gx-card gx-form gx-form-2"><b class="gx-ancho2">Ticket y datos del gimnasio</b>
      <div class="gx-ancho2"><span class="gx-lab">Ancho del papel</span><div class="gx-seg" id="gaAncho"><button data-g="seg" data-x="58" class="${Number(A.ticket_ancho) === 58 ? 'on' : ''}">58 mm</button><button data-g="seg" data-x="80" class="${Number(A.ticket_ancho) !== 58 ? 'on' : ''}">80 mm</button></div></div>
      <label>Teléfono<input class="gx-in" id="gaTel" maxlength="20" value="${esc(A.telefono || '')}"></label>
      <label>RFC <span class="gx-tenue">(opcional)</span><input class="gx-in" id="gaRfc" maxlength="13" value="${esc(A.rfc || '')}" style="text-transform:uppercase"></label>
      <label class="gx-ancho2">Dirección<input class="gx-in" id="gaDir" maxlength="160" value="${esc(A.direccion || '')}"></label>
      <label class="gx-ancho2">Encabezado del ticket<input class="gx-in" id="gaEnc" maxlength="200" placeholder="Ej. Horario L-V 6 a 22 h" value="${esc(A.ticket_encabezado || '')}"></label>
      <label class="gx-ancho2">Mensaje al pie<input class="gx-in" id="gaPie" maxlength="200" placeholder="¡Gracias por entrenar con nosotros!" value="${esc(A.ticket_pie || '')}"></label>
      <div class="gx-ancho2 gx-fila-btns"><button class="gx-btn" data-g="guardar-ticket">Guardar</button><button class="gx-btn gx-sec" data-g="ticket-prueba">Imprimir ticket de prueba</button></div></section>
      <p class="gx-tenue gx-peq">Funciona con impresoras térmicas USB o Bluetooth instaladas en la computadora o el teléfono. Los tickets no son facturas.</p>`;
  } else if (sec === 'sedes') {
    h += `<section class="gx-card">${INFO.sedes.map((s) => `<div class="gx-kv"><span><b>${esc(s.nombre)}</b><br><small class="gx-tenue">${esc(s.direccion || 'Sin dirección')}</small></span></div>`).join('')}</section>` +
      (INFO.sedes.length < INFO.sedes_max ? `<section class="gx-card gx-form"><b>Agregar sede</b><label>Nombre<input class="gx-in" id="gdNom" maxlength="60"></label><label>Dirección<input class="gx-in" id="gdDir" maxlength="160"></label><div class="gx-form-acc"><button class="gx-btn" data-g="guardar-sede">Agregar</button></div></section>` : '<p class="gx-tenue gx-peq">Para agregar otra sede, habla con Aeterion: el plan se cobra por sede.</p>');
  } else if (sec === 'plan') {
    const lim = (P.socios || 0) * INFO.sedes_max, us = INFO.socios_activos;
    h += `<div class="gx-kpis gx-kpis-3">${kpi('tarjeta', 'var(--gx-ac)', money((P.precio || 0) * INFO.sedes_max), 'Plan ' + esc(P.nombre || INFO.plan) + ' al mes', `<span class="gx-kpi-sub">${money(P.precio)} × ${INFO.sedes_max} ${INFO.sedes_max === 1 ? 'sede' : 'sedes'}</span>`)}
      ${kpi('socios', '#3b82f6', `${us}/${lim}`, 'Socios activos', `<div class="gx-prog"><i style="width:${Math.min(100, Math.round(us / Math.max(1, lim) * 100))}%"></i></div>`)}
      ${kpi('escudo', '#22c55e', `${INFO.staff_activo}/${(P.staff || 0) * INFO.sedes_max}`, 'Personal', '')}</div>
      <section class="gx-card"><div class="gx-kv"><span>Estado</span><b>${{ prueba: 'Periodo de prueba', activo: 'Activo', suspendido: 'Suspendido' }[INFO.estado] || INFO.estado}</b></div><div class="gx-kv"><span>Pagado hasta</span><b>${INFO.pagado_hasta ? fCorta(INFO.pagado_hasta) : '—'}</b></div></section>
      <p class="gx-tenue gx-peq">Para cambiar de plan, agregar sedes o pagar tu mensualidad, escríbenos desde Ayuda en la app.</p>`;
  } else {
    h += `<section class="gx-card"><b>Respaldo completo</b><p>Descarga en Excel tus socios, pagos, ventas, inventario y asistencias. Tus datos ya están guardados en la nube con copias automáticas; esto te deja una copia en tu computadora.</p><div class="gx-form-acc"><button class="gx-btn" data-g="respaldo">${ico('caja', 18)}Descargar respaldo (Excel)</button></div></section>`;
  }
  return h;
};

VISTAS['g-mas'] = async () => {
  let h = titulo(esc(INFO.nombre), `${ROLES[rol()]} · plan ${esc((INFO.plan_info || {}).nombre || INFO.plan)}`);
  h += SECCIONES.map(([t, items]) => { const v = items.filter(visible); return v.length ? `<div class="gx-sec-t">${t}</div><div class="gx-menu">${v.map(([k, n, i]) => `<button data-g="tab" data-x="${k}">${ico(i)}<span>${n}</span><i>›</i></button>`).join('')}</div>` : ''; }).join('');
  if (EST.gyms.length > 1) h += `<div class="gx-menu"><button data-g="ir" data-x="g-elegir">${ico('socios')}<span>Cambiar de gimnasio</span><i>›</i></button></div>`;
  if (!PAGINA) h += `<p class="gx-tenue gx-peq">En la computadora de recepción abre <b>${esc(appUrl().replace(/^https?:\/\//, ''))}gym/</b> e inicia sesión con tu correo.</p>`;
  return h;
};
VISTAS['g-elegir'] = async () => titulo('Cambiar de gimnasio') + `<div class="gx-menu">${EST.gyms.map((g) => `<button data-g="elegir" data-x="${g.id}">${ico('socios')}<span>${esc(g.nombre)} · ${ROLES[g.rol]}</span><i>${g.id === G ? '✓' : '›'}</i></button>`).join('')}</div>`;

/* ---------------- MATERIAL ÚTIL ---------------- */
const DOCS = {
  arranque: ['Arranque en un día', 'Lo mínimo para empezar', `<ol><li><b>Membresías:</b> captura lo que vendes con su precio y su color.</li><li><b>Configuración:</b> sube tu logo, elige tu color y decide si a los vencidos se les niega la entrada.</li><li><b>Usuarios:</b> agrega a tu recepción con el correo de su cuenta Aeterion.</li><li><b>Socios:</b> regístralos con foto, teléfono y cumpleaños. Cobra su membresía (completa o en partes).</li><li><b>Accesos:</b> en la computadora de recepción abre la página de Aeterion Gym. Escanea el QR o escribe el número.</li><li><b>Cada mañana:</b> revisa Notificaciones y manda los recordatorios por WhatsApp.</li><li><b>Cierre:</b> en Pagos › Corte de caja compara el efectivo.</li></ol>`],
  recepcion: ['Guion para recepción', 'Atender la entrada en 10 segundos', `<ol><li>Saluda por su nombre: Aeterion te muestra su foto al escanear.</li><li><b>Verde:</b> todo bien. <b>Ámbar:</b> recuérdale que vence pronto. <b>Rojo:</b> invítalo a renovar con el botón «Renovar ahora».</li><li>Si no trae la app, búscalo por número o nombre.</li><li>A quien no usa la app, mándale su enlace por WhatsApp desde su ficha.</li></ol>`],
  retencion: ['Cómo reducir bajas', 'Prácticas simples', `<ul><li><b>Primeras semanas:</b> las más frágiles. Revisa en su ficha que venga 2 veces por semana o más.</li><li><b>Notificaciones › Dejaron de venir:</b> escríbeles antes de que venza su membresía.</li><li><b>Antes de vencer:</b> recordatorio un día antes.</li><li><b>Cumpleaños:</b> un mensaje cuesta nada y se recuerda.</li><li><b>Planes largos:</b> ofrece trimestral o anual con mejor precio a quien viene seguido.</li></ul><p class="nota">Recomendaciones generales de operación, no garantías.</p>`],
  privacidad: ['Datos de tus socios', 'Cómo cuidarlos', `<ul><li>Pide solo lo necesario y ten tu aviso de privacidad a la vista.</li><li>Quita el acceso a quien deje de trabajar contigo en Usuarios y seguridad.</li><li>Tu equipo no ve el progreso ni los datos de salud de tus socios en su app.</li></ul><p class="nota">No es asesoría legal.</p>`],
};
VISTAS['g-material'] = async () => titulo('Material útil') + `<div class="gx-menu"><button data-g="cartel">${ico('acceso')}<span>Cartel de entrada para imprimir</span><i>›</i></button>${Object.keys(DOCS).map((k) => `<button data-g="doc" data-x="${k}">${ico('libro')}<span>${DOCS[k][0]} <small class="gx-tenue">· ${DOCS[k][1]}</small></span><i>›</i></button>`).join('')}${puede.administrar() ? `<button data-g="ir" data-x="g-aeterion">${ico('carrito')}<span>Vender productos Aeterion <small class="gx-tenue">· precios de mayoreo</small></span><i>›</i></button>` : ''}</div>`;
VISTAS['g-doc'] = async (v) => { const d = DOCS[v.id]; return d ? titulo(d[0], d[1]) + `<section class="gx-card gx-doc">${d[2]}</section>` : ''; };

async function imprimir(html, tit) {
  const w = window.open('', '_blank'); if (!w) { toast('Permite las ventanas emergentes para imprimir.'); return; }
  const col = (INFO.ajustes || {}).color || '#c9a84c';
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(tit)}</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#111;text-align:center}h1{font-size:34px;margin:.3em 0}p{font-size:18px}.qr svg{width:260px;height:260px}.marca{letter-spacing:.2em;font-weight:800;color:${col}}.logo img{max-height:90px;max-width:220px}.cred{display:inline-block;border:3px solid ${col};border-radius:18px;padding:18px 24px;width:300px}.cred .qr svg{width:200px;height:200px}.num{font-size:28px;font-weight:800}.cred img.f{width:90px;height:90px;border-radius:50%;object-fit:cover}@media print{button{display:none}}</style></head><body>${html}<p><button onclick="print()">Imprimir</button></p></body></html>`);
  w.document.close();
}

/* ---------------- Tickets ---------------- */
function ticketHtml(cuerpo) {
  const A = (INFO && INFO.ajustes) || {}; const ancho = Number(A.ticket_ancho) === 58 ? 58 : 80;
  const cab = `<div class="c">${A.logo ? `<img src="${A.logo}" style="max-width:60%;max-height:22mm;filter:grayscale(1)" alt=""><br>` : ''}<b class="g">${esc(INFO.nombre)}</b>${A.ticket_encabezado ? `<div>${esc(A.ticket_encabezado)}</div>` : ''}${A.direccion ? `<div>${esc(A.direccion)}</div>` : ''}${A.telefono ? `<div>Tel. ${esc(A.telefono)}</div>` : ''}${A.rfc ? `<div>RFC ${esc(A.rfc)}</div>` : ''}</div><hr>`;
  const pie = `<hr><div class="c">${A.ticket_pie ? esc(A.ticket_pie) : '¡Gracias por tu preferencia!'}</div><div class="c p">Aeterion Gym</div>`;
  return { ancho, html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket</title><style>
    @page{size:${ancho}mm auto;margin:0}*{box-sizing:border-box}body{margin:0;padding:3mm;width:${ancho}mm;font:${ancho === 58 ? 10.5 : 12}px/1.35 'Courier New',monospace;color:#000}
    .c{text-align:center}.g{font-size:1.25em}.p{font-size:.85em;margin-top:2mm}hr{border:0;border-top:1px dashed #000;margin:2mm 0}table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:.3mm 0}td.r{text-align:right;white-space:nowrap}.t td{font-weight:700;font-size:1.15em}
    @media screen{body{margin:10px auto;box-shadow:0 0 0 1px #ccc}button{display:block;margin:10px auto;padding:8px 16px}}@media print{button{display:none}}</style></head><body>${cab}${cuerpo}${pie}<button onclick="print()">Imprimir</button><script>setTimeout(function(){print()},300)<\/script></body></html>` };
}
function abrirTicket(cuerpo) {
  const t = ticketHtml(cuerpo); const w = window.open('', '_blank', 'width=' + (t.ancho === 58 ? 300 : 380) + ',height=640');
  if (!w) { toast('Permite las ventanas emergentes para imprimir el ticket.'); return; }
  w.document.write(t.html); w.document.close();
}
function ticketVenta(v) {
  abrirTicket(`<div>Venta #${v.folio}${v.cancelada ? ' · CANCELADA' : ''}</div><div>${esc(fechaHora(v.fecha))}</div>${v.socio ? `<div>Socio #${v.socio.numero} ${esc(v.socio.nombre)}</div>` : ''}${v.vendedor ? `<div>Atendió: ${esc(v.vendedor)}</div>` : ''}<hr>
    <table>${v.items.map((i) => `<tr><td>${i.cantidad} ${esc(i.nombre)}</td><td class="r">${money(i.importe)}</td></tr>`).join('')}</table><hr>
    <table><tr><td>Subtotal</td><td class="r">${money(v.subtotal)}</td></tr>${Number(v.descuento) ? `<tr><td>Descuento</td><td class="r">-${money(v.descuento)}</td></tr>` : ''}<tr class="t"><td>TOTAL</td><td class="r">${money(v.total)}</td></tr>
    <tr><td>${METODOS[v.metodo]}</td><td class="r">${v.pago_con != null ? money(v.pago_con) : ''}</td></tr>${v.cambio != null ? `<tr><td>Cambio</td><td class="r">${money(v.cambio)}</td></tr>` : ''}</table>`);
}
function ticketPago(s, p) {
  const pend = p.pago_de ? null : Number(p.total) - Number(p.abonado || 0);
  abrirTicket(`<div>Comprobante de pago</div><div>${esc(fechaHora(p.fecha))}</div><div>Socio #${s.numero} ${esc(s.nombre)}</div><hr>
    <table><tr><td>${p.pago_de ? 'Abono' : esc(p.plan || p.concepto || 'Membresía')}</td><td class="r">${money(p.pago_de ? p.monto : p.total)}</td></tr>
    ${p.desde ? `<tr><td colspan="2">Vigencia: ${fCorta(p.desde)} a ${fCorta(p.hasta)}</td></tr>` : ''}</table><hr>
    <table><tr class="t"><td>PAGADO</td><td class="r">${money(p.monto)}</td></tr><tr><td>${METODOS[p.metodo]}</td><td></td></tr>${pend > 0 ? `<tr><td>Saldo pendiente</td><td class="r">${money(pend)}</td></tr>` : ''}</table>`);
}

/* ---------------- Ventanas (modales) ---------------- */
function modalRaiz() { let m = $('gyModalRoot'); if (!m) { m = document.createElement('div'); m.id = 'gyModalRoot'; document.body.appendChild(m); } aplicarTema(); return m; }
function abrirModal(tit, cuerpo, pie) {
  const m = modalRaiz();
  m.innerHTML = `<div class="gx-modal-fondo" data-g="modal-cerrar"></div><div class="gx-modal" role="dialog" aria-modal="true" aria-label="${esc(tit)}"><div class="gx-modal-cab"><b>${tit}</b><button class="gx-ico-btn" data-g="modal-cerrar" aria-label="Cerrar">${ico('x')}</button></div><div class="gx-modal-cuerpo">${cuerpo}</div>${pie ? `<div class="gx-modal-pie">${pie}</div>` : ''}</div>`;
  m.classList.add('on'); setTimeout(() => { const f = m.querySelector('.gx-modal-cuerpo input:not([type=hidden]):not([type=file]):not([type=color]),.gx-modal-cuerpo select,.gx-modal-cuerpo textarea'); if (f && matchMedia('(pointer:fine)').matches) f.focus(); }, 30);
}
function cerrarModal() { const m = $('gyModalRoot'); if (m) { m.classList.remove('on'); m.innerHTML = ''; } }
const segHtml = (id, ops, sel) => `<div class="gx-seg" id="${id}">${ops.map(([k, n]) => `<button class="${k === sel ? 'on' : ''}" data-g="seg" data-x="${k}">${n}</button>`).join('')}</div>`;
const segVal = (id) => { const el = $(id); const on = el && el.querySelector('.on'); return on ? on.dataset.x : undefined; };
async function modalCobro(socioId) {
  const s = vista.s && vista.s.id === socioId ? vista.s : await llamar('gym_socio_detalle', { p_gym: G, p_socio: socioId });
  vista.cobroSocio = s; const planes = INFO.planes;
  if (!planes.length) { toast('Primero crea tus membresías.'); return raizV('g-membresias'); }
  const sel = planes.find((p) => p.id === s.plan_id) || planes.find((p) => Number(p.dias) === 30) || planes[0];
  const desde = s.vence_en && s.dias >= 0 ? sumaDias(String(s.vence_en).slice(0, 10), 1) : hoyMx();
  vista.cobroDesde = desde;
  abrirModal(`Cobrar a ${esc(s.nombre)}`, `<div class="gx-planes-sel" id="gcPlanes">${planes.map((p) => `<button class="${p.id === sel.id ? 'on' : ''}" data-g="cobro-plan" data-x="${p.id}" style="--k:${esc(p.color || 'var(--gx-ac)')}"><b>${esc(p.nombre)}</b><span>${money(p.precio)}</span><small>${p.dias} ${p.dias === 1 ? 'día' : 'días'}</small></button>`).join('')}</div>
    <div class="gx-form gx-form-2"><label>Precio<input class="gx-in" id="gcTotal" type="number" min="0" step="0.01" inputmode="decimal" value="${sel.precio}"></label><label>Paga ahora<input class="gx-in" id="gcMonto" type="number" min="0" step="0.01" inputmode="decimal" value="${sel.precio}"></label></div>
    <span class="gx-lab">Método</span>${segHtml('gcMet', Object.entries(METODOS), 'efectivo')}
    <div class="gx-cobro-res" id="gcRes"></div><p class="gx-tenue gx-peq">${s.vence_en && s.dias >= 0 ? 'Se suma desde el ' + fCorta(desde) + ', después de su vencimiento actual.' : 'Empieza hoy.'} El cobro lo haces tú; aquí se registra.</p>`,
    `<button class="gx-btn gx-sec" data-g="modal-cerrar">Cancelar</button><button class="gx-btn" data-g="cobrar">Registrar pago</button>`);
  cobroCalc();
}
function cobroCalc() {
  const t = Number(($('gcTotal') || {}).value), m = Number(($('gcMonto') || {}).value), el = $('gcRes'); if (!el) return;
  const id = segVal('gcPlanes'); const p = INFO.planes.find((x) => String(x.id) === String(id));
  const hasta = p ? sumaDias(vista.cobroDesde, Number(p.dias) - 1) : null;
  el.innerHTML = `<div><span>Vigente hasta</span><b>${hasta ? fCorta(hasta) : '—'}</b></div><div><span>Cobra hoy</span><b>${money(m)}</b></div>${m < t ? `<div class="warn"><span>Quedará debiendo</span><b>${money(t - m)}</b></div>` : ''}`;
}
function modalAbono(pagoId, pend) {
  vista.abono = { pago: pagoId, pend };
  abrirModal('Registrar abono', `<p>Pendiente: <b>${money(pend)}</b></p><div class="gx-form"><label>Monto del abono<input class="gx-in gx-in-xl" id="gaMonto" type="number" min="1" step="0.01" inputmode="decimal" value="${pend}"></label></div><span class="gx-lab">Método</span>${segHtml('gaMet', Object.entries(METODOS), 'efectivo')}`,
    `<button class="gx-btn gx-sec" data-g="modal-cerrar">Cancelar</button><button class="gx-btn" data-g="abonar">Registrar abono</button>`);
}

/* ---------------- Socio (en su app) ---------------- */
VISTAS['s-mio'] = async () => {
  await refrescar(); const L = EST.socio || [];
  if (!L.length) return `<div class="gx-socio-app"><div class="gx-titulo"><div><h1>Mi gimnasio</h1></div></div><section class="gx-card"><b>¿Tu gimnasio usa Aeterion?</b><p>Escribe el código que te dio recepción para ver tu membresía y entrar con tu QR.</p><div class="gx-fila-in"><input class="gx-in" id="gyCodSocio" maxlength="8" placeholder="Ej. 7KQ2MX" style="text-transform:uppercase"><button class="gx-btn" data-g="vincular">Vincular</button></div></section></div>`;
  let h = '<div class="gx-socio-app"><div class="gx-titulo"><div><h1>Mi gimnasio</h1></div></div>';
  for (const s of L) {
    const svg = await qrSvg('AET-GYM:' + s.token, 7).catch(() => '');
    const col = s.gym_color || '#c9a84c'; const [r, g, b] = hexRgb(col);
    const hoy = new Date(); const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(); const meta = Math.max(8, Math.round(diasMes * 0.55));
    const f = Math.min(1, s.asistencias_mes / meta), R = 34, C = 2 * Math.PI * R;
    h += `<div class="gx-mem-app" style="--k:${esc(col)};--k-rgb:${r},${g},${b}"><div class="gx-mem-top">${s.gym_logo ? `<img src="${esc(s.gym_logo)}" alt="">` : ''}<span>${esc(s.gym)}</span>${s.foto ? `<img class="gx-mem-foto" src="${esc(s.foto)}" alt="">` : ''}</div>
        <small>Mi membresía</small><b>${esc(s.plan || 'Sin plan')}</b>${pill(s.estado)}<p>${esc(venceTxt(s))}${s.vence_en ? ' · ' + fCorta(s.vence_en) : ''}</p><span class="gx-mem-num">Socio #${s.numero}</span></div>
      <div class="gx-grid-2 gx-grid-2-movil"><section class="gx-card gx-anillo"><small>Asistencias este mes</small><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="${R}" fill="none" stroke="var(--gx-borde2)" stroke-width="8"/>
          ${f > 0 ? `<circle cx="45" cy="45" r="${R}" fill="none" stroke="${esc(col)}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 45 45)"/>` : ''}
          <text x="45" y="48" text-anchor="middle" class="gx-dona-n">${s.asistencias_mes}</text><text x="45" y="62" text-anchor="middle" class="gx-eje">de ${meta}</text></svg></section>
        <section class="gx-card gx-prox"><small>Próximo pago</small><b>${s.vence_en ? fCorta(sumaDias(String(s.vence_en).slice(0, 10), 1)) : 'Pendiente'}</b>${s.precio_plan != null ? `<strong style="color:${esc(col)}">${money(s.precio_plan)}</strong>` : ''}${Number(s.saldo) > 0 ? `<em class="gx-txt-warn">Saldo pendiente ${money(s.saldo)}</em>` : ''}</section></div>
      <section class="gx-card gx-centro"><b>Tu QR de entrada</b><div class="gx-qr">${svg}</div><p class="gx-tenue">Muéstralo en recepción al entrar</p></section>
      ${s.pagos && s.pagos.length ? `<section class="gx-card"><b>Mis pagos</b>${s.pagos.map((p) => `<div class="gx-kv"><span>${esc(p.concepto || 'Pago')}<br><small class="gx-tenue">${fCorta(p.fecha)}${p.hasta ? ' · vigente hasta ' + fCorta(p.hasta) : ''}</small></span><b>${money(p.monto)}</b></div>`).join('')}</section>` : ''}
      ${s.gym_telefono ? `<a class="gx-btn gx-sec gx-ancho" href="${waLink(s.gym_telefono, 'Hola, soy ' + s.nombre + ' (socio #' + s.numero + ').')}" target="_blank" rel="noopener">${ico('whats', 18)}Escribir a mi gimnasio</a>` : ''}
      <p class="gx-tenue gx-peq">Tu gimnasio solo ve tu membresía y tus entradas. Tu progreso y tus datos de salud en Aeterion son privados.</p>
      <button class="gx-link mal" data-g="desvincular" data-x="${s.id}">Desvincular de este gimnasio</button>`;
  }
  h += '<section class="gx-card"><b>¿Otro gimnasio?</b><div class="gx-fila-in"><input class="gx-in" id="gyCodSocio" maxlength="8" placeholder="Código" style="text-transform:uppercase"><button class="gx-btn gx-sec" data-g="vincular">Vincular</button></div></section></div>';
  return h;
};

/* ---------------- Búsqueda global ---------------- */
let _tBusca = null;
async function buscarGlobal(q) {
  const el = $('gxResBusca'); if (!el) return;
  if (!q || q.length < 2) { el.classList.remove('on'); el.innerHTML = ''; return; }
  try { const L = (await llamar('gym_socios_listar', { p_gym: G, p_filtro: 'activos', p_busca: q })).slice(0, 8);
    el.innerHTML = L.length ? L.map((s) => `<button data-g="socio" data-x="${s.id}">${avatar(s)}<div><b>${esc(s.nombre)}</b><small>#${s.numero} · ${esc(venceTxt(s))}</small></div>${pill(s.estado)}</button>`).join('') : '<p class="gx-tenue">Sin resultados</p>';
    el.classList.add('on'); } catch (e) {}
}

/* ---------------- Acciones ---------------- */
async function alClic(ev) {
  const el = ev.target.closest('[data-g]'); if (!el || el.disabled) return;
  const enRaiz = raiz() && raiz().contains(el), enModal = $('gyModalRoot') && $('gyModalRoot').contains(el);
  if (!enRaiz && !enModal) return;
  const a = el.dataset.g, x = el.dataset.x;
  if (cargando && !['seg', 'filtro', 'rango', 'cobro-plan', 'color', 'modal-cerrar'].includes(a)) return;
  const ocupado = async (fn) => { cargando = true; el.classList.add('gx-ocupado'); try { await fn(); } catch (e) { toast(e.message); } finally { cargando = false; el.classList.remove('gx-ocupado'); } };
  const recargarInfo = async () => { INFO = await llamar('gym_info', { p_gym: G }); CUENTAS = null; aplicarTema(); };
  switch (a) {
    case 'tab': return raizV(x);
    case 'ir': return ir(x);
    case 'volver': return volver();
    case 'reintentar': EST = null; INFO = null; G = null; return pintar();
    case 'salir': pararCamara(); cerrarModal(); document.body.classList.remove('modo-gym'); pila = []; vista = { v: 'g-hoy' }; if (typeof aetIr === 'function') aetIr('inicio'); return;
    case 'salir-pagina': pararCamara(); cerrarModal(); if (ENV.salir) ENV.salir(); return;
    case 'tema': { const A = INFO.ajustes || {}; const act = temaLocal() || A.tema || 'oscuro'; try { localStorage.setItem('aet_gym_tema', act === 'claro' ? 'oscuro' : 'claro'); } catch (e) {} aplicarTema(); return pintar(); }
    case 'modal-cerrar': return cerrarModal();
    case 'ancla': { const t = $(x); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    case 'filtro-socios': return raizV('g-socios', { f: x });
    case 'filtro': vista.f = x; vista.q = ($('gyBusca') || {}).value || ''; return pintar();
    case 'rango': vista.r = x; return pintar();
    case 'pagos-tab': vista.tab = x; return pintar();
    case 'ficha-tab': vista.tab = x; return pintar();
    case 'config-sec': vista.sec = x; return pintar();
    case 'config-ir': return raizV('g-config', { sec: x });
    case 'acc-dia': vista.dia = x > hoyMx() ? hoyMx() : x; vista.res = null; return pintar();
    case 'socio': if (!x) return; cerrarModal(); { const r = $('gxResBusca'); if (r) r.classList.remove('on'); } return ir('g-socio', { id: Number(x) });
    case 'elegir': return ocupado(async () => { await elegir(x); raizV('g-hoy'); });
    case 'camara': return abrirCamara();
    case 'checkin': return ocupado(async () => { const d = ($('gyNum').value || '').trim(); if (!d) throw new Error('Escribe el número del socio.'); await checkin(d, 'numero'); });
    case 'entrada-manual': return ocupado(async () => { const r = await llamar('gym_checkin', { p_gym: G, p_sede: null, p_dato: String(vista.s.numero) }); toast(!r.ok ? 'Acceso denegado: ' + (MOTIVOS[r.motivo] || '') : r.repetido ? 'Ya tenía entrada registrada hace poco' : 'Entrada registrada'); await pintar(); });
    case 'guardar-socio': return ocupado(async () => {
      const p = { id: x || null, nombre: $('gsNom').value, telefono: $('gsTel').value, email: $('gsMail').value, nota: $('gsNota').value, fecha_nac: $('gsNac').value, emergencia: $('gsEmer').value, sede_id: $('gsSede') ? $('gsSede').value : null };
      const s = await llamar('gym_socio_guardar', { p_gym: G, p }); await recargarInfo();
      toast(x ? 'Guardado' : `Socio #${s.numero} registrado`);
      pila.pop(); vista = { v: 'g-socio', id: s.id, despues: x ? null : () => modalCobro(s.id).catch((e) => toast(e.message)) }; pintar();
    });
    case 'editar-socio': return ir('g-nuevo', { s: vista.s });
    case 'seg': el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); return;
    case 'cobrar-abrir': return ocupado(() => modalCobro(Number(x)));
    case 'cobro-plan': { el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); const p = INFO.planes.find((q) => String(q.id) === x); if (p) { $('gcTotal').value = p.precio; $('gcMonto').value = p.precio; } return cobroCalc(); }
    case 'cobrar': return ocupado(async () => {
      const plan = Number(segVal('gcPlanes')), monto = Number($('gcMonto').value), total = Number($('gcTotal').value);
      if ($('gcMonto').value === '' || !(monto >= 0)) throw new Error('Escribe cuánto paga ahora.');
      if ($('gcTotal').value === '' || !(total >= 0)) throw new Error('Escribe el precio.');
      if (monto > total) throw new Error('Lo que paga no puede ser mayor que el precio.');
      const s0 = vista.cobroSocio;
      const s = await llamar('gym_pago_registrar', { p_gym: G, p_socio: s0.id, p_plan: plan, p_monto: monto, p_metodo: segVal('gcMet') || 'efectivo', p_concepto: null, p_total: total });
      cerrarModal(); CUENTAS = null; toast(`Pago registrado. Vigente hasta el ${fCorta(s.vence_en)}${Number(s.saldo) > 0 ? ' · debe ' + money(s.saldo) : ''}`);
      if (vista.v === 'g-entrada') vista.res = null; await pintar();
    });
    case 'abonar-abrir': { const s = vista.s; const p = x ? s.pagos.find((q) => String(q.id) === x) : s.pagos.find((q) => !q.anulado && !q.pago_de && Number(q.total) - Number(q.abonado || 0) > 0); if (!p) return; return modalAbono(p.id, Number(p.total) - Number(p.abonado || 0)); }
    case 'abonar-socio': return ocupado(async () => { const s = await llamar('gym_socio_detalle', { p_gym: G, p_socio: Number(x) }); vista.s = s; const p = s.pagos.find((q) => !q.anulado && !q.pago_de && Number(q.total) - Number(q.abonado || 0) > 0); if (!p) throw new Error('No hay pagos con saldo.'); modalAbono(p.id, Number(p.total) - Number(p.abonado || 0)); });
    case 'abonar': return ocupado(async () => { const m = Number($('gaMonto').value); if (!(m > 0)) throw new Error('Escribe el monto.'); if (m > vista.abono.pend) throw new Error('El abono no puede ser mayor que lo pendiente.'); const s = await llamar('gym_abono_registrar', { p_gym: G, p_pago: vista.abono.pago, p_monto: m, p_metodo: segVal('gaMet') || 'efectivo' }); cerrarModal(); CUENTAS = null; toast(Number(s.saldo) > 0 ? 'Abono registrado. Debe ' + money(s.saldo) : 'Abono registrado. Ya no debe nada'); await pintar(); });
    case 'anular-abrir': abrirModal('Anular pago', `<p>El pago quedará marcado como anulado (no se borra) y se recalcula su vencimiento. Si tiene abonos, también se anulan.</p><div class="gx-form"><label>Motivo<input class="gx-in" id="gnMot" maxlength="160" placeholder="Ej. Se registró dos veces"></label></div>`, `<button class="gx-btn gx-sec" data-g="modal-cerrar">Cancelar</button><button class="gx-btn gx-peligro" data-g="anular" data-x="${x}">Anular pago</button>`); return;
    case 'anular': return ocupado(async () => { await llamar('gym_pago_anular', { p_gym: G, p_pago: Number(x), p_motivo: $('gnMot').value }); cerrarModal(); toast('Pago anulado'); await pintar(); });
    case 'ticket-pago': { const s = vista.s; const p = s.pagos.find((q) => String(q.id) === x); if (p) ticketPago(s, p); return; }
    case 'congelar-abrir': abrirModal('Congelar membresía', `<p>Los días congelados se suman a su vencimiento. Mientras esté congelada no puede entrar.</p><div class="gx-form gx-form-2"><label>Días<input class="gx-in" id="gzDias" type="number" min="1" max="90" value="15"></label><label>Motivo<input class="gx-in" id="gzMot" maxlength="160" placeholder="Viaje, lesión…"></label></div>`, `<button class="gx-btn gx-sec" data-g="modal-cerrar">Cancelar</button><button class="gx-btn" data-g="congelar">Congelar</button>`); return;
    case 'congelar': return ocupado(async () => { const s = await llamar('gym_socio_congelar', { p_gym: G, p_socio: vista.s.id, p_dias: Math.round(Number($('gzDias').value)), p_motivo: $('gzMot').value }); cerrarModal(); toast('Congelada hasta el ' + fCorta(s.congelado_hasta) + '. Nuevo vencimiento: ' + fCorta(s.vence_en)); await pintar(); });
    case 'descongelar': if (!confirm('¿Reactivar la membresía hoy? Los días que no usó se le quitan del vencimiento.')) return; return ocupado(async () => { const s = await llamar('gym_socio_descongelar', { p_gym: G, p_socio: vista.s.id }); toast('Reactivada. Vence el ' + fCorta(s.vence_en)); await pintar(); });
    case 'baja': if (!confirm(x === '1' ? '¿Reactivar a este socio?' : '¿Dar de baja a este socio? Ya no podrá entrar.')) return; return ocupado(async () => { await llamar('gym_socio_baja', { p_gym: G, p_socio: vista.s.id, p_activo: x === '1' }); await recargarInfo(); await pintar(); });
    case 'credencial': return ocupado(async () => { const s = vista.s; const A = INFO.ajustes || {}; const svg = await qrSvg('AET-GYM:' + s.token, 6); imprimir(`<div class="cred">${A.logo ? `<div class="logo"><img src="${A.logo}" alt=""></div>` : `<div class="marca">${esc(INFO.nombre.toUpperCase())}</div>`}${s.foto ? `<img class="f" src="${s.foto}" alt="">` : ''}<div class="qr">${svg}</div><div class="num">#${s.numero}</div><div>${esc(s.nombre)}</div><p style="font-size:12px">Muestra este código al entrar</p></div>`, 'Credencial ' + s.nombre); });
    case 'cartel': return ocupado(async () => { const A = INFO.ajustes || {}; const svg = await qrSvg(appUrl() + '?instalar', 8); imprimir(`${A.logo ? `<div class="logo"><img src="${A.logo}" alt=""></div>` : `<div class="marca">${esc(INFO.nombre.toUpperCase())}</div>`}<h1>Entra con tu QR</h1><p>1. Escanea y descarga la app Aeterion (gratis)<br>2. Pide tu código en recepción<br>3. Muestra tu QR al entrar</p><div class="qr">${svg}</div><p style="font-size:14px">Ve cuándo vence tu membresía, tu próximo pago y entrena con programas basados en evidencia.</p>`, 'Cartel de entrada'); });
    case 'doc': return ir('g-doc', { id: x });
    case 'staff-abrir': abrirModal('Agregar persona', `<p class="gx-tenue">Debe tener cuenta en la app Aeterion con ese correo.</p><div class="gx-form"><label>Correo<input class="gx-in" id="geMail" type="email" maxlength="120" autocomplete="off"></label></div><span class="gx-lab">Puesto</span>${segHtml('geRol', (puede.dueno() ? [['admin', 'Administrador']] : []).concat([['recepcion', 'Recepción'], ['coach', 'Entrenador']]), 'recepcion')}<p class="gx-tenue gx-peq">Revisa en la tabla qué puede hacer cada puesto.</p>`, `<button class="gx-btn gx-sec" data-g="modal-cerrar">Cancelar</button><button class="gx-btn" data-g="agregar-staff">Agregar</button>`); return;
    case 'agregar-staff': return ocupado(async () => { const m = $('geMail').value.trim(); if (!m) throw new Error('Escribe el correo.'); await llamar('gym_staff_agregar', { p_gym: G, p_email: m, p_rol: segVal('geRol') || 'recepcion' }); cerrarModal(); await recargarInfo(); toast('Agregado'); await pintar(); });
    case 'quitar-staff': if (!confirm('¿Quitarle el acceso a esta persona?')) return; return ocupado(async () => { await llamar('gym_staff_quitar', { p_gym: G, p_id: Number(x) }); await recargarInfo(); await pintar(); });
    case 'plan-abrir': { const p = x ? INFO.planes.find((q) => String(q.id) === x) : null;
      abrirModal(p ? 'Editar membresía' : 'Nueva membresía', `<div class="gx-form gx-form-2"><label class="gx-ancho2">Nombre<input class="gx-in" id="gpNom" maxlength="50" placeholder="Mensual, Trimestral, Visita…" value="${esc(p ? p.nombre : '')}"></label><label>Precio<input class="gx-in" id="gpPrecio" type="number" min="0" step="0.01" value="${p ? p.precio : ''}"></label><label>Días que cubre<input class="gx-in" id="gpDias" type="number" min="1" max="400" value="${p ? p.dias : 30}"></label></div>
        <div class="gx-chips gx-mt">${[['Visita', 1], ['Semana', 7], ['Mensual', 30], ['Trimestral', 90], ['Semestral', 180], ['Anual', 365]].map(([n, d]) => `<button class="gx-chip" data-g="plan-dias" data-x="${d}" data-n="${n}">${n} · ${d}</button>`).join('')}</div>
        <span class="gx-lab">Color</span><div class="gx-colores" id="gpColores">${COLORES.map((c, i) => `<button class="${(p && p.color === c) || (!p && i === (INFO.planes.length + 1) % COLORES.length) || (p && !p.color && i === 0) ? 'on' : ''}" style="background:${c}" data-g="color" data-x="${c}" aria-label="${c}"></button>`).join('')}</div>`,
        `<button class="gx-btn gx-sec" data-g="modal-cerrar">Cancelar</button><button class="gx-btn" data-g="guardar-plan" data-x="${p ? p.id : ''}">Guardar</button>`); return; }
    case 'plan-dias': $('gpDias').value = x; if (!$('gpNom').value) $('gpNom').value = el.dataset.n; return;
    case 'color': el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); if (el.parentElement.id === 'gyColores') { const o = $('gyColorOtro'); if (o) o.value = x; const r = raiz(); if (r) { const [a1, b1, c1] = hexRgb(x); r.style.setProperty('--gx-ac', x); r.style.setProperty('--gx-ac-rgb', `${a1},${b1},${c1}`); } } return;
    case 'guardar-plan': return ocupado(async () => { await llamar('gym_plan_guardar', { p_gym: G, p: { id: x || null, nombre: $('gpNom').value, precio: String($('gpPrecio').value || ''), dias: String($('gpDias').value || ''), color: segVal('gpColores') || null } }); cerrarModal(); await recargarInfo(); toast('Membresía guardada'); await pintar(); });
    case 'plan-quitar': if (!confirm('¿Dejar de vender este plan? Los pagos y socios actuales no cambian.')) return; return ocupado(async () => { const p = INFO.planes.find((q) => String(q.id) === x); await llamar('gym_plan_guardar', { p_gym: G, p: { id: p.id, nombre: p.nombre, precio: String(p.precio), dias: String(p.dias), activo: false } }); await recargarInfo(); await pintar(); });
    case 'guardar-sede': return ocupado(async () => { await llamar('gym_sede_guardar', { p_gym: G, p: { nombre: $('gdNom').value, direccion: $('gdDir').value } }); await recargarInfo(); toast('Sede agregada'); await pintar(); });
    case 'guardar-marca': return ocupado(async () => { INFO = await llamar('gym_ajustes_guardar', { p_gym: G, p: { color: segVal('gyColores') || $('gyColorOtro').value, tema: segVal('gyTema') } }); try { localStorage.removeItem('aet_gym_tema'); } catch (e) {} aplicarTema(); toast('Marca guardada'); await pintar(); });
    case 'logo-quitar': return ocupado(async () => { INFO = await llamar('gym_ajustes_guardar', { p_gym: G, p: { logo: '' } }); await pintar(); });
    case 'guardar-acceso': return ocupado(async () => { INFO = await llamar('gym_ajustes_guardar', { p_gym: G, p: { politica_vencidos: segVal('gaPol'), aviso_dias: String($('gaAviso').value || '') } }); CUENTAS = null; toast('Guardado'); await pintar(); });
    case 'guardar-ticket': return ocupado(async () => { INFO = await llamar('gym_ajustes_guardar', { p_gym: G, p: { ticket_ancho: segVal('gaAncho'), telefono: $('gaTel').value, rfc: $('gaRfc').value, direccion: $('gaDir').value, ticket_encabezado: $('gaEnc').value, ticket_pie: $('gaPie').value } }); toast('Guardado'); });
    case 'ticket-prueba': return ticketVenta({ folio: 0, fecha: new Date().toISOString(), items: [{ cantidad: 1, nombre: 'Agua 1 L', importe: 15 }, { cantidad: 2, nombre: 'Barra de proteína', importe: 70 }], subtotal: 85, descuento: 0, total: 85, metodo: 'efectivo', pago_con: 100, cambio: 15 });
    case 'vincular': return ocupado(async () => { const c = ($('gyCodSocio').value || '').trim(); if (!c) throw new Error('Escribe tu código.'); await llamar('socio_vincular', { p_codigo: c }); toast('¡Listo! Ya ves tu membresía'); await refrescar(); await pintar(); });
    case 'desvincular': if (!confirm('¿Desvincular tu cuenta de este gimnasio? Tu membresía sigue igual en el gimnasio.')) return; return ocupado(async () => { await llamar('socio_desvincular', { p_socio: Number(x) }); await refrescar(); await pintar(); });
    default: if (window.__gymAccion) return window.__gymAccion(a, x, el, ocupado);
  }
}
document.addEventListener('click', alClic);
document.addEventListener('click', (e) => { const r = $('gxResBusca'); if (r && r.classList.contains('on') && !e.target.closest('.gx-buscar')) r.classList.remove('on'); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { cerrarModal(); return; }
  if (e.key !== 'Enter' || !e.target) return;
  if (e.target.id === 'gyNum') { e.preventDefault(); const b = document.querySelector('[data-g="checkin"]'); if (b) b.click(); }
  if (e.target.id === 'gyBusca') { vista.q = e.target.value.trim(); pintar(); }
  if (e.target.id === 'gxBuscar') { const p = document.querySelector('#gxResBusca button'); if (p) p.click(); }
});
document.addEventListener('input', (e) => {
  const id = e.target && e.target.id;
  if (id === 'gcMonto' || id === 'gcTotal') cobroCalc();
  if (id === 'gxBuscar') { clearTimeout(_tBusca); const q = e.target.value.trim(); _tBusca = setTimeout(() => buscarGlobal(q), 250); }
  if (id === 'gyColorOtro') { document.querySelectorAll('#gyColores button').forEach((b) => b.classList.remove('on')); const r = raiz(); if (r) { const [a, b, c] = hexRgb(e.target.value); r.style.setProperty('--gx-ac', e.target.value); r.style.setProperty('--gx-ac-rgb', `${a},${b},${c}`); } }
});
document.addEventListener('change', async (e) => {
  const id = e.target && e.target.id;
  if (id === 'gyMet') { vista.met = e.target.value || null; pintar(); }
  if (id === 'gyAccDia' && e.target.value) { vista.dia = e.target.value; vista.res = null; pintar(); }
  if (id === 'gyFoto' && e.target.files && e.target.files[0]) {
    try { const foto = await reducirImg(e.target.files[0], 320, true); await llamar('gym_socio_foto', { p_gym: G, p_socio: vista.s.id, p_foto: foto }); toast('Foto guardada'); pintar(); } catch (x) { toast(x.message || 'No se pudo usar esa foto.'); }
  }
  if (id === 'gyLogo' && e.target.files && e.target.files[0]) {
    try { const logo = await reducirImg(e.target.files[0], 360, false); INFO = await llamar('gym_ajustes_guardar', { p_gym: G, p: { logo } }); toast('Logo guardado'); aplicarTema(); pintar(); } catch (x) { toast(x.message || 'No se pudo usar esa imagen.'); }
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pararCamara(); });
// Imagen ligera: foto cuadrada recortada o logo proporcional (≈20–60 KB)
function reducirImg(file, lado, cuadrada) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const c = document.createElement('canvas'); let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (cuadrada) { const m = Math.min(img.width, img.height); sx = (img.width - m) / 2; sy = (img.height - m) / 2; sw = sh = m; c.width = c.height = lado; }
      else { const k = Math.min(1, lado / Math.max(img.width, img.height)); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); }
      const x = c.getContext('2d'); if (!cuadrada) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } x.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let q = 0.82, d = c.toDataURL('image/jpeg', q); while (d.length > 110000 && q > 0.3) { q -= 0.12; d = c.toDataURL('image/jpeg', q); } ok(d); };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

/* ---------------- API pública ---------------- */
window.gymEstado = async function () {
  const e = await refrescar();
  try { const cod = localStorage.getItem('aet_socio_inv');
    if (cod) { localStorage.removeItem('aet_socio_inv'); await llamar('socio_vincular', { p_codigo: cod }); await refrescar(); toast('Tu membresía quedó vinculada'); pila = []; vista = { v: 's-mio' }; if (typeof aetIr === 'function') aetIr('gym'); else pintar(); }
  } catch (x) { toast(x.message); }
  return e;
};
window.gymRender = function () { pintar(); };
window.__aetGym = { VISTAS, llamar, esc, money, moneyK, fCorta, fDia, fechaHora, hora, hoyMx, sumaDias, toast, titulo, METODOS, barras, linea, dona, PALETA, diaCorto, puede, rol, ir, volver, pintar, raizV,
  ticketVenta, ticketPago, imprimir, ico, kpi, vacio, delta, abrirModal, cerrarModal, segHtml, segVal, avatar, pill,
  get G() { return G; }, get INFO() { return INFO; }, set INFO(v) { INFO = v; }, get vista() { return vista; }, get PAGINA() { return PAGINA; }, base: ENV.base || '', appUrl };
window.gymAbrir = function (v) { pararCamara(); pila = []; vista = { v: v || 'g-hoy' }; pintar(); };
window.gymSub = function () { return pila.length > 0 || !!($('gyModalRoot') && $('gyModalRoot').classList.contains('on')); };
window.gymVolver = function () { if ($('gyModalRoot') && $('gyModalRoot').classList.contains('on')) { cerrarModal(); return true; } if (pila.length) { volver(); return true; } return false; };
window.aetGymEntrar = function (v) { pararCamara(); pila = []; vista = { v: v || 'g-hoy' }; if (typeof aetIr === 'function') aetIr('gym'); else pintar(); };

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
body.modo-gym .app-bottomnav,body.modo-gym .app-header{display:none!important}
.gx-raiz{--gx-ac:#c9a84c;--gx-ac-rgb:201,168,76;--gx-ac-txt:#111;--gx-bg:#0b0c0f;--gx-panel:#15171c;--gx-panel2:#1d2027;--gx-borde:rgba(255,255,255,.08);--gx-borde2:rgba(255,255,255,.14);--gx-txt:#eef0f3;--gx-txt2:#9aa1ad;--gx-sombra:0 1px 2px rgba(0,0,0,.3);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--gx-txt)}
.gx-raiz.gx-claro{--gx-bg:#f3f5f9;--gx-panel:#ffffff;--gx-panel2:#f5f7fa;--gx-borde:#e5e8ee;--gx-borde2:#d5dae3;--gx-txt:#121826;--gx-txt2:#5f6b7d;--gx-sombra:0 1px 3px rgba(16,24,40,.06),0 1px 2px rgba(16,24,40,.04)}
#gymApp.gx-raiz{background:var(--gx-bg);min-height:100vh;padding-bottom:84px}
.app-screen#app-screen-gym{padding-left:0!important;padding-right:0!important;padding-top:0!important}
body.gx-claro-body{background:#f3f5f9}
.gx-raiz *,#gyModalRoot *{box-sizing:border-box}
.gx-raiz .gx-i{flex:none}
.gx-raiz .gx-lado{display:none}
.gx-raiz .gx-main{min-width:0}
.gx-raiz .gx-top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:.6rem;padding:.6rem .9rem;background:var(--gx-bg);border-bottom:1px solid var(--gx-borde)}
.gx-raiz .gx-top-marca{display:flex;align-items:center;gap:.55rem;min-width:0;flex:1} .gx-raiz .gx-top-marca b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}
.gx-raiz .gx-buscar{position:relative;display:none;align-items:center;gap:.4rem;background:var(--gx-panel);border:1px solid var(--gx-borde);border-radius:12px;padding:0 .7rem;color:var(--gx-txt2);flex:1;max-width:460px}
.gx-raiz .gx-buscar input{flex:1;border:0;background:none;color:var(--gx-txt);font:inherit;font-size:14px;padding:.62rem 0;outline:none;min-width:0}
.gx-raiz .gx-buscar-in{display:flex;max-width:none;flex:1} .gx-raiz .gx-buscar-in .gx-in{border:0;background:none;padding:.5rem 0;margin:0;min-height:0;box-shadow:none}
.gx-raiz .gx-res-busca{display:none;position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--gx-panel);border:1px solid var(--gx-borde2);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.35);padding:.35rem;z-index:30;max-height:60vh;overflow:auto}
.gx-raiz .gx-res-busca.on{display:block} .gx-raiz .gx-res-busca button{display:flex;align-items:center;gap:.6rem;width:100%;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:.5rem;border-radius:10px;cursor:pointer} .gx-raiz .gx-res-busca button:hover{background:var(--gx-panel2)}
.gx-raiz .gx-res-busca button div{flex:1;min-width:0} .gx-raiz .gx-res-busca b{display:block;font-size:13.5px} .gx-raiz .gx-res-busca small{color:var(--gx-txt2);font-size:12px} .gx-raiz .gx-res-busca p{margin:.5rem;font-size:13px}
.gx-raiz .gx-top-acc{display:flex;align-items:center;gap:.4rem}
.gx-raiz .gx-ico-btn,#gyModalRoot .gx-ico-btn{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;border:1px solid var(--gx-borde);background:var(--gx-panel);color:var(--gx-txt2);cursor:pointer}
.gx-raiz .gx-ico-btn:hover{color:var(--gx-txt)}
.gx-raiz .gx-salir{border:1px solid rgba(var(--gx-ac-rgb),.5);background:transparent;color:var(--gx-ac);border-radius:20px;padding:.45rem .85rem;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;min-height:38px}
.gx-raiz .gx-cuerpo{padding:1rem .9rem 1.5rem;max-width:1280px;margin:0 auto}
.gx-raiz .gx-nav-movil{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;background:var(--gx-panel);border-top:1px solid var(--gx-borde);padding-bottom:env(safe-area-inset-bottom)}
.gx-raiz .gx-nav-movil button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;color:var(--gx-txt2);font:inherit;font-size:10.5px;font-weight:600;padding:.55rem 0 .5rem;cursor:pointer;min-height:58px}
.gx-raiz .gx-nav-movil button.on{color:var(--gx-ac)}
.gx-raiz .gx-solo-pc{display:none!important}
.gx-raiz .gx-atras{border:0;background:none;color:var(--gx-ac);font:inherit;font-size:14px;font-weight:600;padding:0 0 .7rem;cursor:pointer}
.gx-raiz .gx-titulo{display:flex;justify-content:space-between;align-items:flex-end;gap:.8rem;flex-wrap:wrap;margin:.2rem 0 1.1rem}
.gx-raiz .gx-titulo h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em;font-family:inherit} .gx-raiz .gx-titulo p{margin:.25rem 0 0;font-size:13.5px;color:var(--gx-txt2)}
.gx-raiz .gx-titulo-acc{display:flex;gap:.5rem;flex-wrap:wrap}
.gx-raiz .gx-card{background:var(--gx-panel);border:1px solid var(--gx-borde);border-radius:16px;padding:1rem 1.1rem;margin-bottom:1rem;box-shadow:var(--gx-sombra);font-size:14px;line-height:1.5}
.gx-raiz .gx-card > b{display:block;font-size:15px;margin-bottom:.35rem} .gx-raiz .gx-card p{margin:.3rem 0 0}
.gx-raiz .gx-sin-pad{padding:0;overflow:hidden} .gx-raiz .gx-pad{padding:.9rem 1.1rem 0}
.gx-raiz .gx-card-cab{display:flex;justify-content:space-between;align-items:center;gap:.6rem;margin-bottom:.6rem;flex-wrap:wrap} .gx-raiz .gx-card-cab b{font-size:15px;display:flex;align-items:center;gap:.5rem}
.gx-raiz .gx-dest{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;border-color:rgba(var(--gx-ac-rgb),.5);background:linear-gradient(135deg,rgba(var(--gx-ac-rgb),.14),rgba(var(--gx-ac-rgb),.03))}
.gx-raiz .gx-error{border-color:rgba(239,68,68,.5)}
.gx-raiz .gx-aviso{border-radius:12px;padding:.65rem .9rem;font-size:13px;margin-bottom:1rem} .gx-raiz .gx-aviso.mal{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.35)}
.gx-raiz .gx-grid-2,.gx-raiz .gx-grid-3{display:grid;gap:1rem;margin-bottom:1rem} .gx-raiz .gx-grid-2 > .gx-card,.gx-raiz .gx-grid-3 > .gx-card{margin:0}
.gx-raiz .gx-grid-2-movil{grid-template-columns:1fr 1fr}
.gx-raiz .gx-mb{margin-bottom:1rem} .gx-raiz .gx-mt{margin-top:.7rem}
.gx-raiz .gx-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;margin-bottom:1rem}
.gx-raiz .gx-kpi{display:flex;align-items:flex-start;gap:.75rem;text-align:left;background:var(--gx-panel);border:1px solid var(--gx-borde);border-radius:16px;padding:.9rem;color:inherit;font:inherit;box-shadow:var(--gx-sombra);min-width:0;position:relative;overflow:hidden}
.gx-raiz button.gx-kpi{cursor:pointer} .gx-raiz button.gx-kpi:hover{border-color:var(--k)}
.gx-raiz .gx-kpi::after{content:"";position:absolute;inset:auto 0 0 0;height:3px;background:var(--k);opacity:.85}
.gx-raiz .gx-kpi-i{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:color-mix(in srgb,var(--k) 16%,transparent);color:var(--k);flex:none}
.gx-raiz .gx-kpi > div{min-width:0} .gx-raiz .gx-kpi small{display:block;font-size:12px;color:var(--gx-txt2);font-weight:600}
.gx-raiz .gx-kpi b{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gx-raiz .gx-kpi-sub{display:block;font-size:11px;color:var(--gx-txt2)}
.gx-raiz .gx-delta{display:inline-block;font-style:normal;font-size:11.5px;font-weight:800;border-radius:20px;padding:1px 7px;background:var(--gx-panel2);color:var(--gx-txt2);margin-top:.2rem}
.gx-raiz .gx-delta.sube{background:rgba(34,197,94,.14);color:#16a34a} .gx-raiz .gx-delta.baja{background:rgba(239,68,68,.14);color:#ef4444}
.gx-raiz .gx-kpis-2,.gx-raiz .gx-kpis-3,.gx-raiz .gx-kpis-5{grid-template-columns:repeat(2,1fr)}
.gx-raiz .gx-chips-al{display:flex;flex-wrap:wrap;gap:.45rem;margin:-.2rem 0 1rem}
.gx-raiz .gx-chip-al{display:inline-flex;align-items:center;gap:.4rem;border-radius:30px;padding:.4rem .8rem;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid}
.gx-raiz .gx-chip-al.ok{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.35);color:#16a34a} .gx-raiz .gx-chip-al.warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.35);color:#d97706}
.gx-raiz .gx-chip-al.mal{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.35);color:#ef4444} .gx-raiz .gx-chip-al.info{background:rgba(236,72,153,.1);border-color:rgba(236,72,153,.35);color:#ec4899}
.gx-raiz:not(.gx-claro) .gx-chip-al.ok,.gx-raiz:not(.gx-claro) .gx-delta.sube{color:#4ade80} .gx-raiz:not(.gx-claro) .gx-chip-al.warn{color:#fbbf24}
.gx-raiz .gx-btn,#gyModalRoot .gx-btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;background:var(--gx-ac);color:var(--gx-ac-txt);border:1px solid transparent;border-radius:12px;padding:.65rem 1.05rem;font:inherit;font-weight:700;font-size:14px;cursor:pointer;min-height:44px;text-decoration:none;white-space:nowrap;transition:filter .15s}
.gx-raiz .gx-btn:hover,#gyModalRoot .gx-btn:hover{filter:brightness(1.07)} .gx-raiz .gx-btn:disabled{opacity:.5;cursor:not-allowed}
.gx-raiz .gx-btn.gx-sec,#gyModalRoot .gx-btn.gx-sec{background:var(--gx-panel2);color:var(--gx-txt);border-color:var(--gx-borde2)}
.gx-raiz .gx-btn.gx-peligro,#gyModalRoot .gx-btn.gx-peligro{background:rgba(239,68,68,.12);color:#ef4444;border-color:rgba(239,68,68,.4)}
.gx-raiz .gx-btn-sm{min-height:38px;padding:.45rem .8rem;font-size:13px} .gx-raiz .gx-btn-lg{min-height:50px;padding:.8rem 1.4rem;font-size:15px} .gx-raiz .gx-btn-xl{min-height:58px;padding:.8rem 1.6rem;font-size:16px}
.gx-raiz .gx-ancho{width:100%} .gx-raiz .gx-wa-b{background:#25d366;color:#06200f}
.gx-raiz .gx-link,#gyModalRoot .gx-link{background:none;border:0;color:var(--gx-ac);font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:.3rem 0} .gx-raiz .gx-link.mal{color:#ef4444}
.gx-ocupado{opacity:.55;pointer-events:none}
.gx-raiz .gx-in,#gyModalRoot .gx-in{width:100%;background:var(--gx-panel2);border:1px solid var(--gx-borde2);border-radius:11px;color:var(--gx-txt);font:inherit;font-size:16px;padding:.62rem .8rem;margin-top:.35rem;min-height:46px}
.gx-raiz .gx-in:focus,#gyModalRoot .gx-in:focus{outline:none;border-color:var(--gx-ac);box-shadow:0 0 0 3px rgba(var(--gx-ac-rgb),.18)} .gx-raiz .gx-in-sm{min-height:38px;padding:.4rem .6rem;font-size:14px;margin:0;width:auto} .gx-raiz .gx-in-xl,#gyModalRoot .gx-in-xl{font-size:24px;font-weight:700;min-height:58px;letter-spacing:.04em}
.gx-raiz .gx-lab,#gyModalRoot .gx-lab{display:block;font-size:12px;font-weight:700;color:var(--gx-txt2);margin:.9rem 0 .35rem;text-transform:uppercase;letter-spacing:.05em}
.gx-raiz .gx-form label,#gyModalRoot .gx-form label{display:block;font-size:13px;font-weight:600;margin-top:.75rem} .gx-raiz .gx-form > b{margin-top:.8rem}
.gx-raiz .gx-form-2,#gyModalRoot .gx-form-2{display:grid;grid-template-columns:1fr;gap:0 .9rem} .gx-raiz .gx-form-acc{margin-top:1.1rem}
.gx-raiz .gx-fila-in{display:flex;gap:.6rem;align-items:stretch} .gx-raiz .gx-fila-in .gx-in{margin:0;flex:1}
.gx-raiz .gx-fila-btns{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.8rem;align-items:center}
.gx-raiz .gx-seg,#gyModalRoot .gx-seg{display:flex;gap:4px;background:var(--gx-panel2);border:1px solid var(--gx-borde);border-radius:12px;padding:4px;flex-wrap:wrap;margin-top:.3rem}
.gx-raiz .gx-seg button,#gyModalRoot .gx-seg button{flex:1;min-width:80px;min-height:40px;border-radius:9px;border:0;font:inherit;font-size:13px;font-weight:700;background:transparent;color:var(--gx-txt2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:.35rem}
.gx-raiz .gx-seg button.on,#gyModalRoot .gx-seg button.on{background:var(--gx-ac);color:var(--gx-ac-txt)}
.gx-raiz .gx-chips,#gyModalRoot .gx-chips{display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none;padding-bottom:2px} .gx-raiz .gx-chips::-webkit-scrollbar{display:none}
.gx-raiz .gx-chip,#gyModalRoot .gx-chip{flex:none;background:var(--gx-panel);border:1px solid var(--gx-borde2);color:var(--gx-txt);border-radius:30px;padding:.42rem .85rem;font:inherit;font-size:13px;font-weight:600;cursor:pointer;min-height:38px}
.gx-raiz .gx-chip em{font-style:normal;font-size:11.5px;color:var(--gx-txt2);margin-left:.2rem} .gx-raiz .gx-chip.on{background:var(--gx-ac);border-color:var(--gx-ac);color:var(--gx-ac-txt)} .gx-raiz .gx-chip.on em{color:inherit;opacity:.75}
.gx-raiz .gx-barra-filtros{display:flex;flex-direction:column;gap:.6rem;margin-bottom:1rem}
.gx-raiz .gx-tabs{display:flex;gap:.2rem;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--gx-borde);margin-bottom:1rem} .gx-raiz .gx-tabs::-webkit-scrollbar{display:none}
.gx-raiz .gx-tabs button{flex:none;border:0;background:none;color:var(--gx-txt2);font:inherit;font-size:14px;font-weight:700;padding:.7rem .9rem;border-bottom:2px solid transparent;cursor:pointer}
.gx-raiz .gx-tabs button.on{color:var(--gx-txt);border-bottom-color:var(--gx-ac)}
.gx-raiz .gx-pill{display:inline-block;font-style:normal;font-size:11.5px;font-weight:800;border-radius:20px;padding:2px 9px;white-space:nowrap;vertical-align:middle}
.gx-raiz .gx-pill.ok{background:rgba(34,197,94,.15);color:#15803d} .gx-raiz .gx-pill.warn{background:rgba(245,158,11,.16);color:#b45309} .gx-raiz .gx-pill.mal{background:rgba(239,68,68,.14);color:#dc2626}
.gx-raiz .gx-pill.gris{background:var(--gx-panel2);color:var(--gx-txt2)} .gx-raiz .gx-pill.info{background:rgba(6,182,212,.15);color:#0e7490} .gx-raiz .gx-pill.ac{background:rgba(var(--gx-ac-rgb),.18);color:var(--gx-ac)}
.gx-raiz:not(.gx-claro) .gx-pill.ok{color:#4ade80} .gx-raiz:not(.gx-claro) .gx-pill.warn{color:#fbbf24} .gx-raiz:not(.gx-claro) .gx-pill.mal{color:#f87171} .gx-raiz:not(.gx-claro) .gx-pill.info{color:#22d3ee}
.gx-raiz .gx-tenue,#gyModalRoot .gx-tenue{color:var(--gx-txt2)} .gx-raiz .gx-peq,#gyModalRoot .gx-peq{font-size:12.5px} .gx-raiz .gx-centro{text-align:center}
.gx-raiz .gx-txt-warn{color:#d97706;font-weight:700} .gx-raiz .gx-txt-mal{color:#ef4444;font-weight:700} .gx-raiz:not(.gx-claro) .gx-txt-warn{color:#fbbf24}
.gx-raiz .gx-plan{display:inline-flex;align-items:center;gap:.4rem;font-weight:600} .gx-raiz .gx-plan i{width:9px;height:9px;border-radius:3px}
.gx-raiz .gx-vacio{text-align:center;padding:1.6rem 1rem;color:var(--gx-txt2)} .gx-raiz .gx-vacio b{display:block;color:var(--gx-txt);font-size:15px} .gx-raiz .gx-vacio p{margin:.3rem 0 .8rem;font-size:13px}
.gx-raiz .gx-av{flex:none;width:38px;height:38px;border-radius:50%;object-fit:cover;display:inline-grid;place-items:center;font-weight:800;font-size:13px;background:hsl(var(--h,40) 55% 45% / .22);color:hsl(var(--h,40) 70% 62%)}
.gx-raiz.gx-claro .gx-av{color:hsl(var(--h,40) 60% 36%)}
.gx-raiz .gx-av-xl{width:120px;height:120px;font-size:38px;border:4px solid currentColor} .gx-raiz .gx-av-xxl{width:96px;height:96px;font-size:30px}
.gx-raiz .gx-tabla-w{overflow-x:auto} .gx-raiz .gx-tabla{width:100%;border-collapse:collapse;font-size:13.5px}
.gx-raiz .gx-tabla th{text-align:left;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--gx-txt2);font-weight:700;padding:.7rem .9rem;border-bottom:1px solid var(--gx-borde);background:var(--gx-panel2);white-space:nowrap}
.gx-raiz .gx-tabla td{padding:.65rem .9rem;border-bottom:1px solid var(--gx-borde);vertical-align:middle} .gx-raiz .gx-tabla tr:last-child td{border-bottom:0}
.gx-raiz .gx-tabla tbody tr[data-g],.gx-raiz .gx-tabla td[data-g]{cursor:pointer} .gx-raiz .gx-tabla tbody tr[data-g]:hover td{background:var(--gx-panel2)}
.gx-raiz .gx-tabla small{font-size:11.5px} .gx-raiz .gx-anulado td{opacity:.5} .gx-raiz .gx-anulado td b{text-decoration:line-through}
.gx-raiz .gx-cel-socio{display:flex;align-items:center;gap:.6rem;min-width:170px} .gx-raiz .gx-cel-socio b{display:block} .gx-raiz .gx-cel-socio small{color:var(--gx-txt2)}
.gx-raiz .gx-col-md{display:none} .gx-raiz .gx-acc-cel{text-align:right;white-space:nowrap} .gx-raiz .gx-acc-cel > *{margin-left:.6rem;vertical-align:middle}
.gx-raiz .gx-permisos td:not(:first-child),.gx-raiz .gx-permisos th:not(:first-child){text-align:center} .gx-raiz .gx-si{color:#22c55e;font-weight:900} .gx-raiz .gx-no{color:var(--gx-txt2)}
.gx-raiz .gx-filas{display:flex;flex-direction:column}
.gx-raiz .gx-fila{display:flex;align-items:center;gap:.5rem;border-top:1px solid var(--gx-borde)} .gx-raiz .gx-fila:first-child{border-top:0}
.gx-raiz .gx-fila-p{flex:1;display:flex;align-items:center;gap:.65rem;min-width:0;background:none;border:0;color:inherit;font:inherit;text-align:left;padding:.6rem 0;cursor:pointer}
.gx-raiz .gx-fila-p > div{flex:1;min-width:0} .gx-raiz .gx-fila-p b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .gx-raiz .gx-fila-p small{font-size:12px;color:var(--gx-txt2)}
.gx-raiz .gx-wa{flex:none;display:inline-grid;place-items:center;width:38px;height:38px;border-radius:12px;background:rgba(37,211,102,.14);color:#16a34a} .gx-raiz:not(.gx-claro) .gx-wa{color:#4ade80}
.gx-raiz .gx-kv{display:flex;justify-content:space-between;align-items:center;gap:.8rem;padding:.55rem 0;border-top:1px solid var(--gx-borde)} .gx-raiz .gx-kv:first-of-type{border-top:0}
.gx-raiz .gx-graf{width:100%;height:auto;max-height:240px;display:block} .gx-raiz .gx-rejilla{stroke:var(--gx-borde);stroke-width:1} .gx-raiz .gx-eje{font-size:10px;fill:var(--gx-txt2)} .gx-raiz .gx-dona-n{font-size:22px;font-weight:800;fill:var(--gx-txt)}
.gx-raiz .gx-dona{display:flex;align-items:center;gap:1.2rem;flex-wrap:wrap} .gx-raiz .gx-dona svg{width:140px;flex:none}
.gx-raiz .gx-dona ul{list-style:none;margin:0;padding:0;flex:1;min-width:150px} .gx-raiz .gx-dona li{display:flex;align-items:center;gap:.5rem;padding:.3rem 0;font-size:13.5px}
.gx-raiz .gx-dona li i{width:11px;height:11px;border-radius:3px;flex:none} .gx-raiz .gx-dona li span{flex:1} .gx-raiz .gx-dona li small{color:var(--gx-txt2);min-width:22px;text-align:right}
.gx-raiz .gx-ley{display:flex;align-items:center;gap:.4rem;font-size:12px;color:var(--gx-txt2)} .gx-raiz .gx-ley i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-left:.5rem}
.gx-raiz .gx-feed{list-style:none;margin:0;padding:0} .gx-raiz .gx-feed li{display:flex;gap:.7rem;padding:.55rem 0;border-top:1px solid var(--gx-borde);cursor:pointer} .gx-raiz .gx-feed li:first-child{border-top:0}
.gx-raiz .gx-feed-i,.gx-raiz .gx-ico-c{flex:none;width:32px;height:32px;border-radius:10px;display:inline-grid;place-items:center;background:color-mix(in srgb,var(--k) 15%,transparent);color:var(--k)} .gx-raiz .gx-ico-c{width:28px;height:28px;border-radius:8px}
.gx-raiz .gx-feed p{margin:0;font-size:13.5px} .gx-raiz .gx-feed small{color:var(--gx-txt2);font-size:12px}
.gx-raiz .gx-prog{height:7px;border-radius:7px;background:var(--gx-panel2);overflow:hidden;margin:.6rem 0 .3rem} .gx-raiz .gx-prog i{display:block;height:100%;background:var(--gx-ac);border-radius:7px}
.gx-raiz .gx-acceso{display:grid;gap:1rem;margin-bottom:1rem} .gx-raiz .gx-acceso .gx-card{margin:0}
.gx-raiz .gx-scan{position:relative;background:#000;border-radius:14px;overflow:hidden;aspect-ratio:4/3;max-width:520px;margin:1rem auto .5rem;display:none;place-items:center} .gx-raiz .gx-scan.on{display:grid}
.gx-raiz .gx-scan video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none} .gx-raiz .gx-scan video.on{display:block}
.gx-raiz .gx-scan-ayuda{position:relative;z-index:1;color:#ddd;font-size:13px;background:rgba(0,0,0,.5);border-radius:10px;padding:.6rem .9rem}
.gx-raiz .gx-estacion .gx-btn.gx-sec{margin-top:.8rem}
.gx-raiz .gx-resultado{min-height:200px}
.gx-raiz .gx-res-espera{height:100%;min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;border:2px dashed var(--gx-borde2);border-radius:16px;color:var(--gx-txt2);text-align:center;padding:1rem}
.gx-raiz .gx-res{border-radius:18px;padding:0 1rem 1.2rem;text-align:center;border:2px solid;display:flex;flex-direction:column;align-items:center;gap:.25rem;overflow:hidden;background:var(--gx-panel)}
.gx-raiz .gx-res-banda{align-self:stretch;margin:0 -1rem .9rem;padding:.7rem;font-weight:900;letter-spacing:.08em;font-size:15px;display:flex;align-items:center;justify-content:center;gap:.5rem;color:#fff}
.gx-raiz .gx-res b{font-size:24px;font-weight:800;margin-top:.5rem} .gx-raiz .gx-res > span{font-size:14px;color:var(--gx-txt2)} .gx-raiz .gx-res > small{font-size:13.5px;font-weight:700}
.gx-raiz .gx-res.ok{border-color:#22c55e} .gx-raiz .gx-res.ok .gx-res-banda{background:#16a34a} .gx-raiz .gx-res.ok .gx-av-xl{color:#22c55e} .gx-raiz .gx-res.ok > small:not(.gx-tenue){color:#16a34a}
.gx-raiz .gx-res.warn{border-color:#f59e0b} .gx-raiz .gx-res.warn .gx-res-banda{background:#d97706} .gx-raiz .gx-res.warn .gx-av-xl{color:#f59e0b} .gx-raiz .gx-res.warn > small:not(.gx-tenue){color:#d97706}
.gx-raiz .gx-res.mal{border-color:#ef4444} .gx-raiz .gx-res.mal .gx-res-banda{background:#dc2626} .gx-raiz .gx-res.mal .gx-av-xl{color:#ef4444} .gx-raiz .gx-res.mal > small:not(.gx-tenue){color:#dc2626}
.gx-raiz .gx-res-saldo{background:rgba(245,158,11,.15);color:#d97706;border-radius:10px;padding:.3rem .7rem;font-weight:800;font-size:13px;margin-top:.3rem}
.gx-raiz .gx-res-acc{display:flex;gap:.5rem;margin-top:.8rem;flex-wrap:wrap;justify-content:center}
.gx-raiz .gx-pager{display:flex;align-items:center;gap:.4rem} .gx-raiz .gx-pager button{width:38px;height:38px;border-radius:10px;border:1px solid var(--gx-borde2);background:var(--gx-panel2);color:var(--gx-txt);font-size:18px;cursor:pointer} .gx-raiz .gx-pager button:disabled{opacity:.4}
.gx-raiz .gx-mini-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:.8rem} .gx-raiz .gx-mini-kpis div{background:var(--gx-panel2);border-radius:12px;padding:.6rem;text-align:center}
.gx-raiz .gx-mini-kpis b{display:block;font-size:20px} .gx-raiz .gx-mini-kpis span{font-size:11.5px;color:var(--gx-txt2)} .gx-raiz .gx-mini-kpis .mal b{color:#ef4444}
.gx-raiz .gx-horas{margin-bottom:.6rem}
.gx-raiz .gx-ficha{display:flex;flex-wrap:wrap;align-items:center;gap:1rem}
.gx-raiz .gx-ficha-foto{position:relative} .gx-raiz .gx-foto-btn{position:absolute;right:-2px;bottom:-2px;width:32px;height:32px;border-radius:50%;background:var(--gx-ac);color:var(--gx-ac-txt);display:grid;place-items:center;cursor:pointer;border:3px solid var(--gx-panel)}
.gx-raiz .gx-ficha-d{flex:1;min-width:200px} .gx-raiz .gx-ficha-d h1{margin:0;font-size:24px;font-weight:800;font-family:inherit} .gx-raiz .gx-ficha-d p{margin:.3rem 0 0;display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
.gx-raiz .gx-ficha-acc{display:flex;flex-wrap:wrap;gap:.5rem;width:100%}
.gx-raiz .gx-mem{border-top:4px solid var(--k)} .gx-raiz .gx-mem small{display:block;color:var(--gx-txt2);font-size:12px;font-weight:600} .gx-raiz .gx-mem > b{display:inline-block;font-size:20px;margin:.2rem .5rem .2rem 0}
.gx-raiz .gx-num-g{display:block;font-size:28px;font-weight:800;margin:.2rem 0 .4rem}
.gx-raiz .gx-calor{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin:.3rem 0 .5rem} .gx-raiz .gx-calor i{aspect-ratio:1;border-radius:4px;background:var(--gx-panel2)} .gx-raiz .gx-calor i.si{background:var(--gx-ac)}
.gx-raiz .gx-app-socio{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap} .gx-raiz .gx-codigo{font-size:18px;letter-spacing:.14em;color:var(--gx-ac)}
.gx-raiz .gx-datos{display:grid;grid-template-columns:1fr 1fr;gap:1rem} .gx-raiz .gx-datos small{display:block;font-size:12px;color:var(--gx-txt2)} .gx-raiz .gx-datos b{font-size:14.5px}
.gx-raiz .gx-asis{display:flex;flex-wrap:wrap;gap:.4rem} .gx-raiz .gx-asis span{display:inline-flex;align-items:center;gap:.3rem;font-size:12.5px;background:var(--gx-panel2);border-radius:9px;padding:.3rem .6rem}
.gx-raiz .gx-planes{display:grid;gap:1rem;margin-bottom:1rem} .gx-raiz .gx-planes .gx-card{margin:0}
.gx-raiz .gx-plan-c{border-top:5px solid var(--k)} .gx-raiz .gx-plan-cab{display:flex;justify-content:space-between;align-items:flex-start} .gx-raiz .gx-plan-cab b{display:block;font-size:17px} .gx-raiz .gx-plan-cab small{color:var(--gx-txt2)}
.gx-raiz .gx-plan-cab strong{font-size:22px;color:var(--k)} .gx-raiz .gx-plan-n{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin:.9rem 0 .3rem}
.gx-raiz .gx-plan-n div{background:var(--gx-panel2);border-radius:11px;padding:.55rem .7rem} .gx-raiz .gx-plan-n b{display:block;font-size:19px} .gx-raiz .gx-plan-n span{font-size:11.5px;color:var(--gx-txt2)}
.gx-raiz .gx-colores,#gyModalRoot .gx-colores{display:flex;flex-wrap:wrap;gap:.5rem;margin:.4rem 0 .6rem;align-items:center} .gx-raiz .gx-colores button,#gyModalRoot .gx-colores button{width:38px;height:38px;border-radius:50%;border:3px solid transparent;cursor:pointer;box-shadow:0 0 0 1px var(--gx-borde2)}
.gx-raiz .gx-colores button.on,#gyModalRoot .gx-colores button.on{border-color:var(--gx-panel);box-shadow:0 0 0 3px var(--gx-txt)}
.gx-raiz .gx-color-otro{display:inline-flex!important;align-items:center;gap:.4rem;font-size:13px;font-weight:600;margin:0!important} .gx-raiz .gx-color-otro input{width:38px;height:38px;border:0;padding:0;background:none;cursor:pointer}
.gx-raiz .gx-logo{width:40px;height:40px;border-radius:12px;background:rgba(var(--gx-ac-rgb),.18);color:var(--gx-ac);display:grid;place-items:center;font-weight:900;overflow:hidden;flex:none} .gx-raiz .gx-logo img{width:100%;height:100%;object-fit:cover}
.gx-raiz .gx-logo-s{width:32px;height:32px;border-radius:9px;font-size:12px} .gx-raiz .gx-logo-g{width:84px;height:84px;font-size:26px;border-radius:18px} .gx-raiz .gx-logo-conf{display:flex;gap:1rem;align-items:center;margin:.3rem 0 1rem}
.gx-raiz .gx-notif-res{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem;margin-bottom:1rem}
.gx-raiz .gx-notif-chip{display:flex;align-items:center;gap:.55rem;background:var(--gx-panel);border:1px solid var(--gx-borde);border-left:4px solid var(--k);border-radius:12px;padding:.6rem .7rem;color:var(--gx-txt);font:inherit;font-size:12.5px;text-align:left;cursor:pointer}
.gx-raiz .gx-notif-chip svg{color:var(--k)} .gx-raiz .gx-notif-chip b{font-size:18px}
.gx-raiz .gx-sec-t{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gx-txt2);font-weight:800;margin:1.1rem 0 .5rem}
.gx-raiz .gx-menu{background:var(--gx-panel);border:1px solid var(--gx-borde);border-radius:16px;overflow:hidden;margin-bottom:.8rem}
.gx-raiz .gx-menu button{display:flex;align-items:center;gap:.8rem;width:100%;background:none;border:0;border-top:1px solid var(--gx-borde);color:inherit;font:inherit;font-size:14.5px;font-weight:600;text-align:left;padding:.85rem 1rem;cursor:pointer}
.gx-raiz .gx-menu button:first-child{border-top:0} .gx-raiz .gx-menu button svg{color:var(--gx-ac)} .gx-raiz .gx-menu span{flex:1} .gx-raiz .gx-menu i{font-style:normal;color:var(--gx-txt2)}
.gx-raiz .gx-doc ol,.gx-raiz .gx-doc ul{padding-left:1.2rem} .gx-raiz .gx-doc li{margin:.45rem 0} .gx-raiz .gx-doc .nota{font-size:12.5px;color:var(--gx-txt2);border-top:1px solid var(--gx-borde);padding-top:.6rem}
.gx-raiz .gx-cargando{padding:4rem 0;text-align:center;color:var(--gx-txt2);display:flex;flex-direction:column;align-items:center;gap:.8rem}
.gx-raiz .gx-cargando span{width:28px;height:28px;border-radius:50%;border:3px solid var(--gx-borde2);border-top-color:var(--gx-ac);animation:gxgira .8s linear infinite}
@keyframes gxgira{to{transform:rotate(360deg)}}
.gx-raiz .gx-solo{padding:1rem}
.gx-raiz .gx-socio-app{padding:.5rem .9rem 1rem}
.gx-raiz .gx-mem-app{position:relative;border-radius:20px;padding:1.2rem 1.2rem 1.1rem;margin-bottom:1rem;color:#fff;background:linear-gradient(140deg,rgba(var(--k-rgb),.95),rgba(var(--k-rgb),.6) 55%,#111 130%);box-shadow:0 10px 30px rgba(var(--k-rgb),.25);overflow:hidden}
.gx-raiz .gx-mem-top{display:flex;align-items:center;gap:.6rem;font-weight:800;letter-spacing:.04em;margin-bottom:.8rem} .gx-raiz .gx-mem-top img{height:34px;width:34px;border-radius:9px;object-fit:cover;background:#fff} .gx-raiz .gx-mem-top span{flex:1}
.gx-raiz .gx-mem-top .gx-mem-foto{width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.8)}
.gx-raiz .gx-mem-app small{display:block;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.85} .gx-raiz .gx-mem-app > b{display:inline-block;font-size:26px;font-weight:800;margin:.15rem .5rem .2rem 0}
.gx-raiz .gx-mem-app .gx-pill{background:rgba(255,255,255,.92)!important} .gx-raiz .gx-mem-app p{margin:.4rem 0 0;font-size:14.5px;font-weight:600} .gx-raiz .gx-mem-num{position:absolute;right:1.2rem;bottom:1rem;font-size:12px;opacity:.85}
.gx-raiz .gx-anillo{text-align:center} .gx-raiz .gx-anillo small,.gx-raiz .gx-prox small{display:block;font-size:12px;color:var(--gx-txt2);font-weight:600} .gx-raiz .gx-anillo svg{width:100px;margin:.3rem auto 0;display:block}
.gx-raiz .gx-prox b{display:block;font-size:18px;margin-top:.6rem} .gx-raiz .gx-prox strong{display:block;font-size:24px;margin-top:.2rem} .gx-raiz .gx-prox em{display:block;font-style:normal;font-size:12.5px;margin-top:.3rem}
.gx-raiz .gx-qr{background:#fff;border-radius:16px;padding:12px;width:min(250px,78%);margin:.8rem auto .3rem} .gx-raiz .gx-qr svg{display:block;width:100%;height:auto}
#gyModalRoot{display:none;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif} #gyModalRoot.on{display:block;position:fixed;inset:0;z-index:1000}
#gyModalRoot .gx-modal-fondo{position:absolute;inset:0;background:rgba(0,0,0,.55)}
#gyModalRoot .gx-modal{position:absolute;left:0;right:0;bottom:0;max-height:92vh;display:flex;flex-direction:column;background:var(--gx-panel);color:var(--gx-txt);border-radius:22px 22px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.4);animation:gxsube .18s ease-out}
@keyframes gxsube{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
#gyModalRoot .gx-modal-cab{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.1rem .4rem} #gyModalRoot .gx-modal-cab b{font-size:17px}
#gyModalRoot .gx-modal-cuerpo{padding:.3rem 1.1rem 1rem;overflow:auto;font-size:14px} #gyModalRoot .gx-modal-cuerpo p{margin:.3rem 0}
#gyModalRoot .gx-modal-pie{display:flex;gap:.6rem;justify-content:flex-end;padding:.8rem 1.1rem calc(.9rem + env(safe-area-inset-bottom));border-top:1px solid var(--gx-borde)} #gyModalRoot .gx-modal-pie .gx-btn{flex:1}
#gyModalRoot .gx-planes-sel{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.5rem;margin-bottom:.4rem}
#gyModalRoot .gx-planes-sel button{text-align:left;border:2px solid var(--gx-borde2);border-top:5px solid var(--k);background:var(--gx-panel2);color:var(--gx-txt);border-radius:12px;padding:.6rem .7rem;font:inherit;cursor:pointer}
#gyModalRoot .gx-planes-sel button.on{border-color:var(--k);box-shadow:0 0 0 3px color-mix(in srgb,var(--k) 25%,transparent)} #gyModalRoot .gx-planes-sel b{display:block;font-size:14px} #gyModalRoot .gx-planes-sel span{display:block;font-size:17px;font-weight:800} #gyModalRoot .gx-planes-sel small{color:var(--gx-txt2)}
#gyModalRoot .gx-cobro-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.5rem;margin:.9rem 0 .2rem} #gyModalRoot .gx-cobro-res div{background:var(--gx-panel2);border-radius:11px;padding:.5rem .7rem}
#gyModalRoot .gx-cobro-res span{display:block;font-size:11.5px;color:var(--gx-txt2)} #gyModalRoot .gx-cobro-res b{font-size:16px} #gyModalRoot .gx-cobro-res .warn b{color:#f59e0b}
@media (min-width:640px){
  .gx-raiz .gx-kpis{grid-template-columns:repeat(4,1fr)} .gx-raiz .gx-kpis-2{grid-template-columns:repeat(2,1fr)} .gx-raiz .gx-kpis-3{grid-template-columns:repeat(3,1fr)} .gx-raiz .gx-kpis-5{grid-template-columns:repeat(5,1fr)}
  .gx-raiz .gx-form-2,#gyModalRoot .gx-form-2{grid-template-columns:1fr 1fr} .gx-raiz .gx-ancho2,#gyModalRoot .gx-ancho2{grid-column:1/-1}
  .gx-raiz .gx-col-md{display:table-cell} .gx-raiz .gx-planes{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))} .gx-raiz .gx-plan-n{grid-template-columns:repeat(4,1fr)}
  .gx-raiz .gx-notif-res{grid-template-columns:repeat(4,1fr)} .gx-raiz .gx-barra-filtros{flex-direction:row;align-items:center;justify-content:space-between}
  .gx-raiz .gx-datos{grid-template-columns:repeat(3,1fr)} .gx-raiz .gx-grid-3{grid-template-columns:repeat(3,1fr)}
  #gyModalRoot .gx-modal{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);border-radius:20px;animation:none} #gyModalRoot .gx-modal-pie .gx-btn{flex:none}
}
@media (min-width:1000px){
  #gymApp.gx-raiz{display:grid;grid-template-columns:248px minmax(0,1fr);padding-bottom:0}
  .gx-raiz .gx-lado{display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:auto;background:var(--gx-panel);border-right:1px solid var(--gx-borde);padding:1rem .8rem}
  .gx-raiz .gx-marca{display:flex;align-items:center;gap:.7rem;padding:.3rem .4rem 1rem;border-bottom:1px solid var(--gx-borde);margin-bottom:.4rem} .gx-raiz .gx-marca b{display:block;font-size:15px;line-height:1.2} .gx-raiz .gx-marca small{color:var(--gx-txt2);font-size:12px}
  .gx-raiz .gx-sec-lado{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gx-txt2);font-weight:800;padding:.9rem .6rem .35rem}
  .gx-raiz .gx-nav-i{display:flex;align-items:center;gap:.7rem;width:100%;border:0;background:none;color:var(--gx-txt2);font:inherit;font-size:14px;font-weight:600;padding:.58rem .7rem;border-radius:10px;cursor:pointer;text-align:left}
  .gx-raiz .gx-nav-i:hover{background:var(--gx-panel2);color:var(--gx-txt)} .gx-raiz .gx-nav-i.on{background:rgba(var(--gx-ac-rgb),.14);color:var(--gx-ac)} .gx-raiz .gx-nav-i span{flex:1}
  .gx-raiz .gx-badge{font-style:normal;font-size:11px;font-weight:800;background:#ef4444;color:#fff;border-radius:20px;padding:1px 7px}
  .gx-raiz .gx-lado-pie{margin-top:auto;padding:1rem .6rem 0;font-size:10.5px;color:var(--gx-txt2);letter-spacing:.14em;font-weight:800}
  .gx-raiz .gx-top{padding:.75rem 1.6rem} .gx-raiz .gx-top-marca{display:none} .gx-raiz .gx-buscar{display:flex} .gx-raiz .gx-top-acc{margin-left:auto} .gx-raiz .gx-solo-pc{display:inline-flex!important}
  .gx-raiz .gx-cuerpo{padding:1.4rem 1.6rem 2rem} .gx-raiz .gx-nav-movil{display:none}
  .gx-raiz .gx-grid-2{grid-template-columns:1fr 1fr} .gx-raiz .gx-acceso{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .gx-raiz .gx-titulo h1{font-size:26px}
}
`;
document.head.appendChild(css);
})();
