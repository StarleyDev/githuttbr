---
title: Wiki del repository (AI)
category: AI
order: 81
summary: Una guida generata a una base di codice in cui ogni affermazione cita un file.
keywords: wiki documentazione generata base di codice panoramica dipendenze architettura esporta docs annulla sfondo background cartella docs/wiki scegli cartella
---

# Wiki del repository

Puntala a un repository e scrive una breve wiki che spiega la base di codice.

## La scheda del repo

- **Ripartizione dei linguaggi** per byte.
- **Lo stack** — i framework mostrati come badge (Next, Angular, Electron,
  Tailwind, Django…).
- **Dipendenze** lette direttamente dai tuoi manifest (`package.json`,
  `Cargo.toml`, `go.mod`, `pyproject.toml`, `pubspec.yaml`, `Gemfile`…) e
  raggruppate per ruolo architetturale. L'impalcatura — stub di tipi, loader,
  plugin di lint — viene filtrata via per prima, e possono comparire solo i
  pacchetti che il progetto dichiara davvero.
- **Un grafo delle dipendenze fra moduli**, ricavato dal sorgente (JS/TS, Python,
  Go, Rust, Dart, Ruby, C/C++, PHP) e risolto contro i file del repository
  stesso, così l'import di un pacchetto non diventa mai un arco fasullo.

## Le pagine scritte

GitHuttBr pianifica una manciata di pagine a partire dai file tracciati dal
repository — prima documentazione e manifest, poi ciò che cambia di più — e
scrive ogni pagina a partire dai file che copre.

**Ogni affermazione cita il file da cui proviene**, e un'affermazione che nessun
file sostiene viene rifiutata invece che pubblicata. Le pagine sono scritte in
parallelo e memorizzate in un colpo solo, così un tentativo fallito non sostituisce
mai una wiki buona. Ti dice quando la wiki è stata scritta a un commit più
vecchio.

## Generazione in background

Scrivere una wiki richiede un po' di tempo — una chiamata al modello per pagina.
L'esecuzione appartiene all'app, non alla pagina: lascia la wiki per un'altra
scheda o un altro repository e continua. Torna, e la pagina mostra a che punto è
(*Sto pianificando le pagine…*, poi ogni pagina man mano che arriva) con
**Genera la wiki** disattivato, così un secondo clic non può avviare una seconda
esecuzione in concorrenza. Il messaggio *Wiki generata* arriva ovunque tu sia.

**Annulla** la ferma. Non si perde nulla: la wiki precedente viene sostituita
solo quando tutte le pagine sono scritte, quindi un'esecuzione annullata la
lascia esattamente com'era. Annulla interrompe la richiesta in corso — la
chiamata HTTP, o il processo della CLI per un account CLI — ma un fornitore può
comunque addebitare i token che aveva già prodotto.

Chiudere la finestra annulla un'esecuzione avviata da quella finestra.

## Esportazione

**Esporta** scrive tutto quanto dentro `docs/wiki/` come Markdown collegato —
così può essere committato, rivisto in una PR e letto sul tuo host. Il tooltip
indica la cartella in cui scrive.

L'icona della cartella accanto sceglie **un'altra cartella** per questo
repository — qualsiasi cartella al suo interno tranne la radice (dove il
`README.md` dell'esportazione sostituirebbe quello del progetto) e `.git`.
Scegliere di nuovo `docs/wiki` torna al valore predefinito.

### Una wiki già presente nel repository

Quando questa macchina non ha una wiki propria per il repository — è stata
generata sulla macchina di un collega, o prima di una reinstallazione — la
pagina legge invece quella nella cartella della wiki, e lo dice. Viene giudicata
in base al commit che porta impresso: aggiornata a quel commit, indietro dopo.

Cosa non può avere una wiki riletta: il modello che l'ha scritta, e nulla di
un'esportazione fatta prima che questa versione vi imprimesse lo stack e il tipo
di ogni pagina — quelle pagine appaiono come semplici moduli, senza la scheda
dello stack. Una pagina modificata a mano risulta modificata, ma il suo elenco
**Fonti** conserva solo le righe ancora scritte nel modo in cui le scrive
l'esportazione. **Rigenera** ne scrive una nuova, salvata su questa macchina,
che da quel momento ha la precedenza.

**Elimina** su una wiki riletta la elimina dal repository, quindi chiede prima.
Rimuove solo i file scritti dall'esportazione — portano la sua nota *Generated
by* — e lascia tutto il resto nella cartella. I file committati si recuperano
con git; quelli non committati no.

I file che sembrano contenere segreti non vengono mai inviati.

**Vedi anche:** [Funzioni AI](ai.md)
