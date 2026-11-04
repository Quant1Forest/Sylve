# Refonte de la forme — table de correspondance

Établie le 31/10/2026 sur la base de `docs/inventaire-ecrans.md` (version
4.85.0, corrections 4.85.1 comprises) et de la maquette V2 validée
(`maquettes/refonte-v2.html`, hors dépôt). Complétée le 31/10 par les deux
tours de l'étape 5b (`maquettes/refonte-5b-temps.html` et
`maquettes/refonte-5b-tour2.html`) : plus aucune ligne « à maquetter ».

**Règle absolue : la refonte change la forme, pas les fonctionnalités.**
Chaque écran, bloc, bouton et fenêtre de l'inventaire a ici une ligne qui dit
où il va. Une fonction ne sort que si sa ligne porte « retrait accepté ».
Une **porte** (un deuxième chemin vers la même fonction) peut être retirée ;
la **fonction** reste toujours accessible ailleurs, et la ligne dit où.

Statuts :

- **validé** — décidé avec lui (date entre parenthèses).
- **proposé** — choix par défaut, rien ne disparaît ; à corriger s'il le demande.
- **retrait accepté** — porte en double retirée avec son accord (section 12).
- **à maquetter** — l'endroit est fixé, la forme sera dessinée à l'étape 5b.
- **fait (lot 5a)** — en place dans l'application depuis la 4.86.0 (le statut de décision suit).
- **en partie (lot 5a)** — le chemin est en place, la forme vient à un lot suivant (dit après les deux-points).
- **fait (lot 5b)** — en place depuis la 4.87.0 (écran Aujourd'hui, retrait de l'accueil et de Mon entreprise).
- **en partie (lot 5b)** — en place depuis la 4.87.0 ; ce qui reste est dit après les deux-points.
- **fait (lot c1)** — en place depuis la 4.88.0 (Agenda, fiche du jour, placement).
- **en partie (lot c1)** — en place depuis la 4.88.0 ; ce qui reste est dit après les deux-points.
- **fait (lot c2)** — en place depuis la 4.89.0 (Ma journée, finitions de l'Agenda).
- **fait (lot b1)** — en place depuis la 4.90.0 (fiche du chantier en étapes).
- **fait (lot b2)** — en place depuis la 4.91.0 (liste Chantiers, création courte, Fiche sécurité).
- **fait (lot r1)** — en place depuis la 4.92.0 (Aujourd'hui et Agenda allégés, journée d'office, Mes notes dans le ☰ ; section 15).

---

## 0. La nouvelle architecture (rappel, validée le 30/10, confirmée le 31/10)

- **Écran de démarrage** (logo, durée réglable) puis **Aujourd'hui**. Plus
  d'Accueil ni de menu « Mon entreprise ».
- **Barre fixe en bas** : Aujourd'hui · Chantiers · [+] · Agenda · Argent.
- **[+]** : le point de départ pour créer ce qui naît seul (exception : les outils de terrain gardent leurs créations, Q2).
- **☰ « Le reste de Sylve »** (en haut à droite) : Entreprise (Stock et
  fournitures, Achats à venir, Véhicule, Rendements) · Outils de terrain
  (Cubage, Bois de chauffage) · Mes notes (lot r1) · Réglages · Sauvegarde · Corbeille.
- **Bandeau du haut** : logo · titre de l'écran · ☰.
- Règles : une action = un endroit ; une seule saisie du temps ; un mot = une chose.
- Usage : téléphone uniquement.
- **Lot 5a (4.86.0)** : barre, +, ☰, bandeau, pastilles et retour sont en place,
  branchés sur les écrans existants. Aujourd'hui ouvre encore l'ancien accueil
  (rappels, tuiles, Mon entreprise et Mes notes) jusqu'au lot 5b.
- **Lot 5b (4.87.0)** : Aujourd'hui est le vrai écran (V2 et tour 2) ; l'ancien
  accueil et Mon entreprise sont retirés, chaque élément à l'endroit dit ici
  (preuve élément par élément : `docs/inventaire-ecrans.md`, *Où sont allés
  l'accueil et Mon entreprise*).
- **Lot 5b2 (4.87.1)** : retouches d'Aujourd'hui tranchées le 31/10 — « Facture à
  faire » dès le lendemain, total « à facturer » dans Argent ▸ Bilan, Stock
  aligné sur S2, messages de corbeille et de note, « Poser des dates » sur le bon mois.
- **Lot b2 (4.91.0)** : liste Chantiers en groupes (recherche, Liste / Carte), création
  courte par + ▸ Chantier, « Fiche sécurité » et « Facturé à » partout. La carte a quitté
  l'Agenda, qui n'a plus de pastille ; les cumuls de l'ancien carnet restent repliés en bas
  de Chantiers jusqu'au lot d.
- **Lot r1 (4.92.0)** : retours d'usage des 02-03/11 — Aujourd'hui allégé (plus de Bientôt ni de Mes notes,
  autres rappels repliés), Agenda allégé (trois couleurs, plus d'« À programmer » ni de jours à trancher, appui
  long), journée d'office, Mes notes dans le ☰. Détail : section 15.

---

## 1. Navigation, Accueil, Mon entreprise, bandeau

| Ancien (chemin de l'inventaire) | Nouvel endroit | Statut |
|---|---|---|
| Accueil (l'écran) | Écran de démarrage, puis Aujourd'hui | fait (lot 5b) — validé (30/10) |
| Accueil ▸ marque (logo, « Sylve », sous-titre) | Écran de démarrage | fait (lot 5b) — validé (30/10) |
| Accueil ▸ ⚙ | ☰ ▸ Réglages | fait (lot 5b) — validé (30/10) |
| Accueil ▸ tuile Mon entreprise (chantiers ouverts) | Barre du bas ; le chiffre « ouverts » disparaît au profit des groupes de Chantiers (voir 11) | en partie (lot 5b) : tuile retirée ; son chiffre est le compte de « Chantiers en cours » d'Aujourd'hui, les groupes de Chantiers viennent avec la liste — validé (30/10) |
| Accueil ▸ tuiles Cubage (m³) et Bois de chauffage (stères) | ☰ ▸ Outils de terrain, chaque tuile avec son chiffre (m³ comme aujourd'hui pour le cubage, stères pour le bois) | fait (lot 5a) — validé (30/10) ; chiffre : proposé |
| Accueil ▸ bouton « Enregistrer ma journée » | + ▸ Ma journée | fait (lot 5b) : bouton retiré ; la ligne de saisie d'Aujourd'hui ouvre aussi Ma journée — validé (30/10) |
| Accueil ▸ ligne « Déjà saisie / Rien de saisi · X h sur 7 jours » | Haut d'Aujourd'hui (« Rien de saisi aujourd'hui · Cette semaine : X h sur N jours »), information seule | fait (lot 5b, P4 au lot c2) : la semaine part du lundi ; un appui ouvre Ma journée, chantier posé pré-choisi — validé (V2) |
| Accueil ▸ les quatre rappels | Aujourd'hui (détail en section 2) | fait (lot 5b) — validé (V2) |
| Mon entreprise (l'écran) | Disparaît ; contenu redistribué ci-dessous | fait (lot 5b) — validé (31/10) |
| Mon entreprise ▸ marque de l'entreprise (logo et nom) | Écran de démarrage, sous le logo Sylve, si renseignés | fait (lot 5a, déjà en place depuis 4.7x) — proposé |
| Mon entreprise ▸ bouton ↩ | Sans objet (barre du bas) | fait (lot 5b) — validé (30/10) |
| Mon entreprise ▸ six bulles « Où j'en suis » et ligne des 7 jours | Aujourd'hui et Argent (section 2) | fait (lot 5b) — validé (31/10) |
| Mon entreprise ▸ tuiles Chantiers, Calendrier, Finances | Barre du bas : Chantiers, Agenda, Argent | fait (lot 5a) — validé (30/10) |
| Mon entreprise ▸ tuiles Stock, Achats, Véhicule, Rendements (avec chiffre et phrase de situation) | ☰ ▸ Entreprise, chaque tuile garde son chiffre de situation | fait (lot 5a) — validé (V2) |
| Mon entreprise ▸ Mes notes | Aujourd'hui ▸ Mes notes (section 2) | fait (lot 5b) — validé (31/10) ; lot r1 : ☰ ▸ Mes notes (section 15) |
| Bandeau ▸ logo (retour à l'accueil) | Logo affiché, sans rôle de bouton (Aujourd'hui est dans la barre) | fait (lot 5a) — proposé |
| Bandeau ▸ ← (remonter d'un étage) | « ← <écran parent> » sur les écrans de second niveau seulement (fiche → Chantiers, Stock → ☰…) | fait (lot 5a) — proposé |
| Bandeau ▸ sélecteur de partie | ☰ et barre du bas | fait (lot 5a) — validé (30/10) |
| Bandeau ▸ action Calendrier « Aujourd'hui » | Agenda, à côté de ‹ › | fait (lot c1) : l'action du bandeau est retirée, il ne reste que le bouton d'à côté de ‹ › — validé (31/10, P5) |
| Bandeau ▸ action Cubage « En-tête » et seconde ligne du bordereau en cours | Inchangés dans Cubage | fait (lot 5a) — proposé (inchangé) |
| Bandeau ▸ pictogramme Réglages (arrivée selon le module, tableau 5.4) | ☰ ▸ Réglages, qui arrive sur la zone liée à l'écran d'où l'on vient (même tableau ; Agenda = Relances et calendrier ; Argent = Financier) | fait (lot 5a) — proposé |
| Retour du téléphone (fenêtre → module → menu → accueil) | Fenêtre → écran parent → onglet de la barre → Aujourd'hui ; depuis Aujourd'hui, même comportement qu'aujourd'hui depuis l'accueil | fait (lot 5a) — proposé |
| « Ce qui a changé » : lignes cliquables vers un module | Inchangé (Réglages ▸ Général, en bas) ; les liens pointent vers les nouveaux endroits | fait (lot 5a) — proposé |

---

## 2. Aujourd'hui — ce qui y converge

Ordre retenu (V2, puis tour 2 le 31/10) : date et ligne de saisie · **En retard** ·
**Bientôt** · **Mes notes** (N1) · **Chantiers en cours** · **Prélèvements à
venir** · **Derniers jours**.

**Depuis le lot r1 (4.92.0)** : date · Ma journée · **En retard** (factures
échues, chantiers à facturer, devis à 7 jours de la fin) · **Chantiers en
cours** (par étape) · **Prélèvements à venir** · **Derniers jours** ·
**Autres rappels**, replié. Bientôt et Mes notes en sont sortis : la
dernière colonne des lignes ci-dessous dit où, et la section 15 le détail.

| Ancien | Dans Aujourd'hui | Statut |
|---|---|---|
| Rappel de sauvegarde (accueil) | En retard, si la dernière sauvegarde a plus de 30 jours : ligne « Sauvegarde à faire · dernière copie il y a N jours », en dernier dans En retard → ☰ ▸ Sauvegarde ; elle disparaît dès qu'on a sauvegardé | fait (lot 5b) : ☰ ▸ Sauvegarde ouvre encore la carte des Réglages (écran propre : lot f) — validé (31/10 ; B1, maquette tour 2) ; lot r1 : Aujourd'hui ▸ Autres rappels, replié (section 15) |
| Rappel « journées à trancher » (accueil) et bandeau du Calendrier | En retard : une ligne par jour passé prévu non saisi (« Jeudi 29 non saisi · Trancher ») → fiche du jour à l'état « à trancher » (R8) ; la ligne existe aussi en tête de l'Agenda (P3) | fait (lot c1) : « Trancher » ouvre la fiche du jour à trancher ; libellé « Journée du jeudi 29 octobre non saisie » (retour du 01/11), ici et dans la ligne de l'Agenda — validé (V2 ; 31/10, P3, R8) ; lot r1 : retiré, remplacé par la journée d'office (section 15) |
| Rappel d'échéances (prélèvements des charges fixes, 3 jours) | Bloc « Prélèvements à venir », séparé des tâches ; horizon 7 jours (la maquette), réglable dans Relances et calendrier | en partie (lot 5b) : bloc en place, 7 jours (le préavis plus long d'une échéance annuelle ou semestrielle est gardé) ; aucun réglage n'existait, rien d'ajouté — validé (30/10) ; horizon : proposé |
| Rappel de devis en attente de réponse | Bientôt : « Relancer le devis ? » (délai de relance des Réglages) | fait (lot 5b) — validé (V2) ; lot r1 : En retard, à 7 jours de la fin de validité (section 15) |
| Rappels fermables par × (reviennent au lancement suivant) | Chaque ligne d'En retard et de Bientôt garde un × « masquer jusqu'à demain » ; elle revient tant que ce n'est pas réglé | fait (lot 5b) ; les prélèvements gardent aussi leur × — proposé ; lot r1 : inchangé, le × reste sur chaque ligne (section 15) |
| Bulle « journées à planifier » | Bientôt : « À programmer : N j à placer » par chantier engagé (« temps à estimer » s'il n'a pas d'estimation) → Agenda en mode placement, retour à Aujourd'hui à la fin | fait (lot c1) : « Fini de placer » ramène à Aujourd'hui ; « temps à estimer » ouvre la fiche, comme « Estimer » d'À programmer (lot b1 : sur l'étape Devis) — validé (31/10, P1, P2) ; lot r1 : « À programmer » retiré, on place depuis la fiche ▸ Travaux ou par l'appui long (section 15) |
| Bulle « devis signés » | Même ligne « À programmer » (signé = à programmer) ; liste complète dans Chantiers | fait (lot 5b) — proposé ; lot r1 : « Signé · à programmer » sur la ligne de Chantiers en cours (section 15) |
| Bulle « chantiers en cours » | Bloc « Chantiers en cours » (points d'étape, montant, situation) | fait (lot 5b) : tous les chantiers non soldés, comme la V2 — validé (V2 ; confirmé le 31/10 : on garde ce titre et ce contenu) ; lot r1 : rangés par étape, le plus ancien en haut (section 15) |
| Bulle « factures en attente » (+ « N en retard ») | En retard : « Facture impayée » quand l'échéance est dépassée ; total « Facturé, pas encore payé » dans Argent ▸ Mois | en partie (lot 5b) : la ligne est en place ; le total est le « en attente » du Bilan d'Argent (Argent ▸ Mois : lot d), à côté duquel « À facturer : N chantiers · X € » est revenu au 5b2 (appui → carnet filtré « Travaux terminés ») — validé (V2) |
| Alerte du Carnet « à facturer » | En retard : « Facture à faire » (chantier terminé non facturé) | fait (lot 5b, seuil au 5b2) : dès le lendemain de « Travaux terminés » (1 jour, au lieu de 15), pour la ligne comme pour l'alerte du carnet, qui restent alignées ; l'alerte du carnet reste — validé (V2 ; 31/10) |
| Bulle « chiffre d'affaires » | Argent ▸ Mois | en partie (lot 5b) : bulle retirée, le même chiffre est dans Argent ▸ Bilan (année) ; Argent ▸ Mois : lot d — validé (30/10) |
| Bulle « TVA déductible » | Argent ▸ TVA | en partie (lot 5b) : bulle retirée, le même chiffre est dans Argent ▸ Bilan (année) ; Argent ▸ TVA : lot d — validé (30/10) |
| Ligne « Aujourd'hui / Demain / Dans N jours » (travail posé à 7 jours) | Bientôt : « N jours prévus · lun. 2 → mer. 4 » | fait (lot 5b) : une ligne par chantier, avec le donneur d'ordre — validé (V2) ; lot r1 : « posé demain » sur la ligne du chantier, à trois jours (section 15) |
| (nouveau, issu du déroulé) Devis à faire, Repérage à faire | Bientôt : une seule ligne « Devis à faire » par chantier à l'étape Infos, avec « repéré il y a N j » ou « annoncé il y a N j · pas encore repéré » en petit ; plus de ligne « Repérage à faire » séparée (le repérage n'est pas systématique) | fait (lot b2) : une ligne par chantier « Devis à envoyer » pas encore envoyé ; en petit « repéré il y a N j » ou « annoncé il y a N j · pas encore repéré » (date de repérage du lot b1) — validé (V2 ; 31/10, C1) ; lot r1 : sur la ligne du chantier, étape Infos (section 15) |
| Mes notes (listes cochables colorées, + note, cocher, modifier le titre, × d'un élément, × de la note → corbeille, ajouter un élément) | Aujourd'hui ▸ Mes notes, juste après Bientôt (N1), toutes ces actions sur place : une carte par note (bande de la couleur à gauche, titre → fenêtre titre / couleur / Supprimer, × → confirmation puis corbeille, « N à faire »), éléments à faire visibles, cochés repliés sous « N faits » (N2 ; un appui les montre, décocher les remet en haut), champ « ajouter… » en bas de chaque note (Entrée ajoute et garde le clavier) ; créer une note : + ▸ Note | en partie (lot 5b) : déplacées avec toutes leurs actions, en cartes ; « + note » retiré (+ ▸ Note) ; cochés repliés (N2) : lot f — validé (31/10, maquette tour 2) ; lot r1 : ☰ ▸ Mes notes (section 15) |
| Remontées du lot 1 : ancienne note sur plusieurs lignes = un seul élément ; élément non modifiable | Un appui sur le texte d'un élément le corrige sur place (Entrée ou sortie du champ enregistre, Échap annule, vide = on garde l'ancien texte) ; un élément de plusieurs lignes affiche « N lignes : en faire N éléments », qui le découpe à sa place | validé (31/10, maquette tour 2) ; lot f |
| (nouveau) Trois derniers jours saisis | Bas d'Aujourd'hui, lien « Tout l'historique dans l'Agenda » | fait (lot 5b) : un appui rouvre Ma journée sur ce jour — validé (V2), à juger à l'usage |
| Tuile Stock ▸ « N à recommander » | Bientôt : une seule ligne « À recommander : N fournitures » (chacune avec sa raison : sous le seuil, rupture, ou « il en manque N » pour les chantiers signés, S2) → Stock ; et sous-titre de la tuile ☰ | en partie (lot 5b) : la ligne et la tuile du ☰ comptent pareil, réservé compris ; l'écran Stock garde son ancien compte jusqu'au lot du stock — validé (31/10, Q4 ; S2) ; lot r1 : Autres rappels (section 15) |
| Tuile Véhicule ▸ « N échéances dépassées » | En retard si dépassée, Bientôt si proche (et sous-titre ☰) | fait (lot 5b) : « proche » = la définition des Échéances (60 jours ou 5 000 km) — validé (31/10, Q4) ; lot r1 : Autres rappels, dépassée ou proche (section 15) |

---

## 3. Chantiers

### 3.1 Carnet → Chantiers (la liste)

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Accès : Mon entreprise ▸ Chantiers, ou onglet Carnet du Calendrier | Onglet Chantiers de la barre ; pastilles Liste · Carte · Fiche · Fiche sécurité | fait (lot b2) : l'onglet Carnet du Calendrier est parti au lot c1 (R1) ; la pastille « Carnet » s'appelle « Liste » — validé (30/10) |
| « À traiter (N) » (journées passées, à facturer, facture impayée) | Aujourd'hui ▸ En retard, et groupe « À faire maintenant » de Chantiers | fait (lot b2) : le bandeau « À traiter » est devenu le groupe « À faire maintenant », mêmes alertes (le chantier aux jours passés n'est que là) — validé (V2) |
| Bouton « Nouveau chantier » | + ▸ Chantier | fait (lot b2) : le bouton de la page est retiré — validé (30/10) |
| Carte Carnet : facturé, encaissé, devis signés, premier donneur d'ordre (tout l'historique) | Argent ▸ Année (facturé, encaissé, par donneur d'ordre, devis signés et taux), avec un cumul « depuis le début » en bas | en partie (lot b2) : en attendant Argent ▸ Année (lot d), les quatre chiffres restent dans « Cumuls du carnet, depuis le début », replié en bas de Chantiers — proposé |
| Ligne de comptes : ouverts, jours-homme cumulés, à facturer, jours passés | Ouverts et à facturer : compteurs des groupes ; jours passés : Aujourd'hui ▸ En retard ; jours-homme : Agenda (mois) et Argent ▸ Année | en partie (lot b2) : compteurs des groupes en place ; la ligne entière reste aussi dans « Cumuls du carnet » jusqu'au lot d — proposé |
| Recherche (nom, donneur d'ordre, commune, n° de facture) | Haut de Chantiers (absente de la maquette, à ajouter) | fait (lot b2) : elle regarde tout le carnet, statut compris, et remplace les groupes tant qu'elle est tapée — proposé |
| Filtre par statut | Groupes : À faire maintenant · En travaux · Devis · Payés récemment · « Voir les payés plus anciens » · « Sans suite » (replié, en bas) | fait (lot b2) : un facturé pas encore échu va dans « En travaux » (aucun groupe à lui) ; « payés récemment » = payés depuis moins de 30 jours ; l'ancien filtre (statuts, familles, à compléter, avec devis) reste replié en bas, « Tout le carnet, par filtre » — validé (V2) ; « Sans suite » : proposé |
| Où va « Devis signé, à programmer » (et « À programmer » sans devis) | Groupe En travaux, situation « signé · à programmer » | fait (lot b2) : « Signé · à programmer », ou « Sans devis · à programmer » — proposé |
| Tri et sens du tri | Ordre fixe dans les groupes (le plus urgent en haut) ; tri au choix (date, montant, donneur d'ordre) gardé dans « payés plus anciens » | fait (lot b2) : les anciens critères gardés, plus Montant et Donneur d'ordre ; le sens se dit dans les mots du critère — proposé |
| Ligne : nom, donneur, dates, badge de statut, n° de facture, montants HT / TTC / TVA | Ligne V2 : nom, lieu, situation, montant HT, points d'étape ; le détail dans la fiche | fait (lot b2) : le lieu porte aussi le donneur d'ordre ; la situation dit « Facturé le … · payé le … » et le n° de facture d'un chantier facturé ou payé ; « à compléter » reste sur la ligne ; TTC, TVA et date du devis : dans la fiche, étape Devis — validé (V2) |
| Ligne ▸ Ouvrir | Appui sur la ligne | fait (lot b2) — validé (V2) |
| Ligne ▸ Temps | + ▸ Ma journée | fait (lot b2) — retrait accepté (31/10, R2) |
| Ligne ▸ Statut | Dans la fiche (gestes des étapes) | fait (lot b2) — retrait accepté (31/10, R2) |
| Calendrier ▸ onglet Carte (recherche de commune, Ma position, − / + / Tout voir, Poser un chantier, fonds de carte, liste) | Chantiers ▸ bascule Liste / Carte, carte intacte | fait (lot b2) : la pastille Carte, juste après Liste — validé (V2) |

### 3.2 Fiche (le dossier d'un chantier)

Structure V2 : en-tête (← Chantiers, sélecteur) · titre et ligne lieu /
surface / essences · encadré vert « Facturé à / Donneur d'ordre » · bulles
d'étape et ligne d'état · trois chiffres · étapes repliables **Infos et
repérage → Devis → Travaux → Facture → Payé** (celle en cours ouverte) ·
tuiles Rendement, Fiche sécurité, Fournitures, Note. En place au lot b1 (4.90.0) ;
en bas, discrets : « Corriger l’étape à la main » et « Supprimer ce chantier ».

| Ancien bloc ou bouton | Nouvel endroit | Statut |
|---|---|---|
| Sélecteur du chantier affiché | En-tête de la fiche | fait (lot b1) — validé (V2) |
| Précédente / Suivante | Gardées, à côté du sélecteur en tête de fiche | fait (lot b1) — validé (31/10 : retrait refusé, R3) |
| Le chantier : nom, lieu | Titre et ligne sous le titre | fait (lot b1) — validé (V2) |
| Le chantier : client, donneur d'ordre | Encadré vert | fait (lot b1) : « Facturé à » = le propriétaire (champ « Client » de la fenêtre Le chantier) — validé (V2) |
| ✎ identité (fenêtre Le chantier, position comprise) | Appui sur l'encadré | fait (lot b1) — proposé |
| État sur la carte : Voir / Placer / Déplacer | Étape Infos et repérage : « Pas encore sur la carte » + « Je suis dessus » (position du téléphone) / « Placer sur la carte » ; une fois placé, « Sur la carte » + Voir | fait (lot b1) : une fois placé, « Déplacer » reste à côté de Voir — validé (31/10, maquette tour 2) |
| Badge de statut | Bulles d'étape et ligne d'état | fait (lot b1) : le badge reste sur la ligne d’état — validé (V2) |
| Facture et paiement résumés | Résumé replié des étapes Facture et Payé | fait (lot b1) — validé (V2) |
| « Il manque… » | Dans l'étape concernée | fait (lot b1) — proposé |
| ← Carnet | ← Chantiers | fait (lot b1) — validé (V2) |
| Changer le statut | Les gestes des étapes (Signé / Refusé, Travaux terminés, Facturer au montant du devis, Noter le paiement) + « Corriger l'étape à la main », discret en bas de la fiche, pour revenir en arrière ou rattraper un cas hors norme | fait (lot b1) : gestes Devis envoyé, Signé, Refusé, Travaux terminés, Facturer au montant du devis, Noter le paiement ; « Corriger l’étape à la main » ouvre l’ancienne liste des statuts — validé (V2) ; correction à la main : proposé |
| Bouton Fiche de chantier | Tuile « Fiche sécurité » | fait (lot b1) : l’écran lui-même garde son nom et sa forme jusqu’au lot b2 — validé (V2) |
| Ce que ça vaut / Ce que ça a rapporté : montant, jours, par journée | Trois chiffres : devis HT · journées faites / estimées · par jour (réel, au rythme actuel ou au devis) | fait (lot b1) : réel et au devis identiques à l’ancienne fiche ; « au rythme actuel » quand l’avancement se mesure (lignes en plants, ha, unités, ml) ; montant hors débours, vente comprise, comme avant — validé (V2) |
| … et l'objectif (prix de journée du chantier) | Sous le troisième chiffre (« objectif 300 € ») | fait (lot b1) — proposé |
| Fenêtre « L'objectif de ce chantier » (chantier soldé) et sa porte « Noter du temps » | ✎ sur le troisième chiffre ; « Noter du temps » → rattrapage de l'étape Travaux | fait (lot b1) — proposé |
| Bloc Le devis : numéro, dates, lignes, total HT, TVA, pied « le devis disait… » | Étape Devis : n°, envoyé le, signé le ou « en attente de réponse », lignes (quantité × prix, taux), total HT, TVA par taux, TTC, part prestation / vente | fait (lot b1) : une fois facturé, l’étape Devis montre le devis figé et les lignes passent à l’étape Facture — validé (V2) |
| … validité du devis | Étape Devis (absente de la maquette, à garder) | fait (lot b1) — proposé |
| … temps estimé (✎, fenêtre L'estimation) | Étape Devis ▸ « Temps estimé », facultatif | fait (lot b1) — validé (31/10) |
| + Ligne ; Modifier / ✕ d'une ligne | Étape Devis | fait (lot b1) : dans l’étape Devis, puis dans l’étape Facture une fois facturé — validé (V2) |
| Attacher un devis (chantier sans devis) | Étape Devis ▸ « Saisir le devis » | fait (lot b1) : « Saisir le devis » (étape Infos) ; « Finalement, saisir un devis » (chantier sans devis) — validé (V2) |
| Modifier le devis (après facturation) | ✎ de l'étape Devis | fait (lot b1) — proposé |
| Statut « Devis envoyé / signé », date de signature qui fait passer à « à programmer » | Étape Devis, mêmes effets | fait (lot b1) : boutons « Devis envoyé » et « Signé » (date du jour proposée) — validé (V2) |
| Refus + motif (statut, bloc Sans suite) | Étape Devis ▸ Refusé, qui demande le motif ; le chantier va dans « Sans suite » | fait (lot b1) — proposé |
| Bloc La facture : numéro, date, échéance | Étape Facture : « Facturer au montant du devis » (n° du logiciel de facturation + date), échéance | fait (lot b1) — validé (31/10) |
| Saisir la facture ; facture différente du devis (« le devis disait… ») | Étape Facture ▸ « Le montant change ? Modifier les lignes » : lignes de facture distinctes, comparaison au devis gardée | fait (lot b1) : « Le montant change ? Modifier les lignes » fige le devis tout de suite ; « Toute la facture » garde la fenêtre complète — validé (31/10) |
| Statut « Facturé » qui demande le n° de facture | Même geste « Facturer » | fait (lot b1) — validé (V2) |
| Payé le / Réglé par (la date fait passer à « Payé ») | Étape Payé ▸ « Noter le paiement » (date et « réglé par ») | fait (lot b1) — validé (V2) |
| Bloc Les journées : Date · Fait · Prévu ; fait / reste / estimé | Étape Travaux : avancement ligne par ligne du devis (pondéré par le montant), liste des jours prévus et faits (heures, quantités), total heures · jours · km, « terminé le » | fait (lot b1) : fait / reste à faire / estimé gardés sous la liste — validé (V2) |
| … rendements | Tuile Rendement, facultative ; c'est aussi là qu'on note une cadence comptée (Q1) | fait (lot b1) : la tuile montre le rendement et ouvre « + Cadence », chantier prérempli (Q1) — validé (30/10, 31/10) |
| … bilan « le devis paie / j'y ai passé » | Troisième chiffre et étape Travaux | fait (lot b1) : dans l’étape Travaux — proposé |
| Poser des dates | Étape Travaux ▸ « Placer des jours dans l'Agenda » (mode placement, retour à la fiche à la fin) | fait (lot b1) : « Placer des jours dans l’Agenda », dans l’étape Travaux — validé (31/10, P1, P2) |
| ✎ des journées (fenêtre Les journées : estimées + dates à la main) | Journées estimées → étape Devis (un seul endroit) ; dates → Agenda en mode placement ; la saisie de dates à la main sort | fait (lot b1) : la fenêtre « Les journées » est retirée ; l’alerte « plus de jours placés qu’estimés » passe à la fenêtre L’estimation — retrait accepté (31/10, R6) ; estimées : proposé |
| + Du temps fait | + ▸ Ma journée (avec choix de la date) | fait (lot b1) : plus de bouton dans la fiche — retrait accepté (31/10, R4) |
| Saisie sans date « rattrapage » (temps global d'un ancien chantier) | Étape Travaux ▸ « Ajouter du temps sans date (rattrapage) » | fait (lot b1) — proposé (gardée) |
| Case « Ce chantier est terminé » (Ma journée) → « Terminé, à facturer » | Inchangée ; et bouton « Travaux terminés » de l'étape Travaux | fait (lot b1) — validé (V2) |
| Bloc Fournitures : consommation, refacturé, coût, marge | Tuile Fournitures ; sorties du stock automatiques, quantités réservées dès le devis signé | fait (lot b1) : la tuile ouvre le détail (consommation, refacturé, coût, marge) — validé (31/10) |
| Bloc Le peuplement (✎) | Étape Infos et repérage : bloc « Peuplement » (essence · densité · surface, « à préciser » tant que vide) ; se remplit aussi par « Noter le repérage » | fait (lot b1) : la surface s’y ajoute (case facultative, accord du 01/11) — validé (31/10, maquette tour 2) |
| Bloc Déplacements (km) | Étape Travaux : total km, détail par jour | fait (lot b1) : total km et carburant estimé, km de chaque jour dans sa ligne — proposé |
| Bloc Note (✎) | Tuile Note | fait (lot b1) : la même note se lit « Ce que je sais » dans l’étape Infos — validé (V2) |
| Supprimer ce chantier (corbeille) | Bas de la fiche | fait (lot b1) — proposé (inchangé) |
| Infos : dates d'annonce et de repérage | Discrètes ; en avant la note pratique (accès, code du portail) | fait (lot b1) : l’annonce est la date « Entré le » de la fenêtre Le chantier — validé (31/10) |
| (nouveau) Noter le repérage | Étape Infos et repérage : feuille « Noter le repérage » (date, position « je suis dessus » ou carte, essence, densité, surface, « Ce que j'ai vu ») ; facultatif, le chantier peut passer au devis sans | fait (lot b1) : la date, « ce que j’ai vu » et la surface sont trois cases nouvelles, facultatives (accord du 01/11, sans migration) — validé (V2 ; 31/10, C2) |
| (nouveau) Étape Devis d'un chantier sans devis choisi | Ouverte dès la création, sous Infos : « Saisir le devis » / « Pas de devis : à programmer » (le chantier passe à Travaux, « à programmer ») ; « Finalement, saisir un devis » pour revenir ; lien « Temps estimé (facultatif) » | fait (lot b1) : « Finalement, saisir un devis » ne fait pas reculer l’étape — validé (30/10 ; maquette tour 2) |
| Toutes les portes vers la fiche (Ouvrir du Carnet, alerte À traiter, bulle à un seul chantier, rappel de devis, carte Journée ▸ Ouvrir, À planifier ▸ Estimer, fiche d'un jour ▸ Fiche, fin d'un placement, Estimer ▸ Créer le devis) | Ligne de Chantiers, toute ligne d'Aujourd'hui liée à un chantier, Agenda (carte Journée, fiche d'un jour, À programmer), fin d'un placement, Estimer ▸ Créer le devis | fait (lot b1) : « temps à estimer » (Aujourd’hui, Agenda) et Estimer ▸ Créer le devis ouvrent l’étape Devis ; fiche du jour ▸ Fiche et fin d’un placement, l’étape Travaux ; les autres, l’étape en cours — proposé |

### 3.3 Fiche de chantier → Fiche sécurité

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Onglet « Fiche de chantier », bouton de la fiche | Tuile « Fiche sécurité » de la fiche ; le mot « Fiche sécurité » partout | fait (lot b2) : l'écran, sa pastille et le bandeau disent « Fiche sécurité » ; la feuille imprimée garde son titre réglementaire « Fiche de chantier » — validé (V2) |
| Choix du filtre et du chantier | Gardé dans l'écran (on y entre aussi par le chantier) | fait (lot b2, inchangé) — proposé |
| Alerte « fiche obligatoire » (plus de 4 ha), « Il manque » + Compléter le chantier, Qui / où / quoi, Période d'intervention, « Déjà connu ici » + Reprendre ses risques, familles de risques, Secours (accès, réseau, « Sa position, je suis dessus »), Co-activité et croquis, Aperçu, Imprimer / PDF | Inchangés | fait (lot b2, inchangé ; « Client » y devient « Facturé à ») — proposé (inchangé) |
| Rappel « à préparer avant les travaux » | Sous-titre de la tuile | fait (lot b1) : « obligatoire, plus de 4 ha » au-delà du seuil — validé (V2) |

---

## 4. Calendrier → Agenda

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Calendrier ▸ Agenda | Onglet Agenda de la barre | fait (lot 5a) — validé (30/10) |
| Titre du mois, ‹ · Aujourd'hui · › | Inchangés ; « Aujourd'hui » va au mois courant et ouvre la fiche du jour (qui remplace la carte Journée, R7) | fait (lot c1) — validé (31/10, P5) |
| Bandeau de placement + Terminer | Inchangé sur le fond ; « Terminer » devient « Fini de placer » et ramène au point de départ (fiche, Agenda, Aujourd'hui) ; le placement s'ouvre sur le mois du dernier jour placé, sinon du prochain jour ouvré ; il reçoit l'alerte « jour déjà pris » (Garder les deux / Prendre le jour libre suivant), venue de la fenêtre Les journées (R6) | fait (lot c1) : en placement, la ligne à trancher, À programmer, les compteurs et l'historique s'effacent ; la grille montre aussi les ½ — validé (31/10, P2, R6) ; lot r1 : un jour passé touché devient une journée faite (section 15) |
| Rappel « N journées passées restent à trancher » | Aujourd'hui ▸ En retard **et** ligne en tête de l'Agenda (sa demande d'origine : « à l'ouverture de l'app ou à l'accès au calendrier ») ; dans la grille, le jour porte un « ? » | fait (lot c1) : une ligne « Journée du … non saisie » (un jour) ou « N journées à trancher » (plusieurs), qui ouvre la fiche du plus ancien — validé (31/10, P3) ; lot r1 : retiré, remplacé par la journée d'office (section 15) |
| Bloc À planifier (Placer, Estimer par ligne) | Agenda, en haut, nommé « À programmer », repliable : engagés d'abord, devis en attente marqués, « temps à estimer » → Estimer, total de jours | fait (lot c1) : déplié d'abord ; replié, il le reste jusqu'au prochain lancement — validé (31/10, maquette 5b) ; lot r1 : retiré (section 15) |
| Grille du mois (une pastille par jour, repère € d'un prélèvement), légende, compteurs du mois | Inchangés sur le fond ; la pastille devient une bande pleine sous le numéro avec fond teinté du statut ; « ? » et bord pointillé pour un jour à trancher ; « € » dans le coin ; 4 compteurs (fait, confirmé dont à trancher, prévu, non travaillé) | fait (lot c1) : couleurs en variables du :root ; « € » à gauche, « ? » à droite ; le compteur « non travaillé » se montre même à zéro — validé (31/10, P5) ; lot r1 : légende du mois en trois couleurs et pointillés, « ○ » d'une journée d'office, trois compteurs (section 15) |
| Carte Journée du jour retenu (Prévu, Fait, Ouvrir, ✕, J'ai travaillé) | Fusionnée dans la fiche du jour (tous ses boutons gardés) ; « J'ai travaillé » ouvre Ma journée datée de ce jour ; sous la grille, la place va à l'historique | fait (lot c1) : « Ouvrir » s'appelle « Fiche » ; ✕ retire la saisie à la source (la carte l'effaçait de la liste refaite ensuite) — retrait accepté (31/10, R7) |
| Appui sur un jour → fiche d'un jour (C'était comme prévu, Non travaillé, J'y ai travaillé, Modifier ma journée, Autre chose, Poser un chantier, Fiche, Prélevé ce jour-là) | Une seule fiche du jour, en feuille : statut, Fait (✕, Fiche, appui → Ma journée), Posé (Fiche, Retirer), boutons selon l'état, Prélevé ce jour-là ; en mode placement, l'appui pose le jour | fait (lot c1) : la fiche monte du bas ; « Poser un chantier » et « Jour non travaillé » restent proposés sur un jour travaillé ou à trancher, comme avant ; « Ce n'est plus un jour off » devient « Retirer la marque » (maquette) — validé (31/10, R7) ; les trois choix faits au lot c1 (Poser un autre chantier, Retirer la marque, Déplacer sur un jour à venir) validés le 01/11 ; lot r1 : plus d'état « à trancher » ni de « C'était comme prévu » ; « Saisir ma journée » ; jour d'office : Préciser ma journée, Je n'y étais pas ; appui long → la bulle (section 15) |
| Fenêtre « Que s'est-il passé ? » (comme prévu, toutes comme prévu, je n'étais pas là, autrement, un autre jour) | Devient la fiche du jour à l'état « à trancher » : mêmes réponses (comme prévu, toutes comme prévu, autrement, un autre jour, je n'y étais pas) ; ouverte depuis Aujourd'hui ▸ Trancher, la ligne à trancher de l'Agenda et le jour | fait (lot c1) : « Toutes comme prévu » demande toujours confirmation — retrait accepté (31/10, R8) ; lot c2 : « Toutes comme prévu » se confirme dans une feuille, « Annuler » ramène au jour ; lot r1 : retirée avec l'état « à trancher » ; restent Déplacer la journée et Je n'y étais pas (section 15) |
| Fenêtres Déplacer la journée, Jour non travaillé, Poser un chantier (sur un jour) | Inchangées, ouvertes depuis la fiche du jour ; « Poser un chantier » est la porte « par le jour » du placement (durée 1 h à 8 h) | fait (lot c1) : « Déplacer la journée » est aussi proposé sur un jour à venir posé (maquette) — validé (31/10, P1) ; lot c2 : elles montent du bas et portent « ← jour » ; lot r1 : Poser un chantier devient une feuille par étape, avec le statut du jour (section 15) |
| Onglet Carte | Chantiers ▸ Carte | fait (lot b2) : l'Agenda n'a plus qu'une vue, donc plus de pastille — validé (V2) |
| Onglet Carnet | Retiré (même écran que Chantiers) | fait (lot c1) : aucune fonction ne passait que par lui (même vue que Chantiers ▸ Carnet) — retrait accepté (31/10, R1) |
| Historique des jours et des heures | Agenda, sous la grille : le mois jour par jour, groupé par semaine (heures, quantités, km ; appui → Ma journée) ; et dans chaque chantier (étape Travaux) | fait (lot c1) : sous la grille, la semaine la plus récente ouverte ; fait (lot b1) : dans chaque chantier, étape Travaux — validé (31/10, maquette 5b) |

---

## 5. Finances → Argent

Onglets : **Mois · TVA · Dépenses · Année**. Les sélecteurs de période restent
mémorisés et partagés comme aujourd'hui.

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Finances ▸ Bilan ▸ Période (Mois / Trimestre / Année) | Mois : ‹ mois › ; TVA et Dépenses : mois, trimestre ou année ; Année : ses sélecteurs actuels (section Analyses) | proposé |
| Bilan ▸ Chiffre d'affaires : facturé HT, encaissé, en attente | Mois : facturé HT (prestation / vente), graphique mois par mois de l'année, encaissé, « Facturé, pas encore payé » | validé (V2) |
| CA mois par mois pour la déclaration MSA trimestrielle | Mois : ligne « Trimestre en cours (MSA) » | validé (V2) |
| Bilan ▸ abattements (CA après abattement vente 71 % / prestation 50 %) | Année ▸ Vue d'ensemble et Déclarations | proposé |
| Bilan ▸ Balance de TVA (collectée, déductible, solde) | Mois : TVA du mois en lignes alignées (taux, base, montant), TVA facturée, déductible, à reverser ; onglet TVA : même présentation sur la période choisie (déclaration annuelle par taux) | validé (30/10) |
| Bilan ▸ Dépenses et marge (recettes − achats) | Mois : dépenses du mois par catégorie (barres) ; marge → « Pour aller plus loin » | validé (V2) |
| Bilan ▸ Déplacements et devis perdus | Déplacements : Mois ▸ Pour aller plus loin ; devis perdus : Année ▸ Devis | proposé |
| Bilan ▸ Par donneur d'ordre | Mois ▸ Pour aller plus loin, et Année | validé (V2) |
| Bilan ▸ Devis (taux d'acceptation, en attente) | Année ▸ Devis : taux, en attente, perdus et motifs | proposé |
| (V2) Ce qui rapporte par type de travaux, Marge sur fournitures, Charges fixes prélevées | Mois ▸ Pour aller plus loin (repliés) | validé (V2) |
| Finances ▸ Dépenses : indicateurs (TTC, HT, TVA déductible, nombre), filtre par catégorie, liste (Modifier, Supprimer) | Argent ▸ Dépenses : indicateurs, filtre et liste intacts ; un appui sur la ligne ouvre la dépense (modifier) ; Supprimer passe dans la feuille de la dépense, comme Ma journée ; une dépense née d'une charge fixe renvoie toujours à sa charge | validé (31/10 ; D5) |
| Finances ▸ Dépenses ▸ + Dépense | + ▸ Dépense | fait (lot 5a) ; « + Dépense » reste aussi dans la page — validé (30/10) |
| Finances ▸ Charges fixes : résumé, liste (Modifier, Supprimer), Échéances (quand, où part l'argent) | Argent ▸ Dépenses, bloc Charges fixes ; « Échéances » devient « Prélèvements à venir » | validé (31/10) |
| Finances ▸ Charges fixes ▸ + Charge | + ▸ Charge fixe (Plus rare) | fait (lot 5a) ; « + Charge » reste aussi dans la page — validé (31/10, Q1) |
| Dépenses créées seules à chaque échéance ; bouton « La charge » d'une dépense | Inchangés | proposé (inchangé) |
| Finances ▸ Analyses ▸ Vue d'ensemble · Recettes · Dépenses · Déclarations (tout leur contenu) | Argent ▸ Année, mêmes quatre pastilles, contenu intact | validé (31/10) |
| Analyses ▸ sélecteurs de période propres (type et année) | Gardés dans l'onglet Année, qui arrive sur l'année en cours | proposé |
| Analyses ▸ Déclarations ▸ cotisations et impôt, simulateur | Année ▸ Déclarations | validé (31/10) |
| Analyses ▸ Déclarations ▸ versements et récupérations, + Mouvement | Année ▸ Déclarations (s'ajoute à une déclaration, reste sur place) | proposé |
| Taux en double (Réglages ▸ Financier et cases du simulateur) | Réglages = taux de référence ; les cases du simulateur partent de ces taux et servent à essayer sans modifier les Réglages (vérifier le comportement actuel avant de toucher) | proposé |
| Tuile Finances (facturé, TVA à reverser / à récupérer) | Onglet Argent | fait (lot 5a) — validé (30/10) |
| Bilan ▸ coût du carburant estimé | Mois ▸ Pour aller plus loin ▸ Déplacements | proposé |
| (plus tard) Vrai résultat comparé à l'abattement, par an et par chantier | Année, et fiche annuelle PDF | idée (après la refonte) |

---

## 6. Le + (créations)

Contenu arrêté le 31/10. Quotidien : **Ma journée · Dépense · Chantier ·
Note**. Plus rare : **Commande de fournitures · Achat à prévoir · Noter une
intervention · Charge fixe**. (Nouvelle pile de bois et Nouveau bordereau,
présents dans la maquette V2, en sortent : Q2.)

Principe : le + crée ce qui **naît seul** ; ce qui **s'ajoute à un objet
existant** se fait dans cet objet ; les outils de terrain gardent leurs
propres créations.

| Ancienne porte de création | Nouvel endroit | Statut |
|---|---|---|
| Enregistrer ma journée (accueil) | + ▸ Ma journée ; aussi la ligne de saisie en tête d'Aujourd'hui ; un chantier posé ce jour-là est pré-choisi | fait (lot c2) : toutes les portes ouvrent la nouvelle feuille, et P4 y choisit le chantier posé ce jour-là — validé (30/10 ; 31/10, P4) |
| J'ai travaillé / J'y ai travaillé / Modifier ma journée / Autre chose (Agenda, fiche d'un jour, Que s'est-il passé ?) | Gardées dans la fiche du jour : elles ouvrent Ma journée datée du jour concerné | fait (lot c1) : Ma journée actuelle, datée du jour (le formulaire P4 : lot c2) — validé (31/10, R7, R8) |
| Temps (Carnet), + Du temps fait (fiche) | + ▸ Ma journée | retrait accepté (31/10, R2, R4) |
| Nouveau chantier (avec ou sans devis) | + ▸ Chantier (« on m'en a parlé ») : feuille courte = étape Infos. Pour qui (donneur d'ordre + offre d'ajout ; « Facturé à » facultatif, « souvent connu plus tard », + offre d'ajout puis question SIREN) · Où, quoi (commune, forêt, type de travaux par familles, quantité ou surface selon l'unité) · Ce que je sais (accès, code du portail) · nom composé affiché · « Annoncé aujourd'hui · changer » · Créer le chantier → la fiche, étapes Infos et Devis ouvertes. Le choix avec / sans devis se fait ensuite dans l'étape Devis | fait (lot b2) : le chantier naît « Devis à envoyer », avec devis à saisir ; « Pas de devis : à programmer » dans l'étape Devis ; les « + liste » des champs sont gardés — validé (30/10 ; maquette tour 2, 31/10) |
| … champ « Journées à prévoir » du formulaire de création | Étape Devis ▸ Temps estimé (facultatif) | fait (lot b2) — validé (31/10, maquette tour 2) |
| Rendements ▸ Estimer ▸ Créer le devis | Gardé : crée le chantier avec son devis prérempli (suite d'une estimation) | fait (lot b2, inchangé) — proposé |
| Réglages ▸ Entreprise ▸ Import de données (chantiers, dépenses en masse) | Inchangé | proposé (inchangé) |
| + Dépense | + ▸ Dépense, feuille haute : « Comme la dernière » (fournisseur et catégories, ni date ni montants, D3) · Quand, où (date, fournisseur proposé d'après les dépenses passées, D4) · Le ticket, une ligne par nature d'achat : catégorie en puces (les six plus fréquentes + « Autre… » avec les 19, D1), montant TTC, TVA en boutons 20 / 10 / 5,5 / sans (« sans » d'office et bloqué pour assurance, frais bancaires, prêt, cotisations, D2), litres et prix du litre (carburant), désignation facultative, mention immobilisation · Pour s'y retrouver (n° de pièce, chantier, « concerne le véhicule », carnet + kilométrage si Frais véhicule) · pied fixe (TTC, HT, TVA déductible, immobilisé ; Supprimer en modification, Enregistrer) | en partie (lot 5a) : + ▸ Dépense ouvre la fenêtre actuelle ; la feuille D1-D5 vient ensuite — validé (30/10 ; 31/10, D1-D5) |
| Case « créer la dépense » (intervention du véhicule), « porter en dépense » (commande) | Inchangées | proposé (inchangé) |
| + note (Mon entreprise) | + ▸ Note : Quoi ?, couleur, premiers éléments facultatifs (Entrée ajoute) ; la note arrive en tête de Mes notes | en partie (lot 5a) : + ▸ Note ouvre la fenêtre actuelle (« + note » reste dans Mon entreprise) — validé (V2 ; maquette tour 2) |
| Stock ▸ Entrées / sorties ▸ Enregistrer (pastille Entrées) | + ▸ Commande de fournitures | fait (lot 5a) ; « Enregistrer » reste aussi dans la page — validé (V2) |
| Achats ▸ + Achat | + ▸ Achat à prévoir | fait (lot 5a) ; « + Achat » reste aussi dans la page — validé (V2) |
| Véhicule ▸ + Intervention | + ▸ Noter une intervention | fait (lot 5a) ; « + Intervention » reste aussi dans la page — validé (V2) |
| Bois ▸ Nouvelle pile (onglets Stock et Piles) | Dans l'outil seulement, un seul bouton (onglet Stock) ; le second (onglet Piles) est retiré ; pas d'entrée dans le + | validé (31/10, Q2) |
| Cubage ▸ Bordereaux ▸ tuiles de choix du cubage (créent un bordereau) | Dans l'outil seulement, inchangé ; pas d'entrée dans le + | fait (lot 5a) — validé (31/10, Q2) |
| Finances ▸ Charges fixes ▸ + Charge | + ▸ Charge fixe | fait (lot 5a) — validé (31/10, Q1) |
| Rendements ▸ + Noter une cadence (dont chantiers observés) | Fiche du chantier ▸ tuile Rendement : la cadence se note sur le chantier où elle est constatée (chantier prérempli, prestation choisie parmi ses lignes) ; un chantier seulement observé se crée par + ▸ Chantier | validé (31/10, Q1) |

Restent dans leur objet (s'ajoutent à quelque chose qui existe) : + Ligne
(devis, facture) · Noter le compteur, + Poste (véhicule) · + Mouvement
(Déclarations) · cadence comptée (tuile Rendement de la fiche) · mesure,
sortie et photos d'une pile · billons (Cubage ▸ Saisie) · sortie de stock à la main, perte, comptage d'inventaire · article,
fournisseur, entrées de listes (Réglages) · Coller depuis Excel · Importer
(Stock).

---

## 7. ☰ ▸ Entreprise : Stock, Achats, Véhicule, Rendements

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Stock ▸ Inventaire : indicateurs (valeur, produits, en commande, en rupture, à recommander), État du stock (ligne → fiche de l'article), lien Réglages ▸ Produits, alertes À recommander | ☰ ▸ Stock et fournitures ▸ Inventaire : indicateurs ; À recommander en haut (compte aussi le réservé, S2) ; **une carte par produit** au lieu du tableau à défilement (S4) : **en stock / dont réservé / disponible** en gros (disponible négatif = « il en manque N », en rouge), « Si les devis en attente sont signés : il en restera / manquera N » (ancien « À prévoir »), puis acheté, sorti, coût réel, valeur, attendus, plants couverts ; « Futur » devient « Disponible » ; total de valeur ; Compter le stock, Importer, Réglages ▸ Produits ; Où dort votre argent en bas ; carte → fiche du produit | validé (31/10, maquette tour 2) |
| (nouveau) Inventaire de recalage | « Compter le stock » : une seule feuille avec tous les produits (vide = pas compté), ouverte depuis Inventaire, Pertes ou la fiche d'un produit (elle s'ouvre alors sur lui) ; on compte le physique (le réservé y est encore) ; écart affiché en direct ; un manque = perte datée « Écart d'inventaire : compté N, Sylve en attendait M » dans Pertes ; un surplus = récupération au coût moyen, sans dépense ; l'historique n'est jamais réécrit | validé (31/10, S3) |
| Stock ▸ Inventaire ▸ Importer | Reste dans Stock (il l'y voulait dès le départ) | proposé |
| Stock ▸ Entrées / sorties ▸ Enregistrer (libellé ambigu selon la pastille) | Entrées : + ▸ Commande ; Sorties : « Sortie à la main » ; Pertes : « Noter une perte » ; Reçue et Modifier inchangés | proposé |
| Sorties automatiques depuis la facture | Inchangées : quantités prises sur les lignes du chantier ; réservées dès la signature (c'est déjà le cas : sorties « engagées », `engagees()` / `stockFutur()`) ; sorties à « Travaux terminés » et non à la facture (S1, confirmé le 31/10). Le lot Stock renomme et affiche la réservation, il ne la crée pas | validé (31/10, S1) |
| Stock ▸ Rentabilité (Hypothèses, Simulateur, Coûts, Performance, Par année) | ☰ ▸ Stock ▸ Rentabilité, intacte | fait (lot 5a) — validé (31/10) |
| Tuile Stock (valeur, à recommander) | Sous-titre de la tuile ☰ ; à recommander aussi dans Aujourd'hui ▸ Bientôt | en partie (lot 5a) : la tuile ☰ est faite ; Bientôt au 5b — validé (V2 ; 31/10, Q4) |
| Achats ▸ Ma liste (groupée par priorité, case acheté / remettre, ligne → fenêtre) ; Ce que ça pèse | ☰ ▸ Achats à venir, intacts | fait (lot 5a) — validé (V2) |
| Véhicule ▸ Carnet (fiche, Noter le compteur, historique, Modifier) ; Échéances (+ Poste, Modifier) ; Coûts (+ Compléter la fiche) | ☰ ▸ Véhicule, intacts ; « Carnet » devient le seul carnet de Sylve | fait (lot 5a) pour ☰ ▸ Véhicule ; le carnet des chantiers garde son nom jusqu'à R1 — proposé |
| Tuile Véhicule (km, échéances dépassées) | Sous-titre de la tuile ☰ ; échéances aussi dans Aujourd'hui (En retard / Bientôt) | en partie (lot 5a) : la tuile ☰ est faite ; Aujourd'hui au 5b — validé (V2 ; 31/10, Q4) |
| Rendements ▸ Rendements (tri, Détail, Estimer) ; Estimer (formulaire, Créer le devis, références) | ☰ ▸ Rendements, intacts | fait (lot 5a) — validé (V2) |
| Rendements ▸ + Noter une cadence | Création depuis la fiche du chantier (tuile Rendement). La porte de ☰ ▸ Rendements est gardée pour les cadences générales « sans chantier » (repère tant qu'aucun chantier fini n'a de vrai suivi) | validé (31/10, Q1) |
| Tuile Rendements (nombre de références) | Sous-titre de la tuile ☰ | fait (lot 5a) — validé (V2) |

---

## 8. ☰ ▸ Outils de terrain

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Cubage : Saisie, Bordereau, Synthèses (Synthèse, Financière, Bûcheron, Martelage), Bordereaux, exports (Excel, CSV, .json, Coller depuis Excel) | ☰ ▸ Cubage, intérieur inchangé | fait (lot 5a) — proposé (inchangé) |
| Bois de chauffage : Stock, Piles, Où ?, Export et analyse | ☰ ▸ Bois de chauffage, intérieur inchangé | fait (lot 5a) — proposé (inchangé) |
| Boutons de création internes (Nouvelle pile ×2, tuiles de cubage) | Gardés dans les outils ; Nouvelle pile une seule fois (onglet Stock) | validé (31/10, Q2) |
| Libellés en double propres aux outils (« Bordereau » / « Bordereaux », « Stock » du bois) | Notés, non traités : les outils restent tels quels | proposé |

---

## 9. Réglages, Sauvegarde, Corbeille

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Réglages (Général, Entreprise, Cubage, Bois de chauffage ; zones déroulées) | ☰ ▸ Réglages, mêmes pastilles et zones | fait (lot 5a) — validé (V2) |
| Général ▸ Mon entreprise (nom, logo) | Réglages ▸ Entreprise, en tête (une seule « Entreprise ») | proposé |
| Général ▸ L'application (installer, protéger les données, mises à jour, durée de l'écran de démarrage, écran allumé) | Inchangé | proposé (inchangé) |
| Général ▸ Sauvegarde (Tout sauvegarder, Restaurer — fusionner ou remplacer) | ☰ ▸ Sauvegarde, écran propre (sort des Réglages : une seule porte) : état (en rouge au-delà de 30 jours) et contenu du fichier, « Tout sauvegarder » en gros, Restaurer un fichier (fusionner / remplacer, demandé à chaque fois), Corbeille ; « ← » revient à l'écran d'où l'on vient | en partie (lot 5a) : ☰ ▸ Sauvegarde ouvre pour l'instant Réglages ▸ Général ▸ Sauvegarde ; l'écran propre au lot (f) — validé (31/10, maquette tour 2) |
| Général ▸ Sauvegarde ▸ Corbeille… | ☰ ▸ Corbeille, écran propre | en partie (lot 5a) : ☰ ▸ Corbeille ouvre la corbeille des Réglages, dépliée ; l'écran propre au lot (f) — proposé |
| Général ▸ Remise à zéro (listes de cubage) | Réglages ▸ Cubage | proposé |
| Général ▸ Ce qui a changé | Inchangé, en bas de Général | proposé (inchangé) |
| Entreprise : Ma journée de travail, Véhicule, Relances et calendrier, Listes déroulantes, Stock et fournitures, Financier, Import de données | Inchangés | proposé (inchangé) |
| Cubage, Bois de chauffage | Inchangés | proposé (inchangé) |
| Liens « Réglages ▸ Produits » (Stock), « Hypothèses » (Rentabilité) | Inchangés | proposé (inchangé) |

---

## 10. Les fenêtres, une par une

| Fenêtre | Ouverte depuis (après la refonte) | Statut |
|---|---|---|
| Nouveau chantier | + ▸ Chantier | validé (31/10, maquette tour 2) |
| Le chantier (identité) | Encadré de la fiche | fait (lot b1) — proposé |
| L'estimation | Étape Devis ▸ Temps estimé ; ✎ du troisième chiffre | fait (lot b1) — proposé |
| Le devis | Étape Devis | fait (lot b1) — validé (V2) |
| La facture | Étapes Facture et Payé | fait (lot b1) — validé (V2) |
| Le peuplement | Étape Infos et repérage | fait (lot b1) : reçoit la surface — proposé |
| Note du chantier | Tuile Note | fait (lot b1) — validé (V2) |
| Ligne de travaux | Étape Devis (et Facture si les lignes changent) | fait (lot b1) — validé (V2) |
| Temps passé | Fusionnée dans Ma journée ; rattrapage sans date dans l'étape Travaux | retrait accepté (31/10, R4) |
| Les journées | Éclatée : estimées → Devis ; dates → Agenda (placement) | fait (lot b1) : fenêtre retirée, chaque porte a son nouvel endroit — retrait accepté (31/10, R6) |
| Statut (+ motif de refus, + n° de facture) | Gestes des étapes ; « Corriger l'étape à la main » | fait (lot b1) — proposé |
| L'objectif de ce chantier | ✎ du troisième chiffre | fait (lot b1) — proposé |
| Ma journée | + ; Aujourd'hui (ligne de saisie) ; fiche du jour ; historique de l'Agenda et Derniers jours (modifier) | fait (lot c2) : forme retenue du tour 1, pied fixe ; aucun champ ne se refait pendant la frappe — validé (31/10, maquette 5b) |
| Fiche d'un jour | Appui sur un jour de l'Agenda ; Aujourd'hui ▸ Trancher ; ligne à trancher et bouton Aujourd'hui de l'Agenda. Absorbe la carte Journée et « Que s'est-il passé ? » | fait (lot c1) — validé (31/10, R7, R8) |
| Que s'est-il passé ? | Fondue dans la fiche du jour (état « à trancher ») | fait (lot c1) — retrait accepté (31/10, R8) |
| Déplacer la journée · Jour non travaillé · Poser un chantier | Depuis la fiche du jour | fait (lot c1) — validé (31/10) |
| Placer un chantier sur la carte | Étape Infos ; Chantiers ▸ Carte | en partie (lot b1) : étape Infos ; Chantiers ▸ Carte au lot b2 — proposé |
| Dépense | + ▸ Dépense ; liste Argent ▸ Dépenses (modifier, supprimer dans la feuille) | validé (31/10, D1-D5) |
| Charge fixe | + ▸ Charge fixe ; liste Charges fixes (modifier) | validé (31/10) |
| Mouvement (versement / récupération) | Année ▸ Déclarations | proposé |
| Hypothèses (rentabilité) | Stock ▸ Rentabilité | proposé (inchangé) |
| Article · Fiche d'un article · Fournisseur | Réglages ▸ Stock et fournitures ; Inventaire (ligne) | proposé (inchangé) |
| Commande | + ▸ Commande ; Entrées (Reçue, Modifier) | validé (V2) |
| Sortie de stock | Stock ▸ Sorties ; automatique depuis la facture | proposé |
| Import de fournitures | Stock ▸ Importer | proposé (inchangé) |
| (nouvelle) Compter le stock | Stock ▸ Inventaire, Stock ▸ Pertes, fiche d'un produit | validé (31/10, S3) |
| (nouvelle) Noter le repérage | Fiche ▸ étape Infos et repérage | fait (lot b1) — validé (31/10, C2) |
| Achat à venir | + ▸ Achat à prévoir ; Ma liste (ligne) | validé (V2) |
| Fiche du véhicule · Relevé du compteur · Poste d'entretien | ☰ ▸ Véhicule | proposé (inchangé) |
| Intervention | + ▸ Noter une intervention ; Véhicule ▸ Carnet (modifier) | validé (V2) |
| Détail d'un rendement | ☰ ▸ Rendements | proposé (inchangé) |
| Noter une cadence (« Ce que vous avez compté ») | Fiche ▸ tuile Rendement (sur ce chantier) ; ☰ ▸ Rendements (cadence générale, sans chantier) | validé (31/10) |
| Note à soi-même | + ▸ Note ; Aujourd'hui ▸ Mes notes (modifier) | validé (31/10) |
| En-tête du bordereau · Coller depuis Excel · Pile · Mesure · Sortie d'une pile · Photos | Dans les outils, inchangées | validé (31/10, Q2) |
| Fenêtres des Réglages (essence, qualité, entrée de liste, travail réglé) | Inchangées | proposé (inchangé) |

---

## 11. Les doublons de l'inventaire (section 5) : comment chacun est résolu

### Même action, plusieurs endroits (5.1)

1. **Saisir du temps** : Ma journée seule ; le rattrapage sans date reste dans l'étape Travaux.
2. **Trancher un jour passé** : une fenêtre, deux portes (Aujourd'hui ▸ En retard, jour de l'Agenda).
3. **Planifier** : le placement se fait toujours dans l'Agenda ; journées estimées réglées à un seul endroit (étape Devis). Les portes vers l'Agenda (étape Travaux, bloc À programmer, jour) : à arbitrer dans la maquette Agenda.
4. **Estimer** : saisie à la main (étape Devis) et calcul d'après ses chantiers (Rendements ▸ Estimer) — deux outils, deux usages, gardés.
5. **Statut** : avance par les gestes des étapes ; correction à la main discrète.
6. **Créer un chantier** : + ; Estimer ▸ Créer le devis ; import.
7. **Placer sur la carte** : Infos et repérage, Chantiers ▸ Carte, fenêtre identité, fiche sécurité (sur le terrain) — même donnée, gardées.
8. **Position, forêt, commune** : saisies dans le chantier ; Ma journée les reprend du chantier choisi (validé au tour 1, P4).
9. **Réglages** : une porte (☰) + liens contextuels gardés ; taux : voir section 5.
10. **Retour** : « ← parent » sur les écrans de second niveau, retour du téléphone, barre du bas.

### Même information, autrement (5.2) — libellés retenus

| Sujet | Libellé retenu |
|---|---|
| Ouverts / en cours | « ouverts » disparaît ; on parle des groupes (À faire maintenant, En travaux, Devis) |
| Chiffre d'affaires | Seulement dans Argent (Mois, Année), hors débours ; la fiche donne celui du chantier |
| TVA | Toujours nommée : « TVA facturée », « TVA déductible », « À reverser » / « À récupérer » |
| Journées passées non tranchées | « À trancher » partout |
| Factures non payées | « Impayée » si échue ; « Facturé, pas encore payé » sinon ; « en attente » réservé au devis (« en attente de réponse ») |
| À planifier | « À programmer » (son mot) partout : étape, bloc de l'Agenda, ligne d'Aujourd'hui — fait (lot c1), « À planifier » reste lu à l'import ; « Devis signé, à programmer » validé le 01/11 |
| Dépenses / achats / acheté | « Dépenses » partout ; « Achats à venir » garde son nom de module |
| Notes | « Mes notes » = pense-bêtes ; « Note » = celle d'un chantier, d'une journée, d'un achat |
| Fiche / Fiche de chantier | « Fiche » (le dossier) ; « Fiche sécurité » (le document imprimé) |
| Carnet | Seul celui du véhicule reste |
| Entreprise | Groupe « Entreprise » du ☰ et pastille « Entreprise » des Réglages (nom et logo y vont) |
| Terminé | « Travaux terminés » (étape et case de Ma journée) ; fin de placement : « Fini de placer » |
| Échéances | « Prélèvements » pour les charges fixes ; « Échéances » pour le véhicule ; « échéance » d'une facture |
| Client / propriétaire | « Facturé à » partout où le champ est saisi ou affiché (création, fenêtre Le chantier, fiche, Fiche sécurité, réglages des listes) ; la donnée garde son nom (`proprietaire`, `proprios`). La feuille imprimée dit « Propriétaire », comme l'arrêté | fait (lot b2) — tranché le 01/11 |
| Dépenses (onglet) / Dépenses (pastille d'Année) | Gardés : la liste et l'analyse du même sujet |

### Libellés (5.3)

Valider un formulaire : « Enregistrer ». Supprimer un objet (corbeille) :
« Supprimer ». Créer : depuis le + avec un nom (« Dépense », « Noter une
intervention ») ; ajouter à un objet : « Ajouter une ligne », etc. Voir le
détail : appui sur la ligne. Retour : « ← <parent> ». Donneur d'ordre : en
toutes lettres. Période : « Période ».

---

## 12. Retraits de portes soumis à accord

La fonction reste toujours accessible ; seule la porte en double part.

| N° | Porte retirée | La fonction reste | Accord |
|---|---|---|---|
| R1 | Onglet Carnet de l'Agenda | Chantiers (même écran) | accepté (31/10) ; fait (lot c1) |
| R2 | Boutons Temps et Statut sur chaque ligne de la liste | + ▸ Ma journée ; fiche (étapes) | accepté (31/10) |
| R3 | Précédente / Suivante de la fiche | — | **refusé (31/10) : on les garde** |
| R4 | Fenêtre Temps passé | Ma journée ; rattrapage sans date dans l'étape Travaux | accepté (31/10) |
| R5 | Second bouton Nouvelle pile (Bois ▸ Piles) | Bouton de l'onglet Stock | accepté (31/10, Q2) |
| R6 | Dates posées à la main dans la fenêtre « Les journées » de la fiche | Placement dans l'Agenda (alerte jour déjà pris, jour libre suivant) | accepté (31/10) ; fait (lot c1) |
| R7 | Carte « Journée » sous la grille de l'Agenda (fusion) | Fiche du jour, tous ses boutons | accepté (31/10) ; fait (lot c1) |
| R8 | Fenêtre « Que s'est-il passé ? » (fusion) | Fiche du jour à l'état « à trancher », mêmes réponses | accepté (31/10) ; fait (lot c1) |
| — | Bandeau (logo-bouton, ←, sélecteur), ↩ de Mon entreprise, écrans Accueil et Mon entreprise, bulles et tuiles | Barre du bas, ☰, Aujourd'hui, Argent | fait (lot 5a : bandeau ; lot 5b : Accueil, Mon entreprise, ↩, bulles et tuiles) — validé (30-31/10) |

### Pastilles renommées ou déplacées (lot b2)

L'inventaire des écrans (4.85) n'est pas réécrit : cette table dit ce que chaque pastille
y est devenue. « Module, après X » : la pastille a changé de module, sous le même nom.

| Module | Pastille de l'inventaire | Devient |
|---|---|---|
| Chantiers | Carnet | Liste |
| Chantiers | Fiche de chantier | Fiche sécurité |
| Calendrier | Carte | Chantiers, après Liste |

---

## 13. Arbitrages du 31/10

- **Q1** — Charge fixe : dans le + (Plus rare). Rendement : noté dans chaque fiche chantier (tuile Rendement).
- **Q2** — Outils de terrain : créations dans l'outil seulement ; une seule « Nouvelle pile » (onglet Stock) ; Pile et Bordereau sortent du +.
- **Q3** — R1, R2, R4 acceptés ; R3 refusé (Précédente / Suivante gardées).
- **Q4** — Alertes stock à recommander et entretien du véhicule : dans Aujourd'hui.
- **Cadence** : la porte « Noter une cadence » de ☰ ▸ Rendements est gardée, pour des cadences générales sans chantier (un repère tant qu'il n'a pas de chantier fini avec un vrai suivi).

### Étape 5b, tour « le temps » (maquette `maquettes/refonte-5b-temps.html`, validée le 31/10)

- **P1** — Placement : un seul outil, le mode placement de l'Agenda. Entrées par le chantier (fiche ▸ Travaux, Agenda ▸ À programmer, Aujourd'hui ▸ Bientôt) et par le jour (fiche du jour ▸ Poser un chantier).
- **P2** — « Fini de placer » ramène au point de départ ; le placement s'ouvre sur le mois du dernier jour placé, sinon du prochain jour ouvré.
- **P3** — La ligne « N jours à trancher » est aussi en tête de l'Agenda, en plus d'Aujourd'hui ▸ En retard.
- **P4** — fait (lot c2). Ma journée : un chantier posé ce jour-là est pré-choisi (forêt, commune, km et prestations remplis s'ils sont vides, jamais par-dessus ce qui est tapé).
- **P5** — Grille : bande pleine sous le numéro et fond teinté par statut ; « ? » et bord pointillé pour un jour à trancher ; « € » dans le coin ; le bouton Aujourd'hui ouvre la fiche du jour.
- **R6, R7, R8** acceptés (section 12).
- Ma journée, forme retenue — fait (lot c2) : bouton « Comme le … » en tête ; blocs « Quand, où » (date, chantier, forêt, commune) / « Mon temps » (temps total, prestations avec heures productives et quantité, rendement par jour sous chacune, ligne hors production) / « Trajet » (heures, km, personnes) ; puis « Ce chantier est terminé » et Note ; pied fixe avec le total (heures, journées, montant au prix de journée du chantier) et Enregistrer. Le formulaire ne se reconstruit jamais pendant la frappe : le clavier ne doit pas se refermer.

### Étape 5b, tour 2 (maquette `maquettes/refonte-5b-tour2.html`, validée le 31/10)

- **D1** — Dépense : catégorie en tête de ligne, en puces (Consommable, Repas, Carburant, EPI, Petit outillage, Fournitures) + « Autre… » qui ouvre la liste des 19.
- **D2** — TVA « sans » d'office et bloquée pour Assurance, Frais bancaires, Prêt, Cotisations (catégories `sansTva`, comme déjà dans les charges fixes) ; retour à 20 % si on change pour une catégorie avec TVA.
- **D3** — « Comme la dernière » : reprend le fournisseur et les catégories (et taux) de la dernière dépense hors charges fixes ; ni la date ni les montants ni les litres.
- **D4** — Fournisseur proposé d'après les dépenses passées (liste qui se remplit seule, rien à régler).
- **D5** — Supprimer une dépense : dans sa feuille ; la ligne de la liste s'ouvre d'un appui.
- **C1** — Chantier à l'étape Infos : une ligne « Devis à faire » dans Bientôt, « pas encore repéré » en petit ; plus de « Repérage à faire ». Fait (lot b2) : « repéré il y a N j » quand la date de repérage est notée.
- **C1, confirmé le 31/10 (5b2)** — « Devis à faire » = statut « Devis à envoyer », même si le devis est rédigé, tant qu'il n'est pas envoyé. Rien à changer.
- **Chantier « en retard », confirmé le 31/10 (5b2)** — reste seulement dans « À traiter » du carnet, pas dans Aujourd'hui.
- **C2** — « Noter le repérage » en une fois : date, position, peuplement, ce que j'ai vu. Fait (lot b1) ; la date, « ce que j'ai vu » et la surface sont trois cases nouvelles du chantier (accord du 01/11).
- **S1** — Le stock baisse à « Travaux terminés » (comportement actuel), pas à la facture.
- **S2** — « À recommander » compte aussi le réservé : disponible sous zéro = alerte, même au-dessus du seuil.
- **S3** — Compter : une seule feuille, écart daté dans Pertes, surplus au coût moyen sans dépense.
- **S4** — Inventaire en cartes : en stock, réservé, disponible en gros ; le reste dessous.
- **N1** — Mes notes juste après Bientôt. **N2** — éléments cochés repliés sous « N faits ».
- **B1** — Rappel de sauvegarde : dernière ligne d'En retard → ☰ ▸ Sauvegarde.
- Forme commune : feuilles hautes avec pied fixe (total + Enregistrer), jamais de reconstruction pendant la frappe.

## 14. Reste à maquetter (étape 5b)

Rien. Agenda et Ma journée : tour 1 (« le temps »), validé le 31/10.
Dépense, Chantier (création, étape Infos, repérage), Stock (réservé /
disponible, comptage), Mes notes et rappel de sauvegarde : tour 2, validé le
31/10. L'étape 5b est terminée ; la mise en œuvre (étape 6) peut commencer.

---

## 15. Retouches des 02-03/11 (lot r1)

Retours d'usage des 2 et 3 novembre, maquette `maquettes/refonte-auj-agenda.html`
(hors dépôt). Les huit points A1 à A4 et G1 à G4 ont été validés tels quels
le 03/11 ; les retraits ci-dessous ont été acceptés le même jour. En place
depuis la 4.92.0. Preuve élément par élément : `docs/inventaire-ecrans.md`,
*Où sont allés les éléments d'Aujourd'hui et de l'Agenda (lot r1)*.

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Aujourd'hui, ordre : saisie · En retard · Bientôt · Mes notes · Chantiers en cours · Prélèvements · Derniers jours | date · Ma journée · En retard (s'il y a quelque chose) · Chantiers en cours · Prélèvements à venir · Derniers jours · « Autres rappels (N) », replié | fait (lot r1) — validé (03/11, A1) |
| En retard ▸ facture impayée, chantier à facturer | En retard, dans cet ordre : factures échues d'abord, puis chantiers terminés pas facturés | fait (lot r1) — validé (03/11, A3) |
| Bientôt ▸ « Relancer le devis ? » (préavis de 14 jours) | En retard, en troisième : à 7 jours ou moins de la fin de validité, et après ; sans validité, le délai de relance des réglages (21 j) | fait (lot r1) : `PREAVIS_DEVIS` passe de 14 à 7, l'alerte du carnet suit — validé (03/11, A3) |
| En retard ▸ « Journée du … non saisie » ▸ Trancher | La journée d'office (voir plus bas) | retrait accepté (03/11) ; fait (lot r1) |
| En retard ▸ chantier dont tous les jours posés sont passés (`retard`) | Chantiers en cours, sur sa ligne : « plus de jour posé » ; le groupe « À faire maintenant » de Chantiers le garde | fait (lot r1) — validé (03/11) |
| En retard ▸ sauvegarde du mois ; En retard et Bientôt ▸ stock à recommander, entretien du véhicule | Autres rappels, replié tout en bas, même lien qu'avant | fait (lot r1) — validé (03/11, A1) |
| Bientôt (le bloc) | Retiré ; ce qu'il disait passe sur la ligne du chantier | fait (lot r1) — validé (03/11, A2) |
| Bientôt ▸ posé dans les trois jours (`approche`, « N jours prévus ») | Ligne du chantier : « posé aujourd'hui », « posé demain », « posé dans N j » | fait (lot r1) — validé (03/11, A2) |
| Bientôt ▸ Devis à faire (C1) | Ligne du chantier, étape Infos : « Devis à faire · pas encore repéré » ou « repéré il y a N j » | fait (lot r1) — validé (03/11, A2) |
| Bientôt ▸ « N jours à placer », « aucune journée prévue — estimez et placez », « N posées, pas d'estimation » | — (on place depuis la fiche ▸ Travaux ou par l'appui long ; on estime dans l'étape Devis) | retrait accepté (03/11) ; fait (lot r1) |
| Chantiers en cours (du plus avancé au moins avancé) | Tous les chantiers ni payés ni sans suite, rangés par étape (Infos et repérage · Devis · Travaux · Facture · Paiement), un intertitre par étape, le plus ancien en haut (date d'entrée dans l'étape, sinon d'annonce) ; nom, points, lieu, situation (rouge si elle est en retard), mot du calendrier ; un appui ouvre la fiche à l'étape en cours | fait (lot r1) — validé (03/11, A4) |
| Aujourd'hui ▸ Mes notes | ☰ ▸ Mes notes, un écran à elles, retour « ← ☰ » ; le + garde « Note » | fait (lot r1) : les gestes qui existaient (cocher, titre et couleur, ajouter, × d'un élément, × de la note → corbeille) ; « N faits » repliés, un appui qui corrige et « N lignes : en faire N éléments » n'existaient pas encore (lot f) — validé (03/11) |
| Derniers jours | Inchangé, plus la journée d'office et son ○ | fait (lot r1) — validé (03/11) |
| Agenda ▸ légende (cinq couleurs, jaune pour un devis en attente) | Ce qui figure dans le mois affiché : fait = bleu, posé = vert, posé sur un devis pas signé = vert en pointillés, non travaillé = gris ; en petit dessous, « € prélèvement » et « ○ comptée d'office (8 h) » | fait (lot r1) — validé (03/11, G1) |
| Agenda ▸ quatre compteurs (fait, confirmé dont à trancher, prévu, non travaillé) | Trois : fait, posé (signé seulement), non travaillé | fait (lot r1) : un jour posé déjà fait n'est plus compté « posé » — validé (03/11, G1) |
| Agenda ▸ ligne « N jours passés à trancher » | — (la journée d'office) | retrait accepté (03/11) ; fait (lot r1) |
| Agenda ▸ bloc « À programmer » (Placer, Estimer) | — (fiche ▸ Travaux ▸ Placer des jours, appui long ; estimation dans l'étape Devis) | retrait accepté (03/11) ; fait (lot r1) |
| (nouveau) Appui long sur un jour | Une bulle sous le jour : Saisir ma journée · Poser un chantier · Jour non travaillé ; 500 ms au doigt, clic droit à la souris ; l'appui simple ouvre toujours la fiche du jour | fait (lot r1) — validé (03/11, G2) |
| Fenêtre Poser un chantier (une liste, une durée) | Une feuille : les chantiers ni payés ni sans suite, rangés par étape ; puis le statut du jour proposé d'après le chantier — à venir : « Posé » ou « Posé, devis pas signé » (modifiable, la durée gardée) ; passé : « Fait · journée » ou « Fait · demi-journée » | fait (lot r1) : un statut contraire au chantier s'écrit sur la pose (`ferme`), sinon le jour suit le chantier — validé (03/11, G3) |
| Fiche du jour ▸ état « à trancher » ; « C'était comme prévu » (fiche du jour et à trancher) ; « Toutes comme prévu » | La journée d'office : un jour posé et confirmé qui passe compte d'office | « C'était comme prévu » et « Toutes comme prévu » : retrait accepté (03/11) ; fait (lot r1) |
| Fiche du jour ▸ « J'y ai travaillé, mais autrement » | « Saisir ma journée » (et, sur un jour d'office, « Préciser ma journée ») | « J'y ai travaillé, mais autrement » : retrait accepté (03/11) ; fait (lot r1) |
| Fiche du jour ▸ « C'était un autre jour » | « Déplacer la journée » | « C'était un autre jour » : retrait accepté (03/11) ; fait (lot r1) |
| Fiche du jour ▸ « Je n'y étais pas » (marquait le jour non travaillé) | Sur un jour d'office : retire le jour posé, dans la Corbeille (d'où il revient) ; « Jour non travaillé » reste à côté | fait (lot r1) — validé (03/11, G4) |
| (nouveau) Journée d'office | Un jour posé et confirmé (chantier signé ou sans devis, ou « Posé » choisi à la main) que la date a dépassé, sans journée saisie pour ce chantier ce jour-là, compte le lendemain comme une journée faite : sa part × `HEURES_JOUR`, sans prestation. ○ dans la grille, Ce mois-ci, Derniers jours et la fiche ▸ Travaux jusqu'à l'ouverture de la fiche du jour ; « Préciser ma journée », « Je n'y étais pas » | fait (lot r1) : calculée, jamais écrite — validé (03/11, G4) |
| Placement ▸ un jour passé touché | Devient une journée faite (8 h, sans prestation), sans pose ; le reste du placement inchangé | fait (lot r1) — validé (03/11) |
| Jours posés passés avant la 4.92 | Tels quels : pâles, sans relance, sans journée d'office ; il les règle à la main (saisir, retirer, déplacer) | fait (lot r1) : date de première ouverture de la 4.92 dans la configuration (`officeDepuis`) — tranché (04/11) |
