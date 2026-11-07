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
  /* Le + et le ☰ posent leur allure de feuille après coup : toute autre
     fenêtre la retire. */
  $('#modale').classList.remove('feuille-nav');
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
function fermerModale() {
  $('#modale').hidden = true; $('#modale-corps').innerHTML = '';
  $('#modale').classList.remove('feuille-nav');
}

/* ============================================================ NAVIGATION */
function aller(v) {
  var bloc = null;
  if (VUES_DEPLACEES[v]) { bloc = VUES_DEPLACEES[v].bloc; v = VUES_DEPLACEES[v].vue; }
  /* Le chemin d'un écran libre se note avant de changer d'écran : il faut
     savoir d'où l'on vient pour savoir où revenir. */
  noterParcours(v);
  A.vue = v;
  $$('.onglets button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.vue === v)); });
  amenerPastilleEnVue();
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
  if (v === 'tva') renderTva();
  if (v === 'depenses') { renderDepenses(); renderCharges(); }
  if (v === 'stock2') renderStockFournitures();
  if (v === 'analyses') renderAnalyses();
  if (v === 'commandes') renderCommandes();
  if (v === 'revient') renderRevient();
  if (v === 'rendements') renderRendements();
  if (v === 'estimer') renderEstimer();
  if (v === 'carnetv') renderCarnetV();
  if (v === 'echeancesv') renderEcheancesV();
  if (v === 'coutsv') renderCoutsV();
  if (v === 'notes') renderNotes();
  if (v !== 'calendrier') fermerBulleJour();
  if (v !== 'accueil') oterBulleAuj();
  majCadre();
  try { if (window.scrollY || window.pageYOffset) window.scrollTo(0, 0); } catch (e) { }
  /* Après la remise en haut, jamais avant : elle l'annulerait. */
  if (bloc && $('#' + bloc)) $('#' + bloc).scrollIntoView();
  /* Aujourd'hui qui s'affiche dit ce que Sylve a compté pour lui (lot r1b). */
  if (v === 'accueil') montrerBulleAuj();
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
  $('#regl-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-regl]');
    if (b) { A.secReglages = b.dataset.regl; renderReglagesNav(); }
  });
  $('#b-retour').addEventListener('click', remonter);
  brancherRetourTelephone();
  $('#b-menu').addEventListener('click', ouvrirMenu);
  $('#barre').addEventListener('click', function (e) {
    var b = e.target.closest('[data-barre]');
    if (b) allerOnglet(b.dataset.barre);
  });
  $('#b-ctx').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'b-entete2') ouvrirEntete();
  });
  brancherAujourdhui();
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
        ' » ?\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans ' + B.CHEMIN_CORBEILLE + '.')) return;
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
  /* --- Argent ▸ Mois (lot d1) --- */
  $('#mo-prec').addEventListener('click', function () { changerMoisArgent(-1); });
  $('#mo-suiv').addEventListener('click', function () { changerMoisArgent(1); });
  $('#fi-corps').addEventListener('click', function (e) {
    /* « À ce jour » mène au groupe de Chantiers qui porte ces chantiers ;
       l'ancien détour par le filtre replié n'est plus nécessaire. */
    if (e.target.closest('#mo-afacturer')) { ouvrirGroupeChantiers(['faire']); return; }
    if (e.target.closest('#mo-attente')) { ouvrirGroupeChantiers(['factures', 'faire']); return; }
    var b = e.target.closest('[data-modep]');
    if (b) depensesDuMois(b.dataset.modep);
  });
  /* Un pli ouvert le reste quand l'écran se redessine, comme ceux de la
     liste Chantiers. */
  ['#fi-corps', '#ana-corps'].forEach(function (sel) {
    $(sel).addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || !d.dataset || !d.dataset.loin) return;
      A.agPlis = A.agPlis || {};
      A.agPlis[d.dataset.loin] = d.open;
    }, true);
  });
  /* --- chantiers --- */
  /* La liste se redessine en entier (le tri des payés anciens en fait
     partie) : on écoute donc l'écran, pas chaque bouton. Le champ de
     recherche reste hors de ce qui se redessine, le clavier ne tombe pas. */
  $('#c-filtre').addEventListener('change', function () { A.filtreCh = this.value; renderFiltreListe(); });
  $('#c-rech').addEventListener('input', function () { A.rechCh = this.value; renderListeChantiers(); });
  $('#vue-carnet').addEventListener('change', function (e) {
    if (e.target && e.target.id === 'c-tri') { A.triCh = e.target.value; renderListeChantiers(); }
  });
  $('#vue-carnet').addEventListener('click', function (e) {
    var o = e.target.closest('[data-chouvrir]');
    if (o) { ouvrirChantier(o.dataset.chouvrir); return; }
    if (e.target.closest('#c-sens')) { A.triAncien = !A.triAncien; renderListeChantiers(); }
  });
  $('#vue-carnet').addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || !d.dataset || !d.dataset.pli) return;
    A.chPlis = A.chPlis || {};
    A.chPlis[d.dataset.pli] = d.open;
  }, true);
  $('#fiche-chantier').addEventListener('change', function (e) {
    if (e.target && e.target.id === 'f-choix' && e.target.value) ouvrirChantier(e.target.value);
  });
  /* La recherche du choix d'un chantier (lot r2) : seule la liste se refait. */
  $('#fiche-chantier').addEventListener('input', function (e) {
    if (e.target && e.target.id === 'fc-rech') renderChoixChantier($('#fiche-chantier'));
  });
  /* Ce qu'il déplie ou replie se garde tant qu'il reste sur ce chantier :
     enregistrer une ligne redessine la fiche, pas ses étapes. « toggle » ne
     remonte pas : on l'écoute à la descente. */
  $('#fiche-chantier').addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d || !d.dataset || d.dataset.etape == null || !A.ficheVue) return;
    A.ficheVue.ouvertes[Number(d.dataset.etape)] = d.open;
  }, true);
  $('#fiche-chantier').addEventListener('click', function (e) {
    var id = A.chOuvert, c = chantier(id);
    var voisin = e.target.closest('[data-voisin]');
    if (voisin) { ouvrirChantier(voisin.dataset.voisin); return; }
    if (e.target.closest('[data-chretour]')) { aller('carnet'); return; }
    var fco = e.target.closest('[data-fcouvre]');
    if (fco) { ouvrirChantier(fco.dataset.fcouvre); return; }
    if (!c) return;
    /* Un jour de l'étape Travaux (lot r2) : la journée à corriger, la fiche
       du jour d'un jour seulement posé, le rattrapage pour « sans date ». */
    var fj = e.target.closest('[data-fjour]');
    if (fj) { ouvrirJourDeFiche(c, fj.dataset.fjour); return; }
    if (e.target.closest('#f-sansreperage')) { majChantier(c, { sansReperage: true }, 'Pas de repérage : noté.'); return; }
    if (e.target.closest('#f-reperage-oui')) {
      majChantier(c, { sansReperage: false }, '').then(function () { ouvrirReperageCh(id); });
      return;
    }
    if (e.target.closest('#f-trajet')) { ouvrirTrajetCh(id); return; }
    var aujourdhui = C.minuit(Date.now()) + 12 * 3600000;
    /* Chaque étape ouvre son propre formulaire : on ne cherche plus le
       numéro de devis au milieu des essences. */
    if (e.target.closest('#f-identite')) { ouvrirIdentiteCh(id); return; }
    if (e.target.closest('#f-estim') || e.target.closest('#f-objectif')) { ouvrirEstimationCh(id); return; }
    if (e.target.closest('#f-devis')) { ouvrirDevisCh(id); return; }
    if (e.target.closest('#f-devis-oui')) { ouvrirDevisCh(id, true); return; }
    if (e.target.closest('#f-facture') || e.target.closest('[data-fiact="facture"]')) {
      ouvrirFactureCh(id); return;
    }
    if (e.target.closest('#f-peuplement')) { ouvrirPeuplementCh(id); return; }
    if (e.target.closest('#f-reperage')) { ouvrirReperageCh(id); return; }
    if (e.target.closest('#f-note')) { ouvrirNoteCh(id); return; }
    if (e.target.closest('#f-rendement')) { ouvrirRendementCh(id); return; }
    if (e.target.closest('#f-fournitures')) { ouvrirFournituresCh(id); return; }
    if (e.target.closest('#f-statut')) { ouvrirStatut(id); return; }
    var fc = e.target.closest('[data-fcarte]');
    if (fc && fc.dataset.fcarte === 'moi') {
      releverPosition(fc, function (pt) { majChantier(c, { gps: pt }, 'Position enregistrée.'); });
      return;
    }
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
    if (e.target.closest('#f-planifier')) { demarrerPlacement(id, 'fiche'); return; }
    /* Les gestes des étapes : chacun fait ce que faisait le statut choisi à
       la main, avec les mêmes dates posées en passant. */
    if (e.target.closest('#f-sansdevis')) {
      majChantier(c, { aDevis: false, numeroDevis: '', dateDevis: null, dateSignature: null,
        validiteDevis: null, validiteJours: null, statut: c.statut === 'devis' || c.statut === 'envoye' ? 'accepte' : c.statut },
        'Sans devis — chantier « ' + C.nomStatut('accepte', { aDevis: false }) + ' ».');
      return;
    }
    if (e.target.closest('#f-envoye')) { majChantier(c, { statut: 'envoye' }, 'Devis envoyé.'); return; }
    if (e.target.closest('#f-signe')) {
      var signe = { dateSignature: versDate($('#f-signe-date').value) || aujourdhui };
      if (C.rangStatut(c.statut) < C.rangStatut('accepte')) signe.statut = 'accepte';
      majChantier(c, signe, 'Devis signé — chantier « ' + C.nomStatut('accepte', c) + ' ».');
      return;
    }
    if (e.target.closest('#f-refuse')) {
      c.statut = 'sansuite'; horodaterStatut(c); c.maj = Date.now();
      demanderMotifRefus(c);
      return;
    }
    if (e.target.closest('#f-termine')) {
      majChantier(c, { statut: 'termine' }, 'Travaux terminés — chantier « ' + C.nomStatut('termine', c) + ' ».');
      return;
    }
    /* Le montant change : le devis se fige maintenant, tel qu'il a été signé,
       et les lignes deviennent celles de la facture. C'est la photo qui dira
       ensuite laquelle a été ajoutée ou modifiée. */
    if (e.target.closest('#f-modlignes')) {
      figerDevis(c); c.maj = Date.now();
      A.ficheVue.ouvertes[3] = true;
      sauverChantiers().then(function () {
        renderFiche();
        toast('Les lignes sont maintenant celles de la facture ; le devis est gardé pour comparaison.');
      });
      return;
    }
    var ech = e.target.closest('[data-ffech]');
    if (ech) {
      var base = versDate($('#ff-date').value) || C.minuit(Date.now());
      $('#ff-ech').value = versChamp(base + Number(ech.dataset.ffech) * C.JOUR);
      return;
    }
    if (e.target.closest('#f-facturer')) {
      var num = lireNumero('F', 'ff-num');
      majChantier(c, { numeroFacture: num, dateFacture: versDate($('#ff-date').value) || aujourdhui,
        echeancePaiement: versDate($('#ff-ech').value), statut: 'facture' },
        'Facturé' + (num ? ' — n° ' + num : '') + '.');
      return;
    }
    if (e.target.closest('#f-payer')) {
      majChantier(c, { datePaiement: versDate($('#fp-date').value) || aujourdhui,
        moyenPaiement: $('#fp-moyen').value || null, statut: 'paye' },
        'Paiement noté — chantier « ' + C.nomStatut('paye', c) + ' ».');
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
      if (!confirm('Supprimer « ' + (C.nomChantier(c)) + ' » ?\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans ' + B.CHEMIN_CORBEILLE + '.')) return;
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
      ouvrirChantier(ch.id, 'devis');
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
  /* TVA, Dépenses et Année portent chacune les mêmes trois sélecteurs, qui
     écrivent la même période : celle qu'on choisit dans l'une se retrouve
     dans les deux autres. Mois a la sienne. */
  ['an', 'fi', 'dep'].forEach(function (p) {
    ['-type', '-indice', '-annee'].forEach(function (s) {
      $('#' + p + s).addEventListener('change', function () {
        A.periode = { type: $('#' + p + '-type').value, annee: Number($('#' + p + '-annee').value),
          indice: Number($('#' + p + '-indice').value) || 0 };
        renderAnalyses(); renderTva(); renderDepenses(); renderCharges(); renderAccueil();
      });
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
        renderAchats(); renderBudgetAchats();
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
  /* Un appui sur la charge l'ouvre ; Supprimer est dans sa fenêtre (lot d1),
     comme pour une dépense. */
  $('#charges-resume').addEventListener('click', function (e) {
    var m = e.target.closest('[data-chgmod]');
    if (m) ouvrirCharge(m.dataset.chgmod);
  });
  $('#charges-echeances').addEventListener('click', function (e) {
    var mois = e.target.closest('[data-chgmois]');
    if (!mois) return;
    /* On réécrit la seule phrase du détail : refaire tout l'écran ferait
       sauter le graphique sous le doigt. */
    var z = $('#chg-mois-detail');
    if (z) z.innerHTML = detailMoisCharges(
      chargesParMois(A.charges, new Date().getFullYear()), Number(mois.dataset.chgmois));
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
  /* Un seul bouton Aujourd'hui (celui du bandeau est parti) : il mène au mois
     courant et ouvre la fiche du jour (P5). En placement, un appui sur un
     jour pose : rien ne s'ouvre par-dessus. */
  $('#cal-auj').addEventListener('click', function () {
    A.calMois = null; renderCalendrier();
    if (!A.planifie) ouvrirFicheJour(Date.now());
  });
  $('#cal-grille').addEventListener('click', function (e) {
    var b = e.target.closest('[data-jour]'); if (!b) return;
    /* Le doigt qui se lève après un appui long ne rouvre pas la fiche par
       derrière : la bulle vient de s'ouvrir. */
    if (A.appuiLong && Date.now() - A.appuiLong < 1000) { A.appuiLong = 0; return; }
    var ts = Number(b.dataset.jour);
    if (A.planifie) { toucherPlacement(ts); return; }
    /* « Cliquer sur n'importe quel jour doit ouvrir une fiche jour. » La
       saisie ne se faisait que depuis la fiche du chantier. */
    ouvrirFicheJour(ts);
  });
  /* L'appui long (G2) : 500 ms au doigt, le clic droit à la souris. Il ne
     sélectionne pas de texte et n'ouvre pas le menu du téléphone (styles.css,
     et le preventDefault du menu contextuel). Pas pendant un placement : là,
     chaque appui pose. Un doigt qui bouge fait défiler, il n'appuie pas. */
  var minuteurAppui = null, departAppui = null;
  var annulerAppui = function () { clearTimeout(minuteurAppui); minuteurAppui = null; };
  $('#cal-grille').addEventListener('pointerdown', function (e) {
    var b = e.target.closest('[data-jour]'); if (!b || A.planifie) return;
    if (e.button != null && e.button > 0) return;
    A.appuiLong = 0;
    departAppui = { x: e.clientX || 0, y: e.clientY || 0 };
    annulerAppui();
    minuteurAppui = setTimeout(function () {
      minuteurAppui = null;
      A.appuiLong = Date.now();
      ouvrirBulleJour(Number(b.dataset.jour), b);
    }, 500);
  });
  $('#cal-grille').addEventListener('pointermove', function (e) {
    if (!minuteurAppui || !departAppui) return;
    if (Math.abs((e.clientX || 0) - departAppui.x) > 10 || Math.abs((e.clientY || 0) - departAppui.y) > 10) annulerAppui();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
    $('#cal-grille').addEventListener(t, annulerAppui);
  });
  $('#cal-grille').addEventListener('contextmenu', function (e) {
    var b = e.target.closest('[data-jour]'); if (!b) return;
    e.preventDefault();
    if (A.planifie) return;
    /* Un clic droit n'est suivi d'aucun clic : rien à avaler ensuite. */
    annulerAppui();
    ouvrirBulleJour(Number(b.dataset.jour), b);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('#aj-bulle')) fermerBulleAuj();
    else if (A.bulle) fermerBulleJour();
  });
  $('#cal-planif').addEventListener('click', function (e) {
    if (e.target.closest('#cal-planif-fin')) finirPlacement();
    else if (e.target.closest('#cal-pl-garder')) { A.placeAvert = null; renderBandeauPlanif(); }
    else if (e.target.closest('#cal-pl-suivant')) deplacerAuJourLibre();
  });
  $('#cal-histo').addEventListener('click', function (e) {
    var mj = e.target.closest('[data-histomj]'), j = e.target.closest('[data-histojour]');
    if (mj) ouvrirJournee(mj.dataset.histomj);
    else if (j) ouvrirFicheJour(Number(j.dataset.histojour));
  });
  $('#cal-histo').addEventListener('toggle', function (e) {
    var s = e.target.dataset && e.target.dataset.sem;
    if (s) { A.semOuvertes = A.semOuvertes || {}; A.semOuvertes[s] = e.target.open; }
  }, true);

  /* --- alertes --- */
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

  /* --- dépenses --- */
  $('#dep-nouvelle').addEventListener('click', function () { ouvrirDepense(null); });
  $('#dep-filtre').addEventListener('change', function () { A.filtreDep = this.value; renderDepenses(); });
  /* Un appui sur la ligne ouvre la dépense ; Supprimer est dans sa fenêtre
     (lot d1, D5). */
  $('#liste-depenses').addEventListener('click', function (e) {
    var m = e.target.closest('[data-depmod]');
    if (!m) return;
    /* Elle découle d'une charge fixe : c'est la charge qu'on ouvre, sinon la
       correction serait effacée à la prochaine synchronisation. */
    var d0 = depense(m.dataset.depmod);
    if (d0 && d0.auto && d0.charge) {
      allerModule('finances', 'charges');
      ouvrirCharge(d0.charge);
      return;
    }
    ouvrirDepense(m.dataset.depmod);
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
      if (!p || !confirm('Supprimer la pile « ' + (p.nom || '') + ' » ?\n\nIl restera récupérable ' + B.JOURS_POUBELLE + ' jours dans ' + B.CHEMIN_CORBEILLE + '.')) return;
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

