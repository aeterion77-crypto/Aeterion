/* ============================================================
   ADMIN · VISITAS DE LA PÁGINA WEB — contador anónimo propio.
   Usa del panel: rpc, esc, aviso.
============================================================ */
(function () {
'use strict';
const $ = (id) => document.getElementById(id);
let D = null, dias = 30;
const NOM = {
  'inicio': 'Inicio', 'productos': 'Productos', 'productos/laboratorio': 'Análisis de laboratorio', 'productos/proximamente': 'Próximamente',
  'productos/mayoreo': 'Mayoreo', 'programas': 'El sistema', 'programas/guias': 'Programas', 'programas/recetas': 'Recetas',
  'educacion': 'Educación', 'nosotros': 'Filosofía', 'nosotros/comunidad': 'Comunidad', 'nosotros/contacto': 'Contacto',
};
const nomRuta = (r) => NOM[r] || (r.startsWith('educacion/') ? 'Educación › ' + r.slice(10).replace(/^(salud|edu|guia|proto)-/, '').replace(/-/g, ' ') : r);
const DISP = { movil: 'Celular', pc: 'Computadora', tablet: 'Tablet', otro: 'Otro' };
const n = (x) => Number(x || 0).toLocaleString('es-MX');

async function cargar(silencioso) {
  const raiz = $('visitasAdm'); if (!raiz) return;
  try { D = await rpc('admin_web_visitas', { p_dias: dias }); }
  catch (e) {
    if (/could not find|does not exist/i.test(e.message || '') || e.status === 404) { raiz.innerHTML = '<div class="card vacio">El contador de visitas aún no está instalado en la base de datos.</div>'; return; }
    throw e;
  }
  pintar();
}
function barras(lista, k, etiqueta) {
  const max = Math.max(1, ...lista.map((x) => Number(x[k]) || 0));
  return lista.length ? lista.map((x) => `<div class="vw-fila"><span class="vw-et">${esc(etiqueta(x))}</span><span class="vw-barra"><i style="width:${Math.max(2, (Number(x[k]) || 0) / max * 100)}%"></i></span><b>${n(x[k])}</b></div>`).join('') : '<div class="peq">Sin datos todavía.</div>';
}
function pintar() {
  const R = D.resumen || {}, dia = D.por_dia || [];
  const max = Math.max(1, ...dia.map((x) => x.visitantes));
  const cada = Math.ceil(dia.length / 8);
  const fd = (s) => { const d = new Date(s + 'T12:00:00'); return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); };
  let h = `<div class="fila" style="margin-bottom:12px">${[[7, '7 días'], [30, '30 días'], [90, '90 días']].map(([k, t]) => `<button class="${dias === k ? '' : 'sec'}" data-vw="dias" data-v="${k}">${t}</button>`).join('')}<button class="sec" data-vw="recargar">Actualizar</button></div>
  <div class="kpis"><div class="kpi"><small>Visitantes (${D.dias} días)</small><b style="color:var(--oro)">${n(R.visitantes)}</b></div><div class="kpi"><small>Hoy</small><b>${n(R.hoy)}</b></div>
    <div class="kpi"><small>En la página ahora</small><b>${n(R.en_linea)}</b></div><div class="kpi"><small>Páginas vistas</small><b>${n(R.vistas)}</b></div></div>
  <div class="card" style="margin-bottom:14px"><b>Visitantes por día</b>
    <div class="vw-graf" role="img" aria-label="Visitantes por día">${dia.map((x, i) => `<div class="vw-col" title="${fd(x.d)}: ${x.visitantes} visitantes, ${x.vistas} páginas"><i style="height:${x.visitantes ? Math.max(3, x.visitantes / max * 100) : 0}%"></i><small>${i % cada === 0 ? fd(x.d) : ''}</small></div>`).join('')}</div>
    <div class="peq">Máximo en un día: ${n(max === 1 && !dia.some((x) => x.visitantes) ? 0 : max)} · Nuevos en el periodo: ${n(R.nuevos)}</div></div>
  <div class="kpis"><div class="kpi"><small>Clic WhatsApp mayoreo</small><b style="color:var(--oro)">${n(R.wa_mayoreo)}</b></div><div class="kpi"><small>Clic WhatsApp (otros)</small><b>${n(R.wa)}</b></div>
    <div class="kpi"><small>Agregar al carrito</small><b>${n(R.carrito)}</b></div><div class="kpi"><small>Abrir la app</small><b>${n(R.app)}</b></div></div>
  <div class="vw-dos">
    <div class="card"><b>Secciones más vistas</b><div style="margin-top:10px">${barras(D.secciones || [], 'vistas', (x) => nomRuta(x.ruta))}</div></div>
    <div class="card"><b>De dónde llegan</b><div style="margin-top:10px">${barras(D.origenes || [], 'visitantes', (x) => x.origen)}</div>
      <div style="margin-top:14px"><b>Dispositivo</b></div><div style="margin-top:10px">${barras(D.dispositivos || [], 'visitantes', (x) => DISP[x.disp] || x.disp)}</div></div>
  </div>
  <div class="peq" style="margin-top:12px">Contador anónimo: cada navegador cuenta como un visitante; no guarda nombres, correos ni IP. «Directo» = escribieron la dirección o entraron desde un enlace sin origen (por ejemplo, un chat de WhatsApp en algunos celulares). Para saber de dónde viene cada campaña, comparte tus enlaces con <code>?utm_source=instagram</code> (o tiktok, facebook…).</div>`;
  $('visitasAdm').innerHTML = h;
}
const css = document.createElement('style');
css.textContent = `
.vw-graf{display:flex;align-items:flex-end;gap:2px;height:170px;margin:14px 0 8px;padding-bottom:22px;position:relative}
.vw-col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;position:relative;min-width:0}
.vw-col i{display:block;background:var(--oro);border-radius:3px 3px 0 0;min-height:0}
.vw-col:hover i{filter:brightness(1.2)}
.vw-col small{position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);font-size:10.5px;color:var(--gris,#999);white-space:nowrap}
.vw-dos{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:760px){.vw-dos{grid-template-columns:1fr}}
.vw-fila{display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;gap:8px;align-items:center;margin:6px 0;font-size:13.5px}
.vw-et{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vw-barra{height:10px;border-radius:6px;background:rgba(255,255,255,.06);overflow:hidden}
.vw-barra i{display:block;height:100%;background:var(--oro);border-radius:6px}
`;
document.head.appendChild(css);
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-vw]'); if (!el || !$('visitasAdm') || !$('visitasAdm').contains(el)) return;
  if (el.dataset.vw === 'dias') dias = Number(el.dataset.v) || 30;
  try { await cargar(); } catch (er) { aviso('No se pudo cargar.'); }
});
window.cargarVisitasAdm = cargar;
})();
try { if (typeof tabActiva !== 'undefined' && tabActiva === 'visitas') window.cargarVisitasAdm(true); } catch (e) {}
