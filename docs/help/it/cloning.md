---
title: Clonare
category: Per iniziare
order: 2
summary: Clona da un URL o direttamente dal tuo host — e restringi ciò che scarichi quando il repository è enorme.
keywords: clone clona background sfondo annulla cancel abort più multipli molti batch repository seleziona tutti shallow depth profondità partial filter blob none single branch sottomoduli submodules recursive ls-remote selettore branch picker unshallow monorepo
source: 3d8942b1073ef47bd000c7887afb5ea8cdebcdd7
---

# Clonare

**Nuovo repository → Clona**, oppure `⌘K` → *Clona*. Incolla un URL, o accedi a
GitHub, GitLab, Bitbucket o Azure DevOps e scegli fra i tuoi repository — il
token del [profilo](profiles.md) selezionato viene usato per il clone e poi
scartato, mai scritto dentro `.git/config`.

Scegli una cartella genitore e un nome; la riga sotto i campi mostra esattamente
dove finirà il repository. Una cartella già esistente viene rifiutata, non
fusa con il clone.

## Più repository insieme

Configurare un computer nuovo, o scaricare tutti i servizi di un team, voleva
dire aprire questa finestra una volta per repository. In una scheda dell'host,
spunta la casella di ogni repository che ti serve, oppure **Seleziona tutti i
mostrati** per prendere tutto ciò che corrisponde al filtro. Un clic sulla riga
(non sulla sua casella) sceglie ancora quel solo repository.

Con più di uno spuntato, la finestra li clona tutti nella stessa cartella
genitore, ciascuno in una cartella con il nome del repository. I percorsi sono
elencati prima di partire. Se due hanno lo stesso nome (`org-a/app` e
`org-b/app`), entrambi ricevono il proprietario nel nome della cartella
(`org-a-app`, `org-b-app`) invece di contendersi la stessa cartella.

![La scheda GitHub della finestra di clone con tre repository spuntati, le cartelle in cui finiranno elencate sotto la cartella genitore e un pulsante Clona 3 repository](../../screenshots/clone-multi-select.webp)

Il gruppo va dritto al vassoio nell'angolo. Tre clone girano alla volta e gli
altri aspettano come *In coda*; ognuno ha il proprio annulla. Ogni repository si
apre in una scheda appena finisce.

Limiti:
- **Branch da cui partire** è nascosto per un gruppo: il nome di un branch non
  significa nulla tra repository diversi, quindi ognuno riceve il proprio branch
  predefinito. Le altre opzioni Avanzate (parziale, shallow, un solo branch,
  sottomoduli) valgono per tutti.
- La selezione multipla funziona solo nelle schede degli host. La scheda URL
  accetta un solo URL.
- Un fallimento non ferma gli altri. Un repository la cui cartella esiste già
  fallisce con il proprio errore e gli altri vanno avanti.

## Avanzate — restringere il clone

Tutto ciò che sta sotto **Avanzate** è disattivo di default: lascialo stare e
ottieni un clone normale e completo. Si guadagna il suo posto sui repository dove
"completo" significa venti minuti e parecchi gigabyte.

![La finestra di clone con le opzioni avanzate aperte: partial, shallow, single-branch, sottomoduli e il selettore di branch](../../screenshots/clone-advanced.webp)

| Opzione | Cosa fa git | Cosa costa |
|--------|---------------|---------------|
| **Clone parziale** | `--filter=blob:none` | Storia completa, senza contenuti dei file. I blob arrivano su richiesta, quindi aprire un file vecchio richiede la rete. |
| **Clone shallow** | `--depth=N` | Esistono solo gli N commit più recenti. Blame, log, bisect e range-diff si fermano al taglio. |
| **Un solo branch** | `--single-branch` | Gli altri branch restano sul remote finché non li recuperi. |
| **Clona i sottomoduli** | `--recurse-submodules` | Anche ogni sottomodulo viene fatto uscire — più tempo adesso, nessuna directory mancante dopo. |
| **Branch da cui partire** | `--branch <name>` | Parte da quel branch invece che da quello predefinito del remote. |

**Partial prima di shallow.** Un clone parziale conserva ogni commit — la storia
resta ricercabile e vengono recuperati pigramente solo i contenuti dei file. Un
clone shallow invece la storia la butta via davvero: `git log` finisce al taglio
e il blame non riesce a guardare oltre. Se stai clonando un monorepo per
lavorarci, di solito quello che vuoi è il parziale.

Lo shallow è reversibile: `git fetch --unshallow` nel [terminale](terminal.md)
riempie di nuovo la storia.

### Scegliere il branch

Scrivi il nome di un branch, oppure premi **Elenca i branch** per chiedere al
remote cos'ha (`git ls-remote --heads`) e sceglierlo da un menu a tendina. È un
solo giro di rete, fatto solo quando premi il pulsante: mentre digiti non viene
interrogato nulla.

Se l'elenco fallisce — un URL privato senza token, un refuso, niente rete — il
campo resta una normale casella di testo e sarà il clone stesso a riportare
l'errore vero.

### Due note sui flag

- **`--depth` implica `--single-branch`.** Con un clone shallow, lasciare *Un
  solo branch* non spuntato è ciò che richiede indietro gli altri branch
  (`--no-single-branch`), ed è per questo che il suggerimento sotto cambia.
- **Clonare una cartella locale** normalmente ignora del tutto `--depth`, perché
  git crea hardlink allo store degli oggetti invece di scaricare. Gitcito clona
  attraverso un URL `file://` quando chiedi una copia shallow di un repository
  locale, così la profondità che hai chiesto è la profondità che ottieni.

## Avanzamento, sfondo e annullamento

La barra riporta ciò che riporta git: conteggio, compressione, ricezione,
risoluzione, checkout. Una fase che non è in grado di dichiarare un totale mostra
una barra indeterminata invece di una percentuale finta.

Un clone grande richiede minuti, e un clic distratto fuori dalla finestra te li
faceva perdere tutti. Ora chiudere la finestra — **Esegui in background**, `Esc`,
la ✕ o un clic fuori — la nasconde soltanto: il clone continua e passa a una
piccola scheda nell'angolo in basso con la stessa barra di avanzamento. Nel
frattempo puoi avviare un altro clone; ognuno ha la sua scheda.

![Il vassoio dei clone nell'angolo in basso: tre clone in ricezione, risoluzione e conteggio, un quarto in coda, ciascuno con il proprio pulsante di annullamento](../../screenshots/clone-tray.webp)

Hai scelto il repository sbagliato? **Annulla clone** nella finestra, o la ✕
sulla sua scheda, ferma git ed elimina la cartella scritta a metà. Nient'altro
viene toccato: la cartella non esisteva prima dell'inizio del clone, e lo si
verifica in anticipo. Un clone annullato non si può riprendere; riavviarlo
ricomincia da zero.

Quando finisce, il nuovo repository si apre in una scheda, ancorato al profilo
con cui hai clonato, che la finestra sia ancora aperta o no.

I clone girano dentro l'app, quindi chiudere Gitcito li ferma. La chiusura non
aspetta la pulizia, quindi la cartella scritta a metà può restare: eliminala
prima di clonare di nuovo lì, perché la finestra rifiuta una cartella esistente.
