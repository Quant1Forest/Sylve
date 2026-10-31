/* ------------------------------------------------------ achats à venir */
function achat(id) {
  return (A.achats || []).filter(function (x) { return x.id === id; })[0] || null;
}
function renderAchats() {
  var z = $('#ach-liste'); if (!z) return;
  var l = FIN.achatsRanges(A.achats);
  var t = FIN.totauxAchats(A.achats);
  var pris = null;
  var lignes = l.map(function (a) {
    var ht = C.arr(C.nb(a.ttc) / (1 + C.nb(a.taux) / 100), 2);
    /* Un intertitre à chaque changement de priorité : la liste se lit du
       plus pressé au moins, et on voit où on passe de l'un à l'autre. */
    var groupe = a.fait ? 'fait' : (a.priorite || 'unjour');
    var tete = '';
    if (groupe !== pris) {
      pris = groupe;
      tete = '<p class="eyebrow" style="margin:16px 0 6px">' +
        (a.fait ? 'Déjà achetés' : esc(FIN.nomPriorite(groupe))) + '</p>';
    }
    return tete + '<div class="achat' + (a.fait ? ' fait' : '') + '">' +
      '<button type="button" class="ach-case" data-achfait="' + esc(a.id) + '" ' +
      'aria-pressed="' + (a.fait ? 'true' : 'false') + '" ' +
      'title="' + (a.fait ? 'Remettre dans la liste' : 'Marquer comme acheté') + '" ' +
      'aria-label="' + (a.fait ? 'Remettre dans la liste' : 'Marquer comme acheté') + '">' +
      (a.fait ? '✓' : '') + '</button>' +
      '<button type="button" class="ach-corps" data-achmod="' + esc(a.id) + '">' +
      '<b>' + esc(a.quoi || 'Achat') + '</b>' +
      '<small>' + esc(FIN.nomCategorie(a.categorie)) +
      (a.fait && a.dateFait ? ' · acheté le ' + dateCourte(a.dateFait)
        : ' · ' + esc(FIN.nomPriorite(a.priorite))) + '</small>' +
      (a.note ? '<small class="ach-note">' + esc(a.note) + '</small>' : '') +
      '</button>' +
      '<span class="ach-prix"><b class="num">' + eur(C.nb(a.ttc)) + '</b>' +
      '<small>' + eur(ht) + ' HT</small></span>' +
      '</div>';
  }).join('');

  z.innerHTML =
    '<div class="carte"><div class="carte-titre"><h2>Ce que je compte acheter</h2>' +
    '<button class="btn primaire btn-min" id="ach-plus">+ Achat</button></div>' +
    '<p class="sous-titre-bloc">Rangé par ce qui presse. Cochez ce qui est acheté : la ligne passe à la suite, elle ne disparaît pas.</p>' +
    (t.n ? '<div class="kpi" style="margin-top:0">' +
      '<div class="carte2"><b class="num">' + eur(t.ttc) + '</b><small>à prévoir, TTC</small></div>' +
      '<div class="carte2"><b class="num">' + t.n + '</b><small>achat' + (t.n > 1 ? 's' : '') +
      ' en attente</small></div></div>' : '') +
    (lignes || '<div class="vide"><p>Rien de prévu. « + Achat » pour noter ce qui vous trotte dans la tête.</p></div>') +
    '</div>';
}

function renderBudgetAchats() {
  var z = $('#ach-budget'); if (!z) return;
  var t = FIN.totauxAchats(A.achats);
  if (!t.n && !t.faitN) {
    z.innerHTML = '<div class="carte"><h2>Ce que ça pèse</h2>' +
      '<div class="vide"><p>Rien à chiffrer tant que la liste est vide.</p></div></div>';
    return;
  }
  var barre = function (nom, montant, coul) {
    var part = t.ttc > 0 ? Math.round(montant / t.ttc * 100) : 0;
    return '<div style="margin-bottom:9px">' +
      '<div style="display:flex;justify-content:space-between;font-size:13.5px">' +
      '<span>' + esc(nom) + '</span><b class="num">' + eur(montant) + '</b></div>' +
      '<div class="ach-jauge"><i style="width:' + part + '%;background:' + coul + '"></i></div>' +
      '</div>';
  };
  z.innerHTML =
    '<div class="carte"><h2>Ce que ça pèse</h2>' +
    '<div class="kpi" style="margin-top:0">' +
    '<div class="carte2"><b class="num">' + eur(t.ttc) + '</b><small>à sortir, TTC</small></div>' +
    '<div class="carte2"><b class="num">' + eur(t.ht) + '</b><small>hors taxes</small></div>' +
    '<div class="carte2"><b class="num">' + eur(t.tva) + '</b><small>TVA récupérable</small></div>' +
    '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:10px 0 0">Des montants estimés : ils disent ce qui vous attend, ils ne remplacent pas vos dépenses.</p></div>' +

    (t.parPriorite.length ? '<div class="carte"><h2>Par ce qui presse</h2>' +
      t.parPriorite.map(function (p) {
        return barre(FIN.nomPriorite(p.c) + ' · ' + p.n, p.ttc, FIN.coulPriorite(p.c));
      }).join('') + '</div>' : '') +

    (t.parCategorie.length ? '<div class="carte"><h2>Par catégorie</h2>' +
      t.parCategorie.map(function (c2) {
        return barre(FIN.nomCategorie(c2.c) + ' · ' + c2.n, c2.ttc, 'var(--accent)');
      }).join('') + '</div>' : '') +

    (t.faitN ? '<div class="carte"><h2>Déjà achetés</h2>' +
      '<div class="kpi" style="margin-top:0">' +
      '<div class="carte2"><b class="num">' + eur(t.faitTtc) + '</b><small>dépensés</small></div>' +
      '<div class="carte2"><b class="num">' + t.faitN + '</b><small>ligne' +
      (t.faitN > 1 ? 's' : '') + ' cochée' + (t.faitN > 1 ? 's' : '') + '</small></div></div></div>' : '');
}

function ouvrirAchat(id) {
  var a = id ? achat(id) : null;
  if (id && !a) return;
  var pri = (a && a.priorite) || 'annee';
  modale(a ? 'Modifier l’achat' : 'Un achat à prévoir',
    '<div class="champ"><label class="eyebrow" for="ac-quoi">Ce que c’est</label>' +
    '<input type="text" id="ac-quoi" class="gros" autocomplete="off" ' +
    'placeholder="débroussailleuse, remorque…" value="' + esc(a ? a.quoi || '' : '') + '"></div>' +
    '<div class="grille g3">' +
    '<div class="champ"><label class="eyebrow" for="ac-ttc">Montant TTC</label>' +
    '<input type="text" id="ac-ttc" class="gros" inputmode="decimal" value="' +
    (a && a.ttc != null ? esc(String(a.ttc).replace('.', ',')) : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="ac-taux">TVA</label>' +
    '<select id="ac-taux">' + FIN.TAUX_TVA.map(function (x) {
      return '<option value="' + x + '"' +
        ((a ? FIN.nb(a.taux) : 20) === x ? ' selected' : '') + '>' +
        (x ? String(x).replace('.', ',') + ' %' : 'sans') + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="ac-cat">Catégorie</label>' +
    '<select id="ac-cat">' + FIN.CATEGORIES.map(function (c2) {
      return '<option value="' + c2.c + '"' +
        ((a && a.categorie) === c2.c ? ' selected' : '') + '>' + esc(c2.n) + '</option>';
    }).join('') + '</select></div></div>' +
    '<p class="muted" style="font-size:11.5px;margin:0 0 12px" id="ac-ht"></p>' +
    '<p class="eyebrow" style="margin:4px 0 6px">Ça presse ?</p>' +
    '<div class="chips" id="ac-pri">' + FIN.PRIORITES_ACHAT.map(function (p) {
      return '<button type="button" class="chip" data-acpri="' + p.c + '" aria-pressed="' +
        (pri === p.c ? 'true' : 'false') + '">' + esc(p.n) + '</button>';
    }).join('') + '</div>' +
    '<div class="champ" style="margin-top:13px"><label class="eyebrow" for="ac-note">' +
    'À quoi ça va servir</label>' +
    '<textarea id="ac-note" placeholder="pour ne plus louer à chaque plantation">' +
    esc(a ? a.note || '' : '') + '</textarea></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    (a ? '<button class="btn danger btn-min" id="ac-sup">Retirer</button>' : '') +
    '<button class="btn primaire" id="ac-ok">Enregistrer</button></div>');

  /* Il saisit le TTC — c'est ce qu'il lit sur une étiquette — et le hors
     taxes se déduit sous ses yeux. */
  var majHt = function () {
    var ttc = C.nb($('#ac-ttc').value), taux = C.nb($('#ac-taux').value);
    $('#ac-ht').innerHTML = ttc > 0
      ? 'Soit <b>' + eur(C.arr(ttc / (1 + taux / 100), 2)) + '</b> hors taxes, et ' +
        eur(C.arr(ttc - ttc / (1 + taux / 100), 2)) + ' de TVA à récupérer.'
      : 'Le hors taxes se déduit du TTC.';
  };
  $('#ac-ttc').addEventListener('input', majHt);
  $('#ac-taux').addEventListener('change', majHt);
  majHt();
  $('#ac-pri').addEventListener('click', function (e) {
    var b = e.target.closest('[data-acpri]'); if (!b) return;
    pri = b.dataset.acpri;
    $$('#ac-pri [data-acpri]').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.acpri === pri));
    });
  });
  var fini = function (message) {
    sauverAchats().then(function () {
      fermerModale(); renderAchats(); renderBudgetAchats();
      toast(message);
    });
  };
  $('#ac-ok').addEventListener('click', function () {
    var quoi = $('#ac-quoi').value.trim();
    if (!quoi) { toast('Dites ce que c’est.'); return; }
    var maj = { quoi: quoi, ttc: C.nb($('#ac-ttc').value) || 0,
      taux: C.nb($('#ac-taux').value), categorie: $('#ac-cat').value,
      priorite: pri, note: $('#ac-note').value.trim(), maj: Date.now() };
    if (a) { Object.keys(maj).forEach(function (k) { a[k] = maj[k]; }); }
    else { maj.id = uid(); maj.cree = Date.now(); maj.fait = false; A.achats.push(maj); }
    fini(a ? 'Achat modifié.' : 'Achat noté.');
  });
  if (a) {
    $('#ac-sup').addEventListener('click', function () {
      if (!confirm('Retirer « ' + (a.quoi || 'cet achat') + ' » de la liste ?')) return;
      A.achats = A.achats.filter(function (x) { return x.id !== id; });
      fini('Achat retiré.');
    });
  }
}

/* La situation d'un module : un chiffre, son unité, une phrase. Les tuiles
   du ☰ la lisent ici (elles l'ont reprise de Mon entreprise et de l'accueil,
   retirés au lot 5b), d'un seul calcul. */
function situationModule(m) {
  if (m === 'achats') {
    var ta = FIN.totauxAchats(A.achats);
    return { n: ta.n ? eurCourt(ta.ttc) : '—', u: 'à prévoir',
      s: ta.n ? ta.n + ' achat' + (ta.n > 1 ? 's' : '') + ' en attente' : 'Ce que vous comptez acheter' };
  }
  if (m === 'rendements') {
    var nRef = 0, nTypes = 0;
    C.TRAVAUX.forEach(function (tv) {
      var r = C.references(A.chantiers, tv.c, A.cfg);
      if (r.length) { nTypes++; nRef += r.length; }
    });
    return { n: nRef ? String(nRef) : '—', u: 'références',
      s: nRef ? nTypes + ' type' + (nTypes > 1 ? 's' : '') + ' de travaux mesuré' + (nTypes > 1 ? 's' : '')
        : 'Saisissez temps et quantités pour en obtenir' };
  }
  if (m === 'vehicule') {
    var kmV = kmVehicule();
    var nRet = echeancesVehicule().filter(function (x) { return x.etat === 'retard'; }).length;
    return { n: kmV ? E.fmt(kmV, 0) : '—', u: 'km',
      s: nRet ? nRet + ' échéance' + (nRet > 1 ? 's' : '') + ' dépassée' + (nRet > 1 ? 's' : '')
        : 'Carnet d’entretien, échéances' };
  }
  if (m === 'stock') {
    /* Le même compte que la ligne « À recommander » d'Aujourd'hui (S2). */
    var vs = ST.valeurTotale(A.articles), bas = ST.aRecommander(A.articles);
    return { n: vs ? eur(vs) : '—', u: 'en stock',
      s: A.articles.length
        ? A.articles.length + ' article' + (A.articles.length > 1 ? 's' : '') +
          (bas.length ? ' · ' + bas.length + ' à recommander' : '')
        : 'Protections, tuteurs, marges' };
  }
  if (m === 'cubage') {
    var vol = A.index.reduce(function (s, x) { return s + (Number(x.vol) || 0); }, 0);
    return { n: A.index.length ? E.fmt(vol, 2) : '—', u: 'm³',
      s: A.index.length ? A.index.length + (A.index.length > 1 ? ' bordereaux' : ' bordereau')
        : 'Aucun bordereau' };
  }
  if (m === 'bois') {
    var r = H.repartition(A.piles);
    return { n: A.piles.length ? E.fmt(r.total, 2) : '—', u: 'stères',
      s: A.piles.length ? A.piles.length + (A.piles.length > 1 ? ' piles' : ' pile')
        : 'Aucune pile enregistrée' };
  }
  return { n: '—', u: '', s: '' };
}

function renderAlertes() {
  var z = $('#bandeau-alertes'); if (!z) return;
  /* Le seul « À traiter » depuis la 4.82 : l'écran Entreprise le répétait,
     et il l'y trouvait de trop. Les journées à placer et le travail qui
     approche vivent dans Aujourd'hui et sur le calendrier ; ici on ne garde
     que ce qui porte un nom de chantier et attend une action. */
  var al = C.alertes(A.chantiers, A.cfg, Date.now()).filter(function (a2) {
    return ['retard', 'afacturer', 'impaye'].indexOf(a2.type) >= 0;
  });
  A.nbAlertes = al.length;
  if (!al.length) { z.innerHTML = ''; majPastilleEntreprise(); return; }
  z.innerHTML = '<div class="carte"><div class="carte-titre"><h2>À traiter (' + al.length + ')</h2></div>' +
    al.map(function (a) {
      /* Qui, combien, depuis quand : d'un impayé, c'est tout ce qu'on veut
         savoir sans ouvrir la fiche. Le montant vivait sur l'écran
         Entreprise ; il suit l'alerte ici. */
      var m = C.montant(a.chantier);
      return '<button class="alerte" data-alerte="' + a.chantier.id + '">' +
        '<span class="ic" style="background:' + (COUL_ALERTE[a.type] || '#7A8471') + '"></span>' +
        '<span><b>' + esc(TITRE_ALERTE[a.type] || '') + ' — ' + esc(C.nomChantier(a.chantier)) +
        (m ? ' · ' + eur(m) : '') + '</b>' +
        '<small>' + esc(a.texte) + (a.chantier.donneur ? ' · ' + esc(a.chantier.donneur) : '') + '</small></span></button>';
    }).join('') + '</div>';
  majPastilleEntreprise();
}
function majPastilleEntreprise() {
  var b = $('#b-pastille');
  if (b && A.module === 'chantiers') b.textContent = '';
}

function renderReglagesAlertes() {
  if ($('#r-cot')) $('#r-cot').value = (A.cfg && A.cfg.tauxCotisations != null) ? A.cfg.tauxCotisations : '';
  if ($('#r-imp')) $('#r-imp').value = (A.cfg && A.cfg.tauxImpot != null) ? A.cfg.tauxImpot : '';
  if ($('#r-abv')) $('#r-abv').value = Math.round(((A.cfg && A.cfg.abattementVente != null) ? A.cfg.abattementVente : 0.71) * 100);
  if ($('#r-cfe')) $('#r-cfe').value = (A.cfg && A.cfg.cfeAnnuelle) || '';
  if ($('#r-cfeca')) $('#r-cfeca').value = (A.cfg && A.cfg.cfeCaRef) || '';
  if ($('#r-l100')) $('#r-l100').value = (A.cfg && A.cfg.litres100) || 9;
  if ($('#r-pl')) $('#r-pl').value = (A.cfg && A.cfg.prixLitre) || 1.75;
  if ($('#r-rd')) $('#r-rd').value = (A.cfg && A.cfg.joursRelanceDevis) || 21;
  if ($('#r-rf')) $('#r-rf').value = (A.cfg && A.cfg.joursRelanceFacture) || 45;
  if ($('#r-we')) $('#r-we').checked = !!(A.cfg && A.cfg.weekends);
}
function brancherReglagesAlertes() {
  var majFisc = function () {
    A.cfg.tauxCotisations = FIN.nb($('#r-cot').value) || null;
    A.cfg.tauxImpot = FIN.nb($('#r-imp').value) || null;
    var ab = FIN.nb($('#r-abv').value);
    A.cfg.abattementVente = (ab > 0 && ab < 100) ? ab / 100 : 0.71;
    A.cfg.cfeAnnuelle = FIN.nb($('#r-cfe').value) || null;
    A.cfg.cfeCaRef = FIN.nb($('#r-cfeca').value) || null;
    sauverCfg(); renderRevient(); renderAnalyses();
  };
  ['#r-cot', '#r-imp', '#r-abv', '#r-cfe', '#r-cfeca'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('change', majFisc);
  });
  ['#r-l100', '#r-pl'].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('change', function () {
      var v = C.nb(this.value);
      if (v <= 0) { renderReglagesAlertes(); return; }
      if (id === '#r-l100') A.cfg.litres100 = v; else A.cfg.prixLitre = v;
      sauverCfg(); renderFinances();
    });
  });
  var rd = $('#r-rd');
  if (rd) rd.addEventListener('change', function () {
    var v = C.nb(this.value);
    if (v < 1 || v > 365) { toast('Entre 1 et 365 jours.'); renderReglagesAlertes(); return; }
    A.cfg.joursRelanceDevis = v; sauverCfg(); renderAlertes();
  });
  var rf = $('#r-rf');
  if (rf) rf.addEventListener('change', function () {
    var v = C.nb(this.value);
    if (v < 1 || v > 365) { toast('Entre 1 et 365 jours.'); renderReglagesAlertes(); return; }
    A.cfg.joursRelanceFacture = v; sauverCfg(); renderAlertes();
  });
  var we = $('#r-we');
  if (we) we.addEventListener('change', function () {
    A.cfg.weekends = this.checked; sauverCfg(); renderCalendrier();
  });
}

/* Le passage à certains statuts pose une date : c'est elle qui déclenche
   les relances (devis sans réponse, facture impayée). */
function horodaterStatut(c) {
  var j = C.minuit(Date.now());
  if (c.statut === 'envoye' && !c.dateEnvoi) c.dateEnvoi = j;
  if (c.statut === 'facture' && !c.dateFacture) c.dateFacture = j;
  if (c.statut === 'termine' && !c.dateFin) c.dateFin = j;
  if (c.statut === 'paye' && !c.datePaiement) c.datePaiement = j;
}

