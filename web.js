/* ============================================================
   AETERION · SITIO WEB POR SECCIONES
   La página dejó de ser un solo scroll de 14 secciones: ahora cada
   sección del menú muestra solo lo suyo (con pestañas internas), como
   en la app. No borra ni mueve contenido: solo oculta lo que no toca.
   Solo actúa en la página web (no en la app: body.modo-app).
   Rutas: #/inicio · #/productos[/laboratorio|/proximamente] ·
   #/programas[/guias|/recetas] · #/educacion[/<tema>] · #/nosotros[/comunidad|/contacto]
   Los enlaces viejos (#productos, #salud, #contacto…) siguen funcionando.
============================================================ */
(function () {
'use strict';
const $ = (id) => document.getElementById(id);
const PAGINAS = [
  { k: 'inicio', n: 'Inicio', secs: [['hero', ''], ['webInicio', '']] },
  { k: 'productos', n: 'Productos', subs: [['productos', 'Productos'], ['laboratorio', 'Análisis de laboratorio'], ['proximamente', 'Próximamente']] },
  { k: 'programas', n: 'Programas', subs: [['sistema', 'El sistema'], ['guias', 'Programas'], ['recetas', 'Recetas']] },
  { k: 'educacion', n: 'Educación', secs: [['webEduSec', '']] },
  { k: 'nosotros', n: 'Nosotros', subs: [['filosofia', 'Filosofía'], ['comunidad', 'Comunidad'], ['contacto', 'Contacto']] },
];
const EDU_VIEJAS = ['salud', 'salud-extra', 'guias-educacion', 'protocolos-avanzados'];
const web = () => !document.body.classList.contains('modo-app');
let listo = false, actual = null;

function montar() {
  if (listo || !web()) return; listo = true;
  document.body.classList.add('web-secciones');
  const hero = $('hero');
  // Tarjetas de inicio
  const ini = document.createElement('section'); ini.id = 'webInicio';
  ini.innerHTML = `<div class="contenedor"><div class="wb-ini-cab"><span>Explora Aeterion</span><h2>Todo en su lugar.</h2></div><div class="wb-grid">
    <a class="wb-card" href="#/productos"><img src="img/juegos/creatina.jpg" alt="" loading="lazy"><div><b>Productos</b><p>Creatina, magnesio y vitamina D3 con análisis de laboratorio.</p><em>Ver productos →</em></div></a>
    <a class="wb-card" href="#/educacion"><span class="wb-ico">📚</span><div><b>Educación</b><p>21 temas con evidencia: sueño, alimentación, suplementos, protocolos.</p><em>Empezar a leer →</em></div></a>
    <a class="wb-card" href="#/programas/guias"><span class="wb-ico">💪</span><div><b>Programas</b><p>Gimnasio, MMA y dietas resueltas semana a semana.</p><em>Ver programas →</em></div></a>
    <a class="wb-card" href="#/programas/recetas"><span class="wb-ico">🍲</span><div><b>Recetas</b><p>41 recetas con información nutricional.</p><em>Ver recetas →</em></div></a>
    <a class="wb-card" href="#/productos/laboratorio"><span class="wb-ico">🔬</span><div><b>Laboratorio</b><p>Análisis independientes de lo que contiene cada producto.</p><em>Ver análisis →</em></div></a>
    <a class="wb-card" href="#/nosotros"><span class="wb-ico">✦</span><div><b>Nosotros</b><p>Por qué existe Aeterion, la comunidad en Discord y contacto.</p><em>Conocernos →</em></div></a>
    <a class="wb-card wb-app" href="./?modo=app"><span class="wb-ico">📱</span><div><b>La app Aeterion</b><p>Tu entreno, tu comida, tus hábitos, juegos y progreso en un solo lugar.</p><em>Abrir la app →</em></div></a>
  </div></div>`;
  if (hero && hero.parentNode) hero.parentNode.insertBefore(ini, hero.nextSibling);
  // Biblioteca de educación (la misma de la app)
  const edu = document.createElement('section'); edu.id = 'webEduSec';
  edu.innerHTML = '<div class="contenedor wb-edu"><div id="webEdu" class="ed-raiz"></div></div>';
  const ancla = $('salud') || $('guias-educacion');
  if (ancla && ancla.parentNode) ancla.parentNode.insertBefore(edu, ancla);
  // Barra de sección (título + pestañas)
  const cab = document.createElement('div'); cab.id = 'webCab';
  const nav = $('nav'); if (nav && nav.parentNode) nav.parentNode.insertBefore(cab, nav.nextSibling);
  // Menú: 5 secciones
  const enlaces = PAGINAS.map((p) => `<li><a href="#/${p.k}" data-wp="${p.k}">${p.n}</a></li>`).join('') + '<li><a href="./?modo=app" class="wb-nav-app">Abrir app</a></li>';
  const ul = document.querySelector('#nav .nav-links'); if (ul) ul.innerHTML = enlaces;
  const nm = $('navMobile');
  if (nm) { nm.querySelectorAll('a:not(.nav-cta-m)').forEach((a) => a.remove()); nm.insertAdjacentHTML('beforeend', PAGINAS.map((p) => `<a href="#/${p.k}" data-wp="${p.k}" onclick="toggleNavMobile()">${p.n}</a>`).join('') + '<a href="./?modo=app" onclick="toggleNavMobile()">Abrir app</a>'); }
  const logo = document.querySelector('#nav .nav-logo'); if (logo) { logo.style.cursor = 'pointer'; logo.addEventListener('click', () => { location.hash = '#/inicio'; }); }
  try { cabeceraPro(); portadaPro(); } catch (e) { console.warn('web pro', e); }
  window.addEventListener('hashchange', rutear);
  rutear();
}

/* ---------- Diseño de tienda profesional (cabecera, portada, confianza, productos) ---------- */
const I = (d, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  envio: '<path d="M3 6h11v10H3zM14 9.5h4l3 3.5v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  pago: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.5h18M7 15h4"/>',
  lab: '<path d="M9 3h6M10 3v6L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9V3"/><path d="M7.2 15h9.6"/>',
  ciencia: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/><path d="M9 8h7M9 11.5h5"/>',
  atencion: '<path d="M4 5h16v11H9.5L5 20v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  cuenta: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c1.4-3.8 4.2-5.6 7.5-5.6s6.1 1.8 7.5 5.6"/>',
  bolsa: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  pesa: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  receta: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8.5 7.5c0-1.2 1-1.3 1-2.5M12 7.5c0-1.2 1-1.3 1-2.5M15.5 7.5c0-1.2 1-1.3 1-2.5"/>',
  libro: '<path d="M12 6.5C10 5 7 4.5 3 5v13.5c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5V20"/>',
  app: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M10.5 18h3"/>',
  gente: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.9-3.4 3.5-5 6.5-5s5.6 1.6 6.5 5"/><path d="M15.5 4.8a3.4 3.4 0 0 1 0 6.4M17.5 15.2c2 .6 3.3 2.2 4 4.8"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const PROD = [
  { id: 'creatina', img: 'img/prod-creatina.jpg', n: 'Creatine Monohydrate', s: '450 g · Micronizada', d: 'Rendimiento físico y cognitivo', tag: 'Más estudiado', p: 'Protocolo 01 — Energía', q: 'creatina creatine monohidrato fuerza energia rendimiento musculo' },
  { id: 'magnesio', img: 'img/prod-magnesio.jpg', n: 'Magnesium Glycinate', s: '100 cápsulas · 450 mg', d: 'Recuperación y sistema nervioso', tag: 'Alta absorción', p: 'Protocolo 02 — Recuperación', q: 'magnesio glicinato magnesium sueno recuperacion estres' },
  { id: 'vitd', img: 'img/prod-vitamina.jpg', n: 'Vitamin D3 Liposomal', s: '50 ml · 5000 UI', d: 'Salud general y longevidad', tag: 'Liposomal', p: 'Protocolo 03 — Bienestar', q: 'vitamina d3 vitamin liposomal huesos inmunidad sol' },
];
const precio = (id) => { try { return (typeof PRODUCTOS !== 'undefined' && PRODUCTOS[id]) ? PRODUCTOS[id].precio : null; } catch (e) { return null; } };
const fmt = (n) => n == null ? '' : '$' + Number(n).toLocaleString('es-MX') + ' MXN';
const sinAc = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cabeceraPro() {
  const nav = $('nav'); if (!nav) return;
  const logo = nav.querySelector('.nav-logo'), ul = nav.querySelector('.nav-links'), ham = nav.querySelector('.hamburger');
  const fila = document.createElement('div'); fila.className = 'wb-h1';
  const anuncio = document.createElement('div'); anuncio.className = 'wb-anuncio';
  anuncio.innerHTML = `<span>${I(IC.envio, 16)} Envío gratis en pedidos desde $1,500</span><span class="wb-an-sep wb-an-2">·</span><span class="wb-an-2">Envíos a todo México</span><span class="wb-an-sep wb-an-2">·</span><span class="wb-an-2">Productos analizados en laboratorio</span>`;
  const buscar = document.createElement('div'); buscar.className = 'wb-buscar';
  buscar.innerHTML = `<span class="wb-b-ico">${I(IC.buscar, 18)}</span><input id="wbBuscar" type="search" placeholder="Buscar productos, temas, recetas…" autocomplete="off" aria-label="Buscar en Aeterion"><div class="wb-b-res" id="wbBuscarRes" hidden></div>`;
  const acc = document.createElement('div'); acc.className = 'wb-acc';
  acc.innerHTML = `<button type="button" class="wb-ibtn wb-ibtn-buscar" aria-label="Buscar">${I(IC.buscar)}</button>
    <button type="button" class="wb-ibtn" id="wbCuenta" aria-label="Mi cuenta">${I(IC.cuenta)}<span>Entrar</span></button>
    <button type="button" class="wb-ibtn" id="wbCarrito" aria-label="Carrito">${I(IC.bolsa)}<span>Carrito</span><i id="wbCarritoN" hidden>0</i></button>`;
  if (ham) fila.appendChild(ham);
  if (logo) fila.appendChild(logo);
  fila.appendChild(buscar); fila.appendChild(acc);
  const fila2 = document.createElement('div'); fila2.className = 'wb-h2';
  if (ul) fila2.appendChild(ul);
  nav.insertBefore(anuncio, nav.firstChild); nav.insertBefore(fila, anuncio.nextSibling); nav.insertBefore(fila2, fila.nextSibling);
  nav.classList.add('wb-nav');
  acc.querySelector('#wbCuenta').addEventListener('click', () => { try { abrirCuenta(); } catch (e) {} });
  acc.querySelector('#wbCarrito').addEventListener('click', () => { try { abrirCarrito(); } catch (e) {} });
  acc.querySelector('.wb-ibtn-buscar').addEventListener('click', () => { nav.classList.toggle('wb-buscando'); if (nav.classList.contains('wb-buscando')) $('wbBuscar').focus(); medir(); });
  // contador del carrito (copia el del botón flotante)
  const badge = $('carrito-badge'), n = $('wbCarritoN');
  const copiar = () => { const t = parseInt(badge.textContent, 10) || 0; n.textContent = t; n.hidden = !t; };
  if (badge) { copiar(); new MutationObserver(copiar).observe(badge, { childList: true, characterData: true, subtree: true, attributes: true }); }
  // buscador
  const inp = $('wbBuscar'), res = $('wbBuscarRes');
  inp.addEventListener('input', () => pintarBusqueda(inp.value));
  inp.addEventListener('focus', () => { if (inp.value) pintarBusqueda(inp.value); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const a = res.querySelector('a'); if (a) { e.preventDefault(); a.click(); } }
    if (e.key === 'Escape') { res.hidden = true; inp.blur(); }
  });
  res.addEventListener('click', (e) => { if (e.target.closest('a')) { res.hidden = true; inp.value = ''; nav.classList.remove('wb-buscando'); medir(); } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.wb-buscar')) res.hidden = true; });
  window.addEventListener('resize', medir); medir(); setTimeout(medir, 300);
}
function medir() { const nav = $('nav'); if (nav) document.documentElement.style.setProperty('--wb-nav', nav.offsetHeight + 'px'); }

let INDICE = null;
function indice() {
  if (INDICE) return INDICE;
  INDICE = PROD.map((p) => ({ t: p.n, s: 'Producto · ' + p.s, h: '#/productos', q: sinAc(p.n + ' ' + p.q), img: p.img }));
  document.querySelectorAll('.edu-contenido[id]').forEach((c) => {
    const h3 = c.previousElementSibling && c.previousElementSibling.querySelector('h3'); if (!h3) return;
    INDICE.push({ t: h3.textContent.trim(), s: 'Educación', h: '#/educacion/' + c.id, q: sinAc(h3.textContent + ' ' + c.textContent.slice(0, 1500)) });
  });
  [['Recetas', 'Programas', '#/programas/recetas', 'recetas comida cocina desayuno cena'], ['Programas de entrenamiento', 'Programas', '#/programas/guias', 'programas gimnasio gym mma rutina dieta plan'],
   ['Análisis de laboratorio', 'Productos', '#/productos/laboratorio', 'laboratorio analisis cidi metales pureza calidad'], ['Próximos productos', 'Productos', '#/productos/proximamente', 'proximamente nuevos lanzamientos'],
   ['Comunidad en Discord', 'Nosotros', '#/nosotros/comunidad', 'comunidad discord'], ['Contacto', 'Nosotros', '#/nosotros/contacto', 'contacto correo whatsapp ayuda pedidos envio'],
   ['La app Aeterion', 'App', './?modo=app', 'app aplicacion entreno habitos juegos trivia memorama']].forEach(([t, s, h, q]) => INDICE.push({ t, s, h, q: sinAc(t + ' ' + q) }));
  return INDICE;
}
function pintarBusqueda(v) {
  const res = $('wbBuscarRes'), q = sinAc(v.trim());
  if (!q) { res.hidden = true; return; }
  const pal = q.split(/\s+/);
  const r = indice().map((x) => ({ x, pts: pal.every((w) => x.q.includes(w)) ? (sinAc(x.t).includes(q) ? 2 : 1) : 0 })).filter((o) => o.pts).sort((a, b) => b.pts - a.pts).slice(0, 7).map((o) => o.x);
  res.innerHTML = r.length ? r.map((x) => `<a href="${x.h}">${x.img ? `<img src="${x.img}" alt="">` : `<span class="wb-r-ico">${I(x.s === 'Educación' ? IC.libro : IC.flecha, 16)}</span>`}<span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span></a>`).join('')
    : `<p class="wb-r-nada">Sin resultados para «${esc(v.trim())}».</p>`;
  res.hidden = false;
}

function portadaPro() {
  const hero = $('hero'), cont = hero && hero.querySelector('.hero-contenido');
  if (cont && !cont.querySelector('.wb-hero-img')) {
    const txt = document.createElement('div'); txt.className = 'wb-hero-txt';
    [...cont.children].forEach((c) => { if (c.id !== 'btnInstalarApp') txt.appendChild(c); });
    cont.appendChild(txt);
    const btns = txt.querySelector('.hero-btns');
    if (btns) btns.innerHTML = `<a href="#/productos" class="btn">Comprar productos</a><a href="./?modo=app" class="btn btn-outline">Explorar la app</a>`;
    txt.insertAdjacentHTML('beforeend', `<ul class="wb-hero-pts"><li>${I(IC.lab, 18)} Analizados por CiDi</li><li>${I(IC.envio, 18)} Envío a todo México</li><li>${I(IC.pago, 18)} Pago seguro con Stripe</li></ul>`);
    cont.insertAdjacentHTML('beforeend', `<a class="wb-hero-img" href="#/productos" aria-label="Ver productos"><img src="img/hero-productos.jpg" alt="Creatina, magnesio y vitamina D3 Aeterion" width="1200" height="914"></a>`);
    cont.classList.add('wb-hero-grid');
  }
  const ini = $('webInicio'); if (!ini) return;
  const confianza = [
    [IC.envio, 'Envío gratis', 'En pedidos desde $1,500 a todo México'],
    [IC.pago, 'Pago seguro', 'Tarjeta procesada por Stripe'],
    [IC.lab, 'Laboratorio independiente', 'Analizados por CiDi (NOM, FEUM, USP43)'],
    [IC.ciencia, 'Basado en evidencia', 'Solo ingredientes con respaldo científico'],
    [IC.atencion, 'Atención directa', 'pedidos@aeterionlabs.tech'],
  ];
  const cont2 = ini.querySelector('.contenedor');
  const explora = cont2.innerHTML;
  cont2.innerHTML = `
    <div class="wb-confianza">${confianza.map(([i, t, s]) => `<div><span>${I(i, 26)}</span><p><b>${t}</b><small>${s}</small></p></div>`).join('')}</div>
    <div class="wb-tit"><div><span>Tienda</span><h2>Nuestros productos</h2></div><a href="#/productos">Ver todo ${I(IC.flecha, 16)}</a></div>
    <div class="wb-prods">${PROD.map((p) => `<article class="wb-prod">
      <a class="wb-prod-img" href="#/productos"><img src="${p.img}" alt="Aeterion ${p.n}" loading="lazy" width="600" height="600"><em>${p.tag}</em></a>
      <div class="wb-prod-info"><small>${p.p}</small><h3>${p.n}</h3><p>${p.d} · ${p.s}</p>
      <div class="wb-prod-pie"><b class="wb-precio" data-id="${p.id}">${fmt(precio(p.id))}</b><a href="#/productos">Detalles</a></div>
      <button class="btn-agregar" onclick="agregarAlCarrito('${p.id}')">Agregar al carrito</button></div></article>`).join('')}</div>
    <div class="wb-app-banda"><div><span>App Aeterion</span><h2>Tu entreno, tu comida y tus hábitos en un solo lugar.</h2><p>Programas de gimnasio y MMA, recetas, educación, juegos y tu progreso diario. Instálala desde el navegador.</p><a href="./?modo=app" class="btn">Abrir la app</a></div><span class="wb-app-ico">${I(IC.app, 64)}</span></div>
    ${explora.replace('Todo en su lugar.', 'Todo lo que encuentras en Aeterion.')}
    <div class="wb-tit"><div><span>Educación</span><h2>Aprende con evidencia</h2></div><a href="#/educacion">Ver los temas ${I(IC.flecha, 16)}</a></div>
    <div class="wb-edu-tea">${['salud-sueno', 'edu-suplementos', 'salud-ayuno'].map((id) => { const c = $(id), h = c && c.previousElementSibling && c.previousElementSibling.querySelector('h3'), pp = c && c.previousElementSibling && c.previousElementSibling.querySelector('h3 + p, p'); return h ? `<a href="#/educacion/${id}">${I(IC.libro, 20)}<b>${esc(h.textContent.trim())}</b><small>${esc(pp ? pp.textContent.trim() : '')}</small><em>Leer ${I(IC.flecha, 14)}</em></a>` : ''; }).join('')}</div>`;
  // iconos de línea en lugar de emojis
  const mapa = { '#/educacion': IC.libro, '#/programas/guias': IC.pesa, '#/programas/recetas': IC.receta, '#/productos/laboratorio': IC.lab, '#/nosotros': IC.gente, './?modo=app': IC.app };
  ini.querySelectorAll('.wb-grid .wb-card').forEach((a) => { const k = a.getAttribute('href'); if (k === '#/productos') { a.remove(); return; } const s = a.querySelector('.wb-ico'); if (s && mapa[k]) s.innerHTML = I(mapa[k], 28); });
  // botón corto en las tarjetas (el precio ya se ve arriba)
  const corto = (b) => { const t = b.textContent; if (/Agregar al carrito —/.test(t)) b.innerHTML = I('<path d="M12 5v14M5 12h14"/>', 15) + ' Agregar al carrito' + (/quedan \d+/.test(t) ? ' · ' + t.match(/quedan \d+/)[0] : ''); };
  ini.querySelectorAll('.wb-prod .btn-agregar').forEach((b) => { corto(b); new MutationObserver(() => corto(b)).observe(b, { childList: true, characterData: true, subtree: true }); });
  // precios en vivo
  const pintar = () => document.querySelectorAll('.wb-precio').forEach((b) => { b.textContent = fmt(precio(b.dataset.id)); });
  if (typeof window.aetPintarCatalogo === 'function') {
    const orig = window.aetPintarCatalogo;
    window.aetPintarCatalogo = function () { const r = orig.apply(this, arguments); try { pintar(); } catch (e) {} return r; };
    try { window.aetPintarCatalogo(); } catch (e) {}
  }
}

// Qué mostrar para un hash
function resolver(h) {
  h = decodeURIComponent((h || '').replace(/^#/, ''));
  if (!h || h === '/' ) return { p: 'inicio' };
  if (h[0] === '/') { const [p, sub] = h.slice(1).split('/'); if (PAGINAS.some((x) => x.k === p)) return { p, sub: sub || null }; return { p: 'inicio' }; }
  // Enlaces viejos: #productos, #salud, #salud-sueno, #contacto…
  if (EDU_VIEJAS.includes(h)) return { p: 'educacion' };
  const el = $(h); if (!el) return { p: 'inicio' };
  if (el.classList.contains('edu-contenido')) return { p: 'educacion', sub: h };
  const sec = el.closest('section[id]') || el;
  if (EDU_VIEJAS.includes(sec.id)) return { p: 'educacion' };
  for (const pg of PAGINAS) {
    if (pg.subs && pg.subs.some(([id]) => id === sec.id)) return { p: pg.k, sub: sec.id, ir: el !== sec ? h : null };
    if (pg.secs && pg.secs.some(([id]) => id === sec.id)) return { p: pg.k, ir: el !== sec ? h : null };
  }
  return { p: 'inicio' };
}
function rutear() {
  if (!web() || !listo) return;
  const r = resolver(location.hash); const pg = PAGINAS.find((x) => x.k === r.p);
  const visibles = new Set();
  let sub = null;
  if (pg.subs) { sub = (pg.subs.find(([id]) => id === r.sub) || pg.subs[0])[0]; visibles.add(sub); }
  else pg.secs.forEach(([id]) => visibles.add(id));
  document.querySelectorAll('body > section[id], body > div > section[id]').forEach((s) => s.classList.toggle('wb-oculta', !visibles.has(s.id)));
  EDU_VIEJAS.forEach((id) => { const s = $(id); if (s) s.classList.add('wb-oculta'); });
  // Barra de la sección
  const cab = $('webCab');
  if (cab) {
    if (pg.k === 'inicio') { cab.innerHTML = ''; cab.classList.remove('on'); }
    else {
      cab.classList.add('on');
      cab.innerHTML = `<div class="wb-cab-in"><a href="#/inicio" class="wb-migas">Inicio</a><span class="wb-sep">›</span><b>${pg.n}</b>${pg.subs ? `<div class="wb-tabs" role="tablist">${pg.subs.map(([id, n]) => `<a href="#/${pg.k}/${id === pg.subs[0][0] ? '' : id}" class="${id === sub ? 'on' : ''}" role="tab" aria-selected="${id === sub}">${n}</a>`).join('')}</div>` : ''}</div>`;
    }
  }
  document.querySelectorAll('[data-wp]').forEach((a) => a.classList.toggle('wb-activo', a.dataset.wp === pg.k));
  if (pg.k === 'educacion' && window.eduRender) window.eduRender(r.sub && $(r.sub) && $(r.sub).classList.contains('edu-contenido') ? r.sub : null);
  // Animaciones de entrada: lo visible ya aparece
  document.querySelectorAll('section:not(.wb-oculta) .fade-up').forEach((e) => e.classList.add('visible'));
  const clave = pg.k + '/' + (sub || '');
  if (r.ir && $(r.ir)) setTimeout(() => $(r.ir).scrollIntoView({ block: 'start' }), 50);
  else if (clave !== actual) window.scrollTo({ top: 0, behavior: 'instant' });
  actual = clave;
  try { document.title = (pg.k === 'inicio' ? '' : pg.n + ' · ') + 'Aeterion'; } catch (e) {}
}
function iniciar() { setTimeout(montar, 0); }
if (document.readyState === 'complete') iniciar(); else window.addEventListener('load', iniciar);

const css = document.createElement('style');
css.textContent = `
body.web-secciones{--negro:#0f0f0e;--negro2:#181817;--negro3:#212120;--negro4:#2b2b29;--gris:#aaa396;--gris2:#7d776b;--texto:#ebe4d6;font-size:16px;background:var(--negro)}
body.web-secciones .hero-h1{font-size:clamp(2.6rem,6.2vw,4.4rem)!important;line-height:1.05!important}
body.web-secciones .hero-scroll{display:none!important}
body.web-secciones .wb-oculta{display:none!important}
body.web-secciones section[id]:not(#hero){padding-top:clamp(2.2rem,5vw,3.8rem)!important;padding-bottom:clamp(2.2rem,5vw,3.8rem)!important}
body.web-secciones #hero{min-height:auto!important;padding-top:calc(var(--wb-nav,120px) + clamp(1.5rem,4vw,3rem))!important;padding-bottom:clamp(2rem,5vw,3.5rem)!important}
body.web-secciones p{color:var(--texto)}
body.web-secciones .nav-links{gap:clamp(1rem,2.5vw,2.2rem)!important}
body.web-secciones .nav-links a{font-size:13px!important;color:#d9d2c4!important}
body.web-secciones .nav-links a.wb-activo{color:var(--oro)!important;border-bottom:2px solid var(--oro);padding-bottom:4px}
body.web-secciones .nav-links a.wb-nav-app{border:1px solid rgba(201,168,76,.6);border-radius:20px;padding:.35rem .9rem;color:var(--oro)!important}
body.web-secciones .nav-mobile a.wb-activo{color:var(--oro)}
#webCab{display:none}
body.web-secciones #webCab.on{display:block;position:sticky;top:var(--wb-nav,78px);z-index:90;background:rgba(14,14,14,.96);backdrop-filter:blur(8px);border-bottom:1px solid rgba(201,168,76,.25);margin-top:var(--wb-nav,78px)}
#webCab .wb-cab-in{max-width:var(--max,1200px);margin:0 auto;padding:.7rem var(--pad);display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;font-family:var(--font-ui)}
#webCab .wb-migas{color:var(--gris);text-decoration:none;font-size:14px}
#webCab .wb-sep{color:var(--gris2)}
#webCab b{color:var(--blanco);font-size:17px;letter-spacing:.04em;font-weight:600}
#webCab .wb-tabs{display:flex;gap:.4rem;margin-left:auto;overflow-x:auto;scrollbar-width:none;max-width:100%}
#webCab .wb-tabs::-webkit-scrollbar{display:none}
#webCab .wb-tabs a{flex:none;text-decoration:none;color:var(--texto);border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:.42rem 1rem;font-size:14px;font-weight:600;letter-spacing:.03em;white-space:nowrap}
#webCab .wb-tabs a.on{background:var(--oro);border-color:var(--oro);color:#16120a}
@media (max-width:760px){#webCab .wb-tabs{margin-left:0;width:100%}}
body.web-secciones #webCab.on + section, body.web-secciones #webCab.on ~ section:not(.wb-oculta){scroll-margin-top:calc(var(--wb-nav,120px) + 70px)}
#webInicio{background:linear-gradient(180deg,var(--negro),#121110)}
#webInicio .wb-ini-cab span{font-family:var(--font-ui);font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--oro)}
#webInicio .wb-ini-cab h2{font-family:var(--font-display);font-size:clamp(2rem,4vw,2.8rem);color:var(--blanco);font-weight:400;margin:.3rem 0 1.4rem}
#webInicio .wb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem}
#webInicio .wb-card{display:flex;gap:1rem;align-items:flex-start;text-decoration:none;background:linear-gradient(160deg,#1c1b18,#141414);border:1px solid rgba(201,168,76,.22);border-radius:16px;padding:1.1rem;color:var(--texto);transition:border-color .2s,transform .2s}
#webInicio .wb-card:hover{border-color:var(--oro);transform:translateY(-2px)}
#webInicio .wb-card img{width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none}
#webInicio .wb-ico{width:64px;height:64px;border-radius:12px;display:grid;place-items:center;font-size:30px;background:rgba(201,168,76,.12);flex:none}
#webInicio .wb-card b{display:block;color:var(--blanco);font-family:var(--font-ui);font-size:19px;font-weight:600;letter-spacing:.02em}
#webInicio .wb-card p{font-size:14px;line-height:1.5;margin:.25rem 0 .5rem;color:var(--texto)}
#webInicio .wb-card em{font-style:normal;color:var(--oro);font-family:var(--font-ui);font-weight:600;font-size:14px}
#webInicio .wb-app{border-color:rgba(201,168,76,.55);background:linear-gradient(160deg,rgba(201,168,76,.16),#141414)}
@media (max-width:760px){body.web-secciones footer{padding:2rem 0 1.2rem!important}body.web-secciones .footer-grid{grid-template-columns:1fr 1fr!important;gap:1.2rem 1rem!important}body.web-secciones .footer-brand{grid-column:1/-1}body.web-secciones .footer-col li{margin:.15rem 0!important}body.web-secciones .footer-col li a{font-size:13px}}
#webEduSec .wb-edu{max-width:820px}
#webEduSec .ed-raiz{--negro2:#181818;font-size:16px}
#webEduSec .app-titulo{font-size:2.2rem}
#webEduSec .app-subtitulo{font-size:14px}
#webEduSec .ed-raiz a.ed-recetas{text-decoration:none}
#webEduSec .ed-fila-t b{font-size:15.5px}
#webEduSec .ed-fila-t small{font-size:13px}
#webEduSec .ed-cuerpo{font-size:16px}
#webEduSec .ed-cuerpo p{font-size:15.5px!important}
#webEduSec .ed-cuerpo strong{font-size:16px!important}
#webEduSec .ed-indice{top:calc(var(--wb-nav,120px) + 52px)}
@media (min-width:760px){#webEduSec .ed-accesos{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}#webEduSec .ed-seguir{grid-column:auto}}
/* ===== Cabecera de tienda ===== */
body.web-secciones #nav.wb-nav{display:block!important;padding:0!important;background:rgba(12,12,11,.97);border-bottom:1px solid rgba(201,168,76,.22)}
body.web-secciones #nav .nav-cta{display:none!important}
.wb-anuncio{background:linear-gradient(90deg,#b8963f,#e2bf6a,#b8963f);color:#16120a;font-family:var(--font-ui);font-weight:600;font-size:13px;letter-spacing:.04em;display:flex;justify-content:center;align-items:center;gap:.7rem;padding:.38rem 1rem;white-space:nowrap;overflow:hidden}
.wb-anuncio span{display:inline-flex;align-items:center;gap:.4rem}
.wb-h1{max-width:1280px;margin:0 auto;padding:.75rem var(--pad);display:flex;align-items:center;gap:1.4rem}
.wb-h1 .nav-logo{font-size:24px!important;letter-spacing:.32em!important;flex:none}
.wb-buscar{position:relative;flex:1;max-width:560px;margin:0 auto}
.wb-buscar input{width:100%;height:44px;border-radius:24px;border:1px solid rgba(201,168,76,.35);background:#1b1a17;color:var(--blanco);padding:0 1rem 0 2.8rem;font:15px var(--font-body);outline:none;transition:border-color .2s,background .2s}
.wb-buscar input:focus{border-color:var(--oro);background:#211f1a}
.wb-buscar input::placeholder{color:#8f887a}
.wb-b-ico{position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:var(--oro);display:flex}
.wb-b-res{position:absolute;left:0;right:0;top:calc(100% + 6px);background:#1a1916;border:1px solid rgba(201,168,76,.35);border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.55);padding:.4rem;z-index:20;max-height:70vh;overflow:auto}
.wb-b-res a{display:flex;align-items:center;gap:.8rem;padding:.55rem .6rem;border-radius:10px;text-decoration:none;color:var(--texto)}
.wb-b-res a:hover,.wb-b-res a:focus{background:rgba(201,168,76,.12)}
.wb-b-res img{width:40px;height:40px;border-radius:8px;object-fit:cover}
.wb-r-ico{width:40px;height:40px;border-radius:8px;display:grid;place-items:center;background:rgba(201,168,76,.12);color:var(--oro);flex:none}
.wb-b-res b{display:block;color:var(--blanco);font-size:14.5px;font-weight:600}
.wb-b-res small{color:var(--gris);font-size:12.5px}
.wb-r-nada{margin:0;padding:.8rem;color:var(--gris);font-size:14px}
.wb-acc{display:flex;align-items:center;gap:.3rem;flex:none}
.wb-ibtn{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:0;color:#e4dccb;cursor:pointer;padding:.3rem .55rem;border-radius:10px;font:600 11.5px var(--font-ui);letter-spacing:.06em;text-transform:uppercase}
.wb-ibtn:hover{color:var(--oro);background:rgba(201,168,76,.08)}
.wb-ibtn i{position:absolute;top:-2px;right:2px;min-width:19px;height:19px;border-radius:10px;background:var(--oro);color:#16120a;font:700 11px/19px var(--font-ui);font-style:normal;text-align:center;padding:0 4px}
.wb-ibtn-buscar{display:none}
.wb-h2{border-top:1px solid rgba(255,255,255,.06)}
body.web-secciones .wb-h2 .nav-links{display:flex!important;justify-content:center;max-width:1280px;margin:0 auto;padding:0 var(--pad);gap:.2rem!important;list-style:none;overflow-x:auto;scrollbar-width:none}
.wb-h2 .nav-links::-webkit-scrollbar{display:none}
body.web-secciones .wb-h2 .nav-links a{display:block;padding:.7rem 1.1rem!important;font-size:14px!important;letter-spacing:.08em;white-space:nowrap;border-bottom:2px solid transparent}
body.web-secciones .wb-h2 .nav-links a.wb-activo{border-bottom:2px solid var(--oro);padding-bottom:.7rem!important}
body.web-secciones .wb-h2 .nav-links a.wb-nav-app{border:1px solid rgba(201,168,76,.6);border-radius:20px;padding:.3rem .95rem!important;margin:.4rem 0 .4rem .6rem}
body.web-secciones #carrito-btn{display:none!important}
@media (max-width:860px){
  .wb-anuncio .wb-an-2{display:none}
  .wb-h1{gap:.5rem;padding:.55rem 1rem}
  .wb-h1 .hamburger{display:flex!important;order:0}
  .wb-h1 .nav-logo{font-size:19px!important;letter-spacing:.24em!important;margin-right:auto}
  .wb-ibtn span{display:none}
  .wb-ibtn{padding:.45rem}
  .wb-ibtn-buscar{display:flex}
  .wb-buscar{display:none;position:absolute;left:1rem;right:1rem;top:calc(100% + 0px);max-width:none}
  #nav.wb-buscando .wb-buscar{display:block;position:static;flex-basis:100%;order:9}
  #nav.wb-buscando .wb-h1{flex-wrap:wrap}
  body.web-secciones .wb-h2 .nav-links{justify-content:flex-start;padding:0 .6rem}
  body.web-secciones .wb-h2 .nav-links a{padding:.6rem .75rem!important;font-size:13.5px!important}
  body.web-secciones .wb-h2 .nav-links a.wb-activo{padding-bottom:.6rem!important}
}
/* ===== Portada ===== */
.wb-hero-grid{display:grid!important;grid-template-columns:1.05fr 1fr;gap:clamp(1.5rem,4vw,3.5rem);align-items:center;max-width:1280px}
.wb-hero-grid #btnInstalarApp{grid-column:1/-1}
.wb-hero-txt .hero-sub{max-width:34rem}
.wb-hero-img{display:block;border-radius:22px;overflow:hidden;border:1px solid rgba(201,168,76,.3);box-shadow:0 30px 70px rgba(0,0,0,.6),0 0 60px rgba(201,168,76,.08)}
.wb-hero-img img{display:block;width:100%;height:auto;transition:transform .6s}
.wb-hero-img:hover img{transform:scale(1.03)}
.wb-hero-pts{list-style:none;display:flex;flex-wrap:wrap;gap:.6rem 1.4rem;margin:1.6rem 0 0;padding:0}
.wb-hero-pts li{display:flex;align-items:center;gap:.45rem;color:#d8d0c0;font:500 14px var(--font-ui);letter-spacing:.03em}
.wb-hero-pts svg{color:var(--oro)}
@media (max-width:860px){.wb-hero-grid{grid-template-columns:1fr}.wb-hero-img{order:-1;max-width:520px;margin:0 auto}body.web-secciones .hero-h1{font-size:clamp(2.2rem,9vw,3rem)!important}}
/* ===== Confianza ===== */
.wb-confianza{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid rgba(201,168,76,.22);border-radius:16px;background:#151513;margin-bottom:clamp(2.5rem,5vw,3.5rem);overflow:hidden}
.wb-confianza>div{display:flex;align-items:center;gap:.8rem;padding:1.1rem 1rem;border-right:1px solid rgba(255,255,255,.06)}
.wb-confianza>div:last-child{border-right:0}
.wb-confianza span{width:48px;height:48px;border-radius:50%;flex:none;display:grid;place-items:center;color:var(--oro);background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25)}
.wb-confianza p{margin:0;line-height:1.3}
.wb-confianza b{display:block;color:var(--blanco);font:600 15px var(--font-ui);letter-spacing:.02em}
.wb-confianza small{color:var(--gris);font-size:12.5px}
@media (max-width:1100px){.wb-confianza{grid-template-columns:repeat(3,1fr)}.wb-confianza>div{border-bottom:1px solid rgba(255,255,255,.06)}}
@media (max-width:640px){.wb-confianza{grid-template-columns:1fr 1fr}.wb-confianza>div{flex-direction:column;text-align:center;gap:.5rem;padding:1rem .6rem}.wb-confianza>div:last-child{grid-column:1/-1}}
/* ===== Títulos de bloque ===== */
.wb-tit{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin:0 0 1.2rem}
.wb-tit span,.wb-app-banda>div>span{font:600 12px var(--font-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--oro)}
.wb-tit h2{font-family:var(--font-display);font-size:clamp(1.9rem,3.6vw,2.6rem);color:var(--blanco);font-weight:400;margin:.2rem 0 0;line-height:1.1}
.wb-tit>a{display:flex;align-items:center;gap:.35rem;color:var(--oro);text-decoration:none;font:600 14px var(--font-ui);letter-spacing:.04em;white-space:nowrap}
/* ===== Productos ===== */
.wb-prods{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem;margin-bottom:clamp(2.5rem,5vw,3.5rem)}
.wb-prod{background:#171715;border:1px solid rgba(201,168,76,.2);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s,transform .2s,box-shadow .2s}
.wb-prod:hover{border-color:rgba(201,168,76,.6);transform:translateY(-3px);box-shadow:0 20px 40px rgba(0,0,0,.45)}
.wb-prod-img{position:relative;display:block;aspect-ratio:1/1;overflow:hidden;background:#0d0d0c}
.wb-prod-img img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.wb-prod:hover .wb-prod-img img{transform:scale(1.04)}
.wb-prod-img em{position:absolute;top:.8rem;left:.8rem;font:600 11.5px var(--font-ui);font-style:normal;letter-spacing:.08em;text-transform:uppercase;background:rgba(12,12,11,.85);color:var(--oro);border:1px solid rgba(201,168,76,.45);border-radius:20px;padding:.25rem .7rem}
.wb-prod-info{padding:1rem 1.1rem 1.15rem;display:flex;flex-direction:column;flex:1}
.wb-prod-info small{color:var(--oro);font:600 11.5px var(--font-ui);letter-spacing:.12em;text-transform:uppercase}
.wb-prod-info h3{font:600 21px var(--font-ui);color:var(--blanco);margin:.25rem 0 .15rem;letter-spacing:.02em}
.wb-prod-info p{font-size:14px;color:var(--gris);margin:0 0 .8rem}
.wb-prod-pie{display:flex;align-items:center;justify-content:space-between;margin-top:auto}
.wb-precio{font:700 22px var(--font-ui);color:var(--blanco);letter-spacing:.02em}
.wb-prod-pie a{color:var(--texto);font-size:14px;text-decoration:underline;text-underline-offset:3px}
.wb-prod .btn-agregar{border-radius:10px;padding:.85rem 1rem;font-size:13px}
@media (max-width:900px){.wb-prods{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.wb-prods{grid-template-columns:1fr}.wb-prod{flex-direction:row}.wb-prod-img{width:40%;aspect-ratio:auto;flex:none}.wb-prod-info{padding:.8rem .9rem}.wb-prod-info h3{font-size:18px}.wb-prod-info p{font-size:13px;margin-bottom:.5rem}.wb-precio{font-size:18px}.wb-prod .btn-agregar{font-size:11px;padding:.65rem .5rem;letter-spacing:.04em}.wb-prod-img em{font-size:10px;top:.5rem;left:.5rem}}
/* ===== Banda app ===== */
.wb-app-banda{display:flex;align-items:center;justify-content:space-between;gap:2rem;border-radius:20px;padding:clamp(1.5rem,4vw,2.6rem);margin-bottom:clamp(2.5rem,5vw,3.5rem);background:radial-gradient(circle at 85% 50%,rgba(201,168,76,.25),transparent 55%),linear-gradient(120deg,#1d1a12,#121211);border:1px solid rgba(201,168,76,.4)}
.wb-app-banda h2{font-family:var(--font-display);font-size:clamp(1.7rem,3.4vw,2.4rem);font-weight:400;color:var(--blanco);margin:.3rem 0 .5rem;line-height:1.15;max-width:36rem}
.wb-app-banda p{color:#d4ccbc;max-width:34rem;margin:0 0 1.2rem}
.wb-app-ico{color:var(--oro);flex:none;width:130px;height:130px;border-radius:30px;display:grid;place-items:center;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.35)}
@media (max-width:640px){.wb-app-ico{display:none}}
#webInicio .wb-ini-cab{margin-top:0}
#webInicio .wb-grid{margin-bottom:clamp(2.5rem,5vw,3.5rem)}
#webInicio .wb-ico{color:var(--oro)}
/* ===== Educación (avance) ===== */
.wb-edu-tea{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
.wb-edu-tea a{display:flex;flex-direction:column;gap:.35rem;text-decoration:none;background:#171715;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:1.2rem;color:var(--texto);transition:border-color .2s}
.wb-edu-tea a:hover{border-color:var(--oro)}
.wb-edu-tea svg{color:var(--oro)}
.wb-edu-tea b{color:var(--blanco);font:600 18px var(--font-ui)}
.wb-edu-tea small{color:var(--gris);font-size:13.5px;line-height:1.45}
.wb-edu-tea em{font-style:normal;color:var(--oro);font:600 14px var(--font-ui);display:flex;align-items:center;gap:.3rem;margin-top:auto;padding-top:.4rem}
@media (max-width:760px){.wb-edu-tea{grid-template-columns:1fr}}
`;
document.head.appendChild(css);
})();
