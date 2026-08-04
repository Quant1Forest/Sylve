/* Fabrique Sylve.html à partir de index.html.
 *
 * Les deux fichiers sont le même, à deux lignes près : les <link> du
 * manifeste et de l'icône, qui n'ont aucun sens hors du dossier publié.
 * Ce script existe parce que la copie à la main a déjà été oubliée une
 * fois, et qu'un Sylve.html en retard sur l'application est un piège
 * silencieux — il s'ouvre, il marche, et il ment sur la version.
 *
 *   node outils/construire.js
 */

var fs = require('fs');
var path = require('path');

var racine = path.join(__dirname, '..');
var source = path.join(racine, 'index.html');
var cible = path.join(racine, 'Sylve.html');

var A_RETIRER = [
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="icon" href="icone-192.png" sizes="192x192" type="image/png">'
];

var lignes = fs.readFileSync(source, 'utf8').split('\n');
var retirees = 0;
var gardees = lignes.filter(function (l) {
  if (A_RETIRER.indexOf(l.trim()) >= 0) { retirees++; return false; }
  return true;
});

if (retirees !== A_RETIRER.length) {
  console.error('\n  ✕ ' + retirees + ' ligne(s) retirée(s) sur ' + A_RETIRER.length +
    ' attendues.\n    L\'en-tête de index.html a changé : mettez A_RETIRER à jour.\n');
  process.exit(1);
}

fs.writeFileSync(cible, gardees.join('\n'));

var v = (fs.readFileSync(source, 'utf8').match(/VERSION = '([^']+)'/) || [])[1];
console.log('\n  ✓ Sylve.html reconstruit en ' + v +
  ' (' + Math.round(fs.statSync(cible).size / 1024) + ' Ko)\n');
