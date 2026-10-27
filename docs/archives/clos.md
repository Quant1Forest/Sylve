# Archives : sujets clos

Sections terminées, gardées pour mémoire. Rien ici ne décrit un travail en cours.

## Le débours : c'était un manque, il est comblé

**Cette section décrivait deux manques du 23 août ; les deux sont faits.**
Relue le 8 septembre, elle mentait — et une note périmée coûte plus cher
qu'une note absente, parce qu'on la croit.

- **Le débours est assignable** : la nature d'une ligne se choisit dans le
  formulaire (`<option value="debours">`), et la fiche l'annonce
  — « · **débours**, hors chiffre d'affaires ». Le calcul, lui, était juste
  depuis le début : `horsCA` le tient à l'écart du chiffre d'affaires.
- **Le champ « Produit du stock » se ferme** quand une sortie manuelle existe
  déjà pour le chantier (`stockAPart`), avec son explication — au lieu de
  laisser saisir puis d'avertir après coup.

**Leçon de méthode** : avant de porter un manque à l'écran comme s'il durait,
vérifier dans le code qu'il dure encore. Trois fois déjà, ce fichier a décrit
comme ouvert ce qui était clos.

## Les contours de communes : faits en 4.80, retirés en 4.82

Pendant deux versions, un fond **hors ligne** — 2 906 contours de communes de
six départements, tirés de shapefiles IGN, 344 Ko dans `communes.js`
— s'est dessiné sous les chantiers, puis par-dessus la photo. Il l'a retiré :
*« on va enlever la partie qui délimite les communes, ça sert à rien »*, et
avec lui le choix « Contours seuls ». Un téléphone resté réglé dessus
retombe sur la photo (`fondTuiles()`).

`communes.js` et `outils/convertir-communes.js` ont quitté le dépôt **et son
historique** : ils situaient sa région. Seule la sauvegarde d'avant le
nettoyage, gardée chez lui hors du dépôt, les porte encore. Trois choses à
savoir si l'on y revient :

- **Les fichiers de l'IGN ne doivent jamais entrer dans le dépôt** — 248 Mo
  pour le parcellaire d'un seul département, et le SCAN 25 se compte en gigaoctets.
  Même règle que le classeur comptable.
- **Le séparateur des contours doit rester hors de l'alphabet du varint** (« ? »
  à « ~ ») : la barre verticale en faisait partie et coupait les contours au
  milieu. C'est un croisement avec la projection qui l'avait trouvé.
- **Une commune qui entoure l'écran n'a aucun sommet dedans** : on compare des
  rectangles, pas des sommets, sinon la limite près de laquelle on se tient
  disparaît à fort zoom.

## Le Calendrier, resté sans revue

Premier passage dessus, le 1er septembre. Rien de cassé, mais deux questions
de sa part, **réglées depuis** :

- **« Pourquoi il y a un carnet dans le calendrier ? »** Question posée trois
  fois, **tranchée le 8 septembre : il le garde.** C’est un raccourci vers la
  vue des Chantiers (`moduleDeVue()` la rend à son premier propriétaire), pas
  un doublon de données. Ne plus rouvrir le sujet.
- **La Carte** porte la photo aérienne ou la carte IGN depuis la 4.81, et un
  chantier s’y pose d’un doigt. Voir *La carte : photo aérienne ou carte IGN*.
