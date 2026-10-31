/* ============================================================ REGLAGES */
function renderReglages() {
  $$('#r-mode .chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === A.cfg.mode)); });
  $('#r-mode-txt').innerHTML = A.cfg.mode === 'historique'
    ? 'Reprend le calcul de vos anciens bordereaux, avec ses deux anomalies : la coupure des classes 2a/2b et 3a/3b ' +
    'se fait sur le diamètre saisi et non sur le diamètre sous écorce, et les seuils de billons nuls sont toujours ' +
    'abaissés de l’écorce même en mesure sur écorce. À conserver pour rester cohérent avec ce que vous avez déjà rendu.'
    : 'Les classes 2a/2b et 3a/3b sont coupées sur le diamètre sous écorce, comme l’indique l’intitulé des colonnes, ' +
    'et les seuils de billons nuls ne sont abaissés que si les mesures sont prises sous écorce. ' +
    'Attention : les classes de certains billons peuvent changer par rapport au calcul historique.';
  $('#r-slon').value = String(A.cfg.seuilLongueur).replace('.', ',');
  $('#r-ssap').value = String(A.cfg.seuilDiamSAP).replace('.', ',');
  $('#r-sepc').value = String(A.cfg.seuilDiamEPC).replace('.', ',');
  var s = A.bord ? E.seuilsNuls(A.bord, A.cfg) : null;
  $('#r-seuils-txt').textContent = s
    ? 'Seuils appliqués à ce bordereau : longueur < ' + E.fmt(s.lon, 1) + ' m, Ø sapin ≤ ' + E.fmt(s['S.P'], 0) +
    ' cm, Ø épicéa ≤ ' + E.fmt(s['EPC'], 0) + ' cm.'
    : '';

  $('#t-essences').innerHTML = '<thead><tr><th class="g">Code</th><th class="g">Nom</th><th>Écorce</th>' +
    '<th>Favori</th><th></th></tr></thead><tbody>' +
    A.cfg.essences.map(function (e, i) {
      return '<tr>' + td(e.code, 'g') + '<td class="g"><input type="text" data-ess-nom="' + i + '" value="' + esc(e.nom) + '" style="padding:3px 6px"></td>' +
        '<td><input type="text" inputmode="decimal" data-ess-tx="' + i + '" value="' + esc(String(Math.round(e.tx * 100)).replace('.', ',')) +
        '" style="width:58px;padding:3px 6px;text-align:right"> %</td>' +
        '<td><button class="btn-min" data-ess-fav="' + i + '">' + ((A.cfg.favoris || []).indexOf(e.code) >= 0 ? '★' : '☆') + '</button></td>' +
        '<td class="act"><button class="btn-min" data-ess-sup="' + i + '">Suppr.</button></td></tr>';
    }).join('') + '</tbody>';

  $('#r-cl-onglets').innerHTML = E.CLASSEMENTS.map(function (c) {
    return '<button role="tab" data-rcl="' + esc(c) + '" aria-selected="' + (c === A.classementRegl) + '">' +
      esc(E.nomClassement(c)) + '</button>';
  }).join('');
  var ql = A.cfg.qualites[A.classementRegl] || [];
  $('#t-qualites').innerHTML = '<thead><tr><th class="g">Code</th><th class="g">Libellé</th><th></th></tr></thead><tbody>' +
    ql.map(function (q, i) {
      return '<tr>' + td(q.code, 'g') + '<td class="g"><input type="text" data-q-nom="' + i + '" value="' + esc(q.nom) + '" style="padding:3px 6px"></td>' +
        '<td class="act"><button class="btn-min" data-q-sup="' + i + '">Suppr.</button></td></tr>';
    }).join('') + '</tbody>';
}

/* ============================================================== EXPORT */
/* ==================================================== sauvegarde et corbeille */
var B = window.BCB;

function tousLesBordereaux() {
  return Promise.all(A.index.map(function (e) { return lire('bordcub.b.' + e.id, null); }))
    .then(function (l) { return l.filter(Boolean); });
}

/* Envoi direct (partage Android) sinon téléchargement classique. */
function partager(nom, texte, type) {
  try {
    if (navigator.share && navigator.canShare && typeof File === 'function') {
      var f = new File([texte], nom, { type: type });
      if (navigator.canShare({ files: [f] })) {
        return navigator.share({ files: [f], title: nom }).then(function () {
          toast('Sauvegarde envoyée.');
        }, function (e) {
          if (!(e && e.name === 'AbortError')) telecharger(nom, texte, type);
        });
      }
    }
  } catch (e) { }
  telecharger(nom, texte, type);
  return Promise.resolve();
}

/* Ce que la sauvegarde emporte réellement. Sert au rappel comme au libellé :
   l'ancien test ne regardait que les bordereaux de cubage, si bien qu'une
   année entière de chantiers et de finances ne déclenchait aucune alerte. */
function contenuSauvegarde() {
  return [
    { n: A.index.length, u: 'bordereau', p: 'bordereaux' },
    { n: A.piles.length, u: 'pile', p: 'piles' },
    { n: A.chantiers.length, u: 'chantier', p: 'chantiers' },
    { n: A.depenses.length, u: 'dépense', p: 'dépenses' },
    { n: (A.commandes || []).length, u: 'commande', p: 'commandes' },
    { n: (A.sorties || []).length, u: 'mouvement', p: 'mouvements' },
    { n: (A.journees || []).length, u: 'journée', p: 'journées' },
    { n: A.articles.length, u: 'produit', p: 'produits' },
    { n: A.charges.length, u: 'charge fixe', p: 'charges fixes' },
    /* Oubliés de ce compte, les deux venus en 4.59 : une sauvegarde n'en
       portant que le carnet du véhicule s'annonçait « rien restauré » alors
       que tout était bien arrivé. Et « avez-vous des données ? » répondait
       non à qui n'a que ça. */
    { n: (A.versements || []).length, u: 'versement', p: 'versements' },
    { n: ((A.vehicule || {}).interventions || []).length, u: 'intervention', p: 'interventions' }
  ].filter(function (x) { return x.n > 0; });
}
function listerContenu(c) {
  return c.map(function (x) { return E.fmt(x.n, 0) + ' ' + (x.n > 1 ? x.p : x.u); }).join(', ');
}
function aDesDonnees() { return contenuSauvegarde().length > 0; }

function marquerExport() {
  A.export = Date.now();
  return ecrire('bordcub.export', A.export).then(renderSauvegarde);
}

function sauvegarderTout() {
  var c = contenuSauvegarde();
  if (!c.length) { toast('Rien à sauvegarder.'); return Promise.resolve(); }
  var poids = '';
  return tousLesBordereaux().then(function (bs) {
    var txt = JSON.stringify(B.construireSauvegarde(A.cfg, bs, A.piles, A.chantiers, A.depenses, A.clients, A.articles, A.charges, A.proprios, A.fournisseurs, A.commandes, A.sorties, A.journees, A.versements, A.vehicule, A.achats), null, 1);
    try { poids = B.octets(new Blob([txt]).size); } catch (e) { poids = B.octets(txt.length); }
    return partager('Sylve-' + B.jour(Date.now()) + '.json', txt, 'application/json');
  }).then(marquerExport).then(function () {
    toast('Sauvegarde' + (poids ? ' de ' + poids : '') + ' : ' + listerContenu(c) + '.');
  });
}

/* Une copie complète par jour, sept jours glissants. Les photos de piles
   en sont retirées : elles pèsent lourd et se retrouvent dans la sauvegarde
   manuelle, celle qu'on emporte sur l'ordinateur. */
function sansPhotos(piles) {
  return (piles || []).map(function (p) {
    if (!p.photos || !p.photos.length) return p;
    var c = {};
    Object.keys(p).forEach(function (k) { if (k !== 'photos') c[k] = p[k]; });
    return c;
  });
}
function instantaneDuJour() {
  var cle = B.cleInstantane(Date.now());
  return Store.get(cle).then(function (v) {
    /* Une entreprise sans cubage a autant besoin de sa copie du jour qu'une
       autre : le critère est d'avoir des données, pas d'avoir des bordereaux. */
    if (v || !aDesDonnees()) return;
    return tousLesBordereaux().then(function (bs) {
      if (!aDesDonnees()) return;
      return Store.set(cle, JSON.stringify(B.construireSauvegarde(A.cfg, bs, sansPhotos(A.piles),
        A.chantiers, A.depenses, A.clients, A.articles, A.charges, A.proprios, A.fournisseurs,
        A.commandes, A.sorties, A.journees, A.versements, A.vehicule, A.achats)));
    });
  }).then(function () {
    return Store.keys();
  }).then(function (ks) {
    return Promise.all(B.rotation(ks, B.MAX_INSTANTANES).map(function (k) { return Store.del(k); }));
  }).catch(function () { });
}

/* Corbeille commune à tout ce qui se supprime. Chaque type déclare où ses
   objets vivent et comment les enregistrer : reposer un chantier ou une
   commande dans sa liste devient la même opération. */
var CORBEILLE = {
  bordereau:   { nom: 'Bordereau' },
  chantier:    { nom: 'Chantier',    liste: 'chantiers',    sauver: function () { return sauverChantiers(); } },
  depense:     { nom: 'Dépense',     liste: 'depenses',     sauver: function () { return sauverDepenses(); } },
  pile:        { nom: 'Pile',        liste: 'piles',        sauver: function () { return sauverPiles(); } },
  charge:      { nom: 'Charge fixe', liste: 'charges',      sauver: function () { return sauverCharges(); } },
  produit:     { nom: 'Produit',     liste: 'articles',     sauver: function () { return sauverArticles(); } },
  fournisseur: { nom: 'Fournisseur', liste: 'fournisseurs', sauver: function () { return sauverFournisseurs(); } },
  commande:    { nom: 'Commande',    liste: 'commandes',    sauver: function () { return sauverCommandes(); } },
  sortie:      { nom: 'Mouvement',   liste: 'sorties',      sauver: function () { return sauverSorties(); } },
  journee:     { nom: 'Journée',     liste: 'journees',     sauver: function () { return sauverJournees(); } },
  /* Les notes vivent dans A.cfg, pas dans une liste de A : elles se reposent elles-mêmes. */
  note:        { nom: 'Note', reposer: function (o) {
    var l = notes();
    if (o && o.id && l.some(function (x) { return x.id === o.id; })) o.id = uid();
    l.push(o);
    return sauverCfg();
  } }
};

function corbeille() {
  return Store.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('bordcub.poubelle.') === 0; })
      .map(function (k) {
        return lire(k, null).then(function (o) {
          if (!o) return null;
          /* Ancien format : un bordereau nu sous la clé « b ». */
          if (o.b) {
            return { cle: k, suppr: o.suppr || 0, type: 'bordereau', b: o.b,
              nom: (o.b.meta && o.b.meta.foret) || 'Sans forêt',
              detail: E.fmt((o.b.lignes || []).length, 0) + ' billons' };
          }
          if (o.o && CORBEILLE[o.type]) {
            return { cle: k, suppr: o.suppr || 0, type: o.type, o: o.o,
              nom: o.nom || '', detail: o.detail || '' };
          }
          return null;
        });
      }));
  }).then(function (l) {
    return l.filter(Boolean).sort(function (a, b) { return b.suppr - a.suppr; });
  }).catch(function () { return []; });
}

/* Mettre à la corbeille plutôt qu'effacer. L'objet entier est conservé :
   au repêchage il revient tel qu'il était, liens compris. */
function jeterObjet(type, objet, nom, detail) {
  return Store.set(B.clePoubelle(uid()), JSON.stringify({
    suppr: Date.now(), type: type, nom: nom || '', detail: detail || '', o: objet
  }));
}
function repecherObjet(e) {
  var d = CORBEILLE[e.type];
  if (!d || !(d.liste || d.reposer)) { toast('Type inconnu.'); return Promise.resolve(); }
  if (d.reposer) {
    return d.reposer(e.o).then(function () { return Store.del(e.cle); }).then(function () {
      renderNotes(); renderSauvegarde();
      toast(d.nom + ' récupérée.');
    });
  }
  var l = A[d.liste] = A[d.liste] || [];
  var o = e.o;
  /* Si un objet porte déjà cet identifiant, on en donne un neuf plutôt que
     d'écraser ce qui est en place. */
  if (o && o.id && l.some(function (x) { return x.id === o.id; })) o.id = uid();
  l.push(o);
  return d.sauver().then(function () { return Store.del(e.cle); }).then(function () {
    indexerStock();
    renderCarnet(); renderAccueil(); renderDepenses(); renderFinances(); renderCharges();
    renderPiles(); renderStock(); renderLieux(); renderStockFournitures(); renderCommandes();
    renderRevient(); renderReglagesStock(); renderCarteChantiers(); renderSauvegarde();
    toast((d.nom || 'Élément') + ' récupéré.');
  });
}
function jeter(id) {
  return lire('bordcub.b.' + id, null).then(function (b) {
    if (!b) return;
    return Store.set(B.clePoubelle(id), JSON.stringify({ suppr: Date.now(), b: b }))
      .then(function () { return Store.del('bordcub.b.' + id); });
  });
}
function purger() {
  return corbeille().then(function (l) {
    return Promise.all(B.aPurger(l, Date.now()).map(function (k) { return Store.del(k); }));
  }).catch(function () { });
}
function repecher(cle) {
  return lire(cle, null).then(function (o) {
    if (!o || !o.b) { toast('Introuvable.'); return; }
    var b = o.b;
    if (A.index.some(function (x) { return x.id === b.id; })) b.id = uid();
    b.maj = Date.now();
    A.index.push({ id: b.id, meta: b.meta, maj: b.maj, nb: (b.lignes || []).length, vol: 0 });
    return ecrire('bordcub.b.' + b.id, b)
      .then(function () { return ecrire('bordcub.index', A.index); })
      .then(function () { return Store.del(cle); })
      .then(function () {
        renderFichiers(); renderSauvegarde();
        toast('Bordereau récupéré.');
      });
  });
}

/* Réintègre une sauvegarde, fichier ou instantané. */
function integrer(objet, source, remplace) {
  var s = B.lireSauvegarde(objet);
  if (!s) { toast('Fichier illisible.'); return Promise.resolve(); }
  var n = 0, nPiles = 0, nCh = 0, dernier = null;
  return s.bordereaux.reduce(function (ch, b) {
    return ch.then(function () {
      b.id = uid(); b.maj = Date.now(); b.prix = b.prix || {}; b.lignes = b.lignes || [];
      A.index.push({ id: b.id, meta: b.meta, maj: b.maj, nb: b.lignes.length, vol: 0 });
      n++; dernier = b;
      return ecrire('bordcub.b.' + b.id, b);
    });
  }, Promise.resolve()).then(function () {
    return ecrire('bordcub.index', A.index);
  }).then(function () {
    var np = 0;
    (s.piles || []).forEach(function (p) {
      if (!p || !p.nom) return;
      if (A.piles.some(function (x) { return x.id === p.id; })) p.id = uid();
      p.maj = Date.now(); A.piles.push(p); np++;
    });
    if (np) { nPiles = np; }
    var nc = 0;
    (s.chantiers || []).forEach(function (ch) {
      if (!ch || !ch.nom) return;
      if (A.chantiers.some(function (x) { return x.id === ch.id; })) ch.id = uid();
      ch.maj = Date.now(); A.chantiers.push(ch); nc++;
    });
    nCh = nc;
    var nd = 0;
    (s.depenses || []).forEach(function (dp) {
      /* Une dépense porte soit des lignes, soit un montant à plat — le format
         d'avant, que le formulaire efface désormais en enregistrant. N'exiger
         que le montant à plat rejetait donc en silence toute dépense saisie
         depuis : la sauvegarde ne les protégeait plus. */
      if (!dp || (dp.ttc == null && !(dp.lignes && dp.lignes.length))) return;
      if (A.depenses.some(function (x) { return x.id === dp.id; })) dp.id = uid();
      A.depenses.push(dp); nd++;
    });
    var na = 0, ng = 0;
    (s.articles || []).forEach(function (ar) {
      if (!ar || !ar.nom) return;
      if (A.articles.some(function (x) { return x.id === ar.id; })) ar.id = uid();
      A.articles.push(ar); na++;
    });
    (s.charges || []).forEach(function (cg) {
      if (!cg || !cg.libelle) return;
      if (A.charges.some(function (x) { return x.id === cg.id; })) cg.id = uid();
      A.charges.push(cg); ng++;
    });
    var nf = 0, nm = 0;
    A.fournisseurs = A.fournisseurs || [];
    (s.fournisseurs || []).forEach(function (f2) {
      if (typeof f2 === 'string') { idFournisseurParNom(f2); nf++; return; }
      if (!f2 || !f2.nom) return;
      if (A.fournisseurs.some(function (x) { return x.id === f2.id; })) return;
      A.fournisseurs.push(f2); nf++;
    });
    A.commandes = A.commandes || []; A.sorties = A.sorties || [];
    (s.commandes || []).forEach(function (cm) {
      if (!cm || !cm.lignes) return;
      if (A.commandes.some(function (x) { return x.id === cm.id; })) cm.id = uid();
      A.commandes.push(cm); nm++;
    });
    (s.sorties || []).forEach(function (so) {
      if (!so || !so.lignes) return;
      if (A.sorties.some(function (x) { return x.id === so.id; })) so.id = uid();
      A.sorties.push(so); nm++;
    });
    A.versements = A.versements || [];
    (s.versements || []).forEach(function (vv) {
      if (!vv || vv.montant == null) return;
      if (A.versements.some(function (x) { return x.id === vv.id; })) return;
      A.versements.push(vv); nm++;
    });
    A.achats = A.achats || [];
    (s.achats || []).forEach(function (ac) {
      if (!ac || !ac.quoi) return;
      if (A.achats.some(function (x) { return x.id === ac.id; })) return;
      A.achats.push(ac); nm++;
    });
    /* Le carnet du véhicule est un objet unique : on fusionne ses listes.
       Les postes se dédoublonnent par le nom — les semés d'origine portent
       un identifiant différent sur chaque téléphone. */
    if (s.vehicule) {
      A.vehicule = A.vehicule || vehiculeDefaut();
      ['interventions', 'releves'].forEach(function (k) {
        (s.vehicule[k] || []).forEach(function (x) {
          if (!x) return;
          A.vehicule[k] = A.vehicule[k] || [];
          if (A.vehicule[k].some(function (y) { return y.id === x.id; })) return;
          A.vehicule[k].push(x); nm++;
        });
      });
      /* Un poste du même nom n'est pas remplacé, il est complété : ce qui
         arrive apporte souvent le « dernier fait » que le poste semé n'a pas.
         Sauter purement et simplement rendait tout import d'historique
         incapable de renseigner les échéances. */
      (s.vehicule.postes || []).forEach(function (x) {
        if (!x || !x.nom) return;
        A.vehicule.postes = A.vehicule.postes || [];
        var deja = A.vehicule.postes.filter(function (y) { return y.nom === x.nom; })[0];
        if (!deja) { A.vehicule.postes.push(x); nm++; return; }
        if (C.nb(x.dernierKm) > C.nb(deja.dernierKm)) { deja.dernierKm = x.dernierKm; nm++; }
        if (x.dernierDate && (!deja.dernierDate || x.dernierDate > deja.dernierDate)) {
          deja.dernierDate = x.dernierDate; nm++;
        }
        if (!C.nb(deja.pkm) && C.nb(x.pkm)) deja.pkm = x.pkm;
        if (!C.nb(deja.pmois) && C.nb(x.pmois)) deja.pmois = x.pmois;
      });
      if (s.vehicule.infos && (s.vehicule.infos.nom || s.vehicule.infos.note) &&
        !((A.vehicule.infos || {}).nom)) A.vehicule.infos = s.vehicule.infos;
    }
    A.journees = A.journees || [];
    (s.journees || []).forEach(function (jj) {
      if (!jj || !jj.postes) return;
      if (A.journees.some(function (x) { return x.id === jj.id; })) jj.id = uid();
      A.journees.push(jj); nm++;
    });
    return Promise.all([np ? sauverPiles() : null, nc ? sauverChantiers() : null,
      nd ? sauverDepenses() : null, na ? sauverArticles() : null, ng ? sauverCharges() : null,
      nf ? sauverFournisseurs() : null, nm ? sauverCommandes() : null, nm ? sauverSorties() : null,
      nm ? sauverJournees() : null, sauverVersements(), sauverVehicule(), sauverAchats()]);
  }).then(function () {
    if (dernier) { A.bord = dernier; return ecrire('bordcub.actif', dernier.id); }
  }).then(function () {
    /* Sans bordereau actif il n'y a pas de formulaire à remplir : le vider
       plantait toute restauration ne contenant que des données d'entreprise. */
    appliquerCouleur(); majBandeau();
    if (A.bord) viderFormulaire(false);
    renderFichiers(); renderBordereau(); renderSyntheses(); renderSauvegarde();
    renderPiles(); renderStock(); renderLieux(); renderCarnet(); renderDepenses(); renderFinances();
    renderCharges(); indexerStock(); indexerJournees(); renderStockFournitures(); renderCommandes();
    /* Une sauvegarde d'avant la 4.36 rapporte des chantiers sans la case
       « devis » — et sa configuration efface le repère de migration. On
       repasse donc dessus ici, sans attendre le prochain lancement. */
    migrerDevis();
    synchroniserDepensesCharges().then(function (n) {
      if (n) { renderDepenses(); renderFinances(); renderCharges(); }
    });
    renderRevient(); renderReglagesStock(); renderCarteChantiers();
    moissonnerListes(s);
    var revenu = contenuSauvegarde();
    toast(revenu.length
      ? (remplace ? 'Remplacé par ' : 'Restauré : ') + listerContenu(revenu) + '.'
      : 'Rien n’a été restauré.');
  });
}

function renderFichiersModule() {
  if (A.module === 'cubage') {
    var e = $('#f-cub-actif');
    if (e) e.textContent = A.bord
      ? 'Bordereau ouvert : ' + ((A.bord.meta && A.bord.meta.foret) || 'sans nom') + '.'
      : 'Ouvrez un bordereau pour l’exporter.';
  }
  if (A.module === 'bois') renderAnalysesBois();
}

/* Ce que le stock a fait dans le temps : ce qui est entré, ce qui est sorti,
   ce que ça a rapporté. Le reste du module dit où en est le bois ; ici on
   regarde derrière soi. */
function renderAnalysesBois() {
  var z = $('#bois-analyses'); if (!z) return;
  if (!A.piles.length) {
    z.innerHTML = '<div class="carte"><div class="vide"><p>Aucune pile enregistrée : ' +
      'les analyses apparaîtront dès la première.</p></div></div>';
    return;
  }
  /* Douze mois glissants, entrées d'un côté, sorties de l'autre. */
  var mois = [], cle = {}, maintenant = new Date();
  for (var i = 11; i >= 0; i--) {
    var d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    var k = d.getFullYear() + '-' + d.getMonth();
    cle[k] = mois.length;
    mois.push({ k: k, lib: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
      an: d.getFullYear(), entre: 0, sorti: 0, vendu: 0, ca: 0 });
  }
  var placer = function (ts) {
    var d = new Date(ts); var i = cle[d.getFullYear() + '-' + d.getMonth()];
    return i == null ? null : mois[i];
  };
  var totEntre = 0, totSorti = 0, totVendu = 0, totCa = 0;
  A.piles.forEach(function (p) {
    var m = p.empile ? placer(p.empile) : null;
    var st = H.steres(p);
    if (m) m.entre += st;
    totEntre += st;
    (p.mouvements || []).forEach(function (x) {
      var mm = placer(x.date);
      var q = H.nb(x.st);
      totSorti += q;
      if (mm) mm.sorti += q;
      if (x.motif === 'Vendu') {
        totVendu += q; totCa += H.nb(x.prix);
        if (mm) { mm.vendu += q; mm.ca += H.nb(x.prix); }
      }
    });
  });
  var max = Math.max.apply(null, mois.map(function (m) { return Math.max(m.entre, m.sorti); }).concat([1]));
  var prixMoyen = totVendu > 0 ? totCa / totVendu : 0;

  z.innerHTML =
    '<div class="carte"><h2>Douze derniers mois</h2>' +
    '<div style="display:flex;align-items:flex-end;gap:3px;height:120px;margin:14px 0 0">' +
    mois.map(function (m) {
      var he = Math.round(m.entre / max * 100), hs = Math.round(m.sorti / max * 100);
      return '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;' +
        'align-items:center;gap:1px;height:100%">' +
        '<div style="display:flex;align-items:flex-end;gap:1px;width:100%;height:100%">' +
        '<div style="flex:1;height:' + he + '%;background:#2E7D46;border-radius:2px 2px 0 0" ' +
        'title="' + E.fmt(m.entre, 2) + ' st empilés"></div>' +
        '<div style="flex:1;height:' + hs + '%;background:#8A5A2B;border-radius:2px 2px 0 0" ' +
        'title="' + E.fmt(m.sorti, 2) + ' st sortis"></div></div>' +
        '<small style="font-size:9px;color:var(--doux)">' + esc(m.lib) + '</small></div>';
    }).join('') + '</div>' +
    '<div style="display:flex;gap:14px;margin-top:9px;font-size:12px">' +
    '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;' +
    'background:#2E7D46;margin-right:5px"></i>empilé</span>' +
    '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;' +
    'background:#8A5A2B;margin-right:5px"></i>sorti</span></div></div>' +

    '<div class="carte"><h2>Depuis le début</h2><div class="kpi">' +
    '<div class="carte2"><b class="num">' + E.fmt(totEntre, 1) + '</b><small>stères empilés</small></div>' +
    '<div class="carte2"><b class="num">' + E.fmt(totSorti, 1) + '</b><small>stères sortis</small></div>' +
    (totVendu ? '<div class="carte2"><b class="num">' + E.fmt(totVendu, 1) + '</b><small>stères vendus</small></div>' +
      '<div class="carte2"><b class="num">' + eur(H.arr(totCa, 2)) + '</b><small>de ventes</small></div>' +
      '<div class="carte2"><b class="num">' + E.fmt(prixMoyen, 2) + ' €</b><small>le stère en moyenne</small></div>' : '') +
    '</div>' +
    (totVendu ? '' : '<p class="muted" style="font-size:12px;margin:10px 0 0">' +
      'Aucune vente enregistrée : sortez du bois avec le motif « Vendu » pour suivre vos prix.</p>') +
    '</div>' + tableauSorties();
}

/* Le détail des sorties, du plus récent au plus ancien. */
function tableauSorties() {
  var l = [];
  A.piles.forEach(function (p) {
    (p.mouvements || []).forEach(function (m) {
      l.push({ pile: p.nom || 'Pile', date: m.date, st: H.nb(m.st), motif: m.motif || '',
        qui: m.qui || '', prix: H.nb(m.prix) });
    });
  });
  if (!l.length) return '';
  l.sort(function (a, b) { return b.date - a.date; });
  var COUL = { 'Vendu': '#2E7D46', 'Déplacé': '#1D6FB8', 'Rentré': '#8A5A2B', 'Brûlé': '#B4231F' };
  return '<div class="carte"><h2>Historique des sorties</h2>' +
    '<div class="tab-boite"><table><thead><tr>' +
    '<th style="text-align:left">Date</th><th style="text-align:left">Pile</th>' +
    '<th style="text-align:left">Motif</th><th class="num">Stères</th>' +
    '<th class="num">€</th><th class="num">€/st</th></tr></thead><tbody>' +
    l.map(function (x) {
      return '<tr><td style="text-align:left">' + new Date(x.date).toLocaleDateString('fr-FR') + '</td>' +
        '<td style="text-align:left">' + esc(x.pile) + '</td>' +
        '<td style="text-align:left"><i class="pt" style="background:' +
        (COUL[x.motif] || '#7A8471') + '"></i>' + esc(x.motif) +
        (x.qui ? ' <span class="muted">' + esc(x.qui) + '</span>' : '') + '</td>' +
        '<td class="num">' + E.fmt(x.st, 2) + '</td>' +
        '<td class="num">' + (x.prix ? E.fmt(x.prix, 2) : '—') + '</td>' +
        '<td class="num">' + (x.prix && x.st ? E.fmt(x.prix / x.st, 2) : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
}

function renderSauvegarde() {
  var e = $('#s-etat'); if (!e) return;
  var c = contenuSauvegarde();
  var q = B.depuisQuand(A.export, Date.now());
  var vieux = c.length && B.sauvegardeAncienne(A.export, Date.now());
  e.style.color = '';
  e.innerHTML = !c.length
    ? 'Rien à sauvegarder pour l’instant.'
    : '<b' + (vieux ? ' style="color:#B4231F"' : '') + '>' +
      (q ? 'Dernière sauvegarde ' + esc(q) + '.' : 'Aucune sauvegarde n’est jamais sortie de ce téléphone.') +
      '</b>' +
      (vieux ? ' Vos données ne vivent qu’ici : une copie ailleurs, et vous ne risquez plus rien.' : '') +
      '<br><span style="font-size:12px">Le fichier emportera ' + esc(listerContenu(c)) + '.</span>';
  if (!$('#s-recup').hidden) renderRecup();
  /* La ligne « Sauvegarde à faire » d'Aujourd'hui tombe dès la copie faite. */
  renderAujourdhui();
}

function renderRecup() {
  var z = $('#s-recup'); if (!z) return;
  z.innerHTML = '<p class="muted" style="font-size:12px;margin:12px 0 6px">Chargement…</p>';
  Promise.all([corbeille(), Store.keys()]).then(function (r) {
    var pou = r[0];
    var snaps = r[1].filter(function (k) { return k.indexOf('bordcub.snap.') === 0; }).sort().reverse();
    var COUL = { bordereau: '#7A8471', chantier: '#2E4A3C', depense: '#8A5A2B', pile: '#5B3A1E',
      charge: '#B98A00', produit: '#C4611B', fournisseur: '#7A8471', commande: '#2E7D46', sortie: '#8A5A2B', note: '#1F5FA9' };
    var h = '<p class="muted" style="font-size:12px;margin:12px 0 6px">Ce que vous supprimez arrive ici. ' +
      'Vous pouvez le restaurer pendant ' + B.JOURS_POUBELLE + ' jours ; ensuite il est effacé automatiquement.</p>';
    h += pou.length ? pou.map(function (p) {
      var d = CORBEILLE[p.type] || {};
      var reste = B.JOURS_POUBELLE - Math.floor((Date.now() - p.suppr) / 86400000);
      return '<div class="liste-item pile-c"><div class="li-h">' +
        '<span class="pastille" style="background:' + (COUL[p.type] || '#7A8471') + ';margin-top:4px"></span>' +
        '<div class="li-c"><b>' + esc(p.nom || d.nom || 'Élément') + '</b><small>' +
        esc(d.nom || p.type) + (p.detail ? ' · ' + esc(p.detail) : '') +
        ' · supprimé le ' + new Date(p.suppr).toLocaleDateString('fr-FR') +
        (reste > 0 ? ' · effacé dans ' + reste + ' jour' + (reste > 1 ? 's' : '') : ' · bientôt effacé') +
        '</small></div></div>' +
        '<div class="li-actions">' +
        '<button class="btn-min" data-repecher="' + esc(p.cle) + '">Récupérer</button>' +
        '<button class="btn-min" data-jeterdef="' + esc(p.cle) + '">Supprimer</button></div></div>';
    }).join('') : '<p class="muted" style="font-size:12.5px;margin:0 0 6px">Corbeille vide.</p>';

    h += '<p class="muted" style="font-size:12px;margin:14px 0 6px">Copies automatiques quotidiennes</p>';
    h += snaps.length ? snaps.map(function (k) {
      var d = k.slice('bordcub.snap.'.length).split('-');
      return '<div class="liste-item"><span class="pastille" style="background:#2E4A3C"></span>' +
        '<div class="li-c"><b>' + d[2] + '/' + d[1] + '/' + d[0] + '</b>' +
        '<small>copie complète de la journée</small></div>' +
        '<button class="btn-min" data-instantane="' + esc(k) + '">Restaurer</button></div>';
    }).join('') : '<p class="muted" style="font-size:12.5px;margin:0">Aucune copie pour l’instant.</p>';

    h += '<p class="muted" style="font-size:12px;margin:12px 0 0" id="s-place"></p>';
    z.innerHTML = h;
    Store.place().then(function (p) {
      var el = $('#s-place'); if (!el) return;
      el.textContent = 'Stockage : ' + Store.mode() +
        (p ? ' · ' + B.octets(p.utilise) + ' occupés' : '');
    });
  });
}

/* ------------------------------------------------------------- fichiers */
function lignesStock() {
  /* Une colonne par essence, avec sa proportion à côté : un tableur sait
     alors trier, filtrer et faire des graphiques, ce qu'une case « Chêne 80 %
     Hêtre 20 % » interdit. Le nombre de colonnes suit la pile la plus mêlée. */
  var maxEss = A.piles.reduce(function (m, p) {
    return Math.max(m, (p.essences || []).length);
  }, 1);
  var enTete = ['Nom', 'Lieu', 'Type'];
  for (var k = 1; k <= maxEss; k++) enTete.push('Essence ' + k, 'Part ' + k + ' (%)');
  enTete = enTete.concat(['Longueur bûche', 'Vert / mort', 'Part verte (%)',
    'Stères', 'Sortis', 'Restant', 'Vendus', 'Recettes (€)', 'Prix moyen (€/st)',
    'Empilé le', 'Humidité (%)', 'État', 'Sèche vers', 'Latitude', 'Longitude', 'Note']);
  var l = [enTete];

  A.piles.forEach(function (p) {
    var e = H.etat(p, Date.now(), A.cfg);
    var m = H.derniereMesure(p);
    var comp = H.composition(p);
    var vendus = 0, recettes = 0;
    (p.mouvements || []).forEach(function (x) {
      if (x.motif === 'Vendu') { vendus += H.nb(x.st); recettes += H.nb(x.prix); }
    });
    var ligne = [
      p.nom || '', p.lieu || '',
      H.TYPES[H.typePile(p.essences) || 'mixte'] || ''
    ];
    var ess = p.essences || [];
    for (var i = 0; i < maxEss; i++) {
      var c = ess[i];
      if (!c) { ligne.push('', ''); continue; }
      var pc = p.pourcents && p.pourcents[c] != null ? H.nb(p.pourcents[c])
        : (ess.length === 1 ? 100 : '');
      ligne.push(H.nomEssence(c), pc === '' ? '' : E.fmtBrut(pc, 0));
    }
    ligne = ligne.concat([
      H.nomBuche(p.buche),
      H.libelleComposition(p),
      comp ? E.fmtBrut(comp.partVert, 0) : '',
      E.fmtBrut(H.steres(p), 2), E.fmtBrut(H.sorti(p), 2), E.fmtBrut(H.restant(p), 2),
      vendus ? E.fmtBrut(vendus, 2) : '',
      recettes ? E.fmtBrut(recettes, 2) : '',
      vendus > 0 && recettes > 0 ? E.fmtBrut(recettes / vendus, 2) : '',
      p.empile ? new Date(p.empile).toLocaleDateString('fr-FR') : '',
      m ? E.fmtBrut(m.taux, 1) : '', e.texte,
      e.secheVers && !e.sec ? new Date(e.secheVers).toLocaleDateString('fr-FR') : '',
      p.gps ? p.gps.lat.toFixed(5) : '', p.gps ? p.gps.lon.toFixed(5) : '', p.notes || ''
    ]);
    l.push(ligne);
  });
  return l;
}
function exportStockCsv() {
  if (!A.piles.length) { toast('Aucune pile à exporter.'); return; }
  var q = function (v) { v = String(v == null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var txt = '\uFEFF' + lignesStock().map(function (r) { return r.map(q).join(';'); }).join('\r\n');
  telecharger('stock-bois-' + B.jour(Date.now()) + '.csv', txt, 'text/csv');
  marquerExport();
}
function exportStockXlsx() {
  if (!A.piles.length) { toast('Aucune pile à exporter.'); return; }
  try {
    var sheets = [{ name: 'Stock bois', rows: lignesStock(),
      cols: [22, 22, 12, 12, 9, 8, 9, 12, 11, 13, 11, 16, 13, 11, 11, 24] }];
    telecharger('stock-bois-' + B.jour(Date.now()) + '.xlsx',
      window.BCX.xlsxBuild(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    marquerExport();
  } catch (e) { toast('Export impossible.'); }
}

/* Les réglages vivent tous au même endroit, rangés par domaine. On y accède
   depuis l'accueil, ou depuis un module — qui ouvre alors sa propre section. */
/* Un raccourci depuis un module ouvre le bon onglet et fait défiler jusqu'à
   la bonne zone. */
/* De quel écran on vient décide non seulement de l'onglet des réglages, mais
   de la zone : déposer au sommet d'un onglet qui déroule six sujets revenait à
   ne rien indiquer du tout. */
var SEC_DE_MODULE = {
  cubage: 'cubage', bois: 'bois',
  chantiers: 'journee', calendrier: 'alertes', rendements: 'journee',
  finances: 'fin', stock: 'stock', vehicule: 'vehicule', achats: 'fin'
};
var RACCOURCIS_REGLAGES = {
  maj: ['general', 'maj'], sauvegarde: ['general', 'sauvegarde'],
  stock: ['ent', 'stock'], listes: ['ent', 'listes'], fin: ['ent', 'fin'],
  journee: ['ent', 'journee'], vehicule: ['ent', 'vehicule'],
  alertes: ['ent', 'alertes']
};
/* Pas de second niveau d'onglets : un onglet déroule toutes ses zones, chacune
   sous son propre sous-titre. On lit la page en descendant plutôt que de
   chercher où cliquer. */
function renderReglagesNav() {
  var z = $('#regl-corps'); if (!z) return;
  var sec = A.secReglages || 'general';
  z.className = '';
  $$('#regl-nav .chip').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.regl === sec));
  });
  Array.prototype.slice.call(z.children).forEach(function (el) {
    el.hidden = el.dataset.sec !== sec;
  });
  if (sec === 'ent') renderListesReglages();
}
/* Amener la zone demandée sous les yeux, sans la faire clignoter. */
function versZoneReglages(sous) {
  if (!sous) return;
  var t = $('#regl-corps [data-sous="' + sous + '"]');
  if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function allerReglages(sec) {
  var r = RACCOURCIS_REGLAGES[sec];
  var zone = null;
  if (r) { sec = r[0]; zone = r[1]; }
  A.secReglages = sec || 'general';
  document.body.classList.remove('accueil-ouvert');
  A.module = moduleValide(A.module);
  majOnglets();
  renderReglagesNav();
  aller('reglages');
  if (zone) setTimeout(function () { versZoneReglages(zone); }, 60);
}

/* Le logo est réduit avant d'être gardé : une photo de téléphone pèse
   plusieurs mégaoctets, et le stockage local d'un navigateur n'est pas
   extensible. 256 pixels suffisent largement aux deux endroits où il
   s'affiche. */
var LOGO_COTE = 256;
function reduireImage(fichier, cote) {
  return new Promise(function (resolve, reject) {
    var lecteur = new FileReader();
    lecteur.onerror = function () { reject(new Error('lecture impossible')); };
    lecteur.onload = function () {
      var img = new Image();
      img.onerror = function () { reject(new Error('image illisible')); };
      img.onload = function () {
        var k = Math.min(1, cote / Math.max(img.width || 1, img.height || 1));
        var l = Math.max(1, Math.round((img.width || 1) * k));
        var h = Math.max(1, Math.round((img.height || 1) * k));
        var c = document.createElement('canvas');
        c.width = l; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, l, h);
        /* PNG : un logo a souvent un fond transparent, que le JPEG noircirait. */
        resolve(c.toDataURL('image/png'));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}
function renderReglagesMarque() {
  var nom = $('#r-ent-nom'); if (!nom) return;
  A.cfg = A.cfg || {};
  nom.value = A.cfg.nomEntreprise || '';
  if ($('#r-ent-siret')) $('#r-ent-siret').value = A.cfg.siret || '';
  if ($('#r-ent-tel')) $('#r-ent-tel').value = A.cfg.telEntreprise || '';
  if ($('#r-ent-adr')) $('#r-ent-adr').value = A.cfg.adresseEntreprise || '';
  var z = $('#r-ent-apercu'), logo = A.cfg.logoEntreprise || '';
  z.hidden = !logo;
  z.innerHTML = logo ? '<img alt="">' : '';
  if (logo) z.querySelector('img').src = logo;
  $('#r-ent-retirer').hidden = !logo;
}
function brancherReglagesMarque() {
  var nom = $('#r-ent-nom'); if (!nom) return;
  nom.addEventListener('change', function () {
    A.cfg.nomEntreprise = this.value.trim();
    sauverCfg().then(function () { renderAccueil(); toast('Nom enregistré.'); });
  });
  [['#r-ent-siret', 'siret'], ['#r-ent-tel', 'telEntreprise'],
    ['#r-ent-adr', 'adresseEntreprise']].forEach(function (p) {
    var e = $(p[0]); if (!e) return;
    e.addEventListener('change', function () {
      A.cfg[p[1]] = this.value.trim();
      sauverCfg().then(function () { toast('Enregistré.'); });
    });
  });
  $('#r-ent-fichier').addEventListener('change', function () {
    var fic = this.files && this.files[0];
    this.value = '';
    if (!fic) return;
    reduireImage(fic, LOGO_COTE).then(function (url) {
      A.cfg.logoEntreprise = url;
      return sauverCfg();
    }).then(function () {
      renderReglagesMarque(); renderNotesMaj(); renderAccueil();
      toast('Logo enregistré.');
    })['catch'](function () { toast('Cette image n’a pas pu être lue.'); });
  });
  $('#r-ent-retirer').addEventListener('click', function () {
    if (!confirm('Retirer votre logo ?')) return;
    A.cfg.logoEntreprise = null;
    sauverCfg().then(function () {
      renderReglagesMarque(); renderNotesMaj(); renderAccueil(); toast('Logo retiré.');
    });
  });
}

/* Les cinq dernières mises à jour, en clair. Écrites à la main à chaque
   livraison : une liste engendrée depuis les commits dirait « corrections
   diverses », ce qui n'apprend rien. Cinq suffisent — au-delà on ne remonte
   plus, et la liste devient un journal qu'on ne lit pas.
   « vue » rend la ligne cliquable et mène à l'écran concerné. */
var NOTES_MAJ = [
  { v: '4.87', quoi: [
    { t: 'Aujourd’hui devient un vrai écran : en retard, bientôt, vos notes, chantiers en cours, prélèvements, derniers jours' },
    { t: 'Chaque ligne se masque d’un × jusqu’au lendemain ; elle revient tant que ce n’est pas réglé' },
    { t: 'Mes notes passent sur Aujourd’hui ; une nouvelle note se crée par le +' },
    { t: 'À recommander compte aussi ce que les chantiers signés vont prendre', vue: 'stock2' },
    { t: 'La Fiche de chantier ouverte depuis une fiche y ramène', vue: 'carnet' }
  ] },
  { v: '4.86', quoi: [
    { t: 'Une barre en bas, partout : Aujourd’hui, Chantiers, +, Agenda (le calendrier), Argent (les finances)', vue: 'calendrier' },
    { t: 'Le + crée : ma journée, dépense, chantier, note ; et commande, achat, intervention, charge fixe' },
    { t: 'Le ☰ en haut à droite : stock, achats, véhicule, rendements, cubage, bois, réglages, sauvegarde' },
    { t: 'Les onglets de chaque écran sont passés en haut, en pastilles', vue: 'finances' },
    { t: 'Mon entreprise et Mes notes : sur Aujourd’hui, tuile Mon entreprise' }
  ] },
  { v: '4.85.1', quoi: [
    { t: 'Les messages de suppression donnent le bon chemin vers la corbeille', vue: 'reglages' },
    { t: 'Le rappel de sauvegarde de l’accueil ouvre la carte Sauvegarde des Réglages', vue: 'reglages' },
    { t: 'Journées à trancher : la veille n’est plus oubliée après un changement d’heure' }
  ] },
  { v: '4.85', quoi: [
    { t: 'Mes notes se cochent : un élément par ligne, barré et descendu une fois fait' },
    { t: 'Une note supprimée passe par la corbeille, vous pouvez la retrouver', vue: 'reglages' },
    { t: 'Réglages : « Ce qui a changé » est tout en bas de Général' , vue: 'reglages' },
    { t: 'La corbeille explique ce qu’elle garde, et combien de temps' , vue: 'reglages' }
  ] },
  { v: '4.84', quoi: [
    { t: 'Nouveau chantier : avec ou sans devis, et une estimation en jours ou en surface', vue: 'carnet' },
    { t: 'Le SIREN ne se demande plus qu’une fois, sous le champ du client', vue: 'carnet' },
    { t: 'La fiche du chantier ouvre la carte : voir ou placer le chantier', vue: 'carnet' },
    { t: 'Calendrier : la liste de ce qui reste à planifier, chantier par chantier', vue: 'calendrier' },
    { t: 'Finances : les montants ne passent plus à la ligne', vue: 'finances' }
  ] },
  { v: '4.83', quoi: [
    { t: 'Ma journée : le temps total, les heures productives et le trajet', vue: 'calendrier' },
    { t: 'Carte : les zones déjà regardées restent visibles sans réseau', vue: 'carte' },
    { t: 'Carnet : un filtre par famille de travaux', vue: 'carnet' },
    { t: 'Déclarations : le versement libératoire se coche, à partir de son année', vue: 'analyses' },
    { t: 'Le reste dans la tranche d’impôt est à ressaisir : plus de chiffre par défaut', vue: 'analyses' }
  ] },
  { v: '4.82', quoi: [
    { t: 'Carte : chercher une commune, et le doigt ne se bloque plus au bout d’un moment', vue: 'carte' },
    { t: 'Les contours de communes sont partis : photo aérienne ou carte IGN', vue: 'carte' },
    { t: 'Mes notes vont à la ligne, et passent sous les tuiles de Mon entreprise' },
    { t: 'Carnet : les filtres dans votre ordre, et « En cours ou à planifier »', vue: 'carnet' },
    { t: 'Ma journée : plus de case non facturée, et « Hors production » pour l’affûtage', vue: 'calendrier' }
  ] },
  { v: '4.81', quoi: [
    { t: 'Photo aérienne et carte IGN sur la carte, quand vous avez du réseau', vue: 'carte' },
    { t: 'Sans réseau, les contours de communes restent : ils sont dans l’appareil', vue: 'carte' },
    { t: '« Ma position » vous y emmène, au lieu d’y poser un point', vue: 'carte' },
    { t: 'Et le pincement ne bégaye plus quand vous dézoomez large', vue: 'carte' }
  ] },
  { v: '4.80', quoi: [
    { t: 'Une vraie carte : les communes de six départements, hors ligne', vue: 'carte' },
    { t: 'Glissez pour vous déplacer, pincez pour zoomer', vue: 'carte' },
    { t: 'Et « Poser un chantier » place un point d’un doigt', vue: 'carte' }
  ] }
];
/* Seule la version installée est dépliée : les quatre précédentes tiennent
   derrière un bouton. Cinq notes ouvertes faisaient un long défilement pour
   une information qu'on ne relit presque jamais. */
var notesDepliees = false;
function blocNoteMaj(m, i, courante) {
  var ici = courante.indexOf(m.v) === 0;
  return '<div style="padding:' + (i ? '11px' : '0') + ' 0 0' +
    (i ? ';border-top:1px solid var(--trait);margin-top:11px' : '') + '">' +
    '<p class="eyebrow" style="margin:0 0 6px">Version ' + esc(m.v) +
    (ici ? ' <span class="muted" style="font-weight:400;text-transform:none;' +
      'letter-spacing:0">— celle que vous avez</span>' : '') + '</p>' +
    m.quoi.map(function (q) {
      return q.vue
        ? '<button class="note-maj" data-notevue="' + esc(q.vue) + '">' +
          esc(q.t) + '<span aria-hidden="true"> ›</span></button>'
        : '<p class="note-maj sans">' + esc(q.t) + '</p>';
    }).join('') + '</div>';
}
function renderNotesMaj() {
  var z = $('#c-notes-maj'); if (!z) return;
  var courante = String((window.BCP && BCP.version) || '').split('-')[0];
  var l = NOTES_MAJ.slice(0, 5);
  var vues = notesDepliees ? l : l.slice(0, 1);
  var reste = l.length - vues.length;
  z.innerHTML = vues.map(function (m, i) { return blocNoteMaj(m, i, courante); }).join('') +
    (reste > 0 || notesDepliees
      ? '<button class="btn-min" id="notes-plus" style="margin-top:11px">' +
        (notesDepliees ? 'Masquer les versions précédentes'
          : 'Voir les ' + reste + ' versions précédentes') + '</button>'
      : '');
}

function renderReglagesBois() {
  var s = H.seuils(A.cfg), d = H.depart(A.cfg);
  if ($('#r-sv')) $('#r-sv').value = s.vert;
  if ($('#r-ss')) $('#r-ss').value = s.sec;
  if ($('#r-sts')) $('#r-sts').value = s.tresSec;
  if ($('#r-dv')) $('#r-dv').value = d.vert;
  if ($('#r-ds')) $('#r-ds').value = d.sec;
}
function brancherReglagesBois() {
  var maj = function () {
    var v = H.nb($('#r-sv').value), sc = H.nb($('#r-ss').value), ts = H.nb($('#r-sts').value);
    if (!(v > sc && sc > ts && ts > 0 && v <= 60)) {
      toast('Ordre attendu : vert > sec > très sec, entre 0 et 60 %.');
      renderReglagesBois(); return;
    }
    A.cfg.seuils = { vert: v, sec: sc, tresSec: ts };
    sauverCfg(); renderPiles(); renderStock(); renderAccueil();
  };
  ['#r-sv', '#r-ss', '#r-sts'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('change', maj);
  });
  var majDepart = function () {
    var v = H.nb($('#r-dv').value), sc = H.nb($('#r-ds').value);
    var seuilSec = H.seuils(A.cfg).sec;
    if (!(v > sc && sc > seuilSec && v <= 70)) {
      toast('Le bois vert doit partir plus haut que le bois mort, lui-même au-dessus du seuil « sec ».');
      renderReglagesBois(); return;
    }
    A.cfg.depart = { vert: v, sec: sc };
    sauverCfg(); renderPiles(); renderStock(); renderAccueil();
  };
  ['#r-dv', '#r-ds'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('change', majDepart);
  });
}

function nomFichier(ext) {
  var m = A.bord.meta;
  var n = [m.article, m.client, m.foret, m.parcelles ? 'Parc ' + m.parcelles : ''].filter(Boolean).join(' ');
  return (n || 'bordereau').replace(/[\\/:*?"<>|]/g, '-').slice(0, 90) + '.' + ext;
}
function telecharger(nom, data, type) {
  try {
    var blob = new Blob([data], { type: type || 'application/octet-stream' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nom; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    toast(nom + ' téléchargé.');
  } catch (e) { toast('Téléchargement impossible dans cet environnement.'); }
}
function exportXlsx() {
  if (!A.bord) return;
  try {
    telecharger(nomFichier('xlsx'), window.BCX.xlsxBuild(window.BCW.construireClasseur(A.bord, A.cfg, E)),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (e) { toast('Erreur d’export : ' + e.message); }
}
function exportCsv() {
  if (!A.bord) return;
  var m = A.bord.meta, L = E.cuberTout(A.bord, A.cfg);
  var q = function (v) { var s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  var li = [
    ['Article', m.article, '', '', '', '', '', '', 'Mesures', m.mesures],
    ['Client', m.client, '', '', '', '', '', '', 'Plaquettes', m.plaqCouleur],
    ['Foret', m.foret, '', '', '', '', '', '', 'Type', m.classement],
    ['Parcelles', m.parcelles, '', '', '', '', '', '', 'ETF', m.etf],
    ['N°', 'BP ou D1,30', 'Ess.', 'Qual', 'Long.', 'Diam', 'Parcelle', 'Date / Obs', 'Réfact°', 'Défaut',
      'VolBûchSur', 'VolBûchSous', 'VolMarchSous', 'ClasseDiamSous', 'ClasseMINI']
  ];
  L.forEach(function (l) {
    li.push([l.num, l.bp === true ? 'VRAI' : (l.bp === '' || l.bp == null ? '' : E.fmtBrut(E.toNum(l.bp), 0)),
    l.ess, l.qual, E.fmtBrut(E.toNum(l.lon), 2), E.fmtBrut(E.toNum(l.dia), 0), l.parc, l.obs,
    l.refl === '' || l.refl == null ? '' : E.fmtBrut(E.toNum(l.refl), 2), l.refn,
    E.fmtBrut(l.c.vsur), E.fmtBrut(l.c.vsous), E.fmtBrut(l.c.vmarch), l.c.clDiam, l.c.clMini]);
  });
  telecharger(nomFichier('csv'), '\uFEFF' + li.map(function (r) { return r.map(q).join(';'); }).join('\r\n'), 'text/csv');
}
function exportJson() {
  if (!A.bord) return;
  telecharger(nomFichier('json'), JSON.stringify({ format: 'bordcub-1', bordereau: A.bord, config: A.cfg }, null, 1), 'application/json');
  marquerExport();
}
function importJson() {
  var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.addEventListener('change', function () {
    var f = i.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var o = null;
      try { o = JSON.parse(fr.result); } catch (e) { toast('Fichier illisible.'); return; }
      demanderRestauration(o, f.name);
    };
    fr.readAsText(f);
  });
  i.click();
}
/* Restaurer sur une application vide ne pose aucune question : il n'y a
   rien à perdre. Sur une application qui contient déjà quelque chose, le
   choix compte trop pour être fait à la place de l'utilisateur. */
function demanderRestauration(objet, nom) {
  var s = B.lireSauvegarde(objet);
  if (!s) { toast('Fichier illisible.'); return; }
  var venant = [
    { n: (s.bordereaux || []).length, u: 'bordereau', p: 'bordereaux' },
    { n: (s.piles || []).length, u: 'pile', p: 'piles' },
    { n: (s.chantiers || []).length, u: 'chantier', p: 'chantiers' },
    { n: (s.depenses || []).length, u: 'dépense', p: 'dépenses' },
    { n: (s.commandes || []).length, u: 'commande', p: 'commandes' },
    { n: (s.sorties || []).length, u: 'mouvement', p: 'mouvements' },
    { n: (s.journees || []).length, u: 'journée', p: 'journées' },
    { n: (s.articles || []).length, u: 'produit', p: 'produits' },
    /* Même oubli que dans contenuSauvegarde(), mais du côté de ce qui arrive :
       un fichier ne portant que le carnet du véhicule s'annonçait « rien de
       reconnaissable » en face de trente-deux chantiers. Devant ça, personne
       n'ose appuyer — et il aurait eu raison. */
    { n: (s.versements || []).length, u: 'versement', p: 'versements' },
    { n: ((s.vehicule || {}).interventions || []).length,
      u: 'intervention du véhicule', p: 'interventions du véhicule' }
  ].filter(function (x) { return x.n > 0; });
  var ici = contenuSauvegarde();
  if (!ici.length) { integrer(objet, nom); return; }

  modale('Restaurer ' + nom,
    '<div class="carte2" style="margin-top:0"><b>Le fichier contient</b><br>' +
    '<span style="font-size:13px">' + esc(venant.length ? listerContenu(venant) : 'rien de reconnaissable') + '</span></div>' +
    '<div class="carte2" style="margin-top:8px"><b>L’application contient déjà</b><br>' +
    '<span style="font-size:13px">' + esc(listerContenu(ici)) + '</span></div>' +
    '<p class="muted" style="font-size:12.5px;margin:12px 0 0"><b>Fusionner</b> ajoute ce qui vient ' +
    'du fichier sans toucher au reste — c’est le choix sûr, quitte à créer des doublons.<br>' +
    '<b>Remplacer</b> efface tout ce qui est ici et ne garde que le fichier. Une copie de l’état ' +
    'actuel est mise de côté avant, récupérable dans « Récupérer… ».</p>' +
    '<div class="btn-rang" style="margin-top:12px">' +
    '<button class="btn primaire" id="re-fus">Fusionner</button>' +
    '<button class="btn danger" id="re-rem">Remplacer tout</button></div>');

  $('#re-fus').addEventListener('click', function () { fermerModale(); integrer(objet, nom); });
  $('#re-rem').addEventListener('click', function () {
    if (!confirm('Effacer définitivement ' + listerContenu(ici) + ' pour ne garder que le fichier ?')) return;
    fermerModale();
    instantaneForce().then(viderTout).then(function () { integrer(objet, nom, true); });
  });
}

/* Copie de sécurité prise juste avant un remplacement. */
function instantaneForce() {
  return tousLesBordereaux().then(function (bs) {
    return Store.set(B.cleInstantane(Date.now()), JSON.stringify(
      B.construireSauvegarde(A.cfg, bs, sansPhotos(A.piles), A.chantiers, A.depenses, A.clients,
        A.articles, A.charges, A.proprios, A.fournisseurs, A.commandes, A.sorties, A.journees,
        A.versements, A.vehicule, A.achats)));
  });
}
function viderTout() {
  var cles = A.index.map(function (b) { return 'bordcub.b.' + b.id; });
  return cles.reduce(function (ch, k) {
    return ch.then(function () { return Store.del(k); });
  }, Promise.resolve()).then(function () {
    A.index = []; A.bord = null; A.piles = []; A.chantiers = []; A.depenses = [];
    A.clients = []; A.proprios = []; A.articles = []; A.charges = [];
    A.fournisseurs = []; A.commandes = []; A.sorties = []; A.journees = [];
    return Promise.all([ecrire('bordcub.index', A.index), Store.del('bordcub.actif'),
      sauverPiles(), sauverChantiers(), sauverDepenses(), ecrire('bordcub.clients', A.clients),
      ecrire('bordcub.proprios', A.proprios), sauverArticles(), sauverCharges(),
      sauverFournisseurs(), sauverCommandes(), sauverSorties(), sauverJournees()]);
  });
}

function ouvrirColler() {
  modale('Coller depuis Excel',
    '<p class="muted" style="font-size:13px;margin-top:0">Dans Excel, sélectionnez les lignes de la feuille ' +
    '<b>Volumes</b> (colonnes N° … Défaut) puis copiez-les et collez-les ici. Les colonnes attendues, dans l’ordre : ' +
    'N°, BP ou Ø1,30, essence, qualité, longueur, diamètre, parcelle, date/obs, réfaction, défaut.</p>' +
    '<textarea id="c-txt" rows="9" placeholder="50331	VRAI	EPC	V	20,5	40 …"></textarea>' +
    '<div class="btn-rang" style="margin-top:10px"><button class="btn primaire" id="c-ok">Ajouter au bordereau</button></div>');
  $('#c-ok').addEventListener('click', function () {
    var t = $('#c-txt').value.replace(/\r/g, '');
    if (!t.trim()) { fermerModale(); return; }
    var sep = t.indexOf('\t') >= 0 ? '\t' : (t.split('\n')[0].split(';').length > 3 ? ';' : ',');
    var n = 0;
    t.split('\n').forEach(function (raw) {
      if (!raw.trim()) return;
      var c = raw.split(sep).map(function (x) { return x.trim().replace(/^"|"$/g, ''); });
      if (/^n°?$/i.test(c[0]) || /essence|ess\./i.test(c[2] || '')) return;   // ligne d'en-tête
      if (!c[0] || !(E.toNum(c[5]) > 0)) return;
      var bp = (c[1] || '').toUpperCase();
      A.bord.lignes.push({
        num: c[0], bp: (bp === 'VRAI' || bp === 'TRUE' || bp === '✓') ? true : (bp ? E.toNum(bp) : ''),
        ess: (c[2] || '').toUpperCase(), qual: (c[3] || '').toUpperCase(),
        lon: c[4] || '', dia: c[5] || '', parc: c[6] || '', obs: c[7] || '',
        refl: c[8] || '', refn: c[9] || ''
      });
      n++;
    });
    sauver(); majBandeau(); renderBordereau(); renderDernieres(); renderSyntheses(); viderFormulaire(false);
    fermerModale();
    toast(n + ' billon' + (n > 1 ? 's' : '') + ' importé' + (n > 1 ? 's' : '') + '.');
  });
}

