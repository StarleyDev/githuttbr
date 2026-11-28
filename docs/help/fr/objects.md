---
title: Explorateur d'objets
category: Dépôt et historique
order: 16
summary: Parcourir la couche sous le graphe — commits, arbres, blobs, étiquettes et les références qui pointent vers eux. Rien ici ne modifie quoi que ce soit.
keywords: objets objects explorateur explorer blob arbre tree commit étiquette tag ref référence plomberie plumbing cat-file ls-tree sha1 internes internals base de données rev-parse HEAD^{tree} loose packed
source: 946d418d5b13af167a16a2f0d3164d813b423ab6
---

# Explorateur d'objets

Git a la réputation d'être compliqué. Presque tout vient du fait qu'on ne voit
jamais le modèle : **quatre sortes d'objets, et des pointeurs**. Dès que vous
pouvez cliquer un commit, atterrir sur son arbre, et découvrir que votre fichier
*est* un blob à qui un arbre a donné un nom, la porcelaine cesse d'être magique.

`⌘K` → **Explorateur d'objets**. Rien sur cette page ne peut changer un octet —
chaque appel derrière elle est une lecture.

![Le commit pointé par main : le chemin depuis la branche, ce vers quoi il pointe et la place d’un commit dans le modèle](../../screenshots/objects.webp)

## Les quatre objets

| Objet | C'est | Il connaît |
|--------|----|-------|
| **blob** | Le *contenu* d'un fichier | Rien. Ni son nom, ni son chemin, ni son histoire |
| **tree** | Un listing de répertoire | Les noms, les modes, et le sha de chaque blob ou arbre enfant |
| **commit** | Un instantané | Son arbre, ses parents, l'auteur, le validateur, le message |
| **tag** | Une étiquette annotée | L'objet vers lequel elle pointe, l'étiqueteur, un message |

La surprise, pour la plupart des gens, c'est la première ligne. **Un blob n'a pas
de nom.** Deux fichiers de contenu identique, n'importe où dans votre historique,
sont le même blob, stocké une seule fois. Le nom vit dans l'arbre qui pointe vers
lui — c'est pourquoi git suit du contenu plutôt que des fichiers, et pourquoi les
renommages sont détectés plutôt qu'enregistrés.

Une **référence** — `refs/heads/main`, `refs/tags/v1.0`, `HEAD` — n'est qu'un
fichier contenant un sha. Voilà tout ce que veut dire « brancher ne coûte rien ».

## Se promener

![Du commit jusqu’à src/ : les dossiers d’abord, chaque mode expliqué](../../screenshots/objects-tree.webp)

La colonne de gauche liste toutes les réfs, regroupées comme git les regroupe :
HEAD (avec `→ main` quand il est sur une branche), Branches, Étiquettes et
Distantes, chacune avec son compte. Distantes démarre replié. Le repère carré
est une réf vers un commit ; le rond vert, une étiquette **annotée**. Le filtre
restreint tous les groupes à la fois. Cliquez sur une réf pour arriver sur
l’objet qu’elle nomme ; cette ligne reste éclairée tant que vous partez d’elle.

À partir de là, tout est une porte :

- Un **commit** montre ce vers quoi il **pointe** — son arbre racine, avec son
  nombre d’entrées, et chaque parent, avec son sujet — puis l’auteur et le
  committer (*le même que l’auteur* quand ils coïncident) et le message.
- Un **arbre** est un tableau nom, mode, objet, taille, dossiers d’abord.
  Chaque mode est écrit en toutes lettres : *fichier*, *exécutable*, *dossier*,
  *lien symbolique*, *sous-module*. Un dossier dit combien d’éléments il
  contient ; un lien, vers où il pointe.
- Un **blob** montre son texte avec les numéros de ligne (le début seulement,
  s’il est gros), ou dit clairement qu’il est binaire. Atteint par un arbre,
  une barre dit comment il s’appelle là — *Nommé src/app.ts dans le commit
  07c6f3d, mode 100644 (fichier ordinaire)* — avec un lien vers l’historique
  du fichier.
- Une **étiquette annotée** pointe vers l’objet qu’elle nomme et note qui l’a posée.

![Un blob, le nom que son arbre lui a donné et sa place dans le modèle](../../screenshots/objects-blob.webp)

### Le chemin

La bande sous la zone de révision est le **chemin** parcouru :
`branche main → commit 07c6f3d → racine → src/ → app.ts`. L’arbre d’un commit
est la **racine** ; un fichier ou un dossier prend le nom de la ligne cliquée.
Cliquez sur n’importe quel élément pour y revenir. Taper une révision, choisir
une réf ou un des exemples à côté de **Ouvrir** commence un nouveau chemin.

**Retour** et **Suivant** parcourent tout ce que vous avez ouvert, comme dans un
navigateur : après un retour, Suivant revient, jusqu’à ce que vous ouvriez autre
chose depuis là. La zone de révision suit la promenade : `main:src/app.ts` est
toujours là, prêt à copier.

### Couleurs

Chaque sorte garde une couleur partout où elle apparaît — badge, élément du
chemin, carte, ligne : commit dans la couleur d’accent du thème, arbre dans son
jaune, blob en bleu, étiquette et réf en vert. Sous l’en-tête de l’objet, une
phrase dit ce que cette sorte *est*.

### Où vous êtes dans le modèle

La bande au pied du panneau est la chaîne de git — **ref → commit → tree →
blob**, avec **tag** entre ref et commit sur une étiquette annotée — et la sorte
affichée est éclairée comme *vous êtes ici*.

## Taper une révision

Le champ accepte tout ce qu'accepte `git rev-parse`, et c'est là que l'outil
cesse d'être un navigateur pour devenir une façon d'apprendre :

| Tapez ceci | Pour obtenir |
|-----------|--------|
| `HEAD` | Le commit courant |
| `HEAD~3` | Trois commits en arrière |
| `HEAD^{tree}` | L'arbre de ce commit, pelé |
| `HEAD:src/app.ts` | Le blob de ce chemin, directement |
| `v1.0^{}` | Ce vers quoi pointe une étiquette annotée, plutôt que l'objet étiquette |
| `a1b2c3d` | N'importe quel objet, par son sha — les abréviations fonctionnent |

Les chiffres de mode dans un listing d'arbre valent la peine d'être connus :
`100644` un fichier, `100755` un exécutable, `040000` un sous-arbre, `120000` un
lien symbolique, `160000` un gitlink de sous-module — ce dernier étant la
totalité de ce qu'un sous-module stocke.

## Limites qu'il vaut mieux connaître

- **En lecture seule, à dessein.** Il n'y a rien ici pour écrire. Fabriquer des
  objets à la main est un exercice de `git hash-object`, et sa place est dans un
  terminal.
- **Les gros blobs sont tronqués** après les 200 premiers Ko — assez pour voir de
  quoi il s'agit, pas assez pour figer la fenêtre.
- **Les tailles sont la taille du contenu de l'objet** telle que la rapporte
  `git cat-file -s`, pas ce qu'il coûte sur le disque après empaquetage. Pour
  cela, voir [la maintenance](maintenance.md).
- **Les objets inatteignables restent des objets.** Collez un sha issu d'un
  rapport `git fsck` sur les objets pendants et il s'ouvre, ce qui est souvent la
  façon la plus rapide de voir ce que contenait un commit perdu avant de décider
  s'il faut le récupérer.
- **Une ligne de sous-module ne s’ouvre pas.** Son gitlink nomme un commit d’un
  autre dépôt, que celui-ci n’a pas.
- **Les comptes et les cibles de liens ont un plafond.** Un arbre de plus de 300
  sous-dossiers les liste sans compte, et seuls les 50 premiers liens
  symboliques montrent leur cible.
- **Le chemin s’arrête avec la boîte de dialogue.** Fermez-la et la suivante
  repart de la branche de HEAD.

Voir aussi : [Le graphe](graph.md) · [Maintenance du dépôt](maintenance.md) ·
[Récupération](recovery.md)
