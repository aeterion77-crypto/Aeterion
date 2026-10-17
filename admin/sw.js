/* Aeterion Admin — service worker: avisos push + apertura rápida. Nunca guarda datos de pedidos. */
const CACHE = 'aet-admin-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Páginas: red primero (copia solo de la carcasa si no hay conexión). Todo lo demás pasa directo.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  e.respondWith(
    fetch(req).then((r) => { if (r && r.status === 200) { const c = r.clone(); caches.open(CACHE).then((x) => x.put('/admin/', c)); } return r; })
      .catch(() => caches.match('/admin/').then((c) => c || Response.error()))
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Aeterion', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Aeterion', {
      body: d.body || '', icon: '../icons/icon-192.png', badge: '../icons/icon-192.png',
      tag: d.tag || 'aeterion-pedido', renotify: true, data: { url: d.url || '/admin/' }
    });
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach((c) => c.postMessage({ tipo: 'push' }));
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/admin/';
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { if (c.url.includes('/admin/')) { await c.focus(); c.postMessage({ tipo: 'push', url }); return; } }
    await self.clients.openWindow(url);
  })());
});
