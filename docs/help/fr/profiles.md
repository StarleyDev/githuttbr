---
title: Profils
category: Personnalisation
order: 101
summary: Des identités et des jetons distincts pour le travail et pour tout le reste.
keywords: profil profils profile profiles identité identity git user email jetons tokens comptes accounts changer switch
---

# Profils

Un profil regroupe une **identité Git** (nom et e-mail) avec ses **jetons
d'intégration**. Changez de profil et les deux changent ensemble — les commits
sont attribués correctement et les appels d'API utilisent le bon compte.

Utile quand la même machine sert aux dépôts professionnels et personnels, ou
quand vous avez deux comptes GitHub.

![Un profil : l'identité git d'un côté, ses jetons d'intégration de l'autre](../../screenshots/settings-profiles.webp)

## Modifier un profil, utiliser un profil

Deux pages des Paramètres changent avec le profil — **Profil et identité** et **Comptes connectés**, en haut du groupe **Vous**, dont l’en-tête nomme le profil qu’elles modifient. Toutes les autres pages valent pour n’importe quel profil et l’indiquent en haut.

**Profil et identité** s’ouvre sur la carte du profil : son image, son nom (modifiable sur place), *utilisé* quand l’app l’utilise, le sélecteur et **Nouveau profil**. **Comptes connectés** s’ouvre sur le même sélecteur dans une barre, *Modification du profil*. Le sélecteur choisit le profil que vous **modifiez** ; il ne change pas celui que l’app **utilise**. Quand ils diffèrent, une bande ambre le dit, avec **Utiliser ce profil** pour basculer. C’est le moment où l’on lie le plus facilement un compte au mauvais profil : Comptes connectés nomme donc aussi le profil sur chaque carte et sur le bouton lui-même, et la confirmation le répète. La suppression d’un profil est au même endroit, et demande d’abord.

Sous la carte viennent l’identité git et la signature des commits. Quand un dépôt ouvert committe sous une autre identité — sa configuration git nomme un autre auteur —, une ligne le signale, avec **Appliquer l’identité au dépôt courant** ; quand les deux concordent, il n’y a rien à appliquer et la ligne n’apparaît pas. Viennent ensuite l’image du profil, un résumé de ses **comptes connectés** — une ligne par hôte avec *Connecté*, *Jeton expiré ou en erreur*, *Injoignable* ou *Non connecté*, et **Connecter** ou **Renouveler**, qui ouvrent Comptes connectés sur cet hôte — et l’IA qu’utilise le profil.

Le résumé vérifie discrètement, sans fenêtre de connexion, à chaque ouverture de la page ou changement de jeton ; il ne sonde jamais en continu. Ce qu’il trouve sert aussi au menu latéral : **Comptes connectés** affiche un petit compteur d’alerte quand un jeton a été refusé ou a échoué, et seulement pour les vérifications déjà faites par les Paramètres. Un hôte injoignable ne compte pas — le jeton peut être bon.

![Modification du profil Travail pendant que l'application en utilise un autre : le bandeau ambre, et le bouton de liaison qui nomme Travail](../../screenshots/settings-profile-band.webp)

## L'IA est partagée

Un profil n'a pas besoin de sa propre IA : une [IA
générale](ai.md#une-ia-pour-tous-les-profils) sert tous les profils, et un
profil n'opte pour la sienne que lorsqu'il le faut. Ce choix couvre tout : un
profil sur l'IA générale écrit aussi comme l'IA générale est réglée — style de
commit, règles supplémentaires pour les commits, discussion du dépôt. Un profil qui a besoin
d'un autre style reçoit sa propre IA, une copie de la générale qu'il peut
ensuite modifier. Tout cela se modifie sur la page **IA** ; la page Profil
indique seulement quelle IA le profil utilise et y renvoie.

## Chaque profil, ses propres comptes

En plus d'un jeton, un profil peut **lier** une connexion déjà présente sur la
machine — du credential helper de git ou de GitHub CLI — dans Paramètres → Comptes connectés. Un lien appartient à un seul profil : un nouveau profil commence
déconnecté, et un compte qu'un autre profil détient déjà est refusé, si bien que
deux profils peuvent tenir deux comptes GitHub (ou Azure DevOps) côte à côte.
Voir [Hébergement](hosting.md).

## Rattachement par dépôt

Un dépôt peut être **rattaché à un profil**, pour qu'une récupération en arrière-
plan s'authentifie toujours avec le bon compte — même pendant que vous regardez
un dépôt qui appartient à l'autre.

Les jetons vivent dans le [trousseau de votre système](security.md), jamais dans
le fichier de paramètres.

**Voir aussi :** [Sécurité et secrets](security.md) · [Hébergement](hosting.md)
