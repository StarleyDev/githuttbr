---
title: Committen
category: Werken met wijzigingen
order: 31
summary: Boodschapstijlen, sjablonen, co-auteurs en de linter.
keywords: commit boodschap message composer conventional gitmoji ticket amend sjabloon template co-author linter undo ongedaan maken reset generate with ai cancel undo
---

# Committen

## Boodschapstijlen

Kies er een in **Instellingen → AI → Commitberichten**, of direct in de
opsteller; de opsteller past zich eraan aan. De stijl hoort bij de AI die het
profiel gebruikt — de algemene of de eigen AI van het profiel.

| Stijl | Ziet eruit als |
|---|---|
| **Conventional** | `feat(api)!: add rate limiting` — met een knop **type ▾** vóór het onderwerp |
| **Gitmoji** | `✨ add rate limiting` — met een emoji-kiezer |
| **Gitmoji + Conventional** | `✨ feat(api): add rate limiting` — emoji-kiezer *én* knop **type ▾** |
| **Ticket** | `ABC-123: add rate limiting` — voorgevuld vanuit de branchnaam |
| **Plain** · **Auto** | Wat je maar typt; bij Auto bepaalt de AI de vorm |
| **Caveman** · **Haiku** | Precies wat je erbij voorstelt |

Bij een Conventional-stijl staat het voorvoegsel op de knop **type ▾** vóór het
onderwerp (*feat(api)*, of *type* zolang er geen is) en bevat het veld alleen de
woorden erna; het bericht krijgt nog steeds de hele `feat(api): …`. De knop toont de
types, en **Geen type** haalt het voorvoegsel weg. Een voorvoegsel met de hand typen
werkt ook, en <kbd>Backspace</kbd> aan het begin van het veld toont het voorvoegsel
weer als tekst, om de scope te wijzigen; het klapt terug op de knop zodra het veld
de focus verliest.

![Opsteller voorgevuld vanuit een commitsjabloon](../../screenshots/commit-template.webp)

### Gitmoji

[Gitmoji](https://gitmoji.dev) zet een emoji voor het onderwerp, zodat een
geschiedenis in één oogopslag leesbaar is: 🐛 fixes, ✨ features, 🔥
verwijderingen. Bij beide gitmoji-stijlen staat de emoji-knop direct naast het
onderwerpveld. Die opent **alle 75 officiële gitmoji**, doorzoekbaar op emoji,
op `:code:` (wat gitmoji-cli-gebruikers typen) of op betekenis in je eigen taal.

**Gitmoji + Conventional** houdt type en emoji gelijk. Kies een type en de emoji
volgt; verander het type en hij verandert mee — tenzij je de emoji zelf koos
(🚑️ bij een `fix`, bijvoorbeeld). Die wordt nooit overschreven.

| Type | Emoji | Type | Emoji |
|---|---|---|---|
| `feat` | ✨ | `test` | ✅ |
| `fix` | 🐛 | `build` | 📦️ |
| `docs` | 📝 | `ci` | 👷 |
| `style` | 🎨 | `chore` | 🔧 |
| `refactor` | ♻️ | `revert` | ⏪️ |
| `perf` | ⚡️ | | |

De AI schrijft in dezelfde vorm. Vergeet een model de emoji of antwoordt het met
een `:shortcode:`, dan wordt het onderwerp gecorrigeerd voordat het in het veld
komt.

Commits die andere tools schreven als `:sparkles: add login` worden in de graaf,
de commitdetails en de geschiedenisweergaven **getoond** als `✨ add login`.

Grenzen:

- De kiezer schrijft altijd de **unicode**-emoji, nooit een `:shortcode:`.
- Shortcodes worden alleen voor weergave omgezet. De commit zelf wordt niet
  herschreven, en zoeken in de geschiedenis vindt de tekst zoals die gecommit is.
- Alleen gitmoji tellen: een onderwerp dat met een andere emoji begint, blijft zoals het is.
- Een repository waarvan de `commit-msg`-hook commitlint met de standaard
  Conventional-preset draait, weigert een emoji vooraan. Dat is de regel van de
  hook, niet van GitHuttBr — stel commitlint in voor gitmoji of gebruik daar puur
  Conventional.

## Het bericht met AI schrijven

Met AI aan staat de knop **✦** (*Genereren met AI* bij aanwijzen) onder de
beschrijving. Hij leest de gestagede diff en schrijft de samenvatting en de
beschrijving in de stijl hierboven. Ernaast noemt een aparte kiezer wie antwoordt —
*account · model*, het paar dat voor commitberichten is gekozen onder
**Instellingen → AI → Model per taak** — zodat een traag lokaal model of een
duur model nooit een verrassing is.

- **▾** naast de naam toont je opgeslagen accounts, elk met een paar van zijn
  modellen. Een keuze geldt **alleen voor die ene generatie**; de
  Instellingen veranderen niet.
- Terwijl het loopt, draait de ✦ en toont dezelfde rij de seconden tot nu toe en
  **Annuleren**, dat het verzoek zelf stopt, niet alleen de spinner. De
  samenvatting en de beschrijving zijn intussen alleen-lezen, zodat het antwoord
  niets overschrijft wat je typt. Na 30 seconden biedt de app-brede melding
  *duurt langer dan verwacht* ([AI](ai.md)) aan om te blijven wachten of
  dezelfde generatie naar een ander gereed account te verplaatsen; **Opnieuw
  genereren** gebruikt daarna dat account.
- De nieuwe tekst **vervangt** wat er stond, en de oude wordt bewaard:
  **Ongedaan maken** en **Opnieuw genereren** verschijnen op dezelfde rij (wijs
  ze aan voor *Gegenereerd door account · model in 7 s*). Ongedaan maken zet je
  samenvatting en beschrijving terug. Beide verdwijnen zodra je de tekst bewerkt
  of commit.
- De beschrijving die je typt, of die de AI schreef, blijft staan als je naar
  een ander tabblad gaat en terugkomt, net als de samenvatting — en na een
  generatie ook **Ongedaan maken** en **Opnieuw genereren**.

![Genereren met AI en het accountmenu](../../screenshots/commit-ai-generate.webp)

![Een gegenereerd bericht, met Ongedaan maken en Opnieuw genereren naast het account](../../screenshots/commit-ai-generated.webp)

[Commit bewerken](commit-edit.md) heeft dezelfde knop, op basis van de diff
van die commit.

Beperkingen:

- Alleen de gestagede diff wordt verstuurd, ingekort als hij erg groot is —
  nooit ongestagede wijzigingen of andere bestanden.
- Ongedaan maken houdt één stap vast: de tekst van vóór de eerste generatie op
  rij. Is Ongedaan maken weg, dan is die kopie ook weg.
- Annuleren geeft geen tokens terug die een provider al heeft verbruikt.
- De ▾-lijst toont alle opgeslagen accounts, ook een zonder sleutel; die kiezen
  mislukt met de eigen fout van dat account.

## Wat de opsteller voor je doet

- <kbd>↑</kbd> <kbd>↓</kbd> haalt je **recente boodschappen** terug.
- Een **co-auteurkiezer** voegt `Co-authored-by:`-trailers toe uit de eigen
  bijdragers van de repository.
- `commit.template` / `.gitmessage` **vult de boodschap voor**, met de
  commentaarregels eruit gestript.
- Tijdens een merge, cherry-pick of revert is de boodschap **voorgevuld** zoals
  git dat zou doen.
- Concepten **blijven bewaard** per repository, dus van tabblad wisselen kost je
  nooit een boodschap.

## De linter

Een live, niet-blokkerende controle: lengte van de onderwerpsregel, een punt aan
het eind, een niet-gebiedende of met kleine letter beginnende onderwerpsregel, te
brede regels in de body. Hints, nooit een hek — het houdt je niet tegen bij het
committen. De lengte is de teller naast het onderwerp, afgezet tegen de grens van 72
tekens (*56/72*): hij wordt rood voorbij de grens, en zijn tooltip geeft het advies
om op 50 te mikken. De andere hints staan onder de beschrijving.

## Amend

Amend herschrijft de laatste commit met wat er gestaged staat. GitHuttBr laat je
eerst de bestaande boodschap zien, zodat je bewerkt in plaats van overtypt.

**Commit aanpassen…** op een grafiekrij doet hetzelfde voor HEAD: het laadt de
volledige boodschap, zet de opsteller in de amend-stand en geeft hem focus. Een
HEAD die al gepusht is kan nog steeds worden aangepast, maar GitHuttBr waarschuwt
dat het bijwerken van de remote een force push zal kosten.

**Commit ongedaan maken…** is de tegenhanger voor een niet-gepushte HEAD: een
mixed reset naar de ouder, de wijzigingen in de werkboom blijven behouden, en de
boodschap komt terug in de opsteller. De eerste commit heeft een eigen pad dat
een ongeboren branch achterlaat in plaats van de bestanden te vernietigen.

**Zie ook:** [Stagen](staging.md) · [Absorb](absorb.md) · [Changeloggenerator](changelog.md)
