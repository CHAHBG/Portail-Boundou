const CACHE = 'boundou-cache-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // Utiliser des chemins relatifs corrects
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './app.js',
        // Retirer les fichiers qui n'existent pas encore
        // './data/communes_boundou.geojson',
        // './data/parcelles.json'
      ]).catch(error => {
        console.warn('Erreur lors de la mise en cache:', error);
      });
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => {
        // Retourner une page offline si disponible
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      })
  );
});
