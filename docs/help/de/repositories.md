---
title: Repositories
category: Sync & viele Repos
order: 52
summary: Jedes Repository, das GitHuttBr kennt, offen oder nicht, in einer durchsuchbaren Liste.
keywords: repositories registry alle repos favoriten markiert zuletzt scan ordner durchsuchen finden öffnen verwalten repository-verwaltung farbe abschnitt tint hervorheben workspaces aus ordnern baum erzeugen massenimport favourites starred recent scan folder workspaces
source: 6a9c51bf47eebb0f97be71324460cd15c50b0855
---

# Repositories

Die [Missionskontrolle](mission-control.md) beantwortet "welches meiner offenen
Repositories braucht mich?". Sie kennt nur die Tabs des aktiven Workspace.
Repositories beantwortet eine andere Frage: **wo ist dieses Repo, und ist es
überhaupt irgendwo offen?** Sie umfasst alles, was GitHuttBr je gesehen hat.
Jeden Workspace, jeden Tab, sowie das, was es findet, wenn es Ordner scannt, auf
die du es zeigst.

![Die Seite Repositories: eingefärbte Abschnitte für offene, favorisierte,
zuletzt geöffnete und Workspace-Repositories, jede Zeile mit Name, Owner,
Branch und Arbeitszustand](../../screenshots/repositories.webp)

## Die Abschnitte

Ein Repository kann in **mehr als einem Abschnitt** stehen. Absichtlich: jeder
Abschnitt ist eine vollständige Antwort auf seine eigene Frage, kein Teilstück
einer einzigen Liste.

| Abschnitt | Was drin ist |
|---|---|
| Offene Repositories | Jeder Tab im aktiven Workspace gerade jetzt |
| Favoriten | Markierte Repositories, über jeden Workspace hinweg |
| Zuletzt geöffnete Repositories | Alles, was du geöffnet hast, das Neueste zuerst. **Ohne Obergrenze**, anders als die 8-Einträge-Liste im Launcher |
| Einer pro gespeichertem Workspace | Die Tabs dieses Workspace, damit du in einen anderen springen kannst, ohne zuerst dorthin zu wechseln |
| Alle Repositories | Jedes Repository, das die Registry kennt, offen oder nicht |

Die Leiste über der Liste ist ein Streifen: **Alle einklappen** und **Alle
ausklappen**, dann ein Suchfeld, das den Rest der Breite nimmt, dann der
Schalter für die WIP-Übersicht.

Suche filtert Zeilen über alle Abschnitte auf einmal und **blendet Abschnitte
aus, die nichts treffen**, damit die Treffer nicht unter einer Spalte leerer
Überschriften begraben liegen. Getroffen wird der Name des Repositorys, sein
Alias, sein Owner oder jeder Teil seines Pfads. Wenn nirgendwo etwas passt,
sagt die Seite das, statt leer zu werden.

Ist das Feld leer, wird jeder Abschnitt gezeigt, auch wenn er nichts hält:
"Favoriten 0" sagt dir, dass der Abschnitt existiert und leer ist, und das
solltest du wissen. Das ist erst dann Rauschen, wenn du suchst.

### Abschnittsfarben

Abschnitte kommen **schon eingefärbt**. Jede Überschrift bekommt ihren eigenen
Ton aus der Standardpalette, inklusive eines neuen Workspace in dem Moment, in
dem er erscheint. Es geht um Orientierung, nicht um Dekoration: mit einem
Workspace-Abschnitt pro Projekt und fünf eingebauten Abschnitten darüber sagt
eine gescrollte Liste irgendwann nicht mehr, wo du bist, und ein Ton macht eine
Überschrift erkennbar, bevor du sie gelesen hast.

Um eine zu ändern, nimm das **⋮** an ihrer Überschrift: **Farbe ändern…** öffnet
denselben [Farbwähler](workspaces.md) wie für Gruppentabs und Ordner, zehn
vorgegebene Farbfelder und ein freier Hex-Wert. **Farbe zurücksetzen**
erscheint, sobald du einen Abschnitt überschrieben hast, und setzt ihn auf
seine zugewiesene Vorgabe zurück.

Drei Dinge, die sich zu wissen lohnen:

- Die Zuweisung ist **stabil, nicht zufällig**. Dieselben Abschnitte bekommen
  bei jedem Start dieselben Farben, und ein neuer Workspace färbt die
  Abschnitte darüber nie um. Gespeichert werden nur die Farben, die du
  änderst.
- Die Farbe ist **seitenlokal**. Einen Workspace-Abschnitt hier einzufärben
  sagt nichts über diesen Workspace irgendwo sonst in GitHuttBr. Seine Tabfarbe
  ist eine eigene Einstellung.
- Die Farbe wird **heruntergemischt** auf einen kleinen Anteil der Fläche,
  statt in voller Stärke zu liegen, damit eine satte Wahl in hellen und
  dunklen Themes ein lesbarer Hintergrund bleibt. Eine sehr blasse Farbe wirkt
  deshalb fast neutral.

Bei mehr als zehn Abschnitten wiederholt sich die Palette, zwei Überschriften
können also denselben Ton teilen.

## Was ein Repository bekannt macht

Eine Zeile gibt es hier, sobald GitHuttBr es irgendwann **geöffnet** hat, oder
es unter einem **Scan-Ordner** gefunden hat. Nichts wird indexiert, nur weil
es irgendwo auf der Platte liegt, von dem du GitHuttBr nie erzählt hast.

Diese Seite zu öffnen indexiert außerdem, was du gerade **in einem Tab offen**
hast. So bekommen Repositories, die beim Start wiederhergestellt werden, eine
Zeile, ohne dass du sie neu öffnen musst. Es betrifft nur offene Tabs, und es
passiert beim ersten Besuch jeder Sitzung, nicht ein für alle Mal. Ein
Repository, das du **vergessen** hast, bleibt vergessen, bis du es wieder öffnest.

Scan-Ordner werden unter Einstellungen → Daten konfiguriert, oder im Dialog
**Gescannte Repositories** weiter unten:

- **Tiefe** ist, wie viele Verzeichnisebenen der Scan unter der Wurzel
  hinabsteigt (Standard 3, gedeckelt bei 10).
- Der Scan **hält an einem Repository an**. Ein mitgeliefertes Checkout oder
  ein Submodul in einem Repo wird nicht als eigene Zeile indexiert.
- Er betritt nie Punkt-Verzeichnisse und überspringt `node_modules` und
  ähnliche Dependency-Ordner.
- Er **folgt per Symlink verknüpften Ordnern** und durchläuft jeden echten
  Ordner nur einmal — ein Link zurück nach oben im Baum kann keine Schleife
  bilden, und zwei Links auf ein Repository führen es nur einmal auf. Ein über
  einen Link gefundenes Repository wird unter seinem **echten Pfad** geführt,
  ist also derselbe Eintrag (und derselbe Tab) wie beim Öffnen über die Auswahl.
- Er **liest nur Ordnernamen**: ein `.git`-Verzeichnis zu finden macht etwas
  hier zum Repository. Name, Owner und Branch kommen aus Dateien in `.git`
  (`HEAD`, die Config), nie indem `git` ausgeführt wird.
- Er läuft, **wenn du darum bittest**: beim Hinzufügen eines Ordners, mit
  **Jetzt scannen** oder beim Öffnen des Dialogs Gescannte Repositories. Ein
  Repository, das später in einen Scan-Ordner geklont wird, erscheint beim
  nächsten dieser Anlässe, oder sobald du es öffnest.
- Das Ergebnis nennt **jedes gefundene Repository und wie viele davon neu
  waren**. Ein zweiter Scan derselben Ordner meldet sie alle erneut, mit
  „0 neu“ — sie standen schon auf dieser Seite.
- Ein Ordner kann **nur einmal** hinzugefügt werden. Einen bereits gelisteten
  zu wählen sagt das und ändert nichts; ein abschließender Schrägstrich oder
  unter Windows eine andere Groß-/Kleinschreibung ist trotzdem derselbe Ordner.

## Gescannte Repositories

Diese Seite beantwortet „Wo ist dieses Repository?“ über alles, was GitHuttBr
kennt. Wenn du nur etwas aus deinen Projektordnern **öffnen** willst, hat das
Fenster **Repository öffnen** — und der Willkommensbildschirm — einen kürzeren
Weg: **Gescannte Repositories**.

![Der Dialog Gescannte Repositories: oben die eingeklappten gescannten Ordner, ein Filter,
 dann die Repositories des Ordners mit Kontrollkästchen und Branch, zwei angehakt und die Schaltfläche Öffnen, die sie zählt](../../screenshots/scanned-repos.webp)

- Die Repositories sind **nach gescanntem Ordner gruppiert**, nach Namen
  sortiert, mit einem Filter für Name oder Pfad.
- **Hake mehrere an** und drücke **Öffnen**, oder **doppelklicke** auf eines.
  Aus einer Gruppe heraus — ihrem Launcher oder der Seite, mit der sich eine
  neue Gruppe öffnet — heißt die Schaltfläche **Zur Gruppe hinzufügen**, und du
  kehrst dorthin zurück, woher du kamst.
- Aus **Repository öffnen** aufgerufen, hat der Dialog neben seinem Titel einen
  **Zurück**-Pfeil — wie auch **Klonen** und **Erstellen** —, sodass ein
  Fehlklick zu Repository öffnen zurückführt, ohne etwas zu schließen.
- Ein Repository, das schon in einem Tab offen ist — oder schon in dieser
  Gruppe —, wird aufgeführt, aber ausgegraut, damit die Zahl des Ordners
  weiterhin stimmt.
- Beim Öffnen **scannt der Dialog die Ordner zuerst erneut**, sodass ein
  frischer Klon da ist, ohne Umweg über die Einstellungen.
- **Gescannte Ordner** oben ist derselbe Editor wie in den Einstellungen:
  Ordner hinzufügen, einen entfernen, seine Tiefe ändern. Er ist anfangs
  aufgeklappt, wenn es noch keinen Ordner gibt, denn eine leere Liste wäre
  sonst eine Sackgasse.

Seine Grenzen: Ein Repository unter zwei sich überlappenden Ordnern erscheint
nur einmal, unter dem tieferen Ordner. Ein inzwischen verschwundener Ordner
wird ausgelassen — er lässt sich nicht öffnen. Einen gescannten Ordner zu
entfernen blendet seine Repositories hier aus, **vergisst** sie auf dieser
Seite aber nicht.

## Zeilen

Zeilen sind in Spalten gelegt: Stern, Name (alias-bewusst, wenn du ihn
umbenannt hast), Owner (aus der URL des origin-Remotes), Branch-Chip,
WIP-Übersicht und Aktionen. Die Spalten gelten **für die ganze Seite**, nicht
pro Abschnitt, damit ein Name im letzten Abschnitt unter einem Namen im ersten
steht und die Liste als Tabelle lesbar ist, nicht als Stapel.

Die Aktionen am Ende stehen in Ruhe da, sie werden nicht erst beim Hover
sichtbar: **in einem Tab öffnen**, und ein **⋮**, das dasselbe
[Repository-Kontextmenü](repo-menu.md) öffnet wie ein Rechtsklick. Das ist das
Menü, das überall sonst in GitHuttBr gilt, hier um zwei Einträge erweitert, die
nur diese Seite hat:

| Aktion | Was sie tut |
|---|---|
| Stern / Stern weg | Fügt das Repository zu Favoriten hinzu oder nimmt es heraus |
| Orten… | Zeigt einen verschobenen oder umbenannten Ordner neu. Alias, Profilbindung, Stern und alle Tabs, die ihn zeigen, bleiben erhalten. Hatte das Ziel schon eigene Einstellungen, **gewinnt das Ziel** |
| Vergessen | Entfernt den Eintrag aus dieser Liste. **Rührt den Ordner auf der Platte nie an** |

Ein Repository, dessen Ordner nicht mehr existiert, steht als **fehlt** da,
mit **Orten…** und **Vergessen** inline statt der üblichen Zeilenaktionen.

### Wenn der Ordner eines offenen Tabs fehlt

Tabs werden beim Start aus den Pfaden wiederhergestellt, die sie beim Beenden
hatten. Wurde ein Ordner seitdem verschoben, gelöscht oder liegt er auf einem
Laufwerk, das nicht angeschlossen ist, schlug früher jeder Lesezugriff von
GitHuttBr darauf mit einer eigenen Fehlermeldung fehl. Jetzt wird zuerst der
Ordner geprüft, und der Tab zeigt **Repository-Ordner nicht gefunden** mit dem
gespeicherten Pfad statt des üblichen Arbeitsbereichs:

![Ein wiederhergestellter Tab, dessen Ordner fehlt: die Karte
Repository-Ordner nicht gefunden mit dem gespeicherten Pfad und den Schaltflächen Orten… und Erneut versuchen](../../screenshots/missing-repository.webp)

| Schaltfläche | Was sie tut |
|---|---|
| Orten… | Wähle den neuen Ort des Ordners. Er muss ein Git-Repository sein; Tab, Alias, Profilbindung und Stern ziehen dorthin um |
| Erneut versuchen | Prüft denselben Pfad noch einmal — für ein Laufwerk oder eine Netzwerkfreigabe, die wieder da ist |

Der Tab **bleibt**, bis du ihn neu verbindest oder selbst schließt: Ein
fehlendes externes Laufwerk ist meist vorübergehend, und den Tab dafür zu
verlieren wäre schlimmer als ein stiller Platzhalter. Solange der Ordner fehlt,
überspringt ihn der automatische Hintergrund-Fetch.

Grenzen: GitHuttBr sucht nicht, wohin ein Ordner verschwunden ist — Orten… fragt
dich. Ein Ordner, der existiert, aber kein Repository mehr ist, zeigt
stattdessen die übliche Meldung **Kein Git-Repository**.

Der Stern ist ein Favoriten-Schalter, keine Mehrfachauswahl. Stapelarbeit läuft
hier pro Abschnitt, nicht pro Auswahl. Siehe unten.

## Einen Ordnerbaum in Workspaces verwandeln

Dein Code-Ordner kodiert die Gruppierung, die du willst, schon. Wenn `~/Code`
`client-a`, `client-b` und `personal` hält, sind das Kontexte, zwischen denen
du wechselst, und ein [Workspace](workspaces.md) ist genau das, mit eigenem
Tabstreifen.

**Scan-Ordner hinzufügen…** bietet an, sie zu bauen. Nachdem der Scan
indexiert hat, listet ein Dialog die Ordner **direkt in** dem, den du gewählt
hast, mit der Zahl der Repositories darin. Hake die an, die du willst. Jeder
wird ein Workspace mit **einem Tab pro Repository**.

| Zeile | Bedeutung |
|---|---|
| Ein Ordnername und eine Zahl | Standardmäßig angehakt. Wird ein Workspace |
| "{n} neu, wird in … übernommen" | Ein Workspace für diesen Ordner existiert schon. Nur die neuen Repositories kommen dazu |
| "Bereits in einem Workspace" | Nichts zu tun, ausgegraut statt versteckt |
| Der Name der Wurzel selbst | Repositories, die lose in dem Ordner liegen, den du gewählt hast, nicht in einem Unterordner. Standardmäßig nicht angehakt |

Ein Repository wird unter dem **ersten Ordner unter der Wurzel** einsortiert,
egal wie tief es sitzt: `~/Code/client-a/nested/app` landet in `client-a`.
Ordner ohne Repositories werden nicht angeboten.

**Es wird nichts angelegt, bis du bestätigst**, und Abbrechen lässt die
Indexierung des Scans stehen. Die Repositories sind so oder so bekannt, und
das hat dieser Knopf schon vorher getan.

### Später nochmal scannen

Gefahrlos wiederholbar. Ein zweiter Scan **fügt hinzu und entfernt nie**:

- Neue Repositories werden an den passenden Workspace angehängt.
- Repositories, die du von Hand verschoben, umbenannt oder entfernt hast,
  bleiben, wie du sie gelassen hast.
- Ein Workspace, den du **umbenannt** hast, wird trotzdem erkannt. GitHuttBr
  merkt sich den Ordner, aus dem er kam, und führt zusammen statt ein Duplikat
  anzulegen.
- Ein von der Platte gelöschtes Repository behält seinen Tab und steht als
  fehlend da.

Erzeugte Workspaces sind ganz normale. Benenne sie um, ordne sie neu, färbe
sie um oder lösche sie wie jeden anderen. Nichts an ihnen bleibt besonders.

## Alles schließen, was offen ist

Die Überschrift **Offene Repositories** trägt einen Schließen-Knopf.
**Repository schließen**, wenn eines offen ist, **Alle Tabs schließen**, wenn
mehrere offen sind. Er ist deaktiviert, wenn nichts offen ist.

Er schließt die Tabs, die Repositories halten, und **lässt Seiten-Tabs in
Ruhe**, damit die Repositories-Seite, auf der du stehst, sich nicht selbst
schließt. Nichts auf der Platte wird angefasst, und nichts wird committet,
gestasht oder verworfen. Ein Tab ist nur eine Ansicht.

Mehrere zu schließen fragt zuerst und sagt, wie viele. Eines allein zu
schließen nicht: das ist ein billiger Fehler, rückgängig mit dem üblichen
Shortcut zum Wiederöffnen des geschlossenen Tabs. Die geschlossenen Tabs
landen auf demselben Zehnerstapel, den ein einzelner Close benutzt, und öffnen
sich in der Reihenfolge, in der sie im Streifen saßen. Mehr als zehn auf
einmal lassen sich nicht alle zurückholen.

## Einen ganzen Abschnitt fetchen und pullen

Jede Abschnittsüberschrift trägt einen **fetch**-Knopf und einen
**pull**-Split-Knopf. Sie wirken auf jedes Repository in diesem Abschnitt und
überspringen jedes, dessen Ordner **fehlt**. Die Repositories müssen nicht
offen sein. Ein Abschnitt mit Repos, die du in dieser Sitzung nie geöffnet
hast, funktioniert genauso.

Beide laufen **nacheinander**, nicht parallel, damit ein Abschnitt mit
vierzig Repositories nicht vierzig Git-Prozesse auf einmal startet. Die
Statusleiste zeigt, an welchem Repository gerade gearbeitet wird und wie weit
der Lauf ist, und der ganze Stapel endet mit **einem** Toast, nicht einem pro
Repository. Wenn welche fehlschlagen, sagt der Toast, wie viele geklappt haben
und wie viele nicht. Der Lauf hält nicht beim ersten Fehler an.

Das Caret neben **pull** wählt, was Pullen bedeutet:

| Modus | Was er tut |
|---|---|
| Pull (Fast-Forward wenn möglich) | Gits Vorgabe. Fast-forward, wenn es geht, Merge, wenn nicht |
| Pull (nur Fast-Forward) | Lehnt ab, statt einen Merge-Commit zu erzeugen |
| Pull (rebase) | Spielt deine lokalen Commits auf dem Upstream neu auf |

Diese Wahl ist eine **einzige globale Vorgabe**, keine pro Abschnitt: sie
beschreibt, wie du pullst, und sie von einem Caret aus zu setzen ändert sie
überall. Jeder **Multi-Repository**-Pull hält sich daran. Die
Abschnittsknöpfe hier, fetch/pull auf einem [Gruppentab](workspaces.md) und
der Stapel-Pull der [Missionskontrolle](mission-control.md). Das Pullen eines
**einzelnen** Repositorys aus der Toolbar bleibt unberührt, weil dieses Menü
dich schon fragt, welche Art Pull du willst.

## Die Aktionsleiste

**Ordner öffnen…**, **Klonen…** und **Scan-Ordner hinzufügen…**. Drei Wege,
ein Repository in GitHuttBrs Registry zu bringen, von derselben Seite aus, auf
der du eines suchst, das schon da ist.

## WIP-Übersicht

Ein optionales Häkchen. An, und jede **ausgeklappte** Zeile führt ein echtes
`git status` aus und zeigt uncommittete Arbeit und Sync-Zustand. Aus, und
Zeilen kosten nichts außer das Lesen von Dateien in `.git`.

Es ist absichtlich optional: eine Übersicht kostet grob fünf Git-Prozesse pro
Repository, gebündelt zu acht, damit eine große Registry die Oberfläche nicht
blockiert. Einschalten heißt bewusst "schau alles an, was ich gerade sehe",
kein Dauerpreis.

## Grenzen

- **Nichts auf dieser Seite aktualisiert sich per Timer.** Öffne die Seite
  erneut, oder schalte die WIP-Übersicht aus und wieder an, um den aktuellen
  Stand zu sehen.
- **Die WIP-Übersicht gilt nur für ausgeklappte Abschnitte.** Ein
  eingeklappter Abschnitt zeigt gar keinen Status, Häkchen hin oder her.
- **Ein Repository ist erst bekannt, wenn du es geöffnet oder einen Ordner
  gescannt hast, der es enthält.** Von hier aus lässt sich das Dateisystem
  nicht durchsuchen.
- **Workspaces zu bauen lässt sich nicht in einem Schritt rückgängig machen.**
  Den Dialog abzubrechen erzeugt nichts, aber einen Plan, den du bestätigt
  und dann bereust, holst du zurück, indem du die Workspaces von Hand löschst.
- **Nur eine Ebene tief.** Ordner unter der ersten Ebene werden in den
  Tabstreifen des Workspace flachgeklappt. `client-a/nested/app` wird ein Tab
  in `client-a`, kein Ordner darin.
- **"Jetzt scannen" in den Einstellungen bietet das nicht.** Es scannt jede
  konfigurierte Wurzel auf einmal, wo ein Dialog pro Ordner keinen Sinn hat,
  und indexiert nur.
- **Alle schließen öffnet Tabs einzeln wieder, bis zu zehn.** Mehr als zehn
  Repositories auf einmal zu schließen heißt, die ältesten lassen sich vom
  Stapel nicht wieder öffnen. Sie stehen aber alle noch unter **Zuletzt
  geöffnete Repositories**.
- **Pull filtert nicht danach, was hinterherhinkt.** Es pullt jedes
  Repository im Abschnitt, weil zu wissen, welche hinterherhinken, zuerst
  einen Fetch bedeuten würde. Ein aktuelles Repository zu pullen ist ein
  No-op, das kostet Zeit, nicht Sicherheit.
- **Ein Abschnitts-Fetch oder -Pull lässt sich nicht vom Undo-Stapel holen.**
  Fetch ändert nichts, das du schon hattest. Ein Pull, der merget oder
  rebased, wird pro Repository aus dessen eigener Historie rückgängig
  gemacht, nicht von hier.
- **Abschnittsfarben sind kosmetisch.** Sie filtern, sortieren, gruppieren
  oder synchronisieren nirgendwo, und eine Farbe auf dem Abschnitt eines
  Workspace ist nicht die Farbe dieses Workspace.
- **Vergessen entfernt den Eintrag aus der Liste, nie von der Platte.** Und
  es hält an: Spätere Scans seines Ordners überspringen ihn, auch der, den der
  Dialog Gescannte Repositories beim Öffnen ausführt. Erst das erneute Öffnen
  des Repositorys bringt ihn zurück.

**Siehe auch:** [Missionskontrolle](mission-control.md) · [Workspaces, Tabs & Gruppen](workspaces.md)
