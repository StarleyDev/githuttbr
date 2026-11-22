---
title: Hébergement et pull requests
category: Synchronisation et multi-dépôts
order: 56
summary: Créer des pull requests partout ; les relire et les fusionner sur GitHub et GitLab.
keywords: pull request PR merge request GitHub GitLab Bitbucket Azure DevOps revue review approuver approve fusionner merge tickets issues
source: 1594d32b11147253f612a4748708d01ba57d465a
---

# Hébergement et pull requests

## Créer

Créez une pull request (ou merge request) sans quitter l'application : listes
déroulantes de branches, titre et corps préremplis depuis les commits de la
branche, une bascule brouillon, et — sur GitHub — relecteurs, étiquettes et
assignés appliqués à la création.

![Création d'une pull request](../../screenshots/create-pr.webp)

Fonctionne sur **GitHub, GitLab, Bitbucket et Azure DevOps**. Les PR/MR ouvertes
des quatre sont listées dans la barre latérale.

Démarrez-en une depuis la comparaison de branches, depuis le graphe, depuis le
`+` du panneau PR, ou depuis un ticket (ce qui remplit `Closes #N`).

## Les piles dans la liste

Les pull requests posées les unes sur les autres se replient en une seule ligne
avec une icône de pile, la branche sur laquelle la chaîne atterrit et leur
nombre. Dépliez-la pour voir la chaîne dans l’ordre de lecture — de la feuille
vers la base — avec une petite flèche sous chacune nommant ce dans quoi elle
fusionne : le sens est à l’écran, pas à déduire de quatre branches de base.

Deux choses forment ce groupe : le numéro de pile de GitHub, quand les PR
appartiennent à une [pile native](stacks.md), et sinon les refs elles-mêmes —
une pull request dont la base est la tête d’une autre repose sur elle. Cette
seconde règle est ce qui fait que cela marche aussi sur GitLab, Bitbucket et
Azure DevOps, et pour des chaînes ouvertes avant tout cela.

![Une pile dans la liste des pull requests](../../screenshots/pr-stack-list.webp)

Chaque ligne porte l’état des **vérifications** de sa tête — survolez pour les
comptes — et, sur GitHub, les niveaux déjà fermés ou fusionnés, qu’une liste de
PR ouvertes masquerait. Un niveau au-dessus d’un niveau **fermé** est marqué
bloqué : ses vérifications peuvent être vertes, mais la branche qu’il vise
n’atterrira jamais. Les actions de la ligne apparaissent au survol, pour que le
titre garde la largeur.

Lire les vérifications coûte une requête par pull request, et seulement au
rafraîchissement de la liste.

## Vos pull requests sur le dépôt parent d’un fork

Dans un fork, les pull requests qui comptent sont souvent celles que vous avez
ouvertes sur le dépôt d’origine, et elles vivent là-bas, pas sur votre fork.
Ainsi, quand un dépôt a un remote `upstream` pointant vers un autre dépôt GitHub
qu’`origin`, la liste demande aussi à `upstream` ses pull requests ouvertes et ne
garde **que celles dont la branche vient de votre fork**. Elles apparaissent sous
celles de votre fork, sous un intitulé nommant le parent, **Sur owner/repo**. Un
clic ouvre la même vue détaillée, avec ses checks et sa revue, sur le parent.

![La pull request propre au fork, puis ses pull requests sur le parent sous On example/pr-ready-branch](../../screenshots/fork-upstream-prs.webp)

*Limites :* GitHub seulement, et seulement un remote nommé `upstream`. Les autres
pull requests du parent sont volontairement exclues : c’est sa file d’attente,
pas votre travail. Les piles et les recherches de branches n’agissent toujours
que sur la liste d’`origin`. Interroger le parent coûte une requête de plus par
actualisation.

## Relire — GitHub et GitLab

![Page de la pull request avec la conversation et la barre latérale des relecteurs](../../screenshots/pull-request-page.webp)

Un clic sur une pull request l’ouvre comme **une page à part entière**. Elle
s’attache à son dépôt comme le wiki : une icône avec le numéro de la PR sur
l’onglet du dépôt, ou sur sa puce dans un groupe. Cliquez de nouveau sur l’icône,
ou sur le nom du dépôt, pour revenir. **Ouvrir dans un nouvel onglet**, dans le
menu contextuel de la PR, lui donne plutôt son propre onglet. Si le dépôt n’est
ouvert nulle part, la PR s’ouvre dans un onglet à elle.

Le travail se fait dans la colonne principale, et la barre latérale dit ce
qu’*est* la PR, sans avoir à défiler. Avec l’IA activée, le bouton ✨ de l’en-tête
relit le diff de la PR tel que l’hôte le rapporte : cela marche même pour une
branche jamais récupérée (un fork, celle de quelqu’un d’autre).

La colonne principale a trois sections :

| Section | Contenu |
|---|---|
| **Conversation** | La description, les commentaires et les fils de relecture en ligne (`fichier:ligne`, avec réponses). Puis la zone de commentaire avec commenter / approuver / demander des changements, et la zone de merge (merge, squash ou rebase) |
| **Fichiers** | Chaque fichier modifié, et le diff du fichier choisi à côté de la liste, avec coloration syntaxique et changements au niveau du mot (fichiers d’allure secrète masqués si ce réglage est actif). Une liste ✓ « vu » retient votre avancée. Un fichier dont l’hôte n’envoie pas de diff (binaire, ou trop gros) renvoie vers l’hôte |
| **Checks** | Check-runs CI (GitHub) ou jobs de pipeline (GitLab), avec réussi/échoué/en cours et des liens vers les journaux |

La barre latérale montre :

| Ligne | Montre |
|---|---|
| **Auteur** | Qui l’a ouverte, et quand |
| **Statut** | Ouverte, brouillon, fusionnée (par qui, quand) ou fermée ; conflits avec la cible |
| **Relecteurs** | La dernière décision de chaque relecteur (approuvé, changements demandés, commenté) et qui doit encore relire, équipes comprises |
| **Assignés, étiquettes, jalon** | Tels que définis sur l’hôte, les étiquettes dans leurs couleurs |
| **Branches** | Source → cible, et le fork d’où elle vient |
| **Changements** | Fichiers modifiés, commits, lignes ajoutées et supprimées, avec une barre |
| **Checks** | Réussis / en échec / en cours, à un clic de la section Checks |
| **Participants** | Tous ceux qui y ont pris part |
| **Activité** | Quand elle a été ouverte et mise à jour pour la dernière fois |

GitLab ne donne pas les totaux de lignes d’une merge request ; ils sont
additionnés depuis la liste des fichiers une fois chargée. Une ligne que l’hôte ne
donne pas est omise.

Si quelqu’un force-push en pleine relecture, [ce qui a changé depuis](range-diff.md)
vous montre exactement ce qui a bougé.

Différences GitLab, dites franchement : GitLab n’a pas d’appel unique « soumettre
la relecture », donc **approuver** utilise son endpoint d’approbation et
**demander des changements** retire votre approbation et publie votre
commentaire. Le **rebase-merge** n’est pas proposé — GitLab choisit entre commit
de merge et fast-forward selon les réglages du projet, donc le menu de merge ne
montre que merge et squash. Les fils en ligne montrent le fichier et la ligne,
mais pas le morceau de diff autour, que l’API de GitLab ne renvoie pas. Relecture
et merge marchent sur gitlab.com et sur un [GitLab auto-hébergé](#gitlab-auto-hébergé).
Bitbucket s’ouvre toujours dans le navigateur pour la relecture.

Différences Azure DevOps : approuver donne votre vote (*Approved*) ; **demander
des changements** vote *Waiting for author*. Terminer la PR accepte merge, squash
ou rebase. Azure liste les fichiers modifiés d’une PR mais n’envoie pas de diff,
donc l’app récupère les deux versions de chaque fichier et calcule le diff
elle-même — pour les 200 premiers fichiers ; un fichier binaire, ou un changement
trop gros, renvoie vers l’hôte. Les personnes apparaissent en initiales, car les
photos de profil d’Azure exigent un navigateur connecté.

La barre latérale liste aussi les **work items liés à la PR** — numéro, titre,
type et état —, chacun s’ouvrant dans le navigateur. Les lire demande un jeton
capable de lire les work items (*Work Items: Read*) ; sans lui, la ligne est
simplement omise.

Les **checks** incluent la **validation de build** de la branche — le pipeline
qu’exige sa stratégie, qu’Azure enregistre comme résultat de stratégie et non
comme statut — à côté de tout statut publié par un pipeline ou une CI externe.
Un check qui est un build Azure Pipelines de cette organisation affiche son
journal sous la ligne : les tâches en échec, chacune sous son nom, ou le journal
complet de chaque job quand rien n’a échoué, en partant de la fin. Le jeton ne
va qu’aux builds de l’organisation de la PR. Le panneau lit au plus trois
journaux, qui se partagent un budget de 512 Ko de fin. Lire les journaux demande
*Build: Read* ; sans lui, la ligne propose plutôt le navigateur. Un jeton à qui
il manque une portée est simplement refusé — l’app ne le prend jamais pour une
connexion révoquée et n’abandonne jamais l’identifiant qu’utilise git.

## GitLab auto-hébergé

Un GitLab d’entreprise a sa propre adresse. Indiquez-la à un profil dans
**Réglages → Intégrations → GitLab → Adresse GitLab**, par exemple
`git.example.org`, ou `https://example.net/gitlab` s’il est servi sous un chemin.
Dès lors, les remotes de cet hôte sont GitLab : les merge requests se listent,
s’ouvrent, se relisent et se fusionnent, le navigateur de clonage et *Créer un
dépôt* s’adressent à lui, et push et fetch s’authentifient avec le jeton de ce
profil.

**Un jeton GitLab appartient à une seule instance.** Le jeton d’un profil n’est
envoyé qu’à l’adresse que ce profil indique. Une adresse vide signifie
gitlab.com. Un jeton gitlab.com n’atteint jamais le serveur de l’entreprise, et un
jeton d’entreprise n’atteint jamais gitlab.com. Si les comptes professionnel et
personnel sont sur des instances différentes, donnez à chacun son profil. Un
dépôt lié à un profil utilise l’instance de ce profil.

**Créer un jeton** ouvre la page des jetons de votre instance avec `api` et
`write_repository` présélectionnés. Un jeton en lecture seule se connecte sans
souci, puis échoue au premier push.

Limites :

- **https uniquement.** Une adresse `http://` est refusée, car le jeton
  traverserait le réseau en clair.
- **Une instance GitLab par profil.** Ajoutez un second profil pour une seconde
  instance.
- En ssh, c’est l’hôte qui est comparé, pas le chemin : deux instances sur un
  même hôte sous des chemins différents ne se distinguent pas pour un remote ssh.
- Les avatars de remotes ne s’affichent que pour gitlab.com et github.com. Un
  remote auto-hébergé reçoit l’icône simple, pour que les noms de ses groupes ne
  partent jamais vers un hôte public.

## Forgejo

Définissez l’adresse de l’instance avant de saisir son jeton. Changer l’adresse efface la connexion précédente.

![Réglages de l’intégration Forgejo](../../screenshots/forgejo-integration.webp)

Forgejo — et Gitea, qui partage son API — tourne toujours à une adresse choisie
par son propriétaire : votre propre serveur, ou un serveur public comme
codeberg.org. Indiquez cette adresse à un profil dans **Réglages → Intégrations →
Forgejo**, avec un jeton d’accès. **Créer un jeton** ouvre la page des jetons de ce
serveur. Donnez au jeton les droits de lecture et d’écriture sur *repository*, *issue* et
*notification*, et de lecture sur *user* et *organization*. Les droits d’un jeton
ne se modifient pas ensuite : un jeton créé sans *issue* ou *notification* ne
liste ni issues ni notifications, et la solution est d’en créer un nouveau.

Dès lors, les remotes de ce serveur sont Forgejo :

| Fonctionne | Comment |
|------------|---------|
| Push et fetch | Authentifiés avec le jeton du profil |
| Pull requests ouvertes | Listées dans la barre latérale, et ouvertes dans la [page de la pull request](#relire--github-et-gitlab) : conversation, diff de chaque fichier, checks (statuts de commit, Forgejo Actions compris), commenter, approuver, demander des changements, et merge / squash / rebase |
| Créer une pull request | Depuis l’app ; un brouillon reçoit le préfixe `WIP:` qu’utilise Forgejo |
| Navigateur de clonage, créer un dépôt | Sur ce serveur, sous votre compte ou une organisation |

Un check qui est un job **Forgejo Actions** affiche son journal sous la ligne,
couleurs comprises, en partant de la fin, là où se trouve l’échec. Forgejo n’a pas
d’API pour les journaux de job : l’app demande la même page que télécharge la
visionneuse web, et n’envoie le jeton que si le lien est un job de ce serveur
même ; un statut venant d’une CI externe ne le reçoit jamais. Un serveur qui ne
sert les journaux qu’à un navigateur connecté répond par sa page de connexion, et
la ligne le dit et propose le navigateur. Les très longs journaux montrent leurs
quelques milliers de dernières lignes.

![Le journal d’un job Forgejo Actions ouvert sous sa ligne de check](../../screenshots/pr-check-log.webp)

Comme pour GitLab, **un jeton Forgejo ne va qu’au serveur qui l’a émis**. Un
profil sans adresse Forgejo n’a aucune identité Forgejo. Il n’y a pas de serveur
par défaut de repli.

Limites :

- Les fils de commentaires de ligne sont affichés, mais on ne peut pas y répondre
  depuis l’app : Forgejo n’a pas d’API pour répondre dans un fil existant.
  Répondez sur le serveur.
- https uniquement, un serveur Forgejo par profil.
- Les listes s’arrêtent après vingt requêtes : 1 000 pull requests ou dépôts avec la taille de page par défaut du serveur.

## Issues, jalons, releases — GitHub et Forgejo

Parcourez les tickets et ouvrez un onglet de ticket complet : corps,
commentaires, étiquettes, assignés, jalon, champs Projects v2, fermeture et
réouverture, et **créer une branche pour ce ticket** (avec nommage par l'IA). Les
jalons affichent leur progression et leurs tickets. Les releases se parcourent
avec une page de changelog.

**Pull requests liées** répond à « quelqu’un est-il déjà en train de corriger
ça ? » : les PR qui fermeront le ticket, ou qui l’ont fermé — un mot-clé du type
`Closes #N` ou un lien manuel dans la zone *Development* de GitHub —, ouvertes
d’abord, puis fusionnées, puis fermées. Une PR qui se contente de *mentionner* le
ticket est volontairement exclue, tout comme ce qui dépasse les 50 premières.
Une PR de ce dépôt s’ouvre dans un onglet de PR ; une d’un autre dépôt, dans le
navigateur. Un jeton qui ne peut pas lire les pull requests du dépôt (un jeton à
granularité fine sans *Pull requests: read*) obtient un discret « chargement
impossible » plutôt qu’un « aucune » erroné.

Sur un serveur [Forgejo](#forgejo), les mêmes listes et pages fonctionnent, avec
le jeton Forgejo du profil. Deux choses n’existent que sur GitHub : les champs de
Projects v2 restent vides, et la section des pull requests liées n’est pas
affichée. Les
releases listent les plus récentes, pas tout l’historique.

## En attente de votre revue

Dans la liste des pull requests de la barre latérale, un 👁 marque celles où
**vous** êtes relecteur sans avoir encore répondu — sur GitHub, GitLab et Forgejo.
Qui est « vous » est demandé à l’hôte avec l’identité du profil et mémorisé dix
minutes. Un jeton qui ne peut pas lire son propre utilisateur (sans `read:user`
sur Forgejo, par exemple) ne marque rien.

![Pull requests en attente de votre revue, marquées d’un œil](../../screenshots/pr-awaiting-review.webp)

Avec **Réglages → Notifications système** activé, une pull request GitLab ou
Forgejo qui *commence* à vous attendre en déclenche une ; un clic ouvre la page de
la PR. Le premier regard sur un dépôt note seulement ce qui attend déjà : ouvrir
l’app ne rejoue donc pas l’arriéré. Les demandes de relecture GitHub sont
laissées à sa boîte de notifications, plus bas, qui les annonce déjà.

## Notifications — GitHub et Forgejo

Toute votre boîte de réception — demandes de revue, mentions, activité de CI —
tous dépôts confondus, avec des filtres non lues/toutes et le marquage comme lu.
La cloche de la barre d'outils porte un badge de non-lues, et des notifications
système optionnelles se déclenchent quand une revue est demandée ou quand la CI
se termine.

Si le profil actif a un serveur Forgejo, ses notifications rejoignent la même
liste, des plus récentes aux plus anciennes, et sont marquées comme lues sur ce
serveur. Forgejo ne dit pas *pourquoi* vous avez été notifié : ces lignes n’ont
donc pas de motif et ne déclenchent jamais de notification système — c’est le
motif qui en décide.

## Jetons

Des jetons par profil pour plusieurs comptes ou organisations, stockés dans le
trousseau de votre système. Gitcito peut aussi emprunter ce que votre
**assistant d'identifiants git** détient déjà : une organisation pour laquelle
vous vous êtes déjà authentifié ne demande souvent aucune configuration. Voir
[Sécurité et secrets](security.md).

Chaque profil **lie son propre compte**. Dans Réglages → Intégrations, **Se
connecter avec git** cherche une connexion déjà présente sur la machine — le
credential helper de git, puis le compte actif de **GitHub CLI**, puis la fenêtre
de connexion du helper — et lie ce compte au profil. Rien n'est partagé
implicitement : un nouveau profil commence déconnecté, et un compte déjà lié à
un autre profil est refusé. Pour lier un second compte GitHub, ajoutez-le à gh
(`gh auth login`), rendez-le actif (`gh auth switch`) et connectez-vous depuis
l'autre profil — ou collez le jeton de ce compte. Git ne demande jamais
d'identifiant ni de mot de passe dans un terminal.

La page indique si la connexion est le jeton du profil, son lien avec le helper
de git ou son lien avec GitHub CLI, et **Déconnecter** l'annule pour ce profil
seulement : un jeton est effacé (il reste valide chez l'hébergeur jusqu'à ce que
vous le révoquiez), un lien est retiré (la connexion reste dans gh ou le helper).

L'API de l'hébergeur — pull requests, issues, CI — et les fetch, pull et push
de git en https utilisent tous le jeton ou le compte lié du profil.
L'identifiant n'arrive à git que pour cette commande, limité à l'hôte du dépôt
distant, et n'est jamais écrit dans `.git/config`. Un profil sans l'un ni
l'autre laisse git à son propre credential helper. Azure DevOps, GitLab et
Bitbucket se lient via le credential helper de git — Git Credential Manager
garde plusieurs comptes par hébergeur — ou prennent un jeton par profil. Un lien
désigne un compte par hébergeur : des organisations qui demandent des comptes
différents prennent chacune un profil.

**Voir aussi :** [Branches empilées](stacks.md) · [Fonctions IA](ai.md)
