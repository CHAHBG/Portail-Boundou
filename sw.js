const STATIC_CACHE = 'boundou-static-v3-non-persistent';
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js'
];

// Install: pre-cache only core shell assets (no data files)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)).catch(err => console.warn('Precache error', err))
  );
});

// Activate: clean old caches each new SW version
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k))))
  );
});

// Page load cache purge: clear all caches on every page load to ensure non-persistent cache
self.addEventListener('message', event => {
  if (event.data === 'CLEAR_CACHES_FOR_NEW_PAGE_LOAD') {
    console.log('Clearing all caches for fresh page load...');
    caches.keys().then(keys => {
      keys.forEach(k => {
        caches.delete(k);
        console.log(`Cache deleted: ${k}`);
      });
    });
  }
});

// Fetch strategy:
//  - For data files (geojson/json) => network-first (avoid stale data), fallback to cache if offline
//  - For other GET requests => cache-first then network fallback
//  - For POST or non-GET => pass through
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return; // ignore non-GET

  const url = new URL(request.url);
  const isData = /\.(geojson|json)$/i.test(url.pathname) && url.origin === location.origin;

  if (isData) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Optionally update cache for offline use
          const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          return response;
        })
        .catch(() => {
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});
