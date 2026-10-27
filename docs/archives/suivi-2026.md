# Archives : points de situation 2026

Anciens états des lieux et listes d'attente, tels qu'écrits à l'époque. La liste à jour est dans CLAUDE.md, rubrique « En attente ».

## Ce qu’il a signalé et qui n’est pas fait

Tournée du 2 septembre, complétée le 9 et le 15, par ordre de maturité :

- **L’écran Entreprise est lourd** — à moitié réglé le 15 septembre, par lui :
  « À traiter » en est parti (le carnet le porte) et les notes passent sous
  les tuiles. Restent les six bulles au-dessus des tuiles : il n’en a rien
  dit, elles sont restées.
- **Épurer les chiffres de Finances.** *« Il y a tellement de chiffres qu'on ne
  sait plus regarder. Les chiffres en gros, le texte en petit, plus de marge,
  plus de blanc. »* Le passage à la ligne des montants est corrigé en 4.84
  (`ligneCA` : le montant qui compte en gros, d'où il vient en petit, sans
  coupure). Le reste est un travail d'ensemble : **à faire sur maquette**.
- **Mesurer une surface sur la carte.** *« Quand je rentre ma journée : rentrer
  la surface depuis la carte — je zoome, je trace mon polygone, et ça
  m'enregistre ma surface. »* Et le même geste pour **détourer un chantier**
  au lieu d'y poser un point. Demandé le 16 septembre, pas commencé : le
  tracé au doigt, la surface vraie (Mercator étire les surfaces de 1/cos² φ)
  et où la ranger demandent un lot à part.
- **La photo d’un ticket qui remplit la dépense.** *« Je prends en photo ma
  facture, et ça me remplit automatiquement toutes les lignes : le
  fournisseur, ce qu’il y a sur le ticket, le TTC, la TVA. La catégorie, ce
  sera à moi de choisir. »* Le réseau ne le gêne pas (*« quand j’ai des
  factures, c’est en ville »*), mais **il ne veut pas que ses données sortent**
  et a demandé si une IA open source comme Kimi ferait l’affaire. Réponse du
  15 septembre : un modèle ouvert ne protège que s’il tourne chez soi ; le
  service en ligne de Kimi envoie la photo à son éditeur. Trois voies
  proposées — lecture du texte dans le téléphone (rien ne sort, moins fiable),
  un service européen, ou un service américain qui s’engage à ne pas
  entraîner ses modèles dessus. **Il a choisi d'essayer la première, et
  Mistral le tente ensuite ; l'accord pour télécharger Tesseract n'est pas
  encore donné — ne rien construire avant.** Une
  clé de service ne doit jamais entrer dans le dépôt.
- **Le prix de revient par travaux.** *« On le fera plus tard, mais tu peux le
  garder en note. »* Savoir ce que coûte réellement une journée de dégagement :
  amortissement de la débroussailleuse, mélange, huile, déplacement. De quoi
  situer un type de travaux par rapport à un autre. Le module Véhicule fait
  déjà ce raisonnement pour l’utilitaire — c’est le même, étendu au matériel.
- **L'historique du dépôt a été nettoyé le 17 septembre**, à sa demande :
  *« c'est uniquement pour enlever les infos personnelles »*. Voir *L'historique
  réécrit*.

## Où en est le chantier — 23 août 2026

**Version en ligne : 4.59.0.** Le contrôle passe à 1078 vérifications.

**La 4.51, née d'une seule tournée dictée.** Il a parcouru la 4.50 et signalé
six choses en un message : le retour des réglages, l'absence de flèche hors
Entreprise, le retour arrière du téléphone, le crayon « estimer » sur un
chantier payé, le prix de journée devenu muet, et « trop d'endroits où mettre
du temps ». Les six n'en faisaient que deux — voir *Le temps se note à un seul
endroit* et *Le retour arrière remonte d'un cran*. Confirmation de la méthode :
**le symptôme qu'il décrit est juste, le regroupement se trouve en lisant le
message entier.**

**Le contrôle met désormais près de sept minutes**, alors que ce fichier
promet moins de deux. La cause n'a pas été cherchée — à mesurer avant de
l'imputer à la croissance de la suite. En attendant, le filtre
(`node outils/tests.js index.html "un bout de nom"`) reste le bon outil pour
éprouver une garde.

**Le 23 août : le cubage.** Le choix du cubage posé à l'arrivée du module, le
classement ABCD contrôlé, les motifs de réfaction en boutons — voir *Le cubage
se choisit en arrivant*. Trois défauts sans rapport ont été trouvés en chemin
et corrigés : les comptes de jours en millisecondes, les échéances repliées
sur le 28, les liens des notes de mise à jour. Les deux premiers dormaient
derrière des scénarios qui ne cassaient que certains jours.

L'historique est repris et vit sur le téléphone. Le fichier
se refabrique avec `outils/importer-carnet.js` à partir des deux classeurs, qui
restent chez l'utilisateur.

**Ce qui a été fait entre le 17 et le 19 août** — quinze livraisons, toutes
nées de ses tournées dans l'application :

- le devis complet (case « j'ai fait un devis », numéro, date, validité,
  relance sur la validité, statuts qui s'adaptent) ;
- les charges fixes qui deviennent des dépenses toutes seules, avec la TVA
  obligatoire et deux graphiques ;
- l'écran Entreprise avec ses six bulles et ses notes personnelles ;
- deux modules supprimés parce qu'ils n'en étaient pas (Devis, Analyses) ;
- les réglages rangés en zones titrées, et le bouton qui vise la bonne ;
- le stock : totaux honnêtes, saisie au plant, sortie détachable, rentabilité
  par année, graphiques lisibles ;
- son logo et le nom de son entreprise ;
- les notes de mise à jour, et l'ouverture dessus après chaque mise à jour ;
- la fiche chantier restructurée en blocs, dans l'ordre de la vie du chantier.

**La façon de travailler qui marche** : l'utilisateur parcourt l'application
en dictant ce qui coince, et ses retours trouvent plus de vrais défauts que
la lecture du code. Le symptôme qu'il décrit est toujours juste, l'explication
qu'il en donne rarement — creuser le symptôme, pas l'explication.

**Et lire le message entier avant d'agir.** L'erreur commise : il signale que
la bulle et l'alerte d'impayé font doublon, on retire l'alerte — et deux
phrases plus loin il demandait *plus* de détail sur cet impayé. Les deux
étaient dans le même paragraphe. C'est un scénario qui l'a rattrapé.

## Ce qui attend, par ordre de maturité

**Fait le 23 août, à revoir à l'usage :**

- **La CFE** n'est pas calculée : il a dit ne pas savoir la calculer lui-même.
  Elle existe comme type de versement, rien de plus.
- **Le taux de cotisation unique est juste** : à la MSA, le même taux
  s'applique à la base après abattement (50 % en prestations, 71 % en ventes).
  Question close le 15 septembre — voir *Les déclarations*.

*Les catégories au-dessus des prestations et le formulaire de création
raccourci, notés ici comme « prêts à faire », sont faits : voir* Cinq familles
au-dessus des prestations *et* La création d'un chantier.

**Proposé, en attente de sa réponse :**

- **Les grandes familles dans les filtres du carnet** — **faites en 4.83**,
  voir *Les filtres dans l'ordre qu'il a dicté*. Il s'y perdait avec des
  dizaines de chantiers presque tous payés. Les filtres sont désormais
  groupés *En cours / Clos*, et « Avec devis » s'y est ajouté en 4.75 ; ce
  qu'il évoquait en plus — retrouver la **famille de travaux** d'un chantier
  dans le filtre — n'est toujours pas fait. Dit le 23 août ; le 15 septembre
  il ne s'en souvenait plus, rappel fait.
- **Le nom du classement dans les exports.** `.xlsx`, CSV et impression
  écrivent toujours « Class. Comt ». Ces fichiers partent chez le client et
  reprennent le tableur d'origine : lui demander avant d'y toucher.
- **Les tarifs de cubage sur pied** (Algan, Schaeffer). Il a envoyé un cours de
  dendrométrie le 22 août, puis répondu que c'était pour le contexte, rien à
  faire. La fiche de martelage compte déjà les tiges par classe de Ø à 1,30 m
  et ne dit aucun cube : le jour où il le demandera, c'est là que ça se
  brancherait.

**Garé, à ne pas rouvrir sans lui :**

- **La fiche annuelle récapitulative en PDF — le prochain chantier.** Chiffre
  d'affaires, bénéfices, fiscalité, top clients et produits, comparaison sur
  cinq ans. Décrite puis mise de côté ; le 15 septembre : *« on travaillera sur
  la fiche annuelle PDF, qui est intéressante parce qu'on arrive à la fin
  d'année bientôt »*. L'analyse annuelle du stock en porte déjà la moitié des
  chiffres. À commencer par une maquette.
- **Le chantier des rendements** (voir plus haut). Toujours garé.

**Jamais bouclé :**

- **La boucle estimation → chantier → agenda.** Touche Rendements et Calendrier.
  Il a dit vouloir garder l'estimation « pour la toute fin ». Rappelé le 15
  septembre : à garder en mémoire, il y reviendra.
- **La revue de Calendrier et Rendements** : jamais parcourus avec lui.
  Chantiers, Finances, Stock et Réglages l'ont été. Même réponse le 15
  septembre.
- **La lecture des tickets de caisse.** Il veut essayer d'abord la lecture
  dans le téléphone (rien ne sort), et Mistral le tente ensuite — *« une
  entreprise française »* — sans vouloir payer pour un usage aussi rare.
  L'essai demande de récupérer Tesseract (licences Apache et MIT) : **accord
  demandé pour le téléchargement, pas encore donné**.
- **Les lignes de chantier reprises du carnet ne désignent aucun article.**
  Ne pas les rattacher : leur sortie de stock existe déjà, importée du
  classeur. Une garde empêche la double déduction, mais la tentation
  reviendra.
- **Une barre de téléchargement.** Proposée, jamais demandée : elle n'aurait
  de sens que pendant le téléchargement de fond du service worker, quand tout
  est déjà arrivé.
