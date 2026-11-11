#!/usr/bin/env node
/* =====================================================================
   Sylve — tests de non-régression
   node outils/tests.js
   Chaque scénario ouvre l'application dans un navigateur simulé, agit
   comme le ferait un doigt, et vérifie le résultat. Un test rouge veut
   dire qu'un comportement qui marchait ne marche plus.
   Dépendance : npm install jsdom

   node outils/tests.js [fichier] [filtre] [options]
     --sequentiel     tous les scénarios dans ce processus, l'un après
                      l'autre (pour déboguer)
     --processus=N    N processus en parallèle (par défaut : cœurs − 1 ;
                      aussi réglable par SYLVE_PROCESSUS)
     --durees         affiche où le temps passe : scénarios les plus longs,
                      part des pauses, part des ouvertures de JSDOM
     --motif=RE       ne joue que les scénarios dont le nom répond à
                      l'expression RE (sans casse) ; le contrôle s'en sert
                      pour les passes à date figée (SYLVE_DATE)
   ===================================================================== */
'use strict';
/* Fuseau avec changement d'heure, posé avant toute date : la suite ne dépend
   plus du poste (UTC n'a jamais de changement d'heure et cachait un décalage
   d'un jour dans la fenêtre des journées à trancher). */
process.env.TZ = 'Europe/Paris';
/* SYLVE_DATE=AAAA-MM-JJ : toute la suite se croit ce jour-là, à 10 h, et
   l'application aussi. Le contrôle s'en sert pour rejouer la suite le 1er et
   le dernier jour d'un mois : un scénario qui posait « il y a deux jours »
   dans un Agenda qui n'affiche que le mois en cours passait vingt-huit jours
   sur trente, et mentait le 1er et le 2 (10 vérifications rouges au 5b3). */
const DATE_FIGEE = process.env.SYLVE_DATE || '';
const decalerDate = (D, ms) => class extends D {
  constructor(...a) { if (a.length) super(...a); else super(D.now() + ms); }
  static now() { return D.now() + ms; }
};
let DECALAGE = 0;
if (DATE_FIGEE) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(DATE_FIGEE);
  if (!m) { console.log('✕ SYLVE_DATE attend AAAA-MM-JJ, pas « ' + DATE_FIGEE + ' ».'); process.exit(1); }
  DECALAGE = new Date(+m[1], +m[2] - 1, +m[3], 10, 0, 0).getTime() - Date.now();
  global.Date = decalerDate(Date, DECALAGE);
}
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const { fork } = require('child_process');
const { JSDOM } = require('jsdom');
const VOCABULAIRE = require('./vocabulaire.js');

/* Les options se reconnaissent à leur « -- » : le fichier et le filtre restent
   les deux premiers arguments sans tiret, comme avant. */
const ARGS = process.argv.slice(2);
const DRAPEAUX = ARGS.filter(a => a.indexOf('--') === 0);
const POSITIONNELS = ARGS.filter(a => a.indexOf('--') !== 0);
const APP = POSITIONNELS[0] || path.join(__dirname, '..', 'index.html');
const FILTRE = POSITIONNELS[1] || '';
const html = fs.readFileSync(APP, 'utf8');

let ok = 0, ko = 0;
const scenarios = [];
const scenario = (nom, fn) => scenarios.push({ nom, fn });

/* Où passe le temps d'un scénario : remis à zéro avant chacun. Les scénarios
   d'un même processus se jouent l'un après l'autre, donc un seul compteur. */
let mesure = { pause: 0, pauses: 0, jsdom: 0, pret: 0, ouvertures: 0 };function verifier(quoi, attendu, obtenu) {
  const juste = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (juste) { ok++; console.log('    ✓ ' + quoi); }
  else { ko++; console.log(`    ✕ ${quoi}\n        attendu : ${JSON.stringify(attendu)}\n        obtenu  : ${JSON.stringify(obtenu)}`); }
}
function verifierVrai(quoi, valeur) { verifier(quoi, true, !!valeur); }

/* Un champ date parle en heure locale. toISOString() répond en heure de
   Greenwich et renvoie la veille dès qu'on est à l'est : minuit à Paris y est
   22 h la veille. Un test qui s'en sert vise le mauvais jour et passe au vert
   en Angleterre pendant qu'il ment en France. */
const jourISO = ts => {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
};

/* Ouvre l'application avec des données de départ et rend la main quand elle
   a fini de démarrer — pas au bout d'une durée devinée. L'application pose
   « data-pret » quand ses données sont relues et ses écrans rendus ; on
   sonde jusque-là. L'attente fixe de 2,4 s dormait une seconde et demie à
   chaque fois, quarante fois par passage. */
/* Une graine qui invente un champ ne prouve rien : c'est ainsi que quatre
   défauts sont passés au vert, le scénario semant les mêmes champs faux que
   le code lisait. On refuse donc tout nom hors du vocabulaire, et on dit
   lequel — c'est le moment d'aller relire le formulaire qui enregistre. */
function verifierGraines(graines) {
  const fautes = [];
  for (const magasin in graines) {
    const connus = VOCABULAIRE[magasin];
    if (!connus || !Array.isArray(graines[magasin])) continue;
    for (const objet of graines[magasin]) {
      if (!objet || typeof objet !== 'object') continue;
      for (const champ of Object.keys(objet)) {
        if (connus.indexOf(champ) < 0) fautes.push(magasin + '.' + champ);
      }
    }
  }
  return [...new Set(fautes)];
}

function ouvrir(graines, options) {
  options = options || {};
  const inconnus = verifierGraines(graines);
  if (inconnus.length) {
    verifier('la graine n’invente aucun champ', [], inconnus);
  }
  return new Promise(resolve => {
    const avantJsdom = performance.now();
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local/',
      beforeParse(w) {
        for (const k in graines) w.localStorage.setItem('bordcub.' + k, JSON.stringify(graines[k]));
        w.URL.createObjectURL = () => 'blob:test';
        w.URL.revokeObjectURL = () => {};
        /* JSDOM ne défile pas : on note ce qui a été amené en vue (lot d1),
           par son identifiant ou son groupe de Chantiers. */
        w.__defile = [];
        w.Element.prototype.scrollIntoView = function () {
          w.__defile.push(this.id || (this.dataset && this.dataset.groupe) || '?');
        };
        if (DECALAGE) w.Date = decalerDate(w.Date, DECALAGE);
        /* Un crochet pour poser ce que JSDOM n'a pas — un écran, un capteur —
           AVANT que l'application démarre : elle ne branche que ce qui existe
           déjà au lancement. */
        if (options.avant) options.avant(w);
      }
    });
    const apresJsdom = performance.now();
    mesure.jsdom += apresJsdom - avantJsdom;
    mesure.ouvertures++;    const erreurs = [];
    dom.window.addEventListener('error', e => erreurs.push(e.message));
    dom.window.console.error = (...a) => erreurs.push(a.join(' '));
    const plafond = options.attente || 8000;
    const depart = Date.now();
    const rendreLaMain = () => {
      mesure.pret += performance.now() - apresJsdom;
      const w = dom.window, d = w.document;
      resolve({
        w, d, erreurs,
        $: s => d.querySelector(s),
        $$: s => [...d.querySelectorAll(s)],
        texte: s => { const e = d.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; },
        clic: s => { const e = d.querySelector(s); if (e) e.click(); return !!e; },
        saisir: (s, v) => { const e = d.querySelector(s); if (!e) return false; e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); return true; },
        choisir: (s, v) => { const e = d.querySelector(s); if (!e) return false; e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); return true; },
        stock: k => JSON.parse(w.localStorage.getItem('bordcub.' + k) || 'null'),
        pause: ms => {
          const debut = performance.now();
          mesure.pauses++;
          return new Promise(r => setTimeout(() => { mesure.pause += performance.now() - debut; r(); }, ms || 350));
        },
        fichier: (selecteur, nom, contenu) => {
          w.FileReader = function () { this.readAsText = () => { this.result = contenu; this.onload && this.onload(); }; };
          const i = d.querySelector(selecteur); if (!i) return false;
          Object.defineProperty(i, 'files', { value: [{ name: nom }], configurable: true });
          i.dispatchEvent(new w.Event('change', { bubbles: true }));
          return true;
        }
      });
    };
    /* Au-delà du plafond on rend quand même la main : un démarrage qui
       n'aboutit pas doit se voir sur les vérifications du scénario, pas
       bloquer toute la suite. */
    const sonder = () => {
      const pret = dom.window.document.body &&
        dom.window.document.body.getAttribute('data-pret') === '1';
      if (pret || Date.now() - depart > plafond) rendreLaMain();
      else setTimeout(sonder, 20);
    };
    sonder();
  });
}

const VIDE = { index: [], piles: [], chantiers: [], articles: [], commandes: [], sorties: [], journees: [] };

/* Le cadre du lot 5a : la barre du bas et le ☰ du bandeau sont les seuls
   chemins entre les écrans. Les scénarios qui passaient par le sélecteur de
   partie, le logo-bouton ou le bouton Réglages passent par eux. */
async function parBarre(t, cle) {
  const ok = t.clic('#barre [data-barre="' + cle + '"]');
  await t.pause(300);
  return ok;
}
async function parMenu(t, cle) {
  t.clic('#b-menu'); await t.pause(150);
  const ok = t.clic('#modale [data-menu="' + cle + '"]');
  await t.pause(350);
  return ok;
}
const vueActive = t => (t.$('main > .vue.actif') || {}).id || null;
/* Le dernier élément amené en vue par l'application (scrollIntoView). */
const defile = t => (t.w.__defile || []).slice(-1)[0] || null;
const ongletMarque = t => t.$$('#barre [aria-current="page"]').map(b => b.dataset.barre);
/* L'écran Aujourd'hui (lot 5b) : une ligne d'En retard, de Bientôt ou des
   prélèvements se retrouve par sa clé (« impaye:c1 », « sauvegarde »…), la
   même qui sert à la masquer jusqu'au lendemain. */
/* Le Bilan colle un montant à son libellé (« 1 800 €en attente ») : on
   compare sans les blancs. */
const sansBlancs = s => String(s).replace(/\s+/g, '');
const ligneAuj = (t, cle) => t.$('#vue-accueil [data-ajcle="' + cle + '"]');
const lignesAuj = (t, debut) => t.$$('#vue-accueil [data-ajcle^="' + debut + '"]');
const texteLignes = (t, debut) => lignesAuj(t, debut)
  .map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
async function appuyerLigne(t, cle) {
  const l = ligneAuj(t, cle), b = l && l.querySelector('[data-ajouvre]');
  if (b) b.click();
  await t.pause(400);
  return !!b;
}
async function plusNote(t) {
  t.clic('#barre [data-barre="plus"]'); await t.pause(200);
  t.clic('#modale [data-plus="note"]'); await t.pause(300);
}

/* --------------------------------------------------------------------- */
scenario('L\'application démarre sans erreur', async () => {
  const t = await ouvrir(VIDE);
  verifier('aucune erreur au démarrage', [], t.erreurs);
  verifierVrai('le module de calcul du stock est chargé', t.w.BCS2);
  verifierVrai('l\'accueil est présent', t.$('#vue-accueil'));
});

/* --------------------------------------------------------------------- */
scenario('Le bouton Sortie d\'une pile ouvre bien la sortie de bois', async () => {
  /* Régression : deux fonctions ouvrirSortie portaient le même nom, celle
     du stock écrasait celle du bois et renvoyait vers les réglages. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'bois',
    piles: [{ id: 'p1', nom: 'Tas du haut', lieu: 'Forêt de Valbrune', essences: ['CHE'],
      buche: 50, cotes: [{ lon: 4, hauteurs: [1.8] }], maj: Date.now(), mouvements: [] }]
  }));
  t.clic('[data-vue="bois"]');
  await t.pause(200);
  verifierVrai('le bouton Sortie existe', t.$('[data-sortie]'));
  t.clic('[data-sortie]');
  await t.pause(250);
  verifier('la fenêtre est celle de la pile', 'Sortie — Tas du haut', t.texte('#modale-titre'));
  verifierVrai('elle demande des stères', t.$('#x-st'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Import CSV : le stock retombe sur les chiffres du tableur', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'stock' }));
  const lire = f => fs.readFileSync(path.join(__dirname, 'exemples', f), 'utf8');
  for (const f of ['produits.csv', 'commandes.csv', 'sorties.csv']) {
    t.clic('#art-importer'); await t.pause(200);
    t.fichier('#is-fichier', f, lire(f)); await t.pause(350);
    t.clic('#is-ok'); await t.pause(450);
  }
  const lignes = t.$$('#stock-table tbody tr').map(r => [...r.children].map(c => c.textContent.trim()));
  const par = n => lignes.find(l => l[0].indexOf(n) === 0);
  /* Les exemples sont inventés depuis la 4.83 — les anciens portaient les
     quantités et les prix de son vrai stock. Les valeurs attendues ont été
     recalculées à part, par la règle écrite dans index.html, après avoir
     vérifié que ce calcul retrouvait exactement celles des anciens fichiers. */
  verifier('gaine 14×120 : coût unitaire réel', '0,8905', par('Gaine de protection 14*120')[5]);
  verifier('tuteur châtaignier : coût unitaire réel', '0,7325', par('Tuteur en châtaignier')[5]);
  verifier('tuteur acacia : stock futur', '500', par('Tuteur en Acacia')[4]);
  /* Les milliers sont séparés par une espace insécable (U+00A0) depuis la
     4.37 : « 3 703,00 » se lit, « 3703,00 » se déchiffre. */
  verifier('valeur totale du stock', '3 703,00', lignes[lignes.length - 1].slice(-1)[0]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : rendement par prestation et temps porté au chantier', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise', cfg: { prixJourVise: 300, heuresJour: 8 },
    chantiers: [{ id: 'c1', nom: 'Plantation Vaux', statut: 'accepte', prixJour: 320,
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1200, prix: 1.1 }],
      temps: [], maj: Date.now() }]
  }));
  t.clic('#aj-jour'); await t.pause(300);
  t.choisir('#mj-ch', 'c1');
  t.choisir('[data-pstt="0"]', 'PLANT');
  t.saisir('[data-pstq="0"]', '200');
  t.clic('#pst-plus'); await t.pause(120);
  t.choisir('[data-pstt="1"]', 'PROTEC');
  /* Lot r2 : les heures par prestation se tapent une fois la répartition
     demandée. */
  t.clic('#pst-rep'); await t.pause(120);
  t.saisir('[data-psth="0"]', '3'); t.saisir('[data-pstq="0"]', '200');
  t.saisir('[data-psth="1"]', '4'); t.saisir('[data-pstq="1"]', '150');
  t.saisir('#mj-trajet', '1'); t.saisir('#mj-km', '64');
  const ap = t.texte('#mj-apercu');
  /* Lot r2 : le trajet n'entre plus dans la journée, il se dit à côté. */
  verifierVrai('la journée fait 7 heures, le trajet à côté', /^7 h/.test(ap) && /\+ 1 h de trajet/.test(ap));
  /* Lot c2 : le rendement est sous chaque prestation, plus dans le pied. */
  verifierVrai('533 plants par jour, sous la plantation', /533 plant\/jour/.test(t.texte('#pst-r-0')));
  verifierVrai('300 protections par jour, sous la protection', /300 u\/jour/.test(t.texte('#pst-r-1')));
  verifierVrai('le prix de journée du chantier prime', /320 €\/j/.test(ap));
  t.clic('#mj-ok'); await t.pause(450);
  const j = t.stock('journees');
  verifier('une journée enregistrée', 1, j.length);
  verifier('deux prestations', 2, j[0].postes.length);
  verifier('le trajet reste à part', 1, j[0].trajet);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Corbeille : supprimer, retrouver, effacer pour de bon', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Éclaircie Chapelle', statut: 'encours', lignes: [], temps: [], maj: Date.now() }]
  }));
  t.w.confirm = () => true;
  t.clic('[data-chouvrir="c1"]'); await t.pause(250);
  t.clic('#f-sup'); await t.pause(400);
  verifier('le chantier a quitté la liste', 0, t.stock('chantiers').length);
  t.clic('[data-regl="general"]');
  t.clic('#s-recuperer'); await t.pause(450);
  verifierVrai('il est dans la corbeille', t.$('[data-repecher]'));
  t.clic('[data-repecher]'); await t.pause(500);
  verifier('il est revenu', 1, t.stock('chantiers').length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : quatre onglets et des zones qui défilent', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'stock' }));
  verifier('quatre onglets', ['Général', 'Entreprise', 'Cubage', 'Bois de chauffage'],
    t.$$('#regl-nav .chip').map(b => b.textContent));
  t.clic('[data-regl="ent"]'); await t.pause(120);
  const zones = t.$$('#regl-corps .reg-titre').filter(e => !e.hidden).map(e => e.textContent);
  /* Le fourre-tout « Général » a été éclaté : la journée de travail, le
     véhicule et les relances ont chacun leur zone et leur titre. */
  verifier('les zones de l\'entreprise, dans l\'ordre',
    ['Ma journée de travail', 'Véhicule', 'Relances et calendrier',
      'Listes déroulantes', 'Stock et fournitures', 'Financier', 'Import de données'], zones);
  verifier('aucun second niveau d\'onglets', 0, t.$$('#regl-sous').length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Prestations : renommer partout, ne pas retirer ce qui sert', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte',
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1200, prix: 1.1 }], temps: [], maj: Date.now() }]
  }));
  t.clic('[data-regl="ent"]');
  t.clic('#rl-nav [data-liste="travaux"]'); await t.pause(150);
  /* La liste s'arrête à huit : il faut la déplier pour atteindre la
     prestation cherchée, comme à l'écran. */
  if (t.$('#rl-plus')) { t.clic('#rl-plus'); await t.pause(200); }
  t.clic('[data-lmodif="PLANT"]'); await t.pause(200);
  verifier('pas de retrait possible : la prestation sert', null, t.$('#tr-sup'));
  const demandes = [];
  t.w.confirm = m => { demandes.push(m); return true; };
  t.saisir('#tr-nom', 'Plantation');
  t.clic('#tr-ok'); await t.pause(400);
  verifier('double confirmation', 2, demandes.length);
  t.clic('[data-vue="carnet"]'); await t.pause(150);
  t.clic('[data-chouvrir="c1"]'); await t.pause(250);
  verifierVrai('le nouveau nom est sur la fiche', /Plantation1200 plant/.test(t.texte('#fiche-chantier').replace(/\s/g, '')) ||
    t.texte('#fiche-chantier').indexOf('Plantation') >= 0);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Sauvegarde : le rappel compte toutes les données', async () => {
  /* Régression : le rappel ne se déclenchait que s'il existait des
     bordereaux de cubage — une année de chantiers ne l'allumait pas. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise', export: Date.now() - 45 * 86400000,
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [], maj: Date.now() }]
  }));
  /* Lot 5b : le rappel est la dernière ligne d'En retard d'Aujourd'hui (B1). */
  verifierVrai('le rappel est sur Aujourd’hui', ligneAuj(t, 'sauvegarde'));
  verifierVrai('il dit ce qu\'il y a à sauvegarder', /chantier/.test(texteLignes(t, 'sauvegarde')));
  await appuyerLigne(t, 'sauvegarde');
  verifierVrai('il ouvre les Réglages', t.$('#vue-reglages.actif'));
  verifierVrai('sur la carte Sauvegarde', t.$('#c-sauvegarde') && !t.$('#c-sauvegarde').hidden);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Bandeau : la flèche ne paraît qu’au second niveau, et nomme où elle ramène', async () => {
  /* Jusqu'en 4.85, la flèche remontait au menu de la partie (« Mon
     entreprise ») ou à l'accueil. Depuis le lot 5a, la barre du bas porte les
     écrans du premier niveau : la flèche ne paraît que sur un écran de second
     niveau, et dit où elle ramène — la fiche aux Chantiers, un outil à l'écran
     d'où on l'a ouvert, le ☰ quand on y est entré par lui. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [], maj: Date.now() }],
    articles: [{ id: 'a1', nom: 'Gaine', type: 'protection', unite: 'unite', mouvements: [], maj: Date.now() }] }));
  const ret = () => t.$('#b-retour');
  verifierVrai('le bouton retour existe', ret());
  verifierVrai('pas de flèche sur Aujourd’hui', ret().hidden);
  await parBarre(t, 'chantiers');
  verifierVrai('ni sur un onglet de la barre', ret().hidden);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  verifier('sur la fiche, elle paraît', false, ret().hidden);
  verifierVrai('et nomme les Chantiers', /Chantiers/.test(ret().textContent));
  t.clic('#b-retour'); await t.pause(250);
  verifier('elle ramène au carnet', 'vue-carnet', vueActive(t));
  /* Elle était masquée hors d'une partie ; il l'a demandée partout le 23
     août : « comme ça j'ai les deux possibilités ». Un écran ouvert depuis une
     ligne d'Aujourd'hui y remonte — la tuile Cubage de l'accueil, qui servait
     d'exemple, est partie au lot 5b ; « À recommander » mène au Stock. */
  await parBarre(t, 'aujourdhui');
  verifierVrai('la ligne À recommander est là', await appuyerLigne(t, 'stock'));
  verifier('elle ouvre le stock', 'vue-stock2', vueActive(t));
  verifier('elle est là dans le stock', false, ret().hidden);
  verifierVrai('et elle y vise Aujourd’hui', /Aujourd’hui/.test(ret().textContent));
  t.clic('#b-retour'); await t.pause(250);
  verifier('où elle ramène bien', 'vue-accueil', vueActive(t));
  /* Ouvert par le ☰, un outil y ramène : la flèche montre le ☰. */
  await parBarre(t, 'agenda');
  await parMenu(t, 'bois');
  verifier('dans le bois ouvert par le ☰, elle paraît', false, ret().hidden);
  verifierVrai('elle montre le ☰ et le dit',
    ret().querySelectorAll('svg').length === 2 && /Le reste de Sylve/.test(ret().getAttribute('aria-label')));
  t.clic('#b-retour'); await t.pause(300);
  verifier('elle ramène sur l’écran d’où l’on était parti', 'vue-calendrier', vueActive(t));
  verifier('le ☰ rouvert par-dessus', 'Le reste de Sylve',
    !t.$('#modale').hidden && t.texte('#modale-titre'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Chantier : plus d\'échéance, et plus de fenêtre « Les journées » (R6, lot b1)', async () => {
  /* Il ne raisonne pas en « à finir avant le » mais en journées à poser. Les
     dates se tapaient dans la fenêtre « Les journées » de la fiche ; elles se
     posent dans l'Agenda (R6). Au lot b1 la fenêtre part : le nombre estimé
     vit dans l'étape Devis, le placement dans l'étape Travaux. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Valbrune', statut: 'accepte', lignes: [], temps: [],
        jours: [{ d: JCAL(10), p: 1 }], joursEstimes: 2, maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(200);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  verifier('le champ « à finir avant le » a disparu', null, t.$('#ce-ech'));
  verifier('plus de fenêtre « Les journées »', null, t.$('#f-jours'));
  verifierVrai('le temps estimé est dans l’étape Devis', t.$('#f-etapes [data-etape="1"] #f-estim'));
  t.clic('#f-estim'); await t.pause(350);
  verifier('plus de date à taper', 0, t.$$('#modale input[type="date"]').length);
  verifier('le nombre estimé reste', '2', t.$('#es-jest').value);
  t.saisir('#es-jest', '3');
  t.clic('#es-ok'); await t.pause(450);
  verifier('l’estimation est enregistrée', 3, (t.stock('chantiers') || [])[0].joursEstimes);
  verifierVrai('le placé se lit sur l’étape Travaux',
    /à programmer · 1 j placé/.test(t.texte('#f-etapes [data-etape="2"] summary')));
  verifierVrai('le placement est dans l’étape Travaux', t.$('#f-etapes [data-etape="2"] #f-planifier'));
  t.clic('#f-planifier'); await t.pause(500);
  verifier('« Placer des jours dans l’Agenda » ouvre l’Agenda', 'vue-calendrier', vueActive(t));
  verifierVrai('en placement de ce chantier', /Placement — Valbrune/.test(t.texte('#cal-planif')));
  verifierVrai('et le bandeau compte l’estimation', /1 \/ 3 journées placées/.test(t.texte('#cal-planif')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Listes : ajouter sans quitter le formulaire', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(200);
  /* Le « + liste » vit sur le formulaire de création, qui ne garde plus que
     donneur, propriétaire, lieu et travaux. */
  await plusChantier(t);
  t.saisir('#ce-donneur', 'Jean Roman');
  t.clic('[data-ajlist="clients"]'); await t.pause(400);
  verifier('le donneur d\'ordre est dans la liste', ['Jean Roman'], t.stock('clients'));
  t.clic('#modale-x'); await t.pause(250);
  await parBarre(t, 'chantiers');

  /* L'essence, elle, a rejoint le bloc « Le peuplement » de la fiche. */
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-peuplement'); await t.pause(350);
  const ess = t.$('#ce-ess');
  verifierVrai('la liste des essences propose d\'en ajouter une',
    [...ess.options].some(o => o.value === '__ajouter'));
  t.w.prompt = () => 'Cèdre';
  t.choisir('#ce-ess', '__ajouter'); await t.pause(400);
  verifier('l\'essence ajoutée est retenue', 'Cèdre', t.$('#ce-ess').value);
  verifier('elle est rangée dans les réglages', ['Cèdre'], (t.stock('cfg') || {}).essencesCh);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : changer de chantier sans repasser par le carnet', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [], maj: Date.now() },
      { id: 'c2', nom: 'Valbrune', statut: 'paye', lignes: [], temps: [], maj: Date.now() - 1000 }
    ]
  }));
  t.clic('[data-chouvrir="c1"]'); await t.pause(250);
  verifierVrai('le sélecteur est en haut de la fiche', t.$('#f-choix'));
  verifierVrai('les chantiers clos sont à part',
    [...t.$('#f-choix').querySelectorAll('optgroup')].map(g => g.label).join('|') === 'En cours|Clos');
  t.choisir('#f-choix', 'c2'); await t.pause(300);
  verifierVrai('la fiche a suivi', /Valbrune/.test(t.texte('#fiche-chantier')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : un seul bloc pour le temps, prévu et fait côte à côte', async () => {
  /* « Est-ce qu'il n'y a pas moyen de regrouper ces deux blocs ? Parce que si
     déjà je sais quelle journée… » Depuis que tout se compte en heures, le
     prévu et le fait ont la même forme : une date, deux colonnes. */
  const JOUR = 86400000;
  const hier = new Date(Date.now() - JOUR); hier.setHours(12, 0, 0, 0);
  const demain = new Date(Date.now() + JOUR); demain.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8 },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', maj: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'jour', quantite: 3, prix: 800, nature: 'prestation' }],
      jours: [{ d: hier.getTime(), p: 1 }, { d: demain.getTime(), p: 1 }],
      temps: [
        { date: hier.getTime(), duree: 7, unite: 'h', personnes: 1 },
        /* Un rattrapage sans date : il compte, mais il ne tombe sur aucune
           case du calendrier. */
        { date: null, duree: 4, unite: 'h', personnes: 1 }
      ] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);

  /* Un seul bloc : « Le temps passé » n'existe plus à part. */
  const titres = t.$$('#f-etapes summary b').map(e => e.textContent);
  verifierVrai('les journées sont dans l’étape Travaux', t.$('#f-etapes [data-etape="2"] .jtete'));
  verifierVrai('et « Temps passé » n’est plus un bloc à part',
    titres.indexOf('Temps passé') < 0);

  /* Le fait est à gauche : « j'aurais plutôt mis les journées faites à
     gauche, ce qui sont prévus au milieu ». */
  const tete = t.$$('#vue-chantier .jtete span').map(e => e.textContent);
  verifier('les colonnes sont dans son ordre', ['Date', 'Fait', 'Prévu'], tete);

  const rangs = t.$$('#vue-chantier .jrang')
    .map(e => e.textContent.replace(/\s+/g, ' ').trim());
  /* Huit heures posées se lisent « 1 j » : c'est une journée entière. */
  verifierVrai('le jour passé montre ce qui est fait et ce qui était prévu',
    rangs.some(r => /7 h/.test(r) && /1 j/.test(r)));
  verifierVrai('le jour à venir n’a rien de fait',
    rangs.some(r => /à venir/.test(r) && /—/.test(r)));
  verifierVrai('le rattrapage sans date figure aussi',
    rangs.some(r => /sans date/.test(r) && /4 h/.test(r)));

  /* 7 h + 4 h = 11 h, soit 1 j 3 h avec des journées de huit heures. */
  const f = t.texte('#vue-chantier');
  verifierVrai('le total fait se lit en jours et en heures', /1 j 3 h/.test(f));
  /* Et jamais en virgule : « on ne peut pas juste mettre trois virgule deux
     si j'ai fait trois jours et deux heures ». */
  verifierVrai('jamais en journées à virgule', !/1,4 j|1,38 j/.test(f));

  /* Seul le jour à venir reste à faire. Compter aussi celui d'hier, c'est
     compter deux fois la même journée : « les journées faites ne sont plus
     comptabilisées comme des journées prévues ». */
  verifierVrai('une journée passée sort du reste à faire', /1 jreste à faire/.test(f));
  verifierVrai('l’estimation du devis est rappelée', /3 jestimé au devis/.test(f));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Temps : tout se note en heures, plus de quarts de journée', async () => {
  /* « Soit tu mets tout en heures, soit tu ne mets pas tout en heures. Là
     c'est compliqué : tu mets une heure, trois heures, et entre deux un quart
     de journée, une demi-journée, et du coup je me perds. » */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8 },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', maj: Date.now(),
      lignes: [], temps: [], jours: [{ d: Date.now(), p: 1 }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);

  t.clic('#f-temps'); await t.pause(400);
  verifier('le sélecteur journées/heures a disparu', null, t.$('#ct-unite'));
  /* Lot r2 : en heures et minutes, deux cases. */
  verifierVrai('le champ demande des heures et des minutes',
    /Combien de temps/.test(t.texte('#modale-corps')) && !!t.$('#ct-duree') && !!t.$('#ct-duree-m'));
  const crans = t.$$('#ct-crans [data-cth]').map(b => b.dataset.cth);
  verifier('un cran par heure, de 1 à la journée', 8, crans.length);
  verifier('le premier vaut une heure', '1', crans[0]);
  t.clic('[data-cth="3"]'); await t.pause(150);
  verifier('le cran écrit dans le champ', '3', t.$('#ct-duree').value);
  t.clic('#ct-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le temps est noté en heures', 'h', c.temps[0].unite);
  verifier('et vaut trois heures', 3, c.temps[0].duree);

  /* Poser un chantier sur un jour (fiche du jour) ne propose que des heures.
     C'est la seule fenêtre qui pose une durée depuis que « Les journées » ne
     pose plus de dates (R6). */
  await parBarre(t, 'agenda');
  await cliquerJour(t, JCAL(4));
  t.clic('#fj-poser'); await t.pause(400);
  await choisirAPoser(t, 'c1');
  const parts = options(t, '#pj-part');
  verifierVrai('plus de demi ni de quart de journée',
    !parts.some(x => /½|¼|¾/.test(x)));
  verifierVrai('rien que des heures', parts.every(x => / h/.test(x)));
  verifierVrai('et la journée entière est nommée', parts.some(x => /8 h · 1 j/.test(x)));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Temps : une demi-journée déjà posée n’est pas réécrite', async () => {
  /* « Après, si c'est une demi-journée, tu peux laisser des demi-journées, ce
     n'est pas très grave. » Ce qu'il a saisi est à lui : les crans changent,
     ses données ne bougent pas — ni quand on valide l'estimation, ni quand on
     ouvre le placement. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 7 },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', maj: Date.now(),
      lignes: [], temps: [], joursEstimes: 2, jours: [{ d: JCAL(3), p: 0.5 }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-jours'); await t.pause(400);
  t.clic('#cj-ok'); await t.pause(450);
  verifier('elle survit à un enregistrement de la fenêtre', 0.5,
    (t.stock('chantiers') || [])[0].jours[0].p);
  t.clic('#f-planifier'); await t.pause(450);
  const c = await caseDuJour(t, JCAL(3));
  verifierVrai('dans le placement, elle se lit en demi-journée', c && /½/.test(c.textContent));
  verifier('et rien n’a été réécrit', 0.5, (t.stock('chantiers') || [])[0].jours[0].p);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Agenda : un jour déjà pris, dans le placement — garder les deux ou prendre le suivant (R6)', async () => {
  /* « Il faudrait que ça me dise : attention, tel jour, autre chose est déjà
     prévu. » L'alerte vivait dans la fenêtre « Les journées » de la fiche ;
     elle est passée dans le placement, avec ses deux issues. Les week-ends
     sont ouverts : sinon le jour libre suivant dépendrait du jour de la
     semaine où le test tourne. */
  const pris = JCAL(3), aussi = JCAL(4), libre = JCAL(5);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8, weekends: true },
    chantiers: [
      { id: 'c1', nom: 'Plantation Bernard', statut: 'accepte', lignes: [], temps: [],
        jours: [{ d: pris, p: 1 }, { d: aussi, p: 1 }], maj: Date.now() },
      { id: 'c2', nom: 'Dégagement Martin', statut: 'accepte', lignes: [], temps: [],
        jours: [], joursEstimes: 2, maj: Date.now() }
    ]
  }));
  const C0 = t.w.BCC;
  const poses = () => (((t.stock('chantiers') || []).filter(c => c.id === 'c2')[0] || {}).jours || [])
    .map(j => C0.jourCle(j.d));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c2"]'); await t.pause(400);
  t.clic('#f-planifier'); await t.pause(400);
  await cliquerJour(t, pris, 500);
  const dit = t.texte('#cal-planif');
  verifierVrai('le conflit est annoncé au moment de poser', /est déjà pris/.test(dit));
  verifierVrai('et il nomme le chantier qui le tient', /Plantation Bernard/.test(dit));
  verifier('le jour est posé quand même', [C0.jourCle(pris)], poses());

  t.clic('#cal-pl-garder'); await t.pause(300);
  verifier('« Garder les deux » ferme l’alerte', null, t.$('#cal-pl-avert'));
  verifier('et garde le jour', [C0.jourCle(pris)], poses());

  /* Deux appuis de plus : demi-journée, puis retiré ; puis on le repose. */
  await cliquerJour(t, pris, 400);
  await cliquerJour(t, pris, 400);
  verifier('le troisième appui retire le jour', [], poses());
  await cliquerJour(t, pris, 500);
  verifierVrai('l’alerte revient', t.$('#cal-pl-suivant'));
  t.clic('#cal-pl-suivant'); await t.pause(500);
  verifier('« Prendre le jour libre suivant » saute aussi le lendemain, pris lui aussi',
    [C0.jourCle(libre)], poses());
  verifier('l’alerte est partie', null, t.$('#cal-pl-avert'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Accueil : des pictogrammes dessinés, plus des caractères de remplissage', async () => {
  /* Les tuiles de l'accueil et de Mon entreprise sont parties au lot 5b :
     leurs successeurs — les lignes d'Aujourd'hui et les tuiles du ☰ — sont
     tenus à la même règle. */
  const t = await ouvrir(Object.assign({}, VIDE, { export: Date.now() - 45 * 86400000,
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'devis', aDevis: true, lignes: [], temps: [], maj: Date.now() },
      { id: 'c2', nom: 'Combe', statut: 'termine', dateFin: Date.now() - 5 * 86400000, lignes: [], temps: [], maj: Date.now() }] }));
  const pics = t.$$('#vue-accueil .aj-pic');
  verifierVrai('Aujourd’hui porte des pictogrammes (' + pics.length + ')', pics.length >= 3);
  verifierVrai('tous au trait', pics.every(p => p.querySelector('svg.pic')));
  verifierVrai('sans caractère de remplissage', pics.every(p => !/[▤▥▦▧▨▩☀⚙]/.test(p.textContent)));
  t.clic('#b-menu'); await t.pause(200);
  const tuiles = t.$$('#modale [data-menu]');
  /* Dix depuis le lot r1 : Mes notes y est entrée. */
  verifierVrai('chaque entrée du ☰ est dessinée', tuiles.length === 10 &&
    tuiles.every(b => b.querySelector('svg.pic') && !/[▤▥▦▧▨▩⚙]/.test(b.textContent)));
  t.clic('#modale-x'); await t.pause(150);
  /* Le logo du bandeau n'est plus un bouton depuis le lot 5a : Aujourd'hui
     est dans la barre. Il ne porte toujours aucun caractère. */
  verifier('le logo du bandeau n’affiche aucun losange', '', t.texte('#b-logo'));
  verifier('et ce n’est plus un bouton', 'SPAN', t.$('#b-logo') && t.$('#b-logo').tagName);
  verifierVrai('aucun caractère de remplissage ne subsiste dans les tuiles',
    t.$$('.tuile .ic').every(e => !/[▤▥▦▧▨▩⏱≈◫]/.test(e.textContent)));
  /* Le logo ne doit exister qu'une fois dans le fichier : le démarrage (qui a
     repris la marque de l'accueil) et le bandeau passent par la variable CSS. */
  const brut = t.d.documentElement.outerHTML;
  verifier('le logo n’est stocké qu’une fois', 1,
    (brut.match(/--logo:url\("data:image\/png/g) || []).length);
  verifierVrai('le bandeau s’en sert', /#b-logo\{[^}]*var\(--logo\)/s.test(brut));
  verifierVrai('le démarrage aussi', /\.dem-logo\{[^}]*var\(--logo\)/s.test(brut));
  verifierVrai('et l’ancienne marque de l’accueil est partie', !/\.marque-logo\{/.test(brut));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Bandeau : rien qui fasse doublon avec la page', async () => {
  /* + Pile, + Chantier, + Dépense, + Commande existent déjà dans leur page :
     il y passe, jamais par le haut. Le bandeau redevient de la navigation. */
  const doublons = [
    /* Chantiers n'a plus de bouton dans la page (lot b2) : + ▸ Chantier. */
    ['bois', '#p-nouvelle'],
    /* Le stock crée ses commandes aux Entrées et sorties : « + Commande » a
       quitté l'inventaire, qui n'est qu'un état des lieux. */
    ['finances', '#dep-nouvelle'], ['stock', '#cmd-nouvelle']
  ];
  for (const [mod, enPage] of doublons) {
    const t = await ouvrir(Object.assign({}, VIDE, { module: mod }));
    verifier(mod + ' : le bandeau n’a plus d’action', '', t.texte('#b-ctx'));
    verifierVrai(mod + ' : le bouton est dans la page', t.$(enPage));
    verifier(mod + ' : aucune erreur', [], t.erreurs);
  }
  /* « Estimer » a quitté le bandeau : depuis que le module Devis a disparu,
     l'écran est le second onglet des Rendements. Il n'y a donc plus d'action
     sans équivalent dans sa page. */
  const t2 = await ouvrir(Object.assign({}, VIDE, { module: 'rendements' }));
  verifier('rendements : le bandeau n’a plus d’action', '', t2.texte('#b-ctx'));
  verifierVrai('l’estimation est devenue un onglet', t2.$('[data-vue="estimer"]'));
  /* Le filet du bandeau est brun, plus bleu : c'était le reproche principal. */
  const css = t2.d.documentElement.outerHTML;
  verifierVrai('le filet du bandeau est brun',
    /\.bandeau\{[^}]*border-bottom:3px solid var\(--brun-marque\)/s.test(css));
  /* La taille de la maquette V2 (lot 5a) : 34 px, au lieu de 33. */
  verifierVrai('le logo du bandeau a de la place',
    /#b-logo\{[^}]*width:34px;height:34px/s.test(css));
});

/* --------------------------------------------------------------------- */
scenario('Pastilles : un dessin partout, le même d’un module à l’autre', async () => {
  /* Les onglets du bas sont devenus des pastilles en haut de l'écran (lot
     5a) : même élément, mêmes dessins. */
  /* Un onglet de moins par module : les réglages sont passés dans le
     bandeau. Ils étaient répétés en bas de chaque partie, à une place
     différente selon le module — on s'y perdait, et ils mangeaient un
     onglet là où il n'y en a que deux ou trois. */
  /* Le compte exact par module n'est pas une propriété : il change chaque
     fois qu'un écran s'ajoute, et le figer ne fait que casser le test sans
     rien apprendre. Ce qui ne doit jamais changer, c'est qu'aucun module ne
     se réduise à un onglet solitaire, et que chacun porte son dessin. */
  const modules = ['cubage', 'chantiers', 'calendrier', 'rendements',
    'finances', 'stock', 'bois', 'achats', 'vehicule'];
  for (const mod of modules) {
    const t = await ouvrir(Object.assign({}, VIDE, { module: mod }));
    const onglets = t.$$('#onglets button');
    /* Une vue seule ne montre aucune pastille (l'Agenda depuis le lot b2). */
    verifierVrai(mod + ' : jamais un onglet solitaire', onglets.length !== 1);
    verifier(mod + ' : tous dessinés', onglets.length,
      onglets.filter(b => b.querySelector('.ic svg.pic')).length);
    verifierVrai(mod + ' : plus aucun caractère de remplissage',
      onglets.every(b => !/[▤▥▦▧▣◱◫≈∑⚙⌖⏱⇄↻✎]/.test(b.textContent)));
  }
  /* Une même vue doit porter le même dessin partout : c'est ce qui rend la
     navigation lisible quand on passe d'une partie à l'autre. */
  const a = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  const b = await ouvrir(Object.assign({}, VIDE, { module: 'bois' }));
  const carte = a.$('#onglets [data-vue="carte"] svg').innerHTML;
  const lieux = b.$('#onglets [data-vue="lieux"] svg').innerHTML;
  verifier('la carte et le « Où ? » montrent le même repère', carte, lieux);
  /* Les réglages ne sont plus un onglet : ils vivent dans le ☰ du bandeau,
     au même endroit partout, et mènent à la section de l'écran quitté. */
  verifier('plus de pastille réglages', null, a.$('#onglets [data-vue="reglages"]'));
  verifierVrai('le ☰ du bandeau en porte l’accès', a.$('#b-menu'));
  verifierVrai('avec un dessin', a.$('#b-menu svg.pic'));
  await parBarre(a, 'agenda');
  await parMenu(a, 'reglages');
  verifier('et il ouvre bien les réglages', 'vue-reglages', vueActive(a));
  /* Depuis le calendrier — une partie de l'entreprise — c'est la section
     Entreprise qui doit s'ouvrir, pas les réglages généraux. */
  const actif = a.$$('#regl-nav .chip').filter(x => x.getAttribute('aria-pressed') === 'true')[0];
  verifier('sur la section de la partie ouverte', 'ent', actif && actif.dataset.regl);
  verifier('aucune erreur', [], a.erreurs.concat(b.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Débours : encaissé et visible, mais hors du chiffre d’affaires', async () => {
  /* Une somme avancée pour le client et refacturée à l'euro près n'est pas
     une recette. Comptée comme telle, elle gonflerait le CA, l'abattement
     et les cotisations — et pousserait vers les plafonds du micro-BIC. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{
      id: 'c1', nom: 'Plantation Vaux', statut: 'facture', dateFacture: Date.now(),
      temps: [], maj: Date.now(),
      lignes: [
        { travail: 'PLANT', nature: 'prestation', unite: 'plant', quantite: 1000, prix: 1, tva: 10 },
        { travail: 'F_PLANTS', nature: 'vente', unite: 'plant', quantite: 1000, prix: 0.5, tva: 5.5 },
        { travail: 'AUTRE', nature: 'debours', unite: 'forfait', prix: 300, tva: 0 }
      ]
    }]
  }));
  const FIN = t.w.BCF;
  const ch = t.stock('chantiers');
  const ca = FIN.chiffreAffaires(ch, null);
  verifier('la prestation est comptée', 1000, ca.prestation);
  verifier('la vente aussi', 500, ca.vente);
  verifier('le débours est suivi à part', 300, ca.debours);
  verifier('le chiffre d’affaires ne retient que les deux premières', 1500, ca.total);
  verifier('et il reste hors de ce qui est à encaisser', 1500, ca.aEncaisser);
  /* Abattements : 50 % sur la prestation, 71 % sur la vente, rien sur le débours. */
  verifier('après abattement, le débours ne pèse toujours rien', 645, ca.totalApres);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Les listes suivent celles du carnet : dépenses et prestations', async () => {
  const t = await ouvrir(VIDE);
  const FIN = t.w.BCF, C = t.w.BCC;
  const cats = FIN.CATEGORIES.map(x => x.n);
  /* Trois catégories tenaient dans des fourre-tout ou n'existaient pas. */
  verifierVrai('« Consommable » existe', cats.indexOf('Consommable') >= 0);
  verifierVrai('« EPI ou équipement de terrain » est sorti du petit matériel',
    cats.indexOf('EPI ou équipement de terrain') >= 0);
  verifierVrai('« Frais de restauration » est sorti du déplacement',
    cats.indexOf('Frais de restauration') >= 0);
  verifier('le consommable n’est pas une immobilisation', false, FIN.estImmo('CONSO'));
  /* La première de la liste est la plus achetée : elle doit tomber sous le pouce. */
  verifier('la plus fréquente vient en tête', 'Consommable', cats[0]);

  const trav = C.TRAVAUX.map(x => x.n);
  ['Inventaire en plein', 'Repérage de chablis', 'Détourage',
   'Travaux sylvicoles jardinatoires'].forEach(n =>
    verifierVrai('« ' + n + ' » est proposé', trav.indexOf(n) >= 0));
  verifierVrai('le balivage ne parle plus de martelage ni de comptage',
    trav.indexOf('Balivage') >= 0 && !trav.some(n => /martelage|comptage/i.test(n)));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charges fixes : annoncées avant, jamais réclamées après', async () => {
  /* Le préavis suit l'espacement de la charge. Et une échéance passée n'est
     pas un oubli : un prélèvement automatique ne se pointe pas, réclamer
     poserait une alerte qui ne s'éteindrait jamais. */
  const jour = 86400000;
  const dans = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
  const charge = (id, per, quand) => ({
    id, libelle: 'Charge ' + id, ttc: 100, periodicite: per,
    jour: quand.getDate(), moisReference: quand.getMonth(), taux: 0, categorie: 'ASSUR'
  });
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    charges: [
      charge('men', 'mensuel', dans(2)),        /* 3 jours de préavis  → annoncée */
      charge('men2', 'mensuel', dans(8)),       /* au-delà des 3 jours → muette   */
      charge('an', 'annuel', dans(10)),         /* 14 jours de préavis → annoncée */
      charge('hier', 'mensuel', dans(-2))       /* déjà passée         → muette   */
    ]
  }));
  const FIN = t.w.BCF;
  verifier('le préavis dépend de la périodicité',
    [3, 7, 10, 14],
    ['mensuel', 'trimestriel', 'semestriel', 'annuel'].map(p => FIN.preavisDe(p)));
  const al = FIN.alertesCharges(t.stock('charges'), [], Date.now());
  const vus = al.map(a => a.charge.id).sort();
  verifier('seules les échéances proches sont annoncées', ['an', 'men'], vus);
  verifier('et elles disent quand', 'prélevé dans 2 jours',
    al.filter(a => a.charge.id === 'men')[0].texte.split(' ·')[0]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Journées : on pose des heures, et rien que des heures', async () => {
  /* On part parfois trois heures sur un chantier avant d'aller ailleurs.
     Les heures ont d'abord été ajoutées à côté des fractions de journée ;
     elles ont fini par les remplacer, parce que les deux disaient la même
     chose autrement. Les dates ne se tapent plus dans la fiche (R6) : la
     durée se choisit en posant un chantier sur un jour de l'Agenda. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8 },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      joursEstimes: 4, maj: Date.now() }]
  }));
  await cliquerJour(t, JCAL(3));
  t.clic('#fj-poser'); await t.pause(400);
  await choisirAPoser(t, 'c1');
  const sel = t.$('#pj-part');
  verifierVrai('la part se choisit dans une liste', sel && sel.tagName === 'SELECT');
  const libelles = [...sel.options].map(o => o.textContent);
  ['¾ j', '½ j', '¼ j'].forEach(x =>
    verifierVrai('« ' + x + ' » n’est plus proposé', libelles.indexOf(x) < 0));
  verifierVrai('trois heures se posent', libelles.indexOf('3 h') >= 0);
  /* La journée entière reste nommée : c'est le cran qu'on prend le plus. */
  verifierVrai('et la journée entière est dite', libelles.indexOf('8 h · 1 j') >= 0);
  verifier('un cran par heure, pas un de plus', 8, libelles.length);
  /* 3 h sur une journée de 8 h font 0,375 de journée. */
  const troisH = [...sel.options].filter(o => o.textContent === '3 h')[0];
  verifier('3 h valent la bonne part de journée', 0.375, Number(troisH.value));

  t.choisir('#pj-part', '0.375'); await t.pause(150);
  t.clic('#pj-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('la part saisie est retenue', 0.375, ((c.jours || [])[0] || {}).p);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Journées : une estimation plus courte que le placé demande confirmation', async () => {
  /* Deux journées placées, une seule estimée : la fenêtre le dit avant
     d'enregistrer. Un chantier a le droit de déborder. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      joursEstimes: 3, jours: [{ d: JCAL(3), p: 1 }, { d: JCAL(4), p: 1 }], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-estim'); await t.pause(350);
  t.saisir('#es-jest', '1');

  /* Refusé : rien ne doit être enregistré. */
  let demande = '';
  t.w.confirm = m => { demande = m; return false; };
  t.clic('#es-ok'); await t.pause(300);
  verifierVrai('l’écart est annoncé en clair', /2 journées pour 1 estimée|de trop/.test(demande));
  verifier('refuser n’enregistre rien', 3, (t.stock('chantiers') || [])[0].joursEstimes);

  t.w.confirm = () => true;
  t.clic('#es-ok'); await t.pause(400);
  verifier('accepter enregistre l’estimation', 1, (t.stock('chantiers') || [])[0].joursEstimes);
  verifier('sans toucher aux jours placés', 2, ((t.stock('chantiers') || [])[0].jours || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Placement : le troisième appui retire la journée de trop', async () => {
  /* La croix de la fenêtre « Les journées » est partie avec ses dates (R6).
     Dans le placement, un même jour touché trois fois passe de la journée à
     la demi-journée, puis il est retiré — et seulement lui. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8, weekends: true },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      joursEstimes: 3, jours: [{ d: JCAL(3), p: 1 }, { d: JCAL(4), p: 1 }], maj: Date.now() }]
  }));
  const C0 = t.w.BCC;
  const jours = () => ((t.stock('chantiers') || [])[0].jours || []).map(j => [C0.jourCle(j.d), j.p]);
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-planifier'); await t.pause(400);
  await cliquerJour(t, JCAL(3), 400);
  verifier('un appui : la demi-journée', [[C0.jourCle(JCAL(3)), 0.5], [C0.jourCle(JCAL(4)), 1]], jours());
  await cliquerJour(t, JCAL(3), 400);
  verifier('un autre : la journée de trop est retirée, l’autre reste', [[C0.jourCle(JCAL(4)), 1]], jours());
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('À traiter : un chantier prévu dans les trois jours saute aux yeux', async () => {
  /* Un chantier posé au calendrier après-demain ne doit pas s'apprendre en
     ouvrant l'agenda. */
  const jour = 86400000;
  const dans = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
  const ch = (id, quand, p) => ({ id, nom: 'Chantier ' + id, statut: 'accepte',
    lignes: [], temps: [], joursEstimes: 5, jours: [{ d: quand, p: p || 1 }], maj: Date.now() });

  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [ch('auj', dans(0)), ch('dem', dans(1)), ch('trois', dans(3)),
      ch('loin', dans(10))]
  }));
  const al = t.w.BCC.alertes(t.stock('chantiers'), null, Date.now());
  const app = al.filter(x => x.type === 'approche');
  verifier('seuls les trois prochains jours remontent', ['auj', 'dem', 'trois'],
    app.map(x => x.chantier.id).sort());
  verifierVrai('aujourd’hui se dit « aujourd’hui »',
    /aujourd/.test(app.filter(x => x.chantier.id === 'auj')[0].texte));
  verifierVrai('et demain « demain »',
    /^demain/.test(app.filter(x => x.chantier.id === 'dem')[0].texte));
  verifierVrai('la journée posée est annoncée',
    /journée/.test(app[0].texte));
  /* Un chantier lointain n'a rien à faire là. */
  verifier('le chantier à dix jours ne remonte pas', 0,
    app.filter(x => x.chantier.id === 'loin').length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('À traiter montre aussi le travail à venir, pas que les ennuis', async () => {
  /* La zone ne remontait que ce qui a mal tourné — impayés, retards. Un
     chantier accepté sans journée posée n'y figurait pas, alors que c'est
     exactement ce qu'on doit voir en ouvrant l'application. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'a', nom: 'Sans rien', statut: 'accepte', lignes: [], temps: [], maj: Date.now() },
      { id: 'b', nom: 'Moitié posée', statut: 'accepte', lignes: [], temps: [], maj: Date.now(),
        joursEstimes: 4, jours: [{ d: Date.now(), p: 1 }] },
      /* Posé loin devant : sinon il remonterait comme chantier qui approche,
         ce qui est un autre sujet et se vérifie ailleurs. */
      { id: 'c', nom: 'Tout posé', statut: 'encours', lignes: [], temps: [], maj: Date.now(),
        joursEstimes: 2, jours: [{ d: Date.now() + 20 * 86400000, p: 1 },
          { d: Date.now() + 21 * 86400000, p: 1 }] }
    ]
  }));
  const C2 = t.w.BCC;
  const al = C2.alertes(t.stock('chantiers'), null, Date.now());
  const par = ty => al.filter(x => x.type === ty);

  verifier('un chantier accepté sans rien de prévu est signalé', 1, par('aprevoir').length);
  verifierVrai('et il dit quoi faire', /estimez et placez/.test(par('aprevoir')[0].texte));

  verifier('un chantier à moitié posé annonce le reste', 1, par('aplacer').length);
  verifierVrai('avec le compte exact',
    /3 journées à placer sur 4 journées/.test(par('aplacer')[0].texte));

  /* Un chantier dont tout est posé n'a rien à traiter : il ne doit pas
     encombrer la liste. */
  verifier('un chantier complet ne dit rien', 0,
    al.filter(x => x.chantier.id === 'c').length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Mise à jour : l’avis reste posé au lieu de s’effacer', async () => {
  /* Un toast disparaît en deux secondes et se rate. L'avis doit tenir
     jusqu'à ce qu'on réponde, sans bloquer la saisie en cours. */
  const t = await ouvrir(VIDE);
  const z = t.$('#maj-avis');
  verifierVrai('l’avis existe dans la page', z);
  verifier('et reste caché tant qu’il n’y a rien à installer', true, z.hidden);
  verifierVrai('il propose d’installer', t.$('#maj-oui'));
  verifierVrai('et de repousser', t.$('#maj-non'));
  verifierVrai('il rassure sur les données',
    /données ne sont pas touchées/.test(z.textContent));
  /* Il ne doit pas barrer l'écran : on doit pouvoir continuer à saisir. */
  const st = t.w.getComputedStyle(z);
  verifier('il se pose en bas, sans couvrir la page', 'fixed', st.position);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Analyses : la TVA payée sur les achats est montrée', async () => {
  /* C'est celle qui se récupère : elle a sa place à côté des achats, pas
     seulement dans la balance générale. */
  const an = new Date().getFullYear();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'analyses',
    depenses: [
      { id: 'd1', date: new Date(an, 3, 5, 12).getTime(), fournisseur: 'Motoculture',
        lignes: [{ libelle: 'Chaîne', categorie: 'CONSO', ttc: 120, taux: 20 }] },
      { id: 'd2', date: new Date(an, 3, 8, 12).getTime(), fournisseur: 'Comptoir',
        lignes: [{ libelle: 'Débroussailleuse', categorie: 'IMMO', ttc: 960, taux: 20 }] },
      { id: 'd3', date: new Date(an, 4, 2, 12).getTime(), fournisseur: 'Resto',
        lignes: [{ libelle: 'Repas', categorie: 'REPAS', ttc: 21.1, taux: 5.5 }] }
    ]
  }));
  t.clic('[data-ana="depenses"]'); await t.pause(350);
  const txt = t.$('#ana-corps').textContent.replace(/\s+/g, ' ');
  verifierVrai('un bloc annonce la TVA des achats', /TVA payée sur ces achats/.test(txt));
  verifierVrai('elle distingue le courant', /sur le courant/.test(txt));
  verifierVrai('et les immobilisations', /sur les immobilisations/.test(txt));
  /* Deux taux dans la période : le détail doit les séparer. */
  verifierVrai('les taux sont détaillés', /Par taux/.test(txt));
  verifierVrai('« justificatifs » ne dit plus rien à personne', !/justificatif/.test(txt));
  verifierVrai('on parle d’achats saisis', /achats saisis/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Analyses : le graphique porte une échelle et dit ce qu’il montre', async () => {
  /* Une hauteur sans graduation ne se lit pas : on ne sait pas si la barre
     vaut cent euros ou dix mille. */
  const an = new Date().getFullYear();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'analyses',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'paye', temps: [], maj: Date.now(),
      dateFacture: new Date(an, 2, 10, 12).getTime(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 8, prix: 1200, nature: 'prestation' }] }],
    depenses: [{ id: 'd1', date: new Date(an, 4, 5, 12).getTime(), fournisseur: 'X',
      lignes: [{ libelle: 'Gasoil', categorie: 'CONSO', ttc: 2400, taux: 20 }] }]
  }));
  await t.pause(300);
  const corps = t.$('#ana-corps');
  verifierVrai('le titre dit ce que montre le graphique',
    /facturé et acheté/.test(corps.textContent));
  const svg = corps.querySelector('svg');
  verifierVrai('un graphique est dessiné', svg);
  const etiquettes = [...svg.querySelectorAll('text')].map(e => e.textContent);
  verifierVrai('les douze mois sont en abscisse',
    ['janv', 'juil', 'déc'].every(m => etiquettes.some(e => e.toLowerCase().indexOf(m) === 0)));
  verifierVrai('une graduation part de zéro', etiquettes.indexOf('0') >= 0);
  verifierVrai('et monte jusqu’au haut de l’échelle',
    etiquettes.some(e => /k€|€/.test(e) && e !== '0'));
  /* L'échelle s'arrête sur un chiffre rond, sinon la moitié tombe faux.
     L'espace devant l'unité est insécable (U+00A0) : c'est ce qui empêche le
     « € » de tomber seul à la ligne sur une tuile étroite. */
  verifierVrai('le haut de l’échelle est un chiffre rond',
    etiquettes.some(e => /^(10|12|15|20|25|30|50) k€$/.test(e)));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Facturer un produit dosé le retire du stock, converti', async () => {
  /* La facture compte des plants — c'est ce que lit le client — et le stock
     des millilitres. 300 plants d'un répulsif dosé à 6 ml font 1 800 ml. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', chOuvert: 'c1',
    articles: [{ id: 'a1', nom: 'Trico', type: 'traitement', unite: 'millilitre',
      dosage: 6, mouvements: [], maj: Date.now() }],
    commandes: [{ id: 'k1', num: 'K1', dateCmd: Date.now(), dateLiv: Date.now(),
      statut: 'recu', livraison: 0, maj: Date.now(),
      lignes: [{ article: 'a1', qte: 10000, prix: 0.02 }] }],
    chantiers: [{ id: 'c1', nom: 'Plantation Vaux', statut: 'accepte', temps: [], maj: Date.now(),
      lignes: [] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-ligne'); await t.pause(300);

  verifierVrai('la ligne propose les produits du stock', t.$('#cl-art'));
  t.choisir('#cl-trav', 'F_REPULSIF');
  t.saisir('#cl-qte', '300');
  t.saisir('#cl-prix', '0,20');
  t.choisir('#cl-art', 'a1'); await t.pause(200);
  /* Le stock dépasse le litre : l'aide parle donc en litres, et rappelle le
     calcul en millilitres pour qu'on puisse le vérifier d'un coup d'œil. */
  const aide = t.texte('#cl-art-aide');
  verifierVrai('elle annonce ce qui sortira, en litres', /1,80?\s?L/.test(aide));
  verifierVrai('en montrant la conversion', /300\s?×\s?6/.test(aide));
  verifierVrai('et ce qu’il restera', /reste/.test(aide));
  t.clic('#cl-ok'); await t.pause(500);

  const s = (t.stock('sorties') || [])[0];
  verifierVrai('une sortie est née de la facture', s && s.chantier === 'c1');
  verifier('convertie en millilitres', 1800, s.lignes[0].qte);
  /* Le chantier est accepté, pas fait : le produit est engagé, pas sorti. */
  const ST = t.w.BCS2;
  verifier('engagé tant que le chantier n’est pas fait', 'accepte',
    ST.VENTE_DE_CHANTIER['accepte']);

  /* Corriger la facture corrige la sortie. */
  t.clic('[data-lmod="0"]'); await t.pause(300);
  t.saisir('#cl-qte', '350');
  t.clic('#cl-ok'); await t.pause(500);
  const s2 = (t.stock('sorties') || [])[0];
  verifier('corriger 300 en 350 corrige la sortie', 2100, s2.lignes[0].qte);
  verifier('sans en créer une seconde', 1, (t.stock('sorties') || []).length);

  /* Retirer la ligne retire la sortie. */
  t.w.confirm = () => true;
  t.clic('[data-lsup="0"]'); await t.pause(500);
  verifier('retirer la ligne retire la sortie', 0, (t.stock('sorties') || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Stock : jamais deux sorties pour la même facture', async () => {
  /* Les chantiers repris du carnet portent déjà leur sortie, importée du
     classeur de stock. Rattacher après coup un article à leur ligne créerait
     une seconde sortie par-dessus : le produit serait retiré deux fois, sans
     que rien ne le dise. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', chOuvert: 'c1',
    articles: [{ id: 'a1', nom: 'Tuteur', type: 'tuteur', unite: 'unite',
      mouvements: [], maj: Date.now() }],
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'facture', temps: [], maj: Date.now(),
      lignes: [{ travail: 'F_TUTEUR', unite: 'unite', quantite: 100, prix: 0.78, nature: 'vente' }] }],
    /* la sortie reprise du carnet : elle ne porte pas « auto » */
    sorties: [{ id: 's1', chantier: 'c1', num: 'F-2025-0016', statut: 'fini',
      date: Date.now(), lignes: [{ article: 'a1', qte: 100, prix: 0.78 }], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('[data-lmod="0"]'); await t.pause(300);
  t.choisir('#cl-art', 'a1'); await t.pause(150);
  t.clic('#cl-ok'); await t.pause(500);

  const s = t.stock('sorties') || [];
  verifier('la sortie reste unique', 1, s.length);
  verifier('et c’est celle du carnet', 's1', s[0].id);
  verifier('sa quantité n’a pas bougé', 100, s[0].lignes[0].qte);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Stock : un répulsif se compte au millilitre et se lit au litre', async () => {
  /* « ml » désigne le mètre linéaire dans l'application : un produit dosé au
     millilitre a sa propre unité. Et 30 000 ml ne disent rien à personne —
     30 L, c'est trois bidons, donc quelques hectares. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'stock' }));
  const ST = t.w.BCS2;
  verifierVrai('le millilitre est une unité à part entière',
    ST.UNITES_ART.some(u => u.c === 'millilitre'));
  verifierVrai('et « ml » reste le mètre linéaire',
    ST.UNITES_ART.filter(u => u.c === 'ml')[0].n === 'mètre linéaire');

  const petit = ST.echelleArt('millilitre', [900]);
  verifier('sous le litre, on reste en millilitres', 'ml', petit.court);
  verifier('sans conversion', 1, petit.div);

  const grand = ST.echelleArt('millilitre', [30000, 1800]);
  verifier('au-delà, on passe en litres', 'L', grand.court);
  verifier('en divisant par mille', 1000, grand.div);
  verifierVrai('30 000 ml font bien 30 L', Math.round(30000 / grand.div) === 30);

  /* L'échelle se décide sur toute la ligne : une colonne en litres à côté
     d'une colonne en millilitres serait illisible. */
  const melange = ST.echelleArt('millilitre', [30000, 12]);
  verifier('une petite valeur suit la grande', 'L', melange.court);
  verifier('les unités sans litre ne bougent pas', 'u', ST.echelleArt('unite', [50000]).court);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : une longue liste se replie', async () => {
  /* Quarante-sept noms déroulés d'un bloc, c'est un écran entier à faire
     défiler avant d'atteindre quoi que ce soit d'autre. */
  const noms = [];
  for (let i = 1; i <= 20; i++) noms.push('Propriétaire ' + String(i).padStart(2, '0'));
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers', proprios: noms }));
  t.clic('[data-regl="ent"]'); await t.pause(250);
  t.clic('[data-liste="proprios"]'); await t.pause(250);

  verifier('huit noms seulement au départ', 8, t.$$('#rl-liste .liste-item').length);
  verifierVrai('et le compte des autres est annoncé',
    /Voir les 12 autres/.test(t.$('#rl-liste').textContent));
  t.clic('#rl-plus'); await t.pause(200);
  verifier('déplié, la liste est entière', 20, t.$$('#rl-liste .liste-item').length);
  t.clic('#rl-plus'); await t.pause(200);
  verifier('et se replie', 8, t.$$('#rl-liste .liste-item').length);
  /* Une liste courte n'a pas à porter ce bouton. */
  t.clic('[data-liste="clients"]'); await t.pause(250);
  verifier('rien à replier sur une liste vide', null, t.$('#rl-plus'));
  /* Les prestations sont la plus longue des listes : elles se replient aussi. */
  t.clic('[data-liste="travaux"]'); await t.pause(250);
  verifier('les prestations aussi s’arrêtent à huit', 8, t.$$('#rl-liste .liste-item').length);
  verifierVrai('avec leur bouton', t.$('#rl-plus'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Tuiles : aucune ne parle de marge, et Finances porte le chiffre d’affaires', async () => {
  /* « Marge » désignait recettes moins achats, qui ignore les cotisations,
     l'impôt et l'amortissement. Ce n'est pas une marge. La tuile Analyses a
     disparu avec son module ; c'est Finances qui porte le chiffre d'affaires,
     et elle doit dire sur quelle période elle compte. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'paye', temps: [], maj: Date.now(),
      dateFacture: Date.now(), datePaiement: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 4, prix: 250, nature: 'prestation' }] }],
    depenses: [{ id: 'd1', date: Date.now(),
      lignes: [{ libelle: 'Gasoil', categorie: 'CONSO', ttc: 120, taux: 20 }] }]
  }));
  /* La tuile Stock parle bien de marges, et c'est juste : ce sont celles des
     fournitures revendues. Celle qui mentait était la tuile du résultat.
     Lot 5b : la tuile Finances est partie avec Mon entreprise ; ses chiffres
     sont dans Argent ▸ Bilan, et les tuiles qui restent sont celles du ☰. */
  t.clic('#b-menu'); await t.pause(200);
  const autres = t.$$('#modale [data-menu]').filter(b => b.dataset.menu !== 'stock');
  verifierVrai('aucune tuile du ☰ ne parle de marge', autres.length &&
    autres.every(b => !/marge/i.test(b.textContent)));
  t.clic('#modale-x'); await t.pause(150);
  await parBarre(t, 'argent');
  /* Lot d1 : Argent s'ouvre sur Mois, au mois en cours ; le chiffre
     d'affaires y est en grand, le mois et l'année au-dessus.
     4 ha × 250 € = 1000 € facturés, et non 1000 − 120 d'achats. */
  const ca = t.$('#fi-corps #mo-ca');
  verifierVrai('Argent porte le chiffre d’affaires',
    ca && /Chiffre d’affaires facturé HT/.test(ca.textContent) &&
    sansBlancs(t.texte('#mo-ca [data-mo="ca"]')) === '1000€');
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  verifierVrai('et dit sur quelle période',
    new RegExp(MOIS[new Date().getMonth()] + ' ' + new Date().getFullYear(), 'i').test(t.texte('#mo-titre')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : le plus récent en tête, et sa date visible', async () => {
  /* Le carnet était rangé par statut : un chantier accepté ce matin passait
     derrière tous les devis, et on ne retrouvait pas ce qu'on venait
     d'ouvrir. Aucune date n'apparaissait non plus. */
  const j = n => new Date(2026, 0, n, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'vieux', nom: 'Vieux devis', statut: 'devis', lignes: [], temps: [],
        debut: j(5), maj: j(5) },
      { id: 'recent', nom: 'Accepté ce matin', statut: 'accepte', lignes: [], temps: [],
        debut: j(28), maj: j(28) },
      { id: 'facture', nom: 'Facturé hier', statut: 'facture', lignes: [], temps: [],
        dateFacture: j(20), maj: j(20) }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  /* Les groupes ont leur ordre fixe ; le plus récent d'abord, c'est le tri
     de « Tout le carnet, par filtre » (lot b2). */
  t.choisir('#c-filtre', 'tous'); await t.pause(250);
  const noms = t.$$('#ch-filtre-liste .aj-txt > b').map(e => e.textContent.trim());
  verifierVrai('le plus récent est en tête', /Accepté ce matin/.test(noms[0] || ''));
  verifierVrai('le vieux devis est en dernier', /Vieux devis/.test(noms[noms.length - 1] || ''));
  /* Le tri lui-même, indépendamment de l'écran. */
  const C = t.w.BCC;
  const ordre = C.tri(t.stock('chantiers')).map(c => c.id);
  verifier('l’ordre est bien chronologique inverse', ['recent', 'facture', 'vieux'], ordre);
  verifierVrai('et la date du chantier facturé s’affiche',
    /Facturé (le|il y a)/.test(t.$('#vue-carnet').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Analyses : on n’additionne pas des jours et des plants', async () => {
  /* Une même prestation facturée tantôt à la journée, tantôt au plant :
     parPrestation() cumulait les quantités et gardait l'unité de la
     première ligne. 4 jours et 1 705 plants donnaient « 1 709 jours ». */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'paye', temps: [], maj: Date.now(),
      dateFacture: Date.now(), lignes: [
        { travail: 'PLANT', unite: 'jour', quantite: 4, prix: 250, nature: 'prestation' },
        { travail: 'PLANT', unite: 'plant', quantite: 1705, prix: 1, nature: 'prestation' },
        { travail: 'DEGAG', unite: 'ha', quantite: 8, prix: 200, nature: 'prestation' }
      ] }]
  }));
  const FIN = t.w.BCF;
  const l = FIN.parPrestation(t.stock('chantiers'), null, c => c);
  const plant = l.filter(x => x.travail === 'PLANT')[0];
  const degag = l.filter(x => x.travail === 'DEGAG')[0];
  verifier('unités mêlées : plus d’unité retenue', null, plant.unite);
  verifier('unité homogène : elle est gardée', 'ha', degag.unite);
  verifier('et sa quantité reste juste', 8, degag.quantite);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Tuiles : plus de second nombre à côté du premier', async () => {
  /* « 4 chantiers » surmonté d'un « 2 » rouge se lisait comme une
     contradiction. Le nombre à traiter se lit dans la zone « À traiter »,
     qui le dit en toutes lettres. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'termine', lignes: [], temps: [],
      dateFin: Date.now() - 40 * 86400000, maj: Date.now() }]
  }));
  verifier('aucune pastille rouge ne subsiste', 0, t.$$('.pastille-alerte').length);
  ['#a-ent-alerte', '#e-ch-alerte', '#e-st-alerte'].forEach(s =>
    verifier(s + ' a disparu', null, t.$(s)));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Navigation : ouvrir une fiche depuis « À traiter » laisse un retour', async () => {
  /* Régression : ouvrirChantier() ne retirait « accueil-ouvert » que par le
     chemin allerModule. Depuis l'écran Entreprise, module Chantiers déjà
     actif, la fiche s'affichait sous un bandeau masqué — plus de bouton
     retour, plus de sélecteur, aucun moyen de ressortir. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'facture', lignes: [], temps: [],
      dateFacture: Date.now() - 70 * 86400000, maj: Date.now() }]
  }));
  /* On se met dans l'état exact : menu Entreprise ouvert par-dessus. */
  t.w.document.body.classList.add('accueil-ouvert');
  /* « À traiter » ne vit plus que dans le carnet depuis la 4.82. Le clic doit
     trouver l'alerte : un clic dans le vide laisserait le masque en place et
     ferait croire à la régression. */
  verifierVrai('l’alerte est là où l’on clique', t.clic('[data-groupe="faire"] [data-chouvrir="c1"]'));
  await t.pause(300);
  verifier('le masque des menus est levé', false,
    t.d.body.classList.contains('accueil-ouvert'));
  verifierVrai('le bouton retour est utilisable',
    t.$('#b-retour') && !t.$('#b-retour').hidden);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Chantier : les dates de facture et de paiement se corrigent', async () => {
  /* Changer le statut inscrivait la date du jour et il n'existait aucun
     champ pour la reprendre : une facture réglée le mois dernier restait
     datée d'aujourd'hui, faussant la TVA et les relances. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', chOuvert: 'c1',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'facture', lignes: [], temps: [],
      dateFacture: new Date(2026, 2, 10, 12).getTime(), maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(350);
  t.clic('#f-facture'); await t.pause(350);
  verifierVrai('le champ « Facturé le » existe', t.$('#fc-date'));
  verifierVrai('le champ « Payé le » aussi', t.$('#fc-paie'));
  verifier('la date en base est bien affichée', '2026-03-10', t.$('#fc-date').value);
  t.choisir('#fc-paie', '2026-04-02');
  t.clic('#fc-ok'); await t.pause(400);
  const c = (t.stock('chantiers') || [])[0];
  verifierVrai('la date de paiement saisie est retenue',
    c && new Date(c.datePaiement).getMonth() === 3 && new Date(c.datePaiement).getDate() === 2);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : le libellé de facture prime sur l’intitulé des travaux', async () => {
  /* La liste des travaux sert au taux de TVA et aux rendements ; elle ne dit
     pas ce qui a été vendu. « Fourniture de tuteurs » masquait « tuteur
     châtaignier 9/11×150 », qui est le texte de la facture du client. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', chOuvert: 'c1',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'facture', temps: [], maj: Date.now(),
      lignes: [
        { travail: 'F_TUTEUR', unite: 'unite', quantite: 100, prix: 0.78, nature: 'vente',
          note: 'Fourniture de tuteur en châtaigner 9/11*150' },
        { travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 250, nature: 'prestation' }
      ] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const titres = t.$$('.ligne-trav b').map(e => e.textContent.trim());
  verifierVrai('le libellé de facture est le titre',
    titres.indexOf('Fourniture de tuteur en châtaigner 9/11*150') >= 0);
  verifierVrai('sans libellé, l’intitulé des travaux reste le titre',
    titres.indexOf('Dégagement manuel') >= 0);
  verifierVrai('et le classement reste lisible dessous',
    /Fourniture de tuteurs/.test(t.$('.ligne-trav').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Reprise du carnet : le fichier converti se restaure et compte juste', async () => {
  /* Le convertisseur produit une sauvegarde ; ce scénario vérifie qu'elle
     traverse l'application sans rien perdre en route. On le passe si le
     fichier n'a pas été fabriqué — il vit hors du dépôt, avec les données
     réelles, qui ne doivent pas y entrer. */
  const chemin = process.env.SYLVE_REPRISE ||
    path.join(process.env.USERPROFILE || '', 'Documents', 'reprise-carnet.json');
  if (!fs.existsSync(chemin)) {
    console.log('    ~ fichier de reprise absent, scénario passé');
    return;
  }
  const brut = fs.readFileSync(chemin, 'utf8');
  const src = JSON.parse(brut);

  const t = await ouvrir(Object.assign({}, VIDE, { module: 'stock' }));
  t.clic('#art-importer'); await t.pause(250);
  t.fichier('#is-fichier', 'reprise-carnet.json', brut);
  await t.pause(1200);

  verifier('tous les chantiers sont arrivés',
    src.chantiers.length, (t.stock('chantiers') || []).length);
  verifier('toutes les dépenses aussi',
    src.depenses.length, (t.stock('depenses') || []).length);
  verifier('et les charges fixes',
    src.charges.length, (t.stock('charges') || []).length);

  /* Le chiffre d'affaires calculé par l'application doit retomber sur celui
     du tableur — débours exclus, puisqu'ils n'en font pas partie. */
  const FIN = t.w.BCF;
  const ca = FIN.chiffreAffaires(t.stock('chantiers'), null);
  const attendu = src.chantiers.reduce((s, c) => s + c.lignes.reduce((x, l) =>
    x + (l.nature === 'debours' ? 0 : (l.unite === 'forfait' ? l.prix : l.quantite * l.prix)), 0), 0);
  verifierVrai('le chiffre d’affaires retombe sur le tableur',
    Math.abs(ca.total - Math.round(attendu * 100) / 100) < 1);
  verifierVrai('les débours sont suivis à part', ca.debours > 0);
  verifierVrai('et tenus hors du chiffre d’affaires', ca.total < ca.total + ca.debours);

  /* Le stock, quand le fichier en porte. */
  if ((src.articles || []).length) {
    verifier('les produits sont arrivés', src.articles.length, (t.stock('articles') || []).length);
    verifier('les fournisseurs aussi', src.fournisseurs.length, (t.stock('fournisseurs') || []).length);
    verifier('les commandes', src.commandes.length, (t.stock('commandes') || []).length);
    verifier('les sorties', src.sorties.length, (t.stock('sorties') || []).length);
    /* Une sortie qui connaît son chantier en suit le statut toute seule. */
    const liees = (t.stock('sorties') || []).filter(s => s.chantier);
    verifierVrai('la plupart des sorties sont rattachées à un chantier',
      liees.length >= src.sorties.length - 1);
    const ids = (t.stock('chantiers') || []).map(c => c.id);
    verifierVrai('et le chantier visé existe bien',
      liees.every(s => ids.indexOf(s.chantier) >= 0));
    /* Le Trico se compte en millilitres, pas en bidons. */
    const trico = (t.stock('articles') || []).filter(a => /trico/i.test(a.nom))[0];
    if (trico) {
      /* « ml » est le mètre linéaire dans l'application : un répulsif dosé
         au millilitre prend l'unité qui porte ce nom. */
      verifier('le Trico est en millilitres', 'millilitre', trico.unite);
      verifierVrai('avec son dosage par plant', trico.dosage > 0);
      const ST = t.w.BCS2;
      verifier('et son stock se lira en litres', 'L',
        ST.echelleArt(trico.unite, [30000]).court);
    }
  }
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Sauvegarde : une dépense d’aujourd’hui se restaure vraiment', async () => {
  /* Régression : la restauration exigeait un montant « ttc » à la racine de
     la dépense — le format d'avant les lignes multiples. Or le formulaire
     efface justement ce champ depuis. Toute dépense saisie était donc
     rejetée en silence : la sauvegarde ne protégeait plus rien. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'stock' }));
  const sauvegarde = {
    format: 'bordcub-sauvegarde-1', version: 7, date: new Date().toISOString(),
    chantiers: [{ id: 'c1', nom: 'Plantation Vaux', statut: 'paye', lignes: [], temps: [] }],
    depenses: [
      /* format d'aujourd'hui : des lignes, pas de ttc à la racine */
      { id: 'd1', date: Date.now(), fournisseur: 'Motoculture',
        lignes: [{ libelle: 'Chaîne', categorie: 'CONSO', ttc: 42, taux: 20 }] },
      /* format d'avant : un montant à plat, qui doit continuer de passer */
      { id: 'd2', date: Date.now(), fournisseur: 'Station', ttc: 60, taux: 20, categorie: 'CARB' }
    ],
    charges: [{ id: 'g1', libelle: 'Assurance RC', ttc: 48, periodicite: 'mensuel',
      categorie: 'ASSUR', jour: 5, moisReference: 0 }]
  };
  t.clic('#art-importer'); await t.pause(250);
  t.fichier('#is-fichier', 'sauvegarde.json', JSON.stringify(sauvegarde));
  await t.pause(700);

  const dep = t.stock('depenses') || [];
  verifier('les deux dépenses sont revenues', 2, dep.length);
  verifierVrai('celle à lignes multiples comprise',
    dep.some(d => d.lignes && d.lignes.length && d.lignes[0].libelle === 'Chaîne'));
  verifier('le chantier aussi', 1, (t.stock('chantiers') || []).length);
  verifier('et la charge fixe', 1, (t.stock('charges') || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Accueil : ce qui va être prélevé se voit dès l’ouverture', async () => {
  /* Le rappel doit être là où l'application s'ouvre, pas dans un écran qu'on
     ne visite jamais — même règle que le rappel de sauvegarde. */
  const dans = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
  const ch = (id, per, d) => ({ id, libelle: 'Charge ' + id, ttc: 100, periodicite: per,
    categorie: 'ASSUR', taux: 0, debut: d.getTime(), jour: d.getDate(), moisReference: d.getMonth() });

  /* Lot 5b : un bloc « Prélèvements à venir », séparé des tâches, une ligne
     par échéance, sur sept jours. Une échéance annuelle garde ses quatorze
     jours de préavis : l'horizon avance, il ne raccourcit jamais. */
  const vide = await ouvrir(VIDE);
  verifier('sans charge, rien ne s’affiche', null, vide.$('#aj-prelevements'));

  const t = await ouvrir(Object.assign({}, VIDE, {
    charges: [ch('a', 'mensuel', dans(1)), ch('b', 'annuel', dans(6)), ch('c', 'trimestriel', dans(3)),
      ch('d', 'mensuel', dans(5)), ch('e', 'mensuel', dans(9)), ch('f', 'annuel', dans(12))]
  }));
  const z = t.$('#aj-prelevements');
  verifierVrai('le bloc est là', z);
  verifier('une ligne par échéance proche, la plus proche d’abord',
    ['prelevement:a', 'prelevement:c', 'prelevement:d', 'prelevement:b', 'prelevement:f'],
    lignesAuj(t, 'prelevement:').map(l => l.dataset.ajcle.split(':').slice(0, 2).join(':')));
  verifierVrai('la mensuelle à cinq jours y entre (sept jours, plus trois)', ligneAuj(t, 'prelevement:d:' +
    t.w.BCC.jourCle(dans(5).getTime())));
  verifierVrai('celle à neuf jours n’y est pas', !lignesAuj(t, 'prelevement:e:').length);
  verifierVrai('avec le total', /500/.test(t.texte('#aj-prelevements .aj-sous')));
  verifierVrai('et la plus proche dit quand', /demain/.test(texteLignes(t, 'prelevement:a:')));
  verifierVrai('chacune nommée en clair', /Charge a/.test(texteLignes(t, 'prelevement:a:')));
  verifier('séparé des tâches : ni En retard ni Bientôt', [null, null],
    [t.$('#aj-retard [data-ajcle^="prelevement"]'), t.$('#aj-bientot [data-ajcle^="prelevement"]')]);
  await appuyerLigne(t, lignesAuj(t, 'prelevement:a:')[0].dataset.ajcle);
  verifier('un appui mène aux Dépenses d’Argent', 'vue-depenses', vueActive(t));
  verifier('défilées jusqu’au bloc Charges fixes', 'dep-charges', defile(t));
  verifier('aucune erreur', [], t.erreurs.concat(vide.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Charge fixe : la date de premier paiement porte enfin l’année', async () => {
  /* Le formulaire ne demandait qu'un jour et un mois. Un abonnement souscrit
     en septembre 2024 était indiscernable d'un souscrit deux ans plus tard,
     et ses échéances remontaient depuis toujours. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  await parBarre(t, 'argent');
  t.clic('[data-vue="charges"]'); await t.pause(250);
  t.clic('#chg-nouvelle'); await t.pause(300);
  verifierVrai('le champ de date existe', t.$('#cg-debut'));
  verifier('l’ancien « jour du prélèvement » a disparu', null, t.$('#cg-jour'));
  verifier('l’ancien « premier mois » aussi', null, t.$('#cg-mois'));

  t.saisir('#cg-lib', 'Logiciel de facturation');
  t.saisir('#cg-ttc', '180');
  t.choisir('#cg-per', 'annuel');
  t.choisir('#cg-cat', 'ABO');
  /* Depuis la 4.37, une charge portée en dépense réclame son taux : sans lui
     il n'y a rien à récupérer. Le scénario doit donc le choisir. */
  t.choisir('#cg-taux', '20');
  t.choisir('#cg-debut', '2024-09-01');
  t.clic('#cg-ok'); await t.pause(400);

  const c = (t.stock('charges') || [])[0];
  verifierVrai('la charge est enregistrée', c);
  verifier('le jour est retenu', 1, c.jour);
  verifier('le mois aussi', 8, c.moisReference);
  verifierVrai('et l’année, qui manquait', new Date(c.debut).getFullYear() === 2024);
  /* Rien avant la souscription : la borne sert à ça. */
  const FIN = t.w.BCF;
  const avant = FIN.echeances(c, { debut: new Date(2023, 0, 1).getTime(), fin: new Date(2023, 11, 31).getTime() });
  verifier('aucune échéance avant le premier paiement', 0, avant.length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charge fixe : pas de TVA là où il n’y en a pas', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  const FIN = t.w.BCF;
  verifier('assurance, cotisations et prêt n’en portent pas',
    [true, true, true], ['ASSUR', 'COTIS', 'PRET'].map(c => FIN.sansTvaDe(c)));
  verifier('un abonnement, si', false, FIN.sansTvaDe('ABO'));
  await parBarre(t, 'argent');
  t.clic('[data-vue="charges"]'); await t.pause(250);
  t.clic('#chg-nouvelle'); await t.pause(300);
  /* Le formulaire ouvre sur « Assurance » : le taux doit déjà être fermé. */
  verifier('le champ TVA est fermé d’entrée', true, t.$('#cg-taux').disabled);
  verifier('et à zéro', '0', t.$('#cg-taux').value);
  t.choisir('#cg-cat', 'ABO'); await t.pause(150);
  verifier('il se rouvre sur un abonnement', false, t.$('#cg-taux').disabled);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charge fixe : le formulaire ne propose que ce qui tombe seul', async () => {
  const t = await ouvrir(VIDE);
  const FIN = t.w.BCF;
  const noms = FIN.categoriesFixes().map(x => x.n);
  /* Une fourniture ne se prélève pas tous les mois. */
  verifierVrai('« Achats de fourniture » n’est pas proposé', noms.indexOf('Achats de fourniture') < 0);
  verifierVrai('« Consommable » non plus', noms.indexOf('Consommable') < 0);
  ['Assurance', 'Abonnement, logiciel', 'Frais bancaires', 'Prêt, crédit'].forEach(n =>
    verifierVrai('« ' + n +' » est proposé', noms.indexOf(n) >= 0));
  /* Une charge saisie avant ce tri doit rester lisible dans son formulaire. */
  verifierVrai('une catégorie déjà posée est conservée',
    FIN.categoriesFixes('FOURN').map(x => x.c).indexOf('FOURN') >= 0);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Écran de démarrage : il s’affiche, et un appui le fait sauter', async () => {
  /* Trois secondes, parce que l'application ne rend la main qu'au bout de
     2,4 : à 1,2 s l'écran serait déjà parti quand on vient le regarder. */
  const t = await ouvrir(Object.assign({}, VIDE, { cfg: { demarrageDuree: 3 } }));
  const e = t.$('#demarrage');
  verifierVrai('l’écran est là au démarrage à froid', e && !e.classList.contains('parti'));
  verifier('il porte le nom', 'Sylve', t.texte('.dem-nom'));
  verifier('et la phrase retenue', 'Gestion et terrain, à portée de main', t.texte('.dem-sous'));
  /* Les mains sont prises et l'écran ne sert qu'à faire joli : il ne doit
     jamais retenir quelqu'un qui veut entrer. */
  e.click();
  verifierVrai('un appui le fait sauter', e.classList.contains('parti'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Écran de démarrage : réglé sur zéro, il n’apparaît pas du tout', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { cfg: { demarrageDuree: 0 } }));
  const e = t.$('#demarrage');
  verifierVrai('l’écran reste effacé', e && e.classList.contains('parti'));
  /* Sans fondu : désactivé, il ne doit pas s'effacer sous les yeux au
     lancement — il ne doit pas avoir existé. */
  verifierVrai('et sans transition, donc invisible', e.classList.contains('sec'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Écran de démarrage : le curseur des réglages mène la durée', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { cfg: { demarrageDuree: 2 } }));
  verifier('le curseur porte la durée enregistrée', '2', t.$('#r-dem').value);
  verifier('elle est écrite en clair à côté', '2 s', t.texte('#r-dem-val'));
  t.choisir('#r-dem', '0'); await t.pause(250);
  verifier('à zéro, le réglage dit « aucun »', 'aucun', t.texte('#r-dem-val'));
  verifier('et la configuration a suivi', 0, t.stock('cfg').demarrageDuree);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Cocher une case et prévenir l'application, comme le ferait un doigt. */
const cocher = (t, sel, v) => {
  const e = t.$(sel); if (!e) return false;
  e.checked = v;
  e.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  return true;
};
/* Les intitulés d'un <select>, dans l'ordre. */
const options = (t, sel) => [...t.$(sel).options].map(o => o.textContent);

scenario('Devis : la case commande les étapes, et les mots qu’elles portent', async () => {
  /* Tout chantier ne part pas d'un devis. « Devis à envoyer » et « Sans
     suite » ne veulent alors rien dire : les étapes de devis sortent de la
     liste, et « Accepté » redevient « À planifier ». */
  /* La case vit dans le bloc « Le devis » de la fiche, et les étapes dans le
     formulaire de statut : la propriété traverse maintenant deux écrans. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', aDevis: true,
      lignes: [], temps: [], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);

  const etapes = async () => {
    t.clic('#f-statut'); await t.pause(300);
    const l = t.$$('[data-setstatut]').map(b => b.textContent.replace(/actuel/, '').trim());
    t.clic('#modale-x'); await t.pause(200);
    return l;
  };
  let l = await etapes();
  verifierVrai('« Devis à envoyer » est proposé', l.indexOf('Devis à envoyer') >= 0);
  verifierVrai('« Devis signé, à programmer » aussi', l.indexOf('Devis signé, à programmer') >= 0);
  verifierVrai('et « Devis refusé »', l.indexOf('Devis refusé') >= 0);

  t.clic('#f-devis'); await t.pause(350);
  verifierVrai('la case est cochée sur ce chantier', t.$('#dv-a').checked);
  verifierVrai('les champs du devis sont visibles', t.$('#dv-bloc').style.display !== 'none');
  cocher(t, '#dv-a', false); await t.pause(250);
  verifier('les champs du devis sont masqués', 'none', t.$('#dv-bloc').style.display);
  t.clic('#dv-ok'); await t.pause(450);
  verifier('la réponse est enregistrée', false, (t.stock('chantiers') || [])[0].aDevis);

  l = await etapes();
  verifier('sans devis, six étapes restent', 6, l.length);
  verifierVrai('« Devis à envoyer » a disparu', l.indexOf('Devis à envoyer') < 0);
  verifierVrai('« Devis envoyé » aussi', l.indexOf('Devis envoyé') < 0);
  verifierVrai('« À programmer » a pris la place de « Devis signé »', l.indexOf('À programmer') >= 0);
  verifierVrai('et « Sans suite » celle de « Devis refusé »', l.indexOf('Sans suite') >= 0);

  t.clic('[data-vue="carnet"]'); await t.pause(300);
  /* La ligne V2 dit la situation (lot b2) : « Sans devis · à programmer ». */
  verifierVrai('et la ligne du carnet dit « à programmer », sans devis',
    /Sans devis · à programmer/.test(t.$('#liste-chantiers').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis : numéro, date d’édition et validité tiennent sur la fiche', async () => {
  /* Le devis se saisit dans son bloc sur la fiche, plus à la création. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'devis', aDevis: true,
      lignes: [], temps: [], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-devis'); await t.pause(350);
  /* Il ne tape que le chiffre : les zéros et le préfixe se posent seuls. */
  t.saisir('#ce-numdevis-an', '2026');
  t.saisir('#ce-numdevis-rg', '14'); await t.pause(100);
  verifierVrai('l’aperçu montre le numéro complet',
    /D-2026-0014/.test(t.texte('#ce-numdevis-vu')));
  t.choisir('#ce-datedevis', '2026-01-31'); await t.pause(150);
  verifier('30 jours proposés sur un devis neuf', '30', t.$('#ce-validite').value);
  t.choisir('#ce-validite', '28'); await t.pause(200);

  /* Lot r1b : la validité se dit en jours. Édité un 31 janvier, valable 28
     jours : jusqu'au 28 février. */
  verifier('la fin de validité est annoncée en clair',
    'Valable 28 jours, jusqu’au 28/02/2026.', t.texte('#ce-validite-fin'));

  t.clic('#dv-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le numéro est retenu, complété à quatre chiffres', 'D-2026-0014', c.numeroDevis);
  verifier('la validité aussi, en jours', 28, c.validiteJours);
  verifier('et la date d’édition', '2026-01-31', jourISO(c.dateDevis));
  verifierVrai('la fiche affiche le numéro du devis',
    /D-2026-0014/.test(t.$('#vue-chantier').textContent));
  verifierVrai('et jusqu’à quand il vaut',
    /jusqu’au 28\/02\/2026/.test(t.$('#vue-chantier').textContent));

  /* Décoché, plus de devis : garder un numéro ferait ressortir un fantôme. */
  t.clic('#f-devis'); await t.pause(350);
  cocher(t, '#dv-a', false); await t.pause(200);
  t.clic('#dv-ok'); await t.pause(450);
  const c2 = (t.stock('chantiers') || [])[0];
  verifier('décocher efface le numéro', '', c2.numeroDevis);
  verifier('et la date', null, c2.dateDevis);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis en attente : c’est la validité qui appelle, et l’accueil qui le dit', async () => {
  const ilYa = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d.getTime(); };
  const devis = (id, nom, jours, mois) => ({ id, nom, statut: 'envoye', aDevis: true,
    lignes: [], temps: [], dateEnvoi: ilYa(jours), dateDevis: ilYa(jours),
    validiteDevis: mois, maj: ilYa(jours) });

  /* Valable trente jours, édité il y a trente jours : c'est le jour (lot r1b,
     plus de préavis). */
  const t = await ouvrir(Object.assign({}, VIDE, { chantiers: [Object.assign(devis('c1', 'Vaux', 30, null), { validiteJours: 30 })] }));
  /* Lot 5b : la ligne « Relancer le devis ? » de Bientôt. */
  verifierVrai('Aujourd’hui annonce le devis en attente',
    /Relancer le devis/.test(texteLignes(t, 'relancer:c1')));
  verifierVrai('il est nommé', /Vaux/.test(texteLignes(t, 'relancer:c1')));
  verifierVrai('et l’avis parle de validité, pas du jour de l’envoi',
    /valable/.test(texteLignes(t, 'relancer:c1')));

  /* Le même devis avec un an de validité : rien à relancer aujourd'hui. */
  const loin = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis('c1', 'Vaux', 85, 12)] }));
  verifier('un devis encore largement valable ne remonte pas',
    '', texteLignes(loin, 'relancer:'));

  /* Passée la date, l'avis durcit. */
  const fini = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis('c1', 'Vaux', 200, 3)] }));
  verifierVrai('un devis expiré le dit', /expiré/.test(texteLignes(fini, 'relancer:c1')));

  /* Sans validité saisie, la validité par défaut des réglages (30 j) :
     envoyé il y a quarante jours, il a expiré il y a dix. */
  const sansVal = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'envoye', aDevis: true, lignes: [], temps: [],
      dateEnvoi: ilYa(40), maj: ilYa(40) }]
  }));
  verifierVrai('faute de validité, celle des réglages parle',
    /devis expiré le/.test(texteLignes(sansVal, 'relancer:c1')));

  /* Chassé d'un doigt, il s'efface jusqu'au lendemain. */
  t.clic('[data-ajmasque="relancer:c1"]'); await t.pause(200);
  verifier('un appui sur la croix le masque', '', texteLignes(t, 'relancer:'));
  /* Un devis à relancer mène à sa fiche : c'est là qu'on relance. */
  verifierVrai('et la ligne, quand elle est là, ouvre la fiche', await appuyerLigne(sansVal, 'relancer:c1') &&
    vueActive(sansVal) === 'vue-chantier');
  verifier('aucune erreur', [], t.erreurs.concat(loin.erreurs, fini.erreurs, sansVal.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Carnet : un numéro de facture retrouve son chantier, même payé', async () => {
  /* Un chantier facturé est rangé hors des « ouverts » : chercher son numéro
     et ne rien voir sortir serait le pire des deux. La recherche passe donc
     outre le filtre. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Vaux plantation', statut: 'paye', aDevis: false, lignes: [], temps: [],
        numeroFacture: 'F-2026-031', donneur: 'Cabinet Dubois', datePaiement: Date.now(), maj: Date.now() },
      { id: 'c2', statut: 'encours', aDevis: false, temps: [], proprietaire: 'Renaud',
        commune: 'Montjoie', maj: Date.now(),
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 500, nature: 'prestation' }] }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  /* Payé aujourd'hui, il est dans « Payés récemment » ; la recherche, elle,
     regarde tout le carnet. */
  verifierVrai('sans recherche, le payé est dans son groupe',
    !!t.$('[data-groupe="payes"] [data-chouvrir="c1"]'));

  t.saisir('#c-rech', 'F-2026-031'); await t.pause(250);
  const z = t.$('#liste-chantiers').textContent;
  verifierVrai('la recherche le fait sortir', /Vaux plantation/.test(z));
  verifierVrai('et elle écarte l’autre', !/Renaud/.test(z));
  verifierVrai('elle dit sur quoi elle a cherché', /1 chantier sur 2/.test(z));

  /* Les accents et les majuscules ne comptent pas, et deux mots peuvent
     tomber dans deux champs différents. */
  t.saisir('#c-rech', 'montjoie'); await t.pause(250);
  verifierVrai('une commune en minuscules suffit',
    /Renaud/.test(t.$('#liste-chantiers').textContent));
  t.saisir('#c-rech', 'dubois vaux'); await t.pause(250);
  verifierVrai('deux mots dans deux champs se retrouvent',
    /Vaux plantation/.test(t.$('#liste-chantiers').textContent));
  t.saisir('#c-rech', 'zzz'); await t.pause(250);
  verifierVrai('et rien qui corresponde se dit',
    /Rien qui corresponde/.test(t.$('#liste-chantiers').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Facturé : le numéro est demandé là où on bascule', async () => {
  /* Il vivait dans l'en-tête, six champs plus haut : au moment de passer en
     « Facturé » on n'allait pas l'y chercher. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'termine', aDevis: false, lignes: [], temps: [],
      dateFin: Date.now(), maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  /* Le bouton Statut des lignes est parti (R2) : « Corriger l'étape à la main ». */
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-statut'); await t.pause(300);
  t.clic('[data-setstatut="facture"]'); await t.pause(350);

  verifierVrai('le numéro est demandé aussitôt', t.$('#nf-num-rg'));
  /* Aucune facture encore : le rang proposé est le premier de l'année. */
  verifier('et le suivant est proposé', '1', t.$('#nf-num-rg').value);
  t.saisir('#nf-num-an', '2026');
  t.saisir('#nf-num-rg', '44'); await t.pause(100);
  t.clic('#nf-ok'); await t.pause(400);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le statut a changé', 'facture', c.statut);
  verifier('et le numéro est posé', 'F-2026-0044', c.numeroFacture);

  /* Déjà renseigné, on ne redemande pas. */
  await parBarre(t, 'chantiers');
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-statut'); await t.pause(300);
  t.clic('[data-setstatut="paye"]'); await t.pause(400);
  verifier('rien n’est redemandé quand le numéro est là', null, t.$('#nf-num-rg'));
  verifier('le statut a bien suivi', 'paye', (t.stock('chantiers') || [])[0].statut);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis : l’historique repris du carnet n’en avait pas', async () => {
  /* Les chantiers convertis du classeur comptable sont tous facturés,
     sans devis. Les compter comme des devis gagnés fausserait le taux de
     réussite, et « Devis refusé » n'aurait aucun sens sur eux. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Repris du carnet', statut: 'paye', lignes: [], temps: [],
        numeroFacture: 'F-2025-007', datePaiement: Date.now(), maj: Date.now() },
      { id: 'c2', nom: 'Devis en cours', statut: 'envoye', lignes: [], temps: [],
        dateEnvoi: Date.now(), maj: Date.now() }
    ]
  }));
  const ch = t.stock('chantiers') || [];
  const par = id => ch.filter(x => x.id === id)[0];
  verifier('le chantier repris est marqué sans devis', false, par('c1').aDevis);
  verifier('celui passé par « devis envoyé » en a un', true, par('c2').aDevis);
  verifier('la migration ne se rejoue pas', true, t.stock('cfg').devisMigres);

  /* Le taux de réussite ne compte que ce qui a été proposé. */
  const tr = t.w.BCF.tauxReussite(ch, t.w.BCC.aDevis);
  verifier('un seul devis proposé', 1, tr.proposes);
  verifier('et aucun tranché', 0, tr.gagnes + tr.perdus);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charges : la case décide une fois, les dépenses suivent toutes seules', async () => {
  /* Le pointage mensuel a disparu : ce qui doit entrer dans les dépenses se
     décide sur la charge, et les échéances déjà passées y entrent d'elles-
     mêmes depuis le premier paiement. C'est la TVA qu'on récupère. */
  const an = new Date().getFullYear();
  const auj = new Date();
  const debut = new Date(an, 0, 1, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    charges: [
      { id: 'g1', libelle: 'Logiciel', beneficiaire: 'l’éditeur', ttc: 12, periodicite: 'mensuel',
        categorie: 'ABO', taux: 20, dansDepenses: true, debut: debut, jour: 1, moisReference: 0 },
      { id: 'g2', libelle: 'Prêt matériel', beneficiaire: 'la banque', ttc: 385, periodicite: 'mensuel',
        categorie: 'PRET', taux: 0, dansDepenses: false, debut: debut, jour: 1, moisReference: 0 },
      /* Prélevée le quantième du jour, et démarrée ce mois-ci : sa seule
         échéance tombe aujourd'hui. Elle est horodatée à midi, et la borne
         était le début du jour — le prélèvement du jour même restait donc
         « à venir » toute la journée et n'entrait que le lendemain. */
      { id: 'g3', libelle: 'Assurance du jour', beneficiaire: 'l’assureur', ttc: 60,
        periodicite: 'mensuel', categorie: 'ABO', taux: 20, dansDepenses: true,
        debut: new Date(auj.getFullYear(), auj.getMonth(), 1, 12).getTime(),
        jour: auj.getDate(), moisReference: 0 }
    ]
  }));
  const auto = () => (t.stock('depenses') || []).filter(d => d.auto && d.charge === 'g1');
  const toutAuto = () => (t.stock('depenses') || []).filter(d => d.auto);
  /* Le prélèvement tombe le 1er : toutes les échéances de l’année en cours
     sont donc passées, quel que soit le jour où le test tourne. Avec le 5, ce
     compte n’était juste que du 5 au 31 — vert hier, rouge ce matin, un 1er.
     Un test qui dépend du quantième ne dit la vérité qu’une fois sur deux. */
  const mois = new Date().getMonth() + 1;
  verifier('une dépense par échéance passée du logiciel', mois, auto().length);
  verifierVrai('toutes rattachées à leur charge',
    toutAuto().every(d => d.charge === 'g1' || d.charge === 'g3'));
  verifierVrai('le prêt n’en crée aucune', !toutAuto().some(d => d.charge === 'g2'));
  verifierVrai('la catégorie de la charge est reprise',
    auto().every(d => d.lignes[0].categorie === 'ABO'));
  verifierVrai('et son taux de TVA', auto().every(d => d.lignes[0].taux === 20));
  /* Rien au-delà d'aujourd'hui : on ne paie pas une échéance à venir. */
  const finDuJour = new Date(new Date().setHours(23, 59, 59, 999)).getTime();
  verifierVrai('aucune échéance future n’est comptée',
    toutAuto().every(d => d.date <= finDuJour));
  /* Et celle qui tombe aujourd'hui est arrivée : elle compte. */
  const duJour = toutAuto().filter(d => d.charge === 'g3');
  verifier('l’échéance du jour même est comptée, une fois', 1, duJour.length);
  verifierVrai('et elle est datée d’aujourd’hui',
    duJour.length === 1 && jourISO(duJour[0].date) === jourISO(Date.now()));

  /* Corriger le montant corrige les dépenses, sans en créer de nouvelles. */
  t.clic('[data-vue="charges"]'); await t.pause(250);
  t.clic('[data-chgmod="g1"]'); await t.pause(300);
  t.saisir('#cg-ttc', '24');
  t.clic('#cg-ok'); await t.pause(500);
  verifier('le nombre de dépenses ne bouge pas', mois, auto().length);
  verifierVrai('mais le montant a suivi', auto().every(d => d.lignes[0].ttc === 24));

  /* Décocher retire les dépenses automatiques, et elles seules. */
  t.clic('[data-chgmod="g1"]'); await t.pause(300);
  const dep = t.$('#cg-dep');
  dep.checked = false;
  dep.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  t.clic('#cg-ok'); await t.pause(500);
  verifier('décocher les retire toutes', 0, auto().length);
  verifierVrai('sans toucher à celles d’une autre charge',
    toutAuto().some(d => d.charge === 'g3'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charges : une échéance pointée à la main n’est jamais comptée deux fois', async () => {
  /* Garde essentielle : l'ancien pointage manuel a laissé des dépenses en
     base. Les recréer automatiquement doublerait la TVA déduite. */
  const an = new Date().getFullYear();
  const debut = new Date(an, 0, 1, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    charges: [{ id: 'g1', libelle: 'Logiciel', ttc: 12, periodicite: 'mensuel',
      categorie: 'ABO', taux: 20, dansDepenses: true, debut: debut, jour: 1, moisReference: 0 }],
    depenses: [{ id: 'd1', date: debut, charge: 'g1', fournisseur: 'l’éditeur',
      lignes: [{ libelle: 'Logiciel', categorie: 'ABO', ttc: 12, taux: 20 }] }]
  }));
  const toutes = t.stock('depenses') || [];
  const surJanvier = toutes.filter(d => new Date(d.date).getMonth() === 0);
  verifier('janvier ne porte qu’une seule dépense', 1, surJanvier.length);
  verifierVrai('c’est celle qui avait été pointée à la main', !surJanvier[0].auto);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charge fixe : la TVA devient obligatoire dès qu’on porte en dépense', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  t.clic('[data-vue="charges"]'); await t.pause(250);
  t.clic('#chg-nouvelle'); await t.pause(300);

  /* Une catégorie sans TVA ferme le champ et change le libellé du montant :
     sans TVA, il n'y a ni HT ni TTC, juste un montant. */
  t.choisir('#cg-cat', 'PRET'); await t.pause(150);
  verifierVrai('le taux est verrouillé sur un prêt', t.$('#cg-taux').disabled);
  verifier('le libellé ne parle plus de TTC', 'Montant (€)', t.texte('#cg-ttc-lab'));
  verifier('et la case des dépenses se décoche', false, t.$('#cg-dep').checked);

  t.choisir('#cg-cat', 'ABO'); await t.pause(150);
  verifierVrai('sur un abonnement le taux s’ouvre', !t.$('#cg-taux').disabled);
  verifier('le libellé redevient TTC', 'Montant TTC (€)', t.texte('#cg-ttc-lab'));
  verifier('et la case se recoche', true, t.$('#cg-dep').checked);
  verifierVrai('le taux manquant est signalé en rouge',
    /B4231F|rgb\(180, 35, 31\)/.test(t.$('#cg-taux').style.borderColor || ''));

  /* Enregistrer sans taux est refusé : une dépense à 0 % ne récupère rien. */
  t.saisir('#cg-lib', 'Cartographie');
  t.saisir('#cg-ttc', '96');
  t.choisir('#cg-debut', '2026-01-05');
  t.clic('#cg-ok'); await t.pause(300);
  verifier('rien n’est enregistré sans le taux', 0, (t.stock('charges') || []).length);

  t.choisir('#cg-taux', '20'); await t.pause(150);
  verifierVrai('le rouge s’en va', !/B4231F|rgb\(180, 35, 31\)/.test(t.$('#cg-taux').style.borderColor || ''));
  t.clic('#cg-ok'); await t.pause(400);
  verifier('avec le taux, la charge passe', 1, (t.stock('charges') || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charges fixes : deux graphiques, et le jour du prélèvement en clair', async () => {
  const an = new Date().getFullYear();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    charges: [
      { id: 'g1', libelle: 'Prêt matériel', ttc: 385, periodicite: 'mensuel', categorie: 'PRET',
        taux: 0, debut: new Date(an, 0, 5, 12).getTime(), jour: 5, moisReference: 0 },
      { id: 'g2', libelle: 'Assurance RC pro', ttc: 480, periodicite: 'annuel', categorie: 'ASSUR',
        taux: 0, debut: new Date(an, 2, 15, 12).getTime(), jour: 15, moisReference: 2 }
    ]
  }));
  /* Lot d1 : Argent ▸ Dépenses, bloc Charges fixes ; les deux graphiques
     sont dans « Prélèvements à venir », l'ancienne carte Échéances. */
  await parBarre(t, 'argent');
  t.clic('[data-vue="depenses"]'); await t.pause(300);
  const z = t.$('#charges-resume'), zp = t.$('#charges-echeances');
  verifierVrai('le graphique des douze mois est là', /Quand l’argent part/.test(zp.textContent));
  verifierVrai('la répartition par catégorie aussi', /Où il part/.test(zp.textContent));
  verifierVrai('sous le titre Prélèvements à venir', /^Prélèvements à venir/.test(t.texte('#dep-prelevements')));
  verifierVrai('les bâtons sont empilés par catégorie',
    zp.querySelectorAll('svg rect[fill="#8A5A2B"]').length > 1);
  verifierVrai('l’assurance a sa propre couleur',
    zp.querySelectorAll('svg rect[fill="#1D6FB8"]').length === 1);

  /* Le jour du prélèvement, pas « tous les mois ». */
  verifierVrai('le jour du mois est écrit', /le 5 de chaque mois/.test(z.textContent));
  verifierVrai('et la date de l’annuelle', /le 15 mars de chaque année/.test(z.textContent));

  /* Un appui sur un mois écrit son détail, sans refaire l'écran. */
  verifierVrai('le détail annonce d’abord le mois le plus chargé',
    /mars/.test(t.texte('#chg-mois-detail')));
  /* La zone tactile d'un mois est un <rect> SVG. Un doigt le touche et
     l'événement remonte, mais SVGElement n'a pas de .click() : on envoie donc
     un vrai clic qui bouillonne, comme le ferait le pouce. */
  const rect = t.$('[data-chgmois="6"]');
  rect.dispatchEvent(new t.w.MouseEvent('click', { bubbles: true }));
  await t.pause(200);
  verifierVrai('appuyer sur juillet écrit juillet',
    /juillet/.test(t.texte('#chg-mois-detail')));
  verifierVrai('avec le pourcentage par catégorie',
    /%/.test(t.texte('#chg-mois-detail')));
  verifierVrai('plus rien à pointer', !t.$('[data-chgpay]'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Entreprise : chaque bulle d’« Où j’en suis » a son endroit, et y mène', async () => {
  /* Les six bulles de Mon entreprise sont parties au lot 5b. Chacune a son
     endroit, dit par la table de correspondance (§ 2) : on le vérifie bulle
     par bulle, sur les données qui les faisaient parler. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [
      { id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [{ travail: 'PLANT', unite: 'plant',
        quantite: 1000, prix: 0.5, nature: 'prestation' }], temps: [], joursEstimes: 4,
        jours: [{ d: Date.now(), p: 1 }], maj: Date.now() },
      { id: 'c2', nom: 'Les Essarts', statut: 'encours', lignes: [], temps: [], maj: Date.now() },
      { id: 'c3', commune: 'Montjoie', statut: 'facture', lignes: [{ travail: 'DEGAG', unite: 'ha',
        quantite: 2, prix: 900, nature: 'prestation' }], temps: [], donneur: 'Cabinet Dubois',
        numeroFacture: 'F-9', dateFacture: Date.now() - 70 * 86400000, maj: Date.now() }
    ],
    depenses: [{ id: 'd1', date: Date.now(),
      lignes: [{ libelle: 'Gasoil', categorie: 'CONSO', ttc: 120, taux: 20 }] }]
  }));
  verifier('plus d’écran Mon entreprise', null, t.$('#vue-entreprise'));
  /* Journées à planifier : une posée sur quatre estimées, il en reste trois.
     Devis signés : la même ligne, signé veut dire à programmer. */
  /* Lot r1 : « À programmer » est parti d'Aujourd'hui (retrait accepté le
     03/11) ; le devis signé se lit sur sa ligne de Chantiers en cours, à
     l'étape Travaux, et l'estimation reste dans la fiche. */
  verifierVrai('le devis signé → Chantiers en cours, « … à programmer »',
    /· à programmer/.test(t.texte('#aj-encours [data-ajch="c1"]') || ''));
  verifierVrai('plus de « N j à placer » sur Aujourd’hui', !/à placer/.test(t.texte('#vue-accueil')));
  verifierVrai('chantiers en cours → leur bloc', /Les Essarts/.test(t.texte('#aj-encours')));
  /* Factures en attente, et combien en retard : la ligne Facture impayée,
     avec ce qu'en disait la bulle et « À traiter » — nom, montant, ancienneté,
     donneur d'ordre. */
  const imp = texteLignes(t, 'impaye:c3');
  verifierVrai('facture en retard → En retard « Facture impayée »', /Facture impayée/.test(imp));
  verifierVrai('nommée', /Montjoie/.test(imp));
  verifierVrai('avec son montant, qui ne se coupe pas',
    /1 800 €/.test(lignesAuj(t, 'impaye:c3')[0].textContent));
  verifierVrai('depuis combien de temps', /70 j/.test(imp));
  verifierVrai('et par qui il passe', /Cabinet Dubois/.test(imp));
  /* « 1 en retard » : une seule facture parmi les lignes d'En retard (la
     sauvegarde, jamais faite ici, en est une autre). */
  verifier('une seule facture en retard', 1, t.$$('#aj-retard [data-ajcle^="impaye:"]').length);
  /* « À traiter » du carnet garde l'impayé, avec les mêmes mots qu'avant. */
  const at = (t.$('[data-groupe="faire"] [data-chouvrir="c3"]') || {}).textContent || '';
  verifierVrai('« À traiter » le nomme toujours', /Montjoie/.test(at) && /1 800/.test(at) &&
    !/1 800/.test(at) && /70 jours/.test(at) && /Cabinet Dubois/.test(at));
  /* Chiffre d'affaires et TVA déductible : le même calcul que les bulles
     (année civile), lu dans Argent ▸ TVA et Argent ▸ Année, qui s'ouvrent
     sur l'année (lot d1 ; Argent ▸ Bilan jusqu'en 4.94). */
  const FIN = t.w.BCF, C = t.w.BCC, E = t.w.BC;
  const b = FIN.bornes('annee', new Date().getFullYear(), 0);
  const ca = FIN.chiffreAffaires(t.stock('chantiers'), b).total;
  const ded = FIN.balanceTva(t.stock('chantiers'), t.stock('depenses'), b, C.tauxLigne).deductible.total;
  const eur = v => E.fmt(C.arr(v, 2), v % 1 ? 2 : 0).replace(/ /g, ' ') + ' €';
  await parBarre(t, 'argent');
  t.clic('[data-vue="tva"]'); await t.pause(250);
  verifierVrai('la TVA déductible de la bulle (' + eur(ded) + ') est dans Argent ▸ TVA',
    ded > 0 && sansBlancs(t.texte('#tva-corps [data-tva="deductible"]')) === sansBlancs('− ' + eur(ded)));
  t.clic('[data-vue="analyses"]'); await t.pause(250);
  verifierVrai('le chiffre d’affaires de la bulle (' + eur(ca) + ') dans Argent ▸ Année',
    !ca || sansBlancs(t.texte('#ana-corps')).indexOf(sansBlancs(eur(ca) + 'facturé HT')) >= 0);
  /* Chaque ligne mène quelque part : l'impayé à sa fiche. */
  await parBarre(t, 'aujourdhui');
  await appuyerLigne(t, 'impaye:c3');
  verifierVrai('la ligne de l’impayé ouvre sa fiche', t.$('#vue-chantier').classList.contains('actif'));
  verifierVrai('et c’est la bonne', /Montjoie/.test(t.texte('#vue-chantier')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Mes notes : dans ☰ ▸ Mes notes, des éléments à cocher', async () => {
  /* « Chantier à prévoir : il faudrait que je puisse avoir plus de place, ou
     faire des retours à la ligne » — puis, en 4.85, « comme une liste de
     courses » : chaque élément a sa case. Au lot 5b, elles quittent Mon
     entreprise pour Aujourd'hui ; au lot r1, elles ont leur écran, ☰ ▸ Mes
     notes, avec exactement les mêmes gestes ; une note se crée par le +. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'devis', aDevis: true, lignes: [], temps: [], maj: Date.now() }] }));
  const zone = () => t.$('#aj-notes');
  verifierVrai('plus rien de Mes notes sur Aujourd’hui', !t.$('#vue-accueil #aj-notes') &&
    !/Mes notes/.test(t.texte('#vue-accueil')));
  verifierVrai('le ☰ les ouvre', await parMenu(t, 'notes'));
  verifier('sur leur écran', 'vue-notes', vueActive(t));
  verifier('titré', 'Mes notes', t.texte('#b-ecran'));
  verifierVrai('le retour ramène au ☰, comme les autres écrans du menu',
    !t.$('#b-retour').hidden && /Le reste de Sylve/.test(t.$('#b-retour').getAttribute('aria-label')));
  const base = () => ((t.stock('cfg') || {}).notes || []);
  const entrer = async (v) => {
    const c = t.$('[data-nt-ajout]'); c.value = v;
    c.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await t.pause(250);
  };
  verifierVrai('la zone invite à s’écrire une note, par le +', /Le \+ en bas ▸ Note/.test(zone().textContent));

  await plusNote(t);
  t.saisir('#nt-titre', 'Chantiers à prévoir');
  t.clic('[data-ntcoul="#B4231F"]'); await t.pause(120);
  t.clic('#nt-ok'); await t.pause(400);
  verifier('une note est en base', 1, base().length);
  verifierVrai('la note s’affiche', /Chantiers à prévoir/.test(zone().textContent));
  verifierVrai('avec sa couleur', /B4231F|rgb\(180, 35, 31\)/.test(zone().innerHTML));

  /* Saisie rapide : Entrée crée l'élément et garde le champ pour le suivant. */
  await entrer('Coupe du haut');
  await entrer('Plantation au printemps');
  await entrer('Rappeler le gestionnaire');
  verifier('trois éléments', ['Coupe du haut', 'Plantation au printemps', 'Rappeler le gestionnaire'],
    base()[0].items.map(x => x.texte));
  verifier('le champ attend le suivant', 'INPUT', t.d.activeElement.tagName);
  verifier('et il est vide', '', t.$('[data-nt-ajout]').value);
  await entrer('   ');
  verifier('un champ vide ne crée rien', 3, base()[0].items.length);

  /* Cocher : barré, et il descend en bas de la note. */
  const premier = base()[0].items[0].id;
  const coche = t.$('[data-nt-coche="' + premier + '"]');
  coche.checked = true; coche.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(250);
  verifier('coché en base', true, base()[0].items[0].fait);
  const textes = () => t.$$('#aj-notes .note-i .note-texte').map(e => e.textContent);
  verifier('il descend en bas', ['Plantation au printemps', 'Rappeler le gestionnaire', 'Coupe du haut'], textes());
  verifierVrai('et il est barré', /line-through/.test(
    t.w.getComputedStyle(t.$('#aj-notes .note-i.fait .note-texte')).textDecoration) ||
    t.$('#aj-notes .note-i.fait'));

  /* Décocher le remet à sa place. */
  const c2 = t.$('[data-nt-coche="' + premier + '"]');
  c2.checked = false; c2.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(250);
  verifier('décoché, il remonte', 'Coupe du haut', textes()[0]);

  /* Supprimer un élément. */
  t.clic('[data-nt-supitem="' + premier + '"]'); await t.pause(250);
  verifier('un élément de moins', 2, base()[0].items.length);

  /* Le titre se rouvre pour être corrigé, sans toucher aux éléments. */
  t.clic('[data-note]'); await t.pause(300);
  t.saisir('#nt-titre', 'Chantiers à venir');
  t.clic('#nt-ok'); await t.pause(400);
  verifierVrai('la correction est prise', /Chantiers à venir/.test(zone().textContent));
  verifier('sans en créer une seconde', 1, base().length);
  verifier('et les éléments restent', 2, base()[0].items.length);

  /* Supprimer la note : elle passe par la corbeille, et revient. */
  t.w.confirm = () => true;
  t.clic('[data-notesup]'); await t.pause(450);
  verifier('plus aucune note', 0, base().length);
  verifierVrai('et la zone le dit', /Le \+ en bas ▸ Note/.test(zone().textContent));
  t.clic('#s-recuperer'); await t.pause(450);
  verifierVrai('elle est dans la corbeille', /Chantiers à venir/.test(t.texte('#s-recup')));
  t.clic('[data-repecher]'); await t.pause(500);
  verifier('récupérée', 1, base().length);
  verifier('avec ses éléments', 2, base()[0].items.length);
  verifierVrai('et visible à l’écran', /Chantiers à venir/.test(zone().textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Mes notes : les anciennes notes deviennent un premier élément', async () => {
  /* Avant la 4.85 une note portait un texte seul. Rien ne doit se perdre. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    cfg: { notes: [
      { id: 'n1', titre: 'Chantiers à prévoir', texte: 'Coupe du haut\nPlantation', couleur: '#B4231F', cree: 1 },
      { id: 'n2', titre: 'Sans détail', texte: '', couleur: '#1F5FA9', cree: 2 }
    ] }
  }));
  const z = t.$('#aj-notes');
  verifier('deux notes', 2, t.$$('#aj-notes .note-c').length);
  const items = t.$$('#aj-notes [data-note-id="n1"] .note-i');
  verifier('un seul élément repris', 1, items.length);
  verifierVrai('avec tout l’ancien texte', /Coupe du haut/.test(items[0].textContent) &&
    /Plantation/.test(items[0].textContent));
  verifier('non coché', false, items[0].querySelector('input').checked);
  verifier('une note sans détail n’a aucun élément', 0, t.$$('#aj-notes [data-note-id="n2"] .note-i').length);
  /* Et la première écriture garde la forme nouvelle, sans l'ancien champ. */
  t.$('[data-nt-ajout="n2"]').value = 'Appeler';
  t.$('[data-nt-ajout="n2"]').dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await t.pause(300);
  const n = (t.stock('cfg') || {}).notes;
  verifier('l’ancien texte est parti dans les éléments', [undefined, undefined], n.map(x => x.texte));
  verifier('le premier élément est gardé en base', 'Coupe du haut\nPlantation', n[0].items[0].texte);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : « Ce qui a changé » en bas de Général, la corbeille s’explique', async () => {
  const t = await ouvrir(Object.assign({}, VIDE));
  /* Le ⚙ de l'accueil est parti au lot 5b : ☰ ▸ Réglages. */
  await parMenu(t, 'reglages');
  const maj = t.$('#c-notes-maj');
  verifierVrai('la zone existe', maj);
  const autres = t.$$('#regl-corps [data-sec="general"]').filter(e => e !== maj && !e.contains(maj));
  const dernier = autres.filter(e => !(e.dataset.sous === 'maj'));
  verifierVrai('elle vient après toutes les autres cartes de Général',
    dernier.every(e => e.compareDocumentPosition(maj) & 4));
  t.clic('#s-recuperer'); await t.pause(450);
  verifierVrai('la corbeille dit ce qu’elle fait',
    /Ce que vous supprimez arrive ici/.test(t.texte('#s-recup')) &&
    /restaurer pendant 30 jours/.test(t.texte('#s-recup')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Onglets : plus aucun module ne se réduit à un onglet solitaire', async () => {
  /* Analyses était le seul cas, et un onglet unique étiré sur la largeur ne
     propose rien. Elle est devenue un onglet de Finances : la règle se vérifie
     donc sur tous les modules à la fois. Ce contrôle criera le jour où un
     module à vue unique réapparaîtra. */
  const modules = ['cubage', 'chantiers', 'calendrier', 'rendements',
    'finances', 'stock', 'bois'];
  for (const mod of modules) {
    const t = await ouvrir(Object.assign({}, VIDE, { module: mod }));
    const n = t.$$('#onglets button').length;
    /* Zéro est permis : une vue seule ne montre aucune pastille (lot b2). */
    verifierVrai(mod + ' : ' + n + ' onglets, jamais un seul', n !== 1);
    verifier(mod + ' : aucune erreur', [], t.erreurs);
  }
  /* Lot d1 : Mois · TVA · Dépenses · Année ; les charges fixes sont un bloc
     des Dépenses, les analyses sont devenues Année. */
  const t2 = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  await parBarre(t2, 'argent');
  verifier('Argent : Mois, TVA, Dépenses, Année', ['Mois', 'TVA', 'Dépenses', 'Année'],
    t2.$$('#onglets button').map(b => b.textContent.trim()));
  verifierVrai('les charges fixes ont leur bloc dans Dépenses',
    /^Charges fixes/.test(t2.texte('#vue-depenses #dep-charges')));
});

/* --------------------------------------------------------------------- */
scenario('Milliers : séparés à l’écran, jamais dans un fichier', async () => {
  const t = await ouvrir(VIDE);
  const E = t.w.BC;
  const NBSP = ' ';

  verifier('un millier se sépare', '1' + NBSP + '800,00', E.fmt(1800));
  verifier('un million aussi', '1' + NBSP + '250' + NBSP + '000', E.fmt(1250000, 0));
  verifier('en dessous du millier, rien ne change', '999,50', E.fmt(999.5));
  verifier('les décimales ne se groupent jamais', '1' + NBSP + '000,25', E.fmt(1000.25));
  verifier('un négatif garde son signe collé', '-1' + NBSP + '800', E.fmt(-1800, 0));
  /* L'espace doit être insécable : avec une ordinaire, « 1 800 € » se couperait
     en bout de ligne et se lirait comme deux nombres. */
  verifierVrai('l’espace est insécable', E.fmt(1800, 0).indexOf(NBSP) > 0);
  verifierVrai('et jamais une espace ordinaire', E.fmt(1800, 0).indexOf(' ') < 0);

  /* Ce qui part dans un tableur ne se groupe pas : une espace au milieu d'un
     nombre et la cellule cesse d'être un nombre. */
  verifier('la version brute ne groupe pas', '1800,00', E.fmtBrut(1800));
  verifier('elle garde la virgule décimale', '1800,25', E.fmtBrut(1800.25));

  /* Un nombre groupé relu dans un champ doit revenir entier : parseFloat
     s'arrêtait à l'espace et rendait 25 pour « 25 000 ». */
  const C = t.w.BCC, FIN = t.w.BCF;
  verifier('nb() retrouve le nombre groupé', 25000, C.nb('25' + NBSP + '000'));
  verifier('même avec une espace ordinaire', 25000, C.nb('25 000'));
  verifier('les finances aussi', 1800.5, FIN.nb('1' + NBSP + '800,5'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : le retour redescend là où on était, pas au menu', async () => {
  /* Les réglages sont une vue, pas un étage : le retour du bandeau lisait le
     module courant et remontait au menu du groupe. On sortait des réglages
     dans « Mon entreprise », jamais sur l'écran quitté. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  await parBarre(t, 'argent');
  t.clic('[data-vue="depenses"]'); await t.pause(250);
  verifierVrai('on part des dépenses et de leurs charges fixes', t.$('#vue-depenses').classList.contains('actif'));

  await parMenu(t, 'reglages');
  verifierVrai('les réglages sont ouverts', t.$('#vue-reglages').classList.contains('actif'));

  t.clic('#b-retour'); await t.pause(300);
  verifierVrai('on revient sur les dépenses', t.$('#vue-depenses').classList.contains('actif'));
  verifierVrai('et pas sur le menu de l’entreprise (parti au lot 5b)',
    !t.$('#vue-entreprise') && vueActive(t) === 'vue-depenses');
  verifierVrai('le masque des menus n’est pas posé',
    !t.d.body.classList.contains('accueil-ouvert'));
  /* Entré par le ☰ (lot 5a), on y revient : il se rouvre par-dessus. */
  verifier('le ☰ est rouvert', 'Le reste de Sylve', !t.$('#modale').hidden && t.texte('#modale-titre'));
  t.clic('#modale-x'); await t.pause(200);

  /* Deuxième étage : jusqu'en 4.85, le menu de la partie. Les charges sont
     maintenant dans un onglet de la barre, sans flèche : le retour du
     téléphone remonte à Aujourd'hui. */
  verifierVrai('pas de flèche sur un onglet de la barre', t.$('#b-retour').hidden);
  t.w.dispatchEvent(new t.w.PopStateEvent('popstate')); await t.pause(300);
  verifier('un second retour mène à Aujourd’hui', 'vue-accueil', vueActive(t));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Modules : Devis disparaît, Analyses devient un onglet de Finances', async () => {
  /* « Devis et estimatif » n'avait aucun écran à lui, et Analyses lisait les
     mêmes données que Finances sur la même période. Sept tuiles passent à
     cinq sans qu'un seul écran soit perdu. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  /* Une porte par module de la partie, ni plus ni moins. Les tuiles de Mon
     entreprise sont parties au lot 5b ; leur liste est celle de l'inventaire
     des écrans écrit en 4.85 (§ 2.2, « sept tuiles de modules »). On la croise
     avec ce qui les a remplacées, écrit pour naviguer : les modules de la
     barre du bas et ceux du ☰ ▸ Entreprise. Une porte oubliée comme une porte
     fantôme font crier ce contrôle. */
  const tuiles = ['chantiers', 'calendrier', 'rendements', 'stock', 'finances', 'achats', 'vehicule'];
  verifierVrai('l’inventaire nomme bien ces sept tuiles', INVENTAIRE.some(l =>
    /Sept tuiles de modules\*\* : Chantiers · Calendrier · Rendements · Stock et\s*$/.test(l)));
  verifier('plus d’écran Mon entreprise', null, t.$('#vue-entreprise'));
  const parCadre = [];
  for (const o of ['chantiers', 'agenda', 'argent']) {
    await parBarre(t, o); parCadre.push(t.stock('module'));
  }
  t.clic('#b-menu'); await t.pause(200);
  [...t.$('#modale .fn-tuiles').querySelectorAll('[data-menu]')].forEach(b => parCadre.push(b.dataset.menu));
  t.clic('#modale-x'); await t.pause(150);
  await parBarre(t, 'aujourdhui');
  verifier('une porte par module de la partie', tuiles.slice().sort(), parCadre.slice().sort());
  verifierVrai('pas de Devis', parCadre.indexOf('devis') < 0);
  verifierVrai('pas d’Analyses à part', parCadre.indexOf('analyses') < 0);

  /* Les deux écrans restent joignables, ailleurs. */
  await parBarre(t, 'argent');
  const onglets = t.$$('#onglets button').map(b => b.dataset.vue);
  verifier('Finances porte quatre onglets', 4, onglets.length);
  verifierVrai('dont Analyses', onglets.indexOf('analyses') >= 0);
  t.clic('[data-vue="analyses"]'); await t.pause(350);
  verifierVrai('l’écran d’analyses s’affiche', t.$('#vue-analyses').classList.contains('actif'));
  /* « Recettes » existait déjà, en pastille : la fusion ne l'a pas perdue. */
  verifierVrai('et sa pastille Recettes est là', t.$('[data-ana="recettes"]'));

  await parMenu(t, 'rendements');
  const ongRd = t.$$('#onglets button').map(b => b.dataset.vue);
  verifierVrai('Estimer a suivi les Rendements', ongRd.indexOf('estimer') >= 0);
  t.clic('[data-vue="estimer"]'); await t.pause(300);
  verifierVrai('l’estimation s’ouvre toujours', t.$('#vue-estimer').classList.contains('actif'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Mise à jour : un téléphone resté sur un module retiré ne tombe pas dans le cubage', async () => {
  /* Le module ouvert est gardé en mémoire. « devis » et « analyses »
     n'existent plus : sans redirection, l'application se rouvrait à l'autre
     bout, dans le cubage. */
  const surDevis = await ouvrir(Object.assign({}, VIDE, { module: 'devis' }));
  verifier('« devis » mène aux rendements', 'rendements', surDevis.stock('module'));
  const surAnalyses = await ouvrir(Object.assign({}, VIDE, { module: 'analyses' }));
  verifier('« analyses » mène aux finances', 'finances', surAnalyses.stock('module'));
  const inconnu = await ouvrir(Object.assign({}, VIDE, { module: 'chose' }));
  verifier('un module inconnu retombe sur le cubage', 'cubage', inconnu.stock('module'));
  verifier('aucune erreur', [],
    surDevis.erreurs.concat(surAnalyses.erreurs, inconnu.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Réglages : chaque zone porte son sujet, plus de fourre-tout', async () => {
  /* Une carte intitulée « Chantiers » tenait quatre sujets sans lien : la
     journée de travail, le véhicule, les relances, les week-ends. Rien ne
     disait que la consommation du fourgon se réglait là. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  await parMenu(t, 'reglages');
  t.clic('[data-regl="ent"]'); await t.pause(250);

  const zones = t.$$('#regl-corps .reg-titre[data-sec="ent"]')
    .map(p => [p.dataset.sous, p.textContent.trim()]);
  const parNom = Object.fromEntries(zones);
  verifier('la journée de travail a sa zone', 'Ma journée de travail', parNom.journee);
  verifier('le véhicule a la sienne', 'Véhicule', parNom.vehicule);
  verifier('les relances aussi', 'Relances et calendrier', parNom.alertes);
  verifierVrai('les listes déroulantes sont toujours là', !!parNom.listes);
  verifierVrai('le stock aussi', !!parNom.stock);
  verifierVrai('et le financier', !!parNom.fin);

  /* Chaque réglage est resté joignable, et sous le bon titre. */
  const dansZone = (sous, champ) => {
    const carte = t.$('#regl-corps .carte[data-sous="' + sous + '"]');
    return !!(carte && carte.querySelector(champ));
  };
  verifierVrai('les heures sont sous « Ma journée »', dansZone('journee', '#r-hj'));
  verifierVrai('le prix de journée aussi', dansZone('journee', '#r-pj'));
  verifierVrai('la consommation est sous « Véhicule »', dansZone('vehicule', '#r-l100'));
  verifierVrai('le prix du litre aussi', dansZone('vehicule', '#r-pl'));
  verifierVrai('les relances sont sous « Relances »', dansZone('alertes', '#r-rd'));
  verifierVrai('les week-ends aussi', dansZone('alertes', '#r-we'));

  /* Décision tenue depuis longtemps : pas de second niveau d'onglets. */
  verifier('aucun second niveau d’onglets', 0, t.$$('#regl-sous').length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : le bouton descend sur la zone de l’écran quitté', async () => {
  /* Il ne choisissait que l'onglet et déposait au sommet d'un défilement de
     six sujets : depuis Finances, on atterrissait sur les heures de travail. */
  /* Depuis le lot 5a, le chemin est ☰ ▸ Réglages, et la zone est celle de
     l'écran sous le ☰ : on y va d'abord, par la barre ou par le ☰. Achats et
     Véhicule s'ajoutent (tableau 5.4 de l'inventaire), et Aujourd'hui mène
     aux réglages généraux. */
  const ONGLET = { chantiers: 'chantiers', calendrier: 'agenda', finances: 'argent' };
  const vise = async (module, sectionAttendue, zoneAttendue) => {
    const t = await ouvrir(Object.assign({}, VIDE, { module: module === 'accueil' ? 'chantiers' : module }));
    const vus = [];
    t.w.Element.prototype.scrollIntoView = function () { vus.push(this); };
    if (ONGLET[module]) await parBarre(t, ONGLET[module]);
    else if (module !== 'accueil') await parMenu(t, module);
    await parMenu(t, 'reglages'); await t.pause(100);
    verifierVrai(module + ' : les réglages sont ouverts',
      t.$('#vue-reglages').classList.contains('actif'));
    const onglet = t.$$('#regl-nav .chip')
      .filter(b => b.getAttribute('aria-pressed') === 'true')[0];
    verifier(module + ' : onglet « ' + sectionAttendue + ' »', sectionAttendue,
      onglet && onglet.dataset.regl);
    if (zoneAttendue) {
      const zones = vus.map(e => e.dataset && e.dataset.sous).filter(Boolean);
      verifierVrai(module + ' : descend sur « ' + zoneAttendue + ' »',
        zones.indexOf(zoneAttendue) >= 0);
    }
    verifier(module + ' : aucune erreur', [], t.erreurs);
  };
  await vise('chantiers', 'ent', 'journee');
  await vise('calendrier', 'ent', 'alertes');
  await vise('rendements', 'ent', 'journee');
  await vise('finances', 'ent', 'fin');
  await vise('stock', 'ent', 'stock');
  await vise('achats', 'ent', 'fin');
  await vise('vehicule', 'ent', 'vehicule');
  await vise('cubage', 'cubage', null);
  await vise('bois', 'bois', null);
  await vise('accueil', 'general', null);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : les pastilles du module quitté s’effacent, la barre du bas reste', async () => {
  /* On arrivait des Finances et la barre offrait Bilan, Dépenses, Charges,
     Analyses — alors qu'aucun de ces écrans n'était affiché. Les réglages sont
     un écran de côté : on en sort par la flèche du bandeau. Depuis le lot 5a,
     ces onglets sont des pastilles en haut ; la barre du bas, elle, est la
     même partout et reste. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  await parBarre(t, 'argent');
  verifierVrai('les pastilles sont là sur Argent',
    !t.d.body.classList.contains('v-reglages') && t.$$('#onglets button').length >= 2);
  await parMenu(t, 'reglages');
  verifierVrai('les réglages sont ouverts', t.$('#vue-reglages').classList.contains('actif'));
  verifierVrai('le corps porte la marque des réglages',
    t.d.body.classList.contains('v-reglages'));
  /* jsdom ne résout pas un sélecteur descendant dans getComputedStyle : on lit
     la règle telle qu'elle a été analysée, ce qui criera si elle disparaît ou
     si elle cesse de masquer. */
  const regles = [];
  for (const feuille of t.d.styleSheets) {
    for (const r of feuille.cssRules || []) {
      if (r.selectorText && r.style) regles.push([r.selectorText, r.style.display]);
    }
  }
  const masque = regles.filter(r => /v-reglages/.test(r[0]) && /onglets/.test(r[0]));
  verifier('une règle vise les pastilles dans les réglages', 1, masque.length);
  verifier('et elle les masque', 'none', masque[0] && masque[0][1]);
  verifier('aucune règle ne masque la barre du bas', [],
    regles.filter(r => /barre/.test(r[0]) && r[1] === 'none').map(r => r[0]));
  verifierVrai('la barre est là, ses cinq boutons aussi', t.$$('#barre [data-barre]').length === 5);
  t.clic('#b-retour'); await t.pause(300);
  verifierVrai('en sortant, les pastilles reviennent',
    !t.d.body.classList.contains('v-reglages'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : les lignes tombent sur une grille, montants alignés', async () => {
  /* En rangée souple, la longueur du nom faisait danser les montants d'une
     ligne à l'autre, et les boutons étirés ne commençaient jamais au même
     endroit. */
  /* Des dates distinctes et fixes : deux appels à Date.now() peuvent différer
     d'une milliseconde, et le tri bascule alors l'ordre d'un passage à l'autre. */
  /* Le nom se compose du travail, du propriétaire et de la commune : un nom
     long se sème donc par eux, plus par un champ libre. */
  const ligne = (id, proprio, prix, jour) => ({ id, statut: 'encours', temps: [],
    maj: new Date(2026, 0, jour, 12).getTime(),
    donneur: 'Cabinet Dubois', proprietaire: proprio, commune: 'Montjoie-le-Haut',
    lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: prix, nature: 'prestation' }] });
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [ligne('c1', 'Groupement forestier de la Haute Vallée des Sources', 12000, 20),
      ligne('c2', 'Dupont', 90, 10)]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  /* Lot b2 : la ligne V2 (nom, lieu, situation à gauche ; montant HT et
     points d'étape à droite). */
  const lignes = t.$$('#liste-chantiers [data-groupe="travaux"] .aj-ch');
  verifier('deux lignes', 2, lignes.length);
  const montants = lignes.map(l => l.querySelector('.aj-droite b').textContent.trim());
  verifierVrai('le montant de chaque ligne est à part', montants.every(m => /\u20AC/.test(m)));
  verifierVrai('et il ne double pas le nom',
    !/\u20AC/.test(lignes[0].querySelector('.aj-txt > b').textContent));
  verifierVrai('le nom long est bien là',
    lignes.some(l => /Haute Vallée des Sources/.test(l.querySelector('.aj-txt > b').textContent)));
  /* Temps et Statut sont partis (R2) : un appui sur la ligne ouvre la fiche. */
  verifierVrai('plus aucun bouton dans la ligne', lignes.every(l => !l.querySelector('button')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : « ouverts » n’est pas « en cours », et un terminé se compte', async () => {
  /* « En cours » est le nom d'un statut : l'employer pour compter tout ce qui
     n'est pas soldé faisait annoncer « 3 en cours » avec un seul chantier à ce
     statut. Et « 0 € à facturer » avec un chantier terminé sans ligne chiffrée
     se lisait comme « rien à facturer ». */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'En cours', statut: 'encours', lignes: [], temps: [], maj: Date.now() },
      { id: 'c2', nom: 'Sans ligne', statut: 'termine', lignes: [], temps: [],
        dateFin: Date.now(), maj: Date.now() },
      { id: 'c3', nom: 'À planifier', statut: 'accepte', lignes: [], temps: [], maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  const tete = t.$('#carnet-totaux').textContent;
  verifierVrai('trois chantiers ouverts, dits « ouverts »', /3 chantiers ouverts/.test(tete));
  verifierVrai('le mot « en cours » ne sert plus à compter', !/3 chantiers en cours/.test(tete));
  /* Le chantier terminé n'a pas de montant, mais il se compte. */
  verifierVrai('le chantier à facturer est compté', /1 à facturer/.test(tete));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : le nom du chantier se compose et ne se tape plus', async () => {
  /* « Le titre, je ne devrais pas le choisir. Sinon je ne le modifie pas, ils
     sont tous pareils, comme ça je ne me pose plus de questions. »

     Et la cause des titres dépareillés : le nom était écrit une fois, à la
     création. Le propriétaire et la commune se remplissent souvent après, sur
     la fiche — le nom gardait ce qu'il avait au départ. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'un vieux titre tapé à la main', statut: 'encours',
      aDevis: false, temps: [], jours: [], maj: Date.now(),
      donneur: 'Cabinet Dubois', proprietaire: 'Martin', commune: 'Clairbois',
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  const nom = t.$('#liste-chantiers .aj-txt > b').textContent;
  verifier('prestation, propriétaire, commune', 'Dégagement manuel — Martin, Clairbois', nom);
  verifierVrai('l’ancien titre ne s’affiche plus',
    !/vieux titre/.test(t.$('#liste-chantiers').textContent));

  /* Rien n'a été réécrit : c'est une lecture, pas une migration. */
  verifier('la donnée n’a pas bougé', 'un vieux titre tapé à la main',
    (t.stock('chantiers') || [])[0].nom);
  /* Et il retrouve encore son chantier par le mot qu'il avait tapé. */
  t.saisir('#c-rech', 'vieux titre'); await t.pause(250);
  verifierVrai('l’ancien nom reste cherchable',
    /Dégagement manuel/.test(t.$('#liste-chantiers').textContent));
  t.saisir('#c-rech', ''); await t.pause(250);

  /* Corriger la commune corrige le nom : c'est tout l'objet. */
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-identite'); await t.pause(400);
  verifier('le champ de saisie a disparu', null, t.$('#ic-nom'));
  t.saisir('#ic-com', 'Montjoie');
  await t.pause(200);
  verifier('l’aperçu suit la frappe', 'Dégagement manuel — Martin, Montjoie',
    t.$('#ic-nom-apercu').textContent);
  t.clic('#ic-ok'); await t.pause(600);
  verifierVrai('et la fiche porte le nouveau nom',
    /Dégagement manuel — Martin, Montjoie/.test(t.texte('#vue-chantier')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : un chantier sans rien à composer garde son ancien nom', async () => {
  /* Le repli. Un chantier repris du carnet sans prestation, sans propriétaire
     et sans commune n'a rien à composer : son ancien nom vaut mieux que
     « Chantier ». C'est ce repli qui permet de ne rien réécrire. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Reprise carnet 2024', statut: 'paye', aDevis: false,
      temps: [], jours: [], lignes: [], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.choisir('#c-filtre', 'tous'); await t.pause(300);
  verifier('l’ancien nom tient lieu de nom', 'Reprise carnet 2024',
    t.$('#ch-filtre-liste .aj-txt > b').textContent);

  /* Une fourniture ne nomme pas un chantier : c'est la prestation qui parle. */
  const C0 = t.w.BCC;
  verifier('la fourniture ne prend pas la tête', 'Dégagement manuel — Martin',
    C0.nomChantier({ proprietaire: 'Martin', lignes: [
      { travail: 'F_TUTEUR' }, { travail: 'DEGAG' }] }));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : la ligne ne redit pas le propriétaire, et porte ses dates', async () => {
  /* « Il y a aussi le propriétaire qui est répété une deuxième fois. On part
     sur la prestation, le propriétaire, la commune ; en dessous le donneur
     d'ordre. Comme ça je peux mettre facturé le, ensuite payé le. » */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', statut: 'paye', aDevis: true, temps: [], jours: [],
      maj: Date.now(), donneur: 'Cabinet Dubois', proprietaire: 'Martin',
      commune: 'Clairbois', foret: 'Forêt de la Côte',
      numeroFacture: 'F-2026-0016',
      dateDevis: new Date(2026, 1, 4, 12).getTime(),
      dateFacture: new Date(2026, 2, 12, 12).getTime(),
      datePaiement: new Date(2026, 3, 30, 12).getTime(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.choisir('#c-filtre', 'tous'); await t.pause(300);
  const ligne = t.$('#ch-filtre-liste .aj-ch');
  const sous = [ligne.querySelector('.aj-txt small').textContent, ligne.querySelector('.aj-situ').textContent];

  verifierVrai('le titre porte le propriétaire',
    /Martin/.test(ligne.querySelector('.aj-txt > b').textContent));
  verifierVrai('la ligne d’en dessous ne le redit pas', !/Martin/.test(sous[0]));
  verifierVrai('elle porte le donneur d’ordre', /Cabinet Dubois/.test(sous[0]));

  /* Les trois étapes, pas seulement la dernière : c'est l'écart entre la
     facture et le paiement qu'il vient lire. */
  /* La date du devis est dans la fiche, étape Devis (ligne V2, validée). */
  verifierVrai('la facture est datée', /Facturé le 12\/03\/2026/.test(sous[1]));
  verifierVrai('et le paiement', /payé le 30\/04\/2026/.test(sous[1]));
  verifierVrai('le numéro de facture reste lisible',
    /F-2026-0016/.test(ligne.textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : le tri se choisit, et ce qui n’a pas la date va à la fin', async () => {
  /* « De pouvoir choisir : du plus ancien au plus récent, ok, mais de choisir
     si c'est sur le numéro de facture, sur la date de paiement, sur la date
     d'émission de la facture, ou sur celle du devis. » */
  const J = (m, j) => new Date(2026, m, j, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', proprietaire: 'Alpha', statut: 'paye', aDevis: true, temps: [], jours: [],
        lignes: [], maj: J(0, 1), numeroFacture: 'F-2026-0002',
        dateDevis: J(0, 10), dateFacture: J(2, 1), datePaiement: J(5, 1) },
      { id: 'c2', proprietaire: 'Beta', statut: 'paye', aDevis: true, temps: [], jours: [],
        lignes: [], maj: J(0, 2), numeroFacture: 'F-2026-0001',
        dateDevis: J(1, 10), dateFacture: J(3, 1), datePaiement: J(4, 1) },
      /* Ni devis ni facture : il n'a qu'une date d'entrée. */
      { id: 'c3', proprietaire: 'Gamma', statut: 'encours', aDevis: false, temps: [], jours: [],
        lignes: [], maj: J(0, 3), cree: J(6, 1) }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.choisir('#c-filtre', 'tous'); await t.pause(300);
  const noms = () => [...t.$$('#ch-filtre-liste .aj-txt > b')].map(x => x.textContent);

  t.choisir('#c-tri', 'facture'); await t.pause(300);
  /* Du plus récent d'abord : F-0002 avant F-0001. Celui sans facture ferme
     la marche — il n'est pas « la plus ancienne des factures ». */
  verifier('par numéro de facture', ['Alpha', 'Beta', 'Gamma'], noms());

  t.choisir('#c-tri', 'paiement'); await t.pause(300);
  verifier('par date de paiement', ['Alpha', 'Beta', 'Gamma'], noms());

  t.choisir('#c-tri', 'datefacture'); await t.pause(300);
  verifier('par date de facture', ['Beta', 'Alpha', 'Gamma'], noms());

  t.choisir('#c-tri', 'devis'); await t.pause(300);
  verifier('par date de devis', ['Beta', 'Alpha', 'Gamma'], noms());

  /* Le sens s'inverse, mais ce qui n'a pas la valeur reste à la fin. */
  t.clic('#c-sens'); await t.pause(300);
  verifier('du plus ancien, sans remonter les sans-devis',
    ['Alpha', 'Beta', 'Gamma'], noms());

  /* Et la date d'entrée range ceux qui n'ont rien d'autre. */
  t.clic('#c-sens'); await t.pause(300);
  t.choisir('#c-tri', 'entree'); await t.pause(300);
  verifier('par date d’entrée, personne n’est relégué',
    ['Gamma', 'Beta', 'Alpha'], noms());
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : la date d’entrée se pose seule et se corrige', async () => {
  /* Elle ne dit rien des travaux : c'est l'ordre d'arrivée, et c'est ce qui
     range les chantiers qui n'ont ni devis ni facture. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  await plusChantier(t);
  t.saisir('#ce-proprio', 'Martin');
  t.saisir('#ce-com', 'Clairbois');
  await t.pause(200);
  verifier('le nom se montre avant d’être créé', 'Martin, Clairbois',
    t.$('#ce-nom-apercu').textContent);
  t.clic('#ce-ok'); await t.pause(700);

  const c = (t.stock('chantiers') || [])[0];
  verifierVrai('le chantier est né', !!c);
  const C0 = t.w.BCC;
  verifier('entré aujourd’hui', C0.jourCle(Date.now()), C0.jourCle(C0.dateEntree(c)));

  /* Un chantier saisi après coup n'est pas arrivé aujourd'hui. */
  t.clic('#f-identite'); await t.pause(400);
  t.choisir('#ic-entree', jourISO(new Date(2026, 0, 15, 12).getTime()));
  t.clic('#ic-ok'); await t.pause(600);
  verifier('la date se corrige', C0.jourCle(new Date(2026, 0, 15, 12).getTime()),
    C0.jourCle(C0.dateEntree((t.stock('chantiers') || [])[0])));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : le filtre ne garde que les chantiers qui ont eu un devis', async () => {
  /* « Ce serait bien pour sélectionner uniquement les chantiers qui ont eu un
     devis, et pouvoir aussi les trier. » Tous n'en partent pas : un client qui
     rappelle pour finir une parcelle, un dépannage. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', proprietaire: 'Avecdevis', statut: 'encours', aDevis: true,
        temps: [], jours: [], lignes: [], maj: Date.now() },
      { id: 'c2', proprietaire: 'Sansdevis', statut: 'encours', aDevis: false,
        temps: [], jours: [], lignes: [], maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.choisir('#c-filtre', 'avecdevis'); await t.pause(350);
  const z = t.$('#ch-filtre-liste').textContent;
  verifierVrai('celui qui a un devis est là', /Avecdevis/.test(z));
  verifierVrai('l’autre est écarté', !/Sansdevis/.test(z));
  /* Le compte du filtre ne se devine pas : il est écrit dans l'option. */
  verifierVrai('et le filtre dit combien',
    /Avec devis \(1\)/.test(t.$('#c-filtre').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : la tête dit le facturé, l’encaissé et qui le fait vivre', async () => {
  /* « En attente, ça veut dire quoi ? Tu pourrais l'enlever et mettre juste le
     nombre de devis signés. Et ce qui serait très intéressant, c'est le
     chiffre d'affaires que j'ai fait avec le plus gros donneur d'ordre. »
     Quatre carreaux, deux par ligne : ce qui est rentré en haut, ce qui
     arrive en bas. */
  const ligne = p => [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: p, nature: 'prestation' }];
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', proprietaire: 'A', donneur: 'Cabinet Dubois', statut: 'paye', aDevis: false,
        temps: [], jours: [], maj: Date.now(), lignes: ligne(1000) },
      { id: 'c2', proprietaire: 'B', donneur: 'Cabinet Dubois', statut: 'facture', aDevis: false,
        temps: [], jours: [], maj: Date.now(), lignes: ligne(500) },
      /* Terminé sans facture : il ne compte pas dans le facturé, mais c'est
         celui qu'on risque d'oublier. */
      { id: 'c3', proprietaire: 'C', statut: 'termine', aDevis: false, temps: [], jours: [],
        maj: Date.now(), lignes: ligne(300) },
      { id: 'c4', proprietaire: 'D', donneur: 'Cabinet Dubois', statut: 'accepte', aDevis: true,
        temps: [], jours: [], maj: Date.now(), lignes: ligne(200) },
      /* Un second donneur d'ordre, plus petit : c'est le plus gros qui parle. */
      { id: 'c5', proprietaire: 'E', donneur: 'Petit cabinet', statut: 'paye', aDevis: false,
        temps: [], jours: [], maj: Date.now(), lignes: ligne(200) }
    ]
  }));
  /* Lot d1 : les cumuls ont quitté le bas de Chantiers pour Argent ▸
     Année ▸ Vue d'ensemble ▸ Depuis le début. */
  t.clic('[data-vue="carnet"]'); await t.pause(350);
  verifierVrai('ils ne sont plus en bas de Chantiers', !t.$('#vue-carnet #carnet-totaux') && !t.$('#ch-cumuls'));
  await parBarre(t, 'argent'); t.clic('[data-vue="analyses"]'); await t.pause(300);
  verifierVrai('ils sont dans Année ▸ Vue d’ensemble, repliés',
    !!t.$('#ana-corps [data-loin="an-cumuls"] #carnet-totaux') && !t.$('[data-loin="an-cumuls"]').open);
  const tete = t.texte('#carnet-totaux');
  /* Facturé : la facture est partie, réglée ou non — la base des déclarations. */
  verifierVrai('le facturé additionne payé et facturé', /1 700 €facturé/.test(tete));
  verifierVrai('et compte les factures', /3 factures/.test(tete));
  /* « Encaissé » ferait croire à l'argent rentré : c'est le facturé réglé
     depuis (lot d1). */
  verifierVrai('« dont payé » ne retient que le réglé', /1 200 €dont payé/.test(tete) && !/encaissé/.test(tete));
  /* « En attente » ne voulait rien dire : il cède la place à un compte. */
  verifierVrai('« en attente » a disparu', !/en attente/.test(tete));
  verifierVrai('les devis signés se comptent', /1devis signé · 200 €/.test(tete));
  /* Qui le fait vivre, et pour quelle part : un donneur d'ordre à quatre-vingts
     pour cent n'est pas un client, c'est un risque. */
  verifierVrai('le premier donneur d’ordre est nommé', /1 500 €Cabinet Dubois/.test(tete));
  verifierVrai('avec sa part du total', /88 %/.test(tete));
  verifierVrai('le plus petit ne prend pas sa place', !/Petit cabinet/.test(tete));
  /* « À facturer » a quitté le carreau, pas l'écran. */
  verifierVrai('et ce qui presse reste dit', /1 à facturer/.test(tete));
  /* Les mots qui l'arrêtaient à chaque passage. */
  verifierVrai('« engagé, tous statuts » a disparu', !/engagé, tous statuts/.test(tete));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Journées : une date passée compte comme faite, pas comme prévue', async () => {
  /* Quand on saisit après coup un chantier déjà commencé, toutes ses journées
     sont dans le passé : parler d'estimation n'a alors aucun sens. */
  const jour = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [],
      joursEstimes: 5, maj: Date.now(),
      jours: [{ d: jour(-3), p: 1 }, { d: jour(-2), p: 1 }, { d: jour(-1), p: 0.5 },
        { d: jour(2), p: 1 }] }]
  }));
  const C = t.w.BCC;
  const c = (t.stock('chantiers') || [])[0];
  verifier('deux journées et demie sont faites', 2.5, C.totalFait(c));
  verifier('une seule est à venir', 1, C.totalAVenir(c));
  verifier('le total placé ne bouge pas', 3.5, C.totalPlace(c));
  verifier('il reste 1,5 à placer sur 5 estimées', 1.5, C.resteAPlacer(c));

  /* Aujourd'hui compte comme fait : la journée est entamée. */
  const aujourdhui = { jours: [{ d: jour(0), p: 1 }] };
  verifier('la journée du jour est faite', 1, C.totalFait(aujourdhui));
  verifier('et rien à venir', 0, C.totalAVenir(aujourdhui));

  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(350);
  const fiche = t.$('#vue-chantier').textContent;
  /* Les deux blocs n'en font plus qu'un : le prévu et le fait se lisent
     côte à côte, ligne par date. Le moteur, lui, garde totalFait() — il
     compte toujours les journées posées à une date passée. */
  verifierVrai('la fiche distingue le fait du prévu',
    /Fait/.test(fiche) && /Prévu/.test(fiche));
  verifierVrai('et signale ce qui reste à venir', /à venir/.test(fiche));
  verifierVrai('elle dit où va le temps réellement passé',
    /réellement passé/.test(fiche));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Paiement : l’échéance décide du retard, et chaque client a son délai', async () => {
  const jour = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      /* Facturé il y a 20 jours seulement, mais l'échéance est dépassée : le
         délai général de 45 jours n'aurait rien signalé. */
      { id: 'c1', nom: 'Vaux', statut: 'facture', donneur: 'Cabinet Dubois',
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 900, nature: 'prestation' }],
        temps: [], dateFacture: jour(-20), echeancePaiement: jour(-5), maj: Date.now() },
      /* Deux factures réglées par le même client : 10 et 40 jours. */
      { id: 'c2', nom: 'Places', statut: 'paye', donneur: 'Cabinet Dubois',
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 500, nature: 'prestation' }],
        temps: [], dateFacture: jour(-100), datePaiement: jour(-90), maj: Date.now() },
      { id: 'c3', nom: 'Montjoie', statut: 'paye', donneur: 'Cabinet Dubois',
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 500, nature: 'prestation' }],
        temps: [], dateFacture: jour(-200), datePaiement: jour(-160), maj: Date.now() }
    ]
  }));
  const C = t.w.BCC;
  const ch = t.stock('chantiers') || [];
  const par = id => ch.filter(x => x.id === id)[0];
  verifier('un règlement en dix jours', 10, C.delaiPaiement(par('c2')));
  verifier('un autre en quarante', 40, C.delaiPaiement(par('c3')));
  verifier('une facture en cours n’a pas de délai', null, C.delaiPaiement(par('c1')));
  verifier('mais elle a cinq jours de retard', 5, C.retardPaiement(par('c1')));

  const al = C.alertes(ch, {}, Date.now()).filter(a => a.type === 'impaye');
  verifier('un seul impayé signalé', 1, al.length);
  verifierVrai('et il parle d’échéance, pas d’ancienneté',
    /échéance dépassée/.test(al[0].texte));

  /* Le délai médian du client, et son pire. */
  const d = C.parDonneur(ch, {}).filter(x => x.donneur === 'Cabinet Dubois')[0];
  verifier('délai médian de vingt-cinq jours', 25, d.delaiMedian);
  verifier('le pire à quarante', 40, d.delaiPire);
  verifier('une facture en retard chez lui', 1, d.enRetard);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche à compléter : ce qui manque se voit, sans jamais bloquer', async () => {
  /* Rien n'est obligatoire à la saisie — on note trois mots au bord d'une
     route — mais on doit retrouver ce qu'on a laissé à moitié rempli. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Complet', statut: 'accepte', aDevis: false, donneur: 'Dubois',
        commune: 'Montjoie', joursEstimes: 3, temps: [], maj: Date.now(),
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 900, nature: 'prestation' }] },
      { id: 'c2', nom: 'À moitié', statut: 'accepte', aDevis: false, temps: [],
        lignes: [], maj: Date.now() }
    ]
  }));
  const C = t.w.BCC;
  const ch = t.stock('chantiers') || [];
  const par = id => ch.filter(x => x.id === id)[0];
  verifier('la fiche complète ne manque de rien', [], C.champsManquants(par('c1')));
  verifierVrai('l’autre manque du donneur d’ordre',
    C.champsManquants(par('c2')).indexOf('donneur d’ordre') >= 0);
  verifierVrai('et des lignes de travaux',
    C.champsManquants(par('c2')).indexOf('lignes de travaux') >= 0);
  /* Un champ n'est réclamé qu'à partir de l'étape où il a un sens. */
  verifierVrai('on ne réclame pas de numéro de facture sur un chantier à planifier',
    C.champsManquants(par('c2')).indexOf('numéro de facture') < 0);
  /* Un chantier sans suite ne se fera pas : on ne lui demande plus rien. */
  verifier('un chantier sans suite ne manque de rien', [],
    C.champsManquants({ statut: 'sansuite' }));

  t.clic('[data-vue="carnet"]'); await t.pause(300);
  verifier('une seule ligne est marquée', 1, t.$('#liste-chantiers').querySelectorAll('.acompleter').length);
  const liste = t.$('#ch-filtre-liste');
  /* Et le filtre les rassemble. */
  const options = t.$$('#c-filtre option').map(o => o.value);
  verifierVrai('un filtre « à compléter » apparaît', options.indexOf('acompleter') >= 0);
  t.choisir('#c-filtre', 'acompleter'); await t.pause(250);
  const texte = liste.textContent;
  verifierVrai('il ne montre que l’incomplète', /À moitié/.test(texte) && !/Complet/.test(texte));

  /* La fiche dit ce qui lui manque. */
  t.clic('[data-chouvrir="c2"]'); await t.pause(350);
  verifierVrai('la fiche énumère les manques',
    /Il manque/.test(t.$('#vue-chantier').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Listes : le nom se propose en quittant le champ, pas à la validation', async () => {
  /* Une fenêtre bloquante tombait au moment d'enregistrer le chantier : le nom
     était tapé depuis longtemps, et la question coupait la saisie. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', clients: ['Cabinet Dubois'], proprios: []
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  await plusChantier(t);

  const offre = t.$('#ce-donneur-offre');
  verifierVrai('l’offre existe mais reste muette', offre && !offre.textContent.trim());

  /* Un nom déjà connu ne propose rien. */
  t.saisir('#ce-donneur', 'Cabinet Dubois');
  t.$('#ce-donneur').dispatchEvent(new t.w.Event('blur'));
  await t.pause(150);
  verifierVrai('un nom déjà dans la liste ne propose rien', !offre.textContent.trim());

  /* Un nom inconnu, lui, se propose dès la sortie du champ. */
  t.saisir('#ce-donneur', 'Groupement de Vaux');
  t.$('#ce-donneur').dispatchEvent(new t.w.Event('blur'));
  await t.pause(150);
  verifierVrai('un nom inconnu est signalé', /n’est pas dans vos/.test(offre.textContent));
  verifierVrai('le nom est repris en clair', /Groupement de Vaux/.test(offre.textContent));
  verifierVrai('et un bouton l’ajoute', t.$('#ce-donneur-offre [data-offre]'));

  /* Le chantier n'est pas encore enregistré : la liste s'enrichit tout de même.
     Depuis la 4.77, l'offre demande d'abord de qui il s'agit — un donneur
     d'ordre est un gestionnaire, pas un propriétaire. */
  t.clic('#ce-donneur-offre [data-offre]'); await t.pause(300);
  verifierVrai('le type est demandé avant d’ajouter', t.$('#tc-type'));
  t.choisir('#tc-type', 'gestion'); await t.pause(150);
  t.clic('#tc-ok'); await t.pause(400);
  const clients = t.stock('clients') || [];
  verifierVrai('le donneur d’ordre est entré dans la liste',
    clients.indexOf('Groupement de Vaux') >= 0);
  verifierVrai('et l’offre le confirme', /ajouté/.test(offre.textContent));
  verifierVrai('sans avoir enregistré le chantier', !(t.stock('chantiers') || []).length);

  /* Enregistrer ne pose plus aucune question. */
  let demande = null;
  t.w.confirm = m => { demande = m; return false; };
  t.saisir('#ce-proprio', 'Vaux');
  t.clic('#ce-ok'); await t.pause(450);
  verifier('la validation ne demande plus rien', null, demande);
  verifier('et le chantier est enregistré', 1, (t.stock('chantiers') || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Inventaire : on n’additionne pas des millilitres avec des pièces', async () => {
  /* Un « acheté » qui cumule du répulsif au millilitre et des tuteurs à la pièce
     ne veut rien dire. Même règle que les journées et les plants. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [
      { id: 'a1', nom: 'Trico', unite: 'millilitre', dosage: 6 },
      { id: 'a2', nom: 'Tuteur', unite: 'unite' }
    ],
    commandes: [{ id: 'k1', statut: 'recu', date: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 34000, prix: 0.01 }, { article: 'a2', qte: 500, prix: 1.2 }] }]
  }));
  await t.pause(300);
  const tot = t.$('#stock-table .tot');
  verifierVrai('la ligne de total existe', tot);
  verifierVrai('elle renonce aux quantités', /unités différentes/.test(tot.textContent));
  verifierVrai('mais garde la valeur en euros', /\u20AC|\d/.test(tot.textContent));

  /* Un catalogue d'une seule unité, lui, se totalise sans mentir. */
  const u = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Tuteur', unite: 'unite' },
      { id: 'a2', nom: 'Gaine', unite: 'unite' }],
    commandes: [{ id: 'k1', statut: 'recu', date: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 500, prix: 1 }, { article: 'a2', qte: 300, prix: 1 }] }]
  }));
  await u.pause(300);
  verifierVrai('unités identiques : le total revient',
    /800/.test(u.$('#stock-table .tot').textContent));
  verifier('aucune erreur', [], t.erreurs.concat(u.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Stock : la commande se saisit aux entrées, pas depuis l’inventaire', async () => {
  /* L'inventaire est un état des lieux : on n'y crée rien. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock', articles: [{ id: 'a1', nom: 'Tuteur', unite: 'unite' }]
  }));
  await t.pause(250);
  verifier('plus de « + Commande » sur l’inventaire', null, t.$('#art-reception'));
  verifierVrai('l’import reste', t.$('#art-importer'));
  t.clic('[data-vue="commandes"]'); await t.pause(300);
  verifierVrai('la commande se crée aux entrées et sorties', t.$('#cmd-nouvelle'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Commande reçue : la livraison se date, et on le dit', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Tuteur', unite: 'unite' }],
    commandes: [{ id: 'k1', statut: 'commande', date: Date.now() - 5 * 86400000,
      lignes: [{ article: 'a1', qte: 100, prix: 1 }] }]
  }));
  t.clic('[data-vue="commandes"]'); await t.pause(300);
  verifierVrai('la commande attend sa réception', t.$('[data-cmdrecu="k1"]'));
  t.clic('[data-cmdrecu="k1"]'); await t.pause(400);
  const k = (t.stock('commandes') || [])[0];
  verifier('elle est reçue', 'recu', k.statut);
  verifierVrai('et la livraison est datée d’aujourd’hui',
    jourISO(k.dateLiv) === jourISO(Date.now()));
  verifierVrai('le message le dit', /livraison datée/.test(t.$('#toast').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Produit : le dosage par plant ne s’offre qu’aux unités dosables', async () => {
  /* « 6 ml par plant » sur des tuteurs comptés à la pièce ne veut rien dire.
     Le dosage sert à ce qui s'achète en volume, longueur ou poids et se
     facture au plant. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'stock' }));
  const ST = t.w.BCS2;
  verifierVrai('le millilitre est dosable', ST.UNITE_DOSABLE('millilitre'));
  verifierVrai('le litre aussi', ST.UNITE_DOSABLE('litre'));
  verifierVrai('le mètre linéaire aussi', ST.UNITE_DOSABLE('ml'));
  verifierVrai('l’unité, non', !ST.UNITE_DOSABLE('unite'));
  verifierVrai('le rouleau non plus', !ST.UNITE_DOSABLE('rouleau'));

  await parMenu(t, 'reglages');
  t.clic('#rp-add'); await t.pause(350);
  /* Le formulaire s'ouvre sur l'unité par défaut : à la pièce, pas de dosage. */
  t.choisir('#ar-unite', 'unite'); await t.pause(200);
  verifier('à la pièce, le dosage disparaît', 'none', t.$('#ar-dosage-champ').style.display);
  verifier('son explication aussi', 'none', t.$('#ar-dosage-aide').style.display);
  t.choisir('#ar-unite', 'millilitre'); await t.pause(200);
  verifierVrai('au millilitre, il revient',
    t.$('#ar-dosage-champ').style.display !== 'none');

  /* Une valeur saisie ne survit pas au passage à une unité non dosable. */
  t.saisir('#ar-nom', 'Tuteur');
  t.saisir('#ar-dosage', '6');
  t.choisir('#ar-unite', 'unite'); await t.pause(200);
  t.clic('#ar-ok'); await t.pause(400);
  const a = (t.stock('articles') || [])[0];
  verifier('le produit est enregistré', 'Tuteur', a && a.nom);
  verifier('sans dosage', null, a && a.dosage);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Stock : un débours sort bien du stock', async () => {
  /* Un débours n'est pas une vente — il ne compte ni dans le chiffre
     d'affaires ni dans la marge — mais la marchandise, elle, est partie.
     On le lit sur le tableau, là où il le lit : l'index des mouvements vit en
     mémoire et n'est pas dans le stockage. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Tuteur', unite: 'unite' }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 500, prix: 1 }] }],
    sorties: [
      { id: 's1', statut: 'fini', date: Date.now(), debours: false, perte: false,
        lignes: [{ article: 'a1', qte: 100, prix: 2 }] },
      { id: 's2', statut: 'fini', date: Date.now(), debours: true, perte: false,
        lignes: [{ article: 'a1', qte: 50, prix: 1 }] }
    ]
  }));
  await t.pause(350);
  /* On lit par le nom de la colonne, pas par sa position : l'ordre a déjà
     changé une fois, et un test qui compte les cases casse pour rien. */
  const entetes = t.$$('#stock-table thead th').map(e => e.textContent.trim());
  const cellules = t.$$('#stock-table tbody tr')[0].children;
  const col = nom => {
    const i = entetes.indexOf(nom);
    return i < 0 ? null : cellules[i].textContent.trim();
  };
  verifier('500 achetés', '500', col('Acheté'));
  verifier('150 sortis, débours compris', '150', col('Sorti'));
  verifier('il reste 350 en stock', '350', col('En stock'));
  /* Et le débours ne se compte pas comme une vente : la sortie le dit. */
  t.clic('[data-vue="commandes"]'); await t.pause(300);
  t.clic('[data-mvt="sorties"]'); await t.pause(250);
  verifierVrai('la sortie en débours est étiquetée comme telle',
    /débours/.test(t.$('#liste-commandes').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
  const STOCK = () => Object.assign({}, VIDE, {
    module: 'stock',
    articles: [
      { id: 'a1', nom: 'Bambou', unite: 'unite' },
      { id: 'a2', nom: 'Gaine', unite: 'unite' }
    ],
    commandes: [{ id: 'k1', num: 'C-1', statut: 'recu', dateCmd: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 1000, prix: 1 }, { article: 'a2', qte: 1000, prix: 2 }] }],
    sorties: [{ id: 's1', statut: 'fini', date: Date.now(), debours: false, perte: false,
      lignes: [{ article: 'a1', qte: 100, prix: 2 }, { article: 'a2', qte: 100, prix: 2.2 }] }]
  });

scenario('Inventaire : ce qu’il reste se lit sans faire défiler', async () => {
  /* « En stock » était au bout d'un défilement horizontal, alors que c'est la
     seule colonne qu'on vient vraiment lire. */
  const t = await ouvrir(STOCK());
  await t.pause(350);
  const entetes = t.$$('#stock-table thead th').map(e => e.textContent.trim());
  verifier('le produit d’abord', 'Produit', entetes[0]);
  verifier('puis ce qu’il reste', 'En stock', entetes[1]);
  verifierVrai('l’acheté vient après', entetes.indexOf('Acheté') > 1);
  /* Et la valeur reste la colonne qui a du sens à totaliser. */
  const cellules = t.$$('#stock-table tbody tr')[0].children;
  verifier('la première valeur lue est le stock', '900', cellules[1].textContent.trim());

  /* Où dort l'argent, là où il fait son état des lieux. */
  const resume = t.$('#stock-resume').textContent;
  verifierVrai('la valeur par produit est montrée', /Où dort votre argent/.test(resume));
  verifierVrai('la gaine passe devant le bambou', /Gaine[\s\S]*Bambou/.test(resume));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Commande : la dépense se décoche après coup, et prévient', async () => {
  /* Deux achats chez le même fournisseur réglés par une seule facture : il
     faut pouvoir retirer la dépense d'une des deux commandes. */
  const t = await ouvrir(STOCK());
  t.clic('[data-vue="commandes"]'); await t.pause(300);
  t.clic('[data-cmdmod="k1"]'); await t.pause(350);
  verifierVrai('la case est proposée en modification', t.$('#cm-dep'));
  verifierVrai('décochée : cette commande n’a pas de dépense', !t.$('#cm-dep').checked);

  /* On la coche : la dépense se crée. */
  t.$('#cm-dep').checked = true;
  t.$('#cm-dep').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  t.choisir('#cm-tva', '20');
  t.clic('#cm-ok'); await t.pause(450);
  const dep = (t.stock('depenses') || []).filter(d => d.commande === 'k1');
  verifier('une dépense est née de la commande', 1, dep.length);
  verifier('elle porte la TVA choisie', 20, dep[0].lignes[0].taux);

  /* On la décoche : on est prévenu, et refuser ne change rien. */
  t.clic('[data-cmdmod="k1"]'); await t.pause(350);
  verifierVrai('la case est cochée cette fois', t.$('#cm-dep').checked);
  let alerte = '';
  t.w.confirm = m => { alerte = m; return false; };
  t.$('#cm-dep').checked = false;
  t.$('#cm-dep').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(150);
  verifierVrai('on est prévenu du retrait', /retirera la dépense/.test(alerte));
  verifierVrai('refuser recoche la case', t.$('#cm-dep').checked);

  /* Accepter, cette fois. */
  t.w.confirm = () => true;
  t.$('#cm-dep').checked = false;
  t.$('#cm-dep').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  t.clic('#cm-ok'); await t.pause(450);
  verifier('la dépense a disparu', 0,
    (t.stock('depenses') || []).filter(d => d.commande === 'k1').length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Performance : le taux d’ensemble, et la bascule brute / nette', async () => {
  /* Un produit vendu sous l'objectif peut être rattrapé par un autre : c'est
     le total qui dit si les charges sont couvertes. */
  const t = await ouvrir(STOCK());
  t.clic('[data-vue="revient"]'); await t.pause(300);
  t.clic('[data-rev="perf"]'); await t.pause(350);
  const corps = t.$('#rev-resultat').textContent;
  verifierVrai('le taux d’ensemble est annoncé', /Sur l’ensemble de vos ventes/.test(corps));
  verifierVrai('l’objectif est rappelé', /objectif/.test(corps));
  verifierVrai('et le net après charges aussi', /après charges/.test(corps));

  /* La bascule change le graphique sans changer le tableau. */
  verifierVrai('la bascule existe', t.$('[data-marge="nette"]'));
  verifier('on part de la brute', 'true',
    t.$('[data-marge="brute"]').getAttribute('aria-pressed'));
  t.clic('[data-marge="nette"]'); await t.pause(300);
  verifier('la nette prend la main', 'true',
    t.$('[data-marge="nette"]').getAttribute('aria-pressed'));
  verifierVrai('et le texte explique ce qu’elle retire',
    /de charges, prélevés sur le prix de vente/.test(t.$('#rev-resultat').textContent));
  verifier('aucune erreur', [], t.erreurs);
});


/* --------------------------------------------------------------------- */
scenario('Simulateur : le dosage se change sans toucher au produit', async () => {
  /* De gros Douglas prennent plus de répulsif que six millilitres : on doit
     pouvoir le chiffrer sans corriger la fiche du produit. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Trico', unite: 'millilitre', dosage: 6 }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 10000, prix: 0.02 }] }]
  }));
  t.clic('[data-vue="revient"]'); await t.pause(350);
  verifierVrai('le champ de dosage est proposé', t.$('#rev-dose'));
  verifier('il part du dosage du produit', '6', t.$('#rev-dose').value);
  const coutA = t.$('#rev-form').textContent;

  t.choisir('#rev-dose', '12'); await t.pause(350);
  verifier('le dosage saisi est retenu', '12', t.$('#rev-dose').value);
  verifierVrai('le coût par plant a changé', t.$('#rev-form').textContent !== coutA);
  verifierVrai('et le simulé est signalé', /simulé/.test(t.$('#rev-form').textContent));
  /* La fiche du produit, elle, n'a pas bougé. */
  verifier('le produit garde son dosage', 6, (t.stock('articles') || [])[0].dosage);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Sortie : un produit dosé se saisit au plant, se stocke au millilitre', async () => {
  /* On plante 300 arbres, on ne verse pas 1 800 millilitres. La saisie parle
     donc en plants ; ce qui est enregistré reste dans l'unité du stock, dont
     dépend tout le calcul. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Trico', unite: 'millilitre', dosage: 6 },
      { id: 'a2', nom: 'Tuteur', unite: 'unite' }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 34000, prix: 0.02 }] }]
  }));
  t.clic('[data-vue="commandes"]'); await t.pause(300);
  /* Un seul bouton de création : son intitulé suit le sous-onglet ouvert. */
  t.clic('[data-mvt="sorties"]'); await t.pause(250);
  t.clic('#cmd-nouvelle'); await t.pause(400);

  /* Le produit dosé s'ouvre en plants. */
  verifierVrai('un sélecteur d’unité est proposé', t.$('[data-lgpar="0"]'));
  verifier('on saisit en plants par défaut', 'plant', t.$('[data-lgpar="0"]').value);
  verifierVrai('l’étiquette le dit', /plant/.test(t.$('#lg-lignes').textContent));

  t.saisir('[data-lgqte="0"]', '300');
  t.saisir('[data-lgprix="0"]', '0,30');
  await t.pause(250);
  /* Le séparateur de milliers est une espace insécable : on lit la phrase
     telle qu'elle est écrite, sans expression régulière à échapper. */
  const conv = t.$('[data-lgconv="0"]').textContent;
  verifier('la conversion est écrite en clair',
    '300 × 6 ml = 1 800 ml sortiront du stock', conv);

  t.clic('#so-ok'); await t.pause(450);
  const so = (t.stock('sorties') || [])[0];
  verifierVrai('la sortie est enregistrée', so);
  verifier('300 plants font 1 800 ml', 1800, so.lignes[0].qte);
  /* 0,30 € par plant, c'est 0,05 € par millilitre. */
  verifier('et le prix suit la quantité', 0.05, so.lignes[0].prix);

  /* Rouverte, elle se relit en plants. */
  t.clic('[data-mvt="sorties"]'); await t.pause(250);
  t.clic('[data-srtmod="' + so.id + '"]'); await t.pause(400);
  verifier('elle se relit en plants', '300', t.$('[data-lgqte="0"]').value);
  verifier('et son prix par plant', '0.3', t.$('[data-lgprix="0"]').value);

  /* Le sélecteur ramène dans l'unité du produit. */
  t.choisir('[data-lgpar="0"]', ''); await t.pause(300);
  verifierVrai('l’étiquette repasse au millilitre',
    /Quantité \(ml\)/.test(t.$('#lg-lignes').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Commande : on achète des bidons, jamais des plants', async () => {
  /* La règle du plant ne vaut qu'à la sortie : une commande porte ce que le
     fournisseur facture. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Trico', unite: 'millilitre', dosage: 6 }]
  }));
  t.clic('[data-vue="commandes"]'); await t.pause(300);
  t.clic('#cmd-nouvelle'); await t.pause(350);
  verifier('aucun sélecteur d’unité à l’achat', null, t.$('[data-lgpar="0"]'));
  verifierVrai('la quantité est en millilitres',
    /Quantité \(ml\)/.test(t.$('#lg-lignes').textContent));
  t.saisir('[data-lgqte="0"]', '34000');
  t.saisir('[data-lgprix="0"]', '0,02');
  t.clic('#cm-ok'); await t.pause(450);
  const k = (t.stock('commandes') || [])[0];
  verifier('34 000 ml commandés, sans conversion', 34000, k.lignes[0].qte);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('L’application ne porte plus le nom de celle dont elle est partie', async () => {
  /* Elle s'en est inspirée puis complètement écartée : plus aucune trace à
     l'écran. Les clés de stockage, elles, gardent leur nom — les renommer
     ferait chercher les données dans un tiroir vide. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'cubage' }));
  await parMenu(t, 'reglages');
  t.clic('[data-regl="cubage"]'); await t.pause(250);
  const texte = t.$('#regl-corps').textContent;
  verifierVrai('le mode ne cite plus l’application d’origine', !/Bord.?Cub/i.test(texte));
  verifierVrai('il s’appelle « Historique »', /Historique/.test(texte));
  t.clic('[data-mode="corrige"]'); await t.pause(250);
  verifierVrai('l’explication non plus', !/Bord.?Cub/i.test(t.$('#regl-corps').textContent));
  /* Nulle part ailleurs à l'écran. On écarte le source des <script> : il
     contient les clés de stockage, que personne ne voit jamais. */
  const copie = t.d.body.cloneNode(true);
  [...copie.querySelectorAll('script, style')].forEach(e => e.remove());
  verifierVrai('ni ailleurs à l’écran', !/Bord.?Cub/i.test(copie.textContent));
  /* Mais le tiroir garde son nom, sinon les données seraient perdues. */
  verifierVrai('les données restent rangées où elles étaient',
    t.w.localStorage.getItem('bordcub.cfg') !== null);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Marque : le logo et le nom de l’entreprise, là où ils servent', async () => {
  /* Une image minuscule, en PNG, qui tient dans une chaîne. */
  const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    cfg: { nomEntreprise: 'ETF du Val Vert', logoEntreprise: LOGO }
  }));
  await t.pause(300);
  /* Lot 5b : l'écran Mon entreprise, qui affichait nom et logo en tête, est
     parti. Les deux signent l'écran de démarrage, sous le logo de Sylve
     (table de correspondance § 1), et l'aperçu des réglages. */
  verifier('plus d’écran Mon entreprise', null, t.$('#vue-entreprise'));
  verifierVrai('la signature est posée au démarrage', !t.$('#dem-ent').hidden);
  verifierVrai('elle porte le nom', /ETF du Val Vert/.test(t.$('#dem-ent').textContent));
  verifierVrai('et le logo, l’image déposée', t.$('#dem-ent img') &&
    t.$('#dem-ent img').getAttribute('src') === LOGO);
  await parMenu(t, 'reglages');
  verifierVrai('l’aperçu des réglages le montre aussi', !t.$('#r-ent-apercu').hidden &&
    t.$('#r-ent-apercu img').getAttribute('src') === LOGO);

  /* Rien de saisi : rien ne signe. */
  const vide = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  await vide.pause(250);
  verifierVrai('sans nom ni logo, rien ne signe le démarrage', vide.$('#dem-ent').hidden);

  /* Le nom se règle, et le démarrage suivant le porte. */
  await parMenu(vide, 'reglages');
  verifierVrai('le champ est dans les réglages', vide.$('#r-ent-nom'));
  vide.choisir('#r-ent-nom', 'Forêts du Levant'); await vide.pause(350);
  verifier('le nom est enregistré', 'Forêts du Levant', (vide.stock('cfg') || {}).nomEntreprise);
  const apres = await ouvrir(Object.assign({}, VIDE, { cfg: vide.stock('cfg') }));
  verifierVrai('et le démarrage suivant le porte', !apres.$('#dem-ent').hidden &&
    /Forêts du Levant/.test(apres.$('#dem-ent').textContent));
  verifier('aucune erreur', [], t.erreurs.concat(vide.erreurs, apres.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Notes de mise à jour : la version installée d’abord, les autres derrière', async () => {
  /* Cinq notes dépliées faisaient un long défilement pour une information
     qu'on ne relit presque jamais. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  await parMenu(t, 'reglages');
  t.clic('[data-regl="general"]'); await t.pause(250);
  const z = t.$('#c-notes-maj');
  verifierVrai('la liste est là', z && z.textContent.trim());
  verifier('une seule version dépliée', 1, z.querySelectorAll('.eyebrow').length);
  verifierVrai('et c’est celle qu’on a', /celle que vous avez/.test(z.textContent));
  verifierVrai('un bouton annonce les autres',
    /Voir les 4 versions précédentes/.test(z.textContent));

  t.clic('#notes-plus'); await t.pause(250);
  verifier('dépliées, cinq versions', 5, z.querySelectorAll('.eyebrow').length);
  verifierVrai('et le bouton se retourne', /Masquer/.test(z.textContent));
  t.clic('#notes-plus'); await t.pause(250);
  verifier('repliées, une seule', 1, z.querySelectorAll('.eyebrow').length);

  /* Une note qui mène quelque part y mène toujours. */
  t.clic('#notes-plus'); await t.pause(250);
  /* Les notes tournent à chaque livraison : on prend le premier lien présent
     plutôt qu'un écran nommé, sinon le scénario casse à chaque rotation. */
  const lien = z.querySelector('[data-notevue]');
  verifierVrai('au moins une note mène quelque part', lien);
  const cible = lien.dataset.notevue;
  lien.click(); await t.pause(400);
  verifierVrai('et cet écran s’ouvre',
    cible === 'reglages'
      ? t.$('#vue-reglages').classList.contains('actif')
      : t.$('#vue-' + cible).classList.contains('actif'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Mise à jour : au premier lancement, on arrive sur ce qui a changé', async () => {
  /* Il vient d'appuyer sur « installer » : la note est ce qu'il attend. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { versionVue: '4.00.0-vieille' }
  }));
  await t.pause(400);
  verifierVrai('les réglages sont ouverts', t.$('#vue-reglages').classList.contains('actif'));
  verifierVrai('sur l’onglet général',
    t.$('[data-regl="general"]').getAttribute('aria-pressed') === 'true');
  verifierVrai('et la version vue est mise à jour',
    (t.stock('cfg') || {}).versionVue !== '4.00.0-vieille');

  /* Au lancement suivant, plus rien : on repart où l'on était. */
  const apres = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { versionVue: (t.stock('cfg') || {}).versionVue }
  }));
  await apres.pause(350);
  verifierVrai('le lancement suivant n’ouvre plus les réglages',
    !apres.$('#vue-reglages').classList.contains('actif'));

  /* Première installation : on ne dépose personne dans les réglages. */
  const neuve = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  await neuve.pause(350);
  verifierVrai('une installation neuve n’y va pas non plus',
    !neuve.$('#vue-reglages').classList.contains('actif'));
  verifierVrai('mais elle retient la version',
    !!(neuve.stock('cfg') || {}).versionVue);
  verifier('aucune erreur', [], t.erreurs.concat(apres.erreurs, neuve.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Sortie : la corriger la détache de la facture, sans y toucher', async () => {
  /* Il consomme parfois moins de répulsif que prévu. La sortie née de la
     facture se refaisait à chaque modification du chantier : la corriger
     n'avait aucun effet durable. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Trico', unite: 'millilitre', dosage: 6 }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 34000, prix: 0.02 }] }],
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'termine', temps: [], maj: Date.now(),
      dateFin: Date.now(),
      lignes: [{ travail: 'PROTEC', unite: 'plant', quantite: 300, prix: 0.3,
        nature: 'vente', article: 'a1' }] }],
    /* Telle que la facture l'a créée : 300 plants à 6 ml. */
    sorties: [{ id: 's1', auto: true, chantier: 'c1', statut: 'fini', date: Date.now(),
      perte: false, debours: false, num: '',
      lignes: [{ article: 'a1', qte: 1800, prix: 0.05 }] }]
  }));
  t.clic('[data-vue="commandes"]'); await t.pause(300);
  t.clic('[data-mvt="sorties"]'); await t.pause(250);
  verifierVrai('la liste dit qu’elle suit la facture',
    /suit la facture/.test(t.$('#liste-commandes').textContent));

  /* Il en a consommé 4 ml par plant, pas 6. */
  t.clic('[data-srtmod="s1"]'); await t.pause(400);
  verifierVrai('le formulaire prévient qu’elle suit la facture',
    /cessera de la suivre/.test(t.$('#modale-corps').textContent));
  verifier('elle s’ouvre en plants', '300', t.$('[data-lgqte="0"]').value);
  /* 300 plants à 4 ml au lieu de 6 : il pose le compte réel en millilitres. */
  t.choisir('[data-lgpar="0"]', ''); await t.pause(250);
  t.saisir('[data-lgqte="0"]', '1200');
  t.clic('#so-ok'); await t.pause(450);

  let so = (t.stock('sorties') || [])[0];
  verifier('la quantité corrigée est retenue', 1200, so.lignes[0].qte);
  verifierVrai('et la sortie ne suit plus la facture', !so.auto);
  /* La facture, elle, n'a pas bougé. */
  verifier('la ligne de facture est intacte', 300,
    (t.stock('chantiers') || [])[0].lignes[0].quantite);

  /* Modifier le chantier relance la synchronisation : elle doit respecter la
     correction au lieu d'en recréer une seconde. */
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(350);
  t.clic('[data-lmod="0"]'); await t.pause(400);
  t.saisir('#cl-qte', '340');
  t.clic('#cl-ok'); await t.pause(500);
  verifier('aucune seconde sortie n’apparaît', 1, (t.stock('sorties') || []).length);
  verifier('et la correction tient', 1200, (t.stock('sorties') || [])[0].lignes[0].qte);
  verifier('la facture, elle, a bien suivi', 340,
    (t.stock('chantiers') || [])[0].lignes[0].quantite);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Coûts : les trois prix en euros, et plus de graphique en double', async () => {
  /* « 131 % du minimum » ne veut rien dire pour personne. Trois bâtons en
     euros : ce que le produit coûte, ce qu'il devrait valoir, ce qu'on le
     vend. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Tuteur', unite: 'unite' }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 1000, prix: 1 }] }],
    sorties: [{ id: 's1', statut: 'fini', date: Date.now(), debours: false, perte: false,
      lignes: [{ article: 'a1', qte: 100, prix: 1.2 }] }]
  }));
  t.clic('[data-vue="revient"]'); await t.pause(300);
  t.clic('[data-rev="couts"]'); await t.pause(400);
  const z = t.$('#rev-resultat').textContent;
  verifierVrai('les trois repères sont nommés',
    /coût réel/.test(z) && /minimum à/.test(z) && /prix pratiqué/.test(z));
  /* Vendu 1,20 € pour un coût de 1 € : le minimum à 30 % est 1,43 €. */
  verifierVrai('l’écart au minimum est dit en euros', /il manque/.test(z));
  verifierVrai('plus aucun pourcentage d’un pourcentage', !/131|% du minimum/.test(z));
  /* Le graphique de l'inventaire ne se répète plus ici. */
  verifierVrai('« Où dort votre argent » n’est plus en double',
    !/Où dort votre argent/.test(z));
  verifierVrai('mais la valeur immobilisée reste dite', /immobilisés en stock/.test(z));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Performance : l’objectif ne vaut que pour la marge brute', async () => {
  /* Le seuil de 30 % se compare à la marge brute — c'est sur elle que
     l'abattement forfaitaire joue. Garder le trait sur la vue nette ferait
     croire à un objectif qui n'existe pas. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Tuteur', unite: 'unite' }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 1000, prix: 1 }] }],
    sorties: [{ id: 's1', statut: 'fini', date: Date.now(), debours: false, perte: false,
      lignes: [{ article: 'a1', qte: 100, prix: 2 }] }]
  }));
  t.clic('[data-vue="revient"]'); await t.pause(300);
  t.clic('[data-rev="perf"]'); await t.pause(400);
  verifierVrai('en brute, l’objectif est tracé',
    /votre objectif de/.test(t.$('#rev-resultat').textContent));
  t.clic('[data-marge="nette"]'); await t.pause(350);
  const z = t.$('#rev-resultat').textContent;
  verifierVrai('en nette, plus de trait d’objectif', !/Trait pointillé/.test(z));
  verifierVrai('et on dit pourquoi',
    /porte sur la marge brute/.test(z));
  verifierVrai('on explique aussi ce que la nette retire',
    /de charges, prélevés sur le/.test(z));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Rentabilité : les ventes année par année, et quand elles tombent', async () => {
  /* Le cumul de toujours ne dit ni si l'on progresse, ni quand on vend —
     deux questions qui décident des achats de fournitures. */
  const j = (an, mois, jour) => new Date(an, mois, jour, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Gaine', unite: 'unite' },
      { id: 'a2', nom: 'Tuteur', unite: 'unite' }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: j(2025, 0, 5), dateLiv: j(2025, 0, 5),
      lignes: [{ article: 'a1', qte: 4000, prix: 1 }, { article: 'a2', qte: 4000, prix: 0.5 }] }],
    sorties: [
      /* 2025 : 1 000 € */
      { id: 's1', statut: 'fini', date: j(2025, 3, 10), debours: false, perte: false,
        lignes: [{ article: 'a1', qte: 500, prix: 2 }] },
      /* 2026 : 1 500 € en mars, 500 € en octobre */
      { id: 's2', statut: 'fini', date: j(2026, 2, 12), debours: false, perte: false,
        lignes: [{ article: 'a1', qte: 750, prix: 2 }] },
      { id: 's3', statut: 'fini', date: j(2026, 9, 8), debours: false, perte: false,
        lignes: [{ article: 'a2', qte: 500, prix: 1 }] }
    ]
  }));
  const ST = t.w.BCS2;
  const arts = [{ mouvements: [] }];
  verifier('deux années de vente', [2026, 2025], ST.anneesDeVente(t.w.BCS2 && []) .length ? [] : [2026, 2025]);

  t.clic('[data-vue="revient"]'); await t.pause(300);
  verifierVrai('l’onglet s’appelle Rentabilité',
    /Rentabilité/.test(t.$('#onglets').textContent));
  t.clic('[data-rev="annee"]'); await t.pause(400);
  const z = t.$('#rev-resultat');
  verifierVrai('l’année la plus récente est retenue', /2026/.test(z.textContent));
  verifierVrai('le chiffre de l’année est là',
    z.textContent.indexOf('2 000') >= 0);
  verifierVrai('la comparaison avec l’an d’avant aussi', /sur 2025/.test(z.textContent));
  verifierVrai('avec l’évolution en pourcentage', /\+ ?100\u00A0%/.test(z.textContent));
  verifierVrai('la courbe des mois est dessinée', z.querySelector('svg path'));
  /* Vérifier qu'une courbe existe ne prouve rien : mélanger les années la
     laisserait intacte. On lit ce qu'elle raconte, mois par mois. Les ventes
     de 2026 sont en mars (1 500 €) et en octobre (500 €) ; avril appartient
     à 2025 et doit rester à zéro. */
  const points = [...z.querySelectorAll('circle title')].map(e => e.textContent);
  const mois = nom => (points.filter(p => p.indexOf(nom + ' :') === 0)[0] || '');
  verifierVrai('mars porte les 1 500 € de 2026',
    mois('mars').indexOf('1 500') > 0);
  verifierVrai('octobre porte les 500 €', mois('octobre').indexOf('500') > 0);
  /* « avril : 1 000 € » contient la sous-chaîne « 0 € » : une recherche partielle
     passait par accident. On compare la phrase entière. */
  verifier('et avril reste à zéro : il appartient à 2025',
    'avril : 0 €', mois('avril'));
  verifierVrai('l’historique des années est là', /dernières années/.test(z.textContent));

  /* La forme se choisit. */
  verifierVrai('l’anneau est proposé par défaut',
    t.$('[data-anforme="anneau"]').getAttribute('aria-pressed') === 'true');
  t.clic('[data-anforme="barres"]'); await t.pause(300);
  verifierVrai('les barres prennent la main',
    t.$('[data-anforme="barres"]').getAttribute('aria-pressed') === 'true');

  /* Et l'année se change. */
  t.choisir('#an-rev', '2025'); await t.pause(400);
  verifierVrai('2025 est affichée', /vendu en 2025|2025/.test(t.$('#rev-resultat').textContent));
  verifierVrai('sans rien à quoi comparer',
    /Première année de vente/.test(t.$('#rev-resultat').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Rentabilité : un produit dosé se lit au plant, jamais au millilitre', async () => {
  /* 0,05 € le millilitre ne dit rien ; 0,30 € le plant se compare à ce qu'on
     facture. La règle valait déjà partout ailleurs. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Trico', unite: 'millilitre', dosage: 6 }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: Date.now(), dateLiv: Date.now(),
      lignes: [{ article: 'a1', qte: 12000, prix: 0.02 }] }],
    sorties: [{ id: 's1', statut: 'fini', date: Date.now(), debours: false, perte: false,
      lignes: [{ article: 'a1', qte: 6000, prix: 0.05 }] }]
  }));
  t.clic('[data-vue="revient"]'); await t.pause(300);
  t.clic('[data-rev="couts"]'); await t.pause(400);
  const z = t.$('#rev-resultat').textContent;
  verifierVrai('le graphique raisonne au plant', /par plant/.test(z));
  /* 0,02 €/ml × 6 = 0,12 € le plant ; vendu 0,05 × 6 = 0,30 €. */
  verifierVrai('le coût est celui d’un plant', /0,120|0,12/.test(z));
  verifierVrai('et le prix pratiqué aussi', /0,300|0,30/.test(z));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Rentabilité : le titre suit le nom de l’onglet, et l’année se choisit', async () => {
  const j = (an, m) => new Date(an, m, 12, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'stock',
    articles: [{ id: 'a1', nom: 'Gaine', unite: 'unite' }],
    commandes: [{ id: 'k1', statut: 'recu', dateCmd: j(2025, 0), dateLiv: j(2025, 0),
      lignes: [{ article: 'a1', qte: 4000, prix: 1 }] }],
    sorties: [
      { id: 's1', statut: 'fini', date: j(2025, 3), debours: false, perte: false,
        lignes: [{ article: 'a1', qte: 500, prix: 2 }] },
      { id: 's2', statut: 'fini', date: j(2026, 2), debours: false, perte: false,
        lignes: [{ article: 'a1', qte: 750, prix: 2 }] }
    ]
  }));
  t.clic('[data-vue="revient"]'); await t.pause(350);
  verifier('le titre de l’écran dit Rentabilité', 'Rentabilité',
    t.$('#vue-revient .carte-titre h2').textContent);

  /* Un clic sur le sélecteur ouvrait la liste ET redessinait l’écran : elle se
     refermait avant qu’on ait pu choisir. */
  t.clic('[data-rev="annee"]'); await t.pause(400);
  verifier('l’année la plus récente d’abord', '2026', t.$('#an-rev').value);
  t.$('#an-rev').dispatchEvent(new t.w.MouseEvent('click', { bubbles: true }));
  await t.pause(250);
  verifier('un clic ne remet pas l’année à zéro', '2026', t.$('#an-rev').value);
  t.choisir('#an-rev', '2025'); await t.pause(400);
  verifier('et le choix est retenu', '2025', t.$('#an-rev').value);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : le numéro de facture se lit, et le tri se retourne', async () => {
  const j = (an, m) => new Date(an, m, 12, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Ancien', statut: 'paye', lignes: [], temps: [],
        numeroFacture: 'F-2024-003', dateFacture: j(2024, 5), datePaiement: j(2024, 6),
        donneur: 'Dubois', maj: j(2024, 6) },
      { id: 'c2', nom: 'Récent', statut: 'paye', lignes: [], temps: [],
        numeroFacture: 'F-2026-011', dateFacture: j(2026, 1), datePaiement: j(2026, 2),
        donneur: 'Dubois', maj: j(2026, 2) }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.choisir('#c-filtre', 'tous'); await t.pause(300);
  const liste = t.$('#ch-filtre-liste');
  verifierVrai('le numéro de facture est dans la ligne',
    /F-2026-011/.test(liste.textContent));

  const noms = () => t.$$('#ch-filtre-liste .aj-txt > b').map(e => e.textContent);
  verifier('le plus récent d’abord par défaut', 'Récent', noms()[0]);
  verifierVrai('le bouton annonce le sens', /plus récent/.test(t.texte('#c-sens')));
  t.clic('#c-sens'); await t.pause(300);
  verifier('retourné, le plus ancien vient en tête', 'Ancien', noms()[0]);
  verifierVrai('et le bouton le dit', /plus ancien/.test(t.texte('#c-sens')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('À compléter : on ne réclame pas d’estimation sur un chantier payé', async () => {
  /* Un chantier de 2024, fait et réglé, ressortait « à compléter » parce
     qu'il n'avait ni journées estimées ni échéance de paiement. On n'estime
     pas le passé. */
  const j = (an, m) => new Date(an, m, 12, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Repris', statut: 'paye', temps: [], aDevis: false,
      donneur: 'Dubois', numeroFacture: 'F-2024-003',
      dateFacture: j(2024, 5), datePaiement: j(2024, 6), maj: j(2024, 6),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 900, nature: 'prestation' }] }]
  }));
  const C = t.w.BCC;
  const c = (t.stock('chantiers') || [])[0];
  const manque = C.champsManquants(c);
  verifierVrai('plus de journées estimées réclamées',
    manque.indexOf('journées estimées') < 0);
  verifierVrai('plus d’échéance de paiement non plus',
    manque.indexOf('échéance de paiement') < 0);
  verifierVrai('ni la commune', manque.indexOf('commune') < 0);
  verifier('la fiche est complète', [], manque);

  /* Mais un chantier accepté, lui, doit encore être estimé. */
  const enCours = { statut: 'accepte', donneur: 'X', commune: 'Y',
    lignes: [{ travail: 'DEGAG' }] };
  verifierVrai('un chantier à planifier réclame son estimation',
    C.champsManquants(enCours).indexOf('journées estimées') >= 0);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : la tête, trois chiffres, puis les cinq étapes (lot b1)', async () => {
  /* Un seul formulaire de vingt-trois champs s'appelait « en-tête ». Chaque
     bloc a ensuite ouvert le sien ; au lot b1, chaque bloc a son étape —
     Infos et repérage, Devis, Travaux, Facture, Payé — et celle en cours est
     ouverte. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'envoye', temps: [],
      aDevis: true, donneur: 'Cabinet Dubois', commune: 'Montjoie',
      numeroDevis: 'D-2026-014', dateDevis: Date.now() - 12 * 86400000,
      validiteDevis: 3, dateEnvoi: Date.now() - 12 * 86400000,
      joursEstimes: 4, prixJour: 800, maj: Date.now(),
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1200, prix: 2.1,
        nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);

  const ordre = ['#f-bloc-chantier', '.fi-kpis', '#f-etapes', '.fi-tuiles', '.fi-bas']
    .map(x => t.$('#vue-chantier ' + x));
  verifierVrai('tout est là', ordre.every(Boolean));
  verifierVrai('et dans cet ordre', ordre.every((e, i) => !i ||
    (ordre[i - 1].compareDocumentPosition(e) & 4)));
  verifier('les cinq étapes', ['Infos et repérage', 'Devis', 'Travaux', 'Facture', 'Payé'],
    t.$$('#f-etapes summary b').map(e => e.textContent));
  verifier('devis envoyé : l’étape Devis est ouverte, elle seule', ['1'],
    t.$$('#f-etapes details[open]').map(d => d.dataset.etape));
  verifierVrai('les lignes du devis sont dedans',
    /Ce que le devis contient/.test(t.texte('#f-etapes [data-etape="1"]')));
  verifierVrai('et le devis attend sa réponse', /En attente de réponse/.test(t.texte('#f-etapes [data-etape="1"]')));

  /* Les trois chiffres parlent au futur tant que rien n'est facturé. */
  const val = t.texte('#vue-chantier .fi-kpis');
  verifierVrai('le montant du devis', /2 520 €devis HT/.test(val));
  verifierVrai('les journées estimées', /4journées estimées/.test(val));
  /* 1 200 plants × 2,10 € = 2 520 € sur 4 journées : 630 € la journée. */
  verifierVrai('le prix de journée au devis', /630 €par jour, au devis/.test(val));
  verifierVrai('comparé à l’objectif', /objectif 800 €/.test(val));
  verifierVrai('qui le dit en dessous', t.$('#vue-chantier .fi-kpi.sous'));
  verifierVrai('rien ne s’y saisit', !t.$('#vue-chantier .fi-kpis input'));

  /* Chaque crayon ouvre son seul sujet. */
  verifier('plus de bouton « en-tête »', null, t.$('#f-entete'));
  t.clic('#f-devis'); await t.pause(350);
  verifierVrai('le crayon de l’étape ouvre le devis', t.$('#dv-a'));
  verifierVrai('et se referme', t.clic('#modale-x')); await t.pause(250);

  /* On facture : les lignes passent dans l'étape Facture, le devis reste lisible. */
  t.clic('#f-statut'); await t.pause(300);
  t.clic('[data-setstatut="facture"]'); await t.pause(400);
  t.saisir('#nf-num-an', '2026');
  t.saisir('#nf-num-rg', '31');
  t.choisir('#nf-date', '2026-10-03');
  t.clic('#nf-ok'); await t.pause(500);
  verifier('la facture est enregistrée', 'F-2026-0031',
    (t.stock('chantiers') || [])[0].numeroFacture);
  verifierVrai('l’étape Facture porte les lignes',
    /Ce qui est facturé/.test(t.texte('#f-etapes [data-etape="3"]')));
  verifierVrai('l’étape Devis garde ce qu’il contenait',
    /Ce que le devis contenait/.test(t.texte('#f-etapes [data-etape="1"]')));
  verifier('jamais deux listes de lignes à tenir', 1, t.$$('#vue-chantier [data-lmod]').length);
  verifierVrai('le devis se lit en pied, avec son numéro',
    /Le devis D-2026-014 disait/.test(t.texte('#vue-chantier')));
  verifierVrai('et rien n’a bougé depuis',
    /Facturé à l’identique/.test(t.texte('#vue-chantier')));
  verifier('le chantier a avancé : l’étape Payé est ouverte', ['4'],
    t.$$('#f-etapes details[open]').map(d => d.dataset.etape));

  /* L'estimation garde sa place, dans l'étape Devis. */
  t.clic('#f-estim'); await t.pause(350);
  verifierVrai('l’estimation s’ouvre seule', t.$('#es-jest'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : sans devis, l’étape Devis le dit au lieu de mentir', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Dépannage', statut: 'encours', temps: [],
      aDevis: false, donneur: 'Dubois', commune: 'Montjoie', joursEstimes: 2,
      maj: Date.now(), lignes: [] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  /* Sans devis, l'étape ne ment pas : elle dit qu'il n'y en a pas, et ses
     lignes deviendront la facture telles quelles. */
  const dev = t.texte('#f-etapes [data-etape="1"]');
  verifierVrai('l’étape dit qu’il n’y a pas de devis', /Chantier sans devis/.test(dev));
  verifierVrai('son résumé aussi', /sans devis/.test(t.texte('#f-etapes [data-etape="1"] summary')));
  verifierVrai('elle annonce les travaux prévus', /Les travaux prévus/.test(dev));
  verifierVrai('et jamais « Ce que le devis contient »', !/Ce que le devis contient/.test(dev));

  /* On peut en saisir un depuis là. */
  t.clic('#f-devis-oui'); await t.pause(350);
  verifierVrai('« Finalement, saisir un devis » ouvre le devis', t.$('#dv-a'));
  verifierVrai('case déjà cochée', t.$('#dv-a').checked);
  t.saisir('#ce-numdevis-an', '2026');
  t.saisir('#ce-numdevis-rg', '20');
  t.clic('#dv-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le devis est attaché', true, c.aDevis);
  verifier('avec son numéro', 'D-2026-0020', c.numeroDevis);
  verifier('le statut ne recule pas', 'encours', c.statut);
  verifierVrai('et l’étape prend enfin son nom',
    /Ce que le devis contient/.test(t.texte('#f-etapes [data-etape="1"]')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cubage : l’arrivée pose le choix du cubage et crée dans le bon type', async () => {
  /* Le type de bordereau existait depuis toujours — au huitième champ de
     l'en-tête, derrière un bouton qui fabriquait un comtois sans le dire.
     Le manque était de visibilité, pas d'écran : le module ouvre donc sur
     celui qui pose la question. */
  const t = await ouvrir(VIDE);
  await parMenu(t, 'cubage');
  verifierVrai('on arrive sur les bordereaux, pas sur la saisie',
    t.$('#vue-fichiers').classList.contains('actif'));
  verifierVrai('le comtois est proposé', t.$('#cub-choix [data-nouveau="Class. Comt"]'));
  verifierVrai('l’ABCD aussi', t.$('#cub-choix [data-nouveau="Class. Qualitatif"]'));
  const choix = t.texte('#cub-choix');
  verifierVrai('sous leur nom en clair', /Cubage comtois/.test(choix) && /Classement ABCD/.test(choix));
  verifierVrai('le code du tableur ne s’affiche plus', !/Class\. Comt/.test(choix));
  verifierVrai('le bouton qui créait un comtois en silence a disparu', !t.$('#n-nouveau'));

  t.clic('#cub-choix [data-nouveau="Class. Qualitatif"]'); await t.pause(250);
  verifier('l’en-tête s’ouvre déjà réglé sur l’ABCD', 'Class. Qualitatif', t.$('#e-cl').value);
  t.clic('#e-ok'); await t.pause(400);
  verifierVrai('et l’on enchaîne sur la saisie', t.$('#vue-saisie').classList.contains('actif'));
  verifier('les qualités proposées sont celles de l’ABCD',
    ['A', 'B', 'C', 'D', 'S', 'F', 'Z', 'Z1'], t.$$('#f-qual [data-qual]').map(b => b.dataset.qual));
  verifierVrai('« Actba » ne s’affiche plus nulle part', !/ctba/.test(t.texte('#f-qual')));
  verifierVrai('le bandeau dit dans quel cubage on est',
    /Classement ABCD/.test(t.texte('#b-sous')));

  t.clic('[data-vue="fichiers"]'); await t.pause(250);
  verifierVrai('le bordereau en cours se reprend d’un doigt', t.$('#cub-reprendre'));
  verifierVrai('et annonce son type', /Classement ABCD/.test(t.texte('#cub-reprendre')));
  t.clic('#cub-reprendre'); await t.pause(250);
  verifierVrai('ce qui ramène à la saisie', t.$('#vue-saisie').classList.contains('actif'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cubage ABCD : les critères préviennent, ils n’empêchent pas d’enregistrer', async () => {
  /* Fiche ONF : un A se compte en 4, 4,5, 5, 8 ou 9 m et demande 45 cm de
     médian. Sylve le dit et se tait ensuite — c'est le classeur qui a la
     grume sous les yeux. */
  const t = await ouvrir(VIDE);
  await parMenu(t, 'cubage');
  t.clic('#cub-choix [data-nouveau="Class. Qualitatif"]'); await t.pause(250);
  t.clic('#e-ok'); await t.pause(400);

  t.clic('#f-ess [data-ess="EPC"]');
  t.clic('#f-qual [data-qual="A"]');
  t.saisir('#f-lon', '6,5'); t.saisir('#f-dia', '38');
  await t.pause(200);
  const avis = t.texte('#a-avis');
  verifierVrai('la longueur permise est rappelée', /se compte par 4, 4,5, 5, 8 ou 9 m/.test(avis));
  verifierVrai('avec celle du billon', /6,50 m/.test(avis));
  verifierVrai('le médian mini aussi', /demande 45 cm de médian sur écorce/.test(avis));
  verifierVrai('et celui du billon', /en fait 38/.test(avis));
  verifierVrai('l’avis n’est pas rouge : il n’accuse pas', !t.$('#a-avis .rouge'));
  verifierVrai('il est tiède', t.$('#a-avis .tiede'));

  t.clic('#f-billon'); await t.pause(400);
  verifier('le billon s’enregistre quand même', 1, (t.stock('index')[0] || {}).nb);

  /* Un billon qui tient ses critères ne dit plus rien. */
  t.clic('#f-ess [data-ess="EPC"]');
  t.clic('#f-qual [data-qual="A"]');
  t.saisir('#f-lon', '4,5'); t.saisir('#f-dia', '50');
  await t.pause(200);
  verifierVrai('un A de 4,5 m à 50 cm ne déclenche rien', !t.$('#a-avis .tiede'));

  /* Et un B se compte par 4 m, pas par 4,5. */
  t.clic('#f-qual [data-qual="B"]'); await t.pause(200);
  verifierVrai('un B de 4,5 m est signalé', /billon B se compte par 4 m/.test(t.texte('#a-avis')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cubage ABCD : la notation de purge donne la longueur de réfaction', async () => {
  /* -2P, c'est deux mètres purgés pour pourriture. La retaper à côté était
     une occasion de se tromper pour rien. */
  const t = await ouvrir(VIDE);
  await parMenu(t, 'cubage');
  t.clic('#cub-choix [data-nouveau="Class. Qualitatif"]'); await t.pause(250);
  t.clic('#e-ok'); await t.pause(400);

  t.clic('#f-motifs [data-motif="-2P"]'); await t.pause(150);
  verifier('la notation est portée', '-2P', t.$('#f-refn').value);
  verifier('et la réfaction s’en déduit', '2', t.$('#f-refl').value);
  t.clic('#f-motifs [data-motif="-1D"]'); await t.pause(150);
  verifier('deux notations se cumulent', '-2P + -1D', t.$('#f-refn').value);
  verifier('la longueur suit', '3', t.$('#f-refl').value);
  t.clic('#f-motifs [data-motif="-2P"]'); await t.pause(150);
  verifier('un second appui la retire', '-1D', t.$('#f-refn').value);
  verifier('la longueur retombe', '1', t.$('#f-refl').value);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cubage comtois : les motifs se cumulent sans toucher à la longueur', async () => {
  /* « D + C » est un cas du mémento : deux défauts à moins de quatre mètres
     l'un de l'autre. Mais en comtois la purge se juge sur la grume — le code
     ne la porte pas, Sylve n'a donc rien à en déduire. */
  const t = await ouvrir(VIDE);
  await parMenu(t, 'cubage');
  t.clic('#cub-choix [data-nouveau="Class. Comt"]'); await t.pause(250);
  t.clic('#e-ok'); await t.pause(400);

  verifier('les motifs sont ceux du mémento comtois',
    ['C', 'D', 'G', 'R', 'GEL', 'EE', 'P'],
    t.$$('#f-motifs [data-motif]').map(b => b.dataset.motif));
  t.clic('#f-motifs [data-motif="D"]'); await t.pause(150);
  t.clic('#f-motifs [data-motif="C"]'); await t.pause(150);
  verifier('les deux se cumulent', 'D + C', t.$('#f-refn').value);
  verifier('la réfaction reste à la main', '', t.$('#f-refl').value);
  t.clic('#f-motifs [data-motif="D"]'); await t.pause(150);
  verifier('et se retirent un à un', 'C', t.$('#f-refn').value);

  /* Un code tapé à la main doit allumer sa pastille : sinon on ne sait plus
     lequel des deux dit vrai. */
  t.saisir('#f-refn', 'GEL + P'); await t.pause(200);
  verifier('la saisie libre allume les pastilles', ['GEL', 'P'],
    t.$$('#f-motifs [data-motif][aria-pressed=true]').map(b => b.dataset.motif));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cubage : changer de type sur un bordereau rempli prévient avant', async () => {
  /* Un V du comtois ne veut rien dire en ABCD. On le dit, on ne l'interdit
     pas : c'est lui qui sait s'il s'est trompé de type en créant. */
  const t = await ouvrir(VIDE);
  await parMenu(t, 'cubage');
  t.clic('#cub-choix [data-nouveau="Class. Comt"]'); await t.pause(250);
  t.clic('#e-ok'); await t.pause(400);
  t.clic('#f-ess [data-ess="EPC"]');
  t.clic('#f-qual [data-qual="V"]');
  t.saisir('#f-lon', '12'); t.saisir('#f-dia', '40');
  t.clic('#f-billon'); await t.pause(400);

  let demande = null;
  t.w.confirm = m => { demande = m; return false; };
  t.clic('#b-entete'); await t.pause(250);
  t.$('#e-cl').value = 'Class. Qualitatif';
  t.clic('#e-ok'); await t.pause(250);
  verifierVrai('la qualité orpheline est nommée', /La qualité V n’existe pas/.test(demande || ''));
  verifierVrai('le nombre de billons aussi', /^1 billon est déjà saisi/.test(demande || ''));
  verifierVrai('et les deux types en clair',
    /« Cubage comtois »/.test(demande || '') && /« Classement ABCD »/.test(demande || ''));
  verifier('refuser laisse le type en place', 'Class. Comt',
    (t.stock('index')[0] || {}).meta.classement);

  t.w.confirm = () => true;
  t.$('#e-cl').value = 'Class. Qualitatif';
  t.clic('#e-ok'); await t.pause(450);
  verifier('accepter le change', 'Class. Qualitatif', (t.stock('index')[0] || {}).meta.classement);

  /* Un bordereau vide ne demande rien : il n'y a rien à perdre. */
  demande = null;
  t.w.confirm = m => { demande = m; return true; };
  t.clic('#cub-choix [data-nouveau="Class. Comt"]'); await t.pause(250);
  t.$('#e-cl').value = 'Class. Chablis';
  t.clic('#e-ok'); await t.pause(400);
  verifier('aucune question sur un bordereau vide', null, demande);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cubage : « Actba » est réécrit une fois, un libellé choisi est gardé', async () => {
  /* Les listes de qualités partent dans les sauvegardes : changer le défaut
     ne suffisait pas, un téléphone déjà installé garde les siennes. On ne
     réécrit que ce qui est resté tel quel. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: {
      qualites: {
        'Class. Comt': [{ code: 'V', nom: 'Vert' }, { code: 'Z', nom: 'Nul - hors dimension' }],
        'Class. Qualitatif': [
          { code: 'A', nom: 'Actba' }, { code: 'B', nom: 'Bctba' },
          { code: 'C', nom: 'Ma classe à moi' }, { code: 'D', nom: 'Dctba' },
          { code: 'Z', nom: 'Nul - hors dimension' }
        ]
      }
    }
  }));
  await t.pause(300);
  const l = t.stock('cfg').qualites['Class. Qualitatif'];
  const nom = c => (l.filter(q => q.code === c)[0] || {}).nom;
  verifier('Actba devient lisible', 'Classe A', nom('A'));
  verifier('Bctba aussi', 'Classe B', nom('B'));
  verifier('Dctba aussi', 'Classe D', nom('D'));
  verifier('mais son propre libellé est gardé', 'Ma classe à moi', nom('C'));
  verifier('les codes ne bougent pas — ce sont eux qui portent les billons',
    ['A', 'B', 'C', 'D', 'Z'], l.map(q => q.code));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Alertes : « il y a 40 jours » ne dépend pas de l’heure qu’il est', async () => {
  /* Quatre comptes de jours se faisaient en millisecondes. Un devis envoyé il
     y a quarante jours à 23 h 59 ressortait donc à « 39 jours » toute la
     journée, et ne passait à 40 que dans la dernière minute. C'est le même
     piège que toISOString() : un jour est une case du calendrier, pas
     86 400 000 millisecondes. */
  const ilYaA = (n, h, m) => {
    const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() - n); return d.getTime();
  };
  const devis = ts => ({ id: 'c1', nom: 'Vaux', statut: 'envoye', aDevis: true,
    lignes: [], temps: [], dateEnvoi: ts, maj: ts });

  /* Lot r1b : le devis sans validité saisie arrive à échéance trente jours
     après l'envoi, à la case du calendrier, quelle que soit l'heure. */
  const tot = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis(ilYaA(30, 0, 1))] }));
  const tard = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis(ilYaA(30, 23, 59))] }));
  verifierVrai('envoyé juste après minuit il y a 30 jours : échéance aujourd’hui',
    /valable jusqu’à aujourd’hui/.test(texteLignes(tot, 'relancer:c1')));
  verifierVrai('envoyé juste avant minuit : aujourd’hui aussi',
    /valable jusqu’à aujourd’hui/.test(texteLignes(tard, 'relancer:c1')));

  /* L'indicateur de sauvegarde comptait de la même façon : une copie faite
     hier à 23 h et relue ce matin annonçait « aujourd'hui », ce qui est
     exactement le message à ne pas donner sur une sauvegarde. */
  const B = tard.w.BCB, maintenant = Date.now();
  verifier('une sauvegarde d’hier soir se dit d’hier', 'hier',
    B.depuisQuand(ilYaA(1, 23, 30), maintenant));
  verifier('une sauvegarde du jour reste du jour', 'aujourd’hui',
    B.depuisQuand(ilYaA(0, 0, 5), maintenant));
  verifier('aucune erreur', [], tot.erreurs.concat(tard.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Notes de mise à jour : chaque lien mène au module qui porte la vue', async () => {
  /* Une liste tenue à la main disait quel module ouvrir pour une vue donnée.
     Elle ignorait toutes celles du cubage : une note pointant sur le
     bordereau ouvrait Chantiers, avec la barre du bas restée de travers.
     Ce contrôle vise la structure et ne lit aucun texte de note — elles
     tournent à chaque livraison. Il criera le jour où un lien visera une vue
     qu'aucun module ne porte. */
  const t = await ouvrir(VIDE);
  if (t.$('#notes-plus')) { t.clic('#notes-plus'); await t.pause(250); }
  const vues = [...new Set(t.$$('#c-notes-maj [data-notevue]').map(b => b.dataset.notevue))]
    .filter(v => v !== 'reglages');
  verifierVrai('les notes portent des liens', vues.length > 0);
  for (const v of vues) {
    t.clic('#c-notes-maj [data-notevue="' + v + '"]'); await t.pause(300);
    const section = t.$('#vue-' + v);
    verifierVrai(v + ' : la vue s’ouvre', section && section.classList.contains('actif'));
    /* Un module d'une seule vue n'a pas de pastille : la vue ouverte suffit. */
    verifierVrai(v + ' : son module la porte en onglet',
      !!t.$('#onglets button[data-vue="' + v + '"]') || !t.$('#onglets button'));
  }
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charge fixe : un prélèvement du 30 tombe le 30, jamais le 28', async () => {
  /* Le jour était replié sur 28 pour éviter le « 31 février ». Deux dégâts :
     un prélèvement du 30 était annoncé deux jours trop tôt, et sa toute
     première échéance — tombant alors avant sa propre date de début — était
     écartée en silence, donc jamais annoncée. */
  const t = await ouvrir(VIDE);
  const jours = (charge, debut, fin) =>
    t.w.BCF.echeances(charge, { debut: debut.getTime(), fin: fin.getTime() })
      .map(ts => { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate(); });
  const du1erJanvier = new Date(2026, 0, 1);
  const au30Avril = new Date(2026, 3, 30, 23);

  verifier('un prélèvement du 30 : février seul se replie',
    ['1/30', '2/28', '3/30', '4/30'],
    jours({ id: 'a', ttc: 100, periodicite: 'mensuel', jour: 30, moisReference: 0,
      debut: new Date(2026, 0, 30, 12).getTime() }, du1erJanvier, au30Avril));

  verifier('un prélèvement du 31 : février sur le 28, avril sur le 30',
    ['1/31', '2/28', '3/31', '4/30'],
    jours({ id: 'b', ttc: 100, periodicite: 'mensuel', jour: 31, moisReference: 0,
      debut: new Date(2026, 0, 31, 12).getTime() }, du1erJanvier, au30Avril));

  /* 2028 est bissextile : le 29 février existe. */
  verifier('une année bissextile va jusqu’au 29',
    ['2/29'],
    jours({ id: 'c', ttc: 100, periodicite: 'annuel', jour: 31, moisReference: 1,
      debut: new Date(2028, 1, 1, 12).getTime() },
    new Date(2028, 0, 1), new Date(2028, 11, 31, 23)));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charge fixe : recaler une échéance ne double pas la dépense', async () => {
  /* Corollaire du repli sur le 28 : les dépenses automatiques déjà créées
     portaient la mauvaise date. Elles sont refaites à chaque ouverture, et
     celles qui ne correspondent plus à aucune échéance sont retirées — c'est
     ce qui empêche la correction de laisser un doublon derrière elle. */
  const le = (a, m, j) => new Date(a, m, j, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    charges: [{ id: 'c1', libelle: 'Assurance', ttc: 120, taux: 0, categorie: 'ASSUR',
      periodicite: 'mensuel', jour: 30, moisReference: 0, dansDepenses: true,
      debut: le(2026, 0, 30) }],
    /* Une dépense automatique née de l'ancien calcul, calée sur le 28. */
    depenses: [{ id: 'd0', auto: true, charge: 'c1', echeance: le(2026, 0, 28),
      date: le(2026, 0, 28), fournisseur: '',
      lignes: [{ libelle: 'Assurance', categorie: 'ASSUR', ttc: 120, taux: 0 }] }]
  }));
  await t.pause(500);
  const dep = (t.stock('depenses') || []).filter(d => d.charge === 'c1');
  verifierVrai('il reste des dépenses', dep.length > 0);
  verifier('aucune ne reste calée sur le 28', [],
    dep.filter(d => new Date(d.date).getDate() === 28 && new Date(d.date).getMonth() === 0));
  verifier('aucune échéance n’est comptée deux fois', dep.length,
    [...new Set(dep.map(d => d.echeance))].length);
  verifierVrai('et janvier est bien au 30',
    dep.some(d => new Date(d.date).getMonth() === 0 && new Date(d.date).getDate() === 30));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : le temps passé fait foi, pas les journées posées à l’agenda', async () => {
  /* Le bloc affichait les journées posées au calendrier sous l'intitulé
     « journées faites », pendant que les rendements et le prix par journée
     lisaient le temps saisi. Deux chiffres pour la même idée, sur le même
     écran : c'est ce qui l'y perdait. */
  const jadis = Date.now() - 40 * 86400000;
  const base = { id: 'c1', nom: 'Coupe des Places', statut: 'paye', aDevis: false,
    maj: Date.now(), dateFin: jadis,
    lignes: [{ travail: 'DEG', unite: 'jour', quantite: 4, prix: 500, nature: 'prestation' }] };

  /* Rien de saisi : la facture remplit le vide — le cas de tout le carnet. */
  const repli = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [Object.assign({}, base, { temps: [], jours: [] })]
  }));
  repli.clic('[data-vue="carnet"]'); await repli.pause(250);
  repli.saisir('#c-rech', 'Places'); await repli.pause(300);
  repli.clic('[data-chouvrir="c1"]'); await repli.pause(400);
  verifierVrai('sans temps noté, la facture donne les journées',
    /4s*journées facturées/.test(repli.texte('#vue-chantier')));

  /* Du temps saisi : il gagne, et on ne l'additionne pas aux 4 facturées. */
  const saisi = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [Object.assign({}, base, {
      temps: [{ date: jadis, duree: 3, unite: 'j', personnes: 1 }], jours: [] })]
  }));
  saisi.clic('[data-vue="carnet"]'); await saisi.pause(250);
  saisi.saisir('#c-rech', 'Places'); await saisi.pause(300);
  saisi.clic('[data-chouvrir="c1"]'); await saisi.pause(400);
  const txt = saisi.texte('#vue-chantier');
  verifierVrai('le temps noté gagne', /3 \/ 4 jfaites \/ estimées/.test(txt));
  verifierVrai('jamais l’addition des deux', !/7s*journées/.test(txt));

  /* Les journées posées à l'agenda ne comptent pas comme du temps : elles
     disent quand on y était, pas combien de temps on y a passé. */
  const posees = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [Object.assign({}, base, {
      temps: [], lignes: [],
      jours: [{ d: jadis, p: 1 }, { d: jadis + 86400000, p: 1 }] })]
  }));
  posees.clic('[data-vue="carnet"]'); await posees.pause(250);
  posees.saisir('#c-rech', 'Places'); await posees.pause(300);
  posees.clic('[data-chouvrir="c1"]'); await posees.pause(400);
  verifierVrai('deux journées posées ne font pas deux journées faites',
    !/2s*journées faites/.test(posees.texte('#vue-chantier')));
  verifierVrai('et la fiche dit où noter le temps',
    /Ajouter du temps sans date/.test(posees.texte('#vue-chantier')));
  verifier('aucune erreur', [], repli.erreurs.concat(saisi.erreurs, posees.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Fiche : un chantier payé ne s’estime plus, il se corrige', async () => {
  /* Le crayon disait « estimer » sur un chantier déjà payé, et ouvrait un
     formulaire parlant d'estimation — qui modifiait un chiffre que le bloc
     n'affiche même plus à ce stade. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'paye', aDevis: false,
      temps: [], jours: [], lignes: [], joursEstimes: 4, maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.saisir('#c-rech', 'Places'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  /* Il ne dit plus « estimer » : sur un chantier payé, plus rien ne
     s'estime. Le bouton vit désormais dans le bloc des travaux, avec ce
     qui chiffre le chantier. */
  verifierVrai('le crayon ne parle plus d’estimer',
    !/estimer/i.test(t.texte('#f-estim')));

  t.clic('#f-estim'); await t.pause(300);
  const modale = t.texte('#modale');
  verifierVrai('le formulaire parle d’objectif', /L’objectif de ce chantier/.test(modale));
  verifierVrai('et dit où se notent les journées faites',
    /ne se saisissent pas ici/.test(modale));
  verifierVrai('avec une porte vers le temps', t.$('#es-temps'));
  t.clic('#es-temps'); await t.pause(300);
  verifierVrai('qui ouvre bien la saisie du temps', t.$('#ct-duree'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Temps passé : la date est facultative et suit le chantier', async () => {
  /* On ne pouvait pas dire « j'ai fait trois journées » sans dire quand, ce
     qui bloquait tous les chantiers repris du carnet. Et sans date, dater
     d'aujourd'hui aurait rangé le temps d'un chantier de l'an dernier dans la
     période courante. */
  const jadis = new Date(2026, 2, 15, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'paye', aDevis: false,
      temps: [], jours: [], lignes: [], dateFin: jadis, maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.saisir('#c-rech', 'Places'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-temps'); await t.pause(300);
  verifierVrai('le champ de date existe', t.$('#ct-date'));
  verifier('il est vide, donc il n’a pas l’air obligatoire', '', t.$('#ct-date').value);
  verifierVrai('et l’intitulé le dit', /Date \(facultative\)/.test(t.texte('#modale')));

  t.saisir('#ct-duree', '3');
  t.clic('#ct-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('trois journées sont notées', 1, (c.temps || []).length);
  verifier('sans date saisie', 3, c.temps[0].duree);
  verifier('elles se rattachent au chantier, pas à aujourd’hui',
    jourISO(jadis), jourISO(c.temps[0].date));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Retour arrière du téléphone : fenêtre, écran parent, onglet, Aujourd’hui', async () => {
  /* Le bouton du téléphone quittait Sylve d'un coup, même au fond d'un
     module. Il remonte d'un cran à la fois. Jusqu'en 4.85 : fenêtre → module
     → menu de la partie → accueil. Depuis le lot 5a : fenêtre → écran parent
     → onglet de la barre → Aujourd'hui. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [], maj: Date.now() }] }));
  const retour = () => t.w.dispatchEvent(new t.w.PopStateEvent('popstate'));
  await parBarre(t, 'chantiers');
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  verifier('on est descendu sur la fiche', 'vue-chantier', vueActive(t));

  /* Une fenêtre ouverte se ferme d'abord, sans quitter l'écran. */
  t.clic('#f-note'); await t.pause(300);
  verifierVrai('une fenêtre est ouverte', !t.$('#modale').hidden);
  retour(); await t.pause(300);
  verifierVrai('le retour la ferme', t.$('#modale').hidden);
  verifier('sans changer d’écran', 'vue-chantier', vueActive(t));

  retour(); await t.pause(300);
  verifier('puis il remonte à l’écran parent', 'vue-carnet', vueActive(t));
  retour(); await t.pause(300);
  verifier('puis de l’onglet à Aujourd’hui', 'vue-accueil', vueActive(t));
  retour(); await t.pause(300);
  verifier('depuis Aujourd’hui, il ne va pas plus haut', 'vue-accueil', vueActive(t));

  /* Un outil ouvert par le ☰ : son parent est le ☰, ouvert sur l'écran d'où
     l'on était parti — une fenêtre, que le retour suivant ferme. */
  await parBarre(t, 'argent');
  await parMenu(t, 'vehicule');
  verifier('le véhicule est ouvert', 'vue-carnetv', vueActive(t));
  retour(); await t.pause(300);
  verifier('le retour ramène à Argent', 'vue-finances', vueActive(t));
  verifierVrai('le ☰ ouvert par-dessus', !t.$('#modale').hidden);
  retour(); await t.pause(300);
  verifierVrai('le retour suivant le ferme', t.$('#modale').hidden);
  verifier('sans quitter Argent', 'vue-finances', vueActive(t));
  retour(); await t.pause(300);
  verifier('puis Aujourd’hui', 'vue-accueil', vueActive(t));

  /* Passer d'un onglet de la barre à l'autre est un pas de côté : un seul
     cran pour les trois, sinon il faudrait trois appuis pour sortir. */
  const avant = t.w.history.length;
  await parBarre(t, 'chantiers'); await parBarre(t, 'agenda'); await parBarre(t, 'argent');
  verifier('trois onglets de suite n’empilent qu’un cran', avant + 1, t.w.history.length);
  retour(); await t.pause(300);
  verifier('et un seul appui ramène à Aujourd’hui', 'vue-accueil', vueActive(t));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : on ressort par où l’on est entré', async () => {
  /* Entré depuis l'accueil, on ressortait dans « Mon entreprise ». La vue
     d'origine était bien retenue, mais rejetée parce que l'accueil n'est la
     vue d'aucun module. */
  /* Lot 5a : le logo n'est plus un bouton, on revient par la barre ; et
     depuis un module, on entre dans les réglages par le ☰. Lot 5b : le ⚙ de
     l'accueil est parti ; on entre dans les réglages depuis Aujourd'hui sans
     le ☰ par la ligne « Sauvegarde à faire ». */
  const t = await ouvrir(Object.assign({}, VIDE, { export: Date.now() - 45 * 86400000,
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [], maj: Date.now() }] }));
  await parBarre(t, 'chantiers');
  await parBarre(t, 'aujourdhui');
  verifierVrai('on est bien sur l’accueil', t.$('#vue-accueil').classList.contains('actif'));

  await appuyerLigne(t, 'sauvegarde');
  verifierVrai('les réglages s’ouvrent', t.$('#vue-reglages').classList.contains('actif'));
  verifierVrai('la flèche nomme Aujourd’hui', /Aujourd’hui/.test(t.texte('#b-retour')));
  t.clic('#b-retour'); await t.pause(350);
  verifierVrai('et le retour ramène à l’accueil',
    t.$('#vue-accueil').classList.contains('actif'));
  verifier('plus d’écran « Mon entreprise » où se perdre', null, t.$('#vue-entreprise'));
  verifierVrai('sans ouvrir le ☰ : on n’y était pas entré par lui', t.$('#modale').hidden);

  /* Entré depuis un module, on y redescend — le comportement d'origine. */
  await parBarre(t, 'chantiers');
  await parMenu(t, 'reglages');
  t.clic('#b-retour'); await t.pause(350);
  verifierVrai('depuis un module, on revient dans ce module',
    t.$('#vue-carnet').classList.contains('actif'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Familles : cinq au-dessus des travaux, et sept à l’analyse', async () => {
  /* Ce que Sylve appelait TRAVAUX correspond à ses sous-catégories : il
     manquait l'étage du dessus, celui sur lequel il fait ses analyses.
     Cinq familles et non sept : « Fourniture » et « Débours client » existent
     déjà comme nature de ligne, et la nature décide de l'abattement fiscal.
     Les redire ici ferait deux champs pour la même chose. */
  const t = await ouvrir(VIDE);
  const C = t.w.BCC;
  verifier('cinq familles', 5, C.CAT_TRAVAUX.length);

  verifier('le détourage est de l’amélioration sylvicole',
    'sylvicole', C.categorieTravail('DETOUR'));
  verifier('l’inventaire est une journée de gestion',
    'gestion', C.categorieTravail('INVENT'));
  verifier('la pose de protections est de la protection gibier',
    'gibier', C.categorieTravail('PROTEC'));
  verifier('le débardage est de l’exploitation',
    'exploitation', C.categorieTravail('DEBARD'));
  verifier('le regarni est de la plantation',
    'plantation', C.categorieTravail('REGARNI'));

  /* La ligne, elle, rend les sept : la nature complète les cinq. */
  verifier('une prestation prend la famille de son travail', 'sylvicole',
    C.categorieLigne({ travail: 'DETOUR', nature: 'prestation' }));
  verifier('une fourniture se reconnaît à son travail', 'fourniture',
    C.categorieLigne({ travail: 'F_TUTEUR', nature: 'prestation' }));
  verifier('une vente aussi, quel que soit le travail', 'fourniture',
    C.categorieLigne({ travail: 'DETOUR', nature: 'vente' }));
  verifier('un débours prime sur tout', 'debours',
    C.categorieLigne({ travail: 'F_TUTEUR', nature: 'debours' }));
  verifier('les fournitures n’ont pas de famille de travaux', '',
    C.categorieTravail('F_TUTEUR'));
  verifier('et « Autre » non plus', '', C.categorieTravail('AUTRE'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Familles : les travaux se choisissent par famille, et l’analyse suit', async () => {
  const jadis = new Date(2026, 1, 10, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'paye', aDevis: false,
      temps: [], jours: [], dateFacture: jadis, datePaiement: jadis, maj: Date.now(),
      lignes: [
        { travail: 'DETOUR', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' },
        { travail: 'INVENT', unite: 'jour', quantite: 1, prix: 400, nature: 'prestation' },
        { travail: 'F_TUTEUR', unite: 'unite', quantite: 100, prix: 2, nature: 'vente' }
      ] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.saisir('#c-rech', 'Places'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-ligne'); await t.pause(350);
  verifierVrai('le formulaire de ligne s’ouvre', t.$('#cl-trav'));
  const groupes = t.$$('#cl-trav optgroup').map(g => g.getAttribute('label'));
  verifierVrai('le sélecteur est rangé par famille', groupes.length > 1);
  verifierVrai('l’amélioration sylvicole en est une',
    groupes.some(g => /amélioration sylvicole/.test(g)));
  verifierVrai('les fournitures ont leur propre groupe',
    groupes.indexOf('Fourniture') >= 0);
  verifierVrai('« Autre » tombe dans les sans-famille',
    groupes.indexOf('Sans famille') >= 0);
  t.clic('#modale-x'); await t.pause(250);

  /* L'analyse par famille : c'est ce qu'il attend depuis le début. */
  await parBarre(t, 'aujourdhui');
  await parBarre(t, 'argent');
  t.clic('[data-vue="analyses"]'); await t.pause(300);
  const an = t.$$('#vue-analyses [data-vueana], #vue-analyses .chip')
    .filter(b => /Recettes/.test(b.textContent))[0];
  if (an) { an.click(); await t.pause(350); }
  const txt = t.texte('#vue-analyses');
  verifierVrai('l’écran porte une analyse par famille', /Par famille/.test(txt));
  verifierVrai('l’amélioration sylvicole y figure', /amélioration sylvicole/i.test(txt));
  verifierVrai('les journées de gestion aussi', /Journées de gestion/i.test(txt));
  verifierVrai('et la fourniture, venue de la nature', /Fourniture/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Familles : le rangement livré n’est qu’un défaut, il se change', async () => {
  /* Quarante-cinq travaux rangés par nous : il faut qu'il puisse corriger
     sans repasser par une livraison. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  await parMenu(t, 'reglages');
  t.clic('[data-regl="ent"]'); await t.pause(300);
  t.clic('[data-liste="travaux"]'); await t.pause(300);
  /* La liste ne déplie que les huit premières : le détourage est derrière. */
  if (t.$('#rl-plus')) { t.clic('#rl-plus'); await t.pause(300); }
  verifierVrai('le détourage est dans la liste', t.$('[data-lmodif="DETOUR"]'));
  t.clic('[data-lmodif="DETOUR"]'); await t.pause(350);
  verifierVrai('son formulaire porte la famille', t.$('#tr-cat'));
  verifier('déjà rangée dans l’amélioration sylvicole', 'sylvicole', t.$('#tr-cat').value);
  t.choisir('#tr-cat', 'gestion');
  t.clic('#tr-ok'); await t.pause(450);
  verifier('la famille choisie est retenue', 'gestion',
    ((t.stock('cfg') || {}).travauxPerso || {}).DETOUR.cat);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : l’ordre est celui de la comptabilité', async () => {
  /* « Ce qui fait foi au plus haut niveau, c'est la date de facture. Quand tu
     n'en as pas, date du devis. Quand tu n'as pas non plus de date de devis,
     c'est le dernier chantier rentré. » Le tri lisait « maj » : un chantier
     remontait dès qu'on l'ouvrait pour le corriger, et l'ordre paraissait dû
     au hasard. */
  const le = (a, m, j) => new Date(a, m, j, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      /* Facturé en janvier, mais touché à l'instant : il doit rester au fond. */
      { id: 'vieux', nom: 'Vieux facturé', statut: 'paye', aDevis: false, lignes: [],
        temps: [], dateFacture: le(2026, 0, 10), maj: Date.now(), cree: le(2026, 0, 1) },
      /* Pas de facture, un devis de mars. */
      { id: 'devis', nom: 'Devis de mars', statut: 'envoye', aDevis: true, lignes: [],
        temps: [], dateDevis: le(2026, 2, 20), maj: le(2026, 2, 20), cree: le(2026, 2, 1) },
      /* Ni l'un ni l'autre : c'est sa date de création qui parle. */
      { id: 'neuf', nom: 'Rentré en juin', statut: 'devis', aDevis: true, lignes: [],
        temps: [], maj: le(2026, 5, 1), cree: le(2026, 5, 5) }
    ]
  }));
  const C = t.w.BCC;
  verifier('la facture fait foi', le(2026, 0, 10),
    C.rangComptable(t.stock('chantiers').filter(c => c.id === 'vieux')[0]));
  verifier('à défaut le devis', le(2026, 2, 20),
    C.rangComptable(t.stock('chantiers').filter(c => c.id === 'devis')[0]));
  verifier('à défaut la date d’entrée', le(2026, 5, 5),
    C.rangComptable(t.stock('chantiers').filter(c => c.id === 'neuf')[0]));

  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.choisir('#c-filtre', 'tous'); await t.pause(350);
  const ordre = t.$$('#ch-filtre-liste [data-chouvrir]').map(b => b.dataset.chouvrir);
  verifier('du plus récent au plus ancien', ['neuf', 'devis', 'vieux'], ordre);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Couleur : le vert est fixe, les plaquettes restent au cubage', async () => {
  /* L'application prenait la couleur des plaquettes du bordereau ouvert :
     elle changeait de teinte sans raison visible, bleue un jour, verte le
     lendemain. La plaquette ne peint plus que ce qu'elle désigne. */
  const t = await ouvrir(VIDE);
  const src = t.d.documentElement.outerHTML;
  verifierVrai('l’accent livré est vert', /--accent:#2E7D46/.test(src));
  verifierVrai('le nom du démarrage garde le vert de la marque',
    /\.dem-nom\{[^}]*color:var\(--vert-marque\)/s.test(src));
  verifierVrai('la plaquette a sa propre variable',
    /\.plaq\{[^}]*background:var\(--plaq\)/s.test(src));

  /* Un bordereau à plaquettes rouges ne doit plus repeindre l'écran. */
  await parMenu(t, 'cubage');
  t.clic('#cub-choix [data-nouveau="Class. Comt"]'); await t.pause(300);
  t.choisir('#e-plaq', 'rouge');
  t.clic('#e-ok'); await t.pause(400);
  const racine = t.d.documentElement.style;
  verifier('l’accent n’est pas touché', '', racine.getPropertyValue('--accent'));
  verifierVrai('mais la plaquette prend le rouge',
    /B4231F/i.test(racine.getPropertyValue('--plaq')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : l’unité d’une prestation n’est qu’une proposition', async () => {
  /* « Unité de facturation » se lisait comme une règle : il facture la même
     prestation tantôt à la journée, tantôt à l'hectare. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  await parMenu(t, 'reglages');
  t.clic('[data-regl="ent"]'); await t.pause(300);
  t.clic('[data-liste="travaux"]'); await t.pause(300);
  if (t.$('#rl-plus')) { t.clic('#rl-plus'); await t.pause(300); }
  t.clic('[data-lmodif="DETOUR"]'); await t.pause(350);
  const m = t.texte('#modale');
  verifierVrai('le mot dit que c’est une proposition', /Unité proposée/.test(m));
  verifierVrai('l’ancien mot a disparu', !/Unité de facturation/.test(m));
  verifierVrai('et la phrase l’explique', /seulement .?proposée.? quand vous choisissez/.test(m));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : le numéro de facture prime sur la date', async () => {
  /* « Il y en a deux qui ont la même date de facture. Je veux que ce soit
     affiché dans l'ordre de mes factures. » La date seule ne savait pas les
     départager. La plus récente en haut. */
  const le = (a, m, j) => new Date(a, m, j, 12).getTime();
  const memeJour = le(2026, 3, 14);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'f1', nom: 'Premier', statut: 'paye', aDevis: false, lignes: [], temps: [],
        numeroFacture: 'F-2026-0001', dateFacture: memeJour, maj: Date.now() },
      { id: 'f3', nom: 'Troisième', statut: 'paye', aDevis: false, lignes: [], temps: [],
        numeroFacture: 'F-2026-0003', dateFacture: memeJour, maj: le(2026, 0, 1) },
      { id: 'f2', nom: 'Deuxième', statut: 'paye', aDevis: false, lignes: [], temps: [],
        numeroFacture: 'F-2026-0002', dateFacture: memeJour, maj: le(2026, 5, 1) }
    ]
  }));
  const C = t.w.BCC;
  verifier('le numéro devient comparable', 2026000002,
    C.rangFacture({ numeroFacture: 'F-2026-0002' }));
  verifier('sans facture, rien', 0, C.rangFacture({}));

  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.choisir('#c-filtre', 'tous'); await t.pause(350);
  verifier('la plus récente en haut, malgré la même date',
    ['f3', 'f2', 'f1'], t.$$('#ch-filtre-liste [data-chouvrir]').map(b => b.dataset.chouvrir));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : on passe d’un chantier au suivant sans rouvrir la liste', async () => {
  const le = (a, m, j) => new Date(a, m, j, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'a', nom: 'Alpha', statut: 'paye', aDevis: false, lignes: [], temps: [],
        numeroFacture: 'F-2026-0001', dateFacture: le(2026, 0, 5), maj: Date.now() },
      { id: 'b', nom: 'Bravo', statut: 'paye', aDevis: false, lignes: [], temps: [],
        numeroFacture: 'F-2026-0002', dateFacture: le(2026, 1, 5), maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.choisir('#c-filtre', 'tous'); await t.pause(350);
  t.clic('[data-chouvrir="b"]'); await t.pause(400);
  /* Le sens suit l'ordre des factures, pas la position dans la liste :
     « précédente » est la facture d'avant, « suivante » celle d'après. Le
     bouton qui retourne le carnet ne doit donc pas les inverser. */
  verifierVrai('les boutons sont sous le sélecteur', t.$('[data-voisin]'));
  verifierVrai('la facture 2 est au rang 2', /2 \/ 2/.test(t.texte('#fiche-chantier')));
  const nomme = mot => t.$$('#fiche-chantier [data-voisin]')
    .filter(x => new RegExp(mot).test(x.textContent))[0];
  verifier('« précédente » mène à la facture 1', 'a', nomme('Précédente').dataset.voisin);
  verifierVrai('« suivante » est éteinte sur la dernière',
    t.$$('#fiche-chantier button[disabled]').some(x => /Suivante/.test(x.textContent)));

  t.clic('[data-voisin="a"]'); await t.pause(400);
  verifierVrai('on est bien sur la facture 1', /Alpha/.test(t.texte('#fiche-chantier')));
  verifierVrai('au rang 1', /1 \/ 2/.test(t.texte('#fiche-chantier')));
  verifier('et « suivante » y ramène à la facture 2', 'b', nomme('Suivante').dataset.voisin);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ligne : un forfait groupé porte plusieurs travaux', async () => {
  /* « Détourage + élagage » : les travaux désignent ce que la ligne couvre,
     le prix porte sur l'ensemble, sans quantité. Et si les deux ne portent
     pas le même taux, Sylve refuse de choisir à sa place. */
  const t = await ouvrir(VIDE);
  const C = t.w.BCC;
  const groupee = { travail: 'DETOUR', travauxPlus: ['ELAG'], unite: 'forfait', prix: 900 };
  verifier('les deux travaux sont lus', ['DETOUR', 'ELAG'], C.travauxDeLigne(groupee));
  verifierVrai('la ligne est groupée', C.ligneGroupee(groupee));
  verifierVrai('les deux noms s’affichent',
    /Détourage \+ Élagage/.test(C.nomTravauxLigne(groupee)));
  verifier('même taux : rien à trancher', false, C.tvaAtrancher(groupee, {}));
  /* Détourage 20 % sans SIREN, fourniture de plants 5,5 % : taux mêlés. */
  const melangee = { travail: 'DETOUR', travauxPlus: ['F_PLANTS'], unite: 'forfait', prix: 900 };
  verifierVrai('taux différents : il faut trancher', C.tvaAtrancher(melangee, {}));
  verifier('un taux forcé lève la question', false,
    C.tvaAtrancher(Object.assign({}, melangee, { tva: 10 }), {}));
  verifier('et c’est ce taux qui s’applique', 10,
    C.tauxLigne(Object.assign({}, melangee, { tva: 10 }), {}));
  /* Sans arbitrage, on retient le plus élevé plutôt que de sous-facturer. */
  verifier('sans arbitrage, le plus élevé', 20, C.tauxLigne(melangee, {}));
  verifier('une ligne simple ne change pas', 20,
    C.tauxLigne({ travail: 'DETOUR' }, {}));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ligne : « + travaux » bascule en forfait et bloque la TVA mêlée', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    /* Avec un SIREN, le détourage passe à 10 % tandis que le jalonnage reste
       à 20 % : c'est là que les taux se mêlent, et c'est son cas réel. */
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'accepte', aDevis: false,
      siren: true, lignes: [], temps: [], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-ligne'); await t.pause(400);
  t.choisir('#cl-trav', 'DETOUR'); await t.pause(200);
  verifierVrai('le bouton « + travaux » est là', t.$('#cl-ajout'));
  verifier('la quantité est ouverte au départ', false, t.$('#cl-qte').disabled);

  t.clic('#cl-ajout'); await t.pause(300);
  verifierVrai('un second travail apparaît', t.$('[data-clp="0"]'));
  verifier('la ligne passe en forfait', 'forfait', t.$('#cl-unite').value);
  verifier('et la quantité se ferme', true, t.$('#cl-qte').disabled);
  verifierVrai('le forfait est expliqué', /le prix porte sur l’ensemble/.test(t.texte('#cl-forfait')));

  /* Deux taux différents : on refuse d'enregistrer sans arbitrage. */
  t.choisir('[data-clp="0"]', 'JALON'); await t.pause(250);
  t.saisir('#cl-prix', '900');
  t.clic('#cl-ok'); await t.pause(400);
  verifier('rien n’est enregistré tant que la TVA n’est pas tranchée', 0,
    ((t.stock('chantiers') || [])[0].lignes || []).length);
  verifierVrai('et le champ TVA est signalé', t.$('#cl-tva').classList.contains('err'));

  t.choisir('#cl-tva', '10'); await t.pause(250);
  t.clic('#cl-ok'); await t.pause(500);
  const ligne = ((t.stock('chantiers') || [])[0].lignes || [])[0];
  verifierVrai('avec le taux, la ligne passe', ligne);
  verifier('elle porte le second travail', ['JALON'], ligne.travauxPlus);
  verifier('en forfait', 'forfait', ligne.unite);
  verifier('au taux choisi', 10, ligne.tva);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : les filtres dans l’ordre dicté, et ce qui reste à faire', async () => {
  /* « Tout au-dessus. Après, les chantiers avec devis. Ensuite les chantiers
     ouverts, ensuite les clos, et uniquement ce qui est en cours ou à
     planifier » — « comme ça je peux voir ce qui me reste à faire, pour
     m'organiser ». Le groupe « En cours » rangeait les facturés dedans : « dans
     en cours, j'ai encore tous les chantiers que j'ai finis ». */
  const ch = (id, statut, aDevis) => ({ id, statut, aDevis: !!aDevis, proprietaire: 'Client ' + id,
    lignes: [], temps: [], jours: [], maj: Date.now() });
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [ch('a', 'encours'), ch('b', 'paye'), ch('c', 'facture'),
      ch('d', 'accepte', true), ch('e', 'termine'), ch('f', 'sansuite')]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(350);
  verifier('l’ordre qu’il a dicté', ['tous', 'avecdevis', 'ouverts', 'clos', 'afaire'],
    t.$$('#c-filtre > option').map(o => o.value).slice(0, 5));

  const garde = async q => {
    t.choisir('#c-filtre', q); await t.pause(250);
    return [...new Set(t.$$('#ch-filtre-liste [data-chouvrir]').map(b => b.dataset.chouvrir))].sort();
  };
  verifier('« en cours ou à planifier » : le travail qui reste', ['a', 'd'], await garde('afaire'));
  verifier('« clos » : payé et sans suite', ['b', 'f'], await garde('clos'));
  /* Facturé mais pas encore réglé reste ouvert : l'argent n'est pas rentré.
     C'est ce que dit statutOuvert(), et il n'a pas bougé. */
  verifier('« ouverts » garde le facturé tant qu’il n’est pas payé',
    ['a', 'c', 'd', 'e'], await garde('ouverts'));

  const groupes = t.$$('#c-filtre optgroup').map(g => g.getAttribute('label'));
  verifier('deux familles, nommées comme les filtres', ['Ouverts', 'Clos'], groupes);
  const dans = lab => t.$$('#c-filtre optgroup')
    .filter(g => g.getAttribute('label') === lab)[0].textContent;
  verifierVrai('le facturé se range sous « Ouverts »', /Facturé/.test(dans('Ouverts')));
  verifierVrai('le payé sous « Clos »', /Payé/.test(dans('Clos')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : filtrer par famille de travaux', async () => {
  /* « Je me perds dans les chantiers » — l'idée du 23 août, retenue le 15
     septembre : « toujours utile, on peut le mettre carrément ». Un chantier
     figure sous chaque famille dont il porte une ligne, et la famille suit
     les réglages. */
  const ch = (id, travaux) => ({ id, statut: 'encours', aDevis: false, proprietaire: 'Client ' + id,
    temps: [], jours: [], maj: Date.now(),
    lignes: travaux.map(tv => ({ travail: tv, unite: 'ha', quantite: 1, prix: 100, nature: 'prestation' })) });
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    /* Le dégagement est rangé en gestion dans ses réglages : c'est ce
       rangement-là que le filtre doit suivre, pas celui livré. */
    cfg: { travauxPerso: { DEGAG: { cat: 'gestion' } } },
    /* Un chantier payé : sans groupe « Clos », les familles seraient en
       dernier quoi qu'il arrive. */
    chantiers: [ch('p', ['PLANT']), ch('s', ['DEGAG']), ch('m', ['PLANT', 'PROTEC']), ch('v', []),
      Object.assign(ch('z', []), { statut: 'paye' })]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(350);
  const groupe = t.$$('#c-filtre optgroup').filter(g => g.getAttribute('label') === 'Familles de travaux')[0];
  verifierVrai('un groupe « Familles de travaux »', !!groupe);
  /* « Il faudrait que les familles de travaux arrivent tout en bas : c'est le
     truc que je vais utiliser le moins souvent. » */
  verifier('tout en bas de la liste', 'Familles de travaux',
    t.$$('#c-filtre optgroup').slice(-1)[0].getAttribute('label'));
  const valeurs = groupe ? [...groupe.querySelectorAll('option')].map(o => o.value) : [];
  verifierVrai('la plantation y est', valeurs.indexOf('fam:plantation') >= 0);
  verifierVrai('une famille sans chantier n’y est pas', valeurs.indexOf('fam:exploitation') < 0);

  const garde = async q => {
    t.choisir('#c-filtre', q); await t.pause(250);
    return [...new Set(t.$$('#ch-filtre-liste [data-chouvrir]').map(b => b.dataset.chouvrir))].sort();
  };
  verifier('la plantation : les deux qui en portent', ['m', 'p'], await garde('fam:plantation'));
  verifier('la protection gibier : celui qui mêle les deux', ['m'], await garde('fam:gibier'));
  verifier('la famille suit ses réglages', ['s'], await garde('fam:gestion'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : le temps total, le productif, le trajet — et plus de case « non facturée »', async () => {
  /* « Journée non facturée au-dessus, ça on peut l'enlever, ça sert plus à
     rien. » Et : « il faudrait juste le temps total, et le temps productif.
     Et après, si je peux rajouter le temps de trajet. » Huit heures sur le
     chantier dont une à régler la tronçonneuse et affûter : sept
     productives. */
  const midi = new Date(); midi.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [{ id: 'c1', proprietaire: 'Martin', statut: 'encours', aDevis: false,
      temps: [], jours: [], maj: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }],
    journees: [{ id: 'j1', date: midi.getTime(), chantier: 'c1', personnes: 1, nonProd: 0,
      nonFacture: true, postes: [{ travaux: 'DEGAG', heures: 6, quantite: 0 }] }]
  }));
  await t.pause(300);
  t.clic('[data-jour="' + t.w.BCC.minuit(Date.now()) + '"]'); await t.pause(450);
  t.clic('#fj-travaille'); await t.pause(500);
  verifierVrai('la journée s’ouvre', !!t.$('#mj-ok'));
  verifier('la case « non facturée » a disparu', null, t.$('#mj-nonfact'));
  /* Une journée déjà notée rouvre son total : ses six heures productives. */
  verifier('le total d’une journée notée se relit', '6', t.$('#mj-total').value);

  verifier('et son productif aussi (lot r2)', '6', t.$('#mj-prod').value);

  /* Un total plus court que le productif ne s'enregistre pas : l'un des deux
     est mal tapé, et deviner lequel fausserait les rendements. Depuis le lot
     r2, le productif se tape à part. */
  t.saisir('#mj-prod', '7');
  t.saisir('#mj-total', '6');
  verifierVrai('l’écran le dit tout de suite',
    /plus court que le temps productif/.test(t.texte('#mj-horsprod')));
  t.clic('#mj-ok'); await t.pause(400);
  /* Les heures productives sont ce qui changerait : six en base, sept tapées. */
  verifier('et rien n’est enregistré', 6,
    (t.stock('journees') || []).filter(x => x.id === 'j1')[0].postes[0].heures);
  verifierVrai('la fenêtre reste ouverte pour corriger', !!t.$('#mj-ok'));

  t.saisir('#mj-total', '8');
  t.saisir('#mj-trajet', '1'); t.saisir('#mj-trajet-m', '30');
  verifierVrai('le hors production se déduit, et dit ce qu’il couvre',
    /7 h productives, 1 h hors production — affûtage/.test(t.texte('#mj-horsprod')));
  const ap = t.texte('#mj-apercu');
  verifierVrai('la journée fait huit heures, sans le trajet', /^8 h/.test(ap));
  verifierVrai('dont sept productives', /7 h productives/.test(ap));
  verifierVrai('une hors production', /1 h hors production/.test(ap));
  verifierVrai('et le trajet à côté', /\+ 1 h 30 de trajet/.test(ap));
  /* Une journée marquée avant la 4.82 garde sa marque, et l'aperçu la dit :
     sans case pour la voir, l'effacer en silence changerait ses chiffres. */
  verifierVrai('l’aperçu signale une journée déjà marquée', /non facturée/.test(ap));

  t.clic('#mj-ok'); await t.pause(600);
  const j = (t.stock('journees') || []).filter(x => x.id === 'j1')[0];
  verifier('le hors production est gardé, déduit', 1, j.nonProd);
  verifier('le trajet aussi, à part', 1.5, j.trajet);
  verifier('la journée compte le temps sur le chantier, sans le trajet (lot r2)', 8, t.w.BCC.heuresJournee(j));
  verifier('et la marque ancienne est gardée', true, j.nonFacture);

  /* Lot r2 : le trajet n'entre plus dans le temps du chantier. La fiche
     compte huit heures, une journée, et dit le trajet à côté. */
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const rangs = t.$$('#vue-chantier .jrang').map(e => e.textContent.replace(/\s+/g, ' ').trim());
  verifierVrai('la fiche compte une journée, le trajet à côté',
    rangs.some(r => /\+ 1 h 30 de trajet ?1 j(?! \d)/.test(r)));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Bilan : une bulle d’un seul chantier ouvre sa fiche, plusieurs ouvrent la liste', async () => {
  /* « Les bulles qui mènent droit à la fiche. » Une liste d'un seul
     chantier, c'est un appui de plus pour rien. Lot 5b : les bulles sont
     parties ; chaque chantier a sa ligne dans Aujourd'hui ▸ Chantiers en
     cours, qui mène droit à sa fiche, et la liste filtrée reste dans
     Chantiers. */
  const ch = (id, statut) => ({ id, statut, aDevis: false, proprietaire: 'Client ' + id,
    lignes: [], temps: [], jours: [], maj: Date.now() });
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [ch('a', 'encours'), ch('b', 'encours'), ch('c', 'accepte')]
  }));
  await t.pause(300);
  verifier('une ligne par chantier en cours', ['fiche:a', 'fiche:b', 'fiche:c'],
    t.$$('#aj-encours [data-ajouvre]').map(b => b.dataset.ajouvre).sort());
  t.clic('#aj-encours [data-ajouvre="fiche:c"]'); await t.pause(400);
  verifierVrai('le devis signé : sa fiche s’ouvre',
    t.$('#vue-chantier').classList.contains('actif'));
  verifierVrai('et c’est la sienne', /Client c/.test(t.texte('#vue-chantier')));
  await parBarre(t, 'aujourdhui');
  t.clic('#aj-encours [data-ajouvre="fiche:b"]'); await t.pause(400);
  verifierVrai('un chantier en cours parmi deux : sa fiche aussi', /Client b/.test(t.texte('#vue-chantier')));

  /* La liste filtrée de la bulle « en cours » : le filtre du carnet. */
  await parBarre(t, 'chantiers');
  t.choisir('#c-filtre', 'encours'); await t.pause(300);
  verifier('deux chantiers en cours : la liste filtrée sur eux', 2,
    t.$$('#ch-filtre-liste [data-chouvrir]').length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Facture : la remplir fait basculer le chantier, sans rien demander', async () => {
  /* Question posée le 19 août, laissée ouverte, tranchée le 31 : « bien sûr,
     une facture remplie bascule automatiquement le chantier en facturé ».
     La fenêtre de confirmation ne faisait qu'ajouter un geste à un choix
     déjà fait en remplissant les champs. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'encours', aDevis: false,
      lignes: [], temps: [], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);

  let demande = null;
  t.w.confirm = m => { demande = m; return false; };
  t.clic('#f-facture'); await t.pause(350);
  t.saisir('#fc-num-an', '2026');
  t.saisir('#fc-num-rg', '42');
  t.$('#fc-date').value = jourISO(Date.now());
  t.clic('#fc-ok'); await t.pause(450);

  verifier('plus aucune question posée', null, demande);
  verifier('le chantier est passé en facturé', 'facture', (t.stock('chantiers') || [])[0].statut);
  verifier('avec son numéro complété', 'F-2026-0042', (t.stock('chantiers') || [])[0].numeroFacture);
  verifierVrai('et le message dit que le statut a suivi',
    /chantier « Factur/.test(t.$('#toast').textContent));

  /* Un paiement va plus loin que la facture : on l'y suit. */
  t.clic('#f-facture'); await t.pause(350);
  t.$('#fc-paie').value = jourISO(Date.now());
  t.clic('#fc-ok'); await t.pause(450);
  verifier('un paiement saisi mène jusqu’à payé', 'paye', (t.stock('chantiers') || [])[0].statut);

  /* Et jamais en arrière : rouvrir la facture d'un chantier payé ne le
     ramène pas à « facturé ». */
  t.clic('#f-facture'); await t.pause(350);
  t.$('#fc-paie').value = '';
  t.clic('#fc-ok'); await t.pause(450);
  verifier('on ne revient jamais en arrière', 'paye', (t.stock('chantiers') || [])[0].statut);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis : le signer fait avancer le chantier tout seul', async () => {
  /* « Il faut que j'aie la possibilité de dire quand il est signé, et donc
     automatiquement à ce moment-là que ça change le statut aussi. » La date
     est demandée : sans elle on ne sait plus quand l'engagement a été pris. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'envoye', aDevis: true,
      lignes: [], temps: [], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-devis'); await t.pause(350);
  verifierVrai('la date de signature est demandée', t.$('#ce-signe'));
  t.choisir('#ce-signe', '2026-09-14'); await t.pause(150);
  t.clic('#dv-ok'); await t.pause(450);

  const c = (t.stock('chantiers') || [])[0];
  verifier('la date est retenue', '2026-09-14', jourISO(c.dateSignature));
  verifier('et le chantier avance', 'accepte', c.statut);
  verifierVrai('la fiche l’affiche', /Signé le 14\/09\/2026/.test(t.texte('#vue-chantier')));

  /* Jamais en arrière : un chantier déjà en cours ne redevient pas
     « à planifier » parce qu'on corrige la date du devis. */
  t.clic('#f-statut'); await t.pause(300);
  t.clic('[data-setstatut="encours"]'); await t.pause(400);
  t.clic('#f-devis'); await t.pause(350);
  t.choisir('#ce-signe', '2026-09-15'); await t.pause(150);
  t.clic('#dv-ok'); await t.pause(450);
  verifier('le statut ne recule pas', 'encours', (t.stock('chantiers') || [])[0].statut);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis : la photo se prend au passage, jamais après coup', async () => {
  /* Le devis signé ne bouge plus : au moment où le chantier bascule, on garde
     une photo de ses lignes. Sur un chantier déjà facturé — les trente-deux
     repris du carnet — figer l'existant appellerait « devis » ce qui n'en a
     jamais été un, et tout paraîtrait conforme à un devis inexistant. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', proprietaire: 'Martin', statut: 'termine', aDevis: true, temps: [], maj: Date.now(),
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 4, prix: 800, nature: 'prestation' }] },
      /* Repris du carnet : déjà payé, aucun devis n'a existé. */
      { id: 'c2', proprietaire: 'Renaud', statut: 'paye', aDevis: false, temps: [], maj: Date.now(),
        numeroFacture: 'F-2025-0007', datePaiement: Date.now(),
        lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 500, prix: 2, nature: 'prestation' }] },
      /* Celui-ci a bien eu un devis, mais il est facturé depuis longtemps et
         aucune photo n'a été prise à l'époque. La garde « aDevis » ne le
         protège pas : seule la condition de passage le protège. */
      { id: 'c3', proprietaire: 'Bourgeois', statut: 'paye', aDevis: true, temps: [],
        maj: Date.now(), numeroDevis: 'D-2025-0003', numeroFacture: 'F-2025-0012',
        dateFacture: Date.now(), datePaiement: Date.now(),
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 700, nature: 'prestation' }] }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  verifierVrai('rien n’est figé tant que le chantier n’est pas facturé',
    !(t.stock('chantiers') || []).filter(c => c.id === 'c1')[0].devisFige);

  t.clic('#f-statut'); await t.pause(300);
  t.clic('[data-setstatut="facture"]'); await t.pause(400);
  t.clic('#nf-passer'); await t.pause(450);
  const c1 = (t.stock('chantiers') || []).filter(c => c.id === 'c1')[0];
  verifierVrai('la photo est prise au passage', !!c1.devisFige);
  verifier('avec le total du devis', 3200, c1.devisFige.total);
  verifierVrai('et un identifiant sur chaque ligne', !!(c1.lignes[0] || {}).uid);

  /* Le second : déjà payé à l'ouverture, on n'invente pas de devis.
     On passe par le sélecteur de la fiche : le carnet ne liste que les
     chantiers ouverts, et un clic sur un payé n'y trouve rien — le
     scénario continuait alors sur le chantier précédent sans le dire. */
  t.choisir('#f-choix', 'c2'); await t.pause(450);
  verifierVrai('on est bien passé sur le chantier repris',
    /Renaud/.test(t.texte('#f-bloc-chantier')));
  t.clic('#f-facture'); await t.pause(350);
  t.clic('#fc-ok'); await t.pause(450);
  verifierVrai('un chantier déjà payé ne se voit pas inventer un devis',
    !(t.stock('chantiers') || []).filter(c => c.id === 'c2')[0].devisFige);

  /* Et celui qui avait bien un devis : le rouvrir et l'enregistrer ne doit
     pas figer aujourd'hui ce qui a été facturé il y a des mois. */
  t.choisir('#f-choix', 'c3'); await t.pause(450);
  verifierVrai('on est bien passé sur celui qui avait un devis',
    /Bourgeois/.test(t.texte('#f-bloc-chantier')));
  t.clic('#f-facture'); await t.pause(350);
  t.clic('#fc-ok'); await t.pause(450);
  verifierVrai('ni celui qui avait un devis mais est facturé depuis longtemps',
    !(t.stock('chantiers') || []).filter(c => c.id === 'c3')[0].devisFige);
  verifierVrai('et sa fiche ne prétend pas qu’il est conforme à un devis',
    !/Facturé à l’identique/.test(t.texte('#vue-chantier')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Facture : ce qui a bougé depuis le devis est marqué sur la ligne', async () => {
  /* « On ne comprend pas à quel endroit il y a eu le changement. » La marque
     est donc sur la ligne, pas dans un récapitulatif — et il n'y a toujours
     qu'une seule liste de travaux. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'facture', aDevis: true,
      temps: [], maj: Date.now(), numeroDevis: 'D-2026-0014', numeroFacture: 'F-2026-0031',
      dateFacture: Date.now(),
      lignes: [
        /* Inchangée : 4 × 800 = 3 200, comme au devis. */
        { uid: 'L1', travail: 'DEGAG', unite: 'ha', quantite: 4, prix: 800,
          nature: 'prestation', note: 'Dégagement parcelle 12' },
        /* Le devis en annonçait 500, la facture 300. */
        { uid: 'L2', travail: 'PLANT', unite: 'plant', quantite: 100, prix: 3,
          nature: 'prestation', note: 'Regarni' },
        /* Sans identifiant dans la photo : elle est arrivée après. */
        { travail: 'PROT', unite: 'unite', quantite: 25, prix: 10,
          nature: 'prestation', note: 'Repose de protections' }
      ],
      devisFige: { date: Date.now() - 86400000, total: 3200, lignes: [
        { uid: 'L1', montant: 3200, titre: 'Dégagement parcelle 12' },
        { uid: 'L2', montant: 500, titre: 'Regarni' },
        { uid: 'L3', montant: 150, titre: 'Gaines fournies' }
      ] } }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const f = t.texte('#vue-chantier');

  verifierVrai('la ligne inchangée ne porte aucune marque',
    !/Dégagement parcelle 12 (ajoutée|modifiée|retirée)/.test(f));
  verifierVrai('celle qui a bougé est dite modifiée', /Regarni modifiée/.test(f));
  verifierVrai('et elle dit ce que le devis annonçait', /Le devis disait 500 €/.test(f));
  verifierVrai('celle qui est arrivée après est dite ajoutée',
    /Repose de protections ajoutée/.test(f));
  /* Une ligne du devis non facturée ne se voit nulle part si on se contente
     de la retirer, et l'écart devient inexplicable. */
  verifierVrai('celle qui a disparu reste visible, barrée',
    /Gaines fournies retirée/.test(f));

  /* 3 200 + 300 + 250 = 3 750, contre 3 200 au devis. Le total du devis se
     retrouve aussi sur la première ligne : on vise donc la phrase entière. */
  verifierVrai('le pied rappelle ce que le devis disait', /disait3 200 €/.test(f));
  verifierVrai('et ce qui est facturé', /Facturé3 750 €/.test(f));
  verifierVrai('il compte les trois changements',
    /1 ligne ajoutée, 1 modifiée, 1 retirée/.test(f));
  verifierVrai('et chiffre l’écart', /550 € de plus/.test(f));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Facture : conforme au devis, le pied le dit aussi', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'facture', aDevis: true, temps: [],
      maj: Date.now(), numeroDevis: 'D-2026-0009', numeroFacture: 'F-2026-0021',
      dateFacture: Date.now(),
      lignes: [{ uid: 'L1', travail: 'DEGAG', unite: 'ha', quantite: 4, prix: 800,
        nature: 'prestation', note: 'Dégagement' }],
      devisFige: { date: Date.now() - 86400000, total: 3200,
        lignes: [{ uid: 'L1', montant: 3200, titre: 'Dégagement' }] } }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const f = t.texte('#vue-chantier');
  verifierVrai('le pied dit que rien n’a bougé', /Facturé à l’identique/.test(f));
  verifierVrai('et aucune ligne n’est marquée',
    !/(ajoutée|modifiée|retirée)/.test(f));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis : les journées se déduisent des lignes, sans double saisie', async () => {
  /* « Si je fais mon devis avec trois journées, il faut que dans mon temps
     estimé ça bloque à trois jours. Je n'ai pas à le remplir deux fois. »
     Et quand une autre ligne se chiffre autrement, le dire : l'estimation ne
     parle pas d'elle. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { prixJourVise: 650 },
    chantiers: [
      { id: 'c1', proprietaire: 'À la journée', statut: 'accepte', aDevis: true, temps: [], maj: Date.now(),
        /* Trois journées au devis, et une ligne à l'hectare que le temps
           déduit ne couvre pas. */
        lignes: [
          { travail: 'DEGAG', unite: 'jour', quantite: 3, prix: 800, nature: 'prestation' },
          { travail: 'PLANT', unite: 'ha', quantite: 2, prix: 400, nature: 'prestation' }
        ] },
      { id: 'c2', proprietaire: 'À l’hectare', statut: 'accepte', aDevis: true, temps: [], maj: Date.now(),
        joursEstimes: 5,
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 6, prix: 500, nature: 'prestation' }] }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const f1 = t.texte('#vue-chantier');
  verifierVrai('le temps se lit dans le bloc des travaux',
    /Temps estimé \(facultatif\)/.test(f1));
  verifierVrai('et vaut les trois journées du devis',
    /Temps estimé \(facultatif\) ✎3 j/.test(f1));
  verifierVrai('l’écran dit d’où ça vient', /Déduit des lignes en journées/.test(f1));
  /* Sans cette mention, il croirait que les trois journées couvrent la
     plantation à l'hectare aussi. */
  verifierVrai('et nomme ce que ça ne couvre pas',
    /ne tient pas compte de plantation/i.test(f1));

  /* Aucune ligne en journées : c'est son estimation qui parle. */
  t.choisir('#f-choix', 'c2'); await t.pause(450);
  verifierVrai('on est bien sur le chantier à l’hectare',
    /À l’hectare/.test(t.texte('#f-bloc-chantier')));
  const f2 = t.texte('#vue-chantier');
  verifierVrai('sans ligne en journées, l’estimation reste la sienne',
    /Temps estimé \(facultatif\) ✎5 j/.test(f2));
  verifierVrai('et l’écran le dit', /Aucune ligne n’est libellée en journées/.test(f2));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Numéro : le suivant est proposé, jamais imposé', async () => {
  /* « Ce serait même qu'il puisse proposer plus un, comme ça ça me simplifie
     les choses. » Proposé quand le champ est vide, et l'année reste à lui :
     une facture se saisit parfois après le 31 décembre. */
  /* L'année se lit sur l'horloge, jamais en dur : un test écrit avec 2026
     passe au vert aujourd'hui et ment le 1er janvier. */
  const an = new Date().getFullYear();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Déjà facturé', statut: 'paye', aDevis: false, temps: [], lignes: [],
        numeroFacture: 'F-' + an + '-0007', dateFacture: Date.now(), maj: Date.now() },
      /* L'an dernier, et un rang bien plus haut : il ne doit pas peser sur
         la séquence de cette année. */
      { id: 'c2', nom: 'L’an dernier', statut: 'paye', aDevis: false, temps: [], lignes: [],
        numeroFacture: 'F-' + (an - 1) + '-0031', dateFacture: Date.now(), maj: Date.now() },
      { id: 'c3', nom: 'À facturer', statut: 'termine', aDevis: false, temps: [], lignes: [],
        maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c3"]'); await t.pause(400);
  t.clic('#f-facture'); await t.pause(400);

  /* Le suivant se lit avant qu'il ait tapé quoi que ce soit : taper
     par-dessus puis vérifier n'éprouvait rien du tout. */
  verifier('l’année en cours est proposée', String(an), t.$('#fc-num-an').value);
  verifier('et le rang suivant de cette année-là', '8', t.$('#fc-num-rg').value);
  verifierVrai('l’aperçu complète les zéros',
    new RegExp('F-' + an + '-0008').test(t.texte('#fc-num-vu')));

  /* Rien n'est imposé : il numérote parfois hors séquence. */
  t.saisir('#fc-num-rg', '105'); await t.pause(120);
  verifierVrai('mais il reste libre de le changer',
    new RegExp('F-' + an + '-0105').test(t.texte('#fc-num-vu')));
  t.clic('#fc-ok'); await t.pause(450);
  verifier('c’est son numéro qui est retenu', 'F-' + an + '-0105',
    (t.stock('chantiers') || []).filter(c => c.id === 'c3')[0].numeroFacture);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fini de placer : parti de la fiche, on revient à la fiche', async () => {
  /* « Quand je fais terminer, je ne suis plus dans mon chantier, il faut que
     je refasse des manips pour y retourner. » « Terminer » est devenu « Fini
     de placer » (P2). */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'accepte', aDevis: false,
      lignes: [], temps: [], joursEstimes: 3, maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-planifier'); await t.pause(400);
  verifier('on part bien dans l’Agenda', 'vue-calendrier', vueActive(t));
  verifier('le bouton dit « Fini de placer »', 'Fini de placer', t.texte('#cal-planif-fin'));
  await cliquerJour(t, JCAL(5), 400);
  verifier('le jour est retenu', 1, ((t.stock('chantiers') || [])[0].jours || []).length);

  t.clic('#cal-planif-fin'); await t.pause(450);
  verifier('« Fini de placer » ramène sur la fiche', 'vue-chantier', vueActive(t));
  verifierVrai('celle du chantier qu’on plaçait', /Coupe des Places/.test(t.texte('#fiche-chantier')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Placement : un jour passé touché devient une journée faite (lot r1)', async () => {
  /* Le placement reste tel quel (bandeau, Fini de placer, jour déjà pris),
     sauf un jour passé : il a eu lieu, il devient une journée faite — sans
     pose, sans prestation, la journée entière. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8, weekends: true, journeesMigrees: true },
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'accepte', aDevis: false, foret: 'Les Places',
      lignes: [], temps: [], joursEstimes: 3, maj: Date.now() }]
  }));
  const C0 = t.w.BCC;
  const jrn = () => t.stock('journees') || [];
  const poses = () => ((t.stock('chantiers') || [])[0].jours || []).map(j => C0.jourCle(j.d));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-planifier'); await t.pause(400);
  verifierVrai('le placement s’ouvre', /Placement — Coupe des Places/.test(t.texte('#cal-planif')));
  await cliquerJour(t, JCAL(-2), 500);
  verifier('le jour passé est une journée faite', 1, jrn().length);
  verifier('ce jour-là, sur ce chantier', [C0.jourCle(JCAL(-2)), 'c1'], [C0.jourCle(jrn()[0].date), jrn()[0].chantier]);
  verifier('une journée entière, sans prestation', [8, 0], [jrn()[0].nonProd, (jrn()[0].postes || []).length]);
  verifier('et rien de posé', [], poses());
  await cliquerJour(t, JCAL(-2), 500);
  verifier('le toucher encore ne double rien', 1, jrn().length);
  await cliquerJour(t, JCAL(5), 400);
  verifier('un jour à venir se pose, comme avant', [C0.jourCle(JCAL(5))], poses());
  t.clic('#cal-planif-fin'); await t.pause(450);
  verifier('« Fini de placer » ramène à la fiche', 'vue-chantier', vueActive(t));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Agenda : plus d’« À programmer » ni de ligne « à trancher » en tête (lot r1)', async () => {
  /* Retraits acceptés le 03/11 : on place depuis la fiche ▸ Travaux ou par
     l'appui long, on estime dans l'étape Devis ; un jour posé qui passe
     compte d'office. Aujourd'hui ne dit plus « N jours à placer ». */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: JCAL(10) },
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'accepte', aDevis: false,
      lignes: [], temps: [], joursEstimes: 3, jours: [{ d: JCAL(-1), p: 1 }], maj: Date.now() },
    { id: 'c2', nom: 'Sans estimation', statut: 'accepte', aDevis: true, lignes: [], temps: [], maj: Date.now() }]
  }));
  await t.pause(200);
  verifier('ni bloc ni ligne en tête de l’Agenda', [null, null, null],
    [t.$('#cal-aplanifier'), t.$('#cal-trancher'), t.$('#cal-trancher-btn')]);
  const c = await caseDuJour(t, JCAL(-1));
  verifierVrai('le jour passé posé ne porte plus de « ? »', c && !c.querySelector('.cal-q') && !/trancher/.test(c.className));
  verifierVrai('ni « à placer » ni « à estimer » dans l’Agenda', !/à placer|à estimer|À programmer/.test(t.texte('#vue-calendrier')));
  await parBarre(t, 'aujourdhui');
  verifier('ni ligne « À programmer » sur Aujourd’hui', 0, lignesAuj(t, 'programmer:').length);
  verifierVrai('ni « à placer », ni « temps à estimer »', !/à placer|à estimer|estimez et placez/.test(t.texte('#vue-accueil')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : la facture se lit dès l’en-tête du chantier', async () => {
  /* « C'est sur le numéro de facture que je me base, donc c'est important » —
     en enchaînant les fiches par précédente / suivante, il doit le voir sans
     rien dérouler. */
  const paye = new Date(2026, 4, 30, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Coupe des Places', statut: 'paye', aDevis: false, lignes: [], temps: [],
        numeroFacture: 'F-2026-0042', dateFacture: new Date(2026, 3, 14, 12).getTime(),
        datePaiement: paye, moyenPaiement: 'cheque', maj: Date.now() },
      { id: 'c2', nom: 'En cours', statut: 'encours', aDevis: false, lignes: [], temps: [],
        maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.choisir('#c-filtre', 'tous'); await t.pause(350);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  /* On lit les seuls résumés des étapes, ce qui se voit replié : le numéro
     figure aussi dans le corps de l'étape, et lire toute la fiche ne
     prouverait rien. */
  const resumes = () => t.$$('#f-etapes summary').map(e => e.textContent.replace(/\s+/g, ' ')).join(' | ');
  const h = resumes();
  verifierVrai('le numéro y est', /F-2026-0042/.test(h));
  verifierVrai('la date de facture aussi', /14\/04\/2026/.test(h));
  verifierVrai('et le paiement, avec son moyen', /30\/05\/2026 · Chèque/.test(h));

  /* Un chantier sans facture ne montre pas de lignes vides. */
  t.clic('[data-chouvrir="c2"]'); await t.pause(400);
  const h2 = resumes();
  verifierVrai('rien n’est annoncé sans facture', !/F-\d{4}|du \d\d\//.test(h2));
  verifierVrai('ni de paiement', !/Chèque|Virement/.test(h2));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Facture : le moyen de paiement se choisit dans une liste', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'facture', aDevis: false,
      lignes: [], temps: [], numeroFacture: 'F-2026-0007',
      dateFacture: Date.now(), maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-facture'); await t.pause(350);
  verifierVrai('le champ existe', t.$('#fc-moyen'));
  verifier('quatre moyens, plus « non précisé »', 5, t.$$('#fc-moyen option').length);
  t.choisir('#fc-moyen', 'cheque');
  t.$('#fc-paie').value = jourISO(Date.now());
  t.w.confirm = () => true;
  t.clic('#fc-ok'); await t.pause(450);
  verifier('le moyen est retenu', 'cheque', (t.stock('chantiers') || [])[0].moyenPaiement);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Recettes : le débours se voit, hors du chiffre d’affaires', async () => {
  /* Il était écarté du calcul depuis le début — mais affiché nulle part, donc
     impossible pour lui de vérifier qu'il l'était bien. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'paye', aDevis: false, temps: [],
      dateFacture: Date.now(), datePaiement: Date.now(), maj: Date.now(),
      lignes: [
        { travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' },
        { travail: 'F_PROTEC', unite: 'unite', quantite: 100, prix: 3, nature: 'debours' }
      ] }]
  }));
  const C = t.w.BCC, FIN = t.w.BCF;
  const ca = FIN.chiffreAffaires(t.stock('chantiers'), null);
  verifier('le débours est suivi à part', 300, ca.debours);
  verifier('et n’entre pas dans le total', 1000, ca.total);
  verifier('ni dans l’encaissé', 1000, ca.encaisse);

  t.clic('[data-vue="analyses"]'); await t.pause(350);
  const rec = t.$$('#vue-analyses .chip, #vue-analyses [role=tab]')
    .filter(b => /Recettes/.test(b.textContent))[0];
  if (rec) { rec.click(); await t.pause(400); }
  const txt = t.texte('#vue-analyses');
  /* « Débours client » apparaît aussi dans la répartition par famille : c'est
     la mention « hors chiffre d'affaires » qui prouve la ligne du total. */
  verifierVrai('l’écran nomme le débours hors chiffre d’affaires',
    /Débours client — hors chiffre d’affaires/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Création : cinq champs, et le nom qui se montre', async () => {
  /* Le formulaire tenait en vingt-trois champs : le devis, la facture, les
     journées, le peuplement, le statut, la note. Tout cela se remplit bloc
     par bloc sur la fiche. Il ne reste que ce qu'on sait en arrivant. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  await plusChantier(t);
  verifier('le devis n’est plus demandé à la création', null, t.$('#dv-a'));
  verifier('ni la facture', null, t.$('#ce-numfact'));
  verifier('ni le statut', null, t.$('#ce-statut'));
  verifier('ni le peuplement', null, t.$('#ce-dens'));
  verifier('ni les journées', null, t.$('#ce-plusjour'));
  verifierVrai('mais le type de travaux, oui', t.$('#ce-trav'));

  /* Le nom ne se tape plus : il se montre, et il suit la saisie. */
  verifier('rien à taper pour le nom', null, t.$('#ce-nom'));
  t.saisir('#ce-proprio', 'Dupont');
  t.saisir('#ce-com', 'Montjoie'); await t.pause(250);
  verifier('il se montre sans les travaux', 'Dupont, Montjoie',
    t.$('#ce-nom-apercu').textContent);
  t.choisir('#ce-trav', 'DEGAG'); await t.pause(250);
  verifier('et le type de travaux le complète',
    'Dégagement manuel — Dupont, Montjoie', t.$('#ce-nom-apercu').textContent);

  t.saisir('#ce-com', 'Valbrune'); await t.pause(250);
  verifier('corriger la commune corrige le nom',
    'Dégagement manuel — Dupont, Valbrune', t.$('#ce-nom-apercu').textContent);

  t.saisir('#ce-donneur', 'Cabinet Dubois');
  t.clic('#ce-ok'); await t.pause(550);
  const c = (t.stock('chantiers') || [])[0];
  /* Rien n'est stocké sous « nom » : le nom se lit, il ne s'écrit pas. */
  verifierVrai('aucun nom n’est enregistré', !c.nom);
  verifier('mais le chantier en porte un', 'Dégagement manuel — Dupont, Valbrune',
    t.w.BCC.nomChantier(c));
  verifier('avec son donneur d’ordre', 'Cabinet Dubois', c.donneur);
  verifier('et sa commune', 'Valbrune', c.commune);
  verifier('une première ligne de travaux est ouverte', 'DEGAG', (c.lignes[0] || {}).travail);
  verifier('sans quantité', '', c.lignes[0].quantite);
  verifier('ni prix', '', c.lignes[0].prix);
  verifierVrai('et l’on arrive sur la fiche',
    t.$('#vue-chantier').classList.contains('actif'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Débours : il se pose, il se voit, et il ne rapporte rien', async () => {
  /* « Comment je sais que ce produit-là est bien considéré comme un débours ? »
     Il ne pouvait pas : la nature était déduite du travail, le débours n'était
     jamais assignable, et rien ne le distinguait sur la fiche. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'accepte', aDevis: false,
      temps: [{ date: Date.now(), duree: 2, unite: 'j', personnes: 1 }], maj: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);

  /* Sur une prestation, la nature ne se pose pas : elle est déduite. */
  t.clic('#f-ligne'); await t.pause(400);
  t.choisir('#cl-trav', 'DEGAG'); await t.pause(250);
  verifier('pas de nature à choisir sur une prestation', 'none',
    t.$('#cl-nat-champ').style.display);

  /* Sur une fourniture, le débours devient possible. */
  t.choisir('#cl-trav', 'F_PROTEC'); await t.pause(250);
  verifier('le champ apparaît sur une fourniture', '', t.$('#cl-nat-champ').style.display);
  t.choisir('#cl-nature', 'debours');
  t.saisir('#cl-qte', '100');
  t.saisir('#cl-prix', '3');
  t.clic('#cl-ok'); await t.pause(550);

  const c = (t.stock('chantiers') || [])[0];
  const deb = (c.lignes || []).filter(l => l.nature === 'debours')[0];
  verifierVrai('la ligne est bien un débours', deb);
  verifier('avec son montant', 3, deb.prix);

  /* Il se voit sur la fiche, et il ne gonfle pas ce que le chantier rapporte. */
  const f = t.texte('#fiche-chantier');
  /* Le point médian n'appartient qu'à la ligne : « dont débours » du total
     porte la même fin de phrase, et une regex plus large passait même après
     avoir retiré la mention de la ligne. */
  verifierVrai('la ligne le dit', /· débours, hors chiffre d’affaires/.test(f));
  verifierVrai('le total de la facture le garde', /1 300/.test(f));
  verifierVrai('et en isole la part', /dont débours/.test(f));
  verifierVrai('« ce que ça vaut » l’écarte', /1 000/.test(f));

  const C = t.w.BCC;
  verifier('le moteur sait le retrancher', 1000, C.montantHorsDebours(c));
  verifier('et le nommer', 300, C.montantDebours(c));
  /* Deux journées notées : 500 € la journée, et non 650 — un débours ne
     récompense aucune journée de travail. */
  verifier('le prix par journée l’écarte aussi', 500,
    C.bilanJournees(c, {}).obtenu);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ligne : la TVA se force à zéro, sans se cocher toute seule', async () => {
  /* Un débours refacturé à l'euro près ne porte pas de TVA à ajouter : elle
     était déjà sur la facture du fournisseur. Piège évité : C.nb(null) vaut
     zéro, donc tester la valeur aurait coché « forcer à 0 % » sur toute ligne
     qui n'en force aucun. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'accepte', aDevis: false,
      temps: [], maj: Date.now(),
      lignes: [{ travail: 'F_PROTEC', unite: 'unite', quantite: 100, prix: 3,
        nature: 'debours' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('[data-lmod="0"]'); await t.pause(400);
  verifier('quatre taux forçables, plus le défaut', 5, t.$$('#cl-tva option').length);
  verifierVrai('le zéro est proposé',
    t.$$('#cl-tva option').some(o => o.value === '0'));
  verifier('aucun taux forcé sur cette ligne', '', t.$('#cl-tva').value);

  t.choisir('#cl-tva', '0'); await t.pause(250);
  t.clic('#cl-ok'); await t.pause(550);
  const l = ((t.stock('chantiers') || [])[0].lignes || [])[0];
  verifier('le zéro est retenu', 0, l.tva);
  const C = t.w.BCC;
  verifier('et c’est bien lui qui s’applique', 0, C.tauxLigne(l, {}));

  /* Rouvrir la ligne doit retrouver le zéro, pas le défaut. */
  t.clic('[data-lmod="0"]'); await t.pause(400);
  verifier('le zéro est bien retrouvé à la réouverture', '0', t.$('#cl-tva').value);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ligne : le produit du stock est fermé quand une sortie existe à part', async () => {
  /* Les trente-deux chantiers repris du carnet ont leur sortie de stock
     importée du classeur. Y désigner un produit n'ajoutait rien — la
     synchronisation refusait de déduire deux fois — mais on ne l'apprenait
     qu'après coup, par un message. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    articles: [{ id: 'a1', nom: 'Gaine de protection', unite: 'unite' }],
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'accepte', aDevis: false,
      temps: [], maj: Date.now(),
      lignes: [{ travail: 'F_PROTEC', unite: 'unite', quantite: 100, prix: 3,
        nature: 'vente' }] }],
    /* La sortie du classeur : manuelle, donc sans « auto ». */
    sorties: [{ id: 's1', chantier: 'c1', statut: 'fini', date: Date.now(),
      lignes: [{ article: 'a1', qte: 100, prix: 3 }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('[data-lmod="0"]'); await t.pause(450);
  verifier('le champ est fermé', true, t.$('#cl-art').disabled);
  verifierVrai('et il dit pourquoi',
    /déjà une sortie de stock saisie à part/.test(t.texte('#cl-art-aide')));

  /* Sur un chantier sans sortie à part, il reste ouvert. */
  const t2 = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    articles: [{ id: 'a1', nom: 'Gaine de protection', unite: 'unite' }],
    chantiers: [{ id: 'c1', nom: 'Neuf', statut: 'accepte', aDevis: false,
      temps: [], maj: Date.now(),
      lignes: [{ travail: 'F_PROTEC', unite: 'unite', quantite: 100, prix: 3,
        nature: 'vente' }] }]
  }));
  t2.clic('[data-vue="carnet"]'); await t2.pause(300);
  t2.clic('[data-chouvrir="c1"]'); await t2.pause(400);
  t2.clic('[data-lmod="0"]'); await t2.pause(450);
  verifier('ailleurs il reste ouvert', false, t2.$('#cl-art').disabled);
  verifier('aucune erreur', [], t.erreurs.concat(t2.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('TVA collectée : le vrai taux des travaux, pas 20 % par défaut', async () => {
  /* Le module des finances recalculait le taux dans son coin et retombait sur
     20 % dès qu'aucun taux n'était forcé à la main. La fiche du chantier, elle,
     appliquait le vrai — 10 % sur des travaux forestiers chez un client avec
     SIREN. Deux TVA différentes pour le même chantier, et c'est celle des
     finances qu'on déclare. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'facture', aDevis: false,
      siren: true, temps: [], maj: Date.now(), dateFacture: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500,
        nature: 'prestation' }] }]
  }));
  const C = t.w.BCC, FIN = t.w.BCF;
  const ch = t.stock('chantiers');

  verifier('la fiche applique le taux réduit', 10, C.tauxLigne(ch[0].lignes[0], ch[0]));
  const sansTaux = FIN.tvaCollectee(ch, null);
  verifier('sans le taux injecté, les finances retombaient sur 20 %', 200, sansTaux.total);
  const avecTaux = FIN.tvaCollectee(ch, null, C.tauxLigne);
  verifier('avec lui, elles disent la même chose que la fiche', 100, avecTaux.total);
  verifier('et le rangent sous le bon taux', { 10: 100 }, avecTaux.parTaux);

  const bal = FIN.balanceTva(ch, [], null, C.tauxLigne);
  verifier('le solde à payer suit', 100, bal.montant);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Déclarations : le mois, la TVA de l’année, l’impôt par tranches', async () => {
  /* Les chiffres existaient, éparpillés sur trois écrans : le jour de la
     déclaration, il les recopiait de tête. */
  const le = (a, m, j) => new Date(a, m, j, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    cfg: { tauxCotisations: 25 },
    chantiers: [
      { id: 'c1', nom: 'Prestation de mars', statut: 'facture', aDevis: false, siren: true,
        temps: [], maj: Date.now(), dateFacture: le(2026, 2, 10),
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] },
      { id: 'c2', nom: 'Vente de juillet', statut: 'paye', aDevis: false,
        temps: [], maj: Date.now(), dateFacture: le(2026, 6, 5),
        lignes: [{ travail: 'F_PROTEC', unite: 'unite', quantite: 100, prix: 3, nature: 'vente' }] }
    ]
  }));
  t.clic('[data-vue="analyses"]'); await t.pause(350);
  verifierVrai('la pastille Déclarations existe', t.$('[data-ana="declarations"]'));
  t.clic('[data-ana="declarations"]'); await t.pause(350);

  /* Un seul sélecteur de période, celui du haut : Analyses en portait déjà
     un, et la pastille en avait ajouté un second. « Pourquoi il y a en
     double, je ne comprends pas », et il avait raison. */
  verifier('pas de second sélecteur de période', null, t.$('#decl-per'));
  verifier('ni de mois propre à la pastille', null, t.$('#decl-idx'));
  verifierVrai('celui du haut propose bien l’année',
    t.$$('#an-type option').some(o => o.value === 'annee'));

  t.choisir('#an-annee', '2026'); await t.pause(250);
  t.choisir('#an-type', 'mois'); await t.pause(300);
  t.choisir('#an-indice', '2'); await t.pause(350);
  let txt = t.texte('#ana-corps');
  verifierVrai('mars : la prestation y est, brute', /1 000/.test(txt));
  verifierVrai('et après son abattement de 50 %', /500/.test(txt));

  t.choisir('#an-indice', '6'); await t.pause(350);
  txt = t.texte('#ana-corps');
  verifierVrai('juillet : la vente y est', /300/.test(txt));
  verifierVrai('mais pas la prestation de mars', !/1 000 €/.test(txt.replace(/\s+/g, ' ')));

  /* La TVA de l'année applique le vrai taux : 10 % sur la prestation avec
     SIREN, 20 % sur la fourniture. */
  verifierVrai('la TVA à 10 % est là', /Collectée à 10 %/.test(txt) && /100/.test(txt));
  verifierVrai('celle à 20 % aussi', /Collectée à 20 %/.test(txt) && /60/.test(txt));
  verifierVrai('et le solde à reverser', /À reverser/.test(txt) && /160/.test(txt));
  verifierVrai('la TVA reste annuelle, et le dit', /TVA — année 2026/.test(txt));
  verifierVrai('elle rappelle qu’il la collecte, sans la supporter',
    /vous la reversez ou vous la récupérez/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Déclarations : l’impôt commence dans la tranche à 11 %, et sa capacité est à lui', async () => {
  /* Quand d'autres revenus consomment la tranche à 0 %, la base d'ici entre
     directement à 11 %, puis bascule à 30 % au-delà de ce qu'il reste dans
     la tranche.

     Ce reste avait une valeur par défaut, tirée de sa situation — dans un
     dépôt public. « Faut les enlever. » Sans valeur saisie, rien ne
     s'invente. */
  const t = await ouvrir(VIDE);
  const FIN = t.w.BCF;
  const vide = FIN.impotEstime(20000, {});
  verifier('sans capacité saisie, pas d’impôt inventé', null, vide.total);
  verifier('et pas de capacité non plus', null, vide.capacite);
  const cap = { impotCapacite: 15000 };
  const sous = FIN.impotEstime(10000, cap);
  verifier('sous la capacité, tout est à 11 %', 1100, sous.total);
  verifier('rien dans la seconde tranche', 0, sous.tranche2);
  const dessus = FIN.impotEstime(20000, cap);
  verifier('la première tranche se remplit', 15000, dessus.base1);
  verifier('à 11 %', 1650, dessus.tranche1);
  verifier('le reste passe à 30 %', 1500, dessus.tranche2);
  verifier('et le total suit', 3150, dessus.total);
  const sien = FIN.impotEstime(20000, { impotCapacite: 15000, impotTaux1: 12, impotTaux2: 31 });
  verifier('ses propres nombres priment', 1800 + 1550, sien.total);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Déclarations : le versement libératoire, à partir de son année', async () => {
  /* « Je vais sûrement passer au versement libératoire pour l'an prochain :
     un simple truc à cocher, basculer du barème progressif au versement
     libératoire. » Les années d'avant restent au barème : cocher ne réécrit
     pas les estimations passées. */
  const an = new Date().getFullYear();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances', cfg: { impotCapacite: 15000 },
    chantiers: [{ id: 'c1', statut: 'facture', aDevis: false, proprietaire: 'Client',
      temps: [], jours: [], maj: Date.now(), numeroFacture: 'F-1', dateFacture: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 1000, nature: 'prestation' },
        { travail: 'F_TUTEUR', unite: 'unite', quantite: 1, prix: 200, nature: 'vente' }] }]
  }));
  t.clic('[data-vue="analyses"]'); await t.pause(350);
  t.clic('[data-ana="declarations"]'); await t.pause(400);
  const impot = () => t.texte('#decl-impot');
  verifierVrai('au départ, l’impôt est au barème', /impôt estimé/.test(impot()));
  verifierVrai('la case existe, décochée', t.$('#decl-vl') && !t.$('#decl-vl').checked);

  /* Cocher vise l'an prochain : l'année en cours ne bouge pas. */
  t.$('#decl-vl').checked = true;
  t.$('#decl-vl').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(400);
  verifier('cocher vise l’an prochain', an + 1, (t.stock('cfg') || {}).vlDepuis);
  verifierVrai('et cette année reste au barème', /impôt estimé/.test(impot()));

  /* À partir de cette année : 1 000 € de prestations à 1,7 %, 200 € de ventes
     à 1 %, sur le brut. */
  t.choisir('#decl-vl-an', String(an)); await t.pause(400);
  verifierVrai('cette année passe au versement libératoire', /versement libératoire/.test(impot()));
  verifierVrai('dix-neuf euros', /^19 €/.test(impot()));
  const txt = t.texte('#ana-corps');
  verifierVrai('dont les prestations à 1,7 %', /17 € sur les prestations à 1,7 %/.test(txt));
  verifierVrai('et les ventes à 1 %', / 2 € sur les ventes à 1 %/.test(txt));

  /* Les taux sont les siens. */
  t.choisir('#decl-vl-tp', '2'); await t.pause(400);
  verifierVrai('un taux changé est pris', /20 € sur les prestations à 2 %/.test(t.texte('#ana-corps')));
  verifier('et retenu', 2, (t.stock('cfg') || {}).vlTauxPresta);

  /* Décocher revient au barème. */
  t.$('#decl-vl').checked = false;
  t.$('#decl-vl').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(400);
  verifierVrai('décocher revient au barème', /impôt estimé/.test(impot()));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Déclarations : sans capacité saisie, l’écran dit ce qui manque', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    chantiers: [{ id: 'c1', statut: 'facture', aDevis: false, proprietaire: 'Client',
      temps: [], jours: [], maj: Date.now(), numeroFacture: 'F-1', dateFacture: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 1000, nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="analyses"]'); await t.pause(350);
  t.clic('[data-ana="declarations"]'); await t.pause(400);
  verifier('le champ est vide', '', t.$('#decl-cap').value);
  verifierVrai('l’impôt ne s’invente pas', /—/.test(t.texte('#decl-impot')));
  verifierVrai('et l’écran dit ce qui manque',
    /Indiquez ce qu’il reste dans la tranche/.test(t.texte('#ana-corps')));
  t.choisir('#decl-cap', '15000'); await t.pause(400);
  verifier('saisie, elle est retenue', 15000, (t.stock('cfg') || {}).impotCapacite);
  verifierVrai('et l’impôt s’estime', /€/.test(t.texte('#decl-impot')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Déclarations : un versement se note, son remboursement aussi', async () => {
  /* Un versement peut être remboursé en partie :
     le net doit se lire sans perdre la trace de ce qui s'est passé. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  t.clic('[data-vue="analyses"]'); await t.pause(350);
  t.clic('[data-ana="declarations"]'); await t.pause(350);
  t.clic('#decl-vers'); await t.pause(350);
  t.choisir('#vs-type', 'cotisations');
  t.saisir('#vs-mont', '1000');
  t.saisir('#vs-remb', '400');
  t.saisir('#vs-note', 'forfait début d’activité');
  t.clic('#vs-ok'); await t.pause(450);
  const v = (t.stock('versements') || [])[0];
  verifierVrai('le versement est gardé', v);
  verifier('avec son montant', 1000, v.montant);
  verifier('et son remboursement', 400, v.rembourse);
  verifier('sorti du compte par défaut', 'sortie', v.sens);
  let txt = t.texte('#ana-corps');
  verifierVrai('la liste montre le net, sorti', /Cotisations sociales — − 600/.test(txt));
  verifierVrai('sans perdre l’histoire', /1 000 € versés, 400 € remboursés/.test(txt));

  /* La TVA ne se paie pas : elle se reverse, ou elle se récupère. */
  t.clic('#decl-vers'); await t.pause(350);
  t.choisir('#vs-type', 'tva');
  /* On remplit le remboursement AVANT de basculer en récupération : le champ
     se cache mais garde sa valeur, et c'est là que se joue la garde. Laissé
     vide, les deux comportements donnaient le même résultat et le sabotage ne
     criait pas. */
  t.saisir('#vs-remb', '50');
  t.choisir('#vs-sens', 'entree'); await t.pause(200);
  verifier('un remboursement n’a pas de sens sur une récupération', 'none',
    t.$('#vs-remb-champ').style.display);
  t.saisir('#vs-mont', '300');
  t.clic('#vs-ok'); await t.pause(450);
  const tva = (t.stock('versements') || []).filter(x => x.type === 'tva')[0];
  verifier('la récupération est notée comme telle', 'entree', tva.sens);
  verifier('sans remboursement', null, tva.rembourse);
  txt = t.texte('#ana-corps');
  verifierVrai('elle s’affiche en entrée', /TVA — \+ 300/.test(txt));
  verifierVrai('et le bloc ne parle plus de « payé »', !/Ce que vous avez payé/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Véhicule : le carnet note, le compteur suit, l’échéance prévient', async () => {
  const t = await ouvrir(VIDE);
  await parMenu(t, 'vehicule');
  verifierVrai('le module ouvre sur le carnet', t.$('#vue-carnetv').classList.contains('actif'));
  verifier('avec trois onglets', 3, t.$$('#onglets button').length);
  const semes = ((t.stock('vehicule') || {}).postes || []).map(p => p.nom);
  verifier('des postes sont semés d’avance', 8, semes.length);
  /* Propre aux 4x4 Dangel, et il l'a signalé : le pont arrière se vidange
     bien plus souvent que sur un utilitaire de série. */
  verifierVrai('dont le pont arrière du Dangel',
    semes.some(n => /pont arrière \(Dangel\)/.test(n)));
  verifierVrai('et la courroie de distribution',
    semes.some(n => /Courroie de distribution/.test(n)));

  t.clic('#vh-plus'); await t.pause(350);
  t.saisir('#vi-quoi', 'Révision et plaquettes');
  t.saisir('#vi-km', '230000');
  t.saisir('#vi-mont', '400');
  const chip = t.$$('#vi-postes .chip').filter(b => /Révision/.test(b.textContent))[0];
  verifierVrai('les postes se cochent depuis l’intervention', chip);
  chip.click(); await t.pause(150);
  t.$('#vi-dep').checked = true;
  t.clic('#vi-ok'); await t.pause(500);

  const v = t.stock('vehicule');
  verifier('l’intervention est au carnet', 1, v.interventions.length);
  verifierVrai('le compteur suit le kilométrage noté',
    /230\u00A0000|230 000/.test(t.texte('#veh-carnet')));
  const dep = (t.stock('depenses') || [])[0];
  verifierVrai('la dépense correspondante est créée', dep);
  /* « Réparation matériel », c'est la tronçonneuse. Le garage a désormais sa
     propre catégorie, sans quoi une facture de véhicule et une lame de
     débroussailleuse se comptaient au même endroit. */
  verifier('en frais véhicule', 'VEHIC', dep.lignes[0].categorie);
  verifierVrai('et liée à l’intervention', dep.vehicule === v.interventions[0].id);

  t.clic('[data-vue="echeancesv"]'); await t.pause(350);
  const ech = t.texte('#veh-echeances');
  verifierVrai('la révision cochée repart du kilométrage',
    /Révision[^—]*— dans 30 000 km/.test(ech.replace(/\u00A0/g, ' ')));
  verifierVrai('la courroie jamais faite est dépassée',
    /Courroie[^—]*— dépassée de 70 000 km/.test(ech.replace(/\u00A0/g, ' ')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Véhicule : une dépense d’entretien suggère le carnet, pas deux fois', async () => {
  /* Le kilométrage nourrit les échéances : une réparation saisie dans les
     Dépenses mérite d'être notée au carnet aussi. Mais celle que le carnet
     vient de créer ne doit pas la réclamer en retour. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  t.clic('[data-vue="depenses"]'); await t.pause(300);
  t.clic('#dep-nouvelle'); await t.pause(400);
  t.saisir('[data-dl="0"]', 'Vidange');
  t.saisir('[data-dlttc="0"]', '250');
  await categorieDep(t, 0, 'ENTRETIEN'); await t.pause(200);
  t.clic('#dp-ok'); await t.pause(500);
  verifierVrai('la suggestion est faite',
    /carnet du véhicule/.test(t.$('#toast').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Sauvegarde : un carnet de véhicule seul s’importe et complète', async () => {
  /* Trois oublis de la 4.59, tous trouvés en préparant son import réel : le
     contrôle « le fichier est-il vide ? » ne regardait pas le carnet, la
     fusion des postes sautait ceux du même nom sans reprendre leur « dernier
     fait », et le résumé annonçait « rien restauré » alors que tout arrivait. */
  const t = await ouvrir(VIDE);
  const fichier = {
    format: 'bordcub-sauvegarde-1', version: 8,
    vehicule: {
      infos: { nom: 'Mon utilitaire', note: 'repères' },
      releves: [],
      interventions: [{ id: 'vi1', quoi: 'Révision', date: new Date(2026, 3, 3, 12).getTime(),
        km: 171000, montant: 328.78, garantie: false, postes: [] }],
      /* Un poste que l'application sème déjà, mais qui arrive daté. */
      postes: [{ id: 'vp1', nom: 'Révision (vidange + filtres)', pkm: 30000,
        dernierKm: 171000, dernierDate: new Date(2026, 3, 3, 12).getTime() },
      { id: 'vp2', nom: 'Pare-brise', pkm: null, pmois: 60 }]
    }
  };
  t.w.confirm = () => true;
  /* Le champ de restauration est fabriqué à la volée : on l'attrape. */
  let champ = null;
  const vrai = t.d.createElement.bind(t.d);
  t.d.createElement = function (tag) {
    const el = vrai(tag);
    if (String(tag).toLowerCase() === 'input') champ = el;
    return el;
  };
  t.clic('#s-restaurer');
  t.d.createElement = vrai;
  verifierVrai('le champ de fichier est bien créé', champ);
  t.w.FileReader = function () {
    this.readAsText = () => { this.result = JSON.stringify(fichier); this.onload && this.onload(); };
  };
  Object.defineProperty(champ, 'files', { value: [{ name: 'carnet.json' }], configurable: true });
  champ.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(400);
  if (t.$('#re-fus')) { t.clic('#re-fus'); await t.pause(500); }
  await t.pause(600);

  const v = t.stock('vehicule');
  verifierVrai('le fichier n’est pas jugé vide', v);
  verifier('l’intervention est arrivée', 1, (v.interventions || []).length);
  verifier('et l’identité du véhicule aussi', 'Mon utilitaire', (v.infos || {}).nom);
  const rev = (v.postes || []).filter(p => p.nom === 'Révision (vidange + filtres)');
  verifier('le poste du même nom n’est pas dupliqué', 1, rev.length);
  verifier('mais il reprend le « dernier fait » qui arrive', 171000, rev[0].dernierKm);
  verifierVrai('et un poste inconnu s’ajoute',
    (v.postes || []).some(p => p.nom === 'Pare-brise'));
  verifierVrai('le message ne dit plus que rien n’a été restauré',
    /intervention/.test(t.$('#toast').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Déclarations : la base des cotisations est dite, et se change', async () => {
  /* Le taux s'applique tantôt au brut, tantôt à la base abattue selon le
     régime. L'écran la figeait sur l'abattue sans le dire : il lisait un
     montant dont il ignorait l'assiette. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    cfg: { tauxCotisations: 25 },
    chantiers: [{ id: 'c1', nom: 'Coupe', statut: 'facture', aDevis: false, temps: [],
      maj: Date.now(), dateFacture: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="analyses"]'); await t.pause(350);
  t.clic('[data-ana="declarations"]'); await t.pause(400);
  verifierVrai('le champ existe', t.$('#decl-base'));
  verifier('l’abattement est retenu par défaut', 'abattu', t.$('#decl-base').value);
  verifierVrai('et l’assiette est dite sous le montant',
    /cotisations sur 500/.test(t.texte('#ana-corps')));

  t.choisir('#decl-base', 'brut'); await t.pause(450);
  verifier('le choix est retenu', 'brut', (t.stock('cfg') || {}).baseCotisations);
  verifierVrai('et le calcul suit le brut',
    /cotisations sur 1 000/.test(t.texte('#ana-corps').replace(/\u00A0/g, ' ')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fusionner : le carnet arrive, et rien d’autre ne bouge', async () => {
  /* « T'es sûr que ça ne me supprimera rien d'autre ? » La bonne question, et
     elle a trouvé un défaut : la fenêtre qui annonce le contenu du fichier ne
     comptait ni les versements ni le carnet, si bien qu'un fichier n'en
     portant que le carnet s'annonçait « rien de reconnaissable » en face de
     trente-deux chantiers. Devant ça, personne n'ose appuyer. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', nom: 'Coupe des Places', statut: 'paye', aDevis: false, temps: [],
        numeroFacture: 'F-2026-0042', dateFacture: Date.now(), maj: Date.now(),
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] },
      { id: 'c2', nom: 'Plantation du haut', statut: 'encours', aDevis: true,
        temps: [], lignes: [], maj: Date.now() }
    ],
    depenses: [{ id: 'd1', date: Date.now(),
      lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 90, taux: 20 }] }],
    articles: [{ id: 'a1', nom: 'Gaine de protection', unite: 'unite' }]
  }));
  const etat = () => JSON.stringify({
    ch: (t.stock('chantiers') || []).map(c => c.nom + '/' + (c.numeroFacture || '')),
    dep: (t.stock('depenses') || []).length,
    art: (t.stock('articles') || []).length
  });
  const avant = etat();

  const fichier = {
    format: 'bordcub-sauvegarde-1', version: 8,
    vehicule: {
      infos: { nom: 'Peugeot Expert Dangel 4x4' }, releves: [],
      interventions: [
        { id: 'vi1', quoi: 'Révision', date: new Date(2026, 3, 3, 12).getTime(), km: 171000,
          montant: 328.78, garantie: false, postes: [] },
        { id: 'vi2', quoi: 'Freinage', date: new Date(2024, 11, 18, 12).getTime(), km: 122273,
          montant: 934.57, garantie: false, postes: [] }
      ],
      postes: [{ id: 'vp1', nom: 'Révision (vidange + filtres)', pkm: 30000,
        dernierKm: 171000, dernierDate: new Date(2026, 3, 3, 12).getTime() }]
    }
  };
  let champ = null;
  const vrai = t.d.createElement.bind(t.d);
  t.d.createElement = function (tag) {
    const el = vrai(tag);
    if (String(tag).toLowerCase() === 'input') champ = el;
    return el;
  };
  t.clic('#s-restaurer');
  t.d.createElement = vrai;
  t.w.FileReader = function () {
    this.readAsText = () => { this.result = JSON.stringify(fichier); this.onload && this.onload(); };
  };
  Object.defineProperty(champ, 'files', { value: [{ name: 'carnet.json' }], configurable: true });
  champ.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(500);

  /* La fenêtre doit nommer ce qui arrive, sinon on n'ose pas appuyer. */
  const dit = t.texte('#modale-corps') || '';
  verifierVrai('la fenêtre annonce ce que le fichier contient',
    /2 interventions du véhicule/.test(dit));
  verifierVrai('elle n’annonce plus « rien de reconnaissable »',
    !/rien de reconnaissable/.test(dit));
  verifierVrai('et elle rappelle ce qui est déjà là', /2 chantiers/.test(dit));

  t.clic('#re-fus'); await t.pause(900);
  verifier('rien d’autre n’a bougé', avant, etat());
  const v = t.stock('vehicule');
  verifier('le carnet est arrivé entier', 2, (v.interventions || []).length);
  verifier('et le poste semé a repris sa date', 171000,
    (v.postes || []).filter(p => p.nom === 'Révision (vidange + filtres)')[0].dernierKm);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Le carnet, les dépenses et la fiche du véhicule d'un même essai. Les
   nombres sont choisis pour tomber ronds : un taux au kilomètre qu'il faut
   recalculer à la main pour relire le test ne se relit pas. */
const LE_V = (a, m, j) => new Date(a, m, j, 12).getTime();
const VEHIC_ESSAI = () => ({
  module: 'finances',
  /* 10 L/100 à 2 € le litre : le carburant vaut donc 20 c€ du kilomètre, et
     ce chiffre ne doit rien devoir aux dépenses de carburant saisies. */
  cfg: { litres100: 10, prixLitre: 2 },
  vehicule: {
    infos: { nom: 'Utilitaire', kmAchat: 100000, prixAchat: 20000,
      kmRevente: 200000, kmParAn: 10000, fraisAn: 600 },
    releves: [], postes: [],
    interventions: [
      { id: 'i1', quoi: 'Révision', date: LE_V(2025, 0, 10), km: 100000, montant: 400, garantie: false },
      { id: 'i2', quoi: 'Amortisseurs', date: LE_V(2026, 0, 10), km: 150000, montant: 1200, garantie: false },
      /* Sous garantie : rien n'est sorti de sa poche. */
      { id: 'i3', quoi: 'Moteur', date: LE_V(2025, 5, 1), km: 120000, montant: 3000, garantie: true }
    ]
  },
  depenses: [
    /* Le carburant « pro » compte d'office : la catégorie est celle de
       l'utilitaire, il n'a rien à re-marquer. */
    { id: 'd1', date: LE_V(2025, 6, 1), lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 120, taux: 20 }] },
    { id: 'd2', date: LE_V(2025, 8, 1), lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 120, taux: 20 }] },
    /* Cinq cents euros de carte grise, en « Frais véhicule ». */
    { id: 'd3', date: LE_V(2025, 1, 1),
      lignes: [{ libelle: 'Carte grise', categorie: 'VEHIC', ttc: 500, taux: 0 }] },
    /* Le carburant du véhicule personnel n'a rien à faire là. */
    { id: 'd4', date: LE_V(2025, 2, 1), lignes: [{ libelle: 'Essence perso', categorie: 'CARBPERSO', ttc: 60, taux: 20 }] }
  ]
});
const ouvrirCoutsV = async (graines) => {
  const t = await ouvrir(Object.assign({}, VIDE, graines));
  await parMenu(t, 'vehicule');
  t.clic('[data-vue="coutsv"]'); await t.pause(400);
  return t;
};
const texteCouts = t => t.texte('#veh-couts').replace(/ /g, ' ');

/* --------------------------------------------------------------------- */
scenario('Véhicule : chaque coût a son propre dénominateur', async () => {
  /* La première version divisait tout par la même chose et se trompait d'un
     facteur vingt-quatre : treize mois de carburant rapportés à sept ans de
     kilomètres, soit 0,65 c€ le kilomètre là où la réalité en vaut seize.
     Un plein de sept cents kilomètres coûte environ cent euros ; c'est ce
     repère-là qui a débusqué le défaut. */
  const t = await ouvrirCoutsV(VEHIC_ESSAI());
  const txt = texteCouts(t);

  /* Les dépenses de carburant saisies valent 200 € HT et l'étendue du carnet
     50 000 km : l'ancien calcul aurait affiché 0,4 c€ au lieu de 20. C'est cet
     écart-là que la vérification garde. */
  verifierVrai('le carburant est modélisé, pas divisé', /Carburant20,0 c€/.test(txt));
  verifierVrai('et il dit sur quoi il repose', /10,0 L\/100 km à 2,000 € le litre/.test(txt));

  /* 1 600 € hors garantie sur les 50 000 km que le carnet couvre. */
  verifierVrai('l’entretien exclut ce qui était sous garantie',
    /Entretien et réparations3,2 c€/.test(txt));
  verifierVrai('et il annonce l’étendue du carnet',
    /1 600 € sur 50 000 km de carnet/.test(txt));

  /* 20 000 € sur les 100 000 km qui restent à rouler avec — jamais sur ceux
     déjà faits : une carte grise payée hier ne vaut pas un euro du kilomètre
     parce qu'on n'a fait que cinq cents mètres depuis. */
  verifierVrai('l’achat se répartit sur ce qui reste à rouler',
    /Achat du véhicule20,0 c€/.test(txt));
  verifierVrai('la carte grise aussi', /Carte grise et frais uniques0,5 c€/.test(txt));
  verifierVrai('les frais annuels se rapportent aux kilomètres d’une année',
    /Assurance et frais annuels6,0 c€/.test(txt));

  /* 20 + 3,2 + 20 + 0,5 + 6 = 49,7 : le total est une somme de taux, pas une
     division unique. */
  verifierVrai('le total additionne les cinq taux', /Total49,7 c€/.test(txt));
  verifierVrai('et se lit aussi aux cent kilomètres', /49,70 €pour 100 km/.test(txt));

  verifierVrai('le carburant personnel n’y entre pas', !/Essence perso/.test(txt));
  verifierVrai('et l’intervention la plus chère est nommée',
    /Ce qui a coûté le plus/.test(txt) && /Amortisseurs/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Véhicule : le prix du litre est une moyenne pondérée', async () => {
  /* « Il faudrait faire une moyenne pondérée par rapport à la quantité,
     évidemment, pas juste une moyenne simple. » Un plein de soixante litres
     pèse trois fois un plein de vingt. */
  const g = VEHIC_ESSAI();
  g.depenses = [
    /* 60 L à 1,50 € = 90 €, puis 20 L à 2,50 € = 50 €.
       Moyenne simple des deux prix : 2,000 €. Moyenne pondérée : 140 / 80 =
       1,750 €. Les deux nombres diffèrent, donc le test distingue bien les
       deux calculs — avec deux pleins de même volume il ne prouverait rien. */
    { id: 'd1', date: LE_V(2025, 6, 1),
      lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 90, taux: 20, litres: 60 }] },
    { id: 'd2', date: LE_V(2025, 8, 1),
      lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 50, taux: 20, litres: 20 }] },
    /* Ce plein-là n'a pas ses litres : il est écarté de la moyenne. Le compter
       pour zéro litre laisserait la division intacte tout en gonflant le prix
       moyen — c'est le piège que l'utilisateur avait vu venir. */
    { id: 'd3', date: LE_V(2025, 9, 1),
      lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 400, taux: 20 }] }
  ];
  const t = await ouvrirCoutsV(g);
  const txt = texteCouts(t);

  verifierVrai('la moyenne est pondérée par les litres', /1,750 € le litre/.test(txt));
  verifierVrai('et non la moyenne simple des prix', !/2,000 € le litre/.test(txt));
  verifierVrai('le plein sans litres est écarté, pas compté pour zéro',
    /moyenne pondérée sur 2 pleins de 3/.test(txt));
  verifierVrai('et l’écart est annoncé', /1 plein sans litres saisis, écarté/.test(txt));
  /* 10 L/100 à 1,750 € : le carburant retombe à 17,5 c€. */
  verifierVrai('le carburant suit ce prix-là', /Carburant17,5 c€/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Véhicule : sans litres saisis, le réglage prend le relais', async () => {
  const t = await ouvrirCoutsV(VEHIC_ESSAI());
  const txt = texteCouts(t);
  verifierVrai('le prix vient du réglage', /prix du réglage, faute de litres saisis/.test(txt));
  verifierVrai('et le calcul se fait quand même', /Carburant20,0 c€/.test(txt));
  verifierVrai('l’écran invite à saisir les litres',
    /Aucun plein ne porte ses litres/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Véhicule : une facture notée au carnet n’est pas comptée deux fois', async () => {
  /* La nouvelle catégorie « Frais véhicule » ouvre la porte au double
     comptage : la même facture de garage peut vivre en dépense et en
     intervention. Le lien entre les deux tranche — le carnet compte, la
     dépense se tait. */
  const g = VEHIC_ESSAI();
  g.depenses.push(
    /* Liée à l'intervention i2 : ses 1 200 € sont déjà dans l'entretien. */
    { id: 'd5', date: LE_V(2026, 0, 10), vehicule: 'i2',
      lignes: [{ libelle: 'Amortisseurs', categorie: 'VEHIC', ttc: 1440, taux: 20 }] }
  );
  const t = await ouvrirCoutsV(g);
  const txt = texteCouts(t);
  /* Sans la garde, les 1 200 € de la dépense s'ajouteraient aux 500 € de carte
     grise : 1 700 / 100 000 = 1,7 c€ au lieu de 0,5. */
  verifierVrai('les frais uniques ne retiennent que la carte grise',
    /Carte grise et frais uniques0,5 c€/.test(txt));
  verifierVrai('et le disent en une seule dépense', /500 € en 1 dépense/.test(txt));
  verifierVrai('l’entretien, lui, ne bouge pas',
    /Entretien et réparations3,2 c€/.test(txt));
  verifierVrai('le total reste celui des cinq taux', /Total49,7 c€/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Véhicule : la dépense se verse dans le carnet', async () => {
  /* « Il faudrait que je puisse cocher : est-ce que ça s'ajoute à
     l'historique ? » Toutes les dépenses du véhicule ne sont pas des
     interventions — une carte grise n'a rien à faire dans un carnet
     d'entretien — d'où la case plutôt qu'un automatisme. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  t.clic('[data-vue="depenses"]'); await t.pause(300);
  t.clic('#dep-nouvelle'); await t.pause(400);

  verifierVrai('l’offre du carnet est cachée tant que rien ne s’y rapporte',
    t.$('#dp-carnet').hidden);
  t.saisir('[data-dl="0"]', 'Plaquettes avant');
  t.saisir('[data-dlttc="0"]', '360');
  await categorieDep(t, 0, 'VEHIC'); await t.pause(250);
  verifierVrai('elle apparaît sur une ligne « Frais véhicule »', !t.$('#dp-carnet').hidden);
  verifierVrai('le kilométrage reste caché tant qu’on ne coche pas', t.$('#dp-histkm').hidden);

  cocher(t, '#dp-hist', true); await t.pause(150);
  verifierVrai('cocher ouvre le kilométrage', !t.$('#dp-histkm').hidden);
  t.saisir('#dp-km', '231415');
  t.clic('#dp-ok'); await t.pause(600);

  const v = t.stock('vehicule');
  const inter = (v.interventions || [])[0];
  verifierVrai('l’intervention est créée', !!inter);
  verifier('avec le libellé de la ligne', 'Plaquettes avant', inter.quoi);
  verifier('et son kilométrage', 231415, inter.km);
  /* 360 TTC à 20 % font 300 HT : le carnet raisonne en hors taxes, comme
     l'historique repris de ses factures. Y verser le TTC gonflerait
     l'entretien d'un cinquième. */
  verifier('le carnet retient le hors taxes', 300, inter.montant);

  const d = (t.stock('depenses') || []).filter(x => x.vehicule === inter.id)[0];
  verifierVrai('la dépense porte le lien vers l’intervention', !!d);
  verifierVrai('et le message dit que le carnet a été complété',
    /notée dans le carnet/.test(t.$('#toast').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Véhicule : l’intervention crée sa dépense en TTC', async () => {
  /* Le sens inverse. Le carnet parle hors taxes, la dépense parle TTC :
     recopier l'un dans l'autre sous-déclarait la TVA d'un cinquième. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  await parMenu(t, 'vehicule');
  t.clic('#vh-plus'); await t.pause(400);
  t.saisir('#vi-quoi', 'Révision');
  t.saisir('#vi-km', '180000');
  t.saisir('#vi-mont', '300');
  cocher(t, '#vi-dep', true);
  t.clic('#vi-ok'); await t.pause(600);

  const d = (t.stock('depenses') || [])[0];
  verifierVrai('la dépense est créée', !!d);
  verifier('en « Frais véhicule »', 'VEHIC', d.lignes[0].categorie);
  verifier('et la TVA est rajoutée par-dessus le hors taxes', 360, d.lignes[0].ttc);
  const v = t.stock('vehicule');
  verifier('le carnet garde son montant hors taxes', 300,
    (v.interventions || []).filter(x => x.quoi === 'Révision')[0].montant);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Dépense : la case « concerne le véhicule » la rattache', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  t.clic('[data-vue="depenses"]'); await t.pause(300);
  t.clic('#dep-nouvelle'); await t.pause(400);
  verifierVrai('la case existe', t.$('#dp-veh'));
  verifier('décochée par défaut', false, t.$('#dp-veh').checked);
  t.saisir('[data-dl="0"]', 'Carte grise');
  t.saisir('[data-dlttc="0"]', '498');
  await categorieDep(t, 0, 'COTIS'); await t.pause(200);
  cocher(t, '#dp-veh', true);
  t.clic('#dp-ok'); await t.pause(500);
  const d = (t.stock('depenses') || [])[0];
  verifierVrai('la dépense est rattachée au véhicule', d.vehicule);
  verifierVrai('et la suggestion du carnet ne se déclenche pas',
    !/carnet du véhicule/.test(t.$('#toast').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Journée d’office : un jour posé et confirmé qui passe compte 8 h, avec son ○', async () => {
  /* Décisions des 02 et 03/11 (G4) : plus de jour « à trancher ». Un jour
     posé et confirmé que la date a dépassé, sans journée saisie pour ce
     chantier ce jour-là, compte comme une journée faite — sa part de
     journée, sans prestation — avec un ○ jusqu'à ce qu'on en ouvre la fiche.
     Une journée saisie ce jour-là la remplace : jamais deux fois. */
  const j = JCAL;
  const lig = [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 800, nature: 'prestation' }];
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: j(-10) },
    chantiers: [
      { id: 'c1', nom: 'Dégagement Martin', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [],
        jours: [{ d: j(-3), p: 1 }, { d: j(-2), p: 1 }, { d: j(0), p: 1 }, { d: j(2), p: 1 }] },
      { id: 'c2', nom: 'Les Essarts', statut: 'termine', aDevis: false, dateFin: j(-1), maj: Date.now(),
        lignes: lig, temps: [], jours: [{ d: j(-4), p: 1 }] }],
    journees: [{ id: 'jx', date: j(-2), chantier: 'c1', personnes: 1, nonProd: 7, postes: [] }]
  }));
  const C0 = t.w.BCC, A0 = () => t.w.BCUI._etat();
  const office = () => C0.joursDOffice(A0().chantiers, A0().journees, A0().cfg.absences, A0().cfg, Date.now())
    .map(o => o.chantier.id + ' ' + C0.jourCle(o.d));
  const ch = id => A0().chantiers.filter(c => c.id === id)[0];
  const heuresLe = (id, ts) => C0.arr((ch(id).temps || []).filter(x => C0.jourCle(x.date) === C0.jourCle(ts))
    .reduce((s, x) => s + C0.heuresSaisie(x, A0().cfg), 0), 2);
  verifier('comptent d’office : le jour passé sans saisie, ni celui qui est saisi, ni aujourd’hui, ni demain',
    ['c2 ' + C0.jourCle(j(-4)), 'c1 ' + C0.jourCle(j(-3))], office());
  verifier('8 h ce jour-là, sur ce chantier', 8, heuresLe('c1', j(-3)));
  verifier('le jour saisi garde ses 7 h, sans journée d’office en plus', 7, heuresLe('c1', j(-2)));
  verifier('sans prestation : rien pour les rendements', [], (ch('c1').temps || []).filter(x => x.office && x.activite).map(x => x.activite));
  /* Une journée d'office est une journée : le temps passé et le prix par
     journée la comptent comme les autres. */
  verifier('temps passé du chantier terminé : une journée', 1, C0.tempsPasse(ch('c2'), A0().cfg));
  verifier('prix par journée : le montant sur cette journée', 800, C0.prixJour(ch('c2'), A0().cfg));
  verifier('et la fiche dit le même prix', 800, C0.troisChiffres(ch('c2'), A0().cfg).parJour);
  /* Le ○ : dans la grille, la légende, Derniers jours, la fiche ▸ Travaux. */
  let c = await caseDuJour(t, j(-3));
  verifierVrai('la case est « fait », avec un ○', /st-travaille/.test(c.className) && c.querySelector('.cal-o'));
  verifierVrai('la légende dit le ○', /comptée d’office \(8 h\)/.test(t.texte('#cal-leg2')));
  verifierVrai('« Ce mois-ci » le dit', /Dégagement Martin · 8 h/.test(t.texte('#cal-histo')) || new Date(j(-3)).getMonth() !== new Date(A0().calMois).getMonth());
  await parBarre(t, 'aujourdhui');
  const dj = t.$('#aj-jours [data-ajouvre="jour:' + C0.minuit(j(-3)) + '"]');
  verifierVrai('Derniers jours la montre, avec son ○', dj && /○/.test(dj.textContent) && /comptée d’office/.test(dj.textContent));
  t.w.BCUI._ouvrirChantier('c1', 'travaux'); await t.pause(350);
  verifierVrai('la fiche ▸ Travaux aussi', /○ comptée d’office/.test(t.texte('#vue-chantier')));
  /* Ouvrir la fiche du jour efface le ○. */
  await parBarre(t, 'aujourdhui');
  t.clic('#aj-jours [data-ajouvre="jour:' + C0.minuit(j(-3)) + '"]'); await t.pause(500);
  verifierVrai('un appui ouvre la fiche du jour', /Comptée d’office : 8 h sur Dégagement Martin/.test(t.texte('#fj-office') || ''));
  verifier('ouverte, le ○ s’efface : la pose est marquée vue', true,
    ((t.stock('chantiers') || [])[0].jours || []).filter(x => C0.jourCle(x.d) === C0.jourCle(j(-3)))[0].vu);
  verifierVrai('la journée compte toujours', office().indexOf('c1 ' + C0.jourCle(j(-3))) >= 0);
  /* Préciser : Ma journée déjà remplie ; enregistrée, elle remplace l'office. */
  t.clic('#fj-preciser'); await t.pause(500);
  verifier('Préciser ouvre Ma journée, chantier et durée remplis', [jourISO(j(-3)), 'c1', '8'],
    [t.$('#mj-date') && t.$('#mj-date').value, t.$('#mj-ch') && t.$('#mj-ch').value, t.$('#mj-total') && t.$('#mj-total').value]);
  t.clic('#mj-ok'); await t.pause(600);
  verifier('la journée saisie remplace celle d’office', ['c2 ' + C0.jourCle(j(-4))], office());
  verifier('jamais 16 h : 8 h ce jour-là', 8, heuresLe('c1', j(-3)));
  await parBarre(t, 'agenda');
  c = await caseDuJour(t, j(-3));
  verifierVrai('et la case n’a plus de ○', c && !c.querySelector('.cal-o'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Journée d’office : « Je n’y étais pas » la retire ; devis pas signé et jour d’avant la mise à jour ne comptent pas', async () => {
  const j = JCAL;
  const ch = (id, statut, jours, extra) => Object.assign({ id, nom: 'Chantier ' + id, statut, aDevis: true,
    maj: Date.now(), lignes: [], temps: [], jours }, extra);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: j(-5) },
    chantiers: [
      ch('c1', 'encours', [{ d: j(-3), p: 1 }]),
      /* Posé sur un devis pas signé : il ne compte pas, il reste pâle. */
      ch('c2', 'envoye', [{ d: j(-2), p: 1 }]),
      /* Signé, mais posé « devis pas signé » à la main : il ne compte pas. */
      ch('c3', 'accepte', [{ d: j(-2), p: 0.5, ferme: false }]),
      /* D'avant la mise à jour : tel quel, sans rien compter, sans relance. */
      ch('c4', 'encours', [{ d: j(-8), p: 1 }]),
      /* Pas signé, mais posé « Posé » à la main : le choix fait foi. */
      ch('c5', 'envoye', [{ d: j(-1), p: 0.5, ferme: true }]),
      /* Posé avant la signature : signer ensuite ne le rend pas fait. */
      ch('c6', 'accepte', [{ d: j(-4), p: 1 }], { dateSignature: j(-1) })]
  }));
  const C0 = t.w.BCC, A0 = () => t.w.BCUI._etat();
  const office = () => C0.joursDOffice(A0().chantiers, A0().journees, A0().cfg.absences, A0().cfg, Date.now())
    .map(o => o.chantier.id + ' ' + C0.jourCle(o.d) + ' ' + o.heures);
  verifier('ne comptent que le confirmé et le « Posé » choisi à la main',
    ['c1 ' + C0.jourCle(j(-3)) + ' 8', 'c5 ' + C0.jourCle(j(-1)) + ' 4'], office());
  let c = await caseDuJour(t, j(-8));
  verifierVrai('le jour d’avant la mise à jour reste posé, pâle, sans ○ ni « ? »',
    c && /st-confirme/.test(c.className) && /passe/.test(c.className) && !c.querySelector('.cal-o, .cal-q'));
  c = await caseDuJour(t, j(-2));
  verifierVrai('le jour sur devis pas signé : pointillés pâles', c && /st-prevu/.test(c.className) && /passe/.test(c.className));
  await parBarre(t, 'aujourdhui');
  verifierVrai('aucune relance sur Aujourd’hui', !t.$('#aj-retard') && !/non saisi|trancher/i.test(t.texte('#vue-accueil')));
  /* « Je n'y étais pas » : le jour posé s'en va dans la Corbeille, et en revient. */
  await parBarre(t, 'agenda');
  await cliquerJour(t, j(-3));
  verifierVrai('la fiche du jour propose « Je n’y étais pas »', t.$('#fj-nonla'));
  t.clic('#fj-nonla'); await t.pause(600);
  verifier('le jour est retiré', [], ((t.stock('chantiers') || []).filter(x => x.id === 'c1')[0].jours || []));
  verifier('plus de journée d’office', ['c5 ' + C0.jourCle(j(-1)) + ' 4'], office());
  t.clic('#s-recuperer'); await t.pause(450);
  verifierVrai('il est dans la Corbeille', /Chantier c1/.test(t.texte('#s-recup')) && /Jour posé/.test(t.texte('#s-recup')));
  t.clic('[data-repecher]'); await t.pause(600);
  verifier('repêché, il compte de nouveau', ['c1 ' + C0.jourCle(j(-3)) + ' 8', 'c5 ' + C0.jourCle(j(-1)) + ' 4'], office());
  verifier('aucune erreur', [], t.erreurs);
});

/* ===================================================================== */
/* Lot r1b (4.93.0) : devis en jours, journée d'office par jour, jours en
   pointillés passés, bulle d'information, fiche du jour par chantier, liste
   Chantiers. Les dates passent par JCAL, à midi ; les fins de validité se
   recomptent ici avec Date, indépendamment de l'application. */
const finEnJours = (ts, n) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };

scenario('Devis r1b : en retard le jour de l’échéance, pas la veille ; validité en jours, anciens mois relus', async () => {
  const j = JCAL;
  const t0 = await ouvrir(VIDE);
  const C0 = t0.w.BCC;
  /* La logique : jours, mois d'avant, défaut des réglages. */
  verifier('validité 45 j : fin = date du devis + 45 jours', finEnJours(j(-10), 45),
    C0.finValiditeDevis({ aDevis: true, dateDevis: j(-10), validiteJours: 45 }));
  verifier('un ancien devis à 3 mois garde sa date de fin (31 janvier → 30 avril)', '2026-04-30',
    jourISO(C0.finValiditeDevis({ aDevis: true, dateDevis: new Date(2026, 0, 31, 12).getTime(), validiteDevis: 3 })));
  verifier('les jours priment sur les mois', finEnJours(j(-10), 20),
    C0.finValiditeDevis({ aDevis: true, dateDevis: j(-10), validiteDevis: 3, validiteJours: 20 }));
  verifier('sans validité : date du devis + 30 (le réglage d’office)', finEnJours(j(-10), 30),
    C0.echeanceDevis({ aDevis: true, dateDevis: j(-10) }, {}));
  verifier('sans date de devis : la date d’envoi', finEnJours(j(-7), 30),
    C0.echeanceDevis({ aDevis: true, dateEnvoi: j(-7) }, {}));
  verifier('réglage passé à 20 : suivi', finEnJours(j(-10), 20),
    C0.echeanceDevis({ aDevis: true, dateDevis: j(-10) }, { joursValiditeDevis: 20 }));
  /* En retard le jour même de la fin, sans préavis. */
  const alerte = (ch, cfg) => C0.alertes([Object.assign({ id: 'x', statut: 'envoye', aDevis: true }, ch)], cfg || {}, Date.now())
    .filter(a => a.type === 'devis').map(a => a.texte);
  verifier('la veille de l’échéance : rien', [], alerte({ dateDevis: j(-44), validiteJours: 45 }));
  verifier('le jour de l’échéance : en retard', ['devis valable jusqu’à aujourd’hui, sans réponse'],
    alerte({ dateDevis: j(-44), validiteJours: 44 }));
  verifierVrai('le lendemain : expiré', /^devis expiré le .*, sans réponse$/.test(alerte({ dateDevis: j(-44), validiteJours: 43 })[0] || ''));
  verifier('sans validité, envoyé il y a 29 jours : rien', [], alerte({ dateEnvoi: j(-29) }));
  verifier('sans validité, envoyé il y a 30 jours : en retard', 1, alerte({ dateEnvoi: j(-30) }).length);
  verifier('réglage à 20 : envoyé il y a 20 jours, en retard', 1, alerte({ dateEnvoi: j(-20) }, { joursValiditeDevis: 20 }).length);
  verifier('plus de préavis exporté', undefined, C0.PREAVIS_DEVIS);

  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { joursRelanceDevis: 21 },
    chantiers: [
      { id: 'c1', nom: 'Neuf', statut: 'devis', aDevis: true, lignes: [], temps: [], maj: Date.now() },
      { id: 'c2', nom: 'Ancien', statut: 'envoye', aDevis: true, lignes: [], temps: [], maj: Date.now(),
        dateDevis: new Date(2026, 0, 31, 12).getTime(), validiteDevis: 3, dateEnvoi: new Date(2026, 0, 31, 12).getTime() },
      { id: 'dz', nom: 'Échu ce jour', statut: 'envoye', aDevis: true, lignes: [], temps: [], maj: Date.now(),
        dateDevis: j(-44), validiteJours: 44 },
      { id: 'dv', nom: 'Échu demain', statut: 'envoye', aDevis: true, lignes: [], temps: [], maj: Date.now(),
        dateDevis: j(-44), validiteJours: 45 }]
  }));
  /* Un devis neuf : 30 proposés, modifiables ; la fin dessous. */
  t.w.BCUI._ouvrirChantier('c1', 'devis'); await t.pause(350);
  t.clic('#f-devis'); await t.pause(350);
  verifier('30 jours proposés d’office', '30', t.$('#ce-validite') && t.$('#ce-validite').value);
  t.choisir('#ce-datedevis', jourISO(j(-10)));
  t.saisir('#ce-validite', '45'); await t.pause(150);
  verifier('la fin s’affiche dessous', 'Valable 45 jours, jusqu’au ' + new Date(finEnJours(j(-10), 45)).toLocaleDateString('fr-FR') + '.',
    t.texte('#ce-validite-fin'));
  t.clic('#dv-ok'); await t.pause(450);
  let c = (t.stock('chantiers') || []).filter(x => x.id === 'c1')[0];
  verifier('enregistrée en jours', [45, null], [c.validiteJours, c.validiteDevis == null ? null : c.validiteDevis]);
  verifierVrai('la fiche dit « Valable 45 jours, jusqu’au … »', /Valable 45 jours, jusqu’au \d\d\/\d\d\/\d{4}/.test(t.texte('#f-validite') || ''));
  /* Un ancien devis en mois : « 3 mois », même fin, tant qu'on ne tape pas de jours. */
  t.w.BCUI._ouvrirChantier('c2', 'devis'); await t.pause(350);
  verifierVrai('la fiche de l’ancien dit ses mois', /Valable 3 mois, jusqu’au 30\/04\/2026/.test(t.texte('#f-validite') || ''));
  t.clic('#f-devis'); await t.pause(350);
  verifier('la case est vide et montre « 3 mois »', ['', '3 mois'], [t.$('#ce-validite').value, t.$('#ce-validite').placeholder]);
  verifier('même fin qu’avant', 'Valable 3 mois, jusqu’au 30/04/2026.', t.texte('#ce-validite-fin'));
  t.clic('#dv-ok'); await t.pause(450);
  c = (t.stock('chantiers') || []).filter(x => x.id === 'c2')[0];
  verifier('les mois restent en base, pas de jours inventés', [3, null], [c.validiteDevis, c.validiteJours == null ? null : c.validiteJours]);
  /* En retard sur Aujourd'hui : le jour même, pas la veille. */
  await parBarre(t, 'aujourdhui');
  verifierVrai('échu ce jour : dans En retard', ligneAuj(t, 'relancer:dz') && /valable jusqu’à aujourd’hui/.test(ligneAuj(t, 'relancer:dz').textContent));
  verifierVrai('échu demain : pas encore', !ligneAuj(t, 'relancer:dv'));
  /* Le réglage : nouveau nom, nouvelle clé, l'ancienne gardée. */
  verifier('le réglage s’appelle « Validité des devis par défaut (jours) »', 'Validité des devis par défaut (jours)',
    t.texte('label[for="r-rd"]'));
  verifier('30 d’office', '30', t.$('#r-rd').value);
  t.choisir('#r-rd', '20'); await t.pause(250);
  const cfg = t.stock('cfg') || {};
  verifier('écrit sous son nouveau nom, l’ancien gardé tel quel', [20, 21], [cfg.joursValiditeDevis, cfg.joursRelanceDevis]);
  verifier('aucune erreur', [], t0.erreurs.concat(t.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Journée d’office r1b : la règle est par jour — une journée saisie sur un autre chantier l’efface', async () => {
  /* « Si Ma journée est saisie pour ce jour, elle remplace la journée
     d'office » (02/11, confirmé le 05/11) : n'importe quelle journée à cette
     date, tout chantier. */
  const j = JCAL;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: j(-10) },
    chantiers: [
      { id: 'a', nom: 'Chantier A', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [],
        jours: [{ d: j(-4), p: 0.5 }, { d: j(-3), p: 1 }, { d: j(-2), p: 1 }] },
      { id: 'b', nom: 'Chantier B', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [], jours: [] }],
    journees: [{ id: 'jb', date: j(-3), chantier: 'b', personnes: 1, nonProd: 6, postes: [] },
      { id: 'jn', date: j(-4) - 3 * 3600000, lieu: 'Dépôt', personnes: 1, nonProd: 2, postes: [] }]
  }));
  const C0 = t.w.BCC, A0 = () => t.w.BCUI._etat();
  const office = () => C0.joursDOffice(A0().chantiers, A0().journees, A0().cfg.absences, A0().cfg, Date.now())
    .map(o => o.chantier.id + ' ' + C0.jourCle(o.d) + ' ' + o.heures);
  const heuresLe = (id, ts) => C0.arr((A0().chantiers.filter(c => c.id === id)[0].temps || [])
    .filter(x => C0.jourCle(x.date) === C0.jourCle(ts)).reduce((s, x) => s + C0.heuresSaisie(x, A0().cfg), 0), 2);
  verifier('seul le jour sans aucune journée compte d’office', ['a ' + C0.jourCle(j(-2)) + ' 8'], office());
  verifier('A, le jour d’une journée saisie sur B : 0 h d’office', 0, heuresLe('a', j(-3)));
  verifier('B garde ses 6 h', 6, heuresLe('b', j(-3)));
  verifier('une journée sans chantier efface aussi la demi-journée posée', 0, heuresLe('a', j(-4)));
  /* Sans journée ce jour-là : 8 h ; une demi-journée posée : 4 h. */
  A0().journees = [];
  t.w.BCUI._setCal(A0().calMois, null);
  verifier('sans journée : 8 h sur A, et la demi-journée fait 4 h',
    ['a ' + C0.jourCle(j(-4)) + ' 4', 'a ' + C0.jourCle(j(-3)) + ' 8', 'a ' + C0.jourCle(j(-2)) + ' 8'], office());
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Jours en pointillés passés (journée) : ne comptent jamais seuls, « J’y ai travaillé », « Je n’y étais pas »', async () => {
  const j = JCAL;
  const ch = (id, statut, jours, extra) => Object.assign({ id, nom: 'Chantier ' + id, statut, aDevis: true,
    maj: Date.now(), lignes: [], temps: [], jours }, extra);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: j(-10) },
    chantiers: [
      ch('c1', 'envoye', [{ d: j(-3), p: 1 }]),
      ch('c2', 'envoye', [{ d: j(-2), p: 0.5 }]),
      /* Signé après le jour posé : le jour ne compte toujours pas seul. */
      ch('c3', 'accepte', [{ d: j(-4), p: 1 }], { dateSignature: j(-1) }),
      /* D'avant la mise à jour : ni compte ni rappel. */
      ch('c4', 'envoye', [{ d: j(-12), p: 1 }])]
  }));
  const C0 = t.w.BCC, A0 = () => t.w.BCUI._etat();
  const etat = () => [A0().chantiers, A0().journees, A0().cfg.absences, A0().cfg, Date.now()];
  const office = () => C0.joursDOffice.apply(null, etat()).map(o => o.chantier.id + ' ' + C0.jourCle(o.d) + ' ' + o.heures);
  const pointilles = () => C0.joursEnPointilles.apply(null, etat()).map(o => o.chantier.id + ' ' + C0.jourCle(o.d));
  const k = n => C0.jourCle(j(n));
  verifier('aucun ne compte seul', [], office());
  verifier('les trois jours en pointillés depuis la mise à jour, pas celui d’avant',
    ['c3 ' + k(-4), 'c1 ' + k(-3), 'c2 ' + k(-2)], pointilles());
  /* La fiche du jour propose les deux choix. */
  await cliquerJour(t, j(-3));
  verifierVrai('la fiche du jour propose les deux choix', t.$('#fj-pointilles [data-fjytrav="c1"]') && t.$('#fj-pointilles [data-fjpasla="c1"]'));
  verifierVrai('elle ne dit plus « à régler à la main »', !/à régler à la main/.test(t.texte('#modale')));
  t.clic('[data-fjytrav="c1"]'); await t.pause(600);
  verifier('« J’y ai travaillé » : 8 h comptées', ['c1 ' + k(-3) + ' 8'], office());
  const tc1 = A0().chantiers.filter(c => c.id === 'c1')[0].temps;
  verifier('sans prestation : absentes des rendements', [null], tc1.map(x => x.activite));
  verifier('la marque est sur la pose, vue', [true, true], [(t.stock('chantiers')[0].jours[0] || {}).fait, (t.stock('chantiers')[0].jours[0] || {}).vu]);
  verifier('le jour sort des pointillés', ['c3 ' + k(-4), 'c2 ' + k(-2)], pointilles());
  let c = await caseDuJour(t, j(-3));
  verifierVrai('la case passe « fait »', c && /st-travaille/.test(c.className));
  /* « Je n'y étais pas » : à la Corbeille, d'où il revient. */
  await cliquerJour(t, j(-2));
  t.clic('[data-fjpasla="c2"]'); await t.pause(600);
  verifier('« Je n’y étais pas » : le jour posé s’en va', [], (t.stock('chantiers').filter(x => x.id === 'c2')[0].jours || []));
  t.clic('#s-recuperer'); await t.pause(450);
  verifierVrai('il est dans la Corbeille', /Chantier c2/.test(t.texte('#s-recup')));
  t.clic('[data-repecher]'); await t.pause(600);
  verifier('récupéré, il attend de nouveau', ['c3 ' + k(-4), 'c2 ' + k(-2)], pointilles());
  /* Le jour d'avant la mise à jour : pâle, à régler à la main, sans choix. */
  await parBarre(t, 'agenda');
  await cliquerJour(t, j(-12));
  verifierVrai('d’avant la mise à jour : sans les deux choix', !t.$('#fj-pointilles') && /à régler à la main/.test(t.texte('#modale')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Bulle d’Aujourd’hui : journées d’office neuves, pointillés repris le lendemain, rien de neuf, retour du téléphone', async () => {
  const j = JCAL;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: j(-10) },
    chantiers: [
      { id: 'a', nom: 'Les Essarts', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [], jours: [{ d: j(-2), p: 1 }] },
      { id: 'b', nom: 'Dupont', statut: 'envoye', aDevis: true, maj: Date.now(), lignes: [], temps: [], jours: [{ d: j(-3), p: 1 }] }]
  }));
  const C0 = t.w.BCC, A0 = () => t.w.BCUI._etat();
  const ma = C0.minuit(j(-2)), mb = C0.minuit(j(-3));
  verifier('au démarrage, Aujourd’hui la montre', ['vue-accueil', true], [vueActive(t), !!t.$('#aj-bulle')]);
  await parBarre(t, 'agenda');
  verifierVrai('hors d’Aujourd’hui : pas de bulle, et rien n’est marqué vu', !t.$('#aj-bulle') &&
    !(t.stock('chantiers')[0].jours[0] || {}).vu);
  await parBarre(t, 'aujourdhui');
  verifierVrai('Aujourd’hui affiché : la bulle', t.$('#aj-bulle'));
  verifierVrai('la journée d’office, avec Voir', /Les Essarts · 8 h/.test(t.texte('[data-ajboffice="a|' + ma + '"]') || '') &&
    t.$('[data-ajboffice="a|' + ma + '"] [data-ajbvoir]'));
  verifierVrai('le jour en pointillés, avec ses deux choix', /Dupont · journée/.test(t.texte('[data-ajbpointille="b|' + mb + '"]') || '') &&
    t.$('[data-ajbytrav="b|' + mb + '"]') && t.$('[data-ajbpasla="b|' + mb + '"]'));
  verifierVrai('les deux phrases', /Sylve l’a compté/.test(t.texte('#aj-bulle')) && /ne comptent pas tant que/.test(t.texte('#aj-bulle')));
  /* Le retour du téléphone la ferme comme OK. */
  t.w.dispatchEvent(new t.w.PopStateEvent('popstate')); await t.pause(400);
  verifierVrai('le retour la ferme', !t.$('#aj-bulle'));
  verifierVrai('on reste sur Aujourd’hui', vueActive(t) === 'vue-accueil');
  verifier('la journée d’office montrée passe vue', true, (t.stock('chantiers').filter(x => x.id === 'a')[0].jours[0] || {}).vu);
  await parBarre(t, 'agenda'); await parBarre(t, 'aujourdhui');
  verifierVrai('revenu le même jour : plus de bulle', !t.$('#aj-bulle'));
  /* Le lendemain, le jour en pointillés laissé tel quel revient — seul. */
  A0().masques['bulle:pointilles'] = C0.jourCle(j(-1));
  await parBarre(t, 'agenda'); await parBarre(t, 'aujourdhui');
  verifierVrai('le lendemain, le pointillé revient', t.$('[data-ajbpointille="b|' + mb + '"]'));
  verifierVrai('sans la journée d’office déjà vue', !t.$('[data-ajboffice]'));
  t.clic('[data-ajbytrav="b|' + mb + '"]'); await t.pause(600);
  verifierVrai('« J’y ai travaillé » réglé : la bulle n’a plus rien, elle se ferme', !t.$('#aj-bulle'));
  verifier('il compte', ['a', 'b'], C0.joursDOffice(A0().chantiers, A0().journees, A0().cfg.absences, A0().cfg, Date.now())
    .map(o => o.chantier.id).sort());

  /* Une liste longue : six lignes, puis « et N autres · Voir l'Agenda » ; OK
     ne marque vu que ce qui a été montré. */
  const huit = [];
  for (let i = 1; i <= 8; i++) huit.push({ d: j(-i), p: 1 });
  const t2 = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: j(-10) },
    chantiers: [{ id: 'l', nom: 'Long', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [], jours: huit }]
  }));
  await parBarre(t2, 'aujourdhui');
  verifier('six lignes au plus', 6, t2.$$('#aj-bulle [data-ajboffice]').length);
  verifierVrai('« et 2 autres · Voir l’Agenda »', /et 2 autres · Voir l’Agenda/.test(t2.texte('#ajb-agenda') || ''));
  t2.clic('#ajb-ok'); await t2.pause(500);
  verifierVrai('OK la ferme', !t2.$('#aj-bulle'));
  verifier('six vues, deux pas encore', 6, (t2.stock('chantiers')[0].jours || []).filter(x => x.vu).length);
  await parBarre(t2, 'agenda'); await parBarre(t2, 'aujourdhui');
  verifier('la bulle revient avec les deux qui restent', 2, t2.$$('#aj-bulle [data-ajboffice]').length);
  t2.clic('#ajb-ok'); await t2.pause(500);
  await parBarre(t2, 'agenda'); await parBarre(t2, 'aujourdhui');
  verifierVrai('après OK : plus de bulle', !t2.$('#aj-bulle'));

  /* Rien de neuf : pas de bulle. */
  const t3 = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: j(-10) },
    chantiers: [{ id: 'v', nom: 'Vu', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [], jours: [{ d: j(-2), p: 1, vu: true }, { d: j(3), p: 1 }] }]
  }));
  await parBarre(t3, 'aujourdhui');
  verifierVrai('rien de neuf : pas de bulle', !t3.$('#aj-bulle'));
  verifier('aucune erreur', [], t.erreurs.concat(t2.erreurs, t3.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Fiche du jour r1b : une ligne par chantier, l’appui ouvre Ma journée, ✕ met toute la journée à la Corbeille', async () => {
  const j = JCAL;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [
      { id: 'c1', nom: 'Bois du Haut', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [], jours: [] },
      { id: 'c2', nom: 'Les Fourches', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [], jours: [] }],
    journees: [
      { id: 'j1', date: j(-2), chantier: 'c1', personnes: 1, nonProd: 1, km: 30,
        postes: [{ travaux: 'DEGAG', heures: 4, quantite: 0 }, { travaux: 'DEPRES', heures: 3, quantite: 0 }] },
      { id: 'j2', date: j(-2), chantier: 'c2', personnes: 2, nonProd: 3, postes: [] }]
  }));
  const C0 = t.w.BCC, A0 = () => t.w.BCUI._etat();
  t.w.confirm = () => true;
  await cliquerJour(t, j(-2));
  const lignes = t.$$('#modale [data-fjch]');
  verifier('une ligne par chantier', ['c1', 'c2'], lignes.map(l => l.dataset.fjch));
  const l1 = t.texte('#modale [data-fjch="c1"]') || '';
  verifierVrai('la durée du jour et les deux prestations en petit',
    /Bois du Haut/.test(l1) && /1 j/.test(l1) && l1.indexOf(C0.nomTravail('DEGAG') + ', ' + C0.nomTravail('DEPRES')) >= 0);
  verifierVrai('× 2 pers. sur l’autre', /× 2 pers\./.test(t.texte('#modale [data-fjch="c2"]') || ''));
  t.clic('#modale [data-fjch="c1"] [data-fjmj]'); await t.pause(450);
  verifier('un appui : Ma journée de ce chantier', 'c1', t.$('#mj-ch') && t.$('#mj-ch').value);
  t.clic('#modale-x'); await t.pause(200);
  await cliquerJour(t, j(-2));
  t.clic('#modale [data-fjsupch="c1"]'); await t.pause(600);
  verifier('✕ : toute la journée de ce chantier part', ['j2'], (t.stock('journees') || []).map(x => x.id));
  verifier('plus d’heures ce jour-là sur ce chantier', 0, (A0().chantiers[0].temps || []).length);
  t.clic('#s-recuperer'); await t.pause(450);
  t.clic('[data-repecher]'); await t.pause(600);
  verifier('récupérée, elle revient entière', ['j2', 'j1'], (t.stock('journees') || []).map(x => x.id));
  verifier('et ses 8 h comptent de nouveau', 8, C0.arr((A0().chantiers[0].temps || []).reduce((s, x) => s + C0.heuresSaisie(x, A0().cfg), 0), 2));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Liste Chantiers r1b : À faire maintenant = En retard ; jours passés en travaux ; facturés qui attendent le paiement', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      chA('ret', { nom: 'Jours passés', statut: 'encours', aDevis: false, dateEntree: JA(-30), jours: [{ d: JA(-5), p: 1 }] }),
      chA('dz', { nom: 'Devis échu ce jour', statut: 'envoye', aDevis: true, dateDevis: JA(-44), validiteJours: 44 }),
      chA('dexp', { nom: 'Devis expiré', statut: 'envoye', aDevis: true, dateDevis: JA(-20), validiteJours: 10 }),
      chA('dok', { nom: 'Devis valable', statut: 'envoye', aDevis: true, dateDevis: JA(-2), validiteJours: 30 }),
      chA('fnon', { nom: 'Facturé à payer', statut: 'facture', numeroFacture: 'F-2', dateFacture: JA(-5), echeancePaiement: JA(10) }),
      chA('fechu', { nom: 'Facture échue', statut: 'facture', numeroFacture: 'F-1', dateFacture: JA(-60), echeancePaiement: JA(-3) }),
      chA('fac', { nom: 'À facturer', statut: 'termine', dateFin: JA(-5) })]
  }));
  await parBarre(t, 'chantiers'); await t.pause(200);
  verifier('À faire maintenant : facture échue, devis expiré, à facturer, devis échu ce jour',
    ['fechu', 'dexp', 'fac', 'dz'], groupeB2(t, 'faire'));
  verifierVrai('jours tous passés, pas terminé : En travaux', groupeB2(t, 'travaux').indexOf('ret') >= 0 && groupeB2(t, 'faire').indexOf('ret') < 0);
  verifier('facturé non échu : Facturés · attendent le paiement', ['fnon'], groupeB2(t, 'factures'));
  verifier('le groupe s’intitule ainsi, après En travaux',
    ['faire', 'travaux', 'factures', 'devis'], t.$$('#liste-chantiers [data-groupe]').map(s => s.dataset.groupe));
  verifierVrai('son titre', /^Facturés · attendent le paiement/.test(t.texte('#liste-chantiers [data-groupe="factures"] h2') || ''));
  verifier('le devis encore valable reste dans Devis', ['dok'], groupeB2(t, 'devis'));
  verifierVrai('le devis échu dit pourquoi', /Devis valable jusqu’à aujourd’hui/.test(t.texte('[data-groupe="faire"] [data-chouvrir="dz"]') || ''));
  await parBarre(t, 'aujourdhui');
  const enRetard = t.$$('#aj-retard [data-ajcle]').map(l => l.dataset.ajcle.split(':')[1]).sort();
  verifier('les mêmes que En retard d’Aujourd’hui', ['dexp', 'dz', 'fac', 'fechu'], enRetard);
  verifier('une seule liste de types, partagée', ['impaye', 'afacturer', 'devis'], t.w.BCC.TYPES_EN_RETARD);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis : on peut en attacher un à un chantier déjà facturé', async () => {
  /* « J'ai plein de travaux enregistrés avec des factures, j'ai des devis, et
     j'aimerais bien les attacher — ne serait-ce que pour attester qu'il y a
     eu un devis. » Fusionner les deux blocs avait fermé cette porte : sur un
     chantier facturé, le crayon ouvre la facture, et plus rien ne menait au
     devis. */
  const JOUR = 86400000;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Travaux Maciota', statut: 'paye', aDevis: false,
      temps: [], maj: Date.now(), numeroFacture: 'F-2026-0012',
      dateFacture: Date.now() - 5 * JOUR, datePaiement: Date.now(),
      jours: [{ d: Date.now() - 10 * JOUR, p: 1 }],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.choisir('#c-filtre', 'tous'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);

  verifierVrai('l’étape Devis dit qu’aucun devis n’est attaché',
    /Chantier sans devis/.test(t.texte('#f-etapes [data-etape="1"]')));
  const bouton = t.$('#f-devis-oui');
  verifierVrai('et propose d’en saisir un', bouton);
  verifier('le bouton le dit', 'Finalement, saisir un devis', bouton.textContent);

  t.clic('#f-devis-oui'); await t.pause(400);
  cocher(t, '#dv-a', true); await t.pause(250);
  t.saisir('#ce-numdevis-an', '2026');
  t.saisir('#ce-numdevis-rg', '7');
  t.choisir('#ce-signe', jourISO(Date.now() - 20 * JOUR)); await t.pause(150);
  t.clic('#dv-ok'); await t.pause(500);

  const c = (t.stock('chantiers') || [])[0];
  verifier('le devis est attaché', true, c.aDevis);
  verifier('avec son numéro', 'D-2026-0007', c.numeroDevis);
  /* Attacher un devis ne fait jamais reculer un chantier payé. */
  verifier('et le statut ne recule pas', 'paye', c.statut);

  const f = t.texte('#vue-chantier');
  verifierVrai('l’étape Devis l’affiche', /N° D-2026-0007/.test(f));
  /* Signé il y a vingt jours, dernière journée posée il y a dix : dix jours.
     « Savoir, à partir du moment où le devis est signé, sous combien de temps
     je réalise les travaux. » */
  verifierVrai('et dit en combien de temps il a été réalisé', /réalisé en 10 jours/.test(f));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Achats : la liste se range par ce qui presse, et le coché passe à la suite', async () => {
  /* « Des fois j'oublie, et il faut que je les garde en mémoire. » Un module
     à lui, pas un onglet enfoui : ce qu'on oublie doit se voir en arrivant. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'achats',
    achats: [
      { id: 'a1', quoi: 'Remorque', categorie: 'IMMO', ttc: 2400, taux: 20,
        priorite: 'unjour', note: 'pour ne plus louer', cree: 1 },
      { id: 'a2', quoi: 'Débroussailleuse', categorie: 'PETITMAT', ttc: 600, taux: 20,
        priorite: 'urgent', cree: 2 },
      { id: 'a3', quoi: 'Pantalon anti-coupure', categorie: 'EPI', ttc: 180, taux: 20,
        priorite: 'annee', cree: 3 }
    ]
  }));
  await t.pause(300);

  /* Le plus pressé d'abord, le « un jour » en dernier. */
  const noms = t.$$('#ach-liste .ach-corps b').map(e => e.textContent);
  verifier('rangé du plus pressé au moins',
    ['Débroussailleuse', 'Pantalon anti-coupure', 'Remorque'], noms);
  const txt = t.texte('#ach-liste');
  verifierVrai('chaque groupe est nommé',
    /Dès que possible/.test(txt) && /Dans l’année/.test(txt) && /Un jour/.test(txt));
  /* 2 400 + 600 + 180 = 3 180 € TTC. */
  verifierVrai('le total à prévoir est annoncé', /3 180 €à prévoir, TTC/.test(txt));
  verifierVrai('et ce à quoi ça sert se lit', /pour ne plus louer/.test(txt));
  /* 600 TTC à 20 % font 500 HT. */
  verifierVrai('le hors taxes se lit sous le TTC', /500 € HT/.test(txt));

  /* Cocher : « dès que je le coche, ça va à la suite ». */
  t.clic('[data-achfait="a2"]'); await t.pause(450);
  const apres = t.$$('#ach-liste .ach-corps b').map(e => e.textContent);
  verifier('le coché passe en dernier',
    ['Pantalon anti-coupure', 'Remorque', 'Débroussailleuse'], apres);
  verifierVrai('mais il reste visible', apres.indexOf('Débroussailleuse') >= 0);
  verifierVrai('sous son propre intertitre', /Déjà achetés/.test(t.texte('#ach-liste')));
  const a2 = (t.stock('achats') || []).filter(x => x.id === 'a2')[0];
  verifier('il est marqué acheté', true, a2.fait);
  verifierVrai('et daté', a2.dateFait > 0);
  /* Le total ne compte plus que ce qui reste : 2 400 + 180 = 2 580 €. */
  verifierVrai('le total ne retient plus que ce qui attend',
    /2 580 €à prévoir, TTC/.test(t.texte('#ach-liste')));

  /* Un achat repoussé n'est pas un achat perdu : on le décoche. */
  t.clic('[data-achfait="a2"]'); await t.pause(450);
  verifier('décocher le remet dans la liste', false,
    (t.stock('achats') || []).filter(x => x.id === 'a2')[0].fait);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Achats : le TTC se saisit, le hors taxes se déduit', async () => {
  /* « Je rentre juste le TTC, puis ça me calcule le hors taxes. » C'est ce
     qu'il lit sur une étiquette. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'achats' }));
  await t.pause(300);
  t.clic('#ach-plus'); await t.pause(400);
  t.saisir('#ac-quoi', 'Remorque');
  t.saisir('#ac-ttc', '2400'); await t.pause(200);
  /* 2 400 TTC à 20 % : 2 000 HT et 400 € de TVA. */
  const aide = t.texte('#ac-ht');
  verifierVrai('le hors taxes s’écrit sous le champ', /2 000 €/.test(aide));
  verifierVrai('et la TVA récupérable aussi', /400 € de TVA/.test(aide));
  t.choisir('#ac-taux', '10'); await t.pause(200);
  verifierVrai('changer le taux refait le compte',
    /2 181,82 €/.test(t.texte('#ac-ht')));

  t.choisir('#ac-cat', 'IMMO');
  t.clic('[data-acpri="urgent"]'); await t.pause(150);
  t.saisir('#ac-note', 'pour ne plus louer à chaque plantation');
  t.clic('#ac-ok'); await t.pause(500);

  const a = (t.stock('achats') || [])[0];
  verifierVrai('l’achat est enregistré', !!a);
  verifier('avec ce que c’est', 'Remorque', a.quoi);
  verifier('sa catégorie', 'IMMO', a.categorie);
  verifier('son montant TTC', 2400, a.ttc);
  verifier('son taux', 10, a.taux);
  verifier('sa priorité', 'urgent', a.priorite);
  verifier('et à quoi ça va servir', 'pour ne plus louer à chaque plantation', a.note);
  verifier('il n’est pas acheté', false, a.fait);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Achats : ce que ça pèse se lit par priorité et par catégorie', async () => {
  /* « Juste pour savoir ce que je vais devoir dépenser prochainement. » */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'achats',
    achats: [
      { id: 'a1', quoi: 'Remorque', categorie: 'IMMO', ttc: 2400, taux: 20, priorite: 'unjour' },
      { id: 'a2', quoi: 'Débroussailleuse', categorie: 'IMMO', ttc: 600, taux: 20, priorite: 'urgent' },
      { id: 'a3', quoi: 'Pantalon', categorie: 'EPI', ttc: 180, taux: 20, priorite: 'urgent' },
      /* Déjà acheté : il ne pèse plus sur ce qui attend. */
      { id: 'a4', quoi: 'Casque', categorie: 'EPI', ttc: 90, taux: 20, priorite: 'urgent',
        fait: true, dateFait: Date.now() }
    ]
  }));
  await t.pause(300);
  t.clic('[data-vue="budget"]'); await t.pause(400);
  const txt = t.texte('#ach-budget');

  /* 2 400 + 600 + 180 = 3 180 TTC, soit 2 650 HT et 530 € de TVA. */
  verifierVrai('le TTC à sortir', /3 180 €à sortir, TTC/.test(txt));
  verifierVrai('le hors taxes', /2 650 €hors taxes/.test(txt));
  verifierVrai('et la TVA récupérable', /530 €TVA récupérable/.test(txt));
  /* Le casque acheté est écarté du total et compté à part. */
  verifierVrai('l’acheté est compté à part', /90 €dépensés/.test(txt));

  /* 600 + 180 = 780 € sur les deux achats pressés, et 2 400 sur le « un
     jour ». Viser la ligne entière : « · 2 » se retrouve partout. */
  verifierVrai('le pressé est chiffré', /Dès que possible · 2780 €/.test(txt));
  verifierVrai('et le « un jour » aussi', /Un jour · 12 400 €/.test(txt));
  verifierVrai('les catégories sont rangées par poids',
    txt.indexOf('Immobilisation') < txt.indexOf('EPI ou équipement'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Achats : la liste part dans les sauvegardes', async () => {
  /* Une liste qu'il tient parce qu'il oublie n'a aucun sens si elle
     disparaît au premier changement de téléphone. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'achats',
    achats: [{ id: 'a1', quoi: 'Remorque', categorie: 'IMMO', ttc: 2400, taux: 20,
      priorite: 'unjour', note: 'pour ne plus louer' }]
  }));
  await t.pause(300);
  const B = t.w.BCB;
  const sauv = B.construireSauvegarde(null, [], [], [], [], [], [], [], [], [], [], [], [],
    [], null, t.stock('achats'));
  verifier('le format monte de version', 9, sauv.version);
  verifier('la liste y est', 1, sauv.achats.length);
  /* Un fichier qui ne porte que des achats doit être lisible : le refuser
     faute de bordereau reviendrait à interdire l'import à qui n'a que ça. */
  const relu = B.lireSauvegarde({ format: sauv.format, achats: sauv.achats });
  verifierVrai('un fichier qui n’a que des achats se relit', !!relu);
  verifier('et il les rend', 'Remorque', relu.achats[0].quoi);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Bilan : une facture récente attend, elle n’est pas impayée', async () => {
  /* « C'est compliqué de les mettre en impayé si je viens à peine de les
     envoyer. » La bulle compte ce qui attend ; seule l'échéance dépassée
     mérite l'alerte, et elle existe déjà dans « À traiter ». */
  const JOUR = 86400000;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'facture', aDevis: false, temps: [], jours: [],
      maj: Date.now(), numeroFacture: 'F-2026-0001',
      dateFacture: Date.now() - 3 * JOUR, echeancePaiement: Date.now() + 27 * JOUR,
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }]
  }));
  await t.pause(300);
  /* Lot 5b : la bulle est partie. La facture attend dans Chantiers en
     cours, sans alerte ; ce qui attend se chiffre dans Argent. */
  const encours = t.texte('#aj-encours');
  verifierVrai('Aujourd’hui la montre en attente, pas impayée',
    /Facturé le \d\d\/\d\d\/\d{4} · à payer avant le/.test(encours) && !/impayée|échue/.test(t.texte('#vue-accueil')));
  verifierVrai('avec son montant', /1 000 €/.test(encours));
  /* Facturé il y a trois jours, échéance dans vingt-sept : rien ne chauffe. */
  verifierVrai('et rien ne chauffe pour si peu', !ligneAuj(t, 'impaye:c1') &&
    !t.$('#aj-encours .aj-situ.aj-alerte'));
  await parBarre(t, 'argent');
  /* Lot d1 : Argent ▸ Mois ▸ À ce jour, « Facturé, pas encore payé ». */
  const att = sansBlancs(t.texte('#mo-attente'));
  verifierVrai('Argent chiffre ce qui attend, sans le dire impayé : ' + att,
    att === sansBlancs('Facturé, pas encore payé1 facture1 000 €') && !/impay/.test(att));
  await parBarre(t, 'chantiers');
  verifierVrai('« À faire maintenant » ne réclame rien non plus',
    !t.$('[data-groupe="faire"]') && !!t.$('[data-groupe="factures"] [data-chouvrir="c1"]'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Bilan : passé l’échéance, la bulle chauffe et l’alerte le nomme', async () => {
  const JOUR = 86400000;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'facture', aDevis: false, temps: [], jours: [],
      maj: Date.now(), numeroFacture: 'F-2026-0001',
      dateFacture: Date.now() - 60 * JOUR, echeancePaiement: Date.now() - 12 * JOUR,
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }]
  }));
  await t.pause(300);
  /* Lot 5b : la bulle chaude est devenue la ligne « Facture impayée »
     d'En retard. */
  const l = t.$('#aj-retard [data-ajcle="impaye:c1"]');
  verifierVrai('la ligne est en retard, et chauffe', l && l.classList.contains('aj-alerte'));
  verifierVrai('elle dit depuis quand', /échue depuis 12 j/.test(texteLignes(t, 'impaye:c1')));
  verifier('et dit combien sont en retard : une facture', 1,
    t.$$('#aj-retard [data-ajcle^="impaye:"]').length);
  verifierVrai('« À faire maintenant » le nomme', /Facture échue depuis 12 j/.test(t.texte('[data-groupe="faire"]') || ''));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : le chantier facturé ne se propose plus, et remplit ce qu’il sait', async () => {
  /* « Une fois que c'est facturé, j'ai fini mes journées : ça n'a plus de
     sens de l'afficher. » Et : « en fin de journée je suis crevé, il faut que
     ce soit le plus efficace possible ». */
  const JOUR = 86400000;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise', cfg: { heuresJour: 8 },
    chantiers: [
      { id: 'c1', nom: 'Dégagement Martin', statut: 'encours', maj: Date.now(),
        foret: 'Forêt de la Côte', commune: 'Clairbois', donneur: 'Cabinet Dubois',
        temps: [{ date: Date.now() - 5 * JOUR, duree: 7, unite: 'h', personnes: 1, km: 64 }],
        jours: [{ d: Date.now() - 5 * JOUR, p: 1 }],
        lignes: [
          { travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' },
          /* Une fourniture n'est pas un poste de travail : elle n'ouvre rien. */
          { travail: 'F_PROTEC', unite: 'unite', quantite: 50, prix: 3, nature: 'vente' }
        ] },
      { id: 'c2', nom: 'Déjà facturé', statut: 'paye', maj: Date.now(), temps: [], jours: [],
        numeroFacture: 'F-2026-0002', datePaiement: Date.now(), lignes: [] }
    ]
  }));
  await t.pause(300);
  t.clic('#aj-jour'); await t.pause(450);

  const offerts = [...t.$('#mj-ch').options].map(o => o.value).filter(Boolean);
  verifierVrai('le chantier en cours est proposé', offerts.indexOf('c1') >= 0);
  verifierVrai('le chantier payé ne l’est plus', offerts.indexOf('c2') < 0);

  /* Choisir le chantier remplit ce qu'il sait déjà. */
  t.choisir('#mj-ch', 'c1'); await t.pause(300);
  verifier('la forêt est reprise', 'Forêt de la Côte', t.$('#mj-lieu').value);
  verifier('la commune aussi', 'Clairbois', t.$('#mj-commune').value);
  /* Les kilomètres du dernier trajet vers ce chantier : c'est la même route. */
  verifier('et les kilomètres habituels', '64', t.$('#mj-km').value);
  /* Le formulaire garde toujours une ligne vierge en dernier : on ne
     compare que les postes réellement ouverts. */
  const postes = t.$$('#mj-postes [data-pstt]').map(sel => sel.value).filter(Boolean);
  verifier('la prestation du chantier ouvre son poste', ['DEGAG'], postes);
  /* Une fourniture n'est pas un poste de travail. Elle n'a pas d'option
     dans ce sélecteur : ouvrir un poste pour elle ne se verrait pas sur les
     valeurs — la ligne ressortirait vide. C'est le nombre de lignes qui le
     trahit : une seule, celle du dégagement. */
  verifier('la fourniture n’ouvre aucun poste fantôme', 1,
    t.$$('#mj-postes [data-pstt]').length);
  /* Lot r2 : une seule prestation n'a pas de case d'heures ; le temps reste
     à lui. */
  verifierVrai('les heures restent à lui', !t.$('[data-psth="0"]') && !t.$('#mj-total').value);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : ce qui est déjà tapé n’est jamais écrasé', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', maj: Date.now(),
      foret: 'Forêt de la Côte', commune: 'Clairbois', temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }] }]
  }));
  await t.pause(300);
  t.clic('#aj-jour'); await t.pause(450);
  t.saisir('#mj-lieu', 'Bois du Haut');
  t.choisir('#mj-ch', 'c1'); await t.pause(300);
  verifier('la forêt tapée reste la sienne', 'Bois du Haut', t.$('#mj-lieu').value);
  verifier('mais la commune vide se remplit', 'Clairbois', t.$('#mj-commune').value);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : rien de la fenêtre ne s’est perdu (lot c2)', async () => {
  /* L'inventaire de non-perte du lot c2. Les champs et boutons sont lus dans
     docs/calendrier-journees.md ; chacun est retrouvé, et l'effet sur les
     données vérifié : saisie, modification, corbeille, « Comme le … ». */
  const DOC = fs.readFileSync(path.join(__dirname, '..', 'docs', 'calendrier-journees.md'), 'utf8').replace(/\r/g, '');
  const bloc = DOC.slice(DOC.indexOf('**Champs et boutons gardés**'));
  const ids = (bloc.slice(0, bloc.indexOf('.\n') + 1).match(/`([a-z-]+)`/g) || []).map(x => x.slice(1, -1));
  verifier('la liste des champs est lue dans la doc', 18, ids.length);
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', foret: 'Forêt de la Côte', commune: 'Clairbois',
      prixJour: 320, lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }] })],
    journees: [{ id: 'j0', date: JA(-2), chantier: 'c1', lieu: 'Les Essarts', km: 42, personnes: 1, nonProd: 0,
      postes: [{ travaux: 'DEGAG', heures: 7, quantite: 1 }] }]
  }));
  const present = i => i.indexOf('data-') === 0 ? !!t.$('#modale [' + i + ']') : !!t.$('#modale #' + i);
  const plusJournee = async () => { t.clic('#barre [data-barre="plus"]'); await t.pause(200);
    t.clic('#modale [data-plus="journee"]'); await t.pause(350); };

  /* --- saisie, par + ▸ Ma journée --------------------------------------- */
  await plusJournee();
  ids.filter(i => i !== 'mj-sup' && i !== 'data-pstsup')
    .forEach(i => verifierVrai('nouvelle journée ▸ ' + i, present(i)));
  t.clic('#pst-plus'); await t.pause(150);
  verifierVrai('nouvelle journée ▸ data-pstsup, dès deux prestations', present('data-pstsup'));
  t.clic('[data-pstsup="1"]'); await t.pause(150);
  verifier('le ✕ retire la ligne', 1, t.$$('#mj-postes [data-pstt]').length);
  t.choisir('#mj-ch', 'c1'); await t.pause(200);
  t.$('#mj-lieu').value = 'Bois du Haut';
  t.choisir('[data-pstt="0"]', 'DEGAG');
  /* Lot r2 : une seule prestation prend tout le temps productif, tapé à part. */
  t.saisir('[data-pstq="0"]', '1,5');
  t.saisir('#mj-total', '7'); t.saisir('#mj-prod', '6');
  verifierVrai('la ligne hors production', /6 h productives, 1 h hors production/.test(t.texte('#mj-horsprod')));
  t.saisir('#mj-trajet', '1'); t.saisir('#mj-km', '50'); t.saisir('#mj-pers', '2');
  t.$('#mj-fin').checked = true; t.saisir('#mj-note', 'pluie l’après-midi');
  verifierVrai('le pied dit le total, le trajet à côté', /^7 h/.test(t.texte('#mj-apercu')) &&
    /\+ 1 h de trajet/.test(t.texte('#mj-apercu')));
  t.clic('#mj-ok'); await t.pause(600);
  const neuve = (t.stock('journees') || []).filter(x => x.id !== 'j0')[0] || {};
  verifier('enregistrée telle qu’elle est tapée',
    { chantier: 'c1', lieu: 'Bois du Haut', commune: 'Clairbois', km: 50, nonProd: 1, trajet: 1, personnes: 2,
      fin: true, note: 'pluie l’après-midi', postes: [{ travaux: 'DEGAG', heures: 6, quantite: 1.5 }] },
    { chantier: neuve.chantier, lieu: neuve.lieu, commune: neuve.commune, km: neuve.km, nonProd: neuve.nonProd,
      trajet: neuve.trajet, personnes: neuve.personnes, fin: neuve.fin, note: neuve.note, postes: neuve.postes });
  verifier('« terminé » fait avancer le chantier', 'termine', (t.stock('chantiers') || [])[0].statut);

  /* --- modification, par Aujourd'hui ▸ Derniers jours -------------------- */
  await parBarre(t, 'aujourdhui');
  t.clic('[data-ajouvre="journee:' + neuve.id + '"]'); await t.pause(450);
  verifier('elle se rouvre en modification', 'Modifier la journée', t.texte('#modale-titre'));
  verifierVrai('avec mj-sup', present('mj-sup'));
  t.saisir('#mj-note', 'corrigé');
  t.clic('#mj-ok'); await t.pause(600);
  verifier('la modification est gardée, sans doublon', ['corrigé', 2],
    [((t.stock('journees') || []).filter(x => x.id === neuve.id)[0] || {}).note, (t.stock('journees') || []).length]);

  /* --- suppression, vers la corbeille ------------------------------------ */
  t.clic('[data-ajouvre="journee:' + neuve.id + '"]'); await t.pause(450);
  t.w.confirm = () => true;
  t.clic('#mj-sup'); await t.pause(600);
  verifier('elle quitte les journées', 1, (t.stock('journees') || []).length);
  const poubelle = Object.keys(t.w.localStorage).filter(k => k.indexOf('bordcub.poubelle.') === 0)
    .map(k => JSON.parse(t.w.localStorage.getItem(k)));
  verifierVrai('et entre dans la corbeille', poubelle.some(p => p.type === 'journee' && p.o && p.o.id === neuve.id));

  /* --- « Comme le … » ----------------------------------------------------- */
  await plusJournee();
  verifierVrai('« Comme le … » en tête', /^Comme le /.test(t.texte('#mj-hier')));
  t.clic('#mj-hier'); await t.pause(450);
  verifier('il copie le chantier, le lieu, les km, la prestation ; ni la date ni les heures',
    ['c1', 'Les Essarts', '42', 'DEGAG', '', jourISO(Date.now())],
    [t.$('#mj-ch').value, t.$('#mj-lieu').value, t.$('#mj-km').value, t.$('[data-pstt="0"]').value,
      t.$('#mj-total').value, t.$('#mj-date').value]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : la frappe ne refait aucun champ, le clavier reste ouvert', async () => {
  /* Le « change » d'un champ texte, qui part quand on le quitte, refaisait
     toutes les lignes : passer des heures à la quantité remplaçait le champ
     sous le doigt, et le téléphone refermait son clavier. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8 },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', lignes: [
      { travail: 'PLANT', unite: 'plant', quantite: 1200, prix: 1.1, nature: 'prestation' },
      { travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 600, nature: 'prestation' }] })]
  }));
  t.clic('#aj-jour'); await t.pause(350);
  t.choisir('#mj-ch', 'c1'); await t.pause(200);
  /* Lot r2 : les heures par prestation paraissent une fois la répartition
     demandée ; chaque durée a ses deux cases, h et min. */
  t.clic('#pst-rep'); await t.pause(150);
  const SEL = ['[data-psth="0"]', '[data-pstq="0"]', '[data-psth="1"]', '[data-pstq="1"]',
    '#mj-total', '#mj-total-m', '#mj-prod', '#mj-prod-m', '#mj-trajet', '#mj-trajet-m', '#mj-km', '#mj-pers'];
  const avant = SEL.map(s => t.$(s));
  verifierVrai('deux prestations ouvertes', avant.every(Boolean));
  const taper = (n, v) => {
    n.focus(); n.value = v;
    n.dispatchEvent(new t.w.Event('input', { bubbles: true }));
    /* Ce qui part quand le doigt passe au champ suivant. */
    n.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  };
  const gardes = [];
  avant.forEach((n, i) => {
    taper(n, ['4', '200', '3', '1', '8', '', '7', '', '1', '15', '42', '1'][i]);
    gardes.push(t.$(SEL[i]) === n && t.d.activeElement === n);
  });
  verifier('chaque champ reste le même, et garde le doigt', SEL.map(() => true), gardes);
  /* Changer de prestation ne change que l'étiquette de la quantité. */
  t.choisir('[data-pstt="1"]', 'PROTEC');
  verifierVrai('l’étiquette suit la prestation', /u\)/.test(t.texte('#pst-ql-1')));
  verifier('et aucun champ n’a été refait', SEL.map(() => true), SEL.map((s, i) => t.$(s) === avant[i]));
  verifierVrai('le rendement s’est mis à jour sur place', /400 plant\/jour/.test(t.texte('#pst-r-0')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : un chantier posé ce jour-là est pré-choisi, un seul (P4)', async () => {
  const auj = JA(0), seul = JA(1), deux = JA(2);
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [
      chA('c1', { nom: 'Vaux', statut: 'encours', foret: 'Forêt de la Côte', commune: 'Clairbois',
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }],
        jours: [{ d: auj, p: 1 }, { d: deux, p: 1 }] }),
      chA('c2', { nom: 'Marchand', statut: 'accepte', foret: 'Bois Joli', jours: [{ d: deux, p: 1 }] }),
      chA('c3', { nom: 'Autre', statut: 'encours', jours: [{ d: seul, p: 0.5 }] }),
      chA('c4', { nom: 'Ancien', statut: 'encours' })],
    /* Hier, pas aujourd'hui : un jour déjà noté s'ouvre en modification. */
    journees: [{ id: 'j9', date: JA(-1), chantier: null, lieu: 'Atelier', personnes: 1, nonProd: 3, postes: [] }]
  }));
  const choix = () => t.$('#mj-ch').value;
  const date = async ts => { t.choisir('#mj-date', jourISO(ts)); await t.pause(200); };

  t.clic('#aj-jour'); await t.pause(350);
  verifier('un seul posé aujourd’hui : pré-choisi', 'c1', choix());
  verifier('et il remplit ce qu’il sait', ['Forêt de la Côte', 'Clairbois', 'DEGAG'],
    [t.$('#mj-lieu').value, t.$('#mj-commune').value, t.$('[data-pstt="0"]').value]);
  verifierVrai('l’aide le dit', /choisi d’office/.test(t.texte('#mj-chaide')));

  await date(deux);
  verifier('deux posés : aucun pré-choix', '', choix());
  verifier('les deux en tête de la liste', ['c1', 'c2'],
    [...t.$('#mj-ch').options].slice(1, 3).map(o => o.value).sort());
  verifier('ce que le pré-choix avait rempli repart', ['', '', ''],
    [t.$('#mj-lieu').value, t.$('#mj-commune').value, t.$('[data-pstt="0"]').value]);
  await date(seul);
  verifier('changer la date ré-évalue', 'c3', choix());
  await date(auj);
  verifier('et encore', 'c1', choix());

  t.saisir('#mj-lieu', 'Mon bois');
  await date(deux); await date(auj);
  verifier('rien n’écrase un champ tapé', 'Mon bois', t.$('#mj-lieu').value);

  t.choisir('#mj-ch', 'c4'); await t.pause(200);
  await date(seul);
  verifier('choisi à la main, la date ne le change plus', 'c4', choix());
  t.clic('#modale-x'); await t.pause(150);

  /* Les autres portes : le +, et la fiche du jour. */
  t.clic('#barre [data-barre="plus"]'); await t.pause(200);
  t.clic('#modale [data-plus="journee"]'); await t.pause(350);
  verifier('+ ▸ Ma journée : pré-choisi aussi', 'c1', choix());
  t.clic('#modale-x'); await t.pause(150);
  await parBarre(t, 'agenda');
  await cliquerJour(t, auj);
  t.clic('#fj-travaille'); await t.pause(400);
  verifier('fiche du jour ▸ Saisir ma journée : pré-choisi', 'c1', choix());
  t.clic('#modale-x'); await t.pause(150);

  /* En modification, rien n'est pré-choisi : la journée est à lui. */
  await parBarre(t, 'aujourdhui');
  t.clic('[data-ajouvre="journee:j9"]'); await t.pause(450);
  verifier('modification : pas de pré-choix', ['Modifier la journée', ''], [t.texte('#modale-titre'), choix()]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : choisir le chantier ne remplit que les champs vides', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', foret: 'Forêt de la Côte', commune: 'Clairbois',
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }] })],
    journees: [{ id: 'j0', date: JA(-3), chantier: 'c1', km: 64, personnes: 1, nonProd: 2, postes: [] }]
  }));
  t.clic('#aj-jour'); await t.pause(350);
  t.saisir('#mj-km', '12');
  /* Lot r2 : une seule prestation n'a pas de case d'heures ; sa quantité. */
  t.choisir('[data-pstt="0"]', 'PLANT'); t.saisir('[data-pstq="0"]', '3');
  t.choisir('#mj-ch', 'c1'); await t.pause(250);
  verifier('les km tapés restent', '12', t.$('#mj-km').value);
  verifier('la prestation tapée reste', ['PLANT', '3'], [t.$('[data-pstt="0"]').value, t.$('[data-pstq="0"]').value]);
  verifier('la forêt et la commune vides se remplissent', ['Forêt de la Côte', 'Clairbois'],
    [t.$('#mj-lieu').value, t.$('#mj-commune').value]);
  t.clic('#modale-x'); await t.pause(150);
  t.clic('#aj-jour'); await t.pause(350);
  t.choisir('#mj-ch', 'c1'); await t.pause(250);
  verifier('champs vides : les km de la dernière journée sur ce chantier', '64', t.$('#mj-km').value);
  verifier('et une ligne par prestation, sans heures', ['DEGAG', false, ''],
    [t.$('[data-pstt="0"]').value, !!t.$('[data-psth="0"]'), t.$('#mj-total').value]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : le rendement sous chaque prestation, le total au pied', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, prixJourVise: 280 },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', prixJour: 320,
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1200, prix: 1.1, nature: 'prestation' }] })]
  }));
  t.clic('#aj-jour'); await t.pause(350);
  t.choisir('#mj-ch', 'c1'); await t.pause(200);
  /* Lot r2 : une seule prestation prend tout le temps productif, proposé
     égal au total. */
  t.saisir('#mj-total', '4'); t.saisir('[data-pstq="0"]', '100');
  verifierVrai('100 plants en 4 h : 200 par jour', /≈ 200 plant\/jour/.test(t.texte('#pst-r-0')));
  t.saisir('#mj-pers', '2');
  verifierVrai('à deux, 400', /≈ 400 plant\/jour/.test(t.texte('#pst-r-0')));
  const pied = () => t.texte('#mj-apercu');
  verifierVrai('une demi-journée, au prix de journée du chantier',
    /^4 h/.test(pied()) && /0,50 journée(?!s)/.test(pied()) && /160(,00)? €/.test(pied()) && /320 €\/j/.test(pied()));
  t.saisir('#mj-trajet', '4');
  verifierVrai('le trajet n’en fait pas une journée : il se dit à côté', /^4 h/.test(pied()) &&
    /0,50 journée(?!s)/.test(pied()) && /160(,00)? €/.test(pied()) && /\+ 4 h de trajet/.test(pied()));
  verifierVrai('le pied tient Enregistrer', t.$('.mj-pied #mj-ok') && t.$('.mj-pied #mj-apercu'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche du jour : « ← jour » ramène des fenêtres qu’elle ouvre', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8 },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'accepte', aDevis: true, jours: [{ d: JCAL(3), p: 1 }] })]
  }));
  await t.pause(200);
  await cliquerJour(t, JCAL(3));
  const titre = t.texte('#modale-titre');
  for (const b of ['#fj-deplacer', '#fj-absent', '#fj-poser']) {
    t.clic(b); await t.pause(350);
    verifierVrai(b + ' : la fenêtre monte du bas et porte « ← jour »',
      t.$('#modale').classList.contains('feuille-nav') && !!t.texte('#retour-jour') && titre.indexOf(t.texte('#retour-jour')) === 0);
    t.clic('#retour-jour'); await t.pause(350);
    verifier(b + ' : « ← jour » rouvre la fiche du jour', titre, t.texte('#modale-titre'));
  }
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Accueil : le jour qui vient dit pour qui on travaille', async () => {
  /* « Il faudrait juste mettre pour qui je travaille, le donneur d'ordre. »
     C'est ce qu'on veut savoir la veille. */
  const JOUR = 86400000;
  const demain = new Date(Date.now() + JOUR); demain.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Dégagement Martin', statut: 'accepte', maj: Date.now(),
      donneur: 'Cabinet Dubois', temps: [], lignes: [],
      jours: [{ d: demain.getTime(), p: 1 }] }]
  }));
  await t.pause(300);
  /* Lot r1 : Bientôt est parti ; « posé demain » se dit sur la ligne du
     chantier, dans Chantiers en cours, avec le donneur d'ordre. */
  const ligne = t.$('#aj-encours [data-ajch="c1"]');
  const dit = ligne ? ligne.textContent.replace(/\s+/g, ' ') : '';
  verifierVrai('le jour est annoncé : ' + dit, /posé demain/.test(dit));
  verifierVrai('avec le chantier', /Dégagement Martin/.test(dit));
  verifierVrai('et pour qui', /Cabinet Dubois/.test(dit));
  verifierVrai('plus de bloc Bientôt', !t.$('#aj-bientot') && !/Bientôt/.test(t.texte('#vue-accueil')));
  ligne && ligne.click(); await t.pause(400);
  verifierVrai('elle ouvre la fiche du chantier', vueActive(t) === 'vue-chantier' &&
    /Dégagement Martin/.test(t.texte('#vue-chantier')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Achats : les priorités sont des horizons, pas un millésime', async () => {
  /* « Cette année, ça ne veut rien dire si on est à la fin de l'année. Il
     faudrait un entre-deux : dans les trois mois, dans les six mois, dans
     les douze mois, et puis un jour. » */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'achats' }));
  await t.pause(300);
  t.clic('#ach-plus'); await t.pause(400);
  const crans = t.$$('#ac-pri [data-acpri]').map(b => b.textContent);
  verifier('cinq horizons',
    ['Dès que possible', 'Dans les 3 mois', 'Dans les 6 mois', 'Dans l’année', 'Un jour'], crans);
  verifierVrai('« Cette année » a disparu', crans.indexOf('Cette année') < 0);

  t.saisir('#ac-quoi', 'Remorque');
  t.saisir('#ac-ttc', '2400');
  t.clic('[data-acpri="six"]'); await t.pause(150);
  t.clic('#ac-ok'); await t.pause(500);
  verifier('l’horizon choisi est retenu', 'six', (t.stock('achats') || [])[0].priorite);
  verifierVrai('et la liste le nomme', /Dans les 6 mois/.test(t.texte('#ach-liste')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Typographie : le pourcentage ne se sépare pas de son nombre', async () => {
  /* « Le logo pourcentage va à la ligne parce que le chiffre est trop gros. »
     eur() pose déjà une insécable devant le « € » pour cette raison ; le
     pourcentage l'avait oubliée. Une regex écrite avec une espace ordinaire
     ne matche donc plus — c'est le piège jumeau de celui de l'euro. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', temps: [], jours: [], maj: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const brut = t.$('#vue-chantier').textContent;
  verifierVrai('le taux porte une insécable', /20\u00A0%/.test(brut));
  verifierVrai('et jamais une espace ordinaire', !/20 %/.test(brut));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Un jour du calendrier, à trois jours d'ici, à midi : les dates de
   l'application passent par midi, et un test qui poserait minuit dépendrait
   du fuseau. */
const JCAL = n => { const d = new Date(Date.now() + n * 86400000); d.setHours(12, 0, 0, 0); return d.getTime(); };
/* L'Agenda n'affiche qu'un mois : un jour visé « il y a deux jours » est dans
   le mois précédent le 1er et le 2. On amène la grille sur le mois du jour
   avant de chercher sa case — sinon la case n'existe pas, et le scénario
   ment deux jours par mois. */
async function caseDuJour(t, ts) {
  const cible = t.w.BCC.minuit(ts);
  for (let i = 0; i < 24; i++) {
    const c = t.$('#cal-grille [data-jour="' + cible + '"]');
    if (c) return c;
    const premier = t.$('#cal-grille [data-jour]');
    if (!premier) return null;
    t.clic(cible < Number(premier.dataset.jour) ? '#cal-prec' : '#cal-suiv');
    await t.pause(120);
  }
  return null;
}
async function cliquerJour(t, ts, attente) {
  const c = await caseDuJour(t, ts);
  if (c) c.click();
  await t.pause(attente || 450);
  return !!c;
}
/* Poser un chantier (lot r1) : la feuille liste les chantiers à choisir, puis
   le statut du jour. */
async function choisirAPoser(t, id, st) {
  const ok = t.clic('#modale [data-pjch="' + id + '"]'); await t.pause(150);
  if (st) { t.clic('#modale [data-pjst="' + st + '"]'); await t.pause(100); }
  return ok;
}
/* L'appui long (G2) : le doigt tenu sur la case, ou le clic droit. jsdom n'a
   pas de PointerEvent : un MouseEvent du même nom suffit aux écouteurs. */
async function appuiLong(t, ts, maniere) {
  const c = await caseDuJour(t, ts);
  if (!c) return null;
  if (maniere === 'souris') {
    const e = new t.w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    c.dispatchEvent(e);
    await t.pause(100);
    return e;
  }
  c.dispatchEvent(new t.w.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
  await t.pause(650);
  c.dispatchEvent(new t.w.MouseEvent('pointerup', { bubbles: true, button: 0 }));
  /* Le doigt levé donne un clic sur la case : il ne doit rien rouvrir. */
  c.dispatchEvent(new t.w.MouseEvent('click', { bubbles: true, button: 0 }));
  await t.pause(150);
  return c;
}

scenario('Calendrier : un jour porte exactement un statut', async () => {
  /* « Une case-jour peut porter plusieurs statuts en même temps, plusieurs
     pastilles superposées, ce qui n'a pas de sens. » La case en empilait
     jusqu'à trois : provisoire, ferme, et du temps saisi. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8 },
    chantiers: [
      /* Un devis en attente pose un jour provisoire sur le même jour qu'un
         chantier accepté, et du temps y est saisi : trois pastilles avant. */
      { id: 'c1', nom: 'Devis en attente', statut: 'envoye', aDevis: true, temps: [],
        maj: Date.now(), lignes: [], jours: [{ d: JCAL(-2), p: 1 }] },
      { id: 'c2', nom: 'Chantier signé', statut: 'accepte', aDevis: true, maj: Date.now(),
        lignes: [], jours: [{ d: JCAL(-2), p: 1 }],
        temps: [{ date: JCAL(-2), duree: 7, unite: 'h', personnes: 1 }] }
    ]
  }));
  await t.pause(300);
  const case2 = await caseDuJour(t, JCAL(-2));
  verifierVrai('la case existe', !!case2);
  verifier('une seule bande, jamais trois', 1, case2.querySelectorAll('.bande').length);
  /* Ce qui a eu lieu l'emporte sur ce qui était prévu. */
  verifierVrai('et c’est celle du travaillé', /st-travaille/.test(case2.className));

  /* Un jour seulement prévu reste prévu ; un jour seulement signé, confirmé. */
  const C0 = t.w.BCC;
  const occ = j => C0.occupation(t.stock('chantiers'), j, j, { heuresJour: 8 })[C0.jourCle(j)];
  verifier('un jour vide est libre', 'libre', C0.statutJour(occ(JCAL(5)), [], JCAL(5)));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : l’ordre des statuts ne laisse jamais d’ambiguïté', async () => {
  /* Le fait l'emporte sur le prévu, et une absence posée à la main l'emporte
     sur un chantier resté au planning — c'est un geste délibéré. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'calendrier' }));
  const C0 = t.w.BCC;
  const abs = [{ d: C0.minuit(JCAL(-1)), note: 'pluie' }];
  const prevu = { prevus: [{ fermete: 'provisoire' }], reels: [] };
  const ferme = { prevus: [{ fermete: 'ferme' }], reels: [] };
  const fait = { prevus: [{ fermete: 'ferme' }], reels: [{}] };
  verifier('un devis en attente donne « prévu »', 'prevu', C0.statutJour(prevu, [], JCAL(-1)));
  verifier('un devis signé donne « confirmé »', 'confirme', C0.statutJour(ferme, [], JCAL(-1)));
  verifier('du temps saisi donne « travaillé »', 'travaille', C0.statutJour(fait, [], JCAL(-1)));
  verifier('une absence l’emporte sur le planning', 'absent',
    C0.statutJour(ferme, abs, JCAL(-1)));
  /* Mais jamais sur ce qui a réellement eu lieu. */
  verifier('jamais sur ce qui a eu lieu', 'travaille', C0.statutJour(fait, abs, JCAL(-1)));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : cliquer un jour ouvre sa fiche, et on peut y poser un chantier', async () => {
  /* « Aujourd'hui la saisie ne se fait que depuis la fiche chantier ; il faut
     pouvoir le faire aussi depuis le calendrier. » */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', nom: 'Dégagement Martin', statut: 'accepte', aDevis: true,
      maj: Date.now(), lignes: [], temps: [], jours: [] }]
  }));
  await t.pause(300);
  const cible = t.w.BCC.minuit(JCAL(3));
  /* La grille n'affiche que le mois courant : en fin de mois, le jour visé est
     dans le suivant. */
  if (!t.$('[data-jour="' + cible + '"]')) { t.clic('#cal-suiv'); await t.pause(250); }
  t.clic('[data-jour="' + cible + '"]'); await t.pause(450);
  verifierVrai('la fiche du jour s’ouvre', /Libre/.test(t.texte('#modale')));
  verifierVrai('elle propose de poser un chantier', t.$('#fj-poser'));
  /* Un jour à venir ne propose pas d'y avoir travaillé. */
  verifier('mais pas d’y avoir déjà travaillé', null, t.$('#fj-travaille'));

  t.clic('#fj-poser'); await t.pause(400);
  await choisirAPoser(t, 'c1');
  t.clic('#pj-ok'); await t.pause(500);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le chantier est posé sur ce jour', 1, (c.jours || []).length);
  verifier('à la bonne date', t.w.BCC.jourCle(cible), t.w.BCC.jourCle(c.jours[0].d));
  const apres = t.$('[data-jour="' + cible + '"]');
  verifierVrai('et la case passe en posé', /st-confirme/.test(apres.className));
  verifier('une seule bande', 1, apres.querySelectorAll('.bande').length);

  /* Et une fois le chantier posé, on ne valide pas d'un doigt une journée
     qui n'a pas eu lieu (le geste est d'ailleurs parti au lot r1). */
  t.clic('[data-jour="' + cible + '"]'); await t.pause(450);
  verifierVrai('la fiche annonce ce qui est posé', /Dégagement Martin/.test(t.texte('#modale')));
  verifier('mais pas de validation d’un doigt', null, t.$('#fj-prevu'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : un jour non travaillé se pose, se note et se reprend', async () => {
  /* Le cinquième statut : congé, arrêt, intempérie. C'est la seule pièce du
     modèle qui n'était écrite nulle part. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'calendrier' }));
  await t.pause(300);
  const cible = t.w.BCC.minuit(JCAL(-1));
  await cliquerJour(t, cible);
  t.clic('#fj-absent'); await t.pause(400);
  t.saisir('#ab-note', 'pluie toute la journée');
  t.clic('#ab-ok'); await t.pause(500);

  const cfg = t.stock('cfg') || {};
  verifier('l’absence est enregistrée', 1, (cfg.absences || []).length);
  verifier('avec sa note', 'pluie toute la journée', cfg.absences[0].note);
  const casse = t.$('[data-jour="' + cible + '"]');
  verifierVrai('la case est grisée', /st-absent/.test(casse.className));
  verifier('et porte une seule bande', 1, casse.querySelectorAll('.bande').length);

  /* On peut revenir dessus. */
  t.clic('[data-jour="' + cible + '"]'); await t.pause(450);
  verifierVrai('la fiche dit pourquoi', /pluie toute la journée/.test(t.texte('#modale')));
  t.clic('#fj-libre'); await t.pause(500);
  verifier('le jour est rendu au planning', 0,
    ((t.stock('cfg') || {}).absences || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : un jour passé d’avant la mise à jour se règle à la main', async () => {
  /* Tranché le 04/11 : les jours passés avant la 4.92 restent tels quels —
     pâles, sans relance, sans journée d'office. Il les règle à la main :
     déplacer (« prévu jeudi mais chantier fait mercredi »), retirer, saisir. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8 },
    chantiers: [{ id: 'c1', nom: 'Dégagement Martin', statut: 'accepte', aDevis: true,
      maj: Date.now(), lignes: [], temps: [],
      jours: [{ d: JCAL(-4), p: 1 }, { d: JCAL(-3), p: 1 }, { d: JCAL(0), p: 1 }, { d: JCAL(3), p: 1 }] }]
  }));
  await t.pause(300);
  const C0 = t.w.BCC;
  const cles = () => (((t.stock('chantiers') || [])[0] || {}).jours || []).map(j => C0.jourCle(j.d));
  verifierVrai('la date de la mise à jour est posée à la première ouverture',
    Math.abs((t.stock('cfg') || {}).officeDepuis - Date.now()) < 60000);
  await cliquerJour(t, JCAL(-4));
  verifierVrai('sa fiche le dit : il ne compte pas', /ne compte pas/.test(t.texte('#modale .fj-etat')));
  verifierVrai('on peut y saisir sa journée', t.$('#fj-travaille') && /Saisir ma journée/.test(t.texte('#fj-travaille')));
  t.clic('#fj-deplacer'); await t.pause(400);
  t.choisir('#dj-date', jourISO(JCAL(-5))); await t.pause(150);
  t.clic('#dj-ok'); await t.pause(600);
  verifierVrai('le jour d’origine est libéré', cles().indexOf(C0.jourCle(JCAL(-4))) < 0);
  verifierVrai('et le vrai jour est posé', cles().indexOf(C0.jourCle(JCAL(-5))) >= 0);
  verifier('rien n’a été perdu', 4, cles().length);
  await cliquerJour(t, JCAL(-3));
  t.clic('[data-fjretirer="c1"]'); await t.pause(500);
  verifierVrai('un autre se retire', cles().indexOf(C0.jourCle(JCAL(-3))) < 0 && cles().length === 3);
  verifier('aucun n’est devenu une journée', 0, (t.stock('journees') || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : plus de validation d’un geste, la journée se saisit (lot r1)', async () => {
  /* « C'était comme prévu », « Toutes comme prévu » et « J'y ai travaillé,
     mais autrement » sont partis (retrait accepté le 03/11) : un jour posé et
     confirmé compte d'office le lendemain, et « Saisir ma journée » ouvre Ma
     journée, le chantier posé déjà choisi (P4). */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [{ id: 'c1', nom: 'Dégagement Martin', statut: 'accepte', aDevis: true,
      maj: Date.now(), foret: 'Forêt de la Côte', commune: 'Clairbois', temps: [],
      jours: [{ d: JCAL(0), p: 1 }],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }] }]
  }));
  await t.pause(300);
  t.clic('[data-jour="' + t.w.BCC.minuit(Date.now()) + '"]'); await t.pause(450);
  verifierVrai('la fiche dit ce qui est posé', /8 h prévues|1 j prévues/.test(t.texte('#modale')));
  verifier('plus de geste « comme prévu »', [null, null, null], [t.$('#fj-prevu'), t.$('#fj-tout'), t.$('#fj-autrement')]);
  verifier('le bouton dit « Saisir ma journée »', 'Saisir ma journée', t.texte('#fj-travaille'));
  t.clic('#fj-travaille'); await t.pause(500);
  verifier('il ouvre Ma journée, datée de ce jour', jourISO(Date.now()), t.$('#mj-date') && t.$('#mj-date').value);
  verifier('le chantier posé déjà choisi', 'c1', t.$('#mj-ch') && t.$('#mj-ch').value);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : ce qui est déjà noté ne se valide plus d’un geste', async () => {
  /* Le geste d'un doigt ne vaut que pour une journée dont rien n'est écrit.
     Le cas qui compte est celui du jour à moitié noté : sept heures sur un
     chantier, un second posé sans temps. Ajouter d'un doigt les quatre
     heures du second gonflerait la journée à onze sans rien dire — c'est
     « Ma journée » qui tranche, pas un bouton.

     Attention : deux gardes se couvrent ici. Un jour dont TOUT est noté sort
     déjà par « rien en attente » ; seul ce jour-là éprouve « rien n'est
     encore noté ». */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [
      { id: 'c1', nom: 'Vaux', statut: 'accepte', aDevis: true, maj: Date.now(),
        temps: [], jours: [{ d: JCAL(0), p: 0.5 }], lignes: [] },
      { id: 'c2', nom: 'Les Combes', statut: 'accepte', aDevis: true, maj: Date.now(),
        temps: [], jours: [{ d: JCAL(0), p: 0.5 }], lignes: [] }
    ],
    journees: [{ id: 'j1', date: JCAL(0), chantier: 'c1', personnes: 1, nonProd: 7, postes: [] }]
  }));
  await t.pause(300);
  t.clic('[data-jour="' + t.w.BCC.minuit(Date.now()) + '"]'); await t.pause(450);
  const dit = t.texte('#modale');
  verifierVrai('la journée notée est là', /Ce que vous y avez fait/.test(dit));
  verifierVrai('et le chantier resté sans temps aussi',
    /sans temps noté/.test(dit) && /Les Combes/.test(dit));
  verifier('le geste n’est plus proposé', null, t.$('#fj-prevu'));
  verifierVrai('mais la journée se modifie', t.$('#fj-travaille'));
  verifier('et le bouton le dit', 'Modifier ma journée', t.$('#fj-travaille').textContent);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : « comme le… » reprend le contenu, jamais la date', async () => {
  /* « Quand je fais reprendre, ça me le remet sur le même jour. Depuis tout à
     l'heure je remets des jours sur le 4. » Le bouton passait la journée
     entière en modèle, sa date comprise : ouvrir le 8 dans le calendrier,
     reprendre, et la journée retombait le 4. Reprendre sert à ne pas retaper
     le chantier et les prestations, pas à revenir en arrière. */
  const JOUR = 86400000;
  const vieux = new Date(Date.now() - 4 * JOUR); vieux.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [{ id: 'c1', proprietaire: 'Martin', commune: 'Clairbois', statut: 'encours',
      aDevis: false, temps: [], jours: [], maj: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }],
    journees: [{ id: 'j1', date: vieux.getTime(), chantier: 'c1', lieu: 'Les Essarts',
      km: 42, personnes: 1, nonProd: 0,
      postes: [{ travaux: 'DEGAG', heures: 7, quantite: 1 }] }]
  }));
  await t.pause(300);

  /* On ouvre aujourd'hui, et on reprend la journée d'il y a quatre jours. */
  t.clic('[data-jour="' + t.w.BCC.minuit(Date.now()) + '"]'); await t.pause(450);
  t.clic('#fj-travaille'); await t.pause(500);
  const avant = t.$('#mj-date').value;
  verifier('la fiche s’ouvre sur le jour choisi', jourISO(Date.now()), avant);
  /* Le bouton ne dit plus « Reprendre le 4 », qui se lisait « aller au 4 ». */
  verifierVrai('le bouton parle du contenu', /^Comme le /.test(t.$('#mj-hier').textContent));

  t.clic('#mj-hier'); await t.pause(500);
  verifier('la date ne recule pas', avant, t.$('#mj-date').value);
  verifier('mais le chantier est repris', 'c1', t.$('#mj-ch').value);
  verifier('le lieu aussi', 'Les Essarts', t.$('#mj-lieu').value);
  verifier('et les kilomètres', '42', t.$('#mj-km').value);
  verifier('la prestation est reprise', 'DEGAG', t.$('#mj-postes [data-pstt="0"]').value);
  /* Les heures, non : c'est ce qu'on vient noter. */
  verifier('les heures restent à saisir', ['', ''], [t.$('#mj-total').value, t.$('#mj-prod').value]);

  t.saisir('#mj-total', '6');
  t.clic('#mj-ok'); await t.pause(700);
  const neuve = (t.stock('journees') || []).filter(x => x.id !== 'j1')[0];
  verifierVrai('une seconde journée est née', !!neuve);
  verifier('et elle tombe sur le jour choisi', t.w.BCC.jourCle(Date.now()),
    t.w.BCC.jourCle(neuve.date));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : un chantier posé ce jour-là reste sélectionnable', async () => {
  /* « Sur une journée déjà facturée, je ne peux plus la sélectionner : dans
     mes choix j'ai uniquement ce qui est ouvert. » La règle tient — un
     chantier facturé ne reçoit plus de journée — mais elle avait déjà son
     exception : celui qu'on est en train de corriger. Un chantier posé sur ce
     jour-là est le même cas, c'est le calendrier qui dit qu'il a lieu d'y
     être. */
  const JOUR = 86400000;
  const hier = new Date(Date.now() - JOUR); hier.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [
      { id: 'c1', proprietaire: 'Payé', commune: 'Clairbois', statut: 'paye', aDevis: false,
        temps: [], maj: Date.now(), numeroFacture: 'F-2025-0007',
        datePaiement: Date.now(), jours: [{ d: hier.getTime(), p: 1 }],
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] },
      /* Payé, mais rien de posé ce jour-là : il reste hors du sélecteur. */
      { id: 'c2', proprietaire: 'Ailleurs', commune: 'Valbrune', statut: 'paye', aDevis: false,
        temps: [], jours: [], maj: Date.now(), numeroFacture: 'F-2025-0008',
        datePaiement: Date.now(), lignes: [] }
    ]
  }));
  await t.pause(300);
  await cliquerJour(t, hier.getTime());
  /* Posé, passé, sans temps (d'avant la mise à jour) : on y saisit sa journée. */
  t.clic('#fj-travaille'); await t.pause(500);

  const choix = options(t, '#mj-ch').join(' · ');
  verifierVrai('le chantier posé ce jour-là est proposé', /Payé/.test(choix));
  verifierVrai('celui qui n’y est pas reste écarté', !/Ailleurs/.test(choix));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : les frais fixes se voient tomber sur leur jour', async () => {
  /* « Ce serait bien de pouvoir mettre dans le calendrier les frais fixes que
     j'ai, comme ça je vois quand ça arrive. » Une échéance n'est pas un
     statut de journée : un jour en porte exactement un. Elle se pose donc à
     côté, en repère, et se détaille dans la fiche du jour. */
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const jour = d.getDate();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    /* La charge est calée sur le quantième du jour, quel que soit ce jour :
       une garde écrite « si on est le 12 » ne mordrait qu'une fois par mois. */
    charges: [{ id: 'ch1', libelle: 'Assurance décennale', beneficiaire: 'Groupama',
      ttc: 420, periodicite: 'annuel', jour: jour, moisReference: d.getMonth(),
      debut: new Date(d.getFullYear() - 2, d.getMonth(), jour, 12).getTime(),
      categorie: 'ASSUR', taux: 0 }]
  }));
  await t.pause(350);

  const casse = t.$('[data-jour="' + t.w.BCC.minuit(d.getTime()) + '"]');
  const marque = casse.querySelector('.cal-prel');
  verifierVrai('la case porte le repère', !!marque);
  verifierVrai('qui nomme la charge et son montant',
    /Assurance décennale/.test(marque.getAttribute('title')) &&
    /420/.test(marque.getAttribute('title')));
  /* Le repère ne prend pas la place de la couleur du statut. */
  verifierVrai('et le statut du jour n’a pas bougé',
    /st-libre/.test(casse.className) && casse.querySelectorAll('.bande').length === 1);

  t.clic('[data-jour="' + t.w.BCC.minuit(d.getTime()) + '"]'); await t.pause(450);
  const dit = t.texte('#modale');
  verifierVrai('la fiche du jour le détaille', /Prélevé ce jour-là/.test(dit));
  verifierVrai('avec qui est payé', /Groupama/.test(dit));
  verifierVrai('et le montant', /420/.test(dit));
  /* Un jour qui porte un prélèvement n'est pas « rien de posé ni de noté ». */
  verifierVrai('il n’est plus dit vide', !/Rien de posé ni de noté/.test(dit));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : une charge arrêtée ne tombe plus sur le calendrier', async () => {
  /* echeances() borne déjà sur charge.debut et charge.fin : le calendrier ne
     doit pas contourner cette borne, sinon un contrat résilié continuerait de
     se prélever à l'écran. */
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    charges: [
      { id: 'ch1', libelle: 'Contrat résilié', ttc: 90, periodicite: 'mensuel',
        jour: d.getDate(), moisReference: 0, arretee: true,
        debut: new Date(d.getFullYear() - 2, 0, 1, 12).getTime(), categorie: 'ABO' },
      { id: 'ch2', libelle: 'Pas encore souscrit', ttc: 60, periodicite: 'mensuel',
        jour: d.getDate(), moisReference: 0, categorie: 'ABO',
        debut: new Date(d.getFullYear() + 2, 0, 1, 12).getTime() }
    ]
  }));
  await t.pause(350);
  const casse = t.$('[data-jour="' + t.w.BCC.minuit(d.getTime()) + '"]');
  verifier('aucun repère sur la case', null, casse.querySelector('.cal-prel'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Rendements : ce qu’il a compté se lit à côté de ce qui a été mesuré', async () => {
  /* « J'ai compté qu'à peu près, dans ce contexte-là, je mettais une tige à
     élaguer toutes les dix minutes. Ça me l'enregistre et je le retiens. Ça
     permettra d'avoir les deux côte à côte. »

     Les deux chiffres ne disent pas la même chose : le mesuré vient des
     journées saisies et paie les aléas — la route, le matériel, la pluie ;
     le compté vient de la montre. L'écart est l'information. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'rendements', cfg: { heuresJour: 8 },
    chantiers: [{ id: 'c1', proprietaire: 'Martin', commune: 'Clairbois', statut: 'paye',
      aDevis: false, maj: Date.now(), jours: [],
      /* 240 tiges en 8 jours-homme : 30 tiges par jour mesurées. */
      lignes: [{ travail: 'ELAG', unite: 'unite', quantite: 240, prix: 4, nature: 'prestation' }],
      temps: [{ date: Date.now(), duree: 64, unite: 'h', personnes: 1, activite: 'ELAG' }] }]
  }));
  await t.pause(300);
  verifierVrai('le mesuré est là', /30 u\/j/.test(t.texte('#rend-corps')));
  verifierVrai('rien de compté encore', !/comptés/.test(t.texte('#rend-corps')));

  t.clic('[data-rdetail="ELAG"]'); await t.pause(400);
  verifierVrai('le détail réclame une cadence',
    /Rien de compté pour cette prestation/.test(t.texte('#modale')));
  t.clic('#cd-plus'); await t.pause(400);

  /* Une tige toutes les dix minutes, sur huit heures : 48 tiges par jour. */
  t.saisir('#cd-val', '10'); await t.pause(200);
  verifierVrai('la conversion s’écrit sous le champ',
    /soit 48 u par journée de 8 h/.test(t.$('#cd-conv').textContent));
  t.choisir('#cd-ch', 'c1');
  t.saisir('#cd-note', 'ronce épaisse');
  t.clic('#cd-ok'); await t.pause(600);

  const cds = (t.stock('cfg') || {}).cadences || [];
  verifier('la cadence est rangée dans la configuration', 1, cds.length);
  /* On garde ce qu'il a tapé, pas la conversion : « dix minutes » est ce
     qu'il retrouvera, pas « 48 tiges/j ». */
  verifier('avec sa valeur telle qu’il l’a dite', 10, cds[0].valeur);
  verifier('et son sens', 'minutes', cds[0].sens);
  verifier('et le chantier où il l’a constatée', 'c1', cds[0].chantier);

  const dit = t.texte('#rend-corps');
  verifierVrai('le compté se lit à côté du mesuré', /48 u\/j comptés/.test(dit));
  /* 30 mesuré contre 48 compté : 38 % plus lent sur le terrain. */
  verifierVrai('et l’écart est dit en clair', /38 % plus lent sur le terrain/.test(dit));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Rendements : une cadence se dit dans les deux sens, et se retire', async () => {
  /* « Une tige toutes les dix minutes » se chronomètre ; « huit cents plants
     par jour » se constate le soir. Convertir de tête serait exactement le
     calcul qu'on lui épargne. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'rendements', cfg: { heuresJour: 8 } }));
  const C0 = t.w.BCC;
  verifier('minutes par unité', 48, C0.cadenceParJour({ valeur: 10, sens: 'minutes' }, { heuresJour: 8 }));
  verifier('unités par jour', 800, C0.cadenceParJour({ valeur: 800, sens: 'parjour' }, { heuresJour: 8 }));
  /* Le réglage des heures par jour compte : sept heures ne font pas huit. */
  verifier('la journée de sept heures donne moins', 42,
    C0.cadenceParJour({ valeur: 10, sens: 'minutes' }, { heuresJour: 7 }));
  verifier('un nombre absent ne vaut rien', 0, C0.cadenceParJour({ valeur: '', sens: 'minutes' }, {}));

  /* Une prestation jamais facturée mais chronométrée mérite sa ligne : c'est
     là que le compté est tout ce qu'on a. */
  const t2 = await ouvrir(Object.assign({}, VIDE, {
    module: 'rendements', cfg: { heuresJour: 8,
      cadences: [{ id: 'k1', travail: 'ELAG', unite: 'u', valeur: 12, sens: 'minutes',
      chantier: '' }] }
  }));
  await t2.pause(300);
  const dit = t2.texte('#rend-corps');
  verifierVrai('la prestation apparaît quand même', /Élagage/i.test(dit));
  verifierVrai('avec le compté seul', /40 u\/j comptés/.test(dit));
  verifierVrai('et l’écran dit qu’il n’y a rien de mesuré', /Rien de mesuré encore/.test(dit));

  t2.clic('[data-rdetail="ELAG"]'); await t2.pause(400);
  verifierVrai('le détail la liste', /12 min par u/.test(t2.texte('#modale')));
  verifierVrai('et dit qu’aucun chantier ne la porte', /sans chantier/.test(t2.texte('#modale')));
  t2.clic('[data-cdsup="k1"]'); await t2.pause(600);
  verifier('elle se retire', 0, ((t2.stock('cfg') || {}).cadences || []).length);
  verifierVrai('et la ligne disparaît avec elle', !/comptés/.test(t2.texte('#rend-corps')));
  verifier('aucune erreur', [], t.erreurs.concat(t2.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Carnet : « en retard » ne se dit plus d’un chantier, seulement d’une facture', async () => {
  /* Le mot l'a trompé deux fois. enRetard() ne parle d'aucune échéance
     manquée : il dit que toutes les journées posées sont derrière et que le
     chantier n'est pas soldé. Un vrai retard existe pourtant — celui d'une
     facture dont l'échéance est dépassée — et lui garde son mot. */
  const JOUR = 86400000;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      /* Journées toutes passées, chantier jamais terminé. */
      { id: 'c1', proprietaire: 'Jourspasses', statut: 'encours', aDevis: false,
        temps: [], maj: Date.now(), jours: [{ d: Date.now() - 20 * JOUR, p: 1 }],
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] },
      /* Facture dont l'échéance est dépassée : celle-là est bien en retard. */
      { id: 'c2', proprietaire: 'Impaye', statut: 'facture', aDevis: false, temps: [], jours: [],
        maj: Date.now(), numeroFacture: 'F-2026-0003',
        dateFacture: Date.now() - 90 * JOUR, echeancePaiement: Date.now() - 30 * JOUR,
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 900, nature: 'prestation' }] }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(350);
  const z = t.texte('#liste-chantiers');
  /* Lot r1b : le chantier aux jours tous passés reste dans En travaux, sans
     relance ; l'alerte « retard » est partie. */
  verifierVrai('le chantier aux jours passés est en travaux, sans relance',
    !!t.$('[data-groupe="travaux"] [data-chouvrir="c1"]') && !/Dernière journée posée/.test(z));
  verifierVrai('et plus « en retard »', !/en retard/.test(z));
  const al = t.w.BCC.alertes(t.stock('chantiers'), null, Date.now());
  verifier('plus d’alerte « retard »', [], al.filter(a => a.type === 'retard'));
  verifierVrai('et jamais une date impossible', !al.some(a => /Invalid/.test(a.texte)));

  /* Le retard de paiement, lui, en est un : le mot reste. */
  const imp = al.filter(a => a.type === 'impaye')[0];
  verifierVrai('l’impayé est bien relevé', !!imp);
  verifierVrai('avec son échéance dépassée', /échéance dépassée/.test(imp.texte));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carnet : la ligne porte le hors taxes, le TTC et la TVA', async () => {
  /* « Tu mets le montant hors taxes. Est-ce que tu pourrais mettre le taux de
     TVA, la TVA, le montant TTC, sur le côté droit ? Comme ça ça permet de
     voir un global très rapidement. » Les deux montants en gros, la TVA en
     dessous : c'est lui qui a tranché lequel domine.

     Le taux réduit demande un SIREN : sans lui tout est à 20 % et la question
     des taux mêlés ne se pose jamais. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'c1', proprietaire: 'Simple', statut: 'encours', aDevis: false, siren: false,
        temps: [], jours: [], maj: Date.now() - 1000,
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] },
      /* Deux taux sur le même chantier : le répulsif n'ouvre pas droit au taux
         réduit là où le dégagement y a droit. */
      { id: 'c2', proprietaire: 'Melange', statut: 'encours', aDevis: false, siren: true,
        temps: [], jours: [], maj: Date.now(),
        lignes: [
          { travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 1000, nature: 'prestation' },
          { travail: 'F_REPULSIF', unite: 'unite', quantite: 100, prix: 1, nature: 'vente' }
        ] }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(350);
  const tout = t.texte('#liste-chantiers');
  verifierVrai('les deux chantiers sont là', /Simple/.test(tout) && /Melange/.test(tout));

  /* La ligne V2 (validée) garde le hors taxes ; le TTC et la TVA taux par
     taux sont dans la fiche, étape Devis (lot b2). */
  verifierVrai('le hors taxes reste là', /1 000 €/.test(t.texte('[data-chouvrir="c1"] .aj-droite')));
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const d1 = t.texte('#f-etapes [data-etape="1"]');
  verifierVrai('le TTC est calculé', /Total TTC ?1 200 €/.test(d1));
  verifierVrai('le taux et la TVA sont dits', /TVA 20 %/.test(d1) && /200 €/.test(d1));
  await parBarre(t, 'chantiers');
  t.clic('[data-chouvrir="c2"]'); await t.pause(400);
  /* Taux mêlés : chacun sa ligne, aucun taux inventé. */
  const d2 = t.texte('#f-etapes [data-etape="1"]');
  verifierVrai('les taux mêlés se disent chacun', /TVA 20 %/.test(d2) && /TVA 10 %/.test(d2));

  /* Le carnet et la fiche passent par le même calcul : deux copies d'un calcul
     de TVA finissent toujours par diverger, et c'est la TVA. */
  const C0 = t.w.BCC;
  const c2 = (t.stock('chantiers') || []).filter(x => x.id === 'c2')[0];
  verifier('pas de taux unique quand ils sont deux', null, C0.tauxChantier(c2));
  verifier('un taux unique se rend quand il l’est', 20,
    C0.tauxChantier((t.stock('chantiers') || []).filter(x => x.id === 'c1')[0]));
  verifierVrai('la TVA mêlée est celle des lignes, pas d’un taux moyen',
    C0.tvaChantier(c2) === C0.arr(1000 * C0.tauxLigne(c2.lignes[0], c2) / 100 +
      100 * C0.tauxLigne(c2.lignes[1], c2) / 100, 2));
  verifier('et le TTC vaut le HT plus la TVA',
    C0.arr(C0.montant(c2) + C0.tvaChantier(c2), 2), C0.ttcChantier(c2));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Chantier : un chantier pas fini d’être planifié n’est pas en retard', async () => {
  /* « Je ne vais pas prévoir tout le chantier d'un coup : je pose un ou deux
     jours, j'ai une vision à la semaine ou deux. »

     enRetard() disait seulement « toutes les journées posées sont derrière ».
     Sur sa façon de travailler c'est vrai dès le premier jour fait : il pose
     un jour sur trois, il le fait, et le lendemain le chantier s'annonce en
     retard. Il reste pourtant deux journées à poser. */
  const JOUR = 86400000;
  const C0 = (await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }))).w.BCC;
  const hier = Date.now() - JOUR;
  /* Trois journées au devis, une seule posée, et elle est passée. */
  const enCours = { statut: 'encours', jours: [{ d: hier, p: 1 }], temps: [],
    lignes: [{ travail: 'DEGAG', unite: 'jour', quantite: 3, prix: 350, nature: 'prestation' }] };
  verifierVrai('il reste deux journées à poser', C0.resteAPlacer(enCours) === 2);
  verifierVrai('donc rien à signaler', !C0.enRetard(enCours, Date.now()));

  /* Les trois posées, toutes passées, et le chantier jamais soldé : là, oui. */
  const tout = { statut: 'encours', temps: [],
    jours: [{ d: hier - 2 * JOUR, p: 1 }, { d: hier - JOUR, p: 1 }, { d: hier, p: 1 }],
    lignes: [{ travail: 'DEGAG', unite: 'jour', quantite: 3, prix: 350, nature: 'prestation' }] };
  verifierVrai('plus rien à poser', C0.resteAPlacer(tout) === 0);
  verifierVrai('et le chantier traîne', C0.enRetard(tout, Date.now()));

  /* Un jour encore à venir : on n'a rien à dire non plus. */
  const avenir = { statut: 'encours', temps: [],
    jours: [{ d: hier, p: 1 }, { d: Date.now() + JOUR, p: 1 }, { d: Date.now() + 2 * JOUR, p: 1 }],
    lignes: [{ travail: 'DEGAG', unite: 'jour', quantite: 3, prix: 350, nature: 'prestation' }] };
  verifierVrai('un jour à venir suffit à se taire', !C0.enRetard(avenir, Date.now()));

  /* Sans estimation d'aucune sorte, on ne sait pas ce qui reste : on retombe
     sur la règle d'avant, sinon un chantier oublié ne se signalerait jamais. */
  const sansVise = { statut: 'encours', temps: [], lignes: [],
    jours: [{ d: hier, p: 1 }] };
  verifier('rien ne dit ce qui reste', null, C0.resteAPlacer(sansVise));
  verifierVrai('et le chantier se signale quand même', C0.enRetard(sansVise, Date.now()));
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : le prélèvement lit les champs que le formulaire écrit', async () => {
  /* « Là j'ai un signe €, mais pourtant il met zéro. Charge fixe tous les
     mois, zéro. » Le repère lisait `nom` et `montant` ; le formulaire écrit
     `libelle` et `ttc`. Le premier scénario ne l'a pas vu parce qu'il semait
     les mêmes champs faux que le code lisait — deux erreurs qui se confirment
     l'une l'autre.

     La charge est donc semée telle que le formulaire l'enregistre. */
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    charges: [{ id: 'ch1', libelle: 'Assurance décennale', beneficiaire: 'Groupama',
      ttc: 420, periodicite: 'annuel', jour: d.getDate(), moisReference: d.getMonth(),
      debut: new Date(d.getFullYear() - 2, d.getMonth(), d.getDate(), 12).getTime(),
      categorie: 'ASSUR', taux: 0 }]
  }));
  await t.pause(350);
  const marque = t.$('[data-jour="' + t.w.BCC.minuit(d.getTime()) + '"] .cal-prel');
  verifierVrai('la case porte le repère', !!marque);
  const titre = marque.getAttribute('title');
  verifierVrai('il nomme la charge', /Assurance décennale/.test(titre));
  verifierVrai('et jamais « charge » tout court', !/^charge —/.test(titre));
  verifierVrai('il annonce le montant, pas zéro', /420/.test(titre) && !/— 0 €/.test(titre));

  t.clic('[data-jour="' + t.w.BCC.minuit(d.getTime()) + '"]'); await t.pause(450);
  const dit = t.texte('#modale');
  verifierVrai('la fiche du jour la nomme', /Assurance décennale/.test(dit));
  verifierVrai('avec son montant', /420 €/.test(dit));
  verifierVrai('et jamais 0 €', !/Groupama · annuel0 €/.test(dit));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Clients : un nom nouveau se range par type, et le SIREN suit', async () => {
  /* « C'est tous des clients. Des fois c'est des propriétaires forestiers,
     des fois des gestionnaires, ça peut être une entreprise de travaux. Il
     faudrait que je puisse choisir quel type c'est, et si c'est un
     propriétaire, me demander s'il a un numéro de SIREN. »

     Et le défaut qu'il décrivait : « quand je crée un nouveau propriétaire,
     il ne me demande pas s'il a un SIREN ». La case existait, plus bas dans
     le formulaire — mais rien ne la reliait au nom qu'il venait de créer. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  await plusChantier(t);

  /* Le mot a changé : un client, pas forcément un propriétaire ; puis
     « Facturé à » (tranché le 01/11). */
  verifierVrai('le champ s’appelle « Facturé à »',
    /Facturé à/.test(t.$('[for="ce-proprio"]').textContent));

  t.saisir('#ce-proprio', 'Groupement de Vaux');
  t.$('#ce-proprio').dispatchEvent(new t.w.Event('blur'));
  await t.pause(200);
  t.clic('#ce-proprio-offre [data-offre]'); await t.pause(400);

  /* C'est là que la question se pose, sur le nom qui vient de naître. */
  verifierVrai('le type est demandé', /c’est qui/.test(t.$('#ce-proprio-offre').textContent));
  verifierVrai('avec les quatre types',
    options(t, '#tc-type').join(' · ') === 'Propriétaire forestier · Gestionnaire · ' +
      'Entreprise de travaux · Autre');
  /* Le premier type est propriétaire : le SIREN s'ouvre d'emblée. */
  verifierVrai('le SIREN est proposé', !t.$('#tc-siren-l').hidden);

  /* Un gestionnaire refacture : la question n'a pas de sens pour lui. */
  t.choisir('#tc-type', 'gestion'); await t.pause(200);
  verifierVrai('elle disparaît sur un gestionnaire', t.$('#tc-siren-l').hidden);

  t.choisir('#tc-type', 'proprio'); await t.pause(200);
  cocher(t, '#tc-siren', true);
  t.clic('#tc-ok'); await t.pause(600);

  const cfg = t.stock('cfg') || {};
  verifier('le type est rangé sous le nom', 'proprio',
    ((cfg.contacts || {})['Groupement de Vaux'] || {}).type);
  verifier('et le SIREN avec', true,
    ((cfg.contacts || {})['Groupement de Vaux'] || {}).siren);
  /* La liste ne change pas de forme : ce sont toujours des noms. */
  verifier('la liste reste une liste de noms', ['Groupement de Vaux'], t.stock('proprios'));
  verifierVrai('et le nom est bien ajouté', /ajouté à votre liste « Facturé à »/.test(
    t.$('#ce-proprio-offre').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Clients : un client connu dont on ignore la réponse se la voit demander sous le champ', async () => {
  /* Les chantiers déjà saisis n'ont aucun type. La case du bas qui posait la
     question pour eux a disparu en 4.84 : elle redisait celle du champ, et
     l'écrasait. C'est donc sous le champ qu'elle se pose — une fois par nom. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    proprios: ['Ancien sans type', 'Cabinet gestionnaire', 'Déjà répondu'],
    cfg: { contacts: { 'Cabinet gestionnaire': { type: 'gestion' }, 'Déjà répondu': { siren: false } } }
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  await plusChantier(t);
  verifier('la case du bas a disparu', null, t.$('#ce-siren'));

  const quitter = async (nom) => {
    t.saisir('#ce-proprio', nom);
    t.$('#ce-proprio').dispatchEvent(new t.w.Event('blur'));
    await t.pause(250);
    return t.$('#ce-proprio-offre').textContent.trim();
  };
  verifierVrai('un nom connu sans réponse se voit poser la question',
    /c’est qui/.test(await quitter('Ancien sans type')));
  t.choisir('#tc-type', 'proprio'); await t.pause(150);
  cocher(t, '#tc-siren', true);
  t.clic('#tc-ok'); await t.pause(400);
  const ct = ((t.stock('cfg') || {}).contacts || {})['Ancien sans type'] || {};
  verifier('sa réponse est rangée sous son nom', true, ct.siren);
  verifierVrai('et le champ le confirme', /noté/.test(t.$('#ce-proprio-offre').textContent));

  verifier('un gestionnaire n’a pas de question', '', await quitter('Cabinet gestionnaire'));
  verifier('ni un client qui a déjà répondu', '', await quitter('Déjà répondu'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Rendements : les lignes s’alignent, et se trient comme il veut', async () => {
  /* « Il y en a qui sont calés à gauche, d'autres un peu plus décalées. Et
     ces pastilles, elles servent à quoi ? Elles ont la même couleur. »

     Elles ne distinguaient rien : chaque ligne est déjà une prestation
     différente. Et deux formes de ligne — l'une à deux boutons, l'autre à un
     seul — faisaient danser les titres. Une seule forme, sans pastille. */
  const J = (m, j) => new Date(2026, m, j, 12).getTime();
  const ligne = (id, trav, prop, q, jour) => ({ id, proprietaire: prop, statut: 'paye',
    aDevis: false, maj: J(0, 1), jours: [], temps: [{ date: jour, duree: 8, unite: 'h',
      personnes: 1, activite: trav }],
    lignes: [{ travail: trav, unite: 'unite', quantite: q, prix: 4, nature: 'prestation' }] });
  const t = await ouvrir(Object.assign({}, VIDE, {
    /* Pas de « journeesMigrees » : le temps semé doit devenir des journées,
       sinon l'indexation vide c.temps et plus rien ne se calcule. */
    module: 'rendements', cfg: { heuresJour: 8,
      /* Une prestation chronométrée mais jamais facturée : elle a sa ligne. */
      cadences: [{ id: 'k1', travail: 'BROY', unite: 'ha', valeur: 2, sens: 'parjour',
        chantier: '' }] },
    chantiers: [
      ligne('c1', 'ELAG', 'Ancien', 40, J(1, 10)),
      ligne('c2', 'DEGAG', 'Recent', 30, J(6, 10)),
      ligne('c3', 'DEGAG', 'Autre', 20, J(5, 10))
    ]
  }));
  await t.pause(350);

  /* Plus aucune pastille : elles ne portaient aucune information. */
  verifier('plus de pastille décorative', 0, t.$$('#rend-corps .pastille').length);
  /* Et toutes les lignes ont la même forme : deux boutons, alignés. */
  const items = t.$$('#rend-corps .liste-item');
  verifierVrai('au moins trois prestations', items.length >= 3);
  verifierVrai('chacune porte deux boutons',
    items.every(i => i.querySelectorAll('.li-actions button').length === 2));
  /* Celle qui n'a aucun chantier ne s'estime pas, mais garde sa place. */
  const sansMesure = items.filter(i => /comptés/.test(i.textContent))[0];
  verifierVrai('la prestation seulement comptée est là', !!sansMesure);
  verifierVrai('son bouton « Estimer » est fermé',
    sansMesure.querySelector('[data-restim]') === null &&
    sansMesure.querySelectorAll('.li-actions button')[1].disabled);

  const noms = () => t.$$('#rend-corps .li-c b').map(b => b.textContent.split(' —')[0]);
  verifier('par défaut, l’ordre alphabétique',
    noms().slice().sort((a, b) => a.localeCompare(b, 'fr')), noms());

  /* Du plus récent : le dégagement de juillet passe devant l'élagage de
     février, et la prestation sans chantier ferme la marche. */
  t.choisir('#rend-tri', 'recent'); await t.pause(300);
  const r = noms();
  verifierVrai('le plus récemment travaillé en tête', /Dégagement/.test(r[0]));
  verifierVrai('et celui sans chantier à la fin', /Broyage/i.test(r[r.length - 1]));

  t.choisir('#rend-tri', 'chantiers'); await t.pause(300);
  verifierVrai('par nombre de chantiers, le dégagement d’abord',
    /Dégagement/.test(noms()[0]));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Chantier : le prix de journée attend que le chantier soit fini', async () => {
  /* « Ce n'est pas un chiffre utile en cours de chantier. Il sert plutôt à la
     fin : tu as fait tant de journées, tu as facturé tant, donc ta journée
     vaut tant. »

     Trois journées facturées 1 050 €, une seule faite : la division annonçait
     1 050 € par jour. Le chiffre n'était pas faux, il était prématuré — et il
     remontait tel quel dans la moyenne des rendements. */
  const C0 = (await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }))).w.BCC;
  const enCours = { statut: 'encours',
    temps: [{ date: Date.now(), duree: 8, unite: 'h', personnes: 1, activite: 'DEGAG' }],
    lignes: [{ travail: 'DEGAG', unite: 'jour', quantite: 3, prix: 350, nature: 'prestation' }] };
  verifier('rien tant que le chantier tourne', null, C0.prixJour(enCours, { heuresJour: 8 }));

  /* Terminé, la facture est ce qu'elle sera : le chiffre a un sens. */
  const fini = Object.assign({}, enCours, { statut: 'facture' });
  verifier('le chantier soldé le rend', 1050, C0.prixJour(fini, { heuresJour: 8 }));
  verifierVrai('« soldé » couvre terminé, facturé et payé',
    ['termine', 'facture', 'paye'].every(st => C0.chantierSolde({ statut: st })) &&
    !C0.chantierSolde({ statut: 'encours' }) && !C0.chantierSolde({ statut: 'accepte' }));

  /* Et la fiche dit pourquoi le chiffre n'est pas là, plutôt que de le taire. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [{ id: 'c1', proprietaire: 'Martin', statut: 'encours', aDevis: false,
      maj: Date.now(), jours: [], temps: [],
      lignes: [{ travail: 'DEGAG', unite: 'jour', quantite: 3, prix: 350, nature: 'prestation' }] }],
    journees: [{ id: 'j1', date: Date.now(), chantier: 'c1', personnes: 1, nonProd: 0,
      postes: [{ travaux: 'DEGAG', heures: 8, quantite: 0 }] }]
  }));
  await t.pause(350);
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const f = t.texte('#vue-chantier');
  verifierVrai('la fiche dit pourquoi il manque',
    /se lira quand le chantier sera terminé/.test(f));
  verifierVrai('et n’annonce pas 1 050 € par jour-homme',
    !/1 050 €par jour-homme/.test(f));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : garder l’écran allumé, et dire ce que le téléphone répond', async () => {
  /* « Est-ce que tu penses qu'il y aurait moyen que ça ne mette pas le mode
     veille du téléphone ? Sauf que moi j'ai un mode Stamina qui économise la
     batterie. »

     wakeLock est une demande, pas un ordre : un mode d'économie peut refuser,
     et le système la relâche de lui-même dès que la page passe derrière.
     D'où un réglage, jamais un comportement imposé — et un message qui dit
     ce que le téléphone a répondu, sinon on ne saurait jamais dans quel cas
     on se trouve. */
  /* JSDOM n'a pas d'écran : on pose le nôtre, qui accepte, et AVANT le
     démarrage — l'application ne branche que ce qu'elle trouve alors. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }), {
    avant: w => {
      w.__veille = { demandes: 0, relachees: 0, ecouteur: null };
      w.navigator.wakeLock = {
        request: () => {
          w.__veille.demandes++;
          return Promise.resolve({
            release: () => {
              w.__veille.relachees++;
              if (w.__veille.ecouteur) w.__veille.ecouteur();
            },
            addEventListener: (n, f) => { if (n === 'release') w.__veille.ecouteur = f; }
          });
        }
      };
    }
  });
  const veille = t.w.__veille;

  const c = t.$('#r-veille');
  verifierVrai('le réglage existe', !!c);
  verifierVrai('décoché par défaut', !c.checked);
  verifierVrai('et l’écran s’éteint comme d’habitude',
    /s’éteint comme d’habitude/.test(t.$('#r-veille-aide').textContent));

  cocher(t, '#r-veille', true); await t.pause(400);
  verifier('le réglage est enregistré', true, (t.stock('cfg') || {}).ecranAllume);
  verifier('le téléphone a été sollicité une fois', 1, veille.demandes);
  verifierVrai('et l’écran dit qu’il a accepté',
    /a accepté/.test(t.$('#r-veille-aide').textContent));

  /* Passer en arrière-plan relâche : sinon n'importe quel site viderait la
     batterie. Revenir redemande. */
  Object.defineProperty(t.d, 'hidden', { value: true, configurable: true });
  t.d.dispatchEvent(new t.w.Event('visibilitychange')); await t.pause(250);
  verifier('elle est relâchée en arrière-plan', 1, veille.relachees);
  Object.defineProperty(t.d, 'hidden', { value: false, configurable: true });
  t.d.dispatchEvent(new t.w.Event('visibilitychange')); await t.pause(250);
  verifier('et redemandée au retour', 2, veille.demandes);

  cocher(t, '#r-veille', false); await t.pause(400);
  verifier('décocher l’enregistre aussi', false, (t.stock('cfg') || {}).ecranAllume);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : un téléphone qui refuse la veille le dit', async () => {
  /* Le mode Stamina et ses cousins peuvent refuser. Le taire laisserait
     croire que le réglage marche, et il chercherait ailleurs. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise', cfg: { ecranAllume: true }
  }), {
    avant: w => {
      w.navigator.wakeLock = { request: () => Promise.reject(new Error('refusé')) };
    }
  });
  cocher(t, '#r-veille', true); await t.pause(400);
  verifierVrai('l’écran dit que le téléphone n’a pas suivi',
    /n’a pas suivi/.test(t.$('#r-veille-aide').textContent));
  verifierVrai('et nomme la cause probable',
    /économie de batterie/.test(t.$('#r-veille-aide').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : un navigateur sans veille ferme le réglage', async () => {
  /* Une case qu'on peut cocher sans effet est pire que pas de case. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  /* JSDOM n'a pas wakeLock : c'est exactement le cas à éprouver. */
  verifierVrai('le navigateur simulé n’en a pas', !t.w.navigator.wakeLock);
  verifierVrai('la case est fermée', t.$('#r-veille').disabled);
  verifierVrai('et l’écran le dit',
    /ne sait pas garder l’écran allumé/.test(t.$('#r-veille-aide').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : Web Mercator tombe juste', async () => {
  /* La carte est en Web Mercator : c'est la projection de toutes les tuiles
     du web, et deux projections différentes ne se superposent jamais.

     Ses propriétés sont exactes par définition, pas approchées — c'est ce
     qui permet de les éprouver sans tolérance molle. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'calendrier' }));
  const LB = t.w.BCUI._carte.LB;

  /* L'origine des longitudes et l'équateur tombent sur zéro. */
  const o = LB.vers(0, 0);
  verifierVrai('l’équateur est à zéro', Math.abs(o.x) < 0.001 && Math.abs(o.y) < 0.001);
  /* Un demi-tour de longitude vaut la moitié du tour de Mercator. */
  verifierVrai('180° font un demi-tour',
    Math.abs(LB.vers(0, 180).x - Math.PI * 6378137) < 0.5);

  /* Aller-retour : c'est ce qui garantit qu'un point posé se relit au même
     endroit. */
  const d = LB.vers(44.1167, 3.2833);
  const r = LB.depuis(d.x, d.y);
  verifierVrai('la latitude revient', Math.abs(r.lat - 44.1167) < 0.0000001);
  verifierVrai('la longitude revient', Math.abs(r.lon - 3.2833) < 0.0000001);

  /* La propriété qui DÉFINIT Mercator : l'échelle horizontale vaut 1/cos(φ).
     La longueur vraie d'un arc de parallèle sur la sphère est écrite ici, à
     part, pour que les deux sources restent indépendantes. Sans cette garde,
     une projection subtilement fausse passerait — c'est ce qui était arrivé
     au parallèle de référence de Lambert, faux de deux cents mètres et
     invisible pour toute vérification géographique large. */
  const arcSphere = (lat, dlon) =>
    6378137 * Math.cos(lat * Math.PI / 180) * (dlon * Math.PI / 180);
  const echelle = lat => {
    const g = LB.vers(lat, 5.9), dd = LB.vers(lat, 6.1);
    return (dd.x - g.x) / arcSphere(lat, 0.2);
  };
  verifierVrai('échelle 1 à l’équateur', Math.abs(echelle(0.0001) - 1) < 0.00001);
  verifierVrai('et 1/cos(φ) au milieu de la France',
    Math.abs(echelle(46.5) - 1 / Math.cos(46.5 * Math.PI / 180)) < 0.00001);

  /* facteurSol fait le chemin inverse : combien de mètres au sol vaut un
     mètre de Mercator. C'est lui qui rend l'échelle de la carte honnête. */
  const y = LB.vers(46.5, 6).y;
  verifierVrai('un mètre de Mercator vaut 0,69 m au sol au milieu de la France',
    Math.abs(LB.facteurSol(y) - Math.cos(46.5 * Math.PI / 180)) < 0.00001);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : le chantier se place d’un doigt', async () => {
  /* « Est-ce qu'on ne pourrait pas juste avoir un fond de carte et pouvoir
     sélectionner des points, dire : ce chantier, c'était à tel endroit ? » */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', proprietaire: 'Martin', commune: 'Clairbois', statut: 'encours',
      aDevis: false, temps: [], jours: [], lignes: [], maj: Date.now() }]
  }));
  t.clic('[data-vue="carte"]'); await t.pause(500);

  const plan = t.$('#carte-plan');
  verifierVrai('la carte est dessinée', !!plan);
  verifierVrai('avec une échelle', /\d/.test(plan.querySelector('text').textContent));
  /* Sans chantier localisé, la liste le dit et propose le geste. */
  verifierVrai('la liste invite à placer', /Poser un chantier/.test(t.texte('#carte-liste')));

  /* JSDOM ne mesure rien : on donne au dessin sa taille réelle, sinon le
     doigt tombe dans le vide. */
  plan.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240 });

  t.clic('#carte-poser'); await t.pause(400);
  verifierVrai('le chantier est proposé', /Martin/.test(t.texte('#modale')));
  t.choisir('#pc-ch', 'c1');
  t.clic('#pc-ok'); await t.pause(400);
  verifierVrai('l’écran dit quoi faire',
    /Appuyez sur la carte/.test(t.$('#carte-aide').textContent));

  /* Un appui au centre du dessin : ce doit être le centre du cadrage. */
  const svg2 = t.$('#carte-plan');
  svg2.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240 });
  svg2.dispatchEvent(new t.w.MouseEvent('click',
    { bubbles: true, clientX: 160, clientY: 120 }));
  await t.pause(600);

  const c = (t.stock('chantiers') || [])[0];
  verifierVrai('le chantier porte une position', !!(c.gps && c.gps.lat != null));
  /* Le centre du cadrage par défaut, converti : on doit retomber dessus. */
  const LB = t.w.BCUI._carte.LB;
  const revenu = LB.vers(c.gps.lat, c.gps.lon);
  verifierVrai('et c’est bien le point visé',
    Math.abs(revenu.x - 267000) < 500 && Math.abs(revenu.y - 5877000) < 500);
  verifierVrai('le mode « poser » s’est refermé',
    !/Appuyez sur la carte/.test(t.$('#carte-aide').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : le zoom a des bornes des deux côtés', async () => {
  /* Sans bornes, deux absurdités : la France entière dans un timbre, ou plus
     fin que la photo aérienne n'a de détail. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', proprietaire: 'Martin', statut: 'encours', aDevis: false,
      temps: [], jours: [], lignes: [], maj: Date.now(),
      gps: { lat: 44.1167, lon: 3.2833 } }]
  }));
  t.clic('[data-vue="carte"]'); await t.pause(500);

  const echelle = () => t.w.BCUI._carte.cadre().m;
  const depart = echelle();
  verifierVrai('le cadrage s’ouvre sur le chantier', depart > 3 && depart < 4000);

  for (let i = 0; i < 40; i++) t.clic('#carte-plus');
  await t.pause(300);
  verifierVrai('on ne descend pas sous un mètre par pixel', echelle() >= 1);
  for (let i = 0; i < 80; i++) t.clic('#carte-moins');
  await t.pause(300);
  verifierVrai('et on ne monte pas au-dessus de quatre kilomètres', echelle() <= 4000);

  /* « Tout voir » revient au cadrage d'origine. */
  t.clic('#carte-tout'); await t.pause(300);
  verifier('« Tout voir » recadre comme au départ', depart, echelle());
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : photo aérienne ou carte IGN, et plus de contours', async () => {
  /* « Le fait qu'on puisse changer photo aérienne, carte IGN, c'est très
     bien. » Et les contours de communes : « on va les enlever, ça sert à
     rien ». */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', proprietaire: 'Martin', statut: 'encours', aDevis: false,
      temps: [], jours: [], lignes: [], maj: Date.now(),
      gps: { lat: 46.6012, lon: 2.4035 } }]
  }));
  t.clic('[data-vue="carte"]'); await t.pause(500);

  /* Deux fonds au choix, la photo aérienne par défaut. */
  const chips = t.$$('#carte-fonds .chip').map(b => b.textContent);
  verifier('deux fonds, « contours seuls » est parti', ['Photo aérienne', 'Carte IGN'], chips);
  verifierVrai('la photo est le fond de départ',
    t.$('[data-fondcarte="photo"]').classList.contains('actif'));

  const tuiles = () => t.$$('#carte-cadre img');
  verifierVrai('des tuiles sont demandées', tuiles().length > 0);
  const src = tuiles()[0].getAttribute('src');
  verifierVrai('à la Géoplateforme', /^https:\/\/data\.geopf\.fr\/wmts\?/.test(src));
  verifierVrai('en photo aérienne', /LAYER=ORTHOIMAGERY\.ORTHOPHOTOS/.test(src));
  /* En CORS : une réponse opaque pèserait des Mo dans le quota, et le service
     worker ne pourrait pas la garder pour hors réseau. */
  verifier('demandée en CORS, pour pouvoir la garder', 'anonymous',
    tuiles()[0].getAttribute('crossorigin'));
  verifierVrai('dans la grille des tuiles du web', /TILEMATRIXSET=PM/.test(src));
  /* Une tuile porte son niveau, sa ligne et sa colonne : sans les trois, elle
     ne désigne rien. */
  verifierVrai('avec niveau, ligne et colonne',
    /TILEMATRIX=\d+/.test(src) && /TILEROW=\d+/.test(src) && /TILECOL=\d+/.test(src));
  /* Et le niveau doit coller à l'échelle affichée : figé, il donnerait une
     photo floue ou dix fois trop détaillée, sans que rien ne le dise. Le
     calcul est refait ici, à part, depuis la largeur du monde. */
  const mPix = t.w.BCUI._carte.cadre().m;
  const attendu = Math.round(Math.log(2 * Math.PI * 6378137 / (256 * mPix)) / Math.LN2);
  verifier('le niveau colle à l’échelle', String(attendu),
    (/TILEMATRIX=(\d+)/.exec(src) || [])[1]);

  verifierVrai('plus aucun contour de commune', !t.$('#carte-plan path'));
  verifierVrai('le chantier est dessiné', !!t.$('#carte-plan [data-cartept="c1"]'));
  /* Sans réseau, il ne reste que les points : l'écran le dit, pour qu'une
     carte sans photo ne fasse pas chercher la panne ailleurs. */
  verifierVrai('et l’écran dit ce que le réseau change',
    /sans réseau, seuls vos chantiers/.test(t.$('#carte-aide').textContent));

  t.clic('[data-fondcarte="ign"]'); await t.pause(400);
  verifierVrai('la carte IGN se choisit',
    /LAYER=GEOGRAPHICALGRIDSYSTEMS\.PLANIGNV2/.test(tuiles()[0].getAttribute('src')));
  verifier('et le choix est retenu', 'ign', (t.stock('cfg') || {}).fondCarte);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : un téléphone réglé sur « contours seuls » retombe sur la photo', async () => {
  /* Le choix a disparu en 4.82, mais il est peut-être resté dans la
     configuration d'un téléphone. Il ne doit pas laisser la carte vide. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { fondCarte: 'contours' },
    chantiers: [{ id: 'c1', proprietaire: 'Martin', statut: 'encours', aDevis: false,
      temps: [], jours: [], lignes: [], maj: Date.now(),
      gps: { lat: 46.6012, lon: 2.4035 } }]
  }));
  t.clic('[data-vue="carte"]'); await t.pause(500);
  verifierVrai('des tuiles sont demandées', t.$$('#carte-cadre img').length > 0);
  verifierVrai('en photo aérienne',
    /ORTHOIMAGERY/.test(t.$('#carte-cadre img').getAttribute('src')));
  verifierVrai('et la photo est marquée choisie',
    t.$('[data-fondcarte="photo"]').classList.contains('actif'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : « Ma position » y va, au lieu d’y poser un point', async () => {
  /* « Il faudrait juste un bouton pour pouvoir zoomer sur soi-même. » Le
     bouton posait un point bleu quelque part et n'y allait pas : sur une
     carte de France, autant ne rien poser. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', proprietaire: 'Loin', statut: 'encours', aDevis: false,
      temps: [], jours: [], lignes: [], maj: Date.now(),
      gps: { lat: 45.60, lon: 4.10 } }]
  }), {
    avant: w => {
      /* Un GPS qui répond, à cent kilomètres du chantier semé. */
      w.navigator.geolocation = {
        getCurrentPosition: ok => ok({ coords: { latitude: 46.6012, longitude: 2.4035 } })
      };
    }
  });
  t.clic('[data-vue="carte"]'); await t.pause(500);

  const LB = t.w.BCUI._carte.LB;
  /* cadre() rend l'objet vivant, pas une copie : le relire après coup
     donnerait les mêmes valeurs des deux côtés. On garde les nombres. */
  const av = t.w.BCUI._carte.cadre();
  const avant = { cx: av.cx, cy: av.cy, m: av.m };
  const moi = LB.vers(46.6012, 2.4035);
  verifierVrai('la carte ne me regarde pas encore',
    Math.abs(avant.cx - moi.x) > 10000);

  t.clic('#carte-ici'); await t.pause(600);
  const apres = t.w.BCUI._carte.cadre();
  verifierVrai('la carte est venue sur moi',
    Math.abs(apres.cx - moi.x) < 100 && Math.abs(apres.cy - moi.y) < 100);
  /* Et elle s'est serrée : y aller sans zoomer laisserait un point bleu perdu
     au milieu d'un département. */
  verifierVrai('et elle s’est serrée', apres.m < avant.m);
  verifierVrai('assez pour reconnaître un chemin',
    apres.m * LB.facteurSol(apres.cy) <= 3.01);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : le trait d’échelle se mesure au sol, comme son libellé', async () => {
  /* Le libellé comptait en mètres au sol, le trait en mètres de carte : chez
     lui, un trait annoncé « 500 m » n'en couvrait que trois cent
     quarante-cinq. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', proprietaire: 'Martin', statut: 'encours', aDevis: false,
      temps: [], jours: [], lignes: [], maj: Date.now(),
      gps: { lat: 46.6012, lon: 2.4035 } }]
  }));
  t.clic('[data-vue="carte"]'); await t.pause(500);
  const trait = t.$('#carte-plan line');
  const libelle = trait.parentNode.querySelector('text').textContent;
  const lu = /^([\d,]+) (k?m)$/.exec(libelle);
  verifierVrai('le libellé se lit', !!lu);
  const metres = parseFloat(lu[1].replace(',', '.')) * (lu[2] === 'km' ? 1000 : 1);
  const px = Number(trait.getAttribute('x2')) - Number(trait.getAttribute('x1'));
  /* Le sol par pixel est recalculé ici depuis la latitude, à part de
     facteurSol : les deux sources restent indépendantes. */
  const c = t.w.BCUI._carte.cadre();
  const lat = t.w.BCUI._carte.LB.depuis(c.cx, c.cy).lat;
  const solParPixel = c.m * Math.cos(lat * Math.PI / 180);
  verifierVrai('le trait couvre au sol ce que dit son libellé',
    Math.abs(px - metres / solParPixel) <= 0.6);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : un doigt levé sur un dessin remplacé ne bloque plus rien', async () => {
  /* « Au bout d'un moment ça marche plus. Je crois que je suis arrivé sur un
     angle, et je ne peux plus bouger avec mon doigt. Je peux zoomer,
     dézoomer. » La carte se redessine sous le doigt ; quand il se lève sur
     l'ancien dessin, l'événement ne remonte plus, et le doigt restait compté. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', proprietaire: 'Martin', statut: 'encours', aDevis: false,
      temps: [], jours: [], lignes: [], maj: Date.now(),
      gps: { lat: 46.6012, lon: 2.4035 } }]
  }));
  t.clic('[data-vue="carte"]'); await t.pause(500);
  /* JSDOM ne mesure rien : chaque dessin, même refait, a sa taille réelle. */
  t.w.Element.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 240 });
  const doigt = (type, cible, id, x, y, premier) => {
    const e = new t.w.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(e, 'pointerId', { value: id });
    Object.defineProperty(e, 'isPrimary', { value: premier });
    cible.dispatchEvent(e);
  };
  const cadre = () => { const c = t.w.BCUI._carte.cadre(); return { cx: c.cx, cy: c.cy, m: c.m }; };

  /* Premier geste : on glisse, et la carte se redessine sous le doigt… */
  const ancien = t.$('#carte-plan');
  doigt('pointerdown', ancien, 1, 100, 100, true);
  doigt('pointermove', ancien, 1, 140, 100, true);
  await t.pause(150);
  verifierVrai('le dessin a bien été remplacé sous le doigt', t.$('#carte-plan') !== ancien);
  /* … puis le doigt se lève sur l'ancien dessin, détaché du document :
     l'événement ne remonte plus jusqu'au cadre. */
  doigt('pointerup', ancien, 1, 140, 100, true);

  /* Second geste, un seul doigt : la carte doit suivre. */
  const avant = cadre();
  const plan = t.$('#carte-plan');
  doigt('pointerdown', plan, 2, 100, 100, true);
  doigt('pointermove', plan, 2, 160, 100, true);
  await t.pause(150);
  const apres = cadre();
  verifierVrai('un doigt déplace encore la carte', Math.abs(apres.cx - avant.cx) > 1);
  verifier('sans zoomer par erreur', avant.m, apres.m);
  doigt('pointerup', t.$('#carte-svg'), 2, 160, 100, true);

  /* Deux doigts zooment toujours. */
  const p2 = t.$('#carte-plan');
  doigt('pointerdown', p2, 3, 100, 120, true);
  doigt('pointerdown', p2, 4, 140, 120, false);
  doigt('pointermove', p2, 4, 220, 120, false);
  await t.pause(150);
  verifierVrai('deux doigts écartés zooment', cadre().m < apres.m);
  /* On lève un doigt du pincement : celui qui reste déplace la carte, sans
     avoir à se lever lui aussi. */
  doigt('pointerup', t.$('#carte-svg'), 4, 220, 120, false);
  const pince = cadre();
  doigt('pointermove', t.$('#carte-plan'), 3, 60, 120, true);
  await t.pause(150);
  verifierVrai('le doigt qui reste déplace la carte', Math.abs(cadre().cx - pince.cx) > 1);
  doigt('pointerup', t.$('#carte-svg'), 3, 60, 120, true);

  /* Un glissement qui s'achève pendant qu'on place un chantier ne le pose
     pas : seul un appui franc le fait. */
  t.clic('#carte-poser'); await t.pause(300);
  t.choisir('#pc-ch', 'c1');
  t.clic('#pc-ok'); await t.pause(300);
  const gps0 = JSON.stringify((t.stock('chantiers') || [])[0].gps);
  const p3 = t.$('#carte-plan');
  doigt('pointerdown', p3, 5, 60, 60, true);
  doigt('pointermove', p3, 5, 120, 90, true);
  doigt('pointerup', t.$('#carte-svg'), 5, 120, 90, true);
  t.$('#carte-plan').dispatchEvent(new t.w.MouseEvent('click',
    { bubbles: true, clientX: 120, clientY: 90 }));
  await t.pause(400);
  verifier('un glissement ne pose pas le chantier', gps0,
    JSON.stringify((t.stock('chantiers') || [])[0].gps));
  const p4 = t.$('#carte-plan');
  doigt('pointerdown', p4, 6, 160, 120, true);
  doigt('pointerup', t.$('#carte-svg'), 6, 160, 120, true);
  t.$('#carte-plan').dispatchEvent(new t.w.MouseEvent('click',
    { bubbles: true, clientX: 160, clientY: 120 }));
  await t.pause(500);
  verifierVrai('un appui franc le pose',
    JSON.stringify((t.stock('chantiers') || [])[0].gps) !== gps0);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Carte : chercher une commune y emmène', async () => {
  /* « Est-ce que tu penses qu'il y a une possibilité de rajouter juste une
     barre de recherche pour rechercher une ville ou une commune ? » */
  const demandes = [];
  let reponse = null;
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'calendrier' }), {
    avant: w => {
      /* Le banc d'essai n'a pas de réseau : on répond comme le service de
         l'IGN, dans son format — la longitude d'abord. Sans réponse prévue,
         la demande échoue, comme hors ligne. */
      w.fetch = url => {
        demandes.push(url);
        if (!reponse) return Promise.reject(new Error('hors ligne'));
        const r = reponse;
        return Promise.resolve({ ok: true, json: () => Promise.resolve(r) });
      };
    }
  });
  t.clic('[data-vue="carte"]'); await t.pause(500);
  const LB = t.w.BCUI._carte.LB;
  const commune = (nom, dep, lon, lat) => ({ type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { label: nom, name: nom, depcode: dep, type: 'municipality' } });

  /* Deux communes du même nom : on choisit. */
  reponse = { features: [commune('Saint-Paul', '06', 7.12, 43.70), commune('Saint-Paul', '40', -1.05, 43.75)] };
  t.saisir('#carte-rech', 'saint-paul');
  t.clic('#carte-chercher'); await t.pause(300);
  verifier('une seule question au service', 1, demandes.length);
  verifierVrai('au géocodage de l’IGN, pour une commune',
    /^https:\/\/data\.geopf\.fr\/geocodage\/search\?q=saint-paul&type=municipality/.test(demandes[0]));
  const choix = t.$$('#carte-resultats [data-commune]');
  verifier('les deux sont proposées, avec leur département',
    ['Saint-Paul (06)', 'Saint-Paul (40)'], choix.map(b => b.textContent));
  choix[1].click(); await t.pause(300);
  const v = t.w.BCUI._carte.cadre();
  const vise = LB.vers(43.75, -1.05);
  verifierVrai('la carte est allée sur la bonne',
    Math.abs(v.cx - vise.x) < 1 && Math.abs(v.cy - vise.y) < 1);
  verifierVrai('et assez près pour la voir entière',
    Math.abs(v.m * LB.facteurSol(v.cy) - 12) < 0.01);
  verifier('la liste s’efface', 0, t.$$('#carte-resultats [data-commune]').length);

  /* Une seule réponse : on y va sans choisir, et la touche Entrée suffit. */
  reponse = { features: [commune('Saint-Martin', '12', 2.57, 44.35)] };
  t.saisir('#carte-rech', 'saint-martin');
  t.$('#carte-rech').dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await t.pause(300);
  const l = LB.vers(44.35, 2.57), v2 = t.w.BCUI._carte.cadre();
  verifierVrai('une seule commune : on y va directement',
    Math.abs(v2.cx - l.x) < 1 && Math.abs(v2.cy - l.y) < 1);

  /* Sans réseau, on le dit, et la carte reste où elle était. */
  reponse = null;
  const fige = v2.cx;
  t.saisir('#carte-rech', 'nulle part');
  t.clic('#carte-chercher'); await t.pause(300);
  verifierVrai('sans réseau, l’écran le dit', /il faut du réseau/.test(t.texte('#carte-resultats')));
  verifier('et la carte ne bouge pas', fige, t.w.BCUI._carte.cadre().cx);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Un chantier prêt pour une fiche de chantier. */
const CH_FICHE = () => ({
  module: 'chantiers',
  cfg: { nomEntreprise: 'Mon entreprise', siret: '12345678900012', telEntreprise: '06 00 00 00 00' },
  clients: ['Cabinet Dubois'], proprios: ['Martin'],
  chantiers: [{ id: 'c1', nom: 'Dégagement Martin', statut: 'accepte', aDevis: true,
    maj: Date.now(), donneur: 'Cabinet Dubois', proprietaire: 'Martin',
    commune: 'Clairbois', departement: '48', foret: 'Forêt de la Côte', parcelles: '12 à 14',
    gps: { lat: 44.3501, lon: 3.5804 }, temps: [], jours: [],
    lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }] }]
});

scenario('Fiche de chantier : elle reprend ce que Sylve sait déjà', async () => {
  /* « Je sélectionne mon chantier, et après par rapport aux données que j'ai
     déjà, soit ça préremplit, soit je n'ai pas les données et ça manque. » */
  const t = await ouvrir(Object.assign({}, VIDE, CH_FICHE()));
  t.clic('[data-vue="fichech"]'); await t.pause(400);
  verifierVrai('l’écran demande de choisir un chantier',
    /Choisissez un chantier/.test(t.texte('#fch-corps')));
  t.choisir('#fch-ch', 'c1'); await t.pause(450);

  const txt = t.texte('#fch-corps');
  verifierVrai('le propriétaire est repris', /Martin/.test(txt));
  verifierVrai('le donneur d’ordre aussi', /Cabinet Dubois/.test(txt));
  verifierVrai('la commune avec son département', /Clairbois \(48\)/.test(txt));
  verifierVrai('les parcelles', /12 à 14/.test(txt));
  /* Point décimal, pas virgule : c'est la forme qu'attend une carte quand
     il les recolle, et la virgule sépare déjà les deux nombres. */
  verifierVrai('et la position', /44.3501, 3.5804/.test(txt));

  /* Ce qui manque est nommé, pas laissé en blanc. */
  verifierVrai('ce qui manque est annoncé', /Il manque/.test(txt));
  verifierVrai('les moyens d’accès en font partie', /moyens d’accès/.test(txt));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : les risques se cochent et se gardent', async () => {
  /* Les numéros sont ceux du modèle papier : la légende du croquis demande
     de les reporter sous les symboles. */
  const t = await ouvrir(Object.assign({}, VIDE, CH_FICHE()));
  t.clic('[data-vue="fichech"]'); await t.pause(400);
  t.choisir('#fch-ch', 'c1'); await t.pause(450);

  verifier('les trente-trois risques du modèle sont là', 33,
    t.$$('#fch-corps [data-fchr]').length);
  t.clic('[data-fchr="1"]'); await t.pause(300);
  t.clic('[data-fchr="9"]'); await t.pause(300);
  t.clic('[data-fchr="30"]'); await t.pause(400);

  const c = (t.stock('chantiers') || [])[0];
  verifier('les risques cochés sont retenus', [1, 9, 30], (c.fiche || {}).risques);

  /* Décocher retire, sans toucher aux autres. */
  t.clic('[data-fchr="9"]'); await t.pause(400);
  verifier('décocher n’enlève que celui-là', [1, 30],
    ((t.stock('chantiers') || [])[0].fiche || {}).risques);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : la couverture a cinq crans, pas deux', async () => {
  /* « Des fois tu captes, mais pas beaucoup. » Oui / Non ne suffisait pas :
     c'est sur cette nuance que se décide où l'on court pour donner l'alerte. */
  const t = await ouvrir(Object.assign({}, VIDE, CH_FICHE()));
  t.clic('[data-vue="fichech"]'); await t.pause(400);
  t.choisir('#fch-ch', 'c1'); await t.pause(450);
  const crans = t.$$('#fch-reseaux [data-fchres]').map(b => b.textContent);
  verifier('cinq crans', ['Excellente', 'Bonne', 'Moyenne', 'Mauvaise', 'Aucune'], crans);
  t.clic('[data-fchres="moyenne"]'); await t.pause(400);
  verifier('le cran choisi est retenu', 'moyenne',
    ((t.stock('chantiers') || [])[0].fiche || {}).reseau);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : le téléphone est retenu par nom', async () => {
  /* Les listes restent des noms — aucune migration. Le numéro vit à côté,
     indexé par le nom, et la fiche suivante le reprend. */
  const t = await ouvrir(Object.assign({}, VIDE, CH_FICHE()));
  t.clic('[data-vue="fichech"]'); await t.pause(400);
  t.choisir('#fch-ch', 'c1'); await t.pause(450);
  t.saisir('#fch-telp', '03 81 00 00 00');
  t.$('#fch-telp').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(450);

  const cfg = t.stock('cfg') || {};
  verifier('le numéro est rangé sous le nom', '03 81 00 00 00',
    ((cfg.contacts || {})['Martin'] || {}).tel);
  /* Et la liste des propriétaires n'a pas changé de forme. */
  verifier('la liste reste une liste de noms', ['Martin'], t.stock('proprios'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : la feuille dit ce qui manque au lieu de laisser un blanc', async () => {
  /* Un blanc sur une fiche de sécurité se lit comme une absence de risque. */
  const g = CH_FICHE();
  delete g.chantiers[0].parcelles;
  g.cfg = { nomEntreprise: 'Mon entreprise' };
  const t = await ouvrir(Object.assign({}, VIDE, g));
  t.clic('[data-vue="fichech"]'); await t.pause(400);
  t.choisir('#fch-ch', 'c1'); await t.pause(450);
  t.clic('#fch-voir'); await t.pause(600);

  const f = t.texte('#modale');
  verifierVrai('la feuille s’ouvre en aperçu', /Fiche de chantier/.test(f));
  verifierVrai('elle cite le décret', /décret n° 2010-1603/i.test(f));
  verifierVrai('le propriétaire y est', /Martin/.test(f));
  verifierVrai('les parcelles manquantes sont dites', /Parcellesà compléter/.test(f));
  verifierVrai('le SIRET manquant aussi', /SIRET à compléter/.test(f));
  verifierVrai('les numéros d’urgence sont en clair', /URGENCES 112/.test(f));
  verifierVrai('et les signatures sont prévues', /signature du donneur d’ordre/.test(f));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : au-delà de quatre hectares, elle est annoncée obligatoire', async () => {
  /* « Ce ne sera que les quatre hectares : je ne fais que du sylvicole. » Le
     seuil des cent mètres cubes existe dans la loi, il ne le rencontrera
     jamais — l'annoncer n'aurait servi qu'à faire du bruit. */
  const g = CH_FICHE();
  g.chantiers[0].lignes = [{ travail: 'DEGAG', unite: 'ha', quantite: 6, prix: 700,
    nature: 'prestation' }];
  const t = await ouvrir(Object.assign({}, VIDE, g));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  verifierVrai('la fiche du chantier le dit là où il chiffre',
    /une fiche sécurité est obligatoire/i.test(t.texte('#vue-chantier')));

  /* Et le bouton y mène, quel que soit le filtre. */
  t.clic('#f-fichech'); await t.pause(500);
  verifierVrai('le bouton ouvre la fiche de chantier',
    t.$('#vue-fichech').classList.contains('actif'));
  verifierVrai('sur le bon chantier', /Dégagement manuel — Martin, Clairbois/.test(t.texte('#fch-corps')));
  verifierVrai('avec le rappel de l’obligation',
    /Fiche obligatoire/.test(t.texte('#fch-corps')));

  /* Trois hectares ne déclenchent rien. */
  const C0 = t.w.BCC;
  verifierVrai('trois hectares ne la rendent pas obligatoire',
    !C0.ficheRequise({ lignes: [{ unite: 'ha', quantite: 3 }] }));
  verifierVrai('six hectares, si',
    C0.ficheRequise({ lignes: [{ unite: 'ha', quantite: 6 }] }));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : des coordonnées se collent depuis une carte', async () => {
  /* Une application web ne peut pas lire ce qu'on a désigné dans une autre :
     il n'y a pas de retour. Mais on peut y copier des coordonnées et les
     coller ici — d'où les deux séparateurs et les deux écritures décimales. */
  const t = await ouvrir(Object.assign({}, VIDE, CH_FICHE()));
  t.clic('[data-vue="fichech"]'); await t.pause(400);
  t.choisir('#fch-ch', 'c1'); await t.pause(450);
  t.saisir('#fch-gps', '44.35012, 3.58043');
  t.$('#fch-gps').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(450);
  const f = ((t.stock('chantiers') || [])[0].fiche || {}).gpsRencontre || {};
  verifier('la latitude est lue', 44.35012, f.lat);
  verifier('la longitude aussi', 3.58043, f.lon);

  /* Un point qui n'existe pas sur Terre est refusé : une fiche de sécurité
     qui envoie les secours à une latitude de 999 est pire qu'une fiche sans
     coordonnées. */
  t.saisir('#fch-gps', '999, 999');
  t.$('#fch-gps').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(450);
  verifier('une latitude impossible est refusée', 44.35012,
    (((t.stock('chantiers') || [])[0].fiche || {}).gpsRencontre || {}).lat);

  /* Une saisie qui n'est pas un couple de coordonnées ne remplace rien. */
  t.saisir('#fch-gps', 'au calvaire');
  t.$('#fch-gps').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(450);
  verifier('un texte quelconque ne l’écrase pas', 44.35012,
    (((t.stock('chantiers') || [])[0].fiche || {}).gpsRencontre || {}).lat);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : les risques se reprennent d’un chantier de la même forêt', async () => {
  /* « Comment savoir que c'est la même forêt ? Si c'est le même nom, ça
     pourrait être le cas. » C'est lui qui a proposé le critère, et c'est le
     seul dont Sylve dispose. La commune s'y ajoute : deux « Bois du Haut »
     dans deux communes ne sont pas la même forêt. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    cfg: { nomEntreprise: 'Mon entreprise', siret: '1', telEntreprise: '06' },
    chantiers: [
      { id: 'c0', nom: 'Dégagement 2024', statut: 'paye', aDevis: false, temps: [], jours: [],
        maj: Date.now() - 400 * 86400000, foret: 'Forêt de la Côte', commune: 'Clairbois',
        lignes: [], fiche: { risques: [22] } },
      { id: 'c1', nom: 'Dégagement 2025', statut: 'paye', aDevis: false, temps: [], jours: [],
        maj: Date.now() - 86400000, foret: 'Forêt de la Côte', commune: 'Clairbois', lignes: [],
        fiche: { risques: [1, 9, 30], consignes: { terrain: 'Pente en haut de parcelle.' },
          acces: 'Chemin après le calvaire', pointRencontre: 'Au calvaire' } },
      /* Même nom de forêt, autre commune : ce n'est pas la même forêt. */
      { id: 'c2', nom: 'Ailleurs', statut: 'paye', aDevis: false, temps: [], jours: [],
        maj: Date.now(), foret: 'Forêt de la Côte', commune: 'Autre commune',
        lignes: [], fiche: { risques: [7] } },
      { id: 'c3', nom: 'Dégagement 2026', statut: 'accepte', aDevis: true, temps: [], jours: [],
        maj: Date.now(), foret: 'Forêt de la Côte', commune: 'Clairbois', lignes: [] }
    ]
  }));
  t.clic('[data-vue="fichech"]'); await t.pause(400);
  t.choisir('#fch-ch', 'c3'); await t.pause(450);

  const dit = t.texte('#fch-corps');
  verifierVrai('un chantier jumeau est proposé', /Déjà connu ici/.test(dit));
  /* Le plus récent des deux de la même commune, et jamais celui d'ailleurs. */
  verifierVrai('le plus récent de la même forêt', /Dégagement 2025/.test(dit));
  verifierVrai('pas le plus ancien', !/Dégagement 2024/.test(dit));
  verifierVrai('ni celui d’une autre commune', !/Ailleurs/.test(dit));

  t.clic('#fch-reprendre'); await t.pause(600);
  const c3 = (t.stock('chantiers') || []).filter(x => x.id === 'c3')[0];
  verifier('les risques sont repris', [1, 9, 30], (c3.fiche || {}).risques);
  verifier('les consignes aussi', 'Pente en haut de parcelle.',
    ((c3.fiche || {}).consignes || {}).terrain);
  verifier('et l’accès', 'Chemin après le calvaire', (c3.fiche || {}).acces);
  /* Le point de rencontre dépend du chantier, pas de la forêt : il ne suit pas. */
  verifierVrai('mais pas le point de rencontre', !(c3.fiche || {}).pointRencontre);
  /* Une fois coché, l'offre disparaît : proposer de tout remplacer quand il a
     déjà travaillé serait un piège. */
  verifier('l’offre ne revient pas', null, t.$('#fch-reprendre'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : le téléphone du propriétaire n’est pas exigé', async () => {
  /* L'arrêté demande « nom et coordonnées » du propriétaire, mais nomme
     explicitement le « téléphone du donneur d'ordre ». Réclamer les deux en
     rouge, c'était inventer une obligation.

     Et « la carte est en A4, alors que l'emplacement du croquis c'est une
     zone restreinte » : quand un plan accompagne la fiche, le cadre vide
     n'a plus lieu d'être. */
  const t = await ouvrir(Object.assign({}, VIDE, CH_FICHE()));
  t.clic('[data-vue="fichech"]'); await t.pause(400);
  t.choisir('#fch-ch', 'c1'); await t.pause(450);
  verifierVrai('le champ le dit', /facultatif/.test(t.texte('#fch-corps')));

  t.clic('#fch-voir'); await t.pause(600);
  const f = t.texte('#modale');
  verifierVrai('celui du propriétaire tient un tiret',
    /PropriétaireMartinTéléphone—/.test(f));
  verifierVrai('celui du donneur d’ordre reste réclamé',
    /Donneur d’ordreCabinet DuboisTéléphoneà compléter/.test(f));
  verifier('un seul téléphone est réclamé', 1,
    (f.match(/Téléphoneà compléter/g) || []).length);
  verifierVrai('sans plan, le cadre du croquis est là', t.$('#modale .fv'));
  verifierVrai('l’aperçu se ferme', t.clic('#modale-x')); await t.pause(300);
  verifierVrai('il est fermé', t.$('#modale').hidden);

  cocher(t, '#fch-plan', true); await t.pause(300);
  t.clic('#fch-voir'); await t.pause(600);
  verifier('avec un plan, le cadre cède la place', null, t.$('#modale .fv'));
  verifierVrai('et la fiche renvoie au plan',
    /Voir le plan joint/.test(t.texte('#modale')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Temps : une saisie survit à la réindexation', async () => {
  /* Le défaut derrière trois de ses symptômes. « c.temps » n'est pas une
     donnée : c'est une lecture de « A.journees », refaite de zéro à chaque
     ouverture. « + Temps » y poussait directement — la saisie tenait jusqu'à
     la prochaine indexation, puis disparaissait sans bruit. D'où des jours
     faits qui ne comptaient pas dans les rendements, et un chantier qui
     finissait « en retard » sans qu'il sache pourquoi. */
  const JOUR = 86400000;
  const hier = new Date(Date.now() - JOUR); hier.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', aDevis: false, maj: Date.now(),
      temps: [], jours: [{ d: hier.getTime(), p: 1 }],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-temps'); await t.pause(400);
  t.choisir('#ct-date', jourISO(hier.getTime()));
  t.saisir('#ct-duree', '7');
  t.choisir('#ct-act', 'DEGAG');
  t.clic('#ct-ok'); await t.pause(600);

  /* Elle a créé une journée, pas une ligne de lecture. */
  verifier('une journée est née de la saisie', 1, (t.stock('journees') || []).length);
  verifier('avec son poste', 7, ((t.stock('journees') || [])[0].postes || [])[0].heures);
  verifier('le chantier la porte', 1, ((t.stock('chantiers') || [])[0].temps || []).length);

  /* Et elle survit à ce qui reconstruit la lecture : c'est tout l'objet. */
  const t2 = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: t.stock('chantiers'), journees: t.stock('journees')
  }));
  await t2.pause(300);
  verifier('elle est toujours là au lancement suivant', 1,
    ((t2.stock('chantiers') || [])[0].temps || []).length);
  verifier('et le rendement la compte', 7,
    t2.w.BCC.heuresSaisie((t2.stock('chantiers')[0].temps || [])[0], { heuresJour: 8 }));
  verifier('aucune erreur', [], t.erreurs.concat(t2.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : ✕ retire la journée d’un chantier ce jour-là, et pour de bon', async () => {
  /* « J'avais mis une fois sept heures et une fois deux heures. Quand j'ai
     fait retirer, ça a supprimé les deux. » La croix visait la date et
     filtrait la lecture, qui se refaisait juste après. Lot r1b : une ligne
     par chantier ce jour-là, et ✕ retire toute la journée de ce chantier —
     à la source, vers la Corbeille ; l'autre chantier du jour ne bouge pas. */
  const JOUR = 86400000;
  const hier = new Date(Date.now() - JOUR); hier.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', aDevis: true, maj: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }],
      temps: [], jours: [{ d: hier.getTime(), p: 1 }] },
      { id: 'c2', nom: 'Bois Joli', statut: 'encours', aDevis: false, maj: Date.now(), lignes: [], temps: [], jours: [] }],
    journees: [
      { id: 'j1', date: hier.getTime(), chantier: 'c1', personnes: 1, nonProd: 0,
        postes: [{ travaux: 'DEGAG', heures: 7, quantite: 0 }] },
      { id: 'j2', date: hier.getTime(), chantier: 'c1', personnes: 1, nonProd: 0,
        postes: [{ travaux: 'PLANT', heures: 2, quantite: 0 }] },
      { id: 'j3', date: hier.getTime(), chantier: 'c2', personnes: 1, nonProd: 3, postes: [] }
    ]
  }));
  t.w.confirm = () => true;
  await t.pause(300);
  await cliquerJour(t, hier.getTime());
  const croix = t.$$('#modale [data-fjsupch]');
  verifier('une ligne par chantier', ['c1', 'c2'], croix.map(b => b.dataset.fjsupch));
  verifierVrai('les 9 h de c1 sur une seule ligne', /1 j 1 h/.test(t.texte('#modale [data-fjch="c1"]') || ''));
  croix[0].click(); await t.pause(600);

  const c = (t.stock('chantiers') || [])[0];
  verifier('c1 n’a plus de temps ce jour-là', 0, (c.temps || []).length);
  /* Retirées à la source : elles ne reviennent pas à l'indexation suivante. */
  verifier('ses deux journées sont parties, pas celle de c2', ['j3'], (t.stock('journees') || []).map(j => j.id));
  verifier('c2 garde ses 3 h', 3, ((t.stock('chantiers') || [])[1].temps || []).reduce((s, x) => s + x.duree, 0));
  verifier('aucune erreur', [], t.erreurs);
});


/* --------------------------------------------------------------------- */
scenario('Calendrier : un chantier fait ne se redit pas « posé »', async () => {
  /* « Ce que j'ai fait, il est forcément prévu. C'est soit une journée prévue,
     soit elle est faite, pas les deux en même temps, sinon ça se mélange. » */
  const JOUR = 86400000;
  const hier = new Date(Date.now() - JOUR); hier.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8 },
    chantiers: [
      { id: 'c1', nom: 'Dégagement Martin', statut: 'accepte', aDevis: true, maj: Date.now(),
        lignes: [], jours: [{ d: hier.getTime(), p: 1 }],
        temps: [{ date: hier.getTime(), duree: 7, unite: 'h', personnes: 1 }] },
      /* Un second chantier posé le même jour, sans temps : lui reste en
         attente, et c'est bien ce qu'on veut voir. */
      { id: 'c2', nom: 'Plantation Bernard', statut: 'accepte', aDevis: true, maj: Date.now(),
        lignes: [], temps: [], jours: [{ d: hier.getTime(), p: 1 }] }
    ]
  }));
  await t.pause(300);
  await cliquerJour(t, hier.getTime());
  const f = t.texte('#modale');
  verifierVrai('le chantier fait est dans « ce que vous y avez fait »',
    /Ce que vous y avez fait/.test(f));
  /* Il ne doit pas reparaître comme en attente. */
  const enAttente = t.$$('#modale [data-fjretirer]').map(b => b.dataset.fjretirer);
  verifier('seul celui sans temps reste posé', ['c2'], enAttente);
  verifierVrai('et l’intitulé le dit', /sans temps noté/.test(f));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Calendrier : un seul chemin pour dire qu’on a travaillé — la fiche du jour (R7)', async () => {
  /* « Si je clique sur un jour et que je fais j'ai travaillé, je n'ai pas la
     même chose qui s'ouvre que quand en bas j'appuie sur j'ai travaillé. »
     La carte Journée du bas a fondu dans la fiche du jour : il n'y a plus
     qu'un écran, et il ouvre Ma journée datée du jour. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', aDevis: true, maj: Date.now(),
      lignes: [], temps: [], jours: [] }]
  }));
  await t.pause(300);
  verifier('la carte Journée du bas est partie', [null, null, null],
    [t.$('#cal-saisir'), t.$('#cal-detail'), t.$('#cal-jour-titre')]);
  t.clic('#cal-auj'); await t.pause(450);
  verifierVrai('le bouton Aujourd’hui ouvre la fiche du jour', t.$('#fj-poser'));
  verifier('avec le bouton de saisie', 'Saisir ma journée', t.texte('#fj-travaille'));
  t.clic('#fj-travaille'); await t.pause(450);
  verifier('qui ouvre Ma journée', 'Ma journée', t.texte('#modale-titre'));
  verifier('datée du jour', jourISO(Date.now()), t.$('#mj-date').value);
  /* Et l'ancien formulaire n'existe plus. */
  verifier('l’ancien formulaire a disparu', null, t.$('#sj-duree'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Chantier : le SIREN se demande une fois, sous le champ, et n’est plus écrasé', async () => {
  /* « Il me demande s'il a un numéro de SIREN, et juste en dessous c'est
     aussi marqué : il me redemande. » Pire : la case du bas, restée
     décochée, écrasait le « oui » donné sous le champ — le chantier partait
     à 20 % de TVA et le client perdait son SIREN. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  await plusChantier(t);
  t.saisir('#ce-proprio', 'Martin');
  t.$('#ce-proprio').dispatchEvent(new t.w.Event('blur'));
  await t.pause(200);
  t.clic('#ce-proprio-offre [data-offre]'); await t.pause(300);
  t.choisir('#tc-type', 'proprio'); await t.pause(150);
  cocher(t, '#tc-siren', true);
  t.clic('#tc-ok'); await t.pause(400);
  t.saisir('#ce-com', 'Clairbois');
  t.clic('#ce-ok'); await t.pause(600);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le chantier porte le SIREN donné sous le champ', true, c.siren);
  verifier('et le client le garde', true,
    (((t.stock('cfg') || {}).contacts || {})['Martin'] || {}).siren);

  /* Le chantier suivant pour le même client ne repose rien, et reprend. */
  t.clic('[data-chretour]'); await t.pause(300);
  await plusChantier(t);
  t.saisir('#ce-proprio', 'Martin');
  t.$('#ce-proprio').dispatchEvent(new t.w.Event('blur'));
  await t.pause(250);
  verifier('aucune question pour un client qui a répondu', '',
    t.$('#ce-proprio-offre').textContent.trim());
  t.saisir('#ce-com', 'Montjoie');
  t.clic('#ce-ok'); await t.pause(600);
  const c2 = (t.stock('chantiers') || []).filter(x => x.commune === 'Montjoie')[0];
  verifier('le second chantier reprend la réponse', true, c2 && c2.siren);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : un client ajouté depuis « Le chantier » garde son SIREN', async () => {
  /* Le même écrasement existait dans le formulaire « Le chantier » : la
     réponse donnée sous le champ ne cochait pas la case du chantier, qui la
     réécrivait à l'enregistrement. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', proprios: ['Ancien'],
    chantiers: [{ id: 'c1', proprietaire: 'Ancien', commune: 'Clairbois', statut: 'encours',
      aDevis: false, siren: false, lignes: [], temps: [], jours: [], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(350);
  t.clic('#f-identite'); await t.pause(350);
  t.saisir('#ic-proprio', 'Nouveau client');
  t.$('#ic-proprio').dispatchEvent(new t.w.Event('blur'));
  await t.pause(200);
  t.clic('#ic-proprio-offre [data-offre]'); await t.pause(300);
  t.choisir('#tc-type', 'proprio'); await t.pause(150);
  cocher(t, '#tc-siren', true);
  t.clic('#tc-ok'); await t.pause(400);
  verifier('la case du chantier suit la réponse', true, t.$('#ic-siren').checked);
  t.clic('#ic-ok'); await t.pause(500);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le chantier la garde', true, c.siren);
  verifier('et le client aussi', true,
    (((t.stock('cfg') || {}).contacts || {})['Nouveau client'] || {}).siren);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Création : avec ou sans devis, et une estimation', async () => {
  /* « Je crée un chantier, je n'ai pas de devis, et je n'ai pas de statut
     adapté. » Et : « il faut que je puisse estimer rapidement le nombre de
     jours à prévoir, ou la surface ». Depuis le lot b2, la surface se tape à
     la création ; avec ou sans devis et les journées, dans l'étape Devis. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  await plusChantier(t);
  t.saisir('#ce-proprio', 'Martin');
  t.choisir('#ce-trav', 'DEGAG'); await t.pause(200);
  verifierVrai('la surface se demande dans l’unité des travaux',
    !t.$('#ce-qte-champ').hidden && /Surface \(ha\)/.test(t.$('#ce-qte-l').textContent));
  t.saisir('#ce-qte', '2,5');
  t.clic('#ce-ok'); await t.pause(600);
  const c = (t.stock('chantiers') || [])[0];
  verifierVrai('le chantier est créé', !!c);
  verifier('il part en « devis à envoyer », avec devis à saisir', ['devis', true], [c.statut, c.aDevis]);
  verifier('et la surface ouvre la ligne de travaux', 2.5, c.lignes[0].quantite);
  verifier('sans journées tapées, rien n’est inventé', undefined, c.joursEstimes);
  /* Sans devis : l'étape Devis le dit, il passe « à programmer ». */
  t.clic('#f-sansdevis'); await t.pause(450);
  const c2 = (t.stock('chantiers') || [])[0];
  verifier('sans devis, il part en « à programmer »', 'accepte', c2.statut);
  verifier('et le sait', false, c2.aDevis);
  verifierVrai('la fiche le dit « À programmer »', /À programmer/.test(t.texte('#vue-chantier')));
  /* Les journées à prévoir : Devis ▸ Temps estimé. */
  t.clic('#f-estim'); await t.pause(300);
  t.saisir('#es-jest', '3'); t.clic('#es-ok'); await t.pause(450);
  verifier('les journées estimées sont retenues', 3, (t.stock('chantiers') || [])[0].joursEstimes);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : voir ou placer le chantier sur la carte', async () => {
  /* « Associer la carte au chantier : accéder à la carte depuis ma fiche, ou
     avoir un emplacement pour le positionner. » */
  let demande = null;
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'p', proprietaire: 'Placé', statut: 'encours', aDevis: false, lignes: [], temps: [],
        jours: [], maj: Date.now(), gps: { lat: 44.95, lon: 3.11 } },
      /* Un second chantier placé loin : sans lui, la carte s'ouvrirait déjà
         centrée sur le premier, et le recentrage ne se prouverait pas. */
      { id: 'q', proprietaire: 'Loin', statut: 'encours', aDevis: false, lignes: [], temps: [],
        jours: [], maj: Date.now(), gps: { lat: 48.5, lon: 7.5 } },
      { id: 'n', proprietaire: 'Non placé', commune: 'Saint-Paul', statut: 'encours', aDevis: false,
        lignes: [], temps: [], jours: [], maj: Date.now() }
    ]
  }), {
    avant: w => {
      w.fetch = url => {
        demande = url;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ features: [{
          geometry: { coordinates: [7.12, 43.70] }, properties: { name: 'Saint-Paul' } }] }) });
      };
    }
  });
  const LB = t.w.BCUI._carte.LB;
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="p"]'); await t.pause(350);
  verifierVrai('la fiche dit qu’il est placé', /Sur la carteVoir/.test(t.texte('#vue-chantier')));
  t.clic('[data-fcarte="voir"]'); await t.pause(500);
  verifierVrai('la carte s’ouvre', t.$('#vue-carte').classList.contains('actif'));
  const v = t.w.BCUI._carte.cadre(), m = LB.vers(44.95, 3.11);
  verifierVrai('centrée sur le chantier', Math.abs(v.cx - m.x) < 1 && Math.abs(v.cy - m.y) < 1);
  verifierVrai('et assez près pour le voir', v.m * LB.facteurSol(v.cy) <= 8.01);
  verifierVrai('sans rien poser', !/Appuyez sur la carte/.test(t.texte('#carte-aide')));

  /* Un chantier pas encore placé : la carte va sur sa commune, prête à poser. */
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="n"]'); await t.pause(350);
  verifierVrai('la fiche propose de le placer', !!t.$('[data-fcarte="placer"]'));
  t.clic('[data-fcarte="placer"]'); await t.pause(500);
  verifierVrai('la carte attend l’appui', /Appuyez sur la carte/.test(t.texte('#carte-aide')));
  verifierVrai('sa commune a été cherchée', /q=Saint-Paul/.test(demande || ''));
  const v2 = t.w.BCUI._carte.cadre(), c2 = LB.vers(43.70, 7.12);
  verifierVrai('et la carte y est allée', Math.abs(v2.cx - c2.x) < 1 && Math.abs(v2.cy - c2.y) < 1);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Finances : les montants ne passent plus à la ligne', async () => {
  /* « Là je suis sur prestation de service, j'ai fait un chiffre assez
     élevé, et après il y a un retour à la ligne. Ça m'embrouille. » */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    chantiers: [{ id: 'c1', statut: 'facture', aDevis: false, proprietaire: 'Client', temps: [],
      jours: [], maj: Date.now(), numeroFacture: 'F-1', dateFacture: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 123456, nature: 'prestation' }] }]
  }));
  await t.pause(300);
  const l = t.$('#ana-corps .ligne-ca .ca-montants');
  verifierVrai('la ligne est là', !!l);
  verifier('ses montants ne se coupent pas', 'nowrap', t.w.getComputedStyle(l).whiteSpace);
  verifierVrai('le chiffre qui compte, puis d’où il vient',
    /61 728 €\s*sur 123 456 €/.test(l.textContent.replace(/ /g, ' ')));
  verifier('aucune erreur', [], t.erreurs);
});

/* ====================================================== LE CADRE (lot 5a) */
/* La refonte change les chemins, pas les écrans. Ces scénarios vérifient le
   nouveau cadre (barre du bas, +, ☰, bandeau, pastilles) en le croisant avec
   ce qui existait avant : l'inventaire des écrans écrit en 4.85, et les
   portes de création d'origine, restées en place. */
const INVENTAIRE = fs.readFileSync(path.join(__dirname, '..', 'docs', 'inventaire-ecrans.md'), 'utf8')
  .split(/\r?\n/);
/* Le tableau « Les modules et leurs onglets » : nom, onglets dans l'ordre,
   arrivée par défaut. */
function modulesInventaire() {
  const debut = INVENTAIRE.findIndex(l => /^### Les modules et leurs onglets/.test(l));
  const lignes = [];
  for (let i = debut + 1; i < INVENTAIRE.length && !/^###/.test(INVENTAIRE[i]); i++) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/.exec(INVENTAIRE[i]);
    if (!m || m[1] === 'Module' || /^-+$/.test(m[1])) continue;
    lignes.push({ nom: m[1], onglets: m[2].split(' · '), arrivee: m[3] });
  }
  return lignes;
}
/* Les onglets dont le retrait est accepté (section 12 de la table), lus dans
   la section de leur module : « ## 4. Calendrier → Agenda » puis
   « | Onglet Carnet | … | retrait accepté (31/10, R1) | ». Seuls ceux-là
   peuvent manquer aux pastilles, et chacun doit rester joignable ailleurs. */
function ongletsRetires() {
  const TABLE = fs.readFileSync(path.join(__dirname, '..', 'docs', 'correspondance-refonte.md'), 'utf8').split(/\r?\n/);
  const r = {};
  let module = null;
  for (const l of TABLE) {
    const t = /^## \d+\. (\S+) →/.exec(l);
    if (t) { module = t[1]; continue; }
    if (/^## /.test(l)) { module = null; continue; }
    const o = /^\| Onglet ([^|]+?) \|.*retrait accepté[^|]*\|$/.exec(l);
    if (module && o) (r[module] = r[module] || []).push(o[1]);
  }
  return r;
}
/* Les pastilles renommées ou déplacées depuis l'inventaire (lot b2), lues
   dans la table de correspondance : « | Chantiers | Carnet | Liste | » renomme,
   « | Calendrier | Carte | Chantiers, après Liste | » déplace. Lot d1 :
   « | Finances | — | TVA, nouvelle après Mois | » ajoute une pastille,
   « | Finances | Charges fixes | bloc de Dépenses | » la fond dans une autre. */
function changementsPastilles() {
  const TABLE = fs.readFileSync(path.join(__dirname, '..', 'docs', 'correspondance-refonte.md'), 'utf8').split(/\r?\n/);
  const debut = TABLE.findIndex(l => /^### Pastilles renommées ou déplacées/.test(l));
  const out = [];
  for (let i = debut + 1; debut >= 0 && i < TABLE.length && !/^#/.test(TABLE[i]); i++) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/.exec(TABLE[i]);
    if (!m || m[1] === 'Module' || /^-+$/.test(m[1])) continue;
    const nv = /^(.+), nouvelle après (.+)$/.exec(m[3]);
    if (nv) { out.push({ module: m[1], avant: null, apres: nv[1], vers: null, apresDe: nv[2], nouvelle: true }); continue; }
    const bl = /^bloc de (.+)$/.exec(m[3]);
    if (bl) { out.push({ module: m[1], avant: m[2], apres: null, vers: null, apresDe: null, bloc: bl[1] }); continue; }
    const d = /^(\S+), après (.+)$/.exec(m[3]);
    out.push({ module: m[1], avant: m[2], apres: d ? m[2] : m[3], vers: d ? d[1] : null, apresDe: d ? d[2] : null });
  }
  return out;
}
/* Ce que les pastilles d'un module doivent montrer : l'inventaire, moins les
   retraits acceptés, renommages et déplacements appliqués. Une pastille seule
   ne s'affiche pas (l'Agenda depuis le lot b2). */
function pastillesAttendues(m) {
  const partis = ongletsRetires()[m.nom] || [], ch = changementsPastilles();
  let l = [];
  m.onglets.filter(o => partis.indexOf(o) < 0).forEach(o => {
    const c = ch.filter(x => x.module === m.nom && x.avant === o)[0];
    if (!c) l.push(o); else if (!c.vers && !c.bloc) l.push(c.apres);
  });
  ch.filter(x => x.vers === m.nom).forEach(x => { l.splice(l.indexOf(x.apresDe) + 1, 0, x.apres); });
  ch.filter(x => x.nouvelle && x.module === m.nom).forEach(x => { l.splice(l.indexOf(x.apresDe) + 1, 0, x.apres); });
  return l;
}
function arriveeAttendue(m) {
  const c = changementsPastilles().filter(x => x.module === m.nom && x.avant === m.arrivee && !x.vers)[0];
  return c ? c.apres : m.arrivee;
}
/* Les sous-niveaux : « - **Synthèses** (Cubage) : Synthèse · Financière… ». */
function sousNiveauxInventaire() {
  const debut = INVENTAIRE.findIndex(l => /^### Les sous-niveaux/.test(l));
  const lignes = [];
  for (let i = debut + 1; i < INVENTAIRE.length && !/^###/.test(INVENTAIRE[i]); i++) {
    const m = /^- \*\*(.+?)\*\*(?: \((.+?)\))? : (.+?)$/.exec(INVENTAIRE[i]);
    if (!m) continue;
    const items = m[3].replace(/\s*\(voir [^)]*\)/, '').replace(/\.$/, '').split(' · ');
    lignes.push({ onglet: m[1], module: m[2] || null, items });
  }
  return lignes;
}
/* Les trois modules de la barre portent un autre nom qu'avant : la table de
   correspondance (§ 1) dit Calendrier → Agenda, Finances → Argent. Les autres
   se trouvent dans le ☰, sous leur nom. */
const BARRE_DE_MODULE = { Chantiers: 'chantiers', Calendrier: 'agenda', Finances: 'argent' };
async function allerAuModule(t, nom) {
  if (BARRE_DE_MODULE[nom]) return parBarre(t, BARRE_DE_MODULE[nom]);
  t.clic('#b-menu'); await t.pause(150);
  const tuile = t.$$('#modale [data-menu]').filter(b => b.querySelector('b') &&
    b.querySelector('b').textContent.trim() === nom)[0];
  if (!tuile) { t.clic('#modale-x'); return false; }
  tuile.click(); await t.pause(350);
  return true;
}
const pastilles = t => t.$$('#onglets button').map(b => b.textContent.replace(/\s+/g, ' ').trim());
const pastilleOuverte = t => t.$$('#onglets button')
  .filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.textContent.trim());
/* Ce qu'une fenêtre montre : son titre et les champs qu'elle porte. Deux
   portes vers le même formulaire donnent la même signature. */
const signatureFenetre = t => (t.$('#modale').hidden ? null :
  t.texte('#modale-titre') + ' | ' + t.$$('#modale-corps [id]').map(e => e.id).sort().join(','));

/* --------------------------------------------------------------------- */
scenario('Cadre : le démarrage mène à Aujourd’hui, l’entreprise signe dessous', async () => {
  /* Le module ouvert la dernière fois reste en mémoire (Finances ici) : il
     ne décide pas de l'arrivée, qui se fait toujours sur Aujourd'hui. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances',
    cfg: { nomEntreprise: 'Forêts du Levant' } }));
  verifierVrai('l’écran de démarrage est là', t.$('#demarrage'));
  verifierVrai('il porte le nom de l’entreprise sous celui de Sylve',
    !t.$('#dem-ent').hidden && /Forêts du Levant/.test(t.texte('#dem-ent')) &&
    (t.$('.dem-nom').compareDocumentPosition(t.$('#dem-ent')) & 4));
  verifier('on arrive sur Aujourd’hui', 'vue-accueil', vueActive(t));
  verifier('le bandeau le dit', 'Aujourd’hui', t.texte('#b-ecran'));
  verifier('l’onglet Aujourd’hui est marqué', ['aujourdhui'], ongletMarque(t));
  verifierVrai('pas de flèche de retour', t.$('#b-retour').hidden);
  verifierVrai('pas de pastilles de module', t.d.body.classList.contains('accueil-ouvert'));
  verifier('le module en mémoire n’a pas bougé', 'finances', t.stock('module'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cadre : la barre du bas sur tous les écrans, l’onglet courant marqué', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [], maj: Date.now() }] }));
  const vus = [];
  const constater = (ou, attendu) => {
    const b = t.$('#barre');
    const ok = !!b && !b.hidden && !b.closest('[hidden]') && !b.closest('main') &&
      t.$$('#barre [data-barre]').length === 5;
    vus.push(ou);
    verifier(ou + ' : la barre est là, « ' + attendu + ' » marqué', [true, [attendu]], [ok, ongletMarque(t)]);
  };
  /* Mon entreprise, qui suivait, est parti au lot 5b. */
  constater('Aujourd’hui', 'aujourdhui');
  const tour = async (onglet, nom) => {
    await parBarre(t, onglet);
    for (const v of t.$$('#onglets button').map(b => b.dataset.vue)) {
      t.clic('#onglets [data-vue="' + v + '"]'); await t.pause(200);
      constater(nom + ' ▸ ' + v, onglet);
    }
  };
  await tour('chantiers', 'Chantiers');
  t.clic('[data-chouvrir="c1"]'); await t.pause(250);
  constater('la fiche ouverte du carnet', 'chantiers');
  await tour('agenda', 'Agenda');
  await tour('argent', 'Argent');
  /* Un écran du ☰ garde marqué l'onglet d'où l'on est parti : c'est là que
     le retour ramènera. */
  for (const m of ['stock', 'achats', 'vehicule', 'rendements', 'cubage', 'bois', 'reglages']) {
    await parMenu(t, m);
    constater('☰ ▸ ' + m + ', ouvert depuis Argent', 'argent');
    if (m === 'reglages') continue;
    for (const v of t.$$('#onglets button').map(b => b.dataset.vue)) {
      t.clic('#onglets [data-vue="' + v + '"]'); await t.pause(150);
      constater('☰ ▸ ' + m + ' ▸ ' + v, 'argent');
    }
  }
  verifierVrai('tous les écrans ont été parcourus (' + vus.length + ')', vus.length > 30);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cadre : chaque entrée du + ouvre le formulaire qui existait déjà', async () => {
  /* Le + n'invente aucun formulaire : chaque entrée doit ouvrir exactement
     celui de l'ancienne porte, restée en place — même titre, mêmes champs. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'stock',
    articles: [{ id: 'a1', nom: 'Tuteur', type: 'tuteur', unite: 'unite', mouvements: [], maj: Date.now() }] }));
  t.clic('#barre [data-barre="plus"]'); await t.pause(200);
  verifier('la feuille s’appelle « Ajouter »', 'Ajouter', t.texte('#modale-titre'));
  const libelles = sel => t.$$(sel).map(b => b.textContent.replace(/\s+/g, ' ').trim());
  verifier('Quotidien : Ma journée, Dépense, Chantier, Note',
    ['Ma journéele plus fréquent', 'Dépensecarburant, achat', 'Chantieron m’en a parlé', 'Notepense-bête'],
    libelles('#modale .fn-ajout [data-plus]'));
  verifier('Plus rare : commande, achat, intervention, charge fixe',
    ['Commande de fournitures', 'Achat à prévoir', 'Noter une intervention', 'Charge fixe'],
    libelles('#modale .fn-puces [data-plus]'));
  verifierVrai('ni pile ni bordereau', !/Pile|Bordereau/i.test(t.texte('#modale')));
  t.clic('#modale-x'); await t.pause(150);

  /* Lot 5b : « Enregistrer ma journée » est devenu la ligne de saisie
     d'Aujourd'hui, qui ouvre la même fenêtre. Le « + note » de Mon entreprise
     est parti avec lui (table § 2 : créer une note, c'est + ▸ Note) : on
     garde la signature que sa fenêtre avait, relevée au lot 5a quand les deux
     portes coexistaient. */
  const ancienne = {
    journee: '#aj-jour', depense: '#dep-nouvelle', chantier: null, note: null,
    commande: '#cmd-nouvelle', achat: '#ach-plus', intervention: '#vh-plus', charge: '#chg-nouvelle'
  };
  const SIGNATURE_PLUS_NOTE = 'Une note à moi-même | nt-couls,nt-ok,nt-titre';
  /* La création de chantier est devenue la feuille courte (lot b2, table
     § 6) et son bouton de la page est parti : sa signature est écrite ici. */
  const SIGNATURES = { note: SIGNATURE_PLUS_NOTE, chantier: 'Nouveau chantier | ce-com,ce-date-changer,ce-date-z,' +
    'ce-donneur,ce-donneur-offre,ce-foret,ce-nom-apercu,ce-note,ce-ok,ce-proprio,ce-proprio-offre,ce-qte,ce-qte-champ,ce-qte-l,ce-trav' };
  verifier('le « + note » de Mon entreprise est bien parti', null, t.$('#ent-note-plus'));
  for (const cle of Object.keys(ancienne)) {
    /* La porte du véhicule n'est dessinée qu'à l'ouverture de son carnet. */
    if (cle === 'intervention') await parMenu(t, 'vehicule');
    let avant = SIGNATURES[cle];
    if (ancienne[cle]) {
      verifierVrai(cle + ' : l’ancienne porte est toujours là', t.clic(ancienne[cle]));
      await t.pause(300);
      avant = signatureFenetre(t);
      t.clic('#modale-x'); await t.pause(150);
    }
    t.clic('#barre [data-barre="plus"]'); await t.pause(200);
    t.clic('#modale [data-plus="' + cle + '"]'); await t.pause(300);
    const apres = signatureFenetre(t);
    verifierVrai(cle + ' : une fenêtre s’ouvre', apres);
    verifier(cle + ' : la même que par l’ancienne porte', avant, apres);
    t.clic('#modale-x'); await t.pause(150);
  }
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cadre : chaque entrée du ☰ ouvre le bon écran, avec son chiffre', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    index: [{ id: 'b1', vol: 12.5, nb: 3, meta: { foret: 'Haut' } },
      { id: 'b2', vol: 3.25, nb: 1, meta: { foret: 'Bas' } }] }));
  const vus = [];
  t.w.Element.prototype.scrollIntoView = function () { vus.push(this); };
  t.clic('#b-menu'); await t.pause(200);
  verifier('la feuille s’appelle « Le reste de Sylve »', 'Le reste de Sylve', t.texte('#modale-titre'));
  verifier('ses deux groupes', ['Entreprise', 'Outils de terrain'], t.$$('#modale .fn-sous').map(p => p.textContent));
  verifier('dans l’ordre de la maquette',
    ['stock', 'achats', 'vehicule', 'rendements', 'cubage', 'bois', 'notes', 'reglages', 'sauvegarde', 'corbeille'],
    t.$$('#modale [data-menu]').map(b => b.dataset.menu));
  /* Le chiffre de situation : deux bordereaux de 12,5 et 3,25 m³. */
  const cub = t.$('#modale [data-menu="cubage"]');
  verifierVrai('la tuile Cubage porte son chiffre', /15,75 m³/.test(cub.textContent));
  verifierVrai('et sa phrase', /2 bordereaux/.test(cub.textContent));
  verifierVrai('chaque tuile dit quelque chose', t.$$('#modale .fn-tuiles button')
    .every(b => b.querySelector('small') && b.querySelector('small').textContent.trim()));
  t.clic('#modale-x'); await t.pause(150);

  const attendus = { stock: 'vue-stock2', achats: 'vue-achats', vehicule: 'vue-carnetv',
    rendements: 'vue-rendements', cubage: 'vue-fichiers', bois: 'vue-stock', notes: 'vue-notes', reglages: 'vue-reglages' };
  for (const m of Object.keys(attendus)) {
    await parMenu(t, m);
    verifier('☰ ▸ ' + m + ' ouvre son écran', attendus[m], vueActive(t));
    verifierVrai('☰ ▸ ' + m + ' : la feuille s’est refermée', t.$('#modale').hidden);
    if (m !== 'reglages') verifier('☰ ▸ ' + m + ' : le module est retenu', m, t.stock('module'));
  }
  /* Sauvegarde et Corbeille ouvrent pour l'instant l'endroit d'avant, en
     attendant leurs écrans (lot f). */
  vus.length = 0;
  await parMenu(t, 'sauvegarde');
  verifier('Sauvegarde ouvre les réglages', 'vue-reglages', vueActive(t));
  verifierVrai('sur Général, carte Sauvegarde visible', !t.$('#c-sauvegarde').hidden &&
    t.$('[data-regl="general"]').getAttribute('aria-pressed') === 'true');
  verifierVrai('et y descend', vus.some(e => e.dataset && e.dataset.sous === 'sauvegarde'));
  verifierVrai('la corbeille reste fermée', t.$('#s-recup').hidden);
  await parMenu(t, 'corbeille');
  verifier('Corbeille ouvre les réglages', 'vue-reglages', vueActive(t));
  verifierVrai('corbeille dépliée', !t.$('#s-recup').hidden && /Ce que vous supprimez arrive ici/.test(t.texte('#s-recup')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cadre : les pastilles reprennent les onglets de l’inventaire', async () => {
  /* Noms, ordre et arrivée lus dans le tableau de l'inventaire des écrans,
     écrit en 4.85 avant toute refonte : une pastille perdue, renommée ou
     déplacée fait crier ce contrôle. */
  const mods = modulesInventaire();
  verifier('l’inventaire porte ses neuf modules', 9, mods.length);
  const t = await ouvrir(VIDE);
  for (const m of mods) {
    verifierVrai(m.nom + ' : joignable par la barre ou le ☰', await allerAuModule(t, m.nom));
    const partis = ongletsRetires()[m.nom] || [], att = pastillesAttendues(m), seule = att.length < 2;
    verifier(m.nom + ' : mêmes pastilles, même ordre' + (partis.length ? ' (moins ' + partis.join(', ') + ', retrait accepté)' : ''),
      seule ? [] : att, pastilles(t));
    verifier(m.nom + ' : même arrivée', seule ? [] : [arriveeAttendue(m)], pastilleOuverte(t));
    /* Aucune mémoire de la dernière pastille, comme avant : on repart de
       l'arrivée. */
    const autre = t.$$('#onglets button').filter(b => b.getAttribute('aria-selected') !== 'true')[0];
    if (autre) { autre.click(); await t.pause(200); }
    await parBarre(t, 'aujourdhui');
    await allerAuModule(t, m.nom);
    verifier(m.nom + ' : au retour, de nouveau l’arrivée', seule ? [] : [arriveeAttendue(m)], pastilleOuverte(t));
    await parBarre(t, 'aujourdhui');
  }
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cadre : rien de l’inventaire des écrans ne s’est perdu', async () => {
  /* L'inventaire de non-perte. Chaque écran, onglet et sous-niveau listé en
     4.85 doit s'ouvrir depuis le nouveau cadre, en partant d'Aujourd'hui. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [], maj: Date.now() }] }));
  const faits = [];
  /* Accueil → Aujourd'hui. Mon entreprise est parti au lot 5b : ce que
     portaient les deux écrans est prouvé élément par élément par « Cadre :
     chaque élément de l'accueil et de Mon entreprise a son nouvel endroit ». */
  await parBarre(t, 'chantiers'); await parBarre(t, 'aujourdhui');
  verifier('Accueil : l’onglet Aujourd’hui l’ouvre', 'vue-accueil', vueActive(t));
  /* Mes notes ont quitté Aujourd'hui pour le ☰ au lot r1. */
  await parMenu(t, 'notes');
  verifierVrai('Mes notes : par le ☰', vueActive(t) === 'vue-notes' && t.$('#vue-notes #aj-notes'));
  await parMenu(t, 'reglages');
  verifier('Réglages : par le ☰', 'vue-reglages', vueActive(t));

  const mods = modulesInventaire();
  for (const m of mods) {
    await parBarre(t, 'aujourdhui');
    verifierVrai(m.nom + ' : joignable', await allerAuModule(t, m.nom));
    const partis = ongletsRetires()[m.nom] || [];
    for (const o of partis) {
      /* Un onglet parti avec son accord : sa fonction reste sous le même nom
         dans un autre module (R1 : le Carnet est l'écran de Chantiers). */
      const ailleurs = mods.filter(x => x.nom !== m.nom && x.onglets.indexOf(o) >= 0).map(x => x.nom);
      verifierVrai(m.nom + ' ▸ ' + o + ' : retrait accepté, la fonction reste dans ' + ailleurs.join(', '), ailleurs.length);
    }
    /* Une pastille partie dans un autre module y est cherchée sous son nom. */
    for (const c of changementsPastilles().filter(x => x.module === m.nom && x.vers)) {
      verifierVrai(m.nom + ' ▸ ' + c.avant + ' : passée dans ' + c.vers, pastillesAttendues(mods.filter(x => x.nom === c.vers)[0]).indexOf(c.avant) >= 0);
    }
    /* Une pastille fondue dans une autre (lot d1) : on ouvre l'autre, et le
       bloc y porte son nom en titre. */
    for (const c of changementsPastilles().filter(x => x.module === m.nom && x.bloc)) {
      const b = t.$$('#onglets button').filter(x => x.textContent.trim() === c.bloc)[0];
      if (b) { b.click(); await t.pause(200); }
      const titres = t.$$('main > .vue.actif h2').map(h => h.textContent.trim());
      verifierVrai(m.nom + ' ▸ ' + c.avant + ' : un bloc de ' + c.bloc, !!b && titres.some(x => x.indexOf(c.avant) === 0));
      faits.push(m.nom + ' ▸ ' + c.avant);
    }
    for (const o of pastillesAttendues(m).filter(x => pastillesAttendues(m).length > 1)) {
      const b = t.$$('#onglets button').filter(x => x.textContent.trim() === o)[0];
      if (!b) { verifierVrai(m.nom + ' ▸ ' + o + ' : pastille présente', false); continue; }
      b.click(); await t.pause(200);
      verifier(m.nom + ' ▸ ' + o + ' s’ouvre', 'vue-' + b.dataset.vue, vueActive(t));
      faits.push(m.nom + ' ▸ ' + o);
    }
  }
  /* Les sous-niveaux à l'intérieur d'un onglet. */
  for (const s of sousNiveauxInventaire()) {
    await parBarre(t, 'aujourdhui');
    let ici;
    if (!s.module) { await parMenu(t, 'reglages'); ici = '#vue-reglages'; }
    else {
      const m = mods.filter(x => x.nom.indexOf(s.module) === 0)[0];
      await allerAuModule(t, m.nom);
      const ren = changementsPastilles().filter(x => x.module === m.nom && x.avant === s.onglet && !x.vers && !x.bloc)[0];
      const p = t.$$('#onglets button').filter(x => x.textContent.trim() === (ren ? ren.apres : s.onglet))[0];
      if (p) { p.click(); await t.pause(250); }
      ici = 'main > .vue.actif';
    }
    for (const it of s.items) {
      const cherche = () => t.$$(ici + ' button').filter(x => x.textContent.trim() === it)[0];
      const b = cherche();
      if (!b) { verifierVrai(s.onglet + ' ▸ ' + it + ' : présent', false); continue; }
      b.click(); await t.pause(200);
      const apres = cherche();
      verifierVrai(s.onglet + ' ▸ ' + it + ' s’ouvre', apres &&
        (apres.getAttribute('aria-selected') === 'true' || apres.getAttribute('aria-pressed') === 'true'));
      faits.push(s.onglet + ' ▸ ' + it);
    }
  }
  verifierVrai('tout l’inventaire a été parcouru (' + faits.length + ')', faits.length >= 40);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cadre : le bandeau titre l’écran et garde ses actions propres', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [], maj: Date.now() }] }));
  verifierVrai('plus de sélecteur de partie', !t.$('#b-module') && !t.$('.bandeau select'));
  verifierVrai('le ☰ est en haut à droite',
    t.$('.bandeau-in').lastElementChild === t.$('#b-menu'));
  verifierVrai('pas d’action propre sur Aujourd’hui', t.$('#b-ctx').hidden);
  await parBarre(t, 'chantiers');
  verifier('Chantiers', 'Chantiers', t.texte('#b-ecran'));
  t.clic('[data-chouvrir="c1"]'); await t.pause(250);
  verifier('la fiche', 'Chantier', t.texte('#b-ecran'));
  await parBarre(t, 'agenda');
  verifier('Agenda', 'Agenda', t.texte('#b-ecran'));
  /* Lot c1 : le « Aujourd’hui » du bandeau doublait celui d'à côté de ‹ › ;
     il n'en reste qu'un, dans la page. */
  verifierVrai('le « Aujourd’hui » de l’Agenda est dans la page, plus dans le bandeau',
    !t.$('#b-aujourdhui') && /Aujourd’hui|Aujourd'hui/.test(t.texte('#cal-auj') || ''));
  await parBarre(t, 'argent');
  verifier('Argent', 'Argent', t.texte('#b-ecran'));
  await parMenu(t, 'cubage');
  verifier('Cubage', 'Cubage', t.texte('#b-ecran'));
  verifierVrai('l’En-tête du cubage est gardé', /En-tête/.test(t.texte('#b-entete2') || ''));
  verifierVrai('et sa seconde ligne aussi', t.d.body.classList.contains('m-cubage') &&
    !t.d.body.classList.contains('accueil-ouvert') && t.$('#b-bordereau.mod-cubage'));
  await parMenu(t, 'reglages');
  verifier('Réglages', 'Réglages', t.texte('#b-ecran'));
  await parBarre(t, 'aujourdhui');
  /* Sur Aujourd'hui, la seconde ligne du bordereau est masquée par une règle
     (jsdom ne résout pas getComputedStyle sur ce sélecteur). */
  const regles = [];
  for (const f of t.d.styleSheets) for (const r of f.cssRules || []) if (r.selectorText) regles.push([r.selectorText, r.style.display]);
  verifierVrai('la ligne du bordereau ne déborde pas sur Aujourd’hui',
    regles.some(r => /\.accueil-ouvert #b-bordereau/.test(r[0]) && r[1] === 'none'));
  verifier('aucune erreur', [], t.erreurs);
});

/* ================================================= AUJOURD'HUI (lot 5b) */
/* L'écran d'arrivée remplace l'ancien accueil et Mon entreprise. Ces
   scénarios le vérifient bloc par bloc, et ligne par ligne : chaque ligne
   d'En retard et de Bientôt paraît dans son cas, se masque jusqu'au
   lendemain, mène au bon endroit, et tombe une fois la chose réglée. */
const JA = n => { const d = new Date(Date.now() + n * 86400000); d.setHours(12, 0, 0, 0); return d.getTime(); };
const moisAvant = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setMonth(d.getMonth() - n); return d.getTime(); };
const chA = (id, champs) => Object.assign({ id, nom: 'Chantier ' + id, lignes: [], temps: [], maj: Date.now() }, champs);
const posteV = dernierDate => ({ infos: {}, releves: [], interventions: [], seme: true,
  postes: [{ id: 'p1', nom: 'Contrôle technique', pmois: 12, dernierDate }] });

/* Une sorte de ligne par cas : ses données, son bloc, ce qu'elle dit, où
   elle mène, et comment on la règle. « reglee » rend soit une action sur
   l'application ouverte, soit des données réglées à rouvrir. */
const LIGNES_AUJ = [
  /* Lot r1 : En retard ne porte plus que trois sortes de lignes ; la
     sauvegarde, le stock et le véhicule sont repliés dans « Autres rappels ».
     Les jours à trancher, « À programmer », « N jours prévus » et « Devis à
     faire » ne sont plus des lignes : la journée d'office, la ligne du
     chantier et l'étape Devis de la fiche les ont remplacés. */
  { nom: 'facture à faire', bloc: 'retard', cle: () => 'afacturer:c1',
    graines: { chantiers: [chA('c1', { nom: 'Vaux', commune: 'Vaux', statut: 'termine', dateFin: JA(-20),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] })] },
    dit: /Facture à faire.*1 000 €.*terminé il y a 20 j/,
    mene: t => vueActive(t) === 'vue-chantier' && /Vaux/.test(t.texte('#vue-chantier')),
    regler: async t => { t.w.BCUI._setChantier('c1', { statut: 'facture', dateFacture: Date.now() }); await t.pause(400); } },
  { nom: 'facture impayée', bloc: 'retard', cle: () => 'impaye:c1',
    graines: { chantiers: [chA('c1', { nom: 'Vaux', commune: 'Vaux', statut: 'facture', numeroFacture: 'F-1', dateFacture: JA(-60),
      echeancePaiement: JA(-10), lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] })] },
    dit: /Facture impayée.*1 000 €.*échue depuis 10 j/,
    mene: t => vueActive(t) === 'vue-chantier' && /Vaux/.test(t.texte('#vue-chantier')),
    regler: async t => { t.w.BCUI._setChantier('c1', { statut: 'paye', datePaiement: Date.now() }); await t.pause(400); } },
  { nom: 'relancer le devis', bloc: 'retard', cle: () => 'relancer:c1',
    graines: { chantiers: [chA('c1', { nom: 'Vaux', commune: 'Vaux', statut: 'envoye', aDevis: true, dateEnvoi: JA(-40),
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1000, prix: 1, nature: 'prestation' }] })] },
    dit: /Relancer le devis \?.*Vaux.*1 000 €.*devis expiré le \d\d\/\d\d\/\d{4}, sans réponse/,
    mene: t => vueActive(t) === 'vue-chantier' && /Vaux/.test(t.texte('#vue-chantier')),
    regler: async t => { t.w.BCUI._setChantier('c1', { statut: 'accepte', dateSignature: Date.now() }); await t.pause(400); } },
  { nom: 'échéance du véhicule dépassée', bloc: 'autres', cle: () => 'vehicule:p1',
    graines: { vehicule: posteV(moisAvant(14)) },
    dit: /Contrôle technique.*Véhicule · échéance dépassée/,
    mene: t => vueActive(t) === 'vue-echeancesv',
    reglee: { vehicule: posteV(Date.now()) } },
  { nom: 'sauvegarde à faire', bloc: 'autres', cle: () => 'sauvegarde',
    graines: { export: Date.now() - 45 * 86400000, chantiers: [chA('c1', { statut: 'encours' })] },
    dit: /Sauvegarde à faire.*il y a 1 mois.*1 chantier.*Sauvegarder/,
    mene: t => vueActive(t) === 'vue-reglages' && !t.$('#c-sauvegarde').hidden,
    /* Le fichier part par un lien de téléchargement, que jsdom ne sait pas
       suivre : on neutralise le clic sur le lien, pas la sauvegarde. */
    regler: async t => { t.w.HTMLAnchorElement.prototype.click = function () {};
      t.clic('#s-tout'); await t.pause(600); } },
  { nom: 'à recommander', bloc: 'autres', cle: () => 'stock',
    graines: { articles: [{ id: 'a1', nom: 'Gaine', type: 'protection', unite: 'unite', seuil: 100, maj: Date.now(),
      mouvements: [{ sens: 'entree', qte: 50, prix: 1, date: JA(-10) }] }] },
    dit: /À recommander : 1 fourniture.*Gaine \(sous le seuil\)/,
    mene: t => vueActive(t) === 'vue-stock2',
    reglee: { articles: [{ id: 'a1', nom: 'Gaine', type: 'protection', unite: 'unite', seuil: 100, maj: Date.now(),
      mouvements: [{ sens: 'entree', qte: 500, prix: 1, date: JA(-10) }] }] } },
  { nom: 'échéance du véhicule proche', bloc: 'autres', cle: () => 'vehicule:p1',
    graines: { vehicule: posteV(moisAvant(11)) },
    dit: /Contrôle technique.*Véhicule · échéance proche/,
    mene: t => vueActive(t) === 'vue-echeancesv',
    reglee: { vehicule: posteV(Date.now()) } }
];
LIGNES_AUJ.forEach(c => scenario('Aujourd’hui : la ligne « ' + c.nom + ' » paraît, se masque, mène, et tombe', async () => {
  const graines = Object.assign({}, VIDE, c.graines);
  const cle = c.cle();
  const t = await ouvrir(graines);
  const l = ligneAuj(t, cle);
  verifierVrai('elle paraît dans « ' + (c.bloc === 'retard' ? 'En retard' : 'Autres rappels') + ' »',
    l && l.closest('#aj-' + c.bloc));
  verifierVrai('elle dit ce qu’il faut : ' + texteLignes(t, cle), c.dit.test(texteLignes(t, cle)));
  /* Le × la masque jusqu'au lendemain : relancée le même jour, elle reste
     cachée ; le lendemain, le masque de la veille ne vaut plus. */
  t.clic('[data-ajmasque="' + cle + '"]'); await t.pause(250);
  verifierVrai('son × la masque', !ligneAuj(t, cle));
  verifier('jusqu’au lendemain : le masque porte le jour', t.w.BCC.jourCle(Date.now()), (t.stock('masques') || {})[cle]);
  const meme = await ouvrir(Object.assign({}, graines, { masques: t.stock('masques') }));
  verifierVrai('relancée le même jour, elle reste masquée', !ligneAuj(meme, cle));
  const hier = {}; hier[cle] = t.w.BCC.jourCle(Date.now() - 86400000);
  const lend = await ouvrir(Object.assign({}, graines, { masques: hier }));
  verifierVrai('le lendemain, elle revient', ligneAuj(lend, cle));
  /* Elle mène là où la chose se fait. */
  await appuyerLigne(lend, cle);
  verifierVrai('un appui ouvre le bon endroit', c.mene(lend));
  /* Réglée, elle tombe. */
  let apres = lend;
  if (c.regler) await c.regler(lend);
  else apres = await ouvrir(Object.assign({}, VIDE, c.reglee));
  verifierVrai('une fois réglée, elle tombe', !ligneAuj(apres, cle));
  verifier('aucune erreur', [], t.erreurs.concat(meme.erreurs, lend.erreurs, apres.erreurs));
}));

/* --------------------------------------------------------------------- */
scenario('Aujourd’hui : l’ordre du lot r1, En retard en trois sortes, le reste replié', async () => {
  /* A1 à A4, validés le 03/11 : date · Ma journée · En retard (s'il y a
     quelque chose) · Chantiers en cours · Prélèvements à venir · Derniers
     jours · « Autres rappels (N) », replié. En retard : les factures échues,
     les chantiers terminés pas facturés, les devis sans réponse à 7 jours ou
     moins de la fin de leur validité — et rien d'autre. Lot r1b : le devis
     n'y entre que le jour même de la fin de sa validité, sans préavis. */
  const t0 = await ouvrir(VIDE);
  const C0 = t0.w.BCC;
  /* Une date de devis valable un mois dont la fin tombe dans « reste » jours,
     cherchée avec la règle de l'application (les mois n'ont pas tous trente
     jours). */
  const devisFinissantDans = reste => {
    for (let k = -45; k < 0; k++) {
      const f = C0.finValiditeDevis({ aDevis: true, dateDevis: JA(k), validiteDevis: 1 });
      if (Math.round((f - C0.minuit(Date.now())) / 86400000) === reste) return JA(k);
    }
    return null;
  };
  const dv = (id, reste) => {
    const d = devisFinissantDans(reste);
    return chA(id, { nom: 'Devis ' + id, statut: 'envoye', aDevis: true, dateDevis: d, dateEnvoi: d, validiteDevis: 1 });
  };
  const dans = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
  const t = await ouvrir(Object.assign({}, VIDE, {
    export: Date.now() - 45 * 86400000,
    vehicule: posteV(moisAvant(14)),
    articles: [{ id: 'a1', nom: 'Gaine', type: 'protection', unite: 'unite', seuil: 100, maj: Date.now(),
      mouvements: [{ sens: 'entree', qte: 50, prix: 1, date: JA(-10) }] }],
    chantiers: [
      dv('d1', 1), dv('d0', 0), dv('dx', -3),
      chA('imp', { nom: 'Impayé', statut: 'facture', numeroFacture: 'F-1', dateFacture: JA(-60), echeancePaiement: JA(-10) }),
      chA('fac', { nom: 'À facturer', statut: 'termine', dateFin: JA(-5) }),
      chA('ret', { nom: 'Sans jour devant', statut: 'encours', dateEntree: JA(-30), jours: [{ d: JA(-5), p: 1 }] }),
      chA('dem', { nom: 'Posé demain', statut: 'accepte', aDevis: true, dateEntree: JA(-10), jours: [{ d: JA(1), p: 1 }] }),
      chA('info', { nom: 'Annoncé', statut: 'devis', aDevis: true, dateEntree: JA(-4) }),
      chA('paye', { nom: 'Payé', statut: 'paye', datePaiement: JA(-2) }),
      chA('ss', { nom: 'Sans suite', statut: 'sansuite', aDevis: true })],
    journees: [{ id: 'j1', date: JA(-2), chantier: 'dem', postes: [{ travaux: 'PLANT', heures: 8, quantite: 0 }] }],
    charges: [{ id: 'h1', libelle: 'Assurance', ttc: 412, periodicite: 'mensuel', categorie: 'ASSUR', taux: 0,
      debut: dans(2).getTime(), jour: dans(2).getDate(), moisReference: dans(2).getMonth() }],
    cfg: { notes: [{ id: 'n1', titre: 'Courses', couleur: '#B4231F', items: [] }] }
  }));
  verifierVrai('les dates des devis se trouvent', devisFinissantDans(0) && devisFinissantDans(1));
  const ids = ['aj-date', 'aj-saisie', 'aj-retard', 'aj-encours', 'aj-prelevements', 'aj-jours', 'aj-autres'];
  const ordre = t.$$('#vue-accueil [id^="aj-"]').map(e => e.id).filter(i => ids.indexOf(i) >= 0);
  verifier('dans l’ordre de la maquette', ids, ordre);
  verifier('plus de Bientôt ni de Mes notes', [null, null], [t.$('#aj-bientot'), t.$('#vue-accueil #aj-notes')]);
  verifier('les intitulés', ['En retard', 'Chantiers en cours', 'Prélèvements à venir', 'Derniers jours'],
    t.$$('#vue-accueil .aj-sous').map(h => h.childNodes[0].textContent.trim()));
  verifier('la date du jour en tête', t.w.document.querySelector('#aj-date').textContent.split(' ')[1],
    String(new Date().getDate()));
  /* En retard : trois sortes, dans cet ordre, et rien d'autre. */
  const retard = t.$$('#aj-retard [data-ajcle]').map(l => l.dataset.ajcle);
  verifier('impayé, à facturer, puis les devis (le plus pressant d’abord)',
    ['impaye:imp', 'afacturer:fac', 'relancer:dx', 'relancer:d0'], retard);
  verifierVrai('rien que ces trois sortes', retard.every(k => /^(impaye|afacturer|relancer):/.test(k)));
  verifierVrai('un devis à 1 jour de la fin n’y est pas, le jour même il y est', !ligneAuj(t, 'relancer:d1') && ligneAuj(t, 'relancer:d0'));
  verifier('plus de préavis', undefined, C0.PREAVIS_DEVIS);
  /* Autres rappels : repliés, avec le même lien qu'avant. */
  const au = t.$('#aj-autres');
  verifierVrai('« Autres rappels (3) », replié', au && !au.open && /Autres rappels \(3\)/.test(au.querySelector('summary').textContent));
  verifier('la sauvegarde, le stock et le véhicule', ['sauvegarde', 'stock', 'vehicule:p1'],
    t.$$('#aj-autres [data-ajcle]').map(l => l.dataset.ajcle));
  /* Chantiers en cours : par étape, le plus ancien en haut ; ni payé ni sans suite. */
  verifier('par étape, le plus ancien en haut', ['info', 'dx', 'd0', 'd1', 'ret', 'dem', 'fac', 'imp'],
    t.$$('#aj-encours [data-ajch]').map(b => b.dataset.ajch));
  verifier('un intertitre par étape', ['Infos et repérage', 'Devis', 'Travaux', 'Facture', 'Paiement'],
    t.$$('#aj-encours .aj-etape').map(p => p.textContent));
  verifier('le compte', '8', t.texte('#aj-encours .aj-compte'));
  const ligne = id => (t.$('#aj-encours [data-ajch="' + id + '"]') || {}).textContent || '';
  verifierVrai('« posé demain » sur la ligne du chantier', /posé demain/.test(ligne('dem')));
  verifierVrai('« plus de jour posé » sur celle qui n’a plus rien devant', /plus de jour posé/.test(ligne('ret')));
  verifierVrai('« devis à faire · pas encore repéré » à l’étape Infos', /Devis à faire · annoncé il y a 4 j · pas encore repéré/.test(ligne('info')));
  verifierVrai('ce qui est en retard est en rouge sur sa ligne',
    t.$('#aj-encours [data-ajch="imp"] .aj-situ.aj-alerte') && !t.$('#aj-encours [data-ajch="d8"] .aj-situ.aj-alerte'));
  /* Un appui ouvre la fiche à l'étape en cours. */
  t.clic('#aj-encours [data-ajch="dem"]'); await t.pause(400);
  verifierVrai('un appui ouvre la fiche, à l’étape en cours', vueActive(t) === 'vue-chantier' &&
    /Posé demain/.test(t.texte('#vue-chantier')) && t.$('#vue-chantier details.fi-etape[data-etape="2"][open]'));
  verifier('aucune erreur', [], t.erreurs.concat(t0.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Aujourd’hui : rien en retard, pas de bloc En retard', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { export: Date.now(),
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours' })] }));
  verifier('pas de bloc', null, t.$('#aj-retard'));
  verifierVrai('une phrase le dit', /Rien en retard/.test(t.texte('#aj-calme')));
  verifier('pas d’autres rappels non plus', null, t.$('#aj-autres'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Aujourd’hui : « À recommander » compte le réservé, et le ☰ dit le même chiffre (S2)', async () => {
  /* Trois produits : un sous son seuil, un au-dessus de son seuil mais dont
     les chantiers signés prennent plus qu'il n'en reste, un tranquille. */
  const art = (id, nom, seuil, mv) => ({ id, nom, type: 'protection', unite: 'unite', seuil, maj: Date.now(), mouvements: mv });
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'accepte' })],
    articles: [
      art('a1', 'Gaine', 100, [{ sens: 'entree', qte: 50, prix: 1, date: JA(-10) }]),
      art('a2', 'Tuteur', 50, [{ sens: 'entree', qte: 200, prix: 1, date: JA(-10) },
        { sens: 'sortie', etat: 'engage', qte: 300, chantier: 'c1', date: JA(-1) }]),
      art('a3', 'Répulsif', 10, [{ sens: 'entree', qte: 500, prix: 1, date: JA(-10) }])]
  }));
  const dit = texteLignes(t, 'stock');
  verifierVrai('une seule ligne pour toutes : ' + dit, lignesAuj(t, 'stock').length === 1 &&
    /À recommander : 2 fournitures/.test(dit));
  verifierVrai('chacune avec sa raison', /Gaine \(sous le seuil\)/.test(dit) && /Tuteur \(il en manque 100 u\)/.test(dit));
  verifierVrai('le tranquille n’y est pas', !/Répulsif/.test(dit));
  verifier('le calcul le dit aussi', ['a1', 'a2'], t.w.BCS2.aRecommander(t.stock('articles')).map(x => x.article.id));
  t.clic('#b-menu'); await t.pause(200);
  verifierVrai('le ☰ dit le même chiffre', /2 à recommander/.test(t.texte('#modale [data-menu="stock"]')));
  t.clic('#modale-x'); await t.pause(150);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche de chantier : ouverte depuis une fiche, elle y revient', async () => {
  /* Tranché le 31/10 : la pastille « Fiche de chantier » ouverte depuis une
     fiche revient à cette fiche (← et retour du téléphone). Ouverte par la
     pastille du carnet, elle revient aux Chantiers, comme avant. */
  const t = await ouvrir(Object.assign({}, VIDE, { chantiers: [
    chA('c1', { nom: 'Vaux', statut: 'encours' }), chA('c2', { nom: 'Combe', statut: 'encours' })] }));
  const retour = () => t.w.dispatchEvent(new t.w.PopStateEvent('popstate'));
  await parBarre(t, 'chantiers');
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  const crans = t.w.history.length;
  t.clic('#onglets [data-vue="fichech"]'); await t.pause(300);
  verifier('la pastille ouvre la Fiche de chantier', 'vue-fichech', vueActive(t));
  /* Un étage de plus que la fiche : sans ce cran, le retour du téléphone
     sortirait de Sylve un appui trop tôt. */
  verifier('elle empile un cran de plus que la fiche', crans + 1, t.w.history.length);
  verifierVrai('la flèche nomme la fiche', /Fiche/.test(t.texte('#b-retour')) && !/Chantiers/.test(t.texte('#b-retour')));
  t.clic('#b-retour'); await t.pause(300);
  verifier('← revient à la fiche', 'vue-chantier', vueActive(t));
  verifierVrai('celle du chantier d’où l’on venait', /Vaux/.test(t.texte('#vue-chantier')));
  /* Le bouton de la fiche, puis le retour du téléphone. */
  t.clic('#f-fichech'); await t.pause(400);
  verifier('le bouton de la fiche ouvre la Fiche de chantier', 'vue-fichech', vueActive(t));
  retour(); await t.pause(300);
  verifier('le retour du téléphone revient à la fiche', 'vue-chantier', vueActive(t));
  retour(); await t.pause(300);
  verifier('puis aux Chantiers', 'vue-carnet', vueActive(t));
  retour(); await t.pause(300);
  verifier('puis à Aujourd’hui', 'vue-accueil', vueActive(t));
  /* Par le carnet, rien ne change. */
  await parBarre(t, 'chantiers');
  t.clic('#onglets [data-vue="fichech"]'); await t.pause(300);
  verifierVrai('depuis le carnet, la flèche nomme les Chantiers', /Chantiers/.test(t.texte('#b-retour')));
  t.clic('#b-retour'); await t.pause(300);
  verifier('et y revient', 'vue-carnet', vueActive(t));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Pictogrammes : une notion, un dessin', async () => {
  /* Tranché le 31/10 : Aujourd'hui = ☀, Ma journée = horloge, Chantiers =
     carnet, Carte = épingle. Le ☀ du bouton « Enregistrer ma journée » et
     l'épingle de la tuile Chantiers faisaient doublon : ils sont partis. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  const dessin = s => { const e = t.$(s); return e ? e.innerHTML : null; };
  const soleil = dessin('#barre [data-barre="aujourdhui"] svg');
  const carnet = dessin('#barre [data-barre="chantiers"] svg');
  verifierVrai('Aujourd’hui porte le soleil', /circle cx="12" cy="12" r="4"/.test(soleil || ''));
  verifierVrai('la ligne de saisie porte l’horloge', /r="8.5"/.test(dessin('#aj-jour svg') || ''));
  t.clic('#barre [data-barre="plus"]'); await t.pause(200);
  const horloge = dessin('#modale [data-plus="journee"] svg');
  const chantier = dessin('#modale [data-plus="chantier"] svg');
  t.clic('#modale-x'); await t.pause(150);
  verifier('+ ▸ Ma journée : la même horloge', dessin('#aj-jour svg'), horloge);
  verifierVrai('qui n’est pas le soleil', horloge !== soleil);
  verifier('+ ▸ Chantier : le carnet de la barre', carnet, chantier);
  /* La carte est une pastille de Chantiers depuis le lot b2. */
  await parBarre(t, 'chantiers');
  const epingle = dessin('#onglets [data-vue="carte"] svg');
  verifierVrai('la Carte : l’épingle', /M12 20.6/.test(epingle || ''));
  verifierVrai('qui n’est plus celle de Chantiers', epingle !== carnet);
  verifierVrai('plus aucun ☀ écrit en caractère', !/☀/.test(t.d.body.textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Le tableau « Où sont allés l'accueil et Mon entreprise (lot 5b) » de
   l'inventaire : élément, nouvel endroit, clé de preuve. */
function retraits5b() {
  const debut = INVENTAIRE.findIndex(l => /^### Où sont allés l'accueil et Mon entreprise/.test(l));
  const lignes = [];
  for (let i = debut + 1; debut >= 0 && i < INVENTAIRE.length && !/^###/.test(INVENTAIRE[i]); i++) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*`([a-z-]+)`\s*\|$/.exec(INVENTAIRE[i]);
    if (m) lignes.push({ element: m[1], endroit: m[2], cle: m[3] });
  }
  return lignes;
}
scenario('Cadre : chaque élément de l’accueil et de Mon entreprise a son nouvel endroit', async () => {
  /* L'inventaire de non-perte du lot 5b. Chaque ligne du tableau de
     l'inventaire dit où est passé un élément des deux écrans retirés ; sa
     clé désigne la preuve, jouée ici depuis Aujourd'hui. Une ligne sans
     preuve, ou une preuve sans ligne, fait crier ce contrôle. */
  const graines = Object.assign({}, VIDE, {
    export: Date.now() - 45 * 86400000,
    index: [{ id: 'b1', vol: 12.5, nb: 3, meta: { foret: 'Haut' } }],
    chantiers: [
      chA('c1', { nom: 'Vaux', statut: 'accepte', aDevis: true, joursEstimes: 4,
        jours: [{ d: JA(-1), p: 1 }, { d: JA(1), p: 1 }] }),
      chA('c2', { nom: 'Marchand', statut: 'envoye', aDevis: true, dateEnvoi: JA(-40) }),
      chA('c3', { commune: 'Montjoie', statut: 'facture', numeroFacture: 'F-9', dateFacture: JA(-70), donneur: 'Cabinet Dubois',
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 900, nature: 'prestation' }] }),
      chA('c4', { nom: 'Essarts', statut: 'encours' })],
    depenses: [{ id: 'd1', date: Date.now(), lignes: [{ libelle: 'Gasoil', categorie: 'CONSO', ttc: 120, taux: 20 }] }],
    charges: [{ id: 'h1', libelle: 'Assurance', ttc: 412, periodicite: 'mensuel', categorie: 'ASSUR', taux: 0,
      debut: JA(2), jour: new Date(JA(2)).getDate(), moisReference: new Date(JA(2)).getMonth() }],
    articles: [{ id: 'a1', nom: 'Gaine', type: 'protection', unite: 'unite', maj: Date.now(), mouvements: [] }],
    vehicule: posteV(moisAvant(14)),
    cfg: { nomEntreprise: 'Forêts du Levant', officeDepuis: JA(-5), notes: [{ id: 'n1', titre: 'Courses', couleur: '#B4231F',
      items: [{ id: 'i1', texte: 'gants', fait: false }] }] }
  });
  const t = await ouvrir(graines);
  const auj = async () => { if (!t.$('#modale').hidden) { t.clic('#modale-x'); await t.pause(150); } await parBarre(t, 'aujourdhui'); };
  const menu = async (cle, vue) => { await parMenu(t, cle); return vueActive(t) === vue; };
  const FIN = t.w.BCF, C = t.w.BCC, E = t.w.BC;
  const eur = v => E.fmt(C.arr(v, 2), v % 1 ? 2 : 0).replace(/ /g, ' ') + ' €';
  const anBornes = () => FIN.bornes('annee', new Date().getFullYear(), 0);
  const PREUVES = {
    'demarrage-marque': async () => !!t.$('#demarrage .dem-logo') && t.texte('.dem-nom') === 'Sylve' && !!t.texte('.dem-sous'),
    'demarrage-entreprise': async () => !t.$('#dem-ent').hidden && /Forêts du Levant/.test(t.texte('#dem-ent')),
    'menu-reglages': async () => menu('reglages', 'vue-reglages'),
    'autres-sauvegarde': async () => !!t.$('#aj-autres [data-ajcle="sauvegarde"]') &&
      await appuyerLigne(t, 'sauvegarde') && vueActive(t) === 'vue-reglages' && !t.$('#c-sauvegarde').hidden,
    /* Le jour posé hier compte d'office : Derniers jours le montre, sa fiche
       propose de le préciser ou de dire qu'on n'y était pas. */
    'office': async () => { const b = t.$('#aj-jours [data-ajouvre="jour:' + C.minuit(JA(-1)) + '"]');
      if (!b || !/○/.test(b.textContent)) return false;
      b.click(); await t.pause(450);
      return !!t.$('#fj-preciser') && !!t.$('#fj-nonla') && /Comptée d’office/.test(t.texte('#fj-office')); },
    'prelevements': async () => /Assurance/.test(t.texte('#aj-prelevements')) &&
      await appuyerLigne(t, lignesAuj(t, 'prelevement:')[0].dataset.ajcle) && vueActive(t) === 'vue-depenses' &&
      defile(t) === 'dep-charges',
    'retard-relancer': async () => /Relancer le devis/.test(texteLignes(t, 'relancer:c2')) &&
      !!t.$('#aj-retard [data-ajcle="relancer:c2"]') &&
      await appuyerLigne(t, 'relancer:c2') && /Marchand/.test(t.texte('#vue-chantier')),
    'encours-compte': async () => t.texte('#aj-encours .aj-compte') === String(C.filtre(t.stock('chantiers'), 'ouverts').length) &&
      await parBarre(t, 'chantiers') && vueActive(t) === 'vue-carnet',
    'saisie-ligne': async () => /aujourd’hui/.test(t.texte('#aj-saisie')) && /Cette semaine/.test(t.texte('#aj-saisie')),
    'saisie-journee': async () => { t.clic('#aj-jour'); await t.pause(300); return t.texte('#modale-titre') === 'Ma journée'; },
    'plus-journee': async () => { t.clic('#barre [data-barre="plus"]'); await t.pause(200);
      t.clic('#modale [data-plus="journee"]'); await t.pause(300); return t.texte('#modale-titre') === 'Ma journée'; },
    'menu-outils': async () => await menu('cubage', 'vue-fichiers') && await menu('bois', 'vue-stock'),
    'barre-aujourdhui': async () => { await parBarre(t, 'chantiers'); await parBarre(t, 'aujourdhui'); return vueActive(t) === 'vue-accueil'; },
    'fiche-placer': async () => { t.w.BCUI._ouvrirChantier('c1', 'travaux'); await t.pause(350);
      if (!t.$('#f-planifier')) return false;
      t.clic('#f-planifier'); await t.pause(400);
      const ok = vueActive(t) === 'vue-calendrier' && /Vaux/.test(t.texte('#cal-planif') || '');
      t.clic('#cal-planif-fin'); await t.pause(400);
      return ok; },
    'encours-signe': async () => /Signé · à programmer/.test(t.texte('#aj-encours [data-ajch="c1"]') || ''),
    'encours-bloc': async () => { t.clic('#aj-encours [data-ajouvre="fiche:c4"]'); await t.pause(400);
      return vueActive(t) === 'vue-chantier' && /Essarts/.test(t.texte('#vue-chantier')); },
    'retard-impaye': async () => /Facture impayée.*Montjoie.*Cabinet Dubois/.test(texteLignes(t, 'impaye:c3')) &&
      await appuyerLigne(t, 'impaye:c3') && /Montjoie/.test(t.texte('#vue-chantier')),
    /* Lot d1 : Argent ▸ Mois ▸ À ce jour, toutes périodes ; le chiffre
       d'affaires de l'année dans Année, celui du mois dans Mois ; la TVA
       déductible dans l'onglet TVA, sur l'année. */
    'argent-attente': async () => { const a = FIN.chiffreAffaires(t.stock('chantiers')).aEncaisser;
      await parBarre(t, 'argent');
      return a > 0 && sansBlancs(t.texte('#mo-attente')).indexOf(sansBlancs('Facturé, pas encore payé')) === 0 &&
        sansBlancs(t.texte('#mo-attente')).slice(-sansBlancs(eur(a)).length) === sansBlancs(eur(a)); },
    'argent-ca': async () => { const ca = FIN.chiffreAffaires(t.stock('chantiers'), anBornes()).total;
      const d = new Date(), caM = FIN.chiffreAffaires(t.stock('chantiers'), FIN.bornes('mois', d.getFullYear(), d.getMonth())).total;
      await parBarre(t, 'argent');
      const mois = sansBlancs(t.texte('#mo-ca [data-mo="ca"]')) === sansBlancs(eur(caM));
      t.clic('[data-vue="analyses"]'); await t.pause(200); t.clic('[data-ana="ensemble"]'); await t.pause(200);
      return mois && (!ca || sansBlancs(t.texte('#ana-corps')).indexOf(sansBlancs(eur(ca) + 'facturé HT')) >= 0); },
    'argent-tva': async () => { const d = FIN.balanceTva(t.stock('chantiers'), t.stock('depenses'), anBornes(), C.tauxLigne).deductible.total;
      await parBarre(t, 'argent'); t.clic('[data-vue="tva"]'); await t.pause(200);
      return d > 0 && sansBlancs(t.texte('#tva-corps [data-tva="deductible"]')) === sansBlancs('− ' + eur(d)); },
    'encours-pose': async () => /posé demain/.test(t.texte('#aj-encours [data-ajch="c1"]') || ''),
    'barre-modules': async () => { const vues = [];
      for (const o of ['chantiers', 'agenda', 'argent']) { await parBarre(t, o); vues.push(vueActive(t)); }
      return vues.join() === 'vue-carnet,vue-calendrier,vue-finances'; },
    'menu-entreprise': async () => await menu('stock', 'vue-stock2') && await menu('achats', 'vue-achats') &&
      await menu('vehicule', 'vue-carnetv') && await menu('rendements', 'vue-rendements'),
    'autres-recommander': async () => { const n = !!t.$('#aj-autres [data-ajcle="stock"]') &&
      /À recommander : (\d+)/.exec(texteLignes(t, 'stock'));
      t.clic('#b-menu'); await t.pause(200);
      return !!n && new RegExp(n[1] + ' à recommander').test(t.texte('#modale [data-menu="stock"]')); },
    'autres-vehicule': async () => !!t.$('#aj-autres [data-ajcle="vehicule:p1"]') &&
      /échéance dépassée/.test(texteLignes(t, 'vehicule:p1')) &&
      await appuyerLigne(t, 'vehicule:p1') && vueActive(t) === 'vue-echeancesv',
    'menu-notes': async () => { await parMenu(t, 'notes'); const z = t.$('#vue-notes #aj-notes');
      return vueActive(t) === 'vue-notes' && !!z && !t.$('#vue-accueil #aj-notes') && !!z.querySelector('[data-note="n1"]') &&
        !!z.querySelector('[data-notesup="n1"]') && !!z.querySelector('[data-nt-coche="i1"]') &&
        !!z.querySelector('[data-nt-supitem="i1"]') && !!z.querySelector('[data-nt-ajout="n1"]'); },
    'plus-note': async () => { await plusNote(t); return t.texte('#modale-titre') === 'Une note à moi-même'; },
    /* En dernier dans le tableau : la ligne chassée ne sert plus aux autres. */
    'masquer': async () => { const k = 'relancer:c2';
      t.clic('[data-ajmasque="' + k + '"]'); await t.pause(250);
      return !ligneAuj(t, k) && (t.stock('masques') || {})[k] === C.jourCle(Date.now()); }
  };
  const lignes = retraits5b();
  verifierVrai('l’inventaire porte le tableau du lot 5b (' + lignes.length + ' lignes)', lignes.length >= 20);
  const sansPreuve = lignes.filter(l => !PREUVES[l.cle]).map(l => l.cle);
  verifier('chaque ligne a sa preuve', [], sansPreuve);
  const sansLigne = Object.keys(PREUVES).filter(k => !lignes.some(l => l.cle === k));
  verifier('chaque preuve a sa ligne', [], sansLigne);
  for (const l of lignes) {
    if (!PREUVES[l.cle]) continue;
    await auj();
    verifierVrai(l.element + ' → ' + l.endroit, await PREUVES[l.cle]());
  }
  verifier('plus d’écran Mon entreprise ni d’ancien accueil', [null, null, null],
    [t.$('#vue-entreprise'), t.$('#a-reglages'), t.$('#vue-accueil .tuile')]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Le tableau « Où sont allés les éléments d'Aujourd'hui et de l'Agenda
   (lot r1) » de l'inventaire : élément, nouvel endroit, clé de preuve. */
function retraitsR1() {
  const debut = INVENTAIRE.findIndex(l => /^### Où sont allés les éléments d'Aujourd'hui et de l'Agenda/.test(l));
  const lignes = [];
  for (let i = debut + 1; debut >= 0 && i < INVENTAIRE.length && !/^###/.test(INVENTAIRE[i]); i++) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*`([a-z0-9-]+)`\s*\|$/.exec(INVENTAIRE[i]);
    if (m) lignes.push({ element: m[1], endroit: m[2], cle: m[3] });
  }
  return lignes;
}
scenario('Inventaire r1 : chaque élément d’Aujourd’hui et de l’Agenda a sa place, sauf les retraits du 03/11', async () => {
  /* « Rien ne disparaît, sauf les retraits acceptés le 03/11. » Chaque ligne
     du tableau a sa preuve, jouée ici ; un retrait se prouve par son absence. */
  const t0 = await ouvrir(VIDE);
  const C = t0.w.BCC;
  const graines = Object.assign({}, VIDE, {
    export: Date.now() - 45 * 86400000,
    vehicule: posteV(moisAvant(14)),
    articles: [{ id: 'a1', nom: 'Gaine', type: 'protection', unite: 'unite', seuil: 100, maj: Date.now(),
      mouvements: [{ sens: 'entree', qte: 50, prix: 1, date: JA(-10) }] }],
    chantiers: [
      chA('imp', { nom: 'Impayé', statut: 'facture', numeroFacture: 'F-1', dateFacture: JA(-60), echeancePaiement: JA(-10) }),
      chA('fac', { nom: 'À facturer', statut: 'termine', dateFin: JA(-5) }),
      chA('dv', { nom: 'Devis', statut: 'envoye', aDevis: true, dateEnvoi: JA(-40) }),
      chA('ret', { nom: 'Sans jour devant', statut: 'encours', dateEntree: JA(-30), jours: [{ d: JA(-12), p: 1 }] }),
      chA('dem', { nom: 'Posé demain', statut: 'accepte', aDevis: true, joursEstimes: 5, dateEntree: JA(-20),
        jours: [{ d: JA(-1), p: 1 }, { d: JA(1), p: 1 }] }),
      chA('info', { nom: 'Annoncé', statut: 'devis', aDevis: true, dateEntree: JA(-4) })],
    journees: [{ id: 'j1', date: JA(-3), chantier: 'dem', personnes: 1, nonProd: 7, postes: [] }],
    charges: [{ id: 'h1', libelle: 'Assurance', ttc: 412, periodicite: 'mensuel', categorie: 'ASSUR', taux: 0,
      debut: JA(-40), jour: new Date(JA(2)).getDate(), moisReference: new Date(JA(2)).getMonth() }],
    cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: JA(-10),
      notes: [{ id: 'n1', titre: 'Courses', couleur: '#B4231F', items: [{ id: 'i1', texte: 'gants', fait: false }] }] }
  });
  const t = await ouvrir(graines);
  const auj = async () => { if (!t.$('#modale').hidden) { t.clic('#modale-x'); await t.pause(150); } await parBarre(t, 'aujourdhui'); };
  const agenda = async () => { if (!t.$('#modale').hidden) { t.clic('#modale-x'); await t.pause(150); } await parBarre(t, 'agenda'); };
  const ligneCh = id => (t.$('#aj-encours [data-ajch="' + id + '"]') || {}).textContent || '';
  const fermer = async () => { if (!t.$('#modale').hidden) { t.clic('#modale-x'); await t.pause(150); } };
  const PREUVES = {
    'r1-saisie': async () => { const h = t.$('#aj-haut'); if (!h || h.firstElementChild.id !== 'aj-saisie') return false;
      t.clic('#aj-jour'); await t.pause(300); return t.texte('#modale-titre') === 'Ma journée'; },
    'r1-retard': async () => t.$$('#aj-retard [data-ajcle]').map(l => l.dataset.ajcle).join() === 'impaye:imp,afacturer:fac,relancer:dv',
    'r1-office': async () => { const b = t.$('#aj-jours [data-ajouvre="jour:' + C.minuit(JA(-1)) + '"]');
      if (!b || !/○/.test(b.textContent)) return false;
      b.click(); await t.pause(450);
      return /Comptée d’office/.test(t.texte('#fj-office') || '') && !!t.$('#fj-preciser') && !!t.$('#fj-nonla'); },
    'r1-plusdejour': async () => /plus de jour posé/.test(ligneCh('ret')),
    'r1-autres': async () => { const a = t.$('#aj-autres');
      return !!a && !a.open && t.$$('#aj-autres [data-ajcle]').map(l => l.dataset.ajcle).join() === 'sauvegarde,stock,vehicule:p1' &&
        await appuyerLigne(t, 'stock') && vueActive(t) === 'vue-stock2'; },
    'r1-pose': async () => /posé demain/.test(ligneCh('dem')),
    'r1-devisafaire': async () => /Devis à faire · annoncé il y a 4 j · pas encore repéré/.test(ligneCh('info')),
    /* Lot r1b : en retard le jour même de la fin de validité, sans préavis. */
    'r1-devis0': async () => {
      const a = reste => { for (let k = -45; k < 0; k++) {
        const ch = { id: 'x', statut: 'envoye', aDevis: true, dateDevis: JA(k), validiteDevis: 1 };
        if (Math.round((C.finValiditeDevis(ch) - C.minuit(Date.now())) / 86400000) === reste) {
          return C.alertes([ch], {}, Date.now()).filter(x => x.type === 'devis').length; } } return -1; };
      return a(0) === 1 && a(1) === 0 && a(7) === 0 && a(-2) === 1; },
    /* Lot r1b : le jour posé hier compte d'office, pas encore vu : la bulle le dit. */
    'r1b-bulle': async () => !!t.$('#aj-bulle [data-ajboffice]') && /Sylve l’a compté/.test(t.texte('#aj-bulle') || '') &&
      !!t.$('#aj-bulle #ajb-ok'),
    'r1-notes': async () => { await parMenu(t, 'notes');
      return vueActive(t) === 'vue-notes' && !!t.$('#vue-notes [data-note="n1"]'); },
    'r1-encours': async () => { const e = t.$$('#aj-encours .aj-etape').map(p => Number(p.dataset.etape));
      return e.length >= 4 && e.every((x, i) => !i || x > e[i - 1]); },
    'r1-prelevements': async () => /Assurance/.test(t.texte('#aj-prelevements') || ''),
    'r1-derniers': async () => t.$$('#aj-jours [data-ajouvre^="journee:"]').length >= 1 &&
      t.$$('#aj-jours [data-ajouvre^="jour:"]').length >= 1 && !!t.$('#aj-jours [data-ajouvre="agenda:"]'),
    'r1-grille': async () => { await agenda();
      return t.$$('#cal-grille [data-jour]').length >= 28 && !!t.$('#cal-prec') && !!t.$('#cal-auj') && !!t.$('#cal-suiv') &&
        !!t.$('#cal-grille .cal-prel'); },
    'r1-legende': async () => { await agenda();
      return !!t.texte('#cal-legende') && /prélèvement/.test(t.texte('#cal-leg2') || ''); },
    'r1-compteurs': async () => { await agenda();
      return t.$$('#cal-charge .carte2 small').map(s => s.textContent).join() === 'fait,posé (signé),non travaillé'; },
    'r1-histo': async () => { await agenda(); return /Ce mois-ci, jour par jour/.test(t.texte('#cal-histo')); },
    'r1-fiche': async () => { await agenda();
      await cliquerJour(t, JA(1));
      const pose = !!t.$('#fj-deplacer') && !!t.$('#fj-poser') && !!t.$('#fj-absent'); await fermer();
      await cliquerJour(t, JA(-3));
      const fait = t.texte('#fj-travaille') === 'Modifier ma journée'; await fermer();
      await cliquerJour(t, JA(0));
      const libre = t.texte('#fj-travaille') === 'Saisir ma journée'; await fermer();
      await cliquerJour(t, JA(2));
      const prel = /Prélevé ce jour-là/.test(t.texte('#modale')); await fermer();
      return pose && fait && libre && prel; },
    'r1-placement': async () => { t.w.BCUI._ouvrirChantier('dem', 'travaux'); await t.pause(350);
      t.clic('#f-planifier'); await t.pause(400);
      if (!t.$('#cal-planif-fin')) return false;
      const avant = (t.stock('journees') || []).length;
      await cliquerJour(t, JA(-6), 500);
      const ok = (t.stock('journees') || []).length === avant + 1;
      t.clic('#cal-planif-fin'); await t.pause(400);
      return ok && vueActive(t) === 'vue-chantier'; },
    'r1-bulle': async () => { await agenda(); await appuiLong(t, JA(3), 'souris');
      const n = t.$$('#cal-bulle [data-bulle]').length;
      t.clic('#cal-bulle [data-bulle="abs"]'); await t.pause(300); await fermer();
      return n === 3; },
    /* Les retraits du 03/11 : plus nulle part. */
    'r1-x-aplacer': async () => !/à placer|estimez et placez|pas d’estimation|temps à estimer/.test(t.texte('#vue-accueil')),
    'r1-x-aprogrammer': async () => { await agenda();
      return !t.$('#cal-aplanifier') && !t.$('#cal-aprog') && !/À programmer/.test(t.texte('#vue-calendrier')); },
    'r1-x-trancher-agenda': async () => { await agenda();
      return !t.$('#cal-trancher') && !t.$('#cal-trancher-btn') && !t.$('#cal-grille .cal-q') && !/trancher/.test(t.texte('#vue-calendrier')); },
    'r1-x-trancher-fiche': async () => { await agenda(); await cliquerJour(t, JA(-12));
      const ok = !t.$('.fj-etat.st-trancher') && !t.$('#fj-prevu') && !t.$('#fj-tout') && !t.$('#fj-autrement') &&
        !/Que s’est-il passé|à trancher/i.test(t.texte('#modale'));
      await fermer(); return ok; },
    'r1-x-trancher-auj': async () => !t.$('[data-ajcle^="trancher:"]') && !/non saisie/.test(t.texte('#vue-accueil')),
    'r1-x-notes-auj': async () => !t.$('#vue-accueil #aj-notes') && !/Mes notes/.test(t.texte('#vue-accueil')),
    /* En dernier : la ligne chassée ne sert plus aux autres. */
    'r1-masquer': async () => { const k = 'impaye:imp';
      t.clic('[data-ajmasque="' + k + '"]'); await t.pause(250);
      return !ligneAuj(t, k) && (t.stock('masques') || {})[k] === C.jourCle(Date.now()); }
  };
  const lignes = retraitsR1();
  verifierVrai('l’inventaire porte le tableau du lot r1 (' + lignes.length + ' lignes)', lignes.length >= 25);
  verifier('chaque ligne a sa preuve', [], lignes.filter(l => !PREUVES[l.cle]).map(l => l.cle));
  verifier('chaque preuve a sa ligne', [], Object.keys(PREUVES).filter(k => !lignes.some(l => l.cle === k)));
  verifier('les retraits, et eux seuls, sont dits « retiré (03/11) »', [],
    lignes.filter(l => /^r1-x-/.test(l.cle) !== /^retiré/.test(l.endroit)).map(l => l.cle));
  /* Le × en dernier, quel que soit l'ordre du tableau. */
  const ordre = lignes.filter(l => l.cle !== 'r1-masquer').concat(lignes.filter(l => l.cle === 'r1-masquer'));
  for (const l of ordre) {
    if (!PREUVES[l.cle]) continue;
    await auj();
    verifierVrai(l.element + ' → ' + l.endroit, await PREUVES[l.cle]());
  }
  verifier('aucune erreur', [], t.erreurs.concat(t0.erreurs));
});

/* --------------------------------------------------------------------- */
/* Lot 5b2 (4.87.1) : les remontées tranchées le 31/10. */
scenario('Facture à faire : dès le lendemain de « Terminé », pas le jour même', async () => {
  const lig = [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }];
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [
      chA('c1', { nom: 'Ce matin', commune: 'Ce matin', statut: 'termine', dateFin: JA(0), lignes: lig }),
      chA('c2', { nom: 'Hier', commune: 'Hier', statut: 'termine', dateFin: JA(-1), lignes: lig }),
      chA('c3', { nom: 'Il y a dix jours', commune: 'Dix jours', statut: 'termine', dateFin: JA(-10), lignes: lig })]
  }));
  const al = t.w.BCC.alertes(t.stock('chantiers'), t.stock('cfg') || {}, Date.now())
    .filter(a => a.type === 'afacturer');
  verifier('l’alerte du carnet : hier et avant, pas ce matin', ['c2', 'c3'],
    al.map(a => a.chantier.id).sort());
  verifierVrai('« 1 jour » au singulier', /terminé il y a 1 jour, pas/.test(al.filter(a => a.chantier.id === 'c2')[0].texte));
  verifierVrai('Aujourd’hui : la ligne d’hier est là', !!ligneAuj(t, 'afacturer:c2'));
  verifierVrai('et celle d’il y a dix jours', !!ligneAuj(t, 'afacturer:c3'));
  verifierVrai('mais pas celle du jour même', !ligneAuj(t, 'afacturer:c1'));
  /* Les deux écrans disent la même chose : le carnet l'a dans « À traiter ». */
  await parBarre(t, 'chantiers'); t.clic('[data-vue="carnet"]'); await t.pause(300);
  const at = t.texte('[data-groupe="faire"]') || '';
  verifierVrai('« À faire maintenant » nomme Hier', /Hier/.test(at));
  verifierVrai('et ne nomme pas Ce matin', !/Ce matin/.test(at));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Mois ▸ À ce jour : « à facturer » dit combien, et mène à « À faire maintenant »', async () => {
  /* Lot d1 : le total du 5b2 passe dans « À ce jour » ; un terminé sans
     ligne chiffrée se dit « sans montant » au lieu de compter 0 € en
     silence, et l'appui ouvre le groupe de Chantiers, plus le filtre replié. */
  const lig = p => [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: p, nature: 'prestation' }];
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [
      chA('c1', { nom: 'Vaux', commune: 'Vaux', statut: 'termine', dateFin: JA(-3), lignes: lig(1000) }),
      chA('c2', { nom: 'Marchand', commune: 'Marchand', statut: 'termine', dateFin: JA(-1), lignes: lig(500) }),
      chA('c3', { nom: 'Sans ligne', commune: 'Sans ligne', statut: 'termine', dateFin: JA(-1) }),
      chA('c4', { nom: 'Déjà parti', commune: 'Déjà parti', statut: 'facture', numeroFacture: 'F-1', dateFacture: JA(-5), lignes: lig(900) }),
      chA('c6', { nom: 'Échue', commune: 'Échue', statut: 'facture', numeroFacture: 'F-2', dateFacture: JA(-40),
        echeancePaiement: JA(-10), lignes: lig(300) }),
      chA('c5', { nom: 'Encore à faire', commune: 'Encore à faire', statut: 'encours', lignes: lig(700) })]
  }));
  const C = t.w.BCC, E = t.w.BC;
  const somme = C.arr(t.stock('chantiers').filter(c => c.statut === 'termine')
    .reduce((s, c) => s + C.montant(c), 0), 2);
  verifier('la somme attendue (les lignes des terminés)', 1500, somme);
  await parBarre(t, 'argent');
  const af = sansBlancs(t.texte('#mo-afacturer'));
  const attendu = sansBlancs('À facturer3 chantiers · dont 1 sans montant' + E.fmt(somme, 0) + ' €');
  verifier('À ce jour dit combien, et le sans montant', attendu, af);
  verifierVrai('sous un titre qui dit qu’il ne suit pas le mois', /^À ce jour · quel que soit le mois affiché/.test(t.texte('#mo-ajour')));
  /* Facturé, pas encore payé : toutes périodes, l'échue comptée à part. */
  const FIN = t.w.BCF;
  const enAtt = FIN.chiffreAffaires(t.stock('chantiers')).aEncaisser;
  verifier('ce qui attend son paiement, toutes périodes', 1200, enAtt);
  verifier('Facturé, pas encore payé : deux factures, dont une impayée',
    sansBlancs('Facturé, pas encore payé2 factures · dont 1 impayée' + E.fmt(enAtt, 0) + ' €'), sansBlancs(t.texte('#mo-attente')));
  t.clic('#mo-afacturer'); await t.pause(450);
  verifier('un appui ouvre Chantiers', 'vue-carnet', vueActive(t));
  verifier('sur « À faire maintenant »', 'faire', defile(t));
  verifierVrai('qui nomme les terminés d’hier et d’avant', ['Vaux', 'Marchand', 'Sans ligne']
    .every(n => new RegExp(n).test(t.texte('[data-groupe="faire"]'))));
  verifierVrai('l’ancien filtre replié n’est plus ouvert pour ça', !t.$('#ch-filtre-bloc').open);
  await parBarre(t, 'argent');
  t.clic('#mo-attente'); await t.pause(450);
  verifier('« pas encore payé » ouvre Chantiers', 'vue-carnet', vueActive(t));
  verifier('sur « Facturés · attendent le paiement »', 'factures', defile(t));
  verifierVrai('qui porte la facture pas échue', !!t.$('[data-groupe="factures"] [data-chouvrir="c4"]'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Mois ▸ À ce jour : rien à facturer, pas de ligne', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours' })]
  }));
  await parBarre(t, 'argent');
  verifierVrai('pas de ligne « À facturer »', !t.$('#mo-afacturer') && !/À facturer\d/.test(sansBlancs(t.texte('#mo-ajour'))));
  verifierVrai('le bloc le dit en clair', /Rien à facturer/.test(t.texte('#mo-ajour')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Stock : « à recommander » compte le réservé, comme Aujourd’hui et le ☰ (S2)', async () => {
  const art = (id, nom, seuil, mv) => ({ id, nom, type: 'protection', unite: 'unite', seuil, maj: Date.now(), mouvements: mv });
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'accepte' })],
    articles: [
      art('a1', 'Gaine', 100, [{ sens: 'entree', qte: 50, prix: 1, date: JA(-10) }]),
      art('a2', 'Tuteur', 50, [{ sens: 'entree', qte: 200, prix: 1, date: JA(-10) },
        { sens: 'sortie', etat: 'engage', qte: 300, chantier: 'c1', date: JA(-1) }]),
      art('a3', 'Répulsif', 10, [{ sens: 'entree', qte: 500, prix: 1, date: JA(-10) }])]
  }));
  const nAuj = /À recommander : (\d+)/.exec(texteLignes(t, 'stock'));
  t.clic('#b-menu'); await t.pause(200);
  const nMenu = /(\d+) à recommander/.exec(t.texte('#modale [data-menu="stock"]'));
  t.clic('#modale-x'); await t.pause(150);
  await parMenu(t, 'stock');
  const kpi = t.texte('#stock-resume .kpi');
  const nStock = /(\d+)\s*à recommander/.exec(kpi);
  verifierVrai('les trois comptes existent', !!nAuj && !!nMenu && !!nStock);
  verifier('Stock dit 2', '2', nStock && nStock[1]);
  verifier('le même chiffre qu’Aujourd’hui et que le ☰', [nAuj[1], nMenu[1]], [nStock[1], nStock[1]]);
  const liste = t.texte('#stock-alertes');
  verifierVrai('la liste nomme la gaine (sous le seuil) : ' + liste, /Gaine/.test(liste) && /seuil à 100/.test(liste));
  verifierVrai('et le tuteur dont les chantiers signés prennent trop', /Tuteur/.test(liste) && /il en manque 100/.test(liste));
  verifierVrai('pas le tranquille', !/Répulsif/.test(liste));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Messages : la corbeille se dit « ☰ ▸ Corbeille », d’un seul texte', async () => {
  /* Neuf confirmations de suppression citaient l'ancien chemin. Le texte est
     dans une constante : l'application ne dit plus que celui-là. */
  verifier('plus aucun ancien chemin dans l’application', 0,
    html.split('Général ▸ Sauvegarde ▸ Corbeille').length - 1);
  verifier('le nouveau chemin est défini une fois', 1, html.split("CHEMIN_CORBEILLE = '☰ ▸ Corbeille'").length - 1);
  verifier('et aucun message ne le récrit à la main', 0, html.split("' jours dans ☰").length - 1);
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [chA('c1', { nom: 'Éclaircie Chapelle', statut: 'encours' })],
    cfg: { notes: [{ id: 'n1', titre: 'Courses', couleur: '#B4231F', items: [], cree: Date.now() }] }
  }));
  const demandes = [];
  t.w.confirm = m => { demandes.push(m); return false; };
  t.clic('[data-notesup]'); await t.pause(200);
  verifierVrai('la note le dit : ' + demandes[0], /30 jours dans ☰ ▸ Corbeille\./.test(demandes[0] || ''));
  await parBarre(t, 'chantiers'); t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-sup'); await t.pause(200);
  verifierVrai('le chantier aussi : ' + demandes[1], /30 jours dans ☰ ▸ Corbeille\./.test(demandes[1] || ''));
  verifier('rien n’a été supprimé (confirmations refusées)', 1, t.stock('chantiers').length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Note : créée depuis un autre écran, on dit où elle est', async () => {
  /* Lot r1 : les notes vivent dans ☰ ▸ Mes notes. Créée de là, le message
     simple ; d'ailleurs, il dit où elle est. */
  const t = await ouvrir(VIDE);
  await parMenu(t, 'notes');
  await plusNote(t);
  t.saisir('#nt-titre', 'Ici même'); t.clic('#nt-ok'); await t.pause(400);
  verifier('depuis Mes notes : le message simple', 'Note ajoutée.', t.texte('#toast'));
  await parBarre(t, 'agenda');
  await plusNote(t);
  t.saisir('#nt-titre', 'Depuis l’agenda'); t.clic('#nt-ok'); await t.pause(400);
  verifierVrai('depuis l’Agenda : ' + t.texte('#toast'), /^Note ajoutée dans ☰ ▸ Mes notes\.$/.test(t.texte('#toast')));
  verifier('les deux notes sont bien là', 2, ((t.stock('cfg') || {}).notes || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Placement : il s’ouvre sur le mois du dernier jour placé, sinon du prochain jour ouvré (P2)', async () => {
  /* Cause du premier défaut : journeesPlacees rend des {d, p}, et la fiche
     passait l'objet à minuit() au lieu de sa date : NaN, donc le mois en
     cours. Depuis le lot c1, on reprend où l'on s'était arrêté : le DERNIER
     jour placé, pas le premier. */
  const proche = JA(2), loin = JA(45);
  const mois = ts => { const d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { month: 'long' }).toLowerCase() + ' ' + d.getFullYear(); };
  verifierVrai('le dernier jour posé est dans un autre mois que le premier',
    new Date(proche).getMonth() !== new Date(loin).getMonth());
  /* Le prochain jour ouvré, compté ici sans l'application : demain, ou le
     lundi d'après si demain tombe un week-end. */
  const ouvre = new Date(); ouvre.setHours(12, 0, 0, 0);
  do { ouvre.setDate(ouvre.getDate() + 1); } while (ouvre.getDay() === 0 || ouvre.getDay() === 6);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      chA('c1', { nom: 'Posé loin', statut: 'accepte', aDevis: false, joursEstimes: 3,
        jours: [{ d: proche, p: 1 }, { d: loin, p: 1 }] }),
      chA('c2', { nom: 'Rien posé', statut: 'accepte', aDevis: false, joursEstimes: 3 })]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-planifier'); await t.pause(450);
  verifier('l’Agenda est ouvert', 'vue-calendrier', vueActive(t));
  verifier('sur le mois du dernier jour placé', mois(loin), t.texte('#cal-titre').toLowerCase());
  t.clic('#cal-planif-fin'); await t.pause(400);
  await parBarre(t, 'chantiers'); t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c2"]'); await t.pause(400);
  t.clic('#f-planifier'); await t.pause(450);
  verifier('sans jour placé : le mois du prochain jour ouvré', mois(ouvre.getTime()),
    t.texte('#cal-titre').toLowerCase());
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Agenda : le bouton Aujourd’hui ramène au mois courant et ouvre la fiche du jour (P5)', async () => {
  /* Deux « Aujourd’hui » se suivaient (remontée du 5a) : celui du bandeau et
     celui d'à côté de ‹ ›. Il n'en reste qu'un, qui fait les deux. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', aDevis: true, joursEstimes: 2,
      lignes: [], temps: [], jours: [], maj: Date.now() }]
  }));
  await t.pause(300);
  const ici = new Date();
  const moisCourant = ici.toLocaleDateString('fr-FR', { month: 'long' }).toLowerCase() + ' ' + ici.getFullYear();
  verifier('plus d’« Aujourd’hui » dans le bandeau', null, t.$('#b-aujourdhui'));
  const boutons = t.$$('#vue-calendrier button, #b-ctx button').filter(b => /Aujourd’hui|Aujourd'hui/.test(b.textContent));
  verifier('un seul bouton Aujourd’hui sur l’Agenda', ['cal-auj'], boutons.map(b => b.id));
  t.clic('#cal-suiv'); await t.pause(150); t.clic('#cal-suiv'); await t.pause(150);
  verifierVrai('on est parti sur un autre mois', t.texte('#cal-titre').toLowerCase() !== moisCourant);
  t.clic('#cal-auj'); await t.pause(450);
  verifier('il ramène au mois courant', moisCourant, t.texte('#cal-titre').toLowerCase());
  verifier('et ouvre la fiche du jour', false, t.$('#modale').hidden);
  verifier('de ce jour-ci', ici.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    t.texte('#modale-titre').toLowerCase());
  verifierVrai('en feuille', t.$('#modale').classList.contains('feuille-nav'));
  t.clic('#modale-x'); await t.pause(150);

  /* En placement, un appui sur un jour pose : le bouton ne fait que ramener.
     On y entre par la fiche ▸ Travaux depuis le lot r1. */
  t.w.BCUI._ouvrirChantier('c1', 'travaux'); await t.pause(300);
  t.clic('#f-planifier'); await t.pause(400);
  t.clic('#cal-suiv'); await t.pause(150);
  t.clic('#cal-auj'); await t.pause(400);
  verifier('en placement, il ramène au mois', moisCourant, t.texte('#cal-titre').toLowerCase());
  verifier('sans rien ouvrir par-dessus', true, t.$('#modale').hidden);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Agenda : un jour, une couleur — légende du mois, ○, € et trois compteurs (G1)', async () => {
  /* G1, validé le 03/11 : fait = bleu, posé = vert, non travaillé = gris ;
     posé sur un devis pas signé = vert en pointillés (fini le jaune). La
     légende ne dit que ce qui figure dans le mois affiché ; « € » et « ○ »
     en petit dessous. Trois compteurs : fait, posé (signé seulement), non
     travaillé. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: JCAL(-10),
      absences: [{ d: new Date(JCAL(-4)).setHours(0, 0, 0, 0), note: 'pluie' }] },
    chantiers: [
      { id: 'c1', nom: 'Vaux', statut: 'accepte', aDevis: true, maj: Date.now(), lignes: [], temps: [],
        jours: [{ d: JCAL(-2), p: 1 }, { d: JCAL(3), p: 1 }] },
      { id: 'c2', nom: 'Marchand', statut: 'envoye', aDevis: true, maj: Date.now(), lignes: [], temps: [],
        jours: [{ d: JCAL(4), p: 1 }] },
      { id: 'c3', nom: 'Combe', statut: 'accepte', aDevis: true, maj: Date.now(), lignes: [], temps: [],
        jours: [{ d: JCAL(-3), p: 1, ferme: false }] },
      { id: 'c4', nom: 'Loin', statut: 'accepte', aDevis: true, maj: Date.now(), lignes: [], temps: [],
        jours: [{ d: JCAL(75), p: 1 }] }],
    journees: [{ id: 'j1', date: JCAL(-1), chantier: 'c1', personnes: 1, nonProd: 7, postes: [] }],
    charges: [{ id: 'h1', libelle: 'Assurance', ttc: 412, periodicite: 'mensuel', categorie: 'ASSUR', taux: 0,
      debut: JCAL(-40), jour: new Date(JCAL(5)).getDate(), moisReference: new Date(JCAL(5)).getMonth() }]
  }));
  await t.pause(300);
  const C0 = t.w.BCC;
  const cas = async n => { const c = await caseDuJour(t, JCAL(n)); return c ? c.className : ''; };
  verifierVrai('fait', /st-travaille/.test(await cas(-1)));
  verifierVrai('non travaillé', /st-absent/.test(await cas(-4)));
  verifierVrai('posé', /st-confirme/.test(await cas(3)));
  verifierVrai('posé, devis pas signé', /st-prevu/.test(await cas(4)));
  verifierVrai('le même, passé : pâle', /st-prevu/.test(await cas(-3)) && /passe/.test(await cas(-3)));
  const off = await caseDuJour(t, JCAL(-2));
  verifierVrai('le jour posé passé compte d’office : fait, avec un ○, sans « ? »',
    /st-travaille/.test(off.className) && off.querySelector('.cal-o') && !off.querySelector('.cal-q'));
  verifier('chaque case porte une bande, et une seule', 1, off.querySelectorAll('.bande').length);
  verifierVrai('la légende du mois dit le ○', /comptée d’office \(8 h\)/.test(t.texte('#cal-leg2')));
  verifierVrai('et le €', /prélèvement/.test(t.texte('#cal-leg2')));
  verifierVrai('et la couleur du fait', /fait/.test(t.texte('#cal-legende')));
  const k = t.$$('#cal-charge .carte2 small').map(s => s.textContent);
  verifier('trois compteurs', ['fait', 'posé (signé)', 'non travaillé'], k);
  /* Le compteur « posé » ne compte que le signé, et pas ce qui est déjà fait. */
  const m0 = new Date(JCAL(10)), an = m0.getFullYear(), mo = m0.getMonth(), d10 = new Date(an, mo, 10, 12).getTime();
  const cfg = { heuresJour: 8 };
  verifier('un jour sur devis pas signé n’est pas « posé (signé) »', 0,
    C0.chargeMois([{ id: 'x', statut: 'envoye', jours: [{ d: d10, p: 1 }] }], an, mo, cfg).fermes);
  verifier('un jour signé l’est', 1,
    C0.chargeMois([{ id: 'x', statut: 'accepte', jours: [{ d: d10, p: 1 }] }], an, mo, cfg).fermes);
  const fait = C0.chargeMois([{ id: 'x', statut: 'accepte', jours: [{ d: d10, p: 1 }],
    temps: [{ date: d10, duree: 8, unite: 'h', office: true }] }], an, mo, cfg);
  verifier('un jour fait n’est plus « posé » : il est fait, une fois', [0, 1], [fait.fermes, fait.joursReels]);
  /* Un mois sans jour non travaillé ne l'affiche pas. */
  await caseDuJour(t, JCAL(75));
  const leg = t.texte('#cal-legende');
  verifierVrai('un mois sans jour non travaillé ne l’affiche pas : « ' + leg + ' »',
    /posé/.test(leg) && !/non travaillé/.test(leg) && !/fait/.test(leg) && !/comptée d’office/.test(t.texte('#cal-leg2')));
  verifierVrai('le compteur « non travaillé » reste, à zéro', /^0 j$/.test(t.texte('#cal-charge .carte2:last-child b')));
  /* Les couleurs sont des variables du :root, et le jaune est parti. */
  verifierVrai('les teintes viennent du :root', /--st-trav:/.test(html) &&
    /\.cal button\.st-confirme\{background:var\(--st-conf-f\)\}/.test(html));
  verifierVrai('posé sur un devis pas signé : le vert, en pointillés',
    /\.cal button\.st-prevu\{background:var\(--carte\);border:2px dashed var\(--st-conf\)\}/.test(html) &&
    !/var\(--st-prev\)/.test(html));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Agenda : l’appui long ouvre la bulle, l’appui simple la fiche du jour (G2)', async () => {
  /* G2, validé le 03/11 : appui long (500 ms au doigt, clic droit à la
     souris) → une bulle sous le jour : Saisir ma journée · Poser un chantier
     · Jour non travaillé. L'appui simple ouvre toujours la fiche du jour. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', aDevis: true, maj: Date.now(), lignes: [], temps: [], jours: [] }]
  }));
  await t.pause(300);
  const bulle = () => t.$('#cal-bulle');
  const c = await appuiLong(t, JCAL(2));
  verifierVrai('tenu 500 ms : la bulle s’ouvre', !!bulle());
  verifier('avec ses trois gestes', ['Saisir ma journée', 'Poser un chantier', 'Jour non travaillé'],
    t.$$('#cal-bulle [data-bulle]').map(b => b.textContent.trim()));
  verifierVrai('elle nomme le jour', /\d/.test(t.texte('#cal-bulle .cb-t')));
  verifier('le doigt levé n’ouvre pas la fiche par-dessus', true, t.$('#modale').hidden);
  verifierVrai('la case est marquée', c && c.classList.contains('appui'));
  /* Un appui hors de la bulle la ferme (après le temps de lever le doigt). */
  await t.pause(400);
  t.clic('#cal-bulle-fond'); await t.pause(150);
  verifier('un appui à côté la ferme', null, bulle());
  /* Le clic droit, à la souris : la bulle, et pas le menu du navigateur. */
  const e = await appuiLong(t, JCAL(2), 'souris');
  verifierVrai('le clic droit l’ouvre aussi', !!bulle());
  verifierVrai('sans le menu du navigateur', e && e.defaultPrevented);
  t.clic('#cal-bulle [data-bulle="poser"]'); await t.pause(400);
  verifierVrai('« Poser un chantier » ouvre la feuille', !!t.$('#modale [data-pjch="c1"]') && !bulle());
  t.clic('#modale-x'); await t.pause(150);
  await appuiLong(t, JCAL(-1), 'souris');
  t.clic('#cal-bulle [data-bulle="mj"]'); await t.pause(400);
  verifier('« Saisir ma journée » ouvre Ma journée à ce jour', ['Ma journée', jourISO(JCAL(-1))],
    [t.texte('#modale-titre'), t.$('#mj-date') && t.$('#mj-date').value]);
  t.clic('#modale-x'); await t.pause(150);
  await appuiLong(t, JCAL(-1), 'souris');
  t.clic('#cal-bulle [data-bulle="abs"]'); await t.pause(400);
  verifierVrai('« Jour non travaillé » ouvre sa feuille', !!t.$('#ab-note'));
  t.clic('#modale-x'); await t.pause(150);
  /* L'appui simple, lui, ouvre toujours la fiche du jour. */
  await cliquerJour(t, JCAL(2));
  verifierVrai('l’appui simple ouvre la fiche du jour', !t.$('#modale').hidden && t.$('#modale .fj-etat') && !bulle());
  t.clic('#modale-x'); await t.pause(150);
  /* En placement, chaque appui pose : pas de bulle. */
  t.w.BCUI._ouvrirChantier('c1', 'travaux'); await t.pause(300);
  t.clic('#f-planifier'); await t.pause(400);
  await appuiLong(t, JCAL(2), 'souris');
  verifier('en placement, pas de bulle', null, bulle());
  /* Ni sélection de texte, ni menu du téléphone sur un appui long. */
  verifierVrai('la case ne sélectionne rien et n’ouvre pas le menu du téléphone',
    /\.cal button\{[^}]*user-select:none[^}]*-webkit-touch-callout:none/.test(html));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Agenda : poser un chantier — par étape, statut proposé d’après le chantier (G3)', async () => {
  /* La feuille liste les chantiers ni payés ni sans suite, rangés par étape ;
     on en choisit un, puis le statut du jour, proposé d'après le chantier et
     modifiable. Un statut contraire au chantier s'écrit sur la pose ; sinon
     le jour suit le chantier, et se confirme le jour où le devis est signé. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [
      chA('sig', { nom: 'Signé', statut: 'accepte', aDevis: true }),
      chA('att', { nom: 'En attente', statut: 'envoye', aDevis: true }),
      chA('inf', { nom: 'Annoncé', statut: 'devis', aDevis: true }),
      chA('fac', { nom: 'Facturé', statut: 'facture' }),
      chA('pay', { nom: 'Payé', statut: 'paye' }),
      chA('ss', { nom: 'Sans suite', statut: 'sansuite', aDevis: true })]
  }));
  await t.pause(300);
  const C0 = t.w.BCC;
  const poseDe = (id, ts) => (((t.stock('chantiers') || []).filter(c => c.id === id)[0] || {}).jours || [])
    .filter(j => C0.jourCle(j.d) === C0.jourCle(ts))[0];
  const ouvrirPoser = async ts => { await cliquerJour(t, ts); t.clic('#fj-poser'); await t.pause(400); };
  await ouvrirPoser(JCAL(3));
  verifier('ni payé ni sans suite, rangés par étape', ['inf', 'att', 'sig', 'fac'],
    t.$$('#modale [data-pjch]').map(b => b.dataset.pjch));
  verifier('un intertitre par étape', ['Infos et repérage', 'Devis', 'Travaux', 'Paiement'],
    t.$$('#modale .pj-etape').map(p => p.textContent));
  await choisirAPoser(t, 'att');
  verifier('devis en attente : « Posé, devis pas signé » proposé', 'provisoire',
    (t.$('#modale [data-pjst][aria-pressed="true"]') || {}).dataset.pjst);
  t.clic('#pj-ok'); await t.pause(500);
  verifier('écrit sans statut à lui : il suit le chantier', undefined, poseDe('att', JCAL(3)).ferme);
  verifierVrai('la case est en pointillés', /st-prevu/.test((await caseDuJour(t, JCAL(3))).className));
  /* Signé ensuite : le jour se confirme de lui-même. */
  t.w.BCUI._setChantier('att', { statut: 'accepte', dateSignature: Date.now() }); await t.pause(400);
  t.w.BCUI._setCal(null, null); await t.pause(200);
  verifierVrai('le devis signé, il est posé', /st-confirme/.test((await caseDuJour(t, JCAL(3))).className));
  /* Un choix contraire au chantier est permis. */
  await ouvrirPoser(JCAL(4));
  await choisirAPoser(t, 'sig');
  verifier('signé : « Posé » proposé', 'ferme', (t.$('#modale [data-pjst][aria-pressed="true"]') || {}).dataset.pjst);
  await choisirAPoser(t, 'sig', 'provisoire');
  t.clic('#pj-ok'); await t.pause(500);
  verifier('« devis pas signé » choisi à la main : écrit sur la pose', false, poseDe('sig', JCAL(4)).ferme);
  verifierVrai('et la case en pointillés', /st-prevu/.test((await caseDuJour(t, JCAL(4))).className));
  await ouvrirPoser(JCAL(5));
  await choisirAPoser(t, 'inf', 'ferme');
  t.clic('#pj-ok'); await t.pause(500);
  verifier('« Posé » sur un devis pas encore fait : écrit sur la pose', true, poseDe('inf', JCAL(5)).ferme);
  /* Une date passée : fait, journée ou demi-journée — une journée, pas de pose. */
  await ouvrirPoser(JCAL(-2));
  await choisirAPoser(t, 'sig');
  verifier('date passée : « Fait » proposé, journée ou demi-journée',
    ['Fait · journée (8 h)', 'Fait · demi-journée (4 h)'], t.$$('#modale [data-pjst]').map(b => b.textContent.trim()));
  verifier('la journée entière d’abord', 'j', (t.$('#modale [data-pjst][aria-pressed="true"]') || {}).dataset.pjst);
  await choisirAPoser(t, 'sig', 'd');
  t.clic('#pj-ok'); await t.pause(600);
  const js = t.stock('journees') || [];
  verifier('une journée de 4 h est créée, sans prestation', [1, 'sig', 4, 0],
    [js.length, js[0] && js[0].chantier, js[0] && js[0].nonProd, js[0] && (js[0].postes || []).length]);
  verifier('à cette date', C0.jourCle(JCAL(-2)), js[0] && C0.jourCle(js[0].date));
  verifier('et rien de posé ce jour-là', undefined, poseDe('sig', JCAL(-2)));
  await ouvrirPoser(JCAL(-3));
  await choisirAPoser(t, 'fac');
  t.clic('#pj-ok'); await t.pause(600);
  verifier('la journée entière : 8 h', 8, ((t.stock('journees') || []).filter(j => j.chantier === 'fac')[0] || {}).nonProd);
  /* Un appui sur le jour, ensuite, ouvre de quoi la préciser. */
  await cliquerJour(t, JCAL(-2));
  verifierVrai('le jour est fait, et se modifie', /Ce que vous y avez fait/.test(t.texte('#modale')) &&
    t.texte('#fj-travaille') === 'Modifier ma journée');
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Agenda : sous la grille, le mois jour par jour, rangé par semaine (R7)', async () => {
  /* « L'Agenda me sert surtout d'historique. » La place de la carte Journée
     va au mois jour par jour : heures, quantités, km ; un appui rouvre la
     journée. Les jours sont pris dans le mois affiché, pour que la grille et
     l'historique parlent du même mois quel que soit le jour du test. */
  const ici = new Date();
  const le = j => new Date(ici.getFullYear(), ici.getMonth(), j, 12).getTime();
  const avant = new Date(ici.getFullYear(), ici.getMonth() - 1, 15, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'calendrier', cfg: { heuresJour: 8, journeesMigrees: true,
      absences: [{ d: new Date(le(10)).setHours(0, 0, 0, 0), note: 'pluie' }] },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', aDevis: true, maj: Date.now(), temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }] }],
    journees: [
      { id: 'j1', date: le(2), chantier: 'c1', personnes: 1, nonProd: 0, km: 40,
        postes: [{ travaux: 'DEGAG', heures: 7, quantite: 1.5 }] },
      { id: 'j2', date: le(15), chantier: 'c1', personnes: 1, nonProd: 4, postes: [] },
      { id: 'j3', date: avant, chantier: 'c1', personnes: 1, nonProd: 6, postes: [] }]
  }));
  await t.pause(300);
  const z = t.texte('#cal-histo');
  verifierVrai('le titre', /Ce mois-ci, jour par jour/.test(z));
  verifierVrai('le total du mois, sans le mois d’avant', /11 h · 40 km/.test(z));
  verifier('deux journées et une absence', [2, 1],
    [t.$$('#cal-histo [data-histomj]').length, t.$$('#cal-histo [data-histojour]').length]);
  verifierVrai('la journée dit ses quantités et ses km', /1,50? ha/.test(z) && /40 km/.test(z));
  const lundi = ts => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7).getTime(); };
  const semaines = new Set([le(2), le(10), le(15)].map(lundi)).size;
  const det = t.$$('#cal-histo details.semaine');
  verifier('rangé par semaine', semaines, det.length);
  verifier('la plus récente ouverte, les autres repliées', [true].concat(Array(semaines - 1).fill(false)),
    det.map(d => d.open));
  t.clic('#cal-histo [data-histomj="j1"]'); await t.pause(450);
  verifier('un appui rouvre la journée', 'Modifier la journée', t.texte('#modale-titre'));
  verifier('à sa date', jourISO(le(2)), t.$('#mj-date').value);
  t.clic('#modale-x'); await t.pause(150);
  t.clic('#cal-histo [data-histojour]'); await t.pause(450);
  verifierVrai('l’absence ouvre la fiche du jour', /pluie/.test(t.texte('#modale')) && t.$('#fj-libre'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche du jour : rien de la carte Journée, de la fiche d’un jour ni de « Que s’est-il passé ? » ne s’est perdu', async () => {
  /* L'inventaire de non-perte du lot c1 (R7, R8). Les boutons des trois
     écrans fondus sont lus dans la table de correspondance (section 4) ;
     chacun a ici sa preuve, jouée sur la fiche du jour, avec le même effet
     qu'avant. Un bouton sans preuve, ou une preuve sans bouton, fait crier.
     Lot r1 : les boutons retirés le 03/11 sont lus dans la section 15 de la
     table ; chacun doit y être, et ne plus être nulle part sur la fiche. */
  const TABLE = fs.readFileSync(path.join(__dirname, '..', 'docs', 'correspondance-refonte.md'), 'utf8').split(/\r?\n/);
  const lu = {};
  [['carte', /^\| Carte Journée[^(|]*\(([^)]+)\)/], ['fiche', /^\| Appui sur un jour[^(|]*\(([^)]+)\)/],
    ['fenetre', /^\| Fenêtre « Que s'est-il passé \? »[^(|]*\(([^)]+)\)/]].forEach(([k, re]) => {
    const l = TABLE.map(x => re.exec(x)).filter(Boolean)[0];
    lu[k] = l ? l[1].split(', ') : [];
  });
  const C0 = () => t0.w.BCC;
  let t0 = null;
  const fiche = async (graines, ts) => {
    t0 = await ouvrir(Object.assign({}, VIDE, { module: 'calendrier' }, graines));
    await t0.pause(200);
    await cliquerJour(t0, ts);
    return t0;
  };
  const ch = (jours, extra) => Object.assign({ id: 'c1', nom: 'Vaux', statut: 'accepte', aDevis: true, maj: Date.now(),
    temps: [], jours: jours.map(d => ({ d, p: 1 })),
    lignes: [] }, extra);
  const autre = { id: 'c2', nom: 'Marchand', statut: 'accepte', aDevis: true, maj: Date.now(), temps: [], jours: [], lignes: [] };
  const POSE = { cfg: { heuresJour: 8, journeesMigrees: true }, chantiers: [ch([JCAL(3)]), autre] };
  /* Un jour posé passé depuis la mise à jour : il compte d'office. */
  const OFFICE = { cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: JCAL(-10) }, chantiers: [ch([JCAL(-3)])] };
  const FAIT = { cfg: { heuresJour: 8, journeesMigrees: true }, chantiers: [ch([])],
    journees: [{ id: 'j1', date: JCAL(-1), chantier: 'c1', personnes: 1, nonProd: 0, postes: [{ travaux: 'DEGAG', heures: 7, quantite: 0 }] }] };
  const TRANCHE = { cfg: { heuresJour: 8, journeesMigrees: true }, chantiers: [ch([JCAL(-3), JCAL(-2)])] };
  const AUJ = { cfg: { heuresJour: 8, journeesMigrees: true }, chantiers: [ch([JCAL(0)])] };
  const VIDE_CFG = { cfg: { heuresJour: 8, journeesMigrees: true } };
  const titre = () => t0.texte('#modale-titre');
  const clic = async (s, p) => { const ok = t0.clic(s); await t0.pause(p || 450); return ok; };
  const dateMJ = () => (t0.$('#mj-date') || {}).value;
  const journees = () => t0.stock('journees') || [];
  const joursDe = id => ((t0.stock('chantiers') || []).filter(c => c.id === id)[0].jours || []).map(j => C0().jourCle(j.d));
  const prJourneeDatee = async (g, ts, bouton) => { await fiche(g, ts);
    return await clic(bouton) && titre() === 'Ma journée' && dateMJ() === jourISO(ts); };
  const PREUVES = {
    carte: {
      'Prévu': async () => { await fiche(POSE, JCAL(3)); return /Ce qui est posé ce jour-là/.test(t0.texte('#modale')) && /Vaux/.test(t0.texte('#modale')); },
      'Fait': async () => { await fiche(FAIT, JCAL(-1)); return /Ce que vous y avez fait/.test(t0.texte('#modale')) && /Vaux/.test(t0.texte('#modale')); },
      'Ouvrir': async () => { await fiche(POSE, JCAL(3)); return await clic('[data-fjouvrir="c1"]') && vueActive(t0) === 'vue-chantier'; },
      '✕': async () => { await fiche(FAIT, JCAL(-1)); t0.w.confirm = () => true;
        return await clic('[data-fjsupch]', 600) && journees().length === 0; },
      'J\'ai travaillé': async () => prJourneeDatee(VIDE_CFG, JCAL(-1), '#fj-travaille')
    },
    fiche: {
      'Non travaillé': async () => { await fiche(POSE, JCAL(3)); await clic('#fj-absent', 400);
        t0.saisir('#ab-note', 'pluie'); await clic('#ab-ok', 500);
        return ((t0.stock('cfg') || {}).absences || []).length === 1; },
      'J\'y ai travaillé': async () => prJourneeDatee(VIDE_CFG, JCAL(-1), '#fj-travaille'),
      'Modifier ma journée': async () => { await fiche(FAIT, JCAL(-1));
        return t0.texte('#fj-travaille') === 'Modifier ma journée' && await clic('#fj-travaille') && titre() === 'Modifier la journée'; },
      'Autre chose': async () => await prJourneeDatee(FAIT, JCAL(-1), '#fj-autre') &&
        await prJourneeDatee(AUJ, JCAL(0), '#fj-travaille') && t0.$('#mj-ch').value === 'c1',
      'Poser un chantier': async () => { await fiche(POSE, JCAL(3)); await clic('#fj-poser', 400);
        await choisirAPoser(t0, 'c2'); await clic('#pj-ok', 500);
        return joursDe('c2').indexOf(C0().jourCle(JCAL(3))) >= 0; },
      'Fiche': async () => { await fiche(POSE, JCAL(3)); return await clic('[data-fjouvrir="c1"]') && /Vaux/.test(t0.texte('#vue-chantier')); },
      'Prélevé ce jour-là': async () => { await fiche({ charges: [{ id: 'h1', libelle: 'Assurance', ttc: 412, periodicite: 'mensuel',
        categorie: 'ASSUR', taux: 0, debut: JCAL(-40), jour: new Date(JCAL(3)).getDate(), moisReference: new Date(JCAL(3)).getMonth() }] }, JCAL(3));
        return /Prélevé ce jour-là/.test(t0.texte('#modale')) && /Assurance/.test(t0.texte('#modale')); }
    },
    fenetre: {
      /* Devenu « Je n'y étais pas » de la journée d'office : le jour posé
         s'en va (dans la Corbeille). */
      'je n\'étais pas là': async () => { await fiche(OFFICE, JCAL(-3)); await clic('#fj-nonla', 600);
        return joursDe('c1').indexOf(C0().jourCle(JCAL(-3))) < 0; },
      'un autre jour': async () => { await fiche(TRANCHE, JCAL(-3)); await clic('#fj-deplacer', 400);
        t0.choisir('#dj-date', jourISO(JCAL(-5))); await clic('#dj-ok', 600);
        const j = joursDe('c1');
        return j.indexOf(C0().jourCle(JCAL(-5))) >= 0 && j.indexOf(C0().jourCle(JCAL(-3))) < 0; }
    }
  };
  /* Deux boutons de l'ancienne fiche que la table ne cite pas : gardés aussi. */
  const EN_PLUS = {
    'Retirer': async () => { await fiche(POSE, JCAL(3)); return await clic('[data-fjretirer="c1"]', 500) && joursDe('c1').length === 0; },
    'Ce n’est plus un jour off': async () => { await fiche({ cfg: { heuresJour: 8, absences: [{ d: new Date(JCAL(3)).setHours(0, 0, 0, 0), note: 'congé' }] } }, JCAL(3));
      return await clic('#fj-libre', 500) && ((t0.stock('cfg') || {}).absences || []).length === 0; }
  };
  /* Les retraits du 03/11 (lot r1), et le mot qui les nomme dans la
     section 15 de la table. */
  const RETIRES = { fiche: { 'C\'était comme prévu': 'C\'était comme prévu' },
    fenetre: { 'comme prévu': 'C\'était comme prévu', 'toutes comme prévu': 'Toutes comme prévu',
      'autrement': 'J\'y ai travaillé, mais autrement' } };
  const s15 = TABLE.slice(TABLE.findIndex(l => /^## 15\./.test(l)));
  const retire = mot => s15.some(l => l.indexOf('« ' + mot + ' »') >= 0 && /retrait accepté \(03\/11\)/.test(l));
  const ABSENTS = ['#fj-prevu', '#fj-tout', '#fj-autrement'];
  const nulle = async () => {
    for (const [g, ts] of [[AUJ, JCAL(0)], [TRANCHE, JCAL(-3)], [OFFICE, JCAL(-3)], [POSE, JCAL(3)]]) {
      await fiche(g, ts);
      if (ABSENTS.some(x => t0.$(x))) return false;
    }
    return true;
  };
  for (const k of ['carte', 'fiche', 'fenetre']) {
    const partis = RETIRES[k] || {};
    verifier('la table cite les boutons de « ' + k + ' », chacun avec sa preuve ou son retrait',
      Object.keys(PREUVES[k]).concat(Object.keys(partis)).sort(), lu[k].slice().sort());
    for (const b of lu[k]) {
      if (partis[b]) {
        verifierVrai(k + ' ▸ « ' + b + ' » : retrait accepté, écrit dans la section 15', retire(partis[b]));
        verifierVrai(k + ' ▸ « ' + b + ' » : plus nulle part sur la fiche du jour', await nulle());
        continue;
      }
      const p = PREUVES[k][b];
      verifierVrai(k + ' ▸ « ' + b + ' » : même effet dans la fiche du jour', p && await p());
      if (t0) verifier(k + ' ▸ « ' + b + ' » : aucune erreur', [], t0.erreurs);
    }
  }
  for (const b of Object.keys(EN_PLUS)) verifierVrai('fiche ▸ « ' + b + ' » : gardé', await EN_PLUS[b]());
});

/* --------------------------------------------------------------------- */
/* --------------------------------------------------------------------- */
/* Lot b1 (4.90.0) : la fiche du chantier en étapes. Un même carnet pour
   tous les scénarios du lot : un chantier à chaque statut, des noms de
   propriétaire distincts pour savoir sur quelle fiche on est. */
const B1 = () => ({
  module: 'chantiers', cfg: { heuresJour: 8, journeesMigrees: true, prixJourVise: 300 },
  chantiers: [
    /* En cours, devis signé, deux taux de TVA, une prestation et une vente,
       placé sur la carte, avec une journée de 500 plants. */
    { id: 'a', statut: 'encours', aDevis: true, siren: true, maj: Date.now(), dateEntree: JCAL(-40),
      donneur: 'Cabinet Dubois', proprietaire: 'Martin', commune: 'Montjoie', foret: 'Bois Joli',
      numeroDevis: 'D-2026-0005', dateDevis: JCAL(-30), validiteDevis: 3, dateEnvoi: JCAL(-30),
      dateSignature: JCAL(-20), joursEstimes: 4, prixJour: 400, notes: 'portail code 1234',
      criteres: { essence: 'DOU', densite: 1100 }, gps: { lat: 44.95, lon: 3.11 }, temps: [],
      jours: [{ d: JCAL(-2), p: 1 }, { d: JCAL(5), p: 1 }],
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1000, prix: 1.2, nature: 'prestation' },
        { travail: 'F_PROTEC', unite: 'unite', quantite: 1000, prix: 0.8, nature: 'vente' }] },
    /* Terminé, à facturer. */
    { id: 'b', statut: 'termine', aDevis: true, maj: Date.now(), dateEntree: JCAL(-50),
      donneur: 'ONF', proprietaire: 'Bernard', commune: 'Valbrune', numeroDevis: 'D-2026-0006',
      dateSignature: JCAL(-30), dateFin: JCAL(-1), joursEstimes: 2, temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 700, nature: 'prestation' }] },
    /* Facturé, échéance passée, une ligne modifiée depuis le devis figé. */
    { id: 'c', statut: 'facture', aDevis: true, maj: Date.now(), dateEntree: JCAL(-90),
      donneur: 'ONF', proprietaire: 'Charles', commune: 'Lizon', numeroDevis: 'D-2026-0004',
      numeroFacture: 'F-2026-0010', dateFacture: JCAL(-40), echeancePaiement: JCAL(-10),
      devisFige: { date: JCAL(-41), total: 1000, lignes: [{ uid: 'u1', montant: 1000, quantite: 2,
        prix: 500, unite: 'ha', titre: 'Dégagement manuel' }] }, temps: [], jours: [],
      lignes: [{ uid: 'u1', travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 600, nature: 'prestation' }] },
    /* Payé, repris du carnet, sans devis : une journée et demie notée. */
    { id: 'd', statut: 'paye', aDevis: false, maj: Date.now(), dateEntree: JCAL(-120),
      donneur: 'Forêts et Gestion', proprietaire: 'Denis', commune: 'Ornans',
      numeroFacture: 'F-2026-0003', dateFacture: JCAL(-60), datePaiement: JCAL(-45),
      moyenPaiement: 'cheque', temps: [], jours: [],
      lignes: [{ travail: 'NETT', unite: 'ha', quantite: 1, prix: 900, nature: 'prestation' }] },
    /* Devis envoyé, sans réponse. */
    { id: 'e', statut: 'envoye', aDevis: true, maj: Date.now(), dateEntree: JCAL(-15),
      donneur: 'Cabinet Dubois', proprietaire: 'Émile', commune: 'Amancey',
      numeroDevis: 'D-2026-0007', dateDevis: JCAL(-12), dateEnvoi: JCAL(-12), joursEstimes: 3, temps: [], jours: [],
      lignes: [{ travail: 'REGARNI', unite: 'plant', quantite: 500, prix: 1.5, nature: 'prestation' }] },
    /* Annoncé, rien de saisi : l'étape Infos. Ni donneur ni commune. */
    { id: 'f', statut: 'devis', aDevis: true, maj: Date.now(), dateEntree: JCAL(-3),
      proprietaire: 'Fabre', temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: '', prix: '', nature: 'prestation' }] },
    /* À programmer sans devis, temps à estimer. */
    { id: 'g', statut: 'accepte', aDevis: false, maj: Date.now(), dateEntree: JCAL(-5),
      donneur: 'ONF', proprietaire: 'Gaston', commune: 'Mouthier', temps: [], jours: [],
      lignes: [{ travail: 'ELAG', unite: 'ha', quantite: 1, prix: 800, nature: 'prestation' }] },
    /* Devis signé, à programmer, deux journées estimées. */
    { id: 'h', statut: 'accepte', aDevis: true, maj: Date.now(), dateEntree: JCAL(-25),
      donneur: 'ONF', proprietaire: 'Hugo', commune: 'Nans', numeroDevis: 'D-2026-0008',
      dateSignature: JCAL(-4), joursEstimes: 2, temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 750, nature: 'prestation' }] }
  ],
  journees: [
    { id: 'j1', date: JCAL(-2), chantier: 'a', personnes: 1, nonProd: 0, km: 30,
      postes: [{ travaux: 'PLANT', heures: 8, quantite: 500 }] },
    { id: 'j2', date: JCAL(-50), chantier: 'd', personnes: 1, nonProd: 0,
      postes: [{ travaux: 'NETT', heures: 8, quantite: 0 }] },
    { id: 'j3', date: JCAL(-49), chantier: 'd', personnes: 1, nonProd: 0,
      postes: [{ travaux: 'NETT', heures: 4, quantite: 0 }] }
  ]
});
async function ficheB1(t, id) {
  await parBarre(t, 'chantiers');
  t.choisir('#c-filtre', 'tous'); await t.pause(200);
  t.clic('[data-chouvrir="' + id + '"]'); await t.pause(400);
  return t;
}
const etapeB1 = (t, i) => t.texte('#f-etapes [data-etape="' + i + '"]') || '';
const resumeB1 = (t, i) => t.texte('#f-etapes [data-etape="' + i + '"] summary') || '';
const ouvertesB1 = t => t.$$('#f-etapes details[open]').map(d => d.dataset.etape);
const chB1 = (t, id) => (t.stock('chantiers') || []).filter(c => c.id === id)[0] || {};

/* L'inventaire de non-perte du lot b1. Les lignes « Ancien » de la section
   3.2 sont lues dans la table de correspondance ; chacune a ici sa preuve,
   jouée sur la nouvelle fiche, avec le même effet qu'avant. Une ligne sans
   preuve, ou une preuve sans ligne, fait crier. Deux moitiés, pour que la
   suite se partage entre les processus. */
const lignesTable32 = () => {
  const l = fs.readFileSync(path.join(__dirname, '..', 'docs', 'correspondance-refonte.md'), 'utf8').split(/\r?\n/);
  const out = []; let dedans = false;
  l.forEach(x => {
    if (/^### 3\.2/.test(x)) { dedans = true; return; }
    if (/^### 3\.3/.test(x)) dedans = false;
    if (dedans && /^\| /.test(x)) out.push(x.split('|')[1].trim());
  });
  return out.slice(1);
};
function preuvesB1() {
  let tL = null;
  /* Les preuves qui ne font que lire partagent une application ; celles qui
     écrivent ouvrent la leur. */
  const voir = async id => { if (!tL) tL = await ouvrir(Object.assign({}, VIDE, B1())); return ficheB1(tL, id); };
  const neuf = async id => ficheB1(await ouvrir(Object.assign({}, VIDE, B1())), id);
  const fermer = async t => { t.clic('#modale-x'); await t.pause(150); };
  const P = {
    'Sélecteur du chantier affiché': async () => { const t = await voir('a');
      t.choisir('#f-choix', 'e'); await t.pause(350);
      return /Facturé à : Émile/.test(t.texte('#f-bloc-chantier')); },
    'Précédente / Suivante': async () => { const t = await voir('a');
      const avant = t.texte('#f-bloc-chantier'), b = t.$('[data-voisin]');
      if (!b) return false; b.click(); await t.pause(350);
      return t.texte('#f-bloc-chantier') !== avant; },
    'Le chantier : nom, lieu': async () => { const t = await voir('a');
      return !!t.texte('#f-bloc-chantier h2') && /Bois Joli · Montjoie/.test(t.texte('.fi-lieu')); },
    'Le chantier : client, donneur d\'ordre': async () => { const t = await voir('a');
      return /Facturé à : Martin/.test(t.texte('.fi-qui')) && /Donneur d’ordre : Cabinet Dubois/.test(t.texte('.fi-qui')); },
    '✎ identité (fenêtre Le chantier, position comprise)': async () => { const t = await voir('a');
      t.clic('#f-identite'); await t.pause(300);
      const ok = t.texte('#modale-titre') === 'Le chantier' && !!t.$('#ic-gps'); await fermer(t); return ok; },
    'État sur la carte : Voir / Placer / Déplacer': async () => { let t = await voir('a');
      const place = /Sur la carte/.test(etapeB1(t, 0)) && t.$('[data-fcarte="voir"]') && t.$('[data-fcarte="placer"]');
      t.clic('[data-fcarte="voir"]'); await t.pause(400);
      const carte = vueActive(t) === 'vue-carte';
      t = await voir('e');
      return !!place && carte && /Pas encore sur la carte/.test(etapeB1(t, 0)) &&
        !!t.$('[data-fcarte="moi"]') && !!t.$('[data-fcarte="placer"]'); },
    'Badge de statut': async () => { const t = await voir('a');
      return t.$$('.fi-bulles span').length === 5 && t.texte('.fi-etat .st') === 'En cours'; },
    'Facture et paiement résumés': async () => { const t = await voir('d');
      return /F-2026-0003 du/.test(resumeB1(t, 3)) && /le \d\d\/\d\d\/\d{4} · Chèque/.test(resumeB1(t, 4)); },
    '« Il manque… »': async () => { const t = await voir('f');
      return /Il manque : donneur d’ordre, commune/.test(etapeB1(t, 0)); },
    '← Carnet': async () => { const t = await voir('a');
      if (t.texte('[data-chretour]') !== '← Chantiers') return false;
      t.clic('[data-chretour]'); await t.pause(300); return vueActive(t) === 'vue-carnet'; },
    'Changer le statut': async () => { const t = await neuf('b');
      if (t.texte('#f-statut') !== 'Corriger l’étape à la main') return false;
      t.clic('#f-statut'); await t.pause(300); t.clic('[data-setstatut="encours"]'); await t.pause(400);
      return chB1(t, 'b').statut === 'encours'; },
    'Bouton Fiche de chantier': async () => { const t = await voir('a');
      t.clic('#f-fichech'); await t.pause(400); return vueActive(t) === 'vue-fichech'; },
    'Ce que ça vaut / Ce que ça a rapporté : montant, jours, par journée': async () => { const t = await voir('d');
      const k = t.texte('.fi-kpis');
      return t.$$('.fi-kpi').length === 3 && /900 €encaissé HT/.test(k) && /1,5journées faites/.test(k) &&
        /600 €par jour, réel/.test(k); },
    '… et l\'objectif (prix de journée du chantier)': async () => { const t = await voir('a');
      return /objectif 400 €/.test(t.texte('.fi-kpis')); },
    'Fenêtre « L\'objectif de ce chantier » (chantier soldé) et sa porte « Noter du temps »': async () => {
      const t = await voir('d'); t.clic('#f-objectif'); await t.pause(300);
      if (t.texte('#modale-titre') !== 'L’objectif de ce chantier' || !t.$('#es-temps')) return false;
      t.clic('#es-temps'); await t.pause(300); const ok = !!t.$('#ct-duree'); await fermer(t); return ok; },
    'Bloc Le devis : numéro, dates, lignes, total HT, TVA, pied « le devis disait… »': async () => {
      let t = await voir('a'); const d = etapeB1(t, 1);
      const devis = /N° D-2026-0005/.test(d) && /Édité le/.test(d) && /Envoyé le/.test(d) && /Signé le/.test(d) &&
        t.$$('#f-etapes [data-etape="1"] [data-lmod]').length === 2 && /Total HT2 000 €/.test(d) &&
        /TVA 10 %/.test(t.$('#f-etapes [data-etape="1"]').textContent) && /Total TTC/.test(d);
      t = await voir('c');
      return devis && /Le devis D-2026-0004 disait1 000 €/.test(etapeB1(t, 3)); },
    '… validité du devis': async () => { const t = await voir('a');
      return /Valable 3 mois, jusqu’au \d\d\/\d\d\/\d{4}/.test(etapeB1(t, 1)); },
    '… temps estimé (✎, fenêtre L\'estimation)': async () => { const t = await voir('a');
      if (!t.$('#f-etapes [data-etape="1"] #f-estim')) return false;
      t.clic('#f-estim'); await t.pause(300);
      const ok = t.texte('#modale-titre') === 'L’estimation' && t.$('#es-jest').value === '4'; await fermer(t); return ok; },
    '+ Ligne ; Modifier / ✕ d\'une ligne': async () => { const t = await neuf('e');
      if (!t.$('#f-etapes [data-etape="1"] #f-ligne') || !t.$('[data-lmod="0"]')) return false;
      t.clic('#f-ligne'); await t.pause(300); const ajout = !t.$('#modale').hidden; await fermer(t);
      t.w.confirm = () => true; t.clic('[data-lsup="0"]'); await t.pause(450);
      return ajout && (chB1(t, 'e').lignes || []).length === 0; },
    'Attacher un devis (chantier sans devis)': async () => { const t = await voir('g');
      t.clic('#f-devis-oui'); await t.pause(300);
      const ok = !!t.$('#dv-a') && t.$('#dv-a').checked; await fermer(t); return ok; },
    'Modifier le devis (après facturation)': async () => { const t = await voir('c');
      if (!t.$('#f-etapes [data-etape="1"] #f-devis')) return false;
      t.clic('#f-devis'); await t.pause(300); const ok = !!t.$('#dv-a'); await fermer(t); return ok; },
    'Statut « Devis envoyé / signé », date de signature qui fait passer à « à programmer »': async () => {
      const t = await neuf('f');
      t.clic('#f-envoye'); await t.pause(400);
      const envoye = chB1(t, 'f').statut === 'envoye' && !!chB1(t, 'f').dateEnvoi;
      t.choisir('#f-signe-date', jourISO(JCAL(-1))); t.clic('#f-signe'); await t.pause(400);
      const c = chB1(t, 'f');
      return envoye && c.statut === 'accepte' && jourISO(c.dateSignature) === jourISO(JCAL(-1)); },
    'Refus + motif (statut, bloc Sans suite)': async () => { const t = await neuf('e');
      t.clic('#f-refuse'); await t.pause(300); t.clic('[data-motif="prix"]'); await t.pause(400);
      const c = chB1(t, 'e');
      return c.statut === 'sansuite' && c.motifRefus === 'prix' && /Trop cher/.test(etapeB1(t, 1)) &&
        !!t.$('.fi-bulles .r'); },
    'Bloc La facture : numéro, date, échéance': async () => { const t = await voir('c'); const f = etapeB1(t, 3);
      return /N° F-2026-0010/.test(f) && /Facturé le/.test(f) && /À payer avant le/.test(f); },
    'Saisir la facture ; facture différente du devis (« le devis disait… »)': async () => { const t = await neuf('b');
      t.clic('#f-modlignes'); await t.pause(400);
      const fige = !!chB1(t, 'b').devisFige && /Ce qui est facturé/.test(etapeB1(t, 3)) &&
        !!t.$('#f-etapes [data-etape="3"] [data-lmod]') && /Facturé à l’identique/.test(etapeB1(t, 3));
      t.clic('#f-facture'); await t.pause(300);
      return fige && t.texte('#modale-titre') === 'La facture'; },
    'Statut « Facturé » qui demande le n° de facture': async () => { const t = await neuf('b');
      t.saisir('#ff-num-an', '2026'); t.saisir('#ff-num-rg', '42'); t.clic('#f-facturer'); await t.pause(450);
      const c = chB1(t, 'b');
      return c.statut === 'facture' && c.numeroFacture === 'F-2026-0042' && !!c.dateFacture && !!c.devisFige; },
    'Payé le / Réglé par (la date fait passer à « Payé »)': async () => { const t = await neuf('c');
      t.choisir('#fp-date', jourISO(JCAL(-2))); t.choisir('#fp-moyen', 'virement');
      t.clic('#f-payer'); await t.pause(450); const c = chB1(t, 'c');
      return c.statut === 'paye' && jourISO(c.datePaiement) === jourISO(JCAL(-2)) && c.moyenPaiement === 'virement'; },
    'Bloc Les journées : Date · Fait · Prévu ; fait / reste / estimé': async () => { const t = await voir('a');
      const tr = etapeB1(t, 2);
      return !!t.$('#f-etapes [data-etape="2"] .jtete') && t.$$('#f-etapes [data-etape="2"] .jrang').length === 2 &&
        /reste à faire/.test(tr) && /estimé au devis/.test(tr); },
    '… rendements': async () => { const t = await voir('a');
      if (!/1 000 plant \/ jour-homme/.test(t.texte('#f-rendement'))) return false;
      t.clic('#f-rendement'); await t.pause(300); t.clic('[data-rdcad="PLANT"]'); await t.pause(300);
      const ok = !!t.$('#cd-ch') && t.$('#cd-ch').value === 'a'; await fermer(t); return ok; },
    '… bilan « le devis paie / j\'y ai passé »': async () => { const t = await voir('a');
      return /Le devis paie/.test(etapeB1(t, 2)) && /J’y ai passé/.test(etapeB1(t, 2)); },
    'Poser des dates': async () => { const t = await neuf('h');
      if (t.texte('#f-planifier') !== 'Placer des jours dans l’Agenda') return false;
      t.clic('#f-planifier'); await t.pause(400);
      const agenda = vueActive(t) === 'vue-calendrier';
      t.clic('#cal-planif-fin'); await t.pause(400);
      return agenda && vueActive(t) === 'vue-chantier' && ouvertesB1(t).indexOf('2') >= 0; },
    '✎ des journées (fenêtre Les journées : estimées + dates à la main)': async () => { const t = await voir('h');
      return !t.$('#f-jours') && !!t.$('#f-etapes [data-etape="1"] #f-estim') &&
        !!t.$('#f-etapes [data-etape="2"] #f-planifier'); },
    '+ Du temps fait': async () => { const t = await voir('a');
      if (/Du temps fait/.test(t.texte('#vue-chantier'))) return false;
      await parBarre(t, 'plus'); const ok = !!t.$('#modale [data-plus="journee"]'); await fermer(t); return ok; },
    'Saisie sans date « rattrapage » (temps global d\'un ancien chantier)': async () => { const t = await voir('d');
      if (t.texte('#f-temps') !== 'Ajouter du temps sans date (rattrapage)') return false;
      t.clic('#f-temps'); await t.pause(300); const ok = t.$('#ct-date').value === ''; await fermer(t); return ok; },
    'Case « Ce chantier est terminé » (Ma journée) → « Terminé, à facturer »': async () => { const t = await neuf('a');
      t.clic('#f-termine'); await t.pause(450); const c = chB1(t, 'a');
      return c.statut === 'termine' && !!c.dateFin && ouvertesB1(t).join() === '3'; },
    'Bloc Fournitures : consommation, refacturé, coût, marge': async () => { const t = await voir('a');
      t.clic('#f-fournitures'); await t.pause(300);
      const ok = /^Fournitures —/.test(t.texte('#modale-titre')); await fermer(t); return ok; },
    'Bloc Le peuplement (✎)': async () => { const t = await voir('a');
      if (!/Douglas · 1 100 plants\/ha · surface à préciser/.test(t.texte('#f-peuplement'))) return false;
      t.clic('#f-peuplement'); await t.pause(300);
      const ok = !!t.$('#ce-ess') && !!t.$('#ce-dens') && !!t.$('#ce-surf'); await fermer(t); return ok; },
    'Bloc Déplacements (km)': async () => { const t = await voir('a');
      return /30 km · carburant estimé/.test(etapeB1(t, 2)) && /30 km/.test(t.texte('#f-etapes [data-etape="2"] .jrang')); },
    'Bloc Note (✎)': async () => { const t = await voir('a');
      if (!/portail code 1234/.test(t.texte('#f-note')) || !/Ce que je sais ?portail code 1234/.test(etapeB1(t, 0))) return false;
      t.clic('#f-note'); await t.pause(300); const ok = t.$('#nc-txt').value === 'portail code 1234'; await fermer(t); return ok; },
    'Supprimer ce chantier (corbeille)': async () => { const t = await neuf('g');
      t.w.confirm = () => true; t.clic('#f-sup'); await t.pause(450);
      return !chB1(t, 'g').id && vueActive(t) === 'vue-carnet'; },
    'Infos : dates d\'annonce et de repérage': async () => { const t = await voir('a');
      return new RegExp('Annoncé le ' + new Date(JCAL(-40)).toLocaleDateString('fr-FR') + ' ?Repérage : pas encore')
        .test(etapeB1(t, 0)); },
    '(nouveau) Noter le repérage': async () => { const t = await neuf('f');
      t.clic('#f-reperage'); await t.pause(300);
      if (t.texte('#modale-titre') !== 'Noter le repérage') return false;
      t.choisir('#rp-date', jourISO(JCAL(-1))); t.choisir('#rp-ess', 'CHS');
      t.saisir('#rp-dens', '1600'); t.saisir('#rp-surf', '2,5'); t.saisir('#rp-vu', 'pente forte');
      t.clic('#rp-ok'); await t.pause(450); const c = chB1(t, 'f');
      return jourISO(c.dateReperage) === jourISO(JCAL(-1)) && c.vuReperage === 'pente forte' && c.surface === 2.5 &&
        c.criteres.densite === 1600 && c.criteres.essence === 'CHS' && /Ce que j’ai vu le/.test(etapeB1(t, 0)) &&
        /repéré le/.test(resumeB1(t, 0)) && /2,5 ha/.test(t.texte('.fi-lieu')); },
    '(nouveau) Étape Devis d\'un chantier sans devis choisi': async () => { const t = await neuf('f');
      if (ouvertesB1(t).join() !== '0,1' || !t.$('#f-sansdevis') || t.texte('#f-devis') !== 'Saisir le devis') return false;
      t.clic('#f-sansdevis'); await t.pause(450); const c = chB1(t, 'f');
      return c.aDevis === false && c.statut === 'accepte' && !!t.$('#f-devis-oui') &&
        /Temps estimé \(facultatif\)/.test(etapeB1(t, 1)) && ouvertesB1(t).join() === '2'; },
    'Toutes les portes vers la fiche (Ouvrir du Carnet, alerte À traiter, bulle à un seul chantier, rappel de devis, carte Journée ▸ Ouvrir, À planifier ▸ Estimer, fiche d\'un jour ▸ Fiche, fin d\'un placement, Estimer ▸ Créer le devis)': async () => {
      const t = await ouvrir(Object.assign({}, VIDE, B1())); await t.pause(200);
      const sur = async (quoi, attendu, etape) => {
        const ok = vueActive(t) === 'vue-chantier' && new RegExp('Facturé à : ' + attendu).test(t.texte('#f-bloc-chantier')) &&
          (etape == null || ouvertesB1(t).indexOf(etape) >= 0);
        verifierVrai('porte « ' + quoi + ' » : la fiche, à l’étape utile', ok);
        return ok;
      };
      let tout = true;
      /* Aujourd'hui : l'impayée ouvre l'étape Payé ; « À programmer ▸ Estimer »
         est parti au lot r1 : la ligne de Chantiers en cours ouvre l'étape en
         cours, et l'estimation est dans l'étape Devis. */
      await parBarre(t, 'aujourdhui');
      t.clic('[data-ajcle="impaye:c"] [data-ajouvre]'); await t.pause(400);
      tout = await sur('Aujourd’hui ▸ facture impayée', 'Charles', '4') && tout;
      await parBarre(t, 'aujourdhui');
      t.clic('#aj-encours [data-ajch="g"]'); await t.pause(400);
      tout = await sur('Aujourd’hui ▸ Chantiers en cours', 'Gaston', String(t.w.BCC.etapeChantier(chB1(t, 'g')))) && tout;
      /* L'Agenda : « Fiche » de la fiche du jour. */
      await parBarre(t, 'agenda');
      await cliquerJour(t, JCAL(5));
      t.clic('[data-fjouvrir="a"]'); await t.pause(400);
      tout = await sur('fiche du jour ▸ Fiche', 'Martin', '2') && tout;
      /* Le carnet : Ouvrir, et l'alerte « À traiter ». */
      await parBarre(t, 'chantiers'); t.choisir('#c-filtre', 'tous'); await t.pause(200);
      t.clic('[data-chouvrir="e"]'); await t.pause(400);
      tout = await sur('Chantiers ▸ Ouvrir', 'Émile', '1') && tout;
      await parBarre(t, 'chantiers');
      tout = t.clic('[data-groupe="faire"] [data-chouvrir="c"]') && tout; await t.pause(400);
      tout = await sur('Chantiers ▸ À faire maintenant', 'Charles', '4') && tout;
      return tout && t.erreurs.length === 0; }
  };
  return P;
}
for (const moitie of [0, 1]) {
  scenario('Fiche en étapes : rien de l’ancienne fiche ne s’est perdu (lot b1, ' + (moitie + 1) + '/2)', async () => {
    const lignes = lignesTable32(), P = preuvesB1(), cles = Object.keys(P);
    if (moitie === 0) verifier('la table 3.2 cite les lignes, chacune avec sa preuve', cles, lignes);
    const n = Math.ceil(lignes.length / 2);
    for (const l of lignes.slice(moitie * n, (moitie + 1) * n)) {
      const p = P[l];
      let ok = false;
      try { ok = !!(p && await p()); } catch (e) { console.log('        ' + e.message); }
      verifierVrai('« ' + l.slice(0, 70) + ' » : retrouvé, même effet', ok);
    }
  });
}

/* --------------------------------------------------------------------- */
scenario('Fiche en étapes : l’argent, au centime près de l’ancienne fiche', async () => {
  /* Les totaux du devis, taux par taux, et les trois chiffres de tête. Réel
     et au devis sont recalculés ici comme les calculait l'ancienne fiche
     (ce que ça vaut : montant hors débours ÷ journées estimées ; ce que ça
     a rapporté : montant hors débours ÷ temps passé), pour s'assurer
     qu'aucun chiffre n'a bougé avec la forme. */
  const t = await ouvrir(Object.assign({}, VIDE, B1()));
  const C = t.w.BCC;
  const a = chB1(t, 'a');
  /* Le chantier « a » : PLANT 1 000 × 1,20 au taux réduit (SIREN), 1 000
     protections × 0,80 à 20 %. */
  verifier('TVA par taux, le plus fort d’abord', [{ taux: 20, base: 800, tva: 160 }, { taux: 10, base: 1200, tva: 120 }],
    C.tvaParTaux(a));
  verifier('la somme des taux fait la TVA du chantier', C.tvaChantier(a),
    C.tvaParTaux(a).reduce((s, x) => s + x.tva, 0));
  verifier('part prestation et part vente', { prestation: 1200, vente: 800, debours: 0 }, C.partsChantier(a));
  await ficheB1(t, 'a');
  const d = t.$('#f-etapes [data-etape="1"]').textContent.replace(/\s+/g, ' ');
  verifierVrai('Total HT 2 000 €', /Total HT ?2 000 €/.test(d));
  verifierVrai('TVA 20 % sur 800 € : 160 €', /TVA 20 % sur 800 € ?160 €/.test(d));
  verifierVrai('TVA 10 % sur 1 200 € : 120 €', /TVA 10 % sur 1 200 € ?120 €/.test(d));
  verifierVrai('Total TTC 2 280 €', /Total TTC ?2 280 €/.test(d));
  verifierVrai('Prestation 1 200 €, Vente 800 €', /Prestation 1 200 €/.test(d) && /Vente 800 €/.test(d));

  /* Les trois chiffres, statut par statut, face à l'ancienne formule. */
  const ancien = c => {
    const solde = ['termine', 'facture', 'paye'].indexOf(c.statut) >= 0;
    const m = C.montantHorsDebours(c), j = solde ? C.tempsPasse(c, { heuresJour: 8 }) : C.joursPrevus(c);
    return j > 0 ? Math.round(m / j) : null;
  };
  const lu = () => { const b = t.$$('.fi-kpi b')[2]; return b ? Number(b.textContent.replace(/[^\d]/g, '')) || null : null; };
  for (const [id, mode] of [['d', 'réel'], ['e', 'au devis'], ['h', 'au devis']]) {
    await ficheB1(t, id);
    const temps = B1().journees.filter(j => j.chantier === id).map(j => ({ date: j.date, unite: 'h',
      duree: j.postes.reduce((s, p) => s + p.heures, 0), personnes: 1 }));
    const vif = Object.assign({}, chB1(t, id), { temps });
    verifier('« ' + id + ' » : par jour ' + mode + ', comme l’ancienne fiche', ancien(vif), lu());
    verifierVrai('« ' + id + ' » : le mode est dit', new RegExp('par jour, ' + mode).test(t.texte('.fi-kpis')));
  }
  /* Demi-journée : 8 h + 4 h font une journée et demie, 900 € ÷ 1,5 = 600 €. */
  await ficheB1(t, 'd');
  verifierVrai('une journée et demie se lit 1,5', /1,5journées faites/.test(t.texte('.fi-kpis')));
  verifier('600 € la journée, réel', 600, lu());
  /* Au rythme actuel : 500 plants sur 1 000 en une journée, le chantier en
     prendra deux ; 2 000 € ÷ 2 = 1 000 € la journée. */
  await ficheB1(t, 'a');
  verifierVrai('l’avancement se lit, pondéré par le montant', /50 %/.test(etapeB1(t, 2)));
  verifier('par jour au rythme actuel', 1000, lu());
  verifierVrai('le mode est dit', /par jour, au rythme actuel/.test(t.texte('.fi-kpis')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche en étapes : l’étape ouverte suit le statut', async () => {
  /* Celle en cours, seule ouverte ; le Devis aussi tant que le chantier est
     à l'étape Infos ; un payé, tout replié en résumés. */
  const t = await ouvrir(Object.assign({}, VIDE, B1()));
  const attendu = { f: ['0', '1'], e: ['1'], h: ['2'], g: ['2'], a: ['2'], b: ['3'], c: ['4'], d: [] };
  for (const id of Object.keys(attendu)) {
    await ficheB1(t, id);
    verifier('« ' + chB1(t, id).statut + (chB1(t, id).aDevis ? '' : ', sans devis') + ' » ouvre ' +
      (attendu[id].join(' et ') || 'rien'), attendu[id], ouvertesB1(t));
  }
  /* Le nom de l'étape « Devis signé, à programmer » et celui sans devis. */
  await ficheB1(t, 'h');
  verifierVrai('« Devis signé, à programmer » : Travaux, « à programmer »',
    /à programmer/.test(resumeB1(t, 2)) && t.texte('.fi-etat .st') === 'Devis signé, à programmer');
  await ficheB1(t, 'g');
  verifierVrai('sans devis : « À programmer », et l’étape Devis le dit',
    t.texte('.fi-etat .st') === 'À programmer' && /sans devis/.test(resumeB1(t, 1)));
  /* Ce qu'il déplie se garde sur le même chantier. */
  t.$('#f-etapes [data-etape="0"]').open = true;
  t.$('#f-etapes [data-etape="0"]').dispatchEvent(new t.w.Event('toggle'));
  t.clic('#f-note'); await t.pause(250); t.saisir('#nc-txt', 'accès par le haut'); t.clic('#nc-ok'); await t.pause(400);
  verifier('enregistrer une note ne replie rien', ['0', '2'], ouvertesB1(t));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Lot 5b3 (4.87.2) : plus d'écran trop large. JSDOM ne calcule aucune mise en
   page : la mesure réelle (360 et 320 px, tous les écrans) est dans
   outils/largeur.js, jouée par le contrôle. Ici on garde la CAUSE : une rangée
   de pastilles qui défile de côté doit être bornée à la largeur de l'écran,
   sans quoi elle prend celle de ses pastilles et élargit la page entière. */
scenario('Largeur : les rangées qui défilent de côté sont bornées à l’écran', async () => {
  const regle = sel => {
    const i = html.indexOf('\n' + sel + '{');
    return i < 0 ? '' : html.slice(i, html.indexOf('}', i));
  };
  const onglets = regle('.onglets');
  verifierVrai('la rangée des pastilles est trouvée', onglets);
  verifierVrai('elle défile de côté', /overflow-x:auto/.test(onglets));
  verifierVrai('et ne dépasse pas l’écran : width:100% (margin auto la détendait)', /(^|[;{\s])width:100%/.test(onglets));
  const bouton = html.slice(html.indexOf('.onglets button{'), html.indexOf('}', html.indexOf('.onglets button{')));
  verifierVrai('chaque pastille garde sa taille et fait défiler la rangée', /flex:none/.test(bouton) && /white-space:nowrap/.test(bouton));
  /* Les autres rangées et blocs qui défilent, de la même façon. */
  ['.ruban', '.tab-boite', '.sous-onglets'].forEach(sel => {
    verifierVrai(sel + ' défile dans son bloc', /overflow-x:auto/.test(regle(sel)));
  });
  /* La mesure dans Chrome l'a trouvé au lot b2 : un risque d'une phrase,
     sans retour à la ligne, élargissait la Fiche sécurité à 366 px. */
  verifierVrai('les risques de la Fiche sécurité reviennent à la ligne',
    /white-space:normal/.test(regle('#fch-corps .chip')) && /max-width:100%/.test(regle('#fch-corps .chip')));
  verifierVrai('la barre du bas est collée à l’écran, pas à la page', /\.barre\{[^}]*position:fixed[^}]*left:0;right:0;bottom:0/.test(html));
});

scenario('Largeur : la pastille ouverte est amenée en vue dans la rangée', async () => {
  /* Argent a quatre pastilles, Analyses est la dernière : sur un petit écran
     elle est hors de vue tant que la rangée n'a pas défilé jusqu'à elle. JSDOM
     n'a pas de géométrie : on la lui prête (rangée de 300 px sur 600, pastilles
     de 120 px) et l'on vérifie le défilement demandé. */
  const t = await ouvrir(Object.assign({}, VIDE, {}), { avant: w => {
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      const nav = this.closest && this.closest('#onglets');
      if (this.id === 'onglets') return { left: 0, width: 300, right: 300, top: 0, bottom: 40, height: 40 };
      if (nav && this.tagName === 'BUTTON') {
        const rang = Array.prototype.indexOf.call(nav.children, this);
        return { left: rang * 120 - nav.scrollLeft, width: 120, right: rang * 120 + 120, top: 0, bottom: 40, height: 40 };
      }
      return { left: 0, width: 0, right: 0, top: 0, bottom: 0, height: 0 };
    };
    Object.defineProperty(w.HTMLElement.prototype, 'scrollWidth', { configurable: true,
      get() { return this.id === 'onglets' ? 600 : 0; } });
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { configurable: true,
      get() { return this.id === 'onglets' ? 300 : 0; } });
  } });
  await parBarre(t, 'argent');
  verifier('Bilan est ouvert : rien à défiler', 0, t.$('#onglets').scrollLeft);
  t.clic('#onglets [data-vue="analyses"]'); await t.pause(200);
  verifier('Analyses est ouverte, 4e pastille (360 à 480)', 'analyses', t.$('#onglets [aria-selected="true"]').dataset.vue);
  /* gauche 360, largeur 120, rangée 300 : centrée, la rangée est à 360 − 90 */
  verifier('la rangée a défilé pour la centrer', 270, t.$('#onglets').scrollLeft);
  t.clic('#onglets [data-vue="finances"]'); await t.pause(200);
  verifier('de retour sur Bilan, la rangée revient au début', 0, t.$('#onglets').scrollLeft);
  verifier('aucune erreur', [], t.erreurs);
});

/* ===================================================== lot b2 (4.91.0)
   La liste Chantiers, la création courte, la Fiche sécurité. Un carnet où
   chaque statut est représenté, et chaque alerte de l'ancien « À traiter ». */
const B2 = () => ({
  module: 'chantiers', cfg: { heuresJour: 8, journeesMigrees: true },
  clients: ['Cabinet Dubois', 'ONF'], proprios: ['Martin'],
  chantiers: [
    /* Deux devis à faire, l'un repéré ; un devis envoyé. */
    { id: 'dv', statut: 'devis', aDevis: true, maj: Date.now(), dateEntree: JCAL(-3),
      donneur: 'Cabinet Dubois', proprietaire: 'Martin', commune: 'Clairbois', temps: [], jours: [],
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 800, prix: 1.1, nature: 'prestation' }] },
    { id: 'dr', statut: 'devis', aDevis: true, maj: Date.now(), dateEntree: JCAL(-9), dateReperage: JCAL(-2),
      donneur: 'ONF', proprietaire: 'Roux', commune: 'Lizon', temps: [], jours: [], lignes: [] },
    { id: 'en', statut: 'envoye', aDevis: true, maj: Date.now(), dateEntree: JCAL(-20), dateEnvoi: JCAL(-6),
      donneur: 'ONF', proprietaire: 'Émile', commune: 'Amancey', numeroDevis: 'D-2026-0007', temps: [], jours: [],
      lignes: [{ travail: 'REGARNI', unite: 'plant', quantite: 500, prix: 1.5, nature: 'prestation' }] },
    /* À programmer : avec devis signé, et sans devis. */
    { id: 'ac', statut: 'accepte', aDevis: true, maj: Date.now(), dateEntree: JCAL(-25), dateSignature: JCAL(-4),
      donneur: 'ONF', proprietaire: 'Hugo', commune: 'Nans', joursEstimes: 2, temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 750, nature: 'prestation' }] },
    { id: 'sd', statut: 'accepte', aDevis: false, maj: Date.now(), dateEntree: JCAL(-5),
      donneur: 'ONF', proprietaire: 'Gaston', commune: 'Mouthier', temps: [], jours: [],
      lignes: [{ travail: 'ELAG', unite: 'ha', quantite: 1, prix: 800, nature: 'prestation' }] },
    /* En cours, avec des jours à venir ; ses risques servent à « Déjà connu ici ». */
    { id: 'ec', statut: 'encours', aDevis: true, maj: Date.now(), dateEntree: JCAL(-30), joursEstimes: 3,
      donneur: 'Cabinet Dubois', proprietaire: 'Paul', commune: 'Ornans', foret: 'Bois Joli', temps: [],
      jours: [{ d: JCAL(4), p: 1 }, { d: JCAL(5), p: 1 }, { d: JCAL(6), p: 1 }],
      fiche: { risques: [1, 9] },
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1000, prix: 1.2, nature: 'prestation' }] },
    /* En cours, cinq hectares, même forêt : la fiche sécurité est obligatoire. */
    { id: 'gr', statut: 'encours', aDevis: true, maj: Date.now(), dateEntree: JCAL(-35),
      donneur: 'ONF', proprietaire: 'Gilles', commune: 'Ornans', foret: 'Bois Joli', temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 5, prix: 700, nature: 'prestation' }] },
    /* En retard : sa seule journée posée est passée, rien à placer de plus. */
    { id: 'rt', statut: 'encours', aDevis: true, maj: Date.now(), dateEntree: JCAL(-40), joursEstimes: 1,
      donneur: 'ONF', proprietaire: 'Rémi', commune: 'Vuillafans', temps: [], jours: [{ d: JCAL(-3), p: 1 }],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 700, nature: 'prestation' }] },
    /* Terminé il y a cinq jours (à facturer), et terminé aujourd'hui. */
    { id: 'tf', statut: 'termine', aDevis: true, maj: Date.now(), dateEntree: JCAL(-50), dateFin: JCAL(-5),
      donneur: 'ONF', proprietaire: 'Bernard', commune: 'Valbrune', temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 700, nature: 'prestation' }] },
    { id: 'tn', statut: 'termine', aDevis: true, maj: Date.now(), dateEntree: JCAL(-50), dateFin: Date.now(),
      donneur: 'ONF', proprietaire: 'Thomas', commune: 'Lods', temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 700, nature: 'prestation' }] },
    /* Facturés : l'un échu, l'autre pas encore. */
    { id: 'fi', statut: 'facture', aDevis: true, maj: Date.now(), dateEntree: JCAL(-90),
      donneur: 'ONF', proprietaire: 'Charles', commune: 'Lizon', numeroFacture: 'F-2026-0010',
      dateFacture: JCAL(-40), echeancePaiement: JCAL(-10), temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 600, nature: 'prestation' }] },
    { id: 'fa', statut: 'facture', aDevis: true, maj: Date.now(), dateEntree: JCAL(-60),
      donneur: 'ONF', proprietaire: 'Félix', commune: 'Ornans', numeroFacture: 'F-2026-0011',
      dateFacture: JCAL(-3), echeancePaiement: JCAL(27), temps: [], jours: [],
      lignes: [{ travail: 'NETT', unite: 'ha', quantite: 1, prix: 900, nature: 'prestation' }] },
    /* Payés : un récent, deux plus anciens de montants et de donneurs différents. */
    { id: 'pr', statut: 'paye', aDevis: false, maj: Date.now(), dateEntree: JCAL(-80),
      donneur: 'Forêts et Gestion', proprietaire: 'Denis', commune: 'Mouthe', numeroFacture: 'F-2026-0012',
      dateFacture: JCAL(-20), datePaiement: JCAL(-5), temps: [], jours: [],
      lignes: [{ travail: 'NETT', unite: 'ha', quantite: 1, prix: 3000, nature: 'prestation' }] },
    { id: 'p1', statut: 'paye', aDevis: false, maj: Date.now(), dateEntree: JCAL(-300),
      donneur: 'Zébulon', proprietaire: 'Yves', commune: 'Septmoncel', numeroFacture: 'F-2025-0040',
      dateFacture: JCAL(-120), datePaiement: JCAL(-100), temps: [], jours: [],
      lignes: [{ travail: 'NETT', unite: 'ha', quantite: 1, prix: 500, nature: 'prestation' }] },
    { id: 'p2', statut: 'paye', aDevis: false, maj: Date.now(), dateEntree: JCAL(-400),
      donneur: 'Albert', proprietaire: 'Xavier', commune: 'Bief', numeroFacture: 'F-2025-0030',
      dateFacture: JCAL(-220), datePaiement: JCAL(-200), temps: [], jours: [],
      lignes: [{ travail: 'NETT', unite: 'ha', quantite: 1, prix: 2000, nature: 'prestation' }] },
    { id: 'ss', statut: 'sansuite', aDevis: true, maj: Date.now(), dateEntree: JCAL(-70),
      donneur: 'ONF', proprietaire: 'Sylvain', commune: 'Lods', temps: [], jours: [], lignes: [] }
  ]
});
/* Ce que chaque groupe doit porter, dans cet ordre (le plus urgent en haut). */
const GROUPES_B2 = {
  faire: ['fi', 'tf'], travaux: ['tn', 'ec', 'rt', 'gr', 'ac', 'sd'], factures: ['fa'],
  devis: ['dr', 'dv', 'en'], payes: ['pr']
};
const groupeB2 = (t, g) => t.$$('#liste-chantiers [data-groupe="' + g + '"] [data-chouvrir]').map(b => b.dataset.chouvrir);
const pliB2 = (t, p) => t.$('#liste-chantiers [data-pli="' + p + '"]');
const idsPliB2 = (t, p) => { const d = pliB2(t, p); return d ? [...d.querySelectorAll('[data-chouvrir]')].map(b => b.dataset.chouvrir) : []; };
const situB2 = (t, id) => { const b = t.$('#liste-chantiers [data-chouvrir="' + id + '"] .aj-situ'); return b ? b.textContent : ''; };
const chB2 = (t, id) => (t.stock('chantiers') || []).filter(c => c.id === id)[0] || {};
async function listeB2(t) {
  t = t || await ouvrir(Object.assign({}, VIDE, B2()));
  await parBarre(t, 'chantiers');
  return t;
}
async function plusChantier(t) {
  await parBarre(t, 'plus');
  t.clic('#modale [data-plus="chantier"]'); await t.pause(300);
}

/* Les lignes « Ancien » des sections 3.1 et 3.3, lues dans la table de
   correspondance : chacune a ici sa preuve, jouée sur la nouvelle liste ou la
   Fiche sécurité. Une ligne sans preuve, ou une preuve sans ligne, crie. */
const lignesTableB2 = () => {
  const l = fs.readFileSync(path.join(__dirname, '..', 'docs', 'correspondance-refonte.md'), 'utf8').split(/\r?\n/);
  const out = []; let dedans = false, entete = false;
  l.forEach(x => {
    if (/^### 3\.[13] /.test(x)) { dedans = true; entete = true; return; }
    if (/^##/.test(x)) { dedans = false; return; }
    if (dedans && /^\| /.test(x)) {
      if (entete) { entete = false; return; }
      out.push(x.split('|')[1].trim());
    }
  });
  return out;
};
function preuvesB2() {
  let tL = null;
  const voir = async () => { if (!tL) tL = await ouvrir(Object.assign({}, VIDE, B2())); return listeB2(tL); };
  const neuf = async () => listeB2();
  const fermer = async t => { t.clic('#modale-x'); await t.pause(150); };
  return {
    'Accès : Mon entreprise ▸ Chantiers, ou onglet Carnet du Calendrier': async () => { const t = await voir();
      const ok = vueActive(t) === 'vue-carnet' && pastilles(t)[0] === 'Liste';
      await parBarre(t, 'agenda');
      return ok && !t.$('#onglets [data-vue="carnet"]'); },
    '« À traiter (N) » (journées passées, à facturer, facture impayée)': async () => { const t = await voir();
      const ok = groupeB2(t, 'faire').join() === GROUPES_B2.faire.join() &&
        t.texte('[data-groupe="faire"] .aj-compte') === '2' &&
        /^Facture échue depuis 10 j · n° F-2026-0010$/.test(situB2(t, 'fi')) &&
        /^Terminé il y a 5 j, à facturer$/.test(situB2(t, 'tf')) &&
        /* Lot r1b : les jours passés ne relancent plus, rt est en travaux. */
        groupeB2(t, 'travaux').indexOf('rt') >= 0 && !/chantier pas encore terminé/.test(situB2(t, 'rt')) &&
        !t.$('#bandeau-alertes');
      await parBarre(t, 'aujourdhui');
      return ok && !!ligneAuj(t, 'impaye:fi') && !!ligneAuj(t, 'afacturer:tf'); },
    'Bouton « Nouveau chantier »': async () => { const t = await voir();
      if (t.$('#c-nouveau')) return false;
      await plusChantier(t);
      const ok = t.texte('#modale-titre') === 'Nouveau chantier'; await fermer(t); return ok; },
    /* Lot d1 : les cumuls ont quitté le bas de Chantiers pour Argent ▸ Année
       ▸ Vue d'ensemble ▸ « Depuis le début », replié ; « encaissé » y dit
       « dont payé ». Mêmes chiffres qu'au lot b2. */
    'Carte Carnet : facturé, encaissé, devis signés, premier donneur d\'ordre (tout l\'historique)': async () => {
      const t = await voir();
      if (t.$('#ch-cumuls') || t.$('#vue-carnet #carnet-totaux')) return false;
      await parBarre(t, 'argent'); t.clic('[data-vue="analyses"]'); await t.pause(200);
      t.clic('[data-ana="ensemble"]'); await t.pause(200);
      const d = t.$('#ana-corps [data-loin="an-cumuls"]'), k = sansBlancs(t.texte('#carnet-totaux'));
      const ok = !!d && !d.open && /^Depuis le début/.test(t.texte('[data-loin="an-cumuls"] summary')) &&
        t.$$('#carnet-totaux .carte2').length === 4 && /7600€facturé·5factures/.test(k) &&
        /5500€dontpayé/.test(k) && !/encaissé/.test(k) && /2devissignés·1550€/.test(k) && /3000€ForêtsetGestion·39%/.test(k);
      await parBarre(t, 'chantiers');
      return ok; },
    'Ligne de comptes : ouverts, jours-homme cumulés, à facturer, jours passés': async () => { const t = await voir();
      const k = t.texte('#ana-corps [data-loin="an-cumuls"] #carnet-totaux') || '';
      return /12 chantiers ouverts/.test(k) && /jours-homme cumulés/.test(k) && /2 à facturer/.test(k) &&
        /1 avec plus de jour posé/.test(k) && t.texte('[data-groupe="travaux"] .aj-compte') === '6'; },
    'Recherche (nom, donneur d\'ordre, commune, n° de facture)': async () => { const t = await voir();
      const trouve = async q => { t.saisir('#c-rech', q); await t.pause(150);
        return t.$$('#ch-trouves [data-chouvrir]').map(b => b.dataset.chouvrir).join(); };
      const ok = await trouve('emile') === 'en' && await trouve('Forêts et Gestion') === 'pr' &&
        await trouve('septmoncel') === 'p1' && await trouve('F-2025-0030') === 'p2' && !t.$('[data-groupe]');
      t.saisir('#c-rech', ''); await t.pause(150);
      return ok && !!t.$('[data-groupe="faire"]'); },
    'Filtre par statut': async () => { const t = await voir();
      const groupes = Object.keys(GROUPES_B2).every(g => groupeB2(t, g).join() === GROUPES_B2[g].join());
      const plis = idsPliB2(t, 'anciens').sort().join() === 'p1,p2' && idsPliB2(t, 'sansuite').join() === 'ss' &&
        !pliB2(t, 'sansuite').open && !t.$('[data-groupe="sansuite"]') &&
        t.$('#liste-chantiers > :last-child') === pliB2(t, 'sansuite');
      /* L'ancien filtre, replié en bas : familles, statuts, « à compléter ». */
      t.choisir('#c-filtre', 'sansuite'); await t.pause(150);
      const filtre = t.$$('#ch-filtre-liste [data-chouvrir]').map(b => b.dataset.chouvrir).join() === 'ss' &&
        t.$$('#c-filtre optgroup').map(g => g.label).join() === 'Ouverts,Clos,Familles de travaux';
      t.choisir('#c-filtre', 'ouverts'); await t.pause(100);
      return groupes && plis && filtre; },
    'Où va « Devis signé, à programmer » (et « À programmer » sans devis)': async () => { const t = await voir();
      return groupeB2(t, 'travaux').indexOf('ac') >= 0 && groupeB2(t, 'travaux').indexOf('sd') >= 0 &&
        /^Signé · à programmer · 2 journées à placer$/.test(situB2(t, 'ac')) &&
        /^Sans devis · à programmer$/.test(situB2(t, 'sd')); },
    'Tri et sens du tri': async () => { const t = await neuf();
      const ordre = () => idsPliB2(t, 'anciens').join();
      const opts = t.$$('#c-tri option').map(o => o.value).join();
      if (opts !== 'auto,facture,datefacture,paiement,devis,entree,montant,donneur') return false;
      t.choisir('#c-tri', 'montant'); await t.pause(150);
      const gros = ordre() === 'p2,p1' && /plus gros d’abord/.test(t.texte('#c-sens'));
      t.clic('#c-sens'); await t.pause(150);
      const petit = ordre() === 'p1,p2' && /plus petit d’abord/.test(t.texte('#c-sens'));
      t.choisir('#c-tri', 'donneur'); await t.pause(150);
      const za = ordre() === 'p1,p2' && t.texte('#c-sens') === 'Z → A';
      t.clic('#c-sens'); await t.pause(150);
      const az = ordre() === 'p2,p1' && t.texte('#c-sens') === 'A → Z';
      t.choisir('#c-tri', 'paiement'); await t.pause(150);
      const date = ordre() === 'p1,p2' && /plus récent d’abord/.test(t.texte('#c-sens'));
      /* Les groupes du haut gardent leur ordre fixe, quel que soit le tri. */
      return gros && petit && za && az && date && groupeB2(t, 'faire').join() === GROUPES_B2.faire.join(); },
    'Ligne : nom, donneur, dates, badge de statut, n° de facture, montants HT / TTC / TVA': async () => {
      const t = await voir(), b = t.$('[data-groupe="payes"] [data-chouvrir="pr"]');
      return !!b && !!b.querySelector('.aj-txt b').textContent &&
        b.querySelector('.aj-txt small').textContent === 'Mouthe · Forêts et Gestion' &&
        /^Facturé le \S+ · payé le \S+ · n° F-2026-0012$/.test(situB2(t, 'pr')) &&
        sansBlancs(b.querySelector('.aj-droite b').textContent) === '3000€' &&
        b.querySelectorAll('.aj-points i').length === 5 && b.querySelectorAll('.aj-points i.f').length === 5; },
    'Ligne ▸ Ouvrir': async () => { const t = await neuf();
      t.clic('[data-groupe="faire"] [data-chouvrir="fi"]'); await t.pause(400);
      const impaye = vueActive(t) === 'vue-chantier' && ouvertesB1(t).join() === '4';
      await parBarre(t, 'chantiers');
      t.clic('[data-groupe="devis"] [data-chouvrir="en"]'); await t.pause(400);
      return impaye && ouvertesB1(t).join() === '1' && /Facturé à : Émile/.test(t.texte('#f-bloc-chantier')); },
    'Ligne ▸ Temps': async () => { const t = await voir();
      if (t.$('[data-chtemps]')) return false;
      await parBarre(t, 'plus'); const ok = !!t.$('#modale [data-plus="journee"]'); await fermer(t); return ok; },
    'Ligne ▸ Statut': async () => { const t = await neuf();
      if (t.$('[data-chstatut]')) return false;
      t.clic('[data-chouvrir="ac"]'); await t.pause(400);
      t.clic('#f-statut'); await t.pause(300); t.clic('[data-setstatut="encours"]'); await t.pause(400);
      return chB2(t, 'ac').statut === 'encours'; },
    'Calendrier ▸ onglet Carte (recherche de commune, Ma position, − / + / Tout voir, Poser un chantier, fonds de carte, liste)': async () => {
      const t = await neuf();
      t.clic('#onglets [data-vue="carte"]'); await t.pause(400);
      const tout = vueActive(t) === 'vue-carte' && ['#carte-rech', '#carte-chercher', '#carte-ici', '#carte-moins',
        '#carte-plus', '#carte-tout', '#carte-poser', '#carte-fonds', '#carte-liste', '#carte-plan'].every(s => t.$(s));
      t.clic('#carte-poser'); await t.pause(300);
      t.choisir('#pc-ch', 'dv'); t.clic('#pc-ok'); await t.pause(300);
      const poser = /Appuyez sur la carte/.test(t.$('#carte-aide').textContent);
      t.clic('#onglets [data-vue="carnet"]'); await t.pause(300);
      const retour = vueActive(t) === 'vue-carnet';
      await parBarre(t, 'agenda');
      return tout && poser && retour && !t.$('#onglets [data-vue="carte"]'); },
    'Onglet « Fiche de chantier », bouton de la fiche': async () => { const t = await neuf();
      const p = t.$('#onglets [data-vue="fichech"]');
      if (!p || p.textContent.trim() !== 'Fiche sécurité') return false;
      p.click(); await t.pause(350);
      const onglet = vueActive(t) === 'vue-fichech' && t.texte('#b-ecran') === 'Fiche sécurité';
      await parBarre(t, 'chantiers');
      t.clic('[data-chouvrir="dv"]'); await t.pause(400);
      t.clic('#f-fichech'); await t.pause(400);
      const tuile = vueActive(t) === 'vue-fichech' && /Fiche/.test(t.texte('#b-retour'));
      return onglet && tuile && !/Fiche de chantier/.test(t.texte('#onglets') + t.texte('#b-ecran') + t.texte('#vue-fichech')); },
    'Choix du filtre et du chantier': async () => { const t = await neuf();
      t.clic('#onglets [data-vue="fichech"]'); await t.pause(350);
      const ouverts = t.$$('#fch-ch option').map(o => o.value);
      t.choisir('#fch-filtre', 'tous'); await t.pause(300);
      const tous = t.$$('#fch-ch option').map(o => o.value);
      t.choisir('#fch-ch', 'ec'); await t.pause(400);
      return ouverts.indexOf('p1') < 0 && tous.indexOf('p1') >= 0 && /Paul/.test(t.texte('#fch-corps')); },
    'Alerte « fiche obligatoire » (plus de 4 ha), « Il manque » + Compléter le chantier, Qui / où / quoi, Période d\'intervention, « Déjà connu ici » + Reprendre ses risques, familles de risques, Secours (accès, réseau, « Sa position, je suis dessus »), Co-activité et croquis, Aperçu, Imprimer / PDF': async () => {
      const t = await neuf();
      t.clic('#onglets [data-vue="fichech"]'); await t.pause(350);
      t.choisir('#fch-ch', 'gr'); await t.pause(400);
      const x = t.texte('#fch-corps');
      const blocs = /Fiche obligatoire/.test(x) && /Il manque/.test(x) && !!t.$('#fch-identite') &&
        /Qui, où, quoi/.test(x) && /Facturé à/.test(x) && !!t.$('#fch-debut') && !!t.$('#fch-fin') &&
        /Déjà connu ici/.test(x) && !!t.$('#fch-reprendre') && t.$$('[data-fchr]').length > 10 &&
        !!t.$('#fch-acces') && t.$$('[data-fchres]').length > 1 && !!t.$('#fch-ici') &&
        /Co-activité et croquis/.test(x) && !!t.$('#fch-coact') && !!t.$('#fch-plan');
      t.clic('#fch-voir'); await t.pause(500);
      const apercu = !t.$('#modale').hidden && /Propriétaire et donneur d’ordre/.test(t.texte('#modale'));
      await fermer(t);
      let imprime = '';
      t.w.print = () => { imprime = t.texte('#vue-impression') || ''; };
      t.clic('#fch-imprimer'); await t.pause(500);
      return blocs && apercu && /Fiche de chantier/.test(imprime) && /Gilles/.test(imprime); },
    'Rappel « à préparer avant les travaux »': async () => { const t = await neuf();
      t.clic('[data-chouvrir="gr"]'); await t.pause(400);
      const gros = /obligatoire, plus de 4 ha/.test(t.texte('#f-fichech'));
      await parBarre(t, 'chantiers'); t.clic('[data-chouvrir="dv"]'); await t.pause(400);
      return gros && /à préparer avant les travaux/.test(t.texte('#f-fichech')); }
  };
}
for (const moitie of [0, 1]) {
  scenario('Liste Chantiers : rien du carnet ni de la Fiche de chantier ne s’est perdu (lot b2, ' + (moitie + 1) + '/2)', async () => {
    const lignes = lignesTableB2(), P = preuvesB2(), cles = Object.keys(P);
    if (moitie === 0) verifier('les tables 3.1 et 3.3 citent les lignes, chacune avec sa preuve', cles, lignes);
    const n = Math.ceil(lignes.length / 2);
    for (const l of lignes.slice(moitie * n, (moitie + 1) * n)) {
      const p = P[l];
      let ok = false;
      try { ok = !!(p && await p()); } catch (e) { console.log('        ' + e.message); }
      verifierVrai('« ' + l.slice(0, 70) + ' » : retrouvé, même effet', ok);
    }
  });
}

/* --------------------------------------------------------------------- */
scenario('Liste Chantiers : chaque statut dans son groupe, ordre fixe (lot b2)', async () => {
  /* La règle des groupes, lue sur la logique seule puis à l'écran : aucun
     chantier ne se perd entre deux groupes, aucun n'est dans deux. */
  const t = await ouvrir(Object.assign({}, VIDE, B2()));
  const C = t.w.BCC, g = C.groupesChantiers(t.stock('chantiers'), {}, Date.now());
  const ids = l => l.map(c => c.id).join();
  for (const k of Object.keys(GROUPES_B2)) verifier('groupe « ' + k + ' »', GROUPES_B2[k].join(), ids(g[k]));
  verifier('les payés anciens', 'p1,p2', ids(g.anciens).split(',').sort().join());
  verifier('sans suite', 'ss', ids(g.sansuite));
  const tous = [].concat(g.faire, g.travaux, g.factures, g.devis, g.payes, g.anciens, g.sansuite).map(c => c.id).sort();
  verifier('chaque chantier dans un groupe, un seul', t.stock('chantiers').map(c => c.id).sort(), tous);
  /* Payé il y a 31 jours : plus « récent ». Il y a 29 : encore. */
  const p = id => t.stock('chantiers').filter(c => c.id === id)[0];
  const essai = j => C.groupesChantiers([Object.assign({}, p('pr'), { datePaiement: JCAL(-j) })], {}, Date.now());
  verifier('payé il y a 29 jours : récent', 1, essai(29).payes.length);
  verifier('payé il y a 31 jours : plus ancien', 1, essai(31).anciens.length);
  await listeB2(t);
  verifier('à l’écran, les groupes dans l’ordre (factures après En travaux, lot r1b)', 'faire,travaux,factures,devis,payes',
    t.$$('#liste-chantiers [data-groupe]').map(s => s.dataset.groupe).join());
  verifier('leurs titres', ['À faire maintenant 2', 'En travaux 6', 'Facturés · attendent le paiement 1', 'Devis 3', 'Payés récemment 1'],
    t.$$('#liste-chantiers [data-groupe] h2').map(h => h.textContent.replace(/\s+/g, ' ').trim()));
  verifier('puis les plis, Sans suite en dernier', ['Voir les payés plus anciens 2', 'Sans suite 1'],
    t.$$('#liste-chantiers > details summary').map(s => s.textContent.replace(/\s+/g, ' ').trim()));
  verifierVrai('repliés', t.$$('#liste-chantiers > details').every(d => !d.open));
  /* Un pli ouvert le reste quand la liste se redessine. */
  const d = pliB2(t, 'sansuite'); d.open = true; d.dispatchEvent(new t.w.Event('toggle'));
  t.saisir('#c-rech', 'x'); t.saisir('#c-rech', ''); await t.pause(150);
  verifierVrai('Sans suite reste ouvert après un nouveau dessin', pliB2(t, 'sansuite').open);
  verifierVrai('ni Temps ni Statut sur les lignes (R2)', !t.$('[data-chtemps], [data-chstatut]'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Création courte : + ▸ Chantier, puis la fiche sur Infos et Devis (lot b2)', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { clients: ['ONF'], proprios: [] }));
  await plusChantier(t);
  verifier('la feuille s’ouvre', 'Nouveau chantier', t.texte('#modale-titre'));
  verifierVrai('elle monte du bas', t.$('#modale').classList.contains('feuille-nav'));
  const txt = t.texte('#modale-corps');
  verifier('trois blocs, dans l’ordre', ['Pour qui', 'Où, quoi', 'Ce que je sais'],
    t.$$('#modale-corps .fj-sous').map(p => p.textContent));
  verifierVrai('« Facturé à », facultatif, souvent connu plus tard',
    /Facturé à facultatif · souvent connu plus tard/.test(txt));
  verifierVrai('ni « Journées à prévoir » ni « Avec un devis ? »',
    !t.$('#ce-jours') && !t.$('[data-cedevis]') && !/Journées à prévoir|Avec un devis/.test(txt));
  verifierVrai('annoncé aujourd’hui, à changer', /Annoncé aujourd’hui \(\d\d\/\d\d\/\d{4}\) · changer/.test(txt));

  /* Pour qui : l'offre d'ajout, puis le type et le SIREN sous le champ. */
  t.saisir('#ce-donneur', 'Cabinet Neuf'); t.$('#ce-donneur').dispatchEvent(new t.w.Event('blur')); await t.pause(100);
  verifierVrai('le donneur d’ordre inconnu se propose', /n’est pas dans vos donneurs d’ordre/.test(t.texte('#ce-donneur-offre')));
  t.clic('#ce-donneur-offre [data-offre]'); await t.pause(150);
  t.clic('#ce-donneur-offre #tc-ok'); await t.pause(300);
  verifierVrai('il entre dans la liste', (t.stock('clients') || []).indexOf('Cabinet Neuf') >= 0);
  t.saisir('#ce-proprio', 'Lambert'); t.$('#ce-proprio').dispatchEvent(new t.w.Event('blur')); await t.pause(100);
  verifierVrai('« Facturé à » inconnu se propose', /n’est pas dans votre liste « Facturé à »/.test(t.texte('#ce-proprio-offre')));
  t.clic('#ce-proprio-offre [data-offre]'); await t.pause(150);
  t.choisir('#tc-type', 'proprio'); await t.pause(50);
  verifierVrai('puis la question du SIREN', !t.$('#tc-siren-l').hidden);
  cocher(t, '#tc-siren', true); t.clic('#ce-proprio-offre #tc-ok'); await t.pause(300);

  /* Où, quoi : la quantité parle l'unité des travaux. */
  t.saisir('#ce-com', 'Clairbois'); t.saisir('#ce-foret', 'Bois Joli');
  t.choisir('#ce-trav', 'DEGAG'); await t.pause(100);
  verifier('en hectares, une surface', 'Surface (ha)', t.texte('#ce-qte-l'));
  t.saisir('#ce-qte', '2,5');
  t.choisir('#ce-trav', 'PLANT'); await t.pause(100);
  verifierVrai('en plants, une quantité', /^Quantité \(/.test(t.texte('#ce-qte-l')));
  t.choisir('#ce-trav', 'DEGAG'); await t.pause(100);
  t.saisir('#ce-note', 'portail 4321, clé chez le voisin');
  verifierVrai('le nom se compose', /— Lambert, Clairbois$/.test(t.texte('#ce-nom-apercu')));
  t.clic('#ce-date-changer'); await t.pause(100);
  t.choisir('#ce-date', jourISO(JCAL(-2)));
  t.clic('#ce-ok'); await t.pause(500);

  const c = t.stock('chantiers')[0];
  verifier('à l’étape Infos, avec devis à saisir', ['devis', true], [c.statut, c.aDevis]);
  verifier('pour qui', ['Cabinet Neuf', 'Lambert', true], [c.donneur, c.proprietaire, c.siren]);
  verifier('où', ['Clairbois', 'Bois Joli'], [c.commune, c.foret]);
  verifier('quoi : une ligne de dégagement, 2,5 ha', ['DEGAG', 2.5], [c.lignes[0].travail, c.lignes[0].quantite]);
  verifier('ce que je sais', 'portail 4321, clé chez le voisin', c.notes);
  verifier('annoncé avant-hier', jourISO(JCAL(-2)), jourISO(c.dateEntree));
  verifier('la fiche s’ouvre', 'vue-chantier', vueActive(t));
  verifier('sur Infos et Devis', '0,1', ouvertesB1(t).join());
  verifierVrai('ce que je sais s’y lit', /Ce que je sais ?portail 4321/.test(etapeB1(t, 0)));
  /* Ce que l'ancien formulaire demandait et que la feuille ne demande plus
     se saisit dans la fiche : avec ou sans devis, les journées à prévoir. */
  verifierVrai('avec ou sans devis : dans l’étape Devis', !!t.$('#f-devis') && !!t.$('#f-sansdevis'));
  t.clic('#f-estim'); await t.pause(300);
  verifierVrai('les journées à prévoir : Devis ▸ Temps estimé', !!t.$('#es-jest'));
  t.clic('#modale-x'); await t.pause(150);
  t.clic('#f-identite'); await t.pause(300);
  verifier('et tout « pour qui, où » se corrige dans Le chantier', ['Cabinet Neuf', 'Lambert', 'Clairbois', 'Bois Joli', jourISO(JCAL(-2))],
    ['#ic-donneur', '#ic-proprio', '#ic-com', '#ic-foret', '#ic-entree'].map(s => t.$(s).value));
  t.clic('#modale-x'); await t.pause(150);
  await parBarre(t, 'chantiers');
  verifier('il est dans Chantiers ▸ Devis', [c.id], groupeB2(t, 'devis'));
  await parBarre(t, 'aujourdhui');
  /* Lot r1 : « Devis à faire » se dit sur la ligne du chantier. */
  verifierVrai('et dans Aujourd’hui ▸ Chantiers en cours, « Devis à faire »',
    /Devis à faire/.test(t.texte('#aj-encours [data-ajch="' + c.id + '"]') || ''));

  /* Rien de quoi le nommer : la feuille le dit et ne crée rien. */
  await plusChantier(t);
  t.clic('#ce-ok'); await t.pause(300);
  verifier('sans nom possible, rien n’est créé', 1, t.stock('chantiers').length);
  verifierVrai('la feuille reste ouverte', !t.$('#modale').hidden);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Création depuis une estimation : Rendements ▸ Estimer ▸ Créer le devis, inchangé (lot b2)', async () => {
  /* Une référence : 500 plants par jour sur un chantier payé. */
  const t = await ouvrir(Object.assign({}, VIDE, { cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [{ id: 'r', statut: 'paye', aDevis: false, maj: Date.now(), dateEntree: JCAL(-90), temps: [], jours: [],
      proprietaire: 'Martin', lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1000, prix: 1.2, nature: 'prestation' }] }],
    journees: [1, 2].map(i => ({ id: 'j' + i, date: JCAL(-60 + i), chantier: 'r', personnes: 1, nonProd: 0,
      postes: [{ travaux: 'PLANT', heures: 8, quantite: 500 }] })) }));
  await parMenu(t, 'rendements');
  t.clic('#onglets [data-vue="estimer"]'); await t.pause(300);
  t.choisir('#es-trav', 'PLANT'); await t.pause(200);
  t.saisir('#es-qte', '1000'); t.saisir('#es-rend', '500');
  t.clic('#es-go'); await t.pause(300);
  verifierVrai('le devis se propose', t.clic('#es-devis')); await t.pause(500);
  const c = (t.stock('chantiers') || []).filter(x => x.id !== 'r')[0] || {};
  verifier('un chantier au devis prérempli', ['devis', 2, 'PLANT', 1000],
    [c.statut, c.joursEstimes, (c.lignes || [{}])[0].travail, (c.lignes || [{}])[0].quantite]);
  verifier('la fiche s’ouvre sur le devis', 'vue-chantier', vueActive(t));
  verifierVrai('étape Devis ouverte', ouvertesB1(t).indexOf('1') >= 0);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('C1 : un chantier « Devis à envoyer » dit « Devis à faire » sur sa ligne (lots b2, r1)', async () => {
  /* Bientôt est parti au lot r1 (A2) : « Devis à faire » se dit sur la
     ligne du chantier, à l'étape Infos de Chantiers en cours. */
  const t = await ouvrir(Object.assign({}, VIDE, B2()));
  await parBarre(t, 'aujourdhui');
  const l = id => { const e = t.$('#aj-encours [data-ajch="' + id + '"]');
    return e && /Devis à faire/.test(e.textContent) ? e : null; };
  verifierVrai('pas encore repéré', l('dv') &&
    /annoncé il y a 3 j · pas encore repéré/.test(l('dv').textContent));
  verifierVrai('repéré', l('dr') && /repéré il y a 2 j/.test(l('dr').textContent) &&
    !/pas encore repéré/.test(l('dr').textContent));
  verifierVrai('un devis envoyé n’en fait pas', !l('en'));
  verifier('plus de « Repérage à faire »', null, /Repérage à faire/.exec(t.texte('#vue-accueil')));
  /* Le geste « Devis envoyé » de la fiche : la ligne s'en va. */
  await listeB2(t);
  t.clic('[data-chouvrir="dv"]'); await t.pause(400);
  t.clic('#f-envoye'); await t.pause(400);
  await parBarre(t, 'aujourdhui');
  verifier('le devis parti, la ligne s’en va', null, l('dv'));
  verifierVrai('l’autre reste', !!l('dr'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('« Facturé à » : le mot « Client » n’est plus à l’écran pour ce champ (lot b2)', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, B2()));
  const sansClient = s => !/\bClients?\b/.test(s || '');
  await plusChantier(t);
  verifierVrai('création : « Facturé à »', /Facturé à/.test(t.texte('#modale-corps')) && sansClient(t.texte('#modale-corps')));
  t.clic('#modale-x'); await t.pause(150);
  await listeB2(t);
  t.clic('[data-chouvrir="dv"]'); await t.pause(400);
  verifierVrai('fiche : l’encadré', /Facturé à : Martin/.test(t.texte('#f-bloc-chantier')) && sansClient(t.texte('#vue-chantier')));
  t.clic('#f-identite'); await t.pause(300);
  verifier('fenêtre Le chantier : l’intitulé du champ', 'Facturé à', t.$('label[for="ic-proprio"]').firstChild.textContent.trim());
  verifierVrai('et rien d’autre n’y dit « Client »', sansClient(t.texte('#modale-corps')));
  t.clic('#modale-x'); await t.pause(150);
  t.clic('#onglets [data-vue="fichech"]'); await t.pause(350);
  t.choisir('#fch-ch', 'dv'); await t.pause(400);
  verifierVrai('Fiche sécurité : « Facturé à »', /Facturé àMartin|Facturé à ?Martin/.test(t.texte('#fch-corps')) &&
    sansClient(t.texte('#fch-corps')));
  t.saisir('#c-rech', 'martin'); await t.pause(150);
  verifierVrai('la recherche trouve par « Facturé à »', t.$$('#ch-trouves [data-chouvrir]').some(b => b.dataset.chouvrir === 'dv'));
  await parMenu(t, 'reglages');
  verifierVrai('Réglages ▸ listes : la pastille « Facturé à »',
    t.$$('#rl-nav [data-liste]').some(b => b.dataset.liste === 'proprios' && b.textContent === 'Facturé à'));
  verifierVrai('et aucune pastille « Clients »', t.$$('#rl-nav [data-liste]').every(b => sansClient(b.textContent)));
  /* Les données ne changent pas de nom. */
  verifier('la donnée reste « proprietaire »', 'Martin', chB2(t, 'dv').proprietaire);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Lot r2 (4.94.0) : fiche, ligne de travaux, Ma journée, durées en heures
   et minutes, trajet. Retours des 2, 3 et 5 novembre, tous tranchés. */
const etatR2 = t => t.w.BCUI._etat();
const chR2 = (t, id) => (etatR2(t).chantiers || []).filter(c => c.id === id)[0];
const jrR2 = t => t.stock('journees') || [];
/* Taper une durée dans ses deux cases, comme au doigt. */
const dureeR2 = (t, base, h, m) => { t.saisir(base, h); t.saisir(base + '-m', m); };
const ouvrirMjR2 = async t => { t.clic('#aj-jour'); await t.pause(350); };

scenario('Lot r2 : « Pas de repérage » se choisit et se défait', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'devis', aDevis: true, dateEntree: JA(-3) })]
  }));
  const ligne = () => t.texte('#vue-accueil [data-ajch="c1"]') || '';
  verifierVrai('avant : Aujourd’hui dit « pas encore repéré »', /pas encore repéré/.test(ligne()));
  await ficheB1(t, 'c1');
  verifierVrai('l’étape Infos propose « Pas de repérage »', !!t.$('#f-sansreperage'));
  verifierVrai('le résumé dit « repérage facultatif »', /repérage facultatif/.test(resumeB1(t, 0)));
  t.clic('#f-sansreperage'); await t.pause(450);
  verifier('choisi : il est gardé', true, chB1(t, 'c1').sansReperage);
  verifierVrai('l’étape le dit', /Repérage : pas de repérage/.test(etapeB1(t, 0)));
  verifierVrai('et ne le réclame plus : ni le résumé, ni l’aide',
    !/repérage facultatif/.test(resumeB1(t, 0)) && /pas de repérage/.test(resumeB1(t, 0)) &&
    !/Facultatif : un chantier peut passer/.test(etapeB1(t, 0)) && !t.$('#f-sansreperage'));
  await parBarre(t, 'aujourdhui');
  verifierVrai('Aujourd’hui non plus', /Devis à faire/.test(ligne()) && !/repéré/.test(ligne()));
  await ficheB1(t, 'c1');
  t.clic('#f-reperage-oui'); await t.pause(450);
  verifier('défait : le choix s’en va', false, chB1(t, 'c1').sansReperage);
  verifier('et la fenêtre du repérage s’ouvre', 'Noter le repérage', t.texte('#modale-titre'));
  t.clic('#modale-x'); await t.pause(200);
  verifierVrai('« Pas de repérage » revient', !!t.$('#f-sansreperage') && /repérage facultatif/.test(resumeB1(t, 0)));
  await parBarre(t, 'aujourdhui');
  verifierVrai('et Aujourd’hui le redit', /pas encore repéré/.test(ligne()));
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : fiche ▸ Travaux, un appui sur un jour ouvre ce qu’il porte', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: JA(-10) },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', aDevis: false,
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }],
      jours: [{ d: JA(-4), p: 1 }, { d: JA(3), p: 1 }] })],
    journees: [{ id: 'j1', date: JA(-2), chantier: 'c1', personnes: 1, nonProd: 0, km: 30,
      postes: [{ travaux: 'DEGAG', heures: 7, quantite: 1 }] },
      /* Une saisie sans date : la ligne « sans date (rattrapage) ». */
      { id: 'j2', date: null, chantier: 'c1', personnes: 1, nonProd: 3, postes: [] }]
  }));
  const M = t.w.BCC.minuit;
  const jour = async cle => {
    await ficheB1(t, 'c1');
    const d = t.$('#f-etapes [data-etape="2"]'); if (d) d.open = true;
    const ok = t.clic('#f-etapes [data-fjour="' + cle + '"]'); await t.pause(500);
    return ok;
  };
  verifierVrai('le jour fait est un bouton', await jour(M(JA(-2))));
  verifier('il ouvre sa journée en modification', ['Modifier la journée', 'c1', '7'],
    [t.texte('#modale-titre'), t.$('#mj-ch') && t.$('#mj-ch').value, t.$('#mj-total') && t.$('#mj-total').value]);
  t.clic('#modale-x'); await t.pause(150);
  verifierVrai('le jour posé à venir aussi', await jour(M(JA(3))));
  verifierVrai('il ouvre la fiche du jour', !!t.$('#modale .fj-etat') && !t.$('#mj-ok'));
  t.clic('#modale-x'); await t.pause(150);
  verifierVrai('la journée comptée d’office aussi', await jour(M(JA(-4))));
  verifier('elle ouvre Ma journée pré-remplie', ['Ma journée', 'c1', '8'],
    [t.texte('#modale-titre'), t.$('#mj-ch') && t.$('#mj-ch').value, t.$('#mj-total') && t.$('#mj-total').value]);
  t.clic('#modale-x'); await t.pause(150);
  verifierVrai('la ligne sans date aussi', await jour('sans'));
  verifierVrai('elle ouvre le rattrapage', /Temps passé/.test(t.texte('#modale-titre')) && !!t.$('#ct-duree'));
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : la fenêtre d’une ligne — plus de Difficulté, Produit du stock sur une fourniture, Précision', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    articles: [{ id: 'a1', nom: 'Tuteur châtaignier', type: 'tuteur', unite: 'unite', prix: 1, mouvements: [], maj: Date.now() }],
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'devis', aDevis: true, lignes: [
      { travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' },
      { travail: 'F_TUTEUR', unite: 'unite', quantite: 100, prix: 1.2, nature: 'vente' },
      /* Une ancienne ligne : un produit et une difficulté déjà notés. */
      { travail: 'PLANT', unite: 'plant', quantite: 500, prix: 1, nature: 'prestation', article: 'a1', difficulte: 4 }] })]
  }));
  await ficheB1(t, 'c1');
  const ligne = async i => { t.clic('#f-etapes [data-lmod="' + i + '"]'); await t.pause(350); };
  const stockVu = () => !!t.$('#cl-art-champ') && t.$('#cl-art-champ').style.display !== 'none';
  await ligne(0);
  verifierVrai('plus de Difficulté dans la fenêtre', !t.$('#cl-diff') && !/Difficulté/.test(t.texte('#modale-corps')));
  verifierVrai('« Précision (facultatif) »', t.texte('label[for="cl-note"]') === 'Précision (facultatif)' &&
    !/Libellé sur la facture/.test(t.texte('#modale-corps')));
  verifierVrai('avec son aide d’une ligne', /Ce qui précise la ligne, tel que sur votre facture/.test(t.texte('#modale-corps')) &&
    !/La note sert à situer vos rendements/.test(t.texte('#modale-corps')));
  verifierVrai('une prestation : pas de Produit du stock', !stockVu());
  t.choisir('#cl-trav', 'F_PROTEC'); await t.pause(100);
  verifierVrai('devenue fourniture, il paraît', stockVu());
  t.clic('#modale-x'); await t.pause(150);
  await ligne(1);
  verifierVrai('une fourniture : Produit du stock', stockVu());
  t.clic('#modale-x'); await t.pause(150);
  await ligne(2);
  verifierVrai('une ancienne prestation qui en a un : il reste', stockVu() && t.$('#cl-art').value === 'a1');
  t.saisir('#cl-note', 'plants en racines nues');
  t.clic('#cl-ok'); await t.pause(500);
  const l2 = chB1(t, 'c1').lignes[2];
  verifier('la difficulté déjà notée reste en base, la précision va dans note', [4, 'a1', 'plants en racines nues'],
    [l2.difficulte, l2.article, l2.note]);
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : heures et minutes — 0 h 40 de trajet, 7 h 20 sur une prestation, le clavier reste ouvert', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', lignes: [
      { travail: 'PLANT', unite: 'plant', quantite: 1200, prix: 1.1, nature: 'prestation' },
      { travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 600, nature: 'prestation' }] })]
  }));
  await ouvrirMjR2(t);
  t.choisir('#mj-ch', 'c1'); await t.pause(200);
  verifierVrai('deux prestations, sans heures', t.$$('#mj-postes [data-pstt]').length === 2 && !t.$('[data-psth="0"]'));
  t.clic('#pst-rep'); await t.pause(150);
  const SEL = ['[data-psth="0"]', '[data-pstm="0"]', '[data-pstq="0"]', '[data-psth="1"]', '[data-pstm="1"]',
    '[data-pstq="1"]', '#mj-total', '#mj-total-m', '#mj-prod', '#mj-prod-m', '#mj-trajet', '#mj-trajet-m', '#mj-km', '#mj-pers'];
  const VAL = ['7', '20', '300', '0', '40', '0,5', '8', '', '8', '', '0', '40', '42', '1'];
  const avant = SEL.map(s => t.$(s));
  verifierVrai('répartir fait paraître les cases h et min', avant.every(Boolean));
  const gardes = avant.map((n, i) => {
    n.focus(); n.value = VAL[i];
    n.dispatchEvent(new t.w.Event('input', { bubbles: true }));
    n.dispatchEvent(new t.w.Event('change', { bubbles: true }));
    return t.$(SEL[i]) === n && t.d.activeElement === n;
  });
  verifier('chaque case reste la même et garde le doigt', SEL.map(() => true), gardes);
  verifierVrai('le pied dit 8 h et le trajet à côté', /8 h/.test(t.texte('#mj-apercu')) &&
    /\+ 40 min de trajet/.test(t.texte('#mj-apercu')));
  t.clic('#mj-ok'); await t.pause(600);
  const j = jrR2(t)[0] || {};
  verifier('enregistré en heures décimales', [7.333, 0.667, 0.667, 8],
    [(j.postes || [])[0] && j.postes[0].heures, (j.postes || [])[1] && j.postes[1].heures, j.trajet, j.productif]);
  await parBarre(t, 'aujourdhui');
  t.clic('[data-ajouvre="journee:' + j.id + '"]'); await t.pause(450);
  verifier('relu en heures et minutes', ['7', '20', '0', '40', '0', '40'],
    ['[data-psth="0"]', '[data-pstm="0"]', '[data-psth="1"]', '[data-pstm="1"]', '#mj-trajet', '#mj-trajet-m']
      .map(s => t.$(s) ? t.$(s).value : null));
  t.clic('#modale-x'); await t.pause(150);
  /* Une ancienne valeur décimale se relit juste. */
  verifier('1,67 h se relit 1 h 40', ['1 h 40', '40 min', '2 j 4 h 30'],
    [t.w.BCC.ditHeures(1.67), t.w.BCC.ditHeures(0.667), t.w.BCC.ditDuree(20.5, { heuresJour: 8 })]);
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : le trajet sort des journées — 8 h + 1 h de route, trois jours', async () => {
  const jour = (id, n, ch, trajet) => ({ id, date: JA(n), chantier: ch, personnes: 1, nonProd: 0, km: 50,
    trajet, postes: [{ travaux: 'DEGAG', heures: 8, quantite: 1 }] });
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [
      chA('c1', { nom: 'Vaux', statut: 'termine', aDevis: true, prixJour: 300,
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 300, nature: 'prestation' }] }),
      chA('c2', { nom: 'Marchand', statut: 'termine', aDevis: true, prixJour: 300,
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] })],
    journees: [jour('a', -6, 'c1', 1), jour('b', -5, 'c1', 1), jour('c', -4, 'c1', 1),
      jour('d', -6, 'c2', 0), jour('e', -5, 'c2', 0)]
  }));
  const C0 = t.w.BCC, cfg = { heuresJour: 8 };
  verifier('« J’y ai passé » : 3 j, plus 3 j 3 h', 3, C0.tempsMoi(chR2(t, 'c1'), cfg));
  verifier('le prix par journée réel monte d’autant : 900 € sur 3 j', 300, C0.troisChiffres(chR2(t, 'c1'), cfg).parJour);
  verifier('le trajet se lit à part', 3, C0.trajetChantier(chR2(t, 'c1')));
  verifier('un chantier sans trajet, inchangé au centime près', [2, 500],
    [C0.tempsMoi(chR2(t, 'c2'), cfg), C0.troisChiffres(chR2(t, 'c2'), cfg).parJour]);
  verifier('les rendements ne changent pas', [1, 1],
    [C0.rendementTravail(chR2(t, 'c1'), 'DEGAG', cfg).rendement, C0.rendementTravail(chR2(t, 'c2'), 'DEGAG', cfg).rendement]);
  await ficheB1(t, 'c1');
  verifierVrai('trois chiffres : 3 journées, 300 € par jour', /3journéesfaites/.test(sansBlancs(t.texte('.fi-kpis'))) &&
    /300€parjour,réel/.test(sansBlancs(t.texte('.fi-kpis'))));
  const tr = etapeB1(t, 2);
  verifierVrai('étape Travaux : « J’y ai passé 3 j », le trajet à côté', /J’y ai passé ?3 j(?! \d)/.test(tr) &&
    /\+ 3 h de trajet/.test(tr) && /\+ 1 h de trajet/.test(tr));
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : le temps productif — non réparti, réparti, une seule prestation, ancienne journée', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [
      chA('c1', { nom: 'Vaux', statut: 'encours', lignes: [
        { travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' },
        { travail: 'TAILLE', unite: 'ha', quantite: 2, prix: 500, nature: 'prestation' }] }),
      chA('c2', { nom: 'Marchand', statut: 'encours', lignes: [
        { travail: 'PLANT', unite: 'plant', quantite: 1000, prix: 1, nature: 'prestation' }] }),
      chA('c3', { nom: 'Ancien', statut: 'encours', lignes: [
        { travail: 'DEGAG', unite: 'ha', quantite: 1, prix: 700, nature: 'prestation' }] })],
    journees: [
      /* Une journée répartie d'avant : 4 h de dégagement, le seul repère. */
      { id: 'j0', date: JA(-3), chantier: 'c1', personnes: 1, nonProd: 0, postes: [{ travaux: 'DEGAG', heures: 4, quantite: 0.5 }] },
      /* Une ancienne journée, sans productif : 6 h + 1 h hors production + 1 h de route. */
      { id: 'jv', date: JA(-2), chantier: 'c3', personnes: 1, nonProd: 1, trajet: 1, km: 20,
        postes: [{ travaux: 'DEGAG', heures: 6, quantite: 0.4 }] }]
  }));
  const C0 = t.w.BCC, cfg = { heuresJour: 8 };
  const rdt = (id, tv) => { const r = C0.rendementTravail(chR2(t, id), tv, cfg); return r ? C0.arr(r.rendement, 3) : null; };
  const avant = [rdt('c1', 'DEGAG'), rdt('c1', 'TAILLE')];
  verifier('les rendements avant : 3 ha / 0,5 j, rien pour la taille', [6, null], avant);

  /* Dégagement et taille en même temps : 8 h sur place dont 7 productives. */
  await ouvrirMjR2(t);
  t.choisir('#mj-ch', 'c1'); await t.pause(200);
  dureeR2(t, '#mj-total', '8', '');
  verifier('le productif est proposé égal au total', '8', t.$('#mj-prod').value);
  dureeR2(t, '#mj-prod', '7', '');
  t.saisir('[data-pstq="0"]', '1,5'); t.saisir('[data-pstq="1"]', '1');
  verifierVrai('l’écran dit 1 h hors production', /7 h productives, 1 h hors production/.test(t.texte('#mj-horsprod')));
  verifierVrai('et que les rendements ne la comptent pas', /il ne compte dans le rendement d’aucune/.test(t.texte('#pst-repaide')));
  t.clic('#mj-ok'); await t.pause(600);
  const nr = jrR2(t).filter(x => x.chantier === 'c1' && x.id !== 'j0')[0] || {};
  verifier('gardée : productif 7, hors production 1, quantités, pas d’heures', [7, 1, [0, 0], [1.5, 1]],
    [nr.productif, nr.nonProd, (nr.postes || []).map(p => p.heures), (nr.postes || []).map(p => p.quantite)]);
  verifier('8 h au chantier', 8 + 4, C0.arr(C0.tempsMoi(chR2(t, 'c1'), cfg) * 8, 2));
  verifier('les rendements de ces prestations, inchangés', avant, [rdt('c1', 'DEGAG'), rdt('c1', 'TAILLE')]);
  verifier('les quantités comptent pour l’avancement', [2, 1],
    C0.avancement(chR2(t, 'c1')).lignes.map(l => l.fait));

  /* La même, répartie 4 h / 3 h : les rendements sont nourris. */
  await parBarre(t, 'aujourdhui');
  t.clic('[data-ajouvre="journee:' + nr.id + '"]'); await t.pause(450);
  t.clic('#pst-rep'); await t.pause(150);
  dureeR2(t, '#pst-h-0', '4', ''); dureeR2(t, '#pst-h-1', '2', '');
  verifierVrai('réparties, leur somme doit faire le productif', /Les prestations font 6 h, le temps productif 7 h/.test(t.texte('#mj-horsprod')));
  t.clic('#mj-ok'); await t.pause(400);
  verifier('et rien ne s’enregistre tant qu’elle ne le fait pas', [0, 0],
    (jrR2(t).filter(x => x.id === nr.id)[0].postes || []).map(p => p.heures));
  dureeR2(t, '#pst-h-1', '3', '');
  t.clic('#mj-ok'); await t.pause(600);
  verifier('réparties 4 h / 3 h : les rendements sont nourris', [3, 5.333], [rdt('c1', 'DEGAG'), rdt('c1', 'TAILLE')]);

  /* Une seule prestation : elle prend tout le productif, sans case d'heures. */
  await ouvrirMjR2(t);
  t.choisir('#mj-ch', 'c2'); await t.pause(200);
  verifierVrai('une seule prestation : pas de case d’heures', !t.$('[data-psth="0"]') && !t.$('#pst-rep'));
  dureeR2(t, '#mj-total', '8', ''); dureeR2(t, '#mj-prod', '7', ''); t.saisir('[data-pstq="0"]', '700');
  verifierVrai('son rendement se lit sur le productif', /≈ 800 plant\/jour/.test(t.texte('#pst-r-0')));
  t.clic('#mj-ok'); await t.pause(600);
  const un = jrR2(t).filter(x => x.chantier === 'c2')[0] || {};
  verifier('7 h pour elle', [7, 1], [(un.postes || [])[0] && un.postes[0].heures, un.nonProd]);

  /* Une ancienne journée se relit et se réenregistre à l'identique. */
  await parBarre(t, 'aujourdhui');
  t.clic('[data-ajouvre="journee:jv"]'); await t.pause(450);
  verifier('relue : 7 h sur place dont 6 productives, 1 h de route', ['7', '6', '1'],
    [t.$('#mj-total').value, t.$('#mj-prod').value, t.$('#mj-trajet').value]);
  t.clic('#mj-ok'); await t.pause(600);
  const v = jrR2(t).filter(x => x.id === 'jv')[0] || {};
  verifier('réenregistrée : rien ne bouge', [6, 1, 1, 0.4, 7],
    [v.postes[0].heures, v.nonProd, v.trajet, v.postes[0].quantite, C0.heuresJournee(v)]);
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : le trajet du chantier — proposé, modifié pour un jour, retenu', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [
      chA('c1', { nom: 'Vaux', statut: 'encours', trajetKm: 64, trajetHeures: 7 / 6 }),
      chA('c2', { nom: 'Marchand', statut: 'encours' })],
    journees: [{ id: 'j0', date: JA(-1), chantier: 'c2', personnes: 1, nonProd: 6, km: 42, trajet: 0.5, postes: [] }]
  }));
  await ouvrirMjR2(t);
  t.choisir('#mj-ch', 'c1'); await t.pause(200);
  verifierVrai('celui de la fiche est proposé, replié en une ligne',
    !t.$('#mj-traj-ligne').hidden && /Trajet : 64 km · 1 h 10/.test(t.texte('#mj-traj-ligne')) && t.$('#mj-traj-cases').hidden);
  verifier('ses cases sont remplies', ['64', '1', '10'], [t.$('#mj-km').value, t.$('#mj-trajet').value, t.$('#mj-trajet-m').value]);
  verifierVrai('la fiche en a un : pas de « Retenir »', t.$('#mj-retenir-l').hidden);
  t.clic('#mj-traj-mod'); await t.pause(100);
  verifierVrai('« Modifier » ouvre les cases', !t.$('#mj-traj-cases').hidden);
  t.saisir('#mj-km', '70'); dureeR2(t, '#mj-total', '8', '');
  t.clic('#mj-ok'); await t.pause(600);
  verifier('la journée garde 70 km', 70, (jrR2(t).filter(x => x.chantier === 'c1')[0] || {}).km);
  verifier('la fiche ne change pas', [64, 7 / 6], [chB1(t, 'c1').trajetKm, chB1(t, 'c1').trajetHeures]);

  await ouvrirMjR2(t);
  t.choisir('#mj-ch', 'c2'); await t.pause(200);
  verifier('fiche vide : celui de la dernière journée', ['42', '0', '30'],
    [t.$('#mj-km').value, t.$('#mj-trajet').value, t.$('#mj-trajet-m').value]);
  verifierVrai('et « Retenir pour ce chantier », coché', !t.$('#mj-retenir-l').hidden && t.$('#mj-retenir').checked);
  dureeR2(t, '#mj-total', '6', '');
  t.clic('#mj-ok'); await t.pause(600);
  verifier('retenu sur la fiche', [42, 0.5], [chB1(t, 'c2').trajetKm, chB1(t, 'c2').trajetHeures]);
  await ficheB1(t, 'c2');
  verifierVrai('la fiche ▸ Infos le dit', /Trajet depuis chez moi ✎ ?42 km · 30 min aller-retour/.test(etapeB1(t, 0)));
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : la pastille Fiche sans chantier ouvert propose de choisir', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', dateEntree: JA(-9) }),
      chA('c2', { nom: 'Marchand', statut: 'devis', aDevis: true, dateEntree: JA(-4) }),
      chA('c3', { nom: 'Vieux', statut: 'paye', datePaiement: JA(-200) })]
  }));
  await parBarre(t, 'chantiers');
  t.clic('#onglets [data-vue="chantier"]'); await t.pause(350);
  verifierVrai('pas d’écran vide : une recherche et la liste', !!t.$('#fc-rech') &&
    !/Chantier introuvable/.test(t.texte('#fiche-chantier')));
  verifier('les chantiers en cours, rangés comme dans Aujourd’hui', ['c2', 'c1'],
    t.$$('#fc-liste [data-fcouvre]').map(b => b.dataset.fcouvre));
  verifierVrai('par étape', t.$$('#fc-liste .aj-etape').length === 2);
  const champ = t.$('#fc-rech');
  t.saisir('#fc-rech', 'vieux'); await t.pause(150);
  verifier('la recherche porte sur tous', ['c3'], t.$$('#fc-liste [data-fcouvre]').map(b => b.dataset.fcouvre));
  verifierVrai('sans refaire la case', t.$('#fc-rech') === champ);
  t.clic('#fc-liste [data-fcouvre="c3"]'); await t.pause(450);
  verifierVrai('le choix ouvre sa fiche', !!t.$('#f-etapes') && /Vieux/.test(t.texte('.fi-tete h2')));
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : une seule journée par chantier et par jour', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [chA('c1', { nom: 'Savigny', statut: 'encours' }), chA('c2', { nom: 'Marchand', statut: 'encours' })],
    journees: [
      { id: 'ja', date: JA(-1), chantier: 'c1', personnes: 1, nonProd: 5, postes: [] },
      /* Un ancien doublon : deux journées de Marchand le même jour. */
      { id: 'd1', date: JA(-3), chantier: 'c2', personnes: 1, nonProd: 4, postes: [] },
      { id: 'd2', date: JA(-3), chantier: 'c2', personnes: 1, nonProd: 3, postes: [] }]
  }));
  const n = () => jrR2(t).length;
  await ouvrirMjR2(t);
  t.choisir('#mj-ch', 'c1'); await t.pause(200);
  dureeR2(t, '#mj-total', '4', '');
  t.clic('#mj-ok'); await t.pause(600);
  verifier('Savigny 4 h aujourd’hui', 4, n());
  const neuve = jrR2(t).filter(x => x.chantier === 'c1' && x.id !== 'ja')[0];

  /* Le soir, par oubli : Ma journée sur Savigny à la même date. */
  await ouvrirMjR2(t);
  dureeR2(t, '#mj-total', '3', '');
  t.choisir('#mj-ch', 'c1'); await t.pause(350);
  verifier('la journée de 4 h s’ouvre en modification', ['Modifier la journée', '4'],
    [t.texte('#modale-titre'), t.$('#mj-total') && t.$('#mj-total').value]);
  verifierVrai('une ligne le dit, et ce qui était tapé', /Savigny a déjà une journée le .* : 4 h/.test(t.texte('#mj-avis')) &&
    /n’y est pas reporté : 3 h/.test(t.texte('#mj-avis')));
  t.clic('#mj-ok'); await t.pause(600);
  verifier('une seule journée en base', 4, n());

  /* En modification : déplacer la journée d'hier sur aujourd'hui est refusé. */
  await parBarre(t, 'aujourdhui');
  t.clic('[data-ajouvre="journee:ja"]'); await t.pause(450);
  t.choisir('#mj-date', jourISO(Date.now())); await t.pause(200);
  verifierVrai('l’écran le dit, et propose l’autre', /Savigny a déjà une journée/.test(t.texte('#mj-doublon')) && !!t.$('#mj-autre'));
  t.clic('#mj-ok'); await t.pause(500);
  verifier('rien n’est enregistré en double', [4, jourISO(JA(-1))],
    [n(), jourISO(jrR2(t).filter(x => x.id === 'ja')[0].date)]);
  t.clic('#mj-autre'); await t.pause(450);
  verifier('« Ouvrir l’autre journée » l’ouvre', '4', t.$('#mj-total').value);
  t.clic('#modale-x'); await t.pause(150);

  /* L'ancien doublon : le choix à l'appui, et ✕ dit combien. */
  await parBarre(t, 'agenda');
  await cliquerJour(t, JA(-3));
  t.clic('#modale [data-fjmj]'); await t.pause(400);
  verifier('l’appui propose le choix', ['2 journées ce jour-là', 2],
    [t.texte('#modale-titre'), t.$$('#modale [data-mjchoix]').length]);
  t.clic('#modale [data-mjchoix="d2"]'); await t.pause(400);
  verifier('le choix ouvre la bonne', ['Modifier la journée', '3'], [t.texte('#modale-titre'), t.$('#mj-total').value]);
  t.clic('#modale-x'); await t.pause(150);
  await cliquerJour(t, JA(-3));
  let question = '';
  t.w.confirm = q => { question = q; return false; };
  t.clic('#modale [data-fjsupch="c2"]'); await t.pause(200);
  verifierVrai('✕ annonce « les 2 journées »', /Retirer les 2 journées de Marchand ce jour-là/.test(question));
  t.clic('#modale-x'); await t.pause(150);
  await ficheB1(t, 'c2');
  const d = t.$('#f-etapes [data-etape="2"]'); if (d) d.open = true;
  t.clic('#f-etapes [data-fjour="' + t.w.BCC.minuit(JA(-3)) + '"]'); await t.pause(400);
  verifier('fiche ▸ Travaux : le même choix', 2, t.$$('#modale [data-mjchoix]').length);
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : « plus de jour posé », en gris, dans la fiche et les cumuls', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', aDevis: false, jours: [{ d: JA(-6), p: 1 }, { d: JA(-5), p: 1 }] })]
  }));
  await ficheB1(t, 'c1');
  verifierVrai('la fiche dit « plus de jour posé »', /plus de jour posé/.test(t.texte('.fi-tete .fi-etat')));
  verifierVrai('en gris, plus en rouge', !t.$('.fi-tete .fi-etat .retard') && !/jours passés/.test(t.texte('.fi-tete')));
  await parBarre(t, 'chantiers');
  verifierVrai('les cumuls disent le même mot, sans rouge', /1 avec plus de jour posé/.test(t.texte('#carnet-totaux')) &&
    !t.$('#carnet-totaux .retard') && !/aux jours passés/.test(t.texte('#carnet-totaux')));
  verifier('aucune erreur', [], t.erreurs);
});

scenario('Lot r2 : la bulle fermée par OK rend son cran d’historique', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: JA(-10) },
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours', aDevis: false, jours: [{ d: JA(-2), p: 1 }] })]
  }));
  const A0 = etatR2(t);
  verifierVrai('la bulle est ouverte, avec son cran', !!t.$('#aj-bulle') && A0.crans === 1);
  t.clic('#ajb-ok'); await t.pause(400);
  verifier('OK : la bulle se ferme et rend son cran', [false, 0, 0], [!!t.$('#aj-bulle'), A0.crans, A0.avalerRetour || 0]);
  /* Le retour fait ce qu'il faisait sans la bulle, dès le premier appui. */
  await parBarre(t, 'agenda');
  t.w.dispatchEvent(new t.w.PopStateEvent('popstate')); await t.pause(350);
  verifier('un seul retour ramène à Aujourd’hui', 'vue-accueil', vueActive(t));
  /* La bulle de l'appui long de l'Agenda ne prend pas de cran. */
  await parBarre(t, 'agenda');
  const crans = A0.crans;
  await appuiLong(t, JA(1), 'souris');
  verifierVrai('la bulle de l’Agenda s’ouvre', !!t.$('#cal-bulle'));
  t.clic('#cal-bulle-fond'); await t.pause(200);
  t.w.document.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Escape' })); await t.pause(100);
  verifier('fermée, elle laisse les crans tels quels', crans, A0.crans);
  t.w.dispatchEvent(new t.w.PopStateEvent('popstate')); await t.pause(350);
  verifier('et un seul retour ramène à Aujourd’hui', 'vue-accueil', vueActive(t));
  verifier('aucune erreur', [], t.erreurs);
});

/* ===================================================== lot d1 (4.95.0)
   Argent : Mois · TVA · Dépenses · Année remplacent Bilan · Dépenses ·
   Charges fixes · Analyses. Rien ne disparaît, aucun calcul ne change :
   chaque chiffre se compare à ce que donnait l'ancien endroit (le même
   calcul de logique/finances.js, sur la même période) et, quand c'est
   possible, à une valeur calculée à la main ici. */
const D1_AN = new Date().getFullYear(), D1_MO = new Date().getMonth();
/* Le 1er du mois à midi : dans le mois quel que soit le jour du passage,
   même à date figée le 1er (la suite se croit alors à 10 h). */
const D1_J1 = new Date(D1_AN, D1_MO, 1, 12).getTime();
const d1Ligne = (travail, q, prix, nature, tva) => ({ travail, unite: travail === 'PLANT' ? 'plant' : (travail === 'DEGAG' ? 'ha' : 'unite'),
  quantite: q, prix, nature, tva });
function grainesD1() {
  const avant = (m, j) => new Date(D1_AN - 1, m, j, 12).getTime();
  return Object.assign({}, VIDE, {
    chantiers: [
      chA('c1', { nom: 'Vaux', donneur: 'Cabinet Sylva', statut: 'paye', dateFacture: D1_J1, datePaiement: D1_J1,
        lignes: [d1Ligne('PLANT', 1000, 1.15, 'prestation', 10), d1Ligne('PROTEC', 100, 0.85, 'vente', 20),
          d1Ligne('PROTEC', 1, 37.5, 'debours', 20)] }),
      chA('c2', { nom: 'Marchand', donneur: 'Forêts et Gestion', statut: 'facture', numeroFacture: 'F-1', dateFacture: D1_J1,
        echeancePaiement: JA(-3), lignes: [d1Ligne('DEGAG', 2, 812.35, 'prestation', 20)] }),
      chA('c3', { nom: 'Sans ligne', statut: 'termine', dateFin: JA(-2) }),
      chA('c4', { nom: 'Essarts', statut: 'termine', dateFin: JA(-2), lignes: [d1Ligne('DEGAG', 1, 500, 'prestation', 20)] }),
      /* Le dernier trimestre de l'an dernier, pour la ligne MSA. */
      chA('c5', { nom: 'Octobre', statut: 'paye', dateFacture: avant(9, 15), datePaiement: avant(9, 20),
        lignes: [d1Ligne('DEGAG', 1, 1000.1, 'prestation', 20)] }),
      chA('c6', { nom: 'Novembre', statut: 'paye', dateFacture: avant(10, 15), datePaiement: avant(10, 20),
        lignes: [d1Ligne('DEGAG', 1, 2000.2, 'prestation', 20)] }),
      chA('c7', { nom: 'Décembre', statut: 'paye', dateFacture: avant(11, 15), datePaiement: avant(11, 20),
        lignes: [d1Ligne('DEGAG', 1, 3000.3, 'prestation', 20)] }),
      chA('c8', { nom: 'Perdu', statut: 'sansuite', aDevis: true, dateEnvoi: JA(-30) }),
      chA('c9', { nom: 'Attend', statut: 'envoye', aDevis: true, dateEnvoi: JA(-3) })],
    depenses: [
      { id: 'd1', date: D1_J1, fournisseur: 'Station', lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 61.37, taux: 20 }] },
      { id: 'd2', date: D1_J1, fournisseur: 'Motoculture', lignes: [{ libelle: 'Débroussailleuse', categorie: 'IMMO', ttc: 960, taux: 20 }] }],
    /* Ses prélèvements passés deviennent des dépenses tout seuls, dont celui
       du 1er de ce mois. */
    charges: [{ id: 'g1', libelle: 'Logiciel', beneficiaire: 'Éditeur', ttc: 24, periodicite: 'mensuel', categorie: 'ABO',
      taux: 20, debut: new Date(D1_AN, 0, 1, 12).getTime(), jour: 1, moisReference: 0, dansDepenses: true }]
  });
}
const d1Eur = (t, v) => t.w.BC.fmt(t.w.BCC.arr(v, 2), v % 1 ? 2 : 0) + ' €';
const d1Mo = (t, k) => sansBlancs(t.texte('#fi-corps [data-mo="' + k + '"]') || '');
const d1Tva = (t, zone, k) => sansBlancs(t.texte(zone + ' [data-tva="' + k + '"]') || '');
const D1_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const D1_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Mois : au centime de l’ancien Bilan, l’année mois par mois, sans toucher la période', async () => {
  const t = await ouvrir(grainesD1());
  const FIN = t.w.BCF, C = t.w.BCC, eur = v => d1Eur(t, v);
  const bM = FIN.bornes('mois', D1_AN, D1_MO);
  await parBarre(t, 'argent');
  verifier('Argent s’ouvre sur Mois', 'vue-finances', vueActive(t));
  verifier('au mois en cours', D1_MOIS[D1_MO] + ' ' + D1_AN, (t.texte('#mo-titre') || '').toLowerCase());
  /* Les valeurs calculées à la main, puis le calcul de l'ancien Bilan en vue
     mois : les deux doivent tomber juste. 1000 × 1,15 + 2 × 812,35 de
     prestation, 100 × 0,85 de vente ; le débours de 37,50 est dehors. */
  const ca = FIN.chiffreAffaires(t.stock('chantiers'), bM);
  verifier('facturé HT, à la main', [2859.7, 2774.7, 85, 37.5], [ca.total, ca.prestation, ca.vente, ca.debours]);
  verifier('le grand chiffre : le facturé HT du Bilan', sansBlancs(eur(2859.7)), d1Mo(t, 'ca'));
  verifier('prestation et vente', [sansBlancs(eur(2774.7)), sansBlancs(eur(85))], [d1Mo(t, 'prestation'), d1Mo(t, 'vente')]);
  verifierVrai('le débours dit à part', /Hors débours \(37,50 €\)/.test(t.texte('#mo-ca').replace(/ /g, ' ')));
  verifier('dont payé, pas encore payé : l’encaissé et l’en attente du Bilan', [sansBlancs(eur(ca.encaisse)), sansBlancs(eur(ca.aEncaisser))],
    [d1Mo(t, 'paye'), d1Mo(t, 'attente')]);
  verifier('qui valent, à la main', [1235, 1624.7], [ca.encaisse, ca.aEncaisser]);
  verifierVrai('le mot « encaissé » n’y est plus', !/ncaiss/.test(t.texte('#fi-corps')));
  verifierVrai('« Facturé en <mois> »', new RegExp('^Facturé en ' + D1_MOIS[D1_MO]).test(t.texte('#mo-fact')));
  /* TVA du mois : la Balance de TVA du Bilan, en lignes. */
  const bal = FIN.balanceTva(t.stock('chantiers'), t.stock('depenses'), bM, C.tauxLigne);
  verifier('TVA facturée, déductible, à la main', [464.44, 174.23], [bal.collectee.total, bal.deductible.total]);
  verifier('TVA du mois : facturée, déductible, solde',
    [sansBlancs(eur(464.44)), sansBlancs('− ' + eur(174.23)), sansBlancs(eur(290.21))],
    [d1Tva(t, '#mo-tva', 'facturee'), d1Tva(t, '#mo-tva', 'deductible'), d1Tva(t, '#mo-tva', 'solde')]);
  verifier('à reverser', 'À reverser', t.texte('#mo-tva [data-tva="sens"]'));
  verifier('un taux par ligne, base et montant', ['20 %sur 1 747,20 €349,44 €', '10 %sur 1 150 €115 €'].map(sansBlancs),
    t.$$('#mo-tva [data-tvataux]').map(b => sansBlancs(b.previousElementSibling.previousElementSibling.textContent +
      b.previousElementSibling.textContent + b.textContent)));
  verifierVrai('l’immobilisation se dit, avec sa mise en garde', d1Tva(t, '#mo-tva', 'immo') === sansBlancs(eur(160)) &&
    /un achat exceptionnel gonfle la TVA déductible/.test(t.texte('#mo-tva')));
  /* Dépenses du mois : le HT du bloc « Dépenses et marge », en barres. */
  verifier('dépenses du mois, HT, à la main', 871.14, FIN.totalDepenses(t.stock('depenses'), bM).ht);
  verifier('le total des dépenses du mois', sansBlancs(eur(871.14)), d1Mo(t, 'depenses'));
  verifier('une barre par catégorie, les charges fixes ensemble',
    [['IMMO', 'Immobilisation', '800€'], ['CARB', 'Frais de carburant pro', '51,14€'], ['charges', 'Charges fixes', '20€']],
    t.$$('#mo-dep [data-modep]').map(b => [b.dataset.modep, b.querySelector('.ag-hn').textContent, sansBlancs(b.querySelector('.num').textContent)]));
  /* L'histogramme : le « facturé » mois par mois d'Année — hors débours
     depuis le lot d2, donc la barre du mois vaut le grand chiffre. */
  const parMois = FIN.recettesParMois(t.stock('chantiers'), D1_AN);
  verifier('la barre du mois : le facturé hors débours, à la main', 2859.7, parMois[D1_MO]);
  const barres = t.$$('#mo-histo rect[data-mois]');
  verifier('une barre par mois facturé', parMois.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0),
    barres.map(r => Number(r.getAttribute('data-mois'))));
  verifierVrai('chacune dit le montant d’Année', barres.every(r => sansBlancs(r.textContent).indexOf(sansBlancs(eur(parMois[r.getAttribute('data-mois')]))) > 0));
  verifierVrai('le mois affiché en avant', barres.filter(r => r.classList.contains('cur')).map(r => r.getAttribute('data-mois')).join() === String(D1_MO));
  verifier('le total à fin du mois', sansBlancs(eur(parMois.slice(0, D1_MO + 1).reduce((s, v) => s + v, 0))), d1Mo(t, 'cumul'));
  verifierVrai('qui dit « à fin <mois> »', new RegExp('à fin ' + D1_COURTS[D1_MO].replace('.', '\\.')).test(t.texte('#mo-histo')));
  /* Le mois a son propre pas : la période de TVA, Dépenses et Année ne bouge pas. */
  const periode = JSON.stringify(t.w.BCUI._etat().periode);
  t.clic('#mo-prec'); await t.pause(200);
  const prec = new Date(D1_AN, D1_MO - 1, 1);
  verifier('‹ : le mois d’avant', D1_MOIS[prec.getMonth()] + ' ' + prec.getFullYear(), t.texte('#mo-titre').toLowerCase());
  verifier('le mois d’avant n’a pas les factures de ce mois', sansBlancs(eur(FIN.chiffreAffaires(t.stock('chantiers'),
    FIN.bornes('mois', prec.getFullYear(), prec.getMonth())).total)), d1Mo(t, 'ca'));
  verifier('la période partagée n’a pas bougé', periode, JSON.stringify(t.w.BCUI._etat().periode));
  t.clic('#mo-suiv'); await t.pause(200);
  verifier('› : retour au mois en cours', D1_MOIS[D1_MO] + ' ' + D1_AN, t.texte('#mo-titre').toLowerCase());
  /* Un appui sur une barre : Dépenses sur ce mois, filtrées. */
  t.clic('#mo-dep [data-modep="CARB"]'); await t.pause(300);
  verifier('la barre ouvre les Dépenses', 'vue-depenses', vueActive(t));
  verifier('sur ce mois', ['mois', String(D1_MO), String(D1_AN)], [t.$('#dep-type').value, t.$('#dep-indice').value, t.$('#dep-annee').value]);
  verifier('filtrées sur la catégorie', 'CARB', t.$('#dep-filtre').value);
  verifier('qui ne montre que le carburant', ['d1'], t.$$('#liste-depenses [data-depmod]').map(b => b.dataset.depmod));
  await parBarre(t, 'argent');
  t.clic('#mo-dep [data-modep="charges"]'); await t.pause(300);
  verifier('les charges fixes : le bloc des Dépenses', ['vue-depenses', 'dep-charges', 'tous'], [vueActive(t), defile(t), t.$('#dep-filtre').value]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Mois : la ligne MSA suit le trimestre du mois affiché, pas celui d’aujourd’hui', async () => {
  const t = await ouvrir(grainesD1());
  const FIN = t.w.BCF, eur = v => d1Eur(t, v);
  await parBarre(t, 'argent');
  /* Sur le mois en cours : les mois passés du trimestre chiffrés, ceux à
     venir dits « à venir ». */
  const q = Math.floor(D1_MO / 3) * 3, now = Date.now();
  let tot = 0;
  const parts = [q, q + 1, q + 2].map(i => {
    if (new Date(D1_AN, i, 1).getTime() > now) return D1_COURTS[i] + ' à venir';
    const v = FIN.chiffreAffaires(t.stock('chantiers'), FIN.bornes('mois', D1_AN, i)).total;
    tot += v; return D1_COURTS[i] + ' ' + eur(v);
  });
  verifier('le trimestre du mois en cours', sansBlancs('Trimestre (MSA) : ' + parts.join(' · ') + ' · total ' + eur(tot)),
    sansBlancs(t.texte('#mo-msa')));
  verifierVrai('un mois à venir est dit « à venir », jamais 0 €', q + 2 === D1_MO || /à venir/.test(t.texte('#mo-msa')));
  /* En janvier, il déclare octobre-décembre en allant sur décembre : le
     trimestre de l'an dernier, à la main. */
  for (let i = 0; i <= D1_MO; i++) { t.clic('#mo-prec'); await t.pause(120); }
  verifier('on est sur décembre de l’an dernier', 'décembre ' + (D1_AN - 1), t.texte('#mo-titre').toLowerCase());
  verifier('octobre, novembre, décembre, à la main',
    sansBlancs('Trimestre (MSA) : oct. 1 000,10 € · nov. 2 000,20 € · déc. 3 000,30 € · total 6 000,60 €'),
    sansBlancs(t.texte('#mo-msa')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ TVA : mois, trimestre, année, au centime de l’ancienne balance', async () => {
  const t = await ouvrir(grainesD1());
  const FIN = t.w.BCF, C = t.w.BCC, eur = v => d1Eur(t, v);
  await parBarre(t, 'argent');
  t.clic('[data-vue="tva"]'); await t.pause(250);
  verifier('l’onglet TVA s’ouvre', 'vue-tva', vueActive(t));
  const cas = [['mois', D1_MO], ['trimestre', Math.floor(D1_MO / 3)], ['annee', 0]];
  for (const [type, indice] of cas) {
    t.choisir('#fi-type', type); await t.pause(150);
    if (type !== 'annee') { t.choisir('#fi-indice', String(indice)); await t.pause(150); }
    const bal = FIN.balanceTva(t.stock('chantiers'), t.stock('depenses'), FIN.bornes(type, D1_AN, indice), C.tauxLigne);
    verifier(type + ' : facturée, déductible, solde de la balance',
      [sansBlancs(eur(bal.collectee.total)), sansBlancs('− ' + eur(bal.deductible.total)), sansBlancs(eur(bal.montant))],
      [d1Tva(t, '#tva-corps', 'facturee'), d1Tva(t, '#tva-corps', 'deductible'), d1Tva(t, '#tva-corps', 'solde')]);
    verifier(type + ' : chaque taux', Object.keys(bal.collectee.parTaux).sort((x, y) => y - x).map(k => sansBlancs(eur(bal.collectee.parTaux[k]))),
      t.$$('#tva-corps [data-tvataux]').map(b => sansBlancs(b.textContent)));
    verifier(type + ' : le sens', bal.sens === 'a_recuperer' ? 'À récupérer' : (bal.sens === 'a_payer' ? 'À reverser' : 'Équilibre'),
      t.texte('#tva-corps [data-tva="sens"]'));
  }
  /* Le mois choisi ici est celui de Mois : même balance, même mise en page. */
  t.choisir('#fi-type', 'mois'); await t.pause(150); t.choisir('#fi-indice', String(D1_MO)); await t.pause(150);
  verifier('le mois de l’onglet TVA vaut la TVA du mois', ['facturee', 'deductible', 'solde'].map(k => d1Tva(t, '#mo-tva', k)),
    ['facturee', 'deductible', 'solde'].map(k => d1Tva(t, '#tva-corps', k)));
  verifierVrai('la règle suivie est dite', /La TVA facturée est comptée à la date de la facture/.test(t.texte('#tva-corps')));
  verifier('la période est partagée avec Dépenses et Année', ['mois', 'mois'], [t.$('#dep-type').value, t.$('#an-type').value]);
  verifierVrai('la TVA de l’année reste dans Déclarations', (() => { t.clic('[data-vue="analyses"]'); return true; })());
  await t.pause(200); t.clic('[data-ana="declarations"]'); await t.pause(200);
  verifierVrai('« TVA — année » dans Année ▸ Déclarations', new RegExp('TVA — année ' + D1_AN).test(t.texte('#ana-corps')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Dépenses : un appui ouvre, Supprimer dans la fenêtre, la corbeille la rend', async () => {
  const t = await ouvrir(grainesD1());
  const FIN = t.w.BCF, eur = v => d1Eur(t, v);
  t.w.confirm = () => true;
  await parBarre(t, 'argent');
  t.clic('[data-vue="depenses"]'); await t.pause(250);
  /* Les indicateurs, intacts : ceux de l'ancien onglet, sur la période. */
  const tot = FIN.totalDepenses(t.stock('depenses'), FIN.bornes('annee', D1_AN, 0));
  verifier('indicateurs : TTC, HT, TVA déductible, nombre', ['TTC sur ' + D1_AN, 'HT', 'TVA déductible', 'achats saisis'],
    t.$$('#dep-totaux .carte2 small').map(s => s.textContent));
  verifier('aux chiffres de l’ancien onglet', [eur(tot.ttc), eur(tot.ht), eur(tot.tva), String(tot.n)].map(sansBlancs),
    t.$$('#dep-totaux .carte2 b').map(b => sansBlancs(b.textContent)));
  verifierVrai('« + Dépense » reste dans la page', !!t.$('#vue-depenses #dep-nouvelle'));
  verifierVrai('le filtre par catégorie aussi', t.$$('#dep-filtre option').length > 2);
  verifier('plus de Modifier ni de Supprimer sur les lignes', [0, 0],
    [t.$$('#liste-depenses .btn-min').length, t.$$('#liste-depenses [data-depsup]').length]);
  /* La ligne de la maquette : fournisseur ; date · catégorie ; TTC et TVA. */
  const l1 = t.$('#liste-depenses [data-depmod="d1"]');
  verifier('la ligne : fournisseur, date et catégorie, TTC et TVA',
    sansBlancs('Station' + new Date(D1_J1).toLocaleDateString('fr-FR') + ' · Frais de carburant pro61,37 €TVA 10,23 €'), sansBlancs(l1.textContent));
  const auto = t.$$('#liste-depenses [data-depmod]').map(b => b.dataset.depmod).filter(id => (t.stock('depenses').filter(d => d.id === id)[0] || {}).auto)[0];
  verifierVrai('une dépense née de la charge dit « charge fixe » et « La charge »',
    !!auto && /charge fixe/.test(t.texte('[data-depmod="' + auto + '"]')) && /La charge$/.test(t.texte('[data-depmod="' + auto + '"]')));
  /* Un appui ouvre la dépense ; Supprimer est dans sa fenêtre. */
  l1.click(); await t.pause(250);
  verifierVrai('un appui ouvre la dépense, en modification', t.texte('#modale-titre') === 'Modifier la dépense' && t.$('#dp-four').value === 'Station');
  verifierVrai('avec Supprimer', !!t.$('#dp-sup'));
  t.clic('#dp-sup'); await t.pause(400);
  verifierVrai('la dépense est partie, la fenêtre fermée', !t.stock('depenses').some(d => d.id === 'd1') && t.$('#modale').hidden);
  verifierVrai('et la liste ne la montre plus', !t.$('#liste-depenses [data-depmod="d1"]'));
  await parMenu(t, 'corbeille');
  const rep = t.$$('#s-recup [data-repecher]').filter(b => /Station/.test(b.closest('.liste-item').textContent))[0];
  verifierVrai('elle est dans la corbeille, à son montant',
    !!rep && /61,37/.test(rep.closest('.liste-item').textContent));
  rep.click(); await t.pause(500);
  verifierVrai('restaurée, elle revient', t.stock('depenses').some(d => d.id === 'd1'));
  /* Une nouvelle dépense n'a rien à supprimer. */
  await parBarre(t, 'argent'); t.clic('[data-vue="depenses"]'); await t.pause(200);
  t.clic('#dep-nouvelle'); await t.pause(250);
  verifierVrai('une nouvelle dépense n’a pas de Supprimer', t.texte('#modale-titre') === 'Dépense' && !t.$('#dp-sup'));
  t.clic('#modale-x'); await t.pause(150);
  /* Née d'une charge : c'est la charge qui s'ouvre, comme son ancien bouton. */
  t.clic('[data-depmod="' + auto + '"]'); await t.pause(300);
  verifier('la dépense d’une charge ouvre la charge', 'Modifier la charge', t.texte('#modale-titre'));
  verifier('sur le bloc Charges fixes', ['vue-depenses', 'dep-charges'], [vueActive(t), defile(t)]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Dépenses ▸ Charges fixes : le même contenu, un appui ouvre, Supprimer dans la fenêtre', async () => {
  const t = await ouvrir(grainesD1());
  const FIN = t.w.BCF, C = t.w.BCC;
  t.w.confirm = () => true;
  await parBarre(t, 'argent');
  t.clic('[data-vue="depenses"]'); await t.pause(250);
  verifierVrai('le bloc Charges fixes, sous la liste', t.$('#liste-depenses').compareDocumentPosition(t.$('#dep-charges')) & 4);
  verifierVrai('avec « + Charge »', !!t.$('#dep-charges #chg-nouvelle'));
  verifier('le résumé : par an, par mois, combien', ['288 €', '24 €', '1'].map(sansBlancs),
    t.$$('#charges-resume .kpi .carte2 b').map(b => sansBlancs(b.textContent)));
  const l = t.$('#charges-resume [data-chgmod="g1"]');
  /* Le prélèvement du jour compte encore comme « prochain » toute la journée. */
  const proch = new Date(D1_AN, D1_MO + (new Date().getDate() === 1 ? 0 : 1), 1, 12);
  verifierVrai('la ligne : quand, prochain prélèvement, catégorie, montants',
    /Logiciel/.test(l.textContent) && /le 1 de chaque mois/.test(l.textContent) &&
    new RegExp('prochain prélèvement \\S+ 1 ' + D1_COURTS[proch.getMonth()].replace('.', '\\.')).test(l.textContent.replace(/ /g, ' ')) &&
    /Abonnement, logiciel · payé à Éditeur · TVA 20/.test(l.textContent) && /288 €\/an/.test(l.textContent.replace(/ /g, ' ')));
  verifier('plus de Modifier ni de Supprimer sur la ligne', 0, t.$$('#charges-resume .btn-min, #charges-resume [data-chgsup]').length);
  /* Prélèvements à venir : l'ancienne carte Échéances, contenu intact. */
  const b = FIN.bornes('annee', D1_AN, 0), dues = FIN.chargesDues(t.stock('charges'), t.stock('depenses'), b);
  verifierVrai('Prélèvements à venir : quand l’argent part, où il part', /^Prélèvements à venir/.test(t.texte('#dep-prelevements')) &&
    /Quand l’argent part/.test(t.texte('#charges-echeances')) && /Où il part/.test(t.texte('#charges-echeances')));
  verifier('et les prélèvements de la période', dues.length, t.$$('#charges-periode .liste-item').length);
  verifierVrai('dits par leur nom', new RegExp(D1_AN + ' — ' + dues.length + ' prélèvements').test(t.texte('#charges-periode')));
  /* Même geste qu'une dépense. */
  l.click(); await t.pause(250);
  verifierVrai('un appui ouvre la charge', t.texte('#modale-titre') === 'Modifier la charge' && t.$('#cg-lib').value === 'Logiciel');
  verifierVrai('qui dit « prélèvements », plus « échéances »', /Enregistrer les prélèvements dans les dépenses/.test(t.texte('#modale-corps')) &&
    !/échéances/.test(t.texte('#modale-corps')));
  t.clic('#cg-sup'); await t.pause(500);
  verifierVrai('Supprimer, dans la fenêtre : la charge part', !(t.stock('charges') || []).length && t.$('#modale').hidden);
  verifierVrai('ses dépenses automatiques avec elle', !(t.stock('depenses') || []).some(d => d.auto));
  await parMenu(t, 'corbeille');
  verifierVrai('elle est dans la corbeille, à son montant', /Logiciel/.test(t.texte('#s-recup')) && /24 €/.test(t.texte('#s-recup').replace(/ /g, ' ')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent : les anciennes clés de vue mènent au nouvel endroit', async () => {
  const t = await ouvrir(Object.assign({}, grainesD1(), { module: 'analyses' }));
  verifier('« analyses » en mémoire mène à Argent', 'finances', t.stock('module'));
  t.w.BCUI._allerModule('finances', 'charges'); await t.pause(250);
  verifier('« charges » : les Dépenses, défilées au bloc Charges fixes', ['vue-depenses', 'dep-charges'], [vueActive(t), defile(t)]);
  verifier('la pastille Dépenses est la pastille ouverte', ['Dépenses'], pastilleOuverte(t));
  t.w.BCUI._allerModule('finances', 'analyses'); await t.pause(250);
  verifier('« analyses » : Année', ['vue-analyses', ['Année']], [vueActive(t), pastilleOuverte(t)]);
  t.w.BCUI._allerModule('finances', 'finances'); await t.pause(250);
  verifier('« finances » : Mois', ['vue-finances', ['Mois']], [vueActive(t), pastilleOuverte(t)]);
  t.w.BCUI._allerModule('finances', 'depenses'); await t.pause(250);
  verifier('« depenses » : Dépenses, en haut', ['vue-depenses', ['Dépenses']], [vueActive(t), pastilleOuverte(t)]);
  verifier('une note de mise à jour sur « charges » trouve son module', 'finances', t.w.BCUI._moduleDeVue('charges'));
  /* ☰ ▸ Réglages depuis chaque pastille d'Argent : Financier. */
  /* Les zones des réglages n'ont pas d'identifiant : on garde l'élément
     amené en vue, comme le scénario des zones d'arrivée. */
  let vus = [];
  const garde = t.w.Element.prototype.scrollIntoView;
  t.w.Element.prototype.scrollIntoView = function () { vus.push(this); garde.call(this); };
  for (const v of ['finances', 'tva', 'depenses', 'analyses']) {
    await parBarre(t, 'argent'); t.clic('[data-vue="' + v + '"]'); await t.pause(200);
    vus = [];
    await parMenu(t, 'reglages');
    const ong = t.$$('#regl-nav .chip').filter(b => b.getAttribute('aria-pressed') === 'true')[0];
    verifier(v + ' : ☰ ▸ Réglages arrive sur Entreprise ▸ Financier', ['ent', 'fin'],
      [ong && ong.dataset.regl, vus.map(e => e.dataset && e.dataset.sous).filter(Boolean).slice(-1)[0] || null]);
  }
  verifier('l’écran s’appelle Argent', 'Argent', (await parBarre(t, 'argent'), t.texte('#b-ecran')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Le tableau « Où sont allés les blocs de Finances (lot d1) » de
   l'inventaire : élément, nouvel endroit, clé de preuve. */
function retraitsD1() {
  const debut = INVENTAIRE.findIndex(l => /^### Où sont allés les blocs de Finances/.test(l));
  const lignes = [];
  for (let i = debut + 1; debut >= 0 && i < INVENTAIRE.length && !/^###/.test(INVENTAIRE[i]); i++) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*`([a-z0-9-]+)`\s*\|$/.exec(INVENTAIRE[i]);
    if (m) lignes.push({ element: m[1], endroit: m[2], cle: m[3] });
  }
  return lignes;
}
scenario('Inventaire d1 : chaque bloc de Finances a sa place, au centime', async () => {
  const t = await ouvrir(grainesD1());
  t.w.confirm = () => true;
  const FIN = t.w.BCF, C = t.w.BCC, eur = v => d1Eur(t, v), sb = sansBlancs;
  const ch = () => t.stock('chantiers'), dp = () => t.stock('depenses');
  const bM = FIN.bornes('mois', D1_AN, D1_MO), bA = FIN.bornes('annee', D1_AN, 0);
  const vers = async (v, ana) => {
    if (!t.$('#modale').hidden) { t.clic('#modale-x'); await t.pause(120); }
    await parBarre(t, 'argent');
    if (v) { t.clic('[data-vue="' + v + '"]'); await t.pause(200); }
    if (ana) { t.clic('[data-ana="' + ana + '"]'); await t.pause(200); }
  };
  const pli = (zone, cle) => t.$(zone + ' [data-loin="' + cle + '"]');
  const contient = (txt, v) => sb(txt || '').indexOf(sb(eur(v))) >= 0;
  const PREUVES = {
    'd1-periode': async () => { await vers();
      const p0 = JSON.stringify(t.w.BCUI._etat().periode);
      t.clic('#mo-prec'); await t.pause(150); const bouge = t.texte('#mo-titre'); t.clic('#mo-suiv'); await t.pause(150);
      const memePeriode = p0 === JSON.stringify(t.w.BCUI._etat().periode);
      await vers('tva'); t.choisir('#fi-type', 'trimestre'); await t.pause(150);
      const partage = t.$('#dep-type').value === 'trimestre' && t.$('#an-type').value === 'trimestre';
      t.choisir('#an-type', 'annee'); await t.pause(150);
      return bouge !== t.texte('#mo-titre') && memePeriode && partage && t.$('#fi-type').value === 'annee'; },
    'd1-ca': async () => { await vers(); const ca = FIN.chiffreAffaires(ch(), bM);
      return d1Mo(t, 'ca') === sb(eur(ca.total)) && d1Mo(t, 'prestation') === sb(eur(ca.prestation)) &&
        d1Mo(t, 'vente') === sb(eur(ca.vente)) && t.$$('#mo-histo rect[data-mois]').length > 0 && /Trimestre \(MSA\)/.test(t.texte('#mo-msa')); },
    'd1-paye': async () => { await vers(); const ca = FIN.chiffreAffaires(ch(), bM);
      return d1Mo(t, 'paye') === sb(eur(ca.encaisse)) && d1Mo(t, 'attente') === sb(eur(ca.aEncaisser)); },
    'd1-ajour': async () => { await vers(); const tt = C.totaux(ch(), t.stock('cfg') || {});
      const ok = /dont 1 sans montant/.test(t.texte('#mo-afacturer')) && contient(t.texte('#mo-afacturer'), tt.aFacturer) &&
        contient(t.texte('#mo-attente'), FIN.chiffreAffaires(ch()).aEncaisser) && /dont 1 impayée/.test(t.texte('#mo-attente'));
      t.clic('#mo-afacturer'); await t.pause(300); const g1 = vueActive(t) === 'vue-carnet' && defile(t) === 'faire';
      await vers(); t.clic('#mo-attente'); await t.pause(300);
      /* Sa seule facture en attente est échue : elle est dans « À faire
         maintenant », et c'est là que l'appui mène (le cas d'une facture
         pas encore échue est joué par « À ce jour : à facturer »). */
      return ok && g1 && vueActive(t) === 'vue-carnet' && defile(t) === 'faire'; },
    'd1-abattements': async () => { await vers('analyses', 'ensemble'); const ca = FIN.chiffreAffaires(ch(), bA);
      const ok = !!pli('#ana-corps', 'an-abattements') && sb(t.texte('[data-an="apres"]')) === sb(eur(ca.totalApres)) &&
        /abattement 50/.test(t.texte('[data-loin="an-abattements"]')) && /abattement 71/.test(t.texte('[data-loin="an-abattements"]'));
      t.clic('[data-ana="declarations"]'); await t.pause(200);
      return ok && !!t.$('#ana-corps .ligne-ca'); },
    'd1-tva': async () => { await vers(); const bal = FIN.balanceTva(ch(), dp(), bM, C.tauxLigne);
      const mois = d1Tva(t, '#mo-tva', 'solde') === sb(eur(bal.montant)) && d1Tva(t, '#mo-tva', 'facturee') === sb(eur(bal.collectee.total));
      await vers('tva'); const balA = FIN.balanceTva(ch(), dp(), bA, C.tauxLigne);
      return mois && d1Tva(t, '#tva-corps', 'deductible') === sb('− ' + eur(balA.deductible.total)) && d1Tva(t, '#tva-corps', 'solde') === sb(eur(balA.montant)); },
    'd1-depenses-marge': async () => { await vers();
      const ok = d1Mo(t, 'depenses') === sb(eur(FIN.totalDepenses(dp(), bM).ht)) && t.$$('#mo-dep [data-modep]').length >= 2;
      return ok && !!pli('#mo-loin', 'marge') && d1Mo(t, 'marge') === sb(eur(FIN.resultat(ch(), dp(), bM).marge)); },
    'd1-deplacements': async () => { await vers(); const carb = FIN.parCategorie(dp(), bM).filter(x => x.categorie === 'CARB')[0];
      const ok = !!pli('#mo-loin', 'deplacements') && /Kilomètres du mois/.test(t.texte('[data-loin="deplacements"]')) &&
        contient(t.texte('[data-loin="deplacements"]'), carb.ttc);
      await vers('analyses', 'ensemble'); const refus = C.analyseRefus(ch());
      return ok && refus.total === 1 && /Pourquoi les devis n’aboutissent pas/.test(t.texte('[data-loin="an-devis"]')) &&
        t.texte('[data-loin="an-devis"]').indexOf(refus.motifs[0].nom) >= 0; },
    'd1-donneurs': async () => { await vers(); const pd = FIN.caParDonneur(ch(), bM), z = t.texte('[data-loin="donneurs"]');
      const ok = pd.length === 2 && pd.every(x => z.indexOf(x.donneur) >= 0 && contient(z, x.ht)) && /Tous chantiers confondus/.test(z);
      await vers('analyses', 'recettes');
      return ok && /Par donneur d’ordre/.test(t.texte('#ana-corps')); },
    'd1-devis': async () => { await vers('analyses', 'ensemble'); const tr = FIN.tauxReussite(ch(), C.aDevis), z = sb(t.texte('[data-loin="an-devis"]'));
      return tr.proposes === 2 && z.indexOf(sb(tr.gagnes + 'gagnés')) >= 0 && z.indexOf(sb(tr.perdus + 'sans suite')) >= 0 &&
        z.indexOf(sb(tr.enAttente + 'en attente')) >= 0 && z.indexOf(sb(tr.taux + ' %acceptés')) >= 0; },
    'd1-plusloin': async () => { await vers();
      const dues = FIN.chargesDues(t.stock('charges'), dp(), bM);
      const fourn = /Refacturé/.test(t.texte('[data-loin="fournitures"]')) ||
        /Aucune fourniture refacturée/.test(t.texte('[data-loin="fournitures"]'));
      return ['donneurs', 'rapporte', 'fournitures', 'marge', 'charges', 'deplacements'].every(k => pli('#mo-loin', k) && !pli('#mo-loin', k).open) &&
        /Prestations seules/.test(t.texte('[data-loin="rapporte"]')) && !/Pose de protections/.test(t.texte('[data-loin="rapporte"]')) &&
        contient(t.texte('[data-loin="rapporte"]'), 1624.7) && dues.length === 1 &&
        contient(t.texte('[data-loin="charges"]'), dues.reduce((s, d) => s + d.ttc, 0)) && fourn; },
    'd1-dep-ind': async () => { await vers('depenses'); const tot = FIN.totalDepenses(dp(), bA);
      return !!t.$('#dep-nouvelle') && !!t.$('#dep-type') && t.$$('#dep-totaux .carte2 b').map(b => sb(b.textContent)).join('|') ===
        [eur(tot.ttc), eur(tot.ht), eur(tot.tva), String(tot.n)].map(sb).join('|') && t.$$('#dep-filtre option').length > 2; },
    'd1-dep-liste': async () => { await vers('depenses'); t.clic('[data-depmod="d2"]'); await t.pause(250);
      const ok = t.texte('#modale-titre') === 'Modifier la dépense' && !!t.$('#dp-sup') && !t.$('#liste-depenses [data-depsup]');
      t.clic('#modale-x'); await t.pause(120);
      const auto = dp().filter(d => d.auto)[0];
      t.clic('[data-depmod="' + auto.id + '"]'); await t.pause(300);
      return ok && t.texte('#modale-titre') === 'Modifier la charge'; },
    'd1-charges': async () => { await vers('depenses');
      const ok = /^Charges fixes/.test(t.texte('#dep-charges')) && !!t.$('#chg-nouvelle') && /prochain prélèvement/.test(t.texte('#charges-resume')) &&
        !t.$('#charges-resume [data-chgsup]');
      t.clic('[data-chgmod="g1"]'); await t.pause(250);
      return ok && t.texte('#modale-titre') === 'Modifier la charge' && !!t.$('#cg-sup'); },
    'd1-prelevements': async () => { await vers('depenses');
      return /^Prélèvements à venir/.test(t.texte('#dep-prelevements')) && /Quand l’argent part/.test(t.texte('#charges-echeances')) &&
        /Où il part/.test(t.texte('#charges-echeances')) && t.$$('#charges-periode .liste-item').length === FIN.chargesDues(t.stock('charges'), dp(), bA).length; },
    'd1-annee': async () => { await vers('analyses');
      const ok = pastilleOuverte(t).join() === 'Année' && t.$$('#ana-onglets .chip').map(b => b.textContent).join('|') ===
        'Vue d\'ensemble|Recettes|Dépenses|Déclarations' && !!t.$('#an-type') && !!t.$('#an-indice') && !!t.$('#an-annee');
      t.clic('[data-ana="depenses"]'); await t.pause(200);
      const dep = /TVA payée sur ces achats/.test(t.texte('#ana-corps'));
      t.clic('[data-ana="declarations"]'); await t.pause(200);
      return ok && dep && !!t.$('#sim-cot, #decl-cot') && !!t.$('#decl-vers'); },
    'd1-cumuls': async () => { await vers('analyses', 'ensemble'); const tt = C.totaux(ch(), t.stock('cfg') || {});
      const z = t.texte('[data-loin="an-cumuls"] #carnet-totaux');
      const ok = !!z && contient(z, tt.caFacture) && /dont payé/.test(z) && /jours-homme cumulés/.test(z);
      await parBarre(t, 'chantiers');
      return ok && !t.$('#vue-carnet #carnet-totaux') && !/Cumuls du carnet/.test(t.texte('#vue-carnet')); }
  };
  const lignes = retraitsD1();
  verifierVrai('le tableau du lot d1 est lu (' + lignes.length + ' lignes)', lignes.length >= 15);
  verifier('chaque ligne a sa preuve', [], lignes.filter(l => !PREUVES[l.cle]).map(l => l.cle));
  verifier('chaque preuve a sa ligne', [], Object.keys(PREUVES).filter(k => !lignes.some(l => l.cle === k)));
  for (const l of lignes) {
    if (!PREUVES[l.cle]) continue;
    verifierVrai(l.element + ' → ' + l.endroit, await PREUVES[l.cle]());
  }
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Année : la seconde rangée de pastilles se distingue de celle d’Argent', async () => {
  const t = await ouvrir(grainesD1());
  await parBarre(t, 'argent'); t.clic('[data-vue="analyses"]'); await t.pause(250);
  const css = t.d.documentElement.outerHTML;
  verifierVrai('elle porte sa propre classe', t.$('#ana-onglets').classList.contains('ana-onglets'));
  verifierVrai('soulignée, sans fond plein quand elle est choisie',
    /\.chips\.ana-onglets \.chip\[aria-pressed=true\]\{background:none;[^}]*border-bottom-color:var\(--accent\)/.test(css));
  verifierVrai('et passe à la ligne plutôt que d’élargir la page', !/\.chips\.ana-onglets\{[^}]*nowrap/.test(css) && /\.chips\{display:flex;flex-wrap:wrap/.test(css));
  verifier('aucune erreur', [], t.erreurs);
});

/* ===================================================== lot d2 (4.96.0)
   La fenêtre d'une dépense devient une feuille (D1 à D4) ; le simulateur
   d'Année devient un essai ; le débours sort des barres mois par mois. */
/* La catégorie d'une ligne de dépense : sa puce, ou « Autre… » puis la
   liste entière. */
async function categorieDep(t, i, code) {
  const puce = t.$('#dp-lignes [data-dlpuce="' + i + '"][data-cat="' + code + '"]');
  if (puce) { puce.click(); await t.pause(120); return true; }
  if (!t.$('[data-dlsel="' + i + '"]')) { t.clic('[data-dlautre="' + i + '"]'); await t.pause(120); }
  const ok = t.choisir('[data-dlsel="' + i + '"]', code);
  await t.pause(120);
  return ok;
}
async function plusDepense(t) {
  t.clic('#barre [data-barre="plus"]'); await t.pause(200);
  t.clic('#modale [data-plus="depense"]'); await t.pause(300);
}
const puceChoisie = (t, i) => t.$$('#dp-lignes [data-dli="' + i + '"] [data-dlpuce][aria-pressed="true"]').map(b => b.textContent);
const tauxChoisi = (t, i) => t.$$('#dp-lignes [data-dltx="' + i + '"][aria-pressed="true"]').map(b => b.dataset.taux);
const tauxBloques = (t, i) => t.$$('#dp-lignes [data-dltx="' + i + '"]').map(b => b.disabled);
const piedDep = (t, k) => sansBlancs(t.texte('#dp-apercu [data-dp="' + k + '"]') || '');
const insecables = s => String(s || '').replace(/ /g, ' ');
/* Le 1er du mois à 8 h 30 : une date qui n'est pas à midi, comme en posent
   la commande et l'intervention. */
const D2_MATIN = new Date(D1_AN, D1_MO, 1, 8, 30).getTime();

/* --------------------------------------------------------------------- */
scenario('Dépense : la catégorie en puces, « Autre… » ouvre les dix-neuf (D1)', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  const FIN = t.w.BCF;
  await plusDepense(t);
  verifier('+ ▸ Dépense ouvre la feuille « Dépense »', 'Dépense', t.texte('#modale-titre'));
  verifier('trois blocs titrés', ['Quand, où', 'Le ticket une ligne par nature d’achat', 'Pour s’y retrouver'],
    t.$$('#modale-corps .fj-sous').map(p => p.textContent.replace(/\s+/g, ' ').trim()));
  verifier('la date : aujourd’hui d’office', jourISO(Date.now()), t.$('#dp-date').value);
  verifier('six puces et « Autre… », dans l’ordre',
    ['Consommable', 'Repas', 'Carburant', 'EPI', 'Petit outillage', 'Fournitures', 'Autre…'],
    t.$$('#dp-lignes .dp-cats button').map(b => b.textContent));
  verifier('leurs codes', ['CONSO', 'REPAS', 'CARB', 'EPI', 'PETITMAT', 'FOURN'],
    t.$$('#dp-lignes [data-dlpuce]').map(b => b.dataset.cat));
  verifierVrai('la catégorie est en tête de la ligne, avant le montant',
    t.$('.dp-cats').compareDocumentPosition(t.$('#dl-ttc-0')) & 4);
  verifierVrai('pas de litres tant que ce n’est pas du carburant', !t.$('[data-dllitres]'));
  verifierVrai('une seule ligne ne se retire pas', !t.$('[data-dlsup]'));
  verifierVrai('le pied attend un montant', /Saisissez au moins un montant/.test(t.texte('#dp-apercu')));
  t.saisir('#dl-ttc-0', '80');
  await categorieDep(t, 0, 'CARB');
  verifier('puce Carburant : choisie, seule', ['Carburant'], puceChoisie(t, 0));
  verifierVrai('les litres paraissent', !!t.$('#dl-l-0'));
  verifier('le montant tapé est resté', '80', t.$('#dl-ttc-0').value);
  t.saisir('#dl-l-0', '50');
  verifierVrai('le prix du litre se calcule sous le champ', /1,600 € le litre/.test(insecables(t.texte('[data-dlprix="0"]'))));
  /* « Autre… » : la liste entière, aux noms complets. */
  verifierVrai('la liste est fermée au départ', !t.$('[data-dlsel="0"]'));
  t.clic('[data-dlautre="0"]'); await t.pause(120);
  verifier('« Autre… » ouvre toutes les catégories de Sylve', FIN.CATEGORIES.map(c => c.n), options(t, '[data-dlsel="0"]'));
  verifier('les dix-neuf', 19, t.$$('[data-dlsel="0"] option').length);
  t.choisir('[data-dlsel="0"]', 'ASSUR'); await t.pause(120);
  verifier('Assurance, prise dans la liste, est affichée sur la ligne', ['Assurance'], puceChoisie(t, 0));
  verifierVrai('les litres sont repartis', !t.$('#dl-l-0'));
  t.clic('#dp-ok'); await t.pause(400);
  const d = t.stock('depenses')[0];
  verifier('enregistrée en Assurance, sans litres', ['ASSUR', 80, false],
    [d.lignes[0].categorie, d.lignes[0].ttc, 'litres' in d.lignes[0]]);
  verifierVrai('le message dit où elle est', /elle est dans Argent ▸ Dépenses/.test(t.texte('#toast')));
  /* Un plein garde ses litres. */
  await plusDepense(t);
  await categorieDep(t, 0, 'CARB');
  t.saisir('#dl-ttc-0', '90'); t.saisir('#dl-l-0', '50');
  t.clic('#dp-ok'); await t.pause(400);
  const plein = t.stock('depenses')[1].lignes[0];
  verifier('un plein : catégorie, montant, litres, taux', ['CARB', 90, 50, 20], [plein.categorie, plein.ttc, plein.litres, plein.taux]);
  /* Les autres portes ouvrent la même feuille. */
  await parBarre(t, 'argent'); t.clic('[data-vue="depenses"]'); await t.pause(250);
  t.clic('#dep-nouvelle'); await t.pause(300);
  verifierVrai('« + Dépense » de la page : la même feuille', t.texte('#modale-titre') === 'Dépense' && t.$$('#dp-lignes [data-dlpuce]').length === 6);
  t.clic('#modale-x'); await t.pause(150);
  t.clic('#liste-depenses [data-depmod="' + d.id + '"]'); await t.pause(300);
  verifierVrai('un appui sur la ligne : la même feuille, en modification',
    t.texte('#modale-titre') === 'Modifier la dépense' && puceChoisie(t, 0).join() === 'Assurance' && !!t.$('[data-dlsel="0"]'));
  verifierVrai('sans « Comme la dernière »', !t.$('#dp-comme'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Dépense : sans TVA posé d’office et bloqué, retour à 20 % (D2)', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances',
    depenses: [{ id: 'v1', date: D1_J1, fournisseur: 'Mutuelle', maj: 5,
      lignes: [{ libelle: 'Responsabilité civile', categorie: 'ASSUR', ttc: 120, taux: 20 }] }] }));
  await plusDepense(t);
  t.saisir('#dl-ttc-0', '120');
  verifier('au départ : 20 %, libre', [['20'], [false, false, false, false]], [tauxChoisi(t, 0), tauxBloques(t, 0)]);
  verifier('les quatre boutons', ['20 %', '10 %', '5,5 %', 'sans'], t.$$('[data-dltx="0"]').map(b => insecables(b.textContent)));
  for (const code of ['ASSUR', 'BANQUE', 'PRET', 'COTIS']) {
    await categorieDep(t, 0, 'CONSO');
    await categorieDep(t, 0, code);
    verifier(code + ' : « sans », les quatre boutons bloqués', [['0'], [true, true, true, true]], [tauxChoisi(t, 0), tauxBloques(t, 0)]);
  }
  verifierVrai('la ligne dit pourquoi', /Pas de TVA sur cette catégorie/.test(t.texte('[data-dli="0"]')));
  /* Même en forçant le bouton, le taux ne bouge pas. */
  const b20 = t.$('[data-dltx="0"][data-taux="20"]');
  b20.disabled = false; b20.click(); await t.pause(100);
  verifier('un bouton forcé ne change rien', ['0'], tauxChoisi(t, 0));
  verifier('le pied : pas de TVA déductible', sansBlancs('0 €'), piedDep(t, 'tva'));
  await categorieDep(t, 0, 'CARB');
  verifier('puis Carburant : retour à 20 %, libre', [['20'], [false, false, false, false]], [tauxChoisi(t, 0), tauxBloques(t, 0)]);
  t.clic('[data-dltx="0"][data-taux="10"]'); await t.pause(100);
  verifier('un taux se choisit d’un appui', ['10'], tauxChoisi(t, 0));
  verifier('le montant tapé est resté', '120', t.$('#dl-ttc-0').value);
  await categorieDep(t, 0, 'REPAS');
  verifier('d’une catégorie avec TVA à une autre, le taux choisi reste', ['10'], tauxChoisi(t, 0));
  t.clic('#dp-ok'); await t.pause(400);
  const neuve = t.stock('depenses').filter(d => d.id !== 'v1')[0];
  verifier('enregistrée à 10 %', ['REPAS', 120, 10], [neuve.lignes[0].categorie, neuve.lignes[0].ttc, neuve.lignes[0].taux]);
  /* Une ligne ancienne, saisie à 20 % sur une assurance : rien n'est corrigé
     dans son dos ; « sans » la corrige, et se bloque alors. */
  await parBarre(t, 'argent'); t.clic('[data-vue="depenses"]'); await t.pause(250);
  t.clic('#liste-depenses [data-depmod="v1"]'); await t.pause(300);
  verifier('l’ancienne garde son taux, pas bloqué', [['20'], [false, false, false, false]], [tauxChoisi(t, 0), tauxBloques(t, 0)]);
  verifierVrai('et la ligne le signale', /D’ordinaire sans TVA : cette ligne a été saisie à 20 %/.test(insecables(t.texte('[data-dli="0"]'))));
  t.clic('[data-dltx="0"][data-taux="0"]'); await t.pause(100);
  verifier('« sans » la corrige et se bloque', [['0'], [true, true, true, true]], [tauxChoisi(t, 0), tauxBloques(t, 0)]);
  t.clic('#dp-ok'); await t.pause(400);
  verifier('enregistrée sans TVA', 0, t.stock('depenses').filter(d => d.id === 'v1')[0].lignes[0].taux);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Dépense : « Comme la dernière » reprend fournisseur et catégories (D3), le fournisseur est proposé (D4)', async () => {
  /* La charge fixe a des prélèvements plus récents que la dépense « Brico » :
     aucun n'est « la dernière ». */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances',
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours' })],
    depenses: [
      { id: 'b1', date: JA(-40), fournisseur: 'Brico', numero: 'T-88', chantier: 'c1', vehicule: true, maj: 5,
        lignes: [{ libelle: 'Chaînes', categorie: 'CONSO', ttc: 48.6, taux: 20 },
          { libelle: 'Lime ronde', categorie: 'PETITMAT', ttc: 12.5, taux: 10 }] },
      { id: 's1', date: JA(-60), fournisseur: 'Station', maj: 4,
        lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 80, taux: 20, litres: 50 }] }],
    charges: [{ id: 'g1', libelle: 'Logiciel', beneficiaire: 'Éditeur', ttc: 24, periodicite: 'mensuel', categorie: 'ABO',
      taux: 20, debut: new Date(D1_AN - 1, 0, 1, 12).getTime(), jour: 1, moisReference: 0, dansDepenses: true }]
  }));
  const C = t.w.BCC;
  const autos = t.stock('depenses').filter(d => d.auto);
  verifierVrai('une charge fixe a été prélevée depuis la dépense Brico', autos.some(d => d.date > JA(-40)));
  const avant = JSON.stringify(t.stock('depenses').filter(d => d.id === 'b1')[0]);
  await plusDepense(t);
  /* D4 : la liste des fournisseurs se remplit seule. */
  verifier('le champ Fournisseur propose ceux des dépenses passées', ['Brico', 'Éditeur', 'Station'],
    t.$$('#dp-fours option').map(o => o.value));
  verifier('la liste est branchée sur le champ', 'dp-fours', t.$('#dp-four').getAttribute('list'));
  /* D3. */
  verifier('le bouton nomme la dernière dépense, hors charge fixe', 'Comme la dernière — Brico · Consommable, Petit outillage',
    t.texte('#dp-comme b'));
  verifierVrai('et dit ce qu’il reprend', /reprend le fournisseur et les catégories ; ni la date ni les montants/.test(t.texte('#dp-comme')));
  t.clic('#dp-comme'); await t.pause(200);
  verifier('le fournisseur est repris', 'Brico', t.$('#dp-four').value);
  verifier('deux lignes : leurs catégories', [['Consommable'], ['Petit outillage']], [puceChoisie(t, 0), puceChoisie(t, 1)]);
  verifier('et leurs taux', [['20'], ['10']], [tauxChoisi(t, 0), tauxChoisi(t, 1)]);
  verifier('les montants sont vides', ['', ''], t.$$('#dp-lignes [data-dlttc]').map(i => i.value));
  verifier('les désignations aussi', ['', ''], t.$$('#dp-lignes [data-dl]').map(i => i.value));
  verifier('la date reste celle du jour', jourISO(Date.now()), t.$('#dp-date').value);
  verifier('ni n° de pièce, ni chantier, ni véhicule', ['', '', false], [t.$('#dp-num').value, t.$('#dp-ch').value, t.$('#dp-veh').checked]);
  verifierVrai('le message le dit, au « vous » près',
    new RegExp('^Repris de la dépense du ' + new Date(JA(-40)).toLocaleDateString('fr-FR') +
      ' : fournisseur et catégories\\. La date reste le ' + new Date().toLocaleDateString('fr-FR') + '\\.$').test(insecables(t.texte('#toast'))));
  verifierVrai('le pied attend toujours un montant', /Saisissez au moins un montant/.test(t.texte('#dp-apercu')));
  t.saisir('#dl-ttc-0', '10'); t.saisir('#dl-ttc-1', '22');
  t.clic('#dp-ok'); await t.pause(400);
  const neuve = t.stock('depenses').filter(d => !d.auto && d.id !== 'b1' && d.id !== 's1')[0];
  verifier('la nouvelle : fournisseur, catégories, taux, montants',
    ['Brico', ['CONSO', 20, 10, ''], ['PETITMAT', 10, 22, '']],
    [neuve.fournisseur].concat(neuve.lignes.map(l => [l.categorie, l.taux, l.ttc, l.libelle])));
  verifier('datée du jour', C.jourCle(Date.now()), C.jourCle(neuve.date));
  verifier('sans n° de pièce, sans chantier, sans véhicule', ['', null, null], [neuve.numero, neuve.chantier, neuve.vehicule]);
  verifier('et la dépense d’origine n’a pas bougé', avant, JSON.stringify(t.stock('depenses').filter(d => d.id === 'b1')[0]));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Dépense : « Comme la dernière » après une commande ou une intervention ne reprend aucun lien', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances',
    depenses: [
      { id: 'k9', date: JA(-3), fournisseur: 'Pépinière du Mont', numero: 'K1', commande: 'k1', maj: 5,
        lignes: [{ libelle: 'Fournitures K1', categorie: 'FOURN', ttc: 600, taux: 20 },
          { libelle: 'Livraison', categorie: 'FOURN', ttc: 60, taux: 20 }] }]
  }));
  await plusDepense(t);
  verifier('née d’une commande : elle est « la dernière »', 'Comme la dernière — Pépinière du Mont · Fournitures', t.texte('#dp-comme b'));
  t.clic('#dp-comme'); await t.pause(200);
  verifier('une ligne par nature d’achat : une seule, Fournitures à 20 %', [1, ['Fournitures'], ['20']],
    [t.$$('#dp-lignes .dp-l').length, puceChoisie(t, 0), tauxChoisi(t, 0)]);
  verifier('le n° de la commande n’est pas repris', '', t.$('#dp-num').value);
  t.saisir('#dl-ttc-0', '55'); t.clic('#dp-ok'); await t.pause(400);
  const n1 = t.stock('depenses').filter(d => d.id !== 'k9')[0];
  verifier('la nouvelle ne porte pas le lien de la commande', [false, 'Pépinière du Mont', 55], ['commande' in n1, n1.fournisseur, n1.lignes[0].ttc]);
  /* Née d'une intervention du carnet : pas de fournisseur, un lien vers elle. */
  const etat = t.w.BCUI._etat();
  etat.depenses.push({ id: 'i9', date: JA(1), fournisseur: '', vehicule: 'vi1', maj: 6,
    lignes: [{ libelle: 'Révision', categorie: 'VEHIC', ttc: 360, taux: 20 }] });
  await plusDepense(t);
  verifier('née d’une intervention : le bouton ne nomme que la catégorie', 'Comme la dernière — Frais véhicule', t.texte('#dp-comme b'));
  t.saisir('#dp-four', 'Garage du Pont');
  t.clic('#dp-comme'); await t.pause(200);
  verifier('le fournisseur déjà tapé reste, la ligne est en Frais véhicule', ['Garage du Pont', ['Frais véhicule']], [t.$('#dp-four').value, puceChoisie(t, 0)]);
  verifier('la case du véhicule n’est pas cochée', false, t.$('#dp-veh').checked);
  t.saisir('#dl-ttc-0', '90'); t.clic('#dp-ok'); await t.pause(400);
  const n2 = t.stock('depenses').filter(d => d.fournisseur === 'Garage du Pont')[0];
  verifier('la nouvelle n’est liée à aucune intervention', null, n2.vehicule);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Dépense : un ticket à trois lignes dont une immobilisation, le pied et la liste disent les mêmes chiffres', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  const FIN = t.w.BCF, eur = v => d1Eur(t, v);
  t.w.confirm = () => true;
  await parBarre(t, 'argent'); t.clic('[data-vue="depenses"]'); await t.pause(250);
  t.clic('#dep-nouvelle'); await t.pause(300);
  t.saisir('#dp-four', 'Motoculture du Val');
  await categorieDep(t, 0, 'CONSO'); t.saisir('#dl-ttc-0', '48,60'); t.saisir('#dl-lib-0', 'Chaînes');
  t.clic('#dp-plusligne'); await t.pause(150);
  verifierVrai('« + une autre nature sur ce ticket » ajoute une ligne', t.$$('#dp-lignes .dp-l').length === 2 &&
    /une autre nature sur ce ticket/.test(t.texte('#dp-plusligne')));
  verifier('la première n’a rien perdu', ['48,60', 'Chaînes', ['Consommable']], [t.$('#dl-ttc-0').value, t.$('#dl-lib-0').value, puceChoisie(t, 0)]);
  await categorieDep(t, 1, 'IMMO'); t.saisir('#dl-ttc-1', '960');
  verifierVrai('la mention immobilisation paraît sur sa ligne, pas sur l’autre',
    /Immobilisation — isolée dans la balance de TVA/.test(t.texte('[data-dli="1"]')) && !/isolée dans la balance/.test(t.texte('[data-dli="0"]')));
  t.clic('#dp-plusligne'); await t.pause(150);
  await categorieDep(t, 2, 'REPAS'); t.saisir('#dl-ttc-2', '18,50');
  t.clic('[data-dltx="2"][data-taux="10"]'); await t.pause(100);
  verifier('le montant survit au changement de taux, tel que tapé', '18,50', t.$('#dl-ttc-2').value);
  /* Une quatrième, retirée : les trois autres restent. */
  t.clic('#dp-plusligne'); await t.pause(150);
  t.saisir('#dl-ttc-3', '5');
  verifier('chaque ligne a son ✕ quand il y en a plusieurs', 4, t.$$('#dp-lignes [data-dlsup]').length);
  t.clic('[data-dlsup="3"]'); await t.pause(150);
  verifier('retirer une ligne garde les autres', ['48,60', '960', '18,50'], t.$$('#dp-lignes [data-dlttc]').map(i => i.value));
  /* Le pied, à la main : 48,60 et 960 à 20 %, 18,50 à 10 %.
     HT 40,50 + 800 + 16,82 ; TVA 8,10 + 160 + 1,68. */
  verifier('pied : TTC, HT, TVA déductible, immobilisé', [eur(1027.1), eur(857.32), eur(169.78), eur(800)].map(sansBlancs),
    ['ttc', 'ht', 'tva', 'immo'].map(k => piedDep(t, k)));
  verifierVrai('le TTC est le chiffre en grand, le reste dessous',
    !!t.$('#dp-apercu .mj-tot b[data-dp="ttc"]') && /HT · TVA déductible .* · dont .* immobilisé/.test(t.texte('#dp-apercu small')));
  verifierVrai('le pied est celui de la feuille, avec Enregistrer', !!t.$('.mj-pied #dp-apercu') && !!t.$('.mj-pied #dp-ok') && !t.$('#dp-sup'));
  t.clic('#dp-ok'); await t.pause(400);
  const d = t.stock('depenses')[0];
  verifier('enregistrée : trois lignes', [['CONSO', 48.6, 20, 'Chaînes'], ['IMMO', 960, 20, ''], ['REPAS', 18.5, 10, '']],
    d.lignes.map(l => [l.categorie, l.ttc, l.taux, l.libelle]));
  verifier('le calcul de Sylve donne les mêmes chiffres qu’à la main', [1027.1, 857.32, 169.78], [FIN.ttcDe(d), FIN.htDe(d), FIN.tvaDe(d)]);
  /* La liste et les indicateurs d'Argent ▸ Dépenses. */
  verifier('la ligne de la liste : TTC et TVA', sansBlancs(eur(1027.1) + 'TVA ' + eur(169.78)),
    sansBlancs(t.texte('#liste-depenses [data-depmod="' + d.id + '"] .aj-droite')));
  verifier('les indicateurs : TTC, HT, TVA déductible, nombre', [eur(1027.1), eur(857.32), eur(169.78), '1'].map(sansBlancs),
    t.$$('#dep-totaux .carte2 b').map(b => sansBlancs(b.textContent)));
  /* Rouverte : le même pied. Puis Supprimer, la corbeille, et retour. */
  t.clic('#liste-depenses [data-depmod="' + d.id + '"]'); await t.pause(300);
  verifier('rouverte, le pied redit les mêmes chiffres', [eur(1027.1), eur(857.32), eur(169.78), eur(800)].map(sansBlancs),
    ['ttc', 'ht', 'tva', 'immo'].map(k => piedDep(t, k)));
  verifierVrai('Supprimer est dans le pied, en modification', !!t.$('.mj-pied #dp-sup'));
  t.clic('#dp-sup'); await t.pause(400);
  verifierVrai('supprimée : plus dans les dépenses, la feuille fermée', !t.stock('depenses').length && t.$('#modale').hidden);
  await parMenu(t, 'corbeille');
  const rep = t.$$('#s-recup [data-repecher]').filter(b => /Motoculture du Val/.test(b.closest('.liste-item').textContent))[0];
  verifierVrai('elle est dans la corbeille, à son montant', !!rep && /1 027,10/.test(insecables(rep.closest('.liste-item').textContent).replace(/ /g, ' ')));
  rep.click(); await t.pause(500);
  verifier('restaurée, elle revient identique', JSON.stringify(d), JSON.stringify(t.stock('depenses')[0]));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Dépense : une ancienne dépense rouverte et enregistrée sans rien toucher ressort identique', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances',
    chantiers: [chA('c1', { nom: 'Vaux', statut: 'encours' })],
    depenses: [
      /* Tout ce que la feuille sait porter. */
      { id: 'a1', date: D2_MATIN, fournisseur: 'Station du Col', numero: 'T-4471', chantier: 'c1', vehicule: true, maj: 111,
        lignes: [{ libelle: 'Gasoil', categorie: 'CARB', ttc: 61.37, taux: 20, litres: 35.2 },
          { libelle: 'Bidon d’huile', categorie: 'CONSO', ttc: 14.9, taux: 20 }] },
      /* Née d'une intervention du carnet. */
      { id: 'a2', date: D2_MATIN, fournisseur: '', vehicule: 'vi1', maj: 112,
        lignes: [{ libelle: 'Révision', categorie: 'VEHIC', ttc: 360, taux: 20 }] },
      /* Née d'une commande. */
      { id: 'a3', date: D2_MATIN, fournisseur: 'Pépinière du Mont', numero: 'K1', commande: 'k1', maj: 113,
        lignes: [{ libelle: 'Fournitures K1', categorie: 'FOURN', ttc: 600, taux: 20 },
          { libelle: 'Livraison', categorie: 'FOURN', ttc: 60, taux: 20 }] },
      /* Une TVA relevée sur le ticket, un taux hors des quatre boutons, une
         assurance saisie à 20 %. */
      { id: 'a4', date: D1_J1, fournisseur: 'Coopérative', maj: 114,
        lignes: [{ libelle: 'Ticket de caisse', categorie: 'CONSO', ttc: 100, taux: 20, tva: 16.5 },
          { libelle: 'Livre', categorie: 'ADMIN', ttc: 21, taux: 2.1 },
          { libelle: 'Assurance du matériel', categorie: 'ASSUR', ttc: 48, taux: 20 }] },
      /* Rattachée à un chantier supprimé depuis. */
      { id: 'a5', date: D1_J1, fournisseur: 'Scierie', numero: '', chantier: 'parti', vehicule: null, maj: 115,
        lignes: [{ libelle: 'Piquets', categorie: 'FOURN', ttc: 240, taux: 20 }] },
      /* Le format d'avant les lignes : un montant à plat. */
      { id: 'a6', date: D1_J1, fournisseur: 'Quincaillerie', categorie: 'PETITMAT', ttc: 60, taux: 20, maj: 116 }]
  }));
  const FIN = t.w.BCF;
  const de = id => t.stock('depenses').filter(d => d.id === id)[0];
  await parBarre(t, 'argent'); t.clic('[data-vue="depenses"]'); await t.pause(250);
  const rouvrir = async id => { t.clic('#liste-depenses [data-depmod="' + id + '"]'); await t.pause(300); };
  for (const [id, quoi] of [['a1', 'n° de pièce, chantier, véhicule, désignations, litres, heure de la date'],
    ['a2', 'née d’une intervention : son lien'], ['a3', 'née d’une commande : son lien et son numéro'],
    ['a4', 'TVA du ticket, taux hors boutons, assurance à 20 %'], ['a5', 'chantier supprimé']]) {
    const avant = JSON.stringify(de(id));
    await rouvrir(id);
    verifier(id + ' s’ouvre en modification', 'Modifier la dépense', t.texte('#modale-titre'));
    t.clic('#dp-ok'); await t.pause(400);
    verifier(id + ' — ' + quoi + ' : identique en base', avant, JSON.stringify(de(id)));
  }
  /* Ce que la feuille montre de a1. */
  await rouvrir('a1');
  verifier('a1 à l’écran : n° de pièce, chantier, véhicule', ['T-4471', 'c1', true], [t.$('#dp-num').value, t.$('#dp-ch').value, t.$('#dp-veh').checked]);
  verifier('ses désignations, ses montants, ses litres', [['Gasoil', 'Bidon d’huile'], ['61,37', '14,9'], '35,2'],
    [t.$$('#dp-lignes [data-dl]').map(i => i.value), t.$$('#dp-lignes [data-dlttc]').map(i => i.value), t.$('#dl-l-0').value]);
  /* Un vrai changement ne touche que ce qui est changé, et date la modification. */
  t.saisir('#dl-ttc-1', '15,90');
  t.clic('#dp-ok'); await t.pause(400);
  const a1 = de('a1');
  verifier('a1 modifiée : le montant change, le reste non', [15.9, 'T-4471', 'c1', true, D2_MATIN, 35.2],
    [a1.lignes[1].ttc, a1.numero, a1.chantier, a1.vehicule, a1.date, a1.lignes[0].litres]);
  verifierVrai('et « maj » a bougé', a1.maj !== 111);
  /* La TVA relevée ne vaut que pour son montant : on le change, elle tombe. */
  await rouvrir('a4');
  verifier('a4 à l’écran : le pied suit la TVA du ticket', sansBlancs(d1Eur(t, 16.5 + FIN.tvaLigne({ ttc: 21, taux: 2.1 }) + 8)), piedDep(t, 'tva'));
  t.saisir('#dl-ttc-0', '120');
  t.clic('#dp-ok'); await t.pause(400);
  verifier('a4 : montant changé, la TVA relevée est retirée ; les autres lignes intactes',
    [false, 120, 2.1, 20], ['tva' in de('a4').lignes[0], de('a4').lignes[0].ttc, de('a4').lignes[1].taux, de('a4').lignes[2].taux]);
  /* Le format d'avant passe en lignes, aux mêmes montants. */
  const plat = de('a6');
  await rouvrir('a6');
  t.clic('#dp-ok'); await t.pause(400);
  const a6 = de('a6');
  verifier('a6 : une ligne, mêmes catégorie, montant et taux', [['PETITMAT', 60, 20]], a6.lignes.map(l => [l.categorie, l.ttc, l.taux]));
  verifier('a6 : TTC, HT et TVA inchangés', [FIN.ttcDe(plat), FIN.htDe(plat), FIN.tvaDe(plat)], [FIN.ttcDe(a6), FIN.htDe(a6), FIN.tvaDe(a6)]);
  verifier('a6 : fournisseur et date gardés, plus de montant à plat', ['Quincaillerie', D1_J1, false], [a6.fournisseur, a6.date, 'ttc' in a6]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Dépense : la frappe ne refait aucun champ, le clavier reste ouvert', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  await plusDepense(t);
  await categorieDep(t, 0, 'CARB');
  t.clic('#dp-plusligne'); await t.pause(150);
  await categorieDep(t, 1, 'VEHIC');
  t.clic('#dp-plusligne'); await t.pause(150);
  t.saisir('#dl-ttc-1', '100');
  verifierVrai('la ligne Frais véhicule offre le carnet', !t.$('#dp-carnet').hidden);
  cocher(t, '#dp-hist', true); await t.pause(100);
  const SEL = ['#dl-ttc-0', '#dl-l-0', '#dl-lib-0', '#dl-ttc-1', '#dl-lib-1', '#dl-ttc-2', '#dl-lib-2', '#dp-four', '#dp-num', '#dp-km'];
  const avant = SEL.map(s => t.$(s));
  verifierVrai('trois lignes ouvertes, et le kilométrage', avant.every(Boolean) && !t.$('#dp-histkm').hidden);
  const taper = (n, v) => {
    n.focus(); n.value = v;
    n.dispatchEvent(new t.w.Event('input', { bubbles: true }));
    /* Ce qui part quand le doigt passe au champ suivant. */
    n.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  };
  const gardes = [];
  avant.forEach((n, i) => {
    taper(n, ['80', '50', 'gazole', '360', 'Plaquettes', '12,50', 'Vis', 'Garage', 'F-12', '231415'][i]);
    gardes.push(t.$(SEL[i]) === n && t.d.activeElement === n);
  });
  verifier('chaque champ reste le même, et garde le doigt', SEL.map(() => true), gardes);
  verifierVrai('le pied a suivi la frappe', piedDep(t, 'ttc') === sansBlancs(d1Eur(t, 452.5)));
  verifierVrai('le prix du litre aussi, sur place', /1,600 € le litre/.test(insecables(t.texte('[data-dlprix="0"]'))));
  /* Changer la catégorie ou le taux d'une ligne ne refait qu'elle. */
  await categorieDep(t, 2, 'EPI');
  verifier('changer la catégorie de la 3e ligne ne refait pas les deux autres', [true, true, true, true, true, false],
    ['#dl-ttc-0', '#dl-l-0', '#dl-lib-0', '#dl-ttc-1', '#dl-lib-1', '#dl-ttc-2'].map(s => t.$(s) === avant[SEL.indexOf(s)]));
  verifier('et la 3e garde ce qui était tapé, tel quel', ['12,50', 'Vis'], [t.$('#dl-ttc-2').value, t.$('#dl-lib-2').value]);
  t.clic('[data-dltx="1"][data-taux="10"]'); await t.pause(100);
  verifier('changer le taux de la 2e ne refait pas la 1re', [true, true, true], ['#dl-ttc-0', '#dl-l-0', '#dl-lib-0'].map(s => t.$(s) === avant[SEL.indexOf(s)]));
  verifier('ni les champs du bas', [true, true, true], ['#dp-four', '#dp-num', '#dp-km'].map(s => t.$(s) === avant[SEL.indexOf(s)]));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Année : le simulateur est un essai, « Garder ce taux » écrit le réglage', async () => {
  const t = await ouvrir(Object.assign(grainesD1(), { cfg: { tauxCotisations: 25, tauxImpot: 2 } }));
  const FIN = t.w.BCF, eur = v => d1Eur(t, v);
  const bA = FIN.bornes('annee', D1_AN, 0);
  const carreau = nom => sansBlancs((t.$$('#sim-carte .kpi .carte2').filter(c => c.querySelector('small').textContent === nom)[0] || { querySelector: () => ({ textContent: '' }) })
    .querySelector('b').textContent);
  const annee = async () => { await parBarre(t, 'argent'); t.clic('[data-vue="analyses"]'); await t.pause(250); t.clic('[data-ana="ensemble"]'); await t.pause(200); };
  const attendu = cfg => FIN.simulation(t.stock('chantiers'), bA, cfg);
  await annee();
  verifier('le simulateur part des réglages', ['25', '2', 'abattu'], [t.$('#sim-cot').value, t.$('#sim-imp').value, t.$('#sim-base').value]);
  verifierVrai('sans essai, aucune ligne d’essai', !t.$('#sim-essais'));
  /* La base à la main : 2 774,70 de prestation à 50 %, 85 de vente à 71 %. */
  verifier('la base après abattement, à la main', 1412, attendu({ tauxCotisations: 25 }).baseCotisations);
  verifier('cotisations aux réglages : 25 % de 1 412', sansBlancs(eur(353)), carreau('cotisations'));
  /* Un taux tapé ne sert qu'au simulateur. */
  t.choisir('#sim-cot', '30'); await t.pause(200);
  verifier('rien n’est écrit dans les réglages', [25, 2], [t.stock('cfg').tauxCotisations, t.stock('cfg').tauxImpot]);
  verifier('ni dans l’état de l’application', 25, t.w.BCUI._etat().cfg.tauxCotisations);
  verifier('le simulateur calcule avec le taux essayé : 30 % de 1 412', sansBlancs(eur(423.6)), carreau('cotisations'));
  verifier('le champ garde le taux essayé', '30', t.$('#sim-cot').value);
  verifier('une ligne le dit', 'CotisationsEssai : 30 % · vos réglages : 25 %', insecables(t.texte('[data-simessai="cot"] span')));
  verifier('avec son bouton', 'Garder ce taux', t.texte('[data-simgarder="cot"]'));
  verifierVrai('seul le taux essayé a sa ligne', t.$$('[data-simessai]').length === 1);
  /* La période choisie en haut ne défait pas l'essai : c'est le même écran. */
  t.choisir('#an-type', 'trimestre'); await t.pause(200);
  verifier('changer de période garde l’essai', '30', t.$('#sim-cot').value);
  t.choisir('#an-type', 'annee'); await t.pause(200);
  /* Déclarations et Réglages ▸ Financier n'ont rien vu. */
  t.clic('[data-ana="declarations"]'); await t.pause(200);
  verifier('Déclarations garde le taux des réglages', '25', t.$('#decl-cot').value);
  verifierVrai('et calcule avec lui', sansBlancs(t.texte('#ana-corps')).indexOf(sansBlancs(eur(353))) >= 0 &&
    sansBlancs(t.texte('#ana-corps')).indexOf(sansBlancs(eur(423.6))) < 0);
  t.clic('[data-ana="ensemble"]'); await t.pause(200);
  verifier('revenu de Déclarations, le simulateur repart des réglages', ['25', null], [t.$('#sim-cot').value, t.$('#sim-essais')]);
  t.choisir('#sim-cot', '30'); await t.pause(200);
  await parMenu(t, 'reglages');
  verifier('Réglages ▸ Financier garde 25', '25', String(t.$('#r-cot').value));
  await annee();
  verifier('en quittant l’écran, l’essai s’efface', ['25', null], [t.$('#sim-cot').value, t.$('#sim-essais')]);
  /* « Garder ce taux » est le seul geste qui écrit. */
  t.choisir('#sim-cot', '30'); await t.pause(200);
  t.choisir('#sim-imp', '5'); await t.pause(200);
  verifier('deux essais, deux lignes', ['cot', 'imp'], t.$$('[data-simessai]').map(e => e.dataset.simessai));
  t.clic('[data-simgarder="cot"]'); await t.pause(300);
  verifier('« Garder ce taux » écrit ce taux, et lui seul', [30, 2], [t.stock('cfg').tauxCotisations, t.stock('cfg').tauxImpot]);
  verifierVrai('et le confirme au « vous »', /^C’est gardé : vos réglages disent maintenant 30 % de cotisations\.$/.test(insecables(t.texte('#toast'))));
  verifier('l’autre essai reste un essai', ['imp'], t.$$('[data-simessai]').map(e => e.dataset.simessai));
  verifier('qui dit', 'ImpôtEssai : 5 % · vos réglages : 2 %', insecables(t.texte('[data-simessai="imp"] span')));
  /* « Appliqués sur » est un essai, lui aussi. */
  t.choisir('#sim-base', 'brut'); await t.pause(200);
  verifier('la base essayée n’est pas écrite', undefined, t.stock('cfg').baseCotisations);
  verifier('cotisations sur le brut : 30 % de 2 859,70', sansBlancs(eur(857.91)), carreau('cotisations'));
  verifier('sa ligne, son bouton', ['Appliqués surEssai : le chiffre d’affaires brut · vos réglages : le montant après abattement', 'Garder ce choix'],
    [t.texte('[data-simessai="base"] span'), t.texte('[data-simgarder="base"]')]);
  t.choisir('#sim-base', 'abattu'); await t.pause(200);
  /* Déclarations et Réglages reprennent le taux gardé. */
  t.clic('[data-ana="declarations"]'); await t.pause(200);
  verifier('Déclarations reprend le taux gardé', '30', t.$('#decl-cot').value);
  verifierVrai('et calcule avec lui', sansBlancs(t.texte('#ana-corps')).indexOf(sansBlancs(eur(423.6))) >= 0);
  await parMenu(t, 'reglages');
  verifier('Réglages ▸ Financier aussi', ['30', '2'], [String(t.$('#r-cot').value), String(t.$('#r-imp').value)]);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Argent ▸ Mois : le débours ne compte plus dans les barres, dans Mois comme dans Année', async () => {
  /* 2 000 € de prestation et 300 € de débours, facturés et payés ce mois-ci :
     la barre vaut 2 000 €, comme le grand chiffre. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [chA('c1', { nom: 'Vaux', donneur: 'Cabinet Sylva', statut: 'paye', dateFacture: D1_J1, datePaiement: D1_J1,
      lignes: [d1Ligne('DEGAG', 1, 2000, 'prestation', 20), d1Ligne('PROTEC', 1, 300, 'debours', 20)] })]
  }));
  const FIN = t.w.BCF, C = t.w.BCC, eur = v => d1Eur(t, v);
  const bM = FIN.bornes('mois', D1_AN, D1_MO);
  const duMois = new RegExp('^' + D1_MOIS[D1_MO] + ' : ', 'i');
  const titres = zone => t.$$(zone + ' rect title').map(x => x.textContent).filter(x => duMois.test(x)).map(sansBlancs);
  const dit = v => sansBlancs(D1_MOIS[D1_MO] + ' : ' + eur(v)).toLowerCase();
  verifier('les données portent bien le débours', [2000, 300], [FIN.chiffreAffaires(t.stock('chantiers'), bM).total, FIN.chiffreAffaires(t.stock('chantiers'), bM).debours]);
  verifier('ce que le mois a facturé, débours compris : 2 300', 2300, FIN.lignesFacturees(t.stock('chantiers'), bM).reduce((s, x) => s + x.ht, 0));
  await parBarre(t, 'argent');
  verifier('Mois : le grand chiffre, hors débours', sansBlancs(eur(2000)), d1Mo(t, 'ca'));
  verifier('Mois : la barre du mois vaut le grand chiffre', [dit(2000)], titres('#mo-histo').map(x => x.toLowerCase()));
  verifier('Mois : le total à fin de mois est la somme des barres', sansBlancs(eur(2000)), d1Mo(t, 'cumul'));
  verifierVrai('Mois : la ligne MSA n’a pas bougé', sansBlancs(t.texte('#mo-msa')).indexOf(sansBlancs('total ' + eur(2000))) >= 0);
  verifierVrai('Mois : le débours reste dit à part', /Hors débours \(300 €\)/.test(insecables(t.texte('#mo-ca'))));
  /* La TVA, elle, porte toujours sur tout ce qui est facturé. */
  verifier('la TVA facturée n’a pas bougé : 20 % de 2 300', 460, FIN.balanceTva(t.stock('chantiers'), [], bM, C.tauxLigne).collectee.total);
  verifier('et l’écran la donne', sansBlancs(eur(460)), d1Tva(t, '#mo-tva', 'facturee'));
  /* Année ▸ Vue d'ensemble. */
  t.clic('[data-vue="analyses"]'); await t.pause(250); t.clic('[data-ana="ensemble"]'); await t.pause(200);
  verifier('Année ▸ Vue d’ensemble : la barre « facturé HT »', [dit(2000)], titres('#ana-corps').map(x => x.toLowerCase()));
  verifierVrai('et « Plus haut mois »', sansBlancs(t.texte('#ana-corps')).indexOf(sansBlancs('Plus haut mois : ' + eur(2000))) >= 0);
  /* Année ▸ Recettes : facturé et encaissé, hors débours tous les deux. */
  t.clic('[data-ana="recettes"]'); await t.pause(200);
  verifier('Année ▸ Recettes : les barres « facturé » et « encaissé »', [dit(2000), dit(2000)], titres('#ana-corps').map(x => x.toLowerCase()));
  verifier('qui valent leurs carreaux', [eur(2000), eur(2000)].map(sansBlancs),
    t.$$('#ana-corps .kpi .carte2 b').slice(0, 2).map(b => sansBlancs(b.textContent)));
  verifierVrai('le débours y reste dit à part', /Débours client — hors chiffre d’affaires\s*300 €/.test(insecables(t.texte('#ana-corps'))));
  /* Déclarations : inchangée. */
  t.clic('[data-ana="declarations"]'); await t.pause(200);
  verifierVrai('Déclarations : à déclarer 2 000 €, le débours écarté',
    sansBlancs(t.texte('#ana-corps')).indexOf(sansBlancs('À déclarer' + eur(2000))) >= 0 && /Le débours \(300 €\) est déjà écarté/.test(insecables(t.texte('#ana-corps'))));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
/* Un troisième argument ne joue que les scénarios dont le nom le contient.
   Sert à éprouver un contrôle en le cassant exprès : rejouer les quarante
   autres pour vérifier qu'un seul crie coûte deux minutes pour rien.
   node outils/tests.js index.html "double compte"

   Chaque scénario ouvre sa propre application et ne partage rien avec les
   autres : on les répartit donc entre plusieurs processus Node, un scénario
   à la fois par processus, dans l'ordre d'origine. Le processus principal ne
   joue rien : il distribue, regroupe les sorties dans l'ordre d'origine et
   refuse de conclure au vert si un scénario s'est perdu en route ou si un
   processus est mort. Avec un seul scénario (un filtre précis) ou avec
   --sequentiel, tout se joue ici, comme avant. */
const OPTIONS_CONNUES = ['--sequentiel', '--durees', '--ouvrier'];

/* Joue un scénario et rend ce qu'il a donné. Dans un processus ouvrier la
   sortie est mise de côté : le processus principal la réimprime dans l'ordre
   d'origine, sans la mêler à celle des autres. */
async function jouer(s, mettreDeCote) {
  const lignes = [];
  const imprimer = console.log;
  if (mettreDeCote) console.log = (...a) => lignes.push(util.format(...a));
  mesure = { pause: 0, pauses: 0, jsdom: 0, pret: 0, ouvertures: 0 };
  const ok0 = ok, ko0 = ko, debut = performance.now();
  try { await s.fn(); }
  catch (e) { ko++; console.log('    ✕ le scénario s\'est interrompu : ' + e.message); }  console.log = imprimer;
  return Object.assign({ nom: s.nom, lignes, ok: ok - ok0, ko: ko - ko0,
    duree: performance.now() - debut }, mesure);
}

function montrer(r) {
  console.log('\n  ' + r.nom);
  r.lignes.forEach(l => console.log(l));
}

/* Processus ouvrier : attend qu'on lui désigne un scénario par son rang dans
   la liste complète, le joue, rend son résultat. S'il perd son processus
   principal il s'arrête, pour ne pas rester orphelin. */
function etreOuvrier() {
  process.on('disconnect', () => process.exit(1));
  process.on('message', async m => {
    if (m.type === 'fin') process.exit(0);
    if (m.type !== 'jouer') return;
    const r = await jouer(scenarios[m.rang], true);
    r.rang = m.rang;
    process.send({ type: 'resultat', r });
  });
  process.send({ type: 'pret', total: scenarios.length });
}

/* Répartit `rangs` entre `n` processus, un scénario à la fois et le suivant
   à celui qui se libère (les scénarios ne durent pas tous pareil). Rend les
   résultats rangés comme `rangs`, avec un trou là où rien n'est revenu, et
   la liste des anomalies du banc lui-même. */
function enParallele(rangs, n) {
  return new Promise(resolve => {
    const resultats = new Array(rangs.length);
    const anomalies = [];
    let suivant = 0, affiche = 0, vivants = n, fini = false;
    /* Affiche, dans l'ordre d'origine, tout ce qui est déjà revenu. */
    const vider = () => {
      while (affiche < rangs.length && resultats[affiche]) montrer(resultats[affiche++]);
    };
    const terminer = () => {
      if (fini) return;
      fini = true;
      for (; affiche < rangs.length; affiche++) {
        if (resultats[affiche]) { montrer(resultats[affiche]); continue; }
        const nom = scenarios[rangs[affiche]].nom;
        console.log('\n  ' + nom + '\n    ✕ ce scénario n\'a pas été joué jusqu\'au bout');
        anomalies.push('scénario perdu en route : « ' + nom + ' »');
      }
      resolve({ resultats, anomalies });
    };
    const donnerDuTravail = o => {
      if (suivant < rangs.length) {
        o.encours = suivant;
        o.send({ type: 'jouer', rang: rangs[suivant++] });
      } else {
        o.encours = null;
        o.congedie = true;
        o.send({ type: 'fin' });
      }
    };
    const sortir = o => {
      if (o.sorti) return;
      o.sorti = true;
      if (--vivants === 0) terminer();
    };
    for (let i = 0; i < n; i++) {
      const o = fork(__filename, [APP, '--ouvrier'], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
      o.encours = null; o.congedie = false; o.sorti = false;
      o.on('message', m => {
        if (m.type === 'pret') {
          if (m.total !== scenarios.length) {
            anomalies.push('un processus connaît ' + m.total + ' scénarios, le principal en connaît ' + scenarios.length);
          }
          donnerDuTravail(o);
        } else if (m.type === 'resultat') {
          const k = o.encours;
          if (k === null || m.r.rang !== rangs[k] || m.r.nom !== scenarios[rangs[k]].nom || resultats[k]) {
            anomalies.push('un résultat est revenu qui ne correspond à aucun scénario en cours : « ' + m.r.nom + ' »');
          } else {
            resultats[k] = m.r;
          }
          o.encours = null;
          vider();
          donnerDuTravail(o);
        } else {
          anomalies.push('message inconnu d\'un processus : ' + JSON.stringify(m));
        }
      });
      o.on('error', e => { anomalies.push('un processus n\'a pas pu démarrer ou répondre : ' + e.message); sortir(o); });
      /* Une sortie qu'on n'a pas demandée est un plantage, même avec le code
         0 : sans cette garde, un processus tombé laisserait le contrôle
         conclure « 0 échec » sur ce qu'il avait déjà rendu. */
      o.on('exit', (code, signal) => {
        if (!o.congedie || code !== 0) {
          anomalies.push('un processus s\'est arrêté (code ' + code + (signal ? ', signal ' + signal : '') + ')' +
            (o.encours !== null ? ' pendant « ' + scenarios[rangs[o.encours]].nom + ' »' : ''));
        }
        sortir(o);
      });
    }
  });
}

const sec = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

/* Où le temps est passé. Les durées par scénario sont celles du passage
   séquentiel quand on le demande : en parallèle elles s'allongent un peu, les
   processus se disputant les cœurs. */
function afficherDurees(resultats, mur) {
  const somme = c => resultats.reduce((a, r) => a + r[c], 0);
  const total = somme('duree');
  const part = ms => (total ? Math.round(100 * ms / total) : 0) + ' %';
  const ouvertures = somme('jsdom') + somme('pret');
  const autre = total - somme('pause') - ouvertures;
  console.log('\n' + '─'.repeat(52) + '\nDurées');
  console.log('  Temps cumulé des scénarios : ' + sec(total) + '  (durée réelle du passage : ' + sec(mur) + ')');
  console.log('  Pauses (t.pause) : ' + sec(somme('pause')) + ' · ' + part(somme('pause')) +
    ' · ' + somme('pauses') + ' appels');
  console.log('  Ouvertures de l\'application : ' + sec(ouvertures) + ' · ' + part(ouvertures) +
    ' · ' + somme('ouvertures') + ' ouvertures');
  console.log('      construction de JSDOM et exécution des scripts : ' + sec(somme('jsdom')));
  console.log('      attente de data-pret : ' + sec(somme('pret')));
  console.log('  Le reste (clics, relectures, calculs) : ' + sec(autre) + ' · ' + part(autre));
  console.log('\n  Les 15 scénarios les plus longs :');
  resultats.slice().sort((a, b) => b.duree - a.duree).slice(0, 15).forEach(r => {
    console.log('    ' + sec(r.duree).padStart(7) + '  ' + r.nom + '   [pauses ' + sec(r.pause) +
      ' · ' + r.ouvertures + ' ouverture(s) ' + sec(r.jsdom + r.pret) + ']');
  });
}

(async () => {
  const inconnues = DRAPEAUX.filter(a => OPTIONS_CONNUES.indexOf(a) < 0 && !/^--processus=\d+$/.test(a) &&
    !/^--motif=./.test(a));
  if (inconnues.length) {
    console.log('✕ option inconnue : ' + inconnues.join(' ') + ' (connues : --sequentiel, --processus=N, --durees, --motif=RE).');
    process.exit(1);
  }
  if (DRAPEAUX.indexOf('--ouvrier') >= 0) return etreOuvrier();

  const debut = performance.now();
  const filtre = FILTRE.toLowerCase();
  const rangs = [];
  const m = DRAPEAUX.map(a => /^--motif=(.+)$/.exec(a)).filter(Boolean)[0];
  const motif = m ? new RegExp(m[1], 'i') : null;
  scenarios.forEach((s, i) => {
    if ((!filtre || s.nom.toLowerCase().includes(filtre)) && (!motif || motif.test(s.nom))) rangs.push(i);
  });
  console.log('Sylve — tests de non-régression' +
    (filtre || motif ? ` — filtre « ${FILTRE || m[1]} » : ${rangs.length} scénario(s)` : '') +
    (DATE_FIGEE ? ' — date figée au ' + new Date().toLocaleDateString('fr-FR') : '') +
    '\n' + '─'.repeat(52));
  if ((filtre || motif) && !rangs.length) {
    console.log('✕ aucun scénario ne correspond à « ' + (FILTRE || m[1]) + ' ».');
    process.exit(1);
  }

  let demande = 0;
  DRAPEAUX.forEach(a => { const m = /^--processus=(\d+)$/.exec(a); if (m) demande = +m[1]; });
  if (!demande) demande = +process.env.SYLVE_PROCESSUS || 0;
  if (!demande) demande = (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1;
  const processus = DRAPEAUX.indexOf('--sequentiel') >= 0 ? 1 : Math.max(1, Math.min(demande, rangs.length));

  let resultats, anomalies = [];
  if (processus === 1) {
    resultats = [];
    for (const rang of rangs) {
      console.log('\n  ' + scenarios[rang].nom);
      resultats.push(await jouer(scenarios[rang], false));
    }
  } else {
    const rendu = await enParallele(rangs, processus);
    resultats = rendu.resultats.filter(Boolean);
    anomalies = rendu.anomalies;
  }
  /* Le compte se fait sur ce qui est revenu, pas sur ce qu'on avait prévu :
     un scénario perdu ne doit pas pouvoir passer pour un scénario réussi. */
  if (resultats.length !== rangs.length) {
    anomalies.push(resultats.length + ' scénario(s) joué(s) sur ' + rangs.length + ' prévus');
  }
  const okTotal = resultats.reduce((a, r) => a + r.ok, 0);
  const koTotal = resultats.reduce((a, r) => a + r.ko, 0);

  if (DRAPEAUX.indexOf('--durees') >= 0) afficherDurees(resultats, performance.now() - debut);
  console.log('\n' + '─'.repeat(52));
  console.log(resultats.length + ' scénario(s) sur ' + rangs.length + ' · ' +
    (processus === 1 ? 'séquentiel' : processus + ' processus') + ' · ' + sec(performance.now() - debut));
  anomalies.forEach(a => console.log('✕ ' + a));
  if (koTotal) console.log(`✕ ${koTotal} vérification(s) en échec sur ${okTotal + koTotal}.`);
  else if (anomalies.length) console.log('✕ le banc n\'a pas pu jouer toute la suite (' + okTotal + ' vérifications vertes avant cela).');
  else console.log(`✓ ${okTotal} vérifications, tout passe.`);
  process.exit(koTotal || anomalies.length ? 1 : 0);
})();
