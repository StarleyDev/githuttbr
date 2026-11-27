---
title: Arbres de travail et sous-modules
category: Synchronisation et multi-dépôts
order: 54
summary: Plusieurs extractions d'un même dépôt ; et des dépôts à l'intérieur de dépôts.
keywords: arbre de travail worktree worktrees sous-module submodule submodules extraction liée linked checkout init sync synchroniser
---

# Arbres de travail et sous-modules

## Arbres de travail

Un arbre de travail est une seconde extraction du même dépôt, dans son propre
dossier — vous pouvez donc regarder `main` pendant que `feature/x` reste
exactement comme vous l'avez laissée, sans rien remiser.

- Créez et supprimez des arbres de travail depuis la barre latérale. Un
  **double-clic** en ouvre un dans son propre onglet ; le clic droit propose
  *Ouvrir l'arbre de travail*, *Afficher dans le dossier* et la suppression.
- Clic droit sur n'importe quelle branche locale → **Ouvrir dans un arbre de
  travail** pour en monter un dans un dossier voisin et l'ouvrir comme onglet.
- Une branche ne vit que dans un seul arbre de travail à la fois : extraire une
  branche qu'un autre arbre détient ne peut pas marcher — git refuse par
  *already used by worktree at …*. GitHuttBr vous y emmène plutôt : le menu de la
  branche indique *Aller à `x` dans son arbre de travail*, et un double-clic sur
  la ligne ouvre l'onglet de cet arbre au lieu d'échouer.

### Prendre soin des arbres de travail

Un arbre de travail créé le mois dernier s’oublie vite, et les questions arrivent au moment du ménage : y a-t-il du travail dedans ? Le dossier existe-t-il encore ? Chaque ligne y répond avant que vous ayez à les poser.

| Sur la ligne | Signifie |
|---|---|
| **●3** | Trois fichiers avec des modifications non validées dans cet arbre de travail |
| **↑2 ↓1** | Sa branche a deux commits d’avance et un de retard sur son upstream |
| 🔒 | Verrouillé — survolez-le pour voir la raison donnée lors du verrouillage |
| **absent**, nom barré | Le dossier n’existe plus ; git n’en garde que l’enregistrement |

![La section Arbres de travail : un arbre avec du travail non commité et des
commits d’avance, un manquant, un verrouillé, et la gomme dans l’en-tête](../../screenshots/worktree-care.webp)

Les compteurs sont lus à l’ouverture de la section, quand le commit de cet arbre de travail change et quand la fenêtre reprend le focus — pas à chaque rafraîchissement, car chacun est un `git status` dans un autre dossier.

Clic droit sur une ligne pour :

| Action | Ce qu’elle fait |
|---|---|
| **Verrouiller l’arbre de travail** | Empêche git (et tout autre client) de le nettoyer, le déplacer ou le supprimer. Donnez une raison — *sur le disque externe* — et elle s’affiche sur le cadenas. Pour les arbres de travail sur un support pas toujours branché. |
| **Déverrouiller l’arbre de travail** | L’inverse. Annuler le reverrouille avec la même raison. |
| **Déplacer l’arbre de travail…** | Déplace le dossier et met à jour les liens de git dans les deux sens. Indisponible s’il est verrouillé ou ouvert dans un onglet : les onglets et leur disposition sont mémorisés par chemin, l’onglet ne pointerait plus sur rien. Fermez-le d’abord. Annuler le remet en place. |
| **Supprimer l’arbre de travail** | Demande d’abord à git ce qui serait perdu. Un arbre propre reçoit la confirmation habituelle, et annuler le recrée sur la même branche dans le même dossier. Un arbre avec des modifications non validées reçoit une autre confirmation, *Abandonner et supprimer*, qui indique le nombre de fichiers, sans annulation possible. |
| **Reconnecter le dossier déplacé…** | Seulement sur une ligne *absente* : indiquez où est parti le dossier (déplacé dans le gestionnaire de fichiers) et git le relie avec `git worktree repair`. |
| **Oublier les arbres de travail absents** | C’est aussi le bouton gomme dans l’en-tête de la section, affiché quand une ligne est absente. Lance `git worktree prune`. |

Ce que ces actions **ne** font **pas** :

- **Supprimer un arbre de travail efface aussi ses fichiers ignorés** — `.env`, `node_modules`, sorties de build. Git ne les compte pas comme des modifications ; même la confirmation « propre » le signale, et l’annulation ne les restaure pas.
- **Oublier ne supprime que l’enregistrement de git.** Il n’y a aucun fichier à effacer — le dossier a disparu — et les arbres verrouillés sont ignorés, car un arbre verrouillé sur un disque débranché ressemble exactement à un arbre supprimé.
- Un verrou est une convention entre clients git, pas une protection de fichiers : rien n’empêche un outil extérieur à git d’effacer le dossier.
- L’arbre de travail principal — le dépôt lui-même — ne peut être ni verrouillé, ni déplacé, ni supprimé.
- Supprimer un arbre de travail ne supprime jamais sa branche. Supprimez-la depuis la liste des branches si vous en avez fini.

### Regrouper les arbres de travail dans l’en-tête

Les onglets d’arbre de travail s’ouvrent avec des libellés `racine · branche`, qui
s’élargissent vite.

**Un projet rangé dans un groupe y accueille ses arbres de travail.** Quand le
dépôt — ou l’un de ses arbres de travail — est déjà dans un groupe, un nouvel
arbre de travail s’ouvre dans ce groupe, à côté de lui, sans rien à cocher : la
boîte de dialogue d’ajout indique seulement quel groupe, et **Ouvrir dans un
arbre de travail** depuis le menu d’une branche fait de même sans demander. Un
arbre de travail ouvert plus tard depuis **Récents** ou depuis un dossier le
rejoint aussi. Faites glisser la pastille hors du groupe si vous la voulez à part.

Pour un dépôt dans son propre onglet, cochez **Proposer de regrouper les worktrees
partageant le même dépôt racine** dans la boîte de dialogue d’ajout (désactivé par
défaut, mémorisé comme l’option codegraph) : si la racine est ouverte dans un
onglet isolé, un champ **Nom du groupe** apparaît (prérempli avec le nom du
dossier de la racine) et les deux rejoignent un nouveau groupe ; sans aucun
membre de la famille ouvert, elle indique simplement que l’arbre de travail
s’ouvre dans son propre onglet. Dans le groupe, les pastilles se réduisent à la
feuille (`main`, `feature/x`) puisque le groupe dit déjà à quel dépôt elles
appartiennent — une option dans Paramètres → Disposition et terminal garde le nom
complet `racine · branche` si vous préférez. La proposition ne réunit que des
arbres de travail de la même racine — elle ne fusionne jamais des dépôts sans
rapport.

**Reconnaître un onglet d’arbre de travail.** Un arbre de travail lié est un
second checkout d’un dépôt, et son onglet ressemblerait sinon trait pour trait à
celui du dépôt. Un onglet d’arbre de travail affiche donc une **fourche** verte au
lieu de l’icône de dossier — sur un onglet à image, une petite fourche dans le
coin de l’image — et son infobulle indique *Arbre de travail de …* avec le dossier
où il se trouve. Un clic droit propose **Ouvrir …, le dépôt principal**, qui met
au premier plan l’onglet qui a déjà le checkout principal, ou l’ouvre — dans le
groupe de l’arbre de travail quand celui-ci est dans un groupe. Cela fonctionne
quelle que soit la façon dont l’arbre de travail a été ouvert : depuis sa
famille, depuis **Ouvrir un dépôt** ou depuis la liste analysée, et les arbres de
travail d’un sous-module pointent vers le sous-module. Limites : la marque dit où
vit le checkout, pas quelle est sa branche ; les arbres de travail d’un dépôt bare
ne sont pas marqués, faute de checkout principal à ouvrir ; et un dépôt principal
ouvert par un dossier en lien symbolique n’est pas reconnu comme déjà ouvert, si
bien que le menu l’ouvre une seconde fois sous son vrai chemin.

![Un onglet d’arbre de travail avec l’icône de fourche verte à côté de l’onglet du
dépôt principal, son menu ouvert sur Ouvrir submodules-worktrees, le dépôt principal](../../screenshots/worktree-tab.webp)

![Les sections arbres de travail et sous-modules de la barre latérale, toutes deux remplies](../../screenshots/worktrees.webp)

## Sous-modules

Ajoutez, mettez à jour (init et extraction), synchronisez les URL et supprimez
des sous-modules, avec un état en direct pour chacun :

| État | Signifie |
|---|---|
| **Synchronisé** | Extrait au commit que le parent enregistre |
| **Modifié** | Extrait ailleurs, ou sale |
| **Non initialisé** | Enregistré, mais jamais extrait |

![Des sous-modules portant leur état, une ligne chacun](../../screenshots/submodule-states.webp)

**Voir aussi :** [LFS et sparse-checkout](lfs-sparse.md) · [Récupérer, tirer et pousser](syncing.md)
