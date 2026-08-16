#!/usr/bin/env node
/* =====================================================================
   Sylve — Sylve.html est-il bien index.html ?

   La suite de tests tournait deux fois : une sur index.html, une sur
   Sylve.html. Or les deux fichiers ne diffèrent que par deux lignes — les
   <link> du manifeste et de l'icône, retirés par construire.js. Rejouer
   quarante scénarios sur un fichier identique, c'est cinq minutes pour
   retester du code déjà testé.

   On prouve la même chose autrement, et en une seconde : les deux fichiers
   sont identiques ligne à ligne aux deux exceptions attendues, et le
   fichier autonome démarre pour de bon.

     node outils/comparer.js
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const racine = path.join(__dirname, '..');
const A_RETIRER = [
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="icon" href="icone-192.png" sizes="192x192" type="image/png">'
];

let erreurs = 0;
const grave = m => { erreurs++; console.log('  ✕ ' + m); };
const bien = m => console.log('  ✓ ' + m);

const src = fs.readFileSync(path.join(racine, 'index.html'), 'utf8').split('\n');
const out = fs.readFileSync(path.join(racine, 'Sylve.html'), 'utf8').split('\n');

/* --- 1. rien d'autre n'a bougé --------------------------------------- */
console.log('\n1. Le fichier autonome face à l’application');
const attendu = src.filter(l => A_RETIRER.indexOf(l.trim()) < 0);
const retirees = src.length - attendu.length;

if (retirees !== A_RETIRER.length) {
  grave(`${retirees} ligne(s) retirée(s) de index.html sur ${A_RETIRER.length} attendues — ` +
    `l’en-tête a changé, mettez A_RETIRER à jour dans construire.js et ici`);
} else if (attendu.length !== out.length) {
  grave(`Sylve.html fait ${out.length} lignes, on en attendait ${attendu.length} — ` +
    `il est en retard sur index.html, relancez « npm run construire »`);
} else {
  let ecart = -1;
  for (let i = 0; i < attendu.length; i++) {
    if (attendu[i] !== out[i]) { ecart = i; break; }
  }
  if (ecart >= 0) {
    grave(`les deux fichiers divergent à la ligne ${ecart + 1} de Sylve.html :\n` +
      `      attendu : ${attendu[ecart].slice(0, 90)}\n` +
      `      obtenu  : ${out[ecart].slice(0, 90)}`);
  } else {
    bien(`identique à index.html, aux ${A_RETIRER.length} lignes d’en-tête près ` +
      `(${out.length} lignes comparées)`);
  }
}

/* --- 2. et il démarre ------------------------------------------------ */
console.log('\n2. Démarrage du fichier autonome');
if (erreurs) {
  console.log('  ~ passé : les fichiers diffèrent, le démarrage ne prouverait rien');
  console.log('\n' + '─'.repeat(52));
  console.log(`✕ ${erreurs} problème(s) — livraison refusée.`);
  process.exit(1);
}

const html = fs.readFileSync(path.join(racine, 'Sylve.html'), 'utf8');
const bruits = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local/',
  beforeParse(w) {
    for (const k of ['index', 'piles', 'chantiers', 'articles', 'commandes', 'sorties', 'journees'])
      w.localStorage.setItem('bordcub.' + k, '[]');
    w.URL.createObjectURL = () => 'blob:test';
    w.URL.revokeObjectURL = () => {};
    w.Element.prototype.scrollIntoView = function () {};
  }
});
dom.window.addEventListener('error', e => bruits.push(e.message));
dom.window.console.error = (...a) => bruits.push(a.join(' '));

const depart = Date.now();
const sonder = () => {
  const d = dom.window.document;
  const pret = d.body && d.body.getAttribute('data-pret') === '1';
  if (!pret && Date.now() - depart < 8000) { setTimeout(sonder, 20); return; }

  if (!pret) grave('le fichier autonome n’a pas fini de démarrer en 8 s');
  else if (bruits.length) grave('démarrage bruyant : ' + bruits.join(' | ').slice(0, 200));
  else if (!d.querySelector('#vue-accueil')) grave('l’accueil est absent');
  else bien(`démarre sans erreur en ${Date.now() - depart} ms`);

  console.log('\n' + '─'.repeat(52));
  if (erreurs) {
    console.log(`✕ ${erreurs} problème(s) — livraison refusée.`);
    process.exit(1);
  }
  console.log('✓ Sylve.html est conforme.');
  process.exit(0);
};
sonder();
