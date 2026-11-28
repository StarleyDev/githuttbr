---
title: CI-runs
category: Synchroniseren & meerdere repo's
order: 59
summary: Volg GitHub Actions, GitLab-pipelines, Azure Pipelines en Forgejo Actions vanuit de app — elke job, zijn stappen en zijn log, met opnieuw uitvoeren en annuleren.
keywords: ci-runs ci runs actions workflow pipeline build github actions gitlab pipelines azure pipelines forgejo actions jobs stappen steps logs opnieuw uitvoeren rerun re-run annuleren cancel dispatch workflow_dispatch badge status graaf graph mislukte test slagingspercentage voortgang
---

# CI-runs

Je hebt gepusht en nu wacht je: naar de browser, de repository zoeken, Actions
openen, je run vinden, de job openen die rood werd, naar het eind van de log
scrollen. **CI-runs** zet die rondgang naast de code. Eén pagina vertelt je hoe
elke workflow het de laatste tijd deed, toont de runs van de remote met de nieuwste
bovenaan, en opent een mislukte run meteen op de test die brak — met bestand en
regel, één klik van je editor. De knoppen om hem opnieuw te draaien of te stoppen
staan op de kaart.

Hij praat met de eigen API van de host, met het token dat je GitHuttBr al gaf. Er
draait niets op je eigen machine — daarvoor is er [Lokale CI](local-ci.md).

![De CI-runspagina: een kaart per workflow met zijn laatste runs, de filters Mislukt en Bezig, de voortgang van een lopende run, en een mislukte run geopend op de test die brak en zijn jobs](../../screenshots/ci-runs.webp)

## Openen

**Gereedschap → CI-runs…**, of *CI-runs* in het opdrachtenpalet (⌘K). De pagina
hoort bij het tabblad van de repository, net als de wiki en de inzichten, en leest
de remote die `origin` heet — of de eerste remote, als er geen `origin` is.

## Wat de pagina toont

| Onderdeel | Wat het is |
|---|---|
| **Workflowkaarten** | Eén kaart per workflow: wat hem start, zijn slagingspercentage over zijn laatste 10 afgeronde runs (groen vanaf 90 %, oranje vanaf 70 %, rood daaronder), die runs als gekleurde vierkantjes — de oudste links, zodat de nieuwste naast "nu" staat — zijn gemiddelde duur, en ofwel zijn traagste job of hoe zijn laatste run afliep. Klik op een kaart om alleen de runs van die workflow te tonen; klik nog eens om ze weer allemaal te tonen |
| **Alle branches / huidige branch** | Elke run op de remote, of alleen die van de branch die je hebt uitgecheckt |
| **Mislukt / Bezig** | Snelfilters met het aantal runs dat elk zou overlaten. Ze tellen wat de andere filters overlaten, dus het getal is wat een klik toont |
| **Filter** | Beperkt de geladen runs op titel, workflow, branch, auteur, commit of gebeurtenis |
| **Een runkaart** | De titel van de commit (of de naam van de workflow), dan de branch, de workflow en het runnummer, wat hem startte (push, pull request, schedule, handmatig…), wie hem startte en de commit — klik op de commit om hem te kopiëren. Hoort de run bij een pull request, dan opent **PR #n** de pagina van die pull request. Rechts: hoe hij ervoor staat, hoe lang hij duurde en hoe lang geleden |
| **Een lopende run** | *Bezig · stap 3 van 5*, een voortgangsbalk en de tijd tot nu toe. De stap is die van de lopende job; op een host zonder stappen (GitLab, Forgejo) telt hij in plaats daarvan jobs |
| **De mislukte test** | Een mislukte run opent vanzelf, de nieuwste eerst, met de test die zijn log noemt: de job, de test, de eerste regel van de fout en **pad:regel** — klik erop, of op *Openen in editor*, om op die regel te landen. Dezelfde lezing als het [tabblad Checks](hosting.md#het-tabblad-checks) van een pull request |
| **Jobs** | Daaronder elke job met zijn status en duur, gegroepeerd per stage waar de host stages heeft (GitLab, Azure). *Stappen en log bekijken* opent de stappen van een job en het eind van zijn log — bij een mislukte job staat het er altijd, bij de andere verschijnt het als je de job aanwijst |
| **Stappen** | Elke stap van een job, met zijn status en duur — GitHub, Azure en Forgejo melden ze; GitLab heeft geen stappen |
| **Log** | Het eind van de log van een afgeronde job, met kleuren. Alleen de laatste 512 KB worden opgehaald — waar een fout staat — en de pagina zegt het als het begin is weggelaten |

Zolang er iets op de pagina in de wachtrij staat of loopt, vraagt de lijst de host
elke 15 seconden opnieuw, en daarbij ook de jobs van de geopende run en van elke
lopende run — daar komt de staptelling vandaan; de duur tikt elke seconde door.
Brengen twee minuten aan antwoorden niets nieuws — een run die op goedkeuring voor
een deployment wacht, bijvoorbeeld — dan vertraagt hij naar eens per minuut, en
versnelt weer zodra er iets beweegt. Een lijst waarin alles klaar is vraagt niets
tot je op vernieuwen drukt, en er wordt niets gevraagd zolang het venster
verborgen is.

Een run die de host zonder titel stuurt — elke GitLab-pipeline, een geplande
Azure-build — krijgt de onderwerpregel van zijn commit als naam wanneer de commit
in de graaf staat, kosteloos gelezen uit je lokale repository; anders zijn nummer.

## Opnieuw uitvoeren, annuleren, starten

| Knop | Verschijnt wanneer | Wat er gebeurt |
|---|---|---|
| **Mislukte opnieuw** | De run is mislukt of geannuleerd | Alleen de jobs die niet slaagden draaien opnieuw |
| **Opnieuw** (↻) | De run is klaar, op GitHub — op de kaart als je hem aanwijst | Elke job draait opnieuw |
| **In de browser openen** | Je wijst een kaart aan | De run op de site van de host |
| **Annuleren** | De run staat in de wachtrij of loopt | Vraagt eerst: de lopende jobs worden onderbroken en hun werk gaat verloren |
| **Workflow starten** | De host kan er een met de hand starten | Kies de workflow en een branch; hij start alsof die branch was gepusht, en verschijnt een paar seconden later in de lijst |

Wat elke host toestaat:

| Host | Lijst & jobs | Stappen | Log | Alles opnieuw | Mislukte opnieuw | Annuleren | Met de hand starten |
|---|---|---|---|---|---|---|---|
| **GitHub** (en Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — de workflow heeft een `workflow_dispatch`-trigger nodig |
| **GitLab** (en self-managed) | ✓ — pipelines, jobs per stage | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — draait `.gitlab-ci.yml` op de branch |
| **Azure DevOps** | ✓ — builds, jobs per stage | ✓ (taken) | ✓ | — | ✓ | ✓ | ✓ — elke builddefinitie van de repository |
| **Forgejo / Gitea** | ✓ op servers met de Actions-runs-API | ✓ | ✓ als de server hem aan een token geeft | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Badges in de graaf

Dezelfde CI verschijnt als een kleine badge naast elke commit in de graaf: groen,
rood, of een klok zolang hij loopt. Hover erover voor de jobs; klik voor de pagina
van de host. De badges komen van:

| Host | Bron |
|---|---|
| GitHub | De check runs van de commit — elke CI die aan GitHub rapporteert, niet alleen Actions |
| GitLab | De statussen van de commit, waarin elke pipelinejob zit. Een handmatige job (een deploy, bijvoorbeeld) laat de badge niet op de klok hangen |
| Azure DevOps | De 100 recentste builds van de repository, gekoppeld via de commit |
| Forgejo / Gitea | De gecombineerde status van de commit — Forgejo Actions en elke externe CI |
| Bitbucket Data Center | De buildstatussen van de commit |

Elk antwoord wordt onthouden — ook "hier is geen CI" — en een commit wordt pas
opnieuw bevraagd als zijn antwoord veranderd kan zijn: elke 45 seconden zolang hij
loopt, elke 10 minuten als hij klaar is, en steeds minder vaak voor een commit die
nooit CI had. Zo blijft een drukke graaf binnen het uurlimiet van de host.

## Beperkingen

- **De kaarten kennen alleen de runs die de pagina toonde.** Dat zijn de laatste 50
  runs van het actieve branchfilter — een workflow die zelden draaide kan minder dan
  tien vierkantjes tonen, en overschakelen naar de huidige branch berekent elke kaart
  opnieuw. De traagste job verschijnt zodra de pagina de jobs van een afgeronde run
  heeft gelezen (de mislukte run die hij opent is genoeg); tot dan zegt de kaart hoe
  de laatste run afliep.
- **De mislukte test wordt uit de tekst van de log gelezen.** Vitest, Jest en pytest
  worden herkend; elke andere runner, een buildfout of een afgekapte log toont alleen
  de jobslijst. Een pad dat de runner buiten de checkout schreef, kan niet worden
  geopend.
- **PR #n hangt af van wat de host zegt.** GitHub noemt de pull request alleen bij
  runs uit dezelfde repository, niet uit een fork; GitLab zegt het bij
  merge-request-pipelines en Azure bij PR-builds. Forgejo-runs hebben geen link.
- **De log is het eind, en pas als een job klaar is.** GitHub en Forgejo geven de
  log van een job pas als die klaar is; zolang hij loopt toont de pagina zijn
  stappen die vorderen, niet zijn uitvoer. GitLab en Azure leveren de log van een
  lopende job tot nu toe — open hem opnieuw om meer te lezen.
- **Het token heeft CI-toegang nodig.** Een fine-grained GitHub-token heeft *Actions:
  read* nodig om te tonen en *Actions: write* om opnieuw te draaien, te annuleren of
  te starten; een klassiek token heeft `repo` nodig. Een GitLab-token heeft
  `read_api` nodig om te tonen en `api` voor de knoppen. Een Azure-token heeft
  *Build: read* nodig (en *Build: read & execute* voor de knoppen); zonder blijven de
  pagina en de badges leeg in plaats van te falen.
- **Azure-badges reiken maar 100 builds terug.** Een oudere commit heeft geen badge,
  al toont de CI-runspagina zijn build nog wel.
- **Opnieuw uitvoeren is bij Azure "mislukte opnieuw proberen".** Het werkt op
  YAML-pipelines met stages; een klassieke pipeline kan het weigeren, en de pagina
  toont het antwoord van de host.
- **Een workflow starten vraagt niet om zijn inputs.** Een GitHub-workflow of een
  GitLab-pipeline met verplichte inputs zonder standaardwaarde wordt door de host
  geweigerd, met zijn eigen melding.
- **Forgejo is alleen-lezen, en alleen op recente servers.** Oudere Forgejo- en
  Gitea-servers hebben geen API om runs te tonen; de pagina zegt dat de host niet
  wordt ondersteund, en de badges in de graaf werken nog via commitstatussen. Een
  repository die het token niet kan zien, verschijnt als toegangsfout, niet als
  "niet ondersteund".
- **Bitbucket heeft geen runspagina.** Op Data Center is CI een extern systeem
  (Jenkins, Bamboo…) dat alleen een status meldt — die status is de badge in de
  graaf. bitbucket.org Pipelines wordt niet ondersteund.
- **Eén remote.** De pagina leest `origin`; runs op een andere remote van een fork
  worden niet getoond.

**Zie ook:** [Lokale CI](local-ci.md) · [Hosting & pull requests](hosting.md)
