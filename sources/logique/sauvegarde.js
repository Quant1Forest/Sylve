/* ==========================================================================
   Sylve — sauvegarde et récupération (logique pure, sans DOM)
   ========================================================================== */
(function () {
'use strict';

var JOUR = 86400000;
var MAX_INSTANTANES = 7;      // une semaine de photos quotidiennes
var JOURS_POUBELLE = 30;      // délai avant effacement réel

function jour(ts) {
  var d = new Date(ts);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
function cleInstantane(ts) { return 'bordcub.snap.' + jour(ts); }
function clePoubelle(id) { return 'bordcub.poubelle.' + id; }

/* Parmi les clés d'instantanés existantes, celles à effacer pour n'en
   garder que les `max` plus récentes (les clés sont triables telles quelles). */
function rotation(cles, max) {
  var s = cles.filter(function (k) { return k.indexOf('bordcub.snap.') === 0; }).sort();
  var trop = s.length - (max || MAX_INSTANTANES);
  return trop > 0 ? s.slice(0, trop) : [];
}

/* Entrées de corbeille dont le délai est écoulé. entrees : [{cle, suppr}] */
function aPurger(entrees, maintenant, jours) {
  var limite = maintenant - (jours == null ? JOURS_POUBELLE : jours) * JOUR;
  return entrees.filter(function (e) { return !e.suppr || e.suppr < limite; })
    .map(function (e) { return e.cle; });
}

var FORMAT_SAUVEGARDE = 'bordcub-sauvegarde-1';

function construireSauvegarde(cfg, bordereaux, piles, chantiers, depenses, clients, articles, charges, proprios, fournisseurs, commandes, sorties, journees, versements, vehicule, achats) {
  return {
    format: FORMAT_SAUVEGARDE,
    version: 9,
    date: new Date().toISOString(),
    config: cfg || null,
    bordereaux: (bordereaux || []).filter(Boolean),
    piles: (piles || []).filter(Boolean),
    chantiers: (chantiers || []).filter(Boolean),
    depenses: (depenses || []).filter(Boolean),
    clients: (clients || []).filter(Boolean),
    articles: (articles || []).filter(Boolean),
    charges: (charges || []).filter(Boolean),
    proprios: (proprios || []).filter(Boolean),
    fournisseurs: (fournisseurs || []).filter(Boolean),
    commandes: (commandes || []).filter(Boolean),
    sorties: (sorties || []).filter(Boolean),
    journees: (journees || []).filter(Boolean),
    versements: (versements || []).filter(Boolean),
    vehicule: vehicule || null,
    achats: (achats || []).filter(Boolean)
  };
}

/* Accepte les deux formats : sauvegarde complète, ou bordereau seul
   (format historique « bordcub-1 »). Renvoie null si illisible. */
function lireSauvegarde(o) {
  if (!o || typeof o !== 'object') return null;
  if (o.format === FORMAT_SAUVEGARDE || Array.isArray(o.bordereaux) ||
    Array.isArray(o.piles) || Array.isArray(o.chantiers)) {
    var r = { config: o.config || null,
      bordereaux: (o.bordereaux || []).filter(function (x) { return x && Array.isArray(x.lignes); }),
      piles: (o.piles || []).filter(function (x) { return x && x.nom != null; }),
      chantiers: (o.chantiers || []).filter(function (x) { return x && x.nom != null; }),
      depenses: (o.depenses || []).filter(Boolean), clients: (o.clients || []).filter(Boolean),
      articles: (o.articles || []).filter(Boolean), charges: (o.charges || []).filter(Boolean),
      proprios: (o.proprios || []).filter(Boolean),
      fournisseurs: (o.fournisseurs || []).filter(Boolean),
      commandes: (o.commandes || []).filter(Boolean),
      sorties: (o.sorties || []).filter(Boolean),
      journees: (o.journees || []).filter(Boolean),
      versements: (o.versements || []).filter(Boolean),
      achats: (o.achats || []).filter(Boolean),
      vehicule: o.vehicule || null, complete: true };
    /* Une sauvegarde peut ne contenir que du stock ou que des dépenses : la
       refuser faute de bordereau revenait à interdire l'import à qui ne fait
       pas de cubage. */
    var vide = true;
    ['bordereaux', 'piles', 'chantiers', 'depenses', 'clients', 'articles',
      'charges', 'proprios', 'fournisseurs', 'commandes', 'sorties', 'journees',
      'versements', 'achats'].forEach(function (k) {
        if (r[k].length) vide = false;
      });
    /* Le carnet du véhicule est un objet, pas une liste : oublié de ce compte,
       un fichier n'en portant que lui était rejeté comme illisible. */
    if (r.vehicule && ((r.vehicule.interventions || []).length ||
      (r.vehicule.postes || []).length || (r.vehicule.releves || []).length)) vide = false;
    return vide ? null : r;
  }
  var seul = o.bordereau || o;
  if (seul && Array.isArray(seul.lignes)) {
    return { config: o.config || null, bordereaux: [seul], piles: [], chantiers: [], complete: false };
  }
  return null;
}

/* « il y a 3 jours », pour l'indicateur de sauvegarde. Le compte se fait en
   jours de calendrier, jamais en millisecondes : une sauvegarde faite hier à
   23 h et relue ce matin à 8 h ne fait pas « zéro jour ». Ce bloc s'exporte
   aussi vers Node, donc il ne peut pas s'appuyer sur C.minuit. */
function depuisQuand(ts, maintenant) {
  if (!ts) return null;
  var a = new Date(maintenant); a.setHours(0, 0, 0, 0);
  var b = new Date(ts); b.setHours(0, 0, 0, 0);
  var d = Math.round((a.getTime() - b.getTime()) / JOUR);
  if (d <= 0) return 'aujourd’hui';
  if (d === 1) return 'hier';
  if (d < 31) return 'il y a ' + d + ' jours';
  var m = Math.floor(d / 30);
  return 'il y a ' + m + ' mois';
}
/* Au-delà d'une semaine sans sauvegarde extérieure, on alerte. */
function sauvegardeAncienne(ts, maintenant) {
  return !ts || (maintenant - ts) > 30 * JOUR;
}

function octets(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' o';
  if (n < 1048576) return (n / 1024).toFixed(0) + ' Ko';
  return (n / 1048576).toFixed(1) + ' Mo';
}

window.BCB = {
  JOUR: JOUR, MAX_INSTANTANES: MAX_INSTANTANES, JOURS_POUBELLE: JOURS_POUBELLE,
  jour: jour, cleInstantane: cleInstantane, clePoubelle: clePoubelle,
  rotation: rotation, aPurger: aPurger,
  construireSauvegarde: construireSauvegarde, lireSauvegarde: lireSauvegarde,
  depuisQuand: depuisQuand, sauvegardeAncienne: sauvegardeAncienne, octets: octets
};
if (typeof module === 'object' && module.exports) module.exports = window.BCB;

})();

