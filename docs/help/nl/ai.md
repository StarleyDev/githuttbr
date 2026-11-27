---
title: AI-functies
category: AI
order: 80
summary: Optioneel, providerneutraal en geworteld in je echte code.
keywords: ai openai anthropic ollama lokaal llm commitboodschap commit message uitleggen explain review wiki grounded accounts account api-sleutel abonnement cli claude codex gemini modellen traag timeout duurt langer blijven wachten annuleren reageert niet ollama gesloten account wisselen ander account schrijfvoorkeuren commitstijl eigen instructies co-auteur hover uitleg eigen ai algemene ai
---

# AI-functies

Elke AI-functie is **optioneel** en staat uit tot je een provider instelt. Er
gaat niets ergens naartoe tot je om iets specifieks vraagt.

![AI-instellingen](../../screenshots/settings-ai.webp)

## Eén AI voor elk profiel

De AI stel je één keer in, onder **Instellingen → AI**, en elk [profiel](profiles.md)
gebruikt hem: een profiel dat je later aanmaakt, heeft de AI al, zonder dat je
opnieuw een account toevoegt. De pagina toont elk profiel en of het deze
**algemene AI** volgt.

Een profiel kan in plaats daarvan **een eigen AI** gebruiken — een werkprofiel
dat via het account van het bedrijf moet, om kosten of om databeleid, of dat
zijn commits anders schrijft. Zet op de pagina **Profiel** van dat profiel,
onder *AI van dit profiel*, **Algemeen** op **Eigen**: hij begint als kopie van
de hele algemene AI — accounts, sleutels en voorkeuren — en vanaf dan is dat
allemaal alleen van dat profiel. Terug naar **Algemeen** verwijdert hem, na een
bevestiging, en laat de algemene AI zoals hij was.

Een profiel gebruikt één AI **in zijn geheel**: de algemene of zijn eigen, nooit
een mengsel. De accounts en modellen *en* hoe de AI schrijft en wat de chat mag,
komen van dezelfde plek, dus wie de commitstijl van de algemene AI wijzigt,
wijzigt die voor elk profiel dat hem volgt.

Elke AI stel je op deze ene pagina in. De balk **Bewerken** bovenaan kiest
welke: de algemene AI, of de eigen AI van een profiel (*Eigen AI van Werk*).
**Eigen AI instellen** op de pagina Profiel, of **Eigen AI bewerken** in de
lijst met profielen, opent de pagina op die AI. De pagina Profiel toont alleen
welke AI het profiel gebruikt en wat er antwoordt — de editor staat er nooit op,
en eigen AI-opties evenmin.

![De AI van een profiel op zijn pagina Profiel: Algemeen of Eigen, wat er antwoordt, en de weg om hem in te stellen](../../screenshots/settings-profile-ai.webp)

Onder de accounts houdt dezelfde pagina bij hoe die AI **schrijft** en wat hij
mag, in secties:

| Sectie | Bevat |
|---|---|
| **Commitberichten** | De commitstijl — Conventional, Gitmoji en Ticket als kaarten met een voorbeeldregel, de rest onder *Meer stijlen* — *Commit-omschrijving genereren*, de co-auteursregel, **Extra regels voor commits** en een voorbeeldweergave |
| **Uitleg & hover** | Stijl van uitleg, *Code uitleggen bij hoveren* en de bijbehorende toets |
| **Conflicten & branches** | Stijl voor conflictoplossing, stijl voor branchnamen, elk met een voorbeeld van het resultaat |
| **Repository-chat** | Of de chat aan staat, wat hij leest, welke acties hij mag voorstellen — zie [Repository-chat](repo-chat.md#instellingen) |

Een regel boven de secties zegt wiens AI je bewerkt en wie hij bereikt:
*algemene AI · geldt voor Werk en Privé*, of de eigen AI van één profiel.

**Extra regels voor commits** — tot 4.60 *Eigen instructies* — gaan alleen mee met het genereren van commitberichten: de chat, uitleg, reviews en branchnamen lezen ze niet. De voorbeeldweergave is een vast voorbeeld, geen modelaanroep: hij toont de vorm van de gekozen stijl, niet wat de AI voor jouw wijziging schrijft.

![Commitberichten](../../screenshots/settings-ai-commits.webp)

De stijlschakelaar in de opsteller en de model- en goedkeuringskiezers van de
chat schrijven naar dezelfde AI die het profiel leest: de algemene of de eigen
AI van het profiel.

Upgraden vanaf een versie waarin elk profiel zijn eigen AI had, kost niets: de AI
van het profiel dat in gebruik is, wordt de algemene AI, en elk ander profiel met
een afwijkende AI houdt die als eigen AI.

**Upgraden vanaf 4.59 of eerder**, toen de schrijfvoorkeuren per profiel waren
opgeslagen: eenmalig gaan de voorkeuren van het profiel dat in gebruik is (of,
als dat een eigen AI heeft, van het eerste profiel op de algemene AI) naar de
algemene AI. Profielen met een eigen AI houden die van hen. **De grens:** als
twee profielen op de algemene AI verschillend schreven — een werkprofiel met
`ticket` en een persoonlijk met `conventional` — schrijven ze nu allebei zoals
het profiel dat is overgezet. Wil je het verschil houden, geef een van beide dan
een eigen AI en stel daar de stijl opnieuw in.

## Providers

Een **account** is één manier om een model te bereiken: een aanbieder, waar je
die bereikt en hoe die zich authenticeert. Je kunt er meerdere instellen en ze
bestaan naast elkaar — een werksleutel, een persoonlijke, een lokaal model, een
CLI waarop je al bent ingelogd.

Er zijn presets voor **OpenAI, Anthropic, Google Gemini, OpenRouter, Groq,
Mistral** en **Ollama** (volledig lokaal), plus elk OpenAI-compatibel endpoint.

**Een sleutel verlaat deze machine nooit onversleuteld.** Een account met een
sleutel bereikt zijn endpoint via `https://`, of via gewoon `http://` alleen op
deze computer (`localhost`, `127.x`, `::1`). Een aanroep die de sleutel via
`http://` naar een andere host zou sturen, wordt geweigerd voordat er iets
vertrekt, en zegt dat. Een endpoint zonder sleutel — Ollama op een andere
machine in je netwerk — blijft via `http://` werken.

Anthropic gebruikt zijn eigen `/v1/messages`-API in plaats van een
OpenAI-vormige aanroep, dus Claude-modellen werken echt in plaats van er alleen
op te lijken. Gemini wordt bereikt via Googles OpenAI-compatibele endpoint.

### De lijst met providers

Elke opgeslagen provider is een kaart: een letter voor de provider, de naam en
daaronder wat hij echt gebruikt — zo zijn twee accounts van dezelfde provider
uit elkaar te houden zonder er een te openen.

| Soort provider | Tweede regel |
| --- | --- |
| Abonnement of lokale CLI | `CLI claude · sonnet` — de opdracht, dan het model |
| Ollama of eigen server | `http://localhost:11434 · qwen3:8b` — het adres, dan het model |
| Gehoste API | `gpt-4o-mini · 41 modellen` — het model, en hoeveel de provider er opsomde |

Het aantal modellen verschijnt pas als de provider zijn modellen heeft opgesomd;
de ingebouwde reservelijst van GitHuttBr is een gok, geen telling. Het
statuslabel staat rechts. De kaart die je bewerkt heeft een accentrand; een die
niet antwoordt heeft een rode rand en de reden onder de naam, eindigend op
**Opnieuw testen**. Klik op een kaart om hem te openen in de editor onder de
lijst.

### Een provider toevoegen en bewerken

Een half ingevulde, opgeslagen provider was een stille val: een lege sleutel kon
in gebruik raken, en niets antwoordde. Daarom wordt er op deze kaart niets
opgeslagen terwijl je typt.

**Provider toevoegen** opent een kaart met **Concept · niet opgeslagen** en een gestippelde
rand. Vul provider, sleutel, endpoint en model in en kies
**Testen en opslaan**. GitHuttBr vraagt eerst met die sleutel de modellen
van de provider op — hetzelfde verzoek als de vernieuwknop naast **Model** — en slaat pas op
als hij antwoordt. Je ziet **Verbonden · N modellen**, en de provider staat in de
lijst als **Klaar**.

Mislukt de test, dan toont de kaart **Kan geen verbinding maken** met de reden
van de provider (een geweigerde sleutel, `401`; een server die niet draait) en
**Er is niets opgeslagen.** Verbeter het veld en test opnieuw, kies
**Toch opslaan** om hem zo te houden — hij staat dan op
**Reageert niet** — of **Annuleren**, dat geen spoor achterlaat.

Een opgeslagen provider bewerken werkt hetzelfde. Een banner meldt
**Niet-opgeslagen wijzigingen — er verandert niets tot je opslaat**, en elk veld dat je aanraakte krijgt
**· gewijzigd**. **Wijzigingen verwerpen** zet de opgeslagen waarden
terug; **Testen en opslaan** test en slaat op. Met openstaande wijzigingen
een andere provider kiezen, er een toevoegen of **Mijn abonnement gebruiken** openen vraagt
**Wijzigingen aan ‘…’ opslaan?** — **Opslaan**, **Wijzigingen verwerpen** of
**Verder bewerken**. Instellingen sluiten houdt het concept in het
geheugen, zodat het er nog is als je terugkomt; het wordt nooit naar schijf
geschreven.

Sleutels worden precies zoals vroeger in je sleutelbos opgeslagen, en alleen
bij opslaan. De fout van een provider wordt getoond met de sleutel en alles wat
op een token lijkt gemaskeerd.

![Een provider toevoegen en bewerken](../../screenshots/ai-provider-draft.webp)

![Een opgeslagen provider bewerken: het adres is gewijzigd en nog niet opgeslagen](../../screenshots/ai-provider-editing.webp)

| Soort provider | Wat **Testen en opslaan** controleert |
| --- | --- |
| API-sleutel of lokale server (Ollama, eigen endpoint) | Vraagt de modellen op; succes betekent dat het endpoint met deze sleutel antwoordde |
| Abonnement (Codex, Claude Code) | Stuurt de korte testprompt die hieronder staat, van het tegoed van je abonnement |
| Lokale CLI | Zoekt het commando in je `PATH`; een getypt pad wordt zonder controle opgeslagen |

### Statuslabels

Elke provider in de lijst heeft één label, afgeleid van wat de pagina al weet —
de laatste test, of de modellenlijst die ze toch al ophaalde. Er wordt niets op
de achtergrond gepeild.

| Label | Betekenis |
| --- | --- |
| **Klaar** | De laatste test of modellenlijst is gelukt |
| **Reageert niet** | De laatste poging mislukte; de reden staat op de regel eronder, met **Opnieuw testen** |
| **Geen sleutel** | De provider heeft een API-sleutel nodig en heeft er geen |
| **Niet gecontroleerd** | Nog niets heeft hem iets gevraagd — een abonnement tot het getest is, of een lijst die niet is opgehaald |

**De grens:** een label is zo vers als de laatste controle. Een provider die een
uur geleden stopte met antwoorden staat nog op **Klaar** tot
iets hem opnieuw vraagt — kies **Verbinding testen** op zijn kaart om zeker te
zijn. Een **lokale CLI** met een getypt pad blijft
**Niet gecontroleerd**, omdat bewijzen dat hij werkt een prompt zou
kosten.

### De provider in gebruik

Eén provider beantwoordt elke taak die onder **Model per taak** geen eigen
provider heeft. Zijn rij is gemarkeerd **In gebruik** — direct na de naam — en blijft op haar plek in de lijst. De algemene AI en een profiel
met een eigen AI hebben elk hun eigen provider in gebruik; de lijst wijzigt die
je aan het bewerken bent.

Elke andere opgeslagen provider heeft rechts in zijn rij, naast zijn badge, een
knop **Gebruiken**. Eén klik zet hem in gebruik en slaat meteen op: welke
provider antwoordt is een keuze, geen bewerking, dus het wacht niet op **Testen
en opslaan**. De kaart van die provider gaat niet open, en een kaart met niet
opgeslagen wijzigingen houdt ze.

**De grens:** **Gebruiken** test niets. Een provider met **Geen sleutel** of
**Reageert niet** kan in gebruik worden gezet — bewust, voordat je de sleutel
herstelt — en zijn badge blijft dat zeggen; de volgende AI-taak mislukt met de
reden van die provider. Een concept heeft geen **Gebruiken**: het is pas een
provider als het is opgeslagen.

### De AI in gebruik, vanuit de statusbalk

Een profiel met een eigen AI negeert de aanbieder die de algemene AI gebruikt:
een andere aanbieder in gebruik nemen op de algemene AI verandert niets voor dat
profiel, en buiten Instellingen zei niets dat. De statusbalk onderaan een
repository zegt het nu. De knop **AI:** _aanbieder_ noemt de aanbieder die voor
het actieve profiel antwoordt, met een stip voor de status — groen **Klaar**,
rood **Reageert niet**, oranje **Geen sleutel**, grijs **Niet gecontroleerd**.

Een klik opent een klein paneel:

| Onderdeel | Wat het toont |
| --- | --- |
| Kop | Het actieve profiel, en of het **de algemene AI volgt** of **een eigen AI heeft** |
| Eén rij per aanbieder | Elke opgeslagen aanbieder van die AI, met model en status; een aanbieder die niet reageert toont de reden op een tweede regel |
| **In gebruik** / **Gebruiken** | De aanbieder die nu antwoordt, en wisselen met één klik bij elke andere |
| **AI instellen** | Opent **Instellingen → AI** |
| **Gebruik en kosten** | Opent het tabblad *Statistieken* van de repository-instellingen |

**Gebruiken** schrijft waar het profiel zijn AI leest. Op een profiel dat de
algemene AI volgt verandert het de algemene AI — en dus elk profiel dat die
volgt; op een profiel met een eigen AI alleen die. Taken met een eigen
aanbieder houden die. **Esc** sluit het paneel, en de knop is verborgen zolang
AI uit staat.

![De AI in gebruik vanuit de statusbalk: het profiel, zijn AI en elke aanbieder met zijn status](../../screenshots/statusbar-ai.webp)

**De grenzen:** de stip komt uit de modellijst die de app toch al ophaalde (tot
een dag bewaard) en test nooit iets, dus een aanbieder die niet meer antwoordt
kan nog **Klaar** tonen — de verbinding testen in Instellingen is de manier om
het zeker te weten. Zolang Instellingen niet geopend is, heeft het venster de
sleutels zelf niet, dus een aanbieder zonder sleutel kan daar **Niet
gecontroleerd** of **Reageert niet** tonen in plaats van **Geen sleutel**. Net
als **Gebruiken** in Instellingen test het wisselen de aanbieder niet.

### Een abonnement in plaats van een API-sleutel

Kies in **Instellingen → AI** **Mijn abonnement gebruiken**. Bij de [eerste
start](first-run.md) vindt de kaart **Mijn abonnement** in de AI-stap Claude
Code of Codex en test die in één stap; wordt er geen gevonden, dan valt hij
terug op deze zelfde instelling. Kies het abonnement dat je gebruikt en open dan
**Documentatie** voor de installatie-instructies van de provider. Na de
installatie kies je **ChatGPT (Codex) verbinden** of **Claude (Claude Code)
verbinden**. De CLI van de provider opent zijn aanmeldpagina in je browser en
bewaart zijn eigen sessie. Een bestaande abonnementssessie wordt hergebruikt.
**Annuleren** stopt een lopende verbinding. Een aanmelding die langer dan drie
minuten duurt, stopt en kan opnieuw worden geprobeerd.

| Abonnement | Benodigde CLI | Aanmelden vanuit een terminal |
| --- | --- | --- |
| ChatGPT met toegang tot Codex | Codex CLI | `codex login` en kies ChatGPT |
| Claude met toegang tot Claude Code | Claude Code | `claude auth login` en kies je abonnementsaccount |

Verbinden test ook de sessie. Heb je je in een terminal aangemeld, kies dan
**Verbinding testen**. GitHuttBr controleert de aanmeldmethode van de CLI en
stuurt een korte testprompt vanuit een lege tijdelijke map. Het verzoek telt mee
voor het tegoed van je provider. Na **Gekoppeld** kies je **Provider
toevoegen**. Het eerste account van de algemene AI wordt **In gebruik** gezet.
Voor een bestaande instelling kies je **Gebruiken** op zijn rij of wijs je
hieronder losse functies toe. Wil je de instelling bij de eerste start
overslaan, kies dan **Overslaan, geen AI** en kom terug naar Instellingen
wanneer je zover bent.

Vindt GitHuttBr de CLI niet, installeer hem dan of vul het volledige pad naar
het programma in en test opnieuw. Is de aanmelding verlopen of gebruikt de CLI
een API-sleutel, meld je dan aan met het abonnementsaccount. Bereik je een
gebruikslimiet, wacht dan tot het tegoed van de provider wordt hersteld.

![Mijn abonnement gebruiken](../../screenshots/ai-subscription.webp)

Voor handmatige instelling kies je de provider **Lokale CLI** om te antwoorden
met een agent-CLI die al op deze machine is geïnstalleerd en aangemeld —
`claude`, `gemini`, `codex` of `devin`. GitHuttBr start het programma met je
prompt en leest het antwoord; er is geen API-sleutel om te plakken en er wordt
geen token opgeslagen.

GitHuttBr draait alleen een commando dat je zelf als account hebt ingesteld, en
altijd met een lijst argumenten in plaats van een shell, zodat niets uit een
diff of een branchnaam als commando gelezen kan worden.

Elke aanroep start de CLI met de repository als werkmap, zodat agent-CLI's zoals
Devin de bestanden kunnen openen waar je naar vraagt in plaats van blind te
antwoorden. Functies zonder repository (thema's genereren) starten hem vanuit de
eigen map van de app.

> **Dit is niet privéer dan een API-sleutel.** Je prompts bereiken nog steeds
> dezelfde aanbieder, onder je eigen account, precies zoals met een sleutel. Wat
> verandert is de facturering en de installatie, niet waar de tekst heen gaat.

Staat het commando niet in je `PATH`, typ dan het volledige pad op het account.

### Model per taak

Onder **Model per taak** kan elke functie — commitberichten, chat,
uitleggen, PR-review, conflictoplossing, wiki, thema's — naar een eigen account
en model wijzen. Laat een rij op **Provider in gebruik** staan om de provider
met **In gebruik** te volgen. Een goedkoop model voor commitberichten en een
sterk model voor chat is de gebruikelijke verdeling.

### Upgrademelding

Wie bijwerkt vanaf een versie van vóór de accounts, ziet dit één keer. De aanbieder en sleutel die je had worden het eerste account; er hoeft niets met de hand opnieuw ingesteld te worden.

![Upgrademelding](../../screenshots/ai-accounts-notice.webp)

## Modellen

Modellijsten komen van de aanbieder zelf en worden een dag gecachet; de vernieuwknop naast **Model** ververst er één meteen. Onder de lijst zegt GitHuttBr waar die vandaan
komt — live, uit de cache (met tijdstip), of de ingebouwde reservelijst en
waarom.

De lijst is gefilterd op modellen die een chatverzoek kunnen beantwoorden, dus
embedding-, spraak- en beeldmodellen blijven eruit. Elk modelveld accepteert ook
vrije tekst, zodat een previewmodel, een privé-deployment of een net opgehaalde
Ollama-tag altijd bruikbaar is, ook als de aanbieder die niet noemt.

Een aanbieder die je nog geen sleutel gaf, of die onbereikbaar is, valt terug op
een kleine ingebouwde lijst in plaats van op een lege keuzelijst.

Geen enkele aanbieder publiceert een gerangschikte of samengestelde lijst, dus de bewerking is die van GitHuttBr: gedateerde snapshots vouwen samen in het model waarvan ze een snapshot zijn (`gpt-4o` dekt `gpt-4o-2024-08-06`), en de rest staat op datum in plaats van alfabetisch. **Alle modellen tonen**, onderaan de lijst, haalt alles terug wat de aanbieder stuurde.

## Wat het kan

| Functie | Wat je krijgt |
|---|---|
| **Commitboodschap** | Samenvatting (en optioneel een body) uit je gestagede diff, in de stijl die jij kiest |
| **Leg dit bestand uit** | Uitleg in gewone taal in een zijpaneel — Normaal, Beknopt, ELI5… zelfs Piraat |
| **Hover om uit te leggen** | Houd <kbd>⇧</kbd> ingedrukt en wijs een identifier aan voor een uitleg in één regel, plus de regels waarop die stoelt |
| **AI-bewerking van de selectie** | Selecteer regels in een bestand, beschrijf de wijziging, en het model herschrijft alleen die regels in het editorconcept |
| **Conflictoplossing** | Stelt een merge voor in de bewerkbare uitvoer — past nooit automatisch toe |
| **PR-review** | Vat een diff samen en markeert risico's, elk verankerd aan een echte `path:line` |
| **PR-beschrijving** · **branchnamen** | Opgesteld uit de commits en de diff van de branch |
| **Thema's** · **grafiekpaletten** | Gegenereerd uit een prompt |
| **Slim stagen** | Suggesties voor wat in deze commit thuishoort |
| **[Repository-chat](repo-chat.md)** | Gefundeerde vragen plus beoordeelde bestandswijzigingen, gevolgd door gevalideerde Git-acties |
| **AI-configuratiewizard** | Genereert assistentconfiguratiebestanden (instructies, agents, hooks) voor de repository — de toverstafknop in de koptekst van het chatpaneel |

### Alleen de geselecteerde regels bewerken

Sleep in de bestandsweergave over de regels die je wilt wijzigen en druk op
**AI-bewerking…** (of klik met rechts op een regel en kies het in het menu). Een
balk onderaan toont het geselecteerde bereik en neemt je instructie aan —
‘hernoem deze variabele’, ‘voeg null-controles toe’, ‘vertaal deze strings’. Het
model ziet de geselecteerde regels plus wat context eromheen en geeft alleen de
vervanging voor dat bereik terug, die in het **editorconcept** belandt in plaats
van op schijf. Je bekijkt hem daar en slaat op of verwerpt via de gewone
bewerkingsflow, dus er wordt niets geschreven tot jij dat zegt. Het werkt met
elke ingestelde backend, niet alleen met agent-CLI's, omdat het antwoord tekst
is en geen tool-aanroep. De beperkingen: het herschrijft één aaneengesloten
bereik per keer, kan geen hele bestanden maken of verwijderen, en een selectie
over meerdere diff-hunks wordt geweigerd — selecteer dan in de bestandsweergave.

## Geworteld, niet gegokt

De review ziet de diff als **gelabelde hunks** en mag alleen die labels citeren;
GitHuttBr herleidt elk label vervolgens naar een echt bestand en een echte regel.
Een model dat een locatie verzint wordt **afgewezen en opnieuw bevraagd**, zodat
bevindingen altijd naar bestaande code wijzen.

Hover-om-uit-te-leggen leest alleen een genummerd venster rond het token — in een
diff alleen de hunks die op het scherm staan — dus als een definitie ergens
anders woont, zegt het dat in plaats van iets te verzinnen. Antwoorden worden per
bestandsversie gecachet.

[Repository-chat](repo-chat.md) werkt net zo: hij mag alleen de fragmenten
citeren die hij kreeg, en het verzoek in twee stappen kiest die uit Gits eigen
lijst van gevolgde bestanden, niet uit iets wat het model schrijft. Stelt hij
een wijziging voor, dan valideert GitHuttBr exacte bestandsacties, berekent hun
diffs lokaal en voert daarna de volgende Git-acties uit volgens het ingestelde
goedkeuringsbeleid.

**Gemaskeerde geheime bestanden worden nooit verstuurd.** Evenmin bestanden die
onder de regels voor het maskeren van geheimen vallen — ook niet een bestand dat
je met de hand aan de chat vastzet; dat wordt met een reden geweigerd in plaats
van gelezen.

## Als een model traag is, of niet meer antwoordt

Een lokaal model op een laptop kan een minuut doen over een commitboodschap, en
een model dat "nadenkt" voor het antwoordt nog langer — maar een server die
midden in een verzoek is gesloten, hoort je niet naar een draaiend wieltje te
laten staren.

| Wat er gebeurt | Wat je ziet |
|---|---|
| Na 30 seconden geen antwoord | *"{account} doet er langer over dan verwacht om te antwoorden."*, met **Blijven wachten**, **{ander account} gebruiken** en **Annuleren**. Blijven wachten vraagt het een minuut later opnieuw als het nog loopt |
| Een lokale server (Ollama, LM Studio, llama.cpp…) wordt gesloten terwijl hij werkt | Binnen een paar seconden: *"{account} reageert niet. Draait het nog?"*, met een knop voor elk ander account dat klaar is voor gebruik, en **Annuleren** |
| De server was al gesloten toen je het vroeg | Hetzelfde, meteen |

**{ander account} gebruiken** annuleert het verzoek en stuurt hetzelfde naar dat
account, met het standaardmodel ervan — de commitboodschap, de review of het
chatantwoord komt binnen alsof je het daar had gevraagd. Je instellingen
veranderen niet: het volgende verzoek gaat weer naar het account dat je voor die
taak hebt gekozen.

Dit geldt voor elke AI-functie — commitboodschappen, chat, review, uitleggen,
conflicten, thema's, de wiki — omdat ze allemaal via dezelfde aanroep lopen.

## Grenzen

- **Alleen lokale servers worden in de gaten gehouden op sluiten.** Een
  cloudprovider die uitvalt, faalt met zijn eigen fout; een cloudaanroep die
  alleen traag is, krijgt net als elke andere de melding *duurt langer*. Een
  lokale server die bezig is in plaats van gesloten, telt als levend: alleen een
  geweigerde of verbroken verbinding beëindigt de aanroep eerder.

- De ingebouwde reservelijsten verouderen tussen releases. Daar is het live
  ophalen voor; de reserve dekt alleen het geval dat ophalen niet kan.
- Filteren op chatmodellen gebeurt op naam, dus een chatmodel met een ongewone
  naam kan wegvallen. Typ het dan zelf in.
- Een CLI-account kan het tokengebruik alleen melden als de CLI dat doet; de
  gebruiks- en kostencijfers in Instellingen tellen die aanroepen dus te laag.
- Antwoorden via een CLI zijn trager dan een directe API-aanroep: het programma
  start per verzoek een hele sessie.
- Sleutels worden per account in de sleutelhanger van je systeem bewaard. Een
  account verwijderen verwijdert zijn sleutel — het vraagt eerst, en ongedaan
  maken kan niet.
- Teruggaan naar een versie van vóór de algemene AI kost de sleutels van de
  algemene AI: die versie weet niet waar ze bewaard worden en laat ze vallen bij
  het opslaan. De accounts blijven; typ de sleutels opnieuw in. De eigen AI van
  een profiel blijft buiten schot.

**Zie ook:** [Repository-chat](repo-chat.md) · [Repo-wiki](repo-wiki.md) · [Beveiliging & geheimen](security.md)
