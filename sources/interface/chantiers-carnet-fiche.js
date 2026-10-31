/* ------------------------------------------------------------- le carnet */
function renderCarnet() {
  var z = $('#carnet-totaux'); if (!z) return;
  var t = C.totaux(A.chantiers, A.cfg);
  if (!A.chantiers.length) {
    z.innerHTML = '<div class="vide"><p>Aucun chantier. Créez une fiche : elle sert de devis, ' +
      'puis suit le chantier jusqu’au paiement.</p></div>';
  } else {
    /* Un seul chiffre par tuile, le compte en légende : deux nombres côte à
       côte et on ne sait plus lequel on lit. */
    var n = function (x, mot, invariable) {
      return x ? ' · ' + x + ' ' + mot + (x > 1 && !invariable ? 's' : '') : '';
    };
    var pd = premierDonneur(A.chantiers, A.cfg, t.caFacture);
    z.innerHTML = '<div class="kpi kpi2">' +
      '<div class="carte2"><b class="num">' + eur(t.caFacture) + '</b><small>facturé' +
      n(t.nFactures, 'facture') + '</small></div>' +
      '<div class="carte2"><b class="num">' + eur(t.encaisse) + '</b><small>encaissé</small></div>' +
      '<div class="carte2"><b class="num">' + (t.nSignes || '—') + '</b><small>devis signé' +
      (t.nSignes > 1 ? 's' : '') + (t.nSignes ? ' · ' + eur(t.signes) : ', à planifier') +
      '</small></div>' +
      /* Qui le fait vivre. Le pourcentage est l'information : un donneur
         d'ordre à soixante pour cent n'est pas un client, c'est un risque. */
      '<div class="carte2"><b class="num">' + (pd ? eur(pd.montant) : '—') +
      '</b><small>' + (pd
        ? esc(pd.nom) + (pd.part != null ? ' · ' + pd.part + '\u00A0%' : '')
        : 'premier donneur d’ordre') + '</small></div>' +
      '</div>' +
      /* « En cours » est le nom d'un statut : l'employer pour compter tout ce
         qui n'est pas soldé faisait annoncer « 31 en cours » avec un seul
         chantier à ce statut. Le mot du filtre est le bon. */
      '<p class="muted" style="font-size:12px;margin:11px 0 0">' + t.ouverts + ' chantier' +
      (t.ouverts > 1 ? 's' : '') + ' ouvert' + (t.ouverts > 1 ? 's' : '') +
      ' · ' + E.fmt(t.jours, 1) + ' jours-homme cumulés' +
      (t.nAFacturer ? ' · <b>' + t.nAFacturer + ' à facturer</b>' : '') +
      (t.retard ? ' · <span class="retard">' + t.retard + ' aux jours passés</span>' : '') + '</p>';
  }
  renderFiltreChantiers();
  renderListeChantiers();
  renderAlertes();
  renderAujourdhui();
}
function premierDonneur(chantiers, cfg, total) {
  var l = C.parDonneur(chantiers, cfg)
    .filter(function (e) { return e.facture > 0; })
    .sort(function (a, b) { return b.facture - a.facture; });
  if (!l.length) return null;
  var e = l[0];
  return { nom: e.donneur, montant: e.facture,
    part: total > 0 ? Math.round(e.facture / total * 100) : null };
}
function renderFiltreChantiers() {
  var s = $('#c-filtre'); if (!s) return;
  var f = A.filtreCh || 'ouverts';
  var incomplets = A.chantiers.filter(function (c) { return !C.ficheComplete(c); }).length;
  /* Les statuts étaient à plat : avec des dizaines de chantiers presque tous
     payés, on ne savait plus à quelle famille chacun appartenait. Ils se
     rangent sous « En cours » et « Clos », comme le sélecteur de la fiche. */
  var opt = function (o) {
    return '<option value="' + o[0] + '"' + (f === o[0] ? ' selected' : '') + '>' +
      esc(o[1]) + ' (' + o[2] + ')</option>';
  };
  /* Dans l'ordre qu'il a dicté : tout, avec devis, ouverts, clos, puis ce
     qui reste à faire. */
  var nf = function (q) { return C.filtre(A.chantiers, q).length; };
  var tete = [['tous', 'Tous', A.chantiers.length]];
  var avecDevis = nf('avecdevis');
  if (avecDevis) tete.push(['avecdevis', 'Avec devis', avecDevis]);
  tete.push(['ouverts', 'Chantiers ouverts', nf('ouverts')],
    ['clos', 'Chantiers clos', nf('clos')],
    ['afaire', 'En cours ou à planifier', nf('afaire')]);
  if (incomplets) tete.push(['acompleter', 'À compléter', incomplets]);
  /* Les familles tout en bas : « c'est le truc que je vais utiliser le moins
     souvent ». */
  var fams = C.CAT_TRAVAUX.map(function (x) { return ['fam:' + x.c, x.n, nf('fam:' + x.c)]; })
    .filter(function (o) { return o[2] > 0; });
  var ouv = [], clos = [];
  C.STATUTS.forEach(function (st) {
    var n = C.filtre(A.chantiers, st.c).length;
    if (!n) return;
    (C.statutOuvert(st.c) ? ouv : clos).push([st.c, st.n, n]);
  });
  /* Le groupe s'appelait « En cours » et rangeait les facturés dedans :
     « dans en cours, j'ai encore tous les chantiers que j'ai finis ». Il
     porte le nom du filtre qu'il détaille. */
  s.innerHTML = tete.map(opt).join('') +
    (ouv.length ? '<optgroup label="Ouverts">' + ouv.map(opt).join('') + '</optgroup>' : '') +
    (clos.length ? '<optgroup label="Clos">' + clos.map(opt).join('') + '</optgroup>' : '') +
    (fams.length ? '<optgroup label="Familles de travaux">' + fams.map(opt).join('') + '</optgroup>' : '');
}
function renderTriChantiers() {
  var s = $('#c-tri'); if (!s) return;
  var v = A.triCh || 'auto';
  s.innerHTML = C.TRIS_CH.map(function (o) {
    return '<option value="' + o.c + '"' + (v === o.c ? ' selected' : '') + '>' +
      esc(o.n) + '</option>';
  }).join('');
}
function renderListeChantiers() {
  var z = $('#liste-chantiers'); if (!z) return;
  renderTriChantiers();
  var q = (A.rechCh || '').trim();
  /* Une recherche passe outre le filtre : un numéro de facture appartient
     presque toujours à un chantier payé, donc rangé hors des « ouverts ».
     Taper le bon numéro et ne rien voir sortir serait le pire des deux. */
  var vieux = !!A.triAncien, crit = A.triCh || 'auto';
  var l = q ? C.tri(C.chercher(A.chantiers, q), vieux, crit)
    : C.tri(C.filtre(A.chantiers, A.filtreCh || 'ouverts'), vieux, crit);
  var bs = $('#c-sens');
  if (bs) bs.textContent = vieux ? '↑ plus ancien d’abord' : '↓ plus récent d’abord';
  if (!l.length) {
    z.innerHTML = '<div class="vide"><p>' + (q
      ? 'Rien qui corresponde à « ' + esc(q) +' ».'
      : 'Aucun chantier dans cette vue.') + '</p></div>';
    return;
  }
  var now = Date.now();
  z.innerHTML = l.map(function (c) {
    var m = C.montant(c), retard = C.enRetard(c, now), tauxCh = C.tauxChantier(c);
    var manque = C.champsManquants(c);
    var trav = (c.lignes || []).map(function (x) { return C.nomTravail(x.travail); });
    var uniq = trav.filter(function (v, i) { return trav.indexOf(v) === i; });
    var place = C.totalPlace(c);
    return '<div class="chantier-l">' +
      '<span class="pastille" style="background:' + (COUL_STATUT[c.statut] || '#7A8471') +
      '" title="' + esc(C.nomStatut(c.statut, c)) + '"></span>' +
      '<div><span class="chantier-n">' + esc(C.nomChantier(c)) + '</span>' +
        '<span class="chantier-d">' + esc([c.donneur || c.client, c.foret,
          c.parcelles ? 'p. ' + c.parcelles : '',
          /* La première prestation est dans le titre ; les autres se disent
             sans se lister, sinon la ligne double de longueur. */
          uniq.length > 1 ? 'et ' + (uniq.length - 1) + ' autre prestation' +
            (uniq.length > 2 ? 's' : '') : '']
          .filter(Boolean).join(' · ') || 'sans donneur d’ordre') +
        '</span>' +
      '<span class="chantier-d">' + esc(datesCh(c).concat(
        place ? [E.fmt(place, place % 1 ? 1 : 0) + ' j placée' + (place > 1 ? 's' : '')] : [],
        (c.echeance || c.fin) ? ['avant le ' + dateCourte(c.echeance || c.fin)] : []
      ).join(' · ')) + '</span>' +
      /* Le badge et sa date tiennent toujours sur leur propre ligne, quel que
         soit ce qui précède : sinon les lignes de longueur inégale font danser
         les badges d'un chantier à l'autre. */
      '<span class="chantier-e">' +
      /* Le numéro de facture est ce par quoi il retrouve un chantier réglé :
         il doit se lire dans la liste, pas seulement sur la fiche. */
      (c.numeroFacture ? '<span class="num-fact">n° ' + esc(c.numeroFacture) + '</span> ' : '') +
      badgeStatut(c) +
      (retard ? ' <span class="retard">jours passés</span>' : '') +
      /* Une fiche à moitié remplie se perd dans le carnet : elle se signale,
         sans jamais empêcher de l'enregistrer telle quelle. */
      (manque.length ? ' <span class="acompleter">à compléter</span>' : '') +
      '</span></div>' +
      /* Hors taxes et TTC tous les deux en gros : le premier fait le chiffre
         d'affaires et les déclarations, le second est ce que le client paie. */
      '<span class="chantier-m num">' + (m
        ? '<b>' + eur(m) + ' HT</b><b>' + eur(C.ttcChantier(c)) + ' TTC</b>' +
          '<small>TVA ' + (tauxCh != null
            ? String(tauxCh).replace('.', ',') + ' %\u00A0· ' : 'mêlée\u00A0· ') +
          eur(C.tvaChantier(c)) + '</small>'
        : '') + '</span>' +
      '<div class="chantier-act">' +
      '<button class="btn-min" data-chouvrir="' + c.id + '">Ouvrir</button>' +
      '<button class="btn-min" data-chtemps="' + c.id + '">Temps</button>' +
      '<button class="btn-min" data-chstatut="' + c.id + '">Statut</button></div></div>';
  }).join('') +
    (q ? '<p class="muted" style="font-size:12px;margin:9px 0 0">' + l.length + ' chantier' +
      (l.length > 1 ? 's' : '') + ' sur ' + A.chantiers.length + ' — la recherche regarde tout ' +
      'le carnet, statut compris.</p>' : '');
}

/* ------------------------------------------------- du chantier au stock
   Une ligne de fourniture qui désigne un produit fait sortir ce produit du
   stock. La sortie n'est pas saisie : elle découle de la facture, et se
   refait à chaque modification — corriger 300 plants en 350 corrige la
   sortie. Son état suit celui du chantier (VENTE_DE_CHANTIER), donc rien
   ne quitte vraiment le stock avant que le chantier soit fait.

   Sur un produit dosé, la ligne compte des plants et le stock des
   millilitres : la quantité facturée reste celle que lit le client, la
   conversion se fait ici. */
function lignesStockDe(c) {
  return (c.lignes || []).map(function (l) {
    var a = article(l.article); if (!a) return null;
    var q = C.nb(l.quantite), d = ST.nb(a.dosage);
    if (!(q > 0)) return null;
    return { article: a.id, qte: d > 0 ? ST.arr(q * d, 3) : q,
      prix: d > 0 ? ST.arr(C.nb(l.prix) / d, 5) : C.nb(l.prix) };
  }).filter(Boolean);
}
function sortieAutoDe(c) {
  return (A.sorties || []).filter(function (s) { return s.auto && s.chantier === c.id; })[0] || null;
}
/* Une sortie saisie à la main, ou reprise du carnet, sur ce même chantier.
   Les chantiers importés en portent déjà une : y ajouter une sortie
   automatique retirerait deux fois le même produit du stock, sans que rien
   ne le signale. On s'arrête plutôt que de compter double. */
function sortieManuelleDe(c) {
  return (A.sorties || []).filter(function (s) {
    return !s.auto && s.chantier === c.id && (s.lignes || []).length;
  })[0] || null;
}
/* Rend une promesse : l'appelant enchaîne sur son propre enregistrement.
   Résout sur 'double' quand une sortie existante empêche la synchronisation. */
function synchroniserStock(c) {
  if (!c) return Promise.resolve(false);
  var lignes = lignesStockDe(c);
  var s = sortieAutoDe(c);
  if (lignes.length && !s && sortieManuelleDe(c)) return Promise.resolve('double');
  if (!lignes.length) {
    if (!s) return Promise.resolve(false);
    A.sorties = A.sorties.filter(function (x) { return x !== s; });
    return sauverSorties().then(function () { indexerStock(); return true; });
  }
  if (!s) {
    s = { id: uid(), auto: true, chantier: c.id, num: c.numeroFacture || '',
      client: c.donneur || c.proprietaire || '', perte: false, debours: false,
      statut: 'fini', lignes: [], date: 0, maj: 0 };
    A.sorties.push(s);
  }
  s.lignes = lignes;
  s.num = c.numeroFacture || '';
  s.client = c.donneur || c.proprietaire || '';
  s.date = C.dernierEvenement(c) || Date.now();
  s.maj = Date.now();
  return sauverSorties().then(function () { indexerStock(); return true; });
}

/* -------------------------------------------------------------- la fiche */
function ouvrirChantier(id) {
  A.chOuvert = id;
  renderFiche();
  /* Ouvrir une fiche, c'est quitter les menus. Sans ce retrait, une fiche
     ouverte depuis « À traiter » alors qu'on est déjà dans le module
     s'affichait sous un bandeau masqué par « accueil-ouvert » : plus de
     bouton retour, plus de sélecteur de partie, aucun moyen de ressortir. */
  document.body.classList.remove('accueil-ouvert');
  if (A.module === 'chantiers') aller('chantier');
  else allerModule('chantiers', 'chantier');
}
/* Les travaux rangés par famille. Quarante-cinq lignes à plat, il fallait les
   parcourir toutes pour retrouver la sienne. Les fournitures ont leur propre
   groupe : leur famille vient de la nature de la ligne, pas des travaux. */
function optionsTravaux(sel, opt) {
  opt = opt || {};
  var dispo = C.TRAVAUX.filter(function (t) {
    return (!t.retire || t.c === sel) && !(opt.sansFournitures && t.fourniture);
  });
  var une = function (t) {
    return '<option value="' + t.c + '"' + (sel === t.c ? ' selected' : '') + '>' +
      esc(t.n) + '</option>';
  };
  var groupe = function (nom, l) {
    return l.length ? '<optgroup label="' + esc(nom) + '">' + l.map(une).join('') + '</optgroup>' : '';
  };
  var h = opt.vide ? '<option value="">— prestation —</option>' : '';
  C.CAT_TRAVAUX.forEach(function (cat) {
    h += groupe(cat.n, dispo.filter(function (t) {
      return !t.fourniture && t.cat === cat.c;
    }));
  });
  h += groupe('Fourniture', dispo.filter(function (t) { return t.fourniture; }));
  /* « Autre » et les prestations qu'il a créées lui-même n'ont pas de famille
     tant qu'il ne leur en donne pas une dans les réglages. */
  h += groupe('Sans famille', dispo.filter(function (t) {
    return !t.fourniture && !C.nomCatTravail(t.cat);
  }));
  return h;
}

/* Le sélecteur en haut de la fiche : passer d'un chantier à l'autre sans
   repasser par le carnet. Les chantiers ouverts d'abord, les clos ensuite —
   c'est presque toujours dans les ouverts qu'il veut aller. */
/* L'ordre du carnet, pour le sélecteur comme pour les voisins : numéro de
   facture d'abord, dates ensuite. Trier par « maj » remontait un chantier dès
   qu'on l'ouvrait pour le corriger — l'ordre paraissait dû au hasard. */
/* Le sélecteur de la fiche et « Précédente / Suivante » suivent le même ordre
   que le carnet : deux ordres différents pour la même liste, et le voisin
   annoncé ne serait pas celui qu'on vient de voir. */
function chantiersOrdonnes() {
  return C.tri(A.chantiers || [], !!A.triAncien, A.triCh || 'auto');
}

/* Fiche précédente et suivante, dans ce même ordre. */
function boutonsVoisins(id) {
  /* Toujours du plus ancien au plus récent : c'est l'ordre des factures, et il
     ne doit pas dépendre du sens d'affichage du carnet. */
  var l = C.tri(A.chantiers || [], true);
  if (l.length < 2) return '';
  var i = -1;
  l.forEach(function (c, k) { if (c.id === id) i = k; });
  if (i < 0) return '';
  var prec = i > 0 ? l[i - 1] : null, suiv = i < l.length - 1 ? l[i + 1] : null;
  /* Sens rétabli le 23 août : « précédente », c'est la facture d'avant, et
     « suivante » celle d'après. Ils suivent l'ordre des factures et non la
     position dans la liste, sinon le bouton qui retourne le carnet
     inverserait aussi leur sens. */
  var bouton = function (c, mot, cote) {
    return '<button class="btn btn-min" ' + (c ? 'data-voisin="' + esc(c.id) + '"' : 'disabled') +
      ' style="flex:1;text-align:' + cote + '" title="' + esc(c ? C.nomChantier(c) : '') + '">' +
      esc(mot) + '</button>';
  };
  return '<div class="btn-rang" style="margin-top:9px;gap:7px">' +
    bouton(prec, '‹ Précédente', 'left') +
    '<span class="muted num" style="flex:none;align-self:center;font-size:11.5px">' +
    (i + 1) + ' / ' + l.length + '</span>' +
    bouton(suiv, 'Suivante ›', 'right') + '</div>';
}

function optionsChantiers(sel) {
  var ouv = [], clos = [];
  chantiersOrdonnes().forEach(function (c) {
    var lieu = [c.commune, c.foret].filter(Boolean).join(', ');
    var o = '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' +
      esc(C.nomChantier(c)) + (lieu ? ' — ' + esc(lieu) : '') +
      ' · ' + esc(C.nomStatut(c.statut, c)) + '</option>';
    (C.statutOuvert(c.statut) ? ouv : clos).push(o);
  });
  return (ouv.length ? '<optgroup label="En cours">' + ouv.join('') + '</optgroup>' : '') +
    (clos.length ? '<optgroup label="Clos">' + clos.join('') + '</optgroup>' : '');
}

/* L'en-tête d'un bloc : son étape, et le crayon qui n'ouvre que ses champs.
   Un bloc dont l'étape n'est pas atteinte reste visible mais en retrait — on
   voit le chemin qui reste sans être encombré. */
function teteBloc(titre, idBouton, mot) {
  return '<div class="tete-bloc"><span class="etape-bloc">' + esc(titre) + '</span>' +
    (idBouton ? '<button class="modif-bloc" id="' + idBouton + '">' +
      esc(mot || 'modifier') + ' ✎</button>' : '') + '</div>';
}
function paireFiche(nom, valeur) {
  return '<div class="paire-fiche"><span>' + esc(nom) + '</span><span class="num">' +
    esc(String(valeur)) + '</span></div>';
}
/* Ce que le chantier vaut, puis ce qu'il a rapporté : le même bloc, dont les
   mots changent avec l'étape. Avant, c'est une intention ; après, un constat.
   L'estimation reste donc lisible tout du long — c'est elle qui dit si la
   journée a tenu ce qu'elle promettait. */
/* Ses numéros ont toujours la même forme : « F-2026-0016 », « D-2026-0042 ».
   Il ne doit taper que le chiffre — 16 — et l'application met les zéros.
   L'année reste modifiable : une facture se saisit parfois après le
   31 décembre. Le préfixe, lui, ne bouge pas : devis et facture, ça ne
   change pas de nom. */
var LARGEUR_RANG = 4;
function decomposerNumero(v) {
  var s = String(v || '').trim();
  var m = s.match(/(\d{4})\D+(\d+)\s*$/);
  if (m) return { an: m[1], rang: String(Number(m[2])) };
  /* Un numéro d'une autre forme n'est pas perdu : on en garde les derniers
     chiffres et on lui rend l'année en cours. */
  m = s.match(/(\d+)\s*$/);
  return { an: String(new Date().getFullYear()), rang: m ? String(Number(m[1])) : '' };
}
function composerNumero(prefixe, an, rang) {
  var r = String(rang == null ? '' : rang).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!r) return '';
  while (r.length < LARGEUR_RANG) r = '0' + r;
  var a = String(an == null ? '' : an).replace(/\D/g, '');
  return prefixe + '-' + (a || new Date().getFullYear()) + '-' + r;
}
/* Le suivant, d'après ce qui existe déjà pour cette année-là. Proposé quand
   le champ est vide, jamais imposé : il numérote parfois hors séquence. */
function prochainRang(prefixe, an, sauf) {
  var champ = prefixe === 'D' ? 'numeroDevis' : 'numeroFacture';
  var max = 0;
  (A.chantiers || []).forEach(function (c) {
    if (sauf && c.id === sauf) return;
    if (!c[champ]) return;
    var d = decomposerNumero(c[champ]);
    if (d.an !== String(an)) return;
    var r = Number(d.rang) || 0;
    if (r > max) max = r;
  });
  return max + 1;
}
function champNumero(prefixe, base, valeur, intitule) {
  var d = decomposerNumero(valeur);
  return '<div class="champ"><label class="eyebrow" for="' + base + '-rg">' + esc(intitule) + '</label>' +
    '<div class="numcomp">' +
    '<span class="pref">' + prefixe + '</span><span class="pref">–</span>' +
    '<input type="text" class="an num" id="' + base + '-an" inputmode="numeric" ' +
    'autocomplete="off" value="' + esc(d.an) + '">' +
    '<span class="pref">–</span>' +
    '<input type="text" class="rg num" id="' + base + '-rg" inputmode="numeric" ' +
    'autocomplete="off" value="' + esc(d.rang) + '">' +
    '</div><p class="apercu-num" id="' + base + '-vu"></p></div>';
}
function brancherNumero(prefixe, base, chantierId) {
  var an = $('#' + base + '-an'), rg = $('#' + base + '-rg'), vu = $('#' + base + '-vu');
  if (!an || !rg || !vu) return;
  var propose = null;
  if (!rg.value.trim()) {
    propose = prochainRang(prefixe, an.value.trim(), chantierId);
    rg.value = String(propose);
  }
  var maj = function () {
    var n = composerNumero(prefixe, an.value, rg.value);
    vu.innerHTML = n
      ? 'Ce sera <b>' + esc(n) + '</b>' + (propose != null
        ? '<span class="muted"> — proposé d’après vos numéros de ' + esc(an.value.trim()) + '.</span>' : '')
      : '<span class="muted">Tapez votre numéro : les zéros se mettent tout seuls.</span>';
  };
  [an, rg].forEach(function (x) { x.addEventListener('input', function () { propose = null; maj(); }); });
  maj();
}
function lireNumero(prefixe, base) {
  var an = $('#' + base + '-an'), rg = $('#' + base + '-rg');
  return (an && rg) ? composerNumero(prefixe, an.value, rg.value) : '';
}

/* Le devis signé ne bouge plus. Au moment où le chantier bascule en facturé,
   on garde une photo de ses lignes : c'est elle qui permet de dire, plus
   tard, laquelle a été ajoutée ou modifiée — sans jamais tenir deux listes.
   « On ne comprend pas à quel endroit il y a eu le changement. »
   La photo n'est prise qu'au passage, jamais sur un chantier déjà facturé :
   figer l'existant appellerait « devis » ce qui n'en a jamais été un. */
function figerDevis(c) {
  if (!c || c.devisFige || !C.aDevis(c)) return false;
  (c.lignes || []).forEach(function (l) { if (!l.uid) l.uid = uid(); });
  c.devisFige = { date: Date.now(), total: C.montant(c),
    lignes: (c.lignes || []).map(function (l) {
      return { uid: l.uid, montant: C.montantLigne(l), quantite: C.nb(l.quantite),
        prix: C.nb(l.prix), unite: l.unite, titre: l.note || C.nomTravauxLigne(l) };
    }) };
  return true;
}
/* Une ligne apparue après la photo n'a pas d'identifiant dedans : c'est ce
   qui la désigne comme ajoutée, sans avoir à la marquer à la saisie. */
function changementLigne(c, l) {
  if (!c.devisFige) return null;
  var av = null;
  (c.devisFige.lignes || []).forEach(function (x) {
    if (x.uid && l.uid && x.uid === l.uid) av = x;
  });
  if (!av) return { quoi: 'ajout' };
  if (C.arr(C.montantLigne(l), 2) !== C.arr(av.montant, 2)) return { quoi: 'chg', avant: av };
  return null;
}
function lignesRetirees(c) {
  if (!c.devisFige) return [];
  var vus = {};
  (c.lignes || []).forEach(function (l) { if (l.uid) vus[l.uid] = 1; });
  return (c.devisFige.lignes || []).filter(function (x) { return x.uid && !vus[x.uid]; });
}

function blocValeur(c, m, pj, vise) {
  var solde = ['termine', 'facture', 'paye'].indexOf(c.statut) >= 0;
  /* Le temps saisi, pas les journées posées à l'agenda : celles-ci disent
     qu'on y était, pas combien de temps on y a passé. Le bloc affichait les
     secondes pendant que les rendements lisaient le premier. */
  var saisi = C.tempsMoi(c, A.cfg);
  var fait = C.tempsPasse(c, A.cfg), est = C.joursPrevus(c);
  var jours = solde ? fait : est;
  var parJour = jours > 0 ? m / jours : 0;
  /* Dire d'où sort le chiffre : « faites » quand il vient du temps noté,
     « facturées » quand seule la facture en parle — c'est le cas de tous les
     chantiers repris du carnet. */
  var motJours = solde ? (saisi > 0 ? 'journées faites' : 'journées facturées')
    : 'journées estimées';
  return '<div class="carte"><h2>' + (solde ? 'Ce que ça a rapporté' : 'Ce que ça vaut') +
    '</h2><p class="sous-titre-bloc">Rien à saisir ici : tout vient du bloc des travaux, ' +
    'plus bas. Ce bloc ne fait que le lire.</p>' +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + (m ? eur(m) : '—') + '</b><small>' +
    (solde ? (c.statut === 'paye' ? 'encaissé' : 'facturé') : 'proposé') + '</small></div>' +
    '<div class="carte2"><b class="num">' + (jours ? E.fmt(jours, jours % 1 ? 1 : 0) : '—') +
    '</b><small>' + motJours + '</small></div>' +
    '<div class="carte2"><b class="num"' +
    (parJour && vise && parJour < vise ? ' style="color:#B4231F"' : '') + '>' +
    (parJour ? eur(C.arr(parJour, 0)) : '—') + '</b><small>par journée</small></div>' +
    '</div>' +
    (vise && parJour
      ? '<p class="muted" style="font-size:12px;margin:9px 0 0">Votre objectif est de ' +
        eur(vise) + (parJour >= vise ? ' : ce chantier passe au-dessus.'
          : ' : ce chantier reste en dessous.') + '</p>'
      : '') +
    (solde && !fait
      ? '<p class="muted" style="font-size:12px;margin:6px 0 0">Aucun temps noté : ' +
        'le bloc « Le temps passé », plus bas, dit ce que le chantier vous a pris.</p>'
      : (!solde && !est
        ? '<p class="muted" style="font-size:12px;margin:6px 0 0">Aucune journée estimée : ' +
          'sans elle, rien ne dit ce que la journée doit rapporter.</p>'
        : '')) + '</div>';
}
/* Un seul bloc pour les travaux, et il change de nom avec l'étape — comme
   « Ce que ça vaut » change de mot. Il n'y a jamais deux listes de lignes à
   tenir : « les travaux sont liés au devis ou à la facture, c'est net ».
   Le devis n'est pas perdu quand la facture arrive : il se replie en bas,
   avec son numéro et ce qu'il disait. */
function etapeTravaux(c) {
  if (C.rangStatut(c.statut) >= C.rangStatut('facture') || c.numeroFacture || c.dateFacture) {
    return 'facture';
  }
  return C.aDevis(c) ? 'devis' : 'todo';
}
function ligneTravaux(c, l, i) {
  /* Quand la ligne porte une précision, c'est elle le titre : c'est le texte
     qui figure sur la facture du client. Le travail reste dessous — il sert au
     taux de TVA et aux rendements — sans masquer ce qui a été vendu.
     Un forfait groupé porte plusieurs travaux : « détourage + élagage ». */
  var titre = l.note ? l.note : C.nomTravauxLigne(l);
  var q = l.unite === 'forfait' ? 'forfait'
    : E.fmt(C.nb(l.quantite), C.nb(l.quantite) % 1 ? 2 : 0) + ' ' + C.courtUnite(l.unite) +
      ' × ' + E.fmt(C.nb(l.prix), 2) + ' €';
  var chg = changementLigne(c, l);
  return '<div class="ligne-trav"><div><b>' + esc(titre) + '</b>' +
    (chg ? ' <span class="marque-l ' + chg.quoi + '">' +
      (chg.quoi === 'ajout' ? 'ajoutée' : 'modifiée') + '</span>' : '') +
    '<div class="muted" style="font-size:12px">' +
    (l.note ? esc(C.nomTravauxLigne(l)) + ' · ' : '') + esc(q) +
    ' · TVA ' + String(C.tauxLigne(l, c)).replace('.', ',') + ' %' +
    (l.nature === 'vente' ? ' · fourniture' : '') +
    /* Un débours ne se distinguait en rien d'une prestation : impossible de
       vérifier qu'il était bien écarté du chiffre d'affaires. */
    (l.nature === 'debours' ? ' · <b>débours</b>, hors chiffre d’affaires' : '') +
    (l.tva != null && l.tva !== '' ? ' (forcé)' : '') +
    (l.difficulte ? ' · difficulté ' + C.nb(l.difficulte) + '/5' : '') + '</div>' +
    (chg && chg.quoi === 'chg'
      ? '<div class="dit-avant">Le devis disait ' + eur(chg.avant.montant) + '.</div>' : '') +
    '</div>' +
    '<div style="text-align:right"><b class="num">' + eur(C.montantLigne(l)) + '</b><br>' +
    '<button class="btn-min" data-lmod="' + i + '">Modifier</button> ' +
    '<button class="btn-min" data-lsup="' + i + '">✕</button></div></div>';
}
/* « Ce qui peut être intéressant, c'est de savoir à partir du moment où le
   devis est signé, sous combien de temps je réalise les travaux. » Il compte
   en jours de calendrier, pas en millisecondes : une signature du 2 à 23 h et
   un chantier fini le 3 au matin font un jour, pas zéro. */
function delaiRealisation(c) {
  if (!c.dateSignature) return '';
  var fin = C.dateChantier(c);
  if (!fin || fin < c.dateSignature) return '';
  var n = Math.round((C.minuit(fin) - C.minuit(c.dateSignature)) / C.JOUR);
  return '<div class="l"><span>Réalisé en</span><b class="num">' +
    (n <= 0 ? 'moins d’un jour' : n + ' jour' + (n > 1 ? 's' : '')) +
    '</b></div>';
}
function blocTravaux(c) {
  var e = etapeTravaux(c);
  var titre = e === 'facture' ? 'La facture' : e === 'devis' ? 'Le devis' : 'Ce qu’il y a à faire';
  var fin = C.finValiditeDevis(c);
  var mFacture = C.montant(c), deb = C.montantDebours(c);
  var prevus = C.joursPrevus(c), deduit = C.joursDevis(c);
  var muets = C.travauxHorsJournees(c);
  var vise = C.prixJourVise(c, A.cfg);
  var retirees = lignesRetirees(c);

  var entete = '';
  if (e === 'devis') {
    entete = paireFiche('Numéro', c.numeroDevis || '—') +
      paireFiche('Édité le', c.dateDevis ? dateCourte(c.dateDevis) : '—') +
      (c.validiteDevis ? paireFiche('Valable', c.validiteDevis + ' mois' +
        (fin ? ' — jusqu’au ' + dateCourte(fin) : '')) : '') +
      (c.dateEnvoi ? paireFiche('Envoyé le', dateCourte(c.dateEnvoi)) : '') +
      (c.dateSignature ? paireFiche('Signé le', dateCourte(c.dateSignature)) : '');
  } else if (e === 'facture') {
    var retard = C.retardPaiement(c, Date.now()), delai = C.delaiPaiement(c);
    entete = paireFiche('Numéro', c.numeroFacture || '—') +
      paireFiche('Facturé le', c.dateFacture ? dateCourte(c.dateFacture) : '—') +
      (c.echeancePaiement ? paireFiche('À payer avant le', dateCourte(c.echeancePaiement)) : '') +
      (c.datePaiement ? paireFiche('Payé le', dateCourte(c.datePaiement)) : '') +
      (delai != null
        ? '<p class="muted" style="font-size:12px;margin:6px 0 0">Réglé en ' + delai +
          ' jour' + (delai > 1 ? 's' : '') + '.</p>'
        : retard
          ? '<p class="retard" style="margin:6px 0 0">Échéance dépassée de ' + retard +
            ' jour' + (retard > 1 ? 's' : '') + '.</p>'
          : '');
  }

  /* Le pied dit ce que le devis annonçait. Il ne réapparaît qu'une fois la
     facture là : avant, le bloc EST le devis. */
  var pied = '';
  if (e === 'facture' && c.devisFige) {
    var ecart = C.arr(mFacture - C.nb(c.devisFige.total), 2);
    var nAj = 0, nCh = 0;
    (c.lignes || []).forEach(function (l) {
      var g = changementLigne(c, l);
      if (!g) return;
      if (g.quoi === 'ajout') nAj++; else nCh++;
    });
    pied = '<div class="pied-devis">' +
      '<div class="l"><span>Le devis' + (c.numeroDevis ? ' ' + esc(c.numeroDevis) : '') +
      ' disait</span><b class="num">' + eur(C.nb(c.devisFige.total)) + '</b></div>' +
      '<div class="l"><span>Facturé</span><b class="num">' + eur(mFacture) + '</b></div>' +
      (ecart || nAj || nCh || retirees.length
        ? '<p style="font-size:12.5px;margin:7px 0 0;color:var(--tiede)">' +
          [nAj ? nAj + ' ligne' + (nAj > 1 ? 's' : '') + ' ajoutée' + (nAj > 1 ? 's' : '') : '',
            nCh ? nCh + ' modifiée' + (nCh > 1 ? 's' : '') : '',
            retirees.length ? retirees.length + ' retirée' + (retirees.length > 1 ? 's' : '') : ''
          ].filter(Boolean).join(', ') +
          (ecart ? ' — <b>' + eur(Math.abs(ecart)) + (ecart > 0 ? ' de plus' : ' de moins') +
            '</b> que le devis signé.' : '.') + '</p>'
        : '<p style="font-size:12.5px;margin:7px 0 0;color:var(--vert-marque)">' +
          '<b>Facturé à l’identique.</b> Rien n’a bougé depuis le devis signé.</p>') +
      '</div>';
  } else if (e === 'facture' && C.aDevis(c)) {
    pied = '<div class="pied-devis"><div class="l"><span>Devis</span>' +
      '<b class="num">' + esc(c.numeroDevis || '—') + '</b></div>' +
      (c.dateSignature ? '<div class="l"><span>Signé le</span><b class="num">' +
        dateCourte(c.dateSignature) + '</b></div>' : '') +
      delaiRealisation(c) + '</div>';
  } else if (e === 'facture') {
    /* Un chantier facturé sans devis attaché : le crayon du bloc ouvre la
       facture, et plus rien ne menait au devis. « J'ai plein de travaux
       enregistrés avec des factures, j'ai des devis, et j'aimerais bien les
       attacher. » Régression de la fusion des deux blocs. */
    pied = '<div class="pied-devis"><p class="muted" style="font-size:12.5px;margin:0">' +
      'Aucun devis attaché à ce chantier.</p></div>';
  } else if (e === 'todo') {
    pied = '<div class="pied-devis"><p class="muted" style="font-size:12.5px;margin:0">' +
      'Pas de devis sur ce chantier. Ces lignes deviendront la facture telles ' +
      'quelles — le crayon en attache un si besoin.</p></div>';
  }
  /* Le crayon du bloc ouvre le devis tant qu'on n'a pas facturé : sans cette
     porte-là, la facture ne serait plus joignable que par le statut, et un
     numéro saisi d'avance n'aurait aucun chemin. */
  if (e !== 'facture') {
    pied += '<div class="btn-rang" style="margin-top:11px">' +
      '<button class="btn btn-min" id="f-facture">Saisir la facture</button></div>';
  } else {
    /* Et dans l'autre sens : une fois facturé, c'est le devis qui devient
       inatteignable si on ne lui laisse pas sa porte. Un devis s'attache
       toujours après coup — ne serait-ce que pour attester qu'il a existé. */
    pied += '<div class="btn-rang" style="margin-top:11px">' +
      '<button class="btn btn-min" id="f-devis">' +
      (C.aDevis(c) ? 'Modifier le devis' : 'Attacher un devis') + '</button></div>';
  }

  return '<div class="carte">' +
    teteBloc(titre, e === 'facture' ? 'f-facture' : 'f-devis',
      e === 'todo' ? 'attacher un devis' : 'modifier') +
    entete +
    '<div class="carte-titre" style="margin:' + (entete ? '14px' : '0') + ' 0 4px">' +
    '<h2 style="margin:0">' +
    (e === 'facture' ? 'Ce qui est facturé' : e === 'devis' ? 'Ce que le devis contient'
      : 'Les travaux prévus') + '</h2>' +
    '<button class="btn primaire btn-min" id="f-ligne">+ Ligne</button></div>' +
    ((c.lignes || []).map(function (l, i) { return ligneTravaux(c, l, i); }).join('') ||
      '<div class="vide"><p>Aucune ligne. Ajoutez les travaux et leur chiffrage.</p></div>') +
    /* Une ligne du devis qui n'a pas été facturée : elle ne se voit nulle
       part si on se contente de la retirer, et l'écart devient inexplicable. */
    retirees.map(function (x) {
      return '<div class="ligne-trav ligne-retiree"><div><b>' + esc(x.titre || 'Ligne') + '</b> ' +
        '<span class="marque-l ret">retirée</span>' +
        '<div class="muted" style="font-size:12px">Au devis, pas sur la facture.</div></div>' +
        '<div style="text-align:right"><b class="num muted">' + eur(x.montant) + '</b></div></div>';
    }).join('') +
    /* Le total de la facture garde le débours — c'est ce que le client paie —
       et la part qu'il représente est dite juste en dessous. */
    (mFacture ? '<div style="display:flex;justify-content:space-between;margin-top:11px;padding-top:9px;border-top:2px solid var(--encre)">' +
      '<b>Total HT</b><b class="num" style="font-size:19px">' + eur(mFacture) + '</b></div>' +
      (deb ? '<div style="display:flex;justify-content:space-between;font-size:13px" class="muted">' +
        '<span>dont débours, hors chiffre d’affaires</span><span class="num">' +
        eur(deb) + '</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;font-size:13px" class="muted">' +
      '<span>TVA ' + C.tauxPresents(c).map(function (t) { return String(t).replace('.', ','); }).join(' et ') + ' %</span><span class="num">' +
      eur(C.tvaChantier(c)) +
      '</span></div>' : '') +

    /* Le temps que ça demande vit ici, avec ce qui le chiffre. Il était deux
       blocs plus haut, dans un formulaire à part : deux endroits pour une
       même idée. */
    '<div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--trait)">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">' +
    '<button class="modif-bloc" id="f-estim" style="font-size:10.5px;font-weight:700;' +
    'letter-spacing:.10em;text-transform:uppercase;color:var(--gris)">Le temps que ça demande ✎</button>' +
    '<b class="num" style="font-size:17px">' +
    (prevus ? E.fmt(prevus, prevus % 1 ? 1 : 0) + ' j' : '—') + '</b></div>' +
    '<p class="muted" style="font-size:12px;margin:5px 0 0">' +
    (deduit > 0
      ? 'Déduit des lignes en journées : rien à ressaisir.' +
        (muets.length ? ' <b>Attention</b> : ne tient pas compte de ' +
          esc(muets.join(', ').toLowerCase()) + '.' : '')
      : (prevus ? 'Votre estimation. Aucune ligne n’est libellée en journées.'
        : 'Aucune journée estimée : sans elle, rien ne dit ce que la journée doit rapporter.')) +
    (vise ? ' Objectif ' + eur(vise) + ' la journée.' : '') + '</p></div>' +
    pied + '</div>';
}

/* Un seul bloc pour le temps. « Est-ce qu'il n'y a pas moyen de regrouper ces
   deux blocs ? Parce que si déjà je sais quelle journée… » Oui : depuis que
   tout se compte en heures, le prévu et le fait ont la même forme.
   Les deux listes restent distinctes en base — « jours » sont des dates
   posées sur l'agenda, « temps » est ce qu'on y a passé — et le projet
   avertit de ne jamais brancher l'une sur l'autre. Ce n'est qu'à l'écran
   qu'elles se rejoignent, ligne à ligne, par la date.
   Le fait est à gauche : c'est ce qu'il a demandé, et c'est la colonne qu'on
   vient lire. */
function lignesTemps(c) {
  var par = {}, sansDate = { fait: 0, prevu: 0, actes: [], temps: [] };
  var cle = function (ts) { return C.jourCle(ts); };
  C.journeesPlacees(c).forEach(function (x) {
    var k = cle(x.d);
    par[k] = par[k] || { d: C.minuit(x.d), fait: 0, prevu: 0, actes: [], temps: [] };
    par[k].prevu += C.nb(x.p) * C.HEURES_JOUR(A.cfg);
  });
  (c.temps || []).forEach(function (t) {
    var h = C.heuresSaisie(t, A.cfg);
    /* Une saisie sans date est un rattrapage : elle compte, mais elle ne
       tombe sur aucune case du calendrier. */
    var cible = t.date ? null : sansDate;
    if (!cible) {
      var k = cle(t.date);
      par[k] = par[k] || { d: C.minuit(t.date), fait: 0, prevu: 0, actes: [], temps: [] };
      cible = par[k];
    }
    cible.fait += h;
    cible.temps.push(t);
    if (t.activite && cible.actes.indexOf(t.activite) < 0) cible.actes.push(t.activite);
  });
  var out = Object.keys(par).map(function (k) { return par[k]; })
    .sort(function (a, b) { return a.d - b.d; });
  if (sansDate.fait) { sansDate.sans = true; out.push(sansDate); }
  return out;
}
function blocJournees(c, bil, pj, vise, rends, mixteNonMarque) {
  var hj = C.HEURES_JOUR(A.cfg) || 8;
  var rangs = lignesTemps(c);
  var auj = C.minuit(Date.now());
  var faitH = 0, resteH = 0;
  rangs.forEach(function (r) {
    faitH += r.fait;
    /* Une journée passée sort du « reste à faire » : elle n'est plus à faire,
       elle est faite. Compter les deux, c'est compter deux fois la même
       journée — c'est ce qu'il a relevé sur la maquette. */
    if (!r.sans && r.d > auj && r.prevu) resteH += r.prevu;
  });
  var prevus = C.joursPrevus(c);
  var jf = function (h) { return C.ditDuree(h, A.cfg); };

  var lignes = rangs.map(function (r) {
    var quand = r.sans ? 'sans date' : dateCourte(r.d);
    var avenir = !r.sans && r.d > auj;
    return '<div class="jrang' + (avenir ? ' avenir' : '') + '">' +
      '<span class="jd">' + esc(quand) +
      (r.sans ? ' <span class="muted" style="font-size:11.5px">(rattrapage)</span>'
        : avenir ? ' <span class="muted" style="font-size:11.5px">à venir</span>' : '') +
      (r.actes.length ? '<small>' + esc(r.actes.map(C.nomTravail).join(', ')) + '</small>' : '') +
      '</span>' +
      '<span class="jv num' + (r.fait ? '' : ' vide') + '">' + (r.fait ? jf(r.fait) : '—') + '</span>' +
      '<span class="jv num' + (r.prevu ? '' : ' vide') + '">' + (r.prevu ? jf(r.prevu) : '—') + '</span>' +
      '</div>';
  }).join('');

  return '<div class="carte">' + teteBloc('Les journées', 'f-jours', 'modifier') +
    '<p class="sous-titre-bloc">Le <b>prévu</b> retient la date sur l’agenda. Le <b>fait</b> ' +
    'est ce que vous y avez réellement passé — c’est lui qui donne vos rendements. ' +
    'Une journée fait ' + hj + ' h, réglable.</p>' +
    (lignes
      ? '<div class="jtete"><span>Date</span><span>Fait</span><span>Prévu</span></div>' + lignes
      : '<div class="vide"><p>Aucune date posée, aucun temps noté.</p></div>') +
    '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + jf(faitH) + '</b><small>fait</small></div>' +
    '<div class="carte2"><b class="num">' + (resteH ? jf(resteH) : '—') +
    '</b><small>reste à faire</small></div>' +
    (prevus ? '<div class="carte2"><b class="num">' + jf(prevus * hj) +
      '</b><small>estimé au devis</small></div>' : '') +
    '</div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn btn-min" id="f-planifier">Poser des dates</button>' +
    '<button class="btn primaire btn-min" id="f-temps">+ Du temps fait</button></div>' +

    /* Ce que ce temps rapporte, et ce qu'il dit des rendements. */
    (faitH ? '<div class="kpi">' +
      (pj ? '<div class="carte2"><b class="num">' + eur(pj) + '</b><small>par jour-homme' +
        (vise ? (pj >= vise ? ' ✓' : ' ✕') : '') + '</small></div>' : '') +
      rends + '</div>' : '') +
    /* Le taire sans rien dire laisserait croire à un oubli. */
    (faitH && !C.chantierSolde(c)
      ? '<p class="muted" style="font-size:12px;margin:9px 0 0">Le prix de journée ' +
        'se lira quand le chantier sera terminé : tant qu’il tourne, la facture est ' +
        'entière et les journées ne le sont pas.</p>'
      : '') +
    (bil.prevues != null && bil.faites > 0
      ? '<div class="carte2" style="margin-top:11px;border-color:' +
        (bil.ecart > 0.25 ? '#B4231F' : bil.ecart < -0.25 ? '#2E7D46' : 'var(--trait)') + '">' +
        '<div style="display:flex;justify-content:space-between;font-size:13.5px">' +
        '<span>Le devis paie</span><b class="num">' + jf(bil.prevues * hj) + ' à ' + eur(vise) + ' la journée</b></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:3px">' +
        '<span>J’y ai passé</span><b class="num">' + jf(bil.faites * hj) + '</b></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:13.5px;margin-top:3px">' +
        '<span class="muted">soit</span><b class="num">' + eur(bil.obtenu) + ' la journée</b></div>' +
        '<p class="muted" style="font-size:12px;margin:7px 0 0">' +
        (Math.abs(bil.ecart) <= 0.25
          ? 'Estimation juste.'
          : bil.ecart > 0
            ? jf(bil.ecart * hj) + ' de plus que prévu : ' + eur(vise - bil.obtenu) + ' perdus par jour.'
            : jf(-bil.ecart * hj) + ' de moins que prévu : ' + eur(bil.obtenu - vise) + ' gagnés par jour.') +
        '</p></div>'
      : (vise && pj ? '<p class="muted" style="font-size:12px;margin:9px 0 0">Objectif ' + eur(vise) +
        ' — ' + (pj >= vise ? 'atteint' : 'manque ' + eur(vise - pj)) + ' par jour.</p>' : '')) +
    (mixteNonMarque ? '<p class="muted" style="font-size:12px;margin:9px 0 0">Plusieurs travaux sur ' +
      'ce chantier : précisez l’activité dans chaque saisie de temps pour obtenir les rendements.</p>' : '') +
    '</div>';
}
function renderFiche() {
  var z = $('#fiche-chantier'); if (!z) return;
  var c = chantier(A.chOuvert);
  if (!c) { z.innerHTML = '<div class="carte"><div class="vide"><p>Chantier introuvable.</p></div></div>'; return; }
  /* « m » est ce que le chantier rapporte : le débours en est retiré. Le
     total de la facture, plus bas, le garde. */
  var m = C.montantHorsDebours(c), mFacture = C.montant(c), deb = C.montantDebours(c);
  var j = C.tempsTotal(c, A.cfg), pj = C.prixJour(c, A.cfg);
  var vise = C.prixJourVise(c, A.cfg);
  var bil = C.bilanJournees(c, A.cfg);

  var temps = (c.temps || []).slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); })
    .map(function (t, i) {
      return '<div class="liste-item"><div class="li-c"><b>' + E.fmt(C.joursSaisie(t, A.cfg), 2) + ' j-h</b>' +
        '<small>' + dateCourte(t.date) + ' · ' + E.fmt(C.nb(t.duree), 1) + (t.unite === 'h' ? ' h' : ' j') +
        (C.nb(t.personnes) > 1 ? ' × ' + C.nb(t.personnes) + ' pers.' : '') +
        (t.activite ? ' · ' + esc(C.nomTravail(t.activite)) : '') + '</small></div>' +
        '<button class="btn-min" data-tsup="' + (c.temps || []).indexOf(t) + '">✕</button></div>';
    }).join('');

  var travauxUniq = [];
  (c.lignes || []).forEach(function (l) { if (travauxUniq.indexOf(l.travail) < 0) travauxUniq.push(l.travail); });
  var rends = travauxUniq.map(function (tv) {
    var r = C.rendementTravail(c, tv, A.cfg);
    return r ? '<div class="carte2"><b class="num">' + E.fmt(r.rendement, r.rendement < 10 ? 2 : 0) + '</b>' +
      '<small>' + esc(C.nomTravail(tv)) + ' — ' + C.courtUnite(r.unite) + ' / jour-homme</small></div>' : '';
  }).join('');
  var mixteNonMarque = travauxUniq.length > 1 && (c.temps || []).length &&
    !(c.temps || []).some(function (t) { return t.activite; });

  z.innerHTML =
    '<div class="carte" style="padding-bottom:11px">' +
    '<label class="eyebrow" for="f-choix">Chantier affiché</label>' +
    '<select id="f-choix" style="margin-top:5px">' + optionsChantiers(c.id) + '</select>' +
    /* Passer d'une fiche à la suivante d'un doigt, dans l'ordre du carnet,
       plutôt que de rouvrir la liste et d'y chercher le voisin. */
    boutonsVoisins(c.id) +
    '</div>' +
    /* Le chantier : qui, où, et où il en est. */
    '<div class="carte">' +
    teteBloc('Le chantier', 'f-identite', 'modifier') +
    '<div id="f-bloc-chantier">' +
    '<h2 style="margin:0">' + esc(C.nomChantier(c)) + '</h2>' +
    '<p class="muted" style="font-size:12.5px;margin:3px 0 0">' +
    esc([c.donneur || c.client ? 'via ' + (c.donneur || c.client) : '',
      c.proprietaire ? c.proprietaire + (c.siren ? ' (SIREN)' : '') : '',
      c.foret, c.parcelles ? 'parc. ' + c.parcelles : '', c.commune].filter(Boolean).join(' · ') || 'sans donneur d’ordre') + '</p>' +
    /* « Associer la carte au chantier : accéder à la carte depuis ma fiche,
       ou avoir un emplacement pour le positionner. » */
    '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px">' +
    (c.gps && c.gps.lat != null
      ? '<span class="muted" style="font-size:12.5px">Placé sur la carte</span>' +
        '<button class="btn btn-min" data-fcarte="voir">Voir sur la carte</button>' +
        '<button class="btn btn-min" data-fcarte="placer">Déplacer</button>'
      : '<span class="muted" style="font-size:12.5px">Pas encore sur la carte</span>' +
        '<button class="btn btn-min" data-fcarte="placer">Placer sur la carte</button>') +
    '</div>' +
    '<div style="margin-top:9px">' + badgeStatut(c) +
    (dateStatut(c) ? ' <span class="muted" style="font-size:12px">' + esc(dateStatut(c)) + '</span>' : '') +
    (C.enRetard(c, Date.now()) ? ' <span class="retard">jours passés</span>' : '') + '</div>' +
    /* La facture se lit dès l'en-tête : c'est sur son numéro qu'il se repère,
       et en enchaînant les fiches par « précédente / suivante » il doit le voir
       sans dérouler. Rien ne s'affiche tant qu'il n'y a rien à dire. */
    (function () {
      var l = [];
      if (c.numeroFacture) l.push(['Facture', c.numeroFacture]);
      if (c.dateFacture) l.push(['Facturé le', new Date(c.dateFacture).toLocaleDateString('fr-FR')]);
      if (c.datePaiement) {
        l.push(['Payé le', new Date(c.datePaiement).toLocaleDateString('fr-FR') +
          (c.moyenPaiement ? ' · ' + C.nomMoyenPaiement(c.moyenPaiement) : '')]);
      }
      return l.length ? '<div style="margin-top:11px">' +
        l.map(function (p) { return paireFiche(p[0], p[1]); }).join('') + '</div>' : '';
    })() +
    (function () {
      var manque = C.champsManquants(c);
      if (!manque.length) return '';
      return '<p class="acompleter-bloc">Il manque : ' + esc(manque.join(', ')) + '.</p>';
    })() +
    '</div>' +
    /* La fiche de chantier est obligatoire au-delà de quatre hectares. C'est
       ici qu'il chiffre, donc ici qu'il faut le dire — pas dans un écran
       qu'il ouvrirait après coup. */
    (C.ficheRequise(c)
      ? '<p class="acompleter-bloc">Plus de ' + C.SEUIL_FICHE_HA + ' ha : une fiche de ' +
        'chantier est obligatoire.</p>'
      : '') +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn btn-min" data-chretour="1">← Carnet</button>' +
    '<button class="btn btn-min" id="f-statut">Changer le statut</button>' +
    '<button class="btn btn-min" id="f-fichech">Fiche de chantier</button></div>' +
    '</div>' +

    blocValeur(c, m, pj, vise) +
    blocTravaux(c) +

    blocJournees(c, bil, pj, vise, rends, mixteNonMarque) +

    (function () {
      var conso = ST.consommationChantier(A.articles, c.id);
      if (!conso.length) return '';
      var mg = ST.margeChantier(A.articles, c, C.montantLigne);
      return '<div class="carte"><h2>Fournitures</h2>' +
        conso.map(function (x) {
          return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13.5px">' +
            '<span>' + esc(x.article.nom || '') + ' <span class="muted">' +
            E.fmt(x.qte, 0) + ' ' + ST.courtUniteArt(x.article.unite) + '</span></span>' +
            '<span class="num muted">' + eur(x.cout) + '</span></div>';
        }).join('') +
        (mg.vendu ? '<div class="kpi" style="margin-top:11px">' +
          '<div class="carte2"><b class="num">' + eur(mg.vendu) + '</b><small>refacturé</small></div>' +
          '<div class="carte2"><b class="num">' + eur(mg.cout) + '</b><small>coût du stock</small></div>' +
          '<div class="carte2" style="border-color:' + (mg.marge >= 0 ? '#2E7D46' : '#B4231F') + '">' +
          '<b class="num">' + eur(mg.marge) + '</b><small>marge' + (mg.taux != null ? ' · ' + mg.taux + ' %' : '') + '</small></div></div>' : '') +
        '</div>';
    })() +
    (function () {
      var cr = c.criteres || {};
      var dit = critLibelle(cr);
      return '<div class="carte' + (dit ? '' : ' avenir') + '">' +
        teteBloc('Le peuplement', 'f-peuplement', dit ? 'modifier' : 'renseigner') +
        '<p style="font-size:13.5px;margin:0"' + (dit ? '' : ' class="muted"') + '>' +
        esc(dit || 'Essence et densité, pour vos statistiques.') + '</p></div>';
    })() +
    (C.kmChantier(c) ? '<div class="carte"><h2>Déplacements</h2>' +
      '<div class="kpi"><div class="carte2"><b class="num">' + E.fmt(C.kmChantier(c), 0) + '</b><small>km</small></div>' +
      '<div class="carte2"><b class="num">' + eur(C.coutCarburant(C.kmChantier(c), A.cfg)) + '</b><small>carburant estimé</small></div></div></div>' : '') +
    (c.motifRefus ? '<div class="carte"><h2>Sans suite</h2><p style="font-size:14px;margin:0">' +
      esc(C.nomMotifRefus(c.motifRefus)) + (c.noteRefus ? ' — ' + esc(c.noteRefus) : '') + '</p></div>' : '') +
    '<div class="carte' + (c.notes ? '' : ' avenir') + '">' +
    teteBloc('Note', 'f-note', c.notes ? 'modifier' : 'écrire') +
    '<p style="font-size:14px;margin:0"' + (c.notes ? '' : ' class="muted"') + '>' +
    esc(c.notes || 'Ce que vous voudrez relire dans deux ans.') + '</p></div>' +
    '<div class="carte"><div class="btn-rang">' +
    '<button class="btn danger btn-min" id="f-sup">Supprimer ce chantier</button></div></div>';
}

