#!/usr/bin/env node
/* =====================================================================
   Sylve — fabriquer le fond de carte à partir des shapefiles de l'IGN

   node outils/convertir-communes.js <dossier Cartographie> [sortie.js]

   Pourquoi ce fichier existe. Un fond de carte classique, ce sont des
   tuiles d'image servies par un serveur : il faut du réseau et une
   dépendance, les deux choses que Sylve refuse — et c'est ce refus qui la
   fait marcher au fond d'une parcelle. Un shapefile, lui, n'est pas une
   image : ce sont des tracés. Ils se convertissent UNE FOIS, ici, en un
   fichier de contours que l'application embarque.

   Le classeur IGN ne doit jamais entrer dans le dépôt — 248 Mo pour le seul
   parcellaire du Doubs — et le fichier produit non plus tant qu'il n'est pas
   intégré : c'est `index.html` qui le portera.

   Les coordonnées restent en Lambert 93 (EPSG:2154), la projection des
   fichiers IGN. C'est une projection plane : elle sert telle quelle de
   repère à l'écran, et la conversion vers latitude/longitude se fait dans
   l'application, au moment où l'on pose un point.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const DEPARTEMENTS = ['01', '03', '25', '39', '70', '71'];
/* Cent mètres : la largeur d'une parcelle. En deçà on paie des sommets que
   l'écran d'un téléphone ne distingue pas. */
const TOLERANCE = 100;

/* --- lire un shapefile de polygones ---------------------------------- */
function lireSHP(chemin) {
  const b = fs.readFileSync(chemin);
  const out = [];
  let p = 100;
  while (p + 8 <= b.length) {
    const lg = b.readInt32BE(p + 4) * 2;      /* longueur en mots de 16 bits */
    const d = p + 8;
    if (d + lg > b.length) break;
    const type = b.readInt32LE(d);
    if (type === 5) {                          /* polygone */
      const nParts = b.readInt32LE(d + 36);
      const nPts = b.readInt32LE(d + 40);
      const oParts = d + 44, oPts = oParts + nParts * 4;
      const parts = [];
      for (let i = 0; i < nParts; i++) parts.push(b.readInt32LE(oParts + i * 4));
      const anneaux = [];
      for (let k = 0; k < nParts; k++) {
        const deb = parts[k], fin = (k + 1 < nParts) ? parts[k + 1] : nPts;
        const r = [];
        for (let j = deb; j < fin; j++) {
          r.push([b.readDoubleLE(oPts + j * 16), b.readDoubleLE(oPts + j * 16 + 8)]);
        }
        anneaux.push(r);
      }
      out.push(anneaux);
    }
    p = d + lg;
  }
  return out;
}

/* --- Douglas–Peucker : garder les sommets qui portent la forme -------- */
function simplifier(pts, tol) {
  if (pts.length < 3) return pts;
  const garde = new Array(pts.length);
  garde[0] = garde[pts.length - 1] = true;
  const pile = [[0, pts.length - 1]];
  while (pile.length) {
    const [a, z] = pile.pop();
    const ax = pts[a][0], ay = pts[a][1];
    const dx = pts[z][0] - ax, dy = pts[z][1] - ay;
    const l2 = dx * dx + dy * dy;
    let pire = -1, dMax = tol;
    for (let i = a + 1; i < z; i++) {
      const px = pts[i][0] - ax, py = pts[i][1] - ay;
      let d;
      if (l2 === 0) d = Math.sqrt(px * px + py * py);
      else {
        let t = (px * dx + py * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - t * dx, ey = py - t * dy;
        d = Math.sqrt(ex * ex + ey * ey);
      }
      if (d > dMax) { dMax = d; pire = i; }
    }
    if (pire >= 0) { garde[pire] = true; pile.push([a, pire], [pire, z]); }
  }
  const r = [];
  for (let m = 0; m < pts.length; m++) if (garde[m]) r.push(pts[m]);
  return r;
}

/* --- écriture compacte -----------------------------------------------
   Trois écritures ont été mesurées sur les six départements :

     décimal au mètre      790 Ko
     décimal à dix mètres  617 Ko
     varint en base 64     322 Ko   ← retenue

   La dernière est celle des polylignes de Google : l'écart au point
   précédent, en pas de dix mètres, écrit par groupes de cinq bits décalés
   de 63 pour tomber sur des caractères imprimables. Un écart de moins de
   320 m tient sur un seul caractère, et c'est le cas de presque tous.

   Dix mètres, parce que cent mètres de tolérance et une précision au mètre
   ne vont pas ensemble : on paierait des chiffres que la simplification a
   déjà jetés. L'erreur ajoutée est de cinq mètres au plus.

   ATTENTION AU SÉPARATEUR. L'alphabet va de « ? » (63) à « ~ » (126) : la
   barre verticale en fait partie, et l'avoir prise pour séparer les contours
   les coupait au milieu — 6 379 contours au lieu de 2 880, et des communes
   au large de l'Atlantique. Le saut de ligne (10) est hors de l'alphabet.
   C'est un croisement avec la projection qui l'a attrapé, avant l'écran. */
const PAS = 10;
const SEPARATEUR = String.fromCharCode(10);
function varint(n) {
  n = n < 0 ? ~(n << 1) : (n << 1);
  let out = '';
  while (n >= 0x20) { out += String.fromCharCode((0x20 | (n & 0x1f)) + 63); n >>= 5; }
  return out + String.fromCharCode(n + 63);
}
function encoder(pts) {
  let px = 0, py = 0, m = '';
  for (const pt of pts) {
    const x = Math.round(pt[0] / PAS), y = Math.round(pt[1] / PAS);
    m += varint(x - px) + varint(y - py);
    px = x; py = y;
  }
  return m;
}

/* --- le tout ---------------------------------------------------------- */
const racine = process.argv[2];
if (!racine) {
  console.log('node outils/convertir-communes.js <dossier Cartographie> [sortie.js]');
  process.exit(1);
}
const sortie = process.argv[3] || path.join(__dirname, '..', 'communes.js');

function trouverSHP(dep) {
  const base = path.join(racine, 'Cadastre fond de carte', 'Parcellaire ' + dep);
  if (!fs.existsSync(base)) return null;
  const pile = [base];
  while (pile.length) {
    const d = pile.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (/^COMMUNE\.SHP$/i.test(e.name)) return p;
    }
  }
  return null;
}

const contours = [];
let avant = 0, apres = 0;
for (const dep of DEPARTEMENTS) {
  const f = trouverSHP(dep);
  if (!f) { console.log('  ~ département ' + dep + ' : COMMUNE.SHP introuvable'); continue; }
  let n = 0;
  for (const forme of lireSHP(f)) {
    for (const anneau of forme) {
      avant += anneau.length;
      const s = simplifier(anneau, TOLERANCE);
      /* Un anneau réduit à un triangle ne dessine rien. */
      if (s.length < 4) continue;
      apres += s.length;
      contours.push(encoder(s));
      n++;
    }
  }
  console.log('  ✓ département ' + dep + ' : ' + n + ' contours');
}

if (!contours.length) { console.log('✕ aucun contour lu.'); process.exit(1); }

const texte = contours.join(SEPARATEUR);
fs.writeFileSync(sortie,
  '/* Fond de carte — contours de communes, départements ' + DEPARTEMENTS.join(' ') + '.\n' +
  '   Fabriqué par outils/convertir-communes.js depuis les shapefiles IGN\n' +
  '   (PARCELLAIRE-EXPRESS, couche COMMUNE), simplifiés à ' + TOLERANCE + ' m.\n' +
  '   Coordonnées en Lambert 93, par pas de ' + PAS + ' m, en varint base 64.\n' +
  '   Le décodeur vit dans index.html : les deux doivent rester d\'accord. */\n' +
  'var COMMUNES = ' + JSON.stringify(texte) + ';\n', 'utf8');

console.log('─'.repeat(52));
console.log('  ' + contours.length + ' contours, ' +
  avant.toLocaleString('fr-FR') + ' points ramenés à ' + apres.toLocaleString('fr-FR'));
console.log('  ' + Math.round(texte.length / 1024) + ' Ko → ' + sortie);
