---
title: Pull-Request-Seite
category: Sync & viele Repos
order: 57
summary: Alle Pull Requests eines Repositorys auf einer Seite — nach Status, gefiltert nach Autor, Reviewer, Ziel und CI — und ‹ ›, um die gefilterte Liste aus einem PR heraus durchzugehen.
keywords: pull requests liste seite merge requests pr mr filter autor reviewer meine wartet auf mein review review angefragt ci schlägt fehl ziel-branch entwürfe gemergt geschlossen suche triage vorheriger nächster alt pfeil navigation checkout auschecken zum quell-branch ziel-branch branch-name kopieren fetch
source: ced0be4a5d7da5b8c32b15d7fcc8846b79ee9506
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
