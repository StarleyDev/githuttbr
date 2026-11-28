---
title: Exécutions CI
category: Synchronisation et multi-dépôts
order: 59
summary: Suivez GitHub Actions, les pipelines GitLab, Azure Pipelines et Forgejo Actions depuis l’application — chaque job, ses étapes et son log, avec relancer et annuler.
keywords: exécutions ci ci runs actions workflow pipeline build github actions gitlab pipelines azure pipelines forgejo actions jobs étapes steps logs relancer rerun re-run annuler cancel dispatch workflow_dispatch badge statut status graphe graph
---

# Exécutions CI

Vous avez poussé, et maintenant vous attendez : passer au navigateur, retrouver
le dépôt, ouvrir Actions, trouver votre exécution, ouvrir le job passé au rouge,
descendre jusqu’à la fin du log. **Exécutions CI** met cette boucle à côté du
code. Une page vous dit comment chaque workflow s’est comporté ces derniers
temps, liste les exécutions du remote de la plus récente à la plus ancienne, et
ouvre une exécution en échec directement sur le test qui a cassé — avec le
fichier et la ligne, à un clic de votre éditeur. Les boutons pour la relancer ou
l’arrêter sont sur la carte.

Elle parle à l’API de l’hébergeur lui-même, avec le jeton que vous avez déjà
donné à GitHuttBr. Rien ne tourne sur votre machine — pour cela, voir
[CI locale](local-ci.md).

![La page Exécutions CI : une carte par workflow avec ses dernières exécutions, les filtres En échec et En cours, la progression d’une exécution en cours, et une exécution en échec ouverte sur le test qui a cassé et sur ses jobs](../../screenshots/ci-runs.webp)

## L’ouvrir

**Outils → Exécutions CI…**, ou *Exécutions CI* dans la palette de commandes
(⌘K). La page s’ouvre dans l’onglet du dépôt, comme le wiki et les insights, et
lit le remote nommé `origin` — ou le premier remote, quand il n’y a pas
d’`origin`.

## Ce que montre la page

| Partie | Ce que c’est |
|---|---|
| **Cartes de workflow** | Une carte par workflow : ce qui le déclenche, son taux de réussite sur ses 10 dernières exécutions terminées (vert à partir de 90 %, ambre à partir de 70 %, rouge en dessous), ces exécutions en carrés colorés — la plus ancienne à gauche, pour que la plus récente soit à côté de « maintenant » —, son temps moyen, et soit son job le plus lent, soit l’issue de sa dernière exécution. Cliquez sur une carte pour ne lister que les exécutions de ce workflow ; cliquez à nouveau pour les afficher toutes |
| **Toutes les branches / Branche actuelle** | Toutes les exécutions du remote, ou seulement la branche que vous avez extraite |
| **En échec / En cours** | Des filtres rapides avec le nombre d’exécutions que chacun garderait. Ils comptent ce que laissent les autres filtres, donc le nombre est ce qu’un clic affiche |
| **Filtre** | Restreint les exécutions chargées par titre, workflow, branche, auteur, commit ou événement |
| **Une carte d’exécution** | Le titre du commit (ou le nom du workflow), puis la branche, le workflow et le numéro d’exécution, ce qui l’a lancée (push, pull request, planification, manuel…), qui l’a lancée et le commit — cliquez sur le commit pour le copier. Quand l’exécution appartient à une pull request, **PR #n** ouvre la page de cette pull request. À droite : où elle en est, combien de temps elle a pris et il y a combien de temps |
| **Une exécution en cours** | *En cours · étape 3 sur 5*, une barre de progression et le temps écoulé. L’étape est celle du job en cours ; sur un hébergeur sans étapes (GitLab, Forgejo), elle compte les jobs à la place |
| **Le test en échec** | Une exécution en échec s’ouvre d’elle-même, la plus récente d’abord, avec le test que nomme son log : le job, le test, la première ligne de l’erreur et **chemin:ligne** — cliquez dessus, ou sur *Ouvrir dans l’éditeur*, pour arriver sur cette ligne. La même lecture que l’[onglet Checks](hosting.md#onglet-checks) d’une pull request |
| **Jobs** | En dessous, chaque job avec son état et sa durée, groupés par stage là où l’hébergeur a des stages (GitLab, Azure). *Voir les étapes et le log* ouvre les étapes d’un job et la fin de son log — sur un job en échec il est toujours là, sur les autres il apparaît quand vous pointez le job |
| **Étapes** | Chaque étape d’un job, avec son état et sa durée — GitHub, Azure et Forgejo les rapportent ; GitLab n’a pas d’étapes |
| **Log** | La fin du log d’un job terminé, couleurs conservées. Seuls les 512 derniers Ko sont récupérés — là où se trouve l’échec — et la page indique quand le début a été laissé de côté |

Tant que quelque chose sur la page est en file ou en cours, la liste interroge à
nouveau l’hébergeur toutes les 15 secondes, et avec elle les jobs de l’exécution
ouverte et de chaque exécution en cours — c’est de là que vient le numéro
d’étape ; les durées avancent chaque seconde. Quand deux minutes de réponses
n’apportent rien de nouveau — une exécution qui attend l’approbation d’un
déploiement, par exemple —, elle ralentit à une fois par minute, et réaccélère
dès que quelque chose bouge. Une liste où tout est terminé ne demande rien tant
que vous n’appuyez pas sur actualiser, et rien n’est demandé tant que la fenêtre
est masquée.

Une exécution que l’hébergeur envoie sans titre — tout pipeline GitLab, un build
Azure planifié — est nommée d’après le sujet de son commit quand le commit est
dans le graphe, lu depuis votre dépôt local sans aucun coût ; sinon d’après son
numéro.

## Relancer, annuler, démarrer

| Bouton | Apparaît quand | Ce qui se passe |
|---|---|---|
| **Relancer les échecs** | L’exécution a échoué ou a été annulée | Seuls les jobs qui n’ont pas réussi sont relancés |
| **Relancer** (↻) | L’exécution est terminée, sur GitHub — sur la carte quand vous la pointez | Tous les jobs sont relancés |
| **Ouvrir dans le navigateur** | En pointant une carte | L’exécution sur le site de l’hébergeur |
| **Annuler** | L’exécution est en file ou en cours | Demande d’abord : les jobs en cours sont interrompus et leur travail est perdu |
| **Lancer un workflow** | L’hébergeur permet d’en démarrer un à la main | Choisissez le workflow et une branche ; il démarre comme si cette branche avait été poussée, et apparaît dans la liste quelques secondes plus tard |

Ce que permet chaque hébergeur :

| Hébergeur | Liste et jobs | Étapes | Log | Tout relancer | Relancer les échecs | Annuler | Démarrer à la main |
|---|---|---|---|---|---|---|---|
| **GitHub** (et Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — le workflow a besoin d’un déclencheur `workflow_dispatch` |
| **GitLab** (et auto-hébergé) | ✓ — pipelines, jobs par stage | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — exécute `.gitlab-ci.yml` sur la branche |
| **Azure DevOps** | ✓ — builds, jobs par stage | ✓ (tâches) | ✓ | — | ✓ | ✓ | ✓ — n’importe quelle définition de build du dépôt |
| **Forgejo / Gitea** | ✓ sur les serveurs dotés de l’API des exécutions Actions | ✓ | ✓ quand le serveur le sert à un jeton | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Badges dans le graphe

La même CI apparaît sous forme d’un petit badge à côté de chaque commit dans le
graphe : vert, rouge, ou une horloge pendant qu’elle tourne. Survolez-le pour
les jobs ; cliquez pour la page de l’hébergeur. Les badges viennent de :

| Hébergeur | Source |
|---|---|
| GitHub | Les check runs du commit — toute CI qui rapporte à GitHub, pas seulement Actions |
| GitLab | Les statuts du commit, qui incluent chaque job du pipeline. Un job manuel (un déploiement, par exemple) ne laisse pas le badge bloqué sur l’horloge |
| Azure DevOps | Les 100 builds les plus récents du dépôt, associés par commit |
| Forgejo / Gitea | Le statut combiné du commit — Forgejo Actions et toute CI externe |
| Bitbucket Data Center | Les statuts de build du commit |

Chaque réponse est mémorisée — y compris « pas de CI ici » — et un commit n’est
réinterrogé que lorsque sa réponse a pu changer : toutes les 45 secondes pendant
qu’il tourne, toutes les 10 minutes une fois terminé, et de moins en moins
souvent pour un commit qui n’a jamais eu de CI. Cela garde un graphe chargé dans
le quota horaire de l’hébergeur.

## Limites

- **Les cartes ne connaissent que les exécutions que la page a listées.** Ce sont
  les 50 dernières exécutions du filtre de branche en vigueur — un workflow qui
  tourne rarement peut afficher moins de dix carrés, et passer à la branche
  actuelle recalcule chaque carte. Le job le plus lent apparaît dès que la page a
  lu les jobs d’une exécution terminée (l’exécution en échec qu’elle ouvre
  suffit) ; jusque-là, la carte dit comment s’est terminée la dernière exécution.
- **Le test en échec est lu dans le texte du log.** Vitest, Jest et pytest sont
  reconnus ; tout autre runner, une erreur de build ou un log tronqué n’affiche
  que la liste des jobs. Un chemin que le runner a écrit hors du checkout ne
  peut pas être ouvert.
- **PR #n dépend de ce que dit l’hébergeur.** GitHub n’indique la pull request
  que pour les exécutions du même dépôt, pas d’un fork ; GitLab l’indique pour
  les pipelines de merge request et Azure pour les builds de PR. Les exécutions
  Forgejo ne portent pas de lien.
- **Le log, c’est la fin, et seulement une fois le job terminé.** GitHub et
  Forgejo donnent le log d’un job une fois qu’il est fini ; tant qu’il tourne,
  la page montre ses étapes avancer, pas sa sortie. GitLab et Azure servent le
  log d’un job en cours jusque-là — rouvrez-le pour en lire davantage.
- **Le jeton doit avoir accès à la CI.** Un jeton GitHub à granularité fine a
  besoin de *Actions: read* pour lister et de *Actions: write* pour relancer,
  annuler ou démarrer ; un jeton classique a besoin de `repo`. Un jeton GitLab a
  besoin de `read_api` pour lister et de `api` pour les boutons. Un jeton Azure a
  besoin de *Build: read* (et de *Build: read & execute* pour les boutons) ; sans
  lui, la page et les badges restent vides au lieu d’échouer.
- **Les badges Azure ne remontent qu’à 100 builds.** Un commit plus ancien n’a
  pas de badge, même si la page Exécutions CI liste encore son build.
- **La relance d’Azure est « réessayer les échecs ».** Elle fonctionne sur les
  pipelines YAML avec stages ; un pipeline classique peut la refuser, et la page
  affiche la réponse de l’hébergeur.
- **Démarrer un workflow ne demande pas ses entrées.** Un workflow GitHub ou un
  pipeline GitLab avec des entrées obligatoires sans valeur par défaut est refusé
  par l’hébergeur, avec son propre message.
- **Forgejo est en lecture seule, et seulement sur les serveurs récents.** Les
  serveurs Forgejo et Gitea plus anciens n’ont pas d’API pour lister les
  exécutions ; la page dit que l’hébergeur n’est pas pris en charge, et les badges
  du graphe fonctionnent toujours grâce aux statuts de commit. Un dépôt que le
  jeton ne peut pas voir apparaît comme une erreur d’accès, pas comme « non pris
  en charge ».
- **Bitbucket n’a pas de page d’exécutions.** Sur Data Center, la CI est un
  système extérieur (Jenkins, Bamboo…) qui ne rapporte qu’un statut — ce statut
  est le badge du graphe. Les Pipelines de bitbucket.org ne sont pas pris en
  charge.
- **Un seul remote.** La page lit `origin` ; les exécutions sur l’autre remote
  d’un fork ne sont pas listées.

**Voir aussi :** [CI locale](local-ci.md) · [Hébergement et pull requests](hosting.md)
