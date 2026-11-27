---
title: Instellingen per repository
category: Werkomgeving & tools
order: 94
summary: De weergavenaam, het profiel, de beschermde branches en de tabafbeelding van één repository, plus zijn regels, kluis en activiteit.
keywords: repo-instellingen settings beschermde branches protected analytics operatielogboek operation log geschiedenis info tandwiel tabafbeelding tab image pictogram logo weergavenaam alias profiel uit de lijst verwijderen vergeten statistieken projectconfiguratie
source: 6cd23a3db24f4869df7d1b881fb15155bd0a0a8b
---

# Instellingen per repository

Het tandwiel naast de tools in de werkbalk opent instellingen die bij **deze**
repository horen, niet bij de app.

![Instellingen per repository](../../screenshots/repo-settings.webp)

De kop zegt welke repository je gaat wijzigen: de naam, de map, de huidige
branch, de hoofdremote (`origin` als die er is) met de host waar hij staat, en
een paar tellingen. Het aantal branches komt uit de lijst die al geladen is. Het
aantal in de kluis verschijnt pas nadat je **Kluis** hebt geopend, omdat de
kluis lezen de sleutelbos van het systeem raadpleegt, en instellingen openen dat
niet hoort te doen. Er is geen aantal commits: een lange geschiedenis tellen is
een eigen git-aanroep, en een kop is die niet waard.

De pagina’s staan in een zijnavigatie, in drie groepen:

| Groep | Pagina | Wat erin staat |
|---|---|---|
| Repository | **Algemeen** | Weergavenaam, profiel, beschermde branches, de tabafbeelding en Uit de lijst verwijderen |
| Repository | **Projectconfiguratie** | De [regels die deze repository meebrengt](repo-config.md) in `.githuttbr.json`, en de doctor die ze controleert |
| Repository | **Informatie** | Vrije notities en velden over deze repository, lokaal bewaard |
| Beveiliging | **Kluis** | De [kluis](vault.md)-items van deze repository |
| Activiteit | **Statistieken** | Wat je in GitHuttBr hebt gedaan, lokaal geteld |
| Activiteit | **Inzichten** | Het [geschiedenisdashboard](insights.md) |
| Activiteit | **Bewerkingsgeschiedenis** | Commits door de tijd en wie ze maakte, voor de repositories die je hebt geopend |
| Activiteit | **Logboek** | Het bewerkingslogboek: elk git-commando dat GitHuttBr hier uitvoerde, met het resultaat |

Het operatielogboek is het eerlijke onderdeel: gedraagt iets zich vreemd, dan
toont het het exacte commando en de exacte fout, zodat een bugmelding feiten kan
dragen in plaats van bijvoeglijke naamwoorden.

## Algemeen

Elke instelling is een rij: links wat ze doet, rechts het bedieningselement.
Er wordt niets opgeslagen tot je op **Opslaan** drukt.

| Rij | Wat ze doet | Opgeslagen in |
|---|---|---|
| **Weergavenaam** | De naam op tabbladen en in lijsten. De map op schijf wordt nooit hernoemd; leeg betekent de mapnaam | Instellingen van GitHuttBr, deze computer |
| **Profiel** | De identiteit, tokens en AI waar deze repository naar overschakelt als zijn tabblad actief is. **Automatisch** volgt het actieve profiel | Instellingen van GitHuttBr, deze computer |
| **Beschermde branches** | Waarschuwt voor een commit of force-push direct op deze branches | De git-config van de repository |
| **Tabafbeelding** | Een kleine afbeelding op het tabblad, hieronder | Instellingen van GitHuttBr, deze computer |

Heeft de repository een `.githuttbr.json`, dan zegt een melding boven Algemeen
dat en linkt die naar **Projectconfiguratie**. Die regels reizen met de
repository mee naar iedereen die hem kloont; de rijen eronder zijn alleen van jou.

**Uit de lijst verwijderen…** haalt de repository uit
[Repositories](repositories.md). Het vraagt eerst, en de vraag zegt wat het niet
doet: de map op schijf blijft onaangeroerd, en een open tabblad blijft open. De
repository opnieuw openen zet hem terug in de lijst.

## Tabafbeelding

Met tien tabbladen open zijn namen die hetzelfde beginnen — `api`,
`api-gateway`, `api-docs` — lastig uit elkaar te houden. Een kleine
afbeelding op het tabblad vind je sneller dan tekst.

Klik onder **Algemeen** in het afbeeldingsveld. Het toont de afbeeldingen van
de repository zelf — PNG, JPEG, GIF, WebP, SVG, ICO, BMP en AVIF —, elk met een
miniatuur, bestanden die naar een logo of icoon heten eerst. Typ om te filteren
(`logo dark` vindt `assets/logo-dark.png`), beweeg met de pijltjestoetsen en
kies met Enter; of typ zelf een pad. Het pad wordt **relatief aan de root van
de repository** opgeslagen, zodat de afbeelding de repository volgt, waar de
map ook staat.

Wat het tabblad toont, is een keuze voor de hele app, onder **Instellingen →
Algemeen → Repository-tabbladen tonen**:

| Optie | Het tabblad toont |
|---|---|
| **Afbeelding en naam** (standaard) | De afbeelding in plaats van het mappictogram, dan de naam |
| **Alleen naam** | Het mappictogram en de naam, alsof er geen afbeelding is |
| **Alleen afbeelding** | Alleen de afbeelding; de naam verhuist naar de tooltip |

Grenzen om te kennen:

- De lijst bevat de bestanden die git ziet — gevolgd en ongevolgd, geen
  genegeerde — en hoogstens 40 tegelijk; typ om de rest te bereiken. Een
  genegeerde afbeelding kun je nog steeds zelf intypen.
- Afbeeldingen boven 1 MB, of onleesbare, zijn grijs en niet te kiezen: een
  pictogram van 20 pixels heeft niet meer nodig.
- Een repository **zonder** afbeelding toont altijd de naam, welke optie ook
  gekozen is — een leeg tabblad zou niet te herkennen zijn.
- Is het pad **kapot** — bestand verwijderd, hernoemd, geen afbeelding of te
  groot —, dan valt het tabblad stil terug op de naam en toont deze
  instellingenpagina een waarschuwing onder het pad. Verder klaagt niets.
- De afbeelding wordt eens per sessie gelezen. Vervang je het bestand onder
  dezelfde naam, open deze instellingenpagina dan opnieuw om te herladen.
- De instelling staat in GitHuttBr’s eigen instellingen op deze computer, niet in
  de repository, dus teamgenoten erven haar niet.

**Zie ook:** [Beveiliging & geheimen](security.md) · [Inzichten](insights.md)
