#!/usr/bin/env node
/* =====================================================================
   Sylve — le contrôle de livraison, étape par étape et chronométré.

   Remplace la chaîne « a && b && c » de package.json : même ordre, même
   arrêt à la première étape qui échoue, avec en plus le temps de chacune.
   Les options passées après « -- » vont aux scénarios :

     npm run controle                    # parallèle (par défaut)
     npm run controle -- --sequentiel    # un scénario après l'autre
     npm run controle -- --durees        # où le temps passe
     npm run controle -- --dates         # en plus, les scénarios du temps
                                         # au 1er et au dernier jour du mois

   ===================================================================== */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

/* « --dates » est au contrôle, pas aux scénarios : il ne leur est pas passé. */
const DATES = process.argv.indexOf('--dates') >= 0;
const OPTIONS = process.argv.slice(2).filter(a => a !== '--dates');
/* Les scénarios qui touchent au temps, rejoués le 1er et le dernier jour d'un
   mois : l'Agenda n'affiche qu'un mois, et « il y a deux jours » tombe dans le
   précédent le 1er et le 2 (10 vérifications rouges le 1er novembre, lot 5b3).
   Toute la suite y passe aussi (vérifié au lot c1), mais en triplerait la
   durée : on ne rejoue que ce qui lit le calendrier. Même ainsi, elles
   portaient le contrôle de 3 à 7 minutes : elles se jouent sur demande
   (« --dates », décidé le 01/11), avant un lot qui touche à l'Agenda. */
const SENSIBLES_A_LA_DATE = '--motif=calendrier|agenda|journée|journees|journées|aujourd|trancher|placer|' +
  'placement|fiche du jour|bientôt|retard|prélèvement|échéance|' +
  /* Lot d1 : Argent ▸ Mois borne tout au mois affiché, et sa ligne MSA dit
     « à venir » selon le jour du mois. */
  'argent ▸ mois';
const ETAPES = [
  ['fabrication', 'construire.js', []],
  ['vérificateur', 'verifier.js', []],
  ['service worker', 'tests-sw.js', []],
  ['scénarios', 'tests.js', OPTIONS],
].concat(DATES ? [
  ['scénarios au 1er du mois', 'tests.js', OPTIONS.concat(SENSIBLES_A_LA_DATE), { SYLVE_DATE: '2026-12-01' }],
  ['scénarios au dernier jour du mois', 'tests.js', OPTIONS.concat(SENSIBLES_A_LA_DATE), { SYLVE_DATE: '2026-11-30' }]
] : [], [
  ['largeur (Chrome)', 'largeur.js', []],
  ['fichier autonome', 'comparer.js', []]
]);

const sec = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const debut = Date.now();
const durees = [];

for (const [nom, fichier, args, env] of ETAPES) {
  const depart = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, fichier)].concat(args),
    { stdio: 'inherit', env: Object.assign({}, process.env, env || {}) });
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
