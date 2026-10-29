/* ============================================================
   AETERION · EDUCACIÓN (app) — pantalla nativa de la app.
   Toma los 21 temas que ya viven en la página (secciones #salud,
   #salud-extra, #guias-educacion y #protocolos-avanzados) y los muestra
   como una biblioteca: buscador, categorías, lista compacta y un lector
   de un tema a la vez con índice de secciones. No mueve ni cambia el
   contenido de la página: lo copia al abrir cada tema.
   Avance (leídos y último tema) en localStorage «aet_edu».
============================================================ */
(function () {
'use strict';
const KEY = 'aet_edu';
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sinAcentos = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const hoy = () => (window.AET ? AET.hoy() : new Date().toISOString().slice(0, 10));

/* Categorías y temas (el texto sale de la página; aquí solo el orden, la categoría y el ícono) */
const CATS = [
  { k: 'nutricion', n: 'Alimentación', i: '🥗', c: '#3fb37f', temas: [['salud-aceites', '🫒'], ['salud-ultraprocesados', '🌭'], ['salud-edulcorantes', '🍬'], ['salud-microbioma', '🦠'], ['salud-ayuno', '⏳'], ['salud-diabetes-alertas', '🩸'], ['salud-utensilios', '🍳'], ['salud-toxicos', '🧴']] },
  { k: 'habitos', n: 'Sueño, energía y hábitos', i: '🌙', c: '#8e7bff', temas: [['salud-sueno', '😴'], ['edu-energia', '⚡'], ['edu-habitos', '🔁'], ['salud-sedentarismo', '🪑']] },
  { k: 'entreno', n: 'Entrenamiento y suplementos', i: '💪', c: '#4aa8ff', temas: [['edu-planes', '📋'], ['edu-suplementos', '💊']] },
  { k: 'protocolos', n: 'Protocolos avanzados', i: '🧬', c: '#c9a84c', temas: [['prot-intestinal', '🫃'], ['prot-testosterona', '🏋️'], ['prot-ereccion', '❤️'], ['prot-rejuvenecimiento', '🫀'], ['prot-longevidad', '⏱️'], ['prot-celulas', '🧫'], ['prot-belleza', '✨']] },
];
let TEMAS = null;
function indexar() {
  if (TEMAS) return TEMAS;
  TEMAS = [];
  CATS.forEach((cat) => cat.temas.forEach(([id, ico]) => {
    const cont = document.getElementById(id); if (!cont) return;
    const head = cont.previousElementSibling; const h3 = head && head.querySelector('h3'); const p = head && head.querySelector('h3 + p, p');
    const texto = cont.textContent.replace(/\s+/g, ' ').trim();
    const secciones = [...cont.querySelectorAll('h4')].map((h) => h.textContent.trim());
    TEMAS.push({ id, ico, cat: cat.k, t: h3 ? h3.textContent.trim() : id, s: p ? p.textContent.trim() : '', min: Math.max(2, Math.round(texto.split(' ').length / 180)), secciones, buscar: sinAcentos((h3 ? h3.textContent : '') + ' ' + (p ? p.textContent : '') + ' ' + texto) });
  }));
  return TEMAS;
}
function leer() { try { return Object.assign({ leidos: {}, ultimo: null }, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return { leidos: {}, ultimo: null }; } }
function guardar(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

let V = { v: 'inicio', cat: 'todo', q: '' };
const raiz = () => $('eduApp');

/* ---------------- Inicio de Educación ---------------- */
function filaTema(t, d) {
  const cat = CATS.find((c) => c.k === t.cat);
  return `<button class="ed-fila" data-ed="tema" data-id="${t.id}"><span class="ed-ico" style="--k:${cat.c}">${t.ico}</span><span class="ed-fila-t"><b>${esc(t.t)}</b><small>${esc(t.s)}</small></span><span class="ed-min">${d.leidos[t.id] ? '<i class="ed-ok">✓</i>' : ''}${t.min} min</span></button>`;
}
function inicio() {
  const T = indexar(), d = leer(), q = sinAcentos(V.q.trim());
  const leidos = T.filter((t) => d.leidos[t.id]).length;
  let h = `<div class="ed-cab"><div><h2 class="app-titulo">Educación</h2><p class="app-subtitulo">${T.length} temas con evidencia · ${leidos} leídos</p></div></div>
    <div class="ed-buscar"><span>⌕</span><input id="edBuscar" type="search" placeholder="Buscar: sueño, creatina, ayuno…" value="${esc(V.q)}" autocomplete="off" aria-label="Buscar en Educación"></div>`;
  if (q) {
    const r = T.filter((t) => q.split(/\s+/).every((w) => t.buscar.includes(w)));
    h += `<p class="ed-res">${r.length ? `${r.length} ${r.length === 1 ? 'resultado' : 'resultados'}` : 'Sin resultados. Prueba con otra palabra.'}</p><div class="ed-lista">${r.map((t) => filaTema(t, d)).join('')}</div>`;
    return h;
  }
  const ult = d.ultimo && T.find((t) => t.id === d.ultimo);
  h += `<div class="ed-accesos">
      ${ult ? `<button class="ed-seguir" data-ed="tema" data-id="${ult.id}"><small>${d.leidos[ult.id] ? 'Último que leíste' : 'Continuar leyendo'}</small><b>${ult.ico} ${esc(ult.t)}</b></button>` : ''}
      <button class="ed-recetas" onclick="abrirCalculadora('recetas')"><span>🍲</span><b>Recetas</b><small>41 recetas con pasos</small></button>
      <button class="ed-recetas ed-juegos" onclick="aetIr('juegos')"><span>⚡</span><b>Pon a prueba lo aprendido</b><small>Trivia y Memorama</small></button></div>`;
  h += `<div class="ed-chips" role="tablist">${[['todo', 'Todo', '📚']].concat(CATS.map((c) => [c.k, c.n, c.i])).map(([k, n, i]) => `<button class="${V.cat === k ? 'on' : ''}" data-ed="cat" data-k="${k}">${i} ${esc(n)}</button>`).join('')}</div>`;
  CATS.filter((c) => V.cat === 'todo' || V.cat === c.k).forEach((c) => {
    const ts = T.filter((t) => t.cat === c.k); const l = ts.filter((t) => d.leidos[t.id]).length;
    h += `<section class="ed-grupo"><div class="ed-grupo-cab"><b>${c.i} ${esc(c.n)}</b><span>${l}/${ts.length}</span></div><div class="ed-lista">${ts.map((t) => filaTema(t, d)).join('')}</div></section>`;
  });
  return h;
}

/* ---------------- Lector de un tema ---------------- */
function articulo(id) {
  const T = indexar(); const i = T.findIndex((t) => t.id === id); const t = T[i]; if (!t) return inicio();
  const cat = CATS.find((c) => c.k === t.cat); const d = leer();
  const cont = document.getElementById(id).cloneNode(true);
  cont.removeAttribute('id'); cont.classList.remove('abierto');
  cont.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
  cont.querySelectorAll('[style]').forEach((e) => e.removeAttribute('style'));
  cont.querySelectorAll('h4').forEach((h4, k) => { h4.id = 'ed-s' + k; });
  const sig = T[i + 1], ant = T[i - 1];
  return `<div class="ed-art" style="--k:${cat.c}">
    <div class="ed-art-top"><button class="ed-volver" data-ed="inicio" aria-label="Volver a Educación">‹ Educación</button><span>${i + 1} de ${T.length}</span></div>
    <div class="ed-art-cab"><span class="ed-art-cat">${cat.i} ${esc(cat.n)}</span><h2>${esc(t.t)}</h2><p>${esc(t.s)}</p><small>${t.min} min de lectura${t.secciones.length ? ` · ${t.secciones.length} secciones` : ''}${d.leidos[id] ? ' · leído ✓' : ''}</small></div>
    ${t.secciones.length > 1 ? `<nav class="ed-indice" aria-label="Secciones">${t.secciones.map((s, k) => `<button data-ed="ir" data-s="${k}">${esc(s.replace(/\s+[—–-]\s+.*$/, ''))}</button>`).join('')}</nav>` : ''}
    <div class="ed-cuerpo">${cont.innerHTML}</div>
    <div class="ed-fin" id="edFin"><b>${d.leidos[id] ? 'Ya leíste este tema' : '¡Terminaste este tema!'}</b>
      <div class="ed-nav">${ant ? `<button data-ed="tema" data-id="${ant.id}"><small>Anterior</small><span>${ant.ico} ${esc(ant.t)}</span></button>` : '<span></span>'}${sig ? `<button class="sig" data-ed="tema" data-id="${sig.id}"><small>Siguiente</small><span>${sig.ico} ${esc(sig.t)}</span></button>` : ''}</div>
      <button class="ed-volver-b" data-ed="inicio">Ver todos los temas</button></div></div>`;
}

/* ---------------- Pintar y eventos ---------------- */
let abiertoEn = 0;
function revisarLeido() {
  if (V.v !== 'tema' || !abiertoEn || Date.now() - abiertoEn < 4000) return;
  const fin = $('edFin'); if (!fin || fin.getBoundingClientRect().top > window.innerHeight - 40) return;
  const x = leer(); if (!x.leidos[V.id]) { x.leidos[V.id] = hoy(); guardar(x); } abiertoEn = 0;
}
window.addEventListener('scroll', revisarLeido, { passive: true });
function pintar(arriba) {
  const r = raiz(); if (!r) return;
  r.innerHTML = V.v === 'tema' ? articulo(V.id) : inicio();
  if (arriba) window.scrollTo({ top: 0, behavior: 'instant' });
  abiertoEn = 0;
  if (V.v === 'tema') {
    const d = leer(); d.ultimo = V.id; guardar(d); abiertoEn = Date.now(); setTimeout(revisarLeido, 4100);
    try { if (typeof aetEvento === 'function') aetEvento('edu_' + V.id); } catch (e) {}
  }
}
function abrirTema(id) { V = Object.assign({}, V, { v: 'tema', id }); pintar(true); }
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-ed]'); if (!el || !raiz() || !raiz().contains(el)) return;
  const a = el.dataset.ed;
  if (a === 'tema') return abrirTema(el.dataset.id);
  if (a === 'inicio') { V.v = 'inicio'; return pintar(true); }
  if (a === 'cat') { V.cat = el.dataset.k; pintar(false); const on = raiz().querySelector('.ed-chips .on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); return; }
  if (a === 'ir') { const s = $('ed-s' + el.dataset.s); if (s) { const y = s.getBoundingClientRect().top + window.scrollY - 70; window.scrollTo({ top: y, behavior: 'smooth' }); } }
});
let tBusca = 0;
document.addEventListener('input', (e) => {
  if (!e.target || e.target.id !== 'edBuscar') return;
  clearTimeout(tBusca); const v = e.target.value;
  tBusca = setTimeout(() => { V.q = v; const pos = e.target.selectionStart; pintar(false); const n = $('edBuscar'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }, 160);
});

/* ---------------- API para la app ---------------- */
window.eduRender = function () { if (V.v !== 'tema') V.v = 'inicio'; pintar(false); };
window.eduAbrir = function (id) { if (typeof aetIr === 'function') aetIr('educacion'); abrirTema(id); };
window.eduSub = function () { return V.v === 'tema'; };
window.eduVolver = function () { if (V.v === 'tema') { V.v = 'inicio'; pintar(true); return true; } return false; };

/* ---------------- Estilos ---------------- */
const css = document.createElement('style');
css.textContent = `
#eduApp{font-family:var(--font-ui);padding-bottom:1.2rem}
#eduApp .ed-cab .app-subtitulo{margin-bottom:.9rem}
#eduApp .ed-buscar{display:flex;align-items:center;gap:.5rem;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:0 .9rem;margin-bottom:1rem}
#eduApp .ed-buscar span{color:var(--gris);font-size:20px;line-height:1}
#eduApp .ed-buscar input{flex:1;background:none;border:0;color:var(--blanco,#fff);font:inherit;font-size:16px;padding:.8rem 0;outline:none;min-width:0}
#eduApp .ed-buscar:focus-within{border-color:rgba(201,168,76,.6)}
#eduApp .ed-res{font-size:12.5px;color:var(--gris);margin:-.3rem 0 .6rem}
#eduApp .ed-accesos{display:grid;grid-template-columns:1fr 1fr;gap:.55rem;margin-bottom:1rem}
#eduApp .ed-seguir{grid-column:1/-1;text-align:left;background:linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.05));border:1px solid rgba(201,168,76,.45);border-radius:14px;padding:.8rem .95rem;color:var(--blanco,#fff);font-family:var(--font-ui);cursor:pointer}
#eduApp .ed-seguir small{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--oro,#c9a84c);font-weight:700}
#eduApp .ed-seguir b{display:block;font-size:15px;margin-top:.15rem}
#eduApp .ed-recetas{text-align:left;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:.75rem .85rem;color:var(--texto,#ddd);font-family:var(--font-ui);cursor:pointer;display:flex;flex-direction:column;gap:.1rem}
#eduApp .ed-recetas span{font-size:22px}
#eduApp .ed-recetas b{color:var(--blanco,#fff);font-size:13.5px}
#eduApp .ed-recetas small{font-size:11.5px;color:var(--gris)}
#eduApp .ed-chips{display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none;margin:0 -1px .9rem;padding-bottom:2px}
#eduApp .ed-chips::-webkit-scrollbar{display:none}
#eduApp .ed-chips button{flex:none;border:1px solid rgba(255,255,255,.12);background:var(--negro2,#141414);color:var(--texto,#ddd);border-radius:20px;padding:.48rem .85rem;font-family:var(--font-ui);font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap}
#eduApp .ed-chips button.on{background:var(--oro,#c9a84c);border-color:var(--oro,#c9a84c);color:#16120a}
#eduApp .ed-grupo{margin-bottom:1rem}
#eduApp .ed-grupo-cab{display:flex;justify-content:space-between;align-items:baseline;margin:0 .1rem .45rem}
#eduApp .ed-grupo-cab b{color:var(--blanco,#fff);font-size:14px}
#eduApp .ed-grupo-cab span{font-size:12px;color:var(--gris)}
#eduApp .ed-lista{background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden}
#eduApp .ed-fila{display:flex;align-items:center;gap:.75rem;width:100%;background:none;border:0;border-top:1px solid rgba(255,255,255,.06);padding:.7rem .85rem;text-align:left;color:inherit;font-family:var(--font-ui);cursor:pointer}
#eduApp .ed-fila:first-child{border-top:0}
#eduApp .ed-fila:active{background:rgba(255,255,255,.04)}
#eduApp .ed-ico{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:20px;background:color-mix(in srgb,var(--k) 16%,transparent)}
#eduApp .ed-fila-t{flex:1;min-width:0}
#eduApp .ed-fila-t b{display:block;color:var(--blanco,#fff);font-size:14px;line-height:1.3}
#eduApp .ed-fila-t small{display:block;font-size:12px;color:var(--gris);line-height:1.35;margin-top:.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#eduApp .ed-min{flex:none;font-size:11.5px;color:var(--gris);display:flex;align-items:center;gap:.35rem}
#eduApp .ed-ok{font-style:normal;color:#3fb37f;font-weight:800}
/* Lector */
#eduApp .ed-art-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem}
#eduApp .ed-volver{background:none;border:0;color:var(--oro,#c9a84c);font-family:var(--font-ui);font-weight:600;font-size:14px;padding:.3rem 0;cursor:pointer}
#eduApp .ed-art-top span{font-size:12px;color:var(--gris)}
#eduApp .ed-art-cab{border-left:3px solid var(--k);padding:.1rem 0 .1rem .85rem;margin-bottom:1rem}
#eduApp .ed-art-cat{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--k);font-weight:700}
#eduApp .ed-art-cab h2{font-family:var(--font-display,inherit);color:var(--blanco,#fff);font-size:1.6rem;line-height:1.15;margin:.25rem 0 .35rem;font-weight:500}
#eduApp .ed-art-cab p{color:var(--texto,#ddd);font-size:14px;line-height:1.45;margin:0}
#eduApp .ed-art-cab small{display:block;font-size:12px;color:var(--gris);margin-top:.4rem}
#eduApp .ed-indice{position:sticky;top:0;z-index:5;display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none;background:var(--negro,#0a0a0a);padding:.55rem 0;margin:0 0 .6rem;border-bottom:1px solid rgba(255,255,255,.06)}
#eduApp .ed-indice::-webkit-scrollbar{display:none}
#eduApp .ed-indice button{flex:none;max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid rgba(255,255,255,.14);background:var(--negro2,#141414);color:var(--texto,#ddd);border-radius:20px;padding:.38rem .75rem;font-family:var(--font-ui);font-size:12.5px;cursor:pointer}
#eduApp .ed-cuerpo{font-size:14.5px;line-height:1.6;color:var(--texto,#ddd)}
#eduApp .ed-cuerpo .edu-grid{display:block!important;margin:0!important;gap:0!important}
#eduApp .ed-cuerpo .edu-col{display:block}
#eduApp .ed-cuerpo h4{scroll-margin-top:70px;font-family:var(--font-ui)!important;font-size:16px!important;letter-spacing:0!important;text-transform:none!important;color:var(--blanco,#fff)!important;margin:1.4rem 0 .6rem!important;padding:0 0 .35rem!important;border-bottom:2px solid var(--k)!important;display:block;font-weight:700!important}
#eduApp .ed-cuerpo .edu-intro-box{background:rgba(255,255,255,.04)!important;border:0!important;border-left:3px solid var(--k)!important;border-radius:0 12px 12px 0!important;padding:.8rem .9rem!important;margin:0 0 .4rem!important}
#eduApp .ed-cuerpo .edu-intro-box p{font-size:14px!important;line-height:1.55!important;color:var(--texto,#ddd)!important;margin:0!important}
#eduApp .ed-cuerpo .edu-tip,#eduApp .ed-cuerpo .edu-causa,#eduApp .ed-cuerpo .check-item{display:flex!important;gap:.7rem!important;align-items:flex-start!important;background:none!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.06)!important;border-radius:0!important;padding:.75rem 0!important;margin:0!important}
#eduApp .ed-cuerpo .edu-tip-icono{flex:none;font-size:20px!important;line-height:1.2;width:28px;text-align:center}
#eduApp .ed-cuerpo .edu-causa-num,#eduApp .ed-cuerpo .check-icon{flex:none;width:26px!important;height:26px!important;min-width:26px;border-radius:8px!important;display:grid!important;place-items:center;font-size:12px!important;font-weight:800;background:color-mix(in srgb,var(--k) 18%,transparent)!important;color:var(--k)!important;border:0!important;margin:0!important}
#eduApp .ed-cuerpo strong{display:block;color:var(--blanco,#fff)!important;font-size:14.5px!important;font-family:var(--font-ui)!important;margin-bottom:.15rem!important;line-height:1.35}
#eduApp .ed-cuerpo p{font-size:14px!important;line-height:1.6!important;color:var(--texto,#ddd)!important;margin:0!important}
#eduApp .ed-cuerpo .check-lista{display:block!important;margin:0!important;padding:0!important}
#eduApp .ed-cuerpo .edu-aviso{background:rgba(201,168,76,.08)!important;border:1px solid rgba(201,168,76,.3)!important;border-radius:12px!important;padding:.75rem .85rem!important;margin:.9rem 0!important;font-size:13px!important;line-height:1.5!important;color:var(--texto,#ddd)!important}
#eduApp .ed-cuerpo ul,#eduApp .ed-cuerpo ol{padding-left:1.15rem;margin:.4rem 0}
#eduApp .ed-cuerpo li{margin:.3rem 0}
#eduApp .ed-cuerpo .btn,#eduApp .ed-cuerpo button{display:none}
#eduApp .ed-fin{margin-top:1.6rem;background:var(--negro2,#141414);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:1rem;text-align:center}
#eduApp .ed-fin > b{display:block;color:var(--blanco,#fff);font-size:15px;margin-bottom:.8rem}
#eduApp .ed-nav{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.7rem}
#eduApp .ed-nav button{text-align:left;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.6rem .7rem;color:var(--texto,#ddd);font-family:var(--font-ui);cursor:pointer;min-width:0}
#eduApp .ed-nav button.sig{text-align:right;border-color:rgba(201,168,76,.45)}
#eduApp .ed-nav small{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--gris)}
#eduApp .ed-nav span{display:block;font-size:13px;color:var(--blanco,#fff);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:.1rem}
#eduApp .ed-volver-b{background:none;border:0;color:var(--oro,#c9a84c);font-family:var(--font-ui);font-weight:700;font-size:14px;cursor:pointer;padding:.4rem}
`;
document.head.appendChild(css);
})();
