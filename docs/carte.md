# Carte

Fonds IGN, tuiles hors ligne, projection, gestes.

## La carte : photo aérienne ou carte IGN

*« Est-ce qu'on ne pourrait pas juste avoir un fond de carte et pouvoir
sélectionner des points, dire : ce chantier, c'était à tel endroit ? »*

Deux fonds, tous deux de la **Géoplateforme de l'IGN**, en accès libre —
celle qu'il avait notée dans son propre fichier de cartographie :

`FONDS_TUILES` : *Photo aérienne* (`ORTHOIMAGERY.ORTHOPHOTOS`, par défaut) et
*Carte IGN* (`GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`), en WMTS, grille `PM`. Le
choix vit dans `A.cfg.fondCarte`. Il les a vues marcher sur son téléphone le
15 septembre. Le service worker ne garde pas les tuiles : il ignore ce qui
vient d'une autre origine.

**Un chantier se pose d'un doigt** : on le choisit, on touche la carte, le
point est converti en latitude/longitude et enregistré dans `c.gps` — le même
champ que le relevé GPS et que les coordonnées collées.

**« Ma position » y va et se serre** à trois mètres au sol par pixel.

**Ce qu'on a regardé reste hors réseau** (4.83) : *« quand je regarde une zone
sur la carte, qu'elle s'enregistre sur le téléphone, comme ça même hors réseau
je peux y avoir accès »*. Le service worker range les tuiles dans
`sylve-tuiles`, **un cache sans numéro de version** — le ménage de l'activation
ne vise que les `bordcub-*`, une mise à jour n'efface donc pas ce qu'il a
regardé. Plafond `TUILES_MAX` = 3 000, soit une cinquantaine de Mo ; au-delà,
les plus anciennes partent.

- **Les tuiles se demandent en CORS** (`crossorigin="anonymous"`). Une réponse
  opaque pèse plusieurs Mo dans le quota du navigateur quelle que soit sa
  taille, et porte `ok` à faux : sans CORS, rien ne serait jamais gardé. L'IGN
  répond avec `Access-Control-Allow-Origin: *`, vérifié le 15 septembre.
- **Une garde en double a été retirée** avant d'être éprouvée : le service
  worker vérifiait `rep.ok` *et* `rep.type === 'cors'`, or une réponse opaque
  n'est jamais `ok`. Cinquième fois que le motif revient.
- **Rien ne se télécharge d'avance** : c'est ce qu'il a regardé qui reste. Pour
  une zone sans réseau, la parcourir chez soi avant.

**La fiche ouvre la carte** (4.84) : *« associer la carte au chantier,
accéder à la carte depuis ma fiche, ou avoir un emplacement pour le
positionner »*. Le bloc « Le chantier » dit s'il est placé et propose **Voir
sur la carte** ou **Placer / Déplacer** (`montrerSurCarte`). Un chantier non
placé ouvre la carte **sur sa commune**, cherchée par le même géocodage
(`centrerSurCommune`) — sans réseau, la carte s'ouvre où elle était.

**On cherche une commune** (`chercherCommune`) : le géocodage de l'IGN
(`data.geopf.fr/geocodage/search`, `type=municipality`), le même fournisseur
que les tuiles. Une seule réponse, on y va ; plusieurs, on choisit, avec le
département. Sans réseau, l'écran le dit. **Le service rend la longitude
d'abord** — c'est l'ordre du GeoJSON, et c'est le sabotage qu'on éprouve.

## Le réseau : une chance, jamais une condition

*« Il n'y a pas de fond photo aérienne, il n'y a pas de fond de carte IGN. En
fait là je ne peux pas me repérer avec cette carte. »*

Ce fichier a dit longtemps « des images, elles demandent du réseau, la réponse
reste non ». **Il avait tort** : la règle avait été durcie sans être relue. La
carte des piles de bois charge des tuiles OpenStreetMap depuis des mois. La
règle n'a jamais été *pas de réseau*, mais **ça doit marcher sans réseau** —
et ce n'est pas la même chose. Sans réseau, la carte montre encore les
chantiers placés les uns par rapport aux autres, et l'écran le dit.

## Web Mercator, et les gardes qui ne servaient à rien

Les tuiles du web sont en **Web Mercator** (EPSG:3857), ses positions en
latitude et longitude. `LB.vers()` et `LB.depuis()` font le trajet ; le nom
`LB` est resté de Lambert 93, la première projection. **Mercator est
conforme** : l'échelle est la même dans les deux sens et tient en un seul
nombre — mais c'est un mètre **de carte**. **`LB.facteurSol(y)`** dit combien
de mètres au sol il vaut à cette hauteur, cos φ : environ 0,69 au milieu de la France.

**Le trait d'échelle l'oubliait.** Son libellé comptait au sol, sa longueur en
mètres de carte : un trait annoncé « 500 m » en couvrait trois cent
quarante-cinq. Corrigé en 4.82 ; le scénario recalcule le sol par pixel depuis
la latitude, à part de `facteurSol`.

**Une propriété qui définit vaut mieux qu'une vérification large.** Le
sabotage du parallèle de référence de Lambert — 44° changé en 45° — n'avait
rien fait crier : 40 à 200 mètres d'erreur, invisibles de loin. Il avait fallu
éprouver la propriété qui **définit** la projection. Mercator a la sienne :
**l'échelle horizontale vaut 1/cos φ**, éprouvée contre la longueur vraie d'un
arc de parallèle écrite à part.

**Deux gardes n'ont rien dit au premier sabotage**, et c'est le scénario qu'il
a fallu durcir : le niveau de tuile (on vérifiait qu'un niveau figurait dans
l'adresse, pas lequel) et, en 4.82, la reprise du doigt après un pincement
(aucun scénario ne levait un seul des deux doigts).

## Les gestes : le doigt fantôme

*« Avec les deux doigts ça marche bien, mais au bout d'un moment ça marche
plus. Je crois que je suis arrivé sur un angle, et je ne peux plus bouger avec
mon doigt. Je peux zoomer, dézoomer. »*

**La carte se redessine sous le doigt.** Quand il se lève, c'est parfois sur
un dessin déjà remplacé : l'événement part d'un élément détaché du document et
**ne remonte plus jusqu'au cadre**. Le doigt restait compté. Avec un doigt, la
carte croyait à un pincement — plus de déplacement ; avec deux, elle en
comptait trois — plus de zoom. Les deux symptômes qu'il décrivait, une seule
cause.

- **Le premier doigt d'un geste repart de zéro** (`e.isPrimary`) : c'est la
  garde que le scénario éprouve, en levant un doigt sur un dessin détaché.
- **Le cadre retient le doigt** (`setPointerCapture`) : il n'est jamais
  remplacé, son lever arrive donc ici. JSDOM ne sait pas le simuler.
- **Le doigt qui reste après un pincement déplace la carte** sans avoir à se
  lever (`reprendre()`).
- **Un glissement qui s'achève sur la carte n'est pas un appui** : il n'ouvre
  pas la fiche d'un point et ne pose pas le chantier qu'on est en train de
  placer.
- **Un redessin par image**, pas par événement (`redessinerCarte()`).

**Leçon générale : tout ce qui se redessine sous le doigt perd ses
événements.** Écouter sur un conteneur stable, et ne jamais compter sur un
lever pour nettoyer un état.

**Et deux pièges déjà rencontrés sur cette carte.** Un `var z` déclaré dans un
`if` vit dans toute la fonction en ES5 : il avait écrasé le conteneur de la
carte, qui ne s'affichait plus. Et côté tests, `cadre()` rend l'objet vivant :
pour comparer avant et après un geste, garder les nombres.

## Deux choses qu’on ne fait pas, et pourquoi

**Récupérer un point désigné dans Google Maps.** *« Je clique sur l’endroit
exact et ça enregistre les coordonnées. »* Une application web ne peut pas
lire ce qu’on a désigné dans une autre : il n’y a pas de retour. Deux chemins
existent à la place, et ils couvrent le besoin :

- **sur place**, `releverPosition()` — le GPS du téléphone, sans réseau ;
- **collées**, depuis n’importe quelle carte : `lireCoordonnees()` accepte les
  deux séparateurs et les deux écritures décimales, et **refuse un point qui
  n’existe pas sur Terre**. Une fiche qui envoie les secours à une latitude de
  999 est pire qu’une fiche sans coordonnées.

**Une photo aérienne avec le chantier détouré, sur la fiche imprimée.**
*« Est-ce que ce serait possible de l’automatiser ? »* La réponse donnée alors
— des tuiles, donc du réseau, donc non — **était fausse**, pour la raison dite
dans *Le réseau : une chance, jamais une condition*. La photo est à l’écran
depuis la 4.81. La porter sur la fiche, détourée, n’est pas fait et n’a pas
été redemandé : détourer demanderait le contour de la parcelle, et Sylve n’a
qu’un point. Le cadre du croquis reste donc à remplir au stylo — sauf
quand la case **« un plan est joint »** est cochée : il cède alors la place à
une mention, parce qu’un A4 ne se serre pas dans 52 mm. C’est ce qu’il fait
déjà, il imprime le plan qu’on lui donne et l’agrafe.

**Reste ouvert** : joindre une photo au chantier — capture d’écran d’une carte
faite à la maison, ou photo du plan papier. `reduireImage()` sait déjà le
faire pour le logo. Le 15 septembre : *« c’est surtout pour la fiche de
chantier, ajouter une photo, un plan — on le met de côté, on garde en
mémoire »*.
