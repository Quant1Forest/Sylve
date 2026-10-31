/* ==========================================================================
   Sylve — stock de fournitures
   Il achète en gros (protections, tuteurs, gaines, grillage), stocke parfois
   un an, puis revend au fil des chantiers. Le coût de sortie est calculé au
   prix moyen pondéré : c'est la méthode qui reflète le mieux un stock acheté
   par lots à des prix différents.
   ========================================================================== */
(function () {
'use strict';

/* « ml » est le mètre linéaire, pas le millilitre : les deux s'abrègent
   pareil mais ne se rencontrent jamais sur un même produit — l'un mesure du
   grillage, l'autre du répulsif. Le millilitre a donc son propre code.
   Un stock en millilitres se lit en litres dès qu'il dépasse le litre :
   « 30 L » dit trois bidons, « 30 000 ml » ne dit rien. */
var UNITES_ART = [
  { c: 'unite', n: 'unité', court: 'u' },
  { c: 'ml', n: 'mètre linéaire', court: 'ml' },
  { c: 'rouleau', n: 'rouleau', court: 'rlx' },
  { c: 'kg', n: 'kilo', court: 'kg' },
  { c: 'sac', n: 'sac', court: 'sac' },
  { c: 'millilitre', n: 'millilitre', court: 'ml', versLitre: 1000 },
  { c: 'litre', n: 'litre', court: 'L' }
];
/* L'échelle à laquelle lire un produit. Elle se décide sur la plus grande
   valeur de la ligne, pas colonne par colonne : « acheté 30 L, sorti 1 800,
   reste 32 L » serait illisible. Tout bascule ensemble ou rien. */
function echelleArt(unite, valeurs) {
  var u = null, i;
  for (i = 0; i < UNITES_ART.length; i++) if (UNITES_ART[i].c === unite) u = UNITES_ART[i];
  var max = 0;
  (valeurs || []).forEach(function (v) { max = Math.max(max, Math.abs(nb(v))); });
  if (u && u.versLitre && max >= u.versLitre) return { div: u.versLitre, court: 'L' };
  return { div: 1, court: u ? u.court : (unite || '') };
}
/* Un produit a un type : cela sert à trier l'inventaire et à ne pas mélanger
   une gaine de protection avec un répulsif dosé au millilitre. */
var TYPES_ART = [
  { c: 'protection', n: 'Protection' },
  { c: 'tuteur', n: 'Tuteur, piquet' },
  { c: 'traitement', n: 'Traitement, répulsif' },
  { c: 'plant', n: 'Plant' },
  { c: 'consommable', n: 'Consommable' },
  { c: 'autre', n: 'Autre' }
];
function nomTypeArt(c) {
  for (var i = 0; i < TYPES_ART.length; i++) if (TYPES_ART[i].c === c) return TYPES_ART[i].n;
  return 'Autre';
}

/* Une commande ne pèse sur le stock qu'une fois reçue. */
var STATUTS_ACHAT = [
  { c: 'devis', n: 'Devis demandé', recu: false },
  { c: 'commande', n: 'Commandé', recu: false },
  { c: 'expedie', n: 'Expédié', recu: false },
  { c: 'recu', n: 'Reçu', recu: true },
  { c: 'annule', n: 'Annulé', recu: false, mort: true }
];
/* Une sortie ne quitte le stock qu'une fois le chantier fait ; avant cela
   elle est engagée ou seulement prévue. */
var STATUTS_VENTE = [
  { c: 'potentiel', n: 'Chantier potentiel', etat: 'prevu' },
  { c: 'aprevoir', n: 'À prévoir', etat: 'prevu' },
  { c: 'accepte', n: 'Devis ou chantier accepté', etat: 'engage' },
  { c: 'encours', n: 'En cours de réalisation', etat: 'engage' },
  { c: 'fini', n: 'Chantier terminé', etat: 'sorti' },
  { c: 'annule', n: 'Annulé', etat: 'mort' }
];
function trouveSt(l, c) { for (var i = 0; i < l.length; i++) if (l[i].c === c) return l[i]; return null; }
function nomStatutAchat(c) { var x = trouveSt(STATUTS_ACHAT, c); return x ? x.n : 'Reçu'; }
function achatRecu(c) { var x = trouveSt(STATUTS_ACHAT, c); return x ? !!x.recu : true; }
function achatMort(c) { var x = trouveSt(STATUTS_ACHAT, c); return !!(x && x.mort); }
function nomStatutVente(c) { var x = trouveSt(STATUTS_VENTE, c); return x ? x.n : 'Chantier terminé'; }
function etatVente(c) { var x = trouveSt(STATUTS_VENTE, c); return x ? x.etat : 'sorti'; }
/* Le statut d'un chantier donne d'office celui de la sortie qui s'y rattache :
   inutile de tenir deux fois la même information. */
var VENTE_DE_CHANTIER = {
  devis: 'potentiel', envoye: 'aprevoir', accepte: 'accepte', encours: 'encours',
  termine: 'fini', facture: 'fini', paye: 'fini', sansuite: 'annule'
};

function nomUniteArt(c) {
  for (var i = 0; i < UNITES_ART.length; i++) if (UNITES_ART[i].c === c) return UNITES_ART[i].n;
  return c || '';
}
/* Ce qui peut porter un dosage par plant : ce qui s'achète en volume, en
   longueur ou en poids, puis se facture au plant. Un tuteur compté à la pièce
   n'a pas de « 6 ml par plant ». */
var UNITES_DOSABLES = ['millilitre', 'litre', 'ml', 'kg'];
function UNITE_DOSABLE(u) { return UNITES_DOSABLES.indexOf(u) >= 0; }
function courtUniteArt(c) {
  for (var i = 0; i < UNITES_ART.length; i++) if (UNITES_ART[i].c === c) return UNITES_ART[i].court;
  return c || '';
}

/* Les espaces sont retirées avant l'analyse : depuis que fmt() sépare les
   milliers, un « 25 000 » relu dans un champ vaudrait 25. */
function nb(v) {
  if (v == null || v === '') return 0;
  var n = parseFloat(String(v).replace(/[\s\u00A0]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function arr(n, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(n * p) / p; }

/* Mouvements d'un article : entrées (achats) et sorties (chantiers).
   { date, sens: 'entree'|'sortie', qte, prix (HT unitaire, entrées),
     fraisUnit (quote-part de livraison, calculée à la réception),
     commande, chantier, note }

   La quote-part de livraison est figée au moment de la réception : les frais
   de la commande sont répartis à parts égales sur les unités reçues. Un
   tuteur à 0,60 € dans une commande dont la livraison revient à 0,1325 €
   par unité coûte en réalité 0,7325 €. Sans cela, la marge est surestimée. */
function mouvements(art) { return (art && art.mouvements) || []; }

/* Un mouvement n'agit sur le stock réel que s'il a eu lieu. Une commande
   passée mais pas encore livrée est « attendue » ; une sortie prévue sur un
   chantier accepté est « engagée ». Trois niveaux de lecture, comme dans le
   tableur : ce que j'ai, ce qu'il me restera, ce qu'il faudra racheter. */
function entrees(art) {
  return mouvements(art).filter(function (m) { return m.sens === 'entree' && !m.attendu; });
}
function attendues(art) {
  return mouvements(art).filter(function (m) { return m.sens === 'entree' && m.attendu; });
}
function sorties(art) {
  return mouvements(art).filter(function (m) { return m.sens === 'sortie' && (!m.etat || m.etat === 'sorti'); });
}
function engagees(art) {
  return mouvements(art).filter(function (m) { return m.sens === 'sortie' && m.etat === 'engage'; });
}
function prevues(art) {
  return mouvements(art).filter(function (m) { return m.sens === 'sortie' && m.etat === 'prevu'; });
}
/* Trois sortes de sorties, qui pèsent toutes sur le stock mais pas sur le
   chiffre d'affaires : une vente rapporte, un débours est refacturé à
   l'euro près, une perte ne rapporte rien. */
function ventes(art) { return sorties(art).filter(function (m) { return !m.perte && !m.debours; }); }
function debours(art) { return sorties(art).filter(function (m) { return !m.perte && !!m.debours; }); }
function pertes(art) { return sorties(art).filter(function (m) { return !!m.perte; }); }

function sommeQte(l) { return l.reduce(function (s, m) { return s + nb(m.qte); }, 0); }
function quantite(art) { return arr(sommeQte(entrees(art)) - sommeQte(sorties(art)), 3); }
function quantiteAttendue(art) { return arr(sommeQte(attendues(art)), 3); }
/* Ce qu'il restera une fois honorés les chantiers acceptés ou en cours. */
function stockFutur(art) { return arr(quantite(art) - sommeQte(engagees(art)), 3); }
/* Et une fois honorés aussi les chantiers seulement prévus ou potentiels. */
function stockPrevu(art) { return arr(stockFutur(art) - sommeQte(prevues(art)), 3); }
function quantiteVendue(art) { return arr(sommeQte(ventes(art)), 3); }
function quantitePerdue(art) { return arr(sommeQte(pertes(art)), 3); }
function quantiteDebours(art) { return arr(sommeQte(debours(art)), 3); }
function quantiteAchetee(art) { return arr(sommeQte(entrees(art)), 3); }
/* Les ventes datées : ce qui est réellement sorti, hors pertes et hors
   débours — un débours n'est pas une vente, il est refacturé à l'euro près.
   Tout ce qui suit s'appuie là-dessus. */
function anneesDeVente(articles) {
  var a = {};
  (articles || []).forEach(function (art) {
    ventes(art).forEach(function (m) { if (m.date) a[new Date(m.date).getFullYear()] = 1; });
  });
  return Object.keys(a).map(Number).sort(function (x, y) { return y - x; });
}
function caAnnee(articles, an) {
  return arr((articles || []).reduce(function (s2, art) {
    return s2 + ventes(art).filter(function (m) {
      return m.date && new Date(m.date).getFullYear() === an;
    }).reduce(function (t, m) { return t + nb(m.qte) * nb(m.prix); }, 0);
  }, 0), 2);
}
/* Marge de l'année : le prix de vente moins le coût réel du moment, produit
   par produit. Le coût moyen pondéré sert de référence — il n'existe pas de
   coût « au jour de la vente » dans les données. */
function margeAnnee(articles, an) {
  return arr((articles || []).reduce(function (s2, art) {
    var cu = pmp(art);
    return s2 + ventes(art).filter(function (m) {
      return m.date && new Date(m.date).getFullYear() === an;
    }).reduce(function (t, m) { return t + nb(m.qte) * (nb(m.prix) - cu); }, 0);
  }, 0), 2);
}
function caParMois(articles, an) {
  var mois = [];
  for (var i = 0; i < 12; i++) mois.push(0);
  (articles || []).forEach(function (art) {
    ventes(art).forEach(function (m) {
      if (!m.date) return;
      var d = new Date(m.date);
      if (d.getFullYear() !== an) return;
      mois[d.getMonth()] += nb(m.qte) * nb(m.prix);
    });
  });
  return mois.map(function (v) { return arr(v, 2); });
}
function caParArticle(articles, an) {
  return (articles || []).map(function (art) {
    var v = ventes(art).filter(function (m) {
      return m.date && new Date(m.date).getFullYear() === an;
    });
    return { article: art, nom: art.nom || '',
      ca: arr(v.reduce(function (t, m) { return t + nb(m.qte) * nb(m.prix); }, 0), 2),
      qte: arr(v.reduce(function (t, m) { return t + nb(m.qte); }, 0), 3) };
  }).filter(function (x) { return x.ca > 0; })
    .sort(function (a, b) { return b.ca - a.ca; });
}

function caVendu(art) {
  return arr(ventes(art).reduce(function (s, m) { return s + nb(m.qte) * nb(m.prix); }, 0), 2);
}
function caDebours(art) {
  return arr(debours(art).reduce(function (s, m) { return s + nb(m.qte) * nb(m.prix); }, 0), 2);
}
function prixVenteMoyen(art) {
  var q = quantiteVendue(art);
  return q > 0 ? arr(caVendu(art) / q, 4) : 0;
}
/* Prix moyen pondéré : total acheté / quantité achetée. Recalculé à chaque
   entrée, il lisse les variations de prix entre commandes. */
/* Coût réel d'une entrée : prix d'achat plus sa part de livraison. */
function coutReel(m) { return arr(nb(m && m.prix) + nb(m && m.fraisUnit), 4); }

/* Prix moyen pondéré, sur les coûts réels. */
function pmp(art) {
  var q = 0, v = 0;
  entrees(art).forEach(function (m) { q += nb(m.qte); v += nb(m.qte) * coutReel(m); });
  return q > 0 ? arr(v / q, 4) : 0;
}
/* Coût de la dernière réception : c'est lui qui sert à chiffrer un devis,
   parce qu'il reflète le prix auquel on rachètera. */
function dernierCout(art) {
  var e = entrees(art).slice().sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
  return e.length ? coutReel(e[0]) : 0;
}
function valeurStock(art) { return arr(quantite(art) * pmp(art), 2); }
/* Part de livraison portée par le stock restant, à titre indicatif. */
function fraisLivraisonTotal(art) {
  return arr(entrees(art).reduce(function (s, m) { return s + nb(m.qte) * nb(m.fraisUnit); }, 0), 2);
}

/* --------------------------------------------------------- dosage
   Certains produits s'achètent au litre ou au mètre et se facturent au
   plant : un répulsif dosé à 6 ml par plant, acheté 0,02 €/ml, revient
   à 0,12 € par plant. Le stock se lit alors aussi en nombre de plants. */
function coutParPlant(art) {
  var d = nb(art && art.dosage);
  return d > 0 ? arr(pmp(art) * d, 4) : 0;
}
function stockEnPlants(art) {
  var d = nb(art && art.dosage);
  return d > 0 ? arr(quantite(art) / d, 0) : null;
}
/* Quantité et prix unitaire à porter sur un devis, pour N plants. */
function pourPlants(art, nbPlants, prixParPlant) {
  var d = nb(art && art.dosage);
  if (!(d > 0) || !(nb(nbPlants) > 0)) return null;
  return {
    quantite: arr(nb(nbPlants) * d, 2),
    prixUnitaire: nb(prixParPlant) > 0 ? arr(nb(prixParPlant) / d, 5) : null,
    cout: arr(nb(nbPlants) * d * pmp(art), 2)
  };
}
function quantiteSortie(art) {
  return arr(sorties(art).reduce(function (s, m) { return s + nb(m.qte); }, 0), 3);
}
/* Ce que les sorties ont coûté, au prix moyen du moment de la sortie s'il a
   été figé, sinon au prix moyen courant. */
function coutSortie(m, art) {
  var p = m.prixSortie != null ? nb(m.prixSortie) : pmp(art);
  return arr(nb(m.qte) * p, 2);
}
function coutSorties(art) {
  return arr(sorties(art).reduce(function (s, m) { return s + coutSortie(m, art); }, 0), 2);
}

/* Alerte de réapprovisionnement. */
function sousSeuil(art) {
  var s = nb(art && art.seuil);
  return s > 0 && quantite(art) <= s;
}
/* Trois états lisibles d'un coup d'œil dans le tableau d'inventaire. */
function etatStock(art) {
  if (quantite(art) <= 0) return 'rupture';
  if (sousSeuil(art)) return 'faible';
  return 'ok';
}
function nomEtatStock(e) {
  return e === 'rupture' ? 'Rupture' : e === 'faible' ? 'Stock faible' : 'En stock';
}

/* ------------------------------------------------------------- ensemble */
function valeurTotale(articles) {
  return arr((articles || []).reduce(function (s, a) { return s + valeurStock(a); }, 0), 2);
}
function articlesSousSeuil(articles) {
  return (articles || []).filter(sousSeuil);
}

/* Ce qu'un chantier a consommé, et ce qu'il en coûte. */
function consommationChantier(articles, chantierId) {
  var out = [];
  (articles || []).forEach(function (a) {
    sorties(a).forEach(function (m) {
      if (m.chantier !== chantierId) return;
      out.push({ article: a, mouvement: m, qte: nb(m.qte), cout: coutSortie(m, a) });
    });
  });
  return out;
}
function coutFournitures(articles, chantierId) {
  return arr(consommationChantier(articles, chantierId)
    .reduce(function (s, x) { return s + x.cout; }, 0), 2);
}

/* Marge sur fournitures d'un chantier : ce qui a été refacturé en « vente »
   moins ce que le stock sorti a coûté. */
function margeChantier(articles, ch, montantLigne) {
  var vendu = ((ch && ch.lignes) || []).filter(function (l) { return l.nature === 'vente'; })
    .reduce(function (s, l) { return s + montantLigne(l); }, 0);
  var cout = coutFournitures(articles, ch && ch.id);
  return {
    vendu: arr(vendu, 2), cout: cout, marge: arr(vendu - cout, 2),
    taux: vendu > 0 ? Math.round((vendu - cout) / vendu * 100) : null
  };
}
/* Marge sur fournitures, tous chantiers d'une période. */
function margeGlobale(articles, chantiers, montantLigne, dans) {
  var vendu = 0, cout = 0;
  (chantiers || []).forEach(function (ch) {
    if (dans && !dans(ch)) return;
    var m = margeChantier(articles, ch, montantLigne);
    vendu += m.vendu; cout += m.cout;
  });
  return { vendu: arr(vendu, 2), cout: arr(cout, 2), marge: arr(vendu - cout, 2),
    taux: vendu > 0 ? Math.round((vendu - cout) / vendu * 100) : null };
}


/* ============================================ PRIX DE REVIENT
   Décomposition d'un prix de vente : ce que le produit a coûté, ce que
   l'État prendra, ce qui reste. Les taux sont ceux que l'utilisateur
   saisit — aucun n'est deviné.

   Au micro-BIC, cotisations et impôt portent sur le chiffre d'affaires
   après abattement : sur 1 € vendu, la base est de 29 % si l'abattement
   est de 71 %. Le taux de charges rapporté au prix de vente vaut donc
   (1 − abattement) × (cotisations + impôt). */
function tauxCharges(cfg) {
  var c = cfg || {};
  var ab = c.abattement != null ? nb(c.abattement) : 0.71;
  return arr((1 - ab) * (nb(c.cotisations) + nb(c.impot)), 6);
}
/* Prix plancher : celui qui couvre exactement le coût et les charges. */
function prixPlancher(cout, cfg) {
  var t = tauxCharges(cfg);
  if (t >= 1) return null;
  return arr(nb(cout) / (1 - t), 4);
}
/* Prix visant un bénéfice net donné, en pourcentage du plancher. */
function prixAvecBenefice(cout, cfg, tauxBenefice) {
  var p = prixPlancher(cout, cfg);
  return p == null ? null : arr(p * (1 + nb(tauxBenefice)), 4);
}
/* Prix visant un taux de marge brute donné. */
function prixAvecMarge(cout, tauxMarge) {
  var t = nb(tauxMarge);
  if (t >= 1) return null;
  return arr(nb(cout) / (1 - t), 4);
}
/* Décomposition d'un prix de vente donné. */
function decomposer(prixVente, cout, cfg) {
  var c = cfg || {}, pv = nb(prixVente), cu = nb(cout);
  var ab = c.abattement != null ? nb(c.abattement) : 0.71;
  var base = pv * (1 - ab);
  var msa = arr(base * nb(c.cotisations), 5);
  var ir = arr(base * nb(c.impot), 5);
  var cfe = nb(c.cfeUnitaire);
  var charges = arr(msa + ir + cfe, 5);
  var benefice = arr(pv - cu - charges, 5);
  var marge = arr(pv - cu, 5);
  var pc = function (v) { return pv > 0 ? arr(v / pv * 100, 2) : 0; };
  return {
    prixVente: arr(pv, 4), cout: arr(cu, 4),
    cotisations: msa, impot: ir, cfe: arr(cfe, 5), charges: charges,
    benefice: benefice, marge: marge,
    partCout: pc(cu), partCotisations: pc(msa), partImpot: pc(ir), partCfe: pc(cfe),
    partBenefice: pc(benefice), tauxMarge: pc(marge),
    viable: benefice >= 0
  };
}

var M = {
  UNITES_ART: UNITES_ART, UNITE_DOSABLE: UNITE_DOSABLE, nomUniteArt: nomUniteArt, courtUniteArt: courtUniteArt,
  echelleArt: echelleArt,
  TYPES_ART: TYPES_ART, nomTypeArt: nomTypeArt,
  STATUTS_ACHAT: STATUTS_ACHAT, nomStatutAchat: nomStatutAchat,
  achatRecu: achatRecu, achatMort: achatMort,
  STATUTS_VENTE: STATUTS_VENTE, nomStatutVente: nomStatutVente, etatVente: etatVente,
  VENTE_DE_CHANTIER: VENTE_DE_CHANTIER,
  attendues: attendues, engagees: engagees, prevues: prevues,
  ventes: ventes, debours: debours, pertes: pertes,
  anneesDeVente: anneesDeVente, caAnnee: caAnnee, margeAnnee: margeAnnee,
  caParMois: caParMois, caParArticle: caParArticle,
  quantiteAttendue: quantiteAttendue, stockFutur: stockFutur, stockPrevu: stockPrevu,
  quantiteVendue: quantiteVendue, quantitePerdue: quantitePerdue,
  quantiteDebours: quantiteDebours, quantiteAchetee: quantiteAchetee,
  caVendu: caVendu, caDebours: caDebours, prixVenteMoyen: prixVenteMoyen,
  etatStock: etatStock, nomEtatStock: nomEtatStock,
  nb: nb, arr: arr,
  mouvements: mouvements, entrees: entrees, sorties: sorties,
  quantite: quantite, pmp: pmp, coutReel: coutReel, dernierCout: dernierCout,
  valeurStock: valeurStock, fraisLivraisonTotal: fraisLivraisonTotal, quantiteSortie: quantiteSortie,
  coutParPlant: coutParPlant, stockEnPlants: stockEnPlants, pourPlants: pourPlants,
  coutSortie: coutSortie, coutSorties: coutSorties, sousSeuil: sousSeuil,
  valeurTotale: valeurTotale, articlesSousSeuil: articlesSousSeuil,
  consommationChantier: consommationChantier, coutFournitures: coutFournitures,
  margeChantier: margeChantier, margeGlobale: margeGlobale,
  tauxCharges: tauxCharges, prixPlancher: prixPlancher, prixAvecBenefice: prixAvecBenefice,
  prixAvecMarge: prixAvecMarge, decomposer: decomposer
};
if (typeof window !== 'undefined') window.BCS2 = M;
if (typeof module === 'object' && module.exports) module.exports = M;

})();

