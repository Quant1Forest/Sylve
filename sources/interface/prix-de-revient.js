/* --------------------------------------------------- prix de revient */
/* ------------------------------------------------------- graphiques
   Tout est dessiné en SVG à la main : aucune bibliothèque à charger, donc
   rien à télécharger en forêt. */

/* Anneau de répartition. Un camembert percé se lit mieux qu'un plein :
   le centre porte le chiffre qui compte. */
function anneau(parts, options) {
  var o = options || {};
  var vus = parts.filter(function (p) { return p.valeur > 0; });
  var tot = vus.reduce(function (s, p) { return s + p.valeur; }, 0);
  if (tot <= 0) return '';
  var R = 54, r = 33, cx = 62, cy = 62, ang = -Math.PI / 2, svg = '';
  if (vus.length === 1) {
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) +
      '" fill="none" stroke="' + vus[0].couleur + '" stroke-width="' + (R - r) + '"/>';
  } else {
    vus.forEach(function (p) {
      var a = p.valeur / tot * Math.PI * 2, b = ang + a;
      var g = a > Math.PI ? 1 : 0;
      var pt = function (ray, t) {
        return (cx + ray * Math.cos(t)).toFixed(2) + ' ' + (cy + ray * Math.sin(t)).toFixed(2);
      };
      svg += '<path d="M' + pt(R, ang) + ' A' + R + ' ' + R + ' 0 ' + g + ' 1 ' + pt(R, b) +
        ' L' + pt(r, b) + ' A' + r + ' ' + r + ' 0 ' + g + ' 0 ' + pt(r, ang) + ' Z" fill="' +
        p.couleur + '" stroke="var(--carte)" stroke-width="1"><title>' +
        xmlEsc(p.nom + ' : ' + E.fmt(p.valeur / tot * 100, 1) + ' %') + '</title></path>';
      ang = b;
    });
  }
  if (o.centre) {
    svg += '<text x="' + cx + '" y="' + (cy + (o.sous ? 0 : 4)) +
      '" font-size="15" font-weight="700" text-anchor="middle" fill="var(--encre)">' +
      xmlEsc(o.centre) + '</text>';
    if (o.sous) svg += '<text x="' + cx + '" y="' + (cy + 14) +
      '" font-size="8.5" text-anchor="middle" fill="var(--doux)">' + xmlEsc(o.sous) + '</text>';
  }
  return '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
    '<svg viewBox="0 0 124 124" width="124" height="124" style="flex:none">' + svg + '</svg>' +
    '<div style="flex:1;min-width:150px">' + vus.map(function (p) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:13px">' +
        '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' +
        p.couleur + ';margin-right:7px"></i>' + esc(p.nom) + '</span>' +
        '<span style="white-space:nowrap"><b class="num">' + esc(p.texte || E.fmt(p.valeur, 4)) + '</b>' +
        '<span class="muted" style="font-size:11.5px"> · ' + E.fmt(p.valeur / tot * 100, 1) + ' %</span></span></div>';
    }).join('') + '</div></div>';
}

/* Barres horizontales avec un repère d'objectif : on voit d'un coup qui
   passe la barre et qui reste dessous. */
/* Trois bâtons par produit, sur une même échelle en euros : le coût réel, le
   prix qu'il faudrait pour tenir l'objectif, et le prix réellement pratiqué.
   On voit d'un coup lequel passe la barre — et de combien, en euros, pas en
   pourcentage d'un pourcentage. */
/* Une couleur par part, et une queue regroupée : au-delà de six parts un
   anneau devient illisible, et les miettes ne se lisent plus. */
var COUL_PART = ['#2E4A3C', '#8A5A2B', '#B98A00', '#1D6FB8', '#7A8471', '#5B3A1E'];
function partsProduits(l) {
  var t = l.filter(function (x) { return x.valeur > 0; })
    .sort(function (a, b) { return b.valeur - a.valeur; });
  if (t.length > 6) {
    var queue = t.slice(5);
    t = t.slice(0, 5).concat([{ nom: 'autres',
      valeur: ST.arr(queue.reduce(function (s2, x) { return s2 + x.valeur; }, 0), 2) }]);
  }
  return t.map(function (x, i) {
    return { nom: x.nom, valeur: x.valeur, couleur: COUL_PART[i % COUL_PART.length],
      texte: eur(x.valeur) };
  });
}

/* Une courbe par année : on voit quand on vend, donc quand acheter. */
function courbeMois(series, o) {
  o = o || {};
  var toutes = series.reduce(function (a, x) { return a.concat(x.valeurs); }, []);
  var max = Math.max.apply(null, toutes.concat([0]));
  if (!(max > 0)) return '<p class="muted" style="font-size:12.5px">Aucune vente sur ces années.</p>';
  var haut = paliersJoli(max);
  var W = 360, H = 170, padL = 36, padB = 20, padT = 10;
  var hU = H - padB - padT, lU = W - padL - 6;
  var x = function (i) { return padL + i * (lU / 11); };
  var y = function (v) { return H - padB - (v / haut) * hU; };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:460px">';
  [0, haut / 2, haut].forEach(function (v) {
    svg += '<line x1="' + padL + '" y1="' + y(v).toFixed(1) + '" x2="' + W + '" y2="' + y(v).toFixed(1) +
      '" stroke="var(--trait)" stroke-width="1"' + (v > 0 ? ' stroke-dasharray="2 3"' : '') + '/>' +
      '<text x="' + (padL - 4) + '" y="' + (y(v) + 3).toFixed(1) +
      '" font-size="8.5" text-anchor="end" fill="var(--doux)">' + xmlEsc(eurCourt(v)) + '</text>';
  });
  series.forEach(function (se) {
    var d = se.valeurs.map(function (v, i) {
      return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
    }).join(' ');
    svg += '<path d="' + d + '" fill="none" stroke="' + se.couleur + '" stroke-width="' +
      (se.fort ? 2.4 : 1.8) + '" stroke-linejoin="round" stroke-linecap="round"/>';
    if (se.fort) {
      se.valeurs.forEach(function (v, i) {
        svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) +
          '" r="2.6" fill="' + se.couleur + '"><title>' +
          xmlEsc(MOIS_NOMS[i] + ' : ' + eur(v)) + '</title></circle>';
      });
    }
  });
  for (var m = 0; m < 12; m++) {
    svg += '<text x="' + x(m).toFixed(1) + '" y="' + (H - 6) +
      '" font-size="8" text-anchor="middle" fill="var(--doux)">' + MOIS_ABBR[m].charAt(0).toUpperCase() +
      '</text>';
  }
  svg += '</svg>';
  return svg + '<div class="legende" style="margin-top:5px">' + series.map(function (se) {
    return '<span><i style="background:' + se.couleur + '"></i>' + esc(se.nom) + '</span>';
  }).join('') + '</div>';
}

function batonsPrix(lignes, cible) {
  if (!lignes.length) return '<p class="muted" style="font-size:12.5px">Aucune vente.</p>';
  var max = Math.max.apply(null, lignes.map(function (l) {
    return Math.max(l.cout, l.mini, l.vendu);
  }).concat([0]));
  if (!(max > 0)) return '<p class="muted" style="font-size:12.5px">Aucune vente.</p>';
  var COUL = [['cout', '#8A5A2B', 'coût réel'],
    ['mini', '#B98A00', 'minimum à ' + E.fmt(cible, 0) + ' %'],
    ['vendu', '#2E7D46', 'prix pratiqué']];
  var corps = lignes.map(function (l) {
    var sousLaBarre = l.vendu < l.mini;
    return '<div style="margin-bottom:13px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;' +
      'font-size:13px;margin-bottom:5px"><b>' + esc(l.nom) +
      (l.unite ? ' <span class="muted" style="font-weight:400;font-size:11.5px">par ' +
        esc(l.unite) + '</span>' : '') + '</b>' +
      '<span class="num"' + (sousLaBarre ? ' style="color:#B4231F"' : '') + '>' +
      (sousLaBarre ? 'il manque ' + eur(ST.arr(l.mini - l.vendu, 3))
        : '+ ' + eur(ST.arr(l.vendu - l.mini, 3))) + '</span></div>' +
      COUL.map(function (c) {
        var v = l[c[0]], pc = Math.max(1, v / max * 100);
        return '<div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">' +
          '<span style="flex:none;width:8.5em;font-size:11px;color:var(--doux)">' + c[2] + '</span>' +
          '<span style="flex:1;height:11px;background:var(--carte2);border-radius:6px;overflow:hidden">' +
          '<i style="display:block;height:100%;width:' + pc.toFixed(1) + '%;background:' +
          c[1] + '"></i></span>' +
          '<span class="num" style="flex:none;font-size:11.5px;width:5.2em;text-align:right">' +
          E.fmt(v, v < 10 ? 3 : 2) + ' €</span></div>';
      }).join('') + '</div>';
  }).join('');
  return corps +
    '<p class="muted" style="font-size:12px;margin:2px 0 0">Le prix pratiqué doit dépasser ' +
    'le minimum : en dessous, la vente ne couvre pas l’objectif de ' + E.fmt(cible, 0) +
    ' % et vous cotisez sur une marge que vous n’avez pas faite.</p>';
}

function barresObjectif(lignes, objectif, o) {
  o = o || {};
  if (!lignes.length) return '<p class="muted" style="font-size:12.5px">Rien à afficher.</p>';
  var max = Math.max.apply(null, lignes.map(function (l) { return l.valeur; }).concat([objectif, 0]));
  if (max <= 0) return '<p class="muted" style="font-size:12.5px">Rien à afficher.</p>';
  var pcObj = objectif > 0 ? objectif / max * 100 : null;
  return '<div style="position:relative">' +
    lignes.map(function (l) {
      var pc = Math.max(0, Math.min(100, l.valeur / max * 100));
      var atteint = l.valeur >= objectif;
      return '<div style="margin-bottom:9px">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">' +
        '<span>' + esc(l.nom) + (l.detail ? ' <span class="muted" style="font-size:11.5px">' +
          esc(l.detail) + '</span>' : '') + '</span>' +
        '<span class="num"' + (atteint ? '' : ' style="color:#B4231F"') + '>' +
        esc(l.texte || E.fmt(l.valeur, 1)) + '</span></div>' +
        '<div style="height:9px;background:var(--trait);border-radius:5px;overflow:hidden">' +
        '<i style="display:block;height:100%;width:' + pc.toFixed(1) + '%;background:' +
        (atteint ? '#2E7D46' : '#C4611B') + '"></i></div></div>';
    }).join('') +
    (pcObj != null ? '<div style="position:absolute;top:0;bottom:14px;left:' + pcObj.toFixed(1) +
      '%;border-left:2px dashed var(--doux);pointer-events:none"></div>' : '') +
    '</div>' +
    (pcObj != null ? '<p class="muted" style="font-size:11.5px;margin:2px 0 0">' +
      'Trait pointillé : votre objectif de ' + esc(o.libObjectif || (E.fmt(objectif, 0) + ' %')) + '.</p>' : '');
}

/* ---------------------------------------------------- prix de revient */
function fiscStock() {
  var c = A.cfg || {};
  return {
    abattement: c.abattementVente != null ? c.abattementVente : 0.71,
    cotisations: FIN.nb(c.tauxCotisations) / 100,
    impot: FIN.nb(c.tauxImpot) / 100,
    /* La CFE est un montant annuel fixe. Rapportée au chiffre d'affaires
       d'une année type, elle donne la part qu'elle pèse sur chaque euro
       encaissé — et se recalcule seule quand l'avis change. */
    cfeTaux: (FIN.nb(c.cfeAnnuelle) > 0 && FIN.nb(c.cfeCaRef) > 0)
      ? FIN.nb(c.cfeAnnuelle) / FIN.nb(c.cfeCaRef) : 0,
    cfeUnitaire: FIN.nb(c.cfeUnitaire)
  };
}
function cibleBenefice() {
  var v = A.cfg && A.cfg.cibleBenefice;
  return v != null ? FIN.nb(v) : 10;
}
function cibleMarge() {
  var v = A.cfg && A.cfg.cibleMarge;
  return v != null ? FIN.nb(v) : 30;
}
/* Coût retenu pour un produit : moyenne du stock ou dernière commande. */
function coutRetenu(art) {
  return (A.revient && A.revient.base === 'dernier') ? ST.dernierCout(art) : ST.pmp(art);
}

function renderRevient() {
  var z = $('#rev-form'); if (!z) return;
  var r = A.revient || (A.revient = { article: null, prix: '', base: 'pmp', onglet: 'simul', mode: 'saisi' });
  if (!r.onglet) r.onglet = 'simul';
  $$('#rev-nav .chip').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.rev === r.onglet));
  });
  if (!A.articles.length) {
    z.innerHTML = '<div class="vide"><p>Créez un produit et enregistrez une commande ' +
      'pour connaître son coût réel.</p></div>';
    $('#rev-resultat').innerHTML = '';
    return;
  }
  if (!article(r.article)) r.article = A.articles[0].id;

  if (r.onglet !== 'simul') {
    z.innerHTML = '<p class="muted" style="font-size:12.5px;margin:0">' +
      (r.onglet === 'couts'
        ? 'Chaque ligne de commande, livraison répartie, et le prix qu’il faudrait pratiquer.'
        : 'Ce que chaque produit a réellement rapporté, prix pratiqués à l’appui.') + '</p>';
    renderRevientResultat();
    return;
  }

  var art = article(r.article);
  var e = echelle(art);
  var cout = coutRetenu(art) * e.k;
  var moyen = ST.prixVenteMoyen(art) * e.k;
  z.innerHTML =
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="rev-art">Produit</label>' +
    '<select id="rev-art">' + optionsArticles(r.article) + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="rev-base">Coût retenu</label>' +
    '<select id="rev-base">' +
    '<option value="pmp"' + (r.base === 'pmp' ? ' selected' : '') + '>moyenne du stock</option>' +
    '<option value="dernier"' + (r.base === 'dernier' ? ' selected' : '') + '>dernière commande</option>' +
    '</select></div>' +
    (e.dose
      ? '<div class="champ"><label class="eyebrow" for="rev-par">Raisonner</label>' +
        '<select id="rev-par">' +
        '<option value="plant"' + (r.par !== 'unite' ? ' selected' : '') + '>par plant</option>' +
        '<option value="unite"' + (r.par === 'unite' ? ' selected' : '') + '>par ' +
        esc(ST.courtUniteArt(art.unite)) + '</option></select></div>' +
        '<div class="champ"><label class="eyebrow" for="rev-dose">Dosage (' +
        esc(ST.courtUniteArt(art.unite)) + ' / plant)</label>' +
        '<input type="text" id="rev-dose" inputmode="decimal" value="' +
        esc(String(e.dose).replace('.', ',')) + '"></div>' : '') +
    '<div class="champ"><label class="eyebrow" for="rev-mode">Prix de vente</label>' +
    '<select id="rev-mode">' +
    '<option value="saisi"' + (r.mode !== 'moyen' ? ' selected' : '') + '>prix saisi</option>' +
    '<option value="moyen"' + (r.mode === 'moyen' ? ' selected' : '') + '>prix moyen pratiqué</option>' +
    '</select></div>' +
    (r.mode === 'moyen'
      ? '<div class="champ"><label class="eyebrow">Prix moyen hors débours</label>' +
        '<input type="text" class="gros" value="' + (moyen ? E.fmt(moyen, 4) : '—') + '" disabled></div>'
      : '<div class="champ"><label class="eyebrow" for="rev-prix">Prix (€ / ' + esc(e.nom) + ')</label>' +
        '<input type="text" id="rev-prix" class="gros" inputmode="decimal" value="' + esc(r.prix) + '"></div>') +
    '</div>' +
    '<div class="carte2" style="margin-top:11px">' +
    '<div style="display:flex;justify-content:space-between;font-size:13.5px">' +
    '<span>Coût réel par ' + esc(e.nom) + '</span><b class="num">' + E.fmt(cout, 4) + ' €</b></div>' +
    (e.dose ? '<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:3px">' +
      '<span class="muted">dosage retenu</span><b class="num muted">' + E.fmt(e.dose, 2) + ' ' +
      esc(ST.courtUniteArt(art.unite)) + ' par plant' +
      (ST.nb(r.dose) && ST.nb(r.dose) !== ST.nb(art.dosage)
        ? ' <i style="font-style:normal;color:#B98A00">simulé</i>' : '') +
      '</b></div>' : '') +
    '<div class="muted" style="font-size:11.5px;margin-top:5px">Livraison comprise. ' +
    (r.base === 'dernier' ? 'Dernière commande — le prix auquel vous rachèterez.'
      : 'Moyenne pondérée de toutes les commandes reçues.') + '</div></div>';
  renderRevientResultat();
}

/* Un produit dosé se vend au plant, pas au millilitre : tout le simulateur
   bascule dans l'unité choisie, coût compris. Les rapports ne changent pas,
   seuls les euros suivent l'échelle. */
function echelle(art) {
  /* Le dosage simulé prime sur celui de la fiche : on chiffre un chantier de
     grosses tiges sans corriger le produit, qui lui ne change pas. */
  var d = ST.nb((A.revient && A.revient.dose) || (art && art.dosage));
  var parPlant = d > 0 && (!A.revient || A.revient.par !== 'unite');
  return { dose: d > 0 ? d : 0, k: parPlant ? d : 1,
    nom: parPlant ? 'plant' : ST.courtUniteArt(art && art.unite) };
}

function renderRevientResultat() {
  var z = $('#rev-resultat'); if (!z) return;
  var r = A.revient, art = article(r && r.article);
  if (!art) { z.innerHTML = ''; return; }
  if (r.onglet === 'annee') { z.innerHTML = tableauAnnee(); return; }
  if (r.onglet === 'couts') { z.innerHTML = tableauCouts(); return; }
  if (r.onglet === 'perf') { z.innerHTML = tableauPerformance(); return; }

  var f = fiscStock(), e = echelle(art), cout = coutRetenu(art) * e.k;
  var pv = r.mode === 'moyen' ? ST.prixVenteMoyen(art) * e.k : ST.nb(r.prix);
  z.innerHTML = (pv ? blocRepartition(art, pv, cout, f, e) : '') +
    blocPrixConseilles(art, cout, f, e);
}

/* Simulateur : où part chaque euro encaissé. */
function blocRepartition(art, pv, cout, f, e) {
  var d = ST.decomposer(pv, cout, f);
  var COUL = { cout: '#5B3A1E', cotisations: '#C4611B', impot: '#B98A00', cfe: '#7A8471', benefice: '#2E7D46' };
  var parts = [
    { nom: 'Coût unitaire réel', valeur: d.cout, couleur: COUL.cout },
    { nom: 'Cotisations MSA', valeur: d.cotisations, couleur: COUL.cotisations },
    { nom: 'Impôt sur le revenu', valeur: d.impot, couleur: COUL.impot },
    { nom: 'CFE', valeur: d.cfe, couleur: COUL.cfe },
    { nom: 'Bénéfice net', valeur: d.benefice, couleur: COUL.benefice }
  ].map(function (p) { p.texte = E.fmt(p.valeur, 4) + ' €'; return p; });

  return '<div class="carte"><h2>À ' + E.fmt(pv, 4) + ' € le ' + esc(e.nom) +
    (e.k !== 1 ? ' — ' + E.fmt(pv / e.k, 4) + ' € par ' +
      esc(ST.courtUniteArt(art.unite)) : '') + '</h2>' +
    (A.revient.mode === 'moyen' ? '<p class="muted" style="font-size:12px;margin:-4px 0 10px">' +
      'Prix moyen effectivement pratiqué sur vos sorties, débours exclus.</p>' : '') +
    (d.viable
      ? anneau(parts, { centre: E.fmt(d.partBenefice, 1) + ' %', sous: 'de bénéfice' })
      : '<div class="retard" style="margin-bottom:10px">À ce prix vous perdez ' +
        eur(-d.benefice) + ' par unité.</div>' +
        anneau(parts.filter(function (p) { return p.valeur > 0; }), {})) +
    '<div class="kpi" style="margin-top:12px">' +
    '<div class="carte2" style="border-color:' + (d.viable ? '#2E7D46' : '#B4231F') + '">' +
    '<b class="num">' + E.fmt(d.benefice, 4) + ' €</b><small>bénéfice net / ' + esc(e.nom) + '</small></div>' +
    '<div class="carte2"><b class="num">' + E.fmt(d.partBenefice, 1) + ' %</b><small>taux de bénéfice net</small></div>' +
    '<div class="carte2"><b class="num">' + E.fmt(d.marge, 4) + ' €</b><small>marge brute / ' + esc(e.nom) + '</small></div>' +
    '<div class="carte2"><b class="num">' + E.fmt(d.tauxMarge, 1) + ' %</b><small>taux de marge brute</small></div>' +
    '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:10px 0 0">Charges totales ' +
    E.fmt(d.charges, 4) + ' € par ' + esc(e.nom) + ', soit ' + E.fmt(ST.tauxCharges(f) * 100, 2) +
    ' % du prix de vente : cotisations et impôt portent sur ' +
    E.fmt((1 - f.abattement) * 100, 0) + ' % du chiffre d’affaires après abattement.</p></div>';
}

/* Les trois prix qui servent vraiment sur le terrain. */
function blocPrixConseilles(art, cout, f, e) {
  var tb = cibleBenefice() / 100, tm = cibleMarge() / 100;
  var plancher = ST.prixPlancher(cout, f) || 0;
  var avecBen = ST.prixAvecBenefice(cout, f, tb) || 0;
  var avecMarge = ST.prixAvecMarge(cout, tm) || 0;
  var pratique = ST.prixVenteMoyen(art) * e.k;
  var l = [
    { nom: 'Plancher', v: plancher, d: 'couvre le coût et les charges, zéro bénéfice' },
    { nom: 'Avec ' + E.fmt(cibleBenefice(), 0) + ' % de bénéfice', v: avecBen, d: 'votre objectif de bénéfice net' },
    { nom: 'Avec ' + E.fmt(cibleMarge(), 0) + ' % de marge brute', v: avecMarge, d: 'votre objectif de marge' }
  ];
  return '<div class="carte"><h2>Prix conseillés</h2>' +
    (ST.tauxCharges(f) > 0 ? '' : '<p class="muted" style="font-size:12px;margin:0 0 10px">' +
      'Renseignez vos taux de cotisations et d’impôt dans les hypothèses pour tenir compte des charges.</p>') +
    l.map(function (x) {
      return '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--trait)">' +
        '<span>' + esc(x.nom) + '<br><small class="muted" style="font-size:11.5px">' + esc(x.d) + '</small></span>' +
        '<b class="num" style="font-size:17px">' + E.fmt(x.v, 4) + ' €' +
        (e.k !== 1 ? '<br><small class="muted" style="font-size:11px">' +
          E.fmt(x.v / e.k, 4) + ' € / ' + esc(ST.courtUniteArt(art.unite)) + '</small>' : '') + '</b></div>';
    }).join('') +
    (pratique ? '<p class="muted" style="font-size:12px;margin:10px 0 0">Vous vendez ce produit ' +
      E.fmt(pratique, 4) + ' € le ' + esc(e.nom) + ' en moyenne, soit ' +
      (pratique >= avecMarge ? 'au-dessus de' : pratique >= avecBen ? 'entre vos deux objectifs, sous'
        : pratique >= plancher ? 'sous' : 'en dessous du plancher et de') +
      ' votre objectif de marge.</p>' : '') +
    '</div>';
}

/* Le tableau du classeur, ligne de commande par ligne de commande. */
function tableauCouts() {
  var f = fiscStock(), tb = cibleBenefice() / 100, tm = cibleMarge() / 100;
  var lignes = [];
  (A.commandes || []).forEach(function (c) {
    if (ST.achatMort(c.statut)) return;
    var parts = partsPort(c);
    (c.lignes || []).forEach(function (l, i) {
      var a = article(l.article); if (!a) return;
      var q = ST.nb(l.qte), pu = ST.nb(l.prix), part = parts[i] || 0;
      lignes.push({ cmd: c.num || '—', art: a, date: c.dateLiv || c.dateCmd, recu: ST.achatRecu(c.statut),
        qte: q, achat: q * pu, quotePart: q * part, coutTotal: q * (pu + part),
        coutUnit: pu + part, surcout: part });
    });
  });
  if (!lignes.length) {
    return '<div class="carte"><div class="vide"><p>Aucune commande enregistrée.</p></div></div>';
  }
  lignes.sort(function (x, y) { return (y.date || 0) - (x.date || 0); });
  var tot = lignes.reduce(function (t, x) {
    t.achat += x.achat; t.qp += x.quotePart; t.reel += x.coutTotal; return t;
  }, { achat: 0, qp: 0, reel: 0 });

  /* Trois prix côte à côte, en euros : ce que le produit coûte, ce qu'il
     devrait valoir pour tenir l'objectif, et ce qu'on le vend. Un pourcentage
     rapporté à un minimum se comparait bien d'un produit à l'autre, mais
     personne ne sait ce que « 131 % » veut dire. */
  var cible = cibleMarge();
  var gPrix = A.articles.filter(function (a) {
    return ST.quantiteVendue(a) > 0 && ST.pmp(a) > 0;
  }).map(function (a) {
    /* Un produit dosé se raisonne au plant : 0,05 € le millilitre ne dit rien,
       0,30 € le plant se compare à ce qu'on facture. */
    var d = ST.nb(a.dosage), k = d > 0 ? d : 1;
    var cu = ST.pmp(a) * k, pv = ST.prixVenteMoyen(a) * k;
    return { nom: a.nom || '', unite: d > 0 ? 'plant' : ST.courtUniteArt(a.unite),
      cout: cu, mini: cible < 100 ? cu / (1 - cible / 100) : cu, vendu: pv };
  }).sort(function (a, b) { return b.vendu - a.vendu; });

  return (gPrix.length ? '<div class="carte"><h2>Ce qu’ils coûtent, ce qu’ils valent, ' +
    'ce qu’ils se vendent</h2>' + batonsPrix(gPrix, cible) + '</div>' : '') +
    '<div class="carte"><h2>Coût réel par commande</h2>' +
    '<div class="tab-boite"><table><thead><tr>' +
    '<th style="text-align:left">Commande</th><th style="text-align:left">Produit</th>' +
    '<th class="num">Qté</th><th class="num">Achat</th><th class="num">Quote-part livr.</th>' +
    '<th class="num">Coût total réel</th><th class="num">Coût unit. réel</th>' +
    '<th class="num">Surcoût livr./u.</th><th class="num">Prix vente min</th>' +
    '<th class="num">+ ' + E.fmt(cibleBenefice(), 0) + ' % bénéf.</th>' +
    '<th class="num">' + E.fmt(cibleMarge(), 0) + ' % marge</th></tr></thead><tbody>' +
    lignes.map(function (x) {
      return '<tr' + (x.recu ? '' : ' class="epuise"') + '>' +
        '<td style="text-align:left">' + esc(x.cmd) + (x.recu ? '' : ' <small class="muted">attendue</small>') + '</td>' +
        '<td style="text-align:left">' + esc(x.art.nom || '') +
        '<small class="muted"> ' + esc(ST.courtUniteArt(x.art.unite)) + '</small></td>' +
        '<td class="num">' + E.fmt(x.qte, 0) + '</td>' +
        '<td class="num">' + E.fmt(x.achat, 2) + '</td>' +
        '<td class="num">' + E.fmt(x.quotePart, 2) + '</td>' +
        '<td class="num">' + E.fmt(x.coutTotal, 2) + '</td>' +
        '<td class="num"><b>' + E.fmt(x.coutUnit, 4) + '</b></td>' +
        '<td class="num muted">' + E.fmt(x.surcout, 4) + '</td>' +
        '<td class="num">' + E.fmt(ST.prixPlancher(x.coutUnit, f) || 0, 4) + '</td>' +
        '<td class="num">' + E.fmt(ST.prixAvecBenefice(x.coutUnit, f, tb) || 0, 4) + '</td>' +
        '<td class="num">' + E.fmt(ST.prixAvecMarge(x.coutUnit, tm) || 0, 4) + '</td></tr>';
    }).join('') +
    '<tr class="tot"><td style="text-align:left" colspan="3">Total</td>' +
    '<td class="num">' + E.fmt(tot.achat, 2) + '</td>' +
    '<td class="num">' + E.fmt(tot.qp, 2) + '</td>' +
    '<td class="num">' + E.fmt(tot.reel, 2) + '</td>' +
    '<td></td><td></td><td></td><td></td><td></td></tr>' +
    '</tbody></table></div>' +
    '<p class="muted" style="font-size:11.5px;margin:9px 0 0">La quote-part de livraison est ' +
    'répartie au prorata des quantités de la commande, ou des montants si les unités diffèrent.</p></div>' +
    /* « Où dort votre argent » vit sur l'inventaire : le répéter ici le
       montrait deux fois. Seule la valeur immobilisée reste, en une ligne. */
    (ST.valeurTotale(A.articles) > 0
      ? '<p class="muted" style="font-size:12px;margin:11px 0 0">' +
        eur(ST.valeurTotale(A.articles)) + ' immobilisés en stock, au coût réel. ' +
        'Le détail par produit se lit sur l’inventaire.</p>'
      : '');
}

/* Ce que chaque produit a réellement rapporté, et qui tient l'objectif. */
/* Ce que les fournitures ont rapporté, année par année. Le cumul de toujours
   ne dit pas si l'on progresse, ni quand on vend — deux questions qui
   décident des achats. */
function tableauAnnee() {
  var ans = ST.anneesDeVente(A.articles);
  if (!ans.length) {
    return '<div class="carte"><div class="vide"><p>Aucune vente enregistrée. ' +
      'Les sorties de stock alimenteront cet écran.</p></div></div>';
  }
  var r = A.revient || (A.revient = {});
  var an = ans.indexOf(r.annee) >= 0 ? r.annee : ans[0];
  r.annee = an;
  var ca = ST.caAnnee(A.articles, an), caAvant = ST.caAnnee(A.articles, an - 1);
  var marge = ST.margeAnnee(A.articles, an);
  var evo = caAvant > 0 ? (ca - caAvant) / caAvant * 100 : null;
  var parArt = ST.caParArticle(A.articles, an);

  /* Cinq ans d'historique, sans remonter avant la première vente. */
  var histo = [];
  for (var i = 4; i >= 0; i--) {
    var a2 = an - i;
    if (a2 < ans[ans.length - 1]) continue;
    histo.push({ an: a2, ca: ST.caAnnee(A.articles, a2) });
  }
  var maxH = Math.max.apply(null, histo.map(function (h) { return h.ca; }).concat([0]));

  return '<div class="carte">' +
    '<div class="carte-titre"><h2>Ventes de fournitures</h2>' +
    '<select id="an-rev" style="width:auto">' + ans.map(function (a2) {
      return '<option value="' + a2 + '"' + (a2 === an ? ' selected' : '') + '>' + a2 + '</option>';
    }).join('') + '</select></div>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(ca) + '</b><small>vendu en ' + an + '</small></div>' +
    '<div class="carte2"><b class="num">' + eur(marge) + '</b><small>de marge brute</small></div>' +
    (evo != null
      ? '<div class="carte2"><b class="num" style="color:' + (evo >= 0 ? '#2E7D46' : '#B4231F') +
        '">' + (evo >= 0 ? '+' : '') + E.fmt(evo, 0) + ' %</b><small>sur ' + (an - 1) + '</small></div>'
      : '') +
    '</div>' +
    (evo != null
      ? '<p class="muted" style="font-size:12px;margin:10px 0 0">' + eur(caAvant) +
        ' en ' + (an - 1) + ', soit ' + eur(ST.arr(ca - caAvant, 2)) + ' d’écart.</p>'
      : '<p class="muted" style="font-size:12px;margin:10px 0 0">Première année de vente : ' +
        'rien à quoi comparer.</p>') +
    '</div>' +

    '<div class="carte"><h2>Quand vous vendez</h2>' +
    '<p class="muted" style="font-size:12px;margin:3px 0 0">Les creux disent quand acheter : ' +
    'la fourniture se commande avant la saison, pas pendant.</p>' +
    courbeMois([
      { nom: String(an - 1), valeurs: ST.caParMois(A.articles, an - 1), couleur: '#B8AB95' },
      { nom: String(an), valeurs: ST.caParMois(A.articles, an), couleur: '#2E7D46', fort: true }
    ]) + '</div>' +

    '<div class="carte"><div class="carte-titre"><h2>Ce qui a rapporté en ' + an + '</h2>' +
    '<div class="chips" id="an-forme">' +
    '<button class="chip" data-anforme="anneau" aria-pressed="' + (r.forme !== 'barres') + '">Anneau</button>' +
    '<button class="chip" data-anforme="barres" aria-pressed="' + (r.forme === 'barres') + '">Barres</button>' +
    '</div></div>' +
    (r.forme === 'barres'
      ? barres(parArt.map(function (x) {
        return { nom: x.nom, valeur: x.ca,
          detail: E.fmt(x.qte, 0) + ' ' + ST.courtUniteArt(x.article.unite) };
      }), '#2E4A3C')
      : anneau(partsProduits(parArt.map(function (x) {
        return { nom: x.nom, valeur: x.ca };
      })), { centre: eurCourt(ca), sous: 'vendu en ' + an })) + '</div>' +

    (histo.length > 1
      ? '<div class="carte"><h2>Les ' + histo.length + ' dernières années</h2>' +
        histo.map(function (h) {
          var pc = maxH > 0 ? h.ca / maxH * 100 : 0;
          return '<div style="margin-bottom:8px">' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">' +
            '<span' + (h.an === an ? ' style="font-weight:600"' : '') + '>' + h.an + '</span>' +
            '<span class="num">' + eur(h.ca) + '</span></div>' +
            '<div style="height:9px;background:var(--carte2);border-radius:5px;overflow:hidden">' +
            '<i style="display:block;height:100%;width:' + pc.toFixed(1) + '%;background:' +
            (h.an === an ? '#2E7D46' : '#B8AB95') + '"></i></div></div>';
        }).join('') + '</div>'
      : '');
}

function tableauPerformance() {
  var f = fiscStock(), tc = ST.tauxCharges(f), cm = cibleMarge();
  var deb = ST.arr(A.articles.reduce(function (s, a) { return s + ST.caDebours(a); }, 0), 2);
  var l = A.articles.filter(function (a) { return ST.quantiteVendue(a) > 0; });
  if (!l.length) {
    return '<div class="carte"><div class="vide"><p>Aucune vente enregistrée. ' +
      'Les sorties de stock alimenteront ce tableau.</p></div></div>';
  }
  var tot = { q: 0, ca: 0, cout: 0 };
  l = l.sort(function (a, b) { return ST.caVendu(b) - ST.caVendu(a); });
  var lignes = l.map(function (a) {
    var q = ST.quantiteVendue(a), ca = ST.caVendu(a), pv = ST.prixVenteMoyen(a), cu = ST.pmp(a);
    var marge = pv - cu, charge = pv * tc, benef = marge - charge;
    tot.q += q; tot.ca += ca; tot.cout += q * cu;
    return '<tr><td style="text-align:left">' + esc(a.nom || '') + '</td>' +
      '<td class="num">' + E.fmt(q, 0) + '</td>' +
      '<td class="num">' + E.fmt(ca, 2) + '</td>' +
      '<td class="num">' + E.fmt(pv, 4) + '</td>' +
      '<td class="num">' + E.fmt(cu, 4) + '</td>' +
      '<td class="num">' + E.fmt(marge, 4) + '</td>' +
      '<td class="num">' + (pv > 0 ? E.fmt(marge / pv * 100, 1) + ' %' : '—') + '</td>' +
      '<td class="num muted">' + E.fmt(charge, 4) + '</td>' +
      '<td class="num">' + E.fmt(benef, 4) + '</td>' +
      '<td class="num"' + (pv > 0 && benef < 0 ? ' style="color:#B4231F"' : '') + '>' +
      (pv > 0 ? E.fmt(benef / pv * 100, 1) + ' %' : '—') + '</td></tr>';
  }).join('');
  var pvm = tot.q > 0 ? tot.ca / tot.q : 0, cum = tot.q > 0 ? tot.cout / tot.q : 0;

  /* Brute ou nette : la nette retire les charges, celles qui décident si l'on
     paie des cotisations sur de l'argent qu'on n'a pas gagné. */
  var nette = (A.revient || {}).marge === 'nette';
  var gMarge = l.map(function (a) {
    var pv = ST.prixVenteMoyen(a), cu = ST.pmp(a);
    var t = pv > 0 ? (pv - cu - (nette ? pv * tc : 0)) / pv * 100 : 0;
    return { nom: a.nom || '', valeur: t, texte: E.fmt(t, 1) + ' %' };
  }).sort(function (a, b) { return b.valeur - a.valeur; });
  var gCa = l.map(function (a) {
    return { nom: a.nom || '', valeur: ST.caVendu(a),
      detail: E.fmt(ST.quantiteVendue(a), 0) + ' ' + ST.courtUniteArt(a.unite) };
  }).sort(function (a, b) { return b.valeur - a.valeur; });

  /* Le taux d'ensemble, avant le détail par produit : un produit vendu sous
     l'objectif peut être rattrapé par un autre, et c'est le total qui décide
     si les charges sont couvertes. */
  var brutTot = tot.ca > 0 ? (tot.ca - tot.cout) / tot.ca * 100 : 0;
  var netTot = tot.ca > 0 ? (tot.ca - tot.cout - tot.ca * tc) / tot.ca * 100 : 0;
  var caCible = cm < 100 ? tot.cout / (1 - cm / 100) : 0;
  var manque = caCible - tot.ca;

  return '<div class="carte"><h2>Sur l’ensemble de vos ventes</h2>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num" style="font-size:23px' +
    (brutTot < cm ? ';color:#B4231F' : '') + '">' + E.fmt(brutTot, 1) + ' %</b>' +
    '<small>marge brute</small></div>' +
    '<div class="carte2"><b class="num">' + E.fmt(cm, 0) + ' %</b><small>votre objectif</small></div>' +
    '<div class="carte2"><b class="num">' + E.fmt(netTot, 1) + ' %</b><small>net, après charges</small></div>' +
    '</div>' +
    '<p class="muted" style="font-size:12.5px;margin:10px 0 0">' +
    (tot.ca <= 0 ? 'Aucune vente à mesurer.'
      : brutTot >= cm
        ? 'Vous êtes au-dessus de votre objectif : l’abattement forfaitaire couvre vos charges.'
        : 'Il vous manque ' + eur(FIN.arr(manque, 2)) + ' de chiffre d’affaires, à coût de ' +
          'revient inchangé, pour atteindre ' + E.fmt(cm, 0) + ' %. En dessous, vous cotisez sur ' +
          'une marge que vous n’avez pas faite.') + '</p></div>' +
    '<div class="carte"><h2>Ce que chaque produit rapporte</h2>' +
    '<div class="tab-boite"><table><thead><tr>' +
    '<th style="text-align:left">Produit</th><th class="num">Vendu</th><th class="num">CA</th>' +
    '<th class="num">Prix moyen</th><th class="num">Coût réel</th><th class="num">Marge / u.</th>' +
    '<th class="num">Tx marge</th><th class="num">Charges / u.</th>' +
    '<th class="num">Bénéf. net / u.</th><th class="num">Tx bénéf.</th></tr></thead><tbody>' + lignes +
    '<tr class="tot"><td style="text-align:left">Total</td>' +
    '<td class="num">' + E.fmt(tot.q, 0) + '</td>' +
    '<td class="num">' + E.fmt(tot.ca, 2) + '</td>' +
    '<td class="num">' + E.fmt(pvm, 4) + '</td>' +
    '<td class="num">' + E.fmt(cum, 4) + '</td>' +
    '<td class="num">' + E.fmt(pvm - cum, 4) + '</td>' +
    '<td class="num">' + (pvm > 0 ? E.fmt((pvm - cum) / pvm * 100, 1) + ' %' : '—') + '</td>' +
    '<td class="num muted">' + E.fmt(pvm * tc, 4) + '</td>' +
    '<td class="num">' + E.fmt(pvm - cum - pvm * tc, 4) + '</td>' +
    '<td class="num">' + (pvm > 0 ? E.fmt((pvm - cum - pvm * tc) / pvm * 100, 1) + ' %' : '—') + '</td></tr>' +
    '</tbody></table></div>' +
    '<p class="muted" style="font-size:11.5px;margin:9px 0 0">Bénéfice net : après cotisations et ' +
    'impôt calculés sur le chiffre d’affaires après abattement, aux taux de vos hypothèses.' +
    (deb ? ' Les ' + eur(deb) + ' refacturés en débours sont exclus.' : '') + '</p></div>' +
    '<div class="carte"><div class="carte-titre"><h2>Taux de marge par produit</h2></div>' +
    '<div class="chips" id="perf-marge">' +
    '<button class="chip" data-marge="brute" aria-pressed="' + (!nette) + '">Marge brute</button>' +
    '<button class="chip" data-marge="nette" aria-pressed="' + nette + '">Marge nette</button>' +
    '</div><div style="margin-top:10px">' +
    /* L'objectif de marge est un objectif de marge BRUTE : c'est sur elle que
       l'abattement forfaitaire se compare. Garder le trait sur la vue nette
       ferait croire à un objectif qui n'existe pas. */
    (nette ? barres(gMarge, '#2E7D46')
      : barresObjectif(gMarge, cm, { libObjectif: E.fmt(cm, 0) + ' %' })) + '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:8px 0 0">' +
    (nette ? 'Nette : la brute moins ' + E.fmt(tc * 100, 1) + ' % de charges, prélevés sur le ' +
      'prix de vente. Un produit à faible marge y perd proportionnellement bien plus qu’un ' +
      'autre. Pas d’objectif ici : le seuil de ' + E.fmt(cm, 0) + ' % porte sur la marge brute.'
      : 'Brute : prix de vente moins coût réel, avant charges. C’est elle que compare ' +
      'l’objectif de ' + E.fmt(cm, 0) + ' %.') + '</p></div>' +
    '<div class="carte"><h2>Qui fait le chiffre</h2>' + barres(gCa, '#2E4A3C') + '</div>';
}

/* Les hypothèses fiscales, au même endroit que dans le classeur. */
function ouvrirHypotheses() {
  var c = A.cfg || {};
  var ab = c.abattementVente != null ? c.abattementVente : 0.71;
  modale('Hypothèses',
    '<p class="muted" style="font-size:12.5px;margin:0 0 12px">Micro-BIC et MSA. ' +
    'Ces taux servent partout : prix conseillés, bénéfice net, performance.</p>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="hy-ab">Abattement vente (%)</label>' +
    '<input type="text" id="hy-ab" class="gros" inputmode="decimal" value="' + E.fmt(ab * 100, 0) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="hy-cot">Cotisations MSA (%)</label>' +
    '<input type="text" id="hy-cot" class="gros" inputmode="decimal" value="' +
    (c.tauxCotisations != null ? String(c.tauxCotisations).replace('.', ',') : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="hy-imp">Impôt sur le revenu (%)</label>' +
    '<input type="text" id="hy-imp" class="gros" inputmode="decimal" value="' +
    (c.tauxImpot != null ? String(c.tauxImpot).replace('.', ',') : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="hy-cfe">CFE par unité (€)</label>' +
    '<input type="text" id="hy-cfe" inputmode="decimal" value="' + (c.cfeUnitaire || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="hy-ben">Bénéfice souhaité (%)</label>' +
    '<input type="text" id="hy-ben" inputmode="decimal" value="' + E.fmt(cibleBenefice(), 0) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="hy-mar">Marge brute souhaitée (%)</label>' +
    '<input type="text" id="hy-mar" inputmode="decimal" value="' + E.fmt(cibleMarge(), 0) + '"></div>' +
    '</div>' +
    '<div class="carte2" id="hy-apercu" style="margin-top:11px"></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="hy-ok">Valider</button></div>');

  var apercu = function () {
    var t = ST.tauxCharges({
      abattement: (FIN.nb($('#hy-ab').value) || 71) / 100,
      cotisations: FIN.nb($('#hy-cot').value) / 100,
      impot: FIN.nb($('#hy-imp').value) / 100
    });
    $('#hy-apercu').innerHTML = '<div style="display:flex;justify-content:space-between;font-size:13.5px">' +
      '<span>Taux de charges sur le chiffre d’affaires</span><b class="num">' +
      E.fmt(t * 100, 2) + ' %</b></div>' +
      '<div class="muted" style="font-size:11.5px;margin-top:4px">Sur 100 € vendus, ' +
      eur(ST.arr(t * 100, 2)) + ' de cotisations et d’impôt.</div>';
  };
  ['#hy-ab', '#hy-cot', '#hy-imp'].forEach(function (s) {
    $(s).addEventListener('input', apercu);
  });
  apercu();

  $('#hy-ok').addEventListener('click', function () {
    var a = FIN.nb($('#hy-ab').value);
    A.cfg.abattementVente = (a > 0 && a < 100) ? a / 100 : 0.71;
    A.cfg.tauxCotisations = FIN.nb($('#hy-cot').value) || null;
    A.cfg.tauxImpot = FIN.nb($('#hy-imp').value) || null;
    A.cfg.cfeUnitaire = FIN.nb($('#hy-cfe').value) || null;
    A.cfg.cibleBenefice = FIN.nb($('#hy-ben').value) || 10;
    A.cfg.cibleMarge = FIN.nb($('#hy-mar').value) || 30;
    sauverCfg();
    fermerModale(); renderRevient(); renderReglages(); renderAnalyses();
    toast('Hypothèses enregistrées.');
  });
}

function renderReglagesCh() {
  if ($('#r-hj')) $('#r-hj').value = (A.cfg && A.cfg.heuresJour) || 7;
  if ($('#r-pj')) $('#r-pj').value = (A.cfg && A.cfg.prixJourVise) || '';
}
function brancherReglagesCh() {
  var el = $('#r-hj');
  if (el) el.addEventListener('change', function () {
    var v = C.nb(this.value);
    if (v < 1 || v > 24) { toast('Entre 1 et 24 heures.'); renderReglagesCh(); return; }
    A.cfg.heuresJour = v; sauverCfg(); renderCarnet(); renderFiche();
  });
  var el2 = $('#r-pj');
  if (el2) el2.addEventListener('change', function () {
    var v = C.nb(this.value);
    A.cfg.prixJourVise = v > 0 ? v : null; sauverCfg(); renderFiche();
  });
}

/* L'écran de démarrage se règle avec l'installation et les mises à jour :
   c'est un réglage de l'application, pas du métier. Zéro le supprime — la
   question « est-ce qu'on peut l'enlever » finit toujours par venir, autant
   que la réponse soit dans le curseur. */
var DEM_DEFAUT = 1.2;
function dureeDemarrage() {
  return (A.cfg && A.cfg.demarrageDuree != null) ? Number(A.cfg.demarrageDuree) : DEM_DEFAUT;
}
function majLibelleDemarrage(s) {
  var v = $('#r-dem-val'), a = $('#r-dem-aide');
  /* « 1,2 s » mais « 2 s » : une décimale seulement quand elle dit quelque
     chose, comme pour le total des journées. */
  if (v) v.textContent = s > 0 ? E.fmt(s, s % 1 ? 1 : 0) + ' s' : 'aucun';
  if (a) a.textContent = s > 0
    ? 'S’affiche au lancement, puis laisse place à l’accueil. Un appui dessus le fait ' +
      'sauter, et il ne revient pas quand vous rouvrez l’application dans la journée.'
    : 'L’application s’ouvre directement sur l’accueil.';
}
/* La case dit ce que le téléphone a répondu. Sans ça, on ne saurait jamais
   si l'écran reste allumé parce que le réglage marche, ou s'il s'éteint
   parce qu'un mode d'économie a refusé. */
function renderReglagesVeille() {
  var el = $('#r-veille'); if (!el) return;
  var a = $('#r-veille-aide');
  if (!veilleDisponible()) {
    el.checked = false;
    el.disabled = true;
    if (a) a.textContent = 'Ce navigateur ne sait pas garder l’écran allumé.';
    return;
  }
  el.disabled = false;
  el.checked = veilleVoulue();
  if (!a) return;
  a.textContent = !veilleVoulue()
    ? 'L’écran s’éteint comme d’habitude.'
    : veilleTenue
      ? 'Le téléphone a accepté : l’écran reste allumé tant que Sylve est devant.'
      : 'Demandé, mais le téléphone n’a pas suivi — un mode d’économie de ' +
        'batterie peut refuser.';
}
function brancherReglagesVeille() {
  var el = $('#r-veille'); if (!el) return;
  el.addEventListener('change', function () {
    A.cfg.ecranAllume = this.checked;
    sauverCfg();
    /* On attend la réponse du téléphone avant de dire quoi que ce soit. */
    demanderVeille().then(renderReglagesVeille);
  });
}
function renderReglagesDemarrage() {
  var el = $('#r-dem'); if (!el) return;
  var s = dureeDemarrage();
  el.value = s;
  majLibelleDemarrage(s);
  renderReglagesVeille();
}
function brancherReglagesDemarrage() {
  var el = $('#r-dem'); if (!el) return;
  /* Le libellé suit le doigt ; l'enregistrement attend qu'il soit relâché. */
  el.addEventListener('input', function () { majLibelleDemarrage(Number(this.value)); });
  el.addEventListener('change', function () {
    var s = Number(this.value);
    A.cfg.demarrageDuree = s;
    majLibelleDemarrage(s);        /* le clavier et le lecteur d'écran ne passent pas par « input » */
    sauverCfg();
  });
  var v = $('#r-dem-voir');
  if (v) v.addEventListener('click', function () {
    var s = Number(el.value);
    if (!(s > 0)) { toast('Écran de démarrage désactivé.'); return; }
    if (window.BCdem) window.BCdem.voir(s);
  });
  brancherReglagesVeille();
  brancherVeille();
  /* Si le réglage était déjà posé, on redemande à l'ouverture. */
  demanderVeille().then(renderReglagesVeille);
}


window.BCUI = { toast: toast,
  /* La projection s'éprouve seule : une carte fausse ne se voit qu'à
     l'écran, et trop tard. */
  _carte: { LB: LB, cadre: function () { return A.carte; } },
  _importCsv: function (txt) { A.imp = C.analyseCsv(txt); renderImportResultat(); },
  _setCal: function (mois, jour) { A.calMois = mois; A.calJour = jour; renderCalendrier(); },
  _setChantier: function (id, maj) { var c = chantier(id); if (!c) return; Object.keys(maj).forEach(function (k) { c[k] = maj[k]; }); c.maj = Date.now(); sauverChantiers().then(function () { renderCarnet(); renderFiche(); renderAccueil(); }); },
  _pushPhoto: function (ph) { pPhotos.push(ph); if (typeof renderPhotos === 'function') renderPhotos(); } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
