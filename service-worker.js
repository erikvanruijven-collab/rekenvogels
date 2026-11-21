// =====================================================================
// service-worker.js — Rekenvogels werkt ook zonder wifi
// ---------------------------------------------------------------------
// Bij de eerste keer laden worden alle bestanden van de game in een
// cache op de tablet bewaard. Daarna start de game ook offline.
//
// UPDATES: verhoog bij elke nieuwe versie het VERSION-nummer hieronder
// (gelijk aan CONFIG.version in js/config.js). De tablet ziet dan dat
// dit bestand veranderd is, haalt alle bestanden vers op (zonder de
// tussenopslag van GitHub) en de game laadt de nieuwe versie zodra je
// op de wereldkaart bent.
// =====================================================================

const VERSION = '1.0.1';
const CACHE = `rekenvogels-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './js/audio.js',
  './js/badges.js',
  './js/birds.js',
  './js/config.js',
  './js/fx.js',
  './js/items.js',
  './js/main.js',
  './js/math.js',
  './js/minigames/gouden-duik.js',
  './js/parent.js',
  './js/physics.js',
  './js/progress.js',
  './js/renderer.js',
  './js/storage.js',
  './js/worlds/index.js',
  './js/worlds/meeuwenrace.js',
  './js/worlds/nachtvlucht.js',
  './js/worlds/stormschiereiland.js',
  './js/worlds/wolkenvallei.js',
];

// Installeren: alles vers ophalen en bewaren
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Activeren: oude versies opruimen en meteen de baas worden
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('rekenvogels-') && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Ophalen: eerst uit de cache (snel en offline), anders van internet
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Iets dat nog niet in de cache zat (bijv. een nieuw bestand): bewaren
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => {
        // Offline en niet in de cache: bij een pagina de game zelf tonen
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
