---
title: Risolvere i conflitti
category: Lavorare con le modifiche
order: 32
summary: Una sola schermata per l'intero passo in conflitto — ogni file, l'antenato comune, una risposta per conflitto e il traguardo.
keywords: conflitto conflict risolutore resolver merge ours theirs base antenato comune risolvi marcatori tre vie eliminato rinominato modify delete rename rerere reuse recorded resolution ricorda replay concludi continua interrompi
---

# Risolvere i conflitti

Quando un merge, un rebase, un cherry-pick o un revert si ferma, il risolutore
trasforma l'intero passo in una sola schermata. La barra in alto dice **cosa** si
è fermato e **fra cosa e cosa** — "Merge di `feature` in `main`", non solo
"conflitto" — e a che punto sei: *2 di 5 file* risolti, con i conflitti che
restano su tutti i file.

![Il risolutore di conflitti](../../screenshots/conflict-resolver.webp)

## La striscia dei file

Sotto la barra, un chip per ogni file su cui questo passo si è fermato:

| Chip | Significa |
|---|---|
| Verde con ✓ | Risolto — in stage, niente più da decidere |
| Contornato | Il file su cui sei |
| Un numero rosso | Quanti blocchi in conflitto contiene ancora il file |
| Un'etichetta | Un conflitto senza testo da unire: *eliminato da un lato*, *rinominato su entrambi i lati*, *aggiunto da un lato* |

I chip risolti vengono prima e quelli aperti dopo, ciascun gruppo in ordine di
nome, così la striscia si legge come fatto a sinistra e ciò che resta a destra.

**File successivo →** salta al prossimo ancora aperto, e segnare un file come
risolto ti porta lì da solo. **Continua** nella barra resta disattivato finché
ogni chip non è verde; **Interrompi** chiede prima e dice cosa perdi.

git dimentica un file nel momento in cui va in stage, quindi "risolto" è ciò che
GitHuttBr ha visto durante questo passo, più i file che git ha elencato nel suo
messaggio di merge. Un file messo in stage in un terminale prima di aprire il
risolutore conta comunque; dopo un riavvio a metà di un rebase, la metà risolta
di quel passo potrebbe non contare.

## Perché questo va in conflitto

**Perché va in conflitto**, nell'intestazione del file, elenca lato per lato i
commit che hanno toccato questo file da quando i branch si sono separati — è
`git log --merge`, che git offre da sempre e che nessuno trova.

![I commit di ciascun lato che hanno toccato il file in conflitto](../../screenshots/conflict-why.webp)

I marcatori dicono cosa si scontra. Questo dice chi l'ha cambiato e perché, che
di solito è ciò che decide davvero la risoluzione. Se lì non c'è niente,
significa che nessuno dei due lati ha committato una modifica esattamente a
questo percorso: lo scontro è nato da una rinomina o da uno spostamento.

L'intestazione dice anche su quale conflitto sei e di che tipo è il conflitto del
file, letto dallo stato di git stesso: *entrambi i lati hanno cambiato le stesse
righe*, *aggiunto su entrambi i lati*.

## I tre pannelli

| Pannello | Cos'è |
|---|---|
| **Il tuo lato** | Il lato su cui eri, intestato con il commit più recente di quel lato che ha toccato il file: sha, oggetto, autore, quanto tempo fa |
| **Base** | La versione da cui sono partiti entrambi i lati — l'antenato comune o, per un pick o un passo di rebase, il genitore del commit che si sta applicando. Le righe che ciascun conflitto ha sostituito sono ombreggiate |
| **In arrivo** | Il lato in arrivo, intestato come Il tuo lato |

**Mostra la base**, nell'intestazione del risultato, nasconde o mostra il
pannello Base e ricorda la tua scelta. È disattivato quando non c'è una base —
entrambi i lati hanno aggiunto il file.

Tutti i pannelli sono ridimensionabili, e l'intestazione del risultato porta due
interruttori di vista:

| Interruttore | Cosa fa |
|---|---|
| **A capo** | Manda a capo le righe lunghe dentro i pannelli laterali invece di scorrerle. La vista testo del risultato mantiene una riga per riga — i suoi marcatori laterali dipendono da questo — quindi scorre sempre |
| **Collega lo scorrimento** | Fa scorrere i pannelli e il risultato insieme, in verticale e in orizzontale. I loro conteggi di righe differiscono, quindi la posizione verticale viene allineata in proporzione |

A capo parte disattivato, Collega lo scorrimento parte attivato, ed entrambi
ricordano il proprio stato.

## Il risultato

Il risultato è il file così come verrà scritto. Ogni conflitto sta al suo posto
come una scheda con quattro risposte:

| Risposta | Cosa finisce nel file |
|---|---|
| **Usa il tuo** | Le tue righe, e solo le tue |
| **Usa il loro** | Le loro righe, e solo le loro |
| **Entrambi** | Le tue righe, poi le loro |
| **Modifica** | Entrambi, aperti nell'editor di testo con il conflitto selezionato, per quando la risposta è "entrambi, ma ritoccati" |

Una scheda senza risposta mostra l'anteprima di entrambi i lati, ogni riga
etichettata *← tuo* o *← loro* e numerata con la riga su cui finirà se la scegli,
così decidi senza alzare lo sguardo. In un file con righe molto lunghe le
risposte restano visibili mentre il codice scorre in orizzontale sotto di loro.
**File intero: il tuo | il loro**, nell'intestazione del file, risponde a tutti i
conflitti in una volta.

**Modifica come testo** passa il risultato a un editor semplice per scrivere
liberamente, con il numero di righe del file nell'intestazione. Una volta che
hai scritto, le schede non descrivono più ciò che c'è, quindi il testo resta
finché **Azzera le scelte** non rimette tutto com'era.

Il piè di pagina conta ciò che resta in questo file; **Segna *file* come
risolto** scrive il risultato e lo mette in stage, ed è disattivato finché ogni
conflitto non ha una risposta.

## Muoversi

Aprendo un file atterri sul suo **primo conflitto**, non in cima al file. Le
frecce ⌃ / ⌄ nell'intestazione del risultato — o <kbd>Alt+↑</kbd> /
<kbd>Alt+↓</kbd> — passano in rassegna gli altri, facendo scorrere ogni pannello
fino a ciascuno.

## Scegliere per riga

I pannelli laterali scelgono ancora per **riga** e per **blocco**, e la casella
nella loro intestazione prende **tutto il lato** — per la risposta che nessuna
scheda offre, come due righe tue e una loro. Le scelte per riga compaiono nelle
schede man mano che le fai.

## File senza niente da unire

Alcuni conflitti non hanno righe da confrontare: un lato ha **eliminato** un file
che l'altro ha cambiato, oppure entrambi i lati l'hanno **rinominato** con nomi
diversi. Tre pannelli di cui uno vuoto non spiegherebbero niente, quindi questi
casi ricevono una scheda — chi ha fatto cosa, con il commit, l'autore e l'età di
ciascun lato.

![Un file eliminato da un lato e cambiato dall'altro](../../screenshots/conflict-deleted.webp)

| Caso | Scelte |
|---|---|
| Eliminato da un lato | **Tieni il file** (con le modifiche fatte dall'altro lato), **Elimina il file** (chiede prima) e **Vedi cosa hai cambiato** — il diff dalla base, così sai cosa butta via l'eliminazione |
| Rinominato su entrambi i lati | **Tieni** un nome, l'altro, o **entrambi i nomi** |

git non registra alcun legame fra un originale rinominato e i suoi due nuovi
nomi, quindi la scheda li abbina per contenuto. Quando non riesce a capirlo —
più rinomine insieme, e in più i file sono cambiati — lo dice, e i nuovi nomi
compaiono come chip a sé.

## Concludere

Quando l'ultimo file è risolto, l'area di lavoro non ti manda a cercare
**Continua**: una scheda riassume come sono stati risolti i conflitti, ti lascia
modificare il messaggio di merge (precompilato con quello di git) e conclude da
lì.

![Tutti i conflitti risolti, con il messaggio di merge e l'interruttore di rerere](../../screenshots/conflict-done.webp)

- Il riepilogo conta ciò che ti ha visto scegliere: il tuo, il loro, entrambi,
  modificato a mano. Un file risolto fuori dal risolutore conta come file, non
  come risposta.
- Un passo di **rebase** mantiene il messaggio del commit riapplicato, quindi non
  c'è una casella per il messaggio.
- **Ricorda queste risoluzioni (rerere) per la prossima volta** è il
  `rerere.enabled` di git, lo stesso interruttore delle Impostazioni. git ricorda
  solo i conflitti che ha visto accadere, quindi attivarlo qui ha effetto dal
  prossimo.
- **Rivedi** chiude il risolutore sul risultato in stage.

## Annullare

Ogni risoluzione — un file segnato come risolto, un lato preso, un file tenuto o
eliminato, una rinomina sistemata — ha una voce di annullamento. Annullare
rimette il conflitto esattamente come git l'aveva lasciato: i marcatori, entrambi
i lati e la base nell'indice, il file su disco. **Interrompi** è l'unica cosa che
non si può annullare, ed è per questo che chiede.

## Assistenza AI

Con l'AI attiva, **Risolvi con l’IA** propone un merge nel risultato, come testo.
Non applica mai niente da solo: lo leggi, lo modifichi e lo metti in stage. Vedi
[Funzioni AI](ai.md).

## File di progetto Xcode

`project.pbxproj` va in conflitto più di qualsiasi altro file di un repository
iOS, e quasi mai perché qualcuno fosse in disaccordo. È un unico dizionario
piatto di oggetti con chiavi esadecimali di 24 cifre, quindi aggiungere un file
scrive quattro voci: un `PBXBuildFile`, un `PBXFileReference`, una riga nei
`children` del gruppo che lo contiene e una nella fase di build del target. Due
persone che aggiungono un file a testa scrivono otto voci che finiscono sulle
stesse poche righe. Git vede una collisione; non c'è nulla da risolvere.

Quando il file in conflitto è un `project.pbxproj`, il risolutore legge tutte e
tre le versioni come progetti anziché come testo e propone di **unire per
struttura**: accoppiare gli oggetti per identificatore, prendere ogni aggiunta
da entrambe le parti, unire gli array `children` e `files` e fermarsi su ciò che
è davvero divergente. La fascia sopra i pannelli dice cosa ha aggiunto ciascuna
parte e cosa — se qualcosa — resta a te.

Come la proposta dell'IA, atterra nel risultato e non mette nulla in
stage. La leggi prima di salvare.

![La fascia di unione strutturale sopra i pannelli di conflitto, su un file di progetto Xcode](../../screenshots/conflict-pbxproj.webp)

### Cosa si rifiuta di fare

**Non indovina mai un'impostazione che avete spostato entrambi.** Se tu metti
`MARKETING_VERSION` a `1.1` e loro a `2.0`, quella è una decisione, ed è nominata
nella fascia — l'impostazione, il tuo valore, il loro — invece di essere risolta
alle tue spalle. Un oggetto che non ha potuto dirimere conserva *la tua*
versione esatta, così un'unione applicata a metà non raggiunge mai il disco.

**Rifiuta l'intero file se una delle tre versioni non si analizza.** Un
`project.pbxproj` che Xcode non riesce ad aprire costa più di un'unione manuale,
quindi tutto ciò che non può leggere con certezza resta un normale conflitto
testuale, e lo dice.

**Non rileva due identificatori coniati per oggetti diversi.** È raro, perché
Xcode li sceglie a caso, ma quando succede prendere una delle due parti
scarterebbe in silenzio il file di qualcuno, quindi viene segnalato invece che
unito.

### Non `merge=union`

Il rimedio che circola per questo è `*.pbxproj merge=union` in
[`.gitattributes`](attributes.md). Evitalo. L'unione funziona finché gli unici
cambiamenti sono aggiunte indipendenti, e nel momento in cui due persone
modificano la stessa impostazione di build emette entrambe le righe e produce un
file che Xcode si rifiuta di aprire — proprio quando è meno probabile che tu stia
leggendo il diff con attenzione. L'unione strutturale dà la stessa comodità senza
quel guasto.

## Lockfile

`Podfile.lock`, `Package.resolved`, `yarn.lock` e i loro cugini registrano un
grafo di dipendenze che il resolver di qualcuno ha già risolto. Metà di una
soluzione cucita a metà di un'altra è un grafo che non ha risolto nessuno: può
non installarsi, e se si installa, installa qualcosa che nessuno dei due rami ha
provato.

Così, quando il file in conflitto è un lockfile, la fascia nomina lo strumento
che lo governa, offre lì stesso **Tieni i nostri** e **Tieni i loro**, e ti dà
il comando che lo rigenera dopo. Scegliere una parte qui non è un compromesso —
è tutto il metodo, e la rigenerazione è ciò che lo rende corretto.

![La fascia del lockfile sopra i pannelli di conflitto](../../screenshots/conflict-lockfile.webp)

I tre pannelli restano disponibili, perché ogni tanto vuoi davvero leggere cosa
è cambiato: un checksum che riconosci, una versione che ti aspettavi.
Modificarli a mano è proprio ciò da cui questo cerca di dissuaderti.

## Evitarli in partenza

Il [radar dei conflitti](conflict-radar.md) ti dice quali branch andranno in
conflitto prima che tu ne fonda uno.

## Lasciare che git ricordi (rerere)

Fai il rebase di un branch di lunga vita e incontri ogni volta lo stesso
conflitto. `rerere` — *reuse recorded resolution* — è la risposta di git:
memorizza come hai sistemato un conflitto e ripropone quella risposta la volta
successiva che ne compare uno identico.

**Impostazioni → Git e sincronizzazione → Ricorda le risoluzioni dei conflitti.** Scrive
`rerere.enabled` nella tua configurazione git globale, così anche la riga di
comando si comporta allo stesso modo.

Quando git ha risposto al posto tuo, il risolutore lo dice invece di mostrare una
schermata vuota con scritto "nessun marcatore di conflitto", e offre **Dimentica
questa risoluzione** — che cancella il ricordo *e* riporta indietro il conflitto,
così puoi sistemarlo diversamente.

Due cose che conviene sapere:

- **Una risoluzione riproposta non viene messa in stage** a meno che tu non
  attivi *Metti automaticamente in stage una risoluzione riproposta*. Lascialo
  spento: il senso della pausa è che una risposta memorizzata può essere
  sbagliata per questo particolare merge, e mettere in stage senza guardare è
  esattamente il modo in cui arriva a un commit.

  È per questo che un file riproposto **resta fra i File in conflitto**: git ha
  scritto il contenuto, ma l'indice lo tiene ancora come non fuso, e solo lo
  staging chiude la questione. A muoverlo è **Metti in stage così com'è** nel
  risolutore, oppure **Segna tutto come risolto** nell'elenco.
- **rerere non capisce ogni conflitto.** I conflitti add/add e delete/modify non
  producono alcuna preimmagine, quindi tornano sempre grezzi. Il conteggio nelle
  impostazioni dice quanti ne conserva davvero, e **Dimentica tutto** lo svuota.

**Vedi anche:** [Radar dei conflitti](conflict-radar.md) · [Merge e rebase](merging.md)
