---
title: Thèmes et apparence
category: Personnalisation
order: 100
summary: Thèmes intégrés, clairs et sombres, plus des thèmes personnalisés et générés par l'IA, et des icônes en couleur.
keywords: thème thèmes theme themes sombre dark clair light apparence appearance couleurs colors taille de police font size graphe graph palette rechercher paramètres réglages trouver search settings icône icônes couleurs des icônes teinte monochrome icon icons icon colors tint
---

# Thèmes et apparence

Thèmes intégrés — GitHuttBr, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast et Daltonic — chacun avec une variante claire et une variante
sombre.

![Passage du clair au sombre](../../screenshots/clip-themes.webp)

- **Clair, sombre, ou suivre le système**, changé à chaud.
- Des **thèmes personnalisés**, et des thèmes **générés par l'IA** à partir d'une
  consigne.
- Une **taille de police de code** ajustable.
- Des **couleurs d’icônes** pour la barre d’outils et les sections de la barre
  latérale — voir plus bas.
- L’**allure du graphe** — palette des voies, angles, densité des lignes et épaisseur, avec un aperçu en direct — a sa propre page, **Paramètres → Graphe** : voir [le graphe des commits](graph.md).

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
- **Pages des Paramètres** — Disposition et terminal, Espaces de travail et IA dans la couleur d’accent ; Profil et identité, Analyseurs de code et Environnement en vert ; Comptes connectés, Git et synchronisation et Données et sauvegarde en cyan ; Thèmes et Graphe en orange ; Sécurité et confirmations en rouge. Général, Raccourcis et À propos restent gris.

Une rangée de boutons à icône sans libellé fait l’inverse — chaque bouton a sa
propre couleur, pour qu’on puisse les distinguer. Sur la [page des pull
requests](pull-requests.md), les boutons de l’en-tête sont : actualiser en bleu,
relecture IA dans la couleur d’accent, aperçu en local en turquoise, aller à la
branche source en vert et aller à la branche cible en orange (ouvrir dans le
navigateur reste gris), et sur vos propres commentaires **Modifier** prend l’accent
et **Supprimer** le rouge — là et sur la page de l’issue. Le bleu et le turquoise
sont des mélanges des couleurs du thème, ils le suivent donc aussi.

| Option | Ce que vous voyez |
|---|---|
| **Monochrome** | Toutes les icônes grises, comme avant que cette option existe |
| **Teinte douce** (par défaut) | La couleur mêlée au gris ; la couleur entière au survol |
| **Couleur pleine** | La couleur elle-même, sur une petite pastille de la même teinte |

Les couleurs viennent du thème : un thème qui repeint son vert ou son accent
repeint les icônes avec, thèmes personnalisés et générés par l’IA compris.

Limites : seuls les boutons principaux de la barre d’outils, les en-têtes des
sections de la barre latérale, le menu Outils, les menus contextuels des commits, des branches et des dépôts, les pages des Paramètres et les
boutons des pages de pull request et d’issue et les icônes de la barre d’état (le
dossier, Aide, Signaler un problème) sont colorés — le numéro de version reste
gris ; les autres menus, les
lignes à l’intérieur d’une section et le graphe des commits ne le sont pas. Une
ligne de menu survolée garde son aspect habituel, icône comprise. La couleur n’est
jamais le seul indice : chaque icône garde son libellé.

## Couleurs de la note de version

Le [Centre de contrôle](mission-control.md) indique combien de commits chaque dépôt
a faits depuis son tag le plus récent. **Couleurs de la note de version** décide
de l’allure de ce nombre, pour qu’une version en retard se remarque et qu’une
version récente reste discrète.

Il y a quatre plages. Les trois premières s’arrêtent à un nombre de commits que
vous choisissez ; la dernière prend tout ce qui les dépasse. Chaque plage prend
l’une des couleurs du thème, ou une **Couleur personnalisée…** depuis la pastille
au bout de sa ligne.

| Plage | Par défaut |
|---|---|
| Jusqu’à 5 commits | Gris, comme le reste de la ligne |
| Puis jusqu’à 20 | Jaune |
| Puis jusqu’à 50 | Rouge |
| Au-delà | Rouge |

Une couleur du thème suit le thème, en clair comme en sombre. Une couleur
personnalisée reste exactement telle que choisie dans tous les thèmes : choisissez-en
une qui se lit sur les deux fonds.

![Paramètres → Thèmes : les quatre plages de la note de version, chacune avec ses couleurs et une pastille personnalisée](../../screenshots/settings-release-colors.webp)

## Comment les Paramètres sont organisés

Le menu latéral regroupe les pages par sujet :

| Groupe | Pages |
|---|---|
| **Vous** | Profil et identité · Comptes connectés · IA — les deux premières modifient le profil nommé dans l’en-tête ([profils](profiles.md)) |
| **Apparence** | Thèmes · Graphe · Disposition et terminal |
| **Comportement** | Général · Git et synchronisation · Sécurité et confirmations · Analyseurs de code |
| **Système** | Espaces de travail · Raccourcis · Environnement · Données et sauvegarde · À propos |

Général ne garde que ce qui concerne l’app dans son ensemble — Langue, Les onglets de dépôt affichent, Notifications du bureau, Ouvrir le changelog après une mise à jour, Avertir à la fermeture. Le reste a rejoint la page à laquelle il appartient, et la note de la page y mène :

| Option | Désormais dans |
|---|---|
| Commits chargés au départ, Commits par « charger plus », Charger la suite automatiquement au défilement, Dates relatives, Afficher les avatars, Utiliser les photos de profil GitHub | **Graphe** — avec Palette des couloirs, Angles des lignes, Densité des lignes, Style des nœuds, Focalisation du graphe, Disposition des remisages, Épaisseur des traits, qui formaient l’onglet Graphe de Thèmes |
| Récupération automatique toutes les (minutes), Toujours créer un commit de fusion, Mémoriser les résolutions de conflits, Outils externes de diff et de fusion, Éditeur externe, Application « Ouvrir avec » par défaut | **Git et synchronisation** |
| Confirmer avant un push forcé | **Sécurité et confirmations** |
| Analyseurs de code, launch.json | **Analyseurs de code** |
| Visionneuse de fichiers, Animer l’avatar du profil, Masquer les tâches terminées, Grouper les réfs par préfixe | **Disposition et terminal** |

Intégrations s’appelle désormais **Comptes connectés**, Données devient **Données et sauvegarde**. Rien n’a changé dans ce que fait chaque option, et les réglages enregistrés sont repris tels quels. Un lien qui ouvre une page par son ancien nom arrive toujours au bon endroit.

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

- Elle compare le nom du réglage, sa description et le nom de la page — y compris la page où il se trouvait avant le regroupement du menu : « general fetch » trouve toujours la récupération automatique dans Git et synchronisation, et « integrations » trouve Comptes connectés. Casse et accents sont ignorés, et chaque mot tapé doit apparaître : « terminal font » se restreint aux réglages de police du terminal.
- Elle cherche dans la langue de l'interface et en anglais en même temps : avec
  l'application en français, taper « token » ou « font » trouve toujours le
  réglage.
- Cliquez sur un résultat, ou appuyez sur **Entrée** pour le premier, pour ouvrir sa page, faire défiler jusqu’au réglage et le mettre en évidence un instant.
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

La même page, **Paramètres → Disposition et terminal**, contient aussi les extras de la barre de titre et de la barre latérale — **Animer l’avatar du profil**, **Masquer les tâches terminées**, **Grouper les réfs par préfixe** — ainsi que la marge des modifications et la minicarte de la visionneuse de fichiers.

**Voir aussi :** [Le graphe des commits](graph.md) · [Profils](profiles.md)
