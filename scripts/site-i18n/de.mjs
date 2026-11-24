// Website chrome in de. Keys mirror en.mjs; anything missing falls back to English.
export const de = {
  'nav.handbook': 'Handbuch',
  'nav.roadmap': 'Roadmap',
  'nav.github': 'GitHub',
  'nav.sponsor': 'Sponsern',
  'nav.download': 'Herunterladen',

  'foot.license':
    'Lizenziert unter Apache 2.0 · Gemacht von <a href="https://github.com/StarleyDev">Starley - Mestre Jedi</a> mit 💜',
  'foot.credit': 'Ein Fork von {upstream} von MyAppDesk, unter der MIT-Lizenz.',
  'foot.source': 'Quellcode',
  'foot.roadmap': 'Roadmap',
  'foot.reportIssue': 'Ein Problem melden',
  'foot.sponsor': 'Sponsern',

  'meta.title': 'GitHuttBr — das ganze git, offen sichtbar',
  'meta.description':
    'Ein vollständig vibe-codierter Git-Client. Kostenlos. Graph, Staging bis auf die Zeile, Rebase, Worktrees, Submodule, LFS — dazu ein paar Dinge, von denen du nicht wusstest, dass git sie kann.',

  'hero.title': 'Das ganze git,<br /><em>offen sichtbar</em>',
  'hero.lede':
    'Graph, Staging bis auf die Zeile, Rebase, Worktrees, Submodule, LFS.<br />Die gewöhnlichen Dinge, ordentlich gemacht — dazu ein paar, von denen du nicht wusstest, dass git sie kann.',
  'hero.download': 'Für deine Plattform herunterladen',
  'hero.source': 'Quellcode ansehen',
  'hero.terms': 'Kostenlos · Apache 2.0 · v{version}',
  'hero.graphAlt': 'Der Commit-Graph von GitHuttBr',

  'features.title': 'Ein paar Dinge, von denen du nicht wusstest, dass git sie kann',
  'features.sub':
    'Keines davon ist der Grund, GitHuttBr zu benutzen — die Liste oben ist es. Es gibt sie, weil git die Antwort ohnehin schon kennt; GitHuttBr fragt einfach danach.',

  'ordinary.title': 'Was du bekommst',
  'ordinary.sub':
    'Ein vollständiger Client, kein Ausschnitt. Alles gebaut, dokumentiert und heute schon in der App — die gewöhnlichen Dinge, und die sind das meiste an dem, was git benutzen wirklich ausmacht.',
  'ordinary.graph': 'Commit-Graph mit echten Spuren, gefenstert für riesige Historien',
  'ordinary.staging': 'Staging bis hinunter zu einzelnen Zeilen',
  'ordinary.conflicts':
    'Dreispaltiger Konfliktlöser, der sagt, welche Seite welche ist',
  'ordinary.rebase': 'Interaktiver Rebase per Ziehen',
  'ordinary.stacks': 'Gestapelte Branches mit kaskadierendem Restack',
  'ordinary.recovery': 'Reflog, WIP-Schnappschüsse, geführtes Bisect',
  'ordinary.prs': 'Pull Requests auf GitHub, GitLab, Bitbucket und Azure DevOps',
  'ordinary.terminal': 'Integriertes Terminal — ein echtes PTY',
  'ordinary.launch':
    'Ausführen &amp; debuggen direkt aus <code>.vscode/launch.json</code>',
  'ordinary.ai': 'Optionale KI, die die Zeilen zitiert, die sie gelesen hat',
  'ordinary.themes': 'Eingebaute Themes, hell und dunkel, dazu KI-generierte',
  'ordinary.languages':
    'Durchgängig übersetzt, Handbuch inklusive — Arabisch und Hebräisch spiegeln das Layout',

  'download.title': 'Herunterladen',
  'download.sub':
    'Neuestes Release: <strong>v{version}</strong>. Jeder Build wird aus der CI veröffentlicht.',
  'download.cli':
    'Oder öffne ein Repository aus deinem Terminal mit <code>githuttbr .</code> — siehe <a href="{cli}">die Kommandozeile</a>.',
  'download.macNote': 'Apple silicon &amp; Intel',
  'download.winNote': 'Installer (x64)',
  'download.linuxNote': 'AppImage · deb',
  'download.forOs': 'Für {os} herunterladen',

  'handbook.title': 'Ein Handbuch mit {pages} Seiten, eingebaut in die App',
  'handbook.sub': 'Jede Funktion erklärt — offline in der App und genau hier.',

  'sponsor.title': 'GitHuttBr sponsern',
  'sponsor.body':
    'Kostenlos, Apache 2.0, kein Backend, keine Telemetrie, nichts, was dir noch verkauft werden soll — es gibt also nichts zu kaufen. Sponsoring bezahlt das Apple-Developer-Zertifikat, das die signierten macOS-Builds brauchen, das Handbuch und die Übersetzungen. Fehlerberichte sind genauso viel wert.',
  'sponsor.cta': 'Auf GitHub sponsern',

  'doc.titleSuffix': 'GitHuttBr-Handbuch',
  'doc.filter': 'Seiten filtern…',
  'doc.filterLabel': 'Seiten filtern',
  'doc.edit': 'Diese Seite auf GitHub bearbeiten',
  'doc.improve': 'Diese Übersetzung auf GitHub verbessern',

  'feature.conflict-radar.title': 'Konflikt-Radar',
  'feature.conflict-radar.body':
    'Sieh, welche Branches Konflikte verursachen werden, <strong>bevor</strong> du einen von ihnen mergst. Die Merges passieren innerhalb der Objektdatenbank — kein Checkout, keine Änderung am Arbeitsverzeichnis, nichts, was aufzuräumen wäre.',
  'feature.recovery.title': 'WIP-Schnappschüsse',
  'feature.recovery.body':
    'Dein ganzer Arbeitsbaum — unversionierte Dateien eingeschlossen — per Timer gesichert und <strong>direkt vor jeder destruktiven Aktion</strong>. Ein bereutes Verwerfen ist nur eine Wiederherstellung entfernt.',
  'feature.commit-edit.title': 'Jeden Commit bearbeiten',
  'feature.commit-edit.body':
    'Der Tippfehler liegt drei Wochen zurück? Bearbeite die Datei <strong>im alten Commit selbst</strong> — alles darüber wird neu aufgespielt, und die ganze Kaskade wird als Vorschau gezeigt, bevor sich eine einzige Ref bewegt.',
  'feature.ai.title': 'Bring deine eigenen Modelle mit',
  'feature.ai.body':
    'Mehrere KI-Konten zugleich — ein OpenAI-Schlüssel für Commit-Nachrichten, Claude für den Chat, ein lokales Ollama für den Rest. Die Modelllisten kommen live von jedem Anbieter, und eine CLI, bei der du schon angemeldet bist, funktioniert statt eines API-Schlüssels.',
  'feature.semantic-diff.title': 'Semantischer Diff',
  'feature.semantic-diff.body':
    '<code>startServer</code> → <code>bootServer</code>, statt einer 400 Zeilen langen rot-grünen Wand. Echtes tree-sitter-Parsing, keine Regex.',
  'feature.range-diff.title': 'Was sich geändert hat seit',
  'feature.range-diff.body':
    'Sie haben den Branch force-gepusht, den du reviewt hast. Sieh, welche Commits umgeschrieben, verworfen oder hinzugefügt wurden — die alten Positionen liefert das Reflog gratis mit.',
  'feature.repo-chat.title': 'Repository-Chat',
  'feature.repo-chat.body':
    'Stelle diesem Repository eine Frage und erhalte eine Antwort, die die gelesenen Zeilen zitiert. Hefte die Dateien und Commits an, die sie ansehen soll — aus dem Graphen, dem Dateibaum oder von irgendwo auf der Platte.',
  'feature.absorb.title': 'Einarbeiten',
  'feature.absorb.body':
    'Stage deine Review-Korrekturen und lass blame jeden Hunk in den Commit leiten, der ihn eingeführt hat — als <code>fixup!</code>.',
  'feature.time-machine.title': 'Zeitmaschine',
  'feature.time-machine.body':
    'Zieh an einem Regler und sieh dem Repository beim Verändern zu: Dateien tauchen auf, wandern, kommen zurück. HEAD bewegt sich nie, und deine nicht committeten Arbeiten bleiben unangetastet.',
  'feature.timelapse.title': 'Timelapse',
  'feature.timelapse.body':
    'Spiel das ganze Leben des Repositorys als Animation ab — und exportiere es als Video, in der Seite aufgezeichnet, ohne einen Encoder zu installieren.',
  'feature.pr-preview.title': 'Einen Pull Request lokal ansehen',
  'feature.pr-preview.body':
    'Führe den Pull Request von jemand anderem aus — Forks eingeschlossen — ohne irgendetwas zu committen. Kein API-Token, kein zweites Remote: der Head wird von der Ref geholt, die der Hoster ohnehin veröffentlicht, auf GitHub, GitLab, Bitbucket, Azure DevOps oder Gitea.',
  'feature.mission-control.title': 'Missionskontrolle',
  'feature.mission-control.body':
    'Jedes Repository des Workspace auf einem Bildschirm, sortiert danach, was dich braucht: blockiert zuerst, dann zu synchronisieren, dann dirty, dann ruhig.',
  'feature.attributes.title': 'Dateiattribute, mit Oberfläche',
  'feature.attributes.body':
    'Die nützlichste Datei in git, die niemand schreibt. Zeilenenden ein für alle Mal für alle geklärt, ein Changelog, der aufhört zu kollidieren, Fixtures, die aus Release-Tarballs draußen bleiben — und lesbare Diffs für Word und PDF, wenn der Konverter installiert ist.',
  'feature.languages.title': 'Deine Sprache, vermutlich',
  'feature.languages.body':
    'Keine Alibi-Übersetzung der Buttons — die ganze Oberfläche, Erklärungen inklusive. Arabisch und Hebräisch spiegeln das Layout, während Graph, Diffs, Pfade und das Terminal von links nach rechts bleiben, weil Code in dieser Richtung gelesen wird.',
  'feature.security.title': 'Deine Geheimnisse bleiben deine',
  'feature.security.body':
    'Kein Backend. Tokens und Tresor-Einträge werden mit dem Schlüsselbund deines Betriebssystems verschlüsselt — und nichts rührt diesen Schlüsselbund an, bevor dir gesagt wurde wofür und du ja gesagt hast.',
  'feature.cli.title': 'Eine Git-Oberfläche mit echter CLI',
  'feature.cli.body':
    '`githuttbr .` öffnet ein Repository, `githuttbr blame src/api.ts -l 84` öffnet es an genau dieser Zeile, und `githuttbr doctor` öffnet gar kein Fenster – es prüft, was das Repository verlangt, und endet mit einem Code, den deine CI lesen kann.',
  'feature.hosting.title': 'Pull Requests auf jedem Server',
  'feature.hosting.body':
    'Erstellen, reviewen und mergen auf GitHub, GitLab, Bitbucket, Azure DevOps und Forgejo — auch auf den eigenen Servern Ihrer Firma: GitHub Enterprise, GitLab und Bitbucket Data Center — mit Reviewern, Zuständigen und Labels direkt aus dem Repository.',

  // The landing page: stats, showcase, security, disclaimer, downloads.
  'nav.language': 'Sprache',
  'stat.platforms': 'Plattformen — macOS, Windows und Linux',
  'stat.languages': 'Sprachen, Handbuch inklusive',
  'stat.pages': 'Handbuchseiten in der App',
  'stat.servers': 'eigene Server dazwischen',
  'showcase.more': 'Handbuchseite lesen',
  'more.title': 'Und mehr — gebaut, dokumentiert und schon heute in der App',
  'hosts.title': 'Funktioniert mit deinem Host',
  'hosts.beta': 'Beta',
  'ai.compatible': 'jeder kompatible Endpunkt',
  'sec.keychain.title': 'Erst fragen, dann Schlüsselbund',
  'sec.keychain.body':
    'Tokens werden mit dem Schlüsselbund des Systems verschlüsselt, und die App fragt, bevor sie ihn anrührt. Sag nein, und sie funktioniert trotzdem.',
  'sec.server.title': 'Ein Token, ein Server',
  'sec.server.body':
    'Ein Token für github.com, Enterprise, GitLab oder Data Center geht nur an den Server, für den es gespeichert wurde.',
  'sec.plain.title': 'git sieht den Token nie im Klartext',
  'sec.plain.body':
    'Er erreicht git über einen privaten Endpunkt pro Vorgang — nicht über <code>.git/config</code>, nicht über die Kommandozeile, nicht über die Umgebung.',
  'sec.confirm.title': 'Destruktiv heißt bestätigt',
  'sec.confirm.body':
    'Force-Push, Verwerfen, Hard-Reset: Die Bestätigung sagt genau, was verloren geht, und vorher wird ein Snapshot angelegt.',
  'themes.title': 'Themes, Tastenkürzel, Profile — und ein Capybara',
  'themes.body':
    'Helle und dunkle Themes, auch KI-generierte. Ein Profil pro Identität, pro Repository zugeordnet. Starte und debugge aus deiner <code>launch.json</code> und sieh in einem Dock unten, was <code>tsc</code>, ESLint oder Clippy sagen.',
  'honest.title': 'Ein ehrlicher Hinweis',
  'honest.body':
    'GitHuttBr ist jung. <strong>GitHub</strong> ist der erprobteste Weg. GitHub Enterprise Server, selbstverwaltetes GitLab und Bitbucket Data Center sind <strong>Beta</strong> — gegen simulierte Server getestet, noch nicht gegen echte. Wenn es kaputtgeht: nun ja, <em>auf meinem Rechner läuft’s</em>. Issues und PRs willkommen. 💜',
  'download.yours': 'Dein System',
  'download.macHint':
    'Noch nicht signiert: Öffne beim ersten Start <strong>Systemeinstellungen → Datenschutz &amp; Sicherheit → Dennoch öffnen</strong>. Auf dem Mac wird jede neue Version von Hand geladen.',
  'download.autoUpdate': 'Aktualisiert sich mit jedem neuen Release selbst.'
}
