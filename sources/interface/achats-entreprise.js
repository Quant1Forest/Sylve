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
      fermerModale(); renderAchats(); renderBudgetAchats(); renderEntreprise();
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

function renderEntreprise() {
  var ta = FIN.totauxAchats(A.achats);
  if ($('#e-ac-n')) $('#e-ac-n').textContent = ta.n ? eurCourt(ta.ttc) : '—';
  if ($('#e-ac-s')) {
    $('#e-ac-s').textContent = ta.n
      ? ta.n + ' achat' + (ta.n > 1 ? 's' : '') + ' en attente'
      : 'Ce que vous comptez acheter';
  }
  var ouv = C.filtre(A.chantiers, 'ouverts').length;
  var t = C.totaux(A.chantiers, A.cfg);
  if ($('#a-ent-n')) $('#a-ent-n').textContent = ouv || '—';

  if ($('#e-ch-n')) $('#e-ch-n').textContent = ouv || '—';
  if ($('#e-ch-s')) {
    $('#e-ch-s').textContent = A.chantiers.length
      ? (t.signe ? eur(t.signe) + ' signés' + (t.aFacturer ? ' · ' + eur(t.aFacturer) + ' à facturer' : '')
        : 'Aucun chantier signé')
      : 'En cours, terminés, à venir';
  }

  var d = new Date(), cm = C.chargeMois(A.chantiers, d.getFullYear(), d.getMonth(), A.cfg);
  if ($('#e-cal-n')) $('#e-cal-n').textContent = (cm.fermes + cm.provisoires) || '—';
  if ($('#e-cal-s')) {
    $('#e-cal-s').textContent = (cm.fermes || cm.provisoires)
      ? cm.fermes + ' confirmés · ' + cm.provisoires + ' provisoires ce mois'
      : 'Programmation, journées placées';
  }

  var nRef = 0, nTypes = 0;
  C.TRAVAUX.forEach(function (tv) {
    var r = C.references(A.chantiers, tv.c, A.cfg);
    if (r.length) { nTypes++; nRef += r.length; }
  });
  if ($('#e-rd-n')) $('#e-rd-n').textContent = nRef || '—';
  if ($('#e-rd-s')) {
    $('#e-rd-s').textContent = nRef
      ? nTypes + ' type' + (nTypes > 1 ? 's' : '') + ' de travaux mesuré' + (nTypes > 1 ? 's' : '')
      : 'Saisissez temps et quantités pour en obtenir';
  }

  var b = periodeCourante();
  var ca = FIN.chiffreAffaires(A.chantiers, b);
  var bal = FIN.balanceTva(A.chantiers, A.depenses, b, C.tauxLigne);
  if ($('#e-fi-n')) $('#e-fi-n').textContent = ca.total ? eur(ca.total) : '—';
  var kmV = kmVehicule();
  if ($('#e-vh-n')) $('#e-vh-n').textContent = kmV ? E.fmt(kmV, 0) : '—';
  if ($('#e-vh-s')) {
    var nRet = echeancesVehicule().filter(function (x) { return x.etat === 'retard'; }).length;
    $('#e-vh-s').textContent = nRet
      ? nRet + ' échéance' + (nRet > 1 ? 's' : '') + ' dépassée' + (nRet > 1 ? 's' : '')
      : 'Carnet d’entretien, échéances';
  }
  if ($('#e-fi-s')) {
    $('#e-fi-s').textContent = ca.total || bal.montant
      ? libellePeriode() + ' · TVA ' + eur(bal.montant) + ' ' +
        (bal.sens === 'a_payer' ? 'à reverser' : (bal.sens === 'a_recuperer' ? 'à récupérer' : ''))
      : 'Bilan, recettes, dépenses, analyses';
  }

  var vs = ST.valeurTotale(A.articles), bas = ST.articlesSousSeuil(A.articles);
  if ($('#e-st-n')) $('#e-st-n').textContent = vs ? eur(vs) : '—';
  if ($('#e-st-s')) {
    $('#e-st-s').textContent = A.articles.length
      ? A.articles.length + ' article' + (A.articles.length > 1 ? 's' : '') +
        (bas.length ? ' · ' + bas.length + ' à recommander' : '')
      : 'Protections, tuteurs, marges';
  }

  renderMarqueEntreprise();
  renderEntBilan();
  renderNotesEnt();
}

/* Six chiffres qui disent ce qu'il reste à faire, pas ce qui est déjà fait —
   les tuiles s'en chargent. Chacun mène droit à la liste qui le détaille.
   Le bilan répond à « où j'en suis » avant qu'on ait à chercher. */
/* Le nom et le logo de l'entreprise, sur son écran. Rien de saisi : l'écran
   garde son intitulé d'origine. */
function renderMarqueEntreprise() {
  var z = $('#ent-logo'), h = $('#ent-nom');
  if (!z || !h) return;
  var nom = ((A.cfg && A.cfg.nomEntreprise) || '').trim();
  var logo = (A.cfg && A.cfg.logoEntreprise) || '';
  h.textContent = nom || 'Mon entreprise';
  z.hidden = !logo;
  z.innerHTML = logo ? '<img alt="">' : '';
  if (logo) z.querySelector('img').src = logo;
}

function renderEntBilan() {
  var z = $('#ent-bilan'); if (!z) return;
  if (!A.chantiers.length && !A.charges.length) { z.innerHTML = ''; return; }
  var an = new Date().getFullYear();
  var b = FIN.bornes('annee', an, 0);
  var aPlanifier = 0, signes = 0, signesM = 0, encours = 0, impayes = 0, impayesM = 0;
  A.chantiers.forEach(function (c) {
    /* Un chantier terminé n'a plus de journées à placer : ce qui reste à
       planifier ne concerne que ce qui n'est pas encore fait. */
    if (['devis', 'envoye', 'accepte', 'encours'].indexOf(c.statut) >= 0) {
      var reste = C.resteAPlacer(c);
      if (reste != null && reste > 0) aPlanifier += reste;
    }
    if (c.statut === 'accepte') { signes++; signesM += C.montant(c); }
    if (c.statut === 'encours') encours++;
    if (c.statut === 'facture') { impayes++; impayesM += C.montant(c); }
  });
  /* La bulle ne chauffe que s'il y a un vrai retard d'échéance : c'est
     l'alerte de « À traiter » qui fait foi, pas le simple fait d'attendre. */
  var enRetard = C.alertes(A.chantiers, A.cfg, Date.now())
    .filter(function (a) { return a.type === 'impaye'; }).length;
  var ca = FIN.chiffreAffaires(A.chantiers, b);
  var bal = FIN.balanceTva(A.chantiers, A.depenses, b, C.tauxLigne);
  var bulle = function (val, etiquette, sous, cible, chaud) {
    return '<button class="bulle' + (chaud ? ' chaud' : '') + '" data-bulle="' + cible + '">' +
      '<span class="v num">' + val + '</span>' +
      '<span class="e">' + etiquette + '</span>' +
      '<span class="s num">' + (sous || '&nbsp;') + '</span></button>';
  };
  z.innerHTML = '<p class="eyebrow" style="margin:20px 0 0">Où j’en suis</p>' +
    '<div class="bilan">' +
    bulle(aPlanifier ? E.fmt(aPlanifier, aPlanifier % 1 ? 1 : 0) : '—', 'journées à planifier',
      aPlanifier ? 'devis et chantiers' : 'rien en attente', 'calendrier') +
    bulle(signes || '—', 'devis signés', signes ? eur(signesM) : 'à planifier', 'accepte') +
    bulle(encours || '—', 'chantiers en cours', '&nbsp;', 'encours') +
    bulle(impayes || '—', 'factures en attente',
      impayes ? eur(impayesM) + (enRetard ? ' · ' + enRetard + ' en retard' : '') : 'tout est réglé',
      'facture', enRetard > 0) +
    bulle(ca.total ? eurCourt(ca.total) : '—', 'chiffre d’affaires', String(an), 'finances') +
    bulle(bal.deductible.total ? eurCourt(bal.deductible.total) : '—', 'TVA déductible',
      'cette année', 'depenses') +
    '</div>' + prochaineJourneeHtml();
}
/* Ce qui est posé à l'agenda pour tout de suite. Un chantier prévu demain ne
   doit pas s'apprendre en ouvrant le calendrier. */
function prochaineJourneeHtml() {
  var now = C.minuit(Date.now()), trouve = null;
  A.chantiers.forEach(function (c) {
    if (['accepte', 'encours', 'termine'].indexOf(c.statut) < 0) return;
    C.journeesPlacees(c).forEach(function (j) {
      var d = Math.round((C.minuit(j.d) - now) / C.JOUR);
      if (d < 0 || d > 7) return;
      if (!trouve || j.d < trouve.d) trouve = { d: j.d, p: j.p, ch: c, dans: d };
    });
  });
  if (!trouve) return '';
  var quand = trouve.dans === 0 ? 'Aujourd’hui' : trouve.dans === 1 ? 'Demain'
    : 'Dans ' + trouve.dans + ' jours';
  return '<button class="suite" data-bulle="calendrier">' +
    '<svg viewBox="0 0 24 24" class="pic" aria-hidden="true"><rect x="4" y="5.6" width="16" ' +
    'height="14" rx="2"/><path d="M4 10.2h16M8.6 3.6v3.8M15.4 3.6v3.8"/></svg>' +
    '<span><b>' + quand + '</b> — ' + esc(C.nomChantier(trouve.ch)) + ', ' +
    esc(C.fmtJours(trouve.p)) +
    /* Pour qui je travaille : c'est ce qu'on veut savoir la veille. */
    (trouve.ch.donneur ? '<small>pour ' + esc(trouve.ch.donneur) + '</small>' : '') +
    '</span></button>';
}

/* Les notes qu'il s'écrit à lui-même, sous les tuiles de l'écran
   Entreprise. Elles restent tant qu'il ne les efface pas. « À traiter » a
   quitté cet écran en 4.82 : le carnet le porte. */
var COUL_NOTE = [
  { c: '#B4231F', n: 'rouge' }, { c: '#C4611B', n: 'orange' },
  { c: '#B98A00', n: 'or' }, { c: '#2E7D46', n: 'vert' },
  { c: '#1F5FA9', n: 'bleu' }, { c: '#6F6A5C', n: 'gris' }
];
/* Une note est une liste : des éléments à cocher, comme une liste de courses.
   Avant la 4.85 elle portait un seul texte ; il devient son premier élément,
   non coché, la première fois qu'on la lit. */
function notes() {
  A.cfg = A.cfg || {};
  A.cfg.notes = A.cfg.notes || [];
  A.cfg.notes.forEach(function (n) {
    if (Array.isArray(n.items)) return;
    n.items = n.texte ? [{ id: uid(), texte: n.texte, fait: false }] : [];
    delete n.texte;
  });
  return A.cfg.notes;
}
function noteParId(id) {
  return notes().filter(function (x) { return x.id === id; })[0] || null;
}
/* Les éléments cochés descendent en bas ; l'ordre de saisie est gardé dans la
   base, de sorte qu'en décochant un élément il reprend sa place. */
function itemsAffiches(n) {
  var a = n.items || [];
  return a.filter(function (x) { return !x.fait; }).concat(a.filter(function (x) { return x.fait; }));
}
function renderNotesEnt() {
  var z = $('#ent-notes'); if (!z) return;
  var mes = notes();
  z.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;' +
    'gap:9px;margin:22px 0 8px">' +
    '<p class="eyebrow" style="margin:0">Mes notes</p>' +
    '<button class="btn-min" id="ent-note-plus">+ note</button></div>' +
    mes.map(function (n) {
      return '<div class="note-c" data-note-id="' + esc(n.id) + '">' +
        '<div class="note-t"><span class="ic" style="background:' + esc(n.couleur || '#6F6A5C') + '"></span>' +
        '<button class="note-titre" data-note="' + esc(n.id) + '" title="Modifier la note">' +
        esc(n.titre || 'Note') + '</button>' +
        '<button class="fermer" data-notesup="' + esc(n.id) + '" title="Supprimer cette note" ' +
        'aria-label="Supprimer la note">×</button></div>' +
        itemsAffiches(n).map(function (it) {
          return '<div class="note-i' + (it.fait ? ' fait' : '') + '">' +
            '<input type="checkbox" data-nt-coche="' + esc(it.id) + '"' + (it.fait ? ' checked' : '') +
            ' aria-label="Fait">' +
            '<span class="note-texte">' + esc(it.texte) + '</span>' +
            '<button class="fermer" data-nt-supitem="' + esc(it.id) + '" title="Supprimer cet élément" ' +
            'aria-label="Supprimer l’élément">×</button></div>';
        }).join('') +
        '<input type="text" class="note-ajout" data-nt-ajout="' + esc(n.id) + '" autocomplete="off" ' +
        'enterkeyhint="next" placeholder="ajouter un élément…"></div>';
    }).join('') +
    (mes.length ? '' : '<p class="muted" style="font-size:12.5px;margin:0">' +
      '« + note » pour vous écrire ce qu’il ne faut pas oublier : un chantier qui se ' +
      'prépare, un appel à passer.</p>');
}
function ouvrirNote(id) {
  var l = notes();
  var n = id ? noteParId(id) : null;
  var coul = (n && n.couleur) || COUL_NOTE[4].c;
  modale(id ? 'Modifier la note' : 'Une note à moi-même',
    '<div class="champ"><label class="eyebrow" for="nt-titre">Quoi ?</label>' +
    '<input type="text" id="nt-titre" class="gros" autocomplete="off" ' +
    'placeholder="rappeler le gestionnaire" value="' + esc(n ? n.titre || '' : '') + '"></div>' +
    '<p class="eyebrow" style="margin:12px 0 6px">Couleur</p>' +
    '<div class="chips" id="nt-couls">' + COUL_NOTE.map(function (x) {
      return '<button type="button" class="chip" data-ntcoul="' + x.c + '" title="' + x.n +
        '" aria-pressed="' + (coul === x.c ? 'true' : 'false') + '">' +
        '<span class="pastille" style="width:12px;height:12px;background:' + x.c +
        ';display:inline-block;vertical-align:-1px"></span></button>';
    }).join('') + '</div>' +
    (id ? '' : '<p class="muted" style="font-size:12px;margin:10px 0 0">Les éléments à cocher ' +
      's’ajoutent ensuite, dans la note.</p>') +
    '<div class="btn-rang" style="margin-top:12px">' +
    (id ? '<button class="btn danger btn-min" id="nt-sup">Supprimer</button>' : '') +
    '<button class="btn primaire" id="nt-ok">Enregistrer</button></div>');
  $('#nt-couls').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ntcoul]'); if (!b) return;
    coul = b.dataset.ntcoul;
    $$('#nt-couls [data-ntcoul]').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.ntcoul === coul));
    });
  });
  if ($('#nt-sup')) $('#nt-sup').addEventListener('click', function () { effacerNote(id); });
  $('#nt-ok').addEventListener('click', function () {
    var titre = $('#nt-titre').value.trim();
    if (!titre) { toast('Écrivez au moins de quoi il s’agit.'); return; }
    if (!n) { n = { id: uid(), cree: Date.now(), items: [] }; l.push(n); }
    n.titre = titre;
    n.couleur = coul;
    Promise.resolve(sauverCfg()).then(function () {
      fermerModale(); renderNotesEnt();
      toast(id ? 'Note modifiée.' : 'Note ajoutée.');
    });
  });
}
/* Par la corbeille, comme le reste : une liste de courses perdue d'un doigt
   maladroit se récupère. */
function effacerNote(id) {
  var n = noteParId(id); if (!n) return Promise.resolve();
  var faits = (n.items || []).filter(function (x) { return x.fait; }).length;
  var detail = (n.items || []).length
    ? faits + '/' + n.items.length + ' fait' + (faits > 1 ? 's' : '') : '';
  return jeterObjet('note', n, n.titre || 'Note', detail).then(function () {
    A.cfg.notes = notes().filter(function (x) { return x.id !== id; });
    return sauverCfg();
  }).then(function () {
    fermerModale(); renderNotesEnt(); toast('Note mise à la corbeille.');
  });
}
function majNote(id, f, refocus) {
  var n = noteParId(id); if (!n) return;
  f(n);
  Promise.resolve(sauverCfg()).then(function () {
    renderNotesEnt();
    if (refocus) {
      var c = $('#ent-notes [data-nt-ajout="' + id + '"]');
      if (c) c.focus();
    }
  });
}
function ajouterItemNote(champ) {
  var t = champ.value.trim(); if (!t) return;
  champ.value = '';
  majNote(champ.dataset.ntAjout, function (n) {
    n.items.push({ id: uid(), texte: t, fait: false });
  }, true);
}

function renderAlertes() {
  var z = $('#bandeau-alertes'); if (!z) return;
  /* Le seul « À traiter » depuis la 4.82 : l'écran Entreprise le répétait,
     et il l'y trouvait de trop. Les journées à placer et le travail qui
     approche vivent dans les bulles et sur le calendrier ; ici on ne garde
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

