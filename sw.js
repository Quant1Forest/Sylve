/* ==========================================================================
   BordCub — service worker
   Tout est mis en cache à l'installation : l'application démarre ensuite
   sans réseau, en forêt comme ailleurs.
   ========================================================================== */
'use strict';

var VERSION = '4.51.0-20260823-1129';
var CACHE = 'bordcub-' + VERSION;
var FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-512.png',
  './icone-maskable-512.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(FICHIERS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
    })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.map(function (n) {
        return (n !== CACHE && n.indexOf('bordcub-') === 0) ? caches.delete(n) : null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (ev) {
  if (ev.data && ev.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  /* navigation : la page principale, hors ligne comme en ligne */
  if (req.mode === 'navigate') {
    ev.respondWith(
      caches.match('./index.html').then(function (r) {
        return r || fetch(req).catch(function () { return caches.match('./'); });
      })
    );
    return;
  }

  ev.respondWith(
    caches.match(req).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (rep) {
        if (rep && rep.ok && rep.type === 'basic') {
          var copie = rep.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copie); });
        }
        return rep;
      });
    })
  );
});
