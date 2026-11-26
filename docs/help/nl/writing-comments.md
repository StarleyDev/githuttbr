---
title: Reacties schrijven
category: Synchroniseren & meerdere repo's
order: 57.5
summary: De Markdown-editor achter elk reactievak — Schrijven / Voorbeeld, een opmaakbalk met de sneltoetsen van GitHub, lijsten die doorgaan bij Enter, en aanvulling van @vermeldingen / #verwijzingen.
keywords: markdown-editor reactievak werkbalk vet cursief code link citaat kop opsomming genummerde lijst takenlijst checklist voorbeeld schrijven sneltoets vermelding apenstaartje verwijzing hekje issuenummer automatisch aanvullen antwoord pull-requestbeschrijving issuetekst markdown editor comment box toolbar mention reference autocomplete reply
source: cc7673de22ce745f04a0341c4d263219c432b693
---

# Reacties schrijven

Een reactie die naar GitHub gaat is Markdown, en een kaal tekstvak laat je elke
`**` en `- [ ]` met de hand typen, om daarna in de browser te ontdekken of de tabel
goed werd weergegeven. Elk vak in de app dat naar een host schrijft, is nu
dezelfde editor, met het gereedschap dat het reactievak van GitHub zelf heeft:

- het reactievak van een pull request, zijn antwoorden in threads en zijn
  regelreacties ([Pull-requestspagina](pull-requests.md));
- het reactievak van een issue;
- de beschrijving van een nieuwe pull request en de tekst van een nieuw issue
  ([Hosting & pull requests](hosting.md)).

![Het reactievak van een pull request, met de opmaakbalk en de lijst met te vermelden mensen open op "@al"](../../screenshots/comment-editor.webp)

## Schrijven en Voorbeeld

**Voorbeeld** toont de tekst zoals hij wordt weergegeven, getekend door dezelfde
Markdown-renderer als de rest van de app. Hij is alleen-lezen; **Schrijven** brengt
het veld terug met de tekst en de cursor waar je ze liet, dus ⌘/Ctrl+Z maakt nog
steeds ongedaan wat je typte voordat je keek.

De tabbladen vormen een tablijst: als er een de focus heeft, wisselen ← en →
ertussen.

## De werkbalk

| Gereedschap | Sneltoets | Wat het doet |
|---|---|---|
| **Kop** | — | Een menu met H1, H2 en H3 voor de geselecteerde regels; het niveau kiezen dat een regel al heeft, haalt het weg |
| **Vet** | ⌘/Ctrl+B | `**tekst**` |
| **Cursief** | ⌘/Ctrl+I | `_tekst_` |
| **Code** | ⌘/Ctrl+E | `` `code` `` binnen een regel; een omheind ```` ``` ````-blok als de selectie meerdere regels beslaat |
| **Link** | ⌘/Ctrl+K | `[tekst](url)` — een geselecteerde URL wordt het adres, andere tekst het label |
| **Citaat** | — | `> ` voor elke geselecteerde regel |
| **Lijst met opsommingstekens** | ⌘/Ctrl+Shift+8 | `- ` voor elke geselecteerde regel |
| **Genummerde lijst** | ⌘/Ctrl+Shift+7 | `1. `, `2. `… voor elke geselecteerde regel |
| **Takenlijst** | — | `- [ ] ` voor elke geselecteerde regel |

Elk gereedschap is een schakelaar: toegepast op tekst die het al heeft, haalt het
het weg. Zonder selectie voegen vet, cursief, code en link een plaatshouder in en
selecteren die, klaar om overheen te typen. Een lijstgereedschap vervangt een lijst
van een ander soort in plaats van erop te stapelen.

De bewerkingen lopen via de eigen bewerking van het tekstveld, dus **⌘/Ctrl+Z maakt
een gereedschap ongedaan** precies zoals een getypt woord, en opnieuw doen brengt
het terug.

De balk is één tabstop; ← → gaan tussen zijn knoppen, en ↓ opent het kopmenu. In
een reactievak maakt ⌘/Ctrl+K een link in plaats van het opdrachtenpalet te openen.
Op een Mac gebruiken de sneltoetsen alleen ⌘, zodat Ctrl+B, Ctrl+E en Ctrl+K blijven
doen wat tekstvelden in macOS ermee doen. Bij een toetsenbordindeling zonder Latijnse
letters volgen de sneltoetsen de fysieke toetsen B, I, E en K.

## Lijsten

**Enter** aan het eind van een lijstitem begint het volgende — hetzelfde
opsommingsteken, het volgende nummer, een lege `- [ ]` voor een taak — met dezelfde
inspringing. Enter op een item zonder iets na zijn markering beëindigt de lijst en
haalt de markering weg. Shift+Enter is een gewone nieuwe regel.

## Vermeldingen en verwijzingen

**@** typen opent een korte lijst met mensen, die smaller wordt terwijl je typt;
**#** toont pull requests en issues op nummer en titel (`#42`, of `#zoekterm` voor
een woord uit de titel). ↑ ↓ kiezen, Enter of Tab voegt in, Esc sluit de lijst —
alleen de lijst, niet het vak of het dialoogvenster eromheen.

De lijst komt uit wat de app al heeft, zonder de host opnieuw te vragen:

| Vak | @ biedt | # biedt |
|---|---|---|
| Pull request | Zijn auteur, reviewers, toegewezenen en iedereen die reageerde | De open pull requests en issues van de repository, zoals geladen in de zijbalk |
| Issue | Zijn auteur, toegewezenen en wie reageerde | Hetzelfde |
| Nieuwe pull request | De mensen die zijn keuzelijsten voor reviewer en toegewezene lezen, en de auteurs van de geladen pull requests | Hetzelfde |
| Nieuw issue | De auteurs van de geladen pull requests en issues | Hetzelfde |

Een **@** of **#** binnen een woord (een e-mailadres), de `#` van een kop en alles
binnen code blijven ongemoeid.

## Versturen

⌘/Ctrl+Enter verstuurt vanuit elk vak: een reactie op een pull request of issue,
een antwoord in een thread, een regelreactie en de beschrijving van een nieuw
issue. Het werkt ook vanuit de tabbladen, de werkbalk en het voorbeeld, niet alleen
vanuit het veld. Esc annuleert een regelreactie, vanaf dezelfde plekken. Een
**antwoord in een thread** was vroeger een veld van één regel dat met Enter werd
verstuurd; nu is het een klein tekstvak, dus Enter is een nieuwe regel (of het
volgende lijstitem) en ⌘/Ctrl+Enter verstuurt. Een antwoordvak toont zijn
tabbladen en gereedschap zodra je erin klikt, zodat een lang gesprek niet onder
elke thread een werkbalk krijgt.

## Het spiekbriefje

**Markdown ondersteund**, onder elk vak, opent ter plekke een spiekbriefje: elke
opmaak, wat je ervoor typt en de sneltoets. Esc of een klik ergens anders sluit
het. Niets van wat je schrijft verschuift.

Onderaan opent **Volledige handleiding openen** deze pagina. Het handboek is een
eigen tabblad, dus erheen gaan verlaat de pagina waar het vak op staat, en de niet
verstuurde tekst zou verloren gaan: als die er is — in dit vak of in een ander op
de pull-requestspagina —, vraagt de app het eerst. In de dialoogvensters voor een
nieuwe pull request en een nieuw issue heeft het briefje die link niet, omdat het
handboek achter het dialoogvenster zou openen.

## Beperkingen

- **Geen bijlagen.** Een bestand in het vak slepen of een afbeelding plakken uploadt
  niets: GitHub heeft geen openbare API voor bijlagen bij reacties, dus er is geen
  plek voor het bestand. Upload het op de website en plak de link.
- **Alleen wie en wat al geladen is.** @ doorzoekt niet de gebruikers van de host,
  en # niet alle issues — iemand die niet aan het gesprek heeft deelgenomen, of een
  gesloten issue dat de zijbalk niet heeft gelezen, wordt niet aangeboden. Je kunt
  de naam of het nummer nog steeds volledig typen.
- **Geen voorgestelde wijzigingen, opgeslagen antwoorden of emojikiezer.**
- **Het voorbeeld is de renderer van de app.** Het toont Markdown zoals de app het
  tekent; de weergave van de host kan in details afwijken (GitHub-eigen extensies,
  vermeldingen die links worden).
- **Het voorbeeld is de weergave van de app, niet die van de host.** Op de pull-request-
  en issuepagina tekent het voorbeeld de tekst zoals de geplaatste reactie in de app
  wordt getoond ([hoe reacties worden getoond](pull-requests.md#hoe-reacties-worden-getoond)): hetzelfde
  strikte profiel, regeleinden behouden, en een afbeelding van een andere site die op
  een klik wacht. Op GitHub wordt de geplaatste reactie daarna door GitHub getekend,
  dus een extensie die de app niet kent, kan er anders uitzien. De dialoogvensters
  voor een nieuwe pull request en een nieuw issue gebruiken het gewone
  Markdown-voorbeeld van de app.
- De sneltoetsen liggen vast: ze staan niet in de instellingen voor sneltoetsen en
  volgen daar geen nieuwe toewijzing.
