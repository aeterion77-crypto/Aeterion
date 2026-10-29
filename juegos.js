/* ============================================================
   AETERION · JUEGOS — pestaña de juegos (Trivia + Memorama).
   Memorama: 24 niveles en 4 mundos (cada mundo agrega un giro),
   reto diario igual para todos, contrarreloj infinito y álbum de
   cartas con un dato de salud por carta. Sin vidas ni energía.
   Las cartas viven en juegos-imagenes.js (se carga al abrir).
   Avance en localStorage «aet_memo» (se sincroniza con la cuenta).
============================================================ */
(function () {
'use strict';
const KEY = 'aet_memo';
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('es-MX');
const hoy = () => (window.AET ? AET.hoy() : new Date().toISOString().slice(0, 10));
const toast = (t) => { try { aetToast(t); } catch (e) {} };
const vibrar = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------------- Mundos y niveles ---------------- */
const MUNDOS = [
  { n: 'Calentamiento', i: '🔥', giro: null, txt: 'Encuentra las parejas. Mientras menos movimientos, más estrellas.', pares: [3, 4, 5, 6, 6, 8] },
  { n: 'Contra el reloj', i: '⏱️', giro: 'tiempo', txt: 'Cada nivel tiene tiempo límite. Cada pareja te da segundos extra.', pares: [6, 6, 8, 8, 10, 10] },
  { n: 'Ciencia', i: '🧬', giro: 'concepto', txt: 'Une cada imagen con su nombre. Aprendes mientras juegas.', pares: [5, 6, 6, 8, 8, 10] },
  { n: 'Élite', i: '🏆', giro: 'mezcla', txt: 'Cada 4 errores dos cartas cambian de lugar. Memoria de campeón.', pares: [8, 10, 10, 12, 15, 18] },
];
const NIVELES = MUNDOS.reduce((a, m) => a + m.pares.length, 0);
function nivelInfo(L) {
  let k = L;
  for (let w = 0; w < MUNDOS.length; w++) { if (k <= MUNDOS[w].pares.length) { const p = MUNDOS[w].pares[k - 1]; return { L, w, p, giro: MUNDOS[w].giro, tiempo: MUNDOS[w].giro === 'tiempo' ? 10 + p * 5 : MUNDOS[w].giro === 'mezcla' && p >= 12 ? 30 + p * 6 : 0 }; } k -= MUNDOS[w].pares.length; }
  return null;
}
const columnas = (n) => { for (const c of [3, 4, 5, 6]) if (n % c === 0 && n / c <= c + 2) return c; return n <= 12 ? 4 : 6; };
const estrellasDe = (p, mov, pista) => { const e = mov <= Math.ceil(p * 1.6) ? 3 : mov <= Math.ceil(p * 2.3) ? 2 : 1; return pista ? Math.min(2, e) : e; };

/* ---------------- Estado ---------------- */
function leer() { let d = null; try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} return Object.assign({ nivel: 1, estrellas: {}, mejor: {}, album: {}, diario: {}, racha: 0, ultimoDiario: null, infinito: 0, recientes: [], partidas: 0, puntos: 0, t: 0 }, d || {}); }
function guardar(d) { d.t = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

/* ---------------- Cartas ---------------- */
let CARTAS = null;
function cargarCartas() {
  if (CARTAS) return Promise.resolve(CARTAS);
  if (window.AET_CARTAS) return Promise.resolve(CARTAS = window.AET_CARTAS);
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'juegos-imagenes.js?v=1'; s.onload = () => ok(CARTAS = window.AET_CARTAS); s.onerror = () => no(new Error('red')); document.head.appendChild(s); });
}
function azar(semilla) { let s = semilla >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function barajar(a, r) { r = r || Math.random; a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Elige p cartas sin repetir las que salieron hace poco; siempre entra un producto Aeterion si hay 4+ parejas.
function elegirCartas(p, d, r) {
  const L = CARTAS.lista, prods = L.filter((c) => c.cat === 'aeterion'), resto = L.filter((c) => c.cat !== 'aeterion');
  const rec = new Set(r ? [] : d.recientes);
  const frescas = barajar(resto.filter((c) => !rec.has(c.id)), r), usadas = barajar(resto.filter((c) => rec.has(c.id)), r);
  const sel = [];
  if (p >= 4) sel.push(barajar(prods, r)[0]);
  for (const c of [...frescas, ...usadas]) { if (sel.length >= p) break; sel.push(c); }
  if (!r) { d.recientes = [...sel.map((c) => c.id), ...d.recientes.filter((id) => !sel.some((c) => c.id === id))].slice(0, 50); }
  return sel;
}
const caraHtml = (c, texto) => {
  const cat = CARTAS.cats[c.cat];
  if (texto) return `<div class="mm-cara mm-texto" style="--k:${cat.c}"><span>${esc(c.n)}</span></div>`;
  if (c.img) return `<div class="mm-cara mm-foto"><img src="${c.img}" alt="${esc(c.n)}" draggable="false"></div>`;
  return `<div class="mm-cara" style="background:${cat.bg}"><svg viewBox="0 0 64 64" aria-label="${esc(c.n)}">${c.s}</svg></div>`;
};
const DORSO = `<div class="mm-dorso"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 6 34 32H6z" fill="none" stroke="#c9a84c" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 26c3-6 5-6 8-12M16 14c3 6 5 6 8 12" fill="none" stroke="#c9a84c" stroke-width="1.6" stroke-linecap="round"/></svg></div>`;

/* ---------------- Navegación interna ---------------- */
let V = 'hub', P = null;   // vista y partida en curso
function raiz() { return $('juegosApp'); }
function ir(v) { pararReloj(); P = null; V = v; pintar(); window.scrollTo(0, 0); }
function pintar() {
  const r = raiz(); if (!r) return;
  if (V === 'hub') r.innerHTML = hub();
  else if (V === 'memo') r.innerHTML = memoMenu();
  else if (V === 'album') r.innerHTML = album();
}

/* ---------------- HUB ---------------- */
function hub() {
  const t = window.triviaResumen ? triviaResumen() : { puntos: 0, nivel: 1, rayos: 3, superados: 0 };
  const d = leer(); const est = Object.values(d.estrellas).reduce((a, x) => a + x, 0);
  const diarioHecho = !!d.diario[hoy()];
  return `<h2 class="app-titulo">Juegos</h2><p class="app-subtitulo">Aprende de salud y entrenamiento jugando</p>
    <button class="jg-tarjeta jg-trivia" onclick="aetIr('trivia')"><div class="jg-ico">⚡</div><div class="jg-txt"><b>Trivia Aeterion</b><span>15 niveles · 180 preguntas con tiempo</span>
      <div class="jg-chips"><em>Nivel ${t.nivel}</em><em>${fmt(t.puntos)} pts</em><em>${'⚡'.repeat(t.rayos)}${'·'.repeat(3 - t.rayos)} rayos</em></div></div><i>›</i></button>
    <button class="jg-tarjeta jg-memo" data-jg="memo"><div class="jg-ico">🧠</div><div class="jg-txt"><b>Memorama</b><span>${NIVELES} niveles · ${CARTAS ? CARTAS.lista.length : 82} cartas de fitness, ciencia y productos Aeterion</span>
      <div class="jg-chips"><em>Nivel ${Math.min(d.nivel, NIVELES)}</em><em>★ ${est}/${NIVELES * 3}</em><em>Álbum ${Object.keys(d.album).length}</em></div></div><i>›</i></button>
    <button class="jg-tarjeta jg-diario ${diarioHecho ? 'hecho' : ''}" data-jg="diario"><div class="jg-ico">📅</div><div class="jg-txt"><b>Reto diario</b><span>${diarioHecho ? `Hecho hoy en ${d.diario[hoy()].mov} movimientos · vuelve mañana` : 'El mismo tablero para todos, una vez al día'}</span>
      <div class="jg-chips"><em>🔥 Racha ${d.racha} ${d.racha === 1 ? 'día' : 'días'}</em></div></div><i>›</i></button>
    <p class="jg-nota">Más juegos próximamente.</p>`;
}

/* ---------------- MENÚ DEL MEMORAMA ---------------- */
function memoMenu() {
  const d = leer();
  let h = `<button class="app-visor-volver" data-jg="hub">← Volver a Juegos</button><h2 class="app-titulo">Memorama</h2><p class="app-subtitulo">Encuentra las parejas con el menor número de movimientos</p>
    <div class="mm-modos"><button class="mm-modo" data-jg="jugar" data-l="${Math.min(d.nivel, NIVELES)}"><b>▶ Nivel ${Math.min(d.nivel, NIVELES)}</b><span>Continuar</span></button>
      <button class="mm-modo" data-jg="diario"><b>📅 Reto diario</b><span>${d.diario[hoy()] ? 'Hecho ✓' : 'Disponible'}</span></button>
      <button class="mm-modo" data-jg="infinito"><b>⏱️ Contrarreloj</b><span>Récord ${d.infinito} parejas</span></button>
      <button class="mm-modo" data-jg="album"><b>📖 Álbum</b><span>${Object.keys(d.album).length} de ${CARTAS.lista.length}</span></button></div>`;
  let n = 0;
  MUNDOS.forEach((m, w) => {
    const ini = n + 1; n += m.pares.length; const abierto = d.nivel >= ini;
    h += `<section class="mm-mundo ${abierto ? '' : 'bloq'}"><div class="mm-mundo-cab"><span>${m.i}</span><div><b>Mundo ${w + 1} · ${m.n}</b><small>${abierto ? m.txt : 'Termina el mundo anterior para abrirlo'}</small></div></div><div class="mm-nvs">`;
    for (let L = ini; L <= n; L++) { const st = d.estrellas[L], bl = L > d.nivel;
      h += `<button class="mm-nv ${st ? 'hecho' : L === d.nivel ? 'actual' : ''} ${bl ? 'bloq' : ''}" data-jg="jugar" data-l="${L}" ${bl ? 'disabled' : ''} aria-label="Nivel ${L}">${L}<small>${st ? '★'.repeat(st) + '☆'.repeat(3 - st) : bl ? '🔒' : nivelInfo(L).p + ' pares'}</small></button>`; }
    h += '</div></section>';
  });
  return h;
}

/* ---------------- ÁLBUM ---------------- */
function album() {
  const d = leer(); const L = CARTAS.lista; const tot = Object.keys(d.album).length;
  let h = `<button class="app-visor-volver" data-jg="memo">← Volver al Memorama</button><h2 class="app-titulo">Álbum</h2><p class="app-subtitulo">${tot} de ${L.length} cartas. Cada carta que encuentras se guarda aquí con un dato útil.</p>
    <div class="mm-barra"><i style="width:${Math.round(tot * 100 / L.length)}%"></i></div>`;
  Object.keys(CARTAS.cats).forEach((k) => {
    const cs = L.filter((c) => c.cat === k); const t = cs.filter((c) => d.album[c.id]).length;
    h += `<div class="mm-alb-cat"><b>${esc(CARTAS.cats[k].n)}</b><span>${t}/${cs.length}</span></div><div class="mm-alb">`;
    cs.forEach((c) => { h += d.album[c.id] ? `<button class="mm-alb-c" data-jg="dato" data-id="${c.id}">${caraHtml(c)}<small>${esc(c.n)}</small></button>` : `<div class="mm-alb-c nada"><div class="mm-cara"><span>?</span></div><small>???</small></div>`; });
    h += '</div>';
  });
  return h;
}
function verDato(id) {
  const c = CARTAS.lista.find((x) => x.id === id); if (!c) return;
  const html = `<div class="mm-dato">${caraHtml(c)}<p>${esc(c.d)}</p><small>${esc(CARTAS.cats[c.cat].n)}</small></div>`;
  try { aetSheet(esc(c.n), html); } catch (e) { alert(c.n + ': ' + c.d); }
}

/* ---------------- PARTIDA ---------------- */
let reloj = 0, tVuelta = 0;
function pararReloj() { clearInterval(reloj); clearTimeout(tVuelta); }
async function empezar(modo, L) {
  try { await cargarCartas(); } catch (e) { toast('Sin conexión: no se pudieron cargar las cartas.'); return; }
  const d = leer(); let cfg;
  if (modo === 'nivel') { if (L > d.nivel) return; cfg = nivelInfo(L); }
  else if (modo === 'diario') { const r = azar(Number(hoy().replace(/-/g, ''))); cfg = { p: 10, giro: r() < 0.4 ? 'concepto' : null, tiempo: 0, r }; }
  else cfg = { p: 6, giro: null, tiempo: 45 };
  const r = cfg.r || null;
  const sel = elegirCartas(cfg.p, d, r); guardar(d);
  const mazo = [];
  sel.forEach((c, i) => { mazo.push({ id: c.id, c, txt: false, par: i }); mazo.push({ id: c.id, c, txt: cfg.giro === 'concepto', par: i }); });
  P = { modo, L, cfg, mazo: barajar(mazo, r), abiertas: [], hechas: 0, mov: 0, errores: 0, combo: 0, mejorCombo: 0, pts: 0, pista: false, ini: 0, resta: cfg.tiempo, nuevas: [], tablero: 1, totalPares: 0, fin: false, bloq: true };
  V = 'juego'; pintarJuego(); window.scrollTo(0, 0);
  // Vistazo inicial: todas boca arriba un momento
  const ver = Math.min(2600, 900 + cfg.p * 110);
  setTimeout(() => { document.querySelectorAll('#mmTablero .mm-carta').forEach((e) => e.classList.add('ab')); }, 120);
  tVuelta = setTimeout(() => { if (!P) return; document.querySelectorAll('#mmTablero .mm-carta').forEach((e) => e.classList.remove('ab')); P.bloq = false; P.ini = Date.now(); arrancarReloj(); }, ver + 120);
}
function tituloPartida() { return P.modo === 'nivel' ? `Nivel ${P.L} · ${MUNDOS[P.cfg.w].n}` : P.modo === 'diario' ? 'Reto diario' : `Contrarreloj · tablero ${P.tablero}`; }
function pintarJuego() {
  const cols = columnas(P.mazo.length);
  raiz().innerHTML = `<div class="mm-juego"><div class="mm-top"><button class="mm-salir" data-jg="salir" aria-label="Salir">✕</button><div class="mm-tit">${esc(tituloPartida())}${P.cfg.giro === 'concepto' ? ' · imagen + nombre' : P.cfg.giro === 'mezcla' ? ' · se mezclan' : ''}</div>
      <button class="mm-pista" data-jg="pista" ${P.pista || P.modo === 'infinito' ? 'disabled' : ''} title="Ver todas un segundo (máximo 2 estrellas)">💡</button></div>
    <div class="mm-hud"><div><b id="mmMov">${P.mov}</b><span>Movimientos</span></div><div><b id="mmPar">${P.hechas}/${P.cfg.p}</b><span>Parejas</span></div><div class="${P.cfg.tiempo ? 'mm-tiempo' : ''}"><b id="mmT">${P.cfg.tiempo ? mmss(P.resta) : '0:00'}</b><span>${P.cfg.tiempo ? 'Restante' : 'Tiempo'}</span></div><div><b id="mmPts">${fmt(P.pts)}</b><span>Puntos</span></div></div>
    ${P.cfg.tiempo ? '<div class="mm-tbarra"><i id="mmTB"></i></div>' : ''}
    <div class="mm-combo" id="mmCombo"></div>
    <div class="mm-tablero" id="mmTablero" style="--cols:${cols}">${P.mazo.map((m, i) => `<button class="mm-carta" data-jg="carta" data-i="${i}" aria-label="Carta ${i + 1}"><div class="mm-in">${DORSO}<div class="mm-frente">${caraHtml(m.c, m.txt)}</div></div></button>`).join('')}</div>
    <div class="mm-dato-vivo" id="mmVivo"></div></div>`;
}
function arrancarReloj() {
  pararReloj();
  const t0 = Date.now(); const r0 = P.resta;
  reloj = setInterval(() => {
    if (!P || P.fin) return pararReloj();
    const el = (Date.now() - P.ini) / 1000;
    if (P.cfg.tiempo) {
      P.resta = Math.max(0, r0 - (Date.now() - t0) / 1000 + (P.extra || 0));
      const t = $('mmT'); if (t) t.textContent = mmss(P.resta);
      const b = $('mmTB'); if (b) { b.style.width = Math.min(100, P.resta / (P.cfg.tiempo) * 100) + '%'; b.parentElement.classList.toggle('poco', P.resta < 8); }
      if (P.resta <= 0) terminar(false);
    } else { const t = $('mmT'); if (t) t.textContent = mmss(el); }
  }, 200);
}
function sumarTiempo(s) { if (!P.cfg.tiempo) return; P.extra = (P.extra || 0) + s; }
function voltear(i) {
  if (!P || P.bloq || P.fin) return;
  const el = document.querySelector(`#mmTablero .mm-carta[data-i="${i}"]`); if (!el || el.classList.contains('ab') || el.classList.contains('ok')) return;
  if (P.abiertas.length === 2) cerrarPendientes();
  el.classList.add('ab'); P.abiertas.push(i);
  if (P.abiertas.length < 2) return;
  P.mov++; $('mmMov').textContent = P.mov;
  const [a, b] = P.abiertas.map((k) => P.mazo[k]);
  if (a.par === b.par) {
    P.combo++; P.mejorCombo = Math.max(P.mejorCombo, P.combo); P.hechas++; P.totalPares++;
    const ganan = 100 + (P.combo > 1 ? (P.combo - 1) * 50 : 0); P.pts += ganan;
    P.abiertas.forEach((k) => { const e = document.querySelector(`#mmTablero .mm-carta[data-i="${k}"]`); e.classList.add('ok'); e.disabled = true; });
    P.abiertas = [];
    const d = leer(); if (!d.album[a.id]) { d.album[a.id] = hoy(); P.nuevas.push(a.c); guardar(d); }
    $('mmPar').textContent = `${P.hechas}/${P.cfg.p}`; $('mmPts').textContent = fmt(P.pts);
    const cb = $('mmCombo'); if (P.combo > 1) { cb.innerHTML = `<b>¡Combo x${P.combo}!</b> +${ganan}`; cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop'); }
    const vivo = $('mmVivo'); if (vivo) vivo.innerHTML = `<b>${esc(a.c.n)}</b> ${esc(a.c.d)}`;
    sumarTiempo(P.modo === 'infinito' ? 3 : 2);
    vibrar(25);
    if (P.hechas === P.cfg.p) { if (P.modo === 'infinito') return siguienteTablero(); setTimeout(() => terminar(true), 450); }
  } else {
    P.combo = 0; P.errores++;
    tVuelta = setTimeout(cerrarPendientes, 750);
    if (P.cfg.giro === 'mezcla' && P.errores % 4 === 0) setTimeout(mezclar, 800);
  }
}
function cerrarPendientes() {
  clearTimeout(tVuelta); if (!P) return;
  P.abiertas.forEach((k) => { const e = document.querySelector(`#mmTablero .mm-carta[data-i="${k}"]`); if (e && !e.classList.contains('ok')) { e.classList.remove('ab'); e.classList.add('mal'); setTimeout(() => e.classList.remove('mal'), 350); } });
  P.abiertas = [];
}
function mezclar() {
  if (!P || P.fin) return;
  const libres = P.mazo.map((_, i) => i).filter((i) => { const e = document.querySelector(`#mmTablero .mm-carta[data-i="${i}"]`); return e && !e.classList.contains('ok') && !e.classList.contains('ab'); });
  if (libres.length < 4) return;
  const [x, y] = barajar(libres).slice(0, 2);
  [P.mazo[x], P.mazo[y]] = [P.mazo[y], P.mazo[x]];
  [x, y].forEach((k) => { const e = document.querySelector(`#mmTablero .mm-carta[data-i="${k}"]`); e.querySelector('.mm-frente').innerHTML = caraHtml(P.mazo[k].c, P.mazo[k].txt); e.classList.remove('mz'); void e.offsetWidth; e.classList.add('mz'); });
  const cb = $('mmCombo'); cb.innerHTML = '<b>¡Se mezclaron 2 cartas!</b>'; cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop');
}
function pista() {
  if (!P || P.pista || P.bloq || P.fin || P.modo === 'infinito') return;
  P.pista = true; P.bloq = true; cerrarPendientes();
  const bt = document.querySelector('[data-jg="pista"]'); if (bt) bt.disabled = true;
  const cs = [...document.querySelectorAll('#mmTablero .mm-carta:not(.ok)')]; cs.forEach((e) => e.classList.add('ab'));
  setTimeout(() => { cs.forEach((e) => e.classList.remove('ab')); if (P) P.bloq = false; }, 1100);
}
function siguienteTablero() {
  P.bloq = true; sumarTiempo(5); P.tablero++;
  const d = leer(); const p = Math.min(10, 6 + P.tablero - 1);
  setTimeout(() => {
    if (!P || P.fin) return;
    const sel = elegirCartas(p, d); guardar(d);
    const mazo = []; sel.forEach((c, i) => { mazo.push({ id: c.id, c, txt: false, par: i }); mazo.push({ id: c.id, c, txt: false, par: i }); });
    P.mazo = barajar(mazo); P.hechas = 0; P.cfg.p = p; P.abiertas = [];
    const ini = P.ini, extra = P.extra; pintarJuego(); P.ini = ini; P.extra = extra;
    const cb = $('mmCombo'); cb.innerHTML = `<b>¡Tablero ${P.tablero}!</b> +5 s`; cb.classList.add('pop');
    P.bloq = false;
  }, 500);
}
function terminar(gano) {
  if (!P || P.fin) return; P.fin = true; pararReloj();
  const T = P; const seg = (Date.now() - T.ini) / 1000; const d = leer(); d.partidas++;
  let tit, sub, chips = [], btns = '';
  if (T.modo === 'infinito') {
    const rec = T.totalPares > d.infinito; if (rec) d.infinito = T.totalPares;
    tit = rec ? '¡Nuevo récord!' : '¡Se acabó el tiempo!'; sub = `${T.totalPares} parejas en ${T.tablero} ${T.tablero === 1 ? 'tablero' : 'tableros'} · ${fmt(T.pts)} pts`;
    chips.push(`Récord: ${d.infinito} parejas`, `Mejor combo x${T.mejorCombo}`);
    btns = '<button class="jg-btn" data-jg="infinito">Jugar otra vez</button>';
  } else if (!gano) {
    tit = 'Se acabó el tiempo'; sub = `Encontraste ${T.hechas} de ${T.cfg.p} parejas. ¡Inténtalo de nuevo!`;
    btns = `<button class="jg-btn" data-jg="jugar" data-l="${T.L}">Reintentar nivel ${T.L}</button>`;
  } else {
    const est = estrellasDe(T.cfg.p, T.mov, T.pista); const bonoT = T.cfg.tiempo ? Math.round(T.resta) * 10 : Math.max(0, Math.round((T.cfg.p * 6 - seg) * 5));
    const tot = T.pts + est * 100 + bonoT;
    sub = `${'★'.repeat(est)}${'☆'.repeat(3 - est)} · ${T.mov} movimientos · ${mmss(seg)} · ${fmt(tot)} pts`;
    if (T.modo === 'nivel') {
      const nuevo = !d.estrellas[T.L];
      d.estrellas[T.L] = Math.max(d.estrellas[T.L] || 0, est);
      const m = d.mejor[T.L]; if (!m || T.mov < m.mov || (T.mov === m.mov && seg < m.t)) d.mejor[T.L] = { mov: T.mov, t: Math.round(seg) };
      if (nuevo) { d.puntos += tot; d.nivel = Math.max(d.nivel, Math.min(NIVELES, T.L + 1)); }
      tit = T.L === NIVELES && nuevo ? '¡Memoria de élite!' : `Nivel ${T.L} superado`;
      if (est < 3) chips.push(`3★ con ${Math.ceil(T.cfg.p * 1.6)} movimientos o menos${T.pista ? ' y sin pista' : ''}`);
      if (nuevo && T.L < NIVELES) { chips.push(`Desbloqueaste el nivel ${T.L + 1}`); const ni = nivelInfo(T.L + 1); if (ni.w !== T.cfg.w) chips.push(`Nuevo mundo: ${MUNDOS[ni.w].n}`); }
      btns = (T.L < NIVELES ? `<button class="jg-btn" data-jg="jugar" data-l="${T.L + 1}">Siguiente nivel</button>` : '') + `<button class="jg-btn jg-sec" data-jg="jugar" data-l="${T.L}">Repetir</button>`;
    } else {
      tit = '¡Reto diario completado!'; const prev = d.diario[hoy()];
      if (!prev || T.mov < prev.mov) d.diario[hoy()] = { mov: T.mov, t: Math.round(seg), est };
      if (d.ultimoDiario !== hoy()) { const ayer = (() => { const x = new Date(hoy() + 'T12:00:00'); x.setDate(x.getDate() - 1); return x.toISOString().slice(0, 10); })(); d.racha = d.ultimoDiario === ayer ? d.racha + 1 : 1; d.ultimoDiario = hoy(); }
      const ks = Object.keys(d.diario).sort(); if (ks.length > 60) ks.slice(0, ks.length - 60).forEach((k) => delete d.diario[k]);
      chips.push(`🔥 Racha de ${d.racha} ${d.racha === 1 ? 'día' : 'días'}`, 'Mañana hay un tablero nuevo');
    }
    if (T.mejorCombo > 1) chips.push(`Mejor combo x${T.mejorCombo}`);
  }
  guardar(d);
  try { if (typeof aetEvento === 'function') aetEvento('memo_' + T.modo + (gano ? '_ok' : '_fin')); } catch (e) {}
  const nuevas = T.nuevas.length ? `<div class="mm-nuevas"><b>${T.nuevas.length === 1 ? 'Nueva carta en tu álbum' : T.nuevas.length + ' cartas nuevas en tu álbum'}</b>${T.nuevas.map((c) => `<div class="mm-nueva">${caraHtml(c)}<div><b>${esc(c.n)}</b><p>${esc(c.d)}</p></div></div>`).join('')}</div>` : '';
  raiz().innerHTML = `<div class="mm-fin ${gano || T.modo === 'infinito' ? 'ok' : 'no'}"><h2>${tit}</h2><p>${sub}</p><div class="mm-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    <div class="mm-fin-btns">${btns}<button class="jg-btn jg-sec" data-jg="memo">Memorama</button><button class="jg-btn jg-sec" data-jg="hub">Juegos</button></div>${nuevas}</div>`;
  P = null; V = 'fin'; window.scrollTo(0, 0);
  if (gano && T.modo === 'nivel' && d.estrellas[T.L] === 3) confeti();
}
function confeti() { for (let i = 0; i < 22; i++) { const g = document.createElement('i'); g.className = 'tv-confeti'; g.style.left = Math.random() * 100 + '%'; g.style.background = ['#c9a84c', '#7fd8ff', '#3fb37f', '#e5484d'][i % 4]; g.style.animationDelay = Math.random() * 0.5 + 's'; document.body.appendChild(g); setTimeout(() => g.remove(), 3200); } }
function salir() {
  if (P && !P.fin && P.modo !== 'infinito' && P.hechas > 0 && !confirm('¿Salir de la partida? No se guarda el avance de este tablero.')) return;
  if (P && P.modo === 'infinito' && !P.fin && P.totalPares > 0) return terminar(false);
  ir('memo');
}

/* ---------------- Eventos ---------------- */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-jg]'); if (!el || !raiz() || !raiz().contains(el) || el.disabled) return;
  const a = el.dataset.jg;
  if (a === 'carta') return voltear(Number(el.dataset.i));
  if (a === 'hub') return ir('hub');
  if (['memo', 'album'].includes(a)) { try { await cargarCartas(); } catch (e) { toast('Sin conexión.'); return; } return ir(a); }
  if (a === 'jugar') return empezar('nivel', Number(el.dataset.l));
  if (a === 'diario') { const d = leer(); if (d.diario[hoy()] && !confirm('Ya hiciste el reto de hoy. ¿Quieres intentar mejorar tus movimientos?')) return; return empezar('diario'); }
  if (a === 'infinito') return empezar('infinito');
  if (a === 'pista') return pista();
  if (a === 'salir') return salir();
  if (a === 'dato') return verDato(el.dataset.id);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && P && !P.fin && !P.cfg.tiempo) { /* sin tiempo límite: el cronómetro sigue, sin castigo */ } });

/* ---------------- API para la app ---------------- */
window.juegosRender = function () { cargarCartas().catch(() => {}); if (!P) { if (V !== 'memo' && V !== 'album') V = 'hub'; pintar(); } };
window.juegosSub = function () { return V !== 'hub'; };
window.juegosVolver = function () { if (V === 'juego') { salir(); return true; } if (V === 'album' || V === 'fin') { ir('memo'); return true; } if (V === 'memo') { ir('hub'); return true; } return false; };
window.memoResumen = function () { const d = leer(); return { nivel: Math.min(d.nivel, NIVELES), estrellas: Object.values(d.estrellas).reduce((a, x) => a + x, 0), album: Object.keys(d.album).length }; };
window.memoFusion = function (R, L) {
  R = R || {}; L = L || {}; const rec = (L.t || 0) >= (R.t || 0) ? L : R;
  const maxMapa = (a, b) => { const o = {}; new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach((k) => { o[k] = Math.max(Number((a || {})[k]) || 0, Number((b || {})[k]) || 0); }); return o; };
  const uni = (a, b) => Object.assign({}, b || {}, a || {});
  return Object.assign({}, rec, { nivel: Math.max(R.nivel || 1, L.nivel || 1), estrellas: maxMapa(R.estrellas, L.estrellas), album: uni(R.album, L.album), diario: uni(R.diario, L.diario), mejor: uni(R.mejor, L.mejor),
    infinito: Math.max(R.infinito || 0, L.infinito || 0), puntos: Math.max(R.puntos || 0, L.puntos || 0), partidas: Math.max(R.partidas || 0, L.partidas || 0), racha: Math.max(R.racha || 0, L.racha || 0) });
};

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
#juegosApp{--jg:#c9a84c;padding-bottom:1.5rem;font-family:var(--font-ui)}
#juegosApp .jg-tarjeta{display:flex;align-items:center;gap:.9rem;width:100%;text-align:left;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:1rem;margin-bottom:.8rem;color:var(--texto,#ddd);font-family:var(--font-ui);cursor:pointer;position:relative;overflow:hidden}
#juegosApp .jg-tarjeta::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--k,var(--jg))}
#juegosApp .jg-trivia{--k:#7fd8ff;background:linear-gradient(135deg,rgba(127,216,255,.12),rgba(20,20,20,1) 60%)}
#juegosApp .jg-memo{--k:#c9a84c;background:linear-gradient(135deg,rgba(201,168,76,.16),rgba(20,20,20,1) 60%)}
#juegosApp .jg-diario{--k:#ff7a1a;background:linear-gradient(135deg,rgba(255,122,26,.14),rgba(20,20,20,1) 60%)}
#juegosApp .jg-diario.hecho{opacity:.8}
#juegosApp .jg-ico{flex:none;width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:28px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}
#juegosApp .jg-txt{flex:1;min-width:0}
#juegosApp .jg-txt b{display:block;color:var(--blanco,#fff);font-size:16px}
#juegosApp .jg-txt > span{display:block;font-size:12.5px;color:var(--gris);margin-top:.15rem;line-height:1.35}
#juegosApp .jg-chips{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.5rem}
#juegosApp .jg-chips em{font-style:normal;font-size:11px;font-weight:700;color:var(--k,var(--jg));border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:.12rem .55rem}
#juegosApp .jg-tarjeta > i{font-style:normal;color:var(--gris);font-size:22px}
#juegosApp .jg-nota{text-align:center;font-size:12px;color:var(--gris);margin:.6rem 0 0}
#juegosApp .jg-btn{display:flex;align-items:center;justify-content:center;width:100%;background:var(--jg);color:#16120a;border:0;border-radius:12px;padding:.85rem;font-family:var(--font-ui);font-weight:800;font-size:15px;cursor:pointer;min-height:48px}
#juegosApp .jg-btn.jg-sec{background:transparent;color:var(--jg);border:1px solid rgba(201,168,76,.5)}
#juegosApp .mm-modos{display:grid;grid-template-columns:1fr 1fr;gap:.55rem;margin:.3rem 0 1rem}
#juegosApp .mm-modo{text-align:left;background:var(--negro2,#141414);border:1px solid rgba(201,168,76,.22);border-radius:14px;padding:.8rem .85rem;color:var(--texto,#ddd);font-family:var(--font-ui);cursor:pointer}
#juegosApp .mm-modo:first-child{background:var(--jg);border-color:var(--jg)}
#juegosApp .mm-modo:first-child b,#juegosApp .mm-modo:first-child span{color:#16120a}
#juegosApp .mm-modo b{display:block;color:var(--blanco,#fff);font-size:14.5px}
#juegosApp .mm-modo span{display:block;font-size:11.5px;color:var(--gris);margin-top:.15rem}
#juegosApp .mm-mundo{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:.85rem;margin-bottom:.7rem}
#juegosApp .mm-mundo.bloq{opacity:.55}
#juegosApp .mm-mundo-cab{display:flex;gap:.7rem;align-items:center;margin-bottom:.7rem}
#juegosApp .mm-mundo-cab > span{font-size:26px}
#juegosApp .mm-mundo-cab b{display:block;color:var(--blanco,#fff);font-size:14.5px}
#juegosApp .mm-mundo-cab small{display:block;font-size:12px;color:var(--gris);line-height:1.35}
#juegosApp .mm-nvs{display:grid;grid-template-columns:repeat(6,1fr);gap:.35rem}
#juegosApp .mm-nv{aspect-ratio:1;border-radius:12px;border:2px solid rgba(255,255,255,.1);background:#0e0e0e;color:var(--blanco,#fff);font-family:var(--font-ui);font-weight:800;font-size:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;padding:0}
#juegosApp .mm-nv small{font-size:8px;font-weight:700;color:var(--jg);white-space:nowrap}
#juegosApp .mm-nv.hecho{border-color:#3fb37f;background:rgba(63,179,127,.12)}
#juegosApp .mm-nv.actual{border-color:var(--jg);background:rgba(201,168,76,.15);box-shadow:0 0 0 3px rgba(201,168,76,.14)}
#juegosApp .mm-nv.bloq{opacity:.4;cursor:not-allowed}
#juegosApp .mm-barra{height:8px;border-radius:8px;background:rgba(255,255,255,.07);overflow:hidden;margin:.2rem 0 1rem}
#juegosApp .mm-barra i{display:block;height:100%;background:var(--jg);border-radius:8px}
#juegosApp .mm-alb-cat{display:flex;justify-content:space-between;align-items:baseline;margin:1rem 0 .5rem}
#juegosApp .mm-alb-cat b{color:var(--blanco,#fff);font-size:14px}
#juegosApp .mm-alb-cat span{font-size:12px;color:var(--gris)}
#juegosApp .mm-alb{display:grid;grid-template-columns:repeat(4,1fr);gap:.45rem}
#juegosApp .mm-alb-c{background:none;border:0;padding:0;cursor:pointer;color:var(--texto,#ddd);font-family:var(--font-ui);min-width:0}
#juegosApp .mm-alb-c .mm-cara{aspect-ratio:1;height:auto;border-radius:12px}
#juegosApp .mm-alb-c.nada .mm-cara{background:#161616;border:1px dashed rgba(255,255,255,.12);display:grid;place-items:center;color:#444;font-size:22px;font-weight:800}
#juegosApp .mm-alb-c small{display:block;font-size:10px;line-height:1.2;margin-top:.25rem;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--gris)}
.mm-cara{width:100%;height:100%;border-radius:inherit;display:grid;place-items:center;overflow:hidden}
.mm-cara svg{width:78%;height:78%}
.mm-foto{background:#0b0b0b}.mm-foto img{width:100%;height:100%;object-fit:cover;user-select:none;-webkit-user-drag:none}
.mm-texto{background:linear-gradient(160deg,#1c1a14,#0e0d0a);border:2px solid var(--k);padding:6%}
.mm-texto span{color:#fff;font-family:var(--font-ui);font-weight:800;font-size:clamp(9px,2.6vw,13px);line-height:1.15;text-align:center;word-break:break-word;hyphens:auto}
.mm-dato{text-align:center;font-family:var(--font-ui)}
.mm-dato .mm-cara{width:140px;height:140px;margin:0 auto .8rem;border-radius:20px}
.mm-dato p{color:var(--texto,#ddd);font-size:15px;line-height:1.5;margin:0 0 .4rem}
.mm-dato small{color:var(--gris);font-size:12px}
#juegosApp .mm-juego{padding-top:.2rem;user-select:none;-webkit-user-select:none}
#juegosApp .mm-top{display:flex;align-items:center;gap:.6rem;margin-bottom:.7rem}
#juegosApp .mm-salir,#juegosApp .mm-pista{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:transparent;color:var(--gris);font-size:16px;cursor:pointer;flex:none}
#juegosApp .mm-pista:disabled{opacity:.3}
#juegosApp .mm-tit{flex:1;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris);font-weight:700;text-align:center}
#juegosApp .mm-hud{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.5rem}
#juegosApp .mm-hud div{background:var(--negro2,#141414);border-radius:12px;padding:.45rem .2rem;text-align:center;border:1px solid rgba(255,255,255,.06)}
#juegosApp .mm-hud b{display:block;color:var(--blanco,#fff);font-size:17px;font-variant-numeric:tabular-nums;line-height:1.15}
#juegosApp .mm-hud span{display:block;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris)}
#juegosApp .mm-hud .mm-tiempo b{color:var(--jg)}
#juegosApp .mm-tbarra{height:6px;border-radius:6px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:.5rem}
#juegosApp .mm-tbarra i{display:block;height:100%;width:100%;background:var(--jg);transition:width .2s linear}
#juegosApp .mm-tbarra.poco i{background:#e5484d}
#juegosApp .mm-combo{height:24px;text-align:center;font-size:14px;color:var(--jg);font-weight:700}
#juegosApp .mm-combo b{color:#fff}
#juegosApp .mm-combo.pop{animation:mmpop .5s ease-out}
@keyframes mmpop{0%{transform:scale(1.5);opacity:0}100%{transform:none;opacity:1}}
#juegosApp .mm-tablero{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:clamp(5px,1.6vw,9px);max-width:min(560px,calc(var(--cols) * 118px));margin:0 auto;perspective:900px}
#juegosApp .mm-carta{aspect-ratio:1;border:0;padding:0;background:none;cursor:pointer;border-radius:14px;-webkit-tap-highlight-color:transparent}
#juegosApp .mm-in{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .38s cubic-bezier(.3,.7,.3,1.1);border-radius:inherit}
#juegosApp .mm-carta.ab .mm-in,#juegosApp .mm-carta.ok .mm-in{transform:rotateY(180deg)}
#juegosApp .mm-dorso,#juegosApp .mm-frente{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:inherit;overflow:hidden}
#juegosApp .mm-dorso{background:radial-gradient(circle at 30% 25%,#2a2416,#0d0c09 70%);border:1.5px solid rgba(201,168,76,.45);display:grid;place-items:center;box-shadow:0 3px 8px rgba(0,0,0,.35)}
#juegosApp .mm-dorso svg{width:48%;height:48%;opacity:.9}
#juegosApp .mm-frente{transform:rotateY(180deg);box-shadow:0 3px 10px rgba(0,0,0,.35)}
#juegosApp .mm-carta.ok .mm-frente{box-shadow:0 0 0 3px #3fb37f,0 0 18px rgba(63,179,127,.45)}
#juegosApp .mm-carta.ok{animation:mmok .45s ease-out;cursor:default}
@keyframes mmok{50%{transform:scale(1.08)}}
#juegosApp .mm-carta.mal{animation:mmmal .35s}
@keyframes mmmal{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
#juegosApp .mm-carta.mz{animation:mmmz .6s}
@keyframes mmmz{50%{transform:scale(.7) rotate(8deg);opacity:.4}}
#juegosApp .mm-dato-vivo{margin:.8rem auto 0;max-width:560px;font-size:12.5px;line-height:1.45;color:var(--gris);min-height:2.6em;text-align:center}
#juegosApp .mm-dato-vivo b{color:var(--jg)}
#juegosApp .mm-fin{padding-top:.5rem}
#juegosApp .mm-fin h2{font-family:var(--font-display,inherit);font-size:2rem;line-height:1.05;margin:0;color:var(--jg)}
#juegosApp .mm-fin.no h2{color:#e5484d}
#juegosApp .mm-fin > p{color:var(--gris);font-size:14.5px;margin:.5rem 0 0}
#juegosApp .mm-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin:1rem 0}
#juegosApp .mm-chips span{font-size:12.5px;font-weight:700;border-radius:20px;padding:.35rem .75rem;border:1px solid rgba(201,168,76,.4);color:var(--jg);background:rgba(201,168,76,.08)}
#juegosApp .mm-fin-btns{display:flex;flex-direction:column;gap:.5rem}
#juegosApp .mm-nuevas{margin-top:1.2rem}
#juegosApp .mm-nuevas > b{display:block;color:var(--blanco,#fff);font-size:15px;margin-bottom:.6rem}
#juegosApp .mm-nueva{display:flex;gap:.75rem;align-items:flex-start;background:var(--negro2,#141414);border-radius:14px;padding:.7rem;margin-bottom:.5rem;border:1px solid rgba(255,255,255,.06)}
#juegosApp .mm-nueva .mm-cara{width:58px;height:58px;flex:none;border-radius:12px}
#juegosApp .mm-nueva b{color:var(--blanco,#fff);font-size:14px}
#juegosApp .mm-nueva p{margin:.2rem 0 0;font-size:12.5px;line-height:1.45;color:var(--texto,#ddd)}
@media (min-width:700px){#juegosApp .mm-alb{grid-template-columns:repeat(6,1fr)}}
@media (prefers-reduced-motion:reduce){#juegosApp .mm-in{transition:none}#juegosApp *{animation:none!important}}
`;
document.head.appendChild(css);
})();
