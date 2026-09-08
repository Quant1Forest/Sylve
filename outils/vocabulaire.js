/* Le vocabulaire de chaque magasin : les champs que l'application écrit
   vraiment sur ses objets.

   Pourquoi ce fichier existe. Quatre fois, un défaut de la même famille est
   passé au vert : le code lisait un champ que rien n'écrit — `charge.nom` là
   où le formulaire enregistre `libelle`, `c.lieu` là où le chantier porte
   `foret` — et l'écran affichait un blanc ou un zéro sans que rien ne crie.
   Le scénario qui aurait dû l'attraper semait les MÊMES champs faux : deux
   erreurs qui se confirment l'une l'autre.

   Le garde-fou brise cette boucle par les deux bouts :

   - le banc d'essai refuse une graine dont un champ n'est pas ici — un
     scénario ne peut plus inventer un champ pour coller à du code fautif ;
   - le vérificateur refuse une lecture `charge.<champ>` hors de cette liste —
     le code ne peut plus lire un champ que rien n'écrit.

   Ce n'est pas un schéma : rien ne valide les données de l'utilisateur, et
   une sauvegarde ancienne peut porter d'autres champs. C'est un **cliquet**
   sur ce que le projet écrit lui-même. Ajouter un champ ici est un geste
   délibéré, et c'est justement le moment où l'on va relire le formulaire qui
   l'enregistre.

   Chaque liste se relève dans le formulaire qui enregistre l'objet, pas dans
   le code qui le lit — c'est toute la différence. */

module.exports = {
  /* ouvrirEnteteCh, ouvrirIdentiteCh, ouvrirDevisCh, ouvrirFactureCh,
     ouvrirEstimationCh, ouvrirJourneesCh, ouvrirPeuplementCh, ouvrirNoteCh,
     figerDevis, la fiche de chantier, et l'import CSV.
     `temps` est une lecture des journées, pas une saisie — mais elle est
     stockée, et les scénarios la sèment pour partir d'un état donné. */
  chantiers: ['id', 'cree', 'maj', 'statut', 'aDevis', 'siren', 'dateEntree',
    'nom', 'donneur', 'client', 'proprietaire', 'commune', 'foret', 'parcelles',
    'departement', 'cadastre', 'gps', 'lignes', 'temps', 'jours',
    'joursEstimes', 'prixJour', 'criteres', 'notes', 'fiche', 'devisFige',
    'numeroDevis', 'dateDevis', 'validiteDevis', 'dateEnvoi', 'dateSignature',
    'numeroFacture', 'dateFacture', 'echeancePaiement', 'datePaiement',
    'moyenPaiement', 'dateFin', 'debut'],

  /* ouvrirCharge : var maj = { libelle, beneficiaire, ttc, periodicite,
     debut, jour, moisReference, taux, categorie, dansDepenses, arretee, maj }.
     Ni `nom` ni `montant` — c'est exactement l'erreur de la 4.76. */
  charges: ['id', 'maj', 'libelle', 'beneficiaire', 'ttc', 'taux', 'categorie',
    'periodicite', 'debut', 'fin', 'jour', 'moisReference', 'dansDepenses',
    'arretee'],

  /* ouvrirJournee, validerCommePrevu, migrerJournees. Le chantier porte
     `foret` : une journée, elle, a bien un `lieu`. */
  journees: ['id', 'date', 'chantier', 'lieu', 'commune', 'km', 'nonProd',
    'personnes', 'sansMoi', 'fin', 'nonFacture', 'postes'],

  articles: ['id', 'maj', 'nom', 'type', 'unite', 'dosage', 'prix', 'seuil',
    'fournisseur', 'note', 'mouvements'],

  sorties: ['id', 'maj', 'date', 'chantier', 'client', 'num', 'perte',
    'debours', 'auto', 'statut', 'lignes', 'note'],

  commandes: ['id', 'maj', 'date', 'dateCmd', 'dateLiv', 'num', 'fournisseur',
    'livraison', 'statut', 'lignes', 'note', 'depense', 'taux'],

  fournisseurs: ['id', 'maj', 'nom', 'contact', 'note'],

  /* ouvrirAchat : var maj = { quoi, ttc, taux, categorie, priorite, note }. */
  achats: ['id', 'cree', 'maj', 'quoi', 'ttc', 'taux', 'categorie', 'priorite',
    'note', 'fait', 'dateFait'],

  versements: ['id', 'maj', 'date', 'type', 'montant', 'periode', 'note',
    'rembourse'],

  depenses: ['id', 'maj', 'date', 'fournisseur', 'categorie', 'ttc', 'taux',
    'lignes', 'note', 'auto', 'charge', 'echeance', 'commande', 'vehicule'],

  piles: ['id', 'maj', 'nom', 'lieu', 'cotes', 'buche', 'essences', 'hauteurs',
    'lat', 'lon', 'note', 'mouvements', 'humidite', 'etat', 'secheVers']
};
