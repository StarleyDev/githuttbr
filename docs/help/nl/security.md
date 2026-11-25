---
title: Beveiliging & geheimen
category: Beveiliging
order: 70
summary: Maskeren, bewakingen, de sleutelhanger — en wat Gitcito weigert te doen.
keywords: beveiliging security geheimen secrets maskeren masking sleutelhanger keychain safeStorage tokens beschermde branch groot bestand bewaking privacy
---

# Beveiliging & geheimen

Gitcito heeft **geen backend**. De enige netwerkoproepen gaan naar je Git-host
en, als je dat aanzet, naar je AI-provider.

![Beveiligingsinstellingen](../../screenshots/settings-security.webp)

## Geheimen maskeren

Waarden in `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` en consorten
worden getoond als `KEY=••••••` in de diff-, bestands- en blameweergave, zodat
een gedeeld scherm of een schermafbeelding ze niet kan laten lekken.
Apple-ondertekeningsmateriaal telt mee: `*.mobileprovision`,
`*.provisionprofile`, `*.p12` en de `*.p8`-sleutels van App Store Connect. Een
`*.cer` niet — een certificaat is per ontwerp openbaar.

Het is **alleen weergave**: het verandert het bestand nooit en verandert nooit
wat je staget. Een oogschakelaar onthult ze per weergave. `.env.example`,
`.sample` en `.template` worden als sjablonen behandeld, niet als geheimen.

![Een .env met elke waarde gemaskeerd, en de onthulschakelaar](../../screenshots/secret-masking.webp)

## Bewakingen voor je schade aanricht

| Bewaking | Wanneer |
|---|---|
| **Geheimenbestand** | Iets committen dat op een credential lijkt — met een *Negeren & untracken* in één klik |
| **Groot bestand** | Een te grote blob committen (drempel in Instellingen → Beveiliging) |
| **Buildrommel** | `xcuserdata/`, `DerivedData/` of een `.DS_Store` committen — met dezelfde *Negeren & niet meer volgen* in één klik |
| **Beschermde branch** | Rechtstreeks naar `main`/`master` committen, of er een force-pushen |
| **Getrackte geheimen** | Een repository pushen die een geheimenbestand *trackt* — één waarschuwing per sessie |

## De OS-sleutelhanger

Tokens en [kluis](vault.md)-regels worden versleuteld met de sleutelhanger van je
besturingssysteem (Electron `safeStorage`), nooit met een sleutel in het
instellingenbestand.

**Er raakt niets de sleutelhanger tot jij het zegt.** Nog voor het eigen
toestemmingsvenster van het systeem kan verschijnen, legt Gitcito uit wat er
opgeslagen wordt, wat het niet kan (een app leest alleen ooit de regel terug die
het zelf aanmaakte — je andere wachtwoorden zijn onbereikbaar), en dat nee zeggen
prima is: tokens leven dan alleen in het geheugen voor die sessie, de kluis blijft
dicht, en je kunt het later aanzetten in **Instellingen → Beveiliging →
OS-sleutelhanger**.

Een verse installatie doet **nul** aanroepen naar de sleutelhanger tot er
werkelijk iets opgeslagen moet worden.

Zolang hij uit staat, meldt het tokenveld bij Integraties dat — *Alleen bewaard tot je Gitcito afsluit: de OS-keychain staat uit.* — met een knop **Inschakelen** ernaast. Inschakelen, daar of hier, bewaart ook de tokens die je in deze sessie al hebt ingevoerd, dus je hoeft niets opnieuw te plakken.

### Linux zonder sleutelhanger

Op Linux is de sleutelhanger een secret service — GNOME Keyring of KWallet. Als
er geen draait, „versleutelt” het systeem nog steeds, maar met een vast
wachtwoord dat op elke machine hetzelfde is: de tokens en sleutels zijn
door elkaar gehusseld, niet beschermd. Instellingen → Beveiliging zegt het onder
de status van de sleutelhanger — *Er draait geen sleutelhanger…* — zodat het
woord *sleutelhanger* nooit staat voor bescherming die er niet is.

Zodat er niets nieuws belandt in een opslag die iedereen kan ontrafelen, wordt
een token dat je typt terwijl er geen sleutelhanger draait **alleen bewaard tot
je afsluit**. Het tokenveld zegt het — *Alleen bewaard tot je Gitcito afsluit:
er draait geen sleutelhanger…* — zonder knop om het opnieuw te proberen, want
opnieuw proberen helpt niet; alleen een sleutelhanger helpt. Eerder opgeslagen
tokens blijven leesbaar — je wordt er nooit van buitengesloten — en er een
wissen of vervangen haalt de oude waarde nog steeds van de schijf. Twee
beperkingen: de sleutel van de algemene AI wordt niet naar zijn gedeelde plek
verplaatst (elk profiel blijft zijn eigen lezen), en de kluis slaat nog steeds
op in de eenvoudige opslag, omdat die geen modus voor alleen de sessie heeft.
Installeer of ontgrendel een sleutelhanger en start Gitcito opnieuw om nieuwe
tokens weer op te slaan.

## Instellingen importeren

**Instellingen → Importeren / exporteren** brengt instellingen, profielen en
thema's van de ene machine naar de andere. De standaardexport bevat **geen
tokens of API-sleutels**, en zo'n bestand importeren raakt de jouwe nooit aan —
een leeg token in het bestand betekent „niet in dit bestand”, niet „verwijder
de mijne”.

### Kiezen wat je importeert

Een instellingenbestand bevat twee soorten dingen: wat *jou* volgt (profielen,
thema, sneltoetsen) en wat alleen zin heeft op de machine die het schreef (de
mappen waar je repositories staan, het pad van je terminal). Alles toepassen op
een nieuwe computer vult de zijbalk met tabbladen die nergens heen wijzen. Dus
nadat je het bestand kiest (en het wachtwoord typt, als het er een heeft),
vraagt een venster welke onderdelen je wilt meenemen. Er wordt niets toegepast
tot je op **Importeren** drukt; **Annuleren** laat alles zoals het was.

![Instellingen → Gegevens → Importeren: vier onderdelen, de repositories niet aangevinkt omdat geen van hun mappen hier bestaat, en het vertalen van paden open](../../screenshots/settings-import.webp)

| Onderdeel | Wat het bevat |
|------|-----------------|
| **Profielen en accounts** | Profielen, Git-identiteit, integratiekoppelingen, de algemene AI-instellingen en profielafbeeldingen — en de inloggegevens en de [kluis](vault.md), als het bestand die heeft |
| **App-voorkeuren** | Thema, taal, sneltoetsen, indeling, de kleuren van de graaf en de pictogrammen |
| **Repository’s en workspaces** | Tabbladen, workspaces, favorieten, bijnamen, tabbladafbeeldingen, welk profiel elke repository gebruikt, gescande mappen, en de notities en wiki's per repository |
| **Programma’s op deze computer** | Terminal, externe editor, standaardapps en het pad van de AI-CLI's |

Elk onderdeel toont hoeveel items het bestand ervoor heeft. Een onderdeel dat je
niet aanvinkt blijft precies zoals het op deze machine is.

**Profielen worden samengevoegd met de jouwe.** Een bestand van een andere
computer heeft zelden elk profiel dat deze heeft — een account dat op de
Linux-laptop is toegevoegd, een klantprofiel dat alleen op de Mac bestaat. Dus
**Profielen en accounts** voegt de profielen uit het bestand toe aan de jouwe in
plaats van de lijst te vervangen. Voor je importeert, toont het onderdeel elk
profiel en wat ermee gebeurt:

| Label | Betekenis |
|-----|---------|
| **Bijgewerkt** | Het profiel staat in beide: identiteit, AI en afbeelding uit het bestand vervangen de jouwe, en de servers ervan worden aan de jouwe toegevoegd |
| **Nieuw** | Alleen het bestand heeft het: toegevoegd na de jouwe |
| **Blijft** | Alleen deze computer heeft het: blijft precies zoals het is |

Twee profielen zijn „hetzelfde” als ze een id delen — het eerste profiel van
elke installatie doet dat. Als geen id overeenkomt, telt de naam (zonder op
hoofdletters en omringende spaties te letten), en het profiel houdt **de id van
deze computer**: de repositories die eraan gekoppeld zijn, het actieve profiel,
de opgeslagen inloggegevens en de afbeelding blijven eraan vast. Welk profiel actief
is, verandert niet.

**Alles vervangen** is er nog steeds, voor een back-up die je precies terug wilt
zoals hij was: alleen de profielen uit het bestand blijven over, en die welke
alleen deze computer heeft staan doorgestreept als **Verwijderd**. Op
**Importeren** drukken vraagt dan nog één keer, met hun namen — ze verdwijnen
met hun opgeslagen inloggegevens en afbeelding, en dat kan niet ongedaan worden. Met
**Alles vervangen** wordt het actieve profiel uit het bestand het actieve.

Beperkingen: overeenkomen gaat alleen op id of exacte naam — een profiel dat aan
één kant hernoemd is telt als nieuw, en je houdt ze allebei. Een gekoppeld
profiel neemt de velden uit het bestand over, met drie uitzonderingen zodat
niets verloren gaat wat alleen deze computer heeft: de GitHub Enterprise-,
GitLab- en Bitbucket-servers worden aan de jouwe **toegevoegd** (bij een server
die beide hebben wint het item uit het bestand); een token dat het bestand leeg
meebrengt houdt het jouwe — maar alleen voor dezelfde instantie, zodat een token
nooit naar een andere Forgejo, een andere GitLab-uitgever of een andere
Azure-organisatie gaat; en de logins die van de credential helper van deze
machine komen blijven van deze machine.

**De standaardkeuzes zijn een gok op basis van je schijf.** Voordat het venster
verschijnt, controleert Gitcito of de repositorymappen uit het bestand hier
bestaan. Bestaat er geen enkele, dan komt het bestand van een andere computer:
**Repository’s** en **Programma’s** beginnen niet aangevinkt, elk met de
reden — de paden van de programma's staan erbij, zodat je ziet dat ze ergens
anders thuishoren. Bestaan ze wel, dan is het dezelfde computer (een
teruggezette back-up, bijvoorbeeld), begint alles aangevinkt en zegt een groene
notitie dat. Een bestand zonder enige repository wordt beoordeeld op de paden
van zijn programma's: **Programma’s** begint alleen aangevinkt als elk daarvan
hier bestaat.

Als de controle zelf mislukt, wordt er niets gegokt: **Repository’s** en
**Programma’s** beginnen niet aangevinkt zonder oordeel, een knop **Opnieuw
controleren** vraagt het de schijf nog eens, en **Repository’s** kan pas
geïmporteerd worden als een controle lukt. De andere onderdelen wel.

**Paden vertalen.** Vink **Repository’s** aan bij een bestand waarvan de mappen
ontbreken en er opent een vak **Paden vertalen**. Links de map die de
repositories in het bestand gemeen hebben (`/home/you/code`); rechts waar die
map op deze computer staat, vooraf ingevuld vanuit je thuismap
(`/Users/you/code`). Beide zijn bewerkbaar — de gok kan fout zijn, en als
Gitcito geen gemeenschappelijke map vindt laat het beide leeg zodat jij ze
typt. Een balk telt terwijl je typt hoeveel repositories hier nu een map
hebben, met een paar ervan in een lijst — groen gevonden, rood nog ontbrekend.
De wissel neemt de bijnaam, tabbladafbeelding en het profiel van de repository
mee, en de notities, wiki's en kluisitems, zodat je niets opnieuw met de hand
hoeft in te stellen.

De voettekst vat het samen — *3 van 4 onderdelen importeren · 31 mappen*
(scanmappen en de laatste kloonmap tellen ook mee, daarom staat er mappen en
niet repositories) — en **Importeren** blijft uit tot er minstens één onderdeel
is aangevinkt.

**Importeren blijft ook uit als een vertaling niets vindt.** Met
**Repository’s** aangevinkt en geen enkele map gevonden onder het nieuwe
voorvoegsel zou importeren je repositories leeg achterlaten; verbeter de paden
of vink het onderdeel uit.

Beperkingen van de vertaling:

- Het is **één voorvoegsel verwisseld voor een ander**. Repositories die in het
  bestand onder een andere map staan, of hier anders zijn ingedeeld, worden niet
  gevonden; er is geen koppeling per repository.
- Met een vertaling actief worden **alleen de repositories geïmporteerd die dan
  een map hebben**. De rest blijft buiten — niet toegevoegd als kapotte
  tabbladen — en het venster zegt je hoeveel.
- Programma's worden nooit vertaald: `/usr/bin/code` heeft geen betrouwbare
  tegenhanger op een ander systeem. Laat dat onderdeel uitgevinkt en kies ze in
  Instellingen.
- Een van beide voorvoegsels leegmaken importeert de paden zoals het bestand ze
  heeft.

**Tijdens het importeren** kan het venster niet weggeklikt worden. Als een
latere stap mislukt — de repositorynotities, de kluis, de profielafbeeldingen — blijft
het venster open, noemt het de stap, en gaat **Import voortzetten** daar verder
zonder de eerdere stappen opnieuw te schrijven.

### Inloggegevens in het bestand

Een bestand dat met de optie aangevinkt is geëxporteerd bevat inloggegevens.
Profielen samenvoegen **voegt** ze altijd **toe**: die uit het bestand komen
onder het bijbehorende profiel, ter vervanging van die voor hetzelfde account,
en alle andere opgeslagen inloggegevens blijven — ze wissen zou in strijd zijn
met het behouden van je profielen. Met de profielen op **Alles vervangen** toont
zo'n bestand ook de keuze, direct onder **Profielen en accounts**:

| Keuze | Je opgeslagen inloggegevens |
|--------|------------------------|
| **Toevoegen aan de mijne** | Die uit het bestand worden toegevoegd, ter vervanging van die voor hetzelfde account; alle andere blijven |
| **Alles vervangen** | Worden precies die uit het bestand — elk opgeslagen token en elke API-sleutel die het bestand niet heeft, wordt verwijderd |

De keuze geldt samen met de profielen: met **Profielen en accounts** niet
aangevinkt worden er geen inloggegevens geïmporteerd of verwijderd. Een bestand
dat zonder de optie is geëxporteerd heeft er geen te bieden, wat je ook
aanvinkt. **Alles vervangen** vraagt nog één keer als je op **Importeren**
drukt, met de mededeling dat elk opgeslagen token en elke API-sleutel die het
bestand niet heeft, verwijderd wordt; **Annuleren** daar laat het venster zoals
het was.

**Alles vervangen heeft de sleutelhanger nodig.** Met de sleutelhanger uit of
niet beschikbaar zouden de oude tokens in de versleutelde opslag blijven en bij
de volgende start terugkomen, dus weigert Gitcito: het zegt dat, en er wordt
niets geïmporteerd. Hetzelfde geldt zolang de opgeslagen tokens niet gelezen
kunnen worden: ze zouden terugkomen zodra dat wel kon. **Toevoegen aan de
mijne** werkt nog steeds, en houdt de tokens uit het bestand voor de sessie.

**De beperking:** inloggegevens horen bij een profiel. Een profiel dat de import
verwijdert, neemt zijn opgeslagen tokens mee, wat je ook kiest.

## Veilig delen

[Veilig delen](secure-share.md) exporteert instellingen, kluisregels of hele
workspaces als een **versleutelde bundel** — geheimen gaan alleen mee wanneer jij
het vakje aanvinkt.

**Zie ook:** [Kluis](vault.md) · [Veilig delen](secure-share.md)
