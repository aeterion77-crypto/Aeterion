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
  window.addEventListener('hashchange', rutear);
  rutear();
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
body.web-secciones #hero{min-height:auto!important;padding-top:clamp(6rem,12vw,8rem)!important;padding-bottom:clamp(2.5rem,6vw,4rem)!important}
body.web-secciones p{color:var(--texto)}
body.web-secciones .nav-links{gap:clamp(1rem,2.5vw,2.2rem)!important}
body.web-secciones .nav-links a{font-size:13px!important;color:#d9d2c4!important}
body.web-secciones .nav-links a.wb-activo{color:var(--oro)!important;border-bottom:2px solid var(--oro);padding-bottom:4px}
body.web-secciones .nav-links a.wb-nav-app{border:1px solid rgba(201,168,76,.6);border-radius:20px;padding:.35rem .9rem;color:var(--oro)!important}
body.web-secciones .nav-mobile a.wb-activo{color:var(--oro)}
#webCab{display:none}
body.web-secciones #webCab.on{display:block;position:sticky;top:78px;z-index:90;background:rgba(14,14,14,.96);backdrop-filter:blur(8px);border-bottom:1px solid rgba(201,168,76,.25);margin-top:78px}
#webCab .wb-cab-in{max-width:var(--max,1200px);margin:0 auto;padding:.7rem var(--pad);display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;font-family:var(--font-ui)}
#webCab .wb-migas{color:var(--gris);text-decoration:none;font-size:14px}
#webCab .wb-sep{color:var(--gris2)}
#webCab b{color:var(--blanco);font-size:17px;letter-spacing:.04em;font-weight:600}
#webCab .wb-tabs{display:flex;gap:.4rem;margin-left:auto;overflow-x:auto;scrollbar-width:none;max-width:100%}
#webCab .wb-tabs::-webkit-scrollbar{display:none}
#webCab .wb-tabs a{flex:none;text-decoration:none;color:var(--texto);border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:.42rem 1rem;font-size:14px;font-weight:600;letter-spacing:.03em;white-space:nowrap}
#webCab .wb-tabs a.on{background:var(--oro);border-color:var(--oro);color:#16120a}
@media (max-width:760px){#webCab .wb-tabs{margin-left:0;width:100%}body.web-secciones #webCab.on{top:64px;margin-top:64px}}
body.web-secciones #webCab.on + section, body.web-secciones #webCab.on ~ section:not(.wb-oculta){scroll-margin-top:150px}
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
#webEduSec .ed-indice{top:130px}
@media (min-width:760px){#webEduSec .ed-accesos{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}#webEduSec .ed-seguir{grid-column:auto}}
`;
document.head.appendChild(css);
})();
