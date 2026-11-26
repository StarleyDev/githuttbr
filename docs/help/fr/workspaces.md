---
title: Espaces de travail, onglets et groupes
category: Pour commencer
order: 3
summary: Beaucoup de dépôts sans se noyer : onglets, groupes, dossiers et espaces de travail.
keywords: espace de travail workspace onglets tabs groupes groups dossiers folders plusieurs dépôts multiple repos organiser switch basculer disposition layout aller au dépôt sélecteur taille des onglets go to repository switcher tab sizing
source: 6fc6b6e0f1f3c8f6a3a638dc0388df5328222a41
---

# Espaces de travail, onglets et groupes

Trois niveaux, du plus lâche au plus serré.

## Onglets

Un dépôt, un onglet. Utilisez <kbd>⌘T</kbd> / <kbd>Ctrl+T</kbd> pour ouvrir le
sélecteur de nouvel onglet et <kbd>⌘W</kbd> / <kbd>Ctrl+W</kbd> pour fermer
l'onglet actif. Vous pouvez aussi glisser pour réordonner, cliquer avec le bouton
du milieu pour fermer, ou appuyer sur <kbd>⌘⇧T</kbd> pour rouvrir le dernier
onglet fermé. Un clic droit sur un onglet de dépôt (ou sur une pastille dans un
[groupe](#groupes)) ouvre le [menu contextuel du dépôt](repo-menu.md) — alias,
worktrees, GitHub, terminal, affichage, éditeur et, tout en bas, **Fermer ce
dépôt** et **Fermer les autres** (une pastille dans un groupe propose plutôt le
retrait). Fermez le dernier
onglet et <kbd>⌘W</kbd> ferme la fenêtre à la place. Un point sur l'onglet signale du travail non validé ; un autre signale des
conflits.

Si un avertissement de fermeture apparaît, <kbd>Escape</kbd> annule toujours.
<kbd>Enter</kbd> ne confirme que si l'onglet est propre — en présence de
modifications non validées ou de conflits, l'avertissement vous oblige
délibérément à viser le bouton, pour qu'une frappe parasite après <kbd>⌘W</kbd> ne
puisse pas fermer du travail que vous teniez encore.

### Taille des onglets

Par défaut (**Paramètres → Disposition → Taille des onglets → Ajuster**), les
onglets se comportent comme ceux d’un navigateur : quand la bande manque de place,
ils rétrécissent tous pareil jusqu’à une largeur minimale, et ne défilent qu’une fois
ce plancher atteint. **Fixe** rétablit le comportement classique — chaque onglet
garde la largeur de son contenu et la bande défile dès qu’ils ne tiennent plus tous.

### Aller à un dépôt

Avec dix dépôts ouverts ou plus, en trouver un dans la bande oblige à faire
défiler, <kbd>⌘1</kbd>–<kbd>⌘9</kbd> s’arrêtent au neuvième onglet, et la [palette
de commandes](search.md) mêle les dépôts ouverts à toutes les actions. Appuyez sur
<kbd>⌘J</kbd> / <kbd>Ctrl+J</kbd> (ou **Affichage → Aller au dépôt…**) et tapez
quelques lettres de son nom, de son dossier ou de sa branche, puis <kbd>Entrée</kbd>.

![Le sélecteur de dépôts, les plus récemment utilisés en premier](../../screenshots/repo-switcher.webp)

La liste ne contient que les dépôts ouverts, membres de groupes compris, dans
l’ordre où vous les avez regardés pour la dernière fois. Celui que vous venez de
quitter est en tête, donc <kbd>⌘J</kbd> <kbd>Entrée</kbd> vous y ramène. Chaque
ligne porte ce que montre son onglet : la branche, le point de travail non validé
ou de conflit, le groupe où il se trouve, et sa touche <kbd>⌘1</kbd>–<kbd>⌘9</kbd>
s’il en a une. Le dépôt à l’écran est grisé en bas. Rien ne s’assombrit derrière le
sélecteur ; un clic à côté ou <kbd>Échap</kbd> le ferme.

Quand rien d’ouvert ne correspond, la dernière ligne, **Rechercher dans tous les
dépôts**, porte votre recherche vers la page [Dépôts](repositories.md). Le
raccourci se réassigne dans **Paramètres → Raccourcis**.

*Limites :* l’ordre n’est retenu que pour cette session, donc après un redémarrage
il part de l’ordre des onglets. Un dépôt ouvert dans deux onglets n’apparaît qu’une
fois, à son premier onglet. Les dépôts d’autres [espaces de travail](#espaces-de-travail) ne sont
pas listés — changez d’abord d’espace de travail, ou utilisez la page Dépôts.

## Groupes

Rassemblez des dépôts liés dans un **onglet de groupe** nommé et coloré. À
l'intérieur d'un groupe, vous obtenez une seconde rangée avec une pastille par
dépôt, et le groupe lui-même peut faire **Tout récupérer** ou **Tout tirer** d'un
seul geste.

Pour en créer un, clic droit sur un onglet de dépôt → *Nouveau groupe…* :
l'onglet devient un groupe contenant ce dépôt, à la même place. Dès qu'un groupe
existe, le même menu propose *Ajouter à un groupe →*, avec la liste des groupes
ouverts. Glisser un onglet de dépôt sur la pastille d'un groupe fait de même.

Pour en commencer un, clic droit sur un onglet de dépôt → *Nouveau groupe…* :
l’onglet devient un groupe contenant ce dépôt, à la même place. Une fois qu’un
groupe existe, le même menu indique *Ajouter à un groupe →*, avec les groupes
ouverts. Glisser un onglet de dépôt sur une pastille de groupe fait la même chose.

*Nouveau groupe…* demande un nom et une couleur ensemble. La couleur part d’une
couleur qu’aucun groupe ouvert ne porte encore, tirée au hasard, pour que les
groupes ne commencent pas tous pareil.

![La boîte de dialogue Nouveau groupe, avec un nom et une couleur choisis ensemble](../../screenshots/new-group-dialog.webp)

Pour changer la couleur d’un groupe, clic droit dessus : les dix couleurs sont dans
le menu en une rangée de points, avec un anneau autour de la couleur actuelle, et un
clic l’applique. *Couleur personnalisée…* sous la rangée ouvre un sélecteur pour
n’importe quelle autre couleur. Les dossiers et les sections de la page Dépôts
utilisent la même rangée.

![Le menu contextuel d’un groupe : la rangée de couleurs, Couleur personnalisée…, Dégrouper et Fermer le groupe](../../screenshots/group-color-menu.webp)

Pour défaire un groupe, clic droit dessus → **Dégrouper**. Chaque dépôt devient un
onglet ordinaire à la place du groupe, en gardant les pages qu’il avait ouvertes.
**Fermer le groupe** ferme au contraire le groupe et tous ses dépôts. Les dossiers ne
survivent pas à un Dégrouper : ils n’existent qu’à l’intérieur d’un groupe.

![Un onglet de groupe contenant plusieurs dépôts](../../screenshots/repo-groups.webp)

Les groupes peuvent contenir des **dossiers, imbriqués à n'importe quelle
profondeur** : clic droit sur le groupe → *Nouveau dossier…*, puis glissez les
dépôts sur une pastille de dossier. Chaque dossier prend une couleur, se replie
en une pastille comptée, agrège les points d'état de tout ce qu'il contient, et
peut récupérer ou tirer son sous-arbre entier.

![Des dossiers dans la barre d'onglets du groupe, chacun une pastille comptée — Internal imbriqué dans Services](../../screenshots/nested-folders.webp)

> Les dossiers ne font qu'organiser. En supprimer un remonte ses dépôts au parent
> — cela ne ferme jamais un dépôt.

Pour ajouter un dépôt que le groupe ne contient pas encore, cliquez sur le **+** à côté du nom du groupe. Il affiche la page du groupe — ouvrir un dossier, cloner, créer ou choisir un dépôt récent — même quand l’un de ses dépôts est ouvert ; un clic sur une puce vous y ramène.

## Les pages qui appartiennent à un dépôt

Certaines pages ne sont pas autonomes : le [wiki](repo-wiki.md) d’un dépôt, ses
[statistiques](insights.md), les [outils de développement](devtools.md) qu’une
session de lancement a annoncés. Elles ne prennent pas d’onglet — elles
apparaissent en petites puces sur le dépôt lui-même : une icône et un mot qui dit
de quelle page il s’agit (*CI*, *PR*, *Wiki*, *#482* pour une pull request, le tag
d’une release). Le nom complet est dans l’infobulle, et un tag ou un titre long est
raccourci par des points de suspension.

- **Cliquez une icône** pour afficher la page. **Recliquez — ou cliquez le nom
  du dépôt** — pour revenir au dépôt. Tant qu’une page est affichée, le nom
  prend un curseur de pointeur et une petite pastille au survol : c’est le
  chemin du retour.
- **Survolez une icône** pour la ✕ qui ferme cette page seule.
- Dans un **groupe**, les icônes se posent sur la pastille du dépôt auquel
  elles appartiennent, et seulement tant que ce dépôt est celui qui est
  sélectionné. Choisir un autre dépôt du groupe affiche *ce* dépôt, pas l’outil
  du voisin.
- Rouvrir la même page rallume l’icône existante au lieu d’en ajouter une
  seconde.

Un dépôt qui n’est ouvert nulle part n’a pas d’icône à porter : une page pour
lui ouvre alors son propre onglet — ouvrir doit toujours ouvrir quelque chose.

## Espaces de travail

Un espace de travail est une **barre d'onglets entière, sauvegardée**. En changer
échange tous les onglets d'un coup : `Work` et `Personal` cessent de se marcher
dessus.

Le nom de l'espace de travail se trouve en haut à gauche, à côté de la marque
GitHuttBr. Cliquez dessus pour changer, créer, renommer, réordonner ou supprimer.
Juste à côté se trouve la jauge qui ouvre le [centre de
contrôle](mission-control.md) de l'espace de travail où vous êtes.

**Voir aussi :** [Centre de contrôle](mission-control.md) · [La ligne de commande](cli.md)
