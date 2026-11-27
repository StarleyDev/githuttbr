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

Die Einstellungen teilen ihre Seiten in zwei Teile. **Dieses Profil** enthält die
Seiten, die sich mit dem Profil ändern — **Profil** und **Integrationen**.
**App** enthält alles andere, das in jedem Profil gilt und das oben auf der Seite
auch sagt.

Die beiden Profilseiten beginnen mit einer Leiste: *Profil bearbeiten* und einer
Auswahl. Die Auswahl bestimmt, welches Profil du **bearbeitest**; sie ändert
nicht das, das die App **verwendet**. Weichen beide ab, sagt es ein bernsteinfarbenes
Band — *Du bearbeitest Arbeit. Die App verwendet Privat* — mit **Dieses Profil
verwenden** zum Wechseln. Das ist der Moment, in dem ein Konto am leichtesten mit
dem falschen Profil verknüpft wird, deshalb nennt die Seite Integrationen das
Profil auch auf jeder Karte und auf dem Knopf selbst: **Mit dem Profil Arbeit
verknüpfen**, und die Bestätigung wiederholt es. Neu und Löschen sind in derselben
Leiste; Löschen fragt vorher.

![Das Profil Arbeit bearbeiten, während die App ein anderes verwendet: das bernsteinfarbene Band und der Verknüpfen-Knopf, der Arbeit nennt](../../screenshots/settings-profile-band.webp)

## Die KI wird geteilt

Ein Profil braucht keine eigene KI: Eine [allgemeine
KI](ai.md#eine-ki-für-alle-profile) bedient jedes Profil, und ein Profil
entscheidet sich nur dann für eine eigene, wenn es muss. Die Wahl gilt für
alles: Ein Profil auf der allgemeinen KI schreibt auch so, wie die allgemeine KI
eingestellt ist — Commit-Stil, eigene Anweisungen, Repository-Chat. Ein Profil,
das einen anderen Stil braucht, bekommt eine eigene KI, eine Kopie der
allgemeinen, die es dann ändern kann. All das wird auf der Seite **KI**
bearbeitet; die Profilseite sagt nur, welche KI das Profil verwendet, und
verlinkt dorthin.

## Jedes Profil, seine eigenen Konten

Neben einem Token kann ein Profil eine Anmeldung **verknüpfen**, die schon auf
dem Rechner liegt — aus dem Credential Helper von git oder der GitHub CLI —
unter Einstellungen → Integrationen. Eine Verknüpfung gehört genau einem Profil:
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
