---
title: Clonage
category: Pour commencer
order: 2
summary: Cloner depuis une URL ou directement depuis votre hébergeur — et réduire ce qui descend quand le dépôt est énorme.
keywords: clone cloner clonage arrière-plan background annuler cancel plusieurs multiples lot batch dépôts tout sélectionner shallow superficiel depth profondeur partial partiel filter blob none single branch une seule branche submodules sous-modules recursive ls-remote sélecteur de branche unshallow monorepo
source: 3d8942b1073ef47bd000c7887afb5ea8cdebcdd7
---

# Clonage

**Nouveau dépôt → Cloner**, ou `⌘K` → *Cloner*. Collez une URL, ou connectez-vous
à GitHub, GitLab, Bitbucket ou Azure DevOps et choisissez parmi vos propres
dépôts — le jeton du [profil](profiles.md) sélectionné sert au clonage puis est
abandonné, jamais écrit dans `.git/config`.

Choisissez un dossier parent et un nom ; la ligne sous les champs indique
exactement où le dépôt va atterrir. Un dossier qui existe déjà est refusé plutôt
que fusionné.

## Plusieurs dépôts à la fois

Installer une nouvelle machine, ou récupérer tous les services d'une équipe,
voulait dire ouvrir cette boîte de dialogue une fois par dépôt. Dans un onglet
d'hébergeur, cochez la case de chaque dépôt voulu, ou **Tout sélectionner
(affichés)** pour prendre tout ce que le filtre retient. Cliquer sur une ligne
(pas sur sa case) choisit toujours ce seul dépôt.

Avec plus d'un dépôt coché, la boîte de dialogue les clone tous dans le même
dossier parent, chacun dans un dossier au nom du dépôt. Les chemins sont listés
avant de commencer. Si deux portent le même nom (`org-a/app` et `org-b/app`), les
deux reçoivent le propriétaire dans leur nom de dossier (`org-a-app`,
`org-b-app`) au lieu de se disputer un seul dossier.

![L'onglet GitHub de la boîte de dialogue de clonage avec trois dépôts cochés, les dossiers où ils vont atterrir listés sous le dossier parent, et un bouton Cloner 3 dépôts](../../screenshots/clone-multi-select.webp)

Le lot part directement dans le plateau en coin. Trois clonages tournent en même
temps et les autres attendent *En file d'attente* ; chacun a son propre bouton
d'annulation. Chaque dépôt s'ouvre dans un onglet dès qu'il est terminé.

Limites :
- **Branche à extraire** est masquée pour un lot : un nom de branche n'a pas de
  sens d'un dépôt à l'autre, donc chacun reçoit sa branche par défaut. Les autres
  options Avancé (partiel, superficiel, une seule branche, sous-modules)
  s'appliquent à tous.
- La sélection multiple ne fonctionne que dans les onglets d'hébergeur. L'onglet
  URL prend une seule URL.
- Un échec n'arrête pas les autres. Un dépôt dont le dossier existe déjà échoue
  avec sa propre erreur et le reste continue.

## Avancé — restreindre le clone

Tout ce qui se trouve sous **Avancé** est désactivé par défaut : n'y touchez pas
et vous obtenez un clone ordinaire et complet. Ces options justifient leur
présence sur les dépôts où « complet » veut dire vingt minutes et plusieurs
gigaoctets.

![La boîte de dialogue de clonage avec Avancé ouvert : partiel, superficiel, une seule branche, sous-modules et un sélecteur de branche](../../screenshots/clone-advanced.webp)

| Option | Ce que fait git | Ce que ça coûte |
|--------|---------------|---------------|
| **Clone partiel** | `--filter=blob:none` | Historique complet, sans le contenu des fichiers. Les blobs arrivent à la demande : ouvrir un vieux fichier exige donc le réseau. |
| **Clone superficiel** | `--depth=N` | Seuls les N commits les plus récents existent. Blame, log, bisect et range-diff s'arrêtent à la coupure. |
| **Une seule branche** | `--single-branch` | Les autres branches restent sur le distant jusqu'à ce que vous les récupériez. |
| **Cloner les sous-modules** | `--recurse-submodules` | Chaque sous-module est extrait lui aussi — plus de temps maintenant, pas de répertoire manquant plus tard. |
| **Branche à extraire** | `--branch <name>` | Démarre sur cette branche plutôt que sur la branche par défaut du distant. |

**Partiel avant superficiel.** Un clone partiel conserve tous les commits :
l'historique reste consultable, et seul le contenu des fichiers est récupéré
paresseusement. Un clone superficiel, lui, jette réellement de l'historique :
`git log` s'arrête à la coupure et le blame ne peut pas voir au-delà. Si vous
clonez un monorepo pour y travailler, c'est généralement le partiel que vous
voulez.

Le superficiel se défait : `git fetch --unshallow` dans le
[terminal](terminal.md) recomplète l'historique.

### Choisir la branche

Tapez un nom de branche, ou appuyez sur **Lister les branches** pour demander au
distant ce qu'il possède (`git ls-remote --heads`) et choisir dans une liste
déroulante. C'est un seul aller-retour réseau, effectué uniquement quand vous
appuyez sur le bouton — rien n'est interrogé pendant que vous tapez.

Si le listage échoue — URL privée sans jeton, faute de frappe, pas de réseau —
le champ reste une simple zone de texte et le clonage lui-même signale la vraie
erreur.

### Deux remarques sur les options

- **`--depth` implique `--single-branch`.** Avec un clone superficiel, laisser
  *Une seule branche* décoché est précisément ce qui redemande les autres
  branches (`--no-single-branch`) : d'où le changement de l'indication en
  dessous.
- **Cloner un dossier local** ignore normalement `--depth` complètement, parce
  que git crée des liens durs vers la base d'objets au lieu de récupérer quoi que
  ce soit. Gitcito clone via une URL `file://` quand vous demandez une copie
  superficielle d'un dépôt local : la profondeur demandée est donc bien celle que
  vous obtenez.

## Progression, arrière-plan et annulation

La barre rapporte ce que git rapporte : décompte, compression, réception,
résolution, extraction. Une étape incapable d'annoncer un total affiche une
barre indéterminée plutôt qu'un faux pourcentage.

Un gros clonage prend des minutes, et un clic égaré hors de la boîte de dialogue
vous les faisait toutes perdre. Désormais, fermer la boîte de dialogue —
**Exécuter en arrière-plan**, `Esc`, le ✕ ou un clic à l'extérieur — ne fait que
la masquer : le clonage continue et passe dans une petite carte dans le coin
inférieur, avec la même barre de progression. Vous pouvez lancer un autre clonage
entre-temps ; chacun a sa propre carte.

![Le plateau des clonages dans le coin inférieur : trois clonages en réception, résolution et décompte, un quatrième en file d'attente, chacun avec son propre bouton d'annulation](../../screenshots/clone-tray.webp)

Mauvais dépôt ? **Annuler le clonage** dans la boîte de dialogue, ou le ✕ de sa
carte, arrête git et supprime le dossier à moitié écrit. Rien d'autre n'est
touché — le dossier n'existait pas avant le début du clonage, ce qui est vérifié
à l'avance. Un clonage annulé ne peut pas reprendre ; le relancer repart de zéro.

Une fois terminé, le nouveau dépôt s'ouvre dans un onglet, épinglé au profil
avec lequel vous avez cloné, que la boîte de dialogue soit encore ouverte ou non.

Les clonages tournent dans l'app : quitter Gitcito les arrête. La fermeture
n'attend pas le nettoyage, donc le dossier à moitié écrit peut rester —
supprimez-le avant de cloner de nouveau au même endroit, puisque la boîte de
dialogue refuse un dossier qui existe.
