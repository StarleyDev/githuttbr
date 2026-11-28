---
title: Konflikte lösen
category: Mit Änderungen arbeiten
order: 32
summary: Ein Bildschirm für den ganzen Schritt mit Konflikten — jede Datei, der gemeinsame Vorfahr, eine Antwort pro Konflikt und der Abschluss.
keywords: konflikt konflikte lösen resolver merge conflicts ours theirs base basis gemeinsamer vorfahr marker three-way gelöscht umbenannt modify delete rename rerere reuse recorded resolution merken wiederholen abschließen fortsetzen abbrechen
---

# Konflikte lösen

Wenn ein Merge, Rebase, Cherry-Pick oder Revert stehen bleibt, macht der
Resolver aus dem ganzen Schritt einen einzigen Bildschirm. Die Leiste oben sagt,
**was** stehen geblieben ist und **zwischen was** — „`feature` wird in `main`
gemergt“, nicht nur „Konflikt“ — und wie weit du bist: *2 von 5 Dateien* gelöst,
dazu die Konflikte, die über alle Dateien hinweg noch übrig sind.

![Der Konflikt-Resolver](../../screenshots/conflict-resolver.webp)

## Die Dateileiste

Unter der Leiste steht ein Chip für jede Datei, bei der dieser Schritt stehen
geblieben ist:

| Chip | Bedeutet |
|---|---|
| Grün mit ✓ | Gelöst — gestaged, nichts mehr zu entscheiden |
| Umrandet | Die Datei, in der du gerade bist |
| Eine rote Zahl | Wie viele Konfliktblöcke die Datei noch enthält |
| Ein Etikett | Ein Konflikt ohne Text zum Zusammenführen: *auf einer Seite gelöscht*, *auf beiden Seiten umbenannt*, *auf einer Seite hinzugefügt* |

Gelöste Chips stehen vorn, offene danach, jede Gruppe nach Namen sortiert — so
liest sich die Leiste links als erledigt und rechts als das, was noch bleibt.

**Nächste Datei →** springt zur nächsten noch offenen Datei, und wenn du eine
Datei als gelöst markierst, landest du von selbst dort. **Fortsetzen** in der
Leiste bleibt deaktiviert, bis jeder Chip grün ist; **Abbrechen** fragt vorher
und sagt, was du verlierst.

git vergisst eine Datei in dem Moment, in dem sie gestaged wird. „Gelöst“ ist
deshalb das, was GitHuttBr während dieses Schritts gesehen hat, plus die Dateien,
die git in seiner Merge-Nachricht aufführt. Eine Datei, die du vor dem Öffnen des
Resolvers im Terminal gestaged hast, zählt trotzdem; nach einem Neustart mitten
in einem Rebase zählt die gelöste Hälfte dieses einen Schritts womöglich nicht.

## Warum das hier kollidiert

**Warum das kollidiert** listet im Kopf der Datei pro Seite die Commits auf,
die diese Datei angefasst haben, seit die Branches sich getrennt haben — also
`git log --merge`, das git seit jeher mitbringt und das niemand findet.

![Die Commits jeder Seite, die die konfliktbehaftete Datei angefasst haben](../../screenshots/conflict-why.webp)

Die Marker sagen, was kollidiert. Das hier sagt, wer es geändert hat und warum —
und genau das entscheidet meist tatsächlich über die Lösung. Steht dort nichts,
hat keine der beiden Seiten eine Änderung an genau diesem Pfad committet: Die
Kollision kam von einer Umbenennung oder einer Verschiebung.

Der Kopf sagt außerdem, bei welchem Konflikt du bist und welche Art von Konflikt
die Datei hat, gelesen aus gits eigenem Status: *beide Seiten haben dieselben
Zeilen geändert*, *auf beiden Seiten hinzugefügt*.

## Die drei Fenster

| Fenster | Ist |
|---|---|
| **Deine Seite** | Die Seite, auf der du warst, überschrieben mit dem neuesten Commit dieser Seite, der die Datei angefasst hat: SHA, Betreff, Autor, wie lange her |
| **Basis** | Die Fassung, von der beide Seiten ausgingen — der gemeinsame Vorfahr, oder bei einem Pick oder einem Rebase-Schritt der Parent des angewendeten Commits. Die Zeilen, die jeder Konflikt ersetzt hat, sind schattiert |
| **Eingehend** | Die hereinkommende Seite, genauso überschrieben wie Deine Seite |

**Basis zeigen** im Kopf des Ergebnisses blendet das Basis-Fenster aus oder ein
und merkt sich deine Wahl. Es ist ausgegraut, wenn es keine Basis gibt — beide
Seiten haben die Datei hinzugefügt.

Alle Fenster lassen sich in der Größe verändern, und der Kopf des Ergebnisses
trägt zwei Ansichtsschalter:

| Schalter | Was er tut |
|---|---|
| **Umbruch** | Bricht lange Zeilen in den seitlichen Fenstern um, statt sie zu scrollen. Die Textansicht des Ergebnisses behält eine Zeile pro Zeile — ihre Seitenmarker hängen davon ab — und scrollt deshalb immer |
| **Scrollen koppeln** | Scrollt die Fenster und das Ergebnis gemeinsam, vertikal und seitlich. Ihre Zeilenzahlen unterscheiden sich, deshalb wird die vertikale Position proportional angeglichen |

Umbruch startet aus, Scrollen koppeln startet an, und beide merken sich ihren
Zustand.

## Das Ergebnis

Das Ergebnis ist die Datei so, wie sie geschrieben wird. Jeder Konflikt sitzt an
seiner Stelle als Karte mit vier Antworten:

| Antwort | Was in der Datei landet |
|---|---|
| **Deine nehmen** | Deine Zeilen, und nur deine |
| **Ihre nehmen** | Ihre Zeilen, und nur ihre |
| **Beide** | Deine Zeilen, dann ihre |
| **Bearbeiten** | Beide, im Texteditor geöffnet und mit dem Konflikt markiert — für den Fall, dass die Antwort „beide, aber angepasst“ lautet |

Eine unbeantwortete Karte zeigt beide Seiten in der Vorschau, jede Zeile mit
*← deine* oder *← ihre* markiert und mit der Zeilennummer versehen, auf der sie
landet, wenn du sie nimmst — so entscheidest du, ohne aufzublicken. Bei einer
Datei mit sehr langen Zeilen bleiben die Antworten sichtbar, während der Code
darunter seitlich scrollt. **Ganze Datei: deine | ihre** im Kopf der Datei
beantwortet alle Konflikte auf einmal.

**Als Text bearbeiten** schaltet das Ergebnis auf einen einfachen Editor zum
freien Tippen um, mit der Zeilenzahl der Datei im Kopf. Sobald du getippt hast,
beschreiben die Karten nicht mehr, was dasteht; der Text bleibt deshalb, bis
**Auswahl zurücksetzen** alles zurückholt.

Die Fußzeile zählt, was in dieser Datei noch offen ist; **_Datei_ als gelöst
markieren** schreibt das Ergebnis und staged es und bleibt deaktiviert, bis jeder
Konflikt eine Antwort hat.

## Sich zurechtfinden

Beim Öffnen einer Datei landest du auf ihrem **ersten Konflikt**, nicht am
Anfang der Datei. Die Pfeile ⌃ / ⌄ im Kopf des Ergebnisses — oder
<kbd>Alt+↑</kbd> / <kbd>Alt+↓</kbd> — führen durch die übrigen und scrollen
dabei jedes Fenster zu jedem einzelnen.

## Zeilenweise auswählen

Die seitlichen Fenster wählen weiterhin pro **Zeile** und pro **Block** aus, und
das Kontrollkästchen in ihrem Kopf nimmt die **ganze Seite** — für die Antwort,
die keine Karte anbietet, etwa zwei Zeilen von dir und eine von ihnen.
Zeilenweise Auswahlen erscheinen sofort in den Karten.

## Dateien ohne etwas zum Zusammenführen

Manche Konflikte haben keine Zeilen zum Vergleichen: Eine Seite hat eine Datei
**gelöscht**, die die andere geändert hat, oder beide Seiten haben sie
unterschiedlich **umbenannt**. Drei Fenster, von denen eines leer ist, würden
nichts erklären — diese Fälle bekommen stattdessen eine Karte: wer was getan hat,
mit Commit, Autor und Alter jeder Seite.

![Eine Datei, die auf einer Seite gelöscht und auf der anderen geändert wurde](../../screenshots/conflict-deleted.webp)

| Fall | Möglichkeiten |
|---|---|
| Auf einer Seite gelöscht | **Datei behalten** (mit den Änderungen der anderen Seite), **Datei löschen** (fragt vorher) und **Ansehen, was du geändert hast** — der Diff gegen die Basis, damit du weißt, was das Löschen wegwirft |
| Auf beiden Seiten umbenannt | Den einen Namen **behalten**, den anderen, oder **beide Namen** |

git speichert keine Verbindung zwischen einem umbenannten Original und seinen
zwei neuen Namen, also ordnet die Karte sie über den Inhalt zu. Wenn sie es nicht
erkennen kann — mehrere Umbenennungen auf einmal, und die Dateien wurden auch
geändert —, sagt sie das, und die neuen Namen erscheinen als eigene Chips.

## Abschließen

Wenn die letzte Datei gelöst ist, schickt dich der Arbeitsbereich nicht auf die
Suche nach **Fortsetzen**: Eine Karte fasst zusammen, wie die Konflikte
beantwortet wurden, lässt dich die Merge-Nachricht bearbeiten (vorbelegt mit der
von git) und schließt von dort aus ab.

![Alle Konflikte gelöst, mit der Merge-Nachricht und dem rerere-Schalter](../../screenshots/conflict-done.webp)

- Die Zusammenfassung zählt, was sie dich hat wählen sehen: deine, ihre, beide,
  von Hand bearbeitet. Eine außerhalb des Resolvers gelöste Datei zählt als
  Datei, nicht als Antwort.
- Ein **Rebase**-Schritt behält die eigene Nachricht des wieder eingespielten
  Commits, deshalb gibt es dafür kein Nachrichtenfeld.
- **Diese Lösungen (rerere) für das nächste Mal merken** ist gits
  `rerere.enabled`, derselbe Schalter wie in den Einstellungen. git merkt sich
  nur Konflikte, die es hat entstehen sehen; hier eingeschaltet, wirkt es also
  ab dem nächsten.
- **Noch einmal prüfen** schließt den Resolver mit dem gestagten Ergebnis.

## Rückgängig machen

Jede Lösung — eine als gelöst markierte Datei, eine übernommene Seite, eine
behaltene oder gelöschte Datei, eine geklärte Umbenennung — hat einen
Rückgängig-Eintrag. Rückgängig stellt den Konflikt genau so wieder her, wie git
ihn hinterlassen hat: die Marker, beide Seiten und die Basis im Index, die Datei
auf der Platte. **Abbrechen** ist das Einzige, was sich nicht rückgängig machen
lässt — deshalb fragt es nach.

## KI-Unterstützung

Ist die KI aktiviert, schlägt **Mit KI lösen** einen Merge im Ergebnis vor, als
Text. Sie wendet nie etwas von selbst an: Du liest ihn, bearbeitest ihn und
stagest ihn. Siehe [KI-Funktionen](ai.md).

## Xcode-Projektdateien

`project.pbxproj` kollidiert häufiger als jede andere Datei in einem
iOS-Repository, und fast nie, weil jemand anderer Meinung gewesen wäre. Es ist
ein einziges flaches Wörterbuch aus Objekten mit 24-stelligen Hex-IDs: eine
Datei hinzuzufügen schreibt daher vier Einträge — ein `PBXBuildFile`, ein
`PBXFileReference`, eine Zeile in den `children` der zugehörigen Gruppe, eine
Zeile in der Build-Phase des Targets. Zwei Leute, die je eine Datei hinzufügen,
schreiben acht Einträge, die auf denselben paar Zeilen landen. Git sieht eine
Kollision; zu lösen gibt es nichts.

Ist die konfliktbehaftete Datei eine `project.pbxproj`, liest der Resolver alle
drei Fassungen als Projekte statt als Text und bietet an, **nach Struktur
zusammenzuführen**: Objekte über ihre ID zuordnen, jede Ergänzung beider Seiten
übernehmen, die `children`- und `files`-Arrays vereinigen und dort anhalten, wo
wirklich etwas auseinanderging. Das Band über den Panels sagt, was jede Seite
hinzugefügt hat und was — falls überhaupt — für dich übrig bleibt.

Wie der KI-Vorschlag landet es im Ergebnis und merkt nichts vor. Du liest
es, bevor du speicherst.

![Das Band für die strukturelle Zusammenführung über den Konflikt-Panels, bei einer Xcode-Projektdatei](../../screenshots/conflict-pbxproj.webp)

### Was es nicht tut

**Es rät nie bei einer Einstellung, die ihr beide verschoben habt.** Setzt du
`MARKETING_VERSION` auf `1.1` und sie auf `2.0`, ist das eine Entscheidung, und
sie steht benannt im Band — die Einstellung, dein Wert, ihrer — statt hinter
deinem Rücken aufgelöst zu werden. Ein Objekt, das es nicht klären konnte,
behält *deine* Fassung exakt, damit eine halb angewandte Zusammenführung nie auf
der Platte landet.

**Es lehnt die ganze Datei ab, wenn eine der drei Fassungen nicht parst.** Eine
`project.pbxproj`, die Xcode nicht öffnen kann, kostet mehr als eine manuelle
Zusammenführung — was es nicht mit Sicherheit lesen kann, bleibt also ein
gewöhnlicher Textkonflikt, und es sagt das auch.

**Es erkennt keine zwei IDs, die für verschiedene Objekte vergeben wurden.**
Selten, da Xcode sie zufällig wählt — aber wenn es passiert, würde jede der
beiden Seiten still jemandes Datei verlieren, also wird es gemeldet statt
zusammengeführt.

### Nicht `merge=union`

Das kursierende Hausmittel dafür ist `*.pbxproj merge=union` in
[`.gitattributes`](attributes.md). Lass es. Union funktioniert, solange die
einzigen Änderungen unabhängige Ergänzungen sind; sobald zwei Leute dieselbe
Build-Einstellung ändern, gibt es beide Zeilen aus und erzeugt eine Datei, die
Xcode nicht öffnet — genau in dem Moment, in dem du das Diff am wenigsten genau
liest. Strukturelles Zusammenführen bietet denselben Komfort ohne diesen
Fehlschlag.

## Lockfiles

`Podfile.lock`, `Package.resolved`, `yarn.lock` und ihre Verwandten halten einen
Abhängigkeitsgraphen fest, den irgendjemandes Resolver bereits gelöst hat. Die
Hälfte der einen Lösung an die Hälfte der anderen genäht ergibt einen Graphen,
den niemand gelöst hat: er installiert vielleicht nicht, und wenn doch,
installiert er etwas, das keiner der beiden Branches getestet hat.

Ist die konfliktbehaftete Datei also ein Lockfile, nennt das Band das Werkzeug,
dem sie gehört, bietet **Unsere behalten** und **Ihre behalten** gleich dort an
und gibt dir den Befehl, der sie danach neu erzeugt. Eine Seite zu nehmen ist
hier kein Kompromiss — es ist die ganze Methode, und das Neuerzeugen ist, was sie
richtig macht.

![Das Lockfile-Band über den Konflikt-Panels](../../screenshots/conflict-lockfile.webp)

Die drei Panels bleiben verfügbar, denn hin und wieder willst du sehr wohl
lesen, was sich geändert hat: eine Prüfsumme, die du wiedererkennst, eine
Version, die du erwartet hast. Sie von Hand zu bearbeiten ist das, wovon dies
dich abbringen will.

## Wie du sie gar nicht erst bekommst

Das [Konflikt-Radar](conflict-radar.md) sagt dir, welche Branches Konflikte
verursachen werden, bevor du einen von ihnen mergst.

## Git sich erinnern lassen (rerere)

Rebase einen langlebigen Branch, und du triffst jedes Mal denselben Konflikt
wieder. `rerere` — *reuse recorded resolution* — ist gits Antwort darauf: Es
merkt sich, wie du einen Konflikt beigelegt hast, und spielt diese Antwort beim
nächsten Auftreten des identischen Konflikts wieder ein.

**Einstellungen → Git & Synchronisierung → Konfliktlösungen merken.** Das schreibt
`rerere.enabled` in deine globale git-Konfiguration, damit sich die
Kommandozeile genauso verhält.

Wenn git für dich geantwortet hat, sagt der Resolver das, statt einen leeren
„keine Konfliktmarker“-Bildschirm zu zeigen, und bietet **Diese Lösung
vergessen** an — was die Erinnerung löscht *und* den Konflikt zurückbringt,
damit du ihn anders beilegen kannst.

Zwei Dinge, die man wissen sollte:

- **Eine wiedereingespielte Lösung wird nicht gestaged**, es sei denn, du
  schaltest *Wiedereingespielte Lösung automatisch stagen* ein. Lass das aus:
  Der Sinn der Pause ist, dass eine gemerkte Antwort für genau diesen Merge
  falsch sein kann — und ungesehen zu stagen ist der Weg, auf dem sie in einen
  Commit gelangt.

  Deshalb **bleibt eine wiedereingespielte Datei in den konfliktbehafteten
  Dateien**: git hat den Inhalt geschrieben, aber der Index hält sie weiterhin
  als „unmerged“, und nur das Stagen klärt das. **So übernehmen** im Resolver
  oder **Alle als gelöst markieren** in der Liste bewegt sie.
- **rerere versteht nicht jeden Konflikt.** Add/Add- und Delete/Modify-Konflikte
  bekommen kein Preimage, sie kommen also immer roh zurück. Die Zahl in den
  Einstellungen ist die, die es tatsächlich vorhält, und **Alle vergessen** leert
  den Speicher.

**Siehe auch:** [Konflikt-Radar](conflict-radar.md) · [Mergen & Rebasen](merging.md)
