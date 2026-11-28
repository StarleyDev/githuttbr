---
title: Changelog-Generator
category: Mit Änderungen arbeiten
order: 34
summary: Macht aus Conventional Commits zwischen zwei Refs ein gruppiertes Changelog.
keywords: changelog release notes release-notes conventional commits generieren CHANGELOG
source: 82fe9093441415a9cd578fe981f73d1082852b29
---

# Changelog-Generator

Gib ihm zwei Refs — standardmäßig **neuester Tag → HEAD** — und er macht aus den
Commits dazwischen ein Changelog, gruppiert nach Conventional-Commit-Typ.

![Der Changelog-Generator](../../screenshots/changelog-gen.webp)

- **Breaking Changes** stehen zuerst, egal aus welchem Typ sie kamen.
- Danach Features, Fixes, Performance und so weiter.
- Commits, die keiner Konvention folgen, landen unter **Sonstiges**, statt unter
  den Tisch zu fallen — ein Changelog, das stillschweigend Commits verliert, ist
  schlimmer als ein unaufgeräumtes.

Das Ergebnis öffnet sich im selben **Schreiben / Vorschau**-Editor wie die
Beschreibung eines Pull Requests, samt Werkzeugleiste: formuliere einen Eintrag
um, streich eine Zeile, die niemand braucht, und prüfe, wie es gerendert
aussieht, bevor es irgendwohin geht. Erneutes Generieren ersetzt deine
Änderungen.

Kopiere das Ergebnis, oder **stell es direkt `CHANGELOG.md` voran**.

> Deine Nachrichten im [Conventional-Stil](committing.md) zu schreiben, ist
> das, was das hier nützlich macht. Der Generator ist nur so gut wie die
> Betreffzeilen, die er liest.

**Siehe auch:** [Committen](committing.md) ·
[Hosting & Pull Requests](hosting.md)
