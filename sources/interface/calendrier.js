/* ============================================== CALENDRIER ET ALERTES */
var JOURS_COURTS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
var MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/* Le bandeau du placement. « Terminer » est devenu « Fini de placer » et
   ramène là d'où l'on est parti (P2). L'alerte « jour déjà pris » y vit
   désormais : elle était dans la fenêtre « Les journées » de la fiche, qui ne
   pose plus de dates (R6) — c'est ici qu'on voit le mois et ce qui est pris. */
function renderBandeauPlanif() {
  var z = $('#cal-planif'); if (!z) return;
  var c = A.planifie ? chantier(A.planifie) : null;
  if (!c) { z.innerHTML = ''; return; }
  var placees = C.totalPlace(c), reste = C.resteAPlacer(c);
  var avert = '';
  if (A.placeAvert != null && C.partDuJour(c, A.placeAvert) > 0) {
    var pris = prisPar(A.placeAvert, c);
    if (pris.length) {
      avert = '<div class="pl-avert" id="cal-pl-avert"><span><b>Le ' + esc(jourCourt(A.placeAvert)) +
        ' est déjà pris</b> : ' + esc(pris.join(', ')) + '.</span>' +
        '<div class="btn-rang">' +
        '<button class="btn btn-min" id="cal-pl-garder">Garder les deux</button>' +
        '<button class="btn btn-min" id="cal-pl-suivant">Prendre le jour libre suivant</button>' +
        '</div></div>';
    }
  }
  z.innerHTML = '<div class="placement">' +
    '<div class="pl-t"><b>Placement — ' + esc(C.nomChantier(c)) + '</b>' +
    '<button class="btn btn-min" id="cal-planif-fin">Fini de placer</button></div>' +
    '<div class="pl-c num">' +
    (reste == null
      ? placees + ' journée' + (placees > 1 ? 's' : '') + ' placée' + (placees > 1 ? 's' : '')
      : placees + ' / ' + Math.ceil(C.joursPrevus(c)) + ' journées placées' +
        (reste > 0 ? ' — encore ' + reste : (reste < 0 ? ' — ' + (-reste) + ' de trop' : ' — compte atteint'))) +
    '</div><small>Appuyez sur les jours voulus : une fois pour la journée, deux fois pour ' +
    'une demi-journée, trois fois pour retirer. Un jour passé devient une journée faite.</small>' +
    avert + '</div>';
}
/* Ce qui tient déjà un jour, hors du chantier qu'on place. On n'interdit pas
   de doubler — une demi-journée ici, une demi-journée là — mais il doit le
   voir au moment où il pose, pas après. */
function prisPar(ts, c) {
  var o = occupationDu(ts), vus = {}, l = [];
  o.prevus.concat(o.reels).forEach(function (p) {
    var ch = p.chantier;
    if (!ch || ch.id === c.id || vus[ch.id]) return;
    vus[ch.id] = 1; l.push(C.nomChantier(ch));
  });
  if (C.estAbsent(absences(), ts)) l.push('marqué non travaillé');
  return l;
}
function sautable(ts) { return C.estWeekend(ts) && !(A.cfg && A.cfg.weekends); }
function jourLibreSuivant(ts, c) {
  var j = C.ajouteJours(ts, 1), garde = 0;
  while (garde++ < 120 && (sautable(j) || C.partDuJour(c, j) > 0 || prisPar(j, c).length)) {
    j = C.ajouteJours(j, 1);
  }
  return j;
}
function prochainJourOuvre(ts) {
  var j = C.ajouteJours(ts, 1), garde = 0;
  while (garde++ < 14 && sautable(j)) j = C.ajouteJours(j, 1);
  return j;
}
/* Un seul outil pour poser les jours d'un chantier (P1). On y entre par le
   chantier — sa fiche, étape Travaux — et l'on y arrive sur le mois du
   dernier jour placé : c'est là qu'on continue. Sans jour placé, sur celui du
   prochain jour ouvré, pas forcément le mois en cours (P2). */
function demarrerPlacement(id, depuis) {
  var c = chantier(id); if (!c) return;
  A.planifie = c.id;
  A.placeDepuis = depuis || 'agenda';
  A.placeAvert = null;
  var pl = C.journeesPlacees(c);
  A.calMois = pl.length ? C.minuit(pl[pl.length - 1].d) : prochainJourOuvre(Date.now());
  fermerModale();
  allerModule('calendrier', 'calendrier');
}
function finirPlacement() {
  var c = chantier(A.planifie), depuis = A.placeDepuis;
  A.planifie = null; A.placeDepuis = null; A.placeAvert = null;
  if (c) {
    var n = C.totalPlace(c);
    toast(E.fmt(n, n % 1 ? 1 : 0) + ' journée' + (n > 1 ? 's' : '') + ' placée' +
      (n > 1 ? 's' : '') + ' — ' + C.nomChantier(c) + '.');
  }
  if (depuis === 'fiche' && c) ouvrirChantier(c.id, 'travaux');
  else if (depuis === 'aujourdhui') allerAccueil();
  else renderCalendrier();
}
/* L'appui sur un jour, en placement. Un jour déjà tenu par autre chose se
   pose quand même, et l'alerte propose les deux issues.
   Un jour passé ne se pose plus (lot r1) : il a eu lieu, il devient une
   journée faite, comme si on l'avait saisie. Une seule par jour : la
   toucher encore ne double rien, on la précise depuis la fiche du jour. */
function toucherPlacement(ts) {
  var c = chantier(A.planifie); if (!c) return;
  ts = C.minuit(ts);
  if (ts < C.minuit(Date.now())) {
    if (journeeDeChantier(c.id, ts)) {
      toast('Déjà une journée ce jour-là : un appui sur le jour, hors placement, pour la préciser.');
      return;
    }
    creerJourneeFaite(c, ts, C.HEURES_JOUR(A.cfg));
    indexerJournees();
    sauverJournees().then(function () {
      renderCalendrier(); renderCarnet(); renderAccueil(); renderFiche();
      toast(majuscule(jourCourt(ts)) + ' : ' + C.nomChantier(c) + ', comptée comme faite.');
    });
    return;
  }
  var avant = C.partDuJour(c, ts);
  C.placerJour(c, ts); c.maj = Date.now();
  if (!avant && prisPar(ts, c).length) A.placeAvert = ts;
  else if (A.placeAvert === ts && !C.partDuJour(c, ts)) A.placeAvert = null;
  sauverChantiers().then(function () { renderCalendrier(); renderCarnet(); renderAccueil(); });
}
function deplacerAuJourLibre() {
  var c = chantier(A.planifie), k = A.placeAvert;
  if (!c || k == null) return;
  var part = C.partDuJour(c, k) || 1;
  var libre = jourLibreSuivant(k, c);
  C.placerJour(c, k, 0);
  C.placerJour(c, libre, part);
  c.maj = Date.now();
  A.placeAvert = null;
  A.calMois = libre;
  sauverChantiers().then(function () {
    renderCalendrier(); renderCarnet(); renderAccueil();
    toast('Posé le ' + jourCourt(libre) + ', premier jour libre.');
  });
}
/* Les jours non travaillés — congé, arrêt, intempérie. C'est la seule pièce
   du modèle qui n'était écrite nulle part. Petite liste que l'utilisateur
   enrichit : elle vit dans la configuration, donc elle part dans les
   sauvegardes sans nouveau format de fichier. */
function absences() {
  A.cfg = A.cfg || {};
  A.cfg.absences = A.cfg.absences || [];
  return A.cfg.absences;
}
function poserAbsence(ts, note) {
  var k = C.jourCle(ts);
  var l = absences().filter(function (a) { return C.jourCle(a.d) !== k; });
  l.push({ d: C.minuit(ts), note: note || '' });
  A.cfg.absences = l.sort(function (a, b) { return a.d - b.d; });
  return Promise.resolve(sauverCfg());
}
function retirerAbsence(ts) {
  var k = C.jourCle(ts);
  A.cfg.absences = absences().filter(function (a) { return C.jourCle(a.d) !== k; });
  return Promise.resolve(sauverCfg());
}
function occupationDu(ts) {
  return C.occupation(A.chantiers, ts, ts, A.cfg)[C.jourCle(ts)] || { prevus: [], reels: [] };
}

/* --------------------------------------------- la journée d'office (G4) */
/* La règle ne vaut que pour les jours qui passent après l'installation de la
   4.92 (tranché le 04/11) : sa date est posée à la première ouverture, une
   fois. Elle vit dans la configuration, qui part dans les sauvegardes ; une
   restauration ne la touche pas. */
function journeesDOffice() {
  A.cfg = A.cfg || {};
  if (!A.cfg.officeDepuis) { A.cfg.officeDepuis = Date.now(); sauverCfg(); }
  return C.joursDOffice(A.chantiers, A.journees, absences(), A.cfg, Date.now());
}
/* Les jours en pointillés passés qui attendent qu'il dise ce qu'il en fut. */
function journeesEnPointilles() {
  journeesDOffice();
  return C.joursEnPointilles(A.chantiers, A.journees, absences(), A.cfg, Date.now());
}
/* « J'y ai travaillé » sur un jour en pointillés (lot r1b) : une marque sur
   la pose, et le jour compte comme une journée d'office — calculée, jamais
   écrite. Il vient de le dire : pas de ○. */
function reconnaitreJour(c, ts) {
  var k = C.jourCle(ts);
  c.jours = (c.jours || []).map(function (j) {
    if (jourDePose(j) !== k) return j;
    var o = typeof j === 'object' ? Object.assign({}, j) : { d: C.minuit(j), p: 1 };
    o.fait = true; o.vu = true;
    return o;
  });
  c.maj = Date.now();
  indexerJournees();
  return sauverChantiers();
}
/* Le jour d'une pose, quel que soit son format (l'ancien : une date nue). */
function tsPose(j) { return C.minuit(j && typeof j === 'object' ? j.d : j); }
function jourDePose(j) { return C.jourCle(tsPose(j)); }
function journeeDeChantier(id, ts) {
  var k = C.jourCle(ts);
  return (A.journees || []).filter(function (j) {
    return j.chantier === id && C.jourCle(C.nb(j.date)) === k;
  })[0] || null;
}
/* Une journée faite, sans prestation : la même que Ma journée écrirait avec
   le seul temps total. Un jour passé posé depuis l'Agenda la crée (lot r1) ;
   on la précise ensuite d'un appui sur le jour. */
function creerJourneeFaite(c, ts, heures) {
  A.journees = A.journees || [];
  var j = { id: uid(), date: C.minuit(ts) + 12 * 3600000, chantier: c.id,
    lieu: c.foret || '', commune: c.commune || '', km: 0, nonProd: C.arr(heures, 2),
    personnes: 1, sansMoi: false, fin: false, postes: [] };
  A.journees.push(j);
  return j;
}
/* « Je n'y étais pas » : le jour posé s'en va, dans la Corbeille, d'où il
   revient tel qu'il était. Sans pose, plus de journée d'office. */
function retirerJoursOffice(ts, office) {
  var k = C.jourCle(ts);
  return Promise.all(office.map(function (r) {
    var c = r.chantier;
    var pose = C.journeesPlacees(c).filter(function (x) { return C.jourCle(x.d) === k; })[0];
    c.jours = (c.jours || []).filter(function (j) { return jourDePose(j) !== k; });
    c.maj = Date.now();
    return pose ? jeterObjet('jour', { chantier: c.id, pose: pose }, C.nomChantier(c),
      'jour posé du ' + dateCourte(ts)) : null;
  })).then(function () {
    indexerJournees();
    return sauverChantiers();
  });
}
/* Le ○ s'efface quand il a ouvert la fiche du jour, ou fermé la bulle
   d'Aujourd'hui qui la montrait : il l'a vu. La marque est portée par la
   pose elle-même. « liste » : des { chantier, d }. */
function marquerPosesVues(liste) {
  var n = 0;
  liste.forEach(function (r) {
    var k = C.jourCle(r.d), c = r.chantier;
    c.jours = (c.jours || []).map(function (j) {
      if (jourDePose(j) !== k || (typeof j === 'object' && j.vu)) return j;
      n++;
      return typeof j === 'object' ? Object.assign({}, j, { vu: true }) : { d: C.minuit(j), p: 1, vu: true };
    });
  });
  if (!n) return Promise.resolve(false);
  indexerJournees();
  return sauverChantiers().then(function () { renderCalendrier(); renderAujourdhui(); renderFiche(); return true; });
}
function marquerOfficeVu(ts, office) {
  marquerPosesVues(office.filter(function (r) { return !r.temps.vu; })
    .map(function (r) { return { chantier: r.chantier, d: ts }; }));
}

/* « jeudi 29 octobre » : le jour tel qu'on le dit. */
function jourEnLettres(ts, avecAnnee) {
  var d = new Date(ts);
  return JOURS_LONGS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS_NOMS[d.getMonth()] +
    (avecAnnee ? ' ' + d.getFullYear() : '');
}

/* La fiche du jour : une seule, en feuille (R7, R8). « Cliquer sur n'importe
   quel jour doit ouvrir une fiche jour. » Elle sert aussi à corriger après
   coup — prévu jeudi, fait mercredi : on ouvre mercredi et on y note ce qu'on
   a fait, jeudi redevient libre dès qu'on y retire le chantier.
   L'état « à trancher » est parti au lot r1 : un jour posé et confirmé qui
   passe compte d'office ; la fiche le dit, et propose de le préciser ou de
   dire qu'on n'y était pas. */
function ouvrirFicheJour(ts) {
  ts = C.minuit(ts);
  A.calJour = ts;
  indexAJour();
  var auj = C.minuit(Date.now());
  var o = occupationDu(ts);
  var st = C.statutJour(o, absences(), ts);
  var abs = C.estAbsent(absences(), ts);
  /* On peut avoir travaillé un jour passé ou aujourd'hui, jamais demain. */
  var ouvert = ts <= auj;
  var office = o.reels.filter(function (r) { return r.temps.office; });
  var vrais = o.reels.filter(function (r) { return !r.temps.office; });
  /* Un jour posé resté dans le passé sans rien compter : d'avant la 4.92, ou
     posé sur un devis pas signé. Pâle ; d'avant la 4.92, il se règle à la
     main ; depuis, sur un devis pas signé, il attend qu'on dise ce qu'il en
     fut (lot r1b). */
  var pale = ts < auj && (st === 'confirme' || st === 'prevu');
  var pointilles = journeesEnPointilles().filter(function (x) { return x.d === ts; });
  var aide = office.length && !vrais.length ? 'journée comptée d’office'
    : pointilles.length ? 'devis pas signé : il ne compte pas tant que vous ne le dites pas'
    : pale ? 'posé avant la mise à jour : il ne compte pas, à régler à la main'
    : trouveAide(st);

  var h = '<div class="fj-etat st-' + st + (pale ? ' passe' : '') + '"><span class="fj-pt"></span>' +
    '<div><b>' + esc(C.nomStatutJour(st)) + '</b><small>' + esc(aide) + '</small></div></div>';

  if (office.length) {
    h += '<div class="fj-office" id="fj-office"><p><b>○ Comptée d’office : ' +
      esc(office.map(function (r) {
        return C.ditHeures(C.heuresSaisie(r.temps, A.cfg)) + ' sur ' + C.nomChantier(r.chantier);
      }).join(', ')) + '.</b> Le jour était posé et confirmé, rien n’a été saisi. ' +
      'Si vous remplissez Ma journée, elle remplace celle-ci.</p>' +
      '<div class="btn-rang"><button class="btn primaire btn-min" id="fj-preciser">Préciser ma journée</button>' +
      '<button class="btn btn-min" id="fj-nonla">Je n’y étais pas</button></div></div>';
  }
  if (pointilles.length) {
    h += '<div class="fj-office fj-pointilles" id="fj-pointilles"><p><b>Posé, devis pas signé.</b> ' +
      'Ce jour ne compte pas tant que vous ne le dites pas.</p>' +
      pointilles.map(function (x) {
        return '<div class="fj-pl"><span>' + esc(C.nomChantier(x.chantier) + ' · ' + partEnMots(x.p)) + '</span>' +
          '<div class="btn-rang"><button class="btn primaire btn-min" data-fjytrav="' + esc(x.chantier.id) + '">' +
          'J’y ai travaillé</button><button class="btn btn-min" data-fjpasla="' + esc(x.chantier.id) + '">' +
          'Je n’y étais pas</button></div></div>';
      }).join('') + '</div>';
  }
  /* Une ligne par chantier ce jour-là (lot r1b) : « une seule ligne pour me
     dire là où j'ai été ». Une journée à deux prestations en donnait trois —
     une par prestation, une pour le hors production. */
  var parCh = parChantierDuJour(vrais);
  if (parCh.length) {
    h += '<p class="fj-sous">Ce que vous y avez fait</p>' +
      parCh.map(function (x) {
        /* Le trajet se dit à côté de la durée (lot r2) : il n'y entre plus. */
        var txt = '<b>' + esc(C.nomChantier(x.chantier)) + '</b><small>' +
          C.ditDuree(x.heures, A.cfg) + (x.personnes > 1 ? ' × ' + x.personnes + ' pers.' : '') +
          (x.trajet ? ' · + ' + C.ditHeures(x.trajet) + ' de trajet' : '') +
          (x.jrn.length > 1 ? ' · ' + x.jrn.length + ' journées' : '') + '</small>' +
          (x.prestations.length ? '<small class="fj-presta">' + esc(x.prestations.join(', ')) + '</small>' : '');
        /* Un appui rouvre la journée de ce chantier ; s'il y en a plusieurs ce
           jour-là (un ancien doublon), un petit choix entre elles (lot r2). */
        return '<div class="liste-item" data-fjch="' + esc(x.chantier.id) + '">' +
          (x.jrn.length
            ? '<button type="button" class="li-c fj-txt" data-fjmj="' + esc(x.jrn[0]) + '">' + txt + '</button>'
            : '<div class="li-c">' + txt + '</div>') +
          '<button class="btn-min" data-fjouvrir="' + x.chantier.id + '">Fiche</button>' +
          '<button class="btn-min" data-fjsupch="' + x.chantier.id + '" aria-label="Retirer la journée de ce chantier">✕</button>' +
          '</div>';
      }).join('');
  }
  var faits = {};
  o.reels.forEach(function (r) { faits[r.chantier.id] = 1; });
  var enAttente = o.prevus.filter(function (p) { return !faits[p.chantier.id]; });
  if (enAttente.length) {
    h += '<p class="fj-sous">' +
      (o.reels.length || ts < auj ? 'Posé ce jour-là, sans temps noté' : 'Ce qui est posé ce jour-là') + '</p>' +
      enAttente.map(function (p) {
        return '<div class="liste-item"><span class="pastille fj-' + p.fermete + '"></span>' +
          '<div class="li-c"><b>' + esc(C.nomChantier(p.chantier)) + '</b><small>' +
          C.ditDuree(C.nb(p.part != null ? p.part : 1) * C.HEURES_JOUR(A.cfg), A.cfg) +
          ' prévues · ' +
          esc([p.chantier.donneur, p.fermete === 'ferme' ? C.nomStatut(p.chantier.statut, p.chantier)
            : 'devis pas signé'].filter(Boolean).join(' · ')) + '</small></div>' +
          '<button class="btn-min" data-fjouvrir="' + p.chantier.id + '">Fiche</button> ' +
          '<button class="btn-min" data-fjretirer="' + p.chantier.id + '">Retirer</button></div>';
      }).join('');
  }
  if (abs) {
    h += '<p class="fj-sous">Non travaillé</p>' +
      '<div class="liste-item"><div class="li-c"><b>' + esc(abs.note || 'Sans précision') + '</b></div>' +
      '<button class="btn-min" id="fj-libre">Retirer la marque</button></div>' +
      (enAttente.length ? '<p class="fj-aide">Un chantier est encore posé ce jour-là : à vous ' +
        'de le déplacer ou de le retirer.</p>' : '');
  }
  var pr = prelevementsDuJour(ts);
  if (!o.reels.length && !o.prevus.length && !abs && !pr.length) {
    h += '<p class="fj-aide">Rien de posé ni de noté ce jour-là.</p>';
  }

  /* Ce qu'on peut en faire, selon l'état. « Fait » ne se coche pas : il se
     saisit — c'est « Ma journée » qui le crée, datée de ce jour, et c'est
     elle qui porte le chantier, les prestations et le temps. */
  var b = [];
  var bouton = function (id, txt, primaire) {
    b.push('<button class="btn plein' + (primaire ? ' primaire' : '') + '" id="' + id + '">' + txt + '</button>');
  };
  if (vrais.length) {
    bouton('fj-travaille', 'Modifier ma journée', true);
    bouton('fj-autre', 'Autre chose ce jour-là');
    bouton('fj-poser', 'Poser un autre chantier');
    if (!abs) bouton('fj-absent', 'Jour non travaillé');
  } else if (office.length) {
    /* Préciser et « Je n'y étais pas » sont dans le cadre de l'office. */
    bouton('fj-poser', 'Poser un autre chantier');
    if (!abs) bouton('fj-absent', 'Jour non travaillé');
  } else if (abs) {
    if (ouvert) bouton('fj-travaille', 'J’y ai travaillé quand même', true);
    bouton('fj-poser', enAttente.length ? 'Poser un autre chantier' : 'Poser un chantier');
  } else {
    if (ouvert) bouton('fj-travaille', 'Saisir ma journée', true);
    if (enAttente.length) bouton('fj-deplacer', 'Déplacer la journée');
    bouton('fj-poser', enAttente.length ? 'Poser un autre chantier' : 'Poser un chantier', !ouvert && !enAttente.length);
    bouton('fj-absent', 'Jour non travaillé');
  }
  h += '<div class="fj-choix">' + b.join('') + '</div>';

  if (pr.length) {
    h += '<p class="fj-sous">Prélevé ce jour-là</p>' +
      pr.map(function (x) {
        return '<div class="liste-item"><div class="li-c"><b>' +
          esc(x.charge.libelle || 'Charge fixe') + '</b><small>' +
          esc([x.charge.beneficiaire, FIN.nomPeriodicite(x.charge.periodicite)]
            .filter(Boolean).join(' · ')) + '</small></div>' +
          '<span class="num">' + eur(C.nb(x.charge.ttc)) + '</span></div>';
      }).join('');
  }

  modale(majuscule(jourEnLettres(ts, true)), h);
  $('#modale').classList.add('feuille-nav');
  marquerOfficeVu(ts, office);

  var refaire = function (message) {
    fermerModale();
    renderCalendrier(); renderAccueil(); renderCarnet(); renderFiche(); renderRendements();
    if (message) toast(message);
  };
  /* Ouvrir « Ma journée » datée de ce jour : celle qui existe, sinon une
     nouvelle. Le chantier posé, Ma journée le choisit elle-même (P4) : un
     seul, il est pré-choisi ; plusieurs, aucun, ils passent en tête. */
  var maJournee = function (nouvelle) {
    fermerModale();
    var jd = nouvelle ? null : journeeDuJour(ts);
    ouvrirJournee(jd ? jd.id : null, jd ? null : { date: ts });
  };
  var sur = function (id, fn) { if ($('#' + id)) $('#' + id).addEventListener('click', fn); };
  sur('fj-travaille', function () { maJournee(false); });
  sur('fj-autre', function () { maJournee(true); });
  /* Préciser : Ma journée déjà remplie du chantier et de la durée comptée.
     Enregistrée, elle remplace la journée d'office. */
  sur('fj-preciser', function () {
    fermerModale();
    if (office.length !== 1) { ouvrirJournee(null, { date: ts }); return; }
    /* Les kilomètres et le trajet, Ma journée les propose d'elle-même. */
    ouvrirJournee(null, modeleDOffice(office[0].chantier, ts, C.heuresSaisie(office[0].temps, A.cfg)));
  });
  sur('fj-nonla', function () {
    retirerJoursOffice(ts, office).then(function () {
      refaire('Journée retirée — elle est dans la Corbeille.');
    });
  });
  sur('fj-deplacer', function () { fermerModale(); ouvrirDeplacerJour(ts); });
  sur('fj-absent', function () { fermerModale(); ouvrirAbsence(ts); });
  sur('fj-poser', function () { fermerModale(); ouvrirPoserChantier(ts); });
  sur('fj-libre', function () {
    retirerAbsence(ts).then(function () { refaire('Jour rendu au planning.'); });
  });
  $('#modale-corps').addEventListener('click', function (e) {
    var mj = e.target.closest('[data-fjmj]');
    if (mj) {
      var xm = parCh.filter(function (y) { return y.jrn.indexOf(mj.dataset.fjmj) >= 0; })[0];
      fermerModale(); ouvrirJourneesParmi(xm ? xm.jrn : [mj.dataset.fjmj]);
      return;
    }
    var ouv = e.target.closest('[data-fjouvrir]');
    if (ouv) { fermerModale(); ouvrirChantier(ouv.dataset.fjouvrir, 'travaux'); return; }
    var ret = e.target.closest('[data-fjretirer]');
    if (ret) {
      var c = chantier(ret.dataset.fjretirer); if (!c) return;
      c.jours = (c.jours || []).filter(function (j) { return jourDePose(j) !== C.jourCle(ts); });
      c.maj = Date.now();
      indexerJournees();
      sauverChantiers().then(function () { refaire('Chantier retiré de ce jour.'); });
      return;
    }
    var yt = e.target.closest('[data-fjytrav]');
    if (yt) {
      var c3 = chantier(yt.dataset.fjytrav); if (!c3) return;
      var part = (pointilles.filter(function (x) { return x.chantier.id === c3.id; })[0] || {}).heures;
      reconnaitreJour(c3, ts).then(function () {
        refaire('Compté : ' + E.fmt(part || 0, (part || 0) % 1 ? 1 : 0) + ' h sur ' + C.nomChantier(c3) + '.');
      });
      return;
    }
    var pl = e.target.closest('[data-fjpasla]');
    if (pl) {
      var c4 = chantier(pl.dataset.fjpasla); if (!c4) return;
      retirerJoursOffice(ts, [{ chantier: c4 }]).then(function () {
        refaire('Jour retiré — il est dans la Corbeille.');
      });
      return;
    }
    var sup = e.target.closest('[data-fjsupch]');
    if (sup) {
      var x = parCh.filter(function (y) { return y.chantier.id === sup.dataset.fjsupch; })[0];
      if (!x) return;
      /* Une vieille saisie qui ne vient d'aucune journée ne se retire pas
         d'ici, comme avant. */
      if (!x.jrn.length) { toast('Cette saisie ne se retire pas d’ici.'); return; }
      /* Un ancien doublon : on dit combien de journées partent (lot r2). */
      if (!confirm((x.jrn.length > 1
        ? 'Retirer les ' + x.jrn.length + ' journées de ' + C.nomChantier(x.chantier) + ' ce jour-là ?\n\nElles resteront '
        : 'Retirer la journée « ' + C.nomChantier(x.chantier) + ' » de ce jour ?\n\nElle restera ') +
        'récupérable' + (x.jrn.length > 1 ? 's ' : ' ') + B.JOURS_POUBELLE + ' jours dans ' + B.CHEMIN_CORBEILLE + '.')) return;
      retirerJourneesDe(x.jrn).then(function () { refaire('Journée mise à la corbeille.'); });
    }
  });
}
/* Les saisies d'un jour, rangées par chantier : durée totale, personnes,
   prestations en clair, et les journées qui les portent. */
function parChantierDuJour(reels) {
  var par = {}, ordre = [];
  reels.forEach(function (r) {
    var id = r.chantier.id;
    if (!par[id]) { par[id] = { chantier: r.chantier, heures: 0, trajet: 0, personnes: 1, prestations: [], jrn: [] }; ordre.push(id); }
    var x = par[id];
    x.heures = C.arr(x.heures + C.heuresSaisie(r.temps, A.cfg), 2);
    x.trajet = C.arr(x.trajet + C.nb(r.temps.trajet), 3);
    x.personnes = Math.max(x.personnes, C.nb(r.temps.personnes) || 1);
    var n = r.temps.activite ? C.nomTravail(r.temps.activite) : '';
    if (n && x.prestations.indexOf(n) < 0) x.prestations.push(n);
    if (r.temps.jrn && x.jrn.indexOf(r.temps.jrn) < 0) x.jrn.push(r.temps.jrn);
  });
  return ordre.map(function (id) { return par[id]; });
}
/* Retirer une journée entière, vers la Corbeille, d'où elle revient. */
function retirerJourneesDe(ids) {
  var l = (A.journees || []).filter(function (j) { return ids.indexOf(j.id) >= 0; });
  A.journees = (A.journees || []).filter(function (j) { return ids.indexOf(j.id) < 0; });
  return Promise.all(l.map(function (j) {
    var c = j.chantier ? chantier(j.chantier) : null;
    return jeterObjet('journee', j, dateCourte(j.date) + ' — ' + (c ? C.nomChantier(c) : (j.lieu || 'sans chantier')),
      C.ditHeures(C.heuresJournee(j)));
  })).then(function () {
    indexerJournees();
    return Promise.all([sauverJournees(), sauverChantiers()]);
  });
}
/* « journée », « demi-journée », sinon la durée. */
function partEnMots(p) {
  p = C.nb(p) || 1;
  return p === 1 ? 'journée' : p === 0.5 ? 'demi-journée' : C.ditDuree(p * C.HEURES_JOUR(A.cfg), A.cfg);
}
function trouveAide(st) {
  for (var i = 0; i < C.STATUTS_JOUR.length; i++) {
    if (C.STATUTS_JOUR[i].c === st) return C.STATUTS_JOUR[i].aide || '';
  }
  return '';
}
/* La journée « Ma journée » d'une date, s'il y en a une. */
function journeeDuJour(ts) {
  var k = C.jourCle(ts);
  return (A.journees || []).filter(function (j) { return C.jourCle(j.date) === k; })[0] || null;
}

/* Les fenêtres qu'ouvre la fiche du jour montent du bas comme elle, et un
   lien « ← jour » y ramène : sans lui, fermer renvoyait à l'Agenda, et il
   fallait rouvrir le jour pour continuer. */
function feuilleDuJour(titre, ts, html) {
  modale(titre, '<button type="button" class="retour-jour" id="retour-jour">' + picto('retour') +
    esc(majuscule(jourEnLettres(ts))) + '</button>' + html);
  $('#modale').classList.add('feuille-nav');
  $('#retour-jour').addEventListener('click', function () { fermerModale(); ouvrirFicheJour(ts); });
}

/* Déplacer ce qui était posé un jour vers un autre. Les chantiers du jour
   d'origine suivent en bloc : c'est le cas courant — une journée repoussée.
   Le statut choisi en posant suit le jour ; la marque « vu » non. */
function ouvrirDeplacerJour(ts) {
  ts = C.minuit(ts);
  var o = occupationDu(ts);
  var d = new Date(ts);
  feuilleDuJour('Déplacer la journée du ' + d.toLocaleDateString('fr-FR'), ts,
    '<p class="sous-titre-bloc">' +
    esc(o.prevus.map(function (p) { return C.nomChantier(p.chantier); }).join(', ')) +
    ' — vers quel jour ?</p>' +
    '<div class="champ"><label class="eyebrow" for="dj-date">Le vrai jour</label>' +
    '<input type="date" id="dj-date" value="' + versChamp(ts) + '"></div>' +
    '<p class="muted" style="font-size:11.5px;margin:0 0 11px">Le jour d’origine ' +
    'redevient libre. Vous pourrez y noter votre temps ensuite.</p>' +
    '<div class="btn-rang">' +
    '<button class="btn primaire" id="dj-ok">Déplacer</button></div>');
  $('#dj-ok').addEventListener('click', function () {
    var vers = versDate($('#dj-date').value);
    if (!vers) { toast('Choisissez un jour.'); return; }
    if (C.jourCle(vers) === C.jourCle(ts)) { toast('C’est le même jour.'); return; }
    o.prevus.forEach(function (p) {
      var c = p.chantier;
      var avant = C.journeesPlacees(c).filter(function (x) { return C.jourCle(x.d) === C.jourCle(ts); })[0];
      c.jours = (c.jours || []).filter(function (j) {
        return jourDePose(j) !== C.jourCle(ts) && jourDePose(j) !== C.jourCle(vers);
      });
      var nouv = { d: C.minuit(vers), p: avant ? avant.p : 1 };
      if (avant && avant.ferme != null) nouv.ferme = avant.ferme;
      c.jours.push(nouv);
      c.jours.sort(function (a, b) { return tsPose(a) - tsPose(b); });
      c.maj = Date.now();
    });
    indexerJournees();
    sauverChantiers().then(function () {
      fermerModale(); renderCalendrier(); renderFiche(); renderCarnet(); renderAccueil();
      toast('Journée déplacée au ' + new Date(vers).toLocaleDateString('fr-FR') + '.');
    });
  });
}

function ouvrirAbsence(ts) {
  ts = C.minuit(ts);
  var abs = C.estAbsent(absences(), ts);
  var d = new Date(ts);
  feuilleDuJour('Jour non travaillé — ' + d.toLocaleDateString('fr-FR'), ts,
    '<div class="champ"><label class="eyebrow" for="ab-note">Pourquoi</label>' +
    '<input type="text" id="ab-note" class="gros" autocomplete="off" ' +
    'placeholder="congé, pluie, arrêt…" value="' + esc(abs ? abs.note || '' : '') + '"></div>' +
    '<p class="muted" style="font-size:11.5px;margin:0 0 11px">La case sera grisée. ' +
    'Un chantier encore posé ce jour-là reste visible dans la fiche du jour : ' +
    'à vous de le déplacer.</p>' +
    '<div class="btn-rang">' +
    '<button class="btn primaire" id="ab-ok">Enregistrer</button></div>');
  $('#ab-ok').addEventListener('click', function () {
    poserAbsence(ts, $('#ab-note').value.trim()).then(function () {
      indexerJournees();
      fermerModale(); renderCalendrier(); renderAccueil(); renderFiche();
      toast('Jour marqué non travaillé.');
    });
  });
}

/* Poser un chantier sur un jour (bulle, fiche du jour). Les chantiers qui
   peuvent encore recevoir du travail — ni payés ni sans suite — rangés par
   étape, comme Aujourd'hui. Puis le statut du jour, proposé d'après le
   chantier et modifiable (G3) : à venir, posé ou posé sur un devis pas
   signé ; passé, il a eu lieu — une journée faite, entière ou demie. */
function chantiersAPoser() {
  return (A.chantiers || []).filter(function (c) { return C.statutOuvert(c.statut); })
    .sort(function (a, b) {
      return C.etapeChantier(a) - C.etapeChantier(b) || C.dateChantier(b) - C.dateChantier(a);
    });
}
function ouvrirPoserChantier(ts) {
  ts = C.minuit(ts);
  var l = chantiersAPoser();
  if (!l.length) { toast('Aucun chantier à poser.'); return; }
  var passe = ts < C.minuit(Date.now());
  var hj = C.HEURES_JOUR(A.cfg) || 8;
  var choix = { id: null, st: null };
  var et = -1, liste = '';
  l.forEach(function (c) {
    var e = C.etapeChantier(c);
    if (e !== et) { et = e; liste += '<p class="pj-etape">' + esc(NOMS_ETAPES[e] || '') + '</p>'; }
    liste += '<button type="button" class="pj-ch" data-pjch="' + esc(c.id) + '" aria-pressed="false">' +
      '<b>' + esc(C.nomChantier(c)) + '</b>' + pointsEtape(c) +
      '<small>' + esc([c.donneur, C.nomStatut(c.statut, c)].filter(Boolean).join(' · ')) + '</small></button>';
  });
  feuilleDuJour('Poser un chantier — ' + new Date(ts).toLocaleDateString('fr-FR'), ts,
    '<div class="pj-liste" id="pj-liste">' + liste + '</div><div id="pj-statut"></div>');
  var puce = function (st, classe, txt) {
    return '<button type="button" data-pjst="' + st + '" aria-pressed="' + String(choix.st === st) + '">' +
      '<i class="' + classe + '"></i>' + txt + '</button>';
  };
  var montrerStatut = function () {
    var c = chantier(choix.id); if (!c) return;
    var ferme = C.fermeteDe(c) === 'ferme';
    $('#pj-statut').innerHTML = '<p class="fj-sous">Statut de ce jour</p>' + (passe
      ? '<p class="fj-aide">Date passée : le jour compte comme fait. Un appui sur le jour, ensuite, ' +
        'pour préciser heures, prestations et kilomètres.</p><div class="pj-st">' +
        puce('j', 'pj-fait', 'Fait · journée (' + E.fmt(hj, hj % 1 ? 1 : 0) + ' h)') +
        puce('d', 'pj-fait', 'Fait · demi-journée (' + E.fmt(hj / 2, (hj / 2) % 1 ? 1 : 0) + ' h)') + '</div>'
      : '<p class="fj-aide">Proposé d’après le chantier : ' +
        (ferme ? 'devis signé ou sans devis' : 'devis encore en attente') + '.</p><div class="pj-st">' +
        puce('ferme', 'pj-pose', 'Posé') + puce('provisoire', 'pj-posep', 'Posé, devis pas signé') + '</div>' +
        '<div class="champ" style="margin-top:10px"><label class="eyebrow" for="pj-part">Combien de temps</label>' +
        '<select id="pj-part">' + partsPossibles(1) + '</select></div>') +
      '<div class="btn-rang"><button class="btn primaire plein" id="pj-ok">Poser</button></div>';
  };
  $('#modale-corps').addEventListener('click', function (e) {
    var ch = e.target.closest('[data-pjch]');
    if (ch) {
      choix.id = ch.dataset.pjch;
      var c = chantier(choix.id);
      choix.st = passe ? 'j' : C.fermeteDe(c);
      $$('#pj-liste [data-pjch]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x.dataset.pjch === choix.id));
      });
      montrerStatut();
      return;
    }
    var s = e.target.closest('[data-pjst]');
    if (s) {
      choix.st = s.dataset.pjst;
      $$('#pj-statut [data-pjst]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x.dataset.pjst === choix.st));
      });
      return;
    }
    if (e.target.closest('#pj-ok')) poserLeChantier(ts, choix, passe);
  });
}
function poserLeChantier(ts, choix, passe) {
  var c = chantier(choix.id); if (!c) { toast('Choisissez un chantier.'); return; }
  var hj = C.HEURES_JOUR(A.cfg) || 8;
  if (passe) {
    var h = choix.st === 'd' ? hj / 2 : hj;
    creerJourneeFaite(c, ts, h);
    indexerJournees();
    sauverJournees().then(function () {
      fermerModale(); majJournees();
      toast(majuscule(jourCourt(ts)) + ' : ' + C.nomChantier(c) + ', ' +
        E.fmt(h, h % 1 ? 1 : 0) + ' h comptées comme faites.');
    });
    return;
  }
  var k = C.jourCle(ts);
  var pose = { d: ts, p: C.nb($('#pj-part') && $('#pj-part').value) || 1 };
  /* On n'écrit le statut que s'il contredit le chantier : sinon le jour suit
     le chantier, et se confirme tout seul le jour où le devis est signé. */
  if (choix.st && choix.st !== C.fermeteDe(c)) pose.ferme = choix.st === 'ferme';
  c.jours = (c.jours || []).filter(function (j) { return jourDePose(j) !== k; });
  c.jours.push(pose);
  c.jours.sort(function (a, b) { return tsPose(a) - tsPose(b); });
  c.maj = Date.now();
  indexerJournees();
  sauverChantiers().then(function () {
    fermerModale(); renderCalendrier(); renderFiche(); renderCarnet(); renderAccueil();
    toast(C.fermeteJour(c, pose) === 'ferme' ? 'Chantier posé sur ce jour.'
      : 'Posé en pointillés : il ne compte pas tant que le devis n’est pas signé.');
  });
}

/* L'appui long sur un jour (G2) : une bulle sous le jour, pour aller vite —
   saisir, poser, marquer. L'appui simple ouvre toujours la fiche du jour,
   qui porte les mêmes boutons et le détail. */
function ouvrirBulleJour(ts, el) {
  ts = C.minuit(ts);
  if (A.bulle && A.bulle.ts === ts && Date.now() - A.bulle.ouverte < 700) return;
  fermerBulleJour();
  var fond = document.createElement('div');
  fond.id = 'cal-bulle-fond'; fond.className = 'cal-bulle-fond';
  var b = document.createElement('div');
  b.id = 'cal-bulle'; b.className = 'cal-bulle'; b.setAttribute('role', 'menu');
  b.innerHTML = '<p class="cb-t">' + esc(majuscule(jourEnLettres(ts))) + '</p>' +
    '<button type="button" role="menuitem" data-bulle="mj">' + picto('horloge') + 'Saisir ma journée</button>' +
    '<button type="button" role="menuitem" data-bulle="poser">' + picto('carnet') + 'Poser un chantier</button>' +
    '<button type="button" role="menuitem" data-bulle="abs">' + picto('pause') + 'Jour non travaillé</button>';
  document.body.appendChild(fond);
  document.body.appendChild(b);
  A.bulle = { ts: ts, ouverte: Date.now() };
  if (el) {
    el.classList.add('appui');
    /* La largeur utile, sans la barre de défilement : à 320 px, la bulle
       dépassait de trois pixels quand la page défilait. */
    var larg = document.documentElement.clientWidth || window.innerWidth || 360, haut = window.innerHeight || 640;
    if ((b.offsetWidth || 0) > larg - 24) b.style.width = (larg - 24) + 'px';
    var r = el.getBoundingClientRect(), w = b.offsetWidth || 240, hb = b.offsetHeight || 170;
    var left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, larg - w - 12));
    var top = r.bottom + 6;
    if (top + hb > haut - 90) top = Math.max(12, r.top - hb - 6);
    b.style.left = left + 'px'; b.style.top = top + 'px';
  }
  /* Le doigt qui se lève après l'appui long ne doit pas refermer la bulle
     qu'il vient d'ouvrir. */
  fond.addEventListener('click', function () {
    if (A.bulle && Date.now() - A.bulle.ouverte > 400) fermerBulleJour();
  });
  fond.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  b.addEventListener('click', function (e) {
    var x = e.target.closest('[data-bulle]'); if (!x) return;
    var quoi = x.dataset.bulle;
    fermerBulleJour();
    if (quoi === 'mj') {
      var jd = journeeDuJour(ts);
      ouvrirJournee(jd ? jd.id : null, jd ? null : { date: ts });
    } else if (quoi === 'poser') ouvrirPoserChantier(ts);
    else ouvrirAbsence(ts);
  });
}
function fermerBulleJour() {
  ['#cal-bulle', '#cal-bulle-fond'].forEach(function (s) {
    var e = $(s); if (e && e.parentNode) e.parentNode.removeChild(e);
  });
  $$('#cal-grille .appui').forEach(function (x) { x.classList.remove('appui'); });
  A.bulle = null;
}

/* ------------------------------------------------ fiche de chantier */
/* Le téléphone d'un donneur d'ordre ne change pas la forme de ses listes :
   elles restent des noms, et les datalists continuent d'y puiser. Le numéro
   vit à côté, indexé par le nom. Zéro migration, donc zéro risque sur ce
   qu'il a déjà saisi — et il ne le remplit que le jour où il en a besoin. */
var TYPES_CLIENT = [
  { c: 'proprio', n: 'Propriétaire forestier', siren: true },
  { c: 'gestion', n: 'Gestionnaire' },
  { c: 'etf', n: 'Entreprise de travaux' },
  { c: 'autre', n: 'Autre' }
];
function nomTypeClient(c) {
  for (var i = 0; i < TYPES_CLIENT.length; i++) {
    if (TYPES_CLIENT[i].c === c) return TYPES_CLIENT[i].n;
  }
  return '';
}
function typeDe(nom) {
  var c = contacts()[String(nom || '').trim()];
  return (c && c.type) || '';
}
function poserType(nom, t) {
  var k = String(nom || '').trim();
  if (!k) return;
  var l = contacts();
  l[k] = l[k] || {};
  l[k].type = t || '';
}
/* Tant qu'on ne sait pas ce qu'est quelqu'un, on ne lui retire rien : un
   nom sans type garde la question du SIREN. Les chantiers déjà saisis sont
   dans ce cas, et rien ne doit changer pour eux. */
function sirenPossible(nom) {
  var t = typeDe(nom);
  if (!t) return true;
  for (var i = 0; i < TYPES_CLIENT.length; i++) {
    if (TYPES_CLIENT[i].c === t) return !!TYPES_CLIENT[i].siren;
  }
  return true;
}
function contacts() {
  A.cfg = A.cfg || {};
  A.cfg.contacts = A.cfg.contacts || {};
  return A.cfg.contacts;
}
function telDe(nom) {
  var c = contacts()[String(nom || '').trim()];
  return (c && c.tel) || '';
}
function sirenDe(nom) {
  var c = contacts()[String(nom || '').trim()];
  return !!(c && c.siren);
}
function poserSiren(nom, oui) {
  var k = String(nom || '').trim();
  if (!k) return;
  var l = contacts();
  l[k] = l[k] || {};
  l[k].siren = !!oui;
}
function poserTel(nom, tel) {
  var k = String(nom || '').trim();
  if (!k) return;
  var l = contacts();
  if (!tel) { if (l[k]) delete l[k].tel; return; }
  l[k] = l[k] || {};
  l[k].tel = tel;
}

/* Un chantier de la même forêt, déjà renseigné : la ligne électrique et le
   ruisseau ne bougent pas d'une année sur l'autre. La forêt se reconnaît à
   son nom — c'est le critère qu'il a proposé, et le seul dont on dispose.
   La commune s'y ajoute : deux « Bois du Haut » dans deux communes ne sont
   pas la même forêt. */
function memeForet(c) {
  if (!c) return null;
  var f = String(c.foret || '').trim().toLowerCase();
  if (!f) return null;
  var com = String(c.commune || '').trim().toLowerCase();
  var candidats = (A.chantiers || []).filter(function (x) {
    if (x.id === c.id) return false;
    if (String(x.foret || '').trim().toLowerCase() !== f) return false;
    if (com && String(x.commune || '').trim().toLowerCase() !== com) return false;
    return ((x.fiche || {}).risques || []).length > 0;
  });
  candidats.sort(function (a, b) { return C.dateChantier(b) - C.dateChantier(a); });
  return candidats[0] || null;
}
function chantierFiche() {
  return A.fch ? chantier(A.fch) : null;
}
function renderFicheChantier() {
  var z = $('#fch-corps'); if (!z) return;
  /* « Je filtre chantier ouvert, comme ça je n'ai pas à chercher dans une
     liste assez grande. » */
  var f = A.fchFiltre || 'ouverts';
  var liste = C.tri(C.filtre(A.chantiers, f));
  var c = chantierFiche();
  if (c && liste.indexOf(c) < 0) liste = [c].concat(liste);

  var tete = '<div class="carte">' +
    '<div class="champ"><label class="eyebrow" for="fch-filtre">Parmi</label>' +
    '<select id="fch-filtre">' +
    [['ouverts', 'Chantiers ouverts'], ['encours', 'En cours'], ['accepte', 'À programmer'],
      ['envoye', 'Devis envoyés'], ['tous', 'Tous']].map(function (o) {
      return '<option value="' + o[0] + '"' + (f === o[0] ? ' selected' : '') + '>' +
        esc(o[1]) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="fch-ch">Chantier</label>' +
    '<select id="fch-ch"><option value="">— choisir —</option>' +
    liste.map(function (x) {
      return '<option value="' + x.id + '"' + (c && c.id === x.id ? ' selected' : '') + '>' +
        esc(C.nomChantier(x)) + '</option>';
    }).join('') + '</select></div></div>';

  if (!c) {
    z.innerHTML = tete + '<div class="carte"><div class="vide"><p>Choisissez un chantier. ' +
      'Sylve reprendra « Facturé à », le donneur d’ordre, le lieu et les travaux ; ' +
      'vous ne cocherez que les risques.</p></div></div>';
    return;
  }

  var fi = c.fiche || {};
  var coches = fi.risques || [];
  var manques = C.manquesFiche(c, A.cfg);

  z.innerHTML = tete +
    (C.ficheRequise(c)
      ? '<div class="carte" style="border-color:#D9BCAE;background:#F7E6D9">' +
        '<p style="font-size:13px;margin:0;color:#7A2F14"><b>Fiche obligatoire.</b> ' +
        'Ce chantier dépasse ' + C.SEUIL_FICHE_HA + ' hectares — la fiche est exigée ' +
        'par le décret du 17 décembre 2010.</p></div>'
      : '') +
    (manques.length
      ? '<div class="carte"><h2>Il manque</h2><p class="acompleter-bloc" style="margin:0">' +
        esc(manques.join(', ')) + '.</p>' +
        '<p class="muted" style="font-size:11.5px;margin:9px 0 0">La fiche s’imprime quand ' +
        'même — une fiche incomplète sur le chantier vaut mieux qu’aucune fiche — mais elle ' +
        'écrit « à compléter » là où le blanc serait trompeur.</p>' +
        '<div class="btn-rang" style="margin-top:11px">' +
        '<button class="btn btn-min" id="fch-identite">Compléter le chantier</button></div></div>'
      : '') +

    '<div class="carte"><h2>Qui, où, quoi</h2>' +
    paireFiche('Facturé à', c.proprietaire || '—') +
    paireFiche('Donneur d’ordre', c.donneur || c.client || '—') +
    paireFiche('Commune', (c.commune || '—') + (c.departement ? ' (' + c.departement + ')' : '')) +
    paireFiche('Lieu-dit', c.foret || '—') +
    paireFiche('Parcelles', c.parcelles || '—') +
    (c.cadastre ? paireFiche('Cadastre', c.cadastre) : '') +
    paireFiche('Position', c.gps && c.gps.lat != null
      ? C.arr(c.gps.lat, 5) + ', ' + C.arr(c.gps.lon, 5) : '—') +
    '<div class="grille g2" style="margin-top:11px">' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="fch-telp">' +
    'Téléphone du propriétaire <span class="muted" style="text-transform:none;' +
    'letter-spacing:0;font-weight:400">(facultatif)</span></label>' +
    '<input type="text" id="fch-telp" inputmode="tel" value="' +
    esc(telDe(c.proprietaire)) + '"></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="fch-teld">' +
    'Téléphone du donneur d’ordre</label>' +
    '<input type="text" id="fch-teld" inputmode="tel" value="' +
    esc(telDe(c.donneur || c.client)) + '"></div></div>' +
    '<p class="muted" style="font-size:11.5px;margin:9px 0 0">Retenus pour ce nom : ' +
    'la prochaine fiche les reprendra.</p></div>' +

    '<div class="carte"><h2>Période d’intervention</h2>' +
    '<p class="sous-titre-bloc">Au moment d’imprimer vous ne savez pas tous les jours ' +
    'où vous irez. La fiche annonce donc une période, pas une liste de dates.</p>' +
    '<div class="grille g2">' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="fch-debut">Du</label>' +
    '<input type="date" id="fch-debut" value="' + versChamp(fi.debut || premierJourPose(c)) + '"></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="fch-fin">Au</label>' +
    '<input type="date" id="fch-fin" value="' + versChamp(fi.fin) + '"></div></div></div>' +

    (function () {
      if (coches.length) return '';
      var jum = memeForet(c);
      if (!jum) return '';
      var n = ((jum.fiche || {}).risques || []).length;
      return '<div class="carte"><h2>Déjà connu ici</h2>' +
        '<p class="sous-titre-bloc">« ' + esc(jum.nom || 'Chantier') + ' » est dans la ' +
        'même forêt et porte ' + n + ' risque' + (n > 1 ? 's' : '') + ' coché' +
        (n > 1 ? 's' : '') + '. La ligne électrique et le ruisseau n’ont pas bougé.</p>' +
        '<div class="btn-rang"><button class="btn btn-min" id="fch-reprendre">' +
        'Reprendre ses risques et ses consignes</button></div></div>';
    })() +
    C.RISQUES_FICHE.map(function (g) {
      return '<div class="carte"><h2>' + esc(g.n) + '</h2>' +
        '<div class="chips">' + g.l.map(function (r) {
          return '<button type="button" class="chip" data-fchr="' + r[0] + '" aria-pressed="' +
            (coches.indexOf(r[0]) >= 0 ? 'true' : 'false') + '">' +
            '<b class="num" style="font-weight:700">' + r[0] + '</b> ' + esc(r[1]) + '</button>';
        }).join('') + '</div>' +
        (g.g === 'sanitaire'
          ? '<div class="champ" style="margin:11px 0 0;width:11em">' +
            '<label class="eyebrow" for="fch-prop">Proportion (%)</label>' +
            '<input type="text" id="fch-prop" inputmode="decimal" value="' +
            esc(fi.proportion || '') + '"></div>'
          : '') +
        '<div class="champ" style="margin:11px 0 0">' +
        '<label class="eyebrow" for="fch-c-' + g.g + '">Consignes à respecter</label>' +
        '<textarea id="fch-c-' + g.g + '" rows="2" data-fchc="' + g.g + '">' +
        esc((fi.consignes || {})[g.g] || '') + '</textarea></div></div>';
    }).join('') +

    '<div class="carte"><h2>Secours</h2>' +
    '<div class="champ"><label class="eyebrow" for="fch-acces">Moyens d’accès au chantier</label>' +
    '<textarea id="fch-acces" rows="2">' + esc(fi.acces || '') + '</textarea></div>' +
    '<p class="eyebrow" style="margin:4px 0 6px">Couverture téléphonique</p>' +
    '<div class="chips" id="fch-reseaux">' + C.RESEAUX_FICHE.map(function (r) {
      return '<button type="button" class="chip" data-fchres="' + r.c + '" aria-pressed="' +
        ((fi.reseau || 'bonne') === r.c ? 'true' : 'false') + '">' + esc(r.n) + '</button>';
    }).join('') + '</div>' +
    '<div class="champ" style="margin-top:11px"><label class="eyebrow" for="fch-ptres">' +
    'Point de réseau le plus proche</label>' +
    '<input type="text" id="fch-ptres" value="' + esc(fi.pointReseau || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="fch-ptr">Point de rencontre avec les secours</label>' +
    '<input type="text" id="fch-ptr" value="' + esc(fi.pointRencontre || '') + '"></div>' +
    '<div class="btn-rang">' +
    '<button class="btn btn-min" id="fch-ici">Sa position, je suis dessus</button>' +
    '</div>' +
    '<div class="champ" style="margin-top:11px"><label class="eyebrow" for="fch-gps">' +
    'Ou ses coordonnées, collées depuis une carte</label>' +
    '<input type="text" id="fch-gps" placeholder="44.35012, 3.58043" value="' +
    (fi.gpsRencontre && fi.gpsRencontre.lat != null
      ? C.arr(fi.gpsRencontre.lat, 5) + ', ' + C.arr(fi.gpsRencontre.lon, 5) : '') + '"></div>' +
    '</div>' +

    '<div class="carte"><h2>Co-activité et croquis</h2>' +
    '<div class="champ"><label class="eyebrow" for="fch-coact">Interventions simultanées ou successives</label>' +
    '<textarea id="fch-coact" rows="2" placeholder="aucune autre entreprise prévue">' +
    esc(fi.coactivite || '') + '</textarea></div>' +
    '<label class="ligne-check" style="display:flex;align-items:flex-start;gap:8px;' +
    'font-size:13.5px;margin:0 0 11px"><input type="checkbox" id="fch-plan"' +
    (fi.planJoint ? ' checked' : '') + ' style="margin-top:2px"><span>Un plan est joint ' +
    'à la fiche<span class="muted" style="display:block;font-size:11.5px">Le cadre du ' +
    'croquis portera « voir plan joint » au lieu de rester vide.</span></span></label>' +
    '<div class="champ"><label class="eyebrow" for="fch-obs">Observations</label>' +
    '<textarea id="fch-obs" rows="2">' + esc(fi.observations || '') + '</textarea></div>' +
    '</div>' +

    '<div class="carte"><div class="btn-rang">' +
    '<button class="btn" id="fch-voir">Aperçu</button>' +
    '<button class="btn primaire" id="fch-imprimer">Imprimer / PDF</button></div>' +
    '<p class="muted" style="font-size:11.5px;margin:10px 0 0">L’impression du téléphone ' +
    'propose « Enregistrer au format PDF ». Le fichier part ensuite par mail comme ' +
    'n’importe quel autre.</p></div>';
}
/* Tout l'écran se relit d'un coup, comme les autres formulaires du projet :
   un enregistrement par champ ferait vingt écritures pour une fiche. */
function lireFicheChantier() {
  var c = chantierFiche(); if (!c) return null;
  var f = c.fiche || {};
  var risques = [];
  $$('#fch-corps [data-fchr]').forEach(function (b) {
    if (b.getAttribute('aria-pressed') === 'true') risques.push(Number(b.dataset.fchr));
  });
  var consignes = {};
  $$('#fch-corps [data-fchc]').forEach(function (t) {
    if (t.value.trim()) consignes[t.dataset.fchc] = t.value.trim();
  });
  var res = f.reseau || 'bonne';
  $$('#fch-reseaux [data-fchres]').forEach(function (b) {
    if (b.getAttribute('aria-pressed') === 'true') res = b.dataset.fchres;
  });
  c.fiche = {
    risques: risques, consignes: consignes,
    proportion: $('#fch-prop') ? $('#fch-prop').value.trim() : (f.proportion || ''),
    debut: versDate($('#fch-debut').value), fin: versDate($('#fch-fin').value),
    acces: $('#fch-acces').value.trim(), reseau: res,
    pointReseau: $('#fch-ptres').value.trim(),
    pointRencontre: $('#fch-ptr').value.trim(),
    gpsRencontre: lireCoordonnees($('#fch-gps').value) || f.gpsRencontre || null,
    coactivite: $('#fch-coact').value.trim(),
    planJoint: $('#fch-plan').checked,
    observations: $('#fch-obs').value.trim(),
    maj: Date.now()
  };
  poserTel(c.proprietaire, $('#fch-telp').value.trim());
  poserTel(c.donneur || c.client, $('#fch-teld').value.trim());
  c.maj = Date.now();
  return c;
}
/* « Je ne sais pas comment on peut faire pour récupérer le point de Google
   Maps. » Une application web ne peut pas lire ce qu'on a désigné dans une
   autre : il n'y a pas de retour. Mais on peut y copier des coordonnées —
   appui long sur le point — et les coller ici. On accepte donc les deux
   séparateurs et les deux écritures décimales. */
function lireCoordonnees(txt) {
  var t = String(txt || '').replace(/,(?=\d{1,6}\b)/g, '.').trim();
  var m = t.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  var lat = Number(m[1]), lon = Number(m[2]);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: lat, lon: lon };
}
function enregistrerFiche(message) {
  var c = lireFicheChantier(); if (!c) return;
  return Promise.all([sauverChantiers(), Promise.resolve(sauverCfg())]).then(function () {
    if (message) toast(message);
    return c;
  });
}

/* La feuille. Deux pages, calquées sur le modèle de Pro ETF — c'est celui
   qu'il a désigné, et c'est celui qui cite le décret. Ce que Sylve ne sait
   pas s'écrit « à compléter » : un blanc sur une fiche de sécurité se lit
   comme une absence de risque. */
function htmlFeuilleFiche(c) {
  var f = c.fiche || {};
  var cfg = A.cfg || {};
  var v = function (x) {
    return String(x || '').trim()
      ? '<span class="v">' + esc(x) + '</span>'
      : '<span class="v manque">à compléter</span>';
  };
  var l = function (k, x) { return '<div class="fl"><span class="k">' + esc(k) + '</span>' + v(x) + '</div>'; };
  var periode = f.debut
    ? 'du ' + dateCourte(f.debut) + (f.fin ? ' au ' + dateCourte(f.fin) : ' — fin non arrêtée')
    : '';
  var groupe = function (g) {
    var pris = C.risquesCoches(c, g.g);
    return '<div class="fs"><h3>' + esc(g.n) + '</h3>' +
      '<div class="fr">' + g.l.map(function (r) {
        var on = (f.risques || []).indexOf(r[0]) >= 0;
        return '<span class="fc' + (on ? ' on' : '') + '"><i></i>' + r[0] + '. ' + esc(r[1]) + '</span>';
      }).join('') + '</div>' +
      (g.g === 'sanitaire' && f.proportion
        ? '<div class="fl"><span class="k">Proportion</span><span class="v">' +
          esc(f.proportion) + ' %</span></div>' : '') +
      (pris.length
        ? '<div class="fb"><span class="k">Consignes à respecter</span>' +
          ((f.consignes || {})[g.g]
            ? esc(f.consignes[g.g])
            : '<span class="manque">à compléter — des risques sont cochés</span>') + '</div>'
        : '') + '</div>';
  };

  return '<div class="feuille">' +
    '<div class="ft"><div><h1>Fiche de chantier</h1>' +
    '<p class="lg">Décret n° 2010-1603 du 17 décembre 2010 — arrêté du 31 mars 2011</p></div>' +
    '<div class="fm"><b>' + esc(cfg.nomEntreprise || 'Votre entreprise') + '</b>' +
    (cfg.siret ? '<span>SIRET ' + esc(cfg.siret) + '</span>' : '<span class="manque">SIRET à compléter</span>') +
    (cfg.telEntreprise ? '<span>' + esc(cfg.telEntreprise) + '</span>' : '<span class="manque">téléphone à compléter</span>') +
    (cfg.adresseEntreprise ? '<span>' + esc(cfg.adresseEntreprise) + '</span>' : '') +
    '</div></div>' +

    /* La feuille dit « propriétaire » parce que l'arrêté du 31 mars 2011 le
       nomme ainsi : elle part sur le chantier et se lit par un contrôleur.
       Le mot de l'écran a changé, pas celui du document. */
    '<div class="fs"><h2>Propriétaire et donneur d’ordre</h2><div class="fg">' +
    l('Propriétaire', c.proprietaire) +
    /* Facultatif : l'arrêté demande ses coordonnées, pas son téléphone. */
    '<div class="fl"><span class="k">Téléphone</span><span class="v">' +
    esc(telDe(c.proprietaire) || '—') + '</span></div>' +
    l('Donneur d’ordre', c.donneur || c.client) +
    l('Téléphone', telDe(c.donneur || c.client)) +
    '</div></div>' +

    '<div class="fs"><h2>Chantier et localisation</h2><div class="fg">' +
    l('Commune', c.commune) + l('Département', c.departement) +
    l('Lieu-dit', c.foret) + l('Parcelles', c.parcelles) +
    l('Réf. cadastrale', c.cadastre) +
    l('Coordonnées GPS', c.gps && c.gps.lat != null
      ? C.arr(c.gps.lat, 5) + ', ' + C.arr(c.gps.lon, 5) : '') +
    '</div>' +
    '<div class="fl"><span class="k">Nature des travaux</span>' + v(naturedesTravaux(c)) + '</div>' +
    '<div class="fl"><span class="k">Entreprise intervenante</span>' +
    v((cfg.nomEntreprise || '') + (periode ? ' — ' + periode : '')) + '</div>' +
    '</div>' +

    C.RISQUES_FICHE.map(groupe).join('') +
    '<div class="fp"><span>Fiche de chantier — ' + esc(C.nomChantier(c)) + '</span>' +
    '<span>Établie le ' + dateCourte(Date.now()) + ' · page 1 sur 2</span></div>' +
    '</div>' +

    '<div class="feuille saut">' +
    '<div class="fs"><h2>Secours</h2>' +
    '<div class="fu">URGENCES 112 · POMPIERS 18 · SAMU 15</div>' +
    '<div class="fb"><span class="k">Moyens d’accès au chantier</span>' +
    (f.acces ? esc(f.acces) : '<span class="manque">à compléter</span>') + '</div>' +
    '<div class="fg">' +
    l('Couverture téléphonique', C.nomReseau(f.reseau || 'bonne')) +
    l('Point de réseau le plus proche', f.pointReseau) +
    '</div>' +
    '<div class="fb"><span class="k">Point de rencontre avec les secours</span>' +
    (f.pointRencontre ? esc(f.pointRencontre) : '<span class="manque">à compléter</span>') +
    (f.gpsRencontre && f.gpsRencontre.lat != null
      ? ' — ' + C.arr(f.gpsRencontre.lat, 5) + ', ' + C.arr(f.gpsRencontre.lon, 5) : '') +
    '</div></div>' +

    '<div class="fs"><h2>Interventions simultanées ou successives</h2>' +
    '<div class="fb">' + (f.coactivite ? esc(f.coactivite) : 'Aucune autre entreprise prévue.') +
    '</div></div>' +

    '<div class="fs"><h2>Croquis du chantier</h2>' +
    (f.planJoint
      ? '<div class="fb"><b>Voir le plan joint à la présente fiche.</b> ' +
        'Il porte les accès, le point de rencontre et les zones à risque.</div>'
      : '<div class="fv"><span>Accès (A) · point de rencontre (PR) · zones à ' +
        'risque, avec leur numéro</span></div>') + '</div>' +

    '<div class="fs"><h2>Observations</h2><div class="fb" style="min-height:14mm">' +
    esc(f.observations || '') + '</div></div>' +

    '<div class="fs"><h2>Signatures</h2><div class="fsg">' +
    '<div>Date et signature du donneur d’ordre</div>' +
    '<div>Date et signature du chef d’entreprise</div></div>' +
    '<p class="fn">Cette fiche doit être présente sur le chantier. Tous les intervenants ' +
    'doivent en prendre connaissance avant le début des travaux.</p></div>' +
    '<div class="fp"><span>Fiche de chantier — ' + esc(C.nomChantier(c)) + '</span>' +
    '<span>Établie le ' + dateCourte(Date.now()) + ' · page 2 sur 2</span></div>' +
    '</div>';
}
/* Ce que la fiche appelle « nature des travaux » : les prestations du devis,
   avec leur quantité. C'est ce que le donneur d'ordre reconnaîtra. */
function naturedesTravaux(c) {
  var vus = [];
  (c.lignes || []).forEach(function (x) {
    var n = C.nomTravauxLigne(x);
    if (n && vus.indexOf(n) < 0) vus.push(n);
  });
  var ha = C.quantite(c, 'ha');
  return vus.join(', ') + (ha ? ' — ' + E.fmt(ha, ha % 1 ? 2 : 0) + ' ha' : '');
}
/* « Ensuite je peux faire visionner pour voir à quoi ressemble le PDF. »
   La même feuille, dans une fenêtre, avant d'engager l'impression. */
function apercuFiche(c) {
  if (!c) return;
  modale('Aperçu — ' + C.nomChantier(c),
    '<div class="apercu-feuille">' + htmlFeuilleFiche(c) + '</div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="ap-imp">Imprimer / PDF</button></div>');
  $('#ap-imp').addEventListener('click', function () { fermerModale(); imprimerFiche(); });
}
function imprimerFiche() {
  var c = chantierFiche(); if (!c) return;
  var v = $('#vue-impression');
  v.innerHTML = htmlFeuilleFiche(c);
  v.classList.add('impression', 'fiche-ch');
  window.print();
  setTimeout(function () {
    v.classList.remove('impression', 'fiche-ch'); v.innerHTML = '';
  }, 800);
}

/* Le premier jour posé sert de début par défaut : c'est la date qu'il a déjà
   arrêtée en planifiant, il n'a pas à la retaper. */
function premierJourPose(c) {
  var pl = C.journeesPlacees(c);
  return pl.length ? pl[0].d : null;
}

/* La grille du mois. « À programmer » et la ligne « jours à trancher » sont
   partis de l'Agenda au lot r1 : on place depuis la fiche ▸ Travaux ou par
   l'appui long, on estime dans l'étape Devis, et un jour posé qui passe
   compte d'office. */
function renderCalendrier() {
  var g = $('#cal-grille'); if (!g) return;
  fermerBulleJour();
  indexAJour();
  renderBandeauPlanif();
  var cur = A.calMois ? new Date(A.calMois) : new Date();
  var an = cur.getFullYear(), mo = cur.getMonth();
  A.calMois = new Date(an, mo, 1).getTime();
  $('#cal-titre').textContent = MOIS_NOMS[mo] + ' ' + an;

  var premier = new Date(an, mo, 1);
  var dernier = new Date(an, mo + 1, 0);
  /* lundi = 0 dans notre grille */
  var decalage = (premier.getDay() + 6) % 7;
  var occ = C.occupation(A.chantiers, new Date(an, mo, 1 - decalage).getTime(),
    new Date(an, mo + 1, 7).getTime(), A.cfg);
  var prel = prelevementsDuMois(an, mo);
  var ajd = C.minuit(Date.now());
  var cp = A.planifie ? chantier(A.planifie) : null;
  var vus = {}, nOffice = 0, nPrel = 0;

  var h = '<div class="cal">' + JOURS_COURTS.map(function (j) { return '<div class="jn">' + j + '</div>'; }).join('');
  for (var i = 0; i < decalage; i++) h += '<button class="vide" disabled></button>';
  for (var d = 1; d <= dernier.getDate(); d++) {
    var ts = new Date(an, mo, d).getTime();
    var k = C.jourCle(ts), o = occ[k] || { prevus: [], reels: [] };
    /* Un jour, un statut, une couleur : la bande sous le numéro et le fond
       de la case (P5). « La différence entre le vert et le bleu n'est pas
       flagrante » : une pastille de 9 px ne suffisait pas au soleil. */
    var st = C.statutJour(o, absences(), ts);
    vus[st] = 1;
    /* Un jour posé resté dans le passé sans rien compter (d'avant la 4.92,
       ou sur un devis pas signé) : pâle, sans relance. */
    var pale = ts < ajd && (st === 'prevu' || st === 'confirme');
    /* Le ○ d'une journée comptée d'office, jusqu'à ce qu'il en ouvre la fiche. */
    var rond = o.reels.some(function (r) { return r.temps.office && !r.temps.vu; });
    if (rond) nOffice++;
    var cls = ['jour', 'st-' + st];
    if (pale) cls.push('passe');
    if (ts === ajd) cls.push('auj');
    var demi = false;
    if (cp) {
      var part = C.partDuJour(cp, ts);
      if (part > 0) { cls.push('sel'); if (part < 1) demi = true; }
    }
    if (C.estWeekend(ts)) cls.push('we');
    /* Le repère du prélèvement ne remplace pas la couleur du statut : il se
       pose dans l'angle, et il annonce son montant au survol. */
    var pr = prel[k] || [];
    if (pr.length) nPrel++;
    var somme = pr.reduce(function (t2, x) { return t2 + C.nb(x.charge.ttc); }, 0);
    h += '<button class="' + cls.join(' ') + '" data-jour="' + ts + '" aria-label="' +
      esc(jourEnLettres(ts) + ', ' + C.nomStatutJour(st) + (rond ? ', comptée d’office' : '') +
        (pr.length ? ', prélèvement' : '')) + '">' +
      (pr.length ? '<span class="cal-prel" title="' +
        esc(pr.map(function (x) { return x.charge.libelle || 'charge fixe'; }).join(', ')) +
        (somme ? ' — ' + eur(C.arr(somme, 2)) : '') + '">€</span>' : '') +
      (rond ? '<span class="cal-o" aria-hidden="true"></span>' : '') +
      '<span class="n">' + d + (demi ? '<sup>½</sup>' : '') + '</span>' +
      '<span class="bande"></span></button>';
  }
  h += '</div>';
  g.innerHTML = h;

  /* La légende ne dit que ce qui figure dans le mois affiché (G1) : trois
     couleurs et les pointillés, puis, en petit, les deux repères. */
  var hj = C.HEURES_JOUR(A.cfg) || 8;
  var leg = [];
  if (cp) leg.push('<span id="cal-leg-sel"><i class="lg-sel"></i>jour retenu pour ce chantier</span>');
  if (vus.travaille) leg.push('<span><i class="lg-travaille"></i>fait</span>');
  if (vus.confirme) leg.push('<span><i class="lg-confirme"></i>posé</span>');
  if (vus.prevu) leg.push('<span><i class="lg-prevu"></i>posé, devis pas signé</span>');
  if (vus.absent) leg.push('<span><i class="lg-absent"></i>non travaillé</span>');
  var leg2 = [];
  if (nPrel) leg2.push('<span><b class="lg-prel">€</b>prélèvement</span>');
  if (nOffice) leg2.push('<span><i class="lg-o"></i>comptée d’office (' + E.fmt(hj, hj % 1 ? 1 : 0) + ' h)</span>');
  $('#cal-legende').innerHTML = leg.join('');
  $('#cal-legende').hidden = !leg.length;
  $('#cal-leg2').innerHTML = leg2.join('');
  $('#cal-leg2').hidden = !leg2.length;

  /* Trois compteurs (G1) : fait, posé (signé seulement), non travaillé. Un
     jour posé sur un devis pas signé n'est pas compté : il n'engage rien. Le
     non travaillé se montre même à zéro : un compteur qui apparaît et
     disparaît d'un mois à l'autre ne se lit plus. */
  var cm = C.chargeMois(A.chantiers, an, mo, A.cfg);
  var nAbs = (absences() || []).filter(function (a) {
    var da = new Date(a.d);
    return da.getFullYear() === an && da.getMonth() === mo;
  }).length;
  var j = function (n) { return E.fmt(n, n % 1 ? 1 : 0) + ' j'; };
  $('#cal-charge').innerHTML = cp ? '' : '<div class="kpi cal-k3">' +
    '<div class="carte2"><b class="num">' + j(cm.joursReels) + '</b><small>fait</small></div>' +
    '<div class="carte2"><b class="num">' + j(cm.fermes) + '</b><small>posé (signé)</small></div>' +
    '<div class="carte2"><b class="num">' + j(nAbs) + '</b><small>non travaillé</small></div>' +
    '</div>';
  renderHistorique();
}

/* Les prélèvements d'un mois, rangés par jour. Les charges arrêtées et
   celles qui n'ont pas encore commencé n'en sont pas : echeances() borne
   déjà sur charge.debut et charge.fin. */
function prelevementsDuMois(an, mo) {
  var debut = new Date(an, mo, 1).getTime();
  var fin = new Date(an, mo + 1, 0, 23, 59, 59).getTime();
  var par = {};
  (A.charges || []).forEach(function (c) {
    FIN.echeances(c, { debut: debut, fin: fin }).forEach(function (ts) {
      var k = C.jourCle(ts);
      (par[k] = par[k] || []).push({ charge: c, ts: ts });
    });
  });
  return par;
}
/* Ce qui tombe un jour précis : la fiche du jour s'en sert, et elle ne sait
   pas de quel mois elle relève. */
function prelevementsDuJour(ts) {
  var d = new Date(C.minuit(ts));
  return prelevementsDuMois(d.getFullYear(), d.getMonth())[C.jourCle(ts)] || [];
}
/* Sous la grille, l'historique du mois (R7 : la place de la carte Journée).
   « L'Agenda me sert surtout d'historique. » Le mois jour par jour, rangé par
   semaine, la plus récente ouverte ; un appui rouvre la journée. Une journée
   comptée d'office y est, avec son ○ tant qu'il n'a pas ouvert sa fiche ;
   un appui ouvre la fiche du jour, d'où on la précise. */
function renderHistorique() {
  var z = $('#cal-histo'); if (!z) return;
  if (A.planifie) { z.innerHTML = ''; return; }
  var cur = new Date(A.calMois), an = cur.getFullYear(), mo = cur.getMonth();
  var debut = new Date(an, mo, 1).getTime(), fin = new Date(an, mo + 1, 1).getTime();
  var jours = {};
  var jourDe = function (ts) {
    var k = C.jourCle(ts);
    return (jours[k] = jours[k] || { ts: C.minuit(ts), jrn: [], office: [], abs: null });
  };
  (A.journees || []).forEach(function (j) {
    var ts = C.minuit(C.nb(j.date));
    if (ts >= debut && ts < fin) jourDe(ts).jrn.push(j);
  });
  journeesDOffice().forEach(function (o) {
    if (o.d >= debut && o.d < fin) jourDe(o.d).office.push(o);
  });
  absences().forEach(function (a) {
    var ts = C.minuit(a.d);
    if (ts >= debut && ts < fin) jourDe(ts).abs = a;
  });
  var heuresDu = function (x) {
    return x.jrn.reduce(function (s, j) { return s + C.heuresJournee(j); }, 0) +
      x.office.reduce(function (s, o) { return s + o.heures; }, 0);
  };
  var semaines = {}, totH = 0, totKm = 0;
  Object.keys(jours).forEach(function (k) {
    var x = jours[k], dd = new Date(x.ts);
    var lundi = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate() - (dd.getDay() + 6) % 7).getTime();
    (semaines[lundi] = semaines[lundi] || []).push(x);
    totH += heuresDu(x);
    x.jrn.forEach(function (j) { totKm += C.nb(j.km); });
  });
  var h1 = C.ditHeures;
  var lundis = Object.keys(semaines).map(Number).sort(function (a, b) { return b - a; });
  A.semOuvertes = A.semOuvertes || {};
  z.innerHTML = '<div class="carte"><div class="carte-titre"><h2>Ce mois-ci, jour par jour</h2>' +
    (totH || totKm ? '<span class="muted num histo-tot">' + h1(totH) +
      (totKm ? ' · ' + E.fmt(totKm, 0) + ' km' : '') + '</span>' : '') + '</div>' +
    (lundis.length ? lundis.map(function (lu, i) {
      var ks = semaines[lu].sort(function (a, b) { return b.ts - a.ts; });
      var sh = ks.reduce(function (s, x) { return s + heuresDu(x); }, 0);
      var ouverte = A.semOuvertes[lu] != null ? A.semOuvertes[lu] : i === 0;
      return '<details class="semaine" data-sem="' + lu + '"' + (ouverte ? ' open' : '') + '>' +
        '<summary><span>Semaine du ' + esc(jourCourt(lu)) + '</span>' +
        '<span class="num muted">' + (sh ? h1(sh) : '') + '</span>' + picto('chevron') + '</summary>' +
        ks.map(function (x) {
          var l = x.jrn.map(function (j) {
            var c = j.chantier ? chantier(j.chantier) : null;
            var dit = faitsDeJournee(j);
            if (C.nb(j.km)) dit.push(E.fmt(C.nb(j.km), 0) + ' km');
            if (C.nb(j.trajet)) dit.push('+ ' + C.ditHeures(j.trajet) + ' de trajet');
            if (j.fin) dit.push('chantier terminé');
            return '<button type="button" class="histo-l" data-histomj="' + esc(j.id) + '">' +
              '<span class="txt"><b>' + esc(jourCourt(x.ts, true) + ' · ' +
                (c ? C.nomChantier(c) : (j.lieu || 'sans chantier')) + ' · ' + h1(C.heuresJournee(j))) + '</b>' +
              (dit.length ? '<small>' + esc(dit.join(' · ')) + '</small>' : '') + '</span>' +
              picto('chevron') + '</button>';
          }).join('');
          l += x.office.map(function (o) {
            return '<button type="button" class="histo-l" data-histojour="' + x.ts + '" data-office="1">' +
              '<span class="txt"><b>' + esc(jourCourt(x.ts, true) + ' · ' + C.nomChantier(o.chantier) + ' · ' +
                h1(o.heures)) + '</b><small>' + (o.vu ? '' : '<span class="aj-o">○</span> ') +
              'comptée d’office</small></span>' + picto('chevron') + '</button>';
          }).join('');
          if (x.abs && !x.jrn.length && !x.office.length) {
            l += '<button type="button" class="histo-l" data-histojour="' + x.ts + '">' +
              '<span class="txt"><b>' + esc(jourCourt(x.ts, true) + ' · Non travaillé') + '</b>' +
              (x.abs.note ? '<small>' + esc(x.abs.note) + '</small>' : '') + '</span>' +
              picto('chevron') + '</button>';
          }
          return l;
        }).join('') + '</details>';
    }).join('') : '<div class="vide"><p>Rien de noté ce mois-ci.</p></div>') + '</div>';
}

/* Écran Entreprise : un chiffre parlant sur chaque tuile. */
