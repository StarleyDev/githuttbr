---
title: Themes & Erscheinungsbild
category: Anpassen
order: 100
summary: Eingebaute Themes, hell und dunkel, dazu eigene und KI-generierte, und farbige Symbole.
keywords: theme themes dunkel hell dark light erscheinungsbild farben schriftgröße graph palette suchen einstellungen finden search settings symbol symbole symbolfarben ton einfarbig icon icons icon colors tint monochrome
---

# Themes & Erscheinungsbild

Eingebaute Themes — Gitcito, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast und Daltonic — jedes mit einer hellen und einer dunklen
Variante.

![Der Wechsel von hell zu dunkel](../../screenshots/clip-themes.webp)

- **Hell, dunkel oder dem Betriebssystem folgen**, live umgeschaltet.
- **Eigene Themes** und **KI-generierte** aus einem Prompt.
- Anpassbare **Code-Schriftgröße**.
- **Symbolfarben** für die Werkzeugleiste und die Abschnitte der Seitenleiste —
  siehe unten.
- Ein eigener **Graph-Stil**: Spurenpalette, Eckenstil, Zeilendichte und
  Linienstärke, mit einer Live-Vorschau als Mini-Graph.

![Theme-Einstellungen](../../screenshots/settings-themes.webp)

## Symbolfarben

Eine Reihe grauer Symbole lässt Abrufen, Push und Stash gleich aussehen, bis man
ihre Beschriftung liest. **Symbolfarben**, unter Erscheinungsbild im Reiter
Theme, färbt jedes Symbol nach dem, was es tut, damit das Auge die Aktion vor dem
Wort findet:

| Rolle | Symbole | Theme-Farbe, die es annimmt |
|---|---|---|
| Empfangen | Abrufen, Pull, Remotes, Worktrees | der Cyan-Platz des Themes |
| Senden, abschließen | Push, Aufgaben, Issues, Releases | Grün |
| Refs | Branch, Lokal, Tags, Pull Requests, Meilensteine, Submodule | die Akzentfarbe |
| Beiseitelegen | Stash, Pop, Stashes, Lesezeichen, Angeheftet | der Orange-Platz des Themes |

Rückgängig, Wiederholen, Werkzeuge und Einstellungen bleiben grau: Sie sind
Hilfsmittel, und dass sie schlicht bleiben, lässt die farbigen hervortreten.

Listen, die viele Einträge gruppieren, färben eine ganze Gruppe auf einmal, damit
sich eine Gruppe als eine Familie liest:

- **Werkzeuge-Menü** — die Zeitreise (Reflog, WIP-Schnappschüsse, Zeitmaschine,
  Bisect) in Orange; die Branch-Werkzeuge (Absorb, die Radare, lokale CI,
  Vergleiche) in der Akzentfarbe; und eine Farbe je Gruppe: Untersuchen Cyan,
  Branches & Historie die Akzentfarbe, Dateien & Patches Grün, Repository
  Orange, Geheimnisse & Teilen Rot.
- **Einstellungsseiten** — Layout, Arbeitsbereiche und KI in der Akzentfarbe;
  Profil und Umgebung Grün; Integrationen und Daten Cyan; Themes Orange;
  Sicherheit Rot. Allgemein und Tastenkürzel bleiben grau.

Eine Reihe von Symbolknöpfen ohne Beschriftung macht es umgekehrt — jeder Knopf
bekommt seine eigene Farbe, damit man sie auseinanderhalten kann. Auf der
[Pull-Request-Seite](pull-requests.md) sind die Knöpfe im Kopf so gefärbt:
Aktualisieren blau, KI-Review in der Akzentfarbe, lokale Vorschau türkis, zum
Quell-Branch grün und zum Ziel-Branch orange (Im Browser öffnen bleibt grau), und
bei deinen eigenen Kommentaren nimmt **Bearbeiten** die Akzentfarbe an und
**Löschen** Rot — dort und auf der Issue-Seite. Blau und Türkis sind Mischungen aus
den Farben des Themes, folgen ihm also ebenfalls.

| Option | Was du siehst |
|---|---|
| **Einfarbig** | Jedes Symbol grau, wie vor dieser Option |
| **Sanfter Ton** (Standard) | Die Farbe ins Grau gemischt; beim Darüberfahren die volle Farbe |
| **Volle Farbe** | Die Farbe selbst, auf einem kleinen Chip im selben Farbton |

Die Farben kommen aus dem Theme — ein Theme, das sein Grün oder seinen Akzent
umfärbt, färbt die Symbole mit, eigene und KI-generierte Themes eingeschlossen.

Grenzen: Gefärbt werden nur die Hauptknöpfe der Werkzeugleiste, die
Abschnittsköpfe der Seitenleiste, das Werkzeuge-Menü, die Einstellungsseiten und
die Knöpfe der Pull-Request- und der Issue-Seite; andere Menüs, die Zeilen
innerhalb eines Abschnitts und der Commit-Graph nicht. Eine Menüzeile unter dem
Mauszeiger behält ihr gewohntes Aussehen, Symbol eingeschlossen. Farbe ist nie der
einzige Hinweis — jedes Symbol behält seine Beschriftung.

## Eine Einstellung finden

Die Einstellungen verteilen sich auf viele Seiten, und die gesuchte Option liegt selten dort,
wo man sie vermutet: Man weiß, dass es sie gibt, nicht auf welcher Seite. Das
Suchfeld in der Kopfzeile der Einstellungen, neben der Schließen-Schaltfläche,
durchsucht alle Seiten auf einmal.

![Suche nach „terminal“ in den Einstellungen](../../screenshots/settings-search.webp)

Während du tippst, listet die rechte Seite die passenden Einstellungen nach
Seiten gruppiert — jede mit ihrem Namen, ihrer einzeiligen Beschreibung und der
Seite, auf der sie steht. Die Seitenleiste blendet Seiten ohne Treffer ab und
zeigt bei den anderen die Anzahl.

- Verglichen werden der Name der Einstellung, ihre Beschreibung und der Name der
  Seite. Groß-/Kleinschreibung und Akzente zählen nicht, und jedes getippte Wort
  muss vorkommen — „terminal schrift“ grenzt auf die Schrift-Einstellungen des
  Terminals ein.
- Gesucht wird in der Sprache der Oberfläche und gleichzeitig auf Englisch: Mit
  der App auf Deutsch findet „token“ oder „font“ die Einstellung trotzdem.
- Ein Klick auf einen Treffer, oder **Enter** für den ersten, öffnet dessen
  Seite (auf Themes auch den richtigen Tab — Theme oder Graph), scrollt zur
  Einstellung und hebt sie kurz hervor.
- **Esc** leert die Suche; ein zweites **Esc** schließt die Einstellungen.

Durchsucht werden Namen und Beschreibungen, nicht die Werte, die du eingestellt
hast. Die Serverlisten pro Host unter Integrationen (GitHub Enterprise Server,
selbst betriebenes GitLab, Bitbucket Data Center) öffnen die Seite
Integrationen; den Tab des Hosts wählst du selbst. Einzelne Tastenkürzel sind
nicht indexiert — die Suche findet die Seite Tastenkürzel, deren Editor sie
auflistet.

## Layout

Seitenleiste links oder rechts, überall größenveränderbare Panels, eine
einklappbare Seitenleiste für die Momente, in denen der Graph das ganze Fenster
verdient, und eine Terminal-Platzierung pro Repository.

**Siehe auch:** [Der Commit-Graph](graph.md) · [Profile](profiles.md)
