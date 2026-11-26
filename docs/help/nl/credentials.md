---
title: Credential helper
category: Beveiliging
order: 73
summary: De eigen wachtwoordkluis van git — de derde — en waarom https het steeds opnieuw vraagt.
keywords: credential helper wachtwoord password https vraagt opnieuw osxkeychain wincred manager libsecret store cache git-credentials platte tekst plaintext vergeten ingetrokken revoked token 401 aanmelding controleren welk account token in de remote-url ingebed wachtwoord uit de url verwijderen token in remote url embedded password invalid username or token authentication failed set-url
source: 1e74bbd13f1cd8ca72fac755ce38a4e43bc11456
---

# Credential helper

Gitcito houdt drie verschillende soorten geheim vast, en mensen nemen begrijpelijk
aan dat het één ding is:

| | Bewaard door |
|---|---|
| API-tokens van hosts — PR's, issues, CI-checks | Gitcito, in je [OS-sleutelhanger](security.md) |
| `git@…`-transport | Je [SSH-sleutel](ssh-keys.md), via de ssh-agent van het systeem |
| **`https://`-transport** | **De eigen credential helper van git** |

De derde is voor niemand een feature tot hij misgaat, en dan levert hij de twee
meest gehoorde klachten in git op: *waarom vraagt hij het me weer?* en *waarom
stuurt hij nog steeds het token dat ik heb ingetrokken?*

`⌘K` → **Credential helper**.

![De ingestelde helper, regels per host en de waarschuwing over het platte-tekstbestand](../../screenshots/credentials.webp)

## Waar je naar kijkt

Elke ingestelde `credential.helper`, in de scope waar hij vandaan komt —
`system`, `global`, en dan deze repository. **Helpers stapelen**: git vraagt ze
één voor één, en een helper op repositoryniveau vervangt een globale niet.

Elk wordt tegen je machine gecontroleerd:

| Vlag | Betekent |
|------|----------|
| **klaar** | Het helperprogramma bestaat en zal draaien |
| **niet geïnstalleerd** | Ingesteld, maar het programma ontbreekt — elke vraag valt door naar opnieuw intypen |
| **wachtwoorden in een plat bestand** | De `store`-helper (zie hieronder) |

**Regels voor specifieke hosts** somt de `credential.<url>.*`-secties op. Die
winnen van de gewone instelling voor de URL's waar ze op passen, en zijn meestal
het antwoord op "waarom gedraagt juist deze host zich anders".

## Er een kiezen

| Helper | Waar het wachtwoord terechtkomt |
|--------|--------------------------------|
| `osxkeychain` | macOS Keychain — versleuteld, per gebruiker |
| `manager` | Git Credential Manager (Windows, platformonafhankelijk) |
| `wincred` | Windows Credential Manager |
| `libsecret` | De Linux secret service (GNOME Keyring, KWallet) |
| `cache` | Geheugen, 15 minuten lang. Niets op schijf |
| `store` | **Een plat bestand in je thuismap. Onversleuteld** |

Gitcito biedt aan wat er werkelijk op deze machine staat, markeert degene die bij
je besturingssysteem past, en maakt de rest grijs.

**Scope doet ertoe.** *Voor elke repository* schrijft naar je globale config, en
dat is bijna altijd wat je wilt; *alleen voor deze repository* is voor die ene
rare repo die tegen iets anders authenticeert.

## De `store`-helper, en `~/.git-credentials`

`store` schrijft regels van de vorm `https://user:password@host` naar
`~/.git-credentials`, in platte tekst, zonder enige vorm van versleuteling. Alles
wat als jou draait kan het lezen: een script, de postinstall van een dependency,
wat dan ook.

Bestaat dat bestand, dan zegt deze pagina dat en telt hij de regels. Hij toont ze
nooit — het aantal is het hele punt, en de inhoud lezen om die te tonen zou
dezelfde fout zijn.

Vind je er een die je niet bedoeld had: kies hier een echte helper, verwijder dan
het bestand en authenticeer één keer opnieuw.

## Een opgeslagen credential vergeten

Wordt een token ingetrokken of geroteerd, dan blijft de helper de oude aanreiken
en faalt elke push met een 401 die niets bij naam noemt. **Vergeten** vraagt de
ingestelde helper zijn regel voor die host te wissen — `git credential reject`,
de eigen gedocumenteerde route van git.

Onderweg wordt er niets gelezen: Gitcito roept nooit `git credential fill` aan,
het commando dat een levend wachtwoord naar standaarduitvoer zou printen.

De volgende push vraagt het je één keer, en de helper bewaart het nieuwe
antwoord.

## Welk account een push gebruikt

Elke push-URL wordt apart gecontroleerd. Een schrijf-scope is alleen een vermogen van het token. Lidmaatschap van de repository, branchregels en toestemming om een bepaald bestand te wijzigen worden niet getest. Openbaar lezen kan lukken zonder inloggegevens.

![Controle van de aanmelding bij de remote](../../screenshots/remote-sign-in.webp)

Een push kan zich op verschillende manieren aanmelden: het token van een profiel, een
GitHub CLI-aanmelding die aan een profiel gekoppeld is, de eigen helper van git, een
wachtwoord dat in de remote-URL is achtergebleven, of een SSH-sleutel. Als hij wordt
geweigerd, moet je eerst weten welke hij gebruikte. Rechtsklik een remote in de zijbalk
en kies **Aanmelding controleren…** (of *Aanmelding van remotes controleren* in het
commandopalet). De controle bepaalt de inloggegevens op dezelfde manier als een push
en vraagt de host er dan naar:

| Ze toont | Waar het vandaan komt |
|----------|--------------------|
| De bron, en het [profiel](profiles.md) erachter | Dezelfde voorrang die een push toepast — het aan de repository gekoppelde profiel, anders het actieve, anders de helper van git |
| Het account | Het eigen antwoord van de host (`/user`), niet wat in Instellingen is ingevuld |
| De scopes | De header `X-OAuth-Scopes` van GitHub; de beschrijving die GitLab van zijn eigen token geeft |
| Wat ze toestaan | Schrijfgerelateerde token-scopes (`repo` op GitHub, `write_repository` op GitLab), en op GitHub of `.github/workflows` mag veranderen |

Ze markeert ook inloggegevens die de host weigert (verlopen of ingetrokken), een
gekoppeld account dat niet meer is aangemeld, en een wachtwoord dat als platte tekst in
de remote-URL staat.

**Beperkingen.** Een fijnmazig GitHub-token toont zijn rechten niet, dus of het mag
pushen staat als onbekend tot een push het probeert. Forgejo meldt het account, maar
niet de rechten van het token. Azure DevOps en Bitbucket worden alleen met bron en
profiel getoond. SSH-remotes worden niet getest, maar [SSH-sleutels](ssh-keys.md) toont
wat de agent heeft. De controle vraagt de helper van git stilletjes: een helper die een
aanmeldvenster nodig zou hebben, telt als leeg.

## Een wachtwoord opgeslagen in de remote-URL

Een oude clone, of een URL die uit een wiki is geplakt, kan zijn inloggegevens in het
adres dragen: `https://user:token@git.example.test/team/app.git`. **Een wachtwoord in
de URL heeft altijd voorrang:** git stuurt het en vraagt geen enkele helper — niet het
token van het [profiel](profiles.md) van de repository, niet de GitHub CLI, niet de
eigen opslag van git. Zolang het token werkt, is dat prima, en Gitcito laat het met
rust: **het verwijdert nooit een wachtwoord uit een URL zonder het je te vragen.**
Zodra het token wordt ingetrokken of verloopt, mislukt elke fetch, pull en push van die
ene repository met *Invalid username or token* of *Authentication failed*, terwijl de
andere repositories met hetzelfde profiel werken. En het token staat als platte tekst in
de `.git/config` van de repository.

![Een opgeslagen token uit een remote-URL verwijderen](../../screenshots/remote-url-token.webp)

Gitcito leest de fetch- en push-URL’s van elke remote en meldt het op drie plekken:

| Waar | Wat je ziet |
|-------|--------------|
| Een mislukte fetch, pull of push | De fout legt uit dat de URL van de remote een opgeslagen wachtwoord bevat, met **Uit de URL verwijderen…** |
| De zijbalk | Een bescheiden sleutelpictogram op de rij van de remote: de URL bevat een wachtwoord dat voorrang heeft op het token van het profiel. Dezelfde actie staat in het contextmenu |
| **Aanmelding controleren…** | De remote toont het wachtwoord als bron, met dezelfde knop |

De actie vraagt het eerst. Ze haalt het wachtwoord uit elke URL van die remote — de
fetch-URL en elke push-URL die er een bevat — en schrijft niets anders dan
`.git/config`. Wat er daarna gebeurt, hangt af van wat zich verder kan aanmelden:

| Na het verwijderen | Wat fetch en push gebruiken |
|---------------|-------------------------|
| Het profiel van de repository heeft een token of gekoppeld account voor die host | Dat token — de bevestiging zegt verder niets |
| Geen profieltoken, maar de eigen helper van git heeft een aanmelding voor de host | De aanmelding van de helper |
| Geen van beide | Niets: fetch en push mislukken tot je een token toevoegt. De bevestiging zegt dat eerst en biedt **Eerst een token toevoegen** aan, wat Instellingen → Integraties opent |

Als ze vanuit een mislukte bewerking is gestart, biedt ze **Opnieuw proberen** aan.

**Er is bewust geen ongedaan maken.** Ongedaan maken zou het geheim als platte tekst
terug in het bestand schrijven, en dat is precies wat de actie moet voorkomen. Kan het
oude token nog werken, trek het dan in op de server: het was leesbaar voor alles wat de
repositorymap kon lezen.

**Beperkingen.**

- De gebruikersnaam verdwijnt ook (`https://git.example.test/…`), zoals wanneer je
  `git remote set-url` met de hand uitvoert; de bevestiging zegt dat. Een server die
  hem in de URL nodig heeft — een Bitbucket Data Center-token zonder gebruikersnaam in
  het profiel — heeft hem nodig, opnieuw toegevoegd met **De remote bewerken…**.
- Alleen een gebruikersnaam (`https://user@host/…`) wordt niet gemarkeerd: git vraagt
  de helper nog steeds om het wachtwoord van die gebruiker, dus er is niets geheims
  opgeslagen.
- SSH-URL’s blijven ongemoeid: `git@host:…` en `ssh://git@host/…` noemen de login die
  ssh gebruikt, geen inloggegevens.
- Het voorvoegsel van een remote-helper (`persistent-https::https://…`, `gcrypt::…`)
  blijft staan; de URL erna wordt gelezen en opgeschoond zoals elke andere.
- **Dubbelzinnige URL’s worden niet aangeboden om op te schonen.** Als lezers het niet
  eens zijn over waar de host begint — een `@` na een `?` of `#` in het adres, of een
  wachtwoord met een niet-gecodeerde `/` —, zou knippen bij de verkeerde `@` de remote
  naar een andere server laten wijzen. Zo’n URL wordt alleen geanonimiseerd getoond, en
  het sleutelpictogram opent **De remote bewerken…** zodat je hem met de hand
  corrigeert.
- Alleen `.git/config` wordt gelezen en gewijzigd. Een URL die door een
  `url.<base>.insteadOf`-regel wordt herschreven, of een remote die in je globale
  configuratie is gedefinieerd, wordt niet bekeken — en een remote hernoemen kopieert
  nooit een wachtwoord dat een `insteadOf`-regel toevoegt naar de configuratie van de
  repository.
- Het wachtwoord verlaat nooit het hoofdproces: remote-URL’s bereiken het venster, het
  menu om de URL te kopiëren en het bewerkvenster zonder wachtwoord. Het bewerkvenster
  opslaan met de URL die het toonde, verandert niets en houdt het wachtwoord; **de host
  of het pad wijzigen laat het vallen**, omdat de URL die je typte wordt geschreven
  zoals hij is. Alleen deze actie verwijdert een wachtwoord en houdt het adres.

## Grenzen die je moet kennen

- **Dit is de kluis van git, niet van Gitcito.** Hem veranderen verandert ook wat
  je terminal doet — wat de bedoeling is, en goed om te weten voor je hem
  verandert.
- **Helpers op systeemniveau worden getoond, niet bewerkt.** Die staan in een
  config die alleen een beheerder kan schrijven.
- **Gitcito kan niet opsommen wat een helper bevat.** Geen enkele credential-API
  onthult dat zonder de geheimen te overhandigen, dus het venster rapporteert de
  configuratie en wist op verzoek, en verder niets.
- **Een token dat je aan Gitcito gaf staat los.** De een intrekken raakt de ander
  niet; zie [beveiliging](security.md) voor de kant van de sleutelhanger.
- **Het token van een profiel blijft buiten de omgeving van de hooks van de
  repository.** Een hook ziet alleen een code voor een privé-eindpunt, geldig zolang
  dat git-commando loopt — genoeg voor een hook die bewust vraagt, zoals git-lfs doet.
  Zie [het token van een profiel terwijl git draait](security.md#het-token-van-een-profiel-terwijl-git-draait).

Zie ook: [Beveiliging](security.md) · [SSH-sleutels](ssh-keys.md) ·
[Synchroniseren](syncing.md)
