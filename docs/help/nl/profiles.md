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

Instellingen verdeelt zijn pagina's in tweeën. **Dit profiel** bevat de pagina's
die met het profiel meeveranderen — **Profiel** en **Integraties**. **App** bevat
al het andere, dat in elk profiel geldt en dat bovenaan de pagina ook zegt.

De twee profielpagina's openen met een balk: *Profiel bewerken* en een kiezer. De
kiezer bepaalt welk profiel je **bewerkt**; hij verandert niet welk profiel de app
**gebruikt**. Verschillen ze, dan zegt een amberkleurige band dat — *Je bewerkt
Werk. De app gebruikt Privé* — met **Dit profiel gebruiken** om te wisselen. Dat is
het moment waarop een account het makkelijkst aan het verkeerde profiel wordt
gekoppeld, dus de pagina Integraties noemt het profiel ook op elke kaart en op de
knop zelf: **Koppelen aan het profiel Werk**, en de bevestiging herhaalt het.
Nieuw en verwijderen staan in dezelfde balk; verwijderen vraagt eerst.

![Het profiel Werk bewerken terwijl de app een ander gebruikt: de amberkleurige band en de koppelknop die Werk noemt](../../screenshots/settings-profile-band.webp)

## De AI wordt gedeeld

Een profiel heeft geen eigen AI nodig: één [algemene
AI](ai.md#één-ai-voor-elk-profiel) bedient elk profiel, en een profiel kiest
alleen voor een eigen AI als het moet. Die keuze geldt voor alles: een profiel
op de algemene AI schrijft ook zoals de algemene AI is ingesteld — commitstijl,
eigen instructies, repository-chat. Een profiel dat een andere stijl nodig
heeft, krijgt een eigen AI, een kopie van de algemene die het daarna kan
aanpassen. Alles wordt bewerkt op de pagina **AI**; de pagina Profiel zegt
alleen welke AI het profiel gebruikt en linkt ernaartoe.

## Elk profiel zijn eigen accounts

Naast een token kan een profiel een login **koppelen** die al op de machine
staat — uit de credential helper van git of de GitHub CLI — in Instellingen →
Integraties. Een koppeling hoort bij één profiel: een nieuw profiel begint
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
