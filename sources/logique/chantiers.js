var JOUR = 86400000;

/* Travaux sylvicoles et fournitures.
   tvaSans / tvaAvec : taux selon que la prestation est fournie à un
   exploitant agricole ou forestier identifié (n° SIREN) ou non.
   Source : BOI-ANNX-000509 du 28/05/2025, annexe TVA du secteur de la
   sylviculture, complétée du b septies de l'article 279 du CGI.
   Le taux réduit de 10 % sur les travaux forestiers cesse au 1/1/2029. */
/* Ses grandes familles, au-dessus des prestations. TRAVAUX correspond à ce
   qu'il appelle ses sous-catégories : il manquait l'étage du dessus, celui
   sur lequel il fait ses analyses.
   Elles sont cinq et non sept : « Fourniture » et « Débours client », qu'il
   citait aussi, existent déjà comme nature de ligne — et la nature décide de
   l'abattement fiscal. Les redire ici ferait deux champs pour la même chose,
   qui finiraient par se contredire. categorieLigne() recompose ses sept.
   Le rangement livré n'est qu'un défaut : chaque travail porte sa famille
   dans les réglages, et elle s'y change. */
var CAT_TRAVAUX = [
  { c: 'gestion', n: 'Journées de gestion' },
  { c: 'plantation', n: 'Travaux de plantation' },
  { c: 'sylvicole', n: 'Travaux d’amélioration sylvicole' },
  { c: 'gibier', n: 'Protection gibier' },
  { c: 'exploitation', n: 'Travaux d’exploitation' }
];

var TRAVAUX = [
  /* --- travaux forestiers : 10 % si le client est identifié, sinon 20 % --- */
  { c: 'PLANT', cat: 'plantation', n: 'Plantation, semis, mise en place des plants', u: 'plant', tvaSans: 20, tvaAvec: 10 },
  { c: 'REGARNI', cat: 'plantation', n: 'Regarni', u: 'plant', tvaSans: 20, tvaAvec: 10 },
  { c: 'TRAVSOL', cat: 'plantation', n: 'Travail du sol, potets, sous-solage, labour', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'TUTEUR', cat: 'gibier', n: 'Mise en place de tuteurs', u: 'unite', tvaSans: 20, tvaAvec: 10 },
  { c: 'PROTEC', cat: 'gibier', n: 'Pose de protections gibier', u: 'unite', tvaSans: 20, tvaAvec: 10 },
  { c: 'DEPOSE', cat: 'gibier', n: 'Dépose de protections gibier', u: 'unite', tvaSans: 20, tvaAvec: 10 },
  { c: 'DEGAG', cat: 'sylvicole', n: 'Dégagement manuel', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'DEPRES', cat: 'sylvicole', n: 'Dépressage', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'DETOUR', cat: 'sylvicole', n: 'Détourage', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'JARDIN', cat: 'sylvicole', n: 'Travaux sylvicoles jardinatoires', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'DEBROU', cat: 'sylvicole', n: 'Débroussaillage, désherbage', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'NETT', cat: 'sylvicole', n: 'Nettoiement', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'ELAG', cat: 'sylvicole', n: 'Élagage, ébranchage, éhouppage', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'TAILLE', cat: 'sylvicole', n: 'Taille des arbres et des haies', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'BROY', cat: 'sylvicole', n: 'Broyage (débroussaillage)', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'DESSOU', cat: 'exploitation', n: 'Défrichage, dessouchage', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'ANDAIN', cat: 'sylvicole', n: 'Brûlage, andainage, ramassage des rémanents', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'RANGE', cat: 'sylvicole', n: 'Rangement de branches', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'ENTRET', cat: 'plantation', n: 'Entretien de plantation', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'PISTE', cat: 'exploitation', n: 'Entretien de pistes, sentiers, curage de fossés', u: 'ml', tvaSans: 20, tvaAvec: 10 },
  { c: 'PHYTO', cat: 'sylvicole', n: 'Épandage de produits phytosanitaires', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'ENGRAIS', cat: 'sylvicole', n: 'Épandage d’engrais, amendements', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'ABAT', cat: 'exploitation', n: 'Abattage, tronçonnage', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'DEBARD', cat: 'exploitation', n: 'Débardage', u: 'ha', tvaSans: 20, tvaAvec: 10 },
  { c: 'CLOIS', cat: 'exploitation', n: 'Ouverture de cloisonnements, layons', u: 'ml', tvaSans: 20, tvaAvec: 10 },
  { c: 'GRILL', cat: 'gibier', n: 'Pose de clôture gibier', u: 'ml', tvaSans: 20, tvaAvec: 10 },
  /* --- travaux au taux normal quoi qu'il arrive --- */
  { c: 'REPULSIF', cat: 'gibier', n: 'Application de répulsifs', u: 'ha', tvaSans: 20, tvaAvec: 20, doute: true },
  { c: 'JALON', cat: 'gestion', n: 'Jalonnage des lignes', u: 'ml', tvaSans: 20, tvaAvec: 20 },
  /* Le code reste MARQ pour ne pas décrocher les anciennes lignes : seul
     l'intitulé change. Marquage, martelage et comptage sont retirés — ce
     n'est pas ce métier-là. */
  { c: 'MARQ', cat: 'gestion', n: 'Balivage', u: 'ha', tvaSans: 20, tvaAvec: 20 },
  { c: 'INVENT', cat: 'gestion', n: 'Inventaire en plein', u: 'jour', tvaSans: 20, tvaAvec: 20 },
  { c: 'CHABLIS', cat: 'gestion', n: 'Repérage de chablis', u: 'jour', tvaSans: 20, tvaAvec: 20 },
  { c: 'ROUTE', cat: 'exploitation', n: 'Création de routes, pistes, places de dépôt', u: 'ml', tvaSans: 20, tvaAvec: 20 },
  { c: 'FOSSE', cat: 'exploitation', n: 'Création de fossés, ponceaux, passages busés', u: 'ml', tvaSans: 20, tvaAvec: 20 },
  { c: 'DRAINAGE', cat: 'exploitation', n: 'Drainage', u: 'ml', tvaSans: 20, tvaAvec: 20 },
  { c: 'EVAC', cat: 'exploitation', n: 'Évacuation des rémanents et déchets', u: 'ha', tvaSans: 20, tvaAvec: 20 },
  { c: 'FENDAGE', cat: 'exploitation', n: 'Fendage de bois de chauffage', u: 'unite', tvaSans: 20, tvaAvec: 20 },
  /* --- fournitures : taux propre, indépendant du SIREN du client --- */
  { c: 'F_TUTEUR', n: 'Fourniture de tuteurs', u: 'unite', fourniture: true, tvaSans: 20, tvaAvec: 20 },
  { c: 'F_PROTEC', n: 'Fourniture de protections gibier', u: 'unite', fourniture: true, tvaSans: 20, tvaAvec: 20 },
  { c: 'F_CLOTURE', n: 'Fourniture de grillage, clôture', u: 'ml', fourniture: true, tvaSans: 20, tvaAvec: 20 },
  { c: 'F_BUSE', n: 'Fourniture de buses, tuyaux, tout-venant', u: 'unite', fourniture: true, tvaSans: 20, tvaAvec: 20 },
  { c: 'F_REPULSIF', n: 'Fourniture de répulsifs', u: 'unite', fourniture: true, tvaSans: 20, tvaAvec: 20, doute: true },
  { c: 'F_PLANTS', n: 'Fourniture de plants forestiers', u: 'plant', fourniture: true, tvaSans: 5.5, tvaAvec: 5.5, doute: true },
  { c: 'F_PIQUET', n: 'Vente d’échalas, piquets appointés', u: 'unite', fourniture: true, tvaSans: 5.5, tvaAvec: 5.5 },
  { c: 'F_AUTRE', n: 'Autre fourniture', u: 'unite', fourniture: true, tvaSans: 20, tvaAvec: 20 },
  { c: 'AUTRE', n: 'Autre', u: 'forfait', tvaSans: 20, tvaAvec: 20 }
];

/* Unités de chiffrage. « quantifiee » indique si un rendement a du sens. */
var UNITES = [
  { c: 'ha', n: 'hectare', court: 'ha', quantifiee: true },
  { c: 'plant', n: 'plant', court: 'plant', quantifiee: true },
  { c: 'unite', n: 'unité', court: 'u', quantifiee: true },
  { c: 'ml', n: 'mètre linéaire', court: 'ml', quantifiee: true },
  { c: 'jour', n: 'journée', court: 'j', quantifiee: false },
  { c: 'forfait', n: 'forfait', court: 'forfait', quantifiee: false }
];

/* Le parcours d'un chantier. « ouvert » = encore actif dans le carnet.
   Le devis est facultatif : on peut créer directement en 'encours'. */
/* Pourquoi un devis n'a pas abouti — au bout de vingt devis, c'est ça
   qui apprend quelque chose, pas le taux brut. */
var MOTIFS_REFUS = [
  { c: 'prix', n: 'Trop cher' },
  { c: 'delai', n: 'Délai trop long' },
  { c: 'concurrent', n: 'Confié à un autre' },
  { c: 'annule', n: 'Chantier annulé' },
  { c: 'reporte', n: 'Reporté' },
  { c: 'sansreponse', n: 'Jamais eu de réponse' },
  { c: 'autre', n: 'Autre' }
];
function nomMotifRefus(x) {
  for (var i = 0; i < MOTIFS_REFUS.length; i++) if (MOTIFS_REFUS[i].c === x) return MOTIFS_REFUS[i].n;
  return x || '';
}
/* Répartition des refus, pour voir ce qui revient. */
function analyseRefus(chantiers) {
  var m = {}, n = 0;
  (chantiers || []).forEach(function (ch) {
    if (ch.statut !== 'sansuite') return;
    var k = ch.motifRefus || 'autre';
    m[k] = (m[k] || 0) + 1; n++;
  });
  return { total: n, motifs: Object.keys(m).map(function (k) {
    return { motif: k, nom: nomMotifRefus(k), n: m[k], part: Math.round(m[k] / n * 100) };
  }).sort(function (a, b) { return b.n - a.n; }) };
}

/* Tout chantier ne part pas d'un devis : un client qui rappelle pour finir
   une parcelle, un dépannage. Les deux premières étapes ne veulent alors
   rien dire, et « Sans suite » n'est pas un refus de devis. La fiche porte
   donc la réponse, et les intitulés suivent : « devisSeul » retire l'étape
   quand il n'y a pas de devis, « sansDevis » donne l'autre mot. Les codes,
   eux, ne bougent pas — c'est ce qui laisse l'historique intact. */
var STATUTS = [
  { c: 'devis', n: 'Devis à envoyer', devisSeul: true, ouvert: true, engage: false },
  { c: 'envoye', n: 'Devis envoyé', devisSeul: true, ouvert: true, engage: false },
  { c: 'accepte', n: 'Devis signé, à planifier', sansDevis: 'À planifier',
    alias: ['Accepté, à planifier', 'Accepté'], ouvert: true, engage: true },
  { c: 'encours', n: 'En cours', ouvert: true, engage: true },
  { c: 'termine', n: 'Terminé, à facturer', ouvert: true, engage: true },
  { c: 'facture', n: 'Facturé', ouvert: true, engage: true },
  { c: 'paye', n: 'Payé', ouvert: false, engage: true },
  { c: 'sansuite', n: 'Devis refusé', sansDevis: 'Sans suite', ouvert: false, engage: false }
];

/* La case n'existait pas avant la 4.36 : migrerDevis() la pose une fois sur
   l'existant, et ce repli ne sert plus qu'aux données restaurées d'une
   sauvegarde plus ancienne. Un chantier passé par « devis à envoyer » ou
   « devis envoyé » en avait forcément un ; l'historique repris du carnet
   comptable, non. */
function aDevis(ch) {
  if (!ch) return false;
  if (ch.aDevis != null) return !!ch.aDevis;
  return ch.statut === 'devis' || ch.statut === 'envoye' || ch.statut === 'sansuite' ||
    !!ch.dateEnvoi || !!ch.numeroDevis || !!ch.dateDevis;
}
/* Les étapes proposées à la saisie. Sans devis, les deux premières sortent. */
function statutsPossibles(ch) {
  var avec = aDevis(ch);
  return STATUTS.filter(function (s) { return avec || !s.devisSeul; });
}
/* Fin de validité : la date d'édition plus la durée choisie. Le jour est
   conservé, sauf s'il n'existe pas dans le mois d'arrivée — un devis édité
   un 31 janvier et valable un mois court jusqu'au 28 février, pas au 3 mars.
   Rien n'est déduit quand l'une des deux données manque. */
function finValiditeDevis(ch) {
  if (!aDevis(ch) || !ch || !ch.dateDevis) return null;
  var m = nb(ch.validiteDevis);
  if (!(m > 0)) return null;
  var d = new Date(ch.dateDevis), jour = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + m);
  var dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(jour, dernier));
  return minuit(d.getTime());
}

function trouve(liste, code) {
  for (var i = 0; i < liste.length; i++) if (liste[i].c === code) return liste[i];
  return null;
}
function nomTravail(c) { var t = trouve(TRAVAUX, c); return t ? t.n : (c || ''); }

/* Les prestations arrivent avec leurs taux de TVA officiels. On peut les
   renommer et en ajouter ; le code, lui, ne bouge jamais. C'est ce qui
   permet de changer un libellé partout d'un coup sans toucher à un seul
   chantier déjà facturé. Retirer une prestation ne l'efface pas non plus :
   elle disparaît des listes, mais reste lisible là où elle a servi. */
function appliquerTravauxPerso(cfg) {
  var perso = (cfg && cfg.travauxPerso) || {};
  var retires = (cfg && cfg.travauxRetires) || [];
  TRAVAUX.forEach(function (t) { t.retire = retires.indexOf(t.c) >= 0; });
  Object.keys(perso).forEach(function (code) {
    var p = perso[code], t = trouve(TRAVAUX, code);
    if (t) {
      if (p.n) t.n = p.n;
      if (p.u) t.u = p.u;
      /* Le rangement livré n'est qu'un défaut : celui qu'il choisit prime. */
      if (p.cat !== undefined) t.cat = p.cat;
    } else {
      TRAVAUX.push({ c: code, n: p.n || code, u: p.u || 'unite', cat: p.cat || '',
        tvaSans: nb(p.tvaSans) || 20, tvaAvec: nb(p.tvaAvec) || 20,
        fourniture: !!p.fourniture, perso: true, retire: retires.indexOf(code) >= 0 });
    }
  });
}
/* La famille d'un travail, et celle d'une ligne. La ligne est plus large : une
   fourniture ou un débours ne relève d'aucune famille de travaux, sa nature
   suffit à le dire. C'est ce qui reconstitue ses sept familles à partir de
   cinq, sans jamais dire deux fois la même chose. */
function categorieTravail(code) {
  var t = trouve(TRAVAUX, code);
  return t ? (t.cat || '') : '';
}
function nomCatTravail(c) {
  var x = trouve(CAT_TRAVAUX, c);
  return x ? x.n : '';
}
function categorieLigne(l) {
  if (!l) return '';
  if (l.nature === 'debours') return 'debours';
  var t = trouve(TRAVAUX, l.travail);
  if (l.nature === 'vente' || (t && t.fourniture)) return 'fourniture';
  return (t && t.cat) || '';
}
function nomCategorieLigne(c) {
  if (c === 'fourniture') return 'Fourniture';
  if (c === 'debours') return 'Débours client';
  return nomCatTravail(c) || 'Sans famille';
}

/* Les prestations proposées à la saisie : tout sauf celles mises de côté. */
function travauxActifs(avecFournitures) {
  return TRAVAUX.filter(function (t) {
    return !t.retire && (avecFournitures || !t.fourniture);
  });
}
function uniteDe(c) { var t = trouve(TRAVAUX, c); return t ? t.u : 'forfait'; }
function nomUnite(c, n) {
  var u = trouve(UNITES, c);
  if (!u) return c || '';
  if (n != null && n > 1 && u.c !== 'forfait' && u.c !== 'ml') return u.n + 's';
  return u.n;
}
function courtUnite(c) { var u = trouve(UNITES, c); return u ? u.court : (c || ''); }
/* Le second argument est le chantier, pas un drapeau : appelée avec le seul
   code — le filtre du carnet, qui parle de tous les chantiers à la fois —
   elle rend l'intitulé complet. */
function nomStatut(c, ch) {
  var s = trouve(STATUTS, c);
  if (!s) return c || '';
  return (ch && s.sansDevis && !aDevis(ch)) ? s.sansDevis : s.n;
}
function statutOuvert(c) { var s = trouve(STATUTS, c); return s ? s.ouvert : true; }
function statutEngage(c) { var s = trouve(STATUTS, c); return s ? s.engage : false; }
function rangStatut(c) { for (var i = 0; i < STATUTS.length; i++) if (STATUTS[i].c === c) return i; return 99; }

/* Les espaces sont retirées avant l'analyse : depuis que fmt() sépare les
   milliers, un « 25 000 » relu dans un champ vaudrait 25. */
function nb(v) {
  if (v == null || v === '') return 0;
  var n = parseFloat(String(v).replace(/[\s\u00A0]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function arr(n, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(n * p) / p; }

/* ------------------------------------------------------------- chiffrage */
/* Un forfait vaut son prix, quelle que soit la quantité saisie. */
function montantLigne(l) {
  if (!l) return 0;
  if (l.unite === 'forfait') return arr(nb(l.prix), 2);
  return arr(nb(l.quantite) * nb(l.prix), 2);
}
/* Taux applicable à une ligne : le sien s'il est posé, sinon celui du
   chantier. Un même chantier peut mêler 10 et 20 % (le répulsif, par
   exemple, n'ouvre pas droit au taux réduit même chez un propriétaire
   qui y a droit pour le reste). */
/* Un forfait groupé : plusieurs travaux sur une même ligne. Ils *désignent* ce
   que le forfait couvre — « détourage + élagage » — et le prix porte sur la
   ligne entière, sans quantité. C'est ainsi qu'il facture, et la ligne reste
   une seule ligne sur le papier du client.
   « travail » reste le premier de la liste : c'est lui que lisent les
   rendements, la famille et tout l'historique déjà saisi. Les suivants vivent
   à part, dans travauxPlus, pour qu'aucune ligne ancienne ne bouge. */
function travauxDeLigne(l) {
  var t = [];
  if (l && l.travail) t.push(l.travail);
  ((l && l.travauxPlus) || []).forEach(function (x) {
    if (x && t.indexOf(x) < 0) t.push(x);
  });
  return t;
}
function ligneGroupee(l) { return travauxDeLigne(l).length > 1; }
function nomTravauxLigne(l) {
  return travauxDeLigne(l).map(nomTravail).join(' + ');
}
/* Les taux que commandent les travaux d'une ligne, sans doublon. */
function tauxDesTravaux(l, siren) {
  var v = [];
  travauxDeLigne(l).forEach(function (code) {
    if (!trouve(TRAVAUX, code)) return;
    var t = tauxAttendu(code, siren);
    if (v.indexOf(t) < 0) v.push(t);
  });
  return v;
}
/* Sa règle, dictée le 23 août : même taux sur tous les travaux, on l'applique ;
   taux différents, on l'oblige à trancher au lieu de choisir pour lui. */
function tvaAtrancher(l, ch) {
  if (l && l.tva != null && l.tva !== '') return false;
  return tauxDesTravaux(l, ch && ch.siren).length > 1;
}
function tauxLigne(l, ch) {
  if (l && l.tva != null && l.tva !== '') return nb(l.tva);      // taux forcé sur la ligne
  var taux = tauxDesTravaux(l, ch && ch.siren);
  if (!taux.length) return nb(ch && ch.tva) || 20;
  /* Taux mêlés sans arbitrage — une ligne restaurée d'avant la règle : on
     retient le plus élevé. Sous-facturer la TVA coûte plus cher que l'inverse. */
  return taux.length === 1 ? taux[0] : Math.max.apply(null, taux);
}
/* Le taux que la nature des travaux commande, avant toute correction. */
function tauxAttendu(travail, siren) {
  var t = trouve(TRAVAUX, travail);
  if (!t) return 20;
  return siren ? t.tvaAvec : t.tvaSans;
}
function estFourniture(travail) {
  var t = trouve(TRAVAUX, travail);
  return !!(t && t.fourniture);
}
/* Un travail dont le taux ne bouge pas avec le SIREN : le dire évite de
   croire à une erreur quand une ligne reste à 20 %. */
/* Certains taux ne font pas l'unanimité entre les sources : autant le dire
   plutôt que d'afficher une certitude qui n'existe pas. */
function tauxDiscute(travail) {
  var t = trouve(TRAVAUX, travail);
  return !!(t && t.doute);
}
function tauxFixe(travail) {
  var t = trouve(TRAVAUX, travail);
  return !!(t && t.tvaSans === t.tvaAvec);
}
function tauxPresents(ch) {
  var vus = [];
  ((ch && ch.lignes) || []).forEach(function (l) {
    var t = tauxLigne(l, ch);
    if (vus.indexOf(t) < 0) vus.push(t);
  });
  return vus.sort(function (a, b) { return a - b; });   // tri numérique : 5,5 avant 10
}
function montant(ch) {
  return arr(((ch && ch.lignes) || []).reduce(function (t, l) { return t + montantLigne(l); }, 0), 2);
}
/* Le débours traverse le compte : somme avancée pour le client et refacturée
   à l'euro près. Il figure sur la facture — le client la paie en entier — mais
   il ne rapporte rien et ne récompense aucune journée de travail.
   Le total de la facture le garde donc, « ce que ça a rapporté » et le prix
   par journée l'écartent. Sans ça, la fiche et le bilan des finances donnaient
   deux chiffres différents pour le même chantier. */
/* Ce que la facture ajoute au hors taxes. Un chantier peut mêler deux taux
   — le répulsif n'ouvre pas droit au taux réduit là où le reste y a droit —
   d'où le calcul ligne à ligne plutôt qu'un taux appliqué au total. */
function tvaChantier(ch) {
  return arr(((ch && ch.lignes) || []).reduce(function (t, l) {
    return t + montantLigne(l) * tauxLigne(l, ch) / 100;
  }, 0), 2);
}
/* Le taux, quand il est unique. Taux mêlés, on rend null : afficher l'un
   des deux serait un mensonge, et afficher le plus élevé en serait un autre. */
function tauxChantier(ch) {
  var vus = [];
  ((ch && ch.lignes) || []).forEach(function (l) {
    var t = tauxLigne(l, ch);
    if (vus.indexOf(t) < 0) vus.push(t);
  });
  return vus.length === 1 ? vus[0] : null;
}
function ttcChantier(ch) { return arr(montant(ch) + tvaChantier(ch), 2); }
function montantDebours(ch) {
  return arr(((ch && ch.lignes) || []).reduce(function (t, l) {
    return t + (l.nature === 'debours' ? montantLigne(l) : 0);
  }, 0), 2);
}
function montantHorsDebours(ch) {
  return arr(montant(ch) - montantDebours(ch), 2);
}

/* Quantité cumulée d'une unité donnée sur le chantier (pour les rendements). */
function quantite(ch, unite) {
  return arr(((ch && ch.lignes) || []).filter(function (l) { return l.unite === unite; })
    .reduce(function (t, l) { return t + nb(l.quantite); }, 0), 3);
}
/* Unités quantifiables présentes sur le chantier. */
function unitesPresentes(ch) {
  var vu = {}, r = [];
  ((ch && ch.lignes) || []).forEach(function (l) {
    var u = trouve(UNITES, l.unite);
    if (u && u.quantifiee && nb(l.quantite) > 0 && !vu[l.unite]) { vu[l.unite] = 1; r.push(l.unite); }
  });
  return r;
}

/* ---------------------------------------------------------------- temps */
/* Chaque saisie : { date, duree, unite: 'j'|'h', personnes, activite }.
   Tout est ramené en jours-homme : c'est ce qui se compare d'un chantier
   à l'autre et ce qui se rapproche d'un prix de journée. */
function HEURES_JOUR(cfg) { return (cfg && nb(cfg.heuresJour)) || 7; }
/* Jours-homme : tout le monde compte, c'est ce qui explique le rendement. */
function joursSaisie(t, cfg) {
  if (!t) return 0;
  var d = nb(t.duree), pers = nb(t.personnes) || 1;
  if (t.unite === 'h') d = d / HEURES_JOUR(cfg);
  return arr(d * pers, 3);
}
/* Mes journées : quand on travaille à plusieurs, chacun facture les siennes.
   Le prix de journée ne doit donc porter que sur les miennes, sinon il est
   divisé par le nombre de personnes présentes. */
function mesJours(t, cfg) {
  if (!t || t.sansMoi) return 0;
  var d = nb(t.duree);
  if (t.unite === 'h') d = d / HEURES_JOUR(cfg);
  return arr(d, 3);
}
/* ----------------------------------------------------------- la journée
   Une journée de travail se découpe en postes : trois heures de plantation
   pour deux cents plants, le reste à poser des protections. Le temps porté
   par un chantier en découle — on ne le saisit jamais deux fois. */
function heuresPostes(j) {
  return arr(((j && j.postes) || []).reduce(function (s, p) { return s + nb(p.heures); }, 0), 2);
}
/* Le trajet compte dans la journée, comme le hors production : il n'entre
   jamais dans un rendement, mais c'est du temps donné au chantier. */
function heuresJournee(j) {
  return arr(heuresPostes(j) + nb(j && j.nonProd) + nb(j && j.trajet), 2);
}
function joursJournee(j, cfg) { return arr(heuresJournee(j) / HEURES_JOUR(cfg), 3); }

/* Le prix de journée visé : réglage général, redéfini au devis si le
   chantier le mérite. */
function prixJourVise(ch, cfg) {
  return nb(ch && ch.prixJour) || nb(cfg && cfg.prixJourVise) || 0;
}
/* Ce que le devis paie en journées, face à ce qu'on y a réellement passé. */
function bilanJournees(ch, cfg) {
  var pj = prixJourVise(ch, cfg), m = montantHorsDebours(ch), faites = tempsMoi(ch, cfg);
  var prevues = pj > 0 ? arr(m / pj, 2) : null;
  return {
    prixJourVise: pj || null, prevues: prevues, faites: faites,
    ecart: prevues != null ? arr(faites - prevues, 2) : null,
    obtenu: faites > 0 ? arr(m / faites, 2) : null
  };
}

function tempsTotal(ch, cfg) {
  return arr(((ch && ch.temps) || []).reduce(function (s, t) { return s + joursSaisie(t, cfg); }, 0), 2);
}
function tempsMoi(ch, cfg) {
  return arr(((ch && ch.temps) || []).reduce(function (s, t) { return s + mesJours(t, cfg); }, 0), 2);
}
/* Ce qu'une facture porte en journées. Sur les chantiers repris du carnet,
   c'est la seule trace du temps : rien n'a jamais été saisi dans « temps ». */
function joursFactures(ch) {
  return arr(((ch && ch.lignes) || []).reduce(function (s, l) {
    return s + (l.unite === 'jour' ? nb(l.quantite) : 0);
  }, 0), 2);
}

/* Combien de journées le chantier a réellement pris. Le temps saisi fait foi
   — c'est déjà lui qui porte les rendements et le prix par journée. À défaut,
   les lignes facturées en journées remplissent le vide. **Jamais l'addition
   des deux** : un chantier à la fois saisi et facturé en journées compterait
   double.
   Attention à ne pas confondre avec totalFait(), qui compte les journées
   posées à l'agenda : celles-là disent « j'y étais », pas « combien de temps
   j'y ai passé ». La fiche affichait totalFait() sous l'intitulé « journées
   faites » pendant que les rendements lisaient temps : deux chiffres pour la
   même idée, sur le même écran. */
function tempsPasse(ch, cfg) {
  var saisi = tempsMoi(ch, cfg);
  return saisi > 0 ? saisi : joursFactures(ch);
}

/* Kilomètres saisis à la main : le trajet varie trop (on ne part pas
   toujours de chez soi) pour être déduit d'une position. */
function kmChantier(ch) {
  return arr(((ch && ch.temps) || []).reduce(function (s, t) { return s + nb(t.km); }, 0), 1);
}
function kmTotal(chantiers, debut, fin) {
  var t = 0;
  (chantiers || []).forEach(function (ch) {
    (ch.temps || []).forEach(function (x) {
      if (debut != null && (x.date < debut || x.date > fin)) return;
      t += nb(x.km);
    });
  });
  return arr(t, 1);
}
/* Coût approché du carburant : consommation et prix au litre paramétrables. */
function coutCarburant(km, cfg) {
  var l100 = nb(cfg && cfg.litres100) || 9;
  var prix = nb(cfg && cfg.prixLitre) || 1.75;
  return arr(km / 100 * l100 * prix, 2);
}
/* Prix de journée réellement obtenu : mon montant sur mes journées. */
/* Un chantier soldé : le travail est fini, la facture est ce qu'elle sera.
   Tant qu'il tourne, le montant est complet mais les journées ne le sont
   pas — diviser l'un par l'autre ne dit rien. */
function chantierSolde(ch) {
  return ['termine', 'facture', 'paye'].indexOf(ch && ch.statut) >= 0;
}
function prixJour(ch, cfg) {
  if (!chantierSolde(ch)) return null;
  var j = tempsMoi(ch, cfg);
  return j > 0 ? arr(montant(ch) / j, 2) : null;
}
/* Rendement : quantité réalisée par jour-homme, pour une unité donnée. */
function rendement(ch, unite, cfg) {
  var j = tempsTotal(ch, cfg), q = quantite(ch, unite);
  return (j > 0 && q > 0) ? arr(q / j, 3) : null;
}


/* Essences rencontrées en travaux sylvicoles (plantation, dégagement…). */
var ESSENCES_CH = [
  { c: 'CHS', n: 'Chêne sessile' }, { c: 'CHP', n: 'Chêne pédonculé' },
  { c: 'HET', n: 'Hêtre' }, { c: 'ERA', n: 'Érable' }, { c: 'FRE', n: 'Frêne' },
  { c: 'MER', n: 'Merisier' }, { c: 'CHT', n: 'Châtaignier' }, { c: 'ROB', n: 'Robinier' },
  { c: 'DOU', n: 'Douglas' }, { c: 'EPC', n: 'Épicéa' }, { c: 'SAP', n: 'Sapin' },
  { c: 'MEL', n: 'Mélèze' }, { c: 'PIN', n: 'Pin sylvestre' }, { c: 'PLX', n: 'Peupliers' },
  { c: 'MIX', n: 'Mélangé' }
];
var NIVEAUX = [{ v: 1, n: 'Facile' }, { v: 2, n: 'Moyen' }, { v: 3, n: 'Difficile' }];
function nomEssenceCh(c) {
  for (var i = 0; i < ESSENCES_CH.length; i++) if (ESSENCES_CH[i].c === c) return ESSENCES_CH[i].n;
  return c || '';
}
function nomNiveau(v) {
  for (var i = 0; i < NIVEAUX.length; i++) if (NIVEAUX[i].v === Number(v)) return NIVEAUX[i].n;
  return '';
}

/* ------------------------------------------- rendement par type de travaux
   Le temps attribuable à un travail : les saisies marquées de cette activité ;
   à défaut, le temps total si le chantier ne porte que ce travail (les
   chantiers mono-travail sont les références les plus fiables). */
function lignesDe(ch, travail) {
  return ((ch && ch.lignes) || []).filter(function (l) { return l.travail === travail; });
}
function monoTravail(ch) {
  var l = (ch && ch.lignes) || [];
  if (!l.length) return null;
  var t = l[0].travail;
  for (var i = 1; i < l.length; i++) if (l[i].travail !== t) return null;
  return t;
}
function tempsPourTravail(ch, travail, cfg) {
  var saisies = (ch && ch.temps) || [];
  var marquees = saisies.filter(function (t) { return t.activite === travail; });
  if (marquees.length) {
    return arr(marquees.reduce(function (s, t) { return s + joursSaisie(t, cfg); }, 0), 3);
  }
  if (monoTravail(ch) === travail) return tempsTotal(ch, cfg);
  return 0;
}
function uniteTravail(ch, travail) {
  var ls = lignesDe(ch, travail);
  for (var i = 0; i < ls.length; i++) {
    var u = trouve(UNITES, ls[i].unite);
    if (u && u.quantifiee && nb(ls[i].quantite) > 0) return ls[i].unite;
  }
  return null;
}
function quantiteTravail(ch, travail) {
  var u = uniteTravail(ch, travail);
  if (!u) return 0;
  return arr(lignesDe(ch, travail).filter(function (l) { return l.unite === u; })
    .reduce(function (s, l) { return s + nb(l.quantite); }, 0), 3);
}
/* Rendement d'un chantier pour un travail donné : quantité / jours-homme. */
function rendementTravail(ch, travail, cfg) {
  var t = tempsPourTravail(ch, travail, cfg);
  var q = quantiteTravail(ch, travail);
  var u = uniteTravail(ch, travail);
  if (!(t > 0 && q > 0 && u)) return null;
  return { unite: u, jours: t, quantite: q, rendement: arr(q / t, 3) };
}

/* --------------------------------------------------------- estimation
   Estimer un chantier à partir de ses propres rendements passés : jours =
   quantité / rendement retenu, montant conseillé au prix de journée visé
   (à défaut, au prix moyen réellement obtenu). */
/* La difficulté est portée par la ligne de travaux, pas par le chantier :
   ce qui ralentit une plantation (sol, portage) n'a rien à voir avec ce qui
   ralentit un dégagement (ronce, retrouver les plants). Une note de 1 à 5 et
   une précision libre suffisent — le reste, c'est son métier. */
function difficulteLigne(ch, travail) {
  var l = (ch.lignes || []).filter(function (x) {
    return x.travail === travail && nb(x.difficulte) > 0;
  })[0];
  return l ? nb(l.difficulte) : null;
}
function noteLigne(ch, travail) {
  var l = (ch.lignes || []).filter(function (x) {
    return x.travail === travail && x.note;
  })[0];
  return l ? l.note : '';
}
function dateChantier(ch) {
  var pl = journeesPlacees(ch);
  if (pl.length) return pl[pl.length - 1].d;
  var t = (ch.temps || []).map(function (x) { return x.date; }).filter(Boolean);
  if (t.length) return Math.max.apply(null, t);
  return ch.maj || ch.cree || 0;
}

/* Les cadences notées à la main vivent dans la configuration, comme les
   notes personnelles : elle part dans les sauvegardes, et c'est une petite
   liste que l'utilisateur enrichit lui-même. */
function cadences(cfg, travail, unite) {
  var l = (cfg && cfg.cadences) || [];
  if (!travail) return l.slice();
  return l.filter(function (x) {
    return x.travail === travail && (!unite || x.unite === unite);
  });
}
/* Il compte en minutes par tige, jamais en tiges par jour : c'est ce qu'on
   lit sur une montre. La conversion se fait ici, une fois, et tout ce qui
   suit raisonne dans l'unité des rendements — l'unité par jour. */
function cadenceParJour(c, cfg) {
  if (!c) return 0;
  var v = nb(c.valeur);
  if (!(v > 0)) return 0;
  if (c.sens === 'parjour') return arr(v, 3);
  /* minutes par unité : ce qu'on fait en une journée de travail. */
  return arr(HEURES_JOUR(cfg) * 60 / v, 3);
}
/* La moyenne de ce qu'il a compté pour une prestation. Non pondérée : ce
   sont des observations, pas des mesures — les pondérer donnerait à l'une
   d'elles une autorité qu'elle n'a pas. */
function cadenceComptee(cfg, travail, unite) {
  var l = cadences(cfg, travail, unite).map(function (c) { return cadenceParJour(c, cfg); })
    .filter(function (v) { return v > 0; });
  if (!l.length) return null;
  return arr(l.reduce(function (t, v) { return t + v; }, 0) / l.length, 2);
}
function references(chantiers, travail, cfg) {
  var refs = [];
  (chantiers || []).forEach(function (ch) {
    var r = rendementTravail(ch, travail, cfg);
    if (r) refs.push({ chantier: ch, rendement: r.rendement, unite: r.unite, jours: r.jours,
      quantite: r.quantite, prixJour: prixJour(ch, cfg),
      difficulte: difficulteLigne(ch, travail), note: noteLigne(ch, travail),
      date: dateChantier(ch) });
  });
  return refs;
}

/* Ses rendements déjà obtenus pour une prestation : le plus bas, le médian,
   le plus haut, et le détail du plus récent au plus ancien. On ne modélise
   rien — avec une trentaine de chantiers par an, une pondération
   multicritère produirait des moyennes calculées sur un ou deux chantiers
   avec un faux air d'assurance. On lui montre ses chiffres, il se situe. */
function distributionRendement(chantiers, travail, cfg) {
  var refs = references(chantiers, travail, cfg);
  if (!refs.length) return { n: 0, refs: [] };
  var unite = refs[0].unite;
  refs = refs.filter(function (r) { return r.unite === unite; });
  var v = refs.map(function (r) { return r.rendement; }).sort(function (a, b) { return a - b; });
  var mil = Math.floor(v.length / 2);
  var med = v.length % 2 ? v[mil] : (v[mil - 1] + v[mil]) / 2;
  refs.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
  return { n: v.length, unite: unite, min: v[0], med: arr(med, 3),
    max: v[v.length - 1], refs: refs };
}
/* On ne pondère plus par une ressemblance calculée : il choisit lui-même où
   il se situe dans ses rendements passés (bas, médian, haut, ou une valeur
   à lui). À défaut de choix, le médian — c'est le repère le moins menteur. */
function estime(chantiers, demande, cfg) {
  var d = distributionRendement(chantiers, demande.travail, cfg);
  if (!d.n) return { refs: [], rendement: null, distribution: d };
  var rend = nb(demande.rendement) > 0 ? arr(nb(demande.rendement), 3) : d.med;
  var q = nb(demande.quantite);
  var jours = (q > 0 && rend > 0) ? arr(q / rend, 2) : null;
  var avecPj = d.refs.filter(function (r) { return r.prixJour; });
  var pjRefs = avecPj.length
    ? arr(avecPj.reduce(function (s, r) { return s + r.prixJour; }, 0) / avecPj.length, 2) : null;
  var pjRetenu = nb(cfg && cfg.prixJourVise) || pjRefs;
  return {
    refs: d.refs, distribution: d, rendement: rend, unite: d.unite,
    fourchette: { min: d.min, max: d.max },
    jours: jours,
    joursFourchette: (q > 0 && d.max > 0 && d.min > 0)
      ? { min: arr(q / d.max, 2), max: arr(q / d.min, 2) } : null,
    prixJourRefs: pjRefs, prixJourRetenu: pjRetenu || null,
    montant: (jours && pjRetenu) ? arr(jours * pjRetenu, 2) : null
  };
}

/* ----------------------------------------------------------------- dates */
function jourCle0(ts) { return ts; }
function dureePrevue(ch) {
  if (!ch || !ch.debut || !ch.fin) return null;
  return Math.max(1, Math.round((ch.fin - ch.debut) / JOUR) + 1);
}
/* En retard : la dernière journée placée (ou l'échéance) est passée alors que
   le chantier n'est pas clos. Les journées placées font foi si elles existent. */
/* En retard : l'échéance est passée, ou la dernière journée placée l'est
   sans que le chantier soit clos. */
/* Une journée posée sur une date passée, sans qu'aucun temps n'y soit noté :
   on y était, on ne sait pas combien de temps ça a pris. « Sinon je me dis
   ok, je le ferai plus tard, et après je ne le fais pas et j'oublie. » Sans
   ce rattrapage, les rendements se vident en silence et le chantier finit
   par s'annoncer « en retard » sans qu'on sache pourquoi. */
function journeesANoter(chantiers, maintenant) {
  var m = minuit(maintenant), out = [];
  (chantiers || []).forEach(function (ch) {
    if (['sansuite', 'devis', 'envoye'].indexOf(ch.statut) >= 0) return;
    var notes = {};
    (ch.temps || []).forEach(function (t) { if (t.date) notes[jourCle(t.date)] = 1; });
    journeesPlacees(ch).forEach(function (j) {
      /* Le jour même n'est pas fini : on ne réclame rien avant demain. */
      if (j.d >= m) return;
      if (notes[jourCle(j.d)]) return;
      out.push({ chantier: ch, d: j.d, p: nb(j.p) });
    });
  });
  return out.sort(function (a, b) { return a.d - b.d; });
}
function enRetard(ch, maintenant) {
  if (!ch) return false;
  if (['termine', 'facture', 'paye', 'sansuite'].indexOf(ch.statut) >= 0) return false;
  var m = minuit(maintenant);
  var ech = ch.echeance || ch.fin;
  if (ech && minuit(ech) < m) return true;
  var pl = journeesPlacees(ch);
  if (!pl.length) return false;
  if (pl[pl.length - 1].d >= m) return false;
  /* S'il reste des journées à poser, il n'y a rien à signaler : c'est la
     planification qui n'est pas finie, pas le chantier qui traîne. */
  var reste = resteAPlacer(ch);
  return !(reste != null && reste > 0);
}


