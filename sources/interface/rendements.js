/* ---------------------------------------------------------- estimatif */
function critLibelle(cr) {
  if (!cr) return '';
  var p = [];
  if (cr.essence) p.push(C.nomEssenceCh(cr.essence));
  if (cr.densite) p.push(E.fmt(cr.densite, 0) + '/ha');
  if (cr.hauteur) p.push(E.fmt(cr.hauteur, 1) + ' m');
  if (cr.difficulte) p.push('végét. ' + C.nomNiveau(cr.difficulte).toLowerCase());
  if (cr.terrain) p.push('terrain ' + C.nomNiveau(cr.terrain).toLowerCase());
  return p.join(' · ');
}
function renderEstimer() {
  var z = $('#estim-form'); if (!z) return;
  var e = A.estim || (A.estim = { travail: 'DEGAG', quantite: '', rendement: null, repere: null });
  var d = C.distributionRendement(A.chantiers, e.travail, A.cfg);
  var u = d.n ? C.courtUnite(d.unite) : '';
  var dec = function (v) { return E.fmt(v, v < 10 ? 2 : 0); };

  var reperes = '';
  if (d.n) {
    var choix = [['bas', 'Le plus bas', d.min], ['med', 'Médian', d.med], ['haut', 'Le plus haut', d.max]];
    reperes =
      '<p class="eyebrow" style="margin:14px 0 6px">Vos rendements sur ' +
      esc(C.nomTravail(e.travail).toLowerCase()) + ' <span class="muted" ' +
      'style="font-weight:400;text-transform:none;letter-spacing:0">(' + d.n + ' chantier' +
      (d.n > 1 ? 's' : '') + ')</span></p>' +
      '<div class="chips" id="es-reperes">' + choix.map(function (x) {
        return '<button type="button" class="chip" data-esrend="' + x[2] + '" data-esrepere="' + x[0] +
          '" aria-pressed="' + (e.repere === x[0]) + '">' + x[1] + ' · ' + dec(x[2]) + ' ' + u + '/j</button>';
      }).join('') + '</div>' +
      '<p class="muted" style="font-size:12px;margin:7px 0 0">Situez-vous d’après ce que vous savez ' +
      'du terrain. Sylve ne devine pas à votre place : il vous montre ce que vous avez déjà fait.</p>';
  }

  z.innerHTML =
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="es-trav">Travaux</label>' +
    '<select id="es-trav">' + C.TRAVAUX.filter(function (t) {
      return !t.retire || t.c === e.travail;
    }).map(function (t) {
      return '<option value="' + t.c + '"' + (e.travail === t.c ? ' selected' : '') + '>' + esc(t.n) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="es-qte">Quantité (' +
    esc(C.nomUnite(C.uniteDe(e.travail), 2)) + ')</label>' +
    '<input type="text" id="es-qte" class="gros" inputmode="decimal" autocomplete="off" value="' +
    esc(e.quantite == null ? '' : String(e.quantite).replace('.', ',')) + '"></div>' +
    '</div>' +
    reperes +
    '<div class="champ" style="margin-top:11px;max-width:260px">' +
    '<label class="eyebrow" for="es-rend">Rendement retenu' + (u ? ' (' + u + ' / jour-homme)' : '') + '</label>' +
    '<input type="text" id="es-rend" class="gros" inputmode="decimal" autocomplete="off" placeholder="' +
    (d.n ? dec(d.med) : 'aucune référence') + '" value="' +
    (e.rendement ? esc(String(e.rendement).replace('.', ',')) : '') + '"></div>' +
    '<div class="btn-rang" style="margin-top:12px"><button class="btn primaire" id="es-go">Estimer</button></div>';
}
function lireEstim() {
  var e = A.estim;
  var avant = e.travail;
  e.travail = $('#es-trav').value;
  e.quantite = C.nb($('#es-qte').value);
  var saisi = $('#es-rend') ? C.nb($('#es-rend').value) : 0;
  /* une valeur tapée à la main l'emporte sur le repère cliqué */
  if (saisi > 0 && saisi !== C.nb(e.rendement)) { e.rendement = saisi; e.repere = null; }
  else if (!saisi && !e.repere) e.rendement = null;
  if (e.travail !== avant) { e.rendement = null; e.repere = null; }
  return e;
}
function relancerEstimation() {
  var e = A.estim;
  e.resultat = C.estime(A.chantiers,
    { travail: e.travail, quantite: e.quantite, rendement: e.rendement }, A.cfg);
  renderEstimResultat();
}
function renderEstimResultat() {
  var z = $('#estim-resultat'); if (!z) return;
  var e = A.estim;
  if (!e || !e.resultat) { z.innerHTML = ''; return; }
  var r = e.resultat;
  if (!r.rendement) {
    z.innerHTML = '<div class="carte"><div class="vide"><p>Aucun chantier de référence pour « ' +
      esc(C.nomTravail(e.travail)) + ' ». Saisissez vos anciens chantiers (travaux, quantités, temps passé) ' +
      'pour que l’estimation ait une base.</p></div></div>';
    return;
  }
  var u = C.courtUnite(r.unite);
  var refs = r.refs.slice(0, 5).map(function (x) {
    return '<div class="liste-item"><span class="pastille" style="background:' +
      (COUL_STATUT[x.chantier.statut] || '#7A8471') + '"></span>' +
      '<div class="li-c"><b>' + esc(C.nomChantier(x.chantier)) + '</b>' +
      '<small>' + E.fmt(x.rendement, x.rendement < 10 ? 2 : 0) + ' ' + u + '/j · ' +
      E.fmt(x.quantite, 0) + ' ' + u + ' en ' + E.fmt(x.jours, 1) + ' j' +
      (x.prixJour ? ' · ' + eur(x.prixJour) + '/j' : '') +
      (x.date ? ' · ' + dateCourte(x.date) : '') +
      (x.note ? '<br>' + esc(x.note) : '') +
      '</small></div>' +
      (x.difficulte
        ? '<span class="pt-dist" title="' + esc(nomDiff5(x.difficulte)) + '">' + x.difficulte + '/5</span>'
        : '') + '</div>';
  }).join('');
  z.innerHTML =
    '<div class="carte">' +
    '<h2>Estimation</h2>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + E.fmt(r.rendement, r.rendement < 10 ? 2 : 0) + '</b><small>' + u + ' / jour-homme</small></div>' +
    (r.jours ? '<div class="carte2"><b class="num">' + E.fmt(r.jours, 1) + '</b><small>journées estimées' +
      (r.joursFourchette ? ' (' + E.fmt(r.joursFourchette.min, 1) + '–' + E.fmt(r.joursFourchette.max, 1) + ')' : '') + '</small></div>' : '') +
    (r.montant ? '<div class="carte2"><b class="num">' + eur(r.montant) + '</b><small>conseillé à ' + eur(r.prixJourRetenu) + '/j</small></div>' : '') +
    '</div>' +
    (r.prixJourRefs && r.prixJourRetenu !== r.prixJourRefs
      ? '<p class="muted" style="font-size:12px;margin:9px 0 0">Vos chantiers de référence ont rapporté ' + eur(r.prixJourRefs) + '/jour en moyenne.</p>' : '') +
    (r.jours ? '<div class="btn-rang" style="margin-top:12px"><button class="btn primaire" id="es-devis">Créer le devis</button></div>' : '') +
    '</div>' +
    '<div class="carte"><h2>Ce que vous avez déjà fait (' + r.refs.length + ')</h2>' +
    '<p class="muted" style="font-size:12px;margin:0 0 8px">Du plus récent au plus ancien, ' +
    'avec la difficulté que vous aviez notée.</p>' +
    refs + '</div>';
}

/* ---------------------------------------------------------- rendements */
var TRIS_REND = [
  { c: 'alpha', n: 'Par ordre alphabétique' },
  { c: 'recent', n: 'Du plus récent au plus ancien' },
  { c: 'ancien', n: 'Du plus ancien au plus récent' },
  { c: 'chantiers', n: 'Du plus de chantiers au moins' }
];
function renderTriRendements() {
  var s = $('#rend-tri'); if (!s) return;
  var v = A.triRend || 'alpha';
  s.innerHTML = TRIS_REND.map(function (o) {
    return '<option value="' + o.c + '"' + (v === o.c ? ' selected' : '') + '>' +
      esc(o.n) + '</option>';
  }).join('');
}
function renderRendements() {
  var z = $('#rend-corps'); if (!z) return;
  renderTriRendements();
  var lignes = [];
  C.TRAVAUX.forEach(function (t) {
    var refs = C.references(A.chantiers, t.c, A.cfg);
    /* L'unité qui fait foi est celle des chantiers ; à défaut, celle de la
       première cadence notée. */
    var toutes = C.cadences(A.cfg, t.c);
    var uRef = refs.length ? C.courtUnite(refs[0].unite)
      : (toutes[0] ? toutes[0].unite : '');
    var cpt = C.cadenceComptee(A.cfg, t.c, uRef);
    /* Une prestation qu'il a chronométrée mais jamais facturée mérite sa
       ligne : c'est justement là que le compté est tout ce qu'on a. */
    if (!refs.length && cpt == null) return;
    if (!refs.length) {
      var u0 = uRef;
      lignes.push({ code: t.c, nom: t.n, n: 0, date: 0,
        titre: esc(t.n) + ' — ' + E.fmt(cpt, cpt < 10 ? 2 : 0) + ' ' + u0 + '/j comptés',
        sous: 'Rien de mesuré encore : aucun chantier n’a de quantité et de temps ' +
          'sur cette prestation.', estimer: false });
      return;
    }
    var u = C.courtUnite(refs[0].unite);
    var rends = refs.map(function (r) { return r.rendement; });
    var moy = C.arr(rends.reduce(function (s, x) { return s + x; }, 0) / rends.length, 3);
    var pjs = refs.filter(function (r) { return r.prixJour; });
    var pjMoy = pjs.length ? C.arr(pjs.reduce(function (s, r) { return s + r.prixJour; }, 0) / pjs.length, 2) : null;
    lignes.push({ code: t.c, nom: t.n, n: refs.length,
      date: Math.max.apply(null, refs.map(function (r) { return r.date || 0; })),
      estimer: true,
      titre: esc(t.n) + ' — ' + E.fmt(moy, moy < 10 ? 2 : 0) + ' ' + u + '/j',
      sous: refs.length + ' chantier' + (refs.length > 1 ? 's' : '') +
      ' · de ' + E.fmt(Math.min.apply(null, rends), 2) + ' à ' + E.fmt(Math.max.apply(null, rends), 2) + ' ' + u + '/j' +
      (pjMoy ? ' · ' + eur(pjMoy) + '/jour obtenu' : '') +
      /* L'écart est l'information : le mesuré porte les aléas — la pluie, la
         route, le matériel — que le chronomètre ne voit pas. */
      (cpt != null ? '<br><b class="compte">' + E.fmt(cpt, cpt < 10 ? 2 : 0) + ' ' + u +
        '/j comptés</b> · ' + ecartCadence(moy, cpt) : '') });
  });

  /* Le tri qu'il a choisi. « Estimer » n'a de sens que sur une prestation
     mesurée : sans chantier derrière, il n'y a rien à estimer — mais le
     bouton garde sa place, sinon les lignes ne s'alignent plus. */
  var tri = A.triRend || 'alpha';
  lignes.sort(function (a, b) {
    if (tri === 'recent') return (b.date - a.date) || a.nom.localeCompare(b.nom, 'fr');
    if (tri === 'ancien') return (a.date - b.date) || a.nom.localeCompare(b.nom, 'fr');
    if (tri === 'chantiers') return (b.n - a.n) || a.nom.localeCompare(b.nom, 'fr');
    return a.nom.localeCompare(b.nom, 'fr');
  });
  var blocs = lignes.map(function (x) {
    return '<div class="liste-item pile-c"><div class="li-h">' +
      '<div class="li-c"><b>' + x.titre + '</b><small>' + x.sous + '</small></div></div>' +
      '<div class="li-actions">' +
      '<button class="btn-min" data-rdetail="' + x.code + '">Détail</button>' +
      (x.estimer
        ? '<button class="btn-min" data-restim="' + x.code + '">Estimer</button>'
        : '<button class="btn-min" disabled>Estimer</button>') +
      '</div></div>';
  });
  z.innerHTML = blocs.length ? blocs.join('')
    : '<div class="vide"><p>Aucun rendement calculable. Il faut des chantiers avec des quantités ' +
      'ET du temps saisi — sur les chantiers mêlant plusieurs travaux, marquez l’activité dans chaque saisie de temps.</p></div>';
}
/* « Trente pour cent plus lent que compté. » Un pourcentage sec ne dit pas
   dans quel sens il va ; la phrase, si. */
function ecartCadence(mesure, compte) {
  if (!(compte > 0) || !(mesure > 0)) return '';
  var p = Math.round(Math.abs(mesure - compte) / compte * 100);
  if (p < 5) return 'le terrain vous donne raison';
  return p + ' % ' + (mesure < compte ? 'plus lent' : 'plus vite') + ' sur le terrain';
}
function ouvrirDetailRendement(travail) {
  var refs = C.references(A.chantiers, travail, A.cfg);
  var toutes = C.cadences(A.cfg, travail);
  if (!refs.length && !toutes.length) return;
  var u = refs.length ? C.courtUnite(refs[0].unite)
    : (toutes[0] ? toutes[0].unite : C.courtUnite(C.uniteDe(travail)));
  var cds = C.cadences(A.cfg, travail, u);
  modale('Rendements — ' + C.nomTravail(travail),
    '<p class="eyebrow" style="margin:0 0 6px">Ce que vous avez compté</p>' +
    (cds.length ? cds.map(function (c) {
      var ch = c.chantier ? chantier(c.chantier) : null;
      return '<div class="liste-item"><div class="li-c"><b>' +
        E.fmt(C.cadenceParJour(c, A.cfg), 2) + ' ' + u + '/j</b><small>' +
        esc(ditCadence(c, u)) +
        (ch ? ' · ' + esc(C.nomChantier(ch)) : ' · sans chantier') +
        (c.note ? '<br>' + esc(c.note) : '') + '</small></div>' +
        '<button class="btn-min" data-cdsup="' + c.id + '">✕</button></div>';
    }).join('') : '<p class="muted" style="font-size:12.5px;margin:0">Rien de compté ' +
      'pour cette prestation.</p>') +
    '<div class="btn-rang" style="margin:9px 0 15px">' +
    '<button class="btn btn-min" id="cd-plus">+ Noter une cadence</button></div>' +
    '<p class="eyebrow" style="margin:0 0 6px">Ce que les chantiers ont mesuré</p>' +
    (refs.length ? '' : '<p class="muted" style="font-size:12.5px;margin:0">Aucun ' +
      'chantier n’a encore de quantité et de temps sur cette prestation.</p>') +
    refs.sort(function (a, b) { return b.rendement - a.rendement; }).map(function (r) {
      return '<div class="liste-item"><div class="li-c"><b>' + esc(C.nomChantier(r.chantier)) + '</b>' +
        '<small>' + E.fmt(r.rendement, 2) + ' ' + u + '/j · ' + E.fmt(r.quantite, 0) + ' ' + u +
        ' en ' + E.fmt(r.jours, 1) + ' j' + (r.prixJour ? ' · ' + eur(r.prixJour) + '/j' : '') +
        (r.difficulte ? ' · difficulté ' + r.difficulte + '/5' : '') +
        (r.note ? '<br>' + esc(r.note) : '') +
        (critLibelle(r.chantier.criteres) ? '<br>' + esc(critLibelle(r.chantier.criteres)) : '') + '</small></div></div>';
    }).join(''));
  $('#cd-plus').addEventListener('click', function () { ouvrirCadence(travail, u); });
  $('#modale-corps').addEventListener('click', function (e) {
    var x = e.target.closest('[data-cdsup]');
    if (!x) return;
    A.cfg.cadences = C.cadences(A.cfg).filter(function (c) { return c.id !== x.dataset.cdsup; });
    Promise.resolve(sauverCfg()).then(function () {
      fermerModale(); renderRendements(); toast('Cadence retirée.');
    });
  });
}
function ouvrirCadence(travail, unite) {
  var u = unite || C.courtUnite(C.uniteDe(travail));
  /* Les chantiers qui portent cette prestation d'abord : c'est sur l'un
     d'eux qu'il vient de la chronométrer. */
  var porte = function (c) {
    return (c.lignes || []).some(function (l) {
      return C.travauxDeLigne(l).indexOf(travail) >= 0;
    });
  };
  var chs = A.chantiers.slice().sort(function (a, b) {
    var pa = porte(a) ? 0 : 1, pb = porte(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return C.dateChantier(b) - C.dateChantier(a);
  });
  modale('Ce que vous avez compté — ' + C.nomTravail(travail),
    '<p class="sous-titre-bloc">Ce que vous relevez montre en main, sur le ' +
    'chantier. Il se lira à côté de ce que vos journées ont mesuré : l’écart ' +
    'entre les deux, ce sont les aléas — la route, le matériel, la pluie.</p>' +
    '<div class="champ"><label class="eyebrow" for="cd-sens">Vous comptez en</label>' +
    '<select id="cd-sens">' +
    '<option value="minutes">minutes par ' + esc(u) + '</option>' +
    '<option value="parjour">' + esc(u) + ' par jour</option></select></div>' +
    '<div class="champ"><label class="eyebrow" for="cd-val">Combien</label>' +
    '<input type="text" id="cd-val" class="gros" inputmode="decimal">' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0" id="cd-conv"></p></div>' +
    '<div class="champ"><label class="eyebrow" for="cd-ch">Constaté sur</label>' +
    '<select id="cd-ch"><option value="">— sans chantier —</option>' +
    chs.map(function (c) {
      return '<option value="' + c.id + '">' + esc(C.nomChantier(c)) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="cd-note">Dans quel contexte</label>' +
    '<input type="text" id="cd-note" autocomplete="off" ' +
    'placeholder="ronce épaisse, pente, tiges serrées…"></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="cd-ok">Enregistrer</button></div>');

  /* La conversion s'écrit sous le champ, à chaque frappe : il tape ce qu'il a
     chronométré et voit ce que ça donne en journée, sans le calculer. */
  var lire = function () {
    return { valeur: $('#cd-val').value, sens: $('#cd-sens').value };
  };
  var majConv = function () {
    var v = C.cadenceParJour(lire(), A.cfg);
    $('#cd-conv').textContent = v > 0
      ? 'soit ' + E.fmt(v, v < 10 ? 2 : 0) + ' ' + u + ' par journée de ' +
        C.HEURES_JOUR(A.cfg) + ' h'
      : '';
  };
  $('#cd-val').addEventListener('input', majConv);
  $('#cd-sens').addEventListener('change', majConv);

  $('#cd-ok').addEventListener('click', function () {
    var c = lire();
    if (!(C.cadenceParJour(c, A.cfg) > 0)) { toast('Donnez un nombre.'); return; }
    A.cfg.cadences = C.cadences(A.cfg);
    A.cfg.cadences.push({
      id: uid(), travail: travail, unite: u, valeur: C.nb(c.valeur), sens: c.sens,
      chantier: $('#cd-ch').value, note: $('#cd-note').value.trim(), date: Date.now()
    });
    Promise.resolve(sauverCfg()).then(function () {
      fermerModale(); renderRendements(); toast('Cadence enregistrée.');
    });
  });
}
/* La phrase telle qu'il l'a dictée, pas la valeur convertie : « une tige
   toutes les dix minutes » est ce qu'il retrouvera, pas « 48 tiges/j ». */
function ditCadence(c, u) {
  var v = C.nb(c.valeur);
  return c.sens === 'parjour'
    ? E.fmt(v, v < 10 ? 2 : 0) + ' ' + u + ' par jour'
    : E.fmt(v, v < 10 ? 1 : 0) + ' min par ' + u;
}

