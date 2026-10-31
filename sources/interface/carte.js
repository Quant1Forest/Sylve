/* ------------------------------------------------- carte des chantiers */
/* Le cadrage : où l'on regarde, et de combien de mètres par pixel. */
function cadreCarte() {
  if (A.carte) return A.carte;
  var pts = chantiersLocalises();
  if (!pts.length) {
    /* Rien de posé : on ouvre sur le milieu de la France, en Mercator —
       46,6° N, 2,4° E — assez large pour la voir entière. */
    return (A.carte = { cx: 267000, cy: 5877000, m: 4000 });
  }
  var xs = [], ys = [];
  pts.forEach(function (p) {
    var l = LB.vers(p.gps.lat, p.gps.lon);
    xs.push(l.x); ys.push(l.y);
  });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  /* Une marge d'un cinquième, et jamais moins de deux kilomètres de large :
     un seul chantier ne doit pas ouvrir sur un zoom absurde. */
  var large = Math.max(maxX - minX, maxY - minY, 2000) * 1.2;
  return (A.carte = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, m: large / 320 });
}
function chantiersLocalises() {
  return (A.chantiers || []).filter(function (c) { return c.gps && c.gps.lat != null; })
    .map(function (c) {
      return { gps: c.gps, nom: C.nomChantier(c), id: c.id, statut: c.statut,
        detail: [c.donneur, C.nomStatut(c.statut, c),
          C.montant(c) ? eur(C.montant(c)) : ''].filter(Boolean).join(' · ') };
    });
}
var carteEnVol = false;
function redessinerCarte() {
  if (carteEnVol) return;
  carteEnVol = true;
  requestAnimationFrame(function () {
    carteEnVol = false;
    renderCarteChantiers();
  });
}
function renderCarteChantiers() {
  var z = $('#carte-svg'); if (!z) return;
  return dessinerCarteChantiers(z);
}
/* Zoomer, c'est changer le nombre de mètres par pixel. Les bornes évitent
   les deux absurdités : la France entière dans un timbre, ou plus fin que la
   photo aérienne n'a de détail. */
function zoomerCarte(f) {
  var v = cadreCarte();
  v.m = Math.min(4000, Math.max(1, v.m * f));
  renderCarteChantiers();
}
/* Le doigt déplace la carte, deux doigts la zooment. On travaille en
   coordonnées du dessin, pas de l'écran : le SVG s'étire à la largeur
   disponible, et un pixel d'écran ne vaut pas un pixel de dessin. */
function pointDessin(ev, svg) {
  var r = svg.getBoundingClientRect();
  if (!r.width) return null;
  return { x: (ev.clientX - r.left) / r.width * 320,
    y: (ev.clientY - r.top) / r.height * 240 };
}
function brancherGestesCarte() {
  var z = $('#carte-svg'); if (!z) return;
  var doigts = {}, depart = null, ecart0 = 0, m0 = 0, bouge = false;
  var svg = function () { return $('#carte-plan'); };
  /* On repart des doigts encore posés à chaque changement : après un
     pincement, le doigt qui reste doit déplacer la carte sans être levé. */
  var reprendre = function () {
    var n = Object.keys(doigts), p = svg();
    depart = null; ecart0 = 0;
    if (!p) return;
    if (n.length === 1) {
      var d = pointDessin({ clientX: doigts[n[0]].x, clientY: doigts[n[0]].y }, p);
      var v = cadreCarte();
      depart = d ? { d: d, cx: v.cx, cy: v.cy } : null;
    } else if (n.length === 2) {
      var a = doigts[n[0]], b = doigts[n[1]];
      ecart0 = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
      m0 = cadreCarte().m;
    }
  };
  z.addEventListener('pointerdown', function (e) {
    if (!svg()) return;
    /* LE DOIGT FANTÔME. La carte se redessine sous le doigt : quand il se
       lève, c'est parfois sur un dessin déjà remplacé, et l'événement ne
       remonte plus jusqu'ici. Le doigt restait compté — un seul doigt
       passait pour un pincement, deux pour trois, et plus rien ne bougeait
       « au bout d'un moment ». Le premier doigt d'un geste repart de zéro. */
    if (e.isPrimary) { doigts = {}; bouge = false; }
    doigts[e.pointerId] = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    /* Et le doigt est retenu par le cadre, qui n'est jamais remplacé : son
       lever arrive ici même quand le dessin a changé entre-temps. */
    try { if (z.setPointerCapture) z.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    reprendre();
  });
  z.addEventListener('pointermove', function (e) {
    var f = doigts[e.pointerId];
    if (!f) return;
    f.x = e.clientX; f.y = e.clientY;
    if (Math.abs(f.x - f.x0) + Math.abs(f.y - f.y0) > 8) bouge = true;
    var n = Object.keys(doigts), p = svg(); if (!p) return;
    var v = cadreCarte();
    if (n.length === 1 && depart) {
      var d = pointDessin(e, p); if (!d) return;
      v.cx = depart.cx - (d.x - depart.d.x) * v.m;
      v.cy = depart.cy + (d.y - depart.d.y) * v.m;
      redessinerCarte();
    } else if (n.length === 2 && ecart0 > 0) {
      var a = doigts[n[0]], b = doigts[n[1]];
      var ec = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
      if (ec > 0) {
        v.m = Math.min(4000, Math.max(1, m0 * ecart0 / ec));
        redessinerCarte();
      }
    }
  });
  var lacher = function (e) {
    if (!doigts[e.pointerId]) return;
    delete doigts[e.pointerId];
    reprendre();
  };
  z.addEventListener('pointerup', lacher);
  z.addEventListener('pointercancel', lacher);
  z.addEventListener('lostpointercapture', lacher);
  /* Un glissement qui s'achève sur un point n'ouvre pas sa fiche, et ne pose
     pas le chantier qu'on est en train de placer. */
  z.addEventListener('click', function (e) {
    if (!bouge) return;
    bouge = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
  /* La molette pour l'ordinateur : le pincement n'y existe pas. */
  z.addEventListener('wheel', function (e) {
    if (!svg()) return;
    e.preventDefault();
    zoomerCarte(e.deltaY > 0 ? 1.2 : 1 / 1.2);
  });
}

/* --- poser un chantier d'un doigt -------------------------------------
   « Ce qui pourrait être bien, c'est de pouvoir sélectionner des points,
   enfin de dire : ce chantier, c'était à tel endroit. » */
function ouvrirPoseCarte() {
  var l = (A.chantiers || []).slice()
    .sort(function (a, b) { return C.dateChantier(b) - C.dateChantier(a); });
  if (!l.length) { toast('Aucun chantier à placer.'); return; }
  modale('Placer un chantier sur la carte',
    '<p class="sous-titre-bloc">Choisissez le chantier, puis appuyez sur la carte ' +
    'à l’endroit voulu. La position remplace celle qu’il portait déjà.</p>' +
    '<div class="champ"><label class="eyebrow" for="pc-ch">Chantier</label>' +
    '<select id="pc-ch">' + l.map(function (c) {
      return '<option value="' + c.id + '">' + esc(C.nomChantier(c)) +
        (c.gps && c.gps.lat != null ? ' — déjà placé' : '') + '</option>';
    }).join('') + '</select></div>' +
    '<div class="btn-rang"><button class="btn primaire" id="pc-ok">Choisir sur la carte</button>' +
    '</div>');
  $('#pc-ok').addEventListener('click', function () {
    A.cartePose = $('#pc-ch').value;
    fermerModale();
    renderCarteChantiers();
    toast('Appuyez sur la carte à l’endroit du chantier.');
  });
}
function poserSurCarte(ev) {
  var c = chantier(A.cartePose); if (!c) { A.cartePose = null; return; }
  var p = $('#carte-plan'); if (!p) return;
  var d = pointDessin(ev, p); if (!d) return;
  var v = cadreCarte();
  var g = LB.depuis(v.cx + (d.x - 160) * v.m, v.cy - (d.y - 120) * v.m);
  c.gps = { lat: C.arr(g.lat, 5), lon: C.arr(g.lon, 5) };
  c.maj = Date.now();
  A.cartePose = null;
  sauverChantiers().then(function () {
    renderCarteChantiers(); renderCarnet(); renderFiche();
    toast(C.nomChantier(c) + ' placé.');
  });
}
function dessinerCarteChantiers(z) {
  var pts = chantiersLocalises();
  var v = cadreCarte();
  var W = 320, H = 240;
  /* Mercator est conforme : localement, l'échelle est la même dans les deux
     sens et tient en un seul nombre. Mais c'est un mètre de carte, pas de
     terrain — au milieu de la France il en vaut 0,69, et c'est LB.facteurSol
     qui le dit. */
  var px = function (x) { return W / 2 + (x - v.cx) / v.m; };
  var py = function (y) { return H / 2 - (y - v.cy) / v.m; };

  /* Les tuiles vont derrière le SVG, dans une couche d'images : un
     <image> SVG par tuile marcherait aussi, mais le navigateur gère bien
     mieux le cache et le chargement paresseux sur de vraies <img>. */
  var ft = fondTuiles(), tuiles = '';
  if (ft) {
    var niv = niveauTuile(v.m, ft.max);
    var T = TOUR_MERCATOR / Math.pow(2, niv);    /* mètres par tuile */
    var demi = TOUR_MERCATOR / 2;
    /* Le coin haut-gauche du cadre, en mètres Mercator. */
    var tg0 = v.cx - W / 2 * v.m, th0 = v.cy + H / 2 * v.m;
    var x0 = Math.floor((tg0 + demi) / T), y0 = Math.floor((demi - th0) / T);
    var nx = Math.ceil((v.cx + W / 2 * v.m + demi) / T) - x0;
    var ny = Math.ceil((demi - (v.cy - H / 2 * v.m)) / T) - y0;
    var cote = T / v.m;                          /* taille d'une tuile à l'écran */
    var lim = Math.pow(2, niv);
    /* Une garde bête mais utile : à un zoom absurde on demanderait des
       milliers de tuiles d'un coup. */
    if (nx * ny <= 60) {
      for (var i = 0; i < nx; i++) {
        for (var j = 0; j < ny; j++) {
          var tx = x0 + i, ty = y0 + j;
          if (tx < 0 || ty < 0 || tx >= lim || ty >= lim) continue;
          /* En CORS : c'est ce qui permet au service worker de garder la
             tuile pour hors réseau sans saturer le quota du téléphone. */
          tuiles += '<img src="' + esc(urlTuile(ft, niv, tx, ty)) + '" alt="" crossorigin="anonymous" ' +
            'loading="lazy" style="position:absolute;width:' + cote.toFixed(2) +
            'px;height:' + cote.toFixed(2) + 'px;left:' +
            ((tx * T - demi - tg0) / v.m).toFixed(2) + 'px;top:' +
            ((th0 - (demi - ty * T)) / v.m).toFixed(2) + 'px">';
        }
      }
    }
  }

  var svg = '<svg id="carte-plan" viewBox="0 0 ' + W + ' ' + H + '" ' +
    'preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;' +
    'height:100%;touch-action:none">';

  pts.forEach(function (p) {
    var l = LB.vers(p.gps.lat, p.gps.lon);
    var x = px(l.x), y = py(l.y);
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
    svg += '<g style="cursor:pointer" data-cartept="' + p.id + '">' +
      '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="6" fill="' +
      (COUL_STATUT[p.statut] || '#7A8471') + '" stroke="#F4EDE2" stroke-width="1.5"/>' +
      '<text x="' + x.toFixed(0) + '" y="' + (y - 9).toFixed(0) + '" font-size="8.5" ' +
      'text-anchor="middle" fill="#22301C">' + xmlEsc(p.nom.slice(0, 18)) + '</text></g>';
  });
  if (A.ici) {
    var li = LB.vers(A.ici.lat, A.ici.lon);
    svg += '<circle cx="' + px(li.x).toFixed(0) + '" cy="' + py(li.y).toFixed(0) +
      '" r="5" fill="#1D6FB8" stroke="#fff" stroke-width="1.5"/>';
  }
  /* Une échelle, sinon on ne sait pas si l'on regarde un canton ou une
     région. Un trait de cinquante pixels, arrondi à un compte rond. */
  var sol = v.m * LB.facteurSol(v.cy);          /* mètres au sol par pixel */
  var metres = sol * 50;
  var rond = Math.pow(10, Math.floor(Math.log(metres) / Math.LN10));
  rond = metres / rond >= 5 ? rond * 5 : metres / rond >= 2 ? rond * 2 : rond;
  /* Le trait se mesure au sol, comme son libellé : divisé par les mètres de
     carte, il annonçait « 500 m » sur trois cent quarante-cinq. */
  svg += '<g><line x1="10" y1="' + (H - 12) + '" x2="' + (10 + rond / sol).toFixed(0) +
    '" y2="' + (H - 12) + '" stroke="#22301C" stroke-width="1.5"/>' +
    '<text x="10" y="' + (H - 16) + '" font-size="8.5" fill="#22301C">' +
    xmlEsc(G.fmtDistance(rond)) + '</text></g>';
  svg += '</svg>';
  /* Les tuiles dessous, le dessin dessus, dans un cadre de proportions
     fixes : sans lui les images et le SVG ne se caleraient pas. */
  z.innerHTML = '<div id="carte-cadre" style="position:relative;width:100%;' +
    'max-width:420px;aspect-ratio:' + W + '/' + H + ';overflow:hidden;' +
    'background:var(--carte2);border-radius:11px;border:1px solid var(--trait)">' +
    tuiles + svg + '</div>';

  var choix = $('#carte-fonds');
  if (choix) {
    var actif = fondTuiles().c;
    choix.innerHTML = FONDS_TUILES.map(function (f) {
      return '<button class="chip' + (f.c === actif ? ' actif' : '') +
        '" data-fondcarte="' + f.c + '">' + esc(f.n) + '</button>';
    }).join('');
  }
  var aide = $('#carte-aide');
  if (aide) {
    aide.textContent = A.cartePose
      ? 'Appuyez sur la carte à l’endroit du chantier.'
      : 'Glissez pour vous déplacer, pincez pour zoomer. La photo et la carte ' +
        'viennent de l’IGN : sans réseau, seuls vos chantiers restent affichés.';
  }

  var tri = G.parDistance(pts, A.ici, 'gps');
  $('#carte-liste').innerHTML = pts.length
    ? tri.map(function (t) {
      var p = t.o;
      return '<div class="liste-item"><span class="pastille" style="background:' +
        (COUL_STATUT[p.statut] || '#7A8471') + '"></span>' +
        '<div class="li-c"><b>' + esc(p.nom) + '</b><small>' + esc(p.detail) + '</small></div>' +
        (t.d != null ? '<span class="pt-dist">' + esc(G.fmtDistance(t.d)) + '</span>' : '') +
        '<button class="btn-min" data-carteouvrir="' + p.id + '">Fiche</button>' +
        '<a class="btn-min" href="' + esc(G.lienNav(p.gps, p.nom)) + '">Y aller</a></div>';
    }).join('')
    : '<div class="vide"><p>Aucun chantier localisé. « Poser un chantier » place ' +
      'un point sur la carte, ou relevez la position depuis la fiche du chantier.</p></div>';
}

/* Un devis qui n'aboutit pas : savoir pourquoi vaut mieux qu'un taux brut. */
/* Le numéro de facture vivait dans l'en-tête, six champs plus haut. Au moment
   de basculer en « Facturé » on ne pensait pas à aller l'y chercher, et le
   chantier restait introuvable par son numéro. On le demande donc là où il se
   remplit vraiment. Jamais imposé : la facture n'est pas toujours éditée. */
function demanderNumeroFacture(c) {
  modale('Facturé — ' + C.nomChantier(c),
    champNumero('F', 'nf-num', c.numeroFacture, 'N° de facture') +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="nf-date">Facturé le</label>' +
    '<input type="date" id="nf-date" value="' + versChamp(c.dateFacture) + '"></div>' +
    /* L'échéance écrite sur la facture vaut mieux qu'un délai général : c'est
       elle qui dit si le client est en retard, et de combien. */
    '<div class="champ"><label class="eyebrow" for="nf-ech">À payer avant le</label>' +
    '<input type="date" id="nf-ech" value="' + versChamp(c.echeancePaiement) + '"></div></div>' +
    '<div class="btn-rang" style="margin-top:4px">' +
    '<button class="btn-min" data-nfech="30">+ 30 jours</button>' +
    '<button class="btn-min" data-nfech="45">+ 45 jours</button>' +
    '<button class="btn-min" data-nfech="60">+ 60 jours</button></div>' +
    '<p class="muted" style="font-size:12px;margin:9px 0 0">C’est par ce numéro que vous ' +
    'retrouverez le chantier depuis la recherche du carnet.</p>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn btn-min" id="nf-passer">Plus tard</button>' +
    '<button class="btn primaire" id="nf-ok">Valider</button></div>');
  brancherNumero('F', 'nf-num', c.id);
  var finir = function (avecNumero) {
    if (avecNumero) {
      c.numeroFacture = lireNumero('F', 'nf-num');
      var d = versDate($('#nf-date').value);
      if (d) c.dateFacture = d;
      c.echeancePaiement = versDate($('#nf-ech').value);
    }
    sauverChantiers().then(function () {
      fermerModale(); renderCarnet(); renderFiche(); renderFinances(); renderAccueil();
      toast(c.numeroFacture ? 'Facturé — n° ' + c.numeroFacture + '.' : 'Statut : Facturé.');
    });
  };
  $('#modale-corps').addEventListener('click', function (e) {
    /* Les délais usuels d'un coup : on part de la date de facture, pas
       d'aujourd'hui — une facture antérieure garde son vrai délai. */
    var raccourci = e.target.closest('[data-nfech]');
    if (raccourci) {
      var base = versDate($('#nf-date').value) || C.minuit(Date.now());
      $('#nf-ech').value = versChamp(base + Number(raccourci.dataset.nfech) * C.JOUR);
      return;
    }
    if (e.target.closest('#nf-ok')) finir(true);
    else if (e.target.closest('#nf-passer')) finir(false);
  });
}

function demanderMotifRefus(c) {
  modale('Pourquoi sans suite ?',
    C.MOTIFS_REFUS.map(function (m) {
      return '<button class="liste-item" data-motif="' + m.c + '" style="width:100%;text-align:left;' +
        'background:none;border:none;border-bottom:1px solid var(--trait);cursor:pointer">' +
        '<div class="li-c"><b>' + m.n + '</b></div></button>';
    }).join('') +
    '<div class="champ" style="margin-top:11px"><label class="eyebrow" for="mr-note">Précision</label>' +
    '<input type="text" id="mr-note" autocomplete="off" value="' + esc(c.noteRefus || '') + '"></div>' +
    '<div class="btn-rang"><button class="btn btn-min" id="mr-passer">Ne pas préciser</button></div>');
  var finir = function () {
    c.noteRefus = $('#mr-note') ? $('#mr-note').value.trim() : '';
    sauverChantiers().then(function () {
      fermerModale(); renderCarnet(); renderFiche(); renderFinances(); renderAccueil();
      toast('Chantier classé sans suite.');
    });
  };
  $('#modale-corps').addEventListener('click', function (e) {
    var b = e.target.closest('[data-motif]');
    if (b) { c.motifRefus = b.dataset.motif; finir(); }
    else if (e.target.closest('#mr-passer')) finir();
  });
}

