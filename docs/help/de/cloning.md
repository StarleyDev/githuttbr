---
title: Klonen
category: Erste Schritte
order: 2
summary: Von einer URL klonen oder direkt vom Hoster — und eingrenzen, was heruntergeladen wird, wenn das Repository riesig ist.
keywords: klonen clone hintergrund background abbrechen cancel mehrere viele stapel batch repositorys alle auswählen shallow depth partial filter blob none single branch submodule submodules recursive ls-remote branch-auswahl unshallow monorepo
source: 3d8942b1073ef47bd000c7887afb5ea8cdebcdd7
---

# Klonen

**Neues Repository → Klonen**, oder `⌘K` → *Klonen*. Füge eine URL ein, oder
melde dich bei GitHub, GitLab, Bitbucket oder Azure DevOps an und wähle aus
deinen eigenen Repositorys — das Token des gewählten [Profils](profiles.md)
wird für den Klon verwendet und danach verworfen, es landet nie in
`.git/config`.

Wähle einen übergeordneten Ordner und einen Namen; die Zeile unter den Feldern
zeigt dir genau, wo das Repository landen wird. Ein bereits existierender
Ordner wird abgelehnt statt hineinzuklonen.

## Mehrere Repositorys auf einmal

Einen neuen Rechner einrichten oder alle Dienste eines Teams herunterholen hieß
früher, diesen Dialog für jedes Repository einzeln zu öffnen. Setze in einem
Hoster-Tab das Häkchen bei jedem Repository, das du willst, oder nimm mit
**Alle angezeigten auswählen** alles, worauf der Filter passt. Ein Klick auf eine
Zeile (nicht auf ihr Häkchen) wählt weiterhin nur dieses eine.

Sind mehrere angehakt, klont der Dialog sie alle in denselben übergeordneten
Ordner, jedes in einen Ordner mit dem Namen des Repositorys. Die Pfade werden
vor dem Start aufgelistet. Heißen zwei gleich (`org-a/app` und `org-b/app`),
bekommen beide den Besitzer in den Ordnernamen (`org-a-app`, `org-b-app`), statt
um einen Ordner zu konkurrieren.

![Der GitHub-Tab des Klon-Dialogs mit drei angehakten Repositorys, den Ordnern, in denen sie landen, unter dem übergeordneten Ordner und einem Knopf „3 Repositorys klonen“](../../screenshots/clone-multi-select.webp)

Der Stapel geht direkt in die Ablage in der Ecke. Drei Klone laufen gleichzeitig,
der Rest wartet als *In Warteschlange*; jeder hat seinen eigenen Abbrechen-Knopf.
Jedes Repository öffnet sich in einem Tab, sobald es fertig ist.

Grenzen:
- **Auszucheckender Branch** ist bei einem Stapel ausgeblendet: Ein Branch-Name
  bedeutet über verschiedene Repositorys hinweg nichts, also bekommt jedes seinen
  Standard-Branch. Die übrigen Optionen unter Erweitert (partial, shallow, nur
  ein Branch, Submodule) gelten für alle.
- Die Mehrfachauswahl gibt es nur in den Hoster-Tabs. Der URL-Tab nimmt eine URL.
- Ein Fehlschlag hält die anderen nicht auf. Ein Repository, dessen Ordner schon
  existiert, scheitert mit seinem eigenen Fehler, und der Rest läuft weiter.

## Erweitert — den Klon eingrenzen

Alles unter **Erweitert** ist standardmäßig aus: Lässt du es in Ruhe, bekommst
du einen ganz gewöhnlichen, vollständigen Klon. Seine Berechtigung hat der
Bereich bei Repositorys, wo „vollständig“ zwanzig Minuten und mehrere Gigabyte
bedeutet.

![Der Klon-Dialog mit geöffnetem Bereich „Erweitert“: partial, shallow, single-branch, Submodule und eine Branch-Auswahl](../../screenshots/clone-advanced.webp)

| Option | Was git tut | Was es kostet |
|--------|---------------|---------------|
| **Partial Clone** | `--filter=blob:none` | Vollständige Historie, keine Dateiinhalte. Blobs kommen bei Bedarf, also braucht das Öffnen einer alten Datei das Netzwerk. |
| **Shallow Clone** | `--depth=N` | Nur die neuesten N Commits existieren. Blame, Log, Bisect und Range-Diff enden am Schnitt. |
| **Nur ein Branch** | `--single-branch` | Die übrigen Branches bleiben auf dem Remote, bis du sie fetchst. |
| **Submodule klonen** | `--recurse-submodules` | Jedes Submodul wird ebenfalls ausgecheckt — mehr Zeit jetzt, dafür später keine fehlenden Verzeichnisse. |
| **Auszucheckender Branch** | `--branch <name>` | Startet auf diesem Branch statt auf dem Standard-Branch des Remotes. |

**Partial vor Shallow.** Ein Partial Clone behält jeden Commit — die Historie
bleibt durchsuchbar, und nur Dateiinhalte werden verzögert geholt. Ein Shallow
Clone wirft Historie tatsächlich weg: `git log` endet am Schnitt, und Blame
kann nicht darüber hinaussehen. Wenn du ein Monorepo klonst, um darin zu
arbeiten, ist Partial normalerweise das, was du willst.

Shallow lässt sich rückgängig machen: `git fetch --unshallow` im
[Terminal](terminal.md) füllt die Historie wieder auf.

### Den Branch wählen

Tippe einen Branch-Namen, oder drücke **Branches auflisten**, um den Remote zu
fragen, was er hat (`git ls-remote --heads`), und wähle aus einer Auswahlliste.
Das ist ein einziger Netzwerk-Roundtrip, und er passiert nur, wenn du den Knopf
drückst — während du tippst, wird nichts abgefragt.

Schlägt die Auflistung fehl — eine private URL ohne Token, ein Tippfehler, kein
Netz —, bleibt das Feld ein simples Textfeld, und der Klon selbst meldet dann
den echten Fehler.

### Zwei Anmerkungen zu den Flags

- **`--depth` impliziert `--single-branch`.** Bei einem Shallow Clone ist es
  gerade das *nicht* gesetzte Häkchen bei *Nur ein Branch*, das die übrigen
  Branches wieder anfordert (`--no-single-branch`) — deshalb ändert sich der
  Hinweis darunter.
- **Beim Klonen eines lokalen Ordners** ignoriert git `--depth` normalerweise
  komplett, weil es den Objektspeicher hardlinkt, statt ihn zu übertragen.
  Gitcito klont deshalb über eine `file://`-URL, wenn du eine flache Kopie
  eines lokalen Repositorys anforderst — so bekommst du die Tiefe, die du
  angefordert hast.

## Fortschritt, Hintergrund und Abbrechen

Der Balken meldet, was git meldet: zählen, komprimieren, empfangen, auflösen,
auschecken. Eine Phase, die keine Gesamtzahl melden kann, zeigt einen
unbestimmten Balken statt eines erfundenen Prozentwerts.

Ein großer Klon dauert Minuten, und ein versehentlicher Klick neben den Dialog
hat dich früher all das gekostet. Jetzt blendet das Schließen des Dialogs —
**Im Hintergrund ausführen**, `Esc`, das ✕ oder ein Klick daneben — ihn nur aus:
Der Klon läuft weiter und wandert in eine kleine Karte in der unteren Ecke, mit
demselben Fortschrittsbalken. Währenddessen kannst du einen weiteren Klon
starten; jeder bekommt seine eigene Karte.

![Die Klon-Ablage in der unteren Ecke: drei Klone beim Empfangen, Auflösen und Zählen, ein vierter in der Warteschlange, jeder mit eigenem Abbrechen-Knopf](../../screenshots/clone-tray.webp)

Das falsche Repository erwischt? **Klon abbrechen** im Dialog oder das ✕ auf
seiner Karte stoppt git und löscht den halb geschriebenen Ordner. Sonst wird
nichts angefasst — der Ordner existierte vor dem Start des Klons nicht, und das
wird vorher geprüft. Ein abgebrochener Klon lässt sich nicht fortsetzen; ein
neuer Start beginnt bei null.

Wenn er fertig ist, öffnet sich das neue Repository in einem Tab, angeheftet an
das Profil, mit dem du geklont hast — egal, ob der Dialog noch offen ist.

Klone laufen innerhalb der App, also stoppt das Beenden von Gitcito sie. Das
Beenden wartet nicht auf das Aufräumen, daher kann der halb geschriebene Ordner
liegen bleiben — lösche ihn, bevor du dorthin erneut klonst, denn der Dialog
lehnt einen existierenden Ordner ab.
