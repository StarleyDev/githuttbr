---
title: Éditeur externe
category: Outils de l'espace de travail
order: 95
summary: Envoyer un dépôt, un fichier ou une seule ligne de code vers l'éditeur dans lequel vous écrivez vraiment.
keywords: éditeur editor vscode code cursor windsurf zed sublime jetbrains intellij webstorm xcode ouvrir dans l'éditeur ligne line colonne column commande personnalisée custom argv devin desktop
source: 674896b0a37459043e2c80f3b4bf29ce60bbc72b
---

# Éditeur externe

Un client Git est l'endroit où l'on lit le code ; c'est rarement l'endroit où on
le corrige. L'écart entre remarquer un problème dans un diff et avoir le curseur
sur cette ligne dans son éditeur, c'est une recherche de fichier et un défilement
— à chaque fois.

Pointez Gitcito vers votre éditeur une fois et cet écart disparaît : clic droit
sur une ligne dans la vue fichier ou blame, et elle s'ouvre là-bas, à cette
ligne.

## En choisir un

**Paramètres → Général → Éditeur externe.** La liste déroulante énumère les
éditeurs que Gitcito trouve sur cette machine — il cherche d'abord la commande de
chaque éditeur, puis, sur macOS, le bundle d'application dans `/Applications` et
`~/Applications`. Le balayage a lieu chaque fois que vous ouvrez les paramètres :
un éditeur installé il y a cinq minutes apparaît donc sans redémarrage.

Reconnus d'origine :

| Éditeur | Commande recherchée |
|--------|----------------------|
| Visual Studio Code | `code`, `code-insiders` |
| Cursor | `cursor` |
| Windsurf | `windsurf` |
| Devin Desktop | `devin-desktop` (jamais un simple `devin`, qui est un autre outil) |
| Zed | `zed` |
| Sublime Text | `subl` |
| IDE JetBrains | `idea`, `webstorm`, `pycharm`, `rustrover`, `goland`, `clion`, `rider`, `phpstorm` |
| Xcode | `xed` |

**Sous Linux, un éditeur hors du PATH.** Un éditeur décompressé dans un dossier de
votre choix n’est souvent pas dans le PATH, mais il est dans le menu des applications.
Gitcito lit aussi les entrées `.desktop` du menu — dans les dossiers de données XDG
(`~/.local/share`, puis `/usr/local/share` et `/usr/share`, ou ce que disent
`XDG_DATA_HOME` et `XDG_DATA_DIRS`) et dans les exports de Flatpak et de Snap — et
reconnaît un éditeur à son nom ou au programme que lance sa ligne `Exec=`. Une entrée
marquée cachée ou à ne pas afficher, ou dont le programme `TryExec=` manque, ne compte
pas. Pour une version de VS Code comme Devin Desktop, il préfère la commande de `bin/`
à côté de ce programme, puisque seule celle-là peut sauter à une ligne. Les entrées
sont lues comme du texte et rien n’y est exécuté ; une entrée qui a besoin d’arguments
supplémentaires pour lancer l’éditeur (un `flatpak run …` de Flatpak) est ignorée, donc
une telle installation a toujours besoin de sa commande dans le PATH. Sous macOS, un
`Devin.app` ne compte que si son `product.json` nomme Devin Desktop, de sorte qu’une
application sans rapport portant le même nom n’est jamais celle qui s’ouvre.

## La limite qu'il vaut mieux connaître

**Sauter à une ligne exige la commande de l'éditeur, pas son icône.** Un bundle
`.app` macOS est lancé via `open`, qui accepte un chemin et rien d'autre — un
éditeur trouvé uniquement sous forme de bundle ouvre donc le fichier au début, et
Gitcito le dit sous la liste déroulante plutôt que de prétendre le contraire.

Le correctif est du côté de l'éditeur : *Shell Command: Install 'code' command in
PATH* pour VS Code, le lien symbolique `subl` de Sublime, *Toolbox → Settings →
Shell scripts* chez JetBrains. Une fois la commande présente, resélectionnez
l'éditeur et le saut à la ligne fonctionne.

## Où apparaissent les actions

| Surface | Ce qu'elle ouvre |
|---------|---------------|
| Onglet de dépôt, dépôt dans la barre latérale, barre d'état | Le dossier du dépôt |
| Arborescence de fichiers, fichiers d'un commit, fichiers d'un remisage, compositeur de commit | Ce fichier |
| L'icône en bout de ligne dans l'arborescence | Ce fichier, en un clic |
| Clic droit sur une ligne dans la vue **fichier** | Le fichier, à cette ligne |
| Clic droit sur une ligne dans la vue **blame** | Le fichier, à cette ligne |
| Un `.xcodeproj` ou autre paquet dans l'arbre de fichiers | Le paquet, dans l'app qui le gère |

Les actions de ligne n'apparaissent que là où le numéro de ligne veut encore dire
quelque chose : un fichier affiché à un ancien commit, ou un blame rembobiné à
une révision antérieure, a des lignes qui ne correspondent plus à ce qui est sur
le disque ; Gitcito ne propose donc aucun saut à cet endroit plutôt que de vous
envoyer au mauvais.

## Projets Xcode et autres paquets

`MyApp.xcodeproj` est un répertoire. Git le sait, et l'arbre de fichiers le
savait aussi — jusqu'à ce que ça devienne gênant : le déplier pour trouver
`project.pbxproj`, `project.xcworkspace` et un dossier par développeur sous
`xcuserdata`, c'est trois clics de bruit pour une chose que vous n'alliez de
toute façon jamais éditer à la main.

Ces entrées portent désormais une icône de paquet et **cliquer sur la ligne
ouvre le paquet**, comme un double-clic dans le Finder. Le chevron reste là :
la seule fois où vous avez *vraiment* besoin de `project.pbxproj` — un conflit
de fusion, presque toujours — vous y descendez comme avant.

Reconnus : `.xcodeproj`, `.xcworkspace`, `.xcframework`, `.framework`, `.app`,
`.appex`, `.dSYM`, `.playground`, `.xcuserdatad`.

**Non** reconnus, volontairement : `.xcassets` et `.lproj`. Ce sont aussi des
paquets, mais on édite les fichiers qu'ils contiennent — les replier coûterait
plus que ça ne rapporte.

### Les limites

**Le paquet s'ouvre par le système, pas par votre éditeur.** Un `.xcodeproj`
donné à un éditeur de texte s'ouvre comme un dossier de property lists, ce que
personne ne voulait en cliquant — Gitcito le confie donc à ce que le système lui
associe, c'est-à-dire Xcode sur un Mac où Xcode est installé. Votre choix
d'éditeur ne bouge pas ; il vaut toujours pour tout fichier ordinaire.

**C'est une convention de nommage, pas un attribut du système de fichiers.**
Gitcito regarde l'extension : un répertoire que vous auriez nommé `notes.app` se
replie lui aussi, et sous Linux ou Windows — où ce sont des dossiers ordinaires
— un clic ouvre le gestionnaire de fichiers plutôt qu'un IDE.

## Une commande à vous

Choisissez **Commande personnalisée** pour tout ce qui n'est pas dans le tableau
— un script enveloppe, un lanceur de développement à distance, un éditeur en
terminal démarré par votre propre passerelle.

| Champ | Signification |
|-------|---------|
| Commande | L'exécutable à lancer. Pas de shell, donc pas de `&&`, de tubes ni de jokers. |
| Nom | Le nom sous lequel les entrées de menu le désignent. |
| Arguments pour un fichier | Gabarit argv, p. ex. `-g {path}:{line}:{col}` |
| Arguments pour un dossier | Gabarit argv, en général juste `{path}` |

Les gabarits sont découpés sur les espaces et chaque jeton est substitué une
fois — un chemin contenant une espace reste un seul argument, et rien n'est
réanalysé ensuite : un nom de fichier ne peut donc jamais se transformer en
syntaxe. Quatre marqueurs : `{path}`, `{line}`, `{col}`, `{repo}`.

Un marqueur sans valeur emporte son option avec lui : `--line {line} {path}`
lancé sans ligne devient simplement le chemin, jamais un `--line` orphelin qui
avalerait le nom de fichier comme argument. Un gabarit sans `{line}` signifie
simplement que Gitcito ne proposera pas d'actions à la ligne près pour cet
éditeur.

## Ce que ce n'est pas

Ce n'est pas le réglage [« Ouvrir avec »](repo-settings.md), qui affiche le
sélecteur du système et mémorise une application pour ouvrir *n'importe quoi* —
une image, un PDF, un dossier dans le Finder. L'éditeur est le plus spécifique
des deux : là où les deux sont définis, l'éditeur l'emporte sur l'icône en bout
de ligne de l'arborescence ; les deux restent listés dans le menu contextuel.

Gitcito ne lance jamais votre éditeur de lui-même, et fermer Gitcito ne le ferme
jamais : l'éditeur est démarré détaché, comme un processus à part entière.
