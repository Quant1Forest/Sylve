#!/usr/bin/env node
/* =====================================================================
   Sylve — le contrôle de livraison, étape par étape et chronométré.

   Remplace la chaîne « a && b && c » de package.json : même ordre, même
   arrêt à la première étape qui échoue, avec en plus le temps de chacune.
   Les options passées après « -- » vont aux scénarios :

     npm run controle                    # parallèle (par défaut)
     npm run controle -- --sequentiel    # un scénario après l'autre
     npm run controle -- --durees        # où le temps passe

   ===================================================================== */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const OPTIONS = process.argv.slice(2);
const ETAPES = [
  ['fabrication', 'construire.js', []],
  ['vérificateur', 'verifier.js', []],
  ['service worker', 'tests-sw.js', []],
  ['scénarios', 'tests.js', OPTIONS],
  ['fichier autonome', 'comparer.js', []]
];

const sec = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const debut = Date.now();
const durees = [];

for (const [nom, fichier, args] of ETAPES) {
  const depart = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, fichier)].concat(args), { stdio: 'inherit' });
  durees.push([nom, Date.now() - depart]);
  if (r.status !== 0) {
    console.log('\n✕ étape « ' + nom + ' » en échec (' +
      (r.status === null ? 'interrompue' + (r.signal ? ', signal ' + r.signal : '') : 'code ' + r.status) + ').');
    process.exit(r.status || 1);
  }
}

console.log('\n' + '─'.repeat(52) + '\nDurée du contrôle');
durees.forEach(d => console.log('  ' + sec(d[1]).padStart(8) + '  ' + d[0]));
console.log('  ' + sec(Date.now() - debut).padStart(8) + '  total');
