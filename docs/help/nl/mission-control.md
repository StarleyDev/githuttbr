---
title: Mission control
category: Synchroniseren & meerdere repo's
order: 51
summary: Elke repository van de workspace op één scherm, ergste eerst.
keywords: mission control dashboard alle repos overzicht status vuil dirty ongepusht behind achter workspace laatste commit laatste fetch verouderd stale pull requests ci release tag verversingsinterval refresh interval
---

# Mission control

Twintig repository's, en de vraag is altijd dezelfde: welke heeft mij nodig?

Mission control beantwoordt hem. Elke repository van de **actieve workspace** op
één scherm, geordend naar wat je werkelijk nodig heeft:

1. **Geblokkeerd** — een rebase of merge die halverwege bleef steken,
   conflicten, een repo die helemaal niet gelezen kan worden.
2. **Te synchroniseren** — commits om te pullen, daarna commits om te pushen.
3. **Onderhanden** — niet-gecommit werk, untracked bestanden.
4. **Schoon** — de stille, onderaan, waar ze horen.

![Elke repository op één scherm, ergste eerst](../../screenshots/mission-control.webp)

## Wat een rij je vertelt

Elke rij lees je van links naar rechts, en de kolommen lijnen uit over de hele
lijst, zodat de tellingen zich vergelijken als in een tabel:

| Kolom | Wat ze toont |
|---|---|
| **Repository** | Naam, groep, de branch en zijn upstream — of **geen upstream** in amber: zo’n branch wordt nooit per ongeluk gepusht, maar synchroniseert ook nooit |
| **Laatste commit** | Onderwerp en auteur: waar de repository het laatst mee bezig was, zonder hem te openen |
| **Lokaal** | Conflicten · ↓ te pullen · ↑ te pushen · gestaged · gewijzigd · niet gevolgd · stashes. Hover voor wat elke telling telt |
| **Hosting** | De open pull requests, met die op **jouw** review wachten in amber, en de CI van HEAD. Klik op het aantal om de pagina **Pull requests** van die repository te openen, of op **CI** voor zijn runs |
| **Release** | De nieuwste tag die HEAD bereikt, en hoeveel commits erna kwamen — **bijgewerkt** als het er geen zijn. Het aantal kleurt naar hoe ver een release achterloopt: grijs tot 5 commits, geel tot 20, rood daarboven, in vier bereiken die je kunt aanpassen — eigen kleuren inbegrepen — in [**Instellingen → Thema’s → Kleuren van de release-notitie**](themes.md#kleuren-van-de-release-notitie) |
| **Activiteit** | Een sparkline van 14 dagen commits, en hoeveel het er zijn |
| **Tijd** | Hoe lang geleden de laatste commit was, en de laatste **fetch** |

Hover over het statusicoon voor de redenen waarom de rij daar staat —
"2 te pushen · 1 niet gecommit".

De fetch-leeftijd staat er omdat deze pagina lezen nooit fetcht: de telling "te
pullen" is maar zo vers als de laatste fetch. Heeft een branch met upstream een dag
of langer niet gefetcht, of nooit, dan wordt de leeftijd amber — fetch voordat je
een 0 gelooft. De tijd komt van git zelf, dus een `git fetch` in een terminal telt
ook.

![Instellingen → Git & synchronisatie: de verversing van Mission Control naast automatisch fetchen](../../screenshots/settings-git-sync.webp)

In een smal venster blijft elke kolom staan, en de tabel scrolt zijwaarts binnen
zijn kader.

**Openen** aan het eind van een rij toont die repository zelf — zijn graaf — ook
als zijn tabblad het laatst de pull-requestlijst toonde die het PR-aantal opende.

Klap een rij uit (het pijltje, of <kbd>spatie</kbd>) om precies te zien welke
commits op pushen wachten en welke bestanden vuil zijn.

## De lijst afwerken

- De statuspillen bovenaan zijn **filters** — klik op "3 geblokkeerd" om alleen
  die te zien. **N open PR’s** en **N CI mislukt** filteren op dezelfde manier,
  en **N PR’s wachten op jouw review** in de regel eronder ook.
- Sorteer op **urgentie**, **naam** of **activiteit**.
- **Vink meerdere repo's aan** om ze te fetchen, of pull alleen degene die achter
  liggen (de knop telt ze voor je).
- **N verouderde fetchen** verschijnt als branches met een upstream een dag of langer
  niet gefetcht hebben, en fetcht alleen die — die waarvan "te pullen" fout kan zijn.
- Zolang het open staat ververst het zichzelf elke 30 seconden — wijzig dat in
  **Instellingen → Git & synchronisatie → Vernieuwing van Mission Control**, minstens
  30 seconden. Zolang de pagina dicht is, draait er niets.

| Toets | Actie |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> of <kbd>j</kbd> <kbd>k</kbd> | Door de lijst lopen |
| <kbd>Enter</kbd> | Die repository openen |
| <kbd>f</kbd> / <kbd>p</kbd> | Hem fetchen / pullen |
| <kbd>spatie</kbd> | Hem uitklappen |
| <kbd>/</kbd> | Naar het filter springen |

## Het is een weergave, geen tabblad

De meter naast de workspacenaam schakelt hem aan en uit; op een willekeurig
tabblad klikken brengt je terug naar je werk. Het voegt nooit een eigen tabblad
toe, en het hoort bij de workspace waarin je zit — wissel van workspace en je
krijgt het dashboard van die workspace.

De git-kant is **lokaal**: een handvol git-commando's per repository, geen fetch.
De kolom **Hosting** is het enige deel dat met een host praat. Die vraagt de host
van elke repository naar zijn open pull requests en de CI van HEAD, als het
profiel van die repository, en stil: een host zonder token of koppeling voor dat
profiel toont gewoon niets, en er gaat nooit een aanmeldvenster open. Een
repository die al in een tabblad open staat kost geen aanroep, want de zijbalk
heeft zijn pull requests al.

Grenzen, zodat de cijfers goed gelezen worden:

- Hosts worden **hooguit elke 5 minuten** per repository bevraagd (eerder als
  HEAD verschuift of een CI-run nog bezig is), wat de verversingsinterval ook is
  — het API-tegoed van een host wordt gedeeld met de rest van de app.
  **Vernieuwen** vraagt het nu opnieuw.
- Een aantal toont **30+** als de eerste pagina van de host vol terugkwam; de
  lijstpagina heeft ze allemaal.
- De releasekolom is de nieuwste tag die **vanaf HEAD bereikbaar** is, niet de
  nieuwste tag in de repository. Een tag op een commit die HEAD al heeft,
  verschijnt binnen twee minuten.

Fetchen is altijd iets waar jij om vroeg.

**Zie ook:** [Workspaces & tabbladen](workspaces.md) · [Workspaces, tabbladen & groepen](workspaces.md)
