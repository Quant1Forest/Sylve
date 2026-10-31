/* ==========================================================================
   Sylve — installation, hors-ligne, stockage durable
   Tout est facultatif : sur un fichier local ou un vieux navigateur,
   chaque bloc se désactive proprement.
   ========================================================================== */
(function () {
'use strict';

var VERSION = '4.85.1-20261030-1850';
var $ = function (s) { return document.querySelector(s); };
function toast(m) { if (window.BCUI && window.BCUI.toast) window.BCUI.toast(m); }

var etat = {
  installee: false,      // lancée depuis l'écran d'accueil
  installable: null,     // évènement beforeinstallprompt en attente
  horsLigne: false,      // service worker actif
  durable: null,         // navigator.storage.persisted()
  reg: null
};

/* ------------------------------------------------- lancée en autonome ? */
function estInstallee() {
  try {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  } catch (e) { return false; }
}

/* --------------------------------------------------- stockage durable */
/* Android peut effacer le stockage d'un site quand la mémoire manque.
   persist() met le bordereau à l'abri ; accordé d'office si l'app est
   installée, sinon Chrome décide selon l'usage. */
function demanderDurable(explicite) {
  if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
  return navigator.storage.persisted().then(function (deja) {
    if (deja) return true;
    return navigator.storage.persist().then(function (ok) {
      if (explicite) toast(ok ? 'Données protégées contre l’effacement automatique.'
        : 'Refusé par le navigateur. Installez l’application pour l’obtenir.');
      return ok;
    });
  }).catch(function () { return null; });
}

/* ---------------------------------------------------- service worker */
function enregistrerSW() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return Promise.resolve(null);
  return navigator.serviceWorker.register('sw.js').then(function (reg) {
    etat.reg = reg;
    reg.addEventListener('updatefound', function () {
      var sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', function () {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) proposerMaj(reg);
      });
    });
    return reg;
  }).catch(function () { return null; });
}

var rechargeEnCours = false;
function proposerMaj(reg) {
  var b = $('#r-maj');
  if (b) { b.textContent = 'Installer la mise à jour'; b.classList.add('primaire'); }
  proposerMaj.attente = reg.waiting;
  /* Un toast s'efface en deux secondes et se rate. L'avis reste posé jusqu'à
     ce qu'on réponde — sans bloquer : on peut finir sa saisie et installer
     après. Le téléchargement, lui, est déjà fait à ce stade. */
  var z = $('#maj-avis');
  if (!z) { toast('Nouvelle version prête — Réglages ▸ Application.'); return; }
  z.hidden = false;
  $('#maj-oui').addEventListener('click', function () {
    $('#maj-avis-det').textContent = 'Installation…';
    $('#maj-oui').disabled = true;
    $('#maj-non').disabled = true;
    if (!appliquerMaj()) { z.hidden = true; toast('Mise à jour indisponible.'); }
  });
  $('#maj-non').addEventListener('click', function () {
    z.hidden = true;
    toast('Vous pourrez l’installer dans Réglages ▸ Application.');
  });
}
function appliquerMaj() {
  var reg = etat.reg;
  var w = (reg && reg.waiting) || proposerMaj.attente;
  if (!w) return false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (rechargeEnCours) return;
    rechargeEnCours = true; location.reload();
  });
  w.postMessage({ type: 'SKIP_WAITING' });
  return true;
}
function verifierMaj() {
  if (appliquerMaj()) { toast('Mise à jour en cours…'); return; }
  if (!etat.reg) { toast('Mises à jour indisponibles (fichier local).'); return; }
  toast('Recherche…');
  etat.reg.update().then(function () {
    setTimeout(function () {
      if (!(etat.reg.waiting || proposerMaj.attente)) toast('Vous avez déjà la dernière version.');
    }, 900);
  }).catch(function () { toast('Vérification impossible hors réseau.'); });
}

/* ------------------------------------------------------- installation */
window.addEventListener('beforeinstallprompt', function (ev) {
  ev.preventDefault();
  etat.installable = ev;
  rafraichir();
});
window.addEventListener('appinstalled', function () {
  etat.installable = null; etat.installee = true;
  demanderDurable(false).then(function (d) { etat.durable = d; rafraichir(); });
  toast('Sylve est installé.');
});
function installer() {
  if (!etat.installable) return;
  var ev = etat.installable; etat.installable = null;
  ev.prompt();
  ev.userChoice.then(function () { rafraichir(); }).catch(function () { });
}

/* -------------------------------------------------------- état visible */
function rafraichir() {
  var t = $('#r-appli-etat'), bi = $('#r-installer'), bp = $('#r-persist'), v = $('#r-version');
  if (!t) return;
  var l = [];
  l.push(etat.installee ? 'Lancée depuis l’écran d’accueil.'
    : etat.installable ? 'Installable sur l’écran d’accueil.'
      : 'Ouverte dans le navigateur.');
  l.push(etat.horsLigne ? 'Fonctionne sans réseau.'
    : location.protocol === 'file:' ? 'Fichier local : déjà autonome, pas de mise à jour automatique.'
      : 'Hors-ligne pas encore prêt.');
  if (etat.durable === true) l.push('Données protégées contre l’effacement automatique.');
  else if (etat.durable === false) l.push('Données non protégées : exportez régulièrement.');
  t.textContent = l.join(' ');
  if (bi) bi.hidden = !etat.installable;
  if (bp) bp.hidden = !(etat.durable === false);
  if (v) v.textContent = 'Version ' + VERSION;
}

/* ------------------------------------------------------------ démarrage */
function demarrer() {
  etat.installee = estInstallee();
  var bi = $('#r-installer'), bp = $('#r-persist'), bm = $('#r-maj');
  if (bi) bi.addEventListener('click', installer);
  if (bp) bp.addEventListener('click', function () {
    demanderDurable(true).then(function (d) { etat.durable = d; rafraichir(); });
  });
  if (bm) bm.addEventListener('click', verifierMaj);
  rafraichir();
  enregistrerSW().then(function (reg) {
    etat.horsLigne = !!reg;
    return demanderDurable(false);
  }).then(function (d) { etat.durable = d; rafraichir(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
else demarrer();

window.BCP = { etat: etat, rafraichir: rafraichir, version: VERSION };

})();

