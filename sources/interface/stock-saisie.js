/* ================== SAISIE DES COMMANDES, DES SORTIES, DES PERTES =======
   Une commande porte plusieurs articles et des frais de livraison qui se
   répartissent sur les quantités reçues : un tuteur à 0,60 € dans une
   commande dont la livraison revient à 0,1325 € par unité coûte en réalité
   0,7325 €. Sans cela, la marge est surestimée.
   ====================================================================== */

var lg = [];   /* lignes en cours de saisie */

function optionsArticles(sel) {
  return A.articles.slice().sort(function (a, b) {
    return (a.nom || '').localeCompare(b.nom || '', 'fr');
  }).map(function (a) {
    return '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.nom || '') + '</option>';
  }).join('');
}
function optionsFournisseurs(sel) {
  return '<option value="">— aucun —</option>' + (A.fournisseurs || []).slice()
    .sort(function (a, b) { return (a.nom || '').localeCompare(b.nom || '', 'fr'); })
    .map(function (f) {
      return '<option value="' + f.id + '"' + (f.id === sel ? ' selected' : '') + '>' + esc(f.nom) + '</option>';
    }).join('');
}
/* En heure locale, jamais par toISOString() : à Paris, minuit y est 22 h la
   veille, et un jour posé à minuit ressortait daté de la veille. C’est le
   piège déjà noté pour versChamp ; jourCle est la seule bonne porte. */
function jourIso(ts) { return C.jourCle(ts || Date.now()); }

/* Un produit dosé se consomme au plant : on plante 300 arbres, on ne verse
   pas 1 800 millilitres. La saisie parle donc en plants, et la conversion se
   fait à la frontière — ce qui est enregistré reste dans l'unité du stock,
   dont dépend tout le calcul. Un sélecteur permet de repasser dans l'unité
   du produit quand c'est elle qu'on a sous les yeux.
   À l'achat, non : on commande des bidons, pas des plants. */
function doseLigne(l) {
  var a = article(l && l.article);
  var d = a ? ST.nb(a.dosage) : 0;
  return (l && l.par === 'plant' && d > 0) ? d : 1;
}
/* Le bloc de lignes est commun aux commandes, aux sorties et aux pertes ;
   l'étiquette du prix change, et seules les sorties raisonnent au plant. */
function renderLignes(prixLabel, auPlant) {
  $('#lg-lignes').innerHTML = lg.map(function (l, i) {
    var art = article(l.article);
    var dose = art ? ST.nb(art.dosage) : 0;
    var dosable = auPlant && dose > 0;
    var enPlants = dosable && l.par === 'plant';
    var uniteLue = enPlants ? 'plant' : (art ? ST.courtUniteArt(art.unite) : '');
    var q = ST.nb(l.qte);
    return '<div class="carte2" style="margin-bottom:7px;padding:9px 10px">' +
      '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
      '<select data-lgart="' + i + '" style="flex:1">' + optionsArticles(l.article) + '</select>' +
      (lg.length > 1 ? '<button type="button" class="btn-min" data-lgsup="' + i + '">✕</button>' : '') + '</div>' +
      '<div class="grille g2">' +
      '<div class="champ" style="margin:0"><label class="eyebrow">Quantité' +
      (uniteLue ? ' (' + esc(uniteLue) + ')' : '') + '</label>' +
      '<input type="text" data-lgqte="' + i + '" class="gros" inputmode="decimal" value="' + esc(l.qte) + '"></div>' +
      (prixLabel ? '<div class="champ" style="margin:0"><label class="eyebrow">' + prixLabel +
        (enPlants ? ' / plant' : '') + '</label>' +
        '<input type="text" data-lgprix="' + i + '" class="gros" inputmode="decimal" value="' + esc(l.prix) + '"></div>' : '') +
      '</div>' +
      (dosable
        ? '<div style="display:flex;gap:7px;align-items:center;margin-top:7px;flex-wrap:wrap">' +
          '<select data-lgpar="' + i + '" style="flex:none;width:auto">' +
          '<option value="plant"' + (enPlants ? ' selected' : '') + '>saisir en plants</option>' +
          '<option value=""' + (enPlants ? '' : ' selected') + '>saisir en ' +
          esc(ST.courtUniteArt(art.unite)) + '</option></select>' +
          '<span class="muted" style="font-size:12px" data-lgconv="' + i + '">' +
          (q > 0 && enPlants
            ? '<span class="muted" style="font-size:12px">' + E.fmt(q, 0) + ' × ' +
              E.fmt(dose, dose % 1 ? 2 : 0) + ' ' + esc(ST.courtUniteArt(art.unite)) + ' = <b>' +
              E.fmt(ST.arr(q * dose, 2), 0) + ' ' + esc(ST.courtUniteArt(art.unite)) +
              '</b> sortiront du stock'
            : '') + '</span></div>'
        : '') +
      '</div>';
  }).join('') + '<button type="button" class="btn-min" id="lg-plus">+ un produit</button>';
}
/* La phrase de conversion, réécrite seule : redessiner le bloc entier à
   chaque touche ferait perdre le curseur au milieu du nombre. */
function majConversions(auPlant) {
  $$('#lg-lignes [data-lgconv]').forEach(function (z) {
    var l = lg[Number(z.dataset.lgconv)], a = article(l && l.article);
    var dose = a ? ST.nb(a.dosage) : 0, q = ST.nb(l && l.qte);
    if (!auPlant || !dose || l.par !== 'plant' || !(q > 0)) { z.textContent = ''; return; }
    var u = ST.courtUniteArt(a.unite);
    z.innerHTML = E.fmt(q, 0) + ' × ' + E.fmt(dose, dose % 1 ? 2 : 0) + ' ' + esc(u) +
      ' = <b>' + E.fmt(ST.arr(q * dose, 2), 0) + ' ' + esc(u) + '</b> sortiront du stock';
  });
}
function lireLignes() {
  $$('#lg-lignes [data-lgart]').forEach(function (i) { lg[Number(i.dataset.lgart)].article = i.value; });
  $$('#lg-lignes [data-lgqte]').forEach(function (i) { lg[Number(i.dataset.lgqte)].qte = i.value; });
  $$('#lg-lignes [data-lgprix]').forEach(function (i) { lg[Number(i.dataset.lgprix)].prix = i.value; });
  $$('#lg-lignes [data-lgpar]').forEach(function (i) { lg[Number(i.dataset.lgpar)].par = i.value; });
  /* Un produit non dosé ne se saisit jamais au plant : changer d'article
     remet la ligne dans son unité. */
  lg.forEach(function (l) {
    var a = article(l.article);
    if (!a || !ST.nb(a.dosage)) l.par = '';
  });
}
function brancherLignes(prixLabel, apercu, auPlant) {
  renderLignes(prixLabel, auPlant);
  $('#lg-lignes').addEventListener('input', function () {
    lireLignes(); majConversions(auPlant); apercu();
  });
  /* Un changement d'article ou d'unité redessine : l'étiquette et la
     conversion doivent suivre immédiatement. */
  $('#lg-lignes').addEventListener('change', function () {
    lireLignes(); renderLignes(prixLabel, auPlant); apercu();
  });
  $('#lg-lignes').addEventListener('click', function (e) {
    var plus = e.target.closest('#lg-plus'), sup = e.target.closest('[data-lgsup]');
    if (plus) {
      lireLignes();
      var a0 = A.articles[0];
      lg.push({ article: a0.id, qte: '', prix: '',
        par: (auPlant && ST.nb(a0.dosage)) ? 'plant' : '' });
    }
    else if (sup) { lireLignes(); lg.splice(Number(sup.dataset.lgsup), 1); }
    else return;
    renderLignes(prixLabel, auPlant); apercu();
  });
  apercu();
}
/* La conversion se fait ici, à la sortie du formulaire, et nulle part
   ailleurs : tout ce qui suit — aperçu, enregistrement, stock — continue de
   raisonner dans l'unité du produit. Le prix suit la quantité : un prix par
   plant devient un prix par millilitre. */
function lignesValides() {
  return lg.filter(function (l) { return l.article && ST.nb(l.qte) > 0; })
    .map(function (l) {
      var k = doseLigne(l);
      return { article: l.article, qte: ST.arr(ST.nb(l.qte) * k, 3),
        prix: k !== 1 ? ST.arr(ST.nb(l.prix) / k, 6) : ST.nb(l.prix) };
    });
}

/* ---------------------------------------------------------- une commande */
function ouvrirCommande(id, artPref) {
  if (!A.articles.length) {
    toast('Créez d’abord un produit dans les réglages.');
    allerReglages('stock'); return;
  }
  var c = id ? commande(id) : null;
  if (id && !c) return;
  lg = c ? (c.lignes || []).map(function (l) {
    return { article: l.article, qte: String(l.qte), prix: String(l.prix) };
  }) : [{ article: artPref || A.articles[0].id, qte: '', prix: '' }];
  if (!lg.length) lg = [{ article: A.articles[0].id, qte: '', prix: '' }];

  modale(id ? 'Modifier la commande' : 'Nouvelle commande',
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="cm-num">N° de commande</label>' +
    '<input type="text" id="cm-num" autocomplete="off" value="' + esc(c ? c.num || '' : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="cm-statut">Statut</label>' +
    '<select id="cm-statut">' + ST.STATUTS_ACHAT.map(function (s) {
      return '<option value="' + s.c + '"' + ((c ? c.statut : 'recu') === s.c ? ' selected' : '') + '>' + s.n + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="cm-dcmd">Date de commande</label>' +
    '<input type="date" id="cm-dcmd" value="' + jourIso(c && c.dateCmd) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="cm-dliv">Date de livraison</label>' +
    '<input type="date" id="cm-dliv" value="' + jourIso(c && (c.dateLiv || c.dateCmd)) + '"></div>' +
    '</div>' +
    '<div class="champ"><label class="eyebrow" for="cm-four">Fournisseur</label>' +
    '<div style="display:flex;gap:6px">' +
    '<select id="cm-four" style="flex:1">' + optionsFournisseurs(c && c.fournisseur) + '</select>' +
    '<button type="button" class="btn-min" id="cm-four-plus">+</button></div></div>' +
    '<label class="eyebrow" style="margin-top:6px;display:block">Produits commandés</label>' +
    '<div id="lg-lignes"></div>' +
    '<div class="champ" style="margin-top:11px"><label class="eyebrow" for="cm-livr">Frais de livraison (€ HT)</label>' +
    '<input type="text" id="cm-livr" inputmode="decimal" placeholder="0" value="' + (c && ST.nb(c.livraison) ? c.livraison : '') + '"></div>' +
    '<div class="carte2" id="cm-apercu" style="margin:11px 0"></div>' +
    (function () {
      var dep = id ? depenseDeCommande(id) : null;
      var taux = dep ? FIN.nb((dep.lignes || [{}])[0].taux) : 20;
      return '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;font-size:13.5px">' +
        '<input type="checkbox" id="cm-dep"' + (!id || dep ? ' checked' : '') + '> ' +
        (id ? 'Cette commande figure dans les dépenses' : 'Créer aussi la dépense correspondante') +
        '</label>' +
        '<div class="grille g2" style="margin-top:8px"><div class="champ">' +
        '<label class="eyebrow" for="cm-tva">TVA</label>' +
        '<select id="cm-tva">' + FIN.TAUX_TVA.map(function (t) {
          return '<option value="' + t + '"' + (t === taux ? ' selected' : '') + '>' +
            (t ? t + ' %' : 'sans TVA') + '</option>';
        }).join('') + '</select></div></div>' +
        '<p class="muted" style="font-size:11.5px;margin:5px 0 0" id="cm-dep-aide"></p>';
    })() +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="cm-ok">Enregistrer</button>' +
    (id ? '<button class="btn danger btn-min" id="cm-sup">Supprimer</button>' : '') + '</div>');

  var apercu = function () {
    var z = $('#cm-apercu'); if (!z) return;
    var v = lignesValides().filter(function (l) { return l.prix > 0; });
    var qteTot = v.reduce(function (s, l) { return s + l.qte; }, 0);
    var march = v.reduce(function (s, l) { return s + l.qte * l.prix; }, 0);
    var livr = ST.nb($('#cm-livr').value);
    if (!qteTot) { z.innerHTML = '<span class="muted">Renseignez quantité et prix.</span>'; return; }
    var parts = partsPort({ lignes: v, livraison: livr });
    z.innerHTML = '<b class="num" style="font-size:19px">' + eur(march + livr) + '</b> HT' +
      '<div class="muted" style="font-size:12.5px;margin-top:3px">' +
      E.fmt(qteTot, 0) + ' unités · ' + eur(march) + ' de marchandise' +
      (livr ? ' + ' + eur(livr) + ' de livraison' : '') + '</div>' +
      (livr ? '<div style="margin-top:7px;font-size:12.5px">' + v.map(function (l, i) {
        var a = article(l.article);
        return '<div style="display:flex;justify-content:space-between;padding:2px 0">' +
          '<span>' + esc(a ? a.nom : '') + '</span><span class="num muted">' +
          E.fmt(l.prix, 2) + ' → <b>' + E.fmt(ST.arr(l.prix + parts[i], 4), 4) + ' €</b></span></div>';
      }).join('') +
      (parts.regle === 'montant' ? '<div class="muted" style="font-size:11.5px;margin-top:5px">' +
        'Unités différentes dans la commande : la livraison est répartie au prorata des montants.</div>' : '') +
      '</div>' : '');
  };
  brancherLignes('Prix unitaire HT', apercu);
  $('#cm-livr').addEventListener('input', apercu);
  $('#cm-four-plus').addEventListener('click', function () { fermerModale(); ouvrirFournisseur(null); });

  /* Prévenir au moment du geste, pas à l'enregistrement : décocher retire une
     dépense réelle, et changer la TVA change ce qu'on récupère. */
  var majAideDep = function () {
    var z = $('#cm-dep-aide'); if (!z) return;
    var coche = $('#cm-dep').checked;
    z.textContent = coche
      ? 'La dépense suivra cette commande : montant, TVA et date.'
      : 'Cette commande restera hors des dépenses, donc hors du calcul de TVA.';
  };
  if ($('#cm-dep')) {
    $('#cm-dep').addEventListener('change', function () {
      var dep = id ? depenseDeCommande(id) : null;
      if (!this.checked && dep) {
        if (!confirm('Décocher retirera la dépense de ' + eur(FIN.ttcDe(dep)) +
          ' liée à cette commande.\n\nSa TVA ne sera plus récupérée. Confirmer ?')) {
          this.checked = true;
        }
      }
      majAideDep();
    });
    majAideDep();
  }
  if ($('#cm-tva')) {
    var tvaAvant = $('#cm-tva').value;
    $('#cm-tva').addEventListener('change', function () {
      if (!id || !depenseDeCommande(id) || this.value === tvaAvant) { tvaAvant = this.value; return; }
      var mot = function (v) { return ST.nb(v) ? String(v).replace('.', ',') + ' %' : 'sans TVA'; };
      if (!confirm('La TVA de la dépense passera de ' + mot(tvaAvant) + ' à ' + mot(this.value) +
        '.\n\nConfirmer ?')) { this.value = tvaAvant; return; }
      tvaAvant = this.value;
    });
  }
  $('#cm-ok').addEventListener('click', function () {
    lireLignes();
    var lignes = lignesValides();
    if (!lignes.length) { toast('Aucune ligne complète.'); return; }
    var maj = {
      num: $('#cm-num').value.trim(), statut: $('#cm-statut').value,
      dateCmd: versDate($('#cm-dcmd').value) || Date.now(),
      dateLiv: versDate($('#cm-dliv').value) || null,
      fournisseur: $('#cm-four').value || null,
      livraison: ST.nb($('#cm-livr').value), lignes: lignes, maj: Date.now()
    };
    A.commandes = A.commandes || [];
    if (c) Object.keys(maj).forEach(function (k) { c[k] = maj[k]; });
    else { maj.id = uid(); A.commandes.push(maj); }
    /* En modification, « maj » n'a pas d'identifiant : c'est celui de la
       commande ouverte qui rattache la dépense. */
    var idCmd = id || maj.id;
    var suite = sauverCommandes();
    /* La dépense découle de la commande : on la crée, on la met à jour ou on
       la retire selon la case, plutôt que de la figer à la création. */
    var veut = $('#cm-dep') && $('#cm-dep').checked;
    var dep = depenseDeCommande(idCmd);
    if (veut) {
      var taux = ST.nb($('#cm-tva').value);
      var march = lignes.reduce(function (s, l) { return s + l.qte * l.prix; }, 0);
      var dl = [{ libelle: 'Fournitures' + (maj.num ? ' ' + maj.num : ''), categorie: 'FOURN',
        ttc: FIN.arr(march * (1 + taux / 100), 2), taux: taux }];
      if (maj.livraison) dl.push({ libelle: 'Livraison', categorie: 'FOURN',
        ttc: FIN.arr(maj.livraison * (1 + taux / 100), 2), taux: taux });
      if (!dep) {
        dep = { id: uid(), commande: idCmd };
        A.depenses.push(dep);
      }
      dep.date = maj.dateLiv || maj.dateCmd;
      dep.fournisseur = nomFournisseur(maj.fournisseur);
      dep.numero = maj.num;
      dep.lignes = dl;
      dep.maj = Date.now();
      suite = suite.then(sauverDepenses);
    } else if (dep) {
      A.depenses = A.depenses.filter(function (x) { return x !== dep; });
      suite = suite.then(sauverDepenses);
    }
    suite.then(function () {
      fermerModale(); majStock(); renderDepenses(); renderFinances(); renderAnalyses();
      toast(id ? 'Commande modifiée.' : 'Commande enregistrée.');
    });
  });
  if (id) $('#cm-sup').addEventListener('click', function () {
    if (!confirm('Supprimer cette commande ? Le stock sera recalculé sans elle.\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
    A.commandes = A.commandes.filter(function (x) { return x.id !== id; });
    jeterObjet('commande', c, c.num || 'Commande',
      (c.lignes || []).length + ' ligne' + ((c.lignes || []).length > 1 ? 's' : ''))
      .then(sauverCommandes).then(function () {
        fermerModale(); majStock(); toast('Commande mise à la corbeille.');
      });
  });
  apercu();
}

/* ------------------------------------------------- une sortie, une perte */
function ouvrirSortieStock(id, perte, artPref) {
  if (!A.articles.length) {
    toast('Créez d’abord un produit dans les réglages.');
    allerReglages('stock'); return;
  }
  var s = id ? sortie(id) : null;
  if (id && !s) return;
  if (s) perte = !!s.perte;
  var auPlant = function (idArt) {
    var a = article(idArt);
    return a && ST.nb(a.dosage) ? 'plant' : '';
  };
  lg = s ? (s.lignes || []).map(function (l) {
    var par = auPlant(l.article), d = par ? ST.nb(article(l.article).dosage) : 1;
    return { article: l.article, par: par,
      qte: String(ST.arr(ST.nb(l.qte) / d, 3)),
      prix: String(ST.arr(ST.nb(l.prix) * d, 4)) };
  }) : [{ article: artPref || A.articles[0].id, qte: '', prix: '',
    par: auPlant(artPref || A.articles[0].id) }];
  if (!lg.length) lg = [{ article: A.articles[0].id, qte: '', prix: '',
    par: auPlant(A.articles[0].id) }];

  var chs = A.chantiers.slice().sort(function (x, y) { return (y.maj || 0) - (x.maj || 0); });
  modale(id ? (perte ? 'Modifier la perte' : 'Modifier la sortie')
    : (perte ? 'Perte ou casse' : 'Sortie de stock'),
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="so-date">Date</label>' +
    '<input type="date" id="so-date" value="' + jourIso(s && s.date) + '"></div>' +
    (perte
      ? '<div class="champ"><label class="eyebrow" for="so-motif">Motif</label>' +
        '<input type="text" id="so-motif" autocomplete="off" placeholder="casse, vol, périmé…" value="' + esc(s ? s.motif || '' : '') + '"></div>'
      : '<div class="champ"><label class="eyebrow" for="so-num">N° de facture</label>' +
        '<input type="text" id="so-num" autocomplete="off" value="' + esc(s ? s.num || '' : '') + '"></div>') +
    '</div>' +
    (perte ? '' :
      '<div class="champ"><label class="eyebrow" for="so-ch">Chantier</label>' +
      '<select id="so-ch"><option value="">— sans chantier —</option>' +
      chs.map(function (x) {
        return '<option value="' + x.id + '"' + (s && s.chantier === x.id ? ' selected' : '') + '>' +
          esc(C.nomChantier(x)) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="grille g2">' +
      '<div class="champ"><label class="eyebrow" for="so-client">Client</label>' +
      '<input type="text" id="so-client" autocomplete="off" placeholder="si hors chantier" value="' + esc(s ? s.client || '' : '') + '"></div>' +
      '<div class="champ"><label class="eyebrow" for="so-statut">Statut</label>' +
      '<select id="so-statut">' + ST.STATUTS_VENTE.map(function (x) {
        return '<option value="' + x.c + '"' + ((s ? s.statut : 'fini') === x.c ? ' selected' : '') + '>' + x.n + '</option>';
      }).join('') + '</select></div></div>' +
      '<p class="muted" style="font-size:11.5px;margin:-4px 0 8px" id="so-note-ch"></p>') +
    (s && s.auto
      ? '<p class="acompleter-bloc" style="margin:0 0 9px">Cette sortie a été créée ' +
        'depuis la facture du chantier. Si vous la modifiez, elle cessera de la suivre ' +
        'et gardera vos chiffres — la facture, elle, ne changera pas.</p>'
      : '') +
    '<label class="eyebrow" style="margin-top:6px;display:block">Produits sortis</label>' +
    '<div id="lg-lignes"></div>' +
    (perte ? '' :
      '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin-top:9px">' +
      '<input type="checkbox" id="so-deb"' + (s && s.debours ? ' checked' : '') + '> ' +
      'Refacturé en débours (hors chiffre d’affaires)</label>') +
    '<div class="carte2" id="so-apercu" style="margin:11px 0"></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="so-ok">Enregistrer</button>' +
    (id ? '<button class="btn danger btn-min" id="so-sup">Supprimer</button>' : '') + '</div>');

  var apercu = function () {
    var z = $('#so-apercu'); if (!z) return;
    var v = lignesValides();
    if (!v.length) { z.innerHTML = '<span class="muted">Quantité attendue.</span>'; return; }
    var cout = 0, ca = 0, manque = [];
    v.forEach(function (l) {
      var a = article(l.article); if (!a) return;
      cout += l.qte * ST.pmp(a); ca += l.qte * l.prix;
      if (l.qte > ST.quantite(a)) manque.push(a.nom);
    });
    var deb = $('#so-deb') && $('#so-deb').checked;
    z.innerHTML = perte
      ? '<b class="num" style="font-size:19px">' + eur(ST.arr(cout, 2)) + '</b> de stock perdu'
      : deb
        ? '<b class="num" style="font-size:19px">' + eur(ST.arr(ca, 2)) + '</b> refacturés en débours' +
          '<div class="muted" style="font-size:12.5px;margin-top:3px">' +
          eur(ST.arr(cout, 2)) + ' de stock sorti · écart ' + eur(ST.arr(ca - cout, 2)) +
          ' · hors chiffre d’affaires</div>'
        : '<b class="num" style="font-size:19px">' + eur(ST.arr(ca, 2)) + '</b> de vente' +
          '<div class="muted" style="font-size:12.5px;margin-top:3px">' +
          eur(ST.arr(cout, 2)) + ' de stock sorti · marge ' + eur(ST.arr(ca - cout, 2)) +
          (ca > 0 ? ' (' + E.fmt((ca - cout) / ca * 100, 1) + ' %)' : '') + '</div>';
    if (manque.length) z.innerHTML += '<div class="retard" style="margin-top:5px">Stock insuffisant : ' +
      esc(manque.join(', ')) + '</div>';
    /* Le chiffre d'affaires vient des lignes du chantier : on rappelle ce qui
       y figure déjà, pour que la même vente ne soit pas comptée deux fois. */
    var vch = $('#so-ch') ? $('#so-ch').value : '';
    var chx = vch ? chantier(vch) : null;
    if (chx && !deb) {
      var dejaVendu = ((chx.lignes || []).filter(function (x) { return x.nature === 'vente'; })
        .reduce(function (t, x) { return t + C.montantLigne(x); }, 0));
      if (dejaVendu) z.innerHTML += '<div class="muted" style="font-size:11.5px;margin-top:5px">' +
        'Ce chantier porte déjà ' + eur(ST.arr(dejaVendu, 2)) + ' de vente de fournitures : ' +
        'le chiffre d’affaires vient de là, pas d’ici.</div>';
    }
  };
  brancherLignes(perte ? '' : 'Prix de vente unitaire', apercu, true);

  var noteCh = function () {
    var e = $('#so-note-ch'); if (!e) return;
    var v = $('#so-ch') ? $('#so-ch').value : '';
    var ch = v ? chantier(v) : null;
    if ($('#so-statut')) $('#so-statut').disabled = !!ch;
    e.textContent = ch
      ? 'Le statut suit celui du chantier : ' + C.nomStatut(ch.statut, ch) + '.'
      : '';
  };
  if ($('#so-ch')) {
    $('#so-ch').addEventListener('change', function () { noteCh(); apercu(); });
    noteCh();
  }
  if ($('#so-deb')) $('#so-deb').addEventListener('change', apercu);

  $('#so-ok').addEventListener('click', function () {
    lireLignes();
    var lignes = lignesValides();
    if (!lignes.length) { toast('Aucune ligne complète.'); return; }
    var maj = {
      date: versDate($('#so-date').value) || Date.now(), perte: !!perte,
      motif: perte ? $('#so-motif').value.trim() : null,
      num: perte ? '' : $('#so-num').value.trim(),
      client: perte ? '' : $('#so-client').value.trim(),
      chantier: perte ? null : ($('#so-ch').value || null),
      debours: perte ? false : !!($('#so-deb') && $('#so-deb').checked),
      statut: perte ? 'fini' : $('#so-statut').value,
      lignes: lignes, maj: Date.now()
    };
    A.sorties = A.sorties || [];
    /* Une sortie née d'une facture se refaisait à chaque modification du
       chantier : la corriger n'avait donc aucun effet durable. Dès qu'on y
       touche, elle cesse de suivre la facture et devient la sienne — c'est
       la consommation réelle qui compte pour le stock, pas ce qui a été
       facturé. La facture, elle, ne bouge pas. */
    var detachee = !!(s && s.auto);
    if (s) {
      Object.keys(maj).forEach(function (k) { s[k] = maj[k]; });
      if (detachee) s.auto = false;
    }
    else { maj.id = uid(); A.sorties.push(maj); }
    sauverSorties().then(function () {
      fermerModale(); majStock(); renderFiche(); renderFinances(); renderAnalyses();
      toast(perte ? 'Perte enregistrée.' : id ? 'Sortie modifiée.' : 'Sortie enregistrée.');
      if (detachee) {
        toast('Elle ne suivra plus la facture : c’est votre chiffre qui compte.');
      }
    });
  });
  if (id) $('#so-sup').addEventListener('click', function () {
    if (!confirm('Supprimer ce mouvement ? Le stock sera recalculé sans lui.\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
    A.sorties = A.sorties.filter(function (x) { return x.id !== id; });
    jeterObjet('sortie', s, s.num || s.client || (s.perte ? 'Perte' : 'Sortie'),
      (s.lignes || []).length + ' ligne' + ((s.lignes || []).length > 1 ? 's' : ''))
      .then(sauverSorties).then(function () {
        fermerModale(); majStock(); toast('Mouvement mis à la corbeille.');
      });
  });
  apercu();
}

