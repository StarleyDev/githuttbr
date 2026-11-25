---
title: Sicherheit & Geheimnisse
category: Sicherheit
order: 70
summary: Maskierung, Wächter, der Schlüsselbund — und was Gitcito sich weigert zu tun.
keywords: sicherheit geheimnisse secrets maskierung masking schlüsselbund keychain safeStorage tokens geschützter branch protected branch große datei large file wächter guard privatsphäre
---

# Sicherheit & Geheimnisse

Gitcito hat **kein Backend**. Die einzigen Netzwerkaufrufe gehen an deinen
Git-Host und, falls du es einschaltest, an deinen KI-Anbieter.

![Sicherheitseinstellungen](../../screenshots/settings-security.webp)

## Geheimnisse maskieren

Werte in `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` und Verwandten
werden in Diff-, Datei- und Blame-Ansicht als `KEY=••••••` dargestellt, damit
ein geteilter Bildschirm oder ein Screenshot sie nicht ausplaudern kann.
Apple-Signaturmaterial zählt dazu: `*.mobileprovision`,
`*.provisionprofile`, `*.p12` und die `*.p8`-Schlüssel für App Store Connect.
Ein `*.cer` nicht — ein Zertifikat ist von Haus aus öffentlich.

Das ist **reine Anzeige**: Die Datei wird nie verändert, und was du stagest,
auch nicht. Ein Augen-Schalter deckt sie pro Ansicht auf. `.env.example`,
`.sample` und `.template` gelten als Vorlagen, nicht als Geheimnisse.

![Eine .env mit maskierten Werten und dem Schalter zum Aufdecken](../../screenshots/secret-masking.webp)

## Wächter, bevor du Schaden anrichtest

| Wächter | Wann |
|---|---|
| **Geheimnisdatei** | Du committest etwas, das nach einem Zugangsdatum aussieht — mit *Ignorieren & nicht mehr verfolgen* auf einen Klick |
| **Große Datei** | Du committest einen übergroßen Blob (Schwellwert unter Einstellungen → Sicherheit) |
| **Build-Müll** | `xcuserdata/`, `DerivedData/` oder eine `.DS_Store` committen — mit demselben *Ignorieren & aus der Versionierung nehmen* mit einem Klick |
| **Geschützter Branch** | Du committest direkt auf `main`/`master` oder erzwingst dort einen Push |
| **Getrackte Geheimnisse** | Du pushst ein Repository, das eine Geheimnisdatei *trackt* — einmal pro Sitzung gewarnt |

## Der Schlüsselbund des Betriebssystems

Tokens und [Tresor](vault.md)-Einträge werden mit dem Schlüsselbund deines
Betriebssystems verschlüsselt (Electron `safeStorage`), niemals mit einem
Schlüssel in der Einstellungsdatei.

**Nichts rührt den Schlüsselbund an, bevor du es sagst.** Noch bevor der
Berechtigungsdialog des Systems auftauchen kann, erklärt Gitcito, was gespeichert
wird, was es nicht kann (eine App liest immer nur den Eintrag zurück, den sie
selbst angelegt hat — deine anderen Passwörter sind unerreichbar) und dass Nein
sagen völlig in Ordnung ist: Tokens leben dann nur für die Sitzung im
Arbeitsspeicher, der Tresor bleibt zu, und du kannst es später unter
**Einstellungen → Sicherheit → Schlüsselbund des Betriebssystems** einschalten.

Eine frische Installation macht **null** Aufrufe an den Schlüsselbund, bis
tatsächlich etwas gespeichert werden muss.

Solange er aus ist, sagt das Token-Feld unter Integrationen es an — *Nur gespeichert, bis du Gitcito beendest: der System-Schlüsselbund ist aus.* — mit einer Schaltfläche **Aktivieren** daneben. Ihn dort oder hier einzuschalten speichert auch die Tokens, die du in dieser Sitzung schon eingegeben hast; nichts muss neu eingefügt werden.

### Linux ohne Schlüsselbund

Unter Linux ist der Schlüsselbund ein Secret Service — GNOME Keyring oder
KWallet. Läuft keiner, „verschlüsselt“ das System trotzdem, aber mit einem
festen Passwort, das auf jedem Rechner gleich ist: Tokens und Schlüssel sind
nur verschleiert, nicht geschützt. Einstellungen → Sicherheit sagt das unter dem
Status des Schlüsselbunds — *Es läuft kein Schlüsselbund…* —, damit das Wort
*Schlüsselbund* nie für einen Schutz steht, den es nicht gibt.

Damit nichts Neues in einem Speicher landet, den jeder entschlüsseln könnte, wird
ein Token, das du eingibst, während kein Schlüsselbund läuft, **nur bis zum
Beenden** behalten. Das Token-Feld sagt es — *Nur bis zum Beenden von Gitcito
gespeichert: Es läuft kein Schlüsselbund…* — ohne Schaltfläche zum erneuten
Versuchen, weil ein neuer Versuch nichts bringt; nur ein Schlüsselbund hilft.
Vorher gespeicherte Tokens bleiben lesbar — du wirst nie von ihnen
ausgesperrt —, und ein Token zu leeren oder zu ersetzen entfernt den alten Wert
weiterhin von der Festplatte. Zwei Grenzen: Der Schlüssel der allgemeinen KI
wird nicht in seinen gemeinsamen Platz verschoben (jedes Profil liest weiter
seinen eigenen), und der Tresor speichert weiterhin im einfachen Speicher, weil
er keinen Modus nur für die Sitzung hat. Installiere oder entsperre einen Schlüsselbund
und starte Gitcito neu, um neue Tokens wieder dauerhaft zu speichern.

## Einstellungen importieren

**Einstellungen → Import / Export** bringt Einstellungen, Profile und Themes
von einem Rechner auf den anderen. Der Standardexport enthält **keine Tokens
und keine API-Schlüssel**, und der Import einer solchen Datei rührt deine
gespeicherten nie an — ein leeres Token in der Datei heißt „nicht in dieser
Datei“, nicht „lösch meins“.

### Auswählen, was importiert wird

Eine Einstellungsdatei enthält zweierlei: was *dir* folgt (Profile, Theme,
Tastenkürzel) und was nur auf dem Rechner Sinn ergibt, der sie geschrieben hat
(die Ordner, in denen deine Repositories liegen, der Pfad deines Terminals).
Alles auf einem neuen Computer anzuwenden füllt die Seitenleiste mit Tabs, die
ins Leere zeigen. Deshalb fragt nach der Wahl der Datei (und der Eingabe ihres
Passworts, falls sie eines hat) ein Dialog, welche Teile übernommen werden.
Nichts wird angewendet, bevor du **Importieren** drückst; **Abbrechen** lässt
alles, wie es war.

![Einstellungen → Daten → Importieren: vier Teile, die Repositories nicht angehakt, weil keiner ihrer Ordner hier existiert, und die Pfadübersetzung geöffnet](../../screenshots/settings-import.webp)

| Teil | Was er enthält |
|------|-----------------|
| **Profile und Konten** | Profile, Git-Identität, Integrationsverknüpfungen, die allgemeinen KI-Einstellungen und Profilbilder — und die Zugangsdaten und den [Tresor](vault.md), wenn die Datei sie enthält |
| **App-Einstellungen** | Theme, Sprache, Tastenkürzel, Layout, die Farben von Graph und Symbolen |
| **Repositorys und Workspaces** | Tabs, Workspaces, Favoriten, Spitznamen, Tab-Bilder, welches Profil jedes Repository nutzt, gescannte Ordner sowie die Notizen und Wikis pro Repository |
| **Programme auf diesem Computer** | Terminal, externer Editor, Standard-Apps und der Pfad der KI-CLIs |

Jeder Teil zeigt, wie viele Einträge die Datei dafür hat. Ein Teil, den du
nicht anhakst, bleibt auf diesem Rechner genau, wie er ist.

**Profile werden mit deinen zusammengeführt.** Eine Datei von einem anderen
Computer hat selten jedes Profil, das dieser hat — ein Konto, das auf dem
Linux-Laptop hinzukam, ein Kundenprofil, das es nur auf dem Mac gibt. Deshalb
fügt **Profile und Konten** die Profile der Datei zu deinen hinzu, statt die
Liste zu ersetzen. Vor dem Import listet der Teil jedes Profil auf und was mit
ihm geschieht:

| Markierung | Bedeutung |
|-----|---------|
| **Aktualisiert** | Das Profil gibt es auf beiden Seiten: Identität, KI und Bild aus der Datei ersetzen deine, und ihre Server kommen zu deinen hinzu |
| **Neu** | Nur die Datei hat es: wird nach deinen angefügt |
| **Bleibt** | Nur dieser Computer hat es: bleibt genau, wie es ist |

Zwei Profile sind „dasselbe“, wenn sie eine ID teilen — das erste Profil jeder
Installation tut das. Passt keine ID, zählt der Name (ohne Rücksicht auf
Groß-/Kleinschreibung und umgebende Leerzeichen), und das Profil behält **die
ID dieses Computers**: Die daran gebundenen Repositories, das aktive Profil,
seine gespeicherten Zugangsdaten und sein Bild bleiben verknüpft. Welches
Profil aktiv ist, ändert sich nicht.

**Alle ersetzen** gibt es weiterhin, für ein Backup, das du genau so
zurückhaben willst, wie es war: Nur die Profile der Datei bleiben, und die, die
nur dieser Computer hat, werden durchgestrichen als **Entfernt** aufgeführt.
Ein Druck auf **Importieren** fragt dann noch einmal nach und nennt sie — sie
gehen mit ihren gespeicherten Zugangsdaten und ihrem Bild, und das lässt sich
nicht rückgängig machen. Mit **Alle ersetzen** wird das aktive Profil der Datei
zum aktiven Profil.

Grenzen: Abgeglichen wird nur über ID oder exakten Namen — ein auf einer Seite
umbenanntes Profil zählt als neu, und du hast am Ende beide. Ein zugeordnetes
Profil übernimmt die Felder der Datei, mit drei Ausnahmen, damit nichts verloren
geht, was nur dieser Computer hat: Seine GitHub-Enterprise-, GitLab- und
Bitbucket-Server werden zu deinen **hinzugefügt** (bei einem Server, den beide
haben, gewinnt der Eintrag aus der Datei); ein Token, das die Datei leer
mitbringt, behält deins — aber nur für dieselbe Instanz, sodass ein Token nie
an ein anderes Forgejo, einen anderen GitLab-Aussteller oder eine andere
Azure-Organisation geht; und die Anmeldungen, die vom Credential Helper dieses
Rechners stammen, bleiben die dieses Rechners.

**Die Voreinstellungen sind eine Vermutung anhand deiner Festplatte.** Bevor
der Dialog erscheint, prüft Gitcito, ob die Repository-Ordner aus der Datei
hier existieren. Existiert keiner, stammt die Datei von einem anderen Computer:
**Repositorys** und **Programme** sind anfangs nicht angehakt, jeweils mit
Begründung — die Pfade der Programme werden aufgelistet, damit du siehst, dass
sie woandershin gehören. Existieren sie, ist es derselbe Computer (etwa ein
zurückgespieltes Backup), alles ist anfangs angehakt und ein grüner Hinweis
sagt das. Eine Datei ganz ohne Repositories wird stattdessen nach ihren
Programmpfaden beurteilt: **Programme** ist anfangs nur angehakt, wenn jeder
davon hier existiert.

Schlägt die Prüfung selbst fehl, wird nichts geraten: **Repositorys** und
**Programme** sind anfangs ohne Urteil nicht angehakt, eine Schaltfläche
**Erneut prüfen** fragt die Festplatte noch einmal, und **Repositorys** lässt
sich erst importieren, wenn eine Prüfung gelingt. Die anderen Teile schon.

**Pfade übersetzen.** Hake **Repositorys** bei einer Datei an, deren Ordner
fehlen, und ein Feld **Pfade übersetzen** öffnet sich. Links der Ordner, den die
Repositories der Datei gemeinsam haben (`/home/you/code`); rechts, wo dieser
Ordner auf diesem Computer liegt, vorausgefüllt aus deinem Home-Ordner
(`/Users/you/code`). Beide sind editierbar — die Vermutung kann falsch sein, und
findet Gitcito keinen gemeinsamen Ordner, lässt es beide leer, damit du sie
eintippst. Ein Balken zählt beim Tippen, wie viele Repositories jetzt hier einen
Ordner haben, und listet einige davon — grün gefunden, rot noch fehlend. Der
Tausch nimmt Spitzname, Tab-Bild und Profil des Repositorys mit, dazu seine
Notizen, Wikis und Tresor-Einträge, sodass nichts von Hand neu eingestellt
werden muss.

Die Fußzeile fasst es zusammen — *3 von 4 Teilen importieren · 31 Ordner*
(Scan-Wurzeln und der letzte Klon-Ordner zählen mit, deshalb heißt es Ordner
und nicht Repositories) —, und **Importieren** bleibt aus, bis mindestens ein
Teil angehakt ist.

**Importieren bleibt auch aus, wenn eine Übersetzung nichts findet.** Mit
angehaktem **Repositorys** und keinem einzigen Ordner unter dem neuen Präfix
würde der Import deine Repositories leer zurücklassen; korrigiere die Pfade oder
wähle den Teil ab.

Grenzen der Übersetzung:

- Es ist **ein Präfix gegen ein anderes getauscht**. Repositories, die in der
  Datei unter einem anderen Ordner liegen oder hier anders angeordnet sind,
  werden nicht gefunden; eine Zuordnung pro Repository gibt es nicht.
- Mit aktiver Übersetzung werden **nur die Repositories importiert, die danach
  einen Ordner haben**. Der Rest bleibt außen vor — nicht als kaputte Tabs
  hinzugefügt —, und der Dialog sagt dir, wie viele.
- Programme werden nie übersetzt: `/usr/bin/code` hat auf einem anderen System
  kein verlässliches Gegenstück. Lass diesen Teil abgewählt und stelle sie in den
  Einstellungen ein.
- Wenn du eines der beiden Präfixe leerst, werden die Pfade so importiert, wie
  sie in der Datei stehen.

**Während des Imports** lässt sich der Dialog nicht schließen. Scheitert ein
späterer Schritt — die Repository-Notizen, der Tresor, die Profilbilder —,
bleibt der Dialog offen, nennt den Schritt, und **Import fortsetzen** macht dort
weiter, ohne die früheren Schritte erneut zu schreiben.

### Zugangsdaten in der Datei

Eine mit der Option exportierte Datei enthält Zugangsdaten. Das Zusammenführen
von Profilen **fügt** sie immer **hinzu**: Die der Datei werden unter dem
passenden Profil abgelegt und ersetzen die für dasselbe Konto, und alle anderen
gespeicherten Zugangsdaten bleiben — sie zu löschen widerspräche dem Behalten
deiner Profile. Stehen die Profile auf **Alle ersetzen**, zeigt eine solche
Datei außerdem die Wahl, direkt unter **Profile und Konten**:

| Auswahl | Deine gespeicherten Zugangsdaten |
|--------|------------------------|
| **Hinzufügen** | Die der Datei kommen hinzu und ersetzen die für dasselbe Konto; alle anderen bleiben |
| **Alle ersetzen** | Werden genau die der Datei — jedes gespeicherte Token und jeder API-Schlüssel, den die Datei nicht hat, wird gelöscht |

Die Wahl gilt zusammen mit den Profilen: Ist **Profile und Konten** nicht
angehakt, werden keine Zugangsdaten importiert oder entfernt. Eine ohne die
Option exportierte Datei hat keine anzubieten, egal was du anhakst. **Alle
ersetzen** fragt beim Druck auf **Importieren** noch einmal nach und sagt, dass
jedes gespeicherte Token und jeder API-Schlüssel, den die Datei nicht hat,
gelöscht wird; **Abbrechen** dort lässt den Dialog, wie er war.

**Alle ersetzen braucht den Schlüsselbund.** Ist der Schlüsselbund aus oder
nicht verfügbar, blieben die alten Tokens im verschlüsselten Speicher und kämen
beim nächsten Start zurück — deshalb verweigert Gitcito es: Es sagt das, und
nichts wird importiert. Dasselbe gilt, solange die gespeicherten Tokens nicht
gelesen werden können: Sie kämen zurück, sobald sie es könnten. **Hinzufügen**
funktioniert weiterhin und behält die Tokens der Datei für die Sitzung.

**Die Grenze:** Zugangsdaten gehören zu einem Profil. Ein Profil, das der Import
entfernt, nimmt seine gespeicherten Tokens mit, egal was du wählst.

## Sicher teilen

[Sicheres Teilen](secure-share.md) exportiert Einstellungen, Tresor-Einträge
oder ganze Workspaces als **verschlüsseltes Paket** — Geheimnisse kommen
ausschließlich dann hinein, wenn du das Häkchen setzt.

**Siehe auch:** [Tresor](vault.md) · [Sicheres Teilen](secure-share.md)
