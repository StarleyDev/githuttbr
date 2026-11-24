---
title: Themes & Erscheinungsbild
category: Anpassen
order: 100
summary: Eingebaute Themes, hell und dunkel, dazu eigene und KI-generierte.
keywords: theme themes dunkel hell dark light erscheinungsbild farben schriftgröße graph palette suchen einstellungen finden search settings
---

# Themes & Erscheinungsbild

Eingebaute Themes — Gitcito, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast und Daltonic — jedes mit einer hellen und einer dunklen
Variante.

![Der Wechsel von hell zu dunkel](../../screenshots/clip-themes.webp)

- **Hell, dunkel oder dem Betriebssystem folgen**, live umgeschaltet.
- **Eigene Themes** und **KI-generierte** aus einem Prompt.
- Anpassbare **Code-Schriftgröße**.
- Ein eigener **Graph-Stil**: Spurenpalette, Eckenstil, Zeilendichte und
  Linienstärke, mit einer Live-Vorschau als Mini-Graph.

![Theme-Einstellungen](../../screenshots/settings-themes.webp)

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
