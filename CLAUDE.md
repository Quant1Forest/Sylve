# Sylve

Application de gestion pour un entrepreneur de travaux forestiers. Un seul
fichier HTML, aucune dépendance, aucune compilation, tout fonctionne hors
ligne.

Version courante : **4.48.0-20260819-2020**

---

## Pour qui

Un entrepreneur de travaux forestiers, seul sur son entreprise. Travaux
sylvicoles : plantation, protections, dégagement, début de cycle. Pas
d'abattage à titre principal.

Sylve est son outil, pas un produit. Il sert le téléphone dans la poche et les
mains dans la terre.

**Comment travailler ensemble :**

- Les retours arrivent dictés depuis le téléphone, souvent mal transcrits :
  lire l'intention plutôt que les mots.
- Poser des **questions de cadrage** plutôt que supposer. Un point ouvert se
  pose explicitement, il ne se tranche pas seul.
- Réponses **courtes**. Ni listes exhaustives, ni précautions oratoires.
- Avancer **module par module**, corriger d'un bloc, rendre la liste écrite de
  ce qui a changé.
- **« Continuer » n'est jamais un accord.** Ce mot vient d'un bouton de
  l'interface, pas d'une intention. Un silence non plus. Attendre un oui
  explicite avant toute modification structurelle. Cette règle a déjà coûté
  cher : voir *Le chantier des rendements*, plus bas.
- Le vocabulaire technique ne va pas de soi. « commit », « push », « service
  worker », « cache » demandent une explication en français courant, une fois,
  sans condescendance. Un mot lâché sans être expliqué bloque la conversation.
- Pour le visuel, juger sur pièce : fabriquer une maquette HTML autonome
  plutôt que décrire une intention. Les maquettes vont dans `maquettes/`, qui
  n'est pas versionné : elles servent à trancher, puis n'ont plus d'objet.
- **Le dépôt est public.** Rien qui identifie l'utilisateur n'y entre : ni nom,
  ni commune, ni statut, ni chiffres réels. Ce fichier compris. Le vocabulaire
  métier (micro-BIC, MSA) est autre chose : ce sont des fonctions de
  l'application, elles restent.

---

## Vérifier avant de livrer

```bash
npm install        # une seule fois : jsdom
npm run controle   # vérificateur + service worker + tests + reconstruction + conformité
```

Doit afficher **« Bon pour livraison »**, puis **« le service worker tient »**
(24 vérifications), puis la suite au vert — 316 à ce jour — puis
**« Sylve.html est conforme »**.

Compter **moins de deux minutes**. Ça a été dix, et deux choses l'expliquaient :

- Les tests attendaient **2,4 s à chaque ouverture** alors que l'application
  démarre en une seconde. Elle pose maintenant `data-pret` sur le `body`
  quand ses données sont relues et ses écrans rendus ; `ouvrir()` sonde
  jusque-là. Ne jamais revenir à une attente devinée.
- La suite tournait **deux fois**, la seconde sur `Sylve.html`. Or ce fichier
  ne diffère de `index.html` que par deux lignes : rejouer quarante scénarios
  dessus, c'était retester du code déjà testé. `outils/comparer.js` prouve la
  même chose en une seconde — comparaison ligne à ligne, puis démarrage réel.
  Sa garde a été éprouvée dans les deux sens : elle sort en 1 dès que les
  fichiers divergent.

**Une correction sans vérification qui la couvre n'est pas finie.** Chaque
changement de comportement s'accompagne d'un scénario dans `outils/tests.js`.
C'est la règle la plus importante du projet : elle a déjà rattrapé plusieurs
régressions silencieuses.

**Et un contrôle qu'on n'a jamais vu échouer ne prouve rien.** Avant
d'adopter une vérification, la casser exprès et s'assurer qu'elle crie. Trois
fois déjà, un contrôle passait au vert sans rien examiner : le vérificateur
qui annonçait « 1 identifiant, tous uniques » après avoir coupé le fichier au
premier `<script>` ; la première version de `comparer.js` ; et celle des tests
du service worker, qui comparait le cache à la liste que le service worker
annonce lui-même — retirer un fichier des deux côtés laissait le compte juste.
Une vérification doit se croiser avec une source écrite ailleurs, pour
d'autres raisons : c'est le manifeste qui dit maintenant quelles icônes
doivent être en cache.

**Un seul passage, à la fin.** Ne pas relancer la suite après chaque
modification : écrire le code et ses scénarios, puis contrôler l'ensemble une
fois, avant de rendre la liste de ce qui a changé. Dix passages dans une
séance rejouent surtout des scénarios déjà verts, et c'est l'essentiel du
temps d'attente.

**Pour casser un contrôle exprès, filtrer.** `outils/tests.js` prend un
troisième argument : seuls les scénarios dont le nom le contient sont joués.

```bash
node outils/tests.js index.html "double compte"
```

Éprouver cinq gardes en rejouant chaque fois les quarante scénarios coûtait
dix minutes ; avec le filtre, quelques secondes chacune.

Scripts séparés si besoin : `npm run verifier`, `npm test`,
`npm run construire`.

---

## Livrer

**Une version = une mise à jour qu'il valide**, pas un lot de travail.
Plusieurs séances de corrections peuvent s'accumuler sous le même numéro :
il ne monte qu'au moment d'envoyer. Sinon on arrive à la 4.99 avant que
l'application soit finie, et chaque numéro perd son sens — il doit
correspondre à ce qu'il a réellement vu changer sur son téléphone.

**La 5.0 sera la version jugée aboutie** — partie Entreprise finie, telle
que l'utilisateur la veut sur le terrain. D'ici là on reste en 4.x : le
chiffre du milieu monte à chaque lot qui change quelque chose de visible.

Le dépôt est publié par GitHub Pages : ce qui est poussé sur `main` devient
l'application, et le téléphone propose la mise à jour à la prochaine ouverture
avec du réseau.

**Un correctif part seul. Une modification se demande.** Règle posée le
18 août 2026, après une trentaine de lots où il répondait « oui » à chaque
fois : ce qu'il valide, il ne peut de toute façon le juger qu'une fois
l'application entre ses mains. Lui faire relire un correctif d'alignement ne
lui apprend rien.

**Part sans rien demander** — un correctif : réparer un comportement décrit
comme cassé, sans changer ce que l'application propose. Un libellé faux, un
alignement, un calcul erroné, une garde manquante, un bouton qui ne répond
pas. Condition ferme : le contrôle au vert **et** le scénario qui couvre la
correction écrit.

**Attend son feu vert** — une modification : tout ce qui ajoute, retire ou
déplace quelque chose. Un écran, un module, un onglet, un champ, une règle
métier, une couleur qu'il n'a pas demandée. Et **tout ce qui touche à ses
données existantes** : migration, création en masse, suppression.

**Dans le doute, c'est une modification.** Se tromper en demandant coûte un
message ; se tromper en publiant met sur son téléphone quelque chose qu'il
n'a pas voulu.

Un `git push` reste une publication, pas une sauvegarde : ce qui part sur
`main` est en ligne à la prochaine ouverture avec du réseau.

Livrer suppose aussi d'avoir monté la `VERSION` dans `index.html` **et** dans
`sw.js` — sans quoi les téléphones déjà installés continuent de servir
l'ancien code. Le vérificateur refuse de passer si les deux divergent.

---

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | **Toute l'application.** ~11 600 lignes : HTML, CSS et JS dans un seul fichier. |
| `Sylve.html` | Version autonome, fabriquée par `outils/construire.js`. Ne jamais l'éditer à la main. |
| `sw.js` | Service worker. Sa constante `VERSION` doit être identique à celle de `index.html`. |
| `manifest.webmanifest` | Nom, couleurs, icônes de la PWA. |
| `icone-*.png` | Icônes d'installation. La version *maskable* garde toute son encre dans la zone de rognage d'Android. |
| `outils/` | Vérificateur, tests, tests du service worker, construction, conformité du fichier autonome, reprise du carnet. |

Les fichiers d'origine du logo ne sont pas dans le dépôt : ils sont gardés à
part. Le dépôt étant public, il ne contient que ce qui est servi, plus de quoi
travailler.

---

## Conventions

- **ES5 uniquement** dans `index.html` : `var`, `function`, pas de flèche,
  pas de `let`, pas de template literal. Le fichier s'ouvre parfois sur du
  vieux matériel.
- **Français partout**, y compris dans les noms de fonctions et de variables.
- Les commentaires disent **pourquoi**, jamais **quoi**. Un commentaire qui
  paraphrase la ligne suivante est du bruit.
- Stockage local via `lire` / `ecrire`, sous les clés `bordcub.*`.
- `A` porte l'état, `A.cfg` la configuration. **`A.cfg` part dans les
  sauvegardes** : c'est donc le bon endroit pour les petites listes que
  l'utilisateur enrichit.
- Les couleurs passent par les variables de `:root`. Ne jamais écrire une
  couleur en dur dans une règle.

---

## Pièges déjà rencontrés

- **`Sylve.html` doit être reconstruit** après chaque modification de
  `index.html`. Un fichier autonome en retard s'ouvre sans erreur et ment sur
  la version. `npm run controle` s'en charge.
- **`VERSION` existe en deux endroits**, `index.html` et `sw.js`. Le
  vérificateur refuse de passer s'ils divergent.
- **L'icône de l'écran d'accueil ne se met pas à jour** avec l'application :
  le téléphone la copie une fois à l'installation. Il faut retirer puis
  réinstaller — et **exporter une sauvegarde avant**, la désinstallation peut
  emporter le stockage local.
- **Le logo n'existe qu'une fois** dans le fichier, dans la variable CSS
  `--logo`, en base64. L'accueil et le bandeau y puisent tous les deux. Une
  vérification garde ça en place.
- **`--doux` et `--vert-marque`** ont été utilisés avant d'être définis.
  Vérifier qu'une variable existe dans `:root` avant de s'en servir.
- **Deux vérifications s'adossent au texte du CSS** (`tests.js`, lignes 331 et
  359 : la présence de `--logo:url(`, la taille de `#b-accueil`). Un simple
  reformatage les casserait alors que le comportement serait intact. À
  réécrire plus solidement le jour où ce CSS bouge.
- **Deux fonctions ont failli porter le même nom.** `dateChantier()` rend le
  dernier jour *travaillé* — journées placées, sinon temps saisis — et sert au
  calendrier. Le tri du carnet demandait autre chose : la dernière *étape*
  franchie, paiement ou facture. D'où `dernierEvenement()`. Le vérificateur a
  attrapé le doublon avant qu'il ne casse le calendrier en silence : c'est
  exactement ce pour quoi il existe.
- **`accueil-ouvert` masque le bandeau par CSS.** `ouvrirChantier()` ne le
  retirait que par la branche `allerModule` ; ouvrir une fiche depuis « À
  traiter » alors que le module Chantiers était déjà actif passait par
  `aller()` et laissait le masque en place. La fiche s'affichait sans bouton
  retour ni sélecteur de partie — aucun moyen de ressortir. Toute fonction
  qui mène à une vue de contenu doit lever ce masque.
- **Ne pas additionner des quantités d'unités différentes.** `parPrestation()`
  cumulait sans regarder l'unité et gardait celle de la première ligne : une
  plantation facturée 4 jours puis 1 705 plants ressortait en « 1 709 jours ».
  Unités mêlées, on renonce à la quantité.
- **Écrire les scripts de retouche dans un fichier, jamais dans `node -e`.**
  Passé à travers les guillemets du shell, `[\s\S]` arrive dans le fichier
  en `[sS]` et `\u00A0` en `M`. Trois essais perdus le 18 août 2026 sur une
  seule expression régulière. Corollaire : quand on remplace un texte qui
  contient `$$` — les sélecteurs `t.$$()` des tests — `String.replace` le lit
  comme un `$` littéral. Utiliser `split().join()` ou une fonction de
  remplacement.
- **Ne jamais réécrire un fichier avec `Set-Content` sous PowerShell 5.1.**
  `Get-Content -Raw` lit en ANSI, `Set-Content -Encoding utf8` réécrit en
  UTF-8 : chaque accent traverse deux fois l'encodage et ressort en `Ã©`,
  `â€™`, `Ãª`. Une seule commande a corrompu 1440 accents d'`index.html` et
  ajouté un BOM. Pour un remplacement dans un fichier, passer par `sed` via
  Bash, ou par l'outil d'édition. Un fichier ainsi abîmé se répare en le
  relisant en UTF-8 puis en le réencodant en Windows-1252.
- **Une variable non déclarée tue toute la branche.** Le gestionnaire de clic
  des journées testait `else if (part)` — `part` n'existait ni en local ni en
  global. Chaque clic dans la zone levait un `ReferenceError` avant d'arriver
  à la branche de suppression : la croix ne retirait jamais rien, et sans
  console ouverte rien ne le disait. Une branche morte dans un `if/else if`
  ne se voit pas, elle se teste.
- **`toISOString()` n'est pas une date locale.** Un champ `<input type="date">`
  parle en heure locale ; `toISOString()` répond en heure de Greenwich, où
  minuit à Paris est 22 h la veille. Tout timestamp passé par `C.minuit()` en
  ressortait donc décalé d'un jour. Corrigé le 3 août 2026 dans `versChamp`,
  qui s'appuie désormais sur `C.jourCle`. Pour les dates, `jourCle` et
  `minuit` sont les seules bonnes portes — et un test qui écrit
  `toISOString()` passe au vert à Londres tout en mentant en heure française.

---

## Où en est le design

Terminé :

- Palette crème calée sur le logo (`--papier: #F4EDE2`).
- Logo sur l'accueil et sur le bouton de retour du bandeau, nulle part ailleurs.
- Bandeau vert foncé, filet brun de la marque. Le bleu en a été retiré.
- Pictogrammes au trait partout : pastilles sombres pleines sur l'accueil,
  ronds fins au second niveau, et les 33 onglets du bas.
- `PICTOS` est indexé sur l'identifiant de vue, pas sur le module : une même
  notion porte donc le même dessin partout. Deux vérifications le garantissent.
- Le bandeau est redevenu de la navigation pure. Les actions qui doublonnaient
  avec un bouton de page en ont été retirées.
- **Le bleu `--accent: #1F5FA9` est validé et conservé.** Question tranchée le
  3 août 2026 : il tient bien avec le crème et le vert, il rend les boutons
  principaux lisibles, et il apporte la seule couleur vive de l'interface. Ne
  plus rouvrir le sujet.

Restent ouverts :

- **Les réglages vivent dans le bandeau**, plus dans les onglets du bas. Ils y
  étaient répétés neuf fois, à une place différente selon le module, et
  mangeaient un onglet là où il n'y en a que deux. Le bouton ouvre la section
  correspondant à la partie courante.
- **Trois actions restent dans le bandeau** faute d'équivalent dans leur page :
  *Estimer* (seul accès à l'écran d'estimation — le retirer bloquerait
  dehors), *Aujourd'hui*, *En-tête*. À déplacer dans leur page avant de les
  retirer du haut.
- **L'icône Apple** déclarée dans `index.html` est la marque détourée. iOS ne
  gère pas la transparence sur l'écran d'accueil et la remplit en noir.
  Basculer sur la version crème le jour où un iPhone entre dans le tableau.

Fait en 4.21.0 :

- **Écran de démarrage.** Fond crème, logo, nom, filet brun, puis
  *« Gestion et terrain, à portée de main »*. Il entre net et sort en fondu :
  Android affiche déjà le même crème à partir de `background_color`, la
  jointure entre son écran et le nôtre ne doit pas se voir. Au **démarrage à
  froid seulement** — `sessionStorage` fait la frontière — et un appui
  n'importe où le fait sauter.
- La durée se règle dans **Réglages ▸ Général ▸ Application**, curseur de 0 à
  3 s par pas de 0,2. Zéro le supprime. Le réglage vit dans
  `A.cfg.demarrageDuree`, donc il part dans les sauvegardes.
- Le bloc vit **hors de `#app`**, avec son propre `<script>` : il doit
  s'afficher avant que l'application ait fini de charger et s'effacer même si
  elle échoue. Il lit donc la durée en synchrone dans le miroir
  `localStorage`, sans attendre que la configuration soit relue — sinon
  l'écran clignoterait, ou s'afficherait alors qu'il est réglé sur « aucun ».

---

## Le chantier des rendements — à ne pas rouvrir sans son feu vert

Le contexte à cinq critères posé au niveau du chantier (essence, densité,
hauteur, difficulté, terrain) est une erreur de conception. Deux raisons :

1. **Trop peu de matière.** Cinq critères à trois niveaux font 243
   combinaisons, pour une trentaine de chantiers par an. Un modèle sortirait
   des moyennes calculées sur un ou deux chantiers, avec un air d'assurance.
   Pire que rien.
2. **Mauvais niveau.** Ce n'est pas le chantier qui a une difficulté, c'est la
   prestation. Ce qui ralentit une plantation (sol, portage) n'a rien à voir
   avec ce qui ralentit un dégagement (ronce, retrouver les plants).

Ce qui a été codé en conséquence, **sans validation** — deux « Continuer » lus
comme un accord — et livré depuis la **4.15.0**, donc présent sur le téléphone :

- L'en-tête du chantier ne garde qu'essence et densité. Hauteur, difficulté et
  terrain n'y sont plus saisissables.
- Chaque ligne de travaux porte une note de difficulté de 1 à 5 et une
  précision libre.
- L'estimatif ne modélise plus rien : il affiche les rendements passés pour la
  prestation choisie (le plus bas, le médian, le plus haut) et situe le
  chantier dedans. `similarite()` et `chipsNiveau()` ont été supprimées.

**Les données anciennes sont intactes.** L'enregistrement fusionne par-dessus
les critères existants (`Object.assign({}, c.criteres || {}, {essence,
densite})`) : `hauteur`, `difficulte` et `terrain` restent en base et
`critLibelle()` les affiche toujours quand elles sont présentes. Seule la
saisie a disparu.

Revenir en arrière coûterait : remettre les cinq champs dans l'en-tête,
restaurer `similarite()`, refaire l'écran d'estimation — et les notes de
difficulté portées par les lignes de travaux deviendraient orphelines.

Le sujet a été garé, pas annulé : **« on verra plus tard »**. Signalé
explicitement le 3 août 2026, décision reportée. Ne pas y toucher, dans un sens
ou dans l'autre, sans demander.

---

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

Sept postes réels : deux assurances, trois abonnements ou logiciels, les frais
de compte bancaire, un prêt. D'où les catégories `ABO`, `BANQUE` et `PRET`,
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

## L'écran Entreprise : bulles au-dessus, notes en dessous

Le regroupement des sept tuiles en trois titres a été **écarté** après
maquette : un appui de plus à chaque navigation, pour toujours, et la barre
d'onglets du bas — rangée par module — n'aurait plus su quoi faire d'un titre
qui en regroupe quatre. Ce que l'utilisateur cherchait était l'**état des
lieux**, pas moins de routes.

`#ent-bilan` porte donc six bulles, **au-dessus** des tuiles : journées à
planifier, devis signés, chantiers en cours, impayés, chiffre d'affaires,
TVA déductible. Un seul chiffre par bulle — deux nombres côte à côte et on ne
sait plus lequel on lit. Chacune mène à la liste qui la détaille.

`#ent-alertes` garde les trois alertes qui portent un nom de chantier — en
retard, à facturer, impayé — puis les **notes que l'utilisateur s'écrit**
(`A.cfg.notes` : titre, précision, couleur choisie parmi six). Elles vivent
dans la configuration parce qu'elle part dans les sauvegardes.

**La bulle et l'alerte ne font pas doublon** : la bulle donne le compte et le
montant, l'alerte dit lequel et depuis quand. C'est précisément ce qu'on veut
savoir d'un impayé — l'avoir retiré une première fois était une erreur, le
scénario de navigation l'a rattrapée.

**Un module qui n'a qu'une vue n'affiche pas d'onglet** (`sans-onglets`) : un
onglet unique étiré sur la largeur ne propose rien. Analyses est le seul cas.

## Cinq modules, plus sept

Deux des sept « modules » de la partie Entreprise n'en étaient pas. Le test
qui les a désignés est simple et se rejoue : **un module dont toutes les vues
appartiennent à d'autres modules est une entrée de menu déguisée.**

- **« Devis et estimatif » a été supprimé** en 4.38. Son onglet *Estimer*
  était celui des Rendements, son onglet *Devis* le carnet des Chantiers. Le
  devis vit désormais sur la fiche du chantier, ce qui achevait de le vider
  de son objet. Rien n'a été perdu : `estimer` est le second onglet des
  Rendements.
- **« Analyses » est devenue le quatrième onglet de Finances.** Les deux
  écrans lisaient les mêmes données — chantiers et dépenses — sur la même
  période. Ils portaient même deux jeux de sélecteurs distincts (`fi-*` et
  `an-*`) qui écrivaient déjà tous les deux dans `A.periode` : la fusion n'a
  donc rien eu à réconcilier.
- **« Recettes » existait déjà**, en pastille dans Analyses à côté de « Vue
  d'ensemble » et « Dépenses ». Ne pas en créer un second : le manque
  ressenti était un problème de visibilité, pas d'absence.

**Deux nettoyages en ont découlé, et c'est le signe que la fusion était
juste :**

- L'action *Estimer* du bandeau n'avait plus lieu d'être — elle était là
  parce que c'était « le seul accès à l'écran d'estimation ». Ce n'est plus
  vrai. Il ne reste que *Aujourd'hui* et *En-tête*.
- La garde `sans-onglets` de la 4.37 a été **retirée** : Analyses était son
  seul cas. Un scénario vérifie maintenant qu'aucun module ne se réduit à un
  onglet solitaire — il criera le jour où l'un réapparaîtra.

**Un téléphone déjà installé garde en mémoire le module ouvert.**
`MODULES_RETIRES` redirige `devis` vers Rendements et `analyses` vers
Finances, et réécrit la valeur au démarrage. Sans ça, l'application se
rouvrait dans le cubage, à l'autre bout.

**Les réglages ne sont pas un étage de la navigation.** C'est une vue, et le
retour du bandeau lisait le module courant : on ressortait des réglages dans
« Mon entreprise », jamais sur l'écran quitté. `aller()` retient donc
`A.vueAvantReglages`, et `allerMenuParent()` y redescend d'abord — à
condition que cette vue appartienne encore au module ouvert.

## Journées faites, échéance de paiement, fiche à compléter

**Une journée posée sur une date passée a eu lieu.** `journeesFaites()` et
`journeesAVenir()` séparent le placé selon la date du jour, et la fiche
annonce « faites · à venir · à placer ». C'est ce qui permet de saisir après
coup un chantier déjà commencé sans que tout devienne de l'estimation.

**Attention au contresens** : « faite » dit qu'on y était, pas combien
d'heures on y a passé. Les rendements se calculent toujours sur les temps
saisis (`temps`, alimenté par les journées), jamais sur ces journées placées.
Ne pas les brancher l'un sur l'autre pour « simplifier ».

**L'échéance prime sur le délai.** `c.echeancePaiement` est demandée au
moment de basculer en « Facturé », avec des raccourcis +30/+45/+60 jours
comptés depuis la date de facture — pas depuis aujourd'hui, sinon une facture
saisie après coup recevrait une échéance fausse. `retardPaiement()` compare à
cette date ; `joursRelanceFacture` ne sert plus que faute d'échéance saisie.

**Le délai de règlement se lit par client**, dans le bilan des finances, à
côté de ce que ce client rapporte. C'est **la médiane**, pas la moyenne : un
seul règlement oublié six mois donnerait une réputation imméritée. Le pire
délai s'affiche à côté quand il dépasse la médiane.

**`ce-ech` est un piège de nommage.** C'était l'ancienne échéance *de
chantier* (« à finir avant le »), retirée exprès — il raisonne en journées à
poser, pas en date butoir — et un scénario garde sa disparition. L'échéance
de paiement s'appelle donc `ce-echpaie`. Le test a attrapé la collision.

**Une fiche incomplète se signale, elle ne bloque jamais.** `CHAMPS_FICHE`
liste les champs clés avec l'étape à partir de laquelle chacun a un sens
(`des`) : on ne réclame pas un numéro de facture sur un devis. Un chantier
`sansuite` ne manque plus de rien — il ne se fera pas. La marque « à
compléter » apparaît dans le carnet, la fiche énumère les manques, et un
filtre les rassemble.

## Le rangement des réglages

« J'ai du mal à savoir où va quoi » avait deux causes, et aucune n'était le
nombre d'onglets.

1. **Une carte intitulée « Chantiers » tenait quatre sujets sans lien** : la
   journée de travail, le véhicule, les relances, les week-ends. Rien ne
   disait que la consommation du fourgon se réglait sous « Chantiers ». Elle
   est éclatée en trois zones titrées — *Ma journée de travail*, *Véhicule*,
   *Relances et calendrier*.
2. **Le bouton du bandeau ne choisissait que l'onglet, jamais la zone.**
   Depuis Finances, il déposait au sommet d'un onglet Entreprise qui déroule
   sept zones, et dont la première parlait des heures de travail.
   `SEC_DE_MODULE` porte maintenant une zone par module, et
   `versZoneReglages()` y descend.

| On vient de | On arrive sur |
|---|---|
| Chantiers, Rendements | Ma journée de travail |
| Calendrier | Relances et calendrier |
| Finances | Financier |
| Stock et fournitures | Stock et fournitures |
| Cubage, Bois | leur propre onglet |

**Pas de second niveau d'onglets.** Décision ancienne, toujours valable : un
onglet déroule ses zones sous leurs titres, et on lit en descendant plutôt
que de chercher où cliquer. Un scénario le garde (`#regl-sous` doit rester
introuvable). C'est pour ça que la réponse a été de nommer les zones et de
viser juste, pas d'ajouter des sous-onglets.

**Le défilement se teste en espionnant `scrollIntoView`.** Le banc d'essai le
neutralise au démarrage ; un scénario le remplace par un mouchard et lit quel
élément l'a reçu. Sans ça, « le bouton descend au bon endroit » n'était pas
vérifiable.

## Deux détails de typographie qui comptent

- **Espace insécable devant l'unité.** `eur()` et `eurCourt()` collent le
  « € » au nombre par un U+00A0 : avec une espace ordinaire, une tuile étroite
  coupait la ligne et le symbole tombait seul en dessous. Un test l'épingle —
  attention, une regex avec une espace ordinaire ne matche plus.
- **`fmt()` groupe les milliers** par une espace insécable depuis la 4.37 :
  « 1 800 € », plus « 1800 € ». Trois conséquences à connaître :
  - **`fmtBrut()` existe pour les fichiers.** Les deux exports CSV
    (`lignesStock`, `exportCsv`) y passent : une espace au milieu d'un nombre
    et la cellule cesse d'être un nombre pour le tableur.
  - **Les quatre `nb()` retirent les espaces** avant d'analyser. Sans ça, un
    montant formaté relu dans un champ de saisie — `#hy-ben` le fait —
    donnait 25 pour « 25 000 ».
  - **`t.texte()` des tests replie tous les blancs** sur une espace ordinaire :
    une attente lue par cette porte s'écrit avec une espace ordinaire, alors
    qu'une attente lue sur `textContent` brut garde l'insécable. Deux heures
    perdues sur un « attendu 1 000 € / obtenu 1 000 € » qui se lisaient pareil.

## Sa marque, et le nom qu'on a retiré

**L'application ne s'appelle plus que Sylve.** Toute référence à celle dont
elle est partie — le tableur de cubage de l'ONF — a été retirée de l'écran
**et des commentaires** en 4.44 : elle l'a inspiré au début, il s'en est
complètement écarté depuis. Le mode de calcul s'appelle « Historique », et
son explication parle de « vos anciens bordereaux ».

**Les clés `bordcub.*` et le nom de la base IndexedDB ne changeront jamais.**
Les renommer ferait chercher les données dans un tiroir vide : chantiers,
dépenses, stock, tout serait perdu. Ce nom n'apparaît nulle part à l'écran,
et un scénario le vérifie — en écartant le source des `<script>`, car
`body.textContent` l'embarque et ferait croire à une fuite.

**Son logo et le nom de son entreprise** vivent dans `A.cfg.logoEntreprise`
et `A.cfg.nomEntreprise`, donc ils partent dans les sauvegardes. Deux
endroits seulement, choisis par lui sur maquette :

- l'écran **Mon entreprise**, où le nom remplace l'intitulé ;
- l'**écran de démarrage**, en signature discrète sous la phrase de l'outil.
  Variante retenue : *Sylve d'abord, lui ensuite*. L'accueil général garde la
  marque de l'outil — les mélanger brouillerait les deux.

**L'image est réduite à 256 px avant d'être gardée** (`reduireImage`), en
PNG pour préserver la transparence d'un logo. Une photo de téléphone non
réduite pèserait plusieurs mégaoctets dans le stockage local, qui n'est pas
extensible — et elle partirait telle quelle dans chaque sauvegarde.

**La signature du démarrage se lit en synchrone**, comme la durée : ajoutée
après coup elle apparaîtrait en cours d'animation.

## Les notes de mise à jour

`NOTES_MAJ` porte les **cinq dernières** versions, en clair, dans Réglages ▸
Général. Au-delà de cinq on ne remonte plus, et la liste devient un journal
qu'on ne lit pas.

**Elles s'écrivent à la main à chaque livraison.** Une liste engendrée depuis
les commits dirait « corrections diverses », ce qui n'apprend rien. Trois à
quatre lignes par version, dans ses mots à lui, pas dans le vocabulaire du
code.

Une ligne qui porte `vue` devient cliquable et mène à l'écran concerné —
c'est ce qu'il demandait : « me donner accès aux endroits où il y a des
modifications ». **Ne pas oublier d'ajouter la nouvelle version en tête à
chaque envoi**, et de retirer la sixième.

## Le plant se saisit, le millilitre se stocke

La règle vaut désormais aux **trois** endroits où une quantité s'écrit, et
elle n'était appliquée qu'à un seul :

| Où | Ce qu'on saisit | Pourquoi |
|---|---|---|
| Ligne de chantier | des plants | c'est ce que lit le client |
| Sortie ou perte | des **plants** par défaut | on plante 332 arbres, on ne verse pas 1 992 ml |
| Commande | l'unité du produit | on achète des bidons, pas des plants |

**La conversion vit à un seul endroit** : `lignesValides()`, à la sortie du
formulaire. Tout ce qui suit — aperçu, enregistrement, arithmétique du stock
— continue de raisonner dans l'unité du produit. `doseLigne()` donne le
facteur, et **le prix suit la quantité** : 0,30 € par plant devient 0,05 €
par millilitre. Ne jamais convertir ailleurs.

Un sélecteur par ligne permet de repasser dans l'unité du produit, et la
phrase de conversion s'écrit sous le champ — réécrite seule à chaque frappe
par `majConversions()`, car redessiner le bloc entier ferait perdre le
curseur au milieu du nombre.

**Les sorties saisies avant la 4.43 sont incohérentes entre elles** : sur
certaines il a tapé des plants dans un champ qui attendait des millilitres.
Elles ressortiront donc avec un nombre de plants bizarre (332 stockés / 6 =
55,3). Il l'a vu, il corrigera lui-même. **Ne pas tenter de les rattraper
automatiquement** : rien ne distingue de façon sûre un 332 mal saisi d'un
332 juste.

## Le stock : ce qui se totalise et ce qui ne se totalise pas

**On n'additionne pas des millilitres avec des pièces.** La ligne de total de
l'inventaire annonçait « 55 800 achetés » en cumulant du répulsif au
millilitre et des tuteurs à la pièce. Les colonnes de quantité n'ont de total
que si tout le catalogue parle la même unité ; sinon elles disent « unités
différentes ». **La valeur en euros, elle, se cumule toujours** — c'est la
seule échelle commune, et c'est pour ça que « Où dort votre argent » est un
graphique de valeurs et jamais de quantités.

**« En stock » est la première colonne**, avant « acheté » et « sorti » :
c'est la seule qu'on vient vraiment lire, et elle était au bout d'un
défilement horizontal. Un test lit désormais le tableau **par le nom de la
colonne**, jamais par sa position — l'ordre a déjà changé une fois.

**Le débours quitte bien le stock.** `quantite()` retranche toutes les
sorties sans regarder leur nature ; seule `ventes()` écarte débours et pertes,
pour le chiffre d'affaires et la marge. Vérifié par un scénario : 500
achetés, 100 vendus, 50 en débours, 350 restants.

**Le dosage par plant ne concerne que les unités dosables** —
`UNITE_DOSABLE()` : millilitre, litre, mètre linéaire, kilo. « 6 ml par
plant » sur des tuteurs comptés à la pièce n'a aucun sens. Attention :
**`plant` n'est pas une unité d'article**, s'y fier mène à une garde qui ne
se déclenche jamais.

**La dépense d'une commande se corrige après coup.** Elle porte
`commande: <id>`, et `depenseDeCommande()` la retrouve. Décocher la case la
retire, changer la TVA la corrige — les deux préviennent au moment du geste,
pas à l'enregistrement. Piège rencontré : en modification, l'objet `maj` n'a
pas d'identifiant, c'est celui de la commande ouverte qu'il faut.

**Le simulateur peut changer le dosage** sans toucher la fiche du produit :
`A.revient.dose` prime dans `echelle()`, et la mention « simulé » le dit. De
gros Douglas prennent plus de répulsif que six millilitres.

**L'objectif de 30 % de marge n'est pas décoratif.** Avec l'abattement
forfaitaire de 71 % sur les ventes, en dessous de ce taux il cotise sur une
marge qu'il n'a pas faite. D'où le taux d'ensemble en tête de Performance —
un produit vendu trop bas peut être rattrapé par un autre, c'est le total qui
décide — et le graphique « vos prix face au minimum », qui rapporte chaque
prix pratiqué au minimum du produit plutôt qu'à des euros incomparables.

## Rentabilité, et les ventes par année

**« Prix de revient » nommait mal l'écran** : il porte un simulateur, des
coûts, les performances de vente et désormais l'analyse annuelle. Il
s'appelle **Rentabilité**, et sa quatrième pastille est *Par année*.

Elle répond à trois questions que le cumul de toujours ne posait pas : est-ce
que je progresse, quand est-ce que je vends, et qu'est-ce qui rapporte cette
année-là. Le « quand » décide des achats — la fourniture se commande avant la
saison, pas pendant.

`ST.caAnnee`, `margeAnnee`, `caParMois` et `caParArticle` s'appuient tous sur
`ventes()`, qui écarte déjà pertes et débours. Un débours n'est pas une vente.

**L'anneau existait déjà** — le simulateur décompose un prix avec. Ne pas en
écrire un second : c'est le vérificateur qui a attrapé le doublon. Il prend
des parts `{nom, valeur, couleur, texte}` et un `{centre, sous}` ;
`partsProduits()` ajoute la palette et regroupe la queue sous « autres »
au-delà de six parts, faute de quoi il devient illisible.

**Un contrôle qui vérifie qu'un graphique existe ne prouve rien.** Mélanger
les années laissait la courbe intacte et le scénario au vert. Il lit
maintenant les valeurs mois par mois, dans les `<title>` des points. Et
attention aux comparaisons partielles : chercher « 0 € » dans « 1 000 € »
réussit par accident — comparer la phrase entière.

**Un scénario ne doit pas dépendre des notes de mise à jour**, qui tournent à
chaque livraison : viser un écran nommé le casse à la rotation suivante.

## Lire un graphique sans devoir l'expliquer

**« 131 % du minimum » ne veut rien dire pour personne.** Le graphique des
prix rapportait chaque prix pratiqué au minimum du produit, en pourcentage :
comparable d'une ligne à l'autre, mais illisible. Il est remplacé par
`batonsPrix()` — trois bâtons par produit sur une échelle en euros : le coût
réel, le prix qu'il faudrait pour tenir l'objectif, le prix pratiqué. Et
l'écart écrit en euros : « il manque 0,23 € ».

**L'objectif de marge ne vaut que pour la marge brute.** C'est sur elle que
l'abattement forfaitaire se compare. Le trait pointillé a donc disparu de la
vue nette, où il faisait croire à un seuil qui n'existe pas. La nette vaut la
brute moins le taux de charges appliqué au prix de vente — un produit à
faible marge y perd proportionnellement bien plus qu'un autre.

**Un graphique ne se répète pas.** « Où dort votre argent » vivait à la fois
sur l'inventaire et dans les coûts. Il reste sur l'inventaire, là où se fait
l'état des lieux ; les coûts n'en gardent qu'une ligne, la valeur
immobilisée.

## Le millilitre n’est pas le mètre linéaire

Dans `UNITES_ART`, **`ml` désigne le mètre linéaire** — celui du grillage.
Un produit dosé au millilitre prend l’unité `millilitre`. L’import les avait
confondus et rangeait le Trico en mètres.

Un stock en millilitres **se lit en litres** dès qu’il dépasse le litre :
`echelleArt(unite, valeurs)` rend le diviseur et le libellé. L’échelle se
décide sur la plus grande valeur de la ligne, jamais colonne par colonne —
« acheté 34 L, sorti 1 992 » serait pire que rien. 34 L, c’est trois bidons
et demi, donc trois hectares : c’est ainsi que l’utilisateur raisonne.

`pourPlants()`, `coutParPlant()` et `stockEnPlants()` faisaient déjà la
conversion plants ↔ millilitres. Elles attendaient seulement qu’une ligne de
chantier sache à quel article elle se rapporte.

## Facture et stock : le maillon est branché

Une ligne de chantier porte désormais un `article`. Quand elle en désigne un,
`synchroniserStock()` refait la sortie liée au chantier — jamais saisie, elle
découle de la facture et se refait à chaque modification. Elle est marquée
`auto: true` pour ne pas écraser une sortie entrée à la main.

- **La facture compte ce que lit le client, le stock ce qui est consommé.**
  332 plants restent 332 plants sur la ligne ; c'est la sortie qui convertit
  en 1 992 ml, via le `dosage` de l'article.
- **Mais la sortie n'est plus un miroir : c'est un point de départ.** Depuis la
  4.46, la modifier la détache (`auto` passe à `false`) et elle cesse de suivre
  la facture. Il consomme parfois moins de répulsif que prévu, et c'est le
  stock qui doit dire vrai, pas ce qui a été facturé. La facture, elle, ne
  bouge pas. `sortieManuelleDe()` empêche alors d'en recréer une seconde.
- **L'état suit le chantier** par `VENTE_DE_CHANTIER` : rien ne quitte le
  stock avant que le chantier soit fait.
- **Corriger la facture corrige la sortie** ; retirer la ligne la supprime.
- Les lignes reprises du carnet **ne désignent aucun article** : le lien
  n'existait pas au moment de la conversion.
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

## Le devis, quand il y en a un

Tout chantier ne part pas d'un devis : un client qui rappelle pour finir une
parcelle, un dépannage. La fiche porte donc la réponse — `c.aDevis` — et les
statuts suivent, sans qu'aucun code de statut ne bouge :

- `devisSeul` retire l'étape quand il n'y a pas de devis : « Devis à envoyer »
  et « Devis envoyé » sortent de la liste.
- `sansDevis` donne l'autre mot : `accepte` se lit « Devis signé, à planifier »
  ou « À planifier », `sansuite` « Devis refusé » ou « Sans suite ».
- `nomStatut(code, chantier)` prend le chantier en second argument. Appelée
  avec le seul code — le filtre du carnet, qui parle de tous les chantiers à
  la fois — elle rend l'intitulé complet.

**La règle ne vit qu'à un endroit.** `migrerDevis()` inscrit la réponse une
fois pour de bon sur l'existant, plutôt que de la déduire à chaque lecture :
sinon elle aurait vécu dans le module chantiers *et* dans les finances, et
aurait fini par diverger. Le repli de `aDevis()` ne sert plus qu'aux données
restaurées d'une sauvegarde antérieure à la 4.36. Pour la même raison,
`tauxReussite()` reçoit le prédicat en second argument au lieu d'appeler
l'autre module.

Trois champs vont avec : `numeroDevis` (souvent rempli plus tard),
`dateDevis`, `validiteDevis` en mois. `finValiditeDevis()` en déduit la fin
— et replie le jour sur la fin du mois d'arrivée : un devis édité un 31
janvier et valable un mois court jusqu'au 28 février, pas au 3 mars.

**C'est la validité qui appelle, pas le délai.** Un devis envoyé remonte
quatorze jours avant sa fin de validité, puis passe en gravité 2 une fois
expiré. Le délai réglable (`joursRelanceDevis`, 21 j) ne sert plus que faute
de validité saisie. L'avis vit sur l'accueil (`#a-devis`), sous celui des
échéances, et se chasse d'un doigt jusqu'au prochain lancement.

**Le numéro de facture se demande où l'on bascule.** Il existait depuis
longtemps dans l'en-tête, sixième champ — donc jamais rempli. Passer un
chantier en « Facturé » sans numéro ouvre maintenant `demanderNumeroFacture()`,
qui propose aussi la date et laisse toujours la porte de sortie « Plus tard ».

**La recherche du carnet passe outre le filtre.** Un numéro de facture
appartient presque toujours à un chantier payé, donc rangé hors des
« ouverts » : taper le bon numéro et ne rien voir sortir serait le pire des
deux. `chercher()` regarde nom, donneur, propriétaire, forêt, parcelles,
commune, les deux numéros et la note ; plusieurs mots doivent tous se
retrouver, pas forcément dans le même champ.

## Donneur d'ordre et propriétaire — le nommage piège

Le stockage et l'interface ne disent pas la même chose, et l'import s'y est
laissé prendre :

| Champ à l'écran | Liste qui l'alimente | Champ du chantier |
|---|---|---|
| Donneur d'ordre | `clients` | `donneur` |
| Propriétaire facturé | `proprios` | `proprietaire` |

Le maître d'œuvre du carnet est donc un **client** au sens du stockage, et le
client du carnet un **propriétaire**. Les intervertir remplit chaque menu
déroulant avec la mauvaise moitié du carnet, et le bouton « + liste » ajoute
au mauvais endroit. Vérifier ce tableau avant de toucher à l'un des deux.

Le circuit réel, qui explique le nommage : **le donneur d'ordre démarche, fait
le projet et reçoit la facture ; il la transmet au propriétaire, qui règle.**
Le champ s'intitulait « Propriétaire facturé », ce qui laissait croire que la
facture partait chez lui — c'est « Propriétaire » depuis la 4.25.0.

## Le libellé de facture prime sur l'intitulé des travaux

`TRAVAUX` sert au taux de TVA et aux rendements : la liste doit rester courte
et stable. Elle ne dit pas ce qui a été vendu — « Fourniture de tuteurs » là
où la facture porte « tuteur châtaignier 9/11×150 ».

Le champ `note` d'une ligne porte ce texte, sous l'intitulé **« Libellé sur la
facture »**, et c'est lui qui s'affiche en tête de la ligne ; l'intitulé des
travaux passe dessous, avec la quantité. Il s'appelait « Précision » et était
noyé en quatrième position dans la ligne grise : l'utilisateur ne retrouvait
pas sa propre facture.

## Deux contrôles qui ont menti

- **La restauration rejetait les dépenses d'aujourd'hui.** `integrer()`
  exigeait un `ttc` à la racine, le format d'avant les lignes multiples, que
  le formulaire efface justement en enregistrant. Toute dépense saisie était
  écartée en silence : la sauvegarde ne protégeait plus rien.
- **Le vérificateur ne vérifiait plus les identifiants.** Il coupait le
  fichier au premier `<script>` ; depuis que l'écran de démarrage en a posé un
  en haut du `body`, il n'analysait plus que l'en-tête et annonçait « 1
  identifiant, tous uniques ». Il retire désormais les blocs de code et refuse
  de passer en dessous de cent identifiants — un contrôle qui n'inspecte plus
  rien doit crier, pas rassurer.

## Où en est le chantier — 16 août 2026

L'historique est repris : 32 chantiers, 124 dépenses, 6 charges fixes, 6
produits, 3 fournisseurs, 3 commandes, 9 sorties. Il vit sur le téléphone.
Le fichier se refabrique avec `outils/importer-carnet.js` à partir des deux
classeurs, qui restent chez l'utilisateur.

Une longue tournée de retours a été traitée d'un bloc : le bandeau qui
disparaissait, les pastilles illisibles, la fausse « marge », le carnet sans
ordre ni dates, les listes interverties, les libellés de facture perdus, les
dates non modifiables, « 1 709 jours », « 2 280 € tous les mois », les
listes à rallonge, les réglages qui égaraient, les graphiques sans échelle,
« À traiter » qui ne montrait que les ennuis, les heures sur une journée, le
dépassement d'estimation, la TVA des achats, l'avis de mise à jour.

**La façon de travailler qui marche** : l'utilisateur parcourt l'application
en dictant ce qui coince, et ses retours trouvent plus de vrais défauts que
la lecture du code. Trois exemples : la sauvegarde qui ne restaurait plus les
dépenses, le bandeau bloqué, les quantités d'unités mêlées. À chaque fois le
symptôme était juste, l'explication qu'il en donnait rarement — creuser le
symptôme, pas l'explication.

## Ce qui n'a jamais été bouclé

- **La boucle estimation → chantier → agenda.** Touche Devis et estimatif,
  Rendements et Calendrier à la fois. Jamais fermée.
- **Le rangement des réglages.** Les onglets sont sortis du bas, mais le
  contenu reste à ranger : « j'ai du mal à savoir où va quoi ».
- **La revue de la partie Entreprise** : Chantiers, Finances et Analyses ont
  été parcourus. Calendrier, Rendements et Devis attendent.
- **Une barre de téléchargement.** Elle n'aurait de sens que pendant le
  téléchargement de fond du service worker, avant que l'avis n'apparaisse —
  à ce moment-là tout est déjà arrivé. Proposé, pas demandé.
- **Les lignes de chantier reprises du carnet ne désignent aucun article.**
  Ne pas les rattacher : leur sortie de stock existe déjà, importée du
  classeur. Une garde empêche la double déduction, mais la tentation
  reviendra.
