/* ============================================================
   ADMIN · AETERION GYM — alta de gimnasios clientes, plan por sede,
   estado y pago de su mensualidad.
   Usa del panel: rpc, esc, aviso, bitacora, money, fechaDia.
============================================================ */
(function () {
'use strict';
const $ = (id) => document.getElementById(id);
const EST = { prueba: ['Prueba', 'amarillo'], activo: ['Activo', 'verde'], suspendido: ['Suspendido', 'rojo'], baja: ['Baja', 'gris'] };
const MSG = { cuenta_no_encontrada: 'Ese correo no tiene cuenta en Aeterion. Pídele que se registre en la app primero.', falta_dueno: 'Escribe el correo del dueño.', falta_nombre: 'Escribe el nombre del gimnasio.', solo_admin: 'Tu sesión de admin venció.', valor_invalido: 'Revisa los planes.' };
let D = null, editando = null;

async function cargar(silencioso) {
  const raiz = $('gymAdm'); if (!raiz) return;
  if (silencioso && raiz.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  try { D = await rpc('admin_gyms'); }
  catch (e) {
    if (/could not find|does not exist|404/i.test(e.message || '') || e.status === 404) { raiz.innerHTML = '<div class="card vacio">El módulo Aeterion Gym aún no está instalado en la base de datos.</div>'; return; }
    throw e;
  }
  pintar();
}
const planes = () => (D.config && D.config.planes) || {};
function form(g) {
  const P = planes(); g = g || {};
  return `<div class="card" style="margin-bottom:14px"><div class="cab"><b>${g.id ? 'Editar gimnasio' : 'Nuevo gimnasio cliente'}</b>${g.id ? '<button class="sec mini" data-ga="cancelar">Cancelar</button>' : ''}</div>
    <div class="peq" style="margin:4px 0 10px">El dueño debe tener cuenta en la app con ese correo. Al crearlo se agrega la sede «Principal» y un plan «Mensual» que él ajusta.</div>
    <div class="fila"><input id="gaNom" placeholder="Nombre del gimnasio" maxlength="80" value="${esc(g.nombre || '')}"><input id="gaCiudad" placeholder="Ciudad" maxlength="80" value="${esc(g.ciudad || '')}"></div>
    <div class="fila" style="margin-top:8px"><input id="gaTel" placeholder="Teléfono" maxlength="20" value="${esc(g.telefono || '')}"><input id="gaDueno" type="email" placeholder="${g.id ? 'Cambiar dueño (correo, opcional)' : 'Correo del dueño'}" maxlength="120"></div>
    <div class="fila" style="margin-top:8px">
      <select id="gaPlan">${Object.keys(P).map((k) => `<option value="${k}" ${(g.plan || 'piloto') === k ? 'selected' : ''}>${esc(P[k].nombre || k)} · ${money(P[k].precio)}/sede · ${P[k].socios} socios</option>`).join('')}</select>
      <input id="gaSedes" type="number" min="1" max="20" value="${g.sedes_max || 1}" title="Sedes" style="max-width:90px">
      <select id="gaEstado">${['prueba', 'activo', 'suspendido', 'baja'].map((k) => `<option value="${k}" ${(g.estado || 'prueba') === k ? 'selected' : ''}>${EST[k][0]}</option>`).join('')}</select>
      <input id="gaPagado" type="date" value="${g.pagado_hasta ? String(g.pagado_hasta).slice(0, 10) : ''}" title="Pagado hasta"></div>
    <div class="peq" style="margin-top:6px">«Prueba» no hace visible la tarjeta «Mi gimnasio» para todos los usuarios; «Activo» sí (los socios pueden vincularse con su código).</div>
    <div class="fila" style="margin-top:10px"><button data-ga="guardar" data-v="${g.id || ''}">${g.id ? 'Guardar cambios' : 'Crear gimnasio'}</button></div></div>`;
}
function pintar() {
  const L = D.lista || [], P = planes();
  const mrr = L.filter((g) => g.estado === 'activo').reduce((a, g) => a + Number((P[g.plan] || {}).precio || 0) * (g.sedes_max || 1), 0);
  let h = `<div class="kpis"><div class="kpi"><small>Gimnasios</small><b>${L.length}</b></div><div class="kpi"><small>Activos</small><b style="color:var(--oro)">${L.filter((g) => g.estado === 'activo').length}</b></div>
    <div class="kpi"><small>Mensualidad activa</small><b>${money(mrr)}</b></div><div class="kpi"><small>Socios en total</small><b>${L.reduce((a, g) => a + Number(g.socios || 0), 0)}</b></div></div>`;
  h += form(editando ? L.find((g) => g.id === editando) : null);
  const hoy = new Date().toISOString().slice(0, 10);
  h += L.length ? L.map((g) => { const e = EST[g.estado] || [g.estado, 'gris']; const vencido = g.estado === 'activo' && g.pagado_hasta && String(g.pagado_hasta).slice(0, 10) < hoy;
    return `<div class="card" style="margin-bottom:10px"><div class="cab"><div style="min-width:0"><div class="nom">${esc(g.nombre)}${g.ciudad ? ' · ' + esc(g.ciudad) : ''}</div>
      <div class="peq">${esc(g.dueno || 'sin dueño')} · ${esc((P[g.plan] || {}).nombre || g.plan)} × ${g.sedes_max} ${g.sedes_max === 1 ? 'sede' : 'sedes'} = ${money(Number((P[g.plan] || {}).precio || 0) * g.sedes_max)}/mes</div>
      <div class="peq">${g.socios} socios (${g.al_corriente} al corriente) · ${g.staff} en equipo · ${g.asistencias_30} entradas en 30 días · pagado hasta ${esc(fechaDia(g.pagado_hasta))}${vencido ? ' <b style="color:var(--rojo)">VENCIDO</b>' : ''}</div></div>
      <span class="badge ${e[1]}">${e[0]}</span></div>
      <div class="fila" style="margin-top:8px"><button class="sec mini" data-ga="editar" data-v="${g.id}">Editar</button><button class="sec mini" data-ga="mes" data-v="${g.id}">Registrar mes pagado</button></div></div>`; }).join('')
    : '<div class="card vacio">Aún no hay gimnasios clientes.</div>';
  h += `<details class="card" style="margin-top:14px"><summary><b>Precios de los planes</b></summary><div class="peq" style="margin:6px 0">Precio mensual por sede y límites por sede.</div>
    ${Object.keys(P).map((k) => `<div class="fila" style="margin-top:6px"><span style="min-width:90px">${esc(P[k].nombre || k)}</span><input data-gp="${k}" data-c="precio" type="number" value="${P[k].precio}" title="Precio"><input data-gp="${k}" data-c="socios" type="number" value="${P[k].socios}" title="Socios"><input data-gp="${k}" data-c="staff" type="number" value="${P[k].staff}" title="Personas"></div>`).join('')}
    <div class="peq">Columnas: precio · socios · personas del equipo.</div><button style="margin-top:8px" data-ga="planes">Guardar precios</button></details>`;
  $('gymAdm').innerHTML = h;
}
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-ga]'); if (!el || !$('gymAdm') || !$('gymAdm').contains(el)) return;
  const a = el.dataset.ga, v = el.dataset.v;
  const hacer = async (fn, ok) => { el.disabled = true; try { await fn(); if (ok) aviso(ok, true); } catch (er) { aviso(MSG[er.message] || 'No se pudo: ' + er.message); } finally { el.disabled = false; } };
  if (a === 'editar') { editando = v; pintar(); window.scrollTo(0, 0); return; }
  if (a === 'cancelar') { editando = null; pintar(); return; }
  if (a === 'guardar') return hacer(async () => {
    const p = { id: v || null, nombre: $('gaNom').value, ciudad: $('gaCiudad').value, telefono: $('gaTel').value, dueno_email: $('gaDueno').value.trim(), plan: $('gaPlan').value, sedes_max: $('gaSedes').value, estado: $('gaEstado').value, pagado_hasta: $('gaPagado').value };
    D = await rpc('admin_gym_guardar', { p }); bitacora(v ? 'Gym: editó' : 'Gym: creó', p.nombre + (p.dueno_email ? ' · ' + p.dueno_email : '')); editando = null; pintar();
  }, v ? 'Guardado' : 'Gimnasio creado');
  if (a === 'mes') { const g = D.lista.find((x) => x.id === v); const base = g.pagado_hasta && new Date(g.pagado_hasta) > new Date() ? new Date(g.pagado_hasta) : new Date(); base.setMonth(base.getMonth() + 1);
    const f = base.toISOString().slice(0, 10); if (!confirm(`¿Registrar un mes pagado de ${g.nombre}? Quedará pagado hasta el ${fechaDia(f)} y activo.`)) return;
    return hacer(async () => { D = await rpc('admin_gym_guardar', { p: { id: g.id, nombre: g.nombre, ciudad: g.ciudad || '', telefono: g.telefono || '', estado: 'activo', pagado_hasta: f } }); bitacora('Gym: mes pagado', g.nombre + ' → ' + f); pintar(); }, 'Mes registrado'); }
  if (a === 'planes') return hacer(async () => {
    const P = JSON.parse(JSON.stringify(planes()));
    document.querySelectorAll('#gymAdm [data-gp]').forEach((i) => { const n = Number(i.value); if (!(n >= 0)) throw new Error('valor_invalido'); P[i.dataset.gp][i.dataset.c] = n; });
    D = await rpc('admin_gym_config', { p_planes: P }); bitacora('Gym: precios de planes', JSON.stringify(P)); pintar();
  }, 'Precios guardados');
});
window.cargarGymsAdm = cargar;
})();
try { if (typeof tabActiva !== 'undefined' && tabActiva === 'aetgym') window.cargarGymsAdm(true); } catch (e) {}
