/* ==========================================================  FOND DE CARTE
   Les fonds de la Géoplateforme de l'IGN, en accès libre. Ce sont ceux
   qu'il a lui-même relevés dans son fichier de cartographie.

   Ils demandent du réseau, et c'est accepté : sans réseau, la carte montre
   encore les chantiers placés les uns par rapport aux autres, et rien ne
   casse. Les contours de communes, qui tenaient hors ligne, ont été retirés
   à sa demande en 4.82 : « ça sert à rien ». */
var FONDS_TUILES = [
  { c: 'photo', n: 'Photo aérienne',
    couche: 'ORTHOIMAGERY.ORTHOPHOTOS', format: 'image/jpeg', max: 19 },
  { c: 'ign', n: 'Carte IGN',
    couche: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', format: 'image/png', max: 19 }
];
/* Un téléphone réglé sur « contours seuls » avant la 4.82 retombe sur la
   photo : un choix qui n'existe plus ne doit pas laisser la carte vide. */
function fondTuiles() {
  var c = (A.cfg && A.cfg.fondCarte) || 'photo';
  for (var i = 0; i < FONDS_TUILES.length; i++) {
    if (FONDS_TUILES[i].c === c) return FONDS_TUILES[i];
  }
  return FONDS_TUILES[0];
}
function urlTuile(f, z, x, y) {
  return 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
    '&LAYER=' + f.couche + '&STYLE=normal&TILEMATRIXSET=PM&FORMAT=' +
    encodeURIComponent(f.format) +
    '&TILEMATRIX=' + z + '&TILEROW=' + y + '&TILECOL=' + x;
}
/* Le niveau de tuile dont l'échelle colle le mieux à celle qu'on affiche.
   La largeur du monde en Mercator vaut 2 π R ; à un niveau z elle tient sur
   256 × 2^z pixels. */
var TOUR_MERCATOR = 2 * Math.PI * 6378137;
function niveauTuile(m, max) {
  var z = Math.round(Math.log(TOUR_MERCATOR / (256 * m)) / Math.LN2);
  return Math.max(0, Math.min(max || 19, z));
}

/* Web Mercator (EPSG:3857) : la projection de toutes les tuiles du web.
   Sphérique et sans excentricité — c'est la définition, pas une
   approximation.

   Elle étire vers les pôles : un pixel ne vaut pas la même distance au sol
   selon la latitude. D'où `facteurSol`, qui rend l'échelle vraie plutôt
   que la mesure de Mercator. */
var LB = (function () {
  var A = 6378137, r = Math.PI / 180;
  return {
    vers: function (lat, lon) {
      return { x: A * lon * r, y: A * Math.log(Math.tan(Math.PI / 4 + lat * r / 2)) };
    },
    depuis: function (x, y) {
      return { lat: (2 * Math.atan(Math.exp(y / A)) - Math.PI / 2) / r, lon: x / A / r };
    },
    /* Combien de mètres au sol vaut un mètre de Mercator à cette latitude :
       environ 0,69 au milieu de la France, Mercator étirant de 1,45. */
    facteurSol: function (y) {
      return Math.cos((2 * Math.atan(Math.exp(y / A)) - Math.PI / 2));
    }
  };
})();

/* « Une barre de recherche pour rechercher une ville ou une commune. » Le
   géocodage de l'IGN, le même fournisseur que les tuiles : sans réseau il
   n'y aurait de toute façon pas de photo à regarder. */
function urlRechercheCommune(q) {
  return 'https://data.geopf.fr/geocodage/search?q=' + encodeURIComponent(q) +
    '&type=municipality&limit=5';
}
var communesTrouvees = [];
function chercherCommune(q) {
  var z = $('#carte-resultats'); if (!z) return Promise.resolve();
  var dire = function (t) {
    z.innerHTML = '<p class="muted" style="font-size:12px;margin:0 0 8px">' + esc(t) + '</p>';
  };
  q = String(q || '').trim();
  if (q.length < 2) { z.innerHTML = ''; return Promise.resolve(); }
  /* Un vieux navigateur sans fetch lèverait une erreur avant la promesse,
     que rien ne rattraperait. */
  if (typeof fetch !== 'function') {
    dire('Ce navigateur ne sait pas interroger l’IGN.');
    return Promise.resolve();
  }
  dire('Recherche…');
  return fetch(urlRechercheCommune(q)).then(function (r) {
    if (!r.ok) throw new Error('réponse ' + r.status);
    return r.json();
  }).then(function (j) {
    communesTrouvees = ((j && j.features) || []).filter(function (f) {
      return f && f.geometry && f.geometry.coordinates;
    }).map(function (f) {
      var p = f.properties || {};
      /* Le service rend la longitude d'abord : c'est l'ordre du GeoJSON. */
      return { nom: p.name || p.label || q, dep: p.depcode || '',
        lon: Number(f.geometry.coordinates[0]), lat: Number(f.geometry.coordinates[1]) };
    });
    if (!communesTrouvees.length) { dire('Aucune commune de ce nom.'); return; }
    /* Une seule réponse : on y va, plutôt que de faire choisir dans une
       liste d'un. */
    if (communesTrouvees.length === 1) { allerCommune(communesTrouvees[0]); return; }
    z.innerHTML = '<div class="chips" style="margin:0 0 8px">' +
      communesTrouvees.map(function (c, i) {
        return '<button class="chip" data-commune="' + i + '">' + esc(c.nom) +
          (c.dep ? ' (' + esc(c.dep) + ')' : '') + '</button>';
      }).join('') + '</div>';
  }).catch(function () {
    dire('Recherche impossible : elle interroge l’IGN, il faut du réseau.');
  });
}
/* La carte ouverte depuis la fiche : sur le chantier s'il est placé, sinon
   sur sa commune — trouvée par le même géocodage que la recherche. Sans
   réseau, la carte s'ouvre où elle était, et le doigt fait le reste. */
function montrerSurCarte(c, placer) {
  var v = cadreCarte();
  var place = c.gps && c.gps.lat != null;
  A.cartePose = placer ? c.id : null;
  if (place) {
    var m = LB.vers(c.gps.lat, c.gps.lon);
    v.cx = m.x; v.cy = m.y;
    v.m = Math.min(v.m, 8 / LB.facteurSol(m.y));
  }
  renderCarteChantiers();
  allerModule('calendrier', 'carte');
  if (!place && c.commune) centrerSurCommune(c.commune);
  if (placer) toast('Appuyez sur la carte à l’endroit du chantier.');
}
function centrerSurCommune(nom) {
  if (!nom || typeof fetch !== 'function') return Promise.resolve(false);
  return fetch(urlRechercheCommune(nom)).then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (j) {
    var f = j && j.features && j.features[0];
    if (!f || !f.geometry || !f.geometry.coordinates) return false;
    allerCommune({ lon: Number(f.geometry.coordinates[0]), lat: Number(f.geometry.coordinates[1]) });
    return true;
  }).catch(function () { return false; });
}
function allerCommune(c) {
  if (!c) return;
  var m = LB.vers(c.lat, c.lon), v = cadreCarte();
  v.cx = m.x; v.cy = m.y;
  /* Une douzaine de mètres au sol par pixel : la commune tient à l'écran. */
  v.m = 12 / LB.facteurSol(m.y);
  var z = $('#carte-resultats'); if (z) z.innerHTML = '';
  renderCarteChantiers();
}

