/* ===================================================== ANALYSES */
/* Trois lettres et non l'initiale : « J F M A M J J A S O N D » offre trois
   J et trois M identiques, et il faut compter sur ses doigts pour savoir
   quel mois on regarde. */
var MOIS_ABBR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin',
  'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

/* Histogramme mensuel, une ou deux séries, en SVG : rien à charger, ça
   marche hors ligne et ça s'imprime. */
/* Un montant en trois caractères pour une graduation : « 12 k€ » plutôt que
   « 12 340 € », qui déborderait et qu'on ne lit pas de toute façon. */
function eurCourt(v) {
  var n = C.nb(v);
  if (n === 0) return '0';
  if (Math.abs(n) >= 1000) return E.fmt(C.arr(n / 1000, 1), n % 1000 ? 1 : 0) + ' k€';
  return E.fmt(Math.round(n), 0) + ' €';
}
/* Le haut de l'échelle, arrondi au cran supérieur : 13 574 devient 15 000,
   ce qui donne une moitié à 7 500 plutôt qu'à 6 787. */
function paliersJoli(max) {
  if (!(max > 0)) return 1;
  var p = Math.pow(10, Math.floor(Math.log(max) / Math.LN10));
  var r = max / p;
  var cran = r <= 1 ? 1 : r <= 1.5 ? 1.5 : r <= 2 ? 2 : r <= 3 ? 3 : r <= 5 ? 5 : 10;
  return cran * p;
}
function histoMois(series, options) {
  var o = options || {};
  var toutes = series.reduce(function (a, s) { return a.concat(s.valeurs); }, []);
  var max = Math.max.apply(null, toutes.concat([0]));
  if (max <= 0) return '<p class="muted" style="font-size:12.5px">Aucun mouvement sur cette année.</p>';
  /* Une hauteur sans graduation ne se lit pas : on ne sait pas si la barre
     vaut cent euros ou dix mille. Trois repères suffisent — zéro, la moitié,
     le haut — arrondis à un chiffre rond pour qu'ils tombent juste. */
  var H = 140, padB = 16, padT = 8, padL = 34;
  var W = 320 + padL;
  var haut = paliersJoli(max);
  var lm = (W - padL) / 12, n = series.length;
  var lb = Math.min(9, (lm - 4) / n);
  var yDe = function (v) { return H - padB - (v / haut) * (H - padB - padT); };

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:460px">';
  [0, haut / 2, haut].forEach(function (v) {
    var y = yDe(v);
    svg += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) +
      '" stroke="var(--trait)" stroke-width="1"' + (v > 0 ? ' stroke-dasharray="2 3"' : '') + '/>' +
      '<text x="' + (padL - 4) + '" y="' + (y + 3).toFixed(1) +
      '" font-size="8.5" text-anchor="end" fill="var(--doux)">' + xmlEsc(eurCourt(v)) + '</text>';
  });
  for (var m = 0; m < 12; m++) {
    series.forEach(function (s, i) {
      var v = s.valeurs[m] || 0;
      if (v <= 0) return;
      var y = yDe(v);
      var x = padL + m * lm + (lm - n * lb) / 2 + i * lb;
      svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' +
        (lb - 1).toFixed(1) + '" height="' + (H - padB - y).toFixed(1) +
        '" rx="1.5" fill="' + s.couleur + '">' +
        '<title>' + xmlEsc(MOIS_NOMS[m] + ' : ' + eur(v)) + '</title></rect>';
    });
    svg += '<text x="' + (padL + m * lm + lm / 2).toFixed(1) + '" y="' + (H - 4) +
      '" font-size="7.5" text-anchor="middle" fill="var(--doux)">' + MOIS_ABBR[m] + '</text>';
  }
  svg += '</svg>';
  var leg = '<div class="legende" style="margin-top:5px">' + series.map(function (s) {
    return '<span><i style="background:' + s.couleur + '"></i>' + esc(s.nom) + '</span>';
  }).join('') + '</div>';
  return svg + leg + (o.max !== false
    ? '<p class="muted" style="font-size:11px;margin:3px 0 0">Plus haut mois : ' + eur(max) + '</p>' : '');
}

/* Barres horizontales pour une répartition : plus lisible qu'un camembert
   quand les libellés sont longs. */
function barres(lignes, couleur) {
  if (!lignes.length) return '<p class="muted" style="font-size:12.5px">Rien à afficher.</p>';
  var max = Math.max.apply(null, lignes.map(function (l) { return l.valeur; }).concat([0]));
  return lignes.map(function (l) {
    var pc = max > 0 ? Math.round(l.valeur / max * 100) : 0;
    return '<div style="margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">' +
      '<span>' + esc(l.nom) + (l.detail ? ' <span class="muted" style="font-size:11.5px">' + esc(l.detail) + '</span>' : '') + '</span>' +
      '<span class="num">' + eur(l.valeur) + (l.part != null ? ' <span class="muted" style="font-size:11.5px">' + l.part + ' %</span>' : '') + '</span></div>' +
      '<div style="height:7px;background:var(--trait);border-radius:4px;overflow:hidden">' +
      '<i style="display:block;height:100%;width:' + pc + '%;background:' + (l.couleur || couleur || '#2E4A3C') + '"></i></div></div>';
  }).join('');
}

function anneeAnalyse() {
  periodeCourante();
  return A.periode.annee;
}

function renderAnalyses() {
  var z = $('#ana-corps'); if (!z) return;
  var an = anneeAnalyse(), b = periodeCourante();
  renderSelecteursPeriode();
  var vue = A.vueAna || 'ensemble';
  $$('#ana-onglets .chip').forEach(function (x) {
    x.setAttribute('aria-pressed', String(x.dataset.ana === vue));
  });
  if (vue === 'recettes') z.innerHTML = htmlRecettes(an, b);
  else if (vue === 'depenses') z.innerHTML = htmlDepenses(an, b);
  else if (vue === 'declarations') z.innerHTML = htmlDeclarations();
  else z.innerHTML = htmlEnsemble(an, b);
}

function htmlEnsemble(an, b) {
  var ca = FIN.chiffreAffaires(A.chantiers, b);
  var dep = FIN.totalDepenses(A.depenses, b);
  var res = FIN.resultat(A.chantiers, A.depenses, b);
  var charges = FIN.totalChargesAnnuel(A.charges);
  var sim = FIN.simulation(A.chantiers, b, A.cfg);
  var km = C.kmTotal(A.chantiers, b.debut, b.fin);
  var mgFourn = ST.margeGlobale(A.articles, A.chantiers, C.montantLigne, function (ch) {
    return ['facture', 'paye'].indexOf(ch.statut) >= 0 && FIN.dansPeriode(FIN.dateRecette(ch), b);
  });

  return '<div class="carte"><h2>Vue d’ensemble — ' + esc(libellePeriode()) + '</h2>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(ca.total) + '</b><small>facturé HT</small></div>' +
    '<div class="carte2"><b class="num">' + eur(dep.ht) + '</b><small>acheté HT</small></div>' +
    '<div class="carte2" style="border-color:' + (res.marge >= 0 ? '#2E7D46' : '#B4231F') + '">' +
    '<b class="num">' + eur(res.marge) + '</b><small>différence</small></div>' +
    '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:10px 0 0">La différence n’est pas votre revenu : ' +
    'elle ignore les cotisations, l’impôt et le fait qu’une immobilisation se consomme sur plusieurs années.</p>' +
    '</div>' +

    '<div class="carte"><h2>Mois par mois <span class="muted" style="font-weight:400;' +
    'font-size:13px">— facturé et acheté, ' + an + '</span></h2>' +
    histoMois([
      { nom: 'facturé HT', valeurs: FIN.recettesParMois(A.chantiers, an), couleur: '#2E4A3C' },
      { nom: 'acheté HT', valeurs: FIN.depensesParMois(A.depenses, an), couleur: '#C4611B' }
    ]) + '</div>' +

    '<div class="carte"><h2>Ce qui rapporte</h2>' +
    barres(FIN.parPrestation(A.chantiers, b, C.nomTravail).slice(0, 6).map(function (p) {
      return { nom: p.nom, valeur: p.ht, part: p.part,
        detail: (p.quantite && p.unite) ? E.fmt(p.quantite, 0) + ' ' + C.courtUnite(p.unite)
          : (p.n > 1 ? p.n + ' lignes' : '') };
    }), '#2E4A3C') + '</div>' +

    '<div class="carte"><h2>Où part l’argent</h2>' +
    barres(FIN.parCategorie(A.depenses, b, FIN.nomCategorie).slice(0, 7).map(function (c2) {
      return { nom: c2.nom, valeur: c2.ht, part: c2.part,
        couleur: c2.immo ? '#5B3A1E' : '#C4611B' };
    }), '#C4611B') +
    (charges ? '<p class="muted" style="font-size:12px;margin:10px 0 0">Plus ' + eur(charges) +
      ' de charges fixes par an (prêts, assurances, abonnements).</p>' : '') + '</div>' +

    (mgFourn.vendu ? '<div class="carte"><h2>Marge sur fournitures</h2><div class="kpi">' +
      '<div class="carte2"><b class="num">' + eur(mgFourn.vendu) + '</b><small>refacturé</small></div>' +
      '<div class="carte2"><b class="num">' + eur(mgFourn.cout) + '</b><small>coût du stock</small></div>' +
      '<div class="carte2"><b class="num">' + eur(mgFourn.marge) + '</b><small>marge' +
      (mgFourn.taux != null ? ' · ' + mgFourn.taux + ' %' : '') + '</small></div></div></div>' : '') +

    (km ? '<div class="carte"><h2>Déplacements</h2><div class="kpi">' +
      '<div class="carte2"><b class="num">' + E.fmt(km, 0) + '</b><small>km</small></div>' +
      '<div class="carte2"><b class="num">' + eur(C.coutCarburant(km, A.cfg)) + '</b><small>carburant estimé</small></div>' +
      '</div></div>' : '') +

    htmlSimulation(sim);
}

function htmlSimulation(sim) {
  var pose = sim.tauxCotisations || sim.tauxImpot;
  return '<div class="carte"><h2>Cotisations et impôt</h2>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="sim-cot">Taux de cotisations (%)</label>' +
    '<input type="text" id="sim-cot" inputmode="decimal" value="' +
    (A.cfg && A.cfg.tauxCotisations != null ? String(A.cfg.tauxCotisations).replace('.', ',') : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="sim-imp">Taux d’impôt (%)</label>' +
    '<input type="text" id="sim-imp" inputmode="decimal" value="' +
    (A.cfg && A.cfg.tauxImpot != null ? String(A.cfg.tauxImpot).replace('.', ',') : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="sim-base">Appliqués sur</label>' +
    '<select id="sim-base">' +
    '<option value="abattu"' + ((A.cfg && A.cfg.baseCotisations) === 'brut' ? '' : ' selected') + '>le montant après abattement</option>' +
    '<option value="brut"' + ((A.cfg && A.cfg.baseCotisations) === 'brut' ? ' selected' : '') + '>le chiffre d’affaires brut</option>' +
    '</select></div></div>' +
    (pose ? '<div class="kpi" style="margin-top:11px">' +
      '<div class="carte2"><b class="num">' + eur(sim.baseCotisations) + '</b><small>base retenue</small></div>' +
      (sim.cotisations ? '<div class="carte2"><b class="num">' + eur(sim.cotisations) + '</b><small>cotisations</small></div>' : '') +
      (sim.impot ? '<div class="carte2"><b class="num">' + eur(sim.impot) + '</b><small>impôt</small></div>' : '') +
      '<div class="carte2"><b class="num">' + eur(sim.reste) + '</b><small>reste du CA</small></div>' +
      '</div>'
      : '<p class="muted" style="font-size:12.5px;margin:11px 0 0">Saisissez vos taux pour obtenir une estimation.</p>') +
    '<p class="muted" style="font-size:11.5px;margin:10px 0 0">Estimation avec vos propres taux : ' +
    'Sylve n’en connaît aucun et ne remplace ni la MSA ni votre comptable.</p></div>';
}

/* La déclaration se prépare ici : le chiffre de la période, la TVA de
   l'année, l'estimation des cotisations et de l'impôt, et le suivi de ce qui
   a été payé. Ces chiffres existaient, éparpillés sur trois écrans — le jour
   de la déclaration, il les recopiait de tête. Base retenue : le chiffre
   d'affaires FACTURÉ, à sa demande expresse — le micro-BIC se déclare
   normalement sur l'encaissé, il le sait, c'est son choix. */
var TYPES_VERSEMENT = [
  { c: 'cotisations', n: 'Cotisations sociales' },
  { c: 'impot', n: 'Impôt sur le revenu' },
  { c: 'tva', n: 'TVA' },
  { c: 'cfe', n: 'CFE' },
  { c: 'autre', n: 'Autre' }
];
function nomVersement(code) {
  var x = TYPES_VERSEMENT.filter(function (t) { return t.c === code; })[0];
  return x ? x.n : (code || '');
}
function htmlDeclarations() {
  /* Un seul sélecteur de période, celui du haut : Analyses en portait déjà un,
     et j'en avais ajouté un second ici. Le projet avait pourtant corrigé
     exactement ça en fusionnant Analyses et Finances, qui écrivaient tous les
     deux dans A.periode. Chaque bloc dit en titre la fenêtre qu'il regarde —
     la déclaration suit la période choisie, la TVA et l'estimation raisonnent
     sur l'année, parce que c'est ainsi qu'elles se déclarent. */
  periodeCourante();
  var p = A.periode;
  var bDecl = FIN.bornes(p.type, p.annee, p.indice);
  var ca = FIN.chiffreAffaires(A.chantiers, bDecl);

  var h = '<div class="carte"><h2>La déclaration — ' + esc(libellePeriode()) + '</h2>' +
    '<p class="muted" style="font-size:12px;margin:0 0 10px">Le chiffre d’affaires ' +
    '<b>facturé</b> sur la période choisie en haut, hors débours : brut pour la ' +
    'déclaration, puis après l’abattement forfaitaire, pour savoir sur quoi portent ' +
    'cotisations et impôt.</p>' +
    '<div style="margin-top:4px">' +
    ligneCA('Prestations de services', ca.prestation, ca.prestationApres, '50 %') +
    ligneCA('Ventes de fournitures', ca.vente, ca.venteApres, '71 %') +
    '<div style="display:flex;justify-content:space-between;padding-top:9px;margin-top:5px;border-top:2px solid var(--encre)">' +
    '<b>À déclarer</b><b class="num" style="font-size:18px">' + eur(ca.total) + '</b></div>' +
    (ca.debours ? '<p class="muted" style="font-size:11.5px;margin:6px 0 0">Le débours (' +
      eur(ca.debours) + ') est déjà écarté.</p>' : '') +
    '</div></div>';

  var an = p.annee;
  var bAn = FIN.bornes('annee', an);
  var bal = FIN.balanceTva(A.chantiers, A.depenses, bAn, C.tauxLigne);
  var taux = Object.keys(bal.collectee.parTaux).sort(function (x, y) { return Number(x) - Number(y); });
  var ligneT = function (nom, montant) {
    return '<div style="display:flex;justify-content:space-between;font-size:13.5px;padding:3px 0">' +
      '<span>' + nom + '</span><span class="num">' + montant + '</span></div>';
  };
  h += '<div class="carte"><h2>TVA — année ' + an + '</h2>' +
    '<p class="muted" style="font-size:12px;margin:0 0 8px">Sur l’année entière, quelle que ' +
    'soit la période choisie en haut : c’est ainsi qu’elle se déclare.</p>' +
    (taux.length ? taux.map(function (tx) {
      return ligneT('Collectée à ' + esc(String(tx).replace('.', ',')) + ' %', eur(bal.collectee.parTaux[tx]));
    }).join('') : '<p class="muted" style="font-size:12.5px;margin:0 0 3px">Rien de facturé sur ' + an + '.</p>') +
    ligneT('Déductible sur vos achats', '− ' + eur(bal.deductible.total)) +
    '<div style="display:flex;justify-content:space-between;padding-top:9px;margin-top:5px;border-top:2px solid var(--encre)">' +
    '<b>' + (bal.sens === 'a_recuperer' ? 'À récupérer' : 'À reverser') + '</b>' +
    '<b class="num" style="font-size:18px">' + eur(bal.montant) + '</b></div>' +
    '<p class="muted" style="font-size:11.5px;margin:9px 0 0">Vous la collectez pour l’État : ' +
    'ce n’est pas une charge, vous la reversez ou vous la récupérez.</p></div>';

  var caAn = FIN.chiffreAffaires(A.chantiers, bAn);
  var tCot = FIN.nb(A.cfg.tauxCotisations);
  /* La base était figée sur l'après-abattement, alors que simulation() la
     laisse choisir depuis toujours. Un taux de cotisation s'applique tantôt au
     brut, tantôt à la base abattue selon le régime : cacher laquelle est
     retenue, c'est lui faire lire un nombre dont il ignore l'assiette. */
  var brut = A.cfg.baseCotisations === 'brut';
  var baseCot = brut ? caAn.total : caAn.totalApres;
  var imp = FIN.impotEstime(caAn.totalApres, A.cfg);
  var cot = FIN.arr(baseCot * tCot / 100, 2);
  var virg = function (x) { return esc(String(x).replace('.', ',')); };
  var vlCoche = A.cfg.vlDepuis != null && A.cfg.vlDepuis !== '';
  var vlTaux = FIN.versementLiberatoire(caAn, A.cfg);
  var vl = FIN.vlApplicable(A.cfg, an) ? vlTaux : null;
  var impTotal = vl ? vl.total : imp.total;
  h += '<div class="carte"><h2>Cotisations et impôt — année ' + an + '</h2>' +
    '<p class="muted" style="font-size:12px;margin:0 0 10px">' +
    (vl
      ? 'Une estimation avec vos taux. En ' + an + ', l’impôt passe au versement libératoire : un ' +
        'pourcentage du chiffre d’affaires brut (' + eur(caAn.total) + '), sans abattement ni tranche.'
      : 'Une estimation avec vos taux, sur la base après abattement (' + eur(caAn.totalApres) + '). ' +
        'Si d’autres revenus du foyer consomment déjà la tranche à 0 %, cette base entre directement ' +
        'dans celle à ' + virg(imp.t1) + ' %.') +
    ' Rien d’officiel : ni la MSA, ni les impôts, ni un comptable.</p>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="decl-cot">Cotisations (%)</label>' +
    '<input type="text" id="decl-cot" inputmode="decimal" placeholder="25" value="' +
    (tCot ? String(tCot).replace('.', ',') : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="decl-base">Appliqué au</label>' +
    '<select id="decl-base">' +
    '<option value="abattu"' + (brut ? '' : ' selected') + '>montant après abattement</option>' +
    '<option value="brut"' + (brut ? ' selected' : '') + '>chiffre d’affaires brut</option>' +
    '</select></div>' +
    /* Les champs du barème restent là même au versement libératoire : ils
       servent aux années d'avant, qu'on relit en changeant d'année. */
    '<div class="champ"><label class="eyebrow" for="decl-cap">Reste dans la tranche (€)</label>' +
    '<input type="text" id="decl-cap" inputmode="decimal" placeholder="à renseigner" value="' +
    (imp.capacite != null ? imp.capacite : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="decl-t1">Taux de la tranche (%)</label>' +
    '<input type="text" id="decl-t1" inputmode="decimal" value="' + virg(imp.t1) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="decl-t2">Taux au-delà (%)</label>' +
    '<input type="text" id="decl-t2" inputmode="decimal" value="' + virg(imp.t2) + '"></div>' +
    '</div>' +
    '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;font-size:13.5px;' +
    'margin:4px 0 8px"><input type="checkbox" id="decl-vl"' + (vlCoche ? ' checked' : '') + '> ' +
    'Versement libératoire</label>' +
    (vlCoche ? '<div class="grille g3">' +
      '<div class="champ"><label class="eyebrow" for="decl-vl-an">À partir de</label>' +
      '<input type="text" id="decl-vl-an" inputmode="numeric" value="' + esc(String(A.cfg.vlDepuis)) + '"></div>' +
      '<div class="champ"><label class="eyebrow" for="decl-vl-tp">Prestations (%)</label>' +
      '<input type="text" id="decl-vl-tp" inputmode="decimal" value="' + virg(vlTaux.tauxPresta) + '"></div>' +
      '<div class="champ"><label class="eyebrow" for="decl-vl-tv">Ventes (%)</label>' +
      '<input type="text" id="decl-vl-tv" inputmode="decimal" value="' + virg(vlTaux.tauxVente) + '"></div>' +
      '</div>' : '') +
    '<div class="kpi" style="margin-top:4px">' +
    '<div class="carte2"><b class="num">' + (tCot ? eur(cot) : '—') + '</b><small>cotisations sur ' +
    eur(baseCot) + '</small></div>' +
    '<div class="carte2" id="decl-impot"><b class="num">' + (impTotal != null ? eur(impTotal) : '—') +
    '</b><small>' + (vl ? 'versement libératoire' : 'impôt estimé') + '</small></div>' +
    '<div class="carte2"><b class="num">' + eur(FIN.arr((tCot ? cot : 0) + (impTotal || 0), 2)) +
    '</b><small>ensemble</small></div></div>' +
    (vl
      ? '<p class="muted" style="font-size:11.5px;margin:9px 0 0">Dont ' + eur(vl.prestation) +
        ' sur les prestations à ' + virg(vl.tauxPresta) + ' % et ' + eur(vl.vente) +
        ' sur les ventes à ' + virg(vl.tauxVente) + ' %.</p>'
      : imp.total == null
        ? '<p class="muted" style="font-size:11.5px;margin:9px 0 0">Indiquez ce qu’il reste dans la ' +
          'tranche à ' + virg(imp.t1) + ' % : sans ce nombre, l’impôt ne s’estime pas.</p>'
        : imp.base2 ? '<p class="muted" style="font-size:11.5px;margin:9px 0 0">Dont ' + eur(imp.base1) +
          ' à ' + virg(imp.t1) + ' % et ' + eur(imp.base2) + ' à ' + virg(imp.t2) + ' %.</p>' : '') +
    '</div>';

  /* Le suivi. « Payé » était faux pour la TVA : il ne la paie pas, il la
     reverse — ou la récupère quand ses achats en portaient plus que ses
     ventes. D'où le sens, et l'année concernée, qui n'est pas toujours celle
     du mouvement : une régularisation de 2025 se règle en 2026. */
  var vs = (A.versements || []).slice().sort(function (x, y) { return (y.date || 0) - (x.date || 0); });
  var sorti = 0, rentre = 0;
  vs.forEach(function (v) {
    if (FIN.nb(v.annee || new Date(v.date).getFullYear()) !== an) return;
    if (v.sens === 'entree') rentre += FIN.nb(v.montant);
    else sorti += FIN.nb(v.montant) - FIN.nb(v.rembourse);
  });
  h += '<div class="carte"><div class="carte-titre"><h2>Versements et récupérations</h2>' +
    '<button class="btn primaire btn-min" id="decl-vers">+ Mouvement</button></div>' +
    '<p class="sous-titre-bloc">Ce qui est parti et ce qui est revenu, avec l’année que ' +
    'ça concerne — pas toujours celle du mouvement.' +
    ((sorti || rentre) ? ' Sur ' + an + ' : <b class="num">' + eur(FIN.arr(sorti, 2)) +
      '</b> versés' + (rentre ? ', <b class="num">' + eur(FIN.arr(rentre, 2)) + '</b> récupérés' : '') + '.' : '') +
    '</p>' +
    (vs.length ? vs.map(function (v) {
      var entree = v.sens === 'entree';
      var net = FIN.arr(FIN.nb(v.montant) - (entree ? 0 : FIN.nb(v.rembourse)), 2);
      var conc = FIN.nb(v.annee) || new Date(v.date).getFullYear();
      return '<div class="liste-item"><div class="li-c"><b>' + esc(nomVersement(v.type)) + ' — ' +
        (entree ? '+ ' : '− ') + eur(net) + '</b>' +
        '<small>' + (entree ? 'récupéré' : 'versé') + ' le ' +
        new Date(v.date).toLocaleDateString('fr-FR') + ' · pour ' + conc +
        (!entree && FIN.nb(v.rembourse) ? ' · ' + eur(v.montant) + ' versés, ' +
          eur(v.rembourse) + ' remboursés' : '') +
        (v.note ? ' · ' + esc(v.note) : '') + '</small></div>' +
        '<button class="btn-min" data-versmod="' + v.id + '">Modifier</button></div>';
    }).join('') : '<p class="muted" style="font-size:12.5px;margin:0">Aucun mouvement noté. C’est ici que ' +
      'se garde la trace de ce qui est parti et de ce qui est revenu : cotisations, impôt, TVA, CFE.</p>') +
    '</div>';
  return h;
}

function ouvrirVersement(id) {
  var v = id ? (A.versements || []).filter(function (x) { return x.id === id; })[0] : null;
  if (id && !v) return;
  modale(v ? 'Modifier le versement' : 'Nouveau versement',
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="vs-type">Quoi</label>' +
    '<select id="vs-type">' + TYPES_VERSEMENT.map(function (t) {
      return '<option value="' + t.c + '"' + (v && v.type === t.c ? ' selected' : '') + '>' + esc(t.n) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="vs-sens">Sens</label>' +
    '<select id="vs-sens">' +
    '<option value="sortie"' + (!v || v.sens !== 'entree' ? ' selected' : '') + '>Versé — sorti du compte</option>' +
    '<option value="entree"' + (v && v.sens === 'entree' ? ' selected' : '') + '>Récupéré — rentré</option>' +
    '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="vs-date">Le</label>' +
    '<input type="date" id="vs-date" value="' + versChamp(v ? v.date : Date.now()) + '"></div>' +
    /* L'année concernée n'est pas toujours celle du mouvement : une
       régularisation de 2025 se règle en 2026. */
    '<div class="champ"><label class="eyebrow" for="vs-annee">Concerne l’année</label>' +
    '<select id="vs-annee">' + (function () {
      var a0 = new Date().getFullYear(), l = [], sel = FIN.nb(v && v.annee) ||
        (v ? new Date(v.date).getFullYear() : a0);
      for (var y = a0 + 1; y >= a0 - 5; y--) {
        l.push('<option value="' + y + '"' + (y === sel ? ' selected' : '') + '>' + y + '</option>');
      }
      return l.join('');
    })() + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="vs-mont">Montant (€)</label>' +
    '<input type="text" id="vs-mont" class="gros" inputmode="decimal" value="' +
    (v ? esc(String(v.montant).replace('.', ',')) : '') + '"></div>' +
    '<div class="champ" id="vs-remb-champ"><label class="eyebrow" for="vs-remb">Dont remboursé (€)</label>' +
    '<input type="text" id="vs-remb" inputmode="decimal" placeholder="rien" value="' +
    (v && v.rembourse ? esc(String(v.rembourse).replace('.', ',')) : '') + '"></div></div>' +
    '<div class="champ"><label class="eyebrow" for="vs-note">Note</label>' +
    '<input type="text" id="vs-note" autocomplete="off" placeholder="régularisation, échéancier…" value="' +
    esc((v && v.note) || '') + '"></div>' +
    '<div class="btn-rang" style="margin-top:9px">' +
    '<button class="btn primaire" id="vs-ok">Enregistrer</button>' +
    (v ? '<button class="btn danger btn-min" id="vs-sup">Supprimer</button>' : '') + '</div>');
  var majSens = function () {
    var z = $('#vs-remb-champ');
    if (z) z.style.display = $('#vs-sens').value === 'entree' ? 'none' : '';
  };
  $('#vs-sens').addEventListener('change', majSens);
  majSens();
  $('#vs-ok').addEventListener('click', function () {
    var m = FIN.nb($('#vs-mont').value);
    if (!(m > 0)) { toast('Montant attendu.'); return; }
    var entree = $('#vs-sens').value === 'entree';
    var maj = { type: $('#vs-type').value, sens: entree ? 'entree' : 'sortie',
      date: versDate($('#vs-date').value) || Date.now(),
      annee: FIN.nb($('#vs-annee').value) || null, montant: m,
      rembourse: entree ? null : (FIN.nb($('#vs-remb').value) || null),
      note: $('#vs-note').value.trim() };
    if (v) { Object.keys(maj).forEach(function (k) { v[k] = maj[k]; }); }
    else { maj.id = uid(); A.versements.push(maj); }
    sauverVersements().then(function () { fermerModale(); renderAnalyses(); toast('Versement noté.'); });
  });
  if (v) {
    $('#vs-sup').addEventListener('click', function () {
      if (!confirm('Supprimer ce versement ?')) return;
      A.versements = A.versements.filter(function (x) { return x.id !== v.id; });
      sauverVersements().then(function () { fermerModale(); renderAnalyses(); toast('Versement supprimé.'); });
    });
  }
}

function htmlRecettes(an, b) {
  var ca = FIN.chiffreAffaires(A.chantiers, b);
  var pres = FIN.parPrestation(A.chantiers, b, C.nomTravail);
  var fam = FIN.parFamille(A.chantiers, b, C.categorieLigne, C.nomCategorieLigne);
  var don = FIN.caParDonneur(A.chantiers, b);
  var tr = FIN.tauxReussite(A.chantiers, C.aDevis);
  var refus = C.analyseRefus(A.chantiers);
  return '<div class="carte"><h2>Recettes — ' + esc(libellePeriode()) + '</h2>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(ca.total) + '</b><small>facturé</small></div>' +
    '<div class="carte2"><b class="num">' + eur(ca.encaisse) + '</b><small>encaissé</small></div>' +
    (ca.aEncaisser ? '<div class="carte2" style="border-color:#B98A00"><b class="num">' + eur(ca.aEncaisser) +
      '</b><small>en attente</small></div>' : '') +
    '</div>' +
    '<div style="margin-top:13px">' +
    ligneCA('Prestation de service', ca.prestation, ca.prestationApres, '50 %') +
    ligneCA('Vente de fournitures', ca.vente, ca.venteApres, '71 %') +
    '<div style="display:flex;justify-content:space-between;padding-top:9px;margin-top:5px;border-top:2px solid var(--encre)">' +
    '<b>Base après abattement</b><b class="num" style="font-size:18px">' + eur(ca.totalApres) + '</b></div>' +
    /* Le débours traverse le compte sans être une recette. Il était écarté du
       calcul depuis le début, mais affiché nulle part : il ne pouvait pas
       vérifier qu'il l'était bien. */
    (ca.debours ? '<div style="display:flex;justify-content:space-between;font-size:13px;' +
      'margin-top:9px;padding-top:9px;border-top:1px dashed var(--trait-fort)" class="muted">' +
      '<span>Débours client — hors chiffre d’affaires</span><span class="num">' +
      eur(ca.debours) + '</span></div>' : '') + '</div></div>' +

    '<div class="carte"><h2>Facturé et encaissé — ' + an + '</h2>' +
    histoMois([
      { nom: 'facturé', valeurs: FIN.recettesParMois(A.chantiers, an), couleur: '#2E4A3C' },
      { nom: 'encaissé', valeurs: FIN.encaissementsParMois(A.chantiers, an), couleur: '#2E7D46' }
    ]) + '</div>' +

    '<div class="carte"><h2>Par famille</h2>' +
    '<p class="muted" style="font-size:12px;margin:0 0 10px">Vos grandes familles : ' +
    'ce que chacune rapporte, fournitures et débours compris.</p>' +
    barres(fam.map(function (f) {
      return { nom: f.nom, valeur: f.ht, part: f.part,
        detail: f.n > 1 ? f.n + ' lignes' : '' };
    }), '#6A4A22') + '</div>' +

    '<div class="carte"><h2>Par type de travaux</h2>' +
    barres(pres.map(function (p) {
      return { nom: p.nom, valeur: p.ht, part: p.part,
        detail: (p.quantite && p.unite) ? E.fmt(p.quantite, 0) + ' ' + C.courtUnite(p.unite)
          : (p.n > 1 ? p.n + ' lignes' : '') };
    }), '#2E4A3C') + '</div>' +

    '<div class="carte"><h2>Par donneur d’ordre</h2>' +
    barres(don.map(function (x) {
      return { nom: x.donneur, valeur: x.ht, detail: x.n + ' chantier' + (x.n > 1 ? 's' : '') };
    }), '#1D6FB8') + '</div>' +

    (tr.proposes ? '<div class="carte"><h2>Devis</h2><div class="kpi">' +
      (tr.taux != null ? '<div class="carte2"><b class="num">' + tr.taux + ' %</b><small>acceptés</small></div>' : '') +
      '<div class="carte2"><b class="num">' + tr.gagnes + '</b><small>gagnés</small></div>' +
      '<div class="carte2"><b class="num">' + tr.perdus + '</b><small>sans suite</small></div>' +
      '<div class="carte2"><b class="num">' + tr.enAttente + '</b><small>en attente</small></div></div>' +
      (refus.total ? '<p class="eyebrow" style="margin:13px 0 6px">Motifs de refus</p>' +
        barres(refus.motifs.map(function (m) {
          return { nom: m.nom, valeur: m.n, part: m.part };
        }), '#B4231F').replace(/€/g, '') : '') + '</div>' : '');
}

function htmlDepenses(an, b) {
  var dep = FIN.totalDepenses(A.depenses, b);
  var cat = FIN.parCategorie(A.depenses, b, FIN.nomCategorie);
  var four = FIN.parFournisseur(A.depenses, b);
  var bal = FIN.balanceTva(A.chantiers, A.depenses, b, C.tauxLigne);
  var charges = FIN.totalChargesAnnuel(A.charges);
  return '<div class="carte"><h2>Dépenses — ' + esc(libellePeriode()) + '</h2>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(dep.ht) + '</b><small>HT</small></div>' +
    '<div class="carte2"><b class="num">' + eur(dep.courant) + '</b><small>courant</small></div>' +
    '<div class="carte2"><b class="num">' + eur(dep.immo) + '</b><small>immobilisations</small></div>' +
    '<div class="carte2"><b class="num">' + dep.n + '</b><small>achats saisis</small></div>' +
    '</div>' +
    (dep.immo ? '<p class="muted" style="font-size:11.5px;margin:10px 0 0">Les immobilisations pèsent ' +
      Math.round(dep.immo / (dep.ht || 1) * 100) + ' % de vos achats : un investissement fausse la lecture ' +
      'd’une année s’il est compté comme une dépense courante.</p>' : '') + '</div>' +

    '<div class="carte"><h2>Mois par mois <span class="muted" style="font-weight:400;' +
    'font-size:13px">— acheté, ' + an + '</span></h2>' +
    histoMois([{ nom: 'acheté HT', valeurs: FIN.depensesParMois(A.depenses, an), couleur: '#C4611B' }]) + '</div>' +

    /* La TVA payée sur les achats est celle qui se récupère : elle a sa place
       ici, à côté de ce qu'on a acheté, et pas seulement dans la balance
       générale. L'immobilisation est isolée — elle pèse lourd un trimestre et
       fausse la lecture si on la noie dans le reste. */
    '<div class="carte"><h2>TVA payée sur ces achats</h2><div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(bal.deductible.total) + '</b><small>déductible</small></div>' +
    '<div class="carte2"><b class="num">' + eur(bal.deductible.courant) + '</b><small>sur le courant</small></div>' +
    '<div class="carte2"><b class="num">' + eur(bal.deductible.immobilisations) +
    '</b><small>sur les immobilisations</small></div>' +
    '</div>' +
    (Object.keys(bal.deductible.parTaux || {}).length > 1
      ? '<p class="muted" style="font-size:12px;margin:10px 0 0">Par taux : ' +
        Object.keys(bal.deductible.parTaux).sort(function (x, y) { return y - x; })
          .map(function (tx) {
            return String(tx).replace('.', ',') + ' % → ' + eur(bal.deductible.parTaux[tx]);
          }).join(' · ') + '</p>'
      : '') + '</div>' +

    '<div class="carte"><h2>Par catégorie</h2>' +
    barres(cat.map(function (c2) {
      return { nom: c2.nom, valeur: c2.ht, part: c2.part, detail: c2.n + ' ligne' + (c2.n > 1 ? 's' : ''),
        couleur: c2.immo ? '#5B3A1E' : '#C4611B' };
    }), '#C4611B') + '</div>' +

    '<div class="carte"><h2>Par fournisseur</h2>' +
    barres(four.slice(0, 8).map(function (f) {
      return { nom: f.fournisseur, valeur: f.ht, detail: f.n + ' achat' + (f.n > 1 ? 's' : '') };
    }), '#7A8471') + '</div>' +

    /* Les barres portent le coût annuel : le titre doit le dire, et le détail
       rappeler le montant réellement prélevé. « 2 280 € · tous les mois » se
       lisait comme une mensualité de 2 280 €. */
    (charges ? '<div class="carte"><h2>Charges fixes <span class="muted" ' +
      'style="font-weight:400;font-size:13px">— coût annuel</span></h2>' +
      barres(A.charges.filter(function (c2) { return !c2.arretee; })
        .map(function (c2) {
          return { nom: c2.libelle || '', valeur: FIN.coutAnnuel(c2),
            detail: eur(C.nb(c2.ttc)) + ' ' + FIN.nomPeriodicite(c2.periodicite).toLowerCase() };
        }).sort(function (x, y) { return y.valeur - x.valeur; }), '#5B3A1E') +
      '<p class="muted" style="font-size:12px;margin:9px 0 0">' + eur(charges) + ' par an, soit ' +
      eur(FIN.arr(charges / 12, 2)) + ' par mois.</p></div>' : '') +

    '<div class="carte"><h2>TVA</h2><div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(bal.collectee.total) + '</b><small>collectée</small></div>' +
    '<div class="carte2"><b class="num">' + eur(bal.deductible.total) + '</b><small>déductible</small></div>' +
    '<div class="carte2" style="border-color:' + (bal.sens === 'a_payer' ? '#B4231F' : '#2E7D46') + '">' +
    '<b class="num">' + eur(bal.montant) + '</b><small>' +
    (bal.sens === 'a_payer' ? 'à reverser' : (bal.sens === 'a_recuperer' ? 'à récupérer' : 'équilibre')) +
    '</small></div></div></div>';
}

