# Sylve

Application de gestion pour un entrepreneur de travaux forestiers. Un seul
fichier HTML servi, recollé depuis `sources/` sans rien transformer ; aucune
dépendance, tout fonctionne hors ligne.

Version courante : **4.85.1-20261030-1850**

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
  cher : voir *Le chantier des rendements*, dans `docs/rendements.md`.
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

## Règles de travail

- **Ne lire un fichier de `docs/` que si la tâche touche son thème** (voir
  *Où trouver quoi*, plus bas). **Travailler dans le fichier de `sources/`
  de la partie concernée** (tableau dans *Structure*) ; pour chercher à
  travers les parties, grep sur `sources/`. Jamais dans `index.html` : il est
  fabriqué.
- **Les priorités sont décidées hors de cette conversation.** Exécuter le lot
  demandé, ne pas en ouvrir d'autres. Ce qui est repéré en chemin se note dans
  les remontées du rapport.
- **En fin de lot**, déplacer dans `docs/` ou `docs/archives/` ce qui est
  terminé. CLAUDE.md ne garde que ce qui sert pour la suite.
- **Rapport de fin de lot** : l'écrire dans `rapports/AAAA-MM-JJ-<nom-du-lot>.md`
  **et** l'afficher. Quatre rubriques, en français courant, court, sans jargon :
  1. **Ce qui a changé** ;
  2. **Où le voir dans l'application** — chemin écran par écran ;
  3. **À tester sur le téléphone** — gestes précis et résultat attendu ;
  4. **Remontées** — problèmes vus, questions, idées hors lot.

  `rapports/` n'est pas versionné : il reste sur ce poste.

---

## Vérifier avant de livrer

```bash
npm install        # une seule fois : jsdom
npm run controle   # fabrication + vérificateur + service worker + tests + conformité
```

Doit afficher **« index.html fabriqué »**, puis **« Bon pour livraison »**,
puis **« le service worker tient »** (33 vérifications), puis la suite au
vert — 1874 à ce jour — puis **« Sylve.html est conforme »**.

Compter **trois minutes** : 187 à 221 s mesurées au lot 4b (selon la charge
du poste ; 17 minutes avant, en séquentiel). Les scénarios se jouent en
parallèle, un processus par cœur moins un ; le contrôle affiche à la fin le
temps de chaque étape. Ne jamais revenir à une attente devinée dans les tests :
`ouvrir()` sonde `data-pret` — pourquoi, et ce qui reste long, dans
`docs/tests-et-pieges.md`.

**Pour déboguer un scénario, le passage séquentiel d'avant** (un processus,
dans l'ordre, sortie en direct) :

```bash
npm run controle -- --sequentiel
node outils/tests.js index.html "nom du scénario" --sequentiel
```

Autres options : `--processus=N` (par défaut cœurs − 1, ou `SYLVE_PROCESSUS`),
`--durees` (où le temps passe). Un filtre qui ne retient qu'un scénario se joue
de lui-même en séquentiel. Le contrôle refuse de passer au vert si un
processus meurt ou si un scénario se perd en route.

**Une correction sans vérification qui la couvre n'est pas finie.** Chaque
changement de comportement s'accompagne d'un scénario dans `outils/tests.js`.
C'est la règle la plus importante du projet : elle a déjà rattrapé plusieurs
régressions silencieuses.

**Et un contrôle qu'on n'a jamais vu échouer ne prouve rien.** Avant
d'adopter une vérification, la casser exprès et s'assurer qu'elle crie. Trois
fois déjà, un contrôle passait au vert sans rien examiner (récits dans
`docs/tests-et-pieges.md`). Une vérification doit se croiser avec une source
écrite ailleurs, pour d'autres raisons.

**Un seul passage, à la fin** : écrire le code et ses scénarios, puis
contrôler l'ensemble une fois, avant de rendre la liste de ce qui a changé.

**Pour casser un contrôle exprès, filtrer.** `outils/tests.js` prend un
troisième argument : seuls les scénarios dont le nom le contient sont joués.

```bash
node outils/tests.js index.html "double compte"
```

Scripts séparés si besoin : `npm run verifier`, `npm test`,
`npm run construire`.

---

## Livrer

**Une version = une mise à jour qu'il valide**, pas un lot de travail.
Plusieurs séances de corrections peuvent s'accumuler sous le même numéro :
il ne monte qu'au moment d'envoyer. Sinon chaque numéro perd son sens : il
doit correspondre à ce qu'il a réellement vu changer sur son téléphone.

**La 5.0 sera la version jugée aboutie** — partie Entreprise finie, telle
que l'utilisateur la veut sur le terrain. D'ici là on reste en 4.x : le
chiffre du milieu monte à chaque lot qui change quelque chose de visible.

Le dépôt est publié par GitHub Pages : ce qui est poussé sur `main` devient
l'application, et le téléphone propose la mise à jour à la prochaine ouverture
avec du réseau. Un `git push` est donc une publication, pas une sauvegarde.

**Un correctif part seul. Une modification se demande** (règle du 18 août
2026 : ce qu'il valide, il ne le juge qu'une fois l'application en main).

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

Livrer suppose aussi d'avoir monté la `VERSION` dans `sources/installation.js`
**et** dans `sw.js` — sans quoi les téléphones déjà installés continuent de servir
l'ancien code. Le vérificateur refuse de passer si les deux divergent.

---

## Structure

| Fichier | Rôle |
|---|---|
| `sources/` | **L'application en morceaux** : on travaille ici. `assemblage.txt` dit l'ordre de recollage et porte les balises. |
| `index.html` | **Fabriqué** depuis `sources/` par `outils/construire.js` (~20 700 lignes). Ne jamais l'éditer. |
| `Sylve.html` | Version autonome, fabriquée depuis `index.html`. Ne jamais l'éditer à la main. |
| `sw.js` | Service worker. Sa constante `VERSION` doit être identique à celle de `sources/installation.js`. |
| `manifest.webmanifest` | Nom, couleurs, icônes de la PWA. |
| `icone-*.png` | Icônes d'installation, dont une *maskable* pour Android. |
| `outils/` | Fabrication, `controle.js` (enchaîne les étapes et les chronomètre), vérificateur, tests (en parallèle), tests du service worker, conformité du fichier autonome, reprise du carnet, vocabulaire des magasins. |
| `docs/` | L'historique des décisions, rangé par thème. Voir *Où trouver quoi*. |
| `rapports/` | Rapports de fin de lot. **Non versionné**, reste sur ce poste. |

Le dépôt étant public, il ne contient que ce qui est servi, plus de quoi
travailler : les originaux du logo sont gardés à part.

**Les parties dans `sources/`** — `interface/` sauf mention ; `logique/` porte
les calculs sans écran de la même partie.

| Partie | Fichiers |
|---|---|
| Cadre : bandeau, navigation, Accueil, démarrage | `communs.js` (`majBandeau`), `navigation.js` (`init`, modules, Accueil, retour arrière, Lieux), `ecouteurs.js` (`aller`, `brancher`), `../ecrans.html`, `../styles.css`, `../demarrage.*` |
| Écran Entreprise, notes, alertes, achats à venir | `achats-entreprise.js` ; `logique/alertes-import.js` |
| Chantiers | `chantiers.js`, `chantiers-carnet-fiche.js`, `chantiers-formulaires.js` ; `logique/chantiers.js` |
| Calendrier, fiche de chantier imprimée | `calendrier.js` ; `logique/calendrier.js` |
| Ma journée · Listes déroulantes | `journee.js` · `listes.js` |
| Finances · Charges fixes · Analyses | `finances.js` · `charges-fixes.js` · `analyses.js` ; `logique/finances.js` |
| Stock · prix de revient | `stock.js`, `stock-saisie.js` · `prix-de-revient.js` ; `logique/stock.js` |
| Véhicule · Rendements et estimation | `vehicule.js` · `rendements.js` |
| Carte | `carte.js`, `fond-de-carte.js` ; `logique/localisation.js` |
| Cubage · Bois de chauffage | `cubage.js` · `bois.js` ; `logique/cubage.js`, `xlsx.js`, `export-cubage.js`, `bois.js` |
| Réglages, sauvegarde, corbeille | `reglages-sauvegarde.js` ; `logique/sauvegarde.js`, `logique/stockage.js` |
| Hors ligne, installation, `VERSION` | `../installation.js` |

Débordements à connaître : `prix-de-revient.js` finit par les réglages
Chantiers, Veille et Démarrage, puis l'appel d'`init` ; `carte.js` par les
fenêtres « numéro de facture » et « motif de refus ».

---

## Conventions

- **ES5 uniquement** dans `sources/` : `var`, `function`, pas de flèche,
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

Une ligne chacun ; le récit complet est dans `docs/tests-et-pieges.md`, sauf
mention d'un autre fichier.

- **`index.html` se fabrique depuis `sources/`**, et `Sylve.html` depuis `index.html` — `npm run controle` s'en charge ; une retouche directe d'`index.html` l'arrête.
- **`VERSION` existe deux fois**, `sources/installation.js` et `sw.js` ; le vérificateur refuse s'ils divergent.
- **L'icône d'accueil ne se met pas à jour** : retirer, réinstaller — et exporter une sauvegarde avant.
- **Le logo n'existe qu'une fois**, dans la variable CSS `--logo`.
- **Vérifier qu'une variable existe dans `:root`** avant de s'en servir (`--doux`, `--vert-marque`).
- **Deux tests lisent le texte du CSS** (`--logo:url(`, taille de `#b-accueil`) : un reformatage les casse.
- **`dateChantier()` ≠ `dernierEvenement()`** : deux notions voisines, deux noms.
- **Toute vue de contenu doit lever `accueil-ouvert`**, sinon la fiche s'affiche sans retour.
- **Ne pas additionner des quantités d'unités différentes.**
- **Scripts de retouche dans un fichier, jamais `node -e`** ; et `split().join()` plutôt que `String.replace` dès qu'il peut y avoir un `$`.
- **Un motif ouvert à gauche mange le nom devant** (`esc(` → `escC.nomChantier`) : inclure ce qui précède.
- **Un script de retouche qui refuse se corrige et se relance entier**, jamais rapiécé à la main.
- **`git stash` rend du `CRLF`** : comparer avec `git show HEAD:fichier` plutôt que remiser.
- **Jamais `Set-Content` sous PowerShell 5.1** : il corrompt les accents. Passer par `sed` ou l'outil d'édition.
- **Une variable non déclarée tue toute la branche** `if/else if`, sans bruit.
- **Un jour est une case du calendrier**, pas 86 400 000 ms : passer par `minuit()`.
- **Échéances de charges : repli sur la fin du mois**, pas sur le 28.
- **Un test qui dépend de l'heure ou du quantième** ment une fois sur deux : semer de part et d'autre de la frontière.
- **`toISOString()` n'est pas une date locale** : `jourCle` et `minuit` sont les seules portes.
- **Clients inversés** : à l'écran « Client » = `proprios` / `proprietaire` ; le magasin `clients` porte les donneurs d'ordre — `docs/chantiers.md`.
- **On n'écrit jamais dans une liste dérivée** (`c.temps` se refait depuis `A.journees`) — `docs/calendrier-journees.md`.
- **Un champ que rien n'écrit ne se lit plus** : `outils/vocabulaire.js` est un cliquet — `docs/tests-et-pieges.md`.
- **Deux gardes qui se couvrent ne s'éprouvent pas** : placer le cas où une seule tient.

---

## Où trouver quoi

| Fichier | Thème |
|---|---|
| `docs/correspondance-refonte.md` | **La référence de la refonte** : ancien endroit → nouvel endroit. Les maquettes validées sont dans `maquettes/`, hors dépôt |
| `docs/tests-et-pieges.md` | Vocabulaire des magasins, pièges en entier, contrôles qui ont menti, durée du contrôle, fabrication depuis `sources/` |
| `docs/chantiers.md` | Fiche, devis, facture, numéros, statuts, carnet et ses tris, clients, nommage, SIREN, temps passé |
| `docs/fiche-de-chantier.md` | Le document obligatoire imprimé : risques, réseau, croquis |
| `docs/calendrier-journees.md` | Ma journée, statuts des jours, rappels, validation, planification, « jours passés » |
| `docs/rendements.md` | Le chantier des rendements (garé), lignes de rendement, cadences |
| `docs/finances-tva.md` | Nomenclatures du carnet, charges fixes, dépenses et TVA, déclarations, reprise du carnet |
| `docs/stock.md` | Unités, totaux, facture → stock, rentabilité, achats à venir |
| `docs/vehicule.md` | Carnet du véhicule, coût au kilomètre, frais véhicule |
| `docs/carte.md` | Fonds IGN, tuiles hors ligne, Mercator, gestes |
| `docs/cubage-bois.md` | Types de bordereau, ABCD, réfactions |
| `docs/design-navigation.md` | Palette, écran Entreprise, modules, réglages, typographie, marque, notes de mise à jour, retour arrière, écran allumé |
| `docs/inventaire-ecrans.md` | Inventaire des écrans, chemin par chemin |
| `docs/depot-public.md` | Rien de personnel dans le dépôt, historique réécrit |
| `docs/archives/` | Sujets clos et anciens points de situation |

---

## En attente

**Garé — ne pas y toucher sans son feu vert, dans un sens ou dans l'autre :**

- **Le chantier des rendements** (contexte à cinq critères) — `docs/rendements.md`.
- **Les lignes de chantier reprises du carnet ne désignent aucun article.** Ne
  pas les rattacher : leur sortie de stock existe déjà.

**Demandé, pas commencé :**

- **La fiche annuelle récapitulative en PDF** — le prochain chantier annoncé.
  Commencer par une maquette.
- **Épurer les chiffres de Finances** — « les chiffres en gros, le texte en
  petit, plus de blanc ». À faire sur maquette.
- **Mesurer une surface sur la carte**, et détourer un chantier au lieu d'un
  point — `docs/carte.md`.
- **La photo d'un ticket qui remplit la dépense** : essai d'abord dans le
  téléphone (Tesseract), Mistral ensuite. **Accord pour télécharger Tesseract
  pas encore donné — ne rien construire avant.**
- **Joindre une photo ou un plan au chantier**, pour la fiche — mis de côté.
- **Le prix de revient par travaux** — à garder en note.

**À lui demander ou à revoir avec lui :**

- La boucle estimation → chantier → agenda : « pour la toute fin ».
- La revue de Calendrier et Rendements : jamais parcourus avec lui.
- Le nom du classement dans les exports (« Class. Comt ») : lui demander.
- Le versement libératoire : son droit à l'option n'est pas vérifié, il devait
  appeler la MSA.
- La CFE n'est pas calculée.
- Les six bulles de l'écran Entreprise : il n'en a rien dit.
- Une ligne groupée qui mêlerait deux familles de travaux : à rouvrir si le cas
  arrive.

**Design, restes ouverts** — `docs/design-navigation.md` : deux actions dans
le bandeau (*Aujourd'hui*, *En-tête*) à déplacer dans leur page ; l'icône Apple
à basculer en crème le jour où un iPhone entre dans le tableau.
