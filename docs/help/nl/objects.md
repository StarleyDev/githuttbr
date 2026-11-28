---
title: Objectverkenner
category: Repository & geschiedenis
order: 16
summary: Loop door de laag onder de grafiek — commits, trees, blobs, tags en de refs die ernaar wijzen. Niets hier verandert iets.
keywords: objecten objects verkenner explorer blob tree commit tag ref plumbing cat-file ls-tree sha1 interne werking database rev-parse HEAD^{tree} loose packed
source: 946d418d5b13af167a16a2f0d3164d813b423ab6
---

# Objectverkenner

Git heeft de reputatie ingewikkeld te zijn. Vrijwel alles daarvan komt doordat je
het model nooit ziet: **vier soorten objecten, en pointers**. Zodra je een commit
kunt aanklikken, op zijn tree belandt en ontdekt dat jouw bestand *een blob is*
met een naam die een tree eraan gaf, houdt het porselein op magie te zijn.

`⌘K` → **Objectverkenner**. Niets op deze pagina kan één byte veranderen — elke
aanroep erachter is een leesactie.

![De commit waar main naar wijst: het pad vanaf de branch, waar hij naar wijst en waar een commit in het model staat](../../screenshots/objects.webp)

## De vier objecten

| Object | Is | Weet |
|--------|----|------|
| **blob** | De *inhoud* van een bestand | Niets. Niet zijn naam, niet zijn pad, niet zijn geschiedenis |
| **tree** | Een mapinhoudsopgave | Namen, modi en de sha van elke onderliggende blob of tree |
| **commit** | Eén momentopname | Zijn tree, zijn ouders, auteur, committer, boodschap |
| **tag** | Een geannoteerde tag | Het object waar hij naar wijst, de tagger, een boodschap |

De verrassing voor de meeste mensen zit in de eerste rij. **Een blob heeft geen
naam.** Twee bestanden met identieke inhoud, waar dan ook in je geschiedenis,
zijn dezelfde blob, één keer opgeslagen. De naam woont in de tree die ernaar
wijst — en dat is waarom git inhoud volgt in plaats van bestanden, en waarom
hernoemingen gedetecteerd worden in plaats van vastgelegd.

Een **ref** — `refs/heads/main`, `refs/tags/v1.0`, `HEAD` — is enkel een bestand
met een sha erin. Dat is de hele inhoud van "branchen is goedkoop".

## Rondlopen

![Van de commit naar src/: eerst mappen, elke modus uitgeschreven](../../screenshots/objects-tree.webp)

De linkerkolom toont elke ref, gegroepeerd zoals git groepeert: HEAD (met
`→ main` als hij op een branch staat), Branches, Tags en Remotes, elk met een
aantal. Remotes begint ingeklapt. Een vierkant teken is een ref naar een commit,
een rond groen een **geannoteerde** tag. Het filter beperkt alle groepen tegelijk.
Klik op een ref om op het object te landen dat hij noemt; die rij blijft
gemarkeerd zolang je vandaar verder loopt.

Vanaf daar is alles een deur:

- Een **commit** toont waar hij naar **wijst** — zijn root-tree, met het aantal
  items, en elke ouder, met zijn onderwerp — dan auteur en committer (*dezelfde
  als de auteur* als ze gelijk zijn) en het bericht.
- Een **tree** is een tabel van naam, modus, object en grootte, eerst mappen.
  Elke modus staat voluit: *bestand*, *uitvoerbaar*, *map*, *symlink*,
  *submodule*. Een map zegt hoeveel items hij heeft; een symlink, waarheen hij wijst.
- Een **blob** toont zijn tekst met regelnummers (alleen het begin, als hij groot
  is), of zegt duidelijk dat hij binair is. Via een tree bereikt, zegt een balk
  hoe hij daar heet — *Heet src/app.ts in commit 07c6f3d, modus 100644 (gewoon
  bestand)* — met een link naar de geschiedenis van het bestand.
- Een **geannoteerde tag** wijst naar het object dat hij noemt en legt de tagger vast.

![Een blob, de naam die zijn tree hem gaf, en waar hij in het model staat](../../screenshots/objects-blob.webp)

### Het pad

De band onder het revisieveld is het afgelegde **pad**:
`branch main → commit 07c6f3d → root → src/ → app.ts`. De tree van een commit is
de **root**; een bestand of map krijgt de naam van de rij waarop je klikte. Klik
op een item om ernaar terug te gaan. Een revisie typen, een ref kiezen of een
van de voorbeelden naast **Openen** begint een nieuw pad.

**Terug** en **Vooruit** lopen door alles wat je opende, zoals in een browser:
na terug brengt Vooruit je weer verder, tot je vandaar iets nieuws opent. Het
revisieveld volgt de route, dus `main:src/app.ts` staat altijd klaar om te kopiëren.

### Kleuren

Elke soort houdt overal één kleur — badge, pad-item, kaart, rij: commit in de
accentkleur van het thema, tree in het geel, blob in blauw, tag en ref in groen.
Onder de kop van het object zegt één zin wat die soort *is*.

### Waar je bent in het model

De strook onder in het paneel is de keten van git — **ref → commit → tree →
blob**, met **tag** tussen ref en commit bij een geannoteerde tag — en de soort
op het scherm licht op als *je bent hier*.

## Een revisie intypen

Het vak accepteert alles wat `git rev-parse` accepteert, en daar houdt dit op een
browser te zijn en wordt het een manier om te leren:

| Typ dit | Om te krijgen |
|---------|---------------|
| `HEAD` | De huidige commit |
| `HEAD~3` | Drie commits terug |
| `HEAD^{tree}` | De tree van die commit, afgepeld |
| `HEAD:src/app.ts` | De blob voor dat pad, rechtstreeks |
| `v1.0^{}` | Waar een geannoteerde tag naar wijst, in plaats van het tagobject |
| `a1b2c3d` | Elk object, op sha — afkortingen werken |

De moduscijfers in een tree-lijst zijn het kennen waard: `100644` een bestand,
`100755` uitvoerbaar, `040000` een subtree, `120000` een symlink, `160000` een
submodule-gitlink — en die laatste is alles wat een submodule opslaat.

## Grenzen die je moet kennen

- **Alleen-lezen, met opzet.** Er is hier niets om mee te schrijven. Objecten met
  de hand maken is een oefening met `git hash-object`, en hoort in een terminal.
- **Grote blobs worden afgekapt** na de eerste 200 KB — genoeg om te zien wat het
  is, niet genoeg om het venster te laten hangen.
- **Groottes zijn de inhoudsgrootte van het object** zoals `git cat-file -s` die
  meldt, niet wat het na packen op schijf kost. Daarvoor zie je
  [onderhoud](maintenance.md).
- **Onbereikbare objecten zijn nog steeds objecten.** Plak een sha uit een
  dangling-rapport van `git fsck` en hij opent, wat vaak de snelste manier is om
  te zien wat een verloren commit bevatte voor je besluit of je hem terughaalt.
- **Een submodule-rij gaat niet open.** De gitlink noemt een commit van een
  andere repository, die deze niet heeft.
- **Aantallen en symlinkdoelen hebben een plafond.** Een tree met meer dan 300
  submappen toont ze zonder aantal, en alleen de eerste 50 symlinks tonen hun doel.
- **Het pad eindigt met het dialoogvenster.** Sluit het en het volgende begint
  weer bij de branch van HEAD.

Zie ook: [De grafiek](graph.md) · [Repository-onderhoud](maintenance.md) ·
[Herstel](recovery.md)
