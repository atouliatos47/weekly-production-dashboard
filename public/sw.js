/* ==========================================================
   sw.js — minimal service worker (enables PWA install)
   Weekly Production Dashboard · Clamason
   ========================================================== */

const CACHE = 'wpd-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/css/dashboard.css',
  '/js/state.js',
  '/js/utils.js',
  '/js/loader.js',
  '/js/app.js',
  '/js/pages/overview.js',
  '/js/pages/adherence.js',
  '/js/pages/reliability.js',
  '/js/pages/labour.js',
  '/js/pages/charts.js',
  '/js/pages/raw.js',
];

// Install: cache all core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, fall back to cache
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
