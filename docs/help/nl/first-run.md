---
title: Eerste start
category: Begin hier
order: 2
summary: De wizard bij de eerste start — Git-identiteit, hostingaccounts, AI, weergave — en wat elke stap opslaat.
keywords: onboarding eerste start wizard instellen welkom instellingen importeren git identiteit accounts ai abonnement api sleutel ollama lm studio claude code codex overslaan first run
source: 5b5992d94b164ac6b9b101283ec044ba376b88de
---

# Eerste start

Bij de eerste start vraagt een korte wizard het weinige dat GitHuttBr vanaf de eerste commit beïnvloedt: wie je bent in Git, waar je repositories staan, of je AI wilt gebruiken en hoe het eruit moet zien. Elke stap mag leeg blijven, en alles is later aan te passen in **Instellingen**.

![De AI-stap: een abonnements-CLI op deze computer gevonden en getest](../../screenshots/onboarding-ai.webp)

## Het welkomstscherm

Vóór de stappen biedt het welkomstscherm aan een **instellingenbestand te importeren** van een andere computer. Sleutels en tokens worden eruit gehaald, tenzij je het vakje aanvinkt om ze te bewaren, en een export met wachtwoord vraagt daar meteen om het wachtwoord. Importeren past het bestand toe en sluit de wizard — zie [Beveiliging & geheimen](security.md) voor wat een export bevat.

## De stappen

De linkerkolom toont de stappen. Een groen vinkje markeert een ingevulde stap, een streepje een stap die je oversloeg, en de gemarkeerde rij is waar je bent.

| Stap | Wat hij instelt | Waar later aanpassen |
|---|---|---|
| Git-identiteit | De profielnaam, en de naam en het e-mailadres in je commits | Instellingen → Profiel & identiteit |
| Accounts | Tokens voor GitHub, GitLab, Azure DevOps, Bitbucket, Forgejo en eigen servers, en de app voor **Openen met…** | Instellingen → Gekoppelde accounts; de app in Instellingen → Git & synchronisatie |
| Kunstmatige intelligentie | Eén AI-account, in gebruik gezet | Instellingen → AI |
| Weergave | Thema en lichte, donkere of automatische modus | Instellingen → Thema’s |
| Klaar | Niets nieuws — een overzicht van wat is ingesteld | — |

**Nu overslaan** sluit de wizard bij elke stap en bewaart wat je al invulde.

## De AI-stap

AI is optioneel. Kies een van de drie kaarten, of **Overslaan, geen AI**:

| Kaart | Wat hij gebruikt | Wat hij nodig heeft |
|---|---|---|
| Mijn abonnement | Claude Code of Codex, aangemeld met je abonnement | De CLI geïnstalleerd en aangemeld |
| API-sleutel | OpenAI, Anthropic, Gemini, Groq, OpenRouter of Mistral | Een sleutel van de provider |
| Op mijn computer | Ollama of LM Studio, lokaal — er verlaat niets de machine | De server gestart |

Staat Claude Code of Codex op deze computer, dan noemt de abonnementskaart welke en de versie, en het kiezen van de kaart test hem: één korte prompt, dan **Getest: antwoord in N s. Klaar voor gebruik.** Wordt er geen gevonden of is de CLI niet aangemeld, dan toont de kaart dezelfde verbindingsinstelling als [Instellingen → AI](ai.md).

Bij een API-sleutel of lokale server test **Doorgaan** de verbinding door de modellen van de provider op te vragen, en slaat alleen een account op dat antwoordde.

De stap slaat een gewoon AI-account op, geschreven zoals Instellingen dat doet en **In gebruik** gezet: open Instellingen → AI en het staat er, klaar om te hernoemen, alleen voor sommige functies te gebruiken of te verwijderen. Meer accounts, een model per functie en hoe de AI schrijft stel je daar in, niet in de wizard.

## Beperkingen

- **De abonnementstest kost een prompt.** Hij telt mee voor je abonnement, zoals elk verzoek. Hij draait alleen als je de kaart kiest of op **Opnieuw testen** drukt.
- **Alleen Claude Code en Codex worden herkend.** Gemini CLI en Devin antwoorden als gewone CLI-accounts, die je toevoegt in Instellingen → AI.
- **Een lokale server moet al draaien.** De wizard start Ollama of LM Studio niet en downloadt geen modellen.
- **De wizard draait één keer.** Daarna staat alles wat hij instelde in Instellingen; opnieuw openen kan niet.
