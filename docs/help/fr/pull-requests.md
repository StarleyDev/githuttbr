---
title: Page des pull requests
category: Synchronisation et multi-dépôts
order: 57
summary: Toutes les pull requests d’un dépôt sur une page — par état, filtrées par auteur, relecteur, cible et CI —, ‹ › pour parcourir la liste filtrée depuis une PR, ses commits, ses mises à jour (chaque push, ce qu’il a changé, ce qui est nouveau depuis votre dernière visite), et des commentaires sur une ligne de son diff. La conversation en une seule chronologie, avec ce qui est nouveau depuis votre dernière visite.
keywords: pull requests liste page merge requests pr mr filtre auteur relecteur les miennes en attente de ma relecture relecture demandée ci en échec branche cible brouillons fusionnées fermées recherche tri précédent suivant alt flèche navigation checkout aller à la branche source cible copier le nom de la branche fetch commentaire de ligne commentaire en ligne commentaire de relecture commentaire de diff commenter une ligne onglet fichiers revue de code line comment onglet commits liste des commits commits de la pr historique des commits ouvrir un commit copier le sha récupérer la branche de la pr éditeur markdown barre d’outils aperçu mention commits tab commit list open commit copy sha markdown editor toolbar preview mention arbre des fichiers arborescence vue arbre vue chemin fichiers vus marquer le dossier comme vu modifier supprimer modifié coquille file tree viewed files edit delete edited typo référence titre carte au survol work item AB# numéro d’issue infobulle reference title hover card issue number fork commits de la pr refs/pull head commentaires rendus images pixel espion image bloquée cliquer pour charger tâche tableau bloc rendered comments images blocked image mises à jour itérations pushs force push rebase historique réécrit versions du diff ce qui a changé depuis la dernière visite badge nouveau marquer comme vu comparer mise à jour updates iterations history rewritten diff versions what changed since last visit new badge mark as seen compare update conversation chronologie fils ouverts fil résolu a approuvé a demandé des modifications commits poussés rôle de relecteur nouveau depuis votre dernière visite comparer deux commits pastilles de type de commit ci par commit voir le diff suivant non vu filtrer non vus avec commentaires progression de la relecture modifié depuis la consultation conversation timeline open threads resolved thread approved requested changes pushed commits reviewer role new since last visit compare two commits commit type chips conventional commits ci per commit view diff next unviewed filter unviewed with comments review progress changed since viewed
source: d91d96af92225cb74da274f8d168b07f6110b709
---

# Page des pull requests

Un dépôt actif a vingt pull requests ouvertes en même temps. La barre latérale
les liste, mais une ligne chacune en dit peu : qui a ouvert laquelle, lesquelles
vous attendent, lesquelles sont passées au rouge. Pour le savoir, il fallait les
ouvrir une par une, lire, revenir, ouvrir la suivante. La **page des pull
requests** répond à ces questions sur un seul écran, et une fois une pull
request ouverte, **‹ ›** vous mènent à la suivante de la même liste sans revenir
en arrière.

![La page des pull requests filtrée sur « pix » : les correspondances surlignées, les vôtres marquées « vous », une CI en échec et un brouillon](../../screenshots/pull-requests.webp)

## L’ouvrir

- L’**icône de liste** dans l’en-tête **PULL REQUESTS** de la barre latérale
  (*Voir toutes les pull requests*).
- *Pull requests…* dans la palette de commandes (⌘K), ou **Outils → Pull
  requests…**.

Comme le wiki et les [exécutions CI](ci-runs.md), la page s’ouvre dans l’onglet
du dépôt.

## Onglets

| Onglet | Ce qu’il contient |
|---|---|
| **Ouvertes** | Toutes les pull requests ouvertes, brouillons compris |
| **Brouillons** | Seulement les ouvertes marquées comme brouillon |
| **Fusionnées** | Les pull requests fusionnées, lues à la première ouverture de l’onglet |
| **Fermées** | Fermées sans fusion (refusées, abandonnées), lues avec les fusionnées |

Les compteurs à côté d’Ouvertes et de Brouillons viennent de la liste que la
barre latérale a déjà. Fusionnées et Fermées ne sont demandées que lorsque vous
ouvrez l’un de ces onglets, et une fois par session ; **Actualiser** les
redemande.

## Filtres

| Filtre | Garde |
|---|---|
| **Rechercher** | Les pull requests dont le titre, la description, les branches ou le numéro contiennent chaque mot saisi. `#482` ou `482` trouve ce numéro ; les correspondances sont surlignées dans le titre |
| **Auteur** | Un auteur — chacun avec le nombre qu’il a dans cet onglet. **Moi** est en tête |
| **Relecteur** | Un relecteur demandé, ou **Relecture demandée à moi** |
| **Branche cible** | Les pull requests vers cette branche |
| **Les miennes** | Un raccourci pour *Auteur : Moi* |
| **En attente de ma relecture** | Un raccourci pour *Relecteur : relecture demandée à moi* |
| **CI en échec** | Les pull requests dont les vérifications du head ont échoué |

La ligne sous les filtres indique combien de pull requests de l’onglet sont
affichées et quels filtres sont actifs, avec **effacer les filtres** pour tous
les retirer.

Les filtres sont conservés par dépôt **tant que l’application tourne** — quittez
la page, revenez, ils sont comme vous les avez laissés. Ils ne sont pas gardés
d’un redémarrage à l’autre, exprès : un filtre « les miennes, CI en échec »
revenu en silence une semaine plus tard cacherait des pull requests que vous
n’avez pas demandé à cacher.

### Qui est « moi »

« Moi » est le compte sous lequel les appels de ce dépôt se connectent à
l’hébergeur — le profil auquel le dépôt est [lié](profiles.md), sinon le profil
actif — tel que l’hébergeur lui-même le renvoie. Quand le jeton ne peut pas dire
à qui il appartient (pas de scope utilisateur), ou qu’il n’y a pas de jeton,
**Moi**, **Les miennes** et **En attente de ma relecture** ne sont pas proposés.

## La liste

| Colonne | Ce qu’elle montre |
|---|---|
| **#** | Le numéro, avec une icône pour ouverte, brouillon, fusionnée ou fermée |
| **Titre** | Le titre, un badge *brouillon*, et qui est encore sollicité pour relire — dans la couleur d’accent quand c’est vous |
| **Auteur** | L’image de l’hébergeur quand il en fournit une, sinon l’initiale, et **vous** sur les vôtres |
| **Branches** | Source → cible |
| **Vérifications** | Les vérifications du head résumées — `6/6`, `1 en échec`, `2 en cours` ; survolez pour les comptes |
| **Mise à jour** | Depuis quand elle a changé pour la dernière fois ; survolez pour la date |

Les lignes sont triées par activité la plus récente. Un clic ouvre la page propre
de la pull request ([Hébergement et pull requests](hosting.md)). Sur un
hébergeur sans cette page, la ligne ouvre la pull request dans le navigateur.

Dans un [checkout de fork](hosting.md#vos-pull-requests-sur-le-dépôt-parent-dun-fork), vos pull requests sur le dépôt
parent sont aussi listées, marquées *sur owner/repo*.

## Parcourir la liste depuis une pull request

![Une pull request ouverte depuis la liste filtrée : ‹ 1 sur 4 › et les filtres d’où elle vient](../../screenshots/pull-request-nav.webp)

Une pull request ouverte depuis la page affiche un bandeau au-dessus de son
titre :

- **← Pull requests** revient à la liste, filtres tels que vous les avez
  laissés.
- **‹ k sur n ›** passe à la pull request précédente ou suivante de la liste d’où
  vous l’avez ouverte — la liste filtrée, dans son ordre, telle qu’elle était au
  moment du clic. Les infobulles nomment la pull request vers laquelle mène
  chaque flèche.
- **Alt+← / Alt+→** font la même chose au clavier. On peut les réassigner dans
  **Paramètres → Raccourcis**. Elles s’effacent tant que le curseur est dans un
  champ de texte (où Option+← avance par mot) et tant que le terminal a le
  focus.

Se déplacer remplace la page sur place : parcourir dix pull requests ne laisse
pas dix icônes sur l’onglet ; ouvrir une autre ligne depuis la liste la remplace
aussi.

Une pull request ouverte **depuis ailleurs** — la barre latérale, une
notification — parcourt les pull requests ouvertes du dépôt dans l’ordre par
défaut de la page (Ouvertes, sans filtre). Une qui n’est pas non plus dans cette
liste, comme un niveau fusionné d’une pile, n’affiche que le chemin de retour
vers la liste.

## Aller à la branche d’une pull request

Pour travailler sur une pull request, il vous faut sa branche en checkout — et
dans un dépôt de milliers de branches, la retrouver par son nom dans la liste
des branches est la partie lente. Sur la page d’une pull request, le champ
**Branches** s’en charge :

- **Le nom de la branche est un lien.** Un clic fait le checkout de cette branche
  et vous emmène au graphe du dépôt, sur la pointe de la branche. La page de la
  pull request reste ouverte dans l’onglet.
- **Une branche qui n’existe que sur le serveur** est d’abord récupérée — cette
  branche seule, pas tout le remote — puis extraite en branche locale qui la
  suit. Une branche que vous avez déjà en local est basculée telle quelle — elle
  n’est pas mise à jour, donc faites un pull quand vous voulez les derniers
  commits de la pull request.
- **La branche sur laquelle vous êtes déjà** est marquée *actuelle* à la place.
  Rien n’est extrait.
- **Le bouton copier** à côté de chaque nom le met dans le presse-papiers.
- **Annuler** (⌘Z) vous ramène sur la branche où vous étiez et supprime la
  branche locale créée par le checkout — sauf si vous y avez commité depuis,
  auquel cas elle est laissée telle quelle.

L’en-tête propose les deux mêmes gestes en boutons : **Aller à la branche
source** et **Aller à la branche cible**. Ils fonctionnent aussi sur la branche
où vous êtes déjà — ils vous emmènent simplement au dépôt. Avec les [couleurs des icônes](themes.md#couleurs-des-icônes) activées, chaque bouton de l’en-tête a la sienne : actualiser en bleu, relecture IA en violet, aperçu en turquoise, branche source en vert, branche cible en orange (ouvrir dans le navigateur reste gris).

Rien n’est consulté avant votre clic : ouvrir une pull request ne lit ni ne
récupère aucune branche.

Ce que cela ne fait pas :

- **La branche source d’un fork** vit dans un autre dépôt, elle n’a donc pas de
  lien (le bouton copier reste). **Prévisualiser la pull request en local…**,
  proposé juste en dessous, est le moyen de la lancer ici. La branche cible reste
  un lien.
- **Aucun remote correspondant.** La branche est cherchée sur le remote dont
  l’URL est le dépôt de la pull request. Quand aucun remote configuré n’y pointe,
  le lien ne fait rien et son infobulle dit pourquoi.
- **Une branche supprimée.** Une pull request fusionnée a souvent emporté sa
  branche ; le fetch indique alors que la branche n’existe plus sur le remote, et
  vous restez sur la pull request.
- **Des modifications locales.** Le checkout n’est pas destructif, il n’y a donc
  pas de confirmation — et git refuse le checkout quand vos modifications non
  commitées seraient écrasées. L’erreur indique quels fichiers ; commitez-les ou
  mettez-les en stash et cliquez à nouveau.
- **Cette fenêtre.** Le checkout se fait dans l’arbre de travail de ce dépôt.
  Quand la branche est déjà extraite dans un autre [arbre de
  travail](worktrees.md), c’est l’onglet de cet arbre de travail qui s’ouvre.

## Commits

La barre latérale disait combien de commits compte une pull request, jamais
lesquels. Relire un commit à la fois — la façon dont la plupart des pull requests
sont censées être lues — vous renvoyait au navigateur. L’onglet **Commits**, entre Conversation et Mises à jour, les liste :

- **Une ligne de résumé** en haut : combien de commits, par combien d’auteurs, le
  **+/−** de la pull request, et une pastille colorée par type de
  [Conventional Commit](https://www.conventionalcommits.org/) avec son nombre —
  *feat 2 · fix 1 · test 1* vous dit de quel genre de changement il s’agit avant
  d’en lire une ligne. Les features sont en vert, les fixes et les reverts en
  rouge, les tests dans la couleur d’accent, les performances en jaune, le reste
  en gris.
- **Les plus anciens d’abord**, dans l’ordre où ils s’appliquent, regroupés sous le
  jour où ils ont été écrits. Un commit rebasé hors de l’ordre des dates commence
  un jour à lui plutôt que d’être déplacé.
- Chaque ligne montre l’image de l’auteur (quand l’hébergeur en fournit une),
  l’objet — son type sous la même pastille colorée et sa portée atténuée, quand il
  suit les Conventional Commits —, l’auteur, depuis quand, et, pour un commit que
  ce clone possède, son **+/−** et le nombre de fichiers touchés. Puis un point
  **CI** (vert réussie, rouge en échec, jaune en cours) quand l’hébergeur signale
  une exécution pour ce commit, le SHA court et **Voir le diff**. Un badge
  **merge** marque un commit à deux parents, quand l’hébergeur le dit.
- Un commit qui a plus qu’un objet affiche le reste de son message sous la ligne.
- Au survol, **Copier** met le SHA complet dans le presse-papiers et **Ouvrir dans
  le navigateur** ouvre le commit sur l’hébergeur — dans la pull request quand
  l’hébergeur a une telle page (GitHub, GitLab, Bitbucket Data Center), sinon sur
  la page de commit du dépôt.

![L’onglet Commits : les commits d’une pull request regroupés par jour, l’un avec son message complet ouvert](../../screenshots/pr-commits.webp)

Les commits faits après votre dernier départ de la pull request se trouvent sous
une ligne **Nouveau depuis votre dernière visite** — la même marque que dans
l’onglet Conversation, issue de la même visite.

**Voir le diff** — ou un clic sur la ligne, ou Tab jusqu’à elle puis Entrée —
ouvre le commit dans l’application, comme le ferait un clic dans le graphe : la
vue du dépôt, ce commit sélectionné, ses détails ouverts. Cela marche quand ce
clone **a** le commit. Quand il ne l’a pas, la ligne dit *pas encore dans votre
dépôt* et son bouton change :

- **Récupérer la branche** — le même fetch d’une seule branche que pour
  [aller à la branche](#aller-à-la-branche-dune-pull-request), sans le checkout.
  Chaque commit venu avec peut alors s’ouvrir ; si celui-ci n’est pas venu (un
  force push l’a réécrit depuis), la notification le dit.
- **Récupérer les commits de la pull request**, pour une pull request venant d’un
  **fork**. Sa branche vit dans un autre dépôt, mais la plupart des hébergeurs
  reflètent la tête d’une pull request dans le dépôt cible sous une référence à
  elle — `refs/pull/N/head` (GitHub, GitHub Enterprise Server, Forgejo),
  `refs/merge-requests/N/head` (GitLab), `refs/pull-requests/N/from` (Bitbucket Data
  Center). L’application récupère cette seule référence, sans les tags, dans une
  référence à elle, `refs/githuttbr/pr/<remote>/N`, et le commit s’ouvre comme
  n’importe quel autre : le graphe dessine cette tête comme une voie sans libellé.
  Récupérer à nouveau déplace la référence sur la tête telle qu’elle est alors. Si le
  force push survenu depuis a laissé le commit de côté, la notification le dit.
- **Ouvrir dans le navigateur**, quand récupérer la branche n’est pas possible.

**Comparer deux commits** vous demande de cocher deux lignes, puis ouvre la
[comparaison](merging.md#compare-any-two-refs) entre elles dans la vue du dépôt :
le plus ancien sert de base, vous voyez donc ce qui s’est passé de l’un à l’autre
— les commits intermédiaires et leur diff combiné. Les deux doivent être dans ce
clone ; tant que deux ne le sont pas, le bouton est grisé.

La liste est lue la première fois que vous ouvrez l’onglet, pas avec la page, puis
à chaque **Actualiser**. Tant qu’elle n’est pas là, le compteur de l’onglet est
celui que l’hébergeur a donné pour la pull request. Les pull requests fusionnées
et fermées listent leurs commits de la même façon.

Ce que cela ne fait pas :

- **250 commits au plus.** GitHub lui-même n’en liste pas plus de 250 pour une
  pull request ; l’application s’arrête au même nombre sur tous les hébergeurs, et
  indique *l’hébergeur en a d’autres* quand c’est le cas, avec un lien vers la pull
  request sur l’hébergeur. Lesquels 250 dépend de l’ordre dans lequel l’hébergeur
  les liste — l’application garde les premiers listés, et la ligne au-dessus de la
  liste dit lesquels :

  | Hébergeur | Une pull request plus longue montre |
  |---|---|
  | GitHub | Les **250 premiers** (la limite de GitHub lui-même) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | Les **250 plus récents** |
  | Forgejo | Le bout que le serveur liste en premier ; son ordre n’est pas documenté |
- **La tête d’un fork là où l’hébergeur ne la reflète pas.** Azure DevOps ne publie
  qu’un résultat de fusion, jamais la tête propre d’une pull request, et bitbucket.org
  ne publie ni l’un ni l’autre : là, la ligne ne propose que le navigateur. Sur un
  autre hébergeur qui s’avère ne pas la refléter, le fetch le dit.
  **Prévisualiser la pull request en local…** fait venir le résultat de fusion
  d’Azure, si c’est ce qu’il vous faut.
- **Les têtes récupérées restent.** `refs/githuttbr/pr/…` n’est pas une branche :
  rien à extraire ni à pousser, un fetch avec prune n’y touche pas, et git garde
  leurs commits. Rien ne les retire non plus — ni la fermeture de la page, ni le
  [nettoyage des branches](branch-cleanup.md). Pour vous en débarrasser, supprimez
  les références à la main : `git for-each-ref refs/githuttbr/pr` les liste, et
  `git update-ref -d <ref>` en supprime une.
- **Un distant dont le nom contient un `/`** ne peut pas être une partie du nom de
  cette référence, donc le fetch y est refusé.
- **Une branche supprimée.** Une pull request fusionnée a souvent emporté sa
  branche : le fetch le dit. bitbucket.org ne liste plus aucun commit une fois la
  branche source disparue.
- **Fusions squash.** Les commits d’une pull request fusionnée en squash n’ont
  jamais atteint la branche cible, donc une fois sa branche supprimée ils ne sont
  plus que sur l’hébergeur.
- **Les chiffres par commit viennent de votre clone.** Le **+/−** et le nombre de
  fichiers sont lus dans git, jamais demandés à l’hébergeur : un commit pas encore
  récupéré n’en montre pas, un merge non plus (son changement se mesure par
  rapport à deux parents). Un clone partiel auquel manquent les fichiers d’un
  commit n’en montre pas plutôt que de les télécharger.
- **La CI pour les 40 commits les plus récents seulement**, sans le dire : une
  requête par commit finirait par peser sur une longue pull request, et la CI a
  généralement tourné sur les têtes poussées de toute façon. Pas d’identifiant
  pour l’hébergeur, pas de points — jamais de demande de connexion.
- **Les pastilles de type lisent l’objet.** Une équipe qui n’écrit pas de
  Conventional Commits n’a ni pastilles ni décompte par type — rien n’est deviné.
- **Les auteurs** sont nommés comme leurs commits les nomment. GitLab, Azure DevOps
  et Bitbucket Data Center ne donnent pas d’image sans une connexion qu’une image ne
  peut pas envoyer, donc ces lignes affichent l’initiale.
- **Les messages longs sur Azure DevOps** peuvent être tronqués : la liste d’Azure
  coupe le message d’un commit, et l’application montre ce qu’elle reçoit.
- Les pull requests de **bitbucket.org** s’ouvrent dans le navigateur —
  l’application n’a pas encore de page pour elles —, donc cet onglet n’y est pas
  atteint, même si l’application sait lire la liste.

## Mises à jour

Une pull request relue le lundi a bougé le jeudi. L’onglet Commits montre où elle en
est maintenant, pas ce qui s’est passé depuis : quels commits sont arrivés avec quel
push, si quelqu’un a fait un force push et réécrit ce que vous aviez déjà lu, et à
quoi ressemble le code *par rapport à la version que vous avez vue*. L’onglet
**Mises à jour**, entre Commits et Fichiers, y répond — comme le fait l’onglet
Updates d’Azure DevOps lui-même.

Il liste chaque push dans la pull request, **le plus récent d’abord** :

- **Mise à jour 1 — ouverture** est le push avec lequel la pull request a été
  ouverte ; chaque push suivant prend le numéro suivant.
- Chacune montre **quand**, **qui a poussé** (quand l’hébergeur le dit), et les
  **commits ajoutés** — SHA court, objet, auteur. Quand l’hébergeur signale des
  commits qu’un push a retirés de la branche, ils sont listés sous **Commits
  retirés**, barrés.
- Un force push ou un rebase est marqué **historique réécrit** : des commits que
  vous aviez lus ont pu disparaître, et ceux listés peuvent être de nouvelles copies
  d’un travail ancien. Sur Azure DevOps, un push qui a déplacé la pull request vers
  une autre branche cible est marqué **cible changée**.

![L’onglet Mises à jour : les pushs du plus récent au plus ancien, un force push marqué « historique réécrit », un autre marqué Nouveau](../../screenshots/pr-updates.webp)

### Ce qui a changé dans une mise à jour

**Voir les changements de cette mise à jour** ouvre l’onglet Fichiers sur ce seul
push : le diff entre la tête de la mise à jour précédente et celle-ci — ou, pour la
Mise à jour 1, depuis la branche cible contre laquelle elle a été ouverte, quand
l’hébergeur nomme ce point (Azure DevOps, GitLab). Le même arbre de fichiers et la
même visionneuse, avec un bandeau — *Changements de Mise à jour 3 (par rapport à
Mise à jour 2)* — et **Afficher tous les changements** pour revenir à la pull request
entière.

![L’onglet Fichiers montrant les changements d’une mise à jour, avec le bandeau au-dessus de l’arbre des fichiers](../../screenshots/pr-update-diff.webp)

Le diff est toujours fait **dans ce clone** quand c’est possible : `git diff` entre
les deux têtes, exact et sans demander à l’hébergeur. Quand l’une des têtes manque,
l’application récupère d’abord les deux **par leur id de commit** depuis le distant
de la pull request — aucune branche, aucun tag, aucune référence n’est écrite ; une
tête remplacée par un force push n’est plus sur aucune branche, mais la plupart des
hébergeurs la servent encore par son id — et compare ici. Ce n’est que si ce fetch
échoue que l’hébergeur est sollicité :

| Hébergeur | La comparaison de l’hébergeur |
|---|---|
| Azure DevOps | Les changements de l’itération avec `$compareTo` — entre les deux pushs |
| GitLab | La comparaison du dépôt, directement d’une tête à l’autre |
| Bitbucket Data Center | La comparaison du dépôt — **depuis la base commune** des deux têtes |
| GitHub | L’API de comparaison (`base...head`) — **depuis la base commune** des deux têtes |
| Forgejo / Gitea | Aucune : leur API n’a pas de diff entre deux commits |

Depuis la base commune, le diff d’une réécriture n’est pas ce que le push a fait :
ce qu’il a retiré n’apparaît pas, et des changements reçus depuis par la branche
cible peuvent passer pour ceux de la pull request. Le bandeau le dit — *Comparé
depuis la base commune : ce que ce push a retiré n’apparaît pas.* — quand une mise à
jour à l’historique réécrit a été comparée ainsi. Quand rien ne marche, le bandeau le
dit et propose de récupérer la branche (ou, depuis un fork, la tête de la pull
request) pour comparer ici.

Les commentaires de ligne appartiennent au diff de la pull request entière, donc il
n’y a pas de **+** sur une ligne pendant qu’une seule mise à jour est affichée ; le
bandeau le dit. Cocher un fichier comme vu marche comme d’habitude — cela marque le
fichier dans la pull request.

### Nouveau depuis votre dernière visite

Les mises à jour poussées depuis votre dernière ouverture de l’onglet portent un
badge **Nouveau**, et l’onglet lui-même dit combien : *Mises à jour 5 · 2
nouvelle(s)*. Ouvrir l’onglet les marque comme vues (les badges restent tant que vous
y êtes, pour que vous voyiez lesquelles étaient nouvelles) ; quand **Actualiser** en
apporte d’autres pendant que l’onglet est ouvert, **Marquer comme vu** les efface.
Ouvrir seulement la page de la pull request ne marque rien. La première fois que vous
ouvrez l’onglet Mises à jour d’une pull request, rien n’est nouveau — il n’y a pas de
visite précédente pour comparer.

Les mises à jour sont lues avec la page, pour ce compte, et à nouveau à chaque
**Actualiser** — pas après chaque commentaire ou relecture que vous publiez.

Ce qui a été vu est gardé sur cet ordinateur seulement, par dépôt et par pull
request, jamais envoyé à l’hébergeur.

### Selon l’hébergeur

| Hébergeur | D’où viennent les mises à jour | Auteur du push | Commits retirés | Réécriture détectée |
|---|---|---|---|---|
| Azure DevOps | Les **itérations** de la pull request — l’enregistrement propre à Azure de chaque push | Oui | Non (non signalés) | Oui : `forcePush` / `rebase` |
| GitLab | Les **versions du diff** de la merge request ; les commits de chaque version déduits de sa tête | Non (les versions ne nomment personne) | Oui | Oui : une tête antérieure qui n’est plus atteinte |
| Bitbucket Data Center | L’activité de la pull request : **OPENED** et chaque **RESCOPED** qui a déplacé la branche source | Oui | Oui, avec les totaux de l’hébergeur | Oui : un rescope qui a retiré des commits |
| GitHub | **Déduites** des commits et des force pushs de la chronologie — voir ci-dessous | Force pushs seulement | Non | Oui : un événement de force push |
| Forgejo / Gitea | Les entrées **push** de la chronologie, la première écrite avec la pull request elle-même | Oui | Non | Oui : une entrée de force push |
| bitbucket.org | Non disponible | — | — | — |

**GitHub ne garde aucune trace d’un push ordinaire** — seulement des force pushs —,
donc les mises à jour sont **déduites des heures des commits**. Une mise à jour est
une suite de commits qui s’appuient les uns sur les autres, entre deux force pushs ;
un commit qui ne s’appuie pas sur le précédent, ou qui arrive plus de dix minutes
après lui, commence la suivante. Un commit créé après l’ouverture de la pull request
ne peut pas avoir fait partie de l’ouverture. Ainsi, un push de commits faits à une
heure d’écart apparaît **coupé** en deux, et deux pushs à quelques minutes d’écart
n’en font **qu’un** ; l’onglet dit que le regroupement est approximatif. Les nouveaux
commits d’un rebase, que la chronologie peut lister juste avant son force push,
comptent pour ce force push. Les têtes avant et après un force push sont exactes,
donc son **Voir les changements** l’est aussi.

### Limites

- **Plafonds.** Les 100 mises à jour les plus récentes sont listées. La chronologie
  de GitHub est lue depuis son extrémité la plus récente, jusqu’à 500 éléments ;
  l’activité de Bitbucket Data Center (elle aussi du plus récent au plus ancien)
  jusqu’à 1 000 ; les versions et commits de GitLab jusqu’à 300 chacun ; la
  chronologie de Forgejo jusqu’à 500 entrées, les plus récentes si elle est plus
  longue. Quand un plafond coupe l’**ouverture**, les numéros ne sont plus ceux de
  l’hébergeur : l’onglet le dit et compte à rebours depuis la dernière (*Dernière
  mise à jour*, *Mise à jour, 2 avant la dernière*).
- **Azure DevOps** ne signale aucun commit retiré ; un force push ou un rebase est
  marqué à la place. Une itération dont Azure tronque la liste de commits est lue à
  part (jusqu’à 500 commits), et la mise à jour dit quand elle reste partielle.
- **GitLab** ne nomme pas l’auteur du push. Une version dont la tête a été réécrite
  est lue à part pour trouver ses commits — pour les dix plus récentes de ces
  versions —, une fois par session : les versions ne changent jamais.
- **Forgejo et Gitea** ne listent aucun commit pour un force push — seulement ses
  deux têtes, que compare **Voir les changements** —, et après un force push rien ne
  dit ce que contenait l’ouverture, qui reste donc vide sauf si le serveur a
  enregistré le push de l’ouverture elle-même. Leur API n’a pas de diff entre deux
  commits, donc cette comparaison a besoin des deux commits dans ce clone. Un serveur
  sans l’API de chronologie montre tous les commits dans une seule mise à jour.
- **Récupérer par id** demande un hébergeur qui sert un commit par son id. GitHub le
  fait pour tout commit qu’il détient encore ; un autre hébergeur, ou un simple
  serveur git, peut refuser un commit sur lequel aucune branche ne pointe — la
  comparaison de l’hébergeur est alors utilisée. Les commits récupérés restent dans
  ce clone sans référence, et git les ramasse avec le temps.
- **La comparaison de Bitbucket Data Center** lit le diff structuré du serveur et le
  dessine en diff unifié ; de très gros fichiers peuvent revenir tronqués.
- Une tête réécrite peut avoir **disparu de l’hébergeur** pour de bon (Azure et
  GitLab la gardent ; d’autres peuvent la ramasser). Alors aucun des deux côtés ne
  peut comparer, et le bandeau le dit.
- Les pull requests de **bitbucket.org** s’ouvrent dans le navigateur et n’ont pas
  d’onglet Mises à jour.

## Lire les fichiers

Une pull request de deux cents fichiers est difficile à lire sous forme de deux
cents chemins complets, et difficile à terminer sans perdre le fil. Au-dessus de
la liste et du diff, une ligne tient le compte — *4 fichiers vus sur 9*, avec une
barre — et **Suivant non vu →** ouvre le prochain fichier, plus bas, que vous
n’avez pas coché, en repartant du haut au besoin ; il est grisé une fois que tout
ce qui est listé est vu. **Afficher :** restreint la liste aux fichiers **Non
vus** ou **Avec commentaires** (une conversation de relecture quelconque), et
revient à **Tous**.

La liste de l’onglet **Fichiers** a le même sélecteur
**Chemin / Arbre** que le panneau de commit, et le choix vaut pour toute
l’application. En **Arbre**, les fichiers sont rangés sous leurs dossiers (une
chaîne comme `src/main/ipc` tient sur une ligne), et chaque dossier affiche son
**+/−** cumulé et combien de ses fichiers sont vus (*3/5*). La case d’un dossier
marque comme vus tous les fichiers qu’il contient, ou les décoche tous ; les coches
restent sur cet ordinateur seulement, jamais envoyées à l’hébergeur. Une coche
retient la version du diff du fichier : quand un push modifie un fichier vu, il
redevient non vu, avec une pastille **modifié** (*Modifié depuis que vous l’avez vu*). Un
fichier sans diff (binaire, trop gros) n’est comparé que par son état et ses nombres
de lignes. Un fichier qui a des conversations de relecture affiche un nombre dans une bulle juste après son nom, pour que ceux qui portent des commentaires ressortent dans une longue liste ; les conversations obsolètes comptent aussi, et les résolues de même — les listes des hébergeurs que lit l’app ne disent pas lesquelles sont résolues. Cliquez sur un dossier, ou appuyez sur ←/→ dessus, pour le replier ; ↑/↓
(ou j/k) parcourent les fichiers à l’écran et ouvrent chaque diff. Les dossiers
repliés sont retenus par pull request jusqu’à la fermeture de l’application, et un
fichier ouvert à l’intérieur déplie le chemin jusqu’à lui. L’arbre est trié par nom,
pas dans l’ordre où l’hébergeur liste les fichiers.

![L’onglet Fichiers en vue arbre : des dossiers avec leurs modifications cumulées et leurs comptes de fichiers vus, l’un replié](../../screenshots/pr-files-tree.webp)

**Images.** Une image que la pull request ajoute, retire ou modifie (png, jpg, gif,
webp, bmp, ico, avif, svg) n’a pas de diff texte à lire, donc l’onglet montre l’image
à la place — la même vue que pour un commit : la nouvelle, l’ancienne, ou avant et
après côte à côte et avec un curseur. Une image renommée compare son ancien chemin à la
base avec le nouveau à la tête ; dans le diff d’une seule mise à jour, les deux têtes
de la mise à jour. Les octets viennent de ce clone quand il a les commits, ce qui est
gratuit et rapide, sinon de l’hébergeur avec le profil du dépôt. Limites : une image
de plus de 32 Mo n’est pas prévisualisée ; les commentaires de ligne ne s’appliquent
pas à une image (un SVG garde son diff texte, et ses commentaires, en dessous) ; une
image stockée dans **Git LFS** est lue depuis l’hébergeur, puisqu’un clone n’en a que
le pointeur — GitLab, Azure DevOps et Forgejo le résolvent, tandis que l’API de GitHub
ne donne que le pointeur, donc là l’onglet vous envoie vers l’hébergeur ; quand
l’hébergeur ne nomme pas la base de fusion (il se rabat sur la pointe de la branche
cible), une note dit que l’« avant » peut inclure des changements ultérieurs sur la
cible ; et quand ni le clone ni l’hébergeur ne peuvent fournir les octets, l’onglet le
dit et propose de récupérer la branche de la pull request ou de l’ouvrir sur
l’hébergeur.

![Une image modifiée par la pull request, avant et après côte à côte](../../screenshots/pr-image-diff.webp)

**Les chemins et votre éditeur.** La barre au-dessus du diff a un bouton pour copier le
chemin du fichier et un menu **⋯** ; un clic droit sur un fichier ou un dossier de la
liste ouvre le même menu. Il copie le chemin, l’ancien chemin d’un fichier renommé ou
celui du dossier ; et il ouvre le fichier dans votre [éditeur](editor.md) (ou une
autre application) ou l’affiche dans le gestionnaire de fichiers. Ces deux-là agissent
sur **votre copie de travail**, pas sur la version de la pull request : ils ne sont
actifs que pour un fichier qui y existe (un fichier que la PR supprime, ou que votre
branche n’a pas, dit pourquoi), et quand la branche extraite n’est pas celle de la PR,
le menu dit quelle branche vous ouvririez.

**Revenir.** Quittez une pull request pour le dépôt, un autre onglet ou la PR suivante,
et elle est telle que vous l’avez laissée à votre retour : le même onglet, le même
fichier ouvert, le même défilement, et tout texte non envoyé — le commentaire, une
réponse, un commentaire de ligne, une modification. Cela dure jusqu’à ce que vous
fermiez la pull request ou quittiez l’application ; c’est gardé en mémoire seulement,
pour les 50 pull requests les plus récentes (au-delà, l’endroit le plus ancien est
abandonné, et tout texte qu’il contenait passe à la prochaine page de pull request que
vous ouvrez). Fermer une PR avec du texte non envoyé demande d’abord. Si une
actualisation trouve que la place d’un brouillon a disparu — la conversation à laquelle
il répondait, le commentaire qu’il modifiait, le fichier où il se trouvait —, le texte
n’est pas perdu : il attend en haut de la page d’être copié ou abandonné.

### D’où vient le diff

Une relecture ne vaut que ce que vaut le diff qu’elle lit. L’API d’un hébergeur n’en
est pas une bonne source : Azure DevOps n’envoie aucun diff, seulement la liste des
fichiers, et chacun doit être récupéré deux fois et comparé ; GitHub s’arrête à 3000
fichiers et omet le patch d’un gros fichier ; GitLab marque un gros diff comme *trop
gros* et n’envoie rien. L’onglet Fichiers lit donc **d’abord ce clone**, sur tous les
hébergeurs :

1. Il demande à l’hébergeur les deux commits de la pull request — où elle commence et
   sa tête. Azure DevOps, GitLab et Forgejo nomment la base de fusion ; Bitbucket Data
   Center nomme la base du diff auquel ses commentaires de ligne s’ancrent ; GitHub ne
   nomme que la branche cible, dont la base de fusion avec la tête est alors calculée
   ici (ou, sans les commits, par la comparaison de GitHub). L’aperçu d’images utilise
   les mêmes deux commits.
2. Quand les deux sont ici, `git diff` entre eux donne tous les fichiers, sans plafond
   de nombre. Ce sont les mêmes deux commits que compare la page de l’hébergeur
   lui-même, donc un numéro de ligne ici est le numéro de ligne là-bas et un
   commentaire de ligne arrive là où vous le placez.
3. Quand ils ne sont pas ici, ils sont récupérés **par leurs ids** depuis le distant de
   la pull request — des objets seulement, aucune branche n’est créée ni déplacée —,
   une fois, à l’ouverture de la page (et à nouveau avec Actualiser), avec
   *Récupération des commits de la pull request…* au-dessus de la liste pendant ce
   temps. Un serveur qui ne délivre pas un commit par son id (certains Azure DevOps et
   serveurs git simples) est ignoré en silence.
4. Ce n’est qu’ensuite que l’API de l’hébergeur est utilisée, et un fichier pour lequel
   elle ne donne pas de diff dit pourquoi au lieu de faire comme s’il était vide
   (ci-dessous).

Un fichier lu plus tard — ouvert alors qu’il n’était *pas encore chargé*, ou après
**Réessayer** — rejoint la liste comme les autres : la même visionneuse, et des
commentaires de ligne dessus.

Sur Azure DevOps, la voie de l’API lit les cent premiers fichiers à l’ouverture de
l’onglet, trois à la fois et en une minute au total, et le reste quand vous ouvrez
chacun. Une requête limitée met toutes les lectures en pause jusqu’au délai que demande
le serveur ; une qui échoue quand même le dit, avec la raison. Qu’un fichier soit du
texte se décide d’après ses octets, pas d’après le drapeau *binary* d’Azure — qu’il
pose aussi sur les fichiers UTF-16 et sur certains textes non ASCII. Quand l’hébergeur
liste moins de fichiers que n’en a la pull request (GitHub s’arrête à 3000), une ligne
au-dessus de la liste le dit.

### Quand un fichier n’affiche pas de diff

| Ce qu’il dit | Pourquoi | Ce que vous pouvez faire |
|---|---|---|
| **Binaire** | Ses octets ne sont pas du texte : une image, une archive. L’UTF-16 et l’ancien texte à un octet sont reconnus comme du texte. | L’ouvrir sur l’hébergeur. |
| **Trop gros pour être affiché** | Plus de 20 000 lignes modifiées ou 8 Mo de diff, ou une version de plus de 4 Mo. Son **+/−** est quand même compté quand le clone l’a lu. | L’ouvrir sur l’hébergeur. |
| **Pas encore chargé** | Au-delà de ce que garde une lecture (environ 150 000 lignes de diff), ou, par l’API d’Azure DevOps, au-delà des cent premiers fichiers ou de la minute. | Il se charge quand vous l’ouvrez ; **Charger le diff** sinon. |
| **Chargement impossible** | La lecture a échoué — la raison est affichée en dessous. | **Réessayer**. |
| **L’hébergeur l’a omis** | L’API de l’hébergeur n’a envoyé aucun diff et ce clone n’a pas les commits de la pull request. | **Récupérer la pull request pour la voir en local** — les commits par id, ou la tête de la pull request d’un fork —, puis le diff est fait ici. |
| **Seul le nom ou le mode a changé** | Un renommage ou un changement de droits : le contenu est le même. | Rien à relire dans le contenu. |
| **L’encodage a changé** | Le même texte enregistré autrement : une marque d’ordre des octets ajoutée ou retirée, de l’UTF-16 passé en UTF-8. | Vérifier que le changement est voulu — certains outils y sont sensibles. |

Dans la liste, un fichier dont le diff n’a pas été lu — pas encore chargé, chargement
impossible, omis par l’hébergeur — affiche **—** au lieu de **+0 −0**, qui se lirait
comme « rien n’a changé ». Un fichier binaire et un simple renommage affichent leur
vrai **+0 −0**, et quand l’hébergeur compte quand même les lignes (GitHub le fait, même
pour un patch qu’il omet), les comptes sont affichés.

## Commenter une ligne

On pouvait déjà répondre ici à un fil de relecture, mais pas en ouvrir un, si bien
qu’une vraie relecture vous renvoyait encore au navigateur. Dans l’onglet
**Fichiers** d’une pull request, chaque ligne du diff accepte son propre
commentaire :

- **Survolez une ligne** et appuyez sur le **+** qui apparaît sur son numéro, ou
  **cliquez sur la ligne** elle-même (un clic qui termine une sélection de texte, ou
  un double clic qui sélectionne un mot, ne compte pas — c’est de la lecture). Le
  menu du clic droit — ou la touche menu contextuel du clavier — propose aussi
  *Commenter la ligne N*.
- Une zone s’ouvre **sous cette ligne**. Écrivez, puis **Commenter** — ou
  ⌘/Ctrl+Entrée. **Annuler** la ferme ; **Échap** aussi, en demandant d’abord si
  quelque chose a été saisi. Dans les deux cas, le focus revient sur cette ligne.
- En cas de succès, le nouveau fil apparaît **sous sa ligne**, et dans les fils de
  relecture de l’onglet Conversation, où tout le monde le verra.

![Un commentaire en cours d’écriture sous une ligne modifiée, avec un fil plus ancien sous sa propre ligne](../../screenshots/pr-line-comment.webp)

Le côté où atterrit le commentaire suit la ligne :

| Ligne | Ancré à |
|---|---|
| **Ajoutée** (vert) | La nouvelle version du fichier, à son nouveau numéro |
| **Supprimée** (rouge) | L’ancienne version, à son ancien numéro |
| **Inchangée** | La nouvelle version (GitLab reçoit les deux numéros, comme il l’exige) |

Les fils existants sont eux aussi affichés sous leurs lignes, avec leur zone de
réponse là où l’hébergeur laisse l’application répondre dans un fil (pas Forgejo).
Un fil n’est affiché sur une ligne que si l’hébergeur dit qu’il appartient encore au
diff affiché ; le reste demeure dans l’onglet Conversation, plutôt que sur une ligne
devinée :

| Hébergeur | Un fil écrit avant le dernier push |
|---|---|
| GitHub | Obsolète quand sa ligne a changé : Conversation seulement |
| GitLab | Écrit sur un head plus ancien : Conversation seulement |
| Azure DevOps | Suivi par Azure jusqu’à l’endroit où se trouve sa ligne |
| Bitbucket Data Center | Orphelin quand sa ligne a disparu : Conversation seulement |
| Forgejo | Forgejo n’indique pas qu’un commentaire est obsolète, il est donc affiché au numéro de ligne enregistré — après un push, cette ligne peut contenir un autre code |

Un commentaire sur une ligne hors des hunks affichés n’est que dans l’onglet
Conversation, sur tous les hébergeurs.

Un commentaire saisi et non envoyé reste avec la pull request, comme le texte de la
zone de commentaire principale : **‹ ›**, Alt+flèches ou un autre onglet le laissent où
il est, et il est de retour sur sa ligne quand vous revenez (voir *Revenir* plus haut).
Regarder un autre fichier le conserve ; pour en commencer un sur une autre ligne,
publiez ou annulez le premier.

Ce que cela ne fait pas :

- **Une ligne, publiée aussitôt.** Pas de plage de lignes, pas de relecture en
  attente où regrouper des commentaires pour les soumettre plus tard, pas de
  suggestion de modification. Chaque commentaire est publié dès que vous l’envoyez,
  en fil distinct (sur Forgejo, en relecture contenant ce seul commentaire, car
  Forgejo n’a pas d’appel pour un commentaire isolé).
- **Le diff que vous regardez.** L’onglet Fichiers retient sur quel commit (sur
  Azure DevOps, quelle itération) son diff a été lu, et le commentaire est envoyé
  par rapport à celui-ci. Quand la pull request a bougé depuis — un push, une
  nouvelle base de fusion —, le commentaire n’est pas publié sur la ligne qui porte
  maintenant ce numéro : il est refusé avec *la pull request a changé depuis le
  chargement de ce diff*, et **Actualiser** affiche le nouveau diff. Sur GitHub, le
  commentaire est au contraire publié sur le commit que vous avez lu, et GitHub le
  marque obsolète si la ligne a changé. Une ligne que l’hébergeur refuse encore est
  rejetée comme hors du diff.
- **Refusé.** Sans droit de commenter (un jeton en lecture seule, un compte que le
  dépôt n’autorise pas à commenter), l’hébergeur refuse et le message indique que
  c’est la raison.
- Les pull requests de **bitbucket.org** s’ouvrent dans le navigateur — l’application
  n’a pas encore de page pour elles —, donc un commentaire de ligne s’y fait encore
  sur le site.
- **Un fichier sans diff** (binaire, ou trop gros pour que l’hébergeur l’inclue) n’a
  aucune ligne à commenter.

## La conversation

L’histoire d’une pull request est éparpillée : la description en haut, les
commentaires dans une liste, les fils de ligne dans une autre, les verdicts
seulement dans la barre latérale, les pushs dans un onglet à part. Se remettre à
jour voulait dire tout lire et reconstituer l’ordre de tête. L’onglet
**Conversation** la raconte comme une seule **chronologie**, le long d’un rail,
dans l’ordre où les choses se sont passées.

![La conversation en chronologie : deux pushs, un fil de ligne encore ouvert avec ses lignes, une demande de modifications, la ligne qui marque ce qui est nouveau depuis la dernière visite, et une approbation](../../screenshots/pull-request-page.webp)

| Dans la chronologie | Ce que ça montre |
|---|---|
| **La description** | Toujours en premier, avec qui a ouvert la pull request et quand |
| **Commentaires** | La conversation, chacun avec le rôle de son auteur : **Auteur** ou **Relecteur** |
| **Pushs** | *sam a poussé 2 commits*, puis une ligne par commit ; un clic sur un hash ouvre l’onglet Commits |
| **Fils de ligne** | À leur place, à leur premier commentaire : le fichier et la ligne, les lignes du diff concernées, les réponses et une zone de réponse. Le chemin et **Voir dans Fichiers →** ouvrent ce fichier dans l’onglet Fichiers |
| **Verdicts de relecture** | **a approuvé** en vert, **a demandé des modifications** en rouge avec ce que le relecteur a écrit, ou le commentaire propre d’une relecture |

Un fil que l’hébergeur signale **ouvert** porte une pastille ambre, et la barre
au-dessus de la chronologie les compte : **1 fil ouvert** n’affiche que ceux-là,
ceux qui attendent encore une réponse. Un fil **résolu** se replie sur une ligne —
*Fil résolu dans src/palette.tsx:18 · 2 commentaires* — et un clic le déplie.
**Tout · Commentaires · Relectures · Commits** restreignent la chronologie à un
seul genre.

Les **Relecteurs** de la barre latérale disent le verdict de chacun en toutes
lettres — **✓ a approuvé** ou **a demandé des modifications** — et une horloge
pour qui doit encore répondre.

### Nouveau depuis votre dernière visite

Quand vous quittez la page d’une pull request (une autre page, un autre onglet,
la fermeture), l’app note l’heure. La fois suivante, une ligne marque l’endroit où
vous vous étiez arrêté — **Nouveau depuis votre dernière visite** — et la barre
dit combien d’entrées sont arrivées après. La marque est posée au départ, pas à
l’ouverture, elle reste donc en place pendant que vous lisez. La première fois
que vous ouvrez une pull request, rien n’est marqué comme nouveau.

Les heures s’affichent *il y a 2 j* ; survolez pour la date complète.

*Limites :*

- **Le moment où un commit a été poussé**, les hébergeurs ne le disent pas. Les
  pushs sont reconstitués à partir de la liste des commits : des commits
  consécutifs du même auteur, chacun à moins d’une heure du précédent, comptent
  pour un push, placé à la date du dernier. Un rebase qui a réécrit les dates les
  déplace. L’onglet Mises à jour est le relevé propre de l’hébergeur quand il en
  existe un.
- **Ouvert ou résolu** vient de GitHub (une requête GraphQL de plus par lecture)
  et de GitLab. Les fils d’Azure DevOps, de Bitbucket Data Center et de Forgejo
  n’ont pas de pastille et ne sont pas comptés.
- **Les verdicts dans la chronologie** ont besoin d’une date : GitHub, GitLab
  (une approbation, datée par la note que GitLab écrit pour elle) et Forgejo en
  donnent une. Les votes d’Azure DevOps et les approbations de Bitbucket Data
  Center n’en ont pas, ils n’apparaissent donc que dans la barre latérale.
- Une relecture GitHub sans texte propre — l’enveloppe sous laquelle chaque lot de
  commentaires de ligne est rangé — n’a pas de ligne ; ses fils sont déjà
  affichés.
- Vos dernières visites sont gardées pour les 300 pull requests les plus
  récentes, sur cet ordinateur seulement. Quitter l’app avec une pull request
  ouverte ne compte pas comme la quitter.

## Écrire des commentaires

Chaque zone de la page — le commentaire en bas, une réponse dans un fil, un
commentaire sur une ligne — est le même éditeur Markdown : onglets **Écrire /
Aperçu**, une barre de mise en forme avec les raccourcis de GitHub, des listes qui
continuent avec Entrée, et la complétion **@** / **#** à partir des personnes et
des pull requests déjà à l’écran. La réponse dans un fil fait exception : un champ
d’une ligne sans barre d’outils, où Entrée envoie et Maj+Entrée ajoute une ligne. [Écrire des commentaires](writing-comments.md)
donne le détail et les limites.

## Comment les commentaires sont affichés

Les commentaires s’écrivent en Markdown, donc un commentaire affiché en texte brut est
plein de `**`, `- [ ]` et de blocs de code délimités. La description, la conversation
et les fils de relecture (dans les onglets Conversation et Fichiers) sont dessinés en
Markdown : titres, listes et listes de tâches, tableaux, citations, blocs de code
colorés selon le langage que nomme le bloc, liens et images. La page de l’issue
dessine son texte de la même façon. `#123`, `AB#123`, `!123` et `@user` dans le texte
deviennent toujours des liens, avec la [carte](#de-quoi-parle-un-123-ou-un-ab123) là où ils en avaient une.

![Un commentaire rendu : un tableau, une image d’un autre site retenue derrière son espace réservé, et un bloc de code coloré](../../screenshots/pr-rendered-comment.webp)

D’où vient le rendu :

| Hébergeur | Rendu par |
|---|---|
| GitHub, GitHub Enterprise Server | GitHub lui-même (`body_html`) : mentions et références sont liées comme sur le site, les images passent par le proxy d’images de GitHub, et les pièces jointes privées portent leur adresse signée |
| GitLab, Forgejo, Azure DevOps, Bitbucket Data Center | L’application, à partir du Markdown du commentaire. Un lien relatif pointe dans le dépôt ; sur GitLab, `/uploads/…` pointe dans le projet, comme le fait GitLab |

Un commentaire est le contenu d’autres personnes, donc ce qu’il peut contenir est
restreint, et plus restreint que pour vos propres fichiers : une liste explicite de
balises, des liens et des images en `https:`, `http:` ou `mailto:` seulement, pas de
scripts, de cadres, de formulaires, de SVG ni de style en ligne, et des liens qui ne
s’ouvrent jamais dans l’application (ils vont vers votre navigateur). Une case d’une
liste de tâches est affichée, pas cliquable : la cocher ici ne changerait rien sur
l’hébergeur.

**Les images d’autres sites attendent un clic.** Charger une image est une requête
que le site derrière peut observer, avec votre adresse IP et le moment où vous lisez
le commentaire — quiconque peut commenter peut y placer un pixel espion. Seules les
images de l’hébergeur lui-même se chargent donc d’elles-mêmes : sur github.com ses
pièces jointes, `*.githubusercontent.com` (qui inclut son proxy d’images) et ses
ressources ; sur tout autre hébergeur, sa propre adresse. Toute autre image affiche
*Image de example.net — cliquez pour la charger*, et le clic charge cette image-là.
**Paramètres → Sécurité → Charger les images d’autres sites dans les commentaires**
désactive cela ; voir [Sécurité](security.md#les-images-dans-les-commentaires).

**L’aperçu montre ce qui sera publié.** Sur cette page et celle de l’issue, l’onglet
**Aperçu** de chaque zone de commentaire dessine le texte de la même façon : le même
profil, les mêmes sauts de ligne, les mêmes images retenues — un lien collé vers une
image extérieure ne la charge pas pendant que vous écrivez. Les boîtes de dialogue de
nouvelle pull request et de nouvelle issue gardent l’aperçu Markdown habituel de
l’application.

**Trop long ou trop complexe s’affiche en texte.** Le Markdown est rendu dans la
fenêtre de l’application, et certains textes coûtent bien plus à rendre que leur
taille ne le laisse penser. Un commentaire de plus de **32 000 caractères**, ou conçu
pour bloquer le moteur de rendu (des milliers de `_` ou `*` non appariés dans un
paragraphe, ou plus de 32 niveaux de `>` ou de marqueurs de liste sur une ligne),
s’affiche en texte brut avec ses liens, sous *Commentaire long affiché en texte
brut.* ou *Commentaire affiché en texte brut : trop complexe pour être rendu ici.* Un
commentaire qui échoue quand même au rendu se replie de la même façon, tout seul : le
reste de la page n’est pas touché.

Ce que cela ne fait pas :

- **La modification montre le texte tel qu’écrit.** **Modifier** ouvre toujours le
  Markdown, et une modification enregistrée est dessinée par l’application jusqu’à ce
  que la page relise la pull request (sur GitHub, ensuite par GitHub).
- **Les pièces jointes privées de GitHub expirent.** GitHub signe l’adresse d’une
  image privée pour quelques minutes ; celle qui ne se charge plus après que la page
  est restée ouverte un moment revient avec **Actualiser**.
- **Une image relative sur GitHub** que l’application dessine elle-même (une réponse
  envoyée depuis l’application, avant que la page ne la relise) est cherchée sous
  l’adresse du dépôt sur github.com, ce qui n’est peut-être pas là où GitHub la
  mettrait.
- **Les vidéos** d’un commentaire GitHub s’affichent comme un lien vers le fichier,
  pas comme un lecteur.
- **Les extensions propres à GitHub** que l’application dessine elle-même (sur les
  autres hébergeurs) sont absentes : pas de raccourcis emoji, pas de diagrammes
  Mermaid, pas de style d’alertes, et les formules restent du texte.
- **Le code n’est coloré que si le bloc nomme son langage.** Deviner le langage
  ferait passer chaque grammaire sur chaque bloc de la page.
- **Les messages de commit** de l’onglet Commits restent en texte brut : git ne rend
  pas le Markdown, les hébergeurs non plus.

## Modifier et supprimer vos commentaires

Une coquille dans un commentaire déjà envoyé, ou une remarque qui ne tient plus,
imposait auparavant un détour par le navigateur. Vos propres commentaires portent
désormais **Modifier** (le crayon) et **Supprimer** (la corbeille) au bout de leur
en-tête : commentaires de la conversation, commentaires de fils de relecture et
réponses, dans les onglets Conversation et Fichiers. La page d’une issue les a aussi,
pour ses commentaires sur GitHub et Forgejo.

![Votre propre commentaire, marqué modifié, avec Modifier et Supprimer au bout de son en-tête](../../screenshots/comment-editor.webp)

Ce qui est « à vous » est décidé par la page elle-même, qui demande à l’hébergeur, à
chaque chargement, sous quel compte se connectent les appels de ce dépôt (son profil
lié, pas le profil actif du moment). La plupart des hébergeurs désignent un auteur
par son identifiant, comparé sans tenir compte de la casse. Azure DevOps désigne les auteurs par leur nom affiché, que deux personnes peuvent
partager, donc là il ne compare jamais les noms : un commentaire est à vous quand l’id
de son auteur correspond à l’id du compte, **ou** quand le nom unique de son auteur
(le nom du compte, souvent une adresse e-mail) correspond à celui du compte, sans
tenir compte de la casse. Chacun est propre à une seule personne ; le second couvre un
id d’auteur qui n’est pas celui que la connexion renvoie. Quand aucun des deux ne peut
être comparé, aucun commentaire n’affiche les actions. Quand l’application ne peut pas
savoir qui vous êtes (un jeton sans scope utilisateur, ou l’hébergeur n’a pas
répondu), aucun commentaire ne les affiche non plus ; **Actualiser** redemande.
L’hébergeur garde le dernier mot : un compte qu’il n’autorise pas à modifier un
commentaire est refusé, et le message le dit.

- **Modifier** ouvre le commentaire sur place, dans le même éditeur Markdown, avec
  son texte tel qu’il a été écrit. **Enregistrer** (ou ⌘/Ctrl+Entrée) l’envoie ;
  **Annuler** ou **Échap** le ferme, en demandant d’abord si vous avez changé quelque
  chose. Seules les lignes vides autour du texte sont retirées : le code indenté et
  un saut de ligne final de deux espaces restent tels quels. Le nouveau texte
  s’affiche aussitôt et la page relit la pull request. Sur la page de la pull request, une modification non enregistrée reste avec la pull
  request quand vous avancez avec **‹ ›** ou changez d’onglet, et fermer la pull request
  demande d’abord. La page de l’issue ne garde rien : rien n’y demande avant la fermeture
  de son onglet.
- **Supprimer** demande toujours d’abord, et la question dit ce qui se passe : le
  serveur retire le commentaire pour tout le monde, et c’est irréversible. Il n’y a
  pas d’entrée d’annulation, puisque rien ne peut le faire revenir.

Supprimer le **premier commentaire d’un fil** qui a des réponses (un fil de
relecture, ou un commentaire de conversation auquel d’autres ont répondu) diffère
selon l’hébergeur, et la confirmation dit lequel. Deux de ces cas ne sont pas
documentés par l’hébergeur, et elle le dit :

| Hébergeur | Premier commentaire d’un fil avec réponses |
|---|---|
| GitHub | Les réponses devraient rester ; la documentation de GitHub ne le dit pas. Le fil garde sa zone de réponse : son premier commentaire disparu, la réponse est envoyée au fil lui-même via l’API GraphQL de GitHub, retrouvé grâce à une réponse qui y figure encore. Si cela échoue (un ancien Enterprise Server, un jeton que GraphQL refuse, un fil où GitHub dit que ce compte ne peut pas répondre), le fil propose **Répondre sur GitHub** à la place. Si vous avez une relecture en cours sur GitHub, GitHub peut y ranger la réponse : la notification le dit alors, et personne ne voit la réponse tant que vous n’avez pas soumis cette relecture là-bas |
| GitLab | Seule cette note disparaît ; le fil et ses réponses restent |
| Azure DevOps | Devrait être marqué supprimé et masqué, en gardant le fil et ses réponses ; la documentation d’Azure ne le dit pas |
| Bitbucket Data Center | Refusé : Data Center ne supprime pas un commentaire qui a des réponses. Supprimez d’abord les réponses, ou modifiez-le plutôt |

Certains hébergeurs marquent un commentaire **modifié**. Seul Azure DevOps garde une
date pour le texte seul ; sur GitHub, Bitbucket Data Center et Forgejo, l’application
compare la date de création et la dernière mise à jour du commentaire, si bien que
la marque y est une approximation (tout ce qui touche le commentaire peut la
déclencher). La date de GitLab bouge aussi quand un fil est résolu, elle n’est donc
pas utilisée.

Ce que cela ne fait pas :

- **Les commentaires de relecture de Forgejo** (commentaires sur une ligne) ne
  peuvent pas être modifiés via son API, et seules certaines versions peuvent en
  supprimer un, donc ils n’affichent aucune des deux actions : changez-les sur le
  site. Les commentaires de conversation marchent comme ailleurs.
- **Quelqu’un l’a changé entre-temps.** Bitbucket Data Center vérifie la version du
  commentaire : une modification ou une suppression d’un commentaire changé depuis le
  chargement de la page est refusée, et **Actualiser** affiche la version actuelle.
  Les autres hébergeurs retiennent la dernière écriture.
- **Introuvable** : quand l’hébergeur ne trouve pas le commentaire, le message dit
  qu’il a peut-être été supprimé, ou que ce compte ne peut pas le voir, et la page
  relit la pull request. Une modification ouverte sur un commentaire disparu est
  abandonnée.
- Les pull requests de **bitbucket.org** s’ouvrent dans le navigateur, il n’y a donc
  pas encore de page où modifier leurs commentaires, même si l’application sait faire
  l’appel.
- **La description** de la pull request et les résumés de ses relectures ne sont pas
  des commentaires, et ne se modifient pas ici.

## De quoi parle un `#123` ou un `AB#123`

Un commit qui dit *fixes AB#4821* ou un commentaire qui dit *voir #312* vous donne
un numéro, pas ce dont il s’agissait. Pour le savoir, il fallait l’ouvrir.
Désormais, **pointer une référence** — ou l’atteindre avec Tab — ouvre une petite
carte avec ce que l’hébergeur en dit :

- une icône pour sa nature, et la référence telle qu’elle est écrite ;
- son **titre** ;
- son **état** (ouverte, fermée, fusionnée — sur Azure DevOps, l’état propre du work
  item, comme *Active* ou *Resolved*) ;
- sur Azure DevOps, le **type de work item** (Bug, User Story, Task…).

![La carte d’une référence à un work item dans un commentaire : son type, son titre et son état](../../screenshots/reference-card.webp)

Les cartes se trouvent sur la page de la pull request (description, commentaires,
fils de relecture, et le message complet d’un commit dans l’onglet **Commits**), sur
la page de l’issue, et dans l’objet du panneau de détails du commit. Dans l’onglet
**Commits** sur Azure DevOps, chaque work item de l’objet d’un commit (`AB#123`, ou
`#123`, le même élément là-bas) affiche aussi son titre à côté, en gris. Sur Azure
DevOps, `!123` renvoie vers cette pull request, sans carte.

| Référence | Hébergeur | Lue depuis |
|---|---|---|
| `AB#123`, et `#123` dans un dépôt Azure | Azure DevOps | Les work items, jusqu’à 200 en une requête |
| `#123` | GitHub, GitHub Enterprise Server | Issues et pull requests, jusqu’à 50 en une requête GraphQL ; une requête REST chacune quand GraphQL échoue |
| `#123` / `!123` | GitLab | Issues / merge requests, une requête par nature |
| `#123` | Forgejo | Les issues (pull requests comprises), une requête chacune, deux à la fois |

Un `#123` ne compte que comme mot à part entière : `org/repo#123` (un autre dépôt),
`&#39;`, une couleur comme `#123abc` et le `#issuecomment-…` d’un lien sont laissés
tels quels.

Rien n’est demandé avant qu’une carte s’ouvre. Alors la référence où vous êtes et
les plus proches sur la page qui ne sont pas encore connues partent en un seul
appel, si bien que la carte suivante est en général immédiate. Les réponses sont
gardées en mémoire tant que l’application tourne, jamais sur disque, pendant cinq
minutes ; ensuite elles restent affichées et sont relues au prochain survol. Elles
sont gardées par profil : l’appel se fait sous le profil auquel le dépôt est
[lié](profiles.md), et un autre profil peut voir d’autres éléments.

Ce que cela coûte :

- **GitHub** en lit jusqu’à **50** en une requête, via son API GraphQL — celle où vous
  êtes et ses plus proches voisines. Quand GraphQL échoue pour une autre raison qu’une
  limite de débit (un ancien Enterprise Server, un jeton qu’il refuse), l’application
  se replie sur l’API REST, qui lit une issue par requête : seules les **10**
  premières sont alors demandées, l’une après l’autre comme GitHub le demande aux
  applications ; les autres restent inconnues, et un survol ultérieur les demandera.
- **Forgejo** ne sait pas lire plusieurs issues en une requête, donc chaque carte en
  coûte une : un survol en demande au plus **10**, deux à la fois.
- Sur GitHub et Forgejo, la première réponse qui dit *ralentissez* (un 429, un 403,
  l’erreur de limite propre à GraphQL, une limite secondaire, ou une réponse qui a
  consommé la dernière requête de la limite) arrête le reste — GitHub ne se replie
  alors pas sur REST — et ces références ne sont pas redemandées pendant cinq minutes.
- **Azure DevOps** lit jusqu’à 200 work items en une requête, et GitLab une requête
  par nature, donc là toute la page part d’un coup.

Ce que cela ne fait pas :

- **Bitbucket** n’a pas de carte : l’application n’y lit aucune issue, et le lien
  ouvre le navigateur comme avant.
- **Introuvable, ou pas d’accès.** Une issue supprimée, un work item d’un projet que
  ce compte ne peut pas voir, ou un jeton Azure sans le scope *Work Items (Read)* se
  lisent pareil : la carte le dit, et le lien marche toujours. Un hébergeur qui
  limite le débit, injoignable, ou sans compte dans ce profil a son propre message.
- **`AB#123` hors d’Azure DevOps** — dans un dépôt GitHub relié à Azure Boards —
  n’est pas un lien, il n’a donc pas de carte : l’application ne sait pas à quelle
  organisation il appartient.
- **L’état fusionné sur les anciens GitHub Enterprise Server** qui n’envoient pas la
  date de fusion d’une pull request : elle apparaît fermée.
- Les lignes de commit **du graphe** n’affichent pas de cartes.

## Limites

- **Les pull requests ouvertes sont la liste de la barre latérale.** GitHub,
  GitLab et bitbucket.org lisent les 30 premières ; un dépôt qui en a plus ne
  montre que celles-là, et le compteur d’Ouvertes affiche **30+**. Azure DevOps,
  Bitbucket Data Center et Forgejo les lisent toutes.
- **Fusionnées et fermées sont plafonnées**, et l’onglet affiche **+** quand
  l’hébergeur en a davantage (son site les liste toutes) :

  | Hébergeur | Ce qui est lu |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | Les 100 mises à jour le plus récemment, fusionnées et fermées **ensemble** |
  | GitLab | Les 100 mises à jour le plus récemment de chaque |
  | Bitbucket Data Center | 100 de chaque dans l’ordre *newest* du serveur — son API ne dit pas s’il s’agit de l’ouverture ou de la mise à jour |
  | Azure DevOps | 100 de chaque parmi celles terminées au cours de la **dernière année** ; son API ne précise aucun ordre, donc au-delà de cent, le choix revient au serveur |

  Leurs vérifications ne sont pas lues — la CI d’une pull request terminée ne
  décide plus rien, et cela coûterait une requête par ligne — donc **CI en échec**
  ne s’applique pas à ces onglets (sa puce y est masquée).
- **Pas de compte** : sans jeton qui atteint l’hébergeur, Fusionnées et Fermées
  le disent au lieu d’afficher une liste vide (GitHub peut tout de même lire un
  dépôt public).
- **Vérifications** : GitHub et Bitbucket Data Center les fournissent dans la
  liste. GitLab, Azure DevOps et Forgejo sont interrogés une fois par head à
  l’ouverture de la page, via le même cache que les badges CI du graphe.
  bitbucket.org n’en a pas.
- **Relecteurs** : GitHub, GitLab, Forgejo, Bitbucket Data Center et Azure DevOps
  indiquent qui est encore sollicité (Azure : une personne qui n’a pas voté ; une
  équipe est laissée de côté). La liste de bitbucket.org ne le dit pas, donc le
  filtre Relecteur y est vide.
- **La recherche dans la description** fonctionne là où la liste de l’hébergeur
  fournit la description ; bitbucket.org peut l’omettre, et seuls les titres,
  branches et numéros sont alors cherchés.
- **« Moi » sur bitbucket.org et Azure DevOps** est comparé au nom affiché,
  puisque c’est ainsi que leurs listes nomment un auteur.
- **Mise à jour sur Azure DevOps** correspond à l’ouverture (ou la fermeture) de
  la pull request : sa liste n’a pas d’heure de dernière activité.
- Le parcours est mémorisé tant que l’application tourne ; après un redémarrage,
  une pull request ouverte depuis la liste parcourt plutôt les pull requests
  ouvertes.
- **Lire les fichiers peut lancer un fetch — une fois.** Quand les commits de la pull
  request ne sont pas dans ce clone, la page les récupère par id depuis son distant à
  l’ouverture, et à nouveau avec **Actualiser** — jamais après un commentaire, une
  relecture ou une fusion, et au plus une fois par version de la pull request et par
  session (une tentative échouée attend Actualiser). Il n’écrit que des objets : aucune
  branche, et pas `FETCH_HEAD`, donc le « récupéré il y a … » de la barre d’outils ne
  bouge pas. Il abandonne après 20 secondes, ou quand le transfert rampe sous 1 Ko/s
  pendant 15, et ne demande jamais de mot de passe : l’invite de git est coupée et Git
  Credential Manager reçoit la consigne de ne pas ouvrir sa fenêtre de connexion, donc
  un distant qui en a besoin se rabat sur l’API. Un distant ssh utilise vos propres
  réglages ssh tels qu’ils sont, sauf que la fenêtre de phrase secrète de ssh lui-même
  n’est pas ouverte. Quand une autre opération git tient le dépôt (un long push) plus
  de cinq secondes, le fetch est sauté cette fois-là et l’API est utilisée. Les
  modifications que vous faites dans l’arbre de travail pendant qu’il tourne ne sont
  pas perdues : le dépôt se rafraîchit une fois qu’il a fini. Un clone superficiel ou
  partiel auquel il manque les objets se rabat sur l’API de l’hébergeur.
- **Au-delà des plafonds**, un fichier est listé avec ses comptes et sans diff : 20 000
  lignes modifiées ou 8 Mo de diff lus depuis le clone, 4 Mo par version lue depuis
  Azure DevOps. Une lecture garde environ 150 000 lignes ou 48 Mo de diffs ; les
  fichiers suivants sont **pas encore chargés** et sont lus à l’ouverture.
- **Les fichiers UTF-16** que git dit binaires sont relus comme du texte, jusqu’à 50
  par pull request et 2 Mo par version ; au-delà, ils apparaissent comme binaires.
- **Les renommages** sont détectés comme `git diff -M` les détecte (50 % de similarité
  par défaut), ce qui peut différer un peu de l’appariement de l’hébergeur lui-même.
- **Azure DevOps par l’API** lit ses cent premiers fichiers en une minute au total ;
  les fichiers restants quand la minute est écoulée sont **pas encore chargés**. Une
  réponse limitée met toutes les lectures en pause jusqu’au Retry-After du serveur. Une
  pull request de plus de 20 000 changements est listée jusque-là, et l’onglet le dit.
