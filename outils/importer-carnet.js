#!/usr/bin/env node
/* =====================================================================
   Sylve — reprise du carnet comptable tenu sous tableur

   Fabrique un fichier de sauvegarde que l'application sait restaurer d'un
   seul geste, à partir du classeur « Tableau de bord comptable ».

     node outils/importer-carnet.js "<classeur.xlsx>" [sortie.json]

   Le classeur ne sort jamais du poste : ce script lit, convertit, écrit un
   fichier à côté. Rien n'est envoyé nulle part.

   Trois feuilles sont reprises :
     Recettes        une ligne = une ligne de facture, groupées par numéro
     Dépenses        une ligne = un achat
     Paramètres (2)  le bloc « Frais fixes — suivi & échéances »

   Une facture donne un chantier : c'est la règle posée par l'utilisateur,
   et c'est aussi celle de l'application, où une recette est une ligne de
   chantier. Les prestations d'une même facture deviennent les lignes de
   ce chantier.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const args = process.argv.slice(2);
const classeurs = args.filter(a => /\.xlsx$/i.test(a));
const SOURCE = classeurs[0];
const STOCK = classeurs[1] || null;
const CIBLE = args.filter(a => !/\.xlsx$/i.test(a))[0] ||
  path.join(process.cwd(), 'reprise-carnet.json');
if (!SOURCE) {
  console.error('\n  Usage : node outils/importer-carnet.js "<comptabilité.xlsx>" ' +
    '["<stock.xlsx>"] [sortie.json]\n');
  process.exit(1);
}

/* ------------------------------------------------------------ traduction
   Les nomenclatures du tableur vers les codes de l'application. Ce qui
   n'est pas reconnu tombe dans « AUTRE » et se retrouve dans le rapport :
   mieux vaut une ligne mal rangée qu'une ligne perdue. */

const UNITES = {
  'forfait jour': 'jour', 'forfait': 'forfait', 'hectare': 'ha',
  'article': 'unite', 'unite': 'unite', 'plant': 'plant',
  'metre lineaire': 'ml', 'ml': 'ml'
};

const NATURES = {
  'prestations de services': 'prestation',
  'ventes de marchandises': 'vente',
  'debours client': 'debours'
};

/* Sous-catégorie du tableur → code de prestation. */
const TRAVAUX = {
  'degagement de plantation': 'DEGAG',
  'degagement de plantation et taille de formation': 'DEGAG',
  'detourage et depressage': 'DEPRES',
  'detourage et elagage': 'DETOUR',
  'detourage': 'DETOUR',
  'depressage': 'DEPRES',
  'elagage': 'ELAG',
  'taille de formation': 'TAILLE',
  'nettoiement': 'NETT',
  'nettoyage d ilots d enrichissements': 'NETT',
  'ouverture de cloisonnement': 'CLOIS',
  'inventaire en plein': 'INVENT',
  'reperage de chablis': 'CHABLIS',
  'travaux sylvicole jardinatoire': 'JARDIN',
  'plantation': 'PLANT',
  'mise en place des plants et gaines': 'PLANT',
  'mise en place de tuteur': 'TUTEUR',
  'mise en place des bambous': 'TUTEUR',
  'mise en place gaine de protection': 'PROTEC',
  'mise en place des gaines et des tuteurs': 'PROTEC',
  'pulverisation d un repulsif a cervides': 'REPULSIF',
  'fourniture de gaine de protection 14 120': 'F_PROTEC',
  'fourniture de gaine de protection 20 120': 'F_PROTEC',
  'fourniture de tuteur en chataigner 9 11 150': 'F_TUTEUR',
  'fourniture de tuteur en robinier 150': 'F_TUTEUR',
  'fourniture de bambou': 'F_TUTEUR',
  'fourniture de trico': 'F_REPULSIF',
  'fourniture de produits trico': 'F_REPULSIF'
};

const CAT_DEPENSE = {
  'consommable': 'CONSO',
  'immobilisation': 'IMMO',
  'petits outillages matériels': 'PETITMAT',
  'petits outillages materiels': 'PETITMAT',
  'epi ou equipement de terrain': 'EPI',
  'reparation materiel': 'ENTRETIEN',
  'frais de deplacement': 'DEPL',
  'frais de restauration': 'REPAS',
  'frais de creation': 'CREATION',
  'frais divers': 'AUTRE',
  'frais administratif': 'ADMIN',
  'achats de fourniture': 'FOURN',
  'frais de carburant pro': 'CARB',
  'frais de carburant perso': 'CARBPERSO'
};

/* Colonne « Type » du bloc des frais fixes. */
const CAT_CHARGE = {
  'assurance': 'ASSUR', 'abonnement': 'ABO', 'banque': 'BANQUE',
  'pret': 'PRET', 'pret automobile': 'PRET', 'cotisation': 'COTIS'
};

const PERIODICITES = {
  'mensuel': 'mensuel', 'trimestriel': 'trimestriel',
  'semestriel': 'semestriel', 'annuel': 'annuel'
};

/* ----------------------------------------------------------------- stock */

/* Le type se devine au nom du produit : le classeur range par famille
   d'achat (« Matériel », « Ingrédient »), l'application par nature. */
const TYPE_PRODUIT = [
  [/gaine|protection|manchon|grillage/, 'protection'],
  [/tuteur|piquet|bambou|echalas|échalas/, 'tuteur'],
  [/trico|repuls|répuls|traitement|herbicide/, 'traitement'],
  [/plant|semis/, 'plant'],
  [/livraison|transport|port/, 'autre']
];
function typeProduit(nom) {
  const k = clef(nom);
  for (const [re, t] of TYPE_PRODUIT) if (re.test(k)) return t;
  return 'autre';
}

/* Attention à « ml » : dans l'application c'est le mètre linéaire, pas le
   millilitre. Un répulsif dosé au millilitre prend « millilitre ». */
const UNITES_STOCK = { u: 'unite', unite: 'unite', ml: 'ml', l: 'litre',
  litre: 'litre', kg: 'kg', sac: 'sac', rouleau: 'rouleau' };

/* Les statuts du classeur portent un emoji ; on ne garde que les mots. */
const STATUT_ACHAT = [
  [/recu|reçu|livr/, 'recu'], [/devis accepte|commande/, 'commande'],
  [/expedi/, 'expedie'], [/demande de devis|devis/, 'devis'], [/annul/, 'annule']
];
const STATUT_VENTE = [
  [/fini|termin/, 'fini'], [/en cours/, 'encours'],
  [/accepte|accepté/, 'accepte'], [/a prevoir|à prévoir/, 'aprevoir'],
  [/potentiel/, 'potentiel'], [/annul/, 'annule']
];
function statutParmi(table, v, defaut) {
  const k = clef(v);
  for (const [re, s] of table) if (re.test(k)) return s;
  return defaut;
}

/* ---------------------------------------------------------------- outils */

/* Sans accent, sans ponctuation, en minuscules : les libellés du tableur
   ont été tapés à la main et ne sont pas constants d'une ligne à l'autre
   (« Unité » et « unité », « 14*120 » et « 14x120 »). */
function clef(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function val(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map(t => t.text).join('');
    if (v instanceof Date) return v;
    if (v.text !== undefined) return v.text;
    return '';
  }
  return v;
}
const txt = c => String(val(c) == null ? '' : val(c)).replace(/\s+/g, ' ').trim();
const nombre = c => {
  const v = val(c);
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

/* Une date de tableur devient un midi local. Midi et pas minuit : c'est la
   seule heure qui ne bascule pas de jour quel que soit le fuseau, et
   l'application s'en sert déjà pour ses champs date. */
function quand(cell) {
  const v = val(cell);
  if (!v) return null;
  let d = null;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number') d = new Date(Date.UTC(1899, 11, 30 + Math.floor(v)));
  else {
    const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12).getTime();
    const f = String(v).match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (f) return new Date(+f[3], +f[2] - 1, +f[1], 12).getTime();
    d = new Date(v);
  }
  if (!d || isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12).getTime();
}

/* Les intitulés de l'application, lus dans index.html plutôt que recopiés :
   une seconde liste finirait par diverger de la première sans prévenir. Ils
   servent à savoir si la sous-catégorie du tableur dit déjà la même chose,
   auquel cas il n'y a rien à répéter en précision. */
const NOMS_TRAVAUX = (() => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const bloc = src.match(/var TRAVAUX = \[([\s\S]*?)\n\];/);
  const noms = {};
  if (bloc) {
    for (const m of bloc[1].matchAll(/\{\s*c:\s*'([^']+)'\s*,\s*n:\s*'([^']*)'/g)) noms[m[1]] = m[2];
  }
  if (!Object.keys(noms).length) throw new Error('liste TRAVAUX introuvable dans index.html');
  return noms;
})();
const nomTravail = c => NOMS_TRAVAUX[c] || '';

let compteur = 0;
const uid = () => 'imp' + (Date.now().toString(36)) + (compteur++).toString(36);

const inconnus = { travaux: new Map(), unites: new Map(), catDep: new Map(),
  natures: new Map(), charges: new Map() };
function note(quoi, valeur) {
  if (!valeur) return;
  inconnus[quoi].set(valeur, (inconnus[quoi].get(valeur) || 0) + 1);
}

/* --------------------------------------------------------------- lecture */

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SOURCE);

  const clients = new Set(), proprios = new Set();

  /* ---- 1. Recettes → chantiers ------------------------------------- */
  const R = wb.getWorksheet('Recettes');
  if (!R) throw new Error('feuille « Recettes » introuvable');

  const parFacture = new Map();
  for (let r = 11; r <= R.rowCount; r++) {
    const num = txt(R.getRow(r).getCell(2));
    if (!num) continue;
    const sous = txt(R.getRow(r).getCell(7));
    const cat = txt(R.getRow(r).getCell(6));
    const natureBrute = txt(R.getRow(r).getCell(9));
    const uniteBrute = txt(R.getRow(r).getCell(10));

    const travail = TRAVAUX[clef(sous)] || null;
    if (!travail) note('travaux', sous || cat);
    const unite = UNITES[clef(uniteBrute)] || null;
    if (!unite) note('unites', uniteBrute);
    const nature = NATURES[clef(natureBrute)] || null;
    if (!nature) note('natures', natureBrute);

    if (!parFacture.has(num)) {
      parFacture.set(num, {
        num,
        date: quand(R.getRow(r).getCell(3)),
        mo: txt(R.getRow(r).getCell(4)),
        client: txt(R.getRow(r).getCell(5)),
        cats: [], lignes: [], paiements: [], impayees: 0
      });
    }
    const f = parFacture.get(num);
    if (cat && f.cats.indexOf(cat) < 0) f.cats.push(cat);

    const paiement = quand(R.getRow(r).getCell(18));
    if (paiement) f.paiements.push(paiement); else f.impayees++;

    /* La liste de l'application est plus courte que la sienne : « Fourniture
       de tuteurs » là où il écrit « en châtaigner 9/11*150 », « Nettoiement »
       là où il ajoute « et préparation des îlots ». Ce qu'il a réellement
       facturé va dans la précision, qui s'affiche à la suite du travail —
       sans quoi la reprise lui rend une facture qui n'est plus la sienne. */
    const complement = txt(R.getRow(r).getCell(8));
    const precisions = [];
    if (sous && clef(sous) !== clef(nomTravail(travail))) precisions.push(sous);
    if (complement) precisions.push(complement);

    f.lignes.push({
      travail: travail || 'AUTRE',
      unite: unite || 'forfait',
      quantite: nombre(R.getRow(r).getCell(11)),
      prix: nombre(R.getRow(r).getCell(12)),
      nature: nature || 'prestation',
      tva: Math.round(nombre(R.getRow(r).getCell(13)) * 100 * 100) / 100,
      note: precisions.join(' ')
    });
    /* Attention au nommage de l'application : la liste « clients » alimente
       le champ « Donneur d'ordre », et « proprios » le champ « Propriétaire
       facturé ». Le maître d'œuvre du tableur est donc un client au sens du
       stockage, et son client à lui un propriétaire. Les intervertir remplit
       chaque menu déroulant avec la mauvaise moitié du carnet. */
    if (f.mo) clients.add(f.mo);
    if (f.client) proprios.add(f.client);
  }

  /* Le nom : la prestation quand la facture n'en porte qu'une, la catégorie
     quand elle en mêle plusieurs. Suivi du client, qui situe le chantier. */
  const chantiers = [...parFacture.values()].map(f => {
    const seule = f.lignes.length === 1;
    const tete = seule
      ? (txt({ value: f.lignes[0].note }) || f.cats[0] || 'Chantier')
      : (f.cats[0] || 'Chantier');
    const nom = (tete + (f.client ? ' — ' + f.client : '')).slice(0, 90);
    const paye = f.impayees === 0 && f.paiements.length > 0;
    return {
      id: uid(),
      nom,
      donneur: f.mo || '',
      proprietaire: f.client || '',
      foret: '', parcelles: '', commune: '',
      statut: paye ? 'paye' : 'facture',
      numeroFacture: f.num,
      debut: f.date, dateFin: f.date, dateFacture: f.date,
      datePaiement: f.paiements.length ? Math.max.apply(null, f.paiements) : null,
      tva: f.lignes.length ? f.lignes[0].tva : 20,
      criteres: {},
      notes: 'Repris du carnet comptable — facture ' + f.num,
      lignes: f.lignes,
      temps: [],
      jours: [],
      maj: Date.now()
    };
  });

  /* ---- 2. Dépenses -------------------------------------------------- */
  const D = wb.getWorksheet('Dépenses');
  const depenses = [];
  if (D) {
    for (let r = 11; r <= D.rowCount; r++) {
      const date = quand(D.getRow(r).getCell(2));
      const ttc = nombre(D.getRow(r).getCell(7));
      if (!date && !ttc) continue;
      if (!ttc) continue;
      const vendeur = txt(D.getRow(r).getCell(3));
      const catBrute = txt(D.getRow(r).getCell(4));
      const cat = CAT_DEPENSE[clef(catBrute)] || null;
      if (!cat) note('catDep', catBrute);
      /* Le taux n'est renseigné dans le tableur que pour les exceptions :
         les 20 % ordinaires y sont laissés vides. */
      const taux = nombre(D.getRow(r).getCell(8));
      /* Le vendeur reste du texte libre sur la dépense. La liste
         « fournisseurs » est celle du module Stock — ceux qui livrent des
         plants, des gaines, des tuteurs. Y verser les enseignes où l'on
         achète un sandwich ou une paire de gants la rend inutilisable. */
      depenses.push({
        id: uid(),
        date,
        fournisseur: vendeur,
        lignes: [{
          libelle: txt(D.getRow(r).getCell(5)) || catBrute || 'Achat',
          categorie: cat || 'AUTRE',
          ttc: Math.round(ttc * 100) / 100,
          taux: taux ? Math.round(taux * 100 * 100) / 100 : 20
        }],
        maj: Date.now()
      });
    }
  }

  /* ---- 3. Frais fixes ----------------------------------------------- */
  const P = wb.getWorksheet('Paramètres (2)');
  const charges = [];
  if (P) {
    /* Colonnes du bloc : 24 libellé · 25 type · 26 fréquence · 27 montant
       · 28 base HT/net · 29 montant TTC · 30 premier paiement. */
    for (let r = 19; r <= 40; r++) {
      const lib = txt(P.getRow(r).getCell(24));
      if (!lib) continue;
      /* « TOTAL coût annuel » ferme le tableau : au-delà commencent les
         calculs de cotisations, qui ne sont pas des charges. */
      if (/^total/i.test(lib)) break;
      const type = txt(P.getRow(r).getCell(25));
      const freq = txt(P.getRow(r).getCell(26));
      const ttc = nombre(P.getRow(r).getCell(29));
      const debut = quand(P.getRow(r).getCell(30));
      /* Une ligne sans montant ni échéance est un poste commencé et laissé
         en plan dans le tableur : on la signale plutôt que de l'inventer. */
      if (!ttc || !PERIODICITES[clef(freq)]) { note('charges', lib); continue; }
      const d = debut ? new Date(debut) : null;
      charges.push({
        id: uid(),
        libelle: lib,
        beneficiaire: '',
        ttc: Math.round(ttc * 100) / 100,
        periodicite: PERIODICITES[clef(freq)],
        categorie: CAT_CHARGE[clef(type)] || 'AUTRE',
        taux: 0,
        debut: debut,
        jour: d ? d.getDate() : 1,
        moisReference: d ? d.getMonth() : 0,
        arretee: false,
        maj: Date.now()
      });
    }
  }

  /* ---- 4. Le stock --------------------------------------------------- */
  const articles = [], fournisseurs = [], commandes = [], sorties = [];
  if (STOCK) {
    const sk = new ExcelJS.Workbook();
    await sk.xlsx.readFile(STOCK);

    /* Les fournisseurs d'abord : les produits et les commandes s'y rattachent. */
    const parNomF = new Map();
    const WF = sk.getWorksheet('Fournisseurs');
    if (WF) {
      for (let r = 6; r <= WF.rowCount; r++) {
        const nom = txt(WF.getRow(r).getCell(2));
        if (!nom || parNomF.has(clef(nom))) continue;
        /* L'adresse rejoint les notes : la fiche n'a pas de champ pour elle,
           et une adresse perdue est plus gênante qu'une note un peu longue. */
        const adresse = [txt(WF.getRow(r).getCell(7)), txt(WF.getRow(r).getCell(9)),
          txt(WF.getRow(r).getCell(8))].filter(Boolean).join(' ');
        const notes = [adresse, txt(WF.getRow(r).getCell(11))].filter(Boolean).join(' — ');
        const f = { id: uid(), nom,
          categorie: txt(WF.getRow(r).getCell(3)),
          contact: txt(WF.getRow(r).getCell(4)),
          tel: txt(WF.getRow(r).getCell(5)),
          mail: txt(WF.getRow(r).getCell(6)),
          ville: txt(WF.getRow(r).getCell(8)),
          notes, maj: Date.now() };
        fournisseurs.push(f);
        parNomF.set(clef(nom), f.id);
      }
    }

    /* Les produits ensuite. L'inventaire donne le nom et le fournisseur ; le
       Trico se compte en millilitres, avec son dosage par plant. */
    const parNomA = new Map();
    const dosageTrico = (() => {
      const W = sk.getWorksheet('Inventaire et stock');
      for (let r = 5; r <= 12 && W; r++) {
        if (/dosage par plant/i.test(txt(W.getRow(r).getCell(13))))
          return nombre(W.getRow(r).getCell(14));
      }
      return null;
    })();

    const article = (nom, nomF) => {
      if (!nom) return null;
      const k = clef(nom);
      if (parNomA.has(k)) return parNomA.get(k);
      const estTrico = /trico/i.test(nom);
      const a = { id: uid(), nom, designation: '',
        type: typeProduit(nom),
        unite: estTrico ? 'millilitre' : 'unite',
        seuil: null,
        dosage: estTrico ? dosageTrico : null,
        fournisseur: nomF && parNomF.has(clef(nomF)) ? parNomF.get(clef(nomF)) : null,
        mouvements: [], maj: Date.now() };
      articles.push(a);
      parNomA.set(k, a.id);
      return a.id;
    };

    const WI = sk.getWorksheet('Inventaire et stock');
    if (WI) for (let r = 6; r <= WI.rowCount; r++) {
      const nom = txt(WI.getRow(r).getCell(2));
      if (!nom || /^total/i.test(nom)) continue;
      if (/livraison|transport|frais de port/i.test(nom)) continue;
      article(nom, txt(WI.getRow(r).getCell(10)));
    }

    /* Les entrées. */
    const WA = sk.getWorksheet('Achats');
    const parCmd = new Map();
    if (WA) for (let r = 10; r <= WA.rowCount; r++) {
      const num = txt(WA.getRow(r).getCell(4));
      const prod = txt(WA.getRow(r).getCell(5));
      if (!num || !prod) continue;
      if (!parCmd.has(num)) {
        const c = { id: uid(), num,
          dateCmd: quand(WA.getRow(r).getCell(2)) || Date.now(),
          dateLiv: quand(WA.getRow(r).getCell(3)) || null,
          fournisseur: parNomF.get(clef(txt(WA.getRow(r).getCell(11)))) || null,
          statut: statutParmi(STATUT_ACHAT, txt(WA.getRow(r).getCell(10)), 'recu'),
          livraison: 0, lignes: [], maj: Date.now() };
        commandes.push(c);
        parCmd.set(num, c);
      }
      const c = parCmd.get(num);
      /* La livraison est une ligne du bon de commande, pas un produit : elle
         se répartit sur le reste et pèse sur le prix de revient. À écarter
         avant de créer quoi que ce soit, sinon elle entre à l'inventaire. */
      if (/livraison|transport|frais de port/i.test(prod)) {
        c.livraison = Math.round((c.livraison + nombre(WA.getRow(r).getCell(9))) * 100) / 100;
        continue;
      }
      const u = UNITES_STOCK[clef(txt(WA.getRow(r).getCell(7)))];
      const id = article(prod, txt(WA.getRow(r).getCell(11)));
      if (u && id) {
        const a = articles.filter(x => x.id === id)[0];
        if (a && a.unite === 'unite' && u !== 'unite') a.unite = u;
      }
      c.lignes.push({ article: id, qte: nombre(WA.getRow(r).getCell(6)),
        prix: nombre(WA.getRow(r).getCell(8)) });
    }

    /* Les sorties, rattachées à leur chantier par le numéro de facture —
       c'est le même des deux côtés. Une sortie qui connaît son chantier suit
       son statut toute seule au lieu de vivre sa vie dans son coin. */
    const parFacture = new Map();
    chantiers.forEach(c => { if (c.numeroFacture) parFacture.set(clef(c.numeroFacture), c); });
    const WV = sk.getWorksheet('Ventes');
    const parVente = new Map();
    let rattachees = 0, orphelines = 0;
    if (WV) for (let r = 7; r <= WV.rowCount; r++) {
      const num = txt(WV.getRow(r).getCell(3));
      const prod = txt(WV.getRow(r).getCell(5));
      if (!prod) continue;
      const cle = num || (txt(WV.getRow(r).getCell(4)) + '|' + (quand(WV.getRow(r).getCell(2)) || ''));
      if (!parVente.has(cle)) {
        const ch = num ? parFacture.get(clef(num)) : null;
        if (ch) rattachees++; else orphelines++;
        const s = { id: uid(), num: num || '',
          date: quand(WV.getRow(r).getCell(2)) || Date.now(),
          client: txt(WV.getRow(r).getCell(4)),
          chantier: ch ? ch.id : null,
          statut: statutParmi(STATUT_VENTE, txt(WV.getRow(r).getCell(9)), 'fini'),
          perte: false,
          debours: /debours|débours/i.test(txt(WV.getRow(r).getCell(10))),
          lignes: [], maj: Date.now() };
        sorties.push(s);
        parVente.set(cle, s);
      }
      parVente.get(cle).lignes.push({
        article: article(prod, ''),
        qte: nombre(WV.getRow(r).getCell(6)),
        prix: nombre(WV.getRow(r).getCell(7))
      });
    }
    global.__rattachees = rattachees;
    global.__orphelines = orphelines;
  }

  /* ---- 5. Le fichier ------------------------------------------------ */
  const sauvegarde = {
    format: 'bordcub-sauvegarde-1',
    version: 7,
    date: new Date().toISOString(),
    config: null,
    bordereaux: [], piles: [],
    chantiers,
    depenses,
    clients: [...clients].sort(),
    proprios: [...proprios].sort(),
    articles, charges, fournisseurs, commandes, sorties,
    journees: []
  };
  fs.writeFileSync(CIBLE, JSON.stringify(sauvegarde, null, 1));

  /* ---- 5. Le rapport ------------------------------------------------ */
  const eur = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR') + ' €';
  const caHT = chantiers.reduce((s, c) => s + c.lignes.reduce((t, l) =>
    t + (l.unite === 'forfait' ? l.prix : l.quantite * l.prix), 0), 0);
  const achats = depenses.reduce((s, d) => s + d.lignes[0].ttc, 0);

  console.log('\n' + '─'.repeat(58));
  console.log('  ' + chantiers.length + ' chantiers, ' +
    chantiers.reduce((s, c) => s + c.lignes.length, 0) + ' lignes de travaux');
  console.log('     dont ' + chantiers.filter(c => c.statut === 'paye').length + ' payés, ' +
    chantiers.filter(c => c.statut === 'facture').length + ' facturés non réglés');
  console.log('  ' + depenses.length + ' dépenses');
  console.log('  ' + charges.length + ' charges fixes');
  /* Nommé du point de vue de l'utilisateur, pas du stockage : la liste
     « clients » alimente le champ « Donneur d'ordre », et l'inverse. */
  console.log('  ' + sauvegarde.clients.length + ' donneurs d’ordre, ' +
    sauvegarde.proprios.length + ' propriétaires');
  if (STOCK) {
    console.log('');
    console.log('  ' + articles.length + ' produits, ' + fournisseurs.length + ' fournisseurs');
    console.log('  ' + commandes.length + ' commandes, ' + sorties.length + ' sorties');
    console.log('     dont ' + (global.__rattachees || 0) + ' sorties rattachées à leur chantier, ' +
      (global.__orphelines || 0) + ' sans facture correspondante');
  }
  console.log('');
  console.log('  chiffre d’affaires HT repris : ' + eur(caHT));
  console.log('  achats TTC repris            : ' + eur(achats));
  console.log('─'.repeat(58));

  let souci = false;
  Object.keys(inconnus).forEach(k => {
    if (!inconnus[k].size) return;
    souci = true;
    console.log('\n  ~ ' + k + ' non reconnus :');
    [...inconnus[k].entries()].sort((a, b) => b[1] - a[1])
      .forEach(([v, n]) => console.log('      ' + String(n).padStart(3) + ' × ' + v));
  });
  if (!souci) console.log('\n  ✓ toutes les nomenclatures ont été reconnues.');

  console.log('\n  → ' + CIBLE);
  console.log('    ' + Math.round(fs.statSync(CIBLE).size / 1024) + ' Ko\n');
})().catch(e => { console.error('\n  ✕ ' + e.message + '\n'); process.exit(1); });
