/* ============================================================
   PROMOCIÓN "PAQUETE AETERION" — creatina + magnesio + vitamina D3 a precio especial.
   La configuración viene de ajustes_publicos.promo_paquete (window._promoPaq); el servidor
   (calcular_carrito) es quien cobra el descuento. Aquí solo se muestra y se arma el carrito.
   Se apaga sola al pasar la fecha de fin.
============================================================ */
(function () {
'use strict';
const DEF = { activa: true, nombre: 'Paquete Aeterion', precio: 849, fin: '2026-12-12', ids: ['creatina', 'magnesio', 'vitd'] };
const $ = (id) => document.getElementById(id);
const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-MX');

function cfg() {
  const c = (window._promoPaq && typeof window._promoPaq === 'object') ? Object.assign({}, DEF, window._promoPaq) : (window._promoPaqCargado ? null : DEF);
  if (!c || !c.activa) return null;
  const fin = Date.parse(String(c.fin) + 'T23:59:59-06:00');
  if (!(fin > Date.now())) return null;
  if (typeof PRODUCTOS === 'undefined' || !c.ids.every((id) => PRODUCTOS[id])) return null;
  if (typeof _catalogo !== 'undefined' && c.ids.some((id) => _catalogo[id] && (_catalogo[id].activo === false || _catalogo[id].disponible === false))) return null;
  return c;
}
function base(c) { return c.ids.reduce((s, id) => s + Number(PRODUCTOS[id].precio || 0), 0); }
function ahorro(c) { return Math.max(0, base(c) - Number(c.precio)); }
function juegos(c) {
  if (typeof carrito === 'undefined') return 0;
  return Math.min(...c.ids.map((id) => (carrito[id] ? carrito[id].cantidad : 0)));
}
// Descuento de la promo para el carrito actual (lo usa actualizarTotales)
window.aetPromoPaqDesc = function () { const c = cfg(); return c ? juegos(c) * ahorro(c) : 0; };
window.aetPromoPaqNombre = function () { const c = cfg(); return c ? c.nombre : ''; };

window.aetComprarPaquete = function () {
  const c = cfg(); if (!c) return;
  const falta = Math.max(1, juegos(c) + 1);
  c.ids.forEach((id) => {
    if (!carrito[id]) carrito[id] = { producto: PRODUCTOS[id], cantidad: 0 };
    carrito[id].cantidad = Math.max(carrito[id].cantidad, falta);
  });
  if (typeof actualizarCarritoUI === 'function') actualizarCarritoUI();
  try { aetEvento && aetEvento('promo_paquete'); } catch (e) {}
  if (typeof abrirCarrito === 'function') abrirCarrito();
};

function fechaFin(c) {
  try { return new Date(String(c.fin) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }); } catch (e) { return c.fin; }
}
function tarjeta(c, clase) {
  const b = base(c), a = ahorro(c), pct = b ? Math.round(a / b * 100) : 0;
  return `<div class="pq ${clase || ''}" data-promo-paquete>
    <div class="pq-img"><img src="img/ad-paquete.jpg" alt="Las 3 por $849: creatina, magnesio y vitamina D3 Aeterion" loading="lazy" width="864" height="1080"></div>
    <div class="pq-info">
      <span class="pq-eye">⏳ Promoción hasta el ${fechaFin(c)}</span>
      <h3>${c.nombre}</h3>
      <p>Creatina 450 g + Magnesio glicinato 100 cápsulas + Vitamina D3 liposomal 50 ml. Los tres protocolos juntos.</p>
      <div class="pq-precio"><b>${fmt(c.precio)}</b><s>${fmt(b)}</s>${a ? `<em>Ahorras ${fmt(a)}</em>` : ''}</div>
      <button type="button" class="btn pq-btn" onclick="aetComprarPaquete()">Comprar paquete · ${fmt(c.precio)}</button>
      <small>Precio por paquete. El envío se calcula con tu código postal.</small>
    </div></div>`;
}

const css = document.createElement('style');
css.textContent = `
.pq{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:clamp(1rem,3vw,2.2rem);align-items:center;padding:clamp(1rem,2.5vw,1.6rem);border-radius:20px;border:1px solid rgba(201,168,76,.65);background:radial-gradient(circle at 12% 20%,rgba(201,168,76,.22),transparent 55%),linear-gradient(135deg,#221d10,#141412 70%);box-shadow:0 20px 50px rgba(0,0,0,.45);margin:0 0 clamp(2rem,4vw,3rem);color:#e9e2d2}
.pq-img{position:relative;border-radius:14px;overflow:hidden;border:1px solid rgba(201,168,76,.3)}
.pq-img img{display:block;width:100%;height:auto}
.pq-sello{position:absolute;top:12px;left:12px;background:#c9a84c;color:#16120a;font:700 15px var(--font-ui,sans-serif);padding:.35rem .75rem;border-radius:20px;letter-spacing:.03em}
.pq-eye{display:inline-block;font:600 12.5px var(--font-ui,sans-serif);letter-spacing:.12em;text-transform:uppercase;color:#16120a;background:#e2bf6a;border-radius:20px;padding:.3rem .8rem}
.pq h3{font-family:var(--font-display,serif);font-weight:400;font-size:clamp(2rem,4.4vw,3rem);line-height:1.05;color:#fff;margin:.7rem 0 .5rem}
.pq p{color:#d4ccbc;font-size:15.5px;line-height:1.55;margin:0 0 1rem}
.pq-precio{display:flex;align-items:baseline;flex-wrap:wrap;gap:.4rem .9rem;margin-bottom:1rem}
.pq-precio b{font:700 clamp(2.2rem,5vw,3rem)/1 var(--font-ui,sans-serif);color:#e2bf6a}
.pq-precio s{color:#8f887a;font-size:18px}
.pq-precio em{font-style:normal;color:#2ecc71;font:600 15px var(--font-ui,sans-serif)}
.pq-btn{display:inline-block;width:100%;max-width:380px;text-align:center;font-size:15px!important;padding:1rem 1.2rem!important;cursor:pointer}
.pq small{display:block;margin-top:.6rem;color:#8f887a;font-size:12.5px}
@media (max-width:760px){.pq{grid-template-columns:1fr}.pq-img{max-width:380px;width:100%;margin:0 auto}.pq-btn{max-width:none}}
body.modo-app .pq{margin:0 0 18px;padding:14px}
body.modo-app .pq h3{font-size:30px}
.pq-an-c{display:none!important}
@media (max-width:760px){.pq-an-l{display:none!important}.pq-an-c{display:inline!important}}
.pq-pista{margin:8px 0 2px;padding:10px 12px;border-radius:12px;border:1px dashed rgba(201,168,76,.6);background:rgba(201,168,76,.08);font-size:13px;color:#e2d8c2;line-height:1.4}
.pq-pista button{background:none;border:0;color:#e2bf6a;font-weight:700;text-decoration:underline;cursor:pointer;padding:0;font-size:13px}
`;
document.head.appendChild(css);

function pintar() {
  const c = cfg();
  document.querySelectorAll('[data-promo-paquete]').forEach((e) => e.remove());
  const an = document.querySelector('.wb-anuncio');
  if (an) {
    if (!an.dataset.orig) an.dataset.orig = an.innerHTML;
    an.innerHTML = c ? `<span class="pq-an-l">🔥 ${c.nombre}: creatina + magnesio + vitamina D3 por ${fmt(c.precio)} · hasta el ${fechaFin(c)}</span><span class="pq-an-c">🔥 Las 3 por ${fmt(c.precio)} · hasta el ${fechaFin(c)}</span>` : an.dataset.orig;
    an.style.cursor = c ? 'pointer' : '';
    an.onclick = c ? () => { location.hash = '#/productos'; } : null;
  }
  if (!c) { pista(); return; }
  // Productos (web) y Tienda (app): arriba de la lista de productos
  const prod = $('productos');
  if (prod) {
    const cont = prod.querySelector('.contenedor') || prod;
    const ancla = cont.querySelector('.productos-grid, .producto-card') ;
    const div = document.createElement('div'); div.innerHTML = tarjeta(c, 'pq-prod');
    const nodo = div.firstElementChild;
    if (ancla && ancla.parentNode) ancla.parentNode.insertBefore(nodo, ancla); else cont.insertBefore(nodo, cont.firstChild);
  }
  // Inicio de la web: justo debajo de los sellos de confianza
  const conf = document.querySelector('#webInicio .wb-confianza');
  if (conf) conf.insertAdjacentHTML('afterend', tarjeta(c, 'pq-ini'));
  pista();
}
// Pista en el carrito: si faltan productos para el paquete
function pista() {
  const pie = $('carrito-footer'); if (!pie) return;
  let p = $('pqPista');
  const c = cfg();
  const tiene = c && typeof carrito !== 'undefined' ? c.ids.filter((id) => carrito[id]).length : 0;
  const mostrar = c && tiene > 0 && juegos(c) === 0;
  if (!mostrar) { if (p) p.remove(); return; }
  if (!p) { p = document.createElement('div'); p.id = 'pqPista'; p.className = 'pq-pista'; pie.insertBefore(p, pie.firstChild); }
  p.innerHTML = `🔥 Agrega los 3 productos y paga solo <b>${fmt(c.precio)}</b> (ahorras ${fmt(ahorro(c))}). <button type="button" onclick="aetComprarPaquete()">Completar paquete</button>`;
}
window.aetPromoPaqPintar = pintar;
window.aetPromoPaqPista = pista;

// Repintar cuando cambian precios del catálogo
if (typeof window.aetPintarCatalogo === 'function') {
  const orig = window.aetPintarCatalogo;
  window.aetPintarCatalogo = function () { const r = orig.apply(this, arguments); try { pintar(); } catch (e) {} return r; };
}
function iniciar() { try { pintar(); } catch (e) { console.warn('promo', e); } }
if (document.readyState === 'complete') setTimeout(iniciar, 0); else window.addEventListener('load', () => setTimeout(iniciar, 0));
})();
