# Véhicule

Le carnet du véhicule, le coût au kilomètre, les frais véhicule.

## Le coût au kilomètre : chaque poste a son dénominateur

La 4.64 divisait tout par la même chose et **se trompait d’un facteur
vingt-quatre**. Un peu plus d’un an de dépenses de carburant rapporté à toute la vie du
véhicule donnait moins d’un centime du kilomètre, là où la réalité en vaut
une quinzaine. Son
repère à lui l’a débusqué en une phrase : *« sept cents bornes, c’est presque
un plein, donc presque cent balles »*. L’entretien, lui, était juste — ses
interventions et son kilométrage sont sur la même horloge.

**La leçon générale : un numérateur et un dénominateur qui ne couvrent pas la
même période ne se divisent pas.** Le total n’est donc plus une division mais
une **somme de taux**, chacun bâti sur ce qui lui correspond :

| Poste | Rapporté à |
|---|---|
| Carburant | rien — il se modélise, consommation × prix du litre |
| Entretien | l’étendue que le carnet couvre réellement |
| Achat, carte grise | ce qu’il **reste** à rouler avec (`kmRevente − kmAchat`) |
| Assurance, frais annuels | les kilomètres d’une année |

**Ce qui se paie une fois ne se répartit pas sur ce qui a déjà été roulé.**
C’est lui qui a posé le problème : *« si j’ai fait que cinq cents kilomètres,
ton calcul il est faux, ça veut dire un euro du kilomètre »*. D’où les quatre
repères de `A.vehicule.infos` — `kmAchat`, `prixAchat`, `kmRevente`,
`kmParAn`, `fraisAn` — et le refus d’afficher un poste tant qu’il lui manque
de quoi se calculer : une ligne dit ce qui lui manque plutôt qu’un zéro qui
passerait pour un chiffre.

**Un véhicule acheté d’occasion garde son historique d’entretien d’avant
l’achat, et il compte** : il n’a pas été payé par l’utilisateur, mais c’est la
seule base fiable pour savoir ce que le véhicule coûte — quelques milliers de
kilomètres de ses propres factures ne diraient rien. Ces interventions vivent
donc dans le carnet et **jamais dans les dépenses**.

**`prixLitreMoyen()` est une moyenne pondérée par les quantités** — un plein
de soixante litres pèse trois fois un plein de vingt. Il l’a demandé ainsi, et
il a vu le piège tout seul : *« maintenant tu ne pourras pas, parce que si ça
compte zéro »*. La réponse : **un plein sans litres est écarté**, ni au
numérateur ni au dénominateur, et l’écran dit sur quelle assiette il
travaille (« moyenne sur tant de pleins sur tant »). Aucun litre saisi, on retombe sur
le réglage. Le champ n’apparaît que sur les deux catégories carburant, et la
moyenne du fourgon ne lit que `CARB` : le perso est un autre véhicule, peut-
être un autre carburant.

## Frais véhicule, et le double comptage qu’il ouvre

`VEHIC` — garage, carte grise, pièces — est né d’une remarque de sa part : la
carte grise finissait en frais administratif, et une facture de garage se
confondait avec une lame de débroussailleuse en « Réparation matériel ».

**Mais la même facture peut vivre deux fois** : en dépense et en intervention
du carnet. `depenseLieeAuCarnet()` tranche — une dépense qui porte
l’identifiant d’une intervention (`d.vehicule` valant autre chose que `true`)
est déjà comptée par le carnet et ne compte pas une seconde fois. Un scénario
l’éprouve en cassant la garde : sans elle, 1 700 € au lieu de 500.

**Le va-et-vient marche dans les deux sens et se dit à l’écran.** L’intervention
peut créer sa dépense ; une dépense en « Frais véhicule » peut se verser dans
le carnet, par une case — **pas automatiquement** : une carte grise n’a rien à
faire dans un carnet d’entretien. Le message de fin nomme ce qui a été créé.

**Le carnet raisonne en hors taxes**, comme l’historique repris de ses
factures ; la dépense en TTC. La conversion se fait au passage, dans les deux
sens. L’ancien code recopiait le HT en TTC et **sous-déclarait la TVA d’un
cinquième**.

## Le carnet du véhicule

Un module à part dans Entreprise, deux vues : le carnet et les échéances.

- **Rien d'identifiant n'est livré.** L'identité du véhicule se saisit sur
  place et vit dans `A.vehicule.infos` — le dépôt est public, et le PDF
  d'origine portait plaque et VIN.
- **Le compteur ne recule pas** : `kmVehicule()` retient le plus grand
  kilométrage jamais noté, relevé ou intervention.
- **Une intervention coche les postes qu'elle couvre**, qui repartent alors de
  son kilométrage. Un poste jamais fait compte depuis zéro : une courroie
  d'origine à 230 000 km est bien en retard sur ses 200 000.
- **Les périodicités semées sont des ordres de grandeur**, tirés de son propre
  document de suivi et dits comme tels à l'écran. Sur une courroie de
  distribution, un chiffre approximatif coûte un moteur : la fiche du
  constructeur fait foi, et chaque périodicité se corrige sur place. **Ne pas
  inventer de préconisations constructeur.**
- **Le carnet semé s'enregistre à la première ouverture.** Sans ça, chaque
  lancement refaisait les postes avec de nouveaux identifiants et les
  interventions qui les désignent pointaient dans le vide. C'est un test qui
  l'a trouvé. Une fois écrit, un carnet vidé volontairement de ses postes le
  reste.
- **Le va-et-vient avec les dépenses est lâche** : l'intervention peut créer sa
  dépense (catégorie `ENTRETIEN`, TVA 20 %, à corriger), et une dépense de
  réparation suggère d'aller noter l'intervention — **jamais celle que le
  carnet vient de créer**, qui porte le lien `d.vehicule`.

**`bordcub.versements` et `bordcub.vehicule` partent dans les sauvegardes**
(format version 8). Le carnet est un objet unique : la restauration **fusionne**
ses listes, et dédoublonne les postes **par le nom** — leurs identifiants
diffèrent d'un téléphone à l'autre puisqu'ils sont semés localement.
