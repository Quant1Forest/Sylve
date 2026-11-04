/* ========================================================== AUJOURD'HUI
   L'écran d'arrivée (lot 5b), allégé au lot r1 (A1 à A4) : la journée ·
   En retard · Chantiers en cours · Prélèvements à venir · Derniers jours ·
   Autres rappels, repliés en bas. « Aujourd'hui me servait peu » : il garde
   ce qui sert — sa journée, ce qui presse vraiment, ses chantiers en cours.
   Chaque ligne dit une chose et mène là où elle se fait ; aucune ne calcule
   rien de neuf, toutes relisent les alertes qui existaient déjà. */

var JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
var MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août',
  'sept.', 'oct.', 'nov.', 'déc.'];
function majuscule(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
/* « lun. 2 nov. » : assez court pour la colonne de droite d'une ligne. */
function jourCourt(ts, sansMois) {
  var d = new Date(ts);
  return JOURS_COURTS[(d.getDay() + 6) % 7] + '. ' + d.getDate() +
    (sansMois ? '' : ' ' + MOIS_COURTS[d.getMonth()]);
}
function ecartJours(de, a) { return Math.round((C.minuit(a) - C.minuit(de)) / C.JOUR); }
function ilYa(ts) {
  var n = ecartJours(ts, Date.now());
  return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : 'il y a ' + n + ' j';
}

/* ------------------------------------------------------------ masquer */
/* Une ligne chassée d'un doigt revient le lendemain, tant que rien n'est
   réglé. Avant, elle revenait au lancement suivant : un téléphone qu'on ne
   ferme jamais ne la remontrait plus, et un téléphone qu'on rouvre dix fois
   la remontrait dix fois. On ne garde que les masques du jour. */
function masquee(cle) {
  return !!(A.masques && A.masques[cle] === C.jourCle(Date.now()));
}
function masquer(cle) {
  var auj = C.jourCle(Date.now()), garde = {};
  Object.keys(A.masques || {}).forEach(function (k) { if (A.masques[k] === auj) garde[k] = auj; });
  garde[cle] = auj;
  A.masques = garde;
  ecrire('bordcub.masques', A.masques);
  renderAujourdhui();
}

/* -------------------------------------------------------------- lignes */
/* Une ligne : de quoi l'écrire et où elle mène (« ouvre » = « quoi:qui »,
   lu par OUVRIR_AUJ). */
function ligneAuj(l) {
  return '<div class="aj-l' + (l.ton ? ' aj-' + l.ton : '') + '" data-ajcle="' + esc(l.cle) + '">' +
    '<button type="button" class="aj-ouvre" data-ajouvre="' + esc(l.ouvre) + '">' +
    '<span class="aj-pic">' + picto(l.picto) + '</span>' +
    '<span class="aj-txt"><b>' + esc(l.titre) + '</b>' +
    (l.sous ? '<small>' + esc(l.sous) + '</small>' : '') + '</span>' +
    (l.montant || l.petit || l.etiq ? '<span class="aj-droite">' +
      (l.montant ? '<b class="num">' + eur(l.montant) + '</b>' : '') +
      (l.petit ? '<small>' + esc(l.petit) + '</small>' : '') +
      (l.etiq ? '<span class="aj-etiq">' + esc(l.etiq) + '</span>' : '') + '</span>' : '') +
    '</button>' +
    '<button type="button" class="aj-x" data-ajmasque="' + esc(l.cle) + '" ' +
    'title="Masquer jusqu’à demain" aria-label="Masquer jusqu’à demain">×</button></div>';
}
function lignesVisibles(l) { return l.filter(function (x) { return !masquee(x.cle); }); }
function blocAuj(id, titre, ton, corps, compte) {
  return '<section class="aj-bloc" id="aj-' + id + '">' +
    '<h2 class="aj-sous' + (ton ? ' aj-' + ton : '') + '">' + titre +
    (compte != null ? ' <span class="aj-compte">' + compte + '</span>' : '') + '</h2>' +
    corps + '</section>';
}

/* La ligne du haut : l'ancienne ligne sous « Enregistrer ma journée ». La
   semaine part du lundi : « cette semaine » ne veut pas dire « ces sept
   derniers jours ». */
function ligneSaisie() {
  var now = Date.now(), auj = C.jourCle(now);
  var lundi = C.minuit(now) - ((new Date(now).getDay() + 6) % 7) * C.JOUR;
  var faite = (A.journees || []).some(function (j) { return C.jourCle(j.date) === auj; });
  var jours = {}, h = 0;
  /* Au jour, pas à l'heure : une journée se date à midi, et ne doit pas
     manquer au compte quand on regarde à neuf heures. */
  (A.journees || []).forEach(function (j) {
    if (C.minuit(C.nb(j.date)) < lundi || C.minuit(C.nb(j.date)) > C.minuit(now)) return;
    jours[C.jourCle(j.date)] = 1;
    h += C.heuresJournee(j);
  });
  var n = Object.keys(jours).length;
  return '<button type="button" class="aj-saisie" id="aj-jour">' +
    '<span class="aj-pic">' + picto('horloge') + '</span>' +
    '<span class="aj-txt"><b>' + (faite ? 'Déjà saisi aujourd’hui' : 'Rien de saisi aujourd’hui') + '</b>' +
    '<small>Cette semaine : ' + (n ? E.fmt(C.arr(h, 1), h % 1 ? 1 : 0) + ' h sur ' + n + ' jour' + (n > 1 ? 's' : '')
      : 'rien de saisi') + '</small></span>' +
    '<span class="aj-etiq vert">Ma journée</span></button>';
}

/* En retard (A3) : trois choses, dans cet ordre. Les factures échues d'abord
   (« le plus important »), puis les chantiers terminés pas facturés, puis
   les devis sans réponse à une semaine de la fin de leur validité, ou au-delà
   (sans validité, le délai de relance des réglages). Le reste est parti : les
   jours à trancher n'existent plus (la journée d'office les remplace), le
   chantier aux jours passés se dit sur sa ligne, et la sauvegarde, le stock
   et le véhicule sont dans « Autres rappels ». */
var TYPES_EN_RETARD = ['impaye', 'afacturer', 'devis'];
function lignesRetard() {
  var now = Date.now(), l = [];
  var al = C.alertes(A.chantiers, A.cfg, now);
  var donneur = function (c) { return C.nomChantier(c) + (c.donneur ? ' · ' + c.donneur : ''); };
  al.filter(function (a) { return a.type === 'impaye'; }).forEach(function (a) {
    l.push({ cle: 'impaye:' + a.chantier.id, ton: 'alerte', picto: 'finances',
      titre: 'Facture impayée', sous: donneur(a.chantier),
      montant: C.montant(a.chantier),
      petit: a.chantier.echeancePaiement ? 'échue depuis ' + a.jours + ' j' : 'facturée il y a ' + a.jours + ' j',
      ouvre: 'fiche:' + a.chantier.id });
  });
  al.filter(function (a) { return a.type === 'afacturer'; }).forEach(function (a) {
    l.push({ cle: 'afacturer:' + a.chantier.id, ton: 'tiede', picto: 'chantier',
      titre: 'Facture à faire', sous: donneur(a.chantier),
      montant: C.montant(a.chantier), petit: 'terminé ' + ilYa(a.chantier.dateFin),
      ouvre: 'fiche:' + a.chantier.id });
  });
  al.filter(function (a) { return a.type === 'devis'; }).forEach(function (a) {
    l.push({ cle: 'relancer:' + a.chantier.id, ton: a.gravite > 1 ? 'alerte' : 'tiede', picto: 'note',
      titre: 'Relancer le devis ?', sous: donneur(a.chantier),
      montant: C.montant(a.chantier), petit: a.texte, ouvre: 'fiche:' + a.chantier.id });
  });
  return l;
}
function ligneVehicule(x, ton, quoi) {
  return { cle: 'vehicule:' + x.p.id, ton: ton, picto: 'carnetv', titre: x.p.nom || 'Entretien',
    sous: 'Véhicule · ' + quoi,
    petit: x.aDate != null ? jourCourt(x.aDate) : (x.aKm != null ? E.fmt(x.aKm, 0) + ' km' : ''),
    ouvre: 'vehicule:' };
}
/* Autres rappels (A1) : ce qui ne porte sur aucun chantier — la sauvegarde
   du mois, le stock à recommander, l'entretien du véhicule. Repliés tout en
   bas : ils restent là, sans repousser ce qui presse. Même lien qu'avant. */
function lignesAutres() {
  var now = Date.now(), l = [];
  var c = contenuSauvegarde();
  if (c.length && B.sauvegardeAncienne(A.export, now)) {
    var q = B.depuisQuand(A.export, now);
    l.push({ cle: 'sauvegarde', ton: 'alerte', picto: 'sauvegarde', titre: 'Sauvegarde à faire',
      sous: (q ? 'Dernière copie ' + q : 'Aucune copie n’est sortie de ce téléphone') +
        ' · ' + listerContenu(c),
      etiq: 'Sauvegarder', ouvre: 'sauvegarde:' });
  }
  var ar = ST.aRecommander(A.articles);
  if (ar.length) {
    l.push({ cle: 'stock', picto: 'stock2',
      titre: 'À recommander : ' + ar.length + ' fourniture' + (ar.length > 1 ? 's' : ''),
      sous: ar.map(function (x) {
        return (x.article.nom || 'Produit') + (x.raison === 'manque'
          ? ' (il en manque ' + E.fmt(x.manque, x.manque % 1 ? 2 : 0) + ' ' + ST.courtUniteArt(x.article.unite) + ')'
          : x.raison === 'rupture' ? ' (rupture)' : ' (sous le seuil)');
      }).join(' · '),
      ouvre: 'stock:' });
  }
  echeancesVehicule().forEach(function (x) {
    if (x.etat === 'retard') l.push(ligneVehicule(x, 'alerte', 'échéance dépassée'));
    else if (x.etat === 'bientot') l.push(ligneVehicule(x, '', 'échéance proche'));
  });
  return l;
}

/* Les chantiers en cours (A4) : tous ceux qui ne sont ni payés ni sans
   suite, de l'annonce à la facture. Rangés par étape, du début du cycle à la
   fin, et dans chaque étape le plus ancien en haut — « les plus importants
   arrivent au début ». Une facture envoyée reste là jusqu'au paiement. */
var ETAPE_DE_STATUT = { devis: 0, envoye: 1, accepte: 2, encours: 2, termine: 3, facture: 4, paye: 5 };
function pointsEtape(c) {
  var e = ETAPE_DE_STATUT[c.statut] || 0;
  return '<span class="aj-points" aria-label="Étape ' + (e + 1) + ' sur 5">' +
    [0, 1, 2, 3, 4].map(function (i) {
      return '<i class="' + (i < e ? 'f' : i === e ? 'e' : '') + '"></i>';
    }).join('') + '</span>';
}
/* Le jour où le chantier est entré dans son étape, quand il se lit ; sinon
   celui de l'annonce. */
function entreeEtape(c) {
  var e = C.etapeChantier(c);
  var d = e === 1 ? (C.nb(c.dateEnvoi) || C.nb(c.dateDevis))
    : e === 2 ? C.nb(c.dateSignature)
    : e === 3 ? C.nb(c.dateFin)
    : e === 4 ? C.nb(c.dateFacture) : 0;
  return d || C.dateEntree(c);
}
/* La situation d'un chantier, en une ligne : la même ici et dans la liste
   Chantiers (lot b2). Le n° de facture y reste : c'est par lui qu'il
   retrouve un chantier réglé. Sur Aujourd'hui (lot r1), plus de « N jours à
   placer » — l'estimation s'affine en route, elle reste dans la fiche — et
   le chantier à l'étape Infos dit s'il a été repéré (C1, venu de Bientôt). */
function situationChantier(c, now, surAujourdhui) {
  var base = C.nomStatut(c.statut, c);
  var noF = c.numeroFacture ? ' · n° ' + c.numeroFacture : '';
  if (c.statut === 'devis') {
    var q = C.dateEntree(c);
    if (surAujourdhui) {
      return { t: 'Devis à faire · ' + (c.dateReperage ? 'repéré ' + ilYa(c.dateReperage)
        : (q ? 'annoncé ' + ilYa(q) + ' · ' : '') + 'pas encore repéré'), ton: '' };
    }
    if (c.dateReperage) return { t: 'Repéré le ' + dateCourte(c.dateReperage) + ' · devis à faire', ton: '' };
    return { t: 'Annoncé ' + (q ? ilYa(q) : '') + ' · devis à faire', ton: '' };
  }
  if (c.statut === 'envoye') {
    return { t: base + (c.dateEnvoi ? ' ' + ilYa(c.dateEnvoi) + ', sans réponse' : ''), ton: '' };
  }
  if (c.statut === 'accepte' || c.statut === 'encours') {
    var reste = surAujourdhui ? null : C.resteAPlacer(c);
    var mot = c.statut === 'encours' ? base : (C.aDevis(c) ? 'Signé' : 'Sans devis') + ' · à programmer';
    return { t: mot + (reste != null && reste > 0 ? ' · ' + C.fmtJours(reste) + ' à placer' : ''),
      ton: c.statut === 'encours' ? 'vert' : '' };
  }
  /* « Comme ça je peux mettre facturé le, ensuite payé le » : l'écart entre
     les deux est ce qu'il vient lire. */
  var factLe = c.dateFacture ? 'Facturé le ' + dateCourte(c.dateFacture) : '';
  if (c.statut === 'paye') {
    var payeLe = c.datePaiement ? 'payé le ' + dateCourte(c.datePaiement) : '';
    return { t: ([factLe, payeLe].filter(Boolean).join(' · ') || base).replace(/^p/, 'P') + noF, ton: '' };
  }
  if (c.statut === 'sansuite') {
    return { t: base + (c.motifRefus ? ' · ' + C.nomMotifRefus(c.motifRefus).toLowerCase() : ''), ton: '' };
  }
  if (c.statut === 'termine') {
    return { t: c.dateFin ? 'Terminé ' + ilYa(c.dateFin) + ', à facturer' : base, ton: 'tiede' };
  }
  if (c.statut === 'facture') {
    var r = C.retardPaiement(c, now);
    if (r != null) return { t: 'Facture échue depuis ' + r + ' j' + noF, ton: 'alerte' };
    return { t: (factLe || base) + (c.echeancePaiement ? ' · à payer avant le ' + dateCourte(c.echeancePaiement) : '') + noF, ton: '' };
  }
  return { t: base, ton: '' };
}
/* Le mot du calendrier, sur la ligne du chantier (A2) : un jour posé dans les
   trois jours — ce que disait Bientôt —, ou plus aucun jour posé devant alors
   que le chantier n'est pas terminé — ce que disait « jours passés ». */
function motCalendrier(c, now) {
  var m = C.minuit(now);
  var prochain = C.journeesPlacees(c).filter(function (x) { return x.d >= m; })[0];
  if (prochain) {
    var d = ecartJours(now, prochain.d);
    if (d > 3) return '';
    return d === 0 ? 'posé aujourd’hui' : d === 1 ? 'posé demain' : 'posé dans ' + d + ' j';
  }
  return C.enRetard(c, now) ? 'plus de jour posé' : '';
}
var ETAPES_AUJ = ['Infos et repérage', 'Devis', 'Travaux', 'Facture', 'Paiement'];
function chantiersEnCours() {
  return C.filtre(A.chantiers, 'ouverts').slice().sort(function (a, b) {
    return C.etapeChantier(a) - C.etapeChantier(b) || entreeEtape(a) - entreeEtape(b);
  });
}
function lignesEnCours() {
  var now = Date.now(), et = -1;
  /* Ce qui est en retard se dit en rouge sur sa ligne aussi. */
  var enRetard = {};
  C.alertes(A.chantiers, A.cfg, now).forEach(function (a) {
    if (TYPES_EN_RETARD.indexOf(a.type) >= 0) enRetard[a.chantier.id] = 1;
  });
  var h = '';
  chantiersEnCours().forEach(function (c) {
    var e = C.etapeChantier(c);
    if (e !== et) { et = e; h += '<p class="aj-etape" data-etape="' + e + '">' + esc(ETAPES_AUJ[e] || '') + '</p>'; }
    var s = situationChantier(c, now, true), m = C.montant(c), mot = motCalendrier(c, now);
    var ton = enRetard[c.id] ? 'alerte' : s.ton;
    h += '<button type="button" class="aj-ch" data-ajouvre="fiche:' + esc(c.id) + '" data-ajch="' + esc(c.id) + '">' +
      '<span class="aj-txt"><b>' + esc(C.nomChantier(c)) + '</b>' +
      (c.donneur || c.commune ? '<small>' + esc([c.donneur, c.commune].filter(Boolean).join(' · ')) + '</small>' : '') +
      '<span class="aj-situ' + (ton ? ' aj-' + ton : '') + '">' + esc(s.t) +
      (mot ? ' <span class="aj-mot">· ' + esc(mot) + '</span>' : '') + '</span></span>' +
      '<span class="aj-droite">' + (m ? '<b class="num">' + eur(m) + '</b>' : '') + pointsEtape(c) + '</span>' +
      '</button>';
  });
  return h;
}

/* Les prélèvements des charges fixes, séparés des tâches : on ne les fait
   pas, on les voit venir. */
function lignesPrelevements() {
  return lignesVisibles(FIN.alertesCharges(A.charges, A.depenses, Date.now(), 7).map(function (a) {
    return { cle: 'prelevement:' + a.charge.id + ':' + C.jourCle(a.date), picto: 'charges',
      titre: (a.charge.libelle || 'Charge') + ' · ' + FIN.nomPeriodicite(a.charge.periodicite).toLowerCase(),
      sous: a.texte, montant: C.nb(a.ttc), petit: jourCourt(a.date), ouvre: 'charges:' };
  }));
}

/* Ce qu'une journée a fait, prestation par prestation : « Plantation 200
   plants ». Partagé avec l'historique de l'Agenda. */
function faitsDeJournee(j) {
  return (j.postes || []).map(function (p) {
    return C.nomTravail(p.travaux) + (C.nb(p.quantite)
      ? ' ' + E.fmt(C.nb(p.quantite), C.nb(p.quantite) % 1 ? 2 : 0) + ' ' + C.courtUnite(C.uniteDe(p.travaux))
      : '');
  });
}
/* Les trois derniers jours : de quoi corriger hier sans ouvrir l'Agenda. Un
   appui rouvre la fenêtre Ma journée sur ce jour-là. Une journée comptée
   d'office y est aussi, avec son ○ tant qu'il n'a pas ouvert sa fiche : un
   appui ouvre la fiche du jour, d'où on la précise. */
function lignesDerniersJours() {
  var now = Date.now(), h1 = function (h) { return E.fmt(C.arr(h, 1), h % 1 ? 1 : 0) + ' h'; };
  var l = (A.journees || []).filter(function (j) { return C.minuit(C.nb(j.date)) <= C.minuit(now); })
    .map(function (j) { return { ts: C.nb(j.date), j: j }; })
    .concat(journeesDOffice().map(function (o) { return { ts: C.minuit(o.d) + 12 * 3600000, o: o }; }));
  return l.sort(function (a, b) { return b.ts - a.ts; }).slice(0, 3)
    .map(function (x) {
      if (x.o) {
        return '<button type="button" class="aj-jour" data-ajouvre="jour:' + C.minuit(x.ts) + '">' +
          '<span class="aj-txt"><b>' + esc(majuscule(jourCourt(x.ts, true)) + ' · ' +
            C.nomChantier(x.o.chantier) + ' · ' + h1(x.o.heures)) + '</b>' +
          '<small>' + (x.o.vu ? '' : '<span class="aj-o">○</span> ') +
          'comptée d’office · un appui pour préciser</small></span></button>';
      }
      var j = x.j, c = j.chantier ? chantier(j.chantier) : null;
      var faits = faitsDeJournee(j);
      return '<button type="button" class="aj-jour" data-ajouvre="journee:' + esc(j.id) + '">' +
        '<span class="aj-txt"><b>' + esc(majuscule(jourCourt(j.date, true)) + ' · ' +
          (c ? C.nomChantier(c) : (j.lieu || 'sans chantier')) + ' · ' + h1(C.heuresJournee(j))) + '</b>' +
        (faits.length ? '<small>' + esc(faits.join(', ')) + '</small>' : '') + '</span></button>';
    });
}

function renderAujourdhui() {
  var z = $('#aj-haut'); if (!z) return;
  indexAJour();
  var d = new Date();
  $('#aj-date').textContent = majuscule(JOURS_LONGS[d.getDay()]) + ' ' + d.getDate() + ' ' + MOIS_NOMS[d.getMonth()];
  var ret = lignesVisibles(lignesRetard());
  z.innerHTML = '<div id="aj-saisie">' + ligneSaisie() + '</div>' +
    (ret.length ? blocAuj('retard', 'En retard', 'alerte',
      '<div class="aj-zone">' + ret.map(ligneAuj).join('') + '</div>', ret.length)
      : '<p class="aj-calme" id="aj-calme">Rien en retard.</p>');
  var n = chantiersEnCours().length, pr = lignesPrelevements(), dj = lignesDerniersJours();
  var au = lignesVisibles(lignesAutres());
  $('#aj-bas').innerHTML =
    (n ? blocAuj('encours', 'Chantiers en cours', '',
      '<div class="aj-zone">' + lignesEnCours() + '</div>', n) : '') +
    /* Le total, que l'ancien rappel donnait dès deux échéances. */
    (pr.length ? blocAuj('prelevements', 'Prélèvements à venir', '',
      '<div class="aj-zone aj-discrete">' + pr.map(ligneAuj).join('') + '</div>',
      pr.length > 1 ? eur(pr.reduce(function (s, l) { return s + l.montant; }, 0)) : null) : '') +
    blocAuj('jours', 'Derniers jours', '', '<div class="aj-zone aj-discrete">' + dj.join('') +
      '<button type="button" class="aj-lien" data-ajouvre="agenda:">Tout l’historique dans l’Agenda' +
      picto('chevron') + '</button></div>') +
    (au.length ? '<details class="aj-autres" id="aj-autres"' + (A.autresOuverts ? ' open' : '') + '>' +
      '<summary>Autres rappels (' + au.length + ')' + picto('chevron') + '</summary>' +
      '<div class="aj-zone">' + au.map(ligneAuj).join('') + '</div></details>' : '');
  renderNotes();
}

/* Où mène chaque ligne. */
var OUVRIR_AUJ = {
  fiche: function (id) { ouvrirChantier(id); },
  jour: function (ts) { ouvrirFicheJour(Number(ts)); },
  sauvegarde: function () { allerReglages('sauvegarde'); },
  stock: function () { allerModule('stock'); },
  vehicule: function () { allerModule('vehicule', 'echeancesv'); },
  charges: function () { allerModule('finances', 'charges'); },
  journee: function (id) { ouvrirJournee(id); },
  agenda: function () { allerModule('calendrier', 'calendrier'); }
};
function brancherAujourdhui() {
  $('#aj-haut').addEventListener('click', function (e) {
    if (e.target.closest('#aj-jour')) ouvrirJournee(null);
  });
  $('#vue-accueil').addEventListener('click', function (e) {
    var x = e.target.closest('[data-ajmasque]');
    if (x) { masquer(x.dataset.ajmasque); return; }
    var o = e.target.closest('[data-ajouvre]'); if (!o) return;
    var k = o.dataset.ajouvre, i = k.indexOf(':');
    OUVRIR_AUJ[k.slice(0, i)](k.slice(i + 1));
  });
  /* « toggle » ne remonte pas : on l'écoute à la descente. Déplié, le bloc
     le reste tant que l'application est ouverte. */
  $('#vue-accueil').addEventListener('toggle', function (e) {
    if (e.target.id === 'aj-autres') A.autresOuverts = e.target.open;
  }, true);
  brancherNotes();
}

/* ============================================================ MES NOTES
   Les notes qu'il s'écrit à lui-même. Elles vivaient sous les tuiles de Mon
   entreprise, puis sur Aujourd'hui ; depuis le lot r1 elles ont leur écran,
   ☰ ▸ Mes notes, avec les mêmes gestes. Elles restent tant qu'il ne les
   efface pas. Une nouvelle note naît du + (+ ▸ Note), comme tout ce qui se
   crée. */
var COUL_NOTE = [
  { c: '#B4231F', n: 'rouge' }, { c: '#C4611B', n: 'orange' },
  { c: '#B98A00', n: 'or' }, { c: '#2E7D46', n: 'vert' },
  { c: '#1F5FA9', n: 'bleu' }, { c: '#6F6A5C', n: 'gris' }
];
/* Une note est une liste : des éléments à cocher, comme une liste de courses.
   Avant la 4.85 elle portait un seul texte ; il devient son premier élément,
   non coché, la première fois qu'on la lit. */
function notes() {
  A.cfg = A.cfg || {};
  A.cfg.notes = A.cfg.notes || [];
  A.cfg.notes.forEach(function (n) {
    if (Array.isArray(n.items)) return;
    n.items = n.texte ? [{ id: uid(), texte: n.texte, fait: false }] : [];
    delete n.texte;
  });
  return A.cfg.notes;
}
function noteParId(id) {
  return notes().filter(function (x) { return x.id === id; })[0] || null;
}
/* Les éléments cochés descendent en bas ; l'ordre de saisie est gardé dans la
   base, de sorte qu'en décochant un élément il reprend sa place. */
function itemsAffiches(n) {
  var a = n.items || [];
  return a.filter(function (x) { return !x.fait; }).concat(a.filter(function (x) { return x.fait; }));
}
function renderNotes() {
  var z = $('#aj-notes'); if (!z) return;
  var mes = notes();
  var reste = function (n) { return (n.items || []).filter(function (x) { return !x.fait; }).length; };
  var af = mes.reduce(function (s, n) { return s + reste(n); }, 0);
  z.innerHTML = '<h2 class="aj-sous">Mes notes' +
    (af ? ' <span class="aj-compte">' + af + ' à faire</span>' : '') + '</h2>' +
    mes.map(function (n) {
      var r = reste(n);
      return '<div class="note-c" data-note-id="' + esc(n.id) + '" style="--c:' + esc(n.couleur || '#6F6A5C') + '">' +
        '<div class="note-t">' +
        '<button class="note-titre" data-note="' + esc(n.id) + '" title="Modifier la note">' +
        esc(n.titre || 'Note') + '</button>' +
        '<small class="note-reste">' + ((n.items || []).length ? (r ? r + ' à faire' : 'tout est fait') : '') + '</small>' +
        '<button class="fermer" data-notesup="' + esc(n.id) + '" title="Supprimer cette note" ' +
        'aria-label="Supprimer la note">×</button></div>' +
        itemsAffiches(n).map(function (it) {
          return '<div class="note-i' + (it.fait ? ' fait' : '') + '">' +
            '<input type="checkbox" data-nt-coche="' + esc(it.id) + '"' + (it.fait ? ' checked' : '') +
            ' aria-label="Fait">' +
            '<span class="note-texte">' + esc(it.texte) + '</span>' +
            '<button class="fermer" data-nt-supitem="' + esc(it.id) + '" title="Supprimer cet élément" ' +
            'aria-label="Supprimer l’élément">×</button></div>';
        }).join('') +
        '<input type="text" class="note-ajout" data-nt-ajout="' + esc(n.id) + '" autocomplete="off" ' +
        'enterkeyhint="next" placeholder="ajouter…" aria-label="Ajouter à ' + esc(n.titre || 'la note') + '"></div>';
    }).join('') +
    (mes.length
      ? '<p class="aj-aide">Nouvelle note : + ▸ Note.</p>'
      : '<div class="aj-zone aj-discrete"><p class="aj-vide">Le + en bas ▸ Note : pour vous écrire ce ' +
        'qu’il ne faut pas oublier — un chantier qui se prépare, un appel à passer.</p></div>');
}
function ouvrirNote(id) {
  var l = notes();
  var n = id ? noteParId(id) : null;
  var coul = (n && n.couleur) || COUL_NOTE[4].c;
  modale(id ? 'Modifier la note' : 'Une note à moi-même',
    '<div class="champ"><label class="eyebrow" for="nt-titre">Quoi ?</label>' +
    '<input type="text" id="nt-titre" class="gros" autocomplete="off" ' +
    'placeholder="rappeler le gestionnaire" value="' + esc(n ? n.titre || '' : '') + '"></div>' +
    '<p class="eyebrow" style="margin:12px 0 6px">Couleur</p>' +
    '<div class="chips" id="nt-couls">' + COUL_NOTE.map(function (x) {
      return '<button type="button" class="chip" data-ntcoul="' + x.c + '" title="' + x.n +
        '" aria-pressed="' + (coul === x.c ? 'true' : 'false') + '">' +
        '<span class="pastille" style="width:12px;height:12px;background:' + x.c +
        ';display:inline-block;vertical-align:-1px"></span></button>';
    }).join('') + '</div>' +
    (id ? '' : '<p class="muted" style="font-size:12px;margin:10px 0 0">Les éléments à cocher ' +
      's’ajoutent ensuite, dans la note.</p>') +
    '<div class="btn-rang" style="margin-top:12px">' +
    (id ? '<button class="btn danger btn-min" id="nt-sup">Supprimer</button>' : '') +
    '<button class="btn primaire" id="nt-ok">Enregistrer</button></div>');
  $('#nt-couls').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ntcoul]'); if (!b) return;
    coul = b.dataset.ntcoul;
    $$('#nt-couls [data-ntcoul]').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.ntcoul === coul));
    });
  });
  if ($('#nt-sup')) $('#nt-sup').addEventListener('click', function () { effacerNote(id); });
  $('#nt-ok').addEventListener('click', function () {
    var titre = $('#nt-titre').value.trim();
    if (!titre) { toast('Écrivez au moins de quoi il s’agit.'); return; }
    if (!n) { n = { id: uid(), cree: Date.now(), items: [] }; l.push(n); }
    n.titre = titre;
    n.couleur = coul;
    Promise.resolve(sauverCfg()).then(function () {
      fermerModale(); renderNotes();
      /* Créée par le + depuis un autre écran, elle n'est pas sous les yeux :
         on dit où elle est. */
      toast(id ? 'Note modifiée.' : A.vue === 'notes' ? 'Note ajoutée.' : 'Note ajoutée dans ☰ ▸ Mes notes.');
    });
  });
}
/* Par la corbeille, comme le reste : une liste de courses perdue d'un doigt
   maladroit se récupère. */
function effacerNote(id) {
  var n = noteParId(id); if (!n) return Promise.resolve();
  var faits = (n.items || []).filter(function (x) { return x.fait; }).length;
  var detail = (n.items || []).length
    ? faits + '/' + n.items.length + ' fait' + (faits > 1 ? 's' : '') : '';
  return jeterObjet('note', n, n.titre || 'Note', detail).then(function () {
    A.cfg.notes = notes().filter(function (x) { return x.id !== id; });
    return sauverCfg();
  }).then(function () {
    fermerModale(); renderNotes(); toast('Note mise à la corbeille.');
  });
}
function majNote(id, f, refocus) {
  var n = noteParId(id); if (!n) return;
  f(n);
  Promise.resolve(sauverCfg()).then(function () {
    renderNotes();
    if (refocus) {
      var c = $('#aj-notes [data-nt-ajout="' + id + '"]');
      if (c) c.focus();
    }
  });
}
function ajouterItemNote(champ) {
  var t = champ.value.trim(); if (!t) return;
  champ.value = '';
  majNote(champ.dataset.ntAjout, function (n) {
    n.items.push({ id: uid(), texte: t, fait: false });
  }, true);
}
function brancherNotes() {
  $('#aj-notes').addEventListener('click', function (e) {
    var sup = e.target.closest('[data-notesup]');
    if (sup) {
      var n = noteParId(sup.dataset.notesup);
      if (n && !confirm('Supprimer « ' + (n.titre || 'cette note') + ' » ?\n\nElle restera récupérable ' +
        B.JOURS_POUBELLE + ' jours dans ' + B.CHEMIN_CORBEILLE + '.')) return;
      effacerNote(sup.dataset.notesup);
      return;
    }
    var si = e.target.closest('[data-nt-supitem]');
    if (si) {
      var carte = si.closest('[data-note-id]');
      majNote(carte.dataset.noteId, function (nn) {
        nn.items = nn.items.filter(function (x) { return x.id !== si.dataset.ntSupitem; });
      });
      return;
    }
    var note = e.target.closest('[data-note]');
    if (note) ouvrirNote(note.dataset.note);
  });
  $('#aj-notes').addEventListener('change', function (e) {
    var c = e.target.closest('[data-nt-coche]'); if (!c) return;
    var carte = c.closest('[data-note-id]');
    majNote(carte.dataset.noteId, function (nn) {
      nn.items.forEach(function (x) { if (x.id === c.dataset.ntCoche) x.fait = c.checked; });
    });
  });
  /* Entrée crée l'élément et garde le champ ouvert pour le suivant. */
  $('#aj-notes').addEventListener('keydown', function (e) {
    var c = e.target.closest ? e.target.closest('[data-nt-ajout]') : null;
    if (!c || e.key !== 'Enter') return;
    e.preventDefault();
    ajouterItemNote(c);
  });
}
