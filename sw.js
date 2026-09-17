/* ==========================================================================
   BordCub — service worker
   Tout est mis en cache à l'installation : l'application démarre ensuite
   sans réseau, en forêt comme ailleurs.
   ========================================================================== */
'use strict';

var VERSION = '4.84.0-20260916-2028';
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

/* Les tuiles de l'IGN déjà regardées restent sur le téléphone : « quand je
   regarde une zone sur la carte, qu'elle s'enregistre, comme ça même hors
   réseau je peux y avoir accès ».

   Un cache à part, SANS numéro de version : une mise à jour de Sylve ne doit
   pas effacer ce qu'il a regardé — le ménage de l'activation ne vise que les
   noms en « bordcub- ». Plafonné, sinon il grossirait sans fin : à quinze Ko
   la tuile, trois mille font une cinquantaine de Mo. */
var CACHE_TUILES = 'sylve-tuiles';
var TUILES_MAX = 3000;
function estTuile(u) { return u.hostname === 'data.geopf.fr' && u.pathname === '/wmts'; }
function elaguerTuiles(c) {
  return c.keys().then(function (cles) {
    /* Les plus anciennes partent d'abord : keys() rend l'ordre d'arrivée. */
    var trop = cles.length - TUILES_MAX, fait = [];
    for (var i = 0; i < trop; i++) fait.push(c.delete(cles[i]));
    return Promise.all(fait);
  });
}
function servirTuile(req) {
  return caches.open(CACHE_TUILES).then(function (c) {
    return c.match(req).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (rep) {
        /* Une réponse opaque pèse plusieurs Mo dans le quota du navigateur,
           quelle que soit sa taille réelle : trois mille auraient saturé le
           téléphone. Elle porte toujours ok à faux, donc elle n'entre pas —
           et c'est pourquoi la carte demande ses tuiles en CORS : sans ça,
           rien ne serait jamais gardé. */
        if (rep && rep.ok) {
          c.put(req, rep.clone()).then(function () { return elaguerTuiles(c); });
        }
        return rep;
      });
    });
  });
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (estTuile(u)) { ev.respondWith(servirTuile(req)); return; }
  if (u.origin !== self.location.origin) return;

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
