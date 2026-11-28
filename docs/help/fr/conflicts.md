---
title: Résoudre les conflits
category: Travailler sur les changements
order: 32
summary: Un seul écran pour toute l'étape en conflit — chaque fichier, l'ancêtre commun, une réponse par conflit, et la ligne d'arrivée.
keywords: conflit conflict résolveur resolver fusion merge conflits ours theirs nôtre leur base ancêtre commun résoudre resolve marqueurs markers three-way supprimé renommé modify delete rename rerere réutiliser résolution enregistrée mémoriser rejouer terminer continuer abandonner
---

# Résoudre les conflits

Quand une fusion, un rebase, un cherry-pick ou un revert s'arrête, le résolveur
fait de toute l'étape un seul écran. La barre du haut dit **ce qui** s'est
arrêté et **entre quoi** — « Fusion de `feature` dans `main` », et pas
simplement « conflit » — et où vous en êtes : *2 sur 5 fichiers* résolus, avec
les conflits qui restent sur l'ensemble des fichiers.

![Le résolveur de conflits](../../screenshots/conflict-resolver.webp)

## La bande des fichiers

Sous la barre, une pastille par fichier sur lequel cette étape s'est arrêtée :

| Pastille | Signifie |
|---|---|
| Verte avec ✓ | Résolu — indexé, plus rien à décider |
| Cerclée | Le fichier sur lequel vous êtes |
| Un nombre rouge | Combien de blocs en conflit le fichier contient encore |
| Une étiquette | Un conflit sans texte à fusionner : *supprimé d’un côté*, *renommé des deux côtés*, *ajouté d’un côté* |

Les pastilles résolues viennent d'abord et les ouvertes ensuite, chaque groupe
par ordre de nom : la bande se lit comme le fait à gauche et le reste à droite.

**Fichier suivant →** saute au prochain fichier encore ouvert, et marquer un
fichier comme résolu vous y emmène de lui-même. **Continuer** dans la barre reste
désactivé tant que toutes les pastilles ne sont pas vertes ; **Abandonner**
demande d'abord et dit ce que vous perdez.

git oublie un fichier dès qu'il est indexé : « résolu » désigne donc ce que
GitHuttBr a vu pendant cette étape, plus les fichiers que git a listés dans son
message de fusion. Un fichier indexé dans un terminal avant d'ouvrir le résolveur
compte quand même ; après un redémarrage en plein rebase, la moitié résolue de
cette étape peut ne pas compter.

## Pourquoi ça entre en conflit

**Pourquoi ça entre en conflit**, dans l'en-tête du fichier, liste par côté les
commits qui ont touché ce fichier depuis que les branches se sont séparées —
c'est `git log --merge`, que git livre depuis toujours et que personne ne trouve.

![Les commits de chaque côté ayant touché le fichier en conflit](../../screenshots/conflict-why.webp)

Les marqueurs disent ce qui s'oppose. Ceci dit qui l'a modifié et pourquoi, ce
qui est généralement ce qui tranche réellement la résolution. Une liste vide
signifie qu'aucun des deux côtés n'a validé de changement sur ce chemin exact —
l'opposition vient d'un renommage ou d'un déplacement.

L'en-tête dit aussi sur quel conflit vous êtes et de quel type de conflit il
s'agit pour le fichier, lu dans le statut de git lui-même : *les deux côtés ont
modifié les mêmes lignes*, *ajouté des deux côtés*.

## Les trois panneaux

| Panneau | C'est |
|---|---|
| **Votre côté** | Le côté où vous étiez, surmonté du commit le plus récent de ce côté ayant touché le fichier : sha, sujet, auteur, il y a combien de temps |
| **Base** | La version dont les deux côtés sont partis — l'ancêtre commun ou, pour un pick ou une étape de rebase, le parent du commit appliqué. Les lignes que chaque conflit a remplacées sont ombrées |
| **Entrant** | Le côté qui arrive, surmonté de la même façon que Votre côté |

**Afficher la base**, dans l'en-tête du résultat, masque ou affiche le panneau
Base et retient votre choix. Il est grisé quand il n'y a pas de base — les deux
côtés ont ajouté le fichier.

Tous les panneaux se redimensionnent, et l'en-tête du résultat porte deux
bascules d'affichage :

| Bascule | Ce qu'elle fait |
|---|---|
| **Retour à la ligne** | Coupe les lignes longues dans les panneaux latéraux au lieu de les faire défiler. La vue texte du résultat garde une rangée par ligne — ses marqueurs latéraux en dépendent — donc elle défile toujours |
| **Lier le défilement** | Fait défiler les panneaux et le résultat ensemble, verticalement et latéralement. Leurs nombres de lignes diffèrent, donc la position verticale est alignée par proportion |

Le retour à la ligne démarre désactivé, Lier le défilement démarre activé, et les
deux retiennent leur état.

## Le résultat

Le résultat est le fichier tel qu'il sera écrit. Chaque conflit y reste à sa
place sous forme de carte portant quatre réponses :

| Réponse | Ce qui arrive dans le fichier |
|---|---|
| **Prendre le vôtre** | Vos lignes, et seulement les vôtres |
| **Prendre le leur** | Leurs lignes, et seulement les leurs |
| **Les deux** | Vos lignes, puis les leurs |
| **Modifier** | Les deux, ouvertes dans l'éditeur de texte avec le conflit sélectionné, pour quand la réponse est « les deux, mais ajustées » |

Une carte sans réponse prévisualise les deux côtés, chaque ligne marquée
*← vôtre* ou *← leur* et numérotée avec la ligne où elle arrivera si vous la
prenez : vous décidez sans lever les yeux. Sur un fichier aux lignes très
longues, les réponses restent visibles pendant que le code défile latéralement
dessous. **Fichier entier : le vôtre | le leur**, dans l'en-tête du fichier,
répond à tous les conflits d'un coup.

**Modifier en texte** bascule le résultat vers un éditeur simple pour taper
librement, avec le nombre de lignes du fichier dans l'en-tête. Dès que vous avez
tapé, les cartes ne décrivent plus ce qui est là : le texte reste donc tel quel
jusqu'à ce que **Réinitialiser les choix** remette tout en place.

Le pied compte ce qui reste dans ce fichier ; **Marquer *fichier* comme résolu**
écrit le résultat et l'indexe, et reste désactivé tant que chaque conflit n'a pas
de réponse.

## Se déplacer

Ouvrir un fichier vous amène sur son **premier conflit**, pas en haut du
fichier. Les flèches ⌃ / ⌄ de l'en-tête du résultat — ou <kbd>Alt+↑</kbd> /
<kbd>Alt+↓</kbd> — parcourent les suivants, en faisant défiler chaque panneau
jusqu'à chacun.

## Choisir ligne par ligne

Les panneaux latéraux choisissent toujours par **ligne** et par **bloc**, et la
case de leur en-tête prend le **côté entier** — pour la réponse qu'aucune carte
ne propose, comme deux lignes à vous et une à eux. Les choix ligne par ligne
apparaissent dans les cartes à mesure.

## Fichiers sans rien à fusionner

Certains conflits n'ont pas de lignes à comparer : un côté a **supprimé** un
fichier que l'autre a modifié, ou les deux côtés l'ont **renommé** sous des noms
différents. Trois panneaux dont un vide n'expliqueraient rien, alors ces cas ont
droit à une carte — qui a fait quoi, avec le commit, l'auteur et l'âge de chaque
côté.

![Un fichier supprimé d'un côté et modifié de l'autre](../../screenshots/conflict-deleted.webp)

| Cas | Choix |
|---|---|
| Supprimé d’un côté | **Garder le fichier** (avec les modifications de l'autre côté), **Supprimer le fichier** (demande d'abord), et **Voir ce que vous avez modifié** — le diff depuis la base, pour savoir ce que la suppression jette |
| Renommé des deux côtés | **Garder** un nom, l'autre, ou **les deux noms** |

git n'enregistre aucun lien entre un original renommé et ses deux nouveaux noms,
donc la carte les apparie par contenu. Quand elle ne peut pas trancher —
plusieurs renommages à la fois, et les fichiers modifiés en plus — elle le dit,
et les nouveaux noms apparaissent comme leurs propres pastilles.

## Terminer

Quand le dernier fichier est résolu, l'espace de travail ne vous envoie pas
chercher **Continuer** : une carte résume comment les conflits ont été tranchés,
vous laisse modifier le message de fusion (prérempli avec celui de git) et
termine depuis là.

![Tous les conflits résolus, avec le message de fusion et l'interrupteur rerere](../../screenshots/conflict-done.webp)

- Le résumé compte ce qu'il vous a vu choisir : le vôtre, le leur, les deux,
  modifié à la main. Un fichier résolu en dehors du résolveur compte comme un
  fichier, pas comme une réponse.
- Une étape de **rebase** garde le message propre du commit rejoué, donc il n'y a
  pas de zone de message pour elle.
- **Retenir ces résolutions (rerere) pour la prochaine fois** est le
  `rerere.enabled` de git, le même interrupteur que dans les Paramètres. git ne
  retient que les conflits qu'il a vus se produire : l'activer ici prend effet à
  partir du suivant.
- **Revoir** ferme le résolveur sur le résultat indexé.

## Annuler

Chaque résolution — un fichier marqué résolu, un côté pris, un fichier gardé ou
supprimé, un renommage tranché — a une entrée d'annulation. Annuler remet le
conflit exactement comme git l'avait laissé : les marqueurs, les deux côtés et la
base dans l'index, le fichier sur le disque. **Abandonner** est la seule chose
qui ne peut pas être annulée, et c'est pourquoi il demande.

## Assistance IA

Avec l'IA activée, **Résoudre avec l’IA** propose une fusion dans le résultat,
sous forme de texte. Elle n'applique jamais rien d'elle-même : vous la lisez,
l'éditez et l'indexez. Voir [Fonctions IA](ai.md).

## Fichiers de projet Xcode

`project.pbxproj` entre en conflit plus que tout autre fichier d'un dépôt iOS,
et presque jamais parce que quelqu'un aurait été en désaccord. C'est un
dictionnaire plat d'objets indexés par des identifiants de 24 caractères
hexadécimaux : ajouter un fichier écrit donc quatre entrées — un `PBXBuildFile`,
un `PBXFileReference`, une ligne dans les `children` du groupe qui le contient,
une ligne dans la phase de compilation de la cible. Deux personnes qui ajoutent
un fichier chacune écrivent huit entrées qui tombent sur les mêmes quelques
lignes. Git voit une collision ; il n'y a rien à résoudre.

Quand le fichier en conflit est un `project.pbxproj`, le résolveur lit les trois
versions comme des projets plutôt que comme du texte et propose de **fusionner
par structure** : apparier les objets par identifiant, prendre tous les ajouts
des deux côtés, unir les tableaux `children` et `files`, et s'arrêter sur ce qui
a réellement divergé. Le bandeau au-dessus des panneaux indique ce que chaque
côté a ajouté et ce qui — le cas échéant — vous reste à trancher.

Comme la proposition de l'IA, elle atterrit dans le résultat et
n'indexe rien. Vous la relisez avant d'enregistrer.

![Le bandeau de fusion structurelle au-dessus des panneaux de conflit, sur un fichier de projet Xcode](../../screenshots/conflict-pbxproj.webp)

### Ce qu'elle refuse de faire

**Elle ne devine jamais un réglage que vous avez tous les deux déplacé.** Si
vous mettez `MARKETING_VERSION` à `1.1` et eux à `2.0`, c'est une décision,
nommée dans le bandeau — le réglage, votre valeur, la leur — plutôt que réglée
dans votre dos. Un objet qu'elle n'a pas pu trancher conserve *votre* version à
l'identique : une fusion à moitié appliquée n'atteint jamais le disque.

**Elle refuse le fichier entier si l'une des trois versions ne s'analyse pas.**
Un `project.pbxproj` que Xcode ne peut pas ouvrir coûte plus cher qu'une fusion
manuelle ; tout ce qu'elle ne peut pas lire avec certitude reste donc un conflit
de texte ordinaire, et elle le dit.

**Elle ne détecte pas deux identifiants créés pour des objets différents.**
C'est rare, Xcode les tirant au hasard — mais quand cela arrive, prendre l'un ou
l'autre côté supprimerait silencieusement le fichier de quelqu'un : c'est donc
signalé plutôt que fusionné.

### Pas `merge=union`

Le remède qui circule pour cela est `*.pbxproj merge=union` dans
[`.gitattributes`](attributes.md). À éviter. L'union fonctionne tant que les
seuls changements sont des ajouts indépendants ; dès que deux personnes
modifient le même réglage de compilation, elle émet les deux lignes et produit
un fichier que Xcode refuse d'ouvrir — au moment précis où vous avez le moins de
chances de relire le diff attentivement. La fusion structurelle offre le même
confort sans cette défaillance.

## Fichiers de verrouillage

`Podfile.lock`, `Package.resolved`, `yarn.lock` et leurs cousins enregistrent un
graphe de dépendances que le résolveur de quelqu'un a déjà résolu. La moitié
d'une solution cousue à la moitié d'une autre est un graphe que personne n'a
résolu : il peut ne pas s'installer, et s'il s'installe, il installe quelque
chose qu'aucune des deux branches n'a testé.

Aussi, quand le fichier en conflit est un lockfile, le bandeau nomme l'outil qui
le gouverne, propose **Garder les nôtres** et **Garder les leurs** sur place, et
vous donne la commande qui le régénère ensuite. Prendre un côté n'est pas un
compromis ici — c'est toute la méthode, et c'est la régénération qui la rend
correcte.

![Le bandeau de lockfile au-dessus des panneaux de conflit](../../screenshots/conflict-lockfile.webp)

Les trois panneaux restent disponibles, car de temps à autre vous voulez lire ce
qui a changé : une somme de contrôle que vous reconnaissez, une version que vous
attendiez. C'est de les modifier à la main que ceci cherche à vous dissuader.

## Les éviter en amont

Le [radar de conflits](conflict-radar.md) vous dit quelles branches vont entrer
en conflit avant que vous n'en fusionniez aucune.

## Laisser git se souvenir (rerere)

Rebasez une branche de longue durée et vous rencontrez le même conflit à chaque
fois. `rerere` — *reuse recorded resolution* — est la réponse de git : il
mémorise comment vous avez tranché un conflit et rejoue cette réponse la
prochaine fois que le conflit identique se présente.

**Paramètres → Git et synchronisation → Mémoriser les résolutions de conflits.** Cela écrit
`rerere.enabled` dans votre configuration git globale : la ligne de commande se
comporte donc de la même façon.

Quand git a répondu à votre place, le résolveur le dit au lieu d'afficher un
écran vide « aucun marqueur de conflit », et propose **Oublier cette résolution**
— ce qui efface la mémoire *et* fait revenir le conflit, pour que vous puissiez
le trancher autrement.

Deux choses à savoir :

- **Une résolution rejouée n'est pas indexée**, sauf si vous activez *Indexer
  automatiquement une résolution rejouée*. Laissez cela désactivé : tout
  l'intérêt de la pause est qu'une réponse mémorisée peut être fausse pour cette
  fusion-ci, et indexer sans regarder est exactement la façon dont elle atteint
  un commit.

  C'est pourquoi un fichier rejoué **reste dans les fichiers en conflit** : git a
  écrit le contenu, mais l'index le tient toujours pour non fusionné, et seule
  l'indexation règle cela. **Indexer tel quel** dans le résolveur, ou **Tout
  marquer comme résolu** dans la liste, est ce qui le déplace.
- **rerere ne comprend pas tous les conflits.** Les conflits ajout/ajout et
  suppression/modification n'obtiennent pas de préimage : ils reviennent donc
  toujours bruts. Le compteur dans les paramètres indique combien il en détient
  réellement, et **Tout oublier** le vide.

**Voir aussi :** [Radar de conflits](conflict-radar.md) · [Fusion et rebase](merging.md)
