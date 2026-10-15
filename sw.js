/* AETERION — service worker
   - La PÁGINA (index.html) se pide primero a la red, con la copia guardada como respaldo sin conexión.
     Así una versión nueva se ve en la siguiente apertura (antes tardaba dos aperturas).
   - Videos, audio y documentos descargables (Excel, Word, PDF, ZIP) NO pasan por el service worker:
     el navegador habla directo con el servidor. Safari/iPhone exige respuestas parciales (206) reales
     para reproducir video, y las descargas no deben servirse desde una copia vieja.
   - Archivos pequeños (íconos, manifest) usan la copia guardada y se actualizan en segundo plano. */
const CACHE = 'aeterion-v36';
const ARCHIVOS_BASE = ['./index.html', './manifest.json'];
const NO_INTERCEPTAR = /\.(mp4|m4v|mov|webm|mp3|m4a|wav|ogg|xlsx|xls|docx|doc|pdf|zip)$/i;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS_BASE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                       // solo archivos propios
  if (url.pathname.endsWith('/admin.html') || url.pathname.startsWith('/admin/')) return;   // panel de administración: siempre directo

  // Medios y descargas: sin intervención del service worker
  if (req.destination === 'video' || req.destination === 'audio' || req.headers.has('range') || NO_INTERCEPTAR.test(url.pathname)) return;

  // La página: red primero (máx. 4 s), copia guardada si no hay conexión
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      new Promise(resolver => {
        const limite = setTimeout(() => caches.match(req, { ignoreSearch: true }).then(c => c && resolver(c)), 4000);
        fetch(req).then(resp => {
          clearTimeout(limite);
          if (resp && resp.status === 200) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
          resolver(resp);
        }).catch(() => {
          clearTimeout(limite);
          caches.match(req, { ignoreSearch: true }).then(c => resolver(c || caches.match('./index.html')));
        });
      })
    );
    return;
  }

  // Resto de archivos pequeños: copia guardada y actualización en segundo plano
  e.respondWith(
    caches.match(req).then(cached => {
      const red = fetch(req).then(resp => {
        if (resp && resp.status === 200) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
        return resp;
      }).catch(() => cached);
      return cached || red;
    })
  );
});
