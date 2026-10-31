/* ================================================== MA JOURNÉE
   Le soir, en rentrant. Ce qu'on a fait, où, combien de temps, et pour
   quelle quantité. C'est la seule saisie qui doit tenir en trente secondes,
   sinon elle ne se fait pas — et sans elle rien ne se calcule.
   ====================================================================== */

function sauverJournees() { return ecrire('bordcub.journees', A.journees); }
function journee(id) {
  return (A.journees || []).filter(function (j) { return j.id === id; })[0] || null;
}

/* Les temps déjà saisis dans les fiches chantier deviennent des journées :
   une par chantier et par date, chaque activité formant un poste. */
function migrerJournees() {
  if (A.cfg && A.cfg.journeesMigrees) return false;
  var vues = {};
  (A.chantiers || []).forEach(function (c) {
    (c.temps || []).forEach(function (t) {
      if (t.jrn) return;
      var k = c.id + '|' + B.jour(t.date);
      if (!vues[k]) {
        vues[k] = { id: uid(), date: t.date, chantier: c.id, lieu: c.foret || '',
          km: 0, nonProd: 0, personnes: C.nb(t.personnes) || 1,
          sansMoi: !!t.sansMoi, fin: false, postes: [] };
        A.journees.push(vues[k]);
      }
      var j = vues[k];
      j.km += C.nb(t.km);
      var h = t.unite === 'h' ? C.nb(t.duree) : C.nb(t.duree) * C.HEURES_JOUR(A.cfg);
      if (t.activite) j.postes.push({ travaux: t.activite, heures: C.arr(h, 2), quantite: 0 });
      else j.nonProd = C.arr(j.nonProd + h, 2);
    });
  });
  A.cfg = A.cfg || {};
  A.cfg.journeesMigrees = true;
  sauverCfg();
  if (A.journees.length) sauverJournees();
  return true;
}

/* Le temps porté par chaque chantier n'est qu'une lecture des journées :
   tout le calcul de rendement et de prix de journée continue de marcher
   sans savoir d'où le temps vient. */
/* Retirer une saisie de temps, c'est retirer le poste de journée qui la
   produit — et la journée elle-même s'il n'en reste rien. Filtrer c.temps
   ne faisait rien de durable : la liste est refaite à l'indexation. */
function retirerSaisie(t) {
  if (!t || !t.jrn) return false;
  var j = journee(t.jrn); if (!j) return false;
  if (t.activite) {
    var ote = false;
    j.postes = (j.postes || []).filter(function (p) {
      if (ote || p.travaux !== t.activite || C.arr(C.nb(p.heures), 2) !== C.arr(C.nb(t.duree), 2)) return true;
      ote = true; return false;
    });
    if (!ote) return false;
  } else {
    /* Le hors production et le trajet entrent ensemble dans le chantier,
       en une seule saisie sans activité : la retirer retire les deux. */
    j.nonProd = 0;
    j.trajet = 0;
  }
  /* Une journée sans poste ni temps mort ne dit plus rien : elle s'en va. */
  if (!(j.postes || []).length && !C.nb(j.nonProd) && !C.nb(j.trajet)) {
    A.journees = (A.journees || []).filter(function (x) { return x.id !== j.id; });
  }
  return true;
}
function indexerJournees() {
  (A.chantiers || []).forEach(function (c) { c.temps = []; });
  (A.journees || []).forEach(function (j) {
    if (!j.chantier) return;
    var c = chantier(j.chantier); if (!c) return;
    var pers = C.nb(j.personnes) || 1;
    /* Une journée non facturée nourrit le rendement mais jamais le prix de
       journée : elle entre comme si quelqu'un d'autre l'avait faite. */
    var hors = !!j.nonFacture;
    var premier = true;
    (j.postes || []).forEach(function (p) {
      if (C.nb(p.heures) <= 0) return;
      c.temps.push({ date: j.date, duree: C.nb(p.heures), unite: 'h', personnes: pers,
        sansMoi: (j.sansMoi || hors) || undefined, nonFacture: hors || undefined,
        km: premier ? (C.nb(j.km) || undefined) : undefined,
        activite: p.travaux || null, quantite: C.nb(p.quantite) || undefined, jrn: j.id });
      premier = false;
    });
    /* Le trajet et le hors production comptent dans la journée facturée mais
       jamais dans le rendement : ils entrent sans activité. */
    var sansActivite = C.arr(C.nb(j.nonProd) + C.nb(j.trajet), 2);
    if (sansActivite > 0) {
      c.temps.push({ date: j.date, duree: sansActivite, unite: 'h', personnes: pers,
        sansMoi: (j.sansMoi || hors) || undefined, nonFacture: hors || undefined,
        km: premier ? (C.nb(j.km) || undefined) : undefined,
        activite: null, jrn: j.id });
    }
  });
}
function majJournees() {
  indexerJournees();
  renderFiche(); renderCarnet(); renderCalendrier(); renderRendements();
  renderAccueil(); renderFinances();
}

/* Les lieux déjà fréquentés, pour ne pas les retaper. */
function lieuxConnus() {
  var v = {}, l = [];
  (A.journees || []).forEach(function (j) {
    if (j.lieu) v[j.lieu] = 1;
    if (j.commune) v[j.commune] = 1;
  });
  (A.chantiers || []).forEach(function (c) {
    if (c.foret) v[c.foret] = 1;
    if (c.commune) v[c.commune] = 1;
  });
  (A.lieuxRegles || []).forEach(function (x) { if (x) v[x] = 1; });
  for (var k in v) l.push(k);
  return l.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
}
function derniereJournee() {
  return (A.journees || []).slice().sort(function (a, b) {
    return (b.date || 0) - (a.date || 0);
  })[0] || null;
}

/* ------------------------------------------------------------- l'écran */
var pst = [];

/* Le sélecteur des postes d'une journée passe par la même fonction que celui
   d'une ligne de chantier : il en existait deux du même nom, et la seconde
   écrasait la première en silence. */
function renderPostes() {
  var z = $('#mj-postes'); if (!z) return;
  z.innerHTML = pst.map(function (p, i) {
    var u = p.travaux ? C.courtUnite(C.uniteDe(p.travaux)) : '';
    return '<div class="carte2" style="margin-bottom:7px;padding:9px 10px">' +
      '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
      '<select data-pstt="' + i + '" style="flex:1">' +
      optionsTravaux(p.travaux, { vide: true, sansFournitures: true }) + '</select>' +
      (pst.length > 1 ? '<button type="button" class="btn-min" data-pstsup="' + i + '">✕</button>' : '') +
      '</div><div class="grille g2">' +
      '<div class="champ" style="margin:0"><label class="eyebrow">Heures productives</label>' +
      '<input type="text" data-psth="' + i + '" class="gros" inputmode="decimal" value="' + esc(p.heures) + '"></div>' +
      '<div class="champ" style="margin:0"><label class="eyebrow">Fait' + (u ? ' (' + esc(u) + ')' : '') + '</label>' +
      '<input type="text" data-pstq="' + i + '" class="gros" inputmode="decimal" value="' + esc(p.quantite) + '"></div>' +
      '</div></div>';
  }).join('') + '<button type="button" class="btn-min" id="pst-plus">+ une prestation</button>';
}
function lirePostes() {
  $$('#mj-postes [data-pstt]').forEach(function (i) { pst[+i.dataset.pstt].travaux = i.value; });
  $$('#mj-postes [data-psth]').forEach(function (i) { pst[+i.dataset.psth].heures = i.value; });
  $$('#mj-postes [data-pstq]').forEach(function (i) { pst[+i.dataset.pstq].quantite = i.value; });
}

function ouvrirJournee(id, modele) {
  var j = id ? journee(id) : null;
  if (id && !j) return;
  var src = j || modele || null;
  pst = (src && src.postes && src.postes.length)
    ? src.postes.map(function (p) {
        return { travaux: p.travaux, heures: j ? String(p.heures) : '', quantite: j ? String(p.quantite || '') : '' };
      })
    : [{ travaux: '', heures: '', quantite: '' }];

  /* Les chantiers qui peuvent encore recevoir une journée, du plus récemment
     travaillé au plus ancien. Un chantier facturé n'en reçoit plus — sauf
     celui qu'on est en train de corriger, sinon son propre chantier
     disparaîtrait du sélecteur. */
  var vise = src && src.chantier;
  var leJour = (src && src.date) || Date.now();
  var poseCeJour = {};
  A.chantiers.forEach(function (c) {
    (c.jours || []).forEach(function (x) {
      if (C.jourCle(x.d) === C.jourCle(leJour)) poseCeJour[c.id] = 1;
    });
  });
  var chs = A.chantiers.filter(function (c) {
    return c.id === vise || poseCeJour[c.id] ||
      ['devis', 'envoye', 'accepte', 'encours', 'termine'].indexOf(c.statut) >= 0;
  }).sort(function (a, b) { return C.dateChantier(b) - C.dateChantier(a); });
  var dj = derniereJournee();
  modale(id ? 'Modifier la journée' : 'Ma journée',
    (!id && dj ? '<button class="btn btn-min" id="mj-hier" style="margin-bottom:11px">' +
      'Comme le ' + esc(dateCourte(dj.date)) +
      (dj.lieu ? ' — ' + esc(dj.lieu) : '') + '</button>' : '') +
    /* La case « Journée non facturée » a disparu : « ça ne sert plus à
       rien », dit deux fois. Une journée déjà marquée garde sa marque. */
    '<div class="champ"><label class="eyebrow" for="mj-date">Date</label>' +
    '<input type="date" id="mj-date" value="' +
    jourIso((j && j.date) || (modele && modele.date)) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="mj-ch">Chantier</label>' +
    '<select id="mj-ch"><option value="">— aucun, journée libre —</option>' +
    chs.map(function (c) {
      return '<option value="' + c.id + '"' +
        (src && src.chantier === c.id ? ' selected' : '') + '>' + esc(C.nomChantier(c)) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="mj-lieu">Forêt</label>' +
    '<input type="text" id="mj-lieu" list="lieux-connus" autocomplete="off" value="' +
    esc((src && src.lieu) || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="mj-commune">Commune</label>' +
    '<input type="text" id="mj-commune" list="lieux-connus" autocomplete="off" value="' +
    esc((src && src.commune) || '') + '"></div>' +
    '</div>' +
    /* « Il faudrait juste le temps total, et le temps productif. Et après, si
       je peux rajouter le temps de trajet. » Le productif, ce sont les heures
       des prestations — elles font les rendements. Le hors production s'en
       déduit (affûtage, réglage, panne) et ne se tape plus. Le trajet reste
       à part : il ne se passe pas sur le chantier. */
    '<div class="champ" style="margin-top:6px"><label class="eyebrow" for="mj-total">' +
    'Temps total sur le chantier</label>' +
    '<input type="text" id="mj-total" class="gros" inputmode="decimal" ' +
    'placeholder="heures, trajet non compris" value="' +
    (j && C.arr(C.heuresPostes(j) + C.nb(j.nonProd), 2) > 0
      ? C.arr(C.heuresPostes(j) + C.nb(j.nonProd), 2) : '') + '"></div>' +
    '<label class="eyebrow" style="margin-top:6px;display:block">Ce que j’ai fait</label>' +
    '<div id="mj-postes"></div>' +
    '<p class="muted" id="mj-horsprod" style="font-size:12px;margin:6px 0 0"></p>' +
    '<div class="grille g3" style="margin-top:11px">' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-trajet">Trajet (h)</label>' +
    '<input type="text" id="mj-trajet" inputmode="decimal" value="' +
    (j && C.nb(j.trajet) ? j.trajet : '') + '"></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-km">Kilomètres</label>' +
    '<input type="text" id="mj-km" inputmode="decimal" value="' +
    (src && C.nb(src.km) ? src.km : '') + '"></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-pers">Personnes</label>' +
    '<input type="text" id="mj-pers" inputmode="numeric" value="' +
    ((src && C.nb(src.personnes)) || 1) + '"></div>' +
    '</div>' +
    '<div class="carte2" id="mj-apercu" style="margin:11px 0"></div>' +
    '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;font-size:13.5px">' +
    '<input type="checkbox" id="mj-fin"' + (j && j.fin ? ' checked' : '') + '> ' +
    'Ce chantier est terminé</label>' +
    '<div class="champ" style="margin-top:9px"><label class="eyebrow" for="mj-note">Note</label>' +
    '<textarea id="mj-note" rows="2">' + esc((j && j.note) || '') + '</textarea></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="mj-ok">Enregistrer</button>' +
    (id ? '<button class="btn danger btn-min" id="mj-sup">Supprimer</button>' : '') + '</div>');

  var apercu = function () {
    var z = $('#mj-apercu'); if (!z) return;
    var prod = C.arr(pst.reduce(function (s, p) { return s + C.nb(p.heures); }, 0), 2);
    var total = C.nb($('#mj-total').value), trajet = C.nb($('#mj-trajet').value);
    var np = total > prod ? C.arr(total - prod, 2) : 0;
    var hp = $('#mj-horsprod');
    if (hp) {
      hp.textContent = total && total < prod
        ? 'Le temps total est plus court que les heures productives.'
        : np ? E.fmt(prod, 2) + ' h productives, ' + E.fmt(np, 2) +
          ' h hors production — affûtage, réglage, panne.' : '';
    }
    var tot = Math.max(total, prod) + trajet;
    if (tot <= 0) { z.innerHTML = '<span class="muted">Indiquez vos heures.</span>'; return; }
    var pers = C.nb($('#mj-pers').value) || 1;
    var jrs = tot / C.HEURES_JOUR(A.cfg);
    var ch = $('#mj-ch').value ? chantier($('#mj-ch').value) : null;
    var nf = !!(j && j.nonFacture);
    var pj = ch ? C.prixJourVise(ch, A.cfg) : C.nb(A.cfg && A.cfg.prixJourVise);
    z.innerHTML = '<b class="num" style="font-size:19px">' + E.fmt(tot, 2) + ' h</b>' +
      ' — ' + E.fmt(jrs, 2) + ' journée' + (jrs > 1 ? 's' : '') +
      (nf ? ' <span class="retard">non facturée</span>' : '') +
      '<div class="muted" style="font-size:12.5px;margin-top:3px">' +
      E.fmt(prod, 2) + ' h productives' + (np ? ' · ' + E.fmt(np, 2) + ' h hors production' : '') +
      (trajet ? ' · ' + E.fmt(trajet, 2) + ' h de trajet' : '') +
      (pers > 1 ? ' · ' + pers + ' personnes' : '') +
      (nf ? ' · compte pour le rendement seulement'
          : pj ? ' · ' + eur(C.arr(jrs * pj, 2)) + ' à ' + eur(pj) + '/j' : '') + '</div>' +
      pst.filter(function (p) { return p.travaux && C.nb(p.quantite) > 0 && C.nb(p.heures) > 0; })
        .map(function (p) {
          var u = C.courtUnite(C.uniteDe(p.travaux));
          var parJ = C.nb(p.quantite) / (C.nb(p.heures) / C.HEURES_JOUR(A.cfg)) * pers;
          return '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:4px">' +
            '<span>' + esc(C.nomTravail(p.travaux)) + '</span><b class="num">' +
            E.fmt(parJ, parJ >= 100 ? 0 : 1) + ' ' + esc(u) + '/jour</b></div>';
        }).join('');
  };
  renderPostes(); apercu();
  $('#mj-postes').addEventListener('input', function () { lirePostes(); apercu(); });
  $('#mj-postes').addEventListener('change', function () { lirePostes(); renderPostes(); apercu(); });
  $('#mj-postes').addEventListener('click', function (e) {
    var plus = e.target.closest('#pst-plus'), sup = e.target.closest('[data-pstsup]');
    if (plus) { lirePostes(); pst.push({ travaux: '', heures: '', quantite: '' }); }
    else if (sup) { lirePostes(); pst.splice(+sup.dataset.pstsup, 1); }
    else return;
    renderPostes(); apercu();
  });
  ['#mj-total', '#mj-trajet', '#mj-pers'].forEach(function (x) { $(x).addEventListener('input', apercu); });
  $('#mj-ch').addEventListener('change', function () {
    var c = $('#mj-ch').value ? chantier($('#mj-ch').value) : null;
    if (!c) { apercu(); return; }
    /* On ne remplit que ce qui est vide : ce qu'il a déjà tapé est à lui.
       Le champ s'appelait « lieu » et le chantier porte « foret » : la
       reprise ne marchait donc jamais. */
    if (c.foret && !$('#mj-lieu').value) $('#mj-lieu').value = c.foret;
    if (c.commune && !$('#mj-commune').value) $('#mj-commune').value = c.commune;
    /* Les kilomètres du dernier trajet vers ce chantier : c'est la même
       route. Estimer une distance entre deux communes demanderait un calcul
       d'itinéraire, que l'application ne fait pas — mais elle a sa propre
       mémoire. */
    if (!$('#mj-km').value) {
      var km = kmHabituels(c.id);
      if (km) $('#mj-km').value = km;
    }
    /* Les prestations du chantier ouvrent les postes, sans heures : il ne
       remplit plus que ce qu'il a fait. */
    lirePostes();
    var vides = pst.every(function (p) { return !p.travaux && !C.nb(p.heures); });
    if (vides) {
      var vus = [];
      (c.lignes || []).forEach(function (l) {
        if (l.travail && vus.indexOf(l.travail) < 0 && !C.estFourniture(l.travail)) {
          vus.push(l.travail);
        }
      });
      if (vus.length) {
        pst = vus.map(function (tv) { return { travaux: tv, heures: '', quantite: '' }; });
        renderPostes();
      }
    }
    apercu();
  });
  if ($('#mj-hier')) $('#mj-hier').addEventListener('click', function () {
    /* Le jour reste celui qu'on a choisi : reprendre sert à ne pas retaper
       le chantier et les prestations, pas à revenir en arrière. */
    var jour = versDate($('#mj-date').value) || (modele && modele.date) || Date.now();
    fermerModale();
    ouvrirJournee(null, Object.assign({}, dj, { date: jour }));
  });

  $('#mj-ok').addEventListener('click', function () {
    lirePostes();
    var postes = pst.filter(function (p) { return p.travaux && C.nb(p.heures) > 0; })
      .map(function (p) {
        return { travaux: p.travaux, heures: C.nb(p.heures), quantite: C.nb(p.quantite) || 0 };
      });
    var prod = C.arr(postes.reduce(function (s, p) { return s + p.heures; }, 0), 2);
    var total = C.nb($('#mj-total').value), trajet = C.nb($('#mj-trajet').value);
    /* Un total plus court que le productif ne peut pas être juste : l'un des
       deux est mal tapé, et deviner lequel fausserait les rendements. */
    if (total && total < prod) {
      toast('Le temps total est plus court que les heures productives.'); return;
    }
    var np = total > prod ? C.arr(total - prod, 2) : 0;
    if (!postes.length && np <= 0 && trajet <= 0) {
      toast('Indiquez au moins une prestation ou un temps.'); return;
    }
    var maj = {
      date: versDate($('#mj-date').value) || Date.now(),
      chantier: $('#mj-ch').value || null, lieu: $('#mj-lieu').value.trim(),
      commune: $('#mj-commune').value.trim(),
      nonFacture: !!(j && j.nonFacture),
      km: C.nb($('#mj-km').value) || 0, nonProd: np, trajet: trajet || 0,
      personnes: C.nb($('#mj-pers').value) || 1,
      fin: !!$('#mj-fin').checked, note: $('#mj-note').value.trim(),
      postes: postes, maj: Date.now()
    };
    A.journees = A.journees || [];
    if (j) Object.keys(maj).forEach(function (k) { j[k] = maj[k]; });
    else { maj.id = uid(); A.journees.push(maj); }
    var ch = maj.chantier ? chantier(maj.chantier) : null;
    /* La case « terminé » fait avancer le chantier : c'est le seul endroit
       où on le sait vraiment, le soir même. */
    if (ch && maj.fin && ch.statut !== 'facture' && ch.statut !== 'paye') {
      ch.statut = 'termine'; ch.maj = Date.now();
    }
    indexerJournees();
    sauverJournees().then(function () { return ch ? sauverChantiers() : null; }).then(function () {
      fermerModale(); majJournees();
      toast(maj.fin ? 'Journée enregistrée, chantier terminé.' : 'Journée enregistrée.');
    });
  });
  if (id) $('#mj-sup').addEventListener('click', function () {
    if (!confirm('Supprimer cette journée ?\n\nIl restera récupérable ' +
      B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
    A.journees = A.journees.filter(function (x) { return x.id !== id; });
    jeterObjet('journee', j, dateCourte(j.date) + (j.lieu ? ' — ' + j.lieu : ''),
      E.fmt(C.heuresJournee(j), 1) + ' h')
      .then(sauverJournees).then(function () {
        fermerModale(); majJournees(); toast('Journée mise à la corbeille.');
      });
  });
}

/* Le raccourci de l'accueil : la saisie du soir doit être à un pouce. */
/* « C'est pénible d'aller chercher les kilomètres. Est-ce qu'il n'y aurait
   pas un moyen de mettre deux communes et que ça les estime ? » Pas sans une
   carte, et l'application n'en a aucune : elle tourne hors ligne, sans
   dépendance. Mais elle a mieux — sa propre mémoire. C'est la même route à
   chaque fois : on propose ce qui a été noté la dernière fois pour ce
   chantier-là. Le plus récent fait foi, et il reste libre de corriger. */
function kmHabituels(idChantier) {
  var vu = 0, quand = 0;
  (A.journees || []).forEach(function (j) {
    if (j.chantier !== idChantier || !C.nb(j.km)) return;
    if (C.nb(j.date) >= quand) { quand = C.nb(j.date); vu = C.nb(j.km); }
  });
  if (vu) return vu;
  /* À défaut, le temps saisi sur la fiche du chantier porte parfois ses
     kilomètres : c'est la même route. */
  var c = chantier(idChantier);
  ((c && c.temps) || []).forEach(function (t) {
    if (!C.nb(t.km)) return;
    if (C.nb(t.date) >= quand) { quand = C.nb(t.date); vu = C.nb(t.km); }
  });
  return vu;
}
function renderMaJournee() {
  var z = $('#a-journee'); if (!z) return;
  var auj = B.jour(Date.now());
  var faite = (A.journees || []).some(function (j) { return B.jour(j.date) === auj; });
  var sem = (A.journees || []).filter(function (j) {
    return (j.date || 0) > Date.now() - 7 * 86400000;
  });
  var h = sem.reduce(function (s, j) { return s + C.heuresJournee(j); }, 0);
  z.innerHTML = '<button class="btn primaire" id="a-jour" style="width:100%;margin-top:10px;' +
    'display:flex;align-items:center;justify-content:center;gap:9px;padding:13px">' +
    '<span style="font-size:16px">☀</span><span>Enregistrer ma journée</span>' +
    '</button><p class="muted" style="font-size:12px;margin:6px 0 0;text-align:center">' +
    (faite ? 'Déjà saisie aujourd’hui' : 'Rien de saisi aujourd’hui') +
    (sem.length ? ' · ' + E.fmt(h, 1) + ' h sur 7 jours' : '') + '</p>';
}

