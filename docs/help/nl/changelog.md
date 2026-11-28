---
title: Changeloggenerator
category: Werken met wijzigingen
order: 34
summary: Zet conventional commits tussen twee refs om in een gegroepeerde changelog.
keywords: changelog releasenotes release notes conventional commits genereren CHANGELOG
source: 82fe9093441415a9cd578fe981f73d1082852b29
---

# Changeloggenerator

Geef hem twee refs — standaard **laatste tag → HEAD** — en hij verandert de
commits ertussen in een changelog, gegroepeerd per Conventional Commit-type.

![De changeloggenerator](../../screenshots/changelog-gen.webp)

- **Breaking changes** komen eerst, uit welk type ze ook kwamen.
- Daarna Features, Fixes, Performance, enzovoort.
- Commits die geen enkele conventie volgen belanden onder **Overig** in plaats
  van te verdwijnen — een changelog die stilletjes commits kwijtraakt is erger
  dan een rommelige.

Het resultaat opent in dezelfde **Schrijven / Voorbeeld**-editor als de
beschrijving van een pull request, werkbalk inbegrepen: herformuleer een item,
schrap een regel die niemand nodig heeft, en kijk hoe het eruitziet voordat het
ergens heen gaat. Opnieuw genereren vervangt je bewerkingen.

Kopieer het resultaat, of **zet het meteen bovenaan `CHANGELOG.md`**.

> Je boodschappen in [Conventional-stijl](committing.md) schrijven is wat dit
> nuttig maakt. De generator is niet beter dan de onderwerpsregels die hij leest.

**Zie ook:** [Committen](committing.md) · [Hosting & pull requests](hosting.md)
