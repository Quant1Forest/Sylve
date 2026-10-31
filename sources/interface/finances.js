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
function renderSelecteursPeriode() {
  periodeCourante();          // garantit que A.periode existe
  var p = A.periode;
  majSelecteurs('#an-type', '#an-indice', '#an-annee', p);
  if (!$('#fi-type')) return;
  $('#fi-type').value = p.type;
  var ans = {}, now = new Date().getFullYear();
  ans[now] = 1; ans[now - 1] = 1;
  A.chantiers.forEach(function (c) { var d = FIN.dateRecette(c); if (d) ans[new Date(d).getFullYear()] = 1; });
  A.depenses.forEach(function (d) { if (d.date) ans[new Date(d.date).getFullYear()] = 1; });
  var listeAns = Object.keys(ans).map(Number).sort(function (a, b) { return b - a; });
  $('#fi-annee').innerHTML = listeAns.map(function (a) {
    return '<option value="' + a + '"' + (a === p.annee ? ' selected' : '') + '>' + a + '</option>';
  }).join('');
  var opts = [];
  if (p.type === 'trimestre') opts = [0, 1, 2, 3].map(function (i) { return [i, 'T' + (i + 1)]; });
  else if (p.type === 'mois') opts = MOIS_NOMS.map(function (m, i) { return [i, m]; });
  $('#fi-indice').innerHTML = opts.length
    ? opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === p.indice ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
    : '<option value="0">année entière</option>';
  $('#fi-indice').disabled = !opts.length;
}
/* Les analyses ont leurs propres sélecteurs, alimentés de la même façon. */
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

/* ----------------------------------------------------------- finances */
function renderFinances() {
  var z = $('#fi-corps'); if (!z) return;
  renderSelecteursPeriode();
  var b = periodeCourante();
  var ca = FIN.chiffreAffaires(A.chantiers, b);
  var bal = FIN.balanceTva(A.chantiers, A.depenses, b, C.tauxLigne);
  var dep = FIN.totalDepenses(A.depenses, b);
  var res = FIN.resultat(A.chantiers, A.depenses, b);
  var tr = FIN.tauxReussite(A.chantiers, C.aDevis);

  var tauxCol = Object.keys(bal.collectee.parTaux).sort();
  var tauxDed = Object.keys(bal.deductible.parTaux).sort();

  z.innerHTML =
    '<div class="carte"><h2>Chiffre d’affaires — ' + esc(libellePeriode()) + '</h2>' +
    (ca.total ? '<div class="kpi">' +
      '<div class="carte2"><b class="num">' + eur(ca.total) + '</b><small>facturé (HT)</small></div>' +
      '<div class="carte2"><b class="num">' + eur(ca.encaisse) + '</b><small>encaissé</small></div>' +
      (ca.aEncaisser ? '<div class="carte2"><b class="num">' + eur(ca.aEncaisser) + '</b><small>en attente</small></div>' : '') +
      '</div>' +
      '<div style="margin-top:13px">' +
      ligneCA('Prestation de service', ca.prestation, ca.prestationApres, '50 %') +
      ligneCA('Vente de fournitures', ca.vente, ca.venteApres, '71 %') +
      '<div style="display:flex;justify-content:space-between;padding-top:9px;margin-top:5px;border-top:2px solid var(--encre)">' +
      '<b>Base après abattement</b><b class="num" style="font-size:18px">' + eur(ca.totalApres) + '</b></div></div>' +
      '<p class="muted" style="font-size:11.5px;margin:10px 0 0">Abattements du micro-BIC. ' +
      'Ce calcul prépare la déclaration, il ne la remplace pas.</p>'
      : '<div class="vide"><p>Aucune facture sur cette période.</p></div>') +
    '</div>' +

    '<div class="carte"><h2>Balance de TVA</h2>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(bal.collectee.total) + '</b><small>collectée</small></div>' +
    '<div class="carte2"><b class="num">' + eur(bal.deductible.total) + '</b><small>déductible</small></div>' +
    '<div class="carte2" style="border-color:' + (bal.sens === 'a_payer' ? '#B4231F' : '#2E7D46') + '">' +
    '<b class="num">' + eur(bal.montant) + '</b><small>' +
    (bal.sens === 'a_payer' ? 'à reverser' : (bal.sens === 'a_recuperer' ? 'à récupérer' : 'équilibre')) + '</small></div>' +
    '</div>' +
    (tauxCol.length ? '<p class="muted" style="font-size:12px;margin:11px 0 3px">Collectée : ' +
      tauxCol.map(function (t) { return eur(bal.collectee.parTaux[t]) + ' à ' + t + ' %'; }).join(' · ') + '</p>' : '') +
    (tauxDed.length ? '<p class="muted" style="font-size:12px;margin:0">Déductible : ' +
      tauxDed.map(function (t) { return eur(bal.deductible.parTaux[t]) + ' à ' + t + ' %'; }).join(' · ') + '</p>' : '') +
    (bal.deductible.immobilisations ? '<p class="muted" style="font-size:12px;margin:6px 0 0">' +
      'Dont ' + eur(bal.deductible.immobilisations) + ' sur immobilisations — un achat exceptionnel ' +
      'gonfle la TVA déductible d’un seul trimestre.</p>' : '') +
    '</div>' +

    '<div class="carte"><h2>Dépenses et marge</h2>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(dep.ht) + '</b><small>achats HT</small></div>' +
    '<div class="carte2"><b class="num">' + eur(dep.courant) + '</b><small>courants</small></div>' +
    '<div class="carte2"><b class="num">' + eur(dep.immo) + '</b><small>immobilisations</small></div>' +
    '<div class="carte2" style="border-color:' + (res.marge >= 0 ? '#2E7D46' : '#B4231F') + '">' +
    '<b class="num">' + eur(res.marge) + '</b><small>recettes − achats</small></div>' +
    '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:10px 0 0">Marge réelle, à ne pas confondre avec ' +
    'la base imposable ci-dessus : au micro-BIC, c’est l’abattement forfaitaire qui compte, pas vos achats.</p>' +
    '</div>' +

    (function () {
      var km = C.kmTotal(A.chantiers, b.debut, b.fin);
      var refus = C.analyseRefus(A.chantiers);
      if (!km && !refus.total) return '';
      return '<div class="carte"><h2>Déplacements et devis perdus</h2>' +
        (km ? '<div class="kpi">' +
          '<div class="carte2"><b class="num">' + E.fmt(km, 0) + '</b><small>km sur ' + esc(libellePeriode()) + '</small></div>' +
          '<div class="carte2"><b class="num">' + eur(C.coutCarburant(km, A.cfg)) + '</b><small>carburant estimé</small></div>' +
          '</div><p class="muted" style="font-size:11.5px;margin:9px 0 0">Estimation d’après ' +
          ((A.cfg && A.cfg.litres100) || 9) + ' L/100 km à ' + eur((A.cfg && A.cfg.prixLitre) || 1.75) +
          ' le litre, réglable.</p>' : '') +
        (refus.total ? '<p class="eyebrow" style="margin:14px 0 6px">Pourquoi les devis n’aboutissent pas</p>' +
          refus.motifs.map(function (m) {
            return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px">' +
              '<span>' + esc(m.nom) + '</span><span class="muted">' + m.n + ' · ' + m.part + ' %</span></div>';
          }).join('') : '') + '</div>';
    })() +
    (function () {
      var pd = FIN.caParDonneur(A.chantiers, b);
      var pg = C.parDonneur(A.chantiers, A.cfg).filter(function (x) { return x.n > 0; });
      if (!pd.length && !pg.length) return '';
      var totalD = pd.reduce(function (s, x) { return s + x.ht; }, 0);
      return '<div class="carte"><h2>Par donneur d’ordre</h2>' +
        (pd.length ? pd.map(function (x) {
          return '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--trait)">' +
            '<span>' + esc(x.donneur) + ' <span class="muted" style="font-size:11.5px">' + x.n +
            ' chantier' + (x.n > 1 ? 's' : '') + '</span></span>' +
            '<span><b class="num">' + eur(x.ht) + '</b>' +
            '<span class="muted" style="font-size:11.5px"> · ' + FIN.arr(totalD ? x.ht / totalD * 100 : 0, 0) + ' %</span></span></div>';
        }).join('') : '<p class="muted" style="font-size:12.5px">Aucune facture sur la période.</p>') +
        '<p class="eyebrow" style="margin:14px 0 6px">Tous chantiers confondus</p>' +
        pg.slice(0, 6).map(function (x) {
          /* Le délai de règlement se lit ici, à côté de ce que le client
             apporte : c'est le même jugement — celui qui paie vite et celui
             qui fait attendre ne se valent pas à chiffre égal. La médiane,
             pas la moyenne : un seul règlement oublié six mois donnerait une
             réputation imméritée. */
          /* Quatre informations et un nom sur une seule ligne : sur un
             téléphone, la ligne se cassait en deux et l'ensemble se
             disloquait. Le nom au-dessus, son détail en dessous — la même
             disposition que partout ailleurs dans l'application. */
          return '<div style="padding:6px 0;border-bottom:1px solid var(--trait)">' +
            '<div style="font-size:13.5px">' + esc(x.donneur) +
            (x.enRetard ? ' <span class="retard">' + x.enRetard + ' en retard</span>' : '') + '</div>' +
            '<div class="muted" style="font-size:12px;margin-top:1px">' + eur(x.signe) + ' signés' +
            (x.propose ? ' · ' + eur(x.propose) + ' proposés' : '') +
            (x.taux != null ? ' · ' + x.taux + ' % acceptés' : '') +
            (x.delaiMedian != null ? ' · payé en ' + x.delaiMedian + ' j' +
              (x.delaiPire > x.delaiMedian ? ' (jusqu’à ' + x.delaiPire + ')' : '') : '') +
            '</div></div>';
        }).join('') + '</div>';
    })() +
    (tr.proposes ? '<div class="carte"><h2>Devis</h2><div class="kpi">' +
      (tr.taux != null ? '<div class="carte2"><b class="num">' + tr.taux + ' %</b><small>acceptés</small></div>' : '') +
      '<div class="carte2"><b class="num">' + tr.gagnes + '</b><small>gagnés</small></div>' +
      '<div class="carte2"><b class="num">' + tr.perdus + '</b><small>sans suite</small></div>' +
      '<div class="carte2"><b class="num">' + tr.enAttente + '</b><small>en attente</small></div>' +
      '</div><p class="muted" style="font-size:11.5px;margin:10px 0 0">Taux calculé sur les devis tranchés ' +
      '(les devis en attente n’entrent pas dans le calcul).</p></div>' : '');
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

/* ----------------------------------------------------------- dépenses */
function renderDepenses() {
  var z = $('#liste-depenses'); if (!z) return;
  var b = periodeCourante();
  var t = FIN.totalDepenses(A.depenses, b);
  if ($('#dep-totaux')) {
    $('#dep-totaux').innerHTML = A.depenses.length
      ? '<div class="kpi">' +
        '<div class="carte2"><b class="num">' + eur(t.ttc) + '</b><small>TTC sur ' + esc(libellePeriode()) + '</small></div>' +
        '<div class="carte2"><b class="num">' + eur(t.ht) + '</b><small>HT</small></div>' +
        '<div class="carte2"><b class="num">' + eur(t.tva) + '</b><small>TVA déductible</small></div>' +
        '<div class="carte2"><b class="num">' + t.n + '</b><small>achats saisis</small></div></div>' +
        '<p class="muted" style="font-size:12px;margin:10px 0 0">La période se choisit dans Finances.</p>'
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
  z.innerHTML = l.length ? l.map(function (d) {
    var immo = FIN.lignesDepense(d).some(function (l) { return FIN.estImmo(l.categorie); });
    var vign = '<span class="pastille" style="background:' + (immo ? '#5B3A1E' : '#7A8471') + ';margin-top:3px"></span>';
    return '<div class="liste-item pile-c"><div class="li-h">' + vign +
      (function () {
        var lg = FIN.lignesDepense(d);
        var titre = lg.length > 1
          ? (d.fournisseur || 'Ticket') + ' — ' + lg.length + ' lignes'
          : (lg[0].libelle || FIN.nomCategorie(lg[0].categorie));
        var cats = lg.map(function (l) { return FIN.nomCategorie(l.categorie); })
          .filter(function (v, i, t) { return t.indexOf(v) === i; });
        return '<div class="li-c"><b>' + esc(titre) + ' — ' + eur(FIN.ttcDe(d)) + '</b>' +
          '<small>' + dateCourte(d.date) + ' · ' + esc(cats.join(', ')) +
          (lg.length === 1 && d.fournisseur ? ' · ' + esc(d.fournisseur) : '') +
          ' · HT ' + eur(FIN.htDe(d)) + (FIN.tvaDe(d) ? ' · TVA ' + eur(FIN.tvaDe(d)) : ' · sans TVA') +
          (lg.some(function (l) { return FIN.estImmo(l.categorie); }) ? ' · immobilisation' : '') +
          /* Une dépense née d'une charge fixe se corrige sur la charge, pas
             ici : la retoucher se perdrait à la prochaine synchronisation. */
          (d.auto ? ' · <i>suit une charge fixe</i>' : '') +
          '</small></div></div>';
      })() +
      '<div class="li-actions">' +
      '<button class="btn-min" data-depmod="' + d.id + '">' +
      (d.auto ? 'La charge' : 'Modifier') + '</button>' +
      (d.auto ? '' : '<button class="btn-min" data-depsup="' + d.id + '">Supprimer</button>') +
      '</div></div>';
  }).join('') : '<div class="vide"><p>Aucune dépense sur ' + esc(libellePeriode()) + '.</p></div>';
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
    '<button class="btn primaire" id="dp-ok">Enregistrer</button></div>');

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
      renderCarnetV(); renderEcheancesV(); renderCoutsV(); renderEntreprise();
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


