/* Fabrique index.html à partir de sources/, puis Sylve.html à partir de
 * index.html.
 *
 * index.html : vingt mille lignes qu'aucune séance ne pouvait lire en
 * entier. Il est découpé en morceaux, un par partie de l'application, et
 * sources/assemblage.txt dit dans quel ordre les recoller. Trois gardes,
 * parce qu'une fabrication qui se trompe ne se voit pas : le fichier
 * s'ouvre, il marche, et il a perdu quelque chose.
 *   - Un morceau .js doit se compiler seul : une coupure au milieu d'une
 *     fonction donnerait deux moitiés qui, recollées, passeraient encore.
 *   - Chaque fichier de sources/ est cité une fois dans la liste, et chaque
 *     entrée de la liste existe : un morceau oublié disparaîtrait sans bruit.
 *   - index.html porte une empreinte posée à chaque fabrication. S'il ne la
 *     porte plus, quelqu'un l'a retouché à la main : l'écraser perdrait la
 *     retouche, et le laisser publierait du code que sources/ ne contient pas.
 *
 * Sylve.html : les deux fichiers sont le même, à deux lignes près : les
 * <link> du manifeste et de l'icône, qui n'ont aucun sens hors du dossier
 * publié. La copie à la main a déjà été oubliée une fois, et un Sylve.html
 * en retard sur l'application est un piège silencieux — il s'ouvre, il
 * marche, et il ment sur la version.
 *
 *   node outils/construire.js
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');

var racine = path.join(__dirname, '..');
var source = path.join(racine, 'index.html');
var cible = path.join(racine, 'Sylve.html');
var fEmpreinte = path.join(__dirname, 'empreinte-index.txt');

var A_RETIRER = [
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="icon" href="icone-192.png" sizes="192x192" type="image/png">'
];

/* Un éditeur Windows, ou git avec autocrlf, ajoute des CRLF et une marque
   d'ordre en tête : index.html n'en a jamais contenu, ce ne sont pas des
   retouches. */
function lireTexte(f) {
  return fs.readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

function empreinte(texte) {
  return crypto.createHash('sha256').update(texte, 'utf8').digest('hex');
}

function fichiersDe(dossier, prefixe, out) {
  fs.readdirSync(dossier).forEach(function (n) {
    if (n[0] === '.') return;
    var f = path.join(dossier, n);
    if (fs.statSync(f).isDirectory()) fichiersDe(f, prefixe + n + '/', out);
    else out.push(prefixe + n);
  });
  return out;
}

/* Rend le texte recollé et, pour chaque morceau, la ligne d'index.html où il
   commence : de quoi renvoyer une erreur vers le fichier à corriger. */
function assembler(rac) {
  var dossier = path.join(rac, 'sources');
  var fListe = path.join(dossier, 'assemblage.txt');
  var erreurs = [], sortie = [], morceaux = [], cites = {};
  if (!fs.existsSync(fListe)) return { erreurs: ['sources/assemblage.txt introuvable'] };

  lireTexte(fListe).replace(/\n$/, '').split('\n').forEach(function (l, i) {
    if (l[0] === '#') return;
    if (l[0] !== '@') { sortie.push(l); return; }
    var nom = l.slice(1);
    var f = path.join(dossier, nom);
    if (cites[nom]) { erreurs.push('« ' + nom + ' » est cité deux fois dans sources/assemblage.txt (lignes ' + cites[nom] + ' et ' + (i + 1) + ')'); return; }
    cites[nom] = i + 1;
    if (!fs.existsSync(f)) { erreurs.push('sources/assemblage.txt ligne ' + (i + 1) + ' : « ' + nom + ' » n\'existe pas dans sources/'); return; }
    var texte = lireTexte(f);
    if (/\.js$/.test(nom)) {
      try { new vm.Script(texte, { filename: 'sources/' + nom }); }
      catch (e) {
        erreurs.push('sources/' + nom + ' ne se compile pas seul — ' +
          String(e.stack).split('\n')[0] + ' : ' + e.message + '.\n    ' +
          'Une coupure tombe au milieu d\'un bloc, ou le morceau a une faute de syntaxe.');
      }
    }
    var lignes = texte === '' ? [] : texte.replace(/\n$/, '').split('\n');
    morceaux.push({ fichier: nom, debut: sortie.length + 1, lignes: lignes.length });
    Array.prototype.push.apply(sortie, lignes);
  });

  fichiersDe(dossier, '', []).forEach(function (nom) {
    if (nom !== 'assemblage.txt' && !cites[nom]) {
      erreurs.push('sources/' + nom + ' n\'est cité nulle part dans sources/assemblage.txt : ' +
        'morceau oublié. L\'y ajouter à sa place, ou le supprimer.');
    }
  });

  return { erreurs: erreurs, texte: sortie.join('\n') + '\n', morceaux: morceaux };
}

function ouEst(a, ligne) {
  for (var i = 0; i < a.morceaux.length; i++) {
    var m = a.morceaux[i];
    if (ligne >= m.debut && ligne < m.debut + m.lignes) return 'sources/' + m.fichier + ':' + (ligne - m.debut + 1);
  }
  return 'sources/assemblage.txt';
}

function arreter(lignes) {
  console.error('\n  ✕ ' + lignes.join('\n  ✕ ') + '\n');
  process.exit(1);
}

function fabriquerIndex() {
  var a = assembler(racine);
  if (a.erreurs.length) arreter(a.erreurs.concat(['index.html n\'a pas été fabriqué.']));

  if (fs.existsSync(source)) {
    var actuel = lireTexte(source);
    var posee = fs.existsSync(fEmpreinte) ? fs.readFileSync(fEmpreinte, 'utf8').trim() : null;
    if (actuel !== a.texte && empreinte(actuel) !== posee) {
      var x = actuel.split('\n'), y = a.texte.split('\n'), n = 0;
      while (n < x.length && x[n] === y[n]) n++;
      arreter([
        (posee ? 'index.html a été retouché à la main depuis la dernière fabrication.'
          : 'index.html diffère de sources/, et aucune empreinte ne dit s\'il a été retouché.'),
        'Travaillez dans sources/ : l\'écraser perdrait la retouche, le publier',
        'mettrait en ligne du code que sources/ ne contient pas.',
        'Première ligne qui diffère : ' + (n + 1) + ' (' + ouEst(a, n + 1) + ').',
        'Reporter la retouche dans le morceau, puis relancer. Pour la jeter :',
        'git checkout index.html.'
      ]);
    }
  }

  if (!fs.existsSync(source) || fs.readFileSync(source, 'utf8') !== a.texte) {
    fs.writeFileSync(source, a.texte);
  }
  fs.writeFileSync(fEmpreinte, empreinte(a.texte) + '\n');
  console.log('\n  ✓ index.html fabriqué depuis ' + a.morceaux.length + ' morceaux de sources/ (' +
    (a.texte.split('\n').length - 1) + ' lignes)');
}

function fabriquerAutonome() {
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
  console.log('  ✓ Sylve.html reconstruit en ' + v +
    ' (' + Math.round(fs.statSync(cible).size / 1024) + ' Ko)\n');
}

module.exports = { assembler: assembler, ouEst: ouEst };

if (require.main === module) {
  fabriquerIndex();
  fabriquerAutonome();
}
