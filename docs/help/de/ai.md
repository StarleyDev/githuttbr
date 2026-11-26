---
title: KI-Funktionen
category: KI
order: 80
summary: Optional, anbieterunabhängig und in deinem echten Code verankert.
keywords: ki ai openai anthropic ollama lokales llm commit-nachricht erklären review wiki verankert konten konto api-schlüssel abo abonnement cli claude codex gemini modelle
---

# KI-Funktionen

Jede KI-Funktion ist **optional** und aus, bis du einen Anbieter einrichtest.
Es wird nichts irgendwohin geschickt, bevor du nicht konkret etwas anforderst.

![KI-Einstellungen](../../screenshots/settings-ai.webp)

## Eine KI für alle Profile

Die KI wird einmal eingerichtet, unter **Einstellungen → KI**, und jedes
[Profil](profiles.md) nutzt sie: Ein Profil, das du später anlegst, hat die KI
schon, ohne dass ein Konto erneut hinzugefügt werden muss. Die Seite listet jedes
Profil und ob es dieser **allgemeinen KI** folgt.

Ein Profil kann stattdessen **seine eigene KI** verwenden — ein Arbeitsprofil,
das aus Kosten- oder Datenschutzgründen über das Konto der Firma laufen muss. Auf
der Seite **Profil** dieses Profils, unter *KI dieses Profils*, stellst du
**Allgemein** auf **Eigene** um: Sie beginnt als Kopie der allgemeinen KI, und
ihre Anbieter und Schlüssel gehören von da an nur ihr. Zurück auf **Allgemein**
entfernt sie nach einer Bestätigung und lässt die allgemeine KI, wie sie war.

Jede KI wird auf dieser einen Seite eingerichtet. Die Leiste **Bearbeitet wird**
oben wählt, welche: die allgemeine KI oder die eigene eines Profils (*Eigene KI
von Arbeit*). **Eigene KI einrichten** auf der Profilseite oder **Eigene KI
bearbeiten** in der Profilliste öffnet die Seite auf genau dieser. Die
Profilseite selbst zeigt nur, welche KI das Profil verwendet und was antwortet —
den Editor enthält sie nie.

![Die KI eines Profils auf seiner Profilseite: Allgemein oder Eigene, was antwortet, und der Weg, sie einzurichten](../../screenshots/settings-profile-ai.webp)

Wie die KI **schreibt**, bleibt in beiden Fällen pro Profil: Stil der
Commit-Nachrichten, Stil der Erklärungen, Stile für Konfliktlösung und
Branch-Namen, eigene Anweisungen, Co-Autor-Zeile und Repository-Chat. Das steht
auf der Seite **Profil** unter *Schreibstil der KI*, sodass ein Arbeitsprofil
`ticket`-Commits schreiben kann, während ein privates `conventional`-Commits
schreibt, beide mit derselben KI.

Ein Upgrade von einer Version, in der jedes Profil seine eigene KI hatte, verliert
nichts: Die KI des verwendeten Profils wird zur allgemeinen KI, und jedes andere
Profil, dessen KI anders war, behält sie als eigene.

## Anbieter

Ein **Konto** ist ein Weg zu einem Modell: ein Anbieter, wo er erreichbar ist
und wie er sich authentifiziert. Du kannst mehrere einrichten, und sie bestehen
nebeneinander — ein Arbeitsschlüssel, ein privater, ein lokales Modell, eine
CLI, in der du bereits angemeldet bist.

Voreinstellungen gibt es für **OpenAI, Anthropic, Google Gemini, OpenRouter,
Groq, Mistral** und **Ollama** (vollständig lokal), dazu jeder
OpenAI-kompatible Endpunkt.

Anthropic nutzt seine eigene `/v1/messages`-API statt eines OpenAI-förmigen
Aufrufs, deshalb funktionieren Claude-Modelle jetzt wirklich, statt es nur zu
scheinen. Gemini wird über Googles OpenAI-kompatiblen Endpunkt angesprochen.

### Ein Abo statt eines API-Schlüssels nutzen

Wähle bei der Einrichtung oder unter Einstellungen → KI **Mein Abo verwenden**. Wähle ChatGPT oder Claude und melde dich mit dem passenden Befehl im Terminal an. Teste die Verbindung und füge das Konto nach erfolgreichem Test hinzu. Das erste Konto der allgemeinen KI wird zum Standard.

Klicke nach der CLI-Installation auf Verbinden, um die Anmeldeseite des Anbieters zu öffnen. Eine laufende Verbindung kannst du abbrechen.

- ChatGPT (Codex) — `codex login`
- Claude (Claude Code) — `claude auth login`

Der Test sendet eine kurze Anfrage an den Anbieter und nutzt dein Kontingent. Kontingent erschöpft. Versuche es nach der Erneuerung erneut.

![Mein Abo verwenden](../../screenshots/ai-subscription.webp)

Wähle den Anbieter **Lokale CLI**, um mit einer Agent-CLI zu antworten, die auf
diesem Rechner bereits installiert und angemeldet ist — `claude`, `gemini` oder
`codex`. GitHuttBr startet das Programm mit deiner Eingabe und liest die Antwort;
es gibt keinen API-Schlüssel einzufügen und kein Token wird gespeichert.

GitHuttBr führt nur einen Befehl aus, den du als Konto eingerichtet hast, und
immer mit einer Argumentliste statt einer Shell — nichts aus einem Diff oder
einem Branch-Namen kann also als Befehl gelesen werden.

> **Das ist nicht privater als ein API-Schlüssel.** Deine Eingaben erreichen
> weiterhin denselben Anbieter, unter deinem eigenen Konto, genau wie mit einem
> Schlüssel. Es ändern sich Abrechnung und Einrichtung, nicht der Weg des Texts.

Liegt der Befehl nicht in deinem `PATH`, trage seinen vollständigen Pfad am
Konto ein.

### Modell je Aufgabe

Unter **Modell je Aufgabe** kann jede Funktion — Commit-Nachrichten,
Chat, Erklären, PR-Review, Konfliktlösung, Wiki, Themes — auf ein eigenes Konto
und Modell zeigen. Lass eine Zeile auf dem Standard, um dem Standardkonto zu
folgen. Ein günstiges Modell für Commit-Nachrichten und ein starkes für den Chat
ist die übliche Aufteilung.

### Upgrade-Hinweis

Beim Upgrade von einer Version vor den Konten erscheint das einmal. Anbieter und Schlüssel, die du hattest, werden zum ersten Konto; von Hand ist nichts neu einzurichten.

![Upgrade-Hinweis](../../screenshots/ai-accounts-notice.webp)

## Modelle

Modelllisten kommen vom Anbieter selbst und werden einen Tag zwischengespeichert;
**Modelle abrufen** aktualisiert eine sofort. Unter der Liste sagt GitHuttBr, woher
sie stammt — live, aus dem Cache (mit Zeitpunkt) oder aus der eingebauten
Ersatzliste, und warum.

Die Liste ist auf Modelle gefiltert, die eine Chat-Anfrage beantworten können;
Embedding-, Sprach- und Bildmodelle bleiben also draußen. Jedes Modellfeld nimmt
außerdem freien Text an, sodass ein Vorschaumodell, ein privates Deployment oder
ein frisch geholter Ollama-Tag immer nutzbar ist, auch wenn der Anbieter ihn
nicht aufführt.

Ein Anbieter, dem du noch keinen Schlüssel gegeben hast, oder der nicht
erreichbar ist, fällt auf eine kleine eingebaute Liste zurück statt auf ein
leeres Auswahlfeld.

Kein Anbieter veröffentlicht eine sortierte oder kuratierte Liste, die Aufbereitung stammt also von GitHuttBr: datierte Snapshots klappen in das Modell zusammen, von dem sie ein Snapshot sind (`gpt-4o` deckt `gpt-4o-2024-08-06` ab), und der Rest steht nach Aktualität statt alphabetisch. **Alle Modelle zeigen** am Ende der Liste holt alles zurück, was der Anbieter geliefert hat.

## Was es kann

| Funktion | Was du bekommst |
|---|---|
| **Commit-Nachricht** | Zusammenfassung (und optional ein Body) aus deinem gestagten Diff, im gewählten Stil |
| **Diese Datei erklären** | Erklärung in Alltagssprache in einem Seitenpanel — Normal, Knapp, ELI5… sogar Pirat |
| **Hover zum Erklären** | Halte <kbd>⇧</kbd> und zeige auf einen Bezeichner für eine einzeilige Erklärung, plus die Zeilen, auf die sie sich stützt |
| **Konfliktlösung** | Schlägt einen Merge in der editierbaren Ausgabe vor — wendet nie automatisch an |
| **PR-Review** | Fasst einen Diff zusammen und markiert Risiken, jedes verankert an einer echten `path:line` |
| **PR-Beschreibung** · **Branch-Namen** | Entworfen aus den Commits und dem Diff des Branches |
| **Themes** · **Graph-Paletten** | Aus einem Prompt generiert |
| **Smartes Staging** | Vorschläge, was in diesen Commit gehört |
| **KI-Konfigurationsassistent** | Erzeugt Assistenten-Konfigurationsdateien (Anweisungen, Agenten, Hooks) für das Repository — der Zauberstab-Knopf in der Kopfzeile des Chat-Panels |

## Verankert, nicht geraten

Das Review sieht den Diff als **beschriftete Hunks** und darf nur diese
Beschriftungen zitieren; GitHuttBr löst dann jede Beschriftung zu einer echten
Datei und Zeile auf. Ein Modell, das eine Fundstelle erfindet, wird
**abgelehnt und erneut gefragt** — Befunde zeigen also immer auf Code, den es
wirklich gibt.

Hover zum Erklären liest nur ein nummeriertes Fenster rund um das Token — in
einem Diff nur die Hunks, die auf dem Bildschirm sichtbar sind. Liegt eine
Definition anderswo, sagt es das, statt sie zu erfinden. Antworten werden pro
Dateiversion gecacht.

**Maskierte Secret-Dateien werden nie gesendet.** Ebenso wenig Dateien, die
unter die Regeln zur Secret-Maskierung fallen.

## Grenzen

- Die eingebauten Ersatzlisten veralten zwischen Releases. Genau dafür gibt es
  den Live-Abruf; der Ersatz deckt nur den Fall ab, dass ein Abruf nicht möglich
  ist.
- Die Filterung auf chatfähige Modelle geht über den Namen, ein ungewöhnlich
  benanntes Chat-Modell kann also herausfallen. Dann tippst du es einfach ein.
- Ein CLI-Konto kann den Tokenverbrauch nur melden, wenn die CLI das tut — die
  Nutzungs- und Kostenzahlen in den Einstellungen zählen solche Aufrufe also zu
  niedrig.
- CLI-Antworten sind langsamer als ein direkter API-Aufruf: das Programm startet
  pro Anfrage eine ganze Sitzung.
- Schlüssel werden pro Konto im Schlüsselbund deines Systems abgelegt. Ein Konto
  zu löschen löscht seinen Schlüssel.
- Der Wechsel zurück zu einer Version vor der allgemeinen KI verliert die
  Schlüssel der allgemeinen KI: Diese Version weiß nicht, wo sie liegen, und
  verwirft sie beim Speichern. Die Konten bleiben; gib die Schlüssel neu ein. Die
  eigene KI eines Profils ist nicht betroffen.

**Siehe auch:** [Repo-Wiki](repo-wiki.md) · [Sicherheit & Secrets](security.md)
