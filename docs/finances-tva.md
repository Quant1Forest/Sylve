# Finances, dépenses, TVA et déclarations

Charges fixes, dépenses, déclarations, et les nomenclatures reprises du carnet.

## Les listes viennent du carnet Excel

Les nomenclatures de `TRAVAUX`, `CATEGORIES` et `NATURES` reprennent celles du
classeur comptable tenu jusqu'ici. Elles ne sont pas décoratives : les changer
sans raison casse la correspondance avec l'historique à importer.

- **`CATEGORIES` est rangée par fréquence d'achat réelle**, pas par ordre
  alphabétique : la saisie se fait debout, une main sur le téléphone.
  *Consommable* en tête (le gasoil du tracteur, le mélange, l'huile de chaîne,
  les chaînes, les agrafes), puis restauration, carburant, EPI.
- **Deux carburants** : *pro* pour l'utilitaire, *perso* pour le véhicule
  personnel employé au travail. La distinction est voulue.
- *Assurance* et *Cotisations, taxes* n'étaient pas dans le carnet : gardées,
  parce qu'elles finiront par servir.
- **`MARQ` s'intitule désormais « Balivage ».** Marquage, martelage et comptage
  ont été retirés — ce n'est pas ce métier-là. Le code interne n'a pas bougé,
  pour ne décrocher aucune ligne déjà saisie.
- **Le débours est une nature à part** (`horsCA: true`) : somme avancée pour le
  client et refacturée à l'euro près. Ni abattement, ni cotisations, et il ne
  pèse pas sur les plafonds du micro-BIC. `chiffreAffaires` additionnait
  aveuglément toutes les natures — le compter comme recette gonflait le CA.
  Le module Stock, lui, distinguait déjà vente / débours / perte.

## Charges fixes

Les postes courants d'un entrepreneur seul : assurances, abonnements et
logiciels, frais de compte bancaire, prêt. D'où les catégories `ABO`, `BANQUE` et `PRET`,
qui n'existaient pas — sans elles tout finissait en « Frais administratif » et
le graphique de répartition ne disait rien.

- **`fixe: true`** marque les catégories qui ont un sens pour une charge
  fixe ; `categoriesFixes()` filtre le formulaire. La catégorie déjà posée est
  toujours conservée, sinon une charge saisie avant ce tri deviendrait muette
  dans son propre formulaire.
- Le champ s'intitule **« Payé à »**, pas « Bénéficiaire » : le mot était juste
  — c'est bien lui qui reçoit — mais il se lisait comme le bénéficiaire du
  contrat, donc l'utilisateur lui-même.
- **Le bandeau annonce, il ne réclame pas.** Préavis suivant l'espacement :
  14 j annuel, 10 j semestriel, 7 j trimestriel, 3 j mensuel. Seules les
  échéances **à venir** sont remontées. Ces charges sont prélevées
  automatiquement, sans facture, donc jamais pointées : réclamer un pointage
  aurait posé une alerte permanente qui finit par ne plus être lue.
- **Le rappel vit sur l'accueil** (`#a-echeances`), sous celui de sauvegarde.
  Il avait d'abord été posé dans `#bandeau-alertes`, qui est *dans la vue
  Carnet du module Chantiers* — invisible au lancement, donc inutile. Au-delà
  de deux échéances il résume, sinon il mange l'accueil.
- **Le formulaire ne demandait jamais l'année.** Un jour et un mois de
  référence seulement : un abonnement souscrit en 2024 était indiscernable
  d'un souscrit deux ans plus tard, et ses échéances remontaient depuis
  toujours. `charge.debut` existait pourtant déjà dans `echeances()`, sans
  jamais être saisi. C'est désormais « Date du premier paiement », d'où sont
  déduits `jour` et `moisReference`.
- **`sansTva` est branché** : sur assurance, cotisations et prêt, le champ TVA
  passe à zéro et se ferme. Le drapeau existait depuis le début sans servir à
  rien. Corollaire utile : seules les charges qui portent de la TVA méritent
  d'être pointées en dépense, puisque c'est la TVA qui se récupère.

## Les dépenses, c'est la TVA — pas la trésorerie

Règle posée par l'utilisateur, et elle tranche beaucoup de choses : **le
module Dépenses ne sert qu'à calculer la TVA payée et à repérer les
immobilisations.** Un remboursement de prêt n'y a rien à faire — c'est un
remboursement, pas une charge d'exploitation, et il ne porte aucune TVA.

D'où la case **« Enregistrer les échéances dans les dépenses »** sur la
charge fixe (`c.dansDepenses`). La question se pose **une fois, à la
création**, plus tous les mois : `synchroniserDepensesCharges()` crée les
dépenses des échéances déjà passées, depuis `charge.debut`.

Même mécanique que la sortie de stock d'une facture, et pour les mêmes
raisons : jamais saisie, refaite à chaque modification, marquée `auto: true`.
Trois gardes protègent l'historique :

- **rien au-delà d'aujourd'hui** : on ne paie pas une échéance à venir ;
- **une échéance déjà pointée à la main est laissée telle quelle** (`d.charge`
  sans `d.auto`, à moins de vingt jours). Sans cette garde la TVA déduite
  doublerait sur tout ce que l'ancien pointage manuel avait enregistré ;
- **décocher ne retire que les dépenses automatiques.**

Le pointage manuel (`pointerCharge`) a disparu, et avec lui le bouton
« Enregistrer » dont personne ne comprenait le nom. Une dépense automatique
se corrige sur sa charge : dans la liste des dépenses, son bouton ouvre la
charge, sinon la correction serait effacée à la synchronisation suivante.

**La TVA est obligatoire dès que la case est cochée**, et le champ passe en
rouge tant qu'elle manque : une dépense à 0 % ne récupère rien, et c'est
l'oubli le plus facile. À l'inverse, `sansTva` ferme le champ — assurance,
prêt, cotisations, et **frais bancaires** depuis la 4.37 (services bancaires
exonérés). Le libellé du montant suit : « Montant TTC » n'a pas de sens sans
TVA, c'est « Montant » tout court.

## Reprendre le carnet tenu sous tableur

`outils/importer-carnet.js` convertit le classeur comptable en un fichier de
sauvegarde que l'application restaure d'un seul geste — bien plus loin que
l'import CSV, qui ne sait reprendre que des chantiers.

```bash
node outils/importer-carnet.js "<comptabilité.xlsx>" ["<stock.xlsx>"] [sortie.json]
```

- **Une facture donne un chantier**, ses lignes deviennent les lignes de
  travaux. C'est la règle posée par l'utilisateur, et celle de l'application,
  où une recette est une ligne de chantier.
- Le nom vient de la prestation quand la facture n'en porte qu'une, de la
  catégorie sinon, suivi du client.
- **Le classeur ne doit jamais entrer dans le dépôt** : il porte des noms de
  clients et des montants réels. Le fichier produit non plus. Le scénario de
  test qui le vérifie se passe tout seul quand le fichier est absent.
- Ce que le tableur ne contient pas ne s'invente pas : ni lieu, ni temps
  passé. Les rendements resteront donc vides sur cet historique.
- **Le classeur de stock se donne en second argument.** Ses ventes portent le
  même numéro de facture que le carnet comptable : chaque sortie est donc
  rattachée à son chantier, et suit son statut au lieu de vivre à part.
- **La livraison n'est pas un produit.** C'est un frais de port qui se
  répartit sur la commande et pèse sur le prix de revient. L'écarter avant de
  créer l'article, sinon elle entre à l'inventaire.
- **Le Trico se compte en millilitres**, avec son dosage par plant lu dans
  l'encadré du classeur — 6 ml. C'est ce qui rendra la déduction automatique
  possible le jour où une ligne de chantier pointera vers un article.
- Deux repères pour savoir si la conversion est juste : le total des achats
  doit tomber au centime sur celui du tableau de bord, et l'écart sur le
  chiffre d'affaires doit valoir exactement les débours — le tableur les
  exclut, `chiffreAffaires` aussi.

## Les déclarations : rassembler, pas recalculer

Il demandait « un endroit impôt, cotisation, taxes ». Le constat en ouvrant le
code : **presque tout existait déjà**. `simulation()` estimait cotisations et
impôt avec ses propres taux, `tvaCollectee()` donnait la TVA par taux,
`balanceTva()` le solde. Éparpillés sur trois écrans, si bien que le jour de
la déclaration il les recopiait de tête. **Problème de rassemblement, pas de
calcul** — la même leçon que « Recettes ».

D'où une **quatrième pastille dans Analyses**, et non un module.

- **La base est le CA FACTURÉ**, à sa demande expresse du 23 août. Le micro-BIC
  se déclare normalement sur l'**encaissé** ; il le sait, c'est son choix, et
  c'est écrit à l'écran. Ne pas le « corriger » en silence.
- **`impotEstime()` suit sa règle** : quand d'autres revenus du foyer
  consomment la tranche à 0 %, la base entre directement dans celle à 11 %,
  dont il reste une capacité (`impotCapacite`), puis bascule à 30 %. Les trois
  nombres sont réglables — les tranches changent chaque année. **La capacité
  n'a pas de valeur par défaut** depuis la 4.83 : sans elle l'impôt ne s'estime
  pas, et l'écran dit ce qui manque. Voir *Aucun chiffre à lui*.
- **Le remboursement vit sur le versement d'origine**, pas sur une ligne à
  part : le net doit se lire sans perdre l'histoire.
- **Le versement libératoire** (4.83) : une case, **l'année à partir de
  laquelle** il s'applique, deux taux modifiables — 1 % sur les ventes, 1,7 %
  sur les prestations. `vlApplicable(cfg, annee)` et `versementLiberatoire(ca,
  cfg)`. Sur le **brut**, sans abattement ni tranche ; le débours reste dehors.
  Cocher propose l'an prochain : *« je vais sûrement passer au versement
  libératoire pour l'an prochain »*. Les années d'avant restent au barème —
  cocher ne réécrit pas les estimations passées, et un scénario le garde.
  **Son droit à l'option n'est pas vérifié** : elle est liée au régime
  micro-social, et ses cotisations MSA calculées après abattement laissent un
  doute. Il devait appeler la MSA.
- **Les cotisations MSA : un seul taux, sur la base après abattement** — 50 %
  en prestations, 71 % en ventes. C'est lui qui l'a corrigé le 15 septembre,
  après qu'on lui a parlé à tort de deux taux « comme à l'URSSAF ». Sylve le
  faisait déjà : « Appliqué au montant après abattement ».
- **`A.decl` n'est pas `A.periode`.** Le sélecteur des déclarations est
  propre à cet écran : il raisonne en mois ou trimestre, pendant que le reste
  des Analyses garde la période générale. Changer de rythme replie l'indice —
  le T3 n'est pas le mois de mars.

**Piège attrapé au passage, et il valait cher.** `lignesFacturees()`
recalculait le taux de TVA dans son coin et retombait sur **20 %** dès qu'aucun
taux n'était forcé à la main — alors que la fiche appliquait le vrai, 10 % sur
des travaux forestiers avec SIREN. Deux TVA pour le même chantier, et c'est
celle des Finances qu'on déclare. `tauxLigne` y est désormais **injecté**,
comme `parFamille()` et `tauxReussite()` reçoivent déjà les fonctions du
module des chantiers. Le scénario éprouve les deux sens : sans le taux injecté
il retrouve les 200 € d'avant, avec lui les 100 € justes — **il se sabote
lui-même**.

## Une facture qui attend n’est pas un impayé

*« C’est compliqué de les mettre en impayé si je viens à peine de les
envoyer. »* La bulle comptait tous les chantiers au statut `facture` et les
appelait **impayés**, en rouge. Elle dit maintenant **« factures en
attente »**, et elle ne chauffe que si `C.alertes()` remonte un vrai
dépassement d’échéance.

**La bulle compte, l’alerte accuse.** C’est la même règle que pour la bulle et
l’alerte d’impayé notées plus haut : elles ne font pas doublon, elles ne
répondent pas à la même question.

## Une échéance qui tombe aujourd’hui est arrivée

`synchroniserDepensesCharges()` bornait à `minuit(aujourd’hui)`, alors qu’une
échéance est horodatée **à midi** : un prélèvement du jour même restait « à
venir » toute la journée et n’entrait dans les dépenses que le lendemain. La
borne est la **fin** du jour.

**Même famille que les quatre comptes de jours en millisecondes** : on
comparait une heure à une frontière de jour. Et **le défaut s’est révélé par
le calendrier** — la suite était verte le 31 août, rouge le 1er septembre.

Le scénario, lui, comptait les échéances passées avec « le numéro du mois »
et n’était juste que du 5 au 31. Il sème désormais une charge **calée sur le
quantième du jour**, quel que soit ce jour : une garde écrite « si on est le
1er » ne mordrait qu’une fois par mois.
