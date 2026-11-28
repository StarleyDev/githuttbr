---
title: Beliebige Commits bearbeiten
category: Branches & Eingriffe
order: 46
summary: Dateien oder Nachricht eines historischen Commits an Ort und Stelle umschreiben — die Kaskade wird vorher als Vorschau gezeigt.
keywords: commit bearbeiten edit historie umschreiben rewrite history amend vergangenheit reword tippfehler typo korrigieren kaskade cascade replay rebase in place eingriff surgery mit original vergleichen compare with original datei hinzufügen add file was passieren wird what will happen nicht angewendete änderungen unapplied changes
source: 2860ac7978e6b9b1b8a469abadf313971d0140c6
---

# Beliebige Commits bearbeiten

Der Tippfehler steckt in einem Commit von vor drei Wochen. Die übliche Lösung
ist ein interaktiver Rebase: beim Commit anhalten, bearbeiten, fortsetzen,
beten. GitHuttBrs Lösung ist: Rechtsklick auf den Commit, **Diesen Commit
bearbeiten**, Text ändern, fertig. Der Stift-Button im Commit-Details-Panel
öffnet denselben Editor.

![Einen historischen Commit bearbeiten](../../screenshots/commit-edit.webp)

## Was es tut

Wähle einen beliebigen Commit, der ein Vorfahre von `HEAD` ist — lineare
Historie oder nicht. Der Editor öffnet sich im mittleren Bereich anstelle des
Commit-Graphen, dort, wo auch die Konfliktlösung und der Dateibetrachter
aufgehen, und nimmt die volle Breite und Höhe des Fensters ein. **Esc** oder
**×** in seiner Kopfzeile schließt ihn. Deine Änderungen überstehen den Wechsel
zu einem anderen Repository-Tab und zurück, und wer mit nicht angewendeten
Änderungen schließt, wird vorher gefragt.

Die Kopfzeile nennt den Commit — seinen kurzen Hash, Betreff, Autor und Alter —
und sobald du etwas geändert hast, zählt eine gelbe Pille die **nicht
angewendeten Änderungen**: eine für die Nachricht, eine für jede bearbeitete
Datei.

### Die Nachrichtenkarte

Die Nachricht bekommt dieselben Werkzeuge wie der
[Commit-Composer](committing.md): den **Typ ▾**-Button vor der Zusammenfassung,
die Zusammenfassung mit ihrem Längenzähler (*56/72*) und darunter die
Beschreibung, die Stilzeile hinter dem Pfeil (Scope, Ticket-Schlüssel,
Commit-Stil), die Gitmoji-Auswahl, Co-Autoren, KI-Erzeugung aus dem eigenen Diff
des Commits und die Hinweise des Linters. Die Nachricht des Commits wird beim
Laden aufgeteilt — die erste Zeile wird zur Zusammenfassung, der Rest zur
Beschreibung — und beim Umschreiben mit einer Leerzeile wieder zusammengefügt.
Aus einem alten `add retry` ein `fix: add retry` zu machen, ist ein Griff am
Typ-Button.

Sobald die Nachricht vom Original abweicht, wird die Karte als **geändert**
markiert, der alte Betreff bleibt unter der Beschreibung als *vorher: …*
sichtbar, und **Zurück zum Original** stellt Zusammenfassung und Beschreibung
wieder her.

### Die Dateikarte

Die Dateien des Commits stehen mit ihrem Statusbuchstaben in der Liste; ein
Punkt markiert jede, die du geändert hast. Wähle eine Datei, um sie so zu
bearbeiten, wie sie in diesem Commit war; die Zeilen, die du änderst oder
hinzufügst, werden schon beim Tippen eingefärbt, damit deine Änderung im Blick
bleibt. Der Schalter über dem Editor wechselt
zwischen **Bearbeiten** und **Mit Original vergleichen**, das den Diff der Datei
vom Stand im Commit zu deinem bearbeiteten Text zeigt — dieselbe Diff-Ansicht
wie im Rest der App.

**Datei hinzufügen** öffnet eine Datei, die der Commit nicht angefasst hat, aus
dem Snapshot des Commits selbst: Tippe einen Teil ihres Pfads und wähle sie aus.
Sobald du sie bearbeitest, ändert der umgeschriebene Commit auch diese Datei.
Sie ist in der Liste mit einem **+** markiert.

![Eine bearbeitete Datei mit dem Original des Commits vergleichen](../../screenshots/commit-edit-compare.webp)

### Was passieren wird

Das Panel neben den Karten — in einem schmalen Fenster darunter — zeigt die
Kette, die ein Umschreiben berührt: jeden Commit oberhalb des bearbeiteten, von
`HEAD` abwärts, und ganz unten den bearbeiteten Commit selbst mit dem, was sich
in ihm ändert.

1. **Kaskade als Vorschau** spielt jeden Commit oberhalb des bearbeiteten *im
   Speicher* nach (eine Kette von `merge-tree`-Cherry-Picks — kein Checkout,
   kein Arbeitsverzeichnis, keine Refs). Jeder Commit der Kette sagt dann, ob
   er **sauber neu angewendet** wird oder einen **Konflikt** in einer genannten
   Datei hat, du weißt also, **bevor sich irgendetwas bewegt**, ob die Änderung
   sauber durchläuft oder mit einer späteren Änderung kollidiert. Nach jeder
   weiteren Bearbeitung verschwinden die Ergebnisse; **Erneut vorschauen**
   führt sie noch einmal aus.
2. **Historie umschreiben** macht es wirklich: Dieselbe Kette wird mit
   Plumbing gebaut, dann bewegt sich der Branch mit `reset --keep` — deine
   nicht committeten Änderungen werden mitgenommen, oder der Reset bricht ab
   und nichts ist passiert. Vorher wird ein
   [Schutz-Schnappschuss](recovery.md) angelegt, und **Rückgängig** stellt die
   alte Kette wieder her.

Liegt der Commit schon auf einem Remote, nennt ein gelber Hinweis den
Remote-Branch und sagt, was das bedeutet: Der nächste Push muss erzwungen
werden. Ein weiterer Hinweis sagt, wie viele Commits neue Hashes bekommen.

Urheberschaft und Daten jedes nachgespielten Commits bleiben erhalten; nur die
Hashes ändern sich — genau das bedeutet es, Historie umzuschreiben.

## Merges im Bereich

![Bearbeiten eines Commits unterhalb zweier Merges — die Kaskade spielt sie nach](../../screenshots/commit-edit-merges.webp)

Ein Merge zwischen dem Commit und `HEAD` deaktiviert das Bearbeiten nicht
mehr. Die Kaskade spielt einen Merge nach, indem sie sein **aufgezeichnetes
Ergebnis** — den Baum, den der Merge tatsächlich committet hat,
Konfliktauflösungen eingeschlossen — auf den umgeschriebenen Elterncommit
anwendet, sodass von Hand vorgenommene Auflösungen das Umschreiben
wortwörtlich überleben. Kein rerere, kein erneutes Mergen, kein Worktree:
dasselbe In-Memory-Plumbing wie im Rest der Kaskade, und beide Eltern-Zeiger
bleiben erhalten. Ein Seiten-Branch, der den bearbeiteten Commit ebenfalls
enthält, wird umgeschrieben und neu ausgerichtet; einer, der ihn nicht
enthält, behält seine Identität unangetastet. Ein Hinweis im Seitenpanel sagt,
wie viele Merges der Bereich enthält, und Merge-Commits zeigen in der Kette ein
Merge-Symbol.

Der ehrliche Vorbehalt: Ein nachgespielter Merge ist nur so gut wie sein
aufgezeichnetes Ergebnis. Kollidiert deine Änderung mit Zeilen, die der Merge
selbst aufgelöst hat, wird die Vorschau rot — genau wie bei jedem anderen
kollidierenden Schritt. Nichts wird geraten.

## Wenn die Kaskade kollidiert

Ein späterer Commit hat dieselben Zeilen angefasst, die du gerade bearbeitest.
Die Vorschau markiert diesen Commit mit der kollidierenden Datei, die Commits
darüber als nicht neu angewendet, und **Historie umschreiben** bleibt aus —
nichts ist jemals halb angewendet. Anders als ein Rebase hält der Editor nicht
mittendrin an, damit du den Konflikt auflöst: Entweder bearbeite anders, oder
stelle dich dem Konflikt direkt mit einem [interaktiven Rebase](rebase.md).

## Grenzen

- **Der Commit muss ein Vorfahre von `HEAD` sein.** Ein Commit auf einem
  nicht gemergten Seiten-Branch hat keinen Pfad zu deinem aktuellen Branch,
  auf dem er nachgespielt werden könnte.
- Binärdateien und Dateien über 2 MB werden angezeigt, sind aber nicht
  editierbar.
- Ein Commit, der schon auf einem Remote liegt, lässt sich bearbeiten, aber
  dein nächster Push muss ein **Force-Push** sein — der Editor warnt, bevor du
  dich darauf einlässt.
- Im Commit gelöschte Dateien lassen sich nicht bearbeiten (es gibt keinen
  Inhalt zum Bearbeiten).
- **Datei hinzufügen** erreicht Dateien, die im Snapshot des Commits schon
  existieren; es kann keine ganz neue Datei anlegen, keine löschen und keinen
  Symlink oder kein Submodul anfassen.

**Siehe auch:** [Interaktiver Rebase](rebase.md) · [Wiederherstellung & das Reflog](recovery.md) · [Einarbeiten](absorb.md)
