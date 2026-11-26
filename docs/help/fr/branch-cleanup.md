---
title: Nettoyage des branches
category: Branches et chirurgie
order: 47
summary: Supprimez les branches locales dont le travail est déjà ailleurs — upstreams disparus, branches fusionnées — en une seule étape annulable.
keywords: nettoyer nettoyage prune supprimer retirer branches locales disparue fusionnée squash inactive mortes anciennes pull request ranger liste des branches clean up cleanup delete remove gone merged stale tidy branch list
source: 701f92f45b9e4dcda7dc560cb20128442fd2da0d
---

# Nettoyage des branches

Chaque pull request que vous extrayez laisse une branche locale derrière elle. La PR
est fusionnée, le serveur supprime sa branche, et la locale reste — pour toujours.
Après quelques centaines de relectures, la liste des branches n’est presque plus
faite que de branches mortes, et trouver les vivantes oblige à les faire toutes
défiler.

Le nettoyage des branches liste les branches locales dont le travail est déjà en
sûreté ailleurs, coche celles qui n’ont rien à perdre, et les supprime en une seule
étape que vous pouvez annuler. « Ailleurs » désigne les branches de suivi distantes
telles qu’au dernier fetch, et la branche par défaut.

![La boîte de dialogue de nettoyage : branches disparues, fusionnées et fusionnées en squash cochées, travail qui n’existe qu’ici mis de côté](../../screenshots/branch-cleanup.webp)

## Comment ça marche

1. Outils → **Nettoyer les branches locales…** (ou <kbd>⌘K</kbd>).
2. Appuyez d’abord sur **Fetch et prune** si le dernier fetch est ancien. Tant qu’un
   fetch avec prune n’a pas tourné, une branche que le serveur a supprimée paraît
   encore vivante ici.
3. Si votre équipe fusionne les pull requests en squash, appuyez sur **Vérifier les
   fusions squash** (voir plus bas).
4. Vérifiez les coches, puis **Supprimer**. Une seule confirmation dit combien de
   branches partent et nomme chacune de celles qui portent des commits introuvables
   ailleurs.

La suppression est une opération avec une seule entrée d’annulation : **Annuler**
recrée chaque branche supprimée sur le commit exact qu’elle désignait, avec son
upstream (`branch.<name>.remote` et `.merge`) remis en place. Si une branche du même
nom est apparue depuis sur un autre commit — la même PR extraite à nouveau —,
l’annulation la laisse tranquille et ramène la supprimée à côté, sous le nom
`<name>-restored-<short sha>`, et le dit.

Le message de succès et l’entrée d’annulation listent chaque branche avec le commit
qu’elle désignait (`feature/x (was abc1234)`), comme l’affiche `git branch -D` :
l’historique d’annulation ne vit que tant que l’application est ouverte, et cette
ligne suffit pour recréer une branche à la main.

## Pourquoi une branche est listée

| Pastille | Signifie |
|---|---|
| **Disparue** | La branche suit un upstream que le serveur a supprimé — la trace habituelle d’une pull request fusionnée. |
| **Fusionnée** | Chacun de ses commits est déjà dans la branche par défaut. L’infobulle nomme la copie qui les contient — `main (local, not pushed)` quand seule votre copie locale les a. |
| **Squash** | Trouvée par **Vérifier les fusions squash** : son contenu est dans la branche par défaut, ses commits un à un ne le sont pas. |
| **Inactive** | Aucun commit depuis le nombre de mois choisi (3 par défaut). Listée seulement si vous cochez **Lister aussi les branches inactives**. |
| **N commits n’existent qu’ici** | Des commits qui ne sont sur aucune branche de suivi distante ni dans la branche par défaut. Supprimer la branche les supprime. |
| **Pas encore de commit** | Elle pointe exactement sur la pointe de la branche par défaut — sans doute créée et jamais utilisée. |

« Fusionnée » se mesure par rapport à la copie distante de la branche par défaut
(`origin/main`), et aussi par rapport à la vôtre — un `main` local que personne n’a
mis à jour depuis un mois ne peut pas cacher les fusions faites depuis.

## Fusions squash

Une fusion squash pose les changements d’une pull request sur `main` en un seul
nouveau commit ; les commits propres de la branche n’arrivent jamais. Pour git, une
telle branche ressemble à du travail abandonné : **Disparue**, avec *N commits
n’existent qu’ici*.

Quand des branches disparues avec leurs propres commits sont listées, **Vérifier les
fusions squash** pose une autre question : fusionner cette branche dans `main`
changerait-il quelque chose ? Elle lance un seul `git merge-tree` en mémoire pour
toutes — sans checkout, sans index —, et une branche dont la fusion laisse l’arbre de
`main` exactement tel qu’il est reçoit la pastille **Squash** et est cochée comme une
fusionnée. La confirmation dit que leur contenu est dans `main` et pas leurs commits.

La vérification est refaite, sous le verrou, au moment de la suppression : une
branche qui ne la passe plus est refusée, pas supprimée.

## Ce qui est coché, et ce qui ne l’est jamais

Cochées à l’ouverture : les branches **disparues ou fusionnées** sans **commits
propres** — plus les squash une fois vérifiées. **Sélectionner disparues +
fusionnées** remet cette sélection.

Jamais cochée pour vous, et jamais atteinte par **Tout sélectionner (affichés)** :
une branche dont des commits n’existent qu’ici. Cochez-la ligne par ligne ; la
confirmation passe alors au rouge et la liste avec son nombre de commits. Les
branches seulement inactives et celle posée sur la pointe de la branche par défaut ne
sont pas cochées non plus. Quand la sélection inclut des lignes que la liste
n’affiche pas — masquées par le filtre, ou au-delà des 400 premières —, la
confirmation dit combien.

La suppression accepte, par branche, exactement le nombre de commits uniques que la
confirmation a montré. Si une branche en a davantage entre-temps — ou, au
**Rétablir**, en a gagné depuis l’annulation (par exemple parce qu’un prune a retiré
la copie distante) —, elle est refusée et gardée, et le rétablissement le signale au
lieu d’annoncer un succès.

Jamais listées, et refusées par la suppression même si on le demande :

- la branche courante ;
- une branche extraite dans un worktree quelconque, ou en cours de rebase dans l’un
  d’eux ;
- la branche par défaut ;
- les [branches protégées](repo-settings.md), y compris les motifs comme `release/*`
  de la [configuration du dépôt](repo-config.md).

Rien ne change sur le distant. Cela ne supprime que des branches locales.

## Limites

- **Les fusions squash sont invisibles pour git** tant que vous ne vérifiez pas.
  Sans **Vérifier les fusions squash**, une branche fusionnée en squash apparaît
  **Disparue** avec *N commits n’existent qu’ici*, et n’est pas cochée.
- **La vérification squash peut rater.** Elle répond à « ce contenu est-il déjà dans
  `main` ? ». Quand `main` a rechangé les mêmes lignes ensuite, ou que le squash a
  été retouché pendant la fusion, la fusion changerait quelque chose, et la branche
  reste décochée. Elle ne dit jamais oui à tort d’une façon qui perde du contenu : le
  contenu est dans `main` par définition. Comme le
  [radar de conflits](conflict-radar.md), elle écrit des objets arbre isolés que
  `git gc` nettoie.
- **Un distant non récupéré est périmé.** « Disparue » vient du dernier fetch. Sans
  **Fetch et prune**, une branche supprimée sur le serveur il y a une heure paraît
  encore vivante, et une fusion récente n’est pas encore dans `origin/main`.
- **Inactive n’est qu’une date.** Trois mois calmes ne disent rien sur la sûreté du
  travail, c’est pourquoi les lignes inactives ne sont jamais cochées.
- **« Ailleurs », ce sont les références de suivi distantes du dernier fetch**, pas
  le serveur à l’instant — ni les tags. Un commit que seul un tag retient compte comme
  unique, et un commit présent sur la branche distante de quelqu’un d’autre non.
- Le compte des commits uniques s’arrête à 500 et affiche *500+*. Le total de la
  confirmation est un plancher — *au moins N* — car des branches empilées partagent
  des commits.
- L’annulation restaure la branche et son upstream, pas son reflog ni les autres
  réglages `branch.<name>.*`.
- La boîte de dialogue montre les 400 premières lignes d’une longue liste ; le filtre
  trouve le reste. **Sélectionner disparues + fusionnées** s’applique à toutes les
  lignes, affichées ou non.

**Voir aussi :** [Branches, distants et barre latérale](branching.md) · [Récupérer, tirer et pousser](syncing.md) · [Page des pull requests](pull-requests.md)
