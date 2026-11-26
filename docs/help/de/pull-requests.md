---
title: Pull-Request-Seite
category: Sync & viele Repos
order: 57
summary: Alle Pull Requests eines Repositorys auf einer Seite — nach Status, gefiltert nach Autor, Reviewer, Ziel und CI —, ‹ ›, um die gefilterte Liste aus einem PR heraus durchzugehen, seine Commits und Kommentare zu einer Zeile seines Diffs.
keywords: pull requests liste seite merge requests pr mr filter autor reviewer meine wartet auf mein review review angefragt ci schlägt fehl ziel-branch entwürfe gemergt geschlossen suche triage vorheriger nächster alt pfeil navigation checkout auschecken zum quell-branch ziel-branch branch-name kopieren fetch zeilenkommentar inline-kommentar review-kommentar diff-kommentar zeile kommentieren dateien-tab code review line comment commits-tab commit-liste pr-commits commit-verlauf commit öffnen sha kopieren pr-branch fetchen markdown-editor werkzeugleiste vorschau erwähnung commits tab commit list open commit copy sha markdown editor toolbar preview mention
source: c269e43eb3dc0b9f86141af27ef39b50e5550953
---

# Pull-Request-Seite

Ein belebtes Repository hat zwanzig Pull Requests gleichzeitig offen. Die
Seitenleiste listet sie, aber eine Zeile pro PR sagt wenig: wem gehört welcher,
welche warten auf dich, welche sind rot geworden. Um das herauszufinden, musstest
du jeden öffnen, lesen, zurückgehen, den nächsten öffnen. Die
**Pull-Request-Seite** beantwortet diese Fragen auf einem Bildschirm, und sobald
du einen Pull Request öffnest, bringen dich **‹ ›** zum nächsten derselben Liste,
ohne zurückzugehen.

![Die Pull-Request-Seite mit der Suche nach „pix“: Treffer hervorgehoben, eigene mit „du“ markiert, eine fehlschlagende CI und ein Entwurf](../../screenshots/pull-requests.webp)

## Öffnen

- Das **Listensymbol** im Kopf **PULL REQUESTS** der Seitenleiste (*Alle Pull
  Requests anzeigen*).
- *Pull Requests…* in der Befehlspalette (⌘K) oder **Werkzeuge → Pull Requests…**.

Wie das Wiki und die [CI-Läufe](ci-runs.md) hängt die Seite am Tab des
Repositorys.

## Tabs

| Tab | Was er enthält |
|---|---|
| **Offen** | Alle offenen Pull Requests, Entwürfe eingeschlossen |
| **Entwürfe** | Nur die offenen, die als Entwurf markiert sind |
| **Gemergt** | Gemergte Pull Requests, gelesen, wenn du den Tab zum ersten Mal öffnest |
| **Geschlossen** | Ohne Merge geschlossen (abgelehnt, aufgegeben), gelesen zusammen mit Gemergt |

Die Zahlen neben Offen und Entwürfe stammen aus der Liste, die die Seitenleiste
schon hat. Gemergt und Geschlossen werden erst abgefragt, wenn du einen davon
öffnest, und einmal pro Sitzung; **Aktualisieren** fragt erneut.

## Filter

| Filter | Behält |
|---|---|
| **Suchen** | Pull Requests, deren Titel, Beschreibung, Branches oder Nummer jedes eingegebene Wort enthalten. `#482` oder `482` findet diese Nummer; Treffer werden im Titel hervorgehoben |
| **Autor** | Einen Autor — jeder mit der Anzahl seiner PRs in diesem Tab. **Ich** steht oben |
| **Reviewer** | Einen angefragten Reviewer oder **Review von mir angefragt** |
| **Ziel-Branch** | Pull Requests in diesen Branch |
| **Meine** | Eine Abkürzung für *Autor: Ich* |
| **Wartet auf mein Review** | Eine Abkürzung für *Reviewer: Review von mir angefragt* |
| **CI schlägt fehl** | Pull Requests, deren Checks am Head fehlgeschlagen sind |

Die Zeile unter den Filtern sagt, wie viele Pull Requests des Tabs angezeigt
werden und welche Filter aktiv sind, mit **Filter zurücksetzen**, um alle zu
entfernen.

Filter bleiben pro Repository erhalten, **solange die App läuft** — verlasse die
Seite, komm zurück, sie sind, wie du sie verlassen hast. Über einen Neustart
hinweg werden sie absichtlich nicht gespeichert: ein Filter „Meine, CI schlägt
fehl“, der eine Woche später still wiederkommt, würde Pull Requests verstecken,
die du nicht verstecken wolltest.

### Wer „ich“ bin

„Ich“ ist das Konto, mit dem sich die Aufrufe dieses Repositorys beim Host
anmelden — das Profil, an das das Repository [gebunden](profiles.md) ist, sonst
das aktive — und zwar beim Host selbst erfragt. Wenn das Token nicht sagen kann,
wem es gehört (kein User-Scope), oder es kein Token gibt, werden **Ich**,
**Meine** und **Wartet auf mein Review** nicht angeboten.

## Die Liste

| Spalte | Was sie zeigt |
|---|---|
| **#** | Die Nummer, mit einem Symbol für offen, Entwurf, gemergt oder geschlossen |
| **Titel** | Der Titel, ein *Entwurf*-Badge und wer noch um ein Review gebeten ist — in der Akzentfarbe, wenn du es bist |
| **Autor** | Das Bild vom Host, wo er eins liefert, sonst die Initiale, und **du** bei deinen eigenen |
| **Branches** | Quelle → Ziel |
| **Checks** | Die Checks des Heads zusammengefasst — `6/6`, `1 fehlgeschlagen`, `2 laufen`; Hover zeigt die Zahlen |
| **Aktualisiert** | Wie lange die letzte Änderung her ist; Hover zeigt das Datum |

Die Zeilen sind nach der letzten Aktivität sortiert. Ein Klick öffnet die eigene
Seite des Pull Requests ([Hosting & Pull Requests](hosting.md)). Auf einem Host
ohne diese Seite öffnet die Zeile den Pull Request im Browser.

In einem [Fork-Checkout](hosting.md#deine-pull-requests-im-ursprungs-repository-eines-forks) werden auch deine Pull Requests im
Ursprungs-Repository gelistet, markiert mit *auf owner/repo*.

## Die Liste aus einem Pull Request heraus durchgehen

![Ein aus der gefilterten Liste geöffneter Pull Request: ‹ 1 von 4 › und die Filter, aus denen er kam](../../screenshots/pull-request-nav.webp)

Ein von der Seite aus geöffneter Pull Request zeigt eine Leiste über seinem
Titel:

- **← Pull Requests** führt zurück zur Liste, mit den Filtern, wie du sie
  verlassen hast.
- **‹ k von n ›** wechselt zum vorherigen oder nächsten Pull Request der Liste,
  aus der du ihn geöffnet hast — der gefilterten Liste, in ihrer Reihenfolge, so
  wie sie beim Klick war. Die Tooltips nennen den Pull Request, zu dem jeder Pfeil
  führt.
- **Alt+← / Alt+→** tun dasselbe über die Tastatur. Sie lassen sich in
  **Einstellungen → Tastenkürzel** neu belegen. Sie halten sich zurück, solange
  der Cursor in einem Textfeld steht (wo Option+← wortweise springt) und solange
  das Terminal den Fokus hat.

Das Wechseln ersetzt die Seite an Ort und Stelle, sodass zehn durchgegangene Pull
Requests nicht zehn Symbole im Tab hinterlassen; eine andere Zeile aus der Liste
zu öffnen ersetzt sie ebenfalls.

Ein Pull Request, der **von woanders** geöffnet wurde — aus der Seitenleiste,
einer Benachrichtigung — geht die offenen Pull Requests des Repositorys in der
Standardreihenfolge der Seite durch (Offen, keine Filter). Einer, der auch auf
dieser Liste nicht steht, etwa eine gemergte Ebene eines Stacks, zeigt nur den
Weg zurück zur Liste.

## Zum Branch eines Pull Requests wechseln

Um an einem Pull Request zu arbeiten, brauchst du seinen Branch ausgecheckt —
und in einem Repository mit Tausenden von Branches ist es der langsame Teil, ihn
in der Branch-Liste nach Namen zu suchen. Auf der Seite eines Pull Requests
erledigt das Feld **Branches** das für dich:

- **Der Branch-Name ist ein Link.** Ein Klick checkt diesen Branch aus und bringt
  dich zum Graphen des Repositorys, an die Spitze des Branches. Die Seite des Pull
  Requests bleibt im Tab offen.
- **Ein Branch, den es nur auf dem Server gibt**, wird zuerst gefetcht — genau
  dieser Branch, nicht das ganze Remote — und als lokaler Branch ausgecheckt, der
  ihn trackt. Ein Branch, den du schon lokal hast, wird so gewechselt, wie er ist —
  er wird nicht aktualisiert, also pulle, wenn du die neuesten Commits des Pull
  Requests willst.
- **Der Branch, auf dem du schon bist**, ist stattdessen als *aktuell* markiert.
  Es wird nichts ausgecheckt.
- **Der Kopieren-Button** neben jedem Namen legt ihn in die Zwischenablage.
- **Rückgängig** (⌘Z) bringt dich zurück auf den Branch, auf dem du warst, und
  löscht den lokalen Branch, den der Checkout angelegt hat — es sei denn, du hast
  seitdem darauf committet; dann bleibt er unangetastet.

Der Kopf hat dieselben zwei Schritte als Buttons: **Zum Quell-Branch wechseln**
und **Zum Ziel-Branch wechseln**. Sie funktionieren auch auf dem Branch, auf dem
du schon bist — sie bringen dich dann einfach zum Repository.

Nichts wird nachgeschlagen, bevor du klickst: einen Pull Request zu öffnen liest
oder fetcht keinen Branch.

Was es nicht tut:

- **Der Quell-Branch eines Forks** liegt in einem anderen Repository, also hat er
  keinen Link (der Kopieren-Button bleibt). **Pull Request lokal ansehen…**, direkt
  darunter angeboten, ist der Weg, ihn hier laufen zu lassen. Der Ziel-Branch ist
  weiterhin verlinkt.
- **Kein passendes Remote.** Der Branch wird auf dem Remote gesucht, dessen URL
  das Repository des Pull Requests ist. Wenn kein konfiguriertes Remote dorthin
  zeigt, tut der Link nichts, und sein Tooltip sagt, warum.
- **Ein gelöschter Branch.** Ein gemergter Pull Request hat seinen Branch oft
  mitgenommen; der Fetch meldet dann, dass der Branch auf dem Remote nicht mehr
  existiert, und du bleibst beim Pull Request.
- **Lokale Änderungen.** Auschecken ist nicht destruktiv, also gibt es keine
  Bestätigung — und git verweigert den Checkout, wenn deine nicht committeten
  Änderungen überschrieben würden. Der Fehler nennt die Dateien; committe oder
  stashe sie und klicke erneut.
- **Dieses Fenster.** Der Checkout passiert im Arbeitsverzeichnis dieses
  Repositorys. Wenn der Branch schon in einem anderen [Worktree](worktrees.md)
  ausgecheckt ist, öffnet sich stattdessen der Tab dieses Worktrees.

## Commits

Die Seitenleiste sagte, wie viele Commits ein Pull Request hat, nie welche. Einen
Commit nach dem anderen zu reviewen — so, wie die meisten Pull Requests gelesen
werden sollen — schickte dich in den Browser. Der Tab **Commits**, zwischen
Unterhaltung und Dateien, listet sie:

- **Älteste zuerst**, in der Reihenfolge, in der sie angewendet werden, gruppiert
  nach dem Tag, an dem sie geschrieben wurden. Ein Commit, der außer der
  Datumsreihenfolge hineingerebased wurde, beginnt einen eigenen Tag, statt
  verschoben zu werden.
- Jede Zeile hat das Bild des Autors (wo der Host eins liefert), den Betreff, den
  Autor, wie lange es her ist, und den kurzen SHA. Ein **Merge**-Badge markiert
  einen Commit mit zwei Eltern, wo der Host das sagt.
- **▸** neben einem Commit mit mehr als einem Betreff zeigt den Rest seiner
  Nachricht.
- **Kopieren** legt den vollständigen SHA in die Zwischenablage; **Im Browser
  öffnen** öffnet den Commit auf dem Host — innerhalb des Pull Requests, wo der
  Host eine solche Seite hat (GitHub, GitLab, Bitbucket Data Center), sonst auf der
  Commit-Seite des Repositorys.

![Der Tab Commits: die Commits eines Pull Requests nach Tag gruppiert, einer mit geöffneter vollständiger Nachricht](../../screenshots/pr-commits.webp)

**Klick auf eine Zeile** — oder springe mit Tab hin und drück Enter —, um den
Commit in der App zu öffnen, wie ein Klick im Graphen: die Ansicht des
Repositorys, dieser Commit ausgewählt, seine Details offen. Das klappt, wenn dieser
Klon den Commit **hat**. Hat er ihn nicht, sagt die Zeile das, statt still zu
scheitern, und bietet an:

- **PR-Branch abrufen, um ihn zu sehen** — derselbe Fetch eines einzelnen Branches
  wie beim [Wechsel zum Branch](#zum-branch-eines-pull-requests-wechseln), ohne den Checkout. Kam der Commit
  mit, öffnet er sich; kam er nicht (ein Force-Push hat ihn seitdem umgeschrieben),
  sagt der Toast das.
- **Im Browser öffnen**, für den Fall, dass Fetchen keine Option ist.

Die Liste wird gelesen, wenn du den Tab zum ersten Mal öffnest, nicht mit der
Seite, und erneut bei jedem **Aktualisieren**. Bis sie da ist, ist die Zahl im Tab
die, die der Host für den Pull Request angegeben hat. Gemergte und geschlossene
Pull Requests listen ihre Commits genauso.

Was es nicht tut:

- **Höchstens 250 Commits.** GitHub selbst listet für einen Pull Request nicht mehr
  als 250; die App hört auf jedem Host bei derselben Zahl auf und sagt *der Host
  hat mehr*, wenn das so ist, mit einem Link zum Pull Request auf dem Host. Welche
  250 es sind, hängt von der Reihenfolge ab, in der der Host sie listet — die App
  behält die zuerst gelisteten, und die Zeile über der Liste sagt, welche:

  | Host | Ein längerer Pull Request zeigt |
  |---|---|
  | GitHub | Die **ersten** 250 (GitHubs eigene Grenze) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | Die **250 neuesten** |
  | Forgejo | Das Ende, das der Server zuerst listet; seine Reihenfolge ist nicht dokumentiert |
- **Der Branch eines Forks** lässt sich von hier nicht fetchen — er liegt in einem
  anderen Repository —, also bietet ein Commit, der nur im Fork ist, allein den
  Browser an. **Pull Request lokal ansehen…** ist der Weg, ihn hereinzuholen.
- **Ein gelöschter Branch.** Ein gemergter Pull Request hat seinen Branch oft
  mitgenommen: der Fetch sagt das. bitbucket.org listet gar keine Commits mehr,
  sobald der Quell-Branch weg ist.
- **Squash-Merges.** Die Commits eines per Squash gemergten Pull Requests haben den
  Ziel-Branch nie erreicht, also gibt es sie nach dem Löschen seines Branches nur
  noch auf dem Host.
- **Autoren** werden so genannt, wie ihre Commits sie nennen. GitLab, Azure DevOps
  und Bitbucket Data Center liefern kein Bild ohne eine Anmeldung, die ein Bild
  nicht mitschicken kann, also zeigen diese Zeilen die Initiale.
- **Lange Nachrichten auf Azure DevOps** können gekürzt sein: Azures Liste schneidet
  die Nachricht eines Commits ab, und die App zeigt, was es sendet.
- **bitbucket.org**-Pull-Requests öffnen sich im Browser — die App hat noch keine
  Seite für sie —, also wird dieser Tab dort nicht erreicht, obwohl die App die
  Liste lesen kann.

## Eine Zeile kommentieren

Auf einen Review-Thread antworten ging hier schon; einen beginnen nicht, also
schickte dich ein echtes Review weiterhin in den Browser. Im Tab **Dateien** eines
Pull Requests nimmt jede Zeile des Diffs einen eigenen Kommentar an:

- **Fahre über eine Zeile** und drück das **+**, das über ihrer Nummer erscheint,
  oder **klick auf die Zeile** selbst (ein Klick, der eine Textauswahl beendet, oder
  ein Doppelklick, der ein Wort markiert, zählt nicht — das ist Lesen). Das
  Kontextmenü — oder die Kontextmenütaste der Tastatur — hat ebenfalls *Zeile N
  kommentieren*.
- Ein Feld öffnet sich **unter dieser Zeile**. Schreib, dann **Kommentieren** —
  oder ⌘/Ctrl+Enter. **Abbrechen** schließt es; **Esc** auch, mit Rückfrage, wenn
  schon etwas getippt wurde. So oder so kehrt der Fokus zu dieser Zeile zurück.
- Bei Erfolg erscheint der neue Thread **unter seiner Zeile** und in den
  Review-Threads des Tabs Unterhaltung, wo alle anderen ihn sehen.

![Ein Kommentar wird unter einer geänderten Zeile geschrieben, mit einem früheren Thread unter seiner eigenen Zeile](../../screenshots/pr-line-comment.webp)

Auf welcher Seite der Kommentar landet, folgt der Zeile:

| Zeile | Verankert an |
|---|---|
| **Hinzugefügt** (grün) | Der neuen Fassung der Datei, unter ihrer neuen Nummer |
| **Gelöscht** (rot) | Der alten Fassung, unter ihrer alten Nummer |
| **Unverändert** | Der neuen Fassung (GitLab bekommt beide Nummern, wie es verlangt) |

Bestehende Threads werden ebenfalls unter ihren Zeilen gezeigt, mit ihrem
Antwortfeld, wo der Host der App erlaubt, in einem Thread zu antworten (Forgejo
nicht). Ein Thread erscheint nur dann an einer Zeile, wenn der Host sagt, dass er
noch zum gezeigten Diff gehört; alles andere bleibt im Tab Unterhaltung, statt an
einer geratenen Zeile zu landen:

| Host | Ein Thread von vor dem letzten Push |
|---|---|
| GitHub | Veraltet, wenn seine Zeile sich geändert hat: nur Unterhaltung |
| GitLab | Gegen einen älteren Head geschrieben: nur Unterhaltung |
| Azure DevOps | Von Azure dorthin verfolgt, wo seine Zeile jetzt ist |
| Bitbucket Data Center | Verwaist, wenn seine Zeile weg ist: nur Unterhaltung |
| Forgejo | Forgejo sagt nicht, dass ein Kommentar veraltet ist, also erscheint er an seiner gespeicherten Zeilennummer — nach einem Push kann dort jetzt anderer Code stehen |

Ein Kommentar zu einer Zeile außerhalb der gezeigten Hunks steht auf jedem Host nur
im Tab Unterhaltung.

Ein getippter, nicht gesendeter Kommentar zählt als ungesendeter Text: **‹ ›** und
Alt+Pfeile fragen nach, bevor sie ihn verlassen, wie beim Hauptkommentarfeld. Der
Blick in eine andere Datei behält ihn; um einen an einer anderen Zeile zu beginnen,
sende oder verwirf zuerst den ersten.

Was es nicht tut:

- **Eine Zeile, sofort gesendet.** Es gibt keinen Zeilenbereich, kein ausstehendes
  Review, in dem man Kommentare sammelt und später abschickt, und keine
  Änderungsvorschläge. Jeder Kommentar wird in dem Moment veröffentlicht, in dem du
  ihn sendest, als eigener Thread (auf Forgejo als Review mit genau diesem einen
  Kommentar, da Forgejo keinen Aufruf für einen Einzelkommentar hat).
- **Der Diff, den du ansiehst.** Der Tab Dateien merkt sich, an welchem Commit (auf
  Azure DevOps: an welcher Iteration) sein Diff gelesen wurde, und der Kommentar
  wird dagegen gesendet. Hat sich der Pull Request seitdem weiterbewegt — ein Push,
  eine neue Merge-Basis —, wird der Kommentar nicht an die Zeile gehängt, die jetzt
  diese Nummer hat: er wird abgelehnt mit *Der Pull Request hat sich seit dem Laden
  dieses Diffs geändert*, und **Aktualisieren** zeigt den neuen Diff. Auf GitHub
  wird der Kommentar stattdessen gegen den Commit gesendet, den du gelesen hast, und
  GitHub markiert ihn als veraltet, wenn sich die Zeile geändert hat. Eine Zeile,
  die der Host trotzdem nicht annimmt, wird als außerhalb des Diffs abgelehnt.
- **Abgelehnt.** Ohne Berechtigung zum Kommentieren (ein Token nur zum Lesen, ein
  Konto, das in dem Repository nicht kommentieren darf) lehnt der Host ab, und die
  Meldung nennt das als Grund.
- **bitbucket.org**-Pull-Requests öffnen sich im Browser — die App hat noch keine
  Seite für sie —, also wird ein Zeilenkommentar dort weiterhin auf der Website
  geschrieben.
- **Eine Datei ohne Diff** (binär oder zu groß, als dass der Host sie mitliefert)
  hat keine Zeilen zum Kommentieren.

## Kommentare schreiben

Jedes Feld auf der Seite — der Kommentar unten, eine Antwort in einem Thread, ein
Kommentar zu einer Zeile — ist derselbe Markdown-Editor: Tabs **Schreiben /
Vorschau**, eine Formatierungsleiste mit GitHubs Tastenkürzeln, Listen, die bei
Enter weitergehen, und Vervollständigung mit **@** / **#** aus den Personen und
Pull Requests, die schon auf dem Bildschirm sind. Ein Antwortfeld zeigt seine
Werkzeuge, sobald du hineinklickst, und sendet mit ⌘/Ctrl+Enter, da Enter jetzt
eine neue Zeile beginnt. [Kommentare schreiben](writing-comments.md) hat die
Details und die Grenzen.

## Grenzen

- **Offene Pull Requests sind die Liste der Seitenleiste.** GitHub, GitLab und
  bitbucket.org lesen die ersten 30; ein Repository mit mehr zeigt nur diese, und
  die Zahl bei Offen lautet **30+**. Azure DevOps, Bitbucket Data Center und
  Forgejo lesen alle.
- **Gemergt und Geschlossen sind begrenzt**, und der Tab zeigt **+**, wenn der
  Host mehr hat (seine Website listet alle):

  | Host | Was gelesen wird |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | Die 100 zuletzt aktualisierten, gemergt und geschlossen **zusammen** |
  | GitLab | Die 100 zuletzt aktualisierten von jedem |
  | Bitbucket Data Center | 100 von jedem in der Reihenfolge *newest* des Servers — seine API sagt nicht, ob das eröffnet oder aktualisiert meint |
  | Azure DevOps | 100 von jedem unter denen, die im **letzten Jahr** endeten; seine API nennt keine Reihenfolge, also entscheidet jenseits von hundert der Server, welche |

  Ihre Checks werden nicht gelesen — die CI eines abgeschlossenen Pull Requests
  entscheidet nichts, und sie kostete eine Anfrage pro Zeile — also gilt **CI
  schlägt fehl** auf diesen Tabs nicht (der Chip ist dort ausgeblendet).
- **Kein Konto**: ohne ein Token, das den Host erreicht, sagen Gemergt und
  Geschlossen das, statt eine leere Liste zu zeigen (GitHub kann ein öffentliches
  Repository trotzdem lesen).
- **Checks**: GitHub und Bitbucket Data Center liefern sie in der Liste mit.
  GitLab, Azure DevOps und Forgejo werden beim Öffnen der Seite einmal pro Head
  gefragt, über denselben Cache wie die CI-Badges im Graphen. bitbucket.org hat
  keine.
- **Reviewer**: GitHub, GitLab, Forgejo, Bitbucket Data Center und Azure DevOps
  nennen, wer noch gefragt ist (Azure: eine Person, die noch nicht abgestimmt hat;
  ein Team bleibt außen vor). Die Liste von bitbucket.org sagt es nicht, also ist
  der Reviewer-Filter dort leer.
- **Suche in der Beschreibung** funktioniert, wo die Liste des Hosts die
  Beschreibung mitliefert; bitbucket.org lässt sie manchmal weg, und dann werden
  nur Titel, Branches und Nummern durchsucht.
- **„Ich“ auf bitbucket.org und Azure DevOps** wird über den Anzeigenamen
  abgeglichen, da ihre Listen einen Autor so benennen.
- **Aktualisiert auf Azure DevOps** ist der Zeitpunkt, zu dem der Pull Request
  eröffnet (oder geschlossen) wurde: seine Liste hat keine Zeit der letzten
  Aktivität.
- Das Durchgehen wird gemerkt, solange die App läuft; nach einem Neustart geht ein
  aus der Liste geöffneter Pull Request stattdessen die offenen Pull Requests
  durch.
