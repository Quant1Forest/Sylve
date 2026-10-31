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
  champs(); brancher();
  window.BCS.pret.then(function () {
    return Promise.all([lire('bordcub.cfg', null), lire('bordcub.index', []),
      Store.get('bordcub.actif'), lire('bordcub.export', 0),
      lire('bordcub.piles', []), lire('bordcub.module', 'cubage'), lire('bordcub.chantiers', []),
      lire('bordcub.clients', []), lire('bordcub.depenses', []), lire('bordcub.proprios', []),
      lire('bordcub.articles', []), lire('bordcub.charges', []), lire('bordcub.fournisseurs', []),
      lire('bordcub.commandes', []), lire('bordcub.sorties', []),
      lire('bordcub.journees', []), lire('bordcub.lieux', []),
      lire('bordcub.versements', []), lire('bordcub.vehicule', null),
      lire('bordcub.achats', [])]);
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

/* Le bandeau porte le nom de la partie ouverte, et permet d'en changer
   sans repasser par l'accueil. L'action à droite dépend du module. */
var NOMS_GROUPE = { entreprise: 'Mon entreprise' };

/* Remonter d'un cran : le menu de la partie si le module en a une,
   l'accueil sinon. */
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
function allerMenuParent() {
  /* Depuis les réglages, on redescend d'abord là où on était. On ne le fait
     que si cette vue appartient encore au module ouvert : sinon on afficherait
     un écran dont l'onglet n'est plus dans la barre. */
  if (A.vue === 'reglages' && A.vueAvantReglages) {
    var precedente = A.vueAvantReglages;
    A.vueAvantReglages = null;
    /* L'accueil et le menu d'une partie ne sont les vues d'aucun module : la
       vérification ci-dessous les rejetait, et on ressortait des réglages
       dans « Mon entreprise » alors qu'on y était entré depuis l'accueil. */
    if (precedente === 'accueil') { allerAccueil(); return; }
    if (NOMS_GROUPE[precedente]) {
      document.body.classList.add('accueil-ouvert');
      aller(precedente);
      return;
    }
    var m = MODULES[A.module];
    if (m && m.vues.some(function (v) { return v[0] === precedente; })) {
      aller(precedente);
      return;
    }
  }
  var g = (MODULES[A.module] || {}).groupe;
  if (!g) { allerAccueil(); return; }
  document.body.classList.add('accueil-ouvert');
  aller(g);
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
  var sel = $('#b-module'); if (!sel) return;
  var ent = [], out = [];
  Object.keys(MODULES).forEach(function (k) {
    (MODULES[k].groupe === 'entreprise' ? ent : out).push(
      '<option value="' + k + '"' + (A.module === k ? ' selected' : '') + '>' + esc(MODULES[k].nom) + '</option>');
  });
  sel.innerHTML =
    (ent.length ? '<optgroup label="Entreprise">' + ent.join('') + '</optgroup>' : '') +
    (out.length ? '<optgroup label="Outils de terrain">' + out.join('') + '</optgroup>' : '');
  /* Le retour ne remonte que d'un cran : depuis un module d'une partie
     (Entreprise), il ramène au menu de cette partie. Ailleurs, l'accueil
     suffit déjà : le bouton reste caché plutôt que de doubler ◈. */
  var ret = $('#b-retour');
  if (ret) {
    /* Elle n'existait que dans les modules d'une partie : ailleurs, le bouton
       d'accueil faisait déjà le même trajet. Il la veut partout — deux façons
       de remonter valent mieux qu'une hésitation devant le bandeau. */
    var g = (MODULES[A.module] || {}).groupe;
    ret.hidden = false;
    ret.title = g ? 'Revenir à « ' + (NOMS_GROUPE[g] || g) + ' »' : 'Revenir à l’accueil';
  }
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
  $('#onglets').innerHTML = m.vues.map(function (v) {
    return '<button role="tab" data-vue="' + v[0] + '" aria-selected="false">' +
      '<span class="ic"><svg viewBox="0 0 24 24" class="pic" aria-hidden="true">' +
      (PICTOS[v[0]] || '') + '</svg></span>' + v[1] + '</button>';
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
/* Un cran d'historique pour le bouton retour du téléphone. Voir
   brancherRetourTelephone() : on n'en empile qu'en descendant. */
function empilerCran() {
  try { history.pushState({ sylve: 1 }, ''); } catch (e) { }
}

/* Le retour arrière du téléphone quittait Sylve d'un coup, même au fond d'un
   module. Il remonte maintenant d'un cran, comme n'importe quelle application :
   une fenêtre ouverte se ferme d'abord, sinon vue → module → partie → accueil.
   Depuis l'accueil seulement, il sort.

   Un cran est empilé à chaque descente et consommé par la remontée : c'est ce
   qui donne un appui par étage, et non deux. Fermer une fenêtre en réempile un,
   sinon on perdrait un étage au passage. Et on n'en réempile jamais après une
   remontée, sans quoi le dernier appui ne sortirait pas de l'application. */
function brancherRetourTelephone() {
  window.addEventListener('popstate', function () {
    if (!$('#modale').hidden) { fermerModale(); empilerCran(); return; }
    if (A.vue === 'accueil') return;
    /* Depuis le menu d'une partie, le cran au-dessus est l'accueil.
       allerMenuParent() ne sait pas le faire : il lit le module courant, qui
       appartient encore à cette partie, et y reviendrait en boucle. */
    if (NOMS_GROUPE[A.vue]) { allerAccueil(); return; }
    allerMenuParent();
  });
}
function allerModule(m, vue) {
  if (!MODULES[m]) m = 'cubage';
  /* Descendre depuis l'accueil ou depuis le menu d'une partie empile un cran ;
     changer de module par le bandeau est un déplacement latéral, pas une
     descente, et n'en empile pas — sinon les crans s'accumuleraient et il
     faudrait plusieurs appuis pour sortir. */
  if (A.vue === 'accueil' || NOMS_GROUPE[A.vue]) empilerCran();
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
function renderAccueil() {
  var vol = A.index.reduce(function (s, x) { return s + (Number(x.vol) || 0); }, 0);
  $('#a-cub-n').textContent = A.index.length ? E.fmt(vol, 2) : '—';
  $('#a-cub-s').textContent = A.index.length
    ? A.index.length + (A.index.length > 1 ? ' bordereaux' : ' bordereau')
    : 'Aucun bordereau';
  var r = H.repartition(A.piles);
  $('#a-bois-n').textContent = A.piles.length ? E.fmt(r.total, 2) : '—';
  $('#a-bois-s').textContent = A.piles.length
    ? A.piles.length + (A.piles.length > 1 ? ' piles' : ' pile')
    : 'Aucune pile enregistrée';
  renderNudgeSauvegarde(); renderNudgeEcheances(); renderNudgeDevis(); renderNudgeJournees(); renderMaJournee();
  renderAchats(); renderBudgetAchats(); renderFicheChantier();
  renderEntreprise();
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

