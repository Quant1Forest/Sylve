# Sylve — mettre l'application sur le téléphone

Pour qu'Android propose « Installer », l'application doit être servie par une
adresse `https://`. C'est la seule contrainte : ensuite tout fonctionne hors
réseau, en forêt, sans compte et sans abonnement.

## 1. Publier les fichiers (une seule fois, ~10 minutes)

Le plus simple est GitHub Pages, gratuit et sans maintenance.

1. Créer un compte sur **github.com**.
2. **New repository** → nom au choix → **Public** (les dépôts privés demandent
   un abonnement payant pour Pages) → **Create**.
3. **Add file ▸ Upload files** → glisser **le contenu** de ce dossier
   (`index.html`, `sw.js`, `manifest.webmanifest`, les quatre icônes) — pas le
   dossier lui-même → **Commit changes**.
4. **Settings ▸ Pages** → *Source* : **Deploy from a branch** → branche `main`,
   dossier `/ (root)` → **Save**.
5. Au bout d'une ou deux minutes, l'adresse s'affiche sur cette même page :
   `https://VOTRE-COMPTE.github.io/VOTRE-DEPOT/`

Le dépôt est public : c'est le programme qui est visible, jamais vos
bordereaux — ils ne quittent pas le téléphone.

## 2. Installer sur le téléphone

1. Ouvrir l'adresse dans **Chrome** sur le téléphone, une première fois **avec
   du réseau**.
2. Menu **⋮ ▸ Installer l'application** (ou le bouton *Installer sur l'écran
   d'accueil* dans **Réglages ▸ Application**).
3. L'icône apparaît sur l'écran d'accueil. L'application se lance en plein
   écran, sans barre d'adresse, et fonctionne ensuite sans réseau.

Un appui long sur l'icône ouvre directement la **saisie**, le **bois de
chauffage** ou les **synthèses**.

## 3. Deux points à connaître

**L'adresse ne doit plus changer.** Les bordereaux sont enregistrés par le
navigateur et rattachés à l'adresse du site. Si vous déménagez l'application
ailleurs, exportez d'abord vos bordereaux en JSON (*Bordereaux ▸ Exporter*) et
réimportez-les depuis la nouvelle adresse.

**Sauvegardez de temps en temps.** L'application se protège toute seule sur
trois niveaux : deux copies internes indépendantes, une copie complète
automatique par jour gardée une semaine, et une corbeille de trente jours pour
les bordereaux supprimés (*Bordereaux ▸ Sauvegarde ▸ Récupérer*). Tout ça vit
dans le téléphone : si le téléphone disparaît, tout disparaît. Le bouton
**Tout sauvegarder** envoie un fichier unique par mail, WhatsApp ou vers le
drive ; l'application vous rappelle quand ça date de plus d'une semaine.

## 4. Mettre à jour

Quand une nouvelle version arrive : dépôt GitHub ▸ **Add file ▸ Upload files**,
déposer les fichiers reçus, **Commit changes**. Les fichiers de même nom sont
remplacés, c'est voulu. À la prochaine ouverture **avec du réseau**,
l'application repère la nouvelle version et propose de l'installer
(*Réglages ▸ Application ▸ Installer la mise à jour*). Les bordereaux ne sont
jamais touchés par une mise à jour.

## Sans rien publier

`Sylve.html` est la même application en un seul fichier : ouvrable depuis la
mémoire du téléphone ou une clé USB, sans adresse et sans installation. On perd
l'icône, le plein écran, les mises à jour automatiques et la protection du
stockage — d'où l'intérêt de la version publiée.
