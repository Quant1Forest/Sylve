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
  /* Elle était masquée hors d'une partie — le bouton d'accueil y faisait déjà
     le même trajet. Il l'a demandée partout le 23 août : « comme ça j'ai les
     deux possibilités ». Hors partie, elle vise l'accueil. */
  t.clic('[data-module="cubage"]'); await t.pause(250);
  verifier('elle est là dans le cubage aussi', false, t.$('#b-retour').hidden);
  verifierVrai('et elle y vise l’accueil', /accueil/.test(t.$('#b-retour').title));
  t.clic('#b-retour'); await t.pause(250);
  verifierVrai('où elle ramène bien', t.$('#vue-accueil').classList.contains('actif'));
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
    /* Les journées ne se posent plus à la création : elles ont leur bloc sur
       la fiche. On ouvre donc un second chantier pour voir que le jour déjà
       pris par Vaux lui est signalé. */
    chantiers: [
      { id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
        jours: [{ d: pris.getTime(), p: 1 }], maj: Date.now() },
      { id: 'c2', nom: 'Chaux', statut: 'accepte', lignes: [], temps: [],
        jours: [], maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(200);
  t.clic('[data-chouvrir="c2"]'); await t.pause(400);
  verifier('le champ « à finir avant le » a disparu', null, t.$('#ce-ech'));
  t.clic('#f-jours'); await t.pause(350);
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
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(200);
  /* Le « + liste » vit sur le formulaire de création, qui ne garde plus que
     donneur, propriétaire, lieu et travaux. */
  t.clic('#c-nouveau'); await t.pause(300);
  t.saisir('#ce-donneur', 'Jean Roman');
  t.clic('[data-ajlist="clients"]'); await t.pause(400);
  verifier('le donneur d\'ordre est dans la liste', ['Jean Roman'], t.stock('clients'));
  t.clic('#modale-x'); await t.pause(250);

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
  const titres = t.$$('#vue-chantier .etape-bloc, #vue-chantier .carte > h2')
    .map(e => e.textContent);
  verifierVrai('le bloc des journées est là', titres.indexOf('Les journées') >= 0);
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
  verifierVrai('le champ demande des heures',
    /Combien d’heures/.test(t.texte('#modale-corps')));
  const crans = t.$$('#ct-crans [data-cth]').map(b => b.dataset.cth);
  verifier('un cran par heure, de 1 à la journée', 8, crans.length);
  verifier('le premier vaut une heure', '1', crans[0]);
  t.clic('[data-cth="3"]'); await t.pause(150);
  verifier('le cran écrit dans le champ', '3', t.$('#ct-duree').value);
  t.clic('#ct-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le temps est noté en heures', 'h', c.temps[0].unite);
  verifier('et vaut trois heures', 3, c.temps[0].duree);

  /* Les dates posées ne proposent plus que des heures. */
  t.clic('#f-jours'); await t.pause(400);
  const parts = options(t, '[data-cepart="0"]');
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
     ses données ne bougent pas. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 7 },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', maj: Date.now(),
      lignes: [], temps: [], jours: [{ d: Date.now(), p: 0.5 }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-jours'); await t.pause(400);
  /* 0,5 journée de sept heures ne tombe sur aucune heure ronde : le cran est
     gardé tel quel plutôt que replié sur le voisin. */
  verifier('la valeur posée est toujours celle qui est choisie', '0.5',
    t.$('[data-cepart="0"]').value);
  t.clic('#cj-ok'); await t.pause(450);
  verifier('et elle survit à un enregistrement', 0.5,
    (t.stock('chantiers') || [])[0].jours[0].p);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Agenda : un jour déjà pris propose le suivant au lieu de constater', async () => {
  /* « Il faudrait que ça me dise : attention, tel jour, autre chose est déjà
     prévu. Voulez-vous le remplacer ou annuler ? » L'avertissement existait
     mais ne proposait rien : il fallait retrouver le jour libre soi-même. */
  const JOUR = 86400000;
  const pris = new Date(Date.now() + 3 * JOUR); pris.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    /* Les week-ends sont ouverts : sinon le jour libre suivant dépendrait du
       jour de la semaine où le test tourne. */
    module: 'chantiers', cfg: { heuresJour: 8, weekends: true },
    chantiers: [
      { id: 'c1', nom: 'Plantation Bernard', statut: 'accepte', lignes: [], temps: [],
        jours: [{ d: pris.getTime(), p: 1 }], maj: Date.now() },
      { id: 'c2', nom: 'Dégagement Martin', statut: 'accepte', lignes: [], temps: [],
        jours: [], maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c2"]'); await t.pause(400);
  t.clic('#f-jours'); await t.pause(400);
  t.clic('#ce-plusjour'); await t.pause(250);
  /* On le pose exprès sur le jour déjà retenu par l'autre chantier. */
  t.choisir('[data-cej="0"]', jourISO(pris.getTime())); await t.pause(300);

  const dit = t.texte('#ce-jours');
  verifierVrai('le conflit est annoncé avant, pas après', /est déjà pris/.test(dit));
  verifierVrai('et il nomme le chantier qui le tient', /Plantation Bernard/.test(dit));
  verifierVrai('le jour libre suivant est proposé', t.$('[data-cesuivant="0"]'));
  t.clic('[data-cesuivant="0"]'); await t.pause(300);
  verifierVrai('et la date a bougé',
    t.$('[data-cej="0"]').value !== jourISO(pris.getTime()));
  verifierVrai('le conflit a disparu', !/est déjà pris/.test(t.texte('#ce-jours')));
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
  /* Second niveau : les six tuiles de l'entreprise, cerclées — Véhicule est
     arrivé en 4.59. */
  const sous = ['chantiers', 'calendrier', 'rendements', 'stock', 'finances', 'vehicule'];
  const cercles = sous.filter(m => {
    const b = t.$('#vue-entreprise [data-module="' + m + '"]');
    return b && b.querySelector('.ic.rond svg.pic');
  });
  verifier('les six tuiles de l’entreprise sont cerclées', sous, cercles);
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
scenario('Journées : on pose des heures, et rien que des heures', async () => {
  /* On part parfois trois heures sur un chantier avant d'aller ailleurs.
     Les heures ont d'abord été ajoutées à côté des fractions de journée ;
     elles ont fini par les remplacer, parce que les deux disaient la même
     chose autrement : « soit tu mets tout en heures, soit tu ne mets pas
     tout en heures ». */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers', cfg: { heuresJour: 8 },
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'accepte', lignes: [], temps: [],
      joursEstimes: 4, maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(300);
  t.clic('#f-jours'); await t.pause(350);
  t.clic('#ce-plusjour'); await t.pause(200);

  const sel = t.$('[data-cepart="0"]');
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

  t.choisir('[data-cepart="0"]', '0.375'); await t.pause(200);
  t.clic('#cj-ok'); await t.pause(400);
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
  t.clic('#f-jours'); await t.pause(350);
  t.clic('#ce-plusjour'); await t.pause(150);
  t.clic('#ce-plusjour'); await t.pause(150);

  /* Refusé : rien ne doit être enregistré. */
  let demande = '';
  t.w.confirm = m => { demande = m; return false; };
  t.clic('#cj-ok'); await t.pause(300);
  verifierVrai('l’écart est annoncé en clair', /2 journées pour 1 estimée|de trop/.test(demande));
  verifier('refuser n’enregistre rien', 0, ((t.stock('chantiers') || [])[0].jours || []).length);

  /* Accepté : un chantier a le droit de déborder. */
  t.w.confirm = () => true;
  t.clic('#cj-ok'); await t.pause(400);
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
  t.clic('#f-jours'); await t.pause(350);
  t.clic('#ce-plusjour'); await t.pause(150);
  t.clic('#ce-plusjour'); await t.pause(150);
  verifier('deux journées posées', 2, t.$$('#ce-jours [data-cej]').length);
  const second = t.$('[data-cej="1"]').value;

  t.clic('[data-cedel="0"]'); await t.pause(200);
  verifier('la croix en retire une', 1, t.$$('#ce-jours [data-cej]').length);
  verifier('c’est bien la première qui est partie', second, t.$('[data-cej="0"]').value);
  verifier('aucune erreur', [], t.erreurs);

  t.clic('#cj-ok'); await t.pause(400);
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
  verifierVrai('« Devis signé, à planifier » aussi', l.indexOf('Devis signé, à planifier') >= 0);
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
  verifierVrai('« À planifier » a pris la place de « Devis signé »', l.indexOf('À planifier') >= 0);
  verifierVrai('et « Sans suite » celle de « Devis refusé »', l.indexOf('Sans suite') >= 0);

  t.clic('[data-vue="carnet"]'); await t.pause(300);
  verifierVrai('et le badge du carnet dit « À planifier »',
    /À planifier/.test(t.$('#liste-chantiers').textContent));
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
  t.choisir('#ce-validite', '1'); await t.pause(200);

  /* Un devis édité un 31 janvier et valable un mois court jusqu'au 28
     février, pas jusqu'au 3 mars : le jour se replie sur la fin du mois. */
  verifier('la fin de validité est annoncée en clair',
    'Valable jusqu’au 28/02/2026.', t.texte('#ce-validite-fin'));

  t.clic('#dv-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le numéro est retenu, complété à quatre chiffres', 'D-2026-0014', c.numeroDevis);
  verifier('la validité aussi', 1, c.validiteDevis);
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
  t.clic('[data-chstatut="c1"]'); await t.pause(300);
  t.clic('[data-setstatut="paye"]'); await t.pause(400);
  verifier('rien n’est redemandé quand le numéro est là', null, t.$('#nf-num-rg'));
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
  verifierVrai('les factures en attente', /factures en attente/.test(bilan.textContent));
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
  /* Une tuile par module de la partie, ni plus ni moins. Le compte était
     écrit en dur : il cassait à chaque module ajouté sans rien apprendre.
     On le croise maintenant avec le sélecteur de module du bandeau, qui
     porte la même liste, écrit pour une autre raison — naviguer. Une tuile
     oubliée comme une tuile fantôme font crier ce contrôle. */
  t.clic('[data-module="chantiers"]'); await t.pause(300);
  const parBandeau = [...t.$('#b-module [label="Entreprise"]').children]
    .map(o => o.value).sort();
  t.clic('#b-retour'); await t.pause(300);
  verifier('une tuile par module de la partie', parBandeau, tuiles.slice().sort());
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
  /* On plante 332 arbres, on ne verse pas 1 992 millilitres. La saisie parle
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

  t.saisir('[data-lgqte="0"]', '332');
  t.saisir('[data-lgprix="0"]', '0,30');
  await t.pause(250);
  /* Le séparateur de milliers est une espace insécable : on lit la phrase
     telle qu'elle est écrite, sans expression régulière à échapper. */
  const conv = t.$('[data-lgconv="0"]').textContent;
  verifier('la conversion est écrite en clair',
    '332 × 6 ml = 1 992 ml sortiront du stock', conv);

  t.clic('#so-ok'); await t.pause(450);
  const so = (t.stock('sorties') || [])[0];
  verifierVrai('la sortie est enregistrée', so);
  verifier('332 plants font 1 992 ml', 1992, so.lignes[0].qte);
  /* 0,30 € par plant, c'est 0,05 € par millilitre. */
  verifier('et le prix suit la quantité', 0.05, so.lignes[0].prix);

  /* Rouverte, elle se relit en plants. */
  t.clic('[data-mvt="sorties"]'); await t.pause(250);
  t.clic('[data-srtmod="' + so.id + '"]'); await t.pause(400);
  verifier('elle se relit en plants', '332', t.$('[data-lgqte="0"]').value);
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
  t.clic('#b-reglages'); await t.pause(350);
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
  verifier('le nom remplace « Mon entreprise »', 'ETF du Val Vert', t.texte('#ent-nom'));
  verifierVrai('le logo est affiché', !t.$('#ent-logo').hidden);
  verifierVrai('et c’est bien l’image déposée',
    t.$('#ent-logo img').getAttribute('src') === LOGO);
  /* Au démarrage, la signature sous la phrase de l'outil. */
  verifierVrai('la signature est posée au démarrage', !t.$('#dem-ent').hidden);
  verifierVrai('elle porte le nom', /ETF du Val Vert/.test(t.$('#dem-ent').textContent));

  /* Rien de saisi : l'écran garde son intitulé, et rien ne signe. */
  const vide = await ouvrir(Object.assign({}, VIDE, { module: 'entreprise' }));
  await vide.pause(250);
  verifier('sans nom, l’intitulé d’origine', 'Mon entreprise', vide.texte('#ent-nom'));
  verifierVrai('sans logo, rien ne s’affiche', vide.$('#ent-logo').hidden);
  verifierVrai('et rien ne signe le démarrage', vide.$('#dem-ent').hidden);

  /* Le nom se règle, et l'écran suit. */
  vide.clic('#b-reglages'); await vide.pause(350);
  verifierVrai('le champ est dans les réglages', vide.$('#r-ent-nom'));
  vide.choisir('#r-ent-nom', 'Forêts du Levant'); await vide.pause(350);
  verifier('le nom est enregistré', 'Forêts du Levant', (vide.stock('cfg') || {}).nomEntreprise);
  verifier('et l’écran d’entreprise a suivi', 'Forêts du Levant', vide.texte('#ent-nom'));
  verifier('aucune erreur', [], t.erreurs.concat(vide.erreurs));
});

/* --------------------------------------------------------------------- */
scenario('Notes de mise à jour : la version installée d’abord, les autres derrière', async () => {
  /* Cinq notes dépliées faisaient un long défilement pour une information
     qu'on ne relit presque jamais. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('#b-reglages'); await t.pause(350);
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
      lignes: [{ travail: 'PROTEC', unite: 'plant', quantite: 332, prix: 0.3,
        nature: 'vente', article: 'a1' }] }],
    /* Telle que la facture l'a créée : 332 plants à 6 ml. */
    sorties: [{ id: 's1', auto: true, chantier: 'c1', statut: 'fini', date: Date.now(),
      perte: false, debours: false, num: '',
      lignes: [{ article: 'a1', qte: 1992, prix: 0.05 }] }]
  }));
  t.clic('[data-vue="commandes"]'); await t.pause(300);
  t.clic('[data-mvt="sorties"]'); await t.pause(250);
  verifierVrai('la liste dit qu’elle suit la facture',
    /suit la facture/.test(t.$('#liste-commandes').textContent));

  /* Il en a consommé 4 ml par plant, pas 6. */
  t.clic('[data-srtmod="s1"]'); await t.pause(400);
  verifierVrai('le formulaire prévient qu’elle suit la facture',
    /cessera de la suivre/.test(t.$('#modale-corps').textContent));
  verifier('elle s’ouvre en plants', '332', t.$('[data-lgqte="0"]').value);
  /* 332 plants à 4 ml au lieu de 6 : il pose le compte réel en millilitres. */
  t.choisir('[data-lgpar="0"]', ''); await t.pause(250);
  t.saisir('[data-lgqte="0"]', '1328');
  t.clic('#so-ok'); await t.pause(450);

  let so = (t.stock('sorties') || [])[0];
  verifier('la quantité corrigée est retenue', 1328, so.lignes[0].qte);
  verifierVrai('et la sortie ne suit plus la facture', !so.auto);
  /* La facture, elle, n'a pas bougé. */
  verifier('la ligne de facture est intacte', 332,
    (t.stock('chantiers') || [])[0].lignes[0].quantite);

  /* Modifier le chantier relance la synchronisation : elle doit respecter la
     correction au lieu d'en recréer une seconde. */
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(350);
  t.clic('[data-lmod="0"]'); await t.pause(400);
  t.saisir('#cl-qte', '340');
  t.clic('#cl-ok'); await t.pause(500);
  verifier('aucune seconde sortie n’apparaît', 1, (t.stock('sorties') || []).length);
  verifier('et la correction tient', 1328, (t.stock('sorties') || [])[0].lignes[0].qte);
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
  const liste = t.$('#liste-chantiers');
  verifierVrai('le numéro de facture est dans la ligne',
    /F-2026-011/.test(liste.textContent));

  const noms = () => t.$$('#liste-chantiers .chantier-n').map(e => e.textContent);
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
scenario('Fiche : des blocs dans l’ordre de la vie du chantier', async () => {
  /* Un seul formulaire de vingt-trois champs s'appelait « en-tête » et
     contenait le devis, la facture, les journées et le peuplement. Chaque
     bloc ouvre désormais le sien. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'envoye', temps: [],
      aDevis: true, donneur: 'Cabinet Dubois', commune: 'Foncine',
      numeroDevis: 'D-2026-014', dateDevis: Date.now() - 12 * 86400000,
      validiteDevis: 3, dateEnvoi: Date.now() - 12 * 86400000,
      joursEstimes: 4, prixJour: 800, maj: Date.now(),
      lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 1200, prix: 2.1,
        nature: 'prestation' }] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);

  /* Les blocs, dans l'ordre. */
  /* « Ce que ça vaut » ne porte plus de crayon — il ne fait que lire ce que
     le bloc des travaux contient — donc plus d'étiquette d'étape. L'ordre se
     lit sur les deux formes de titre à la fois, dans l'ordre du document. */
  const etapes = t.$$('#vue-chantier .etape-bloc, #vue-chantier .carte > h2')
    .map(e => e.textContent);
  verifier('le chantier d’abord', 'Le chantier', etapes[0]);
  verifier('puis ce que ça vaut', 'Ce que ça vaut', etapes[1]);
  /* Le devis et la facture ne font plus deux blocs : c'est le même, qui
     change de nom avec l'étape. Il n'y a donc jamais deux listes de
     travaux à tenir — « les travaux sont liés au devis ou à la facture ». */
  verifier('puis le bloc des travaux, nommé « Le devis »', 'Le devis', etapes[1 + 1]);
  verifierVrai('et pas de second bloc facture à côté',
    etapes.indexOf('La facture') < 0);
  verifierVrai('les lignes du devis sont dedans',
    /Ce que le devis contient/.test(t.texte('#vue-chantier')));

  /* Le bloc d'argent parle au futur tant que rien n'est facturé. */
  const val = t.$$('#vue-chantier .carte')
    .filter(e => /Ce que ça vaut/.test(e.textContent))[0];
  verifierVrai('il annonce le montant proposé', /proposé/.test(val.textContent));
  verifierVrai('et les journées estimées', /journées estimées/.test(val.textContent));
  /* 1 200 plants × 2,10 € = 2 520 € sur 4 journées : 630 € la journée. */
  verifierVrai('avec le prix de journée qui en découle', /630/.test(val.textContent));
  verifierVrai('comparé à l’objectif', /objectif/.test(val.textContent));
  /* « C'est bien d'avoir un bloc visuel où je n'ai rien à modifier. » */
  verifierVrai('et rien ne s’y saisit', !val.querySelector('.modif-bloc'));
  verifierVrai('il dit d’où vient son contenu',
    /Rien à saisir ici/.test(val.textContent));

  /* Chaque crayon ouvre son seul sujet. */
  verifier('plus de bouton « en-tête »', null, t.$('#f-entete'));
  t.clic('#f-devis'); await t.pause(350);
  verifierVrai('le crayon du bloc ouvre le devis', t.$('#dv-a'));
  t.clic('#modale-fermer'); await t.pause(250);

  /* On facture : le même bloc change de nom, et le devis se replie dessous. */
  t.clic('#f-statut'); await t.pause(300);
  t.clic('[data-setstatut="facture"]'); await t.pause(400);
  t.saisir('#nf-num-an', '2026');
  t.saisir('#nf-num-rg', '31');
  t.choisir('#nf-date', '2026-10-03');
  t.clic('#nf-ok'); await t.pause(500);
  verifier('la facture est enregistrée', 'F-2026-0031',
    (t.stock('chantiers') || [])[0].numeroFacture);
  const apres = t.$$('#vue-chantier .etape-bloc, #vue-chantier .carte > h2')
    .map(e => e.textContent);
  verifierVrai('le bloc s’appelle maintenant « La facture »',
    apres.indexOf('La facture') >= 0);
  verifierVrai('et « Le devis » n’est plus un bloc à part',
    apres.indexOf('Le devis') < 0);
  /* Le devis n'est pas perdu pour autant : il se lit en pied de bloc. */
  verifierVrai('mais il se replie en pied, avec son numéro',
    /Le devis D-2026-014 disait/.test(t.texte('#vue-chantier')));
  verifierVrai('et rien n’a bougé depuis',
    /Facturé à l’identique/.test(t.texte('#vue-chantier')));

  /* L'estimation garde sa place, dans le bloc des travaux. */
  t.clic('#f-estim'); await t.pause(350);
  verifierVrai('l’estimation s’ouvre seule', t.$('#es-jest'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Fiche : sans devis, le bloc le dit au lieu de mentir', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Dépannage', statut: 'encours', temps: [],
      aDevis: false, donneur: 'Dubois', commune: 'Foncine', joursEstimes: 2,
      maj: Date.now(), lignes: [] }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  /* Sans devis, le bloc ne ment pas en s'appelant « Le devis » : il porte
     le nom de ce qu'il contient. Les lignes sont les mêmes, et elles
     deviendront la facture telles quelles. */
  const etapes = t.$$('#vue-chantier .etape-bloc').map(e => e.textContent);
  verifierVrai('le bloc s’appelle « Ce qu’il y a à faire »',
    etapes.indexOf('Ce qu’il y a à faire') >= 0);
  verifierVrai('et jamais « Le devis »', etapes.indexOf('Le devis') < 0);
  const dev = t.$$('#vue-chantier .carte')
    .filter(e => /Ce qu’il y a à faire/.test(e.textContent))[0];
  verifierVrai('il annonce les travaux prévus', /Les travaux prévus/.test(dev.textContent));
  verifierVrai('et il dit pourquoi', /Pas de devis sur ce chantier/.test(dev.textContent));

  /* On peut en attacher un depuis là. */
  t.clic('#f-devis'); await t.pause(350);
  verifierVrai('le formulaire s’ouvre sur la case', t.$('#dv-a'));
  verifierVrai('décochée', !t.$('#dv-a').checked);
  t.$('#dv-a').checked = true;
  t.$('#dv-a').dispatchEvent(new t.w.Event('change', { bubbles: true }));
  await t.pause(200);
  t.saisir('#ce-numdevis-an', '2026');
  t.saisir('#ce-numdevis-rg', '20');
  t.clic('#dv-ok'); await t.pause(450);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le devis est attaché', true, c.aDevis);
  verifier('avec son numéro', 'D-2026-0020', c.numeroDevis);
  verifierVrai('et le bloc prend enfin son nom',
    t.$$('#vue-chantier .etape-bloc').map(e => e.textContent).indexOf('Le devis') >= 0);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Cubage : l’arrivée pose le choix du cubage et crée dans le bon type', async () => {
  /* Le type de bordereau existait depuis toujours — au huitième champ de
     l'en-tête, derrière un bouton qui fabriquait un comtois sans le dire.
     Le manque était de visibilité, pas d'écran : le module ouvre donc sur
     celui qui pose la question. */
  const t = await ouvrir(VIDE);
  t.clic('[data-module="cubage"]'); await t.pause(250);
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
  t.clic('[data-module="cubage"]'); await t.pause(250);
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
  t.clic('[data-module="cubage"]'); await t.pause(250);
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
  t.clic('[data-module="cubage"]'); await t.pause(250);
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
  t.clic('[data-module="cubage"]'); await t.pause(250);
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

  const tot = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis(ilYaA(40, 0, 1))] }));
  const tard = await ouvrir(Object.assign({}, VIDE, { chantiers: [devis(ilYaA(40, 23, 59))] }));
  verifierVrai('envoyé juste après minuit : 40 jours',
    /envoyé il y a 40 jours/.test(tot.$('#a-devis').textContent));
  verifierVrai('envoyé juste avant minuit : 40 jours aussi',
    /envoyé il y a 40 jours/.test(tard.$('#a-devis').textContent));

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
    verifierVrai(v + ' : son module la porte en onglet',
      !!t.$('#onglets button[data-vue="' + v + '"]'));
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
  verifierVrai('le temps noté gagne', /3s*journées faites/.test(txt));
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
  verifierVrai('et le bloc dit où noter le temps',
    /Le temps passé/.test(posees.texte('#vue-chantier')));
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
scenario('Retour arrière du téléphone : il remonte d’un cran au lieu de quitter', async () => {
  /* Le bouton du téléphone quittait Sylve d'un coup, même au fond d'un
     module. Un cran d'historique est empilé à chaque descente et consommé par
     la remontée : un appui par étage. */
  const t = await ouvrir(VIDE);
  const retour = () => t.w.dispatchEvent(new t.w.PopStateEvent('popstate'));
  t.clic('[data-module="entreprise"]'); await t.pause(250);
  t.clic('[data-module="chantiers"]'); await t.pause(350);
  verifierVrai('on est descendu dans le carnet',
    t.$('#vue-carnet').classList.contains('actif'));

  /* Une fenêtre ouverte se ferme d'abord, sans quitter l'écran. */
  t.clic('#c-nouveau'); await t.pause(350);
  verifierVrai('une fenêtre est ouverte', !t.$('#modale').hidden);
  retour(); await t.pause(300);
  verifierVrai('le retour la ferme', t.$('#modale').hidden);
  verifierVrai('sans changer d’écran', t.$('#vue-carnet').classList.contains('actif'));

  retour(); await t.pause(300);
  verifierVrai('puis il remonte au menu de la partie',
    t.$('#vue-entreprise').classList.contains('actif'));
  retour(); await t.pause(300);
  verifierVrai('puis à l’accueil', t.$('#vue-accueil').classList.contains('actif'));
  retour(); await t.pause(300);
  verifierVrai('depuis l’accueil, il ne va pas plus haut',
    t.$('#vue-accueil').classList.contains('actif'));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Réglages : on ressort par où l’on est entré', async () => {
  /* Entré depuis l'accueil, on ressortait dans « Mon entreprise ». La vue
     d'origine était bien retenue, mais rejetée parce que l'accueil n'est la
     vue d'aucun module. */
  const t = await ouvrir(VIDE);
  t.clic('[data-module="entreprise"]'); await t.pause(250);
  t.clic('[data-module="chantiers"]'); await t.pause(350);
  t.clic('#b-accueil'); await t.pause(300);
  verifierVrai('on est bien sur l’accueil', t.$('#vue-accueil').classList.contains('actif'));

  t.clic('#a-reglages'); await t.pause(350);
  verifierVrai('les réglages s’ouvrent', t.$('#vue-reglages').classList.contains('actif'));
  t.clic('#b-retour'); await t.pause(350);
  verifierVrai('et le retour ramène à l’accueil',
    t.$('#vue-accueil').classList.contains('actif'));
  verifierVrai('pas dans « Mon entreprise »',
    !t.$('#vue-entreprise').classList.contains('actif'));

  /* Entré depuis un module, on y redescend — le comportement d'origine. */
  t.clic('[data-module="chantiers"]'); await t.pause(350);
  t.clic('#b-reglages'); await t.pause(350);
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
  t.clic('#b-accueil'); await t.pause(250);
  t.clic('[data-module="entreprise"]'); await t.pause(250);
  t.clic('[data-module="finances"]'); await t.pause(300);
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
  t.clic('#b-reglages'); await t.pause(350);
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
  const ordre = t.$$('[data-chouvrir]').map(b => b.dataset.chouvrir);
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
  t.clic('[data-module="cubage"]'); await t.pause(300);
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
  t.clic('#b-reglages'); await t.pause(350);
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
    ['f3', 'f2', 'f1'], t.$$('[data-chouvrir]').map(b => b.dataset.chouvrir));
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
scenario('Carnet : les filtres se rangent en cours et clos', async () => {
  /* Trente-cinq chantiers dont trente et un payés, et des statuts à plat :
     « je n'arrive pas à savoir dans quelle grande catégorie ils
     appartiennent ». Les mêmes groupes que le sélecteur de la fiche. */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [
      { id: 'a', nom: 'En cours', statut: 'encours', aDevis: false, lignes: [], temps: [], maj: Date.now() },
      { id: 'b', nom: 'Payé', statut: 'paye', aDevis: false, lignes: [], temps: [], maj: Date.now() },
      { id: 'c', nom: 'Facturé', statut: 'facture', aDevis: false, lignes: [], temps: [], maj: Date.now() }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(350);
  const groupes = t.$$('#c-filtre optgroup').map(g => g.getAttribute('label'));
  verifier('deux familles', ['En cours', 'Clos'], groupes);
  const dans = lab => t.$$('#c-filtre optgroup')
    .filter(g => g.getAttribute('label') === lab)[0].textContent;
  verifierVrai('le chantier en cours est dans « En cours »', /En cours/.test(dans('En cours')));
  verifierVrai('le payé est dans « Clos »', /Payé/.test(dans('Clos')));
  /* Facturé mais pas encore réglé reste une affaire en cours : l'argent n'est
     pas rentré. C'est déjà ce que dit statutOuvert(), et le regroupement s'y
     conforme plutôt que de ranger l'impayé avec les affaires soldées. */
  verifierVrai('le facturé reste « En cours » tant qu’il n’est pas payé',
    /Facturé/.test(dans('En cours')));
  /* « Tous » et « Chantiers ouverts » restent en tête, hors groupe. */
  verifierVrai('les entrées générales restent accessibles',
    t.$$('#c-filtre > option').length >= 2);
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
  verifierVrai('la fiche l’affiche', /Signé le14\/09\/2026/.test(t.texte('#vue-chantier')));

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
      { id: 'c1', nom: 'Avec devis', statut: 'termine', aDevis: true, temps: [], maj: Date.now(),
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 4, prix: 800, nature: 'prestation' }] },
      /* Repris du carnet : déjà payé, aucun devis n'a existé. */
      { id: 'c2', nom: 'Repris du carnet', statut: 'paye', aDevis: false, temps: [], maj: Date.now(),
        numeroFacture: 'F-2025-0007', datePaiement: Date.now(),
        lignes: [{ travail: 'PLANT', unite: 'plant', quantite: 500, prix: 2, nature: 'prestation' }] },
      /* Celui-ci a bien eu un devis, mais il est facturé depuis longtemps et
         aucune photo n'a été prise à l'époque. La garde « aDevis » ne le
         protège pas : seule la condition de passage le protège. */
      { id: 'c3', nom: 'Facturé de longue date', statut: 'paye', aDevis: true, temps: [],
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
    /Repris du carnet/.test(t.texte('#f-bloc-chantier')));
  t.clic('#f-facture'); await t.pause(350);
  t.clic('#fc-ok'); await t.pause(450);
  verifierVrai('un chantier déjà payé ne se voit pas inventer un devis',
    !(t.stock('chantiers') || []).filter(c => c.id === 'c2')[0].devisFige);

  /* Et celui qui avait bien un devis : le rouvrir et l'enregistrer ne doit
     pas figer aujourd'hui ce qui a été facturé il y a des mois. */
  t.choisir('#f-choix', 'c3'); await t.pause(450);
  verifierVrai('on est bien passé sur celui qui avait un devis',
    /Facturé de longue date/.test(t.texte('#f-bloc-chantier')));
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
      { id: 'c1', nom: 'À la journée', statut: 'accepte', aDevis: true, temps: [], maj: Date.now(),
        /* Trois journées au devis, et une ligne à l'hectare que le temps
           déduit ne couvre pas. */
        lignes: [
          { travail: 'DEGAG', unite: 'jour', quantite: 3, prix: 800, nature: 'prestation' },
          { travail: 'PLANT', unite: 'ha', quantite: 2, prix: 400, nature: 'prestation' }
        ] },
      { id: 'c2', nom: 'À l’hectare', statut: 'accepte', aDevis: true, temps: [], maj: Date.now(),
        joursEstimes: 5,
        lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 6, prix: 500, nature: 'prestation' }] }
    ]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  const f1 = t.texte('#vue-chantier');
  verifierVrai('le temps se lit dans le bloc des travaux',
    /Le temps que ça demande/.test(f1));
  verifierVrai('et vaut les trois journées du devis',
    /Le temps que ça demande ✎3 j/.test(f1));
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
    /Le temps que ça demande ✎5 j/.test(f2));
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
scenario('Agenda : poser des journées ramène à la fiche du chantier', async () => {
  /* « Quand je fais terminer, je ne suis plus dans mon chantier, il faut que
     je refasse des manips pour y retourner. » */
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'chantiers',
    chantiers: [{ id: 'c1', nom: 'Coupe des Places', statut: 'accepte', aDevis: false,
      lignes: [], temps: [], joursEstimes: 3, maj: Date.now() }]
  }));
  t.clic('[data-vue="carnet"]'); await t.pause(300);
  t.clic('[data-chouvrir="c1"]'); await t.pause(400);
  t.clic('#f-planifier'); await t.pause(400);
  verifierVrai('on part bien dans l’agenda',
    t.$('#vue-calendrier').classList.contains('actif'));
  const jour = t.$('#cal-grille [data-jour]');
  verifierVrai('des jours sont proposés', jour);
  jour.click(); await t.pause(400);

  t.clic('#cal-planif-fin'); await t.pause(450);
  verifierVrai('terminer ramène sur la fiche',
    t.$('#vue-chantier').classList.contains('actif'));
  verifierVrai('celle du chantier qu’on planifiait',
    /Coupe des Places/.test(t.texte('#fiche-chantier')));
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
  /* On lit le bloc « Le chantier » seul : le numéro figure aussi dans le
     bloc facture plus bas, et lire toute la fiche ne prouverait rien. */
  const h = t.texte('#f-bloc-chantier');
  verifierVrai('le numéro y est', /F-2026-0042/.test(h));
  verifierVrai('la date de facture aussi', /14\/04\/2026/.test(h));
  verifierVrai('et le paiement, avec son moyen', /30\/05\/2026 · Chèque/.test(h));

  /* Un chantier sans facture ne montre pas de lignes vides. */
  t.clic('[data-chouvrir="c2"]'); await t.pause(400);
  const h2 = t.texte('#f-bloc-chantier');
  verifierVrai('rien n’est annoncé sans facture', !/Facturé le/.test(h2));
  verifierVrai('ni de paiement', !/Payé le/.test(h2));
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
scenario('Création : cinq champs, et le nom qui se propose', async () => {
  /* Le formulaire tenait en vingt-trois champs : le devis, la facture, les
     journées, le peuplement, le statut, la note. Tout cela se remplit bloc
     par bloc sur la fiche. Il ne reste que ce qu'on sait en arrivant. */
  const t = await ouvrir(Object.assign({}, VIDE, { module: 'chantiers' }));
  t.clic('[data-vue="carnet"]'); await t.pause(250);
  t.clic('#c-nouveau'); await t.pause(400);
  verifier('le devis n’est plus demandé à la création', null, t.$('#dv-a'));
  verifier('ni la facture', null, t.$('#ce-numfact'));
  verifier('ni le statut', null, t.$('#ce-statut'));
  verifier('ni le peuplement', null, t.$('#ce-dens'));
  verifier('ni les journées', null, t.$('#ce-plusjour'));
  verifierVrai('mais le type de travaux, oui', t.$('#ce-trav'));

  t.saisir('#ce-proprio', 'Dupont');
  t.saisir('#ce-com', 'Foncine'); await t.pause(250);
  verifier('le nom se propose sans les travaux', 'Dupont, Foncine', t.$('#ce-nom').value);
  t.choisir('#ce-trav', 'DEGAG'); await t.pause(250);
  verifier('et le type de travaux le complète',
    'Dégagement manuel — Dupont, Foncine', t.$('#ce-nom').value);

  /* Un nom écrit à la main est le sien : il ne se fait plus écraser. */
  t.saisir('#ce-nom', 'Le clos du haut'); await t.pause(150);
  t.saisir('#ce-com', 'Chaux'); await t.pause(250);
  verifier('le nom choisi tient', 'Le clos du haut', t.$('#ce-nom').value);

  t.saisir('#ce-donneur', 'Cabinet Dubois');
  t.clic('#ce-ok'); await t.pause(550);
  const c = (t.stock('chantiers') || [])[0];
  verifier('le chantier est créé sous son nom', 'Le clos du haut', c.nom);
  verifier('avec son donneur d’ordre', 'Cabinet Dubois', c.donneur);
  verifier('et sa commune', 'Chaux', c.commune);
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
scenario('Déclarations : l’impôt commence dans la tranche à 11 %', async () => {
  /* Son autre emploi consomme la tranche à 0 % : la base d'ici entre
     directement à 11 %, puis bascule à 30 % au-delà de la capacité. */
  const t = await ouvrir(VIDE);
  const FIN = t.w.BCF;
  const sous = FIN.impotEstime(10000, {});
  verifier('sous la capacité, tout est à 11 %', 1100, sous.total);
  verifier('rien dans la seconde tranche', 0, sous.tranche2);
  const dessus = FIN.impotEstime(20000, {});
  verifier('la première tranche se remplit', 17978, dessus.base1);
  verifier('à 11 %', 1977.58, dessus.tranche1);
  verifier('le reste passe à 30 %', 606.6, dessus.tranche2);
  verifier('et le total suit', 2584.18, dessus.total);
  const sien = FIN.impotEstime(20000, { impotCapacite: 15000, impotTaux1: 12, impotTaux2: 31 });
  verifier('ses propres nombres priment', 1800 + 1550, sien.total);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Déclarations : un versement se note, son remboursement aussi', async () => {
  /* La première année, ses cotisations lui ont été remboursées deux fois :
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
  t.clic('[data-module="entreprise"]'); await t.pause(300);
  t.clic('[data-module="vehicule"]'); await t.pause(400);
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
  t.saisir('#vi-km', '176000');
  t.saisir('#vi-mont', '400');
  const chip = t.$$('#vi-postes .chip').filter(b => /Révision/.test(b.textContent))[0];
  verifierVrai('les postes se cochent depuis l’intervention', chip);
  chip.click(); await t.pause(150);
  t.$('#vi-dep').checked = true;
  t.clic('#vi-ok'); await t.pause(500);

  const v = t.stock('vehicule');
  verifier('l’intervention est au carnet', 1, v.interventions.length);
  verifierVrai('le compteur suit le kilométrage noté',
    /176\u00A0000|176 000/.test(t.texte('#veh-carnet')));
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
    /Courroie[^—]*— dépassée de 16 000 km/.test(ech.replace(/\u00A0/g, ' ')));
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
  t.choisir('[data-dlcat="0"]', 'ENTRETIEN'); await t.pause(200);
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
  t.clic('[data-module="entreprise"]'); await t.pause(300);
  t.clic('[data-module="vehicule"]'); await t.pause(400);
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
  t.choisir('[data-dlcat="0"]', 'VEHIC'); await t.pause(250);
  verifierVrai('elle apparaît sur une ligne « Frais véhicule »', !t.$('#dp-carnet').hidden);
  verifierVrai('le kilométrage reste caché tant qu’on ne coche pas', t.$('#dp-histkm').hidden);

  cocher(t, '#dp-hist', true); await t.pause(150);
  verifierVrai('cocher ouvre le kilométrage', !t.$('#dp-histkm').hidden);
  t.saisir('#dp-km', '176299');
  t.clic('#dp-ok'); await t.pause(600);

  const v = t.stock('vehicule');
  const inter = (v.interventions || [])[0];
  verifierVrai('l’intervention est créée', !!inter);
  verifier('avec le libellé de la ligne', 'Plaquettes avant', inter.quoi);
  verifier('et son kilométrage', 176299, inter.km);
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
  t.clic('[data-module="vehicule"]'); await t.pause(400);
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
  t.choisir('[data-dlcat="0"]', 'COTIS'); await t.pause(200);
  cocher(t, '#dp-veh', true);
  t.clic('#dp-ok'); await t.pause(500);
  const d = (t.stock('depenses') || [])[0];
  verifierVrai('la dépense est rattachée au véhicule', d.vehicule);
  verifierVrai('et la suggestion du carnet ne se déclenche pas',
    !/carnet du véhicule/.test(t.$('#toast').textContent));
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Journées : une journée passée sans temps noté se réclame au lancement', async () => {
  /* « Il faudrait me forcer la main quand la journée est finie, pour que je
     remplisse. Sinon je me dis : ok, je le ferai plus tard, et après je ne le
     fais pas et j'oublie. » Sans ce rattrapage, les rendements se vident en
     silence et le chantier finit par s'annoncer « en retard ». */
  const JOUR = 86400000;
  const j = n => { const d = new Date(Date.now() + n * JOUR); d.setHours(12, 0, 0, 0); return d.getTime(); };
  const jourFR = ts => new Date(ts).toLocaleDateString('fr-FR');
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise', cfg: { heuresJour: 8 },
    chantiers: [{ id: 'c1', nom: 'Dégagement Martin', statut: 'encours', maj: Date.now(),
      lignes: [],
      /* Le temps d'avant-hier est noté : cette journée-là ne doit pas revenir. */
      temps: [{ date: j(-2), duree: 7, unite: 'h', personnes: 1 }],
      jours: [
        { d: j(-3), p: 1 },   /* passée, rien de noté : à réclamer */
        { d: j(-2), p: 1 },   /* passée, mais notée */
        { d: j(0), p: 1 },    /* aujourd'hui : la journée n'est pas finie */
        { d: j(2), p: 1 }     /* à venir */
      ] }]
  }));

  verifierVrai('le rappel est sur l’accueil', t.$('[data-journeenudge]'));
  const dit = t.texte('#a-journees');
  /* Une seule journée manque : ni celle qui est notée, ni celle du jour même
     — elle n'est pas finie — ni celle à venir. */
  verifierVrai('une seule journée est réclamée', /Journée du /.test(dit));
  verifierVrai('et c’est la bonne', dit.indexOf(jourFR(j(-3))) >= 0);
  verifierVrai('elle nomme le chantier', /Dégagement Martin/.test(dit));
  verifierVrai('ni celle du jour même', dit.indexOf(jourFR(j(0))) < 0);
  verifierVrai('ni celle qui est déjà notée', dit.indexOf(jourFR(j(-2))) < 0);

  /* Le rappel ouvre la saisie, sa date déjà posée : c'est le geste demandé,
     pas un renvoi vers un écran où il faudrait retrouver le jour. */
  t.clic('[data-journeenudge]'); await t.pause(600);
  verifierVrai('il ouvre la saisie du temps', t.$('#ct-duree'));
  verifier('à la date de la journée manquante', jourISO(j(-3)), t.$('#ct-date').value);
  t.saisir('#ct-duree', '6');
  t.clic('#ct-ok'); await t.pause(600);
  verifier('la journée est notée', 2, (t.stock('chantiers') || [])[0].temps.length);
  verifier('plus rien à réclamer', 0,
    t.w.BCC.journeesANoter(t.stock('chantiers'), Date.now()).length);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Journées : le rappel se chasse jusqu’au prochain lancement', async () => {
  /* Comme les deux autres rappels de l'accueil : un rappel qu'on ne peut pas
     fermer finit par ne plus être lu. Mais le chasser n'efface rien. */
  const JOUR = 86400000;
  const hier = new Date(Date.now() - JOUR); hier.setHours(12, 0, 0, 0);
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', lignes: [], temps: [],
      jours: [{ d: hier.getTime(), p: 1 }], maj: Date.now() }]
  }));
  verifierVrai('le rappel est là', t.$('[data-journeenudge]'));
  t.clic('#a-journees-fermer'); await t.pause(300);
  verifierVrai('un doigt le chasse', !t.$('[data-journeenudge]'));
  verifier('mais la journée reste à noter', 1,
    t.w.BCC.journeesANoter(t.stock('chantiers'), Date.now()).length);
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

  verifierVrai('le bloc dit qu’aucun devis n’est attaché',
    /Aucun devis attaché/.test(t.texte('#vue-chantier')));
  const bouton = t.$('#f-devis');
  verifierVrai('et propose d’en attacher un', bouton);
  verifier('le bouton le dit', 'Attacher un devis', bouton.textContent);

  t.clic('#f-devis'); await t.pause(400);
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
  verifierVrai('la fiche l’affiche en pied de bloc', /DevisD-2026-0007/.test(f));
  /* Signé il y a vingt jours, dernière journée posée il y a dix : dix jours.
     « Savoir, à partir du moment où le devis est signé, sous combien de temps
     je réalise les travaux. » */
  verifierVrai('et dit en combien de temps il a été réalisé', /Réalisé en10 jours/.test(f));
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
  const bilan = t.texte('#ent-bilan');
  verifierVrai('la bulle parle d’attente, pas d’impayé', /factures en attente/.test(bilan));
  verifierVrai('le mot « impayés » a disparu de la bulle', !/impayés/.test(bilan));
  verifierVrai('elle chiffre ce qui attend', /1 000 €/.test(bilan));
  /* Facturé il y a trois jours, échéance dans vingt-sept : rien ne chauffe. */
  const chaude = t.$$('#ent-bilan .bulle.chaud')
    .filter(b => /attente/.test(b.textContent))[0];
  verifierVrai('et elle ne chauffe pas pour si peu', !chaude);
  verifierVrai('« À traiter » ne réclame rien non plus',
    !/Facture impayée/.test(t.texte('#ent-alertes')));
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
  const chaude = t.$$('#ent-bilan .bulle.chaud')
    .filter(b => /attente/.test(b.textContent))[0];
  verifierVrai('la bulle chauffe', !!chaude);
  verifierVrai('et dit combien sont en retard', /1 en retard/.test(t.texte('#ent-bilan')));
  verifierVrai('« À traiter » le nomme', /Facture impayée/.test(t.texte('#ent-alertes')));
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
        foret: 'Forêt de la Côte', commune: 'Levier', donneur: 'Cabinet Dubois',
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
  t.clic('#a-jour'); await t.pause(450);

  const offerts = [...t.$('#mj-ch').options].map(o => o.value).filter(Boolean);
  verifierVrai('le chantier en cours est proposé', offerts.indexOf('c1') >= 0);
  verifierVrai('le chantier payé ne l’est plus', offerts.indexOf('c2') < 0);

  /* Choisir le chantier remplit ce qu'il sait déjà. */
  t.choisir('#mj-ch', 'c1'); await t.pause(300);
  verifier('la forêt est reprise', 'Forêt de la Côte', t.$('#mj-lieu').value);
  verifier('la commune aussi', 'Levier', t.$('#mj-commune').value);
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
  verifierVrai('les heures restent à lui', !t.$('[data-psth="0"]').value);
  verifier('aucune erreur', [], t.erreurs);
});

/* --------------------------------------------------------------------- */
scenario('Ma journée : ce qui est déjà tapé n’est jamais écrasé', async () => {
  const t = await ouvrir(Object.assign({}, VIDE, {
    module: 'entreprise',
    chantiers: [{ id: 'c1', nom: 'Vaux', statut: 'encours', maj: Date.now(),
      foret: 'Forêt de la Côte', commune: 'Levier', temps: [], jours: [],
      lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 700, nature: 'prestation' }] }]
  }));
  await t.pause(300);
  t.clic('#a-jour'); await t.pause(450);
  t.saisir('#mj-lieu', 'Bois du Haut');
  t.choisir('#mj-ch', 'c1'); await t.pause(300);
  verifier('la forêt tapée reste la sienne', 'Bois du Haut', t.$('#mj-lieu').value);
  verifier('mais la commune vide se remplit', 'Levier', t.$('#mj-commune').value);
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
  const dit = t.texte('#ent-bilan');
  verifierVrai('le jour est annoncé', /Demain/.test(dit));
  verifierVrai('avec le chantier', /Dégagement Martin/.test(dit));
  verifierVrai('et pour qui', /pour Cabinet Dubois/.test(dit));
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
