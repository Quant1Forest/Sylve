# Dépôt public : rien de personnel

Ce qui a été retiré, et la réécriture de l'historique.

## Aucun chiffre à lui

*« À la base, on a dit aucune information personnelle dans l'application parce
que c'est public. Donc on enlève tout. »* La règle était écrite en tête de ce
fichier depuis longtemps ; elle a été enfreinte **à plusieurs endroits sans
qu'aucun ne soit un nom** :

- une **valeur par défaut** tirée de sa situation fiscale, dans le code ;
- des **exemples** qui étaient ses vrais chiffres — kilométrage du véhicule,
  comptes de son carnet, quantités de son stock — dans ce fichier, les
  commentaires et les tests ;
- des **noms de communes et des coordonnées** de son secteur dans les tests,
  et le centre de ses départements comme point de départ de la carte ;
- le site régional d'une association, qui situait la région ;
- **les exemples d'import du stock** (`outils/exemples/*.csv`) : ses vraies
  commandes et ventes, clients et fournisseurs anonymisés mais quantités, prix
  et dates vrais — et le prix d'achat de son répulsif recopié en exemple dans
  le code.

Retirés en 4.83 : chiffres ronds inventés, communes inventées (*Clairbois*,
*Montjoie*, *Les Essarts*), la carte s'ouvre sur le milieu de la France.

**Remplacer des exemples sans perdre la vérification.** Le scénario d'import
comparait le stock calculé aux chiffres du tableur — une source écrite
ailleurs. Recopier ce que Sylve affiche avec les nouveaux fichiers aurait
fait un test qui se confirme lui-même. La règle a donc été **recalculée à
part** (`calcul-stock.js`, dans le bac à sable de la séance), d'abord éprouvée
sur les anciens fichiers — elle retrouvait exactement les quatre valeurs
attendues — puis appliquée aux nouveaux.

**La leçon : un chiffre à lui ne devient jamais un défaut ni un exemple.** Un
exemple s'invente, rond et quelconque. Un défaut qui dépend de sa situation
n'existe pas : le champ reste vide et l'écran dit ce qui manque.

## L'historique réécrit

*« Nettoyer l'historique, ça remplace tout. Oui, vas-y. C'est uniquement pour
enlever les infos personnelles, on est d'accord. »* Fait le 17 septembre :
chaque commit a été repris pour en retirer ce que les fichiers actuels
n'avaient déjà plus — ses chiffres, ses lieux, les contours de communes — et
**son adresse e-mail d'auteur**, remplacée par l'adresse anonyme que GitHub
donne à chaque compte.

- **Rien d'autre n'a bougé.** L'état final des fichiers est identique, octet
  pour octet, à celui d'avant : c'est la vérification qui fait foi, pas la
  relecture du script.
- **Tous les numéros de commit ont changé.** Une note qui en cite un d'avant
  le 17 septembre pointe dans le vide.
- **La liste des remplacements est elle-même une donnée personnelle** : elle
  nomme ce qu'elle retire. Elle n'entre jamais dans le dépôt, pas plus que la
  sauvegarde de l'historique d'avant, gardée chez lui.
- **Une copie du dépôt faite avant cette date ne doit plus pousser** : elle
  remettrait l'ancien historique en ligne. On la retélécharge.
- **Les commits suivent l'adresse anonyme** (`git config user.email` du
  dépôt). Sans elle, le prochain commit aurait remis l'adresse en clair.

**La répétition générale avait dit « zéro trouvé » — à tort.** Elle cherchait
les mots mêmes que le script remplaçait : elle ne pouvait trouver que ce qu'on
savait déjà. Une seconde recherche, écrite à part avec des noms de lieux de son
secteur, a trouvé une commune restée dans les tests. **Une vérification qui
relit la liste du correcteur se confirme elle-même** — c'est la règle du
projet, appliquée à un script jetable.
