/* ============================================================== SAISIE */
var F = {};
function champs() {
  F = {
    num: $('#f-num'), lon: $('#f-lon'), dia: $('#f-dia'), d130: $('#f-d130'),
    refl: $('#f-refl'), refn: $('#f-refn'), parc: $('#f-parc'), obs: $('#f-obs')
  };
}
var selEss = '', selQual = '', selBp = true, essAffichees = [];

function essencesAffichees() {
  var codes = (A.cfg.favoris || []).slice();
  (A.bord ? A.bord.lignes : []).forEach(function (l) { if (l.ess && codes.indexOf(l.ess) < 0) codes.push(l.ess); });
  essAffichees.forEach(function (c) { if (codes.indexOf(c) < 0) codes.push(c); });
  if (selEss && codes.indexOf(selEss) < 0) codes.push(selEss);
  return codes.filter(function (c) { return A.cfg.essences.some(function (e) { return e.code === c; }); });
}
function renderChipsEss() {
  var h = essencesAffichees().map(function (c) {
    return '<button type="button" class="chip" data-ess="' + esc(c) + '" aria-pressed="' + (selEss === c) + '">' +
      esc(c) + '</button>';
  }).join('');
  h += '<button type="button" class="chip plus" id="ess-autres">+ autre essence</button>';
  $('#f-ess').innerHTML = h;
}
function renderChipsQual() {
  var cl = (A.bord && A.bord.meta.classement) || 'Class. Comt';
  var l = A.cfg.qualites[cl] || [];
  $('#f-qual').innerHTML = l.map(function (q) {
    return '<button type="button" class="chip' + (q.code === 'Z' || q.code === 'Z1' ? ' nul' : '') +
      '" data-qual="' + esc(q.code) + '" aria-pressed="' + (selQual === q.code) + '" title="' + esc(q.nom) + '">' +
      esc(q.code) + '<small>' + esc(q.nom) + '</small></button>';
  }).join('');
}
/* Les codes de défaut du type courant. Ils remplissent « Nature du défaut »
   sans l'enfermer : le champ reste libre, et plusieurs codes se cumulent —
   « D + C » est un cas du mémento comtois. En ABCD les notations portent leur
   purge (-2P vaut deux mètres), donc la réfaction se déduit au lieu d'être
   retapée à côté. */
function motifsPoses() {
  return F.refn.value.split('+').map(function (s) { return s.trim(); }).filter(Boolean);
}
function renderChipsMotifs() {
  var z = $('#f-motifs'); if (!z) return;
  var cl = (A.bord && A.bord.meta.classement) || 'Class. Comt';
  var poses = motifsPoses();
  z.innerHTML = E.motifsRefaction(cl).map(function (m) {
    return '<button type="button" class="chip" data-motif="' + esc(m[0]) + '" aria-pressed="' +
      (poses.indexOf(m[0]) >= 0) + '" title="' + esc(m[1]) + '">' + esc(m[0]) +
      '<small>' + esc(m[1]) + '</small></button>';
  }).join('');
}
function basculerMotif(code) {
  var poses = motifsPoses(), i = poses.indexOf(code);
  if (i >= 0) poses.splice(i, 1); else poses.push(code);
  F.refn.value = poses.join(' + ');
  if (A.bord && A.bord.meta.classement === 'Class. Qualitatif') {
    var lg = E.longueurMotifs(F.refn.value, 'Class. Qualitatif') || 0;
    F.refl.value = lg ? String(lg).replace('.', ',') : '';
  }
  renderChipsMotifs(); apercu();
}

function ligneFormulaire() {
  return {
    num: F.num.value.trim(),
    bp: (selBp || F.d130.value.trim()) ? (F.d130.value.trim() ? E.toNum(F.d130.value) : true) : '',
    ess: selEss, qual: selQual,
    lon: F.lon.value.trim(), dia: F.dia.value.trim(),
    parc: F.parc.value.trim(), obs: F.obs.value.trim(),
    refl: F.refl.value.trim(), refn: F.refn.value.trim()
  };
}
function apercu() {
  if (!A.bord) return;
  var l = ligneFormulaire();
  var pret = l.ess && E.toNum(l.lon) > 0 && E.toNum(l.dia) > 0;
  var c = pret ? E.cuber(l, A.bord.meta, A.cfg) : null;
  $('#a-vsur').textContent = c ? E.fmt(c.vsur) : '—';
  $('#a-vsous').textContent = c ? E.fmt(c.vsous) : '—';
  $('#a-vmarch').textContent = c ? E.fmt(c.vmarch) : '—';
  $('#a-cl').textContent = c ? c.clDiam : '—';

  var av = '';
  if (pret) {
    var s = E.seuilsNuls(A.bord, A.cfg), seuil = s[l.ess];
    var nul = E.toNum(l.lon) < s.lon || (seuil !== undefined && E.toNum(l.dia) <= seuil);
    if (nul && l.qual !== 'Z') {
      av = '<div class="avis rouge">Ce billon est hors dimension (longueur &lt; ' + E.fmt(s.lon, 1) +
        ' m ou Ø ≤ ' + E.fmt(seuil, 0) + ' cm) : il devrait être en qualité <b>Z</b>.</div>';
    } else if (!nul && l.qual === 'Z' && seuil !== undefined) {
      av = '<div class="avis rouge">Qualité <b>Z</b> alors que les dimensions dépassent les seuils ' +
        '(longueur ≥ ' + E.fmt(s.lon, 1) + ' m et Ø &gt; ' + E.fmt(seuil, 0) + ' cm).</div>';
    }
    if (E.toNum(l.refl) > E.toNum(l.lon)) {
      av += '<div class="avis rouge">La réfaction dépasse la longueur du billon.</div>';
    }
    /* Les critères de la fiche ONF : ils avertissent, ils n'empêchent pas
       d'enregistrer. Un billon se classe sur la grume, pas sur deux nombres. */
    var crit = E.controlerBillon(l, A.bord.meta, A.cfg);
    if (crit.length) {
      av += '<div class="avis tiede">' + crit.map(function (x) {
        return '<p>' + esc(x) + '</p>';
      }).join('') + '</div>';
    }
  }
  $('#a-avis').innerHTML = av;
}
function renderRuban() {
  if (!A.bord) { $('#ruban').innerHTML = ''; return; }
  var L = A.bord.lignes.slice(-5);
  var h = L.map(function (l) {
    return '<div class="plaq"><em>' + esc(l.ess) + ' ' + esc(l.qual) + '</em>' + esc(l.num) + '</div>';
  }).join('');
  h += '<div class="plaq suiv"><em>à poser</em>' + esc(F.num.value || '—') + '</div>';
  $('#ruban').innerHTML = h;
  var r = $('#ruban'); r.scrollLeft = r.scrollWidth;
}
function renderDernieres() {
  if (!A.bord) return;
  var L = E.cuberTout(A.bord, A.cfg).slice(-6).reverse();
  $('#t-dernieres tbody').innerHTML = L.length ? L.map(function (l) {
    return '<tr><td class="g num">' + esc(l.num) + '</td><td class="g">' + esc(l.ess) + '</td>' +
      '<td class="g">' + esc(l.qual) + '</td><td class="num">' + E.fmt(E.toNum(l.lon), 1) + ' m</td>' +
      '<td class="num">' + E.fmt(E.toNum(l.dia), 0) + '</td><td class="num"><b>' + E.fmt(l.c.vmarch) + '</b></td></tr>';
  }).join('') : '<tr><td class="g muted" colspan="6">Aucun billon saisi.</td></tr>';
}
function prochainNumero(memeGrume) {
  var qualitatif = A.bord.meta.classement === 'Class. Qualitatif';
  var L = A.bord.lignes;
  if (!L.length) return qualitatif ? '1.1' : '1';
  return E.numSuivant(L[L.length - 1].num, qualitatif, !!memeGrume);
}
function viderFormulaire(memeGrume) {
  A.edition = null; A.memeGrume = !!memeGrume;
  F.num.value = prochainNumero(memeGrume);
  F.lon.value = ''; F.dia.value = ''; F.d130.value = '';
  F.refl.value = ''; F.refn.value = ''; F.obs.value = '';
  if (!F.parc.value) F.parc.value = A.bord.meta.parcelles || '';
  selQual = '';
  selBp = !memeGrume;
  $('#f-bp').setAttribute('aria-pressed', String(selBp));
  $('#f-bp').disabled = !!memeGrume;
  $('#f-annuler').hidden = true;
  $('#f-valider').textContent = 'Enregistrer';
  renderChipsEss(); renderChipsQual(); renderChipsMotifs(); apercu(); renderRuban();
  F.lon.focus();
}
function chargerLigne(i) {
  var l = A.bord.lignes[i];
  A.edition = i; A.memeGrume = false;
  F.num.value = l.num || '';
  selEss = l.ess || ''; selQual = l.qual || '';
  F.lon.value = l.lon === '' || l.lon == null ? '' : String(l.lon).replace('.', ',');
  F.dia.value = l.dia === '' || l.dia == null ? '' : String(l.dia).replace('.', ',');
  selBp = l.bp !== '' && l.bp != null;
  F.d130.value = (typeof l.bp === 'number') ? String(l.bp).replace('.', ',') : '';
  F.refl.value = l.refl === '' || l.refl == null ? '' : String(l.refl).replace('.', ',');
  F.refn.value = l.refn || ''; F.parc.value = l.parc || ''; F.obs.value = l.obs || '';
  $('#f-bp').setAttribute('aria-pressed', String(selBp));
  $('#f-bp').disabled = false;
  if (F.refl.value || F.refn.value || F.obs.value) $('#f-plus').open = true;
  $('#f-annuler').hidden = false;
  $('#f-valider').textContent = 'Enregistrer les modifications';
  renderChipsEss(); renderChipsQual(); renderChipsMotifs(); apercu(); renderRuban();
  aller('saisie'); F.lon.focus();
}
function valider(l) {
  var pb = [];
  if (!l.num) pb.push(['f-num', 'le n° de plaquette']);
  if (!l.ess) pb.push([null, "l'essence"]);
  if (!l.qual) pb.push([null, 'la qualité']);
  if (!(E.toNum(l.lon) > 0)) pb.push(['f-lon', 'la longueur']);
  if (!(E.toNum(l.dia) > 0)) pb.push(['f-dia', 'le diamètre']);
  $$('.gros').forEach(function (i) { i.classList.remove('err'); });
  pb.forEach(function (p) { if (p[0]) $('#' + p[0]).classList.add('err'); });
  if (pb.length) { toast('Il manque ' + pb.map(function (p) { return p[1]; }).join(', ') + '.'); return false; }
  return true;
}
function enregistrer(suite) {   // suite : 'billon' | 'grume' | null
  if (!A.bord) { toast('Créez d’abord un bordereau.'); return; }
  var l = ligneFormulaire();
  if (!valider(l)) return;
  if (A.edition !== null) {
    A.bord.lignes[A.edition] = l;
    toast('Billon ' + l.num + ' modifié.');
  } else {
    A.bord.lignes.push(l);
  }
  sauver(); majBandeau(); renderDernieres();
  if (suite) viderFormulaire(suite === 'billon');
  else viderFormulaire(false);
  if (A.vue === 'bordereau') renderBordereau();
}

/* =========================================================== BORDEREAU */
var COLS = [
  ['num', 'N°', 'g'], ['bp', 'BP / Ø1,30', 'num'], ['ess', 'Ess.', 'g'], ['qual', 'Qual', 'g'],
  ['lon', 'Long.', 'num'], ['dia', 'Ø méd.', 'num'], ['parc', 'Parcelle', 'g'], ['obs', 'Date / obs', 'g'],
  ['refl', 'Réfact°', 'num'], ['refn', 'Défaut', 'g'],
  ['vsur', 'VolBûch sur', 'num'], ['vsous', 'VolBûch sous', 'num'], ['vmarch', 'VolMarch sous', 'num'],
  ['cld', 'Classe Ø sous', 'g'], ['clm', 'Classe mini', 'g']
];
function renderBordereau() {
  if (!A.bord) { $('#t-bordereau').innerHTML = ''; $('#b-stats').innerHTML = ''; return; }
  var L = E.cuberTout(A.bord, A.cfg);
  var S = E.synthese(A.bord, A.cfg), B = E.syntheseBucheron(A.bord, A.cfg);
  $('#b-stats').innerHTML =
    stat('Billons', S.nbBillons, 0) + stat('Grumes', S.nbGrumes, 0) + stat('Plaquettes', S.nbPlaq, 0) +
    stat('Vol. bûcheron sur', B.vsur) + stat('Vol. bûcheron sous', B.vsous) + stat('Vol. marchand', S.totalGen);

  var f = A.filtre.toLowerCase();
  var vis = L.map(function (l, i) { return { l: l, i: i }; }).filter(function (o) {
    if (!f) return true;
    return [o.l.num, o.l.ess, o.l.qual, o.l.parc, o.l.obs, o.l.refn].join(' ').toLowerCase().indexOf(f) >= 0;
  });
  var h = '<thead><tr>' + COLS.map(function (c) {
    return '<th class="' + (c[2] === 'g' ? 'g' : 'num') + '">' + esc(c[1]) + '</th>';
  }).join('') + '<th></th></tr></thead><tbody>';
  if (!vis.length) h += '<tr><td class="g muted" colspan="16">Aucun billon' + (f ? ' ne correspond au filtre.' : ' saisi.') + '</td></tr>';
  vis.forEach(function (o) {
    var l = o.l;
    h += '<tr' + (l.qual === 'Z' || l.qual === 'Z1' ? ' class="nulle"' : '') + '>' +
      td(l.num, 'g') + td(l.bp === true ? '✓' : (l.bp === '' || l.bp == null ? '' : E.fmt(E.toNum(l.bp), 0)), 'num') +
      td(l.ess, 'g') + td(l.qual, 'g') +
      td(E.fmt(E.toNum(l.lon), 2), 'num') + td(E.fmt(E.toNum(l.dia), 0), 'num') +
      td(l.parc, 'g') + td(l.obs, 'g') +
      td(l.refl === '' || l.refl == null ? '' : E.fmt(E.toNum(l.refl), 2), 'num') + td(l.refn, 'g') +
      td(E.fmt(l.c.vsur), 'num') + td(E.fmt(l.c.vsous), 'num') + '<td class="num"><b>' + E.fmt(l.c.vmarch) + '</b></td>' +
      td(l.c.clDiam, 'g') + td(l.c.clMini, 'g') +
      '<td class="act no-print"><button class="btn-min" data-mod="' + o.i + '">Modifier</button> ' +
      '<button class="btn-min" data-sup="' + o.i + '">Suppr.</button></td></tr>';
  });
  h += '</tbody>';
  $('#t-bordereau').innerHTML = h;
}
function td(v, cl) { return '<td class="' + (cl === 'g' ? 'g' : 'num') + '">' + esc(v == null ? '' : v) + '</td>'; }
function stat(lab, val, dec) {
  return '<div class="stat"><span class="eyebrow">' + esc(lab) + '</span><b class="num">' +
    E.fmt(val, dec === undefined ? 2 : dec) + '</b></div>';
}

/* =========================================================== SYNTHESES */
function renderSyntheses() {
  var c = $('#s-contenu');
  if (!A.bord || !A.bord.lignes.length) {
    c.innerHTML = '<div class="carte"><div class="vide"><p>Aucun billon saisi : les synthèses sont vides.</p></div></div>';
    return;
  }
  c.innerHTML = ({
    synthese: tblSynthese, financiere: tblFinanciere, bucheron: tblBucheron, martelage: tblMartelage
  }[A.sousVue])();
  if (A.sousVue === 'financiere') brancherPrix();
}
function enteteHTML() {
  var m = A.bord.meta;
  return '<div class="imp-tete"><h1>Bordereau de cubage — article ' + esc(m.article || '') + '</h1>' +
    '<dl><dt>Client</dt><dd>' + esc(m.client) + '</dd><dt>Mesures</dt><dd>' + esc(m.mesures === 'sous' ? 'sous écorce' : 'sur écorce') + '</dd>' +
    '<dt>Forêt</dt><dd>' + esc(m.foret) + '</dd><dt>Plaquettes</dt><dd>' + esc(m.plaqCouleur) + '</dd>' +
    '<dt>Parcelle(s)</dt><dd>' + esc(m.parcelles) + '</dd><dt>Type</dt><dd>' + esc(m.classement) + '</dd>' +
    '<dt>ETF</dt><dd>' + esc(m.etf) + '</dd><dt>Date</dt><dd>' + esc(m.date || '') + '</dd></dl></div>';
}
function tblSynthese() {
  var S = E.synthese(A.bord, A.cfg);
  var h = '<div class="carte"><h2>Synthèse — volumes marchands sous écorce</h2><div class="tab-boite"><table><thead>' +
    '<tr><th class="g">Essence</th><th>Grumes</th><th>Billons</th><th class="g">Qual.</th>';
  E.CLASSES_DIAM.forEach(function (cl) { h += '<th colspan="2">' + cl + '</th>'; });
  h += '<th>Vol. qualité</th><th>%</th><th>Vol. essence</th><th>VAM</th></tr>' +
    '<tr><th class="g"></th><th></th><th></th><th class="g"></th>';
  E.CLASSES_DIAM.forEach(function () { h += '<th>nb</th><th>m³</th>'; });
  h += '<th>m³</th><th></th><th>m³</th><th>m³</th></tr></thead><tbody>';
  S.lignes.forEach(function (l) {
    if (l.type === 'detail') {
      h += '<tr>' + td(l.ess, 'g') + td('', 'num') + td(E.fmt(l.nbBillons, 0), 'num') + td(l.qual, 'g');
      l.cells.forEach(function (c) {
        h += td(c.nb || '', 'num') + td(c.vol ? E.fmt(c.vol) : '', 'num');
      });
      h += td(E.fmt(l.volQual), 'num') + td(E.fmt(l.pct * 100, 1) + ' %', 'num') + td('', 'num') + td('', 'num') + '</tr>';
    } else {
      h += '<tr class="tot">' + td('Total ' + l.ess, 'g') + td(E.fmt(l.nbGrumes, 0), 'num') + td(E.fmt(l.nbBillons, 0), 'num') +
        td('', 'g') + Array(E.CLASSES_DIAM.length * 2 + 1).join('<td></td>') + '<td></td><td></td>' +
        td(E.fmt(l.volEss), 'num') + td(E.fmt(l.vam), 'num') + '</tr>';
    }
  });
  h += '<tr class="tot-gen">' + td('Total général', 'g') + td(E.fmt(S.nbGrumes, 0), 'num') + td(E.fmt(S.nbBillons, 0), 'num') +
    td('', 'g') + Array(E.CLASSES_DIAM.length * 2 + 1).join('<td></td>') + '<td></td><td></td>' +
    td(E.fmt(S.totalGen), 'num') + td(S.nbGrumes ? E.fmt(S.totalGen / S.nbGrumes) : '', 'num') + '</tr>';
  h += '</tbody></table></div><p class="muted" style="font-size:12.5px;margin:9px 0 0">' +
    'Nombre de plaquettes dans le bordereau : <b>' + E.fmt(S.nbPlaq, 0) + '</b></p></div>';
  return h;
}
function tblBucheron() {
  var B = E.syntheseBucheron(A.bord, A.cfg);
  var h = '<div class="carte"><h2>Bûcheron</h2><div class="tab-boite"><table><thead><tr>' +
    '<th class="g">Essence</th><th>Nb tiges</th><th class="g">Qualité</th>' +
    '<th>VolBûch sur</th><th>VolBûch sous</th><th>VolMarch sous</th></tr></thead><tbody>';
  B.lignes.forEach(function (l) {
    if (l.type === 'detail') {
      h += '<tr>' + td(l.ess, 'g') + td('', 'num') + td(l.qual, 'g') +
        td(E.fmt(l.vsur), 'num') + td(E.fmt(l.vsous), 'num') + td(E.fmt(l.vmarch), 'num') + '</tr>';
    } else {
      h += '<tr class="tot">' + td('Total ' + l.ess, 'g') + td(E.fmt(l.nbGrumes, 0), 'num') + td('', 'g') +
        td(E.fmt(l.vsur), 'num') + td(E.fmt(l.vsous), 'num') + td(E.fmt(l.vmarch), 'num') + '</tr>';
    }
  });
  h += '<tr class="tot-gen">' + td('Total général', 'g') + td(E.fmt(B.nbGrumes, 0), 'num') + td('', 'g') +
    td(E.fmt(B.vsur), 'num') + td(E.fmt(B.vsous), 'num') + td(E.fmt(B.vmarch), 'num') + '</tr></tbody></table></div></div>';
  return h;
}
function tblMartelage() {
  var M = E.syntheseMartelage(A.bord, A.cfg);
  if (!M.total) {
    return '<div class="carte"><h2>Martelage</h2><div class="vide"><p>Aucun diamètre à 1,30 m saisi.<br>' +
      'Renseignez le champ « Ø à 1,30 m » lors de la saisie pour obtenir la fiche de martelage.</p></div></div>';
  }
  var utiles = E.CLASSES_MART.filter(function (c, i) {
    return M.cells[i] > 0 || M.lignes.some(function (l) { return l.cells[i] > 0; });
  });
  var idx = utiles.map(function (c) { return E.CLASSES_MART.indexOf(c); });
  var h = '<div class="carte"><h2>Martelage — tiges par classe de Ø à 1,30 m</h2><div class="tab-boite"><table><thead><tr>' +
    '<th class="g">Parcelle</th><th class="g">Ess.</th>' + utiles.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
    '<th>Total</th></tr></thead><tbody>';
  M.lignes.forEach(function (l) {
    var t = l.type === 'total';
    h += '<tr' + (t ? ' class="tot"' : '') + '>' + td(t ? 'Total ' + l.parc : l.parc, 'g') + td(t ? '' : l.ess, 'g') +
      idx.map(function (i) { return td(l.cells[i] || '', 'num'); }).join('') + td(E.fmt(l.total, 0), 'num') + '</tr>';
  });
  h += '<tr class="tot-gen">' + td('Total général', 'g') + td('', 'g') +
    idx.map(function (i) { return td(M.cells[i] || '', 'num'); }).join('') + td(E.fmt(M.total, 0), 'num') +
    '</tr></tbody></table></div></div>';
  return h;
}
function tblFinanciere() {
  var F2 = E.syntheseFinanciere(A.bord, A.cfg);
  var h = '<div class="carte"><h2>Volumes par classe</h2><div class="tab-boite"><table><thead><tr>' +
    '<th class="g">Essence</th><th class="g">Qual.</th>' +
    E.CLASSES_DIAM.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
    '<th>Vol. qualité</th><th>Vol. essence</th><th>Montant</th><th>PU calculé</th></tr></thead><tbody>';
  F2.lignes.forEach(function (l) {
    if (l.type === 'detail') {
      h += '<tr>' + td(l.ess, 'g') + td(l.qual, 'g') +
        l.cells.map(function (v) { return td(v ? E.fmt(v) : '', 'num'); }).join('') +
        td(E.fmt(l.volQual), 'num') + td('', 'num') + td('', 'num') + td('', 'num') + '</tr>';
    } else {
      h += '<tr class="tot">' + td('Total ' + l.ess, 'g') + td('', 'g') +
        Array(E.CLASSES_DIAM.length + 1).join('<td></td>') + td('', 'num') +
        td(E.fmt(l.volEss), 'num') + td(l.montant ? E.fmt(l.montant) + ' €' : '', 'num') +
        td(l.pu ? E.fmt(l.pu) + ' €' : '', 'num') + '</tr>';
    }
  });
  h += '<tr class="tot-gen">' + td('Total général', 'g') + td('', 'g') +
    Array(E.CLASSES_DIAM.length + 1).join('<td></td>') + td('', 'num') + td(E.fmt(F2.volGen), 'num') +
    td(F2.montantGen ? E.fmt(F2.montantGen) + ' €' : '', 'num') +
    td(F2.puGen ? E.fmt(F2.puGen) + ' €' : '', 'num') + '</tr></tbody></table></div></div>';

  // grille de prix
  h += '<div class="carte no-print"><h2>Prix unitaires (€/m³ sous écorce)</h2>' +
    '<p class="muted" style="font-size:12.5px;margin:-4px 0 10px">Renseignez le niveau qui vous arrange : ' +
    'par classe de diamètre, par qualité, ou un prix unique par essence. Le montant retenu est le plus élevé des trois.</p>' +
    '<div class="tab-boite"><table><thead><tr><th class="g">Essence</th><th class="g">Qual.</th>' +
    E.CLASSES_DIAM.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
    '<th>PU qualité</th><th>PU essence</th><th>Niveau retenu</th></tr></thead><tbody>';
  var prix = A.bord.prix || (A.bord.prix = {});
  F2.lignes.forEach(function (l) {
    if (l.type === 'detail') {
      var p = prix[l.ess + '|' + l.qual] || {};
      h += '<tr>' + td(l.ess, 'g') + td(l.qual, 'g') +
        E.CLASSES_DIAM.map(function (c) {
          return '<td><input type="text" inputmode="decimal" class="pu" style="width:64px;padding:4px 5px;text-align:right" ' +
            'data-k="' + esc(l.ess + '|' + l.qual) + '" data-cl="' + esc(c) + '" value="' +
            esc((p.cl || {})[c] == null ? '' : (p.cl || {})[c]) + '"></td>';
        }).join('') +
        '<td><input type="text" inputmode="decimal" class="pu" style="width:70px;padding:4px 5px;text-align:right" ' +
        'data-k="' + esc(l.ess + '|' + l.qual) + '" data-q="1" value="' + esc(p.qual == null ? '' : p.qual) + '"></td>' +
        '<td></td><td></td></tr>';
    } else {
      var pe = prix[l.ess + '|*'] || {};
      h += '<tr class="tot">' + td('Total ' + l.ess, 'g') + td('', 'g') +
        Array(E.CLASSES_DIAM.length + 2).join('<td></td>') +
        '<td><input type="text" inputmode="decimal" class="pu" style="width:70px;padding:4px 5px;text-align:right" ' +
        'data-k="' + esc(l.ess + '|*') + '" data-e="1" value="' + esc(pe.ess == null ? '' : pe.ess) + '"></td>' +
        td(l.niveau, 'g') + '</tr>';
    }
  });
  h += '</tbody></table></div></div>';
  return h;
}
function brancherPrix() {
  $$('.pu').forEach(function (i) {
    i.addEventListener('change', function () {
      var k = i.dataset.k, p = A.bord.prix[k] || (A.bord.prix[k] = {});
      var v = i.value.trim();
      if (i.dataset.cl) { p.cl = p.cl || {}; if (v) p.cl[i.dataset.cl] = E.toNum(v); else delete p.cl[i.dataset.cl]; }
      else if (i.dataset.q) { if (v) p.qual = E.toNum(v); else delete p.qual; }
      else { if (v) p.ess = E.toNum(v); else delete p.ess; }
      sauver(); renderSyntheses();
    });
  });
}

/* ============================================================ FICHIERS */
/* Les quelques codes de qualité d'un type, pour qu'on sache ce qu'on choisit
   avant de l'avoir choisi. Z et Z1 sont dans les quatre listes : les montrer
   n'apprendrait rien. */
function codesClassement(cl, max) {
  var l = (A.cfg.qualites[cl] || []).filter(function (q) { return q.code !== 'Z' && q.code !== 'Z1'; });
  return l.slice(0, max).map(function (q) { return '<i>' + esc(q.code) + '</i>'; }).join('') +
    (l.length > max ? '<i>…</i>' : '');
}

var PICTO_CLASSEMENT = {
  'Class. Comt': '<path d="M3 12h18M6 9.5v5M18 9.5v5M10.5 10.5v3M14 10.5v3"/>',
  'Class. Qualitatif': '<path d="M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M9 16v4"/>',
  'Class. Chablis': '<path d="M4 16.5 9 8l4 6 3-4.5 4 7z"/><path d="M3 20h18"/>',
  'Sans Class.': '<circle cx="12" cy="12" r="8"/><path d="M8.5 12h7"/>'
};
var RESUME_CLASSEMENT = {
  'Class. Comt': 'Sapin et épicéa. Longueur bûcheron, Ø médian à mi-longueur, ' +
    'réfactions en mètres sur les défauts.',
  'Class. Qualitatif': 'La grume se découpe en billons fictifs, classés de A à D. ' +
    'Sylve prévient quand la classe annoncée ne tient pas ses critères.',
  'Class. Chablis': 'Bois versés, scolytés, secs',
  'Sans Class.': 'Cuber sans trier la qualité'
};

/* L'écran d'arrivée du module. Le type de cubage se choisissait au huitième
   champ de l'en-tête, derrière un bouton qui fabriquait un comtois sans le
   dire : le manque était de visibilité, pas d'écran — d'où le choix posé ici
   plutôt qu'un cinquième onglet qui aurait redit la liste des bordereaux. */
function renderChoixCubage() {
  var z = $('#cub-choix'); if (!z) return;
  var h = '';
  if (A.bord) {
    var m = A.bord.meta, n = A.bord.lignes.length;
    var S = E.synthese(A.bord, A.cfg);
    h += '<span class="eyebrow">Reprendre</span>' +
      '<button class="cub-reprise" id="cub-reprendre" style="margin-top:6px">' +
      '<span class="pastille" style="background:' +
      (COULEURS[String(m.plaqCouleur || '').toLowerCase()] || '#2E4A3C') + '"></span>' +
      '<span class="txt"><b>' +
      esc((m.article ? 'Art. ' + m.article + ' — ' : '') + (m.foret || 'Sans forêt')) + '</b>' +
      '<small>' + esc(E.nomClassement(m.classement)) + ' · ' + n + ' billon' + (n > 1 ? 's' : '') +
      ' · <span class="num">' + E.fmt(S.totalGen, 2) + '</span> m³</small></span>' +
      '<span class="fleche">›</span></button>' +
      '<div class="cub-sep"><span class="eyebrow">ou commencer un bordereau</span></div>';
  } else {
    h += '<span class="eyebrow" style="margin-bottom:7px">Commencer un bordereau</span>';
  }
  ['Class. Comt', 'Class. Qualitatif'].forEach(function (cl) {
    h += '<button class="tuile cub-tuile" data-nouveau="' + esc(cl) + '">' +
      '<span class="ic rond"><svg viewBox="0 0 24 24" class="pic" aria-hidden="true">' +
      PICTO_CLASSEMENT[cl] + '</svg></span>' +
      '<span class="txt"><b>' + esc(E.nomClassement(cl)) + '</b>' +
      '<small>' + esc(RESUME_CLASSEMENT[cl]) + '</small>' +
      '<span class="cub-codes">' + codesClassement(cl, 7) + '</span></span></button>';
  });
  h += '<div class="cub-autres">';
  ['Class. Chablis', 'Sans Class.'].forEach(function (cl) {
    h += '<button class="cub-mini" data-nouveau="' + esc(cl) + '">' +
      '<b>' + esc(E.nomClassement(cl)) + '</b>' +
      '<small>' + esc(RESUME_CLASSEMENT[cl]) + '</small></button>';
  });
  h += '</div>';
  z.innerHTML = h;
}

function renderFichiers() {
  renderChoixCubage();
  var h = A.index.length ? '' : '<div class="vide"><p>Aucun bordereau enregistré.</p></div>';
  A.index.slice().sort(function (a, b) { return (b.maj || 0) - (a.maj || 0); }).forEach(function (b) {
    var m = b.meta || {};
    h += '<div class="liste-item' + (A.bord && A.bord.id === b.id ? ' actif' : '') + '">' +
      '<span class="pastille" style="background:' + (COULEURS[String(m.plaqCouleur || '').toLowerCase()] || '#2E4A3C') + '"></span>' +
      '<button class="li-c" data-ouvrir="' + b.id + '" style="background:none;border:none;text-align:left;padding:0">' +
      '<b>' + esc((m.article ? 'Art. ' + m.article + ' — ' : '') + (m.foret || 'Sans forêt')) + '</b>' +
      '<small>' + esc(m.client || '') + ' · ' + E.fmt(b.nb || 0, 0) + ' billons · ' + E.fmt(b.vol || 0) + ' m³' +
      (b.maj ? ' · ' + new Date(b.maj).toLocaleDateString('fr-FR') : '') + '</small></button>' +
      '<button class="btn-min" data-dupliquer="' + b.id + '">Dupliquer</button>' +
      '<button class="btn-min" data-supprimer="' + b.id + '">Supprimer</button></div>';
  });
  $('#liste-bordereaux').innerHTML = h;
}
function nouveauBordereau(base) {
  var b = {
    id: uid(), maj: Date.now(),
    meta: Object.assign({
      article: '', client: '', foret: '', parcelles: '', etf: '',
      mesures: 'sur', plaqCouleur: 'bleu', classement: 'Class. Comt',
      date: new Date().toLocaleDateString('fr-FR')
    }, base || {}),
    lignes: [], prix: {}
  };
  A.index.push({ id: b.id, meta: b.meta, maj: b.maj, nb: 0, vol: 0 });
  A.bord = b;
  ecrire('bordcub.b.' + b.id, b); ecrire('bordcub.index', A.index); ecrire('bordcub.actif', b.id);
  appliquerCouleur(); majBandeau(); selEss = ''; selQual = '';
  viderFormulaire(false); renderFichiers(); renderBordereau(); renderDernieres();
  return b;
}
function ouvrirBordereau(id) {
  return lire('bordcub.b.' + id, null).then(function (b) {
    if (!b) { toast('Bordereau introuvable.'); return; }
    b.prix = b.prix || {}; b.lignes = b.lignes || [];
    A.bord = b; A.edition = null; selEss = ''; selQual = ''; essAffichees = [];
    ecrire('bordcub.actif', id);
    appliquerCouleur(); majBandeau(); viderFormulaire(false);
    renderFichiers(); renderBordereau(); renderDernieres(); renderSyntheses();
  });
}

/* ------------------------------------------------------------ en-tête */
function formEntete() {
  var m = A.bord.meta;
  var opt = function (l, v) {
    return l.map(function (x) { return '<option value="' + esc(x) + '"' + (v === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
  };
  return '<div class="grille g2">' +
    ch('e-article', 'N° d’article', m.article) + ch('e-client', 'Client', m.client) +
    ch('e-foret', 'Forêt', m.foret) + ch('e-parc', 'Parcelle(s)', m.parcelles) +
    ch('e-etf', 'ETF', m.etf) + ch('e-date', 'Date', m.date) +
    '<div class="champ"><label class="eyebrow" for="e-mes">Mesures</label><select id="e-mes">' +
    '<option value="sur"' + (m.mesures !== 'sous' ? ' selected' : '') + '>sur écorce</option>' +
    '<option value="sous"' + (m.mesures === 'sous' ? ' selected' : '') + '>sous écorce</option></select></div>' +
    '<div class="champ"><label class="eyebrow" for="e-cl">Type de cubage</label><select id="e-cl">' +
    E.CLASSEMENTS.map(function (x) {
      /* La valeur reste l'intitulé stocké — c'est la clé des qualités. Seul
         ce qui s'affiche change. */
      return '<option value="' + esc(x) + '"' + (m.classement === x ? ' selected' : '') + '>' +
        esc(E.nomClassement(x)) + '</option>';
    }).join('') + '</select></div>' +
    '<div class="champ"><label class="eyebrow" for="e-plaq">Couleur des plaquettes</label><select id="e-plaq">' +
    opt(Object.keys(COULEURS), String(m.plaqCouleur || '').toLowerCase()) + '</select></div>' +
    '</div><div class="btn-rang" style="margin-top:6px">' +
    '<button class="btn" id="e-gps">' +
    (m.gps && m.gps.lat != null ? 'Position enregistrée ✓' : 'Enregistrer la position') + '</button>' +
    '<button class="btn primaire" id="e-ok">Valider</button></div>';
}
function ch(id, lab, v) {
  return '<div class="champ"><label class="eyebrow" for="' + id + '">' + esc(lab) + '</label>' +
    '<input type="text" id="' + id + '" value="' + esc(v || '') + '"></div>';
}
/* Les codes déjà posés sur les billons existent-ils tous dans la liste du type
   visé ? Un bordereau qui n'a que du Z passe partout : Z et Z1 sont dans les
   quatre listes. */
function qualitesOrphelines(cl) {
  var connus = (A.cfg.qualites[cl] || []).map(function (q) { return q.code; });
  var vus = [];
  (A.bord ? A.bord.lignes : []).forEach(function (l) {
    if (l.qual && connus.indexOf(l.qual) < 0 && vus.indexOf(l.qual) < 0) vus.push(l.qual);
  });
  return vus;
}
function qualitesCompatibles(cl) { return !qualitesOrphelines(cl).length; }
function phraseChangementType(ancien, nouveau) {
  var o = qualitesOrphelines(nouveau), n = A.bord.lignes.length;
  var liste = o.slice(0, 6).join(', ') + (o.length > 6 ? '…' : '');
  return n + (n > 1 ? ' billons sont déjà saisis' : ' billon est déjà saisi') +
    ' en « ' + E.nomClassement(ancien) + ' ».\n\n' +
    (o.length > 1 ? 'Les qualités ' + liste + ' n’existent pas' : 'La qualité ' + liste + ' n’existe pas') +
    ' en « ' + E.nomClassement(nouveau) + ' » : ' +
    (o.length > 1 ? 'elles resteront' : 'elle restera') + ' sur ces billons, sans intitulé.\n\n' +
    'Changer quand même le type de ce bordereau ?';
}

/* « apres » sert à enchaîner sur la saisie quand l'en-tête vient d'ouvrir un
   bordereau neuf : sans lui, on validait l'en-tête et on restait sur la liste.
   Attention, il ne doit jamais être branché en écouteur direct — l'événement
   du clic arriverait à sa place. */
function ouvrirEntete(apres) {
  if (!A.bord) { nouveauBordereau(); }
  modale('En-tête du bordereau', formEntete());
  var gps = A.bord.meta.gps || null;
  $('#e-gps').addEventListener('click', function () {
    var b = this;
    releverPosition(b, function (p) {
      gps = p; b.textContent = 'Position enregistrée ✓';
      toast('Position du bordereau relevée ' + G.fmtPrecision(p) + '.');
    });
  });
  $('#e-ok').addEventListener('click', function () {
    var m = A.bord.meta, ancienCl = m.classement, nouveauCl = $('#e-cl').value;
    /* Changer de type sur un bordereau déjà rempli laisse ses billons avec des
       qualités qui n'existent plus dans la nouvelle liste : un V du comtois ne
       veut rien dire en ABCD. On le dit, et on le laisse décider — c'est lui
       qui sait s'il s'est trompé de type en créant le bordereau. */
    if (nouveauCl !== ancienCl && A.bord.lignes.length && !qualitesCompatibles(nouveauCl)) {
      if (!confirm(phraseChangementType(ancienCl, nouveauCl))) {
        $('#e-cl').value = ancienCl;
        return;
      }
    }
    m.article = $('#e-article').value.trim(); m.client = $('#e-client').value.trim();
    m.foret = $('#e-foret').value.trim(); m.parcelles = $('#e-parc').value.trim();
    m.etf = $('#e-etf').value.trim(); m.date = $('#e-date').value.trim();
    m.mesures = $('#e-mes').value; m.classement = nouveauCl; m.plaqCouleur = $('#e-plaq').value;
    m.gps = gps;
    if (m.classement !== ancienCl) selQual = '';
    sauver(); appliquerCouleur(); majBandeau(); renderLieux(); renderAccueil();
    renderChipsQual(); renderChipsMotifs(); renderBordereau(); renderSyntheses();
    renderFichiers(); apercu();
    fermerModale();
    if (apres) apres();
  });
}

