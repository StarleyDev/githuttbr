// Website chrome in it. Keys mirror en.mjs; anything missing falls back to English.
export const it = {
  'nav.handbook': 'Manuale',
  'nav.roadmap': 'Roadmap',
  'nav.github': 'GitHub',
  'nav.sponsor': 'Sostieni',
  'nav.download': 'Download',

  'foot.license': 'Licenza Apache 2.0 · Fatto da <a href="https://github.com/StarleyDev">Starley - Mestre Jedi</a> con 💜',
  'foot.credit': 'Un fork di {upstream} di MyAppDesk, con licenza MIT.',
  'foot.source': 'Codice sorgente',
  'foot.roadmap': 'Roadmap',
  'foot.reportIssue': 'Segnala un problema',
  'foot.sponsor': 'Sostieni',

  'meta.title': 'GitHuttBr — tutto git, sotto gli occhi',
  'meta.description':
    'Un client Git interamente vibe-coded. Gratis. Grafo, staging riga per riga, rebase, worktree, sottomoduli, LFS — più alcune cose che non sapevi che git potesse fare.',

  'hero.title': 'Tutto git,<br /><em>sotto gli occhi</em>',
  'hero.lede':
    'Grafo, staging riga per riga, rebase, worktree, sottomoduli, LFS.<br />Le cose ordinarie, fatte come si deve — più alcune che non sapevi che git potesse fare.',
  'hero.download': 'Scarica per la tua piattaforma',
  'hero.source': 'Vedi il codice',
  'hero.terms': 'Gratis · Apache 2.0 · v{version}',
  'hero.graphAlt': 'Il grafo dei commit di GitHuttBr',

  'features.title': 'Alcune cose che non sapevi che git potesse fare',
  'features.sub':
    'Nessuna di queste è il motivo per usare GitHuttBr — il motivo è l’elenco qui sopra. Esistono perché git conosce già la risposta; GitHuttBr si limita a chiedergliela.',

  'ordinary.title': 'Cosa include',
  'ordinary.sub':
    'Un client completo, non un sottoinsieme. Tutto realizzato, documentato e già nell’app oggi — le cose ordinarie, che sono la maggior parte di ciò che significa davvero usare git.',
  'ordinary.graph': 'Grafo dei commit con corsie vere, a finestra per cronologie enormi',
  'ordinary.staging': 'Staging fino alla singola riga',
  'ordinary.conflicts': 'Risolutore di conflitti a tre pannelli che dice quale lato è quale',
  'ordinary.rebase': 'Rebase interattivo trascinando',
  'ordinary.stacks': 'Branch impilate con restack a cascata',
  'ordinary.recovery': 'Reflog, snapshot del lavoro in corso, bisect guidato',
  'ordinary.prs': 'Pull request su GitHub, GitLab, Bitbucket e Azure DevOps',
  'ordinary.terminal': 'Terminale integrato — un PTY vero',
  'ordinary.launch': 'Esecuzione e debug direttamente da <code>.vscode/launch.json</code>',
  'ordinary.ai': 'AI opzionale che cita le righe che ha letto',
  'ordinary.themes': 'Temi integrati, chiaro e scuro, più quelli generati dall’AI',
  'ordinary.languages': 'Tutto tradotto, manuale incluso — arabo ed ebraico rispecchiano il layout',

  'download.title': 'Download',
  'download.sub':
    'Ultima versione: <strong>v{version}</strong>. Ogni build è pubblicata dalla CI.',
  'download.cli':
    'Oppure apri un repository dal terminale con <code>githuttbr .</code> — vedi <a href="{cli}">la riga di comando</a>.',
  'download.macNote': 'macOS 13+ · Apple silicon &amp; Intel',
  'download.winNote': 'Installer (x64)',
  'download.linuxNote': 'AppImage · deb',
  'download.forOs': 'Scarica per {os}',

  'handbook.title': 'Un manuale di {pages} pagine, dentro l’app',
  'handbook.sub': 'Ogni funzione spiegata — offline nell’app, e proprio qui.',

  'sponsor.title': 'Sostieni GitHuttBr',
  'sponsor.body':
    'Gratis, Apache 2.0, senza backend, senza telemetria, niente da piazzarti — quindi non c’è niente da comprare. Le sponsorizzazioni pagano il certificato Apple Developer che serve alle build macOS firmate, il manuale e le traduzioni. Una segnalazione di bug vale esattamente lo stesso.',
  'sponsor.cta': 'Sostieni su GitHub',

  'doc.titleSuffix': 'Manuale di GitHuttBr',
  'doc.filter': 'Filtra le pagine…',
  'doc.filterLabel': 'Filtra le pagine',
  'doc.edit': 'Modifica questa pagina su GitHub',
  'doc.improve': 'Migliora questa traduzione su GitHub',

  'feature.conflict-radar.title': 'Radar dei conflitti',
  'feature.conflict-radar.body':
    'Scopri quali branch andranno in conflitto <strong>prima</strong> di fonderne una sola. I merge avvengono dentro il database degli oggetti — nessun checkout, nessuna modifica alla working tree, niente da ripulire.',
  'feature.recovery.title': 'Istantanee del lavoro in corso',
  'feature.recovery.body':
    'Tutto il tuo albero di lavoro — file non tracciati inclusi — fotografato a intervalli regolari e <strong>subito prima di ogni azione distruttiva</strong>. Uno scarto di cui ti penti è a un ripristino di distanza.',
  'feature.commit-edit.title': 'Modifica qualsiasi commit',
  'feature.commit-edit.body':
    'Il refuso è di tre settimane fa? Modifica il file <strong>dentro il vecchio commit</strong> — tutto ciò che sta sopra viene rieseguito, e l’intera cascata è mostrata in anteprima prima che una sola ref si muova.',
  'feature.ai.title': 'Porta i tuoi modelli',
  'feature.ai.body':
    'Più account di IA insieme — una chiave OpenAI per i messaggi di commit, Claude per la chat, un Ollama locale per il resto. Gli elenchi dei modelli arrivano in diretta da ogni provider, e una CLI a cui hai già fatto l’accesso funziona al posto di una chiave API.',
  'feature.semantic-diff.title': 'Diff semantico',
  'feature.semantic-diff.body':
    '<code>startServer</code> → <code>bootServer</code>, invece di un muro rosso e verde da 400 righe. Parsing vero con tree-sitter, non una regex.',
  'feature.range-diff.title': 'Cos’è cambiato da',
  'feature.range-diff.body':
    'Hanno fatto un force push sul branch che avevi rivisto. Guarda quali commit sono stati riscritti, scartati o aggiunti — le posizioni vecchie arrivano gratis dal reflog.',
  'feature.repo-chat.title': 'Chat del repository',
  'feature.repo-chat.body':
    'Fai una domanda a questo repository e ottieni una risposta che cita le righe lette. Fissa i file e i commit da guardare: trascinali dal grafo, dall’albero dei file o da qualunque punto del disco.',
  'feature.absorb.title': 'Absorb',
  'feature.absorb.body':
    'Metti in stage le correzioni della revisione e lascia che blame instradi ogni hunk nel commit che l’ha introdotto, come un <code>fixup!</code>.',
  'feature.time-machine.title': 'Macchina del tempo',
  'feature.time-machine.body':
    'Trascina un cursore e guarda il repository cambiare: i file compaiono, si spostano, tornano. HEAD non si muove e il tuo lavoro non committato resta intatto.',
  'feature.timelapse.title': 'Timelapse',
  'feature.timelapse.body':
    'Riproduci l’intera vita del repository come un’animazione — ed esportala come video, registrato nella pagina, senza nessun encoder da installare.',
  'feature.pr-preview.title': 'Anteprima di una pull request',
  'feature.pr-preview.body':
    'Esegui la PR di qualcun altro — fork inclusi — senza committare niente. Nessun token API, nessun secondo remote: la head viene recuperata dalla ref che l’host già pubblica, su GitHub, GitLab, Bitbucket, Azure DevOps o Gitea.',
  'feature.mission-control.title': 'Mission control',
  'feature.mission-control.body':
    'Ogni repository dell’area di lavoro su una sola schermata, ordinati per quanto ti reclamano: prima i bloccati, poi quelli da sincronizzare, poi quelli sporchi, poi quelli tranquilli.',
  'feature.attributes.title': 'Attributi dei file, con un’interfaccia',
  'feature.attributes.body':
    'Il file più utile di git che nessuno scrive. Fine riga sistemati una volta per tutti, un changelog che smette di andare in conflitto, fixture tenute fuori dai tarball di release — e diff leggibili per Word e PDF, quando il convertitore è installato.',
  'feature.languages.title': 'La tua lingua, probabilmente',
  'feature.languages.body':
    'Non una traduzione di facciata dei pulsanti — l’interfaccia intera, spiegazioni comprese. Arabo ed ebraico rispecchiano il layout, mentre il grafo, i diff, i percorsi e il terminale restano da sinistra a destra, perché è la direzione in cui si legge il codice.',
  'feature.security.title': 'I tuoi segreti restano tuoi',
  'feature.security.body':
    'Nessun backend. I token e le voci della cassaforte sono cifrati con il portachiavi del sistema — e niente tocca quel portachiavi finché non ti è stato detto a che scopo e non hai detto di sì.',
  'feature.cli.title': 'Una GUI Git con una vera CLI',
  'feature.cli.body':
    '`githuttbr .` apre un repository, `githuttbr blame src/api.ts -l 84` lo apre su quella riga, e `githuttbr doctor` non apre alcuna finestra: verifica ciò che il repository richiede ed esce con un codice che la tua CI sa leggere.',
  'feature.hosting.title': 'Pull request su ogni server',
  'feature.hosting.body':
    'Crea, revisiona e unisci su GitHub, GitLab, Bitbucket, Azure DevOps e Forgejo — anche sui server della tua azienda: GitHub Enterprise, GitLab e Bitbucket Data Center — con revisori, assegnatari ed etichette scelti dal repository.',

  // The landing page: stats, showcase, security, disclaimer, downloads.
  'nav.language': 'Lingua',
  'stat.platforms': 'piattaforme — macOS, Windows e Linux',
  'stat.languages': 'lingue, manuale compreso',
  'stat.pages': 'pagine di manuale dentro l’app',
  'stat.servers': 'server nostri nel mezzo',
  'showcase.more': 'Leggi la pagina del manuale',
  'more.title': 'E altro — costruito, documentato e nell’app oggi',
  'hosts.title': 'Funziona con il tuo host',
  'hosts.beta': 'beta',
  'ai.compatible': 'qualsiasi endpoint compatibile',
  'sec.keychain.title': 'Chiede prima del portachiavi',
  'sec.keychain.body':
    'I token sono cifrati con il portachiavi del sistema, e l’app chiede prima di toccarlo. Rispondi no e continua a funzionare.',
  'sec.server.title': 'Un token, un server',
  'sec.server.body':
    'Un token di github.com, Enterprise, GitLab o Data Center viene inviato solo al server per cui è stato salvato.',
  'sec.plain.title': 'git non vede mai il token in chiaro',
  'sec.plain.body':
    'Arriva a git da un endpoint privato, uno per operazione — non da <code>.git/config</code>, non dalla riga di comando, non dall’ambiente.',
  'sec.confirm.title': 'Distruttivo vuol dire confermato',
  'sec.confirm.body':
    'Force push, scarta modifiche, reset hard: la conferma dice esattamente cosa si perde, e prima viene fatto uno snapshot.',
  'themes.title': 'Temi, scorciatoie, profili — e un capibara',
  'themes.body':
    'Temi chiari e scuri, anche generati dall’IA. Un profilo per identità, associato per repository. Avvia e fai debug dal tuo <code>launch.json</code> e guarda cosa dicono <code>tsc</code>, ESLint o Clippy in un pannello in basso.',
  'honest.title': 'Un avviso onesto',
  'honest.body':
    'GitHuttBr è giovane. <strong>GitHub</strong> è la strada più collaudata. GitHub Enterprise Server, GitLab self-managed e Bitbucket Data Center sono in <strong>beta</strong> — testati contro server simulati, non ancora contro server reali. Se si rompe: be’, <em>sulla mia macchina funziona</em>. Issue e PR benvenute. 💜',
  'download.yours': 'Il tuo sistema',
  'download.macHint':
    'Firmato con un Developer ID e notarizzato da Apple: si apre come qualsiasi altra app e si aggiorna da solo.',
  'download.autoUpdate': 'Si aggiorna da solo a ogni nuova release.'
}
