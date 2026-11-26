---
title: Premiers pas
category: Pour commencer
order: 1
summary: Ouvrir un dépôt, lire le graphe, faire son premier commit.
keywords: intro premiers pas débuter ouvrir cloner clone onglets tabs graphe graph commit valider
source: 8effe244fab76b263f38e31ac0912d8042c428c6
---

# Premiers pas

GitHuttBr ouvre un dossier et vous montre son historique. Rien n'est écrit dans
votre dépôt tant que vous ne le demandez pas.

![Un dépôt fraîchement ouvert, encore sans aucun commit](../../screenshots/empty-repo.webp)

## Ouvrir un dépôt

![Ouvrir un dépôt : ouvrir, cloner ou créer, puis les dépôts analysés et récents](../../screenshots/open-repository.webp)

- **Glissez un dossier** sur la fenêtre, ou utilisez **Ouvrir un dépôt** depuis
  l'écran d'accueil. Le sélecteur accepte plusieurs dossiers à la fois :
  ⌘-clic ou Maj-clic pour les sélectionner, et chacun s'ouvre dans son propre
  onglet (ou rejoint le groupe depuis lequel vous l'avez ouvert). Dans une
  sélection de plusieurs dossiers, un dépôt déjà ouvert, ou un dossier qui n'est
  pas un dépôt Git, est ignoré et signalé dans un message, pour que les autres
  s'ouvrent quand même. Le sélecteur de macOS ne peut pas griser à l'avance les
  dépôts ouverts : Electron n'expose pas le crochet par dossier du panneau, donc
  la vérification a lieu après le clic sur Ouvrir.
- **Dépôts analysés**, sous les trois boutons, liste tous les dépôts des
  dossiers que vous avez demandé à GitHuttBr d'analyser — cochez-en plusieurs et
  ouvrez-les d'un coup, ou double-cliquez sur l'un d'eux. C'est aussi là que
  vous ajoutez ou retirez ces dossiers. Voir [Dépôts](repositories.md#dépôts-analysés).
- **Mauvais bouton ?** Cloner, Créer, Créer un groupe et Dépôts analysés,
  ouverts depuis Ouvrir un dépôt, ont une flèche **Retour** à côté de leur titre
  qui y ramène.
- **Clonez-en un** depuis une URL ou directement depuis votre hébergeur — voir
  [le clonage](cloning.md) pour les options qui rendent rapide le clonage d'un
  dépôt énorme.
- Depuis un terminal, `githuttbr .` ouvre le dossier courant dans l'application
  déjà lancée — voir [la ligne de commande](cli.md).
- Un dossier seul qui n'est pas encore un dépôt Git s'ouvre quand même, en vous
  proposant de l'initialiser.

## Les trois panneaux

| Panneau | Ce qu'il contient |
|---|---|
| Gauche | Branches, distants, étiquettes, remisages, arbres de travail — et l'onglet **Fichiers** pour la copie de travail |
| Milieu | Le graphe des commits, et ce que vous y sélectionnez |
| Droite | Le compositeur de commit, ou les détails du commit sélectionné |

## Trouver tout le reste

Deux chemins, et ils mènent aux mêmes endroits :

- **`⌘K`** (`Ctrl+K`) — la palette de commandes. Tapez ce que vous voulez ; elle
  saute aussi vers les branches, les commits et les fichiers.
- **Outils** dans la barre d'outils — le même ensemble, à l'échelle du dépôt,
  présenté comme un menu, avec la longue traîne repliée en groupes pour rester
  lisible.

![Le menu Outils : les outils fréquents d'abord, le reste groupé](../../screenshots/tools-menu.webp)

Quand la fenêtre se resserre, la barre d’actions cesse de se disputer la place : les boutons qui ne tiennent plus se replient dans un menu **Plus** à son extrémité, dans l’ordre de la barre et avec leurs sous-menus. Élargissez la fenêtre et ils ressortent.

Tout ce qui est atteignable par l'un l'est par l'autre : il n'y a donc rien que
seuls les utilisateurs avancés puissent trouver.

## Votre premier commit

1. Modifiez un fichier. Il apparaît sous **Non indexé**.
2. Indexez-le — le fichier entier, une section, ou [ligne par ligne](staging.md).
3. Écrivez un message et appuyez sur **Commit**.

Tout le reste dans GitHuttBr est optionnel.

