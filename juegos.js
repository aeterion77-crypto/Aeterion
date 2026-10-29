/* ============================================================
   AETERION · JUEGOS — pestaña de juegos (Trivia + Memorama).
   Memorama: 100 niveles en 10 mundos (cada mundo agrega un giro),
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

/* ---------------- Mundos y niveles ----------------
   10 mundos × 10 niveles. Todos los niveles tienen límite de movimientos:
   si se acaban antes de terminar, pierdes. Solo los 3 primeros niveles
   muestran el tablero al inicio. Para abrir un mundo necesitas 18★ del anterior. */
const MUNDOS = [
  { n: 'Calentamiento', i: '🔥', g: [], f: 2.7, txt: 'Encuentra las parejas antes de quedarte sin movimientos.', pares: [4, 5, 6, 6, 7, 8, 8, 9, 10, 10] },
  { n: 'Contra el reloj', i: '⏱️', g: ['tiempo'], f: 2.6, seg: [5, 3.8], txt: 'Tiempo límite y movimientos contados. Cada pareja suma 1 segundo.', pares: [6, 7, 8, 8, 9, 10, 10, 11, 12, 12] },
  { n: 'Ciencia', i: '🧬', g: ['concepto'], f: 2.6, txt: 'Une cada imagen con su nombre.', pares: [6, 7, 8, 8, 9, 10, 10, 11, 12, 12] },
  { n: 'Tríos', i: '🔺', g: ['trio'], f: 3.3, txt: 'Ahora son grupos de 3 cartas iguales. Si la segunda no coincide, se voltean.', pares: [4, 4, 5, 5, 6, 6, 7, 7, 8, 8] },
  { n: 'Mismo tema', i: '🎯', g: ['tema'], f: 2.5, txt: 'Todas las cartas son del mismo tema y se parecen entre sí.', pares: [8, 9, 10, 10, 11, 12, 12, 13, 14, 14] },
  { n: 'Élite', i: '🌀', g: ['mezcla'], f: 2.5, txt: 'Cada 3 errores, dos cartas cambian de lugar.', pares: [9, 10, 10, 11, 12, 12, 13, 14, 14, 15] },
  { n: 'Vistazo rápido', i: '⚡', g: ['rapido', 'tiempo'], f: 2.4, seg: [4.2, 3.2], txt: 'Las cartas se voltean casi al instante y hay tiempo límite.', pares: [9, 10, 10, 11, 12, 12, 13, 14, 14, 15] },
  { n: 'Lesiones', i: '🩹', g: ['trampa'], f: 2.4, txt: 'Hay cartas de lesión escondidas: cada una te cuesta 2 movimientos.', pares: [10, 10, 11, 12, 12, 13, 14, 14, 15, 16] },
  { n: 'Terremoto', i: '🌋', g: ['terremoto'], f: 2.75, txt: 'Cada 10 movimientos se revuelven todas las cartas que siguen boca abajo.', pares: [10, 11, 12, 12, 13, 14, 14, 15, 16, 16] },
  { n: 'Leyenda', i: '👑', g: ['concepto', 'mezcla', 'tiempo'], f: 2.5, seg: [5, 4], txt: 'Imagen + nombre, cartas que se mezclan y reloj. Solo para leyendas.', pares: [12, 13, 14, 15, 16, 17, 18, 20, 22, 24] },
];
const POR_MUNDO = 10, NIVELES = MUNDOS.length * POR_MUNDO, ESTRELLAS_MUNDO = 18;
function nivelInfo(L) {
  const w = Math.floor((L - 1) / POR_MUNDO), k = (L - 1) % POR_MUNDO, m = MUNDOS[w]; if (!m) return null;
  const p = m.pares[k], g = new Set(m.g), trio = g.has('trio');
  const trampas = g.has('trampa') ? 2 + Math.floor(k / 3) : 0;
  const limite = Math.ceil(p * m.f * (1 - 0.015 * k)) + trampas * 3;
  const seg = m.seg ? m.seg[0] + (m.seg[1] - m.seg[0]) * k / (POR_MUNDO - 1) : 0;
  return { L, w, k, p, g, trio, grupo: trio ? 3 : 2, limite, tiempo: g.has('tiempo') ? Math.round(p * seg * (g.has('concepto') ? 1.25 : 1)) : 0,
    vistazo: L <= 3, trampas, concepto: g.has('concepto') };
}
const columnas = (n) => { let mejor = 4, pts = 1e9; for (let c = 3; c <= 8; c++) { const r = Math.ceil(n / c), vac = r * c - n, s = vac * 4 + Math.abs(r - c * 1.35) * 2 + (c > 6 ? 6 : 0); if (s < pts) { pts = s; mejor = c; } } return mejor; };
const estrellasDe = (cfg, mov, pista) => { const e = mov <= Math.ceil(cfg.limite * 0.72) ? 3 : mov <= Math.ceil(cfg.limite * 0.86) ? 2 : 1; return pista ? Math.min(2, e) : e; };
const estrellasMundo = (d, w) => { let s = 0; for (let L = w * POR_MUNDO + 1; L <= (w + 1) * POR_MUNDO; L++) s += d.estrellas[L] || 0; return s; };
const mundoAbierto = (d, w) => w === 0 || (d.nivel > w * POR_MUNDO && estrellasMundo(d, w - 1) >= ESTRELLAS_MUNDO);
const nivelAbierto = (d, L) => L <= d.nivel && mundoAbierto(d, Math.floor((L - 1) / POR_MUNDO));

/* ---------------- Estado ---------------- */
// v2: los niveles cambiaron (100 niveles más difíciles). Se conserva álbum, retos diarios, racha y récord.
function leer() {
  let d = null; try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  d = Object.assign({ v: 2, nivel: 1, estrellas: {}, mejor: {}, album: {}, diario: {}, racha: 0, ultimoDiario: null, infinito: 0, recientes: [], partidas: 0, puntos: 0, t: 0 }, d || {});
  if (d.v !== 2) { d.v = 2; d.nivel = 1; d.estrellas = {}; d.mejor = {}; d.puntos = 0; }
  return d;
}
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
// Elige p cartas sin repetir las que salieron hace poco; entra un producto Aeterion si hay 4+ parejas.
// tema: todas de una sola categoría (más difícil: se parecen en color y estilo).
function elegirCartas(p, d, r, tema) {
  const L = CARTAS.lista, prods = L.filter((c) => c.cat === 'aeterion');
  let resto = L.filter((c) => c.cat !== 'aeterion');
  if (tema) { const cats = barajar(Object.keys(CARTAS.cats).filter((k) => k !== 'aeterion' && resto.filter((c) => c.cat === k).length >= p), r); if (cats.length) resto = resto.filter((c) => c.cat === cats[0]); }
  const rec = new Set(r ? [] : d.recientes);
  const frescas = barajar(resto.filter((c) => !rec.has(c.id)), r), usadas = barajar(resto.filter((c) => rec.has(c.id)), r);
  const sel = [];
  if (p >= 4 && !tema) sel.push(barajar(prods, r)[0]);
  for (const c of [...frescas, ...usadas]) { if (sel.length >= p) break; sel.push(c); }
  if (sel.length < p) for (const c of barajar(L.filter((c) => !sel.includes(c)), r)) { if (sel.length >= p) break; sel.push(c); }
  if (!r) { d.recientes = [...sel.map((c) => c.id), ...d.recientes.filter((id) => !sel.some((c) => c.id === id))].slice(0, 60); }
  return sel;
}
const TRAMPA = `<div class="mm-cara mm-trampa"><svg viewBox="0 0 64 64" aria-label="Lesión"><rect x="8" y="22" width="48" height="20" rx="10" fill="#f2c9a5" stroke="#2b2118" stroke-width="2.4" transform="rotate(-35 32 32)"/><rect x="24" y="24" width="16" height="16" rx="3" fill="#e8b58a" stroke="#2b2118" stroke-width="2" transform="rotate(-35 32 32)"/><g fill="#c48a5c" transform="rotate(-35 32 32)"><circle cx="28" cy="29" r="1.3"/><circle cx="36" cy="29" r="1.3"/><circle cx="28" cy="35" r="1.3"/><circle cx="36" cy="35" r="1.3"/></g></svg><b>−2 mov</b></div>`;
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
  else if (V === 'ranking') { r.innerHTML = rankingHtml(); cargarRanking(); }
}

/* ---------------- HUB ---------------- */
function hub() {
  const t = window.triviaResumen ? triviaResumen() : { puntos: 0, nivel: 1, rayos: 3, superados: 0 };
  const d = leer(); const est = Object.values(d.estrellas).reduce((a, x) => a + x, 0);
  const diarioHecho = !!d.diario[hoy()];
  return `<h2 class="app-titulo">Juegos</h2><p class="app-subtitulo">Aprende de salud y entrenamiento jugando</p>
    <button class="jg-tarjeta jg-trivia" onclick="aetIr('trivia')"><div class="jg-ico">⚡</div><div class="jg-txt"><b>Trivia Aeterion</b><span>15 niveles · 180 preguntas con tiempo</span>
      <div class="jg-chips"><em>Nivel ${t.nivel}</em><em>${fmt(t.puntos)} pts</em><em>${'⚡'.repeat(t.rayos)}${'·'.repeat(3 - t.rayos)} rayos</em></div></div><i>›</i></button>
    <button class="jg-tarjeta jg-memo" data-jg="memo"><div class="jg-ico">🧠</div><div class="jg-txt"><b>Memorama</b><span>${NIVELES} niveles difíciles · ${CARTAS ? CARTAS.lista.length : 82} cartas de fitness, ciencia y productos Aeterion</span>
      <div class="jg-chips"><em>Nivel ${Math.min(d.nivel, NIVELES)}</em><em>★ ${est}/${NIVELES * 3}</em><em>Álbum ${Object.keys(d.album).length}</em></div></div><i>›</i></button>
    <button class="jg-tarjeta jg-diario ${diarioHecho ? 'hecho' : ''}" data-jg="diario"><div class="jg-ico">📅</div><div class="jg-txt"><b>Reto diario</b><span>${diarioHecho ? `Hecho hoy en ${d.diario[hoy()].mov} movimientos · vuelve mañana` : 'El mismo tablero para todos, una vez al día'}</span>
      <div class="jg-chips"><em>🔥 Racha ${d.racha} ${d.racha === 1 ? 'día' : 'días'}</em></div></div><i>›</i></button>
    <button class="jg-tarjeta jg-rank" data-jg="ranking"><div class="jg-ico">🏆</div><div class="jg-txt"><b>Ranking</b><span>Compite con otros usuarios de Aeterion en Trivia y Memorama</span>
      <div class="jg-chips"><em>Trivia</em><em>Memorama</em><em>Contrarreloj</em><em>Reto de hoy</em></div></div><i>›</i></button>
    <p class="jg-nota">Más juegos próximamente.</p>`;
}

/* ---------------- MENÚ DEL MEMORAMA ---------------- */
let mundoVisto = null;
function memoMenu() {
  const d = leer(); const L0 = Math.min(d.nivel, NIVELES); const wAct = Math.floor((L0 - 1) / POR_MUNDO);
  const totE = Object.values(d.estrellas).reduce((a, x) => a + x, 0);
  const puedeSeguir = nivelAbierto(d, L0);
  let h = `<button class="app-visor-volver" data-jg="hub">← Volver a Juegos</button><h2 class="app-titulo">Memorama</h2><p class="app-subtitulo">${NIVELES} niveles · ★ ${totE} de ${NIVELES * 3}</p>
    <div class="mm-modos"><button class="mm-modo" data-jg="jugar" data-l="${puedeSeguir ? L0 : wAct * POR_MUNDO}"><b>▶ Nivel ${puedeSeguir ? L0 : wAct * POR_MUNDO}</b><span>${puedeSeguir ? 'Continuar' : `Te faltan ★ para el mundo ${wAct + 1}`}</span></button>
      <button class="mm-modo" data-jg="diario"><b>📅 Reto diario</b><span>${d.diario[hoy()] ? 'Hecho ✓' : 'Disponible'}</span></button>
      <button class="mm-modo" data-jg="infinito"><b>⏱️ Contrarreloj</b><span>Récord ${d.infinito} parejas</span></button>
      <button class="mm-modo" data-jg="album"><b>📖 Álbum</b><span>${Object.keys(d.album).length} de ${CARTAS.lista.length}</span></button></div>`;
  const abierto = mundoVisto == null ? wAct : mundoVisto;
  MUNDOS.forEach((m, w) => {
    const ab = mundoAbierto(d, w) || (w === 0), est = estrellasMundo(d, w), ini = w * POR_MUNDO + 1;
    const falta = w > 0 && !ab ? (d.nivel > w * POR_MUNDO ? `Necesitas ${ESTRELLAS_MUNDO}★ en «${MUNDOS[w - 1].n}» (llevas ${estrellasMundo(d, w - 1)})` : `Termina «${MUNDOS[w - 1].n}» para abrirlo`) : '';
    h += `<section class="mm-mundo ${ab ? '' : 'bloq'} ${w === abierto ? 'on' : ''}"><button class="mm-mundo-cab" data-jg="mundo" data-w="${w}"><span>${ab ? m.i : '🔒'}</span><div><b>Mundo ${w + 1} · ${m.n}</b><small>${ab ? m.txt : falta}</small></div><em>${est}/30★</em></button>`;
    if (w === abierto) {
      h += '<div class="mm-nvs">';
      for (let L = ini; L < ini + POR_MUNDO; L++) { const st = d.estrellas[L], bl = !nivelAbierto(d, L), ni = nivelInfo(L);
        h += `<button class="mm-nv ${st ? 'hecho' : L === d.nivel ? 'actual' : ''} ${bl ? 'bloq' : ''}" data-jg="jugar" data-l="${L}" ${bl ? 'disabled' : ''} aria-label="Nivel ${L}">${L}<small>${st ? '★'.repeat(st) + '☆'.repeat(3 - st) : bl ? '🔒' : ni.p + (ni.trio ? ' tríos' : ' pares')}</small></button>`; }
      h += '</div>';
    }
    h += '</section>';
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
let reloj = 0, tVuelta = 0, tTrampa = 0;
function pararReloj() { clearInterval(reloj); clearTimeout(tVuelta); clearTimeout(tTrampa); }
const GIROS_DIARIO = [[], ['concepto'], ['mezcla'], ['tema'], ['trio'], ['terremoto'], ['trampa']];
function armarMazo(sel, cfg, r) {
  const mazo = [];
  sel.forEach((c, i) => { for (let k = 0; k < cfg.grupo; k++) mazo.push({ c, txt: cfg.concepto && k === 1, par: i }); });
  for (let t = 0; t < (cfg.trampas || 0); t++) mazo.push({ trampa: true, par: -1 - t });
  return barajar(mazo, r);
}
async function empezar(modo, L) {
  try { await cargarCartas(); } catch (e) { toast('Sin conexión: no se pudieron cargar las cartas.'); return; }
  const d = leer(); let cfg;
  if (modo === 'nivel') { if (!nivelAbierto(d, L)) return; cfg = nivelInfo(L); }
  else if (modo === 'diario') {
    const r = azar(Number(hoy().replace(/-/g, ''))); const g = new Set(GIROS_DIARIO[Math.floor(r() * GIROS_DIARIO.length)]); const trio = g.has('trio');
    const p = trio ? 7 : 14; cfg = { p, g, trio, grupo: trio ? 3 : 2, concepto: g.has('concepto'), trampas: g.has('trampa') ? 3 : 0, limite: Math.ceil(p * (trio ? 3.2 : 2.45)), tiempo: 0, vistazo: false, r };
  } else cfg = { p: 6, g: new Set(), grupo: 2, limite: 0, tiempo: 40, vistazo: false, trampas: 0 };
  const r = cfg.r || null;
  const sel = elegirCartas(cfg.p, d, r, cfg.g.has('tema')); guardar(d);
  P = { modo, L, cfg, mazo: armarMazo(sel, cfg, r), abiertas: [], hechas: 0, mov: 0, errores: 0, combo: 0, mejorCombo: 0, pts: 0, pista: false, ini: 0, resta: cfg.tiempo, nuevas: [], tablero: 1, totalPares: 0, fin: false, bloq: true, extra: 0 };
  V = 'juego'; pintarJuego(); window.scrollTo(0, 0);
  if (cfg.vistazo) {
    const ver = 700 + cfg.p * 90;
    setTimeout(() => { document.querySelectorAll('#mmTablero .mm-carta').forEach((e) => e.classList.add('ab')); }, 120);
    tVuelta = setTimeout(() => { if (!P) return; document.querySelectorAll('#mmTablero .mm-carta').forEach((e) => e.classList.remove('ab')); P.bloq = false; P.ini = Date.now(); arrancarReloj(); }, ver + 120);
  } else { P.bloq = false; P.ini = Date.now(); arrancarReloj(); }
}
function tituloPartida() { return P.modo === 'nivel' ? `Nivel ${P.L} · ${MUNDOS[P.cfg.w].n}` : P.modo === 'diario' ? 'Reto diario' : `Contrarreloj · tablero ${P.tablero}`; }
const giroTxt = (c) => [c.concepto && 'imagen + nombre', c.trio && 'tríos', c.g.has('tema') && 'mismo tema', c.g.has('mezcla') && 'se mezclan', c.g.has('rapido') && 'vistazo rápido', c.trampas && 'lesiones', c.g.has('terremoto') && 'terremoto'].filter(Boolean).join(' · ');
function pintarJuego() {
  const cols = columnas(P.mazo.length), c = P.cfg, gt = giroTxt(c);
  raiz().innerHTML = `<div class="mm-juego"><div class="mm-top"><button class="mm-salir" data-jg="salir" aria-label="Salir">✕</button><div class="mm-tit">${esc(tituloPartida())}${gt ? `<small>${esc(gt)}</small>` : ''}</div>
      <button class="mm-pista" data-jg="pista" ${P.pista || P.modo === 'infinito' ? 'disabled' : ''} title="Ver todas un segundo (máximo 2 estrellas)">💡</button></div>
    <div class="mm-hud"><div class="${c.limite ? 'mm-lim' : ''}"><b id="mmMov">${c.limite ? `${P.mov}<i>/${c.limite}</i>` : P.mov}</b><span>Movimientos</span></div><div><b id="mmPar">${P.hechas}/${c.p}</b><span>${c.trio ? 'Tríos' : 'Parejas'}</span></div><div class="${c.tiempo ? 'mm-tiempo' : ''}"><b id="mmT">${c.tiempo ? mmss(P.resta) : '0:00'}</b><span>${c.tiempo ? 'Restante' : 'Tiempo'}</span></div><div><b id="mmPts">${fmt(P.pts)}</b><span>Puntos</span></div></div>
    ${c.limite ? '<div class="mm-tbarra mm-mbarra"><i id="mmMB"></i></div>' : ''}${c.tiempo ? '<div class="mm-tbarra"><i id="mmTB"></i></div>' : ''}
    <div class="mm-combo" id="mmCombo"></div>
    <div class="mm-tablero" id="mmTablero" style="--cols:${cols}">${P.mazo.map((m, i) => `<button class="mm-carta" data-jg="carta" data-i="${i}" aria-label="Carta ${i + 1}"><div class="mm-in">${DORSO}<div class="mm-frente">${m.trampa ? TRAMPA : caraHtml(m.c, m.txt)}</div></div></button>`).join('')}</div>
    <div class="mm-dato-vivo" id="mmVivo">${P.modo === 'nivel' && P.L <= 3 ? 'Memoriza el tablero: solo en los primeros niveles lo ves al empezar.' : ''}</div></div>`;
  hudMov();
}
function hudMov() {
  const c = P.cfg, m = $('mmMov'); if (!m) return;
  if (c.limite) { m.innerHTML = `${P.mov}<i>/${c.limite}</i>`; const b = $('mmMB'); if (b) { const f = Math.max(0, 1 - P.mov / c.limite); b.style.width = f * 100 + '%'; b.parentElement.classList.toggle('poco', f < 0.2); } m.parentElement.classList.toggle('poco', c.limite - P.mov <= 3); }
  else m.textContent = P.mov;
}
function arrancarReloj() {
  pararReloj();
  const t0 = Date.now(), r0 = P.resta;
  reloj = setInterval(() => {
    if (!P || P.fin) return pararReloj();
    if (P.cfg.tiempo) {
      P.resta = Math.max(0, r0 - (Date.now() - t0) / 1000 + (P.extra || 0));
      const t = $('mmT'); if (t) t.textContent = mmss(P.resta);
      const b = $('mmTB'); if (b) { b.style.width = Math.min(100, P.resta / P.cfg.tiempo * 100) + '%'; b.parentElement.classList.toggle('poco', P.resta < 8); }
      if (P.resta <= 0) terminar(false, 'tiempo');
    } else { const t = $('mmT'); if (t) t.textContent = mmss((Date.now() - P.ini) / 1000); }
  }, 200);
}
function sumarTiempo(s) { if (P.cfg.tiempo) P.extra = (P.extra || 0) + s; }
const cartaEl = (k) => document.querySelector(`#mmTablero .mm-carta[data-i="${k}"]`);
function aviso(html) { const cb = $('mmCombo'); if (!cb) return; cb.innerHTML = html; cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop'); }
function contarMov(n) {
  P.mov += n; hudMov();
  if (P.cfg.g.has('terremoto') && Math.floor(P.mov / 10) > Math.floor((P.mov - n) / 10)) setTimeout(terremoto, 700);
}
function voltear(i) {
  if (!P || P.bloq || P.fin) return;
  const el = cartaEl(i); if (!el || el.classList.contains('ab') || el.classList.contains('ok')) return;
  if (P.pendiente) cerrarPendientes();
  const m = P.mazo[i];
  if (m.trampa) {
    cerrarPendientes(); el.classList.add('ab'); P.bloq = true; P.combo = 0;
    contarMov(2); sumarTiempo(-5); vibrar([80, 40, 80]); aviso('<b class="mal">¡Lesión!</b> −2 movimientos' + (P.cfg.tiempo ? ' · −5 s' : ''));
    tTrampa = setTimeout(() => { el.classList.remove('ab'); if (P) { P.bloq = false; revisarLimite(); } }, 650);
    return;
  }
  el.classList.add('ab'); P.abiertas.push(i);
  const prim = P.mazo[P.abiertas[0]];
  if (m.par !== prim.par) {   // fallo
    contarMov(1); P.combo = 0; P.errores++; P.pendiente = true;
    tVuelta = setTimeout(cerrarPendientes, P.cfg.g.has('rapido') ? 330 : 720);
    if (P.cfg.g.has('mezcla') && P.errores % 3 === 0) setTimeout(mezclar, 760);
    if (!revisarLimite()) return;
    return;
  }
  if (P.abiertas.length < P.cfg.grupo) return;   // va bien en un trío
  contarMov(1);
  P.combo++; P.mejorCombo = Math.max(P.mejorCombo, P.combo); P.hechas++; P.totalPares++;
  const ganan = 100 * (P.cfg.grupo - 1) + (P.combo > 1 ? (P.combo - 1) * 60 : 0); P.pts += ganan;
  P.abiertas.forEach((k) => { const e = cartaEl(k); e.classList.add('ok'); e.disabled = true; });
  P.abiertas = [];
  const d = leer(); if (!d.album[prim.c.id]) { d.album[prim.c.id] = hoy(); P.nuevas.push(prim.c); guardar(d); }
  $('mmPar').textContent = `${P.hechas}/${P.cfg.p}`; $('mmPts').textContent = fmt(P.pts);
  if (P.combo > 1) aviso(`<b>¡Combo x${P.combo}!</b> +${ganan}`);
  const vivo = $('mmVivo'); if (vivo) vivo.innerHTML = `<b>${esc(prim.c.n)}</b> ${esc(prim.c.d)}`;
  sumarTiempo(P.modo === 'infinito' ? 2 : 1); vibrar(25);
  if (P.hechas === P.cfg.p) { if (P.modo === 'infinito') return siguienteTablero(); P.bloq = true; setTimeout(() => terminar(true), 450); return; }
  revisarLimite();
}
// Sin movimientos: pierdes (se revisa después de cada movimiento que no terminó el tablero)
function revisarLimite() {
  if (!P || !P.cfg.limite || P.fin || P.hechas === P.cfg.p) return true;
  if (P.mov >= P.cfg.limite) { P.bloq = true; setTimeout(() => terminar(false, 'movs'), 800); return false; }
  return true;
}
function cerrarPendientes() {
  clearTimeout(tVuelta); if (!P) return; P.pendiente = false;
  P.abiertas.forEach((k) => { const e = cartaEl(k); if (e && !e.classList.contains('ok')) { e.classList.remove('ab'); e.classList.add('mal'); setTimeout(() => e.classList.remove('mal'), 350); } });
  P.abiertas = [];
}
const cerradas = () => P.mazo.map((_, i) => i).filter((i) => { const e = cartaEl(i); return e && !e.classList.contains('ok') && !e.classList.contains('ab'); });
function reponer(ks) { ks.forEach((k) => { const e = cartaEl(k); const m = P.mazo[k]; e.querySelector('.mm-frente').innerHTML = m.trampa ? TRAMPA : caraHtml(m.c, m.txt); e.classList.remove('mz'); void e.offsetWidth; e.classList.add('mz'); }); }
function mezclar() {
  if (!P || P.fin) return; const libres = cerradas(); if (libres.length < 4) return;
  const [x, y] = barajar(libres).slice(0, 2); [P.mazo[x], P.mazo[y]] = [P.mazo[y], P.mazo[x]]; reponer([x, y]);
  aviso('<b>¡Se mezclaron 2 cartas!</b>');
}
function terremoto() {
  if (!P || P.fin) return; const libres = cerradas(); if (libres.length < 3) return;
  const nuevas = barajar(libres.map((k) => P.mazo[k])); libres.forEach((k, j) => { P.mazo[k] = nuevas[j]; }); reponer(libres);
  const t = $('mmTablero'); if (t) { t.classList.remove('tiembla'); void t.offsetWidth; t.classList.add('tiembla'); }
  vibrar([40, 30, 40, 30, 40]); aviso('<b>¡Terremoto!</b> Se revolvieron las cartas boca abajo');
}
function pista() {
  if (!P || P.pista || P.bloq || P.fin || P.modo === 'infinito') return;
  P.pista = true; P.bloq = true; cerrarPendientes(); contarMov(2);
  const bt = document.querySelector('[data-jg="pista"]'); if (bt) bt.disabled = true;
  const cs = [...document.querySelectorAll('#mmTablero .mm-carta:not(.ok)')]; cs.forEach((e) => e.classList.add('ab'));
  setTimeout(() => { cs.forEach((e) => e.classList.remove('ab')); if (P) { P.bloq = false; revisarLimite(); } }, 900);
}
function siguienteTablero() {
  P.bloq = true; sumarTiempo(4); P.tablero++;
  const d = leer(); const p = Math.min(14, 6 + (P.tablero - 1) * 2);
  setTimeout(() => {
    if (!P || P.fin) return;
    const g = P.tablero >= 4 ? new Set(['rapido']) : new Set(); P.cfg.g = g;
    const sel = elegirCartas(p, d); guardar(d);
    P.cfg.p = p; P.mazo = armarMazo(sel, P.cfg); P.hechas = 0; P.abiertas = []; P.pendiente = false;
    const ini = P.ini, extra = P.extra; pintarJuego(); P.ini = ini; P.extra = extra;
    aviso(`<b>¡Tablero ${P.tablero}!</b> +4 s${P.tablero === 4 ? ' · ahora se voltean más rápido' : ''}`);
    P.bloq = false;
  }, 500);
}
function terminar(gano, motivo) {
  if (!P || P.fin) return; P.fin = true; pararReloj();
  const T = P; const seg = (Date.now() - T.ini) / 1000; const d = leer(); d.partidas++;
  let tit, sub, chips = [], btns = '';
  if (T.modo === 'infinito') {
    const rec = T.totalPares > d.infinito; if (rec) d.infinito = T.totalPares;
    tit = rec ? '¡Nuevo récord!' : '¡Se acabó el tiempo!'; sub = `${T.totalPares} parejas en ${T.tablero} ${T.tablero === 1 ? 'tablero' : 'tableros'} · ${fmt(T.pts)} pts`;
    chips.push(`Récord: ${d.infinito} parejas`, `Mejor combo x${T.mejorCombo}`);
    btns = '<button class="jg-btn" data-jg="infinito">Jugar otra vez</button>';
  } else if (!gano) {
    tit = motivo === 'movs' ? 'Sin movimientos' : 'Se acabó el tiempo';
    sub = `Encontraste ${T.hechas} de ${T.cfg.p} ${T.cfg.trio ? 'tríos' : 'parejas'}${motivo === 'movs' ? ` con ${T.cfg.limite} movimientos` : ''}. ¡Inténtalo de nuevo!`;
    chips.push(motivo === 'movs' ? 'Tip: abre primero cartas que no has visto y recuerda su lugar' : 'Tip: no pierdas tiempo; si no recuerdas, abre una carta nueva');
    btns = T.modo === 'nivel' ? `<button class="jg-btn" data-jg="jugar" data-l="${T.L}">Reintentar nivel ${T.L}</button>` : '<button class="jg-btn" data-jg="diario">Reintentar reto</button>';
  } else {
    const est = estrellasDe(T.cfg, T.mov, T.pista); const bonoT = T.cfg.tiempo ? Math.round(T.resta) * 15 : 0; const bonoM = Math.max(0, T.cfg.limite - T.mov) * 40;
    const tot = T.pts + est * 150 + bonoT + bonoM;
    sub = `${'★'.repeat(est)}${'☆'.repeat(3 - est)} · ${T.mov} de ${T.cfg.limite} movimientos · ${mmss(seg)} · ${fmt(tot)} pts`;
    if (est < 3) chips.push(`3★ con ${Math.ceil(T.cfg.limite * 0.72)} movimientos o menos${T.pista ? ' y sin pista' : ''}`);
    if (T.modo === 'nivel') {
      const nuevo = !d.estrellas[T.L], antes = estrellasMundo(d, T.cfg.w);
      d.estrellas[T.L] = Math.max(d.estrellas[T.L] || 0, est);
      const m = d.mejor[T.L]; if (!m || T.mov < m.mov) d.mejor[T.L] = { mov: T.mov, t: Math.round(seg) };
      if (nuevo) { d.puntos += tot; d.nivel = Math.max(d.nivel, Math.min(NIVELES, T.L + 1)); }
      tit = T.L === NIVELES && nuevo ? '¡Leyenda del memorama!' : `Nivel ${T.L} superado`;
      const ahora = estrellasMundo(d, T.cfg.w), sig = T.L + 1;
      if (T.L < NIVELES) {
        const nw = Math.floor((sig - 1) / POR_MUNDO);
        if (nw !== T.cfg.w) { if (ahora >= ESTRELLAS_MUNDO) chips.push(antes < ESTRELLAS_MUNDO || nuevo ? `¡Abriste el mundo ${nw + 1}: ${MUNDOS[nw].n}!` : `Mundo ${nw + 1}: ${MUNDOS[nw].n}`); else chips.push(`Necesitas ${ESTRELLAS_MUNDO}★ en este mundo para abrir el siguiente (llevas ${ahora})`); }
        else if (nuevo) chips.push(`Desbloqueaste el nivel ${sig}`);
      }
      btns = (T.L < NIVELES && nivelAbierto(d, sig) ? `<button class="jg-btn" data-jg="jugar" data-l="${sig}">Siguiente nivel</button>` : '') + `<button class="jg-btn ${T.L < NIVELES && nivelAbierto(d, sig) ? 'jg-sec' : ''}" data-jg="jugar" data-l="${T.L}">Repetir${est < 3 ? ' por más ★' : ''}</button>`;
    } else {
      tit = '¡Reto diario completado!'; const prev = d.diario[hoy()];
      if (!prev || T.mov < prev.mov) d.diario[hoy()] = { mov: T.mov, t: Math.round(seg), est };
      if (d.ultimoDiario !== hoy()) { const x = new Date(hoy() + 'T12:00:00'); x.setDate(x.getDate() - 1); const ayer = x.toISOString().slice(0, 10); d.racha = d.ultimoDiario === ayer ? d.racha + 1 : 1; d.ultimoDiario = hoy(); }
      const ks = Object.keys(d.diario).sort(); if (ks.length > 60) ks.slice(0, ks.length - 60).forEach((k) => delete d.diario[k]);
      chips.push(`🔥 Racha de ${d.racha} ${d.racha === 1 ? 'día' : 'días'}`, 'Mañana hay un tablero nuevo');
    }
    if (T.mejorCombo > 1) chips.push(`Mejor combo x${T.mejorCombo}`);
  }
  guardar(d); window.juegosReportar();
  try { if (typeof aetEvento === 'function') aetEvento('memo_' + T.modo + (gano ? '_ok' : '_fin')); } catch (e) {}
  const nuevas = T.nuevas.length ? `<div class="mm-nuevas"><b>${T.nuevas.length === 1 ? 'Nueva carta en tu álbum' : T.nuevas.length + ' cartas nuevas en tu álbum'}</b>${T.nuevas.map((c) => `<div class="mm-nueva">${caraHtml(c)}<div><b>${esc(c.n)}</b><p>${esc(c.d)}</p></div></div>`).join('')}</div>` : '';
  raiz().innerHTML = `<div class="mm-fin ${gano || T.modo === 'infinito' ? 'ok' : 'no'}"><h2>${tit}</h2><p>${sub}</p><div class="mm-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    <div class="mm-fin-btns">${btns}<button class="jg-btn jg-sec" data-jg="memo">Memorama</button><button class="jg-btn jg-sec" data-jg="hub">Juegos</button></div>${nuevas}</div>`;
  P = null; V = 'fin'; window.scrollTo(0, 0);
  if (gano && T.modo === 'nivel' && d.estrellas[T.L] === 3) confeti();
}
function confeti() { for (let i = 0; i < 22; i++) { const g = document.createElement('i'); g.className = 'tv-confeti'; g.style.left = Math.random() * 100 + '%'; g.style.background = ['#c9a84c', '#7fd8ff', '#3fb37f', '#e5484d'][i % 4]; g.style.animationDelay = Math.random() * 0.5 + 's'; document.body.appendChild(g); setTimeout(() => g.remove(), 3200); } }
function salir() {
  if (P && !P.fin && P.modo !== 'infinito' && P.mov > 0 && !confirm('¿Salir de la partida? No se guarda el avance de este tablero.')) return;
  if (P && P.modo === 'infinito' && !P.fin && P.totalPares > 0) return terminar(false);
  ir('memo');
}


/* ---------------- RANKING (en la nube) ---------------- */
const conSesion = () => { try { return typeof sesionActiva !== 'undefined' && sesionActiva && typeof _rpc === 'function'; } catch (e) { return false; } };
let _tRep = 0;
// Sube tus mejores marcas (Trivia + Memorama). Se llama al terminar partidas y al abrir el ranking.
window.juegosReportar = function (ya) {
  clearTimeout(_tRep);
  const enviar = async () => {
    if (!conSesion()) return;
    const m = leer(); let t = {}; try { t = JSON.parse(localStorage.getItem('aet_trivia')) || {}; } catch (e) {}
    const dd = m.diario[hoy()];
    const p = { trivia_puntos: Math.round(t.puntos || 0), trivia_nivel: Math.min(15, t.nivel || 1), memo_estrellas: Object.values(m.estrellas).reduce((a, x) => a + x, 0), memo_nivel: Math.min(NIVELES, m.nivel || 1),
      memo_infinito: m.infinito || 0, diario_fecha: dd ? hoy() : null, diario_mov: dd ? dd.mov : null, diario_seg: dd ? dd.t : null };
    try { await _rpc('juegos_reportar', { p }); } catch (e) {}
  };
  if (ya) return enviar(); _tRep = setTimeout(enviar, 1200);
};
const TABLAS = [['trivia', 'Trivia', 'pts'], ['memo', 'Memorama', '★'], ['infinito', 'Contrarreloj', 'parejas'], ['diario', 'Reto de hoy', 'mov']];
let tablaR = 'trivia', RK = null;
function rankingHtml() {
  let h = `<button class="app-visor-volver" data-jg="hub">← Volver a Juegos</button><h2 class="app-titulo">Ranking</h2><p class="app-subtitulo">Los mejores jugadores de Aeterion</p>`;
  if (!conSesion()) return h + `<div class="rk-vacio"><b>Inicia sesión para ver el ranking</b><p>Tus marcas se guardan en tu cuenta y compites con el nombre que pusiste en la app.</p><button class="jg-btn" onclick="abrirCuenta()">Entrar o crear cuenta</button></div>`;
  h += `<div class="rk-tabs">${TABLAS.map(([k, n]) => `<button class="${k === tablaR ? 'on' : ''}" data-jg="rk-tabla" data-t="${k}">${n}</button>`).join('')}</div><div id="rkCuerpo"><div class="rk-cargando">Cargando…</div></div>`;
  return h;
}
const valorTxt = (t, x) => t === 'trivia' ? fmt(x.valor) + ' pts' : t === 'memo' ? `${x.valor}★` : t === 'infinito' ? `${x.valor} parejas` : `${x.valor} mov`;
const extraTxt = (t, x) => x.extra == null ? '' : t === 'trivia' ? `nivel ${x.extra}` : t === 'memo' ? `nivel ${x.extra}` : t === 'diario' ? mmss(x.extra) : '';
async function cargarRanking() {
  if (!conSesion()) return;
  await window.juegosReportar(true);
  const t = tablaR; let r;
  try { r = await _rpc('juegos_ranking', { p_tabla: t, p_limite: 50 }); } catch (e) { r = { ok: false }; }
  const c = $('rkCuerpo'); if (!c || t !== tablaR || V !== 'ranking') return;
  if (!r.ok) { c.innerHTML = `<div class="rk-vacio"><b>No se pudo cargar</b><p>${r.red ? 'Revisa tu conexión.' : 'Inténtalo de nuevo en un momento.'}</p><button class="jg-btn jg-sec" data-jg="rk-tabla" data-t="${t}">Reintentar</button></div>`; return; }
  RK = r.data; const yo = RK.yo || {};
  const medalla = (p) => p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : p;
  let h = '';
  h += `<div class="rk-yo"><div><small>Tú · ${esc(yo.nombre || '')}</small><b>${yo.valor != null ? valorTxt(t, yo) : t === 'diario' ? 'Aún no juegas el reto de hoy' : 'Sin marca todavía'}</b><span>${!yo.visible ? 'Estás oculto del ranking' : RK.mi_pos ? `Lugar #${RK.mi_pos} de ${RK.total}` : RK.total ? `${RK.total} ${RK.total === 1 ? 'jugador' : 'jugadores'}` : ''}</span></div>${RK.mi_pos && yo.visible ? `<em>#${RK.mi_pos}</em>` : ''}</div>`;
  h += RK.lista.length ? `<ol class="rk-lista">${RK.lista.map((x) => `<li class="${x.yo ? 'yo' : ''} ${x.pos <= 3 ? 'top' : ''}"><span class="rk-pos">${medalla(x.pos)}</span><span class="rk-av">${esc((x.nombre || '?').slice(0, 1).toUpperCase())}</span><div><b>${esc(x.nombre)}${x.yo ? ' (tú)' : ''}</b><small>${esc(extraTxt(t, x))}</small></div><strong>${valorTxt(t, x)}</strong></li>`).join('')}</ol>`
    : `<div class="rk-vacio"><b>${t === 'diario' ? 'Nadie ha completado el reto de hoy' : 'Todavía no hay marcas'}</b><p>¡Sé el primero!</p></div>`;
  h += `<label class="rk-switch"><input type="checkbox" id="rkVisible" ${yo.visible ? 'checked' : ''}><span class="rk-sw"></span><div><b>Aparecer en el ranking</b><small>Apareces como «${esc(yo.nombre || '')}». Cambia tu nombre en Cuenta › Mi perfil.</small></div></label>`;
  if (yo.oculto_admin) h += '<p class="jg-nota">Tu perfil fue ocultado del ranking por el equipo de Aeterion. Escríbenos en Ayuda si crees que es un error.</p>';
  c.innerHTML = h;
}
document.addEventListener('change', async (e) => {
  if (!e.target || e.target.id !== 'rkVisible') return;
  const v = e.target.checked; e.target.disabled = true;
  try { const r = await _rpc('juegos_visible', { p_visible: v }); if (!r.ok) throw 0; toast(v ? 'Ahora apareces en el ranking' : 'Ya no apareces en el ranking'); } catch (x) { e.target.checked = !v; toast('No se pudo cambiar. Revisa tu conexión.'); }
  e.target.disabled = false; cargarRanking();
});

/* ---------------- Eventos ---------------- */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-jg]'); if (!el || !raiz() || !raiz().contains(el) || el.disabled) return;
  const a = el.dataset.jg;
  if (a === 'carta') return voltear(Number(el.dataset.i));
  if (a === 'hub') return ir('hub');
  if (a === 'ranking') return ir('ranking');
  if (a === 'rk-tabla') { tablaR = el.dataset.t; return pintar(); }
  if (['memo', 'album'].includes(a)) { try { await cargarCartas(); } catch (e) { toast('Sin conexión.'); return; } if (a === 'memo' && V === 'hub') mundoVisto = null; return ir(a); }
  if (a === 'mundo') { mundoVisto = Number(el.dataset.w); return pintar(); }
  if (a === 'jugar') return empezar('nivel', Number(el.dataset.l));
  if (a === 'diario') { const d = leer(); if (d.diario[hoy()] && !confirm('Ya hiciste el reto de hoy. ¿Quieres intentar mejorar tus movimientos?')) return; return empezar('diario'); }
  if (a === 'infinito') return empezar('infinito');
  if (a === 'pista') return pista();
  if (a === 'salir') return salir();
  if (a === 'dato') return verDato(el.dataset.id);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && P && !P.fin && !P.cfg.tiempo) { /* sin tiempo límite: el cronómetro sigue, sin castigo */ } });

/* ---------------- API para la app ---------------- */
window.juegosRender = function () { cargarCartas().catch(() => {}); if (!P) { if (V !== 'memo' && V !== 'album' && V !== 'ranking') V = 'hub'; pintar(); } };
window.juegosSub = function () { return V !== 'hub'; };
window.juegosVolver = function () { if (V === 'juego') { salir(); return true; } if (V === 'album' || V === 'fin') { ir('memo'); return true; } if (V === 'memo' || V === 'ranking') { ir('hub'); return true; } return false; };
window.memoResumen = function () { const d = leer(); return { nivel: Math.min(d.nivel, NIVELES), estrellas: Object.values(d.estrellas).reduce((a, x) => a + x, 0), album: Object.keys(d.album).length }; };
window.memoFusion = function (R, L) {
  R = R || {}; L = L || {};
  const v1 = (x) => x.v !== 2 ? Object.assign({}, x, { v: 2, nivel: 1, estrellas: {}, mejor: {}, puntos: 0 }) : x; R = v1(R); L = v1(L); const rec = (L.t || 0) >= (R.t || 0) ? L : R;
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
#juegosApp .mm-tit small{display:block;font-size:10.5px;letter-spacing:.04em;color:var(--jg);margin-top:2px}
#juegosApp .mm-hud b i{font-style:normal;font-size:12px;color:var(--gris);font-weight:600}
#juegosApp .mm-hud .poco b{color:#e5484d}#juegosApp .mm-hud .poco{border-color:rgba(229,72,77,.5)}
#juegosApp .mm-mbarra i{background:#7fd8ff}
#juegosApp .mm-trampa{background:linear-gradient(160deg,#4a1416,#1c0708);border:2px solid #e5484d;display:flex;flex-direction:column;align-items:center;justify-content:center}
#juegosApp .mm-trampa svg{width:62%;height:62%}#juegosApp .mm-trampa b{color:#ff8a8d;font-size:clamp(8px,2.3vw,11px);font-family:var(--font-ui);font-weight:800}
#juegosApp .mm-combo b.mal{color:#ff8a8d}
#juegosApp .mm-tablero.tiembla{animation:mmtiembla .5s}
@keyframes mmtiembla{20%{transform:translate(-5px,2px) rotate(-1deg)}40%{transform:translate(5px,-2px) rotate(1deg)}60%{transform:translate(-3px,1px)}80%{transform:translate(3px,0)}}
#juegosApp .mm-mundo-cab{width:100%;background:none;border:0;padding:0;text-align:left;cursor:pointer;font-family:var(--font-ui);color:inherit}
#juegosApp .mm-mundo-cab em{margin-left:auto;font-style:normal;font-size:11.5px;font-weight:800;color:var(--jg);white-space:nowrap}
#juegosApp .mm-mundo:not(.on) .mm-mundo-cab{margin-bottom:0}
#juegosApp .mm-mundo.on{border-color:rgba(201,168,76,.35)}
#juegosApp .mm-nvs{grid-template-columns:repeat(5,1fr)!important}
#juegosApp .jg-rank{--k:#e9b949;background:linear-gradient(135deg,rgba(233,185,73,.18),rgba(20,20,20,1) 60%)}
#juegosApp .rk-tabs{display:flex;gap:.3rem;overflow-x:auto;scrollbar-width:none;margin-bottom:.9rem}
#juegosApp .rk-tabs button{flex:none;border:1px solid rgba(255,255,255,.12);background:var(--negro2,#141414);color:var(--texto,#ddd);border-radius:20px;padding:.5rem .9rem;font-family:var(--font-ui);font-weight:700;font-size:13px;cursor:pointer}
#juegosApp .rk-tabs button.on{background:var(--jg);border-color:var(--jg);color:#16120a}
#juegosApp .rk-cargando{text-align:center;color:var(--gris);padding:2rem 0}
#juegosApp .rk-yo{display:flex;align-items:center;gap:.8rem;background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.04));border:1px solid rgba(201,168,76,.45);border-radius:16px;padding:.9rem 1rem;margin-bottom:.8rem}
#juegosApp .rk-yo > div{flex:1;min-width:0}#juegosApp .rk-yo small{display:block;font-size:11.5px;color:var(--gris)}
#juegosApp .rk-yo b{display:block;color:var(--blanco,#fff);font-size:18px;margin:.1rem 0}#juegosApp .rk-yo span{font-size:12.5px;color:var(--jg)}
#juegosApp .rk-yo em{font-style:normal;font-size:26px;font-weight:900;color:var(--jg)}
#juegosApp .rk-lista{list-style:none;margin:0 0 1rem;padding:0;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden}
#juegosApp .rk-lista li{display:flex;align-items:center;gap:.65rem;padding:.65rem .85rem;border-top:1px solid rgba(255,255,255,.06)}
#juegosApp .rk-lista li:first-child{border-top:0}
#juegosApp .rk-lista li.yo{background:rgba(201,168,76,.12)}
#juegosApp .rk-pos{width:26px;text-align:center;font-weight:800;color:var(--gris);font-size:14px;flex:none}
#juegosApp .rk-lista li.top .rk-pos{font-size:20px}
#juegosApp .rk-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(201,168,76,.18);color:var(--jg);font-weight:800;flex:none}
#juegosApp .rk-lista li > div{flex:1;min-width:0}
#juegosApp .rk-lista b{display:block;color:var(--blanco,#fff);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#juegosApp .rk-lista small{font-size:11.5px;color:var(--gris)}
#juegosApp .rk-lista strong{color:var(--jg);font-size:14px;white-space:nowrap}
#juegosApp .rk-vacio{text-align:center;background:var(--negro2,#141414);border-radius:16px;padding:1.4rem 1rem;margin-bottom:1rem}
#juegosApp .rk-vacio b{display:block;color:var(--blanco,#fff);font-size:15px}#juegosApp .rk-vacio p{color:var(--gris);font-size:13px;margin:.4rem 0 .9rem}
#juegosApp .rk-switch{display:flex;align-items:center;gap:.8rem;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.85rem 1rem;cursor:pointer}
#juegosApp .rk-switch input{position:absolute;opacity:0;pointer-events:none}
#juegosApp .rk-sw{flex:none;width:46px;height:28px;border-radius:20px;background:#333;position:relative;transition:background .2s}
#juegosApp .rk-sw::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:transform .2s}
#juegosApp .rk-switch input:checked + .rk-sw{background:#3fb37f}#juegosApp .rk-switch input:checked + .rk-sw::after{transform:translateX(18px)}
#juegosApp .rk-switch input:focus-visible + .rk-sw{outline:2px solid var(--jg);outline-offset:2px}
#juegosApp .rk-switch b{display:block;color:var(--blanco,#fff);font-size:14px}#juegosApp .rk-switch small{display:block;font-size:12px;color:var(--gris);line-height:1.35;margin-top:.15rem}
@media (min-width:700px){#juegosApp .mm-alb{grid-template-columns:repeat(6,1fr)}}
@media (prefers-reduced-motion:reduce){#juegosApp .mm-in{transition:none}#juegosApp *{animation:none!important}}
`;
document.head.appendChild(css);
})();
