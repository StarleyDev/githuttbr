---
title: Page des pull requests
category: Synchronisation et multi-dépôts
order: 57
summary: Toutes les pull requests d’un dépôt sur une page — par état, filtrées par auteur, relecteur, cible et CI —, ‹ › pour parcourir la liste filtrée depuis une PR, et des commentaires sur une ligne de son diff.
keywords: pull requests liste page merge requests pr mr filtre auteur relecteur les miennes en attente de ma relecture relecture demandée ci en échec branche cible brouillons fusionnées fermées recherche tri précédent suivant alt flèche navigation checkout aller à la branche source cible copier le nom de la branche fetch commentaire de ligne commentaire en ligne commentaire de relecture commentaire de diff commenter une ligne onglet fichiers revue de code line comment
source: d1deab4d48f6f6327673e61daecb55ede0889881
---

# Page des pull requests

Un dépôt actif a vingt pull requests ouvertes en même temps. La barre latérale
les liste, mais une ligne chacune en dit peu : qui a ouvert laquelle, lesquelles
vous attendent, lesquelles sont passées au rouge. Pour le savoir, il fallait les
ouvrir une par une, lire, revenir, ouvrir la suivante. La **page des pull
requests** répond à ces questions sur un seul écran, et une fois une pull
request ouverte, **‹ ›** vous mènent à la suivante de la même liste sans revenir
en arrière.

![La page des pull requests filtrée sur « pix » : les correspondances surlignées, les vôtres marquées « vous », une CI en échec et un brouillon](../../screenshots/pull-requests.webp)

## L’ouvrir

- L’**icône de liste** dans l’en-tête **PULL REQUESTS** de la barre latérale
  (*Voir toutes les pull requests*).
- *Pull requests…* dans la palette de commandes (⌘K), ou **Outils → Pull
  requests…**.

Comme le wiki et les [exécutions CI](ci-runs.md), la page s’ouvre dans l’onglet
du dépôt.

## Onglets

| Onglet | Ce qu’il contient |
|---|---|
| **Ouvertes** | Toutes les pull requests ouvertes, brouillons compris |
| **Brouillons** | Seulement les ouvertes marquées comme brouillon |
| **Fusionnées** | Les pull requests fusionnées, lues à la première ouverture de l’onglet |
| **Fermées** | Fermées sans fusion (refusées, abandonnées), lues avec les fusionnées |

Les compteurs à côté d’Ouvertes et de Brouillons viennent de la liste que la
barre latérale a déjà. Fusionnées et Fermées ne sont demandées que lorsque vous
ouvrez l’un de ces onglets, et une fois par session ; **Actualiser** les
redemande.

## Filtres

| Filtre | Garde |
|---|---|
| **Rechercher** | Les pull requests dont le titre, la description, les branches ou le numéro contiennent chaque mot saisi. `#482` ou `482` trouve ce numéro ; les correspondances sont surlignées dans le titre |
| **Auteur** | Un auteur — chacun avec le nombre qu’il a dans cet onglet. **Moi** est en tête |
| **Relecteur** | Un relecteur demandé, ou **Relecture demandée à moi** |
| **Branche cible** | Les pull requests vers cette branche |
| **Les miennes** | Un raccourci pour *Auteur : Moi* |
| **En attente de ma relecture** | Un raccourci pour *Relecteur : relecture demandée à moi* |
| **CI en échec** | Les pull requests dont les vérifications du head ont échoué |

La ligne sous les filtres indique combien de pull requests de l’onglet sont
affichées et quels filtres sont actifs, avec **effacer les filtres** pour tous
les retirer.

Les filtres sont conservés par dépôt **tant que l’application tourne** — quittez
la page, revenez, ils sont comme vous les avez laissés. Ils ne sont pas gardés
d’un redémarrage à l’autre, exprès : un filtre « les miennes, CI en échec »
revenu en silence une semaine plus tard cacherait des pull requests que vous
n’avez pas demandé à cacher.

### Qui est « moi »

« Moi » est le compte sous lequel les appels de ce dépôt se connectent à
l’hébergeur — le profil auquel le dépôt est [lié](profiles.md), sinon le profil
actif — tel que l’hébergeur lui-même le renvoie. Quand le jeton ne peut pas dire
à qui il appartient (pas de scope utilisateur), ou qu’il n’y a pas de jeton,
**Moi**, **Les miennes** et **En attente de ma relecture** ne sont pas proposés.

## La liste

| Colonne | Ce qu’elle montre |
|---|---|
| **#** | Le numéro, avec une icône pour ouverte, brouillon, fusionnée ou fermée |
| **Titre** | Le titre, un badge *brouillon*, et qui est encore sollicité pour relire — dans la couleur d’accent quand c’est vous |
| **Auteur** | L’image de l’hébergeur quand il en fournit une, sinon l’initiale, et **vous** sur les vôtres |
| **Branches** | Source → cible |
| **Vérifications** | Les vérifications du head résumées — `6/6`, `1 en échec`, `2 en cours` ; survolez pour les comptes |
| **Mise à jour** | Depuis quand elle a changé pour la dernière fois ; survolez pour la date |

Les lignes sont triées par activité la plus récente. Un clic ouvre la page propre
de la pull request ([Hébergement et pull requests](hosting.md)). Sur un
hébergeur sans cette page, la ligne ouvre la pull request dans le navigateur.

Dans un [checkout de fork](hosting.md#vos-pull-requests-sur-le-dépôt-parent-dun-fork), vos pull requests sur le dépôt
parent sont aussi listées, marquées *sur owner/repo*.

## Parcourir la liste depuis une pull request

![Une pull request ouverte depuis la liste filtrée : ‹ 1 sur 4 › et les filtres d’où elle vient](../../screenshots/pull-request-nav.webp)

Une pull request ouverte depuis la page affiche un bandeau au-dessus de son
titre :

- **← Pull requests** revient à la liste, filtres tels que vous les avez
  laissés.
- **‹ k sur n ›** passe à la pull request précédente ou suivante de la liste d’où
  vous l’avez ouverte — la liste filtrée, dans son ordre, telle qu’elle était au
  moment du clic. Les infobulles nomment la pull request vers laquelle mène
  chaque flèche.
- **Alt+← / Alt+→** font la même chose au clavier. On peut les réassigner dans
  **Paramètres → Raccourcis**. Elles s’effacent tant que le curseur est dans un
  champ de texte (où Option+← avance par mot) et tant que le terminal a le
  focus.

Se déplacer remplace la page sur place : parcourir dix pull requests ne laisse
pas dix icônes sur l’onglet ; ouvrir une autre ligne depuis la liste la remplace
aussi.

Une pull request ouverte **depuis ailleurs** — la barre latérale, une
notification — parcourt les pull requests ouvertes du dépôt dans l’ordre par
défaut de la page (Ouvertes, sans filtre). Une qui n’est pas non plus dans cette
liste, comme un niveau fusionné d’une pile, n’affiche que le chemin de retour
vers la liste.

## Aller à la branche d’une pull request

Pour travailler sur une pull request, il vous faut sa branche en checkout — et
dans un dépôt de milliers de branches, la retrouver par son nom dans la liste
des branches est la partie lente. Sur la page d’une pull request, le champ
**Branches** s’en charge :

- **Le nom de la branche est un lien.** Un clic fait le checkout de cette branche
  et vous emmène au graphe du dépôt, sur la pointe de la branche. La page de la
  pull request reste ouverte dans l’onglet.
- **Une branche qui n’existe que sur le serveur** est d’abord récupérée — cette
  branche seule, pas tout le remote — puis extraite en branche locale qui la
  suit. Une branche que vous avez déjà en local est basculée telle quelle — elle
  n’est pas mise à jour, donc faites un pull quand vous voulez les derniers
  commits de la pull request.
- **La branche sur laquelle vous êtes déjà** est marquée *actuelle* à la place.
  Rien n’est extrait.
- **Le bouton copier** à côté de chaque nom le met dans le presse-papiers.
- **Annuler** (⌘Z) vous ramène sur la branche où vous étiez et supprime la
  branche locale créée par le checkout — sauf si vous y avez commité depuis,
  auquel cas elle est laissée telle quelle.

L’en-tête propose les deux mêmes gestes en boutons : **Aller à la branche
source** et **Aller à la branche cible**. Ils fonctionnent aussi sur la branche
où vous êtes déjà — ils vous emmènent simplement au dépôt.

Rien n’est consulté avant votre clic : ouvrir une pull request ne lit ni ne
récupère aucune branche.

Ce que cela ne fait pas :

- **La branche source d’un fork** vit dans un autre dépôt, elle n’a donc pas de
  lien (le bouton copier reste). **Prévisualiser la pull request en local…**,
  proposé juste en dessous, est le moyen de la lancer ici. La branche cible reste
  un lien.
- **Aucun remote correspondant.** La branche est cherchée sur le remote dont
  l’URL est le dépôt de la pull request. Quand aucun remote configuré n’y pointe,
  le lien ne fait rien et son infobulle dit pourquoi.
- **Une branche supprimée.** Une pull request fusionnée a souvent emporté sa
  branche ; le fetch indique alors que la branche n’existe plus sur le remote, et
  vous restez sur la pull request.
- **Des modifications locales.** Le checkout n’est pas destructif, il n’y a donc
  pas de confirmation — et git refuse le checkout quand vos modifications non
  commitées seraient écrasées. L’erreur indique quels fichiers ; commitez-les ou
  mettez-les en stash et cliquez à nouveau.
- **Cette fenêtre.** Le checkout se fait dans l’arbre de travail de ce dépôt.
  Quand la branche est déjà extraite dans un autre [arbre de
  travail](worktrees.md), c’est l’onglet de cet arbre de travail qui s’ouvre.

## Commenter une ligne

On pouvait déjà répondre ici à un fil de relecture, mais pas en ouvrir un, si bien
qu’une vraie relecture vous renvoyait encore au navigateur. Dans l’onglet
**Fichiers** d’une pull request, chaque ligne du diff accepte son propre
commentaire :

- **Survolez une ligne** et appuyez sur le **+** qui apparaît sur son numéro, ou
  **cliquez sur la ligne** elle-même (un clic qui termine une sélection de texte, ou
  un double clic qui sélectionne un mot, ne compte pas — c’est de la lecture). Le
  menu du clic droit — ou la touche menu contextuel du clavier — propose aussi
  *Commenter la ligne N*.
- Une zone s’ouvre **sous cette ligne**. Écrivez, puis **Commenter** — ou
  ⌘/Ctrl+Entrée. **Annuler** la ferme ; **Échap** aussi, en demandant d’abord si
  quelque chose a été saisi. Dans les deux cas, le focus revient sur cette ligne.
- En cas de succès, le nouveau fil apparaît **sous sa ligne**, et dans les fils de
  relecture de l’onglet Conversation, où tout le monde le verra.

![Un commentaire en cours d’écriture sous une ligne modifiée, avec un fil plus ancien sous sa propre ligne](../../screenshots/pr-line-comment.webp)

Le côté où atterrit le commentaire suit la ligne :

| Ligne | Ancré à |
|---|---|
| **Ajoutée** (vert) | La nouvelle version du fichier, à son nouveau numéro |
| **Supprimée** (rouge) | L’ancienne version, à son ancien numéro |
| **Inchangée** | La nouvelle version (GitLab reçoit les deux numéros, comme il l’exige) |

Les fils existants sont eux aussi affichés sous leurs lignes, avec leur zone de
réponse là où l’hébergeur laisse l’application répondre dans un fil (pas Forgejo).
Un fil n’est affiché sur une ligne que si l’hébergeur dit qu’il appartient encore au
diff affiché ; le reste demeure dans l’onglet Conversation, plutôt que sur une ligne
devinée :

| Hébergeur | Un fil écrit avant le dernier push |
|---|---|
| GitHub | Obsolète quand sa ligne a changé : Conversation seulement |
| GitLab | Écrit sur un head plus ancien : Conversation seulement |
| Azure DevOps | Suivi par Azure jusqu’à l’endroit où se trouve sa ligne |
| Bitbucket Data Center | Orphelin quand sa ligne a disparu : Conversation seulement |
| Forgejo | Forgejo n’indique pas qu’un commentaire est obsolète, il est donc affiché au numéro de ligne enregistré — après un push, cette ligne peut contenir un autre code |

Un commentaire sur une ligne hors des hunks affichés n’est que dans l’onglet
Conversation, sur tous les hébergeurs.

Un commentaire saisi et non envoyé compte comme du texte non envoyé : **‹ ›** et
Alt+flèches demandent avant de le quitter, comme pour la zone de commentaire
principale. Regarder un autre fichier le conserve ; pour en commencer un sur une
autre ligne, publiez ou annulez le premier.

Ce que cela ne fait pas :

- **Une ligne, publiée aussitôt.** Pas de plage de lignes, pas de relecture en
  attente où regrouper des commentaires pour les soumettre plus tard, pas de
  suggestion de modification. Chaque commentaire est publié dès que vous l’envoyez,
  en fil distinct (sur Forgejo, en relecture contenant ce seul commentaire, car
  Forgejo n’a pas d’appel pour un commentaire isolé).
- **Le diff que vous regardez.** L’onglet Fichiers retient sur quel commit (sur
  Azure DevOps, quelle itération) son diff a été lu, et le commentaire est envoyé
  par rapport à celui-ci. Quand la pull request a bougé depuis — un push, une
  nouvelle base de fusion —, le commentaire n’est pas publié sur la ligne qui porte
  maintenant ce numéro : il est refusé avec *la pull request a changé depuis le
  chargement de ce diff*, et **Actualiser** affiche le nouveau diff. Sur GitHub, le
  commentaire est au contraire publié sur le commit que vous avez lu, et GitHub le
  marque obsolète si la ligne a changé. Une ligne que l’hébergeur refuse encore est
  rejetée comme hors du diff.
- **Refusé.** Sans droit de commenter (un jeton en lecture seule, un compte que le
  dépôt n’autorise pas à commenter), l’hébergeur refuse et le message indique que
  c’est la raison.
- Les pull requests de **bitbucket.org** s’ouvrent dans le navigateur — l’application
  n’a pas encore de page pour elles —, donc un commentaire de ligne s’y fait encore
  sur le site.
- **Un fichier sans diff** (binaire, ou trop gros pour que l’hébergeur l’inclue) n’a
  aucune ligne à commenter.

## Limites

- **Les pull requests ouvertes sont la liste de la barre latérale.** GitHub,
  GitLab et bitbucket.org lisent les 30 premières ; un dépôt qui en a plus ne
  montre que celles-là, et le compteur d’Ouvertes affiche **30+**. Azure DevOps,
  Bitbucket Data Center et Forgejo les lisent toutes.
- **Fusionnées et fermées sont plafonnées**, et l’onglet affiche **+** quand
  l’hébergeur en a davantage (son site les liste toutes) :

  | Hébergeur | Ce qui est lu |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | Les 100 mises à jour le plus récemment, fusionnées et fermées **ensemble** |
  | GitLab | Les 100 mises à jour le plus récemment de chaque |
  | Bitbucket Data Center | 100 de chaque dans l’ordre *newest* du serveur — son API ne dit pas s’il s’agit de l’ouverture ou de la mise à jour |
  | Azure DevOps | 100 de chaque parmi celles terminées au cours de la **dernière année** ; son API ne précise aucun ordre, donc au-delà de cent, le choix revient au serveur |

  Leurs vérifications ne sont pas lues — la CI d’une pull request terminée ne
  décide plus rien, et cela coûterait une requête par ligne — donc **CI en échec**
  ne s’applique pas à ces onglets (sa puce y est masquée).
- **Pas de compte** : sans jeton qui atteint l’hébergeur, Fusionnées et Fermées
  le disent au lieu d’afficher une liste vide (GitHub peut tout de même lire un
  dépôt public).
- **Vérifications** : GitHub et Bitbucket Data Center les fournissent dans la
  liste. GitLab, Azure DevOps et Forgejo sont interrogés une fois par head à
  l’ouverture de la page, via le même cache que les badges CI du graphe.
  bitbucket.org n’en a pas.
- **Relecteurs** : GitHub, GitLab, Forgejo, Bitbucket Data Center et Azure DevOps
  indiquent qui est encore sollicité (Azure : une personne qui n’a pas voté ; une
  équipe est laissée de côté). La liste de bitbucket.org ne le dit pas, donc le
  filtre Relecteur y est vide.
- **La recherche dans la description** fonctionne là où la liste de l’hébergeur
  fournit la description ; bitbucket.org peut l’omettre, et seuls les titres,
  branches et numéros sont alors cherchés.
- **« Moi » sur bitbucket.org et Azure DevOps** est comparé au nom affiché,
  puisque c’est ainsi que leurs listes nomment un auteur.
- **Mise à jour sur Azure DevOps** correspond à l’ouverture (ou la fermeture) de
  la pull request : sa liste n’a pas d’heure de dernière activité.
- Le parcours est mémorisé tant que l’application tourne ; après un redémarrage,
  une pull request ouverte depuis la liste parcourt plutôt les pull requests
  ouvertes.
