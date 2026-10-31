# Inventaire des écrans

Constat de l'existant, pris sur la version **4.85.0**, pour préparer une
refonte de l'organisation. **Rien n'est proposé ici** : seulement ce qui est,
où, et ce qui se répète. Tout vient du code de `index.html` (vues
`vue-*`, tableau `MODULES`, gestionnaires de clics de `brancher()`), pas de
la mémoire de l'utilisateur.

Convention : un chemin s'écrit **Accueil ▸ Mon entreprise ▸ Finances ▸ Bilan**.
« Onglet » = un bouton de la barre du bas. « Fenêtre » = une fenêtre qui
s'ouvre par-dessus l'écran (`modale()`), fermée par la croix, un appui à côté,
Échap ou le retour du téléphone.

---

## 1. Arborescence

### Les trois étages

```
Accueil
├── Mon entreprise (menu de la partie)
│   ├── Chantiers
│   ├── Calendrier
│   ├── Rendements
│   ├── Stock et fournitures
│   ├── Finances
│   ├── Achats à venir
│   └── Véhicule
├── Outils de terrain
│   ├── Cubage
│   └── Bois de chauffage
└── Réglages (⚙ de l'accueil)
```

Le retour du téléphone remonte d'un cran à la fois : fenêtre → module →
menu de la partie → accueil. Depuis les réglages, il redescend là où on était.

### Le bandeau du haut (partout sauf sur l'accueil)

De gauche à droite : **logo** (retour accueil) · **←** (remonte d'un étage :
menu de la partie, ou accueil) · **sélecteur de partie** (liste de tous les
modules, en deux groupes « Entreprise » et « Outils de terrain ») · **action
du module** (seulement Cubage : « En-tête » ; Calendrier : « Aujourd'hui ») ·
**Réglages** (pictogramme).

Dans le module Cubage, une seconde ligne affiche le bordereau en cours :
pastille de couleur, titre, total en m³ marchand, bouton « En-tête ».

### Les modules et leurs onglets (barre du bas)

| Module | Onglets, dans l'ordre | Arrivée par défaut |
|---|---|---|
| Chantiers | Carnet · Fiche · Fiche de chantier | Carnet |
| Calendrier | Agenda · Carte · Carnet | Agenda |
| Rendements | Rendements · Estimer | Rendements |
| Stock et fournitures | Inventaire · Entrées / sorties · Rentabilité | Inventaire |
| Finances | Bilan · Dépenses · Charges fixes · Analyses | Bilan |
| Achats à venir | Ma liste · Ce que ça pèse | Ma liste |
| Véhicule | Carnet · Échéances · Coûts | Carnet |
| Cubage | Saisie · Bordereau · Synthèses · Bordereaux | Bordereaux |
| Bois de chauffage | Stock · Piles · Où ? · Export et analyse | Stock |

Deux onglets sont **partagés entre modules** : « Carnet » (celui des chantiers)
est aussi un onglet du Calendrier ; « Bordereaux » / « Export et analyse »
est la même vue `fichiers`, qui affiche un contenu différent selon qu'on est
dans Cubage ou dans Bois de chauffage. « Carnet » existe aussi, sans rapport,
dans Véhicule (le carnet d'entretien).

### Les sous-niveaux à l'intérieur d'un onglet (pastilles, pas d'onglets)

- **Synthèses** (Cubage) : Synthèse · Financière · Bûcheron · Martelage.
- **Analyses** (Finances) : Vue d'ensemble · Recettes · Dépenses · Déclarations.
- **Rentabilité** (Stock) : Simulateur · Coûts · Performance · Par année.
- **Entrées / sorties** (Stock) : Entrées · Sorties · Pertes.
- **Réglages** : Général · Entreprise · Cubage · Bois de chauffage (voir 2.10).

### Les fenêtres et formulaires (par famille)

| Famille | Fenêtres |
|---|---|
| Chantier | Nouveau chantier · Le chantier (identité) · L'estimation · Le devis · La facture · Le peuplement · Note du chantier · Ligne de travaux · Temps passé · Les journées · Statut (+ motif de refus, + numéro de facture) |
| Journée / agenda | Ma journée · Fiche d'un jour · Que s'est-il passé ? (jour à trancher) · Déplacer la journée · Jour non travaillé · Poser un chantier (sur un jour) · Placer un chantier sur la carte |
| Argent | Dépense · Charge fixe · Mouvement (versement / récupération) · Hypothèses (rentabilité) |
| Stock | Article · Fiche d'un article · Fournisseur · Commande · Sortie de stock · Import de fournitures |
| Achats | Achat à venir |
| Véhicule | Fiche du véhicule · Relevé du compteur · Intervention · Poste d'entretien |
| Rendements | Détail d'un rendement · Noter une cadence |
| Notes | Note à soi-même (titre, couleur) |
| Cubage / bois | En-tête du bordereau · Coller depuis Excel · Pile · Mesure d'une pile · Sortie d'une pile · Photos d'une pile |
| Réglages | Ajout / modification d'une essence, d'une qualité, d'une entrée de liste, d'un travail réglé |

---

## 2. Les écrans, bloc par bloc

Pour chacun : **chemin**, **blocs dans l'ordre d'affichage**, **actions**.

### 2.1 Accueil

> **Retiré au lot 5b (4.87.0)**, comme Mon entreprise (2.2) : le constat de
> 4.85 reste ci-dessous, et le tableau *Où sont allés l'accueil et Mon
> entreprise* dit où se trouve désormais chaque élément.

Chemin : ouverture de l'application, ou logo du bandeau.

Blocs, de haut en bas :
1. **Marque** : logo, « Sylve », sous-titre « Gestion d'entreprise et outils de
   terrain ».
2. **Rappel de sauvegarde** (seulement si la dernière copie est ancienne).
3. **Rappel « journées à trancher »** (seulement s'il reste des jours passés
   posés au planning). Fermable par ×, revient au prochain lancement.
4. **Rappel d'échéances** (prélèvements des charges fixes dans les 3 jours).
   Fermable par ×.
5. **Rappel de devis en attente de réponse.** Fermable par ×.
6. Titre « Entreprise », puis **tuile Mon entreprise** (chiffre : chantiers
   ouverts).
7. **Bouton « Enregistrer ma journée »** + une ligne « Déjà saisie
   aujourd'hui / Rien de saisi aujourd'hui · X h sur 7 jours ».
8. Titre « Outils de terrain », puis **tuiles Cubage** (chiffre : m³) et
   **Bois de chauffage** (chiffre : stères).

Actions :
- **⚙** (en haut à droite) → Réglages ▸ Général.
- Rappel de sauvegarde → (voir 5.5, point à vérifier).
- Rappel de journées → fenêtre « Que s'est-il passé ? » sur la plus ancienne.
- Rappel d'échéances → Finances ▸ Charges fixes.
- Rappel de devis → fiche du chantier s'il n'y en a qu'un, sinon Chantiers ▸
  Carnet filtré sur « Devis envoyé ».
- Tuiles → ouvrent le menu Mon entreprise, ou le module.
- « Enregistrer ma journée » → fenêtre **Ma journée**.

### 2.2 Mon entreprise (menu de la partie)

Chemin : Accueil ▸ Mon entreprise.

Blocs :
1. **Marque de l'entreprise** : logo et nom si renseignés, sinon « Mon
   entreprise » ; bouton ↩ vers l'accueil.
2. **« Où j'en suis »** : six bulles, une seule valeur chacune :
   journées à planifier · devis signés · chantiers en cours · factures en
   attente · chiffre d'affaires · TVA déductible. Puis, s'il y a du travail
   posé dans les 7 jours, une ligne « Aujourd'hui / Demain / Dans N jours —
   chantier, durée, pour qui ».
3. **Sept tuiles de modules** : Chantiers · Calendrier · Rendements · Stock et
   fournitures · Finances · Achats à venir · Véhicule. Chacune porte un chiffre
   (ouverts, jours ce mois, références, valeur du stock, facturé, achats à
   prévoir, km) et une phrase de situation.
4. **Mes notes** : listes à cocher libres, colorées.

Actions :
- Chaque bulle → son écran de détail (voir tableau 3, « bulles »).
- Chaque tuile → son module.
- **+ note** → fenêtre Note ; titre d'une note → la modifier ; case → cocher ;
  × d'un élément ou de la note → supprimer (note → corbeille) ; champ « ajouter
  un élément… » + Entrée.

### Où sont allés l'accueil et Mon entreprise (lot 5b)

Chaque élément des deux écrans retirés, et son nouvel endroit. La dernière
colonne est la clé de la preuve : le scénario « Cadre : chaque élément de
l'accueil et de Mon entreprise a son nouvel endroit » lit ce tableau et joue,
depuis Aujourd'hui, la preuve de chaque ligne. Une ligne sans preuve, ou une
preuve sans ligne, le fait crier.

| Élément (4.85) | Nouvel endroit | Preuve |
|---|---|---|
| Accueil ▸ marque (logo, « Sylve », sous-titre) | Écran de démarrage | `demarrage-marque` |
| Accueil ▸ ⚙ | ☰ ▸ Réglages | `menu-reglages` |
| Accueil ▸ rappel de sauvegarde | Aujourd'hui ▸ En retard, dernière ligne « Sauvegarde à faire » → ☰ ▸ Sauvegarde (carte Sauvegarde des Réglages) | `retard-sauvegarde` |
| Accueil ▸ rappel « journées à trancher » | Aujourd'hui ▸ En retard, une ligne par jour « … non saisi » → fenêtre « Que s'est-il passé ? » | `retard-trancher` |
| Accueil ▸ rappel d'échéances des charges fixes | Aujourd'hui ▸ Prélèvements à venir (7 jours, ou le préavis s'il est plus long ; total) → Argent ▸ Charges fixes | `prelevements` |
| Accueil ▸ rappel de devis en attente | Aujourd'hui ▸ Bientôt « Relancer le devis ? », un par devis → sa fiche (la liste filtrée reste dans Chantiers) | `bientot-relancer` |
| Accueil ▸ tuile Mon entreprise (chantiers ouverts) | Barre ▸ Chantiers ; le chiffre : compte de « Chantiers en cours » | `encours-compte` |
| Accueil ▸ bouton « Enregistrer ma journée » | Ligne de saisie d'Aujourd'hui → fenêtre Ma journée | `saisie-journee` |
| Accueil ▸ bouton « Enregistrer ma journée » (bis) | + ▸ Ma journée | `plus-journee` |
| Accueil ▸ ligne « Déjà saisie / Rien de saisi · X h sur 7 jours » | Ligne de saisie : « … aujourd'hui · Cette semaine : X h sur N jours » (depuis lundi) | `saisie-ligne` |
| Accueil ▸ tuiles Cubage et Bois de chauffage, avec m³ et stères | ☰ ▸ Outils de terrain | `menu-outils` |
| Mon entreprise ▸ marque (logo et nom de l'entreprise) | Écran de démarrage, sous Sylve ; aperçu dans Réglages ▸ Général | `demarrage-entreprise` |
| Mon entreprise ▸ ↩ | Barre ▸ Aujourd'hui | `barre-aujourdhui` |
| Mon entreprise ▸ bulle « journées à planifier » | Aujourd'hui ▸ Bientôt « À programmer : N j à placer » → placement de l'Agenda | `bientot-programmer` |
| Mon entreprise ▸ bulle « devis signés » | La même ligne « À programmer » (signé = à programmer) ; le total dans Chantiers | `bientot-programmer` |
| Mon entreprise ▸ bulle « chantiers en cours » | Aujourd'hui ▸ Chantiers en cours → fiche | `encours-bloc` |
| Mon entreprise ▸ bulle « factures en attente » (et « N en retard ») | Aujourd'hui ▸ En retard « Facture impayée » quand l'échéance est passée → fiche | `retard-impaye` |
| Mon entreprise ▸ bulle « factures en attente », son montant | Argent ▸ Bilan, « en attente » | `argent-attente` |
| Mon entreprise ▸ bulle « chiffre d'affaires » | Argent ▸ Bilan, « facturé (HT) » de l'année | `argent-ca` |
| Mon entreprise ▸ bulle « TVA déductible » | Argent ▸ Bilan, « déductible » de l'année | `argent-tva` |
| Mon entreprise ▸ ligne « Aujourd'hui / Demain / Dans N jours — chantier, pour qui » | Aujourd'hui ▸ Bientôt « N jours prévus », sur 7 jours | `bientot-prevus` |
| Mon entreprise ▸ tuiles Chantiers, Calendrier, Finances | Barre : Chantiers, Agenda, Argent | `barre-modules` |
| Mon entreprise ▸ tuiles Stock, Achats, Véhicule, Rendements, avec leur chiffre | ☰ ▸ Entreprise | `menu-entreprise` |
| Mon entreprise ▸ tuile Stock, « N à recommander » | Aujourd'hui ▸ Bientôt « À recommander », réservé compris, même chiffre que la tuile du ☰ | `bientot-recommander` |
| Mon entreprise ▸ tuile Véhicule, « N échéances dépassées » | Aujourd'hui ▸ En retard (dépassée) ou Bientôt (proche) → Véhicule ▸ Échéances | `vehicule-echeance` |
| Mon entreprise ▸ Mes notes (cocher, titre, couleur, ajouter, × d'un élément, × de la note → corbeille) | Aujourd'hui ▸ Mes notes, juste après Bientôt | `notes-actions` |
| Mon entreprise ▸ Mes notes, « + note » | + ▸ Note | `plus-note` |
| Accueil ▸ × des rappels (jusqu'au lancement suivant) | × de chaque ligne d'Aujourd'hui, jusqu'au lendemain | `masquer` |

Le chiffre de la tuile Calendrier (« j. ce mois ») est dans Agenda (jours
confirmés et provisoires du mois affiché) ; celui de la tuile Finances
(facturé de la période, TVA) dans Argent ▸ Bilan, sur la même période.

### 2.3 Chantiers

**Carnet** — Accueil ▸ Mon entreprise ▸ Chantiers (ou onglet « Carnet » du
Calendrier).
1. « À traiter (N) » : alertes par chantier (journées passées, à facturer,
   facture impayée), avec montant ; chacune ouvre la fiche.
2. Carte **Carnet** : bouton **Nouveau chantier** ; quatre chiffres (facturé,
   encaissé, devis signés, premier donneur d'ordre) ; une ligne de comptes
   (ouverts, jours-homme, à facturer, jours passés).
3. Carte **Chantiers** : recherche ; filtre ; tri ; sens du tri ; liste. Chaque
   ligne : nom, donneur, dates, badge de statut, n° de facture, montants
   HT/TTC/TVA, et trois boutons **Ouvrir · Temps · Statut**.

**Fiche** — Carnet ▸ Ouvrir (ou alerte, bulle, rappel, calendrier…). Blocs :
1. Sélecteur du chantier affiché + Précédente / Suivante.
2. **Le chantier** (✎ identité) : nom, donneur, client, lieu ; état sur la
   carte (Voir / Placer / Déplacer) ; badge de statut ; facture/paiement
   résumés ; « il manque… ». Boutons **← Carnet · Changer le statut · Fiche de
   chantier**.
3. **Ce que ça vaut / Ce que ça a rapporté** (lecture seule) : montant, jours,
   par journée, objectif.
4. **Le devis / La facture / Ce qu'il y a à faire** (le bloc change de nom
   avec l'étape) : numéro, dates, validité, échéance, lignes de travaux,
   total HT, TVA, temps estimé (✎ estimation), pied « le devis disait… ».
   Boutons **+ Ligne**, **Saisir la facture** (avant facturation) ou
   **Modifier le devis / Attacher un devis** (après), et chaque ligne
   **Modifier / ✕**.
5. **Les journées** (✎) : tableau Date · Fait · Prévu, totaux fait / reste /
   estimé, rendements, bilan « le devis paie / j'y ai passé ». Boutons **Poser
   des dates · + Du temps fait**.
6. **Fournitures** (si des lignes en consomment) : consommation, refacturé,
   coût, marge.
7. **Le peuplement** (✎). 8. **Déplacements** (si des km). 9. **Sans suite**
   (si refusé). 10. **Note** (✎). 11. **Supprimer ce chantier**.

**Fiche de chantier** (le document obligatoire imprimé) — fiche ▸ « Fiche de
chantier », ou onglet. Blocs : choix du filtre et du chantier · alerte « fiche
obligatoire » (> 4 ha) · « Il manque » + bouton **Compléter le chantier** ·
Qui, où, quoi (téléphones) · Période d'intervention · « Déjà connu ici » (bouton
Reprendre ses risques) · une carte par famille de risques (cases + consignes) ·
Secours (accès, réseau, bouton **Sa position, je suis dessus**) · Co-activité
et croquis · boutons **Aperçu** et **Imprimer / PDF**.

### 2.4 Calendrier

**Agenda** — Accueil ▸ Mon entreprise ▸ Calendrier.
1. Titre du mois, boutons **‹ · Aujourd'hui · ›**.
2. Bandeau de placement (quand on pose des dates pour un chantier) : bouton
   **Terminer**.
3. Rappel « N journées passées restent à trancher ».
4. Bloc **À planifier** : chantiers sans date, total de jours à placer, bouton
   **Placer** ou **Estimer** par ligne.
5. Grille du mois (une pastille de statut par jour, repère € pour un
   prélèvement) + légende + 3-4 compteurs du mois (jours confirmés,
   provisoires, jours-homme faits, jours non travaillés).
6. Carte **Journée** du jour retenu : « Prévu » et « Fait », boutons **Ouvrir**
   (chantier) et ✕ (retirer un temps), bouton **J'ai travaillé**.

Appui sur un jour : ouvre la **fiche du jour** (sauf pendant un placement, où
il pose le jour sur le chantier).

**Carte** — onglet « Carte » : carte des chantiers (recherche de commune,
Ma position, − / + / Tout voir, **Poser un chantier**, fonds de carte, liste).

**Carnet** — le même écran que 2.3.

### 2.5 Rendements

**Rendements** : tri ; une ligne par type de travaux avec boutons **Détail**
et **Estimer** ; carte « Ce que vous avez compté » avec **+ Noter une cadence**.
**Estimer** : formulaire (travaux, quantité, critères, rendement retenu,
repères tirés de ses chantiers) + bouton **Estimer** ; résultat avec bouton
**Créer le devis** et liste de références.

### 2.6 Stock et fournitures

- **Inventaire** : bouton **Importer** ; indicateurs (valeur du stock,
  produits, en commande, en rupture, à recommander) ; tableau « État du
  stock » (ligne → fiche de l'article) avec lien **Réglages ▸ Produits** ;
  alertes « À recommander ».
- **Entrées / sorties** : bouton **Enregistrer** (commande ou sortie selon la
  pastille) ; pastilles Entrées · Sorties · Pertes ; liste (boutons **Reçue**,
  **Modifier**).
- **Rentabilité** : lien **Hypothèses** ; pastilles Simulateur · Coûts ·
  Performance · Par année ; formulaire + résultat.

### 2.7 Finances

- **Bilan** : carte **Période** (Mois / Trimestre / Année + sélecteurs) ;
  Chiffre d'affaires (facturé HT, encaissé, en attente, abattements) · Balance
  de TVA (collectée, déductible, solde) · Dépenses et marge · Déplacements et
  devis perdus · Par donneur d'ordre · Devis (taux d'acceptation).
- **Dépenses** : bouton **+ Dépense** ; indicateurs de la période (TTC, HT,
  TVA déductible, nombre) ; filtre par catégorie ; liste (**Modifier**,
  **Supprimer**).
- **Charges fixes** : bouton **+ Charge** ; résumé ; liste (**Modifier**,
  **Supprimer**) ; « Échéances » (quand l'argent part, où il part).
- **Analyses** : sélecteurs de période propres ; pastilles **Vue d'ensemble**
  (facturé / acheté / différence, mois par mois, ce qui rapporte, où part
  l'argent, marge sur fournitures, déplacements) · **Recettes** · **Dépenses**
  · **Déclarations** (déclaration de la période, TVA de l'année, cotisations
  et impôt, simulateur, versements et récupérations avec bouton **+ Mouvement**).

### 2.8 Achats à venir et Véhicule

- **Achats — Ma liste** : bouton **+ Achat** ; liste groupée par priorité ; une
  case par ligne (acheté / remettre) ; ligne → fenêtre Achat.
- **Achats — Ce que ça pèse** : total TTC, par priorité, par catégorie, déjà
  achetés.
- **Véhicule — Carnet** : fiche du véhicule, compteur (**Noter le compteur**),
  Historique (**+ Intervention**, **Modifier**).
- **Véhicule — Échéances** : « À prévoir » (**+ Poste**, **Modifier**).
- **Véhicule — Coûts** : coût du kilomètre, d'où sort ce chiffre, pleins,
  postes les plus chers ; bouton **Compléter la fiche du véhicule**.

### 2.9 Outils de terrain

**Cubage** (arrivée sur « Bordereaux ») :
- *Saisie* : ruban de plaquettes, n°, essence, qualité, longueur, diamètre,
  bille de pied, « Réfaction, parcelle, remarque » ; carte « Volume du
  billon » (4 volumes) ; boutons **Billon suivant · Grume suivante ·
  Enregistrer · Annuler la modification · Défaire le dernier** ; « Dernières
  saisies » + **Tout voir**.
- *Bordereau* : « Billons saisis » (**Contrôler les billons nuls**,
  **Imprimer**), statistiques, filtre, tableau (modifier / supprimer par ligne).
- *Synthèses* : quatre pastilles.
- *Bordereaux* : choix du cubage (tuiles qui créent un bordereau) · « Mes
  bordereaux » (ouvrir, dupliquer, supprimer) · « Exporter un bordereau »
  (**Excel · CSV · .json · Coller depuis Excel**).

**Bois de chauffage** (arrivée sur « Stock ») :
- *Stock* : **Nouvelle pile**, corps du stock, « Séchage ».
- *Piles* : « Mes piles », **Nouvelle pile** (second bouton, mêmes effets).
- *Où ?* : « Où sont mes bois », **Ma position**, liste classée par distance
  (**Y aller**), mini-carte.
- *Export et analyse* : « Exporter le stock » (**Excel · CSV**) + analyses.

### 2.10 Réglages

Chemin : ⚙ de l'accueil, ou pictogramme du bandeau (atterrit sur la zone
correspondant au module d'où l'on vient, voir tableau en 5.4).

Quatre pastilles ; **chacune déroule toutes ses zones**, sans sous-onglets :
- **Général** : Mon entreprise (nom, logo) · L'application (installer,
  protéger les données, vérifier les mises à jour, durée de l'écran de
  démarrage, écran allumé) · Sauvegarde (**Tout sauvegarder**, **Restaurer un
  fichier**, **Corbeille…**) · Remise à zéro (listes de cubage) · Ce qui a
  changé.
- **Entreprise** : Ma journée de travail · Véhicule · Relances et calendrier ·
  Listes déroulantes · Stock et fournitures (fournisseurs, produits) ·
  Financier · Import de données (reprise de l'historique).
- **Cubage** : mode de calcul · seuils des billons nuls · essences et taux
  d'écorce · qualités.
- **Bois de chauffage** : seuils d'humidité, etc.

---

## 3. Les actions : d'où on peut les lancer

« Chemin court » = nombre d'appuis depuis l'accueil, fenêtre non comprise.

| Action | Tous les endroits où on peut la lancer |
|---|---|
| **Saisir ma journée** (fenêtre Ma journée) | ① Accueil ▸ bouton « Enregistrer ma journée ». ② Calendrier ▸ Agenda ▸ carte Journée ▸ « J'ai travaillé ». ③ Calendrier ▸ fiche d'un jour ▸ « J'y ai travaillé » / « Modifier ma journée » / « Autre chose ». ④ Calendrier ▸ fenêtre « Que s'est-il passé ? » ▸ « J'y ai travaillé, mais autrement ». ⑤ (la fenêtre « Ma journée » se rouvre aussi pour modifier une journée existante depuis ces mêmes points). |
| **Noter du temps passé sur un chantier** (fenêtre Temps passé) | ① Carnet ▸ ligne du chantier ▸ « Temps ». ② Fiche ▸ bloc Les journées ▸ « + Du temps fait ». ③ Fiche ▸ fenêtre « L'objectif de ce chantier » (chantier soldé) ▸ « Noter du temps ». Ce temps et celui de « Ma journée » écrivent au même endroit (`A.journees`). |
| **Valider une journée « comme prévu »** (sans formulaire) | ① Fiche d'un jour ▸ « C'était comme prévu ». ② Fenêtre « Que s'est-il passé ? » ▸ « C'était comme prévu » ou « Toutes comme prévu ». ③ Rappel de l'accueil → ouvre cette fenêtre. ④ Bandeau « N journées à trancher » du Calendrier → ouvre cette fenêtre. |
| **Marquer un jour non travaillé** | ① Fiche d'un jour ▸ « Non travaillé ». ② Fenêtre « Que s'est-il passé ? » ▸ « Je n'étais pas là ». |
| **Créer un chantier** | ① Carnet ▸ « Nouveau chantier » (formulaire, avec ou sans devis). ② Rendements ▸ Estimer ▸ « Créer le devis » (crée un chantier « à nommer »). ③ Réglages ▸ Entreprise ▸ Import de données (en masse). Il n'y a pas de création depuis l'accueil, le menu Mon entreprise, la carte ni l'agenda. |
| **Poser un devis** (le saisir, le dater, le signer) | ① Fiche ▸ bloc « Le devis » ▸ ✎ « modifier », ou « Attacher un devis » (chantier sans devis). ② Création du chantier ▸ choix « Avec devis » (statut de départ). ③ Rendements ▸ Estimer ▸ « Créer le devis ». ④ Changer le statut vers « Devis envoyé » / « Devis signé » (Carnet ▸ « Statut », Fiche ▸ « Changer le statut »). La date de signature saisie dans le devis fait elle-même passer le chantier en « à planifier ». |
| **Facturer** | ① Fiche ▸ bloc des travaux ▸ « Saisir la facture » (ou ✎). ② Statut « Facturé » (Carnet ▸ « Statut », Fiche ▸ « Changer le statut »), qui demande le numéro de facture. ③ Statut « Terminé, à facturer » posé par la case « Ce chantier est terminé » de la fenêtre Ma journée prépare l'étape mais ne facture pas. |
| **Noter un paiement** | ① Fiche ▸ fenêtre « La facture » (champs « Payé le » et « Réglé par » — remplir la date fait passer le chantier à « Payé »). ② Statut « Payé » (Carnet ▸ « Statut », Fiche ▸ « Changer le statut »). |
| **Changer le statut d'un chantier** | ① Carnet ▸ ligne ▸ « Statut ». ② Fiche ▸ « Changer le statut ». ③ Automatiquement : signature du devis, saisie de la facture, saisie d'un paiement, case « chantier terminé » dans Ma journée. |
| **Ajouter une dépense** | ① Finances ▸ Dépenses ▸ « + Dépense ». ② Fenêtre Intervention du véhicule (case « créer la dépense »). ③ Fenêtre Commande de stock (case « porter en dépense »). ④ Charge fixe (dépenses créées toutes seules à chaque échéance, non modifiables à la main). ⑤ Réglages ▸ Entreprise ▸ Import de données. Pas de bouton « + Dépense » depuis l'accueil, la bulle TVA ni l'écran Achats (cocher « acheté » ne crée pas de dépense). |
| **Planifier des journées** (poser des dates sur un chantier) | ① Fiche ▸ bloc Les journées ▸ « Poser des dates » (ouvre l'agenda en mode placement). ② Fiche ▸ bloc Les journées ▸ ✎ (fenêtre « Les journées » : estimées + dates à la main). ③ Calendrier ▸ bloc « À planifier » ▸ « Placer ». ④ Calendrier ▸ fiche d'un jour ▸ « Poser un chantier ». ⑤ Bulle « journées à planifier » (mène à l'agenda, où se trouve le bloc ②/③). ⑥ Déplacer une journée (depuis « Que s'est-il passé ? » ▸ « C'était un autre jour »). |
| **Estimer les journées d'un chantier** | ① Fiche ▸ bloc des travaux ▸ « Le temps que ça demande » ✎ (fenêtre L'estimation). ② Fiche ▸ bloc Les journées ▸ ✎ (champ « Journées estimées »). ③ Création du chantier (champ « Journées à prévoir »). ④ Calendrier ▸ À planifier ▸ « Estimer » (ouvre la fiche). ⑤ Rendements ▸ Estimer ou Rendements ▸ ligne ▸ « Estimer » (calcul d'après ses chantiers passés). |
| **Placer un chantier sur la carte** | ① Fiche ▸ « Placer sur la carte » / « Déplacer ». ② Carte ▸ « Poser un chantier ». ③ Fenêtre « Le chantier » (identité, position). ④ Fiche de chantier ▸ Secours ▸ « Sa position, je suis dessus ». |
| **Voir un chantier sur la carte** | ① Fiche ▸ « Voir sur la carte ». ② Calendrier ▸ Carte. |
| **Ouvrir la fiche d'un chantier** | Carnet ▸ « Ouvrir » ; alerte « À traiter » ; bulle du bilan qui ne compte qu'un chantier ; rappel de devis (un seul) ; Calendrier ▸ carte Journée ▸ « Ouvrir » ; Calendrier ▸ À planifier ▸ « Estimer » ; fiche d'un jour ▸ « Fiche » ; fin d'un placement de dates ; Rendements ▸ Estimer (après « Créer le devis ») ; Précédente / Suivante. |
| **Imprimer la fiche de chantier** | Fiche ▸ « Fiche de chantier » ▸ « Imprimer / PDF » (une seule porte). |
| **Ajouter une charge fixe** | Finances ▸ Charges fixes ▸ « + Charge » (une seule porte). Une dépense qui en découle renvoie à la charge (bouton « La charge »). |
| **Ajouter un achat à venir** | Achats ▸ Ma liste ▸ « + Achat » (une seule porte). |
| **Enregistrer une commande / une entrée de stock** | ① Stock ▸ Entrées / sorties ▸ « Enregistrer » (pastille Entrées). ② Import de fournitures (Inventaire ▸ Importer). ③ Une ligne de fourniture facturée fait sortir le stock **sans saisie** (sortie automatique). |
| **Enregistrer une sortie de stock** | ① Stock ▸ Entrées / sorties ▸ « Enregistrer » (pastille Sorties ou Pertes). ② Automatique depuis les lignes de la facture. |
| **Noter une intervention du véhicule / le compteur** | Véhicule ▸ Carnet ▸ « + Intervention » / « Noter le compteur » (une porte chacune). Les km saisis dans Ma journée ou dans « Temps passé » ne mettent pas le compteur à jour. |
| **Écrire une note à soi-même** | Mon entreprise ▸ « + note » (une seule porte). Le chantier a sa propre « Note » (✎, fiche). |
| **Sauvegarder / restaurer / corbeille** | ① Réglages ▸ Général ▸ Sauvegarde. ② Rappel de l'accueil (voir 5.5). |
| **Changer d'un module à l'autre** | Sélecteur du bandeau ; menu Mon entreprise (tuiles) ; accueil ; lignes cliquables des « Ce qui a changé » ; bulles du bilan. |
| **Accéder aux réglages** | ⚙ de l'accueil ; pictogramme du bandeau (zone choisie selon le module) ; liens « Réglages ▸ Produits » (Stock) ; « Hypothèses » (Rentabilité). |
| **Exporter** | Cubage ▸ Bordereaux (Excel, CSV, .json) ; Bois ▸ Export (Excel, CSV) ; Réglages ▸ Sauvegarde (tout). |
| **Rechercher** | Carnet ▸ champ de recherche (nom, donneur, commune, n° de facture) ; Carte ▸ « Aller à une commune » ; Bordereau ▸ filtre. Aucune recherche transversale. |
| **Voir les alertes / ce qui est à faire** | Accueil (4 rappels) ; Mon entreprise ▸ bulles et ligne « prochaine journée » ; Chantiers ▸ Carnet ▸ « À traiter » ; Calendrier ▸ « à trancher » et « À planifier » ; Stock ▸ « À recommander » ; Véhicule ▸ échéances dépassées. |

### Les bulles du bilan et leurs destinations

| Bulle | Mène à |
|---|---|
| journées à planifier | Calendrier ▸ Agenda |
| devis signés | Chantiers ▸ Carnet, filtre « Devis signé, à planifier » (ou la fiche s'il n'y en a qu'un) |
| chantiers en cours | Chantiers ▸ Carnet, filtre « En cours » (ou la fiche) |
| factures en attente | Chantiers ▸ Carnet, filtre « Facturé » (ou la fiche) |
| chiffre d'affaires | Finances ▸ Bilan |
| TVA déductible | Finances ▸ Dépenses |
| ligne « Aujourd'hui / Demain… » | Calendrier ▸ Agenda |

---

## 4. Les informations : où chacune est affichée

Précision de lecture : « période » = les sélecteurs Mois / Trimestre / Année de
Finances (mémorisés et partagés par Finances, Dépenses et Analyses) ; « année
civile » = l'année en cours, sans choix.

| Information | Endroits | Portée / calcul |
|---|---|---|
| **Chiffre d'affaires / facturé** | ① Bulle « chiffre d'affaires » (Mon entreprise). ② Tuile Finances (« facturé »). ③ Carnet ▸ carte « facturé » (+ nombre de factures). ④ Finances ▸ Bilan ▸ « facturé (HT) ». ⑤ Analyses ▸ Vue d'ensemble « facturé HT », Recettes « facturé », Déclarations. ⑥ Fiche ▸ « Ce que ça a rapporté » (par chantier). ⑦ Tuile Chantiers : « X signés · Y à facturer ». | ① année civile. ② période choisie. ③ tous les chantiers facturés ou payés, sans période. ④⑤ période choisie, hors débours, par date de recette. |
| **Encaissé** | Carnet (carte « encaissé ») ; Finances ▸ Bilan ; Analyses ▸ Recettes ; fiche (« encaissé » si payé). | Carnet : tout l'historique. Finances/Analyses : période. |
| **Factures en attente / impayés** | ① Bulle « factures en attente » (+ « N en retard »). ② Carnet ▸ « À traiter » : « Facture impayée — chantier · montant ». ③ Finances ▸ Bilan ▸ « en attente ». ④ Analyses ▸ Recettes (à encaisser). ⑤ Par donneur d'ordre : « N en retard ». ⑥ Fiche ▸ « Échéance dépassée de N jours ». ⑦ Badge de statut « Facturé » dans le Carnet. | ①② statut « Facturé » ; ③④ période. |
| **Devis signés** | Bulle « devis signés » ; Carnet (carte « devis signé… à planifier ») ; tuile Chantiers (« X € signés ») ; Finances ▸ Par donneur d'ordre (« signés ») ; Devis (taux). | |
| **Devis en attente de réponse** | Rappel de l'accueil (selon le délai de relance) ; Finances ▸ Bilan ▸ Devis (« en attente ») ; Calendrier ▸ À planifier (« devis en attente »). Le « À traiter » du Carnet ne le porte plus. | |
| **Chantiers en cours / ouverts** | ① Tuile Mon entreprise sur l'accueil (« chantiers ouverts »). ② Tuile Chantiers (« ouverts »). ③ Bulle « chantiers en cours ». ④ Carnet : ligne « N chantiers ouverts ». ⑤ Filtres du Carnet : « Chantiers ouverts », « En cours », « En cours ou à planifier ». | ①②④ « ouverts » = tous les statuts non soldés, **y compris Terminé et Facturé**. ③ « en cours » = le seul statut « En cours ». |
| **Journées à planifier** | ① Bulle « journées à planifier ». ② Calendrier ▸ bloc « À planifier » (liste et total). ③ Carnet ▸ carte « devis signé… à planifier ». ④ Fiche ▸ « Les journées » (reste à faire) et bandeau de placement. ⑤ Statut « À planifier » / « Devis signé, à planifier ». | ① somme des jours restants sur devis, signé, en cours. ② mêmes statuts, plus les chantiers « à estimer ». |
| **Journées passées restées au planning** | ① Rappel de l'accueil (« à trancher »). ② Calendrier ▸ bandeau « restent à trancher ». ③ Carnet ▸ « À traiter » : « Journées passées ». ④ Badge « jours passés » (liste du Carnet, fiche) et compteur « N aux jours passés ». | Quatre libellés pour la même situation (voir 5.2). |
| **Prochaine journée travaillée** | Ligne sous les bulles (Mon entreprise) ; Calendrier ▸ Agenda ; tuile Calendrier (« j. ce mois »). | Bulle : 7 jours. Tuile : mois. |
| **Temps / heures faits** | Accueil (« X h sur 7 jours ») ; Calendrier ▸ compteur « jours-homme faits » (mois) ; Carnet (« jours-homme cumulés ») ; Fiche ▸ Les journées (fait / reste / estimé) ; Rendements. | |
| **TVA** | ① Bulle « TVA déductible » (année civile). ② Tuile Finances (« TVA X à reverser / à récupérer », période). ③ Finances ▸ Bilan ▸ Balance de TVA (collectée / déductible / solde, période). ④ Finances ▸ Dépenses ▸ « TVA déductible » (période). ⑤ Analyses ▸ Dépenses et Déclarations ▸ « TVA — année ». ⑥ Carnet (par chantier : TVA et taux). ⑦ Fiche (TVA des lignes). | |
| **Dépenses (total)** | Finances ▸ Bilan ▸ « achats HT » ; Finances ▸ Dépenses ▸ TTC / HT / nombre ; Analyses ▸ Vue d'ensemble « acheté HT », Dépenses. | « achats », « acheté », « dépenses » : trois mots. |
| **Marge / résultat** | Finances ▸ Bilan ▸ « recettes − achats » ; Analyses ▸ « différence » ; fiche ▸ Fournitures ▸ « marge » ; Rentabilité ; Analyses ▸ Marge sur fournitures. | |
| **Charges fixes / prélèvements** | Rappel d'échéances (accueil) ; Finances ▸ Charges fixes ▸ Échéances ; Calendrier (repère € sur la case + fiche du jour « Prélevé ce jour-là ») ; Analyses ▸ Vue d'ensemble (charges annuelles). | |
| **Cotisations / impôt estimés** | Analyses ▸ Vue d'ensemble (simulation) ; Analyses ▸ Déclarations (cotisations et impôt, simulateur). Taux saisis dans Réglages ▸ Entreprise ▸ Financier **et** dans les cases du simulateur. | |
| **Par donneur d'ordre** | Carnet (premier donneur d'ordre et son pourcentage) ; Finances ▸ Bilan ▸ « Par donneur d'ordre » ; Analyses ▸ Recettes. | |
| **Kilomètres / déplacements** | Tuile Véhicule (km au compteur) ; Véhicule ▸ Carnet ; Fiche (« Déplacements » du chantier) ; Finances ▸ Bilan ▸ « Déplacements et devis perdus » (période) ; Analyses ▸ Vue d'ensemble « Déplacements ». | |
| **Coût du véhicule** | Véhicule ▸ Coûts ; Finances ▸ Bilan (carburant estimé) ; Réglages ▸ Véhicule (litres/100 km, prix du litre). | |
| **Échéances du véhicule** | Tuile Véhicule (« N échéances dépassées ») ; Véhicule ▸ Échéances. | |
| **Valeur du stock / à recommander** | Tuile Stock (« en stock » + « N à recommander ») ; Stock ▸ Inventaire (résumé et alertes). | |
| **Achats à prévoir** | Tuile Achats (montant TTC et « N achats en attente ») ; Achats ▸ Ma liste ; Achats ▸ Ce que ça pèse. | |
| **Nombre de références de rendement** | Tuile Rendements ; Rendements ; Estimer. | |
| **Sauvegarde ancienne** | Rappel de l'accueil ; Réglages ▸ Général ▸ Sauvegarde. | |
| **Notes** | Mon entreprise ▸ Mes notes (à soi) ; Fiche ▸ Note (du chantier) ; Ma journée ▸ Note ; achats ▸ note. Quatre endroits, quatre magasins. | |

---

## 5. Doublons et incohérences repérés

Ordre : ce qui touche l'usage quotidien d'abord.

### 5.1 Même action, plusieurs endroits

1. **Saisir du temps** : deux fenêtres différentes pour la même idée, « Ma
   journée » (accueil, agenda, fiche d'un jour) et « Temps passé » (Carnet,
   fiche). Elles écrivent au même endroit, mais ne posent pas les mêmes
   questions : Ma journée demande forêt, commune, trajet, plusieurs
   prestations, case « terminé » ; Temps passé demande une seule activité, une
   case « je n'ai pas travaillé », et une date facultative.
2. **Trancher un jour passé** : trois chemins qui aboutissent à la même
   fenêtre (rappel de l'accueil, bandeau du Calendrier, fiche d'un jour), plus
   une fiche d'un jour qui offre les mêmes choix sous d'autres mots.
3. **Planifier** : « Poser des dates » (fiche), ✎ des journées (fiche), « Placer »
   (agenda), « Poser un chantier » (fiche d'un jour). Quatre portes, trois
   fenêtres ; et « Journées estimées » se règle à part, à deux endroits (✎ des
   journées, ✎ du temps que ça demande).
4. **Estimer** : le nombre de journées s'estime à plusieurs endroits (voir tableau 3)
   avec deux outils très différents (une saisie à la main / un calcul d'après
   ses chantiers passés).
5. **Statut** : changé par le Carnet, par la fiche, et **aussi** en silence par
   la signature du devis, la facture, le paiement et la case « terminé » de
   Ma journée.
6. **Créer un chantier** : trois chemins, avec trois états de départ
   différents (formulaire complet / chantier « à nommer » généré depuis une
   estimation / import).
7. **Placer sur la carte** : quatre endroits (fiche, onglet Carte, fenêtre
   identité, fiche de chantier).
8. **Position** et **forêt/commune** : saisies dans la création du chantier, la
   fenêtre identité, la fiche de chantier, et à nouveau dans Ma journée.
9. **Réglages** : trois portes (⚙ accueil, pictogramme du bandeau, liens
   « Réglages ▸ Produits » / « Hypothèses ») ; et plusieurs réglages sont en
   double d'une saisie ailleurs (taux de cotisations : Réglages ▸ Financier
   et simulateurs d'Analyses).
10. **Retour** : ← du bandeau, logo du bandeau, ↩ de Mon entreprise, « ← Carnet »
    de la fiche, retour du téléphone : cinq façons de remonter, qui ne
    mènent pas toutes au même niveau.

### 5.2 Même information, présentée ou calculée autrement

1. **« Ouverts » contre « en cours »** : la tuile de l'accueil et celle de Mon
   entreprise affichent le nombre de chantiers « ouverts » (tout ce qui n'est
   pas payé ni refusé, donc y compris terminés et facturés) ; la bulle voisine
   « chantiers en cours » ne compte que le statut « En cours ». Deux chiffres
   différents pour deux mots proches, sur deux écrans consécutifs.
2. **Chiffre d'affaires** : trois périmètres. La bulle prend l'année civile ;
   la tuile Finances prend la période choisie dans Finances (et change quand
   on la change) ; le Carnet cumule tout l'historique. Le Carnet compte le
   débours dans « facturé » ; Finances l'écarte du chiffre d'affaires.
3. **TVA** : la bulle donne la TVA *déductible* de l'année civile ; la tuile
   Finances donne le *solde* de la période choisie (à reverser / à
   récupérer) ; Finances ▸ Bilan donne les trois (collectée, déductible,
   solde). Le même mot « TVA » pour trois grandeurs.
4. **Journées passées non tranchées** : « à trancher » (rappel d'accueil,
   bandeau du Calendrier), « Journées passées » (alerte du Carnet), « jours
   passés » (badge, compteur du Carnet), « restées au planning ». Quatre
   libellés, un seul sujet, et le badge « jours passés » ne désigne pas
   forcément ce qu'ouvre le rappel.
5. **Factures non payées** : « factures en attente » (bulle), « Facture
   impayée » (alerte), « en attente » (Finances ▸ Bilan), « à encaisser »
   (Analyses), « Facturé » (statut). Et « en attente » désigne aussi un
   *devis* sans réponse (Finances ▸ Devis, Calendrier ▸ À planifier) : un
   même mot pour une facture et pour un devis.
6. **« À planifier »** est à la fois un statut (« Devis signé, à planifier » /
   « À planifier » sans devis), un bloc du Calendrier, une bulle, un filtre
   de fiche de chantier et un mot de la carte Carnet. La bulle compte des
   *journées* ; le bloc du Calendrier compte des *chantiers* (et inclut ceux
   « à estimer »).
7. **Dépenses** : « achats » (Bilan), « acheté » (Analyses), « dépenses »
   (partout ailleurs), « achats saisis » (compteur) ; et « Achats à venir » est
   un module sans rapport.
8. **Notes** : quatre endroits indépendants (Mon entreprise, chantier, journée,
   achat) sous le même mot, sans lien entre eux.
9. **Fiche** : « Fiche » (onglet Chantiers : le dossier d'un chantier) et
   « Fiche de chantier » (l'onglet voisin : le document de sécurité imprimé)
   sont deux onglets côte à côte au nom presque identique ; « fiche d'un jour »
   et « fiche du véhicule » sont encore autre chose.
10. **« Carnet »** désigne le carnet des chantiers (2 onglets dans 2 modules) et
    le carnet d'entretien du véhicule.
11. **« Entreprise »** : « Mon entreprise » (tuile, menu), « Entreprise » (titre
    de l'accueil, groupe du sélecteur, pastille de Réglages), et dans Réglages
    ▸ Général une zone intitulée aussi « Mon entreprise » qui ne contient que
    le nom et le logo — alors que le reste des réglages d'entreprise est dans
    la pastille « Entreprise ».
12. **Stock** : « Stock et fournitures » (module de l'entreprise) et « Stock »
    (premier onglet du bois de chauffage), deux sujets distincts. Le module
    Stock a aussi une « Rentabilité » qui parle de ventes.
13. **« Dépenses »** est un onglet de Finances **et** une pastille d'Analyses
    (autre écran, autres chiffres) ; **« Recettes »** n'existe qu'en pastille.
    Finances ▸ Bilan et Analyses ▸ Vue d'ensemble se recoupent (facturé,
    achats, marge) avec des sélecteurs de période distincts qui écrivent dans
    la même période.
14. **« Bordereau(x) »** : onglet « Bordereau » (les billons) et onglet
    « Bordereaux » (la liste), voisins dans Cubage.
15. **Fonction de « Terminé »** : « Terminé, à facturer » (statut), « Ce
    chantier est terminé » (case de Ma journée qui pose ce statut), « Terminer »
    (fin d'un placement de dates) — trois sens.
16. **« Échéances »** : la tuile et l'onglet Véhicule (entretien à faire), la
    carte des Charges fixes (prélèvements), le rappel de l'accueil
    (prélèvements) : deux sujets sous un mot.

### 5.3 Libellés différents pour la même chose

| Chose | Libellés rencontrés |
|---|---|
| Le donneur d'ordre | « Donneur d'ordre », « donneur », « via … » (fiche) |
| Le client final | « Client » (formulaires, carnet), « propriétaire » (fiche de chantier, téléphones) |
| Enregistrer | « Enregistrer », « Valider », « Créer le chantier », « Terminer », « Ajouter au carnet » |
| Supprimer | « Supprimer », « Retirer », « ✕ », « × » |
| Ajouter | « + Ligne », « + Dépense », « + Charge », « + Achat », « + Poste », « + Intervention », « + Mouvement », « + note », « + liste », « Nouveau chantier », « Nouvelle pile », « Enregistrer » (stock), « Ajouter » (réglages) |
| Voir le détail | « Détail », « Ouvrir », « Fiche », « Voir » |
| Le temps passé | « Temps », « Temps passé », « Du temps fait », « Noter du temps », « J'ai travaillé », « J'y ai travaillé », « Ma journée », « Enregistrer ma journée » |
| La période | « Période » (Finances), « Vue » (le type) et « Année » (Analyses) — « Vue » est aussi le nom d'un écran |
| Le retour | « ← Carnet », « ←», « Revenir à … », « Tout voir » (qui n'est pas un retour) |

### 5.4 Particularités de structure

- **Réglages d'arrivée selon le module** : Chantiers et Rendements →
  « Ma journée de travail » ; Calendrier → « Relances et calendrier » ;
  Finances et **Achats** → « Financier » (les achats n'ont pas de zone à eux) ;
  Stock → « Stock et fournitures » ; Véhicule → « Véhicule ».
- **Messages qui nomment un chemin inexistant** (corrigé en 4.85.1) : neuf confirmations de
  suppression disent « Réglages ▸ Fichiers ▸ Corbeille ». Il n'y a plus de
  pastille « Fichiers » dans les réglages ; la corbeille est dans Réglages ▸
  Général ▸ Sauvegarde.
- **Le bouton « Enregistrer » du stock** ouvre une commande ou une sortie
  selon la pastille active (Entrées / Sorties / Pertes), alors que son libellé
  ne le dit pas.

### 5.5 À vérifier (soupçon de défaut, non corrigé ici)

- **Rappel de sauvegarde de l'accueil** : le clic appelle l'ancienne vue
  `fichiers` puis cherche la carte de sauvegarde (`#c-sauvegarde`), qui est
  maintenant dans les réglages et pas dans cette vue. À essayer sur le
  téléphone : il est possible que le rappel n'amène pas à la sauvegarde.
