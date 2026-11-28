---
title: Esecuzioni CI
category: Sincronizzazione e più repo
order: 59
summary: Segui GitHub Actions, le pipeline di GitLab, Azure Pipelines e Forgejo Actions dall’app — ogni job, i suoi passi e il suo log, con riesegui e annulla.
keywords: esecuzioni ci ci runs actions workflow pipeline build github actions gitlab pipelines azure pipelines forgejo actions job passi steps log riesegui rerun re-run annulla cancel dispatch workflow_dispatch badge stato status grafo graph
---

# Esecuzioni CI

Hai fatto push e adesso aspetti: passi al browser, trovi il repository, apri
Actions, trovi la tua esecuzione, apri il job diventato rosso, scorri fino alla
fine del log. **Esecuzioni CI** porta quel giro accanto al codice. Una pagina ti
dice come è andato di recente ogni workflow, elenca le esecuzioni del remote dalla
più recente e apre un’esecuzione fallita direttamente sul test che si è rotto —
con il file e la riga, a un clic dal tuo editor. I pulsanti per rilanciarla o
fermarla sono sulla scheda.

Parla con l’API dell’host stesso, con il token che hai già dato a GitHuttBr. Sulla
tua macchina non gira niente — per quello, vedi [CI locale](local-ci.md).

![La pagina Esecuzioni CI: una scheda per workflow con le sue ultime esecuzioni, i filtri Fallite e In corso, l’avanzamento di un’esecuzione in corso e un’esecuzione fallita aperta sul test che si è rotto e sui suoi job](../../screenshots/ci-runs.webp)

## Aprirla

**Strumenti → Esecuzioni CI…**, oppure *Esecuzioni CI* nella palette dei comandi
(⌘K). La pagina sta nella scheda del repository, come la wiki e gli insights, e
legge il remote chiamato `origin` — o il primo remote, quando non c’è `origin`.

## Cosa mostra la pagina

| Parte | Cos’è |
|---|---|
| **Schede dei workflow** | Una scheda per workflow: cosa lo avvia, la sua percentuale di successo sulle ultime 10 esecuzioni concluse (verde dal 90 %, ambra dal 70 %, rossa sotto), quelle esecuzioni come quadratini colorati — la più vecchia a sinistra, così la più recente sta accanto ad «adesso» —, il tempo medio e, in alternativa, il job più lento o com’è andata l’ultima esecuzione. Un clic su una scheda elenca solo le esecuzioni di quel workflow; un altro clic le mostra tutte |
| **Tutti i branch / Branch corrente** | Ogni esecuzione sul remote, o solo il branch su cui hai fatto checkout |
| **Fallite / In corso** | Filtri rapidi con il numero di esecuzioni che ciascuno terrebbe. Contano ciò che lasciano gli altri filtri, quindi il numero è quello che mostra un clic |
| **Filtro** | Restringe le esecuzioni caricate per titolo, workflow, branch, autore, commit o evento |
| **Una scheda di esecuzione** | Il titolo del commit (o il nome del workflow), poi il branch, il workflow e il numero dell’esecuzione, cosa l’ha avviata (push, pull request, pianificazione, manuale…), chi l’ha avviata e il commit — un clic sul commit lo copia. Quando l’esecuzione appartiene a una pull request, **PR #n** apre la pagina di quella pull request. A destra: a che punto è, quanto è durata e quanto tempo fa |
| **Un’esecuzione in corso** | *In corso · passo 3 di 5*, una barra di avanzamento e il tempo trascorso. Il passo è quello del job in corso; su un host senza passi (GitLab, Forgejo) conta invece i job |
| **Il test fallito** | Un’esecuzione fallita si apre da sola, la più recente per prima, con il test che il suo log nomina: il job, il test, la prima riga dell’errore e **percorso:riga** — un clic lì, o su *Apri nell’editor*, ti porta su quella riga. La stessa lettura della [scheda Check](hosting.md#la-scheda-check) di una pull request |
| **Job** | Sotto, ogni job con il suo stato e la sua durata, raggruppati per stage dove l’host ha gli stage (GitLab, Azure). *Vedi passi e log* apre i passi di un job e la fine del suo log — su un job fallito c’è sempre, sugli altri compare quando punti il job |
| **Passi** | Ogni passo di un job, con il suo stato e la sua durata — GitHub, Azure e Forgejo li riportano; GitLab non ha passi |
| **Log** | La fine del log di un job concluso, con i colori. Vengono scaricati solo gli ultimi 512 KB — dove sta il fallimento — e la pagina dice quando l’inizio è stato lasciato fuori |

Finché qualcosa sulla pagina è in coda o in corso, la lista richiede all’host ogni
15 secondi, e con lei i job dell’esecuzione aperta e di ogni esecuzione in corso
— è da lì che viene il numero del passo; le durate avanzano ogni secondo. Quando
due minuti di risposte non portano niente di nuovo — un’esecuzione che aspetta
l’approvazione di un deploy, per esempio —, rallenta a una volta al minuto, e
riaccelera appena qualcosa si muove. Una lista in cui tutto è concluso non chiede
niente finché non premi aggiorna, e mentre la finestra è nascosta non si chiede
niente.

Un’esecuzione che l’host manda senza titolo — ogni pipeline di GitLab, una build
pianificata di Azure — prende il nome dall’oggetto del suo commit quando il commit
è nel grafo, letto dal tuo repository locale senza costi; altrimenti dal suo
numero.

## Rieseguire, annullare, avviare

| Pulsante | Compare quando | Cosa succede |
|---|---|---|
| **Riesegui falliti** | L’esecuzione è fallita o è stata annullata | Vengono rieseguiti solo i job che non sono passati |
| **Riesegui** (↻) | L’esecuzione è conclusa, su GitHub — sulla scheda quando la punti | Ogni job viene rieseguito |
| **Apri nel browser** | Puntando una scheda | L’esecuzione sul sito dell’host |
| **Annulla** | L’esecuzione è in coda o in corso | Chiede prima: i job in corso vengono interrotti e il loro lavoro va perso |
| **Avvia workflow** | L’host permette di avviarne uno a mano | Scegli il workflow e un branch; parte come se quel branch fosse stato pushato, e compare nella lista qualche secondo dopo |

Cosa permette ogni host:

| Host | Lista e job | Passi | Log | Riesegui tutto | Riesegui falliti | Annulla | Avvio a mano |
|---|---|---|---|---|---|---|---|
| **GitHub** (ed Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — il workflow ha bisogno di un trigger `workflow_dispatch` |
| **GitLab** (e self-managed) | ✓ — pipeline, job per stage | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — esegue `.gitlab-ci.yml` sul branch |
| **Azure DevOps** | ✓ — build, job per stage | ✓ (task) | ✓ | — | ✓ | ✓ | ✓ — qualsiasi definizione di build del repository |
| **Forgejo / Gitea** | ✓ sui server con l’API delle esecuzioni Actions | ✓ | ✓ quando il server lo fornisce a un token | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Badge nel grafo

La stessa CI compare come un piccolo badge accanto a ogni commit nel grafo: verde,
rosso o un orologio mentre gira. Passaci sopra per i job; clicca per la pagina
dell’host. I badge vengono da:

| Host | Fonte |
|---|---|
| GitHub | I check run del commit — qualsiasi CI che riferisce a GitHub, non solo Actions |
| GitLab | Gli stati del commit, che includono ogni job della pipeline. Un job manuale (un deploy, per esempio) non lascia il badge bloccato sull’orologio |
| Azure DevOps | Le 100 build più recenti del repository, abbinate per commit |
| Forgejo / Gitea | Lo stato combinato del commit — Forgejo Actions e qualsiasi CI esterna |
| Bitbucket Data Center | Gli stati di build del commit |

Ogni risposta viene ricordata — compreso «qui non c’è CI» — e un commit viene
interrogato di nuovo solo quando la sua risposta può essere cambiata: ogni 45
secondi mentre gira, ogni 10 minuti una volta concluso, e sempre più di rado per
un commit che non ha mai avuto CI. Così un grafo affollato resta dentro la quota
oraria dell’host.

## Limiti

- **Le schede conoscono solo le esecuzioni che la pagina ha elencato.** Sono le
  ultime 50 esecuzioni del filtro di branch in vigore — un workflow che gira di
  rado può mostrare meno di dieci quadratini, e passare al branch corrente
  ricalcola ogni scheda. Il job più lento compare quando la pagina ha letto i job
  di qualche esecuzione conclusa (basta l’esecuzione fallita che apre); fino ad
  allora la scheda dice com’è andata l’ultima esecuzione.
- **Il test fallito viene letto dal testo del log.** Vitest, Jest e pytest sono
  riconosciuti; qualsiasi altro runner, un errore di build o un log troncato
  mostrano solo la lista dei job. Un percorso che il runner ha scritto fuori dal
  checkout non si può aprire.
- **PR #n dipende da ciò che dice l’host.** GitHub indica la pull request solo per
  le esecuzioni dello stesso repository, non da un fork; GitLab la indica per le
  pipeline di merge request e Azure per le build di PR. Le esecuzioni di Forgejo
  non hanno link.
- **Il log è la fine, e solo quando un job è concluso.** GitHub e Forgejo danno il
  log di un job quando ha finito; mentre gira, la pagina mostra i suoi passi
  avanzare, non il suo output. GitLab e Azure servono il log di un job in corso
  fino a quel momento — riaprilo per leggere di più.
- **Il token ha bisogno di accesso alla CI.** Un token GitHub a grana fine ha
  bisogno di *Actions: read* per elencare e di *Actions: write* per rieseguire,
  annullare o avviare; uno classico ha bisogno di `repo`. Un token GitLab ha
  bisogno di `read_api` per elencare e di `api` per i pulsanti. Un token Azure ha
  bisogno di *Build: read* (e di *Build: read & execute* per i pulsanti); senza, la
  pagina e i badge restano vuoti invece di fallire.
- **I badge di Azure arrivano indietro solo di 100 build.** Un commit più vecchio
  non ha badge, anche se la pagina Esecuzioni CI elenca ancora la sua build.
- **La riesecuzione di Azure è «riprova i falliti».** Funziona sulle pipeline YAML
  con stage; una pipeline classica può rifiutarla, e la pagina mostra la risposta
  dell’host.
- **Avviare un workflow non chiede i suoi input.** Un workflow di GitHub o una
  pipeline di GitLab con input obbligatori senza valore predefinito viene
  rifiutato dall’host, con il suo messaggio.
- **Forgejo è in sola lettura, e solo sui server recenti.** I server Forgejo e
  Gitea più vecchi non hanno un’API per elencare le esecuzioni; la pagina dice che
  l’host non è supportato, e i badge del grafo funzionano comunque attraverso gli
  stati dei commit. Un repository che il token non può vedere appare come errore
  di accesso, non come «non supportato».
- **Bitbucket non ha una pagina delle esecuzioni.** Su Data Center la CI è un
  sistema esterno (Jenkins, Bamboo…) che riferisce solo uno stato — quello stato è
  il badge del grafo. Le Pipelines di bitbucket.org non sono supportate.
- **Un solo remote.** La pagina legge `origin`; le esecuzioni sull’altro remote di
  un fork non vengono elencate.

**Vedi anche:** [CI locale](local-ci.md) · [Hosting e pull request](hosting.md)
