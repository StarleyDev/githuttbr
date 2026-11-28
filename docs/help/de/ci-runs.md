---
title: CI-Läufe
category: Sync & viele Repos
order: 59
summary: Verfolge GitHub Actions, GitLab-Pipelines, Azure Pipelines und Forgejo Actions in der App — jeden Job, seine Schritte und sein Log, mit erneut ausführen und abbrechen.
keywords: ci-läufe ci runs actions workflow pipeline build github actions gitlab pipelines azure pipelines forgejo actions jobs schritte steps logs erneut ausführen rerun re-run abbrechen cancel dispatch workflow_dispatch badge status graph
---

# CI-Läufe

Du hast gepusht und wartest jetzt: zum Browser wechseln, das Repository finden,
Actions öffnen, deinen Lauf finden, den rot gewordenen Job öffnen, ans Ende des
Logs scrollen. **CI-Läufe** holt diese Schleife neben den Code. Eine Seite zeigt,
wie es jedem Workflow zuletzt ergangen ist, listet die Läufe des Remotes, die
neuesten zuerst, und öffnet einen fehlgeschlagenen Lauf direkt bei dem Test, der
gebrochen ist — mit Datei und Zeile, einen Klick von deinem Editor entfernt. Die
Knöpfe, um ihn erneut zu starten oder anzuhalten, sitzen auf der Karte.

Die Seite spricht mit der eigenen API des Hosts, mit dem Token, das du GitHuttBr
schon gegeben hast. Auf deinem Rechner läuft nichts — dafür siehe
[Lokale CI](local-ci.md).

![Die Seite CI-Läufe: eine Karte pro Workflow mit seinen letzten Läufen, die Filter Fehlgeschlagen und Läuft, der Fortschritt eines laufenden Laufs und ein fehlgeschlagener Lauf, geöffnet bei dem Test, der gebrochen ist, und seinen Jobs](../../screenshots/ci-runs.webp)

## Öffnen

**Werkzeuge → CI-Läufe…** oder *CI-Läufe* in der Befehlspalette (⌘K). Die Seite
hängt am Tab des Repositorys, wie das Wiki und die Insights, und liest das Remote
namens `origin` — oder das erste Remote, wenn es kein `origin` gibt.

## Was die Seite zeigt

| Teil | Was es ist |
|---|---|
| **Workflow-Karten** | Eine Karte pro Workflow: was ihn auslöst, seine Erfolgsquote über seine letzten 10 beendeten Läufe (grün ab 90 %, bernsteinfarben ab 70 %, rot darunter), diese Läufe als farbige Quadrate — der älteste links, damit der neueste neben „jetzt“ steht —, seine Durchschnittszeit und entweder sein langsamster Job oder wie sein letzter Lauf ausging. Ein Klick auf eine Karte listet nur die Läufe dieses Workflows; ein zweiter Klick zeigt wieder alle |
| **Alle Branches / Aktueller Branch** | Jeder Lauf auf dem Remote, oder nur der Branch, den du ausgecheckt hast |
| **Fehlgeschlagen / Läuft** | Schnellfilter mit der Zahl der Läufe, die jeder übrig ließe. Sie zählen, was die anderen Filter übrig lassen, also ist die Zahl das, was ein Klick zeigt |
| **Filter** | Grenzt die geladenen Läufe nach Titel, Workflow, Branch, Autor, Commit oder Ereignis ein |
| **Eine Laufkarte** | Der Titel des Commits (oder der Name des Workflows), dann der Branch, der Workflow und die Laufnummer, was ihn gestartet hat (Push, Pull Request, Zeitplan, manuell…), wer ihn gestartet hat und der Commit — ein Klick auf den Commit kopiert ihn. Gehört der Lauf zu einem Pull Request, öffnet **PR #n** die Seite dieses Pull Requests. Rechts: wo er steht, wie lange er gedauert hat und wie lange das her ist |
| **Ein laufender Lauf** | *Läuft · Schritt 3 von 5*, ein Fortschrittsbalken und die bisherige Zeit. Der Schritt ist der des laufenden Jobs; auf einem Host ohne Schritte (GitLab, Forgejo) zählt er stattdessen Jobs |
| **Der fehlgeschlagene Test** | Ein fehlgeschlagener Lauf öffnet sich von selbst, der neueste zuerst, mit dem Test, den sein Log nennt: der Job, der Test, die erste Zeile des Fehlers und **Pfad:Zeile** — ein Klick darauf oder auf *Im Editor öffnen* bringt dich zu dieser Zeile. Dieselbe Auswertung wie im [Tab Checks](hosting.md#der-tab-checks) eines Pull Requests |
| **Jobs** | Darunter jeder Job mit seinem Zustand und seiner Dauer, nach Stage gruppiert, wo der Host Stages hat (GitLab, Azure). *Schritte und Log ansehen* öffnet die Schritte eines Jobs und das Ende seines Logs — bei einem fehlgeschlagenen Job ist es immer da, bei den anderen erscheint es, wenn du auf den Job zeigst |
| **Schritte** | Jeder Schritt eines Jobs, mit seinem Zustand und seiner Dauer — GitHub, Azure und Forgejo melden sie; GitLab hat keine Schritte |
| **Log** | Das Ende des Logs eines beendeten Jobs, mit Farben. Nur die letzten 512 KB werden geholt — dort, wo ein Fehler steht —, und die Seite sagt, wenn der Anfang weggelassen wurde |

Solange auf der Seite etwas wartet oder läuft, fragt die Liste den Host alle 15
Sekunden erneut, und mit ihr die Jobs des offenen Laufs und jedes laufenden Laufs
— daher kommt die Schrittzahl; Dauern ticken jede Sekunde. Wenn zwei Minuten
Antworten nichts Neues bringen — ein Lauf, der etwa auf die Freigabe eines
Deployments wartet —, verlangsamt sie auf einmal pro Minute und wird wieder
schneller, sobald sich etwas bewegt. Eine Liste, in der alles beendet ist, fragt
nichts, bis du auf Aktualisieren drückst, und solange das Fenster verborgen ist,
wird nichts gefragt.

Ein Lauf, den der Host ohne Titel schickt — jede GitLab-Pipeline, ein geplanter
Azure-Build —, wird nach dem Betreff seines Commits benannt, wenn der Commit im
Graphen ist, kostenlos aus deinem lokalen Repository gelesen; sonst nach seiner
Nummer.

## Erneut ausführen, abbrechen, starten

| Knopf | Erscheint, wenn | Was passiert |
|---|---|---|
| **Fehler erneut** | Der Lauf ist fehlgeschlagen oder wurde abgebrochen | Nur die Jobs, die nicht bestanden haben, laufen erneut |
| **Erneut ausführen** (↻) | Der Lauf ist beendet, auf GitHub — auf der Karte, wenn du auf sie zeigst | Jeder Job läuft erneut |
| **Im Browser öffnen** | Beim Zeigen auf eine Karte | Der Lauf auf der Website des Hosts |
| **Abbrechen** | Der Lauf wartet oder läuft | Fragt zuerst: die laufenden Jobs werden unterbrochen, und ihre Arbeit geht verloren |
| **Workflow starten** | Der Host kann einen von Hand starten | Wähle den Workflow und einen Branch; er startet, als wäre dieser Branch gepusht worden, und erscheint ein paar Sekunden später in der Liste |

Was jeder Host erlaubt:

| Host | Liste & Jobs | Schritte | Log | Alles erneut | Fehler erneut | Abbrechen | Von Hand starten |
|---|---|---|---|---|---|---|---|
| **GitHub** (und Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — der Workflow braucht einen `workflow_dispatch`-Trigger |
| **GitLab** (und selbst verwaltet) | ✓ — Pipelines, Jobs nach Stage | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — führt `.gitlab-ci.yml` auf dem Branch aus |
| **Azure DevOps** | ✓ — Builds, Jobs nach Stage | ✓ (Tasks) | ✓ | — | ✓ | ✓ | ✓ — jede Build-Definition des Repositorys |
| **Forgejo / Gitea** | ✓ auf Servern mit der Actions-Runs-API | ✓ | ✓, wenn der Server es an ein Token ausliefert | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Badges im Graphen

Dieselbe CI erscheint als kleines Badge neben jedem Commit im Graphen: grün, rot
oder eine Uhr, solange sie läuft. Fahre darüber für die Jobs; klicke für die
Seite des Hosts. Die Badges kommen aus:

| Host | Quelle |
|---|---|
| GitHub | Den Check-Runs des Commits — jede CI, die an GitHub meldet, nicht nur Actions |
| GitLab | Den Status des Commits, die jeden Pipeline-Job enthalten. Ein manueller Job (etwa ein Deploy) lässt das Badge nicht auf der Uhr hängen |
| Azure DevOps | Den 100 neuesten Builds des Repositorys, nach Commit zugeordnet |
| Forgejo / Gitea | Dem kombinierten Status des Commits — Forgejo Actions und jede externe CI |
| Bitbucket Data Center | Den Build-Status des Commits |

Jede Antwort wird gemerkt — auch „hier gibt es keine CI“ —, und ein Commit wird
erst wieder gefragt, wenn sich seine Antwort geändert haben kann: alle 45
Sekunden, solange er läuft, alle 10 Minuten, sobald er beendet ist, und immer
seltener bei einem Commit, der nie CI hatte. So bleibt ein voller Graph im
stündlichen Kontingent des Hosts.

## Grenzen

- **Die Karten kennen nur die Läufe, die die Seite gelistet hat.** Das sind die
  letzten 50 Läufe des aktiven Branch-Filters — ein selten laufender Workflow
  zeigt vielleicht weniger als zehn Quadrate, und der Wechsel auf den aktuellen
  Branch berechnet jede Karte neu. Der langsamste Job erscheint, sobald die Seite
  die Jobs irgendeines beendeten Laufs gelesen hat (der fehlgeschlagene Lauf, den
  sie öffnet, reicht); bis dahin sagt die Karte, wie der letzte Lauf ausging.
- **Der fehlgeschlagene Test wird aus dem Text des Logs gelesen.** Vitest, Jest
  und pytest werden erkannt; jeder andere Runner, ein Build-Fehler oder ein
  abgeschnittenes Log zeigt nur die Jobliste. Ein Pfad, den der Runner außerhalb
  des Checkouts geschrieben hat, lässt sich nicht öffnen.
- **PR #n hängt davon ab, was der Host sagt.** GitHub nennt den Pull Request nur
  für Läufe aus demselben Repository, nicht aus einem Fork; GitLab nennt ihn bei
  Merge-Request-Pipelines und Azure bei PR-Builds. Forgejo-Läufe tragen keinen
  Link.
- **Das Log ist das Ende, und erst, wenn ein Job beendet ist.** GitHub und
  Forgejo geben das Log eines Jobs heraus, wenn er fertig ist; solange er läuft,
  zeigt die Seite seine Schritte in Bewegung, nicht seine Ausgabe. GitLab und
  Azure liefern das bisherige Log eines laufenden Jobs — öffne es erneut, um mehr
  zu lesen.
- **Das Token braucht CI-Zugriff.** Ein fein granuliertes GitHub-Token braucht
  *Actions: read* zum Auflisten und *Actions: write* zum erneuten Ausführen,
  Abbrechen oder Starten; ein klassisches braucht `repo`. Ein GitLab-Token braucht
  `read_api` zum Auflisten und `api` für die Knöpfe. Ein Azure-Token braucht
  *Build: read* (und *Build: read & execute* für die Knöpfe); ohne es bleiben die
  Seite und die Badges leer, statt fehlzuschlagen.
- **Azure-Badges reichen nur 100 Builds zurück.** Ein älterer Commit hat kein
  Badge, obwohl die Seite CI-Läufe seinen Build noch listet.
- **Azures erneutes Ausführen ist „Fehlgeschlagene wiederholen“.** Es funktioniert
  bei YAML-Pipelines mit Stages; eine klassische Pipeline kann es ablehnen, und die
  Seite zeigt die Antwort des Hosts.
- **Einen Workflow zu starten fragt nicht nach seinen Eingaben.** Einen
  GitHub-Workflow oder eine GitLab-Pipeline mit Pflichteingaben ohne Standardwert
  lehnt der Host ab, mit seiner eigenen Meldung.
- **Forgejo ist schreibgeschützt, und nur auf neueren Servern.** Ältere Forgejo-
  und Gitea-Server haben keine API zum Auflisten von Läufen; die Seite sagt, dass
  der Host nicht unterstützt wird, und die Graph-Badges funktionieren weiter über
  die Commit-Status. Ein Repository, das das Token nicht sehen kann, erscheint als
  Zugriffsfehler, nicht als „nicht unterstützt“.
- **Bitbucket hat keine Laufseite.** Auf Data Center ist CI ein externes System
  (Jenkins, Bamboo…), das nur einen Status meldet — dieser Status ist das
  Graph-Badge. bitbucket.org Pipelines wird nicht unterstützt.
- **Ein Remote.** Die Seite liest `origin`; Läufe auf dem anderen Remote eines
  Forks werden nicht gelistet.

**Siehe auch:** [Lokale CI](local-ci.md) · [Hosting & Pull Requests](hosting.md)
