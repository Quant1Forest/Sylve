/* ==========================================================================
   Sylve — bois de chauffage (logique pure)
   Le stère = volume empilé. Au-dessus de 1 m de bûche : longueur × hauteur ×
   largeur donne directement le volume. En dessous (50, 40, 33 cm), les bûches
   se tassent : on divise par le coefficient pour retomber sur l'équivalent
   stère vendu (table de l'enquête exploitation forestière).
   ========================================================================== */
(function () {
'use strict';

var MOIS = 2629800000;   // mois moyen, en millisecondes
var JOUR = 86400000;

/* Largeur de la pile = longueur des bûches empilées. Coefficient de tassement :
   1 seulement au-dessus de 1 m ; en dessous, le bois recoupé remplit moins. */
var BUCHES = [
  { cm: 200, nom: '2 m', coef: 1 },
  { cm: 150, nom: '1,50 m', coef: 1 },
  { cm: 130, nom: '1,30 m', coef: 1 },
  { cm: 100, nom: '1 m', coef: 1 },
  { cm: 50, nom: '50 cm', coef: 0.8 },
  { cm: 40, nom: '40 cm', coef: 0.75 },
  { cm: 33, nom: '33 cm', coef: 0.7 },
  { cm: 25, nom: '25 cm', coef: 0.6 }
];

/* dur = feuillus durs · blanc = feuillus tendres · res = résineux */
var ESSENCES = [
  { c: 'HET', n: 'Hêtre', t: 'dur' }, { c: 'CHE', n: 'Chêne', t: 'dur' },
  { c: 'CHA', n: 'Charme', t: 'dur' }, { c: 'FRE', n: 'Frêne', t: 'dur' },
  { c: 'ERA', n: 'Érable', t: 'dur' }, { c: 'MER', n: 'Merisier', t: 'dur' },
  { c: 'ORM', n: 'Orme', t: 'dur' }, { c: 'ROB', n: 'Robinier', t: 'dur' },
  { c: 'CHT', n: 'Châtaignier', t: 'dur' },
  { c: 'BOU', n: 'Bouleau', t: 'blanc' }, { c: 'TRE', n: 'Tremble', t: 'blanc' },
  { c: 'PEU', n: 'Peuplier', t: 'blanc' }, { c: 'TIL', n: 'Tilleul', t: 'blanc' },
  { c: 'AUL', n: 'Aulne', t: 'blanc' }, { c: 'SAU', n: 'Saule', t: 'blanc' },
  { c: 'NOI', n: 'Noisetier', t: 'blanc' },
  { c: 'EPC', n: 'Épicéa', t: 'res' }, { c: 'SAP', n: 'Sapin', t: 'res' },
  { c: 'DOU', n: 'Douglas', t: 'res' }, { c: 'PIN', n: 'Pin', t: 'res' }
];
var TYPES = { dur: 'bois dur', blanc: 'bois blanc', res: 'résineux', mixte: 'mélange' };

/* Quatre états (valeurs de départ, modifiables) : vert > 40 · séchage 25-40 ·
   sec 20-25 · très sec < 20. Seuils lus à l'humidimètre. */
var SEUILS_DEFAUT = { vert: 40, sec: 25, tresSec: 20 };
/* Humidité de départ selon ce qu'on empile. Du bois mort resté sur pied a
   déjà perdu une partie de son eau : il n'a pas le même chemin à faire que
   du bois vert abattu du jour. Ces deux repères sont réglables. */
var DEPART_DEFAUT = { vert: 45, sec: 30 };
var SECHAGE = { dur: 24, blanc: 18, res: 18, mixte: 24 };   // mois avant « sec »
var POIDS_TYPE = { dur: 0.6, blanc: 0.45, res: 0.4, mixte: 0.5 };  // t/stère

function essence(code) { for (var i = 0; i < ESSENCES.length; i++) if (ESSENCES[i].c === code) return ESSENCES[i]; return null; }
function nomEssence(code) { var e = essence(code); return e ? e.n : code; }
function buche(cm) { for (var i = 0; i < BUCHES.length; i++) if (BUCHES[i].cm === Number(cm)) return BUCHES[i]; return null; }
function coefBuche(cm, perso) { if (perso && perso[String(cm)] != null) return Number(perso[String(cm)]); var b = buche(cm); return b ? b.coef : null; }
function nomBuche(cm) { var b = buche(cm); return b ? b.nom : (cm + ' cm'); }

function typePile(codes) {
  var vus = {};
  (codes || []).forEach(function (c) { var e = essence(c); if (e) vus[e.t] = 1; });
  var k = Object.keys(vus);
  if (!k.length) return null;
  return k.length === 1 ? k[0] : 'mixte';
}
function nb(v) { if (v == null || v === '') return 0; var n = parseFloat(String(v).replace(/[\s\u00A0]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
function arr(n, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(n * p) / p; }

/* --------------------------------------------------- dimensions & volume */
/* Côtés de la pile : chaque côté a une longueur et une ou plusieurs hauteurs
   (moyennées). Côté A obligatoire, côté B optionnel si la pile est irrégulière. */
function cotes(p) {
  if (p && p.cotes && p.cotes.length) {
    return p.cotes.filter(function (c) { return nb(c.lon) > 0 && moyHauteurs(c) > 0; });
  }
  if (p && p.sections && p.sections.length) {   // rétrocompat
    return p.sections.filter(function (s) { return nb(s.lon) > 0 && nb(s.hau) > 0; })
      .map(function (s) { return { lon: s.lon, hauteurs: [s.hau] }; });
  }
  if (p && nb(p.longueur) > 0 && nb(p.hauteur) > 0) return [{ lon: p.longueur, hauteurs: [p.hauteur] }];
  return [];
}
function moyHauteurs(cote) {
  var hs = (cote.hauteurs || []).map(nb).filter(function (h) { return h > 0; });
  if (!hs.length) return 0;
  return hs.reduce(function (t, h) { return t + h; }, 0) / hs.length;
}
function longueurMoyenne(p) {
  var cs = cotes(p); if (!cs.length) return 0;
  return arr(cs.reduce(function (t, c) { return t + nb(c.lon); }, 0) / cs.length, 2);
}
function hauteurMoyenne(p) {
  var cs = cotes(p); if (!cs.length) return 0;
  return arr(cs.reduce(function (t, c) { return t + moyHauteurs(c); }, 0) / cs.length, 2);
}
function volumeEmpile(p) {
  if (p && p.steresManuel != null) return arr(nb(p.steresManuel) * (coefBuche(p.buche) || 1), 3);
  var larg = nb(p.buche) / 100;
  return arr(longueurMoyenne(p) * hauteurMoyenne(p) * larg, 3);
}
function steres(p, perso) {
  if (p && p.steresManuel != null) return arr(nb(p.steresManuel), 2);
  var c = coefBuche(p.buche, perso);
  if (!c) return 0;
  return arr(volumeEmpile(p) / c, 2);
}
function sorti(p) { return arr(((p && p.mouvements) || []).reduce(function (t, m) { return t + nb(m.st); }, 0), 2); }
function restant(p, perso) { return arr(Math.max(0, steres(p, perso) - sorti(p)), 2); }

/* ------------------------------------------------------ essences & poids */
function partsEssences(p) {
  var codes = (p && p.essences) || [];
  if (!codes.length) return [];
  var pc = (p && p.pourcents) || {};
  var somme = codes.reduce(function (t, c) { return t + (nb(pc[c]) || 0); }, 0);
  if (somme > 0) return codes.map(function (c) { return { code: c, part: (nb(pc[c]) || 0) / somme }; });
  return codes.map(function (c) { return { code: c, part: 1 / codes.length }; });
}
function repartitionPile(p) {
  var r = { dur: 0, blanc: 0, res: 0, mixte: 0 }, reste = restant(p);
  partsEssences(p).forEach(function (x) { var e = essence(x.code); if (e) r[e.t] += reste * x.part; });
  return r;
}
function poids(st, type) { return arr(st * (POIDS_TYPE[type] || 0.5), 2); }
function poidsPile(p) {
  var rep = repartitionPile(p), t = 0;
  ['dur', 'blanc', 'res', 'mixte'].forEach(function (k) { t += rep[k] * (POIDS_TYPE[k] || 0.5); });
  return arr(t, 2);
}
function valeur(p, perso) { var pu = nb(p && p.prix); return pu > 0 ? arr(restant(p, perso) * pu, 2) : 0; }
function valeurStock(piles, perso) { return arr((piles || []).reduce(function (t, p) { return t + valeur(p, perso); }, 0), 2); }

/* --------------------------------------------------------------- humidité */
function derniereMesure(p) {
  var m = (p && p.mesures) || [];
  if (!m.length) return null;
  return m.slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); })[0];
}
function seuils(cfg) {
  var s = (cfg && cfg.seuils) || {};
  return {
    vert: s.vert != null ? s.vert : SEUILS_DEFAUT.vert,
    sec: s.sec != null ? s.sec : SEUILS_DEFAUT.sec,
    tresSec: s.tresSec != null ? s.tresSec : SEUILS_DEFAUT.tresSec
  };
}
function classe(taux, s) {
  if (taux > s.vert) return 'vert';
  if (taux > s.sec) return 'sechage';
  if (taux > s.tresSec) return 'sec';
  return 'tressec';
}
var LIBELLE = { vert: 'Vert', sechage: 'En séchage', sec: 'Sec', tressec: 'Très sec', inconnu: 'Sans donnée', presume: 'Présumé sec' };

/* Tendance de séchage : régression pondérée sur TOUTES les mesures, les
   récentes pesant plus (demi-vie 90 j) car le séchage ralentit en fin. */
function tendance(mesures, seuilSec) {
  var pts = (mesures || []).filter(function (m) { return m.date && m.taux != null; })
    .sort(function (a, b) { return a.date - b.date; });
  if (pts.length < 2) return null;
  var t0 = pts[0].date, dernier = pts[pts.length - 1], demiVie = 90 * JOUR;
  var sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
  pts.forEach(function (m) {
    var x = (m.date - t0) / JOUR, y = nb(m.taux), w = Math.pow(2, (m.date - dernier.date) / demiVie);
    sw += w; swx += w * x; swy += w * y; swxx += w * x * x; swxy += w * x * y;
  });
  var denom = sw * swxx - swx * swx;
  if (Math.abs(denom) < 1e-9) return null;
  var a = (sw * swxy - swx * swy) / denom, b = (swy - a * swx) / sw;
  if (a >= -1e-6) return { pente: a, secheVers: null };
  var dateSec = t0 + ((seuilSec - b) / a) * JOUR;
  return { pente: a, secheVers: dateSec, tauxActuel: nb(dernier.taux), dateActuel: dernier.date };
}

function estimeTheorique(e, p, mois, maintenant, cfg) {
  var attendu = SECHAGE[typePile(p.essences) || 'mixte'] || 24;
  /* La durée annoncée vaut pour du bois vert. Une pile partie de plus bas a
     moins de chemin à faire : on réduit la durée dans la même proportion. */
  var s = seuils(cfg), d = depart(cfg);
  var course = d.vert - s.sec;
  if (course > 0) {
    var reste0 = humiditeDepart(p, cfg) - s.sec;
    attendu = Math.max(0, arr(attendu * Math.max(0, reste0) / course, 1));
  }
  e.attendu = attendu;
  var reste = attendu - mois;
  if (reste > 0) {
    e.secheVers = maintenant + reste * MOIS;
    e.joursRestants = Math.round(reste * MOIS / JOUR);
    e.methode = 'theorique';
  }
}
function etat(p, maintenant, cfg) {
  var s = seuils(cfg), m = derniereMesure(p);
  var mois = p && p.empile ? Math.max(0, Math.floor((maintenant - p.empile) / MOIS)) : null;
  if (m) {
    var cl = classe(nb(m.taux), s);
    var e = { statut: cl, mesure: true, taux: nb(m.taux), mois: mois, texte: LIBELLE[cl] + ' — ' + arr(nb(m.taux), 1) + ' %' };
    if (cl === 'sec' || cl === 'tressec') { e.sec = true; return e; }
    var t = tendance(p.mesures, s.sec);
    if (t && t.secheVers) {
      e.secheVers = t.secheVers;
      e.joursRestants = Math.max(0, Math.round((t.secheVers - maintenant) / JOUR));
      e.methode = 'mesures';
    } else if (mois != null) { estimeTheorique(e, p, mois, maintenant, cfg); }
    return e;
  }
  if (mois == null) return { statut: 'inconnu', mesure: false, mois: null, texte: LIBELLE.inconnu };
  var e2 = { statut: 'sechage', mesure: false, mois: mois, texte: '' };
  estimeTheorique(e2, p, mois, maintenant, cfg);
  var attendu = e2.attendu != null ? e2.attendu : (SECHAGE[typePile(p.essences) || 'mixte'] || 24);
  if (mois >= attendu) { e2.statut = 'presume'; e2.texte = 'Présumé sec après ' + mois + ' mois — à vérifier'; e2.sec = true; }
  else { e2.texte = mois > 0 ? 'En séchage depuis ' + mois + ' mois' : 'Empilée récemment'; }
  return e2;
}

/* ------------------------------------------------------------------- stock */
function repartition(piles, perso) {
  var r = { dur: 0, blanc: 0, res: 0, mixte: 0, total: 0, piles: (piles || []).length };
  (piles || []).forEach(function (p) {
    var rep = repartitionPile(p);
    ['dur', 'blanc', 'res', 'mixte'].forEach(function (k) { r[k] += rep[k]; });
    r.total += restant(p, perso);
  });
  ['dur', 'blanc', 'res', 'mixte', 'total'].forEach(function (k) { r[k] = arr(r[k], 2); });
  return r;
}
function pourcent(part, total) { return total > 0 ? Math.round(part / total * 100) : 0; }

/* ------------------------------------------------------------- vert / sec */
function depart(cfg) {
  var d = (cfg && cfg.depart) || {};
  return {
    vert: nb(d.vert) || DEPART_DEFAUT.vert,
    sec: nb(d.sec) || DEPART_DEFAUT.sec
  };
}
/* Ce que contient la pile : que du vert, que du bois mort, ou les deux. */
function composition(p) {
  var e = p && p.etatBois;
  if (e !== 'vert' && e !== 'sec' && e !== 'mixte') return null;
  var pv = e === 'vert' ? 100 : e === 'sec' ? 0 : Math.max(0, Math.min(100, nb(p.partVert)));
  return { etat: e, partVert: pv, partSec: arr(100 - pv, 0) };
}
function libelleComposition(p) {
  var c = composition(p);
  if (!c) return '';
  if (c.etat === 'vert') return 'bois vert';
  if (c.etat === 'sec') return 'bois mort';
  return c.partVert + ' % vert, ' + c.partSec + ' % mort';
}
/* L'humidité qui commande le séchage, c'est la plus élevée des deux : la
   pile n'est prête que quand sa part la plus humide l'est. */
function humiditeDepart(p, cfg) {
  var c = composition(p), d = depart(cfg);
  if (!c) return nb(p && p.humidite) || d.vert;
  var v = c.partVert > 0 ? (nb(p.humiditeVert) || d.vert) : null;
  var sc = c.partSec > 0 ? (nb(p.humiditeSec) || d.sec) : null;
  return Math.max(v || 0, sc || 0) || d.vert;
}
function disponible(piles, maintenant, cfg) {
  var pret = 0, attente = 0;
  (piles || []).forEach(function (p) {
    var e = etat(p, maintenant, cfg), st = restant(p);
    if (e.sec) pret += st; else attente += st;
  });
  return { pret: arr(pret, 2), attente: arr(attente, 2) };
}

var M = {
  MOIS: MOIS, JOUR: JOUR, BUCHES: BUCHES, ESSENCES: ESSENCES, TYPES: TYPES,
  SECHAGE: SECHAGE, SEUILS_DEFAUT: SEUILS_DEFAUT, POIDS_TYPE: POIDS_TYPE, LIBELLE: LIBELLE,
  essence: essence, nomEssence: nomEssence, buche: buche, coefBuche: coefBuche, nomBuche: nomBuche,
  typePile: typePile, nb: nb, arr: arr,
  DEPART_DEFAUT: DEPART_DEFAUT, depart: depart, composition: composition,
  libelleComposition: libelleComposition, humiditeDepart: humiditeDepart,
  cotes: cotes, moyHauteurs: moyHauteurs, longueurMoyenne: longueurMoyenne, hauteurMoyenne: hauteurMoyenne,
  volumeEmpile: volumeEmpile, steres: steres, sorti: sorti, restant: restant,
  partsEssences: partsEssences, repartitionPile: repartitionPile, poids: poids, poidsPile: poidsPile,
  valeur: valeur, valeurStock: valeurStock,
  derniereMesure: derniereMesure, seuils: seuils, classe: classe, tendance: tendance, etat: etat,
  repartition: repartition, pourcent: pourcent, disponible: disponible
};
if (typeof window !== 'undefined') window.BCH = M;
if (typeof module === 'object' && module.exports) module.exports = M;

})();

