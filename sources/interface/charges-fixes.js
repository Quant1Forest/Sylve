/* ==================================================== CHARGES FIXES */
function charge(id) { return A.charges.filter(function (c) { return c.id === id; })[0] || null; }
function sauverCharges() { return ecrire('bordcub.charges', A.charges); }

function renderCharges() {
  var z = $('#charges-resume'); if (!z) return;
  var actives = A.charges.filter(function (c) { return !c.arretee; });
  if (!A.charges.length) {
    z.innerHTML = '<div class="vide"><p>Aucune charge fixe. Prêt bancaire, assurances, ' +
      'logiciels : décrivez-les une fois, leurs échéances apparaîtront toutes seules.</p></div>';
    $('#charges-echeances').innerHTML = '';
    return;
  }
  var annuel = FIN.totalChargesAnnuel(A.charges);
  z.innerHTML = '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + eur(annuel) + '</b><small>par an</small></div>' +
    '<div class="carte2"><b class="num">' + eur(FIN.arr(annuel / 12, 2)) + '</b><small>par mois en moyenne</small></div>' +
    '<div class="carte2"><b class="num">' + actives.length + '</b><small>charge' + (actives.length > 1 ? 's' : '') + '</small></div>' +
    '</div>' +
    grapheChargesMois(A.charges) +
    grapheChargesCategories(A.charges) +
    '<div style="margin-top:12px">' + A.charges.slice().sort(function (a, b) {
      return FIN.coutAnnuel(b) - FIN.coutAnnuel(a);
    }).map(function (c) {
      /* Une grille plutôt qu'une rangée souple : la pastille, le texte et les
         montants tombent chacun sur leur colonne, donc les montants
         s'alignent au chiffre près d'une ligne à l'autre. */
      return '<div class="charge-l' + (c.arretee ? ' epuise' : '') + '">' +
        '<span class="pastille" style="background:' + coulCategorie(c.categorie) +
        '" title="' + esc(FIN.nomCategorie(c.categorie)) + '"></span>' +
        '<div><span class="charge-n">' + esc(c.libelle || 'Charge') + '</span>' +
        '<span class="charge-q">' + esc(quandCharge(c)) + '</span>' +
        '<span class="charge-p">' + esc(FIN.nomCategorie(c.categorie)) +
        (c.beneficiaire ? ' · payé à ' + esc(c.beneficiaire) : '') +
        (FIN.sansTvaDe(c.categorie) ? ' · sans TVA'
          : ' · TVA ' + String(C.nb(c.taux)).replace('.', ',') + ' %') +
        (chargeDansDepenses(c) ? ' · portée en dépense' : '') +
        (c.arretee ? ' · arrêtée' : '') + '</span></div>' +
        '<div style="text-align:right"><span class="charge-m num">' + eur(C.nb(c.ttc)) + '</span>' +
        '<span class="charge-a num">' + eur(FIN.coutAnnuel(c)) + '/an</span></div>' +
        '<div class="charge-act">' +
        '<button class="btn-min" data-chgmod="' + c.id + '">Modifier</button>' +
        '<button class="btn-min" data-chgsup="' + c.id + '">Supprimer</button></div></div>';
    }).join('') + '</div>';

  var b = periodeCourante();
  var dues = FIN.chargesDues(A.charges, A.depenses, b);
  var maintenant = C.minuit(Date.now());
  /* Plus rien à pointer : la case de la charge a déjà répondu, et les
     échéances passées sont devenues des dépenses toutes seules. Cette liste
     ne fait plus que rendre compte. */
  var avecTva = dues.filter(function (d) {
    return d.date <= maintenant && chargeDansDepenses(d.charge) && C.nb(d.charge.taux) > 0;
  });
  var tvaTotal = avecTva.reduce(function (s, d) {
    return s + FIN.nb(d.ttc) - FIN.nb(d.ttc) / (1 + C.nb(d.charge.taux) / 100);
  }, 0);
  $('#charges-echeances').innerHTML = dues.length
    ? '<p class="muted" style="font-size:12.5px;margin:0 0 9px">' + esc(libellePeriode()) + ' — ' +
      dues.length + ' prélèvement' + (dues.length > 1 ? 's' : '') +
      (avecTva.length ? ', dont ' + avecTva.length + ' en dépense avec ' +
        eur(FIN.arr(tvaTotal, 2)) + ' de TVA à récupérer' : ', aucune TVA à récupérer') + '.</p>' +
      dues.map(function (d) {
        var passe = d.date <= maintenant;
        var porte = chargeDansDepenses(d.charge);
        return '<div class="liste-item"><span class="pastille" style="background:' +
          coulCategorie(d.charge.categorie) + '"></span>' +
          '<div class="li-c"><b>' + esc(d.charge.libelle || '') + '</b>' +
          '<small>' + dateCourte(d.date) + ' · ' + (passe ? 'prélevé' : 'à venir') +
          (passe && porte ? ' · en dépense' : '') + '</small></div>' +
          '<span class="num" style="margin-left:auto;white-space:nowrap">' + eur(d.ttc) + '</span>' +
          '</div>';
      }).join('') +
      '<p class="muted" style="font-size:12px;margin:9px 0 0">Rien à pointer : ce qui doit ' +
      'entrer dans les dépenses se décide sur la charge elle-même, une fois pour toutes.</p>'
    : '<p class="muted" style="font-size:12.5px">Aucune échéance sur cette période.</p>';
}

/* Une couleur par catégorie de charge. La liste et les deux graphiques y
   puisent : c'est ce qui fait qu'un bâton de mars et une ligne de la liste
   se reconnaissent d'un coup d'œil. */
var COUL_CATEGORIE = {
  PRET: '#8A5A2B', ASSUR: '#1D6FB8', ABO: '#2E7D46', BANQUE: '#B98A00',
  ADMIN: '#7A8471', COTIS: '#5B3A1E', AUTRE: '#9AA294'
};
function coulCategorie(c) { return COUL_CATEGORIE[c] || '#7A8471'; }

/* « Tous les mois » ne dit pas quand. Ce qu'on cherche des yeux, c'est le
   jour où le compte est débité. */
function quandCharge(c) {
  var j = Number(c.jour) || 1;
  if (c.periodicite === 'mensuel') return 'le ' + j + ' de chaque mois';
  if (c.periodicite === 'annuel') {
    return 'le ' + j + ' ' + MOIS_ABBR[Number(c.moisReference) || 0] + ' de chaque année';
  }
  if (c.periodicite === 'trimestriel') return 'le ' + j + ', tous les trimestres';
  if (c.periodicite === 'semestriel') return 'le ' + j + ', tous les six mois';
  return FIN.nomPeriodicite(c.periodicite);
}

/* Ce qui tombe du compte, mois par mois, sur l'année en cours. */
function chargesParMois(charges, annee) {
  var jan = new Date(annee, 0, 1, 12).getTime();
  var dec = new Date(annee, 11, 31, 12).getTime();
  var mois = [];
  for (var i = 0; i < 12; i++) mois.push({});
  (charges || []).forEach(function (c) {
    if (c.arretee) return;
    FIN.echeances(c, { debut: jan, fin: dec }).forEach(function (ts) {
      var m = new Date(ts).getMonth(), k = c.categorie || 'AUTRE';
      mois[m][k] = C.nb(mois[m][k]) + C.nb(c.ttc);
    });
  });
  return mois;
}
/* Ordre d'empilement figé sur celui des catégories : sans ça les couleurs
   changeraient de place d'un mois à l'autre et le graphique deviendrait
   illisible. */
function ordreCategories(o) {
  var rang = {};
  FIN.CATEGORIES.forEach(function (c, i) { rang[c.c] = i; });
  return Object.keys(o).sort(function (a, b) {
    return (rang[a] == null ? 99 : rang[a]) - (rang[b] == null ? 99 : rang[b]);
  });
}
function totalMois(o) {
  return Object.keys(o).reduce(function (s, k) { return s + C.nb(o[k]); }, 0);
}
/* Le détail d'un mois, en toutes lettres : un bâton de treize pixels ne peut
   pas porter de pourcentage, mais la phrase en dessous, oui. */
function detailMoisCharges(mois, m) {
  var o = mois[m], tot = totalMois(o);
  if (!(tot > 0)) return '<b>' + MOIS_NOMS[m] + '</b> — rien ne tombe ce mois-ci.';
  var parts = ordreCategories(o).sort(function (a, b) { return o[b] - o[a]; })
    .map(function (k) {
      return esc(FIN.nomCategorie(k).toLowerCase()) + ' ' +
        Math.round(o[k] / tot * 100) + ' %';
    });
  return '<b>' + MOIS_NOMS[m] + ' — ' + eur(FIN.arr(tot, 2)) + '</b> : ' + parts.join(', ') + '.';
}
function grapheChargesMois(charges) {
  var annee = new Date().getFullYear();
  var mois = chargesParMois(charges, annee);
  var totaux = mois.map(totalMois);
  var max = Math.max.apply(null, totaux.concat([0]));
  if (!(max > 0)) return '';
  var haut = paliersJoli(max);
  var H = 150, padB = 16, padT = 8, padL = 40, W = 320 + padL;
  var lm = (W - padL) / 12, lb = 13;
  var hUtile = H - padB - padT;
  var yDe = function (v) { return H - padB - (v / haut) * hUtile; };

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:460px;margin-top:9px">';
  [0, haut / 2, haut].forEach(function (v) {
    var y = yDe(v);
    svg += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) +
      '" stroke="var(--trait)" stroke-width="1"' + (v > 0 ? ' stroke-dasharray="2 3"' : '') + '/>' +
      '<text x="' + (padL - 4) + '" y="' + (y + 3).toFixed(1) +
      '" font-size="8.5" text-anchor="end" fill="var(--doux)">' + xmlEsc(eurCourt(v)) + '</text>';
  });
  var vues = {};
  for (var m = 0; m < 12; m++) {
    var x = padL + m * lm + (lm - lb) / 2, bas = H - padB;
    ordreCategories(mois[m]).forEach(function (k) {
      var v = C.nb(mois[m][k]), h = (v / haut) * hUtile;
      if (!(h > 0)) return;
      vues[k] = 1; bas -= h;
      svg += '<rect x="' + x.toFixed(1) + '" y="' + bas.toFixed(1) + '" width="' + lb +
        '" height="' + h.toFixed(1) + '" fill="' + coulCategorie(k) + '"><title>' +
        xmlEsc(MOIS_NOMS[m] + ' — ' + FIN.nomCategorie(k) + ' : ' + eur(v)) + '</title></rect>';
    });
    /* Toute la colonne répond au doigt, pas seulement le bâton : viser treize
       pixels au pouce ne marche pas. */
    svg += '<rect x="' + (padL + m * lm).toFixed(1) + '" y="' + padT + '" width="' + lm.toFixed(1) +
      '" height="' + hUtile + '" fill="transparent" data-chgmois="' + m + '" style="cursor:pointer"/>' +
      '<text x="' + (padL + m * lm + lm / 2).toFixed(1) + '" y="' + (H - 4) +
      '" font-size="7.5" text-anchor="middle" fill="var(--doux)">' + MOIS_ABBR[m] + '</text>';
  }
  svg += '</svg>';

  var plusCharge = totaux.indexOf(max);
  return '<div class="carte2" style="margin-top:12px;padding:11px">' +
    '<p class="eyebrow" style="margin:0">Quand l’argent part <span class="muted" ' +
    'style="font-weight:400;text-transform:none;letter-spacing:0">— ' + annee + '</span></p>' +
    svg +
    '<div class="legende" style="margin-top:4px">' + ordreCategories(vues).map(function (k) {
      return '<span><i style="background:' + coulCategorie(k) + '"></i>' +
        esc(FIN.nomCategorie(k)) + '</span>';
    }).join('') + '</div>' +
    '<p class="muted" style="font-size:12px;margin:7px 0 0" id="chg-mois-detail">' +
    detailMoisCharges(mois, plusCharge) + '</p>' +
    '<p class="muted" style="font-size:11px;margin:3px 0 0">Appuyez sur un mois pour ' +
    'son détail. Les mensuelles font le socle, les annuelles les pics.</p></div>';
}
function grapheChargesCategories(charges) {
  var actives = (charges || []).filter(function (c) { return !c.arretee; });
  if (!actives.length) return '';
  var parCat = {};
  actives.forEach(function (c) {
    var k = c.categorie || 'AUTRE';
    parCat[k] = C.nb(parCat[k]) + FIN.coutAnnuel(c);
  });
  var tot = Object.keys(parCat).reduce(function (s, k) { return s + parCat[k]; }, 0);
  if (!(tot > 0)) return '';
  var lignes = Object.keys(parCat).map(function (k) {
    return { nom: FIN.nomCategorie(k), valeur: FIN.arr(parCat[k], 2),
      part: Math.round(parCat[k] / tot * 100), couleur: coulCategorie(k) };
  }).sort(function (a, b) { return b.valeur - a.valeur; });
  return '<div class="carte2" style="margin-top:9px;padding:11px">' +
    '<p class="eyebrow" style="margin:0 0 9px">Où il part <span class="muted" ' +
    'style="font-weight:400;text-transform:none;letter-spacing:0">— coût annuel par ' +
    'catégorie</span></p>' + barres(lignes) +
    '<p class="muted" style="font-size:12px;margin:2px 0 0">Tout ramené à l’année : c’est ' +
    'la seule échelle qui compare une assurance annuelle à un logiciel mensuel.</p></div>';
}

/* Le formulaire ne demandait qu'un jour et un mois : sans année, un
   abonnement souscrit en septembre 2024 était indiscernable d'un souscrit
   deux ans plus tard, et les échéances remontaient depuis toujours. Les
   charges d'avant sont recalées sur l'année en cours — approximatif, mais
   moins faux que rien, et il suffit de rouvrir la fiche pour corriger. */
function debutCharge(c) {
  if (c.debut) return c.debut;
  if (c.jour == null && c.moisReference == null) return null;
  return new Date(new Date().getFullYear(), Number(c.moisReference || 0),
    Math.min(Number(c.jour) || 1, 28), 12).getTime();
}
function ouvrirCharge(id) {
  var c = id ? charge(id) : { periodicite: 'mensuel', taux: 20, categorie: 'ASSUR' };
  if (!c) return;
  modale(id ? 'Modifier la charge' : 'Nouvelle charge fixe',
    '<div class="champ"><label class="eyebrow" for="cg-lib">Libellé</label>' +
    '<input type="text" id="cg-lib" class="gros" autocomplete="off" placeholder="assurance RC pro, prêt matériel…" value="' + esc(c.libelle || '') + '"></div>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="cg-benef">Payé à</label>' +
    '<input type="text" id="cg-benef" autocomplete="off" placeholder="l’assureur, la banque…" value="' + esc(c.beneficiaire || '') + '"></div>' +
    /* « Montant TTC » n'a pas de sens sur des frais bancaires ou un
       remboursement de prêt : sans TVA, il n'y a ni HT ni TTC, juste un
       montant. Le libellé suit donc la catégorie. */
    '<div class="champ"><label class="eyebrow" for="cg-ttc" id="cg-ttc-lab">Montant (€)</label>' +
    '<input type="text" id="cg-ttc" class="gros" inputmode="decimal" value="' +
    (c.ttc != null ? esc(String(c.ttc).replace('.', ',')) : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="cg-per">Périodicité</label>' +
    '<select id="cg-per">' + FIN.PERIODICITES.map(function (p) {
      return '<option value="' + p.c + '"' + (c.periodicite === p.c ? ' selected' : '') + '>' + p.n + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="cg-debut">Date du premier paiement</label>' +
    '<input type="date" id="cg-debut" value="' + versChamp(debutCharge(c)) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="cg-taux">TVA</label>' +
    '<select id="cg-taux">' + FIN.TAUX_TVA.map(function (t) {
      return '<option value="' + t + '"' + (C.nb(c.taux) === t ? ' selected' : '') + '>' + (t ? t + ' %' : 'sans TVA') + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="cg-cat">Catégorie</label>' +
    '<select id="cg-cat">' + FIN.categoriesFixes(c.categorie).map(function (x) {
      return '<option value="' + x.c + '"' + (c.categorie === x.c ? ' selected' : '') + '>' + x.n + '</option>';
    }).join('') + '</select></div>' +
    '</div>' +
    '<div class="carte2" id="cg-apercu" style="margin:11px 0"></div>' +
    /* Une charge prélevée automatiquement n'a pas à être pointée tous les
       mois. La seule question qui vaille se pose une fois, ici : est-ce que
       cette charge doit entrer dans les dépenses ? Et la réponse tient à la
       TVA — c'est en devenant une dépense qu'elle devient récupérable. Un
       remboursement de prêt n'a rien à y faire. */
    '<label class="ligne-check" style="display:flex;align-items:flex-start;gap:8px;font-size:13.5px;margin-top:11px">' +
    '<input type="checkbox" id="cg-dep"' + (chargeDansDepenses(c) ? ' checked' : '') + ' style="margin-top:2px">' +
    '<span>Enregistrer les échéances dans les dépenses' +
    '<span class="muted" style="display:block;font-size:11.5px" id="cg-dep-aide"></span></span></label>' +
    '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin-top:11px">' +
    '<input type="checkbox" id="cg-arret"' + (c.arretee ? ' checked' : '') + '> Charge arrêtée</label>' +
    '<div class="btn-rang" style="margin-top:11px"><button class="btn primaire" id="cg-ok">Enregistrer</button></div>');

  var apercu = function () {
    var t = C.nb($('#cg-ttc').value), p = $('#cg-per').value;
    var an = FIN.coutAnnuel({ ttc: t, periodicite: p });
    $('#cg-apercu').innerHTML = t
      ? '<b class="num" style="font-size:19px">' + eur(an) + '</b> par an' +
        '<div class="muted" style="font-size:12px">soit ' + eur(FIN.arr(an / 12, 2)) + ' par mois</div>'
      : '<span class="muted">Indiquez le montant.</span>';
  };
  $('#cg-ttc').addEventListener('input', apercu);
  $('#cg-per').addEventListener('change', apercu);
  apercu();

  /* Une assurance, des frais bancaires ou un remboursement de prêt ne portent
     aucune TVA : le champ se met à zéro et se ferme, plutôt que de laisser
     saisir une taxe qu'on ne récupérera jamais. Le libellé du montant et la
     case des dépenses suivent la même bascule — sans TVA, rien à récupérer,
     donc rien à porter en dépense. */
  var catAvant = $('#cg-cat').value;
  var majTva = function () {
    var cat = $('#cg-cat').value;
    var sans = FIN.sansTvaDe(cat), sel = $('#cg-taux'), dep = $('#cg-dep');
    sel.disabled = sans;
    if (sans) sel.value = '0';
    $('#cg-ttc-lab').textContent = sans ? 'Montant (€)' : 'Montant TTC (€)';
    /* Changer de catégorie change la réponse par défaut : on suit la TVA,
       il reste libre de décocher derrière. */
    if (cat !== catAvant) { dep.checked = !sans; catAvant = cat; }
    majObligation();
  };
  /* Cochée sur une catégorie qui porte de la TVA, la case rend le taux
     obligatoire : une dépense à 0 % n'apporte rien à récupérer, et c'est
     l'oubli le plus facile à commettre. */
  var majObligation = function () {
    var sel = $('#cg-taux'), aide = $('#cg-dep-aide');
    var sans = FIN.sansTvaDe($('#cg-cat').value);
    var manque = $('#cg-dep').checked && !sans && C.nb(sel.value) <= 0;
    sel.style.borderColor = manque ? '#B4231F' : '';
    sel.style.background = manque ? '#F7E6D9' : '';
    aide.textContent = sans
      ? 'Sans TVA : rien à récupérer, donc rien à porter en dépense.'
      : manque ? 'Choisissez le taux de TVA : c’est lui qu’on récupère.'
        : $('#cg-dep').checked
          ? 'Chaque échéance passée devient une dépense, depuis le premier paiement.'
          : 'Les échéances resteront hors des dépenses.';
  };
  $('#cg-cat').addEventListener('change', majTva);
  $('#cg-dep').addEventListener('change', majObligation);
  $('#cg-taux').addEventListener('change', majObligation);
  majTva();
  $('#cg-ok').addEventListener('click', function () {
    var lib = $('#cg-lib').value.trim();
    if (!lib) { toast('Donnez un libellé.'); return; }
    var t = C.nb($('#cg-ttc').value);
    if (t <= 0) { toast('Montant attendu.'); return; }
    var deb = versDate($('#cg-debut').value);
    if (!deb) { toast('Indiquez la date du premier paiement.'); return; }
    /* Le jour et le mois restent en base : c'est sur eux que le cycle des
       échéances se cale. La date les porte tous les deux, plus l'année. */
    var dd = new Date(deb);
    var cat = $('#cg-cat').value;
    var sans = FIN.sansTvaDe(cat);
    var dansDep = $('#cg-dep').checked;
    /* Porter une charge en dépense sans son taux ne récupère rien : on le
       réclame ici plutôt que de laisser passer une TVA à zéro. */
    if (dansDep && !sans && C.nb($('#cg-taux').value) <= 0) {
      toast('Choisissez le taux de TVA, ou décochez l’enregistrement en dépense.');
      majObligation(); $('#cg-taux').focus();
      return;
    }
    var maj = { libelle: lib, beneficiaire: $('#cg-benef').value.trim(), ttc: t,
      periodicite: $('#cg-per').value, debut: deb,
      jour: dd.getDate(), moisReference: dd.getMonth(),
      taux: sans ? 0 : C.nb($('#cg-taux').value),
      categorie: cat, dansDepenses: dansDep,
      arretee: $('#cg-arret').checked, maj: Date.now() };
    if (id) { Object.keys(maj).forEach(function (k) { c[k] = maj[k]; }); }
    else { maj.id = uid(); A.charges.push(maj); }
    sauverCharges()
      .then(synchroniserDepensesCharges)
      .then(function (n) {
        fermerModale(); renderCharges(); renderDepenses(); renderFinances(); renderAccueil();
        toast(id ? 'Charge modifiée.' : 'Charge enregistrée.');
        if (n > 0) toast(n + ' échéance' + (n > 1 ? 's portées' : ' portée') + ' en dépense.');
      });
  });
}

/* La case n'existait pas avant la 4.37. Une charge qui porte de la TVA avait
   vocation à entrer dans les dépenses — c'est bien pour ça qu'on la pointait
   à la main — donc c'est la réponse qu'on lui prête. */
function chargeDansDepenses(c) {
  if (!c) return false;
  if (c.dansDepenses != null) return !!c.dansDepenses;
  return !FIN.sansTvaDe(c.categorie) && C.nb(c.taux) > 0;
}

/* Une charge cochée « dans les dépenses » n'a plus à être pointée tous les
   mois : ses échéances déjà passées SONT des dépenses, et elles en découlent.
   Même mécanique que la sortie de stock d'une facture — jamais saisie,
   refaite à chaque modification, marquée « auto » pour ne jamais toucher à ce
   qui a été entré à la main.
   Trois règles qui protègent l'historique :
   — rien n'est créé au-delà d'aujourd'hui : on ne paie pas une échéance à venir ;
   — une échéance déjà pointée à la main est laissée telle quelle, sinon la
     même dépense serait comptée deux fois et la TVA doublerait ;
   — décocher la case ne retire que les dépenses automatiques. */
function synchroniserDepensesCharges() {
  /* La borne est la fin d'aujourd'hui, pas son début : une échéance est
     horodatée à midi, si bien qu'un prélèvement qui tombe le jour même
     restait « à venir » toute la journée et n'entrait dans les dépenses que
     le lendemain. Même famille que les quatre comptes de jours en
     millisecondes : on comparait une heure à une frontière de jour. */
  var jusqua = C.minuit(Date.now()) + C.JOUR - 1;
  var cle = function (idCharge, ts) { return idCharge + '|' + ts; };
  var attendues = [];
  (A.charges || []).forEach(function (c) {
    if (!chargeDansDepenses(c) || c.arretee || !c.debut) return;
    FIN.echeances(c, { debut: c.debut, fin: jusqua }).forEach(function (ts) {
      attendues.push({ charge: c, ts: ts });
    });
  });
  var autos = {};
  A.depenses.forEach(function (d) {
    if (d.auto && d.charge && d.echeance) autos[cle(d.charge, d.echeance)] = d;
  });
  var manuelles = A.depenses.filter(function (d) { return d.charge && !d.auto; });
  var dejaALaMain = function (c, ts) {
    return manuelles.some(function (d) {
      return d.charge === c.id && Math.abs(C.nb(d.date) - ts) < 20 * 86400000;
    });
  };
  var signature = function (d) {
    var l = (d.lignes || [])[0] || {};
    return [d.date, d.fournisseur || '', l.libelle || '', l.categorie || '',
      C.nb(l.ttc), C.nb(l.taux)].join('|');
  };
  var vues = {}, crees = 0, touchees = 0;
  attendues.forEach(function (a) {
    var k = cle(a.charge.id, a.ts);
    vues[k] = 1;
    if (dejaALaMain(a.charge, a.ts)) return;
    var d = autos[k], neuve = !d;
    if (neuve) {
      d = { id: uid(), auto: true, charge: a.charge.id, echeance: a.ts };
      A.depenses.push(d);
    }
    var avant = neuve ? '' : signature(d);
    d.date = a.ts;
    d.fournisseur = a.charge.beneficiaire || '';
    d.lignes = [{ libelle: a.charge.libelle || 'Charge fixe',
      categorie: a.charge.categorie || 'AUTRE',
      ttc: C.nb(a.charge.ttc), taux: C.nb(a.charge.taux) }];
    if (neuve) { crees++; d.maj = Date.now(); }
    else if (signature(d) !== avant) { touchees++; d.maj = Date.now(); }
  });
  var avantN = A.depenses.length;
  A.depenses = A.depenses.filter(function (d) {
    if (!d.auto || !d.charge) return true;
    return !!vues[cle(d.charge, d.echeance)];
  });
  var retirees = avantN - A.depenses.length;
  if (!crees && !touchees && !retirees) return Promise.resolve(0);
  return sauverDepenses().then(function () { return crees; });
}



