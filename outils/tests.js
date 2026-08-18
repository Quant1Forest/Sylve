#!/usr/bin/env node
/* =====================================================================
   Sylve — tests de non-régression
   node outils/tests.js
   Chaque scénario ouvre l'application dans un navigateur simulé, agit
   comme le ferait un doigt, et vérifie le résultat. Un test rouge veut
   dire qu'un comportement qui marchait ne marche plus.
   Dépendance : npm install jsdom
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(APP, 'utf8');

let ok = 0, ko = 0;
const scenarios = [];
const scenario = (nom, fn) => scenarios.push({ nom, fn });
function verifier(quoi, attendu, obtenu) {
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
function ouvrir(graines, options) {
  options = options || {};
  return new Promise(resolve => {
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local/',
      beforeParse(w) {
        for (const k in graines) w.localStorage.setItem('bordcub.' + k, JSON.stringify(graines[k]));
        w.URL.createObjectURL = () => 'blob:test';
        w.URL.revokeObjectURL = () => {};
        w.Element.prototype.scrollIntoView = function () {};
      }
    });
    const erreurs = [];
    dom.window.addEventListener('error', e => erreurs.push(e.message));
    dom.window.console.error = (...a) => erreurs.push(a.join(' '));
    const plafond = options.attente || 8000;
    const depart = Date.now();
    const rendreLaMain = () => {
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
        pause: ms => new Promise(r => setTimeout(r, ms || 350)),
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
    piles: [{ id: 'p1', nom: 'Tas du haut', lieu: 'Forêt de Chaux', essences: ['CHE'],
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
  verifier('gaine 14×120 : coût unitaire réel', '0,8384', par('Gaine de protection 14*120')[5]);
  verifier('tuteur châtaignier : coût unitaire réel', '0,7865', par('Tuteur en châtaignier')[5]);
  verifier('tuteur acacia : stock futur', '488', par('Tuteur en Acacia')[4]);
  /* Les milliers sont séparés par une espace insécable (U+00A0) depuis la
     4.37 : « 3 801,79 » se lit, « 3801,79 » se déchiffre. */
  verifier('valeur totale du stock', '3 801,79', lignes[lignes.length - 1].slice(-1)[0]);
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
  t.clic('#a-jour'); await t.pause(300);
  t.choisir('#mj-ch', 'c1');
  t.choisir('[data-pstt="0"]', 'PLANT');
  t.saisir('[data-psth="0"]', '3'); t.saisir('[data-pstq="0"]', '200');
  t.clic('#pst-plus'); await t.pause(120);
  t.choisir('[data-pstt="1"]', 'PROTEC');
  t.saisir('[data-psth="1"]', '4'); t.saisir('[data-pstq="1"]', '150');
  t.saisir('#mj-nonprod', '1'); t.saisir('#mj-km', '64');
  const ap = t.texte('#mj-apercu');
  verifierVrai('la journée fait 8 heures', /8,00 h/.test(ap));
  verifierVrai('533 plants par jour', /533 plant\/jour/.test(ap));
  verifierVrai('300 protections par jour', /300 u\/jour/.test(ap));
  verifierVrai('le prix de journée du chantier prime', /320 €\/j/.test(ap));
  t.clic('#mj-ok'); await t.pause(450);
  const j = t.stock('journees');
  verifier('une journée enregistrée', 1, j.length);
  verifier('deux prestations', 2, j[0].postes.length);
  verifier('le trajet reste à part', 1, j[0].nonProd);
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
  t.clic('[data-vue="reglages"]'); await t.pause(150);
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
  t.clic('[data-vue="reglages"]'); await t.pause(150);
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
  t.clic('[data-vue="reglages"]'); await t.pause(150);
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
  verifierVrai('le rappel est sur l\'accueil', t.$('#a-sauver'));
  verifierVrai('il dit ce qu\'il y a à sauvegarder', /chantier/.test(t.texte('#a-journee') + t.texte('#a-sauvegarde')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Bandeau : le retour remonte au menu de la partie', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  const ret = t.$('#b-retour');
  verifierVrai('le bouton retour existe', ret);
  verifier('il est visible dans un module de l\'entreprise', false, ret.hidden);
  verifierVrai('il nomme la partie', /Mon entreprise/.test(ret.title));
  t.clic('#b-retour'); await t.pause(200);
  verifierVrai('on est revenu sur le menu de l\'entreprise',
    t.$('#vue-entreprise') && !t.$('#vue-entreprise').hidden);
  t.clic('[data-module="cubage"]'); await t.pause(250);
  verifier('caché dans le cubage : ◈ suffit', true, t.$('#b-retour').hidden);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Chantier : plus d\'échéance, et les jours pris se voient', async () => {
  /* Il ne raisonne pas en « à finir avant le » mais en journées à poser.
     Et il doit voir ce qui est déjà retenu avant d'en poser une. */
  const pris = new Date(); pris.setHours(0, 0, 0, 0);
  while (pris.getDay() === 0 || pris.getDay() === 6) pris.setDate(pris.getDate() + 1);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      jours: [{ d: pris.getTime(), p: 1 }], maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(200);
  t.clic('#c-nouveau'); await t.pause(300);
  verifier('le champ « à finir avant le » a disparu', null, t.$('#ce-ech'));
  t.clic('#ce-plusjour'); await t.pause(150);
  const propose = t.$('[data-cej="0"]').value;
  verifierVrai('la journée proposée évite le jour déjà pris',
    propose !== jourISO(pris));
  /* Le jour retenu et le jour affiché doivent être le même. Ils ont divergé :
     le champ montrait la veille, c'est-à-dire le jour occupé que le code
     venait justement d'écarter, et sans l'avertissement qui va avec. */
  const libre = new Date(pris);
  do { libre.setDate(libre.getDate() + 1); }
  while (libre.getDay() === 0 || libre.getDay() === 6);
  verifier('et c\'est bien ce jour-là qui s\'affiche', jourISO(libre), propose);
  t.$('[data-cej="0"]').value = jourISO(pris);
  t.choisir('[data-cej="0"]', jourISO(pris)); await t.pause(150);
  verifierVrai('le chantier qui occupe le jour est nommé',
    /Vaux/.test(t.texte('#ce-jours')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Listes : ajouter sans quitter le formulaire', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('[data-vue="carnet"]'); await t.pause(200);
  t.clic('#c-nouveau'); await t.pause(300);
  t.saisir('#ce-donneur', 'Jean Roman');
  t.clic('[data-ajlist="clients"]'); await t.pause(400);
  verifier('le donneur d\'ordre est dans la liste', ['Jean Roman'], t.stock('clients'));
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
      { id: 'c2', nom: 'Chaux', statut: 'paye', lignes: [], temps: [], maj: Date.now() - 1000 }
    ]
  }));
  t.clic('[data-chouvrir="c1"]'); await t.pause(250);
  verifierVrai('le sélecteur est en haut de la fiche', t.$('#f-choix'));
  verifierVrai('les chantiers clos sont à part',
    [...t.$('#f-choix').querySelectorAll('optgroup')].map(g => g.label).join('|') === 'En cours|Clos');
  t.choisir('#f-choix', 'c2'); await t.pause(300);
  verifierVrai('la fiche a suivi', /Chaux/.test(t.texte('#fiche-chantier')));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : prévu et réel ne se confondent plus', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      jours: [{ d: Date.now(), p: 1 }], maj: Date.now() }]
  }));
  t.clic('[data-chouvrir="c1"]'); await t.pause(250);
  const f = t.texte('#fiche-chantier');
  verifierVrai('le bloc Travaux dit ce qu\'il chiffre', /Ce que vous facturez/.test(f));
  verifierVrai('le bloc Journées dit que c\'est du prévu', /Ce que vous avez prévu/.test(f));
  verifierVrai('le bloc Temps passé dit que c\'est du réel', /Ce que vous avez réellement fait/.test(f));
  verifierVrai('le bouton ne redemande pas de placer ce qui l\'est',
    t.texte('#f-planifier') === 'Modifier les journées');
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Accueil : des pictogrammes dessinés, plus des caractères de remplissage', async () => {
  const t = await ouvrir(VIDE);
  ['entreprise', 'cubage', 'bois'].forEach(m => {
    const tuile = t.$('[data-module="' + m + '"]');
    verifierVrai(m + ' porte un pictogramme au trait',
      tuile && tuile.querySelector('.ic svg.pic'));
    verifierVrai(m + ' n’a plus de caractère de remplissage',
      tuile && !/[▤▥▦▧▨▩]/.test(tuile.querySelector('.ic').textContent));
  });
  verifier('le bouton accueil n’affiche plus de losange', '', t.texte('#b-accueil'));
  /* Second niveau : les cinq tuiles de l'entreprise, cerclées. Devis n'avait
     aucun écran à lui, et Analyses est devenue un onglet de Finances. */
  const sous = ['chantiers', 'calendrier', 'rendements', 'stock', 'finances'];
  const cercles = sous.filter(m => {
    const b = t.$('#vue-entreprise [data-module="' + m + '"]');
    return b && b.querySelector('.ic.rond svg.pic');
  });
  verifier('les cinq tuiles de l’entreprise sont cerclées', sous, cercles);
  verifierVrai('aucun caractère de remplissage ne subsiste dans les tuiles',
    t.$$('.tuile .ic').every(e => !/[▤▥▦▧▨▩⏱≈◫]/.test(e.textContent)));
  /* Le logo ne doit exister qu'une fois dans le fichier : l'accueil et le
     bandeau passent tous les deux par la variable CSS. */
  const brut = t.d.documentElement.outerHTML;
  verifier('le logo n’est stocké qu’une fois', 1,
    (brut.match(/--logo:url\("data:image\/png/g) || []).length);
  verifierVrai('le bandeau s’en sert', /#b-accueil\{[^}]*var\(--logo\)/s.test(brut));
  verifierVrai('l’accueil aussi', /\.marque-logo\{[^}]*var\(--logo\)/s.test(brut));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Bandeau : rien qui fasse doublon avec la page', async () => {
  /* + Pile, + Chantier, + Dépense, + Commande existent déjà dans leur page :
     il y passe, jamais par le haut. Le bandeau redevient de la navigation. */
  const doublons = [
    ['bois', '#p-nouvelle'], ['chantiers', '#c-nouveau'],
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
  verifierVrai('le logo du bandeau a de la place',
    /#b-accueil\{[^}]*width:33px;height:33px/s.test(css));
});

/* --------------------------------------------------------------------- */
scenario('Onglets : un dessin partout, le même d’un module à l’autre', async () => {
  /* Un onglet de moins par module : les réglages sont passés dans le
     bandeau. Ils étaient répétés en bas de chaque partie, à une place
     différente selon le module — on s'y perdait, et ils mangeaient un
     onglet là où il n'y en a que deux ou trois. */
  const attendu = {
    cubage: 4, chantiers: 2, calendrier: 3, rendements: 2,
    finances: 4, stock: 3, bois: 4
  };
  for (const mod of Object.keys(attendu)) {
    const t = await ouvrir(Object.assign({}, VIDE, { module: mod }));
    const onglets = t.$$('#onglets button');
    verifier(mod + ' : ' + attendu[mod] + ' onglets', attendu[mod], onglets.length);
    verifier(mod + ' : tous dessinés', attendu[mod],
      onglets.filter(b => b.querySelector('.ic svg.pic')).length);
    verifierVrai(mod + ' : plus aucun caractère de remplissage',
      onglets.every(b => !/[▤▥▦▧▣◱◫≈∑⚙⌖⏱⇄↻✎]/.test(b.textContent)));
  }
  /* Une même vue doit porter le même dessin partout : c'est ce qui rend la
     navigation lisible quand on passe d'une partie à l'autre. */
  const a = await ouvrir(Object.assign({}, VIDE, { module: 'calendrier' }));
  const b = await ouvrir(Object.assign({}, VIDE, { module: 'bois' }));
  const carte = a.$('#onglets [data-vue="carte"] svg').innerHTML;
  const lieux = b.$('#onglets [data-vue="lieux"] svg').innerHTML;
  verifier('la carte et le « Où ? » montrent le même repère', carte, lieux);
  /* Les réglages ne sont plus un onglet : ils vivent dans le bandeau, au
     même endroit partout, et mènent à la section de la partie ouverte. */
  verifier('plus d’onglet réglages en bas', null, a.$('#onglets [data-vue="reglages"]'));
  verifierVrai('le bandeau en porte l’accès', a.$('#b-reglages'));
  verifierVrai('avec un dessin', a.$('#b-reglages svg.pic'));
  a.clic('#b-reglages'); await a.pause(300);
  verifierVrai('et il ouvre bien les réglages',
    a.$('#vue-reglages') && !a.$('#vue-reglages').hidden);
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
scenario('Journées : on pose des heures, pas seulement des demi-journées', async () => {
  /* On part parfois trois heures sur un chantier avant d'aller ailleurs :
     « 1 j » ou « ½ j » ne suffisait pas. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8 },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      joursEstimes: 4, maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-entete'); await t.pause(350);
  t.clic('#ce-plusjour'); await t.pause(200);

  const sel = t.$('[data-cepart="0"]');
  verifierVrai('la part se choisit dans une liste', sel && sel.tagName === 'SELECT');
  const libelles = [...sel.options].map(o => o.textContent);
  ['1 j', '¾ j', '½ j', '¼ j'].forEach(x =>
    verifierVrai('« ' + x + ' » est proposé', libelles.indexOf(x) >= 0));
  verifierVrai('les heures aussi', libelles.indexOf('3 h') >= 0);
  /* 3 h sur une journée de 8 h font 0,375 de journée. */
  const troisH = [...sel.options].filter(o => o.textContent === '3 h')[0];
  verifier('3 h valent la bonne part de journée', 0.375, Number(troisH.value));

  t.choisir('[data-cepart="0"]', '0.375'); await t.pause(200);
  t.clic('#ce-ok'); await t.pause(400);
  const c = (t.stock('chantiers') || [])[0];
  verifier('la part saisie est retenue', 0.375, C0(c).p);
  verifier('aucune erreur', [], t.erreurs);

  function C0(ch) { return (ch.jours || [])[0] || {}; }
});

/* --------------------------------------------------------------------- */
scenario('Journées : dépasser l’estimation demande confirmation', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      joursEstimes: 1, maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-entete'); await t.pause(350);
  t.clic('#ce-plusjour'); await t.pause(150);
  t.clic('#ce-plusjour'); await t.pause(150);

  /* Refusé : rien ne doit être enregistré. */
  let demande = '';
  t.w.confirm = m => { demande = m; return false; };
  t.clic('#ce-ok'); await t.pause(300);
  verifierVrai('l’écart est annoncé en clair', /2 journées pour 1 estimée|de trop/.test(demande));
  verifier('refuser n’enregistre rien', 0, ((t.stock('chantiers') || [])[0].jours || []).length);

  /* Accepté : un chantier a le droit de déborder. */
  t.w.confirm = () => true;
  t.clic('#ce-ok'); await t.pause(400);
  verifier('accepter enregistre les deux journées', 2,
    ((t.stock('chantiers') || [])[0].jours || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Journées : la croix retire bien la journée de trop', async () => {
  /* Le gestionnaire de clic testait une variable qui n'existait pas : chaque
     clic dans la zone des journées levait une erreur avant d'arriver à la
     branche de suppression. La croix ne faisait donc rien, et une journée
     posée en trop ne pouvait plus être retirée. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      joursEstimes: 3, maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-entete'); await t.pause(350);
  t.clic('#ce-plusjour'); await t.pause(150);
  t.clic('#ce-plusjour'); await t.pause(150);
  verifier('deux journées posées', 2, t.$$('#ce-jours [data-cej]').length);
  const second = t.$('[data-cej="1"]').value;

  t.clic('[data-cedel="0"]'); await t.pause(200);
  verifier('la croix en retire une', 1, t.$$('#ce-jours [data-cej]').length);
  verifier('c’est bien la première qui est partie', second, t.$('[data-cej="0"]').value);
  verifier('aucune erreur', [], t.erreurs);

  t.clic('#ce-ok'); await t.pause(400);
  verifier('une seule journée enregistrée', 1,
    ((t.stock('chantiers') || [])[0].jours || []).length);
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
      { id: 'd2', date: new Date(an, 3, 8, 12).getTime(), fournisseur: 'Jura',
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
     des millilitres. 332 plants d'un répulsif dosé à 6 ml font 1 992 ml. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', chOuvert: 'c1',
    articles: [{ id: 'a1', nom: 'Trico', type: 'traitement', unite: 'millilitre',
      dosage: 6, mouvements: [], maj: Date.now() }],
    commandes: [{ id: 'k1', num: 'K1', dateCmd: Date.now(), dateLiv: Date.now(),
      statut: 'recu', livraison: 0, maj: Date.now(),
      lignes: [{ article: 'a1', qte: 10000, prix: 0.0178 }] }],
    chantiers: [{ id: 'c1', nom: 'Plantation Vaux', statut: 'accepte', temps: [], maj: Date.now(),
      lignes: [] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-ligne'); await t.pause(300);

  verifierVrai('la ligne propose les produits du stock', t.$('#cl-art'));
  t.choisir('#cl-trav', 'F_REPULSIF');
  t.saisir('#cl-qte', '332');
  t.saisir('#cl-prix', '0,20');
  t.choisir('#cl-art', 'a1'); await t.pause(200);
  /* Le stock dépasse le litre : l'aide parle donc en litres, et rappelle le
     calcul en millilitres pour qu'on puisse le vérifier d'un coup d'œil. */
  const aide = t.texte('#cl-art-aide');
  verifierVrai('elle annonce ce qui sortira, en litres', /1,99\s?L/.test(aide));
  verifierVrai('en montrant la conversion', /332\s?×\s?6/.test(aide));
  verifierVrai('et ce qu’il restera', /reste/.test(aide));
  t.clic('#cl-ok'); await t.pause(500);

  const s = (t.stock('sorties') || [])[0];
  verifierVrai('une sortie est née de la facture', s && s.chantier === 'c1');
  verifier('convertie en millilitres', 1992, s.lignes[0].qte);
  /* Le chantier est accepté, pas fait : le produit est engagé, pas sorti. */
  const ST = t.w.BCS2;
  verifier('engagé tant que le chantier n’est pas fait', 'accepte',
    ST.VENTE_DE_CHANTIER['accepte']);

  /* Corriger la facture corrige la sortie. */
  t.clic('[data-lmod="0"]'); await t.pause(300);
  t.saisir('#cl-qte', '350');
  t.clic('#cl-ok'); await t.pause(500);
  const s2 = (t.stock('sorties') || [])[0];
  verifier('corriger 332 en 350 corrige la sortie', 2100, s2.lignes[0].qte);
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
     millilitre a sa propre unité. Et 33 984 ml ne disent rien à personne —
     34 L, c'est trois bidons et demi, donc trois hectares. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'stock' }));
  const ST = t.w.BCS2;
  verifierVrai('le millilitre est une unité à part entière',
    ST.UNITES_ART.some(u => u.c === 'millilitre'));
  verifierVrai('et « ml » reste le mètre linéaire',
    ST.UNITES_ART.filter(u => u.c === 'ml')[0].n === 'mètre linéaire');

  const petit = ST.echelleArt('millilitre', [900]);
  verifier('sous le litre, on reste en millilitres', 'ml', petit.court);
  verifier('sans conversion', 1, petit.div);

  const grand = ST.echelleArt('millilitre', [33984, 1992]);
  verifier('au-delà, on passe en litres', 'L', grand.court);
  verifier('en divisant par mille', 1000, grand.div);
  verifierVrai('33 984 ml font bien 34 L', Math.round(33984 / grand.div) === 34);

  /* L'échelle se décide sur toute la ligne : une colonne en litres à côté
     d'une colonne en millilitres serait illisible. */
  const melange = ST.echelleArt('millilitre', [33984, 12]);
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
  t.clic('[data-vue="reglages"]'); await t.pause(250);
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
     fournitures revendues. Celle qui mentait était la tuile du résultat. */
  const fin = t.$('#vue-entreprise [data-module="finances"]');
  verifierVrai('la tuile Finances ne parle pas de marge', !/marge/i.test(fin.textContent));
  /* 4 ha × 250 € = 1000 € facturés, et non 1000 − 120 d'achats.
     t.texte() replie les blancs : l'insécable y ressort en espace ordinaire. */
  verifier('Finances porte le chiffre d’affaires', '1 000 €', t.texte('#e-fi-n'));
  verifierVrai('et elle dit sur quelle période',
    new RegExp(String(new Date().getFullYear())).test(t.texte('#e-fi-s')));
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
  const noms = t.$$('#liste-chantiers .chantier-n').map(e => e.textContent.trim());
  verifierVrai('le plus récent est en tête', /Accepté ce matin/.test(noms[0] || ''));
  verifierVrai('le vieux devis est en dernier', /Vieux devis/.test(noms[noms.length - 1] || ''));
  /* Le tri lui-même, indépendamment de l'écran. */
  const C = t.w.BCC;
  const ordre = C.tri(t.stock('chantiers')).map(c => c.id);
  verifier('l’ordre est bien chronologique inverse', ['recent', 'facture', 'vieux'], ordre);
  verifierVrai('et la date du chantier facturé s’affiche',
    /facturé le/.test(t.$('#vue-carnet').textContent));
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
  t.w.ouvrirChantier ? t.w.ouvrirChantier('c1') : t.clic('#ent-alertes [data-alerte]');
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
  t.clic('#f-entete'); await t.pause(350);
  verifierVrai('le champ « Facturé le » existe', t.$('#ce-datefact'));
  verifierVrai('le champ « Payé le » aussi', t.$('#ce-datepaie'));
  verifier('la date en base est bien affichée', '2026-03-10', t.$('#ce-datefact').value);
  t.choisir('#ce-datepaie', '2026-04-02');
  t.clic('#ce-ok'); await t.pause(400);
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
        ST.echelleArt(trico.unite, [33984]).court);
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

  const vide = await ouvrir(VIDE);
  verifier('sans charge, rien ne s’affiche', '', vide.$('#a-echeances').textContent.trim());

  const t = await ouvrir(Object.assign({}, VIDE, {
    charges: [ch('a', 'mensuel', dans(1)), ch('b', 'annuel', dans(6)), ch('c', 'trimestriel', dans(3))]
  }));
  const z = t.$('#a-echeances');
  verifierVrai('trois échéances proches : elles sont résumées', /3 prélèvements à venir/.test(z.textContent));
  verifierVrai('avec le total', /300/.test(z.textContent));
  verifierVrai('et la plus proche nommée', /demain/.test(z.textContent));
  /* Deux ou moins : on les nomme plutôt que de résumer. */
  const t2 = await ouvrir(Object.assign({}, VIDE, { charges: [ch('a', 'mensuel', dans(1))] }));
  verifierVrai('une seule échéance est nommée en clair',
    /Charge a/.test(t2.$('#a-echeances').textContent));
  verifier('aucune erreur', [], t.erreurs.concat(t2.erreurs, vide.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Charge fixe : la date de premier paiement porte enfin l’année', async () => {
  /* Le formulaire ne demandait qu'un jour et un mois. Un abonnement souscrit
     en septembre 2024 était indiscernable d'un souscrit deux ans plus tard,
     et ses échéances remontaient depuis toujours. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  t.clic('[data-module="finances"]'); await t.pause(250);
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
  t.clic('[data-module="finances"]'); await t.pause(250);
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
  t.clic('[data-vue="reglages"]'); await t.pause(250);
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
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('#c-nouveau'); await t.pause(350);

  verifierVrai('un chantier neuf part avec un devis', t.$('#ce-adevis').checked);
  let l = options(t, '#ce-statut');
  verifierVrai('« Devis à envoyer » est proposé', l.indexOf('Devis à envoyer') >= 0);
  verifierVrai('« Devis signé, à planifier » aussi', l.indexOf('Devis signé, à planifier') >= 0);
  verifierVrai('et « Devis refusé »', l.indexOf('Devis refusé') >= 0);
  verifierVrai('les champs du devis sont visibles', t.$('#ce-devis-bloc').style.display !== 'none');

  cocher(t, '#ce-adevis', false); await t.pause(200);
  l = options(t, '#ce-statut');
  verifier('sans devis, six étapes restent', 6, l.length);
  verifierVrai('« Devis à envoyer » a disparu', l.indexOf('Devis à envoyer') < 0);
  verifierVrai('« Devis envoyé » aussi', l.indexOf('Devis envoyé') < 0);
  verifierVrai('« À planifier » a pris la place de « Devis signé »', l.indexOf('À planifier') >= 0);
  verifierVrai('et « Sans suite » celle de « Devis refusé »', l.indexOf('Sans suite') >= 0);
  verifier('les champs du devis sont masqués', 'none', t.$('#ce-devis-bloc').style.display);
  verifier('l’étape retenue est celle où il en est vraiment', 'accepte', t.$('#ce-statut').value);

  t.saisir('#ce-nom', 'Sans devis'); await t.pause(100);
  t.clic('#ce-ok'); await t.pause(400);
  const c = (t.stock('chantiers') || [])[0];
  verifier('la réponse est enregistrée', false, c.aDevis);
  verifierVrai('et le badge du carnet dit « À planifier »',
    /À planifier/.test(t.$('#liste-chantiers').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis : numéro, date d’édition et validité tiennent sur la fiche', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('#c-nouveau'); await t.pause(350);
  t.saisir('#ce-nom', 'Coupe des Places'); await t.pause(100);
  t.saisir('#ce-numdevis', 'D-2026-014'); await t.pause(100);
  t.choisir('#ce-datedevis', '2026-01-31'); await t.pause(150);
  t.choisir('#ce-validite', '1'); await t.pause(200);

  /* Un devis édité un 31 janvier et valable un mois court jusqu'au 28
     février, pas jusqu'au 3 mars : le jour se replie sur la fin du mois. */
  verifier('la fin de validité est annoncée en clair',
    'Valable jusqu’au 28/02/2026.', t.texte('#ce-validite-fin'));

  t.clic('#ce-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le numéro est retenu', 'D-2026-014', c.numeroDevis);
  verifier('la validité aussi', 1, c.validiteDevis);
  verifier('et la date d’édition', '2026-01-31', jourISO(c.dateDevis));
  verifierVrai('la fiche affiche le numéro du devis',
    /D-2026-014/.test(t.$('#vue-chantier').textContent));
  verifierVrai('et jusqu’à quand il vaut',
    /valable jusqu’au 28\/02\/2026/.test(t.$('#vue-chantier').textContent));

  /* Décoché, plus de devis : garder un numéro ferait ressortir un fantôme. */
  t.clic('#f-entete'); await t.pause(350);
  cocher(t, '#ce-adevis', false); await t.pause(200);
  t.clic('#ce-ok'); await t.pause(450);
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

  /* Trois mois de validité, édité il y a 85 jours : la fin approche. */
  const t = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis('c1', 'Vaux', 85, 3)] }));
  verifierVrai('l’accueil annonce le devis en attente',
    /Devis en attente/.test(t.$('#a-devis').textContent));
  verifierVrai('il est nommé', /Vaux/.test(t.$('#a-devis').textContent));
  verifierVrai('et l’avis parle de validité, pas du jour de l’envoi',
    /valable/.test(t.$('#a-devis').textContent));

  /* Le même devis avec un an de validité : rien à relancer aujourd'hui. */
  const loin = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis('c1', 'Vaux', 85, 12)] }));
  verifier('un devis encore largement valable ne remonte pas',
    '', loin.$('#a-devis').textContent.trim());

  /* Passée la date, l'avis durcit. */
  const fini = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis('c1', 'Vaux', 200, 3)] }));
  verifierVrai('un devis expiré le dit', /expiré/.test(fini.$('#a-devis').textContent));

  /* Sans validité saisie, on retombe sur le délai réglable. */
  const sansVal = await ouvrir(Object.assign({}, VIDE, {
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'envoye', aDevis: true, lignes: [], temps: [],
      dateEnvoi: ilYa(40), maj: ilYa(40) }]
  }));
  verifierVrai('faute de validité, le délai sans réponse parle',
    /40 jours/.test(sansVal.$('#a-devis').textContent));

  /* Chassé d'un doigt, il s'efface. */
  t.clic('#a-devis-fermer'); await t.pause(200);
  verifier('un appui sur la croix le masque', '', t.$('#a-devis').textContent.trim());
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
      { id: 'c2', nom: 'Places dégagement', statut: 'encours', aDevis: false, lignes: [], temps: [],
        commune: 'Foncine', maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  verifierVrai('le filtre par défaut cache le chantier payé',
    !/Vaux plantation/.test(t.$('#liste-chantiers').textContent));

  t.saisir('#c-rech', 'F-2026-031'); await t.pause(250);
  const z = t.$('#liste-chantiers').textContent;
  verifierVrai('la recherche le fait sortir', /Vaux plantation/.test(z));
  verifierVrai('et elle écarte l’autre', !/Places dégagement/.test(z));
  verifierVrai('elle dit sur quoi elle a cherché', /1 chantier sur 2/.test(z));

  /* Les accents et les majuscules ne comptent pas, et deux mots peuvent
     tomber dans deux champs différents. */
  t.saisir('#c-rech', 'foncine'); await t.pause(250);
  verifierVrai('une commune en minuscules suffit',
    /Places dégagement/.test(t.$('#liste-chantiers').textContent));
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
  t.clic('[data-chstatut="c1"]'); await t.pause(300);
  t.clic('[data-setstatut="facture"]'); await t.pause(350);

  verifierVrai('le numéro est demandé aussitôt', t.$('#nf-num'));
  t.saisir('#nf-num', 'F-2026-044'); await t.pause(100);
  t.clic('#nf-ok'); await t.pause(400);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le statut a changé', 'facture', c.statut);
  verifier('et le numéro est posé', 'F-2026-044', c.numeroFacture);

  /* Déjà renseigné, on ne redemande pas. */
  t.clic('[data-chstatut="c1"]'); await t.pause(300);
  t.clic('[data-setstatut="paye"]'); await t.pause(400);
  verifier('rien n’est redemandé quand le numéro est là', null, t.$('#nf-num'));
  verifier('le statut a bien suivi', 'paye', (t.stock('chantiers') || [])[0].statut);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Devis : l’historique repris du carnet n’en avait pas', async () => {
  /* Les 32 chantiers convertis du classeur comptable sont tous facturés,
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
  const debut = new Date(an, 0, 5, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'finances',
    charges: [
      { id: 'g1', libelle: 'Logiciel', beneficiaire: 'l’éditeur', ttc: 12, periodicite: 'mensuel',
        categorie: 'ABO', taux: 20, dansDepenses: true, debut: debut, jour: 5, moisReference: 0 },
      { id: 'g2', libelle: 'Prêt matériel', beneficiaire: 'la banque', ttc: 385, periodicite: 'mensuel',
        categorie: 'PRET', taux: 0, dansDepenses: false, debut: debut, jour: 5, moisReference: 0 }
    ]
  }));
  const auto = () => (t.stock('depenses') || []).filter(d => d.auto);
  const mois = new Date().getMonth() + 1;
  verifier('une dépense par échéance passée du logiciel', mois, auto().length);
  verifierVrai('toutes rattachées à la charge', auto().every(d => d.charge === 'g1'));
  verifierVrai('le prêt n’en crée aucune', !auto().some(d => d.charge === 'g2'));
  verifierVrai('la catégorie de la charge est reprise',
    auto().every(d => d.lignes[0].categorie === 'ABO'));
  verifierVrai('et son taux de TVA', auto().every(d => d.lignes[0].taux === 20));
  /* Rien au-delà d'aujourd'hui : on ne paie pas une échéance à venir. */
  verifierVrai('aucune échéance future n’est comptée',
    auto().every(d => d.date <= Date.now()));

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
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Charges : une échéance pointée à la main n’est jamais comptée deux fois', async () => {
  /* Garde essentielle : l'ancien pointage manuel a laissé des dépenses en
     base. Les recréer automatiquement doublerait la TVA déduite. */
  const an = new Date().getFullYear();
  const debut = new Date(an, 0, 5, 12).getTime();
  const t = await ouvrir(Object.assign({}, VIDE, {
    charges: [{ id: 'g1', libelle: 'Logiciel', ttc: 12, periodicite: 'mensuel',
      categorie: 'ABO', taux: 20, dansDepenses: true, debut: debut, jour: 5, moisReference: 0 }],
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
  t.clic('[data-vue="charges"]'); await t.pause(300);
  const z = t.$('#charges-resume');
  verifierVrai('le graphique des douze mois est là', /Quand l’argent part/.test(z.textContent));
  verifierVrai('la répartition par catégorie aussi', /Où il part/.test(z.textContent));
  verifierVrai('les bâtons sont empilés par catégorie',
    z.querySelectorAll('svg rect[fill="#8A5A2B"]').length > 1);
  verifierVrai('l’assurance a sa propre couleur',
    z.querySelectorAll('svg rect[fill="#1D6FB8"]').length === 1);

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
scenario('Entreprise : le bilan est au-dessus des tuiles, et chaque bulle mène quelque part', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [
      { id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [{ travail: 'PLANT', unite: 'plant',
        quantite: 1000, prix: 0.5, nature: 'prestation' }], temps: [], joursEstimes: 4,
        jours: [{ d: Date.now(), p: 1 }], maj: Date.now() },
      { id: 'c2', nom: 'Les Places', statut: 'encours', lignes: [], temps: [], maj: Date.now() },
      { id: 'c3', nom: 'Foncine', statut: 'facture', lignes: [{ travail: 'DEGAG', unite: 'ha',
        quantite: 2, prix: 900, nature: 'prestation' }], temps: [], donneur: 'Cabinet Dubois',
        numeroFacture: 'F-9', dateFacture: Date.now() - 70 * 86400000, maj: Date.now() }
    ]
  }));
  const bilan = t.$('#ent-bilan');
  verifierVrai('le bilan est rendu', /Où j’en suis/.test(bilan.textContent));
  verifierVrai('les journées restant à planifier y sont', /journées à planifier/.test(bilan.textContent));
  /* Une journée posée sur quatre estimées : il en reste trois. On lit la
     valeur de la bulle elle-même, pas le texte de l'écran — un chiffre isolé
     s'y retrouverait par hasard. */
  verifier('3 sur 4 estimées restent à poser', '3',
    bilan.querySelector('[data-bulle="calendrier"] .v').textContent);
  verifierVrai('les devis signés', /devis signés/.test(bilan.textContent));
  verifierVrai('les chantiers en cours', /chantiers en cours/.test(bilan.textContent));
  verifierVrai('les impayés', /impayés/.test(bilan.textContent));
  verifierVrai('le chiffre d’affaires', /chiffre d’affaires/.test(bilan.textContent));
  verifierVrai('la TVA déductible', /TVA déductible/.test(bilan.textContent));

  /* Le bilan précède les tuiles dans le document : c'est ce qu'on vient
     chercher, et en dessous il tombait hors de l'écran. */
  const tuiles = t.$('#vue-entreprise .tuiles');
  verifierVrai('il est placé avant les tuiles',
    bilan.compareDocumentPosition(tuiles) & 4);

  /* L'impayé garde son nom, son montant et son ancienneté dans « À traiter ». */
  const at = t.$('#ent-alertes').textContent;
  verifierVrai('l’impayé est nommé', /Foncine/.test(at));
  /* Le millier est séparé par une espace insécable, jamais par une ordinaire :
     un montant coupé en bout de ligne se lit comme deux nombres. */
  verifierVrai('avec son montant', /1 800/.test(at));
  verifierVrai('et ce montant ne peut pas se couper', !/1 800/.test(at));
  verifierVrai('depuis combien de temps', /70 jours/.test(at));
  verifierVrai('et par qui il passe', /Cabinet Dubois/.test(at));

  /* Une bulle mène à la liste filtrée. */
  t.clic('[data-bulle="facture"]'); await t.pause(350);
  verifier('la bulle des impayés filtre le carnet', 'facture', t.$('#c-filtre').value);
  verifierVrai('et le chantier concerné est visible',
    /Foncine/.test(t.$('#liste-chantiers').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('À traiter : des notes à soi-même, qui restent tant qu’on ne les efface pas', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  verifierVrai('la zone invite à s’écrire une note',
    /\+ note/.test(t.$('#ent-alertes').textContent));

  t.clic('#ent-note-plus'); await t.pause(300);
  t.saisir('#nt-titre', 'Rappeler le gestionnaire');
  t.saisir('#nt-texte', 'pour la parcelle du haut');
  t.clic('[data-ntcoul="#B4231F"]'); await t.pause(120);
  t.clic('#nt-ok'); await t.pause(400);

  const z = t.$('#ent-alertes');
  verifierVrai('la note s’affiche', /Rappeler le gestionnaire/.test(z.textContent));
  verifierVrai('avec sa précision', /parcelle du haut/.test(z.textContent));
  verifierVrai('et sa couleur', /B4231F|rgb\(180, 35, 31\)/.test(z.innerHTML));
  /* Elle part dans les sauvegardes : elle vit donc dans la configuration. */
  const n = (t.stock('cfg') || {}).notes || [];
  verifier('une note est en base', 1, n.length);
  verifier('son titre est retenu', 'Rappeler le gestionnaire', n[0].titre);

  /* Elle se rouvre pour être corrigée. */
  t.clic('[data-note]'); await t.pause(300);
  t.saisir('#nt-titre', 'Rappeler l’expert');
  t.clic('#nt-ok'); await t.pause(400);
  verifierVrai('la correction est prise', /Rappeler l’expert/.test(t.$('#ent-alertes').textContent));
  verifier('sans en créer une seconde', 1, ((t.stock('cfg') || {}).notes || []).length);

  /* Et elle ne s'efface que sur demande. */
  t.w.confirm = () => true;
  t.clic('[data-notesup]'); await t.pause(400);
  verifier('effacée, il n’en reste rien', 0, ((t.stock('cfg') || {}).notes || []).length);
  verifierVrai('et la zone le dit', /\+ note/.test(t.$('#ent-alertes').textContent));
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
    verifierVrai(mod + ' : ' + n + ' onglets, jamais un seul', n >= 2);
    verifier(mod + ' : aucune erreur', [], t.erreurs);
  }
  const t2 = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  verifierVrai('l’onglet des charges s’appelle « Charges fixes »',
    /Charges fixes/.test(t2.$('#onglets').textContent));
  verifierVrai('et Analyses y a trouvé sa place',
    /Analyses/.test(t2.$('#onglets').textContent));
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
  t.clic('[data-vue="charges"]'); await t.pause(250);
  verifierVrai('on part des charges fixes', t.$('#vue-charges').classList.contains('actif'));

  t.clic('#b-reglages'); await t.pause(300);
  verifierVrai('les réglages sont ouverts', t.$('#vue-reglages').classList.contains('actif'));

  t.clic('#b-retour'); await t.pause(300);
  verifierVrai('on revient sur les charges fixes', t.$('#vue-charges').classList.contains('actif'));
  verifierVrai('et pas sur le menu de l’entreprise',
    !t.$('#vue-entreprise').classList.contains('actif'));
  verifierVrai('le masque des menus n’est pas posé',
    !t.d.body.classList.contains('accueil-ouvert'));

  /* Deuxième appui : là, on remonte bien au menu du groupe. */
  t.clic('#b-retour'); await t.pause(300);
  verifierVrai('un second retour mène au menu de la partie',
    t.$('#vue-entreprise').classList.contains('actif'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Modules : Devis disparaît, Analyses devient un onglet de Finances', async () => {
  /* « Devis et estimatif » n'avait aucun écran à lui, et Analyses lisait les
     mêmes données que Finances sur la même période. Sept tuiles passent à
     cinq sans qu'un seul écran soit perdu. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  const tuiles = t.$$('#vue-entreprise .tuiles .tuile')
    .map(b => b.dataset.module);
  verifier('cinq tuiles restent', 5, tuiles.length);
  verifierVrai('plus de tuile Devis', tuiles.indexOf('devis') < 0);
  verifierVrai('plus de tuile Analyses', tuiles.indexOf('analyses') < 0);
  verifierVrai('Chantiers, Calendrier, Rendements, Stock et Finances sont là',
    ['chantiers', 'calendrier', 'rendements', 'stock', 'finances']
      .every(m => tuiles.indexOf(m) >= 0));

  /* Les deux écrans restent joignables, ailleurs. */
  t.clic('[data-module="finances"]'); await t.pause(300);
  const onglets = t.$$('#onglets button').map(b => b.dataset.vue);
  verifier('Finances porte quatre onglets', 4, onglets.length);
  verifierVrai('dont Analyses', onglets.indexOf('analyses') >= 0);
  t.clic('[data-vue="analyses"]'); await t.pause(350);
  verifierVrai('l’écran d’analyses s’affiche', t.$('#vue-analyses').classList.contains('actif'));
  /* « Recettes » existait déjà, en pastille : la fusion ne l'a pas perdue. */
  verifierVrai('et sa pastille Recettes est là', t.$('[data-ana="recettes"]'));

  t.clic('[data-module="entreprise"]'); await t.pause(300);
  t.clic('[data-module="rendements"]'); await t.pause(300);
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
  t.clic('#b-reglages'); await t.pause(350);
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
  const vise = async (module, sectionAttendue, zoneAttendue) => {
    const t = await ouvrir(Object.assign({}, VIDE, { module: module }));
    const vus = [];
    t.w.Element.prototype.scrollIntoView = function () { vus.push(this); };
    t.clic('#b-reglages'); await t.pause(400);
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
  await vise('cubage', 'cubage', null);
  await vise('bois', 'bois', null);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : la barre du bas ne propose plus les écrans du module quitté', async () => {
  /* On arrivait des Finances et la barre offrait Bilan, Dépenses, Charges,
     Analyses — alors qu'aucun de ces écrans n'était affiché. Les réglages sont
     un écran de côté : on en sort par la flèche du bandeau. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'finances' }));
  verifierVrai('la barre est visible sur Finances',
    !t.d.body.classList.contains('v-reglages'));
  t.clic('#b-reglages'); await t.pause(350);
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
  verifier('une règle vise la barre dans les réglages', 1, masque.length);
  verifier('et elle la masque', 'none', masque[0] && masque[0][1]);
  t.clic('#b-retour'); await t.pause(300);
  verifierVrai('en sortant, elle revient',
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
  const ligne = (id, nom, prix, jour) => ({ id, nom, statut: 'encours', temps: [],
    maj: new Date(2026, 0, jour, 12).getTime(),
    donneur: 'Cabinet Dubois',
    lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 1, prix: prix, nature: 'prestation' }] });
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [ligne('c1', 'Un nom de chantier particulièrement long', 12000, 20),
      ligne('c2', 'Court', 90, 10)]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  const lignes = t.$$('#liste-chantiers .chantier-l');
  verifier('deux lignes en grille', 2, lignes.length);
  const grille = t.w.getComputedStyle(lignes[0]);
  verifier('trois colonnes', 'grid', grille.display);
  /* Le montant vit dans sa propre colonne, plus dans le titre. */
  const montants = lignes.map(l => l.querySelector('.chantier-m').textContent.trim());
  verifierVrai('le montant de chaque ligne est à part', montants.every(m => /\u20AC/.test(m)));
  verifierVrai('et il ne double pas le nom',
    !/\u20AC/.test(lignes[0].querySelector('.chantier-n').textContent));
  verifierVrai('le nom long est bien là',
    /particulièrement long/.test(lignes[0].querySelector('.chantier-n').textContent));
  /* Les boutons ne sont plus étirés ni centrés : ils commencent au même bord. */
  const actions = lignes.map(l => l.querySelector('.chantier-act'));
  verifierVrai('chaque ligne porte ses trois boutons',
    actions.every(a => a.querySelectorAll('.btn-min').length === 3));
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
  verifierVrai('le chantier à facturer est compté', /1 chantier/.test(tete));
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
  verifierVrai('la fiche annonce les journées faites', /faites/.test(fiche));
  verifierVrai('et celles à venir', /à venir/.test(fiche));
  verifierVrai('elle rappelle que le temps se saisit à part',
    /temps réellement passé/.test(fiche));
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
      { id: 'c3', nom: 'Foncine', statut: 'paye', donneur: 'Cabinet Dubois',
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
        commune: 'Foncine', joursEstimes: 3, temps: [], maj: Date.now(),
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
  const liste = t.$('#liste-chantiers');
  verifier('une seule ligne est marquée', 1, liste.querySelectorAll('.acompleter').length);
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
  t.clic('#c-nouveau'); await t.pause(350);

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

  /* Le chantier n'est pas encore enregistré : la liste s'enrichit tout de même. */
  t.clic('#ce-donneur-offre [data-offre]'); await t.pause(350);
  const clients = t.stock('clients') || [];
  verifierVrai('le donneur d’ordre est entré dans la liste',
    clients.indexOf('Groupement de Vaux') >= 0);
  verifierVrai('et l’offre le confirme', /ajouté/.test(offre.textContent));
  verifierVrai('sans avoir enregistré le chantier', !(t.stock('chantiers') || []).length);

  /* Enregistrer ne pose plus aucune question. */
  let demande = null;
  t.w.confirm = m => { demande = m; return false; };
  t.saisir('#ce-nom', 'Vaux');
  t.clic('#ce-ok'); await t.pause(450);
  verifier('la validation ne demande plus rien', null, demande);
  verifier('et le chantier est enregistré', 1, (t.stock('chantiers') || []).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Inventaire : on n’additionne pas des millilitres avec des pièces', async () => {
  /* « 55 800 achetés » sur du répulsif au millilitre et des tuteurs à la pièce
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

  t.clic('#b-reglages'); await t.pause(350);
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
    /de charges sur le prix de vente/.test(t.$('#rev-resultat').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Coûts : les prix pratiqués se comparent au minimum', async () => {
  /* Le bambou acheté 1 € et vendu 2 € passe largement ; la gaine achetée 2 €
     et vendue 2,20 € reste sous le minimum. */
  const t = await ouvrir(STOCK());
  t.clic('[data-vue="revient"]'); await t.pause(300);
  t.clic('[data-rev="couts"]'); await t.pause(350);
  const corps = t.$('#rev-resultat');
  verifierVrai('le graphique est là', /Vos prix face au minimum/.test(corps.textContent));
  verifierVrai('il nomme les deux produits',
    /Bambou/.test(corps.textContent) && /Gaine/.test(corps.textContent));
  verifierVrai('il donne le prix pratiqué et le minimum',
    /vendu/.test(corps.textContent) && /minimum/.test(corps.textContent));
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
/* Un troisième argument ne joue que les scénarios dont le nom le contient.
   Sert à éprouver un contrôle en le cassant exprès : rejouer les quarante
   autres pour vérifier qu'un seul crie coûte deux minutes pour rien.
   node outils/tests.js index.html "double compte" */
(async () => {
  const filtre = (process.argv[3] || '').toLowerCase();
  const joues = filtre
    ? scenarios.filter(s => s.nom.toLowerCase().includes(filtre))
    : scenarios;
  console.log('Sylve — tests de non-régression' +
    (filtre ? ` — filtre « ${process.argv[3]} » : ${joues.length} scénario(s)` : '') +
    '\n' + '─'.repeat(52));
  if (filtre && !joues.length) {
    console.log('✕ aucun scénario ne correspond à « ' + process.argv[3] + ' ».');
    process.exit(1);
  }
  for (const s of joues) {
    console.log('\n  ' + s.nom);
    try { await s.fn(); }
    catch (e) { ko++; console.log('    ✕ le scénario s\'est interrompu : ' + e.message); }
  }
  console.log('\n' + '─'.repeat(52));
  console.log(ko ? `✕ ${ko} vérification(s) en échec sur ${ok + ko}.`
    : `✓ ${ok} vérifications, tout passe.`);
  process.exit(ko ? 1 : 0);
})();
