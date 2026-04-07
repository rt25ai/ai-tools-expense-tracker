const CACHE = 'ai-expenses-v1';
const ASSETS = [
  '/ai-tools-expense-tracker/',
  '/ai-tools-expense-tracker/index.html',
  '/ai-tools-expense-tracker/logo.png',
  '/ai-tools-expense-tracker/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // data.json — always network first (fresh data)
  if (e.request.url.includes('data.json')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // everything else — cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
