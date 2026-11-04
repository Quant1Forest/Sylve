/* ------------------------------------------------------- la liste Chantiers
   Lot b2, maquette V2 : la recherche en haut, puis les groupes — À faire
   maintenant · En travaux · Devis · Payés récemment · les payés plus anciens
   et « Sans suite », repliés. En bas, repliés aussi, le filtre de l'ancien
   carnet (familles, à compléter, avec devis : rien n'en a disparu) et ses
   cumuls, qui attendent Argent ▸ Année (lot d). */
function renderCarnet() {
  var z = $('#carnet-totaux'); if (!z) return;
  var t = C.totaux(A.chantiers, A.cfg);
  if (!A.chantiers.length) {
    z.innerHTML = '<p class="muted" style="margin:0">Rien à cumuler : aucun chantier.</p>';
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
      (t.nSignes > 1 ? 's' : '') + (t.nSignes ? ' · ' + eur(t.signes) : ', à programmer') +
      '</small></div>' +
      /* Qui le fait vivre. Le pourcentage est l'information : un donneur
         d'ordre à soixante pour cent n'est pas un client, c'est un risque. */
      '<div class="carte2"><b class="num">' + (pd ? eur(pd.montant) : '—') +
      '</b><small>' + (pd
        ? esc(pd.nom) + (pd.part != null ? ' · ' + pd.part + ' %' : '')
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
    ['afaire', 'En cours ou à programmer', nf('afaire')]);
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
/* Le sens se dit dans les mots du critère : « plus récent » ne veut rien
   dire d'un montant ni d'un nom. */
function sensDuTri(crit, vieux) {
  if (crit === 'montant') return vieux ? '↑ plus petit d’abord' : '↓ plus gros d’abord';
  if (crit === 'donneur') return vieux ? 'Z → A' : 'A → Z';
  return vieux ? '↑ plus ancien d’abord' : '↓ plus récent d’abord';
}
function triChantiers() {
  var v = A.triCh || 'auto';
  return '<div class="ch-tri"><select id="c-tri" aria-label="Trier par">' +
    C.TRIS_CH.map(function (o) {
      return '<option value="' + o.c + '"' + (v === o.c ? ' selected' : '') + '>' +
        esc(o.n) + '</option>';
    }).join('') + '</select>' +
    '<button type="button" class="btn-min" id="c-sens">' + sensDuTri(v, !!A.triAncien) + '</button></div>';
}
/* La ligne de la maquette V2, la même que dans Aujourd'hui : nom, lieu,
   situation, montant HT, points d'étape. Le détail est dans la fiche, qui
   s'ouvre d'un appui sur l'étape en cours. */
function ligneChantierListe(c, alerte, now) {
  var s = situationChantier(c, now);
  /* Ce que le statut seul ne dit pas, l'alerte le dit : des journées
     passées, une facture restée sans réponse faute d'échéance écrite. */
  if (alerte && alerte.type === 'retard') s = { t: majuscule(alerte.texte), ton: 'tiede' };
  if (alerte && alerte.type === 'impaye' && s.ton !== 'alerte') s = { t: majuscule(alerte.texte), ton: 'alerte' };
  var m = C.montant(c);
  var lieu = [c.foret, c.commune && c.commune !== c.foret ? c.commune : ''].filter(Boolean);
  if (c.donneur || c.client) lieu.push(c.donneur || c.client);
  return '<button type="button" class="aj-ch" data-chouvrir="' + esc(c.id) + '">' +
    '<span class="aj-txt"><b>' + esc(C.nomChantier(c)) + '</b>' +
    (lieu.length ? '<small>' + esc(lieu.join(' · ')) + '</small>' : '') +
    '<span class="aj-situ' + (s.ton ? ' aj-' + s.ton : '') + '">' + esc(s.t) + '</span>' +
    /* Une fiche à moitié remplie se perd dans le carnet : elle se signale,
       sans jamais empêcher de l'enregistrer telle quelle. */
    (C.champsManquants(c).length ? '<span class="acompleter ch-acomp">à compléter</span>' : '') + '</span>' +
    '<span class="aj-droite">' + (m ? '<b class="num">' + eur(m) + '</b>' : '') + pointsEtape(c) + '</span>' +
    '</button>';
}
function groupeListe(cle, titre, ton, l, g, now) {
  if (!l.length) return '';
  return '<section class="aj-bloc ch-groupe" data-groupe="' + cle + '">' +
    '<h2 class="aj-sous' + (ton ? ' aj-' + ton : '') + '">' + titre +
    ' <span class="aj-compte">' + l.length + '</span></h2>' +
    '<div class="aj-zone">' + l.map(function (c) { return ligneChantierListe(c, g.alerte[c.id], now); }).join('') +
    '</div></section>';
}
/* Un pli qu'il a ouvert reste ouvert tant que l'écran se redessine. */
function pliListe(cle, titre, corps, n) {
  if (!n) return '';
  A.chPlis = A.chPlis || {};
  return '<details class="ch-replie" data-pli="' + cle + '"' + (A.chPlis[cle] ? ' open' : '') + '>' +
    '<summary>' + titre + ' <span class="aj-compte">' + n + '</span></summary>' +
    '<div class="ch-replie-corps">' + corps + '</div></details>';
}
function renderListeChantiers() {
  var z = $('#liste-chantiers'); if (!z) return;
  var now = Date.now(), vieux = !!A.triAncien, crit = A.triCh || 'auto';
  var q = (A.rechCh || '').trim();
  var g = C.groupesChantiers(A.chantiers, A.cfg, now);
  renderFiltreListe(g);
  if (!A.chantiers.length) {
    z.innerHTML = '<div class="vide"><p>Aucun chantier. Le + en bas ▸ Chantier : la fiche ' +
      'suit le chantier de l’annonce au paiement.</p></div>';
    return;
  }
  /* Une recherche regarde tout le carnet, statut compris : un numéro de
     facture appartient presque toujours à un chantier payé il y a longtemps. */
  if (q) {
    var l = C.tri(C.chercher(A.chantiers, q), vieux, crit);
    z.innerHTML = l.length
      ? '<div class="aj-zone" id="ch-trouves">' + l.map(function (c) {
          return ligneChantierListe(c, g.alerte[c.id], now);
        }).join('') + '</div>' +
        '<p class="ch-aide">' + l.length + ' chantier' + (l.length > 1 ? 's' : '') + ' sur ' +
        A.chantiers.length + ' — la recherche regarde tout le carnet, statut compris.</p>'
      : '<div class="vide"><p>Rien qui corresponde à « ' + esc(q) + ' ».</p></div>';
    return;
  }
  var anciens = C.tri(g.anciens, vieux, crit);
  z.innerHTML =
    groupeListe('faire', 'À faire maintenant', 'alerte', g.faire, g, now) +
    groupeListe('travaux', 'En travaux', '', g.travaux, g, now) +
    groupeListe('devis', 'Devis', '', g.devis, g, now) +
    groupeListe('payes', 'Payés récemment', '', g.payes, g, now) +
    pliListe('anciens', 'Voir les payés plus anciens', triChantiers() +
      '<div class="aj-zone">' + anciens.map(function (c) { return ligneChantierListe(c, null, now); }).join('') +
      '</div>', anciens.length) +
    pliListe('sansuite', 'Sans suite', '<div class="aj-zone">' +
      g.sansuite.map(function (c) { return ligneChantierListe(c, null, now); }).join('') + '</div>',
      g.sansuite.length);
}
/* L'ancien filtre du carnet, gardé replié : ses familles, « à compléter » et
   « avec devis » n'ont pas d'autre place. Même ordre que les payés anciens,
   et que le sélecteur de la fiche. */
function renderFiltreListe(g) {
  var z = $('#ch-filtre-liste'); if (!z) return;
  var now = Date.now();
  g = g || C.groupesChantiers(A.chantiers, A.cfg, now);
  var l = C.tri(C.filtre(A.chantiers, A.filtreCh || 'ouverts'), !!A.triAncien, A.triCh || 'auto');
  z.innerHTML = l.length ? l.map(function (c) { return ligneChantierListe(c, g.alerte[c.id], now); }).join('')
    : '<div class="vide"><p>Aucun chantier dans cette vue.</p></div>';
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
/* « vers » : l'étape que la porte rend utile (« devis » pour estimer le
   temps, « travaux » depuis l'Agenda). Sans elle, la fiche s'ouvre sur
   l'étape en cours ; revenir sur le même chantier garde ce qu'on avait
   déplié. */
function ouvrirChantier(id, vers) {
  var c = chantier(id);
  if (c && (vers != null || !A.ficheVue || A.ficheVue.id !== id)) {
    A.ficheVue = { id: id, etape: C.etapeChantier(c), ouvertes: etapesOuvertes(c, vers) };
  }
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

/* ------------------------------------------------- la fiche en étapes
   Lot b1 : la fiche suit le chantier en cinq étapes repliables, celle en
   cours ouverte. Rien de l'ancienne fiche ne disparaît : chaque bloc a son
   étape (docs/correspondance-refonte.md, 3.2). */

/* Les lignes vivent dans l'étape Devis tant que rien n'est facturé. Une
   fois la facture là — ou dès qu'on dit que le montant change — elles sont
   celles de la facture, et le devis figé sert de comparaison. Il n'y a
   jamais deux listes : « les travaux sont liés au devis ou à la facture ». */
function lignesDeFacture(c) {
  if (c.statut === 'sansuite') return false;
  return !!c.devisFige || c.statut === 'facture' || c.statut === 'paye' ||
    !!c.numeroFacture || !!c.dateFacture;
}
function devisSaisi(c) {
  return !!(c.numeroDevis || c.dateDevis || c.dateEnvoi || c.dateSignature);
}
function factureFaite(c) {
  return c.statut === 'facture' || c.statut === 'paye' || !!(c.numeroFacture && c.dateFacture);
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
  return 'réalisé en ' + (n <= 0 ? 'moins d’un jour' : n + ' jour' + (n > 1 ? 's' : '')) +
    ' après la signature';
}
function jf(n) { return E.fmt(n, n % 1 ? 1 : 0); }
/* Une surface garde ses décimales utiles : 2,5 ha, 1,25 ha, jamais 2,50. */
function ha(n) { return E.fmt(n, n % 1 ? (C.arr(n, 1) === n ? 1 : 2) : 0) + ' ha'; }
function tauxFr(t) { return String(t).replace('.', ','); }
/* « Il manque… » se dit dans l'étape où le champ se remplit, pas en tête de
   fiche : c'est là qu'on a le crayon sous la main. */
var ETAPE_CHAMP = { donneur: 0, commune: 0, lignes: 1, joursEstimes: 1, numeroDevis: 1,
  numeroFacture: 3, dateFacture: 3, echeancePaiement: 3, datePaiement: 4 };
function ilManque(c, etape) {
  var noms = C.champsManquants(c);
  var l = C.CHAMPS_FICHE.filter(function (x) {
    return ETAPE_CHAMP[x.c] === etape && noms.indexOf(x.n) >= 0;
  }).map(function (x) { return x.n; });
  return l.length ? '<p class="acompleter-bloc">Il manque : ' + esc(l.join(', ')) + '.</p>' : '';
}
function kv(nom, valeur, cls) {
  return '<dt' + (cls ? ' class="' + cls + '"' : '') + '>' + nom + '</dt><dd class="num' +
    (cls ? ' ' + cls : '') + '">' + valeur + '</dd>';
}

/* Le total de la facture garde le débours — c'est ce que le client paie — et
   la part qu'il représente est dite juste en dessous. La TVA se lit taux par
   taux, comme sur le papier. */
function totauxLignes(c) {
  var m = C.montant(c); if (!m) return '';
  var deb = C.montantDebours(c), p = C.partsChantier(c);
  return '<dl class="fi-kv">' + kv('Total HT', eur(m), 'fi-ht') +
    (deb ? kv('dont débours, hors chiffre d’affaires', eur(deb), 'muted') : '') +
    C.tvaParTaux(c).map(function (t) {
      return kv('TVA ' + tauxFr(t.taux) + ' % <small>sur ' + eur(t.base) + '</small>', eur(t.tva));
    }).join('') +
    kv('Total TTC', eur(C.ttcChantier(c)), 'fi-tot') + '</dl>' +
    '<div class="fi-parts"><span><i class="pr"></i>Prestation ' + eur(p.prestation) + '</span>' +
    (p.vente ? '<span><i class="ve"></i>Vente ' + eur(p.vente) + '</span>' : '') + '</div>';
}
function blocLignes(c, titre) {
  var retirees = lignesRetirees(c);
  return '<div class="fi-sous"><b>' + titre + '</b>' +
    '<button class="btn primaire btn-min" id="f-ligne">+ Ligne</button></div>' +
    ((c.lignes || []).map(function (l, i) { return ligneTravaux(c, l, i); }).join('') ||
      '<p class="fi-aide">Aucune ligne. Ajoutez les travaux et leur chiffrage.</p>') +
    /* Une ligne du devis qui n'a pas été facturée : elle ne se voit nulle
       part si on se contente de la retirer, et l'écart devient inexplicable. */
    retirees.map(function (x) {
      return '<div class="ligne-trav ligne-retiree"><div><b>' + esc(x.titre || 'Ligne') + '</b> ' +
        '<span class="marque-l ret">retirée</span>' +
        '<div class="muted" style="font-size:12px">Au devis, pas sur la facture.</div></div>' +
        '<div style="text-align:right"><b class="num muted">' + eur(x.montant) + '</b></div></div>';
    }).join('') + totauxLignes(c);
}
/* Le pied dit ce que le devis annonçait, une fois la facture là. */
function comparaisonDevis(c) {
  if (!c.devisFige) return '';
  var mF = C.montant(c), ecart = C.arr(mF - C.nb(c.devisFige.total), 2);
  var nAj = 0, nCh = 0, ret = lignesRetirees(c).length;
  (c.lignes || []).forEach(function (l) {
    var g = changementLigne(c, l);
    if (!g) return;
    if (g.quoi === 'ajout') nAj++; else nCh++;
  });
  return '<div class="pied-devis">' +
    '<div class="l"><span>Le devis' + (c.numeroDevis ? ' ' + esc(c.numeroDevis) : '') +
    ' disait</span><b class="num">' + eur(C.nb(c.devisFige.total)) + '</b></div>' +
    '<div class="l"><span>Facturé</span><b class="num">' + eur(mF) + '</b></div>' +
    (ecart || nAj || nCh || ret
      ? '<p style="font-size:12.5px;margin:7px 0 0;color:var(--tiede)">' +
        [nAj ? nAj + ' ligne' + (nAj > 1 ? 's' : '') + ' ajoutée' + (nAj > 1 ? 's' : '') : '',
          nCh ? nCh + ' modifiée' + (nCh > 1 ? 's' : '') : '',
          ret ? ret + ' retirée' + (ret > 1 ? 's' : '') : ''
        ].filter(Boolean).join(', ') +
        (ecart ? ' — <b>' + eur(Math.abs(ecart)) + (ecart > 0 ? ' de plus' : ' de moins') +
          '</b> que le devis signé.' : '.') + '</p>'
      : '<p style="font-size:12.5px;margin:7px 0 0;color:var(--vert-marque)">' +
        '<b>Facturé à l’identique.</b> Rien n’a bougé depuis le devis signé.</p>') +
    '</div>';
}

/* ------------------------------------------------ les trois chiffres
   Ce que le chantier vaut, le temps qu'il prend, ce que la journée rapporte.
   Rien ne s'y saisit, sauf l'objectif (✎ sous le troisième). */
function troisChiffresFiche(c, k) {
  var solde = C.chantierSolde(c);
  var lib1 = !k.montant ? (C.aDevis(c) ? 'pas encore de devis' : 'pas encore chiffré')
    : c.statut === 'paye' ? 'encaissé HT' : c.statut === 'facture' ? 'facturé HT'
      : c.statut === 'termine' ? 'à facturer HT' : C.aDevis(c) ? 'devis HT' : 'travaux HT';
  var f = k.faites, e = k.estimees, v2, lib2;
  /* Dire d'où sort le chiffre : « faites » quand il vient du temps noté,
     « facturées » quand seule la facture en parle — c'est le cas de tous les
     chantiers repris du carnet. */
  if (solde && f > 0 && !k.saisi) { v2 = jf(f); lib2 = 'journées facturées'; }
  else if (f > 0 && e > 0) { v2 = jf(f) + ' / ' + jf(e) + ' j'; lib2 = 'faites / estimées'; }
  else if (f > 0) { v2 = jf(f); lib2 = 'journées faites'; }
  else if (e > 0) { v2 = jf(e); lib2 = 'journées estimées'; }
  else { v2 = '—'; lib2 = 'journées'; }
  var lib3 = { reel: 'par jour, réel', rythme: 'par jour, au rythme actuel',
    devis: 'par jour, au devis' }[k.mode] || 'par jour';
  var sous = k.vise && k.parJour && k.parJour < k.vise;
  return '<div class="fi-kpis">' +
    '<div class="fi-kpi"><b class="num">' + (k.montant ? eur(k.montant) : '—') + '</b><small>' +
    lib1 + '</small></div>' +
    '<div class="fi-kpi"><b class="num">' + v2 + '</b><small>' + lib2 + '</small></div>' +
    '<div class="fi-kpi' + (sous ? ' sous' : '') + '"><b class="num">' +
    (k.parJour ? eur(C.arr(k.parJour, 0)) : '—') + '</b><small>' + lib3 + '</small>' +
    '<button class="fi-obj" id="f-objectif">' + (k.vise ? 'objectif ' + eur(k.vise) : 'objectif') +
    ' ✎</button></div></div>' +
    (solde && !f
      ? '<p class="fi-aide">Aucun temps noté : « Ajouter du temps sans date », dans l’étape ' +
        'Travaux, dit ce que le chantier vous a pris.</p>'
      : (!solde && !e && c.statut !== 'sansuite'
        ? '<p class="fi-aide">Aucune journée estimée : sans elle, rien ne dit ce que la ' +
          'journée doit rapporter.</p>' : ''));
}

/* ------------------------------------------------- étape 1 : Infos */
function corpsInfos(c) {
  var cr = c.criteres || {};
  var surf = C.nb(c.surface) || C.quantite(c, 'ha');
  var pe = [cr.essence ? C.nomEssenceCh(cr.essence) : 'essence à préciser',
    cr.densite ? E.fmt(cr.densite, 0) + ' plants/ha' : 'densité à préciser',
    surf ? ha(surf) : 'surface à préciser'];
  var place = c.gps && c.gps.lat != null;
  return '<div class="fi-note"><small>Ce que je sais</small>' +
    (c.notes ? esc(c.notes) : '<span class="muted">rien de noté — accès, code du portail…</span>') +
    '</div>' +
    (c.vuReperage ? '<div class="fi-note"><small>Ce que j’ai vu' +
      (c.dateReperage ? ' le ' + dateCourte(c.dateReperage) : '') + '</small>' +
      esc(c.vuReperage) + '</div>' : '') +
    '<button class="fi-note fi-btn" id="f-peuplement"><small>Peuplement ✎</small>' +
    esc(pe.join(' · ')) + '</button>' +
    /* « Associer la carte au chantier : accéder à la carte depuis ma fiche,
       ou avoir un emplacement pour le positionner. » */
    '<div class="fi-pos">' + (place
      ? '<span class="fi-sur">Sur la carte</span>' +
        '<button class="btn-min" data-fcarte="voir">Voir</button>' +
        '<button class="btn-min" data-fcarte="placer">Déplacer</button>'
      : '<span class="muted">Pas encore sur la carte</span>' +
        '<button class="btn-min" data-fcarte="moi">Je suis dessus</button>' +
        '<button class="btn-min" data-fcarte="placer">Placer sur la carte</button>') + '</div>' +
    '<p class="fi-meta"><span>Annoncé le <b>' + (C.dateEntree(c) ? dateCourte(C.dateEntree(c)) : '—') +
    '</b></span><span>Repérage : <b>' + (c.dateReperage ? dateCourte(c.dateReperage) : 'pas encore') +
    '</b></span></p>' +
    '<button class="btn" id="f-reperage">' + (c.dateReperage ? 'Modifier le repérage' : 'Noter le repérage') +
    '</button>' +
    (c.dateReperage ? '' : '<p class="fi-aide">Facultatif : un chantier peut passer au devis sans repérage.</p>') +
    /* La fiche sécurité est obligatoire au-delà de quatre hectares. C'est
       ici qu'il chiffre et repère, donc ici qu'il faut le dire. */
    (C.ficheRequise(c) ? '<p class="acompleter-bloc">Plus de ' + C.SEUIL_FICHE_HA + ' ha : une ' +
      'fiche sécurité est obligatoire.</p>' : '') +
    ilManque(c, 0);
}

/* ------------------------------------------------- étape 2 : Devis */
function corpsDevis(c) {
  var avec = C.aDevis(c), h = '';
  if (c.statut === 'sansuite') {
    h += '<div class="fi-note fi-refus"><small>' + esc(C.nomStatut('sansuite', c)) + '</small>' +
      (c.motifRefus ? esc(C.nomMotifRefus(c.motifRefus)) + (c.noteRefus ? ' — ' + esc(c.noteRefus) : '')
        : 'motif non précisé') + '</div>';
  }
  if (!avec) {
    h += '<p class="fi-aide">Chantier sans devis : il est passé directement à « ' +
      esc(C.nomStatut('accepte', c)) + ' ». Ses lignes deviendront la facture telles quelles.</p>' +
      '<button class="lien" id="f-devis-oui">Finalement, saisir un devis</button>';
  } else if (!devisSaisi(c) && c.statut === 'devis') {
    h += '<p class="fi-aide">Avec ou sans devis : ça se décide ici, quand vous le savez. Les lignes ' +
      'du devis serviront ensuite à la facture, à l’avancement et aux sorties de stock.</p>' +
      '<div class="btn-rang"><button class="btn primaire" id="f-devis">Saisir le devis</button>' +
      '<button class="btn" id="f-sansdevis">Pas de devis : à programmer</button></div>';
  } else {
    var fin = C.finValiditeDevis(c);
    h += '<div class="fi-tete-etape"><p class="fi-meta">' +
      '<span>N° <b>' + esc(c.numeroDevis || '—') + '</b></span>' +
      (c.dateDevis ? '<span>Édité le <b>' + dateCourte(c.dateDevis) + '</b></span>' : '') +
      (c.validiteDevis ? '<span>Valable <b>' + c.validiteDevis + ' mois' +
        (fin ? ' — jusqu’au ' + dateCourte(fin) : '') + '</b></span>' : '') +
      (c.dateEnvoi ? '<span>Envoyé le <b>' + dateCourte(c.dateEnvoi) + '</b></span>' : '') +
      (c.dateSignature ? '<span>Signé le <b>' + dateCourte(c.dateSignature) + '</b></span>'
        : c.statut === 'envoye' ? '<span><b>En attente de réponse</b></span>' : '') +
      '</p><button class="modif-bloc" id="f-devis">modifier ✎</button></div>';
  }
  if (!lignesDeFacture(c)) {
    h += blocLignes(c, avec ? 'Ce que le devis contient' : 'Les travaux prévus');
  } else if (c.devisFige) {
    h += '<div class="fi-sous"><b>Ce que le devis contenait</b></div>' +
      (c.devisFige.lignes || []).map(function (x) {
        return '<div class="ligne-trav"><div><b>' + esc(x.titre || 'Ligne') + '</b>' +
          '<div class="muted" style="font-size:12px">' + (x.unite === 'forfait' ? 'forfait'
            : E.fmt(C.nb(x.quantite), C.nb(x.quantite) % 1 ? 2 : 0) + ' ' + esc(C.courtUnite(x.unite)) +
              ' × ' + E.fmt(C.nb(x.prix), 2) + ' €') + '</div></div>' +
          '<div style="text-align:right"><b class="num">' + eur(x.montant) + '</b></div></div>';
      }).join('') +
      '<dl class="fi-kv">' + kv('Total HT', eur(C.nb(c.devisFige.total)), 'fi-ht') + '</dl>' +
      '<p class="fi-aide">Les lignes facturées sont dans l’étape Facture.</p>';
  } else {
    h += '<p class="fi-aide">Les lignes sont celles de la facture : étape Facture.</p>';
  }
  if (avec && (c.statut === 'devis' || c.statut === 'envoye')) {
    h += '<div class="fi-gestes">' +
      (c.statut === 'devis' ? '<button class="btn" id="f-envoye">Devis envoyé</button>' : '') +
      '<label class="fi-date">Signé le <input type="date" id="f-signe-date" value="' +
      versChamp(Date.now()) + '"></label>' +
      '<div class="btn-rang"><button class="btn primaire" id="f-signe">Signé</button>' +
      '<button class="btn" id="f-refuse">Refusé</button></div></div>';
  }
  /* Le temps que ça demande vit ici, avec ce qui le chiffre : un seul
     endroit pour les journées estimées. */
  if (c.statut !== 'sansuite') {
    var prevus = C.joursPrevus(c), deduit = C.joursDevis(c), muets = C.travauxHorsJournees(c);
    var solde = C.chantierSolde(c);
    h += '<div class="fi-estim"><button class="lien" id="f-estim">' +
      (solde ? 'Temps estimé, pour mémoire ✎' : 'Temps estimé (facultatif) ✎') + '</button>' +
      '<b class="num">' + (prevus ? jf(prevus) + ' j' : '—') + '</b></div>' +
      '<p class="fi-aide">' + (deduit > 0
        ? 'Déduit des lignes en journées : rien à ressaisir.' +
          (muets.length ? ' <b>Attention</b> : ne tient pas compte de ' +
            esc(muets.join(', ').toLowerCase()) + '.' : '')
        : (prevus ? 'Votre estimation. Aucune ligne n’est libellée en journées.'
          : 'Ce que vous pensez y passer : il dira ce que la journée rapporte.')) + '</p>';
  }
  return h + ilManque(c, 1);
}

/* ------------------------------------------------ étape 3 : Travaux */
/* Le prévu et le fait se rejoignent à l'écran, ligne à ligne, par la date.
   Les deux listes restent distinctes en base — « jours » sont des dates
   posées sur l'agenda, « temps » est ce qu'on y a passé — et ne se branchent
   jamais l'une sur l'autre. */
function lignesTemps(c) {
  var par = {}, sansDate = { fait: 0, prevu: 0, actes: [], qtes: {}, km: 0 };
  var rang = function (ts) {
    var k = C.jourCle(ts);
    par[k] = par[k] || { d: C.minuit(ts), fait: 0, prevu: 0, actes: [], qtes: {}, km: 0 };
    return par[k];
  };
  C.journeesPlacees(c).forEach(function (x) {
    rang(x.d).prevu += C.nb(x.p) * C.HEURES_JOUR(A.cfg);
  });
  (c.temps || []).forEach(function (t) {
    /* Une saisie sans date est un rattrapage : elle compte, mais elle ne
       tombe sur aucune case du calendrier. */
    var cible = t.date ? rang(t.date) : sansDate;
    cible.fait += C.heuresSaisie(t, A.cfg);
    cible.km += C.nb(t.km);
    /* La journée d'office (lot r1) se dit, avec son ○ tant que la fiche de
       ce jour n'a pas été ouverte. */
    if (t.office) { cible.office = true; if (!t.vu) cible.rond = true; }
    if (t.activite && cible.actes.indexOf(t.activite) < 0) cible.actes.push(t.activite);
    if (t.activite && C.nb(t.quantite) > 0) {
      cible.qtes[t.activite] = (cible.qtes[t.activite] || 0) + C.nb(t.quantite);
    }
  });
  var out = Object.keys(par).map(function (k) { return par[k]; })
    .sort(function (a, b) { return a.d - b.d; });
  if (sansDate.fait) { sansDate.sans = true; out.push(sansDate); }
  return out;
}
function corpsTravaux(c, k) {
  var hj = C.HEURES_JOUR(A.cfg) || 8;
  var rangs = lignesTemps(c), auj = C.minuit(Date.now());
  var faitH = 0, resteH = 0, km = C.kmChantier(c);
  rangs.forEach(function (r) {
    faitH += r.fait;
    /* Une journée passée sort du « reste à faire » : elle n'est plus à faire,
       elle est faite. */
    if (!r.sans && r.d > auj && r.prevu) resteH += r.prevu;
  });
  var prevus = C.joursPrevus(c), dur = function (h) { return C.ditDuree(h, A.cfg); };
  var av = k.avancement, h = '';
  if (C.etapeChantier(c) < 2) {
    h += '<p class="fi-aide">Après la signature du devis, ou tout de suite pour un chantier sans devis.</p>';
  }
  if (av && faitH) {
    h += '<div class="fi-av"><div class="fi-av-tete"><small>Avancement, ligne par ligne du devis</small>' +
      '<b class="num">' + Math.round(av.taux * 100) + ' %</b></div>' +
      av.lignes.map(function (l) {
        return '<div class="fi-av-l"><div><span>' + esc(l.titre) + '</span><span class="num">' +
          jf(l.fait) + ' / ' + jf(l.quantite) + ' ' + esc(C.courtUnite(l.unite)) + '</span></div>' +
          '<div class="fi-barre"><i style="width:' + Math.round(Math.min(1, l.part) * 100) + '%"></i></div></div>';
      }).join('') + '</div>';
  }
  h += rangs.length
    ? '<p class="fi-aide">Le <b>prévu</b> retient la date sur l’agenda. Le <b>fait</b> est ce que ' +
      'vous y avez réellement passé — c’est lui qui donne vos rendements. Une journée fait ' +
      hj + ' h, réglable.</p>' +
      '<div class="jtete"><span>Date</span><span>Fait</span><span>Prévu</span></div>' +
      rangs.map(function (r) {
        var avenir = !r.sans && r.d > auj;
        var detail = r.actes.map(function (a) {
          var q = r.qtes[a], u = C.uniteTravail(c, a);
          return C.nomTravail(a) + (q ? ' ' + E.fmt(q, q % 1 ? 2 : 0) + (u ? ' ' + C.courtUnite(u) : '') : '');
        });
        if (r.km) detail.push(E.fmt(r.km, 0) + ' km');
        if (r.office) detail.push((r.rond ? '○ ' : '') + 'comptée d’office');
        return '<div class="jrang' + (avenir ? ' avenir' : '') + (r.office ? ' office' : '') + '">' +
          '<span class="jd">' + esc(r.sans ? 'sans date' : dateCourte(r.d)) +
          (r.sans ? ' <span class="muted" style="font-size:11.5px">(rattrapage)</span>'
            : avenir ? ' <span class="muted" style="font-size:11.5px">à venir</span>' : '') +
          (detail.length ? '<small>' + esc(detail.join(' · ')) + '</small>' : '') + '</span>' +
          '<span class="jv num' + (r.fait ? '' : ' vide') + '">' + (r.fait ? dur(r.fait) : '—') + '</span>' +
          '<span class="jv num' + (r.prevu ? '' : ' vide') + '">' + (r.prevu ? dur(r.prevu) : '—') + '</span>' +
          '</div>';
      }).join('')
    : '<p class="fi-aide">Aucune date posée, aucun temps noté.</p>';
  h += '<div class="kpi">' +
    '<div class="carte2"><b class="num">' + dur(faitH) + '</b><small>fait</small></div>' +
    '<div class="carte2"><b class="num">' + (resteH ? dur(resteH) : '—') + '</b><small>reste à faire</small></div>' +
    (prevus ? '<div class="carte2"><b class="num">' + dur(prevus * hj) + '</b><small>estimé au devis</small></div>' : '') +
    '</div>';
  var real = delaiRealisation(c);
  h += '<p class="fi-meta"><span><b>' + E.fmt(C.arr(faitH, 2), faitH % 1 ? 1 : 0) + ' h</b></span>' +
    '<span><b>' + dur(faitH) + '</b></span>' +
    '<span><b>' + E.fmt(km, 0) + ' km</b>' + (km ? ' · carburant estimé ' + eur(C.coutCarburant(km, A.cfg)) : '') + '</span>' +
    (c.dateFin && C.rangStatut(c.statut) >= C.rangStatut('termine') && c.statut !== 'sansuite'
      ? '<span>terminé le <b>' + dateCourte(c.dateFin) + '</b></span>' : '') +
    (real ? '<span>' + real + '</span>' : '') + '</p>';
  /* Ce que le devis paie en journées, face à ce qu'on y a passé. */
  var bil = C.bilanJournees(c, A.cfg), vise = C.prixJourVise(c, A.cfg);
  if (bil.prevues != null && bil.faites > 0) {
    h += '<div class="carte2 fi-bilan' + (bil.ecart > 0.25 ? ' perte' : bil.ecart < -0.25 ? ' gain' : '') + '">' +
      '<div><span>Le devis paie</span><b class="num">' + dur(bil.prevues * hj) + ' à ' + eur(vise) + ' la journée</b></div>' +
      '<div><span>J’y ai passé</span><b class="num">' + dur(bil.faites * hj) + '</b></div>' +
      '<div><span class="muted">soit</span><b class="num">' + eur(bil.obtenu) + ' la journée</b></div>' +
      '<p class="fi-aide">' + (Math.abs(bil.ecart) <= 0.25 ? 'Estimation juste.'
        : bil.ecart > 0 ? dur(bil.ecart * hj) + ' de plus que prévu : ' + eur(vise - bil.obtenu) + ' perdus par jour.'
          : dur(-bil.ecart * hj) + ' de moins que prévu : ' + eur(bil.obtenu - vise) + ' gagnés par jour.') +
      '</p></div>';
  }
  /* Le taire laisserait croire à un oubli : tant que le chantier tourne, la
     facture est entière et les journées ne le sont pas. */
  if (faitH && !C.chantierSolde(c) && k.mode !== 'rythme') {
    h += '<p class="fi-aide">Le prix de journée réel se lira quand le chantier sera terminé : ' +
      'tant qu’il tourne, la facture est entière et les journées ne le sont pas.</p>';
  }
  var travaux = [];
  (c.lignes || []).forEach(function (l) { if (travaux.indexOf(l.travail) < 0) travaux.push(l.travail); });
  if (travaux.length > 1 && (c.temps || []).length && !(c.temps || []).some(function (t) { return t.activite; })) {
    h += '<p class="fi-aide">Plusieurs travaux sur ce chantier : précisez la prestation dans ' +
      'chaque journée pour obtenir les rendements.</p>';
  }
  h += '<div class="btn-rang fi-actions"><button class="btn primaire" id="f-planifier">Placer des jours dans l’Agenda</button></div>' +
    '<button class="lien" id="f-temps">Ajouter du temps sans date (rattrapage)</button>' +
    (c.statut === 'accepte' || c.statut === 'encours'
      ? '<div class="btn-rang fi-actions"><button class="btn" id="f-termine">Travaux terminés</button></div>' : '');
  return h;
}

/* ------------------------------------------------ étape 4 : Facture */
function corpsFacture(c) {
  var h = '', e = C.etapeChantier(c);
  if (c.statut === 'sansuite') return '<p class="fi-aide">—</p>';
  if (factureFaite(c)) {
    h += '<div class="fi-tete-etape"><p class="fi-meta">' +
      '<span>N° <b>' + esc(c.numeroFacture || '—') + '</b></span>' +
      '<span>Facturé le <b>' + (c.dateFacture ? dateCourte(c.dateFacture) : '—') + '</b></span>' +
      (c.echeancePaiement ? '<span>À payer avant le <b>' + dateCourte(c.echeancePaiement) + '</b></span>' : '') +
      '</p><button class="modif-bloc" id="f-facture">modifier ✎</button></div>';
  } else if (e === 3) {
    var modifiees = c.devisFige && C.arr(C.montant(c), 2) !== C.arr(C.nb(c.devisFige.total), 2);
    h += '<dl class="fi-kv">' + kv('Montant HT', eur(C.montant(c))) +
      kv('À facturer', eur(C.ttcChantier(c)) + ' TTC', 'fi-tot') + '</dl>' +
      champNumero('F', 'ff-num', c.numeroFacture, 'N° de facture (votre logiciel)') +
      '<div class="grille g2">' +
      '<div class="champ"><label class="eyebrow" for="ff-date">Facturé le</label>' +
      '<input type="date" id="ff-date" value="' + versChamp(c.dateFacture || Date.now()) + '"></div>' +
      '<div class="champ"><label class="eyebrow" for="ff-ech">À payer avant le</label>' +
      '<input type="date" id="ff-ech" value="' + versChamp(c.echeancePaiement) + '"></div></div>' +
      '<div class="btn-rang" style="margin:-4px 0 11px">' +
      '<button class="btn-min" data-ffech="30">+ 30 jours</button>' +
      '<button class="btn-min" data-ffech="45">+ 45 jours</button>' +
      '<button class="btn-min" data-ffech="60">+ 60 jours</button></div>' +
      '<button class="btn primaire plein" id="f-facturer">' +
      (modifiees ? 'Facturer au montant des lignes' : 'Facturer au montant du devis') + '</button>' +
      (C.aDevis(c) && !c.devisFige
        ? '<button class="lien" id="f-modlignes">Le montant change ? Modifier les lignes</button>' : '') +
      '<button class="lien" id="f-facture">Toute la facture (échéance, paiement) ✎</button>';
  } else {
    var ttc = C.ttcChantier(c);
    h += '<p class="fi-aide">' + (ttc ? 'Quand les travaux seront terminés : ' + eur(ttc) +
      ' TTC prévus, à facturer en un geste au montant du devis.' : 'Après le devis et les travaux.') + '</p>' +
      '<button class="lien" id="f-facture">Saisir la facture</button>';
  }
  if (lignesDeFacture(c)) h += blocLignes(c, 'Ce qui est facturé') + comparaisonDevis(c);
  return h + ilManque(c, 3);
}

/* -------------------------------------------------- étape 5 : Payé */
function corpsPaye(c) {
  var h = '';
  if (c.statut === 'paye' || c.datePaiement) {
    var delai = C.delaiPaiement(c);
    h += '<dl class="fi-kv">' + kv('Payé le', c.datePaiement ? dateCourte(c.datePaiement) : '—') +
      (c.moyenPaiement ? kv('Réglé par', esc(C.nomMoyenPaiement(c.moyenPaiement))) : '') +
      kv('Montant', eur(C.ttcChantier(c)) + ' TTC') + '</dl>' +
      (delai != null ? '<p class="fi-aide">Réglé en ' + delai + ' jour' + (delai > 1 ? 's' : '') + '.</p>' : '') +
      '<button class="lien" data-fiact="facture">Corriger la facture ou le paiement ✎</button>';
  } else if (c.statut === 'facture') {
    var r = C.retardPaiement(c, Date.now());
    h += (r ? '<p class="retard">Échéance dépassée de ' + r + ' jour' + (r > 1 ? 's' : '') + '.</p>' : '') +
      '<div class="grille g2">' +
      '<div class="champ"><label class="eyebrow" for="fp-date">Payé le</label>' +
      '<input type="date" id="fp-date" value="' + versChamp(Date.now()) + '"></div>' +
      /* Pour savoir ce qui rentre en chèques : liste fermée, sinon on ne
         pourrait plus les compter. */
      '<div class="champ"><label class="eyebrow" for="fp-moyen">Réglé par</label>' +
      '<select id="fp-moyen"><option value="">— non précisé —</option>' +
      C.MOYENS_PAIEMENT.map(function (x) {
        return '<option value="' + x.c + '">' + esc(x.n) + '</option>';
      }).join('') + '</select></div></div>' +
      '<button class="btn primaire plein" id="f-payer">Noter le paiement</button>';
  } else {
    h += '<p class="fi-aide">Après la facture.</p>';
  }
  return h + ilManque(c, 4);
}

/* Ce qu'on lit de chaque étape sans la déplier. Le numéro de facture en
   fait partie : c'est sur lui qu'il se repère en enchaînant les fiches. */
function resumeEtape(c, i, k) {
  var e = C.etapeChantier(c);
  if (i === 0) {
    return c.dateReperage ? 'repéré le ' + dateCourte(c.dateReperage)
      : 'annoncé le ' + dateCourte(C.dateEntree(c)) + (e === 0 ? ' · repérage facultatif' : '');
  }
  if (i === 1) {
    if (c.statut === 'sansuite') return 'refusé' + (c.motifRefus ? ' · ' + C.nomMotifRefus(c.motifRefus) : '');
    if (!C.aDevis(c)) return 'sans devis';
    if (!devisSaisi(c) && c.statut === 'devis') return 'avec ou sans devis : à choisir';
    var m = C.montant(c);
    return [c.numeroDevis, m ? eur(m) + ' HT' : '',
      c.dateSignature ? 'signé le ' + dateCourte(c.dateSignature)
        : c.dateEnvoi ? 'envoyé le ' + dateCourte(c.dateEnvoi) : 'à envoyer'].filter(Boolean).join(' · ');
  }
  if (i === 2) {
    if (c.statut === 'sansuite') return '—';
    if (e < 2) return 'après le devis';
    if (c.statut === 'accepte') {
      var pl = C.totalPlace(c);
      return 'à programmer' + (pl ? ' · ' + jf(pl) + ' j placé' + (pl > 1 ? 's' : '') : '');
    }
    if (c.statut === 'encours') {
      return [k.avancement && k.faites ? Math.round(k.avancement.taux * 100) + ' %' : '',
        k.faites ? jf(k.faites) + ' j faits' : 'en cours'].filter(Boolean).join(' · ');
    }
    return (c.dateFin ? 'terminé le ' + dateCourte(c.dateFin) : 'terminé') +
      (k.faites ? ' · ' + jf(k.faites) + ' j' : '');
  }
  if (i === 3) {
    if (factureFaite(c)) {
      return (c.numeroFacture || 'facturé') + (c.dateFacture ? ' du ' + dateCourte(c.dateFacture) : '');
    }
    return e === 3 ? 'à faire · ' + eur(C.ttcChantier(c)) + ' TTC' : '—';
  }
  if (c.datePaiement || c.statut === 'paye') {
    return 'le ' + (c.datePaiement ? dateCourte(c.datePaiement) : '—') +
      (c.moyenPaiement ? ' · ' + C.nomMoyenPaiement(c.moyenPaiement) : '');
  }
  if (c.statut === 'facture') {
    var r = C.retardPaiement(c, Date.now());
    return r ? 'échue depuis ' + r + ' j'
      : 'en attente' + (c.echeancePaiement ? ' · avant le ' + dateCourte(c.echeancePaiement) : '');
  }
  return '—';
}

/* Quelles étapes sont ouvertes. Celle en cours, et le Devis aussi tant que
   le chantier est à l'étape Infos (maquette tour 2) : c'est là que se
   décide « avec ou sans devis ». Une porte peut demander une autre étape
   (« à facturer » → Facture, « temps à estimer » → Devis). Ce qu'il ouvre
   ou ferme à la main se garde tant qu'il reste sur le chantier. */
var NOMS_ETAPE = { infos: 0, devis: 1, travaux: 2, facture: 3, paye: 4 };
function etapesOuvertes(c, vers) {
  var e = C.etapeChantier(c), o = {};
  if (e < 5) o[e] = true;
  if (c.statut === 'devis') o[1] = true;
  var v = typeof vers === 'string' ? NOMS_ETAPE[vers] : vers;
  if (v != null && v >= 0 && v < 5) o[v] = true;
  return o;
}

function tuilesFiche(c) {
  var rends = [];
  (c.lignes || []).forEach(function (l) {
    var r = C.rendementTravail(c, l.travail, A.cfg);
    if (r && !rends.some(function (x) { return x.t === l.travail; })) rends.push({ t: l.travail, r: r });
  });
  var conso = ST.consommationChantier(A.articles, c.id);
  var tuile = function (id, pic, titre, sous) {
    return '<button class="fi-tuile" id="' + id + '">' + picto(pic) + '<b>' + titre + '</b>' +
      '<small>' + esc(sous) + '</small></button>';
  };
  return '<div class="fi-tuiles">' +
    tuile('f-rendement', 'rendements', 'Rendement', rends.length
      ? E.fmt(rends[0].r.rendement, rends[0].r.rendement < 10 ? 2 : 0) + ' ' +
        C.courtUnite(rends[0].r.unite) + ' / jour-homme'
      : 'facultatif · pas compté') +
    tuile('f-fichech', 'fichech', 'Fiche sécurité', C.ficheRequise(c) ? 'obligatoire, plus de ' +
      C.SEUIL_FICHE_HA + ' ha' : (c.fiche ? 'commencée' : 'à préparer avant les travaux')) +
    tuile('f-fournitures', 'stock', 'Fournitures', conso.length
      ? conso.length + ' fourniture' + (conso.length > 1 ? 's' : '') + ' du stock' : 'aucune') +
    tuile('f-note', 'note', 'Note', c.notes ? (c.notes.length > 38 ? c.notes.slice(0, 36) + '…' : c.notes) : 'vide') +
    '</div>';
}

function renderFiche() {
  var z = $('#fiche-chantier'); if (!z) return;
  var c = chantier(A.chOuvert);
  if (!c) { z.innerHTML = '<div class="carte"><div class="vide"><p>Chantier introuvable.</p></div></div>'; return; }
  var k = C.troisChiffres(c, A.cfg), e = C.etapeChantier(c);
  /* Ce qu'il a déplié se garde sur le même chantier, tant que l'étape ne
     change pas : un geste qui fait avancer le chantier ouvre la suivante. */
  if (!A.ficheVue || A.ficheVue.id !== c.id || A.ficheVue.etape !== e) {
    A.ficheVue = { id: c.id, etape: e, ouvertes: etapesOuvertes(c) };
  }
  var cr = c.criteres || {}, surf = C.nb(c.surface) || C.quantite(c, 'ha');
  var lieu = [c.foret, c.parcelles ? 'parc. ' + c.parcelles : '', c.commune,
    surf ? ha(surf) : '',
    cr.essence ? C.nomEssenceCh(cr.essence).toLowerCase() : ''].filter(Boolean);
  var corps = [corpsInfos, corpsDevis, corpsTravaux, corpsFacture, corpsPaye];
  var courts = ['Infos', 'Devis', 'Travaux', 'Facture', 'Payé'];
  var refus = c.statut === 'sansuite';

  z.innerHTML =
    '<div class="fi-haut"><button class="btn-min" data-chretour="1">← Chantiers</button>' +
    '<select id="f-choix" aria-label="Changer de chantier">' + optionsChantiers(c.id) + '</select></div>' +
    /* Passer d'une fiche à la suivante d'un doigt, dans l'ordre des factures
       (R3 : gardées). */
    boutonsVoisins(c.id) +
    '<div class="fi-tete" id="f-bloc-chantier">' +
    '<h2>' + esc(C.nomChantier(c)) + '</h2>' +
    (lieu.length ? '<p class="fi-lieu">' + esc(lieu.join(' · ')) + '</p>' : '') +
    '<button class="fi-qui" id="f-identite">' +
    '<span>Facturé à : <b>' + esc(c.proprietaire || 'à préciser') + '</b>' +
    (c.siren ? ' <small>SIREN</small>' : '') + '</span>' +
    '<span>Donneur d’ordre : <b>' + esc(c.donneur || c.client || 'à préciser') + '</b></span>' +
    '<span class="fi-qui-mod">✎</span></button>' +
    '<div class="fi-bulles" aria-label="Étape ' + Math.min(e + 1, 5) + ' sur 5">' +
    courts.map(function (n, i) {
      var cl = refus && i === 1 ? 'r' : i < e ? 'f' : i === e ? 'e' : '';
      return '<span class="' + cl + '"><i>' + (cl === 'f' ? '✓' : cl === 'r' ? '✕' : '') + '</i>' + n + '</span>';
    }).join('') + '</div>' +
    '<p class="fi-etat">' + badgeStatut(c) +
    (dateStatut(c) ? ' <span class="muted">' + esc(dateStatut(c)) + '</span>' : '') +
    (C.enRetard(c, Date.now()) ? ' <span class="retard">jours passés</span>' : '') + '</p>' +
    '</div>' +
    troisChiffresFiche(c, k) +
    '<div class="fi-etapes" id="f-etapes">' +
    C.ETAPES_FICHE.map(function (t, i) {
      var st = refus && i === 1 ? 'r' : i < e ? 'f' : i === e ? 'e' : 'a';
      return '<details class="fi-etape ' + st + '" data-etape="' + i + '"' +
        (A.ficheVue.ouvertes[i] ? ' open' : '') + '><summary>' +
        '<span class="no">' + (st === 'f' ? '✓' : st === 'r' ? '✕' : i + 1) + '</span>' +
        '<b>' + t + '</b><small>' + esc(resumeEtape(c, i, k)) + '</small>' + picto('chevron') +
        '</summary><div class="fi-corps">' + corps[i](c, k) + '</div></details>';
    }).join('') + '</div>' +
    tuilesFiche(c) +
    '<div class="fi-bas"><button class="lien" id="f-statut">Corriger l’étape à la main</button>' +
    '<button class="lien danger" id="f-sup">Supprimer ce chantier</button></div>';
  if ($('#ff-date')) brancherNumero('F', 'ff-num', c.id);
}
