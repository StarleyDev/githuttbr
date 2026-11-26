---
title: Workspaces, tabbladen & groepen
category: Begin hier
order: 3
summary: Veel repository's zonder te verdrinken: tabbladen, groepen, mappen en workspaces.
keywords: workspace werkruimte tabbladen tabs groepen mappen meerdere repos organiseren wisselen indeling ga naar repository wisselaar tabbladgrootte go to repository switcher tab sizing
source: 6fc6b6e0f1f3c8f6a3a638dc0388df5328222a41
---

# Workspaces, tabbladen & groepen

Drie niveaus, van het losste naar het strakste.

## Tabbladen

Eén repository, één tabblad. Gebruik <kbd>⌘T</kbd> / <kbd>Ctrl+T</kbd> om de
kiezer voor een nieuw tabblad te openen en <kbd>⌘W</kbd> / <kbd>Ctrl+W</kbd> om
het actieve tabblad te sluiten. Je kunt ook slepen om te herordenen,
middenklikken om te sluiten, of op <kbd>⌘⇧T</kbd> drukken om het laatst gesloten
tabblad te heropenen. Rechtsklik een repositorytabblad (of een chip in een
[groep](#groepen)) voor het [contextmenu van de repository](repo-menu.md) —
alias, worktrees, GitHub, terminal, tonen, editor en onderaan **Deze repo
sluiten** en **Andere sluiten** (een chip in een groep biedt in plaats daarvan
verwijderen). Sluit het
laatste tabblad en <kbd>⌘W</kbd> sluit het venster. Een stip op het tabblad betekent niet-gecommit werk; een andere stip
betekent conflicten.

Verschijnt er een sluitwaarschuwing, dan annuleert <kbd>Escape</kbd> altijd.
<kbd>Enter</kbd> bevestigt alleen wanneer het tabblad schoon is — bij
niet-gecommitte wijzigingen of conflicten laat de waarschuwing je met opzet naar
de knop grijpen, zodat een verdwaalde toetsaanslag na <kbd>⌘W</kbd> geen werk kan
sluiten dat je nog vasthield.

### Tabbladgrootte

Standaard (**Instellingen → Indeling → Tabbladgrootte → Passend**) gedragen
tabbladen zich als die van een browser: als de strook te weinig ruimte heeft,
krimpen ze gelijk tot een minimale breedte, en scrollen ze pas als ook die grens
bereikt is. **Vast** zet het klassieke gedrag terug — elk tabblad houdt de breedte
van zijn inhoud en de strook scrolt zodra ze niet meer allemaal passen.

### Naar een repository gaan

Met tien of meer open repositories betekent er een vinden in de strook scrollen,
<kbd>⌘1</kbd>–<kbd>⌘9</kbd> stoppen bij het negende tabblad, en het
[commandopalet](search.md) mengt de open repositories met alle acties. Druk op
<kbd>⌘J</kbd> / <kbd>Ctrl+J</kbd> (of **Weergave → Ga naar repository…**) en typ
een paar letters van de naam, map of branch, dan <kbd>Enter</kbd>.

![De repositorywisselaar, meest recent gebruikte eerst](../../screenshots/repo-switcher.webp)

De lijst bevat alleen open repositories, groepsleden inbegrepen, in de volgorde
waarin je ze het laatst bekeek. Degene die je net verliet staat bovenaan, dus
<kbd>⌘J</kbd> <kbd>Enter</kbd> brengt je ernaar terug. Elke rij draagt wat zijn
tabblad toont: de branch, de stip voor niet-gecommit werk of conflicten, de groep
waarin hij zit, en zijn toets <kbd>⌘1</kbd>–<kbd>⌘9</kbd> als hij er een heeft. De
repository op het scherm staat gedimd onderaan. Achter de wisselaar wordt niets
donker; een klik ernaast of <kbd>Esc</kbd> sluit hem.

Als niets wat open is overeenkomt, brengt de laatste rij, **Zoek in alle
repository’s**, je zoekopdracht naar de pagina [Repositories](repositories.md). De
sneltoets is opnieuw toe te wijzen in **Instellingen → Sneltoetsen**.

*Beperkingen:* de volgorde wordt alleen voor deze sessie onthouden, dus na een
herstart begint ze bij de tabbladvolgorde. Een repository die in twee tabbladen open
is, staat er één keer in, bij zijn eerste tabblad. Repositories in andere
[workspaces](#workspaces) staan er niet in — wissel eerst van workspace, of gebruik de
pagina Repositories.

## Groepen

Bundel bij elkaar horende repository's in een genoemd, kleurgecodeerd
**groepstabblad**. Binnen een groep krijg je een tweede rij met één chip per
repository, en de groep zelf kan in één keer **Alles fetchen** of **Alles
pullen**.

Om er een te beginnen, rechtsklik je een repositorytabblad → *Nieuwe groep…*: het
tabblad wordt een groep met die repository, op dezelfde plek. Zodra er een groep
bestaat, heet hetzelfde menu-item *Aan groep toevoegen →*, met de open groepen.
Een repositorytabblad op een groepschip slepen doet hetzelfde.

*Nieuwe groep…* vraagt een naam en een kleur tegelijk. De kleur begint op een kleur
die nog geen open groep draagt, willekeurig gekozen, zodat groepen niet allemaal
hetzelfde beginnen.

![Het dialoogvenster Nieuwe groep, met naam en kleur tegelijk gekozen](../../screenshots/new-group-dialog.webp)

Om een groep een andere kleur te geven, rechtsklik je erop: de tien kleuren staan in
het menu als een rij stippen, met een ring om de huidige, en één klik past er een
toe. *Aangepaste kleur…* onder de rij opent een kiezer voor elke andere kleur.
Mappen en de secties op de pagina Repositories gebruiken dezelfde rij.

![Het contextmenu van een groep: de kleurenrij, Aangepaste kleur…, Groep opheffen en Groep sluiten](../../screenshots/group-color-menu.webp)

Om een groep op te heffen, rechtsklik je erop → **Groep opheffen**. Elke repository
wordt een gewoon tabblad op de plek van de groep en houdt de pagina’s die het open
had. **Groep sluiten** sluit in plaats daarvan de groep en elke repository erin.
Mappen overleven het opheffen niet: ze bestaan alleen binnen een groep.

![Een groepstabblad met meerdere repository's](../../screenshots/repo-groups.webp)

Groepen kunnen **mappen bevatten, tot elke diepte genest**: rechtsklik de groep →
*Nieuwe map…*, en sleep vervolgens repository's op een mapchip. Elke map krijgt
een kleur, klapt in tot een chip met een teller, telt de statusstippen van alles
erin op, en kan zijn hele subboom fetchen of pullen.

![Mappen in de tabbladenstrook van de groep, elk een chip met teller — Internal genest binnen Services](../../screenshots/nested-folders.webp)

> Mappen ordenen alleen. Er een verwijderen tilt zijn repository's naar de ouder
> — het sluit nooit een repository.

Om een repository toe te voegen die de groep nog niet heeft, klik je op de **+** naast de groepsnaam. Die toont de pagina van de groep — een map openen, klonen, aanmaken of een recente repository kiezen — ook als een van de repositories open is; een klik op een chip brengt je ernaar terug.

## Pagina's die bij een repository horen

Sommige pagina's zijn niets op zichzelf: de [wiki](repo-wiki.md) van een
repository, de [insights](insights.md), de [dev tools](devtools.md) die een
launch-sessie aankondigde. Ze nemen geen tabblad — ze verschijnen als kleine chips
op de repository zelf: een pictogram en een woord dat zegt welke pagina het is
(*CI*, *PR’s*, *Wiki*, *#482* voor een pull request, de tag van een release). De
volledige naam staat in de tooltip, en een lange tag of titel wordt afgekapt met
een beletselteken.

- **Klik een pictogram** om die pagina te tonen. **Klik nog eens — of klik de
  naam van de repository** — om terug te gaan. Zolang een pagina getoond wordt,
  krijgt de naam een handcursor en bij hover een klein pilletje: dat is de weg
  terug.
- **Zweef over een pictogram** voor de ✕ die alleen die pagina sluit.
- In een **groep** zitten de pictogrammen op de chip van de repository waar ze
  bij horen, en alleen zolang die repository de geselecteerde is. Een andere
  repo kiezen toont *die* repository, niet het gereedschap van de buurman.
- Dezelfde pagina opnieuw openen laat het bestaande pictogram oplichten in
  plaats van er een tweede bij te zetten.

Een repository die nergens open staat kan geen pictogram dragen: een pagina
ervoor opent dan een eigen tabblad — openen moet altijd iets openen.

## Workspaces

Een workspace is een **hele opgeslagen tabbladenstrook**. Wisselen verwisselt elk
tabblad tegelijk: `Werk` en `Privé` trappen elkaar niet meer op de tenen.

De naam van de workspace staat linksboven, naast het GitHuttBr-merkteken. Klik erop
om te wisselen, aan te maken, te hernoemen, te herordenen of te verwijderen.
Ernaast zit de meter die [Mission control](mission-control.md) opent voor de
workspace waarin je zit.

**Zie ook:** [Mission control](mission-control.md) · [De commandoregel](cli.md)
