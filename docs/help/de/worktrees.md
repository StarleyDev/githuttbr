---
title: Worktrees & Submodule
category: Sync & viele Repos
order: 54
summary: Mehrere Checkouts eines Repositorys; und Repositorys in Repositorys.
keywords: worktree worktrees submodul submodule submodules verknüpfter checkout init sync
---

# Worktrees & Submodule

## Worktrees

Ein Worktree ist ein zweiter Checkout desselben Repositorys, in seinem eigenen
Ordner — du kannst dir also `main` ansehen, während `feature/x` genau so bleibt,
wie du es verlassen hast, ganz ohne Stashen.

- Worktrees aus der Seitenleiste anlegen und entfernen. Ein **Doppelklick**
  öffnet einen als eigenen Tab; der Rechtsklick bietet *Worktree öffnen*, *Im
  Ordner anzeigen* und das Entfernen.
- Rechtsklick auf einen lokalen Branch → **In einem Worktree öffnen**, um einen im
  Nachbarordner hochzuziehen und ihn als Tab zu öffnen.
- Ein Branch kann immer nur in einem Worktree liegen, ein Checkout eines Branches,
  den ein anderer Worktree hält, kann also nicht klappen — git lehnt mit *already
  used by worktree at …* ab. GitHuttBr bringt dich stattdessen hin: das Branch-Menü
  sagt *Zu `x` in seinem Worktree wechseln*, und ein Doppelklick auf die Zeile
  öffnet den Tab dieses Worktrees, statt zu scheitern.

### Worktrees pflegen

Ein Worktree vom letzten Monat gerät schnell in Vergessenheit, und die Fragen kommen beim Aufräumen: Steckt darin noch Arbeit? Gibt es den Ordner überhaupt noch? Jede Zeile beantwortet sie, bevor du fragen musst.

| In der Zeile | Bedeutet |
|---|---|
| **●3** | Drei Dateien mit nicht committeten Änderungen in diesem Worktree |
| **↑2 ↓1** | Sein Branch ist zwei Commits vor und einen hinter seinem Upstream |
| 🔒 | Gesperrt – fahre darüber, um den beim Sperren angegebenen Grund zu sehen |
| **fehlt**, Name durchgestrichen | Der Ordner ist weg; git hat nur noch den Eintrag |

![Der Abschnitt Worktrees: ein Worktree mit nicht committeter Arbeit und Commits
voraus, einer fehlt, einer gesperrt, und der Radiergummi im Kopf](../../screenshots/worktree-care.webp)

Die Zahlen werden gelesen, wenn der Abschnitt aufgeht, wenn sich der Commit dieses Worktrees bewegt und wenn das Fenster den Fokus zurückbekommt – nicht bei jeder Aktualisierung, denn jede ist ein `git status` in einem anderen Ordner.

Rechtsklick auf eine Zeile für:

| Aktion | Was sie tut |
|---|---|
| **Worktree sperren** | Verhindert, dass git (und jeder andere Client) ihn bereinigt, verschiebt oder entfernt. Gib einen Grund an – *auf der externen Platte* –, und er erscheint am Schloss. Für Worktrees auf Medien, die nicht immer angeschlossen sind. |
| **Worktree entsperren** | Das Gegenteil. Rückgängig sperrt ihn wieder, mit demselben Grund. |
| **Worktree verschieben…** | Verschiebt den Ordner und aktualisiert die Verknüpfungen von git in beide Richtungen. Nicht verfügbar, solange er gesperrt oder in einem Tab geöffnet ist – Tabs und ihr Layout werden über den Pfad gemerkt, der Tab zeigte sonst ins Leere. Schließe ihn zuerst. Rückgängig verschiebt ihn zurück. |
| **Worktree entfernen** | Fragt git zuerst, was verloren ginge. Ein sauberer Worktree bekommt die normale Bestätigung, und Rückgängig legt ihn auf demselben Branch im selben Ordner neu an. Einer mit nicht committeten Änderungen bekommt eine eigene Bestätigung, *Verwerfen und entfernen*, die die Anzahl nennt – ohne Rückgängig. |
| **Verschobenen Ordner neu verbinden…** | Nur in einer *fehlt*-Zeile: Gib an, wohin der Ordner gewandert ist (im Dateimanager verschoben), und git verknüpft ihn mit `git worktree repair` neu. |
| **Fehlende Worktrees vergessen** | Auch der Radiergummi-Knopf im Abschnittskopf, sichtbar, sobald eine Zeile fehlt. Führt `git worktree prune` aus. |

Was diese Aktionen **nicht** tun:

- **Das Entfernen eines Worktrees löscht auch seine ignorierten Dateien** – `.env`, `node_modules`, Build-Ausgaben. git zählt sie nicht als Änderungen, daher weist schon die „saubere“ Bestätigung darauf hin, und Rückgängig holt sie nicht zurück.
- **Vergessen löscht nur den Eintrag in git.** Es gibt keine Dateien zu löschen – der Ordner ist schon weg –, und gesperrte Worktrees werden übersprungen, denn ein gesperrter auf einer abgezogenen Platte sieht genauso aus wie ein gelöschter.
- Eine Sperre ist eine Absprache zwischen git-Clients, kein Dateischutz: Sie hält nichts außerhalb von git davon ab, den Ordner zu löschen.
- Der Haupt-Worktree – das Repository selbst – kann weder gesperrt, verschoben noch entfernt werden.
- Das Entfernen eines Worktrees löscht nie seinen Branch. Lösche ihn in der Branch-Liste, wenn du fertig bist.

### Worktrees im Header gruppieren

Worktree-Tabs öffnen mit Beschriftungen `root · branch`, und das wird schnell breit.

**Ein Projekt in einer Gruppe nimmt seine Worktrees auf.** Liegt das Repository —
oder einer seiner Worktrees — schon in einer Gruppe, öffnet sich ein neuer
Worktree in dieser Gruppe, direkt daneben, ohne dass du etwas abhaken musst: der
Dialog zum Hinzufügen eines Worktrees sagt nur, welche Gruppe, und **In einem
Worktree öffnen** im Menü eines Branches macht dasselbe, ohne zu fragen. Ein
Worktree, der später aus **Zuletzt** oder aus einem Ordner geöffnet wird, kommt
ebenfalls hinein. Zieh den Chip aus der Gruppe, wenn du ihn für sich haben willst.

Für ein Repository in einem eigenen Tab setze im Dialog zum Hinzufügen eines
Worktrees das Häkchen bei **Gruppierung von Worktrees mit gemeinsamem
Stamm-Repository anbieten** (standardmäßig aus, gemerkt wie die
codegraph-Option): Ist die Wurzel als eigenständiger Tab offen, erscheint ein
Feld **Gruppenname** (vorausgefüllt mit dem Ordnernamen der Wurzel), und beide
landen in einer neuen Gruppe; ist kein Familienmitglied offen, sagt der Dialog
nur, dass der Worktree als eigener Tab öffnet. In der Gruppe schrumpfen die Chips
auf das letzte Stück (`main`, `feature/x`), weil die Gruppe schon sagt, zu welchem
Repository sie gehören — ein Schalter unter Einstellungen → Layout & Terminal
behält den vollen Namen `root · branch`, wenn dir das lieber ist. Das Angebot
fasst nur Worktrees mit derselben Wurzel zusammen — nie fremde Repositorys.

**Einen Worktree-Tab erkennen.** Ein verknüpfter Worktree ist ein zweiter
Checkout eines Repositorys, und sein Tab sähe sonst genauso aus wie der des
Repositorys selbst. Deshalb zeigt ein Worktree-Tab statt des Ordnersymbols eine
grüne **Gabelung** — auf einem Bild-Tab eine kleine Gabelung in der Ecke des
Bildes —, und sein Tooltip sagt *Worktree von …* mit dem Ordner, in dem er liegt.
Der Rechtsklick bietet **… öffnen, das Hauptrepository**: Es holt den Tab mit dem
Haupt-Checkout nach vorn oder öffnet ihn — in der Gruppe des Worktrees, wenn der
Worktree in einer liegt. Das klappt, egal wie der Worktree geöffnet wurde: aus
seiner Familie, über **Repository öffnen** oder aus der gescannten Liste, und die
Worktrees eines Submoduls verweisen auf das Submodul. Grenzen: die Markierung
sagt, wo der Checkout liegt, nicht welcher Branch es ist; die Worktrees eines
Bare-Repositorys werden nicht markiert, da es keinen Haupt-Checkout zum Öffnen
gibt; und ein Hauptrepository, das über einen Ordner-Symlink geöffnet ist, wird
nicht als schon offen erkannt, also öffnet das Menü es ein zweites Mal unter
seinem echten Pfad.

![Ein Worktree-Tab mit dem grünen Gabelungssymbol neben dem Tab des
Hauptrepositorys, sein Menü offen auf submodules-worktrees öffnen, das Hauptrepository](../../screenshots/worktree-tab.webp)

![Die Worktree- und Submodul-Abschnitte der Seitenleiste, beide gefüllt](../../screenshots/worktrees.webp)

## Submodule

Submodule hinzufügen, aktualisieren (init & checkout), URLs synchronisieren und
entfernen — mit Live-Status für jedes einzelne:

| Status | Bedeutet |
|---|---|
| **Synchron** | Ausgecheckt auf dem Commit, den das übergeordnete Repository festhält |
| **Verändert** | Woanders ausgecheckt, oder schmutzig |
| **Nicht initialisiert** | Eingetragen, aber nie ausgecheckt |

![Submodule mit ihrem jeweiligen Status, eine Zeile pro Stück](../../screenshots/submodule-states.webp)

**Siehe auch:** [LFS & Sparse-Checkout](lfs-sparse.md) · [Fetchen, Pullen & Pushen](syncing.md)
