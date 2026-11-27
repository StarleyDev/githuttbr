---
title: Impostazioni per repository
category: Strumenti dell'area di lavoro
order: 94
summary: Nome visualizzato, profilo, branch protetti e immagine della scheda di un repository, più le sue regole, la cassaforte e l’attività.
keywords: impostazioni repo branch protetti analytics registro operazioni cronologia info ingranaggio immagine della scheda tab image icona logo nome visualizzato alias profilo rimuovi dall’elenco dimentica metriche configurazione del progetto
source: 6cd23a3db24f4869df7d1b881fb15155bd0a0a8b
---

# Impostazioni per repository

L'ingranaggio accanto agli strumenti nella barra apre le impostazioni che
appartengono a **questo** repository, non all'applicazione.

![Le impostazioni per repository](../../screenshots/repo-settings.webp)

L’intestazione dice quale repository stai per modificare: il nome, la cartella,
il branch corrente, il remoto principale (`origin` se c’è) con l’host su cui
vive, e qualche conteggio. Il numero di branch viene dall’elenco già caricato.
Quello della cassaforte compare solo dopo aver aperto **Cassaforte**, perché
leggerla interpella il portachiavi di sistema, e aprire le impostazioni non
dovrebbe. Non c’è il numero di commit: contare una lunga cronologia è una
chiamata git a sé, e un’intestazione non la vale.

Le pagine stanno in una navigazione laterale, in tre gruppi:

| Gruppo | Pagina | Cosa contiene |
|---|---|---|
| Repository | **Generali** | Nome visualizzato, profilo, branch protetti, l’immagine della scheda e Rimuovi dall’elenco |
| Repository | **Configurazione del progetto** | Le [regole che questo repository porta con sé](repo-config.md) in `.githuttbr.json`, e il doctor che le controlla |
| Repository | **Informazioni** | Note e campi liberi su questo repository, conservati in locale |
| Sicurezza | **Cassaforte** | Le voci della [cassaforte](vault.md) di questo repository |
| Attività | **Metriche** | Quello che hai fatto in GitHuttBr, contato in locale |
| Attività | **Analisi** | La [dashboard della cronologia](insights.md) |
| Attività | **Cronologia delle operazioni** | I commit nel tempo e chi li ha fatti, per i repository che hai aperto |
| Attività | **Registro** | Il log delle operazioni: ogni comando git che GitHuttBr ha eseguito qui, con il risultato |

Il registro delle operazioni è quello onesto: quando qualcosa si comporta in modo
strano, mostra il comando esatto e l'errore esatto, così una segnalazione di bug
può portare fatti invece di aggettivi.

## Generali

Ogni impostazione è una riga: cosa fa a sinistra, il controllo a destra.
Nulla viene salvato finché non premi **Salva**.

| Riga | Cosa fa | Dove è salvata |
|---|---|---|
| **Nome visualizzato** | Il nome su schede ed elenchi. La cartella sul disco non viene mai rinominata; se vuoto, si usa il nome della cartella | Impostazioni di GitHuttBr, su questo computer |
| **Profilo** | L’identità, i token e l’IA a cui passa questo repository quando la sua scheda è attiva. **Auto** segue il profilo attivo | Impostazioni di GitHuttBr, su questo computer |
| **Branch protetti** | Avvisa prima di un commit o di un force push diretto su questi branch | Il git config del repository |
| **Immagine della scheda** | Una piccola immagine sulla scheda, più sotto | Impostazioni di GitHuttBr, su questo computer |

Quando il repository ha un `.githuttbr.json`, un avviso in cima a Generale lo
dice e porta a **Configurazione del progetto**. Quelle regole viaggiano con il
repository verso chiunque lo cloni; le righe sotto l’avviso sono solo tue.

**Rimuovi dall’elenco…** toglie il repository da [Repository](repositories.md).
Chiede prima, e la domanda dice cosa non fa: la cartella sul disco non viene
toccata, e una scheda aperta resta aperta. Riaprire il repository lo rimette
nell’elenco.

## Immagine della scheda

Con dieci schede aperte, nomi che iniziano allo stesso modo — `api`,
`api-gateway`, `api-docs` — si distinguono a fatica. Una piccola immagine
sulla scheda si trova prima di un testo.

In **Generali**, fai clic sul campo dell’immagine. Elenca le immagini del
repository stesso — PNG, JPEG, GIF, WebP, SVG, ICO, BMP e AVIF —, ognuna con la
sua miniatura, prima i file che si chiamano come un logo o un’icona. Scrivi per
filtrare (`logo dark` trova `assets/logo-dark.png`), spostati con le frecce e
premi Invio per scegliere; oppure scrivi un percorso a mano. Il percorso viene
salvato **relativo alla radice del repository**, quindi l’immagine segue il
repository ovunque si trovi la sua cartella.

Cosa mostra la scheda è una scelta di tutta l’app, in **Impostazioni →
Generali → Le schede dei repository mostrano**:

| Opzione | La scheda mostra |
|---|---|
| **Immagine e nome** (predefinito) | L’immagine al posto dell’icona della cartella, poi il nome |
| **Solo nome** | L’icona della cartella e il nome, come senza immagine |
| **Solo immagine** | Solo l’immagine; il nome passa nel tooltip |

Limiti da conoscere:

- L’elenco contiene i file che git vede — tracciati e non tracciati, non quelli
  ignorati — e al massimo 40 alla volta; scrivi per raggiungere gli altri.
  Un’immagine ignorata si può comunque scrivere a mano.
- Le immagini oltre 1 MB, o illeggibili, appaiono in grigio e non si possono
  scegliere: un’icona di 20 pixel non ha bisogno di più.
- Un repository **senza** immagine mostra sempre il nome, qualunque opzione sia
  scelta: una scheda vuota non si potrebbe riconoscere.
- Se il percorso è **rotto** — file eliminato, rinominato, non è un’immagine o è
  troppo grande — la scheda torna in silenzio al nome, e questa scheda delle
  impostazioni mostra un avviso sotto il percorso. Nient’altro si lamenta.
- L’immagine viene letta una volta per sessione. Se sostituisci il file con lo
  stesso nome, riapri questa scheda delle impostazioni per ricaricarla.
- L’impostazione vive nelle impostazioni di GitHuttBr su questo computer, non nel
  repository: i colleghi non la ereditano.

**Vedi anche:** [Sicurezza e segreti](security.md) · [Insight](insights.md)
