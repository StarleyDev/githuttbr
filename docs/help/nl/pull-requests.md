---
title: Pull-requestspagina
category: Synchroniseren & meerdere repo's
order: 57
summary: Alle pull requests van een repository op één pagina — per status, gefilterd op auteur, reviewer, doel en CI —, ‹ › om vanuit een PR door de gefilterde lijst te lopen, zijn commits, zijn updates (elke push, wat die veranderde, wat nieuw is sinds je laatste bezoek), en reacties op een regel van zijn diff.
keywords: pull requests lijst pagina merge requests pr mr filter auteur reviewer van mij wacht op mijn review review gevraagd ci faalt doelbranch concepten gemerged gesloten zoeken triage vorige volgende alt pijl navigatie checkout naar de bronbranch doelbranch branchnaam kopiëren fetch regelreactie inline reactie reviewreactie diffreactie reageren op regel tabblad bestanden code review line comment tabblad commits commitlijst pr-commits commitgeschiedenis commit openen sha kopiëren pr-branch ophalen markdown-editor werkbalk voorbeeld vermelding commits tab commit list open commit copy sha markdown editor toolbar preview mention bestandsboom mappenboom boomweergave padweergave bekeken bestanden map als bekeken markeren bewerken verwijderen bewerkt typfout file tree viewed files edit delete edited typo verwijzing titel hoverkaart work item AB# issuenummer tooltip reference title hover card issue number fork pr-commits refs/pull head weergegeven reacties afbeeldingen trackingpixel geblokkeerde afbeelding klik om te laden taak tabel blok rendered comments images blocked image updates iteraties pushes force push rebase geschiedenis herschreven diffversies wat is er veranderd sinds het laatste bezoek nieuw-badge markeren als gezien update vergelijken iterations history rewritten diff versions what changed since last visit new badge mark as seen compare update
source: d91d96af92225cb74da274f8d168b07f6110b709
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
je gewoon naar de repository. Met [pictogramkleuren](themes.md#pictogramkleuren) aan heeft elke knop in de kop zijn eigen kleur: vernieuwen blauw, AI-review violet, voorbeeld turquoise, bronbranch groen, doelbranch oranje (in de browser openen blijft grijs).

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
— stuurde je naar de browser. Het tabblad **Commits**, tussen Gesprek en Updates, toont ze:

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
- **Commits van de pull request ophalen**, bij een pull request uit een **fork**. Zijn
  branch staat in een andere repository, maar de meeste hosts spiegelen de head van
  een pull request in de doelrepository onder een eigen ref — `refs/pull/N/head`
  (GitHub, GitHub Enterprise Server, Forgejo), `refs/merge-requests/N/head`
  (GitLab), `refs/pull-requests/N/from` (Bitbucket Data Center). De app fetcht die
  ene ref, zonder tags, naar een eigen ref, `refs/githuttbr/pr/<remote>/N`, en de
  commit opent zoals elke andere: de graaf tekent die head als een baan zonder label.
  Opnieuw fetchen zet de ref op de head zoals die dan is. Heeft de force push
  sindsdien de commit weggelaten, dan zegt de melding dat.
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
- **De head van een fork waar de host hem niet spiegelt.** Azure DevOps publiceert
  alleen een mergeresultaat, nooit de eigen head van een pull request, en
  bitbucket.org geen van beide: daar biedt de rij alleen de browser aan. Op een
  andere host die hem toch niet blijkt te spiegelen, zegt de fetch dat.
  **Pull request lokaal bekijken…** haalt het mergeresultaat van Azure binnen, als je
  dat nodig hebt.
- **De gefetchte heads blijven.** `refs/githuttbr/pr/…` is geen branch: niets om uit
  te checken of te pushen, een fetch met prune laat ze met rust, en git houdt hun
  commits. Niets verwijdert ze ook — niet het sluiten van de pagina en ook niet
  [Branches opruimen](branch-cleanup.md). Om ervan af te komen, verwijder je de refs
  met de hand: `git for-each-ref refs/githuttbr/pr` toont ze, en
  `git update-ref -d <ref>` verwijdert er een.
- **Een remote waarvan de naam een `/` bevat** kan geen deel van de naam van die ref
  zijn, dus daar wordt de fetch geweigerd.
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

## Updates

Een pull request die je maandag reviewde, is donderdag verder. Het tabblad Commits
toont waar hij nu staat, niet wat er sindsdien gebeurde: welke commits met welke push
kwamen, of iemand force-pushte en herschreef wat je al gelezen had, en hoe de code
eruitziet *vergeleken met de versie die jij zag*. Het tabblad **Updates**, tussen
Commits en Bestanden, beantwoordt dat — zoals het eigen Updates-tabblad van Azure
DevOps.

Het toont elke push naar de pull request, **nieuwste eerst**:

- **Update 1 — geopend** is de push waarmee de pull request werd geopend; elke latere
  push krijgt het volgende nummer.
- Elke update toont **wanneer**, **wie pushte** (waar de host dat zegt), en de
  **toegevoegde commits** — korte SHA, onderwerp, auteur. Waar de host commits meldt
  die een push van de branch haalde, staan ze onder **Verwijderde commits**,
  doorgestreept.
- Een force push of rebase is gemarkeerd als **geschiedenis herschreven**: commits die
  je had gelezen kunnen weg zijn, en de getoonde kunnen nieuwe kopieën van oud werk
  zijn. Op Azure DevOps is een push die de pull request naar een andere doelbranch
  verplaatste, gemarkeerd als **doel gewijzigd**.

![Het tabblad Updates: pushes nieuwste eerst, een force push gemarkeerd als „geschiedenis herschreven”, een als Nieuw](../../screenshots/pr-updates.webp)

### Wat er in één update veranderde

**Wijzigingen in deze update bekijken** opent het tabblad Bestanden voor alleen die
push: de diff van de head van de vorige update naar deze — of, voor Update 1, vanaf
de doelbranch waartegen hij werd geopend, waar de host dat punt noemt (Azure DevOps,
GitLab). Dezelfde bestandsboom en viewer, met een banner — *Wijzigingen in Update 3
(ten opzichte van Update 2)* — en **Alle wijzigingen tonen** om terug te gaan naar de
hele pull request.

![Het tabblad Bestanden met de wijzigingen van één update, met de banner boven de bestandsboom](../../screenshots/pr-update-diff.webp)

De diff wordt altijd **in deze clone** gemaakt als het kan: `git diff` tussen de twee
heads, exact en zonder de host te vragen. Ontbreekt een van de heads, dan fetcht de
app eerst beide **op hun commit-id** van de remote van de pull request — er wordt geen
branch, tag of ref geschreven; een head die een force push verving, staat op geen
branch meer, maar de meeste hosts leveren hem nog op zijn id — en vergelijkt hier.
Pas als die fetch mislukt, wordt de host gevraagd:

| Host | De vergelijking van de host |
|---|---|
| Azure DevOps | De wijzigingen van de iteratie met `$compareTo` — tussen de twee pushes |
| GitLab | De repositoryvergelijking, rechtstreeks van de ene head naar de andere |
| Bitbucket Data Center | De repositoryvergelijking — **vanaf de gemeenschappelijke basis** van de twee heads |
| GitHub | De compare-API (`base...head`) — **vanaf de gemeenschappelijke basis** van de twee heads |
| Forgejo / Gitea | Geen: hun API heeft geen diff tussen twee commits |

Vanaf de gemeenschappelijke basis is de diff van een herschrijving niet wat de push
deed: wat hij verwijderde, wordt niet getoond, en wijzigingen die de doelbranch
sindsdien kreeg, kunnen eruitzien als die van de pull request. De banner zegt dat —
*Vergeleken vanaf de gemeenschappelijke basis: wat deze push verwijderde, wordt niet
getoond.* — als een update met herschreven geschiedenis zo is vergeleken. Werkt niets,
dan zegt de banner dat en biedt aan de branch (of, vanuit een fork, de head van de pull
request) te fetchen en hier te vergelijken.

Regelreacties horen bij de diff van de hele pull request, dus er is geen **+** op een
regel zolang één update wordt getoond; de banner zegt dat. Een bestand als bekeken
aanvinken werkt zoals gewoonlijk — het markeert het bestand in de pull request.

### Nieuw sinds je laatste bezoek

Updates die zijn gepusht sinds je het tabblad voor het laatst opende, dragen een badge
**Nieuw**, en het tabblad zelf zegt hoeveel: *Updates 5 · 2 nieuw*. Het tabblad openen
markeert ze als gezien (de badges blijven zolang je erop staat, zodat je ziet welke
nieuw waren); brengt **Vernieuwen** er meer terwijl het tabblad open is, dan haalt
**Markeren als gezien** ze weg. Alleen de pull-requestspagina openen markeert niets.
De eerste keer dat je het tabblad Updates van een pull request opent, is niets nieuw —
er is geen eerder bezoek om mee te vergelijken.

De updates worden met de pagina gelezen, voor dat aantal, en opnieuw bij
**Vernieuwen** — niet na elke reactie of review die je plaatst.

Wat gezien is, wordt alleen op deze computer bewaard, per repository en pull request,
en nooit naar de host gestuurd.

### Per host

| Host | Waar de updates vandaan komen | Wie pushte | Verwijderde commits | Herschrijving herkend |
|---|---|---|---|---|
| Azure DevOps | De **iteraties** van de pull request — Azures eigen registratie van elke push | Ja | Nee (niet gemeld) | Ja: `forcePush` / `rebase` |
| GitLab | De **diffversies** van de merge request; de commits van elke versie afgeleid uit haar head | Nee (versies noemen niemand) | Ja | Ja: een eerdere head die niet meer bereikt wordt |
| Bitbucket Data Center | De activiteit van de pull request: **OPENED** en elke **RESCOPED** die de bronbranch verplaatste | Ja | Ja, met de totalen van de host | Ja: een rescope die commits verwijderde |
| GitHub | **Afgeleid** uit de commits en force pushes van de tijdlijn — zie hieronder | Alleen force pushes | Nee | Ja: een force-push-gebeurtenis |
| Forgejo / Gitea | De **push**-items van de tijdlijn, het eerste geschreven met de pull request zelf | Ja | Nee | Ja: een force-push-item |
| bitbucket.org | Niet beschikbaar | — | — | — |

**GitHub houdt geen gewone push bij** — alleen force pushes —, dus de updates worden
**afgeleid uit commitmomenten**. Een update is een reeks commits die op elkaar
voortbouwen, tussen force pushes; een commit die niet op de vorige voortbouwt, of meer
dan tien minuten na de vorige komt, begint de volgende. Een commit die na het openen
van de pull request is gemaakt, kan niet in de opening hebben gezeten. Een push van
commits die een uur uit elkaar liggen, verschijnt dus **gesplitst** in tweeën, en twee
pushes die een paar minuten uit elkaar liggen, verschijnen als **één**; het tabblad
zegt dat de groepering bij benadering is. De nieuwe commits van een rebase, die de
tijdlijn mogelijk vlak voor de force push toont, tellen mee bij die force push. De
heads vóór en na een force push zijn exact, dus zijn **Wijzigingen bekijken** ook.

### Beperkingen

- **Limieten.** De 100 nieuwste updates worden getoond. De tijdlijn van GitHub wordt
  vanaf het nieuwste eind gelezen, tot 500 items; de activiteit van Bitbucket Data
  Center (ook nieuwste eerst) tot 1.000; de versies en commits van GitLab tot 300
  elk; de tijdlijn van Forgejo tot 500 items, de nieuwste als ze langer is. Als een
  limiet de **opening** afkapt, zijn de nummers niet meer die van de host: het tabblad
  zegt dat en telt terug vanaf de nieuwste (*Nieuwste update*, *Update, 2 vóór de
  nieuwste*).
- **Azure DevOps** meldt geen verwijderde commits; in plaats daarvan wordt een force
  push of rebase gemarkeerd. Een iteratie waarvan Azure de commitlijst inkort, wordt
  apart gelezen (tot 500 commits), en de update zegt het als ze nog onvolledig is.
- **GitLab** noemt niet wie pushte. Een versie waarvan de head is weggeschreven, wordt
  apart gelezen om haar commits te vinden — voor de tien nieuwste zulke versies —, één
  keer per sessie: versies veranderen nooit.
- **Forgejo en Gitea** tonen geen commits voor een force push — alleen de twee heads,
  en die vergelijkt **Wijzigingen bekijken** —, en na een force push zegt niets wat de
  opening bevatte, dus die blijft leeg, tenzij de server de push van de opening zelf
  heeft vastgelegd. Hun API heeft geen diff tussen twee commits, dus die vergelijking
  heeft beide commits in deze clone nodig. Een server zonder de tijdlijn-API toont alle
  commits in één update.
- **Fetchen op id** vraagt een host die een commit op zijn id levert. GitHub doet dat
  voor elke commit die het nog heeft; een andere host, of een eenvoudige git-server,
  kan een commit weigeren waar geen branch naar wijst — dan wordt de vergelijking van
  de host gebruikt. Gefetchte commits staan zonder ref in deze clone, en git ruimt ze
  op den duur op.
- **De vergelijking van Bitbucket Data Center** leest de gestructureerde diff van de
  server en tekent die als unified diff; zeer grote bestanden kunnen ingekort
  terugkomen.
- Een herschreven head kan definitief **van de host verdwenen** zijn (Azure en GitLab
  bewaren hem; andere ruimen hem mogelijk op). Dan kan geen van beide kanten
  vergelijken, en de banner zegt dat.
- Pull requests op **bitbucket.org** openen in de browser en hebben geen tabblad
  Updates.

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
regelaantallen vergeleken. Een bestand met reviewgesprekken toont ernaast een aantal in een tekstballon (mappen tellen het hunne op), zodat de bestanden met reacties opvallen in een lange lijst; verouderde gesprekken tellen mee. Klik op een map, of druk erop op ←/→, om hem in te klappen;
↑/↓ (of j/k) lopen door de bestanden op het scherm en openen elke diff. Ingeklapte
mappen worden per pull request onthouden tot de app sluit, en een bestand dat erin
wordt geopend, klapt de weg ernaartoe uit. De boom is op naam gesorteerd, niet in de
volgorde waarin de host de bestanden toont.

![Het tabblad Bestanden in boomweergave: mappen met hun opgetelde wijzigingen en bekeken-aantallen, één ingeklapt](../../screenshots/pr-files-tree.webp)

**Afbeeldingen.** Een afbeelding die de pull request toevoegt, verwijdert of wijzigt
(png, jpg, gif, webp, bmp, ico, avif, svg) heeft geen tekstdiff om te lezen, dus het
tabblad toont in plaats daarvan de afbeelding — dezelfde weergave als bij een commit:
de nieuwe, de oude, of voor en na naast elkaar en als schuifregelaar. Een hernoemde
afbeelding vergelijkt haar oude pad op de basis met het nieuwe op de head; in de diff
van één update de twee heads van de update. De bytes komen uit deze clone als die de
commits heeft — gratis en snel —, en anders van de host met het profiel van de
repository. Beperkingen: een afbeelding boven 32 MB krijgt geen voorbeeld;
regelreacties gelden niet voor een afbeelding (een SVG houdt zijn tekstdiff, en de
reacties, eronder); een afbeelding in **Git LFS** wordt van de host gelezen, omdat een
clone alleen de pointer heeft — GitLab, Azure DevOps en Forgejo lossen die op, terwijl
de API van GitHub alleen de pointer geeft, dus daar stuurt het tabblad je naar de host;
waar de host de merge-basis niet noemt (hij valt terug op de top van de doelbranch),
zegt een notitie dat het „voor” latere wijzigingen op het doel kan bevatten; en als
noch de clone noch de host de bytes kan geven, zegt het tabblad dat en biedt aan de
branch van de pull request te fetchen of hem op de host te openen.

![Een afbeelding die de pull request wijzigde, voor en na naast elkaar](../../screenshots/pr-image-diff.webp)

**Paden en je editor.** De balk boven de diff heeft een kopieerknop voor het pad van
het bestand en een menu **⋯**; rechtsklikken op een bestand of map in de lijst opent
hetzelfde menu. Het kopieert het pad, het oude pad van een hernoemd bestand of dat van
de map; en het opent het bestand in je [editor](editor.md) (of een andere app) of toont
het in de bestandsbeheerder. Die twee werken op **je werkkopie**, niet op de versie van
de pull request: ze zijn alleen actief voor een bestand dat daarin bestaat (een bestand
dat de PR verwijdert, of een dat je branch niet heeft, zegt waarom), en als de
uitgecheckte branch niet die van de PR is, zegt het menu welke branch je zou openen.

**Terugkomen.** Verlaat een pull request voor de repository, een ander tabblad of de
volgende PR, en hij staat zoals je hem liet wanneer je terugkomt: hetzelfde tabblad,
hetzelfde geopende bestand, dezelfde scrollpositie, en alle tekst die je nog niet had
verstuurd — de reactie, een antwoord, een regelreactie, een bewerking. Dit duurt tot je
de pull request sluit of de app afsluit; het wordt alleen in het geheugen bewaard, voor
de 50 meest recente pull requests (daarboven wordt de oudste plek losgelaten, en tekst
die daar stond, verhuist naar de volgende pull-requestspagina die je opent). Een PR met
onverzonden tekst sluiten vraagt het eerst. Als een vernieuwing ontdekt dat de plek van
een concept weg is — het gesprek waarop het antwoordde, de reactie die het bewerkte, het
bestand waar het bij hoorde —, gaat de tekst niet verloren: hij wacht bovenaan de pagina
om gekopieerd of weggegooid te worden.

### Waar de diff vandaan komt

Een review is zo goed als de diff die hij leest. De API van een host is daar geen goede
bron voor: Azure DevOps stuurt helemaal geen diff, alleen de lijst met bestanden, en
elk bestand moet twee keer worden opgehaald en vergeleken; GitHub stopt bij 3000
bestanden en laat de patch van een groot bestand weg; GitLab markeert een grote diff als
*te groot* en stuurt niets. Daarom leest het tabblad Bestanden **eerst deze clone**, op
elke host:

1. Het vraagt de host om de twee commits van de pull request — waar hij begint en zijn
   head. Azure DevOps, GitLab en Forgejo noemen de merge-basis; Bitbucket Data Center
   noemt de basis van de diff waaraan zijn regelreacties zijn verankerd; GitHub noemt
   alleen de doelbranch, waarvan de merge-basis met de head dan hier wordt bepaald (of,
   zonder de commits, met de compare van GitHub). Het afbeeldingsvoorbeeld gebruikt
   dezelfde twee commits.
2. Als beide hier zijn, geeft `git diff` ertussen elk bestand, zonder limiet op het
   aantal. Het zijn dezelfde twee commits die de eigen pagina van de host vergelijkt,
   dus een regelnummer hier is het regelnummer daar en een regelreactie belandt waar je
   hem plaatst.
3. Als ze hier niet zijn, worden ze **op hun id** van de remote van de pull request
   gefetcht — alleen objecten, er wordt geen branch gemaakt of verplaatst —, één keer,
   wanneer de pagina opent (en opnieuw bij Vernieuwen), met *De commits van de pull
   request worden opgehaald…* boven de lijst in de tussentijd. Een server die geen
   commit op id uitlevert (sommige Azure DevOps- en eenvoudige git-servers), wordt
   stilletjes overgeslagen.
4. Pas dan wordt de API van de host gebruikt, en een bestand waarvoor die geen diff
   geeft, zegt waarom in plaats van te doen alsof het leeg is (hieronder).

Een bestand dat later wordt gelezen — geopend terwijl het *nog niet geladen* was, of na
**Opnieuw proberen** — voegt zich in de lijst zoals de andere: dezelfde viewer, en
regelreacties erop.

Op Azure DevOps leest de API-route bij het openen van het tabblad de eerste honderd
bestanden, drie tegelijk en in totaal binnen een minuut, en de rest wanneer je elk
bestand opent. Een afgeremd verzoek pauzeert elke leesactie tot de wachttijd die de
server vraagt; een die toch mislukt, zegt dat, met de reden. Of een bestand tekst is,
wordt bepaald aan de hand van zijn bytes, niet van Azures eigen vlag *binary* — die het
ook zet op UTF-16-bestanden en op sommige tekst die geen ASCII is. Als de host minder
bestanden toont dan de pull request heeft (GitHub stopt bij 3000), zegt een regel boven
de lijst dat.

### Als een bestand geen diff toont

| Wat het zegt | Waarom | Wat je kunt doen |
|---|---|---|
| **Binair** | De bytes zijn geen tekst: een afbeelding, een archief. UTF-16 en oude één-bytetekst worden als tekst herkend. | Openen op de host. |
| **Te groot om te tonen** | Meer dan 20.000 gewijzigde regels of 8 MB diff, of een versie boven 4 MB. De **+/−** wordt toch geteld als de clone het las. | Openen op de host. |
| **Nog niet geladen** | Voorbij wat één leesactie bewaart (zo’n 150.000 regels diff), of, via de API van Azure DevOps, voorbij de eerste honderd bestanden of de minuut. | Het laadt wanneer je het opent; **Diff laden** als dat niet gebeurde. |
| **Kon niet laden** | Het lezen mislukte — de reden staat eronder. | **Opnieuw proberen**. |
| **De host liet het weg** | De API van de host stuurde geen diff en deze clone heeft de commits van de pull request niet. | **Pull request ophalen om hem lokaal te zien** — de commits op id, of de head van de pull request van een fork —, dan wordt hier vergeleken. |
| **Alleen de naam of modus veranderde** | Een hernoeming of een rechtenwijziging: de inhoud is dezelfde. | Niets te reviewen in de inhoud. |
| **Codering veranderd** | Dezelfde tekst anders opgeslagen: een byte-ordermarkering toegevoegd of verwijderd, UTF-16 omgezet naar UTF-8. | Controleren of de wijziging bedoeld is — sommige tools letten erop. |

In de lijst toont een bestand waarvan de diff niet is gelezen — nog niet geladen, kon
niet laden, door de host weggelaten — **—** in plaats van **+0 −0**, wat zou lezen als
„niets veranderd”. Een binair bestand en een pure hernoeming tonen hun echte **+0 −0**,
en als de host de regels toch telt (GitHub doet dat, zelfs voor een patch die het
weglaat), worden de aantallen getoond.

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

Een getypte, niet verstuurde reactie blijft bij de pull request, net als de tekst van
het hoofdreactievak: **‹ ›**, Alt+pijlen of een ander tabblad laten hem waar hij is, en
hij staat weer bij zijn regel als je terugkomt (zie *Terugkomen* hierboven). Een ander
bestand bekijken houdt hem vast; om er een op een andere regel te beginnen, plaats of
annuleer je eerst de eerste.

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

## Hoe reacties worden getoond

Mensen schrijven reacties in Markdown, dus een reactie die als platte tekst wordt
getoond, staat vol `**`, `- [ ]` en codehekken. De beschrijving, het gesprek en de
reviewthreads (in de tabbladen Gesprek en Bestanden) worden als Markdown getekend:
koppen, lijsten en takenlijsten, tabellen, citaten, codeblokken gemarkeerd in de taal
die het hek noemt, links en afbeeldingen. De issuepagina tekent haar tekst op dezelfde
manier. `#123`, `AB#123`, `!123` en `@user` in de tekst worden nog steeds links, met
de [kaart](#waar-een-123-of-ab123-over-gaat) waar ze er een hadden.

![Een weergegeven reactie: een tabel, een afbeelding van een andere site achter haar plaatshouder gehouden, en een gemarkeerd codeblok](../../screenshots/pr-rendered-comment.webp)

Waar de weergave vandaan komt:

| Host | Weergegeven door |
|---|---|
| GitHub, GitHub Enterprise Server | GitHub zelf (`body_html`): vermeldingen en verwijzingen zijn gelinkt zoals op de website, afbeeldingen gaan via de afbeeldingsproxy van GitHub, en privébijlagen dragen hun ondertekende adres |
| GitLab, Forgejo, Azure DevOps, Bitbucket Data Center | De app, uit de Markdown van de reactie. Een relatieve link wijst in de repository; op GitLab wijst `/uploads/…` in het project, zoals GitLab dat doet |

Een reactie is inhoud van anderen, dus wat ze mag bevatten is beperkt, en beperkter
dan voor je eigen bestanden: een expliciete lijst tags, links en afbeeldingen alleen op
`https:`, `http:` of `mailto:`, geen scripts, frames, formulieren, SVG of inline
stijl, en links die nooit in de app opengaan (ze gaan naar je browser). Een
selectievakje in een takenlijst wordt getoond, maar is niet aanklikbaar: het hier
aanvinken zou op de host niets veranderen.

**Afbeeldingen van andere sites wachten op een klik.** Een afbeelding laden is een
verzoek dat de site erachter kan zien, met je IP-adres en het moment waarop je de
reactie leest — iedereen die mag reageren, kan daar een trackingpixel neerzetten.
Daarom laden alleen afbeeldingen van de host zelf vanzelf: op github.com zijn
bijlagen, `*.githubusercontent.com` (inclusief zijn afbeeldingsproxy) en zijn
assets; op elke andere host zijn eigen adres. Elke andere afbeelding toont
*Afbeelding van example.net — klik om te laden*, en de klik laadt die ene afbeelding.
**Instellingen → Beveiliging → Afbeeldingen van andere sites in reacties laden** zet
dat uit; zie [Beveiliging](security.md#afbeeldingen-in-reacties).

**Het voorbeeld toont wat er geplaatst wordt.** Op deze pagina en de issuepagina
tekent het tabblad **Voorbeeld** van elk reactievak de tekst op dezelfde manier:
hetzelfde profiel, dezelfde regeleinden, dezelfde achtergehouden afbeeldingen — een
geplakte link naar een externe afbeelding laadt die niet terwijl je schrijft. De
dialoogvensters voor een nieuwe pull request en een nieuw issue houden het gewone
Markdown-voorbeeld van de app.

**Te lang of te ingewikkeld wordt als tekst getoond.** Markdown wordt in het venster
van de app weergegeven, en sommige tekst kost veel meer om weer te geven dan de
grootte doet vermoeden. Een reactie van meer dan **32.000 tekens**, of een die zo is
opgebouwd dat ze de renderer vastzet (duizenden ongepaarde `_` of `*` in één alinea,
of meer dan 32 niveaus `>` of lijstmarkeringen op één regel), wordt als platte tekst
met links getoond, onder *Lange reactie als platte tekst getoond.* of *Reactie als
platte tekst getoond: te ingewikkeld om hier weer te geven.* Een reactie die toch niet
kan worden weergegeven, valt vanzelf op dezelfde manier terug: de rest van de pagina
blijft onaangeroerd.

Wat het niet doet:

- **Bij bewerken staat de tekst zoals hij geschreven is.** **Bewerken** opent nog
  steeds de Markdown, en een opgeslagen bewerking wordt door de app getekend tot de
  pagina de pull request opnieuw leest (op GitHub daarna door GitHub).
- **Privébijlagen van GitHub verlopen.** GitHub ondertekent het adres van een
  privéafbeelding voor een paar minuten; een die niet meer laadt nadat de pagina een
  tijd open stond, komt terug met **Vernieuwen**.
- **Een relatieve afbeelding op GitHub** die de app zelf tekent (een antwoord dat uit
  de app is verstuurd, voordat de pagina het opnieuw leest), wordt gezocht onder het
  adres van de repository op github.com, wat niet per se is waar GitHub het zou
  zetten.
- **Video’s** in een GitHub-reactie verschijnen als een link naar het bestand, niet
  als speler.
- **Extensies die alleen GitHub kent** en die de app zelf tekent (op andere hosts),
  ontbreken: geen emoji-codes, geen Mermaid-diagrammen, geen opmaak voor meldingen, en
  formules blijven tekst.
- **Code wordt alleen gemarkeerd als het hek zijn taal noemt.** De taal raden zou elke
  grammatica over elk blok van de pagina laten lopen.
- **Commitberichten** in het tabblad Commits blijven platte tekst: git geeft geen
  Markdown weer, en de hosts ook niet.

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
zonder op hoofdletters te letten. Azure DevOps noemt auteurs bij weergavenaam, die twee mensen kunnen delen, dus daar
vergelijkt het nooit namen: een reactie is van jou als het auteurs-id overeenkomt met
het id van het account, **of** de unieke naam van de auteur (de accountnaam, meestal
een e-mailadres) overeenkomt met die van het account, zonder op hoofdletters te
letten. Elk van beide hoort bij één persoon; de tweede dekt een auteurs-id af dat niet
het id is dat de verbinding meldt. Kan geen van beide worden vergeleken, dan toont
geen enkele reactie de acties. Kan de app niet zeggen wie je bent (een token zonder user-scope, of de host
antwoordde niet), dan toont ook geen reactie ze; **Vernieuwen** vraagt het opnieuw.
De host beslist nog steeds: een account dat hij een reactie niet laat wijzigen,
wordt geweigerd, en de melding zegt dat.

- **Bewerken** opent de reactie ter plekke, in dezelfde Markdown-editor, met de
  tekst zoals die geschreven is. **Opslaan** (of ⌘/Ctrl+Enter) verstuurt hem;
  **Annuleren** of **Esc** sluit hem, met eerst een vraag als je iets veranderde.
  Alleen de lege regels rond de tekst vallen weg: ingesprongen code en een regeleinde
  van twee spaties aan het eind blijven zoals getypt. De nieuwe tekst verschijnt
  meteen en de pagina leest de pull request opnieuw. Op de pull-requestspagina blijft een niet-opgeslagen bewerking bij de pull request als
  je verder gaat met **‹ ›** of van tabblad wisselt, en de pull request sluiten vraagt het
  eerst. De issuepagina houdt niets vast: daar vraagt niets iets voordat haar tabblad
  sluit.
- **Verwijderen** vraagt het altijd eerst, en de vraag zegt wat er gebeurt: de server
  verwijdert de reactie voor iedereen, en dat kan niet ongedaan worden gemaakt. Er is
  geen ongedaan-maakitem, omdat niets haar kan terugbrengen.

De **eerste reactie van een thread** met antwoorden verwijderen (een reviewthread,
of een reactie in het gesprek waarop anderen antwoordden) verschilt per host, en de
bevestiging zegt welk geval het is. Twee daarvan zijn niet door de host
gedocumenteerd, en dat staat er ook bij:

| Host | Eerste reactie van een thread met antwoorden |
|---|---|
| GitHub | De antwoorden zouden moeten blijven; de documentatie van GitHub zegt het niet. De thread houdt zijn antwoordvak: zonder zijn eerste reactie gaat het antwoord via de GraphQL-API van GitHub naar de thread zelf, gevonden via een antwoord dat er nog in staat. Mislukt dat (een oude Enterprise Server, een token dat GraphQL weigert, een thread waarin dit account volgens GitHub niet mag antwoorden), dan biedt de thread in plaats daarvan **Antwoorden op GitHub** aan. Heb je op GitHub een review in uitvoering, dan kan GitHub het antwoord daaronder opbergen: de melding zegt dat dan, en niemand ziet het antwoord tot je die review daar indient |
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

## Waar een `#123` of `AB#123` over gaat

Een commit die *fixes AB#4821* zegt, of een reactie die *zie #312* zegt, geeft je
een nummer, niet waar het over ging. Dat uitzoeken betekende het openen. Nu opent
**wijzen naar een verwijzing** — of er met Tab heen gaan — een kleine kaart met wat
de host erover zegt:

- een pictogram voor de soort, en de verwijzing zoals ze geschreven is;
- de **titel**;
- de **status** (open, gesloten, gemerged — op Azure DevOps de eigen status van het
  work item, zoals *Active* of *Resolved*);
- op Azure DevOps het **type work item** (Bug, User Story, Task…).

![De kaart bij een verwijzing naar een work item in een reactie: type, titel en status](../../screenshots/reference-card.webp)

De kaarten staan op de pull-requestspagina (beschrijving, reacties, reviewthreads
en het volledige bericht van een commit in het tabblad **Commits**), op de
issuepagina en in het onderwerp in het commitdetailpaneel. In het tabblad
**Commits** op Azure DevOps toont elk work item in het onderwerp van een commit
(`AB#123`, of `#123`, daar hetzelfde item) ook zijn titel ernaast, in grijs. Op
Azure DevOps linkt `!123` naar die pull request, zonder kaart.

| Verwijzing | Host | Gelezen uit |
|---|---|---|
| `AB#123`, en `#123` in een Azure-repository | Azure DevOps | Work items, tot 200 in één verzoek |
| `#123` | GitHub, GitHub Enterprise Server | Issues en pull requests, tot 50 in één GraphQL-verzoek; één REST-verzoek per stuk als GraphQL mislukt |
| `#123` / `!123` | GitLab | Issues / merge requests, één verzoek per soort |
| `#123` | Forgejo | Issues (ook pull requests), één verzoek per stuk, twee tegelijk |

Een `#123` telt alleen als eigen woord: `org/repo#123` (een andere repository),
`&#39;`, een kleur als `#123abc` en de `#issuecomment-…` van een link blijven
ongemoeid.

Er wordt niets gevraagd tot een kaart opengaat. Dan gaan de verwijzing waar je op
staat en de nog onbekende die er op de pagina het dichtst bij staan in één aanroep,
zodat de volgende kaart meestal meteen klaar is. Antwoorden blijven in het geheugen
zolang de app draait, nooit op schijf, vijf minuten lang; daarna worden ze nog
getoond en bij de volgende hover opnieuw gelezen. Ze worden per profiel bewaard: de
aanroep gebeurt als het profiel waaraan de repository is [gekoppeld](profiles.md),
en een ander profiel ziet misschien andere items.

Wat het kost:

- **GitHub** leest er tot **50** in één verzoek, via zijn GraphQL-API — die waar je op
  staat en de dichtstbijzijnde buren. Mislukt GraphQL om een andere reden dan een
  limiet (een oude Enterprise Server, een token dat het weigert), dan valt de app terug
  op de REST-API, die één issue per verzoek leest: dan worden alleen de eerste **10**
  opgevraagd, na elkaar zoals GitHub van apps vraagt; de andere blijven onbekend, en
  een latere hover vraagt ernaar.
- **Forgejo** kan niet meerdere issues in één verzoek lezen, dus elke kaart kost er
  één: een hover vraagt er hoogstens **10** op, twee tegelijk.
- Op GitHub en Forgejo stopt het eerste antwoord dat *langzamer* zegt (een 429, een
  403, de eigen limietfout van GraphQL, een secundaire limiet, of een antwoord dat het
  laatste verzoek van de limiet opmaakte) de rest — GitHub valt dan niet terug op REST
  — en die verwijzingen worden vijf minuten niet opnieuw opgevraagd.
- **Azure DevOps** leest tot 200 work items in één verzoek, en GitLab één verzoek
  per soort, dus daar gaat de hele pagina in één keer.

Wat het niet doet:

- **Bitbucket** heeft geen kaart: de app leest daar geen issues, en de link opent
  zoals voorheen de browser.
- **Niet gevonden, of geen toegang.** Een verwijderd issue, een work item in een
  project dat dit account niet kan zien, of een Azure-token zonder de scope *Work
  Items (Read)* zien er hetzelfde uit: de kaart zegt het, en de link werkt nog
  steeds. Een host die afremt, onbereikbaar is of geen account in dit profiel heeft,
  krijgt een eigen melding.
- **`AB#123` buiten Azure DevOps** — in een GitHub-repository die met Azure Boards is
  verbonden — wordt niet gelinkt en heeft dus geen kaart: de app weet niet bij welke
  organisatie het hoort.
- **De gemergede status op oudere GitHub Enterprise Servers** die niet meesturen
  wanneer een pull request gemerged is: die leest als gesloten.
- De commitrijen **van de graaf** tonen geen kaarten.

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
- **Het lezen van de bestanden kan fetchen — één keer.** Als de commits van de pull
  request niet in deze clone staan, haalt de pagina ze bij het openen op id op van haar
  remote, en opnieuw bij **Vernieuwen** — nooit na een reactie, een review of een merge,
  en hoogstens één keer per versie van de pull request per sessie (een mislukte poging
  wacht op Vernieuwen). Hij schrijft alleen objecten: geen branch, en niet `FETCH_HEAD`,
  dus het „… geleden gefetcht” van de werkbalk verandert niet. Hij geeft op na 20
  seconden, of als de overdracht 15 seconden lang onder 1 KB/s kruipt, en vraagt nooit
  om een wachtwoord: de prompt van git staat uit en Git Credential Manager krijgt te
  horen dat hij zijn aanmeldvenster niet mag openen, dus een remote die er een nodig
  heeft, valt terug op de API. Een ssh-remote gebruikt je eigen ssh-instellingen zoals
  ze zijn, behalve dat het wachtzinvenster van ssh zelf niet wordt geopend. Houdt een
  andere git-bewerking de repository (een lange push) langer dan vijf seconden vast, dan
  wordt de fetch die keer overgeslagen en wordt de API gebruikt. Wijzigingen die je
  ondertussen in de werkmap maakt, gaan niet verloren: de repository ververst zodra hij
  klaar is. Een ondiepe of gedeeltelijke clone die de objecten mist, valt terug op de
  API van de host.
- **Boven de limieten** wordt een bestand getoond met zijn aantallen en zonder diff:
  20.000 gewijzigde regels of 8 MB diff gelezen uit de clone, 4 MB per versie gelezen
  van Azure DevOps. Eén leesactie bewaart zo’n 150.000 regels of 48 MB aan diffs; de
  bestanden daarna zijn **nog niet geladen** en worden gelezen als je ze opent.
- **UTF-16-bestanden** die git binair noemt, worden opnieuw als tekst gelezen, tot 50
  per pull request en 2 MB per versie; daarboven verschijnen ze als binair.
- **Hernoemingen** worden herkend zoals `git diff -M` ze herkent (standaard 50%
  gelijkenis), wat een beetje kan afwijken van de eigen koppeling van de host.
- **Azure DevOps via de API** leest zijn eerste honderd bestanden binnen in totaal één
  minuut; de bestanden die over zijn als de minuut om is, zijn **nog niet geladen**.
  Een afgeremd antwoord pauzeert elke leesactie tot de Retry-After van de server. Een
  pull request met meer dan 20.000 wijzigingen wordt tot daar getoond, en het tabblad
  zegt dat.
