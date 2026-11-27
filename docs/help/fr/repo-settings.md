---
title: Paramètres par dépôt
category: Outils de l'espace de travail
order: 94
summary: Le nom affiché, le profil, les branches protégées et l’image d’onglet d’un dépôt, plus ses règles, son coffre et son activité.
keywords: paramètres du dépôt réglages du dépôt repo settings branches protégées protected branches analytics journal des opérations operation log historique history info roue dentée gear image de l’onglet tab image icône logo nom affiché alias profil retirer de la liste oublier statistiques configuration du projet
source: 6cd23a3db24f4869df7d1b881fb15155bd0a0a8b
---

# Paramètres par dépôt

La roue dentée à côté des outils de la barre d'outils ouvre les paramètres qui
appartiennent à **ce** dépôt, pas à l'application.

![Les paramètres par dépôt](../../screenshots/repo-settings.webp)

L’en-tête dit quel dépôt vous vous apprêtez à modifier : son nom, son dossier,
la branche courante, le distant principal (`origin` s’il existe) avec l’hôte
où il vit, et quelques compteurs. Le nombre de branches vient de la liste déjà
chargée. Celui du coffre n’apparaît qu’après avoir ouvert **Coffre-fort**, car lire
le coffre interroge le trousseau du système, ce que l’ouverture des paramètres
ne devrait pas faire. Il n’y a pas de nombre de commits : compter un long
historique est un appel git à part entière, et un en-tête n’en vaut pas la peine.

Les pages sont dans une navigation latérale, en trois groupes :

| Groupe | Page | Ce qu’elle contient |
|---|---|---|
| Dépôt | **Général** | Nom affiché, profil, branches protégées, l’image de l’onglet et Retirer de la liste |
| Dépôt | **Configuration du projet** | Les [règles que ce dépôt embarque](repo-config.md) dans `.githuttbr.json`, et le doctor qui les vérifie |
| Dépôt | **Informations** | Notes et champs libres sur ce dépôt, conservés localement |
| Sécurité | **Coffre-fort** | Les entrées du [coffre](vault.md) de ce dépôt |
| Activité | **Statistiques** | Ce que vous avez fait dans GitHuttBr, compté localement |
| Activité | **Analyse** | Le [tableau de bord de l’historique](insights.md) |
| Activité | **Historique des opérations** | Les commits dans le temps et leurs auteurs, pour les dépôts que vous avez ouverts |
| Activité | **Journaux** | Le journal des opérations : chaque commande git lancée ici par GitHuttBr, avec son résultat |

Le journal des opérations est celui qui est honnête : quand quelque chose se
comporte bizarrement, il montre la commande exacte et l'erreur exacte, pour qu'un
rapport de bug puisse porter des faits plutôt que des adjectifs.

## Général

Chaque réglage est une ligne : ce qu’il fait à gauche, le contrôle à droite.
Rien n’est enregistré avant d’appuyer sur **Enregistrer**.

| Ligne | Ce qu’elle fait | Où c’est stocké |
|---|---|---|
| **Nom affiché** | Le nom sur les onglets et les listes. Le dossier sur le disque n’est jamais renommé ; vide, le nom du dossier est utilisé | Paramètres de GitHuttBr, sur cette machine |
| **Profil** | L’identité, les jetons et l’IA que ce dépôt active quand son onglet est actif. **Auto** suit le profil actif | Paramètres de GitHuttBr, sur cette machine |
| **Branches protégées** | Avertit avant de committer ou de forcer un push directement sur ces branches | La config git du dépôt |
| **Image de l’onglet** | Une petite image sur l’onglet, ci-dessous | Paramètres de GitHuttBr, sur cette machine |

Quand le dépôt contient un `.githuttbr.json`, un bandeau en haut de Général le
signale et mène à **Configuration du projet**. Ces règles suivent le dépôt chez
tous ceux qui le clonent ; les lignes sous le bandeau ne concernent que vous.

**Retirer de la liste…** retire le dépôt de [Dépôts](repositories.md). Il
demande d’abord, et la question dit ce qu’il ne fait pas : le dossier sur le
disque n’est pas touché, et un onglet ouvert reste ouvert. Rouvrir le dépôt le
remet dans la liste.

## Image de l’onglet

Avec dix onglets ouverts, des noms qui commencent pareil — `api`,
`api-gateway`, `api-docs` — se distinguent mal. Une petite image sur l’onglet
se repère plus vite qu’un texte.

Dans **Général**, cliquez dans le champ de l’image. Il liste les images du dépôt
lui-même — PNG, JPEG, GIF, WebP, SVG, ICO, BMP et AVIF —, chacune avec sa
miniature, en commençant par les fichiers nommés comme un logo ou une icône.
Tapez pour filtrer (`logo dark` trouve `assets/logo-dark.png`), déplacez-vous
avec les flèches et validez avec Entrée ; ou saisissez un chemin à la main. Le
chemin est enregistré **relativement à la racine du dépôt** : l’image suit le
dépôt, où que se trouve son dossier.

Ce que montre l’onglet est un choix global, dans **Paramètres → Général → Les
onglets de dépôt affichent** :

| Option | L’onglet affiche |
|---|---|
| **Image et nom** (par défaut) | L’image à la place de l’icône de dossier, puis le nom |
| **Nom seul** | L’icône de dossier et le nom, comme sans image |
| **Image seule** | Seulement l’image ; le nom passe dans l’infobulle |

Les limites à connaître :

- La liste contient les fichiers que git voit — suivis et non suivis, pas les
  ignorés — et 40 au plus à la fois ; tapez pour atteindre les autres. Une image
  ignorée peut toujours être saisie à la main.
- Les images de plus de 1 Mo, ou illisibles, apparaissent grisées et ne peuvent
  pas être choisies : une icône de 20 pixels n’a pas besoin de plus.
- Un dépôt **sans** image affiche toujours son nom, quelle que soit l’option :
  un onglet vide serait impossible à identifier.
- Si le chemin est **cassé** — fichier supprimé, renommé, qui n’est pas une
  image ou trop lourd —, l’onglet revient discrètement au nom, et cet onglet de
  paramètres affiche un avertissement sous le chemin. Rien d’autre ne se plaint.
- L’image est lue une fois par session. Si vous remplacez le fichier sous le
  même nom, rouvrez cet onglet de paramètres pour la recharger.
- Le réglage vit dans les paramètres de GitHuttBr sur cette machine, pas dans le
  dépôt : vos coéquipiers n’en héritent pas.

**Voir aussi :** [Sécurité et secrets](security.md) · [Analyses](insights.md)
