---
title: Branches aufräumen
category: Branches & Eingriffe
order: 47
summary: Lösche die lokalen Branches, deren Arbeit schon woanders liegt — verschwundene Upstreams, gemergte Branches — in einem Schritt, der sich rückgängig machen lässt.
keywords: aufräumen bereinigen prune löschen entfernen lokale branches verschwunden gemergt squash veraltet tot alt pull request ordnen branch-liste clean up cleanup delete remove gone merged stale tidy
source: 701f92f45b9e4dcda7dc560cb20128442fd2da0d
---

# Branches aufräumen

Jeder Pull Request, den du auscheckst, hinterlässt einen lokalen Branch. Der PR
wird gemergt, der Server löscht seinen Branch, und der lokale bleibt — für immer.
Nach ein paar hundert Reviews besteht die Branch-Liste großteils aus toten
Branches, und die lebendigen zu finden heißt, an allen vorbeizuscrollen.

Branches aufräumen listet die lokalen Branches, deren Arbeit schon woanders sicher
ist, hakt die an, bei denen nichts verloren geht, und löscht sie in einem Schritt,
den du rückgängig machen kannst. „Woanders“ heißt: die Remote-Tracking-Branches
nach deinem letzten Fetch und der Standard-Branch.

![Der Aufräum-Dialog: verschwundene, gemergte und squash-gemergte Branches angehakt, Arbeit, die es nur hier gibt, zurückgehalten](../../screenshots/branch-cleanup.webp)

## So funktioniert es

1. Werkzeuge → **Lokale Branches aufräumen…** (oder <kbd>⌘K</kbd>).
2. Drück zuerst **Fetch & Prune**, wenn der letzte Fetch alt ist. Bis ein Fetch mit
   Prune läuft, sieht ein Branch, den der Server gelöscht hat, hier noch lebendig
   aus.
3. Wenn dein Team Pull Requests per Squash merged, drück **Squash-Merges prüfen**
   (siehe unten).
4. Prüf die Haken, dann **Löschen**. Eine einzige Bestätigung sagt, wie viele
   Branches gehen, und nennt jeden, der Commits enthält, die es nirgendwo sonst
   gibt.

Das Löschen ist eine Operation mit einem Undo-Eintrag: **Rückgängig** legt jeden
gelöschten Branch am genau selben Commit wieder an, mit seinem Upstream
(`branch.<name>.remote` und `.merge`). Ist seitdem ein Branch gleichen Namens an
einem anderen Commit aufgetaucht — derselbe PR erneut ausgecheckt —, lässt
Rückgängig ihn in Ruhe, holt den gelöschten daneben zurück, als
`<name>-restored-<short sha>`, und sagt das.

Die Erfolgsmeldung und der Undo-Eintrag listen jeden Branch mit dem Commit, auf den
er zeigte (`feature/x (was abc1234)`), so wie `git branch -D` es ausgibt: Der
Undo-Verlauf lebt nur, solange die App offen ist, und diese Zeile reicht, um einen
Branch von Hand neu anzulegen.

## Warum ein Branch gelistet wird

| Chip | Bedeutet |
|---|---|
| **Verschwunden** | Der Branch folgt einem Upstream, den der Server gelöscht hat — die übliche Spur eines gemergten Pull Requests. |
| **Gemergt** | Jeder Commit darauf ist schon im Standard-Branch. Der Tooltip nennt die Kopie, die ihn enthält — `main (local, not pushed)`, wenn nur deine lokale es tut. |
| **Squash-gemergt** | Gefunden von **Squash-Merges prüfen**: Sein Inhalt ist im Standard-Branch, seine einzelnen Commits nicht. |
| **Veraltet** | Kein Commit seit der Anzahl Monate, die du wählst (Standard 3). Nur gelistet, wenn du **Auch veraltete Branches anzeigen** anhakst. |
| **N Commits gibt es nur hier** | Commits, die auf keinem Remote-Tracking-Branch und nicht im Standard-Branch sind. Den Branch zu löschen löscht sie. |
| **Noch keine Commits** | Er zeigt genau auf die Spitze des Standard-Branches — vermutlich angelegt und nie benutzt. |

„Gemergt“ wird gegen die Remote-Kopie des Standard-Branches gemessen
(`origin/main`) und auch gegen deine lokale — ein lokales `main`, das einen Monat
niemand gepullt hat, kann die Merges seitdem nicht verstecken.

## Squash-Merges

Ein Squash-Merge legt die Änderungen eines Pull Requests als einen neuen Commit auf
`main`; die eigenen Commits des Branches kommen nie an. Für git sieht so ein Branch
nach aufgegebener Arbeit aus: **Verschwunden**, mit *N Commits gibt es nur hier*.

Wenn verschwundene Branches mit eigenen Commits gelistet sind, stellt
**Squash-Merges prüfen** eine andere Frage: Würde es etwas ändern, diesen Branch in
`main` zu mergen? Es führt ein `git merge-tree` im Speicher für alle aus — kein
Checkout, kein Index —, und ein Branch, dessen Merge den Baum von `main` genau so
lässt, wie er ist, bekommt den Chip **Squash-gemergt** und wird wie ein gemergter
angehakt. Die Bestätigung sagt, dass ihr Inhalt in `main` ist und ihre Commits
nicht.

Die Prüfung läuft im Moment des Löschens erneut, unter der Sperre: Ein Branch, der
sie nicht mehr besteht, wird abgelehnt, nicht gelöscht.

## Was angehakt ist, und was nie

Beim Öffnen des Dialogs angehakt: Branches, die **verschwunden oder gemergt** sind
und **keine eigenen Commits** haben — dazu squash-gemergte, sobald geprüft.
**Verschwundene + gemergte auswählen** stellt diese Auswahl wieder her.

Nie für dich angehakt und nie von **Alle angezeigten auswählen** erreicht: ein
Branch mit Commits, die es nur hier gibt. Hak ihn Zeile für Zeile an; die
Bestätigung wird dann rot und listet ihn mit seiner Commit-Zahl. Nur veraltete
Branches und einer, der auf der Spitze des Standard-Branches steht, werden auch nicht
angehakt. Enthält die Auswahl Zeilen, die die Liste nicht zeigt — vom Filter
versteckt oder jenseits der ersten 400 —, sagt die Bestätigung, wie viele.

Das Löschen akzeptiert pro Branch genau die Zahl eigener Commits, die die
Bestätigung gezeigt hat. Hat ein Branch inzwischen mehr — oder hat er bei
**Wiederholen** seit dem Rückgängigmachen welche dazubekommen (etwa weil ein Prune
die Remote-Kopie entfernt hat) —, wird er abgelehnt und behalten, und Wiederholen
meldet das, statt Erfolg zu behaupten.

Nie gelistet und vom Löschen abgelehnt, selbst wenn verlangt:

- der aktuelle Branch;
- ein Branch, der in irgendeinem Worktree ausgecheckt ist oder dort gerade rebased
  wird;
- der Standard-Branch;
- [geschützte Branches](repo-settings.md), einschließlich Mustern wie `release/*`
  aus der [Repository-Konfiguration](repo-config.md).

Auf dem Remote ändert sich nichts. Das löscht nur lokale Branches.

## Grenzen

- **Squash-Merges sind für git unsichtbar**, bis du prüfst. Ohne **Squash-Merges
  prüfen** erscheint ein squash-gemergter Branch als **Verschwunden** mit *N Commits
  gibt es nur hier* und wird nicht angehakt.
- **Die Squash-Prüfung kann danebenliegen.** Sie beantwortet „ist dieser Inhalt
  schon in `main`?“. Hat `main` dieselben Zeilen später noch einmal geändert, oder
  wurde der Squash beim Mergen bearbeitet, würde der Merge etwas ändern, und der
  Branch bleibt ohne Haken. Sie sagt nie fälschlich ja auf eine Weise, die Inhalt
  verliert: Der Inhalt ist per Definition in `main`. Wie das
  [Konflikt-Radar](conflict-radar.md) schreibt sie lose Tree-Objekte, die `git gc`
  aufräumt.
- **Ein nicht gefetchtes Remote ist veraltet.** „Verschwunden“ stammt vom letzten
  Fetch. Ohne **Fetch & Prune** sieht ein Branch, der vor einer Stunde auf dem Server
  gelöscht wurde, noch lebendig aus, und ein frischer Merge ist noch nicht in
  `origin/main`.
- **Veraltet ist nur ein Datum.** Drei ruhige Monate sagen nichts darüber, ob die
  Arbeit sicher ist, deshalb werden veraltete Zeilen nie angehakt.
- **„Woanders“ sind die Remote-Tracking-Refs vom letzten Fetch**, nicht der Server
  in diesem Moment — und keine Tags. Ein Commit, den nur ein Tag hält, zählt als
  eigen, und ein Commit auf dem Remote-Branch eines anderen zählt nicht.
- Die Zahl eigener Commits hört bei 500 auf und zeigt *500+*. Die Summe in der
  Bestätigung ist eine Untergrenze — *mindestens N* —, weil gestapelte Branches
  Commits teilen.
- Rückgängig stellt den Branch und seinen Upstream wieder her, nicht sein Reflog oder
  andere `branch.<name>.*`-Einstellungen.
- Der Dialog zeigt die ersten 400 Zeilen einer langen Liste; der Filter findet den
  Rest. **Verschwundene + gemergte auswählen** gilt für jede Zeile, gezeigt oder
  nicht.

**Siehe auch:** [Branches, Remotes & die Seitenleiste](branching.md) · [Fetchen, Pullen & Pushen](syncing.md) · [Pull-Request-Seite](pull-requests.md)
