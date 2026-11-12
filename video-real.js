/* ============================================================
   VIDEO "INVENTARIO REAL" — se reproduce dentro de la página (sin enlaces externos).
   Va en el inicio de la web (debajo de la promo) y en Productos / Tienda de la app.
============================================================ */
(function () {
'use strict';
const SRC = 'video/inventario.mp4?v=1', POSTER = 'video/inventario.jpg';
const css = document.createElement('style');
css.textContent = `
.vr{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:clamp(1.2rem,4vw,3rem);align-items:center;margin:0 0 clamp(2rem,4vw,3rem);padding:clamp(1rem,2.5vw,1.6rem);border-radius:20px;border:1px solid rgba(201,168,76,.3);background:#141412}
.vr-cuadro{position:relative;border-radius:16px;overflow:hidden;background:#000;aspect-ratio:9/16;border:1px solid rgba(201,168,76,.35);box-shadow:0 20px 50px rgba(0,0,0,.5)}
.vr-cuadro video{display:block;width:100%;height:100%;object-fit:cover;background:#000}
.vr-son{position:absolute;right:10px;bottom:56px;z-index:2;border:0;border-radius:22px;padding:.5rem .9rem;background:rgba(12,12,11,.82);color:#f2ead8;font:600 13px var(--font-ui,sans-serif);cursor:pointer;border:1px solid rgba(201,168,76,.5)}
.vr-eye{display:inline-block;font:600 12px var(--font-ui,sans-serif);letter-spacing:.18em;text-transform:uppercase;color:#c9a84c}
.vr h2{font-family:var(--font-display,serif);font-weight:400;font-size:clamp(2rem,4.2vw,3rem);line-height:1.05;color:#fff;margin:.5rem 0 .8rem}
.vr h2 em{color:#e2bf6a;font-style:italic}
.vr p{color:#d4ccbc;font-size:16px;line-height:1.6;margin:0 0 1rem;max-width:34rem}
.vr ul{list-style:none;margin:0 0 1.3rem;padding:0;display:grid;gap:.5rem}
.vr li{color:#e9e2d2;font-size:15px}
.vr li b{color:#e2bf6a;margin-right:.35rem}
@media (max-width:760px){.vr{grid-template-columns:1fr}.vr-cuadro{max-width:360px;width:100%;margin:0 auto}}
body.modo-app .vr{padding:14px;margin:0 0 18px}
`;
document.head.appendChild(css);

function bloque(id) {
  const d = document.createElement('div');
  d.className = 'vr'; d.id = id;
  d.innerHTML = `<div class="vr-cuadro"><video src="${SRC}" poster="${POSTER}" muted loop playsinline controls preload="metadata" aria-label="Video del inventario real de Aeterion"></video><button type="button" class="vr-son">🔊 Activar sonido</button></div>
    <div><span class="vr-eye">Inventario real · sin filtros</span>
      <h2>Esto no es un render. <em>Es nuestro producto.</em></h2>
      <p>Así llega nuestro inventario: creatina, magnesio y vitamina D3 empacados y listos para enviarse a todo México. Lo que ves en el video es lo que recibes en tu casa.</p>
      <ul><li><b>✓</b>Producto físico, en existencia</li><li><b>✓</b>Analizado por laboratorio independiente (CiDi)</li><li><b>✓</b>Enviamos a todo México</li></ul>
      <a href="#/productos" class="btn vr-cta">Ver productos</a></div>`;
  const v = d.querySelector('video'), son = d.querySelector('.vr-son');
  son.addEventListener('click', () => { v.muted = !v.muted; if (!v.muted) { v.currentTime = v.currentTime; v.play().catch(() => {}); } son.textContent = v.muted ? '🔊 Activar sonido' : '🔇 Silenciar'; });
  v.addEventListener('volumechange', () => { son.textContent = v.muted ? '🔊 Activar sonido' : '🔇 Silenciar'; });
  // Se reproduce solo cuando está a la vista (sin sonido); se pausa al salir
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.5) v.play().catch(() => {}); else if (!v.paused) v.pause(); }), { threshold: [0, 0.5, 1] }).observe(v);
  }
  return d;
}
function montar() {
  // Inicio (web): después de la promo si está, si no después de los sellos de confianza
  const ini = document.getElementById('webInicio');
  if (ini && !document.getElementById('vrInicio')) {
    const conf = ini.querySelector('.wb-confianza');
    if (conf) conf.insertAdjacentElement('afterend', bloque('vrInicio'));
  }
  // Productos (web) y Tienda (app): debajo del encabezado
  const prod = document.getElementById('productos');
  if (prod && !document.getElementById('vrProductos')) {
    const cab = prod.querySelector('.productos-header');
    const b = bloque('vrProductos'); b.querySelector('.vr-cta').remove();
    if (cab) cab.insertAdjacentElement('afterend', b);
  }
  // Mientras haya promo, el botón del inicio compra el paquete
  const cta = document.querySelector('#vrInicio .vr-cta');
  if (cta && typeof aetPromoPaqDesc === 'function' && typeof aetPromoPaqNombre === 'function' && aetPromoPaqNombre()) {
    const pb = document.querySelector('.pq-btn'); cta.textContent = pb ? pb.textContent : 'Comprar paquete'; cta.removeAttribute('href'); cta.setAttribute('role', 'button'); cta.style.cursor = 'pointer';
    cta.onclick = (e) => { e.preventDefault(); aetComprarPaquete(); };
  }
  // La promo se vuelve a pintar arriba del video en el inicio
  const pq = ini && ini.querySelector('.pq-ini'), vr = document.getElementById('vrInicio');
  if (pq && vr && pq.compareDocumentPosition(vr) & Node.DOCUMENT_POSITION_PRECEDING) vr.insertAdjacentElement('beforebegin', pq);
}
window.aetVideoReal = montar;
function iniciar() { try { montar(); } catch (e) { console.warn('video', e); } }
if (document.readyState === 'complete') setTimeout(iniciar, 50); else window.addEventListener('load', () => setTimeout(iniciar, 50));
})();
