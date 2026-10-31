/* ==========================================================================
   Sylve — finances : dépenses, balance de TVA, chiffre d'affaires
   Rien ici ne remplace un comptable : ce sont des totaux tenus à partir de
   ce qui est saisi, pour préparer une déclaration et suivre la trésorerie.
   ========================================================================== */
(function () {
'use strict';

/* Ce qui est acheté. La distinction immobilisation / consommable compte
   pour la TVA et pour lire la balance. */
/* L'ordre est celui de la fréquence réelle des achats, pas l'alphabet :
   la saisie se fait debout, une main sur le téléphone, et ce qui revient
   tous les jours doit tomber sous le pouce. */
var CATEGORIES = [
  { c: 'CONSO', n: 'Consommable', immo: false,
    aide: 'gasoil du tracteur, mélange et huile de chaîne, chaînes, agrafes' },
  { c: 'REPAS', n: 'Frais de restauration', immo: false },
  { c: 'CARB', n: 'Frais de carburant pro', immo: false, aide: 'l’utilitaire' },
  { c: 'EPI', n: 'EPI ou équipement de terrain', immo: false,
    aide: 'pantalon anti-coupure, casque, gants, chaussures' },
  { c: 'PETITMAT', n: 'Petits outillages / matériels', immo: false },
  { c: 'FOURN', n: 'Achats de fourniture', immo: false, aide: 'plants, protections, tuteurs' },
  { c: 'ADMIN', n: 'Frais administratif', immo: false, fixe: true },
  { c: 'ENTRETIEN', n: 'Réparation matériel', immo: false, aide: 'tronçonneuse, débroussailleuse' },
  /* Le garage, la carte grise, les pièces : ce qui appartient au véhicule
     sans être du carburant. Sans elle, la carte grise finissait en frais
     administratif — cinq cents euros que le coût au kilomètre ne voyait
     jamais — et une facture de garage se confondait avec la tronçonneuse. */
  { c: 'VEHIC', n: 'Frais véhicule', immo: false, aide: 'garage, carte grise, pièces' },
  { c: 'IMMO', n: 'Immobilisation', immo: true, aide: 'véhicule, matériel durable' },
  { c: 'DEPL', n: 'Frais de déplacement', immo: false, aide: 'péage, parking, nuitée' },
  { c: 'CARBPERSO', n: 'Frais de carburant perso', immo: false,
    aide: 'le véhicule personnel employé pour le travail' },
  { c: 'CREATION', n: 'Frais de création', immo: false },
  /* Ce qui tombe tout seul du compte. « fixe » les remonte dans la liste
     d'une charge fixe : y proposer « achats de fourniture » n'avait pas de
     sens, et l'abonnement, la banque et le prêt n'existaient nulle part. */
  /* Une assurance ne porte pas de TVA — elle relève de la taxe sur les
     conventions d'assurance — et un remboursement de prêt n'en porte pas
     davantage. Rien à récupérer, donc rien à pointer. */
  { c: 'ASSUR', n: 'Assurance', immo: false, fixe: true, sansTva: true },
  { c: 'ABO', n: 'Abonnement, logiciel', immo: false, fixe: true,
    aide: 'comptabilité, bureautique, outils en ligne' },
  /* Les frais de tenue de compte relèvent des services bancaires exonérés :
     pas de TVA à récupérer dessus, donc le champ ne doit pas s'ouvrir. */
  { c: 'BANQUE', n: 'Frais bancaires', immo: false, fixe: true, sansTva: true },
  { c: 'PRET', n: 'Prêt, crédit', immo: false, fixe: true, sansTva: true },
  { c: 'COTIS', n: 'Cotisations, taxes', immo: false, sansTva: true },
  { c: 'AUTRE', n: 'Frais divers', immo: false, fixe: true }
];
var TAUX_TVA = [20, 10, 5.5, 0];

/* Ce qui est vendu : la prestation et la vente de fournitures ne subissent
   pas le même abattement au micro-BIC. */
var NATURES = [
  { c: 'prestation', n: 'Prestation de service', abattement: 0.50 },
  { c: 'vente', n: 'Vente de fournitures', abattement: 0.71 },
  /* Un débours est une somme avancée pour le compte du client et refacturée
     à l'euro près. Ce n'est pas une recette : ni abattement, ni cotisations,
     et il ne pèse pas sur les plafonds du micro-BIC. D'où « horsCA », qui le
     tient à l'écart du chiffre d'affaires tout en le laissant visible. */
  { c: 'debours', n: 'Débours client', abattement: 0, horsCA: true }
];

function trouve(l, c) { for (var i = 0; i < l.length; i++) if (l[i].c === c) return l[i]; return null; }
function nomCategorie(c) { var x = trouve(CATEGORIES, c); return x ? x.n : (c || ''); }
/* Ce qu'il compte acheter, rangé par ce qui presse. « Des fois j'oublie, et
   il faut que je les garde en mémoire. » L'objet est de savoir ce qui
   l'attend en dépenses, pas de tenir un budget : il saisit le TTC — c'est
   ce qu'il lit sur une étiquette — et le hors taxes se déduit. */
/* Des horizons glissants, jamais un millésime : « cette année » ne veut
   plus rien dire au mois de décembre. Les codes ne bougent pas — « annee »
   reste « dans l'année » — pour ne décrocher aucune ligne déjà saisie. */
var PRIORITES_ACHAT = [
  { c: 'urgent', n: 'Dès que possible', coul: '#B4231F' },
  { c: 'trois', n: 'Dans les 3 mois', coul: '#C4611B' },
  { c: 'six', n: 'Dans les 6 mois', coul: '#B98A00' },
  { c: 'annee', n: 'Dans l’année', coul: '#2E7D46' },
  { c: 'unjour', n: 'Un jour', coul: '#6F6A5C' }
];
function nomPriorite(c) { var x = trouve(PRIORITES_ACHAT, c); return x ? x.n : ''; }
function coulPriorite(c) { var x = trouve(PRIORITES_ACHAT, c); return x ? x.coul : '#6F6A5C'; }
function rangPriorite(c) {
  for (var i = 0; i < PRIORITES_ACHAT.length; i++) if (PRIORITES_ACHAT[i].c === c) return i;
  return PRIORITES_ACHAT.length;
}
/* Ce qui reste à acheter d'abord, du plus pressé au moins ; ce qui est fait
   glisse à la suite, comme il l'a demandé — il reste visible, il ne se
   mélange plus. */
function achatsRanges(achats) {
  return (achats || []).slice().sort(function (a, b) {
    if (!!a.fait !== !!b.fait) return a.fait ? 1 : -1;
    if (a.fait) return nb(b.dateFait) - nb(a.dateFait);
    var r = rangPriorite(a.priorite) - rangPriorite(b.priorite);
    return r || nb(b.ttc) - nb(a.ttc);
  });
}
/* Ce que ça pèse : le TTC qu'il sortira, le hors taxes qui entre dans ses
   charges, et la TVA qu'il récupérera. Séparé par priorité, parce que « un
   jour » et « dès que possible » ne se additionnent pas dans sa tête. */
function totauxAchats(achats) {
  var out = { ttc: 0, ht: 0, tva: 0, n: 0, parPriorite: [], parCategorie: [],
    faitTtc: 0, faitN: 0 };
  var pri = {}, cat = {};
  (achats || []).forEach(function (a) {
    var ttc = nb(a.ttc), ht = arr(ttc / (1 + nb(a.taux) / 100), 2);
    if (a.fait) { out.faitTtc += ttc; out.faitN++; return; }
    out.ttc += ttc; out.ht += ht; out.tva += ttc - ht; out.n++;
    var p = a.priorite || 'unjour';
    pri[p] = pri[p] || { c: p, ttc: 0, n: 0 };
    pri[p].ttc += ttc; pri[p].n++;
    var k = a.categorie || 'AUTRE';
    cat[k] = cat[k] || { c: k, ttc: 0, n: 0 };
    cat[k].ttc += ttc; cat[k].n++;
  });
  PRIORITES_ACHAT.forEach(function (p) { if (pri[p.c]) out.parPriorite.push(pri[p.c]); });
  out.parCategorie = Object.keys(cat).map(function (k) { return cat[k]; })
    .sort(function (a, b) { return b.ttc - a.ttc; });
  ['ttc', 'ht', 'tva', 'faitTtc'].forEach(function (k) { out[k] = arr(out[k], 2); });
  out.parPriorite.forEach(function (x) { x.ttc = arr(x.ttc, 2); });
  out.parCategorie.forEach(function (x) { x.ttc = arr(x.ttc, 2); });
  return out;
}
function estImmo(c) { var x = trouve(CATEGORIES, c); return !!(x && x.immo); }
/* Les deux carburants : celui de l'utilitaire et celui du véhicule personnel.
   Ce sont eux, et eux seuls, qui portent un nombre de litres. */
function estCarburant(c) { return c === 'CARB' || c === 'CARBPERSO'; }
/* Le prix du litre se relevait dans un réglage, qu'il fallait retenir de
   corriger — « ça change tout le temps ». Il se calcule maintenant sur ses
   propres pleins : total payé divisé par total de litres, donc pondéré par
   la quantité, un plein de soixante litres pesant plus qu'un de vingt.
   Les pleins dont les litres ne sont pas notés sont simplement ignorés — ni
   au numérateur ni au dénominateur. Compter zéro litre pour un plein payé
   ferait exploser le prix moyen ; l'écarter ne fait que réduire l'assiette,
   et le chiffre se précise à chaque ticket saisi. */
function prixLitreMoyen(depenses, categorie) {
  var euros = 0, litres = 0, n = 0, total = 0;
  (depenses || []).forEach(function (d) {
    lignesDepense(d).forEach(function (l) {
      if (l.categorie !== categorie) return;
      total++;
      var q = nb(l.litres);
      if (!(q > 0)) return;
      euros += nb(l.ttc); litres += q; n++;
    });
  });
  if (!(litres > 0)) return null;
  return { prix: arr(euros / litres, 3), n: n, total: total, litres: arr(litres, 1) };
}
function nomNature(c) { var x = trouve(NATURES, c); return x ? x.n : (c || ''); }
function abattementDe(c) { var x = trouve(NATURES, c); return x ? x.abattement : 0.5; }
function estHorsCA(c) { var x = trouve(NATURES, c); return !!(x && x.horsCA); }
/* Les seules catégories qui aient un sens pour une charge fixe. La catégorie
   déjà posée est gardée même si elle n'en fait pas partie : une charge saisie
   avant ce tri ne doit pas se retrouver muette dans son propre formulaire. */
function categoriesFixes(courante) {
  return CATEGORIES.filter(function (x) { return x.fixe || x.c === courante; });
}
/* Ce qui ne porte pas de TVA du tout : assurance, cotisations, prêt. Le
   drapeau existait depuis le début sans être branché nulle part — un taux
   saisi là-dessus faisait croire à une TVA récupérable qui n'existe pas. */
function sansTvaDe(c) { var x = trouve(CATEGORIES, c); return !!(x && x.sansTva); }

/* Les espaces sont retirées avant l'analyse : depuis que fmt() sépare les
   milliers, un « 25 000 » relu dans un champ vaudrait 25. */
function nb(v) {
  if (v == null || v === '') return 0;
  var n = parseFloat(String(v).replace(/[\s\u00A0]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function arr(n, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(n * p) / p; }

/* ---------------------------------------------------------- une dépense
   Le ticket porte un TTC ; le HT et la TVA s'en déduisent. Si la TVA est
   lue sur le ticket, elle prime (les arrondis de caisse ne retombent pas
   toujours sur le calcul théorique). */
/* Un même ticket porte souvent plusieurs natures d'achat : une tronçonneuse
   (immobilisation) et un bidon d'essence (consommable) sur le même passage
   en caisse. Chaque ligne a donc sa catégorie, son montant et son taux.
   Les dépenses saisies avant cette évolution sont relues comme une ligne. */
function lignesDepense(d) {
  if (d && d.lignes && d.lignes.length) return d.lignes;
  if (!d) return [];
  return [{ libelle: d.libelle || '', categorie: d.categorie || 'AUTRE',
    ttc: nb(d.ttc), taux: nb(d.taux), tva: d.tva }];
}
function htLigne(l) {
  var ttc = nb(l && l.ttc), taux = nb(l && l.taux);
  if (l && l.tva != null && l.tva !== '') return arr(ttc - nb(l.tva), 2);
  if (!taux) return arr(ttc, 2);
  return arr(ttc / (1 + taux / 100), 2);
}
function tvaLigne(l) {
  if (l && l.tva != null && l.tva !== '') return arr(nb(l.tva), 2);
  return arr(nb(l && l.ttc) - htLigne(l), 2);
}
function ttcDe(d) {
  return arr(lignesDepense(d).reduce(function (s, l) { return s + nb(l.ttc); }, 0), 2);
}
function htDe(d) {
  return arr(lignesDepense(d).reduce(function (s, l) { return s + htLigne(l); }, 0), 2);
}
function tvaDe(d) {
  return arr(lignesDepense(d).reduce(function (s, l) { return s + tvaLigne(l); }, 0), 2);
}

/* ------------------------------------------------------------- périodes */
function bornes(type, annee, indice) {
  if (type === 'annee') return { debut: new Date(annee, 0, 1).getTime(), fin: new Date(annee, 11, 31, 23, 59, 59).getTime() };
  if (type === 'trimestre') {
    var m = indice * 3;
    return { debut: new Date(annee, m, 1).getTime(), fin: new Date(annee, m + 3, 0, 23, 59, 59).getTime() };
  }
  return { debut: new Date(annee, indice, 1).getTime(), fin: new Date(annee, indice + 1, 0, 23, 59, 59).getTime() };
}
function dansPeriode(ts, b) { return ts != null && ts >= b.debut && ts <= b.fin; }

/* --------------------------------------------------------------- recettes
   Une recette est comptée à la date de facturation (à défaut, de fin de
   chantier). Seuls les chantiers facturés ou payés comptent : un devis
   accepté n'est pas un revenu. */
function dateRecette(ch) {
  return ch.dateFacture || ch.dateFin || ch.maj || null;
}
/* « tauxDe » vient du module des chantiers : lui seul sait le taux d'une
   ligne — celui de ses travaux, réduit ou non selon le SIREN du client.
   Sans lui, ce module retombait sur 20 % pour toute ligne dont le taux n'est
   pas forcé à la main, et la TVA collectée des Finances contredisait celle de
   la fiche. C'est celle des Finances qu'on déclare : elle doit dire vrai.
   Injecté plutôt qu'appelé, comme parFamille() et tauxReussite(). */
function lignesFacturees(chantiers, b, tauxDe) {
  var out = [];
  (chantiers || []).forEach(function (ch) {
    if (['facture', 'paye'].indexOf(ch.statut) < 0) return;
    var d = dateRecette(ch);
    if (b && !dansPeriode(d, b)) return;
    (ch.lignes || []).forEach(function (l) {
      var ht = l.unite === 'forfait' ? nb(l.prix) : nb(l.quantite) * nb(l.prix);
      var taux = tauxDe ? tauxDe(l, ch)
        : ((l.tva != null && l.tva !== '') ? nb(l.tva) : (nb(ch.tva) || 20));
      out.push({ chantier: ch, ligne: l, date: d, ht: arr(ht, 2),
        nature: l.nature || 'prestation', taux: taux, paye: ch.statut === 'paye' });
    });
  });
  return out;
}
/* Chiffre d'affaires : brut, puis après abattement, séparé vente/prestation. */
function chiffreAffaires(chantiers, b) {
  var r = {
    prestation: 0, vente: 0, debours: 0, total: 0,
    prestationApres: 0, venteApres: 0, totalApres: 0,
    encaisse: 0, aEncaisser: 0
  };
  lignesFacturees(chantiers, b).forEach(function (x) {
    /* Une nature inconnue — venue d'une sauvegarde plus ancienne — retombe
       sur la prestation : mieux vaut la ranger au mauvais endroit que la
       perdre du total en silence. */
    var n = r[x.nature] != null ? x.nature : 'prestation';
    r[n] += x.ht;
    /* Le débours traverse le compte sans être une recette : il est suivi,
       jamais additionné au chiffre d'affaires ni à ce qu'il reste à
       encaisser. */
    if (estHorsCA(n)) return;
    r.total += x.ht;
    if (x.paye) r.encaisse += x.ht; else r.aEncaisser += x.ht;
  });
  r.prestationApres = r.prestation * (1 - abattementDe('prestation'));
  r.venteApres = r.vente * (1 - abattementDe('vente'));
  r.totalApres = r.prestationApres + r.venteApres;
  Object.keys(r).forEach(function (k) { r[k] = arr(r[k], 2); });
  return r;
}

/* -------------------------------------------------------------- TVA
   Collectée sur ce qui est facturé, déductible sur les achats payés.
   L'immobilisation est isolée : elle pèse lourd un trimestre et fausse
   la lecture si on la noie dans le reste. */
function tvaCollectee(chantiers, b, tauxDe) {
  var parTaux = {}, total = 0;
  lignesFacturees(chantiers, b, tauxDe).forEach(function (x) {
    var t = x.taux, m = arr(x.ht * t / 100, 2);
    parTaux[t] = arr((parTaux[t] || 0) + m, 2);
    total += m;
  });
  return { parTaux: parTaux, total: arr(total, 2) };
}
function tvaDeductible(depenses, b) {
  var immo = 0, courant = 0, total = 0, parTaux = {};
  (depenses || []).forEach(function (d) {
    if (b && !dansPeriode(d.date, b)) return;
    lignesDepense(d).forEach(function (l) {
      var m = tvaLigne(l);
      if (!m) return;
      if (estImmo(l.categorie)) immo += m; else courant += m;
      parTaux[nb(l.taux)] = arr((parTaux[nb(l.taux)] || 0) + m, 2);
      total += m;
    });
  });
  return { immobilisations: arr(immo, 2), courant: arr(courant, 2), total: arr(total, 2), parTaux: parTaux };
}
function balanceTva(chantiers, depenses, b, tauxDe) {
  var c = tvaCollectee(chantiers, b, tauxDe), d = tvaDeductible(depenses, b);
  var solde = arr(c.total - d.total, 2);
  return {
    collectee: c, deductible: d, solde: solde,
    sens: solde > 0 ? 'a_payer' : (solde < 0 ? 'a_recuperer' : 'nul'),
    montant: Math.abs(solde)
  };
}


/* ================================================== CHARGES FIXES
   Assurance, prêt bancaire, logiciels : même montant, même échéance, tous
   les mois ou tous les ans. On les décrit une fois, l'application génère
   les échéances de la période — rien n'est écrit tant qu'on ne les pointe
   pas comme payées. */
var PERIODICITES = [
  { c: 'mensuel', n: 'Tous les mois', parAn: 12 },
  { c: 'trimestriel', n: 'Tous les trimestres', parAn: 4 },
  { c: 'semestriel', n: 'Tous les six mois', parAn: 2 },
  { c: 'annuel', n: 'Tous les ans', parAn: 1 }
];
function parAn(c) {
  for (var i = 0; i < PERIODICITES.length; i++) if (PERIODICITES[i].c === c) return PERIODICITES[i].parAn;
  return 12;
}
function nomPeriodicite(c) {
  for (var i = 0; i < PERIODICITES.length; i++) if (PERIODICITES[i].c === c) return PERIODICITES[i].n;
  return c || '';
}
/* Coût annuel d'une charge fixe. */
function coutAnnuel(ch) { return arr(nb(ch && ch.ttc) * parAn(ch && ch.periodicite), 2); }
function totalChargesAnnuel(charges) {
  return arr((charges || []).filter(function (c) { return !c.arretee; })
    .reduce(function (s, c) { return s + coutAnnuel(c); }, 0), 2);
}
/* Échéances attendues d'une charge sur une période. */
function echeances(charge, b) {
  if (!charge || charge.arretee) return [];
  var pas = 12 / parAn(charge.periodicite);
  var moisRef = charge.moisReference != null ? Number(charge.moisReference) : 0;
  var jour = Number(charge.jour) || 1;
  var out = [];
  var d = new Date(b.debut), fin = new Date(b.fin);
  var an = d.getFullYear() - 1;
  for (var y = an; y <= fin.getFullYear(); y++) {
    for (var k = 0; k < 12; k += pas) {
      var mo = (moisRef + k) % 12;
      var anEff = y + Math.floor((moisRef + k) / 12);
      /* Replier le jour sur la fin du mois d'arrivée, jamais sur le 28 : un
         prélèvement du 30 tombait deux jours trop tôt, et sa toute première
         échéance passait alors sous « ts < charge.debut » — elle n'était donc
         jamais annoncée. Le 28 était un pansement contre le 31 février ;
         finValiditeDevis replie déjà correctement, de la même façon. */
      var dernier = new Date(anEff, mo + 1, 0).getDate();
      var ts = new Date(anEff, mo, Math.min(jour, dernier), 12).getTime();
      if (ts >= b.debut && ts <= b.fin) {
        if (charge.debut && ts < charge.debut) continue;
        if (charge.fin && ts > charge.fin) continue;
        out.push(ts);
      }
    }
  }
  return out.filter(function (v, i, t) { return t.indexOf(v) === i; }).sort(function (a, b2) { return a - b2; });
}
/* Charges dues sur la période, avec ce qui a déjà été pointé en dépense. */
function chargesDues(charges, depenses, b) {
  var out = [];
  (charges || []).forEach(function (c) {
    echeances(c, b).forEach(function (ts) {
      var paye = (depenses || []).some(function (d) {
        return d.charge === c.id && Math.abs(d.date - ts) < 20 * 86400000;
      });
      out.push({ charge: c, date: ts, paye: paye, ttc: nb(c.ttc) });
    });
  });
  return out.sort(function (a, b2) { return a.date - b2.date; });
}

/* Le préavis suit l'espacement : annoncer quinze jours à l'avance une
   échéance mensuelle la laisserait affichée la moitié du mois, et elle
   deviendrait du décor qu'on ne lit plus. */
var PREAVIS = { mensuel: 3, trimestriel: 7, semestriel: 10, annuel: 14 };
function preavisDe(p) { return PREAVIS[p] != null ? PREAVIS[p] : 7; }

/* Ce qui va tomber du compte. Uniquement ce qui vient : une échéance passée
   n'est pas un oubli, elle a été prélevée toute seule. Réclamer un pointage
   qui ne viendra jamais installerait une alerte permanente. */
function alertesCharges(charges, depenses, maintenant) {
  var now = maintenant || Date.now();
  var JOURMS = 86400000;
  var minuit = function (ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  var b = { debut: minuit(now), fin: minuit(now) + 40 * JOURMS };
  var out = [];
  chargesDues(charges, depenses, b).forEach(function (d) {
    if (d.paye) return;
    var jours = Math.round((minuit(d.date) - minuit(now)) / JOURMS);
    if (jours < 0 || jours > preavisDe(d.charge.periodicite)) return;
    out.push({ charge: d.charge, date: d.date, jours: jours, ttc: d.ttc,
      texte: (jours === 0 ? 'prélevé aujourd’hui'
        : jours === 1 ? 'prélevé demain'
        : 'prélevé dans ' + jours + ' jours') +
        (d.charge.beneficiaire ? ' · ' + d.charge.beneficiaire : '') });
  });
  return out.sort(function (x, y) { return x.date - y.date; });
}

/* ------------------------------------------------------------- dépenses */
function totalDepenses(depenses, b) {
  var r = { ttc: 0, ht: 0, tva: 0, immo: 0, courant: 0, n: 0, parCategorie: {} };
  (depenses || []).forEach(function (d) {
    if (b && !dansPeriode(d.date, b)) return;
    r.n++;
    lignesDepense(d).forEach(function (l) {
      var ht = htLigne(l);
      r.ttc += nb(l.ttc); r.ht += ht; r.tva += tvaLigne(l);
      if (estImmo(l.categorie)) r.immo += ht; else r.courant += ht;
      r.parCategorie[l.categorie] = arr((r.parCategorie[l.categorie] || 0) + ht, 2);
    });
  });
  ['ttc', 'ht', 'tva', 'immo', 'courant'].forEach(function (k) { r[k] = arr(r[k], 2); });
  return r;
}
/* Résultat approché : recettes hors taxes moins achats hors taxes.
   Ce n'est pas le bénéfice fiscal du micro-BIC (qui passe par l'abattement),
   c'est la marge réelle — les deux sont utiles et différents. */
function resultat(chantiers, depenses, b) {
  var ca = chiffreAffaires(chantiers, b), dep = totalDepenses(depenses, b);
  return {
    recettes: ca.total, achats: dep.ht, marge: arr(ca.total - dep.ht, 2),
    baseMicro: ca.totalApres, achatsCourants: dep.courant, immobilisations: dep.immo
  };
}

/* Chiffre d'affaires par donneur d'ordre : lequel rapporte le plus. */
function caParDonneur(chantiers, b) {
  var m = {};
  lignesFacturees(chantiers, b).forEach(function (x) {
    var d = (x.chantier.donneur || '').trim() || '(non précisé)';
    if (!m[d]) m[d] = { donneur: d, ht: 0, chantiers: {} };
    m[d].ht += x.ht;
    m[d].chantiers[x.chantier.id || x.chantier.nom] = 1;
  });
  return Object.keys(m).map(function (k) {
    return { donneur: k, ht: arr(m[k].ht, 2), n: Object.keys(m[k].chantiers).length };
  }).sort(function (a, b2) { return b2.ht - a.ht; });
}


/* ==================================================== ANALYSES
   Répartitions et séries mensuelles. Tout est calculé à la demande à partir
   des chantiers et des dépenses : rien n'est stocké en double. */

/* Recettes mois par mois sur une année (12 valeurs, index 0 = janvier). */
function recettesParMois(chantiers, annee) {
  var t = [];
  for (var i = 0; i < 12; i++) t.push(0);
  lignesFacturees(chantiers, bornes('annee', annee)).forEach(function (x) {
    t[new Date(x.date).getMonth()] += x.ht;
  });
  return t.map(function (v) { return arr(v, 2); });
}
function depensesParMois(depenses, annee) {
  var t = [];
  for (var i = 0; i < 12; i++) t.push(0);
  (depenses || []).forEach(function (d) {
    if (!dansPeriode(d.date, bornes('annee', annee))) return;
    t[new Date(d.date).getMonth()] += htDe(d);
  });
  return t.map(function (v) { return arr(v, 2); });
}
/* Encaissements mois par mois : ce qui est réellement rentré. */
function encaissementsParMois(chantiers, annee) {
  var t = [];
  for (var i = 0; i < 12; i++) t.push(0);
  lignesFacturees(chantiers, bornes('annee', annee)).forEach(function (x) {
    if (x.paye) t[new Date(x.date).getMonth()] += x.ht;
  });
  return t.map(function (v) { return arr(v, 2); });
}

/* Ce que rapporte chaque grande famille. parPrestation() descend au détail des
   prestations ; celle-ci donne l'étage du dessus, celui sur lequel il raisonne
   — et elle rend bien ses sept familles, fournitures et débours compris, sans
   que rien ne soit dit deux fois.
   Les deux fonctions lui sont passées plutôt qu'appelées : le module des
   chantiers ne doit pas être atteint d'ici, sinon les deux finissent par
   diverger. Même raison que tauxReussite(). */
function parFamille(chantiers, b, familleDe, nomFamille) {
  var m = {};
  lignesFacturees(chantiers, b).forEach(function (x) {
    var k = (familleDe ? familleDe(x.ligne) : '') || 'autre';
    if (!m[k]) m[k] = { famille: k, nom: nomFamille ? nomFamille(k) : k, ht: 0, n: 0 };
    m[k].ht += x.ht; m[k].n++;
  });
  var l = Object.keys(m).map(function (k) {
    m[k].ht = arr(m[k].ht, 2); return m[k];
  }).sort(function (a, b2) { return b2.ht - a.ht; });
  var tot = l.reduce(function (s, x) { return s + x.ht; }, 0);
  l.forEach(function (x) { x.part = tot > 0 ? Math.round(x.ht / tot * 100) : 0; });
  return l;
}

/* Ce que rapporte chaque type de prestation. */
function parPrestation(chantiers, b, nomTravail) {
  var m = {};
  lignesFacturees(chantiers, b).forEach(function (x) {
    var k = x.ligne.travail || 'AUTRE';
    if (!m[k]) m[k] = { travail: k, nom: nomTravail ? nomTravail(k) : k, ht: 0, n: 0, quantite: 0, unite: x.ligne.unite };
    m[k].ht += x.ht; m[k].n++;
    /* Une même prestation facturée tantôt à la journée, tantôt au plant :
       cumuler les deux donnait « 1 709 jours » pour 4 jours et 1 705 plants.
       Unités mêlées, on renonce à la quantité plutôt que d'en inventer une. */
    if (m[k].unite !== x.ligne.unite) m[k].unite = null;
    m[k].quantite += nb(x.ligne.quantite);
  });
  var l = Object.keys(m).map(function (k) {
    m[k].ht = arr(m[k].ht, 2); m[k].quantite = arr(m[k].quantite, 2);
    return m[k];
  }).sort(function (a, b2) { return b2.ht - a.ht; });
  var tot = l.reduce(function (s, x) { return s + x.ht; }, 0);
  l.forEach(function (x) { x.part = tot > 0 ? Math.round(x.ht / tot * 100) : 0; });
  return l;
}

/* Dépenses par catégorie, triées par poids. */
function parCategorie(depenses, b, nomCategorie) {
  var m = {};
  (depenses || []).forEach(function (d) {
    if (b && !dansPeriode(d.date, b)) return;
    lignesDepense(d).forEach(function (l) {
      var k = l.categorie || 'AUTRE';
      if (!m[k]) m[k] = { categorie: k, nom: nomCategorie ? nomCategorie(k) : k, ht: 0, ttc: 0, tva: 0, n: 0, immo: estImmo(k) };
      m[k].ht += htLigne(l); m[k].ttc += nb(l.ttc); m[k].tva += tvaLigne(l); m[k].n++;
    });
  });
  var l = Object.keys(m).map(function (k) {
    ['ht', 'ttc', 'tva'].forEach(function (x) { m[k][x] = arr(m[k][x], 2); });
    return m[k];
  }).sort(function (a, b2) { return b2.ht - a.ht; });
  var tot = l.reduce(function (s, x) { return s + x.ht; }, 0);
  l.forEach(function (x) { x.part = tot > 0 ? Math.round(x.ht / tot * 100) : 0; });
  return l;
}

/* Dépenses par fournisseur : chez qui part l'argent. */
function parFournisseur(depenses, b) {
  var m = {};
  (depenses || []).forEach(function (d) {
    if (b && !dansPeriode(d.date, b)) return;
    var k = (d.fournisseur || '').trim() || '(non précisé)';
    if (!m[k]) m[k] = { fournisseur: k, ht: 0, n: 0 };
    m[k].ht += htDe(d); m[k].n++;
  });
  return Object.keys(m).map(function (k) { m[k].ht = arr(m[k].ht, 2); return m[k]; })
    .sort(function (a, b2) { return b2.ht - a.ht; });
}

/* Cotisations et impôt estimés. Aucun taux n'est imposé : ce sont ceux que
   l'utilisateur saisit, appliqués à la base qu'il choisit. */
function simulation(chantiers, b, cfg) {
  var ca = chiffreAffaires(chantiers, b);
  var c = cfg || {};
  var baseCot = c.baseCotisations === 'brut' ? ca.total : ca.totalApres;
  var baseImp = c.baseImpot === 'brut' ? ca.total : ca.totalApres;
  var tCot = nb(c.tauxCotisations), tImp = nb(c.tauxImpot);
  return {
    ca: ca,
    baseCotisations: arr(baseCot, 2), tauxCotisations: tCot,
    cotisations: arr(baseCot * tCot / 100, 2),
    baseImpot: arr(baseImp, 2), tauxImpot: tImp,
    impot: arr(baseImp * tImp / 100, 2),
    total: arr(baseCot * tCot / 100 + baseImp * tImp / 100, 2),
    reste: arr(ca.total - (baseCot * tCot / 100 + baseImp * tImp / 100), 2)
  };
}

/* L'impôt au barème, tel qu'il le calcule : quand d'autres revenus du foyer
   consomment déjà la tranche à 0 %, ce qui arrive ici entre directement dans
   la tranche à 11 %, dont il reste une capacité, puis bascule au taux
   suivant. Les trois nombres sont à lui : les tranches changent chaque année,
   et sa situation aussi. Rien n'est officiel ici.

   La capacité n'a PAS de valeur par défaut. Elle en a eu une, tirée de sa
   situation — et le dépôt est public. Sans elle, l'impôt ne s'estime pas :
   un chiffre inventé serait pire qu'un blanc qui dit ce qui manque. */
function impotEstime(base, cfg) {
  var c = cfg || {};
  var capacite = c.impotCapacite != null && c.impotCapacite !== '' ? nb(c.impotCapacite) : null;
  var t1 = c.impotTaux1 != null ? nb(c.impotTaux1) : 11;
  var t2 = c.impotTaux2 != null ? nb(c.impotTaux2) : 30;
  if (capacite == null) {
    return { capacite: null, t1: t1, t2: t2, base1: null, base2: null,
      tranche1: null, tranche2: null, total: null };
  }
  var b1 = Math.min(nb(base), capacite), b2 = Math.max(0, nb(base) - capacite);
  return { capacite: capacite, t1: t1, t2: t2, base1: arr(b1, 2), base2: arr(b2, 2),
    tranche1: arr(b1 * t1 / 100, 2), tranche2: arr(b2 * t2 / 100, 2),
    total: arr(b1 * t1 / 100 + b2 * t2 / 100, 2) };
}

/* Le versement libératoire : l'impôt payé avec les cotisations, en
   pourcentage du chiffre d'affaires BRUT — ni abattement, ni tranche. « Je
   vais sûrement passer au versement libératoire pour l'an prochain. » Les
   taux sont les siens, modifiables : 1 % sur les ventes et 1,7 % sur les
   prestations à ce jour. Le débours reste dehors, comme partout.

   Il vaut à partir d'une année : les années d'avant restent au barème, sinon
   cocher la case réécrirait les estimations passées. */
function vlApplicable(cfg, annee) {
  var d = cfg && cfg.vlDepuis;
  return d != null && d !== '' && nb(annee) >= nb(d);
}
function versementLiberatoire(ca, cfg) {
  var c = cfg || {};
  var tv = c.vlTauxVente != null ? nb(c.vlTauxVente) : 1;
  var tp = c.vlTauxPresta != null ? nb(c.vlTauxPresta) : 1.7;
  var v = arr(nb(ca && ca.vente) * tv / 100, 2);
  var p = arr(nb(ca && ca.prestation) * tp / 100, 2);
  return { tauxVente: tv, tauxPresta: tp, vente: v, prestation: p, total: arr(v + p, 2) };
}

/* Taux de réussite des devis : combien de propositions se transforment.
   Qui a un devis se lit sur la fiche depuis la 4.36 ; la règle vit dans le
   module chantiers, qu'on ne veut pas appeler d'ici — elle arrive donc en
   second argument. Sans elle, l'ancienne lecture, qui devinait. */
function tauxReussite(chantiers, aDevis) {
  var proposes = 0, gagnes = 0, perdus = 0, enAttente = 0;
  var estDevis = aDevis || function (ch) {
    return !!ch.dateEnvoi || ['devis', 'envoye', 'sansuite'].indexOf(ch.statut) >= 0;
  };
  (chantiers || []).forEach(function (ch) {
    if (!estDevis(ch)) return;
    proposes++;
    if (['accepte', 'encours', 'termine', 'facture', 'paye'].indexOf(ch.statut) >= 0) gagnes++;
    else if (ch.statut === 'sansuite') perdus++;
    else enAttente++;
  });
  var tranches = gagnes + perdus;
  return { proposes: proposes, gagnes: gagnes, perdus: perdus, enAttente: enAttente,
    taux: tranches ? Math.round(gagnes / tranches * 100) : null };
}

var M = {
  CATEGORIES: CATEGORIES, TAUX_TVA: TAUX_TVA, NATURES: NATURES,
  nomCategorie: nomCategorie, estImmo: estImmo, nomNature: nomNature, abattementDe: abattementDe,
  estHorsCA: estHorsCA, categoriesFixes: categoriesFixes, sansTvaDe: sansTvaDe,
  nb: nb, arr: arr, htDe: htDe, tvaDe: tvaDe, ttcDe: ttcDe,
  lignesDepense: lignesDepense, htLigne: htLigne, tvaLigne: tvaLigne,
  estCarburant: estCarburant, prixLitreMoyen: prixLitreMoyen,
  PRIORITES_ACHAT: PRIORITES_ACHAT, nomPriorite: nomPriorite, coulPriorite: coulPriorite,
  achatsRanges: achatsRanges, totauxAchats: totauxAchats,
  bornes: bornes, dansPeriode: dansPeriode,
  dateRecette: dateRecette, lignesFacturees: lignesFacturees, chiffreAffaires: chiffreAffaires,
  tvaCollectee: tvaCollectee, tvaDeductible: tvaDeductible, balanceTva: balanceTva,
  totalDepenses: totalDepenses, resultat: resultat, tauxReussite: tauxReussite,
  caParDonneur: caParDonneur,
  recettesParMois: recettesParMois, depensesParMois: depensesParMois,
  encaissementsParMois: encaissementsParMois,
  parPrestation: parPrestation, parFamille: parFamille,
  parCategorie: parCategorie, parFournisseur: parFournisseur,
  simulation: simulation, impotEstime: impotEstime,
  vlApplicable: vlApplicable, versementLiberatoire: versementLiberatoire,
  PERIODICITES: PERIODICITES, parAn: parAn, nomPeriodicite: nomPeriodicite,
  coutAnnuel: coutAnnuel, totalChargesAnnuel: totalChargesAnnuel,
  echeances: echeances, chargesDues: chargesDues,
  preavisDe: preavisDe, alertesCharges: alertesCharges
};
if (typeof window !== 'undefined') window.BCF = M;
if (typeof module === 'object' && module.exports) module.exports = M;

})();

