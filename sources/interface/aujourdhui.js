/* ========================================================== AUJOURD'HUI
   L'écran d'arrivée (lot 5b). Il reprend ce que portaient l'ancien accueil
   et Mon entreprise — les rappels, les bulles, la ligne de la journée, les
   notes — dans l'ordre de la maquette V2 : la journée · En retard · Bientôt
   · Mes notes · Chantiers en cours · Prélèvements à venir · Derniers jours.
   Chaque ligne d'En retard et de Bientôt dit une chose à faire et mène là
   où elle se fait ; aucune ne calcule rien de neuf, toutes relisent les
   alertes qui existaient déjà. */

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

/* En retard : ce qui aurait dû être fait. Les jours à trancher d'abord :
   « Il faudrait me forcer la main quand la journée est finie, pour que je
   remplisse. » Une journée posée puis passée sans temps noté vide les
   rendements en silence. La sauvegarde vient en dernier (B1) : elle ne porte
   sur aucun chantier. */
function lignesRetard() {
  var now = Date.now(), l = [];
  C.joursAResoudre(A.chantiers, A.cfg, absences(), now).forEach(function (p) {
    var d = new Date(p.d);
    l.push({ cle: 'trancher:' + C.jourCle(p.d), ton: 'tiede', picto: 'horloge',
      titre: majuscule(JOURS_LONGS[d.getDay()]) + ' ' + d.getDate() + ' ' + MOIS_NOMS[d.getMonth()] + ' non saisi',
      sous: 'Prévu : ' + p.chantiers.map(function (c) { return C.nomChantier(c); }).join(', '),
      etiq: 'Trancher', ouvre: 'trancher:' + p.d });
  });
  var al = C.alertes(A.chantiers, A.cfg, now);
  al.filter(function (a) { return a.type === 'afacturer'; }).forEach(function (a) {
    l.push({ cle: 'afacturer:' + a.chantier.id, ton: 'tiede', picto: 'chantier',
      titre: 'Facture à faire', sous: C.nomChantier(a.chantier) +
        (a.chantier.donneur ? ' · ' + a.chantier.donneur : ''),
      montant: C.montant(a.chantier), petit: 'terminé ' + ilYa(a.chantier.dateFin),
      ouvre: 'fiche:' + a.chantier.id });
  });
  al.filter(function (a) { return a.type === 'impaye'; }).forEach(function (a) {
    l.push({ cle: 'impaye:' + a.chantier.id, ton: 'alerte', picto: 'finances',
      titre: 'Facture impayée', sous: C.nomChantier(a.chantier) +
        (a.chantier.donneur ? ' · ' + a.chantier.donneur : ''),
      montant: C.montant(a.chantier),
      petit: a.chantier.echeancePaiement ? 'échue depuis ' + a.jours + ' j' : 'facturée il y a ' + a.jours + ' j',
      ouvre: 'fiche:' + a.chantier.id });
  });
  echeancesVehicule().filter(function (x) { return x.etat === 'retard'; }).forEach(function (x) {
    l.push(ligneVehicule(x, 'alerte', 'échéance dépassée'));
  });
  var c = contenuSauvegarde();
  if (c.length && B.sauvegardeAncienne(A.export, now)) {
    var q = B.depuisQuand(A.export, now);
    l.push({ cle: 'sauvegarde', ton: 'alerte', picto: 'sauvegarde', titre: 'Sauvegarde à faire',
      sous: (q ? 'Dernière copie ' + q : 'Aucune copie n’est sortie de ce téléphone') +
        ' · ' + listerContenu(c),
      etiq: 'Sauvegarder', ouvre: 'sauvegarde:' });
  }
  return l;
}
function ligneVehicule(x, ton, quoi) {
  return { cle: 'vehicule:' + x.p.id, ton: ton, picto: 'carnetv', titre: x.p.nom || 'Entretien',
    sous: 'Véhicule · ' + quoi,
    petit: x.aDate != null ? jourCourt(x.aDate) : (x.aKm != null ? E.fmt(x.aKm, 0) + ' km' : ''),
    ouvre: 'vehicule:' };
}

/* Bientôt : ce qui vient. Le travail posé à sept jours (l'ancienne ligne
   sous les bulles) se lit par chantier, du premier au dernier jour. */
function lignesBientot() {
  var now = Date.now(), l = [];
  var al = C.alertes(A.chantiers, A.cfg, now);
  al.filter(function (a) { return a.type === 'aplacer' || a.type === 'aprevoir'; }).forEach(function (a) {
    var estimer = a.type === 'aprevoir';
    l.push({ cle: 'programmer:' + a.chantier.id, picto: 'calendrier',
      titre: 'À programmer : ' + (estimer ? 'temps à estimer' : E.fmt(a.jours, a.jours % 1 ? 1 : 0) + ' j à placer'),
      sous: C.nomChantier(a.chantier) + (a.chantier.donneur ? ' · ' + a.chantier.donneur : ''),
      etiq: estimer ? 'Estimer' : 'Placer',
      ouvre: (estimer ? 'fiche:' : 'placer:') + a.chantier.id });
  });
  A.chantiers.forEach(function (c) {
    if (['accepte', 'encours', 'termine'].indexOf(c.statut) < 0) return;
    var proches = C.journeesPlacees(c).filter(function (j) {
      var d = ecartJours(now, j.d);
      return d >= 0 && d <= 7;
    });
    if (!proches.length) return;
    var n = proches.length, part = proches.reduce(function (s, j) { return s + C.nb(j.p); }, 0);
    var quand = function (ts, sansMois) {
      var d = ecartJours(now, ts);
      return d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : jourCourt(ts, sansMois);
    };
    var prem = proches[0].d, dern = proches[n - 1].d;
    l.push({ cle: 'prevus:' + c.id, picto: 'calendrier', titre: C.nomChantier(c),
      sous: n + ' jour' + (n > 1 ? 's' : '') + ' prévu' + (n > 1 ? 's' : '') +
        (part !== n ? ' · ' + C.fmtJours(part) : '') + (c.donneur ? ' · pour ' + c.donneur : ''),
      petit: n === 1 ? quand(prem)
        : quand(prem, new Date(prem).getMonth() === new Date(dern).getMonth()) + ' → ' + quand(dern),
      ouvre: 'fiche:' + c.id });
  });
  al.filter(function (a) { return a.type === 'devis'; }).forEach(function (a) {
    l.push({ cle: 'relancer:' + a.chantier.id, picto: 'note', titre: 'Relancer le devis ?',
      sous: C.nomChantier(a.chantier) + (a.chantier.donneur ? ' · ' + a.chantier.donneur : ''),
      montant: C.montant(a.chantier), petit: a.texte, ouvre: 'fiche:' + a.chantier.id });
  });
  /* C1 : un chantier qui n'a pas encore de devis. Le repérage n'est pas une
     donnée de Sylve : seule l'annonce se date. */
  A.chantiers.filter(function (c) { return c.statut === 'devis' && !c.dateEnvoi; })
    .sort(function (a, b) { return C.dateEntree(b) - C.dateEntree(a); })
    .forEach(function (c) {
      var quand = C.dateEntree(c);
      l.push({ cle: 'devisafaire:' + c.id, picto: 'carnet', titre: 'Devis à faire',
        sous: C.nomChantier(c) + (c.donneur ? ' · ' + c.donneur : ''),
        petit: quand ? 'annoncé ' + ilYa(quand) : '', ouvre: 'fiche:' + c.id });
    });
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
  echeancesVehicule().filter(function (x) { return x.etat === 'bientot'; }).forEach(function (x) {
    l.push(ligneVehicule(x, '', 'échéance proche'));
  });
  return l;
}

/* Les chantiers qui ne sont pas soldés, du plus avancé au moins avancé :
   ce qui attend un paiement passe avant ce qui attend un devis. */
var ETAPE_DE_STATUT = { devis: 0, envoye: 1, accepte: 2, encours: 2, termine: 3, facture: 4, paye: 5 };
function pointsEtape(c) {
  var e = ETAPE_DE_STATUT[c.statut] || 0;
  return '<span class="aj-points" aria-label="Étape ' + (e + 1) + ' sur 5">' +
    [0, 1, 2, 3, 4].map(function (i) {
      return '<i class="' + (i < e ? 'f' : i === e ? 'e' : '') + '"></i>';
    }).join('') + '</span>';
}
function situationChantier(c, now) {
  var base = C.nomStatut(c.statut, c);
  if (c.statut === 'devis') {
    var q = C.dateEntree(c);
    return { t: 'Annoncé ' + (q ? ilYa(q) : '') + ' · devis à faire', ton: '' };
  }
  if (c.statut === 'envoye') {
    return { t: base + (c.dateEnvoi ? ' ' + ilYa(c.dateEnvoi) + ', sans réponse' : ''), ton: '' };
  }
  if (c.statut === 'accepte' || c.statut === 'encours') {
    var reste = C.resteAPlacer(c);
    return { t: base + (reste != null && reste > 0 ? ' · ' + C.fmtJours(reste) + ' à placer' : ''),
      ton: c.statut === 'encours' ? 'vert' : '' };
  }
  if (c.statut === 'termine') {
    return { t: c.dateFin ? 'Terminé ' + ilYa(c.dateFin) + ', à facturer' : base, ton: 'tiede' };
  }
  if (c.statut === 'facture') {
    var r = C.retardPaiement(c, now);
    if (r != null) return { t: 'Facture échue depuis ' + r + ' j', ton: 'alerte' };
    return { t: base + (c.echeancePaiement ? ' · à payer avant le ' + dateCourte(c.echeancePaiement) : ''), ton: '' };
  }
  return { t: base, ton: '' };
}
function lignesEnCours() {
  var now = Date.now();
  return C.filtre(A.chantiers, 'ouverts').slice().sort(function (a, b) {
    return (ETAPE_DE_STATUT[b.statut] || 0) - (ETAPE_DE_STATUT[a.statut] || 0) ||
      C.dateEntree(b) - C.dateEntree(a);
  }).map(function (c) {
    var s = situationChantier(c, now), m = C.montant(c);
    return '<button type="button" class="aj-ch" data-ajouvre="fiche:' + esc(c.id) + '">' +
      '<span class="aj-txt"><b>' + esc(C.nomChantier(c)) + '</b>' +
      (c.donneur || c.commune ? '<small>' + esc([c.donneur, c.commune].filter(Boolean).join(' · ')) + '</small>' : '') +
      '<span class="aj-situ' + (s.ton ? ' aj-' + s.ton : '') + '">' + esc(s.t) + '</span></span>' +
      '<span class="aj-droite">' + (m ? '<b class="num">' + eur(m) + '</b>' : '') + pointsEtape(c) + '</span>' +
      '</button>';
  });
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

/* Les trois derniers jours saisis : de quoi corriger hier sans ouvrir
   l'Agenda. Un appui rouvre la fenêtre Ma journée sur ce jour-là. */
function lignesDerniersJours() {
  var now = Date.now();
  return (A.journees || []).filter(function (j) { return C.minuit(C.nb(j.date)) <= C.minuit(now); })
    .sort(function (a, b) { return C.nb(b.date) - C.nb(a.date); }).slice(0, 3)
    .map(function (j) {
      var c = j.chantier ? chantier(j.chantier) : null;
      var faits = (j.postes || []).map(function (p) {
        return C.nomTravail(p.travaux) + (C.nb(p.quantite)
          ? ' ' + E.fmt(C.nb(p.quantite), C.nb(p.quantite) % 1 ? 2 : 0) + ' ' + C.courtUnite(C.uniteDe(p.travaux))
          : '');
      });
      var h = C.heuresJournee(j);
      return '<button type="button" class="aj-jour" data-ajouvre="journee:' + esc(j.id) + '">' +
        '<span class="aj-txt"><b>' + esc(majuscule(jourCourt(j.date, true)) + ' · ' +
          (c ? C.nomChantier(c) : (j.lieu || 'sans chantier')) + ' · ' +
          E.fmt(C.arr(h, 1), h % 1 ? 1 : 0) + ' h') + '</b>' +
        (faits.length ? '<small>' + esc(faits.join(', ')) + '</small>' : '') + '</span></button>';
    });
}

function renderAujourdhui() {
  var z = $('#aj-haut'); if (!z) return;
  var d = new Date();
  $('#aj-date').textContent = majuscule(JOURS_LONGS[d.getDay()]) + ' ' + d.getDate() + ' ' + MOIS_NOMS[d.getMonth()];
  var ret = lignesVisibles(lignesRetard()), bt = lignesVisibles(lignesBientot());
  z.innerHTML = '<div id="aj-saisie">' + ligneSaisie() + '</div>' +
    (ret.length ? blocAuj('retard', 'En retard', 'alerte',
      '<div class="aj-zone">' + ret.map(ligneAuj).join('') + '</div>', ret.length) : '') +
    (bt.length ? blocAuj('bientot', 'Bientôt', 'tiede',
      '<div class="aj-zone">' + bt.map(ligneAuj).join('') + '</div>', bt.length) : '') +
    (ret.length || bt.length ? '' : '<p class="aj-calme" id="aj-calme">Rien en retard, rien qui presse.</p>');
  var ch = lignesEnCours(), pr = lignesPrelevements(), dj = lignesDerniersJours();
  $('#aj-bas').innerHTML =
    (ch.length ? blocAuj('encours', 'Chantiers en cours', '',
      '<div class="aj-zone">' + ch.join('') + '</div>', ch.length) : '') +
    /* Le total, que l'ancien rappel donnait dès deux échéances. */
    (pr.length ? blocAuj('prelevements', 'Prélèvements à venir', '',
      '<div class="aj-zone aj-discrete">' + pr.map(ligneAuj).join('') + '</div>',
      pr.length > 1 ? eur(pr.reduce(function (s, l) { return s + l.montant; }, 0)) : null) : '') +
    blocAuj('jours', 'Derniers jours', '', '<div class="aj-zone aj-discrete">' + dj.join('') +
      '<button type="button" class="aj-lien" data-ajouvre="agenda:">Tout l’historique dans l’Agenda' +
      picto('chevron') + '</button></div>');
  renderNotes();
}

/* Où mène chaque ligne. Le placement est celui de l'Agenda (« À planifier »)
   : il s'ouvre sur le mois du dernier jour déjà posé. */
var OUVRIR_AUJ = {
  fiche: function (id) { ouvrirChantier(id); },
  trancher: function (ts) { ouvrirResolutionJour(Number(ts)); },
  placer: function (id) {
    var c = chantier(id); if (!c) return;
    A.planifie = c.id;
    var pl = C.journeesPlacees(c);
    A.calMois = pl.length ? C.minuit(pl[pl.length - 1].d) : Date.now();
    allerModule('calendrier', 'calendrier');
  },
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
  brancherNotes();
}

/* ============================================================ MES NOTES
   Les notes qu'il s'écrit à lui-même. Elles vivaient sous les tuiles de Mon
   entreprise ; elles viennent juste après Bientôt (N1), avec les mêmes
   gestes. Elles restent tant qu'il ne les efface pas. Une nouvelle note naît
   du + (+ ▸ Note), comme tout ce qui se crée. */
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
      toast(id ? 'Note modifiée.' : 'Note ajoutée.');
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
        B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
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
