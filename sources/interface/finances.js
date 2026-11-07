/* ==================================================== FINANCES ET DÉPENSES */
var FIN = window.BCF;

function depense(id) { return A.depenses.filter(function (d) { return d.id === id; })[0] || null; }
/* La dépense née d'une commande porte son identifiant : c'est ce qui permet
   de la retrouver pour la corriger ou la retirer. */
function depenseDeCommande(idCmd) {
  if (!idCmd) return null;
  return A.depenses.filter(function (d) { return d.commande === idCmd; })[0] || null;
}
function sauverDepenses() { return ecrire('bordcub.depenses', A.depenses); }
function periodeCourante() {
  var p = A.periode || (A.periode = { type: 'annee', annee: new Date().getFullYear(), indice: 0 });
  return FIN.bornes(p.type, p.annee, p.indice);
}
function libellePeriode() {
  periodeCourante();
  var p = A.periode;
  if (p.type === 'annee') return String(p.annee);
  if (p.type === 'trimestre') return 'T' + (p.indice + 1) + ' ' + p.annee;
  return MOIS_NOMS[p.indice] + ' ' + p.annee;
}

/* -------------------------------------------------------- sélecteurs */
/* TVA, Dépenses et Année portent chacune les trois sélecteurs de la même
   période (lot d1) : ils se remplissent de la même façon, et celle qu'on
   choisit dans l'une se retrouve dans les deux autres. */
function renderSelecteursPeriode() {
  periodeCourante();          // garantit que A.periode existe
  ['an', 'fi', 'dep'].forEach(function (p) {
    majSelecteurs('#' + p + '-type', '#' + p + '-indice', '#' + p + '-annee', A.periode);
  });
}
function majSelecteurs(idT, idI, idA, p) {
  if (!$(idT)) return;
  $(idT).value = p.type;
  var ans = {}, now = new Date().getFullYear();
  ans[now] = 1; ans[now - 1] = 1;
  A.chantiers.forEach(function (c) { var d = FIN.dateRecette(c); if (d) ans[new Date(d).getFullYear()] = 1; });
  A.depenses.forEach(function (d) { if (d.date) ans[new Date(d.date).getFullYear()] = 1; });
  $(idA).innerHTML = Object.keys(ans).map(Number).sort(function (a, b) { return b - a; })
    .map(function (x) { return '<option value="' + x + '"' + (x === p.annee ? ' selected' : '') + '>' + x + '</option>'; }).join('');
  var opts = [];
  if (p.type === 'trimestre') opts = [0, 1, 2, 3].map(function (i) { return [i, 'T' + (i + 1)]; });
  else if (p.type === 'mois') opts = MOIS_NOMS.map(function (m, i) { return [i, m]; });
  $(idI).innerHTML = opts.length
    ? opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === p.indice ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
    : '<option value="0">année entière</option>';
  $(idI).disabled = !opts.length;
}

/* ------------------------------------------------------ Argent ▸ Mois */
/* Mois a son propre mois (lot d1) : il s'ouvre sur le mois en cours au
   démarrage de Sylve et ne touche pas A.periode, que partagent TVA,
   Dépenses et Année. Tout ce qu'il montre reprend un calcul qui existait,
   borné au mois affiché — sauf le bloc « À ce jour », qui le dit. */
function moisArgent() {
  if (!A.moisArgent) {
    var d = new Date();
    A.moisArgent = { annee: d.getFullYear(), indice: d.getMonth() };
  }
  return A.moisArgent;
}
function changerMoisArgent(pas) {
  var m = moisArgent(), d = new Date(m.annee, m.indice + pas, 1, 12);
  A.moisArgent = { annee: d.getFullYear(), indice: d.getMonth() };
  renderFinances();
}
function renderFinances() {
  var z = $('#fi-corps');
  if (z) {
    var m = moisArgent(), b = FIN.bornes('mois', m.annee, m.indice);
    if ($('#mo-titre')) $('#mo-titre').textContent = majuscule(MOIS_NOMS[m.indice]) + ' ' + m.annee;
    var ca = FIN.chiffreAffaires(A.chantiers, b);
    z.innerHTML = htmlCaMois(ca) + htmlHistoMois(m) + carteTva('TVA du mois', b, 'mo-tva', false) +
      htmlDepensesMois(b) + htmlFacturesMois(ca, m) + htmlAJour() + htmlPlusLoin(b);
  }
  /* La TVA était une carte du Bilan : partout où le Bilan se refaisait, elle
     se refait aussi. */
  renderTva();
}
/* Le grand chiffre et sa barre : hors débours, comme l'ancien Bilan. */
function htmlCaMois(ca) {
  var pc = function (v) { return ca.total > 0 ? C.arr(v / ca.total * 100, 2) : 0; };
  return '<div class="carte" id="mo-ca"><small class="ag-petit">Chiffre d’affaires facturé HT</small>' +
    '<b class="num ag-big" data-mo="ca">' + eur(ca.total) + '</b>' +
    (ca.total
      ? '<div class="ag-empile"><i class="ag-presta" style="width:' + pc(ca.prestation) + '%"></i>' +
        '<i class="ag-vente" style="width:' + pc(ca.vente) + '%"></i></div>' +
        '<div class="ag-leg"><span><i class="ag-presta"></i>Prestation <b class="num" data-mo="prestation">' +
        eur(ca.prestation) + '</b></span><span><i class="ag-vente"></i>Vente <b class="num" data-mo="vente">' +
        eur(ca.vente) + '</b></span></div>'
      : '<p class="ag-petit">Aucune facture datée de ce mois.</p>') +
    (ca.debours ? '<p class="ag-petit">Hors débours (<span class="num">' + eur(ca.debours) +
      '</span>), qui traverse le compte sans être une recette.</p>' : '') +
    '</div>';
}
/* Les douze mois de l'année du mois affiché : le même « facturé » mois par
   mois qu'Année ▸ Recettes et Vue d'ensemble. */
function htmlHistoMois(m) {
  var v = FIN.recettesParMois(A.chantiers, m.annee), cumul = 0;
  for (var i = 0; i <= m.indice; i++) cumul += v[i];
  return '<div class="carte" id="mo-histo"><div class="ag-entete"><h2>' + m.annee + ', mois par mois</h2>' +
    '<small class="ag-petit"><b class="num" data-mo="cumul">' + eur(C.arr(cumul, 2)) + '</b> à fin ' +
    MOIS_COURTS[m.indice] + '</small></div>' + histoArgent(v, m.indice) +
    '<p class="ag-petit" id="mo-msa">' + ligneMsa(m) + '</p></div>';
}
/* Le dessin de la maquette V2 : le mois affiché en plein, les autres pâles,
   son montant au-dessus. Trois lettres par mois, comme les analyses. */
function histoArgent(v, cur) {
  var max = Math.max.apply(null, v.concat([0]));
  var haut = paliersJoli(max), bas = 96, padL = 30, pas = 24, lb = 16;
  var y = function (x) { return bas - (x / haut) * (bas - 14); };
  var s = '<svg class="ag-graph" viewBox="0 0 320 114" width="100%" role="img" ' +
    'aria-label="Chiffre d’affaires facturé, mois par mois">';
  if (max > 0) {
    [haut / 2, haut].forEach(function (g) {
      s += '<line class="ag-g" x1="' + (padL - 4) + '" x2="320" y1="' + y(g).toFixed(1) + '" y2="' + y(g).toFixed(1) +
        '"/><text x="0" y="' + (y(g) + 3).toFixed(1) + '">' + xmlEsc(eurCourt(g)) + '</text>';
    });
  }
  s += '<line class="ag-g" x1="' + (padL - 4) + '" x2="320" y1="' + bas + '" y2="' + bas + '"/>';
  for (var i = 0; i < 12; i++) {
    var x = padL + i * pas, h = v[i] > 0 ? Math.max(1.5, bas - y(v[i])) : 0;
    if (h) {
      s += '<rect class="ag-bm' + (i === cur ? ' cur' : '') + '" data-mois="' + i + '" x="' + x + '" y="' +
        (bas - h).toFixed(1) + '" width="' + lb + '" height="' + h.toFixed(1) + '" rx="2"><title>' +
        xmlEsc(MOIS_NOMS[i] + ' : ' + eur(v[i])) + '</title></rect>';
      if (i === cur) s += '<text class="ag-val" x="' + (x + lb / 2) + '" y="' + (bas - h - 4).toFixed(1) +
        '" text-anchor="middle">' + xmlEsc(eurCourt(v[i])) + '</text>';
    }
    s += '<text x="' + (x + lb / 2) + '" y="' + (bas + 13) + '" text-anchor="middle"' +
      (i === cur ? ' class="ag-val"' : '') + '>' + MOIS_ABBR[i] + '</text>';
  }
  return s + '</svg>';
}
/* Le trimestre civil du mois affiché, pas celui d'aujourd'hui : en janvier,
   on déclare octobre-décembre en allant sur décembre. Même base que la
   déclaration d'Année ▸ Déclarations : le facturé, hors débours. */
function ligneMsa(m) {
  var q = Math.floor(m.indice / 3) * 3, now = Date.now(), tot = 0, parts = [];
  for (var i = q; i < q + 3; i++) {
    var b = FIN.bornes('mois', m.annee, i);
    if (b.debut > now) { parts.push(MOIS_COURTS[i] + ' à venir'); continue; }
    var v = FIN.chiffreAffaires(A.chantiers, b).total;
    tot += v;
    parts.push(MOIS_COURTS[i] + ' ' + eur(v));
  }
  return 'Trimestre (MSA) : ' + parts.join(' · ') + ' · total ' + eur(C.arr(tot, 2));
}
/* La TVA en lignes alignées (maquette V2) : taux, base, montant ; puis ce
   qui est facturé, ce qui se déduit, et le solde. Mois l'emploie sur son
   mois, l'onglet TVA sur la période choisie : c'est la Balance de TVA de
   l'ancien Bilan, mêmes nombres. */
function carteTva(titre, b, id, regle) {
  var bal = FIN.balanceTva(A.chantiers, A.depenses, b, C.tauxLigne);
  /* La base d'un taux : les mêmes lignes que la TVA facturée, avec le même
     taux — celui que la fiche du chantier applique. */
  var bases = {};
  FIN.lignesFacturees(A.chantiers, b, C.tauxLigne).forEach(function (x) {
    bases[x.taux] = (bases[x.taux] || 0) + x.ht;
  });
  var taux = Object.keys(bal.collectee.parTaux).sort(function (x, y) { return Number(y) - Number(x); });
  var cl = function (t) {
    t = Number(t);
    return t === 20 ? ' t20' : t === 10 ? ' t10' : t === 5.5 ? ' t5' : '';
  };
  var solde = bal.sens === 'a_recuperer' ? 'À récupérer' : (bal.sens === 'a_payer' ? 'À reverser' : 'Équilibre');
  var immo = bal.deductible.immobilisations;
  return '<div class="carte" id="' + id + '"><h2>' + titre + '</h2><div class="ag-tva">' +
    (taux.length ? taux.map(function (t) {
      return '<span class="ag-taux' + cl(t) + '">' + esc(String(t).replace('.', ',')) + ' %</span>' +
        '<span class="s">sur <span class="num">' + eur(C.arr(bases[t] || 0, 2)) + '</span></span>' +
        '<b class="num" data-tvataux="' + esc(t) + '">' + eur(bal.collectee.parTaux[t]) + '</b>';
    }).join('') : '<span class="s l">Rien de facturé sur la période.</span><span></span>') +
    '<span class="tot l">TVA facturée</span><b class="tot num" data-tva="facturee">' + eur(bal.collectee.total) + '</b>' +
    '<span class="s l">TVA déductible</span><span class="num" data-tva="deductible">− ' +
    eur(bal.deductible.total) + '</span>' +
    (immo ? '<span class="s l ag-dont">dont immobilisations</span><span class="num ag-dont" data-tva="immo">' +
      eur(immo) + '</span>' : '') +
    '<span class="tot l" data-tva="sens">' + solde + '</span><b class="tot num" data-tva="solde">' +
    eur(bal.montant) + '</b></div>' +
    (immo ? '<p class="ag-petit">Dont ' + eur(immo) + ' sur immobilisations — un achat exceptionnel ' +
      'gonfle la TVA déductible d’un seul trimestre.</p>' : '') +
    (regle ? '<p class="ag-petit ag-regle">La TVA facturée est comptée à la date de la facture ; ' +
      'la déductible, à la date de la dépense.</p>' : '') +
    '</div>';
}
/* Des barres horizontales en grille : les noms, les barres et les montants
   tombent chacun dans leur colonne. Rangée en bouton quand elle ouvre
   quelque chose. */
function hbarres(lignes, vert, attr) {
  var max = Math.max.apply(null, lignes.map(function (l) { return l.valeur; }).concat([0]));
  return '<div class="ag-hbar' + (vert ? ' vert' : '') + '">' + lignes.map(function (l) {
    var pc = max > 0 ? Math.max(0, Math.round(l.valeur / max * 100)) : 0;
    var corps = '<span class="ag-hn">' + esc(l.nom) +
      (l.detail ? ' <small>' + esc(l.detail) + '</small>' : '') + '</span>' +
      '<span class="ag-barre"><i style="width:' + pc + '%"></i></span><b class="num">' + eur(l.valeur) + '</b>';
    return attr ? '<button type="button" class="ag-hl" data-' + attr + '="' + esc(l.cle) + '">' + corps + '</button>'
      : '<div class="ag-hl">' + corps + '</div>';
  }).join('') + '</div>';
}
/* Hors taxes, comme l'ancien bloc « Dépenses et marge » : les dépenses nées
   d'une charge fixe font une barre à elles (maquette V2). */
function htmlDepensesMois(b) {
  var dep = FIN.totalDepenses(A.depenses, b);
  var deCharge = function (d) { return !!d.charge; };
  var lignes = FIN.parCategorie(A.depenses.filter(function (d) { return !deCharge(d); }), b, FIN.nomCategorie)
    .map(function (c) { return { cle: c.categorie, nom: c.nom, valeur: c.ht }; });
  var ch = FIN.totalDepenses(A.depenses.filter(deCharge), b).ht;
  if (ch) lignes.push({ cle: 'charges', nom: 'Charges fixes', valeur: ch });
  lignes.sort(function (x, y) { return y.valeur - x.valeur; });
  return '<div class="carte" id="mo-dep"><div class="ag-entete"><h2>Dépenses du mois</h2>' +
    '<b class="num" data-mo="depenses">' + eur(dep.ht) + '</b></div>' +
    (lignes.length
      ? '<p class="ag-petit ag-avant">Hors taxes. Un appui sur une barre ouvre ces dépenses.</p>' +
        hbarres(lignes, false, 'modep')
      : '<p class="ag-petit">Aucune dépense ce mois-ci.</p>') + '</div>';
}
/* Un appui sur une barre : les Dépenses sur ce mois, filtrées sur la
   catégorie ; les charges fixes ont leur bloc, sous la liste. */
function depensesDuMois(cle) {
  var m = moisArgent();
  A.periode = { type: 'mois', annee: m.annee, indice: m.indice };
  A.filtreDep = cle === 'charges' ? 'tous' : cle;
  renderTva(); renderAnalyses();
  allerModule('finances', cle === 'charges' ? 'charges' : 'depenses');
}
/* Ce calcul suit la date de la facture : il dit ce qui, des factures du
   mois, est réglé à ce jour — pas l'argent rentré dans le mois. D'où
   « dont payé », jamais « encaissé en octobre ». */
function htmlFacturesMois(ca, m) {
  return '<div class="carte" id="mo-fact"><div class="ag-entete"><h2>Facturé en ' + MOIS_NOMS[m.indice] + '</h2>' +
    '<b class="num">' + eur(ca.total) + '</b></div><dl class="ag-kv">' +
    '<dt>dont payé</dt><dd class="num" data-mo="paye">' + eur(ca.encaisse) + '</dd>' +
    '<dt>pas encore payé</dt><dd class="num" data-mo="attente">' + eur(ca.aEncaisser) + '</dd></dl></div>';
}
/* Ce qui attend aujourd'hui, quel que soit le mois regardé. Un chantier
   terminé sans ligne chiffrée se dit, au lieu de compter pour zéro en
   silence (remontée du lot 5b2). */
function htmlAJour() {
  var t = C.totaux(A.chantiers, A.cfg);
  var sans = A.chantiers.filter(function (c) { return c.statut === 'termine' && !(C.montant(c) > 0); }).length;
  var factures = A.chantiers.filter(function (c) { return c.statut === 'facture'; }).length;
  var g = C.groupesChantiers(A.chantiers, A.cfg, Date.now());
  var impayees = Object.keys(g.alerte).filter(function (k) { return g.alerte[k].type === 'impaye'; }).length;
  var pl = function (n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); };
  var ligne = function (id, titre, sous, montant) {
    return '<button type="button" class="aj-ch" id="' + id + '"><span class="aj-txt"><b>' + titre + '</b>' +
      '<small>' + sous + '</small></span><span class="aj-droite"><b class="num">' + eur(montant) + '</b></span></button>';
  };
  var l = (t.nAFacturer ? ligne('mo-afacturer', 'À facturer', pl(t.nAFacturer, 'chantier') +
      (sans ? ' · dont ' + sans + ' sans montant' : ''), t.aFacturer) : '') +
    (factures ? ligne('mo-attente', 'Facturé, pas encore payé', pl(factures, 'facture') +
      (impayees ? ' · <span class="aj-situ aj-alerte">dont ' + impayees + ' impayée' +
        (impayees > 1 ? 's' : '') + '</span>' : ''), FIN.chiffreAffaires(A.chantiers).aEncaisser) : '');
  return '<div class="carte" id="mo-ajour"><h2>À ce jour <span class="ag-dit">· quel que soit le mois affiché</span></h2>' +
    (l ? '<div class="aj-zone">' + l + '</div>'
      : '<p class="ag-petit">Rien à facturer, aucune facture qui attende son paiement.</p>') + '</div>';
}
/* Un pli qu'il a ouvert reste ouvert quand l'écran se redessine. */
function pliArgent(cle, titre, corps) {
  A.agPlis = A.agPlis || {};
  return '<details class="ag-pli" data-loin="' + cle + '"' + (A.agPlis[cle] ? ' open' : '') + '>' +
    '<summary>' + titre + picto('chevron') + '</summary><div class="ag-pli-corps">' + corps + '</div></details>';
}
function htmlPlusLoin(b) {
  return '<h2 class="ag-sous">Pour aller plus loin</h2><div class="ag-loin" id="mo-loin">' +
    pliArgent('donneurs', 'Par donneur d’ordre', htmlParDonneur(b)) +
    pliArgent('rapporte', 'Ce qui rapporte, par type de travaux', htmlRapporte(b)) +
    pliArgent('fournitures', 'Marge sur fournitures', htmlMargeFournitures(b)) +
    pliArgent('marge', 'Recettes moins dépenses', htmlRecettesMoinsDepenses(b)) +
    pliArgent('charges', 'Charges fixes prélevées ce mois', htmlChargesPrelevees(b)) +
    pliArgent('deplacements', 'Déplacements', htmlDeplacements(b)) + '</div>';
}
/* L'ancien bloc du Bilan, sur le mois ; sa seconde partie regardait déjà
   tous les chantiers, elle le dit. */
function htmlParDonneur(b) {
  var pd = FIN.caParDonneur(A.chantiers, b);
  var pg = C.parDonneur(A.chantiers, A.cfg).filter(function (x) { return x.n > 0; });
  var totalD = pd.reduce(function (s, x) { return s + x.ht; }, 0);
  return (pd.length ? pd.map(function (x) {
    return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:6px 0;border-bottom:1px solid var(--trait)">' +
      '<span>' + esc(x.donneur) + ' <span class="muted" style="font-size:11.5px">' + x.n +
      ' chantier' + (x.n > 1 ? 's' : '') + '</span></span>' +
      '<span style="white-space:nowrap"><b class="num">' + eur(x.ht) + '</b>' +
      '<span class="muted" style="font-size:11.5px"> · ' + FIN.arr(totalD ? x.ht / totalD * 100 : 0, 0) + ' %</span></span></div>';
  }).join('') : '<p class="ag-petit">Aucune facture datée de ce mois.</p>') +
    (pg.length ? '<p class="eyebrow" style="margin:14px 0 6px">Tous chantiers confondus, depuis le début</p>' +
      pg.slice(0, 6).map(function (x) {
        /* Le délai de règlement se lit à côté de ce que le client apporte :
           celui qui paie vite et celui qui fait attendre ne se valent pas à
           chiffre égal. La médiane, pas la moyenne : un seul règlement
           oublié six mois donnerait une réputation imméritée. */
        return '<div style="padding:6px 0;border-bottom:1px solid var(--trait)">' +
          '<div style="font-size:13.5px">' + esc(x.donneur) +
          (x.enRetard ? ' <span class="retard">' + x.enRetard + ' en retard</span>' : '') + '</div>' +
          '<div class="muted" style="font-size:12px;margin-top:1px">' + eur(x.signe) + ' signés' +
          (x.propose ? ' · ' + eur(x.propose) + ' proposés' : '') +
          (x.taux != null ? ' · ' + x.taux + ' % acceptés' : '') +
          (x.delaiMedian != null ? ' · payé en ' + x.delaiMedian + ' j' +
            (x.delaiPire > x.delaiMedian ? ' (jusqu’à ' + x.delaiPire + ')' : '') : '') +
          '</div></div>';
      }).join('') : '');
}
/* Les prestations seules (maquette V2) : les fournitures vendues ont leur
   marge juste en dessous, le débours n'est pas une recette. Le calcul est
   celui d'Année ▸ Recettes ▸ Par type de travaux, sur ces lignes-là. */
function htmlRapporte(b) {
  var presta = A.chantiers.map(function (c) {
    var copie = {};
    for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) copie[k] = c[k];
    copie.lignes = (c.lignes || []).filter(function (l) {
      var n = l.nature || 'prestation';
      return n !== 'vente' && !FIN.estHorsCA(n);
    });
    return copie;
  });
  var l = FIN.parPrestation(presta, b, C.nomTravail);
  return (l.length ? hbarres(l.map(function (p) {
    return { nom: p.nom, valeur: p.ht,
      detail: (p.quantite && p.unite) ? E.fmt(p.quantite, 0) + ' ' + C.courtUnite(p.unite) : '' };
  }), true) : '<p class="ag-petit">Aucune prestation facturée ce mois-ci.</p>') +
    '<p class="ag-petit">Prestations seules ; les fournitures sont dans la marge ci-dessous.</p>';
}
function htmlMargeFournitures(b) {
  var mg = ST.margeGlobale(A.articles, A.chantiers, C.montantLigne, function (ch) {
    return ['facture', 'paye'].indexOf(ch.statut) >= 0 && FIN.dansPeriode(FIN.dateRecette(ch), b);
  });
  if (!mg.vendu) return '<p class="ag-petit">Aucune fourniture refacturée ce mois-ci.</p>';
  return '<dl class="ag-kv"><dt>Refacturé</dt><dd class="num">' + eur(mg.vendu) + '</dd>' +
    '<dt>Coût du stock</dt><dd class="num">' + eur(mg.cout) + '</dd>' +
    '<dt class="total">Marge</dt><dd class="total num">' + eur(mg.marge) +
    (mg.taux != null ? ' · ' + mg.taux + ' %' : '') + '</dd></dl>';
}
/* L'ancienne « marge » du bloc Dépenses et marge, avec sa mise en garde. */
function htmlRecettesMoinsDepenses(b) {
  var dep = FIN.totalDepenses(A.depenses, b), res = FIN.resultat(A.chantiers, A.depenses, b);
  return '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(dep.ht) + '</b><small>achats HT</small></div>' +
    '<div class="carte2"><b class="num">' + eur(dep.courant) + '</b><small>courants</small></div>' +
    '<div class="carte2"><b class="num">' + eur(dep.immo) + '</b><small>immobilisations</small></div>' +
    '<div class="carte2" style="border-color:' + (res.marge >= 0 ? 'var(--accent)' : 'var(--alerte)') + '">' +
    '<b class="num" data-mo="marge">' + eur(res.marge) + '</b><small>recettes − achats</small></div></div>' +
    '<p class="ag-petit">Marge réelle, à ne pas confondre avec la base imposable : au micro-BIC, ' +
    'c’est l’abattement forfaitaire qui compte, pas vos achats.</p>';
}
/* Les prélèvements du mois, ceux de l'ancienne carte « Échéances » bornée à
   ce mois : passés ou à venir, montant prélevé. */
function htmlChargesPrelevees(b) {
  var dues = FIN.chargesDues(A.charges, A.depenses, b), maintenant = C.minuit(Date.now()), tot = 0;
  if (!dues.length) return '<p class="ag-petit">Aucun prélèvement ce mois-ci.</p>';
  return '<dl class="ag-kv">' + dues.map(function (d) {
    tot += d.ttc;
    return '<dt>' + esc(d.charge.libelle || 'Charge') + ' · ' + jourCourt(d.date) +
      (d.date <= maintenant ? '' : ' · à venir') + '</dt><dd class="num">' + eur(d.ttc) + '</dd>';
  }).join('') + '<dt class="total">Total</dt><dd class="total num">' + eur(C.arr(tot, 2)) + '</dd></dl>';
}
/* Les kilomètres et le carburant estimé de l'ancien Bilan, sur le mois ; le
   carburant payé, ce sont les dépenses de carburant du mois. */
function htmlDeplacements(b) {
  var km = C.kmTotal(A.chantiers, b.debut, b.fin);
  var cats = FIN.parCategorie(A.depenses, b);
  var de = function (c) { return cats.filter(function (x) { return x.categorie === c; })[0]; };
  var carb = de('CARB'), perso = de('CARBPERSO');
  if (!km && !carb && !perso) return '<p class="ag-petit">Aucun kilomètre ni carburant noté ce mois-ci.</p>';
  return '<dl class="ag-kv"><dt>Kilomètres du mois</dt><dd class="num">' + E.fmt(km, 0) + ' km</dd>' +
    '<dt>Carburant payé, utilitaire (TTC)</dt><dd class="num">' + (carb ? eur(carb.ttc) : '—') + '</dd>' +
    (perso ? '<dt>Carburant du véhicule perso (TTC)</dt><dd class="num">' + eur(perso.ttc) + '</dd>' : '') +
    (km ? '<dt>Coût du carburant estimé</dt><dd class="num">' + eur(C.coutCarburant(km, A.cfg)) + '</dd>' : '') +
    '</dl>' +
    (km ? '<p class="ag-petit">Estimation d’après ' + ((A.cfg && A.cfg.litres100) || 9) + ' L/100 km à ' +
      eur((A.cfg && A.cfg.prixLitre) || 1.75) + ' le litre, réglable.</p>' : '');
}

/* « Ça va à la ligne, et j'aime pas » : « 12 000 € → 6 000 € » se coupait en
   deux sur un téléphone, et on ne savait plus lequel lire. Le montant ne se
   coupe plus ; celui qui compte en gros, celui d'où il vient en petit,
   dessous. */
function ligneCA(nom, brut, apres, taux) {
  if (!brut) return '';
  return '<div class="ligne-ca" style="display:flex;justify-content:space-between;' +
    'align-items:flex-start;gap:12px;padding:6px 0">' +
    '<span>' + esc(nom) + '<span class="muted" style="display:block;font-size:11.5px">' +
    'abattement ' + taux + '</span></span>' +
    '<span class="ca-montants" style="text-align:right;white-space:nowrap">' +
    '<b class="num">' + eur(apres) + '</b>' +
    '<span class="muted num" style="display:block;font-size:11.5px">sur ' + eur(brut) +
    '</span></span></div>';
}

/* --------------------------------------------------------- Argent ▸ TVA */
function renderTva() {
  var z = $('#tva-corps'); if (!z) return;
  renderSelecteursPeriode();
  z.innerHTML = carteTva('TVA — ' + esc(libellePeriode()), periodeCourante(), 'tva-balance', true);
}

/* -------------------------------------------------------- Argent ▸ Dépenses */
/* La ligne de la maquette tour 2 : le fournisseur, la date et les
   catégories, le TTC et la TVA à droite. Un appui ouvre la dépense ; celle
   qui découle d'une charge fixe ouvre sa charge, comme son ancien bouton. */
function renderDepenses() {
  var z = $('#liste-depenses'); if (!z) return;
  renderSelecteursPeriode();
  var b = periodeCourante();
  var t = FIN.totalDepenses(A.depenses, b);
  if ($('#dep-totaux')) {
    $('#dep-totaux').innerHTML = A.depenses.length
      ? '<div class="kpi">' +
        '<div class="carte2"><b class="num">' + eur(t.ttc) + '</b><small>TTC sur ' + esc(libellePeriode()) + '</small></div>' +
        '<div class="carte2"><b class="num">' + eur(t.ht) + '</b><small>HT</small></div>' +
        '<div class="carte2"><b class="num">' + eur(t.tva) + '</b><small>TVA déductible</small></div>' +
        '<div class="carte2"><b class="num">' + t.n + '</b><small>achats saisis</small></div></div>'
      : '<div class="vide"><p>Aucune dépense. Photographiez un ticket et saisissez le montant : ' +
        'la TVA se calcule toute seule.</p></div>';
  }
  var f = A.filtreDep || 'tous';
  if ($('#dep-filtre')) {
    $('#dep-filtre').innerHTML = '<option value="tous"' + (f === 'tous' ? ' selected' : '') + '>Toutes les catégories</option>' +
      FIN.CATEGORIES.map(function (c) {
        /* Compter sur la même période que la liste : sans ça, le menu
           annonçait « Immobilisation (4) » — tout l'historique — pour une
           liste qui n'en montrait qu'une, celle de l'année en cours. */
        var n = A.depenses.filter(function (d) {
          return FIN.dansPeriode(d.date, b) &&
            FIN.lignesDepense(d).some(function (x) { return x.categorie === c.c; });
        }).length;
        return n ? '<option value="' + c.c + '"' + (f === c.c ? ' selected' : '') + '>' + c.n + ' (' + n + ')</option>' : '';
      }).join('');
  }
  var l = A.depenses.filter(function (d) {
    return FIN.dansPeriode(d.date, b) &&
      (f === 'tous' || FIN.lignesDepense(d).some(function (x) { return x.categorie === f; }));
  })
    .sort(function (a, b2) { return (b2.date || 0) - (a.date || 0); });
  z.innerHTML = l.length ? '<div class="aj-zone">' + l.map(function (d) {
    var lg = FIN.lignesDepense(d);
    var cats = lg.map(function (x) { return FIN.nomCategorie(x.categorie); })
      .filter(function (v, i, tt) { return tt.indexOf(v) === i; });
    var qui = d.fournisseur || lg[0].libelle || 'Sans fournisseur';
    var tva = FIN.tvaDe(d);
    return '<button type="button" class="aj-ch dep-l" data-depmod="' + esc(d.id) + '">' +
      '<span class="aj-txt"><b>' + esc(qui) + '</b><small>' + dateCourte(d.date) + ' · ' + esc(cats.join(', ')) +
      (d.charge ? ' · charge fixe' : '') + '</small></span>' +
      '<span class="aj-droite"><b class="num">' + eur(FIN.ttcDe(d)) + '</b>' +
      '<small>' + (tva ? 'TVA ' + eur(tva) : 'sans TVA') + '</small>' +
      /* Une dépense née d'une charge fixe se corrige sur la charge, pas ici :
         la retoucher se perdrait à la prochaine synchronisation. */
      (d.auto && d.charge ? '<span class="aj-etiq">La charge</span>' : '') + '</span></button>';
  }).join('') + '</div>' : '<div class="vide"><p>Aucune dépense sur ' + esc(libellePeriode()) + '.</p></div>';
}

var depLignes = [];

/* Le prix au litre de la ligne, réécrit seul à chaque frappe : redessiner le
   bloc entier ferait perdre le curseur au milieu du nombre. Même raison que
   les conversions du stock. */
function textePrixLitre(l) {
  return (FIN.nb(l.litres) > 0 && FIN.nb(l.ttc) > 0)
    ? '<b>' + E.fmt(FIN.arr(FIN.nb(l.ttc) / FIN.nb(l.litres), 3), 3) + ' €</b> le litre.'
    : 'Facultatif — sert au prix moyen du litre, et donc au coût du véhicule.';
}
function majPrixLitres() {
  $$('#dp-lignes [data-dlprix]').forEach(function (p) {
    var l = depLignes[Number(p.dataset.dlprix)];
    if (l) p.innerHTML = textePrixLitre(l);
  });
}
/* La dépense ouverte est-elle déjà rattachée à une intervention du carnet ?
   Si oui, la proposer une seconde fois créerait un doublon. */
var depDejaAuCarnet = false;
function majOffreCarnet() {
  var z = $('#dp-carnet'); if (!z) return;
  var offrable = !depDejaAuCarnet && depLignes.some(function (l) {
    return l.categorie === 'VEHIC' && FIN.nb(l.ttc) > 0;
  });
  z.hidden = !offrable;
  if (!offrable && $('#dp-hist')) { $('#dp-hist').checked = false; $('#dp-histkm').hidden = true; }
}

function renderDepLignes() {
  var z = $('#dp-lignes'); if (!z) return;
  z.innerHTML = depLignes.map(function (l, i) {
    return '<div class="carte2" style="margin-bottom:7px;padding:9px 10px">' +
      '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
      '<input type="text" data-dl="' + i + '" placeholder="désignation" value="' + esc(l.libelle || '') + '" style="flex:1">' +
      (depLignes.length > 1 ? '<button type="button" class="btn-min" data-dlsup="' + i + '">✕</button>' : '') +
      '</div>' +
      '<div class="grille g3">' +
      '<div class="champ"><label class="eyebrow">Montant TTC</label>' +
      '<input type="text" data-dlttc="' + i + '" class="gros" inputmode="decimal" value="' +
      (l.ttc != null && l.ttc !== '' ? esc(String(l.ttc).replace('.', ',')) : '') + '"></div>' +
      '<div class="champ"><label class="eyebrow">TVA</label>' +
      '<select data-dltaux="' + i + '">' + FIN.TAUX_TVA.map(function (t) {
        return '<option value="' + t + '"' + (FIN.nb(l.taux) === t ? ' selected' : '') + '>' +
          (t ? String(t).replace('.', ',') + ' %' : 'sans') + '</option>';
      }).join('') + '</select></div>' +
      '<div class="champ"><label class="eyebrow">Catégorie</label>' +
      '<select data-dlcat="' + i + '">' + FIN.CATEGORIES.map(function (c2) {
        return '<option value="' + c2.c + '"' + (l.categorie === c2.c ? ' selected' : '') + '>' + c2.n + '</option>';
      }).join('') + '</select></div></div>' +
      (FIN.estImmo(l.categorie) ? '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Immobilisation — isolée dans la balance de TVA.</p>' : '') +
      /* Le prix du litre change tous les mois : le relever dans un réglage
         demandait de penser à le corriger. Noté ici, il se calcule tout seul
         en moyenne pondérée par les quantités. Facultatif — un plein sans
         litres est écarté de la moyenne, jamais compté pour zéro. */
      (FIN.estCarburant(l.categorie)
        ? '<div style="display:flex;gap:9px;align-items:flex-end;margin-top:7px">' +
          '<div class="champ" style="margin:0;width:8em;flex:none">' +
          '<label class="eyebrow">Litres</label>' +
          '<input type="text" data-dllitres="' + i + '" inputmode="decimal" placeholder="—" value="' +
          (l.litres != null && l.litres !== '' ? esc(String(l.litres).replace('.', ',')) : '') + '"></div>' +
          '<p class="muted" style="font-size:11.5px;margin:0 0 9px;flex:1" data-dlprix="' + i + '">' +
          textePrixLitre(l) + '</p></div>'
        : '') +
      '</div>';
  }).join('') +
    '<button type="button" class="btn-min" id="dp-plusligne">+ une ligne</button>';
  majApercuDep();
  majOffreCarnet();
}
function lireDepLignes() {
  $$('#dp-lignes [data-dl]').forEach(function (i) { depLignes[Number(i.dataset.dl)].libelle = i.value; });
  $$('#dp-lignes [data-dlttc]').forEach(function (i) { depLignes[Number(i.dataset.dlttc)].ttc = FIN.nb(i.value); });
  $$('#dp-lignes [data-dltaux]').forEach(function (i) { depLignes[Number(i.dataset.dltaux)].taux = FIN.nb(i.value); });
  $$('#dp-lignes [data-dlcat]').forEach(function (i) { depLignes[Number(i.dataset.dlcat)].categorie = i.value; });
  $$('#dp-lignes [data-dllitres]').forEach(function (i) {
    depLignes[Number(i.dataset.dllitres)].litres = i.value.trim() ? FIN.nb(i.value) : '';
  });
}
function majApercuDep() {
  var z = $('#dp-apercu'); if (!z) return;
  var faux = { lignes: depLignes.filter(function (l) { return FIN.nb(l.ttc) > 0; }) };
  var ttc = FIN.ttcDe(faux), ht = FIN.htDe(faux), tva = FIN.tvaDe(faux);
  var immo = depLignes.filter(function (l) { return FIN.estImmo(l.categorie) && FIN.nb(l.ttc) > 0; })
    .reduce(function (s, l) { return s + FIN.htLigne(l); }, 0);
  z.innerHTML = ttc
    ? '<b class="num" style="font-size:20px">' + eur(ttc) + '</b> TTC' +
      '<div class="muted" style="font-size:12.5px;margin-top:2px">' + eur(ht) + ' HT · TVA ' + eur(tva) +
      (immo ? ' · dont ' + eur(immo) + ' immobilisé' : '') + '</div>'
    : '<span class="muted">Saisissez au moins un montant.</span>';
}

function ouvrirDepense(id) {
  var d = id ? depense(id) : { date: Date.now() };
  if (!d) return;
  depLignes = id
    ? FIN.lignesDepense(d).map(function (l) {
      return { libelle: l.libelle || '', categorie: l.categorie || 'PETITMAT',
        ttc: l.ttc != null ? l.ttc : '', taux: FIN.nb(l.taux),
        litres: l.litres != null ? l.litres : '' };
    })
    : [];
  if (!depLignes.length) depLignes = [{ libelle: '', categorie: 'PETITMAT', ttc: '', taux: 20 }];
  depDejaAuCarnet = depenseLieeAuCarnet(d);
  var chOuv = A.chantiers.slice().sort(function (x, y) { return (y.maj || 0) - (x.maj || 0); });

  modale(id ? 'Modifier la dépense' : 'Nouvelle dépense',
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="dp-date">Date</label>' +
    '<input type="date" id="dp-date" value="' + versChamp(d.date) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="dp-four">Fournisseur</label>' +
    '<input type="text" id="dp-four" autocomplete="off" value="' + esc(d.fournisseur || '') + '"></div>' +
    '</div>' +
    '<label class="eyebrow" style="margin-top:12px;display:block">Ce qui est sur le ticket ' +
    '<span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">(une ligne par nature d’achat)</span></label>' +
    '<div id="dp-lignes"></div>' +
    '<div class="carte2" id="dp-apercu" style="margin:11px 0"></div>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="dp-num">N° de pièce</label>' +
    '<input type="text" id="dp-num" autocomplete="off" placeholder="pour retrouver le papier" value="' +
    esc(d.numero || '') + '"></div>' +
    /* Une dépense du véhicule qui n'est pas du carburant : carte grise,
       assurance, péage. Sans elle, ces frais restaient invisibles dans le
       coût au kilomètre — et une carte grise, c'est cinq cents euros. */
    '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;' +
    'font-size:13.5px;margin:0 0 11px"><input type="checkbox" id="dp-veh"' +
    (d.vehicule ? ' checked' : '') + '> Cette dépense concerne le véhicule</label>' +
    (chOuv.length ? '<div class="champ"><label class="eyebrow" for="dp-ch">Rattacher à un chantier</label>' +
      '<select id="dp-ch"><option value="">— aucun —</option>' + chOuv.map(function (c2) {
        return '<option value="' + c2.id + '"' + (d.chantier === c2.id ? ' selected' : '') + '>' + esc(c2.nom || 'Chantier') + '</option>';
      }).join('') + '</select></div>' : '') +
    '</div>' +
    /* Une facture de garage a deux vies : une dépense, et une ligne du carnet
       qui fait repartir les échéances. La saisir deux fois est le meilleur
       moyen de n'en saisir qu'une. Elle se verse donc d'une case — et le lien
       posé empêche que le même argent soit compté deux fois au kilomètre.
       Toutes les dépenses du véhicule ne sont pas des interventions : une
       carte grise n'a rien à faire dans un carnet d'entretien. D'où la case
       plutôt qu'un automatisme. */
    '<div id="dp-carnet" hidden>' +
    '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;' +
    'font-size:13.5px;margin:0 0 9px"><input type="checkbox" id="dp-hist"> ' +
    'Noter aussi dans le carnet d’entretien</label>' +
    '<div id="dp-histkm" hidden><div class="champ" style="width:11em">' +
    '<label class="eyebrow" for="dp-km">Kilométrage</label>' +
    '<input type="text" id="dp-km" inputmode="numeric" value="' +
    (kmVehicule() || '') + '"></div>' +
    '<p class="muted" style="font-size:11.5px;margin:0 0 11px">L’intervention sera créée ' +
    'pour son montant hors taxes. Cochez ensuite dans le carnet ce qu’elle couvre, ' +
    'pour que les échéances repartent d’ici.</p></div></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="dp-ok">Enregistrer</button>' +
    /* Supprimer a quitté la ligne de la liste pour la fenêtre (lot d1, D5),
       comme dans Ma journée. Une dépense née d'une charge fixe ne s'ouvre
       jamais ici : c'est sa charge qu'on ouvre. */
    (id && !d.auto ? '<button class="btn danger btn-min" id="dp-sup">Supprimer</button>' : '') + '</div>');
  if ($('#dp-sup')) $('#dp-sup').addEventListener('click', function () { supprimerDepense(d); });

  renderDepLignes();
  majOffreCarnet();
  if ($('#dp-hist')) {
    $('#dp-hist').addEventListener('change', function () {
      $('#dp-histkm').hidden = !$('#dp-hist').checked;
    });
  }

  $('#dp-lignes').addEventListener('input', function () {
    lireDepLignes(); majApercuDep(); majPrixLitres(); majOffreCarnet();
  });
  $('#dp-lignes').addEventListener('change', function (e) {
    lireDepLignes();
    if (e.target.closest('[data-dlcat]')) renderDepLignes(); else majApercuDep();
  });
  $('#dp-lignes').addEventListener('click', function (e) {
    var plus = e.target.closest('#dp-plusligne'), sup = e.target.closest('[data-dlsup]');
    if (plus) { lireDepLignes(); depLignes.push({ libelle: '', categorie: 'PETITMAT', ttc: '', taux: 20 }); renderDepLignes(); }
    else if (sup) { lireDepLignes(); depLignes.splice(Number(sup.dataset.dlsup), 1); renderDepLignes(); }
  });
  $('#dp-ok').addEventListener('click', function () {
    lireDepLignes();
    var lignes = depLignes.filter(function (l) { return FIN.nb(l.ttc) > 0; });
    if (!lignes.length) { toast('Au moins un montant est attendu.'); return; }
    var x = {
      date: versDate($('#dp-date').value) || Date.now(),
      fournisseur: $('#dp-four').value.trim(),
      numero: $('#dp-num').value.trim(),
      chantier: $('#dp-ch') ? ($('#dp-ch').value || null) : null,
      /* Cochée à la main, la case vaut true ; venue du carnet, elle porte
         l'identifiant de l'intervention. On ne l'écrase pas. */
      vehicule: $('#dp-veh') && $('#dp-veh').checked ? (d.vehicule || true) : null,
      lignes: lignes.map(function (l) {
        var o = { libelle: l.libelle.trim(), categorie: l.categorie, ttc: FIN.nb(l.ttc), taux: FIN.nb(l.taux) };
        /* Les litres ne vivent que sur une ligne de carburant : les garder
           après un changement de catégorie fausserait le prix moyen. */
        if (FIN.estCarburant(l.categorie) && FIN.nb(l.litres) > 0) o.litres = FIN.nb(l.litres);
        return o;
      })
    };
    /* on retire les anciens champs à plat pour éviter un double comptage */
    if (id) {
      ['ttc', 'taux', 'tva', 'categorie', 'libelle', 'photo'].forEach(function (k) { delete d[k]; });
      Object.keys(x).forEach(function (k) { d[k] = x[k]; });
      d.maj = Date.now();
    } else { x.id = uid(); x.maj = Date.now(); A.depenses.push(x); }
    var cible = id ? d : x;
    /* Le versement dans le carnet : le montant retenu est le hors taxes des
       seules lignes « Frais véhicule », pas le total du ticket — le carnet
       raisonne en HT, comme l'historique repris de ses factures, et le même
       ticket peut porter du gasoil à côté de la réparation. */
    var versaCarnet = false;
    if ($('#dp-hist') && $('#dp-hist').checked && !depDejaAuCarnet) {
      var htVeh = 0, quoi = '';
      (x.lignes || []).forEach(function (l2) {
        if (l2.categorie !== 'VEHIC') return;
        htVeh += FIN.htLigne(l2);
        if (!quoi && l2.libelle) quoi = l2.libelle;
      });
      var inter = { id: uid(), quoi: quoi || 'Passage au garage', date: x.date,
        km: C.nb($('#dp-km').value) || null, montant: C.arr(htVeh, 2),
        garantie: false, postes: [], depense: cible.id };
      A.vehicule.interventions = A.vehicule.interventions || [];
      A.vehicule.interventions.push(inter);
      cible.vehicule = inter.id;
      versaCarnet = true;
    }
    var fini = function () {
      fermerModale(); renderDepenses(); renderFinances(); renderAnalyses(); renderAccueil();
      renderCarnetV(); renderEcheancesV(); renderCoutsV();
      /* Une réparation qui ne vient pas du carnet du véhicule mérite d'y
         être notée aussi : c'est le kilométrage qui nourrit les échéances. */
      var entretien = !id && !cible.vehicule &&
        (x.lignes || []).some(function (l2) { return l2.categorie === 'ENTRETIEN'; });
      toast(versaCarnet
        ? 'Dépense enregistrée, et notée dans le carnet — cochez ce qu’elle couvre.'
        : entretien
          ? 'Dépense enregistrée. Pensez à noter l’intervention dans le carnet du véhicule.'
          : (id ? 'Dépense modifiée.' : 'Dépense enregistrée.'));
    };
    sauverDepenses().then(function () {
      if (versaCarnet) sauverVehicule().then(fini); else fini();
    });
  });
}




/* Le chemin d'avant vers la corbeille, depuis la fenêtre. Le montant se lit
   sur ses lignes : une dépense à plusieurs lignes n'a plus de « ttc » à
   plat, et le message annonçait 0 €. */
function supprimerDepense(d) {
  if (!d || !confirm('Supprimer cette dépense de ' + eur(FIN.ttcDe(d)) + ' ?\n\nIl restera récupérable ' +
    B.JOURS_POUBELLE + ' jours dans ' + B.CHEMIN_CORBEILLE + '.')) return;
  A.depenses = A.depenses.filter(function (x) { return x.id !== d.id; });
  jeterObjet('depense', d, (d.fournisseur || 'Dépense'), eur(FIN.ttcDe(d)))
    .then(sauverDepenses).then(function () {
      fermerModale();
      renderDepenses(); renderFinances(); renderAnalyses(); renderAccueil();
      toast('Dépense mise à la corbeille.');
    });
}

/* ------------------------------------------------------ import CSV */
function telechargerModeleCsv() {
  telecharger('modele-chantiers.csv', '\uFEFF' + C.modeleCsv(), 'text/csv');
  toast('Modèle enregistré — remplissez-le dans un tableur.');
}
function importerCsv(file) {
  var fr = new FileReader();
  fr.onload = function () {
    var r;
    try { r = C.analyseCsv(String(fr.result)); }
    catch (e) { toast('Fichier illisible.'); return; }
    A.imp = r;
    renderImportResultat();
  };
  fr.onerror = function () { toast('Lecture impossible.'); };
  fr.readAsText(file, 'utf-8');
}
function renderImportResultat() {
  var z = $('#imp-resultat'); if (!z) return;
  var r = A.imp;
  if (!r) { z.innerHTML = ''; return; }
  if (!r.chantiers.length) {
    z.innerHTML = '<div class="carte2" style="margin-top:11px;border-color:#B4231F">' +
      '<b style="font-size:13.5px">Rien à importer</b>' +
      '<ul style="margin:6px 0 0;padding-left:18px;font-size:12.5px" class="muted">' +
      r.erreurs.slice(0, 6).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    return;
  }
  var total = r.chantiers.reduce(function (s, c) { return s + C.montant(c); }, 0);
  z.innerHTML = '<div class="carte2" style="margin-top:11px">' +
    '<b style="font-size:13.5px">' + r.chantiers.length + ' chantier' + (r.chantiers.length > 1 ? 's' : '') +
    ' · ' + r.lignes + ' ligne' + (r.lignes > 1 ? 's' : '') + ' · ' + eur(total) + '</b>' +
    (r.erreurs.length ? '<div class="muted" style="font-size:12px;margin-top:5px;color:#B4231F">' +
      r.erreurs.length + ' ligne(s) écartée(s) :<ul style="margin:4px 0 0;padding-left:18px">' +
      r.erreurs.slice(0, 4).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') +
      (r.erreurs.length > 4 ? '<li>…</li>' : '') + '</ul></div>' : '') +
    '<div style="margin-top:9px">' + r.chantiers.slice(0, 5).map(function (c) {
      return '<div class="liste-item"><div class="li-c"><b>' + esc(C.nomChantier(c)) + ' — ' + eur(C.montant(c)) + '</b>' +
        '<small>' + esc([c.donneur, c.lignes.length + ' ligne(s)',
          C.tempsTotal(c, A.cfg) ? E.fmt(C.tempsTotal(c, A.cfg), 1) + ' j' : ''].filter(Boolean).join(' · ')) +
        '</small></div></div>';
    }).join('') + (r.chantiers.length > 5 ? '<p class="muted" style="font-size:12px">et ' + (r.chantiers.length - 5) + ' autre(s).</p>' : '') + '</div>' +
    '<div class="btn-rang" style="margin-top:10px">' +
    '<button class="btn primaire btn-min" id="imp-ok">Ajouter au carnet</button>' +
    '<button class="btn btn-min" id="imp-annuler">Annuler</button></div></div>';
}
function validerImport() {
  var r = A.imp; if (!r || !r.chantiers.length) return;
  r.chantiers.forEach(function (c) {
    c.id = uid(); c.cree = Date.now(); c.maj = Date.now();
    noterClient(c.donneur); noterProprio(c.proprietaire);
    A.chantiers.push(c);
  });
  var n = r.chantiers.length;
  A.imp = null;
  sauverChantiers().then(function () {
    renderImportResultat(); renderCarnet(); renderRendements(); renderFinances(); renderAccueil();
    toast(n + ' chantier' + (n > 1 ? 's importés' : ' importé') + '.');
  });
}


