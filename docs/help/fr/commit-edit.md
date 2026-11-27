---
title: Modifier n'importe quel commit
category: Branches et chirurgie
order: 46
summary: Réécrire les fichiers ou le message d'un commit historique sur place — avec la cascade prévisualisée d'abord.
keywords: modifier commit edit réécrire historique rewrite history amend passé reword corriger faute typo cascade replay rebase in place chirurgie surgery
source: 2860ac7978e6b9b1b8a469abadf313971d0140c6
---

# Modifier n'importe quel commit

La faute de frappe est dans un commit d'il y a trois semaines. Le remède
habituel est un rebase interactif : s'arrêter au commit, modifier, continuer,
prier. Le remède de GitHuttBr : clic droit sur le commit, **Modifier ce
commit**, changer le texte, terminé. Le bouton stylo dans le panneau des
détails du commit ouvre le même éditeur.

![Modification d'un commit historique](../../screenshots/commit-edit.webp)

## Ce que ça fait

Choisissez n'importe quel commit qui est un ancêtre de `HEAD` — historique
linéaire ou non. L'éditeur montre ses fichiers et son message ; modifiez l'un ou
l'autre.

Le message dispose des mêmes outils que le [compositeur de
commit](committing.md) : le résumé avec son compteur de longueur et la
description en dessous, la ligne de style derrière le chevron (type et portée
Conventional, clé de ticket, style de commit), le sélecteur de gitmoji, les
co-auteurs et les indications du linter. Le message du commit est découpé au
chargement — la première ligne devient le résumé, le reste la description — puis
recollé avec une ligne vide au moment de réécrire. Transformer un vieux `add
retry` en `fix: add retry`, c'est un choix dans la liste des types.

Modifier un fichier, c'est le lire : l'éditeur ne se tasse donc pas dans une
boîte de dialogue. Il s'ouvre dans le panneau central, à la place du graphe des
commits — là où s'ouvrent le résolveur de conflits et la visionneuse de fichiers
— et occupe toute la largeur et toute la hauteur de la fenêtre. **Échap** ou le
**×** de son en-tête le ferme. Vos modifications survivent au passage à un autre
onglet de dépôt et au retour, et fermer avec des modifications non enregistrées
demande d'abord confirmation.

Deux choses se passent ensuite :

1. **Prévisualiser la cascade** rejoue chaque commit au-dessus de celui
   modifié *en mémoire* (une chaîne de cherry-picks `merge-tree` — pas de
   checkout, pas d'arbre de travail, pas de refs). Chaque descendant apparaît
   en vert ou en rouge, vous savez donc **avant que quoi que ce soit ne
   bouge** si la modification se propage proprement ou entre en collision avec
   un changement ultérieur.
2. **Réécrire l'historique** le fait pour de vrai : la même chaîne est
   construite avec la plomberie, puis la branche se déplace avec
   `reset --keep` — vos changements non commités sont emportés, ou le reset
   s'interrompt et rien ne s'est passé. Un
   [instantané gardien](recovery.md) est pris d'abord, et l'annulation
   restaure l'ancienne chaîne.

L'auteur et les dates de chaque commit rejoué sont préservés ; seuls les
hachages changent — c'est exactement ce que réécrire l'historique veut dire.

## Les merges dans la plage

![Édition d’un commit sous deux merges — la cascade les rejoue](../../screenshots/commit-edit-merges.webp)

Un merge entre le commit et `HEAD` ne désactive plus la modification. La
cascade rejoue un merge en réappliquant son **résultat enregistré** —
l'arbre que le merge a réellement commité, résolutions de conflits
comprises — sur le parent réécrit, de sorte que les résolutions faites à la
main survivent mot pour mot à la réécriture. Pas de rerere, pas de nouveau
merge, pas d'arbre de travail : la même plomberie en mémoire que le reste de
la cascade, et les deux pointeurs de parents sont préservés. Une branche
latérale qui contient elle aussi le commit modifié est réécrite et
repointée ; une qui ne le contient pas garde son identité intacte. La
bannière de l'éditeur indique combien de merges la plage contient, et les
étapes de merge affichent une icône de merge dans l'aperçu.

La mise en garde honnête : un merge rejoué ne vaut que ce que vaut son
résultat enregistré. Si votre modification entre en collision avec des
lignes que le merge lui-même a résolues, l'aperçu passe au rouge exactement
comme n'importe quelle autre étape en conflit — rien n'est deviné.

## Quand la cascade entre en conflit

Un commit ultérieur a touché les mêmes lignes que vous modifiez. L'aperçu
marque ce commit en rouge avec les fichiers en conflit, et la réécriture
refuse de s'exécuter — rien n'est jamais appliqué à moitié. Soit vous modifiez
autrement, soit vous affrontez le conflit de face avec un
[rebase interactif](rebase.md).

## Limites

- **Le commit doit être un ancêtre de `HEAD`.** Un commit sur une branche
  latérale non mergée n'a aucun chemin jusqu'à votre branche actuelle pour
  être rejoué.
- Les fichiers binaires et les fichiers de plus de 2 Mo sont affichés mais pas
  modifiables.
- Un commit déjà présent sur un distant peut être modifié, mais votre prochain
  push devra être un **push forcé** — l'éditeur vous prévient avant que vous
  ne vous y engagiez.
- Les fichiers supprimés dans le commit ne peuvent pas être modifiés (il n'y a
  pas de contenu à modifier).

**Voir aussi :** [Rebase interactif](rebase.md) · [Récupération et le reflog](recovery.md) · [Absorption](absorb.md)
