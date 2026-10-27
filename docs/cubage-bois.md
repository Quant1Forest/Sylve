# Cubage et bois

Types de bordereau, classement ABCD, motifs de réfaction.

## Le cubage se choisit en arrivant

Le type de bordereau existait **depuis toujours** — `meta.classement`, quatre
valeurs — mais au huitième champ de l'en-tête, derrière un bouton « Nouveau
bordereau » qui fabriquait un comtois sans le dire. Le manque était de
**visibilité, pas d'écran** : c'est la règle déjà posée pour « Recettes ». Le
choix est donc en haut de la vue `fichiers`, sur laquelle le module s'ouvre
maintenant (`defaut: 'fichiers'`), et non dans un cinquième onglet qui aurait
redit la liste des bordereaux.

- **Les intitulés stockés ne changeront jamais.** `Class. Comt`,
  `Class. Qualitatif`… sont la **clé de `cfg.qualites`** et le champ des
  bordereaux déjà saisis. `NOM_CLASSEMENT` ne donne que le mot affiché :
  *Cubage comtois*, *Classement ABCD*, *Chablis*, *Sans classement*. Même
  raison que les clés `bordcub.*`.
- **Les exports gardent le code** (`.xlsx`, CSV, impression) : ces fichiers
  partent chez le client et reprennent le tableur d'origine. Question ouverte,
  pas tranchée.
- **`CRITERES_ABCD` vient de la fiche ONF** : A en 4 / 4,5 / 5 / 8 / 9 m et
  45 cm de médian **sur écorce**, B, C et D en 4 m à 20 cm. `controlerBillon()`
  rend des phrases, jamais un refus — la classe se juge sur la grume, Sylve n'a
  que deux nombres. L'avis est `.avis.tiede`, pas `.rouge` : le rouge reste à
  ce qui est faux.
- **Le diamètre est remonté sur écorce avant comparaison** quand le bordereau
  est tenu sous écorce, par la même racine que `cuber()` (`D / √(1−tx)`).
- **`MOTIFS_REFACTION` porte les codes du mémento comtois** (C, D, G, R, GEL,
  EE, P) et les notations de l'ABCD (−1P, −2P, −1D, −2D). En ABCD la notation
  **porte sa purge**, donc `longueurMotifs()` en déduit la réfaction ; en
  comtois non, elle se juge sur la grume et reste à la main.
- **`migrerLibellesAbcd()` ne réécrit que ce qui est resté tel quel.**
  « Actba » devient « Classe A », mais un libellé renommé à la main est le
  sien et il le garde. Les listes de qualités partent dans les sauvegardes :
  changer `QUALITES_DEF` ne suffisait pas.
- **Changer de type sur un bordereau rempli prévient**, nomme les qualités
  orphelines, et laisse décider. Vide, il ne demande rien.

**`moduleDeVue()` remplace une liste tenue à la main.** Les liens des notes de
mise à jour s'appuyaient sur une table de correspondance qui ne connaissait
aucune vue du cubage : une note pointant sur le bordereau ouvrait Chantiers
avec la barre du bas de travers. `MODULES` sait déjà à qui appartient chaque
vue. Une vue partagée revient au premier module qui la déclare — `fichiers` au
cubage, `carnet` aux chantiers.
