/* ================================================== MA JOURNÉE
   Le soir, en rentrant. Ce qu'on a fait, où, combien de temps, et pour
   quelle quantité. C'est la seule saisie qui doit tenir en trente secondes,
   sinon elle ne se fait pas — et sans elle rien ne se calcule.
   ====================================================================== */

function sauverJournees() { return ecrire('bordcub.journees', A.journees); }
function journee(id) {
  return (A.journees || []).filter(function (j) { return j.id === id; })[0] || null;
}

/* Les temps déjà saisis dans les fiches chantier deviennent des journées :
   une par chantier et par date, chaque activité formant un poste. */
function migrerJournees() {
  if (A.cfg && A.cfg.journeesMigrees) return false;
  var vues = {};
  (A.chantiers || []).forEach(function (c) {
    (c.temps || []).forEach(function (t) {
      if (t.jrn) return;
      var k = c.id + '|' + B.jour(t.date);
      if (!vues[k]) {
        vues[k] = { id: uid(), date: t.date, chantier: c.id, lieu: c.foret || '',
          km: 0, nonProd: 0, personnes: C.nb(t.personnes) || 1,
          sansMoi: !!t.sansMoi, fin: false, postes: [] };
        A.journees.push(vues[k]);
      }
      var j = vues[k];
      j.km += C.nb(t.km);
      var h = t.unite === 'h' ? C.nb(t.duree) : C.nb(t.duree) * C.HEURES_JOUR(A.cfg);
      if (t.activite) j.postes.push({ travaux: t.activite, heures: C.arr(h, 2), quantite: 0 });
      else j.nonProd = C.arr(j.nonProd + h, 2);
    });
  });
  A.cfg = A.cfg || {};
  A.cfg.journeesMigrees = true;
  sauverCfg();
  if (A.journees.length) sauverJournees();
  return true;
}

/* Le temps porté par chaque chantier n'est qu'une lecture des journées :
   tout le calcul de rendement et de prix de journée continue de marcher
   sans savoir d'où le temps vient. */
/* Retirer une saisie de temps, c'est retirer le poste de journée qui la
   produit — et la journée elle-même s'il n'en reste rien. Filtrer c.temps
   ne faisait rien de durable : la liste est refaite à l'indexation. */
function retirerSaisie(t) {
  if (!t || !t.jrn) return false;
  var j = journee(t.jrn); if (!j) return false;
  if (t.activite) {
    var ote = false;
    j.postes = (j.postes || []).filter(function (p) {
      if (ote || p.travaux !== t.activite || C.arr(C.nb(p.heures), 2) !== C.arr(C.nb(t.duree), 2)) return true;
      ote = true; return false;
    });
    if (!ote) return false;
  } else if (t.nonReparti) {
    /* Le productif que rien ne se partageait : il s'en va seul. */
    j.productif = C.heuresPostes(j);
  } else {
    j.nonProd = 0;
    j.trajet = 0;
  }
  /* Une journée sans poste ni temps mort ne dit plus rien : elle s'en va. */
  if (!(j.postes || []).length && !C.nb(j.nonProd) && !C.nb(j.trajet) && !C.productifJournee(j)) {
    A.journees = (A.journees || []).filter(function (x) { return x.id !== j.id; });
  }
  return true;
}
function indexerJournees() {
  (A.chantiers || []).forEach(function (c) { c.temps = []; });
  (A.journees || []).forEach(function (j) {
    if (!j.chantier) return;
    var c = chantier(j.chantier); if (!c) return;
    var pers = C.nb(j.personnes) || 1;
    /* Une journée non facturée nourrit le rendement mais jamais le prix de
       journée : elle entre comme si quelqu'un d'autre l'avait faite. */
    var hors = !!j.nonFacture;
    var saisies = [];
    var saisie = function (x) {
      x.date = j.date; x.unite = 'h'; x.personnes = pers;
      x.sansMoi = (j.sansMoi || hors) || undefined; x.nonFacture = hors || undefined; x.jrn = j.id;
      saisies.push(x);
    };
    var reparti = 0;
    (j.postes || []).forEach(function (p) {
      var h = C.nb(p.heures);
      if (h > 0) {
        reparti += h;
        saisie({ duree: h, activite: p.travaux || null, quantite: C.nb(p.quantite) || undefined });
      } else if (p.travaux) {
        /* Une prestation sans heures (lot r2) garde sa quantité — elle fait
           l'avancement — et ne porte aucun temps : on ne sait pas quelle part
           du productif lui revient. Avant, elle était jetée avec sa quantité. */
        saisie({ duree: 0, activite: p.travaux, quantite: C.nb(p.quantite) || undefined, sansTemps: true });
      }
    });
    /* Le productif qui n'est réparti entre aucune prestation : il compte
       pour le chantier, jamais pour un rendement. */
    var libre = C.arr(C.productifJournee(j) - reparti, 2);
    if (libre > 0) saisie({ duree: libre, activite: null, nonReparti: true });
    /* Le hors production compte dans la journée facturée, jamais dans le
       rendement : il entre sans activité. */
    if (C.nb(j.nonProd) > 0) saisie({ duree: C.arr(C.nb(j.nonProd), 3), activite: null });
    /* Le trajet ne compte plus dans le temps du chantier (lot r2) : il est
       porté à côté, sur la première saisie, comme les kilomètres. */
    if (!saisies.length && (C.nb(j.km) || C.nb(j.trajet))) saisie({ duree: 0, activite: null });
    if (saisies.length) {
      if (C.nb(j.km)) saisies[0].km = C.nb(j.km);
      if (C.nb(j.trajet)) saisies[0].trajet = C.trajetJournee(j);
    }
    saisies.forEach(function (x) { c.temps.push(x); });
  });
  /* Les journées d'office (lot r1) entrent ici, sans activité : elles
     comptent dans le temps passé et le prix par journée, jamais dans un
     rendement. Elles ne viennent d'aucune journée — rien à retirer, rien à
     sauvegarder — et disparaissent dès qu'une vraie journée les remplace. */
  journeesDOffice().forEach(function (o) {
    o.chantier.temps.push({ date: C.minuit(o.d) + 12 * 3600000, duree: o.heures, unite: 'h',
      personnes: 1, activite: null, office: true, vu: o.vu || undefined });
  });
  A.indexeLe = C.jourCle(Date.now());
}
/* Le jour change pendant que l'application reste ouverte : la journée
   d'office d'hier ne compte qu'une fois l'index refait. */
function indexAJour() {
  if (A.indexeLe !== C.jourCle(Date.now())) indexerJournees();
}
function majJournees() {
  indexerJournees();
  renderFiche(); renderCarnet(); renderCalendrier(); renderRendements();
  renderAccueil(); renderFinances();
}

/* Les lieux déjà fréquentés, pour ne pas les retaper. */
function lieuxConnus() {
  var v = {}, l = [];
  (A.journees || []).forEach(function (j) {
    if (j.lieu) v[j.lieu] = 1;
    if (j.commune) v[j.commune] = 1;
  });
  (A.chantiers || []).forEach(function (c) {
    if (c.foret) v[c.foret] = 1;
    if (c.commune) v[c.commune] = 1;
  });
  (A.lieuxRegles || []).forEach(function (x) { if (x) v[x] = 1; });
  for (var k in v) l.push(k);
  return l.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
}
function derniereJournee() {
  return (A.journees || []).slice().sort(function (a, b) {
    return (b.date || 0) - (a.date || 0);
  })[0] || null;
}

/* ------------------------------------------- heures et minutes (lot r2)
   Une durée se tape dans deux cases côte à côte, « h » et « min » : « 1,67 »
   ne se tape pas, « 1 h 40 » si. Elle reste gardée en heures décimales, et
   une ancienne valeur se relit juste (1,67 h → 1 h 40). La case des heures
   accepte encore une virgule : « 1,5 » vaut 1 h 30. */
function champDuree(id, heures, o) {
  o = o || {};
  var v = C.nb(heures) > 0 ? C.enHeuresMinutes(heures) : null;
  return '<span class="duree' + (o.gros ? ' gros' : '') + '">' +
    '<input type="text" id="' + id + '"' + (o.attrH || '') + ' inputmode="decimal" autocomplete="off" value="' +
    (v ? v.h : '') + '"' + (o.nom ? ' aria-label="' + esc(o.nom) + ', heures"' : '') + '>' +
    '<span class="duree-u">h</span>' +
    '<input type="text" id="' + id + '-m"' + (o.attrM || '') + ' inputmode="numeric" autocomplete="off" value="' +
    (v && v.m ? v.m : '') + '" aria-label="' + esc(o.nom || 'Durée') + ', minutes">' +
    '<span class="duree-u">min</span></span>';
}
function dureeDe(h, m) { return C.arr(C.nb(h) + C.nb(m) / 60, 3); }
function lireDuree(id) {
  var h = $('#' + id), m = $('#' + id + '-m');
  return dureeDe(h ? h.value : '', m ? m.value : '');
}
function dureeTapee(id) {
  var h = $('#' + id), m = $('#' + id + '-m');
  return !!((h && h.value.trim()) || (m && m.value.trim()));
}
function poserDuree(id, heures) {
  var h = $('#' + id), m = $('#' + id + '-m'); if (!h || !m) return;
  var v = C.nb(heures) > 0 ? C.enHeuresMinutes(heures) : null;
  h.value = v ? String(v.h) : '';
  m.value = v && v.m ? String(v.m) : '';
}

/* ---------------------------------- une journée par chantier et par jour
   (lot r2) Deux Ma journée sur le même chantier le même jour — la seconde
   par oubli — faisaient une ligne « 7 h » dont l'appui n'ouvrait que la
   première. Les doublons déjà en base restent : on choisit entre eux. */
function journeesDe(idChantier, ts, sauf) {
  var k = C.jourCle(ts);
  return (A.journees || []).filter(function (x) {
    return idChantier && x.chantier === idChantier && x.id !== sauf && C.jourCle(C.nb(x.date)) === k;
  });
}
function ditJourneeExistante(c, x) {
  return C.nomChantier(c) + ' a déjà une journée le ' + jourCourt(x.date) + ' : ' +
    C.ditHeures(C.heuresJournee(x));
}
/* Ouvrir « la » journée d'un jour : une seule, Ma journée ; plusieurs (un
   ancien doublon), un petit choix entre elles. */
function ouvrirJourneesParmi(ids) {
  var l = ids.map(journee).filter(Boolean);
  if (!l.length) return;
  if (l.length === 1) { ouvrirJournee(l[0].id); return; }
  var c = l[0].chantier ? chantier(l[0].chantier) : null;
  modale(l.length + ' journées ce jour-là',
    '<p class="fi-aide">' + esc((c ? C.nomChantier(c) : 'Ce chantier') + ' a ' + l.length +
      ' journées le ' + jourCourt(l[0].date) + '. Laquelle ouvrir ?') + '</p>' +
    l.map(function (j) {
      var faits = faitsDeJournee(j);
      return '<button type="button" class="mj-copie" data-mjchoix="' + esc(j.id) + '"><b>' +
        esc(C.ditHeures(C.heuresJournee(j)) + (C.nb(j.trajet) ? ' · + ' + C.ditHeures(j.trajet) + ' de trajet' : '')) +
        '</b><small>' + esc(faits.length ? faits.join(', ') : 'sans prestation') + '</small></button>';
    }).join(''));
  $('#modale-corps').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mjchoix]'); if (!b) return;
    fermerModale(); ouvrirJournee(b.dataset.mjchoix);
  });
}

/* Le trajet du chantier (lot r2) : celui de sa fiche, à défaut celui de la
   dernière journée qui y est allée — c'est la même route. */
function trajetDeFiche(c) { return !!(c && (C.nb(c.trajetKm) > 0 || C.nb(c.trajetHeures) > 0)); }
function trajetHabituel(idChantier) {
  var vu = 0, quand = 0;
  (A.journees || []).forEach(function (j) {
    if (j.chantier !== idChantier || !C.nb(j.trajet)) return;
    if (C.nb(j.date) >= quand) { quand = C.nb(j.date); vu = C.nb(j.trajet); }
  });
  return vu;
}

/* ------------------------------------------------------------- l'écran */
var pst = [];
/* Les heures par prestation sont facultatives (lot r2) : elles ne
   s'affichent qu'une fois « Répartir le temps » demandé, et à deux
   prestations au moins. */
var pstRepartir = false;

/* Le sélecteur des postes d'une journée passe par la même fonction que celui
   d'une ligne de chantier : il en existait deux du même nom, et la seconde
   écrasait la première en silence.
   Ce HTML ne se refait QUE quand une ligne s'ajoute ou s'en va, ou que la
   répartition s'ouvre : refait pendant la frappe, il remplaçait le champ
   sous le doigt et le clavier se refermait (forme retenue du tour 1). */
function renderPostes() {
  var z = $('#mj-postes'); if (!z) return;
  var rep = pstRepartir && pst.length > 1;
  z.innerHTML = pst.map(function (p, i) {
    var qte = '<div class="champ" style="margin:0"><label class="eyebrow" for="pst-q-' + i + '" id="pst-ql-' + i + '">' +
      libelleFait(p.travaux) + '</label>' +
      '<input type="text" id="pst-q-' + i + '" data-pstq="' + i + '" class="gros" inputmode="decimal" autocomplete="off" value="' + esc(p.quantite) + '"></div>';
    return '<div class="mj-poste">' +
      '<div class="mj-poste-haut">' +
      '<select data-pstt="' + i + '" aria-label="Prestation ' + (i + 1) + '">' +
      optionsTravaux(p.travaux, { vide: true, sansFournitures: true }) + '</select>' +
      (pst.length > 1 ? '<button type="button" class="btn-min" data-pstsup="' + i + '" ' +
        'aria-label="Retirer cette prestation">✕</button>' : '') +
      '</div>' +
      (rep
        ? '<div class="champ" style="margin:0"><label class="eyebrow" for="pst-h-' + i + '">Temps passé</label>' +
          champDuree('pst-h-' + i, dureeDe(p.h, p.m), { attrH: ' data-psth="' + i + '"', attrM: ' data-pstm="' + i + '"',
            nom: 'Temps passé, prestation ' + (i + 1) }) + '</div>' + qte
        : qte) +
      '<small class="mj-rdt" id="pst-r-' + i + '"></small></div>';
  }).join('') + '<div class="mj-postes-bas"><button type="button" class="btn-min" id="pst-plus">+ une prestation</button>' +
    (pst.length > 1 ? '<button type="button" class="lien" id="pst-rep">' +
      (rep ? 'Ne pas répartir le temps' : 'Répartir le temps entre les prestations') + '</button>' : '') + '</div>' +
    (pst.length > 1 && !rep ? '<small class="mj-aide" id="pst-repaide">Sans répartition, le temps compte pour le ' +
      'chantier ; il ne compte dans le rendement d’aucune de ces prestations.</small>' : '');
}
function libelleFait(travaux) {
  var u = travaux ? C.courtUnite(C.uniteDe(travaux)) : '';
  return 'Fait' + (u ? ' (' + esc(u) + ')' : '');
}
function lirePostes() {
  $$('#mj-postes [data-pstt]').forEach(function (i) { pst[+i.dataset.pstt].travaux = i.value; });
  $$('#mj-postes [data-psth]').forEach(function (i) { pst[+i.dataset.psth].h = i.value; });
  $$('#mj-postes [data-pstm]').forEach(function (i) { pst[+i.dataset.pstm].m = i.value; });
  $$('#mj-postes [data-pstq]').forEach(function (i) { pst[+i.dataset.pstq].quantite = i.value; });
}
function posteVide() { return { travaux: '', h: '', m: '', quantite: '' }; }
function postesVides() {
  return pst.every(function (p) { return !p.travaux && !C.nb(p.h) && !C.nb(p.m) && !C.nb(p.quantite); });
}
/* Les prestations d'un chantier, une fois chacune, sans les fournitures :
   elles ouvrent les postes, sans heures. */
function prestationsDe(c) {
  var vus = [];
  ((c && c.lignes) || []).forEach(function (l) {
    if (l.travail && vus.indexOf(l.travail) < 0 && !C.estFourniture(l.travail)) vus.push(l.travail);
  });
  return vus;
}
/* Les chantiers posés ce jour-là (P4). */
function posesLe(ts) {
  return (A.chantiers || []).filter(function (c) {
    return c.statut !== 'sansuite' && C.partDuJour(c, ts) > 0;
  });
}
/* Les chantiers qui peuvent recevoir une journée ce jour-là : ceux qui sont
   ouverts, celui qu'on corrige, et ceux qui sont posés ce jour-là — même
   facturés, c'est l'agenda qui dit qu'ils ont lieu d'y être. Les posés en
   tête, puis du plus récent au plus ancien. */
function chantiersPourJournee(ts, vise) {
  var poses = {};
  posesLe(ts).forEach(function (c) { poses[c.id] = 1; });
  return A.chantiers.filter(function (c) {
    return c.id === vise || poses[c.id] ||
      ['devis', 'envoye', 'accepte', 'encours', 'termine'].indexOf(c.statut) >= 0;
  }).sort(function (a, b) {
    return (poses[b.id] ? 1 : 0) - (poses[a.id] ? 1 : 0) || C.dateChantier(b) - C.dateChantier(a);
  });
}
/* Ma journée pré-remplie d'une journée comptée d'office : le chantier, et la
   durée comptée. Enregistrée, elle remplace la journée d'office. */
function modeleDOffice(c, ts, heures) {
  return { date: ts, chantier: c.id, lieu: c.foret || '', commune: c.commune || '',
    total: heures, postes: prestationsDe(c).map(function (tv) { return { travaux: tv }; }) };
}

/* « avis » : une ligne en tête, quand Ma journée s'ouvre sur une journée qui
   existait déjà (lot r2). */
function ouvrirJournee(id, modele, avis) {
  var j = id ? journee(id) : null;
  if (id && !j) return;
  var src = j || modele || null;
  pst = (src && src.postes && src.postes.length)
    ? src.postes.map(function (p) {
        var hm = j && C.nb(p.heures) > 0 ? C.enHeuresMinutes(p.heures) : null;
        return { travaux: p.travaux, h: hm ? String(hm.h) : '', m: hm && hm.m ? String(hm.m) : '',
          quantite: j ? String(p.quantite || '') : '' };
      })
    : [posteVide()];
  /* Une journée déjà répartie se rouvre répartie. */
  pstRepartir = !!(j && pst.length > 1 && (j.postes || []).some(function (p) { return C.nb(p.heures) > 0; }));
  var leJour = C.minuit((src && src.date) || Date.now());
  var totalInit = j ? C.heuresJournee(j) : modele && C.nb(modele.total) > 0 ? C.nb(modele.total) : 0;
  var prodInit = j ? C.productifJournee(j) : totalInit;
  /* Ce que le formulaire a rempli de lui-même : on peut le reprendre quand le
     jour change, jamais ce qu'il a tapé. Un chantier venu de la porte (« Comme
     le… ») compte comme choisi : la date ne le change plus. */
  var etat = { manuel: !!(j || (modele && modele.chantier)), auto: {}, autoPostes: false, aide: '',
    /* Le productif suit le total tant qu'il n'y a pas touché. */
    prodManuel: !!j && Math.round(prodInit * 60) !== Math.round(totalInit * 60),
    trajReplie: !!((src && C.nb(src.km)) || (j && C.nb(j.trajet))), trajSource: '' };
  var dj = derniereJournee();
  var cDj = dj && dj.chantier ? chantier(dj.chantier) : null;

  modale(id ? 'Modifier la journée' : 'Ma journée',
    (avis ? '<p class="mj-avis" id="mj-avis">' + esc(avis) + '</p>' : '') +
    (!id && dj ? '<button type="button" class="mj-copie" id="mj-hier">' +
      '<b>Comme le ' + esc(jourCourt(dj.date)) +
      (dj.lieu || cDj ? ' — ' + esc(dj.lieu || C.nomChantier(cDj)) : '') + '</b>' +
      '<small>copie le chantier, le lieu, les km et les prestations ; ni la date ni les heures</small></button>' : '') +
    '<p class="fj-sous">Quand, où</p><div class="mj-zone">' +
    '<div class="champ"><label class="eyebrow" for="mj-date">Date</label>' +
    '<input type="date" id="mj-date" value="' + jourIso(leJour) + '"></div>' +
    '<div class="champ"><label class="eyebrow" for="mj-ch">Chantier</label>' +
    '<select id="mj-ch"></select><small class="mj-aide" id="mj-chaide"></small>' +
    '<p class="mj-doublon" id="mj-doublon"></p></div>' +
    '<div class="grille g2">' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-lieu">Forêt</label>' +
    '<input type="text" id="mj-lieu" list="lieux-connus" autocomplete="off" value="' +
    esc((src && src.lieu) || '') + '"></div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-commune">Commune</label>' +
    '<input type="text" id="mj-commune" list="lieux-connus" autocomplete="off" value="' +
    esc((src && src.commune) || '') + '"></div>' +
    '</div></div>' +
    /* « Il faudrait juste le temps total, et le temps productif. Et après, si
       je peux rajouter le temps de trajet. » Le productif se tape à part
       depuis le lot r2 : les heures par prestation sont facultatives. Le
       hors production s'en déduit (affûtage, réglage, panne). Le trajet
       reste à part : il ne se passe pas sur le chantier. */
    '<p class="fj-sous">Mon temps</p><div class="mj-zone">' +
    '<div class="champ"><label class="eyebrow" for="mj-total">Temps total sur le chantier</label>' +
    champDuree('mj-total', totalInit, { gros: true, nom: 'Temps total sur le chantier' }) +
    '<small class="mj-aide">trajet non compris</small></div>' +
    '<div class="champ"><label class="eyebrow" for="mj-prod">Temps productif</label>' +
    champDuree('mj-prod', prodInit, { gros: true, nom: 'Temps productif' }) +
    '<small class="mj-aide" id="mj-prodaide">ce qui a avancé le chantier ; proposé égal au total</small></div>' +
    '<div class="champ mj-pers"><label class="eyebrow" for="mj-pers">Personnes</label>' +
    '<input type="text" id="mj-pers" inputmode="numeric" autocomplete="off" value="' +
    ((src && C.nb(src.personnes)) || 1) + '"></div>' +
    '<p class="eyebrow" style="margin:0 0 6px">Ce que j’ai fait</p>' +
    '<div id="mj-postes"></div>' +
    '<p class="muted" id="mj-horsprod" style="font-size:12px;margin:6px 0 0"></p></div>' +
    /* Le trajet se règle sur le chantier (lot r2) : proposé, il se replie
       en une ligne ; « Modifier » le change pour ce jour seulement. */
    '<p class="fj-sous">Trajet</p><div class="mj-zone">' +
    '<div class="mj-traj-ligne" id="mj-traj-ligne" hidden><span id="mj-traj-txt"></span>' +
    '<button type="button" class="lien" id="mj-traj-mod">Modifier</button></div>' +
    '<div id="mj-traj-cases"><div class="grille g2">' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-trajet">Temps aller-retour</label>' +
    champDuree('mj-trajet', j ? C.nb(j.trajet) : 0, { nom: 'Temps de trajet' }) + '</div>' +
    '<div class="champ" style="margin:0"><label class="eyebrow" for="mj-km">Kilomètres</label>' +
    '<input type="text" id="mj-km" inputmode="decimal" autocomplete="off" value="' +
    (src && C.nb(src.km) ? src.km : '') + '"></div>' +
    '</div><small class="mj-aide" id="mj-kmaide"></small></div>' +
    '<label class="mj-case" for="mj-retenir" id="mj-retenir-l" hidden><input type="checkbox" id="mj-retenir" checked>' +
    '<span><b>Retenir pour ce chantier</b><small>il sera proposé à chaque journée</small></span></label></div>' +
    '<label class="mj-case" for="mj-fin"><input type="checkbox" id="mj-fin"' + (j && j.fin ? ' checked' : '') + '>' +
    '<span><b>Ce chantier est terminé</b><small>il passe à « à facturer »</small></span></label>' +
    '<div class="champ" style="margin-top:11px"><label class="eyebrow" for="mj-note">Note</label>' +
    '<textarea id="mj-note" rows="2">' + esc((j && j.note) || '') + '</textarea></div>' +
    /* Le pied reste en vue pendant qu'on remplit : le total, et Enregistrer. */
    '<div class="mj-pied"><div id="mj-apercu"></div>' +
    '<div class="btn-rang" style="margin:0">' +
    (id ? '<button class="btn danger btn-min" id="mj-sup">Supprimer</button>' : '') +
    '<button class="btn primaire plein" id="mj-ok">Enregistrer</button></div></div>');

  var dateDe = function () { return versDate($('#mj-date').value) || leJour; };
  var chDe = function () { return $('#mj-ch').value ? chantier($('#mj-ch').value) : null; };
  var listerChantiers = function () {
    var ts = dateDe(), sel = $('#mj-ch').value || (src && src.chantier) || '';
    var chs = chantiersPourJournee(ts, sel);
    $('#mj-ch').innerHTML = '<option value="">— aucun, journée libre —</option>' +
      chs.map(function (c) {
        return '<option value="' + c.id + '"' + (sel === c.id ? ' selected' : '') + '>' +
          esc(C.nomChantier(c)) + '</option>';
      }).join('');
  };
  var aides = function () {
    $('#mj-chaide').textContent = etat.aide;
    $('#mj-kmaide').textContent = etat.auto.km != null && $('#mj-km').value === etat.auto.km &&
      !trajetDeFiche(chDe()) ? 'Les kilomètres de la dernière fois sur ce chantier : c’est la même route.' : '';
  };
  /* La ligne repliée du trajet, et « Retenir pour ce chantier » quand sa
     fiche n'en a pas. Aucun champ n'est refait. */
  var majTrajet = function () {
    var km = C.nb($('#mj-km').value), h = lireDuree('mj-trajet');
    var replie = !!(etat.trajReplie && (km || h));
    $('#mj-traj-ligne').hidden = !replie;
    $('#mj-traj-cases').hidden = replie;
    if (replie) {
      $('#mj-traj-txt').innerHTML = '<b>Trajet : ' + esc([km ? E.fmt(km, km % 1 ? 1 : 0) + ' km' : '',
        h ? C.ditHeures(h) : ''].filter(Boolean).join(' · ')) + '</b>' +
        (etat.trajSource ? '<small>' + esc(etat.trajSource) + '</small>' : '');
    }
    var c = chDe();
    $('#mj-retenir-l').hidden = !(c && !trajetDeFiche(c) && (km || h));
  };
  /* Choisir un chantier remplit ce qu'il sait — seulement les champs vides,
     jamais par-dessus ce qui est tapé. « auto » retient ce qui a été rempli
     ainsi, pour pouvoir le reprendre si le jour change. */
  var remplir = function (c, auto) {
    var poser = function (champ, cle, v) {
      if (!v || $(champ).value) return;
      $(champ).value = v;
      if (auto) etat.auto[cle] = String(v);
    };
    /* Le champ s'appelait « lieu » et le chantier porte « foret » : la
       reprise ne marchait donc jamais. */
    poser('#mj-lieu', 'lieu', c.foret);
    poser('#mj-commune', 'commune', c.commune);
    /* Le trajet de la fiche du chantier ; à défaut, celui de la dernière
       journée sur ce chantier : c'est la même route. Estimer une distance
       entre deux communes demanderait un calcul d'itinéraire, que
       l'application ne fait pas — mais elle a sa propre mémoire. */
    var fiche = trajetDeFiche(c);
    var km = C.nb(c.trajetKm) || kmHabituels(c.id), th = C.nb(c.trajetHeures) || trajetHabituel(c.id);
    var pris = false;
    if (km && !$('#mj-km').value) { $('#mj-km').value = km; etat.auto.km = String(km); pris = true; }
    if (th && !dureeTapee('mj-trajet')) { poserDuree('mj-trajet', th); etat.auto.trajet = th; pris = true; }
    if (pris) {
      etat.trajReplie = true;
      etat.trajSource = fiche ? 'celui de la fiche du chantier' : 'comme la dernière fois sur ce chantier';
    }
    lirePostes();
    var vus = prestationsDe(c);
    if (vus.length && postesVides()) {
      pst = vus.map(function (tv) { var p = posteVide(); p.travaux = tv; return p; });
      etat.autoPostes = !!auto;
      renderPostes();
    }
    majTrajet();
  };
  /* Reprendre ce que le formulaire avait rempli de lui-même, s'il n'y a pas
     touché depuis. */
  var oublierAuto = function () {
    [['#mj-lieu', 'lieu'], ['#mj-commune', 'commune'], ['#mj-km', 'km']].forEach(function (x) {
      if (etat.auto[x[1]] != null && $(x[0]).value === etat.auto[x[1]]) $(x[0]).value = '';
    });
    if (etat.auto.trajet != null && lireDuree('mj-trajet') === C.arr(etat.auto.trajet, 3)) poserDuree('mj-trajet', 0);
    etat.auto = {};
    etat.trajReplie = false; etat.trajSource = '';
    lirePostes();
    if (etat.autoPostes && pst.every(function (p) { return !C.nb(p.h) && !C.nb(p.m) && !C.nb(p.quantite); })) {
      pst = [posteVide()];
      renderPostes();
    }
    etat.autoPostes = false;
    majTrajet();
  };
  /* P4 : un chantier posé ce jour-là est pré-choisi — un seul ; à plusieurs,
     aucun, et ils passent en tête de la liste. Revu à chaque changement de
     date tant qu'il n'a pas choisi lui-même. Jamais en modification. Un
     chantier qui a déjà sa journée ce jour-là n'est plus pré-choisi : « Autre
     chose ce jour-là » ne doit pas y ramener. */
  var preChoisir = function () {
    listerChantiers();
    if (etat.manuel) { etat.aide = ''; aides(); return; }
    var poses = posesLe(dateDe()).filter(function (c) { return !journeesDe(c.id, dateDe()).length; });
    if ($('#mj-ch').value) oublierAuto();
    if (poses.length === 1) {
      $('#mj-ch').value = poses[0].id;
      remplir(poses[0], true);
      etat.aide = 'Posé ce jour-là : choisi d’office.';
    } else {
      $('#mj-ch').value = '';
      etat.aide = poses.length > 1 ? 'Plusieurs chantiers sont posés ce jour-là : ils sont en tête de la liste.' : '';
    }
    aides();
  };
  /* Ce qu'il a tapé et qui ne sera pas repris, dit en clair. */
  var ceQuiEstTape = function () {
    lirePostes();
    var l = [];
    if (dureeTapee('mj-total') && lireDuree('mj-total')) l.push(C.ditHeures(lireDuree('mj-total')));
    pst.forEach(function (p) {
      if (p.travaux && C.nb(p.quantite)) {
        l.push(C.nomTravail(p.travaux) + ' ' + E.fmt(C.nb(p.quantite), C.nb(p.quantite) % 1 ? 2 : 0));
      }
    });
    if ($('#mj-note').value.trim()) l.push('la note');
    return l.join(', ');
  };
  /* Une journée par chantier et par jour : en saisie, on ouvre celle qui
     existe ; en modification, on le dit et on propose l'autre. */
  var verifierDoublon = function () {
    var c = chDe(), z = $('#mj-doublon');
    var x = c ? journeesDe(c.id, dateDe(), j ? j.id : null)[0] : null;
    if (!x) { z.innerHTML = ''; return false; }
    var msg = ditJourneeExistante(c, x);
    if (!j) {
      var tape = ceQuiEstTape();
      fermerModale();
      ouvrirJournee(x.id, null, msg + '. Elle est ouverte pour la compléter.' +
        (tape ? ' Ce que vous aviez tapé n’y est pas reporté : ' + tape + '.' : ''));
      return true;
    }
    z.innerHTML = esc(msg) + '. Une seule journée par chantier et par jour. ' +
      '<button type="button" class="lien" id="mj-autre" data-mjautre="' + esc(x.id) + '">Ouvrir l’autre journée</button>';
    return true;
  };

  /* Le temps de la journée, tel qu'il est tapé. Sans total, le total est le
     productif ; sans productif, le productif est le total — ou la somme des
     heures réparties. */
  var calcul = function () {
    var avec = pst.filter(function (p) { return p.travaux; }).length;
    var rep = pstRepartir && pst.length > 1;
    var somme = rep ? C.arr(pst.reduce(function (s, p) { return s + dureeDe(p.h, p.m); }, 0), 3) : 0;
    var total = lireDuree('mj-total');
    var prod = dureeTapee('mj-prod') ? lireDuree('mj-prod') : (total || somme);
    if (!dureeTapee('mj-total')) total = prod;
    var mn = function (h) { return Math.round(h * 60); };
    var err = '';
    /* Un total plus court que le productif ne peut pas être juste : l'un des
       deux est mal tapé, et deviner lequel fausserait les rendements. */
    if (mn(total) < mn(prod)) err = 'Le temps total est plus court que le temps productif : corrigez l’un des deux.';
    else if (rep && somme > 0 && mn(somme) !== mn(prod)) {
      err = 'Les prestations font ' + C.ditHeures(somme) + ', le temps productif ' + C.ditHeures(prod) +
        ' : corrigez l’un des deux.';
    }
    return { avec: avec, rep: rep && somme > 0, somme: somme, total: total, prod: prod,
      np: Math.max(0, C.arr(total - prod, 3)), err: err, trajet: lireDuree('mj-trajet') };
  };
  /* Le productif proposé : le total, ou la somme des heures réparties. */
  var proposerProd = function () {
    if (etat.prodManuel) return;
    var rep = pstRepartir && pst.length > 1;
    var somme = rep ? pst.reduce(function (s, p) { return s + dureeDe(p.h, p.m); }, 0) : 0;
    poserDuree('mj-prod', somme > 0 ? somme : lireDuree('mj-total'));
  };
  /* Ce que chaque prestation reçoit du productif : les heures réparties ;
     une seule prestation, tout ; plusieurs sans répartition, rien. */
  var heuresDuPoste = function (t, p) {
    if (!p.travaux) return 0;
    if (t.rep) return dureeDe(p.h, p.m);
    return t.avec === 1 ? t.prod : 0;
  };

  /* Ce qui se recalcule pendant la frappe : l'aperçu du pied, la ligne hors
     production, le rendement sous chaque prestation. Aucun champ n'est
     refait. */
  var apercu = function () {
    var z = $('#mj-apercu'); if (!z) return;
    var hj = C.HEURES_JOUR(A.cfg) || 8, t = calcul();
    var pers = C.nb($('#mj-pers').value) || 1;
    var hp = $('#mj-horsprod');
    if (hp) {
      hp.textContent = t.err || (t.np ? C.ditHeures(t.prod) + ' productives, ' + C.ditHeures(t.np) +
        ' hors production — affûtage, réglage, panne.' : '');
      hp.classList.toggle('mj-erreur', !!t.err);
    }
    pst.forEach(function (p, i) {
      var r = $('#pst-r-' + i); if (!r) return;
      var h = heuresDuPoste(t, p);
      if (!(p.travaux && C.nb(p.quantite) > 0 && h > 0)) { r.textContent = ''; return; }
      var parJ = C.nb(p.quantite) / (h / hj) * pers;
      r.textContent = '≈ ' + E.fmt(parJ, parJ >= 100 ? 0 : 1) + ' ' +
        C.courtUnite(C.uniteDe(p.travaux)) + '/jour';
    });
    /* Le trajet ne compte plus dans la journée (lot r2) : il se dit à côté. */
    var tot = t.total;
    if (tot <= 0 && t.trajet <= 0) { z.innerHTML = '<span class="muted">Indiquez vos heures.</span>'; return; }
    var jrs = tot / hj;
    var ch = chDe();
    var nf = !!(j && j.nonFacture);
    var pj = ch ? C.prixJourVise(ch, A.cfg) : C.nb(A.cfg && A.cfg.prixJourVise);
    z.innerHTML = '<div class="mj-tot"><b class="num">' + C.ditHeures(tot) + '</b>' +
      '<span>' + E.fmt(jrs, 2) + ' journée' + (jrs > 1 ? 's' : '') + '</span>' +
      (nf ? '<span class="retard">non facturée</span>'
        : pj ? '<b class="num mj-montant">' + eur(C.arr(jrs * pj, 2)) + '</b>' : '') + '</div>' +
      '<small class="muted">' +
      C.ditHeures(t.prod) + ' productives' + (t.np ? ' · ' + C.ditHeures(t.np) + ' hors production' : '') +
      (t.trajet ? ' · + ' + C.ditHeures(t.trajet) + ' de trajet' : '') +
      (pers > 1 ? ' · ' + pers + ' personnes' : '') +
      (nf ? ' · compte pour le rendement seulement' : pj ? ' · à ' + eur(pj) + '/j' : '') + '</small>';
  };
  renderPostes(); preChoisir();
  /* Venu d'une porte qui connaît le chantier (« Comme le… », Préciser) : ce
     qu'il sait remplit les champs vides, son trajet compris. */
  if (!j && modele && modele.chantier && chDe()) remplir(chDe(), false);
  majTrajet(); apercu();
  if (verifierDoublon() && !j) return;

  $('#mj-postes').addEventListener('input', function () { lirePostes(); proposerProd(); apercu(); });
  /* Changer de prestation change l'unité de la quantité : seule l'étiquette
     bouge. Le « change » d'un champ texte, à sa sortie, ne refait plus rien. */
  $('#mj-postes').addEventListener('change', function (e) {
    lirePostes();
    var s = e.target.closest('[data-pstt]');
    if (s && $('#pst-ql-' + s.dataset.pstt)) $('#pst-ql-' + s.dataset.pstt).innerHTML = libelleFait(s.value);
    apercu();
  });
  $('#mj-postes').addEventListener('click', function (e) {
    var plus = e.target.closest('#pst-plus'), sup = e.target.closest('[data-pstsup]'), rep = e.target.closest('#pst-rep');
    if (plus) { lirePostes(); pst.push(posteVide()); }
    else if (sup) { lirePostes(); pst.splice(+sup.dataset.pstsup, 1); }
    else if (rep) { lirePostes(); pstRepartir = !pstRepartir; }
    else return;
    renderPostes(); proposerProd(); apercu();
    if (rep && pstRepartir && $('[data-psth="0"]')) $('[data-psth="0"]').focus();
  });
  ['#mj-total', '#mj-total-m'].forEach(function (x) {
    $(x).addEventListener('input', function () { proposerProd(); apercu(); });
  });
  ['#mj-prod', '#mj-prod-m'].forEach(function (x) {
    $(x).addEventListener('input', function () { etat.prodManuel = dureeTapee('mj-prod'); apercu(); });
  });
  ['#mj-trajet', '#mj-trajet-m', '#mj-km'].forEach(function (x) {
    $(x).addEventListener('input', function () { majTrajet(); aides(); apercu(); });
  });
  $('#mj-pers').addEventListener('input', apercu);
  $('#mj-traj-mod').addEventListener('click', function () {
    etat.trajReplie = false; majTrajet();
    $('#mj-trajet').focus();
  });
  $('#mj-date').addEventListener('change', function () {
    preChoisir();
    if (verifierDoublon() && !j) return;
    apercu();
  });
  $('#mj-ch').addEventListener('change', function () {
    /* Choisi à la main : la date ne le change plus. Ce que le pré-choix avait
       rempli et qu'il n'a pas touché laisse la place au chantier choisi. */
    if (!etat.manuel) oublierAuto();
    etat.manuel = true; etat.aide = ''; etat.auto = {};
    var c = chDe();
    if (c) remplir(c, false);
    majTrajet(); aides();
    if (verifierDoublon() && !j) return;
    apercu();
  });
  $('#mj-doublon').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mjautre]'); if (!b) return;
    fermerModale(); ouvrirJournee(b.dataset.mjautre);
  });
  if ($('#mj-hier')) $('#mj-hier').addEventListener('click', function () {
    /* Le jour reste celui qu'on a choisi : reprendre sert à ne pas retaper
       le chantier et les prestations, pas à revenir en arrière. */
    var jour = dateDe();
    fermerModale();
    ouvrirJournee(null, Object.assign({}, dj, { date: jour }));
  });

  $('#mj-ok').addEventListener('click', function () {
    lirePostes();
    var t = calcul();
    if (t.err) { toast(t.err); return; }
    var postes = pst.filter(function (p) { return p.travaux; }).map(function (p) {
      return { travaux: p.travaux, heures: C.arr(heuresDuPoste(t, p), 3), quantite: C.nb(p.quantite) || 0 };
    });
    if (!postes.length && t.total <= 0 && t.trajet <= 0) {
      toast('Indiquez au moins une prestation ou un temps.'); return;
    }
    var maj = {
      date: versDate($('#mj-date').value) || Date.now(),
      chantier: $('#mj-ch').value || null, lieu: $('#mj-lieu').value.trim(),
      commune: $('#mj-commune').value.trim(),
      nonFacture: !!(j && j.nonFacture),
      km: C.nb($('#mj-km').value) || 0, nonProd: C.arr(t.np, 3), productif: C.arr(t.prod, 3),
      trajet: t.trajet || 0,
      personnes: C.nb($('#mj-pers').value) || 1,
      fin: !!$('#mj-fin').checked, note: $('#mj-note').value.trim(),
      postes: postes, maj: Date.now()
    };
    /* Jamais deux journées pour un même chantier un même jour. */
    var deja = maj.chantier ? journeesDe(maj.chantier, maj.date, j ? j.id : null)[0] : null;
    if (deja) {
      verifierDoublon();
      toast(ditJourneeExistante(chantier(maj.chantier), deja) + ' : une seule journée par chantier et par jour.');
      return;
    }
    A.journees = A.journees || [];
    if (j) Object.keys(maj).forEach(function (k) { j[k] = maj[k]; });
    else { maj.id = uid(); A.journees.push(maj); }
    var ch = maj.chantier ? chantier(maj.chantier) : null;
    /* La case « terminé » fait avancer le chantier : c'est le seul endroit
       où on le sait vraiment, le soir même. */
    if (ch && maj.fin && ch.statut !== 'facture' && ch.statut !== 'paye') {
      ch.statut = 'termine'; ch.maj = Date.now();
    }
    /* « Retenir pour ce chantier » : sa fiche n'avait pas de trajet. */
    if (ch && !$('#mj-retenir-l').hidden && $('#mj-retenir').checked && (maj.km || maj.trajet)) {
      ch.trajetKm = maj.km || null; ch.trajetHeures = maj.trajet || null; ch.maj = Date.now();
    }
    indexerJournees();
    sauverJournees().then(function () { return ch ? sauverChantiers() : null; }).then(function () {
      fermerModale(); majJournees();
      toast(maj.fin ? 'Journée enregistrée, chantier terminé.' : 'Journée enregistrée.');
    });
  });
  if (id) $('#mj-sup').addEventListener('click', function () {
    if (!confirm('Supprimer cette journée ?\n\nIl restera récupérable ' +
      B.JOURS_POUBELLE + ' jours dans ' + B.CHEMIN_CORBEILLE + '.')) return;
    A.journees = A.journees.filter(function (x) { return x.id !== id; });
    jeterObjet('journee', j, dateCourte(j.date) + (j.lieu ? ' — ' + j.lieu : ''),
      C.ditHeures(C.heuresJournee(j)))
      .then(sauverJournees).then(function () {
        fermerModale(); majJournees(); toast('Journée mise à la corbeille.');
      });
  });
}

/* « C'est pénible d'aller chercher les kilomètres. Est-ce qu'il n'y aurait
   pas un moyen de mettre deux communes et que ça les estime ? » Pas sans une
   carte, et l'application n'en a aucune : elle tourne hors ligne, sans
   dépendance. Mais elle a mieux — sa propre mémoire. C'est la même route à
   chaque fois : on propose ce qui a été noté la dernière fois pour ce
   chantier-là. Le plus récent fait foi, et il reste libre de corriger. */
function kmHabituels(idChantier) {
  var vu = 0, quand = 0;
  (A.journees || []).forEach(function (j) {
    if (j.chantier !== idChantier || !C.nb(j.km)) return;
    if (C.nb(j.date) >= quand) { quand = C.nb(j.date); vu = C.nb(j.km); }
  });
  if (vu) return vu;
  /* À défaut, le temps saisi sur la fiche du chantier porte parfois ses
     kilomètres : c'est la même route. */
  var c = chantier(idChantier);
  ((c && c.temps) || []).forEach(function (t) {
    if (!C.nb(t.km)) return;
    if (C.nb(t.date) >= quand) { quand = C.nb(t.date); vu = C.nb(t.km); }
  });
  return vu;
}
