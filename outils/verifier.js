#!/usr/bin/env node
/* =====================================================================
   Sylve — contrôle avant livraison
   À lancer avant de produire quoi que ce soit :  node outils/verifier.js
   Il refuse la livraison plutôt que de laisser passer une erreur muette.
   Le bug du bouton « Sortie » d'une pile (deux fonctions ouvrirSortie,
   la seconde écrasant la première sans le moindre avertissement) est
   exactement ce que le premier contrôle attrape.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const VOCABULAIRE = require('./vocabulaire.js');
const racine = process.argv[2] || path.join(__dirname, '..');
const fApp = path.join(racine, 'index.html');
const fSw = path.join(racine, 'sw.js');

let erreurs = 0, avertissements = 0;
const grave = m => { erreurs++; console.log('  ✕ ' + m); };
const tiede = m => { avertissements++; console.log('  ~ ' + m); };
const bien = m => console.log('  ✓ ' + m);

const src = fs.readFileSync(fApp, 'utf8');
const blocs = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const propres = blocs.map(nettoyer);

/* Le texte des commentaires et des chaînes ressemble à du code : on le
   remplace par des blancs avant d'analyser, en gardant les positions. */
function nettoyer(code) {
  let out = '', i = 0, n = code.length;
  const blanc = t => t.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = code[i], d = code[i + 1];
    if (c === '/' && d === '*') {
      const f = code.indexOf('*/', i + 2); const j = f < 0 ? n : f + 2;
      out += blanc(code.slice(i, j)); i = j;
    } else if (c === '/' && d === '/') {
      const f = code.indexOf('\n', i); const j = f < 0 ? n : f;
      out += blanc(code.slice(i, j)); i = j;
    } else if (c === '/' && /[=(,:[!&|?{;]\s*$/.test(out.slice(-3))) {
      /* Une expression régulière peut contenir des guillemets : on la saute
         d'un bloc, sinon tout le code qui suit passe pour une chaîne. */
      let j = i + 1, cro = false;
      while (j < n && (cro || code[j] !== '/')) {
        if (code[j] === '\\') j++;
        else if (code[j] === '[') cro = true;
        else if (code[j] === ']') cro = false;
        else if (code[j] === '\n') break;
        j++;
      }
      j = Math.min(j + 1, n);
      out += blanc(code.slice(i, j)); i = j;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && code[j] !== c) { if (code[j] === '\\') j++; j++; }
      j = Math.min(j + 1, n);
      out += c + blanc(code.slice(i + 1, j - 1)) + (code[j - 1] || '');
      i = j;
    } else { out += c; i++; }
  }
  return out;
}

/* Numéro de ligne dans le fichier complet, pour pouvoir aller voir. */
function ligneDe(bloc, pos) {
  const avant = src.indexOf(bloc);
  return src.slice(0, avant + pos).split('\n').length;
}

/* --- 1. deux fonctions du même nom dans la même portée ---------------- */
console.log('\n1. Doublons de noms');
propres.forEach((b, i) => {
  const vus = new Map();
  for (const m of b.matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const n = m[1];
    if (vus.has(n)) {
      grave(`« ${n} » déclarée deux fois dans le même bloc — lignes ` +
        `${ligneDe(b, vus.get(n))} et ${ligneDe(b, m.index)}. ` +
        `La seconde écrase la première en silence.`);
    } else vus.set(n, m.index);
  }
});
if (!erreurs) bien('aucune fonction déclarée deux fois');

/* --- 2. sélecteurs qui ne visent rien -------------------------------- */
/* Un $('#truc') dont l'identifiant n'existe ni dans la page ni dans le HTML
   fabriqué par le code renvoie null en silence : la fonction s'arrête et
   rien ne se passe à l'écran. C'est ce qui arrive quand on renomme un
   champ sans mettre à jour ceux qui l'appellent. */
console.log('\n2. Sélecteurs');
const idsConnus = new Set();
for (const m of src.matchAll(/\bid="([^"]+)"/g)) idsConnus.add(m[1]);
for (const m of src.matchAll(/\bid=\\?['"]?\s*\+/g)) idsConnus.add('*dynamique*');
for (const m of src.matchAll(/id="([a-z0-9-]+)"\s*\+/g)) idsConnus.add(m[1]);
const vises = new Map();
blocs.forEach((b, i) => {
  for (const m of b.matchAll(/[$]\(['"]#([a-zA-Z0-9_-]+)['"]\)/g))
    if (!vises.has(m[1])) vises.set(m[1], ligneDe(blocs[i], m.index));
  for (const m of b.matchAll(/getElementById\(['"]([a-zA-Z0-9_-]+)['"]\)/g))
    if (!vises.has(m[1])) vises.set(m[1], ligneDe(blocs[i], m.index));
});
let orphelins = 0;
for (const [id, l] of vises) {
  if (idsConnus.has(id)) continue;
  /* Certains identifiants ne naissent que dans du HTML assemblé : on les
     cherche aussi tels quels dans le code. */
  if (src.includes('id="' + id + '"') || src.includes("id=\\'" + id)) continue;
  /* Certains identifiants sont posés par une fonction d'assemblage qui les
     reçoit en paramètre : on accepte de le voir cité tel quel. */
  if (new RegExp("['\"]" + id.replace(/[-]/g, '\\-') + "['\"]").test(src)) continue;
  orphelins++;
  if (orphelins <= 6) tiede(`$('#${id}') ligne ${l} — cet identifiant n'apparaît nulle part`);
}
if (orphelins > 6) tiede(`… et ${orphelins - 6} autres`);
if (!orphelins) bien(`${vises.size} sélecteurs, tous rattachés à un identifiant existant`);

/* --- 3. identifiants HTML en double ---------------------------------- */
console.log('\n3. Identifiants HTML');
/* Tout le HTML, blocs de code retirés — et non « ce qui précède le premier
   <script> ». Depuis que l'écran de démarrage a posé un script en haut du
   body, cette coupe ne laissait plus que l'en-tête : le contrôle annonçait
   « 1 identifiant, tous uniques » et ne vérifiait plus rien. */
const html = src.replace(/<script>[\s\S]*?<\/script>/g, '');
const ids = new Map();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
  if (ids.has(m[1])) grave(`id="${m[1]}" apparaît deux fois dans la page — ` +
    `les sélecteurs ne trouveront que le premier`);
  else ids.set(m[1], m.index);
}
/* Un contrôle qui n'inspecte plus rien passe au vert sans rien dire. Le
   seuil n'a pas à être juste : il doit seulement rendre l'effondrement
   visible, comme celui qui a fait tomber ce compte de 234 à 1. */
if (ids.size < 100) {
  grave(`seulement ${ids.size} identifiants analysés — la découpe du HTML a changé, ` +
    `ce contrôle ne vérifie probablement plus rien`);
} else bien(`${ids.size} identifiants, tous uniques`);

/* --- 4. version de l'application et du cache ------------------------- */
console.log('\n4. Cohérence des versions');
const vApp = (src.match(/var VERSION = '([^']+)'/) || [])[1];
const vSw = fs.existsSync(fSw) ? (fs.readFileSync(fSw, 'utf8').match(/var VERSION = '([^']+)'/) || [])[1] : null;
if (!vApp) grave('aucune version trouvée dans index.html');
else if (vSw && vSw !== vApp) {
  grave(`index.html annonce ${vApp} mais sw.js annonce ${vSw} — ` +
    `le service worker resservira l'ancien code`);
} else bien(`version ${vApp}, identique dans le service worker`);

/* --- 5. fichiers listés par le service worker ------------------------ */
if (fs.existsSync(fSw)) {
  console.log('\n5. Fichiers mis en cache');
  const sw = fs.readFileSync(fSw, 'utf8');
  const liste = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
  liste.forEach(f => {
    if (!fs.existsSync(path.join(racine, f))) grave(`sw.js met en cache « ${f} », absent du dossier`);
  });
  if (liste.length) bien(`${liste.length} fichiers listés, tous présents`);
}

/* --- 6. syntaxe de chaque bloc --------------------------------------- */
console.log('\n6. Syntaxe');
blocs.forEach((b, i) => {
  try { new Function(b); }
  catch (e) { grave(`bloc ${i + 1} : ${e.message}`); }
});
if (!erreurs) bien(`${blocs.length} blocs, syntaxe valide`);

/* --- 7. champs lus que rien n'écrit ----------------------------------
   Quatre fois, le code a lu un champ inexistant et l'écran a affiché un
   blanc ou un zéro sans que rien ne crie : `charge.nom` là où le formulaire
   enregistre `libelle`, `c.lieu` là où le chantier porte `foret`. Le
   scénario ne l'attrapait pas — il semait les mêmes champs faux.

   On ne peut pas typer tout le fichier, mais certains accès se nomment
   eux-mêmes : `charge.taux`, `x.charge.libelle`. Ceux-là se vérifient sans
   ambiguïté contre le vocabulaire, qui se relève dans les formulaires.
   Les prénoms d'une boucle (`c`, `x`, `e`) restent hors de portée : ils
   désignent tantôt un chantier, tantôt une charge. */
console.log('\n7. Champs inconnus');
{
  /* Le nom de la variable dit le magasin, et rien d'autre ne s'appelle
     ainsi dans le fichier. */
  const PORTES = { charge: 'charges', achat: 'achats', journee: 'journees',
    fournisseur: 'fournisseurs', commande: 'commandes' };
  /* Les méthodes et les propriétés du langage ne sont pas des champs. */
  const HORS = ['forEach', 'filter', 'map', 'length', 'slice', 'indexOf',
    'push', 'sort', 'some', 'every', 'reduce', 'join', 'concat', 'split',
    'trim', 'replace', 'toLowerCase', 'call', 'apply', 'hasOwnProperty'];
  let vus = 0, fautes = 0;
  propres.forEach(code => {
    Object.keys(PORTES).forEach(porte => {
      const re = new RegExp('\\b' + porte + '\\.([A-Za-z_$][\\w$]*)', 'g');
      let m;
      while ((m = re.exec(code))) {
        const champ = m[1];
        if (HORS.indexOf(champ) >= 0) continue;
        vus++;
        if (VOCABULAIRE[PORTES[porte]].indexOf(champ) < 0) {
          fautes++;
          grave(`« ${porte}.${champ} » : aucun formulaire n'écrit ce champ ` +
            `(voir outils/vocabulaire.js)`);
        }
      }
    });
  });
  /* Un contrôle qui n'inspecte plus rien doit crier, pas rassurer. */
  if (vus < 20) grave(`seulement ${vus} accès examinés : le contrôle ne voit plus rien`);
  else if (!fautes) bien(`${vus} accès nommés, tous au vocabulaire`);
}

console.log('\n' + '─'.repeat(52));
if (erreurs) {
  console.log(`✕ ${erreurs} problème(s) — livraison refusée.`);
  process.exit(1);
}
console.log(avertissements ? `✓ Bon pour livraison (${avertissements} remarque(s)).`
  : '✓ Bon pour livraison.');
