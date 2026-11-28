---
title: Elke commit bewerken
category: Branches & ingrepen
order: 46
summary: Herschrijf de bestanden of het bericht van een historische commit ter plekke — met de cascade eerst als preview.
keywords: commit bewerken edit herschrijven rewrite geschiedenis history amend verleden reword typfout typo fix cascade replay rebase ter plekke ingreep surgery vergelijken met origineel compare with original bestand toevoegen add file wat er gaat gebeuren what will happen niet-toegepaste wijzigingen unapplied changes
source: 2860ac7978e6b9b1b8a469abadf313971d0140c6
---

# Elke commit bewerken

De typfout zit in een commit van drie weken geleden. De gebruikelijke oplossing is
een interactieve rebase: stoppen bij de commit, bewerken, doorgaan, bidden. De
oplossing van GitHuttBr: rechtsklik op de commit, **Deze commit bewerken**, pas de
tekst aan, klaar. De penknop in het paneel met commitdetails opent dezelfde
editor.

![Een historische commit bewerken](../../screenshots/commit-edit.webp)

## Wat het doet

Kies eender welke commit die een voorouder van `HEAD` is — lineaire geschiedenis
of niet. De editor opent in het middelste paneel, in plaats van de commitgrafiek —
waar ook de conflictoplosser en de bestandsviewer openen — en neemt de volle
breedte en hoogte van het venster in. **Esc** of **×** in zijn kopbalk sluit hem.
Je bewerkingen blijven bewaard als je naar een ander repositorytabblad gaat en
terugkomt, en sluiten met niet-toegepaste bewerkingen vraagt eerst om
bevestiging.

De kopbalk noemt de commit — zijn korte hash, onderwerp, auteur en leeftijd — en
zodra je iets hebt gewijzigd, telt een geel label de **niet-toegepaste
wijzigingen**: één voor het bericht, één voor elk bestand dat je bewerkte.

### De berichtkaart

Het bericht krijgt dezelfde hulpmiddelen als de
[commitopsteller](committing.md): de knop **type ▾** vóór de samenvatting, de
samenvatting met de lengteteller (*56/72*) en de beschrijving eronder, de stijlrij
achter de pijl (scope, ticketsleutel, commitstijl), de gitmoji-kiezer, co-auteurs,
AI-generatie vanuit de eigen diff van de commit en de hints van de linter. Het
bericht van de commit wordt bij het laden gesplitst — de eerste regel wordt de
samenvatting, de rest de beschrijving — en bij het herschrijven weer samengevoegd
met één lege regel. Van een oude `add retry` een `fix: add retry` maken is één
keuze met de typeknop.

Zodra het bericht van het origineel afwijkt, wordt de kaart gemarkeerd als
**gewijzigd**, blijft het oude onderwerp zichtbaar onder de beschrijving als
*eerst: …*, en zet **Terug naar origineel** zowel samenvatting als beschrijving
terug.

### De bestandenkaart

De bestanden van de commit staan in een lijst met hun statusletter; een stip
markeert elk bestand dat je hebt gewijzigd. Kies een bestand om het te bewerken
zoals het in die commit was. De schakelaar boven de editor wisselt tussen
**Bewerken** en **Vergelijken met origineel**, dat de diff van het bestand toont
van wat de commit bevat naar je bewerkte tekst — dezelfde diffweergave als in de
rest van de app.

**Bestand toevoegen** opent een bestand dat de commit niet aanraakte, uit de eigen
snapshot van de commit: typ een deel van het pad en kies het. Zodra je het bewerkt,
wijzigt de herschreven commit dat bestand ook. Het krijgt een **+** in de lijst.

![Een bewerkt bestand vergelijken met het origineel van de commit](../../screenshots/commit-edit-compare.webp)

### Wat er gaat gebeuren

Het paneel naast de kaarten — eronder in een smal venster — toont de keten die een
herschrijving raakt: elke commit boven de bewerkte, van `HEAD` omlaag, en onderaan
de bewerkte commit zelf met wat er daarin verandert.

1. **Preview van de cascade** speelt elke commit boven de bewerkte *in het
   geheugen* opnieuw af (een keten van `merge-tree`-cherry-picks — geen checkout,
   geen working tree, geen refs). Elke commit in de keten zegt dan of hij
   **zonder conflict opnieuw wordt toegepast** of een **conflict** heeft in een
   genoemd bestand, zodat je **voordat er iets beweegt** weet of de bewerking
   schoon doorwerkt of botst met een latere wijziging. Na elke verdere bewerking
   verdwijnen de oordelen; **Opnieuw voorvertonen** draait hem opnieuw.
2. **Geschiedenis herschrijven** doet het echt: dezelfde keten wordt met plumbing
   opgebouwd, daarna verplaatst de branch met `reset --keep` — je niet-gecommitte
   wijzigingen gaan mee, of de reset breekt af en er is niets gebeurd. Eerst
   wordt een [bewakingsmomentopname](recovery.md) gemaakt, en **Ongedaan maken**
   herstelt de oude keten.

Staat de commit al op een remote, dan noemt een gele notitie de remote branch en
zegt wat dat betekent: de volgende push moet geforceerd worden. Een andere notitie
zegt hoeveel commits nieuwe hashes krijgen.

Auteurschap en datums van elke opnieuw afgespeelde commit blijven behouden;
alleen de hashes veranderen — dat is wat geschiedenis herschrijven betekent.

## Merges in het bereik

![Een commit bewerken onder twee merges — de cascade speelt ze opnieuw af](../../screenshots/commit-edit-merges.webp)

Een merge tussen de commit en `HEAD` schakelt bewerken niet langer uit. De
cascade speelt een merge opnieuw af door zijn **vastgelegde resultaat** — de
tree die de merge daadwerkelijk heeft gecommit, conflictoplossingen
inbegrepen — opnieuw toe te passen op de herschreven ouder, zodat oplossingen
die iemand met de hand maakte het herschrijven woordelijk overleven. Geen
rerere, geen opnieuw mergen, geen worktree: dezelfde in-memory plumbing als de
rest van de cascade, en beide ouderpointers blijven behouden. Een zijbranch
die de bewerkte commit ook bevat wordt herschreven en opnieuw gericht; een die
dat niet doet behoudt zijn identiteit onaangeroerd. Een notitie in het zijpaneel zegt
hoeveel merges het bereik bevat, en mergecommits tonen een merge-icoon in de
keten.

De eerlijke kanttekening: een opnieuw afgespeelde merge is maar zo goed als
zijn vastgelegde resultaat. Botst je bewerking met regels die de merge zelf
heeft opgelost, dan kleurt de preview rood, precies zoals elke andere
conflicterende stap — er wordt niets geraden.

## Als de cascade conflicteert

Een latere commit raakte dezelfde regels die jij aan het bewerken bent. De
preview markeert die commit met het conflicterende bestand, de commits erboven als
niet opnieuw toegepast, en **Geschiedenis herschrijven** blijft uit — er wordt
nooit iets half toegepast. Anders dan een rebase stopt de editor niet halverwege
om je het conflict te laten oplossen: bewerk het anders, of ga het conflict
frontaal aan met een [interactieve rebase](rebase.md).

## Beperkingen

- **De commit moet een voorouder van `HEAD` zijn.** Een commit op een
  niet-gemergde zijbranch heeft geen pad naar je huidige branch om opnieuw af
  te spelen.
- Binaire bestanden en bestanden groter dan 2 MB worden getoond maar zijn niet
  te bewerken.
- Een commit die al op een remote staat kan worden bewerkt, maar je volgende
  push moet dan een **force push** zijn — de editor waarschuwt voordat je je
  daaraan vastlegt.
- Verwijderde bestanden in de commit zijn niet te bewerken (er is geen inhoud om
  te bewerken).
- **Bestand toevoegen** bereikt bestanden die al in de snapshot van de commit
  bestaan; het kan geen gloednieuw bestand maken, er geen verwijderen, en geen
  symlink of submodule aanraken.

**Zie ook:** [Interactieve rebase](rebase.md) · [Herstel & de reflog](recovery.md) · [Absorb](absorb.md)
