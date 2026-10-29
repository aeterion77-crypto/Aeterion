/* ============================================================
   AETERION · TRIVIA — 15 niveles de salud, nutrición, entrenamiento
   y fisiología. Separada del prototipo «Aeterion Arena» (sin peleas,
   sin gemas ni monedas). El banco de preguntas (trivia-preguntas.js)
   se carga solo al abrir la trivia.
   El avance vive en localStorage «aet_trivia» y se sincroniza con la
   cuenta como el resto de la app.
============================================================ */
(function () {
'use strict';
const KEY = 'aet_trivia';
const NIVELES = 15, PPN = 8;                       // niveles y preguntas por nivel
const TIEMPO = { 1: 10, 2: 12, 3: 14, 4: 17, 5: 20 }; // segundos por pregunta según bloque
const BLOQUES = ['', 'Básico', 'Intermedio', 'Avanzado', 'Experto', 'Élite'];
const RAYOS = 3, RAYO_MS = 3 * 3600e3;              // un rayo se recupera cada 3 horas
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('es-MX');
const bloqueDe = (L) => Math.ceil(L / 3);
const hoy = () => (window.AET ? AET.hoy() : new Date().toISOString().slice(0, 10));
const toast = (t) => { try { aetToast(t); } catch (e) {} };
const premium = () => { try { return typeof tienePremiumLocal === 'function' && tienePremiumLocal(); } catch (e) { return false; } };

/* ---------------- Estado ---------------- */
function leer() {
  let d = null; try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  d = Object.assign({ puntos: 0, nivel: 1, estrellas: {}, mejor: {}, rayos: RAYOS, rayoT: 0, vistas: {}, partidas: 0, aciertos: 0, respondidas: 0, recargaPrem: null, t: 0 }, d || {});
  return regenerar(d);
}
function guardar(d) { d.t = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
function regenerar(d) {
  if (d.rayos >= RAYOS) { d.rayos = RAYOS; return d; }
  const n = Math.floor((Date.now() - (d.rayoT || Date.now())) / RAYO_MS);
  if (n > 0) { d.rayos = Math.min(RAYOS, d.rayos + n); d.rayoT = d.rayos >= RAYOS ? 0 : d.rayoT + n * RAYO_MS; }
  return d;
}
function quitarRayo(d) { if (d.rayos >= RAYOS) d.rayoT = Date.now(); d.rayos = Math.max(0, d.rayos - 1); }
function faltaRayo(d) { if (d.rayos >= RAYOS || !d.rayoT) return 0; return Math.max(0, d.rayoT + RAYO_MS - Date.now()); }
const durTxt = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`; };

/* ---------------- Preguntas (carga diferida) ---------------- */
let QB = null;
function cargarPreguntas() {
  if (QB) return Promise.resolve(QB);
  if (window.QB) return Promise.resolve(QB = window.QB);
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'trivia-preguntas.js?v=1'; s.onload = () => ok(QB = window.QB); s.onerror = () => no(new Error('red')); document.head.appendChild(s); });
}
function barajar(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function elegir(d, b) {
  const banco = QB[b] || []; let vistas = (d.vistas[b] || []).filter((i) => i < banco.length);
  let libres = banco.map((_, i) => i).filter((i) => !vistas.includes(i));
  if (libres.length < PPN) { vistas = []; libres = banco.map((_, i) => i); }
  const ids = barajar(libres).slice(0, PPN); d.vistas[b] = [...vistas, ...ids];
  return ids.map((i) => { const q = banco[i]; const ops = barajar([{ t: q[2], ok: true }, { t: q[3] }, { t: q[4] }, { t: q[5] }]); return { c: q[0], q: q[1], e: q[6], ops, r: ops.findIndex((o) => o.ok) }; });
}

/* ---------------- Vistas ---------------- */
let J = null, raf = 0, reloj = 0;
const rayosHtml = (n, perdido) => Array.from({ length: RAYOS }, (_, i) => `<svg class="tv-rayo ${i < n ? '' : 'off'} ${i === perdido ? 'perdido' : ''}" viewBox="0 0 24 30" aria-hidden="true"><path d="M14.5 1 3 17h7.2L8 29l13-17h-7.6z"/></svg>`).join('');
function raiz() { return $('triviaApp'); }

function mapa() {
  const r = raiz(); if (!r) return; J = null; cancelAnimationFrame(raf);
  const d = leer(); guardar(d);
  const total = QB ? Object.values(QB).reduce((a, x) => a + x.length, 0) : 180;
  const L = Math.min(d.nivel, NIVELES); const superados = Object.keys(d.estrellas).length;
  const precision = d.respondidas ? Math.round(d.aciertos * 100 / d.respondidas) : 0;
  let h = `<button class="app-visor-volver" onclick="aetIr('educacion')">← Volver a Educación</button>
    <div class="tv-cab"><div><h2 class="app-titulo">Trivia Aeterion</h2><p class="app-subtitulo">${NIVELES} niveles · ${total} preguntas. De lo básico a fisiología de élite.</p></div>
      <div class="tv-energia"><div class="tv-rayos" aria-label="${d.rayos} de ${RAYOS} rayos">${rayosHtml(d.rayos)}</div><small>${d.rayos} de ${RAYOS} rayos</small></div></div>
    <div class="tv-stats"><div><b>${fmt(d.puntos)}</b><span>Puntos</span></div><div><b>${L}</b><span>Nivel actual</span></div><div><b>${superados}</b><span>Superados</span></div><div><b>${precision}%</b><span>Precisión</span></div></div>`;
  if (d.rayos <= 0) {
    const ms = faltaRayo(d); const puede = premium() && d.recargaPrem !== hoy();
    h += `<div class="tv-card tv-sin"><b>Sin energía</b><p>Recuperas 1 rayo cada 3 horas. El siguiente llega en <b id="tvFalta">${durTxt(ms)}</b>.</p>
      ${puede ? '<button class="tv-btn" data-tv="recarga">Recargar 3 rayos ahora · Premium</button><p class="tv-peq">Con Premium tienes una recarga inmediata al día.</p>' : premium() ? '<p class="tv-peq">Ya usaste tu recarga Premium de hoy.</p>' : '<p class="tv-peq">Con Premium tienes una recarga inmediata al día.</p>'}</div>`;
  } else {
    h += `<button class="tv-btn tv-btn-grande" data-tv="jugar" data-l="${L}">${d.estrellas[NIVELES] ? 'Repetir nivel ' + NIVELES : 'Jugar nivel ' + L}</button>
      <p class="tv-peq tv-centro">${BLOQUES[bloqueDe(L)]} · ${TIEMPO[bloqueDe(L)]} s por pregunta · ${PPN} preguntas${d.rayos < RAYOS ? ` · próximo rayo en ${durTxt(faltaRayo(d))}` : ''}</p>`;
  }
  h += '<div class="tv-bloques">';
  for (let b = 1; b <= 5; b++) {
    h += `<div class="tv-bloque"><div class="tv-bloque-n"><b>${BLOQUES[b]}</b><small>${TIEMPO[b]} s · ${b * 100} pts por acierto</small></div><div class="tv-niveles">`;
    for (let i = 0; i < 3; i++) {
      const n = (b - 1) * 3 + i + 1, st = d.estrellas[n], bloq = n > d.nivel;
      h += (i ? '<span class="tv-linea"></span>' : '') + `<button class="tv-nv ${st ? 'hecho' : n === d.nivel ? 'actual' : bloq ? 'bloq' : ''}" data-tv="jugar" data-l="${n}" ${bloq ? 'disabled' : ''} aria-label="Nivel ${n}">${n}<small>${st ? '★'.repeat(st) + '☆'.repeat(3 - st) : bloq ? '🔒' : ''}</small></button>`;
    }
    h += '</div></div>';
  }
  h += `</div><details class="tv-card tv-reglas"><summary>Cómo se juega</summary><ul>
    <li>Cada nivel tiene ${PPN} preguntas con tiempo. Mientras más rápido aciertes, más puntos; las rachas suman extra.</li>
    <li>Cada respuesta incorrecta o fuera de tiempo te quita 1 rayo. Si te quedas sin rayos pierdes el avance del nivel que jugabas.</li>
    <li>Recuperas 1 rayo cada 3 horas. Al superar los niveles 5 y 10 ganas 1 rayo.</li>
    <li>Los puntos solo cuentan la primera vez que superas un nivel. Repetir sirve para mejorar tus estrellas.</li>
    <li>Las respuestas demasiado rápidas (sin leer) hacen que el nivel no cuente.</li></ul></details>`;
  r.innerHTML = h;
  clearInterval(reloj); if (d.rayos < RAYOS) reloj = setInterval(() => { if (!J && raiz() && document.querySelector('#app-screen-trivia.activo')) { const x = leer(); if (x.rayos !== d.rayos) mapa(); else { const f = $('tvFalta'); if (f) f.textContent = durTxt(faltaRayo(x)); } } }, 30000);
}

async function jugar(L) {
  const d = leer();
  if (d.rayos <= 0) { toast('No tienes rayos. Recuperas 1 cada 3 horas.'); return mapa(); }
  if (L > d.nivel || L < 1 || L > NIVELES) return;
  try { await cargarPreguntas(); } catch (e) { toast('Sin conexión: no se pudieron cargar las preguntas.'); return; }
  const b = bloqueDe(L);
  J = { L, b, lista: elegir(d, b), i: 0, pts: 0, ok: 0, racha: 0, rapidas: 0, res: [], repite: !!d.estrellas[L], tiempo: TIEMPO[b] };
  guardar(d);
  const r = raiz();
  r.innerHTML = `<div class="tv-juego"><div class="tv-top"><button class="tv-salir" data-tv="salir" aria-label="Salir del nivel">✕</button><div class="tv-nivel">Nivel ${L} · ${BLOQUES[b]}${J.repite ? ' · repetición' : ''}</div><div class="tv-rayos" id="tvRayos"></div></div>
    <div class="tv-reloj"><b id="tvSeg">${J.tiempo}</b><div class="tv-barra"><i id="tvBarra"></i></div><span class="tv-pts" id="tvPts">0 pts</span></div>
    <div class="tv-meta"><span id="tvNum"></span><div class="tv-puntos" id="tvPuntos"></div><span id="tvCat" class="tv-cat"></span></div>
    <div class="tv-q" id="tvQ"></div><div class="tv-ops" id="tvOps"></div>
    <div class="tv-revela" id="tvRevela" hidden><b id="tvRh"></b><p id="tvExp"></p><div class="tv-revela-pie"><small id="tvGana"></small><button class="tv-btn" data-tv="sig" id="tvSig">Siguiente</button></div></div></div>`;
  window.scrollTo(0, 0);
  pregunta();
}
const puntosHtml = () => Array.from({ length: PPN }, (_, i) => `<i class="${J.res[i] === true ? 'ok' : J.res[i] === false ? 'no' : i === J.i && !J.listo ? 'act' : ''}"></i>`).join('');
function pregunta() {
  const q = J.lista[J.i], d = leer(); J.listo = false;
  $('tvNum').textContent = `Pregunta ${J.i + 1} de ${PPN}`; $('tvCat').textContent = q.c; $('tvQ').textContent = q.q;
  $('tvPts').textContent = fmt(J.pts) + ' pts'; $('tvRayos').innerHTML = rayosHtml(d.rayos); $('tvPuntos').innerHTML = puntosHtml(); $('tvRevela').hidden = true;
  $('tvOps').innerHTML = q.ops.map((o, i) => `<button class="tv-op" data-tv="resp" data-o="${i}"><span>${'ABCD'[i]}</span>${esc(o.t)}</button>`).join('');
  J.ini = performance.now();
  const tic = (now) => {
    if (!J || J.listo) return; const t = (now - J.ini) / 1000, resta = Math.max(0, J.tiempo - t);
    const s = $('tvSeg'), br = $('tvBarra'); if (!s) { J = null; return; }
    s.textContent = Math.ceil(resta); br.style.width = (resta / J.tiempo * 100) + '%'; br.parentElement.classList.toggle('poco', resta < 3);
    if (resta <= 0) return responder(null);
    raf = requestAnimationFrame(tic);
  };
  raf = requestAnimationFrame(tic);
}
function responder(idx) {
  if (!J || J.listo) return; J.listo = true; cancelAnimationFrame(raf);
  const q = J.lista[J.i], t = (performance.now() - J.ini) / 1000, ok = idx === q.r, d = leer();
  if (idx !== null && t < 0.45) J.rapidas++;
  let pts = 0;
  if (ok) { J.racha++; J.ok++; pts = J.b * 100 + Math.round(J.b * 50 * Math.max(0, 1 - t / J.tiempo)) + Math.min(J.racha - 1, 5) * 10 * J.b; }
  else { J.racha = 0; quitarRayo(d); }
  d.respondidas++; if (ok) d.aciertos++; guardar(d);
  J.res[J.i] = ok; J.pts += pts;
  document.querySelectorAll('#tvOps .tv-op').forEach((b, i) => { b.disabled = true; if (i === q.r) b.classList.add('ok'); else if (i === idx) b.classList.add('no'); });
  $('tvRayos').innerHTML = rayosHtml(d.rayos, ok ? undefined : d.rayos);
  const rh = $('tvRh'); rh.textContent = idx === null ? 'Se acabó el tiempo · −1 rayo' : ok ? '¡Correcto!' : 'Incorrecto · −1 rayo'; rh.className = ok ? 'ok' : 'no';
  $('tvExp').textContent = 'Respuesta: ' + q.ops[q.r].t + '. ' + q.e;
  $('tvGana').textContent = ok ? `+${fmt(pts)} pts · ${t.toFixed(1)} s${J.racha > 1 ? ' · racha x' + J.racha : ''}` : d.rayos > 0 ? `Te ${d.rayos === 1 ? 'queda 1 rayo' : 'quedan ' + d.rayos + ' rayos'}` : 'Te quedaste sin energía';
  $('tvPts').textContent = fmt(J.pts) + ' pts'; $('tvPuntos').innerHTML = puntosHtml();
  $('tvSig').textContent = d.rayos <= 0 || J.i === PPN - 1 ? 'Ver resultado' : 'Siguiente';
  try { navigator.vibrate && navigator.vibrate(ok ? 30 : [60, 40, 60]); } catch (e) {}
  $('tvRevela').hidden = false; $('tvRevela').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function siguiente() {
  if (!J) return; const d = leer();
  if (d.rayos <= 0) return fin(false);
  if (J.i < PPN - 1) { J.i++; pregunta(); window.scrollTo(0, 0); } else fin(true);
}
function fin(paso) {
  const T = J; J = null; const d = leer(); d.partidas++;
  const chips = []; let tit, sub;
  if (paso) {
    const st = T.ok >= PPN ? 3 : T.ok >= PPN - 1 ? 2 : 1, valido = T.rapidas < 3;
    if (!T.repite && valido) {
      const extra = T.b * 200, tot = T.pts + extra; d.puntos += tot; d.mejor[T.L] = tot;
      chips.push(`+${fmt(tot)} pts (incluye ${fmt(extra)} por superar el nivel)`);
      d.nivel = Math.max(d.nivel, Math.min(NIVELES, T.L + 1));
      if ((T.L === 5 || T.L === 10) && d.rayos < RAYOS) { d.rayos++; if (d.rayos >= RAYOS) d.rayoT = 0; chips.push('+1 rayo por llegar a un nuevo bloque'); }
      if (T.L < NIVELES) chips.push(`Desbloqueaste el nivel ${T.L + 1}`);
    } else if (!valido) chips.push('No cuenta: respuestas demasiado rápidas. Léelas con calma.');
    else { chips.push('Repetición: mejora tus estrellas, no suma puntos'); if (T.pts > (d.mejor[T.L] || 0)) d.mejor[T.L] = T.pts; }
    if (valido) d.estrellas[T.L] = Math.max(d.estrellas[T.L] || 0, st);
    tit = T.L === NIVELES && !T.repite ? '¡Maestro Aeterion!' : `Nivel ${T.L} superado`;
    sub = `${'★'.repeat(st)}${'☆'.repeat(3 - st)} · ${T.ok} de ${PPN} correctas · ${fmt(T.pts)} pts`;
  } else {
    tit = 'Sin energía'; sub = `Perdiste el avance del nivel ${T.L} y los ${fmt(T.pts)} pts que llevabas.`;
    chips.push(`Recuperas 1 rayo cada 3 horas (el siguiente en ${durTxt(faltaRayo(d))})`);
  }
  guardar(d);
  try { if (typeof aetEvento === 'function') aetEvento(paso ? 'trivia_nivel' : 'trivia_sin_rayos'); } catch (e) {}
  const puede = !paso && premium() && d.recargaPrem !== hoy();
  raiz().innerHTML = `<div class="tv-fin ${paso ? 'ok' : 'no'}"><div class="tv-fin-cab"><div><h2>${tit}</h2><p>${sub}</p></div><div class="tv-rayos">${rayosHtml(d.rayos)}</div></div>
    <div class="tv-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    <div class="tv-fin-btns">${paso && d.rayos > 0 && T.L < NIVELES ? `<button class="tv-btn" data-tv="jugar" data-l="${T.L + 1}">Jugar nivel ${T.L + 1}</button>` : ''}
      ${puede ? '<button class="tv-btn" data-tv="recarga">Recargar 3 rayos · Premium</button>' : ''}
      ${paso && d.rayos > 0 ? `<button class="tv-btn tv-sec" data-tv="jugar" data-l="${T.L}">Repetir nivel ${T.L}</button>` : ''}
      <button class="tv-btn tv-sec" data-tv="mapa">Ver niveles</button></div></div>`;
  window.scrollTo(0, 0);
  if (paso && T.L === NIVELES && !T.repite) confeti();
}
function confeti() {
  for (let i = 0; i < 24; i++) { const g = document.createElement('i'); g.className = 'tv-confeti'; g.style.left = Math.random() * 100 + '%'; g.style.background = ['#c9a84c', '#7fd8ff', '#3fb37f', '#fff'][i % 4]; g.style.animationDelay = Math.random() * 0.6 + 's'; document.body.appendChild(g); setTimeout(() => g.remove(), 3200); }
}
function salir() {
  if (!J) return mapa();
  if (!confirm('¿Salir del nivel? Perderás el avance de este nivel (los rayos que ya perdiste no regresan).')) return;
  cancelAnimationFrame(raf); J = null; mapa();
}
function recarga() {
  const d = leer();
  if (!premium()) { toast('La recarga inmediata es para usuarios Premium.'); return; }
  if (d.recargaPrem === hoy()) { toast('Ya usaste tu recarga de hoy.'); return; }
  d.rayos = RAYOS; d.rayoT = 0; d.recargaPrem = hoy(); guardar(d); toast('Rayos recargados. ¡A seguir!'); mapa();
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-tv]'); if (!el || !raiz() || !raiz().contains(el) || el.disabled) return;
  const a = el.dataset.tv;
  if (a === 'jugar') jugar(Number(el.dataset.l));
  else if (a === 'resp') responder(Number(el.dataset.o));
  else if (a === 'sig') siguiente();
  else if (a === 'salir') salir();
  else if (a === 'mapa') mapa();
  else if (a === 'recarga') recarga();
});
document.addEventListener('keydown', (e) => {
  if (!J || !document.querySelector('#app-screen-trivia.activo')) return;
  if (!J.listo && /^[1-4a-dA-D]$/.test(e.key)) { const i = /\d/.test(e.key) ? Number(e.key) - 1 : 'abcd'.indexOf(e.key.toLowerCase()); responder(i); }
  else if (J.listo && e.key === 'Enter') { e.preventDefault(); siguiente(); }
});
// Si la app pasa a segundo plano a mitad de una pregunta, el tiempo sigue corriendo (evita pausar para buscar la respuesta).

/* ---------------- API para la app ---------------- */
window.triviaRender = function () { cargarPreguntas().catch(() => {}); if (!J) mapa(); };
window.triviaSub = function () { return !!J; };
window.triviaVolver = function () { if (J) { salir(); return true; } return false; };
window.triviaResumen = function () { const d = leer(); return { puntos: d.puntos, nivel: Math.min(d.nivel, NIVELES), rayos: d.rayos, superados: Object.keys(d.estrellas).length }; };
window.triviaFusion = function (R, L) {
  R = R || {}; L = L || {}; const rec = (L.t || 0) >= (R.t || 0) ? L : R;
  const maxMapa = (a, b) => { const o = {}; new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach((k) => { o[k] = Math.max(Number((a || {})[k]) || 0, Number((b || {})[k]) || 0); }); return o; };
  return Object.assign({}, rec, { puntos: Math.max(R.puntos || 0, L.puntos || 0), nivel: Math.max(R.nivel || 1, L.nivel || 1), estrellas: maxMapa(R.estrellas, L.estrellas), mejor: maxMapa(R.mejor, L.mejor),
    partidas: Math.max(R.partidas || 0, L.partidas || 0), aciertos: Math.max(R.aciertos || 0, L.aciertos || 0), respondidas: Math.max(R.respondidas || 0, L.respondidas || 0) });
};

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
#triviaApp{--tv:#c9a84c;--tv-az:#7fd8ff;--tv-ok:#3fb37f;--tv-no:#e5484d;padding-bottom:1.5rem;font-family:var(--font-ui)}
#triviaApp .tv-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:.8rem}
#triviaApp .tv-energia{display:flex;flex-direction:column;align-items:flex-end;gap:.2rem;padding-top:.3rem}
#triviaApp .tv-energia small{white-space:nowrap;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--gris)}
#triviaApp .tv-rayos{display:flex;gap:3px}
#triviaApp .tv-rayo{width:22px;height:28px;fill:var(--tv-az);stroke:#0b2a4a;stroke-width:1.2;stroke-linejoin:round;filter:drop-shadow(0 0 6px rgba(127,216,255,.45));transition:opacity .3s,filter .3s}
#triviaApp .tv-rayo.off{opacity:.18;filter:grayscale(1)}
#triviaApp .tv-rayo.perdido{animation:tvperdido .7s}
@keyframes tvperdido{0%{transform:scale(1.5) rotate(-10deg)}100%{transform:none}}
#triviaApp .tv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:.45rem;margin:.4rem 0 1rem}
#triviaApp .tv-stats div{background:var(--negro2,#141414);border:1px solid rgba(201,168,76,.18);border-top:3px solid var(--tv);border-radius:12px;padding:.65rem .3rem;text-align:center}
#triviaApp .tv-stats b{display:block;font-size:1.3rem;color:var(--blanco,#fff);line-height:1.1;font-variant-numeric:tabular-nums}
#triviaApp .tv-stats span{display:block;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris);margin-top:.25rem}
#triviaApp .tv-btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;background:var(--tv);color:#16120a;border:0;border-radius:12px;padding:.8rem 1.15rem;font-family:var(--font-ui);font-weight:800;font-size:14.5px;cursor:pointer;min-height:46px}
#triviaApp .tv-btn:active{transform:scale(.98)}
#triviaApp .tv-btn.tv-sec{background:transparent;color:var(--tv);border:1px solid rgba(201,168,76,.5)}
#triviaApp .tv-btn-grande{width:100%;font-size:17px;min-height:56px;box-shadow:0 8px 24px rgba(201,168,76,.22)}
#triviaApp .tv-peq{font-size:12.5px;color:var(--gris);margin:.5rem 0 0}
#triviaApp .tv-centro{text-align:center}
#triviaApp .tv-card{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:1rem;margin-bottom:.9rem;font-size:13.5px;color:var(--texto,#ddd);line-height:1.5}
#triviaApp .tv-card > b{display:block;color:var(--blanco,#fff);font-size:16px;margin-bottom:.3rem}
#triviaApp .tv-sin{border-color:rgba(229,72,77,.4);background:rgba(229,72,77,.06);text-align:center}
#triviaApp .tv-sin .tv-btn{margin-top:.7rem}
#triviaApp .tv-bloques{display:flex;flex-direction:column;gap:.6rem;margin:1.1rem 0 .9rem}
#triviaApp .tv-bloque{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:.75rem .85rem;display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
#triviaApp .tv-bloque-n{flex:1;min-width:120px}
#triviaApp .tv-bloque-n b{display:block;color:var(--blanco,#fff);font-size:15px}
#triviaApp .tv-bloque-n small{font-size:11px;color:var(--gris)}
#triviaApp .tv-niveles{display:flex;align-items:center;gap:.4rem}
#triviaApp .tv-linea{width:10px;height:2px;background:rgba(255,255,255,.12)}
#triviaApp .tv-nv{width:54px;height:54px;border-radius:14px;border:2px solid rgba(255,255,255,.12);background:#0e0e0e;color:var(--blanco,#fff);font-family:var(--font-ui);font-weight:800;font-size:19px;line-height:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer}
#triviaApp .tv-nv small{font-size:9.5px;color:var(--tv);font-weight:700;letter-spacing:-.02em}
#triviaApp .tv-nv.hecho{border-color:var(--tv-ok);background:rgba(63,179,127,.12)}
#triviaApp .tv-nv.actual{border-color:var(--tv);background:rgba(201,168,76,.14);box-shadow:0 0 0 4px rgba(201,168,76,.14)}
#triviaApp .tv-nv.bloq{opacity:.35;cursor:not-allowed}
#triviaApp .tv-reglas summary{cursor:pointer;color:var(--blanco,#fff);font-weight:700}
#triviaApp .tv-reglas ul{padding-left:1.1rem;margin:.6rem 0 0}
#triviaApp .tv-reglas li{margin:.35rem 0}
#triviaApp .tv-juego{padding-top:.2rem}
#triviaApp .tv-top{display:flex;align-items:center;gap:.6rem;margin-bottom:.8rem}
#triviaApp .tv-salir{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:transparent;color:var(--gris);font-size:15px;cursor:pointer;flex:none}
#triviaApp .tv-nivel{flex:1;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--gris);font-weight:700}
#triviaApp .tv-reloj{display:flex;align-items:center;gap:.7rem}
#triviaApp .tv-reloj > b{font-size:2.3rem;line-height:1;color:var(--tv);min-width:2.6rem;font-variant-numeric:tabular-nums}
#triviaApp .tv-barra{flex:1;height:10px;border-radius:6px;background:rgba(255,255,255,.07);overflow:hidden}
#triviaApp .tv-barra i{display:block;height:100%;width:100%;background:var(--tv);border-radius:6px}
#triviaApp .tv-barra.poco i{background:var(--tv-no)}
#triviaApp .tv-pts{font-size:12.5px;font-weight:800;color:var(--tv);border:1px solid rgba(201,168,76,.4);border-radius:20px;padding:.2rem .6rem;white-space:nowrap}
#triviaApp .tv-meta{display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin:.9rem 0 .6rem;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris);font-weight:700}
#triviaApp .tv-cat{color:var(--tv-az)}
#triviaApp .tv-puntos{display:flex;gap:4px}
#triviaApp .tv-puntos i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.12)}
#triviaApp .tv-puntos i.ok{background:var(--tv-ok)}#triviaApp .tv-puntos i.no{background:var(--tv-no)}#triviaApp .tv-puntos i.act{background:var(--tv)}
#triviaApp .tv-q{font-size:1.35rem;line-height:1.25;font-weight:700;color:var(--blanco,#fff);margin:.2rem 0 1rem;text-wrap:balance}
#triviaApp .tv-ops{display:flex;flex-direction:column;gap:.5rem}
#triviaApp .tv-op{display:flex;align-items:center;gap:.7rem;text-align:left;background:var(--negro2,#141414);border:1.5px solid rgba(255,255,255,.1);border-radius:12px;padding:.85rem .9rem;color:var(--texto,#ddd);font-family:var(--font-ui);font-size:15px;line-height:1.3;cursor:pointer;min-height:54px}
#triviaApp .tv-op span{flex:none;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:rgba(255,255,255,.07);font-weight:800;font-size:12.5px;color:var(--gris)}
#triviaApp .tv-op:not(:disabled):active{border-color:var(--tv)}
#triviaApp .tv-op:disabled{cursor:default}
#triviaApp .tv-op.ok{border-color:var(--tv-ok);background:rgba(63,179,127,.14);color:#fff}#triviaApp .tv-op.ok span{background:var(--tv-ok);color:#05140c}
#triviaApp .tv-op.no{border-color:var(--tv-no);background:rgba(229,72,77,.12)}#triviaApp .tv-op.no span{background:var(--tv-no);color:#fff}
#triviaApp .tv-revela{margin-top:.9rem;border-left:3px solid var(--tv);background:var(--negro2,#141414);border-radius:0 12px 12px 0;padding:.85rem 1rem;font-size:14px;line-height:1.5;color:var(--texto,#ddd)}
#triviaApp .tv-revela > b{display:block;font-size:16px;margin-bottom:.25rem}
#triviaApp .tv-revela > b.ok{color:var(--tv-ok)}#triviaApp .tv-revela > b.no{color:var(--tv-no)}
#triviaApp .tv-revela p{margin:0}
#triviaApp .tv-revela-pie{display:flex;justify-content:space-between;align-items:center;gap:.6rem;margin-top:.8rem;flex-wrap:wrap}
#triviaApp .tv-revela-pie small{color:var(--gris);font-size:12.5px}
#triviaApp .tv-fin{padding-top:.6rem}
#triviaApp .tv-fin-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:.8rem}
#triviaApp .tv-fin h2{font-family:var(--font-display,inherit);font-size:2rem;line-height:1.05;margin:0;color:var(--tv)}
#triviaApp .tv-fin.no h2{color:var(--tv-no)}
#triviaApp .tv-fin p{color:var(--gris);margin:.4rem 0 0;font-size:14px}
#triviaApp .tv-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin:1rem 0}
#triviaApp .tv-chips span{font-size:12.5px;font-weight:700;border-radius:20px;padding:.35rem .75rem;border:1px solid rgba(201,168,76,.4);color:var(--tv);background:rgba(201,168,76,.08)}
#triviaApp .tv-fin.no .tv-chips span{border-color:rgba(229,72,77,.4);color:#ff8a8d;background:rgba(229,72,77,.08)}
#triviaApp .tv-fin-btns{display:flex;flex-direction:column;gap:.5rem}
.tv-confeti{position:fixed;top:-12px;width:8px;height:14px;border-radius:2px;z-index:9999;pointer-events:none;animation:tvcae 2.6s ease-in forwards}
@keyframes tvcae{to{transform:translateY(105vh) rotate(540deg);opacity:.7}}
@media (prefers-reduced-motion:reduce){#triviaApp *{animation:none!important}}
`;
document.head.appendChild(css);
})();
