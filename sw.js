const CACHE = 'food-journal-v10';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './assets/demo-a.jpg', './assets/demo-b.jpg', './assets/demo-c.jpg', './assets/demo-d.jpg', './assets/demo-e.jpg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))));
self.addEventListener('message', (event) => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
