#!/usr/bin/env node
/* =====================================================================
   Sylve — aucune page plus large que l'écran, mesuré dans un vrai Chrome.

   node outils/largeur.js [fichier] [--largeurs=320,360]

   JSDOM ne calcule aucune mise en page : une rangée de pastilles qui élargit
   la page y passe inaperçue (lot 5b3, 4.87.1 : « Analyses » dépassait sur
   Argent). On ouvre donc l'application dans Chrome sans tête, dans un cadre
   de la largeur d'un petit téléphone, avec de vraies données aux noms longs,
   et l'on parcourt chaque écran : barre du bas, pastilles, ☰, fenêtres du +,
   fiche d'un chantier, Agenda (À programmer déplié, fiche du jour normale et
   à trancher, placement avec l'alerte « jour déjà pris »). À chaque pas,
   trois mesures :

     - la page n'est pas plus large que l'écran (scrollWidth ≤ clientWidth) ;
     - une fenêtre ouverte ne déborde pas de son cadre ;
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
  const statuts = ['devis', 'accepte', 'encours', 'termine', 'facture', 'paye', 'sansuite'];
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
      temps: [], jours: i === 1 ? [{ d: maintenant - 2 * JOUR, p: 1 }, { d: maintenant + 3 * JOUR, p: 1 }] : [],
      /* Deux chantiers engagés à estimer ou à placer : « À programmer ». */
      joursEstimes: i === 1 || i === 2 ? 6 : undefined
    });
    journees.push({ id: 'j' + i, date: new Date(an, new Date().getMonth(), 1 + i, 12).getTime(),
      chantier: 'c' + i, km: 40 + i, personnes: 1 });
    depenses.push({ id: 'd' + i, date: new Date(an, i % 10, 5 + i, 12).getTime(),
      fournisseur: 'Établissements Dupont-Martin Motoculture et Équipements Forestiers ' + i,
      lignes: [{ libelle: 'Chaîne de tronçonneuse guide 40 cm équipement', categorie: i % 3 ? 'CONSO' : 'IMMO', ttc: 120 + i * 10, taux: 20 }] });
  }
  /* Lot r1b : un devis pas signé aux sept jours posés passés, plus la journée
     d'office de c1 : la bulle d'Aujourd'hui en a huit, six lignes et « et 2
     autres ». */
  const poses = [];
  for (let k = 3; k <= 9; k++) poses.push({ d: maintenant - k * JOUR, p: k % 2 ? 1 : 0.5 });
  chantiers.push({ id: 'c14', nom: 'Dégagement de régénération naturelle parcelle 14 lieu-dit Les Grands Communaux',
    statut: 'envoye', aDevis: true, donneur: 'Coopérative forestière du Haut-Pays et des Vallées 14',
    commune: 'Saint-Germain-de-la-Montagne-Haute', maj: maintenant, cree: maintenant, dateEntree: maintenant - 20 * JOUR,
    dateDevis: maintenant - 5 * JOUR, validiteJours: 30, dateEnvoi: maintenant - 5 * JOUR,
    lignes: [{ travail: 'DEGAG', unite: 'ha', quantite: 3, prix: 880, nature: 'prestation' }], temps: [], jours: poses });
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
    versements: [{ id: 'v1', date: maintenant, type: 'urssaf', montant: 1450, periode: 'T1', maj: maintenant }],
    /* Lot r1 : le jour posé il y a deux jours compte d'office (sa fiche porte
       le cadre « Comptée d'office »), et Mes notes a son écran. */
    cfg: { heuresJour: 8, journeesMigrees: true, officeDepuis: maintenant - 10 * JOUR,
      notes: [{ id: 'n1', titre: 'Chantiers à préparer avant la reprise des plantations d’automne', couleur: '#1F5FA9',
        items: [{ id: 'i1', texte: 'Rappeler le gestionnaire de la Coopérative forestière du Haut-Pays', fait: false },
          { id: 'i2', texte: 'Commander les protections gaines ventilées', fait: true }] }] }
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
    /* Une fenêtre est posée en position fixe : ce qui y dépasse n'élargit pas
       la page, il se mesure donc à part, dans son cadre : la feuille du +,
       chaque fenêtre qu'elle ouvre (Ma journée et son pied fixe compris) et
       celles de l'Agenda. Au lot c1, « + Commande » et « + Intervention »
       dépassaient de 2 à 10 px à 320 px ; corrigé au lot c2. */
    /* La bulle de l'appui long (lot r1) est posée en position fixe, elle
       aussi : elle doit tenir entière dans l'écran, à gauche comme à droite. */
    const bu = $('#cal-bulle');
    if (bu) {
      const rb = bu.getBoundingClientRect();
      if (rb.left < -0.5 || rb.right > lg + 0.5) {
        relevés.push({ ecran: nom, page: Math.round(rb.right - Math.min(0, rb.left)), ecranLargeur: lg, trop: true,
          barre: barreEntiere, fautifs: ['bulle de ' + Math.round(rb.left) + ' à ' + Math.round(rb.right) + ' px'] });
        return;
      }
    }
    /* La bulle d'information d'Aujourd'hui (lot r1b), fixe au centre : entière
       dans l'écran, en largeur comme en hauteur, et rien qui déborde dedans. */
    const ba = $('#aj-bulle');
    if (ba) {
      const ra = ba.getBoundingClientRect(), co = ba.querySelector('.ajb-corps');
      const dedans = co ? co.scrollWidth - co.clientWidth : 0;
      if (ra.left < -0.5 || ra.right > lg + 0.5 || ra.bottom > window.innerHeight + 0.5 || dedans > 1) {
        relevés.push({ ecran: nom, page: Math.round(ra.right - Math.min(0, ra.left)), ecranLargeur: lg, trop: true,
          barre: barreEntiere, fautifs: ['bulle d’Aujourd’hui de ' + Math.round(ra.left) + ' à ' + Math.round(ra.right) +
            ' px, bas à ' + Math.round(ra.bottom) + (dedans > 1 ? ', ' + dedans + ' px de trop dedans' : '')] });
        return;
      }
    }
    const m = $('#modale'), mi = $('.modale-in');
    if (/^agenda|^\+ |^fenêtre \+|^fiche ›/.test(nom) && m && !m.hidden && mi && mi.scrollWidth > mi.clientWidth + 1) {
      fautifs.push('fenêtre de ' + mi.scrollWidth + ' px dans un cadre de ' + mi.clientWidth);
      relevés.push({ ecran: nom, page: mi.scrollWidth, ecranLargeur: mi.clientWidth, trop: true, barre: barreEntiere, fautifs: fautifs.slice(0, 3) });
      return;
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
    /* La bulle d'Aujourd'hui, longue (six lignes et « et 2 autres »), puis
       courte : on ne garde qu'un jour posé au devis pas signé. */
    if ($('#aj-bulle')) mesurer('aujourdhui › bulle longue');
    const etat = window.BCUI && window.BCUI._etat && window.BCUI._etat();
    const c14 = etat && etat.chantiers.filter(function (c) { return c.id === 'c14'; })[0];
    const jourPale = c14 && c14.jours[0] ? c14.jours[0].d : null;
    if (c14) c14.jours = c14.jours.slice(0, 1);
    $('#barre [data-barre="agenda"]').click(); await pause(300);
    $('#barre [data-barre="aujourdhui"]').click(); await pause(400);
    if ($('#aj-bulle')) mesurer('aujourdhui › bulle courte');
    if ($('#ajb-ok')) { $('#ajb-ok').click(); await pause(300); }
    const barres = liste('#barre [data-barre]', 'barre').filter(function (k) { return k !== 'plus'; });
    for (let i = 0; i < barres.length; i++) {
      $('#barre [data-barre="' + barres[i] + '"]').click(); await pause(400);
      mesurer('barre ' + barres[i]);
      /* Sur Aujourd'hui les pastilles sont cachées : celles qu'on y trouverait
         sont celles du module d'avant. */
      if (barres[i] !== 'aujourdhui') await pastilles('barre ' + barres[i]);
    }
    /* Aujourd'hui du lot r1 : les autres rappels dépliés. */
    $('#barre [data-barre="aujourdhui"]').click(); await pause(400);
    if ($('#aj-autres')) { $('#aj-autres').open = true; await pause(150); mesurer('aujourdhui › autres rappels dépliés'); }
    /* L'Agenda : la fiche du jour, celle d'une journée d'office, la bulle de
       l'appui long, la feuille Poser un chantier (à venir, puis passé), et
       le placement avec son alerte. */
    $('#barre [data-barre="agenda"]').click(); await pause(400);
    let cases = document.querySelectorAll('#cal-grille [data-jour]');
    if (cases.length) { cases[cases.length - 1].click(); await pause(400); mesurer('agenda › fiche du jour'); await fermer(); }
    const office = document.querySelector('#cal-grille .cal-o');
    if (office) { office.parentNode.click(); await pause(400); mesurer('agenda › fiche d’une journée d’office'); await fermer(); }
    /* Lot r1b : la fiche d'un jour en pointillés, avec ses deux choix. */
    if (jourPale) {
      const d0 = new Date(jourPale); d0.setHours(0, 0, 0, 0);
      const cp = $('#cal-grille [data-jour="' + d0.getTime() + '"]');
      if (cp) { cp.click(); await pause(400); mesurer('agenda › fiche d’un jour en pointillés'); await fermer(); }
    }
    /* Et celle d'un jour fait : une ligne par chantier (lot r1b). */
    const j2 = new Date(); j2.setDate(2); j2.setHours(0, 0, 0, 0);
    const cf = $('#cal-grille [data-jour="' + j2.getTime() + '"]');
    if (cf) { cf.click(); await pause(400); mesurer('agenda › fiche d’un jour fait'); await fermer(); }
    const auj0 = new Date(); auj0.setHours(0, 0, 0, 0);
    const poser = async function (ts, nom) {
      const c = $('#cal-grille [data-jour="' + ts + '"]'); if (!c) return;
      c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); await pause(300);
      mesurer('agenda › bulle de l’appui long' + nom);
      const b = $('#cal-bulle [data-bulle="poser"]'); if (!b) return;
      b.click(); await pause(400);
      const ch = $('#modale [data-pjch]'); if (ch) { ch.click(); await pause(250); }
      mesurer('agenda › poser un chantier' + nom); await fermer();
    };
    cases = document.querySelectorAll('#cal-grille [data-jour]');
    if (cases.length) await poser(cases[cases.length - 1].dataset.jour, ', jour à venir');
    const avant = [].filter.call(document.querySelectorAll('#cal-grille [data-jour]'), function (c) { return Number(c.dataset.jour) < auj0.getTime(); });
    if (avant.length) await poser(avant[0].dataset.jour, ', jour passé');
    $('#barre [data-barre="chantiers"]').click(); await pause(400);
    const c1 = $('#vue-carnet [data-chouvrir="c1"]');
    if (c1) { c1.click(); await pause(450); }
    const placer = $('#f-planifier');
    if (placer) {
      placer.click(); await pause(450); mesurer('agenda › placement');
      /* Dans trois jours, un autre chantier est posé : l'alerte paraît. */
      const pris = new Date(Date.now() + 3 * 86400000); pris.setHours(0, 0, 0, 0);
      const vise = '#cal-grille [data-jour="' + pris.getTime() + '"]';
      if (!$(vise)) { $('#cal-suiv').click(); await pause(300); }
      if ($(vise)) { $(vise).click(); await pause(450); mesurer('agenda › placement, jour déjà pris' + ($('#cal-pl-avert') ? '' : ' (sans alerte)')); }
      if ($('#cal-planif-fin')) { $('#cal-planif-fin').click(); await pause(400); }
    }
    /* La liste du lot b2 : tous ses plis ouverts (payés anciens et leur tri,
       sans suite, filtre, cumuls), une recherche, et la Fiche sécurité
       remplie d'un chantier. */
    $('#barre [data-barre="chantiers"]').click(); await pause(400);
    [].forEach.call(document.querySelectorAll('#vue-carnet details'), function (d) { d.open = true; });
    await pause(200); mesurer('chantiers › liste, plis ouverts');
    const rech = $('#c-rech');
    if (rech) {
      rech.value = 'Plantation'; rech.dispatchEvent(new Event('input', { bubbles: true })); await pause(300);
      mesurer('chantiers › recherche');
      rech.value = ''; rech.dispatchEvent(new Event('input', { bubbles: true })); await pause(200);
    }
    const fs2 = $('#onglets [data-vue="fichech"]');
    if (fs2) {
      fs2.click(); await pause(350);
      const ch = $('#fch-ch'), o = ch && ch.querySelector('option[value]:not([value=""])');
      if (o) { ch.value = o.value; ch.dispatchEvent(new Event('change', { bubbles: true })); await pause(400); mesurer('chantiers › fiche sécurité remplie'); }
    }
    $('#barre [data-barre="chantiers"]').click(); await pause(400);
    const ligne = $('#vue-carnet [data-chouvrir]');
    if (ligne) { ligne.click(); await pause(500); mesurer('fiche d’un chantier'); }
    /* La fiche en étapes du lot b1 : un chantier de chaque statut ouvert,
       toutes ses étapes dépliées (champs de facture et de paiement compris),
       puis les feuilles qu'elle ouvre. */
    const nLignes = document.querySelectorAll('#vue-carnet [data-chouvrir]').length;
    for (let i = 0; i < Math.min(nLignes, 7); i++) {
      $('#barre [data-barre="chantiers"]').click(); await pause(300);
      const o = document.querySelectorAll('#vue-carnet [data-chouvrir]')[i]; if (!o) continue;
      o.click(); await pause(450);
      [].forEach.call(document.querySelectorAll('#f-etapes details'), function (d) { d.open = true; });
      await pause(150);
      mesurer('fiche d’un chantier ' + (i + 1) + ', étapes dépliées');
    }
    const portes = ['#f-reperage', '#f-rendement', '#f-fournitures', '#f-estim', '#f-identite', '#f-peuplement', '#f-statut'];
    for (let p = 0; p < portes.length; p++) {
      const b = $(portes[p]); if (!b) continue;
      b.click(); await pause(400); mesurer('fiche › ' + portes[p]); await fermer();
    }
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
