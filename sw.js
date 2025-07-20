const CACHE='boundou-cache-v1';
const OFFLINE_URL='/offline.html';
self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll([
      '/','index.html','bundle.js','/style.css','style.min.css',
      'data/communes_boundou.topo.json','data/parcelles.json'
    ]))
  );
});
self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request))
  );
});

