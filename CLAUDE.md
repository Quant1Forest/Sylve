# Sylve

Application de gestion pour un entrepreneur de travaux forestiers. Un seul
fichier HTML, aucune dépendance, aucune compilation, tout fonctionne hors
ligne.

Version courante : **4.34.0-20260816-2008**

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
(24 vérifications), puis la suite au vert — 309 à ce jour — puis
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

Scripts séparés si besoin : `npm run verifier`, `npm test`,
`npm run construire`.

---

## Livrer

**La 5.0 sera la version jugée aboutie** — partie Entreprise finie, telle
que l'utilisateur la veut sur le terrain. D'ici là on reste en 4.x : le
chiffre du milieu monte à chaque lot qui change quelque chose de visible.

Le dépôt est publié par GitHub Pages : ce qui est poussé sur `main` devient
l'application, et le téléphone propose la mise à jour à la prochaine ouverture
avec du réseau.

Donc : **on ne pousse jamais sans un « envoie » explicite.** Modifier les
fichiers, faire vérifier le résultat, attendre le feu vert, pousser ensuite.
Un `git push` est une publication, pas une sauvegarde.

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
- **Ne jamais réécrire un fichier avec `Set-Content` sous PowerShell 5.1.**
  `Get-Content -Raw` lit en ANSI, `Set-Content -Encoding utf8` réécrit en
  UTF-8 : chaque accent traverse deux fois l'encodage et ressort en `Ã©`,
  `â€™`, `Ãª`. Une seule commande a corrompu 1440 accents d'`index.html` et
  ajouté un BOM. Pour un remplacement dans un fichier, passer par `sed` via
  Bash, ou par l'outil d'édition. Un fichier ainsi abîmé se répare en le
  relisant en UTF-8 puis en le réencodant en Windows-1252.
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

## Ce qui n'a jamais été bouclé

- **La boucle estimation → chantier → agenda.** Touche Devis et estimatif,
  Rendements et Calendrier à la fois. Jamais fermée.
- **Le rangement des réglages** : « j'ai du mal à savoir où va quoi ».
- **La revue de la partie Entreprise** : seul le module Chantiers a été
  parcouru. Calendrier, Rendements, Devis, Analyses, Stock et Finances
  attendent.
- **Les données historiques.** Les anciens classeurs doivent être convertis et
  importés. L'import se fait dans Réglages ▸ Entreprise ▸ Import de données.
