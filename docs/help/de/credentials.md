---
title: Credential Helper
category: Sicherheit
order: 73
summary: Gits eigener Passwortspeicher — der dritte — und warum https dich immer wieder fragt.
keywords: credential helper passwort https fragt wieder osxkeychain wincred manager libsecret store cache git-credentials klartext plaintext vergessen widerrufen revoked token 401 anmeldung prüfen welches konto token in der remote-url eingebettetes passwort aus der url entfernen token in remote url embedded password invalid username or token authentication failed set-url
source: a0a28af33433dfe90ae3dfb2e99a003c13ae5f36
---

# Credential Helper

GitHuttBr verwaltet drei verschiedene Arten von Geheimnissen, und man nimmt
verständlicherweise an, es sei ein und dasselbe:

| | Verwaltet von |
|---|---|
| API-Tokens der Hoster — PRs, Issues, CI-Checks | GitHuttBr, in deinem [OS-Schlüsselbund](security.md) |
| `git@…`-Transport | Deinem [SSH-Schlüssel](ssh-keys.md), über den ssh-Agent des Systems |
| **`https://`-Transport** | **Gits eigenem Credential Helper** |

Der dritte gilt niemandem als Feature, bis er schiefgeht — und dann produziert
er die zwei häufigsten Beschwerden in git: *Warum fragt es mich schon wieder?*
und *Warum schickt es immer noch das Token, das ich widerrufen habe?*

`⌘K` → **Credential Helper**.

![Der konfigurierte Helper, Regeln pro Host und die Warnung zur Klartextdatei](../../screenshots/credentials.webp)

## Was du hier siehst

Jeden konfigurierten `credential.helper`, in dem Scope, aus dem er stammt —
`system`, `global`, dann dieses Repository. **Helper stapeln sich**: git fragt
jeden der Reihe nach, und einer auf Repository-Ebene ersetzt keinen globalen.

Jeder wird gegen deine Maschine geprüft:

| Kennzeichen | Bedeutet |
|------|-------|
| **bereit** | Das Helper-Programm existiert und wird laufen |
| **nicht installiert** | Konfiguriert, aber das Programm fehlt — jede Abfrage fällt darauf zurück, dass du es erneut tippst |
| **Passwörter in einer Klartextdatei** | Der `store`-Helper (siehe unten) |

**Regeln für bestimmte Hosts** listet die `credential.<url>.*`-Abschnitte auf.
Diese schlagen die einfache Einstellung für die URLs, auf die sie passen, und
sind meist die Antwort auf „Warum verhält sich ausgerechnet dieser Host anders?“.

## Einen auswählen

| Helper | Wohin das Passwort geht |
|--------|------------------------|
| `osxkeychain` | macOS Keychain — verschlüsselt, pro Benutzer |
| `manager` | Git Credential Manager (Windows, plattformübergreifend) |
| `wincred` | Windows Credential Manager |
| `libsecret` | Der Linux-Secret-Service (GNOME Keyring, KWallet) |
| `cache` | Arbeitsspeicher, für 15 Minuten. Nichts auf der Platte |
| `store` | **Eine Klartextdatei in deinem Home-Verzeichnis. Unverschlüsselt** |

GitHuttBr bietet an, was auf dieser Maschine tatsächlich installiert ist,
markiert den, der zu deinem Betriebssystem passt, und graut den Rest aus.

**Der Scope zählt.** *Für jedes Repository* schreibt in deine globale
Konfiguration, und das willst du fast immer; *nur für dieses Repository* ist für
das eine seltsame Repo gedacht, das sich gegen etwas anderes authentifiziert.

## Der `store`-Helper und `~/.git-credentials`

`store` schreibt Zeilen der Form `https://user:password@host` nach
`~/.git-credentials`, im Klartext, ohne jede Verschlüsselung. Alles, was unter
deinem Benutzer läuft, kann sie lesen: ein Skript, das postinstall einer
Abhängigkeit, irgendetwas.

Existiert diese Datei, sagt diese Seite das und zählt die Einträge. Sie zeigt
sie nie an — die Zahl ist der ganze Punkt, und die Inhalte zum Anzeigen
auszulesen wäre derselbe Fehler noch einmal.

Wenn du eine findest und das nicht wolltest: Wähle hier einen echten Helper,
lösche dann die Datei und authentifiziere dich einmal neu.

## Eine gespeicherte Anmeldung vergessen

Wird ein Token widerrufen oder rotiert, reicht der Helper weiterhin das alte
heraus, und jeder Push scheitert an einem 401, der nichts benennt. **Vergessen**
bittet den konfigurierten Helper, seinen Eintrag für diesen Host zu löschen —
`git credential reject`, gits eigener dokumentierter Weg.

Dabei wird unterwegs nichts gelesen: GitHuttBr ruft niemals `git credential fill`
auf, den Befehl, der ein gültiges Passwort auf die Standardausgabe schreiben
würde.

Der nächste Push fragt dich einmal, und der Helper speichert die neue Antwort.

## Welches Konto ein Push verwendet

Jede Push-URL wird einzeln geprüft. Ein Schreib-Scope ist nur eine Fähigkeit des Tokens. Mitgliedschaft im Repository, Branch-Regeln und die Berechtigung, eine bestimmte Datei zu ändern, werden nicht getestet. Öffentliche Lesezugriffe können ohne Anmeldedaten gelingen.

![Prüfung der Remote-Anmeldung](../../screenshots/remote-sign-in.webp)

Ein Push kann sich auf mehrere Arten anmelden: mit dem Token eines Profils, einer
mit einem Profil verknüpften GitHub-CLI-Anmeldung, gits eigenem Helper, einem in
der Remote-URL vergessenen Passwort oder einem SSH-Schlüssel. Wird er abgelehnt,
musst du zuerst wissen, welche davon er benutzt hat. Rechtsklick auf ein Remote in
der Seitenleiste und **Anmeldung prüfen…** wählen (oder *Anmeldung der Remotes
prüfen* in der Befehlspalette). Die Prüfung ermittelt die Anmeldedaten genauso wie
ein Push und fragt dann den Host danach:

| Sie zeigt | Woher es kommt |
|----------|--------------------|
| Die Quelle und das [Profil](profiles.md) dahinter | Dieselbe Rangfolge, die ein Push anwendet — das an das Repository gebundene Profil, sonst das aktive, sonst gits Helper |
| Das Konto | Die eigene Antwort des Hosts (`/user`), nicht das, was in den Einstellungen eingetippt wurde |
| Die Scopes | GitHubs Header `X-OAuth-Scopes`; GitLabs Beschreibung seines eigenen Tokens |
| Was sie erlauben | Schreibbezogene Token-Scopes (`repo` auf GitHub, `write_repository` auf GitLab) und auf GitHub, ob `.github/workflows` geändert werden darf |

Sie markiert außerdem Anmeldedaten, die der Host ablehnt (abgelaufen oder
widerrufen), ein verknüpftes Konto, das nicht mehr angemeldet ist, und ein
Passwort, das im Klartext in der Remote-URL steht.

**Grenzen.** Ein fein granuliertes GitHub-Token listet seine Berechtigungen nicht
auf, also erscheint, ob es pushen darf, als unbekannt, bis ein Push es versucht.
Forgejo meldet das Konto, aber nicht die Berechtigungen des Tokens. Azure DevOps
und Bitbucket werden nur mit Quelle und Profil gezeigt. SSH-Remotes werden nicht
getestet, aber [SSH-Schlüssel](ssh-keys.md) listet, was der Agent hält. Die Prüfung
fragt gits Helper stillschweigend: Ein Helper, der ein Anmeldefenster bräuchte, zählt
als leer.

## Ein in der Remote-URL gespeichertes Passwort

Ein alter Klon oder eine aus einem Wiki eingefügte URL kann ihre Anmeldedaten in der
Adresse tragen: `https://user:token@git.example.test/team/app.git`. **Ein Passwort in
der URL hat immer Vorrang:** git sendet es und fragt überhaupt keinen Helper — nicht
das Token des [Profils](profiles.md) des Repositorys, nicht die GitHub CLI, nicht
gits eigenen Speicher. Solange das Token funktioniert, ist das in Ordnung, und
GitHuttBr lässt es in Ruhe: **Es entfernt nie ein Passwort aus einer URL, ohne dich zu
fragen.** Sobald das Token widerrufen wird oder abläuft, scheitert jedes Fetch, Pull
und Push genau dieses Repositorys mit *Invalid username or token* oder
*Authentication failed*, während die anderen Repositorys mit demselben Profil
funktionieren. Und das Token steht im Klartext in der `.git/config` des Repositorys.

![Ein gespeichertes Token aus einer Remote-URL entfernen](../../screenshots/remote-url-token.webp)

GitHuttBr liest die Fetch- und Push-URLs jedes Remotes und sagt es an drei Stellen:

| Wo | Was du siehst |
|-------|--------------|
| Ein fehlgeschlagenes Fetch, Pull oder Push | Der Fehler erklärt, dass die URL des Remotes ein gespeichertes Passwort enthält, mit **Aus der URL entfernen…** |
| Die Seitenleiste | Ein unauffälliges Schlüsselsymbol in der Zeile des Remotes: Seine URL enthält ein Passwort, das Vorrang vor dem Token des Profils hat. Dieselbe Aktion steht in seinem Kontextmenü |
| **Anmeldung prüfen…** | Das Remote zeigt das Passwort als seine Quelle, mit demselben Button |

Die Aktion fragt zuerst. Sie nimmt das Passwort aus jeder URL dieses Remotes — der
Fetch-URL und jeder Push-URL, die eines enthält — und schreibt nichts außer
`.git/config`. Was danach passiert, hängt davon ab, was sich sonst anmelden kann:

| Nach dem Entfernen | Was Fetch und Push verwenden |
|---------------|-------------------------|
| Das Profil des Repositorys hat ein Token oder ein verknüpftes Konto für diesen Host | Dieses Token — die Bestätigung sagt nichts weiter |
| Kein Profil-Token, aber gits eigener Helper hat eine Anmeldung für den Host | Die Anmeldung des Helpers |
| Keines von beiden | Nichts: Fetch und Push scheitern, bis du ein Token hinzufügst. Die Bestätigung sagt das zuerst und bietet **Zuerst ein Token hinzufügen** an, was Einstellungen → Verbundene Konten öffnet |

Wenn sie aus einer fehlgeschlagenen Operation heraus gestartet wurde, bietet sie
**Erneut versuchen** an.

**Es gibt absichtlich kein Rückgängig.** Rückgängigmachen würde das Geheimnis im
Klartext zurück in die Datei schreiben, und genau das soll die Aktion verhindern.
Wenn das alte Token noch funktionieren könnte, widerrufe es auf dem Server: Es war für
alles lesbar, was den Repository-Ordner lesen konnte.

**Grenzen.**

- Der Benutzername verschwindet ebenfalls (`https://git.example.test/…`), wie wenn du
  `git remote set-url` von Hand ausführst; die Bestätigung sagt das. Ein Server, der
  ihn in der URL braucht — ein Bitbucket-Data-Center-Token ohne Benutzernamen im
  Profil —, braucht ihn mit **Remote bearbeiten…** wieder eingetragen.
- Ein Benutzername allein (`https://user@host/…`) wird nicht markiert: git fragt den
  Helper weiterhin nach dem Passwort dieses Benutzers, also ist nichts Geheimes
  gespeichert.
- SSH-URLs bleiben unberührt: `git@host:…` und `ssh://git@host/…` nennen die
  Anmeldung, die ssh verwendet, keine Anmeldedaten.
- Das Präfix eines Remote-Helpers (`persistent-https::https://…`, `gcrypt::…`) bleibt
  erhalten; die URL danach wird gelesen und bereinigt wie jede andere.
- **Mehrdeutige URLs werden nicht zum Entfernen angeboten.** Wenn Leser sich uneinig
  sind, wo der Host beginnt — ein `@` nach einem `?` oder `#` in der Adresse, oder ein
  Passwort mit einem unkodierten `/` —, würde ein Schnitt am falschen `@` das Remote
  auf einen anderen Server zeigen lassen. Eine solche URL wird nur geschwärzt
  angezeigt, und das Schlüsselsymbol öffnet **Remote bearbeiten…**, damit du sie von
  Hand korrigierst.
- Nur `.git/config` wird gelesen und geändert. Eine durch eine
  `url.<base>.insteadOf`-Regel umgeschriebene URL oder ein in deiner globalen
  Konfiguration definiertes Remote wird nicht untersucht — und das Umbenennen eines
  Remotes kopiert nie ein Passwort, das eine `insteadOf`-Regel hinzufügt, in die
  Konfiguration des Repositorys.
- Das Passwort verlässt nie den Hauptprozess: Remote-URLs erreichen das Fenster, das
  Menü zum Kopieren der URL und den Bearbeiten-Dialog ohne es. Den Bearbeiten-Dialog
  mit der angezeigten URL zu speichern ändert nichts und behält das Passwort; **Host
  oder Pfad zu ändern lässt es fallen**, da die eingegebene URL so geschrieben wird,
  wie sie ist. Nur diese Aktion entfernt ein Passwort und behält die Adresse.

## Grenzen, die man kennen sollte

- **Das ist gits Speicher, nicht GitHuttBrs.** Ihn zu ändern ändert auch, was dein
  Terminal tut — was genau der Sinn ist, aber man sollte es wissen, bevor man
  ihn ändert.
- **Helper auf Systemebene werden angezeigt, sind aber nicht editierbar.** Sie
  stehen in einer Konfiguration, die nur ein Administrator schreiben kann.
- **GitHuttBr kann nicht auflisten, was ein Helper vorhält.** Keine
  Credential-API gibt das preis, ohne die Geheimnisse selbst herauszugeben —
  also meldet der Dialog die Konfiguration und löscht auf Anforderung, und sonst
  nichts.
- **Ein Token, das du GitHuttBr gegeben hast, ist davon getrennt.** Eines zu
  widerrufen rührt das andere nicht an; siehe [Sicherheit](security.md) für die
  Schlüsselbund-Seite.
- **Das Token eines Profils bleibt aus der Umgebung der Hooks des Repositorys
  heraus.** Ein Hook sieht nur einen Code für einen privaten Endpunkt, gültig,
  solange dieser git-Befehl läuft — genug für einen Hook, der absichtlich fragt, wie
  git-lfs es tut. Siehe
  [das Token eines Profils, während git läuft](security.md#das-token-eines-profils-während-git-läuft).

Siehe auch: [Sicherheit](security.md) · [SSH-Schlüssel](ssh-keys.md) ·
[Synchronisieren](syncing.md)
