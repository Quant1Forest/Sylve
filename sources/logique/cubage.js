/* ==========================================================================
   Sylve — moteur de calcul
   Portage fidèle du tableur de cubage d’origine (modules M_Cubage,
   M_Synthèse, M_Synthèse_Bûcheron, M_Synthèse_Financière,
   M_Synthèse_Martelage). Aucune dépendance au DOM : testable seul.
   ========================================================================== */

var PI_BC = 3.141593; // valeur littérale utilisée par le VBA d'origine

/* -------------------------------------------------- utilitaires numériques */

// Équivalent de MyVal() : tolère la virgule décimale, les espaces insécables,
// et s'arrête au premier caractère non numérique (comme Val()).
function toNum(v) {
  if (v === null || v === undefined || v === true || v === false) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v).replace(/[\s\u00A0]/g, '').replace(/,/g, '.');
  var m = s.match(/^[+-]?(\d+(\.\d*)?|\.\d+)/);
  if (!m) return 0;
  var n = parseFloat(m[0]);
  return isFinite(n) ? n : 0;
}

// Application.WorksheetFunction.Round : arrondi au plus proche, 0,5 s'éloigne
// de zéro (différent de Math.round pour les négatifs).
function round2(x) {
  if (!isFinite(x)) return 0;
  var s = x < 0 ? -1 : 1;
  return s * Math.floor(Math.abs(x) * 100 + 0.5) / 100;
}
function roundN(x, n) {
  if (!isFinite(x)) return 0;
  var p = Math.pow(10, n), s = x < 0 ? -1 : 1;
  return s * Math.floor(Math.abs(x) * p + 0.5) / p;
}

// Affichage FR : virgule décimale, nombre de décimales fixe.
/* Sans séparateur, « 6579,60 € » se déchiffre au lieu de se lire. Les milliers
   se détachent donc par une espace insécable : coupables en bout de ligne, un
   nombre se retrouverait scindé en deux. Seule la partie entière se groupe —
   les décimales, jamais. */
function fmt(x, n) {
  if (n === undefined) n = 2;
  if (x === null || x === undefined || x === '' || !isFinite(x)) return '';
  var p = roundN(x, n).toFixed(n).split('.');
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return p.join(',');
}
/* La même chose sans groupement : ce qui part dans un fichier CSV doit rester
   relisible par un tableur, et une espace au milieu d'un nombre l'en empêche. */
function fmtBrut(x, n) {
  if (n === undefined) n = 2;
  if (x === null || x === undefined || x === '' || !isFinite(x)) return '';
  return roundN(x, n).toFixed(n).replace('.', ',');
}
function fmt0(x) { return fmt(x, 0); }

/* ------------------------------------------------------ données de base */

var ESSENCES_DEF = [
  ['EPC', 'EPICEA COMMUN', 0.08], ['S.P', 'SAPIN PECTINE', 0.12],
  ['S.V', 'A.GRANDIS', 0.12], ['ALB', 'ALI.BLANC', 0],
  ['ALT', 'ALI.TORMINAL', 0], ['ALI', 'ALISIERS', 0],
  ['AUL', 'AULNES DIVERS', 0], ['A.F', 'AUT.FEUILLUS', 0],
  ['A.R', 'AUT.RESINEUX', 0], ['EPI', 'AUTRES EPICEA', 0.08],
  ['BOU', 'BOULEAUX DIVERS', 0], ['CED', 'CEDRE', 0],
  ['CHA', 'CHARME', 0], ['CHT', 'CHATAIGNIER', 0],
  ['CHE', 'CHENE', 0], ['DOU', 'DOUGLAS', 0.13],
  ['ERC', 'ER.CHAMPETRE', 0], ['ERO', 'ER.OBIER', 0],
  ['ERP', 'ER.PLANE', 0], ['ERS', 'ER.SYCOMORE', 0],
  ['FRE', 'FRENE', 0], ['FRU', 'FRUITIERS DIV.', 0],
  ['HET', 'HETRE', 0], ['MEL', 'MELEZE', 0.18],
  ['MER', 'MERISIER', 0], ['S.N', 'NORDMANN', 0.12],
  ['NOY', 'NOYER', 0], ['ORM', 'ORME', 0],
  ['PEU', 'PEUPLIER', 0], ['P.N', 'PIN NOIR', 0.20],
  ['P.S', 'PIN SYLVESTRE', 0.14], ['P.W', 'PIN WEYMOUTH', 0.20],
  ['PPP', 'POIRIER-POMMIER', 0], ['ROB', 'ROBINIER', 0],
  ['SAU', 'SAULE', 0], ['SOR', 'SORBIER', 0],
  ['TIL', 'TILLEUL', 0], ['TRE', 'TREMBLE', 0]
].map(function (e) { return { code: e[0], nom: e[1], tx: e[2] }; });

var CLASSEMENTS = ['Class. Comt', 'Class. Qualitatif', 'Class. Chablis', 'Sans Class.'];

var QUALITES_DEF = {
  'Class. Comt': [
    ['V', 'Vert'], ['V1', 'Vert (autre prix)'], ['VS', 'Vert-Sec'],
    ['R', 'Rouge'], ['S', 'Sec'], ['S1', 'Sec2'], ['DG', 'Dorgeux'],
    ['F', 'Foudroyé'], ['Y', 'Scolyté "vert"'], ['G', 'Guité'],
    ['FF', 'Fentes fortes'], ['U1', 'Roulé 1x'], ['U2', 'Roulé 2x'],
    ['U3', 'Roulé 3x'], ['GL', 'Gélivé'], ['CB', 'Courbure'],
    ['Z', 'Nul - hors dimension'], ['Z1', 'Nul']
  ],
  'Class. Qualitatif': [
    ['A', 'Classe A'], ['B', 'Classe B'], ['C', 'Classe C'], ['D', 'Classe D'],
    ['S', 'Sec'], ['F', 'Foudroyé'],
    ['Z', 'Nul - hors dimension'], ['Z1', 'Nul']
  ],
  'Class. Chablis': [
    ['V', 'Vert'], ['V1', 'Vert (autre prix)'], ['VS', 'Vert-Sec'],
    ['R', 'Rouge'], ['S', 'Sec'], ['S1', 'Sec2'], ['F', 'Foudroyé'],
    ['Y', 'Scolyté "vert"'],
    ['Z', 'Nul - hors dimension'], ['Z1', 'Nul']
  ],
  'Sans Class.': [
    ['NC', 'Non classé'],
    ['Z', 'Nul - hors dimension'], ['Z1', 'Nul']
  ]
};
Object.keys(QUALITES_DEF).forEach(function (k) {
  QUALITES_DEF[k] = QUALITES_DEF[k].map(function (q) { return { code: q[0], nom: q[1] }; });
});

/* « Class. Comt », « Class. Qualitatif » : ces intitulés viennent du tableur
   d'origine et servent de clé aux qualités comme au champ meta.classement des
   bordereaux déjà saisis. Les renommer chercherait les qualités dans un tiroir
   vide. Ce tableau ne donne donc que le mot qu'on lit à l'écran. */
var NOM_CLASSEMENT = {
  'Class. Comt': 'Cubage comtois',
  'Class. Qualitatif': 'Classement ABCD',
  'Class. Chablis': 'Chablis',
  'Sans Class.': 'Sans classement'
};
function nomClassement(c) { return NOM_CLASSEMENT[c] || c || ''; }

/* Fiche ONF « Classement qualitatif par catégorie », épicéa et sapin. Le
   classement porte sur des billons fictifs : un A se découpe en 4, 4,5, 5, 8
   ou 9 m et demande 45 cm de médian sur écorce ; B, C et D se comptent par
   4 m et tombent à 20 cm. Sylve prévient, il ne corrige jamais — c'est le
   classeur qui a la grume sous les yeux. */
var CRITERES_ABCD = {
  A: { lon: [4, 4.5, 5, 8, 9], dia: 45 },
  B: { lon: [4], dia: 20 },
  C: { lon: [4], dia: 20 },
  D: { lon: [4], dia: 20 }
};

/* Les codes de défaut du mémento comtois (p. 6) et les notations de réfaction
   du classement ABCD. Ceux de l'ABCD portent leur longueur : -2P, c'est deux
   mètres purgés pour pourriture. C'est ce qui permet de déduire la réfaction
   au lieu de la faire retaper. */
var MOTIFS_REFACTION = {
  'Class. Comt': [
    ['C', 'Courbure excessive'], ['D', 'Dorge'], ['G', 'Gui'], ['R', 'Rouge'],
    ['GEL', 'Gélivure'], ['EE', 'Entre-écorce'], ['P', 'Pourriture']
  ],
  'Class. Chablis': [
    ['C', 'Courbure excessive'], ['D', 'Dorge'], ['G', 'Gui'], ['R', 'Rouge'],
    ['GEL', 'Gélivure'], ['EE', 'Entre-écorce'], ['P', 'Pourriture']
  ],
  'Class. Qualitatif': [
    ['-1P', 'Pourriture, 1 m'], ['-2P', 'Pourriture, 2 m'],
    ['-1D', 'Dorge, 1 m'], ['-2D', 'Dorge, 2 m']
  ],
  'Sans Class.': []
};
function motifsRefaction(classement) { return MOTIFS_REFACTION[classement] || []; }

/* Longueur qu'impliquent les notations retenues : « -1D + -2P » vaut 3 m.
   Ne concerne que l'ABCD, dont les codes portent leur purge ; en comtois la
   longueur se juge sur la grume et reste à la main. */
function longueurMotifs(texte, classement) {
  if (classement !== 'Class. Qualitatif') return null;
  var total = 0, vu = false;
  String(texte || '').split('+').forEach(function (m) {
    var t = m.trim().match(/^-([12])([PD])$/);
    if (t) { total += +t[1]; vu = true; }
  });
  return vu ? total : null;
}

var CLASSES_DIAM = ['Cl 1', 'Cl 2a', 'Cl 2b', 'Cl 3a', 'Cl 3b', 'Cl 4', 'Cl 5', 'Cl 6', 'Cl 7 et +'];
// Classes de diamètre à 1,30 m de la fiche de martelage (feuille Martelage, ligne 8)
var CLASSES_MART = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80,
  85, 90, 95, 100, 105, 110, 115, 120, 125, 130];

function configDefaut() {
  return {
    essences: ESSENCES_DEF.map(function (e) { return { code: e.code, nom: e.nom, tx: e.tx }; }),
    qualites: JSON.parse(JSON.stringify(QUALITES_DEF)),
    seuilDiamSAP: 18,
    seuilDiamEPC: 18,
    seuilLongueur: 4,
    mode: 'historique',      // 'historique' | 'corrige'
    favoris: ['EPC', 'S.P', 'DOU', 'HET', 'CHE', 'FRE']
  };
}

function txEcorce(code, cfg) {
  var e = (cfg.essences || []).filter(function (x) { return x.code === code; })[0];
  return e ? (toNum(e.tx) || 0) : 0;
}
function nomEssence(code, cfg) {
  var e = (cfg.essences || []).filter(function (x) { return x.code === code; })[0];
  return e ? e.nom : code;
}
function nomQualite(code, classement, cfg) {
  var l = (cfg.qualites || {})[classement] || [];
  var q = l.filter(function (x) { return x.code === code; })[0];
  return q ? q.nom : code;
}

/* ---------------------------------------------------------------- cubage */

// Classe de diamètre médian sous écorce.
// dRef = diamètre servant à la coupure a/b :
//   mode 'historique'  -> diamètre saisi (calcul des anciens bordereaux)
//   mode 'corrige'     -> diamètre sous écorce (cohérent avec l'intitulé)
function classeDiam(dSous, dRef) {
  var c = Math.floor(dSous / 10);
  if (c < 1) c = 1;                       // corrige : Cl 0 laissait la cellule vide
  if (c > 6) return 'Cl 7 et +';
  if (c === 2) return dRef < 26 ? 'Cl 2a' : 'Cl 2b';
  if (c === 3) return dRef < 36 ? 'Cl 3a' : 'Cl 3b';
  return 'Cl ' + c;
}

// Cube un billon. meta.mesures vaut 'sur' ou 'sous'.
function cuber(l, meta, cfg) {
  var tx = txEcorce(l.ess, cfg);
  var L = toNum(l.lon), D = toNum(l.dia);
  var ref = Math.abs(toNum(l.refl));
  if (ref > L) ref = L;                   // corrige : évitait un volume négatif
  var base = PI_BC * Math.pow(D / 200, 2);
  var sous = meta.mesures === 'sous';
  var k = 1 - tx;
  var vsur = sous ? (k ? base * L / k : 0) : base * L;
  var vsous = sous ? base * L : base * L * k;
  var vmarch = sous ? base * (L - ref) : base * (L - ref) * k;
  var dSous = sous ? D : D * Math.sqrt(k);
  var dRef = (cfg.mode === 'corrige') ? dSous : D;
  return {
    vsur: round2(vsur), vsous: round2(vsous), vmarch: round2(vmarch),
    dSous: dSous,
    clDiam: D > 0 ? classeDiam(dSous, dRef) : '',
    clMini: D > 0 ? 'Cl ' + Math.floor(D / 10) : ''
  };
}

// Énumère les longueurs permises : « 4, 4,5, 5, 8 ou 9 m ».
function listeLongueurs(l) {
  var t = l.map(function (x) { return fmt(x, x % 1 ? 1 : 0); });
  return (t.length > 1 ? t.slice(0, -1).join(', ') + ' ou ' + t[t.length - 1] : t[0]) + ' m';
}

/* Ce que la fiche ONF attend d'un billon fictif, confronté à ce qui est saisi.
   Rend des phrases, jamais un refus : la classe se juge sur la grume, et Sylve
   n'a que deux nombres sous la main. Muet hors du classement ABCD. */
function controlerBillon(l, meta, cfg) {
  var avis = [];
  if (!meta || meta.classement !== 'Class. Qualitatif') return avis;
  var c = CRITERES_ABCD[l.qual];
  if (!c) return avis;
  var L = toNum(l.lon), D = toNum(l.dia);
  if (L > 0 && !c.lon.some(function (x) { return Math.abs(x - L) < 0.01; })) {
    avis.push('Un billon ' + l.qual + ' se compte par ' + listeLongueurs(c.lon) +
      ' — celui-ci fait ' + fmt(L, 2) + ' m.');
  }
  if (D > 0) {
    /* La fiche mesure sur écorce. Un bordereau tenu sous écorce doit donc être
       remonté avant comparaison, par la même racine que cuber(). */
    var k = 1 - txEcorce(l.ess, cfg);
    var dSur = (meta.mesures === 'sous' && k > 0) ? D / Math.sqrt(k) : D;
    if (dSur < c.dia) {
      avis.push('Un billon ' + l.qual + ' demande ' + fmt(c.dia, 0) +
        ' cm de médian sur écorce — celui-ci en fait ' + fmt(dSur, 0) + '.');
    }
  }
  var attendue = longueurMotifs(l.refn, meta.classement);
  if (attendue !== null) {
    var portee = Math.abs(toNum(l.refl));
    if (Math.abs(attendue - portee) > 0.01) {
      avis.push('Les notations portées valent ' + fmt(attendue, 0) +
        ' m de réfaction, la ligne en compte ' + fmt(portee, 2) + '.');
    }
  }
  return avis;
}

// Cube tout le bordereau : renvoie les lignes enrichies (champ .c).
function cuberTout(bord, cfg) {
  return (bord.lignes || []).map(function (l) {
    var o = Object.assign({}, l);
    o.c = cuber(l, bord.meta, cfg);
    return o;
  });
}

/* ------------------------------------------- billons de valeur nulle (Z) */

// Seuils effectifs. En mode historique on reproduit le tableur d’origine, qui applique
// toujours l'abattement d'écorce (le test lisait la cellule F2, vide, au lieu
// de J1) et tronque le résultat à l'entier (variables déclarées As Integer).
function seuilsNuls(bord, cfg) {
  var sL = toNum(cfg.seuilLongueur), sSAP = toNum(cfg.seuilDiamSAP), sEPC = toNum(cfg.seuilDiamEPC);
  var appliquer = (cfg.mode === 'corrige') ? (bord.meta.mesures === 'sous') : true;
  if (appliquer) {
    sSAP = Math.round(sSAP * (1 - txEcorce('S.P', cfg) / 2));
    sEPC = Math.round(sEPC * (1 - txEcorce('EPC', cfg) / 2));
  }
  return { lon: sL, 'S.P': sSAP, 'EPC': sEPC };
}

// Repère les incohérences et les billons à passer en Z.
function analyserNuls(bord, cfg) {
  var s = seuilsNuls(bord, cfg);
  var faussementZ = [], aPasserZ = [], dejaZ = 0;
  (bord.lignes || []).forEach(function (l, i) {
    var L = toNum(l.lon), D = toNum(l.dia), seuil = s[l.ess];
    var nul = false;
    if (L < s.lon) nul = true;
    else if (seuil !== undefined) nul = (D <= seuil);
    if (l.qual === 'Z' && !nul && seuil !== undefined) faussementZ.push(l.num);
    if (nul) { if (l.qual === 'Z') dejaZ++; else aPasserZ.push({ i: i, num: l.num }); }
  });
  return { seuils: s, faussementZ: faussementZ, aPasserZ: aPasserZ, dejaZ: dejaZ };
}

/* ------------------------------------------------------------- synthèses */

function nbGrumes(lignes) {
  return lignes.filter(function (l) { return String(l.bp === true ? 'VRAI' : (l.bp == null ? '' : l.bp)).trim() !== ''; }).length;
}

// Nb de plaquettes : NB_PLAQ() = nb de lignes + nb de tirets dans les n°.
function nbPlaquettes(lignes) {
  return lignes.reduce(function (a, l) {
    return a + 1 + (String(l.num == null ? '' : l.num).split('-').length - 1);
  }, 0);
}

// Couples essence/qualité présents, triés (comme Call tri()).
function couples(lignes) {
  var vus = {}, out = [];
  lignes.forEach(function (l) {
    var k = (l.ess || '') + '\u0000' + (l.qual || '');
    if (!vus[k]) { vus[k] = 1; out.push({ ess: l.ess || '', qual: l.qual || '' }); }
  });
  out.sort(function (a, b) {
    return (a.ess + a.qual).localeCompare(b.ess + b.qual, 'fr');
  });
  return out;
}
function essencesPresentes(lignes) {
  var vus = {}, out = [];
  couples(lignes).forEach(function (c) { if (!vus[c.ess]) { vus[c.ess] = 1; out.push(c.ess); } });
  return out;
}

// Feuille « Synthèse » : essence × qualité × classe de diamètre.
function synthese(bord, cfg) {
  var L = cuberTout(bord, cfg);
  var lignes = [], totalGen = 0;
  var essL = essencesPresentes(L);
  var volEss = {}, grumesEss = {};
  essL.forEach(function (e) {
    var sub = L.filter(function (x) { return x.ess === e; });
    volEss[e] = round2(sub.reduce(function (a, x) { return a + x.c.vmarch; }, 0));
    grumesEss[e] = nbGrumes(sub);
  });
  couples(L).forEach(function (c, idx, arr) {
    var sub = L.filter(function (x) { return x.ess === c.ess && x.qual === c.qual; });
    var cells = CLASSES_DIAM.map(function (cl) {
      var s = sub.filter(function (x) { return x.c.clDiam === cl; });
      return { nb: s.length, vol: round2(s.reduce(function (a, x) { return a + x.c.vmarch; }, 0)) };
    });
    var volQual = round2(cells.reduce(function (a, x) { return a + x.vol; }, 0));
    lignes.push({
      type: 'detail', ess: c.ess, qual: c.qual, nbBillons: sub.length,
      cells: cells, volQual: volQual,
      pct: volEss[c.ess] ? volQual / volEss[c.ess] : 0
    });
    var suivant = arr[idx + 1];
    if (!suivant || suivant.ess !== c.ess) {
      var subE = L.filter(function (x) { return x.ess === c.ess; });
      lignes.push({
        type: 'total', ess: c.ess, nbGrumes: grumesEss[c.ess], nbBillons: subE.length,
        volEss: volEss[c.ess], vam: grumesEss[c.ess] ? volEss[c.ess] / grumesEss[c.ess] : 0
      });
    }
  });
  totalGen = round2(L.reduce(function (a, x) { return a + x.c.vmarch; }, 0));
  return {
    lignes: lignes, totalGen: totalGen, nbGrumes: nbGrumes(L),
    nbBillons: L.length, nbPlaq: nbPlaquettes(L)
  };
}

// Feuille « Bûcheron » : volumes sur / sous / marchand par essence et qualité.
function syntheseBucheron(bord, cfg) {
  var L = cuberTout(bord, cfg), lignes = [];
  couples(L).forEach(function (c, idx, arr) {
    var sub = L.filter(function (x) { return x.ess === c.ess && x.qual === c.qual; });
    lignes.push({
      type: 'detail', ess: c.ess, qual: c.qual,
      vsur: round2(sub.reduce(function (a, x) { return a + x.c.vsur; }, 0)),
      vsous: round2(sub.reduce(function (a, x) { return a + x.c.vsous; }, 0)),
      vmarch: round2(sub.reduce(function (a, x) { return a + x.c.vmarch; }, 0))
    });
    var suivant = arr[idx + 1];
    if (!suivant || suivant.ess !== c.ess) {
      var subE = L.filter(function (x) { return x.ess === c.ess; });
      lignes.push({
        type: 'total', ess: c.ess, nbGrumes: nbGrumes(subE),
        vsur: round2(subE.reduce(function (a, x) { return a + x.c.vsur; }, 0)),
        vsous: round2(subE.reduce(function (a, x) { return a + x.c.vsous; }, 0)),
        vmarch: round2(subE.reduce(function (a, x) { return a + x.c.vmarch; }, 0))
      });
    }
  });
  return {
    lignes: lignes, nbGrumes: nbGrumes(L),
    vsur: round2(L.reduce(function (a, x) { return a + x.c.vsur; }, 0)),
    vsous: round2(L.reduce(function (a, x) { return a + x.c.vsous; }, 0)),
    vmarch: round2(L.reduce(function (a, x) { return a + x.c.vmarch; }, 0))
  };
}

// Feuille « Martelage » : tiges par parcelle × essence × classe de D 1,30.
// Le tableur d’origine exigeait un multiple exact de 5 et perdait silencieusement les
// autres valeurs : on classe désormais à la classe de 5 cm la plus proche.
function classeMartelage(d) {
  if (!(d > 0)) return null;
  var c = Math.round(d / 5) * 5;
  if (c < CLASSES_MART[0]) c = CLASSES_MART[0];
  if (c > CLASSES_MART[CLASSES_MART.length - 1]) c = CLASSES_MART[CLASSES_MART.length - 1];
  return c;
}
function syntheseMartelage(bord, cfg) {
  var L = cuberTout(bord, cfg);
  var tiges = [];
  L.forEach(function (l) {
    if (typeof l.bp === 'number' || (l.bp !== true && l.bp !== '' && l.bp != null && isFinite(toNum(l.bp)) && toNum(l.bp) > 0)) {
      var c = classeMartelage(toNum(l.bp));
      if (c) tiges.push({ parc: String(l.parc || bord.meta.parcelles || '').trim(), ess: l.ess, cl: c });
    }
  });
  var cles = [], vus = {};
  tiges.forEach(function (t) {
    var k = t.parc + '\u0000' + t.ess;
    if (!vus[k]) { vus[k] = 1; cles.push({ parc: t.parc, ess: t.ess }); }
  });
  cles.sort(function (a, b) { return (a.parc + a.ess).localeCompare(b.parc + b.ess, 'fr'); });
  var lignes = [];
  cles.forEach(function (c, idx, arr) {
    var sub = tiges.filter(function (t) { return t.parc === c.parc && t.ess === c.ess; });
    var cells = CLASSES_MART.map(function (cl) { return sub.filter(function (t) { return t.cl === cl; }).length; });
    lignes.push({ type: 'detail', parc: c.parc, ess: c.ess, cells: cells, total: sub.length });
    var suivant = arr[idx + 1];
    if (!suivant || suivant.parc !== c.parc) {
      var subP = tiges.filter(function (t) { return t.parc === c.parc; });
      lignes.push({
        type: 'total', parc: c.parc,
        cells: CLASSES_MART.map(function (cl) { return subP.filter(function (t) { return t.cl === cl; }).length; }),
        total: subP.length
      });
    }
  });
  return {
    lignes: lignes,
    cells: CLASSES_MART.map(function (cl) { return tiges.filter(function (t) { return t.cl === cl; }).length; }),
    total: tiges.length
  };
}

// Feuille « Synthèse Financière ».
// Le prix peut être saisi à trois niveaux ; le calcul d’origine retient le MAX des trois
// montants possibles (formule MAX(...) de la colonne N, ligne « Total »).
function syntheseFinanciere(bord, cfg) {
  var L = cuberTout(bord, cfg);
  var prix = bord.prix || {};
  var lignes = [], essL = essencesPresentes(L), totaux = {}, montantGen = 0;
  couples(L).forEach(function (c, idx, arr) {
    var sub = L.filter(function (x) { return x.ess === c.ess && x.qual === c.qual; });
    var cells = CLASSES_DIAM.map(function (cl) {
      return round2(sub.filter(function (x) { return x.c.clDiam === cl; })
        .reduce(function (a, x) { return a + x.c.vmarch; }, 0));
    });
    lignes.push({
      type: 'detail', ess: c.ess, qual: c.qual, nbBillons: sub.length,
      cells: cells, volQual: round2(cells.reduce(function (a, x) { return a + x; }, 0))
    });
    var suivant = arr[idx + 1];
    if (!suivant || suivant.ess !== c.ess) {
      var subE = L.filter(function (x) { return x.ess === c.ess; });
      var volE = round2(subE.reduce(function (a, x) { return a + x.c.vmarch; }, 0));
      var nbG = nbGrumes(subE);
      // trois montants candidats
      var mGrille = 0, mQual = 0;
      lignes.filter(function (r) { return r.type === 'detail' && r.ess === c.ess; }).forEach(function (r) {
        var p = prix[r.ess + '|' + r.qual] || {};
        CLASSES_DIAM.forEach(function (cl, k) { mGrille += toNum((p.cl || {})[cl]) * r.cells[k]; });
        mQual += toNum(p.qual) * r.volQual;
      });
      var mEss = toNum((prix[c.ess + '|*'] || {}).ess) * volE;
      var montant = Math.max(mGrille, mQual, mEss);
      totaux[c.ess] = { volEss: volE, montant: montant };
      montantGen += montant;
      lignes.push({
        type: 'total', ess: c.ess, nbGrumes: nbG, nbBillons: subE.length,
        volEss: volE, vam: nbG ? volE / nbG : 0,
        montant: montant, pu: volE ? montant / volE : 0,
        niveau: montant === 0 ? '' : (montant === mGrille ? 'grille' : (montant === mQual ? 'qualité' : 'essence'))
      });
    }
  });
  var volGen = round2(L.reduce(function (a, x) { return a + x.c.vmarch; }, 0));
  return {
    lignes: lignes, essences: essL, totaux: totaux,
    volGen: volGen, montantGen: montantGen,
    puGen: volGen ? montantGen / volGen : 0,
    nbGrumes: nbGrumes(L), nbPlaq: nbPlaquettes(L)
  };
}

/* ------------------------------------------------- numérotation plaquettes */

// « A-125 » -> {prefixe:'A-', n:125, m:0}
function parseNum(v) {
  var s = String(v == null ? '' : v).trim();
  var i = s.lastIndexOf('-');
  var prefixe = i >= 0 ? s.slice(0, i + 1) : '';
  var reste = i >= 0 ? s.slice(i + 1) : s;
  var m = reste.replace(',', '.').match(/^(\d+)(?:\.(\d+))?/);
  if (!m) return { prefixe: prefixe, n: null, m: 0, brut: s };
  return { prefixe: prefixe, n: parseInt(m[1], 10), m: m[2] ? parseInt(m[2], 10) : 0, brut: s };
}
function formatNum(p) {
  if (p.n === null) return p.brut;
  return p.prefixe + p.n + (p.m ? '.' + p.m : '');
}
// Numéro suivant. qualitatif : une plaquette par grume, billons en décimales.
function numSuivant(v, qualitatif, memeGrume) {
  var p = parseNum(v);
  if (p.n === null) return '';
  if (!qualitatif) return formatNum({ prefixe: p.prefixe, n: p.n + 1, m: 0 });
  if (memeGrume) return formatNum({ prefixe: p.prefixe, n: p.n, m: (p.m || 1) + 1 });
  return formatNum({ prefixe: p.prefixe, n: p.n + 1, m: 1 });
}

/* ------------------------------------------------------------ exports */
var BC_API = {
    toNum: toNum, round2: round2, roundN: roundN, fmt: fmt, fmtBrut: fmtBrut,
    ESSENCES_DEF: ESSENCES_DEF, QUALITES_DEF: QUALITES_DEF, CLASSEMENTS: CLASSEMENTS,
    CLASSES_DIAM: CLASSES_DIAM, CLASSES_MART: CLASSES_MART,
    configDefaut: configDefaut, txEcorce: txEcorce, nomEssence: nomEssence, nomQualite: nomQualite,
    NOM_CLASSEMENT: NOM_CLASSEMENT, nomClassement: nomClassement,
    CRITERES_ABCD: CRITERES_ABCD, controlerBillon: controlerBillon,
    MOTIFS_REFACTION: MOTIFS_REFACTION, motifsRefaction: motifsRefaction,
    longueurMotifs: longueurMotifs, listeLongueurs: listeLongueurs,
    classeDiam: classeDiam, cuber: cuber, cuberTout: cuberTout,
    seuilsNuls: seuilsNuls, analyserNuls: analyserNuls,
    nbGrumes: nbGrumes, nbPlaquettes: nbPlaquettes, couples: couples,
    synthese: synthese, syntheseBucheron: syntheseBucheron,
    syntheseMartelage: syntheseMartelage, syntheseFinanciere: syntheseFinanciere,
  parseNum: parseNum, formatNum: formatNum, numSuivant: numSuivant
};
if (typeof module !== 'undefined' && module.exports) module.exports = BC_API;
if (typeof window !== 'undefined') window.BC = BC_API;

