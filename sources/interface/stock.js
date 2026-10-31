/* ================================================ STOCK DE FOURNITURES
   Trois tables tenues à la main — les commandes, les sorties, les pertes —
   et un inventaire qui n'est que leur résultat. C'est l'organisation du
   tableur : on ne saisit jamais un stock, on saisit ce qui entre et ce qui
   sort, et le stock se déduit.
   ====================================================================== */
var ST = window.BCS2;

function article(id) { return A.articles.filter(function (a) { return a.id === id; })[0] || null; }
function sauverArticles() { return ecrire('bordcub.articles', A.articles); }
function sauverCommandes() { return ecrire('bordcub.commandes', A.commandes); }
function sauverSorties() { return ecrire('bordcub.sorties', A.sorties); }
function sauverFournisseurs() { return ecrire('bordcub.fournisseurs', A.fournisseurs); }
function commande(id) { return (A.commandes || []).filter(function (c) { return c.id === id; })[0] || null; }
function sortie(id) { return (A.sorties || []).filter(function (s) { return s.id === id; })[0] || null; }
function fournisseur(id) {
  return (A.fournisseurs || []).filter(function (f) { return f.id === id; })[0] || null;
}
function nomFournisseur(id) {
  var f = fournisseur(id);
  return f ? (f.nom || '') : (id || '');
}

/* --------------------------------------------------------------- reprise
   Les fournisseurs étaient de simples noms ; les mouvements vivaient dans
   la fiche article. On reconstruit une fois des commandes et des sorties à
   partir de l'ancien format, sans rien effacer : les anciennes données
   restent dans le fichier de sauvegarde. */
function migrerStock() {
  var faites = false;
  A.fournisseurs = (A.fournisseurs || []).map(function (f) {
    if (typeof f !== 'string') return f;
    faites = true;
    return { id: uid(), nom: f };
  });
  if (A.cfg && A.cfg.stockMigre) { if (faites) sauverFournisseurs(); return faites; }

  var cmds = {}, srts = {};
  (A.articles || []).forEach(function (a) {
    (a.mouvements || []).forEach(function (m) {
      var jour = ST.arr((m.date || 0) / 86400000, 0);
      if (m.sens === 'entree') {
        var k = (m.commande || '') + '|' + jour;
        if (!cmds[k]) cmds[k] = { id: uid(), num: m.commande || '', dateCmd: m.date, dateLiv: m.date,
          fournisseur: idFournisseurParNom(m.fournisseur), statut: 'recu', livraison: 0, lignes: [] };
        cmds[k].livraison += ST.nb(m.qte) * ST.nb(m.fraisUnit);
        cmds[k].lignes.push({ article: a.id, qte: ST.nb(m.qte), prix: ST.nb(m.prix) });
      } else {
        var k2 = (m.chantier || '') + '|' + jour;
        if (!srts[k2]) srts[k2] = { id: uid(), num: '', date: m.date, client: '',
          chantier: m.chantier || null, statut: 'fini', perte: false, lignes: [] };
        srts[k2].lignes.push({ article: a.id, qte: ST.nb(m.qte), prix: 0 });
      }
    });
  });
  var lc = Object.keys(cmds).map(function (k) { return cmds[k]; });
  var ls = Object.keys(srts).map(function (k) { return srts[k]; });
  A.commandes = (A.commandes || []).concat(lc);
  A.sorties = (A.sorties || []).concat(ls);
  A.cfg = A.cfg || {};
  A.cfg.stockMigre = true;
  if (lc.length) sauverCommandes();
  if (ls.length) sauverSorties();
  sauverFournisseurs();
  sauverCfg();
  return true;
}
function idFournisseurParNom(nom) {
  if (!nom) return null;
  var n = String(nom).trim().toLowerCase();
  var f = (A.fournisseurs || []).filter(function (x) {
    return (x.nom || '').trim().toLowerCase() === n;
  })[0];
  if (f) return f.id;
  f = { id: uid(), nom: String(nom).trim() };
  A.fournisseurs.push(f);
  return f.id;
}

/* ============================================== IMPORT DE FOURNITURES
   Un tableur exporté en CSV, déposé ici, remplit le stock sans une seule
   saisie. Trois formes reconnues à l'en-tête : un catalogue de produits,
   des commandes, des sorties. Rien n'est écrit avant d'avoir été montré.
   ====================================================================== */

function normCol(x) {
  return String(x || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
/* Les en-têtes acceptés pour chaque colonne, en français courant. */
var COLS_STOCK = {
  produit: ['produit', 'article', 'nom', 'designation', 'libelle'],
  designation: ['designationcomplete', 'description', 'categoriedinventaire', 'categorie'],
  type: ['type'],
  unite: ['unite', 'u'],
  fournisseur: ['fournisseur'],
  seuil: ['seuil', 'seuildalerte', 'stockmini', 'mini'],
  dosage: ['dosage', 'dosageparplant'],
  commande: ['commande', 'ncommande', 'numerodecommande', 'bon'],
  date: ['date', 'datedelivraison', 'datelivraison', 'datedecommande', 'datefacture'],
  quantite: ['quantite', 'qte', 'qtecommandee', 'nombre'],
  prix: ['prix', 'prixunitaire', 'pu', 'puht', 'prixdevente'],
  livraison: ['livraison', 'fraisdelivraison', 'port', 'transport'],
  client: ['client', 'destinataire', 'acheteur'],
  facture: ['facture', 'nfacture', 'numerodefacture', 'numero', 'piece'],
  debours: ['debours'],
  statut: ['statut', 'etat']
};
/* Les statuts du tableur, écrits en clair, avec ou sans pictogramme. */
function statutSortieCsv(x) {
  var v = normCol(x);
  if (!v) return 'fini';
  if (v.indexOf('annul') >= 0) return 'annule';
  if (v.indexOf('cours') >= 0) return 'encours';
  if (v.indexOf('accept') >= 0) return 'accepte';
  if (v.indexOf('prevoir') >= 0) return 'aprevoir';
  if (v.indexOf('potentiel') >= 0) return 'potentiel';
  return 'fini';
}
function indexerColonnes(entete) {
  var idx = {};
  entete.forEach(function (c, i) {
    var n = normCol(c);
    Object.keys(COLS_STOCK).forEach(function (k) {
      if (idx[k] == null && COLS_STOCK[k].indexOf(n) >= 0) idx[k] = i;
    });
  });
  return idx;
}

function analyseCsvStock(txt) {
  var l = C.decoupeCsv(txt);
  if (l.length < 2) return { erreurs: ['Le fichier ne contient aucune ligne de données.'] };
  var idx = indexerColonnes(l[0]);
  if (idx.produit == null) {
    return { erreurs: ['Aucune colonne « produit » trouvée. En-têtes lus : ' +
      l[0].filter(Boolean).join(', ')] };
  }
  var type = idx.commande != null ? 'commandes'
    : (idx.client != null || idx.prix != null) && idx.quantite != null ? 'sorties'
      : idx.quantite != null ? 'commandes' : 'produits';
  var lue = function (r, k) { return idx[k] != null ? r[idx[k]] : ''; };
  var erreurs = [], lignes = [];
  for (var i = 1; i < l.length; i++) {
    var r = l[i];
    var nom = String(lue(r, 'produit') || '').trim();
    if (!nom) { continue; }
    if (type !== 'produits' && ST.nb(lue(r, 'quantite')) <= 0) {
      erreurs.push('Ligne ' + (i + 1) + ' : quantité absente ou nulle.');
      continue;
    }
    lignes.push({
      produit: nom, designation: String(lue(r, 'designation') || '').trim(),
      type: String(lue(r, 'type') || '').trim(), unite: String(lue(r, 'unite') || '').trim(),
      fournisseur: String(lue(r, 'fournisseur') || '').trim(),
      seuil: ST.nb(lue(r, 'seuil')), dosage: ST.nb(lue(r, 'dosage')),
      commande: String(lue(r, 'commande') || '').trim(),
      date: C.dateFr(lue(r, 'date')), quantite: ST.nb(lue(r, 'quantite')),
      prix: ST.nb(lue(r, 'prix')), livraison: ST.nb(lue(r, 'livraison')),
      client: String(lue(r, 'client') || '').trim(),
      facture: String(lue(r, 'facture') || '').trim(),
      debours: /oui|x|1|vrai/i.test(String(lue(r, 'debours') || '')),
      statut: statutSortieCsv(lue(r, 'statut'))
    });
  }
  if (!lignes.length) erreurs.unshift('Aucune ligne exploitable.');
  return { type: type, lignes: lignes, erreurs: erreurs };
}

/* Ce que l'import va créer, montré avant d'écrire quoi que ce soit. */
function apercuImportStock(r) {
  var prod = {}, four = {}, cmds = {}, srts = {}, neufs = 0;
  r.lignes.forEach(function (x) {
    var bas = x.produit.toLowerCase();
    if (!prod[bas]) {
      prod[bas] = x;
      if (!A.articles.some(function (a) { return (a.nom || '').toLowerCase() === bas; })) neufs++;
    }
    if (x.fournisseur) four[x.fournisseur.toLowerCase()] = x.fournisseur;
    if (r.type === 'commandes') cmds[x.commande + '|' + (x.date || '')] = 1;
    if (r.type === 'sorties') srts[x.client + '|' + (x.date || '')] = 1;
  });
  return { produits: Object.keys(prod).length, nouveaux: neufs,
    fournisseurs: Object.keys(four).length,
    commandes: Object.keys(cmds).length, sorties: Object.keys(srts).length };
}

function ouvrirImportStock() {
  modale('Importer des fournitures',
    '<p class="muted" style="font-size:12.5px;margin:0 0 12px">Un fichier CSV exporté depuis ' +
    'un tableur, ou une sauvegarde Sylve. Rien n’est enregistré avant que vous ne validiez.</p>' +
    '<div class="btn-rang"><label class="btn primaire" style="cursor:pointer">Choisir un fichier' +
    '<input type="file" accept=".csv,.json,text/csv,application/json" id="is-fichier" hidden></label>' +
    '<button class="btn btn-min" id="is-modele">Modèle CSV</button></div>' +
    '<div id="is-resultat"></div>' +
    '<div class="carte2" style="margin-top:12px">' +
    '<b style="font-size:13px">Colonnes reconnues</b>' +
    '<p class="muted" style="font-size:12px;margin:5px 0 0">' +
    '<b>Produits</b> — produit, désignation, type, unité, fournisseur, seuil, dosage<br>' +
    '<b>Commandes</b> — commande, date, fournisseur, produit, quantité, prix, livraison<br>' +
    '<b>Sorties</b> — date, client, produit, quantité, prix, statut, débours</p>' +
    '<p class="muted" style="font-size:11.5px;margin:7px 0 0">La forme est devinée à l’en-tête. ' +
    'Les produits et fournisseurs inconnus sont créés au passage.</p></div>');
  A.impStock = null;
  $('#is-fichier').addEventListener('change', function () {
    if (this.files && this.files[0]) lireFichierStock(this.files[0]);
    this.value = '';
  });
  $('#is-modele').addEventListener('click', function () {
    telecharger('Sylve-modele-commandes.csv',
      'commande;date;fournisseur;produit;quantite;prix;livraison\n' +
      'CMD-001;05/11/2025;Mon fournisseur;Gaine de protection 14*120;500;0,70;265\n' +
      'CMD-001;05/11/2025;Mon fournisseur;Tuteur en châtaignier;1500;0,60;\n', 'text/csv');
  });
  $('#is-resultat').addEventListener('click', function (e) {
    if (e.target.closest('#is-ok')) validerImportStock();
    else if (e.target.closest('#is-annuler')) { A.impStock = null; renderImportStock(); }
  });
}

function lireFichierStock(file) {
  var fr = new FileReader();
  fr.onload = function () {
    var txt = String(fr.result);
    if (/\.json$/i.test(file.name) || txt.trim().charAt(0) === '{') {
      var o = null;
      try { o = JSON.parse(txt); } catch (e) { toast('Fichier illisible.'); return; }
      fermerModale(); demanderRestauration(o, file.name);
      return;
    }
    A.impStock = analyseCsvStock(txt);
    A.impStock.nom = file.name;
    renderImportStock();
  };
  fr.onerror = function () { toast('Lecture impossible.'); };
  fr.readAsText(file, 'utf-8');
}

function renderImportStock() {
  var z = $('#is-resultat'); if (!z) return;
  var r = A.impStock;
  if (!r) { z.innerHTML = ''; return; }
  if (!r.lignes || !r.lignes.length) {
    z.innerHTML = '<div class="carte2" style="margin-top:12px;border-color:#B4231F">' +
      '<b style="font-size:13.5px">Rien à importer</b>' +
      '<ul style="margin:6px 0 0;padding-left:18px;font-size:12.5px" class="muted">' +
      (r.erreurs || []).slice(0, 6).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') +
      '</ul></div>';
    return;
  }
  var a = apercuImportStock(r);
  var NOM = { produits: 'un catalogue de produits', commandes: 'des commandes', sorties: 'des sorties' };
  z.innerHTML = '<div class="carte2" style="margin-top:12px">' +
    '<b style="font-size:13.5px">' + esc(r.nom) + ' — ' + NOM[r.type] + '</b>' +
    '<div class="muted" style="font-size:12.5px;margin-top:5px">' +
    E.fmt(r.lignes.length, 0) + ' ligne' + (r.lignes.length > 1 ? 's' : '') + ' · ' +
    a.produits + ' produit' + (a.produits > 1 ? 's' : '') +
    (a.nouveaux ? ' dont ' + a.nouveaux + ' à créer' : ' déjà connus') +
    (a.fournisseurs ? ' · ' + a.fournisseurs + ' fournisseur' + (a.fournisseurs > 1 ? 's' : '') : '') +
    (r.type === 'commandes' && a.commandes ? ' · ' + a.commandes + ' commande' + (a.commandes > 1 ? 's' : '') : '') +
    (r.type === 'sorties' && a.sorties ? ' · ' + a.sorties + ' sortie' + (a.sorties > 1 ? 's' : '') : '') +
    '</div>' +
    (r.erreurs && r.erreurs.length ? '<ul style="margin:7px 0 0;padding-left:18px;font-size:12px;color:#B98A00">' +
      r.erreurs.slice(0, 4).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') +
      (r.erreurs.length > 4 ? '<li>et ' + (r.erreurs.length - 4) + ' autres</li>' : '') + '</ul>' : '') +
    '<div class="btn-rang" style="margin-top:10px">' +
    '<button class="btn primaire" id="is-ok">Importer</button>' +
    '<button class="btn btn-min" id="is-annuler">Annuler</button></div></div>';
}

function validerImportStock() {
  var r = A.impStock; if (!r || !r.lignes.length) return;
  var TYPES = { protection: 'protection', tuteur: 'tuteur', piquet: 'tuteur',
    traitement: 'traitement', repulsif: 'traitement', plant: 'plant', consommable: 'consommable' };
  var UNITES = { ml: 'ml', l: 'litre', litre: 'litre', kg: 'kg', m: 'metre', metre: 'metre' };

  /* Retrouver ou créer un produit, sans jamais en dupliquer un existant. */
  var trouveArt = function (x) {
    var bas = x.produit.toLowerCase();
    var a = A.articles.filter(function (y) { return (y.nom || '').toLowerCase() === bas; })[0];
    if (a) return a;
    var t = 'autre';
    Object.keys(TYPES).forEach(function (k) {
      if (t === 'autre' && (normCol(x.type) === normCol(k) || bas.indexOf(k) >= 0)) t = TYPES[k];
    });
    a = { id: uid(), nom: x.produit, designation: x.designation || '', type: t,
      unite: UNITES[normCol(x.unite)] || 'unite', seuil: x.seuil || null,
      dosage: x.dosage || null, fournisseur: x.fournisseur ? idFournisseurParNom(x.fournisseur) : null,
      mouvements: [], maj: Date.now() };
    A.articles.push(a);
    return a;
  };

  var nc = 0, ns = 0;
  if (r.type === 'produits') {
    r.lignes.forEach(trouveArt);
  } else if (r.type === 'commandes') {
    var cmds = {};
    r.lignes.forEach(function (x) {
      var k = x.commande + '|' + (x.date || '');
      if (!cmds[k]) {
        cmds[k] = { id: uid(), num: x.commande || '', dateCmd: x.date || Date.now(),
          dateLiv: x.date || Date.now(),
          fournisseur: x.fournisseur ? idFournisseurParNom(x.fournisseur) : null,
          statut: 'recu', livraison: 0, lignes: [], maj: Date.now() };
        A.commandes.push(cmds[k]); nc++;
      }
      cmds[k].livraison = ST.arr(cmds[k].livraison + x.livraison, 2);
      cmds[k].lignes.push({ article: trouveArt(x).id, qte: x.quantite, prix: x.prix });
    });
  } else {
    var srts = {};
    r.lignes.forEach(function (x) {
      /* Une facture regroupe ses lignes ; sans numéro on retombe sur le
         couple client et date. */
      var k = x.facture || (x.client + '|' + (x.date || ''));
      if (!srts[k]) {
        srts[k] = { id: uid(), num: x.facture || '', date: x.date || Date.now(),
          client: x.client || '',
          chantier: null, statut: x.statut || 'fini', perte: false, debours: x.debours,
          lignes: [], maj: Date.now() };
        A.sorties.push(srts[k]); ns++;
      }
      srts[k].lignes.push({ article: trouveArt(x).id, qte: x.quantite, prix: x.prix });
    });
  }

  /* Les clients rencontrés dans le fichier rejoignent la liste : c'est tout
     l'intérêt d'importer plutôt que de ressaisir. */
  moissonnerListes({ sorties: A.sorties });
  Promise.all([sauverArticles(), sauverFournisseurs(), sauverCommandes(), sauverSorties()])
    .then(function () {
      A.impStock = null;
      fermerModale(); majStock();
      toast(r.type === 'produits' ? r.lignes.length + ' produits importés.'
        : r.type === 'commandes' ? nc + ' commande' + (nc > 1 ? 's' : '') + ' importée' + (nc > 1 ? 's' : '') + '.'
          : ns + ' sortie' + (ns > 1 ? 's' : '') + ' importée' + (ns > 1 ? 's' : '') + '.');
    });
}

/* ------------------------------------------------------- frais de port
   Un bon de livraison ne mélange jamais deux fournisseurs, donc jamais deux
   unités : le prorata des quantités suffit et colle au tableur. Si une
   commande mélange malgré tout des unités — des millilitres et des pièces —
   on bascule sur le prorata des montants, sinon cinquante litres de répulsif
   avaleraient le port d'une palette de tuteurs. */
function reglePort(c) {
  if (c && c.regle) return c.regle;
  var vues = {}, n = 0;
  ((c && c.lignes) || []).forEach(function (l) {
    var a = article(l.article); if (!a) return;
    var u = a.unite || 'unite';
    if (!vues[u]) { vues[u] = 1; n++; }
  });
  return n > 1 ? 'montant' : 'quantite';
}
/* Part de livraison portée par une unité de chaque ligne, dans l'ordre. */
function partsPort(c) {
  var lignes = (c && c.lignes) || [], livr = ST.nb(c && c.livraison);
  var regle = reglePort(c), out = [];
  if (regle === 'montant') {
    var val = lignes.reduce(function (s, l) { return s + ST.nb(l.qte) * ST.nb(l.prix); }, 0);
    lignes.forEach(function (l) { out.push(val > 0 ? livr * ST.nb(l.prix) / val : 0); });
  } else {
    var qt = lignes.reduce(function (s, l) { return s + ST.nb(l.qte); }, 0);
    lignes.forEach(function () { out.push(qt > 0 ? livr / qt : 0); });
  }
  out.regle = regle;
  return out;
}

/* ------------------------------------------------------------- indexation
   Les commandes et les sorties sont la source ; les mouvements portés par
   chaque article n'en sont qu'une vue, refaite à chaque modification. Tout
   le reste de l'application — marge d'un chantier, valeur du stock — lit
   cette vue sans savoir d'où elle vient. */
function indexerStock() {
  (A.articles || []).forEach(function (a) { a.mouvements = []; });
  (A.commandes || []).forEach(function (c) {
    if (ST.achatMort(c.statut)) return;
    var attendu = !ST.achatRecu(c.statut);
    var parts = partsPort(c);
    (c.lignes || []).forEach(function (l, i) {
      var a = article(l.article); if (!a || ST.nb(l.qte) <= 0) return;
      a.mouvements.push({ date: c.dateLiv || c.dateCmd, sens: 'entree', qte: ST.nb(l.qte),
        prix: ST.nb(l.prix), fraisUnit: ST.arr(parts[i] || 0, 6), commande: c.num || null,
        cmd: c.id, fournisseur: nomFournisseur(c.fournisseur), attendu: attendu });
    });
  });
  (A.sorties || []).forEach(function (s) {
    var st = s.statut;
    /* Une sortie rattachée à un chantier suit le statut du chantier. */
    if (s.chantier) {
      var ch = chantier(s.chantier);
      if (ch) st = ST.VENTE_DE_CHANTIER[ch.statut] || st;
    }
    var etat = s.perte ? 'sorti' : ST.etatVente(st);
    if (etat === 'mort') return;
    (s.lignes || []).forEach(function (l) {
      var a = article(l.article); if (!a || ST.nb(l.qte) <= 0) return;
      a.mouvements.push({ date: s.date, sens: 'sortie', qte: ST.nb(l.qte), prix: ST.nb(l.prix),
        srt: s.id, vente: s.num || null, client: s.client || null, chantier: s.chantier || null,
        perte: !!s.perte, debours: !!s.debours, motif: s.motif || null, etat: etat });
    });
  });
}
/* Un seul point d'entrée après toute modification du stock. */
function majStock() {
  indexerStock();
  renderStockFournitures();
  renderCommandes();
  renderRevient();
  renderReglagesStock();
  renderAccueil();
}

/* ------------------------------------------------------------ inventaire */
/* Où l'argent dort. Les quantités ne se comparent pas d'un produit à l'autre
   — mille bambous et mille gaines n'ont rien de commun — mais leur valeur en
   euros, si. C'est la seule échelle partagée par tout le catalogue. */
function ouDortLArgent(articles) {
  var l = (articles || []).map(function (a) {
    return { nom: a.nom || 'Produit', valeur: ST.valeurStock(a),
      detail: E.fmt(ST.quantite(a), 0) + ' ' + ST.courtUniteArt(a.unite) };
  }).filter(function (x) { return x.valeur > 0; })
    .sort(function (x, y) { return y.valeur - x.valeur; });
  if (l.length < 2) return '';
  var tot = l.reduce(function (s2, x) { return s2 + x.valeur; }, 0);
  l.forEach(function (x) { x.part = Math.round(x.valeur / tot * 100); });
  return '<div class="carte2" style="margin-top:11px;padding:11px">' +
    '<p class="eyebrow" style="margin:0 0 9px">Où dort votre argent</p>' +
    barres(l, '#5B3A1E') +
    '<p class="muted" style="font-size:12px;margin:2px 0 0">La valeur est la seule échelle ' +
    'commune : mille bambous et mille gaines ne se comparent pas au nombre.</p></div>';
}

function renderStockFournitures() {
  var z = $('#stock-resume'); if (!z) return;
  var t = $('#stock-table');
  if (!A.articles.length) {
    z.innerHTML = '<div class="vide"><p>Aucun produit au catalogue. Décrivez d’abord ce que ' +
      'vous achetez — gaines, tuteurs, répulsif — puis enregistrez vos commandes : ' +
      'l’inventaire se remplira tout seul.</p>' +
      '<div class="btn-rang" style="justify-content:center">' +
      '<button class="btn primaire" id="stock-imp-vide">Importer un fichier</button>' +
      '<button class="btn" data-versregl="stock">Ouvrir le catalogue</button></div></div>';
    if (t) t.innerHTML = '';
    if ($('#stock-alertes')) $('#stock-alertes').innerHTML = '';
    return;
  }
  var val = ST.valeurTotale(A.articles);
  var bas = ST.articlesSousSeuil(A.articles);
  var ruptures = A.articles.filter(function (a) { return ST.etatStock(a) === 'rupture'; });
  var attendu = A.articles.reduce(function (s, a) { return s + ST.quantiteAttendue(a); }, 0);

  z.innerHTML = '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(val) + '</b><small>valeur du stock</small></div>' +
    '<div class="carte2"><b class="num">' + A.articles.length + '</b><small>produit' +
      (A.articles.length > 1 ? 's' : '') + '</small></div>' +
    (attendu ? '<div class="carte2"><b class="num">' + E.fmt(attendu, 0) +
      '</b><small>en commande</small></div>' : '') +
    (ruptures.length ? '<div class="carte2" style="border-color:#B4231F"><b class="num">' +
      ruptures.length + '</b><small>en rupture</small></div>' : '') +
    (bas.length ? '<div class="carte2" style="border-color:#B98A00"><b class="num">' + bas.length +
      '</b><small>à recommander</small></div>' : '') +
    '</div>' + ouDortLArgent(A.articles);

  var l = A.articles.slice().sort(function (a, b) {
    return (a.nom || '').localeCompare(b.nom || '', 'fr');
  });
  var engage = l.some(function (a) { return ST.stockFutur(a) !== ST.quantite(a); });
  var prevu = l.some(function (a) { return ST.stockPrevu(a) !== ST.stockFutur(a); });
  var tot = { achat: 0, vendu: 0, stock: 0, valeur: 0 };
  /* Les quantités ne se cumulent que si tout le catalogue parle la même
     unité — sinon on additionnerait des millilitres et des pièces. */
  var unites = {};
  l.forEach(function (a) { unites[a.unite || 'unite'] = 1; });
  var uniteUnique = Object.keys(unites).length === 1;

  t.innerHTML = '<div class="tab-boite"><table><thead><tr>' +
    '<th style="text-align:left">Produit</th>' +
    /* Ce qu'il reste d'abord : c'est la seule colonne qu'on vient vraiment
       lire, et elle était au bout d'un défilement horizontal. */
    '<th class="num">En stock</th>' +
    '<th class="num">Acheté</th><th class="num">Sorti</th>' +
    (engage ? '<th class="num">Futur</th>' : '') +
    (prevu ? '<th class="num">À prévoir</th>' : '') +
    '<th class="num">Coût unit. réel</th><th class="num">Valeur</th>' +
    '</tr></thead><tbody>' +
    l.map(function (a) {
      var q = ST.quantite(a), e = ST.etatStock(a);
      /* Un répulfif se compte au millilitre et se lit au litre : « 30 L »
         dit trois bidons, « 30 000 » ne dit rien. */
      var ech = ST.echelleArt(a.unite,
        [q, ST.quantiteAchetee(a), ST.quantiteSortie(a), ST.stockFutur(a), ST.stockPrevu(a)]);
      var ech1 = function (v) { var x = ST.arr(ST.nb(v) / ech.div, 2); return E.fmt(x, x % 1 ? 2 : 0); };
      var u = ech.court;
      var coul = e === 'rupture' ? '#B4231F' : e === 'faible' ? '#B98A00' : '#2E7D46';
      var att = ST.quantiteAttendue(a);
      tot.achat += ST.quantiteAchetee(a); tot.vendu += ST.quantiteSortie(a);
      tot.stock += q; tot.valeur += ST.valeurStock(a);
      return '<tr data-artfiche="' + a.id + '" style="cursor:pointer">' +
        '<td style="text-align:left"><i class="pt" style="background:' + coul + '"></i>' +
        esc(a.nom || 'Produit') +
        '<small class="muted"> ' + esc(u) + (att ? ' · +' + ech1(att) + ' attendus' : '') + '</small></td>' +
        '<td class="num"><b>' + ech1(q) + '</b></td>' +
        '<td class="num">' + ech1(ST.quantiteAchetee(a)) + '</td>' +
        '<td class="num">' + ech1(ST.quantiteSortie(a)) + '</td>' +
        (engage ? '<td class="num muted">' + ech1(ST.stockFutur(a)) + '</td>' : '') +
        (prevu ? '<td class="num muted">' + ech1(ST.stockPrevu(a)) + '</td>' : '') +
        '<td class="num">' + E.fmt(ST.pmp(a), 4) + '</td>' +
        '<td class="num">' + E.fmt(ST.valeurStock(a), 2) + '</td></tr>';
    }).join('') +
    /* On n'additionne pas des litres avec des unités. Tant que le catalogue
       mêle les unités, les colonnes de quantité n'ont pas de total : un
       « acheté » qui cumule du répulsif au millilitre et des tuteurs à la pièce ne
       veut rien dire. Seule la valeur, en euros, se cumule toujours. */
    '<tr class="tot"><td style="text-align:left">Total</td>' +
    (uniteUnique
      ? '<td class="num">' + E.fmt(tot.stock, 0) + '</td>' +
        '<td class="num">' + E.fmt(tot.achat, 0) + '</td>' +
        '<td class="num">' + E.fmt(tot.vendu, 0) + '</td>'
      : '<td class="num muted" colspan="3" style="text-align:center;font-style:italic">' +
        'unités différentes</td>') +
    (engage ? '<td></td>' : '') + (prevu ? '<td></td>' : '') +
    '<td></td><td class="num">' + E.fmt(tot.valeur, 2) + '</td></tr>' +
    '</tbody></table></div>' +
    '<p class="muted" style="font-size:11.5px;margin:9px 0 0">' +
    'Coût unitaire réel : moyenne pondérée de toutes les commandes reçues, livraison répartie.' +
    (engage ? ' « Futur » retire ce qui est déjà engagé sur un chantier accepté ou en cours.' : '') +
    (prevu ? ' « À prévoir » retire en plus les chantiers seulement envisagés.' : '') +
    '</p>';

  var al = ruptures.concat(bas.filter(function (a) { return ST.etatStock(a) === 'faible'; }));
  $('#stock-alertes').innerHTML = al.length
    ? '<div class="carte"><h2>À recommander</h2>' + al.map(function (a) {
        var q = ST.quantite(a);
        return '<button class="alerte" data-artfiche="' + a.id + '">' +
          '<i class="ic" style="background:' + (q <= 0 ? '#B4231F' : '#B98A00') + '"></i>' +
          '<span><b>' + esc(a.nom || '') + '</b><small>' +
          (q <= 0 ? 'rupture' : E.fmt(q, 0) + ' ' + ST.courtUniteArt(a.unite) +
            ' — seuil à ' + E.fmt(ST.nb(a.seuil), 0)) +
          (a.fournisseur ? ' · ' + esc(nomFournisseur(a.fournisseur)) : '') +
          '</small></span></button>';
      }).join('') + '</div>'
    : '';
}

/* ------------------------------------------------------- fiche d'un produit */
function ouvrirFicheArticle(id) {
  var a = article(id); if (!a) return;
  var u = ST.courtUniteArt(a.unite), q = ST.quantite(a);
  var mv = ST.mouvements(a).slice().sort(function (x, y) { return (y.date || 0) - (x.date || 0); });
  var ca = ST.caVendu(a), coutV = ST.arr(ST.quantiteVendue(a) * ST.pmp(a), 2);

  modale(a.nom || 'Produit',
    '<div class="kpi" style="margin-top:0">' +
    '<div class="carte2"><b class="num">' + E.fmt(q, q % 1 ? 2 : 0) + '</b><small>' + esc(u) + ' en stock</small></div>' +
    '<div class="carte2"><b class="num">' + E.fmt(ST.pmp(a), 4) + '</b><small>coût unitaire réel</small></div>' +
    '<div class="carte2"><b class="num">' + eur(ST.valeurStock(a)) + '</b><small>valeur</small></div>' +
    (ST.stockEnPlants(a) != null ? '<div class="carte2"><b class="num">' +
      E.fmt(ST.stockEnPlants(a), 0) + '</b><small>plants couverts</small></div>' : '') +
    '</div>' +
    (ca ? '<div class="carte2" style="margin:11px 0"><div style="display:flex;justify-content:space-between;font-size:13.5px">' +
      '<span>' + E.fmt(ST.quantiteVendue(a), 0) + ' ' + esc(u) + ' vendus</span><b class="num">' + eur(ca) + '</b></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:3px">' +
      '<span class="muted">marge brute</span><b class="num">' + eur(ST.arr(ca - coutV, 2)) +
      (ca > 0 ? ' · ' + E.fmt((ca - coutV) / ca * 100, 1) + ' %' : '') + '</b></div></div>' : '') +
    (ST.quantiteDebours(a) ? '<p class="muted" style="font-size:12.5px;margin:0 0 9px">' +
      E.fmt(ST.quantiteDebours(a), 0) + ' ' + esc(u) + ' refacturés en débours pour ' +
      eur(ST.caDebours(a)) + ', hors chiffre d’affaires.</p>' : '') +
    (ST.quantiteAttendue(a) ? '<p class="muted" style="font-size:12.5px;margin:0 0 9px">' +
      E.fmt(ST.quantiteAttendue(a), 0) + ' ' + esc(u) + ' commandés, pas encore reçus.</p>' : '') +
    '<p class="eyebrow" style="margin:14px 0 6px">Mouvements</p>' +
    (mv.length ? '<div style="max-height:44vh;overflow:auto">' + mv.map(function (m) {
      var ch = m.chantier ? chantier(m.chantier) : null;
      var coul = m.sens === 'entree' ? (m.attendu ? '#8A9382' : '#2E7D46')
        : m.perte ? '#B4231F' : m.etat === 'sorti' ? '#8A5A2B' : '#B98A00';
      return '<div class="liste-item"><span class="pastille" style="background:' + coul + '"></span>' +
        '<div class="li-c"><b>' + (m.sens === 'entree' ? '+' : '−') + E.fmt(ST.nb(m.qte), 0) + ' ' + esc(u) +
        (m.sens === 'entree' ? ' à ' + E.fmt(ST.coutReel(m), 4) + ' €'
          : ST.nb(m.prix) ? ' à ' + E.fmt(ST.nb(m.prix), 4) + ' €' : '') + '</b>' +
        '<small>' + dateCourte(m.date) +
        (m.commande ? ' · ' + esc(m.commande) : '') +
        (m.fournisseur ? ' · ' + esc(m.fournisseur) : '') +
        (m.client ? ' · ' + esc(m.client) : '') +
        (ch ? ' · ' + esc(C.nomChantier(ch)) : '') +
        (m.attendu ? ' · attendu' : '') +
        (m.etat === 'engage' ? ' · engagé' : m.etat === 'prevu' ? ' · prévu' : '') +
        (m.perte ? ' · perte' + (m.motif ? ' (' + esc(m.motif) + ')' : '') : '') +
        '</small></div></div>';
    }).join('') + '</div>' : '<div class="vide"><p>Aucun mouvement.</p></div>') +
    '<div class="btn-rang" style="margin-top:12px">' +
    '<button class="btn primaire" id="fa-cmd">Commande</button>' +
    '<button class="btn" id="fa-sortie">Sortie</button>' +
    '<button class="btn btn-min" id="fa-mod">Modifier le produit</button></div>');

  $('#fa-cmd').addEventListener('click', function () { fermerModale(); ouvrirCommande(null, id); });
  $('#fa-sortie').addEventListener('click', function () { fermerModale(); ouvrirSortieStock(null, false, id); });
  $('#fa-mod').addEventListener('click', function () { fermerModale(); ouvrirArticle(id); });
}

/* Le bouton d'action ouvre la bonne fenêtre selon l'onglet ouvert. */
function nouveauMouvement() {
  var o = A.mvt || 'achats';
  if (o === 'achats') ouvrirCommande(null);
  else ouvrirSortieStock(null, o === 'pertes');
}

/* -------------------------------------------------- entrées et sorties */
var AIDE_MVT = {
  achats: 'Une commande par ligne, avec ses articles et ses frais de livraison. ' +
    'Tant qu’elle n’est pas marquée reçue, elle n’entre pas dans le stock.',
  sorties: 'Ce qui quitte le stock : refacturé à un client, ou consommé sur un chantier. ' +
    'Rattachée à un chantier, la sortie suit son statut.',
  pertes: 'Casse, vol, produit périmé : la quantité quitte le stock sans chiffre d’affaires.'
};
function renderCommandes() {
  var z = $('#liste-commandes'); if (!z) return;
  var onglet = A.mvt || 'achats';
  $$('#mvt-nav .chip').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.mvt === onglet));
  });
  if ($('#mvt-aide')) $('#mvt-aide').textContent = AIDE_MVT[onglet];
  if ($('#cmd-nouvelle')) {
    $('#cmd-nouvelle').textContent = onglet === 'achats' ? '+ Commande'
      : onglet === 'sorties' ? '+ Sortie' : '+ Perte';
  }
  z.innerHTML = onglet === 'achats' ? listeAchats() : listeSorties(onglet === 'pertes');
}

function listeAchats() {
  var l = (A.commandes || []).slice().sort(function (a, b) {
    return (b.dateCmd || b.dateLiv || 0) - (a.dateCmd || a.dateLiv || 0);
  });
  if (!l.length) {
    return '<div class="vide"><p>Aucune commande. Enregistrez-en une : les frais de livraison ' +
      'seront répartis sur les articles, et le stock se mettra à jour.</p>' +
      '<button class="btn primaire" id="cmd-vide">Nouvelle commande</button></div>';
  }
  return l.map(function (c) {
    var qte = (c.lignes || []).reduce(function (s, x) { return s + ST.nb(x.qte); }, 0);
    var uu = null, mixte = false;
    (c.lignes || []).forEach(function (x) {
      var a = article(x.article); if (!a) return;
      if (uu == null) uu = a.unite; else if (uu !== a.unite) mixte = true;
    });
    var unite = mixte || !uu ? 'unités' : ST.courtUniteArt(uu);
    var march = (c.lignes || []).reduce(function (s, x) { return s + ST.nb(x.qte) * ST.nb(x.prix); }, 0);
    var recu = ST.achatRecu(c.statut), mort = ST.achatMort(c.statut);
    return '<div class="liste-item' + (mort ? ' epuise' : '') + '">' +
      '<span class="pastille" style="background:' +
      (mort ? '#8A9382' : recu ? '#2E7D46' : '#B98A00') +
      ';align-self:flex-start;margin-top:3px"></span>' +
      '<div class="li-c"><b>' + esc(c.num || 'Sans numéro') + ' — ' +
      eur(ST.arr(march + ST.nb(c.livraison), 2)) +
      (recu ? '' : ' <i class="etiq" style="background:#B98A00">' +
        esc(ST.nomStatutAchat(c.statut).toLowerCase()) + '</i>') + '</b>' +
      '<small>' + dateCourte(c.dateLiv || c.dateCmd) +
      ' · ' + esc(ST.nomStatutAchat(c.statut)) +
      (c.fournisseur ? ' · ' + esc(nomFournisseur(c.fournisseur)) : '') +
      ' · ' + E.fmt(qte, 0) + ' ' + esc(unite) +
      (ST.nb(c.livraison) ? ' · dont ' + eur(ST.nb(c.livraison)) + ' de livraison' : '') + '<br>' +
      (c.lignes || []).map(function (x) {
        var a = article(x.article);
        return esc(a ? a.nom : '?') + ' ' + E.fmt(ST.nb(x.qte), 0) + ' × ' + E.fmt(ST.nb(x.prix), 4) + ' €';
      }).join(' · ') + '</small></div>' +
      '<div style="display:flex;flex-direction:column;gap:5px;flex:none">' +
      (recu || mort ? '' : '<button class="btn-min" data-cmdrecu="' + c.id + '">Reçue</button>') +
      '<button class="btn-min" data-cmdmod="' + c.id + '">Modifier</button></div></div>';
  }).join('');
}

function listeSorties(pertes) {
  /* Du plus récent au plus ancien ; à date égale, le numéro de facture
     tranche, ce qui remet les pièces d'une même journée dans leur ordre. */
  var l = (A.sorties || []).filter(function (s) { return !!s.perte === !!pertes; })
    .sort(function (a, b) {
      return (b.date || 0) - (a.date || 0) ||
        String(b.num || '').localeCompare(String(a.num || ''), 'fr', { numeric: true });
    });
  if (!l.length) {
    return '<div class="vide"><p>' + (pertes
      ? 'Aucune perte enregistrée.'
      : 'Aucune sortie. Enregistrez ce qui part sur un chantier ou ce que vous refacturez.') +
      '</p><button class="btn primaire" id="cmd-vide">' +
      (pertes ? 'Enregistrer une perte' : 'Nouvelle sortie') + '</button></div>';
  }
  return l.map(function (s) {
    var ch = s.chantier ? chantier(s.chantier) : null;
    var st = s.statut;
    if (ch) st = ST.VENTE_DE_CHANTIER[ch.statut] || st;
    var etat = s.perte ? 'sorti' : ST.etatVente(st);
    var ca = (s.lignes || []).reduce(function (t, x) { return t + ST.nb(x.qte) * ST.nb(x.prix); }, 0);
    var cout = (s.lignes || []).reduce(function (t, x) {
      var a = article(x.article); return t + ST.nb(x.qte) * (a ? ST.pmp(a) : 0);
    }, 0);
    var coul = s.perte ? '#B4231F' : s.debours ? '#5C6BA8' : etat === 'sorti' ? '#2E7D46'
      : etat === 'engage' ? '#B98A00' : etat === 'mort' ? '#8A9382' : '#7A8471';
    var titre = s.perte ? 'Perte' : (s.num || (ch ? C.nomChantier(ch) : s.client || 'Sortie'));
    var sous = [dateCourte(s.date)];
    if (!s.perte && s.client) sous.push(esc(s.client));
    if (ch) sous.push(esc(C.nomChantier(ch)));
    if (s.perte) { if (s.motif) sous.push(esc(s.motif)); }
    else sous.push(esc(ST.nomStatutVente(st)));
    if (!s.perte && !s.debours && ca) sous.push('marge ' + eur(ST.arr(ca - cout, 2)));
    return '<div class="liste-item' + (etat === 'mort' ? ' epuise' : '') + '">' +
      '<span class="pastille" style="background:' + coul + ';align-self:flex-start;margin-top:3px"></span>' +
      '<div class="li-c"><b>' + esc(titre) +
      (s.perte ? '' : ' — ' + eur(ST.arr(ca, 2))) +
      (s.debours ? ' <i class="etiq" style="background:#5C6BA8">débours</i>' : '') +
      (s.auto ? ' <i class="etiq" style="background:#7A8471">suit la facture</i>' : '') + '</b>' +
      '<small>' + sous.join(' · ') + '<br>' +
      (s.lignes || []).map(function (x) {
        var a = article(x.article);
        return esc(a ? a.nom : '?') + ' ' + E.fmt(ST.nb(x.qte), 0) +
          (s.perte ? '' : ' × ' + E.fmt(ST.nb(x.prix), 4) + ' €');
      }).join(' · ') + '</small></div>' +
      '<button class="btn-min" data-srtmod="' + s.id + '">Modifier</button></div>';
  }).join('');
}

/* ------------------------------------------------ catalogue et carnet
   Les listes déroulantes des commandes viennent d'ici, et de nulle part
   ailleurs : un produit saisi une fois est proposé partout. */
function renderReglagesStock() {
  var zf = $('#rf-liste'); if (!zf) return;
  var lf = (A.fournisseurs || []).slice().sort(function (a, b) {
    return (a.nom || '').localeCompare(b.nom || '', 'fr');
  });
  zf.innerHTML = lf.length ? lf.map(function (f) {
    var n = (A.commandes || []).filter(function (c) { return c.fournisseur === f.id; }).length;
    return '<div class="liste-item"><div class="li-c"><b>' + esc(f.nom || '') + '</b><small>' +
      [f.categorie, f.contact, f.tel, f.ville].filter(Boolean).map(esc).join(' · ') +
      (n ? (f.categorie || f.contact || f.tel || f.ville ? ' · ' : '') + n + ' commande' + (n > 1 ? 's' : '') : '') +
      '</small></div>' +
      '<button class="btn-min" data-fourmod="' + f.id + '">Modifier</button></div>';
  }).join('') : '<p class="muted" style="font-size:12.5px;margin:0">Aucun fournisseur.</p>';

  var zp = $('#rp-liste'); if (!zp) return;
  var lp = A.articles.slice().sort(function (a, b) {
    return (a.type || '').localeCompare(b.type || '') || (a.nom || '').localeCompare(b.nom || '', 'fr');
  });
  zp.innerHTML = lp.length ? lp.map(function (a) {
    return '<div class="liste-item"><div class="li-c"><b>' + esc(a.nom || '') + '</b><small>' +
      esc(ST.nomTypeArt(a.type)) + ' · ' + esc(ST.nomUniteArt(a.unite)) +
      (a.fournisseur ? ' · ' + esc(nomFournisseur(a.fournisseur)) : '') +
      (ST.nb(a.dosage) ? ' · ' + E.fmt(ST.nb(a.dosage), 2) + ' ' + esc(ST.courtUniteArt(a.unite)) + '/plant' : '') +
      (ST.nb(a.seuil) ? ' · seuil ' + E.fmt(ST.nb(a.seuil), 0) : '') +
      (a.designation ? '<br>' + esc(a.designation) : '') +
      '</small></div>' +
      '<button class="btn-min" data-artmod="' + a.id + '">Modifier</button></div>';
  }).join('') : '<p class="muted" style="font-size:12.5px;margin:0">Aucun produit.</p>';
}

function ouvrirFournisseur(id) {
  var f = id ? fournisseur(id) : {};
  if (!f) return;
  modale(id ? 'Modifier le fournisseur' : 'Nouveau fournisseur',
    '<div class="champ"><label class="eyebrow" for="fo-nom">Nom</label>' +
    '<input type="text" id="fo-nom" class="gros" autocomplete="off" value="' + esc(f.nom || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="fo-cat">Catégorie de produit</label>' +
    '<input type="text" id="fo-cat" autocomplete="off" placeholder="protection des plants, plants…" value="' + esc(f.categorie || '') + '"></div>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="fo-contact">Contact</label>' +
    '<input type="text" id="fo-contact" autocomplete="off" value="' + esc(f.contact || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="fo-tel">Téléphone</label>' +
    '<input type="tel" id="fo-tel" autocomplete="off" value="' + esc(f.tel || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="fo-mail">Courriel</label>' +
    '<input type="email" id="fo-mail" autocomplete="off" value="' + esc(f.mail || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="fo-ville">Ville</label>' +
    '<input type="text" id="fo-ville" autocomplete="off" value="' + esc(f.ville || '') + '"></div>' +
    '</div>' +
    '<div class="champ"><label class="eyebrow" for="fo-note">Notes</label>' +
    '<textarea id="fo-note" rows="2">' + esc(f.notes || '') + '</textarea></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="fo-ok">Valider</button>' +
    (id ? '<button class="btn danger btn-min" id="fo-sup">Supprimer</button>' : '') + '</div>');
  $('#fo-ok').addEventListener('click', function () {
    var nom = $('#fo-nom').value.trim();
    if (!nom) { toast('Donnez un nom.'); return; }
    var maj = { nom: nom, categorie: $('#fo-cat').value.trim(), contact: $('#fo-contact').value.trim(),
      tel: $('#fo-tel').value.trim(), mail: $('#fo-mail').value.trim(),
      ville: $('#fo-ville').value.trim(), notes: $('#fo-note').value.trim(), maj: Date.now() };
    if (id) Object.keys(maj).forEach(function (k) { f[k] = maj[k]; });
    else { maj.id = uid(); A.fournisseurs.push(maj); }
    sauverFournisseurs().then(function () {
      fermerModale(); majStock(); toast(id ? 'Fournisseur modifié.' : 'Fournisseur ajouté.');
    });
  });
  if (id) $('#fo-sup').addEventListener('click', function () {
    var n = (A.commandes || []).filter(function (c) { return c.fournisseur === id; }).length;
    if (n && !confirm(n + ' commande' + (n > 1 ? 's sont rattachées' : ' est rattachée') +
      ' à ce fournisseur. Le supprimer quand même ?')) return;
    A.fournisseurs = A.fournisseurs.filter(function (x) { return x.id !== id; });
    jeterObjet('fournisseur', f, f.nom || 'Fournisseur', f.categorie || '')
      .then(sauverFournisseurs).then(function () {
        fermerModale(); majStock(); toast('Fournisseur mis à la corbeille.');
      });
  });
}

function ouvrirArticle(id) {
  var a = id ? article(id) : { unite: 'unite', type: 'protection' };
  if (!a) return;
  modale(id ? 'Modifier le produit' : 'Nouveau produit',
    '<div class="champ"><label class="eyebrow" for="ar-nom">Nom court</label>' +
    '<input type="text" id="ar-nom" class="gros" autocomplete="off" placeholder="gaine 14*120, tuteur acacia…" value="' + esc(a.nom || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="ar-des">Désignation complète</label>' +
    '<input type="text" id="ar-des" autocomplete="off" placeholder="telle qu’elle figure sur la facture" value="' + esc(a.designation || '') + '"></div>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="ar-type">Type</label>' +
    '<select id="ar-type">' + ST.TYPES_ART.map(function (t) {
      return '<option value="' + t.c + '"' + (a.type === t.c ? ' selected' : '') + '>' + t.n + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="ar-unite">Unité</label>' +
    '<select id="ar-unite">' + ST.UNITES_ART.map(function (u) {
      return '<option value="' + u.c + '"' + (a.unite === u.c ? ' selected' : '') + '>' + u.n + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="ar-four">Fournisseur habituel</label>' +
    '<select id="ar-four"><option value="">— aucun —</option>' +
    (A.fournisseurs || []).slice().sort(function (x, y) {
      return (x.nom || '').localeCompare(y.nom || '', 'fr');
    }).map(function (f) {
      return '<option value="' + f.id + '"' + (a.fournisseur === f.id ? ' selected' : '') + '>' + esc(f.nom) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="ar-ref">Référence</label>' +
    '<input type="text" id="ar-ref" autocomplete="off" value="' + esc(a.reference || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="ar-seuil">Seuil d’alerte</label>' +
    '<input type="text" id="ar-seuil" inputmode="decimal" placeholder="facultatif" value="' + (a.seuil || '') + '"></div>' +
    '<div class="champ" id="ar-dosage-champ"><label class="eyebrow" for="ar-dosage">Dosage par plant</label>' +
    '<input type="text" id="ar-dosage" inputmode="decimal" placeholder="ex. 6 ml" value="' + (a.dosage || '') + '"></div>' +
    '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:6px 0 0" id="ar-dosage-aide">Le dosage sert aux produits achetés ' +
    'au litre ou au mètre et facturés au plant : le stock se lit alors aussi en nombre de plants.</p>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="ar-ok">Valider</button>' +
    (id ? '<button class="btn danger btn-min" id="ar-sup">Supprimer</button>' : '') + '</div>');
  /* Un produit compté au plant n'a pas de dosage par plant : le champ n'a
     alors aucun sens et se retire. */
  var majDosage = function () {
    var dosable = ST.UNITE_DOSABLE($('#ar-unite').value);
    $('#ar-dosage-champ').style.display = dosable ? '' : 'none';
    $('#ar-dosage-aide').style.display = dosable ? '' : 'none';
  };
  $('#ar-unite').addEventListener('change', majDosage);
  majDosage();
  $('#ar-ok').addEventListener('click', function () {
    var nom = $('#ar-nom').value.trim();
    if (!nom) { toast('Donnez un nom.'); return; }
    var maj = { nom: nom, designation: $('#ar-des').value.trim(), type: $('#ar-type').value,
      unite: $('#ar-unite').value, seuil: ST.nb($('#ar-seuil').value) || null,
      fournisseur: $('#ar-four').value || null, reference: $('#ar-ref').value.trim(),
      /* Un produit déjà compté au plant n'a pas de dosage par plant : le champ
         est masqué, et sa valeur ne doit pas survivre à un changement d'unité. */
      dosage: (ST.UNITE_DOSABLE($('#ar-unite').value) ? ST.nb($('#ar-dosage').value) || null : null),
      maj: Date.now() };
    if (id) Object.keys(maj).forEach(function (k) { a[k] = maj[k]; });
    else { maj.id = uid(); maj.mouvements = []; A.articles.push(maj); }
    sauverArticles().then(function () {
      fermerModale(); majStock(); toast(id ? 'Produit modifié.' : 'Produit créé.');
    });
  });
  if (id) $('#ar-sup').addEventListener('click', function () {
    var n = (A.commandes || []).concat(A.sorties || []).filter(function (c) {
      return (c.lignes || []).some(function (l) { return l.article === id; });
    }).length;
    if (!confirm(n ? 'Ce produit apparaît dans ' + n + ' mouvement' + (n > 1 ? 's' : '') +
      '. Les lignes correspondantes seront ignorées. Supprimer ?'
      : 'Supprimer « ' + (a.nom || '') + ' » ?')) return;
    A.articles = A.articles.filter(function (x) { return x.id !== id; });
    jeterObjet('produit', a, a.nom || 'Produit', ST.nomTypeArt(a.type))
      .then(sauverArticles).then(function () {
        fermerModale(); majStock(); toast('Produit mis à la corbeille.');
      });
  });
}


