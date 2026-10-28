/* ============================================================
   ADMIN · COACHES — revisar solicitudes, documentos, nivel,
   suspensiones, disputas, comisiones y el interruptor general.
   Usa del panel: rpc, esc, aviso, bitacora, money, fechaDia, sesion.
============================================================ */
(function () {
'use strict';
const $ = (id) => document.getElementById(id);
const E_TXT = { borrador: 'Sin enviar', revision: 'Por revisar', activo: 'Activo', suspendido: 'Suspendido', rechazado: 'Rechazado', baja: 'Baja' };
const E_COL = { revision: 'amarillo', activo: 'verde', suspendido: 'rojo', rechazado: 'gris', baja: 'gris', borrador: 'gris' };
const TIPOS = { identificacion: 'Identificación', certificacion: 'Certificación', licenciatura: 'Licenciatura / cédula', rfc: 'Constancia fiscal', otro: 'Otro' };
const NIVEL = { 1: 'Coach Aeterion', 2: 'Avanzado', 3: 'Pro' };
let D = null, filtro = 'revision', abierto = null, det = null, liq = null, vistaLiq = false;

async function cargar(silencioso) {
  const raiz = $('coachAdm'); if (!raiz) return;
  if (silencioso && raiz.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  try {
    D = await rpc('admin_coaches', { p_estado: filtro === 'todos' ? null : filtro });
    if (abierto) det = await rpc('admin_coach_detalle', { p_coach: abierto });
    if (vistaLiq) liq = await rpc('admin_coach_liquidaciones');
  } catch (e) {
    if (/could not find|does not exist|404/i.test(e.message || '') || e.status === 404) { raiz.innerHTML = '<div class="card vacio">El módulo de coaches aún no está instalado en la base de datos.</div>'; return; }
    throw e;
  }
  pintar();
}

function pintar() {
  const raiz = $('coachAdm'); const R = D.resumen || {}, C = D.config || {};
  const activo = C.activo === true, testers = Array.isArray(C.testers) ? C.testers : [];
  let h = `<div class="card" style="margin-bottom:14px"><div class="cab"><b>Red de coaches</b><span class="badge ${activo ? 'verde' : 'gris'}">${activo ? 'Visible para todos' : testers.length ? 'Solo testers (' + testers.length + ')' : 'Apagado'}</span></div>
    <div class="peq" style="margin:6px 0 10px">Apagado, nadie ve la sección Coaches en la app salvo los testers y los admins. ${C.cobro_requerido === false ? '<b>Cobro desactivado:</b> los coaches entran sin pagar (solo para piloto).' : 'Se exige el primer mes pagado y la membresía al día.'}</div>
    <div class="fila"><button data-ca="flag" data-v="${activo ? '0' : '1'}" class="${activo ? 'mal' : ''}">${activo ? 'Apagar para todos' : 'Encender para todos'}</button>
      <button class="sec" data-ca="cobro" data-v="${C.cobro_requerido === false ? '1' : '0'}">${C.cobro_requerido === false ? 'Exigir pago' : 'Piloto sin cobro'}</button>
      <button class="sec" data-ca="liq">${vistaLiq ? 'Ocultar comisiones' : 'Comisiones por pagar'}</button></div>
    <div class="fila" style="margin-top:8px"><input id="caTester" placeholder="ID de usuario para agregar como tester"><button class="sec" data-ca="tester">Agregar tester</button></div>
    ${testers.length ? `<div class="peq" style="margin-top:6px">${testers.map((t) => `<span class="pill" style="display:inline-flex;margin:2px">${esc(t.slice(0, 8))}… <a href="#" data-ca="quitar-tester" data-v="${esc(t)}" style="margin-left:6px;color:var(--rojo)">✕</a></span>`).join('')}</div>` : ''}</div>`;
  h += `<div class="kpis">
    <div class="kpi"><small>Por revisar</small><b style="color:var(--oro)">${R.revision || 0}</b></div>
    <div class="kpi"><small>Coaches activos</small><b>${R.activos || 0}</b><i class="igual">${R.suspendidos || 0} suspendidos</i></div>
    <div class="kpi"><small>Clientes vinculados</small><b>${R.clientes || 0}</b></div>
    <div class="kpi"><small>Comisiones por pagar</small><b>${money(R.comisiones_por_pagar)}</b><i class="igual">${R.disputas || 0} disputas abiertas</i></div></div>`;
  if (vistaLiq && liq) h += `<div class="card" style="margin-bottom:14px"><b>Comisiones a pagar</b><div class="peq" style="margin:4px 0 8px">Paga por transferencia, pide la factura al coach y márcala aquí.</div>${liq.length ? liq.map((l) => `<div class="acc"><div><b>${esc(l.coach)} · ${money(l.monto)}</b><div class="peq">${esc(l.periodo)} · RFC ${esc(l.rfc || '—')}${l.referencia ? ' · ' + esc(l.referencia) : ''}${l.factura ? ' · factura ' + esc(l.factura) : ''}</div></div>${l.estado === 'por_pagar' ? `<button class="mini" data-ca="liq-pagar" data-v="${l.id}">Marcar pagada</button>` : '<span class="badge verde">Pagada</span>'}</div>`).join('') : '<div class="vacio">Nada por pagar.</div>'}</div>`;
  h += `<div class="fila" style="margin-bottom:10px;overflow-x:auto;flex-wrap:nowrap">${['revision', 'activo', 'suspendido', 'borrador', 'rechazado', 'todos'].map((f) => `<button class="pill ${filtro === f ? 'on' : ''}" data-ca="filtro" data-v="${f}">${f === 'todos' ? 'Todos' : E_TXT[f]}</button>`).join('')}</div>`;
  h += '<div class="card">' + (D.lista.length ? D.lista.map((c) => `<div class="acc" data-ca="abrir" data-v="${esc(c.id)}" style="cursor:pointer"><div><b>${esc(c.nombre || '(sin nombre)')}</b><div class="peq">${esc(c.email)} · ${NIVEL[c.nivel]}${c.enviado_en ? ' · enviado ' + fechaDia(c.enviado_en) : ''}${c.docs_pendientes ? ` · <span style="color:var(--amar)">${c.docs_pendientes} docs por revisar</span>` : ''}</div></div><span class="badge ${E_COL[c.estado]}">${E_TXT[c.estado]}</span></div>
      ${abierto === c.id && det ? detalle(det) : ''}`).join('') : '<div class="vacio">No hay coaches en esta lista.</div>') + '</div>';
  raiz.innerHTML = h;
}

function detalle(c) {
  let h = `<div class="gestion" style="padding-bottom:12px">
    <dl class="datos"><dt>RFC</dt><dd>${esc(c.rfc || '—')}</dd><dt>Teléfono</dt><dd>${esc(c.telefono || '—')}</dd><dt>Modalidad</dt><dd>${esc((c.modalidades || []).join(', '))}</dd>
    <dt>Zona / gym</dt><dd>${esc([c.zona, c.gimnasio].filter(Boolean).join(' · ') || '—')}</dd><dt>Precios</dt><dd>${money(c.precio_sesion)} sesión · ${money(c.precio_mensual)} mes</dd>
    <dt>Experiencia</dt><dd>${c.experiencia_anios ?? '—'} años</dd><dt>Membresía</dt><dd>${c.membresia_hasta ? 'hasta ' + fechaDia(c.membresia_hasta) : 'sin pagar'}${c.primer_pago_en ? ' · primer mes pagado' : ''}</dd>
    <dt>Clientes</dt><dd>${c.clientes} · faltas 90 d: ${c.faltas} · calif. ${c.calificacion && c.calificacion.resenas ? c.calificacion.promedio + ' (' + c.calificacion.resenas + ')' : '—'}</dd>
    <dt>Alimentación</dt><dd>${c.puede_nutricion ? 'puede enviar planes' : 'usa el plan de la app'}</dd><dt>Curso</dt><dd>${c.curso_aprobado_en ? 'aprobado ' + fechaDia(c.curso_aprobado_en) : 'pendiente'}</dd>${c.motivo ? `<dt>Motivo</dt><dd>${esc(c.motivo)}</dd>` : ''}</dl>
    ${c.bio ? `<div class="peq" style="margin:6px 0">${esc(c.bio)}</div>` : ''}
    <b style="display:block;margin:10px 0 4px">Documentos</b>
    <div class="peq" style="margin-bottom:6px">Verifica el número de la certificación en el registro del organismo que la emite y la cédula en el Registro Nacional de Profesionistas.</div>`;
  h += (c.documentos || []).map((d) => `<div class="acc"><div><b>${esc(d.nombre)}</b><div class="peq">${TIPOS[d.tipo]}${d.emisor ? ' · ' + esc(d.emisor) : ''}${d.vence ? ' · vence ' + fechaDia(d.vence) : ''}${d.nota ? ' · ' + esc(d.nota) : ''}</div></div>
      <div class="acciones" style="margin:0"><button class="sec mini" data-ca="ver-doc" data-v="${esc(d.archivo)}">Ver</button>
      ${d.estado === 'valido' ? '<span class="badge verde">Válido</span>' : `<button class="mini" data-ca="doc" data-v="${d.id}" data-e="valido">Válido</button>`}
      ${d.estado === 'rechazado' ? '<span class="badge rojo">Rechazado</span>' : `<button class="mal mini" data-ca="doc" data-v="${d.id}" data-e="rechazado">Rechazar</button>`}</div></div>`).join('') || '<div class="peq">Sin documentos.</div>';
  if ((c.disputas || []).length) h += '<b style="display:block;margin:12px 0 4px">Disputas</b>' + c.disputas.map((s) => `<div class="acc"><div><b>${fechaDia(s.inicio)} · ${money(s.precio)}</b><div class="peq">${esc(s.nota || '')}</div></div><div class="acciones" style="margin:0"><button class="mal mini" data-ca="disputa" data-v="${s.id}" data-e="1">Sí faltó</button><button class="sec mini" data-ca="disputa" data-v="${s.id}" data-e="0">Sí se dio</button></div></div>`).join('');
  h += '<div class="fila" style="margin-top:12px">';
  if (c.estado === 'revision') h += `<button data-ca="decidir" data-e="aprobar">Aprobar</button><button class="sec" data-ca="decidir" data-e="pedir_documento">Pedir un cambio</button><button class="mal" data-ca="decidir" data-e="rechazar">Rechazar</button>`;
  if (c.estado === 'activo') h += `<select id="caNivel" style="width:auto">${[1, 2, 3].map((n) => `<option value="${n}" ${c.nivel === n ? 'selected' : ''}>Nivel ${n} · ${NIVEL[n]}</option>`).join('')}</select><button class="sec" data-ca="nivel">Cambiar nivel</button>${c.curso_aprobado_en ? '' : '<button class="sec" data-ca="decidir" data-e="curso">Marcar curso aprobado</button>'}<button class="sec" data-ca="nutricion" data-v="${c.puede_nutricion ? '0' : '1'}">${c.puede_nutricion ? 'Quitar planes de alimentación' : 'Autorizar planes de alimentación'}</button><button class="mal" data-ca="decidir" data-e="suspender">Suspender</button>`;
  if (c.estado === 'suspendido') h += '<button data-ca="decidir" data-e="reactivar">Reactivar</button>';
  if (c.estado !== 'baja') h += '<button class="mal" data-ca="decidir" data-e="baja">Dar de baja</button>';
  return h + '</div></div>';
}

async function verDoc(ruta) {
  const r = await fetch(SUPABASE_URL + '/storage/v1/object/sign/coach-docs/' + ruta, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + sesion.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.signedURL) { aviso('No se pudo abrir el documento.'); return; }
  window.open(SUPABASE_URL + '/storage/v1' + d.signedURL, '_blank', 'noopener');
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-ca]'); const raiz = $('coachAdm');
  if (!el || !raiz || !raiz.contains(el)) return;
  if (el.tagName === 'A') e.preventDefault();
  const a = el.dataset.ca, v = el.dataset.v;
  const hacer = async (fn, ok) => { el.disabled = true; try { await fn(); if (ok) aviso(ok, true); await cargar(); } catch (er) { aviso(MSG[er.message] || 'No se pudo: ' + er.message); } finally { el.disabled = false; } };
  const cfg = (k, val) => rpc('admin_coach_config', { p_clave: k, p_valor: val });
  switch (a) {
    case 'filtro': filtro = v; abierto = null; return cargar();
    case 'abrir': if (e.target.closest('.gestion')) return; abierto = abierto === v ? null : v; det = null; return cargar();
    case 'flag': if (!confirm(v === '1' ? '¿Mostrar Coaches a TODOS los usuarios?' : '¿Ocultar Coaches a todos (menos testers)?')) return;
      return hacer(async () => { await cfg('activo', v === '1'); bitacora('Coaches: interruptor', v === '1' ? 'encendido' : 'apagado'); }, 'Listo');
    case 'cobro': if (!confirm(v === '1' ? '¿Volver a exigir el pago a los coaches?' : '¿Dejar entrar coaches SIN pago? Úsalo solo para el piloto.')) return;
      return hacer(async () => { await cfg('cobro_requerido', v === '1'); bitacora('Coaches: cobro requerido', v); }, 'Listo');
    case 'tester': { const id = ($('caTester').value || '').trim(); if (!/^[0-9a-f-]{36}$/i.test(id)) { aviso('Pega el ID de usuario completo (36 caracteres).'); return; }
      const t = (D.config.testers || []).filter((x) => x !== id).concat(id); return hacer(() => cfg('testers', t), 'Tester agregado'); }
    case 'quitar-tester': return hacer(() => cfg('testers', (D.config.testers || []).filter((x) => x !== v)), 'Tester quitado');
    case 'liq': vistaLiq = !vistaLiq; return cargar();
    case 'liq-pagar': { const ref = prompt('Referencia de la transferencia (ej. SPEI y clave de rastreo)'); if (ref == null) return; const fac = prompt('Folio de la factura del coach') || '';
      return hacer(async () => { await rpc('admin_coach_liquidacion_pagada', { p_id: Number(v), p_referencia: ref, p_factura: fac }); bitacora('Coaches: pagó comisión', '#' + v + ' ' + ref); }, 'Marcada como pagada'); }
    case 'ver-doc': return verDoc(v).catch(() => aviso('No se pudo abrir el documento.'));
    case 'doc': { const nota = el.dataset.e === 'rechazado' ? prompt('¿Por qué se rechaza? (lo verá el coach)') : ''; if (nota == null) return;
      return hacer(() => rpc('admin_coach_documento', { p_doc: Number(v), p_estado: el.dataset.e, p_nota: nota })); }
    case 'disputa': if (!confirm(el.dataset.e === '1' ? 'Se reembolsa al cliente y cuenta como falta del coach. ¿Seguro?' : 'Se da por dada la sesión. ¿Seguro?')) return;
      return hacer(async () => { await rpc('admin_sesion_resolver', { p_id: Number(v), p_coach_falto: el.dataset.e === '1' }); bitacora('Coaches: resolvió disputa', '#' + v); }, 'Resuelta');
    case 'nutricion': if (!confirm(v === '1' ? '¿Autorizar a este coach a enviar planes de alimentación? Hazlo solo si validaste su cédula o certificación en nutrición.' : '¿Quitar la autorización? Sus clientes verán solo el plan de la app.')) return;
      return hacer(async () => { await rpc('admin_coach_nutricion', { p_coach: abierto, p_valor: v === '1' }); bitacora('Coaches: alimentación', abierto + ' → ' + v); }, 'Listo');
    case 'nivel': return hacer(async () => { const n = Number($('caNivel').value); await rpc('admin_coach_decidir', { p_coach: abierto, p_accion: 'nivel', p_nivel: n }); bitacora('Coaches: nivel', abierto + ' → ' + n); }, 'Nivel actualizado');
    case 'decidir': {
      const acc = el.dataset.e; let motivo = null;
      if (['rechazar', 'pedir_documento', 'suspender', 'baja'].includes(acc)) { motivo = prompt({ rechazar: 'Motivo del rechazo (lo verá el coach)', pedir_documento: '¿Qué le falta? (lo verá el coach)', suspender: 'Motivo de la suspensión', baja: 'Motivo de la baja (escribe «documento falso» si aplica: cancela sus comisiones)' }[acc]); if (motivo == null) return; }
      else if (acc === 'aprobar' && !confirm('Se activa su perfil, su código y su Premium personal. ¿Aprobar?')) return;
      return hacer(async () => { await rpc('admin_coach_decidir', { p_coach: abierto, p_accion: acc, p_motivo: motivo }); bitacora('Coaches: ' + acc, (det && det.nombre_publico) || abierto); }, 'Hecho');
    }
  }
});
const MSG = { documentos_sin_validar: 'Primero marca como válidos la identificación y al menos una certificación.', estado_invalido: 'Ese cambio no aplica en el estado actual.', solo_admin: 'Tu sesión de admin venció.' };
window.cargarCoaches = cargar;
})();
try { if (typeof tabActiva !== 'undefined' && tabActiva === 'coaches') window.cargarCoaches(true); } catch (e) {}
