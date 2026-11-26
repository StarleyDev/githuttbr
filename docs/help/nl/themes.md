---
title: Thema's & uiterlijk
category: Naar eigen smaak
order: 100
summary: Ingebouwde thema's, licht en donker, plus eigen en door AI gegenereerde thema's, en gekleurde pictogrammen.
keywords: thema thema's theme themes donker dark licht light uiterlijk kleuren lettergrootte grafiek palet zoeken instellingen vinden search settings pictogram pictogrammen pictogramkleuren tint monochroom icon icons icon colors monochrome
---

# Thema's & uiterlijk

Ingebouwde thema's — Gitcito, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast en Daltonic — elk met een lichte en een donkere variant.

![Van licht naar donker wisselen](../../screenshots/clip-themes.webp)

- **Licht, donker, of het besturingssysteem volgen**, live omgeschakeld.
- **Eigen thema's**, en door **AI gegenereerde** thema's uit een prompt.
- Instelbare **lettergrootte voor code**.
- **Pictogramkleuren** voor de werkbalk en de secties van de zijbalk — zie
  hieronder.
- Een aparte **grafiekstijl**: baanpalet, hoekstijl, rijdichtheid en lijndikte,
  met een live minigrafiek als voorbeeld.

![Thema-instellingen](../../screenshots/settings-themes.webp)

## Pictogramkleuren

Een rij grijze pictogrammen laat Fetchen, Pushen en Stashen op elkaar lijken tot
je hun labels leest. **Pictogramkleuren**, onder Weergave op het tabblad Thema,
kleurt elk pictogram naar wat het doet, zodat het oog de actie vindt vóór het
woord:

| Rol | Pictogrammen | Themakleur die het krijgt |
|---|---|---|
| Ontvangen | Fetchen, Pullen, Remotes, Worktrees | het cyaanvak van het thema |
| Verzenden, afronden | Pushen, Taken, Issues, Releases | groen |
| Refs | Branch, Lokaal, Tags, Pull requests, Mijlpalen, Submodules | het accent |
| Opzijleggen | Stashen, Poppen, Stashes, Bladwijzers, Vastgezet | het oranjevak van het thema |

Ongedaan maken, Opnieuw uitvoeren, Gereedschap en Instellingen blijven grijs: het
zijn hulpmiddelen, en ze kaal laten is wat de gekleurde laat opvallen.

Lijsten die veel items groeperen, kleuren een hele groep tegelijk, zodat een groep
als één familie leest:

- **Menu Gereedschap** — tijdreizen (Reflog, WIP-momentopnamen, Tijdmachine,
  Bisect) in oranje; de branchgereedschappen (Absorb, de radars, lokale CI,
  vergelijkingen) in het accent; en één kleur per groep: Inspecteren cyaan,
  Branches & geschiedenis het accent, Bestanden & patches groen, Repository
  oranje, Geheimen & delen rood.
- **Instellingenpagina's** — Indeling, Werkruimtes en AI in het accent; Profiel en
  Omgeving groen; Integraties en Gegevens cyaan; Thema’s oranje; Beveiliging rood.
  Algemeen en Sneltoetsen blijven grijs.

Een rij pictogramknoppen zonder label doet het omgekeerde — elke knop krijgt een
eigen kleur, zodat je ze uit elkaar houdt. Op de
[pull-requestspagina](pull-requests.md) zijn de knoppen in de kop: vernieuwen
blauw, AI-review de accentkleur, lokaal bekijken turquoise, naar de bronbranch
groen en naar de doelbranch oranje (in de browser openen blijft grijs), en bij je
eigen reacties krijgt **Bewerken** de accentkleur en **Verwijderen** rood — daar en
op de issuepagina. Blauw en turquoise zijn mengsels van de themakleuren, dus ook die
volgen het thema.

| Optie | Wat je ziet |
|---|---|
| **Monochroom** | Elk pictogram grijs, zoals voordat deze optie bestond |
| **Zachte tint** (standaard) | De kleur door het grijs gemengd; de volle kleur bij aanwijzen |
| **Volle kleur** | De kleur zelf, op een klein vlakje in dezelfde tint |

De kleuren komen uit het thema — een thema dat zijn groen of zijn accent
overschildert, schildert de pictogrammen mee, eigen en door AI gegenereerde
thema's inbegrepen.

Grenzen: alleen de hoofdknoppen van de werkbalk, de koppen van de zijbalksecties,
het menu Gereedschap, de instellingenpagina's en de knoppen van de pull-request- en
issuepagina krijgen kleur; andere menu's, de rijen binnen een sectie en de
commitgrafiek niet. Een menuregel onder de muis houdt zijn gewone uiterlijk,
pictogram inbegrepen. Kleur is nooit de enige aanwijzing — elk pictogram houdt zijn
label.

## Een instelling vinden

Instellingen is verdeeld over veel pagina's, en de optie die je zoekt staat zelden waar je
hem verwacht: je weet dat hij bestaat, niet op welke pagina. Het zoekveld in de
kop van Instellingen, naast de sluitknop, doorzoekt alle pagina's tegelijk.

![Zoeken naar ‘terminal’ in de instellingen](../../screenshots/settings-search.webp)

Terwijl je typt, toont de rechterkant de passende instellingen, gegroepeerd per
pagina — elk met de naam, de beschrijving van één regel en de pagina waar hij
staat. De zijbalk dimt de pagina's zonder treffer en toont een aantal bij de
pagina's met treffers.

- Er wordt gezocht in de naam van de instelling, de beschrijving en de naam van
  de pagina. Hoofdletters en accenten tellen niet, en elk getypt woord moet
  voorkomen, dus "terminal lettertype" beperkt zich tot de
  lettertype-instellingen van de terminal.
- Er wordt tegelijk in de taal van de interface en in het Engels gezocht: met de
  app in het Nederlands vindt "token" of "font" de instelling nog steeds.
- Klik op een resultaat, of druk op **Enter** voor het eerste, om de pagina te
  openen (en op Thema's het juiste tabblad — Thema of Graaf), naar de instelling
  te scrollen en die even op te lichten.
- **Esc** wist de zoekopdracht; een tweede **Esc** sluit Instellingen.

De zoekfunctie kijkt naar namen en beschrijvingen, niet naar de waarden die je
hebt ingesteld. De serverlijsten per host onder Integraties (GitHub Enterprise
Server, zelfbeheerde GitLab, Bitbucket Data Center) openen de pagina
Integraties; het tabblad van de host kies je zelf. Losse sneltoetsen zijn niet
geïndexeerd — de zoekfunctie vindt de pagina Sneltoetsen, waarvan de editor ze
toont.

## Indeling

Zijbalk links of rechts, overal panelen waarvan je de grootte kunt aanpassen, een
inklapbare zijbalk voor wanneer de grafiek het hele venster verdient, en
terminalplaatsing per repository.

**Zie ook:** [De commitgrafiek](graph.md) · [Profielen](profiles.md)
