#!/usr/bin/env node
/* =====================================================================
   Sylve — aucune page plus large que l'écran, mesuré dans un vrai Chrome.

   node outils/largeur.js [fichier] [--largeurs=320,360]

   JSDOM ne calcule aucune mise en page : une rangée de pastilles qui élargit
   la page y passe inaperçue (lot 5b3, 4.87.1 : « Analyses » dépassait sur
   Argent). On ouvre donc l'application dans Chrome sans tête, dans un cadre
   de la largeur d'un petit téléphone, avec de vraies données aux noms longs,
   et l'on parcourt chaque écran : barre du bas, pastilles, ☰, fenêtres du +,
   fiche d'un chantier. À chaque pas, deux mesures :

     - la page n'est pas plus large que l'écran (scrollWidth ≤ clientWidth) ;
     - la barre du bas est entière dans l'écran visible.

   Sans Chrome sur le poste (variable SYLVE_CHROME pour le désigner), l'étape
   le dit et passe : ce qu'elle ne mesure pas, elle ne le déclare pas vert.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ARGS = process.argv.slice(2);
const FICHIER = path.resolve(ARGS.filter(a => a.indexOf('--') !== 0)[0] || path.join(__dirname, '..', 'index.html'));
const opt = ARGS.filter(a => a.indexOf('--largeurs=') === 0)[0];
const LARGEURS = (opt ? opt.slice(11) : '320,360').split(',').map(Number);

function trouverChrome() {
  const candidats = [
    process.env.SYLVE_CHROME,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ];
  return candidats.filter(Boolean).filter(c => fs.existsSync(c))[0] || null;
}

/* Des données qui ressemblent à celles d'un vrai carnet : beaucoup de
   chantiers, des noms et des lieux interminables. Posées avant le démarrage de
   l'application, qui les lit comme elle lit les siennes. */
function graine() {
  const an = new Date().getFullYear(), maintenant = Date.now(), JOUR = 86400000;
  const statuts = ['devis', 'accepte', 'encours', 'termine', 'facture', 'paye', 'refuse'];
  const chantiers = [], journees = [], depenses = [], articles = [];
  for (let i = 0; i < 14; i++) {
    chantiers.push({
      id: 'c' + i, nom: 'Plantation de douglas parcelle ' + i + ' lieu-dit La Grande Chapelle Saint-Étienne',
      statut: statuts[i % 7], donneur: 'Coopérative forestière du Haut-Pays et des Vallées ' + i,
      client: 'Groupement forestier des Trois Vallées', commune: 'Saint-Germain-de-la-Montagne-Haute',
      prixJour: 320, maj: maintenant, cree: maintenant - i * JOUR, dateEntree: maintenant - i * JOUR,
      dateFacture: new Date(an, i % 10, 10, 12).getTime(), numeroFacture: 'F-' + an + '-' + (100 + i),
      lignes: [{ travail: 'PLANT', unite: 'ha', quantite: 8 + i, prix: 1200, nature: 'prestation' },
        { travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 880, nature: 'prestation' }],
      temps: [], jours: []
    });
    journees.push({ id: 'j' + i, date: new Date(an, new Date().getMonth(), 1 + i, 12).getTime(),
      chantier: 'c' + i, km: 40 + i, personnes: 1 });
    depenses.push({ id: 'd' + i, date: new Date(an, i % 10, 5 + i, 12).getTime(),
      fournisseur: 'Établissements Dupont-Martin Motoculture et Équipements Forestiers ' + i,
      lignes: [{ libelle: 'Chaîne de tronçonneuse guide 40 cm équipement', categorie: i % 3 ? 'CONSO' : 'IMMO', ttc: 120 + i * 10, taux: 20 }] });
  }
  for (let a = 0; a < 8; a++) {
    articles.push({ id: 'a' + a, nom: 'Protection gaine ventilée tube 60 cm modèle renforcé ' + a, type: 'protection',
      unite: 'unite', prix: 0.9, seuil: 50, fournisseur: 'Pépinières et fournitures forestières réunies',
      mouvements: [{ id: 'm' + a, date: maintenant - a * JOUR, delta: 500 - a * 10, motif: 'entree' }], maj: maintenant });
  }
  return {
    chantiers, journees, depenses, articles, sorties: [], piles: [], index: [],
    commandes: [{ id: 'k1', num: 'K1-' + an, date: maintenant, dateCmd: maintenant, dateLiv: maintenant,
      fournisseur: 'Pépinières et fournitures forestières réunies', statut: 'recu',
      lignes: [{ article: 'a1', quantite: 200, ttc: 180 }], maj: maintenant }],
    charges: [{ id: 'g1', libelle: 'Assurance responsabilité civile professionnelle', ttc: 48,
      periodicite: 'mensuel', categorie: 'ASSUR', jour: 5, moisReference: 0, maj: maintenant }],
    achats: [{ id: 'h1', quoi: 'Débroussailleuse thermique professionnelle avec harnais', ttc: 890, taux: 20,
      priorite: 'haute', maj: maintenant, cree: maintenant }],
    versements: [{ id: 'v1', date: maintenant, type: 'urssaf', montant: 1450, periode: 'T1', maj: maintenant }]
  };
}

/* Ce script tourne DANS la page mesurée. Il rend ses relevés au cadre parent
   par postMessage ; le parent les pose dans le titre, que Chrome sait dire. */
function parcours() {
  const relevés = [], erreurs = [];
  window.addEventListener('error', function (e) { erreurs.push(String(e.message)); });
  const pause = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const $ = function (s) { return document.querySelector(s); };
  const liste = function (s, cle) {
    return [].map.call(document.querySelectorAll(s), function (b) { return b.dataset[cle]; });
  };
  function mesurer(nom) {
    const lg = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
    const b = $('#barre').getBoundingClientRect();
    const barreEntiere = b.bottom <= innerHeight + 0.5 && b.left >= -0.5 && b.right <= lg + 0.5;
    const fautifs = [];
    if (sw > lg) {
      [].forEach.call(document.querySelectorAll('body *'), function (e) {
        const r = e.getBoundingClientRect();
        if (!r.width || r.right <= lg + 1) return;
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') return;
        }
        fautifs.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''));
      });
    }
    relevés.push({ ecran: nom, page: sw, ecranLargeur: lg, trop: sw > lg, barre: barreEntiere, fautifs: fautifs.slice(0, 3) });
  }
  async function pastilles(prefixe) {
    const vues = liste('#onglets [data-vue]', 'vue');
    for (let j = 0; j < vues.length; j++) {
      const bt = $('#onglets [data-vue="' + vues[j] + '"]'); if (!bt) continue;
      bt.click(); await pause(350); mesurer(prefixe + ' › ' + vues[j]);
    }
  }
  async function fermer() {
    const m = $('#modale'), x = $('#modale-x');
    if (m && !m.hidden && x) x.click();
    await pause(200);
  }
  return (async function () {
    await pause(1500);
    mesurer('démarrage');
    const barres = liste('#barre [data-barre]', 'barre').filter(function (k) { return k !== 'plus'; });
    for (let i = 0; i < barres.length; i++) {
      $('#barre [data-barre="' + barres[i] + '"]').click(); await pause(400);
      mesurer('barre ' + barres[i]);
      /* Sur Aujourd'hui les pastilles sont cachées : celles qu'on y trouverait
         sont celles du module d'avant. */
      if (barres[i] !== 'aujourdhui') await pastilles('barre ' + barres[i]);
    }
    $('#barre [data-barre="chantiers"]').click(); await pause(400);
    const ligne = $('#vue-carnet .chantier-l');
    if (ligne) { (ligne.querySelector('button, [data-id]') || ligne).click(); await pause(500); mesurer('fiche d’un chantier'); }
    $('#b-menu').click(); await pause(200);
    const menus = liste('#modale [data-menu]', 'menu');
    await fermer();
    for (let m = 0; m < menus.length; m++) {
      $('#b-menu').click(); await pause(200);
      const it = $('#modale [data-menu="' + menus[m] + '"]'); if (!it) continue;
      it.click(); await pause(500); mesurer('☰ ' + menus[m]);
      if (menus[m] !== 'reglages' && menus[m] !== 'sauvegarde' && menus[m] !== 'corbeille') await pastilles('☰ ' + menus[m]);
    }
    $('#barre [data-barre="plus"]').click(); await pause(300);
    const plus = liste('#modale [data-plus]', 'plus');
    mesurer('fenêtre +');
    await fermer();
    for (let p = 0; p < plus.length; p++) {
      $('#barre [data-barre="plus"]').click(); await pause(250);
      const pb = $('#modale [data-plus="' + plus[p] + '"]'); if (!pb) continue;
      pb.click(); await pause(500); mesurer('+ ' + plus[p]);
      await fermer();
    }
    parent.postMessage({ releves: relevés, erreurs: erreurs }, '*');
  })();
}

function mesurerA(chrome, largeur) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'sylve-largeur-'));
  try {
    let h = fs.readFileSync(FICHIER, 'utf8');
    /* Les données avant tout script de l'application ; le parcours après. */
    const graineJs = '<script>(function(){try{localStorage.clear();var d=' + JSON.stringify(graine()).replace(/</g, '\\u003c') +
      ';for(var k in d)localStorage.setItem("bordcub."+k,JSON.stringify(d[k]));}catch(e){}})();<\/script>';
    const tete = h.indexOf('<head>') + 6;
    h = h.slice(0, tete) + graineJs + h.slice(tete);
    const fin = h.lastIndexOf('</body>');
    h = h.slice(0, fin) + '<script>window.addEventListener("load",' + parcours.toString().replace(/^function parcours\(\)/, 'function ()') +
      ');<\/script>' + h.slice(fin);
    fs.writeFileSync(path.join(dossier, 'p.html'), h);
    /* Un cadre de la largeur voulue : la fenêtre de Chrome sans tête ne
       descend pas sous 500 px, le cadre si. */
    fs.writeFileSync(path.join(dossier, 'w.html'),
      '<!doctype html><title>attente</title><body style="margin:0"><iframe src="p.html" style="border:0;width:' + largeur +
      'px;height:800px"></iframe><script>addEventListener("message",function(e){document.title="RES:"+encodeURIComponent(JSON.stringify(e.data));});<\/script></body>');
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--window-size=800,900', '--virtual-time-budget=90000',
      '--user-data-dir=' + path.join(dossier, 'profil'), '--dump-dom', 'file:///' + path.join(dossier, 'w.html').replace(/\\/g, '/')],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120000 });
    const m = /<title>RES:([^<]*)<\/title>/.exec(r.stdout || '');
    if (!m) return { echec: 'aucun relevé rendu par Chrome' };
    return JSON.parse(decodeURIComponent(m[1]));
  } finally {
    try { fs.rmSync(dossier, { recursive: true, force: true }); } catch (e) { }
  }
}

const chrome = trouverChrome();
if (!chrome) {
  console.log('  ⚠ largeur : aucun Chrome trouvé (SYLVE_CHROME pour le désigner) — non mesurée.');
  process.exit(0);
}
let ko = 0, pas = 0;
for (const largeur of LARGEURS) {
  const res = mesurerA(chrome, largeur);
  if (res.echec) { console.log('  ✕ ' + largeur + ' px : ' + res.echec); ko++; continue; }
  /* Un parcours qui ne voit presque rien « réussit » trop facilement : il en
     faut au moins la moitié de ce qu'on sait exister. */
  if (res.releves.length < 40) { console.log('  ✕ ' + largeur + ' px : parcours trop court (' + res.releves.length + ' écrans)'); ko++; }
  for (const e of res.releves) {
    pas++;
    if (e.trop) { ko++; console.log('  ✕ ' + largeur + ' px · ' + e.ecran + ' : la page fait ' + e.page + ' px pour un écran de ' + e.ecranLargeur + (e.fautifs.length ? ' (' + e.fautifs.join(', ') + ')' : '')); }
    if (!e.barre) { ko++; console.log('  ✕ ' + largeur + ' px · ' + e.ecran + ' : la barre du bas n’est pas entière dans l’écran'); }
  }
  if (res.erreurs.length) { ko++; console.log('  ✕ ' + largeur + ' px : erreurs dans la page : ' + res.erreurs.slice(0, 2).join(' ; ')); }
  console.log('  ' + largeur + ' px : ' + res.releves.length + ' écrans parcourus');
}
if (ko) { console.log('\n✕ largeur : ' + ko + ' défaut(s).'); process.exit(1); }
console.log('  ✓ largeur : ' + pas + ' mesures, aucune page plus large que l’écran, barre du bas entière.');
