---
title: Objekt-Explorer
category: Repository & Historie
order: 16
summary: Die Schicht unter dem Graphen ablaufen — Commits, Trees, Blobs, Tags und die Refs, die auf sie zeigen. Nichts hier ändert irgendetwas.
keywords: objekte objects objekt-explorer object explorer blob tree commit tag ref plumbing cat-file ls-tree sha1 interna internals datenbank database rev-parse HEAD^{tree} lose loose gepackt packed
source: 946d418d5b13af167a16a2f0d3164d813b423ab6
---

# Objekt-Explorer

Git hat den Ruf, kompliziert zu sein. Fast alles davon rührt daher, dass man
das Modell nie zu Gesicht bekommt: **vier Arten von Objekten, und Zeiger**.
Sobald du auf einen Commit klicken, bei seinem Tree landen und feststellen
kannst, dass deine Datei ein Blob *ist*, dem ein Tree einen Namen gegeben hat,
hört das Porzellan auf, Magie zu sein.

`⌘K` → **Objekt-Explorer**. Nichts auf dieser Seite kann ein Byte verändern —
jeder Aufruf dahinter ist ein Lesevorgang.

![Der Commit, auf den main zeigt: der Pfad ab dem Branch, worauf er zeigt und wo ein Commit im Modell steht](../../screenshots/objects.webp)

## Die vier Objekte

| Objekt | Ist | Weiß |
|--------|----|-------|
| **blob** | Der *Inhalt* einer Datei | Nichts. Nicht seinen Namen, nicht seinen Pfad, nicht seine Historie |
| **tree** | Ein Verzeichniseintrag | Namen, Modi und die SHA jedes Kind-Blobs oder -Trees |
| **commit** | Eine Momentaufnahme | Seinen Tree, seine Parents, Autor, Committer, Nachricht |
| **tag** | Ein annotierter Tag | Das Objekt, auf das er zeigt, den Tagger, eine Nachricht |

Die Überraschung ist für die meisten die erste Zeile. **Ein Blob hat keinen
Namen.** Zwei Dateien mit identischem Inhalt, irgendwo in deiner Historie, sind
derselbe Blob und werden einmal gespeichert. Der Name lebt im Tree, der auf ihn
zeigt — weshalb Git Inhalte trackt statt Dateien, und weshalb Umbenennungen
erkannt und nicht aufgezeichnet werden.

Eine **Ref** — `refs/heads/main`, `refs/tags/v1.0`, `HEAD` — ist nur eine Datei,
die eine SHA enthält. Das ist alles, was hinter „Branchen ist billig" steckt.

## Ablaufen

![Vom Commit bis src/: Ordner zuerst, jeder Modus ausgeschrieben](../../screenshots/objects-tree.webp)

Die linke Spalte listet jede Ref, gruppiert wie Git gruppiert: HEAD (mit
`→ main`, wenn er auf einem Branch steht), Branches, Tags und Remotes, jeweils
mit Anzahl. Remotes startet eingeklappt. Eine eckige Markierung ist eine Ref auf
einen Commit, eine runde grüne ein **annotierter** Tag. Der Filter schränkt alle
Gruppen zugleich ein. Ein Klick auf eine Ref öffnet das Objekt, das sie benennt;
die Zeile bleibt hervorgehoben, solange du von ihr aus läufst.

Von dort ist alles eine Tür:

- Ein **Commit** zeigt, worauf er **zeigt** — seinen Wurzel-Tree mit der Zahl
  seiner Einträge und jeden Eltern-Commit mit Betreff —, dann Autor und
  Committer (*wie der Autor*, wenn sie gleich sind) und die Nachricht.
- Ein **Tree** ist eine Tabelle aus Name, Modus, Objekt und Größe, Ordner
  zuerst. Jeder Modus ist ausgeschrieben: *Datei*, *ausführbar*, *Ordner*,
  *Symlink*, *Submodul*. Ein Ordner nennt die Zahl seiner Einträge, ein Symlink
  sein Ziel.
- Ein **Blob** zeigt seinen Text mit Zeilennummern (bei Großem nur den Anfang)
  oder sagt klar, dass er binär ist. Über einen Tree erreicht, sagt eine Leiste,
  wie er dort heißt — *Heißt src/app.ts in Commit 07c6f3d, Modus 100644
  (normale Datei)* — mit einem Link zum Verlauf der Datei.
- Ein **annotierter Tag** zeigt auf das benannte Objekt und hält den Tagger fest.

![Ein Blob, der Name, den sein Tree ihm gab, und sein Platz im Modell](../../screenshots/objects-blob.webp)

### Der Pfad

Das Band unter dem Revisionsfeld ist der gegangene **Pfad**:
`Branch main → Commit 07c6f3d → Wurzel → src/ → app.ts`. Der Tree eines Commits
ist die **Wurzel**; eine Datei oder ein Ordner bekommt den Namen der angeklickten
Zeile. Ein Klick auf einen Eintrag führt dorthin zurück. Eine Revision tippen,
eine Ref oder eines der Beispiele neben **Öffnen** wählen beginnt einen neuen Pfad.

**Zurück** und **Vorwärts** gehen durch alles Geöffnete, wie im Browser: Nach
einem Zurück führt Vorwärts wieder hin, bis du von dort etwas Neues öffnest. Das
Revisionsfeld folgt dem Weg, `main:src/app.ts` steht also immer zum Kopieren bereit.

### Farben

Jede Art behält überall dieselbe Farbe — Abzeichen, Pfadeintrag, Karte, Zeile:
Commit in der Akzentfarbe des Themes, Tree in dessen Gelb, Blob in Blau, Tag und
Ref in Grün. Unter dem Kopf des Objekts sagt ein Satz, was diese Art *ist*.

### Wo du im Modell bist

Die Leiste unten im Bereich ist Gits Kette — **ref → commit → tree → blob**,
bei einem annotierten Tag mit **tag** zwischen ref und commit —, und die
angezeigte Art leuchtet als *du bist hier*.

## Eine Revision eintippen

Das Feld nimmt alles, was `git rev-parse` akzeptiert — und hier hört es auf, ein
Browser zu sein, und fängt an, ein Weg zum Lernen zu werden:

| Tipp das ein | Um das zu bekommen |
|-----------|--------|
| `HEAD` | Den aktuellen Commit |
| `HEAD~3` | Drei Commits zurück |
| `HEAD^{tree}` | Den Tree dieses Commits, ausgeschält |
| `HEAD:src/app.ts` | Den Blob für diesen Pfad, direkt |
| `v1.0^{}` | Das, worauf ein annotierter Tag zeigt, statt des Tag-Objekts |
| `a1b2c3d` | Jedes Objekt, per SHA — Abkürzungen funktionieren |

Die Modus-Ziffern in einer Tree-Auflistung lohnen sich zu kennen: `100644` eine
Datei, `100755` ausführbar, `040000` ein Untertree, `120000` ein Symlink,
`160000` ein Submodul-Gitlink — wobei letzteres alles ist, was ein Submodul
überhaupt speichert.

## Grenzen, die man kennen sollte

- **Nur lesend, mit Absicht.** Es gibt hier nichts zum Schreiben. Objekte von
  Hand zu bauen ist eine Übung mit `git hash-object` und gehört in ein Terminal.
- **Große Blobs werden abgeschnitten**, nach den ersten 200 KB — genug, um zu
  sehen, worum es geht, nicht genug, um das Fenster hängen zu lassen.
- **Größen sind die Inhaltsgröße des Objekts**, so wie `git cat-file -s` sie
  meldet, nicht das, was es nach dem Packen auf der Platte kostet. Dafür siehe
  [Wartung](maintenance.md).
- **Unerreichbare Objekte sind trotzdem Objekte.** Füg eine SHA aus einem
  Dangling-Bericht von `git fsck` ein, und sie öffnet sich — oft der schnellste
  Weg zu sehen, was ein verlorener Commit enthielt, bevor du entscheidest, ob du
  ihn zurückholst.
- **Eine Submodul-Zeile öffnet sich nicht.** Ihr Gitlink nennt einen Commit
  eines anderen Repositorys, den dieses nicht hat.
- **Zählungen und Symlink-Ziele haben eine Obergrenze.** Ein Tree mit mehr als
  300 Unterordnern listet sie ohne Anzahl, und nur die ersten 50 Symlinks
  zeigen ihr Ziel.
- **Der Pfad endet mit dem Dialog.** Schließ ihn, und der nächste beginnt wieder
  beim Branch von HEAD.

Siehe auch: [Der Graph](graph.md) · [Repository-Wartung](maintenance.md) ·
[Wiederherstellung](recovery.md)
