/* ==========================================================================
   Sylve — stockage
   IndexedDB en principal (quota large, protégé par persist()), localStorage
   en miroir. Deux copies indépendantes : si l'une est vidée ou abîmée,
   l'autre remet l'application d'aplomb toute seule.
   Dégradation : hôte > IndexedDB+miroir > localStorage seul > mémoire.
   ========================================================================== */
(function () {
'use strict';

var PREFIXE = 'bordcub.';
/* Le nom de la base et le préfixe des clés datent des débuts et ne changeront
   pas : les renommer ferait chercher les données dans un tiroir vide, et tout
   serait perdu. Ce nom n'apparaît nulle part à l'écran. */
var DB = 'bordcub', MAGASIN = 'kv', DELAI = 4000;

var mode = 'memoire';
var mem = {};
var db = null;
var miroir = false;

/* ------------------------------------------------------------ miroir */
function miroirDispo() {
  try { localStorage.setItem('__bc', '1'); localStorage.removeItem('__bc'); return true; }
  catch (e) { return false; }
}
function mSet(k, v) { if (miroir) { try { localStorage.setItem(k, v); } catch (e) { } } }
function mGet(k) { if (!miroir) return null; try { return localStorage.getItem(k); } catch (e) { return null; } }
function mDel(k) { if (miroir) { try { localStorage.removeItem(k); } catch (e) { } } }
function mCles() {
  if (!miroir) return [];
  var r = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIXE) === 0) r.push(k);
    }
  } catch (e) { }
  return r;
}

/* -------------------------------------------------------- IndexedDB */
function ouvrirDB() {
  return new Promise(function (res, rej) {
    var fini = false;
    var minuteur = setTimeout(function () { if (!fini) { fini = true; rej(new Error('délai')); } }, DELAI);
    var r;
    try { r = indexedDB.open(DB, 1); } catch (e) { clearTimeout(minuteur); rej(e); return; }
    r.onupgradeneeded = function () {
      try { r.result.createObjectStore(MAGASIN); } catch (e) { }
    };
    r.onsuccess = function () { if (fini) return; fini = true; clearTimeout(minuteur); res(r.result); };
    r.onerror = r.onblocked = function () { if (fini) return; fini = true; clearTimeout(minuteur); rej(r.error || new Error('bloqué')); };
  });
}
function tx(ecriture) {
  return db.transaction(MAGASIN, ecriture ? 'readwrite' : 'readonly').objectStore(MAGASIN);
}
function req(r) {
  return new Promise(function (res, rej) {
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}

/* ------------------------------------------------------- API commune */
var S = {
  mode: function () { return mode; },

  get: function (k) {
    if (mode === 'hote') {
      return window.storage.get(k).then(function (r) { return r ? r.value : null; }, function () { return null; });
    }
    if (mode === 'idb') {
      return req(tx(false).get(k)).then(function (v) {
        if (v !== undefined && v !== null) return v;
        var s = mGet(k);                       // rattrapage depuis le miroir
        if (s !== null) { S.set(k, s); return s; }
        return null;
      }, function () {
        var s = mGet(k); return s === null ? null : s;
      });
    }
    if (mode === 'local') return Promise.resolve(mGet(k));
    return Promise.resolve(mem[k] === undefined ? null : mem[k]);
  },

  set: function (k, v) {
    if (mode === 'hote') return window.storage.set(k, v).catch(function () { });
    if (mode === 'idb') {
      mSet(k, v);
      return req(tx(true).put(v, k)).catch(function () { });
    }
    if (mode === 'local') {
      try { localStorage.setItem(k, v); }
      catch (e) { if (S.surSaturation) S.surSaturation(); }
      return Promise.resolve();
    }
    mem[k] = v; return Promise.resolve();
  },

  del: function (k) {
    if (mode === 'hote') return window.storage.delete(k).catch(function () { });
    if (mode === 'idb') { mDel(k); return req(tx(true).delete(k)).catch(function () { }); }
    if (mode === 'local') { mDel(k); return Promise.resolve(); }
    delete mem[k]; return Promise.resolve();
  },

  /* toutes les clés bordcub.* connues, quel que soit le support */
  keys: function () {
    var fusion = function (a, b) {
      var vu = {}, r = [];
      a.concat(b).forEach(function (k) { if (k && k.indexOf(PREFIXE) === 0 && !vu[k]) { vu[k] = 1; r.push(k); } });
      return r.sort();
    };
    if (mode === 'hote' && window.storage.list) {
      return window.storage.list(PREFIXE).then(function (r) { return fusion((r && r.keys) || [], []); },
        function () { return []; });
    }
    if (mode === 'idb') {
      return req(tx(false).getAllKeys()).then(function (ks) { return fusion(ks || [], mCles()); },
        function () { return fusion([], mCles()); });
    }
    if (mode === 'local') return Promise.resolve(fusion(mCles(), []));
    return Promise.resolve(fusion(Object.keys(mem), []));
  },

  /* place occupée, si le navigateur veut bien la dire */
  place: function () {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().then(function (e) {
      return { utilise: e.usage || 0, total: e.quota || 0 };
    }).catch(function () { return null; });
  }
};

/* ------------------------------------------------------------ départ */
function reprise() {
  /* ce que le miroir connaît et qu'IndexedDB ignore encore : on rapatrie.
     C'est aussi le chemin de migration depuis la version localStorage. */
  var cles = mCles();
  if (!cles.length) return Promise.resolve(0);
  return req(tx(false).getAllKeys()).then(function (deja) {
    var vu = {}; (deja || []).forEach(function (k) { vu[k] = 1; });
    var manquantes = cles.filter(function (k) { return !vu[k]; });
    if (!manquantes.length) return 0;
    var o = tx(true), n = 0;
    manquantes.forEach(function (k) { var v = mGet(k); if (v !== null) { o.put(v, k); n++; } });
    return n;
  }).catch(function () { return 0; });
}

S.pret = (function () {
  if (typeof window.storage === 'object' && window.storage && typeof window.storage.get === 'function') {
    mode = 'hote';
    return Promise.resolve(mode);
  }
  miroir = miroirDispo();
  if (typeof indexedDB === 'undefined' || !indexedDB) {
    mode = miroir ? 'local' : 'memoire';
    return Promise.resolve(mode);
  }
  return ouvrirDB().then(function (d) {
    db = d; mode = 'idb';
    d.onversionchange = function () { try { d.close(); } catch (e) { } db = null; mode = miroir ? 'local' : 'memoire'; };
    return reprise().then(function () { return mode; });
  }, function () {
    mode = miroir ? 'local' : 'memoire';
    return mode;
  });
})();

window.BCS = S;

})();

