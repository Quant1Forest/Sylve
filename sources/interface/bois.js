/* ------------------------------------------------------------ les piles */
function pile(id) {
  return A.piles.filter(function (p) { return p.id === id; })[0] || null;
}
function sauverPiles() {
  A.piles.forEach(function (p) { if (!p.maj) p.maj = Date.now(); });
  return ecrire('bordcub.piles', A.piles);
}
/* ============================================= BOIS DE CHAUFFAGE — interface */

/* Carte schématique hors ligne : points positionnés les uns par rapport aux
   autres, sans fond de carte (inutile sous couvert, et pas de réseau). */
/* Vraie carte, sans bibliothèque : les tuiles OpenStreetMap sont de simples
   images posées côte à côte. Hors réseau elles ne chargent pas — la liste
   des lieux dessous reste, elle, toujours lisible. */
function tuileX(lon, z) { return (lon + 180) / 360 * Math.pow(2, z); }
function tuileY(lat, z) {
  var r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
}
function dessinerCarte(points) {
  var z = $('#lieux-carte'); if (!z) return;
  var pts = points.filter(function (p) { return p.gps && p.gps.lat != null; });
  if (!pts.length) { z.innerHTML = ''; return; }

  var lats = pts.map(function (p) { return p.gps.lat; });
  var lons = pts.map(function (p) { return p.gps.lon; });
  if (A.ici) { lats.push(A.ici.lat); lons.push(A.ici.lon); }
  var minLa = Math.min.apply(null, lats), maxLa = Math.max.apply(null, lats);
  var minLo = Math.min.apply(null, lons), maxLo = Math.max.apply(null, lons);
  var cLa = (minLa + maxLa) / 2, cLo = (minLo + maxLo) / 2;

  var W = z.clientWidth || 320, H2 = 240, T = 256;
  /* On choisit le niveau de zoom le plus serré qui contient encore tout. */
  var niv = 18;
  for (; niv > 3; niv--) {
    var dx = Math.abs(tuileX(maxLo, niv) - tuileX(minLo, niv)) * T;
    var dy = Math.abs(tuileY(minLa, niv) - tuileY(maxLa, niv)) * T;
    if (dx < W - 60 && dy < H2 - 60) break;
  }
  var cx = tuileX(cLo, niv), cy = tuileY(cLa, niv);
  var gauche = cx * T - W / 2, haut = cy * T - H2 / 2;
  var x0 = Math.floor(gauche / T), y0 = Math.floor(haut / T);
  var nx = Math.ceil((gauche + W) / T) - x0, ny = Math.ceil((haut + H2) / T) - y0;
  var max = Math.pow(2, niv), tuiles = '';
  for (var i = 0; i < nx; i++) {
    for (var j = 0; j < ny; j++) {
      var tx = ((x0 + i) % max + max) % max, ty = y0 + j;
      if (ty < 0 || ty >= max) continue;
      tuiles += '<img src="https://tile.openstreetmap.org/' + niv + '/' + tx + '/' + ty +
        '.png" alt="" loading="lazy" style="position:absolute;width:' + T + 'px;height:' + T +
        'px;left:' + ((x0 + i) * T - gauche) + 'px;top:' + ((y0 + j) * T - haut) + 'px">';
    }
  }
  var marque = function (gps, coul, txt) {
    var mx = tuileX(gps.lon, niv) * T - gauche, my = tuileY(gps.lat, niv) * T - haut;
    return '<span style="position:absolute;left:' + mx.toFixed(0) + 'px;top:' + my.toFixed(0) +
      'px;transform:translate(-50%,-100%);pointer-events:none">' +
      '<span style="display:block;width:13px;height:13px;border-radius:50% 50% 50% 0;' +
      'background:' + coul + ';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);' +
      'transform:rotate(-45deg)"></span>' +
      (txt ? '<span style="position:absolute;left:50%;top:15px;transform:translateX(-50%);' +
        'white-space:nowrap;font-size:10px;font-weight:700;color:#22301C;background:rgba(255,255,255,.82);' +
        'padding:0 3px;border-radius:3px">' + xmlEsc(txt) + '</span>' : '') + '</span>';
  };
  var reperes = pts.map(function (p) { return marque(p.gps, '#8A5A2B', p.nom); }).join('') +
    (A.ici ? marque(A.ici, '#1D6FB8', 'vous') : '');

  z.innerHTML = '<div style="position:relative;width:100%;height:' + H2 + 'px;overflow:hidden;' +
    'border-radius:var(--r-s);border:1px solid var(--trait);background:var(--carte2);margin-top:12px">' +
    tuiles + reperes + '</div>' +
    '<p class="muted" style="font-size:11px;margin:5px 0 0">Fond de carte © OpenStreetMap. ' +
    'Il ne se charge qu’avec du réseau ; les positions et les distances, elles, marchent toujours.</p>';
}
function xmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ------------------------------------------------------------- formulaire */
var pEss = [], pBuche = 100, pPct = {}, pCotes = [], pPhotos = [];
var pEtat = 'vert', pPartVert = 70, pHumV = null, pHumS = null;

function formPile(p) {
  var chips = H.ESSENCES.map(function (e) {
    return '<button type="button" class="chip" data-pess="' + e.c + '" aria-pressed="' +
      ((p.essences || []).indexOf(e.c) >= 0) + '">' + esc(e.n) + '</button>';
  }).join('');
  var larg = H.BUCHES.map(function (b) {
    return '<button type="button" class="chip" data-buche="' + b.cm + '" aria-pressed="' +
      (Number(p.buche || 100) === b.cm) + '">' + b.nom + '</button>';
  }).join('');
  return '<div class="champ"><label class="eyebrow" for="p-nom">Nom du tas</label>' +
    '<input type="text" id="p-nom" class="gros" autocomplete="off" value="' + esc(p.nom || '') + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="p-lieu">Lieu</label>' +
    '<input type="text" id="p-lieu" list="lieux-connus" autocomplete="off" ' +
    'placeholder="forêt, parcelle, hangar…" value="' + esc(p.lieu || '') + '">' +
    '<p class="muted" style="font-size:11.5px;margin:4px 0 0">Un nom saisi ici vous sera ' +
    'proposé ensuite, et rejoindra vos lieux dans les réglages.</p></div>' +

    '<label class="eyebrow">Longueur des bûches <span class="muted" style="font-weight:400">(largeur de la pile)</span></label>' +
    '<div class="chips" id="p-buche">' + larg + '</div>' +

    '<label class="eyebrow" style="margin-top:13px;display:block">Essences</label>' +
    '<div class="chips" id="p-ess">' + chips + '</div>' +
    '<div id="p-pourcents"></div>' +

    '<label class="eyebrow" style="margin-top:13px;display:block">Dimensions de la pile (m)</label>' +
    '<div id="p-cotes"></div>' +

    '<div class="carte2" id="p-apercu" style="margin:12px 0"></div>' +

    '<div class="grille g2">' +
    '<label class="eyebrow" style="display:block;margin-top:4px">Ce que j’empile</label>' +
    '<div class="chips" id="p-etat">' +
    [['vert', 'Bois vert'], ['sec', 'Bois mort'], ['mixte', 'Les deux']].map(function (x) {
      return '<button type="button" class="chip" data-etat="' + x[0] + '" aria-pressed="' +
        ((p.etatBois || 'vert') === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>' +
    '<div id="p-bois"></div>' +
    '<div class="champ"><label class="eyebrow" for="p-emp">Mise en pile</label>' +
    '<input type="date" id="p-emp" value="' + (p.empile ? new Date(p.empile).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="p-notes">Note</label>' +
    '<input type="text" id="p-notes" autocomplete="off" value="' + esc(p.notes || '') + '"></div>' +
    '</div>' +

    '<label class="eyebrow" style="margin-top:13px;display:block">Photos <span class="muted" style="font-weight:400">(3 max)</span></label>' +
    '<div id="p-photos"></div>' +

    '<div class="btn-rang" style="margin-top:13px">' +
    '<button class="btn" id="p-gps">' + (p.gps && p.gps.lat != null ? 'Position enregistrée ✓' : 'Enregistrer la position') + '</button>' +
    '<button class="btn primaire" id="p-ok">Valider</button></div>';
}

function renderPourcents() {
  var z = $('#p-pourcents'); if (!z) return;
  if (pEss.length < 2) { z.innerHTML = ''; return; }
  var tot = pEss.reduce(function (t, c) { return t + (H.nb(pPct[c]) || 0); }, 0);
  var ok = Math.round(tot) === 100;
  z.innerHTML = '<div class="carte2" style="margin-top:9px">' +
    '<div class="eyebrow" style="margin-bottom:7px">Proportions ' +
    '<span data-pcttot style="float:right;font-family:var(--mono);color:' +
    (ok ? 'var(--doux)' : '#B4231F') + '">' + Math.round(tot) + ' %</span></div>' +
    pEss.map(function (c) {
      var v = pPct[c] != null ? pPct[c] : '';
      return '<div style="display:flex;align-items:center;gap:9px;margin:6px 0">' +
        '<span style="flex:1;font-size:13px">' + esc(H.nomEssence(c)) + '</span>' +
        '<input type="range" min="0" max="100" step="5" data-pctr="' + c + '" value="' + (H.nb(v) || 0) + '" style="flex:2">' +
        '<input type="text" inputmode="numeric" data-pct="' + c + '" value="' + esc(String(v)) + '" style="width:44px;text-align:right" class="mini"><span style="font-size:12px;color:var(--doux)">%</span></div>';
    }).join('') +
    '<p class="muted" data-pctav style="font-size:11.5px;margin:4px 0 0;color:#B4231F"' +
    (ok ? ' hidden' : '') + '>Le total doit faire 100 %.</p></div>';
}
/* Le total et son avertissement, sans toucher aux champs. */
function majTotalPourcents() {
  var z = $('#p-pourcents'); if (!z) return;
  var tot = pEss.reduce(function (t, c) { return t + (H.nb(pPct[c]) || 0); }, 0);
  var ok = Math.round(tot) === 100;
  var e = z.querySelector('[data-pcttot]');
  if (e) {
    e.textContent = Math.round(tot) + ' %';
    e.style.color = ok ? 'var(--doux)' : '#B4231F';
  }
  var av = z.querySelector('[data-pctav]');
  if (av) av.hidden = ok;
}
/* Les humidités de départ, selon ce qu'on empile. Une seule si la pile est
   homogène, deux si elle est mélangée — ce sont deux teneurs différentes. */
function renderBois() {
  var z = $('#p-bois'); if (!z) return;
  var d = H.depart(A.cfg);
  var champ = function (id, lib, val, repere) {
    return '<div class="champ" style="margin:0"><label class="eyebrow" for="' + id + '">' + lib + '</label>' +
      '<input type="text" id="' + id + '" inputmode="decimal" autocomplete="off" placeholder="' +
      E.fmt(repere, 0) + '" value="' + (val != null ? esc(String(val).replace('.', ',')) : '') + '"></div>';
  };
  var pv = pEtat === 'mixte'
    ? '<div class="carte2" style="margin:9px 0;padding:10px 11px">' +
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px">' +
      '<span>Vert <b class="num" id="p-partvert-n">' + Math.round(pPartVert) + ' %</b></span>' +
      '<span>Mort <b class="num" id="p-partsec-n">' + Math.round(100 - pPartVert) + ' %</b></span></div>' +
      '<input type="range" id="p-partvert" min="0" max="100" step="5" value="' +
      Math.round(pPartVert) + '" style="width:100%"></div>'
    : '';
  z.innerHTML = pv + '<div class="grille g2">' +
    (pEtat !== 'sec' ? champ('p-humi', pEtat === 'mixte' ? 'Humidité du vert (%)' : 'Humidité (%)',
      pHumV, d.vert) : '') +
    (pEtat !== 'vert' ? champ('p-humsec', pEtat === 'mixte' ? 'Humidité du mort (%)' : 'Humidité (%)',
      pHumS, d.sec) : '') +
    '</div>' +
    '<p class="muted" style="font-size:11.5px;margin:5px 0 0">' +
    (pEtat === 'vert' ? 'Laissé vide, le séchage part de ' + E.fmt(d.vert, 0) + ' %.'
      : pEtat === 'sec' ? 'Du bois mort a déjà séché sur pied : le séchage part de ' +
        E.fmt(d.sec, 0) + ' %, la pile sera prête bien plus tôt.'
      : 'La date de séchage suit la part la plus humide : la pile n’est prête que ' +
        'quand son bois vert l’est.') + '</p>';
}
function pctOk() {
  if (pEss.length < 2) return true;
  var tot = pEss.reduce(function (t, c) { return t + (H.nb(pPct[c]) || 0); }, 0);
  return Math.round(tot) === 100;
}

/* Côté A obligatoire, côté B optionnel. Chaque côté : une longueur, plusieurs
   hauteurs moyennées. */
function renderCotes() {
  $('#p-cotes').innerHTML = pCotes.map(function (cote, ci) {
    var titre = pCotes.length > 1
      ? '<div class="eyebrow" style="margin-bottom:5px">Côté ' + (ci === 0 ? 'A' : 'B') +
        '<button type="button" class="btn-min" data-cotedel="' + ci + '" style="float:right">retirer</button></div>'
      : '';
    var lon = '<div class="champ" style="margin-bottom:5px"><input type="text" class="gros" data-cl="' + ci + '" ' +
      'inputmode="decimal" placeholder="longueur de la pile (m)" value="' + esc(cote.lon || '') + '"></div>';
    var hauteurs = (cote.hauteurs || ['']).map(function (h, hi) {
      return '<div class="champ" style="position:relative;margin-bottom:5px">' +
        '<input type="text" class="gros" data-ch="' + ci + '_' + hi + '" inputmode="decimal" placeholder="hauteur ' +
        (cote.hauteurs.length > 1 ? (hi + 1) : '') + ' (m)" value="' + esc(h || '') + '">' +
        (cote.hauteurs.length > 1 ? '<button type="button" class="x-mes" data-hdel="' + ci + '_' + hi + '">✕</button>' : '') + '</div>';
    }).join('');
    return '<div class="cote" style="margin-bottom:10px;padding-bottom:8px' +
      (pCotes.length > 1 && ci === 0 ? ';border-bottom:1px dashed var(--trait)' : '') + '">' +
      titre + lon + hauteurs +
      '<button type="button" class="btn-min" data-hmes="' + ci + '">+ hauteur</button></div>';
  }).join('') +
    (pCotes.length < 2 ? '<button type="button" class="btn-min" id="p-coteb">+ mesurer le côté B (pile irrégulière)</button>' : '');
}
function lireCotes() {
  $$('#p-cotes [data-cl]').forEach(function (i) { pCotes[+i.dataset.cl].lon = i.value; });
  $$('#p-cotes [data-ch]').forEach(function (i) {
    var k = i.dataset.ch.split('_'); pCotes[+k[0]].hauteurs[+k[1]] = i.value;
  });
}
function cotesPropres() {
  return pCotes.map(function (c) {
    return { lon: c.lon, hauteurs: (c.hauteurs || []).filter(function (h) { return H.nb(h) > 0; }) };
  }).filter(function (c) { return H.nb(c.lon) > 0 && c.hauteurs.length; });
}

function renderPhotos() {
  var z = $('#p-photos'); if (!z) return;
  var vign = pPhotos.map(function (ph, i) {
    return '<div style="position:relative;display:inline-block;margin:0 7px 7px 0">' +
      '<img src="' + ph.data + '" style="width:76px;height:76px;object-fit:cover;border-radius:9px;border:1px solid var(--trait)">' +
      '<button type="button" class="x-mes" data-photodel="' + i + '" style="top:3px;right:3px;background:rgba(23,37,31,.7);color:#fff;border-radius:50%">✕</button></div>';
  }).join('');
  z.innerHTML = vign + (pPhotos.length < 3
    ? '<label class="btn btn-min" style="display:inline-block;cursor:pointer">+ photo' +
      '<input type="file" accept="image/*" multiple id="p-photo-in" hidden></label>'
    : '');
}
function ajouterPhoto(file) {
  if (!file || pPhotos.length >= 3) return;
  redimensionnerImage(file, 1000, 0.72).then(function (data) {
    pPhotos.push({ data: data, date: Date.now() });
    renderPhotos();
  }, function () { toast('Photo illisible.'); });
}
/* Réduit et compresse l'image pour ne pas saturer le stockage. */
function redimensionnerImage(file, maxPx, q) {
  return new Promise(function (res, rej) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var r = Math.min(1, maxPx / Math.max(img.width, img.height));
        var w = Math.round(img.width * r), h = Math.round(img.height * r);
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        try { res(cv.toDataURL('image/jpeg', q)); } catch (e) { rej(e); }
      };
      img.onerror = rej; img.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}

function apercuPile() {
  var p = lirePile();
  var st = H.steres(p), poids = H.poidsPile(p), val = H.valeur(p);
  var c = H.coefBuche(p.buche);
  var multi = pCotes.length > 1 || (pCotes[0] && pCotes[0].hauteurs.filter(function (h) { return H.nb(h) > 0; }).length > 1);
  $('#p-apercu').innerHTML = st > 0
    ? '<b class="num" style="font-size:24px">' + E.fmt(st, 2) + '</b> stères' +
    (val ? ' · <b class="num">' + E.fmt(val, 0) + ' €</b>' : '') +
    '<div class="muted" style="font-size:12.5px;margin-top:3px">' +
    E.fmt(H.longueurMoyenne(p), 2) + ' m' + (multi ? ' (moy.)' : '') +
    ' × ' + E.fmt(H.hauteurMoyenne(p), 2) + ' m' + (multi ? ' (moy.)' : '') +
    ' × ' + H.nomBuche(p.buche) +
    (c < 1 ? ' · tassement ÷ ' + String(c).replace('.', ',') : '') +
    (poids ? ' · ~' + E.fmt(poids, 2) + ' t' : '') + '</div>'
    : '<span class="muted">Choisissez la longueur des bûches, puis une longueur et une hauteur.</span>';
}

function lirePile() {
  lireCotes();
  var d = $('#p-emp') && $('#p-emp').value;
  var rep = H.depart(A.cfg);
  var hv = $('#p-humi') ? H.nb($('#p-humi').value) : 0;
  var hs = $('#p-humsec') ? H.nb($('#p-humsec').value) : 0;
  if (pEtat !== 'sec' && !hv) hv = rep.vert;
  if (pEtat !== 'vert' && !hs) hs = rep.sec;
  /* L'humidité qui pilote le séchage est celle de la part la plus humide. */
  var hum = Math.max(pEtat === 'sec' ? 0 : hv, pEtat === 'vert' ? 0 : hs);
  return {
    etatBois: pEtat,
    partVert: pEtat === 'mixte' ? Math.round(pPartVert) : (pEtat === 'vert' ? 100 : 0),
    humiditeVert: pEtat !== 'sec' && hv > 0 ? hv : null,
    humiditeSec: pEtat !== 'vert' && hs > 0 ? hs : null,
    nom: $('#p-nom') ? $('#p-nom').value.trim() : '',
    lieu: $('#p-lieu') ? $('#p-lieu').value.trim() : '',
    essences: pEss.slice(),
    pourcents: pEss.length > 1 ? (function () { var o = {}; pEss.forEach(function (c) { o[c] = H.nb(pPct[c]) || 0; }); return o; })() : {},
    buche: pBuche,
    cotes: cotesPropres(),
    humidite: hum > 0 ? hum : null,
    empile: d ? new Date(d + 'T12:00:00').getTime() : null,
    notes: $('#p-notes') ? $('#p-notes').value.trim() : ''
  };
}

function ouvrirPile(id) {
  var p = id ? pile(id) : { essences: [], buche: 100 };
  if (!p) return;
  pEss = (p.essences || []).slice();
  pBuche = p.buche == null ? 100 : Number(p.buche);
  pPct = {}; if (p.pourcents) Object.keys(p.pourcents).forEach(function (k) { pPct[k] = p.pourcents[k]; });
  pEtat = p.etatBois || 'vert';
  pPartVert = p.partVert != null ? H.nb(p.partVert) : 70;
  pHumV = p.humiditeVert != null ? p.humiditeVert : (p.etatBois ? null : p.humidite);
  pHumS = p.humiditeSec != null ? p.humiditeSec : null;
  var cs = H.cotes(p);
  pCotes = cs.length
    ? cs.map(function (c) { return { lon: c.lon, hauteurs: (c.hauteurs || []).slice() }; })
    : [{ lon: '', hauteurs: [''] }];
  pPhotos = (p.photos || []).slice();
  var gps = p.gps || null;

  modale(id ? 'Modifier la pile' : 'Nouvelle pile', formPile(p));
  renderPourcents(); renderBois(); renderCotes(); renderPhotos(); apercuPile();

  $('#p-buche').addEventListener('click', function (e) {
    var b = e.target.closest('[data-buche]'); if (!b) return;
    pBuche = Number(b.dataset.buche);
    $$('#p-buche .chip').forEach(function (x) { x.setAttribute('aria-pressed', String(Number(x.dataset.buche) === pBuche)); });
    apercuPile();
  });
  $('#p-ess').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pess]'); if (!b) return;
    var c = b.dataset.pess, i = pEss.indexOf(c);
    if (i >= 0) { pEss.splice(i, 1); delete pPct[c]; } else pEss.push(c);
    b.setAttribute('aria-pressed', String(i < 0));
    renderPourcents(); apercuPile();
  });
  /* Reconstruire le bloc à chaque caractère détruisait le champ en cours de
     saisie, et le clavier du téléphone se refermait. On met donc à jour le
     voisin et le total, jamais le champ dans lequel on écrit. */
  $('#p-pourcents').addEventListener('input', function (e) {
    var r = e.target.closest('[data-pctr]'), t = e.target.closest('[data-pct]');
    if (r) {
      pPct[r.dataset.pctr] = H.nb(r.value);
      var jumeau = $('#p-pourcents [data-pct="' + r.dataset.pctr + '"]');
      if (jumeau) jumeau.value = r.value;
    } else if (t) {
      pPct[t.dataset.pct] = H.nb(t.value);
      var curseur = $('#p-pourcents [data-pctr="' + t.dataset.pct + '"]');
      if (curseur) curseur.value = H.nb(t.value) || 0;
    } else return;
    majTotalPourcents();
  });
  $('#p-cotes').addEventListener('input', apercuPile);
  $('#p-etat').addEventListener('click', function (e) {
    var b = e.target.closest('[data-etat]'); if (!b) return;
    pEtat = b.dataset.etat;
    $$('#p-etat .chip').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.etat === pEtat));
    });
    renderBois(); apercuPile();
  });
  $('#p-bois').addEventListener('input', function (e) {
    var pv = e.target.closest('#p-partvert');
    if (pv) {
      pPartVert = H.nb(pv.value);
      var n = $('#p-partvert-n'); if (n) n.textContent = Math.round(pPartVert) + ' %';
      var m = $('#p-partsec-n'); if (m) m.textContent = Math.round(100 - pPartVert) + ' %';
    }
    apercuPile();
  });
  $('#p-cotes').addEventListener('click', function (e) {
    var hmes = e.target.closest('[data-hmes]'), hdel = e.target.closest('[data-hdel]'),
      cdel = e.target.closest('[data-cotedel]'), coteb = e.target.closest('#p-coteb');
    if (hmes) { lireCotes(); pCotes[+hmes.dataset.hmes].hauteurs.push(''); renderCotes(); apercuPile(); }
    else if (hdel) { lireCotes(); var k = hdel.dataset.hdel.split('_'); pCotes[+k[0]].hauteurs.splice(+k[1], 1); renderCotes(); apercuPile(); }
    else if (cdel) { lireCotes(); pCotes.splice(+cdel.dataset.cotedel, 1); renderCotes(); apercuPile(); }
    else if (coteb) { lireCotes(); pCotes.push({ lon: '', hauteurs: [''] }); renderCotes(); apercuPile(); }
  });
  $('#p-photos').addEventListener('change', function (e) {
    var i = e.target.closest('#p-photo-in');
    if (i && i.files) { [].slice.call(i.files).forEach(ajouterPhoto); i.value = ''; }
  });
  $('#p-photos').addEventListener('click', function (e) {
    var d = e.target.closest('[data-photodel]'); if (d) { pPhotos.splice(+d.dataset.photodel, 1); renderPhotos(); }
  });
  var champLieu = $('#p-lieu');
  if (champLieu) champLieu.addEventListener('blur', function () {
    proposerAjoutListe('lieux', champLieu.value.trim());
  });
  $('#p-gps').addEventListener('click', function () {
    var b = this;
    releverPosition(b, function (pt) { gps = pt; b.textContent = 'Position enregistrée ✓'; toast('Position relevée ' + G.fmtPrecision(pt) + '.'); });
  });
  $('#p-ok').addEventListener('click', function () {
    var n = lirePile();
    if (!n.nom) { toast('Donnez un nom au tas.'); return; }
    if (!n.cotes.length) { toast('Indiquez au moins une longueur et une hauteur.'); return; }
    if (!pctOk()) { toast('Les proportions doivent totaliser 100 %.'); return; }
    if (id) {
      var o = pile(id), humAvant = o.humidite;
      Object.keys(n).forEach(function (k) { o[k] = n[k]; });
      delete o.longueur; delete o.hauteur; delete o.sections;
      o.photos = pPhotos.slice(); o.gps = gps; o.maj = Date.now();
      if (n.humidite != null && n.humidite !== humAvant) { o.mesures = o.mesures || []; enregistrerMesure(o, n.humidite, Date.now()); }
    } else {
      n.id = uid(); n.gps = gps; n.photos = pPhotos.slice(); n.mesures = []; n.mouvements = []; n.maj = Date.now();
      if (n.humidite != null) n.mesures.push({ date: n.empile || Date.now(), taux: n.humidite });
      A.piles.push(n);
    }
    sauverPiles().then(function () {
      fermerModale(); renderPiles(); renderStock(); renderLieux(); renderFichiersModule(); renderAccueil();
      toast(id ? 'Pile modifiée.' : 'Pile enregistrée.');
    });
  });
}

/* ------------------------------------------------------------- humidité */
function enregistrerMesure(p, taux, date) {
  p.mesures = p.mesures || [];
  var j = B.jour(date), i = -1;
  for (var k = 0; k < p.mesures.length; k++) if (B.jour(p.mesures[k].date) === j) { i = k; break; }
  if (i >= 0) p.mesures[i] = { date: date, taux: taux };
  else p.mesures.push({ date: date, taux: taux });
}
function ouvrirMesure(id) {
  var p = pile(id); if (!p) return;
  var h = (p.mesures || []).slice().sort(function (a, b) { return b.date - a.date; });
  var e = H.etat(p, Date.now(), A.cfg);
  var estim = (!e.sec && e.secheVers)
    ? '<p class="muted" style="font-size:12px;margin:0 0 10px">Séchage estimé : sec vers ' +
      new Date(e.secheVers).toLocaleDateString('fr-FR') +
      ' (' + (e.methode === 'mesures' ? 'd’après vos relevés' : 'estimation théorique') + ').</p>'
    : '';
  modale('Humidité — ' + (p.nom || 'pile'),
    estim +
    '<div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="m-date">Date</label>' +
    '<input type="date" id="m-date" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="m-taux">Humidité (%)</label>' +
    '<input type="text" id="m-taux" class="gros" inputmode="decimal" autocomplete="off"></div></div>' +
    '<p class="muted" style="font-size:12px;margin:2px 0 10px">Bûche fendue à l’instant, pointes au cœur. ' +
    'Un seul relevé par jour. Plus vous en faites, plus l’estimation de séchage est juste.</p>' +
    '<div class="btn-rang"><button class="btn primaire" id="m-ok">Enregistrer</button></div>' +
    (h.length ? '<p class="muted" style="font-size:12px;margin:14px 0 5px">Relevés (' + h.length + ')</p>' +
      '<div id="m-liste">' + h.map(function (m) {
        return '<div class="liste-item"><div class="li-c"><b>' + E.fmt(m.taux, 1) + ' %</b>' +
          '<small>' + new Date(m.date).toLocaleDateString('fr-FR') + '</small></div>' +
          '<button class="btn-min" data-medit="' + m.date + '">Modifier</button>' +
          '<button class="btn-min" data-mdel="' + m.date + '">Supprimer</button></div>';
      }).join('') + '</div>' : ''));
  $('#m-ok').addEventListener('click', function () {
    var t = H.nb($('#m-taux').value), d = $('#m-date').value;
    if (t <= 0 || t > 100) { toast('Humidité attendue entre 1 et 100 %.'); return; }
    enregistrerMesure(p, t, d ? new Date(d + 'T12:00:00').getTime() : Date.now());
    var dm = H.derniereMesure(p); p.humidite = dm ? dm.taux : null; p.maj = Date.now();
    sauverPiles().then(function () { renderPiles(); renderStock(); renderLieux(); renderAccueil(); ouvrirMesure(id); });
  });
  var liste = $('#m-liste');
  if (liste) liste.addEventListener('click', function (e) {
    var ed = e.target.closest('[data-medit]'), del = e.target.closest('[data-mdel]');
    if (del) {
      var dd = Number(del.dataset.mdel);
      p.mesures = p.mesures.filter(function (m) { return m.date !== dd; });
      var dm = H.derniereMesure(p); p.humidite = dm ? dm.taux : null; p.maj = Date.now();
      sauverPiles().then(function () { renderPiles(); renderStock(); renderLieux(); ouvrirMesure(id); });
    } else if (ed) {
      var m0 = p.mesures.filter(function (x) { return x.date === Number(ed.dataset.medit); })[0];
      if (m0) { $('#m-date').value = new Date(m0.date).toISOString().slice(0, 10); $('#m-taux').value = String(m0.taux).replace('.', ','); $('#m-taux').focus(); }
    }
  });
}

/* ------------------------------------------------------------- sorties
   Attention : le module Stock a sa propre fenêtre de sortie, nommée
   ouvrirSortieStock. Deux fonctions de même nom dans ce fichier et la
   seconde écrase silencieusement la première. */
function ouvrirSortiePile(id) {
  var p = pile(id); if (!p) return;
  var reste = H.restant(p);
  var h = (p.mouvements || []).slice().sort(function (x, y) { return y.date - x.date; });
  /* Le motif commande le reste : vendre demande un acheteur et un prix,
     déplacer demande une destination, rentrer chez soi ne demande rien. */
  var MOTIFS = [
    { c: 'Vendu', n: 'Vendu', prix: true },
    { c: 'Déplacé', n: 'Déplacé', vers: true },
    { c: 'Rentré', n: 'Rentré pour mon chauffage' },
    { c: 'Brûlé', n: 'Brûlé sur place' }
  ];
  modale('Sortie — ' + (p.nom || 'pile'),
    '<p class="muted" style="font-size:12.5px;margin:0 0 10px">Il reste ' +
    E.fmt(reste, 2) + ' stères sur ' + E.fmt(H.steres(p), 2) + '.</p>' +
    '<div class="champ"><label class="eyebrow" for="x-motif">Motif</label>' +
    '<select id="x-motif">' + MOTIFS.map(function (m) {
      return '<option value="' + m.c + '">' + m.n + '</option>';
    }).join('') + '</select></div>' +
    '<label class="eyebrow" style="display:block">Quantité sortie</label>' +
    '<div class="chips" id="x-mode">' +
    '<button type="button" class="chip" data-xmode="st" aria-pressed="true">En stères</button>' +
    '<button type="button" class="chip" data-xmode="dim" aria-pressed="false">Par dimensions</button>' +
    '</div><div id="x-qte" style="margin-top:9px"></div>' +
    '<div id="x-vente"><div class="grille g2">' +
    '<div class="champ"><label class="eyebrow" for="x-qui">Acheteur</label>' +
    '<input type="text" id="x-qui" list="liste-clients" autocomplete="off" placeholder="facultatif"></div>' +
    '<div class="champ"><label class="eyebrow" for="x-prix">Prix total (€)</label>' +
    '<input type="text" id="x-prix" inputmode="decimal" autocomplete="off" placeholder="' +
    (p.prix ? 'défaut ' + E.fmt(reste * H.nb(p.prix), 0) : 'facultatif') + '"></div></div></div>' +
    '<div id="x-depl" hidden>' +
    '<div class="champ"><label class="eyebrow" for="x-lieu">Nouvel emplacement</label>' +
    '<input type="text" id="x-lieu" list="lieux-connus" autocomplete="off" placeholder="hangar, cour…"></div>' +
    '<div class="btn-rang" style="margin:2px 0 4px">' +
    '<button class="btn btn-min" id="x-gps">Relever la position</button>' +
    '<span class="muted" id="x-gps-etat" style="font-size:12px;align-self:center"></span></div>' +
    '<p class="muted" style="font-size:11.5px;margin:0 0 4px">Un déplacement crée une nouvelle pile. ' +
    'La position peut attendre : vous la relèverez en modifiant la pile, une fois sur place.</p></div>' +
    '<div class="champ"><label class="eyebrow" for="x-note">Note</label>' +
    '<input type="text" id="x-note" autocomplete="off" placeholder="facultatif"></div>' +
    '<div class="btn-rang"><button class="btn primaire" id="x-ok">Enregistrer</button>' +
    '<button class="btn" id="x-tout">Tout sortir</button></div>' +
    (h.length ? '<p class="muted" style="font-size:12px;margin:14px 0 5px">Sorties précédentes</p>' +
      h.map(function (m) {
        return '<div class="liste-item"><div class="li-c"><b>' + E.fmt(m.st, 2) + ' st · ' + esc(m.motif || '') + '</b>' +
          '<small>' + new Date(m.date).toLocaleDateString('fr-FR') +
          (m.qui ? ' · ' + esc(m.qui) : '') + (m.prix ? ' · ' + E.fmt(m.prix, 0) + ' €' : '') +
          (m.vers ? ' → ' + esc(m.vers) : '') + '</small></div></div>';
      }).join('') : ''));

  var gpsDepl = null, xMode = 'st';

  /* On sort rarement une pile au stère près : le plus souvent on connaît la
     longueur et la hauteur de ce qu'on a chargé. Le volume s'en déduit avec
     la longueur de bûche de la pile. */
  var renderQte = function () {
    var z = $('#x-qte');
    z.innerHTML = xMode === 'st'
      ? '<div class="champ" style="margin:0"><input type="text" id="x-st" class="gros" ' +
        'inputmode="decimal" autocomplete="off" placeholder="stères"></div>'
      : '<div class="grille g2">' +
        '<div class="champ" style="margin:0"><label class="eyebrow" for="x-lon">Longueur (m)</label>' +
        '<input type="text" id="x-lon" class="gros" inputmode="decimal" autocomplete="off"></div>' +
        '<div class="champ" style="margin:0"><label class="eyebrow" for="x-haut">Hauteur (m)</label>' +
        '<input type="text" id="x-haut" class="gros" inputmode="decimal" autocomplete="off"></div>' +
        '</div><p class="muted" id="x-calc" style="font-size:12px;margin:6px 0 0">' +
        'Bûches de ' + H.nomBuche(p.buche) + '.</p>';
    if (xMode === 'dim') {
      z.addEventListener('input', majCalc);
      majCalc();
    }
  };
  function volumeSaisi() {
    if (xMode === 'st') return H.nb($('#x-st') ? $('#x-st').value : 0);
    var lon = H.nb($('#x-lon') ? $('#x-lon').value : 0);
    var ht = H.nb($('#x-haut') ? $('#x-haut').value : 0);
    if (lon <= 0 || ht <= 0) return 0;
    var c = H.coefBuche(p.buche, A.cfg) || 1;
    return H.arr(lon * ht * (H.nb(p.buche) / 100) / c, 2);
  }
  function majCalc() {
    var e = $('#x-calc'); if (!e) return;
    var v = volumeSaisi();
    e.textContent = v > 0
      ? 'Bûches de ' + H.nomBuche(p.buche) + ' — soit ' + E.fmt(v, 2) + ' stères.'
      : 'Bûches de ' + H.nomBuche(p.buche) + '.';
  }
  renderQte();
  $('#x-mode').addEventListener('click', function (e) {
    var b = e.target.closest('[data-xmode]'); if (!b) return;
    xMode = b.dataset.xmode;
    $$('#x-mode .chip').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.xmode === xMode));
    });
    renderQte();
  });

  var majMotif = function () {
    var m = MOTIFS.filter(function (x) { return x.c === $('#x-motif').value; })[0] || MOTIFS[0];
    $('#x-vente').hidden = !m.prix;
    $('#x-depl').hidden = !m.vers;
  };
  $('#x-motif').addEventListener('change', majMotif);
  majMotif();

  $('#x-gps').addEventListener('click', function () {
    var b = this;
    releverPosition(b, function (pt) { gpsDepl = pt; $('#x-gps-etat').textContent = 'Relevée ' + G.fmtPrecision(pt); });
  });

  var noter = function (st) {
    if (st <= 0) { toast('Quantité attendue.'); return; }
    if (st > reste + 0.01 && !confirm('Vous sortez ' + E.fmt(st, 2) +
      ' stères alors qu’il n’en reste que ' + E.fmt(reste, 2) + '. Continuer ?')) return;
    var motif = $('#x-motif').value;
    var vend = motif === 'Vendu', depl = motif === 'Déplacé';
    var mvt = { date: Date.now(), st: H.arr(st, 2), motif: motif };
    var note = $('#x-note').value.trim(); if (note) mvt.note = note;
    if (vend) {
      var qui = $('#x-qui').value.trim();
      if (qui) { mvt.qui = qui; proposerAjoutListe('clients', qui); }
      var prix = H.nb($('#x-prix').value);
      if (prix > 0) mvt.prix = H.arr(prix, 2);
      else if (p.prix) mvt.prix = H.arr(st * H.nb(p.prix), 2);
    }
    p.mouvements = p.mouvements || [];
    if (depl) {
      var lieu = $('#x-lieu').value.trim();
      var np = {
        id: uid(), nom: (p.nom || 'Pile') + (lieu ? ' — ' + lieu : ' (déplacé)'),
        lieu: lieu, essences: (p.essences || []).slice(),
        pourcents: Object.assign({}, p.pourcents || {}),
        etatBois: p.etatBois || null, partVert: p.partVert != null ? p.partVert : null,
        humiditeVert: p.humiditeVert || null, humiditeSec: p.humiditeSec || null,
        buche: p.buche || 100, cotes: [], humidite: p.humidite || null, prix: p.prix || null,
        empile: p.empile || Date.now(), notes: 'Déplacé depuis ' + (p.nom || 'pile'),
        gps: gpsDepl, photos: [], mesures: (p.mesures || []).slice(), mouvements: [],
        steresManuel: H.arr(st, 2), maj: Date.now()
      };
      A.piles.push(np);
      mvt.vers = np.nom;
      if (lieu) proposerAjoutListe('lieux', lieu);
    }
    p.mouvements.push(mvt); p.maj = Date.now();
    sauverPiles().then(function () {
      fermerModale(); renderPiles(); renderStock(); renderLieux(); renderAccueil(); renderFichiersModule();
      toast(depl ? 'Déplacement enregistré.' : 'Sortie enregistrée.');
    });
  };
  $('#x-ok').addEventListener('click', function () { noter(volumeSaisi()); });
  $('#x-tout').addEventListener('click', function () { noter(reste); });
}

/* --------------------------------------------------------- affichage pile */
function badgeEtat(e) {
  var cls = e.statut === 'presume' ? 'sec' : e.statut;
  var suite = (!e.sec && e.secheVers)
    ? ' · sec vers ' + moisAn(e.secheVers) + (e.methode === 'mesures' ? '' : ' (est.)')
    : '';
  return '<span class="badge ' + cls + '">' + esc(e.texte) + '</span>' +
    (suite ? '<span class="muted" style="font-size:11.5px">' + esc(suite) + '</span>' : '');
}
function moisAn(ts) {
  var d = new Date(ts);
  return ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][d.getMonth()] + ' ' + d.getFullYear();
}

function renderPiles() {
  var z = $('#liste-piles'); if (!z) return;
  var actives = A.piles.filter(function (p) { return H.restant(p) > 0.001; });
  var vides = A.piles.filter(function (p) { return H.restant(p) <= 0.001; });
  var mvts = toutesLesSorties();
  var vue = A.vuePiles || 'stock';

  var opt = function (v, lib, n) {
    return '<option value="' + v + '"' + (vue === v ? ' selected' : '') + '>' + lib + ' (' + n + ')</option>';
  };
  var entete = '<div class="champ" style="max-width:230px;margin-bottom:11px">' +
    '<select id="sel-vuepile">' +
    opt('stock', 'Piles en stock', actives.length) +
    opt('sorties', 'Sorties', mvts.length) +
    opt('vides', 'Piles entièrement sorties', vides.length) +
    '</select></div>';

  if (vue === 'sorties') { z.innerHTML = entete + htmlSorties(mvts); return; }

  var liste = vue === 'vides' ? vides : actives;
  if (!liste.length) {
    z.innerHTML = entete + '<div class="vide"><p>' +
      (vue === 'vides' ? 'Aucune pile entièrement sortie.' : 'Aucune pile en stock. Enregistrez un tas pour suivre son volume et son séchage.') + '</p>' +
      (vue === 'stock' ? '<button class="btn primaire" id="p-vide">Nouvelle pile</button>' : '') + '</div>';
    if ($('#p-vide')) $('#p-vide').addEventListener('click', function () { ouvrirPile(null); });
    return;
  }
  var tri = G.parDistance(liste.slice().sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); }), A.ici, 'gps');
  z.innerHTML = entete + tri.map(function (t) {
    var p = t.o, e = H.etat(p, Date.now(), A.cfg);
    var ess = (p.essences || []).map(function (c) { var pc = p.pourcents && p.pourcents[c]; return H.nomEssence(c) + (pc ? ' ' + Math.round(pc) + '%' : ''); }).join(', ');
    var tot = H.steres(p), res = H.restant(p);
    var vign = (p.photos && p.photos.length)
      ? '<img src="' + p.photos[0].data + '" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex:none" data-photovue="' + p.id + '">'
      : '<span class="pastille" style="background:#8A5A2B;margin-top:3px"></span>';
    return '<div class="liste-item pile-c' + (res <= 0 ? ' epuise' : '') + '">' +
      '<div class="li-h">' + vign +
      '<div class="li-c"><b>' + esc(p.nom || 'Pile') + ' — ' + E.fmt(res, 2) + ' st' +
      (H.valeur(p) ? ' · ' + E.fmt(H.valeur(p), 0) + ' €' : '') + '</b>' +
      '<small>' + esc(ess || 'essences non précisées') + ' · ' + H.nomBuche(p.buche) +
      (H.libelleComposition(p) ? ' · ' + esc(H.libelleComposition(p)) : '') +
      (res < tot ? ' · ' + E.fmt(H.sorti(p), 2) + ' st sortis sur ' + E.fmt(tot, 2) : '') +
      (t.d != null ? ' · ' + esc(G.fmtDistance(t.d)) : '') + '<br>' + badgeEtat(e) + '</small></div></div>' +
      '<div class="li-actions">' +
      '<button class="btn-min" data-mesure="' + p.id + '">Humidité</button>' +
      '<button class="btn-min" data-sortie="' + p.id + '">Sortie</button>' +
      '<button class="btn-min" data-pile="' + p.id + '">Modifier</button>' +
      '<button class="btn-min" data-pilesup="' + p.id + '">Supprimer</button></div></div>';
  }).join('');
}

/* Toutes les sorties, toutes piles confondues, la plus récente en tête. */
function toutesLesSorties() {
  var l = [];
  A.piles.forEach(function (p) {
    (p.mouvements || []).forEach(function (m, i) {
      l.push({ pile: p, idx: i, date: m.date, st: m.st, motif: m.motif, qui: m.qui, prix: m.prix, vers: m.vers });
    });
  });
  return l.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
}

var COUL_MOTIF = { 'Vendu': '#2E7D46', 'Déplacé': '#1D6FB8', 'Rentré': '#8A5A2B', 'Brûlé': '#B4231F' };

function htmlSorties(mvts) {
  if (!mvts.length) {
    return '<div class="vide"><p>Aucune sortie enregistrée. Depuis une pile, ' +
      'le bouton « Sortie » note ce que vous vendez, rentrez, déplacez ou brûlez.</p></div>';
  }
  /* récapitulatif par motif */
  var par = {};
  mvts.forEach(function (m) {
    var k = m.motif || 'Autre';
    if (!par[k]) par[k] = { st: 0, eur: 0, n: 0 };
    par[k].st += H.nb(m.st); par[k].eur += H.nb(m.prix); par[k].n++;
  });
  var recap = '<div class="carte2" style="margin-bottom:11px"><div class="legende">' +
    Object.keys(par).map(function (k) {
      return '<span><i style="background:' + (COUL_MOTIF[k] || '#7A8471') + '"></i>' +
        k + ' ' + E.fmt(H.arr(par[k].st, 2), 2) + ' st' +
        (par[k].eur ? ' · ' + E.fmt(H.arr(par[k].eur, 2), 0) + ' €' : '') + '</span>';
    }).join('') + '</div></div>';

  return recap + mvts.map(function (m) {
    var det = [];
    if (m.qui) det.push(esc(m.qui));
    if (m.prix) det.push(E.fmt(m.prix, 0) + ' €');
    if (m.vers) det.push('→ ' + esc(m.vers));
    return '<div class="liste-item">' +
      '<span class="pastille" style="background:' + (COUL_MOTIF[m.motif] || '#7A8471') + '"></span>' +
      '<div class="li-c"><b>' + E.fmt(m.st, 2) + ' st · ' + esc(m.motif || '') + '</b>' +
      '<small>' + esc(m.pile.nom || 'Pile') + ' · ' + new Date(m.date).toLocaleDateString('fr-FR') +
      (det.length ? ' · ' + det.join(' · ') : '') + '</small></div>' +
      '<button class="btn-min" data-mvtsup="' + m.pile.id + '_' + m.idx + '">Annuler</button></div>';
  }).join('');
}

/* Annule une sortie mal saisie : les stères reviennent dans la pile. */
function annulerSortie(cle) {
  var k = cle.split('_'), p = pile(k[0]), i = Number(k[1]);
  if (!p || !p.mouvements || !p.mouvements[i]) return;
  var m = p.mouvements[i];
  if (!confirm('Annuler cette sortie de ' + E.fmt(m.st, 2) + ' stères (' + (m.motif || '') + ') ?\n\n' +
    'Les stères reviennent dans « ' + (p.nom || 'la pile') + ' ».')) return;
  p.mouvements.splice(i, 1);
  p.maj = Date.now();
  sauverPiles().then(function () {
    renderPiles(); renderStock(); renderLieux(); renderAccueil(); renderFichiersModule();
    toast('Sortie annulée.');
  });
}

function ouvrirPhotos(id) {
  var p = pile(id); if (!p || !p.photos || !p.photos.length) return;
  modale(p.nom || 'Photos',
    p.photos.map(function (ph) {
      return '<div style="margin-bottom:10px"><img src="' + ph.data + '" style="width:100%;border-radius:10px">' +
        '<div class="muted" style="font-size:11.5px;margin-top:3px">' + new Date(ph.date).toLocaleDateString('fr-FR') + '</div></div>';
    }).join(''));
}

function renderStock() {
  var z = $('#stock-corps'); if (!z) return;
  var r = H.repartition(A.piles);
  if (!r.total) {
    var sortiTot = A.piles.reduce(function (s, p) { return s + H.sorti(p); }, 0);
    z.innerHTML = '<div class="vide"><p>' + (A.piles.length
      ? 'Plus rien en stock — ' + E.fmt(H.arr(sortiTot, 2), 2) + ' stères sont sortis. ' +
        'Le détail est dans Piles ▸ Sorties.'
      : 'Pas encore de stock enregistré.') + '</p></div>';
    if ($('#stock-sechage')) $('#stock-sechage').innerHTML = '';
    return;
  }
  var d = H.disponible(A.piles, Date.now(), A.cfg);
  var val = H.valeurStock(A.piles);
  var poidsTot = A.piles.reduce(function (s, p) { return s + H.poidsPile(p); }, 0);
  var COUL = { dur: '#5B3A1E', blanc: '#B9A88A', res: '#2E7D46', mixte: '#7A8471' };
  var parts = ['dur', 'blanc', 'res', 'mixte'].filter(function (k) { return r[k] > 0; });
  z.innerHTML =
    '<div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap">' +
    '<b class="num" style="font-size:34px;letter-spacing:-.02em">' + E.fmt(r.total, 2) + '</b>' +
    '<span class="muted">stères · ' + r.piles + (r.piles > 1 ? ' piles' : ' pile') +
    ' · ~' + E.fmt(poidsTot, 1) + ' t' + (val ? ' · ' + E.fmt(val, 0) + ' €' : '') + '</span></div>' +
    '<div class="jauge">' + parts.map(function (k) { return '<i style="width:' + H.pourcent(r[k], r.total) + '%;background:' + COUL[k] + '"></i>'; }).join('') + '</div>' +
    '<div class="legende">' + parts.map(function (k) { return '<span><i style="background:' + COUL[k] + '"></i>' + H.TYPES[k] + ' ' + H.pourcent(r[k], r.total) + ' % · ' + E.fmt(r[k], 2) + ' st</span>'; }).join('') + '</div>' +
    '<div class="grille g2" style="margin-top:14px">' +
    '<div class="carte2"><b class="num" style="font-size:21px">' + E.fmt(d.pret, 2) + '</b><div class="muted" style="font-size:12px">stères prêts à brûler</div></div>' +
    '<div class="carte2"><b class="num" style="font-size:21px">' + E.fmt(d.attente, 2) + '</b><div class="muted" style="font-size:12px">stères en séchage</div></div></div>';

  var ordre = { vert: 0, sechage: 1, inconnu: 2, presume: 3, sec: 4, tressec: 5 };
  var l = A.piles.filter(function (p) { return H.restant(p) > 0.001; })
    .sort(function (a, b) { return ordre[H.etat(a, Date.now(), A.cfg).statut] - ordre[H.etat(b, Date.now(), A.cfg).statut]; });
  if ($('#stock-sechage')) $('#stock-sechage').innerHTML = l.length ? l.map(function (p) {
    var e = H.etat(p, Date.now(), A.cfg);
    return '<div class="liste-item"><span class="pastille" style="background:#8A5A2B"></span>' +
      '<div class="li-c"><b>' + esc(p.nom || 'Pile') + '</b><small>' + E.fmt(H.restant(p), 2) + ' st · ' + (e.mesure ? 'mesuré' : 'estimé') + '</small></div>' +
      badgeEtat(e) + '</div>';
  }).join('') : '<p class="muted" style="font-size:12.5px">Tout est sorti.</p>';
}

