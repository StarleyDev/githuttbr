---
title: Écrire des commentaires
category: Synchronisation et multi-dépôts
order: 57.5
summary: L’éditeur Markdown derrière chaque zone de commentaire — Écrire / Aperçu, une barre de mise en forme avec les raccourcis de GitHub, des listes qui continuent avec Entrée, et la complétion des @mentions / #références.
keywords: éditeur markdown zone de commentaire barre d’outils gras italique code lien citation titre liste à puces numérotée liste de tâches checklist aperçu écrire raccourci mention arobase référence dièse numéro d’issue autocomplétion réponse description de la pull request corps de l’issue markdown editor comment box toolbar mention reference autocomplete reply
source: cc7673de22ce745f04a0341c4d263219c432b693
---

# Écrire des commentaires

Un commentaire envoyé à GitHub est du Markdown, et une simple zone de texte vous
laisse taper chaque `**` et `- [ ]` à la main, puis découvrir dans le navigateur
si le tableau s’est bien affiché. Chaque zone de l’application qui écrit sur un
hébergeur est désormais le même éditeur, avec les outils de la zone de commentaire
de GitHub lui-même :

- la zone de commentaire d’une pull request, ses réponses dans les fils et ses
  commentaires de ligne ([Page des pull requests](pull-requests.md)) ;
- la zone de commentaire d’une issue ;
- la description d’une nouvelle pull request et le corps d’une nouvelle issue
  ([Hébergement et pull requests](hosting.md)).

![La zone de commentaire d’une pull request, avec la barre de mise en forme et la liste des personnes à mentionner ouverte sur « @al »](../../screenshots/comment-editor.webp)

## Écrire et Aperçu

**Aperçu** montre le texte tel qu’il sera rendu, dessiné par le même moteur de
rendu Markdown que le reste de l’application. Il est en lecture seule ; **Écrire**
ramène le champ avec le texte et le curseur là où vous les aviez laissés, donc
⌘/Ctrl+Z annule toujours ce que vous avez tapé avant de regarder.

Les onglets forment une liste d’onglets : quand l’un a le focus, ← et → passent de
l’un à l’autre.

## La barre d’outils

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Titre** | — | Un menu H1, H2 et H3 pour les lignes sélectionnées ; choisir le niveau qu’une ligne a déjà le retire |
| **Gras** | ⌘/Ctrl+B | `**texte**` |
| **Italique** | ⌘/Ctrl+I | `_texte_` |
| **Code** | ⌘/Ctrl+E | `` `code` `` dans une ligne ; un bloc délimité par ```` ``` ```` quand la sélection couvre plusieurs lignes |
| **Lien** | ⌘/Ctrl+K | `[texte](url)` — une URL sélectionnée devient l’adresse, un autre texte le libellé |
| **Citation** | — | `> ` sur chaque ligne sélectionnée |
| **Liste à puces** | ⌘/Ctrl+Shift+8 | `- ` sur chaque ligne sélectionnée |
| **Liste numérotée** | ⌘/Ctrl+Shift+7 | `1. `, `2. `… sur chaque ligne sélectionnée |
| **Liste de tâches** | — | `- [ ] ` sur chaque ligne sélectionnée |

Chaque outil est une bascule : appliqué à un texte qui l’a déjà, il le retire. Sans
sélection, gras, italique, code et lien insèrent un texte de remplacement et le
sélectionnent, prêt à être remplacé. Un outil de liste remplace une liste d’un
autre type au lieu de s’empiler dessus.

Les modifications passent par l’édition propre du champ de texte, donc
**⌘/Ctrl+Z annule un outil** exactement comme un mot tapé, et rétablir le remet.

La barre est un seul arrêt pour Tab ; ← → passent d’un bouton à l’autre, et ↓
ouvre le menu des titres. Dans une zone de commentaire, ⌘/Ctrl+K crée un lien au
lieu d’ouvrir la palette de commandes. Sur Mac, les raccourcis n’utilisent que ⌘,
donc Ctrl+B, Ctrl+E et Ctrl+K continuent de faire ce que les champs de texte de
macOS en font. Avec une disposition de clavier dont les lettres ne sont pas
latines, les raccourcis suivent les touches physiques B, I, E et K.

## Listes

**Entrée** à la fin d’un élément de liste commence le suivant — la même puce, le
numéro suivant, un `- [ ]` vide pour une tâche — avec le même retrait. Entrée sur
un élément sans rien après son marqueur termine la liste et retire le marqueur.
Maj+Entrée est un simple saut de ligne.

## Mentions et références

Taper **@** ouvre une courte liste de personnes, affinée à mesure que vous tapez ;
**#** liste les pull requests et les issues par numéro et titre (`#42`, ou
`#recherche` pour un mot du titre). ↑ ↓ choisissent, Entrée ou Tab insère, Échap
ferme la liste — seulement la liste, pas la zone ni la boîte de dialogue autour.

La liste vient de ce que l’application a déjà, sans redemander à l’hébergeur :

| Zone | @ propose | # propose |
|---|---|---|
| Pull request | Son auteur, ses relecteurs, ses assignés et tous ceux qui ont commenté | Les pull requests et issues ouvertes du dépôt, telles que chargées dans la barre latérale |
| Issue | Son auteur, ses assignés et ceux qui ont commenté | Pareil |
| Nouvelle pull request | Les personnes que lisent ses sélecteurs de relecteur et d’assigné, et les auteurs des pull requests chargées | Pareil |
| Nouvelle issue | Les auteurs des pull requests et issues chargées | Pareil |

Un **@** ou un **#** à l’intérieur d’un mot (une adresse e-mail), le `#` d’un
titre et tout ce qui est dans du code sont laissés tels quels.

## Envoyer

⌘/Ctrl+Entrée envoie depuis chaque zone : un commentaire de pull request ou
d’issue, une réponse dans un fil, un commentaire de ligne et la description d’une
nouvelle issue. Cela marche aussi depuis les onglets, la barre d’outils et
l’aperçu, pas seulement depuis le champ. Échap annule un commentaire de ligne,
depuis les mêmes endroits. Une **réponse dans un fil** est un
champ d’une ligne, pour qu’une longue conversation ne fasse pas pousser une barre
d’outils sous chaque fil : Entrée envoie, Maj+Entrée ajoute une ligne (le champ
grandit avec, et avec un bloc collé), et Échap abandonne ce qui a été tapé, après
confirmation. Il n’a ni onglets ni barre d’outils, mais les raccourcis de mise en
forme et la complétion **@** / **#** y fonctionnent, et un bouton **Répondre**
apparaît dès qu’il y a quelque chose à envoyer.

## L’aide-mémoire

**Markdown pris en charge**, sous chaque zone, ouvre un aide-mémoire sur place :
chaque format, ce qu’il faut taper et son raccourci. Échap ou un clic ailleurs le
ferme. Rien de ce que vous écrivez ne bouge.

En bas, **Ouvrir le guide complet** ouvre cette page. Le manuel est un onglet à
part, donc y aller quitte la page où se trouve la zone, et le texte non envoyé
serait perdu : quand il y en a — dans cette zone ou dans une autre de la page de la
pull request —, l’application demande d’abord. Dans les boîtes de dialogue de
nouvelle pull request et de nouvelle issue, l’aide-mémoire n’a pas ce lien, car le
manuel s’ouvrirait derrière la boîte de dialogue.

## Limites

- **Pas de pièces jointes.** Glisser un fichier ou coller une image dans la zone ne
  l’envoie pas : GitHub n’a pas d’API publique pour les pièces jointes de
  commentaires, il n’y a donc nulle part où mettre le fichier. Envoyez-le sur le
  site et collez le lien.
- **Seulement qui et ce qui est déjà chargé.** @ ne cherche pas parmi les
  utilisateurs de l’hébergeur, et # pas parmi toutes les issues — une personne qui
  n’a pas pris part à la conversation, ou une issue fermée que la barre latérale
  n’a pas lue, n’est pas proposée. Vous pouvez toujours taper le nom ou le numéro
  en entier.
- **Pas de suggestions de modification, de réponses enregistrées ni de sélecteur
  d’emoji.**
- **L’aperçu est le moteur de rendu de l’application.** Il montre le Markdown comme
  l’application le dessine ; le rendu de l’hébergeur peut différer dans le détail
  (extensions propres à GitHub, mentions transformées en liens).
- **L’aperçu est le dessin de l’application, pas celui de l’hébergeur.** Sur les pages
  de pull request et d’issue, l’aperçu dessine le texte comme le commentaire publié
  sera affiché dans l’application
  ([comment les commentaires sont affichés](pull-requests.md#comment-les-commentaires-sont-affichés)) : le même
  profil strict, les sauts de ligne conservés, et une image d’un autre site qui attend
  un clic. Sur GitHub, le commentaire publié est ensuite dessiné par GitHub, donc une
  extension que l’application ne connaît pas peut avoir un autre aspect. Les boîtes de
  dialogue de nouvelle pull request et de nouvelle issue utilisent l’aperçu Markdown
  habituel de l’application.
- Les raccourcis sont fixes : ils ne figurent pas dans les réglages des raccourcis
  et ne suivent pas une réassignation faite là.
