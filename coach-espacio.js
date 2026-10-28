/* ============================================================
   AETERION COACH — espacio de trabajo del entrenador
   Hoy · Clientes · Programas · Academia · Ganancias (+ Agenda y Mi cuenta)
   Usa las piezas de coach.js (window.__aetCoach). El servidor decide todo:
   el coach solo ve lo que cada cliente autorizó.
============================================================ */
(function () {
'use strict';
const K = window.__aetCoach; if (!K) return;
const { llamar, esc, money, fecha, fechaCorta, toast, avatar, nivelTxt, tarjetaSesion, chat, PERM, VISTAS, nombreCorto } = K;
const $ = (id) => document.getElementById(id);
const hoyMx = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const diasDesde = (f) => f ? Math.round((new Date(hoyMx() + 'T12:00:00') - new Date(String(f).slice(0, 10) + 'T12:00:00')) / 864e5) : null;
const e1rm = (kg, r) => (r > 0 && r <= 12 && kg > 0) ? kg * (1 + r / 30) : 0;
const redondea = (kg) => Math.max(2.5, Math.round(kg / 2.5) * 2.5);
const repsMedias = (txt) => { const m = String(txt || '').match(/\d+/g); if (!m) return 8; const a = m.map(Number); return Math.round((a[0] + (a[1] || a[0])) / 2); };
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
let CLIENTES = null;   // caché de coach_mis_clientes

/* ---------------- Marco: encabezado y navegación propios ---------------- */
const NAV = [['c-hoy', 'Hoy', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'],
  ['c-clientes', 'Clientes', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/>'],
  ['c-programas', 'Programas', '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'],
  ['c-agenda', 'Agenda', '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'],
  ['c-mas', 'Más', '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>']];
const RAIZ_DE = { 'c-ficha': 'c-clientes', 'c-invitar': 'c-clientes', 'c-editor': 'c-programas', 'c-academia': 'c-mas', 'c-doc': 'c-mas', 'c-ganancias': 'c-mas', 'c-vender': 'c-mas', 'c-casos': 'c-mas', 'c-bloqueados': 'c-mas', 'c-cuenta': 'c-mas', 'c-perfil': 'c-mas', 'c-publico': 'c-mas' };
window.__coachMarco = function (html, v) {
  const act = NAV.some((n) => n[0] === v.v) ? v.v : (RAIZ_DE[v.v] || 'c-hoy');
  return `<div class="cx-top"><span class="cx-logo">AETERION <b>COACH</b></span>
      <button class="cx-ico" data-c="cx-ir" data-x="c-cuenta" aria-label="Mi cuenta de coach"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/></svg></button>
      <button class="cx-salir" data-c="cx-salir">Mi entreno</button></div>
    <div class="cx-cuerpo">${!K.pilaVacia() && html.indexOf('class="co-atras"') < 0 ? '<button class="cx-atras" data-c="volver">‹ Volver</button>' : ''}${html}</div>
    <nav class="cx-nav" aria-label="Navegación del coach">${NAV.map(([k, n, ico]) => `<button class="${k === act ? 'on' : ''}" data-c="cx-tab" data-x="${k}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico}</svg><span>${n}</span></button>`).join('')}</nav>`;
};
window.__coachTrasPintar = function (v) {
  if (v.v === 'c-ficha' && v.tab === 'mensajes') { const m = $('coMsgs'); if (m) m.scrollTop = m.scrollHeight; }
  if (v.v === 'mi-coach' && v.ancla) { const el = $(v.ancla === 'mensajes' ? 'coSecMensajes' : 'coSecPrograma'); if (el) el.scrollIntoView({ block: 'start' }); const m = $('coMsgs'); if (m) m.scrollTop = m.scrollHeight; v.ancla = null; }
};
const titulo = (t, sub, extra) => `<div class="cx-titulo"><div><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${extra || ''}</div>`;
async function clientes(forzar) { if (!CLIENTES || forzar) CLIENTES = await llamar('coach_mis_clientes'); return CLIENTES; }
const esperado = (x) => ((x.programa && x.programa.dias) || 4) * 30 / 7;
const constancia = (x) => x.actividad ? Math.min(100, Math.round(x.actividad.n30 / esperado(x) * 100)) : null;

/* ---------------- HOY ---------------- */
VISTAS['c-hoy'] = async () => {
  await K.refrescar(); const E = K.est(), c = E.coach;
  if (!c || c.estado !== 'activo') { K.setVista({ v: 'solicitud' }); return VISTAS.solicitud(); }
  const [R] = await Promise.all([llamar('coach_resumen'), clientes(true)]);
  const d = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  let h = `<p class="cx-fecha">${esc(d.charAt(0).toUpperCase() + d.slice(1))}</p><h2 class="cx-hola">Hola, ${esc(nombreCorto(c.nombre_publico) || 'coach')}</h2>`;
  h += `<div class="cx-kpis"><div><b>${R.clientes}</b><span>Clientes</span></div><div><b>${R.constancia == null ? '—' : R.constancia + '%'}</b><span>Constancia</span></div><div><b>${money(R.ganado_mes)}</b><span>Este mes</span></div></div>`;
  const dias = c.membresia_hasta ? Math.ceil((new Date(c.membresia_hasta) - Date.now()) / 864e5) : null;
  if (dias != null && dias <= 7) h += `<div class="co-card co-aviso-card"><b>${dias > 0 ? `Tu membresía vence en ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Tu membresía venció'}</b><p>Renueva para seguir visible y cobrando.</p><button class="co-btn" data-c="pagar" data-x="mensual">Pagar ${money((E.precios || {}).mensual)}</button></div>`;
  const AL = { inactivo: (a) => [a.nunca ? `${a.nombre} no ha registrado entrenos` : `${a.nombre} no entrena hace ${a.dias} días`, 'Mándale un mensaje antes de que se desanime', 'mensajes'],
    mensaje: (a) => [`${a.nombre} te escribió`, `${a.n} ${a.n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`, 'mensajes'],
    solicitud: (a) => [`${a.nombre} quiere entrenar contigo`, 'Acepta o rechaza su solicitud', null],
    sin_programa: (a) => [`${a.nombre} no tiene programa`, 'Asígnale uno desde la base Aeterion', 'programa'] };
  const orden = { mensaje: 0, solicitud: 1, inactivo: 2, sin_programa: 3 };
  const al = R.alertas.slice().sort((a, b) => orden[a.tipo] - orden[b.tipo]);
  h += '<div class="co-sec">Necesitan tu atención</div>';
  h += al.length ? al.slice(0, 8).map((a) => { const [t, s, tab] = AL[a.tipo](a); return `<button class="cx-alerta cx-al-${a.tipo}" data-c="${a.tipo === 'solicitud' ? 'cx-ir' : 'cx-ficha'}" data-x="${a.tipo === 'solicitud' ? 'c-clientes' : esc(a.cliente_id)}" data-t="${tab || ''}">${avatar(a.nombre)}<div><b>${esc(t)}</b><span>${esc(s)}</span></div><i>›</i></button>`; }).join('') + (al.length > 8 ? `<p class="co-peq">y ${al.length - 8} más en Clientes.</p>` : '')
    : `<div class="co-card co-vacio"><b>Todo en orden</b><p>${R.clientes ? 'Tus clientes van al día.' : 'Invita a tu primer cliente para empezar.'}</p>${R.clientes ? '' : '<button class="co-btn" data-c="cx-ir" data-x="c-invitar">Invitar cliente</button>'}</div>`;
  h += `<div class="cx-sec2"><span class="co-sec" style="margin:0">Sesiones de hoy</span><button class="co-link cx-link" data-c="cx-ir" data-x="c-agenda">Ver agenda</button></div>`;
  h += R.sesiones_hoy.length ? '<div class="co-card">' + R.sesiones_hoy.map((s) => `<div class="cx-ses"><b>${new Date(s.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</b><div><span>${esc(s.nombre)}${s.nota ? ' · ' + esc(s.nota) : ''}</span><small>${s.modalidad === 'linea' ? 'En línea' : 'Presencial'} · ${s.estado === 'por_pagar' ? 'por pagar' : s.estado === 'dada' ? 'dada' : 'pagada'}</small></div></div>`).join('') + '</div>' : '<p class="co-peq">No tienes sesiones hoy.</p>';
  h += `<div class="cx-rapidos"><button data-c="cx-ir" data-x="c-invitar"><span>＋</span>Invitar cliente</button><button data-c="cx-nuevo-prog"><span>📋</span>Nuevo programa</button><button data-c="cx-ir" data-x="c-agenda"><span>🗓️</span>Agenda</button></div>`;
  if (!c.cobros_habilitados) h += `<div class="co-card co-aviso-card"><b>Activa tus cobros</b><p>Conecta tu cuenta para recibir el pago de tus sesiones directo en tu banco.</p><button class="co-btn co-sec-btn" data-c="cobros">Conectar cuenta de cobro</button></div>`;
  return h;
};

/* ---------------- CLIENTES ---------------- */
VISTAS['c-clientes'] = async (v) => {
  const L = await clientes(true); const f = v.f || 'todos';
  const act = L.filter((x) => x.estado === 'activo'), pend = L.filter((x) => x.estado === 'pendiente');
  const inact = act.filter((x) => x.actividad && (diasDesde(x.actividad.ultimo) == null || diasDesde(x.actividad.ultimo) >= 5));
  const F = [['todos', 'Todos', act.length], ['presencial', 'Presencial', act.filter((x) => x.modalidad === 'presencial').length], ['linea', 'En línea', act.filter((x) => x.modalidad === 'linea').length], ['inactivos', 'Inactivos', inact.length], ['pendientes', 'Solicitudes', pend.length]];
  let h = titulo('Tus clientes', null, '<button class="co-btn co-mini" data-c="cx-ir" data-x="c-invitar">Invitar cliente</button>');
  h += `<div class="co-chips co-scroll">${F.map(([k, n, c]) => `<button class="co-chip ${f === k ? 'on' : ''}" data-c="cx-filtro" data-x="${k}">${n} ${c}</button>`).join('')}</div>`;
  if (f === 'pendientes') {
    h += pend.length ? pend.map((x) => `<div class="co-card"><div class="co-persona">${avatar(x.nombre)}<div><b>${esc(x.nombre)}</b><p>${x.modalidad === 'linea' ? 'En línea' : 'Presencial'} · comparte ${K.resumenPermisos(x.permisos)}</p></div></div>
      <div class="co-fila"><button class="co-btn" data-c="responder" data-x="${x.vinculo}" data-n="1">Aceptar</button><button class="co-btn co-sec-btn" data-c="responder" data-x="${x.vinculo}" data-n="0">Rechazar</button></div></div>`).join('') : '<p class="co-peq">No tienes solicitudes.</p>';
    return h;
  }
  const lista = f === 'inactivos' ? inact : f === 'todos' ? act : act.filter((x) => x.modalidad === f);
  if (!lista.length) return h + `<div class="co-card co-vacio"><b>${act.length ? 'Nadie en este filtro' : 'Aún no tienes clientes'}</b><p>${act.length ? '' : 'Mándales tu enlace de invitación: entran directo contigo y eligen qué datos te comparten.'}</p>${act.length ? '' : '<button class="co-btn" data-c="cx-ir" data-x="c-invitar">Invitar cliente</button>'}</div>`;
  h += '<div class="co-card cx-lista">' + lista.map((x) => {
    const c = constancia(x), dd = x.actividad ? diasDesde(x.actividad.ultimo) : null;
    const ult = !x.actividad ? 'no comparte sus entrenos' : dd == null ? 'sin entrenos registrados' : dd === 0 ? 'entrenó hoy' : dd === 1 ? 'entrenó ayer' : `hace ${dd} días`;
    const col = c == null ? 'var(--gris,#999)' : c >= 75 ? '#4cc38a' : c >= 50 ? '#c9a84c' : '#e5866f';
    return `<button class="cx-cli" data-c="cx-ficha" data-x="${esc(x.cliente_id)}">${avatar(x.nombre)}<div class="cx-cli-d"><b>${esc(x.nombre)}<em class="cx-md">${x.modalidad === 'linea' ? 'En línea' : 'Presencial'}</em>${x.no_leidos ? `<em class="cx-nl">${x.no_leidos}</em>` : ''}</b>
      <span>${x.programa ? esc(x.programa.nombre) : 'Sin programa'} · ${ult}</span>${c != null ? `<div class="cx-bar"><i style="width:${c}%;background:${col}"></i></div>` : ''}</div>${c != null ? `<strong style="color:${col}">${c}%</strong>` : ''}</button>`;
  }).join('') + '</div><p class="co-peq">Constancia: entrenos de los últimos 30 días frente a los días de su programa.</p>';
  return h;
};

VISTAS['c-invitar'] = async () => {
  const c = K.est().coach || {};
  const url = location.origin + location.pathname + '?modo=app&coach=' + encodeURIComponent(c.codigo || '');
  const msg = `Entrena conmigo en Aeterion. Abre este enlace, crea tu cuenta y quedas vinculado conmigo: ${url}`;
  return titulo('Invitar cliente', 'Tu cliente entra directo contigo y decide qué datos te comparte') +
    `<div class="co-card cx-codigo"><span>Tu código</span><b>${esc(c.codigo || '—')}</b><button class="co-btn co-sec-btn co-mini" data-c="copiar" data-x="${esc(c.codigo || '')}">Copiar código</button></div>
    <div class="co-card"><b>Tu enlace</b><p class="cx-url">${esc(url)}</p>
      <a class="co-btn co-btn-grande cx-wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviar por WhatsApp</a><div class="co-fila"><button class="co-btn co-sec-btn" data-c="cx-compartir" data-x="${esc(url)}">Compartir</button><button class="co-btn co-sec-btn" data-c="copiar" data-x="${esc(url)}">Copiar</button></div></div>
    <div class="co-card"><b>Qué pasa después</b><ol class="co-pasos"><li>Tu cliente abre el enlace y crea su cuenta gratis (o entra a la suya).</li><li>Ve tu perfil, elige si entrenará presencial o en línea y qué datos te comparte.</li><li>Aparece en tus clientes. Asígnale un programa y dale seguimiento desde aquí.</li></ol>
      <p class="co-peq">Si ya tiene la app, puede escribir tu código en Cuenta › Coaches.</p></div>`;
};

/* ---------------- FICHA DEL CLIENTE ---------------- */
function logDe(D) { // une el registro de rutinas de la app con los registros a mano (mismo criterio que la app)
  const parse = (k, def) => { try { const x = JSON.parse(D[k]); return x == null ? def : x; } catch (e) { return def; } };
  const out = [];
  const rs = parse('gym_registro_series', {});
  if (rs && typeof rs === 'object') Object.keys(rs).forEach((n) => (Array.isArray(rs[n]) ? rs[n] : []).forEach((r) => {
    const series = (r.sets || []).map((x) => ({ r: +x.reps || 0, kg: +x.peso || 0 })).filter((x) => x.r > 0);
    if (series.length && r.fecha) out.push({ fecha: String(r.fecha).slice(0, 10), ej: n, series });
  }));
  (parse('aet_log_entreno', []) || []).forEach((l) => { if (l && l.ej && Array.isArray(l.series)) out.push({ fecha: l.fecha, ej: l.ej, series: l.series }); });
  return out.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
const mejor = (l) => Math.max(0, ...l.series.map((s) => e1rm(s.kg, s.r)));
function datosCargas(D) { // por ejercicio: mejor 1RM estimado de las 6 semanas previas a su último registro
  const g = {}; logDe(D).forEach((l) => { const v = mejor(l); if (v > 0) (g[norm(l.ej)] = g[norm(l.ej)] || []).push({ f: String(l.fecha).slice(0, 10), v }); });
  const m = {};
  Object.keys(g).forEach((k) => { const L = g[k].sort((a, b) => b.f.localeCompare(a.f)); const lim = new Date(L[0].f + 'T12:00:00'); lim.setDate(lim.getDate() - 42); const desde = lim.toISOString().slice(0, 10);
    m[k] = { v: Math.max(...L.filter((x) => x.f >= desde).map((x) => x.v)), fecha: L[0].f }; });
  return m;
}

VISTAS['c-ficha'] = async (v) => {
  const L = await clientes(); const x = L.find((c) => c.cliente_id === v.id);
  if (!x || x.estado !== 'activo') { CLIENTES = null; return titulo('Cliente') + '<div class="co-card"><b>Ya no tienes acceso a este cliente</b><p>Terminó el vínculo o retiró sus permisos.</p></div>'; }
  v.vinculo = x.vinculo; v.nombre = x.nombre;
  const tab = v.tab || 'resumen';
  const TABS = [['resumen', 'Resumen'], ['mensajes', 'Chat' + (x.no_leidos ? ` (${x.no_leidos})` : '')], ['entrenos', 'Entrenos'], ['medidas', 'Medidas'], ['plan', 'Alimentación'], ['evaluacion', 'Evaluación'], ['notas', 'Notas']];
  let h = `<div class="cx-ficha-cab">${avatar(x.nombre, true)}<div><h2>${esc(x.nombre)}</h2><p>${x.modalidad === 'linea' ? 'En línea' : 'Presencial'} · cliente desde ${fechaCorta(x.desde)}</p></div></div>
    <div class="cx-tabs">${TABS.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-c="cx-tabficha" data-x="${k}">${n}</button>`).join('')}</div>`;
  const p = x.permisos || {};
  if (tab === 'mensajes') {
    const msgs = await llamar('mensajes_listar', { p_vinculo: x.vinculo }); x.no_leidos = 0;
    return h + chat(msgs, x.vinculo) + '<p class="co-peq">Los mensajes son entre tú y tu cliente. Para algo médico, refiere a un profesional de la salud.</p>';
  }
  if (tab === 'notas') {
    const notas = await llamar('coach_notas_listar', { p_cliente: x.cliente_id });
    return h + `<div class="co-card"><b>Notas privadas</b><p class="co-peq">Solo tú las ves. Úsalas para lo que necesitas recordar: molestias, preferencias, acuerdos.</p>
      <textarea class="co-in" id="cxNota" rows="3" maxlength="1000" placeholder="Ej. Molestia leve en rodilla izquierda al bajar escaleras"></textarea><button class="co-btn" data-c="cx-nota" data-x="${esc(x.cliente_id)}">Guardar nota</button></div>` +
      notas.map((n) => `<div class="co-card cx-nota"><p>${esc(n.texto)}</p><div class="co-top"><span class="co-peq">${fecha(n.fecha)}</span><button class="co-link" data-c="cx-nota-borrar" data-x="${n.id}">Borrar</button></div></div>`).join('');
  }
  if ((tab === 'plan' || tab === 'evaluacion') && window.__coachFichaTab) return h + await window.__coachFichaTab(tab, x, v);
  const d = await llamar('coach_cliente_datos', { p_cliente: x.cliente_id }); const D = d.datos || {};
  const parse = (k, def) => { try { const r = JSON.parse(D[k]); return r == null ? def : r; } catch (e) { return def; } };
  if (tab === 'entrenos') {
    if (!p.entrenos) return h + sinPermiso('sus entrenos');
    const log = logDe(D).slice(0, 40);
    return h + (log.length ? '<div class="co-card">' + log.map((l) => `<div class="cx-log"><div><b>${esc(l.ej)}</b><span>${esc(l.fecha)}</span></div><em>${l.series.map((s) => `${s.r}×${s.kg}`).join('  ')}</em></div>`).join('') + '</div><p class="co-peq">Repeticiones × kg de cada serie, del registro de tu cliente.</p>' : '<div class="co-card co-vacio"><b>Sin entrenos registrados</b><p>Cuando registre series en la app las verás aquí.</p></div>');
  }
  if (tab === 'medidas') {
    if (!p.medidas) return h + sinPermiso('su peso y medidas');
    const med = parse('medidas_historial', []).slice().reverse();
    if (!med.length) return h + '<div class="co-card co-vacio"><b>Sin medidas</b><p>Pídele que registre su peso en la app.</p></div>';
    const campos = [...new Set(med.flatMap((m) => Object.keys(m).filter((k) => k !== 'fecha' && typeof m[k] === 'number')))].slice(0, 5);
    return h + `<div class="co-card cx-tabla"><table><thead><tr><th>Fecha</th>${campos.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${med.slice(0, 30).map((m) => `<tr><td>${esc(m.fecha)}</td>${campos.map((k) => `<td>${m[k] != null ? esc(m[k]) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  // Resumen
  const c = constancia(x), med = p.medidas ? parse('medidas_historial', []) : [];
  const pesoIni = med.find((m) => typeof m.peso === 'number'), pesoFin = med.slice().reverse().find((m) => typeof m.peso === 'number');
  const dPeso = pesoIni && pesoFin && pesoIni !== pesoFin ? (pesoFin.peso - pesoIni.peso) : null;
  const metas = parse('aet_metas', null);
  if (metas && typeof metas === 'object' && (metas.objetivo || metas.texto)) h += `<div class="co-card"><b>Objetivo</b><p>${esc(metas.objetivo || metas.texto)}</p></div>`;
  h += `<div class="cx-kpis"><div><b>${c == null ? '—' : c + '%'}</b><span>Constancia</span></div><div><b>${x.actividad ? x.actividad.n30 : '—'}</b><span>Entrenos 30 d</span></div><div><b>${dPeso == null ? '—' : (dPeso > 0 ? '+' : '') + dPeso.toFixed(1) + ' kg'}</b><span>Peso</span></div></div>`;
  if (p.entrenos) {
    const log = logDe(D); const cuenta = {}; log.forEach((l) => { cuenta[l.ej] = (cuenta[l.ej] || 0) + 1; });
    const top = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
    if (top && new Set(log.filter((l) => l.ej === top).map((l) => semana(l.fecha))).size < 2) h += `<div class="co-card"><b>${esc(top)} · fuerza estimada</b><p class="co-peq">Con dos semanas o más de registros verás aquí la tendencia de su fuerza.</p></div>`;
    else if (top) {
      const sem = {}; log.filter((l) => l.ej === top).forEach((l) => { const w = semana(l.fecha); sem[w] = Math.max(sem[w] || 0, mejor(l)); });
      const ks = Object.keys(sem).sort().slice(-8), mx = Math.max(...ks.map((k) => sem[k]), 1);
      const ini = sem[ks[0]], fin = sem[ks[ks.length - 1]];
      h += `<div class="co-card"><div class="co-top"><b>${esc(top)} · fuerza estimada</b><span>${ks.length > 1 ? (fin - ini >= 0 ? '+' : '') + (fin - ini).toFixed(1) + ' kg' : ''}</span></div>
        <div class="cx-barras">${ks.map((k, i) => `<div><i style="height:${Math.max(6, sem[k] / mx * 100)}%" title="${sem[k].toFixed(1)} kg"></i><span>S${i + 1}</span></div>`).join('')}</div>
        <p class="co-peq">1RM estimado por semana (fórmula de Epley) con lo que registró. Útil para ver tendencia, no es una prueba de máximo.</p></div>`;
    }
  }
  h += `<div class="co-card"><div class="co-top"><b>Programa</b><span>${x.programa ? x.programa.dias + ' días' : ''}</span></div><p>${x.programa ? esc(x.programa.nombre) : 'Todavía no tiene programa asignado.'}</p>
    <button class="co-btn ${x.programa ? 'co-sec-btn' : ''}" data-c="cx-prog-cliente" data-x="${esc(x.cliente_id)}">${x.programa ? 'Ajustar programa' : 'Asignar programa'}</button></div>`;
  h += `<div class="co-card"><b>Lo que ${esc(nombreCorto(x.nombre))} comparte contigo</b>${PERM.map(([k, t]) => `<div class="cx-perm"><span>${t}</span><b class="${p[k] ? 'si' : 'no'}">${p[k] ? 'Sí' : 'No'}</b></div>`).join('')}<p class="co-peq">Solo tu cliente puede cambiar estos permisos.</p></div>`;
  h += `<div class="cx-acciones"><button class="co-btn" data-c="cx-tabficha" data-x="mensajes">Mensaje</button><button class="co-btn co-sec-btn" data-c="cx-sesion" data-x="${x.vinculo}">Proponer sesión</button></div>`;
  if (v.sesion) {
    const t = K.est().coach || {};
    h += `<div class="co-card" id="cxSesion"><b>Proponer una sesión</b><div class="co-doble"><div><label class="co-lab">Fecha y hora</label><input class="co-in" id="csInicio" type="datetime-local"></div><div><label class="co-lab">Minutos</label><input class="co-in" id="csMin" type="number" value="60" min="15" max="240"></div></div>
      <label class="co-lab">Precio</label><input class="co-in" id="csPrecio" type="number" value="${t.precio_sesion || ''}" max="${t.tope_sesion || ''}"><label class="co-lab">Nota <span class="co-peq">(opcional)</span></label><input class="co-in" id="csNota" maxlength="200" placeholder="Ej. Pierna y técnica de sentadilla">
      <p class="co-peq">Tu cliente la paga en la app para confirmarla.</p><button class="co-btn co-btn-grande" data-c="crear-sesion" data-x="${x.vinculo}">Enviar propuesta</button></div>`;
  }
  if (window.__coachFichaResumen) h += await window.__coachFichaResumen(x).catch(() => '');
  h += `<button class="co-btn co-peligro" data-c="terminar" data-x="${x.vinculo}">Terminar vínculo</button>`;
  return h;
};
function semana(f) { const d = new Date(String(f).slice(0, 10) + 'T12:00:00'); const j = new Date(d); j.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return j.toISOString().slice(0, 10); }
const sinPermiso = (q) => `<div class="co-card co-vacio"><b>No comparte ${q}</b><p>Solo tu cliente puede activarlo desde su app. Puedes pedírselo por mensaje si te ayuda a darle mejor seguimiento.</p></div>`;

/* ---------------- PROGRAMAS ---------------- */
const BASES = [['entrenamiento', 'GYM Hombre 5 días', 'Fuerza e hipertrofia', 'RUTINA_H5'], ['h3', 'GYM Hombre 3 días', 'Cuerpo completo y fuerza', 'RUTINA_H3'], ['m5', 'GYM Mujer 5 días', 'Glúteo y tren inferior', 'RUTINA_M5']];
function rutinaGlobal(n) { try { return n === 'RUTINA_H5' ? RUTINA_H5 : n === 'RUTINA_H3' ? RUTINA_H3 : n === 'RUTINA_M5' ? RUTINA_M5 : null; } catch (e) { return null; } } // eslint-disable-line no-undef
const limpiaTxt = (t) => String(t || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
async function baseComoDias(base) {
  const b = BASES.find((x) => x[0] === base); if (!b) return null;
  if (!rutinaGlobal(b[3]) && typeof cargarModuloPremium === 'function') await cargarModuloPremium('programa');
  const R = rutinaGlobal(b[3]); if (!R) return null;
  return Object.keys(R).filter((k) => R[k] && Array.isArray(R[k].ejercicios)).slice(0, 7).map((k, i) => {
    const d = R[k], nom = limpiaTxt(d.titulo || d.nombre || d.dia || d.subtitulo || ('Día ' + (i + 1)));
    const ej = d.ejercicios.slice(0, 15).map((e) => { const b0 = e._b || e; const s = parseInt(String(b0.series).match(/\d+/) || [3], 10); return { n: limpiaTxt(e.nombre).slice(0, 60), s: Math.min(10, Math.max(1, s || 3)), r: limpiaTxt(b0.reps || e.reps || '8–12').slice(0, 15), rir: 2, kg: null, origen: 'motor' }; }).filter((e) => e.n.length >= 2);
    return { nombre: ('Día ' + (i + 1) + (nom && !/^d[ií]a\s*\d/i.test(nom) ? ' · ' + nom : '')).slice(0, 60), ejercicios: ej };
  }).filter((d) => d.ejercicios.length);
}

VISTAS['c-programas'] = async (v) => {
  const P = await llamar('coach_programas_listar'); const seg = v.seg || 'base';
  let h = titulo('Programas');
  h += `<div class="co-seg">${[['base', 'Base Aeterion'], ['plantillas', 'Mis plantillas ' + P.plantillas.length], ['asignados', 'Asignados ' + P.asignados.length]].map(([k, n]) => `<button class="${seg === k ? 'on' : ''}" data-c="cx-seg" data-x="${k}">${n}</button>`).join('')}</div>`;
  if (seg === 'base') {
    h += '<p class="co-peq">Parte de un programa de la app. El motor Aeterion trae ejercicios, series y repeticiones; tú decides los ajustes finos y lo asignas.</p>';
    h += BASES.map(([k, n, s]) => `<button class="cx-base" data-c="cx-desde-base" data-x="${k}"><b>${n}</b><span>${s}</span><i>Personalizar ›</i></button>`).join('');
    h += '<button class="cx-base" data-c="cx-nuevo-prog"><b>Desde cero</b><span>Arma tu propio programa</span><i>Crear ›</i></button>';
    h += '<p class="co-peq">Los programas MMA de la app se usan tal cual desde Entrenar; pronto también podrás personalizarlos aquí.</p>';
  } else {
    const L = seg === 'plantillas' ? P.plantillas : P.asignados;
    h += L.length ? L.map((p) => `<div class="co-card"><div class="co-top"><b>${esc(p.nombre)}</b><span>${p.dias.length} ${p.dias.length === 1 ? 'día' : 'días'}</span></div>
      <p class="co-peq">${p.cliente ? 'Para ' + esc(p.cliente) + ' · ' : ''}actualizado ${fechaCorta(p.actualizado_en)}</p>
      <div class="co-fila"><button class="co-btn co-sec-btn co-mini" data-c="cx-editar-prog" data-x="${p.id}" data-s="${seg}">Editar</button>${seg === 'plantillas' ? `<button class="co-btn co-sec-btn co-mini" data-c="cx-asignar-plantilla" data-x="${p.id}">Asignar</button>` : ''}<button class="co-link" data-c="cx-borrar-prog" data-x="${p.id}">${seg === 'plantillas' ? 'Borrar' : 'Quitar'}</button></div></div>`).join('')
      : `<div class="co-card co-vacio"><b>${seg === 'plantillas' ? 'Aún no tienes plantillas' : 'Nadie tiene programa asignado'}</b><p>Empieza desde la base Aeterion.</p></div>`;
    v.lista = L;
  }
  return h;
};

VISTAS['c-editor'] = async (v) => {
  const P = v.prog; const L = (await clientes()).filter((x) => x.estado === 'activo');
  const d = Math.min(v.dia || 0, P.dias.length - 1); const dia = P.dias[d];
  const cli = L.find((x) => x.cliente_id === P.cliente_id);
  let h = titulo(P.id ? 'Editar programa' : 'Nuevo programa', P.base ? 'Base: ' + esc((BASES.find((b) => b[0] === P.base) || [])[1] || P.base) : 'Desde cero');
  h += `<label class="co-lab">Nombre</label><input class="co-in" id="cxPNom" maxlength="60" value="${esc(P.nombre)}">
    <label class="co-lab">Para</label><select class="co-in" id="cxPPara" ${P.id && P.cliente_id ? 'disabled' : ''}><option value="">Plantilla (sin asignar)</option>${L.map((x) => `<option value="${esc(x.cliente_id)}" ${x.cliente_id === P.cliente_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>`;
  if (cli) h += cli.permisos && cli.permisos.entrenos
    ? `<div class="co-card cx-motor"><b>Motor de cargas</b><p>Calcula los kilos de cada ejercicio con las marcas que ${esc(nombreCorto(cli.nombre))} registró, para sus repeticiones y la reserva que pongas. Tú puedes cambiar cualquier número.</p><button class="co-btn co-sec-btn co-mini" data-c="cx-motor">Calcular cargas</button></div>`
    : `<p class="co-peq">${esc(nombreCorto(cli.nombre))} no comparte sus entrenos, así que no se pueden calcular cargas con sus marcas.</p>`;
  h += `<div class="co-chips co-scroll" style="margin-top:1rem">${P.dias.map((x, i) => `<button class="co-chip ${i === d ? 'on' : ''}" data-c="cx-dia" data-x="${i}">${esc(x.nombre.split(' · ')[0] || 'Día ' + (i + 1))}</button>`).join('')}${P.dias.length < 7 ? '<button class="co-chip" data-c="cx-dia-mas">＋ Día</button>' : ''}</div>`;
  h += `<div class="co-card cx-editor"><div class="co-fila"><input class="co-in" id="cxDNom" maxlength="60" value="${esc(dia.nombre)}" style="flex:1">${P.dias.length > 1 ? '<button class="co-link" data-c="cx-dia-borrar">Borrar día</button>' : ''}</div>`;
  h += dia.ejercicios.map((e, i) => `<div class="cx-ej" data-i="${i}">
      <div class="co-fila"><input class="co-in cx-n" maxlength="60" value="${esc(e.n)}" aria-label="Ejercicio"><span class="cx-pill ${e.origen === 'motor' ? 'motor' : 'coach'}">${e.origen === 'motor' ? 'Motor' : 'Coach'}</span></div>
      <div class="cx-nums"><label>Series<input class="co-in cx-s" type="number" min="1" max="10" value="${e.s}"></label><label>Reps<input class="co-in cx-r" maxlength="15" value="${esc(e.r)}"></label><label>Reserva<input class="co-in cx-rir" type="number" min="0" max="5" value="${e.rir ?? ''}"></label><label>Kg<input class="co-in cx-kg" type="number" min="0" max="1000" step="0.5" value="${e.kg ?? ''}"></label></div>
      <input class="co-in cx-nota" maxlength="120" placeholder="Nota para tu cliente (opcional)" value="${esc(e.nota || '')}">
      <div class="cx-ej-acc"><button data-c="cx-ej-mover" data-x="${i}" data-n="-1" aria-label="Subir">↑</button><button data-c="cx-ej-mover" data-x="${i}" data-n="1" aria-label="Bajar">↓</button><button data-c="cx-ej-borrar" data-x="${i}" aria-label="Quitar">Quitar</button></div></div>`).join('');
  h += `${dia.ejercicios.length < 15 ? '<button class="co-btn co-sec-btn co-btn-grande" data-c="cx-ej-mas">＋ Agregar ejercicio</button>' : ''}</div>
    <label class="co-lab">Indicaciones generales <span class="co-peq">(opcional)</span></label><textarea class="co-in" id="cxPNota" rows="2" maxlength="400" placeholder="Ej. Calienta 10 minutos. Si algo duele, para y avísame.">${esc(P.nota || '')}</textarea>
    <p class="co-peq">Reserva = repeticiones que deben quedar en el tanque (RIR). Kg vacío = tu cliente elige el peso.</p>
    <div class="cx-acciones"><button class="co-btn" data-c="cx-guardar-prog" data-x="asignar">${P.cliente_id ? 'Asignar a ' + esc(nombreCorto((cli || {}).nombre || 'cliente')) : 'Guardar plantilla'}</button>${P.cliente_id && !P.id ? '<button class="co-btn co-sec-btn" data-c="cx-guardar-prog" data-x="plantilla">Guardar también como plantilla</button>' : ''}</div>`;
  return h;
};
function leerEditor(v) { // copia lo escrito al programa en memoria antes de redibujar
  const P = v.prog; if (!P || !$('cxPNom')) return;
  P.nombre = $('cxPNom').value; const para = $('cxPPara'); if (para && !para.disabled) P.cliente_id = para.value || null;
  const nota = $('cxPNota'); if (nota) P.nota = nota.value;
  const d = P.dias[Math.min(v.dia || 0, P.dias.length - 1)]; d.nombre = $('cxDNom').value;
  document.querySelectorAll('.cx-ej').forEach((el) => {
    const e = d.ejercicios[Number(el.dataset.i)]; if (!e) return;
    const val = (c) => el.querySelector(c).value;
    const nuevo = { n: val('.cx-n').trim(), s: parseInt(val('.cx-s'), 10) || 0, r: val('.cx-r').trim(), rir: val('.cx-rir') === '' ? null : parseInt(val('.cx-rir'), 10), kg: val('.cx-kg') === '' ? null : Number(val('.cx-kg')), nota: val('.cx-nota').trim() };
    if (e.origen === 'motor' && (nuevo.n !== e.n || nuevo.s !== e.s || nuevo.r !== e.r || nuevo.kg !== e.kg)) nuevo.origen = 'coach'; else nuevo.origen = e.origen || 'coach';
    Object.assign(e, nuevo); if (!e.nota) delete e.nota;
  });
}
function validarPrograma(P) {
  if ((P.nombre || '').trim().length < 2) return 'Ponle nombre al programa.';
  for (const d of P.dias) {
    if (!(d.nombre || '').trim()) return 'Cada día necesita nombre.';
    if (!d.ejercicios.length) return `«${d.nombre}» no tiene ejercicios.`;
    for (const e of d.ejercicios) {
      if ((e.n || '').length < 2) return 'Hay un ejercicio sin nombre.';
      if (!(e.s >= 1 && e.s <= 10)) return `Series de «${e.n}»: de 1 a 10.`;
      if (!e.r) return `Repeticiones de «${e.n}».`;
      if (e.rir != null && !(e.rir >= 0 && e.rir <= 5)) return `Reserva de «${e.n}»: de 0 a 5.`;
      if (e.kg != null && !(e.kg >= 0 && e.kg <= 1000)) return `Kg de «${e.n}».`;
    }
  }
  return null;
}

/* ---------------- ACADEMIA y MATERIAL ---------------- */
const MODULOS = [['Programación basada en evidencia', 'Volumen, intensidad, reserva (RIR) y progresión'], ['El motor Aeterion por dentro', 'Cómo calcula cargas y cuándo ajustarlo'], ['Adherencia y cambio de hábitos', 'Constancia, motivación y el módulo Mente'], ['Nutrición dentro de tu alcance', 'Orientar hábitos sin salir de tu competencia'], ['Suplementación con evidencia', 'Qué funciona, qué no y qué no puedes prometer'], ['Seguridad y cuándo referir', 'Señales de alerta, adultos mayores, embarazo, dolor'], ['Acondicionamiento para combate', 'MMA y deportes de contacto'], ['El negocio del entrenador', 'Captar, retener, precios y ética']];
const DOCS = {
  'primera-sesion': ['Guion de la primera sesión', 'Para que tu cliente salga con claridad y confianza', `
<h4>Antes de entrenar (15 min)</h4><ol><li><b>Objetivo concreto.</b> Pregunta qué quiere lograr y para cuándo. Conviértelo en algo medible: «subir de 40 a 60 kg en sentadilla» o «entrenar 3 veces por semana durante 8 semanas».</li><li><b>Historial.</b> Experiencia entrenando, lesiones, cirugías, medicamentos y condiciones de salud. Usa la lista «Preguntas de seguridad».</li><li><b>Agenda real.</b> Cuántos días puede entrenar de verdad, cuánto tiempo y dónde (gimnasio o casa, qué equipo tiene).</li><li><b>Acuerdos.</b> Explica cómo cobras las sesiones (siempre en la app), tu política de cancelación (24 h) y cómo te comunicarás.</li></ol>
<h4>Evaluación de movimiento (20 min)</h4><ul><li>Sentadilla sin peso, bisagra de cadera, lagartija (o en pared), remo, plancha.</li><li>Busca rango de movimiento, control y dolor. Anota lo que veas en sus notas privadas.</li><li>Si hay dolor que no cede o que aumenta, no lo fuerces: refiere.</li></ul>
<h4>Primer entreno (20 min)</h4><ul><li>Pocos ejercicios, técnica primero y cargas conservadoras (deja 3 o más repeticiones en reserva).</li><li>Enséñale a medir la reserva: «¿cuántas más podrías haber hecho con buena técnica?».</li></ul>
<h4>Cierre (5 min)</h4><ul><li>Instálale la app, revisen juntos qué datos te comparte y asígnale su programa.</li><li>Agenda la siguiente sesión antes de que se vaya.</li></ul>`],
  'seguridad': ['Preguntas de seguridad antes de entrenar', 'Detecta quién necesita autorización médica primero', `
<p>Haz estas preguntas a todo cliente nuevo y cuando su salud cambie. Si responde «sí» a cualquiera, pídele que consulte a su médico antes de empezar o de subir la intensidad, y anótalo en sus notas.</p>
<ol><li>¿Algún médico le ha dicho que tiene una condición del corazón o presión alta?</li><li>¿Siente dolor en el pecho en reposo, en su vida diaria o al hacer ejercicio?</li><li>¿Ha perdido el equilibrio por mareo o el conocimiento en los últimos 12 meses?</li><li>¿Tiene diagnosticada otra enfermedad crónica (diabetes, enfermedad renal, pulmonar, cáncer, etc.)?</li><li>¿Toma medicamentos para alguna enfermedad crónica?</li><li>¿Tiene un problema de huesos, articulaciones o músculos que pueda empeorar con el ejercicio?</li><li>¿Está embarazada o tuvo un parto en los últimos 6 meses?</li><li>¿Tuvo una cirugía o lesión importante recientemente?</li></ol>
<p class="nota">Existe un cuestionario estandarizado y reconocido internacionalmente para esto (PAR-Q+). Esta lista no lo sustituye ni es un diagnóstico: es una guía para decidir cuándo referir.</p>`],
  'referir': ['Cuándo referir y tus límites', 'Lo que sí y lo que no le toca a un entrenador', `
<h4>Detén el entreno y busca atención de inmediato si hay</h4><ul><li>Dolor u opresión en el pecho, falta de aire desproporcionada o desmayo.</li><li>Mareo intenso, confusión, palpitaciones fuera de lo normal.</li><li>Dolor agudo en una articulación, sensación de «tronido» con pérdida de fuerza, hormigueo o adormecimiento que no se va.</li></ul>
<h4>Refiere (médico, fisioterapeuta, nutriólogo, psicólogo) cuando</h4><ul><li>Un dolor dura más de una o dos semanas o empeora con el entreno.</li><li>Te pide una dieta para una enfermedad (diabetes, riñón, embarazo con complicaciones, trastornos de la conducta alimentaria).</li><li>Notas señales de un problema de alimentación o de salud mental: restricción extrema, vómito, culpa intensa, ánimo muy bajo sostenido.</li></ul>
<h4>Tu papel</h4><ul><li><b>Sí:</b> programar el entrenamiento, enseñar técnica, orientar hábitos generales (sueño, proteína, agua, constancia), acompañar y motivar.</li><li><b>No:</b> diagnosticar, tratar lesiones, prescribir dietas clínicas, medicamentos ni dosis de suplementos para enfermedades.</li></ul>
<p class="nota">En Mente, la app muestra líneas de ayuda. Si un cliente te dice que piensa hacerse daño, no lo dejes solo con eso: anímalo a llamar a la Línea de la Vida (800 911 2000) o al 911.</p>`],
  'semanal': ['Seguimiento semanal en 10 minutos', 'Una rutina simple para cada cliente', `
<ol><li><b>Hoy:</b> revisa las alertas. Primero mensajes y solicitudes, luego quien lleva 5 días o más sin entrenar.</li><li><b>Constancia:</b> en Clientes, la barra compara sus entrenos de 30 días con los días de su programa. Debajo de 50% conviene simplificar el plan antes de exigir más.</li><li><b>Cargas:</b> en su ficha mira la tendencia de fuerza estimada. Si cumplió el rango de repeticiones con la reserva indicada, sube un escalón; si no, mantén.</li><li><b>Un mensaje personal:</b> una felicitación concreta («subiste 5 kg en sentadilla») vale más que un mensaje genérico.</li><li><b>Ajuste:</b> cada 4 a 6 semanas revisa el programa con él. Cambia solo lo necesario.</li></ol>`],
  'app': ['Cómo trabajar con tus clientes en Aeterion', 'El flujo completo, de la invitación al seguimiento', `
<ol><li><b>Invita:</b> en Clientes › Invitar cliente comparte tu enlace o tu código. Entran directo contigo.</li><li><b>Permisos:</b> tu cliente decide qué ves (entrenos, peso y medidas, comidas y Mente). Mente siempre empieza apagado. Respeta lo que no comparta.</li><li><b>Programa:</b> en Programas parte de la base Aeterion, ajusta ejercicios, series, reps, reserva y kilos, y asígnalo. Tu cliente lo ve en su app y registra cada ejercicio.</li><li><b>Seguimiento:</b> en su ficha ves constancia, entrenos, medidas y notas privadas. Por mensajes le das retroalimentación.</li><li><b>Sesiones:</b> propón sesiones desde su ficha; se pagan en la app y te llegan sin comisión de Aeterion.</li><li><b>Si termina la relación:</b> pierdes acceso a sus datos, pero su historial sigue siendo suyo.</li></ol>`],
  'promocion': ['Cómo recomendar productos sin meterte en problemas', 'Reglas para hablar de suplementos', `
<ul><li>Preséntalos como <b>complemento de la alimentación</b>, nunca como tratamiento.</li><li><b>No digas</b> que curan, previenen o tratan enfermedades, que «queman grasa», ni prometas resultados.</li><li>Puedes decir lo que la evidencia general respalda y la etiqueta permite; si dudas, no lo digas.</li><li>Antes de recomendar cualquier suplemento pregunta por embarazo, enfermedades y medicamentos; si hay alguno, que consulte a su médico.</li><li>Comparte tu código con transparencia: tu cliente sabe que ganas una comisión.</li></ul>`],
};
VISTAS['c-academia'] = async () => {
  let h = titulo('Academia', 'Formación y material para tu trabajo');
  h += `<div class="co-card cx-curso"><span class="cx-eti">CURSO BASE · INCLUIDO EN TU MEMBRESÍA</span><b>Método Aeterion</b><p>${MODULOS.length} módulos con evaluación. Al aprobarlo obtienes la acreditación interna Coach Aeterion.</p>
    ${MODULOS.map(([t, s], i) => `<div class="cx-mod"><span>${i + 1}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('')}
    <p class="co-peq">El curso está en preparación con referencias científicas verificadas. Te avisaremos aquí en cuanto se abra el primer módulo. La acreditación es interna de Aeterion; no es un título oficial.</p></div>`;
  h += '<div class="co-sec">Material para tu trabajo</div>' + Object.keys(DOCS).map((k) => `<button class="cx-base" data-c="cx-doc" data-x="${k}"><b>${DOCS[k][0]}</b><span>${DOCS[k][1]}</span><i>Leer ›</i></button>`).join('');
  h += '<div class="co-sec">Cursos avanzados</div><div class="co-card"><p>Programación de fuerza, biomecánica, preparación para MMA, nutrición deportiva y suplementación. Se venderán aparte con descuento para coaches.</p></div>';
  return h;
};
VISTAS['c-doc'] = async (v) => { const d = DOCS[v.id]; return d ? titulo(d[0], d[1]) + `<div class="co-card cx-doc">${d[2]}</div>` : ''; };

/* ---------------- GANANCIAS ---------------- */
VISTAS['c-ganancias'] = async () => {
  const k = await llamar('coach_mis_comisiones');
  let h = titulo('Ganancias');
  h += `<div class="co-card cx-total"><span>Por cobrar</span><b>${money(Number(k.validada) + Number(k.por_cobrar))}</b><small>${money(k.pendiente)} en validación · ${money(k.pagada)} cobrado en total</small></div>`;
  h += `<div class="co-card cx-codigo"><span>Tu código</span><b>${esc(k.codigo || '')}</b><p class="co-peq">${k.referidos} ${k.referidos === 1 ? 'persona usa' : 'personas usan'} tu código.</p><div class="co-fila"><button class="co-btn co-sec-btn co-mini" data-c="copiar" data-x="${esc(k.codigo || '')}">Copiar código</button><button class="co-btn co-sec-btn co-mini" data-c="cx-ir" data-x="c-invitar">Invitar cliente</button></div></div>`;
  h += `<div class="co-card"><b>Cómo ganas</b><p>30% de la primera compra de Premium de tu cliente y 15% de sus renovaciones por 12 meses. 10% de cada producto Aeterion.</p>
    <p class="co-peq">Cada venta se valida 15 días después (si no hubo devolución). Pagamos el día 10 de cada mes cuando juntas ${money(k.minimo)} o más; necesitamos tu factura. Tus sesiones son 100% tuyas: Aeterion no cobra comisión por ellas.</p></div>`;
  h += '<div class="co-sec">Movimientos</div>' + (k.movimientos.length ? '<div class="co-card">' + k.movimientos.map((m) => `<div class="co-kv co-mov"><span>${{ premium_nueva: 'Premium nuevo', premium_renovacion: 'Renovación Premium', producto: 'Producto' }[m.tipo]} · ${fechaCorta(m.fecha)}</span><em class="${Number(m.monto) < 0 ? 'neg' : ''}">${money(m.monto)}</em><small>${{ pendiente: 'en validación', validada: 'por cobrar', pagada: 'pagada', cancelada: 'cancelada' }[m.estado]}</small></div>`).join('') + '</div>' : '<p class="co-peq">Aún no hay ventas con tu código.</p>');
  return h;
};

/* ---------------- AGENDA ---------------- */
VISTAS['c-agenda'] = async (v) => {
  const ses = (await llamar('sesiones_mias')).filter((s) => s.rol === 'coach');
  const ahora = new Date();
  const porCerrar = ses.filter((s) => s.estado === 'pagada' && new Date(s.inicio) <= ahora);
  const prox = ses.filter((s) => ['por_pagar', 'pagada'].includes(s.estado) && new Date(s.inicio) > ahora).sort((a, b) => a.inicio.localeCompare(b.inicio));
  let h = titulo('Agenda', 'Tus sesiones de los próximos días');
  if (porCerrar.length) h += '<div class="co-sec">Marca cómo fue</div>' + porCerrar.map((s) => `<div class="co-card"><div class="co-top"><b>${esc(s.con)}</b><span>${fecha(s.inicio)}</span></div><div class="co-fila"><button class="co-btn" data-c="cerrar" data-x="${s.id}" data-n="dada">Se dio</button><button class="co-btn co-sec-btn" data-c="cerrar" data-x="${s.id}" data-n="no_show_cliente">No llegó</button></div></div>`).join('');
  if (!prox.length) h += '<div class="co-card co-vacio"><b>Sin sesiones próximas</b><p>Propón una desde la ficha de tu cliente.</p><button class="co-btn" data-c="cx-tab" data-x="c-clientes">Ir a clientes</button></div>';
  let dia = '';
  prox.forEach((s) => { const d = new Date(s.inicio).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }); if (d !== dia) { dia = d; h += `<div class="co-sec">${esc(d)}</div>`; } h += tarjetaSesion(s); });
  return h;
};

/* ---------------- MI CUENTA DE COACH ---------------- */
VISTAS['c-cuenta'] = async () => {
  await K.refrescar(); const E = K.est(), c = E.coach || {};
  const dias = c.membresia_hasta ? Math.ceil((new Date(c.membresia_hasta) - Date.now()) / 864e5) : null;
  return titulo('Mi cuenta de coach', `${nivelTxt(c.nivel)} · código ${esc(c.codigo || '—')}`) +
    `<div class="co-card"><div class="co-top"><b>Membresía</b><span>${money((E.precios || {}).mensual)} al mes</span></div><p>${c.membresia_hasta ? (dias > 0 ? `Activa hasta el ${fechaCorta(c.membresia_hasta)}` : 'Vencida') : 'Sin pagar'}</p><button class="co-btn co-sec-btn co-mini" data-c="pagar" data-x="mensual">Pagar mensualidad</button></div>
    <div class="co-card"><div class="co-top"><b>Cobro de sesiones</b><span>${c.cobros_habilitados ? 'Activo' : 'Pendiente'}</span></div><p class="co-peq">Tus clientes pagan en la app y el dinero llega a tu cuenta. Stripe te pide identificación y CLABE.</p>${c.cobros_habilitados ? '' : '<button class="co-btn co-sec-btn co-mini" data-c="cobros">Conectar cuenta de cobro</button>'}</div>
    <button class="cx-base" data-c="cx-ir" data-x="c-perfil"><b>Mi perfil público</b><span>Nombre, especialidades, precios y documentos</span><i>Editar ›</i></button>
    <button class="cx-base" data-c="cx-publico"><b>Cómo me ven</b><span>Tu perfil como lo ven los clientes</span><i>Ver ›</i></button>
    <button class="cx-base" data-c="cx-ayuda"><b>Ayuda</b><span>Escríbele al equipo de Aeterion</span><i>Abrir ›</i></button>
    <button class="co-btn co-sec-btn co-btn-grande" data-c="cx-salir">Volver a Mi entreno</button>`;
};
VISTAS['c-perfil'] = async () => VISTAS.solicitud();
VISTAS['c-publico'] = async () => VISTAS.perfil({ id: (K.est().coach || {}).user_id });

/* ---------------- Acciones ---------------- */
function irA(v, extra, conPila) { K.setVista(Object.assign({ v }, extra || {}), conPila); window.scrollTo(0, 0); return K.pintar(); }
window.__coachAccion = async function (c, el, ocupado) {
  const x = el.dataset.x, V = K.vista();
  if (V.v === 'c-editor' && /^cx-(dia|ej|guardar|motor)/.test(c)) leerEditor(V);
  switch (c) {
    case 'cx-tab': return irA(x);
    case 'cx-ir': return irA(x, {}, true);
    case 'cx-salir': document.body.classList.remove('modo-coach'); K.setVista({ v: 'inicio' }); if (typeof aetIr === 'function') aetIr('inicio'); return;
    case 'cx-filtro': V.f = x; return K.pintar();
    case 'cx-ficha': return irA('c-ficha', { id: x, tab: el.dataset.t || 'resumen' }, true);
    case 'cx-tabficha': V.tab = x; V.sesion = false; return K.pintar();
    case 'cx-sesion': V.sesion = true; await K.pintar(); { const s = $('cxSesion'); if (s) s.scrollIntoView({ behavior: 'smooth' }); } return;
    case 'cx-nota': return ocupado(async () => { const t = $('cxNota').value; if (!t.trim()) throw new Error('Escribe la nota primero.'); await llamar('coach_nota_agregar', { p_cliente: x, p_texto: t }); toast('Nota guardada'); await K.pintar(); });
    case 'cx-nota-borrar': if (!confirm('¿Borrar esta nota?')) return; return ocupado(async () => { await llamar('coach_nota_borrar', { p_id: Number(x) }); await K.pintar(); });
    case 'cx-compartir': try { await navigator.share({ title: 'Entrena conmigo en Aeterion', url: x }); } catch (e) { try { await navigator.clipboard.writeText(x); toast('Enlace copiado'); } catch (er) { toast(x); } } return;
    case 'cx-seg': V.seg = x; return K.pintar();
    case 'cx-doc': return irA('c-doc', { id: x }, true);
    case 'cx-ayuda': if (typeof aetAyuda === 'function') { if (typeof aetIr === 'function') aetIr('cuenta'); aetAyuda(); } return;
    case 'cx-publico': return irA('c-publico', {}, true);
    case 'cx-nuevo-prog': return irA('c-editor', { prog: { nombre: 'Mi programa', base: null, cliente_id: null, nota: '', dias: [{ nombre: 'Día 1', ejercicios: [{ n: 'Sentadilla', s: 3, r: '8–10', rir: 2, kg: null, origen: 'coach' }] }] }, dia: 0 }, true);
    case 'cx-desde-base': return ocupado(async () => {
      const dias = await baseComoDias(x);
      if (!dias || !dias.length) throw new Error('No se pudo cargar el programa base. Revisa tu conexión y tu Premium.');
      return irA('c-editor', { prog: { nombre: (BASES.find((b) => b[0] === x) || [])[1] || 'Programa', base: x, cliente_id: V.paraCliente || null, nota: '', dias }, dia: 0 }, true);
    });
    case 'cx-prog-cliente': return ocupado(async () => {
      const P = await llamar('coach_programas_listar'); const a = P.asignados.find((p) => p.cliente_id === x);
      if (a) return irA('c-editor', { prog: JSON.parse(JSON.stringify(a)), dia: 0 }, true);
      return irA('c-programas', { seg: 'base', paraCliente: x }, true);
    });
    case 'cx-editar-prog': { const p = (V.lista || []).find((q) => String(q.id) === x); if (p) return irA('c-editor', { prog: JSON.parse(JSON.stringify(p)), dia: 0 }, true); return; }
    case 'cx-asignar-plantilla': { const p = (V.lista || []).find((q) => String(q.id) === x); if (!p) return; const copia = JSON.parse(JSON.stringify(p)); delete copia.id; copia.cliente_id = null; return irA('c-editor', { prog: copia, dia: 0, elegir: true }, true); }
    case 'cx-borrar-prog': if (!confirm(V.seg === 'plantillas' ? '¿Borrar esta plantilla?' : '¿Quitarle este programa a tu cliente? Su historial se queda.')) return; return ocupado(async () => { await llamar('coach_programa_borrar', { p_id: Number(x) }); CLIENTES = null; await K.pintar(); });
    case 'cx-dia': V.dia = Number(x); return K.pintar();
    case 'cx-dia-mas': V.prog.dias.push({ nombre: 'Día ' + (V.prog.dias.length + 1), ejercicios: [{ n: 'Ejercicio', s: 3, r: '8–10', rir: 2, kg: null, origen: 'coach' }] }); V.dia = V.prog.dias.length - 1; return K.pintar();
    case 'cx-dia-borrar': if (!confirm('¿Borrar este día?')) return; V.prog.dias.splice(V.dia || 0, 1); V.dia = 0; return K.pintar();
    case 'cx-ej-mas': V.prog.dias[V.dia || 0].ejercicios.push({ n: '', s: 3, r: '8–10', rir: 2, kg: null, origen: 'coach' }); await K.pintar(); { const l = document.querySelectorAll('.cx-ej .cx-n'); if (l.length) l[l.length - 1].focus(); } return;
    case 'cx-ej-borrar': V.prog.dias[V.dia || 0].ejercicios.splice(Number(x), 1); return K.pintar();
    case 'cx-ej-mover': { const L = V.prog.dias[V.dia || 0].ejercicios, i = Number(x), j = i + Number(el.dataset.n); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; return K.pintar(); }
    case 'cx-motor': return ocupado(async () => {
      const d = await llamar('coach_cliente_datos', { p_cliente: V.prog.cliente_id }); const M = datosCargas(d.datos || {});
      let n = 0, sin = 0;
      V.prog.dias.forEach((dia) => dia.ejercicios.forEach((e) => {
        const ref = M[norm(e.n)]; if (!ref) { sin++; return; }
        const kg = redondea(ref.v / (1 + (repsMedias(e.r) + (e.rir == null ? 2 : e.rir)) / 30));
        if (kg > 0 && kg <= 1000) { e.kg = kg; e.origen = 'motor'; n++; }
      }));
      toast(n ? `Calculé ${n} ${n === 1 ? 'carga' : 'cargas'}${sin ? `; ${sin} sin marcas previas` : ''}` : 'Tu cliente aún no tiene marcas registradas para estos ejercicios');
      return K.pintar();
    });
    case 'cx-guardar-prog': return ocupado(async () => {
      const P = V.prog; const err = validarPrograma(P); if (err) throw new Error(err);
      const limpio = (p) => ({ id: p.id || null, nombre: p.nombre.trim(), base: p.base || null, nota: p.nota || '', cliente_id: p.cliente_id || null,
        dias: p.dias.map((d) => ({ nombre: d.nombre.trim(), ejercicios: d.ejercicios.map((e) => { const o = { n: e.n.trim(), s: e.s, r: e.r, rir: e.rir, kg: e.kg, origen: e.origen || 'coach' }; if (e.nota) o.nota = e.nota; return o; }) })) });
      if (x === 'plantilla') { const q = limpio(P); q.id = null; q.cliente_id = null; await llamar('coach_programa_guardar', { p: q }); toast('Guardado en tus plantillas'); return; }
      const r = await llamar('coach_programa_guardar', { p: limpio(P) }); P.id = r.id; CLIENTES = null;
      toast(P.cliente_id ? 'Programa asignado. Tu cliente ya lo ve en su app.' : 'Plantilla guardada');
      return irA('c-programas', { seg: P.cliente_id ? 'asignados' : 'plantillas' });
    });
    default: if (window.__coachAccion2) return window.__coachAccion2(c, el, ocupado, V);
  }
};
window.__coachEspacio = { irA, clientes: (f) => clientes(f), titulo, sinCache: () => { CLIENTES = null; } };

/* ---------------- Estilos del espacio ---------------- */
const css = document.createElement('style');
css.textContent = `
body.modo-coach .app-bottomnav,body.modo-coach .app-header{display:none!important}
body.modo-coach #coachApp{padding-bottom:84px}
#coachApp .cx-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:.5rem;background:var(--negro,#0b0b0c);padding:.55rem 0;margin:-.3rem 0 .4rem;border-bottom:1px solid rgba(201,168,76,.15)}
#coachApp .cx-logo{flex:1;font-family:var(--font-display,serif);letter-spacing:.2em;font-size:13px;color:var(--oro,#c9a84c);font-weight:700}
#coachApp .cx-logo b{color:#fff;font-weight:700}
#coachApp .cx-ico{width:40px;height:40px;border:0;background:none;color:var(--oro,#c9a84c);display:grid;place-items:center;cursor:pointer}
#coachApp .cx-salir{border:1px solid rgba(201,168,76,.45);background:transparent;color:var(--oro,#c9a84c);border-radius:20px;padding:.4rem .8rem;font-family:var(--font-ui);font-size:12.5px;font-weight:700;cursor:pointer;min-height:36px}
#coachApp .cx-atras{border:0;background:none;color:var(--oro,#c9a84c);font-family:var(--font-ui);font-size:14px;font-weight:600;padding:.3rem 0 .6rem;cursor:pointer}
#coachApp .cx-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;background:rgba(11,11,12,.97);border-top:1px solid rgba(201,168,76,.18);padding-bottom:env(safe-area-inset-bottom);backdrop-filter:blur(10px)}
#coachApp .cx-nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;color:var(--gris,#999);font-family:var(--font-ui);font-size:10.5px;padding:.55rem 0 .5rem;cursor:pointer;min-height:56px}
#coachApp .cx-nav button.on{color:var(--oro,#c9a84c)}
#coachApp .cx-titulo{display:flex;justify-content:space-between;align-items:flex-start;gap:.6rem;margin:.2rem 0 .9rem}
#coachApp .cx-titulo h2,#coachApp .cx-hola{margin:0;color:#fff;font-family:var(--font-display,serif);font-size:22px}
#coachApp .cx-titulo p{margin:.25rem 0 0;font-size:13px;color:var(--gris,#999)}
#coachApp .cx-titulo .co-btn{margin-top:0}
#coachApp .cx-fecha{margin:.4rem 0 0;font-size:12.5px;color:var(--gris,#999)}
#coachApp .cx-hola{margin:.1rem 0 1rem}
#coachApp .cx-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin-bottom:1rem}
#coachApp .cx-kpis div{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.75rem .4rem;text-align:center;min-width:0}
#coachApp .cx-kpis b{display:block;font-size:1.25rem;color:var(--oro,#c9a84c);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#coachApp .cx-kpis span{display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris,#999);margin-top:.25rem}
#coachApp .cx-alerta{display:flex;align-items:center;gap:.75rem;width:100%;text-align:left;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.75rem .85rem;margin-bottom:.55rem;color:inherit;font-family:var(--font-ui);cursor:pointer}
#coachApp .cx-alerta > div:not(.co-av){flex:1;min-width:0} #coachApp .cx-alerta b{display:block;color:#fff;font-size:13.5px} #coachApp .cx-alerta span{font-size:12px;color:var(--gris,#999)} #coachApp .cx-alerta i{font-style:normal;color:var(--oro,#c9a84c);font-size:20px}
#coachApp .cx-al-mensaje{border-color:rgba(201,168,76,.45)} #coachApp .cx-al-inactivo{border-left:3px solid #e5866f}
#coachApp .cx-sec2{display:flex;justify-content:space-between;align-items:center;margin:1.3rem 0 .6rem}
#coachApp .cx-link{color:var(--oro,#c9a84c);padding:0}
#coachApp .cx-ses{display:flex;gap:.8rem;padding:.55rem 0;border-top:1px solid rgba(255,255,255,.06)} #coachApp .cx-ses:first-child{border-top:0}
#coachApp .cx-ses > b{flex:none;width:48px;color:var(--oro,#c9a84c);font-size:13.5px} #coachApp .cx-ses span{display:block;color:#fff;font-size:13.5px} #coachApp .cx-ses small{font-size:12px;color:var(--gris,#999)}
#coachApp .cx-rapidos{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin:1rem 0}
#coachApp .cx-rapidos button{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.8rem .3rem;color:#fff;font-family:var(--font-ui);font-size:12px;font-weight:600;cursor:pointer}
#coachApp .cx-rapidos span{display:block;font-size:20px;color:var(--oro,#c9a84c);margin-bottom:.2rem}
#coachApp .co-mini{padding:.5rem .8rem;font-size:12.5px;min-height:38px}
#coachApp .cx-lista{padding:.2rem .9rem}
#coachApp .cx-cli{display:flex;align-items:center;gap:.75rem;width:100%;background:none;border:0;border-top:1px solid rgba(255,255,255,.07);padding:.75rem 0;text-align:left;color:inherit;font-family:var(--font-ui);cursor:pointer}
#coachApp .cx-cli:first-child{border-top:0}
#coachApp .cx-cli-d{flex:1;min-width:0} #coachApp .cx-cli-d > b{display:block;color:#fff;font-size:14px} #coachApp .cx-cli-d > span{display:block;font-size:12px;color:var(--gris,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#coachApp .cx-cli strong{flex:none;font-size:13px}
#coachApp .cx-md{font-style:normal;font-size:10px;font-weight:700;border:1px solid rgba(201,168,76,.35);color:#e8cf86;border-radius:20px;padding:1px 6px;margin-left:6px;vertical-align:2px}
#coachApp .cx-nl,#coachApp .co-punto{font-style:normal;font-size:10.5px;font-weight:800;background:#e5866f;color:#140a07;border-radius:20px;padding:1px 7px;margin-left:6px}
#coachApp .cx-bar{height:5px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:6px} #coachApp .cx-bar i{display:block;height:100%;border-radius:5px}
#coachApp .cx-codigo{text-align:center} #coachApp .cx-codigo > span{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gris,#999)} #coachApp .cx-codigo > b{display:block;font-size:26px;letter-spacing:.08em;color:var(--oro,#c9a84c);margin:.2rem 0 .4rem}
#coachApp .cx-url{word-break:break-all;font-size:12.5px;color:#e8cf86;background:rgba(255,255,255,.03);border-radius:8px;padding:.5rem .6rem}
#coachApp .cx-wa{text-decoration:none;display:inline-flex;align-items:center;justify-content:center;background:#25d366;color:#08130b}
#coachApp .cx-ficha-cab{display:flex;gap:.9rem;align-items:center;margin:.2rem 0 .9rem}
#coachApp .cx-ficha-cab .co-av.grande{width:60px;height:60px;font-size:20px}
#coachApp .cx-ficha-cab h2{margin:0;color:#fff;font-family:var(--font-display,serif);font-size:20px} #coachApp .cx-ficha-cab p{margin:.2rem 0 0;font-size:12.5px;color:var(--gris,#999)}
#coachApp .cx-tabs{display:flex;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:1rem} #coachApp .cx-tabs::-webkit-scrollbar{display:none}
#coachApp .cx-tabs button{flex:1 0 auto;border:0;background:none;color:var(--gris,#999);font-family:var(--font-ui);font-size:12.5px;font-weight:600;padding:.65rem .45rem;border-bottom:2px solid transparent;cursor:pointer}
#coachApp .cx-tabs button.on{color:var(--oro,#c9a84c);border-bottom-color:var(--oro,#c9a84c)}
#coachApp .cx-barras{display:flex;gap:6px;height:90px;align-items:flex-end;margin:.8rem 0 .3rem}
#coachApp .cx-barras div{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}
#coachApp .cx-barras i{display:block;width:100%;border-radius:5px 5px 2px 2px;background:var(--oro,#c9a84c)} #coachApp .cx-barras span{font-size:9.5px;color:var(--gris,#999)}
#coachApp .cx-perm{display:flex;justify-content:space-between;font-size:13px;padding:.45rem 0;border-top:1px solid rgba(255,255,255,.06)}
#coachApp .cx-perm b.si{color:#4cc38a} #coachApp .cx-perm b.no{color:var(--gris,#999)}
#coachApp .cx-acciones{display:flex;gap:.6rem;flex-wrap:wrap} #coachApp .cx-acciones .co-btn{flex:1}
#coachApp .cx-log{display:flex;justify-content:space-between;gap:.6rem;padding:.55rem 0;border-top:1px solid rgba(255,255,255,.06)} #coachApp .cx-log:first-child{border-top:0}
#coachApp .cx-log b{display:block;color:#fff;font-size:13.5px} #coachApp .cx-log span{font-size:11.5px;color:var(--gris,#999)} #coachApp .cx-log em{font-style:normal;font-size:12.5px;color:#e8cf86;text-align:right}
#coachApp .cx-tabla{overflow-x:auto} #coachApp .cx-tabla table{width:100%;border-collapse:collapse;font-size:12.5px} #coachApp .cx-tabla th{text-align:left;color:var(--gris,#999);font-weight:600;padding:.35rem .4rem;text-transform:capitalize} #coachApp .cx-tabla td{padding:.4rem;border-top:1px solid rgba(255,255,255,.06);color:#fff;white-space:nowrap}
#coachApp .cx-nota p{margin:0 0 .4rem;white-space:pre-wrap}
#coachApp .co-chat{padding:.6rem}
#coachApp .co-msgs{max-height:52vh;overflow-y:auto;display:flex;flex-direction:column;gap:.45rem;padding:.2rem}
#coachApp .co-msg{max-width:82%;align-self:flex-start;background:rgba(255,255,255,.06);border-radius:14px 14px 14px 4px;padding:.5rem .7rem}
#coachApp .co-msg.mio{align-self:flex-end;background:rgba(201,168,76,.18);border-radius:14px 14px 4px 14px}
#coachApp .co-msg p{margin:0;color:#fff;font-size:13.5px;white-space:pre-wrap;word-break:break-word} #coachApp .co-msg span{display:block;font-size:10.5px;color:var(--gris,#999);margin-top:.2rem}
#coachApp .co-escribir{margin-top:.5rem;align-items:flex-end;flex-wrap:nowrap} #coachApp .co-escribir textarea{flex:1;resize:none;margin:0;min-height:46px} #coachApp .co-escribir .co-btn{margin:0;flex:none;min-width:84px}
#coachApp .cx-base{display:flex;flex-direction:column;width:100%;text-align:left;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.85rem 1rem;margin-bottom:.6rem;color:inherit;font-family:var(--font-ui);cursor:pointer;position:relative}
#coachApp .cx-base b{color:#fff;font-size:14px} #coachApp .cx-base span{font-size:12px;color:var(--gris,#999);margin-top:.15rem} #coachApp .cx-base i{position:absolute;right:1rem;top:50%;transform:translateY(-50%);font-style:normal;font-size:12px;color:var(--oro,#c9a84c);font-weight:700}
#coachApp .cx-motor{border-color:rgba(201,168,76,.35)}
#coachApp .cx-editor{padding:.8rem}
#coachApp .cx-ej{border-top:1px solid rgba(255,255,255,.08);padding:.7rem 0} #coachApp .cx-ej .co-in{margin-top:.3rem;font-size:15px}
#coachApp .cx-nums{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem} #coachApp .cx-nums label{font-size:10.5px;color:var(--gris,#999);text-transform:uppercase;letter-spacing:.04em;min-width:0}
#coachApp .cx-pill{flex:none;font-size:10.5px;font-weight:700;border-radius:20px;padding:3px 8px;align-self:center}
#coachApp .cx-pill.motor{background:rgba(201,168,76,.15);color:#e8cf86} #coachApp .cx-pill.coach{background:rgba(76,195,138,.13);color:#4cc38a}
#coachApp .cx-ej-acc{display:flex;gap:.4rem;margin-top:.4rem;justify-content:flex-end} #coachApp .cx-ej-acc button{border:1px solid rgba(255,255,255,.12);background:none;color:var(--gris,#999);border-radius:8px;min-width:40px;min-height:34px;font-family:var(--font-ui);font-size:12.5px;cursor:pointer}
#coachApp .cx-curso{border-color:rgba(201,168,76,.4)} #coachApp .cx-eti{display:block;font-size:10.5px;letter-spacing:.1em;color:var(--oro,#c9a84c);font-weight:700;margin-bottom:.3rem}
#coachApp .cx-curso > b{font-family:var(--font-display,serif);font-size:20px}
#coachApp .cx-mod{display:flex;gap:.7rem;align-items:center;padding:.5rem 0;border-top:1px solid rgba(255,255,255,.06)}
#coachApp .cx-mod > span{flex:none;width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;font-size:12px;color:var(--gris,#999);font-weight:700}
#coachApp .cx-mod b{display:block;color:#fff;font-size:13.5px} #coachApp .cx-mod small{font-size:11.5px;color:var(--gris,#999)}
#coachApp .cx-doc h4{color:var(--oro,#c9a84c);font-size:13px;letter-spacing:.04em;margin:1rem 0 .4rem} #coachApp .cx-doc h4:first-child{margin-top:0}
#coachApp .cx-doc ol,#coachApp .cx-doc ul{padding-left:1.1rem;margin:.3rem 0} #coachApp .cx-doc li{margin:.35rem 0;line-height:1.5} #coachApp .cx-doc p{line-height:1.55}
#coachApp .cx-doc .nota{font-size:12px;color:var(--gris,#999);border-top:1px solid rgba(255,255,255,.07);padding-top:.6rem;margin-top:.8rem}
#coachApp .cx-total{text-align:center;border-color:rgba(201,168,76,.4)} #coachApp .cx-total span{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gris,#999)} #coachApp .cx-total b{display:block;font-size:34px;color:#fff;margin:.2rem 0} #coachApp .cx-total small{font-size:12px;color:var(--gris,#999)}
#coachApp .co-accesos{margin-bottom:.8rem} #coachApp .co-accesos .co-tile{flex:1} #coachApp .co-tile i{display:block;font-style:normal;font-size:11px;color:var(--gris,#999);margin-top:.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#coachApp .co-ej{display:flex;align-items:center;gap:.6rem;padding:.6rem 0;border-top:1px solid rgba(255,255,255,.06)} #coachApp .co-ej > div{flex:1;min-width:0} #coachApp .co-ej b{display:block;color:#fff;font-size:13.5px} #coachApp .co-ej span{display:block;font-size:12px;color:var(--gris,#999)} #coachApp .co-ej .co-btn{margin:0}
`;
document.head.appendChild(css);
})();
