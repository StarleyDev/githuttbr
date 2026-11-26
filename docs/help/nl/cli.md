---
title: De opdrachtregel
category: Werkruimtegereedschap
order: 93
summary: `githuttbr .` opent een repository — en `githuttbr doctor` antwoordt zonder iets te openen.
keywords: cli opdrachtregel commandoregel terminal shim path installeren openen map enkele instantie doctor status repos commit-check config editor completions wait core.editor blame show search werkwoorden exitcode ci hook
---

# De opdrachtregel

Vanuit een terminal stel je twee soorten vragen, en `githuttbr` beantwoordt ze
allebei.

De eerste is *“laat me dit zien”* — je zit in een kloon, er moet iets bekeken
worden, en de app is de juiste plek om ernaar te kijken. Zulke aanroepen openen
een venster, zo dicht mogelijk bij waar je naar vroeg.

De tweede is *“zeg het nu”* — een hook, een CI-taak, of jijzelf, midden in een
pipe, die een antwoord en een exitcode wil in plaats van een venster. Die starten
de app nooit: ze schrijven naar stdout en gaan uit de weg.

```sh
githuttbr .                        # open deze map
githuttbr blame src/api.ts -l 84   # …bij de blame van die regel
githuttbr doctor                   # geen venster: controleert de repo, exit 1 bij falen
```

## Installeren

Opdrachtenpalet (<kbd>⌘K</kbd>) → **Installeer het 'githuttbr'-commando in PATH**.
Op macOS wordt een kleine shim gelinkt in `/usr/local/bin` of
`/opt/homebrew/bin`, en worden beheerdersrechten alleen gevraagd als geen van
beide voor jou schrijfbaar is. Op Linux gaat hij naar `~/.local/bin`, waarvoor
helemaal geen rechten nodig zijn. Hetzelfde commando verwijdert hem weer. Windows
wordt nog niet ondersteund.

Daarna, desgewenst:

```sh
githuttbr completions zsh >> ~/.zshrc     # of bash, of fish
```

## Dingen openen

| Commando | Opent |
|----------|-------|
| `githuttbr [pad]` | De repository (standaard: de huidige map) |
| `githuttbr open <naam>` | Een repository op **tabbladnaam** — `githuttbr open api` |
| `githuttbr diff` | De wijzigingen in de werkkopie |
| `githuttbr graph` | De commitgrafiek |
| `githuttbr show <ref>` | Eén commit — `HEAD~2`, een tag, een korte hash |
| `githuttbr blame <bestand>` | Blame voor een bestand; met `-l 84` land je op een regel |
| `githuttbr search <zoekterm>` | Codezoeken, met de zoekterm al ingevuld |
| `githuttbr stack`, `stash`, `reflog`, `conflicts`, `todos`, `chat`, `settings` | Dat paneel |
| `githuttbr ci`, `clean`, `bisect`, `absorb`, `snapshots`, `insights`, `terminal` | …enzovoort |

`githuttbr help verbs` toont de volledige lijst. Drie opties gelden voor allemaal:
`-n <naam>` zet de weergegeven tabbladnaam, `-g <groep>` plaatst het in een
groepstabblad (dat zo nodig ontstaat), en `-l <n>` kiest een regel.

GitHuttBr draait als **enkele instantie**: `githuttbr` uitvoeren terwijl de app open
staat, geeft het verzoek door aan dat venster in plaats van een tweede kopie te
starten. Een pad dat al open is — als tabblad of binnen een groep — krijgt
**focus**, geen duplicaat. Een map die nog geen repository is, opent alsnog en
biedt “repository hier initialiseren” aan.

## Antwoorden in de terminal

Deze printen en stoppen. Er opent geen venster, en de app hoeft niet eens te
draaien.

### `githuttbr status`

Branch, tracking, voor/achter, werkkopie, stashes en — als de repository er een
meelevert — de [pushchecklist uit `.githuttbr.json`](repo-config.md). Exit 1
wanneer de werkkopie conflicten heeft, dus `githuttbr status || echo geblokkeerd`
werkt.

### `githuttbr doctor [--fix]`

Voert dezelfde controles uit als het paneel voor
[repositoryconfiguratie](repo-config.md): de Node-versie, submodules, LFS,
`core.hooksPath`, vereiste bestanden. **Exit 1 als een controle faalt**, en dat
is het hele punt — de regels die een repository verklaart zijn weinig waard als
alleen degene met de interface open ze ooit ziet:

```yaml
- run: githuttbr doctor          # in CI, vóór alles wat duur is
```

`--fix` past de reparaties toe die de dokter kent (submodules initialiseren,
`lfs pull`, `core.hooksPath` zetten, een bestand vanuit zijn voorbeeld kopiëren)
en controleert opnieuw. Hij voert nooit een commando uit dat de configuratie
aanleverde — de verzameling reparaties is gesloten.

Waarschuwingen laten de run niet falen. Een waarschuwing betekent dat de dokter
iets niet kon vaststellen, niet dat er iets mis is, en builds daarop laten falen
zou het bestand te duur maken om in te voeren.

### `githuttbr commit-check [bestand]`

Controleert een commitbericht. Zonder argument leest het `.git/COMMIT_EDITMSG`;
`-m "…"` controleert een tekst. Het weet wat de repository verklaarde: een
onbekende scope is een **fout** wanneer `.githuttbr.json` scopes opsomt, en louter
stijladvies wanneer niet. Hang het in een hook:

```sh
# .husky/commit-msg
githuttbr commit-check "$1"
```

### `githuttbr config init | show | check`

`init` leest de repository en stelt een `.githuttbr.json` voor op basis van wat er
al is — `.nvmrc`, `.gitmodules`, een `.env.example` zonder `.env`, de
commit-scopes die de geschiedenis gebruikt. `--dry-run` print in plaats van te
schrijven. `show` toont het huidige bestand; `check` valideert het en somt elk
veld op dat zou wegvallen.

### `githuttbr repos [filter]`

Elke repository die GitHuttBr kent — open tabbladen eerst, dan de recente — met de
groep. `--paths` print kale paden, één per regel, om te scripten:

```sh
cd "$(githuttbr repos --paths api | head -1)"
```

## GitHuttBr als editor van git

```sh
githuttbr editor install
```

zet `core.editor` en `sequence.editor` op `githuttbr --wait`. Vanaf dan openen
`git commit` (zonder `-m`), `git commit --amend`, `git tag -a` en
`git rebase -i` hun bestand in GitHuttBr in plaats van vim, met een tellertje en
dezelfde hints over het commitbericht als de composer toont.

![De editor die GitHuttBr opent wanneer git erom vraagt](../../screenshots/cli-edit.webp)

Het woord dat telt is **wacht**: git hangt aan dat dialoogvenster. Dus

- **Opslaan en doorgaan** schrijft het bestand terug en git gaat verder.
- **Annuleren** schrijft een leeg bestand, wat git leest als *afbreken*.
- Het venster op een andere manier sluiten — Escape, de achtergrond, GitHuttBr
  afsluiten — telt als Annuleren. Een terminal die eeuwig wacht zou veel erger
  zijn dan een bericht dat je opnieuw moet typen.

Voeg `--local` toe om het tot één repository te beperken, en draai het terug met
`githuttbr editor uninstall`.

## Wat het niet doet

- **Geen enkel terminalwerkwoord wijzigt de repository.** `doctor --fix` is de
  enige uitzondering, en zijn reparaties zijn een vaste lijst die geen
  configuratiebestand kan uitbreiden.
- **`repos` leest alleen.** De draaiende app bezit haar instellingenbestand; de
  CLI leest het en schrijft het nooit.
- **Een werkwoord dat de geïnstalleerde app niet kent, wordt genegeerd**, niet
  geweigerd — een nieuwere shim opent bij een oudere app alsnog de repository.
- **Windows heeft nog geen shim.** De werkwoorden zijn allemaal geïmplementeerd;
  alleen het installatiepad ontbreekt.

**Zie ook:** [Werkruimtes, tabbladen en groepen](workspaces.md) ·
[Repositoryconfiguratie](repo-config.md) · [Committen](committing.md)
