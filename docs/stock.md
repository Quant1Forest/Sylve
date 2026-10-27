# Stock, rentabilité et achats à venir

Unités, totaux, lien facture-stock, rentabilité, achats à venir.

## Le plant se saisit, le millilitre se stocke

La règle vaut désormais aux **trois** endroits où une quantité s'écrit, et
elle n'était appliquée qu'à un seul :

| Où | Ce qu'on saisit | Pourquoi |
|---|---|---|
| Ligne de chantier | des plants | c'est ce que lit le client |
| Sortie ou perte | des **plants** par défaut | on plante 300 arbres, on ne verse pas 1 800 ml |
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
Elles ressortiront donc avec un nombre de plants bizarre (300 stockés / 6 =
50). Il l'a vu, il corrigera lui-même. **Ne pas tenter de les rattraper
automatiquement** : rien ne distingue de façon sûre un 300 mal saisi d'un
300 juste.

## Le stock : ce qui se totalise et ce qui ne se totalise pas

**On n'additionne pas des millilitres avec des pièces.** La ligne de total de
l'inventaire annonçait des dizaines de milliers « achetés » en cumulant du répulsif au
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
« acheté 30 L, sorti 1 800 » serait pire que rien. 30 L, c’est trois bidons
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
  300 plants restent 300 plants sur la ligne ; c'est la sortie qui convertit
  en 1 800 ml, via le `dosage` de l'article.
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

## Les priorités d’achat sont des horizons

*« Cette année, ça ne veut rien dire si on est à la fin de l’année. »* Les
cinq crans sont désormais glissants : *Dès que possible*, *Dans les 3 mois*,
*Dans les 6 mois*, *Dans l’année*, *Un jour*. **Les codes ne bougent pas** —
`annee` reste, il change seulement de mot — pour ne décrocher aucune ligne
déjà saisie.

## Les achats à venir

*« Ce n’est pas une chose en tête, mais des fois j’oublie et il faut que je
les garde en mémoire. »* Un **module**, pas un onglet enfoui : ce qu’on oublie
doit se voir en arrivant. C’était la question laissée ouverte le 31 août, il
l’a tranchée lui-même.

`A.achats` — `quoi`, `categorie`, `ttc`, `taux`, `priorite`, `note`, `fait`.
Clé `bordcub.achats`, format de sauvegarde **version 9**.

- **Il saisit le TTC**, c’est ce qu’il lit sur une étiquette ; le hors taxes
  et la TVA récupérable se déduisent sous le champ, à chaque frappe.
- **Les catégories sont celles des dépenses.** Pas de seconde liste : elles
  finiront par se rejoindre le jour où un achat coché deviendra une dépense.
- **Trois priorités**, nommées et non numérotées : *Dès que possible*,
  *Cette année*, *Un jour*. La liste s’ouvre sur ce qui presse.
- **Cocher ne supprime rien** : *« dès que je le coche, ça va à la suite »*.
  La ligne glisse en bas, barrée, sous son propre intertitre, et se décoche
  d’un second appui — un achat repoussé n’est pas un achat perdu.

**Ce n’est pas un budget, et l’écran le dit.** *« Juste pour savoir le coût,
ce que je vais devoir dépenser prochainement. »* Les montants sont estimés ;
ils ne deviennent pas des dépenses. **Le lien vers les dépenses n’a pas été
fait** — il ne l’a pas demandé, et créer une dépense fantôme depuis une
estimation coûterait plus cher que de la ressaisir.

**Deux vues, jamais une.** Un module réduit à un onglet solitaire est interdit
par un scénario. *Ma liste* porte la liste et le total ; *Ce que ça pèse*
répartit par priorité et par catégorie, et isole la TVA récupérable.
