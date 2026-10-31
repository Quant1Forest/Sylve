/* ==========================================================  CALENDRIER
   Un chantier occupe des journées. Tant que le devis n'est pas accepté,
   ces journées sont provisoires ; une fois accepté (ou sur accord verbal,
   c'est-à-dire créé directement à 'accepte'/'encours'), elles sont fermes. */
function jourCle(ts) {
  var d = new Date(ts);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function minuit(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
/* Un jour est une case du calendrier : les jours de changement d'heure en
   font 23 ou 25 heures, et ajouter 86 400 000 ms décalait toute la suite d'un
   cran (la veille disparaissait de la fenêtre des journées à trancher). */
function ajouteJours(ts, n) { var d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); }
function lendemain(ts) { return ajouteJours(ts, 1); }
function estWeekend(ts) { var j = new Date(ts).getDay(); return j === 0 || j === 6; }

/* Journées prévues d'un chantier.
   Priorité aux journées explicitement placées sur le calendrier : un chantier
   se travaille rarement d'une traite (un jeudi ici, deux jours la semaine
   suivante). À défaut, on retombe sur début/fin ou sur les journées estimées. */
/* Journées placées : chacune porte sa part de journée — une journée entière
   ou une demi-journée, parce qu'on ne remplit pas toujours ses huit heures
   sur le même chantier. Format { d: jour, p: part }.
   L'ancien format (simple liste de dates) est relu comme des journées entières. */
function journeesPlacees(ch) {
  var m = {};
  ((ch && ch.jours) || []).forEach(function (x) {
    var ts, p;
    if (x && typeof x === 'object') { ts = minuit(x.d); p = nb(x.p) || 1; }
    else { ts = minuit(x); p = 1; }
    if (!ts || isNaN(ts)) return;
    m[ts] = p;
  });
  return Object.keys(m).map(Number).sort(function (a, b) { return a - b; })
    .map(function (ts) { return { d: ts, p: m[ts] }; });
}
function totalPlace(ch) {
  return arr(journeesPlacees(ch).reduce(function (s, j) { return s + nb(j.p); }, 0), 2);
}
function partDuJour(ch, ts) {
  var j = minuit(ts);
  var t = journeesPlacees(ch).filter(function (x) { return x.d === j; })[0];
  return t ? t.p : 0;
}
/* Sans part précisée, on fait tourner : journée entière → demi → retirée.
   Un seul geste répété suffit à corriger, sans menu. */
function placerJour(ch, ts, part) {
  var j = minuit(ts);
  var l = journeesPlacees(ch).filter(function (x) { return x.d !== j; });
  var actuel = partDuJour(ch, ts);
  var p;
  if (part != null) p = nb(part);
  else p = actuel === 0 ? 1 : (actuel === 1 ? 0.5 : 0);
  if (p > 0) l.push({ d: j, p: p });
  ch.jours = l.sort(function (a, b) { return a.d - b.d; });
  return totalPlace(ch);
}
/* Une journée posée sur une date passée n'est plus une prévision : elle a eu
   lieu. La distinction compte quand on saisit après coup un chantier déjà
   fait — tout y est « placé », rien n'y est à venir, et parler d'estimation
   n'aurait aucun sens.
   Attention : « faite » dit qu'on y était, pas combien d'heures on y a passé.
   Les rendements continuent de se calculer sur les temps saisis, jamais sur
   ces journées-là. */
function journeesFaites(ch, maintenant) {
  var jour = minuit(maintenant || Date.now());
  return journeesPlacees(ch).filter(function (j) { return minuit(j.d) <= jour; });
}
function journeesAVenir(ch, maintenant) {
  var jour = minuit(maintenant || Date.now());
  return journeesPlacees(ch).filter(function (j) { return minuit(j.d) > jour; });
}
function totalFait(ch, maintenant) {
  return arr(journeesFaites(ch, maintenant).reduce(function (s, j) { return s + nb(j.p); }, 0), 2);
}
function totalAVenir(ch, maintenant) {
  return arr(journeesAVenir(ch, maintenant).reduce(function (s, j) { return s + nb(j.p); }, 0), 2);
}

/* Les journées que le chantier demande. Quand une ligne est libellée en
   journées, c'est le devis qui le dit — les ressaisir à la main faisait deux
   chiffres pour une même idée, et c'est exactement ce qui l'y perdait :
   « il y a trop d'endroits où je peux mettre du temps ».
   Les autres unités — l'hectare, le plant — ne disent rien du temps : là,
   l'estimation reste la sienne. Jamais l'addition des deux, pour la même
   raison que tempsPasse() ne cumule pas le noté et le facturé. */
/* Les heures d'une saisie de temps, quelle que soit l'unité dans laquelle
   elle a été notée. Les anciennes saisies parlent parfois en journées. */
function heuresSaisie(t, cfg) {
  return arr((t && t.unite === 'h') ? nb(t.duree) : nb(t && t.duree) * HEURES_JOUR(cfg), 2);
}
/* « 2 j 4 h », jamais « 2,4 j ». Avec des journées de huit heures, la virgule
   ne se relit pas : « quatre heures ici, trois là, cinq ici, sept là, au final
   j'ai trois virgule quelque chose ». Un jour est une journée entière, le
   reste se dit en heures. */
function ditDuree(heures, cfg) {
  var hj = HEURES_JOUR(cfg) || 8, tot = arr(heures, 2);
  if (!tot) return '—';
  var j = Math.floor(tot / hj), h = arr(tot - j * hj, 2);
  var p = [];
  if (j) p.push(j + ' j');
  if (h) p.push(String(arr(h, 1)).replace('.', ',') + ' h');
  return p.join(' ');
}
function joursDevis(ch) {
  var j = 0;
  ((ch && ch.lignes) || []).forEach(function (l) {
    if (l.unite === 'jour') j += nb(l.quantite);
  });
  return arr(j, 2);
}
function joursPrevus(ch) {
  var d = joursDevis(ch);
  return d > 0 ? d : nb(ch && ch.joursEstimes);
}
/* Ce que l'estimation déduite ne couvre pas : les prestations chiffrées
   autrement qu'à la journée. Les nommer évite de croire que le chiffre parle
   de tout le chantier. */
function travauxHorsJournees(ch) {
  var out = [];
  ((ch && ch.lignes) || []).forEach(function (l) {
    if (l.unite === 'jour' || l.nature === 'vente' || l.nature === 'debours') return;
    var n = nomTravauxLigne(l);
    if (n && out.indexOf(n) < 0) out.push(n);
  });
  return out;
}
/* Reste à placer par rapport à l'estimation. */
function resteAPlacer(ch) {
  var vise = joursPrevus(ch) || 0;
  if (!vise) return null;
  return arr(vise - totalPlace(ch), 2);
}
function journeesPrevues(ch, cfg) {
  if (!ch) return [];
  var placees = journeesPlacees(ch);
  if (placees.length) return placees.map(function (x) { return x.d; });
  /* Rien n'est programmé tant que les journées ne sont pas placées :
     mieux vaut un agenda vide qu'un bloc inventé de A à B. */
  if (!ch.debut) return [];
  var ouvresSeuls = !(cfg && cfg.weekends);
  var out = [], d = minuit(ch.debut);
  /* fin incohérente (antérieure au début) : on l'ignore et on retombe
     sur les journées estimées, plutôt que de n'afficher aucun jour. */
  if (ch.fin && minuit(ch.fin) >= d) {
    var f = minuit(ch.fin), garde = 0;
    while (d <= f && garde++ < 400) {
      if (!ouvresSeuls || !estWeekend(d)) out.push(d);
      d = lendemain(d);
    }
    return out;
  }
  var n = Math.ceil(joursPrevus(ch) || 0), garde2 = 0;
  if (!n) return [d];
  while (out.length < n && garde2++ < 400) {
    if (!ouvresSeuls || !estWeekend(d)) out.push(d);
    d = lendemain(d);
  }
  return out;
}
/* Un jour est « ferme » si le chantier est engagé, « provisoire » sinon. */
function fermeteDe(ch) { return statutEngage(ch.statut) ? 'ferme' : 'provisoire'; }

/* Occupation d'une période : pour chaque jour, les chantiers prévus et le
   temps réellement saisi ce jour-là. */
function occupation(chantiers, debut, fin, cfg) {
  var jours = {};
  var d = minuit(debut), f = minuit(fin), garde = 0;
  while (d <= f && garde++ < 800) { jours[jourCle(d)] = { ts: d, prevus: [], reels: [] }; d = lendemain(d); }
  (chantiers || []).forEach(function (ch) {
    if (['sansuite'].indexOf(ch.statut) >= 0) return;
    journeesPrevues(ch, cfg).forEach(function (j) {
      var k = jourCle(j);
      if (jours[k]) jours[k].prevus.push({ chantier: ch, fermete: fermeteDe(ch) });
    });
    journeesPlacees(ch).forEach(function (x) {
      var k = jourCle(x.d);
      if (jours[k]) {
        var p = jours[k].prevus.filter(function (y) { return y.chantier === ch; })[0];
        if (p) p.part = x.p;
      }
    });
    (ch.temps || []).forEach(function (t) {
      var k = jourCle(t.date);
      if (jours[k]) jours[k].reels.push({ chantier: ch, temps: t, jours: joursSaisie(t, cfg) });
    });
  });
  return jours;
}
/* La fiche de chantier est obligatoire — décret n° 2010-1603 du 17 décembre
   2010, arrêté du 31 mars 2011. Les risques sont numérotés comme sur le
   modèle papier : la légende du croquis demande de reporter le numéro sous
   chaque symbole, un ordre à nous n'aurait servi personne. */
var RISQUES_FICHE = [
  { g: 'terrain', n: 'Caractéristiques du terrain', l: [
    [1, 'Déclivité'], [2, 'Précipices'], [3, 'Failles'], [4, 'Barres rocheuses'],
    [5, 'Zones humides'], [6, 'Plans d’eau'], [7, 'Cours d’eau'], [8, 'Sources']] },
  { g: 'ouvrages', n: 'Ouvrages', l: [
    [9, 'Lignes électriques aériennes'], [10, 'Lignes électriques enterrées'],
    [11, 'Conduites d’eau ou d’autres fluides'], [12, 'Pièces d’eau'],
    [13, 'Fossés d’irrigation'], [14, 'Gazoducs'], [15, 'Oléoducs'],
    [16, 'Conduites forcées de centrales hydroélectriques']] },
  { g: 'voies', n: 'Voies de circulation', l: [
    [17, 'Voies accessibles aux véhicules motorisés'], [18, 'Chemins balisés'],
    [19, 'Canaux'], [20, 'Pistes et installations de ski'], [21, 'Voies ferrées']] },
  { g: 'divers', n: 'Ouvrages divers', l: [
    [22, 'Bâtiments'], [23, 'Puits et ouvrages divers'], [24, 'Carrières'],
    [25, 'Vestiges miniers ou militaires'],
    [26, 'Restes de conflits armés, chasse, zones piégées']] },
  { g: 'sanitaire', n: 'État sanitaire du peuplement', l: [
    [27, 'Chablis massifs, arbres perchés'], [28, 'Arbres morts ou dépérissants'],
    [29, 'Arbres atteints d’affections dangereuses']] },
  { g: 'bio', n: 'Risques biologiques', l: [
    [30, 'Tiques (Lyme, hantavirose, encéphalite)'],
    [31, 'Rongeurs et mammifères (leptospirose)'],
    [32, 'Chiens, renards (échinococcose, rage)'],
    [33, 'Chenilles, frelons, guêpes, abeilles']] }
];
/* « Des fois tu captes, mais pas beaucoup. » Oui / Non ne suffisait pas :
   c'est sur cette nuance que se décide où l'on court pour donner l'alerte. */
var RESEAUX_FICHE = [
  { c: 'excellente', n: 'Excellente' }, { c: 'bonne', n: 'Bonne' },
  { c: 'moyenne', n: 'Moyenne' }, { c: 'mauvaise', n: 'Mauvaise' },
  { c: 'aucune', n: 'Aucune' }
];
function nomReseau(c) { var x = trouve(RESEAUX_FICHE, c); return x ? x.n : ''; }
function nomRisque(num) {
  for (var i = 0; i < RISQUES_FICHE.length; i++) {
    var l = RISQUES_FICHE[i].l;
    for (var j = 0; j < l.length; j++) if (l[j][0] === Number(num)) return l[j][1];
  }
  return '';
}
function fiche(ch) { return (ch && ch.fiche) || {}; }
function risquesCoches(ch, groupe) {
  var f = fiche(ch), out = [];
  RISQUES_FICHE.forEach(function (g) {
    if (groupe && g.g !== groupe) return;
    g.l.forEach(function (r) {
      if ((f.risques || []).indexOf(r[0]) >= 0) out.push({ num: r[0], nom: r[1], g: g.g });
    });
  });
  return out;
}
/* Ce qui manque pour que la fiche soit valable. Elle s'imprime quand même —
   une fiche incomplète sur le chantier vaut mieux qu'aucune fiche — mais
   elle dit ce qui manque, en clair, à la place du blanc. */
var CHAMPS_FICHE_CH = [
  { c: 'proprietaire', n: 'le propriétaire' },
  { c: 'commune', n: 'la commune' },
  { c: 'departement', n: 'le département' },
  { c: 'foret', n: 'le lieu-dit ou la forêt' },
  { c: 'parcelles', n: 'les parcelles' }
];
function manquesFiche(ch, cfg) {
  var out = [];
  CHAMPS_FICHE_CH.forEach(function (x) {
    if (!String((ch && ch[x.c]) || '').trim()) out.push(x.n);
  });
  var f = fiche(ch);
  if (!f.debut) out.push('la période d’intervention');
  if (!String(f.acces || '').trim()) out.push('les moyens d’accès');
  if (!String(f.pointRencontre || '').trim()) out.push('le point de rencontre');
  if (!String((cfg && cfg.siret) || '').trim()) out.push('votre SIRET');
  if (!String((cfg && cfg.telEntreprise) || '').trim()) out.push('votre téléphone');
  return out;
}
/* « Ce ne sera que les quatre hectares : je ne fais que du sylvicole. » Le
   seuil des cent mètres cubes existe dans la loi, il ne le rencontrera
   jamais. Sylve annonce donc celui qu'il peut atteindre, et rien d'autre. */
var SEUIL_FICHE_HA = 4;
function ficheRequise(ch) { return quantite(ch, 'ha') > SEUIL_FICHE_HA; }

/* Un jour porte exactement UN statut. La case du calendrier en empilait
   jusqu'à trois : un chantier provisoire, un chantier ferme et du temps
   saisi pouvaient s'y superposer, et trois pastilles ne disent plus rien.

   Le statut ne se stocke pas : il se déduit de ce qui existe déjà — les
   journées posées sur les chantiers, le temps saisi, et la seule chose qui
   n'était écrite nulle part, l'absence. Un statut stocké en plus aurait
   fait deux endroits pour une même idée, et il aurait fallu les tenir
   d'accord : c'est l'erreur que ce projet a déjà payée. Rien à migrer non
   plus — les données existantes rendent leur statut telles quelles.

   L'ordre compte : ce qui a eu lieu l'emporte sur ce qui était prévu, et
   une absence posée à la main l'emporte sur un chantier resté au planning
   — c'est un geste délibéré, la fiche du jour signale alors le chantier à
   déplacer. */
var STATUTS_JOUR = [
  { c: 'travaille', n: 'Travaillé', coul: '#1D6FB8', aide: 'ce que vous y avez fait' },
  { c: 'absent', n: 'Non travaillé', coul: '#8E8878', aide: 'congé, arrêt, intempérie' },
  { c: 'confirme', n: 'Confirmé', coul: '#2E7D46', aide: 'devis signé ou accord verbal' },
  { c: 'prevu', n: 'Prévu', coul: '#B98A00', aide: 'devis encore en attente' },
  { c: 'libre', n: 'Libre', coul: '#B8AB95', aide: 'rien de posé' }
];
function nomStatutJour(c) { var x = trouve(STATUTS_JOUR, c); return x ? x.n : ''; }
function coulStatutJour(c) { var x = trouve(STATUTS_JOUR, c); return x ? x.coul : '#B8AB95'; }
function estAbsent(absences, ts) {
  var k = jourCle(ts);
  return (absences || []).filter(function (a) { return jourCle(a.d) === k; })[0] || null;
}
/* Le statut d'un jour, d'après ce qui s'y rattache. « occ » est l'entrée
   d'occupation() pour ce jour ; on la passe pour ne pas la recalculer une
   fois par case du mois. */
function statutJour(occ, absences, ts) {
  var o = occ || { prevus: [], reels: [] };
  if ((o.reels || []).length) return 'travaille';
  if (estAbsent(absences, ts)) return 'absent';
  if ((o.prevus || []).some(function (p) { return p.fermete === 'ferme'; })) return 'confirme';
  if ((o.prevus || []).length) return 'prevu';
  return 'libre';
}
/* Un jour prévu ou confirmé que la date a dépassé sans qu'on ait dit ce qui
   s'y est passé. « Pas de jour prévu qui reste indéfiniment dans le passé
   sans statut final. » Le jour même n'est pas fini : on ne réclame rien
   avant demain. */
function joursAResoudre(chantiers, cfg, absences, maintenant) {
  var m = minuit(maintenant), out = [];
  var debut = m - 400 * JOUR;
  /* La fenêtre s'arrête la veille : le jour même n'est pas fini, on ne
     réclame rien avant demain. C'est la seule garde — une seconde, à
     l'intérieur de la boucle, disait la même chose et empêchait de vérifier
     celle-ci en la cassant. */
  var occ = occupation(chantiers, debut, m - JOUR, cfg);
  Object.keys(occ).forEach(function (k) {
    var o = occ[k];
    var st = statutJour(o, absences, o.ts);
    if (st !== 'prevu' && st !== 'confirme') return;
    out.push({ d: o.ts, statut: st,
      chantiers: o.prevus.map(function (p) { return p.chantier; }) });
  });
  return out.sort(function (a, b) { return a.d - b.d; });
}
/* Charge d'un mois : jours ouvrés occupés, fermes et provisoires. */
function chargeMois(chantiers, annee, mois, cfg) {
  var debut = new Date(annee, mois, 1).getTime();
  var fin = new Date(annee, mois + 1, 0).getTime();
  var occ = occupation(chantiers, debut, fin, cfg);
  var r = { fermes: 0, provisoires: 0, travailles: 0, joursReels: 0 };
  Object.keys(occ).forEach(function (k) {
    var j = occ[k];
    var part = function (f) {
      return j.prevus.filter(function (p) { return p.fermete === f; })
        .reduce(function (s, p) { return s + (p.part != null ? nb(p.part) : 1); }, 0);
    };
    r.fermes += part('ferme');
    r.provisoires += part('provisoire');
    if (j.reels.length) { r.travailles++; r.joursReels += j.reels.reduce(function (s, x) { return s + x.jours; }, 0); }
  });
  r.fermes = arr(r.fermes, 2); r.provisoires = arr(r.provisoires, 2);
  r.joursReels = arr(r.joursReels, 2);
  return r;
}

