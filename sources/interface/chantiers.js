/* ================================================ CHANTIERS — interface */
var C = window.BCC;

var COUL_STATUT = {
  devis: '#7A8471', envoye: '#B98A00', accepte: '#1D6FB8', encours: '#2E7D46',
  termine: '#8A5A2B', facture: '#5B3A1E', paye: '#2E4A3C', sansuite: '#9AA294'
};

function chantier(id) {
  return A.chantiers.filter(function (c) { return c.id === id; })[0] || null;
}
function sauverChantiers() {
  A.chantiers.forEach(function (c) { if (!c.maj) c.maj = Date.now(); });
  return ecrire('bordcub.chantiers', A.chantiers);
}
/* « Il y a un devis » se répond maintenant sur la fiche. Sur l'existant, on
   inscrit la réponse une fois pour de bon plutôt que de la déduire à chaque
   lecture : sinon la règle vivrait à deux endroits et finirait par diverger.
   L'historique repris du carnet comptable n'avait pas de devis ; ce qui est
   passé par « à envoyer », « envoyé » ou « sans suite » en avait un. */
function migrerDevis() {
  A.cfg = A.cfg || {};
  if (A.cfg.devisMigres) return 0;
  var n = 0;
  (A.chantiers || []).forEach(function (c) {
    if (c.aDevis != null) return;
    c.aDevis = C.aDevis(c);
    n++;
  });
  A.cfg.devisMigres = true;
  sauverCfg();
  if (n) sauverChantiers();
  return n;
}
/* La date qui compte n'est pas la même selon où en est le chantier : c'est
   celle du dernier événement, la seule qu'on cherche des yeux dans le
   carnet. Le statut seul ne disait pas quand. */
function dateStatut(c) {
  if (!c) return '';
  if (c.statut === 'paye' && c.datePaiement) return 'payé le ' + dateCourte(c.datePaiement);
  if (c.dateFacture && (c.statut === 'facture' || c.statut === 'paye'))
    return 'facturé le ' + dateCourte(c.dateFacture);
  if (c.statut === 'termine' && c.dateFin) return 'terminé le ' + dateCourte(c.dateFin);
  if (c.statut === 'envoye') {
    /* Un devis envoyé se cherche des yeux par sa date de fin, pas par celle
       de son départ : c'est elle qui dit s'il faut relancer. */
    var fin = C.finValiditeDevis(c);
    if (fin != null) return 'valable jusqu’au ' + dateCourte(fin);
    if (c.dateEnvoi) return 'envoyé le ' + dateCourte(c.dateEnvoi);
  }
  return '';
}
/* Prend le chantier et non le seul code : l'intitulé dépend de la présence
   d'un devis. */
/* Les étapes datées du chantier, dans l'ordre où elles arrivent. Toutes
   celles qui existent, pas seulement la dernière : c'est l'écart entre la
   facture et le paiement qu'il vient lire. */
function datesCh(c) {
  var d = [];
  if (!c) return d;
  if (c.dateDevis) d.push('devis le ' + dateCourte(c.dateDevis));
  if (c.dateFacture) d.push('facturé le ' + dateCourte(c.dateFacture));
  if (c.datePaiement) d.push('payé le ' + dateCourte(c.datePaiement));
  /* Rien de daté : il reste l'ordre d'arrivée, qui range ces chantiers-là. */
  if (!d.length && C.dateEntree(c)) d.push('entré le ' + dateCourte(C.dateEntree(c)));
  return d;
}
function badgeStatut(c) {
  var st = c ? c.statut : '';
  return '<span class="st" style="background:' + (COUL_STATUT[st] || '#7A8471') + '">' +
    esc(C.nomStatut(st, c)) + '</span>';
}
/* Espace insécable avant le symbole : avec une espace ordinaire, une tuile
   étroite coupe la ligne entre le nombre et le « € », qui tombe seul en
   dessous. Le nombre et son unité ne se séparent pas. */
function eur(v) { return E.fmt(C.arr(v, 2), v % 1 ? 2 : 0) + ' €'; }
function dateCourte(ts) { return ts ? new Date(ts).toLocaleDateString('fr-FR') : ''; }
function versDate(v) { return v ? new Date(v + 'T12:00:00').getTime() : null; }
/* Un champ date parle en heure locale. toISOString() répondait en heure de
   Greenwich : minuit à Paris y est 22 h la veille, et le champ affichait donc
   le jour d'avant. « + une journée » proposait un jour libre et en montrait
   un autre, souvent celui déjà pris qu'il venait d'écarter. */
function versChamp(ts) { return ts ? C.jourCle(ts) : ''; }

var veilleTenue = null;
function veilleVoulue() { return !!(A.cfg && A.cfg.ecranAllume); }
function veilleDisponible() {
  return !!(navigator.wakeLock && navigator.wakeLock.request);
}
function libererVeille() {
  if (!veilleTenue) return;
  try { veilleTenue.release(); } catch (e) { /* déjà relâchée */ }
  veilleTenue = null;
}
/* Rend une promesse pour que l'appelant sache si le téléphone a accepté. */
function demanderVeille() {
  if (!veilleVoulue() || !veilleDisponible() || document.hidden) {
    libererVeille();
    return Promise.resolve(false);
  }
  if (veilleTenue) return Promise.resolve(true);
  return navigator.wakeLock.request('screen').then(function (v) {
    veilleTenue = v;
    /* Le système relâche de lui-même en arrière-plan : on l'apprend ici. */
    v.addEventListener('release', function () { veilleTenue = null; });
    return true;
  })['catch'](function () { veilleTenue = null; return false; });
}
/* Revenir sur l'application redemande : la demande d'avant est perdue. */
function brancherVeille() {
  if (!veilleDisponible()) return;
  /* Une seule porte : demanderVeille() relâche déjà quand la page est
     cachée. Tester « hidden » ici aussi faisait deux gardes qui se
     couvraient l'une l'autre — aucune n'était alors éprouvable. */
  document.addEventListener('visibilitychange', function () { demanderVeille(); });
}

