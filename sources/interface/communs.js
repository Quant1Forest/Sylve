var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var E = window.BC;   // moteur

/* ------------------------------------------------------------ stockage */
var Store = {
  get: function (k) { return window.BCS.get(k); },
  set: function (k, v) { return window.BCS.set(k, v); },
  del: function (k) { return window.BCS.del(k); },
  keys: function () { return window.BCS.keys(); },
  place: function () { return window.BCS.place(); },
  mode: function () { return window.BCS.mode(); }
};
window.BCS.surSaturation = function () { toast('Mémoire pleine : exportez vos bordereaux.'); };
function lire(k, def) { return Store.get(k).then(function (v) { try { return v ? JSON.parse(v) : def; } catch (e) { return def; } }); }
function ecrire(k, o) { return Store.set(k, JSON.stringify(o)); }

/* ---------------------------------------------------------------- état */
var A = {
  cfg: null, index: [], bord: null, piles: [], chantiers: [], module: 'cubage', ici: null,
  vuePiles: 'stock', triRend: 'alpha', carte: null, cartePose: null, filtreCh: 'ouverts', rechCh: '', triAncien: false, triCh: 'auto', chOuvert: null, clients: [], proprios: [], estim: null, imp: null, articles: [], charges: [], fournisseurs: [], commandes: [], sorties: [], mvt: 'achats', journees: [], lieuxRegles: [], listeReglee: 'clients', revient: null, calMois: null, calJour: null, nbAlertes: 0, planifie: null,
  depenses: [], periode: null, filtreDep: 'tous', vueAna: 'ensemble', secReglages: 'general',
  achats: [], fch: null, fchFiltre: 'ouverts',
  versements: [], vehicule: null,
  vue: 'saisie', sousVue: 'synthese', edition: null,
  memeGrume: false, classementRegl: 'Class. Comt', filtre: ''
};
var COULEURS = {
  'bleu': '#1F5FA9', 'rouge': '#B4231F', 'jaune': '#B98A00', 'vert': '#2E7D46',
  'orange': '#C4611B', 'rose': '#B0407A', 'blanc': '#4A5560', 'noir': '#39433A'
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function toast(m) {
  var t = $('#toast'); t.textContent = m; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
var sauveT = null;
function sauver() {
  if (!A.bord) return;
  clearTimeout(sauveT);
  sauveT = setTimeout(function () {
    A.bord.maj = Date.now();
    ecrire('bordcub.b.' + A.bord.id, A.bord);
    var S = E.synthese(A.bord, A.cfg);
    var e = A.index.filter(function (x) { return x.id === A.bord.id; })[0];
    if (e) {
      e.meta = A.bord.meta; e.maj = A.bord.maj;
      e.nb = A.bord.lignes.length; e.vol = S.totalGen;
      ecrire('bordcub.index', A.index);
    }
  }, 350);
}
function sauverCfg() { return ecrire('bordcub.cfg', A.cfg); }
function sauverVersements() { return ecrire('bordcub.versements', A.versements); }
function sauverVehicule() { return ecrire('bordcub.vehicule', A.vehicule); }
function sauverAchats() { return ecrire('bordcub.achats', A.achats); }

/* Les quatre classes de l'ABCD s'intitulaient « Actba », « Bctba » : du
   vocabulaire de tableur que personne ne lit sous la pluie. Les listes de
   qualités partent dans les sauvegardes, donc changer le défaut ne suffit
   pas — un téléphone déjà installé garde les siennes. On ne réécrit que les
   libellés restés tels quels : celui qu'il aurait renommé lui-même est le
   sien, et il le garde. Les codes A, B, C et D ne bougent pas, ce sont eux
   qui portent les billons déjà saisis. */
var LIBELLES_ABCD = { A: 'Actba', B: 'Bctba', C: 'Cctba', D: 'Dctba' };
function migrerLibellesAbcd() {
  var l = (A.cfg.qualites || {})['Class. Qualitatif'];
  if (!l) return;
  var change = false;
  l.forEach(function (q) {
    if (LIBELLES_ABCD[q.code] && q.nom === LIBELLES_ABCD[q.code]) {
      q.nom = 'Classe ' + q.code; change = true;
    }
  });
  if (change) sauverCfg();
}

/* ------------------------------------------------------------- couleur */
function appliquerCouleur() {
  var c = A.bord ? String(A.bord.meta.plaqCouleur || '').toLowerCase().trim() : '';
  var k = Object.keys(COULEURS).filter(function (x) { return c.indexOf(x) === 0 || x.indexOf(c) === 0 && c; })[0];
  var col = COULEURS[k] || '#2E4A3C';
  /* Elle ne touche plus à --accent : l'application gardait la couleur des
     plaquettes du bordereau ouvert et changeait donc de teinte sans raison
     visible. Elle ne peint que ce que la plaquette désigne. */
  document.documentElement.style.setProperty('--plaq', col);
}

/* ------------------------------------------------------------- bandeau */
function majBandeau() {
  if (!A.bord) {
    $('#b-titre').textContent = 'Aucun bordereau';
    $('#b-sous').textContent = 'Créez ou ouvrez un bordereau pour commencer';
    $('#b-total').textContent = '—';
    return;
  }
  var m = A.bord.meta, S = E.synthese(A.bord, A.cfg);
  $('#b-titre').textContent = (m.article ? 'Art. ' + m.article + ' · ' : '') + (m.foret || 'Sans forêt');
  /* Le type de cubage se lit dans le bandeau : il décide des qualités
     proposées et des contrôles appliqués, on ne peut pas le deviner. */
  $('#b-sous').textContent = [m.client, E.nomClassement(m.classement),
  (m.mesures === 'sous' ? 'sous écorce' : 'sur écorce'),
  A.bord.lignes.length + ' billon' + (A.bord.lignes.length > 1 ? 's' : '')].filter(Boolean).join(' · ');
  $('#b-total').textContent = E.fmt(S.totalGen, 2);
}

