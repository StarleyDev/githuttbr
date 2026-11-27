---
title: Erster Start
category: Erste Schritte
order: 2
summary: Der Einrichtungsassistent beim ersten Start — Git-Identität, Hosting-Konten, KI, Darstellung — und was jeder Schritt speichert.
keywords: onboarding erster start einrichtung assistent willkommen einstellungen importieren git identität konten ki abo api schlüssel ollama lm studio claude code codex überspringen first run
source: e8fa4f58f0acd79a07a40066c813a2ab49312255
---

# Erster Start

Beim ersten Start fragt GitHuttBr in einem kurzen Assistenten das Wenige ab, das sein Verhalten ab dem ersten Commit bestimmt: wer du in Git bist, wo deine Repositories liegen, ob du KI nutzen willst und wie es aussehen soll. Jeder Schritt darf leer bleiben, und alles lässt sich später in den **Einstellungen** ändern.

![Der KI-Schritt: eine Abo-CLI auf diesem Rechner gefunden und getestet](../../screenshots/onboarding-ai.webp)

## Der Willkommensbildschirm

Vor den Schritten bietet der Willkommensbildschirm an, eine **Einstellungsdatei** von einem anderen Rechner zu importieren. Schlüssel und Tokens werden daraus entfernt, außer du setzt das Häkchen zum Behalten, und ein passwortgeschützter Export fragt gleich dort nach dem Passwort. Der Import übernimmt die Datei und schließt den Assistenten — was ein Export enthält, steht unter [Sicherheit & Geheimnisse](security.md).

## Die Schritte

Die linke Spalte listet die Schritte. Ein grüner Haken markiert einen ausgefüllten Schritt, ein Strich einen übersprungenen, und die hervorgehobene Zeile ist der aktuelle.

| Schritt | Was er setzt | Wo später ändern |
|---|---|---|
| Git-Identität | Den Profilnamen sowie Name und E-Mail deiner Commits | Einstellungen → Profil & Identität |
| Konten | Tokens für GitHub, GitLab, Azure DevOps, Bitbucket, Forgejo und eigene Server, und die App für **Öffnen mit…** | Einstellungen → Verbundene Konten; die App unter Einstellungen → Git & Synchronisierung |
| Künstliche Intelligenz | Ein KI-Konto, in Verwendung gesetzt | Einstellungen → KI |
| Darstellung | Theme und heller, dunkler oder automatischer Modus | Einstellungen → Themes |
| Fertig | Nichts Neues — eine Übersicht des Eingerichteten | — |

**Vorerst überspringen** schließt den Assistenten in jedem Schritt und behält, was du schon eingegeben hast.

## Der KI-Schritt

KI ist optional. Wähle eine der drei Karten oder **Überspringen, ohne KI**, das KI ausschaltet,
bis du sie unter [Einstellungen → KI](ai.md) einrichtest:

| Karte | Was sie nutzt | Was sie braucht |
|---|---|---|
| Mein Abo | Claude Code oder Codex, mit deinem Abo angemeldet | Die CLI installiert und angemeldet |
| API-Schlüssel | OpenAI, Anthropic, Gemini, Groq, OpenRouter oder Mistral | Einen Schlüssel des Anbieters |
| Auf meinem Rechner | Ollama oder LM Studio, lokal — nichts verlässt den Rechner | Den gestarteten Server |

Wird Claude Code oder Codex auf diesem Rechner gefunden, nennt die Abo-Karte welches und seine Version, und das Wählen der Karte testet es: ein kurzer Prompt, dann **Getestet: Antwort nach N s. Einsatzbereit.** Wird keins gefunden oder ist die CLI nicht angemeldet, zeigt die Karte dieselbe Verbindungseinrichtung wie [Einstellungen → KI](ai.md).

Bei einem API-Schlüssel oder lokalen Server testet **Weiter** die Verbindung, indem es die Modelle des Anbieters abruft, und speichert nur ein Konto, das geantwortet hat.

Der Schritt speichert ein gewöhnliches KI-Konto, so geschrieben wie die Einstellungen es schreiben, und setzt es **In Verwendung**: Öffne Einstellungen → KI und es ist da — bereit zum Umbenennen, für nur einige Funktionen oder zum Löschen. Mehrere Konten, ein Modell pro Funktion und wie die KI schreibt, stellst du dort ein, nicht im Assistenten.

## Grenzen

- **Der Abo-Test kostet einen Prompt.** Er zählt wie jede Anfrage zur Nutzung deines Abos. Er läuft nur, wenn du die Karte wählst oder **Erneut testen** drückst.
- **Nur Claude Code und Codex werden erkannt.** Gemini CLI und Devin antworten als normale CLI-Konten, die du unter Einstellungen → KI hinzufügst.
- **Ein lokaler Server muss schon laufen.** Der Assistent startet weder Ollama noch LM Studio und lädt keine Modelle herunter.
- **Der Assistent läuft einmal.** Danach liegt alles, was er gesetzt hat, in den Einstellungen; erneut öffnen lässt er sich nicht.
