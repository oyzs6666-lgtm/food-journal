const CACHE = 'food-journal-v13';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './assets/demo-a.jpg', './assets/demo-b.jpg', './assets/demo-c.jpg', './assets/demo-d.jpg', './assets/demo-e.jpg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isAppCode = request.mode === 'navigate' || /\.(?:html|css|js)$/.test(url.pathname);
  if (isAppCode) {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
self.addEventListener('message', (event) => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
