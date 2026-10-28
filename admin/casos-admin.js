/* ============================================================
   ADMIN · REPORTES Y CASOS — reportes de alumnos y coaches,
   reembolsos, mensajes de coaches y solicitudes de mayoreo.
   Usa del panel: rpc, esc, aviso, bitacora, fechaDia.
============================================================ */
(function () {
'use strict';
const $ = (id) => document.getElementById(id);
const TIPOS = { conducta: 'Trato o conducta', reembolso: 'Reembolso', pago: 'Pago o cobro', seguridad: 'Seguridad o salud', acoso: 'Acoso', mensaje: 'Mensaje', mayoreo: 'Mayoreo (gimnasio)', otro: 'Otro' };
const ROL = { cliente: 'Alumno', coach: 'Coach', gym: 'Gimnasio', socio: 'Socio', usuario: 'Usuario' };
const EST = { abierto: ['Abierto', 'amarillo'], en_revision: ['En revisión', 'amarillo'], resuelto: ['Resuelto', 'verde'], cerrado: ['Cerrado', 'gris'] };
let D = null, filtro = null, abierto = null;
const hora = (s) => { try { return new Date(s).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } };

async function cargar(silencioso) {
  const raiz = $('casosAdm'); if (!raiz) return;
  if (silencioso && raiz.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  try { D = await rpc('admin_casos', { p_estado: filtro }); }
  catch (e) { if (/could not find|does not exist|404/i.test(e.message || '') || e.status === 404) { raiz.innerHTML = '<div class="card vacio">Los reportes aún no están instalados en la base de datos.</div>'; return; } throw e; }
  pintar();
}
function pintar() {
  const R = D.resumen || {};
  let h = `<div class="kpis"><div class="kpi"><small>Abiertos</small><b style="color:var(--oro)">${R.abiertos || 0}</b></div><div class="kpi"><small>En revisión</small><b>${R.en_revision || 0}</b></div>
    <div class="kpi"><small>Reembolsos pendientes</small><b>${R.reembolsos || 0}</b></div><div class="kpi"><small>Mayoreo pendiente</small><b>${R.mayoreo || 0}</b></div></div>`;
  h += `<div class="fila" style="margin-bottom:12px">${[[null, 'Pendientes'], ['resuelto', 'Resueltos'], ['cerrado', 'Cerrados']].map(([k, n]) => `<button class="${filtro === k ? '' : 'sec'}" data-cs="filtro" data-v="${k || ''}">${n}</button>`).join('')}</div>`;
  h += D.lista.length ? D.lista.map((c) => {
    const e = EST[c.estado] || [c.estado, 'gris'], ab = abierto === c.id;
    return `<div class="card" style="margin-bottom:10px"><div class="cab" data-cs="abrir" data-v="${c.id}" style="cursor:pointer"><div style="min-width:0"><div class="nom">#${c.id} · ${esc(TIPOS[c.tipo] || c.tipo)} · ${esc(ROL[c.rol] || c.rol)}</div>
      <div class="peq" style="overflow-wrap:anywhere">${esc(c.autor_nombre || '')} ${esc(c.autor_email || '')}${c.contra_email ? ' → sobre ' + esc(c.contra_nombre || '') + ' (' + esc(c.contra_email) + ')' : ''} · ${hora(c.creado_en)}${c.sin_leer ? ` · <b style="color:var(--oro)">${c.sin_leer} nuevo(s)</b>` : ''}</div></div><span class="badge ${e[1]}">${e[0]}</span></div>
      <p style="white-space:pre-wrap;margin:8px 0">${esc(c.texto)}</p>${c.ref && Object.keys(c.ref).length ? `<div class="peq">Referencia: ${esc(JSON.stringify(c.ref))}</div>` : ''}
      ${ab ? `${c.mensajes.map((m) => `<div class="peq" style="margin:6px 0;padding:6px 8px;border-radius:8px;background:${m.de_admin ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.04)'}"><b>${m.de_admin ? 'Aeterion' : 'Usuario'}</b> · ${hora(m.fecha)}<br>${esc(m.texto)}</div>`).join('')}
        <textarea id="csResp" rows="3" placeholder="Respuesta (la ve el usuario en la app)" style="width:100%;margin-top:8px"></textarea>
        <div class="fila" style="margin-top:8px"><select id="csEst" style="width:auto">${Object.keys(EST).map((k) => `<option value="${k}" ${k === c.estado ? 'selected' : ''}>${EST[k][0]}</option>`).join('')}</select><button data-cs="responder" data-v="${c.id}">Guardar y responder</button></div>
        <div class="peq" style="margin-top:6px">Reembolsos de sesiones: resuélvelos en Coaches › disputas o en Stripe. Si un coach falta de forma grave, suspéndelo en Coaches.</div>` : '<div class="peq">Toca para ver y responder.</div>'}</div>`;
  }).join('') : '<div class="card vacio">Nada por aquí.</div>';
  $('casosAdm').innerHTML = h;
}
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-cs]'); if (!el || !$('casosAdm') || !$('casosAdm').contains(el)) return;
  const a = el.dataset.cs, v = el.dataset.v;
  if (a === 'filtro') { filtro = v || null; abierto = null; return cargar(); }
  if (a === 'abrir') { abierto = abierto === Number(v) ? null : Number(v); return pintar(); }
  if (a === 'responder') {
    el.disabled = true;
    try { const t = $('csResp').value, est = $('csEst').value; await rpc('admin_caso_responder', { p_caso: Number(v), p_texto: t, p_estado: est }); bitacora('Casos: respondió', '#' + v + ' → ' + est); aviso('Guardado', true); await cargar(); }
    catch (er) { aviso('No se pudo: ' + er.message); } finally { el.disabled = false; }
  }
});
window.cargarCasosAdm = cargar;
})();
try { if (typeof tabActiva !== 'undefined' && tabActiva === 'casos') window.cargarCasosAdm(true); } catch (e) {}
