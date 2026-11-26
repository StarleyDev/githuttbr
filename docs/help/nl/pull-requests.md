---
title: Pull-requestspagina
category: Synchroniseren & meerdere repo's
order: 57
summary: Alle pull requests van een repository op één pagina — per status, gefilterd op auteur, reviewer, doel en CI —, ‹ › om vanuit een PR door de gefilterde lijst te lopen, zijn commits, en reacties op een regel van zijn diff.
keywords: pull requests lijst pagina merge requests pr mr filter auteur reviewer van mij wacht op mijn review review gevraagd ci faalt doelbranch concepten gemerged gesloten zoeken triage vorige volgende alt pijl navigatie checkout naar de bronbranch doelbranch branchnaam kopiëren fetch regelreactie inline reactie reviewreactie diffreactie reageren op regel tabblad bestanden code review line comment tabblad commits commitlijst pr-commits commitgeschiedenis commit openen sha kopiëren pr-branch ophalen markdown-editor werkbalk voorbeeld vermelding commits tab commit list open commit copy sha markdown editor toolbar preview mention bestandsboom mappenboom boomweergave padweergave bekeken bestanden map als bekeken markeren bewerken verwijderen bewerkt typfout file tree viewed files edit delete edited typo
source: fca6ca59b71f1a13ff0113f753b16b5f51758c15
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

## Commits

De zijbalk zei hoeveel commits een pull request heeft, nooit welke. Eén commit
tegelijk reviewen — zoals de meeste pull requests bedoeld zijn om gelezen te worden
— stuurde je naar de browser. Het tabblad **Commits**, tussen Gesprek en
Bestanden, toont ze:

- **Oudste eerst**, in de volgorde waarin ze worden toegepast, gegroepeerd onder de
  dag waarop ze zijn geschreven. Een commit die buiten de datumvolgorde is
  ingerebased, begint een eigen dag in plaats van te worden verplaatst.
- Elke rij heeft de afbeelding van de auteur (waar de host er een geeft), het
  onderwerp, de auteur, hoe lang geleden, en de korte SHA. Een **merge**-badge
  markeert een commit met twee ouders, waar de host dat zegt.
- **▸** naast een commit met meer dan een onderwerp toont de rest van zijn
  bericht.
- **Kopiëren** zet de volledige SHA op het klembord; **In de browser openen** opent
  de commit op de host — binnen de pull request waar de host zo'n pagina heeft
  (GitHub, GitLab, Bitbucket Data Center), anders op de commitpagina van de
  repository.

![Het tabblad Commits: de commits van een pull request gegroepeerd per dag, één met het volledige bericht open](../../screenshots/pr-commits.webp)

**Klik op een rij** — of ga er met Tab heen en druk op Enter — om de commit in de
app te openen, zoals een klik in de graaf zou doen: de weergave van de repository,
die commit geselecteerd, zijn details open. Dat werkt als deze clone de commit
**heeft**. Heeft hij hem niet, dan zegt de rij dat in plaats van stil te falen, en
biedt aan:

- **PR-branch ophalen om hem te zien** — dezelfde fetch van één branch als bij
  [naar de branch gaan](#naar-de-branch-van-een-pull-request), zonder de checkout. Kwam de commit mee, dan
  opent hij; kwam hij niet mee (een force push heeft hem sindsdien herschreven),
  dan zegt de melding dat.
- **In de browser openen**, voor als fetchen geen optie is.

De lijst wordt gelezen wanneer je het tabblad voor het eerst opent, niet met de
pagina, en opnieuw bij elke **Vernieuwen**. Tot hij binnen is, is het aantal op het
tabblad het aantal dat de host voor de pull request gaf. Gemergede en gesloten pull
requests tonen hun commits op dezelfde manier.

Wat het niet doet:

- **Hoogstens 250 commits.** GitHub zelf toont er voor een pull request niet meer
  dan 250; de app stopt op elke host bij hetzelfde aantal, en zegt *de host heeft er
  meer* als dat zo is, met een link naar de pull request op de host. Welke 250 het
  zijn, hangt af van de volgorde waarin de host ze toont — de app houdt de eerst
  getoonde, en de regel boven de lijst zegt welke:

  | Host | Een langere pull request toont |
  |---|---|
  | GitHub | De **eerste** 250 (de eigen grens van GitHub) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | De **250 nieuwste** |
  | Forgejo | Het eind dat de server eerst toont; zijn volgorde is niet gedocumenteerd |
- **De branch van een fork** is van hieruit niet op te halen — hij staat in een
  andere repository —, dus een commit die alleen in de fork staat, biedt alleen de
  browser aan. **Pull request lokaal bekijken…** is de manier om hem binnen te
  halen.
- **Een verwijderde branch.** Een gemergede pull request heeft zijn branch vaak
  meegenomen: de fetch zegt dat. bitbucket.org toont helemaal geen commits meer
  zodra de bronbranch weg is.
- **Squash-merges.** De commits van een met squash gemergede pull request hebben de
  doelbranch nooit bereikt, dus na het verwijderen van zijn branch staan ze alleen
  nog op de host.
- **Auteurs** worden genoemd zoals hun commits ze noemen. GitLab, Azure DevOps en
  Bitbucket Data Center geven geen afbeelding zonder een aanmelding die een
  afbeelding niet kan meesturen, dus die rijen tonen de initiaal.
- **Lange berichten op Azure DevOps** kunnen ingekort zijn: de lijst van Azure kapt
  het bericht van een commit af, en de app toont wat het stuurt.
- Pull requests op **bitbucket.org** openen in de browser — de app heeft er nog
  geen pagina voor —, dus dit tabblad wordt daar niet bereikt, hoewel de app de
  lijst wel kan lezen.

## De bestanden lezen

Een pull request met tweehonderd bestanden is lastig te lezen als tweehonderd
volledige paden. De lijst in het tabblad **Bestanden** heeft dezelfde schakelaar
**Pad / Boom** als het commitpaneel, en de keuze geldt in de hele app. In **Boom**
staan bestanden onder hun mappen (een keten als `src/main/ipc` is één rij), en elke
map toont zijn opgetelde **+/−** en hoeveel van zijn bestanden bekeken zijn (*3/5*).
Het selectievakje van een map markeert elk bestand erin als bekeken, of wist ze
allemaal; vinkjes blijven alleen op deze computer en gaan nooit naar de host. Een
vinkje onthoudt de versie van de diff van het bestand: als een push een bekeken
bestand wijzigt, geldt het weer als niet bekeken, met een gele stip (*Gewijzigd sinds
je het bekeek*). Een bestand zonder diff (binair, te groot) wordt alleen op status en
regelaantallen vergeleken. Klik op een map, of druk erop op ←/→, om hem in te klappen;
↑/↓ (of j/k) lopen door de bestanden op het scherm en openen elke diff. Ingeklapte
mappen worden per pull request onthouden tot de app sluit, en een bestand dat erin
wordt geopend, klapt de weg ernaartoe uit. De boom is op naam gesorteerd, niet in de
volgorde waarin de host de bestanden toont.

![Het tabblad Bestanden in boomweergave: mappen met hun opgetelde wijzigingen en bekeken-aantallen, één ingeklapt](../../screenshots/pr-files-tree.webp)

## Reageren op een regel

Antwoorden op een reviewthread kon hier al; er een beginnen niet, dus een echte
review stuurde je nog steeds naar de browser. In het tabblad **Bestanden** van een
pull request neemt elke regel van de diff een eigen reactie aan:

- **Hover over een regel** en druk op de **+** die boven zijn nummer verschijnt, of
  **klik op de regel** zelf (een klik die een tekstselectie afsluit, of een
  dubbelklik die een woord selecteert, telt niet — dat is lezen). Het
  rechtermuisknopmenu — of de contextmenutoets van het toetsenbord — heeft ook
  *Reageren op regel N*.
- Er opent een vak **onder die regel**. Schrijf, dan **Reageren** — of
  ⌘/Ctrl+Enter. **Annuleren** sluit het; **Esc** ook, met eerst een vraag als er al
  iets getypt is. Hoe dan ook gaat de focus terug naar die regel.
- Als het lukt, verschijnt de nieuwe thread **onder zijn regel**, en in de
  reviewthreads van het tabblad Gesprek, waar iedereen hem ziet.

![Een reactie die onder een gewijzigde regel wordt geschreven, met een eerdere thread onder zijn eigen regel](../../screenshots/pr-line-comment.webp)

Aan welke kant de reactie terechtkomt, volgt de regel:

| Regel | Verankerd aan |
|---|---|
| **Toegevoegd** (groen) | De nieuwe versie van het bestand, op het nieuwe nummer |
| **Verwijderd** (rood) | De oude versie, op het oude nummer |
| **Ongewijzigd** | De nieuwe versie (GitLab krijgt beide nummers, zoals het vereist) |

Bestaande threads worden ook onder hun regels getoond, met hun antwoordvak waar de
host de app laat antwoorden binnen een thread (Forgejo niet). Een thread wordt alleen
bij een regel getoond als de host zegt dat hij nog bij de getoonde diff hoort; al het
andere blijft in het tabblad Gesprek, in plaats van bij een gegokte regel:

| Host | Een thread van vóór de laatste push |
|---|---|
| GitHub | Verouderd als zijn regel veranderde: alleen Gesprek |
| GitLab | Geschreven op een oudere head: alleen Gesprek |
| Azure DevOps | Door Azure gevolgd naar waar zijn regel nu staat |
| Bitbucket Data Center | Verweesd als zijn regel weg is: alleen Gesprek |
| Forgejo | Forgejo zegt niet dat een reactie verouderd is, dus wordt hij getoond op het opgeslagen regelnummer — na een push kan op die regel nu andere code staan |

Een reactie op een regel buiten de getoonde hunks staat op elke host alleen in het
tabblad Gesprek.

Een getypte, niet verstuurde reactie telt als onverzonden tekst: **‹ ›** en
Alt+pijlen vragen het eerst voordat ze hem verlaten, net als bij het hoofdvak voor
reacties. Een ander bestand bekijken houdt hem vast; om er een op een andere regel te
beginnen, plaats of annuleer je eerst de eerste.

Wat het niet doet:

- **Eén regel, meteen geplaatst.** Er is geen regelbereik, geen openstaande review om
  reacties in te verzamelen en later in te dienen, en geen voorgestelde wijziging.
  Elke reactie wordt geplaatst op het moment dat je hem verstuurt, als eigen thread
  (op Forgejo als review met alleen die ene reactie, omdat Forgejo geen aanroep voor
  een losse reactie heeft).
- **De diff waar je naar kijkt.** Het tabblad Bestanden onthoudt op welke commit (op
  Azure DevOps: welke iteratie) zijn diff is gelezen, en de reactie wordt daartegen
  verstuurd. Is de pull request sindsdien verder gegaan — een push, een nieuwe
  merge-basis —, dan wordt de reactie niet geplaatst op de regel die nu dat nummer
  heeft: hij wordt geweigerd met *de pull request is veranderd sinds deze diff werd
  geladen*, en **Vernieuwen** toont de nieuwe diff. Op GitHub wordt de reactie in
  plaats daarvan geplaatst op de commit die je las, en GitHub markeert hem als
  verouderd als die regel veranderd is. Een regel die de host nog steeds niet
  aanneemt, wordt geweigerd als buiten de diff.
- **Geweigerd.** Zonder recht om te reageren (een token met alleen leesrechten, een
  account dat in de repository niet mag reageren) weigert de host, en de melding
  zegt dat dat de reden is.
- Pull requests op **bitbucket.org** openen in de browser — de app heeft er nog geen
  pagina voor —, dus daar plaats je een regelreactie nog steeds op de website.
- **Een bestand zonder diff** (binair, of te groot voor de host om mee te sturen)
  heeft geen regels om op te reageren.

## Reacties schrijven

Elk vak op de pagina — de reactie onderaan, een antwoord in een thread, een reactie
op een regel — is dezelfde Markdown-editor: tabbladen **Schrijven / Voorbeeld**,
een opmaakbalk met de sneltoetsen van GitHub, lijsten die doorgaan bij Enter, en
aanvulling met **@** / **#** uit de mensen en pull requests die al op het scherm
staan. Een antwoordvak toont zijn gereedschap zodra je erin klikt, en verstuurt met
⌘/Ctrl+Enter, omdat Enter nu een nieuwe regel begint.
[Reacties schrijven](writing-comments.md) heeft de details en de beperkingen.

## Je reacties bewerken en verwijderen

Een typfout in een al verstuurde reactie, of een opmerking die niet meer klopt,
betekende vroeger een uitstapje naar de browser. Je eigen reacties hebben nu
**Bewerken** (het potlood) en **Verwijderen** (de prullenbak) aan het eind van hun
kop: reacties in het gesprek, reacties in reviewthreads en antwoorden, in de
tabbladen Gesprek en Bestanden. De issuepagina heeft ze ook, voor haar reacties op
GitHub en Forgejo.

![Je eigen reactie, gemarkeerd als bewerkt, met Bewerken en Verwijderen aan het eind van de kop](../../screenshots/comment-editor.webp)

Wat "van jou" is, beslist de pagina zelf: die vraagt de host bij elk laden als wie de
aanroepen van deze repository zich aanmelden (het gekoppelde profiel, niet het profiel
dat toevallig actief is). De meeste hosts noemen een auteur bij login, vergeleken
zonder op hoofdletters te letten. Azure DevOps noemt auteurs bij weergavenaam, die
twee mensen kunnen delen, dus daar moet het auteurs-id van de reactie overeenkomen
met het id van het account; ontbreekt een van beide, dan toont geen enkele reactie de
acties. Kan de app niet zeggen wie je bent (een token zonder user-scope, of de host
antwoordde niet), dan toont ook geen reactie ze; **Vernieuwen** vraagt het opnieuw.
De host beslist nog steeds: een account dat hij een reactie niet laat wijzigen,
wordt geweigerd, en de melding zegt dat.

- **Bewerken** opent de reactie ter plekke, in dezelfde Markdown-editor, met de
  tekst zoals die geschreven is. **Opslaan** (of ⌘/Ctrl+Enter) verstuurt hem;
  **Annuleren** of **Esc** sluit hem, met eerst een vraag als je iets veranderde.
  Alleen de lege regels rond de tekst vallen weg: ingesprongen code en een regeleinde
  van twee spaties aan het eind blijven zoals getypt. De nieuwe tekst verschijnt
  meteen en de pagina leest de pull request opnieuw. Op de pull-requestspagina telt
  een niet-opgeslagen bewerking als onverzonden tekst: **‹ ›** vragen het eerst
  voordat ze haar verlaten. De issuepagina heeft zulke pijlen niet, en daar vraagt
  niets iets voordat haar tabblad sluit.
- **Verwijderen** vraagt het altijd eerst, en de vraag zegt wat er gebeurt: de server
  verwijdert de reactie voor iedereen, en dat kan niet ongedaan worden gemaakt. Er is
  geen ongedaan-maakitem, omdat niets haar kan terugbrengen.

De **eerste reactie van een thread** met antwoorden verwijderen (een reviewthread,
of een reactie in het gesprek waarop anderen antwoordden) verschilt per host, en de
bevestiging zegt welk geval het is. Twee daarvan zijn niet door de host
gedocumenteerd, en dat staat er ook bij:

| Host | Eerste reactie van een thread met antwoorden |
|---|---|
| GitHub | De antwoorden zouden moeten blijven; de documentatie van GitHub zegt het niet. Vanuit de app op die thread antwoorden kan daarna niet meer: zijn antwoorden wijzen naar een reactie die weg is, en de API neemt geen antwoord op een antwoord aan. De thread biedt dan **Antwoorden op GitHub** aan |
| GitLab | Alleen die notitie verdwijnt; de thread en zijn antwoorden blijven |
| Azure DevOps | Zou als verwijderd gemarkeerd en verborgen moeten worden, met behoud van de thread en zijn antwoorden; de documentatie van Azure zegt het niet |
| Bitbucket Data Center | Geweigerd: Data Center verwijdert geen reactie met antwoorden. Verwijder eerst de antwoorden, of bewerk haar in plaats daarvan |

Sommige hosts markeren een reactie als **bewerkt**. Alleen Azure DevOps houdt een
datum bij voor alleen de tekst; op GitHub, Bitbucket Data Center en Forgejo vergelijkt
de app wanneer de reactie is gemaakt en voor het laatst bijgewerkt, dus daar is de
markering een benadering (al het andere dat de reactie aanraakt, kan haar zetten). De
datum van GitLab verschuift ook wanneer een thread wordt opgelost, dus die wordt niet
gebruikt.

Wat het niet doet:

- **Reviewreacties op Forgejo** (reacties op een regel) kunnen niet via zijn API
  worden bewerkt, en alleen sommige versies kunnen er een verwijderen, dus ze tonen
  geen van beide acties: wijzig ze op de website. Reacties in het gesprek werken
  zoals elders.
- **Iemand heeft haar intussen gewijzigd.** Bitbucket Data Center controleert de
  versie van de reactie: een bewerking of verwijdering van een reactie die is
  veranderd sinds de pagina laadde, wordt geweigerd, en **Vernieuwen** toont de
  huidige. De andere hosts nemen de laatste schrijfactie.
- **Niet gevonden**: als de host de reactie niet vindt, zegt de melding dat ze
  misschien is verwijderd, of dat dit account haar niet kan zien, en de pagina leest
  de pull request opnieuw. Een open bewerking van een reactie die weg is, vervalt.
- Pull requests op **bitbucket.org** openen in de browser, dus er is nog geen pagina
  om hun reacties te bewerken, hoewel de app de aanroep kan doen.
- **De beschrijving** van de pull request en de samenvattingen van zijn reviews zijn
  geen reacties, en worden hier niet bewerkt.

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
