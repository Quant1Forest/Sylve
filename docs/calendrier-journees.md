# Calendrier et journées

Ma journée, les statuts des jours, les rappels, la planification.

## Ma journée : le temps total, le productif, le trajet

*« Je devrais pouvoir faire une distinction : si j'y passe la journée, je mets
8 heures. Mais j'ai eu un problème de tronçonneuse, j'ai dû affûter : en
heures productives, j'ai peut-être passé que 7 heures. »* Puis, sur la 4.82 :
*« il faudrait juste le temps total, et le temps productif. Et après, si je
peux rajouter le temps de trajet. »*

Trois nombres, dans ses mots (4.83) :

| À l'écran | En base | |
|---|---|---|
| **Temps total sur le chantier** | — | se relit : productif + `nonProd` |
| **Heures productives**, par prestation | `postes[].heures` | font les rendements |
| *hors production* (affichée, jamais tapée) | `nonProd` | total − productif |
| **Trajet (h)** | `trajet` | à part, hors chantier |

- **Le total ne se stocke pas** : il se déduit du productif et du hors
  production. Stocker les trois aurait fait deux endroits pour une même idée.
- **Le trajet est additionnel** : le total est « trajet non compris », et
  l'aperçu donne la journée entière — *9,50 h : 7 h productives · 1 h hors
  production · 1,50 h de trajet* — pour qu'une mauvaise lecture se voie tout
  de suite.
- **Un total plus court que le productif ne s'enregistre pas** : l'un des deux
  est mal tapé, et deviner lequel fausserait les rendements.
- **Le trajet et le hors production entrent ensemble dans le chantier**, en une
  saisie sans activité : ils comptent dans la journée facturée, jamais dans un
  rendement. `heuresJournee()` compte le trajet ; `retirerSaisie()` retire les
  deux.
- **Les journées d'avant la 4.83 portent leur trajet dans `nonProd`** : il y
  était mêlé au temps mort. Rien n'a été réécrit — rien ne permet de séparer
  sûrement l'un de l'autre. À la réouverture, leur total inclut ce trajet.

**La case « Journée non facturée » est partie** : *« ça sert plus à rien »*,
dit deux fois. Une journée déjà marquée **garde sa marque** et l'aperçu la
signale : sans case pour la voir, l'effacer en silence changerait ses
rendements. `nonFacture` reste au vocabulaire.

## Ma journée doit se remplir toute seule

*« En fin de journée je suis crevé, j’ai la flemme d’aller chercher des
infos. Il faut que ce soit le plus efficace possible. »*

- **Un chantier facturé ne reçoit plus de journée** : il sort du sélecteur.
  *« Une fois que c’est facturé, j’ai fini mes journées. »* **Deux
  exceptions** : celui qu’on est en train de corriger, sinon son propre
  chantier disparaîtrait ; et celui qui est **posé sur ce jour-là**, depuis la
  4.75 — c’est l’agenda qui dit qu’il a lieu d’y être.
- Le reste est rangé par **dernier jour travaillé**, pas par `maj` : ouvrir
  une fiche pour la relire ne doit pas la faire remonter.
- **Choisir le chantier remplit ce qu’il sait** : forêt, commune, et un poste
  par prestation du chantier — sans heures. **Jamais par-dessus ce qui est
  déjà tapé.** Le code visait `c.lieu`, un champ qui n’existe pas : le
  chantier porte `foret`. La reprise ne marchait donc jamais.
- **Les fournitures n’ouvrent pas de poste** : elles n’ont pas d’option dans
  ce sélecteur, la ligne ressortirait vide. Le scénario le vérifie sur le
  **nombre de lignes**, pas sur les valeurs — une comparaison de valeurs ne
  voyait rien.

**`kmHabituels()` répond à une demande impossible.** *« Est-ce qu’il n’y aurait
pas un moyen de mettre deux communes et que ça estime les kilomètres ? »*
Pas sans calcul d’itinéraire, et l’application n’en fait pas. Mais elle a sa
propre mémoire : c’est la même route à chaque
fois, donc on propose ce qui a été noté la dernière fois pour ce chantier-là.
À défaut, les kilomètres d’un temps saisi sur sa fiche.

## La journée qui passe sans être notée

*« Imaginons que j’enregistre, je me dis aujourd’hui je vais travailler à tel
endroit. Le jour passe, et je ne remplis pas ma journée. Qu’est-ce qui se
passe ? »* Rien — et c’était le problème. La journée posée restait là, aucun
temps n’était noté, les rendements se vidaient en silence, et le chantier
finissait par s’annoncer **« en retard »** sans qu’il sache pourquoi.

*« Il faudrait me forcer la main quand la journée est finie. Sinon je me dis :
ok, je le ferai plus tard, et après je ne le fais pas et j’oublie. »*

`journeesANoter()` liste les journées **posées, passées, et sans aucun temps
noté ce jour-là**. Trois exclusions comptent, et chacune a son sabotage :

- **le jour même n’est pas fini** : on ne réclame rien avant demain ;
- **une journée déjà notée** ne revient pas ;
- un chantier au stade du devis n’a rien à noter.

Le rappel vit sur l’accueil (`#a-journees`), **au-dessus** des échéances et des
devis : un jour non noté est perdu pour toujours, les deux autres attendent.
Il **ouvre la saisie du temps avec sa date déjà posée** — c’est le geste qu’il
demandait, pas un renvoi vers un écran où il faudrait retrouver le jour. Comme
les deux autres, il se chasse d’un doigt jusqu’au prochain lancement, et le
chasser n’efface rien.

**`enRetard()` ne s’appelle plus « en retard » à l’écran.** Il ne parle pas
d’une échéance manquée : il dit que **toutes les journées posées sont
derrière** et que le chantier n’est pas soldé. Le mot l’a induit en erreur
deux fois ; il dit désormais « jours passés ». Voir *« En retard » ne se
disait pas d’un chantier*.

## Un jour, un statut, une pastille

*« Une case-jour peut porter plusieurs statuts en même temps, plusieurs
pastilles superposées sur le même jour, ce qui n’a pas de sens. »* La case en
empilait jusqu’à trois : un chantier provisoire, un chantier ferme et du
temps saisi pouvaient s’y superposer.

Cinq statuts, dans cet ordre de priorité :

| Statut | D’où il vient |
|---|---|
| **Travaillé** | du temps saisi ce jour-là |
| **Non travaillé** | `A.cfg.absences` — la seule pièce nouvelle |
| **Confirmé** | un jour posé sur un chantier engagé (`fermeteDe`) |
| **Prévu** | un jour posé sur un devis encore en attente |
| **Libre** | rien de posé |

**Le statut ne se stocke pas, il se déduit.** Un statut écrit en base aurait
fait deux endroits pour une même idée, qu’il aurait fallu tenir d’accord —
l’erreur que ce projet a déjà payée plusieurs fois. **Conséquence directe :
aucune migration.** La demande en prévoyait une ; les données existantes
rendent leur statut telles quelles, il n’y a rien à réécrire et donc rien à
risquer.

**Un jour peut toujours porter deux chantiers** — une demi-journée de chaque
côté, le projet le défend depuis longtemps. C’est le *statut* qui est unique,
pas le contenu : la fiche du jour liste tout ce qui s’y rattache.

**L’absence l’emporte sur le planning, jamais sur ce qui a eu lieu.** Marquer
un jour non travaillé est un geste délibéré ; s’il reste un chantier posé ce
jour-là, la fiche du jour le montre et propose de le retirer.

## Le temps ne se stocke pas deux fois

**Le défaut derrière trois de ses symptômes du 6 septembre.** `c.temps`
n’est pas une donnée : c’est une **lecture** de `A.journees`, que
`indexerJournees()` refait de zéro à chaque ouverture et à chaque
modification de journée. Or trois endroits y écrivaient ou y supprimaient
directement :

- **« + Temps » de la fiche poussait dans `c.temps`.** La saisie tenait
  jusqu’à la prochaine indexation, puis **disparaissait sans bruit**. D’où des
  jours qu’il avait faits et qui ne comptaient pas dans les rendements — et
  un chantier qui finissait « en retard » sans qu’il sache pourquoi. Elle
  crée maintenant une **journée**.
- **Les deux croix filtraient `c.temps` par date.** Deux saisies d’un même
  jour portent la même : *« j’avais mis sept heures et deux heures, ça a
  supprimé les deux »*. Et de toute façon elles revenaient à l’indexation
  suivante. `retirerSaisie()` ôte le **poste de journée** qui les produit, et
  la journée elle-même s’il n’en reste rien.

**Règle : on n’écrit jamais dans une liste dérivée, et on n’y supprime
jamais rien.** Le commentaire d’`indexerJournees` le disait déjà — « le temps
porté par chaque chantier n’est qu’une lecture des journées » — mais rien ne
l’empêchait, et trois endroits l’ont fait.

**Et un second formulaire de saisie a disparu.** `ouvrirSaisieJour()` — le
bouton « J’ai travaillé » du bas du calendrier — ouvrait un autre écran que
la fiche du jour, avec son propre `#sj-unite` journées/heures qu’on croyait
retiré partout. *« Je n’ai pas la même chose qui s’ouvre. »* Le bouton ouvre
désormais la fiche du jour ; les 77 lignes de l’autre sont parties.

## Fait ou prévu, jamais les deux

*« Ce que j’ai fait, il est forcément prévu. C’est soit une journée prévue,
soit elle est faite, pas les deux en même temps, sinon ça se mélange. »* La
fiche du jour listait le chantier une fois dans « ce que vous y avez fait »
et une seconde dans « également posé ce jour-là ». Un chantier dont le temps
est noté ce jour-là ne reparaît plus comme en attente ; l’intitulé du bloc
restant dit **« posé ce jour-là, sans temps noté »**.

## Le rappel entre aussi dans le calendrier

Sa spécification disait *« à l’ouverture de l’app **ou à l’accès au
calendrier** »*. Seul le premier avait été fait, et c’est dans le calendrier
qu’il passe son temps — où un jour non tranché porte la même pastille qu’un
jour à venir. `#cal-trancher` l’annonce en tête de l’agenda et ouvre les
trois issues.

**Vérifié avant de corriger** : une sonde a montré que le rappel de l’accueil
fonctionne. Le manque était bien celui du second endroit, pas une panne du
premier — chercher la panne aurait coûté une soirée pour rien.

**Les pastilles font neuf pixels**, avec un cerne clair : *« la différence
entre le vert et le bleu n’est pas flagrante, surtout qu’elles sont
petites »*. Cinq pixels au soleil, avec des mains sales.

## La fiche du jour, et l’écran qui force à trancher

*« Aujourd’hui la saisie ne se fait que depuis la fiche chantier ; il faut
pouvoir le faire aussi depuis le calendrier. »* Cliquer un jour ouvre
`ouvrirFicheJour()` : son statut, ce qui s’y rattache, et de quoi le changer.

- **« Travaillé » ne se coche pas**, il se saisit : le bouton ouvre « Ma
  journée » à cette date, et c’est elle qui porte le chantier, les prestations
  et le temps.
- **Corriger après coup n’a pas de fonction à part.** Prévu jeudi, fait
  mercredi : on ouvre mercredi, on y note sa journée, et on retire le chantier
  de jeudi depuis la fiche de jeudi. C’est la même fiche.
- **`joursAResoudre()`** liste les jours prévus ou confirmés que la date a
  dépassés. Le rappel de l’accueil — qui ne proposait qu’une issue depuis la
  4.68 — ouvre maintenant `ouvrirResolutionJour()` : **j’y ai travaillé**,
  **c’était un autre jour**, **je n’y étais pas**. Il se chasse toujours d’un
  doigt : forcer sans échappatoire, c’est se faire ignorer.

**Deux gardes qui se couvraient l’une l’autre.** La fenêtre de
`joursAResoudre` s’arrêtait la veille *et* une condition écartait ensuite tout
ce qui n’était pas passé. Casser l’une laissait l’autre tenir : aucune
n’était éprouvable. Il n’en reste qu’une, porteuse. **Une garde redondante
qu’aucun sabotage n’atteint est du poids mort, pas de la sécurité.**

**Et un défaut latent révélé au passage.** `jourIso()` répondait par
`toISOString()`, donc en heure de Greenwich : minuit à Paris y est 22 h la
veille. Les dates de l’application passent d’ordinaire par midi, ce qui
masquait le défaut ; la fiche du jour travaille en minuit et l’a fait sortir.
Elle passe par `C.jourCle`, comme `versChamp` depuis la 4.x.

## Valider une journée d'un seul geste

*« Il faudrait juste un endroit où je puisse dire : valider, c'est bon j'ai
travaillé, ça l'enregistre. Comme ça je ne me pose pas de questions. J'ai
prévu une journée et j'ai fait une journée, je peux juste enregistrer. C'est
rapide et c'est efficace. »*

Le cas courant est celui-là : posé, fait, comme prévu. Ouvrir « Ma journée »
pour retaper ce que l'agenda sait déjà, c'est cinq gestes pour une information
nulle. `validerCommePrevu(ts, prevus)` crée **une journée par chantier posé**,
avec les heures de l'agenda et les prestations du chantier en postes, à parts
égales — c'est ce qu'il aurait tapé, et il corrigera si ce n'était pas ça.

- **Deux portes, un seul geste** : `#fj-prevu` sur la fiche du jour et
  `#rj-prevu` sur l'écran qui force à trancher. Ce qui n'était pas prévu garde
  l'ancien chemin, renommé — *« Autre chose »*, *« J'y ai travaillé, mais
  autrement »* — qui ouvre la saisie complète.
- **Le bouton annonce ce qu'il va écrire** : *« C'était comme prévu — 1 j »*.
  Valider un chiffre qu'on ne voit pas ne serait pas une validation. Et la
  ligne du jour dit enfin *« 1 j prévues »* : il avait relevé que la fiche du
  jour ne montrait pas ce qui était posé.
- **Une demi-journée posée vaut une demi-journée faite.** Le geste reprend la
  part de l'agenda, il n'invente pas la journée entière.
- **Sans prestation au chantier**, les heures entrent en temps non productif :
  elles comptent dans la journée, jamais dans un rendement.
- Les kilomètres suivent par `kmHabituels()`, comme dans « Ma journée » :
  c'est la même route.

**Et une garde qui n'était pas éprouvable telle qu'elle était écrite.** Le
geste ne s'offre que si **rien n'est encore noté ce jour-là**. Le premier
scénario semait un jour dont *tout* était noté — mais un tel jour n'a plus
rien « en attente », donc l'autre condition le retenait déjà, et casser la
première ne faisait rien crier. Le cas qui compte est celui du **jour à moitié
noté** : sept heures sur un chantier, un second posé sans temps. Sans la
garde, un doigt y ajouterait quatre heures et la journée passerait à onze sans
rien dire.

C'est la troisième fois que ce projet rencontre deux gardes qui se couvrent
l'une l'autre. **Le sabotage ne suffit pas : il faut aussi que le scénario
place le cas où une seule des deux tient.**

## Reprendre copie ce qu'on a fait, jamais quand

*« Quand je fais reprendre, ça me le remet sur le même jour. Depuis tout à
l'heure je remets des jours sur le 4. »*

Le bouton passait la journée modèle **en entier, sa date comprise** :
`ouvrirJournee(null, dj)`, et le formulaire lisait `modele.date`. Ouvrir le 8
dans le calendrier, reprendre la journée du 4, et la nouvelle journée
retombait le 4. Il en a reposé plusieurs avant de comprendre.

Le jour reste celui qu'on a choisi ; seul le contenu se copie — chantier,
lieu, kilomètres, prestations. Les heures, non : c'est ce qu'on vient noter.

**Et le libellé mentait avec.** « Reprendre 04/09 » se lit comme « aller au
04/09 ». C'est **« Comme le 04/09 — Les Essarts »** : le mot dit qu'on copie,
pas qu'on se déplace.

**Un chantier posé ce jour-là reste sélectionnable, même payé.** *« Sur une
journée déjà facturée, je ne peux plus la sélectionner : dans mes choix, j'ai
uniquement ce qui est ouvert. »* La règle tient — un chantier facturé ne
reçoit plus de journée — mais elle avait déjà son exception : celui qu'on est
en train de corriger. Un chantier **posé sur ce jour précis** est le même cas,
c'est l'agenda qui dit qu'il a lieu d'y être. Un chantier clos qui n'y est pas
posé reste écarté.

## Quarante-sept journées d'un seul geste

*« Toutes les journées posées au calendrier, il faudrait que ce soit compté
comme fait. Je considère que si j'y ai travaillé, et puis voilà. Comme un
prompt que tu lances une fois, et après il s'oublie. Je ne veux pas que ce
soit quelque chose qui soit entré dans le code. »*

**Ce qui a été expliqué, et pourquoi le résultat est proche de ce qu'il
voulait** : ses données vivent sur son téléphone, pas ici — aucun script ne
peut les atteindre depuis ce poste. Le geste doit donc vivre dans
l'application. Mais il **s'efface de lui-même** : le bouton n'apparaît que
lorsqu'il reste plusieurs journées à trancher, et une fois pressé il n'en
reste aucune. C'est l'équivalent le plus proche d'un script à usage unique.

`validerCommePrevu()` a été coupée en deux : **`poserJourneesPrevues()`** pose
sans enregistrer, `validerCommePrevu()` pose puis enregistre, et
**`validerTousLesJoursPrevus()`** pose tout et n'enregistre **qu'une fois**.
Quarante-sept jours, c'était quarante-sept écritures.

- **Le geste se confirme**, et la question dit ce qu'elle va écrire : les
  heures de l'agenda et les prestations de chaque chantier. Un refus n'écrit
  rien — un scénario le vérifie, et le sabotage passe par `if (false && …)`,
  parce que retirer le `return` seul ne compile pas.
- **La part de l'agenda est respectée** : une demi-journée posée reste une
  demi-journée faite. Le geste d'ensemble ne fait pas mieux que le geste
  unitaire, il le répète.

## Les frais fixes tombent sur leur jour

*« Ce serait bien de pouvoir mettre dans le calendrier les frais fixes que
j'ai. Comme ça je vois quand ça apparaît et quand ça arrive. »*

**Une échéance n'est pas un statut de journée.** Un jour en porte exactement
un — c'est la décision de la 4.71 et elle ne se rouvre pas. Le prélèvement se
pose donc **à côté** : un « € » discret dans l'angle de la case, qui nomme la
charge et son montant au survol, et le détail dans la fiche du jour.

- **`prelevementsDuMois(an, mo)`** range les échéances par jour ;
  `prelevementsDuJour(ts)` sert la fiche, qui ne sait pas de quel mois elle
  relève.
- **Rien ne contourne les bornes d'`echeances()`** : une charge arrêtée ou pas
  encore souscrite ne tombe pas sur le calendrier. Le sabotage force
  `arretee: false` et `debut: null` — sans la garde, un contrat résilié
  continuerait de se prélever à l'écran.
- **Un jour qui ne porte qu'un prélèvement n'est plus dit vide.** La phrase
  « Rien de posé ni de noté ce jour-là » comptait les chantiers et l'absence,
  pas les charges.

## Ce qui reste à planifier, chantier par chantier

*« J'ai besoin de pouvoir dire : ok, j'ai trois chantiers à planifier, sur tel
chantier j'ai estimé deux jours, l'autre trois, l'autre un. Là je sais que
j'ai douze jours à planifier, mais ces chantiers… »* La bulle donnait le total ;
**`#cal-aplanifier`**, en tête du calendrier, dit de quoi il est fait (4.84).

- **Les mêmes chantiers que la bulle** (`devis`, `envoye`, `accepte`,
  `encours` avec un reste à placer), **plus les engagés sans estimation**,
  marqués « à estimer » : c'est justement celui qu'on oublie, et son bouton
  ouvre la fiche.
- **Les engagés d'abord**, un devis sans réponse ensuite, marqué comme tel.
- **« Placer » ouvre le placement** du chantier (`A.planifie`), et la liste
  s'efface le temps de placer : le bandeau du chantier prend la place.

**Deux sabotages n'ont d'abord rien dit sur ce lot**, et c'est encore le
scénario qu'il a fallu corriger, pas le code : la carte ouverte « sur le
chantier » était déjà centrée sur lui — c'était le seul placé ; et les
familles « tout en bas » l'étaient d'office sans chantier clos. Un second
chantier placé loin, un chantier payé, et les gardes ont crié.

## Il ne planifie qu’une semaine ou deux à l’avance

*« Je ne vais pas prévoir tout le chantier d’un coup : je pose un ou deux
jours, j’ai une vision par rapport à la semaine, deux semaines. Après, passé
un mois, ça peut être compliqué. »*

C’est une contrainte de méthode, pas un oubli, et `enRetard()` l’ignorait :
il disait « toutes les journées posées sont derrière ». Sur cette façon de
travailler, c’est vrai **dès le premier jour fait** — il pose un jour sur
trois, il le fait, et le lendemain le chantier s’annonce en retard alors
qu’il reste deux journées à poser.

**S’il reste des journées à poser (`resteAPlacer() > 0`), il n’y a rien à
signaler** : c’est la planification qui n’est pas finie, pas le chantier qui
traîne. Sans estimation d’aucune sorte, `resteAPlacer()` rend `null` et on
retombe sur la règle d’avant — sinon un chantier oublié ne se signalerait
plus jamais.

**Le prix par journée souffrait du même biais**, et il est corrigé depuis la
4.78 : il ne se lit qu’une fois le chantier soldé. Voir *Le prix de journée
ne se lit qu’à la fin*.

## « En retard » ne se disait pas d'un chantier

Le mot l'a trompé deux fois, et ce fichier le signalait depuis trois versions
sans que rien ne bouge. `enRetard()` ne parle d'aucune échéance manquée : il
dit que **toutes les journées posées sont derrière et que le chantier n'est
pas soldé**. Le badge dit donc **« jours passés »**, et le compte du carnet
« 3 aux jours passés ».

**Un vrai retard existe pourtant** — celui d'une facture dont l'échéance est
dépassée (`retardPaiement`) — et lui garde son mot. Les deux se ressemblaient
à l'écran, ce qui achevait la confusion. Un scénario tient les deux ensemble :
il criera le jour où l'on renommera les deux d'un coup.

**Et un défaut trouvé en corrigeant le mot** : l'alerte annonçait « en retard
depuis le **Invalid Date** ». Elle lisait `ch.fin`, l'échéance de chantier
retirée depuis longtemps. Elle date maintenant la dernière journée posée.
