/* Minimal offline cache for Dō. Bump CACHE_VERSION whenever files change. */
const CACHE_VERSION = 'do-v3';
const SHELL = [
  './', './index.html', './styles.css',
  './do-time.js', './do-store.js', './do-core.js',
  './app.config.js', './app.helpers.js', './app.render.js',
  './app.panels.js', './app.projects.js', './app.ai.js', './app.wiring.js',
  './app.fitbit.js', './app.init.js', './manifest.json'
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;                       // don't touch API POSTs
  if (new URL(request.url).origin !== self.location.origin) return; // let API + fonts hit network
  e.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
