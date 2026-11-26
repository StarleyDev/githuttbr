---
title: Page des pull requests
category: Synchronisation et multi-dépôts
order: 57
summary: Toutes les pull requests d’un dépôt sur une page — par état, filtrées par auteur, relecteur, cible et CI —, ‹ › pour parcourir la liste filtrée depuis une PR, ses commits, et des commentaires sur une ligne de son diff.
keywords: pull requests liste page merge requests pr mr filtre auteur relecteur les miennes en attente de ma relecture relecture demandée ci en échec branche cible brouillons fusionnées fermées recherche tri précédent suivant alt flèche navigation checkout aller à la branche source cible copier le nom de la branche fetch commentaire de ligne commentaire en ligne commentaire de relecture commentaire de diff commenter une ligne onglet fichiers revue de code line comment onglet commits liste des commits commits de la pr historique des commits ouvrir un commit copier le sha récupérer la branche de la pr éditeur markdown barre d’outils aperçu mention commits tab commit list open commit copy sha markdown editor toolbar preview mention arbre des fichiers arborescence vue arbre vue chemin fichiers vus marquer le dossier comme vu modifier supprimer modifié coquille file tree viewed files edit delete edited typo référence titre carte au survol work item AB# numéro d’issue infobulle reference title hover card issue number
source: 729c0829d4ded79d157edea6c162fa638d7b41e0
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
sont censées être lues — vous renvoyait au navigateur. L’onglet **Commits**, entre
Conversation et Fichiers, les liste :

- **Les plus anciens d’abord**, dans l’ordre où ils s’appliquent, regroupés sous le
  jour où ils ont été écrits. Un commit rebasé hors de l’ordre des dates commence
  un jour à lui plutôt que d’être déplacé.
- Chaque ligne montre l’image de l’auteur (quand l’hébergeur en fournit une),
  l’objet, l’auteur, depuis quand, et le SHA court. Un badge **merge** marque un
  commit à deux parents, quand l’hébergeur le dit.
- **▸** à côté d’un commit qui a plus qu’un objet affiche le reste de son message.
- **Copier** met le SHA complet dans le presse-papiers ; **Ouvrir dans le
  navigateur** ouvre le commit sur l’hébergeur — dans la pull request quand
  l’hébergeur a une telle page (GitHub, GitLab, Bitbucket Data Center), sinon sur
  la page de commit du dépôt.

![L’onglet Commits : les commits d’une pull request regroupés par jour, l’un avec son message complet ouvert](../../screenshots/pr-commits.webp)

**Cliquez sur une ligne** — ou atteignez-la avec Tab et appuyez sur Entrée — pour
ouvrir le commit dans l’application, comme le ferait un clic dans le graphe : la
vue du dépôt, ce commit sélectionné, ses détails ouverts. Cela marche quand ce
clone **a** le commit. Quand il ne l’a pas, la ligne le dit au lieu d’échouer en
silence, et propose :

- **Récupérer la branche de la PR pour le voir** — le même fetch d’une seule
  branche que pour [aller à la branche](#aller-à-la-branche-dune-pull-request), sans le checkout. Si le
  commit est venu avec, il s’ouvre ; sinon (un force push l’a réécrit depuis), la
  notification le dit.
- **Ouvrir dans le navigateur**, quand récupérer la branche n’est pas possible.

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
- **La branche d’un fork** ne peut pas être récupérée d’ici — elle vit dans un autre
  dépôt —, donc un commit présent seulement dans le fork ne propose que le
  navigateur. **Prévisualiser la pull request en local…** est le moyen de le faire
  venir.
- **Une branche supprimée.** Une pull request fusionnée a souvent emporté sa
  branche : le fetch le dit. bitbucket.org ne liste plus aucun commit une fois la
  branche source disparue.
- **Fusions squash.** Les commits d’une pull request fusionnée en squash n’ont
  jamais atteint la branche cible, donc une fois sa branche supprimée ils ne sont
  plus que sur l’hébergeur.
- **Les auteurs** sont nommés comme leurs commits les nomment. GitLab, Azure DevOps
  et Bitbucket Data Center ne donnent pas d’image sans une connexion qu’une image ne
  peut pas envoyer, donc ces lignes affichent l’initiale.
- **Les messages longs sur Azure DevOps** peuvent être tronqués : la liste d’Azure
  coupe le message d’un commit, et l’application montre ce qu’elle reçoit.
- Les pull requests de **bitbucket.org** s’ouvrent dans le navigateur —
  l’application n’a pas encore de page pour elles —, donc cet onglet n’y est pas
  atteint, même si l’application sait lire la liste.

## Lire les fichiers

Une pull request de deux cents fichiers est difficile à lire sous forme de deux
cents chemins complets. La liste de l’onglet **Fichiers** a le même sélecteur
**Chemin / Arbre** que le panneau de commit, et le choix vaut pour toute
l’application. En **Arbre**, les fichiers sont rangés sous leurs dossiers (une
chaîne comme `src/main/ipc` tient sur une ligne), et chaque dossier affiche son
**+/−** cumulé et combien de ses fichiers sont vus (*3/5*). La case d’un dossier
marque comme vus tous les fichiers qu’il contient, ou les décoche tous ; les coches
restent sur cet ordinateur seulement, jamais envoyées à l’hébergeur. Une coche
retient la version du diff du fichier : quand un push modifie un fichier vu, il
redevient non vu, avec un point jaune (*Modifié depuis que vous l’avez vu*). Un
fichier sans diff (binaire, trop gros) n’est comparé que par son état et ses nombres
de lignes. Un fichier qui a des conversations de relecture affiche à côté un nombre dans une bulle (les dossiers additionnent les leurs), pour que ceux qui portent des commentaires ressortent dans une longue liste ; les conversations obsolètes comptent aussi. Cliquez sur un dossier, ou appuyez sur ←/→ dessus, pour le replier ; ↑/↓
(ou j/k) parcourent les fichiers à l’écran et ouvrent chaque diff. Les dossiers
repliés sont retenus par pull request jusqu’à la fermeture de l’application, et un
fichier ouvert à l’intérieur déplie le chemin jusqu’à lui. L’arbre est trié par nom,
pas dans l’ordre où l’hébergeur liste les fichiers.

![L’onglet Fichiers en vue arbre : des dossiers avec leurs modifications cumulées et leurs comptes de fichiers vus, l’un replié](../../screenshots/pr-files-tree.webp)

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

Un commentaire saisi et non envoyé compte comme du texte non envoyé : **‹ ›** et
Alt+flèches demandent avant de le quitter, comme pour la zone de commentaire
principale. Regarder un autre fichier le conserve ; pour en commencer un sur une
autre ligne, publiez ou annulez le premier.

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

## Écrire des commentaires

Chaque zone de la page — le commentaire en bas, une réponse dans un fil, un
commentaire sur une ligne — est le même éditeur Markdown : onglets **Écrire /
Aperçu**, une barre de mise en forme avec les raccourcis de GitHub, des listes qui
continuent avec Entrée, et la complétion **@** / **#** à partir des personnes et
des pull requests déjà à l’écran. Une zone de réponse montre ses outils dès que
vous cliquez dedans, et envoie avec ⌘/Ctrl+Entrée, puisque Entrée commence
désormais une nouvelle ligne. [Écrire des commentaires](writing-comments.md)
donne le détail et les limites.

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
par son identifiant, comparé sans tenir compte de la casse. Azure DevOps désigne les
auteurs par leur nom affiché, que deux personnes peuvent partager, donc là l’id de
l’auteur du commentaire doit correspondre à l’id du compte ; quand l’un des deux
manque, aucun commentaire n’affiche les actions. Quand l’application ne peut pas
savoir qui vous êtes (un jeton sans scope utilisateur, ou l’hébergeur n’a pas
répondu), aucun commentaire ne les affiche non plus ; **Actualiser** redemande.
L’hébergeur garde le dernier mot : un compte qu’il n’autorise pas à modifier un
commentaire est refusé, et le message le dit.

- **Modifier** ouvre le commentaire sur place, dans le même éditeur Markdown, avec
  son texte tel qu’il a été écrit. **Enregistrer** (ou ⌘/Ctrl+Entrée) l’envoie ;
  **Annuler** ou **Échap** le ferme, en demandant d’abord si vous avez changé quelque
  chose. Seules les lignes vides autour du texte sont retirées : le code indenté et
  un saut de ligne final de deux espaces restent tels quels. Le nouveau texte
  s’affiche aussitôt et la page relit la pull request. Sur la page de la pull
  request, une modification non enregistrée compte comme du texte non envoyé :
  **‹ ›** demandent avant de la quitter. La page de l’issue n’a pas ces flèches, et
  rien n’y demande avant la fermeture de son onglet.
- **Supprimer** demande toujours d’abord, et la question dit ce qui se passe : le
  serveur retire le commentaire pour tout le monde, et c’est irréversible. Il n’y a
  pas d’entrée d’annulation, puisque rien ne peut le faire revenir.

Supprimer le **premier commentaire d’un fil** qui a des réponses (un fil de
relecture, ou un commentaire de conversation auquel d’autres ont répondu) diffère
selon l’hébergeur, et la confirmation dit lequel. Deux de ces cas ne sont pas
documentés par l’hébergeur, et elle le dit :

| Hébergeur | Premier commentaire d’un fil avec réponses |
|---|---|
| GitHub | Les réponses devraient rester ; la documentation de GitHub ne le dit pas. Répondre à ce fil depuis l’application n’est plus possible : ses réponses pointent vers un commentaire disparu, et l’API n’accepte pas de réponse à une réponse. Le fil propose alors **Répondre sur GitHub** |
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
| `#123` | GitHub, GitHub Enterprise Server | Les issues (qui répondent aussi pour les pull requests), une requête chacune, une à la fois |
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

- **GitHub et Forgejo** ne savent pas lire plusieurs issues en une requête, donc
  chaque carte en coûte une. Un survol en demande au plus **10** — celle où vous êtes
  et ses voisines — et sur GitHub l’une après l’autre, comme GitHub le demande aux
  applications. La première réponse qui dit *ralentissez* (un 429, ou un 403) arrête
  le reste, et ces références ne sont pas redemandées pendant cinq minutes.
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
