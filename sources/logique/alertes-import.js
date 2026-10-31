/* ============================================================== ALERTES
   Calculées à l'ouverture : pas de notification système possible sans
   serveur, donc tout remonte dans un bandeau. */
/* « 1 journée », « 2,5 journées » : le demi se dit, l'entier ne s'encombre
   pas d'une décimale. */
function fmtJours(n) {
  var v = arr(nb(n), 2);
  return String(v).replace('.', ',') + ' journée' + (v > 1 ? 's' : '');
}
/* Deux semaines avant la fin de validité : de quoi passer un coup de fil et
   laisser le temps de signer. Plus tôt, l'avis s'installe et ne se lit plus ;
   plus tard, il ne sert qu'à constater. */
var PREAVIS_DEVIS = 14;

function alertes(chantiers, cfg, maintenant) {
  var now = maintenant || Date.now();
  var relanceDevis = nb(cfg && cfg.joursRelanceDevis) || 21;
  var relanceFacture = nb(cfg && cfg.joursRelanceFacture) || 45;
  var out = [];
  (chantiers || []).forEach(function (ch) {
    if (enRetard(ch, now)) {
      /* ch.fin n'existe plus depuis que l'échéance de chantier a été retirée :
         la phrase annonçait « Invalid Date ». C'est le dernier jour posé qui
         date la chose. */
      var dernier = dateChantier(ch);
      out.push({ type: 'retard', chantier: ch, gravite: 2,
        texte: dernier
          ? 'dernière journée posée le ' + new Date(dernier).toLocaleDateString('fr-FR') +
            ', chantier pas encore terminé'
          : 'toutes les journées posées sont passées, chantier pas encore terminé' });
    }
    /* Un devis a sa propre échéance : celle qu'il porte écrite. Quand elle
       est connue, c'est elle qui parle — approcher de la fin de validité
       sans réponse est le vrai moment de relancer. Le délai réglable ne
       sert plus que faute de validité saisie. */
    if (ch.statut === 'envoye') {
      var fin = finValiditeDevis(ch);
      if (fin != null) {
        var reste = Math.round((minuit(fin) - minuit(now)) / JOUR);
        if (reste < 0) {
          out.push({ type: 'devis', chantier: ch, gravite: 2, jours: -reste, fin: fin,
            texte: 'devis expiré le ' + new Date(fin).toLocaleDateString('fr-FR') + ', sans réponse' });
        } else if (reste <= PREAVIS_DEVIS) {
          out.push({ type: 'devis', chantier: ch, gravite: 1, jours: reste, fin: fin,
            texte: reste === 0 ? 'devis valable jusqu’à aujourd’hui, sans réponse'
              : 'devis valable ' + reste + ' jour' + (reste > 1 ? 's' : '') + ' encore, sans réponse' });
        }
      } else if (ch.dateEnvoi) {
        var j = Math.round((minuit(now) - minuit(ch.dateEnvoi)) / JOUR);
        if (j >= relanceDevis) {
          out.push({ type: 'devis', chantier: ch, gravite: 1, jours: j,
            texte: 'devis envoyé il y a ' + j + ' jours, sans réponse' });
        }
      }
    }
    /* Une facture porte sa propre échéance : c'est elle qui dit le retard, et
       non un délai général. Le délai réglable ne sert plus que faute
       d'échéance saisie. */
    if (ch.statut === 'facture') {
      var enRetardDe = retardPaiement(ch, now);
      if (enRetardDe != null) {
        out.push({ type: 'impaye', chantier: ch, gravite: 3, jours: enRetardDe,
          texte: 'échéance dépassée de ' + enRetardDe + ' jour' + (enRetardDe > 1 ? 's' : '') +
            ' — à payer avant le ' + new Date(ch.echeancePaiement).toLocaleDateString('fr-FR') });
      } else if (!ch.echeancePaiement && ch.dateFacture) {
        var j2 = Math.round((minuit(now) - minuit(ch.dateFacture)) / JOUR);
        if (j2 >= relanceFacture) {
          out.push({ type: 'impaye', chantier: ch, gravite: 3, jours: j2,
            texte: 'facturé il y a ' + j2 + ' jours, non réglé' });
        }
      }
    }
    /* Ce qui est posé au calendrier dans les trois jours. Un chantier prévu
       après-demain ne doit pas s'apprendre en ouvrant l'agenda : il doit
       sauter aux yeux dès l'accueil. */
    if (['accepte', 'encours', 'termine'].indexOf(ch.statut) >= 0) {
      var proches = journeesPlacees(ch).filter(function (x) {
        var d = Math.round((minuit(x.d) - minuit(now)) / JOUR);
        return d >= 0 && d <= 3;
      });
      if (proches.length) {
        var d0 = Math.round((minuit(proches[0].d) - minuit(now)) / JOUR);
        var part = proches.reduce(function (s, x) { return s + nb(x.p); }, 0);
        out.push({ type: 'approche', chantier: ch, gravite: 2, jours: d0,
          texte: (d0 === 0 ? 'aujourd’hui' : d0 === 1 ? 'demain' : 'dans ' + d0 + ' jours') +
            ' · ' + fmtJours(part) + (proches.length > 1 ? ' sur ' + proches.length + ' dates' : '') });
      }
    }
    /* Un chantier engagé — accepté ou commencé — doit dire ce qu'il reste à
       poser. Sans cela « À traiter » ne montrait que ce qui a mal tourné :
       impayés, retards. Le travail à venir, lui, n'y figurait pas. */
    if (ch.statut === 'accepte' || ch.statut === 'encours') {
      var reste = resteAPlacer(ch);
      var place = totalPlace(ch);
      if (reste == null && !place) {
        out.push({ type: 'aprevoir', chantier: ch, gravite: 1,
          texte: 'aucune journée prévue — estimez et placez' });
      } else if (reste != null && reste > 0) {
        out.push({ type: 'aplacer', chantier: ch, gravite: 1, jours: reste,
          texte: fmtJours(reste) + ' à placer sur ' + fmtJours(joursPrevus(ch)) + ' estimées' });
      } else if (reste == null && place > 0) {
        out.push({ type: 'encours', chantier: ch, gravite: 0,
          texte: fmtJours(place) + ' posée' + (place > 1 ? 's' : '') + ', pas d’estimation' });
      }
    }
    if (ch.statut === 'termine' && ch.dateFin) {
      var j3 = Math.round((minuit(now) - minuit(ch.dateFin)) / JOUR);
      if (j3 >= 15) {
        out.push({ type: 'afacturer', chantier: ch, gravite: 2, jours: j3,
          texte: 'terminé il y a ' + j3 + ' jours, pas encore facturé' });
      }
    }
  });
  return out.sort(function (a, b) { return b.gravite - a.gravite; });
}


/* ====================================================== IMPORT CSV
   Pour reprendre l'historique sans tout ressaisir à la main. Une ligne par
   ligne de travaux ; plusieurs lignes portant le même nom de chantier sont
   regroupées. Séparateur point-virgule (celui d'Excel en français). */
var COLONNES_CSV = ['chantier', 'date', 'donneur', 'proprietaire', 'foret', 'parcelles',
  'travail', 'unite', 'quantite', 'prix', 'nature', 'tva', 'jours', 'personnes',
  'essence', 'densite', 'hauteur', 'difficulte', 'terrain', 'statut', 'note'];

function modeleCsv() {
  return COLONNES_CSV.join(';') + '\r\n' +
    'Clairbois plantation;15/03/2025;Cabinet Dubois;GF des Sapins;Clairbois;12;PLANT;plant;2000;0,45;prestation;10;5;1;DOU;1100;;2;1;paye;\r\n' +
    'Clairbois plantation;15/03/2025;Cabinet Dubois;GF des Sapins;Clairbois;12;PROTEC;unite;2000;0,90;vente;20;;;;;;;;;\r\n';
}
function decoupeCsv(txt) {
  var lignes = String(txt).replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (!lignes.length) return [];
  var sep = (lignes[0].split(';').length >= lignes[0].split(',').length) ? ';' : ',';
  return lignes.map(function (l) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < l.length; i++) {
      var ch = l[i];
      if (q) {
        if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(function (x) { return x.trim(); });
  });
}
function dateFr(s) {
  if (!s) return null;
  var m = String(s).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    var an = Number(m[3]); if (an < 100) an += 2000;
    return new Date(an, Number(m[2]) - 1, Number(m[1]), 12).getTime();
  }
  var m2 = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]), 12).getTime();
  return null;
}
/* Reconnaît un travail par son code ou par son nom, accents et casse ignorés. */
function normalise(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function trouveTravail(s) {
  var n = normalise(s);
  if (!n) return null;
  for (var i = 0; i < TRAVAUX.length; i++) {
    if (normalise(TRAVAUX[i].c) === n || normalise(TRAVAUX[i].n) === n) return TRAVAUX[i].c;
  }
  for (var j = 0; j < TRAVAUX.length; j++) {
    if (normalise(TRAVAUX[j].n).indexOf(n) === 0) return TRAVAUX[j].c;
  }
  return null;
}
function trouveUnite(s) {
  var n = normalise(s);
  for (var i = 0; i < UNITES.length; i++) {
    if (normalise(UNITES[i].c) === n || normalise(UNITES[i].n) === n || normalise(UNITES[i].court) === n) return UNITES[i].c;
  }
  return null;
}
/* Les intitulés changent parfois — « Accepté » est devenu « Devis signé ».
   Un fichier exporté avant garde l'ancien mot : les alias le rattrapent. */
function trouveStatut(s) {
  var n = normalise(s);
  for (var i = 0; i < STATUTS.length; i++) {
    var st = STATUTS[i];
    var mots = [st.c, st.n].concat(st.sansDevis ? [st.sansDevis] : [], st.alias || []);
    for (var k = 0; k < mots.length; k++) if (normalise(mots[k]) === n) return st.c;
  }
  return null;
}
function trouveEssence(s) {
  var n = normalise(s);
  if (!n) return null;
  for (var i = 0; i < ESSENCES_CH.length; i++) {
    if (normalise(ESSENCES_CH[i].c) === n || normalise(ESSENCES_CH[i].n) === n) return ESSENCES_CH[i].c;
  }
  return null;
}

/* Analyse un CSV et renvoie les chantiers reconstitués + les anomalies.
   Rien n'est enregistré ici : l'appelant montre le résultat avant d'écrire. */
function analyseCsv(txt) {
  var l = decoupeCsv(txt);
  if (!l.length) return { chantiers: [], erreurs: ['Fichier vide.'], lignes: 0 };
  var entete = l[0].map(normalise);
  var idx = {};
  COLONNES_CSV.forEach(function (col) {
    var i = entete.indexOf(normalise(col));
    if (i >= 0) idx[col] = i;
  });
  if (idx.chantier == null || idx.travail == null) {
    return { chantiers: [], erreurs: ['En-tête non reconnue : il faut au minimum les colonnes « chantier » et « travail ».'], lignes: 0 };
  }
  var val = function (r, col) { return idx[col] != null ? (r[idx[col]] || '') : ''; };
  var parNom = {}, ordre = [], erreurs = [], n = 0;

  for (var i = 1; i < l.length; i++) {
    var r = l[i], num = i + 1;
    var nom = val(r, 'chantier');
    if (!nom) { erreurs.push('Ligne ' + num + ' : nom de chantier manquant.'); continue; }
    var trav = trouveTravail(val(r, 'travail'));
    if (!trav) { erreurs.push('Ligne ' + num + ' : travail « ' + val(r, 'travail') + ' » inconnu.'); continue; }
    var unite = trouveUnite(val(r, 'unite')) || uniteDe(trav);
    var q = nb(val(r, 'quantite')), prix = nb(val(r, 'prix'));
    if (!q && unite !== 'forfait') erreurs.push('Ligne ' + num + ' : quantité absente.');
    if (!prix) erreurs.push('Ligne ' + num + ' : prix absent.');

    if (!parNom[nom]) {
      var st = trouveStatut(val(r, 'statut')) || 'paye';
      var d = dateFr(val(r, 'date'));
      var ess = trouveEssence(val(r, 'essence'));
      parNom[nom] = {
        nom: nom, donneur: val(r, 'donneur'), proprietaire: val(r, 'proprietaire'),
        foret: val(r, 'foret'), parcelles: val(r, 'parcelles'),
        statut: st, dateFacture: d, dateFin: d, debut: d,
        tva: nb(val(r, 'tva')) || 20,
        criteres: {
          essence: ess, densite: nb(val(r, 'densite')) || null,
          hauteur: nb(val(r, 'hauteur')) || null,
          difficulte: nb(val(r, 'difficulte')) || null,
          terrain: nb(val(r, 'terrain')) || null
        },
        notes: val(r, 'note'), lignes: [], temps: []
      };
      var jours = nb(val(r, 'jours'));
      if (jours > 0) {
        parNom[nom].temps.push({ date: d || Date.now(), duree: jours, unite: 'j',
          personnes: nb(val(r, 'personnes')) || 1, activite: trav });
      }
      ordre.push(nom);
    }
    var nature = normalise(val(r, 'nature')).indexOf('vente') === 0 ? 'vente' : 'prestation';
    var tvaL = nb(val(r, 'tva'));
    parNom[nom].lignes.push({ travail: trav, unite: unite, quantite: q, prix: prix,
      nature: nature, tva: tvaL || null, note: '' });
    n++;
  }
  return { chantiers: ordre.map(function (k) { return parNom[k]; }), erreurs: erreurs, lignes: n };
}

/* --------------------------------------------------------------- carnet */
/* Où en est le chantier dans le temps : sa dernière étape franchie. À ne pas
   confondre avec dateChantier(), qui rend le dernier jour travaillé. */
function dernierEvenement(c) {
  if (!c) return 0;
  return nb(c.datePaiement) || nb(c.dateFacture) || nb(c.dateFin) ||
    nb(c.dateEnvoi) || nb(c.debut) || nb(c.maj) || 0;
}
/* Le carnet se lit du plus récent au plus ancien. Il était rangé par statut,
   si bien qu'un chantier accepté ce matin passait derrière tous les devis :
   on ne retrouvait pas ce qu'on venait d'ouvrir. Le statut ne sert plus qu'à
   départager deux chantiers du même jour. */
/* Du plus récent au plus ancien par défaut : c'est ce qu'on vient de toucher
   qu'on cherche. Mais reprendre un historique se fait dans l'autre sens, en
   remontant le temps — d'où le bouton. */
/* L'ordre de la comptabilité, celui de ses classeurs : la date de facture fait
   foi au plus haut niveau ; à défaut celle du devis ; à défaut le chantier le
   plus récemment rentré.
   À ne pas confondre avec dernierEvenement(), qui dit la dernière étape
   franchie et date les sorties de stock : détourner celle-là aurait re-daté
   ses mouvements. Un chantier payé la semaine dernière mais facturé il y a
   trois mois se range à sa facture, pas à son paiement. */
/* Le jour où le chantier est entré dans Sylve. Il ne dit rien des travaux —
   c'est l'ordre d'arrivée, et c'est ce qui range ceux qui n'ont ni devis ni
   facture. Posée à la création, corrigeable sur la fiche : un chantier saisi
   après coup n'est pas arrivé aujourd'hui.
   Repli sur `cree` : les chantiers d'avant en ont un, rien à migrer. */
function dateEntree(c) {
  if (!c) return 0;
  return nb(c.dateEntree) || nb(c.cree) || nb(c.maj) || 0;
}

/* « De pouvoir choisir : du plus ancien au plus récent, ok, mais de choisir
   si c'est sur le numéro de facture, sur la date de paiement, sur la date
   d'émission de la facture ou sur celle du devis. »
   `auto` est l'ordre du classeur, celui d'avant : le numéro de facture quand
   les deux en ont un, les dates comptables sinon. */
var TRIS_CH = [
  { c: 'auto', n: 'Ordre du classeur' },
  { c: 'facture', n: 'N° de facture' },
  { c: 'datefacture', n: 'Date de facture' },
  { c: 'paiement', n: 'Date de paiement' },
  { c: 'devis', n: 'Date du devis' },
  { c: 'entree', n: 'Date d’entrée' }
];
/* La valeur du critère, ou 0 quand le chantier ne l'a pas. */
function cleTri(c, quoi) {
  if (quoi === 'facture') return rangFacture(c);
  if (quoi === 'datefacture') return nb(c.dateFacture);
  if (quoi === 'paiement') return nb(c.datePaiement);
  if (quoi === 'devis') return nb(c.dateDevis);
  if (quoi === 'entree') return dateEntree(c);
  return 0;
}
function rangComptable(c) {
  if (!c) return 0;
  return nb(c.dateFacture) || nb(c.dateDevis) || nb(c.cree) || nb(c.maj) || 0;
}
/* Le numéro de facture, rendu comparable. « F-2026-0010 » vaut l'année puis le
   rang : deux factures du même jour se suivent alors dans l'ordre du
   classeur, ce que la seule date ne savait pas faire. */
function rangFacture(c) {
  var s = String((c && c.numeroFacture) || '').trim();
  if (!s) return 0;
  var m = s.match(/(\d{4})\D+(\d+)\s*$/);
  if (m) return Number(m[1]) * 1000000 + Number(m[2]);
  var n = s.match(/(\d+)\s*$/);
  return n ? Number(n[1]) : 0;
}
function tri(chantiers, ancienDabord, critere) {
  if (critere && critere !== 'auto') {
    /* Ceux qui portent la valeur devant, dans l'ordre demandé ; ceux qui ne
       l'ont pas derrière, par ordre d'arrivée. Les mêler reviendrait à les
       ranger sur une date qu'ils n'ont pas. */
    var avec = [], sans = [];
    (chantiers || []).forEach(function (c) {
      (cleTri(c, critere) ? avec : sans).push(c);
    });
    avec.sort(function (a, b) {
      var x = cleTri(a, critere), y = cleTri(b, critere);
      if (x !== y) return ancienDabord ? x - y : y - x;
      return rangStatut(a.statut) - rangStatut(b.statut);
    });
    sans.sort(function (a, b) { return dateEntree(b) - dateEntree(a); });
    return avec.concat(sans);
  }
  return (chantiers || []).slice().sort(function (a, b) {
    /* Entre deux chantiers facturés, le numéro prime sur tout : c'est l'ordre
       de ses classeurs. Dès que l'un des deux n'a pas de facture, on retombe
       sur les dates — un chantier en cours n'a pas à être relégué. */
    var fa = rangFacture(a), fb = rangFacture(b);
    if (fa && fb) {
      if (fa !== fb) return ancienDabord ? fa - fb : fb - fa;
    } else {
      var da = rangComptable(a), db = rangComptable(b);
      if (da !== db) return ancienDabord ? da - db : db - da;
    }
    return rangStatut(a.statut) - rangStatut(b.statut);
  });
}
function filtre(chantiers, quoi) {
  var l = chantiers || [];
  if (!quoi || quoi === 'ouverts') return l.filter(function (c) { return statutOuvert(c.statut); });
  if (quoi === 'tous') return l.slice();
  if (quoi === 'acompleter') return l.filter(function (c) { return !ficheComplete(c); });
  /* « Sélectionner uniquement les chantiers qui ont eu un devis. » Tous n'en
     partent pas : un client qui rappelle pour finir une parcelle, un
     dépannage. */
  if (quoi === 'avecdevis') return l.filter(function (c) { return aDevis(c); });
  if (quoi === 'clos') return l.filter(function (c) { return !statutOuvert(c.statut); });
  /* « L'idée : filtrer par grande famille. » Un chantier y figure dès qu'une
     de ses lignes en relève : celui qui mêle plantation et protections se
     retrouve sous les deux. La famille suit les réglages, où il la change. */
  if (quoi.indexOf('fam:') === 0) {
    var fam = quoi.slice(4);
    return l.filter(function (c) {
      return (c.lignes || []).some(function (x) { return categorieLigne(x) === fam; });
    });
  }
  /* « Uniquement ce qui est à faire ou en cours, pour voir ce qui me reste à
     faire et m'organiser. » Un chantier terminé ou facturé ne demande plus
     de journée, même s'il reste ouvert tant qu'il n'est pas payé. */
  if (quoi === 'afaire') {
    return l.filter(function (c) { return c.statut === 'accepte' || c.statut === 'encours'; });
  }
  return l.filter(function (c) { return c.statut === quoi; });
}
/* Chercher un chantier par ce dont on se souvient : le nom, qui l'a donné,
   la commune, ou le numéro porté sur la facture ou le devis. Les accents et
   les majuscules ne comptent pas — le numéro se tape d'une main.
   Plusieurs mots doivent tous se retrouver, pas forcément dans le même
   champ : « dubois clairbois » sort le chantier de Clairbois passé par Dubois. */
/* Ce qu'une fiche doit porter pour être exploitable. Rien n'est jamais
   bloqué à la saisie — on note trois mots sur un bord de route et on complète
   le soir — mais on doit pouvoir retrouver ce qui est resté à moitié rempli.
   Chaque champ n'est réclamé qu'à partir de l'étape où il a un sens : demander
   un numéro de facture sur un devis n'aurait aucun intérêt. */
/* Chaque champ n'est réclamé que sur la tranche d'étapes où il sert encore.
   « des » dit à partir de quand, « jusqua » jusqu'à quand — car un champ peut
   perdre son sens en avançant : réclamer des journées estimées sur un chantier
   payé il y a deux ans n'a aucun intérêt, il est fait et réglé. On n'estime
   pas le passé.
   Un chantier repris d'un ancien carnet arrive directement à « payé » : il ne
   doit donc rien manquer d'autre que ce qui sert encore à le retrouver et à le
   comptabiliser. */
var CHAMPS_FICHE = [
  { c: 'donneur', n: 'donneur d’ordre', des: 'devis' },
  { c: 'commune', n: 'commune', des: 'devis', jusqua: 'termine' },
  { c: 'lignes', n: 'lignes de travaux', des: 'accepte' },
  { c: 'joursEstimes', n: 'journées estimées', des: 'accepte', jusqua: 'encours' },
  { c: 'numeroDevis', n: 'numéro de devis', des: 'envoye', devisSeul: true, jusqua: 'accepte' },
  { c: 'numeroFacture', n: 'numéro de facture', des: 'facture' },
  { c: 'dateFacture', n: 'date de facture', des: 'facture' },
  { c: 'echeancePaiement', n: 'échéance de paiement', des: 'facture', jusqua: 'facture' },
  { c: 'datePaiement', n: 'date de paiement', des: 'paye' }
];
function champsManquants(ch) {
  if (!ch) return [];
  var rang = rangStatut(ch.statut);
  return CHAMPS_FICHE.filter(function (x) {
    if (x.devisSeul && !aDevis(ch)) return false;
    /* Sans suite : on n'a plus rien à réclamer, le chantier ne se fera pas. */
    if (ch.statut === 'sansuite') return false;
    if (rang < rangStatut(x.des)) return false;
    /* Passé son étape, le champ ne se réclame plus : il ne servirait qu'à
       marquer « incomplet » un chantier que plus rien n'attend. */
    if (x.jusqua && rang > rangStatut(x.jusqua)) return false;
    var v = ch[x.c];
    if (x.c === 'lignes') return !(v && v.length);
    return v == null || v === '' || v === 0;
  }).map(function (x) { return x.n; });
}
function ficheComplete(ch) { return champsManquants(ch).length === 0; }

function chercher(chantiers, q) {
  var mots = normalise(q).split(/\s+/).filter(Boolean);
  if (!mots.length) return (chantiers || []).slice();
  return (chantiers || []).filter(function (c) {
    /* Le nom composé et l'ancien nom : depuis que le nom se compose, celui
       qu'il avait tapé ne s'affiche plus — mais c'est encore par ce mot-là
       qu'il cherche un vieux chantier. Les deux sont dans la botte. */
    var foin = normalise([nomChantier(c), c.nom, c.donneur, c.client, c.proprietaire,
      c.foret, c.parcelles, c.commune, c.numeroFacture, c.numeroDevis, c.notes]
      .filter(Boolean).join(' '));
    return mots.every(function (m) { return foin.indexOf(m) >= 0; });
  });
}
/* Totaux du carnet : ce qui est signé, ce qui reste à facturer, ce qui est
   encaissé, et ce qui n'est encore qu'une proposition. */
/* Statistiques par donneur d'ordre : qui apporte le plus de travail. */
/* Combien de jours ce client met à payer. On ne compte que les factures
   réglées : une facture en cours n'a pas de délai, elle a de l'ancienneté. */
function delaiPaiement(ch) {
  if (!ch || !ch.dateFacture || !ch.datePaiement) return null;
  var d = Math.round((minuit(ch.datePaiement) - minuit(ch.dateFacture)) / JOUR);
  return d >= 0 ? d : null;
}
/* En retard sur son échéance, et de combien. L'échéance saisie prime sur le
   délai général : c'est la date qu'on a écrite sur la facture. */
function retardPaiement(ch, maintenant) {
  if (!ch || ch.statut !== 'facture' || !ch.echeancePaiement) return null;
  var d = Math.round((minuit(maintenant || Date.now()) - minuit(ch.echeancePaiement)) / JOUR);
  return d > 0 ? d : null;
}

function parDonneur(chantiers, cfg) {
  var m = {};
  (chantiers || []).forEach(function (ch) {
    var d = (ch.donneur || '').trim() || '(non précisé)';
    if (!m[d]) m[d] = { donneur: d, n: 0, signe: 0, propose: 0, facture: 0, jours: 0,
      gagnes: 0, perdus: 0, delais: [], enRetard: 0 };
    var e = m[d], mt = montant(ch);
    e.n++;
    if (statutEngage(ch.statut)) { e.signe += mt; e.gagnes++; }
    if (ch.statut === 'devis' || ch.statut === 'envoye') e.propose += mt;
    if (ch.statut === 'sansuite') e.perdus++;
    if (['facture', 'paye'].indexOf(ch.statut) >= 0) e.facture += mt;
    var dp = delaiPaiement(ch);
    if (dp != null) { e.delais.push(dp); }
    if (retardPaiement(ch)) e.enRetard++;
    e.jours += tempsMoi(ch, cfg);
  });
  return Object.keys(m).map(function (k) {
    var e = m[k];
    ['signe', 'propose', 'facture', 'jours'].forEach(function (x) { e[x] = arr(e[x], 2); });
    var tranches = e.gagnes + e.perdus;
    e.taux = tranches ? Math.round(e.gagnes / tranches * 100) : null;
    /* Le délai médian plutôt que la moyenne : un seul règlement oublié six
       mois fausserait la moyenne et donnerait une réputation imméritée. */
    if (e.delais.length) {
      var tri2 = e.delais.slice().sort(function (a, b) { return a - b; });
      var mi = Math.floor(tri2.length / 2);
      e.delaiMedian = tri2.length % 2 ? tri2[mi] : Math.round((tri2[mi - 1] + tri2[mi]) / 2);
      e.delaiPire = tri2[tri2.length - 1];
    } else { e.delaiMedian = null; e.delaiPire = null; }
    return e;
  }).sort(function (a, b) { return b.signe - a.signe; });
}

function totaux(chantiers, cfg) {
  var t = { propose: 0, nPropose: 0, signe: 0, aFacturer: 0, nAFacturer: 0,
    facture: 0, encaisse: 0, caFacture: 0, nFactures: 0, attente: 0, nAttente: 0,
    signes: 0, nSignes: 0, jours: 0, n: 0, ouverts: 0, retard: 0 };
  var now = Date.now();
  (chantiers || []).forEach(function (c) {
    var m = montant(c);
    t.n++;
    if (statutOuvert(c.statut)) t.ouverts++;
    if (enRetard(c, now)) t.retard++;
    if (c.statut === 'devis' || c.statut === 'envoye') { t.propose += m; t.nPropose++; }
    /* Le devis est signé et le chantier reste à poser. Même définition que
       la bulle de l'écran Entreprise : deux écrans qui comptent la même
       chose doivent la compter pareil. */
    if (c.statut === 'accepte') { t.signes += m; t.nSignes++; }
    /* Facturé : la facture est partie, réglée ou non. C'est la base que Sylve
       emploie déjà pour les déclarations — les deux écrans doivent dire la
       même chose. */
    if (c.statut === 'facture' || c.statut === 'paye') { t.caFacture += m; t.nFactures++; }
    /* En attente : engagé, pas encore facturé. Le travail qui dort. */
    if (statutEngage(c.statut) && c.statut !== 'facture' && c.statut !== 'paye') {
      t.attente += m; t.nAttente++;
    }
    if (statutEngage(c.statut)) t.signe += m;
    /* Un chantier terminé compte, même sans ligne chiffrée : c'est justement
       celui-là qu'on risque d'oublier de facturer. */
    if (c.statut === 'termine') { t.aFacturer += m; t.nAFacturer++; }
    if (c.statut === 'facture') t.facture += m;
    if (c.statut === 'paye') t.encaisse += m;
    t.jours += tempsMoi(c, cfg);
  });
  ['propose', 'signe', 'aFacturer', 'facture', 'encaisse', 'caFacture', 'attente', 'signes', 'jours']
    .forEach(function (k) { t[k] = arr(t[k], 2); });
  return t;
}

/* Comment le règlement est arrivé. Une liste fermée plutôt qu'un champ libre :
   avec du texte libre, l'orthographe varie et on ne peut plus compter les
   chèques d'un trimestre. Facultatif — beaucoup de chantiers n'en portent pas. */
var MOYENS_PAIEMENT = [
  { c: 'virement', n: 'Virement' }, { c: 'cheque', n: 'Chèque' },
  { c: 'especes', n: 'Espèces' }, { c: 'autre', n: 'Autre' }
];
function nomMoyenPaiement(c) {
  var x = MOYENS_PAIEMENT.filter(function (m) { return m.c === c; })[0];
  return x ? x.n : '';
}

/* Le nom d'un chantier : ce qu'on y fait, pour qui, et où. « Le nom ne veut
   rien dire », disait-il de ceux qu'il tapait à la main. Proposé à la
   création, jamais imposé : dès qu'il écrit le sien, il ne bouge plus. */
function nomAutoChantier(travail, proprietaire, commune) {
  var quoi = travail ? nomTravail(travail) : '';
  var qui = [proprietaire, commune].filter(Boolean).join(', ');
  if (quoi && qui) return quoi + ' — ' + qui;
  return quoi || qui || '';
}

/* « Le titre, je ne devrais pas le choisir. Sinon je ne le modifie pas, ils
   sont tous pareils, comme ça je ne me pose plus de questions. »

   Le nom était écrit une fois, à la création, à partir de ce qu'on savait
   alors. Le propriétaire et la commune se remplissent souvent après, sur la
   fiche : le nom gardait ce qu'il avait au départ et ne rattrapait jamais.
   D'où des titres dépareillés sans qu'aucune saisie soit fautive.

   Il se compose donc à la lecture, comme le statut d'un jour du calendrier.
   Aucune migration, aucun renommage : rien n'est réécrit, donc rien n'est
   risqué. `c.nom` reste en base et sert de repli — un chantier sans
   prestation, sans propriétaire et sans commune n'a rien à composer, et son
   ancien nom vaut mieux que « Chantier ».

   La prestation est celle de la première ligne qui n'est pas une fourniture :
   « Fourniture de tuteurs — Martin, Clairbois » nommerait mal un dégagement qui
   en consomme. */
function nomChantier(c) {
  if (!c) return '';
  var l = (c.lignes || []).filter(function (x) {
    return x.travail && !estFourniture(x.travail);
  })[0] || (c.lignes || []).filter(function (x) { return x.travail; })[0];
  var n = nomAutoChantier(l ? l.travail : '', c.proprietaire, c.commune);
  return n || String(c.nom || '').trim() || 'Chantier';
}

var M = {
  JOUR: JOUR, TRAVAUX: TRAVAUX, UNITES: UNITES, STATUTS: STATUTS,
  nomAutoChantier: nomAutoChantier, nomChantier: nomChantier,
  cadences: cadences, cadenceParJour: cadenceParJour, cadenceComptee: cadenceComptee,
  tvaChantier: tvaChantier, tauxChantier: tauxChantier, ttcChantier: ttcChantier,
  dateEntree: dateEntree, TRIS_CH: TRIS_CH, cleTri: cleTri,
  montantDebours: montantDebours, montantHorsDebours: montantHorsDebours,
  MOYENS_PAIEMENT: MOYENS_PAIEMENT, nomMoyenPaiement: nomMoyenPaiement,
  travauxDeLigne: travauxDeLigne, ligneGroupee: ligneGroupee,
  nomTravauxLigne: nomTravauxLigne, tauxDesTravaux: tauxDesTravaux,
  tvaAtrancher: tvaAtrancher,
  CAT_TRAVAUX: CAT_TRAVAUX, categorieTravail: categorieTravail,
  nomCatTravail: nomCatTravail, categorieLigne: categorieLigne,
  nomCategorieLigne: nomCategorieLigne,
  ESSENCES_CH: ESSENCES_CH, NIVEAUX: NIVEAUX, nomEssenceCh: nomEssenceCh, nomNiveau: nomNiveau,
  lignesDe: lignesDe, monoTravail: monoTravail, tempsPourTravail: tempsPourTravail,
  uniteTravail: uniteTravail, quantiteTravail: quantiteTravail, rendementTravail: rendementTravail,
  references: references, estime: estime,
  distributionRendement: distributionRendement, difficulteLigne: difficulteLigne,
  noteLigne: noteLigne, dateChantier: dateChantier,
  joursFactures: joursFactures, tempsPasse: tempsPasse,
  nomTravail: nomTravail, uniteDe: uniteDe, nomUnite: nomUnite, courtUnite: courtUnite,
  appliquerTravauxPerso: appliquerTravauxPerso, travauxActifs: travauxActifs,
  nomStatut: nomStatut, statutOuvert: statutOuvert, statutEngage: statutEngage, rangStatut: rangStatut,
  aDevis: aDevis, statutsPossibles: statutsPossibles, finValiditeDevis: finValiditeDevis,
  PREAVIS_DEVIS: PREAVIS_DEVIS,
  nb: nb, arr: arr,
  montantLigne: montantLigne, montant: montant, quantite: quantite, unitesPresentes: unitesPresentes,
  tauxLigne: tauxLigne, tauxPresents: tauxPresents, tauxAttendu: tauxAttendu,
  estFourniture: estFourniture, tauxFixe: tauxFixe, tauxDiscute: tauxDiscute, parDonneur: parDonneur,
  joursSaisie: joursSaisie, mesJours: mesJours, tempsTotal: tempsTotal, tempsMoi: tempsMoi,
  heuresPostes: heuresPostes, heuresJournee: heuresJournee, joursJournee: joursJournee,
  prixJourVise: prixJourVise, bilanJournees: bilanJournees, HEURES_JOUR: HEURES_JOUR,
  prixJour: prixJour, chantierSolde: chantierSolde, rendement: rendement,
  dureePrevue: dureePrevue, enRetard: enRetard, journeesANoter: journeesANoter, tri: tri, filtre: filtre, chercher: chercher,
  totaux: totaux,
  dernierEvenement: dernierEvenement, rangComptable: rangComptable,
  rangFacture: rangFacture,
  jourCle: jourCle, minuit: minuit, ajouteJours: ajouteJours, estWeekend: estWeekend,
  journeesPlacees: journeesPlacees, placerJour: placerJour, resteAPlacer: resteAPlacer, joursPrevus: joursPrevus, joursDevis: joursDevis,
  heuresSaisie: heuresSaisie, ditDuree: ditDuree,
  travauxHorsJournees: travauxHorsJournees,
  totalPlace: totalPlace, partDuJour: partDuJour,
  journeesFaites: journeesFaites, journeesAVenir: journeesAVenir,
  totalFait: totalFait, totalAVenir: totalAVenir,
  delaiPaiement: delaiPaiement, retardPaiement: retardPaiement,
  CHAMPS_FICHE: CHAMPS_FICHE, champsManquants: champsManquants, ficheComplete: ficheComplete,
  journeesPrevues: journeesPrevues, fermeteDe: fermeteDe, occupation: occupation,
  RISQUES_FICHE: RISQUES_FICHE, RESEAUX_FICHE: RESEAUX_FICHE, nomReseau: nomReseau,
  nomRisque: nomRisque, risquesCoches: risquesCoches, manquesFiche: manquesFiche,
  ficheRequise: ficheRequise, SEUIL_FICHE_HA: SEUIL_FICHE_HA,
  STATUTS_JOUR: STATUTS_JOUR, nomStatutJour: nomStatutJour, coulStatutJour: coulStatutJour,
  statutJour: statutJour, estAbsent: estAbsent, joursAResoudre: joursAResoudre,
  chargeMois: chargeMois, alertes: alertes, fmtJours: fmtJours,
  MOTIFS_REFUS: MOTIFS_REFUS, nomMotifRefus: nomMotifRefus, analyseRefus: analyseRefus,
  kmChantier: kmChantier, kmTotal: kmTotal, coutCarburant: coutCarburant,
  COLONNES_CSV: COLONNES_CSV, modeleCsv: modeleCsv, decoupeCsv: decoupeCsv, dateFr: dateFr,
  trouveTravail: trouveTravail, trouveUnite: trouveUnite, trouveStatut: trouveStatut,
  trouveEssence: trouveEssence, analyseCsv: analyseCsv
};
if (typeof window !== 'undefined') window.BCC = M;
if (typeof module === 'object' && module.exports) module.exports = M;
