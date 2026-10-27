# La fiche de chantier (document obligatoire)

Le document réglementaire imprimé : risques, réseau, croquis.

## La fiche de chantier

Document **obligatoire** — décret n° 2010-1603 du 17 décembre 2010, arrêté du
31 mars 2011. Il en a passé quatre modèles ; celui qu’il retient est **celui
de Pro ETF**, qui numérote les risques de 1 à 33. **Le
numérotage est repris tel quel** : la légende du croquis demande de reporter
le numéro sous chaque symbole, un ordre à nous n’aurait servi personne.

`RISQUES_FICHE` porte les six groupes du modèle, `RESEAUX_FICHE` les cinq
crans de couverture téléphonique — *« des fois tu captes, mais pas beaucoup »*,
et c’est sur cette nuance que se décide où l’on court pour donner l’alerte.

**La fiche vit sur le chantier** (`c.fiche`), donc elle part dans les
sauvegardes sans nouveau format. Une troisième vue du module Chantiers, avec
un **filtre** sur la liste : *« je filtre chantier ouvert, comme ça je n’ai
pas à chercher dans une liste assez grande »*.

**Ce que Sylve ignore s’écrit « à compléter », jamais un blanc.** Un blanc sur
une fiche de sécurité se lit comme une absence de risque. La fiche s’imprime
quand même — une fiche incomplète sur le chantier vaut mieux qu’aucune fiche —
mais `manquesFiche()` énumère ce qui manque à l’écran, et la feuille le dit en
rouge à sa place.

**Le seuil est celui des quatre hectares, et lui seul.** La loi en pose trois
— 100 m³ manuel, 500 m³ mécanisé, 4 ha sylvicole. *« Ça n’arrivera jamais de
faire cent mètres cubes, je ne fais que des travaux sylvicoles. »* Annoncer un
seuil qu’il ne rencontrera pas n’aurait fait que du bruit. Le rappel vit **sur
la fiche du chantier**, là où il chiffre, pas dans un écran qu’il ouvrirait
après coup.

## Ce que la fiche de chantier n'exige pas

**Le téléphone du propriétaire est facultatif.** *« Est-ce que c'est vraiment
obligatoire, le téléphone du propriétaire ? Limite le donneur d'ordre, ok,
mais le propriétaire… »* L'arrêté demande « nom et coordonnées » du
propriétaire, et nomme explicitement le « téléphone du donneur d'ordre ».
Réclamer les deux en rouge, c'était inventer une obligation. La feuille écrit
donc un tiret à cette ligne, et le champ porte « (facultatif) ». Celui du
donneur d'ordre reste réclamé.

**Un plan joint libère le cadre du croquis.** *« La carte est en A4, alors que
l'emplacement du croquis c'est une zone restreinte — alors comment on fait à
ce moment-là ? »* On ne serre pas un A4 dans 52 mm : quand `f.planJoint` est
coché, le cadre cède la place à une mention — *« Voir le plan joint à la
présente fiche »* — et le plan vit à côté, entier, comme il le fait déjà.

**Les risques se reprennent d'un chantier de la même forêt.** *« Si c'est le
même nom, ça pourrait être le cas. Pourquoi pas. »* C'est lui qui a proposé le
critère, et c'est le seul dont Sylve dispose. `memeForet(c)` retient le
chantier **le plus récent** qui porte le même nom de forêt **et la même
commune** — deux « Bois du Haut » dans deux communes ne sont pas la même forêt
— et qui a déjà des risques cochés.

- **Ne se reprend que ce qui décrit le lieu** : les risques, leurs consignes,
  la proportion, et l'accès et le réseau s'ils sont vides. **Pas le point de
  rencontre** : il dépend du chantier, pas de la forêt.
- **L'offre disparaît dès qu'un risque est coché.** Proposer de tout remplacer
  quand il a déjà travaillé serait un piège.
