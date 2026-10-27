# Rendements

Le chantier des rendements (garé), les lignes de rendement, les cadences comptées.

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

## Les rendements : une seule forme de ligne, et un tri

*« Il y en a qui sont calés à gauche, d'autres un peu plus décalées. Et ces
pastilles, elles servent à quoi ? Elles ont la même couleur. »*

- **Les pastilles sont parties.** Elles ne distinguaient rien : chaque ligne
  est déjà une prestation différente. Une couleur qui ne code rien est du
  bruit — la même règle que pour `appliquerCouleur()` en 4.44.
- **L'alignement était de mon fait.** La ligne « compté seul », ajoutée avec
  les cadences, n'avait qu'un bouton là où les autres en ont deux. Toutes les
  lignes se construisent maintenant par le même chemin, et le bouton
  « Estimer » d'une prestation sans chantier est **fermé, pas absent** : il
  garde sa place, sinon rien ne s'aligne. **Une liste dont les lignes n'ont pas
  la même forme fait danser les titres** — c'est la leçon déjà apprise sur le
  carnet en 4.30.
- **`TRIS_REND`** : alphabétique (défaut), du plus récent, du plus ancien, du
  plus de chantiers. Le tri travaille sur une liste d'objets construite avant
  le rendu, pas sur du HTML déjà assemblé.

**Piège de graine rencontré, et il vaut d'être noté.** Le scénario semait des
`temps` avec `journeesMigrees: true` : la migration ne tournait pas,
`indexerJournees()` vidait `c.temps`, et plus aucun rendement ne se calculait.
**Semer du temps sans journées demande de laisser la migration faire son
travail** — c'est-à-dire de ne pas poser ce drapeau.

## La cadence qu'il compte lui-même

*« J'ai compté qu'à peu près, dans ce contexte-là, je mettais une tige à
élaguer toutes les dix minutes. Ça me l'enregistre et je le retiens. Après,
une fois le chantier fini, j'aurai mon nombre de jours par rapport au nombre
de tiges. Ça permettra d'avoir les deux côte à côte. »*

Deux chiffres pour la même prestation, et ils ne disent pas la même chose : le
**mesuré** vient des journées saisies et paie les aléas — la route, le
matériel, la pluie ; le **compté** vient de la montre. **L'écart est
l'information**, et il s'écrit en toutes lettres : *« 38 % plus lent sur le
terrain »*.

`A.cfg.cadences` — `{travail, unite, valeur, sens, chantier, note}`. Dans la
configuration, comme les notes personnelles : elle part dans les sauvegardes,
et c'est une petite liste qu'il enrichit lui-même.

- **Deux sens, parce qu'une cadence ne se dit pas d'une seule façon.** « Une
  tige toutes les dix minutes » se chronomètre ; « huit cents plants par jour »
  se constate le soir. `cadenceParJour()` convertit, une fois, et tout ce qui
  suit raisonne en unités par jour. La conversion s'écrit sous le champ à
  chaque frappe : lui demander de la faire de tête serait exactement le calcul
  qu'on lui épargne.
- **Elle porte son unité.** Il facture l'élagage à l'hectare et le chronomètre
  à la tige : dix minutes par hectare et dix minutes par tige ne se comparent
  pas. Le rapprochement ne se fait qu'à unité égale, et **l'unité qui fait foi
  est celle des chantiers**, pas celle du catalogue.
- **Le chantier où il l'a constatée est retenu** — c'est lui qui l'a demandé,
  et sans ça une cadence n'est qu'un chiffre sans contexte. La note libre
  complète : « ronce épaisse », « pente ».
- **Une prestation chronométrée mais jamais facturée garde sa ligne**, avec le
  compté seul et « rien de mesuré encore ». C'est là que la cadence est tout ce
  qu'on a — et c'est ce qu'il demandait en disant *« juste ajouter un rendement
  pour quelque chose en particulier »*.
- **La moyenne n'est pas pondérée** : ce sont des observations, pas des
  mesures ; les pondérer donnerait à l'une d'elles une autorité qu'elle n'a pas.

**Piège de vocabulaire à connaître** : `UNITES` ne contient pas de « tige ».
Une tige se compte en `unite`, affichée « u ». Un scénario qui sème
`unite: 'tige'` produit un rendement incalculable, sans rien dire.
