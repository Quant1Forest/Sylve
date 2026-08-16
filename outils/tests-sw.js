#!/usr/bin/env node
/* =====================================================================
   Sylve — le service worker sous surveillance

   Le service worker est la pièce qui décide quel fichier le téléphone
   reçoit : la copie qu'il a gardée, ou celle du réseau. C'est ce qui fait
   marcher l'application en forêt — et c'est aussi la seule pièce qui, si
   elle casse, empêche l'application de démarrer du tout. Elle n'était
   testée nulle part.

   On ne peut pas l'ouvrir dans jsdom : un service worker ne tourne pas
   dans une page. On lui fabrique donc son monde — un faux « caches », un
   faux réseau — et on déclenche ses événements à la main pour vérifier ce
   qu'il fait.

     node outils/tests-sw.js
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const racine = path.join(__dirname, '..');
let ok = 0, ko = 0;
function verifier(quoi, attendu, obtenu) {
  const juste = JSON.stringify(attendu) === JSON.stringify(obtenu);
  if (juste) { ok++; console.log('    ✓ ' + quoi); }
  else {
    ko++;
    console.log(`    ✕ ${quoi}\n        attendu : ${JSON.stringify(attendu)}` +
      `\n        obtenu  : ${JSON.stringify(obtenu)}`);
  }
}
const verifierVrai = (quoi, v) => verifier(quoi, true, !!v);

/* ------------------------------------------------------ le monde factice
   Juste ce dont le service worker se sert : de quoi ranger des réponses,
   de quoi les retrouver, et un réseau qu'on pilote. */
function monde(options) {
  options = options || {};
  const caches = new Map();          /* nom du cache → Map(url → réponse) */
  const reseau = options.reseau || {};
  const journal = { reseau: [], supprimes: [] };
  let skipWaiting = 0, claim = 0;

  /* Un vrai navigateur range ses réponses sous une adresse absolue : « ./ »
     et « https://local/ » désignent la même chose. Sans cette normalisation
     le banc d'essai serait plus indulgent que la réalité. */
  const cle = r => {
    const u = typeof r === 'string' ? r : r.url;
    try { return new URL(u, 'https://local/').href; } catch (e) { return u; }
  };
  /* Une réponse se duplique avant d'être mise en cache : un corps ne se lit
     qu'une fois. Sans clone(), le banc d'essai laisserait passer un service
     worker qui plante à la première ressource inconnue. */
  const reponse = (url, extra) => {
    const r = Object.assign({ url, ok: true, type: 'basic' }, extra || {});
    r.clone = () => Object.assign({}, r, { clone: r.clone });
    return r;
  };
  const faireCache = nom => ({
    addAll(reqs) {
      reqs.forEach(r => caches.get(nom).set(cle(r), reponse(cle(r))));
      return Promise.resolve();
    },
    put(req, rep) { caches.get(nom).set(cle(req), rep); return Promise.resolve(); },
    match(req) { return Promise.resolve(caches.get(nom).get(cle(req)) || undefined); }
  });

  const ctx = {
    self: {
      location: { origin: 'https://local' },
      skipWaiting() { skipWaiting++; },
      clients: { claim() { claim++; return Promise.resolve(); } },
      addEventListener(type, fn) { (ctx.__ecouteurs[type] = ctx.__ecouteurs[type] || []).push(fn); }
    },
    caches: {
      open(nom) { if (!caches.has(nom)) caches.set(nom, new Map()); return Promise.resolve(faireCache(nom)); },
      keys() { return Promise.resolve([...caches.keys()]); },
      delete(nom) { journal.supprimes.push(nom); return Promise.resolve(caches.delete(nom)); },
      match(req) {
        for (const m of caches.values()) { const r = m.get(cle(req)); if (r) return Promise.resolve(r); }
        return Promise.resolve(undefined);
      }
    },
    Request: function (url, opts) { this.url = url; this.opts = opts || {}; this.method = 'GET'; },
    URL: URL,
    fetch(req) {
      const u = cle(req);
      journal.reseau.push(u);
      if (reseau[u] === 'panne') return Promise.reject(new Error('hors ligne'));
      return Promise.resolve(reseau[u] || reponse(u, { reseau: true }));
    },
    Promise, console, setTimeout
  };
  ctx.__ecouteurs = {};
  ctx.self.addEventListener = ctx.self.addEventListener.bind(ctx.self);
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(racine, 'sw.js'), 'utf8'), ctx);

  /* Déclencher un événement et attendre ce qu'il a promis. */
  const declencher = (type, extra) => {
    const attentes = [];
    let reponse = null;
    const ev = Object.assign({
      waitUntil: p => attentes.push(p),
      respondWith: p => { reponse = p; attentes.push(p); }
    }, extra || {});
    (ctx.__ecouteurs[type] || []).forEach(fn => fn(ev));
    return Promise.all(attentes).then(() => reponse);
  };

  return { ctx, caches, journal, declencher,
    compteurs: () => ({ skipWaiting, claim }) };
}

const VERSION = (fs.readFileSync(path.join(racine, 'sw.js'), 'utf8')
  .match(/var VERSION = '([^']+)'/) || [])[1];
const CACHE = 'bordcub-' + VERSION;

/* Les fichiers du seul tableau FICHIERS. Balayer tout le fichier ramassait
   aussi le « ./index.html » de la réponse hors ligne et le « ./ » de
   secours : le compte était faux de deux. */
function fichiersAnnonces() {
  const sw = fs.readFileSync(path.join(racine, 'sw.js'), 'utf8');
  const bloc = sw.match(/var FICHIERS = \[([\s\S]*?)\]/);
  if (!bloc) throw new Error('tableau FICHIERS introuvable dans sw.js');
  return (bloc[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
}

(async () => {
  console.log('Sylve — service worker\n' + '─'.repeat(52));

  /* ---------------------------------------------------------------- */
  console.log('\n  Installation : tout ce qu’il faut pour démarrer hors réseau');
  {
    const m = monde();
    await m.declencher('install');
    const c = m.caches.get(CACHE);
    verifierVrai('le cache de cette version est créé', c);
    const listes = fichiersAnnonces();
    verifier('tous les fichiers annoncés sont mis de côté', listes.length, c ? c.size : 0);

    /* Comparer le cache à la liste que le service worker annonce ne prouve
       rien : retirer un fichier des deux côtés laisse le compte juste. On
       croise donc avec ce dont l'application a réellement besoin — le
       manifeste, qui est écrit ailleurs et pour d'autres raisons. */
    const dansLeCache = u => c && c.has(new URL(u, 'https://local/').href);
    ['./', './index.html', './manifest.webmanifest'].forEach(f =>
      verifierVrai('« ' + f +' » est en réserve', dansLeCache(f)));

    const mf = JSON.parse(fs.readFileSync(path.join(racine, 'manifest.webmanifest'), 'utf8'));
    const iconesManquantes = (mf.icons || [])
      .map(i => i.src).filter(src => !dansLeCache('./' + src));
    verifier('toutes les icônes du manifeste sont en réserve', [], iconesManquantes);
    /* Sans « reload », le navigateur pourrait remettre en cache la version
       qu'il a déjà : on installerait la nouvelle en servant l'ancienne. */
    verifierVrai('les fichiers sont demandés en contournant le cache du navigateur',
      /cache: 'reload'/.test(fs.readFileSync(path.join(racine, 'sw.js'), 'utf8')));
  }

  /* ---------------------------------------------------------------- */
  console.log('\n  Activation : le ménage ne doit emporter que les anciennes versions');
  {
    const m = monde();
    m.caches.set('bordcub-4.0.0-vieux', new Map([['./index.html', {}]]));
    m.caches.set('bordcub-4.1.0-vieux', new Map());
    m.caches.set('autre-chose', new Map([['x', {}]]));
    await m.declencher('install');
    await m.declencher('activate');
    verifierVrai('le cache courant survit', m.caches.has(CACHE));
    verifier('les anciennes versions sont supprimées',
      ['bordcub-4.0.0-vieux', 'bordcub-4.1.0-vieux'], m.journal.supprimes.sort());
    verifierVrai('un cache étranger n’est pas touché', m.caches.has('autre-chose'));
    verifier('l’application est prise en main sans attendre', 1, m.compteurs().claim);
  }

  /* ---------------------------------------------------------------- */
  console.log('\n  Mise à jour : le bouton « Installer » doit être entendu');
  {
    const m = monde();
    await m.declencher('message', { data: { type: 'SKIP_WAITING' } });
    verifier('la nouvelle version prend la main', 1, m.compteurs().skipWaiting);
    await m.declencher('message', { data: { type: 'AUTRE_CHOSE' } });
    verifier('et rien d’autre ne la déclenche', 1, m.compteurs().skipWaiting);
  }

  /* ---------------------------------------------------------------- */
  console.log('\n  Hors réseau : l’application doit s’ouvrir quand même');
  {
    const m = monde({ reseau: { 'https://local/': 'panne' } });
    await m.declencher('install');
    const rep = await m.declencher('fetch', {
      request: { url: 'https://local/', method: 'GET', mode: 'navigate' }
    });
    const r = await rep;
    verifierVrai('la page est servie depuis la copie gardée', r && /index.html$/.test(r.url));
    verifier('sans toucher au réseau', [], m.journal.reseau);
  }

  /* ---------------------------------------------------------------- */
  console.log('\n  Requêtes ordinaires');
  {
    const m = monde();
    await m.declencher('install');
    const rep = await m.declencher('fetch', {
      request: { url: 'https://local/icone-192.png', method: 'GET', mode: 'no-cors' }
    });
    verifierVrai('un fichier connu vient du cache', (await rep) && !(await rep).reseau);
    verifier('toujours sans réseau', [], m.journal.reseau);

    /* Ce qui n'est pas en réserve est cherché, puis gardé pour la fois
       d'après — c'est ce qui rend l'application utilisable en forêt après
       une première visite. */
    const m2 = monde();
    await m2.declencher('install');
    const rep2 = await m2.declencher('fetch', {
      request: { url: 'https://local/nouveau.png', method: 'GET', mode: 'no-cors' }
    });
    verifierVrai('un fichier inconnu est cherché sur le réseau', (await rep2).reseau);
    verifier('une seule fois', ['https://local/nouveau.png'], m2.journal.reseau);
    await new Promise(r => setTimeout(r, 10));
    verifierVrai('et il est gardé pour la prochaine fois',
      m2.caches.get(CACHE).has('https://local/nouveau.png'));
  }

  /* ---------------------------------------------------------------- */
  console.log('\n  Ce que le service worker doit laisser passer');
  {
    const m = monde();
    await m.declencher('install');
    const envoi = await m.declencher('fetch', {
      request: { url: 'https://local/x', method: 'POST', mode: 'cors' }
    });
    verifier('un envoi de données n’est pas intercepté', null, envoi);
    const ailleurs = await m.declencher('fetch', {
      request: { url: 'https://ailleurs.example/x', method: 'GET', mode: 'cors' }
    });
    verifier('une adresse étrangère non plus', null, ailleurs);
  }

  /* ---------------------------------------------------------------- */
  console.log('\n  Cohérence avec l’application');
  {
    const sw = fs.readFileSync(path.join(racine, 'sw.js'), 'utf8');
    const app = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
    const vApp = (app.match(/var VERSION = '([^']+)'/) || [])[1];
    verifier('la version est la même des deux côtés', vApp, VERSION);
    const listes = (sw.match(/'\.\/([^']+)'/g) || []).map(s => s.slice(3, -1));
    const manquants = listes.filter(f => !fs.existsSync(path.join(racine, f)));
    verifier('aucun fichier mis en cache n’est absent du dossier', [], manquants);
  }

  console.log('\n' + '─'.repeat(52));
  console.log(ko ? `✕ ${ko} vérification(s) en échec sur ${ok + ko}.`
    : `✓ ${ok} vérifications, le service worker tient.`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error('\n  ✕ ' + e.stack + '\n'); process.exit(1); });
