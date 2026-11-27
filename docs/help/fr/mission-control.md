---
title: Centre de contrôle
category: Synchronisation et multi-dépôts
order: 51
summary: Tous les dépôts de l'espace de travail sur un seul écran, les plus urgents en tête.
keywords: centre de contrôle mission control tableau de bord dashboard tous les dépôts all repos vue d'ensemble overview état status sale dirty non poussé unpushed en retard behind espace de travail workspace pull requests ci version tag intervalle d’actualisation release refresh interval
---

# Centre de contrôle

Vingt dépôts, et la question est toujours la même : lequel a besoin de moi ?

Le centre de contrôle y répond. Tous les dépôts de l'**espace de travail actif**
sur un seul écran, ordonnés selon ce qui réclame réellement votre attention :

1. **Bloqué** — un rebase ou une fusion laissés à moitié, des conflits, un dépôt
   totalement illisible.
2. **À synchroniser** — des commits à tirer, puis des commits à pousser.
3. **En cours** — travail non validé, fichiers non suivis.
4. **Propre** — les tranquilles, tout en bas, là où ils doivent être.

![Tous les dépôts sur un seul écran, les plus urgents en tête](../../screenshots/mission-control.webp)

## Ce que dit une ligne

Chaque ligne se lit de gauche à droite, et les colonnes s’alignent sur toute la
liste : les compteurs se comparent comme dans un tableau.

| Colonne | Ce qu’elle montre |
|---|---|
| **Dépôt** | Nom, groupe, la branche et son upstream — ou **sans upstream** en ambre : une telle branche ne part jamais par erreur, mais ne se synchronise jamais non plus |
| **Dernier commit** | Sujet et auteur : ce que faisait le dépôt, sans l’ouvrir |
| **Local** | Conflits · ↓ à tirer · ↑ à pousser · indexés · modifiés · non suivis · remises. Survolez-les pour savoir ce qu’ils comptent |
| **Hébergement** | Les pull requests ouvertes, celles qui attendent **votre** revue en ambre, et la CI de HEAD. Cliquez sur le nombre pour ouvrir la page **Pull requests** de ce dépôt, ou sur **CI** pour ouvrir ses exécutions |
| **Version** | Le tag le plus récent qu’atteint HEAD, et combien de commits sont venus après — **à jour** s’il n’y en a aucun. Le nombre est coloré selon le retard d’une version : gris jusqu’à 5 commits, jaune jusqu’à 20, rouge au-delà, en quatre plages modifiables — couleurs personnalisées comprises — dans [**Paramètres → Thèmes → Couleurs de la note de version**](themes.md#couleurs-de-la-note-de-version) |
| **Activité** | Un sparkline des commits sur 14 jours, et leur nombre |
| **Temps** | Depuis quand date le dernier commit, et le dernier **fetch** |

Survolez l’icône d’état pour savoir pourquoi la ligne est classée là —
« 2 à pousser · 1 non commité ».

L’âge du fetch est là parce que lire cette page ne fait jamais de fetch : le
compteur « à tirer » n’est pas plus frais que le dernier fetch. Quand une branche
suivie n’a pas fetché depuis un jour ou plus, ou jamais, l’âge passe en ambre —
faites un fetch avant de croire un 0. L’heure vient de git lui-même : un
`git fetch` dans un terminal compte aussi.

![Paramètres → Git et synchronisation : l’actualisation de Mission Control à côté du fetch automatique](../../screenshots/settings-git-sync.webp)

Dans une fenêtre étroite, toutes les colonnes restent, et le tableau défile
latéralement dans son cadre.

**Ouvrir**, au bout d’une ligne, montre le dépôt lui-même — son graphe — même si
son onglet affichait en dernier la liste des pull requests ouverte par le nombre
de PR.

Dépliez une ligne (le chevron, ou <kbd>espace</kbd>) pour voir exactement quels
commits attendent d'être poussés et quels fichiers sont sales.

## Travailler la liste

- Les pastilles d'état en haut sont des **filtres** — cliquez « 3 bloqués » pour
  ne voir que ceux-là. **N PR ouvertes** et **N CI en échec** filtrent de la même
  façon, tout comme **N PR en attente de votre revue** sur la ligne en dessous.
- Triez par **urgence**, par **nom** ou par **activité**.
- **Cochez plusieurs dépôts** pour les récupérer, ou tirez seulement ceux qui
  sont en retard (le bouton les compte pour vous).
- **Fetch des N périmés** apparaît quand des branches suivies n’ont pas fetché depuis
  un jour ou plus, et ne fetche que celles-là — celles dont le « à tirer » peut être faux.
- Il se rafraîchit tout seul toutes les 30 secondes tant qu'il est ouvert —
  changez-le dans **Paramètres → Git et synchronisation → Actualisation de
  Mission Control**, 30 secondes au minimum. Rien ne tourne quand la page est
  fermée.

| Touche | Action |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> ou <kbd>j</kbd> <kbd>k</kbd> | Parcourir la liste |
| <kbd>Enter</kbd> | Ouvrir ce dépôt |
| <kbd>f</kbd> / <kbd>p</kbd> | Le récupérer / le tirer |
| <kbd>espace</kbd> | Le déplier |
| <kbd>/</kbd> | Sauter au filtre |

## C'est une vue, pas un onglet

La jauge à côté du nom de l'espace de travail l'ouvre et la ferme ; cliquer sur
n'importe quel onglet vous ramène à votre travail. Elle n'ajoute jamais d'onglet
à elle, et elle appartient à l'espace de travail où vous êtes — changez d'espace
de travail et vous obtenez le tableau de bord de celui-ci.

Le côté git est **local** : quelques commandes git par dépôt, aucun fetch. La
colonne **Hébergement** est la seule partie qui parle à un hébergeur. Elle
demande à l’hébergeur de chaque dépôt ses pull requests ouvertes et la CI de
HEAD, sous le profil de ce dépôt, et discrètement : un hébergeur sans jeton ni
liaison pour ce profil n’affiche simplement rien, et aucune fenêtre de connexion
ne s’ouvre jamais. Un dépôt déjà ouvert dans un onglet ne coûte aucun appel,
puisque la barre latérale a déjà ses pull requests.

Limites, pour bien lire les nombres :

- Les hébergeurs sont interrogés **au plus toutes les 5 minutes** par dépôt (plus
  tôt quand HEAD bouge ou qu’une exécution de CI est encore en cours), quel que
  soit l’intervalle d’actualisation — le quota d’API d’un hébergeur est partagé
  avec le reste de l’application. **Actualiser** redemande tout de suite.
- Un nombre affiche **30+** quand la première page de l’hébergeur est revenue
  pleine ; la page de la liste les a toutes.
- La colonne version est le tag le plus récent **atteignable depuis HEAD**, pas
  le tag le plus récent du dépôt. Un tag posé sur un commit que HEAD a déjà
  apparaît en moins de deux minutes.

Une récupération est toujours quelque chose que vous avez demandé.

**Voir aussi :** [Espaces de travail et onglets](workspaces.md) · [Espaces de travail, onglets et groupes](workspaces.md)
