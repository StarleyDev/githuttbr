---
title: Thèmes et apparence
category: Personnalisation
order: 100
summary: Thèmes intégrés, clairs et sombres, plus des thèmes personnalisés et générés par l'IA, et des icônes en couleur.
keywords: thème thèmes theme themes sombre dark clair light apparence appearance couleurs colors taille de police font size graphe graph palette rechercher paramètres réglages trouver search settings icône icônes couleurs des icônes teinte monochrome icon icons icon colors tint
---

# Thèmes et apparence

Thèmes intégrés — Gitcito, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast et Daltonic — chacun avec une variante claire et une variante
sombre.

![Passage du clair au sombre](../../screenshots/clip-themes.webp)

- **Clair, sombre, ou suivre le système**, changé à chaud.
- Des **thèmes personnalisés**, et des thèmes **générés par l'IA** à partir d'une
  consigne.
- Une **taille de police de code** ajustable.
- Des **couleurs d’icônes** pour la barre d’outils et les sections de la barre
  latérale — voir plus bas.
- Un **style de graphe** distinct : palette de couloirs, style des angles,
  densité des lignes et épaisseur des traits, avec un aperçu en direct sous forme
  de mini-graphe.

![Les paramètres de thème](../../screenshots/settings-themes.webp)

## Couleurs des icônes

Une rangée d’icônes grises fait se ressembler Récupérer, Pousser et Remiser
jusqu’à ce qu’on lise leurs libellés. **Couleurs des icônes**, sous Apparence
dans l’onglet Thème, colore chaque icône selon ce qu’elle fait, pour que l’œil
trouve l’action avant le mot :

| Rôle | Icônes | Couleur du thème qu’elle prend |
|---|---|---|
| Recevoir | Récupérer, Tirer, Distants, Arbres de travail | l’emplacement cyan du thème |
| Envoyer, terminer | Pousser, Tâches, Tickets, Versions | vert |
| Références | Branche, Locales, Étiquettes, Pull requests, Jalons, Sous-modules | l’accent |
| Mettre de côté | Remiser, Dépiler, Remisages, Signets, Épinglée | l’emplacement orange du thème |

Annuler, Rétablir, Outils et Paramètres restent gris : ce sont des utilitaires,
et les laisser neutres est ce qui fait ressortir les icônes colorées.

Les listes qui regroupent beaucoup d’entrées colorent un groupe entier à la fois,
pour qu’un groupe se lise comme une famille :

- **Menu Outils** — le voyage dans le temps (Reflog, Instantanés de travail,
  Machine à remonter le temps, Bisect) en orange ; les outils de branche
  (Absorb, les radars, la CI locale, les comparaisons) dans l’accent ; et une
  couleur par groupe : Inspecter cyan, Branches et historique l’accent, Fichiers
  et patchs vert, Dépôt orange, Secrets et partage rouge.
- **Pages des Paramètres** — Disposition, Espaces de travail et IA dans l’accent ;
  Profil et Environnement vert ; Intégrations et Données cyan ; Thèmes orange ;
  Sécurité rouge. Général et Raccourcis restent gris.

| Option | Ce que vous voyez |
|---|---|
| **Monochrome** | Toutes les icônes grises, comme avant que cette option existe |
| **Teinte douce** (par défaut) | La couleur mêlée au gris ; la couleur entière au survol |
| **Couleur pleine** | La couleur elle-même, sur une petite pastille de la même teinte |

Les couleurs viennent du thème : un thème qui repeint son vert ou son accent
repeint les icônes avec, thèmes personnalisés et générés par l’IA compris.

Limites : seuls les boutons principaux de la barre d’outils, les en-têtes des
sections de la barre latérale, le menu Outils et les pages des Paramètres sont
colorés ; les autres menus, les lignes à l’intérieur d’une section et le graphe
des commits ne le sont pas. Une ligne de menu survolée garde son aspect habituel,
icône comprise. La couleur n’est jamais le seul indice : chaque icône garde son
libellé.

## Trouver un réglage

Les Paramètres s'étendent sur de nombreuses pages, et l'option que vous cherchez est rarement
là où vous l'attendez : vous savez qu'elle existe, pas sur quelle page. Le champ
de recherche dans l'en-tête des Paramètres, à côté du bouton de fermeture,
cherche dans toutes les pages à la fois.

![Recherche de « terminal » dans les paramètres](../../screenshots/settings-search.webp)

À mesure que vous tapez, la partie droite liste les paramètres correspondants,
regroupés par page — chacun avec son nom, sa description d'une ligne et la page
où il se trouve. La barre latérale estompe les pages sans résultat et affiche un
compteur sur celles qui en ont.

- La recherche porte sur le nom du réglage, sa description et le nom de la
  page. Majuscules et accents sont ignorés, et chaque mot tapé doit apparaître :
  « police terminal » ne garde que les paramètres de police du terminal.
- Elle cherche dans la langue de l'interface et en anglais en même temps : avec
  l'application en français, taper « token » ou « font » trouve toujours le
  réglage.
- Cliquez sur un résultat, ou appuyez sur **Entrée** pour le premier, pour
  ouvrir sa page (et le bon onglet dans Thèmes — Thème ou Graphe), défiler
  jusqu'au réglage et le mettre en évidence un instant.
- **Échap** efface la recherche ; un second **Échap** ferme les Paramètres.

Elle cherche dans les noms et les descriptions, pas dans les valeurs que vous
avez choisies. Les listes de serveurs par hébergeur d'Intégrations (GitHub
Enterprise Server, GitLab autogéré, Bitbucket Data Center) ouvrent la page
Intégrations ; c'est à vous de choisir l'onglet de l'hébergeur. Les raccourcis
clavier ne sont pas indexés un par un — la recherche trouve la page Raccourcis,
dont l'éditeur les liste.

## Disposition

Barre latérale à gauche ou à droite, panneaux redimensionnables partout, une
barre latérale repliable pour quand le graphe mérite toute la fenêtre, et un
placement du terminal par dépôt.

**Voir aussi :** [Le graphe des commits](graph.md) · [Profils](profiles.md)
