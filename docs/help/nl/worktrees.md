---
title: Worktrees & submodules
category: Synchroniseren & meerdere repo's
order: 54
summary: Meerdere checkouts van één repository; en repository's binnen repository's.
keywords: worktree worktrees submodule submodules gekoppelde checkout init sync
---

# Worktrees & submodules

## Worktrees

Een worktree is een tweede checkout van dezelfde repository, in een eigen map —
zodat je naar `main` kunt kijken terwijl `feature/x` precies blijft zoals je hem
achterliet, zonder te stashen.

- Maak en verwijder worktrees vanuit de zijbalk. **Dubbelklik** er een om hem
  als eigen tabblad te openen; rechtsklik geeft *Worktree openen*, *In map
  tonen* en verwijderen.
- Rechtsklik een willekeurige lokale branch → **Openen in een worktree** om er
  een op te tuigen in een naburige map en hem als tabblad te openen.
- Een branch woont maar in één worktree tegelijk, dus een branch uitchecken die
  een andere worktree al vasthoudt kan niet — git weigert met *already used by
  worktree at …*. GitHuttBr brengt je er in plaats daarvan heen: het branchmenu
  zegt *Naar `x` in zijn worktree*, en dubbelklikken op de rij opent het tabblad
  van die worktree in plaats van te mislukken.

### Worktrees onderhouden

Een worktree van vorige maand ben je snel vergeten, en de vragen komen bij het opruimen: zit er nog werk in? Bestaat die map nog? Elke rij beantwoordt ze voordat je ze hoeft te stellen.

| Op de rij | Betekent |
|---|---|
| **●3** | Drie bestanden met niet-gecommitte wijzigingen in die worktree |
| **↑2 ↓1** | De branch staat twee commits voor en één achter op de upstream |
| 🔒 | Vergrendeld — beweeg erover voor de reden die bij het vergrendelen is opgegeven |
| **ontbreekt**, naam doorgestreept | De map is weg; git heeft alleen de registratie nog |

![De sectie Worktrees: een worktree met niet-gecommit werk en commits voor, een
die ontbreekt, een vergrendelde, en de gum in de kop](../../screenshots/worktree-care.webp)

De aantallen worden gelezen als de sectie opengaat, als de commit van die worktree verandert en als het venster de focus terugkrijgt — niet bij elke verversing, want elk is een `git status` in een andere map.

Klik met rechts op een rij voor:

| Actie | Wat het doet |
|---|---|
| **Worktree vergrendelen** | Voorkomt dat git (en elke andere client) hem opschoont, verplaatst of verwijdert. Geef een reden — *op de externe schijf* — en die verschijnt bij het slot. Voor worktrees op media die niet altijd zijn aangesloten. |
| **Worktree ontgrendelen** | Het omgekeerde. Ongedaan maken vergrendelt hem weer, met dezelfde reden. |
| **Worktree verplaatsen…** | Verplaatst de map en werkt de koppelingen van git in beide richtingen bij. Niet beschikbaar zolang hij vergrendeld of in een tabblad geopend is: tabbladen en hun indeling worden per pad onthouden, dus het tabblad zou naar niets wijzen. Sluit het eerst. Ongedaan maken zet hem terug. |
| **Worktree verwijderen** | Vraagt git eerst wat er verloren zou gaan. Een schone worktree krijgt de gewone bevestiging, en ongedaan maken maakt hem opnieuw aan op dezelfde branch in dezelfde map. Een met niet-gecommitte wijzigingen krijgt een aparte bevestiging, *Weggooien en verwijderen*, met het aantal bestanden, zonder ongedaan maken. |
| **Verplaatste map opnieuw koppelen…** | Alleen op een rij die *ontbreekt*: geef aan waar de map naartoe is (verplaatst in de bestandsbeheerder) en git koppelt hem opnieuw met `git worktree repair`. |
| **Ontbrekende worktrees vergeten** | Ook de gumknop in de sectiekop, zichtbaar zodra een rij ontbreekt. Voert `git worktree prune` uit. |

Wat deze acties **niet** doen:

- **Een worktree verwijderen wist ook de genegeerde bestanden** — `.env`, `node_modules`, build-uitvoer. Git telt ze niet als wijzigingen, dus zelfs de "schone" bevestiging meldt het, en ongedaan maken brengt ze niet terug.
- **Vergeten wist alleen de registratie in git.** Er zijn geen bestanden te wissen — de map is al weg — en vergrendelde worktrees worden overgeslagen, want een vergrendelde op een losgekoppelde schijf ziet er precies zo uit als een gewiste.
- Een vergrendeling is een afspraak tussen git-clients, geen bestandsbeveiliging: niets buiten git wordt tegengehouden de map te wissen.
- De hoofd-worktree — de repository zelf — kan niet worden vergrendeld, verplaatst of verwijderd.
- Een worktree verwijderen verwijdert nooit de branch. Verwijder die in de branchlijst als je klaar bent.

### Worktrees groeperen in de kop

Worktree-tabbladen openen met labels als `root · branch`, en dat wordt snel breed.

**Een project in een groep neemt zijn worktrees op.** Staat de repository — of
een van zijn worktrees — al in een groep, dan opent een nieuwe worktree in die
groep, ernaast, zonder dat je iets hoeft aan te vinken: het dialoogvenster voor
een nieuwe worktree zegt alleen welke groep, en **in een worktree openen** uit het
menu van een branch doet hetzelfde zonder te vragen. Een worktree die je later
vanuit **Recent** of een map opent, sluit zich er ook bij aan. Sleep de chip uit
de groep als je hem los wilt hebben.

Voor een repository in een eigen tabblad vink je in het dialoogvenster
**Voorstellen om worktrees met dezelfde hoofdrepository te groeperen** aan (standaard
uit, onthouden zoals de codegraph-optie): staat de root open als los tabblad, dan
verschijnt een veld **Groepsnaam** (vooraf ingevuld met de mapnaam van de root) en
komen beide in een nieuwe groep; is er geen familielid open, dan zegt het alleen
dat de worktree als eigen tabblad opent. Binnen de groep krimpen chips tot alleen
het laatste deel (`main`, `feature/x`), want de groep zegt al bij welke repository
ze horen — de schakelaar **Korte worktree-namen in groepen** in Instellingen →
Indeling & terminal houdt de volledige naam `root · branch` als je dat liever hebt.
Het voorstel voegt alleen worktrees samen die dezelfde root delen — nooit losstaande
repository's.

**Een worktree-tabblad herkennen.** Een gekoppelde worktree is een tweede checkout
van een repository, en zijn tabblad zou er anders precies zo uitzien als dat van de
repository zelf. Daarom toont een worktree-tabblad een groene **vork** in plaats van
het mappictogram — op een tabblad met afbeelding een kleine vork op de hoek van het
plaatje — en zegt de tooltip *Worktree van …* met de map waarin hij staat. Klik er
met rechts op voor **… openen, de hoofdrepository**, dat het tabblad met de
hoofdcheckout focust, of het opent — binnen de groep van de worktree als die in een
groep staat. Dit werkt hoe de worktree ook geopend is: vanuit zijn familie, via
**Repository openen** of uit de gescande lijst, en de worktrees van een submodule
wijzen naar de submodule. Grenzen: het teken gaat over waar de checkout staat, niet
over zijn branch; de worktrees van een bare repository krijgen geen teken, want er
is geen hoofdcheckout om te openen; en een hoofdrepository die via een map met
symlink open staat, wordt niet als al geopend herkend, dus het menu opent hem een
tweede keer onder zijn echte pad.

![Een worktree-tabblad met het groene vorkpictogram naast het tabblad van de
hoofdrepository, met het menu open op submodules-worktrees openen, de
hoofdrepository](../../screenshots/worktree-tab.webp)

![De worktree- en submodulesecties van de zijbalk, beide gevuld](../../screenshots/worktrees.webp)

## Submodules

Voeg submodules toe, werk ze bij (init & checkout), synchroniseer URL's en
verwijder ze, met live status voor elk:

| Status | Betekent |
|---|---|
| **In sync** | Uitgecheckt op de commit die de ouder vastlegt |
| **Gewijzigd** | Ergens anders uitgecheckt, of vuil |
| **Niet geïnitialiseerd** | Vastgelegd, maar nooit uitgecheckt |

![Submodules met hun status, elk op een eigen rij](../../screenshots/submodule-states.webp)

**Zie ook:** [LFS & sparse-checkout](lfs-sparse.md) · [Fetchen, pullen & pushen](syncing.md)
