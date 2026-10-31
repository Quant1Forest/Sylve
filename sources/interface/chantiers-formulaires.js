/* ------------------------------------------------------------ formulaires */
/* Difficulté d'une ligne de travaux, de 1 à 5. Les deux extrêmes sont
   nommés : entre les deux, c'est son jugement, pas une grille. */
var DIFF5 = [
  { v: 1, n: '1', t: 'très facile' }, { v: 2, n: '2', t: 'facile' },
  { v: 3, n: '3', t: 'moyen' }, { v: 4, n: '4', t: 'difficile' },
  { v: 5, n: '5', t: 'très difficile' }
];
function nomDiff5(v) {
  for (var i = 0; i < DIFF5.length; i++) if (DIFF5[i].v === Number(v)) return DIFF5[i].t;
  return '';
}
function chipsDiff5(idBase, valeur) {
  return '<button type="button" class="chip" data-' + idBase + '="" aria-pressed="' +
    (!valeur) + '">—</button>' + DIFF5.map(function (n) {
      return '<button type="button" class="chip" data-' + idBase + '="' + n.v + '" title="' + n.t +
        '" aria-pressed="' + (Number(valeur) === n.v) + '">' + n.n + '</button>';
    }).join('');
}

/* Durées de validité usuelles d'un devis de travaux. Trois mois est le cas
   courant. La date qui en découle ne ferme aucune porte — un devis signé
   plus tard se fait quand même : elle dit quand relancer. */
var VALIDITES_DEVIS = [
  { m: 1, n: '1 mois' }, { m: 2, n: '2 mois' }, { m: 3, n: '3 mois' },
  { m: 6, n: '6 mois' }, { m: 12, n: '1 an' }
];
function champsDevisCh(c) {
  var v = C.nb(c.validiteDevis);
  return '<div class="grille g2" style="margin-top:9px">' +
    '<div class="champ"><label class="eyebrow" for="ce-datedevis">Édité le</label>' +
    '<input type="date" id="ce-datedevis" value="' + versChamp(c.dateDevis) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="ce-validite">Validité</label>' +
    '<select id="ce-validite"><option value="">—</option>' +
    VALIDITES_DEVIS.map(function (x) {
      return '<option value="' + x.m + '"' + (v === x.m ? ' selected' : '') + '>' + x.n + '</option>';
    }).join('') + '</select></div></div>' +
    champNumero('D', 'ce-numdevis', c.numeroDevis, 'N° du devis') +
    '<p class="muted" id="ce-validite-fin" style="font-size:12px;margin:7px 0 0"></p>' +
    /* Il l'a demandée expressément : la signature est ce qui fait basculer le
       chantier, et sans sa date on ne sait plus quand l'engagement a été pris. */
    '<div class="champ" style="margin-top:11px">' +
    '<label class="eyebrow" for="ce-signe">Signé le</label>' +
    '<input type="date" id="ce-signe" value="' + versChamp(c.dateSignature) + '">' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Renseignée, elle fait passer ' +
    'le chantier en « ' + esc(C.nomStatut('accepte', { aDevis: true })) + ' ».</p></div>';
}
/* La liste des étapes dépend de la case : on lui donne de quoi répondre sans
   avoir le chantier enregistré sous la main. */
function optionsStatutCh(statut, avecDevis) {
  var vu = { aDevis: !!avecDevis, statut: statut };
  return C.statutsPossibles(vu).map(function (s) {
    return '<option value="' + s.c + '"' + (statut === s.c ? ' selected' : '') + '>' +
      esc(C.nomStatut(s.c, vu)) + '</option>';
  }).join('');
}
function majFinValidite() {
  var z = $('#ce-validite-fin'); if (!z) return;
  var fin = C.finValiditeDevis({ aDevis: true,
    dateDevis: versDate($('#ce-datedevis').value),
    validiteDevis: C.nb($('#ce-validite').value) });
  z.textContent = fin ? 'Valable jusqu’au ' + dateCourte(fin) + '.' : '';
}
/* Statut et champs du devis suivent la case, à chaque bascule. Un chantier
   posé à « devis envoyé » puis déclaré sans devis passe à l'étape d'après :
   celle où il en est réellement. */


var ceJours = [], ceChantierId = null;

/* Ce qui est déjà retenu sur les jours qu'il est en train de poser. On ne
   l'empêche pas de doubler — il lui arrive de faire une demi-journée ici et
   une demi-journée là — mais il doit le voir avant de valider. */
function occupationCeJours() {
  var ds = ceJours.map(function (j) { return j.d; }).filter(Boolean);
  if (!ds.length) return {};
  return C.occupation(A.chantiers, Math.min.apply(null, ds), Math.max.apply(null, ds), A.cfg);
}
function prisCeJour(occ, ts) {
  var o = ts ? occ[C.jourCle(ts)] : null; if (!o) return [];
  var vus = {}, r = [];
  o.prevus.concat(o.reels).forEach(function (p) {
    var ch = p.chantier;
    if (!ch || ch.id === ceChantierId || vus[ch.id]) return;
    vus[ch.id] = 1; r.push(C.nomChantier(ch));
  });
  return r;
}

/* Une journée ne se découpe pas qu'en deux. Le bouton ne proposait que « 1 j »
   ou « ½ j » ; on part parfois trois heures sur un chantier avant d'aller
   ailleurs. Les heures sont converties en part de journée d'après le réglage
   « heures dans une journée », et une valeur déjà en base qui ne tombe sur
   aucun cran reste proposée telle quelle. */
/* Rien que des heures, de une à la journée entière. Les crans ¼ ½ ¾ vivaient
   à côté et disaient la même chose autrement : « soit tu mets tout en heures,
   soit tu ne mets pas tout en heures ». Une valeur déjà posée qui ne tombe
   pas sur une heure ronde est gardée telle quelle — ses demi-journées sont à
   lui, on ne les réécrit pas. */
function partsPossibles(courante) {
  var hj = C.HEURES_JOUR(A.cfg) || 8;
  var crans = [];
  for (var h = 1; h <= hj; h++) {
    var p = C.arr(h / hj, 4);
    crans.push({ p: p, n: h + ' h' + (h === hj ? ' · 1 j' : '') });
  }
  if (courante > 0 && !crans.some(function (x) { return x.p === courante; })) {
    crans.push({ p: courante, n: E.fmt(courante, 2) + ' j' });
  }
  crans.sort(function (a, b) { return b.p - a.p; });
  return crans.map(function (x) {
    return '<option value="' + x.p + '"' + (x.p === courante ? ' selected' : '') + '>' +
      x.n + '</option>';
  }).join('');
}
function renderCeJours() {
  var z = $('#ce-jours'); if (!z) return;
  var total = ceJours.reduce(function (s, j) { return s + C.nb(j.p); }, 0);
  var vise = C.nb($('#ce-jest') ? $('#ce-jest').value : 0);
  var occ = occupationCeJours(), nbPris = 0, vusDates = {};
  z.innerHTML = ceJours.map(function (j, i) {
    var pris = prisCeJour(occ, j.d);
    var doublon = j.d && vusDates[j.d];
    if (j.d) vusDates[j.d] = 1;
    if (pris.length) nbPris++;
    return '<div style="margin-bottom:6px">' +
      '<div style="display:flex;gap:7px;align-items:center">' +
      '<input type="date" data-cej="' + i + '" value="' + versChamp(j.d) + '" style="flex:1' +
      (pris.length || doublon ? ';border-color:#B98A00' : '') + '">' +
      '<select data-cepart="' + i + '" style="flex:none;width:5.6em">' +
      partsPossibles(C.nb(j.p)) + '</select>' +
      '<button type="button" class="btn-min" data-cedel="' + i + '" style="flex:none">✕</button></div>' +
      (doublon
        ? '<div class="jour-pris">Ce jour est déjà posé plus haut.' +
          '<button type="button" class="btn-min" data-cedel="' + i + '" ' +
          'style="margin-left:7px">Retirer celui-ci</button></div>'
        : pris.length
          ? '<div class="jour-pris"><b>Le ' + dateCourte(j.d) + ' est déjà pris</b> — ' +
            esc(pris.join(', ')) + '.' +
            '<button type="button" class="btn-min" data-cesuivant="' + i + '" ' +
            'style="margin-left:7px">Prendre le jour libre suivant</button>' +
            '<button type="button" class="btn-min" data-cedel="' + i + '" ' +
            'style="margin-left:5px">Annuler</button></div>'
          : '') +
      '</div>';
  }).join('') +
    '<button type="button" class="btn-min" id="ce-plusjour">+ une journée</button>' +
    (nbPris ? '<p class="jour-pris" style="margin:8px 0 0">' + nbPris + ' journée' +
      (nbPris > 1 ? 's' : '') + ' tombe' + (nbPris > 1 ? 'nt' : '') + ' sur un jour déjà retenu. ' +
      'Rien ne l’interdit — quelques heures de chaque côté, par exemple — mais vérifiez.</p>' : '');
  var tj = $('#ce-total-jours');
  if (tj) {
    tj.textContent = total ? E.fmt(total, total % 1 ? 1 : 0) : '—';
    tj.style.color = (vise && total > vise) ? '#B4231F' : '';
    tj.title = vise ? 'sur ' + vise + ' estimées' : '';
  }
}
function lireCeJours() {
  $$('#ce-jours [data-cej]').forEach(function (i) {
    var d = versDate(i.value);
    if (d) ceJours[Number(i.dataset.cej)].d = d;
  });
  $$('#ce-jours [data-cepart]').forEach(function (s) {
    var p = C.nb(s.value);
    if (p > 0) ceJours[Number(s.dataset.cepart)].p = p;
  });
}
/* Ajouter, retirer, corriger une date posée. Partagé par le formulaire de
   création et celui des journées : deux copies auraient fini par diverger. */
function brancherCeJours() {
  $('#ce-jours').addEventListener('click', function (e) {
    var plus = e.target.closest('#ce-plusjour'), del = e.target.closest('[data-cedel]');
    var suivant = e.target.closest('[data-cesuivant]');
    if (plus || suivant) {
      lireCeJours();
      /* on propose le prochain jour réellement libre : ni week-end, ni déjà
         posé ici, ni retenu par un autre chantier. Il peut toujours le
         changer à la main derrière.
         Le même calcul déplace une date qui tombe sur un jour déjà pris : il
         demandait qu'on le lui dise « avant, pas après », et le dire sans rien
         proposer l'obligeait à chercher le jour libre lui-même. */
      var rang = suivant ? Number(suivant.dataset.cesuivant) : -1;
      var depuis = suivant ? ceJours[rang].d + C.JOUR
        : (ceJours.length ? ceJours[ceJours.length - 1].d + C.JOUR : Date.now());
      var base = C.minuit(depuis);
      var occLibre = C.occupation(A.chantiers, base, base + 90 * C.JOUR, A.cfg);
      var posesIci = {};
      ceJours.forEach(function (j, n) { if (j.d && n !== rang) posesIci[j.d] = 1; });
      var garde = 0;
      while (garde++ < 90 && (
        (C.estWeekend(base) && !(A.cfg && A.cfg.weekends)) ||
        posesIci[base] || prisCeJour(occLibre, base).length)) base += C.JOUR;
      if (suivant) ceJours[rang].d = base;
      else ceJours.push({ d: base, p: 1 });
      renderCeJours();
    } else if (del) {
      lireCeJours();
      ceJours.splice(Number(del.dataset.cedel), 1);
      renderCeJours();
    }
  });
  $('#ce-jours').addEventListener('change', function () { lireCeJours(); renderCeJours(); });
}

/* Les dates posées se modifiaient dans l'en-tête, au milieu de vingt-deux
   autres champs. Elles ont leur formulaire, comme chaque bloc de la fiche.
   Le calendrier reste la façon naturelle d'en poser une ; ceci sert à
   corriger une date ou une demi-journée sans y aller. */
function ouvrirJourneesCh(id) {
  var c = chantier(id); if (!c) return;
  ceJours = C.journeesPlacees(c).map(function (x) { return { d: x.d, p: x.p }; });
  ceChantierId = id;
  modale('Les journées',
    '<div class="champ"><label class="eyebrow" for="ce-jest">Journées estimées</label>' +
    '<input type="text" id="ce-jest" inputmode="decimal" autocomplete="off" value="' +
    (c.joursEstimes != null ? esc(String(c.joursEstimes).replace('.', ',')) : '') + '"></div>' +
    '<p class="eyebrow" style="margin:14px 0 6px">Les dates posées</p>' +
    '<div id="ce-jours"></div>' +
    '<p class="muted" style="font-size:12px;margin:9px 0 0">Total placé : ' +
    '<b id="ce-total-jours" class="num">—</b>. Pour poser une date en voyant le mois, ' +
    'passez par l’agenda.</p>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="cj-ok">Valider</button></div>');
  renderCeJours();
  $('#ce-jest').addEventListener('input', renderCeJours);
  brancherCeJours();
  $('#cj-ok').addEventListener('click', function () {
    lireCeJours();
    var jest = C.nb($('#ce-jest').value);
    var pose = ceJours.reduce(function (s2, j) { return s2 + C.nb(j.p); }, 0);
    if (jest > 0 && pose > jest) {
      var tropDe = C.arr(pose - jest, 2);
      if (!confirm('Vous placez ' + E.fmt(pose, pose % 1 ? 1 : 0) + ' journées pour ' +
        E.fmt(jest, jest % 1 ? 1 : 0) + ' estimées, soit ' +
        String(tropDe).replace('.', ',') + ' de trop.\n\nEnregistrer quand même ?')) return;
    }
    var vus = {};
    majChantier(c, {
      joursEstimes: jest > 0 ? jest : null,
      jours: ceJours.filter(function (j) {
        if (!j.d || vus[j.d]) return false;
        vus[j.d] = 1; return true;
      }).sort(function (x, y) { return x.d - y.d; })
    }, 'Journées enregistrées.');
  });
}

/* La création d'un chantier tenait en vingt-trois champs : le devis, la
   facture, les journées, le peuplement, le statut, la note. Tout cela se
   remplit maintenant bloc par bloc sur la fiche, une fois le chantier ouvert.
   Il ne reste ici que ce qu'on sait au moment où le chantier arrive : pour
   qui, où, et ce qu'on y fait. */
function ouvrirEnteteCh() {
  majDatalistClients(); majDatalistLieux();
  modale('Nouveau chantier',
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="ce-donneur">Donneur d’ordre' +
    '<button type="button" class="mini-plus" data-ajlist="clients" data-ajchamp="ce-donneur" ' +
    'title="Ajouter à la liste">+ liste</button></label>' +
    '<input type="text" id="ce-donneur" autocomplete="off" list="liste-clients" ' +
    'placeholder="expert, gestionnaire…">' +
    '<p class="offre-liste" id="ce-donneur-offre"></p></div>' +
    '<div class="champ"><label class="eyebrow" for="ce-proprio">Client' +
    '<button type="button" class="mini-plus" data-ajlist="proprios" data-ajchamp="ce-proprio" ' +
    'title="Ajouter à la liste">+ liste</button></label>' +
    '<input type="text" id="ce-proprio" autocomplete="off" list="liste-proprios">' +
    '<p class="offre-liste" id="ce-proprio-offre"></p></div>' +
    '<div class="champ"><label class="eyebrow" for="ce-com">Commune</label>' +
    '<input type="text" id="ce-com" autocomplete="off" list="liste-lieux"></div>' +
    '<div class="champ"><label class="eyebrow" for="ce-foret">Forêt</label>' +
    '<input type="text" id="ce-foret" autocomplete="off" list="liste-lieux"></div>' +
    '</div>' +
    /* Le type de travaux est su dès la création : il compose le nom, et il
       ouvre la première ligne du bloc Travaux, à chiffrer plus tard. */
    '<div class="champ"><label class="eyebrow" for="ce-trav">Type de travaux</label>' +
    '<select id="ce-trav">' + optionsTravaux('', { vide: true }) + '</select>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Une première ligne sera ' +
    'ouverte dans les travaux : vous la chiffrerez ensuite.</p></div>' +
    /* « Il faudrait que je puisse choisir chantier avec devis, oui ou non :
       comme ça, ça me change directement le bon statut. » Un chantier sans
       devis naissait en « Devis à envoyer », sans statut qui lui convienne.
       Le choix est obligatoire : c'est lui qui décide du statut de départ. */
    '<p class="eyebrow" style="margin:2px 0 6px">Avec un devis ?</p>' +
    '<div class="chips" id="ce-devis">' +
    '<button type="button" class="chip" data-cedevis="oui" aria-pressed="false">Avec devis</button>' +
    '<button type="button" class="chip" data-cedevis="non" aria-pressed="false">Sans devis</button>' +
    '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 12px">Avec : il part en « Devis ' +
    'à envoyer ». Sans : il part directement en « À planifier ».</p>' +
    /* « Il faut que je puisse estimer rapidement le nombre de jours à prévoir,
       ou la surface. » Les deux restent facultatifs. */
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="ce-jours">Journées à prévoir</label>' +
    '<input type="text" id="ce-jours" inputmode="decimal" placeholder="estimation"></div>' +
    '<div class="champ" id="ce-qte-champ" hidden><label class="eyebrow" for="ce-qte" ' +
    'id="ce-qte-l">Quantité</label>' +
    '<input type="text" id="ce-qte" inputmode="decimal"></div>' +
    '</div>' +
    '<div class="champ"><p class="eyebrow" style="margin:0 0 4px">Il s’appellera</p>' +
    '<p class="gros" id="ce-nom-apercu" style="margin:0;font-weight:600"></p>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Composé des travaux, du ' +
    'propriétaire et de la commune, et refait tout seul si l’un des trois change. ' +
    'Tous vos chantiers portent ainsi le même genre de nom.</p></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="ce-ok">Créer le chantier</button></div>');

  brancherOffreListe('ce-donneur', 'clients');
  /* Le SIREN ne se demande plus qu'à un endroit : sous le champ du client.
     La case du bas redisait la même question — et, décochée, elle écrasait
     la réponse qu'on venait d'y donner. Un client déjà connu dont on ignore
     la réponse se voit poser la question au même endroit. */
  brancherOffreListe('ce-proprio', 'proprios', { connus: true });
  var avecDevis = null;
  $('#ce-devis').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cedevis]'); if (!b) return;
    avecDevis = b.dataset.cedevis === 'oui';
    $$('#ce-devis [data-cedevis]').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x === b));
    });
  });
  /* La quantité parle l'unité des travaux : des hectares, des plants. À la
     journée, c'est le champ d'à côté qui répond. */
  var suivreQuantite = function () {
    var t = $('#ce-trav').value, u = t ? C.uniteDe(t) : '';
    var montre = !!t && u !== 'jour';
    $('#ce-qte-champ').hidden = !montre;
    if (montre) {
      $('#ce-qte-l').textContent = (u === 'ha' ? 'Surface' : 'Quantité') +
        ' (' + C.courtUnite(u) + ')';
    }
  };
  $('#ce-trav').addEventListener('change', suivreQuantite);
  suivreQuantite();
  var compose = function () {
    return C.nomAutoChantier($('#ce-trav').value,
      $('#ce-proprio').value.trim(), $('#ce-com').value.trim());
  };
  var recomposer = function () {
    $('#ce-nom-apercu').textContent = compose() || 'à préciser ci-dessus';
  };
  ['#ce-proprio', '#ce-com'].forEach(function (x) {
    $(x).addEventListener('input', recomposer);
  });
  $('#ce-trav').addEventListener('change', recomposer);
  recomposer();

  $('#ce-ok').addEventListener('click', function () {
    if (!compose()) {
      toast('Il faut le type de travaux, le propriétaire ou la commune : c’est ce qui ' +
        'nomme le chantier.');
      return;
    }
    if (avecDevis === null) {
      toast('Avec ou sans devis ? C’est ce qui décide de son statut.');
      return;
    }
    var trav = $('#ce-trav').value;
    var jours = C.nb($('#ce-jours').value), qte = C.nb($('#ce-qte').value);
    var proprio = $('#ce-proprio').value.trim();
    var c = {
      id: uid(), cree: Date.now(), maj: Date.now(),
      statut: avecDevis ? 'devis' : 'accepte', aDevis: avecDevis,
      /* Aujourd'hui à midi, corrigeable : un chantier saisi après coup n'est
         pas arrivé aujourd'hui. Midi, comme toutes les dates du fichier. */
      dateEntree: C.minuit(Date.now()) + 12 * 3600000,
      /* La réponse vit sur le client : elle a été donnée sous le champ, ou
         lors d'un chantier précédent. Rien ne la réécrit ici. */
      siren: sirenDe(proprio),
      donneur: $('#ce-donneur').value.trim(),
      proprietaire: proprio,
      commune: $('#ce-com').value.trim(), foret: $('#ce-foret').value.trim(),
      lignes: trav ? [{ travail: trav, unite: C.uniteDe(trav),
        quantite: !$('#ce-qte-champ').hidden && qte > 0 ? qte : '', prix: '',
        nature: C.estFourniture(trav) ? 'vente' : 'prestation', note: '' }] : [],
      temps: [], jours: []
    };
    if (jours > 0) c.joursEstimes = jours;
    A.chantiers.push(c);
    horodaterStatut(c);
    sauverChantiers().then(function () {
      fermerModale(); renderCarnet(); renderAccueil(); renderRendements(); renderCalendrier();
      ouvrirChantier(c.id);
      toast('Chantier créé.');
    });
  });
}

/* Proposer d'enrichir la liste dès qu'on quitte le champ, plutôt qu'au moment
   de valider le chantier : à la validation, le nom est tapé depuis longtemps,
   la fenêtre bloquante tombe de nulle part et coupe la saisie. Ici c'est une
   ligne sous le champ, qu'on tape ou qu'on ignore. */
function brancherOffreListe(champId, cle, options) {
  var champ = $('#' + champId), offre = $('#' + champId + '-offre');
  if (!champ || !offre) return;
  /* Une réponse donnée sous le champ doit se voir dans le reste du
     formulaire : une case restée décochée écrasait le SIREN qu'on venait de
     poser. On le dit au champ, et chaque formulaire relit. */
  var prevenir = function () {
    var ev = document.createEvent('Event');
    ev.initEvent('change', true, true);
    champ.dispatchEvent(ev);
  };
  var montrer = function () {
    var nom = champ.value.trim();
    var connu = nom && listeDe(cle).some(function (x) {
      return String(x).toLowerCase() === nom.toLowerCase();
    });
    if (connu && options && options.connus && cle === 'proprios' && !typeDe(nom) &&
      !(contacts()[nom] && contacts()[nom].siren != null)) {
      /* Déjà posée pour ce nom : la redessiner effacerait le choix en cours. */
      if (offre.dataset.question === nom) return;
      offre.dataset.question = nom;
      demanderTypeClient(offre, nom, function () {
        offre.dataset.question = '';
        offre.className = 'offre-liste visible faite';
        offre.textContent = '« ' + nom + ' » : noté.';
        prevenir();
      });
      return;
    }
    offre.dataset.question = '';
    if (!nom || connu) { offre.className = 'offre-liste'; offre.innerHTML = ''; return; }
    offre.className = 'offre-liste visible';
    offre.innerHTML = '« ' + esc(nom) + ' » n’est pas dans vos ' +
      esc(LISTES[cle].nom.toLowerCase()) +
      '.<button type="button" data-offre="' + esc(champId) + '">Ajouter</button>';
  };
  champ.addEventListener('blur', montrer);
  champ.addEventListener('input', function () {
    /* Tant qu'il tape, on se tait : l'offre reviendra quand il aura fini. */
    offre.dataset.question = '';
    if (offre.classList.contains('visible')) { offre.className = 'offre-liste'; offre.innerHTML = ''; }
  });
  offre.addEventListener('click', function (e) {
    if (!e.target.closest('[data-offre]')) return;
    var nom = champ.value.trim();
    if (!nom) return;
    var finir = function () {
      listeDe(cle).push(nom);
      return sauverListe(cle).then(function () {
        majDatalistClients(); majDatalistLieux(); renderListesReglages();
        offre.className = 'offre-liste visible faite';
        offre.textContent = '« ' + nom + ' » ajouté à vos ' +
          LISTES[cle].nom.toLowerCase() +
          (typeDe(nom) ? ' — ' + nomTypeClient(typeDe(nom)).toLowerCase() : '') + '.';
        prevenir();
      });
    };
    /* Un lieu n'a pas de type ; une personne, si. Et c'est le moment de le
       demander : après, on ne saura plus de qui on parle. */
    if (cle === 'clients' || cle === 'proprios') demanderTypeClient(offre, nom, finir);
    else finir();
  });
}


/* Poser le type d'un nom qu'on vient de créer, et le SIREN si c'est un
   propriétaire. Deux questions au plus, à l'endroit où le nom naît — et
   sous le champ, jamais en fenêtre : il n'y a qu'une modale à la fois, et
   elle emporterait le formulaire de création avec le nom en cours. */
function demanderTypeClient(offre, nom, apres) {
  offre.className = 'offre-liste visible';
  offre.innerHTML = '« ' + esc(nom) + ' », c’est qui ?' +
    '<select id="tc-type" style="margin:6px 0 0;width:100%">' +
    TYPES_CLIENT.map(function (t) {
      return '<option value="' + t.c + '">' + esc(t.n) + '</option>';
    }).join('') + '</select>' +
    '<label class="ligne-check" id="tc-siren-l" style="display:flex;' +
    'align-items:flex-start;gap:7px;margin:7px 0 0">' +
    '<input type="checkbox" id="tc-siren" style="margin-top:2px">' +
    '<span>Identifié producteur agricole (n° SIREN) — ouvre le taux réduit' +
    '</span></label>' +
    '<span style="display:block;margin-top:7px">' +
    '<button type="button" id="tc-ok">Enregistrer</button> ' +
    '<button type="button" id="tc-passer">Je ne sais pas</button></span>';

  var suivre = function () {
    /* La question du SIREN disparaît dès que le type la rend sans objet,
       plutôt que de rester grisée : une case sans objet se coche quand même. */
    var t = $('#tc-type').value, ouvre = false;
    TYPES_CLIENT.forEach(function (x) { if (x.c === t && x.siren) ouvre = true; });
    $('#tc-siren-l').hidden = !ouvre;
    if (!ouvre) $('#tc-siren').checked = false;
  };
  $('#tc-type').addEventListener('change', suivre);
  suivre();

  var conclure = function (poser) {
    if (poser) {
      poserType(nom, $('#tc-type').value);
      if (!$('#tc-siren-l').hidden) poserSiren(nom, $('#tc-siren').checked);
    }
    Promise.resolve(sauverCfg()).then(function () { if (apres) apres(); });
  };
  $('#tc-ok').addEventListener('click', function () { conclure(true); });
  /* « Je ne sais pas » n'est pas un refus : sans type, Sylve continue de
     proposer le SIREN, comme pour tous les noms d'avant. */
  $('#tc-passer').addEventListener('click', function () { conclure(false); });
}

/* Enregistre quelques champs d'un chantier et redessine ce qu'il faut. Tous
   les petits formulaires passent par là : c'est ce qui garantit qu'aucun
   n'oublie de rafraîchir le carnet ou l'accueil. */
function majChantier(c, champs, message) {
  var avant = c.statut;
  Object.keys(champs).forEach(function (k) { c[k] = champs[k]; });
  c.maj = Date.now();
  /* La photo du devis se prend au passage, jamais après : sur un chantier
     déjà facturé — les trente-deux repris du carnet — figer l'existant
     appellerait « devis » ce qui n'en a jamais été un, et toutes les lignes
     paraîtraient conformes à un devis qui n'a pas existé. */
  if (avant !== c.statut && ['facture', 'paye'].indexOf(c.statut) >= 0) figerDevis(c);
  horodaterStatut(c);
  return sauverChantiers().then(function () {
    fermerModale(); renderFiche(); renderCarnet(); renderCalendrier();
    renderRendements(); renderFinances(); renderAccueil();
    if (message) toast(message);
  });
}

/* --- l'identité : qui, où, pour qui --- */
function ouvrirIdentiteCh(id) {
  var c = chantier(id); if (!c) return;
  var gps = c.gps || null;
  majDatalistClients();
  modale('Le chantier',
    '<div class="champ"><p class="eyebrow" style="margin:0 0 4px">Nom du chantier</p>' +
    '<p class="gros" id="ic-nom-apercu" style="margin:0;font-weight:600">' +
    esc(C.nomChantier(c)) + '</p>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Composé des travaux, du ' +
    'propriétaire et de la commune. Corrigez l’un des trois et le nom suit.</p></div>' +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="ic-donneur">Donneur d’ordre' +
    '<button type="button" class="mini-plus" data-ajlist="clients" data-ajchamp="ic-donneur" ' +
    'title="Ajouter à la liste">+ liste</button></label>' +
    '<input type="text" id="ic-donneur" autocomplete="off" list="liste-clients" ' +
    'placeholder="expert, gestionnaire…" value="' + esc(c.donneur || c.client || '') + '">' +
    '<p class="offre-liste" id="ic-donneur-offre"></p></div>' +
    '<div class="champ"><label class="eyebrow" for="ic-proprio">Client' +
    '<button type="button" class="mini-plus" data-ajlist="proprios" data-ajchamp="ic-proprio" ' +
    'title="Ajouter à la liste">+ liste</button></label>' +
    '<input type="text" id="ic-proprio" autocomplete="off" list="liste-proprios" value="' +
    esc(c.proprietaire || '') + '"><p class="offre-liste" id="ic-proprio-offre"></p></div>' +
    '<div class="champ"><label class="eyebrow" for="ic-foret">Forêt</label>' +
    '<input type="text" id="ic-foret" autocomplete="off" value="' + esc(c.foret || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="ic-parc">Parcelle(s)</label>' +
    '<input type="text" id="ic-parc" autocomplete="off" value="' + esc(c.parcelles || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="ic-com">Commune</label>' +
    '<input type="text" id="ic-com" autocomplete="off" value="' + esc(c.commune || '') + '"></div>' +
    /* Deux champs que la fiche de chantier réclame et que rien ne peut
       deviner : le cadastre ne se déduit pas de la commune. */
    '<div class="champ"><label class="eyebrow" for="ic-dep">Département</label>' +
    '<input type="text" id="ic-dep" inputmode="numeric" placeholder="25" value="' +
    esc(c.departement || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="ic-cad">Réf. cadastrale</label>' +
    '<input type="text" id="ic-cad" autocomplete="off" placeholder="section et numéro" value="' +
    esc(c.cadastre || '') + '"></div>' +
    /* L'ordre d'arrivée dans Sylve, pas la date des travaux. C'est elle qui
       range les chantiers qui n'ont ni devis ni facture. */
    '<div class="champ"><label class="eyebrow" for="ic-entree">Entré le</label>' +
    '<input type="date" id="ic-entree" value="' + versChamp(C.dateEntree(c)) + '"></div>' +
    '</div>' +
    '<label class="ligne-check" style="display:flex;align-items:flex-start;gap:8px;font-size:13.5px;margin:10px 0 0">' +
    '<input type="checkbox" id="ic-siren"' + (c.siren ? ' checked' : '') + ' style="margin-top:2px">' +
    '<span>Identifié producteur agricole (n° SIREN)' +
    '<span class="muted" style="display:block;font-size:11.5px">Ouvre le taux réduit sur les ' +
    'travaux qui y donnent droit.</span></span></label>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn" id="ic-gps">' +
    (c.gps && c.gps.lat != null ? 'Position enregistrée ✓' : 'Enregistrer la position') + '</button>' +
    '<button class="btn primaire" id="ic-ok">Valider</button></div>');
  brancherOffreListe('ic-donneur', 'clients');
  brancherOffreListe('ic-proprio', 'proprios');
  var suivreSiren = function (e) {
    var n = $('#ic-proprio').value.trim();
    var ouvre = sirenPossible(n);
    /* Une réponse posée sous le champ reporte ici : sans ça, la case restée
       décochée la réécrivait à l'enregistrement. */
    if (e && e.type === 'change' && contacts()[n] && contacts()[n].siren != null) {
      $('#ic-siren').checked = sirenDe(n);
    }
    $('#ic-siren').closest('.ligne-check').hidden = !ouvre;
    if (!ouvre) $('#ic-siren').checked = false;
  };
  $('#ic-proprio').addEventListener('input', suivreSiren);
  $('#ic-proprio').addEventListener('change', suivreSiren);
  suivreSiren();
  var suivreNom = function () {
    var l = (c.lignes || []).filter(function (x) {
      return x.travail && !C.estFourniture(x.travail);
    })[0] || (c.lignes || []).filter(function (x) { return x.travail; })[0];
    $('#ic-nom-apercu').textContent = C.nomAutoChantier(l ? l.travail : '',
      $('#ic-proprio').value.trim(), $('#ic-com').value.trim()) || C.nomChantier(c);
  };
  ['#ic-proprio', '#ic-com'].forEach(function (x) {
    $(x).addEventListener('input', suivreNom);
  });
  $('#ic-gps').addEventListener('click', function () {
    var b = this;
    releverPosition(b, function (pt) { gps = pt; b.textContent = 'Position enregistrée ✓'; });
  });
  $('#ic-ok').addEventListener('click', function () {
    majChantier(c, { donneur: $('#ic-donneur').value.trim(),
      proprietaire: $('#ic-proprio').value.trim(), foret: $('#ic-foret').value.trim(),
      parcelles: $('#ic-parc').value.trim(), commune: $('#ic-com').value.trim(),
      departement: $('#ic-dep').value.trim(), cadastre: $('#ic-cad').value.trim(),
      dateEntree: versDate($('#ic-entree').value) || C.dateEntree(c),
      siren: $('#ic-siren').checked, gps: gps }, 'Chantier modifié.');
    poserSiren($('#ic-proprio').value.trim(), $('#ic-siren').checked);
    Promise.resolve(sauverCfg());
  });
}

/* --- l'estimation : ce qu'on pense y passer, et ce qu'on vise --- */
function ouvrirEstimationCh(id) {
  var c = chantier(id); if (!c) return;
  /* Sur un chantier soldé, plus rien ne s'estime : le formulaire ne garde que
     l'objectif, pour mémoire, et dit où se note le temps réellement passé.
     Le crayon disait « estimer » sur un chantier payé, et ouvrait un
     formulaire qui modifiait un chiffre que le bloc n'affiche même plus. */
  var solde = ['termine', 'facture', 'paye'].indexOf(c.statut) >= 0;
  modale(solde ? 'L’objectif de ce chantier' : 'L’estimation',
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="es-jest">' +
    (solde ? 'Journées estimées, pour mémoire' : 'Journées estimées') + '</label>' +
    '<input type="text" id="es-jest" class="gros" inputmode="decimal" autocomplete="off" value="' +
    (c.joursEstimes != null ? esc(String(c.joursEstimes).replace('.', ',')) : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="es-pj">Prix de journée visé (€)</label>' +
    '<input type="text" id="es-pj" class="gros" inputmode="decimal" placeholder="' +
    (C.nb(A.cfg && A.cfg.prixJourVise) || 'défaut') + '" value="' +
    (c.prixJour != null ? esc(String(c.prixJour).replace('.', ',')) : '') + '"></div></div>' +
    '<p class="muted" style="font-size:12px;margin:9px 0 0">' +
    (solde
      ? 'Ce chantier est fini : les journées faites ne se saisissent pas ici. Elles ' +
        'viennent du temps que vous notez, plus bas sur la fiche.'
      : 'Ce que vous pensez y passer, et ce que la journée doit rapporter. Ça reste ' +
        'votre repère tout le long : on le compare ensuite au temps réellement noté.') +
    '</p>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="es-ok">Valider</button>' +
    (solde ? '<button class="btn" id="es-temps">Noter du temps</button>' : '') + '</div>');
  if (solde) {
    $('#es-temps').addEventListener('click', function () { fermerModale(); ouvrirTemps(c.id); });
  }
  $('#es-ok').addEventListener('click', function () {
    var jest = C.nb($('#es-jest').value);
    majChantier(c, { joursEstimes: jest > 0 ? jest : null,
      prixJour: C.nb($('#es-pj').value) || null }, 'Estimation enregistrée.');
  });
}

/* --- le devis, quand il y en a un --- */
function ouvrirDevisCh(id) {
  var c = chantier(id); if (!c) return;
  modale('Le devis',
    '<label class="ligne-check" style="display:flex;align-items:flex-start;gap:8px;font-size:13.5px;margin:0">' +
    '<input type="checkbox" id="dv-a"' + (C.aDevis(c) ? ' checked' : '') + ' style="margin-top:2px">' +
    '<span>J’ai fait un devis pour ce chantier' +
    '<span class="muted" style="display:block;font-size:11.5px">Décoché, les étapes de devis ' +
    'disparaissent du statut et rien d’autre n’est à remplir ici.</span></span></label>' +
    '<div id="dv-bloc">' + champsDevisCh(c) + '</div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="dv-ok">Valider</button></div>');
  var maj = function () {
    var coche = $('#dv-a').checked;
    $('#dv-bloc').style.display = coche ? '' : 'none';
    majFinValidite();
  };
  $('#dv-a').addEventListener('change', maj);
  ['#ce-datedevis', '#ce-validite'].forEach(function (x) {
    if ($(x)) $(x).addEventListener('change', majFinValidite);
  });
  brancherNumero('D', 'ce-numdevis', c.id);
  maj();
  $('#dv-ok').addEventListener('click', function () {
    var coche = $('#dv-a').checked;
    var signe = coche ? versDate($('#ce-signe').value) : null;
    var champs = { aDevis: coche,
      numeroDevis: coche ? lireNumero('D', 'ce-numdevis') : '',
      dateDevis: coche ? versDate($('#ce-datedevis').value) : null,
      dateSignature: signe,
      validiteDevis: coche ? (C.nb($('#ce-validite').value) || null) : null };
    /* Sans devis, les deux premières étapes n'existent plus : on avance le
       chantier à celle où il en est réellement. */
    if (!coche && (c.statut === 'devis' || c.statut === 'envoye')) champs.statut = 'accepte';
    /* Un devis signé fait avancer le chantier tout seul : c'est ce qu'il a
       demandé, et le geste en moins est un oubli en moins. On n'avance
       jamais vers l'arrière — un chantier déjà en cours ne redevient pas
       « à planifier ». */
    var dit = 'Devis enregistré.';
    if (coche && signe && C.rangStatut(c.statut) < C.rangStatut('accepte')) {
      champs.statut = 'accepte';
      dit = 'Devis signé — chantier « ' + C.nomStatut('accepte', c) + ' ».';
    }
    majChantier(c, champs, dit);
  });
}

/* --- la facture et son règlement --- */
function ouvrirFactureCh(id) {
  var c = chantier(id); if (!c) return;
  modale('La facture',
    champNumero('F', 'fc-num', c.numeroFacture, 'N° de facture') +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="fc-date">Facturé le</label>' +
    '<input type="date" id="fc-date" value="' + versChamp(c.dateFacture) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="fc-ech">À payer avant le</label>' +
    '<input type="date" id="fc-ech" value="' + versChamp(c.echeancePaiement) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="fc-paie">Payé le</label>' +
    '<input type="date" id="fc-paie" value="' + versChamp(c.datePaiement) + '"></div>' +
    /* Pour savoir ce qui rentre en chèques : liste fermée, sinon on ne
       pourrait plus les compter. */
    '<div class="champ"><label class="eyebrow" for="fc-moyen">Réglé par</label>' +
    '<select id="fc-moyen"><option value="">— non précisé —</option>' +
    C.MOYENS_PAIEMENT.map(function (x) {
      return '<option value="' + x.c + '"' + (c.moyenPaiement === x.c ? ' selected' : '') +
        '>' + esc(x.n) + '</option>';
    }).join('') + '</select></div></div>' +
    '<div class="btn-rang" style="margin-top:4px">' +
    '<button class="btn-min" data-fcech="30">+ 30 jours</button>' +
    '<button class="btn-min" data-fcech="45">+ 45 jours</button>' +
    '<button class="btn-min" data-fcech="60">+ 60 jours</button></div>' +
    '<p class="muted" style="font-size:12px;margin:9px 0 0">Les délais se comptent depuis ' +
    'la date de facture, pas depuis aujourd’hui : une facture saisie après coup garde ' +
    'sa vraie échéance.</p>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="fc-ok">Valider</button></div>');
  $('#modale-corps').addEventListener('click', function (e) {
    var r = e.target.closest('[data-fcech]'); if (!r) return;
    var base = versDate($('#fc-date').value) || C.minuit(Date.now());
    $('#fc-ech').value = versChamp(base + Number(r.dataset.fcech) * C.JOUR);
  });
  brancherNumero('F', 'fc-num', c.id);
  $('#fc-ok').addEventListener('click', function () {
    var maj = { numeroFacture: lireNumero('F', 'fc-num'),
      dateFacture: versDate($('#fc-date').value),
      echeancePaiement: versDate($('#fc-ech').value),
      datePaiement: versDate($('#fc-paie').value),
      moyenPaiement: $('#fc-moyen').value || null };
    /* « Une facture remplie bascule automatiquement le chantier en facturé. »
       C'était une question posée depuis longtemps, tranchée le 31 août : la
       fenêtre de confirmation ne faisait qu'ajouter un geste à un choix déjà
       fait en remplissant les champs.
       Un paiement saisi va plus loin que la facture : on va alors jusqu'à
       « Payé », sinon on reviendrait en arrière. */
    var vise = maj.datePaiement ? 'paye' : 'facture';
    var dit = 'Facture enregistrée.';
    if (maj.numeroFacture && maj.dateFacture &&
      C.rangStatut(c.statut) < C.rangStatut(vise)) {
      maj.statut = vise;
      dit = 'Facture enregistrée — chantier « ' + C.nomStatut(vise, c) + ' ».';
    }
    majChantier(c, maj, dit);
  });
}

/* --- le peuplement : essence et densité --- */
function ouvrirPeuplementCh(id) {
  var c = chantier(id); if (!c) return;
  var cr = c.criteres || {};
  modale('Le peuplement',
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="ce-ess">Essence</label>' +
    '<select id="ce-ess">' + optionsEssenceCh(cr.essence) + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="ce-dens">Densité (tiges ou plants/ha)</label>' +
    '<input type="text" id="ce-dens" inputmode="numeric" autocomplete="off" value="' +
    (cr.densite || '') + '"></div></div>' +
    '<p class="muted" style="font-size:12px;margin:7px 0 0">L’essence pour vos statistiques, ' +
    'la densité parce que multipliée par la surface elle vous donne le nombre de plants.</p>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="pe-ok">Valider</button></div>');
  brancherEssenceCh('ce-ess', cr.essence || '');
  $('#pe-ok').addEventListener('click', function () {
    var essv = $('#ce-ess').value;
    if (essv === '__ajouter') essv = '';
    majChantier(c, { criteres: Object.assign({}, c.criteres || {}, {
      essence: essv || null, densite: C.nb($('#ce-dens').value) || null
    }) }, 'Peuplement enregistré.');
  });
}

/* --- la note --- */
function ouvrirNoteCh(id) {
  var c = chantier(id); if (!c) return;
  modale('Note',
    '<div class="champ"><label class="eyebrow" for="nc-txt">Ce que vous voulez relire</label>' +
    '<input type="text" id="nc-txt" class="gros" autocomplete="off" value="' + esc(c.notes || '') + '"></div>' +
    '<div class="btn-rang"><button class="btn primaire" id="nc-ok">Valider</button></div>');
  $('#nc-ok').addEventListener('click', function () {
    majChantier(c, { notes: $('#nc-txt').value.trim() }, 'Note enregistrée.');
  });
}

/* Donneurs d'ordre : liste alimentée par la saisie, proposée partout. */
/* La liste d'essences d'un chantier = celles fournies avec l'application,
   plus celles qu'il a ajoutées lui-même (le cèdre, par exemple). Une
   essence personnelle est stockée sous son propre nom : nomEssenceCh
   retombe dessus, donc elle s'affiche partout sans autre traitement. */
function essencesChPerso() {
  A.cfg = A.cfg || {};
  A.cfg.essencesCh = A.cfg.essencesCh || [];
  return A.cfg.essencesCh;
}
function optionsEssenceCh(sel) {
  var fournies = C.ESSENCES_CH.map(function (e) {
    return '<option value="' + esc(e.c) + '"' + (sel === e.c ? ' selected' : '') + '>' + esc(e.n) + '</option>';
  }).join('');
  var perso = essencesChPerso();
  /* une essence choisie autrefois puis retirée de la liste doit rester
     visible sur sa fiche, sinon le chantier perdrait son contexte */
  var vus = C.ESSENCES_CH.map(function (e) { return e.c; }).concat(perso);
  var orphelin = (sel && vus.indexOf(sel) < 0) ? [sel] : [];
  var miennes = perso.concat(orphelin).map(function (n) {
    return '<option value="' + esc(n) + '"' + (sel === n ? ' selected' : '') + '>' + esc(n) + '</option>';
  }).join('');
  return '<option value="">—</option>' + fournies +
    (miennes ? '<optgroup label="Les miennes">' + miennes + '</optgroup>' : '') +
    '<option value="__ajouter">＋ ajouter une essence…</option>';
}
function brancherEssenceCh(champId, avant) {
  var s = $('#' + champId); if (!s) return;
  s.addEventListener('change', function () {
    if (this.value !== '__ajouter') { avant = this.value; return; }
    var n = (prompt('Nom de l’essence à ajouter :') || '').trim();
    if (!n) { this.value = avant || ''; return; }
    var l = essencesChPerso(), bas = n.toLowerCase();
    var deja = C.ESSENCES_CH.filter(function (e) { return e.n.toLowerCase() === bas; })[0];
    if (deja) { this.value = deja.c; avant = deja.c; toast('Déjà proposée.'); return; }
    if (!l.some(function (x) { return String(x).toLowerCase() === bas; })) l.push(n);
    var self = this;
    Promise.resolve(sauverCfg()).then(function () {
      self.innerHTML = optionsEssenceCh(n); self.value = n; avant = n;
      renderListesReglages();
      toast('« ' + n + ' » ajoutée à vos essences.');
    });
  });
}

/* Le « + liste » d'un champ : geste explicite, donc pas de confirmation —
   c'est justement pour éviter d'aller dans les réglages. La confirmation à
   la validation reste, elle, pour les noms tapés sans y penser. */
function ajouterAListeDepuisChamp(k, champId) {
  var ch = $('#' + champId); if (!ch || !LISTES[k]) return;
  var nom = (ch.value || '').trim();
  if (!nom) { toast('Écrivez le nom d’abord.'); return; }
  var l = listeDe(k), bas = nom.toLowerCase();
  if (l.some(function (x) { return String(x).toLowerCase() === bas; })) {
    toast('« ' + nom +' » y est déjà.'); return;
  }
  l.push(nom);
  sauverListe(k).then(function () {
    majDatalistClients(); majDatalistLieux(); renderListesReglages();
    toast('« ' + nom + ' » ajouté à vos ' + LISTES[k].nom.toLowerCase() + '.');
  });
}

function noterClient(nom) { return proposerAjoutListe('clients', nom); }
function majDatalistClients() {
  var d = $('#liste-clients');
  if (d) d.innerHTML = A.clients.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
  var p = $('#liste-proprios');
  if (p) p.innerHTML = (A.proprios || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
}
function noterProprio(nom) { return proposerAjoutListe('proprios', nom); }

function ouvrirLigne(id, idx) {
  var c = chantier(id); if (!c) return;
  var l = idx != null ? c.lignes[idx] : { travail: 'PLANT', unite: 'plant', quantite: '', prix: '' };
  if (!l) return;
  modale(idx != null ? 'Modifier la ligne' : 'Ajouter des travaux',
    '<div class="champ"><label class="eyebrow" for="cl-trav">Travaux</label>' +
    '<select id="cl-trav">' + optionsTravaux(l.travail) + '</select>' +
    /* Un forfait groupé : les travaux en plus désignent ce que la ligne
       couvre. Le prix reste global, il n'y a pas de quantité par travail. */
    '<div id="cl-plus"></div>' +
    '<button type="button" class="chip plus" id="cl-ajout" style="margin-top:7px">' +
    '+ travaux</button></div>' +
    '<div class="grille g3">' +
    '<div class="champ"><label class="eyebrow" for="cl-unite">Unité</label>' +
    '<select id="cl-unite">' + C.UNITES.map(function (u) {
      return '<option value="' + u.c + '"' + (l.unite === u.c ? ' selected' : '') + '>' + u.n + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="cl-qte">Quantité</label>' +
    '<input type="text" id="cl-qte" class="gros" inputmode="decimal" value="' + esc(l.quantite == null ? '' : String(l.quantite).replace('.', ',')) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="cl-prix">Prix unitaire (€)</label>' +
    '<input type="text" id="cl-prix" class="gros" inputmode="decimal" value="' + esc(l.prix == null ? '' : String(l.prix).replace('.', ',')) + '"></div>' +
    '</div>' +
    '<p class="muted" style="font-size:12px;margin:0 0 11px" id="cl-forfait"></p>' +
    /* Le débours ne se propose que sur une fourniture : c'est une somme
       avancée pour le client et refacturée à l'euro près. */
    '<div class="champ" id="cl-nat-champ"><label class="eyebrow" for="cl-nature">Nature</label>' +
    '<select id="cl-nature">' +
    '<option value="vente">Vente de fournitures</option>' +
    '<option value="debours"' + (l.nature === 'debours' ? ' selected' : '') +
    '>Débours client</option></select>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Un débours est une somme ' +
    'avancée pour le client et refacturée à l’euro près : elle figure sur la facture, ' +
    'mais n’entre pas dans votre chiffre d’affaires.</p></div>' +
    '<div class="champ"><label class="eyebrow" for="cl-tva">TVA</label>' +
    /* Le zéro est nécessaire au débours : refacturé à l'euro près, il ne porte
       pas de TVA à ajouter — elle était déjà sur la facture du fournisseur.
       La sélection se teste sur « un taux est posé », jamais sur sa valeur :
       C.nb(null) vaut zéro, et « forcer à 0 % » se serait coché tout seul sur
       chaque ligne qui n'en force aucun. */
    '<select id="cl-tva"><option value="">— d’après la nature des travaux —</option>' +
    [0, 5.5, 10, 20].map(function (t) {
      var pose = l.tva != null && l.tva !== '';
      return '<option value="' + t + '"' + (pose && C.nb(l.tva) === t ? ' selected' : '') +
        '>forcer à ' + String(t).replace('.', ',') + ' %</option>';
    }).join('') + '</select></div>' +
    '<div class="carte2" id="cl-apercu" style="margin:11px 0"></div>' +
    '<label class="eyebrow" style="display:block">Difficulté <span class="muted" ' +
    'style="font-weight:400;text-transform:none;letter-spacing:0">(1 très facile → 5 très difficile)</span></label>' +
    '<div class="chips" id="cl-diff" style="margin-top:5px">' + chipsDiff5('cldiff', l.difficulte) + '</div>' +
    /* Ce qui relie la facture au stock. Laissé vide, rien ne sort : toutes
       les fournitures ne sont pas stockées. Sur un produit dosé — un
       répulsif à 6 ml par plant — la quantité de la ligne reste le nombre
       de plants, c'est ce que lit le client ; c'est la sortie qui convertit. */
    '<div class="champ" style="margin-top:9px"><label class="eyebrow" for="cl-art">Produit du stock</label>' +
    '<select id="cl-art"><option value="">— aucun, rien ne sort du stock —</option>' +
    (A.articles || []).slice().sort(function (x, y) {
      return (x.nom || '').localeCompare(y.nom || '', 'fr');
    }).map(function (a) {
      var d = ST.nb(a.dosage);
      return '<option value="' + a.id + '"' + (l.article === a.id ? ' selected' : '') + '>' +
        esc(a.nom || 'Produit') +
        (d > 0 ? ' — ' + E.fmt(d, d % 1 ? 2 : 0) + ' ' + esc(ST.courtUniteArt(a.unite)) + '/plant' : '') +
        '</option>';
    }).join('') + '</select>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0" id="cl-art-aide"></p></div>' +
    /* La liste des travaux sert au taux de TVA et aux rendements : elle doit
       rester courte et stable. Ce champ porte ce qui figure vraiment sur la
       facture — « tuteur châtaignier 9/11×150 » là où la liste ne connaît
       que « Fourniture de tuteurs » — et c'est lui qui s'affiche en tête. */
    '<div class="champ" style="margin-top:9px"><label class="eyebrow" for="cl-note">Libellé sur la facture</label>' +
    '<input type="text" id="cl-note" autocomplete="off" placeholder="tuteur châtaignier 9/11×150, et agrafes…" value="' + esc(l.note || '') + '">' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">Laissé vide, c’est l’intitulé des travaux qui s’affiche.</p></div>' +
    '<p class="muted" style="font-size:12px;margin:7px 0 0">La note sert à situer vos rendements ' +
    'quand vous estimerez un chantier semblable. La précision, elle, ne sert qu’à vous : ' +
    'c’est ce que vous relirez dans deux ans.</p>' +
    '<div class="btn-rang"><button class="btn primaire" id="cl-ok">Valider</button></div>');

  var clDiff = l.difficulte || '';
  /* Les travaux en plus du premier : ils désignent ce que le forfait couvre.
     Dès qu'il y en a un, la ligne devient un forfait — un seul prix, pas de
     quantité, parce que c'est ainsi qu'il la facture. */
  var clPlus = (l.travauxPlus || []).slice();
  /* Hors fourniture, la nature reste déduite comme avant : une prestation.
     Le champ ne s'affiche donc que là où il a un sens. */
  var natureChoisie = function () {
    if (!C.estFourniture($('#cl-trav').value)) return 'prestation';
    return ($('#cl-nature') && $('#cl-nature').value) || 'vente';
  };
  var majNature = function () {
    var z = $('#cl-nat-champ'); if (!z) return;
    z.style.display = C.estFourniture($('#cl-trav').value) ? '' : 'none';
  };
  var majForfait = function () {
    var groupe = clPlus.length > 0;
    var u = $('#cl-unite'), q = $('#cl-qte'), lab = document.querySelector('label[for="cl-prix"]');
    if (groupe && u.value !== 'forfait') u.value = 'forfait';
    u.disabled = groupe;
    q.disabled = groupe;
    if (groupe) q.value = '';
    if (lab) lab.textContent = groupe ? 'Prix du forfait (€)' : 'Prix unitaire (€)';
    var z = $('#cl-forfait');
    if (z) {
      z.textContent = groupe
        ? 'Forfait groupé : ces travaux disent ce que la ligne couvre, le prix porte sur l’ensemble.'
        : '';
    }
  };
  var renderPlus = function () {
    var z = $('#cl-plus'); if (!z) return;
    z.innerHTML = clPlus.map(function (code, i) {
      return '<div style="display:flex;gap:6px;align-items:center;margin-top:6px">' +
        '<select data-clp="' + i + '" style="flex:1">' +
        optionsTravaux(code, { sansFournitures: true }) + '</select>' +
        '<button type="button" class="btn-min" data-clpsup="' + i + '" ' +
        'aria-label="Retirer ces travaux">✕</button></div>';
    }).join('');
    majForfait();
  };
  var lire = function () {
    return { travail: $('#cl-trav').value, unite: $('#cl-unite').value,
      travauxPlus: clPlus.slice(),
      quantite: C.nb($('#cl-qte').value), prix: C.nb($('#cl-prix').value),
      nature: natureChoisie(),
      tva: $('#cl-tva').value === '' ? null : C.nb($('#cl-tva').value),
      difficulte: clDiff || null,
      article: $('#cl-art') ? ($('#cl-art').value || null) : (l.article || null),
      note: $('#cl-note').value.trim() };
  };
  /* Ce que la ligne va réellement retirer du stock, dit avant de valider :
     300 plants d'un répulsif dosé à 6 ml, ce sont 1 800 ml qui sortent. */
  /* Une sortie de stock saisie à part existe déjà pour ce chantier — c'est le
     cas des trente-deux repris du carnet, dont la sortie vient du classeur de
     stock. Désigner un produit n'y ajouterait rien : la synchronisation
     refuserait de déduire une seconde fois. Autant fermer le champ et le dire
     avant, plutôt que de le laisser remplir puis d'avertir après coup. */
  var stockAPart = !!(sortieManuelleDe(c) && !sortieAutoDe(c));
  var aideStock = function () {
    var z = $('#cl-art-aide'); if (!z) return;
    if (stockAPart) {
      z.innerHTML = 'Ce chantier a déjà une sortie de stock saisie à part, dans ' +
        '« Stock et fournitures ». Rien d’autre n’en sortira : inutile de désigner ' +
        'un produit ici.';
      return;
    }
    var a = article($('#cl-art').value);
    if (!a) { z.textContent = 'Aucun mouvement de stock pour cette ligne.'; return; }
    var q = C.nb($('#cl-qte').value), d = ST.nb(a.dosage);
    var sort = d > 0 ? ST.arr(q * d, 3) : q;
    var ech = ST.echelleArt(a.unite, [sort, ST.quantite(a)]);
    var lu = function (v) { var n = ST.arr(ST.nb(v) / ech.div, 2); return E.fmt(n, n % 1 ? 2 : 0); };
    z.innerHTML = q > 0
      ? 'Sortira <b>' + lu(sort) + ' ' + esc(ech.court) + '</b> du stock' +
        (d > 0 ? ' (' + E.fmt(q, 0) + ' × ' + E.fmt(d, d % 1 ? 2 : 0) + ' ' +
          esc(ST.courtUniteArt(a.unite)) + ')' : '') +
        ' · il en reste ' + lu(ST.quantite(a)) + ' ' + esc(ech.court) + '.'
      : 'Indiquez une quantité pour voir ce qui sortira du stock.';
  };
  var apercu = function () {
    aideStock();
    var x = lire(), m = C.montantLigne(x);
    var tx = C.tauxLigne(x, c);
    var attendu = C.tauxAttendu(x.travail, c.siren);
    var force = x.tva != null && x.tva !== '';
    var expl = force
      ? 'taux forcé (la nature des travaux donnerait ' + String(attendu).replace('.', ',') + ' %)'
      : (C.estFourniture(x.travail) ? 'fourniture : taux propre, indépendant du SIREN'
        : (C.tauxFixe(x.travail) ? 'ces travaux restent à ' + attendu + ' % même avec un SIREN'
          : (c.siren ? 'taux réduit : client identifié (SIREN)' : 'taux normal : client sans SIREN')));
    if (C.tauxDiscute(x.travail)) expl += ' — taux discuté selon les sources, à confirmer';
    /* Taux différents entre les travaux du forfait : on ne choisit pas pour
       lui, on le lui dit et on attend qu'il tranche. */
    var melange = C.tvaAtrancher(x, c);
    if (melange) {
      expl = 'ces travaux ne portent pas le même taux (' +
        C.tauxDesTravaux(x, c.siren).map(function (t) {
          return String(t).replace('.', ',') + ' %';
        }).join(' et ') + ') — choisissez celui de la ligne';
    }
    $('#cl-apercu').innerHTML = m
      ? '<b class="num" style="font-size:21px">' + eur(m) + '</b> HT' +
        '<div class="muted" style="font-size:12px">TVA ' + String(tx).replace('.', ',') + ' % → ' +
        eur(m * (1 + tx / 100)) + ' TTC<br>' + esc(expl) +
        (x.unite === 'forfait' ? ' · forfait, la quantité n’entre pas dans le calcul' : '') + '</div>'
      : '<span class="muted">Renseignez quantité et prix.</span>';
  };
  /* le choix des travaux propose l'unité habituelle */
  if (stockAPart && $('#cl-art')) $('#cl-art').disabled = true;
  $('#cl-trav').addEventListener('change', function () {
    if (idx == null) { $('#cl-unite').value = C.uniteDe(this.value); }
    majNature(); apercu();
  });
  $('#cl-nature').addEventListener('change', apercu);
  majNature();
  $('#cl-diff').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cldiff]'); if (!b) return;
    clDiff = b.dataset.cldiff ? Number(b.dataset.cldiff) : '';
    $$('#cl-diff .chip').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.cldiff === String(clDiff)));
    });
  });
  $('#cl-ajout').addEventListener('click', function () {
    var pris = C.travauxDeLigne({ travail: $('#cl-trav').value, travauxPlus: clPlus });
    var libre = C.TRAVAUX.filter(function (t) {
      return !t.retire && !t.fourniture && pris.indexOf(t.c) < 0;
    })[0];
    clPlus.push(libre ? libre.c : 'AUTRE');
    renderPlus(); apercu();
  });
  $('#cl-plus').addEventListener('change', function (e) {
    var b = e.target.closest('[data-clp]'); if (!b) return;
    clPlus[+b.dataset.clp] = b.value; apercu();
  });
  $('#cl-plus').addEventListener('click', function (e) {
    var b = e.target.closest('[data-clpsup]'); if (!b) return;
    clPlus.splice(+b.dataset.clpsup, 1); renderPlus(); apercu();
  });
  renderPlus();
  ['#cl-unite', '#cl-qte', '#cl-prix'].forEach(function (s) { $(s).addEventListener('input', apercu); });
  ['#cl-unite', '#cl-tva', '#cl-art'].forEach(function (s) {
    if ($(s)) $(s).addEventListener('change', apercu);
  });
  apercu();
  $('#cl-ok').addEventListener('click', function () {
    var x = lire();
    if (!C.montantLigne(x)) { toast('Quantité et prix attendus.'); return; }
    if (C.tvaAtrancher(x, c)) {
      $('#cl-tva').classList.add('err');
      toast('Ces travaux n’ont pas le même taux de TVA : choisissez celui de la ligne.');
      return;
    }
    c.lignes = c.lignes || [];
    if (idx != null) c.lignes[idx] = x; else c.lignes.push(x);
    c.maj = Date.now();
    sauverChantiers().then(function () { return synchroniserStock(c); }).then(function (r) {
      fermerModale(); renderFiche(); renderCarnet(); renderRendements(); renderFinances();
      renderStockFournitures(); renderAccueil();
      if (r === 'double') {
        toast('Ce chantier a déjà une sortie de stock à part : rien n’a été déduit en double.');
      }
    });
  });
}

/* Un temps saisi sans date se rattache au chantier, jamais à aujourd'hui : un
   chantier repris du carnet et fini l'an dernier verrait sinon son temps
   compté dans la période courante, et fausserait le bilan de l'année. */
function dateParDefautTemps(c) {
  return C.nb(c.dateFin) || C.nb(c.dateFacture) || C.nb(c.debut) || Date.now();
}
function ouvrirTemps(id, quand) {
  var c = chantier(id); if (!c) return;
  modale('Temps passé — ' + C.nomChantier(c),
    '<div class="grille g2">' +
    /* La date était pré-remplie, donc elle avait l'air obligatoire : on ne
       pouvait pas dire « j'ai fait trois journées » sans dire quand, ce qui
       bloquait tous les chantiers repris du carnet. Elle est vide et annoncée
       facultative. Elle l'était déjà techniquement — rien ne le disait.
       Elle était aussi pré-remplie par toISOString(), qui répond en heure de
       Greenwich : avant deux heures du matin, elle proposait la veille. */
    '<div class="champ"><label class="eyebrow" for="ct-date">Date (facultative)</label>' +
    '<input type="date" id="ct-date" value="' + (quand ? versChamp(quand) : '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="ct-act">Activité</label>' +
    '<select id="ct-act"><option value="">— toutes —</option>' +
    (c.lignes || []).map(function (l) { return '<option value="' + l.travail + '">' + C.nomTravail(l.travail) + '</option>'; }).join('') +
    '</select></div>' +
    /* Le sélecteur « journées / heures » a disparu : on notait une heure ici,
       un quart de journée là, et les deux ne se comparaient plus. Tout se
       note en heures, et le nombre d'heures d'une journée se règle une fois
       pour toutes dans les Réglages. */
    '<div class="champ"><label class="eyebrow" for="ct-duree">Combien d’heures ?</label>' +
    '<input type="text" id="ct-duree" class="gros" inputmode="decimal" autocomplete="off"></div>' +
    '<div class="champ"><label class="eyebrow" for="ct-pers">Personnes sur place</label>' +
    '<input type="text" id="ct-pers" inputmode="numeric" value="1"></div>' +
    '<div class="champ"><label class="eyebrow" for="ct-km">Kilomètres</label>' +
    '<input type="text" id="ct-km" inputmode="decimal" placeholder="facultatif"></div>' +
    '</div>' +
    '<label class="ligne-check" style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin:4px 0 0">' +
    '<input type="checkbox" id="ct-sansmoi"> Je n’ai pas travaillé (chantier observé, pour le rendement)</label>' +
    '<p class="muted" style="font-size:12px;margin:7px 0 0">Sans date, le temps est ' +
    'rattaché à la période du chantier — pas à aujourd’hui, qui fausserait le bilan ' +
    'de l’année en cours.</p>' +
    '<div class="chips" id="ct-crans" style="margin:2px 0 11px">' +
    (function () {
      var hj = C.HEURES_JOUR(A.cfg) || 8, out = '';
      for (var h = 1; h <= hj; h++) {
        out += '<button type="button" class="chip" data-cth="' + h + '">' + h + ' h' +
          (h === hj ? '<small>1 j</small>' : '') + '</button>';
      }
      return out;
    })() + '</div>' +
    '<div class="carte2" id="ct-apercu" style="margin:11px 0"></div>' +
    '<div class="btn-rang"><button class="btn primaire" id="ct-ok">Enregistrer</button></div>');
  var apercu = function () {
    var t = { duree: C.nb($('#ct-duree').value), unite: 'h',
      personnes: C.nb($('#ct-pers').value), sansMoi: $('#ct-sansmoi').checked };
    var jh = C.joursSaisie(t, A.cfg), mj = C.mesJours(t, A.cfg);
    $('#ct-apercu').innerHTML = jh
      ? '<b class="num" style="font-size:20px">' +
        C.ditDuree(jh * (C.HEURES_JOUR(A.cfg) || 8), A.cfg) + '</b> en jours-homme' +
        '<div class="muted" style="font-size:12px">dont ' + E.fmt(mj, 2) + ' à moi' +
        (jh > mj ? ' — les autres facturent les leurs' : '') + '</div>'
      : '<span class="muted">Indiquez une durée.</span>';
  };
  ['#ct-duree', '#ct-pers'].forEach(function (s) { $(s).addEventListener('input', apercu); });
  $('#ct-sansmoi').addEventListener('change', apercu);
  $('#ct-crans').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cth]'); if (!b) return;
    $('#ct-duree').value = b.dataset.cth;
    $$('#ct-crans [data-cth]').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x === b));
    });
    apercu();
  });
  apercu();
  $('#ct-ok').addEventListener('click', function () {
    var d = C.nb($('#ct-duree').value);
    if (d <= 0) { toast('Durée attendue.'); return; }
    /* Une saisie de temps est une journée : la pousser dans c.temps la
       faisait disparaître à la prochaine indexation. */
    var quand = versDate($('#ct-date').value) || dateParDefautTemps(c);
    var act = $('#ct-act').value || null;
    var jr = { id: uid(), date: quand, chantier: c.id, lieu: c.foret || '',
      km: C.nb($('#ct-km').value) || 0, nonProd: act ? 0 : d,
      personnes: C.nb($('#ct-pers').value) || 1,
      sansMoi: $('#ct-sansmoi').checked || false, fin: false,
      postes: act ? [{ travaux: act, heures: d, quantite: 0 }] : [] };
    A.journees = A.journees || [];
    A.journees.push(jr);
    indexerJournees();
    c.maj = Date.now();
    Promise.all([sauverJournees(), sauverChantiers()]).then(function () {
      fermerModale(); renderFiche(); renderCarnet(); renderRendements();
      renderCalendrier(); renderAccueil();
      toast('Temps enregistré.');
    });
  });
}

function ouvrirStatut(id) {
  var c = chantier(id); if (!c) return;
  modale('Statut — ' + C.nomChantier(c),
    C.statutsPossibles(c).map(function (s) {
      return '<button class="liste-item" data-setstatut="' + s.c + '" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--trait);cursor:pointer">' +
        '<span class="pastille" style="background:' + COUL_STATUT[s.c] + '"></span>' +
        '<div class="li-c"><b>' + esc(C.nomStatut(s.c, c)) + '</b></div>' +
        (c.statut === s.c ? '<span class="muted">actuel</span>' : '') + '</button>';
    }).join('') +
    (C.aDevis(c) ? '' : '<p class="muted" style="font-size:12px;margin:11px 0 0">' +
      'Ce chantier n’a pas de devis : les étapes de devis n’y figurent pas. ' +
      'Cochez la case dans le bloc « Le devis » pour les faire apparaître.</p>'));
  $('#modale-corps').addEventListener('click', function (e) {
    var b = e.target.closest('[data-setstatut]'); if (!b) return;
    var avant = c.statut;
    c.statut = b.dataset.setstatut;
    if (avant !== c.statut && ['facture', 'paye'].indexOf(c.statut) >= 0) figerDevis(c);
    horodaterStatut(c);
    c.maj = Date.now();
    if (c.statut === 'sansuite') { demanderMotifRefus(c); return; }
    if (c.statut === 'facture' && !c.numeroFacture) { demanderNumeroFacture(c); return; }
    sauverChantiers().then(function () {
      fermerModale(); renderCarnet(); renderFiche(); renderFinances(); renderAccueil();
      toast('Statut : ' + C.nomStatut(c.statut, c) + '.');
    });
  });
}


