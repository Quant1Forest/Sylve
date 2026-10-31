/* ==========================================================================
   Sylve — localisation
   Un point GPS, une distance, un lien vers l'appli de navigation.
   Aucune carte en ligne : sous couvert il n'y a pas de réseau.
   ========================================================================== */
(function () {
'use strict';

var R = 6371000;   // rayon terrestre moyen, en mètres
function rad(d) { return d * Math.PI / 180; }

/* Distance entre deux points, en mètres (haversine). */
function distance(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  var dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

/* Direction en points cardinaux — utile quand on marche sans carte. */
var ROSE = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
function cap(a, b) {
  if (!a || !b) return '';
  var y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  var x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  var d = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return ROSE[Math.round(d / 45) % 8];
}

function fmtDistance(m) {
  if (m == null) return '';
  if (m < 1000) return m + ' m';
  return (m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',') + ' km';
}
function fmtCoord(p) {
  if (!p || p.lat == null) return '';
  return p.lat.toFixed(5).replace('.', ',') + ' · ' + p.lon.toFixed(5).replace('.', ',');
}
function fmtPrecision(p) {
  return p && p.prec != null ? '±' + Math.round(p.prec) + ' m' : '';
}

function dispo() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

/* Relève une position. Deux essais : une lecture rapide, puis une lecture
   précise si le GPS a le temps de s'accrocher. */
function position(rapide) {
  return new Promise(function (res, rej) {
    if (!dispo()) { rej(new Error('indisponible')); return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      res({
        lat: p.coords.latitude, lon: p.coords.longitude,
        prec: p.coords.accuracy == null ? null : Math.round(p.coords.accuracy),
        alt: p.coords.altitude == null ? null : Math.round(p.coords.altitude),
        ts: p.timestamp || Date.now()
      });
    }, function (e) {
      rej(new Error(e && e.code === 1 ? 'refus' : 'echec'));
    }, {
      enableHighAccuracy: !rapide,
      timeout: rapide ? 6000 : 20000,
      maximumAge: rapide ? 60000 : 0
    });
  });
}

/* Sur Android, geo: laisse le choix de l'application (Maps, OsmAnd, IGN…).
   Ailleurs, on ouvre une carte web. */
function lienNav(p, nom) {
  if (!p || p.lat == null) return '';
  var c = p.lat.toFixed(6) + ',' + p.lon.toFixed(6);
  var android = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
  if (android) return 'geo:' + c + '?q=' + c + (nom ? '(' + encodeURIComponent(nom) + ')' : '');
  return 'https://www.google.com/maps/search/?api=1&query=' + c;
}

/* Trie des objets porteurs d'un point par éloignement. */
function parDistance(liste, depuis, cle) {
  var k = cle || 'gps';
  return liste.map(function (o) {
    return { o: o, d: depuis ? distance(depuis, o[k]) : null };
  }).sort(function (a, b) {
    if (a.d == null && b.d == null) return 0;
    if (a.d == null) return 1;
    if (b.d == null) return -1;
    return a.d - b.d;
  });
}

var G = {
  dispo: dispo, position: position, distance: distance, cap: cap,
  fmtDistance: fmtDistance, fmtCoord: fmtCoord, fmtPrecision: fmtPrecision,
  lienNav: lienNav, parDistance: parDistance
};
if (typeof window !== 'undefined') window.BCG = G;
if (typeof module === 'object' && module.exports) module.exports = G;

})();

