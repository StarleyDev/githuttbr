---
title: Kommentare schreiben
category: Sync & viele Repos
order: 57.5
summary: Der Markdown-Editor hinter jedem Kommentarfeld — Schreiben / Vorschau, eine Formatierungsleiste mit GitHubs Tastenkürzeln, Listen, die bei Enter weitergehen, und Vervollständigung für @Erwähnungen / #Verweise.
keywords: markdown-editor kommentarfeld werkzeugleiste fett kursiv code link zitat überschrift aufzählung nummerierte liste aufgabenliste checkliste vorschau schreiben tastenkürzel erwähnung at-zeichen verweis raute issue-nummer autovervollständigung antwort pull-request-beschreibung issue-text markdown editor comment box toolbar mention reference autocomplete reply
source: cc7673de22ce745f04a0341c4d263219c432b693
---

# Kommentare schreiben

Ein an GitHub gesendeter Kommentar ist Markdown, und ein nacktes Textfeld lässt
dich jedes `**` und `- [ ]` von Hand tippen und dann im Browser herausfinden, ob
die Tabelle richtig dargestellt wurde. Jedes Feld der App, das auf einen Host
schreibt, ist jetzt derselbe Editor, mit den Werkzeugen, die GitHubs eigenes
Kommentarfeld hat:

- das Kommentarfeld eines Pull Requests, seine Thread-Antworten und seine
  Zeilenkommentare ([Pull-Request-Seite](pull-requests.md));
- das Kommentarfeld eines Issues;
- die Beschreibung eines neuen Pull Requests und der Text eines neuen Issues
  ([Hosting & Pull Requests](hosting.md)).

![Das Kommentarfeld eines Pull Requests, mit der Formatierungsleiste und der Liste der Personen zum Erwähnen, geöffnet bei „@al“](../../screenshots/comment-editor.webp)

## Schreiben und Vorschau

**Vorschau** zeigt den Text so, wie er dargestellt wird, gezeichnet vom selben
Markdown-Renderer wie der Rest der App. Sie ist schreibgeschützt; **Schreiben**
bringt das Feld zurück, mit dem Text und dem Cursor dort, wo du sie gelassen hast,
also macht ⌘/Ctrl+Z weiterhin rückgängig, was du vor dem Hinsehen getippt hast.

Die Tabs sind eine Tab-Liste: ist einer fokussiert, wechseln ← und → zwischen
ihnen.

## Die Werkzeugleiste

| Werkzeug | Kürzel | Was es tut |
|---|---|---|
| **Überschrift** | — | Ein Menü mit H1, H2 und H3 für die markierten Zeilen; die Ebene zu wählen, die eine Zeile schon hat, entfernt sie |
| **Fett** | ⌘/Ctrl+B | `**Text**` |
| **Kursiv** | ⌘/Ctrl+I | `_Text_` |
| **Code** | ⌘/Ctrl+E | `` `Code` `` innerhalb einer Zeile; ein umzäunter ```` ``` ````-Block, wenn die Auswahl mehrere Zeilen umfasst |
| **Link** | ⌘/Ctrl+K | `[Text](url)` — eine markierte URL wird zur Adresse, anderer Text zur Beschriftung |
| **Zitat** | — | `> ` vor jeder markierten Zeile |
| **Aufzählung** | ⌘/Ctrl+Shift+8 | `- ` vor jeder markierten Zeile |
| **Nummerierte Liste** | ⌘/Ctrl+Shift+7 | `1. `, `2. `… vor jeder markierten Zeile |
| **Aufgabenliste** | — | `- [ ] ` vor jeder markierten Zeile |

Jedes Werkzeug ist ein Schalter: auf Text angewendet, der es schon hat, nimmt es
es wieder weg. Ohne Auswahl fügen Fett, Kursiv, Code und Link einen Platzhalter ein
und markieren ihn, bereit zum Überschreiben. Ein Listenwerkzeug ersetzt eine Liste
anderer Art, statt sich darauf zu stapeln.

Die Änderungen laufen über die eigene Bearbeitung des Textfelds, also **macht
⌘/Ctrl+Z ein Werkzeug rückgängig** genau wie ein getipptes Wort, und
Wiederherstellen bringt es zurück.

Die Leiste ist ein einziger Tab-Halt; ← → wechseln zwischen ihren Buttons, und ↓
öffnet das Überschriften-Menü. In einem Kommentarfeld erzeugt ⌘/Ctrl+K einen Link,
statt die Befehlspalette zu öffnen. Auf dem Mac nutzen die Kürzel nur ⌘, sodass
Ctrl+B, Ctrl+E und Ctrl+K weiterhin tun, was macOS-Textfelder damit tun. Bei einem
Tastaturlayout ohne lateinische Buchstaben folgen die Kürzel den physischen Tasten
B, I, E und K.

## Listen

**Enter** am Ende eines Listeneintrags beginnt den nächsten — derselbe
Aufzählungspunkt, die nächste Nummer, ein leeres `- [ ]` für eine Aufgabe — mit
derselben Einrückung. Enter auf einem Eintrag ohne etwas nach seiner Markierung
beendet die Liste und entfernt die Markierung. Shift+Enter ist ein einfacher
Zeilenumbruch.

## Erwähnungen und Verweise

**@** öffnet eine kurze Liste von Personen, die sich beim Tippen eingrenzt; **#**
listet Pull Requests und Issues nach Nummer und Titel (`#42`, oder `#suche` für ein
Wort des Titels). ↑ ↓ wählen, Enter oder Tab fügt ein, Esc schließt die Liste — nur
die Liste, nicht das Feld oder den Dialog darum.

Die Liste stammt aus dem, was die App schon hat, ohne den Host erneut zu fragen:

| Feld | @ bietet | # bietet |
|---|---|---|
| Pull Request | Seinen Autor, Reviewer, Verantwortliche und alle, die kommentiert haben | Die offenen Pull Requests und Issues des Repositorys, wie in der Seitenleiste geladen |
| Issue | Seinen Autor, Verantwortliche und Kommentierende | Dasselbe |
| Neuer Pull Request | Die Personen, die seine Reviewer- und Verantwortlichen-Auswahl liest, und die Autoren der geladenen Pull Requests | Dasselbe |
| Neues Issue | Die Autoren der geladenen Pull Requests und Issues | Dasselbe |

Ein **@** oder **#** innerhalb eines Wortes (eine E-Mail-Adresse), das `#` einer
Überschrift und alles innerhalb von Code bleiben unberührt.

## Senden

⌘/Ctrl+Enter sendet aus jedem Feld: einen Kommentar zu einem Pull Request oder
Issue, eine Thread-Antwort, einen Zeilenkommentar und die Beschreibung eines neuen
Issues. Es funktioniert auch aus den Tabs, der Werkzeugleiste und der Vorschau,
nicht nur aus dem Feld. Esc bricht einen Zeilenkommentar ab, von denselben Stellen
aus. Eine **Thread-Antwort** war früher ein einzeiliges Feld, das mit Enter gesendet
wurde; jetzt ist sie ein kleines Textfeld, also ist Enter eine neue Zeile (oder der
nächste Listeneintrag) und ⌘/Ctrl+Enter sendet. Ein Antwortfeld zeigt seine Tabs
und Werkzeuge, sobald du hineinklickst, damit eine lange Unterhaltung nicht unter
jedem Thread eine Werkzeugleiste wachsen lässt.

## Der Spickzettel

**Markdown wird unterstützt**, unter jedem Feld, öffnet an Ort und Stelle einen
Spickzettel: jedes Format, was man dafür tippt, und sein Kürzel. Esc oder ein Klick
anderswohin schließt ihn. Nichts von dem, was du schreibst, verschiebt sich.

Unten öffnet **Vollständige Anleitung öffnen** diese Seite. Das Handbuch ist ein
eigener Tab, also verlässt man dabei die Seite, auf der das Feld ist, und der nicht
gesendete Text ginge verloren: wenn es welchen gibt — in diesem Feld oder in einem
anderen auf der Pull-Request-Seite —, fragt die App zuerst. In den Dialogen für
einen neuen Pull Request und ein neues Issue hat der Zettel keinen solchen Link, da
sich das Handbuch hinter dem Dialog öffnen würde.

## Grenzen

- **Keine Anhänge.** Eine Datei ins Feld zu ziehen oder ein Bild einzufügen lädt
  nichts hoch: GitHub hat keine öffentliche API für Kommentaranhänge, also gibt es
  keinen Ort für die Datei. Lade sie auf der Website hoch und füge den Link ein.
- **Nur wer und was schon geladen ist.** @ durchsucht nicht die Nutzer des Hosts,
  und # nicht alle Issues — eine Person, die sich nicht an der Unterhaltung
  beteiligt hat, oder ein geschlossenes Issue, das die Seitenleiste nicht gelesen
  hat, wird nicht angeboten. Du kannst den Namen oder die Nummer trotzdem
  vollständig tippen.
- **Keine Änderungsvorschläge, gespeicherten Antworten oder Emoji-Auswahl.**
- **Die Vorschau ist der Renderer der App.** Sie zeigt Markdown so, wie die App es
  zeichnet; die Darstellung des Hosts kann in Details abweichen (GitHub-eigene
  Erweiterungen, Erwähnungen, die zu Links werden).
- **Die Vorschau ist die Darstellung der App, nicht die des Hosts.** Auf der
  Pull-Request- und der Issue-Seite zeichnet die Vorschau den Text so, wie der
  gesendete Kommentar in der App gezeigt wird
  ([wie Kommentare angezeigt werden](pull-requests.md#wie-kommentare-angezeigt-werden)): dasselbe strenge
  Profil, Zeilenumbrüche erhalten, und ein Bild von einer anderen Website wartet auf
  einen Klick. Auf GitHub wird der gesendete Kommentar danach von GitHub gezeichnet,
  sodass eine Erweiterung, die die App nicht kennt, anders aussehen kann. Die Dialoge
  für einen neuen Pull Request und ein neues Issue nutzen die gewöhnliche
  Markdown-Vorschau der App.
- Die Kürzel sind fest: sie stehen nicht in den Tastenkürzel-Einstellungen und
  folgen keiner Neubelegung dort.
