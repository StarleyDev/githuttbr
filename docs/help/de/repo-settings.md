---
title: Einstellungen pro Repository
category: Workspace-Werkzeuge
order: 94
summary: Anzeigename, Profil, geschützte Branches und Tab-Bild eines Repositorys, dazu seine Regeln, sein Tresor und seine Aktivität.
keywords: repo einstellungen settings geschützte branches protected auswertung analytics operationsprotokoll log historie info zahnrad tab-bild tab image symbol logo bild Anzeigename Alias Profil aus der Liste entfernen vergessen Kennzahlen Projektkonfiguration
source: 6cd23a3db24f4869df7d1b881fb15155bd0a0a8b
---

# Einstellungen pro Repository

Das Zahnrad neben den Werkzeugen in der Symbolleiste öffnet Einstellungen, die
zu **diesem** Repository gehören, nicht zur App.

![Einstellungen pro Repository](../../screenshots/repo-settings.webp)

Die Kopfzeile sagt, welches Repository du gleich änderst: Name, Ordner, aktueller
Branch, das Haupt-Remote (`origin`, wenn es eines gibt) mit dem Host, auf dem es
liegt, und ein paar Zahlen. Die Branch-Zahl stammt aus der schon geladenen Liste.
Die Tresor-Zahl erscheint erst, nachdem du **Tresor** geöffnet hast, denn den
Tresor zu lesen fragt den Schlüsselbund des Systems, und das Öffnen der
Einstellungen sollte das nicht. Eine Commit-Zahl gibt es nicht: eine lange
Historie zu zählen ist ein eigener git-Aufruf, und eine Kopfzeile ist ihn nicht wert.

Die Seiten stehen in einer Seitennavigation, in drei Gruppen:

| Gruppe | Seite | Was sie enthält |
|---|---|---|
| Repository | **Allgemein** | Anzeigename, Profil, geschützte Branches, das Tab-Bild und Aus der Liste entfernen |
| Repository | **Projektkonfiguration** | Die [Regeln, die dieses Repository mitbringt](repo-config.md), in `.githuttbr.json`, und der Doctor, der sie prüft |
| Repository | **Informationen** | Freie Notizen und Felder zu diesem Repository, lokal gespeichert |
| Sicherheit | **Tresor** | Die [Tresor](vault.md)-Einträge dieses Repositorys |
| Aktivität | **Kennzahlen** | Was du in GitHuttBr getan hast, lokal gezählt |
| Aktivität | **Einblicke** | Das [Historien-Dashboard](insights.md) |
| Aktivität | **Vorgangsverlauf** | Commits über die Zeit und wer sie gemacht hat, für die Repositorys, die du geöffnet hast |
| Aktivität | **Protokolle** | Das Vorgangsprotokoll: jeder git-Befehl, den GitHuttBr hier ausgeführt hat, mit Ergebnis |

Das Operationsprotokoll ist das ehrliche: Wenn sich etwas seltsam verhält, zeigt
es den exakten Befehl und den exakten Fehler — damit ein Fehlerbericht Fakten
transportieren kann statt Adjektive.

## Allgemein

Jede Einstellung ist eine Zeile: links, was sie tut, rechts das Bedienelement.
Gespeichert wird erst, wenn du **Speichern** drückst.

| Zeile | Was sie tut | Gespeichert in |
|---|---|---|
| **Anzeigename** | Der Name auf Tabs und in Listen. Der Ordner auf der Festplatte wird nie umbenannt; leer gilt der Ordnername | GitHuttBrs Einstellungen, dieser Rechner |
| **Profil** | Identität, Tokens und KI, zu denen dieses Repository wechselt, wenn sein Tab aktiv ist. **Automatisch** folgt dem aktiven Profil | GitHuttBrs Einstellungen, dieser Rechner |
| **Geschützte Branches** | Warnt vor einem Commit oder Force-Push direkt auf diese Branches | Die git-Konfiguration des Repositorys |
| **Tab-Bild** | Ein kleines Bild auf dem Tab, siehe unten | GitHuttBrs Einstellungen, dieser Rechner |

Hat das Repository eine `.githuttbr.json`, sagt ein Hinweis oben in Allgemein
das und verlinkt auf **Projektkonfiguration**. Diese Regeln reisen mit dem
Repository zu allen, die es klonen; die Zeilen darunter gelten nur für dich.

**Aus der Liste entfernen…** nimmt das Repository aus
[Repositorys](repositories.md). Es fragt vorher, und die Frage sagt, was es nicht
tut: der Ordner auf der Festplatte bleibt unberührt, und ein offener Tab bleibt
offen. Öffnest du das Repository wieder, steht es wieder in der Liste.

## Tab-Bild

Mit zehn offenen Tabs sind Namen, die gleich anfangen — `api`, `api-gateway`,
`api-docs` —, mühsam zu unterscheiden. Ein kleines Bild auf dem Tab findet man
schneller als einen Text.

Klicke unter **Allgemein** in das Bildfeld. Es listet die Bilder des Repositorys
selbst — PNG, JPEG, GIF, WebP, SVG, ICO, BMP und AVIF —, jedes mit Vorschaubild,
Dateien mit Namen wie Logo oder Icon zuerst. Tippe zum Eingrenzen (`logo dark`
findet `assets/logo-dark.png`), bewege dich mit den Pfeiltasten und wähle mit
Enter; oder gib einen Pfad von Hand ein. Der Pfad wird **relativ zum
Repository-Stamm** gespeichert, das Bild folgt dem Repository also, wo immer sein
Ordner liegt.

Was der Tab zeigt, ist eine App-weite Einstellung unter **Einstellungen →
Allgemein → Repository-Tabs zeigen**:

| Option | Der Tab zeigt |
|---|---|
| **Bild und Name** (Standard) | Das Bild anstelle des Ordnersymbols, dann den Namen |
| **Nur Name** | Ordnersymbol und Namen, als wäre kein Bild gesetzt |
| **Nur Bild** | Nur das Bild; der Name wandert in den Tooltip |

Grenzen, die man kennen sollte:

- Die Liste enthält die Dateien, die git sieht — versionierte und
  unversionierte, keine ignorierten — und höchstens 40 auf einmal; tippe, um
  den Rest zu erreichen. Ein ignoriertes Bild lässt sich trotzdem von Hand
  eintragen.
- Bilder über 1 MB oder unlesbare erscheinen ausgegraut und sind nicht
  wählbar: ein 20-Pixel-Symbol braucht nicht mehr.
- Ein Repository **ohne** Bild zeigt immer seinen Namen, egal welche Option
  gewählt ist — ein leerer Tab wäre nicht zu erkennen.
- Ist der Pfad **kaputt** — Datei gelöscht, umbenannt, kein Bild oder zu groß —,
  fällt der Tab still auf den Namen zurück, und diese Einstellungsseite zeigt
  unter dem Pfad eine Warnung. Sonst beschwert sich nichts.
- Das Bild wird einmal pro Sitzung gelesen. Ersetzt du die Datei unter gleichem
  Namen, öffne diese Einstellungsseite erneut, um es neu zu laden.
- Die Einstellung liegt in GitHuttBrs eigenen Einstellungen auf diesem Rechner,
  nicht im Repository; Teammitglieder erben sie also nicht.

**Siehe auch:** [Sicherheit & Geheimnisse](security.md) · [Einblicke](insights.md)
