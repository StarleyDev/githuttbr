---
title: Pull-requestspagina
category: Synchroniseren & meerdere repo's
order: 57
summary: Alle pull requests van een repository op één pagina — per status, gefilterd op auteur, reviewer, doel en CI — en ‹ › om vanuit een PR door de gefilterde lijst te lopen.
keywords: pull requests lijst pagina merge requests pr mr filter auteur reviewer van mij wacht op mijn review review gevraagd ci faalt doelbranch concepten gemerged gesloten zoeken triage vorige volgende alt pijl navigatie checkout naar de bronbranch doelbranch branchnaam kopiëren fetch
source: 652fe566e0d021496e698b305175c701c5bf2e4e
---

# Pull-requestspagina

Een drukke repository heeft twintig pull requests tegelijk open. De zijbalk
toont ze, maar één regel per stuk zegt weinig: van wie is welke, welke wachten
op jou, welke zijn rood geworden. Dat uitzoeken betekende ze een voor een
openen, lezen, teruggaan, de volgende openen. De **pull-requestspagina**
beantwoordt die vragen op één scherm, en zodra je een pull request opent, brengen
**‹ ›** je naar de volgende uit dezelfde lijst zonder terug te gaan.

![De pull-requestspagina gezocht op "pix": de treffers gemarkeerd, je eigen met "jij", een falende CI en een concept](../../screenshots/pull-requests.webp)

## Openen

- Het **lijstpictogram** in de kop **PULL REQUESTS** van de zijbalk (*Alle pull
  requests bekijken*).
- *Pull requests…* in het opdrachtenpalet (⌘K), of **Gereedschap → Pull
  requests…**.

Net als de wiki en de [CI-runs](ci-runs.md) hoort de pagina bij het tabblad van
de repository.

## Tabbladen

| Tabblad | Wat erin staat |
|---|---|
| **Open** | Alle open pull requests, concepten inbegrepen |
| **Concepten** | Alleen de open pull requests die als concept zijn gemarkeerd |
| **Gemerged** | Gemergede pull requests, gelezen wanneer je het tabblad voor het eerst opent |
| **Gesloten** | Gesloten zonder merge (afgewezen, verlaten), gelezen samen met Gemerged |

De aantallen naast Open en Concepten komen uit de lijst die de zijbalk al heeft.
Gemerged en Gesloten worden pas opgevraagd wanneer je er een opent, en één keer
per sessie; **Vernieuwen** vraagt ze opnieuw op.

## Filters

| Filter | Houdt over |
|---|---|
| **Zoeken** | Pull requests waarvan de titel, beschrijving, branches of het nummer elk getypt woord bevatten. `#482` of `482` vindt dat nummer; treffers worden in de titel gemarkeerd |
| **Auteur** | Eén auteur — elk met het aantal dat hij in dit tabblad heeft. **Ik** staat bovenaan |
| **Reviewer** | Eén gevraagde reviewer, of **Review aan mij gevraagd** |
| **Doelbranch** | Pull requests naar die branch |
| **Van mij** | Een snelkoppeling voor *Auteur: Ik* |
| **Wacht op mijn review** | Een snelkoppeling voor *Reviewer: review aan mij gevraagd* |
| **CI faalt** | Pull requests waarvan de checks op de head zijn mislukt |

De regel onder de filters zegt hoeveel pull requests van het tabblad worden
getoond en welke filters aan staan, met **filters wissen** om ze allemaal weg te
halen.

Filters blijven per repository bewaard **zolang de app draait** — verlaat de
pagina, kom terug, en ze staan zoals je ze liet. Ze worden bewust niet bewaard
na een herstart: een filter "van mij, CI faalt" dat een week later stilletjes
terugkomt, zou pull requests verbergen die je niet wilde verbergen.

### Wie "ik" ben

"Ik" is het account waarmee de aanroepen van deze repository zich bij de host
aanmelden — het profiel waaraan de repository is [gekoppeld](profiles.md), anders
het actieve — opgevraagd bij de host zelf. Als het token niet kan zeggen van wie
het is (geen user-scope), of er geen token is, worden **Ik**, **Van mij** en
**Wacht op mijn review** niet aangeboden.

## De lijst

| Kolom | Wat hij toont |
|---|---|
| **#** | Het nummer, met een pictogram voor open, concept, gemerged of gesloten |
| **Titel** | De titel, een *concept*-badge, en wie nog om een review is gevraagd — in de accentkleur als jij dat bent |
| **Auteur** | De afbeelding van de host als die er een geeft, anders de initiaal, en **jij** bij je eigen |
| **Branches** | Bron → doel |
| **Checks** | De checks van de head samengevat — `6/6`, `1 mislukt`, `2 bezig`; hover voor de aantallen |
| **Bijgewerkt** | Hoe lang geleden de laatste wijziging was; hover voor de datum |

De rijen zijn gesorteerd op de laatste activiteit. Een klik opent de eigen
pagina van de pull request ([Hosting & pull requests](hosting.md)). Op een host
zonder die pagina opent de rij de pull request in de browser.

In een [checkout van een fork](hosting.md#je-pull-requests-op-de-bovenliggende-repository-van-een-fork) staan ook je pull requests op
de bovenliggende repository in de lijst, gemarkeerd met *op owner/repo*.

## Vanuit een pull request door de lijst lopen

![Een pull request geopend vanuit de gefilterde lijst: ‹ 1 van 4 › en de filters waar hij vandaan kwam](../../screenshots/pull-request-nav.webp)

Een pull request die vanaf de pagina is geopend, toont een strook boven zijn
titel:

- **← Pull requests** gaat terug naar de lijst, met de filters zoals je ze liet.
- **‹ k van n ›** gaat naar de vorige of volgende pull request van de lijst
  waaruit je hem opende — de gefilterde lijst, in haar volgorde, zoals ze was op
  het moment van klikken. De tooltips noemen de pull request waar elke pijl
  heen leidt.
- **Alt+← / Alt+→** doen hetzelfde vanaf het toetsenbord. Ze zijn opnieuw toe te
  wijzen in **Instellingen → Sneltoetsen**. Ze doen niets zolang de cursor in een
  tekstveld staat (waar Option+← per woord springt) en zolang de terminal de
  focus heeft.

Verspringen vervangt de pagina ter plekke, dus door tien pull requests lopen
laat geen tien pictogrammen op het tabblad achter; een andere rij uit de lijst
openen vervangt hem ook.

Een pull request die **ergens anders** is geopend — de zijbalk, een melding —
loopt door de open pull requests van de repository in de standaardvolgorde van
de pagina (Open, geen filters). Een die ook niet op die lijst staat, zoals een
gemergede laag van een stack, toont alleen de weg terug naar de lijst.

## Naar de branch van een pull request

Om aan een pull request te werken heb je zijn branch uitgecheckt nodig — en in
een repository met duizenden branches is hem op naam zoeken in de branchlijst
het trage deel. Op de pagina van een pull request doet het veld **Branches** dat
voor je:

- **De branchnaam is een link.** Een klik checkt die branch uit en brengt je naar
  de graaf van de repository, bij de top van de branch. De pagina van de pull
  request blijft open op het tabblad.
- **Een branch die alleen op de server bestaat** wordt eerst gefetcht — alleen
  die branch, niet de hele remote — en uitgecheckt als lokale branch die hem
  volgt. Een branch die je al lokaal hebt, wordt gewisseld zoals hij is — hij
  wordt niet bijgewerkt, dus pull als je de nieuwste commits van de pull request
  wilt.
- **De branch waar je al op staat** is in plaats daarvan gemarkeerd als
  *huidig*. Er wordt niets uitgecheckt.
- **De kopieerknop** naast elke naam zet hem op het klembord.
- **Ongedaan maken** (⌘Z) gaat terug naar de branch waar je op stond en
  verwijdert de lokale branch die de checkout aanmaakte — tenzij je er sindsdien
  op hebt gecommit; dan blijft hij staan.

De kop heeft dezelfde twee stappen als knoppen: **Naar de bronbranch** en **Naar
de doelbranch**. Ze werken ook op de branch waar je al op staat — dan brengen ze
je gewoon naar de repository.

Er wordt niets opgezocht tot je klikt: een pull request openen leest of fetcht
geen enkele branch.

Wat het niet doet:

- **De bronbranch van een fork** staat in een andere repository, dus heeft hij
  geen link (de kopieerknop blijft). **Pull request lokaal bekijken…**, direct
  eronder aangeboden, is de manier om hem hier te draaien. De doelbranch blijft
  een link.
- **Geen passende remote.** De branch wordt gezocht op de remote waarvan de URL
  de repository van de pull request is. Als geen geconfigureerde remote daarheen
  wijst, doet de link niets en zegt zijn tooltip waarom.
- **Een verwijderde branch.** Een gemergede pull request heeft zijn branch vaak
  meegenomen; de fetch meldt dan dat de branch niet meer op de remote bestaat, en
  je blijft op de pull request.
- **Lokale wijzigingen.** Uitchecken is niet destructief, dus er is geen
  bevestiging — en git weigert de checkout wanneer je niet-gecommitte wijzigingen
  overschreven zouden worden. De fout noemt de bestanden; commit of stash ze en
  klik opnieuw.
- **Dit venster.** De checkout gebeurt in de werkmap van deze repository. Als de
  branch al is uitgecheckt in een andere [worktree](worktrees.md), opent in
  plaats daarvan het tabblad van die worktree.

## Beperkingen

- **Open pull requests zijn de lijst van de zijbalk.** GitHub, GitLab en
  bitbucket.org lezen de eerste 30; een repository met meer toont alleen die, en
  het aantal bij Open luidt **30+**. Azure DevOps, Bitbucket Data Center en
  Forgejo lezen ze allemaal.
- **Gemerged en gesloten zijn begrensd**, en het tabblad toont **+** als de host
  er meer heeft (zijn website toont ze allemaal):

  | Host | Wat wordt gelezen |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | De 100 meest recent bijgewerkte, gemerged en gesloten **samen** |
  | GitLab | De 100 meest recent bijgewerkte van elk |
  | Bitbucket Data Center | 100 van elk in de volgorde *newest* van de server — zijn API zegt niet of dat geopend of bijgewerkt betekent |
  | Azure DevOps | 100 van elk onder de pull requests die in het **afgelopen jaar** zijn afgerond; zijn API noemt geen volgorde, dus voorbij honderd kiest de server welke |

  Hun checks worden niet gelezen — de CI van een afgeronde pull request beslist
  niets meer, en het zou een verzoek per rij kosten — dus **CI faalt** geldt niet
  op die tabbladen (de chip is daar verborgen).
- **Geen account**: zonder een token dat de host bereikt, zeggen Gemerged en
  Gesloten dat, in plaats van een lege lijst te tonen (GitHub kan een openbare
  repository nog steeds lezen).
- **Checks**: GitHub en Bitbucket Data Center leveren ze in de lijst mee. GitLab,
  Azure DevOps en Forgejo worden bij het openen van de pagina één keer per head
  bevraagd, via dezelfde cache als de CI-badges in de graaf. bitbucket.org heeft
  er geen.
- **Reviewers**: GitHub, GitLab, Forgejo, Bitbucket Data Center en Azure DevOps
  noemen wie nog gevraagd is (Azure: een persoon die niet heeft gestemd; een team
  valt erbuiten). De lijst van bitbucket.org zegt het niet, dus het filter
  Reviewer is daar leeg.
- **Zoeken in de beschrijving** werkt waar de lijst van de host de beschrijving
  meelevert; bitbucket.org laat die soms weg, en dan worden alleen titels,
  branches en nummers doorzocht.
- **"Ik" op bitbucket.org en Azure DevOps** wordt vergeleken op weergavenaam,
  omdat hun lijsten een auteur zo noemen.
- **Bijgewerkt op Azure DevOps** is wanneer de pull request werd geopend (of
  gesloten): zijn lijst heeft geen tijd van laatste activiteit.
- Het doorlopen wordt onthouden zolang de app draait; na een herstart loopt een
  pull request die uit de lijst is geopend in plaats daarvan door de open pull
  requests.
