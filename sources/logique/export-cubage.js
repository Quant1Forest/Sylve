/* ==========================================================================
   Construction du classeur d'export : reprend les cinq feuilles du tableur d'origine
   (Volumes, Synthèse, Synthèse Financière, Bûcheron, Martelage) avec la même
   disposition, pour que les fichiers restent lisibles par les destinataires
   habitués à l'ancien logiciel.
   ========================================================================== */

var S_NORM = 0, S_GRAS = 1, S_TITRE = 2, S_TETE = 3, S_TXT = 4, S_NUM = 5,
  S_INT = 6, S_TOTTXT = 7, S_TOTNUM = 8, S_TOTINT = 9, S_PCT = 10, S_EUR = 11, S_SAISIE = 12;

function _enteteFeuille(m, colDroite) {
  var r = [[], [], [], []];
  var g = [['Article :', m.article], ['Client :', m.client], ['Forêt :', m.foret], ['Parcelle (s) :', m.parcelles]];
  var d = [['Mesures :', m.mesures === 'sous' ? 'sous' : 'sur'], ['Plaquettes :', m.plaqCouleur],
  ['Type bordereau :', m.classement], ['ETF :', m.etf]];
  for (var i = 0; i < 4; i++) {
    r[i][1] = { v: g[i][0], s: S_GRAS };
    r[i][2] = g[i][1] || '';
    r[i][colDroite - 1] = { v: d[i][0], s: S_GRAS };
    r[i][colDroite] = d[i][1] || '';
  }
  return r;
}

function feuilleVolumes(bord, cfg, E) {
  var m = bord.meta;
  var rows = _enteteFeuille(m, 9);
  rows[4] = ['N°', 'BP ou D1,30', 'Ess.', 'Qual', 'Long.', 'Diam', 'Parcelle', 'Date / Obs',
    'Réfact°', 'Défaut', 'VolBûch\nSur', 'VolBûch\nSous', 'VolMarch\nSous', 'ClasseDiam\nSous', 'ClasseMINI']
    .map(function (t) { return { v: t, s: S_TETE }; });
  E.cuberTout(bord, cfg).forEach(function (l) {
    rows.push([
      { v: l.num, s: S_TXT },
      { v: (l.bp === true ? 'VRAI' : (l.bp === '' || l.bp == null ? '' : E.toNum(l.bp))), s: S_TXT },
      { v: l.ess, s: S_TXT }, { v: l.qual, s: S_TXT },
      { v: E.toNum(l.lon), s: S_NUM }, { v: E.toNum(l.dia), s: S_NUM },
      { v: l.parc || '', s: S_TXT }, { v: l.obs || '', s: S_TXT },
      { v: l.refl === '' || l.refl == null ? '' : E.toNum(l.refl), s: S_NUM },
      { v: l.refn || '', s: S_TXT },
      { v: l.c.vsur, s: S_NUM }, { v: l.c.vsous, s: S_NUM }, { v: l.c.vmarch, s: S_NUM },
      { v: l.c.clDiam, s: S_TXT }, { v: l.c.clMini, s: S_TXT }
    ]);
  });
  return {
    name: 'Volumes', paysage: true,
    cols: [11, 11, 7, 7, 8, 8, 12, 16, 9, 9, 10, 10, 10, 12, 11],
    rows: rows
  };
}

function feuilleSynthese(bord, cfg, E) {
  var S = E.synthese(bord, cfg);
  var rows = _enteteFeuille(bord.meta, 9);
  rows[5] = [{ v: 'Tous les volumes ci-dessous sont des volumes marchands sous écorce', s: S_GRAS }];
  var h1 = ['Essence', 'Nb Grumes', 'Nb Billons cubés', 'Qualités'];
  var r7 = h1.map(function (t) { return { v: t, s: S_TETE }; });
  var r8 = [{ v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE }];
  E.CLASSES_DIAM.forEach(function (cl, i) {
    r7.push({ v: i === 0 ? 'Nombre de billons et volume par catégorie de diamètre médian sous écorce' : '', s: S_TETE });
    r7.push({ v: '', s: S_TETE });
    r8.push({ v: cl, s: S_TETE }); r8.push({ v: 'm³', s: S_TETE });
  });
  r7.push({ v: 'Volume par qualité', s: S_TETE }); r7.push({ v: '%', s: S_TETE });
  r7.push({ v: 'Volume par essence', s: S_TETE }); r7.push({ v: 'VAM par essence', s: S_TETE });
  r8.push({ v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE });
  rows[6] = r7; rows[7] = r8;

  S.lignes.forEach(function (l) {
    var r = [];
    if (l.type === 'detail') {
      r[0] = { v: l.ess, s: S_TXT }; r[1] = { v: '', s: S_TXT };
      r[2] = { v: l.nbBillons, s: S_INT }; r[3] = { v: l.qual, s: S_TXT };
      l.cells.forEach(function (c, i) {
        r[4 + i * 2] = { v: c.nb, s: S_INT };
        r[5 + i * 2] = { v: c.vol, s: S_NUM };
      });
      r[22] = { v: l.volQual, s: S_NUM }; r[23] = { v: l.pct, s: S_PCT };
    } else {
      for (var i = 0; i < 26; i++) r[i] = { v: '', s: S_TOTTXT };
      r[0] = { v: 'Total ' + l.ess, s: S_TOTTXT };
      r[1] = { v: l.nbGrumes, s: S_TOTINT }; r[2] = { v: l.nbBillons, s: S_TOTINT };
      r[24] = { v: l.volEss, s: S_TOTNUM }; r[25] = { v: E.roundN(l.vam, 2), s: S_TOTNUM };
    }
    rows.push(r);
  });
  var t = [];
  for (var i = 0; i < 26; i++) t[i] = { v: '', s: S_TOTTXT };
  t[0] = { v: 'Total Général', s: S_TOTTXT };
  t[1] = { v: S.nbGrumes, s: S_TOTINT };
  t[24] = { v: S.totalGen, s: S_TOTNUM };
  rows.push(t);
  rows.push([{ v: 'Nb plaquettes dans le bordereau :', s: S_GRAS }, '', '', { v: S.nbPlaq, s: S_GRAS }]);

  var cols = [13, 10, 10, 8];
  E.CLASSES_DIAM.forEach(function () { cols.push(6, 8); });
  cols.push(11, 7, 11, 11);
  return { name: 'Synthèse', paysage: true, cols: cols, rows: rows, merges: ['E7:V7'] };
}

function feuilleFinanciere(bord, cfg, E) {
  var F = E.syntheseFinanciere(bord, cfg);
  var rows = _enteteFeuille(bord.meta, 9);
  rows[5] = [{ v: 'Tous les volumes ci-dessous sont des volumes marchands sous écorce', s: S_GRAS }];
  var r7 = ['Essence', 'Nb Grumes', 'Nb Billons cubés', 'Qualités'].map(function (t) { return { v: t, s: S_TETE }; });
  var r8 = [{ v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE }];
  E.CLASSES_DIAM.forEach(function (cl, i) {
    r7.push({ v: i === 0 ? 'Volume par catégorie de diamètre médian sous écorce' : '', s: S_TETE });
    r8.push({ v: cl, s: S_TETE });
  });
  r7.push({ v: 'Volume par qualité', s: S_TETE }, { v: 'Volume par essence', s: S_TETE }, { v: 'VAM par essence', s: S_TETE });
  r8.push({ v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE });
  rows[6] = r7; rows[7] = r8;
  F.lignes.forEach(function (l) {
    var r = [];
    if (l.type === 'detail') {
      r[0] = { v: l.ess, s: S_TXT }; r[1] = { v: '', s: S_TXT };
      r[2] = { v: l.nbBillons, s: S_INT }; r[3] = { v: l.qual, s: S_TXT };
      l.cells.forEach(function (v, i) { r[4 + i] = { v: v, s: S_NUM }; });
      r[13] = { v: l.volQual, s: S_NUM };
    } else {
      for (var i = 0; i < 16; i++) r[i] = { v: '', s: S_TOTTXT };
      r[0] = { v: 'Total ' + l.ess, s: S_TOTTXT };
      r[1] = { v: l.nbGrumes, s: S_TOTINT }; r[2] = { v: l.nbBillons, s: S_TOTINT };
      r[14] = { v: l.volEss, s: S_TOTNUM }; r[15] = { v: E.roundN(l.vam, 2), s: S_TOTNUM };
    }
    rows.push(r);
  });
  var t = [];
  for (var i = 0; i < 16; i++) t[i] = { v: '', s: S_TOTTXT };
  t[0] = { v: 'Total Général', s: S_TOTTXT };
  t[1] = { v: F.nbGrumes, s: S_TOTINT }; t[14] = { v: F.volGen, s: S_TOTNUM };
  rows.push(t);
  rows.push([{ v: 'Nb plaquettes dans le bordereau :', s: S_GRAS }, '', '', { v: F.nbPlaq, s: S_GRAS }]);

  // Bloc prix, à partir de la ligne 100 comme dans l'original
  rows[99] = [{ v: 'Tous les prix ci-dessous sont des prix sous écorce', s: S_GRAS }];
  var p101 = [{ v: 'Essence', s: S_TETE }, { v: 'Qualités', s: S_TETE }];
  var p102 = [{ v: '', s: S_TETE }, { v: '', s: S_TETE }];
  E.CLASSES_DIAM.forEach(function (cl, i) {
    p101.push({ v: i === 0 ? 'Prix unitaires par catégorie de diamètre médian sous écorce' : '', s: S_TETE });
    p102.push({ v: cl, s: S_TETE });
  });
  p101.push({ v: 'PU par qualité', s: S_TETE }, { v: 'PU par essence', s: S_TETE },
    { v: 'Montant', s: S_TETE }, { v: 'PU calculé', s: S_TETE });
  p102.push({ v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE }, { v: '', s: S_TETE });
  rows[100] = p101; rows[101] = p102;
  var li = 102;
  var prix = bord.prix || {};
  F.lignes.forEach(function (l) {
    var r = [];
    if (l.type === 'detail') {
      var p = prix[l.ess + '|' + l.qual] || {};
      r[0] = { v: l.ess, s: S_TXT }; r[1] = { v: l.qual, s: S_TXT };
      E.CLASSES_DIAM.forEach(function (cl, i) {
        var v = E.toNum((p.cl || {})[cl]);
        r[2 + i] = { v: v || '', s: S_SAISIE };
      });
      r[11] = { v: E.toNum(p.qual) || '', s: S_SAISIE };
      r[12] = { v: '', s: S_SAISIE };
    } else {
      var pe = prix[l.ess + '|*'] || {};
      for (var i = 0; i < 15; i++) r[i] = { v: '', s: S_TOTTXT };
      r[0] = { v: 'Total ' + l.ess, s: S_TOTTXT };
      r[12] = { v: E.toNum(pe.ess) || '', s: S_SAISIE };
      r[13] = { v: E.roundN(l.montant, 2), s: S_EUR };
      r[14] = { v: E.roundN(l.pu, 2), s: S_TOTNUM };
    }
    rows[li++] = r;
  });
  var tg = [];
  for (var i = 0; i < 15; i++) tg[i] = { v: '', s: S_TOTTXT };
  tg[0] = { v: 'Total Général', s: S_TOTTXT };
  tg[13] = { v: E.roundN(F.montantGen, 2), s: S_EUR };
  tg[14] = { v: E.roundN(F.puGen, 2), s: S_TOTNUM };
  rows[li] = tg;

  var cols = [13, 10, 10, 9];
  E.CLASSES_DIAM.forEach(function () { cols.push(9); });
  cols.push(11, 11, 11);
  return { name: 'Synthèse Financière', paysage: true, cols: cols, rows: rows, merges: ['E7:M7', 'C101:K101'] };
}

function feuilleBucheron(bord, cfg, E) {
  var B = E.syntheseBucheron(bord, cfg);
  var rows = _enteteFeuille(bord.meta, 9);
  rows[6] = ['Essence', 'Nb Tiges', 'Qualité', 'VolBûchSur', 'VolBûchSous', 'VolMarchSous']
    .map(function (t) { return { v: t, s: S_TETE }; });
  rows[7] = [];
  B.lignes.forEach(function (l) {
    if (l.type === 'detail') {
      rows.push([{ v: l.ess, s: S_TXT }, { v: '', s: S_TXT }, { v: l.qual, s: S_TXT },
      { v: l.vsur, s: S_NUM }, { v: l.vsous, s: S_NUM }, { v: l.vmarch, s: S_NUM }]);
    } else {
      rows.push([{ v: 'Total ' + l.ess, s: S_TOTTXT }, { v: l.nbGrumes, s: S_TOTINT }, { v: '', s: S_TOTTXT },
      { v: l.vsur, s: S_TOTNUM }, { v: l.vsous, s: S_TOTNUM }, { v: l.vmarch, s: S_TOTNUM }]);
    }
  });
  rows.push([{ v: 'Total Général', s: S_TOTTXT }, { v: B.nbGrumes, s: S_TOTINT }, { v: '', s: S_TOTTXT },
  { v: B.vsur, s: S_TOTNUM }, { v: B.vsous, s: S_TOTNUM }, { v: B.vmarch, s: S_TOTNUM }]);
  return { name: 'Bûcheron', cols: [14, 10, 9, 12, 12, 13], rows: rows };
}

function feuilleMartelage(bord, cfg, E) {
  var M = E.syntheseMartelage(bord, cfg);
  var rows = _enteteFeuille(bord.meta, 14);
  var r7 = [{ v: 'Parc', s: S_TETE }, { v: 'Ess', s: S_TETE }];
  var r8 = [{ v: '', s: S_TETE }, { v: '', s: S_TETE }];
  E.CLASSES_MART.forEach(function (c, i) { r7.push({ v: i === 0 ? 'Diamètres à 1,30 m' : '', s: S_TETE }); r8.push({ v: c, s: S_TETE }); });
  r7.push({ v: 'Total', s: S_TETE }); r8.push({ v: '', s: S_TETE });
  rows[6] = r7; rows[7] = r8;
  M.lignes.forEach(function (l) {
    var r = [];
    if (l.type === 'detail') {
      r[0] = { v: l.parc, s: S_TXT }; r[1] = { v: l.ess, s: S_TXT };
      l.cells.forEach(function (v, i) { r[2 + i] = { v: v, s: S_INT }; });
      r[26] = { v: l.total, s: S_INT };
    } else {
      r[0] = { v: 'Total ' + l.parc, s: S_TOTTXT }; r[1] = { v: '', s: S_TOTTXT };
      l.cells.forEach(function (v, i) { r[2 + i] = { v: v, s: S_TOTINT }; });
      r[26] = { v: l.total, s: S_TOTINT };
    }
    rows.push(r);
  });
  var t = [{ v: 'Total Général', s: S_TOTTXT }, { v: '', s: S_TOTTXT }];
  M.cells.forEach(function (v) { t.push({ v: v, s: S_TOTINT }); });
  t.push({ v: M.total, s: S_TOTINT });
  rows.push(t);
  var cols = [14, 7];
  E.CLASSES_MART.forEach(function () { cols.push(5); });
  cols.push(8);
  return { name: 'Martelage', paysage: true, cols: cols, rows: rows, merges: ['C7:Z7'] };
}

function construireClasseur(bord, cfg, E) {
  return [
    feuilleVolumes(bord, cfg, E),
    feuilleSynthese(bord, cfg, E),
    feuilleFinanciere(bord, cfg, E),
    feuilleBucheron(bord, cfg, E),
    feuilleMartelage(bord, cfg, E)
  ];
}

var BCW_API = { construireClasseur: construireClasseur };
if (typeof module !== 'undefined' && module.exports) module.exports = BCW_API;
if (typeof window !== 'undefined') window.BCW = BCW_API;

