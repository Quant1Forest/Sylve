# Design, navigation et réglages

Palette, écran Entreprise, modules, réglages, typographie, marque, notes de mise à jour, retour arrière.

## Où en est le design

Terminé :

- Palette crème calée sur le logo (`--papier: #F4EDE2`).
- Logo sur l'accueil et sur le bouton de retour du bandeau, nulle part ailleurs.
- Bandeau vert foncé, filet brun de la marque. Le bleu en a été retiré.
- Pictogrammes au trait partout : pastilles sombres pleines sur l'accueil,
  ronds fins au second niveau, et les 33 onglets du bas.
- `PICTOS` est indexé sur l'identifiant de vue, pas sur le module : une même
  notion porte donc le même dessin partout. Deux vérifications le garantissent.
- Le bandeau est redevenu de la navigation pure. Les actions qui doublonnaient
  avec un bouton de page en ont été retirées.
- **Le bleu `--accent: #1F5FA9` est validé et conservé.** Question tranchée le
  3 août 2026 : il tient bien avec le crème et le vert, il rend les boutons
  principaux lisibles, et il apporte la seule couleur vive de l'interface. Ne
  plus rouvrir le sujet.

Restent ouverts :

- **Les réglages vivent dans le bandeau**, plus dans les onglets du bas. Ils y
  étaient répétés neuf fois, à une place différente selon le module, et
  mangeaient un onglet là où il n'y en a que deux. Le bouton ouvre la section
  correspondant à la partie courante.
- **Trois actions restent dans le bandeau** faute d'équivalent dans leur page :
  *Estimer* (seul accès à l'écran d'estimation — le retirer bloquerait
  dehors), *Aujourd'hui*, *En-tête*. À déplacer dans leur page avant de les
  retirer du haut.
- **L'icône Apple** déclarée dans `index.html` est la marque détourée. iOS ne
  gère pas la transparence sur l'écran d'accueil et la remplit en noir.
  Basculer sur la version crème le jour où un iPhone entre dans le tableau.

Fait en 4.21.0 :

- **Écran de démarrage.** Fond crème, logo, nom, filet brun, puis
  *« Gestion et terrain, à portée de main »*. Il entre net et sort en fondu :
  Android affiche déjà le même crème à partir de `background_color`, la
  jointure entre son écran et le nôtre ne doit pas se voir. Au **démarrage à
  froid seulement** — `sessionStorage` fait la frontière — et un appui
  n'importe où le fait sauter.
- La durée se règle dans **Réglages ▸ Général ▸ Application**, curseur de 0 à
  3 s par pas de 0,2. Zéro le supprime. Le réglage vit dans
  `A.cfg.demarrageDuree`, donc il part dans les sauvegardes.
- Le bloc vit **hors de `#app`**, avec son propre `<script>` : il doit
  s'afficher avant que l'application ait fini de charger et s'effacer même si
  elle échoue. Il lit donc la durée en synchrone dans le miroir
  `localStorage`, sans attendre que la configuration soit relue — sinon
  l'écran clignoterait, ou s'afficherait alors qu'il est réglé sur « aucun ».

## L'écran Entreprise : bulles, tuiles, puis ses notes

*Retiré au lot 5b (4.87.0) : bulles, tuiles et notes ont leur nouvel endroit
(voir « L'écran Aujourd'hui », en bas). Ce qui suit est l'histoire.*

**Depuis la 4.82 : bulles, tuiles, puis « Mes notes ».** *« Quand j'arrive,
j'ai directement tous mes onglets, je ne suis pas obligé de défiler. Et il y a
la même partie À traiter dans le carnet. »* « À traiter » a quitté l'écran ;
celui du carnet porte désormais le montant de chaque alerte, qui ne vivait
qu'ici. Ce qui suit décrit l'état d'avant, et reste vrai pour les bulles.

**Une bulle qui ne compte qu'un chantier ouvre sa fiche** (4.83) : *« les
bulles qui mènent droit à la fiche »*. Une liste d'un seul chantier, c'est un
appui de plus pour rien. Le raccourci compte par statut, exactement comme la
bulle — sinon il ouvrirait une fiche quand la bulle en annonce deux.

**Une note va à la ligne** (`<textarea>`, `white-space: pre-line` sur
`.note-texte`) : *« j'ai ce chantier, ce chantier, ce chantier »* s'écrit en
liste. La règle CSS vise une **classe seule** : JSDOM ne résout pas un
sélecteur descendant dans `getComputedStyle`, et le scénario lit le style
calculé.

Le regroupement des sept tuiles en trois titres a été **écarté** après
maquette : un appui de plus à chaque navigation, pour toujours, et la barre
d'onglets du bas — rangée par module — n'aurait plus su quoi faire d'un titre
qui en regroupe quatre. Ce que l'utilisateur cherchait était l'**état des
lieux**, pas moins de routes.

`#ent-bilan` porte donc six bulles, **au-dessus** des tuiles : journées à
planifier, devis signés, chantiers en cours, impayés, chiffre d'affaires,
TVA déductible. Un seul chiffre par bulle — deux nombres côte à côte et on ne
sait plus lequel on lit. Chacune mène à la liste qui la détaille.

`#ent-alertes` garde les trois alertes qui portent un nom de chantier — en
retard, à facturer, impayé — puis les **notes que l'utilisateur s'écrit**
(`A.cfg.notes` : titre, précision, couleur choisie parmi six). Elles vivent
dans la configuration parce qu'elle part dans les sauvegardes.

**La bulle et l'alerte ne font pas doublon** : la bulle donne le compte et le
montant, l'alerte dit lequel et depuis quand. C'est précisément ce qu'on veut
savoir d'un impayé — l'avoir retiré une première fois était une erreur, le
scénario de navigation l'a rattrapée.

**Un module qui n'a qu'une vue n'affiche pas d'onglet** (`sans-onglets`) : un
onglet unique étiré sur la largeur ne propose rien. Analyses est le seul cas.

## Cinq modules, plus sept

Deux des sept « modules » de la partie Entreprise n'en étaient pas. Le test
qui les a désignés est simple et se rejoue : **un module dont toutes les vues
appartiennent à d'autres modules est une entrée de menu déguisée.**

- **« Devis et estimatif » a été supprimé** en 4.38. Son onglet *Estimer*
  était celui des Rendements, son onglet *Devis* le carnet des Chantiers. Le
  devis vit désormais sur la fiche du chantier, ce qui achevait de le vider
  de son objet. Rien n'a été perdu : `estimer` est le second onglet des
  Rendements.
- **« Analyses » est devenue le quatrième onglet de Finances.** Les deux
  écrans lisaient les mêmes données — chantiers et dépenses — sur la même
  période. Ils portaient même deux jeux de sélecteurs distincts (`fi-*` et
  `an-*`) qui écrivaient déjà tous les deux dans `A.periode` : la fusion n'a
  donc rien eu à réconcilier.
- **« Recettes » existait déjà**, en pastille dans Analyses à côté de « Vue
  d'ensemble » et « Dépenses ». Ne pas en créer un second : le manque
  ressenti était un problème de visibilité, pas d'absence.

**Deux nettoyages en ont découlé, et c'est le signe que la fusion était
juste :**

- L'action *Estimer* du bandeau n'avait plus lieu d'être — elle était là
  parce que c'était « le seul accès à l'écran d'estimation ». Ce n'est plus
  vrai. Il ne reste que *Aujourd'hui* et *En-tête*.
- La garde `sans-onglets` de la 4.37 a été **retirée** : Analyses était son
  seul cas. Un scénario vérifie maintenant qu'aucun module ne se réduit à un
  onglet solitaire — il criera le jour où l'un réapparaîtra.

**Un téléphone déjà installé garde en mémoire le module ouvert.**
`MODULES_RETIRES` redirige `devis` vers Rendements et `analyses` vers
Finances, et réécrit la valeur au démarrage. Sans ça, l'application se
rouvrait dans le cubage, à l'autre bout.

**Les réglages ne sont pas un étage de la navigation.** C'est une vue, et le
retour du bandeau lisait le module courant : on ressortait des réglages dans
« Mon entreprise », jamais sur l'écran quitté. Jusqu'en 4.85, `aller()`
retenait `A.vueAvantReglages` et `allerMenuParent()` y redescendait. Depuis
le lot 5a, les réglages sont un écran « libre » et suivent la pile du cadre
(voir *Le cadre du lot 5a*, en bas).

## Le rangement des réglages

« J'ai du mal à savoir où va quoi » avait deux causes, et aucune n'était le
nombre d'onglets.

1. **Une carte intitulée « Chantiers » tenait quatre sujets sans lien** : la
   journée de travail, le véhicule, les relances, les week-ends. Rien ne
   disait que la consommation du fourgon se réglait sous « Chantiers ». Elle
   est éclatée en trois zones titrées — *Ma journée de travail*, *Véhicule*,
   *Relances et calendrier*.
2. **Le bouton du bandeau ne choisissait que l'onglet, jamais la zone.**
   Depuis Finances, il déposait au sommet d'un onglet Entreprise qui déroule
   sept zones, et dont la première parlait des heures de travail.
   `SEC_DE_MODULE` porte maintenant une zone par module, et
   `versZoneReglages()` y descend.

| On vient de | On arrive sur |
|---|---|
| Chantiers, Rendements | Ma journée de travail |
| Calendrier | Relances et calendrier |
| Finances | Financier |
| Stock et fournitures | Stock et fournitures |
| Cubage, Bois | leur propre onglet |

**Pas de second niveau d'onglets.** Décision ancienne, toujours valable : un
onglet déroule ses zones sous leurs titres, et on lit en descendant plutôt
que de chercher où cliquer. Un scénario le garde (`#regl-sous` doit rester
introuvable). C'est pour ça que la réponse a été de nommer les zones et de
viser juste, pas d'ajouter des sous-onglets.

**Le défilement se teste en espionnant `scrollIntoView`.** Le banc d'essai le
neutralise au démarrage ; un scénario le remplace par un mouchard et lit quel
élément l'a reçu. Sans ça, « le bouton descend au bon endroit » n'était pas
vérifiable.

## Deux détails de typographie qui comptent

- **Espace insécable devant l'unité.** `eur()` et `eurCourt()` collent le
  « € » au nombre par un U+00A0 : avec une espace ordinaire, une tuile étroite
  coupait la ligne et le symbole tombait seul en dessous. Un test l'épingle —
  attention, une regex avec une espace ordinaire ne matche plus.
- **`fmt()` groupe les milliers** par une espace insécable depuis la 4.37 :
  « 1 800 € », plus « 1800 € ». Trois conséquences à connaître :
  - **`fmtBrut()` existe pour les fichiers.** Les deux exports CSV
    (`lignesStock`, `exportCsv`) y passent : une espace au milieu d'un nombre
    et la cellule cesse d'être un nombre pour le tableur.
  - **Les quatre `nb()` retirent les espaces** avant d'analyser. Sans ça, un
    montant formaté relu dans un champ de saisie — `#hy-ben` le fait —
    donnait 25 pour « 25 000 ».
  - **`t.texte()` des tests replie tous les blancs** sur une espace ordinaire :
    une attente lue par cette porte s'écrit avec une espace ordinaire, alors
    qu'une attente lue sur `textContent` brut garde l'insécable. Deux heures
    perdues sur un « attendu 1 000 € / obtenu 1 000 € » qui se lisaient pareil.

## Sa marque, et le nom qu'on a retiré

**L'application ne s'appelle plus que Sylve.** Toute référence à celle dont
elle est partie — le tableur de cubage de l'ONF — a été retirée de l'écran
**et des commentaires** en 4.44 : elle l'a inspiré au début, il s'en est
complètement écarté depuis. Le mode de calcul s'appelle « Historique », et
son explication parle de « vos anciens bordereaux ».

**Les clés `bordcub.*` et le nom de la base IndexedDB ne changeront jamais.**
Les renommer ferait chercher les données dans un tiroir vide : chantiers,
dépenses, stock, tout serait perdu. Ce nom n'apparaît nulle part à l'écran,
et un scénario le vérifie — en écartant le source des `<script>`, car
`body.textContent` l'embarque et ferait croire à une fuite.

**Son logo et le nom de son entreprise** vivent dans `A.cfg.logoEntreprise`
et `A.cfg.nomEntreprise`, donc ils partent dans les sauvegardes. Deux
endroits seulement, choisis par lui sur maquette :

- l'écran **Mon entreprise**, où le nom remplace l'intitulé ;
- l'**écran de démarrage**, en signature discrète sous la phrase de l'outil.
  Variante retenue : *Sylve d'abord, lui ensuite*. L'accueil général garde la
  marque de l'outil — les mélanger brouillerait les deux.

**L'image est réduite à 256 px avant d'être gardée** (`reduireImage`), en
PNG pour préserver la transparence d'un logo. Une photo de téléphone non
réduite pèserait plusieurs mégaoctets dans le stockage local, qui n'est pas
extensible — et elle partirait telle quelle dans chaque sauvegarde.

**La signature du démarrage se lit en synchrone**, comme la durée : ajoutée
après coup elle apparaîtrait en cours d'animation.

## Les notes de mise à jour

`NOTES_MAJ` porte les **cinq dernières** versions, en clair, dans Réglages ▸
Général. Au-delà de cinq on ne remonte plus, et la liste devient un journal
qu'on ne lit pas.

**Elles s'écrivent à la main à chaque livraison.** Une liste engendrée depuis
les commits dirait « corrections diverses », ce qui n'apprend rien. Trois à
quatre lignes par version, dans ses mots à lui, pas dans le vocabulaire du
code.

Une ligne qui porte `vue` devient cliquable et mène à l'écran concerné —
c'est ce qu'il demandait : « me donner accès aux endroits où il y a des
modifications ». **Ne pas oublier d'ajouter la nouvelle version en tête à
chaque envoi**, et de retirer la sixième.

## Le vert, et la couleur qui ne bouge plus

« Des fois c'est bleu, des fois c'est vert, et je ne comprends pas pourquoi. »
`appliquerCouleur()` repeignait toute l'application avec la couleur des
**plaquettes du bordereau de cubage ouvert**. Elle ne touche plus qu'à
`--plaq`, qui ne peint que la pastille du bordereau et les plaquettes du
ruban de saisie.

- **L'accent est le vert vif `#2E7D46`**, choisi sur maquette le 23 août.
  Le bleu avait été validé le 3 août et ce fichier disait de ne plus rouvrir le
  sujet : **c'est lui qui l'a rouvert**, et c'est sa décision.
- **Le nom `Sylve` de l'écran de démarrage garde `--vert-marque`.** Il l'a
  demandé expressément ; `.dem-nom` le faisait déjà, un scénario le garantit.

## Le pourcentage se colle, comme l’euro

*« Le logo pourcentage va à la ligne parce que le chiffre est trop gros, et
les logos euros touchent presque les chiffres. »* Deux causes distinctes :

- **Le « % » était séparé par une espace ordinaire**, donc sécable. `eur()`
  pose une insécable devant le « € » depuis longtemps, pour exactement cette
  raison ; le pourcentage l’avait oublié. Cent huit espaces converties.
  **Corollaire connu : une regex écrite avec une espace ordinaire ne matche
  plus.** C’est le piège jumeau de celui de l’euro, et il a fait rougir un
  scénario d’analyses.
- **Les nombres tenaient en 19 px dans des tuiles de 96 px.** Un montant à six
  chiffres n’y entre pas. Tuiles à 102 px, chiffre à 17 px, et `white-space: nowrap` :
  mieux vaut une tuile qui s’étire qu’un « € » tout seul en dessous.

## Garder l'écran allumé — le téléphone garde le dernier mot

*« Est-ce que tu penses qu'il y aurait moyen que ça ne mette pas le mode
veille du téléphone ? Sauf que moi j'ai un mode Stamina qui économise la
batterie. »*

`navigator.wakeLock` est une **demande, pas un ordre**. Trois conséquences,
et l'écran les dit toutes les trois plutôt que de laisser deviner :

- un mode d'économie de batterie — Stamina et ses cousins — peut refuser ;
- le système relâche **de lui-même** dès que la page passe en arrière-plan ou
  que l'écran se verrouille. Sans quoi n'importe quel site viderait la
  batterie. Revenir sur l'application redemande : la demande d'avant est
  perdue ;
- un navigateur qui ne sait pas faire ferme la case. **Une case qu'on peut
  cocher sans effet est pire que pas de case.**

`A.cfg.ecranAllume` — un **réglage**, jamais un comportement imposé : ça vide
la batterie, et c'est son téléphone.

**Le message compte autant que la fonction.** *« Le téléphone a accepté »* ou
*« Demandé, mais le téléphone n'a pas suivi — un mode d'économie peut
refuser »*. Sans lui, il n'aurait jamais su dans quel cas il se trouve, et il
aurait cherché la panne dans Sylve.

**Deux gardes qui se couvraient, encore.** `demanderVeille()` relâche déjà
quand la page est cachée ; le gestionnaire de `visibilitychange` le refaisait.
Casser l'une laissait l'autre tenir. Il n'en reste qu'une, et le sabotage
l'atteint. **Quatrième fois que ce motif apparaît** — le réflexe à prendre :
après avoir écrit une garde, chercher qui d'autre dit déjà la même chose.

**Et le banc d'essai a gagné un crochet.** `ouvrir(graines, { avant })` pose ce
que JSDOM n'a pas — un écran, un capteur — **avant** que l'application démarre.
Sans lui, rien de ce qui se branche au lancement n'était testable : poser le
faux après coup, c'est le poser trop tard.

## Le retour arrière remonte d'un cran (jusqu'en 4.85)

Le bouton du téléphone quittait Sylve d'un coup, même au fond d'un module.
`brancherRetourTelephone()` écoute `popstate` : une fenêtre ouverte se ferme
d'abord, sinon module → partie → accueil, et depuis l'accueil seulement il
sort.

- **Un cran est empilé à la descente, consommé par la remontée.** C'est ce qui
  donne **un** appui par étage. Ne jamais réempiler après une remontée : le
  dernier appui ne sortirait plus de l'application.
- **Fermer une fenêtre en réempile un**, sinon on perdrait un étage au passage.
- **Un changement de module par le bandeau est latéral**, pas une descente :
  `allerModule()` n'empile que si l'on vient de l'accueil ou du menu d'une
  partie. Sans cette garde, les crans s'accumulent et il faut plusieurs appuis
  pour sortir.
- **`allerMenuParent()` ne sait pas remonter du menu d'une partie vers
  l'accueil** : il lit le module courant, qui appartient encore à cette partie,
  et y reviendrait en boucle. Le cas est traité dans le gestionnaire.
- **On ressort des réglages par où l'on est entré.** La vue d'origine était
  bien retenue, mais rejetée : la garde exigeait qu'elle appartienne au module
  ouvert, or l'accueil et le menu d'une partie ne sont les vues d'aucun module.
  On ressortait donc dans « Mon entreprise » après y être entré depuis
  l'accueil.

## Le cadre du lot 5a (4.86.0)

La forme de la refonte, branchée sur les écrans existants. Référence :
`docs/correspondance-refonte.md` (§ 0, 1, 6 à 9), maquette V2 pour le cadre,
tour 2 de l'étape 5b pour le contenu du +.

- **Barre fixe en bas, sur tous les écrans** : Aujourd'hui · Chantiers · + ·
  Agenda · Argent. Chantiers ouvre le carnet, Agenda le calendrier, Argent le
  bilan des finances. Aujourd'hui ouvrait l'ancien accueil (rappels, tuiles, Mon
  entreprise, Mes notes) jusqu'au lot 5b (voir plus bas).
- **Bandeau** : logo (simple image, plus un bouton) · « ← parent » sur un
  écran de second niveau seulement · titre de l'écran · actions propres
  gardées (Aujourd'hui du calendrier, En-tête du cubage et sa seconde ligne) ·
  ☰. Le sélecteur de partie et le bouton Réglages sont partis.
- **Le +** et **le ☰** sont deux fenêtres (`modale()`) qui prennent l'allure
  d'une feuille (classe `feuille-nav`, retirée par toute autre fenêtre). Le +
  ouvre les formulaires existants ; le ☰ ouvre Stock, Achats, Véhicule,
  Rendements (chiffre de situation de `situationModule()`, le même calcul que
  les tuiles de Mon entreprise), Cubage, Bois, Réglages, Sauvegarde et
  Corbeille (ces deux-là ouvrent la carte Sauvegarde des Réglages jusqu'au
  lot f).
- **Les onglets du bas sont devenus des pastilles en haut** : même élément
  `#onglets`, mêmes `data-vue`, noms, ordre, arrivée et dessins.
- **`majCadre()`, appelé à la fin de `aller()`**, tient bandeau, barre, flèche,
  `accueil-ouvert` et crans d'historique. Aucun chemin vers un écran ne peut
  l'oublier : c'est ce qui rend obsolète le piège « toute vue de contenu doit
  lever `accueil-ouvert` ».

**Trois sortes d'écrans** (`typeEcran()`), qui ne remontent pas pareil :
« barre » (un onglet : il remonte à Aujourd'hui), « fixe » (la fiche →
Chantiers, Mon entreprise → Aujourd'hui), « libre » (ce qu'on ouvre par le ☰
ou un lien : il remonte là d'où l'on vient). Les écrans libres tiennent une
**pile** (`A.pile`) : passer d'une pastille à l'autre, ou d'une entrée du ☰ à
une autre, est un pas de côté qui garde le parent ; revenir sur un onglet de la
barre vide la pile. Entré par le ☰, on y revient : la flèche montre ☰ et
`remonter()` rouvre la feuille sur l'écran de départ.

**Retour du téléphone** : fenêtre → écran parent → onglet de la barre →
Aujourd'hui ; depuis Aujourd'hui, il sort. Les crans ne s'empilent plus à
chaque descente : `synchroniserCrans()` en empile autant que l'écran en
demande (`profondeur()`), jamais plus. Remonter par la barre ou la flèche ne
les consomme pas, et redescendre ensuite ne les double pas.

## L'écran Aujourd'hui (lot 5b, 4.87.0)

L'onglet Aujourd'hui devient l'écran de la maquette V2, corrigé par le tour 2
de l'étape 5b. L'ancien accueil et Mon entreprise sont retirés ; où va chaque
élément : `docs/inventaire-ecrans.md`, *Où sont allés l'accueil et Mon
entreprise*, que le scénario de non-perte lit ligne par ligne.

- **Ordre** : date · ligne de saisie · En retard · Bientôt · Mes notes (N1) ·
  Chantiers en cours · Prélèvements à venir · Derniers jours. Un bloc vide ne
  s'affiche pas ; sans retard ni rien de proche, une phrase le dit.
- **Rien de calculé à neuf** : les lignes relisent `C.alertes()` (impayé, à
  facturer, devis à relancer, jours à placer ou temps à estimer),
  `C.joursAResoudre()`, `FIN.alertesCharges()`, `echeancesVehicule()` et
  `ST.aRecommander()` (S2 : le réservé compte ; la tuile Stock du ☰ lit le même
  calcul). Seuls ajouts : l'horizon de sept jours des prélèvements (un préavis
  plus long est gardé) et la semaine depuis lundi de la ligne de saisie.
- **Chaque ligne d'En retard, de Bientôt et des prélèvements porte une clé**
  (`data-ajcle`, « impaye:c1 »…) : le × la masque jusqu'au lendemain, la clé
  et le jour vont dans `bordcub.masques` (hors sauvegarde : ce n'est pas une
  donnée), on ne garde que les masques du jour. Les tests visent une ligne par
  sa clé (`ligneAuj`, `appuyerLigne`).
- **Où mène une ligne** : `data-ajouvre="quoi:qui"`, lu par `OUVRIR_AUJ`. Toute
  ligne d'un chantier ouvre sa fiche, sauf « À programmer : N j à placer »
  (placement de l'Agenda) ; « Trancher » ouvre la fenêtre « Que s'est-il
  passé ? » ; la sauvegarde, l'endroit de ☰ ▸ Sauvegarde.
- **Mes notes** ont déménagé de `achats-entreprise.js` dans
  `interface/aujourdhui.js`, avec leurs gestes ; elles se refont seules
  (`renderNotes()`), pour qu'un élément ajouté ne referme pas le clavier.
  Une note se crée par + ▸ Note.
- **La vue garde son nom, « accueil »** : la barre, le retour, `?vue=accueil`
  et les tests la connaissent ainsi. `renderAccueil()` reste le
  rafraîchissement commun après une saisie ; il appelle `renderAujourdhui()`.
- **Fiche de chantier ouverte depuis une fiche** : elle y revient (← « Fiche »
  et retour du téléphone, un cran de plus) ; `A.fchDeFiche` le retient,
  posé par `noterParcours()`.
