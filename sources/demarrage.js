/* ==========================================================================
   Sylve — écran de démarrage
   Il vit hors de l'application : il doit apparaître avant qu'elle ait fini
   de charger, et s'effacer même si elle échoue en route. Il lit donc la
   durée directement dans le miroir localStorage, en synchrone, plutôt que
   d'attendre que la configuration soit relue — sinon l'écran clignoterait
   le temps de cette lecture, ou pire, s'afficherait alors qu'il est réglé
   sur « aucun ».
   ========================================================================== */
(function () {
'use strict';
var el = document.getElementById('demarrage');
if (!el) return;
var DEFAUT = 1.2, minuterie = null;

function config() {
  try { return JSON.parse(localStorage.getItem('bordcub.cfg') || 'null') || {}; }
  catch (e) { return {}; }
}
function duree() {
  var c = config();
  return c.demarrageDuree != null ? (Number(c.demarrageDuree) || 0) : DEFAUT;
}
/* La signature se pose avant le premier rendu : ajoutée après coup, elle
   apparaîtrait en cours d'animation. */
function signer() {
  var z = document.getElementById('dem-ent'); if (!z) return;
  var c = config();
  var nom = (c.nomEntreprise || '').trim(), logo = c.logoEntreprise || '';
  if (!nom && !logo) { z.hidden = true; return; }
  z.hidden = false;
  z.innerHTML = (logo ? '<img alt="">' : '') + '<span></span>';
  if (logo) z.querySelector('img').src = logo;
  z.querySelector('span').textContent = nom;
}
signer();
function cacher(fondu) {
  clearTimeout(minuterie);
  if (!fondu) el.classList.add('sec');
  el.classList.add('parti');
  el.classList.remove('joue');
}
/* L'écran entre net et sort en fondu. Entrer en fondu ferait un second
   mouvement par-dessus celui du logo, et surtout l'écran d'Android est déjà
   sur ce crème-là : ce qu'on pose dessus ne doit pas se voir arriver. */
function montrer(s) {
  clearTimeout(minuterie);
  el.classList.add('sec');
  el.classList.remove('parti', 'joue');
  void el.offsetWidth;              /* l'affichage est acquis avant qu'on rende la transition */
  el.classList.remove('sec');       /* elle ne servira qu'à la sortie */
  el.classList.add('joue');
  minuterie = setTimeout(function () { cacher(true); }, Math.max(0, s) * 1000);
}

/* Les mains sont prises et l'écran est là pour faire joli : un appui
   n'importe où doit permettre de passer outre. */
el.addEventListener('click', function () { cacher(true); });

/* Rejoué depuis les réglages, pour juger sur pièce la durée qu'on vient
   de poser plutôt que de fermer et rouvrir l'application. */
window.BCdem = { voir: function (s) { montrer(s != null ? s : duree()); } };

/* Au démarrage à froid seulement. Revenir sur l'application dans la journée
   ne doit pas remettre cet écran en travers : sur le terrain, elle s'ouvre
   quinze fois. sessionStorage tient tant que l'application vit, et repart à
   zéro quand le téléphone la ferme pour de bon — c'est exactement la
   frontière qu'on cherche. */
var froid = true;
try {
  froid = !sessionStorage.getItem('bordcub.demarre');
  sessionStorage.setItem('bordcub.demarre', '1');
} catch (e) { }

var s = duree();
if (froid && s > 0) montrer(s);
})();
