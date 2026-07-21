# BordCub — mettre l'application sur le téléphone

Pour qu'Android propose « Installer », l'application doit être servie par une
adresse `https://`. C'est la seule contrainte : ensuite tout fonctionne hors
réseau, en forêt, sans compte et sans abonnement.

## 1. Publier les fichiers (une seule fois, ~10 minutes)

Le plus simple est GitHub Pages, gratuit et sans maintenance.

1. Créer un compte sur **github.com**.
2. **New repository** → nom `bordcub` → **Public** (les dépôts privés demandent
   un abonnement payant pour Pages) → **Create**.
3. **Add file ▸ Upload files** → glisser **le contenu** de ce dossier
   (`index.html`, `sw.js`, `manifest.webmanifest`, les quatre icônes) — pas le
   dossier lui-même → **Commit changes**.
4. **Settings ▸ Pages** → *Source* : **Deploy from a branch** → branche `main`,
   dossier `/ (root)` → **Save**.
5. Au bout d'une ou deux minutes, l'adresse s'affiche sur cette même page :
   `https://VOTRE-COMPTE.github.io/bordcub/`

Le dépôt est public : c'est le programme qui est visible, jamais vos
bordereaux — ils ne quittent pas le téléphone.

## 2. Installer sur le téléphone

1. Ouvrir l'adresse dans **Chrome** sur le téléphone, une première fois **avec
   du réseau**.
2. Menu **⋮ ▸ Installer l'application** (ou le bouton *Installer sur l'écran
   d'accueil* dans **Réglages ▸ Application**).
3. L'icône apparaît sur l'écran d'accueil. L'application se lance en plein
   écran, sans barre d'adresse, et fonctionne ensuite sans réseau.

Un appui long sur l'icône ouvre directement la **saisie**, les **bordereaux**
ou les **synthèses**.

## 3. Deux points à connaître

**L'adresse ne doit plus changer.** Les bordereaux sont enregistrés par le
navigateur et rattachés à l'adresse du site. Si vous déménagez l'application
ailleurs, exportez d'abord vos bordereaux en JSON (*Bordereaux ▸ Exporter*) et
réimportez-les depuis la nouvelle adresse.

**Sauvegardez de temps en temps.** Une fois installée, l'application demande à
Android de protéger ses données contre l'effacement automatique — l'état est
affiché dans *Réglages ▸ Application*. Ça ne remplace pas un export JSON de
fin de journée sur le drive ou par mail.

## 4. Mettre à jour

Réuploader les fichiers modifiés sur GitHub. À la prochaine ouverture avec du
réseau, l'application détecte la nouvelle version et propose de l'installer
(*Réglages ▸ Application ▸ Installer la mise à jour*). Les bordereaux ne sont
pas touchés.

## Sans rien publier

`BordCub.html` est la même application en un seul fichier : ouvrable depuis la
mémoire du téléphone ou une clé USB, sans adresse et sans installation. On perd
l'icône, le plein écran, les mises à jour automatiques et la protection du
stockage — d'où l'intérêt de la version publiée.
