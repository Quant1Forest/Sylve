# Chantiers : fiche, devis, facture, carnet, clients

La fiche du chantier, le devis et la facture, le carnet, les clients et leur nommage.

## La fiche suit la vie du chantier

**« En-tête » nommait un formulaire de vingt-trois champs** qui contenait le
devis, la facture, les journées, le peuplement, le statut et la note — dont
deux en double avec la fiche. C'est ce qui le perdait, et il le disait :
« je me perds un peu entre l'en-tête et la fiche ».

La fiche se lit désormais **dans l'ordre de la vie du chantier** : Le chantier
· Ce que ça vaut · Le devis · Les travaux · Les journées · Le temps passé · La
facture · Les fournitures · Le peuplement · Note. **Aucun bloc ne change de
place selon l'étape** : seul son contenu change, pour qu'on retrouve toujours
la facture au même endroit.

**Un bloc dont l'étape n'est pas atteinte reste visible, en pointillé**
(classe `carte avenir`) : on voit le chemin qui reste sans en être encombré.

**Chaque bloc a son crayon**, qui n'ouvre que ses champs — `ouvrirIdentiteCh`,
`ouvrirEstimationCh`, `ouvrirDevisCh`, `ouvrirFactureCh`, `ouvrirJourneesCh`,
`ouvrirPeuplementCh`, `ouvrirNoteCh`. Tous passent par `majChantier()`, qui
enregistre et redessine : c'est ce qui garantit qu'aucun n'oublie de
rafraîchir le carnet ou l'accueil.

**`blocValeur()` change de mots avec l'étape** : « ce que ça vaut » et
« proposé » avant, « ce que ça a rapporté » et « facturé » après. L'estimation
reste lisible tout du long — c'est elle qui dit si la journée a tenu ce
qu'elle promettait.

**`ouvrirEnteteCh` survit pour la création d'un chantier** seulement, et
`brancherCeJours()` sert aux deux formulaires qui manipulent les dates posées.
Le jour où on simplifiera la création, veiller à ce qu'elle reste courte : le
reste se remplit bloc par bloc ensuite.

**Piège rencontré** : `blocFacture()` avait été inséré dans le bloc
conditionnel des fournitures. La facture disparaissait donc sur un chantier
qui n'en consomme pas. Un scénario l'a attrapé.

**Et un rappel de méthode** : écrire ces notes par `node -e` dans le shell
mange les accents graves du Markdown. Passer par un fichier.

## Un seul bloc pour les travaux, trois visages

*« Les travaux sont liés au devis ou à la facture. C’est net. »* Le bloc
« Travaux » autonome a donc disparu : `blocDevis()` et `blocFacture()` sont
fondus dans **`blocTravaux()`**, qui change de nom avec l’étape — comme
`blocValeur()` change déjà de mots.

| `etapeTravaux(c)` | Intitulé | En-tête |
|---|---|---|
| `todo` | Ce qu’il y a à faire | rien |
| `devis` | Le devis | numéro, date, validité, envoi, signature |
| `facture` | La facture | numéro, date, échéance, paiement |

**Il n’y a jamais deux listes de lignes.** C’était le point dur : une seule
liste, plus une **photo du devis** prise au moment du passage en facturé
(`figerDevis`). C’est elle qui permet de dire *où* le changement a eu lieu —
sa vraie question : *« on ne comprend pas à quel endroit il y a eu le
changement »*. La marque est donc **sur la ligne** : `ajoutée`, `modifiée`
(avec ce que le devis disait), `retirée` (barrée, gardée visible — sinon
l’écart devient inexplicable).

**La photo se prend au passage, jamais après.** Sur un chantier déjà facturé
— tous ceux repris du carnet — figer l’existant appellerait « devis » ce qui
n’en a jamais été un, et tout paraîtrait conforme à un devis inexistant.
D’où la comparaison `avant !== c.statut` dans `majChantier()` **et** dans
`ouvrirStatut()`. Une ligne née après la photo n’a pas d’`uid` dedans : c’est
ce qui la désigne comme ajoutée, sans rien marquer à la saisie.

**Le devis n’est pas perdu quand la facture arrive** : il se replie en pied
de bloc — son numéro, ce qu’il disait, l’écart. Et *« Facturé à l’identique »*
quand rien n’a bougé : l’absence de changement est une information.

**`blocValeur()` n’a plus de crayon.** *« C’est bien d’avoir un bloc visuel où
je n’ai rien à modifier. »* Il ne fait que lire le bloc des travaux, et ses
mots suivent l’étape : prévu / proposé / facturé.

**Piège à connaître** : le crayon du bloc vaut `f-devis` avant la facture et
`f-facture` après. Un accès à la facture avant la bascule restait nécessaire —
un bouton « Saisir la facture » vit dans le pied. Sans lui, un numéro saisi
d’avance n’avait aucun chemin, et un scénario s’est arrêté dessus.

## Les journées se déduisent du devis

*« Si je fais mon devis avec trois journées, il faut que dans mon temps estimé
ça bloque à trois jours. Je n’ai pas à le remplir deux fois. »*

`joursDevis()` somme les lignes en unité `jour` ; **`joursPrevus()`** rend
cette somme, ou `joursEstimes` à défaut. **Jamais l’addition des deux** — même
règle que `tempsPasse()`, et pour la même raison. Toutes les lectures passent
par là : `resteAPlacer`, `journeesPrevues`, les alertes, la fiche.

**Et `travauxHorsJournees()` nomme ce que la déduction ne couvre pas.** Un
devis qui mêle des journées et de l’hectare : sans cette mention il croirait
que les journées couvrent tout. *« Il faudrait que tu puisses mettre juste à
côté : attention, ne tient compte que du dégagement. »*

L’estimation vit maintenant **dans le bloc des travaux**, avec ce qui la
chiffre. Elle était deux blocs plus haut, dans un formulaire à part : encore
deux endroits pour une même idée.

## Le numéro se compose

`F-2026-0016`, `D-2026-0042` : préfixe fixe, année modifiable, rang sur
quatre chiffres. **Il ne tape que le chiffre**, les zéros se posent seuls.
`champNumero` / `brancherNumero` / `lireNumero` servent aux trois formulaires
(devis, facture, et la demande à la bascule).

- **`prochainRang()` propose le suivant** de l’année en cours, jamais imposé —
  il numérote parfois hors séquence. Les numéros d’une autre année ne pèsent
  pas sur la séquence.
- **`decomposerNumero()` est permissif** : un numéro d’une autre forme n’est
  pas perdu, on en garde les derniers chiffres.
- **Un test qui écrit l’année en dur ment le 1er janvier.** Le scénario la lit
  sur l’horloge et sème ses numéros avec.

## Le statut suit la saisie

Deux questions restées ouvertes, tranchées le 31 août :

- **Une facture remplie bascule le chantier**, sans confirmation. La fenêtre
  n’ajoutait qu’un geste à un choix déjà fait en remplissant les champs. Un
  paiement saisi mène jusqu’à « Payé ».
- **Un devis signé fait avancer le chantier**, et **la date est demandée** :
  sans elle on ne sait plus quand l’engagement a été pris (`dateSignature`).

**Jamais en arrière**, dans les deux cas : la comparaison se fait sur
`rangStatut`, pas sur l’égalité. Corriger la date d’un devis ne doit pas
ramener un chantier en cours à « à planifier ».

## Journées faites, échéance de paiement, fiche à compléter

**Une journée posée sur une date passée a eu lieu.** `journeesFaites()` et
`journeesAVenir()` séparent le placé selon la date du jour, et la fiche
annonce « faites · à venir · à placer ». C'est ce qui permet de saisir après
coup un chantier déjà commencé sans que tout devienne de l'estimation.

**Attention au contresens** : « faite » dit qu'on y était, pas combien
d'heures on y a passé. Les rendements se calculent toujours sur les temps
saisis (`temps`, alimenté par les journées), jamais sur ces journées placées.
Ne pas les brancher l'un sur l'autre pour « simplifier ».

**L'échéance prime sur le délai.** `c.echeancePaiement` est demandée au
moment de basculer en « Facturé », avec des raccourcis +30/+45/+60 jours
comptés depuis la date de facture — pas depuis aujourd'hui, sinon une facture
saisie après coup recevrait une échéance fausse. `retardPaiement()` compare à
cette date ; `joursRelanceFacture` ne sert plus que faute d'échéance saisie.

**Le délai de règlement se lit par client**, dans le bilan des finances, à
côté de ce que ce client rapporte. C'est **la médiane**, pas la moyenne : un
seul règlement oublié six mois donnerait une réputation imméritée. Le pire
délai s'affiche à côté quand il dépasse la médiane.

**`ce-ech` est un piège de nommage.** C'était l'ancienne échéance *de
chantier* (« à finir avant le »), retirée exprès — il raisonne en journées à
poser, pas en date butoir — et un scénario garde sa disparition. L'échéance
de paiement s'appelle donc `ce-echpaie`. Le test a attrapé la collision.

**Une fiche incomplète se signale, elle ne bloque jamais.** `CHAMPS_FICHE`
liste les champs clés avec l'étape à partir de laquelle chacun a un sens
(`des`) : on ne réclame pas un numéro de facture sur un devis. Un chantier
`sansuite` ne manque plus de rien — il ne se fera pas. La marque « à
compléter » apparaît dans le carnet, la fiche énumère les manques, et un
filtre les rassemble.

## Le devis, quand il y en a un

Tout chantier ne part pas d'un devis : un client qui rappelle pour finir une
parcelle, un dépannage. La fiche porte donc la réponse — `c.aDevis` — et les
statuts suivent, sans qu'aucun code de statut ne bouge :

- `devisSeul` retire l'étape quand il n'y a pas de devis : « Devis à envoyer »
  et « Devis envoyé » sortent de la liste.
- `sansDevis` donne l'autre mot : `accepte` se lit « Devis signé, à planifier »
  ou « À planifier », `sansuite` « Devis refusé » ou « Sans suite ».
- `nomStatut(code, chantier)` prend le chantier en second argument. Appelée
  avec le seul code — le filtre du carnet, qui parle de tous les chantiers à
  la fois — elle rend l'intitulé complet.

**La règle ne vit qu'à un endroit.** `migrerDevis()` inscrit la réponse une
fois pour de bon sur l'existant, plutôt que de la déduire à chaque lecture :
sinon elle aurait vécu dans le module chantiers *et* dans les finances, et
aurait fini par diverger. Le repli de `aDevis()` ne sert plus qu'aux données
restaurées d'une sauvegarde antérieure à la 4.36. Pour la même raison,
`tauxReussite()` reçoit le prédicat en second argument au lieu d'appeler
l'autre module.

Trois champs vont avec : `numeroDevis` (souvent rempli plus tard),
`dateDevis`, `validiteDevis` en mois. `finValiditeDevis()` en déduit la fin
— et replie le jour sur la fin du mois d'arrivée : un devis édité un 31
janvier et valable un mois court jusqu'au 28 février, pas au 3 mars.

**C'est la validité qui appelle, pas le délai.** Un devis envoyé remonte
quatorze jours avant sa fin de validité, puis passe en gravité 2 une fois
expiré. Le délai réglable (`joursRelanceDevis`, 21 j) ne sert plus que faute
de validité saisie. L'avis vit sur l'accueil (`#a-devis`), sous celui des
échéances, et se chasse d'un doigt jusqu'au prochain lancement.

**Le numéro de facture se demande où l'on bascule.** Il existait depuis
longtemps dans l'en-tête, sixième champ — donc jamais rempli. Passer un
chantier en « Facturé » sans numéro ouvre maintenant `demanderNumeroFacture()`,
qui propose aussi la date et laisse toujours la porte de sortie « Plus tard ».

**La recherche du carnet passe outre le filtre.** Un numéro de facture
appartient presque toujours à un chantier payé, donc rangé hors des
« ouverts » : taper le bon numéro et ne rien voir sortir serait le pire des
deux. `chercher()` regarde nom, donneur, propriétaire, forêt, parcelles,
commune, les deux numéros et la note ; plusieurs mots doivent tous se
retrouver, pas forcément dans le même champ.

## Le client, et son type

*« C'est tous des clients. Des fois c'est des propriétaires forestiers, des
fois des gestionnaires, ça peut être une entreprise de travaux sylvicoles. Il
faudrait que je puisse choisir quel type de client c'est, et si c'est un
propriétaire, me demander s'il a un numéro de SIREN. »*

**Le mot à l'écran devient « Client »** — sur le chantier, la fiche et les
Réglages. Il désignait « Propriétaire » ce qui n'en est pas toujours un.

**Sauf sur la fiche de chantier imprimée**, qui garde « Propriétaire » : c'est
le mot de l'arrêté du 31 mars 2011, et cette feuille part sur le chantier pour
être lue par un contrôleur. Le vocabulaire d'un document réglementaire ne suit
pas celui de l'application.

`TYPES_CLIENT` — propriétaire forestier, gestionnaire, entreprise de travaux,
autre. Le type vit dans `A.cfg.contacts[nom]`, à côté du téléphone et du
SIREN qui y sont déjà : **aucune migration**, les listes restent des listes de
noms. Même mécanique qu'en 4.72 pour le téléphone, et pour la même raison.

- **Le SIREN ne se demande qu'au propriétaire forestier.** Un gestionnaire ou
  une entreprise refacturent : la question n'a pas de sens pour eux, et la
  poser quand même fait cocher au hasard. La case **disparaît** plutôt que de
  rester grisée — une case sans objet finit toujours par se faire cocher.
- **Sans type, on ne retire rien.** `sirenPossible()` rend `true` sur un nom
  qu'on ne connaît pas : les chantiers déjà saisis gardent la
  question, et rien ne change pour eux. « Je ne sais pas » n'est pas un refus.
- **La question se pose là où le nom naît** : dans l'offre d'ajout, sous le
  champ. C'était son défaut — *« quand je crée un nouveau propriétaire, il ne
  me demande pas s'il a un numéro de SIREN »*. La case existait, vingt lignes
  plus bas, sans lien visible avec le nom qu'il venait de taper.

**Piège rencontré, et il vaut d'être retenu : il n'y a qu'une modale à la
fois.** La première version posait la question en fenêtre — elle écrasait le
formulaire de création et emportait le nom en cours de saisie. Un scénario l'a
attrapé. **Toute question posée pendant un formulaire se pose dans le
formulaire**, jamais par-dessus.

## Le nommage inversé s'est aggravé — à lire avant d'y toucher

Le tableau du nommage vaut plus que jamais depuis que le mot affiché a changé :

| À l'écran | Liste interne | Champ du chantier |
|---|---|---|
| Donneur d'ordre | **`clients`** | `donneur` |
| **Client** | **`proprios`** | `proprietaire` |

Autrement dit : **ce que l'écran appelle « Client » est stocké sous
`proprios`, et le magasin nommé `clients` porte les donneurs d'ordre.** Les
clés ne se renomment jamais — elles feraient chercher les données dans un
tiroir vide — mais quiconque lira `clients` dans le code croira toucher aux
clients alors qu'il touche aux donneurs d'ordre.

**Vérifier ce tableau avant de toucher à l'un des deux.** C'est déjà le piège
qui a fait remplir chaque menu déroulant avec la mauvaise moitié du carnet, à
l'import.

## Donneur d'ordre et propriétaire — l'origine du nommage

Le stockage et l'interface ne disent pas la même chose, et l'import s'y est
laissé prendre :

| Champ à l'écran | Liste qui l'alimente | Champ du chantier |
|---|---|---|
| Donneur d'ordre | `clients` | `donneur` |
| Propriétaire facturé | `proprios` | `proprietaire` |

Le maître d'œuvre du carnet est donc un **client** au sens du stockage, et le
client du carnet un **propriétaire**. Les intervertir remplit chaque menu
déroulant avec la mauvaise moitié du carnet, et le bouton « + liste » ajoute
au mauvais endroit. Vérifier ce tableau avant de toucher à l'un des deux.

Le circuit réel, qui explique le nommage : **le donneur d'ordre démarche, fait
le projet et reçoit la facture ; il la transmet au propriétaire, qui règle.**
Le champ s'intitulait « Propriétaire facturé », ce qui laissait croire que la
facture partait chez lui — c'est « Propriétaire » depuis la 4.25.0.

## Le libellé de facture prime sur l'intitulé des travaux

`TRAVAUX` sert au taux de TVA et aux rendements : la liste doit rester courte
et stable. Elle ne dit pas ce qui a été vendu — « Fourniture de tuteurs » là
où la facture porte « tuteur châtaignier 9/11×150 ».

Le champ `note` d'une ligne porte ce texte, sous l'intitulé **« Libellé sur la
facture »**, et c'est lui qui s'affiche en tête de la ligne ; l'intitulé des
travaux passe dessous, avec la quantité. Il s'appelait « Précision » et était
noyé en quatrième position dans la ligne grise : l'utilisateur ne retrouvait
pas sa propre facture.

## La création d'un chantier, et son nom

Le formulaire de création portait encore les vingt-trois champs de l'ancien
« en-tête ». Il n'en garde que cinq : **donneur d'ordre, propriétaire, commune,
forêt, type de travaux**. Le reste se remplit bloc par bloc sur la fiche.

- **`nomAutoChantier(travail, proprietaire, commune)`** compose « Dégagement
  manuel — Dupont, Montjoie ». Il était proposé et se figeait dès qu'il tapait
  le sien ; depuis la 4.75 le nom ne se stocke plus du tout — voir *Le nom du
  chantier ne se stocke plus*. Le champ a disparu des deux formulaires.
- **Le type de travaux ouvre la première ligne** du bloc Travaux, avec son
  unité, sans prix. Demandé par lui : « en général à la création je
  sais déjà le type de travaux effectués ».
- **Avec ou sans devis se choisit à la création, et c'est obligatoire** (4.84).
  *« Je crée un chantier, je n'ai pas de devis, et je n'ai pas de statut
  adapté. »* Avec : `devis` (« Devis à envoyer »). Sans : `accepte`, qui se lit
  « À planifier » quand `aDevis` est faux. Tout chantier naissait en « Devis à
  envoyer ».
- **Une estimation rapide** (4.84) : « Journées à prévoir » (`joursEstimes`)
  et, si les travaux ne se comptent pas à la journée, la surface ou la
  quantité dans leur unité, posée sur la première ligne. Les deux facultatifs,
  rien d'inventé quand ils sont vides.
- **`formEnteteCh()` et `renderCeDevis()` ont été retirées** : elles ne
  servaient plus qu'à ce formulaire. Les helpers partagés restent —
  `brancherCeJours`, `brancherEssenceCh`, `brancherOffreListe`,
  `majFinValidite` servent aux blocs de la fiche. Vérifier le compte d'usages
  avant d'en supprimer un autre.
- **Quatre scénarios passaient par ce formulaire** pour éprouver des propriétés
  qui vivent ailleurs : journées posées (bloc Les journées), ajout d'essence
  (Le peuplement), case du devis et étapes de statut (Le devis et Statut). Ils
  visent maintenant ces écrans.

## Le forfait groupé : plusieurs travaux sur une ligne

« Du détourage avec de l'élagage de tiges… c'est juste une désignation, comme
une ligne globale qui se divise en compartiments. Le prix, il est sur le
global. » Donc : les travaux **désignent** ce que la ligne couvre, le prix
porte sur l'ensemble, et il n'y a **pas de quantité**.

- **`travail` reste le premier de la liste**, `travauxPlus` porte les
  suivants : aucune ligne ancienne ne bouge, et les rendements, la famille et
  l'historique continuent de lire `travail`.
- **Une ligne groupée prend la famille de son premier travail.** Décision prise
  faute de réponse, signalée comme telle — à rouvrir s'il groupe un jour deux
  travaux de familles différentes.
- **Sa règle de TVA** : même taux partout, on l'applique ; taux différents, le
  formulaire **refuse d'enregistrer** et lui fait choisir (`tvaAtrancher()`).
  Sans arbitrage, `tauxLigne()` retient le **plus élevé** — sous-facturer la
  TVA coûte plus cher que l'inverse.
- **Les taux ne divergent qu'avec un SIREN.** Sans SIREN tout est à 20 % et la
  question ne se pose jamais. C'est pourquoi le scénario doit poser
  `siren: true` pour éprouver la garde.
- **Les fournitures ne sont pas proposées en travaux supplémentaires** : elles
  ont leur propre nature et changeraient le sens de la ligne.

## L'ordre des factures, et les fiches voisines

`rangFacture()` rend « F-2026-0010 » comparable (année × 10⁶ + rang). **Entre
deux chantiers facturés, le numéro prime sur tout** — c'est l'ordre de ses
classeurs, et il départage deux factures du même jour, ce que la date seule ne
savait pas faire. Dès que l'un des deux n'a pas de facture, on retombe sur
`rangComptable()` : un chantier en cours n'a pas à être relégué.

**La fiche porte « Précédente » et « Suivante »** sous le sélecteur, avec le
rang, dans ce même ordre. `chantiersOrdonnes()` sert aux deux, pour qu'ils ne
puissent pas diverger.

**« Unité proposée »** a remplacé « Unité de facturation » : il facture la même
prestation tantôt à la journée, tantôt à l'hectare, et croyait le mot
contraignant alors qu'il ne fait que pré-remplir.

## Cinq familles au-dessus des prestations

`TRAVAUX` correspond à ce qu'il appelle ses **sous-catégories** : quarante-cinq
prestations à plat, sans l'étage du dessus — celui sur lequel il raisonne et
fait ses analyses. `CAT_TRAVAUX` le pose.

- **Cinq et non sept.** Il en citait sept ; « Fourniture » et « Débours client »
  existent déjà comme **nature de ligne**, et la nature décide de l'abattement
  fiscal. Les redire aurait fait deux champs pour la même chose.
  `categorieLigne()` recompose ses sept à partir de cinq : la nature l'emporte
  pour une vente ou un débours, la famille du travail parle sinon.
- **Le rangement livré n'est qu'un défaut.** Chaque prestation porte sa famille
  dans les réglages et elle s'y change (`travauxPerso[code].cat`) : quarante-cinq
  affectations décidées sans lui ne pouvaient pas toutes être justes. Deux
  hésitations signalées : le *jalonnage* rangé en gestion alors qu'il se
  facture au mètre, et *routes / fossés / drainage / pistes* rangés en
  exploitation alors que c'est de la desserte.
- **Les fournitures (`F_*`) n'ont pas de famille de travaux**, ni « Autre ».
  Elles en prennent une par la nature de la ligne.
- **`parFamille()` reçoit les deux fonctions du module des chantiers** au lieu
  de l'appeler : Finances ne doit pas atteindre Chantiers, sinon les deux
  finissent par diverger. Même raison que `tauxReussite()`.
- **Piège rencontré : deux `optionsTravaux`.** L'une pour les postes d'une
  journée, l'autre ajoutée pour les lignes de chantier. La seconde écrasait la
  première en silence et le sélecteur groupé ne s'affichait nulle part. Elles
  n'en font plus qu'une, avec deux drapeaux (`vide`, `sansFournitures`). Le
  vérificateur l'attrape et nomme les deux lignes — encore faut-il le lancer :
  il ne sert à rien si on ne l'appelle qu'après avoir corrigé.

## L'ordre de la comptabilité

`rangComptable()` : **date de facture**, à défaut **date du devis**, à défaut le
**chantier le plus récemment rentré**. Règle dictée par lui le 23 août. Le
carnet et le sélecteur de la fiche triaient sur `maj` et `dernierEvenement()` —
un chantier remontait dès qu'on l'ouvrait pour le corriger, et l'ordre
paraissait alphabétique, c'est-à-dire dû au hasard.

**Ne pas détourner `dernierEvenement()`** pour autant : il date les sorties de
stock (`synchroniserStock`), et le changer aurait re-daté ses mouvements. Les
deux notions se ressemblent et diffèrent : l'une dit la dernière étape
franchie, l'autre le rang comptable.

**La flèche de retour est dans tous les modules** depuis la 4.52. Elle était
masquée hors d'une partie — le bouton d'accueil y faisait déjà le trajet. Il
l'a voulue partout : « comme ça j'ai les deux possibilités. » Hors partie, elle
vise l'accueil.

## Le nom du chantier ne se stocke plus

*« Le titre, je ne devrais pas le choisir. Ou alors je devrais pouvoir le
modifier, mais… non, même pas. Sinon je ne le modifie pas, ils sont tous
pareils, comme ça je ne me pose plus de questions. »*

Et la cause des titres dépareillés, qu'il décrivait sans pouvoir la nommer
(*« quand je l'enregistre, c'est bizarre »*) : **`nomAutoChantier()` ne
s'appliquait qu'une fois, à la création.** Le propriétaire et la commune se
remplissent souvent après, sur la fiche. Le nom gardait donc ce qu'il savait
au départ et ne rattrapait jamais — sans qu'aucune saisie soit fautive.

`nomChantier(c)` **se compose à la lecture**, comme le statut d'un jour du
calendrier. Prestation — propriétaire, commune.

- **Aucune migration, aucun renommage.** C'était la question posée avant de
  s'y mettre : il a choisi « composé, jamais modifiable », ce qui semblait
  imposer de réécrire tous ses chantiers. Dériver l'a rendu inutile —
  rien n'est touché, donc rien n'est risqué. Troisième fois que ce projet y
  gagne : `c.temps`, le statut d'un jour, et maintenant le nom.
- **`c.nom` reste en base et sert de repli.** Un chantier sans prestation,
  sans propriétaire et sans commune n'a rien à composer : son ancien nom vaut
  mieux que « Chantier ». C'est le repli qui permet de ne rien réécrire.
- **La recherche garde les deux.** Le nom composé *et* l'ancien : c'est encore
  par le mot qu'il avait tapé qu'il retrouve un vieux chantier, et ce mot ne
  s'affiche plus nulle part.
- **La première prestation qui n'est pas une fourniture.** « Fourniture de
  tuteurs — Martin, Clairbois » nommerait mal un dégagement qui en consomme.
- **Le champ de saisie a disparu des deux formulaires**, remplacé par un
  aperçu en lecture seule qui suit la frappe. Il voit sous quel nom le
  chantier s'appellera sans avoir à le décider — la même idée que
  `blocValeur()`, *« c'est bien d'avoir un bloc visuel où je n'ai rien à
  modifier »*.
- La création ne réclame plus un nom mais **de quoi en composer un** : le
  type de travaux, le propriétaire ou la commune.

**Corollaire pour les tests** : un scénario qui sème un `nom` et l'attend à
l'écran ne dit plus rien. Trois l'ont fait, et ils semaient tous un nom libre
pour éprouver autre chose — la mise en page d'un nom long, la recherche. Ils
sèment maintenant ce qui *compose* ce nom.

## La ligne du carnet, et l'ordre qu'on lui donne

*« Le propriétaire est répété une deuxième fois. On part sur la prestation, le
propriétaire, la commune ; en dessous le donneur d'ordre. Comme ça je peux
mettre facturé le, ensuite payé le, comme ça c'est facile à lire. »*

- **Le titre porte le propriétaire et la commune** : les redire dessous était
  une répétition, et c'est ce qui rendait la ligne illisible. La deuxième
  ligne ne garde que le donneur d'ordre, la forêt et les parcelles.
- **Les prestations en trop se comptent au lieu de se lister** (« et 2 autres
  prestations ») : la première est dans le titre, les nommer toutes doublait
  la longueur de la ligne.
- **`datesCh()` rend toutes les étapes datées**, pas seulement la dernière.
  `dateStatut()` n'en donnait qu'une : une fois le chantier payé, on ne voyait
  plus quand la facture était partie, donc plus le délai. `dateStatut()` sert
  encore sur la fiche, où il n'y a qu'une ligne à écrire.

**Le tri se choisit** — `TRIS_CH` : ordre du classeur, n° de facture, date de
facture, date de paiement, date du devis, date d'entrée. Le sens
ancien/récent existait déjà et reste à part.

- **Ce qui n'a pas la valeur demandée va à la fin, dans les deux sens.** Un
  chantier sans facture n'est pas « la plus ancienne des factures » ; le
  ranger sur une date qu'il n'a pas serait un mensonge. Entre eux, ils
  suivent leur date d'entrée.
- **La fiche suit le même ordre.** `chantiersOrdonnes()` reçoit le critère :
  deux ordres différents pour la même liste, et « Précédente » n'annoncerait
  pas le chantier qu'on vient de voir.

**`dateEntree(c)`** est le jour où le chantier est entré dans Sylve — pas
celui des travaux. Posée à la création, corrigeable sur la fiche : un chantier
saisi après coup n'est pas arrivé aujourd'hui. **Repli sur `cree`**, donc rien
à migrer là non plus.

**Un filtre « Avec devis »** rejoint « Chantiers ouverts », « Tous » et « À
compléter » : *« sélectionner uniquement les chantiers qui ont eu un devis, et
pouvoir aussi les trier ».*

**Les filtres dans l'ordre qu'il a dicté** (4.82) : *Tous*, *Avec devis*,
*Chantiers ouverts*, *Chantiers clos*, *En cours ou à planifier*, puis *À
compléter* et les statuts un par un.

- **« En cours ou à planifier »** (`afaire`) : `accepte` et `encours`. *« Pour
  voir ce qui me reste à faire et m'organiser. »* Un chantier terminé ou
  facturé ne demande plus de journée.
- **Les familles de travaux** (4.83) forment un groupe à part : un chantier y
  figure dès qu'**une** de ses lignes relève de la famille, et la famille suit
  ses réglages (`travauxPerso[code].cat`), pas le rangement livré. Une famille
  sans chantier ne s'affiche pas. **Tout en bas** depuis la 4.84 : *« c'est le
  truc que je vais utiliser le moins souvent »*.
- **« Ouverts » n'a pas changé de sens** : un facturé non payé y reste,
  l'argent n'est pas rentré. C'est `statutOuvert()`, qui sert ailleurs.
- **Le groupe « En cours » s'appelle « Ouverts ».** Il rangeait les facturés
  sous le nom d'un statut : *« dans en cours, j'ai encore tous les chantiers
  que j'ai finis »*.

## La tête du carnet, dans ses mots

*« Engagé tous statuts, ça c'est un peu bizarre. Devis sans réponse… »* Les
deux intitulés l'arrêtaient à chaque passage. Il a dicté la liste qu'il veut
lire, et tranché le point d'argent : **facturé et encaissé côte à côte**,
parce que l'écart entre les deux est justement ce qu'il vient voir.

| Tuile | Ce qu'elle dit |
|---|---|
| **Facturé** | la facture est partie, réglée ou non · N factures |
| **Encaissé** | ce qui est rentré |
| **En attente** | engagé, pas encore facturé · N chantiers, dont N à facturer |
| **Devis en attente** | ce qui n'a pas eu de réponse · N devis |

**Le facturé est la base des déclarations**, celle que Sylve emploie déjà :
les deux écrans doivent dire la même chose, sinon le jour de la déclaration il
ne sait plus lequel croire.

**« À facturer » a perdu sa tuile mais pas son signal.** C'est le chantier
qu'on risque d'oublier, et il compte même sans ligne chiffrée — il est devenu
un sous-compte de « en attente » plutôt que de manger une tuile de la liste
qu'il a dictée. Un scénario le gardait ; il a fallu le recaler, pas le
supprimer.

## Attacher un devis après coup

**Régression introduite par la fusion des blocs, et trouvée par lui.** Sur un
chantier facturé, le crayon du bloc ouvre la facture — et plus rien ne menait
au devis. *« J’ai plein de travaux enregistrés avec des factures, j’ai des
devis, et j’aimerais bien les attacher, ne serait-ce que pour attester qu’il y
a eu un devis. »*

Le pied du bloc porte donc **« Attacher un devis »** / « Modifier le devis »
à l’étape facture, comme il porte « Saisir la facture » aux étapes d’avant.
**Leçon générale : chaque étape doit garder une porte vers les autres.** Un
bloc qui change de nom avec l’avancement ferme, sans le vouloir, ce qu’il
n’affiche plus.

Attacher un devis après coup **ne fige rien** — `figerDevis()` ne se déclenche
qu’au passage en facturé — et **ne fait jamais reculer le statut**.

**`delaiRealisation()`** en découle : *« savoir, à partir du moment où le devis
est signé, sous combien de temps je réalise les travaux »*. De
`dateSignature` à `dateChantier()`, en **jours de calendrier** — `minuit()`
des deux côtés, pas une soustraction de millisecondes.

## Le téléphone d’un client sans toucher à ses listes

La fiche exige un téléphone pour le propriétaire et le donneur d’ordre. Ses
listes ne sont que des **noms**, et les transformer en fiches aurait été une
migration sur des données qu’il a déjà saisies.

**`A.cfg.contacts` range le numéro à côté, indexé par le nom.** Les listes ne
changent pas de forme, les datalists continuent d’y puiser, **zéro migration
donc zéro risque** — et il ne remplit un téléphone que le jour où il en a
besoin, depuis la fiche, là où le manque se voit. La fiche suivante pour le
même nom le reprend.

Limite connue : renommer un client orpheline son numéro. Rare, et le jour où
ça gêne, l’écran des listes éditera les deux ensemble.

## Le SIREN se demande une fois par propriétaire

*« Quand je crée un nouveau chantier et un nouveau propriétaire, il ne me
demande pas s’il a un numéro de SIREN. »* Le formulaire de création raccourci
en 4.55 avait perdu la case : **tout chantier neuf partait à 20 % de TVA** là
où le taux réduit s’applique. Défaut d’argent, silencieux.

**Et la question ne porte pas sur le chantier, elle porte sur le
propriétaire.** Elle rejoint donc le téléphone dans `A.cfg.contacts`, indexée
par le nom, et se reporte dès qu’il retape le même — une fois par
propriétaire, pas une fois par chantier.

**En 4.84, elle ne se pose plus qu’à un endroit : sous le champ du client.**
*« Il me demande s'il a un numéro de SIREN, et juste en dessous c'est aussi
marqué : il me redemande. »* La case du bas redisait la question — et c'était
pire qu'une redite : **restée décochée, elle écrasait le « oui » donné sous le
champ**. Le chantier partait à 20 % et le client perdait son SIREN. Même
défaut dans « Le chantier » de la fiche, dont la case reste (c'est là qu'on
corrige un chantier) mais relit désormais la réponse.

- **Le chantier créé lit la réponse du client** (`sirenDe`) ; la création
  n'écrit plus rien dans `contacts`.
- **Un client déjà connu dont on ignore la réponse** se voit poser la question
  sous le champ, en quittant le champ (`brancherOffreListe(…, { connus: true })`).
  C'est ce que la case du bas faisait pour les noms d'avant les types.
- **La réponse se dit au formulaire** : `brancherOffreListe` déclenche un
  `change` sur le champ après la réponse, et le formulaire relit. Créé par
  `document.createEvent`, pas `new Event`, pour le vieux matériel.

**Leçon : deux endroits pour une même réponse ne font pas qu'encombrer, ils
se contredisent** — et c'est le dernier écrit qui gagne, pas le bon.

## Le prix de journée ne se lit qu'à la fin

*« Ce n'est pas un chiffre qui est utile en cours de chantier. Il sert plutôt
à la fin : tu as fait tant de journées, tu as facturé tant, donc ta journée
vaut tant d'euros. »*

Trois journées facturées 1 050 €, une seule faite : `prixJour()` divisait
1 050 par 1 et annonçait **1 050 € par jour-homme**. Le chiffre n'était pas
faux, il était **prématuré** — le montant est complet dès le devis, les
journées ne le sont qu'à la fin.

`chantierSolde(ch)` — terminé, facturé, payé — commande désormais
`prixJour()`, qui rend `null` avant. Deux conséquences :

- **La fiche dit pourquoi le chiffre manque** plutôt que de le taire : un
  chiffre absent sans explication ressemble à un oubli.
- **La moyenne des rendements s'en trouve nettoyée.** `references()` remontait
  ce prix prématuré dans le « €/jour obtenu » de chaque prestation, où il
  faussait tout. C'est l'effet le moins visible et le plus important.

## Le carnet dit le TTC, et qui le fait vivre

*« Tu mets le montant hors taxes. Est-ce que tu pourrais mettre le taux de
TVA, la TVA, le montant TTC, sur le côté droit ? Comme ça ça permet de voir un
global très rapidement. »*

La colonne de droite porte **le hors taxes et le TTC tous les deux en gros** —
son choix — et la TVA dessous. Le premier fait le chiffre d'affaires et les
déclarations, le second est ce que le client paie.

- **`tvaChantier()` calcule ligne à ligne**, jamais un taux appliqué au total :
  un chantier peut mêler 10 et 20 %, le répulsif n'ouvrant pas droit au taux
  réduit là où le dégagement y a droit.
- **`tauxChantier()` rend `null` quand ils sont deux.** La ligne dit alors
  « TVA mêlée · 120 € ». Afficher l'un des deux serait un mensonge, afficher le
  plus élevé en serait un autre.
- **Le doublon a été supprimé au passage** : la fiche recalculait la même TVA à
  la main, dans son coin. Deux copies d'un calcul de TVA finissent toujours par
  diverger, et c'est la TVA — on ne la calcule pas deux fois.

**Quatre carreaux, deux par ligne** (`.kpi2`), dictés par lui :

| | |
|---|---|
| **Facturé** · N factures | **Encaissé** |
| **Devis signés** · montant | **Premier donneur d'ordre** · son nom, sa part |

- *« En attente, ça veut dire quoi ? »* Le mot ne disait rien : il cède la
  place aux devis signés, qui sont un compte, pas une abstraction. Même
  définition que la bulle de l'écran Entreprise (statut `accepte`) — deux
  écrans qui comptent la même chose doivent la compter pareil.
- **Le premier donneur d'ordre se calcule sur tout l'historique**, à sa
  demande : ce chiffre ne bouge presque jamais, et c'est justement ce qu'il
  dit — la dépendance réelle. **Le pourcentage est l'information** : quelqu'un
  à quatre-vingts pour cent n'est pas un client, c'est un risque.
- **« À facturer » a quitté le carreau, pas l'écran.** C'est le chantier qu'on
  risque d'oublier, et il compte même sans ligne chiffrée : il rejoint la ligne
  des chantiers ouverts. Un scénario garde sa présence — il avait déjà été
  perdu une fois.

## Le temps tient dans un seul bloc, et se compte en heures

*« Est-ce qu’il n’y a pas moyen de regrouper ces deux blocs ? Parce que si
déjà je sais quelle journée… »* Oui — **depuis que tout se compte en heures,
le prévu et le fait ont la même forme**. « Les journées » et « Le temps
passé » n’en font plus qu’un : une date, ce qui a été **fait**, ce qui était
**prévu**.

**Les deux listes restent distinctes en base.** `jours` sont des dates posées
sur l’agenda, `temps` est ce qu’on y a passé, et l’avertissement plus haut
tient toujours : ne jamais brancher l’une sur l’autre. `lignesTemps()` ne les
rapproche **qu’à l’écran**, ligne à ligne, par la date.

- **Le fait est à gauche.** *« J’aurais plutôt mis les journées faites à
  gauche, ce qui sont prévus au milieu. »* C’est la colonne qu’on vient lire.
- **Une journée passée sort du « reste à faire ».** Il l’a relevé sur la
  maquette : *« les journées faites ne sont plus comptabilisées comme des
  journées prévues »*. Compter les deux, c’est compter deux fois la même
  journée. Le total se lit donc **fait · reste à faire · estimé au devis**, et
  les deux premiers s’additionnent pour donner le troisième quand tout tombe
  juste.
- **Une saisie sans date a sa propre ligne**, marquée « rattrapage » : elle
  compte, mais elle ne tombe sur aucune case du calendrier.

## Une durée s’écrit « 2 j 4 h », jamais « 2,4 j »

*« Vu qu’une journée c’est sur huit heures et pas sur dix, on ne peut pas
juste mettre trois virgule deux si j’ai fait trois jours et deux heures. »*

`ditDuree(heures, cfg)` rend la journée entière et le reste en heures.
`heuresSaisie(t, cfg)` donne les heures d’une saisie quelle que soit l’unité
dans laquelle elle a été notée — les anciennes parlent parfois en journées.
Tout le bloc, le bilan du devis compris, passe par là.

**Le sélecteur « journées / heures » a disparu** de la saisie du temps :
*« soit tu mets tout en heures, soit tu ne mets pas tout en heures »*. Des
crans de 1 h à la journée entière écrivent dans le champ, sans le remplacer.
`partsPossibles()` ne propose plus non plus les ¼ ½ ¾ — ils disaient la même
chose autrement, à côté des heures.

**Mais ce qu’il a déjà posé est à lui.** *« Si c’est une demi-journée, tu peux
laisser des demi-journées, ce n’est pas très grave. »* Une valeur qui ne tombe
pas sur une heure ronde — une demi-journée de sept heures — est gardée telle
quelle par le repli sur `courante`. Un scénario le garantit : **les crans
changent, ses données ne bougent pas.**

## Le jour déjà pris propose, il ne constate plus

*« Il faudrait que ça me dise : attention, tel jour, autre chose est déjà
prévu. Voulez-vous le remplacer ou annuler ? »* L’avertissement existait
depuis longtemps — il constatait, sans rien proposer, et il fallait retrouver
le jour libre soi-même.

Le même calcul qui sert à `+ une journée` déplace maintenant la date
(`data-cesuivant`) : ni week-end, ni jour déjà posé ici, ni retenu ailleurs.
Il l’a demandé parce que passer par le Calendrier était un cul-de-sac —
*« dans le calendrier, je ne pouvais pas revenir en arrière directement dans
le chantier »*.

## Le temps se note à un seul endroit

« Il y a trop d'endroits où je peux mettre du temps. Du coup je me perds un
peu. » Quatre, exactement : `joursEstimes`, les journées posées (`jours`), le
temps saisi (`temps`), et les lignes de travaux en unité `jour`.

**`temps` fait foi, et c'était déjà écrit ici** — les rendements et le prix par
journée le lisent depuis toujours. Mais la fiche affichait `totalFait()`, les
journées *posées*, sous l'intitulé « journées faites ». Deux chiffres pour la
même idée sur le même écran : c'est ça qui l'y perdait, pas le nombre de
blocs.

- **`tempsPasse()` tranche** : le temps noté gagne ; à défaut, `joursFactures()`
  remplit le vide. **Jamais l'addition des deux** — un chantier à la fois noté
  et facturé en journées compterait double. Règle validée par lui le 23 août.
- **Le bloc dit d'où sort son chiffre** : « journées faites » quand il vient du
  temps noté, « journées facturées » quand seule la facture en parle. C'est le
  cas des trente-deux chantiers repris du carnet.
- **Le bloc des journées annonce « posées »**, plus « faites », et dit que ces
  jours-là répondent à *quand*, pas à *combien*. `totalFait()` garde son nom
  côté moteur : il compte bien les journées posées à une date passée.
- **Sur un chantier soldé, le crayon dit « modifier »** et ouvre « L'objectif de
  ce chantier », avec une porte vers la saisie du temps. Il disait « estimer »
  et modifiait un chiffre que le bloc n'affiche même plus à ce stade.
- **La date du temps est facultative et vide.** Elle l'était déjà
  techniquement — pré-remplie, elle avait l'air obligatoire, et on ne pouvait
  pas dire « j'ai fait trois journées » sans dire quand. Sans date,
  `dateParDefautTemps()` rattache le temps à la période du chantier, jamais à
  aujourd'hui : sinon le temps d'un chantier de l'an dernier tomberait dans le
  bilan de l'année en cours.
