---
title: Committen
category: Mit Änderungen arbeiten
order: 31
summary: Nachrichtenstile, Vorlagen, Co-Autoren und der Linter.
keywords: commit committen nachricht message composer conventional gitmoji ticket amend template vorlage co-author linter rückgängig undo reset generate with ai cancel undo
---

# Committen

## Nachrichtenstile

Wähle einen unter **Einstellungen → KI → Commit-Nachrichten** oder direkt im
Editor; der Editor passt sich daran an. Der Stil gehört zur KI, die das Profil
verwendet — der allgemeinen oder der eigenen des Profils.

| Stil | Sieht so aus |
|---|---|
| **Conventional** | `feat(api)!: add rate limiting` — mit einem **Typ ▾**-Button vor dem Betreff |
| **Gitmoji** | `✨ add rate limiting` — mit einer Emoji-Auswahl |
| **Gitmoji + Conventional** | `✨ feat(api): add rate limiting` — Emoji-Auswahl *und* **Typ ▾**-Button |
| **Ticket** | `ABC-123: add rate limiting` — aus dem Branch-Namen vorbefüllt |
| **Plain** · **Auto** | Was immer du tippst; bei Auto entscheidet die KI über die Form |
| **Caveman** · **Haiku** | Genau das, wonach es klingt |

Bei einem Conventional-Stil sitzt das Präfix auf dem **Typ ▾**-Button vor dem
Betreff (*feat(api)*, oder *Typ*, solange es keins gibt), und das Feld enthält
nur die Wörter danach; die Nachricht bekommt trotzdem das ganze `feat(api): …`.
Der Button listet die Typen, und **Kein Typ** nimmt das Präfix weg. Ein von Hand
getipptes Präfix funktioniert auch, und <kbd>Backspace</kbd> am Anfang des Felds
zeigt das Präfix wieder als Text, um seinen Scope zu ändern; es wandert zurück
auf den Button, sobald das Feld den Fokus verliert.

![Editor, vorbefüllt aus einer Commit-Vorlage](../../screenshots/commit-template.webp)

### Gitmoji

[Gitmoji](https://gitmoji.dev) stellt dem Betreff ein Emoji voran, damit sich
eine Historie auf einen Blick lesen lässt: 🐛 Fehlerbehebungen, ✨ Features,
🔥 Entfernungen. Bei beiden Gitmoji-Stilen sitzt die Emoji-Schaltfläche direkt
neben dem Betreff-Feld. Sie öffnet **alle 75 offiziellen Gitmoji**, durchsuchbar
nach Emoji, nach `:code:` (was gitmoji-cli-Nutzer tippen) oder nach Bedeutung in
deiner Sprache.

**Gitmoji + Conventional** hält Typ und Emoji im Gleichschritt. Wähle einen Typ,
und sein Emoji folgt; ändere den Typ, und es ändert sich mit — es sei denn, du
hast das Emoji selbst gewählt (etwa 🚑️ bei einem `fix`). Das wird nie überschrieben.

| Typ | Emoji | Typ | Emoji |
|---|---|---|---|
| `feat` | ✨ | `test` | ✅ |
| `fix` | 🐛 | `build` | 📦️ |
| `docs` | 📝 | `ci` | 👷 |
| `style` | 🎨 | `chore` | 🔧 |
| `refactor` | ♻️ | `revert` | ⏪️ |
| `perf` | ⚡️ | | |

Die KI schreibt in derselben Form. Vergisst ein Modell das Emoji oder antwortet
mit einem `:shortcode:`, wird der Betreff korrigiert, bevor er im Feld landet.

Commits, die andere Werkzeuge als `:sparkles: add login` geschrieben haben,
werden im Graphen, in den Commit-Details und in den Verlaufsansichten als
`✨ add login` **angezeigt**.

Grenzen:

- Die Auswahl schreibt immer das **Unicode**-Emoji, nie einen `:shortcode:`.
- Shortcodes werden nur für die Anzeige umgewandelt. Der Commit selbst wird
  nicht umgeschrieben, und die Suche im Verlauf findet den Text so, wie er
  committet wurde.
- Nur Gitmoji zählen: Ein Betreff, der mit einem anderen Emoji beginnt, bleibt unverändert.
- Ein Repository, dessen `commit-msg`-Hook commitlint mit dem Standard-Preset
  für Conventional ausführt, lehnt ein führendes Emoji ab. Das ist die Regel des
  Hooks, nicht von GitHuttBr — konfiguriere commitlint für Gitmoji oder nutze dort
  reines Conventional.

## Die Nachricht mit KI schreiben

Bei eingeschalteter KI steht der **✦**-Button (*Mit KI erzeugen* beim
Darüberfahren) unter der Beschreibung. Er liest den gestagten Diff und schreibt
Zusammenfassung und Beschreibung im oben gewählten Stil. Daneben nennt eine
eigene Auswahl, wer antwortet — *Konto · Modell*, das Paar, das unter **Einstellungen →
KI → Modell pro Aufgabe** für Commit-Nachrichten gewählt ist —, damit ein
langsames lokales oder ein teures Modell nie überrascht.

- **▾** neben dem Namen listet die gespeicherten Konten, jedes mit einigen
  seiner Modelle. Die Wahl gilt **nur für diese eine Erzeugung**; die
  Einstellungen ändern sich nicht.
- Während es läuft, dreht sich das ✦, und dieselbe Zeile zeigt die bisherigen
  Sekunden und **Abbrechen**, das die Anfrage selbst stoppt, nicht nur den
  Spinner. Zusammenfassung und Beschreibung sind währenddessen schreibgeschützt,
  damit die Antwort nichts überschreibt, was du tippst. Nach 30 Sekunden bietet
  die app-weite Meldung *dauert länger als erwartet* ([KI](ai.md)) an, weiter zu
  warten oder dieselbe Erzeugung auf ein anderes bereites Konto zu verlegen;
  **Erneut erzeugen** nutzt danach dieses Konto.
- Der neue Text **ersetzt** den alten, der aufbewahrt wird: **Rückgängig** und
  **Erneut erzeugen** erscheinen in derselben Zeile (beim Darüberfahren *Von
  Konto · Modell in 7 s erzeugt*). Rückgängig holt Zusammenfassung und
  Beschreibung zurück. Beide verschwinden, sobald du den Text bearbeitest oder
  committest.
- Die Beschreibung, die du tippst oder die die KI geschrieben hat, bleibt
  erhalten, wenn du zu einem anderen Tab wechselst und zurückkommst, wie die
  Zusammenfassung — und nach einer Erzeugung auch **Rückgängig** und **Erneut
  erzeugen**.

![Mit KI erzeugen und das Kontomenü](../../screenshots/commit-ai-generate.webp)

![Eine erzeugte Nachricht, mit Rückgängig und Erneut erzeugen neben dem Konto](../../screenshots/commit-ai-generated.webp)

[Commit bearbeiten](commit-edit.md) hat denselben Button, ausgehend vom Diff
dieses Commits.

Grenzen:

- Nur der gestagte Diff wird gesendet, bei sehr großen gekürzt — nie
  ungestagte Änderungen oder andere Dateien.
- Rückgängig hält einen Schritt: den Text vor der ersten Erzeugung in Folge. Ist
  Rückgängig weg, ist auch diese Kopie weg.
- Abbrechen erstattet keine Tokens, die ein Anbieter schon verbraucht hat.
- Die ▾-Liste zeigt alle gespeicherten Konten, auch eines ohne Schlüssel; es
  zu wählen scheitert mit dem Fehler dieses Kontos.

## Was der Editor für dich erledigt

- <kbd>↑</kbd> <kbd>↓</kbd> holt deine **letzten Nachrichten** zurück.
- Eine **Co-Autoren-Auswahl** fügt `Co-authored-by:`-Trailer aus den eigenen
  Mitwirkenden des Repositorys ein.
- `commit.template` / `.gitmessage` **befüllt** die Nachricht vor,
  Kommentarzeilen entfernt.
- Während eines Merge, Cherry-Pick oder Revert ist die Nachricht **vorbefüllt**,
  so wie git es täte.
- Entwürfe **bleiben** pro Repository erhalten, ein Tab-Wechsel verliert also
  nie eine Nachricht.

## Der Linter

Eine laufende, nicht blockierende Prüfung: Länge der Betreffzeile, ein Punkt am
Ende, ein nicht-imperativer oder kleingeschriebener Betreff, zu breite Zeilen im
Textkörper. Hinweise, niemals eine Schranke — er hält dich nicht vom Committen
ab. Die Länge ist der Zähler neben dem Betreff, gemessen am Limit von 72 Zeichen
(*56/72*): Er wird rot, sobald das Limit überschritten ist, und sein Tooltip
enthält den Rat, auf 50 zu zielen. Die übrigen Hinweise stehen unter der
Beschreibung.

## Amend

Amend schreibt den letzten Commit mit dem um, was gerade gestaged ist. GitHuttBr
zeigt dir zuerst die vorhandene Nachricht, damit du sie bearbeitest, statt sie
neu zu tippen.

**Commit ändern…** auf einer Zeile des Graphen tut dasselbe für HEAD: Es lädt
die vollständige Nachricht, schaltet den Editor in den Amend-Modus und
fokussiert ihn. Ein bereits gepushter HEAD lässt sich weiterhin ändern, aber
GitHuttBr warnt, dass das Aktualisieren des Remotes einen Force-Push braucht.

**Commit rückgängig…** ist das Geschwister für einen ungepushten HEAD: Mixed
Reset auf den Eltern-Commit, die Änderungen im Arbeitsbaum bleiben erhalten,
die Nachricht kehrt in den Editor zurück. Der allererste Commit hat einen
eigenen Weg, der einen ungeborenen Branch hinterlässt, statt die Dateien zu
zerstören.

**Siehe auch:** [Staging](staging.md) · [Absorbieren](absorb.md) · [Changelog-Generator](changelog.md)
