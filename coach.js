/* ============================================================
   AETERION · COACHES — red de entrenadores verificados
   Cliente: directorio, perfil, vincularse con permisos, sesiones.
   Coach: solicitud con documentos, panel, clientes, sesiones, comisiones.
   Todo lo decide el servidor (funciones coach_* / vinculo_* / sesion_*).
   Si el servidor dice disponible:false, el módulo no se muestra.
============================================================ */
(function () {
'use strict';
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const fecha = (iso) => { try { return new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
const fechaCorta = (iso) => { try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso; } };
const toast = (t) => { try { aetToast(t); } catch (e) { console.log(t); } };

const ESPECIALIDADES = ['Fuerza', 'Hipertrofia', 'Pérdida de grasa', 'Principiantes', 'Mujeres', 'Adulto mayor', 'Funcional', 'Movilidad', 'Box / MMA', 'Running', 'Preparación física'];
const TIPOS_DOC = { identificacion: 'Identificación oficial', certificacion: 'Certificación de entrenador', licenciatura: 'Licenciatura o cédula', rfc: 'Constancia de situación fiscal', otro: 'Otro documento' };
const ESTADOS_SES = { por_pagar: 'Por pagar', pagada: 'Pagada', dada: 'Dada', cancelada_cliente: 'Cancelada por el cliente', cancelada_coach: 'Cancelada por el coach', no_show_cliente: 'El cliente no llegó', no_show_coach: 'El coach no llegó', disputa: 'En revisión', expirada: 'Cancelada' };
const PERM = [
  ['entrenos', 'Entrenos y cargas', 'Para ajustar tu programa'],
  ['medidas', 'Peso y medidas', 'Para ver si avanzas hacia tu meta'],
  ['comidas', 'Comidas, agua y hábitos', 'Lo que registras en Nutrición'],
  ['mente', 'Mente', 'Tu ánimo y lo que escribes. Es lo más personal: queda apagado si no lo activas tú.'],
];
const ERR = {
  no_autenticado: 'Inicia sesión para continuar.',
  coach_no_disponible: 'Esta función todavía no está disponible.',
  precio_sobre_tope: 'Ese precio pasa el máximo de tu nivel.',
  rfc_invalido: 'Revisa tu RFC: 12 o 13 caracteres, sin espacios.',
  rfc_bloqueado: 'El RFC ya no se puede cambiar. Escríbenos a soporte.',
  faltan_datos: 'Completa nombre, RFC, modalidad y precio por sesión.',
  faltan_terminos: 'Acepta los términos para coaches.',
  faltan_documentos: 'Sube tu identificación y al menos una certificación o título.',
  falta_pago: 'Paga tu primer mes para enviar la solicitud.',
  archivo_invalido: 'No se pudo guardar el archivo.',
  demasiados_documentos: 'Ya tienes el máximo de documentos.',
  ya_tienes_coach: 'Ya tienes un coach. Termina ese vínculo antes de pedir otro.',
  coach_no_encontrado: 'Ese coach ya no está disponible.',
  modalidad_no_disponible: 'Este coach no ofrece esa modalidad.',
  no_contigo: 'No puedes hacer esto con tu propia cuenta.',
  codigo_invalido: 'Ese código no existe o ya no está activo.',
  fecha_invalida: 'Elige una fecha entre 1 hora y 90 días a partir de ahora.',
  no_se_puede_cancelar: 'Esta sesión ya no se puede cancelar.',
  no_se_puede_calificar: 'Ya calificaste esta sesión.',
  no_se_puede_reportar: 'Solo puedes reportar hasta 48 horas después de la sesión.',
  coach_bloqueado: 'Tu cuenta de coach está suspendida.',
  coach_no_vigente: 'Tu membresía de coach no está activa.',
  demasiadas_pendientes: 'Este cliente ya tiene 10 sesiones por pagar.',
  programa_invalido: 'Revisa el programa: cada día necesita nombre y de 1 a 15 ejercicios con series (1–10) y repeticiones.',
  programa_no_encontrado: 'Ese programa ya no existe.',
  demasiadas_plantillas: 'Ya tienes 30 plantillas. Borra alguna para guardar otra.',
  sin_permiso: 'Ya no tienes acceso a este cliente.',
  mensaje_vacio: 'Escribe algo primero.',
  demasiados_mensajes: 'Enviaste muchos mensajes en poco tiempo. Espera un rato.',
  demasiadas_notas: 'Este cliente ya tiene demasiadas notas.',
  sin_coach: 'No tienes coach en este momento.',
};
function msgError(r) {
  const m = r && r.data && (r.data.message || r.data.msg || r.data.error);
  if (m && ERR[m]) return ERR[m];
  if (r && r.red) return 'Sin conexión. Inténtalo de nuevo.';
  return 'No se pudo completar. Inténtalo de nuevo.';
}
async function llamar(fn, args) {
  const r = await _rpc(fn, args || {});
  if (!r.ok) { const e = new Error(msgError(r)); e.r = r; throw e; }
  return r.data;
}

/* ---------------- Estado y navegación ---------------- */
let EST = null;                 // respuesta de coach_estado
let vista = { v: 'inicio' }, pila = [], cargando = false;
const raiz = () => $('coachApp');

async function refrescar() {
  try { EST = await llamar('coach_estado'); } catch (e) { EST = EST || { disponible: false }; }
  try {
    document.body.classList.toggle('coach-on', !!(EST && EST.disponible));
    const activo = !!(EST && EST.coach && EST.coach.estado === 'activo');
    const t = document.querySelector('.coach-entrada .app-card-titulo'), d = document.querySelector('.coach-entrada .app-card-desc'), m = document.getElementById('appCoachMeta');
    if (t) t.textContent = activo ? '🏋️ Aeterion Coach' : '🏋️ Coaches';
    if (d) d.textContent = activo ? 'Tu espacio de trabajo: clientes, programas, agenda, academia y ganancias.' : 'Encuentra un entrenador verificado o, si eres entrenador, únete y administra a tus clientes.';
    if (m) m.textContent = activo ? 'Mi espacio' : 'Verificados';
  } catch (e) {}
  return EST;
}
function ir(v, extra) { pila.push(vista); vista = Object.assign({ v }, extra || {}); pintar(); window.scrollTo(0, 0); }
function volver() { vista = pila.pop() || { v: 'inicio' }; pintar(); }
const cab = (t, sub) => `<div class="co-cab">${pila.length ? '<button class="co-atras" data-c="volver" aria-label="Volver">‹</button>' : ''}<div><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>`;

let _seq = 0;
async function pintar() {
  const r = raiz(); if (!r) return;
  const yo = ++_seq;   // si llega otro dibujo después, este no escribe (evita que una carga lenta tape la pantalla nueva)
  if (!EST) { r.innerHTML = '<div class="co-cargando">Cargando…</div>'; await refrescar(); }
  if (yo !== _seq) return;
  if (!EST.disponible) { r.innerHTML = cab('Coaches') + '<div class="co-card"><b>Muy pronto</b><p>Aquí podrás encontrar entrenadores verificados por Aeterion.</p></div>'; return; }
  try {
    const f = VISTAS[vista.v] || VISTAS.inicio;
    const enCoach = vista.v.indexOf('c-') === 0;
    document.body.classList.toggle('modo-coach', enCoach);
    const html = await f(vista);
    if (yo !== _seq) return;
    if (html != null) r.innerHTML = enCoach && window.__coachMarco ? window.__coachMarco(html, vista) : html;
    if (window.__coachTrasPintar) window.__coachTrasPintar(vista);
  } catch (e) {
    if (yo !== _seq) return;
    const err = `<div class="co-card co-error"><b>No se pudo cargar</b><p>${esc(e.message)}</p><button class="co-btn" data-c="reintentar">Reintentar</button></div>`;
    r.innerHTML = vista.v.indexOf('c-') === 0 && window.__coachMarco ? window.__coachMarco(err, vista) : cab('Coaches') + err;
  }
}

/* ---------------- Vistas ---------------- */
const VISTAS = {};

VISTAS.inicio = async () => {
  await refrescar();
  if (!EST.disponible) return cab('Coaches') + '<div class="co-card"><b>Muy pronto</b><p>Aquí podrás encontrar entrenadores verificados por Aeterion.</p></div>';
  const c = EST.coach, mc = EST.mi_coach;
  let h = cab('Coaches', 'Entrenadores verificados por Aeterion');
  if (mc) {
    h += `<div class="co-card co-dest" data-c="mi-coach"><div class="co-top"><b>${mc.estado === 'activo' ? 'Tu coach' : 'Solicitud enviada'}</b><span>${mc.estado === 'activo' ? 'Activo' : 'Esperando respuesta'}</span></div>
      <div class="co-persona">${avatar(mc.nombre)}<div><b>${esc(mc.nombre)}</b><p>${mc.modalidad === 'linea' ? 'En línea' : 'Presencial'} · comparte ${resumenPermisos(mc.permisos)}</p></div></div></div>`;
  } else {
    h += `<div class="co-card co-dest"><b>Encuentra a tu coach</b><p>Elige un entrenador con certificados revisados. Pagas tus sesiones aquí y tú decides qué datos ve.</p><button class="co-btn co-btn-grande" data-c="directorio">Ver coaches</button></div>`;
  }
  if (mc && mc.estado === 'activo') {
    let pr = await llamar('programa_mio').catch(() => null); if (!pr || !Array.isArray(pr.dias)) pr = null;
    const nl = await llamar('mensajes_no_leidos').catch(() => 0);
    h += `<div class="co-fila co-accesos"><button class="co-tile" data-c="mi-coach" data-x="programa"><span>📋</span><b>${pr ? 'Mi programa' : 'Sin programa aún'}</b>${pr ? `<i>${esc(pr.nombre)}</i>` : ''}</button>
      <button class="co-tile" data-c="mi-coach" data-x="mensajes"><span>💬</span><b>Mensajes</b>${nl ? `<i class="co-punto">${nl} nuevo${nl === 1 ? '' : 's'}</i>` : ''}</button></div>`;
  }
  if (!mc) h += `<div class="co-card"><b>¿Tu coach te dio un código?</b><div class="co-fila"><input class="co-in" id="coCodigoInv" maxlength="20" placeholder="Ej. DANI123" style="text-transform:uppercase;flex:1"><button class="co-btn" data-c="usar-invitacion">Entrar</button></div></div>`;
  const ses = await llamar('sesiones_mias').catch(() => []);
  const mias = ses.filter((s) => s.rol === 'cliente' && ['por_pagar', 'pagada'].includes(s.estado));
  if (mias.length) h += '<div class="co-sec">Tus próximas sesiones</div>' + mias.map(tarjetaSesion).join('');
  if (c) {
    const st = { borrador: 'Solicitud sin enviar', revision: 'En revisión', activo: 'Coach activo', suspendido: 'Suspendido', rechazado: 'Solicitud rechazada', baja: 'Dado de baja' }[c.estado];
    h += `<div class="co-sec">Eres entrenador</div><div class="co-card" data-c="${c.estado === 'activo' ? 'panel' : 'solicitud'}"><div class="co-top"><b>${c.estado === 'activo' ? 'Mi panel de coach' : 'Mi solicitud de coach'}</b><span>${st}</span></div>
      ${c.estado === 'activo' && c.solicitudes ? `<p>${c.solicitudes} ${c.solicitudes === 1 ? 'persona quiere' : 'personas quieren'} entrenar contigo.</p>` : ''}${c.motivo && c.estado !== 'activo' ? `<p class="co-aviso">${esc(c.motivo)}</p>` : ''}</div>`;
  } else {
    const p = EST.precios || {};
    h += `<div class="co-sec">¿Eres entrenador?</div><div class="co-card"><b>Únete a Aeterion Coach</b>
      <p>Perfil verificado en el directorio, panel de clientes, cobro de sesiones en la app sin comisión, curso base incluido, Premium personal y comisiones por recomendar productos.</p>
      <p class="co-peq">${money(p.mensual)} al mes, sin cuota de entrada. Cancelas cuando quieras. No garantizamos clientes ni ingresos.</p>
      <button class="co-btn co-sec-btn" data-c="solicitud">Quiero ser coach</button></div>`;
  }
  return h;
};

VISTAS.directorio = async (v) => {
  const f = v.f || {};
  const lista = await llamar('coach_directorio', { p_texto: f.t || null, p_especialidad: f.e || null, p_modalidad: f.m || null, p_limite: 30, p_desde: 0 });
  let h = cab('Coaches', 'Verificados por Aeterion');
  h += `<input class="co-in" id="coBusca" placeholder="Busca por nombre, zona o gimnasio" value="${esc(f.t || '')}" autocomplete="off">
    <div class="co-chips co-scroll">${['', 'presencial', 'linea'].map((m) => `<button class="co-chip ${(f.m || '') === m ? 'on' : ''}" data-c="filtro" data-k="m" data-x="${m}">${m === '' ? 'Todas' : m === 'linea' ? 'En línea' : 'Presencial'}</button>`).join('')}</div>
    <div class="co-chips co-scroll">${ESPECIALIDADES.map((e) => `<button class="co-chip ${f.e === e ? 'on' : ''}" data-c="filtro" data-k="e" data-x="${esc(e)}">${esc(e)}</button>`).join('')}</div>`;
  if (!lista.length) h += '<div class="co-card co-vacio"><b>Sin resultados</b><p>Prueba con otro filtro.</p></div>';
  h += lista.map((c) => `<div class="co-card co-item" data-c="perfil" data-x="${esc(c.id)}">
      <div class="co-persona">${avatar(c.nombre)}<div><b>${esc(c.nombre)}</b><span class="co-nivel">${nivelTxt(c.nivel)}</span>
      <p>${esc(c.especialidades.slice(0, 3).join(' · '))}</p>
      <p class="co-peq">${c.modalidades.map((m) => (m === 'linea' ? 'En línea' : 'Presencial')).join(' y ')}${c.zona ? ' · ' + esc(c.zona) : ''}</p></div>
      <div class="co-precio">${c.precio_sesion ? money(c.precio_sesion) + '<span>/sesión</span>' : ''}${estrellas(c.calificacion)}</div></div></div>`).join('');
  return h;
};

VISTAS.perfil = async (v) => {
  const c = await llamar('coach_perfil', { p_coach: v.id });
  const mc = EST.mi_coach;
  let h = cab('Coach');
  h += `<div class="co-perfil">${avatar(c.nombre, true)}<h3>${esc(c.nombre)}</h3><span class="co-badge">${nivelTxt(c.nivel).toUpperCase()}</span>${estrellas(c.calificacion, true)}</div>`;
  if (c.bio) h += `<p class="co-bio">${esc(c.bio)}</p>`;
  if (c.especialidades.length) h += `<div class="co-chips co-centro">${c.especialidades.map((e) => `<span class="co-tag">${esc(e)}</span>`).join('')}</div>`;
  h += `<div class="co-card co-datos">
    ${c.gimnasio || c.zona ? `<p>📍 ${esc([c.gimnasio, c.zona].filter(Boolean).join(' · '))}</p>` : ''}
    <p>💻 ${c.modalidades.map((m) => (m === 'linea' ? 'En línea' : 'Presencial')).join(' y ')}</p>
    ${c.horario ? `<p>🕒 ${esc(c.horario)}</p>` : ''}
    ${c.experiencia_anios ? `<p>🏋️ ${c.experiencia_anios} ${c.experiencia_anios === 1 ? 'año' : 'años'} de experiencia</p>` : ''}
    <p>🛡️ Documentos revisados por Aeterion${c.curso_aprobado ? ' · curso Aeterion aprobado' : ''}</p></div>`;
  if (c.credenciales.length) h += '<div class="co-sec">Credenciales verificadas</div>' + c.credenciales.map((d) => `<div class="co-cred"><b>${esc(d.nombre)}</b><span>${esc(d.emisor || TIPOS_DOC[d.tipo])}${d.vence ? ' · vigente hasta ' + fechaCorta(d.vence) : ''}</span></div>`).join('');
  h += '<p class="co-legal">La acreditación Aeterion es interna; no es un título oficial.</p>';
  if (c.resenas_recientes && c.resenas_recientes.length) h += '<div class="co-sec">Reseñas de sesiones pagadas</div>' + c.resenas_recientes.map((r) => `<div class="co-card"><div class="co-top"><b>${esc(r.cliente)}</b><span>${'★'.repeat(r.estrellas)}</span></div><p>${esc(r.comentario)}</p></div>`).join('');
  const propio = EST.coach && EST.coach.user_id === c.id;
  const puede = !mc && !propio;
  h += `<div class="co-pie"><div><span>Desde</span><b>${c.precio_sesion ? money(c.precio_sesion) : '—'}<small>/sesión</small></b>${c.precio_mensual ? `<span>${money(c.precio_mensual)} al mes en línea</span>` : ''}</div>
    <button class="co-btn" data-c="${propio ? 'volver' : puede ? 'solicitar' : 'mi-coach'}" data-x="${esc(c.id)}" data-n="${esc(c.nombre)}" data-m="${esc(c.modalidades.join(','))}">${propio ? 'Así te ven tus clientes' : puede ? 'Solicitar a ' + esc(nombreCorto(c.nombre)) : 'Ya tienes coach'}</button></div>`;
  return h;
};

VISTAS.solicitar = async (v) => {
  const perm = v.perm || { entrenos: true, medidas: true, comidas: false, mente: false };
  const mods = v.mods || ['presencial'];
  const mod = v.mod || mods[0];
  let h = cab('Tú decides qué ve', `Tu coach solo verá lo que actives. Puedes cambiarlo o terminar cuando quieras.`);
  if (mods.length > 1) h += `<div class="co-lab">¿Cómo vas a entrenar?</div><div class="co-seg">${mods.map((m) => `<button class="${m === mod ? 'on' : ''}" data-c="sol-mod" data-x="${m}">${m === 'linea' ? 'En línea' : 'Presencial'}</button>`).join('')}</div>`;
  h += '<div class="co-card co-perms">' + PERM.map(([k, t, s]) => switchPerm(k, t, s, perm[k])).join('') + '</div>';
  h += `<div class="co-card co-nota">🔒 Las sesiones se reservan y se pagan aquí, en la app. Aeterion no cobra comisión al coach por tus sesiones.</div>
    <button class="co-btn co-btn-grande" data-c="enviar-solicitud">Enviar solicitud</button>`;
  return h;
};

VISTAS.invitacion = async (v) => {
  const c = await llamar('coach_por_codigo', { p_codigo: v.codigo });
  const perm = v.perm || { entrenos: true, medidas: true, comidas: false, mente: false };
  const mods = c.modalidades.length ? c.modalidades : ['presencial'];
  const mod = v.mod || mods[0];
  let h = cab('Te invitó tu coach');
  h += `<div class="co-perfil">${avatar(c.nombre, true)}<h3>${esc(c.nombre)}</h3><span class="co-badge">${nivelTxt(c.nivel).toUpperCase()}</span>${estrellas(c.calificacion, true)}</div>`;
  if (c.credenciales.length) h += '<div class="co-card">' + c.credenciales.map((d) => `<div class="co-cred"><b>${esc(d.nombre)}</b><span>${esc(d.emisor || '')}</span></div>`).join('') + '<p class="co-legal">Documentos revisados por Aeterion. La acreditación Aeterion es interna; no es un título oficial.</p></div>';
  if (mods.length > 1) h += `<div class="co-lab">¿Cómo vas a entrenar?</div><div class="co-seg">${mods.map((m) => `<button class="${m === mod ? 'on' : ''}" data-c="inv-mod" data-x="${m}">${m === 'linea' ? 'En línea' : 'Presencial'}</button>`).join('')}</div>`;
  h += '<div class="co-lab">Tú decides qué ve</div><div class="co-card co-perms">' + PERM.map(([k, t, s]) => switchPerm(k, t, s, perm[k], 'inv-perm')).join('') + '</div>';
  h += `<button class="co-btn co-btn-grande" data-c="aceptar-invitacion">Entrenar con ${esc(nombreCorto(c.nombre))}</button><p class="co-peq" style="text-align:center">Puedes cambiar lo que compartes o terminar cuando quieras.</p>`;
  return h;
};

VISTAS['mi-coach'] = async () => {
  await refrescar();
  const mc = EST.mi_coach;
  if (!mc) { vista = { v: 'inicio' }; pila = []; return VISTAS.inicio(); }
  const ses = (await llamar('sesiones_mias')).filter((s) => s.rol === 'cliente');
  let h = cab('Tu coach');
  h += `<div class="co-card" data-c="perfil" data-x="${esc(mc.coach_id)}"><div class="co-persona">${avatar(mc.nombre)}<div><b>${esc(mc.nombre)}</b><p>${mc.estado === 'activo' ? 'Vínculo activo' : 'Esperando que acepte tu solicitud'} · ${mc.modalidad === 'linea' ? 'En línea' : 'Presencial'}</p></div></div></div>`;
  if (mc.estado === 'activo') {
    let [pr, msgs] = await Promise.all([llamar('programa_mio').catch(() => null), llamar('mensajes_listar', { p_vinculo: mc.vinculo }).catch(() => [])]);
    if (!pr || !Array.isArray(pr.dias) || !pr.dias.length) pr = null;
    if (!Array.isArray(msgs)) msgs = [];
    h += '<div class="co-sec" id="coSecPrograma">Tu programa</div>';
    if (pr) {
      const d = Math.min(Number(vista.dia) || 0, pr.dias.length - 1);
      h += `<div class="co-card"><div class="co-top"><b>${esc(pr.nombre)}</b><span>${pr.dias.length} ${pr.dias.length === 1 ? 'día' : 'días'}</span></div>${pr.nota ? `<p class="co-peq">${esc(pr.nota)}</p>` : ''}
        <div class="co-chips co-scroll">${pr.dias.map((x, i) => `<button class="co-chip ${i === d ? 'on' : ''}" data-c="prog-dia" data-x="${i}">${esc(x.nombre)}</button>`).join('')}</div>
        ${pr.dias[d].ejercicios.map((e) => `<div class="co-ej"><div><b>${esc(e.n)}</b><span>${e.s} × ${esc(e.r)}${e.rir != null ? ` · deja ${e.rir} en reserva` : ''}${e.kg ? ` · ${e.kg} kg` : ''}</span>${e.nota ? `<span class="co-aviso">${esc(e.nota)}</span>` : ''}</div><button class="co-btn co-sec-btn co-mini" data-c="registrar-ej" data-x="${esc(e.n)}">Registrar</button></div>`).join('')}
        <p class="co-peq">Tus registros le llegan a tu coach si compartes «Entrenos y cargas».</p></div>`;
    } else h += '<p class="co-peq">Tu coach todavía no te asigna un programa. Mientras, puedes seguir con los programas de la app.</p>';
    h += '<div class="co-sec" id="coSecMensajes">Mensajes</div>' + chat(msgs, mc.vinculo);
  }
  h += '<div class="co-sec">Qué compartes</div><div class="co-card co-perms">' + PERM.map(([k, t, s]) => switchPerm(k, t, s, mc.permisos[k], 'perm-cambiar')).join('') + '</div>';
  const prox = ses.filter((s) => ['por_pagar', 'pagada'].includes(s.estado));
  const pas = ses.filter((s) => !['por_pagar', 'pagada'].includes(s.estado));
  h += '<div class="co-sec">Sesiones</div>' + (prox.length ? prox.map(tarjetaSesion).join('') : '<p class="co-peq">Tu coach te propondrá sesiones aquí para que las pagues.</p>');
  if (pas.length) h += '<div class="co-sec">Historial</div>' + pas.slice(0, 15).map(tarjetaSesion).join('');
  h += `<p class="co-peq co-reglas">Cancela con 24 h o más y te devolvemos tu pago completo. Con menos de 24 h o si no llegas, no hay reembolso. Si tu coach cancela o no llega, siempre se te devuelve.</p>
    <button class="co-btn co-peligro" data-c="terminar" data-x="${mc.vinculo}">${mc.estado === 'activo' ? 'Terminar con este coach' : 'Cancelar solicitud'}</button>`;
  return h;
};

/* -------- Coach: solicitud / perfil -------- */
VISTAS.solicitud = async () => {
  await refrescar();
  const c = EST.coach || { estado: 'nuevo', especialidades: [], modalidades: [], documentos: [], nivel: 1 };
  const t = EST.topes && EST.topes[String(c.nivel || 1)] || {};
  const p = EST.precios || {};
  const editable = ['nuevo', 'borrador', 'rechazado', 'activo'].includes(c.estado);
  let h = cab(c.estado === 'activo' ? 'Mi perfil de coach' : 'Solicitud de coach');
  const aviso = { revision: ['Tu solicitud está en revisión', 'Te avisamos por correo en cuanto la revisemos. Normalmente toma 1 a 3 días hábiles.'],
    rechazado: ['Tu solicitud no fue aprobada', c.motivo || ''], suspendido: ['Tu cuenta de coach está suspendida', c.motivo === 'pago' ? 'Renueva tu membresía para reactivarla.' : (c.motivo || '')],
    borrador: c.motivo ? ['Te pedimos un cambio', c.motivo] : null }[c.estado];
  if (aviso) h += `<div class="co-card co-aviso-card"><b>${esc(aviso[0])}</b>${aviso[1] ? `<p>${esc(aviso[1])}</p>` : ''}</div>`;
  if (c.estado === 'nuevo') h += `<div class="co-card"><b>Cómo funciona</b><ol class="co-pasos"><li>Llena tu perfil y sube tu identificación y certificados.</li><li>Paga tu primer mes de ${money(p.mensual)}. Si no te aprobamos, te lo devolvemos completo.</li><li>Revisamos tus documentos y activamos tu perfil, tu código y tu Premium.</li></ol></div>`;
  const dis = editable ? '' : 'disabled';
  h += `<div class="co-form">
    <label class="co-lab">Nombre público</label><input class="co-in" id="cfNombre" maxlength="60" value="${esc(c.nombre_publico || '')}" ${dis} placeholder="Ej. Coach Daniela Ruiz">
    <label class="co-lab">Sobre ti <span class="co-peq">(máx. 400)</span></label><textarea class="co-in" id="cfBio" rows="3" maxlength="400" ${dis} placeholder="Cómo entrenas y a quién ayudas">${esc(c.bio || '')}</textarea>
    <label class="co-lab">Especialidades <span class="co-peq">(hasta 6)</span></label><div class="co-chips" id="cfEsp">${ESPECIALIDADES.map((e) => `<button class="co-chip ${c.especialidades.includes(e) ? 'on' : ''}" data-c="chip" data-x="${esc(e)}" ${dis}>${esc(e)}</button>`).join('')}</div>
    <label class="co-lab">Modalidad</label><div class="co-chips" id="cfMod">${[['presencial', 'Presencial'], ['linea', 'En línea']].map(([k, n]) => `<button class="co-chip ${c.modalidades.includes(k) ? 'on' : ''}" data-c="chip" data-x="${k}" ${dis}>${n}</button>`).join('')}</div>
    <div class="co-doble"><div><label class="co-lab">Zona</label><input class="co-in" id="cfZona" maxlength="80" value="${esc(c.zona || '')}" ${dis} placeholder="Coyoacán"></div>
      <div><label class="co-lab">Gimnasio</label><input class="co-in" id="cfGym" maxlength="80" value="${esc(c.gimnasio || '')}" ${dis} placeholder="Opcional"></div></div>
    <div class="co-doble"><div><label class="co-lab">Horario</label><input class="co-in" id="cfHorario" maxlength="120" value="${esc(c.horario || '')}" ${dis} placeholder="Mañanas y sábado"></div>
      <div><label class="co-lab">Años de experiencia</label><input class="co-in" id="cfExp" type="number" min="0" max="60" inputmode="numeric" value="${c.experiencia_anios ?? ''}" ${dis}></div></div>
    <div class="co-doble"><div><label class="co-lab">Precio por sesión</label><input class="co-in" id="cfPS" type="number" min="1" max="${t.sesion || ''}" inputmode="decimal" value="${c.precio_sesion ?? ''}" ${dis}><span class="co-peq">Máximo ${money(t.sesion)} en tu nivel</span></div>
      <div><label class="co-lab">Mensual en línea</label><input class="co-in" id="cfPM" type="number" min="1" max="${t.mensual || ''}" inputmode="decimal" value="${c.precio_mensual ?? ''}" ${dis}><span class="co-peq">Máximo ${money(t.mensual)}</span></div></div>
    <div class="co-doble"><div><label class="co-lab">RFC</label><input class="co-in" id="cfRfc" maxlength="13" value="${esc(c.rfc || '')}" ${c.estado === 'activo' || !editable ? 'disabled' : ''} style="text-transform:uppercase"></div>
      <div><label class="co-lab">Teléfono</label><input class="co-in" id="cfTel" type="tel" maxlength="15" value="${esc(c.telefono || '')}" ${dis}></div></div>
    ${c.estado !== 'activo' && editable ? `<label class="co-check"><input type="checkbox" id="cfTerm" ${c.acepto_terminos_en ? 'checked disabled' : ''}> Acepto los términos para coaches: cobro de sesiones solo en la app, nada de efectivo, materiales de promoción aprobados y sin promesas de salud.</label>` : ''}
    ${editable ? '<button class="co-btn co-btn-grande" data-c="guardar-perfil">Guardar</button>' : ''}
  </div>`;
  if (c.estado !== 'nuevo') {
    h += '<div class="co-sec">Documentos</div>';
    h += (c.documentos || []).map((d) => `<div class="co-doc"><div><b>${esc(d.nombre)}</b><span>${TIPOS_DOC[d.tipo]}${d.vence ? ' · vence ' + fechaCorta(d.vence) : ''}</span>${d.nota ? `<span class="co-aviso">${esc(d.nota)}</span>` : ''}</div>
       <em class="co-est-${d.estado}">${{ pendiente: 'Por revisar', valido: 'Válido', rechazado: 'Rechazado' }[d.estado]}</em>${d.estado !== 'valido' ? `<button class="co-x" data-c="doc-borrar" data-x="${d.id}" aria-label="Borrar documento">×</button>` : ''}</div>`).join('') || '<p class="co-peq">Aún no subes documentos.</p>';
    if (editable || c.estado === 'revision') h += `<div class="co-card co-subir"><b>Subir documento</b>
      <select class="co-in" id="cdTipo">${Object.entries(TIPOS_DOC).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
      <input class="co-in" id="cdNombre" maxlength="120" placeholder="Nombre (ej. Entrenador personal certificado)">
      <div class="co-doble"><input class="co-in" id="cdEmisor" maxlength="120" placeholder="Quién lo emite (ej. NSCA)"><input class="co-in" id="cdVence" type="date" aria-label="Fecha de vencimiento"></div>
      <input class="co-in" id="cdArchivo" type="file" accept="application/pdf,image/jpeg,image/png">
      <p class="co-peq">PDF, JPG o PNG de hasta 8 MB. Solo lo ve el equipo de Aeterion.</p>
      <button class="co-btn co-sec-btn" data-c="doc-subir">Subir</button></div>`;
  }
  if (c.estado === 'borrador') {
    if (EST.cobro_requerido && !c.primer_pago_en) h += `<button class="co-btn co-btn-grande" data-c="pagar" data-x="primer_mes">Pagar primer mes · ${money(p.mensual)}</button>`;
    h += '<button class="co-btn co-btn-grande co-sec-btn" data-c="enviar-revision">Enviar a revisión</button>';
  }
  return h;
};

/* -------- Coach: el panel vive en coach-espacio.js (modo «Aeterion Coach») -------- */
VISTAS.panel = async () => { vista = { v: 'c-hoy' }; pila = []; return VISTAS['c-hoy'] ? VISTAS['c-hoy'](vista) : ''; };

/* ---------------- Piezas ---------------- */
function chat(msgs, vinculo) {
  const lista = msgs.length ? msgs.map((m) => `<div class="co-msg ${m.mio ? 'mio' : ''}"><p>${esc(m.texto)}</p><span>${fecha(m.fecha)}</span></div>`).join('') : '<p class="co-peq" style="text-align:center">Aún no hay mensajes.</p>';
  return `<div class="co-card co-chat"><div class="co-msgs" id="coMsgs">${lista}</div>
    <div class="co-fila co-escribir"><textarea class="co-in" id="coMsgIn" rows="1" maxlength="1000" placeholder="Escribe…"></textarea><button class="co-btn" data-c="msg-enviar" data-x="${vinculo}" aria-label="Enviar">Enviar</button></div></div>`;
}
function avatar(n, grande) { const ini = String(n || '?').replace(/^coach\s+/i, '').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase(); return `<div class="co-av${grande ? ' grande' : ''}">${esc(ini)}</div>`; }
function nivelTxt(n) { return ({ 1: 'Coach Aeterion', 2: 'Coach Aeterion Avanzado', 3: 'Coach Aeterion Pro' })[n] || 'Coach Aeterion'; }
function estrellas(c, grande) { if (!c || !Number(c.resenas)) return grande ? '<span class="co-peq">Aún sin reseñas</span>' : ''; return `<span class="co-estrellas">★ ${Number(c.promedio).toFixed(1)} <small>(${c.resenas})</small></span>`; }
const CORTO = { entrenos: 'entrenos', medidas: 'peso', comidas: 'comidas', mente: 'Mente' };
function resumenPermisos(p) { const s = PERM.filter(([k]) => p && p[k]).map(([k]) => CORTO[k]); return s.length ? (s.length > 1 ? s.slice(0, -1).join(', ') + ' y ' + s[s.length - 1] : s[0]) : 'nada aún'; }
const nombreCorto = (n) => String(n || '').replace(/^coach\s+/i, '').split(/\s+/)[0];
function switchPerm(k, t, s, on, accion) { return `<div class="co-perm"><div><b>${t}</b><span>${s}</span></div><button class="co-sw ${on ? 'on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="Compartir ${t}" data-c="${accion || 'sol-perm'}" data-x="${k}"><i></i></button></div>`; }
function tarjetaSesion(s) {
  const fut = new Date(s.inicio) > new Date();
  let acc = '';
  if (s.rol === 'cliente' && s.estado === 'por_pagar' && fut) acc += `<button class="co-btn" data-c="pagar" data-x="sesion" data-n="${s.id}">Pagar ${money(s.precio)}</button>`;
  if (['por_pagar', 'pagada'].includes(s.estado) && fut) acc += `<button class="co-btn co-sec-btn" data-c="cancelar" data-x="${s.id}" data-n="${s.rol}" data-i="${esc(s.inicio)}" data-e="${s.estado}">Cancelar</button>`;
  if (s.rol === 'cliente' && s.estado === 'dada' && !s.calificacion) acc += `<button class="co-btn co-sec-btn" data-c="calificar" data-x="${s.id}">Calificar</button>`;
  if (s.rol === 'cliente' && ['pagada', 'dada', 'no_show_cliente'].includes(s.estado) && !fut && Date.now() - new Date(s.inicio) < 48 * 3600e3) acc += `<button class="co-link" data-c="reportar" data-x="${s.id}">Mi coach no llegó</button>`;
  return `<div class="co-card co-ses co-ses-${s.estado}"><div class="co-top"><b>${fecha(s.inicio)}</b><span>${ESTADOS_SES[s.estado]}</span></div>
    <p>${esc(s.con)} · ${s.minutos} min · ${s.modalidad === 'linea' ? 'En línea' : 'Presencial'} · ${money(s.precio)}</p>${s.nota ? `<p class="co-peq">${esc(s.nota)}</p>` : ''}
    ${s.reembolso === 'pendiente' ? '<p class="co-peq">Reembolso en proceso.</p>' : ''}${s.calificacion ? `<p class="co-estrellas">${'★'.repeat(s.calificacion)}</p>` : ''}${acc ? `<div class="co-fila">${acc}</div>` : ''}</div>`;
}

function leerPerfil() {
  const sel = (id) => [...document.querySelectorAll('#' + id + ' .co-chip.on')].map((b) => b.dataset.x);
  const val = (id) => { const e = $(id); return e ? e.value : undefined; };
  const o = { nombre_publico: val('cfNombre'), bio: val('cfBio'), especialidades: sel('cfEsp'), modalidades: sel('cfMod'), zona: val('cfZona'), gimnasio: val('cfGym'), horario: val('cfHorario'), experiencia_anios: val('cfExp'), precio_sesion: val('cfPS'), precio_mensual: val('cfPM'), telefono: val('cfTel') };
  const rfc = $('cfRfc'); if (rfc && !rfc.disabled && rfc.value.trim()) o.rfc = rfc.value.trim();
  const term = $('cfTerm'); if (term && term.checked && !term.disabled) o.acepto_terminos = true;
  return o;
}

async function subirArchivo(file) {
  if (!file) throw new Error('Elige un archivo.');
  if (file.size > 8 * 1024 * 1024) throw new Error('El archivo pasa de 8 MB.');
  if (!/^(application\/pdf|image\/jpeg|image\/png)$/.test(file.type)) throw new Error('Solo PDF, JPG o PNG.');
  const t = await _token(); if (!t) throw new Error(ERR.no_autenticado);
  const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[file.type];
  const ruta = `${_auth.user_id}/${Date.now()}.${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/coach-docs/${ruta}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
  if (!r.ok) throw new Error('No se pudo subir el archivo.');
  return ruta;
}

/* Pagos (Stripe). La función del servidor responde con la URL a donde ir. */
async function pagar(tipo, id) {
  const t = await _token(); if (!t) { toast(ERR.no_autenticado); return; }
  let r;
  try { r = await fetch(`${SUPABASE_URL}/functions/v1/coach-pagos`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, id: id || null, volver: location.origin + location.pathname + '?modo=app&ir=coach' }) }); } catch (e) { toast('Sin conexión. Inténtalo de nuevo.'); return; }
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.url) { location.href = d.url; return; }
  toast(d.error === 'cobros_no_habilitados' ? 'Tu coach aún no activa sus cobros. Avísale.' : 'El pago no está disponible por ahora. Inténtalo más tarde.');
}

/* ---------------- Acciones ---------------- */
async function alClic(ev) {
  const el = ev.target.closest('[data-c]');
  if (!el || !raiz() || !raiz().contains(el) || el.disabled) return;
  const c = el.dataset.c, x = el.dataset.x;
  if (cargando && !['chip', 'sol-perm', 'sol-mod', 'filtro'].includes(c)) return;
  const ocupado = async (fn) => { cargando = true; el.classList.add('co-ocupado'); try { await fn(); } catch (e) { toast(e.message); } finally { cargando = false; el.classList.remove('co-ocupado'); } };
  switch (c) {
    case 'volver': return volver();
    case 'reintentar': EST = null; return pintar();
    case 'directorio': return ir('directorio', { f: {} });
    case 'perfil': return ir('perfil', { id: x });
    case 'mi-coach': return ir('mi-coach', { ancla: x || null });
    case 'panel': pila = []; vista = { v: 'c-hoy' }; window.scrollTo(0, 0); return pintar();
    case 'solicitud': return ir('solicitud');
    case 'comisiones': pila = []; vista = { v: 'c-ganancias' }; return pintar();
    case 'cliente': return ir('c-ficha', { id: x, vinculo: Number(el.dataset.v), nombre: el.dataset.n, tab: el.dataset.t || 'resumen' });
    case 'filtro': { const f = Object.assign({}, vista.f); f[el.dataset.k] = f[el.dataset.k] === x || !x ? '' : x; f.t = ($('coBusca') || {}).value || ''; vista.f = f; return pintar(); }
    case 'chip': {
      const cont = el.parentElement;
      if (!el.classList.contains('on') && cont.id === 'cfEsp' && cont.querySelectorAll('.on').length >= 6) { toast('Máximo 6 especialidades'); return; }
      el.classList.toggle('on'); return;
    }
    case 'solicitar': return ir('solicitar', { id: x, nombre: el.dataset.n, mods: (el.dataset.m || 'presencial').split(',') });
    case 'sol-mod': vista.mod = x; return pintar();
    case 'sol-perm': { vista.perm = Object.assign({ entrenos: true, medidas: true, comidas: false, mente: false }, vista.perm); vista.perm[x] = !vista.perm[x]; return pintar(); }
    case 'enviar-solicitud': return ocupado(async () => {
      await llamar('vinculo_solicitar', { p_coach: vista.id, p_modalidad: vista.mod || (vista.mods || ['presencial'])[0], p_permisos: vista.perm || { entrenos: true, medidas: true, comidas: false, mente: false } });
      try { aetEvento('coach_solicitud'); } catch (e) {}
      toast('Solicitud enviada'); pila = []; vista = { v: 'inicio' }; EST = await refrescar(); pintar();
    });
    case 'perm-cambiar': return ocupado(async () => {
      const p = Object.assign({}, EST.mi_coach.permisos); p[x] = !p[x];
      EST = await llamar('vinculo_permisos', { p_permisos: p }); toast(p[x] ? 'Ahora lo compartes' : 'Dejaste de compartirlo'); pintar();
    });
    case 'terminar': {
      if (!confirm('¿Seguro? Las sesiones pagadas que aún no ocurren se reembolsan.')) return;
      return ocupado(async () => { await llamar('vinculo_terminar', { p_vinculo: Number(x) }); toast('Listo'); pila = []; vista = { v: vista.v === 'c-ficha' ? 'c-clientes' : 'inicio' }; await refrescar(); pintar(); });
    }
    case 'guardar-perfil': return ocupado(async () => { EST = await llamar('coach_guardar', { p: leerPerfil() }); toast('Guardado'); pintar(); });
    case 'doc-subir': return ocupado(async () => {
      const nombre = $('cdNombre').value.trim(); if (nombre.length < 2) throw new Error('Escribe el nombre del documento.');
      const ruta = await subirArchivo($('cdArchivo').files[0]);
      EST = await llamar('coach_documento_agregar', { p_tipo: $('cdTipo').value, p_nombre: nombre, p_emisor: $('cdEmisor').value.trim() || null, p_archivo: ruta, p_vence: $('cdVence').value || null });
      toast('Documento subido'); pintar();
    });
    case 'doc-borrar': if (!confirm('¿Borrar este documento?')) return; return ocupado(async () => { EST = await llamar('coach_documento_borrar', { p_id: Number(x) }); pintar(); });
    case 'enviar-revision': return ocupado(async () => { await llamar('coach_guardar', { p: leerPerfil() }); EST = await llamar('coach_enviar_revision'); try { aetEvento('coach_enviado'); } catch (e) {} toast('Solicitud enviada a revisión'); pintar(); });
    case 'pagar': return ocupado(() => pagar(x, el.dataset.n ? Number(el.dataset.n) : null));
    case 'cobros': return ocupado(() => pagar('cobros'));
    case 'responder': return ocupado(async () => { EST = await llamar('vinculo_responder', { p_vinculo: Number(x), p_aceptar: el.dataset.n === '1' }); toast(el.dataset.n === '1' ? 'Cliente aceptado' : 'Solicitud rechazada'); pintar(); });
    case 'cerrar': return ocupado(async () => { await llamar('sesion_cerrar', { p_id: Number(x), p_resultado: el.dataset.n }); toast('Guardado'); pintar(); });
    case 'crear-sesion': return ocupado(async () => {
      const v = $('csInicio').value; if (!v) throw new Error('Elige fecha y hora.');
      await llamar('sesion_crear', { p_vinculo: Number(x), p_inicio: new Date(v).toISOString(), p_minutos: Number($('csMin').value) || 60, p_precio: Number($('csPrecio').value), p_nota: $('csNota').value });
      toast('Propuesta enviada. Tu cliente la verá para pagarla.'); pintar();
    });
    case 'cancelar': {
      const horas = (new Date(el.dataset.i) - Date.now()) / 3600e3;
      const txt = el.dataset.e === 'por_pagar' ? '¿Cancelar esta propuesta de sesión?'
        : el.dataset.n === 'coach' ? 'Se le devuelve el pago a tu cliente y cuenta como una falta. ¿Cancelar?'
        : horas >= 24 ? 'Faltan más de 24 horas: te devolvemos tu pago completo. ¿Cancelar?' : 'Faltan menos de 24 horas: no hay reembolso. ¿Cancelar de todos modos?';
      if (!confirm(txt)) return;
      return ocupado(async () => { const r = await llamar('sesion_cancelar', { p_id: Number(x) }); toast(r.reembolso ? 'Cancelada. El reembolso está en proceso.' : 'Cancelada'); pintar(); });
    }
    case 'calificar': {
      const n = Number(prompt('¿Cómo estuvo tu sesión? Escribe de 1 a 5 estrellas', '5')); if (!(n >= 1 && n <= 5)) return;
      const com = prompt('Comentario opcional (se muestra en el perfil del coach)', '') || '';
      return ocupado(async () => { await llamar('sesion_calificar', { p_id: Number(x), p_estrellas: Math.round(n), p_comentario: com }); toast('¡Gracias!'); pintar(); });
    }
    case 'reportar': { const det = prompt('Cuéntanos qué pasó', 'Mi coach no llegó'); if (det == null) return; return ocupado(async () => { await llamar('sesion_reportar', { p_id: Number(x), p_detalle: det }); toast('Lo revisaremos y te avisamos'); pintar(); }); }
    case 'copiar': try { await navigator.clipboard.writeText(x); toast('Copiado'); } catch (e) { toast(x); } return;
    case 'usar-invitacion': { const cod = (($('coCodigoInv') || {}).value || '').trim(); if (!cod) { toast('Escribe el código de tu coach'); return; } return ir('invitacion', { codigo: cod }); }
    case 'inv-mod': vista.mod = x; return pintar();
    case 'inv-perm': { vista.perm = Object.assign({ entrenos: true, medidas: true, comidas: false, mente: false }, vista.perm); vista.perm[x] = !vista.perm[x]; return pintar(); }
    case 'aceptar-invitacion': return ocupado(async () => {
      await llamar('vinculo_por_codigo', { p_codigo: vista.codigo, p_modalidad: vista.mod || null, p_permisos: vista.perm || { entrenos: true, medidas: true, comidas: false, mente: false } });
      try { localStorage.removeItem('aet_coach_inv'); } catch (e) {}
      try { aetEvento('coach_invitacion'); } catch (e) {}
      toast('¡Listo! Ya entrenas con tu coach'); pila = []; vista = { v: 'mi-coach' }; await refrescar(); pintar();
    });
    case 'prog-dia': vista.dia = Number(x); return pintar();
    case 'registrar-ej': if (typeof aetFormEntreno === 'function') aetFormEntreno(x); return;
    case 'msg-enviar': return ocupado(async () => {
      const t = ($('coMsgIn') || {}).value || ''; if (!t.trim()) throw new Error(ERR.mensaje_vacio);
      await llamar('mensaje_enviar', { p_vinculo: Number(x), p_texto: t }); await pintar();
      const m = $('coMsgs'); if (m) m.scrollTop = m.scrollHeight; const i = $('coMsgIn'); if (i) i.focus();
    });
    default: if (window.__coachAccion) return window.__coachAccion(c, el, ocupado);
  }
}
document.addEventListener('click', alClic);
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'coBusca') { vista.f = Object.assign({}, vista.f, { t: e.target.value.trim() }); pintar(); } });

/* ---------------- API pública ---------------- */
window.coachRender = function () { pintar(); };
window.coachAbrir = function (v, extra) { pila = []; vista = Object.assign({ v: v || 'inicio' }, extra || {}); pintar(); };
window.coachSub = function () { return pila.length > 0; };
// Entrada desde Cuenta: un coach activo va directo a su espacio de trabajo
window.aetCoachEntrar = async function () {
  if (typeof aetIr === 'function') aetIr('coach');
  const e = EST || await refrescar();
  if (e && e.coach && e.coach.estado === 'activo') { pila = []; vista = { v: 'c-hoy' }; pintar(); }
};
window.coachVolver = function () { if (pila.length) { volver(); return true; } return false; };
window.coachEstado = async function () {
  const e = await refrescar();
  // Invitación por enlace (?coach=CODIGO) guardada hasta que la persona tenga sesión
  try {
    const cod = localStorage.getItem('aet_coach_inv');
    if (cod && e && e.disponible && !e.mi_coach && !(e.coach && e.coach.estado === 'activo')) {
      localStorage.removeItem('aet_coach_inv');
      if (typeof aetIr === 'function') aetIr('coach');
      pila = []; vista = { v: 'invitacion', codigo: cod }; pintar();
    }
  } catch (x) {}
  return e;
};
window.__aetCoach = {
  llamar, esc, money, fecha, fechaCorta, toast, avatar, nivelTxt, estrellas, resumenPermisos, tarjetaSesion, chat, cab, PERM, ERR, VISTAS, nombreCorto,
  est: () => EST, refrescar, pintar, ir, volver,
  vista: () => vista, setVista: (v, conPila) => { if (conPila) pila.push(vista); else pila = []; vista = v; },
  pilaVacia: () => pila.length === 0,
};

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
#coachApp{padding-bottom:1.2rem;font-family:var(--font-ui);color:var(--texto,#ddd)}
#coachApp .co-cab{display:flex;align-items:flex-start;gap:.5rem;margin:.2rem 0 1rem}
#coachApp .co-cab h2{margin:0;color:var(--blanco,#fff);font-family:var(--font-display,serif);font-size:22px}
#coachApp .co-cab p{margin:.25rem 0 0;font-size:13px;color:var(--gris,#999)} #coachApp .co-cab p b{color:var(--oro,#c9a84c)}
#coachApp .co-atras{flex:none;width:40px;height:40px;margin-left:-.5rem;border:0;background:none;color:var(--oro,#c9a84c);font-size:30px;line-height:1;cursor:pointer}
#coachApp .co-card{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:.95rem 1rem;margin-bottom:.8rem;font-size:13.5px;line-height:1.5}
#coachApp .co-card > b{display:block;color:var(--blanco,#fff);font-size:14px;margin-bottom:.3rem}
#coachApp .co-card p{margin:.25rem 0 0}
#coachApp .co-card[data-c]{cursor:pointer}
#coachApp .co-dest{border-color:rgba(201,168,76,.4);background:linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.02))}
#coachApp .co-aviso-card{border-color:rgba(201,168,76,.45)}
#coachApp .co-error{border-color:rgba(229,115,115,.45)}
#coachApp .co-top{display:flex;justify-content:space-between;align-items:center;gap:.6rem}
#coachApp .co-top b{color:var(--blanco,#fff);font-size:14px}
#coachApp .co-top span{color:var(--oro,#c9a84c);font-size:12px;font-weight:600;white-space:nowrap}
#coachApp .co-persona{display:flex;gap:.75rem;align-items:center;margin-top:.35rem}
#coachApp .co-persona > div:nth-child(2){flex:1;min-width:0}
#coachApp .co-persona b{color:var(--blanco,#fff);font-size:14.5px}
#coachApp .co-av{flex:none;width:44px;height:44px;border-radius:50%;background:#2a2620;color:#e8cf86;font-weight:800;font-size:14px;display:grid;place-items:center}
#coachApp .co-av.grande{width:88px;height:88px;font-size:28px;border:2px solid var(--oro,#c9a84c)}
#coachApp .co-nivel{display:block;font-size:11px;color:var(--oro,#c9a84c);font-weight:700;letter-spacing:.03em}
#coachApp .co-precio{flex:none;text-align:right;color:var(--blanco,#fff);font-weight:800;font-size:15px}
#coachApp .co-precio span{display:block;font-size:10.5px;color:var(--gris,#999);font-weight:500}
#coachApp .co-estrellas{display:block;color:#e8cf86;font-size:12.5px;font-weight:700} #coachApp .co-estrellas small{color:var(--gris,#999);font-weight:400}
#coachApp .co-sec{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--oro,#c9a84c);margin:1.3rem 0 .6rem;font-weight:700}
#coachApp .co-btn{background:var(--oro,#c9a84c);color:#141109;border:0;border-radius:12px;padding:.75rem 1.1rem;font-family:var(--font-ui);font-weight:700;font-size:14px;cursor:pointer;margin-top:.6rem;min-height:44px}
#coachApp .co-btn-grande{width:100%;padding:.95rem;font-size:15px}
#coachApp .co-sec-btn{background:transparent;color:var(--oro,#c9a84c);border:1px solid rgba(201,168,76,.5)}
#coachApp .co-peligro{width:100%;background:transparent;color:#e5866f;border:1px solid rgba(229,134,111,.45);margin-top:1.2rem}
#coachApp .co-link{background:none;border:0;color:#e5866f;font-family:var(--font-ui);font-size:12.5px;font-weight:600;cursor:pointer;padding:.6rem 0 0}
#coachApp .co-ocupado{opacity:.55;pointer-events:none}
#coachApp .co-fila{display:flex;gap:.6rem;flex-wrap:wrap} #coachApp .co-fila .co-btn{flex:1}
#coachApp .co-in{width:100%;box-sizing:border-box;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:var(--blanco,#fff);font-family:var(--font-ui);font-size:16px;padding:.65rem .75rem;margin-top:.4rem}
#coachApp .co-in:focus{outline:none;border-color:var(--oro,#c9a84c)} #coachApp .co-in:disabled{opacity:.6}
#coachApp select.co-in{appearance:none}
#coachApp .co-lab{display:block;font-size:13px;color:var(--blanco,#fff);font-weight:600;margin-top:.85rem}
#coachApp .co-doble{display:grid;grid-template-columns:1fr 1fr;gap:.6rem} #coachApp .co-doble > div{min-width:0}
#coachApp .co-peq{font-size:12px;color:var(--gris,#999)}
#coachApp .co-aviso{display:block;color:#e8cf86;font-size:12.5px}
#coachApp .co-legal{font-size:11px;color:var(--gris,#999);margin:.4rem 0 0;text-align:center}
#coachApp .co-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem}
#coachApp .co-scroll{flex-wrap:nowrap;overflow-x:auto;padding-bottom:.2rem;scrollbar-width:none} #coachApp .co-scroll::-webkit-scrollbar{display:none}
#coachApp .co-centro{justify-content:center}
#coachApp .co-chip{flex:none;background:transparent;border:1px solid rgba(255,255,255,.14);color:var(--texto,#ddd);border-radius:30px;padding:.45rem .85rem;font-family:var(--font-ui);font-size:12.5px;cursor:pointer;min-height:36px}
#coachApp .co-chip.on{background:rgba(201,168,76,.18);border-color:var(--oro,#c9a84c);color:#fff}
#coachApp .co-tag{font-size:12px;border:1px solid rgba(201,168,76,.4);color:#e8cf86;border-radius:20px;padding:.3rem .65rem}
#coachApp .co-tag.off{border-color:rgba(255,255,255,.12);color:var(--gris,#999)}
#coachApp .co-perfil{display:flex;flex-direction:column;align-items:center;gap:.4rem;text-align:center}
#coachApp .co-perfil h3{margin:.3rem 0 0;color:#fff;font-family:var(--font-display,serif);font-size:22px}
#coachApp .co-badge{font-size:10.5px;font-weight:800;border-radius:20px;padding:.2rem .6rem;background:var(--oro,#c9a84c);color:#141109;letter-spacing:.04em}
#coachApp .co-bio{text-align:center;font-size:13.5px;line-height:1.55;color:var(--texto,#ddd);margin:.8rem 0}
#coachApp .co-datos p{margin:.2rem 0}
#coachApp .co-cred{display:flex;flex-direction:column;padding:.6rem 0;border-top:1px solid rgba(255,255,255,.06)} #coachApp .co-cred b{color:#fff;font-size:13.5px} #coachApp .co-cred span{font-size:12px;color:var(--gris,#999)}
#coachApp .co-pie{display:flex;align-items:center;gap:.8rem;background:var(--negro,#0b0b0c);border-top:1px solid rgba(255,255,255,.07);padding:.7rem 0;margin-top:1rem}
#coachApp .co-pie > div{flex:none} #coachApp .co-pie span{display:block;font-size:11px;color:var(--gris,#999)} #coachApp .co-pie b{font-size:18px;color:#fff} #coachApp .co-pie small{font-size:12px;color:var(--gris,#999);font-weight:400}
#coachApp .co-pie .co-btn{flex:1;margin:0}
#coachApp .co-lab + .co-seg{margin-top:.4rem}
#coachApp .co-seg{display:flex;gap:4px;background:var(--negro2,#141414);border-radius:12px;padding:4px;margin-bottom:.8rem}
#coachApp .co-seg button{flex:1;height:40px;border-radius:10px;border:0;font-family:var(--font-ui);font-size:13px;font-weight:700;background:transparent;color:var(--gris,#999);cursor:pointer}
#coachApp .co-seg button.on{background:var(--oro,#c9a84c);color:#141109}
#coachApp .co-perms{padding:.2rem 1rem}
#coachApp .co-perm{display:flex;align-items:center;gap:.8rem;padding:.8rem 0;border-top:1px solid rgba(255,255,255,.07)} #coachApp .co-perm:first-child{border-top:0}
#coachApp .co-perm > div{flex:1} #coachApp .co-perm b{display:block;color:#fff;font-size:14px} #coachApp .co-perm span{font-size:12px;color:var(--gris,#999);line-height:1.4}
#coachApp .co-sw{flex:none;width:50px;height:30px;border-radius:30px;border:0;position:relative;padding:0;background:rgba(255,255,255,.14);cursor:pointer}
#coachApp .co-sw i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#f2eee4;transition:left .15s}
#coachApp .co-sw.on{background:var(--oro,#c9a84c)} #coachApp .co-sw.on i{left:23px}
#coachApp .co-nota{font-size:12.5px;color:var(--texto,#ddd)}
#coachApp .co-check{display:flex;gap:.6rem;align-items:flex-start;font-size:12.5px;line-height:1.45;margin-top:1rem} #coachApp .co-check input{width:20px;height:20px;flex:none;accent-color:var(--oro,#c9a84c)}
#coachApp .co-pasos{margin:.3rem 0 0;padding-left:1.1rem} #coachApp .co-pasos li{margin:.3rem 0}
#coachApp .co-doc{display:flex;align-items:center;gap:.6rem;padding:.7rem 0;border-top:1px solid rgba(255,255,255,.06)}
#coachApp .co-doc > div{flex:1;min-width:0} #coachApp .co-doc b{display:block;color:#fff;font-size:13.5px} #coachApp .co-doc span{display:block;font-size:12px;color:var(--gris,#999)}
#coachApp .co-doc em{font-style:normal;font-size:11.5px;font-weight:700;border-radius:20px;padding:.2rem .6rem}
#coachApp .co-est-pendiente{color:#e8cf86;background:rgba(201,168,76,.12)} #coachApp .co-est-valido{color:#4cc38a;background:rgba(76,195,138,.12)} #coachApp .co-est-rechazado{color:#e5866f;background:rgba(229,134,111,.12)}
#coachApp .co-x{border:0;background:none;color:var(--gris,#999);font-size:22px;width:36px;height:36px;cursor:pointer}
#coachApp .co-subir{margin-top:.8rem}
#coachApp .co-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin:.2rem 0 1rem}
#coachApp .co-stats div{background:var(--negro2,#141414);border:1px solid rgba(201,168,76,.18);border-top:3px solid var(--oro,#c9a84c);border-radius:12px;padding:.75rem .4rem;text-align:center}
#coachApp .co-stats b{display:block;font-size:1.25rem;color:var(--oro,#c9a84c);line-height:1.1}
#coachApp .co-stats span{display:block;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris,#999);margin-top:.3rem}
#coachApp .co-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin-top:1.2rem}
#coachApp .co-tile{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.8rem .35rem;text-align:center;cursor:pointer;color:#fff;font-family:var(--font-ui)}
#coachApp .co-tile span{display:block;font-size:22px} #coachApp .co-tile b{display:block;font-size:12px;margin-top:.3rem;font-weight:600}
#coachApp .co-kv{display:flex;justify-content:space-between;gap:.6rem;padding:.35rem 0;border-top:1px solid rgba(255,255,255,.05);margin:0;font-size:12.5px}
#coachApp .co-kv em{font-style:normal;color:#fff;font-weight:600;text-align:right}
#coachApp .co-mov{flex-wrap:wrap} #coachApp .co-mov em.neg{color:#e5866f} #coachApp .co-mov small{width:100%;color:var(--gris,#999);font-size:11px}
#coachApp .co-ses-cancelada_cliente,#coachApp .co-ses-cancelada_coach,#coachApp .co-ses-expirada{opacity:.6}
#coachApp .co-reglas{margin-top:1rem;line-height:1.5}
#coachApp .co-vacio{text-align:center}
#coachApp .co-cargando{padding:3rem 0;text-align:center;color:var(--gris,#999)}
`;
document.head.appendChild(css);
})();
