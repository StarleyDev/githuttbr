---
title: Profile
category: Anpassen
order: 101
summary: Getrennte Identitäten und Tokens für die Arbeit und alles andere.
keywords: profil profile identität identity git user email e-mail tokens konten accounts wechseln switch
---

# Profile

Ein Profil bündelt eine **Git-Identität** (Name und E-Mail) mit ihren
**Integrations-Tokens**. Wechselst du das Profil, wechseln beide zusammen —
Commits bekommen die richtige Autorschaft, und API-Aufrufe nutzen das richtige
Konto.

Nützlich, wenn dieselbe Maschine dienstliche und private Repositorys bedient,
oder wenn du zwei GitHub-Konten hast.

![Ein Profil: Git-Identität auf der einen Seite, die Integrations-Tokens auf der anderen](../../screenshots/settings-profiles.webp)

## Ein Profil bearbeiten, ein Profil verwenden

Zwei Seiten der Einstellungen ändern sich mit dem Profil — **Profil & Identität** und **Verbundene Konten**, oben in der Gruppe **Du**, deren Überschrift das bearbeitete Profil nennt. Alle anderen Seiten gelten in jedem Profil und sagen das oben.

**Profil & Identität** beginnt mit der Profilkarte: Bild, Name (direkt bearbeitbar), *in Verwendung*, wenn die App es nutzt, die Auswahl und **Neues Profil**. **Verbundene Konten** beginnt mit derselben Auswahl in einer Leiste, *Profil bearbeiten*. Die Auswahl bestimmt, welches Profil du **bearbeitest**; sie ändert nicht das, das die App **verwendet**. Weichen beide ab, sagt es ein bernsteinfarbenes Band, mit **Dieses Profil verwenden** zum Wechseln. In diesem Moment wird ein Konto am leichtesten mit dem falschen Profil verknüpft, deshalb nennt Verbundene Konten das Profil auch auf jeder Karte und auf der Schaltfläche selbst, und die Bestätigung wiederholt es. Ein Profil löschst du an derselben Stelle, mit Rückfrage.

Unter der Karte folgen die Git-Identität und das Signieren von Commits. Ist ein Repository offen, das als jemand anderes committet — seine Git-Konfiguration nennt einen anderen Autor —, sagt es eine Zeile, mit **Identität auf das aktuelle Repo anwenden**; stimmen beide überein, gibt es nichts anzuwenden und die Zeile fehlt. Danach kommen das Profilbild, eine Übersicht seiner **verbundenen Konten** — eine Zeile pro Host mit *Verbunden*, *Token abgelaufen oder Fehler*, *Nicht erreichbar* oder *Nicht verbunden* und **Verbinden** oder **Erneuern**, die Verbundene Konten auf diesem Host öffnen — und welche KI das Profil nutzt.

Die Übersicht prüft leise, ohne Anmeldefenster, bei jedem Öffnen der Seite und bei jeder Token-Änderung; sie fragt nie regelmäßig nach. Was sie findet, nutzt auch das Seitenmenü: **Verbundene Konten** zeigt eine kleine Warnzahl, wenn ein Token abgelehnt wurde oder fehlschlug, und nur für Prüfungen, die die Einstellungen ohnehin gemacht haben. Ein nicht erreichbarer Host zählt nicht — das Token kann in Ordnung sein.

![Das Profil Arbeit bearbeiten, während die App ein anderes verwendet: das bernsteinfarbene Band und der Verknüpfen-Knopf, der Arbeit nennt](../../screenshots/settings-profile-band.webp)

## Die KI wird geteilt

Ein Profil braucht keine eigene KI: Eine [allgemeine
KI](ai.md#eine-ki-für-alle-profile) bedient jedes Profil, und ein Profil
entscheidet sich nur dann für eine eigene, wenn es muss. Die Wahl gilt für
alles: Ein Profil auf der allgemeinen KI schreibt auch so, wie die allgemeine KI
eingestellt ist — Commit-Stil, zusätzliche Regeln für Commits, Repository-Chat. Ein Profil,
das einen anderen Stil braucht, bekommt eine eigene KI, eine Kopie der
allgemeinen, die es dann ändern kann. All das wird auf der Seite **KI**
bearbeitet; die Profilseite sagt nur, welche KI das Profil verwendet, und
verlinkt dorthin.

## Jedes Profil, seine eigenen Konten

Neben einem Token kann ein Profil eine Anmeldung **verknüpfen**, die schon auf
dem Rechner liegt — aus dem Credential Helper von git oder der GitHub CLI —
unter Einstellungen → Verbundene Konten. Eine Verknüpfung gehört genau einem Profil:
Ein neues Profil startet getrennt, und ein Konto, das ein anderes Profil schon
hält, wird abgelehnt. So können zwei Profile zwei GitHub- (oder Azure-DevOps-)
Konten nebeneinander haben. Siehe [Hosting](hosting.md).

## Bindung pro Repository

Ein Repository kann an ein Profil **gebunden** werden, sodass ein
Hintergrund-Fetch darauf sich immer mit dem richtigen Konto authentifiziert —
auch dann, wenn du gerade auf ein Repository schaust, das zum anderen gehört.

Tokens liegen in deinem [Schlüsselbund des Betriebssystems](security.md),
niemals in der Einstellungsdatei.

**Siehe auch:** [Sicherheit & Geheimnisse](security.md) · [Hosting](hosting.md)
