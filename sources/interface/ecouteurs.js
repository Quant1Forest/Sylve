/* =========================================================== IMPRESSION */
function imprimer() {
  if (!A.bord) return;
  var L = E.cuberTout(A.bord, A.cfg);
  var h = enteteHTML() + '<div class="carte"><div class="tab-boite"><table><thead><tr>' +
    COLS.map(function (c) { return '<th class="' + (c[2] === 'g' ? 'g' : 'num') + '">' + esc(c[1]) + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    L.map(function (l) {
      return '<tr>' + td(l.num, 'g') + td(l.bp === true ? '✓' : (l.bp === '' || l.bp == null ? '' : E.fmt(E.toNum(l.bp), 0)), 'num') +
        td(l.ess, 'g') + td(l.qual, 'g') + td(E.fmt(E.toNum(l.lon), 2), 'num') + td(E.fmt(E.toNum(l.dia), 0), 'num') +
        td(l.parc, 'g') + td(l.obs, 'g') + td(l.refl === '' || l.refl == null ? '' : E.fmt(E.toNum(l.refl), 2), 'num') +
        td(l.refn, 'g') + td(E.fmt(l.c.vsur), 'num') + td(E.fmt(l.c.vsous), 'num') + td(E.fmt(l.c.vmarch), 'num') +
        td(l.c.clDiam, 'g') + td(l.c.clMini, 'g') + '</tr>';
    }).join('') + '</tbody></table></div></div>';
  var sv = A.sousVue;
  ['synthese', 'bucheron', 'martelage'].forEach(function (s) {
    A.sousVue = s;
    h += '<div class="saut">' + enteteHTML() +
      ({ synthese: tblSynthese, bucheron: tblBucheron, martelage: tblMartelage }[s])() + '</div>';
  });
  A.sousVue = sv;
  var v = $('#vue-impression');
  v.innerHTML = h; v.classList.add('impression');
  window.print();
  setTimeout(function () { v.classList.remove('impression'); v.innerHTML = ''; }, 800);
}

/* ============================================================== MODALE */
function modale(titre, html) {
  $('#modale-titre').textContent = titre;
  /* On remplace le conteneur au lieu de vider son contenu : les écouteurs
     posés par la fenêtre précédente disparaissent avec lui. Sans cela ils
     s'accumulent et un clic déclenche aussi les fenêtres d'avant — un
     changement de statut finissait par toucher plusieurs chantiers. */
  var vieux = $('#modale-corps');
  var neuf = vieux.cloneNode(false);
  neuf.innerHTML = html;
  vieux.parentNode.replaceChild(neuf, vieux);
  $('#modale').hidden = false;
}
function fermerModale() { $('#modale').hidden = true; $('#modale-corps').innerHTML = ''; }

/* ============================================================ NAVIGATION */
function aller(v) {
  /* Les réglages sont une vue, pas un étage de la navigation : on retient
     l'écran quitté pour pouvoir y redescendre. Sans cette mémoire, le retour
     du bandeau lisait le module courant et remontait au menu du groupe —
     on ressortait des réglages dans « Mon entreprise », jamais là où on
     était. */
  if (v === 'reglages' && A.vue && A.vue !== 'reglages') A.vueAvantReglages = A.vue;
  A.vue = v;
  $$('.onglets button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.vue === v)); });
  $$('main > .vue').forEach(function (s) { s.classList.toggle('actif', s.id === 'vue-' + v); });
  if (v === 'bordereau') renderBordereau();
  if (v === 'syntheses') renderSyntheses();
  if (v === 'fichiers') renderFichiers();
  document.body.classList.toggle('v-reglages', v === 'reglages');
  if (v === 'reglages') { renderReglages(); renderReglagesNav(); }
  if (v === 'saisie') { renderRuban(); renderDernieres(); }
  /* les vues de l'entreprise se recalculent à l'ouverture : leurs données
     changent d'un module à l'autre (un chantier localisé ailleurs, un achat
     de stock, une échéance pointée). */
  if (v === 'carte') renderCarteChantiers();
  if (v === 'calendrier') renderCalendrier();
  if (v === 'carnet') renderCarnet();
  if (v === 'chantier') renderFiche();
  if (v === 'finances') renderFinances();
  if (v === 'depenses') renderDepenses();
  if (v === 'charges') renderCharges();
  if (v === 'stock2') renderStockFournitures();
  if (v === 'analyses') renderAnalyses();
  if (v === 'commandes') renderCommandes();
  if (v === 'revient') renderRevient();
  if (v === 'rendements') renderRendements();
  if (v === 'estimer') renderEstimer();
  if (v === 'carnetv') renderCarnetV();
  if (v === 'echeancesv') renderEcheancesV();
  if (v === 'coutsv') renderCoutsV();
  try { if (window.scrollY || window.pageYOffset) window.scrollTo(0, 0); } catch (e) { }
}

/* ============================================================ ECOUTEURS */
function brancher() {
  $('#onglets').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-vue]');
    if (!b) return;
    if (b.dataset.vue === 'reglages') {
      var m = MODULES[A.module];
      A.secReglages = SEC_DE_MODULE[A.module] || (m && m.groupe === 'entreprise' ? 'ent' : 'general');
    }
    aller(b.dataset.vue);
  });
  $('#a-reglages').addEventListener('click', function () { allerReglages('general'); });
  $('#regl-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-regl]');
    if (b) { A.secReglages = b.dataset.regl; renderReglagesNav(); }
  });
  $('#b-accueil').addEventListener('click', allerAccueil);
  $('#b-retour').addEventListener('click', allerMenuParent);
  brancherRetourTelephone();
  /* Les réglages du module courant, depuis n'importe où : la section
     s'ouvre sur celle qui correspond à la partie où l'on se trouve. */
  $('#b-reglages').addEventListener('click', function () {
    var m = MODULES[A.module];
    allerReglages(SEC_DE_MODULE[A.module] || (m && m.groupe === 'entreprise' ? 'ent' : 'general'));
  });
  $('#b-module').addEventListener('change', function () { allerModule(this.value); });
  $('#b-ctx').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'b-entete2') ouvrirEntete();
    else if (b.id === 'b-aujourdhui') { A.calMois = null; A.calJour = Date.now(); renderCalendrier(); aller('calendrier'); }
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-module]') : null;
    if (!t) return;
    if (t.dataset.module === 'accueil') allerAccueil();
    else if (t.dataset.module === 'entreprise') {
      if (A.vue === 'accueil') empilerCran();
      document.body.classList.add('accueil-ouvert');
      aller('entreprise');
    } else allerModule(t.dataset.module);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-aller]') : null;
    if (t) aller(t.dataset.aller);
  });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-ajlist]') : null;
    if (b) ajouterAListeDepuisChamp(b.dataset.ajlist, b.dataset.ajchamp);
  });
  /* Jamais branché en direct : l'événement du clic arriverait dans « apres »
     et l'application tenterait de l'appeler comme une fonction. */
  $('#b-entete').addEventListener('click', function () { ouvrirEntete(); });
  $('#modale-x').addEventListener('click', fermerModale);
  $('#modale').addEventListener('click', function (e) { if (e.target.id === 'modale') fermerModale(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modale').hidden) fermerModale(); });

  /* --- saisie --- */
  $('#f-ess').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ess]');
    if (b) { selEss = b.dataset.ess; renderChipsEss(); apercu(); return; }
    if (e.target.closest('#ess-autres')) choisirEssence();
  });
  $('#f-qual').addEventListener('click', function (e) {
    var b = e.target.closest('[data-qual]');
    if (b) { selQual = b.dataset.qual; renderChipsQual(); apercu(); }
  });
  $('#f-motifs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-motif]');
    if (b) basculerMotif(b.dataset.motif);
  });
  $('#f-bp').addEventListener('click', function () {
    selBp = !selBp; $('#f-bp').setAttribute('aria-pressed', String(selBp));
    if (!selBp) F.d130.value = '';
  });
  $$('[data-pas]').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = b.dataset.pas.split(':'), i = $('#' + p[0]);
      var v = E.toNum(i.value) + parseFloat(p[1]);
      if (v < 0) v = 0;
      i.value = String(E.roundN(v, 2)).replace('.', ',');
      i.classList.remove('err'); apercu();
    });
  });
  ['f-num', 'f-lon', 'f-dia', 'f-d130', 'f-refl', 'f-refn', 'f-parc', 'f-obs'].forEach(function (id) {
    var el = $('#' + id);
    el.addEventListener('input', function () {
      el.classList.remove('err'); apercu();
      if (id === 'f-num') renderRuban();
      /* Un code tapé à la main doit allumer sa pastille, sinon on ne sait
         plus lequel des deux dit vrai. */
      if (id === 'f-refn') renderChipsMotifs();
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); enregistrer(A.edition === null ? 'grume' : null); }
    });
  });
  $('#f-billon').addEventListener('click', function () { enregistrer('billon'); });
  $('#f-grume').addEventListener('click', function () { enregistrer('grume'); });
  $('#f-valider').addEventListener('click', function () { enregistrer(null); });
  $('#f-annuler').addEventListener('click', function () { viderFormulaire(false); });
  $('#f-defaire').addEventListener('click', function () {
    if (!A.bord || !A.bord.lignes.length) { toast('Rien à défaire.'); return; }
    var l = A.bord.lignes.pop();
    sauver(); majBandeau(); renderDernieres(); renderRuban(); renderBordereau();
    viderFormulaire(false);
    toast('Billon ' + l.num + ' supprimé.');
  });

  /* --- bordereau --- */
  $('#b-filtre').addEventListener('input', function () { A.filtre = this.value; renderBordereau(); });
  $('#t-bordereau').addEventListener('click', function (e) {
    var m = e.target.closest('[data-mod]'), s = e.target.closest('[data-sup]');
    if (m) chargerLigne(+m.dataset.mod);
    if (s) {
      var i = +s.dataset.sup, l = A.bord.lignes[i];
      if (confirm('Supprimer le billon ' + l.num + ' ?')) {
        A.bord.lignes.splice(i, 1);
        sauver(); majBandeau(); renderBordereau(); renderDernieres();
      }
    }
  });
  $('#b-imprimer').addEventListener('click', imprimer);
  $('#b-nuls').addEventListener('click', controlerNuls);

  /* --- synthèses --- */
  $('#s-onglets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-s]'); if (!b) return;
    A.sousVue = b.dataset.s;
    $$('#s-onglets button').forEach(function (x) { x.setAttribute('aria-selected', String(x.dataset.s === A.sousVue)); });
    renderSyntheses();
  });

  /* --- fichiers --- */
  /* L'écran d'arrivée : reprendre, ou créer d'emblée dans le bon type. Créer
     puis valider l'en-tête mène à la saisie — on vient de dire qu'on
     commençait un bordereau, rester sur la liste n'aurait aucun sens. */
  $('#cub-choix').addEventListener('click', function (e) {
    if (e.target.closest('#cub-reprendre')) { aller('saisie'); return; }
    var b = e.target.closest('[data-nouveau]');
    if (!b) return;
    nouveauBordereau({ classement: b.dataset.nouveau });
    ouvrirEntete(function () { aller('saisie'); });
  });
  $('#liste-bordereaux').addEventListener('click', function (e) {
    var o = e.target.closest('[data-ouvrir]'), d = e.target.closest('[data-dupliquer]'), s = e.target.closest('[data-supprimer]');
    if (o) { ouvrirBordereau(o.dataset.ouvrir).then(function () { aller('saisie'); }); }
    if (d) {
      lire('bordcub.b.' + d.dataset.dupliquer, null).then(function (b) {
        if (!b) return;
        var n = nouveauBordereau(b.meta);
        n.meta = Object.assign({}, b.meta); sauver(); appliquerCouleur(); majBandeau(); renderFichiers();
        toast('En-tête dupliqué, bordereau vide.');
      });
    }
    if (s) {
      var id = s.dataset.supprimer;
      var e2 = A.index.filter(function (x) { return x.id === id; })[0];
      if (!confirm('Supprimer « ' + ((e2 && e2.meta && e2.meta.foret) || 'ce bordereau') +
        ' » ?\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
      A.index = A.index.filter(function (x) { return x.id !== id; });
      jeter(id).then(function () { return ecrire('bordcub.index', A.index); }).then(function () {
        if (A.bord && A.bord.id === id) { A.bord = null; Store.del('bordcub.actif'); majBandeau(); }
        renderFichiers(); renderBordereau(); renderSauvegarde();
        toast('Mis à la corbeille.');
      });
    }
  });
  $('#s-recup').addEventListener('click', function (e) {
    var rp = e.target.closest('[data-repecher]'), ins = e.target.closest('[data-instantane]'),
      jd = e.target.closest('[data-jeterdef]');
    if (jd) {
      corbeille().then(function (l) {
        var it = l.filter(function (x) { return x.cle === jd.dataset.jeterdef; })[0];
        if (!it) { renderRecup(); return; }
        var d = CORBEILLE[it.type] || {};
        if (!confirm('Supprimer définitivement « ' + (it.nom || d.nom || 'cet élément') +
          ' » ?\n\nCette fois c’est sans retour : rien ne permettra de le récupérer.')) return;
        Store.del(it.cle).then(function () { renderRecup(); toast('Supprimé définitivement.'); });
      });
      return;
    }
    if (rp) {
      corbeille().then(function (l) {
        var it = l.filter(function (x) { return x.cle === rp.dataset.repecher; })[0];
        if (!it) { renderRecup(); return; }
        var suite = it.type === 'bordereau' ? repecher(it.cle) : repecherObjet(it);
        return suite.then(renderRecup);
      });
      return;
    }
    if (ins) {
      if (!confirm('Restaurer la copie du ' + ins.dataset.instantane.slice(-10) +
        ' ?\n\nLes bordereaux qu’elle contient seront ajoutés à côté des vôtres, rien ne sera écrasé.')) return;
      lire(ins.dataset.instantane, null).then(function (o) { return integrer(o, 'copie du jour'); });
    }
  });
  $('#e-xlsx').addEventListener('click', exportXlsx);
  $('#e-csv').addEventListener('click', exportCsv);
  $('#e-json').addEventListener('click', exportJson);
  /* --- chantiers --- */
  $('#c-nouveau').addEventListener('click', function () { ouvrirEnteteCh(null); });
  $('#c-filtre').addEventListener('change', function () { A.filtreCh = this.value; renderListeChantiers(); });
  $('#c-rech').addEventListener('input', function () { A.rechCh = this.value; renderListeChantiers(); });
  $('#c-tri').addEventListener('change', function () {
    A.triCh = this.value; renderListeChantiers();
  });
  $('#c-sens').addEventListener('click', function () {
    A.triAncien = !A.triAncien; renderListeChantiers();
  });
  $('#liste-chantiers').addEventListener('click', function (e) {
    var o = e.target.closest('[data-chouvrir]'), t = e.target.closest('[data-chtemps]'),
      s = e.target.closest('[data-chstatut]');
    if (o) ouvrirChantier(o.dataset.chouvrir);
    else if (t) ouvrirTemps(t.dataset.chtemps);
    else if (s) ouvrirStatut(s.dataset.chstatut);
  });
  $('#fiche-chantier').addEventListener('change', function (e) {
    if (e.target && e.target.id === 'f-choix' && e.target.value) ouvrirChantier(e.target.value);
  });
  $('#fiche-chantier').addEventListener('click', function (e) {
    var id = A.chOuvert, c = chantier(id);
    var voisin = e.target.closest('[data-voisin]');
    if (voisin) { ouvrirChantier(voisin.dataset.voisin); return; }
    if (e.target.closest('[data-chretour]')) { aller('carnet'); return; }
    if (!c) return;
    /* Chaque bloc de la fiche ouvre son propre formulaire : on ne cherche
       plus le numéro de devis au milieu des essences. */
    if (e.target.closest('#f-identite')) { ouvrirIdentiteCh(id); return; }
    if (e.target.closest('#f-estim')) { ouvrirEstimationCh(id); return; }
    if (e.target.closest('#f-devis')) { ouvrirDevisCh(id); return; }
    if (e.target.closest('#f-facture')) { ouvrirFactureCh(id); return; }
    if (e.target.closest('#f-peuplement')) { ouvrirPeuplementCh(id); return; }
    if (e.target.closest('#f-note')) { ouvrirNoteCh(id); return; }
    if (e.target.closest('#f-jours')) { ouvrirJourneesCh(id); return; }
    if (e.target.closest('#f-statut')) { ouvrirStatut(id); return; }
    var fc = e.target.closest('[data-fcarte]');
    if (fc) { montrerSurCarte(c, fc.dataset.fcarte === 'placer'); return; }
    if (e.target.closest('#f-fichech')) {
      A.fch = id;
      /* Le filtre doit pouvoir montrer ce chantier-là, quel que soit son
         statut : on ouvre donc sur « tous » plutôt que sur les ouverts. */
      A.fchFiltre = 'tous';
      renderFicheChantier();
      allerModule('chantiers', 'fichech');
      return;
    }
    if (e.target.closest('#f-ligne')) { ouvrirLigne(id, null); return; }
    if (e.target.closest('#f-temps')) { ouvrirTemps(id); return; }
    if (e.target.closest('#f-planifier')) {
      A.planifie = id;
      var pl = C.journeesPlacees(c);
      A.calMois = pl.length ? C.minuit(pl[0]) : (c.debut || Date.now());
      renderCalendrier(); allerModule('calendrier', 'calendrier');
      return;
    }
    var lm = e.target.closest('[data-lmod]'), ls = e.target.closest('[data-lsup]'),
      ts = e.target.closest('[data-tsup]');
    if (lm) { ouvrirLigne(id, Number(lm.dataset.lmod)); return; }
    if (ls) {
      if (!confirm('Retirer cette ligne de travaux ?')) return;
      c.lignes.splice(Number(ls.dataset.lsup), 1); c.maj = Date.now();
      sauverChantiers().then(function () { return synchroniserStock(c); }).then(function () {
        renderFiche(); renderCarnet(); renderStockFournitures(); renderAccueil();
      });
      return;
    }
    if (ts) {
      if (!confirm('Retirer cette saisie de temps ?')) return;
      var t3 = (c.temps || [])[Number(ts.dataset.tsup)];
      if (!t3) return;
      if (!retirerSaisie(t3)) { toast('Cette saisie ne se retire pas d’ici.'); return; }
      indexerJournees();
      c.maj = Date.now();
      Promise.all([sauverJournees(), sauverChantiers()]).then(function () {
        renderFiche(); renderCarnet(); renderRendements(); renderCalendrier(); renderAccueil();
      });
      return;
    }
    if (e.target.closest('#f-sup')) {
      if (!confirm('Supprimer « ' + (C.nomChantier(c)) + ' » ?\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
      A.chantiers = A.chantiers.filter(function (x) { return x.id !== id; });
      A.chOuvert = null;
      jeterObjet('chantier', c, C.nomChantier(c),
        C.nomStatut(c.statut, c) + (c.client ? ' · ' + c.client : ''))
        .then(sauverChantiers).then(function () {
          renderCarnet(); renderAccueil(); aller('carnet'); toast('Chantier mis à la corbeille.');
        });
    }
  });
  /* --- estimatif --- */
  $('#estim-form').addEventListener('click', function (e) {
    var rp = e.target.closest('[data-esrend]');
    if (rp) {
      A.estim.rendement = C.nb(rp.dataset.esrend) || null;
      A.estim.repere = rp.dataset.esrepere || null;
      lireEstim(); renderEstimer(); relancerEstimation();
      return;
    }
    if (e.target.closest('#es-go')) { lireEstim(); relancerEstimation(); }
  });
  $('#estim-form').addEventListener('change', function (e) {
    if (e.target.closest('#es-trav')) {
      lireEstim();
      A.estim.rendement = null; A.estim.repere = null; A.estim.resultat = null;
      renderEstimer(); renderEstimResultat();
    }
  });
  $('#estim-resultat').addEventListener('click', function (e) {
    if (!e.target.closest('#es-devis')) return;
    var d3 = A.estim, r = d3.resultat;
    if (!r || !r.jours) return;
    var pu = null;
    if (r.montant && d3.quantite > 0) pu = C.arr(r.montant / d3.quantite, 2);
    var ch = {
      id: uid(), nom: C.nomTravail(d3.travail) + ' — à nommer', statut: 'devis',
      client: '', joursEstimes: r.jours, tva: 20,
      criteres: Object.assign({}, d3.criteres || {}),
      lignes: [{ travail: d3.travail, unite: C.uniteDe(d3.travail), quantite: d3.quantite,
        prix: pu || 0, difficulte: d3.difficulte || null,
        note: pu ? 'estimé à ' + E.fmt(r.rendement, 2) + ' ' + C.courtUnite(r.unite) + '/j' : '' }],
      temps: [], cree: Date.now(), maj: Date.now()
    };
    A.chantiers.push(ch);
    sauverChantiers().then(function () {
      renderCarnet(); renderAccueil();
      ouvrirChantier(ch.id);
      toast('Devis créé — complétez le nom et le donneur d’ordre.');
    });
  });

  /* --- rendements --- */
  $('#rend-tri').addEventListener('change', function () {
    A.triRend = this.value; renderRendements();
  });
  $('#rend-corps').addEventListener('click', function (e) {
    var d4 = e.target.closest('[data-rdetail]'), s4 = e.target.closest('[data-restim]');
    if (d4) ouvrirDetailRendement(d4.dataset.rdetail);
    else if (s4) {
      A.estim = { travail: s4.dataset.restim, quantite: '', rendement: null, repere: null };
      renderEstimer(); renderEstimResultat();
      allerModule('rendements', 'estimer');
    }
  });

  /* --- analyses --- */
  $('#ana-onglets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ana]');
    if (b) { A.vueAna = b.dataset.ana; renderAnalyses(); }
  });
  ['#an-type', '#an-indice', '#an-annee'].forEach(function (s) {
    $(s).addEventListener('change', function () {
      A.periode = { type: $('#an-type').value, annee: Number($('#an-annee').value),
        indice: Number($('#an-indice').value) || 0 };
      renderAnalyses(); renderFinances(); renderDepenses(); renderAccueil();
    });
  });
  $('#ana-corps').addEventListener('click', function (e) {
    if (e.target.closest('#decl-vers')) { ouvrirVersement(null); return; }
    var vm = e.target.closest('[data-versmod]');
    if (vm) ouvrirVersement(vm.dataset.versmod);
  });
  $('#ana-corps').addEventListener('change', function (e) {
    if (e.target.closest('#decl-vl')) {
      /* Cocher propose l'année prochaine : c'est pour l'an prochain qu'il
         compte y passer. Décocher retire l'année, pas les taux. */
      A.cfg.vlDepuis = e.target.checked ? new Date().getFullYear() + 1 : null;
      sauverCfg(); renderAnalyses(); return;
    }
    if (e.target.closest('#decl-vl-an') || e.target.closest('#decl-vl-tp') ||
      e.target.closest('#decl-vl-tv')) {
      var depuis = Math.round(FIN.nb($('#decl-vl-an').value));
      if (depuis > 1900) A.cfg.vlDepuis = depuis;
      A.cfg.vlTauxPresta = $('#decl-vl-tp').value.trim() === '' ? null : FIN.nb($('#decl-vl-tp').value);
      A.cfg.vlTauxVente = $('#decl-vl-tv').value.trim() === '' ? null : FIN.nb($('#decl-vl-tv').value);
      sauverCfg(); renderAnalyses(); return;
    }
    if (e.target.closest('#decl-cot') || e.target.closest('#decl-cap') ||
      e.target.closest('#decl-t1') || e.target.closest('#decl-t2') ||
      e.target.closest('#decl-base')) {
      A.cfg.tauxCotisations = FIN.nb($('#decl-cot').value) || null;
      A.cfg.baseCotisations = $('#decl-base').value === 'brut' ? 'brut' : 'abattu';
      A.cfg.impotCapacite = $('#decl-cap').value.trim() === '' ? null : FIN.nb($('#decl-cap').value);
      A.cfg.impotTaux1 = $('#decl-t1').value.trim() === '' ? null : FIN.nb($('#decl-t1').value);
      A.cfg.impotTaux2 = $('#decl-t2').value.trim() === '' ? null : FIN.nb($('#decl-t2').value);
      sauverCfg(); renderAnalyses(); return;
    }
    if (!e.target.closest('#sim-cot') && !e.target.closest('#sim-imp') && !e.target.closest('#sim-base')) return;
    A.cfg.tauxCotisations = FIN.nb($('#sim-cot').value) || null;
    A.cfg.tauxImpot = FIN.nb($('#sim-imp').value) || null;
    A.cfg.baseCotisations = $('#sim-base').value === 'brut' ? 'brut' : 'abattu';
    A.cfg.baseImpot = A.cfg.baseCotisations;
    sauverCfg(); renderAnalyses();
  });

  /* --- fiche de chantier --- */
  $('#fch-corps').addEventListener('change', function (e) {
    if (e.target.id === 'fch-filtre') {
      A.fchFiltre = e.target.value; renderFicheChantier(); return;
    }
    if (e.target.id === 'fch-ch') {
      /* On enregistre avant de changer de chantier : sinon ce qui vient
         d'être coché part avec l'écran. */
      var suivant = e.target.value;
      Promise.resolve(chantierFiche() ? enregistrerFiche() : null).then(function () {
        A.fch = suivant || null; renderFicheChantier();
      });
      return;
    }
    if (chantierFiche()) enregistrerFiche();
  });
  $('#fch-corps').addEventListener('click', function (e) {
    var r = e.target.closest('[data-fchr]');
    if (r) {
      r.setAttribute('aria-pressed', r.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      enregistrerFiche();
      return;
    }
    var res = e.target.closest('[data-fchres]');
    if (res) {
      $$('#fch-reseaux [data-fchres]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === res));
      });
      enregistrerFiche();
      return;
    }
    if (e.target.closest('#fch-reprendre')) {
      var c2 = chantierFiche(), jum = memeForet(c2);
      if (!c2 || !jum) return;
      var src = jum.fiche || {};
      /* On ne reprend que ce qui décrit le lieu : les risques, leurs
         consignes et l'accès. Ni la période, ni le point de rencontre —
         celui-là dépend du chantier, pas de la forêt. */
      c2.fiche = c2.fiche || {};
      c2.fiche.risques = (src.risques || []).slice();
      c2.fiche.consignes = JSON.parse(JSON.stringify(src.consignes || {}));
      c2.fiche.proportion = src.proportion || '';
      if (!c2.fiche.acces) c2.fiche.acces = src.acces || '';
      if (!c2.fiche.reseau) c2.fiche.reseau = src.reseau || '';
      if (!c2.fiche.pointReseau) c2.fiche.pointReseau = src.pointReseau || '';
      c2.maj = Date.now();
      sauverChantiers().then(function () {
        renderFicheChantier();
        toast('Risques repris de « ' + (jum.nom || 'chantier') + ' ».');
      });
      return;
    }
    if (e.target.closest('#fch-identite')) {
      var c0 = chantierFiche();
      if (c0) { enregistrerFiche(); ouvrirIdentiteCh(c0.id); }
      return;
    }
    /* Le point de rencontre se prend sur place : c'est le geste le plus sûr,
       et le seul qui marche sans réseau. Le même relevé que sur le chantier. */
    var ici = e.target.closest('#fch-ici');
    if (ici) {
      releverPosition(ici, function (pt) {
        $('#fch-gps').value = C.arr(pt.lat, 5) + ', ' + C.arr(pt.lon, 5);
        enregistrerFiche('Point de rencontre enregistré.');
      });
      return;
    }
    if (e.target.closest('#fch-voir')) {
      enregistrerFiche().then(function (c1) { apercuFiche(c1); });
      return;
    }
    if (e.target.closest('#fch-imprimer')) {
      enregistrerFiche().then(function () { imprimerFiche(); });
    }
  });

  /* --- achats à venir --- */
  $('#ach-liste').addEventListener('click', function (e) {
    if (e.target.closest('#ach-plus')) { ouvrirAchat(null); return; }
    var coche = e.target.closest('[data-achfait]');
    if (coche) {
      var a = achat(coche.dataset.achfait); if (!a) return;
      /* Cocher ne supprime rien : la ligne glisse à la suite, et se décoche
         d'un second appui — un achat repoussé n'est pas un achat perdu. */
      a.fait = !a.fait;
      a.dateFait = a.fait ? Date.now() : null;
      a.maj = Date.now();
      sauverAchats().then(function () {
        renderAchats(); renderBudgetAchats(); renderEntreprise();
        toast(a.fait ? 'Acheté — la ligne passe à la suite.' : 'Remis dans la liste.');
      });
      return;
    }
    var mod = e.target.closest('[data-achmod]');
    if (mod) ouvrirAchat(mod.dataset.achmod);
  });

  /* --- véhicule --- */
  $('#veh-carnet').addEventListener('click', function (e) {
    if (e.target.closest('#vh-infos')) { ouvrirInfosVehicule(); return; }
    if (e.target.closest('#vh-releve')) { ouvrirReleveV(); return; }
    if (e.target.closest('#vh-plus')) { ouvrirInterventionV(null); return; }
    var m2 = e.target.closest('[data-vhmod]');
    if (m2) ouvrirInterventionV(m2.dataset.vhmod);
  });
  $('#veh-echeances').addEventListener('click', function (e) {
    if (e.target.closest('#vh-posteplus')) { ouvrirPosteV(null); return; }
    var p2 = e.target.closest('[data-vhposte]');
    if (p2) ouvrirPosteV(p2.dataset.vhposte);
  });

  /* --- stock : inventaire --- */
  $('#vue-stock2').addEventListener('click', function (e) {
    var f = e.target.closest('[data-artfiche]');
    if (f) { ouvrirFicheArticle(f.dataset.artfiche); return; }
    else if (e.target.closest('#art-importer') || e.target.closest('#stock-imp-vide')) ouvrirImportStock();
  });

  /* --- stock : entrées, sorties, pertes --- */
  $('#mvt-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mvt]');
    if (b) { A.mvt = b.dataset.mvt; renderCommandes(); }
  });
  $('#cmd-nouvelle').addEventListener('click', function () { nouveauMouvement(); });
  $('#liste-commandes').addEventListener('click', function (e) {
    var m = e.target.closest('[data-cmdmod]'), r = e.target.closest('[data-cmdrecu]'),
      sm = e.target.closest('[data-srtmod]');
    if (m) ouvrirCommande(m.dataset.cmdmod);
    else if (sm) ouvrirSortieStock(sm.dataset.srtmod);
    else if (e.target.closest('#cmd-vide')) nouveauMouvement();
    else if (r) {
      var c = commande(r.dataset.cmdrecu); if (!c) return;
      c.statut = 'recu'; c.maj = Date.now();
      /* Sans date de livraison saisie, c'est aujourd'hui : on ne coche pas
         « reçue » pour une commande qu'on n'a pas dans les mains. On le dit,
         sinon la date s'inscrit sans qu'il le sache. */
      var datee = !c.dateLiv;
      if (!c.dateLiv) c.dateLiv = C.minuit(Date.now());
      sauverCommandes().then(function () {
        majStock();
        toast(datee
          ? 'Commande reçue, livraison datée du ' + dateCourte(c.dateLiv) + '.'
          : 'Commande reçue — livrée le ' + dateCourte(c.dateLiv) + '.');
      });
    }
  });

  /* --- stock : catalogue et fournisseurs --- */
  $('#rf-add').addEventListener('click', function () { ouvrirFournisseur(null); });
  $('#rp-add').addEventListener('click', function () { ouvrirArticle(null); });
  $('#rl-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-liste]');
    /* Changer d'onglet referme : on repart du haut d'une liste courte. */
    if (b) { A.listeReglee = b.dataset.liste; listeDepliee = false; renderListesReglages(); }
  });
  $('#rl-add').addEventListener('click', function () {
    if (LISTES[A.listeReglee] && LISTES[A.listeReglee].objets) ouvrirTravailRegle(null);
    else ouvrirEntreeListe(null);
  });
  $('#rl-liste').addEventListener('click', function (e) {
    if (e.target.closest('#rl-plus')) { listeDepliee = !listeDepliee; renderListesReglages(); return; }
    var b = e.target.closest('[data-lmodif]');
    if (!b) return;
    if (LISTES[A.listeReglee] && LISTES[A.listeReglee].objets) ouvrirTravailRegle(b.dataset.lmodif);
    else ouvrirEntreeListe(b.dataset.lmodif);
  });
  $('#regl-corps').addEventListener('click', function (e) {
    var f = e.target.closest('[data-fourmod]'), a = e.target.closest('[data-artmod]');
    if (f) ouvrirFournisseur(f.dataset.fourmod);
    else if (a) ouvrirArticle(a.dataset.artmod);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-versregl]') : null;
    if (b) allerReglages(b.dataset.versregl);
  });

  /* --- prix de revient --- */
  $('#rev-resultat').addEventListener('change', function (e) {
    if (e.target.closest('#an-rev')) {
      A.revient.annee = Number($('#an-rev').value); renderRevient();
    }
  });
  $('#rev-resultat').addEventListener('click', function (e) {
    var m = e.target.closest('[data-marge]');
    if (m) { A.revient.marge = m.dataset.marge; renderRevient(); return; }
    var fo = e.target.closest('[data-anforme]');
    if (fo) { A.revient.forme = fo.dataset.anforme; renderRevient(); }
    /* Pas de branche pour le sélecteur d'année ici : un clic dessus, c'est
       l'ouverture de la liste, pas un choix. Redessiner à ce moment-là
       refermait la liste avant qu'il ait pu choisir. Seul « change » compte. */
  });
  $('#rev-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rev]');
    if (b) { A.revient.onglet = b.dataset.rev; renderRevient(); }
  });
  $('#rev-hyp').addEventListener('click', ouvrirHypotheses);
  $('#rev-form').addEventListener('change', function (e) {
    if (e.target.closest('#rev-art')) {
      /* Changer de produit repart de son dosage à lui, pas de celui d'avant. */
      A.revient.article = $('#rev-art').value; A.revient.prix = ''; A.revient.dose = null;
      renderRevient();
    }
    else if (e.target.closest('#rev-dose')) {
      A.revient.dose = ST.nb($('#rev-dose').value) || null;
      renderRevient();
    }
    else if (e.target.closest('#rev-base')) { A.revient.base = $('#rev-base').value; renderRevient(); }
    else if (e.target.closest('#rev-mode')) { A.revient.mode = $('#rev-mode').value; renderRevient(); }
    else if (e.target.closest('#rev-par')) { A.revient.par = $('#rev-par').value; A.revient.prix = ''; renderRevient(); }
  });
  $('#rev-form').addEventListener('input', function (e) {
    if (e.target.closest('#rev-prix')) { A.revient.prix = $('#rev-prix').value; renderRevientResultat(); }

  });

  /* --- charges fixes --- */
  $('#chg-nouvelle').addEventListener('click', function () { ouvrirCharge(null); });
  $('#charges-resume').addEventListener('click', function (e) {
    var m = e.target.closest('[data-chgmod]'), s = e.target.closest('[data-chgsup]');
    var mois = e.target.closest('[data-chgmois]');
    if (m) ouvrirCharge(m.dataset.chgmod);
    else if (mois) {
      /* On réécrit la seule phrase du détail : refaire tout l'écran ferait
         sauter le graphique sous le doigt. */
      var z = $('#chg-mois-detail');
      if (z) z.innerHTML = detailMoisCharges(
        chargesParMois(A.charges, new Date().getFullYear()), Number(mois.dataset.chgmois));
    }
    else if (s) {
      var c = charge(s.dataset.chgsup);
      if (!c || !confirm('Supprimer « ' + (c.libelle || '') + ' » ?\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
      A.charges = A.charges.filter(function (x) { return x.id !== c.id; });
      jeterObjet('charge', c, c.libelle || 'Charge', eur(FIN.nb(c.montant)))
        .then(sauverCharges).then(synchroniserDepensesCharges).then(function () {
          renderCharges(); renderDepenses(); renderFinances(); renderAccueil();
          toast('Charge mise à la corbeille.');
        });
    }
  });

  /* --- carte des chantiers --- */
  $('#carte-ici').addEventListener('click', function () {
    releverPosition(this, function (p) {
      A.ici = p;
      var m = LB.vers(p.lat, p.lon), v = cadreCarte();
      v.cx = m.x; v.cy = m.y;
      /* Assez serré pour reconnaître un chemin : deux cents mètres de large
         au sol. Y aller sans changer d'échelle laisserait un point bleu
         perdu au milieu d'un département. */
      var vise = 3 / LB.facteurSol(m.y);
      if (v.m > vise) v.m = vise;
      renderCarteChantiers();
    });
  });
  $('#carte-svg').addEventListener('click', function (e) {
    var g = e.target.closest('[data-cartept]');
    if (g && !A.cartePose) { ouvrirChantier(g.dataset.cartept); return; }
    if (A.cartePose) poserSurCarte(e);
  });
  $('#carte-plus').addEventListener('click', function () { zoomerCarte(0.6); });
  $('#carte-moins').addEventListener('click', function () { zoomerCarte(1 / 0.6); });
  $('#carte-tout').addEventListener('click', function () {
    A.carte = null; renderCarteChantiers();
  });
  $('#carte-poser').addEventListener('click', ouvrirPoseCarte);
  $('#carte-chercher').addEventListener('click', function () {
    chercherCommune($('#carte-rech').value);
  });
  $('#carte-rech').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    chercherCommune(this.value);
  });
  $('#carte-resultats').addEventListener('click', function (e) {
    var b = e.target.closest('[data-commune]'); if (!b) return;
    allerCommune(communesTrouvees[Number(b.dataset.commune)]);
  });
  $('#carte-fonds').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fondcarte]');
    if (!b) return;
    A.cfg.fondCarte = b.dataset.fondcarte;
    sauverCfg();
    renderCarteChantiers();
  });
  brancherGestesCarte();
  $('#carte-liste').addEventListener('click', function (e) {
    var b = e.target.closest('[data-carteouvrir]');
    if (b) ouvrirChantier(b.dataset.carteouvrir);
  });

  /* --- import CSV --- */
  $('#imp-modele').addEventListener('click', telechargerModeleCsv);
  $('#imp-fichier').addEventListener('change', function () {
    if (this.files && this.files[0]) importerCsv(this.files[0]);
    this.value = '';
  });
  $('#imp-resultat').addEventListener('click', function (e) {
    if (e.target.closest('#imp-ok')) validerImport();
    else if (e.target.closest('#imp-annuler')) { A.imp = null; renderImportResultat(); }
  });

  /* --- calendrier --- */
  $('#cal-prec').addEventListener('click', function () {
    var d = new Date(A.calMois); A.calMois = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    renderCalendrier();
  });
  $('#cal-suiv').addEventListener('click', function () {
    var d = new Date(A.calMois); A.calMois = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    renderCalendrier();
  });
  $('#cal-auj').addEventListener('click', function () {
    A.calMois = null; A.calJour = Date.now(); renderCalendrier();
  });
  $('#cal-grille').addEventListener('click', function (e) {
    var b = e.target.closest('[data-jour]'); if (!b) return;
    var ts = Number(b.dataset.jour);
    if (A.planifie) {
      var c = chantier(A.planifie);
      if (c) {
        C.placerJour(c, ts); c.maj = Date.now();
        sauverChantiers().then(function () { renderCalendrier(); renderCarnet(); renderAccueil(); });
      }
      return;
    }
    /* « Cliquer sur n'importe quel jour doit ouvrir une fiche jour. » La
       saisie ne se faisait que depuis la fiche du chantier. */
    A.calJour = ts;
    renderCalendrier();
    ouvrirFicheJour(ts);
  });
  $('#cal-planif').addEventListener('click', function (e) {
    if (e.target.closest('#cal-planif-fin')) {
      var c = chantier(A.planifie);
      A.planifie = null; renderCalendrier();
      if (c) toast(E.fmt(C.totalPlace(c), 1).replace(',0', '') + ' journées placées.');
      /* On repart de la fiche : y rester après avoir posé ses jours obligeait
         à refaire tout le chemin pour retrouver son chantier. */
      if (c) ouvrirChantier(c.id);
    }
  });
  $('#cal-aplanifier').addEventListener('click', function (e) {
    var p = e.target.closest('[data-aplacer]'), es = e.target.closest('[data-aestimer]');
    if (es) { ouvrirChantier(es.dataset.aestimer); return; }
    if (!p) return;
    var c = chantier(p.dataset.aplacer); if (!c) return;
    A.planifie = c.id;
    var pl = C.journeesPlacees(c);
    A.calMois = pl.length ? C.minuit(pl[pl.length - 1].d) : Date.now();
    renderCalendrier();
  });
  $('#cal-trancher').addEventListener('click', function () {
    var l = C.joursAResoudre(A.chantiers, A.cfg, absences(), Date.now());
    if (l.length) ouvrirResolutionJour(l[0].d);
  });
  $('#cal-saisir').addEventListener('click', function () {
    ouvrirFicheJour(A.calJour || Date.now());
  });
  $('#cal-detail').addEventListener('click', function (e) {
    var o = e.target.closest('[data-caljour-ouvrir]'), s = e.target.closest('[data-caljour-sup]');
    if (o) { ouvrirChantier(o.dataset.caljourOuvrir); return; }
    if (s) {
      var k = s.dataset.caljourSup.split('_'), c = chantier(k[0]);
      if (!c || !confirm('Retirer cette saisie de temps ?')) return;
      c.temps = c.temps.filter(function (t) { return t.date !== Number(k[1]); });
      c.maj = Date.now();
      sauverChantiers().then(function () {
        renderCalendrier(); renderCarnet(); renderRendements(); renderAccueil();
      });
    }
  });

  /* --- alertes --- */
  $('#bandeau-alertes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-alerte]');
    if (b) ouvrirChantier(b.dataset.alerte);
  });
  /* Le rappel d'échéances mène à la page des charges, pas à un chantier —
     sauf si c'est la croix qu'on vise. */
  $('#a-echeances').addEventListener('click', function (e) {
    if (e.target.closest('#a-ech-fermer')) {
      echeancesChassees = true;
      renderNudgeEcheances();
      return;
    }
    if (e.target.closest('[data-echeance]')) allerModule('finances', 'charges');
  });
  $('#a-journees').addEventListener('click', function (e) {
    if (e.target.closest('#a-journees-fermer')) {
      journeesChassees = true;
      renderNudgeJournees();
      return;
    }
    if (!e.target.closest('[data-journeenudge]')) return;
    /* On ouvre la plus ancienne, sa date déjà posée. Trois issues, jamais
       une seule : y avoir travaillé, le déplacer, ou ne pas y avoir été. */
    var l = C.joursAResoudre(A.chantiers, A.cfg, absences(), Date.now());
    if (!l.length) return;
    ouvrirResolutionJour(l[0].d);
  });
  $('#a-devis').addEventListener('click', function (e) {
    if (e.target.closest('#a-devis-fermer')) {
      devisChasses = true;
      renderNudgeDevis();
      return;
    }
    if (!e.target.closest('[data-devisnudge]')) return;
    /* Un seul devis en attente : on ouvre sa fiche, c'est là qu'on relance.
       Plusieurs : le carnet filtré sur les devis envoyés, pour les voir tous. */
    var al = C.alertes(A.chantiers, A.cfg, Date.now())
      .filter(function (a) { return a.type === 'devis'; });
    if (al.length === 1) { ouvrirChantier(al[0].chantier.id); return; }
    A.filtreCh = 'envoye'; A.rechCh = '';
    if ($('#c-rech')) $('#c-rech').value = '';
    renderFiltreChantiers(); renderListeChantiers();
    allerModule('chantiers', 'carnet');
  });
  $('#ent-notes').addEventListener('click', function (e) {
    var sup = e.target.closest('[data-notesup]');
    if (sup) {
      var n = noteParId(sup.dataset.notesup);
      if (n && !confirm('Supprimer « ' + (n.titre || 'cette note') + ' » ?\n\nElle restera récupérable ' +
        B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
      effacerNote(sup.dataset.notesup);
      return;
    }
    var si = e.target.closest('[data-nt-supitem]');
    if (si) {
      var carte = si.closest('[data-note-id]');
      majNote(carte.dataset.noteId, function (nn) {
        nn.items = nn.items.filter(function (x) { return x.id !== si.dataset.ntSupitem; });
      });
      return;
    }
    var note = e.target.closest('[data-note]');
    if (note) { ouvrirNote(note.dataset.note); return; }
    if (e.target.closest('#ent-note-plus')) ouvrirNote(null);
  });
  $('#ent-notes').addEventListener('change', function (e) {
    var c = e.target.closest('[data-nt-coche]'); if (!c) return;
    var carte = c.closest('[data-note-id]');
    majNote(carte.dataset.noteId, function (nn) {
      nn.items.forEach(function (x) { if (x.id === c.dataset.ntCoche) x.fait = c.checked; });
    });
  });
  /* Entrée crée l'élément et garde le champ ouvert pour le suivant. */
  $('#ent-notes').addEventListener('keydown', function (e) {
    var c = e.target.closest ? e.target.closest('[data-nt-ajout]') : null;
    if (!c || e.key !== 'Enter') return;
    e.preventDefault();
    ajouterItemNote(c);
  });
  /* Chaque bulle du bilan mène à la liste qui la détaille : le chiffre seul
     ne sert à rien si l'on doit ensuite chercher de quoi il parle. */
  $('#ent-bilan').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bulle]'); if (!b) return;
    var ou = b.dataset.bulle;
    if (ou === 'calendrier') { allerModule('calendrier', 'calendrier'); return; }
    if (ou === 'finances') { allerModule('finances', 'finances'); return; }
    if (ou === 'depenses') { allerModule('finances', 'depenses'); return; }
    /* « Les bulles qui mènent droit à la fiche » : une liste d'un seul
       chantier, c'est un appui de plus pour rien. La bulle compte par statut,
       le raccourci aussi. */
    var seuls = A.chantiers.filter(function (c) { return c.statut === ou; });
    if (seuls.length === 1) { ouvrirChantier(seuls[0].id); return; }
    A.filtreCh = ou; A.rechCh = '';
    if ($('#c-rech')) $('#c-rech').value = '';
    renderFiltreChantiers(); renderListeChantiers();
    allerModule('chantiers', 'carnet');
  });
  brancherReglagesAlertes();
  brancherReglagesMarque();
  $('#c-notes-maj').addEventListener('click', function (e) {
    if (e.target.closest('#notes-plus')) {
      notesDepliees = !notesDepliees;
      renderNotesMaj();
      return;
    }
    var b = e.target.closest('[data-notevue]'); if (!b) return;
    var v = b.dataset.notevue;
    if (v === 'reglages') { allerReglages('general'); return; }
    allerModule(moduleDeVue(v), v);
  });

  /* --- finances --- */
  ['#fi-type', '#fi-indice', '#fi-annee'].forEach(function (s) {
    $(s).addEventListener('change', function () {
      A.periode = { type: $('#fi-type').value, annee: Number($('#fi-annee').value),
        indice: Number($('#fi-indice').value) || 0 };
      renderFinances(); renderDepenses();
    });
  });

  /* --- dépenses --- */
  $('#dep-nouvelle').addEventListener('click', function () { ouvrirDepense(null); });
  $('#dep-filtre').addEventListener('change', function () { A.filtreDep = this.value; renderDepenses(); });
  $('#liste-depenses').addEventListener('click', function (e) {
    var m = e.target.closest('[data-depmod]'), s = e.target.closest('[data-depsup]');
    if (m) {
      /* Elle découle d'une charge fixe : c'est la charge qu'on ouvre, sinon la
         correction serait effacée à la prochaine synchronisation. */
      var d0 = depense(m.dataset.depmod);
      if (d0 && d0.auto && d0.charge) {
        allerModule('finances', 'charges');
        ouvrirCharge(d0.charge);
        return;
      }
      ouvrirDepense(m.dataset.depmod); return;
    }
    if (s) {
      var d = depense(s.dataset.depsup);
      if (!d || !confirm('Supprimer cette dépense de ' + eur(FIN.nb(d.ttc)) + ' ?\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
      A.depenses = A.depenses.filter(function (x) { return x.id !== d.id; });
      jeterObjet('depense', d, (d.fournisseur || 'Dépense'), eur(FIN.nb(d.ttc)))
        .then(sauverDepenses).then(function () {
          renderDepenses(); renderFinances(); renderAccueil(); toast('Dépense mise à la corbeille.');
        });
    }
  });

  brancherReglagesCh();
  brancherReglagesDemarrage();

  /* --- bois de chauffage --- */
  ['#p-nouvelle', '#p-nouvelle2'].forEach(function (sel) {
    $(sel).addEventListener('click', function () { ouvrirPile(null); });
  });
  $('#liste-piles').addEventListener('change', function (e) {
    var s = e.target.closest('#sel-vuepile');
    if (s) { A.vuePiles = s.value; renderPiles(); }
  });
  $('#liste-piles').addEventListener('click', function (e) {
    var m = e.target.closest('[data-mesure]'), o = e.target.closest('[data-pile]'),
      s2 = e.target.closest('[data-pilesup]'), x = e.target.closest('[data-sortie]'),
      pv = e.target.closest('[data-photovue]'), ms = e.target.closest('[data-mvtsup]');
    if (pv) { ouvrirPhotos(pv.dataset.photovue); return; }
    if (ms) { annulerSortie(ms.dataset.mvtsup); return; }
    if (x) ouvrirSortiePile(x.dataset.sortie);
    else if (m) ouvrirMesure(m.dataset.mesure);
    else if (o) ouvrirPile(o.dataset.pile);
    else if (s2) {
      var p = pile(s2.dataset.pilesup);
      if (!p || !confirm('Supprimer la pile « ' + (p.nom || '') + ' » ?\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans Réglages ▸ Général ▸ Sauvegarde ▸ Corbeille.')) return;
      A.piles = A.piles.filter(function (x) { return x.id !== p.id; });
      jeterObjet('pile', p, p.nom || 'Pile', E.fmt(H.restant(p), 2) + ' st')
        .then(sauverPiles).then(function () {
          renderPiles(); renderStock(); renderLieux(); toast('Pile mise à la corbeille.');
        });
    }
  });
  $('#l-relever').addEventListener('click', function () {
    releverPosition(this, function (p) {
      A.ici = p;
      $('#l-etat').textContent = 'Vous êtes ici : ' + G.fmtCoord(p) + ' ' + G.fmtPrecision(p) +
        '. Points classés du plus proche au plus lointain.';
      renderLieux(); renderPiles();
    });
  });
  brancherReglagesBois();
  $('#b-csv').addEventListener('click', exportStockCsv);
  $('#b-xlsx').addEventListener('click', exportStockXlsx);
  $('#s-tout').addEventListener('click', sauvegarderTout);
  $('#s-restaurer').addEventListener('click', importJson);
  $('#a-journee').addEventListener('click', function (e) {
    if (e.target.closest('#a-jour')) ouvrirJournee(null);
  });
  $('#a-sauvegarde').addEventListener('click', function (e) {
    if (!e.target.closest('#a-sauver')) return;
    allerReglages('general');
    var c = $('#c-sauvegarde');
    if (c) c.scrollIntoView({ block: 'center' });
  });
  $('#s-recuperer').addEventListener('click', function () {
    var z = $('#s-recup');
    z.hidden = !z.hidden;
    this.textContent = z.hidden ? 'Corbeille…' : 'Masquer';
    if (!z.hidden) renderRecup();
  });
  $('#i-coller').addEventListener('click', function () { if (!A.bord) nouveauBordereau(); ouvrirColler(); });

  /* --- réglages --- */
  $('#r-mode').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]'); if (!b) return;
    A.cfg.mode = b.dataset.mode; sauverCfg();
    renderReglages(); majBandeau(); renderBordereau(); renderSyntheses(); apercu();
    toast('Mode ' + (A.cfg.mode === 'corrige' ? 'corrigé' : 'historique') + ' appliqué.');
  });
  [['r-slon', 'seuilLongueur'], ['r-ssap', 'seuilDiamSAP'], ['r-sepc', 'seuilDiamEPC']].forEach(function (p) {
    $('#' + p[0]).addEventListener('change', function () {
      A.cfg[p[1]] = E.toNum(this.value); sauverCfg(); renderReglages(); apercu();
    });
  });
  $('#t-essences').addEventListener('click', function (e) {
    var f = e.target.closest('[data-ess-fav]'), s = e.target.closest('[data-ess-sup]');
    if (f) {
      var c = A.cfg.essences[+f.dataset.essFav].code;
      A.cfg.favoris = A.cfg.favoris || [];
      var k = A.cfg.favoris.indexOf(c);
      if (k >= 0) A.cfg.favoris.splice(k, 1); else A.cfg.favoris.push(c);
      sauverCfg(); renderReglages(); renderChipsEss();
    }
    if (s) {
      var i = +s.dataset.essSup, code = A.cfg.essences[i].code;
      if (A.bord && A.bord.lignes.some(function (l) { return l.ess === code; })) { toast('Essence utilisée dans ce bordereau.'); return; }
      A.cfg.essences.splice(i, 1); sauverCfg(); renderReglages(); renderChipsEss();
    }
  });
  $('#t-essences').addEventListener('change', function (e) {
    var n = e.target.dataset.essNom, t = e.target.dataset.essTx;
    if (n !== undefined) { A.cfg.essences[+n].nom = e.target.value; sauverCfg(); }
    if (t !== undefined) {
      A.cfg.essences[+t].tx = E.toNum(e.target.value) / 100; sauverCfg();
      majBandeau(); renderBordereau(); renderSyntheses(); apercu();
    }
  });
  $('#r-ess-add').addEventListener('click', function () {
    modale('Nouvelle essence', ch('ne-code', 'Code (3 caractères)', '') + ch('ne-nom', 'Nom', '') +
      ch('ne-tx', 'Taux d’écorce (%)', '0') +
      '<div class="btn-rang"><button class="btn primaire" id="ne-ok">Ajouter</button></div>');
    $('#ne-ok').addEventListener('click', function () {
      var c = $('#ne-code').value.trim().toUpperCase();
      if (!c) { toast('Code obligatoire.'); return; }
      if (A.cfg.essences.some(function (x) { return x.code === c; })) { toast('Ce code existe déjà.'); return; }
      A.cfg.essences.push({ code: c, nom: $('#ne-nom').value.trim() || c, tx: E.toNum($('#ne-tx').value) / 100 });
      sauverCfg(); renderReglages(); renderChipsEss(); fermerModale();
    });
  });
  $('#r-cl-onglets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rcl]'); if (!b) return;
    A.classementRegl = b.dataset.rcl; renderReglages();
  });
  $('#t-qualites').addEventListener('click', function (e) {
    var s = e.target.closest('[data-q-sup]'); if (!s) return;
    var l = A.cfg.qualites[A.classementRegl], code = l[+s.dataset.qSup].code;
    if (A.bord && A.bord.meta.classement === A.classementRegl && A.bord.lignes.some(function (x) { return x.qual === code; })) {
      toast('Qualité utilisée dans ce bordereau.'); return;
    }
    l.splice(+s.dataset.qSup, 1); sauverCfg(); renderReglages(); renderChipsQual();
  });
  $('#t-qualites').addEventListener('change', function (e) {
    var n = e.target.dataset.qNom;
    if (n !== undefined) { A.cfg.qualites[A.classementRegl][+n].nom = e.target.value; sauverCfg(); renderChipsQual(); }
  });
  $('#r-qual-add').addEventListener('click', function () {
    modale('Nouvelle qualité — ' + E.nomClassement(A.classementRegl), ch('nq-code', 'Code', '') + ch('nq-nom', 'Libellé', '') +
      '<div class="btn-rang"><button class="btn primaire" id="nq-ok">Ajouter</button></div>');
    $('#nq-ok').addEventListener('click', function () {
      var c = $('#nq-code').value.trim().toUpperCase();
      if (!c) { toast('Code obligatoire.'); return; }
      A.cfg.qualites[A.classementRegl].push({ code: c, nom: $('#nq-nom').value.trim() || c });
      sauverCfg(); renderReglages(); renderChipsQual(); fermerModale();
    });
  });
  $('#r-reset-cfg').addEventListener('click', function () {
    /* Ce bouton remettait A.cfg tout entier à ses valeurs d'usine — donc aussi
       le prix de journée, les taux fiscaux, les prestations renommées, et les
       marqueurs indiquant que les données ont déjà été reprises. Au
       redémarrage suivant la reprise repartait et dupliquait tout. On ne
       touche désormais qu'aux listes de cubage, nommément. */
    if (!confirm('Rétablir les essences, les qualités et les seuils de cubage ?\n\n' +
      'Le reste — bordereaux, chantiers, stock, prix de journée, taux — ne bouge pas.')) return;
    if (!confirm('Confirmer : vos essences et qualités personnalisées seront perdues.')) return;
    var d = E.configDefaut();
    ['essences', 'qualites', 'seuilDiamSAP', 'seuilDiamEPC', 'seuilLongueur', 'favoris']
      .forEach(function (k) { A.cfg[k] = d[k]; });
    sauverCfg(); renderReglages(); renderChipsEss(); renderChipsQual();
    toast('Listes de cubage rétablies.');
  });
}
function choisirEssence() {
  modale('Choisir une essence',
    '<input type="search" id="ce-f" placeholder="Rechercher…" autocomplete="off"><div id="ce-l" style="margin-top:11px"></div>');
  var rend = function (f) {
    f = (f || '').toLowerCase();
    $('#ce-l').innerHTML = A.cfg.essences.filter(function (e) {
      return !f || e.code.toLowerCase().indexOf(f) >= 0 || e.nom.toLowerCase().indexOf(f) >= 0;
    }).map(function (e) {
      return '<button class="liste-item" data-ce="' + esc(e.code) + '"><div class="li-c"><b>' + esc(e.code) +
        ' — ' + esc(e.nom) + '</b><small>écorce ' + E.fmt(e.tx * 100, 0) + ' %</small></div></button>';
    }).join('') || '<p class="muted">Aucune essence.</p>';
  };
  rend('');
  $('#ce-f').addEventListener('input', function () { rend(this.value); });
  $('#ce-l').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ce]'); if (!b) return;
    selEss = b.dataset.ce;
    if (essAffichees.indexOf(selEss) < 0) essAffichees.push(selEss);
    renderChipsEss(); apercu(); fermerModale();
  });
  setTimeout(function () { $('#ce-f').focus(); }, 60);
}
function controlerNuls() {
  if (!A.bord || !A.bord.lignes.length) { toast('Aucun billon à contrôler.'); return; }
  var r = E.analyserNuls(A.bord, A.cfg);
  var h = '<p class="muted" style="margin-top:0;font-size:13px">Seuils : longueur &lt; <b>' + E.fmt(r.seuils.lon, 1) +
    ' m</b>, Ø ≤ <b>' + E.fmt(r.seuils['S.P'], 0) + ' cm</b> pour le sapin et <b>' + E.fmt(r.seuils['EPC'], 0) +
    ' cm</b> pour l’épicéa.</p>';
  if (r.faussementZ.length) {
    h += '<div class="avis rouge">' + r.faussementZ.length + ' billon(s) en qualité <b>Z</b> alors que leurs dimensions ' +
      'dépassent les seuils : ' + esc(r.faussementZ.join(', ')) + '. Corrigez leur qualité ou leurs dimensions.</div>';
  }
  if (r.aPasserZ.length) {
    h += '<div class="avis">' + r.aPasserZ.length + ' billon(s) hors dimension ne sont pas encore en qualité Z : ' +
      esc(r.aPasserZ.map(function (x) { return x.num; }).join(', ')) + '.</div>' +
      '<div class="btn-rang"><button class="btn primaire" id="nz-ok">Passer ces ' + r.aPasserZ.length + ' billons en Z</button></div>';
  } else if (!r.faussementZ.length) {
    h += '<div class="avis">Rien à signaler : ' + (r.dejaZ ? r.dejaZ + ' billon(s) déjà en Z, ' : '') +
      'aucun autre billon hors dimension.</div>';
  }
  modale('Billons de valeur nulle', h);
  if ($('#nz-ok')) {
    $('#nz-ok').addEventListener('click', function () {
      r.aPasserZ.forEach(function (x) { A.bord.lignes[x.i].qual = 'Z'; });
      sauver(); majBandeau(); renderBordereau(); renderSyntheses(); renderDernieres();
      fermerModale(); toast(r.aPasserZ.length + ' billon(s) passés en qualité Z.');
    });
  }
}

