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
  /* Les journées d'office (lot r1) entrent ici, sans activité : elles
     comptent dans le temps passé et le prix par journée, jamais dans un
     rendement. Elles ne viennent d'aucune journée — rien à retirer, rien à
     sauvegarder — et disparaissent dès qu'une vraie journée les remplace. */
  journeesDOffice().forEach(function (o) {
    o.chantier.temps.push({ date: C.minuit(o.d) + 12 * 3600000, duree: o.heures, unite: 'h',
      personnes: 1, activite: null, office: true, vu: o.vu || undefined });
  });
  A.indexeLe = C.jourCle(Date.now());
}
/* Le jour change pendant que l'application reste ouverte : la journée
   d'office d'hier ne compte qu'une fois l'index refait. */
function indexAJour() {
  if (A.indexeLe !== C.jourCle(Date.now())) indexerJournees();
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
   écrasait la première en silence.
   Ce HTML ne se refait QUE quand une ligne s'ajoute ou s'en va : refait
   pendant la frappe, il remplaçait le champ sous le doigt et le clavier se
   refermait (forme retenue du tour 1). */
function renderPostes() {
  var z = $('#mj-postes'); if (!z) return;
  z.innerHTML = pst.map(function (p, i) {
    return '<div class="mj-poste">' +
      '<div class="mj-poste-haut">' +
      '<select data-pstt="' + i + '" aria-label="Prestation ' + (i + 1) + '">' +
      optionsTravaux(p.travaux, { vide: true, sansFournitures: true }) + '</select>' +
      (pst.length > 1 ? '<button type="button" class="btn-min" data-pstsup="' + i + '" ' +
        'aria-label="Retirer cette prestation">✕</button>' : '') +
      '</div><div class="grille g2">' +
      '<div class="champ" style="margin:0"><label class="eyebrow" for="pst-h-' + i + '">Heures productives</label>' +
      '<input type="text" id="pst-h-' + i + '" data-psth="' + i + '" class="gros" inputmode="decimal" autocomplete="off" value="' + esc(p.heures) + '"></div>' +
      '<div class="champ" style="margin:0"><label class="eyebrow" for="pst-q-' + i + '" id="pst-ql-' + i + '">' +
      libelleFait(p.travaux) + '</label>' +
      '<input type="text" id="pst-q-' + i + '" data-pstq="' + i + '" class="gros" inputmode="decimal" autocomplete="off" value="' + esc(p.quantite) + '"></div>' +
      '</div><small class="mj-rdt" id="pst-r-' + i + '"></small></div>';
  }).join('') + '<button type="button" class="btn-min" id="pst-plus">+ une prestation</button>';
}
function libelleFait(travaux) {
  var u = travaux ? C.courtUnite(C.uniteDe(travaux)) : '';
  return 'Fait' + (u ? ' (' + esc(u) + ')' : '');
}
function lirePostes() {
  $$('#mj-postes [data-pstt]').forEach(function (i) { pst[+i.dataset.pstt].travaux = i.value; });
  $$('#mj-postes [data-psth]').forEach(function (i) { pst[+i.dataset.psth].heures = i.value; });
  $$('#mj-postes [data-pstq]').forEach(function (i) { pst[+i.dataset.pstq].quantite = i.value; });
}
function postesVides() {
  return pst.every(function (p) { return !p.travaux && !C.nb(p.heures) && !C.nb(p.quantite); });
}
/* Les prestations d'un chantier, une fois chacune, sans les fournitures :
   elles ouvrent les postes, sans heures. */
function prestationsDe(c) {
  var vus = [];
  ((c && c.lignes) || []).forEach(function (l) {
    if (l.travail && vus.indexOf(l.travail) < 0 && !C.estFourniture(l.travail)) vus.push(l.travail);
  });
  return vus;
}
/* Les chantiers posés ce jour-là (P4). */
function posesLe(ts) {
  return (A.chantiers || []).filter(function (c) {
    return c.statut !== 'sansuite' && C.partDuJour(c, ts) > 0;
  });
}
/* Les chantiers qui peuvent recevoir une journée ce jour-là : ceux qui sont
   ouverts, celui qu'on corrige, et ceux qui sont posés ce jour-là — même
   facturés, c'est l'agenda qui dit qu'ils ont lieu d'y être. Les posés en
   tête, puis du plus récent au plus ancien. */
function chantiersPourJournee(ts, vise) {
  var poses = {};
  posesLe(ts).forEach(function (c) { poses[c.id] = 1; });
  return A.chantiers.filter(function (c) {
    return c.id === vise || poses[c.id] ||
      ['devis', 'envoye', 'accepte', 'encours', 'termine'].indexOf(c.statut) >= 0;
  }).sort(function (a, b) {
    return (poses[b.id] ? 1 : 0) - (poses[a.id] ? 1 : 0) || C.dateChantier(b) - C.dateChantier(a);
  });
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
  var leJour = C.minuit((src && src.date) || Date.now());
  /* Ce que le formulaire a rempli de lui-même : on peut le reprendre quand le
     jour change, jamais ce qu'il a tapé. Un chantier venu de la porte (« Comme
     le… ») compte comme choisi : la date ne le change plus. */
  var etat = { manuel: !!(j || (modele && modele.chantier)), auto: {}, autoPostes: false, aide: '' };
  var dj = derniereJournee();
  var cDj = dj && dj.chantier ? chantier(dj.chantier) : null;

  modale(id ? 'Modifier la journée' : 'Ma journée',
    (!id && dj ? '<button type="button" class="mj-copie" id="mj-hier">' +
      '<b>Comme le ' + esc(jourCourt(dj.date)) +
      (dj.lieu || cDj ? ' — ' + esc(dj.lieu || C.nomChantier(cDj)) : '') + '</b>' +
      '<small>copie le chantier, le lieu, les km et les prestations ; ni la date ni les heures</small></button>' : '') +
    '<p class="fj-sous">Quand, où</p><div class="mj-zone">' +
    '<div class="champ"><label class="eyebrow" for="mj-date">Date</label>' +
    '<input type="date" id="mj-date" value="' + jourIso(leJour) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="mj-ch">Chantier</label>' +
    '<select id="mj-ch"></select><small class="mj-aide" id="mj-chaide"></small></div>' +
    '<div class="grille g2">' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-lieu">Forêt</label>' +
    '<input type="text" id="mj-lieu" list="lieux-connus" autocomplete="off" value="' +
    esc((src && src.lieu) || '') + '"></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-commune">Commune</label>' +
    '<input type="text" id="mj-commune" list="lieux-connus" autocomplete="off" value="' +
    esc((src && src.commune) || '') + '"></div>' +
    '</div></div>' +
    /* « Il faudrait juste le temps total, et le temps productif. Et après, si
       je peux rajouter le temps de trajet. » Le productif, ce sont les heures
       des prestations — elles font les rendements. Le hors production s'en
       déduit (affûtage, réglage, panne) et ne se tape plus. Le trajet reste
       à part : il ne se passe pas sur le chantier. */
    '<p class="fj-sous">Mon temps</p><div class="mj-zone">' +
    '<div class="champ"><label class="eyebrow" for="mj-total">Temps total sur le chantier</label>' +
    '<input type="text" id="mj-total" class="gros" inputmode="decimal" autocomplete="off" ' +
    'placeholder="heures, trajet non compris" value="' +
    (j && C.arr(C.heuresPostes(j) + C.nb(j.nonProd), 2) > 0
      ? C.arr(C.heuresPostes(j) + C.nb(j.nonProd), 2)
      /* « Préciser ma journée » (lot r1) : la durée comptée d'office. */
      : !j && modele && C.nb(modele.total) > 0 ? C.nb(modele.total) : '') + '"></div>' +
    '<p class="eyebrow" style="margin:0 0 6px">Ce que j’ai fait</p>' +
    '<div id="mj-postes"></div>' +
    '<p class="muted" id="mj-horsprod" style="font-size:12px;margin:6px 0 0"></p></div>' +
    '<p class="fj-sous">Trajet</p><div class="mj-zone">' +
    '<div class="grille g3">' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-trajet">Trajet (h)</label>' +
    '<input type="text" id="mj-trajet" inputmode="decimal" autocomplete="off" value="' +
    (j && C.nb(j.trajet) ? j.trajet : '') + '"></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-km">Kilomètres</label>' +
    '<input type="text" id="mj-km" inputmode="decimal" autocomplete="off" value="' +
    (src && C.nb(src.km) ? src.km : '') + '"></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-pers">Personnes</label>' +
    '<input type="text" id="mj-pers" inputmode="numeric" autocomplete="off" value="' +
    ((src && C.nb(src.personnes)) || 1) + '"></div>' +
    '</div><small class="mj-aide" id="mj-kmaide"></small></div>' +
    '<label class="mj-case" for="mj-fin"><input type="checkbox" id="mj-fin"' + (j && j.fin ? ' checked' : '') + '>' +
    '<span><b>Ce chantier est terminé</b><small>il passe à « à facturer »</small></span></label>' +
    '<div class="champ" style="margin-top:11px"><label class="eyebrow" for="mj-note">Note</label>' +
    '<textarea id="mj-note" rows="2">' + esc((j && j.note) || '') + '</textarea></div>' +
    /* Le pied reste en vue pendant qu'on remplit : le total, et Enregistrer. */
    '<div class="mj-pied"><div id="mj-apercu"></div>' +
    '<div class="btn-rang" style="margin:0">' +
    (id ? '<button class="btn danger btn-min" id="mj-sup">Supprimer</button>' : '') +
    '<button class="btn primaire plein" id="mj-ok">Enregistrer</button></div></div>');

  var dateDe = function () { return versDate($('#mj-date').value) || leJour; };
  var listerChantiers = function () {
    var ts = dateDe(), sel = $('#mj-ch').value || (src && src.chantier) || '';
    var chs = chantiersPourJournee(ts, sel);
    $('#mj-ch').innerHTML = '<option value="">— aucun, journée libre —</option>' +
      chs.map(function (c) {
        return '<option value="' + c.id + '"' + (sel === c.id ? ' selected' : '') + '>' +
          esc(C.nomChantier(c)) + '</option>';
      }).join('');
  };
  var aides = function () {
    $('#mj-chaide').textContent = etat.aide;
    $('#mj-kmaide').textContent = etat.auto.km != null && $('#mj-km').value === etat.auto.km
      ? 'Les kilomètres de la dernière fois sur ce chantier : c’est la même route.' : '';
  };
  /* Choisir un chantier remplit ce qu'il sait — seulement les champs vides,
     jamais par-dessus ce qui est tapé. « auto » retient ce qui a été rempli
     ainsi, pour pouvoir le reprendre si le jour change. */
  var remplir = function (c, auto) {
    var poser = function (champ, cle, v) {
      if (!v || $(champ).value) return;
      $(champ).value = v;
      if (auto) etat.auto[cle] = String(v);
    };
    /* Le champ s'appelait « lieu » et le chantier porte « foret » : la
       reprise ne marchait donc jamais. */
    poser('#mj-lieu', 'lieu', c.foret);
    poser('#mj-commune', 'commune', c.commune);
    /* Les kilomètres du dernier trajet vers ce chantier : c'est la même
       route. Estimer une distance entre deux communes demanderait un calcul
       d'itinéraire, que l'application ne fait pas — mais elle a sa propre
       mémoire. */
    var km = kmHabituels(c.id);
    if (km && !$('#mj-km').value) { $('#mj-km').value = km; etat.auto.km = String(km); }
    lirePostes();
    var vus = prestationsDe(c);
    if (vus.length && postesVides()) {
      pst = vus.map(function (tv) { return { travaux: tv, heures: '', quantite: '' }; });
      etat.autoPostes = !!auto;
      renderPostes();
    }
  };
  /* Reprendre ce que le formulaire avait rempli de lui-même, s'il n'y a pas
     touché depuis. */
  var oublierAuto = function () {
    [['#mj-lieu', 'lieu'], ['#mj-commune', 'commune'], ['#mj-km', 'km']].forEach(function (x) {
      if (etat.auto[x[1]] != null && $(x[0]).value === etat.auto[x[1]]) $(x[0]).value = '';
    });
    etat.auto = {};
    lirePostes();
    if (etat.autoPostes && pst.every(function (p) { return !C.nb(p.heures) && !C.nb(p.quantite); })) {
      pst = [{ travaux: '', heures: '', quantite: '' }];
      renderPostes();
    }
    etat.autoPostes = false;
  };
  /* P4 : un chantier posé ce jour-là est pré-choisi — un seul ; à plusieurs,
     aucun, et ils passent en tête de la liste. Revu à chaque changement de
     date tant qu'il n'a pas choisi lui-même. Jamais en modification. */
  var preChoisir = function () {
    listerChantiers();
    if (etat.manuel) { etat.aide = ''; aides(); return; }
    var poses = posesLe(dateDe());
    if ($('#mj-ch').value) oublierAuto();
    if (poses.length === 1) {
      $('#mj-ch').value = poses[0].id;
      remplir(poses[0], true);
      etat.aide = 'Posé ce jour-là : choisi d’office.';
    } else {
      $('#mj-ch').value = '';
      etat.aide = poses.length > 1 ? 'Plusieurs chantiers sont posés ce jour-là : ils sont en tête de la liste.' : '';
    }
    aides();
  };

  /* Ce qui se recalcule pendant la frappe : l'aperçu du pied, la ligne hors
     production, le rendement sous chaque prestation. Aucun champ n'est
     refait. */
  var apercu = function () {
    var z = $('#mj-apercu'); if (!z) return;
    var hj = C.HEURES_JOUR(A.cfg) || 8;
    var prod = C.arr(pst.reduce(function (s, p) { return s + C.nb(p.heures); }, 0), 2);
    var total = C.nb($('#mj-total').value), trajet = C.nb($('#mj-trajet').value);
    var np = total > prod ? C.arr(total - prod, 2) : 0;
    var pers = C.nb($('#mj-pers').value) || 1;
    var hp = $('#mj-horsprod');
    if (hp) {
      hp.textContent = total && total < prod
        ? 'Le temps total est plus court que les heures productives.'
        : np ? E.fmt(prod, 2) + ' h productives, ' + E.fmt(np, 2) +
          ' h hors production — affûtage, réglage, panne.' : '';
      hp.classList.toggle('mj-erreur', !!(total && total < prod));
    }
    pst.forEach(function (p, i) {
      var r = $('#pst-r-' + i); if (!r) return;
      var ok = p.travaux && C.nb(p.quantite) > 0 && C.nb(p.heures) > 0;
      if (!ok) { r.textContent = ''; return; }
      var parJ = C.nb(p.quantite) / (C.nb(p.heures) / hj) * pers;
      r.textContent = '≈ ' + E.fmt(parJ, parJ >= 100 ? 0 : 1) + ' ' +
        C.courtUnite(C.uniteDe(p.travaux)) + '/jour';
    });
    var tot = Math.max(total, prod) + trajet;
    if (tot <= 0) { z.innerHTML = '<span class="muted">Indiquez vos heures.</span>'; return; }
    var jrs = tot / hj;
    var ch = $('#mj-ch').value ? chantier($('#mj-ch').value) : null;
    var nf = !!(j && j.nonFacture);
    var pj = ch ? C.prixJourVise(ch, A.cfg) : C.nb(A.cfg && A.cfg.prixJourVise);
    z.innerHTML = '<div class="mj-tot"><b class="num">' + E.fmt(tot, 2) + ' h</b>' +
      '<span>' + E.fmt(jrs, 2) + ' journée' + (jrs > 1 ? 's' : '') + '</span>' +
      (nf ? '<span class="retard">non facturée</span>'
        : pj ? '<b class="num mj-montant">' + eur(C.arr(jrs * pj, 2)) + '</b>' : '') + '</div>' +
      '<small class="muted">' +
      E.fmt(prod, 2) + ' h productives' + (np ? ' · ' + E.fmt(np, 2) + ' h hors production' : '') +
      (trajet ? ' · ' + E.fmt(trajet, 2) + ' h de trajet' : '') +
      (pers > 1 ? ' · ' + pers + ' personnes' : '') +
      (nf ? ' · compte pour le rendement seulement' : pj ? ' · à ' + eur(pj) + '/j' : '') + '</small>';
  };
  renderPostes(); preChoisir(); apercu();

  $('#mj-postes').addEventListener('input', function () { lirePostes(); apercu(); });
  /* Changer de prestation change l'unité de la quantité : seule l'étiquette
     bouge. Le « change » d'un champ texte, à sa sortie, ne refait plus rien. */
  $('#mj-postes').addEventListener('change', function (e) {
    lirePostes();
    var s = e.target.closest('[data-pstt]');
    if (s && $('#pst-ql-' + s.dataset.pstt)) $('#pst-ql-' + s.dataset.pstt).innerHTML = libelleFait(s.value);
    apercu();
  });
  $('#mj-postes').addEventListener('click', function (e) {
    var plus = e.target.closest('#pst-plus'), sup = e.target.closest('[data-pstsup]');
    if (plus) { lirePostes(); pst.push({ travaux: '', heures: '', quantite: '' }); }
    else if (sup) { lirePostes(); pst.splice(+sup.dataset.pstsup, 1); }
    else return;
    renderPostes(); apercu();
  });
  ['#mj-total', '#mj-trajet', '#mj-pers'].forEach(function (x) { $(x).addEventListener('input', apercu); });
  $('#mj-km').addEventListener('input', aides);
  $('#mj-date').addEventListener('change', function () { preChoisir(); apercu(); });
  $('#mj-ch').addEventListener('change', function () {
    /* Choisi à la main : la date ne le change plus. Ce que le pré-choix avait
       rempli et qu'il n'a pas touché laisse la place au chantier choisi. */
    if (!etat.manuel) oublierAuto();
    etat.manuel = true; etat.aide = ''; etat.auto = {};
    var c = $('#mj-ch').value ? chantier($('#mj-ch').value) : null;
    if (c) remplir(c, false);
    aides(); apercu();
  });
  if ($('#mj-hier')) $('#mj-hier').addEventListener('click', function () {
    /* Le jour reste celui qu'on a choisi : reprendre sert à ne pas retaper
       le chantier et les prestations, pas à revenir en arrière. */
    var jour = dateDe();
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
      toast('Le temps total est plus court que les heures productives : corrigez l’un des deux.'); return;
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
      B.JOURS_POUBELLE + ' jours dans ' + B.CHEMIN_CORBEILLE + '.')) return;
    A.journees = A.journees.filter(function (x) { return x.id !== id; });
    jeterObjet('journee', j, dateCourte(j.date) + (j.lieu ? ' — ' + j.lieu : ''),
      E.fmt(C.heuresJournee(j), 1) + ' h')
      .then(sauverJournees).then(function () {
        fermerModale(); majJournees(); toast('Journée mise à la corbeille.');
      });
  });
}

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

