/* ================================================== VÉHICULE
   Le carnet d'entretien de l'utilitaire : les interventions avec leur
   kilométrage, le compteur, et les échéances à prévoir. Rien d'identifiant
   n'est livré ici — l'identité du véhicule se saisit sur place et part dans
   les sauvegardes, comme le logo de l'entreprise. */
function vehiculeDefaut() {
  /* Les périodicités semées sont des ordres de grandeur d'utilitaire —
     celles de son propre document de suivi. Chacune se corrige sur place ;
     la fiche d'entretien du constructeur fait foi. Semé une seule fois :
     un carnet vidé de ses postes reste vide. */
  return { infos: {}, releves: [], interventions: [], seme: true, postes: [
    { id: uid() + 'r', nom: 'Révision (vidange + filtres)', pkm: 30000, pmois: 24 },
    { id: uid() + 'c', nom: 'Courroie de distribution', pkm: 160000, pmois: 120 },
    { id: uid() + 'p', nom: 'Plaquettes de frein', pkm: 40000 },
    /* Propre aux 4x4 Dangel : le pont arrière se vidange à chaque révision ou
       presque, bien plus souvent que sur un utilitaire de série. */
    { id: uid() + 'd', nom: 'Vidange du pont arrière (Dangel)', pkm: 30000 },
    { id: uid() + 'l', nom: 'Liquide de frein', pmois: 24 },
    /* Il ne figure sur aucune facture d'atelier — c'est un autre guichet — et
       c'est justement pour ça qu'on l'oublie. */
    { id: uid() + 't', nom: 'Contrôle technique', pmois: 24 },
    { id: uid() + 'n', nom: 'Pneus', pkm: 60000 },
    { id: uid() + 'e', nom: 'Embrayage', pkm: 200000 }
  ] };
}
/* Le compteur ne recule pas : le plus grand kilométrage jamais noté fait
   foi, qu'il vienne d'un relevé ou d'une intervention. */
function kmVehicule() {
  var v = A.vehicule || {}, km = 0;
  (v.releves || []).forEach(function (r) { if (C.nb(r.km) > km) km = C.nb(r.km); });
  (v.interventions || []).forEach(function (i) { if (C.nb(i.km) > km) km = C.nb(i.km); });
  return km;
}
/* Chaque poste, situé par rapport au compteur et à aujourd'hui. Un poste
   jamais fait compte depuis zéro : une courroie d'origine à 230 000 km est
   bien en retard sur ses 200 000. */
function echeancesVehicule() {
  var v = A.vehicule || {}, km = kmVehicule(), now = Date.now();
  return (v.postes || []).map(function (p) {
    var aKm = C.nb(p.pkm) ? C.nb(p.dernierKm) + C.nb(p.pkm) : null;
    var aDate = null;
    if (C.nb(p.pmois) && p.dernierDate) {
      var d2 = new Date(p.dernierDate);
      d2.setMonth(d2.getMonth() + C.nb(p.pmois));
      aDate = d2.getTime();
    }
    var rKm = (aKm != null && km) ? aKm - km : null;
    var rJours = aDate != null ? Math.round((C.minuit(aDate) - C.minuit(now)) / C.JOUR) : null;
    var etat = 'ok';
    if ((rKm != null && rKm <= 0) || (rJours != null && rJours <= 0)) etat = 'retard';
    else if ((rKm != null && rKm <= 5000) || (rJours != null && rJours <= 60)) etat = 'bientot';
    return { p: p, aKm: aKm, aDate: aDate, rKm: rKm, rJours: rJours, etat: etat };
  });
}
/* Ce que le véhicule coûte réellement, ramené au kilomètre. C'est le chiffre
   qui dit quand un utilitaire commence à coûter plus qu'il ne sert.
   Le carburant « pro » y entre d'office : la catégorie est définie comme celle
   de l'utilitaire, et lui demander de re-marquer cent vingt-quatre dépenses
   n'aurait servi à rien. Tout le reste — carte grise, assurance, péage — se
   rattache d'une case sur la dépense. */
function depenseDuVehicule(d) {
  if (!d) return false;
  if (d.vehicule) return true;
  return (FIN.lignesDepense(d) || []).some(function (l) {
    return l.categorie === 'CARB' || l.categorie === 'VEHIC';
  });
}
/* Une dépense née d'une intervention du carnet, ou versée dedans, porte
   l'identifiant de cette intervention au lieu d'un simple « true ». Son
   montant est déjà compté par le carnet : le recompter ici doublerait
   l'entretien. */
function depenseLieeAuCarnet(d) {
  return !!(d && d.vehicule && d.vehicule !== true);
}
/* Ce que le véhicule coûte au kilomètre. La première version divisait tout
   par la même chose et se trompait d'un facteur vingt-quatre : treize mois
   de carburant rapportés à sept ans de kilomètres. Chaque coût a son propre
   dénominateur, et il n'y en a pas deux pareils :

   — l'entretien se rapporte à l'étendue que le carnet couvre réellement ;
   — le carburant ne se divise pas, il se modélise (consommation × prix) ;
   — l'achat et les frais uniques se répartissent sur ce qui reste à rouler
     avec, pas sur ce qui l'a déjà été : une carte grise payée hier ne coûte
     pas un euro du kilomètre parce qu'on n'a fait que cinq cents mètres ;
   — les frais annuels se rapportent aux kilomètres d'une année.

   Le total n'est donc pas une division mais une somme de taux. C'est lui qui
   sert à chiffrer un déplacement. */
function coutsVehicule() {
  var v = A.vehicule || {}, inf = v.infos || {}, cfg = A.cfg || {};

  var iv = (v.interventions || []).filter(function (x) { return !x.garantie; });
  var entretien = C.arr(iv.reduce(function (t, x) { return t + C.nb(x.montant); }, 0), 2);
  var kms = [];
  (v.releves || []).forEach(function (r) { if (C.nb(r.km)) kms.push(C.nb(r.km)); });
  (v.interventions || []).forEach(function (x) { if (C.nb(x.km)) kms.push(C.nb(x.km)); });
  var premier = kms.length ? Math.min.apply(null, kms) : 0;
  var dernier = kms.length ? Math.max.apply(null, kms) : 0;
  var etendue = Math.max(0, dernier - premier);
  var kmEntretien = etendue > 0 && entretien > 0 ? C.arr(entretien / etendue, 5) : null;

  /* Le carburant réellement payé sert à connaître le prix du litre, jamais à
     être divisé par des kilomètres qu'il n'a pas parcourus. */
  var moy = FIN.prixLitreMoyen(A.depenses, 'CARB');
  var prixL = moy ? moy.prix : (C.nb(cfg.prixLitre) || 1.75);
  var l100 = C.nb(cfg.litres100) || 9;
  var kmCarburant = C.arr(l100 / 100 * prixL, 5);

  /* Ce qu'il roulera encore avec : c'est là-dessus que se répartit ce qui se
     paie une fois. Sans les deux bornes, on ne répartit rien. */
  var kmAchat = C.nb(inf.kmAchat), kmRevente = C.nb(inf.kmRevente);
  var aRouler = kmRevente > kmAchat ? kmRevente - kmAchat : 0;
  var prixAchat = C.nb(inf.prixAchat);
  var kmAchatParKm = aRouler > 0 && prixAchat > 0 ? C.arr(prixAchat / aRouler, 5) : null;

  var uniques = 0, nUniques = 0, carbReel = 0, nCarb = 0;
  (A.depenses || []).forEach(function (d) {
    if (!depenseDuVehicule(d)) return;
    var lie = depenseLieeAuCarnet(d);
    (FIN.lignesDepense(d) || []).forEach(function (l) {
      var ht = FIN.htLigne(l);
      if (l.categorie === 'CARB') { carbReel += ht; nCarb++; return; }
      if (l.categorie === 'CARBPERSO') return;
      if (lie) return;
      uniques += ht; nUniques++;
    });
  });
  uniques = C.arr(uniques, 2);
  var kmUniques = aRouler > 0 && uniques > 0 ? C.arr(uniques / aRouler, 5) : null;

  var fraisAn = C.nb(inf.fraisAn), kmParAn = C.nb(inf.kmParAn);
  var kmAnnuel = fraisAn > 0 && kmParAn > 0 ? C.arr(fraisAn / kmParAn, 5) : null;

  var parts = [kmCarburant, kmEntretien, kmAchatParKm, kmUniques, kmAnnuel];
  var total = 0, connu = false;
  parts.forEach(function (p) { if (p != null) { total += p; connu = true; } });

  return {
    entretien: entretien, etendue: etendue, premier: premier, dernier: dernier,
    kmEntretien: kmEntretien,
    prixLitre: prixL, moyenne: moy, l100: l100, kmCarburant: kmCarburant,
    carbReel: C.arr(carbReel, 2), nCarb: nCarb,
    prixAchat: prixAchat, kmAchat: kmAchat, kmRevente: kmRevente, aRouler: aRouler,
    kmAchatParKm: kmAchatParKm,
    uniques: uniques, nUniques: nUniques, kmUniques: kmUniques,
    fraisAn: fraisAn, kmParAn: kmParAn, kmAnnuel: kmAnnuel,
    kmTotal: connu ? C.arr(total, 5) : null,
    /* Ce qui a coûté le plus cher, pour savoir où part l'argent. */
    plusChers: iv.slice().sort(function (a, b) { return C.nb(b.montant) - C.nb(a.montant); }).slice(0, 5)
  };
}
function centimes(v) {
  if (v == null) return '—';
  return E.fmt(C.arr(v * 100, 1), 1) + ' c€';
}
function renderCoutsV() {
  var z = $('#veh-couts'); if (!z) return;
  var c = coutsVehicule();
  /* Chaque ligne dit son taux et sur quoi il est bâti. Un chiffre au
     kilomètre dont on ignore le dénominateur ne se vérifie pas. */
  var ligne = function (nom, parKm, base, manque) {
    return '<div style="padding:7px 0;border-bottom:1px solid var(--trait)">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">' +
      '<span style="font-size:13.5px' + (parKm == null ? ';color:var(--gris)' : '') + '">' + nom + '</span>' +
      '<b class="num">' + (parKm != null ? centimes(parKm) : '—') + '</b></div>' +
      '<div class="muted" style="font-size:12px;margin-top:1px">' +
      (parKm != null ? base : '<span class="manque-v">' + manque + '</span>') + '</div></div>';
  };
  var km = kmVehicule();
  var faits = c.kmAchat && km > c.kmAchat ? km - c.kmAchat : 0;

  z.innerHTML =
    '<div class="carte"><h2>Ce que coûte un kilomètre</h2>' +
    '<div class="kpi" style="margin-top:0">' +
    '<div class="carte2"><b class="num">' + centimes(c.kmTotal) + '</b><small>du kilomètre, tout compris</small></div>' +
    '<div class="carte2"><b class="num">' +
    (c.kmTotal != null ? eur(C.arr(c.kmTotal * 100, 2)) : '—') + '</b><small>pour 100 km</small></div>' +
    '</div>' +
    '<p class="muted" style="font-size:12px;margin:10px 0 0">Ce n’est pas une division unique : ' +
    'chaque poste se rapporte à ce qui lui correspond. Le détail est en dessous, ligne à ligne.</p>' +
    '</div>' +

    '<div class="carte"><h2>D’où sort ce chiffre</h2>' +
    ligne('Carburant', c.kmCarburant,
      E.fmt(c.l100, 1) + ' L/100 km à ' + E.fmt(c.prixLitre, 3) + ' € le litre' +
      (c.moyenne
        ? ' — moyenne pondérée sur ' + c.moyenne.n + ' plein' + (c.moyenne.n > 1 ? 's' : '') +
          ' de ' + c.moyenne.total + ', soit ' + E.fmt(c.moyenne.litres, 0) + ' L'
        : ' — prix du réglage, faute de litres saisis'), '') +
    ligne('Entretien et réparations', c.kmEntretien,
      eur(c.entretien) + ' sur ' + E.fmt(c.etendue, 0) + ' km de carnet, de ' +
      E.fmt(c.premier, 0) + ' à ' + E.fmt(c.dernier, 0) + ' au compteur',
      'Aucune intervention chiffrée dans le carnet.') +
    ligne('Achat du véhicule', c.kmAchatParKm,
      eur(c.prixAchat) + ' réparti sur ' + E.fmt(c.aRouler, 0) + ' km — de ' +
      E.fmt(c.kmAchat, 0) + ' à votre achat jusqu’à ' + E.fmt(c.kmRevente, 0),
      'Renseignez le prix payé, le compteur à l’achat et jusqu’où vous comptez le garder.') +
    ligne('Carte grise et frais uniques', c.kmUniques,
      eur(c.uniques) + ' en ' + c.nUniques + ' dépense' + (c.nUniques > 1 ? 's' : '') +
      ', réparti sur ' + E.fmt(c.aRouler, 0) + ' km',
      c.uniques > 0
        ? 'Il manque jusqu’où vous comptez garder le véhicule.'
        : 'Aucune dépense en « Frais véhicule ».') +
    ligne('Assurance et frais annuels', c.kmAnnuel,
      eur(c.fraisAn) + ' par an pour ' + E.fmt(c.kmParAn, 0) + ' km par an',
      'Renseignez vos frais annuels et vos kilomètres par an.') +
    (c.kmTotal != null
      ? '<div style="display:flex;justify-content:space-between;margin-top:11px;padding-top:9px;' +
        'border-top:2px solid var(--encre)"><b>Total</b>' +
        '<b class="num" style="font-size:19px">' + centimes(c.kmTotal) + '</b></div>'
      : '') +
    '<p class="muted" style="font-size:11.5px;margin:11px 0 0">Le carburant « pro » et les ' +
    '« Frais véhicule » comptent d’office. Pour le reste, cochez « concerne le véhicule » ' +
    'sur la dépense. Une facture déjà notée dans le carnet n’est jamais comptée deux fois.</p>' +
    ((!c.kmAchatParKm || !c.kmAnnuel)
      ? '<div class="btn-rang" style="margin-top:11px">' +
        '<button class="btn btn-min" id="vc-infos">Compléter la fiche du véhicule</button></div>'
      : '') +
    '</div>' +

    (faits ? '<div class="carte"><h2>Depuis que vous l’avez</h2>' +
      '<div class="kpi" style="margin-top:0">' +
      '<div class="carte2"><b class="num">' + E.fmt(faits, 0) + '</b><small>km parcourus</small></div>' +
      '<div class="carte2"><b class="num">' +
      (c.kmTotal != null ? eur(C.arr(c.kmTotal * faits, 0)) : '—') + '</b><small>ce qu’ils vous ont coûté</small></div>' +
      '</div><p class="muted" style="font-size:11.5px;margin:10px 0 0">Au taux ci-dessus. ' +
      'Il reste ' + E.fmt(Math.max(0, c.kmRevente - km), 0) + ' km avant les ' +
      E.fmt(c.kmRevente, 0) + ' que vous visez.</p></div>' : '') +

    (c.carbReel ? '<div class="carte"><h2>Vos pleins</h2>' +
      '<div class="kpi" style="margin-top:0">' +
      '<div class="carte2"><b class="num">' + eur(c.carbReel) + '</b><small>payés en ' + c.nCarb +
      ' plein' + (c.nCarb > 1 ? 's' : '') + '</small></div>' +
      (c.moyenne ? '<div class="carte2"><b class="num">' + E.fmt(c.moyenne.prix, 3) +
        ' €</b><small>le litre, en moyenne</small></div>' : '') +
      '</div>' +
      (c.moyenne
        ? (c.moyenne.n < c.moyenne.total
          ? '<p class="muted" style="font-size:11.5px;margin:10px 0 0">' +
            (c.moyenne.total - c.moyenne.n) + ' plein' + (c.moyenne.total - c.moyenne.n > 1 ? 's' : '') +
            ' sans litres saisis, écarté' + (c.moyenne.total - c.moyenne.n > 1 ? 's' : '') +
            ' de la moyenne. Chaque ticket saisi la précise.</p>' : '')
        : '<p class="muted" style="font-size:11.5px;margin:10px 0 0">Aucun plein ne porte ses ' +
          'litres : le prix du litre vient du réglage. Notez-les sur la dépense pour obtenir ' +
          'votre vrai prix moyen.</p>') + '</div>' : '') +

    (c.plusChers.length ? '<div class="carte"><h2>Ce qui a coûté le plus</h2>' +
      c.plusChers.map(function (x) {
        return '<div style="padding:6px 0;border-bottom:1px solid var(--trait)">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
          '<span style="font-size:13.5px">' + esc(x.quoi || 'Intervention') + '</span>' +
          '<b class="num">' + eur(C.nb(x.montant)) + '</b></div>' +
          '<div class="muted" style="font-size:12px;margin-top:1px">' +
          new Date(x.date).toLocaleDateString('fr-FR') +
          (C.nb(x.km) ? ' · ' + E.fmt(C.nb(x.km), 0) + ' km' : '') + '</div></div>';
      }).join('') + '</div>' : '');

  if ($('#vc-infos')) $('#vc-infos').addEventListener('click', function () { ouvrirInfosVehicule(); });
}

function renderCarnetV() {
  var z = $('#veh-carnet'); if (!z) return;
  var v = A.vehicule || vehiculeDefaut();
  var km = kmVehicule();
  var iv = (v.interventions || []).slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
  var totalHT = iv.reduce(function (t2, x) { return t2 + (x.garantie ? 0 : C.nb(x.montant)); }, 0);
  z.innerHTML =
    '<div class="carte">' + teteBloc('Le véhicule', 'vh-infos', 'modifier') +
    '<h2 style="margin:0">' + esc((v.infos || {}).nom || 'Mon utilitaire') + '</h2>' +
    ((v.infos || {}).note ? '<p class="muted" style="font-size:12.5px;margin:3px 0 0">' +
      esc(v.infos.note) + '</p>' : '') +
    '<div class="kpi" style="margin-top:11px">' +
    '<div class="carte2"><b class="num">' + (km ? E.fmt(km, 0) : '—') + '</b><small>km au compteur</small></div>' +
    '<div class="carte2"><b class="num">' + iv.length + '</b><small>interventions</small></div>' +
    '<div class="carte2"><b class="num">' + (totalHT ? eur(C.arr(totalHT, 2)) : '—') +
    '</b><small>entretien hors garantie</small></div></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn btn-min" id="vh-releve">Noter le compteur</button></div></div>' +

    '<div class="carte"><div class="carte-titre"><h2>Historique</h2>' +
    '<button class="btn primaire btn-min" id="vh-plus">+ Intervention</button></div>' +
    '<p class="sous-titre-bloc">Chaque passage à l’atelier, avec son kilométrage. ' +
    'C’est lui qui nourrit les échéances de l’onglet d’à côté.</p>' +
    (iv.length ? iv.map(function (x) {
      return '<div class="liste-item"><div class="li-c"><b>' + esc(x.quoi || 'Intervention') + '</b>' +
        '<small>' + new Date(x.date).toLocaleDateString('fr-FR') +
        (C.nb(x.km) ? ' · ' + E.fmt(C.nb(x.km), 0) + ' km' : '') +
        (x.garantie ? ' · garantie' : (C.nb(x.montant) ? ' · ' + eur(C.nb(x.montant)) : '')) +
        (x.depense ? ' · dépense liée' : '') + '</small></div>' +
        '<button class="btn-min" data-vhmod="' + x.id + '">Modifier</button></div>';
    }).join('') : '<div class="vide"><p>Aucune intervention notée. Le carnet se remplit ' +
      'au fil des passages à l’atelier.</p></div>') + '</div>';
}
function renderEcheancesV() {
  var z = $('#veh-echeances'); if (!z) return;
  var km = kmVehicule();
  var items = echeancesVehicule().sort(function (x, y) {
    var r = { retard: 0, bientot: 1, ok: 2 };
    if (r[x.etat] !== r[y.etat]) return r[x.etat] - r[y.etat];
    return (x.rKm != null ? x.rKm : 1e9) - (y.rKm != null ? y.rKm : 1e9);
  });
  z.innerHTML = '<div class="carte"><div class="carte-titre"><h2>À prévoir</h2>' +
    '<button class="btn primaire btn-min" id="vh-posteplus">+ Poste</button></div>' +
    '<p class="sous-titre-bloc">Des ordres de grandeur, jamais une certitude : la fiche ' +
    'd’entretien du constructeur fait foi. Chaque périodicité se corrige sur place.</p>' +
    (km ? '' : '<div class="avis tiede">Notez le compteur dans le Carnet : sans kilométrage, ' +
      'rien ne peut être situé.</div>') +
    (items.length ? items.map(function (x) {
      var p = x.p, quand = [], dernier = [];
      if (x.rKm != null) quand.push(x.rKm <= 0 ? 'dépassée de ' + E.fmt(-x.rKm, 0) + ' km'
        : 'dans ' + E.fmt(x.rKm, 0) + ' km');
      if (x.rJours != null) quand.push(x.rJours <= 0 ? 'échue depuis ' + Math.abs(x.rJours) + ' j'
        : 'dans ' + x.rJours + ' j');
      if (C.nb(p.dernierKm)) dernier.push(E.fmt(C.nb(p.dernierKm), 0) + ' km');
      if (p.dernierDate) dernier.push(new Date(p.dernierDate).toLocaleDateString('fr-FR'));
      return '<div class="liste-item">' +
        '<span class="pastille" style="background:' + (x.etat === 'retard' ? 'var(--alerte)'
          : x.etat === 'bientot' ? '#B98A00' : '#2E7D46') + ';margin-top:4px"></span>' +
        '<div class="li-c"><b>' + esc(p.nom) + (quand.length ? ' — ' + quand.join(', ') : '') + '</b>' +
        '<small>' + (dernier.length ? 'fait à ' + dernier.join(' · ') : 'jamais fait') +
        (C.nb(p.pkm) ? ' · tous les ' + E.fmt(C.nb(p.pkm), 0) + ' km' : '') +
        (C.nb(p.pmois) ? ' · tous les ' + C.nb(p.pmois) + ' mois' : '') + '</small></div>' +
        '<button class="btn-min" data-vhposte="' + p.id + '">Modifier</button></div>';
    }).join('') : '<div class="vide"><p>Aucun poste suivi.</p></div>') + '</div>';
}
function ouvrirInfosVehicule() {
  var v = A.vehicule, inf = v.infos || {};
  modale('Le véhicule',
    '<div class="champ"><label class="eyebrow" for="vn-nom">Nom</label>' +
    '<input type="text" id="vn-nom" class="gros" autocomplete="off" placeholder="mon utilitaire" value="' +
    esc(inf.nom || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vn-note">Repères</label>' +
    '<input type="text" id="vn-note" autocomplete="off" placeholder="immatriculation, mise en circulation…" value="' +
    esc(inf.note || '') + '"></div>' +
    /* Ce qui se paie une fois ne se divise pas par les kilomètres déjà
       faits : il faut savoir de quel compteur à quel compteur il sera à lui. */
    '<p class="eyebrow" style="margin:15px 0 7px">Ce qu’il vous coûte</p>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="vn-kma">Compteur à l’achat</label>' +
    '<input type="text" id="vn-kma" inputmode="numeric" placeholder="0 si neuf" value="' +
    (inf.kmAchat ? inf.kmAchat : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vn-prix">Prix payé (€)</label>' +
    '<input type="text" id="vn-prix" inputmode="decimal" value="' +
    (inf.prixAchat != null && inf.prixAchat !== '' ? esc(String(inf.prixAchat).replace('.', ',')) : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vn-kmr">Gardé jusqu’à (km)</label>' +
    '<input type="text" id="vn-kmr" inputmode="numeric" placeholder="300 000" value="' +
    (inf.kmRevente ? inf.kmRevente : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vn-kman">Kilomètres par an</label>' +
    '<input type="text" id="vn-kman" inputmode="numeric" value="' +
    (inf.kmParAn ? inf.kmParAn : '') + '"></div>' +
    '</div>' +
    '<div class="champ"><label class="eyebrow" for="vn-fan">Assurance et frais annuels (€/an)</label>' +
    '<input type="text" id="vn-fan" inputmode="decimal" value="' +
    (inf.fraisAn != null && inf.fraisAn !== '' ? esc(String(inf.fraisAn).replace('.', ',')) : '') + '">' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0" id="vn-aide-fan"></p></div>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Le prix payé et la borne de ' +
    'revente servent à répartir l’achat et la carte grise. Sans eux, ces postes restent vides ' +
    'plutôt que de sortir un chiffre faux. Tout reste sur votre téléphone.</p>' +
    '<div class="btn-rang" style="margin-top:11px"><button class="btn primaire" id="vn-ok">Enregistrer</button></div>');
  /* Ce qu'il paie déjà en assurance sur douze mois est une base bien meilleure
     qu'un chiffre de tête — mais elle se propose, elle ne s'impose pas. */
  (function () {
    var an = Date.now() - 365 * C.JOUR, s = 0;
    (A.depenses || []).forEach(function (d) {
      if (!d.vehicule || C.nb(d.date) < an) return;
      (FIN.lignesDepense(d) || []).forEach(function (l) {
        if (l.categorie === 'ASSUR') s += FIN.htLigne(l);
      });
    });
    if (s > 0 && $('#vn-aide-fan')) {
      $('#vn-aide-fan').textContent = 'Vos assurances marquées « véhicule » sur douze mois : ' +
        E.fmt(C.arr(s, 2), 2) + ' €.';
    }
  })();
  $('#vn-ok').addEventListener('click', function () {
    var kma = C.nb($('#vn-kma').value), kmr = C.nb($('#vn-kmr').value);
    if (kmr > 0 && kmr <= kma) { toast('La borne de revente doit dépasser le compteur d’achat.'); return; }
    v.infos = { nom: $('#vn-nom').value.trim(), note: $('#vn-note').value.trim(),
      kmAchat: kma || null, prixAchat: C.nb($('#vn-prix').value) || null,
      kmRevente: kmr || null, kmParAn: C.nb($('#vn-kman').value) || null,
      fraisAn: C.nb($('#vn-fan').value) || null };
    sauverVehicule().then(function () {
      fermerModale(); renderCarnetV(); renderCoutsV(); toast('Véhicule enregistré.');
    });
  });
}
function ouvrirReleveV() {
  modale('Le compteur',
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="vr-km">Kilométrage</label>' +
    '<input type="text" id="vr-km" class="gros" inputmode="numeric" autocomplete="off"></div>' +
    '<div class="champ"><label class="eyebrow" for="vr-date">Relevé le</label>' +
    '<input type="date" id="vr-date" value="' + versChamp(Date.now()) + '"></div></div>' +
    '<div class="btn-rang" style="margin-top:9px"><button class="btn primaire" id="vr-ok">Noter</button></div>');
  $('#vr-ok').addEventListener('click', function () {
    var k = C.nb($('#vr-km').value);
    if (!(k > 0)) { toast('Kilométrage attendu.'); return; }
    A.vehicule.releves = A.vehicule.releves || [];
    A.vehicule.releves.push({ id: uid(), km: k, date: versDate($('#vr-date').value) || Date.now() });
    sauverVehicule().then(function () {
      fermerModale(); renderCarnetV(); renderEcheancesV(); renderAujourdhui(); toast('Compteur noté.');
    });
  });
}
function ouvrirInterventionV(id) {
  var v = A.vehicule;
  var x = id ? (v.interventions || []).filter(function (i) { return i.id === id; })[0] : null;
  if (id && !x) return;
  var postesSel = x && x.postes ? x.postes.slice() : [];
  modale(x ? 'Modifier l’intervention' : 'Nouvelle intervention',
    '<div class="champ"><label class="eyebrow" for="vi-quoi">Ce qui a été fait</label>' +
    '<input type="text" id="vi-quoi" class="gros" autocomplete="off" ' +
    'placeholder="révision, plaquettes, courroie…" value="' + esc(x ? x.quoi : '') + '"></div>' +
    '<div class="grille g3">' +
    '<div class="champ"><label class="eyebrow" for="vi-date">Date</label>' +
    '<input type="date" id="vi-date" value="' + versChamp(x ? x.date : Date.now()) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vi-km">Kilométrage</label>' +
    '<input type="text" id="vi-km" inputmode="numeric" value="' + (x && x.km ? x.km : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vi-mont">Montant HT (€)</label>' +
    '<input type="text" id="vi-mont" inputmode="decimal" value="' +
    (x && x.montant != null ? esc(String(x.montant).replace('.', ',')) : '') + '"></div></div>' +
    '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin:2px 0 9px">' +
    '<input type="checkbox" id="vi-gar"' + (x && x.garantie ? ' checked' : '') + '> Pris sous garantie</label>' +
    '<label class="eyebrow" style="display:block;margin-bottom:5px">Cette intervention couvre</label>' +
    '<div class="chips" id="vi-postes">' + (v.postes || []).map(function (p) {
      return '<button type="button" class="chip" data-vip="' + p.id + '" aria-pressed="' +
        (postesSel.indexOf(p.id) >= 0) + '">' + esc(p.nom) + '</button>';
    }).join('') + '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Les postes cochés repartent ' +
    'de ce kilométrage pour leur prochaine échéance.</p>' +
    (x && x.depense
      ? '<p class="muted" style="font-size:12px;margin:9px 0 0">Une dépense est liée à cette intervention.</p>'
      : '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin:9px 0 0">' +
        '<input type="checkbox" id="vi-dep"> Créer la dépense correspondante</label>') +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="vi-ok">Enregistrer</button>' +
    (x ? '<button class="btn danger btn-min" id="vi-sup">Supprimer</button>' : '') + '</div>');
  $('#vi-postes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-vip]'); if (!b) return;
    var i2 = postesSel.indexOf(b.dataset.vip);
    if (i2 >= 0) postesSel.splice(i2, 1); else postesSel.push(b.dataset.vip);
    b.setAttribute('aria-pressed', String(i2 < 0));
  });
  $('#vi-ok').addEventListener('click', function () {
    var quoi = $('#vi-quoi').value.trim();
    if (!quoi) { toast('Dites ce qui a été fait.'); return; }
    var maj = { quoi: quoi, date: versDate($('#vi-date').value) || Date.now(),
      km: C.nb($('#vi-km').value) || null, montant: C.nb($('#vi-mont').value) || null,
      garantie: $('#vi-gar').checked, postes: postesSel.slice() };
    if (x) { Object.keys(maj).forEach(function (k) { x[k] = maj[k]; }); }
    else { maj.id = uid(); v.interventions.push(maj); x = maj; }
    /* Les postes couverts repartent d'ici : c'est ce qui nourrit l'échéance. */
    (v.postes || []).forEach(function (p) {
      if (postesSel.indexOf(p.id) < 0) return;
      if (maj.km && maj.km >= C.nb(p.dernierKm)) p.dernierKm = maj.km;
      if (!p.dernierDate || maj.date >= p.dernierDate) p.dernierDate = maj.date;
    });
    var creeDep = $('#vi-dep') && $('#vi-dep').checked && !x.depense;
    var apres = function () {
      sauverVehicule().then(function () {
        fermerModale(); renderCarnetV(); renderEcheancesV(); renderAujourdhui();
        toast(creeDep ? 'Intervention notée, dépense créée — vérifiez sa TVA dans les Dépenses.'
          : 'Intervention notée.');
      });
    };
    if (creeDep) {
      /* La dépense part en « Frais véhicule », TVA 20 % par défaut — le garage
         facture presque toujours ainsi — et se corrige dans les Dépenses. Le
         carnet raisonne en hors taxes, la dépense en TTC : la TVA se rajoute
         ici, sans quoi elle serait sous-déclarée d'un cinquième.
         Le lien empêche la suggestion inverse de la réclamer, et empêche
         surtout que le coût au kilomètre compte le même argent deux fois. */
      var dp = { id: uid(), date: maj.date, fournisseur: '', vehicule: x.id, maj: Date.now(),
        lignes: [{ libelle: quoi, categorie: 'VEHIC',
          ttc: C.arr(C.nb(maj.montant) * 1.2, 2), taux: 20 }] };
      x.depense = dp.id;
      A.depenses.push(dp);
      sauverDepenses().then(function () { renderDepenses(); renderFinances(); apres(); });
    } else { apres(); }
  });
  if (id) {
    $('#vi-sup').addEventListener('click', function () {
      if (!confirm('Supprimer cette intervention ?')) return;
      v.interventions = v.interventions.filter(function (i) { return i.id !== id; });
      sauverVehicule().then(function () {
        fermerModale(); renderCarnetV(); renderEcheancesV(); toast('Intervention supprimée.');
      });
    });
  }
}
function ouvrirPosteV(id) {
  var v = A.vehicule;
  var p = id ? (v.postes || []).filter(function (x) { return x.id === id; })[0] : null;
  if (id && !p) return;
  modale(p ? 'Modifier le poste' : 'Nouveau poste',
    '<div class="champ"><label class="eyebrow" for="vp-nom">Poste</label>' +
    '<input type="text" id="vp-nom" class="gros" autocomplete="off" value="' + esc(p ? p.nom : '') + '"></div>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="vp-pkm">Tous les (km)</label>' +
    '<input type="text" id="vp-pkm" inputmode="numeric" placeholder="—" value="' +
    (p && p.pkm ? p.pkm : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vp-pmois">Ou tous les (mois)</label>' +
    '<input type="text" id="vp-pmois" inputmode="numeric" placeholder="—" value="' +
    (p && p.pmois ? p.pmois : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vp-dkm">Dernier fait (km)</label>' +
    '<input type="text" id="vp-dkm" inputmode="numeric" placeholder="jamais" value="' +
    (p && p.dernierKm ? p.dernierKm : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="vp-ddate">Dernier fait le</label>' +
    '<input type="date" id="vp-ddate" value="' + (p && p.dernierDate ? versChamp(p.dernierDate) : '') + '"></div></div>' +
    '<div class="btn-rang" style="margin-top:9px">' +
    '<button class="btn primaire" id="vp-ok">Enregistrer</button>' +
    (p ? '<button class="btn danger btn-min" id="vp-sup">Retirer</button>' : '') + '</div>');
  $('#vp-ok').addEventListener('click', function () {
    var nom = $('#vp-nom').value.trim();
    if (!nom) { toast('Nommez le poste.'); return; }
    var maj = { nom: nom, pkm: C.nb($('#vp-pkm').value) || null, pmois: C.nb($('#vp-pmois').value) || null,
      dernierKm: C.nb($('#vp-dkm').value) || null, dernierDate: versDate($('#vp-ddate').value) };
    if (p) { Object.keys(maj).forEach(function (k) { p[k] = maj[k]; }); }
    else { maj.id = uid(); v.postes.push(maj); }
    sauverVehicule().then(function () { fermerModale(); renderEcheancesV(); toast('Poste enregistré.'); });
  });
  if (p) {
    $('#vp-sup').addEventListener('click', function () {
      if (!confirm('Retirer « ' + p.nom + ' » du suivi ?')) return;
      v.postes = v.postes.filter(function (x) { return x.id !== id; });
      sauverVehicule().then(function () { fermerModale(); renderEcheancesV(); toast('Poste retiré.'); });
    });
  }
}

