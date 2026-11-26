---
title: Pulizia dei branch
category: Branch e chirurgia
order: 47
summary: Elimina i branch locali il cui lavoro è già altrove — upstream spariti, branch uniti — in un solo passo annullabile.
keywords: pulire pulizia prune eliminare rimuovere branch locali sparito unito squash inattivo morti vecchi pull request riordinare elenco dei branch clean up cleanup delete remove gone merged stale tidy branch list
source: 701f92f45b9e4dcda7dc560cb20128442fd2da0d
---

# Pulizia dei branch

Ogni pull request che metti in checkout lascia indietro un branch locale. La PR
viene unita, il server elimina il suo branch, e quello locale resta — per sempre.
Dopo qualche centinaio di revisioni, l’elenco dei branch è fatto per lo più di
branch morti, e trovare quelli vivi vuol dire scorrerli tutti.

La pulizia dei branch elenca i branch locali il cui lavoro è già al sicuro altrove,
spunta quelli che non hanno nulla da perdere e li elimina in un solo passo che puoi
annullare. «Altrove» vuol dire i branch di tracciamento remoto all’ultimo fetch, e
il branch predefinito.

![La finestra di pulizia: branch spariti, uniti e uniti con squash spuntati, lavoro che esiste solo qui tenuto da parte](../../screenshots/branch-cleanup.webp)

## Come funziona

1. Strumenti → **Ripulisci i branch locali…** (o <kbd>⌘K</kbd>).
2. Premi prima **Fetch e prune** se l’ultimo fetch è vecchio. Finché non gira un
   fetch con prune, un branch che il server ha eliminato qui sembra ancora vivo.
3. Se il tuo team unisce le pull request con squash, premi **Controlla i merge
   squash** (vedi sotto).
4. Controlla le spunte, poi **Elimina**. Una sola conferma dice quanti branch se ne
   vanno e nomina ognuno di quelli che contengono commit che non esistono altrove.

L’eliminazione è un’operazione con una sola voce di annullamento: **Annulla**
ricrea ogni branch eliminato sul commit esatto a cui puntava, con il suo upstream
(`branch.<name>.remote` e `.merge`) rimesso a posto. Se nel frattempo è comparso un
branch con lo stesso nome su un altro commit — la stessa PR rimessa in checkout —,
l’annullamento lo lascia stare e riporta quello eliminato accanto, come
`<name>-restored-<short sha>`, e lo dice.

Il messaggio di successo e la voce di annullamento elencano ogni branch con il commit
a cui puntava (`feature/x (was abc1234)`), come lo stampa `git branch -D`: la
cronologia degli annullamenti vive solo finché l’app è aperta, e quella riga basta
per ricreare un branch a mano.

## Perché un branch è elencato

| Etichetta | Significa |
|---|---|
| **Sparito** | Il branch segue un upstream che il server ha eliminato — la traccia abituale di una pull request unita. |
| **Unito** | Ogni suo commit è già nel branch predefinito. Il tooltip nomina la copia che lo contiene — `main (local, not pushed)` quando ce l’ha solo la tua copia locale. |
| **Squash** | Trovato da **Controlla i merge squash**: il suo contenuto è nel branch predefinito, i suoi singoli commit no. |
| **Inattivo** | Nessun commit da quanti mesi scegli (3 di predefinito). Elencato solo se spunti **Elenca anche i branch inattivi**. |
| **N commit esistono solo qui** | Commit che non sono su nessun branch di tracciamento remoto né nel branch predefinito. Eliminare il branch li elimina. |
| **Ancora nessun commit** | Punta esattamente alla punta del branch predefinito — probabilmente creato e mai usato. |

«Unito» si misura rispetto alla copia remota del branch predefinito (`origin/main`),
e anche rispetto a quella locale — un `main` locale che nessuno aggiorna da un mese
non può nascondere le unioni fatte da allora.

## Merge squash

Un merge squash mette le modifiche di una pull request su `main` come un unico
commit nuovo; i commit del branch non arrivano mai. Per git, un branch così sembra
lavoro abbandonato: **Sparito**, con *N commit esistono solo qui*.

Quando sono elencati branch spariti con commit propri, **Controlla i merge squash**
fa un’altra domanda: unire questo branch in `main` cambierebbe qualcosa? Esegue un
solo `git merge-tree` in memoria per tutti — niente checkout, niente indice —, e un
branch la cui unione lascia l’albero di `main` esattamente com’è riceve l’etichetta
**Squash** e viene spuntato come uno unito. La conferma dice che il loro contenuto è
in `main` e i loro commit no.

Il controllo viene ripetuto, sotto il lock, al momento dell’eliminazione: un branch
che non lo supera più viene rifiutato, non eliminato.

## Cosa è spuntato, e cosa non lo è mai

Spuntati all’apertura della finestra: i branch **spariti o uniti** senza **commit
propri** — più quelli squash una volta controllati. **Seleziona spariti + uniti**
rimette quella selezione.

Mai spuntato per te, e mai raggiunto da **Seleziona tutti quelli mostrati**: un
branch con commit che esistono solo qui. Spuntalo riga per riga; la conferma allora
diventa rossa e lo elenca con il numero dei suoi commit. Nemmeno i branch solo
inattivi e uno fermo sulla punta del branch predefinito vengono spuntati. Quando la
selezione include righe che l’elenco non mostra — nascoste dal filtro, o oltre le
prime 400 —, la conferma dice quante.

L’eliminazione accetta, per ogni branch, esattamente il numero di commit unici che
la conferma ha mostrato. Se nel frattempo un branch ne ha di più — o, con
**Ripeti**, ne ha guadagnati dopo l’annullamento (per esempio perché un prune ha tolto
la copia remota) —, viene rifiutato e tenuto, e la ripetizione lo segnala invece di
dichiarare il successo.

Mai elencati, e rifiutati dall’eliminazione anche se richiesti:

- il branch attuale;
- un branch in checkout in qualsiasi worktree, o in rebase in uno di essi;
- il branch predefinito;
- i [branch protetti](repo-settings.md), inclusi pattern come `release/*` dalla
  [configurazione del repository](repo-config.md).

Sul remote non cambia nulla. Questo elimina solo branch locali.

## Limiti

- **I merge squash sono invisibili a git** finché non controlli. Senza **Controlla
  i merge squash**, un branch unito con squash appare come **Sparito** con *N commit
  esistono solo qui*, e non è spuntato.
- **Il controllo squash può sbagliare.** Risponde a «questo contenuto è già in
  `main`?». Quando `main` ha poi cambiato di nuovo le stesse righe, o lo squash è
  stato modificato durante l’unione, il merge cambierebbe qualcosa, e il branch resta
  senza spunta. Non dice mai sì a torto in un modo che perda contenuto: il contenuto
  è in `main` per definizione. Come il [radar dei conflitti](conflict-radar.md),
  scrive oggetti albero sciolti che `git gc` ripulisce.
- **Un remote senza fetch è vecchio.** «Sparito» viene dall’ultimo fetch. Senza
  **Fetch e prune**, un branch eliminato sul server un’ora fa sembra ancora vivo, e
  un’unione recente non è ancora in `origin/main`.
- **Inattivo è solo una data.** Tre mesi tranquilli non dicono nulla su quanto il
  lavoro sia al sicuro, per questo le righe inattive non sono mai spuntate.
- **«Altrove» sono i ref di tracciamento remoto dell’ultimo fetch**, non il server in
  questo momento — e non i tag. Un commit tenuto solo da un tag conta come unico, e
  un commit che sta sul branch remoto di qualcun altro no.
- Il conteggio dei commit unici si ferma a 500 e mostra *500+*. Il totale della
  conferma è un minimo — *almeno N* — perché i branch impilati condividono commit.
- L’annullamento ripristina il branch e il suo upstream, non il suo reflog né altre
  impostazioni `branch.<name>.*`.
- La finestra mostra le prime 400 righe di un elenco lungo; il filtro trova il
  resto. **Seleziona spariti + uniti** vale per ogni riga, mostrata o no.

**Vedi anche:** [Branch, remote e barra laterale](branching.md) · [Fetch, pull e push](syncing.md) · [Pagina delle pull request](pull-requests.md)
