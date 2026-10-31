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

---

## 0. La nouvelle architecture (rappel, validée le 30/10, confirmée le 31/10)

- **Écran de démarrage** (logo, durée réglable) puis **Aujourd'hui**. Plus
  d'Accueil ni de menu « Mon entreprise ».
- **Barre fixe en bas** : Aujourd'hui · Chantiers · [+] · Agenda · Argent.
- **[+]** : le point de départ pour créer ce qui naît seul (exception : les outils de terrain gardent leurs créations, Q2).
- **☰ « Le reste de Sylve »** (en haut à droite) : Entreprise (Stock et
  fournitures, Achats à venir, Véhicule, Rendements) · Outils de terrain
  (Cubage, Bois de chauffage) · Réglages · Sauvegarde · Corbeille.
- **Bandeau du haut** : logo · titre de l'écran · ☰.
- Règles : une action = un endroit ; une seule saisie du temps ; un mot = une chose.
- Usage : téléphone uniquement.

---

## 1. Navigation, Accueil, Mon entreprise, bandeau

| Ancien (chemin de l'inventaire) | Nouvel endroit | Statut |
|---|---|---|
| Accueil (l'écran) | Écran de démarrage, puis Aujourd'hui | validé (30/10) |
| Accueil ▸ marque (logo, « Sylve », sous-titre) | Écran de démarrage | validé (30/10) |
| Accueil ▸ ⚙ | ☰ ▸ Réglages | validé (30/10) |
| Accueil ▸ tuile Mon entreprise (chantiers ouverts) | Barre du bas ; le chiffre « ouverts » disparaît au profit des groupes de Chantiers (voir 11) | validé (30/10) |
| Accueil ▸ tuiles Cubage (m³) et Bois de chauffage (stères) | ☰ ▸ Outils de terrain, chaque tuile avec son chiffre (m³ comme aujourd'hui pour le cubage, stères pour le bois) | validé (30/10) ; chiffre : proposé |
| Accueil ▸ bouton « Enregistrer ma journée » | + ▸ Ma journée | validé (30/10) |
| Accueil ▸ ligne « Déjà saisie / Rien de saisi · X h sur 7 jours » | Haut d'Aujourd'hui (« Rien de saisi aujourd'hui · Cette semaine : X h sur N jours »), information seule | validé (V2) |
| Accueil ▸ les quatre rappels | Aujourd'hui (détail en section 2) | validé (V2) |
| Mon entreprise (l'écran) | Disparaît ; contenu redistribué ci-dessous | validé (31/10) |
| Mon entreprise ▸ marque de l'entreprise (logo et nom) | Écran de démarrage, sous le logo Sylve, si renseignés | proposé |
| Mon entreprise ▸ bouton ↩ | Sans objet (barre du bas) | validé (30/10) |
| Mon entreprise ▸ six bulles « Où j'en suis » et ligne des 7 jours | Aujourd'hui et Argent (section 2) | validé (31/10) |
| Mon entreprise ▸ tuiles Chantiers, Calendrier, Finances | Barre du bas : Chantiers, Agenda, Argent | validé (30/10) |
| Mon entreprise ▸ tuiles Stock, Achats, Véhicule, Rendements (avec chiffre et phrase de situation) | ☰ ▸ Entreprise, chaque tuile garde son chiffre de situation | validé (V2) |
| Mon entreprise ▸ Mes notes | Aujourd'hui ▸ Mes notes (section 2) | validé (31/10) |
| Bandeau ▸ logo (retour à l'accueil) | Logo affiché, sans rôle de bouton (Aujourd'hui est dans la barre) | proposé |
| Bandeau ▸ ← (remonter d'un étage) | « ← <écran parent> » sur les écrans de second niveau seulement (fiche → Chantiers, Stock → ☰…) | proposé |
| Bandeau ▸ sélecteur de partie | ☰ et barre du bas | validé (30/10) |
| Bandeau ▸ action Calendrier « Aujourd'hui » | Agenda, à côté de ‹ › | proposé (inchangé) |
| Bandeau ▸ action Cubage « En-tête » et seconde ligne du bordereau en cours | Inchangés dans Cubage | proposé (inchangé) |
| Bandeau ▸ pictogramme Réglages (arrivée selon le module, tableau 5.4) | ☰ ▸ Réglages, qui arrive sur la zone liée à l'écran d'où l'on vient (même tableau ; Agenda = Relances et calendrier ; Argent = Financier) | proposé |
| Retour du téléphone (fenêtre → module → menu → accueil) | Fenêtre → écran parent → onglet de la barre → Aujourd'hui ; depuis Aujourd'hui, même comportement qu'aujourd'hui depuis l'accueil | proposé |
| « Ce qui a changé » : lignes cliquables vers un module | Inchangé (Réglages ▸ Général, en bas) ; les liens pointent vers les nouveaux endroits | proposé |

---

## 2. Aujourd'hui — ce qui y converge

Ordre retenu (V2, puis tour 2 le 31/10) : date et ligne de saisie · **En retard** ·
**Bientôt** · **Mes notes** (N1) · **Chantiers en cours** · **Prélèvements à
venir** · **Derniers jours**.

| Ancien | Dans Aujourd'hui | Statut |
|---|---|---|
| Rappel de sauvegarde (accueil) | En retard, si la dernière sauvegarde a plus de 30 jours : ligne « Sauvegarde à faire · dernière copie il y a N jours », en dernier dans En retard → ☰ ▸ Sauvegarde ; elle disparaît dès qu'on a sauvegardé | validé (31/10 ; B1, maquette tour 2) |
| Rappel « journées à trancher » (accueil) et bandeau du Calendrier | En retard : une ligne par jour passé prévu non saisi (« Jeudi 29 non saisi · Trancher ») → fiche du jour à l'état « à trancher » (R8) ; la ligne existe aussi en tête de l'Agenda (P3) | validé (V2 ; 31/10, P3, R8) |
| Rappel d'échéances (prélèvements des charges fixes, 3 jours) | Bloc « Prélèvements à venir », séparé des tâches ; horizon 7 jours (la maquette), réglable dans Relances et calendrier | validé (30/10) ; horizon : proposé |
| Rappel de devis en attente de réponse | Bientôt : « Relancer le devis ? » (délai de relance des Réglages) | validé (V2) |
| Rappels fermables par × (reviennent au lancement suivant) | Chaque ligne d'En retard et de Bientôt garde un × « masquer jusqu'à demain » ; elle revient tant que ce n'est pas réglé | proposé |
| Bulle « journées à planifier » | Bientôt : « À programmer : N j à placer » par chantier engagé (« temps à estimer » s'il n'a pas d'estimation) → Agenda en mode placement, retour à Aujourd'hui à la fin | validé (31/10, P1, P2) |
| Bulle « devis signés » | Même ligne « À programmer » (signé = à programmer) ; liste complète dans Chantiers | proposé |
| Bulle « chantiers en cours » | Bloc « Chantiers en cours » (points d'étape, montant, situation) | validé (V2) |
| Bulle « factures en attente » (+ « N en retard ») | En retard : « Facture impayée » quand l'échéance est dépassée ; total « Facturé, pas encore payé » dans Argent ▸ Mois | validé (V2) |
| Alerte du Carnet « à facturer » | En retard : « Facture à faire » (chantier terminé non facturé) | validé (V2) |
| Bulle « chiffre d'affaires » | Argent ▸ Mois | validé (30/10) |
| Bulle « TVA déductible » | Argent ▸ TVA | validé (30/10) |
| Ligne « Aujourd'hui / Demain / Dans N jours » (travail posé à 7 jours) | Bientôt : « N jours prévus · lun. 2 → mer. 4 » | validé (V2) |
| (nouveau, issu du déroulé) Devis à faire, Repérage à faire | Bientôt : une seule ligne « Devis à faire » par chantier à l'étape Infos, avec « repéré il y a N j » ou « annoncé il y a N j · pas encore repéré » en petit ; plus de ligne « Repérage à faire » séparée (le repérage n'est pas systématique) | validé (V2 ; 31/10, C1) |
| Mes notes (listes cochables colorées, + note, cocher, modifier le titre, × d'un élément, × de la note → corbeille, ajouter un élément) | Aujourd'hui ▸ Mes notes, juste après Bientôt (N1), toutes ces actions sur place : une carte par note (bande de la couleur à gauche, titre → fenêtre titre / couleur / Supprimer, × → confirmation puis corbeille, « N à faire »), éléments à faire visibles, cochés repliés sous « N faits » (N2 ; un appui les montre, décocher les remet en haut), champ « ajouter… » en bas de chaque note (Entrée ajoute et garde le clavier) ; créer une note : + ▸ Note | validé (31/10, maquette tour 2) |
| Remontées du lot 1 : ancienne note sur plusieurs lignes = un seul élément ; élément non modifiable | Un appui sur le texte d'un élément le corrige sur place (Entrée ou sortie du champ enregistre, Échap annule, vide = on garde l'ancien texte) ; un élément de plusieurs lignes affiche « N lignes : en faire N éléments », qui le découpe à sa place | validé (31/10, maquette tour 2) |
| (nouveau) Trois derniers jours saisis | Bas d'Aujourd'hui, lien « Tout l'historique dans l'Agenda » | validé (V2), à juger à l'usage |
| Tuile Stock ▸ « N à recommander » | Bientôt : une seule ligne « À recommander : N fournitures » (chacune avec sa raison : sous le seuil, rupture, ou « il en manque N » pour les chantiers signés, S2) → Stock ; et sous-titre de la tuile ☰ | validé (31/10, Q4 ; S2) |
| Tuile Véhicule ▸ « N échéances dépassées » | En retard si dépassée, Bientôt si proche (et sous-titre ☰) | validé (31/10, Q4) |

---

## 3. Chantiers

### 3.1 Carnet → Chantiers (la liste)

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Accès : Mon entreprise ▸ Chantiers, ou onglet Carnet du Calendrier | Onglet Chantiers de la barre | validé (30/10) |
| « À traiter (N) » (journées passées, à facturer, facture impayée) | Aujourd'hui ▸ En retard, et groupe « À faire maintenant » de Chantiers | validé (V2) |
| Bouton « Nouveau chantier » | + ▸ Chantier | validé (30/10) |
| Carte Carnet : facturé, encaissé, devis signés, premier donneur d'ordre (tout l'historique) | Argent ▸ Année (facturé, encaissé, par donneur d'ordre, devis signés et taux), avec un cumul « depuis le début » en bas | proposé |
| Ligne de comptes : ouverts, jours-homme cumulés, à facturer, jours passés | Ouverts et à facturer : compteurs des groupes ; jours passés : Aujourd'hui ▸ En retard ; jours-homme : Agenda (mois) et Argent ▸ Année | proposé |
| Recherche (nom, donneur d'ordre, commune, n° de facture) | Haut de Chantiers (absente de la maquette, à ajouter) | proposé |
| Filtre par statut | Groupes : À faire maintenant · En travaux · Devis · Payés récemment · « Voir les payés plus anciens » · « Sans suite » (replié, en bas) | validé (V2) ; « Sans suite » : proposé |
| Où va « Devis signé, à programmer » (et « À programmer » sans devis) | Groupe En travaux, situation « signé · à programmer » | proposé |
| Tri et sens du tri | Ordre fixe dans les groupes (le plus urgent en haut) ; tri au choix (date, montant, donneur d'ordre) gardé dans « payés plus anciens » | proposé |
| Ligne : nom, donneur, dates, badge de statut, n° de facture, montants HT / TTC / TVA | Ligne V2 : nom, lieu, situation, montant HT, points d'étape ; le détail dans la fiche | validé (V2) |
| Ligne ▸ Ouvrir | Appui sur la ligne | validé (V2) |
| Ligne ▸ Temps | + ▸ Ma journée | retrait accepté (31/10, R2) |
| Ligne ▸ Statut | Dans la fiche (gestes des étapes) | retrait accepté (31/10, R2) |
| Calendrier ▸ onglet Carte (recherche de commune, Ma position, − / + / Tout voir, Poser un chantier, fonds de carte, liste) | Chantiers ▸ bascule Liste / Carte, carte intacte | validé (V2) |

### 3.2 Fiche (le dossier d'un chantier)

Structure V2 : en-tête (← Chantiers, sélecteur) · titre et ligne lieu /
surface / essences · encadré vert « Facturé à / Donneur d'ordre » · bulles
d'étape et ligne d'état · trois chiffres · étapes repliables **Infos et
repérage → Devis → Travaux → Facture → Payé** (celle en cours ouverte) ·
tuiles Rendement, Fiche sécurité, Fournitures, Note.

| Ancien bloc ou bouton | Nouvel endroit | Statut |
|---|---|---|
| Sélecteur du chantier affiché | En-tête de la fiche | validé (V2) |
| Précédente / Suivante | Gardées, à côté du sélecteur en tête de fiche | validé (31/10 : retrait refusé, R3) |
| Le chantier : nom, lieu | Titre et ligne sous le titre | validé (V2) |
| Le chantier : client, donneur d'ordre | Encadré vert | validé (V2) |
| ✎ identité (fenêtre Le chantier, position comprise) | Appui sur l'encadré | proposé |
| État sur la carte : Voir / Placer / Déplacer | Étape Infos et repérage : « Pas encore sur la carte » + « Je suis dessus » (position du téléphone) / « Placer sur la carte » ; une fois placé, « Sur la carte » + Voir | validé (31/10, maquette tour 2) |
| Badge de statut | Bulles d'étape et ligne d'état | validé (V2) |
| Facture et paiement résumés | Résumé replié des étapes Facture et Payé | validé (V2) |
| « Il manque… » | Dans l'étape concernée | proposé |
| ← Carnet | ← Chantiers | validé (V2) |
| Changer le statut | Les gestes des étapes (Signé / Refusé, Travaux terminés, Facturer au montant du devis, Noter le paiement) + « Corriger l'étape à la main », discret en bas de la fiche, pour revenir en arrière ou rattraper un cas hors norme | validé (V2) ; correction à la main : proposé |
| Bouton Fiche de chantier | Tuile « Fiche sécurité » | validé (V2) |
| Ce que ça vaut / Ce que ça a rapporté : montant, jours, par journée | Trois chiffres : devis HT · journées faites / estimées · par jour (réel, au rythme actuel ou au devis) | validé (V2) |
| … et l'objectif (prix de journée du chantier) | Sous le troisième chiffre (« objectif 300 € ») | proposé |
| Fenêtre « L'objectif de ce chantier » (chantier soldé) et sa porte « Noter du temps » | ✎ sur le troisième chiffre ; « Noter du temps » → rattrapage de l'étape Travaux | proposé |
| Bloc Le devis : numéro, dates, lignes, total HT, TVA, pied « le devis disait… » | Étape Devis : n°, envoyé le, signé le ou « en attente de réponse », lignes (quantité × prix, taux), total HT, TVA par taux, TTC, part prestation / vente | validé (V2) |
| … validité du devis | Étape Devis (absente de la maquette, à garder) | proposé |
| … temps estimé (✎, fenêtre L'estimation) | Étape Devis ▸ « Temps estimé », facultatif | validé (31/10) |
| + Ligne ; Modifier / ✕ d'une ligne | Étape Devis | validé (V2) |
| Attacher un devis (chantier sans devis) | Étape Devis ▸ « Saisir le devis » | validé (V2) |
| Modifier le devis (après facturation) | ✎ de l'étape Devis | proposé |
| Statut « Devis envoyé / signé », date de signature qui fait passer à « à programmer » | Étape Devis, mêmes effets | validé (V2) |
| Refus + motif (statut, bloc Sans suite) | Étape Devis ▸ Refusé, qui demande le motif ; le chantier va dans « Sans suite » | proposé |
| Bloc La facture : numéro, date, échéance | Étape Facture : « Facturer au montant du devis » (n° du logiciel de facturation + date), échéance | validé (31/10) |
| Saisir la facture ; facture différente du devis (« le devis disait… ») | Étape Facture ▸ « Le montant change ? Modifier les lignes » : lignes de facture distinctes, comparaison au devis gardée | validé (31/10) |
| Statut « Facturé » qui demande le n° de facture | Même geste « Facturer » | validé (V2) |
| Payé le / Réglé par (la date fait passer à « Payé ») | Étape Payé ▸ « Noter le paiement » (date et « réglé par ») | validé (V2) |
| Bloc Les journées : Date · Fait · Prévu ; fait / reste / estimé | Étape Travaux : avancement ligne par ligne du devis (pondéré par le montant), liste des jours prévus et faits (heures, quantités), total heures · jours · km, « terminé le » | validé (V2) |
| … rendements | Tuile Rendement, facultative ; c'est aussi là qu'on note une cadence comptée (Q1) | validé (30/10, 31/10) |
| … bilan « le devis paie / j'y ai passé » | Troisième chiffre et étape Travaux | proposé |
| Poser des dates | Étape Travaux ▸ « Placer des jours dans l'Agenda » (mode placement, retour à la fiche à la fin) | validé (31/10, P1, P2) |
| ✎ des journées (fenêtre Les journées : estimées + dates à la main) | Journées estimées → étape Devis (un seul endroit) ; dates → Agenda en mode placement ; la saisie de dates à la main sort | retrait accepté (31/10, R6) ; estimées : proposé |
| + Du temps fait | + ▸ Ma journée (avec choix de la date) | retrait accepté (31/10, R4) |
| Saisie sans date « rattrapage » (temps global d'un ancien chantier) | Étape Travaux ▸ « Ajouter du temps sans date (rattrapage) » | proposé (gardée) |
| Case « Ce chantier est terminé » (Ma journée) → « Terminé, à facturer » | Inchangée ; et bouton « Travaux terminés » de l'étape Travaux | validé (V2) |
| Bloc Fournitures : consommation, refacturé, coût, marge | Tuile Fournitures ; sorties du stock automatiques, quantités réservées dès le devis signé | validé (31/10) |
| Bloc Le peuplement (✎) | Étape Infos et repérage : bloc « Peuplement » (essence · densité · surface, « à préciser » tant que vide) ; se remplit aussi par « Noter le repérage » | validé (31/10, maquette tour 2) |
| Bloc Déplacements (km) | Étape Travaux : total km, détail par jour | proposé |
| Bloc Note (✎) | Tuile Note | validé (V2) |
| Supprimer ce chantier (corbeille) | Bas de la fiche | proposé (inchangé) |
| Infos : dates d'annonce et de repérage | Discrètes ; en avant la note pratique (accès, code du portail) | validé (31/10) |
| (nouveau) Noter le repérage | Étape Infos et repérage : feuille « Noter le repérage » (date, position « je suis dessus » ou carte, essence, densité, surface, « Ce que j'ai vu ») ; facultatif, le chantier peut passer au devis sans | validé (V2 ; 31/10, C2) |
| (nouveau) Étape Devis d'un chantier sans devis choisi | Ouverte dès la création, sous Infos : « Saisir le devis » / « Pas de devis : à programmer » (le chantier passe à Travaux, « à programmer ») ; « Finalement, saisir un devis » pour revenir ; lien « Temps estimé (facultatif) » | validé (30/10 ; maquette tour 2) |
| Toutes les portes vers la fiche (Ouvrir du Carnet, alerte À traiter, bulle à un seul chantier, rappel de devis, carte Journée ▸ Ouvrir, À planifier ▸ Estimer, fiche d'un jour ▸ Fiche, fin d'un placement, Estimer ▸ Créer le devis) | Ligne de Chantiers, toute ligne d'Aujourd'hui liée à un chantier, Agenda (carte Journée, fiche d'un jour, À programmer), fin d'un placement, Estimer ▸ Créer le devis | proposé |

### 3.3 Fiche de chantier → Fiche sécurité

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Onglet « Fiche de chantier », bouton de la fiche | Tuile « Fiche sécurité » de la fiche ; le mot « Fiche sécurité » partout | validé (V2) |
| Choix du filtre et du chantier | Gardé dans l'écran (on y entre aussi par le chantier) | proposé |
| Alerte « fiche obligatoire » (plus de 4 ha), « Il manque » + Compléter le chantier, Qui / où / quoi, Période d'intervention, « Déjà connu ici » + Reprendre ses risques, familles de risques, Secours (accès, réseau, « Sa position, je suis dessus »), Co-activité et croquis, Aperçu, Imprimer / PDF | Inchangés | proposé (inchangé) |
| Rappel « à préparer avant les travaux » | Sous-titre de la tuile | validé (V2) |

---

## 4. Calendrier → Agenda

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Calendrier ▸ Agenda | Onglet Agenda de la barre | validé (30/10) |
| Titre du mois, ‹ · Aujourd'hui · › | Inchangés ; « Aujourd'hui » va au mois courant et ouvre la fiche du jour (qui remplace la carte Journée, R7) | validé (31/10, P5) |
| Bandeau de placement + Terminer | Inchangé sur le fond ; « Terminer » devient « Fini de placer » et ramène au point de départ (fiche, Agenda, Aujourd'hui) ; le placement s'ouvre sur le mois du dernier jour placé, sinon du prochain jour ouvré ; il reçoit l'alerte « jour déjà pris » (Garder les deux / Prendre le jour libre suivant), venue de la fenêtre Les journées (R6) | validé (31/10, P2, R6) |
| Rappel « N journées passées restent à trancher » | Aujourd'hui ▸ En retard **et** ligne en tête de l'Agenda (sa demande d'origine : « à l'ouverture de l'app ou à l'accès au calendrier ») ; dans la grille, le jour porte un « ? » | validé (31/10, P3) |
| Bloc À planifier (Placer, Estimer par ligne) | Agenda, en haut, nommé « À programmer », repliable : engagés d'abord, devis en attente marqués, « temps à estimer » → Estimer, total de jours | validé (31/10, maquette 5b) |
| Grille du mois (une pastille par jour, repère € d'un prélèvement), légende, compteurs du mois | Inchangés sur le fond ; la pastille devient une bande pleine sous le numéro avec fond teinté du statut ; « ? » et bord pointillé pour un jour à trancher ; « € » dans le coin ; 4 compteurs (fait, confirmé dont à trancher, prévu, non travaillé) | validé (31/10, P5) |
| Carte Journée du jour retenu (Prévu, Fait, Ouvrir, ✕, J'ai travaillé) | Fusionnée dans la fiche du jour (tous ses boutons gardés) ; « J'ai travaillé » ouvre Ma journée datée de ce jour ; sous la grille, la place va à l'historique | retrait accepté (31/10, R7) |
| Appui sur un jour → fiche d'un jour (C'était comme prévu, Non travaillé, J'y ai travaillé, Modifier ma journée, Autre chose, Poser un chantier, Fiche, Prélevé ce jour-là) | Une seule fiche du jour, en feuille : statut, Fait (✕, Fiche, appui → Ma journée), Posé (Fiche, Retirer), boutons selon l'état, Prélevé ce jour-là ; en mode placement, l'appui pose le jour | validé (31/10, R7) |
| Fenêtre « Que s'est-il passé ? » (comme prévu, toutes comme prévu, je n'étais pas là, autrement, un autre jour) | Devient la fiche du jour à l'état « à trancher » : mêmes réponses (comme prévu, toutes comme prévu, autrement, un autre jour, je n'y étais pas) ; ouverte depuis Aujourd'hui ▸ Trancher, la ligne à trancher de l'Agenda et le jour | retrait accepté (31/10, R8) |
| Fenêtres Déplacer la journée, Jour non travaillé, Poser un chantier (sur un jour) | Inchangées, ouvertes depuis la fiche du jour ; « Poser un chantier » est la porte « par le jour » du placement (durée 1 h à 8 h) | validé (31/10, P1) |
| Onglet Carte | Chantiers ▸ Carte | validé (V2) |
| Onglet Carnet | Retiré (même écran que Chantiers) | retrait accepté (31/10, R1) |
| Historique des jours et des heures | Agenda, sous la grille : le mois jour par jour, groupé par semaine (heures, quantités, km ; appui → Ma journée) ; et dans chaque chantier (étape Travaux) | validé (31/10, maquette 5b) |

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
| Finances ▸ Dépenses ▸ + Dépense | + ▸ Dépense | validé (30/10) |
| Finances ▸ Charges fixes : résumé, liste (Modifier, Supprimer), Échéances (quand, où part l'argent) | Argent ▸ Dépenses, bloc Charges fixes ; « Échéances » devient « Prélèvements à venir » | validé (31/10) |
| Finances ▸ Charges fixes ▸ + Charge | + ▸ Charge fixe (Plus rare) | validé (31/10, Q1) |
| Dépenses créées seules à chaque échéance ; bouton « La charge » d'une dépense | Inchangés | proposé (inchangé) |
| Finances ▸ Analyses ▸ Vue d'ensemble · Recettes · Dépenses · Déclarations (tout leur contenu) | Argent ▸ Année, mêmes quatre pastilles, contenu intact | validé (31/10) |
| Analyses ▸ sélecteurs de période propres (type et année) | Gardés dans l'onglet Année, qui arrive sur l'année en cours | proposé |
| Analyses ▸ Déclarations ▸ cotisations et impôt, simulateur | Année ▸ Déclarations | validé (31/10) |
| Analyses ▸ Déclarations ▸ versements et récupérations, + Mouvement | Année ▸ Déclarations (s'ajoute à une déclaration, reste sur place) | proposé |
| Taux en double (Réglages ▸ Financier et cases du simulateur) | Réglages = taux de référence ; les cases du simulateur partent de ces taux et servent à essayer sans modifier les Réglages (vérifier le comportement actuel avant de toucher) | proposé |
| Tuile Finances (facturé, TVA à reverser / à récupérer) | Onglet Argent | validé (30/10) |
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
| Enregistrer ma journée (accueil) | + ▸ Ma journée ; aussi la ligne de saisie en tête d'Aujourd'hui ; un chantier posé ce jour-là est pré-choisi | validé (30/10 ; 31/10, P4) |
| J'ai travaillé / J'y ai travaillé / Modifier ma journée / Autre chose (Agenda, fiche d'un jour, Que s'est-il passé ?) | Gardées dans la fiche du jour : elles ouvrent Ma journée datée du jour concerné | validé (31/10, R7, R8) |
| Temps (Carnet), + Du temps fait (fiche) | + ▸ Ma journée | retrait accepté (31/10, R2, R4) |
| Nouveau chantier (avec ou sans devis) | + ▸ Chantier (« on m'en a parlé ») : formulaire court = étape Infos. Pour qui (donneur d'ordre + offre d'ajout ; propriétaire facultatif, « souvent connu plus tard », + offre d'ajout puis question SIREN) · Où, quoi (commune, forêt, type de travaux par familles, quantité ou surface selon l'unité) · Ce que je sais (accès, code du portail) · nom composé affiché · « Annoncé aujourd'hui · changer » · Créer le chantier → la fiche, étapes Infos et Devis ouvertes. Le choix avec / sans devis se fait ensuite dans l'étape Devis | validé (30/10 ; maquette tour 2, 31/10) |
| … champ « Journées à prévoir » du formulaire de création | Étape Devis ▸ Temps estimé (facultatif) | validé (31/10, maquette tour 2) |
| Rendements ▸ Estimer ▸ Créer le devis | Gardé : crée le chantier avec son devis prérempli (suite d'une estimation) | proposé |
| Réglages ▸ Entreprise ▸ Import de données (chantiers, dépenses en masse) | Inchangé | proposé (inchangé) |
| + Dépense | + ▸ Dépense, feuille haute : « Comme la dernière » (fournisseur et catégories, ni date ni montants, D3) · Quand, où (date, fournisseur proposé d'après les dépenses passées, D4) · Le ticket, une ligne par nature d'achat : catégorie en puces (les six plus fréquentes + « Autre… » avec les 19, D1), montant TTC, TVA en boutons 20 / 10 / 5,5 / sans (« sans » d'office et bloqué pour assurance, frais bancaires, prêt, cotisations, D2), litres et prix du litre (carburant), désignation facultative, mention immobilisation · Pour s'y retrouver (n° de pièce, chantier, « concerne le véhicule », carnet + kilométrage si Frais véhicule) · pied fixe (TTC, HT, TVA déductible, immobilisé ; Supprimer en modification, Enregistrer) | validé (30/10 ; 31/10, D1-D5) |
| Case « créer la dépense » (intervention du véhicule), « porter en dépense » (commande) | Inchangées | proposé (inchangé) |
| + note (Mon entreprise) | + ▸ Note : Quoi ?, couleur, premiers éléments facultatifs (Entrée ajoute) ; la note arrive en tête de Mes notes | validé (V2 ; maquette tour 2) |
| Stock ▸ Entrées / sorties ▸ Enregistrer (pastille Entrées) | + ▸ Commande de fournitures | validé (V2) |
| Achats ▸ + Achat | + ▸ Achat à prévoir | validé (V2) |
| Véhicule ▸ + Intervention | + ▸ Noter une intervention | validé (V2) |
| Bois ▸ Nouvelle pile (onglets Stock et Piles) | Dans l'outil seulement, un seul bouton (onglet Stock) ; le second (onglet Piles) est retiré ; pas d'entrée dans le + | validé (31/10, Q2) |
| Cubage ▸ Bordereaux ▸ tuiles de choix du cubage (créent un bordereau) | Dans l'outil seulement, inchangé ; pas d'entrée dans le + | validé (31/10, Q2) |
| Finances ▸ Charges fixes ▸ + Charge | + ▸ Charge fixe | validé (31/10, Q1) |
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
| Stock ▸ Rentabilité (Hypothèses, Simulateur, Coûts, Performance, Par année) | ☰ ▸ Stock ▸ Rentabilité, intacte | validé (31/10) |
| Tuile Stock (valeur, à recommander) | Sous-titre de la tuile ☰ ; à recommander aussi dans Aujourd'hui ▸ Bientôt | validé (V2 ; 31/10, Q4) |
| Achats ▸ Ma liste (groupée par priorité, case acheté / remettre, ligne → fenêtre) ; Ce que ça pèse | ☰ ▸ Achats à venir, intacts | validé (V2) |
| Véhicule ▸ Carnet (fiche, Noter le compteur, historique, Modifier) ; Échéances (+ Poste, Modifier) ; Coûts (+ Compléter la fiche) | ☰ ▸ Véhicule, intacts ; « Carnet » devient le seul carnet de Sylve | proposé |
| Tuile Véhicule (km, échéances dépassées) | Sous-titre de la tuile ☰ ; échéances aussi dans Aujourd'hui (En retard / Bientôt) | validé (V2 ; 31/10, Q4) |
| Rendements ▸ Rendements (tri, Détail, Estimer) ; Estimer (formulaire, Créer le devis, références) | ☰ ▸ Rendements, intacts | validé (V2) |
| Rendements ▸ + Noter une cadence | Création depuis la fiche du chantier (tuile Rendement). La porte de ☰ ▸ Rendements est gardée pour les cadences générales « sans chantier » (repère tant qu'aucun chantier fini n'a de vrai suivi) | validé (31/10, Q1) |
| Tuile Rendements (nombre de références) | Sous-titre de la tuile ☰ | validé (V2) |

---

## 8. ☰ ▸ Outils de terrain

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Cubage : Saisie, Bordereau, Synthèses (Synthèse, Financière, Bûcheron, Martelage), Bordereaux, exports (Excel, CSV, .json, Coller depuis Excel) | ☰ ▸ Cubage, intérieur inchangé | proposé (inchangé) |
| Bois de chauffage : Stock, Piles, Où ?, Export et analyse | ☰ ▸ Bois de chauffage, intérieur inchangé | proposé (inchangé) |
| Boutons de création internes (Nouvelle pile ×2, tuiles de cubage) | Gardés dans les outils ; Nouvelle pile une seule fois (onglet Stock) | validé (31/10, Q2) |
| Libellés en double propres aux outils (« Bordereau » / « Bordereaux », « Stock » du bois) | Notés, non traités : les outils restent tels quels | proposé |

---

## 9. Réglages, Sauvegarde, Corbeille

| Ancien | Nouvel endroit | Statut |
|---|---|---|
| Réglages (Général, Entreprise, Cubage, Bois de chauffage ; zones déroulées) | ☰ ▸ Réglages, mêmes pastilles et zones | validé (V2) |
| Général ▸ Mon entreprise (nom, logo) | Réglages ▸ Entreprise, en tête (une seule « Entreprise ») | proposé |
| Général ▸ L'application (installer, protéger les données, mises à jour, durée de l'écran de démarrage, écran allumé) | Inchangé | proposé (inchangé) |
| Général ▸ Sauvegarde (Tout sauvegarder, Restaurer — fusionner ou remplacer) | ☰ ▸ Sauvegarde, écran propre (sort des Réglages : une seule porte) : état (en rouge au-delà de 30 jours) et contenu du fichier, « Tout sauvegarder » en gros, Restaurer un fichier (fusionner / remplacer, demandé à chaque fois), Corbeille ; « ← » revient à l'écran d'où l'on vient | validé (31/10, maquette tour 2) |
| Général ▸ Sauvegarde ▸ Corbeille… | ☰ ▸ Corbeille, écran propre | proposé |
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
| Le chantier (identité) | Encadré de la fiche | proposé |
| L'estimation | Étape Devis ▸ Temps estimé | proposé |
| Le devis | Étape Devis | validé (V2) |
| La facture | Étapes Facture et Payé | validé (V2) |
| Le peuplement | Étape Infos et repérage | proposé |
| Note du chantier | Tuile Note | validé (V2) |
| Ligne de travaux | Étape Devis (et Facture si les lignes changent) | validé (V2) |
| Temps passé | Fusionnée dans Ma journée ; rattrapage sans date dans l'étape Travaux | retrait accepté (31/10, R4) |
| Les journées | Éclatée : estimées → Devis ; dates → Agenda (placement) | retrait accepté (31/10, R6) |
| Statut (+ motif de refus, + n° de facture) | Gestes des étapes ; « Corriger l'étape à la main » | proposé |
| L'objectif de ce chantier | ✎ du troisième chiffre | proposé |
| Ma journée | + ; Aujourd'hui (ligne de saisie) ; fiche du jour ; historique de l'Agenda et Derniers jours (modifier) | validé (31/10, maquette 5b) |
| Fiche d'un jour | Appui sur un jour de l'Agenda ; Aujourd'hui ▸ Trancher ; ligne à trancher et bouton Aujourd'hui de l'Agenda. Absorbe la carte Journée et « Que s'est-il passé ? » | validé (31/10, R7, R8) |
| Que s'est-il passé ? | Fondue dans la fiche du jour (état « à trancher ») | retrait accepté (31/10, R8) |
| Déplacer la journée · Jour non travaillé · Poser un chantier | Depuis la fiche du jour | validé (31/10) |
| Placer un chantier sur la carte | Étape Infos ; Chantiers ▸ Carte | proposé |
| Dépense | + ▸ Dépense ; liste Argent ▸ Dépenses (modifier, supprimer dans la feuille) | validé (31/10, D1-D5) |
| Charge fixe | + ▸ Charge fixe ; liste Charges fixes (modifier) | validé (31/10) |
| Mouvement (versement / récupération) | Année ▸ Déclarations | proposé |
| Hypothèses (rentabilité) | Stock ▸ Rentabilité | proposé (inchangé) |
| Article · Fiche d'un article · Fournisseur | Réglages ▸ Stock et fournitures ; Inventaire (ligne) | proposé (inchangé) |
| Commande | + ▸ Commande ; Entrées (Reçue, Modifier) | validé (V2) |
| Sortie de stock | Stock ▸ Sorties ; automatique depuis la facture | proposé |
| Import de fournitures | Stock ▸ Importer | proposé (inchangé) |
| (nouvelle) Compter le stock | Stock ▸ Inventaire, Stock ▸ Pertes, fiche d'un produit | validé (31/10, S3) |
| (nouvelle) Noter le repérage | Fiche ▸ étape Infos et repérage | validé (31/10, C2) |
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
| À planifier | « À programmer » (son mot) partout : étape, bloc de l'Agenda, ligne d'Aujourd'hui |
| Dépenses / achats / acheté | « Dépenses » partout ; « Achats à venir » garde son nom de module |
| Notes | « Mes notes » = pense-bêtes ; « Note » = celle d'un chantier, d'une journée, d'un achat |
| Fiche / Fiche de chantier | « Fiche » (le dossier) ; « Fiche sécurité » (le document imprimé) |
| Carnet | Seul celui du véhicule reste |
| Entreprise | Groupe « Entreprise » du ☰ et pastille « Entreprise » des Réglages (nom et logo y vont) |
| Terminé | « Travaux terminés » (étape et case de Ma journée) ; fin de placement : « Fini de placer » |
| Échéances | « Prélèvements » pour les charges fixes ; « Échéances » pour le véhicule ; « échéance » d'une facture |
| Client / propriétaire | « Propriétaire » partout ; l'encadré de la fiche dit « Facturé à : … » |
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
| R1 | Onglet Carnet de l'Agenda | Chantiers (même écran) | accepté (31/10) |
| R2 | Boutons Temps et Statut sur chaque ligne de la liste | + ▸ Ma journée ; fiche (étapes) | accepté (31/10) |
| R3 | Précédente / Suivante de la fiche | — | **refusé (31/10) : on les garde** |
| R4 | Fenêtre Temps passé | Ma journée ; rattrapage sans date dans l'étape Travaux | accepté (31/10) |
| R5 | Second bouton Nouvelle pile (Bois ▸ Piles) | Bouton de l'onglet Stock | accepté (31/10, Q2) |
| R6 | Dates posées à la main dans la fenêtre « Les journées » de la fiche | Placement dans l'Agenda (alerte jour déjà pris, jour libre suivant) | accepté (31/10) |
| R7 | Carte « Journée » sous la grille de l'Agenda (fusion) | Fiche du jour, tous ses boutons | accepté (31/10) |
| R8 | Fenêtre « Que s'est-il passé ? » (fusion) | Fiche du jour à l'état « à trancher », mêmes réponses | accepté (31/10) |
| — | Bandeau (logo-bouton, ←, sélecteur), ↩ de Mon entreprise, écrans Accueil et Mon entreprise, bulles et tuiles | Barre du bas, ☰, Aujourd'hui, Argent | validé (30-31/10) |

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
- **P4** — Ma journée : un chantier posé ce jour-là est pré-choisi (forêt, commune, km et prestations remplis s'ils sont vides, jamais par-dessus ce qui est tapé).
- **P5** — Grille : bande pleine sous le numéro et fond teinté par statut ; « ? » et bord pointillé pour un jour à trancher ; « € » dans le coin ; le bouton Aujourd'hui ouvre la fiche du jour.
- **R6, R7, R8** acceptés (section 12).
- Ma journée, forme retenue : bouton « Comme le … » en tête ; blocs « Quand, où » (date, chantier, forêt, commune) / « Mon temps » (temps total, prestations avec heures productives et quantité, rendement par jour sous chacune, ligne hors production) / « Trajet » (heures, km, personnes) ; puis « Ce chantier est terminé » et Note ; pied fixe avec le total (heures, journées, montant au prix de journée du chantier) et Enregistrer. Le formulaire ne se reconstruit jamais pendant la frappe : le clavier ne doit pas se refermer.

### Étape 5b, tour 2 (maquette `maquettes/refonte-5b-tour2.html`, validée le 31/10)

- **D1** — Dépense : catégorie en tête de ligne, en puces (Consommable, Repas, Carburant, EPI, Petit outillage, Fournitures) + « Autre… » qui ouvre la liste des 19.
- **D2** — TVA « sans » d'office et bloquée pour Assurance, Frais bancaires, Prêt, Cotisations (catégories `sansTva`, comme déjà dans les charges fixes) ; retour à 20 % si on change pour une catégorie avec TVA.
- **D3** — « Comme la dernière » : reprend le fournisseur et les catégories (et taux) de la dernière dépense hors charges fixes ; ni la date ni les montants ni les litres.
- **D4** — Fournisseur proposé d'après les dépenses passées (liste qui se remplit seule, rien à régler).
- **D5** — Supprimer une dépense : dans sa feuille ; la ligne de la liste s'ouvre d'un appui.
- **C1** — Chantier à l'étape Infos : une ligne « Devis à faire » dans Bientôt, « pas encore repéré » en petit ; plus de « Repérage à faire ».
- **C2** — « Noter le repérage » en une fois : date, position, peuplement, ce que j'ai vu.
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
