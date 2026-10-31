/* ================================================================ INIT */
/* Raccourcis de l'écran d'accueil : ?vue=saisie|bordereau|syntheses|fichiers|reglages */
function vueDemandee(def) {
  try {
    var m = /[?&]vue=([a-z]+)/.exec(location.search || '');
    var v = m && m[1];
    if (v && ['saisie', 'bordereau', 'syntheses', 'fichiers', 'reglages',
      'stock', 'bois', 'lieux', 'accueil', 'carnet', 'chantier', 'estimer', 'rendements', 'calendrier', 'finances', 'depenses', 'stock2', 'charges', 'carte', 'analyses', 'commandes', 'revient'].indexOf(v) >= 0) return v;
  } catch (e) { }
  return def;
}

function init() {
  champs(); dessinerCadre(); brancher();
  window.BCS.pret.then(function () {
    return Promise.all([lire('bordcub.cfg', null), lire('bordcub.index', []),
      Store.get('bordcub.actif'), lire('bordcub.export', 0),
      lire('bordcub.piles', []), lire('bordcub.module', 'cubage'), lire('bordcub.chantiers', []),
      lire('bordcub.clients', []), lire('bordcub.depenses', []), lire('bordcub.proprios', []),
      lire('bordcub.articles', []), lire('bordcub.charges', []), lire('bordcub.fournisseurs', []),
      lire('bordcub.commandes', []), lire('bordcub.sorties', []),
      lire('bordcub.journees', []), lire('bordcub.lieux', []),
      lire('bordcub.versements', []), lire('bordcub.vehicule', null),
      lire('bordcub.achats', []), lire('bordcub.masques', {})]);
  })
    .then(function (res) {
      A.export = res[3] || 0;
      A.piles = res[4] || [];
      /* Le module en mémoire peut viser un module retiré : on le corrige et
         on réécrit la valeur, pour que le téléphone cesse de la porter. */
      A.module = moduleValide(res[5]);
      if (A.module !== res[5]) ecrire('bordcub.module', A.module);
      A.chantiers = res[6] || [];
      A.clients = res[7] || [];
      A.depenses = res[8] || [];
      A.proprios = res[9] || [];
      A.articles = res[10] || [];
      A.charges = res[11] || [];
      A.fournisseurs = res[12] || [];
      A.commandes = res[13] || [];
      A.sorties = res[14] || [];
      A.journees = res[15] || [];
      A.lieuxRegles = res[16] || [];
      A.versements = res[17] || [];
      /* Semé une fois, et aussitôt enregistré : sans ça, chaque ouverture
         referait les postes avec de nouveaux identifiants, et les
         interventions qui les désignent auraient pointé dans le vide.
         Une fois écrit, un carnet vidé volontairement de ses postes le reste. */
      A.vehicule = res[18] || vehiculeDefaut();
      if (!res[18]) sauverVehicule();
      A.achats = res[19] || [];
      A.masques = res[20] || {};
      A.cfg = res[0] || E.configDefaut();
      var d = E.configDefaut();
      ['essences', 'qualites', 'favoris'].forEach(function (k) { if (!A.cfg[k]) A.cfg[k] = d[k]; });
      ['seuilDiamSAP', 'seuilDiamEPC', 'seuilLongueur'].forEach(function (k) { if (A.cfg[k] == null) A.cfg[k] = d[k]; });
      if (!A.cfg.mode) A.cfg.mode = 'historique';
      if (!A.cfg.seuils) {
        A.cfg.seuils = { vert: H.SEUILS_DEFAUT.vert,
          sec: A.cfg.seuilHumidite != null ? A.cfg.seuilHumidite : H.SEUILS_DEFAUT.sec,
          tresSec: H.SEUILS_DEFAUT.tresSec };
      }
      A.index = res[1] || [];
      var actif = res[2];
      if (actif != null) {
        try { var p = JSON.parse(actif); if (typeof p === 'string') actif = p; } catch (e) { }
      }
      C.appliquerTravauxPerso(A.cfg);
      migrerStock(); indexerStock(); migrerJournees(); indexerJournees(); migrerDevis();
      migrerLibellesAbcd();
      majDatalistLieux();
      /* Les échéances passées des charges cochées deviennent des dépenses.
         La première fois, cela peut en créer beaucoup d'un coup : on le dit,
         plutôt que de laisser l'historique gonfler en silence. */
      synchroniserDepensesCharges().then(function (n) {
        if (!n) return;
        renderDepenses(); renderFinances(); renderCharges(); renderAnalyses();
        toast(n + ' dépense' + (n > 1 ? 's créées' : ' créée') + ' depuis vos charges fixes.');
      });
      majOnglets(); renderPiles(); renderStock(); renderLieux(); renderReglagesBois();
      renderCarnet(); renderReglagesCh(); renderReglagesDemarrage(); renderReglagesAlertes(); renderEstimer();
      renderReglagesMarque(); renderNotesMaj();
      renderRendements(); renderCalendrier(); renderAlertes();
      renderFinances(); renderDepenses(); renderCharges(); renderStockFournitures();
      renderCarteChantiers(); renderAnalyses(); renderCommandes(); renderRevient();
      renderReglagesStock(); renderAccueil();
      /* Au premier lancement qui suit une mise à jour, on ouvre directement
         ce qui a changé : il vient d'appuyer sur « installer », c'est ce
         qu'il attend. Jamais à la toute première installation — on ne
         dépose pas quelqu'un dans les réglages pour son premier contact. */
      var versionVue = A.cfg.versionVue || null;
      var versionIci = String((window.BCP && BCP.version) || '');
      var vientDeChanger = !!(versionVue && versionIci && versionVue !== versionIci);
      if (versionIci && versionVue !== versionIci) {
        A.cfg.versionVue = versionIci;
        sauverCfg();
      }
      if (vientDeChanger) {
        renderReglages(); renderNotesMaj();
        allerReglages('maj');
        toast('Mise à jour installée.');
        return;
      }
      var vd = vueDemandee(null);
      if (vd === 'accueil') { majBandeau(); renderFichiers(); renderReglages(); allerAccueil(); return; }
      if (vd) {
        var MOD_DE_VUE = { stock: 'bois', bois: 'bois', lieux: 'bois',
          carnet: 'chantiers', chantier: 'chantiers', calendrier: 'calendrier',
          rendements: 'rendements', estimer: 'rendements', finances: 'finances', depenses: 'finances',
          charges: 'finances', stock2: 'stock', commandes: 'stock', revient: 'stock', carte: 'calendrier', analyses: 'finances',
          carnetv: 'vehicule', echeancesv: 'vehicule', coutsv: 'vehicule',
          achats: 'achats', budget: 'achats', fichech: 'chantiers' };
        var mod = MOD_DE_VUE[vd] || 'cubage';
        renderReglages();
        if (actif && A.index.some(function (x) { return x.id === actif; })) {
          return ouvrirBordereau(actif).then(function () { allerModule(mod, vd); });
        }
        majBandeau(); renderFichiers(); allerModule(mod, vd); return;
      }
      /* on ouvre toujours sur l'accueil : c'est de là qu'on choisit sa partie */
      renderReglages(); majBandeau(); renderFichiers();
      if (actif && A.index.some(function (x) { return x.id === actif; })) {
        return ouvrirBordereau(actif).then(function () { allerAccueil(); });
      }
      allerAccueil();
      if (!A.index.length) {
        $('#liste-bordereaux').innerHTML =
          /* Le bouton « Créer un bordereau » qui était ici doublait les tuiles
             de l'écran d'arrivée, et créait un comtois sans le demander. */
          '<div class="vide"><p>Bienvenue. Choisissez votre cubage ci-dessus pour créer ' +
          'votre premier bordereau, ou restaurez une sauvegarde.</p></div>';
      }
    })
    .then(function () {
      /* Le démarrage est fini : données relues, écrans rendus. Les tests s'y
         accrochent au lieu de parier sur une durée — ils dormaient 2,4 s par
         ouverture alors qu'une seconde suffit, et il y en a quarante. */
      document.body.setAttribute('data-pret', '1');
      /* entretien de fond : copie du jour, purge de la corbeille, indicateur */
      renderSauvegarde();
      return purger().then(instantaneDuJour);
    })
    .catch(function () { });
}
/* ========================================================= MODULES SYLVE */
var G = window.BCG, H = window.BCH;

/* Les onglets d'un module : identifiant de vue et libellé. Le dessin vient
   de PICTOS, indexé sur l'identifiant — une même vue porte donc le même
   pictogramme d'un module à l'autre (les réglages, la carte, le carnet). */

/* Un dessin par vue, partagé entre les modules : la carte du calendrier et
   le « Où ? » du bois montrent le même repère, les réglages le même bloc de
   curseurs. Formes tenues volontairement simples : à 20 px, tout détail
   se referme. */
var PICTOS = {
  saisie:     '<path d="M4.6 19.4 8 18.7 18.9 7.8a1.9 1.9 0 0 0 0-2.7l-.6-.6a1.9 1.9 0 0 0-2.7 0L4.7 15.4Z"/>'
            + '<path d="M14.5 6.5 18 10"/>',
  bordereau:  '<rect x="4.2" y="4.4" width="15.6" height="15.2" rx="2"/>'
            + '<path d="M4.2 9.4h15.6M9.6 9.4v10.2"/>',
  syntheses:  '<path d="M5 7.2h14M5 11.2h14M5 15.2h8.6"/><path d="M5 19.2h14" stroke-width="2.7"/>',
  fichiers:   '<path d="M4.2 7.6a2 2 0 0 1 2-2h3.5l2 2.4H17.8a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2Z"/>',
  reglages:   '<path d="M6 4v6.2M6 14.2v5.8M12 4v3.2M12 11.2v8.8M18 4v9.2M18 17.2v2.8"/>'
            + '<circle cx="6" cy="12.2" r="2"/><circle cx="12" cy="9.2" r="2"/><circle cx="18" cy="15.2" r="2"/>',
  carnet:     '<path d="M6 4.6h10.4a1.9 1.9 0 0 1 1.9 1.9v12.9H7.9a1.9 1.9 0 0 1-1.9-1.9Z"/>'
            + '<path d="M6 17.5a1.9 1.9 0 0 1 1.9-1.9h10.4"/><path d="M9.6 8.6h5.2"/>',
  chantier:   '<path d="M13.9 3.8H7.6a1.9 1.9 0 0 0-1.9 1.9v12.6a1.9 1.9 0 0 0 1.9 1.9h8.8a1.9 1.9 0 0 0 1.9-1.9V8.2Z"/>'
            + '<path d="M13.9 3.8v4.4h4.4"/><path d="M8.8 13.2h6.4M8.8 16.4h4.2"/>',
  calendrier: '<rect x="4" y="5.6" width="16" height="14" rx="2"/>'
            + '<path d="M4 10.2h16M8.6 3.6v3.8M15.4 3.6v3.8"/>',
  carte:      '<path d="M12 20.6s6.1-5.9 6.1-10A6.1 6.1 0 0 0 5.9 10.6c0 4.1 6.1 10 6.1 10Z"/>'
            + '<circle cx="12" cy="10.4" r="2.3"/>',
  rendements: '<path d="M4.6 19.6h14.8"/><path d="M7.7 19.6v-5.2M12 19.6v-8.8M16.3 19.6v-12.4"/>',
  estimer:    '<rect x="5.6" y="3.7" width="12.8" height="16.6" rx="2"/>'
            + '<path d="M8.7 7.6h6.6M8.7 12h1.9M11.6 12h1.9M14.5 12h.8M8.7 16h1.9M11.6 16h1.9M14.5 16h.8"/>',
  finances:   '<path d="M16.4 7.6a5.7 5.7 0 0 0-8.5 4.5 5.7 5.7 0 0 0 8.5 4.5"/>'
            + '<path d="M6.3 10.6h6.8M6.3 13.6h6.8"/>',
  depenses:   '<path d="M6.2 3.8h11.6v16.4l-1.9-1.3-1.9 1.3-1.9-1.3-1.9 1.3-1.9-1.3-1.9 1.3Z"/>'
            + '<path d="M9.2 8.4h5.6M9.2 12h5.6"/>',
  charges:    '<path d="M19.2 12a7.2 7.2 0 1 1-2.2-5.1"/><path d="M19.6 4.4v4.3h-4.3"/>',
  analyses:   '<circle cx="12" cy="12" r="7.9"/><path d="M12 4.1v7.9h7.9"/>',
  stock2:     '<path d="M4.7 8.5 12 4.8l7.3 3.7v7L12 19.2l-7.3-3.7Z"/><path d="M4.7 8.5 12 12.2l7.3-3.7M12 12.2v7"/>',
  commandes:  '<path d="M4.6 8.6h11"/><path d="M12.4 5.4 15.6 8.6l-3.2 3.2"/>'
            + '<path d="M19.4 15.4h-11"/><path d="M11.6 12.2 8.4 15.4l3.2 3.2"/>',
  revient:    '<path d="M11.4 3.9h7.4a1.3 1.3 0 0 1 1.3 1.3v7.4a1.3 1.3 0 0 1-.4.9l-7 7a1.3 1.3 0 0 1-1.8 0l-7.4-7.4a1.3 1.3 0 0 1 0-1.8l7-7a1.3 1.3 0 0 1 .9-.4Z"/>'
            + '<circle cx="16" cy="8" r="1.3"/>',
  stock:      '<circle cx="7.6" cy="15.6" r="4.3"/><circle cx="16.4" cy="15.6" r="4.3"/><circle cx="12" cy="7.6" r="4.3"/>',
  bois:       '<rect x="4.4" y="14.2" width="15.2" height="5" rx="1.4"/>'
            + '<rect x="6.6" y="8.7" width="10.8" height="5" rx="1.4"/>'
            + '<rect x="8.8" y="3.2" width="6.4" height="5" rx="1.4"/>'
};
PICTOS.lieux = PICTOS.carte;
PICTOS.carnetv = '<path d="M3.5 15.6V9.4h9.6l3.3 3h4.1v3.2"/><path d="M9.6 16.2h4.6"/>' +
  '<circle cx="7.3" cy="16.2" r="1.8"/><circle cx="16.6" cy="16.2" r="1.8"/>';
PICTOS.echeancesv = '<path d="M4.6 15.8a7.4 7.4 0 1 1 14.8 0"/><path d="m12 15.8 3.2-4.2"/>' +
  '<circle cx="12" cy="15.8" r="1"/>';
PICTOS.coutsv = '<path d="M4.6 19.4h14.8"/><path d="M7.7 19.4v-4.6M12 19.4v-8.2M16.3 19.4v-6"/>' +
  '<path d="M5.4 7.6h4.2M7.5 5.5v4.2"/>';      /* « Où ? » et « Carte », même repère */
/* Un panier, et le « + » de ce qui reste à y mettre. */
PICTOS.fichech = '<path d="M6.4 3.6h7.4l4.2 4.2v12.6H6.4z"/><path d="M13.4 3.8v4.2h4.4"/>' +
  '<path d="M9.2 12.4h5.6M9.2 15.4h5.6"/>';
PICTOS.achats = '<path d="M4.4 8.4h15.2l-1.5 9.1a1.6 1.6 0 0 1-1.6 1.3H7.5a1.6 1.6 0 0 1-1.6-1.3z"/>' +
  '<path d="M8.9 8.4V6.6a3.1 3.1 0 0 1 6.2 0v1.8"/>';
/* Trois piles de hauteurs différentes : ce que ça pèse, par priorité. */
PICTOS.budget = '<path d="M4.6 19.4h14.8"/><rect x="5.6" y="11.2" width="3.6" height="5.4" rx=".8"/>' +
  '<rect x="10.2" y="8" width="3.6" height="8.6" rx=".8"/>' +
  '<rect x="14.8" y="13.4" width="3.6" height="3.2" rx=".8"/>';

var MODULES = {
  cubage: {
    /* On arrive sur « Bordereaux », pas sur la saisie : c'est là que se pose
       le choix du cubage, et que se reprend celui qui est en cours. Le type
       se choisissait au huitième champ de l'en-tête — autant dire nulle part. */
    nom: 'Cubage', defaut: 'fichiers',
    vues: [['saisie', 'Saisie'], ['bordereau', 'Bordereau'], ['syntheses', 'Synthèses'],
    ['fichiers', 'Bordereaux']]
  },
  chantiers: {
    nom: 'Chantiers', defaut: 'carnet', groupe: 'entreprise',
    vues: [['carnet', 'Carnet'], ['chantier', 'Fiche'], ['fichech', 'Fiche de chantier']]
  },
  calendrier: {
    nom: 'Calendrier', defaut: 'calendrier', groupe: 'entreprise',
    vues: [['calendrier', 'Agenda'], ['carte', 'Carte'], ['carnet', 'Carnet']]
  },
  rendements: {
    nom: 'Rendements', defaut: 'rendements', groupe: 'entreprise',
    vues: [['rendements', 'Rendements'], ['estimer', 'Estimer']]
  },
  /* « Devis et estimatif » n'avait aucun écran à lui : son onglet Estimer
     appartenait aux Rendements, son onglet Devis était le carnet des
     Chantiers. C'était une entrée de menu déguisée en module — et depuis que
     le devis vit sur la fiche du chantier, elle n'avait plus d'objet.
     « Analyses » lisait les mêmes données que Finances, sur la même période,
     avec un second jeu de sélecteurs : elle y est devenue un onglet. */
  finances: {
    nom: 'Finances', defaut: 'finances', groupe: 'entreprise',
    vues: [['finances', 'Bilan'], ['depenses', 'Dépenses'],
    ['charges', 'Charges fixes'], ['analyses', 'Analyses']]
  },
  stock: {
    nom: 'Stock et fournitures', defaut: 'stock2', groupe: 'entreprise',
    /* « Prix de revient » nommait mal un écran qui porte aussi un simulateur
       et les performances de vente. La question qu'il pose vraiment est celle
       de la rentabilité. */
    vues: [['stock2', 'Inventaire'], ['commandes', 'Entrées / sorties'],
    ['revient', 'Rentabilité']]
  },
  /* « Il faudrait qu'on crée ce truc pour les achats et les priorités, parce
     que là ce n'est pas une chose en tête, mais des fois j'oublie. » Un
     module, pas un onglet enfoui : ce qu'on oublie doit se voir en arrivant. */
  achats: {
    nom: 'Achats à venir', defaut: 'achats', groupe: 'entreprise',
    vues: [['achats', 'Ma liste'], ['budget', 'Ce que ça pèse']]
  },
  vehicule: {
    /* Le carnet d'entretien de l'utilitaire. Deux vues, jamais une seule :
       un module réduit à un onglet solitaire est interdit par un scénario. */
    nom: 'Véhicule', defaut: 'carnetv', groupe: 'entreprise',
    vues: [['carnetv', 'Carnet'], ['echeancesv', 'Échéances'], ['coutsv', 'Coûts']]
  },
  bois: {
    nom: 'Bois de chauffage', defaut: 'stock',
    vues: [['stock', 'Stock'], ['bois', 'Piles'], ['lieux', 'Où ?'],
    ['fichiers', 'Export et analyse']]
  }
};

/* Les dessins du cadre (lot 5a), repris de la maquette V2 validée. Ceux qui
   existaient déjà gardent le leur : la barre montre le carnet, l'agenda et
   l'euro des onglets qu'elle ouvre. */
PICTOS.jour = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4' +
  'M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>';
PICTOS.horloge = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';
PICTOS.note = '<path d="M5 4h10l4 4v12H5z"/><path d="M14 4v5h5M8.5 13h7M8.5 16.5h4.5"/>';
PICTOS.sauvegarde = '<path d="M7 18.5a4 4 0 0 1-.6-8A6 6 0 0 1 18 9.5a4.5 4.5 0 0 1 0 9z"/>' +
  '<path d="M12 16v-5M9.6 13.4 12 11l2.4 2.4"/>';
PICTOS.corbeille = '<path d="M4 7h16M9.5 7V4h5v3M6 7l1 13h10l1-13"/>';
PICTOS.menu = '<path d="M4 7h16M4 12h16M4 17h16"/>';
PICTOS.retour = '<path d="M14.5 6l-6 6 6 6"/>';
PICTOS.plus = '<path d="M12 5v14M5 12h14"/>';
PICTOS.chevron = '<path d="M9.5 6l6 6-6 6"/>';
/* Le dessin de l'ancienne tuile Cubage de l'accueil, gardé par le ☰. */
PICTOS.cubage = '<circle cx="12" cy="12" r="8.4"/><path d="M4.5 12h15"/>' +
  '<path d="M7.1 9.5 4.6 12l2.5 2.5M16.9 9.5 19.4 12l-2.5 2.5"/>';
function picto(nom) {
  return '<svg viewBox="0 0 24 24" class="pic" aria-hidden="true">' + (PICTOS[nom] || '') + '</svg>';
}

/* ============================================================ LE CADRE */
/* Quatre onglets en bas, le + au milieu. Chacun ouvre l'écran d'arrivée de
   son module : Chantiers le carnet, Agenda le calendrier, Argent le bilan. */
var BARRE = {
  aujourdhui: { nom: 'Aujourd’hui', picto: 'jour' },
  chantiers: { nom: 'Chantiers', picto: 'carnet', module: 'chantiers' },
  agenda: { nom: 'Agenda', picto: 'calendrier', module: 'calendrier' },
  argent: { nom: 'Argent', picto: 'finances', module: 'finances' }
};
var ONGLET_DE_MODULE = { chantiers: 'chantiers', calendrier: 'agenda', finances: 'argent' };
var TITRES_VUE = { accueil: 'Aujourd’hui', reglages: 'Réglages',
  chantier: 'Chantier', fichech: 'Fiche de chantier' };

/* Trois sortes d'écrans, qui ne remontent pas de la même façon :
   - « barre » : un onglet de la barre ; il remonte à Aujourd'hui ;
   - « fixe » : son parent ne change jamais (la fiche → Chantiers ; la
     Fiche de chantier → la fiche d'où on l'a ouverte, sinon Chantiers) ;
   - « libre » : ce qu'on ouvre par le ☰ ou par un lien (Stock, Véhicule,
     Cubage, Réglages…) ; il remonte là d'où l'on vient. */
function typeEcran(e) {
  if (!e || e.vue === 'accueil') return 'racine';
  if (e.vue === 'reglages') return 'libre';
  if (ONGLET_DE_MODULE[e.module]) {
    return e.module === 'chantiers' && (e.vue === 'chantier' || e.vue === 'fichech') ? 'fixe' : 'barre';
  }
  return 'libre';
}
function titreEcran(e) {
  if (TITRES_VUE[e.vue]) return TITRES_VUE[e.vue];
  var o = ONGLET_DE_MODULE[e.module];
  if (o) return BARRE[o].nom;
  return (MODULES[e.module] || {}).nom || 'Sylve';
}
function memeModule(a, b) {
  return a.vue !== 'reglages' && b.vue !== 'reglages' && a.module === b.module;
}

/* Le chemin d'un écran libre : la pile des écrans d'où l'on est venu. Passer
   d'une pastille à l'autre, ou d'une entrée du ☰ à une autre, est un pas de
   côté : le parent reste celui d'avant. Revenir sur un onglet de la barre
   vide la pile. */
function noterParcours(v) {
  var de = A.ecran, vers = { vue: v, module: A.module }, parMenu = !!A.parMenu;
  A.parMenu = false;
  /* La Fiche de chantier ouverte depuis une fiche y revient (31/10) ; par la
     pastille du carnet, elle revient aux Chantiers. */
  if (v === 'fichech' && !(de && de.vue === 'fichech')) A.fchDeFiche = !!(de && de.vue === 'chantier');
  if (typeEcran(vers) !== 'libre') { A.pile = []; return; }
  if (A.enRemontee || !de) return;
  if (de.vue === vers.vue && (de.vue === 'reglages' || de.module === vers.module)) return;
  if (typeEcran(de) === 'libre' && (parMenu || memeModule(de, vers))) return;
  A.pile.push({ vue: de.vue, module: de.module, menu: parMenu });
}
function parentEcran() {
  var e = A.ecran, t = typeEcran(e);
  if (t === 'racine' || t === 'barre') return null;
  if (t === 'fixe') return { nom: e.vue === 'fichech' && A.fchDeFiche ? 'Fiche' : 'Chantiers' };
  var p = A.pile[A.pile.length - 1];
  if (!p) return { nom: 'Aujourd’hui' };
  return p.menu ? { menu: true, nom: 'Le reste de Sylve' } : { nom: titreEcran(p) };
}

/* Le bandeau, la barre et les pastilles suivent l'écran affiché. Appelé par
   aller() : aucun chemin vers un écran ne peut l'oublier. */
function majCadre() {
  var e = { vue: A.vue, module: A.module }, t = typeEcran(e);
  A.ecran = e;
  A.parMenu = false;
  document.body.classList.toggle('accueil-ouvert', e.vue === 'accueil');
  var titre = $('#b-ecran');
  if (titre) titre.textContent = titreEcran(e);
  var ctx = $('#b-ctx');
  if (ctx) ctx.hidden = e.vue === 'accueil' || e.vue === 'reglages';
  var ret = $('#b-retour'), p = parentEcran();
  if (ret) {
    ret.hidden = !p;
    if (p) {
      ret.innerHTML = picto('retour') + (p.menu ? picto('menu') : '<span>' + esc(p.nom) + '</span>');
      ret.setAttribute('aria-label', 'Revenir à « ' + p.nom + ' »');
      ret.title = 'Revenir à « ' + p.nom + ' »';
    }
  }
  /* Un écran libre garde l'onglet d'où l'on est parti : c'est là que le
     retour finira par ramener. */
  if (t === 'racine') A.onglet = 'aujourdhui';
  else if (t !== 'libre') A.onglet = ONGLET_DE_MODULE[e.module];
  $$('#barre [data-barre]').forEach(function (b) {
    if (b.dataset.barre === (A.onglet || 'aujourdhui')) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  synchroniserCrans();
}
function dessinerCadre() {
  var m = $('#b-menu');
  if (m) m.innerHTML = picto('menu');
  var b = $('#barre'); if (!b) return;
  var bouton = function (cle) {
    return '<button type="button" data-barre="' + cle + '">' + picto(BARRE[cle].picto) +
      '<span>' + BARRE[cle].nom + '</span></button>';
  };
  b.innerHTML = bouton('aujourdhui') + bouton('chantiers') +
    '<button type="button" class="barre-plus" data-barre="plus" aria-label="Ajouter" title="Ajouter">' +
    '<span class="rond">' + picto('plus') + '</span></button>' +
    bouton('agenda') + bouton('argent');
}
function allerOnglet(cle) {
  if (cle === 'plus') { ouvrirPlus(); return; }
  if (cle === 'aujourdhui') { allerAccueil(); return; }
  if (BARRE[cle]) allerModule(BARRE[cle].module);
}

/* Remonter d'un cran : la flèche du bandeau et le retour du téléphone font
   le même trajet. Fenêtre → écran parent → onglet de la barre → Aujourd'hui. */
function remonter() {
  var e = A.ecran, t = typeEcran(e);
  if (t === 'racine') return;
  if (t === 'barre') { allerAccueil(); return; }
  if (t === 'fixe') {
    if (e.vue === 'fichech' && A.fchDeFiche && chantier(A.chOuvert)) {
      A.fchDeFiche = false;
      ouvrirChantier(A.chOuvert);
    } else allerModule('chantiers', 'carnet');
    return;
  }
  var p = A.pile.pop();
  A.enRemontee = true;
  try {
    if (!p || p.vue === 'accueil') allerAccueil();
    else if (p.vue === 'reglages') { A.module = moduleValide(p.module); majOnglets(); aller('reglages'); }
    else allerModule(p.module, p.vue);
  } finally { A.enRemontee = false; }
  /* Entré par le ☰, on y revient : c'est là qu'on choisit l'écran suivant. */
  if (p && p.menu) ouvrirMenu();
}

/* ------------------------------------------------------- le ☰ et le + */
/* Les réglages s'ouvrent sur la zone de l'écran d'où l'on vient. */
function secReglagesDe(e) {
  if (!e || e.vue === 'accueil') return 'general';
  if (e.vue === 'reglages') return A.secReglages || 'general';
  var m = MODULES[e.module];
  return SEC_DE_MODULE[e.module] || (m && m.groupe === 'entreprise' ? 'ent' : 'general');
}
var MENU_ENTREPRISE = [['stock', 'stock2'], ['achats', 'achats'], ['vehicule', 'carnetv'],
  ['rendements', 'rendements']];
var MENU_OUTILS = [['cubage', 'cubage'], ['bois', 'stock']];
function ouvrirMenu() {
  var tuile = function (x) {
    var s = situationModule(x[0]);
    return '<button type="button" data-menu="' + x[0] + '"><span class="rond-ic">' + picto(x[1]) +
      '</span><b>' + esc(MODULES[x[0]].nom) + '</b>' +
      (s.n !== '—' ? '<span class="n">' + esc(s.n + ' ' + s.u) + '</span>' : '') +
      '<small>' + esc(s.s) + '</small></button>';
  };
  var ligne = function (cle, pic, nom) {
    return '<button type="button" data-menu="' + cle + '">' + picto(pic) + '<span>' + nom + '</span></button>';
  };
  modale('Le reste de Sylve',
    '<p class="fn-sous" style="margin-top:0">Entreprise</p>' +
    '<div class="fn-tuiles">' + MENU_ENTREPRISE.map(tuile).join('') + '</div>' +
    '<p class="fn-sous">Outils de terrain</p>' +
    '<div class="fn-tuiles">' + MENU_OUTILS.map(tuile).join('') + '</div>' +
    '<div class="fn-zone">' + ligne('reglages', 'reglages', 'Réglages') +
    ligne('sauvegarde', 'sauvegarde', 'Sauvegarde') + ligne('corbeille', 'corbeille', 'Corbeille') + '</div>');
  $('#modale').classList.add('feuille-nav');
  $('#modale-corps').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-menu]'); if (!b) return;
    var ou = b.dataset.menu, depuis = A.ecran;
    fermerModale();
    A.parMenu = true;
    if (ou === 'reglages') { allerReglages(secReglagesDe(depuis)); return; }
    /* Sauvegarde et Corbeille ont leur écran au lot (f) : en attendant, la
       carte Sauvegarde des réglages, corbeille ouverte pour la seconde. */
    if (ou === 'sauvegarde' || ou === 'corbeille') {
      allerReglages('sauvegarde');
      if (ou === 'corbeille' && $('#s-recup').hidden) $('#s-recuperer').click();
      return;
    }
    allerModule(ou);
  });
}
/* Chaque entrée ouvre le formulaire qui existait déjà, sans rien y changer. */
var PLUS_QUOTIDIEN = [
  ['journee', 'p1', 'horloge', 'Ma journée', 'le plus fréquent'],
  ['depense', 'p2', 'depenses', 'Dépense', 'carburant, achat'],
  /* Le carnet : le dessin de Chantiers dans la barre (une notion, un dessin). */
  ['chantier', 'p3', 'carnet', 'Chantier', 'on m’en a parlé'],
  ['note', 'p4', 'note', 'Note', 'pense-bête']
];
var PLUS_RARE = [
  ['commande', 'stock2', 'Commande de fournitures'],
  ['achat', 'achats', 'Achat à prévoir'],
  ['intervention', 'carnetv', 'Noter une intervention'],
  ['charge', 'charges', 'Charge fixe']
];
var OUVRIR_PLUS = {
  journee: function () { ouvrirJournee(null); },
  depense: function () { ouvrirDepense(null); },
  chantier: function () { ouvrirEnteteCh(null); },
  note: function () { ouvrirNote(null); },
  commande: function () { ouvrirCommande(null); },
  achat: function () { ouvrirAchat(null); },
  intervention: function () { ouvrirInterventionV(null); },
  charge: function () { ouvrirCharge(null); }
};
function ouvrirPlus() {
  modale('Ajouter',
    '<p class="fn-sous" style="margin-top:0">Quotidien</p><div class="fn-ajout">' +
    PLUS_QUOTIDIEN.map(function (x) {
      return '<button type="button" class="' + x[1] + '" data-plus="' + x[0] + '">' + picto(x[2]) +
        '<span>' + x[3] + '<small>' + x[4] + '</small></span></button>';
    }).join('') + '</div>' +
    '<p class="fn-sous">Plus rare</p><div class="fn-puces">' +
    PLUS_RARE.map(function (x) {
      return '<button type="button" data-plus="' + x[0] + '">' + picto(x[1]) + x[2] + '</button>';
    }).join('') + '</div>');
  $('#modale').classList.add('feuille-nav');
  $('#modale-corps').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-plus]'); if (!b) return;
    /* Fermée d'abord : un formulaire qui renonce (une commande sans produit
       renvoie aux réglages) ne laisse pas la feuille ouverte par-dessus. */
    fermerModale();
    OUVRIR_PLUS[b.dataset.plus]();
  });
}

/* Les modules retirés en 4.38 restent en mémoire sur les téléphones déjà
   installés : « devis » menait à l'estimation, désormais dans Rendements,
   et « analyses » est devenue un onglet de Finances. Sans cette
   redirection, l'application se rouvrait dans le cubage. */
var MODULES_RETIRES = { devis: 'rendements', analyses: 'finances' };
function moduleValide(m) {
  if (MODULES[m]) return m;
  if (MODULES_RETIRES[m]) return MODULES_RETIRES[m];
  return 'cubage';
}
/* Le bandeau ne garde que la navigation. Les actions qui existaient déjà
   dans la page (+ Pile, + Chantier, + Dépense, + Commande) en sont sorties :
   il passe par la page, jamais par le haut. Restent celles qui n'ont pas
   encore d'équivalent ailleurs. */
var ACTIONS_MODULE = {
  cubage: [['b-entete2', 'En-tête']],
  calendrier: [['b-aujourdhui', 'Aujourd’hui']]
};
function majBandeauModule() {
  if (!$('#b-ctx')) return;
  var act = ACTIONS_MODULE[A.module] || [];
  $('#b-ctx').innerHTML = act.map(function (x) {
    return '<button class="bandeau-btn" id="' + x[0] + '">' + esc(x[1]) + '</button>';
  }).join('');
}

function majOnglets() {
  var m = MODULES[A.module] || MODULES.cubage;
  Object.keys(MODULES).forEach(function (k) { document.body.classList.remove('m-' + k); });
  document.body.classList.remove('m-ent');
  document.body.classList.add('m-' + A.module);
  if (m.groupe === 'entreprise') document.body.classList.add('m-ent');
  majBandeauModule();
  /* Les anciens onglets du bas, devenus des pastilles en haut de l'écran :
     mêmes noms, même ordre, même dessin. */
  $('#onglets').innerHTML = m.vues.map(function (v) {
    return '<button role="tab" data-vue="' + v[0] + '" aria-selected="' + String(A.vue === v[0]) + '">' +
      '<span class="ic">' + picto(v[0]) + '</span>' + v[1] + '</button>';
  }).join('');
}
/* Quel module porte cette vue. Une liste tenue à la main vivait ici : elle ne
   connaissait aucune vue du cubage, si bien qu'une note de mise à jour pointant
   sur le bordereau ouvrait Chantiers avec la barre du bas de travers. MODULES
   sait déjà à qui appartient chaque vue — autant le lui demander, ça ne peut
   plus diverger. Une vue partagée revient au premier module qui la déclare :
   « fichiers » au cubage, « carnet » aux chantiers. */
function moduleDeVue(v) {
  return Object.keys(MODULES).filter(function (m) {
    return MODULES[m].vues.some(function (x) { return x[0] === v; });
  })[0] || 'chantiers';
}
/* Un cran d'historique pour le bouton retour du téléphone. */
function empilerCran() {
  try { history.pushState({ sylve: 1 }, ''); } catch (e) { }
}
/* Combien d'appuis sur « retour » séparent cet écran d'Aujourd'hui : un
   onglet de la barre est à un cran, la fiche à deux, un écran libre à un de
   plus que celui d'où l'on est venu. */
function profondeurDe(e) {
  var t = typeEcran(e);
  if (t === 'racine') return 0;
  if (t === 'fixe') return e.vue === 'fichech' && A.fchDeFiche ? 3 : 2;
  return 1;
}
function profondeur() {
  if (typeEcran(A.ecran) !== 'libre') return profondeurDe(A.ecran);
  var d = 1;
  for (var i = A.pile.length - 1; i >= 0; i--) {
    if (typeEcran(A.pile[i]) !== 'libre') return d + profondeurDe(A.pile[i]);
    d++;
  }
  return d;
}
/* On empile autant de crans que l'écran en demande, jamais plus : remonter
   par la barre ou la flèche ne les consomme pas, et les redescendre ensuite
   ne doit pas les doubler — sinon il faudrait plusieurs appuis pour sortir. */
function synchroniserCrans() {
  var p = profondeur();
  while ((A.crans || 0) < p) { empilerCran(); A.crans = (A.crans || 0) + 1; }
}

/* Le retour arrière du téléphone quittait Sylve d'un coup, même au fond d'un
   module. Il remonte d'un cran, comme n'importe quelle application : une
   fenêtre ouverte se ferme d'abord, sinon écran parent → onglet de la barre
   → Aujourd'hui. Depuis Aujourd'hui seulement, il sort.

   Chaque appui consomme un cran. Fermer une fenêtre laisse sur le même
   écran : la synchronisation le réempile, sinon on perdrait un étage. */
function brancherRetourTelephone() {
  window.addEventListener('popstate', function () {
    A.crans = Math.max(0, (A.crans || 0) - 1);
    if (!$('#modale').hidden) { fermerModale(); synchroniserCrans(); return; }
    if (typeEcran(A.ecran) === 'racine') return;
    remonter();
  });
}
function allerModule(m, vue) {
  if (!MODULES[m]) m = 'cubage';
  A.module = m;
  document.body.classList.remove('accueil-ouvert');
  majOnglets();
  renderFichiersModule();
  ecrire('bordcub.module', m);
  aller(vue || MODULES[m].defaut);
}
function allerAccueil() {
  document.body.classList.add('accueil-ouvert');
  renderAccueil();
  aller('accueil');
}
/* Le rafraîchissement commun après une saisie : l'écran Aujourd'hui, et les
   écrans d'à côté qui n'ont pas d'autre occasion de se refaire. */
function renderAccueil() {
  renderAujourdhui();
  renderAchats(); renderBudgetAchats(); renderFicheChantier();
}

/* ------------------------------------------------------------ position */
function releverPosition(bouton, apres) {
  if (!G.dispo()) { toast('Localisation indisponible sur cet appareil.'); return; }
  var txt = bouton ? bouton.textContent : null;
  if (bouton) { bouton.disabled = true; bouton.textContent = 'Recherche…'; }
  G.position(false).then(function (p) {
    if (bouton) { bouton.disabled = false; bouton.textContent = txt; }
    apres(p);
  }, function (e) {
    if (bouton) { bouton.disabled = false; bouton.textContent = txt; }
    toast(e.message === 'refus'
      ? 'Localisation refusée. Autorisez-la dans les réglages du téléphone.'
      : 'Position introuvable — réessayez à découvert.');
  });
}

/* Points relevés des piles de bois de chauffage (module bois uniquement). */
function tousLesPoints() {
  var pts = [];
  A.piles.forEach(function (p) {
    if (p.gps && p.gps.lat != null) {
      var e = H.etat(p, Date.now(), A.cfg);
      pts.push({
        gps: p.gps, type: 'pile', id: p.id, nom: p.nom || 'Pile', lieu: p.lieu || '',
        detail: E.fmt(H.restant(p), 2) + ' st · ' + e.texte
      });
    }
  });
  return pts;
}
function renderLieux() {
  var z = $('#liste-lieux'); if (!z) return;
  var pts = tousLesPoints();
  if (!pts.length) {
    z.innerHTML = '<div class="vide"><p>Aucune pile localisée. En créant une pile, ' +
      'appuyez sur « Enregistrer la position » : elle apparaîtra ici, classée par distance.</p></div>';
    if ($('#lieux-carte')) $('#lieux-carte').innerHTML = '';
    return;
  }
  var tri = G.parDistance(pts, A.ici, 'gps');
  z.innerHTML = tri.map(function (t) {
    var p = t.o;
    return '<div class="liste-item">' +
      '<span class="pastille" style="background:#8A5A2B"></span>' +
      '<div class="li-c"><b>▦ ' + esc(p.nom) +
      (p.lieu ? ' <i class="etiq" style="background:#5B3A1E">' + esc(p.lieu) + '</i>' : '') +
      '</b><small>' + esc(p.detail) +
      ' · ' + esc(G.fmtCoord(p.gps)) + ' ' + esc(G.fmtPrecision(p.gps)) + '</small></div>' +
      (t.d != null ? '<span class="pt-dist">' + esc(G.fmtDistance(t.d)) + ' ' +
        esc(G.cap(A.ici, p.gps)) + '</span>' : '') +
      '<a class="btn-min" href="' + esc(G.lienNav(p.gps, p.nom)) + '">Y aller</a></div>';
  }).join('');
  dessinerCarte(tri.map(function (t) { return t.o; }));
}

