---
title: Funzioni AI
category: AI
order: 80
summary: Opzionali, indipendenti dal provider e ancorate al tuo codice reale.
keywords: ai ia openai anthropic ollama llm locale messaggio di commit spiega review wiki grounded account chiave api abbonamento cli claude codex gemini modelli lento timeout impiegando più del previsto continua ad attendere annulla non risponde ollama chiuso cambia account altro account preferenze di scrittura stile dei commit istruzioni personalizzate coautore hover spiegazione ia propria ia generale
---

# Funzioni AI

Ogni funzione AI è **opzionale** e resta spenta finché non configuri un provider.
Niente viene inviato da nessuna parte finché non chiedi qualcosa di preciso.

![Impostazioni AI](../../screenshots/settings-ai.webp)

## Una sola IA per tutti i profili

L'IA si configura una volta, in **Impostazioni → IA**, e ogni [profilo](profiles.md)
la usa: un profilo creato in seguito ha già l'IA, senza account da aggiungere di
nuovo. La pagina elenca ogni profilo e se segue questa **IA generale**.

Un profilo può usare invece **la propria IA** — un profilo di lavoro che deve
passare dall'account dell'azienda, per costi o per politiche sui dati, o che
scrive i suoi commit in un altro modo. Nella pagina **Profilo** di quel profilo,
sotto *IA di questo profilo*, passa da **Generale** a **Propria**: parte come
copia di tutta l'IA generale — account, chiavi e preferenze — e da lì in poi
tutto questo è solo suo. Tornare a **Generale** la rimuove, dopo una conferma, e
lascia l'IA generale com'era.

Un profilo usa un'IA **intera**: quella generale o la propria, mai un miscuglio.
Gli account e i modelli *e* il modo in cui l'IA scrive e ciò che la chat può
fare vengono dallo stesso posto, quindi cambiare lo stile dei commit nell'IA
generale lo cambia per ogni profilo che la segue.

Ogni IA si configura in questa sola pagina. La barra **Modifica di** in alto
sceglie quale: l'IA generale, o quella propria di un profilo (*IA propria di
Lavoro*). **Configura l'IA propria** nella pagina Profilo, o **Modifica la sua
IA** nell'elenco dei profili, apre la pagina su quella. La pagina Profilo mostra
soltanto quale IA usa il profilo e chi risponde — non ospita mai l'editor, né
alcuna opzione di IA propria.

![L'IA di un profilo nella sua pagina Profilo: Generale o Propria, chi risponde e come configurarla](../../screenshots/settings-profile-ai.webp)

Sotto gli account, la stessa pagina contiene come quell'IA **scrive** e che cosa
può fare, in sezioni:

| Sezione | Contiene |
|---|---|
| **Messaggi di commit** | Lo stile dei commit — Conventional, Gitmoji e Ticket come schede con una riga di esempio, gli altri sotto *Altri stili* — *Genera la descrizione del commit*, la riga del co-autore, **Regole extra per i commit** e un’anteprima |
| **Spiegazione e hover** | Stile delle spiegazioni, *Spiega il codice al passaggio del mouse* e il suo tasto modificatore |
| **Conflitti e branch** | Stile di risoluzione dei conflitti, stile dei nomi dei branch, ognuno con un esempio del risultato |
| **Chat del repository** | Se la chat è attiva, che cosa legge, le azioni che può proporre — vedi [Chat del repository](repo-chat.md#impostazioni) |

Una riga sopra le sezioni dice di chi è l’IA che stai modificando e chi
raggiunge: *IA generale · vale per Lavoro e Personale*, oppure quella propria di
un profilo.

Le **Regole extra per i commit** — *Istruzioni personalizzate* fino alla 4.60 — entrano solo nella generazione dei messaggi di commit: chat, spiegazioni, revisioni e nomi dei branch non le leggono. L’anteprima è un esempio fisso, non una chiamata al modello: mostra la forma dello stile scelto, non quello che l’IA scriverà per la tua modifica.

![Messaggi di commit](../../screenshots/settings-ai-commits.webp)

Il selettore di stile del compositore e i selettori di modello e di approvazione
della chat scrivono nella stessa IA che il profilo legge: quella generale o
quella propria del profilo.

Aggiornare da una versione in cui ogni profilo aveva la propria IA non fa perdere
nulla: l'IA del profilo in uso diventa l'IA generale, e ogni altro profilo con
un'IA diversa la conserva come propria.

**Aggiornare dalla 4.59 o precedenti**, quando le preferenze di scrittura
stavano in ogni profilo: una sola volta, le preferenze del profilo in uso (o, se
quello ha un'IA propria, del primo profilo sull'IA generale) passano all'IA
generale. I profili con un'IA propria tengono le loro. **Il limite:** se due
profili sull'IA generale scrivevano in modo diverso — uno di lavoro con `ticket`
e uno personale con `conventional` — ora entrambi scrivono come quello che è
stato spostato. Per mantenere la differenza, dai a uno dei due un'IA propria e
reimposta lì il suo stile.

## Fornitori

Un **account** è un modo di raggiungere un modello: un provider, dove
contattarlo e come si autentica. Puoi configurarne diversi e convivono — una
chiave di lavoro, una personale, un modello locale, una CLI con cui hai già
fatto l'accesso.

I preset coprono **OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral**
e **Ollama** (interamente locale), oltre a qualunque endpoint compatibile con
OpenAI.

**Una chiave non lascia mai questa macchina in chiaro.** Un account con chiave
raggiunge il suo endpoint via `https://`, o via `http://` semplice solo su
questo computer (`localhost`, `127.x`, `::1`). Una chiamata che invierebbe la
chiave via `http://` a un altro host viene rifiutata prima che parta qualcosa, e
lo dice. Un endpoint senza chiave — Ollama su un’altra macchina della tua rete —
continua a funzionare via `http://`.

Anthropic usa la propria API `/v1/messages` invece di una chiamata in forma
OpenAI, quindi i modelli Claude funzionano davvero anziché sembrare
funzionanti. Gemini viene raggiunto tramite l'endpoint compatibile con OpenAI di
Google.

### L’elenco dei fornitori

Ogni fornitore salvato è una scheda: una lettera per il fornitore, il nome e,
sotto, cosa usa davvero — così due account dello stesso fornitore si distinguono
senza aprirne nessuno.

| Tipo di fornitore | Seconda riga |
| --- | --- |
| Abbonamento o CLI locale | `CLI claude · sonnet` — il comando, poi il modello |
| Ollama o server personalizzato | `http://localhost:11434 · qwen3:8b` — l’indirizzo, poi il modello |
| API ospitata | `gpt-4o-mini · 41 modelli` — il modello, e quanti ne ha elencati il fornitore |

Il numero di modelli compare solo dopo che il fornitore li ha elencati; l’elenco
integrato su cui GitHuttBr ripiega è una stima, non un conteggio. Il badge di
stato sta a destra. La scheda che stai modificando ha un bordo d’accento; una
che non risponde ha un bordo rosso e il motivo sotto il nome, che termina con
**Verifica di nuovo**. Fai clic su una scheda per aprirla nell’editor sotto
l’elenco.

### Aggiungere e modificare un fornitore

Un fornitore salvato a metà era una trappola silenziosa: una chiave vuota poteva
finire in uso e nulla rispondeva. Per questo nulla in questa
scheda viene salvato mentre scrivi.

**Aggiungi fornitore** apre una scheda segnata **Bozza · non salvata**, con il bordo
tratteggiato. Compila fornitore, chiave, endpoint e modello, poi scegli
**Verifica e salva**. GitHuttBr prima elenca i modelli del fornitore con
quella chiave — la stessa richiesta del pulsante di aggiornamento accanto a **Modello** — e salva solo se
risponde. Vedi **Connesso · N modelli** e il fornitore entra nell'elenco come
**Pronto**.

Se il test fallisce, la scheda mostra **Impossibile connettersi** con il
motivo del fornitore (una chiave rifiutata, `401`; un server non avviato) e
**Non è stato salvato nulla.** Correggi il campo e riprova, scegli
**Salva comunque** per tenerlo così — allora appare come
**Non risponde** — oppure **Annulla**, che non lascia traccia.

Modificare un fornitore salvato funziona allo stesso modo. Un banner dice
**Modifiche non salvate: non cambia nulla finché non salvi** e ogni campo toccato è segnato
**· modificato**. **Annulla modifiche** ripristina i valori salvati;
**Verifica e salva** verifica e salva. Scegliere un altro fornitore,
aggiungerne uno o aprire **Usa il mio abbonamento** con modifiche in sospeso chiede
**Salvare le modifiche a «…»?** — **Salva**, **Annulla modifiche** o
**Continua a modificare**. Chiudere le Impostazioni conserva la bozza in
memoria, così la ritrovi al ritorno; non viene mai scritta su disco.

Le chiavi si salvano esattamente come prima, nel portachiavi, e solo al
salvataggio. L'errore di un fornitore viene mostrato con la chiave e qualsiasi
cosa simile a un token mascherate.

![Aggiungere e modificare un fornitore](../../screenshots/ai-provider-draft.webp)

![Modificare un fornitore salvato: l’indirizzo è cambiato e non è ancora salvato](../../screenshots/ai-provider-editing.webp)

| Tipo di fornitore | Cosa verifica **Verifica e salva** |
| --- | --- |
| Chiave API o server locale (Ollama, endpoint personalizzato) | Elenca i modelli; il successo significa che l'endpoint ha risposto con quella chiave |
| Abbonamento (Codex, Claude Code) | Invia il breve prompt di prova descritto sotto, dalla quota del tuo piano |
| CLI locale | Cerca il comando nel tuo `PATH`; un percorso digitato viene salvato senza verifica |

### Badge di stato

Ogni fornitore dell'elenco ha un badge, ricavato da ciò che la pagina sa già —
l'ultimo test, o l'elenco di modelli recuperato comunque. Nulla viene
interrogato in background.

| Badge | Significato |
| --- | --- |
| **Pronto** | L'ultimo test o elenco di modelli è riuscito |
| **Non risponde** | L'ultimo tentativo è fallito; il motivo è nella riga sotto, con **Verifica di nuovo** |
| **Nessuna chiave** | Il fornitore richiede una chiave API e non ce l'ha |
| **Non verificato** | Nulla l'ha ancora interrogato — un abbonamento finché non viene testato, o un elenco non recuperato |

**Il limite:** un badge è aggiornato quanto la sua ultima verifica. Un fornitore
che ha smesso di rispondere un'ora fa resta **Pronto** finché
qualcosa non lo interroga di nuovo — scegli **Verifica connessione** sulla sua scheda
per esserne certo. Una **CLI locale** con percorso digitato resta
**Non verificato**, perché dimostrare che funziona costerebbe un
prompt.

### Il fornitore in uso

Un fornitore risponde a ogni attività che non ha un fornitore proprio in
**Modello per attività**. La sua scheda termina con un **In uso** verde, dove le altre schede hanno
**Usa**, e resta al suo posto nella lista. Il verde significa solo in uso: un
fornitore che risponde ma non è in uso dice **Pronto** in un grigio-azzurro
discreto. L’AI generale e un profilo
con la propria AI hanno ciascuno il proprio fornitore in uso; la lista cambia
quello che stai modificando.

Ogni altro fornitore salvato ha un pulsante **Usa** a destra della sua riga,
accanto al badge. Un clic lo mette in uso e salva subito: quale fornitore
risponde è una scelta, non una modifica, quindi non aspetta **Verifica e salva**.
La scheda di quel fornitore non si apre, e una scheda con modifiche non salvate
le conserva.

**Il limite:** **Usa** non verifica nulla. Un fornitore segnato **Nessuna
chiave** o **Non risponde** può essere messo in uso — di proposito, prima di
sistemarne la chiave — e il suo badge continua a dirlo; la prossima attività AI
fallisce con il motivo di quel fornitore. Una bozza non ha **Usa**: diventa un
fornitore solo dopo il salvataggio.

### L'IA in uso, dalla barra di stato

Un profilo con una propria IA ignora il fornitore in uso dell'IA generale:
mettere in uso un altro fornitore sull'IA generale non cambia nulla per quel
profilo, e fuori dalle impostazioni niente lo diceva. La barra di stato, in
fondo a un repository, ora lo dice. Il pulsante **IA:** _fornitore_ indica il
fornitore che risponde per il profilo attivo, con un punto per il suo stato —
verde **Pronto**, rosso **Non risponde**, ambra **Nessuna chiave**, grigio **Non
verificato**. Quando il fornitore è **Pronto** l’intero pulsante diventa
verde, così un’IA che funziona non sembra spenta.

Un clic apre un piccolo pannello:

| Parte | Cosa mostra |
| --- | --- |
| Intestazione | Il profilo attivo, e se **segue l'IA generale** o **ha una propria IA** |
| Una riga per fornitore | Ogni fornitore salvato di quell'IA, con modello e stato; uno che non risponde mostra il motivo su una seconda riga |
| **In uso** / **Usa** | Il fornitore che risponde ora, e il cambio con un clic su ciascuno degli altri |
| **Configura IA** | Apre **Impostazioni → IA** |
| **Utilizzo e costi** | Apre la scheda *Statistiche* delle impostazioni del repository |

**Usa** scrive dove il profilo legge la sua IA. Su un profilo che segue l'IA
generale cambia l'IA generale — e quindi ogni profilo che la segue; su un
profilo con una propria IA cambia solo quella. Le attività con un fornitore
proprio lo mantengono. **Esc** chiude il pannello, e il pulsante è nascosto
finché l'IA è disattivata.

![L'IA in uso dalla barra di stato: il profilo, la sua IA e ogni fornitore con il suo stato](../../screenshots/statusbar-ai.webp)

**I limiti:** il punto è ricavato dall'elenco dei modelli che l'app ha già
recuperato (conservato fino a un giorno) e non testa mai nulla, quindi un
fornitore che ha smesso di rispondere può ancora apparire **Pronto** — provare
la connessione nelle impostazioni è il modo per esserne certi. Finché le
impostazioni non sono state aperte, la finestra non ha le chiavi vere e
proprie, quindi un fornitore senza chiave può apparire **Non verificato** o
**Non risponde** invece di **Nessuna chiave**. Come **Usa** nelle impostazioni,
il cambio non testa il fornitore che mette in uso.

### Usare un abbonamento al posto di una chiave API

In **Impostazioni → AI**, scegli **Usa il mio abbonamento**. Al [primo
avvio](first-run.md), la scheda **Il mio abbonamento** del passo AI trova Claude
Code o Codex e lo testa in un solo passo, e ripiega su questa stessa
configurazione quando non ne trova nessuno. Seleziona il piano che usi, poi apri
**Documentazione** per le istruzioni di installazione del fornitore. Una volta
installato, scegli **Collega ChatGPT (Codex)** o **Collega Claude (Claude
Code)**. La CLI del fornitore apre la sua pagina di accesso nel browser e salva
la propria sessione. Una sessione di abbonamento esistente viene riutilizzata.
**Annulla** ferma una connessione in corso. Un accesso che dura più di tre
minuti si interrompe e può essere ripetuto.

| Piano | CLI richiesta | Accesso da un terminale |
| --- | --- | --- |
| ChatGPT con accesso a Codex | Codex CLI | `codex login` e scegli ChatGPT |
| Claude con accesso a Claude Code | Claude Code | `claude auth login` e scegli il tuo account in abbonamento |

Il collegamento testa anche la sessione. Se hai fatto l’accesso da un terminale,
scegli **Prova la connessione**. GitHuttBr controlla il metodo di accesso della
CLI e invia un breve prompt di prova da una cartella temporanea vuota. La
richiesta conta sulla quota del tuo fornitore. Dopo **Collegato**, scegli
**Aggiungi fornitore**. Il primo account dell’IA generale viene messo **In
uso**. Per una configurazione esistente, scegli **Usa** sulla sua riga o assegna
singole funzioni più sotto. Per saltare la configurazione al primo avvio, scegli
**Salta, senza AI** e torna nelle Impostazioni quando sei pronto.

Se GitHuttBr non trova la CLI, installala o inserisci il percorso completo
dell’eseguibile e riprova. Se l’accesso è scaduto o la CLI usa una chiave API,
accedi con l’account in abbonamento. Se raggiungi un limite d’uso, aspetta che
la quota del fornitore si azzeri.

![Usa il mio abbonamento](../../screenshots/ai-subscription.webp)

Per la configurazione manuale, scegli il fornitore **CLI locale** per rispondere
con una CLI di agente già installata e con accesso su questa macchina —
`claude`, `gemini`, `codex` o `devin`. GitHuttBr esegue il binario con il tuo
prompt e ne legge la risposta; non c’è nessuna chiave API da incollare e nessun
token viene salvato.

GitHuttBr esegue soltanto un comando che hai configurato come account, e sempre
con un elenco di argomenti invece di una shell: nulla in un diff o nel nome di un
ramo può essere interpretato come un comando.

Ogni chiamata avvia la CLI con il repository come cartella di lavoro, così le
CLI di agente come Devin possono aprire i file di cui chiedi invece di
rispondere alla cieca. Le funzioni senza repository (generazione dei temi) la
avviano dalla cartella dell’app.

> **Questo non è più riservato di una chiave API.** I tuoi prompt raggiungono
> comunque lo stesso fornitore, con il tuo account, esattamente come con una
> chiave. Cambiano fatturazione e configurazione, non dove finisce il testo.

Se il comando non è nel tuo `PATH`, scrivi il percorso completo nell'account.

### Modello per attività

In **Modello per attività**, ogni funzione — messaggi di commit, chat,
spiegazione, revisione PR, risoluzione dei conflitti, wiki, temi — può puntare
al proprio account e modello. Lascia una riga su **Fornitore in uso** per
seguire il fornitore segnato **In uso**. Modello economico per i messaggi di
commit e uno potente per la chat è la divisione più comune.

### Avviso di aggiornamento

Aggiornando da una versione precedente agli account, questo compare una volta. Il provider e la chiave che avevi diventano il primo account; non c'è nulla da riconfigurare a mano.

![Avviso di aggiornamento](../../screenshots/ai-accounts-notice.webp)

## Modelli

Gli elenchi dei modelli arrivano dal provider stesso e restano in cache per un
giorno; **Recupera modelli** ne aggiorna uno all'istante. Sotto l'elenco GitHuttBr
dice da dove viene — in diretta, dalla cache (con la data) o dall'elenco
integrato di riserva, e perché.

L'elenco è filtrato ai modelli in grado di rispondere a una richiesta di chat, così
embedding, voce e immagini restano fuori. Ogni casella del modello accetta anche
testo libero, quindi un modello in anteprima, un deployment privato o un tag
Ollama appena scaricato è sempre utilizzabile anche se il provider non lo elenca.

Un provider a cui non hai ancora dato una chiave, o irraggiungibile, ripiega su
un piccolo elenco integrato invece che su un menu vuoto.

Nessun provider pubblica un elenco ordinato o curato, quindi la selezione è di GitHuttBr: le istantanee datate vengono ripiegate sul modello di cui sono un'istantanea (`gpt-4o` copre `gpt-4o-2024-08-06`), e il resto è ordinato dal più recente anziché alfabeticamente. **Mostra tutti i modelli**, in fondo all'elenco, riporta tutto ciò che il provider ha restituito.

## Cosa sa fare

| Funzione | Cosa ottieni |
|---|---|
| **Messaggio di commit** | Riepilogo (e corpo opzionale) dal diff in stage, nello stile che hai scelto |
| **Spiega questo file** | Spiegazione in linguaggio semplice in un pannello laterale — Normale, Conciso, ELI5… persino Pirata |
| **Passa il mouse per spiegare** | Tieni premuto <kbd>⇧</kbd> e punta un identificatore per una spiegazione di una riga, con le righe su cui si è basata |
| **Modifica con IA della selezione** | Seleziona righe in un file, descrivi la modifica, e il modello riscrive solo quelle righe nella bozza dell’editor |
| **Risoluzione dei conflitti** | Propone un merge nell'output modificabile — non lo applica mai da solo |
| **Review della PR** | Riassume un diff e segnala i rischi, ognuno ancorato a un vero `path:line` |
| **Descrizione della PR** · **nomi dei branch** | Redatti a partire dai commit e dal diff del branch |
| **Temi** · **palette del grafo** | Generati da un prompt |
| **Staging intelligente** | Suggerimenti su cosa appartiene a questo commit |
| **[Chat del repository](repo-chat.md)** | Domande ancorate più modifiche ai file revisionate, seguite da azioni Git convalidate |
| **Procedura guidata di configurazione IA** | Genera i file di configurazione dell'assistente (istruzioni, agenti, hook) per il repository — il pulsante a bacchetta nell'intestazione del pannello chat |

### Modificare solo le righe selezionate

Nella vista file, trascina sulle righe da cambiare e premi **Modifica con IA…**
(o fai clic destro su una riga e sceglila dal menu). Una barra in basso mostra
l’intervallo selezionato e riceve la tua istruzione — «rinomina questa
variabile», «aggiungi controlli sui null», «traduci queste stringhe». Il modello
vede le righe selezionate più un po’ di contesto intorno e restituisce solo la
sostituzione per quell’intervallo, che finisce nella **bozza dell’editor** e non
su disco. La rivedi lì e salvi o scarti con il normale flusso di modifica,
quindi nulla viene scritto finché non lo decidi tu. Funziona con ogni backend
configurato, non solo con le CLI di agente, perché la risposta è testo, non una
chiamata a uno strumento. I limiti: riscrive un intervallo contiguo alla volta,
non può creare né eliminare file interi, e una selezione che attraversa più hunk
di un diff viene rifiutata — seleziona invece nella vista file.

## Ancorata, non improvvisata

La review vede il diff come **hunk etichettati** e può citare solo quelle
etichette; poi è GitHuttBr a risolvere ogni etichetta in un file e una riga reali.
Un modello che si inventa una posizione viene **rifiutato e interrogato di
nuovo**, così le segnalazioni puntano sempre a codice che esiste davvero.

La spiegazione al passaggio del mouse legge solo una finestra numerata attorno al
token — dentro un diff, solo gli hunk visibili a schermo — quindi quando una
definizione sta altrove lo dice, invece di inventarsela. Le risposte sono in
cache per versione del file.

[Chat del repository](repo-chat.md) funziona allo stesso modo: può citare solo
gli estratti che ha ricevuto, e la richiesta in due passaggi li sceglie
dall’elenco dei file tracciati da Git, non da qualcosa scritto dal modello.
Quando propone una modifica, GitHuttBr convalida azioni esatte sui file, ne
calcola i diff in locale, poi esegue le azioni Git successive secondo la
politica di approvazione configurata.

**I file segreti mascherati non vengono mai inviati.** Né i file coperti dalle
regole di mascheramento dei segreti — compreso un file che fissi a mano nella
chat, che viene rifiutato con un motivo invece di essere letto.

## Quando un modello è lento, o smette di rispondere

Un modello locale su un portatile può metterci un minuto per un messaggio di
commit, e un modello che "ragiona" prima di rispondere ancora di più — ma un
server chiuso a metà richiesta non dovrebbe lasciarti a fissare una rotellina
che gira.

| Cosa succede | Cosa vedi |
|---|---|
| Nessuna risposta dopo 30 secondi | *"{account} sta impiegando più del previsto a rispondere."*, con **Continua ad attendere**, **Usa {altro account}** e **Annulla**. Continua ad attendere chiede di nuovo un minuto dopo, se è ancora in corso |
| Un server locale (Ollama, LM Studio, llama.cpp…) viene chiuso mentre lavora | Entro pochi secondi: *"{account} non risponde. È ancora in esecuzione?"*, con un pulsante per ogni altro account pronto all'uso, e **Annulla** |
| Il server era già chiuso quando hai chiesto | Lo stesso, subito |

**Usa {altro account}** annulla la richiesta e invia la stessa a quell'account,
con il suo modello predefinito — il messaggio di commit, la review o la risposta
della chat arriva come se l'avessi chiesta lì. Non cambia le tue impostazioni:
la richiesta successiva va di nuovo all'account che hai scelto per
quell'attività.

Vale per ogni funzione IA — messaggi di commit, chat, review, spiegazioni,
conflitti, temi, la wiki — perché passano tutte dalla stessa chiamata.

## Limiti

- **Solo i server locali vengono controllati per capire se sono stati chiusi.**
  Un fornitore cloud che va giù fallisce con il proprio errore; una chiamata
  cloud che è solo lenta riceve l'avviso *più del previsto* come qualsiasi
  altra. Un server locale occupato, ma non chiuso, conta come vivo: solo una
  connessione rifiutata o interrotta chiude la chiamata in anticipo.

- Gli elenchi di riserva invecchiano fra una versione e l'altra. È proprio a
  questo che serve il recupero in diretta; la riserva copre solo il caso in cui
  recuperare non sia possibile.
- Filtrare l'elenco di un provider ai modelli da chat avviene per nome, quindi un
  modello di chat dal nome insolito può restare fuori. Scrivilo a mano.
- Un account CLI non può riportare il consumo di token se la CLI non lo fa: le
  cifre di utilizzo e costo nelle impostazioni conteggeranno per difetto quelle
  chiamate.
- Le risposte via CLI sono più lente di una chiamata diretta all'API: il binario
  avvia un'intera sessione a ogni richiesta.
- Le chiavi sono salvate per account nel portachiavi del sistema. Eliminare un
  account elimina la sua chiave — chiede prima, e non si può annullare.
- Si può eliminare anche l'**unico** account — un fornitore che ha smesso di
  rispondere non dovrebbe costringerti a inventarne prima un secondo. Al suo
  posto resta un account vuoto finché non ne configuri uno, e la conferma lo
  dice. Solo quell'account vuoto, mai toccato, non ha nulla da eliminare.
- Tornare a una versione precedente all'IA generale fa perdere le chiavi dell'IA
  generale: quella versione non sa dove sono conservate e le scarta al
  salvataggio. Gli account restano; digita di nuovo le chiavi. L'IA propria di un
  profilo non è toccata.

**Vedi anche:** [Chat del repository](repo-chat.md) · [Wiki del repository](repo-wiki.md) · [Sicurezza e segreti](security.md)
