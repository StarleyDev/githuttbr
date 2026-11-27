---
title: Profielen
category: Naar eigen smaak
order: 101
summary: Gescheiden identiteiten en tokens voor werk en al het andere.
keywords: profiel profielen identiteit identity git user email tokens accounts wisselen switch
---

# Profielen

Een profiel bundelt een **Git-identiteit** (naam en e-mailadres) met de
bijbehorende **integratietokens**. Wissel van profiel en beide veranderen mee —
commits krijgen de juiste auteur en API-aanroepen gebruiken het juiste account.

Handig wanneer dezelfde machine werk- en privérepository's bedient, of wanneer je
twee GitHub-accounts hebt.

![Een profiel: git-identiteit aan de ene kant, de integratietokens aan de andere](../../screenshots/settings-profiles.webp)

## Een profiel bewerken, een profiel gebruiken

Twee pagina’s van Instellingen veranderen met het profiel — **Profiel & identiteit** en **Gekoppelde accounts**, bovenaan de groep **Jij**, waarvan de kop het bewerkte profiel noemt. Alle andere pagina’s gelden in elk profiel en zeggen dat bovenaan.

**Profiel & identiteit** opent met de profielkaart: de afbeelding, de naam (ter plekke te bewerken), *in gebruik* als de app het gebruikt, de kiezer en **Nieuw profiel**. **Gekoppelde accounts** opent met dezelfde kiezer in een balk, *Profiel bewerken*. De kiezer bepaalt welk profiel je **bewerkt**; hij verandert niet welk profiel de app **gebruikt**. Verschillen ze, dan zegt een amberkleurige band dat, met **Dit profiel gebruiken** om te wisselen. Juist dan wordt een account het makkelijkst aan het verkeerde profiel gekoppeld, dus noemt Gekoppelde accounts het profiel ook op elke kaart en op de knop zelf, en de bevestiging herhaalt het. Een profiel verwijderen gebeurt op dezelfde plek, en vraagt eerst.

Onder de kaart volgen de git-identiteit en het ondertekenen van commits. Is er een repository open dat als iemand anders commit — de git-config noemt een andere auteur —, dan zegt een regel dat, met **Identiteit toepassen op de huidige repo**; komen ze overeen, dan valt er niets toe te passen en verschijnt de regel niet. Daarna volgen de profielafbeelding, een overzicht van de **gekoppelde accounts** — één regel per host met *Gekoppeld*, *Token verlopen of fout*, *Niet bereikbaar* of *Niet gekoppeld*, en **Koppelen** of **Vernieuwen**, die Gekoppelde accounts op die host openen — en welke AI het profiel gebruikt.

Het overzicht controleert stil, zonder aanmeldvenster, telkens als de pagina opent of een token verandert; het vraagt nooit periodiek. Wat het vindt, gebruikt ook het zijmenu: **Gekoppelde accounts** toont een klein waarschuwingsgetal als een token geweigerd werd of mislukte, en alleen voor controles die Instellingen al deed. Een onbereikbare host telt niet mee — het token kan prima zijn.

![Het profiel Werk bewerken terwijl de app een ander gebruikt: de amberkleurige band en de koppelknop die Werk noemt](../../screenshots/settings-profile-band.webp)

## De AI wordt gedeeld

Een profiel heeft geen eigen AI nodig: één [algemene
AI](ai.md#één-ai-voor-elk-profiel) bedient elk profiel, en een profiel kiest
alleen voor een eigen AI als het moet. Die keuze geldt voor alles: een profiel
op de algemene AI schrijft ook zoals de algemene AI is ingesteld — commitstijl,
extra regels voor commits, repository-chat. Een profiel dat een andere stijl nodig
heeft, krijgt een eigen AI, een kopie van de algemene die het daarna kan
aanpassen. Alles wordt bewerkt op de pagina **AI**; de pagina Profiel zegt
alleen welke AI het profiel gebruikt en linkt ernaartoe.

## Elk profiel zijn eigen accounts

Naast een token kan een profiel een login **koppelen** die al op de machine
staat — uit de credential helper van git of de GitHub CLI — in Instellingen → Gekoppelde accounts. Een koppeling hoort bij één profiel: een nieuw profiel begint
ontkoppeld, en een account dat een ander profiel al heeft, wordt geweigerd. Zo
kunnen twee profielen twee GitHub- (of Azure DevOps-)accounts naast elkaar
hebben. Zie [Hosting](hosting.md).

## Binding per repository

Een repository kan **aan een profiel gebonden** worden, zodat een fetch op de
achtergrond altijd als het juiste account authenticeert — zelfs terwijl jij naar
een repository kijkt die bij het andere hoort.

Tokens wonen in je [OS-sleutelhanger](security.md), nooit in het
instellingenbestand.

**Zie ook:** [Beveiliging & geheimen](security.md) · [Hosting](hosting.md)
