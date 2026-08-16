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
  verifier('valeur totale du stock', '3801,79', lignes[lignes.length - 1].slice(-1)[0]);
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
  verifier('les zones de l\'entreprise, dans l\'ordre',
    ['Général', 'Listes déroulantes', 'Stock et fournitures', 'Financier', 'Import de données'], zones);
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
  /* Second niveau : les sept tuiles de l'entreprise, cerclées. */
  const sous = ['chantiers', 'calendrier', 'rendements', 'devis', 'analyses', 'stock', 'finances'];
  const cercles = sous.filter(m => {
    const b = t.$('#vue-entreprise [data-module="' + m + '"]');
    return b && b.querySelector('.ic.rond svg.pic');
  });
  verifier('les sept tuiles de l’entreprise sont cerclées', sous, cercles);
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
    ['finances', '#dep-nouvelle'], ['stock', '#art-reception']
  ];
  for (const [mod, enPage] of doublons) {
    const t = await ouvrir(Object.assign({}, VIDE, { module: mod }));
    verifier(mod + ' : le bandeau n’a plus d’action', '', t.texte('#b-ctx'));
    verifierVrai(mod + ' : le bouton est dans la page', t.$(enPage));
    verifier(mod + ' : aucune erreur', [], t.erreurs);
  }
  /* Ceux qui n'ont pas d'équivalent restent, sinon on serait bloqué dehors. */
  const t2 = await ouvrir(Object.assign({}, VIDE, { module: 'devis' }));
  verifierVrai('devis : « Estimer » reste, c’est le seul accès', t2.$('#b-estimer'));
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
    cubage: 4, chantiers: 2, calendrier: 3, rendements: 2, devis: 2,
    finances: 3, analyses: 1, stock: 3, bois: 4
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
  /* L'échelle s'arrête sur un chiffre rond, sinon la moitié tombe faux. */
  const BCUI = t.w;
  verifierVrai('le haut de l’échelle est un chiffre rond',
    etiquettes.some(e => /^(10|12|15|20|25|30|50) k€$/.test(e)));
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
scenario('Analyses : la tuile ne parle plus de marge', async () => {
  /* « Marge » désignait recettes moins achats, qui ignore les cotisations,
     l'impôt et l'amortissement. Ce n'est pas une marge, et la tuile ne
     disait pas non plus sur quelle période elle comptait. */
  const an = new Date().getFullYear();
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'paye', temps: [], maj: Date.now(),
      dateFacture: Date.now(), datePaiement: Date.now(),
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 4, prix: 250, nature: 'prestation' }] }],
    depenses: [{ id: 'd1', date: Date.now(),
      lignes: [{ libelle: 'Gasoil', categorie: 'CONSO', ttc: 120, taux: 20 }] }]
  }));
  const lib = t.texte('#e-an-p');
  verifierVrai('le mot « marge » a disparu de la tuile', !/marge/i.test(lib || ''));
  verifier('elle annonce ce qu’elle compte et quand', 'facturé ' + an, lib);
  /* 4 ha × 250 € = 1000 € facturés, et non 1000 − 100 d'achats. */
  verifier('et c’est bien le chiffre d’affaires', '1000 €', t.texte('#e-an-n'));
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
  const noms = t.$$('#carnet-liste .liste-item b, #liste-chantiers .liste-item b')
    .map(e => e.textContent.trim());
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
(async () => {
  console.log('Sylve — tests de non-régression\n' + '─'.repeat(52));
  for (const s of scenarios) {
    console.log('\n  ' + s.nom);
    try { await s.fn(); }
    catch (e) { ko++; console.log('    ✕ le scénario s\'est interrompu : ' + e.message); }
  }
  console.log('\n' + '─'.repeat(52));
  console.log(ko ? `✕ ${ko} vérification(s) en échec sur ${ok + ko}.`
    : `✓ ${ok} vérifications, tout passe.`);
  process.exit(ko ? 1 : 0);
})();
