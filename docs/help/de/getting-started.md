---
title: Erste Schritte
category: Erste Schritte
order: 1
summary: Ein Repository öffnen, den Graphen lesen, den ersten Commit machen.
keywords: einführung intro erste schritte first steps öffnen open clone klonen tabs graph commit
source: 173f891f9f1c5c53ea40cf344baf821e3188344d
---

# Erste Schritte

Gitcito öffnet einen Ordner und zeigt dir seine Historie. In dein Repository wird
nichts geschrieben, bevor du nicht darum bittest.

![Ein frisch geöffnetes Repository, noch ohne Commits](../../screenshots/empty-repo.webp)

## Ein Repository öffnen

![Repository öffnen: öffnen, klonen oder erstellen, darunter die gescannten und die zuletzt geöffneten Repositories](../../screenshots/open-repository.webp)

- **Zieh einen Ordner** auf das Fenster, oder nutze **Repository öffnen** auf dem
  Willkommensbildschirm. Die Auswahl nimmt mehrere Ordner auf einmal: Wähle sie
  mit ⌘-Klick oder Umschalt-Klick aus, und jeder öffnet sich in einem eigenen
  Tab (oder kommt in die Gruppe, aus der du die Auswahl geöffnet hast). Bei
  mehreren ausgewählten Ordnern wird ein bereits offenes Repository oder ein
  Ordner, der kein Git-Repository ist, übersprungen und in einer Meldung
  genannt, damit sich die anderen trotzdem öffnen. Die macOS-Auswahl kann offene
  Repositories nicht vorab ausgrauen: Electron stellt den Hook des Dialogs pro
  Ordner nicht bereit, deshalb wird erst nach dem Klick auf Öffnen geprüft.
- **Gescannte Repositories**, unter den drei Schaltflächen, listet jedes
  Repository in den Ordnern, die Gitcito für dich durchsuchen soll — hake mehrere
  an und öffne sie auf einmal, oder doppelklicke auf eines. Dort fügst du diese
  Ordner auch hinzu oder entfernst sie. Siehe
  [Repositories](repositories.md#gescannte-repositories).
- **Danebengeklickt?** Klonen, Erstellen, Gruppe erstellen und Gescannte
  Repositories haben, wenn sie aus Repository öffnen kommen, neben ihrem Titel
  einen **Zurück**-Pfeil, der dorthin zurückführt.
- **Klone** eines von einer URL oder direkt von deinem Hoster — unter
  [Klonen](cloning.md) stehen die Optionen, die ein riesiges Repository schnell
  klonbar machen.
- Aus einem Terminal öffnet `gitcito .` den aktuellen Ordner in der laufenden
  App — siehe [die Kommandozeile](cli.md).
- Ein einzelner Ordner, der noch kein Git-Repository ist, lässt sich trotzdem
  öffnen; dabei wird angeboten, ihn zu initialisieren.

## Die drei Bereiche

| Bereich | Was er enthält |
|---|---|
| Links | Branches, Remotes, Tags, Stashes, Worktrees — und der Tab **Dateien** für das Arbeitsverzeichnis |
| Mitte | Der Commit-Graph, und was immer du daraus auswählst |
| Rechts | Der Commit-Composer, oder die Details des ausgewählten Commits |

## Alles Übrige finden

Zwei Wege, und sie führen an dieselben Stellen:

- **`⌘K`** (`Ctrl+K`) — die Befehlspalette. Tipp, was du willst; sie springt auch
  zu Branches, Commits und Dateien.
- **Werkzeuge** in der Symbolleiste — derselbe Satz an repository-bezogenen
  Aktionen als Menü, mit dem langen Rest in Gruppen gefaltet, damit es lesbar
  bleibt.

![Das Werkzeuge-Menü: die häufigen Werkzeuge zuerst, der Rest gruppiert](../../screenshots/tools-menu.webp)

Wird das Fenster schmal, kämpft die Aktionsleiste nicht mehr um Platz: Schaltflächen, die nicht mehr passen, wandern in ein Menü **Mehr** am Ende — in der Reihenfolge der Leiste und mit ihren Untermenüs. Wird das Fenster breiter, kommen sie zurück.

Alles, was über den einen Weg erreichbar ist, ist auch über den anderen
erreichbar — es gibt also nichts, das nur Power-User finden.

## Dein erster Commit

1. Bearbeite eine Datei. Sie erscheint unter **Nicht gestaged**.
2. Stage sie — die ganze Datei, einen Hunk oder [einzelne Zeilen](staging.md).
3. Schreib eine Nachricht und drück **Commit**.

Alles andere in Gitcito ist optional.

