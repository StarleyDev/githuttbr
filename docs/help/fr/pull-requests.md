---
title: Page des pull requests
category: Synchronisation et multi-dépôts
order: 57
summary: Toutes les pull requests d’un dépôt sur une page — par état, filtrées par auteur, relecteur, cible et CI — et ‹ › pour parcourir la liste filtrée depuis une PR.
keywords: pull requests liste page merge requests pr mr filtre auteur relecteur les miennes en attente de ma relecture relecture demandée ci en échec branche cible brouillons fusionnées fermées recherche tri précédent suivant alt flèche navigation checkout aller à la branche source cible copier le nom de la branche fetch
source: 652fe566e0d021496e698b305175c701c5bf2e4e
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
