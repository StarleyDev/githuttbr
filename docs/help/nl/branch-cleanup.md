---
title: Branches opruimen
category: Branches & ingrepen
order: 47
summary: Verwijder de lokale branches waarvan het werk al ergens anders staat — verdwenen upstreams, gemergede branches — in één stap die ongedaan kan worden.
keywords: opruimen opschonen prune verwijderen lokale branches verdwenen gemerged squash verouderd dood oud pull request ordenen branchlijst clean up cleanup delete remove gone merged stale tidy branch list
source: 701f92f45b9e4dcda7dc560cb20128442fd2da0d
---

# Branches opruimen

Elke pull request die je uitcheckt, laat een lokale branch achter. De PR wordt
gemerged, de server verwijdert zijn branch, en de lokale blijft — voorgoed. Na een
paar honderd reviews bestaat de branchlijst grotendeels uit dode branches, en de
levende vinden betekent langs allemaal scrollen.

Branches opruimen toont de lokale branches waarvan het werk al ergens anders veilig
is, vinkt de branches aan waarbij niets verloren gaat, en verwijdert ze in één stap
die je ongedaan kunt maken. "Ergens anders" betekent de remote-tracking-branches
zoals bij je laatste fetch, en de standaardbranch.

![Het opruimvenster: verdwenen, gemergede en met squash gemergede branches aangevinkt, werk dat alleen hier bestaat achtergehouden](../../screenshots/branch-cleanup.webp)

## Hoe het werkt

1. Gereedschap → **Lokale branches opruimen…** (of <kbd>⌘K</kbd>).
2. Druk eerst op **Ophalen en opschonen** als de laatste fetch oud is. Tot er een
   fetch met prune heeft gedraaid, ziet een branch die de server verwijderde er hier
   nog levend uit.
3. Als je team pull requests met squash merget, druk op **Squash-merges
   controleren** (zie hieronder).
4. Controleer de vinkjes, dan **Verwijderen**. Eén bevestiging zegt hoeveel branches
   verdwijnen en noemt elke branch met commits die nergens anders staan.

Het verwijderen is één bewerking met één ongedaan-maakitem: **Ongedaan maken**
maakt elke verwijderde branch opnieuw aan op precies de commit waarnaar hij wees,
met zijn upstream (`branch.<name>.remote` en `.merge`) teruggezet. Is er sindsdien
een branch met dezelfde naam op een andere commit verschenen — dezelfde PR opnieuw
uitgecheckt —, dan laat ongedaan maken die met rust, haalt de verwijderde ernaast
terug als `<name>-restored-<short sha>`, en zegt dat.

De succesmelding en het ongedaan-maakitem tonen elke branch met de commit waarnaar
hij wees (`feature/x (was abc1234)`), zoals `git branch -D` het afdrukt: de
ongedaan-maakgeschiedenis leeft alleen zolang de app open is, en die regel is genoeg
om een branch met de hand opnieuw te maken.

## Waarom een branch in de lijst staat

| Chip | Betekent |
|---|---|
| **Verdwenen** | De branch volgt een upstream die de server heeft verwijderd — het gebruikelijke spoor van een gemergede pull request. |
| **Gemerged** | Elke commit erop zit al in de standaardbranch. De tooltip noemt de kopie die ze bevat — `main (local, not pushed)` als alleen je lokale kopie ze heeft. |
| **Squash-gemerged** | Gevonden door **Squash-merges controleren**: de inhoud zit in de standaardbranch, de losse commits niet. |
| **Verouderd** | Geen commit sinds het aantal maanden dat je kiest (standaard 3). Staat er alleen in als je **Ook verouderde branches tonen** aanvinkt. |
| **N commits bestaan alleen hier** | Commits die op geen remote-tracking-branch staan en niet in de standaardbranch zitten. De branch verwijderen verwijdert ze. |
| **Nog geen commits** | Hij wijst precies naar de top van de standaardbranch — waarschijnlijk aangemaakt en nooit gebruikt. |

"Gemerged" wordt gemeten tegen de remote kopie van de standaardbranch
(`origin/main`), en ook tegen je lokale — een lokale `main` die een maand niemand
heeft gepulld, kan de merges van sindsdien niet verbergen.

## Squash-merges

Een squash-merge zet de wijzigingen van een pull request als één nieuwe commit op
`main`; de eigen commits van de branch komen nooit aan. Voor git ziet zo'n branch
eruit als verlaten werk: **Verdwenen**, met *N commits bestaan alleen hier*.

Als er verdwenen branches met eigen commits in de lijst staan, stelt
**Squash-merges controleren** een andere vraag: zou het mergen van deze branch in
`main` iets veranderen? Het draait één `git merge-tree` in het geheugen voor allemaal
— geen checkout, geen index —, en een branch waarvan de merge de boom van `main`
precies laat zoals hij is, krijgt de chip **Squash-gemerged** en wordt aangevinkt als
een gemergede. De bevestiging zegt dat hun inhoud in `main` zit en hun commits niet.

De controle draait opnieuw, onder de vergrendeling, op het moment van verwijderen:
een branch die er niet meer door komt, wordt geweigerd, niet verwijderd.

## Wat aangevinkt is, en wat nooit

Aangevinkt als het venster opent: branches die **verdwenen of gemerged** zijn en
**geen eigen commits** hebben — plus squash-gemergede zodra gecontroleerd.
**Verdwenen + gemerged selecteren** zet die selectie terug.

Nooit voor je aangevinkt, en nooit bereikt door **Alle getoonde selecteren**: een
branch met commits die alleen hier bestaan. Vink hem rij voor rij aan; de
bevestiging wordt dan rood en toont hem met zijn aantal commits. Alleen verouderde
branches en een die op de top van de standaardbranch staat, worden ook niet
aangevinkt. Als de selectie rijen bevat die de lijst niet toont — verborgen door het
filter, of voorbij de eerste 400 —, zegt de bevestiging hoeveel.

Het verwijderen accepteert per branch precies het aantal unieke commits dat de
bevestiging toonde. Heeft een branch er tegen die tijd meer — of heeft hij er bij
**Opnieuw uitvoeren** sinds het ongedaan maken bij gekregen (bijvoorbeeld omdat een
prune de remote kopie verwijderde) —, dan wordt hij geweigerd en bewaard, en meldt
opnieuw uitvoeren dat in plaats van succes te claimen.

Nooit in de lijst, en door het verwijderen geweigerd, ook als erom gevraagd wordt:

- de huidige branch;
- een branch die in een worktree is uitgecheckt, of daar gerebased wordt;
- de standaardbranch;
- [beschermde branches](repo-settings.md), inclusief patronen als `release/*` uit
  de [repositoryconfiguratie](repo-config.md).

Op de remote verandert niets. Dit verwijdert alleen lokale branches.

## Beperkingen

- **Squash-merges zijn onzichtbaar voor git** tot je controleert. Zonder
  **Squash-merges controleren** verschijnt een met squash gemergede branch als
  **Verdwenen** met *N commits bestaan alleen hier*, en wordt hij niet aangevinkt.
- **De squash-controle kan missen.** Ze beantwoordt "zit deze inhoud al in
  `main`?". Als `main` later dezelfde regels nog eens veranderde, of de squash bij het
  mergen bewerkt werd, zou de merge iets veranderen, en blijft de branch
  onaangevinkt. Ze zegt nooit ten onrechte ja op een manier die inhoud verliest: de
  inhoud zit per definitie in `main`. Net als de [conflictradar](conflict-radar.md)
  schrijft ze losse tree-objecten die `git gc` opruimt.
- **Een niet-gefetchte remote is verouderd.** "Verdwenen" komt van de laatste fetch.
  Zonder **Ophalen en opschonen** ziet een branch die een uur geleden op de server is
  verwijderd er nog levend uit, en staat een verse merge nog niet in `origin/main`.
- **Verouderd is alleen een datum.** Drie rustige maanden zeggen niets over of het
  werk veilig is, daarom worden verouderde rijen nooit aangevinkt.
- **"Ergens anders" zijn de remote-tracking-refs van de laatste fetch**, niet de
  server op dit moment — en geen tags. Een commit die alleen een tag vasthoudt, telt
  als uniek, en een commit op de remote branch van iemand anders niet.
- Het aantal unieke commits stopt bij 500 en toont *500+*. Het totaal in de
  bevestiging is een ondergrens — *minstens N* — omdat gestapelde branches commits
  delen.
- Ongedaan maken herstelt de branch en zijn upstream, niet zijn reflog of andere
  `branch.<name>.*`-instellingen.
- Het venster toont de eerste 400 rijen van een lange lijst; het filter vindt de
  rest. **Verdwenen + gemerged selecteren** geldt voor elke rij, getoond of niet.

**Zie ook:** [Branches, remotes & de zijbalk](branching.md) · [Fetchen, pullen & pushen](syncing.md) · [Pull-requestspagina](pull-requests.md)
