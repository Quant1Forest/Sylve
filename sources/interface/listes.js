/* ================================================= LISTES DÉROULANTES
   Donneurs d'ordre, propriétaires, communes : ce qui est proposé ailleurs
   se règle ici. Et un nom tapé au vol n'entre jamais dans la liste sans
   qu'on le demande — sinon la moindre faute de frappe s'y installe. */
var LISTES = {
  clients: { nom: 'Donneurs d’ordre', champ: 'clients', cle: 'bordcub.clients',
    aide: 'Ceux qui vous confient les chantiers et à qui part la facture : experts, ' +
      'gestionnaires, confrères en sous-traitance, ou un propriétaire qui vous ' +
      'démarche lui-même.' },
  /* Le mot affiché a changé, la clé jamais : « proprios » reste « proprios »
     en base. Voir le tableau du nommage dans les notes du projet — c'est le
     piège le plus coûteux du fichier. */
  proprios: { nom: 'Clients', champ: 'proprios', cle: 'bordcub.proprios',
    aide: 'Celui à qui vous facturez : propriétaire forestier, gestionnaire, ' +
      'entreprise de travaux. À laisser vide quand c’est le donneur d’ordre ' +
      'lui-même. Son type décide si Sylve vous demande un n° SIREN.' },
  lieux: { nom: 'Forêts et communes', champ: 'lieuxRegles', cle: 'bordcub.lieux',
    aide: 'Proposés à la saisie d’une journée et d’un chantier.' },
  essencesCh: { nom: 'Essences', champ: 'essencesCh', cfg: true,
    aide: 'Ce qui s’ajoute à la liste d’origine dans le contexte d’un chantier. ' +
      'Les essences fournies (chêne, hêtre, douglas…) restent toujours proposées.' },
  travaux: { nom: 'Prestations', objets: true,
    aide: 'Ce que vous savez faire. Renommer un libellé le change partout ; ' +
      'une prestation déjà utilisée ne peut pas être retirée.' }
};

/* Combien de fois une prestation a déjà servi : c'est ce qui décide si on
   peut la retirer ou seulement la renommer. */
function usagesTravail(code) {
  var ch = (A.chantiers || []).filter(function (c) {
    return (c.lignes || []).some(function (l) { return l.travail === code; });
  }).length;
  var jr = (A.journees || []).filter(function (j) {
    return (j.postes || []).some(function (p) { return p.travaux === code; });
  }).length;
  return { chantiers: ch, journees: jr, total: ch + jr };
}
function listeDe(k) {
  var d = LISTES[k]; if (!d) return [];
  var socle = d.cfg ? (A.cfg = A.cfg || {}) : A;
  socle[d.champ] = socle[d.champ] || [];
  return socle[d.champ];
}
function sauverListe(k) {
  var d = LISTES[k];
  listeDe(k);
  return Promise.resolve(d.cfg ? sauverCfg() : ecrire(d.cle, listeDe(k))).then(function () {
    majDatalistClients(); majDatalistLieux();
  });
}
var SEUIL_LISTE = 8, listeDepliee = false;
function renderListesReglages() {
  var nav = $('#rl-nav'); if (!nav) return;
  var actif = A.listeReglee && LISTES[A.listeReglee] ? A.listeReglee : 'clients';
  A.listeReglee = actif;
  nav.innerHTML = Object.keys(LISTES).map(function (k) {
    return '<button class="sous-onglet" data-liste="' + k + '" role="tab" aria-selected="' +
      (k === actif) + '">' + esc(LISTES[k].nom) + '</button>';
  }).join('');
  var aide = '<p class="muted" style="font-size:12px;margin:0 0 9px">' +
    esc(LISTES[actif].aide) + '</p>';
  if (LISTES[actif].objets) {
    var t = C.TRAVAUX.slice().sort(function (a, b) {
      return (a.retire ? 1 : 0) - (b.retire ? 1 : 0) || a.n.localeCompare(b.n, 'fr');
    });
    /* Cinquante prestations d'un bloc, c'est la liste la plus longue de
       toutes : elle se replie comme les autres. */
    var toutT = listeDepliee || t.length <= SEUIL_LISTE;
    $('#rl-liste').innerHTML = aide + (toutT ? t : t.slice(0, SEUIL_LISTE)).map(function (x) {
      var u = usagesTravail(x.c);
      return '<div class="liste-item' + (x.retire ? ' epuise' : '') + '">' +
        '<div class="li-c"><b>' + esc(x.n) + '</b><small>' +
        esc(C.nomUnite(x.u, 2)) + ' · TVA ' + String(x.tvaAvec).replace('.', ',') + ' %' +
        (u.total ? ' · utilisée ' + u.total + ' fois' : ' · jamais utilisée') +
        (x.retire ? ' · retirée des listes' : '') + '</small></div>' +
        '<button class="btn-min" data-lmodif="' + esc(x.c) + '">Modifier</button></div>';
    }).join('') +
      (t.length > SEUIL_LISTE
        ? '<button class="btn-min" id="rl-plus" style="margin-top:9px">' +
          (toutT ? 'Réduire la liste' : 'Voir les ' + (t.length - SEUIL_LISTE) + ' autres') +
          '</button>'
        : '');
    return;
  }
  var l = listeDe(actif).slice().sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  /* Quarante-sept noms déroulés d'un bloc, c'est un écran entier à faire
     défiler pour atteindre le bouton suivant. On en montre huit. */
  var tout = listeDepliee || l.length <= SEUIL_LISTE;
  var vus = tout ? l : l.slice(0, SEUIL_LISTE);
  $('#rl-liste').innerHTML = aide +
    (l.length ? vus.map(function (x) {
      return '<div class="liste-item"><div class="li-c"><b>' + esc(x) + '</b></div>' +
        '<button class="btn-min" data-lmodif="' + esc(x) + '">Modifier</button></div>';
    }).join('') +
      (l.length > SEUIL_LISTE
        ? '<button class="btn-min" id="rl-plus" style="margin-top:9px">' +
          (tout ? 'Réduire la liste' : 'Voir les ' + (l.length - SEUIL_LISTE) + ' autres') +
          '</button>'
        : '')
      : '<p class="muted" style="font-size:12.5px;margin:0">Liste vide.</p>');
}

/* Renommer, ajouter, retirer une prestation. */
function ouvrirTravailRegle(code) {
  var t = code ? C.TRAVAUX.filter(function (x) { return x.c === code; })[0] : null;
  if (code && !t) return;
  var u = code ? usagesTravail(code) : { total: 0 };
  modale(code ? 'Modifier la prestation' : 'Nouvelle prestation',
    '<div class="champ"><label class="eyebrow" for="tr-nom">Nom</label>' +
    '<input type="text" id="tr-nom" class="gros" autocomplete="off" value="' +
    esc(t ? t.n : '') + '"></div>' +
    /* La famille se règle ici : le rangement livré n'est qu'un défaut, et
       c'est lui qui sait dans laquelle il compte ses chantiers. Les
       fournitures n'en prennent pas — la nature de la ligne le dit déjà. */
    (t && t.fourniture ? '' :
      '<div class="champ"><label class="eyebrow" for="tr-cat">Famille</label>' +
      '<select id="tr-cat"><option value="">— sans famille —</option>' +
      C.CAT_TRAVAUX.map(function (x) {
        return '<option value="' + x.c + '"' + (t && t.cat === x.c ? ' selected' : '') + '>' +
          esc(x.n) + '</option>';
      }).join('') + '</select></div>') +
    '<div class="grille g2">' +
    /* « Unité de facturation » se lisait comme une règle : il croyait que la
       prestation ne pouvait se facturer qu'ainsi, alors qu'il facture la même
       tantôt à la journée, tantôt à l'hectare. Ce n'est qu'un défaut. */
    '<div class="champ"><label class="eyebrow" for="tr-unite">Unité proposée</label>' +
    '<select id="tr-unite">' + C.UNITES.map(function (x) {
      return '<option value="' + x.c + '"' + (t && t.u === x.c ? ' selected' : '') + '>' +
        esc(x.n) + '</option>';
    }).join('') + '</select></div>' +
    (code ? '' : '<div class="champ"><label class="eyebrow" for="tr-tva">TVA (%)</label>' +
      '<select id="tr-tva">' + [20, 10, 5.5, 0].map(function (x) {
        return '<option value="' + x + '"' + (x === 20 ? ' selected' : '') + '>' +
          String(x).replace('.', ',') + ' %</option>';
      }).join('') + '</select></div>') +
    '</div>' +
    (code && u.total
      ? '<p class="muted" style="font-size:12px;margin:11px 0 0;padding:9px 11px;' +
        'background:var(--carte2);border-radius:9px">Cette prestation figure sur ' +
        (u.chantiers ? u.chantiers + ' chantier' + (u.chantiers > 1 ? 's' : '') : '') +
        (u.chantiers && u.journees ? ' et ' : '') +
        (u.journees ? u.journees + ' journée' + (u.journees > 1 ? 's' : '') : '') +
        '. La renommer change le libellé partout, sans rien recalculer. ' +
        'La retirer est impossible tant qu’elle sert.</p>'
      : code ? '<p class="muted" style="font-size:12px;margin:11px 0 0">Jamais utilisée : ' +
        'vous pouvez la retirer des listes.</p>' : '') +
    '<p class="muted" style="font-size:12px;margin:11px 0 0">L’unité est ' +
    'seulement <b>proposée</b> quand vous choisissez cette prestation sur une ' +
    'ligne : vous la changez ensuite ligne par ligne, sans rien modifier ici.</p>' +
    (code && t.tvaAvec != null
      ? '<p class="muted" style="font-size:11.5px;margin:9px 0 0">TVA ' +
        String(t.tvaSans).replace('.', ',') + ' % sans SIREN, ' +
        String(t.tvaAvec).replace('.', ',') + ' % avec. Les taux livrés ne se modifient pas.</p>' : '') +
    '<div class="btn-rang" style="margin-top:12px">' +
    '<button class="btn primaire" id="tr-ok">Valider</button>' +
    (code && !t.retire && !u.total ? '<button class="btn danger btn-min" id="tr-sup">Retirer</button>' : '') +
    (code && t.retire ? '<button class="btn btn-min" id="tr-remet">Remettre dans les listes</button>' : '') +
    '</div>');

  $('#tr-ok').addEventListener('click', function () {
    var nom = $('#tr-nom').value.trim();
    if (!nom) { toast('Donnez un nom.'); return; }
    A.cfg.travauxPerso = A.cfg.travauxPerso || {};
    if (code) {
      if (nom !== t.n) {
        if (!confirm('Renommer « ' + t.n +' » en « ' + nom + ' » ?' +
          (u.total ? '\n\nLe nouveau nom s’affichera sur ' + u.total +
            ' saisie' + (u.total > 1 ? 's' : '') + ' existante' + (u.total > 1 ? 's' : '') + '.' : ''))) return;
        if (!confirm('Confirmer : « ' + nom + ' » remplacera « ' + t.n +
          ' » partout dans l’application.')) return;
      }
      var e = A.cfg.travauxPerso[code] || (A.cfg.travauxPerso[code] = {});
      e.n = nom; e.u = $('#tr-unite').value;
      if ($('#tr-cat')) e.cat = $('#tr-cat').value;
    } else {
      var neuf = 'X' + Date.now().toString(36).toUpperCase();
      var tv = C.nb($('#tr-tva').value);
      A.cfg.travauxPerso[neuf] = { n: nom, u: $('#tr-unite').value, tvaSans: tv, tvaAvec: tv,
        cat: $('#tr-cat') ? $('#tr-cat').value : '' };
    }
    C.appliquerTravauxPerso(A.cfg);
    sauverCfg();
    fermerModale(); renderListesReglages(); renderFiche(); renderRendements(); renderCarnet();
    toast(code ? 'Prestation renommée.' : 'Prestation ajoutée.');
  });
  if ($('#tr-sup')) $('#tr-sup').addEventListener('click', function () {
    if (!confirm('Retirer « ' + t.n + ' » des listes ?\n\nElle ne vous sera plus proposée.')) return;
    A.cfg.travauxRetires = (A.cfg.travauxRetires || []).concat([code]);
    C.appliquerTravauxPerso(A.cfg); sauverCfg();
    fermerModale(); renderListesReglages(); toast('Prestation retirée.');
  });
  if ($('#tr-remet')) $('#tr-remet').addEventListener('click', function () {
    A.cfg.travauxRetires = (A.cfg.travauxRetires || []).filter(function (x) { return x !== code; });
    C.appliquerTravauxPerso(A.cfg); sauverCfg();
    fermerModale(); renderListesReglages(); toast('Prestation rétablie.');
  });
}
function ouvrirEntreeListe(nom) {
  var k = A.listeReglee, d = LISTES[k];
  modale(nom ? 'Modifier' : 'Ajouter — ' + d.nom,
    '<div class="champ"><label class="eyebrow" for="le-nom">Nom</label>' +
    '<input type="text" id="le-nom" class="gros" autocomplete="off" value="' + esc(nom || '') + '"></div>' +
    '<div class="btn-rang" style="margin-top:11px">' +
    '<button class="btn primaire" id="le-ok">Valider</button>' +
    (nom ? '<button class="btn danger btn-min" id="le-sup">Supprimer</button>' : '') + '</div>');
  $('#le-ok').addEventListener('click', function () {
    var v = $('#le-nom').value.trim();
    if (!v) { toast('Donnez un nom.'); return; }
    var l = listeDe(k);
    var i = nom ? l.indexOf(nom) : -1;
    if (i >= 0) l[i] = v; else if (l.indexOf(v) < 0) l.push(v);
    sauverListe(k).then(function () {
      fermerModale(); renderListesReglages(); toast(nom ? 'Modifié.' : 'Ajouté.');
    });
  });
  if (nom) $('#le-sup').addEventListener('click', function () {
    if (!confirm('Retirer « ' + nom + ' » de la liste ?\n\nLes fiches qui le mentionnent ne changent pas.')) return;
    A[d.champ] = listeDe(k).filter(function (x) { return x !== nom; });
    sauverListe(k).then(function () {
      fermerModale(); renderListesReglages(); toast('Retiré.');
    });
  });
}
/* À l'import, les listes se remplissent seules : demander confirmation pour
   chacun des cinquante noms d'un fichier serait intenable. */
function ajouterListe(k, nom) {
  if (!nom || !LISTES[k]) return false;
  var l = listeDe(k), bas = String(nom).trim().toLowerCase();
  if (!bas || l.some(function (x) { return x.toLowerCase() === bas; })) return false;
  l.push(String(nom).trim());
  return true;
}
/* Tout ce qu'un lot de données apporte comme noms nouveaux, d'un coup. */
function moissonnerListes(src) {
  var n = 0;
  (src.clients || []).forEach(function (x) { if (ajouterListe('clients', x)) n++; });
  (src.proprios || []).forEach(function (x) { if (ajouterListe('proprios', x)) n++; });
  (src.chantiers || []).forEach(function (c) {
    if (ajouterListe('clients', c.donneur)) n++;
    if (ajouterListe('proprios', c.proprietaire)) n++;
    if (ajouterListe('lieux', c.foret)) n++;
    if (ajouterListe('lieux', c.commune)) n++;
  });
  (src.sorties || []).forEach(function (v) { if (ajouterListe('clients', v.client)) n++; });
  (src.piles || []).forEach(function (v) { if (ajouterListe('lieux', v.lieu)) n++; });
  (src.journees || []).forEach(function (j) {
    if (ajouterListe('lieux', j.lieu)) n++;
    if (ajouterListe('lieux', j.commune)) n++;
  });
  if (n) {
    ecrire('bordcub.clients', listeDe('clients'));
    ecrire('bordcub.proprios', listeDe('proprios'));
    ecrire('bordcub.lieux', listeDe('lieux'));
    majDatalistClients(); majDatalistLieux();
  }
  return n;
}

/* Un nom saisi ailleurs qu'ici : on propose de l'ajouter, on ne le fait pas
   à sa place. Retourne une promesse pour ne pas bloquer l'enregistrement. */
function proposerAjoutListe(k, nom) {
  if (!nom) return Promise.resolve(false);
  var l = listeDe(k), bas = nom.toLowerCase();
  if (l.some(function (x) { return x.toLowerCase() === bas; })) return Promise.resolve(false);
  if (!confirm('« ' + nom + ' » n’est pas dans vos ' + LISTES[k].nom.toLowerCase() +
    '.\n\nL’ajouter à la liste ?')) return Promise.resolve(false);
  l.push(nom);
  return sauverListe(k).then(function () { return true; });
}
function majDatalistLieux() {
  var d = $('#lieux-connus');
  if (d) d.innerHTML = lieuxConnus().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('');
}

