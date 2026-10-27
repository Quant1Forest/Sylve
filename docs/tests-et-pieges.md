# Tests, contrôles et pièges

Le vocabulaire des magasins, les pièges déjà rencontrés en entier, et les contrôles qui ont menti.

## Le vocabulaire : un champ que rien n'écrit ne se lit plus

**Quatre fois le même défaut, et c'est lui qui a exigé qu'on le règle.**
*« Il faut absolument que tu trouves un moyen pour que les tests puissent
corriger ça. Trois fois ce n'est pas rien. »*

La famille : **le code lit un champ que rien n'écrit**, l'écran affiche un
blanc ou un zéro, et rien ne crie. `charge.nom` là où le formulaire enregistre
`libelle` ; `c.lieu` là où le chantier porte `foret`. Le scénario qui aurait
dû l'attraper **semait les mêmes champs faux** : deux erreurs qui se
confirment l'une l'autre. Une erreur seule aurait crié ; deux erreurs
assorties passent au vert.

`outils/vocabulaire.js` liste, magasin par magasin, les champs que les
**formulaires écrivent** — relevés dans les formulaires, jamais dans le code
qui lit. C'est toute la différence : lire les lecteurs aurait recopié
l'erreur.

La boucle est cassée par les deux bouts :

- **Le banc d'essai refuse une graine hors vocabulaire** (`verifierGraines`,
  appelée par `ouvrir()`). Un scénario ne peut plus inventer un champ pour
  coller à du code fautif : il échoue en le nommant.
- **Le vérificateur refuse une lecture hors vocabulaire** (contrôle n° 7).
  Certains accès se nomment eux-mêmes — `charge.taux`, `achat.quoi`,
  `journee.km` — et se vérifient sans ambiguïté. Il refuse aussi de passer
  s'il examine moins de vingt accès : **un contrôle qui n'inspecte plus rien
  doit crier, pas rassurer**, comme celui des identifiants.

**Ce que ce n'est pas.** Ni un schéma, ni une validation : rien ne contrôle
les données de l'utilisateur, et une sauvegarde ancienne peut porter d'autres
champs. C'est un **cliquet** sur ce que le projet écrit lui-même. Ajouter un
champ y demande un geste délibéré — et c'est justement le moment où l'on va
relire le formulaire qui l'enregistre.

**Sa limite, à connaître.** Les prénoms de boucle (`c`, `x`, `e`) restent hors
de portée : ils désignent tantôt un chantier, tantôt une charge. Le contrôle
ne couvre que les accès qui portent leur nom. Élargir demanderait de typer le
fichier ; le cliquet, lui, coûte deux cents lignes.

**Il a trouvé un troisième cas en naissant.** `c.lieu` était lu à trois
endroits, sur un objet qui n'a pas ce champ :

- `lieuxConnus()` ne récupérait **jamais** les forêts des chantiers ;
- `moissonnerListes()` non plus, à la restauration ;
- et `migrerJournees()` donnait un lieu **vide** à toutes les journées reprises.

Trois branches mortes, silencieuses depuis des mois. Elles lisent désormais
`foret` et `commune`. **Une branche morte ne se voit pas, elle se teste** —
et faute de pouvoir tout tester, on peut au moins refuser ce qui n'existe pas.

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
- **Un motif de remplacement qui commence par une parenthèse mange le nom
  de la fonction devant.** Remplacer `(c.nom || 'chantier')` par
  `C.nomChantier(c)` a transformé `esc(c.nom || 'chantier')` en
  `escC.nomChantier(c)` : syntaxe valide, vérificateur au vert, et un
  `ReferenceError` qui tuait le calendrier au premier rendu. Un seul site sur
  six. **Compter les occurrences ne suffit pas quand le motif est ouvert à
  gauche** : inclure ce qui précède (`esc(`, `+ (`) ou relire les sites
  touchés. C'est un scénario qui l'a attrapé, pas le vérificateur.
- **Quand un script de retouche refuse d'écrire, on le corrige et on le
  relance entier. On ne rapièce jamais à la main ce qu'il a refusé.** Deux
  fois la même faute, la seconde pire que la première. En 4.78, le script de
  version a écrit le numéro puis échoué sur l'ancre des notes : l'application
  annonçait la 4.78 avec les notes de la 4.77. Il vérifie désormais toutes
  ses ancres avant d'écrire quoi que ce soit. En 4.81, le script qui passait
  le convertisseur en Mercator a refusé — c'était son rôle — et l'en-tête a
  été corrigé à la main par-dessus : le fichier **annonçait du Mercator et
  produisait du Lambert**. Les contours sont tombés en Belgique ; c'est le
  croisement avec la projection qui l'a dit. Un script qui refuse protège,
  et le rapiéçage défait précisément ce qu'il protégeait.
- **`git stash` rend les fichiers en fins de ligne Windows.** Le dépôt les
  garde en `LF`, mais la copie de travail ressort en `CRLF` : un script de
  retouche dont l'ancre porte un saut de ligne ne trouve plus rien. Il refuse,
  et c'est bien — mais on cherche longtemps pourquoi. Remettre les fichiers en
  `LF` avant de continuer ; mieux, comparer à l'état publié avec
  `git show HEAD:fichier` plutôt que de remiser.
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
- **Un jour est une case du calendrier, pas 86 400 000 millisecondes.** Quatre
  comptes le faisaient en soustrayant deux timestamps : « devis envoyé il y a
  X jours », « facturé il y a X jours », « terminé il y a X jours », et
  `depuisQuand()` de l'indicateur de sauvegarde. Un devis envoyé il y a
  quarante jours à 23 h ressortait donc à « 39 jours » toute la journée du
  lendemain, et une sauvegarde faite hier soir annonçait « aujourd'hui ». Les
  autres calculs du fichier passaient déjà par `minuit()` — ces quatre-là
  étaient restés en arrière. Corrigé en 4.50.
- **Les échéances de charges étaient repliées sur le 28.** `Math.min(jour, 28)`
  était un pansement contre le « 31 février ». Deux dégâts : un prélèvement du
  30 tombait deux jours trop tôt, et sa toute première échéance — antérieure à
  sa propre `charge.debut` — passait sous la garde `ts < charge.debut` et
  n'était donc **jamais** annoncée. Le repli se fait sur la fin du mois
  d'arrivée (`new Date(an, mois + 1, 0).getDate()`), comme
  `finValiditeDevis()` le faisait déjà correctement. Les dépenses automatiques
  se recalent sans doublon : elles sont refaites à chaque ouverture et celles
  qui ne correspondent plus à aucune échéance sont retirées.
- **Deux scénarios ne cassaient que certains jours.** Celui des devis était
  rouge sur la 4.49 *livrée* — il semait un `dateEnvoi` à 12 h, donc il passait
  l'après-midi et échouait le matin. Celui des échéances ne tombait que quand
  la date du jour plaçait une échéance après le 28. Un test qui dépend de
  l'heure ou du quantième ne dit pas la vérité : il la dit une fois sur deux.
  Semer **deux** valeurs de part et d'autre de la frontière — juste après
  minuit et juste avant — est ce qui rend la propriété vérifiable.
- **`toISOString()` n'est pas une date locale.** Un champ `<input type="date">`
  parle en heure locale ; `toISOString()` répond en heure de Greenwich, où
  minuit à Paris est 22 h la veille. Tout timestamp passé par `C.minuit()` en
  ressortait donc décalé d'un jour. Corrigé le 3 août 2026 dans `versChamp`,
  qui s'appuie désormais sur `C.jourCle`. Pour les dates, `jourCle` et
  `minuit` sont les seules bonnes portes — et un test qui écrit
  `toISOString()` passe au vert à Londres tout en mentant en heure française.

## Deux scénarios qui ne prouvaient rien

Le sabotage les a désignés, et la leçon vaut au-delà :

- **Le suivant proposé n’était jamais lu.** Le test tapait un numéro
  par-dessus la proposition, puis vérifiait ce qu’il venait de taper. Casser
  `prochainRang()` ne changeait rien. **Lire la valeur avant d’agir dessus.**
- **Le figeage n’était éprouvé que là où une autre garde suffisait.** Le cas
  testé était un chantier sans devis, arrêté par `aDevis`. Il fallait un
  chantier **avec** devis et déjà facturé — le seul endroit où la condition de
  passage protège toute seule.

**Et une navigation de test qui n’allait nulle part.** Le scénario changeait
de chantier par le carnet ; or le carnet ne liste que les **ouverts**, et un
clic sur un chantier payé ne trouvait rien. Tout le reste se jouait sur le
premier chantier, au point de lui poser un numéro de facture au passage — sans
qu’aucune vérification ne s’en aperçoive. Passer par `#f-choix`, qui les liste
tous, et **vérifier qu’on est bien arrivé** avant de continuer.

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

## Deux pièges retrouvés en écrivant ce module

**`String.replace` mange les `$$`.** Le projet le note depuis longtemps pour
les sélecteurs `t.$$()` des tests ; j’y suis tombé dans `index.html`, où un
`$$(...)` inséré par `s.replace(ancre, bloc + ancre)` est ressorti en `$(...)`.
La liste des priorités ne se cochait plus. **Tout script de retouche passe par
`split().join()`**, jamais par `String.replace`, dès que le texte inséré peut
contenir un `$`.

**Un scénario qui sème ce que le code lit ne vérifie rien.** Les frais fixes
du calendrier lisaient `charge.nom` et `charge.montant` ; le formulaire écrit
`libelle` et `ttc`. Le repère annonçait donc « € 0 » sans nom — et le
scénario passait au vert, parce qu’il semait les mêmes champs faux. **Deux
erreurs qui se confirment l’une l’autre.** C’est *lui* qui l’a trouvé, sur son
téléphone. Un objet semé doit l’être **tel que le formulaire l’enregistre** :
c’est la seule source écrite ailleurs, pour d’autres raisons.

**Un compte écrit en dur ne garde rien.** Le scénario des tuiles vérifiait
« six tuiles » : il a cassé à l’arrivée du septième module sans rien apprendre.
Il croise maintenant les tuiles avec **le sélecteur de module du bandeau**,
qui porte la même liste, écrit pour une autre raison — naviguer. Deux sources
indépendantes qui doivent dire la même chose : c’est la règle du projet, et
elle attrape aussi bien la tuile oubliée que la tuile fantôme.

## Pourquoi le contrôle est long, et ce qui a été essayé

Sept minutes, alors que ce fichier en promet deux. La cause a enfin été
mesurée :

- **500 `t.pause()` cumulent 161 secondes de sommeil** par passage, pour des
  écritures qui rendent la main en quelques millisecondes ;
- **175 ouvertures de JSDOM**, environ une seconde chacune.

**Une attente conditionnelle a été essayée, et retirée.** L’application
comptait ses écritures en vol, le banc sondait ce compteur au lieu de dormir :
sept minutes tombaient à trois. Mais des scénarios devenaient rouges — le
défilement des réglages, différé de 60 ms, et deux autres — et **une suite qui
garde ses calculs d’argent ne se paie pas d’un peu de vitesse**. Le vrai
gisement est ailleurs : ce sont les 175 ouvertures qu’il faudrait regrouper,
pas les attentes qu’il faudrait raccourcir.

**Et un piège de filtre à connaître.** `node outils/tests.js index.html "e"`
ne joue pas un scénario : « e » est dans tous les noms, donc la suite entière
tourne. Éprouver cinq sabotages ainsi, c’est cinq passages complets — dix
minutes d’attente pour rien. **Toujours filtrer sur un bout de nom
distinctif.**
