---
title: Workspaces, Tabs & Gruppen
category: Erste Schritte
order: 3
summary: Viele Repositorys, ohne unterzugehen: Tabs, Gruppen, Ordner und Workspaces.
keywords: workspace arbeitsbereich tabs gruppen ordner mehrere repos organisieren wechseln layout zu repository wechseln umschalter tab-größe go to repository switcher tab sizing
source: 586a4f8276c9ee0949d40b012b298df48e7b696f
---

# Workspaces, Tabs & Gruppen

Drei Ebenen, von der lockersten zur festesten.

## Tabs

Ein Repository, ein Tab. Mit <kbd>⌘T</kbd> / <kbd>Ctrl+T</kbd> öffnest du die
Auswahl für einen neuen Tab, mit <kbd>⌘W</kbd> / <kbd>Ctrl+W</kbd> schließt du den
aktiven. Du kannst sie außerdem per Drag umsortieren, mit der mittleren Maustaste
schließen oder mit <kbd>⌘⇧T</kbd> den zuletzt geschlossenen wieder öffnen.
Rechtsklick auf einen Repository-Tab (oder einen Chip in einer
[Gruppe](#gruppen)) öffnet das [Repository-Kontextmenü](repo-menu.md) — Alias,
Worktrees, GitHub, Terminal, Anzeigen, Editor und ganz unten **Dieses Repo
schließen** und **Andere schließen** (ein Chip in einer Gruppe bietet stattdessen
Entfernen an).
Schließt du den letzten Tab, schließt <kbd>⌘W</kbd> stattdessen das Fenster. Ein
Punkt auf dem Tab bedeutet nicht committete Arbeit; ein anderer bedeutet
Konflikte.

Erscheint eine Warnung beim Schließen, bricht <kbd>Escape</kbd> immer ab.
<kbd>Enter</kbd> bestätigt nur, wenn der Tab sauber ist — bei nicht committeten
Änderungen oder Konflikten zwingt dich die Warnung absichtlich, zum Button zu
greifen, damit ein versehentlicher Tastendruck nach <kbd>⌘W</kbd> keine Arbeit
schließen kann, die du noch festhieltest.

### Tab-Größe

Standardmäßig (**Einstellungen → Layout → Tab-Größe → Anpassen**) verhalten sich
Tabs wie die eines Browsers: Wird die Leiste zu eng, schrumpfen sie gleichmäßig bis
zu einer Mindestbreite und scrollen erst, wenn auch diese Grenze erreicht ist.
**Fest** stellt das klassische Verhalten wieder her — jeder Tab behält die Breite
seines Inhalts, und die Leiste scrollt, sobald nicht mehr alle hineinpassen.

### Zu einem Repository wechseln

Mit zehn oder mehr offenen Repositorys heißt eines in der Leiste zu finden
scrollen, <kbd>⌘1</kbd>–<kbd>⌘9</kbd> hören beim neunten Tab auf, und die
[Befehlspalette](search.md) mischt die offenen Repositorys unter alle Aktionen.
Drück <kbd>⌘J</kbd> / <kbd>Ctrl+J</kbd> (oder **Ansicht → Zu Repository
wechseln…**), tipp ein paar Buchstaben seines Namens, Ordners oder Branches, dann
<kbd>Enter</kbd>.

![Der Repository-Umschalter, zuletzt benutzte zuerst](../../screenshots/repo-switcher.webp)

Die Liste enthält nur offene Repositorys, Gruppenmitglieder eingeschlossen, in der
Reihenfolge, in der du sie zuletzt angesehen hast. Das, das du gerade verlassen
hast, steht oben, also bringt dich <kbd>⌘J</kbd> <kbd>Enter</kbd> dorthin zurück.
Jede Zeile trägt, was ihr Tab zeigt: den Branch, den Punkt für nicht committete
Arbeit oder Konflikte, die Gruppe, in der es liegt, und seine Taste
<kbd>⌘1</kbd>–<kbd>⌘9</kbd>, wenn es eine hat. Das Repository auf dem Bildschirm
steht abgeblendet ganz unten. Hinter dem Umschalter wird nichts abgedunkelt; ein
Klick daneben oder <kbd>Esc</kbd> schließt ihn.

Passt nichts Offenes, trägt die letzte Zeile, **In allen Repositories suchen**,
deine Suche auf die Seite [Repositories](repositories.md). Das Tastenkürzel lässt
sich in **Einstellungen → Tastenkürzel** neu belegen.

*Grenzen:* Die Reihenfolge wird nur für diese Sitzung gemerkt, nach einem Neustart
beginnt sie also mit der Tab-Reihenfolge. Ein Repository, das in zwei Tabs offen
ist, steht einmal in der Liste, bei seinem ersten Tab. Repositorys in anderen
[Workspaces](#workspaces) werden nicht gelistet — wechsle zuerst den Workspace oder nimm
die Seite Repositories.

## Gruppen

Bündle zusammengehörige Repositorys in einem benannten, farblich markierten
**Gruppen-Tab**. Innerhalb einer Gruppe bekommst du eine zweite Zeile mit einem
Chip pro Repository, und die Gruppe selbst kann in einem Rutsch **alles fetchen**
oder **alles pullen**.

Um eine zu beginnen, Rechtsklick auf einen Repository-Tab → *Neue Gruppe…*: Der
Tab wird zu einer Gruppe mit diesem Repository, an derselben Stelle. Gibt es schon
eine Gruppe, heißt derselbe Menüpunkt *Zu Gruppe hinzufügen →* und listet die
offenen Gruppen. Einen Repository-Tab auf einen Gruppen-Chip zu ziehen tut dasselbe.

*Neue Gruppe…* fragt Name und Farbe zusammen ab. Die Farbe startet zufällig auf
einer, die noch keine offene Gruppe trägt, damit nicht alle Gruppen gleich
beginnen.

![Der Dialog Neue Gruppe, mit Name und Farbe zusammen gewählt](../../screenshots/new-group-dialog.webp)

Um eine Gruppe umzufärben, Rechtsklick auf sie: Die zehn Farben stehen im Menü als
Reihe von Punkten, mit einem Ring um die aktuelle, und ein Klick wendet sie an.
*Eigene Farbe…* unter der Reihe öffnet eine Auswahl für jede andere Farbe. Ordner
und die Abschnitte auf der Seite Repositories nutzen dieselbe Reihe.

![Das Kontextmenü einer Gruppe: die Farbreihe, Eigene Farbe…, Gruppierung aufheben und Gruppe schließen](../../screenshots/group-color-menu.webp)

Um eine Gruppe aufzulösen, Rechtsklick auf sie → **Gruppierung aufheben**. Jedes
Repository wird ein gewöhnlicher Tab an der Stelle der Gruppe und behält die
Seiten, die es offen hatte. **Gruppe schließen** schließt stattdessen die Gruppe
und jedes Repository darin. Ordner überleben das Aufheben nicht: Es gibt sie nur
innerhalb einer Gruppe.

![Ein Gruppen-Tab mit mehreren Repositorys](../../screenshots/repo-groups.webp)

Gruppen können **Ordner enthalten, beliebig tief verschachtelt**: Rechtsklick auf
die Gruppe → *Neuer Ordner…*, dann zieh Repositorys auf einen Ordner-Chip. Jeder
Ordner bekommt eine Farbe, klappt zu einem Chip mit Zähler zusammen, aggregiert
die Status-Punkte von allem, was in ihm steckt, und kann seinen ganzen Teilbaum
fetchen oder pullen.

![Ordner in der Tab-Leiste der Gruppe, jeder ein Chip mit Zähler — Internal verschachtelt in Services](../../screenshots/nested-folders.webp)

> Ordner organisieren nur. Löschst du einen, wandern seine Repositorys eine Ebene
> nach oben — ein Repository wird dabei nie geschlossen.

Um ein Repository hinzuzufügen, das die Gruppe noch nicht enthält, klicke auf das **+** neben dem Gruppennamen. Es zeigt die Seite der Gruppe – Ordner öffnen, klonen, anlegen oder ein zuletzt genutztes Repository wählen –, auch wenn eines ihrer Repositories geöffnet ist; ein Klick auf einen Chip führt dorthin zurück.

## Seiten, die zu einem Repository gehören

Manche Seiten sind nichts Eigenes: das [Wiki](repo-wiki.md) eines Repositories,
seine [Insights](insights.md), die [Dev-Werkzeuge](devtools.md), die eine
Launch-Sitzung angekündigt hat. Sie belegen keinen Tab — sie erscheinen als
kleine Chips am Repository selbst: ein Symbol und ein Wort, das sagt, welche Seite
es ist (*CI*, *PRs*, *Wiki*, *#482* für einen Pull Request, das Tag eines Releases).
Der volle Name steht im Tooltip, und ein langes Tag oder ein langer Titel wird mit
Auslassungspunkten gekürzt.

- **Klick auf ein Symbol** zeigt die Seite. **Noch einmal klicken — oder auf den
  Namen des Repositories** — bringt zum Repository zurück. Solange eine Seite
  gezeigt wird, bekommt der Name einen Zeigefinger-Cursor und beim Überfahren
  eine kleine Pille: er ist der Weg zurück.
- **Über ein Symbol fahren** zeigt das ✕, das genau diese Seite schließt.
- In einer **Gruppe** sitzen die Symbole am Chip des Repositories, zu dem sie
  gehören, und nur solange dieses Repository ausgewählt ist. Ein anderes Repo
  der Gruppe zeigt *dieses* Repository, nicht das Werkzeug des Nachbarn.
- Dieselbe Seite erneut zu öffnen erhellt das vorhandene Symbol, statt ein
  zweites hinzuzufügen.

Ein Repository, das nirgends offen ist, kann kein Symbol tragen — eine Seite
dafür öffnet stattdessen einen eigenen Tab: Öffnen muss immer etwas öffnen.

## Workspaces

Ein Workspace ist eine **komplette gespeicherte Tab-Leiste**. Ein Wechsel tauscht
alle Tabs auf einmal aus: `Work` und `Personal` treten sich nicht mehr gegenseitig
auf die Füße.

Der Workspace-Name sitzt oben links, neben dem Gitcito-Zeichen. Klick ihn an, um
zu wechseln, anzulegen, umzubenennen, umzusortieren oder zu löschen. Daneben liegt
die Anzeige, die [Mission Control](mission-control.md) für den Workspace öffnet, in
dem du gerade bist.

**Siehe auch:** [Mission Control](mission-control.md) · [Die Kommandozeile](cli.md)
