/* ============================================== CALENDRIER ET ALERTES */
var JOURS_COURTS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
var MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function renderBandeauPlanif() {
  var z = $('#cal-planif'); if (!z) return;
  var c = A.planifie ? chantier(A.planifie) : null;
  var lg = $('#cal-leg-sel'); if (lg) lg.hidden = !c;
  if (!c) { z.innerHTML = ''; return; }
  var placees = C.totalPlace(c), reste = C.resteAPlacer(c);
  z.innerHTML = '<div class="carte2" style="margin-bottom:11px;border-color:var(--encre)">' +
    '<b style="font-size:13.5px">Placement — ' + esc(C.nomChantier(c)) + '</b>' +
    '<div class="muted" style="font-size:12.5px;margin-top:2px">' +
    (reste == null
      ? placees + ' journée' + (placees > 1 ? 's' : '') + ' placée' + (placees > 1 ? 's' : '')
      : placees + ' / ' + Math.ceil(C.joursPrevus(c)) + ' journées placées' +
        (reste > 0 ? ' — encore ' + reste : (reste < 0 ? ' — ' + (-reste) + ' de trop' : ' — compte atteint'))) +
    '. Appuyez sur les jours voulus — ils passent en noir. Une seconde ' +
    'pression donne une demi-journée, une troisième retire le jour.</div>' +
    '<div class="btn-rang" style="margin-top:8px">' +
    '<button class="btn primaire btn-min" id="cal-planif-fin">Terminer</button></div></div>';
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

/* La fiche d'un jour : son statut, ce qui s'y rattache, et de quoi le
   changer. « Cliquer sur n'importe quel jour doit ouvrir une fiche jour. »
   Elle sert aussi à corriger après coup — prévu jeudi, fait mercredi : on
   ouvre mercredi et on y note ce qu'on a fait, jeudi redevient libre dès
   qu'on y retire le chantier. Pas de fonction séparée : c'est la même fiche. */
function ouvrirFicheJour(ts) {
  ts = C.minuit(ts);
  var o = occupationDu(ts);
  var st = C.statutJour(o, absences(), ts);
  var abs = C.estAbsent(absences(), ts);
  var passe = ts < C.minuit(Date.now());
  var d = new Date(ts);
  var titre = JOURS_COURTS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' +
    MOIS_NOMS[d.getMonth()] + ' ' + d.getFullYear();

  var bandeau = '<div class="fj-etat" style="border-color:' + C.coulStatutJour(st) + '">' +
    '<span class="pastille" style="background:' + C.coulStatutJour(st) + '"></span>' +
    '<div><b>' + esc(C.nomStatutJour(st)) + '</b>' +
    '<small>' + esc(trouveAide(st)) + '</small></div></div>';

  var corps = '';
  if (o.reels.length) {
    corps += '<p class="eyebrow" style="margin:14px 0 6px">Ce que vous y avez fait</p>' +
      o.reels.map(function (r) {
        return '<div class="liste-item"><div class="li-c"><b>' +
          esc(C.nomChantier(r.chantier)) + '</b><small>' +
          C.ditDuree(C.heuresSaisie(r.temps, A.cfg), A.cfg) +
          (C.nb(r.temps.personnes) > 1 ? ' × ' + C.nb(r.temps.personnes) + ' pers.' : '') +
          (r.temps.activite ? ' · ' + esc(C.nomTravail(r.temps.activite)) : '') + '</small></div>' +
          '<button class="btn-min" data-fjsup="' + r.chantier.id + '_' +
          (r.chantier.temps || []).indexOf(r.temps) + '">✕</button>' +
          '</div>';
      }).join('');
  }
  var faits = {};
  o.reels.forEach(function (r) { faits[r.chantier.id] = 1; });
  var enAttente = o.prevus.filter(function (p) { return !faits[p.chantier.id]; });
  if (enAttente.length) {
    corps += '<p class="eyebrow" style="margin:14px 0 6px">' +
      (o.reels.length ? 'Posé ce jour-là, sans temps noté' : 'Ce qui est posé ce jour-là') + '</p>' +
      enAttente.map(function (p) {
        return '<div class="liste-item"><span class="pastille" style="background:' +
          (p.fermete === 'ferme' ? '#2E7D46' : '#B98A00') + '"></span>' +
          '<div class="li-c"><b>' + esc(C.nomChantier(p.chantier)) + '</b><small>' +
          C.ditDuree(C.nb(p.part != null ? p.part : 1) * C.HEURES_JOUR(A.cfg), A.cfg) +
          ' prévues · ' +
          esc([p.chantier.donneur, C.nomStatut(p.chantier.statut, p.chantier)]
            .filter(Boolean).join(' · ')) + '</small></div>' +
          '<button class="btn-min" data-fjouvrir="' + p.chantier.id + '">Fiche</button> ' +
          '<button class="btn-min" data-fjretirer="' + p.chantier.id + '">Retirer</button></div>';
      }).join('');
  }
  var pr = prelevementsDuJour(ts);
  if (pr.length) {
    corps += '<p class="eyebrow" style="margin:14px 0 6px">Prélevé ce jour-là</p>' +
      pr.map(function (x) {
        return '<div class="liste-item"><div class="li-c"><b>' +
          esc(x.charge.libelle || 'Charge fixe') + '</b><small>' +
          esc([x.charge.beneficiaire, FIN.nomPeriodicite(x.charge.periodicite)]
            .filter(Boolean).join(' · ')) + '</small></div>' +
          '<span class="num">' + eur(C.nb(x.charge.ttc)) + '</span></div>';
      }).join('');
  }
  if (abs) {
    corps += '<p class="eyebrow" style="margin:14px 0 6px">Non travaillé</p>' +
      '<p style="font-size:13.5px;margin:0">' + esc(abs.note || 'Sans précision') + '</p>';
  }
  if (!o.reels.length && !o.prevus.length && !abs && !pr.length) {
    corps += '<p class="muted" style="font-size:13px;margin:14px 0 0">' +
      'Rien de posé ni de noté ce jour-là.</p>';
  }

  /* Ce qu'on peut en faire. « Travaillé » ne se coche pas : il se saisit —
     c'est la fiche « Ma journée » qui le crée, et c'est elle qui porte le
     chantier, les prestations et le temps. */
  /* Une journée posée, passée, dont rien n'est encore noté : c'est le cas
     courant, et il se règle d'un seul geste. */
  var validable = (passe || ts === C.minuit(Date.now())) && !o.reels.length && enAttente.length;
  var actions = (validable
    ? '<div class="btn-rang" style="margin-top:14px">' +
      '<button class="btn primaire plein" id="fj-prevu">C’était comme prévu — ' +
      C.ditDuree(heuresPrevues(enAttente), A.cfg) + '</button></div>'
    : '') +
    '<div class="btn-rang" style="margin-top:9px">' +
    (passe || ts === C.minuit(Date.now())
      ? '<button class="btn' + (validable ? '' : ' primaire') + ' btn-min" id="fj-travaille">' +
        (o.reels.length ? 'Modifier ma journée'
          : validable ? 'Autre chose' : 'J’y ai travaillé') + '</button>'
      : '') +
    '<button class="btn btn-min" id="fj-poser">Poser un chantier</button>' +
    (abs
      ? '<button class="btn btn-min" id="fj-libre">Ce n’est plus un jour off</button>'
      : '<button class="btn btn-min" id="fj-absent">Non travaillé</button>') +
    '</div>';

  modale(titre, bandeau + corps + actions +
    (abs || (!passe && ts !== C.minuit(Date.now()))
      ? ''
      : '<p class="muted" style="font-size:11.5px;margin:11px 0 0">Un jour passé finit ' +
        'toujours par « travaillé » ou « non travaillé » : sans ça il reste ' +
        'indéfiniment au planning.</p>'));

  var refaire = function (message) {
    fermerModale();
    renderCalendrier(); renderAccueil(); renderCarnet(); renderFiche();
    if (message) toast(message);
  };
  if ($('#fj-prevu')) {
    $('#fj-prevu').addEventListener('click', function () {
      validerCommePrevu(ts, enAttente).then(function () {
        refaire('Journée validée.');
      });
    });
  }
  if ($('#fj-travaille')) {
    $('#fj-travaille').addEventListener('click', function () {
      fermerModale();
      A.calJour = ts;
      var jd = journeeDuJour(ts);
      ouvrirJournee(jd ? jd.id : null, jd ? null : { date: ts });
    });
  }
  $('#fj-poser').addEventListener('click', function () {
    fermerModale();
    ouvrirPoserChantier(ts);
  });
  if ($('#fj-absent')) {
    $('#fj-absent').addEventListener('click', function () {
      fermerModale();
      ouvrirAbsence(ts);
    });
  }
  if ($('#fj-libre')) {
    $('#fj-libre').addEventListener('click', function () {
      retirerAbsence(ts).then(function () { refaire('Jour rendu au planning.'); });
    });
  }
  $('#modale-corps').addEventListener('click', function (e) {
    var ouv = e.target.closest('[data-fjouvrir]');
    if (ouv) { fermerModale(); ouvrirChantier(ouv.dataset.fjouvrir); return; }
    var ret = e.target.closest('[data-fjretirer]');
    if (ret) {
      var c = chantier(ret.dataset.fjretirer); if (!c) return;
      c.jours = (c.jours || []).filter(function (j) { return C.jourCle(j.d) !== C.jourCle(ts); });
      c.maj = Date.now();
      sauverChantiers().then(function () { refaire('Chantier retiré de ce jour.'); });
      return;
    }
    var sup = e.target.closest('[data-fjsup]');
    if (sup) {
      var p = sup.dataset.fjsup.split('_');
      var c2 = chantier(p[0]); if (!c2) return;
      var rang = Number(p[1]);
      var t2 = (c2.temps || [])[rang];
      if (!t2) return;
      if (!retirerSaisie(t2)) { toast('Cette saisie ne se retire pas d’ici.'); return; }
      indexerJournees();
      c2.maj = Date.now();
      Promise.all([sauverJournees(), sauverChantiers()]).then(function () {
        refaire('Temps retiré.');
      });
    }
  });
}
/* Les heures que l'agenda annonçait pour ce jour-là : une demi-journée posée
   vaut une demi-journée faite. */
function heuresPrevues(prevus) {
  var hj = C.HEURES_JOUR(A.cfg) || 8, h = 0;
  (prevus || []).forEach(function (p) {
    h += C.nb(p.part != null ? p.part : 1) * hj;
  });
  return C.arr(h, 2);
}
/* Valider une journée telle qu'elle était prévue : une journée par chantier
   posé, avec ses heures et les prestations du chantier en postes. Aucun
   formulaire — c'est tout l'objet. Les kilomètres habituels suivent, comme
   dans « Ma journée » : c'est la même route.
   Ce qui n'était pas prévu ne se valide pas d'un geste : il reste « Autre
   chose », qui ouvre la saisie complète. */
function poserJourneesPrevues(ts, prevus) {
  var hj = C.HEURES_JOUR(A.cfg) || 8;
  A.journees = A.journees || [];
  (prevus || []).forEach(function (p) {
    var c = p.chantier;
    var h = C.arr(C.nb(p.part != null ? p.part : 1) * hj, 2);
    if (!(h > 0)) return;
    /* Les prestations du chantier deviennent les postes, à parts égales :
       c'est ce qu'il aurait tapé, et il corrigera si ce n'était pas ça. */
    var vus = [];
    (c.lignes || []).forEach(function (l) {
      if (l.travail && vus.indexOf(l.travail) < 0 && !C.estFourniture(l.travail)) {
        vus.push(l.travail);
      }
    });
    var postes = vus.length
      ? vus.map(function (tv) {
        return { travaux: tv, heures: C.arr(h / vus.length, 2), quantite: 0 };
      })
      : [];
    A.journees.push({
      id: uid(), date: C.minuit(ts) + 12 * 3600000, chantier: c.id,
      lieu: c.foret || '', km: kmHabituels(c.id) || 0,
      nonProd: postes.length ? 0 : h, personnes: 1, sansMoi: false, fin: false,
      postes: postes
    });
  });
}
function validerCommePrevu(ts, prevus) {
  poserJourneesPrevues(ts, prevus);
  indexerJournees();
  return Promise.all([sauverJournees(), sauverChantiers()]);
}
/* Tout ce que la date a dépassé, d'un seul geste. « Toutes les journées
   posées au calendrier, il faudrait que ce soit compté comme fait — je
   considère que si j'y ai travaillé, et puis voilà. » Quarante-sept jours
   tranchés un par un, c'est quarante-sept fenêtres.

   Le bouton s'efface de lui-même : une fois pressé, il ne reste plus rien à
   trancher, donc l'écran qui le porte ne s'ouvre plus. */
function validerTousLesJoursPrevus() {
  var l = C.joursAResoudre(A.chantiers, A.cfg, absences(), Date.now());
  l.forEach(function (x) { poserJourneesPrevues(x.d, occupationDu(x.d).prevus); });
  indexerJournees();
  return Promise.all([sauverJournees(), sauverChantiers()]).then(function () {
    return l.length;
  });
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

/* « Pas de jour prévu qui reste indéfiniment dans le passé sans statut
   final. » Un jour posé que la date a dépassé pose une question à trois
   réponses, et il faut en choisir une. Le rappel de l'accueil ouvre ici.
   On ne ferme jamais la porte : le rappel se chasse d'un doigt, comme les
   deux autres — forcer sans échappatoire, c'est se faire ignorer. */
function ouvrirResolutionJour(ts) {
  ts = C.minuit(ts);
  var o = occupationDu(ts);
  var reste = C.joursAResoudre(A.chantiers, A.cfg, absences(), Date.now());
  var rang = 0;
  reste.forEach(function (x, i) { if (C.jourCle(x.d) === C.jourCle(ts)) rang = i; });
  var d = new Date(ts);
  var noms = o.prevus.map(function (p) { return C.nomChantier(p.chantier); });

  modale('Le ' + d.toLocaleDateString('fr-FR') + ' — que s’est-il passé ?',
    '<p class="sous-titre-bloc">Ce jour était <b>' +
    esc(C.nomStatutJour(C.statutJour(o, absences(), ts))) + '</b> pour ' +
    esc(noms.join(', ') || 'un chantier') + ', et il est passé. Tranchez : sinon il ' +
    'reste au planning pour toujours, et vos rendements se vident en silence.</p>' +
    '<div class="btn-rang" style="flex-direction:column;gap:8px">' +
    '<button class="btn primaire plein" id="rj-prevu">C’était comme prévu — ' +
    C.ditDuree(heuresPrevues(o.prevus), A.cfg) + '</button>' +
    '<button class="btn plein" id="rj-oui">J’y ai travaillé, mais autrement</button>' +
    '<button class="btn plein" id="rj-deplacer">C’était un autre jour</button>' +
    '<button class="btn plein" id="rj-non">Je n’y étais pas</button>' +
    '</div>' +
    (reste.length > 1
      ? '<p class="muted" style="font-size:11.5px;margin:12px 0 0">' +
        (reste.length - 1) + ' autre' + (reste.length > 2 ? 's' : '') + ' journée' +
        (reste.length > 2 ? 's' : '') + ' attend' + (reste.length > 2 ? 'ent' : '') +
        ' encore une réponse.</p>' +
        '<div class="btn-rang" style="margin-top:9px">' +
        '<button class="btn btn-min plein" id="rj-tout">Toutes comme prévu — ' +
        reste.length + ' journées</button></div>'
      : ''));

  /* Y avoir travaillé, c'est ouvrir « Ma journée » à cette date : elle porte
     le chantier, les prestations et le temps. */
  if ($('#rj-tout')) {
    $('#rj-tout').addEventListener('click', function () {
      /* On écrit quarante-sept journées d'un coup : le geste se confirme,
         et il dit ce qu'il va écrire. */
      if (!confirm('Enregistrer les ' + reste.length + ' journées passées telles ' +
        'qu’elles étaient prévues ?\n\nLes heures de l’agenda et les prestations de ' +
        'chaque chantier sont reprises. Chaque journée reste modifiable ensuite.')) return;
      validerTousLesJoursPrevus().then(function (n) {
        fermerModale();
        renderCalendrier(); renderAccueil(); renderCarnet(); renderFiche(); renderRendements();
        toast(n + ' journées enregistrées.');
      });
    });
  }
  $('#rj-prevu').addEventListener('click', function () {
    validerCommePrevu(ts, o.prevus).then(function () {
      fermerModale();
      renderCalendrier(); renderAccueil(); renderCarnet(); renderFiche(); renderRendements();
      toast('Journée validée.');
    });
  });
  $('#rj-oui').addEventListener('click', function () {
    fermerModale();
    A.calJour = ts;
    var jd = journeeDuJour(ts);
    ouvrirJournee(jd ? jd.id : null, jd ? null : {
      date: ts, chantier: (o.prevus[0] || {}).chantier ? o.prevus[0].chantier.id : ''
    });
  });
  /* Le déplacer : on retire le jour de son chantier et on le repose ailleurs.
     « Prévu jeudi mais chantier fait mercredi. » */
  $('#rj-deplacer').addEventListener('click', function () {
    fermerModale();
    ouvrirDeplacerJour(ts);
  });
  $('#rj-non').addEventListener('click', function () {
    fermerModale();
    ouvrirAbsence(ts);
  });
}

/* Déplacer ce qui était posé un jour vers un autre. Les chantiers du jour
   d'origine suivent en bloc : c'est le cas courant — une journée repoussée. */
function ouvrirDeplacerJour(ts) {
  ts = C.minuit(ts);
  var o = occupationDu(ts);
  var d = new Date(ts);
  modale('Déplacer la journée du ' + d.toLocaleDateString('fr-FR'),
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
      var part = 1;
      (c.jours || []).forEach(function (j) {
        if (C.jourCle(j.d) === C.jourCle(ts)) part = C.nb(j.p) || 1;
      });
      c.jours = (c.jours || []).filter(function (j) {
        return C.jourCle(j.d) !== C.jourCle(ts) && C.jourCle(j.d) !== C.jourCle(vers);
      });
      c.jours.push({ d: C.minuit(vers), p: part });
      c.jours.sort(function (a, b) { return a.d - b.d; });
      c.maj = Date.now();
    });
    sauverChantiers().then(function () {
      fermerModale(); renderCalendrier(); renderFiche(); renderCarnet(); renderAccueil();
      toast('Journée déplacée au ' + new Date(vers).toLocaleDateString('fr-FR') + '.');
    });
  });
}

function ouvrirAbsence(ts) {
  var abs = C.estAbsent(absences(), ts);
  var d = new Date(ts);
  modale('Jour non travaillé — ' + d.toLocaleDateString('fr-FR'),
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
      fermerModale(); renderCalendrier(); renderAccueil();
      toast('Jour marqué non travaillé.');
    });
  });
}

/* Poser un chantier sur un jour, depuis le calendrier. Le chemin inverse —
   depuis la fiche du chantier — existe déjà ; celui-ci manquait. */
function ouvrirPoserChantier(ts) {
  var d = new Date(ts);
  var libres = A.chantiers.filter(function (c) {
    return ['devis', 'envoye', 'accepte', 'encours'].indexOf(c.statut) >= 0;
  }).sort(function (a, b) { return C.dateChantier(b) - C.dateChantier(a); });
  if (!libres.length) { toast('Aucun chantier à poser.'); return; }
  modale('Poser un chantier — ' + d.toLocaleDateString('fr-FR'),
    '<div class="champ"><label class="eyebrow" for="pj-ch">Chantier</label>' +
    '<select id="pj-ch">' + libres.map(function (c) {
      return '<option value="' + c.id + '">' + esc(C.nomChantier(c)) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="pj-part">Combien de temps</label>' +
    '<select id="pj-part">' + partsPossibles(1) + '</select></div>' +
    '<div class="btn-rang">' +
    '<button class="btn primaire" id="pj-ok">Poser</button></div>');
  $('#pj-ok').addEventListener('click', function () {
    var c = chantier($('#pj-ch').value); if (!c) return;
    c.jours = (c.jours || []).filter(function (j) { return C.jourCle(j.d) !== C.jourCle(ts); });
    c.jours.push({ d: C.minuit(ts), p: C.nb($('#pj-part').value) || 1 });
    c.jours.sort(function (a, b) { return a.d - b.d; });
    c.maj = Date.now();
    sauverChantiers().then(function () {
      fermerModale(); renderCalendrier(); renderFiche(); renderCarnet(); renderAccueil();
      toast('Chantier posé sur ce jour.');
    });
  });
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
    [['ouverts', 'Chantiers ouverts'], ['encours', 'En cours'], ['accepte', 'À planifier'],
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
      'Sylve reprendra le client, le donneur d’ordre, le lieu et les travaux ; ' +
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
    paireFiche('Client', c.proprietaire || '—') +
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

/* « J'ai besoin de pouvoir dire : j'ai trois chantiers à planifier, sur tel
   chantier j'ai estimé deux jours, l'autre trois, l'autre un. Là je sais que
   j'ai douze jours à planifier, mais ces chantiers-là… » La bulle donnait le
   total ; la liste dit de quoi il est fait, et chaque ligne ouvre le
   placement. Un chantier engagé sans estimation y figure aussi : c'est
   justement celui qu'on oublie. */
function chantiersAPlanifier() {
  return (A.chantiers || []).filter(function (c) {
    return ['devis', 'envoye', 'accepte', 'encours'].indexOf(c.statut) >= 0;
  }).map(function (c) {
    return { c: c, reste: C.resteAPlacer(c) };
  }).filter(function (x) {
    return x.reste == null ? x.c.statut === 'accepte' || x.c.statut === 'encours' : x.reste > 0;
  }).sort(function (a, b) {
    /* Ce qui est engagé d'abord : un devis sans réponse peut attendre. */
    var ea = C.statutEngage(a.c.statut) ? 0 : 1, eb = C.statutEngage(b.c.statut) ? 0 : 1;
    return ea - eb || (b.reste || 0) - (a.reste || 0);
  });
}
function renderAPlanifier() {
  var z = $('#cal-aplanifier'); if (!z) return;
  /* Pendant un placement, le bandeau du chantier en cours prend la place. */
  var l = A.planifie ? [] : chantiersAPlanifier();
  if (!l.length) { z.innerHTML = ''; return; }
  var total = l.reduce(function (s, x) { return s + (x.reste || 0); }, 0);
  z.innerHTML = '<div class="carte2" style="margin-bottom:11px">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">' +
    '<b style="font-size:13.5px">À planifier</b>' +
    '<span class="muted num" style="font-size:12.5px;white-space:nowrap">' +
    (total ? esc(C.fmtJours(total)) + ' sur ' : '') + l.length + ' chantier' +
    (l.length > 1 ? 's' : '') + '</span></div>' +
    l.map(function (x) {
      var engage = C.statutEngage(x.c.statut);
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0 0">' +
        '<span style="flex:1;min-width:0"><span style="display:block;font-size:13.5px">' +
        esc(C.nomChantier(x.c)) + '</span>' +
        '<small class="muted">' + (engage ? '' : 'devis en attente · ') +
        (x.reste == null ? 'à estimer' : esc(C.fmtJours(x.reste)) + ' à placer') + '</small></span>' +
        (x.reste == null
          ? '<button class="btn btn-min" data-aestimer="' + x.c.id + '">Estimer</button>'
          : '<button class="btn btn-min" data-aplacer="' + x.c.id + '">Placer</button>') +
        '</div>';
    }).join('') + '</div>';
}
function renderCalendrier() {
  var g = $('#cal-grille'); if (!g) return;
  renderBandeauPlanif();
  renderAPlanifier();
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
  var sel = A.calJour ? C.minuit(A.calJour) : null;

  var h = '<div class="cal">' + JOURS_COURTS.map(function (j) { return '<div class="jn">' + j + '</div>'; }).join('');
  for (var i = 0; i < decalage; i++) h += '<button class="vide" disabled></button>';
  for (var d = 1; d <= dernier.getDate(); d++) {
    var ts = new Date(an, mo, d).getTime();
    var k = C.jourCle(ts), o = occ[k] || { prevus: [], reels: [] };
    /* Un jour, un statut, une pastille. La case en empilait jusqu'à trois. */
    var st = C.statutJour(o, absences(), ts);
    var pts = st === 'libre' ? ''
      : '<i style="background:' + C.coulStatutJour(st) + '"></i>';
    var cls = ['jour', 'st-' + st];
    if (ts === ajd) cls.push('auj');
    var demi = false;
    if (A.planifie) {
      var cp = chantier(A.planifie);
      var part = cp ? C.partDuJour(cp, ts) : 0;
      if (part > 0) { cls.push('sel'); if (part < 1) demi = true; }
    } else if (sel === ts) cls.push('sel');
    if (C.estWeekend(ts)) cls.push('we');
    /* Le repère du prélèvement ne remplace pas la pastille du statut : il se
       pose dans l'angle, et il annonce son montant au survol. */
    var pr = prel[k] || [];
    var somme = pr.reduce(function (t2, x) { return t2 + C.nb(x.charge.ttc); }, 0);
    h += '<button class="' + cls.join(' ') + '" data-jour="' + ts + '">' +
      (pr.length ? '<span class="cal-prel" title="' +
        esc(pr.map(function (x) { return x.charge.libelle || 'charge fixe'; }).join(', ')) +
        (somme ? ' — ' + eur(C.arr(somme, 2)) : '') + '">€</span>' : '') +
      '<span class="n">' + d + (demi ? '<sup style="font-size:8px">½</sup>' : '') + '</span>' +
      '<span class="pts">' + pts + '</span></button>';
  }
  h += '</div>';
  g.innerHTML = h;

  renderResteATrancher();
  var cm = C.chargeMois(A.chantiers, an, mo, A.cfg);
  $('#cal-charge').innerHTML = '<div class="kpi" style="margin-top:11px">' +
    '<div class="carte2"><b class="num">' + cm.fermes + '</b><small>jours confirmés</small></div>' +
    '<div class="carte2"><b class="num">' + cm.provisoires + '</b><small>jours provisoires</small></div>' +
    '<div class="carte2"><b class="num">' + E.fmt(cm.joursReels, 1) + '</b><small>jours-homme faits</small></div>' +
    (function () {
      var n = (absences() || []).filter(function (a) {
        var da = new Date(a.d);
        return da.getFullYear() === an && da.getMonth() === mo;
      }).length;
      return n ? '<div class="carte2"><b class="num">' + n +
        '</b><small>jour' + (n > 1 ? 's' : '') + ' non travaillé' + (n > 1 ? 's' : '') +
        '</small></div>' : '';
    })() +
    '</div>';
  renderJourDetail();
}

/* Les jours passés restés au planning, annoncés en tête de l'agenda. Le
   rappel de l'accueil ne suffisait pas : c'est ici qu'il travaille, et un
   jour non tranché ne se voit nulle part sur la grille — sa pastille dit
   « confirmé » comme un jour à venir. */
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
function renderResteATrancher() {
  var z = $('#cal-trancher'); if (!z) return;
  var l = C.joursAResoudre(A.chantiers, A.cfg, absences(), Date.now());
  if (!l.length) { z.innerHTML = ''; return; }
  var p = l[0];
  var nom = ((p.chantiers[0] || {}).nom) || 'chantier';
  z.innerHTML = '<button class="alerte" id="cal-trancher-btn" style="width:100%">' +
    '<span class="ic" style="background:#B98A00"></span>' +
    '<span><b>' + (l.length === 1
      ? 'Le ' + dateCourte(p.d) + ' reste à trancher'
      : l.length + ' journées passées restent à trancher') + '</b>' +
    '<small>' + esc(nom) + (l.length > 1 ? ', et ' + (l.length - 1) + ' autre' +
      (l.length > 2 ? 's' : '') : '') + ' — y avez-vous travaillé ?</small></span></button>';
}
function renderJourDetail() {
  var z = $('#cal-detail'); if (!z) return;
  var ts = C.minuit(A.calJour || Date.now());
  var d = new Date(ts);
  $('#cal-jour-titre').textContent = JOURS_COURTS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + MOIS_NOMS[d.getMonth()];
  var occ = C.occupation(A.chantiers, ts, ts, A.cfg)[C.jourCle(ts)] || { prevus: [], reels: [] };

  var h = '';
  if (occ.prevus.length) {
    h += '<p class="eyebrow" style="margin:0 0 6px">Prévu</p>' + occ.prevus.map(function (p) {
      return '<div class="liste-item"><span class="pastille" style="background:' +
        (p.fermete === 'ferme' ? '#2E7D46' : '#B98A00') + '"></span>' +
        '<div class="li-c"><b>' + esc(C.nomChantier(p.chantier)) + '</b><small>' +
        esc([p.chantier.donneur || p.chantier.client, C.nomStatut(p.chantier.statut, p.chantier)].filter(Boolean).join(' · ')) +
        (p.part != null && p.part < 1 ? ' · demi-journée' : '') +
        (p.fermete === 'provisoire' ? ' — provisoire' : '') + '</small></div>' +
        '<button class="btn-min" data-caljour-ouvrir="' + p.chantier.id + '">Ouvrir</button></div>';
    }).join('');
  }
  if (occ.reels.length) {
    h += '<p class="eyebrow" style="margin:12px 0 6px">Fait</p>' + occ.reels.map(function (r) {
      return '<div class="liste-item"><span class="pastille" style="background:#1D6FB8"></span>' +
        '<div class="li-c"><b>' + esc(C.nomChantier(r.chantier)) + ' — ' + E.fmt(r.jours, 2) + ' j-h</b>' +
        '<small>' + E.fmt(C.nb(r.temps.duree), 1) + (r.temps.unite === 'h' ? ' h' : ' j') +
        (C.nb(r.temps.personnes) > 1 ? ' × ' + C.nb(r.temps.personnes) + ' pers.' : '') +
        (r.temps.activite ? ' · ' + esc(C.nomTravail(r.temps.activite)) : '') + '</small></div>' +
        '<button class="btn-min" data-caljour-sup="' + r.chantier.id + '_' + r.temps.date + '">✕</button></div>';
    }).join('');
  }
  z.innerHTML = h || '<div class="vide"><p>Rien de prévu ni de saisi ce jour-là.</p></div>';
}

/* ------------------------------------------------------------- alertes */
var COUL_ALERTE = { impaye: '#B4231F', retard: '#C4611B', afacturer: '#B98A00',
  devis: '#7A8471', aprevoir: '#1F5FA9', aplacer: '#2E4A3C', encours: '#7A8471',
  approche: '#2E7D46' };
var TITRE_ALERTE = { impaye: 'Facture impayée', retard: 'Journées passées',
  afacturer: 'À facturer', devis: 'Devis sans réponse',
  aprevoir: 'À prévoir', aplacer: 'Journées à placer', encours: 'En cours',
  approche: 'Chantier prévu' };

/* Écran Entreprise : un chiffre parlant sur chaque tuile. */
