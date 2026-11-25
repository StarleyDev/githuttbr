---
title: Aan de slag
category: Begin hier
order: 1
summary: Open een repository, lees de grafiek, maak je eerste commit.
keywords: intro eerste stappen openen klonen clone tabbladen tabs grafiek graph commit
source: 173f891f9f1c5c53ea40cf344baf821e3188344d
---

# Aan de slag

Gitcito opent een map en toont je zijn geschiedenis. Er wordt niets naar je
repository geschreven tot je erom vraagt.

![Een net geopende repository, nog zonder commits](../../screenshots/empty-repo.webp)

## Een repository openen

![Repository openen: openen, klonen of aanmaken, daaronder de gescande en recente repositories](../../screenshots/open-repository.webp)

- **Sleep een map** op het venster, of gebruik **Repository openen** op het
  welkomstscherm. De kiezer neemt meerdere mappen tegelijk: selecteer ze met
  ⌘-klik of Shift-klik, en elke map opent in een eigen tabblad (of komt in de
  groep van waaruit je hem opende). Bij een selectie van meerdere wordt een
  repository die al open is, of een map die geen Git-repository is, overgeslagen
  en in een melding genoemd, zodat de andere toch openen. De macOS-kiezer kan
  open repositories niet vooraf grijs maken: Electron stelt de hook per map van
  het paneel niet beschikbaar, dus de controle gebeurt nadat je op Openen klikt.
- **Gescande repositories**, onder de drie knoppen, toont elke repository in de
  mappen die Gitcito voor je moet scannen — vink er meerdere aan en open ze in
  één keer, of dubbelklik op één. Daar voeg je die mappen ook toe of haal je ze
  weg. Zie [Repositories](repositories.md#gescande-repositories).
- **Verkeerde aangeklikt?** Klonen, Aanmaken, Groep maken en Gescande
  repositories hebben, geopend vanuit Repository openen, een **Terug**-pijl naast
  hun titel die ernaar terugkeert.
- **Kloon** er een vanaf een URL of rechtstreeks bij je host — zie
  [klonen](cloning.md) voor de opties die een enorme repository snel kloonbaar
  maken.
- Vanuit een terminal opent `gitcito .` de huidige map in de draaiende app — zie
  [de commandoregel](cli.md).
- Eén enkele map die nog geen Git-repository is opent evengoed, en biedt aan hem
  te initialiseren.

## De drie panelen

| Paneel | Wat erin zit |
|---|---|
| Links | Branches, remotes, tags, stashes, worktrees — en het tabblad **Bestanden** voor de werkboom |
| Midden | De commitgrafiek, en wat je daaruit selecteert |
| Rechts | De commitopsteller, of de details van de geselecteerde commit |

## De rest vinden

Twee routes, en ze leiden naar dezelfde plekken:

- **`⌘K`** (`Ctrl+K`) — het commandopalet. Typ wat je wilt; het springt ook naar
  branches, commits en bestanden.
- **Tools** in de werkbalk — dezelfde repositorygebonden verzameling als menu,
  met de lange staart opgevouwen in groepen zodat het leesbaar blijft.

![Het Tools-menu: de veelgebruikte tools eerst, de rest gegroepeerd](../../screenshots/tools-menu.webp)

Wordt het venster smal, dan vecht de actiebalk niet langer om ruimte: knoppen die niet meer passen vouwen samen in een menu **Meer** aan het eind, in de volgorde van de balk en met hun submenu’s. Maak het venster breder en ze komen terug.

Alles wat via de een bereikbaar is, is via de ander bereikbaar, dus er is niets
dat alleen ingewijden kunnen vinden.

## Je eerste commit

1. Bewerk een bestand. Het verschijnt onder **Niet gestaged**.
2. Stage het — het hele bestand, een hunk, of [losse regels](staging.md).
3. Schrijf een boodschap en druk op **Committen**.

Al het andere in Gitcito is optioneel.

