---
title: Sicurezza e segreti
category: Sicurezza
order: 70
summary: Mascheramento, protezioni, il portachiavi — e cosa Gitcito si rifiuta di fare.
keywords: sicurezza segreti mascheramento portachiavi keychain safeStorage token branch protetto file grande protezione privacy illeggibile backup parti tradurre percorsi altro computer nuova macchina unire profili sostituire profili scegliere cosa esportare backup completo per il team manifesto password cifratura appimage apparmor sandbox segnalare un problema
source: 85fbf0864fa5b571b47ecc648dd16cc7324a8d17
---

# Sicurezza e segreti

Gitcito **non ha backend**. Le uniche chiamate di rete vanno al tuo host Git e,
se lo attivi, al tuo provider AI.

![Le impostazioni di sicurezza](../../screenshots/settings-security.webp)

## Mascheramento dei segreti

I valori dentro `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` e simili
vengono mostrati come `KEY=••••••` nelle viste diff, file e blame, così una
condivisione dello schermo o uno screenshot non possono farli trapelare.
Il materiale di firma Apple rientra: `*.mobileprovision`,
`*.provisionprofile`, `*.p12` e le chiavi `*.p8` di App Store Connect. Un
`*.cer` no — un certificato è pubblico per definizione.

È **solo visuale**: non cambia mai il file e non cambia mai quello che metti in
stage. Un interruttore a forma di occhio li rivela per singola vista.
`.env.example`, `.sample` e `.template` sono trattati come modelli, non come
segreti.

![Un .env mostrato con ogni valore mascherato, e l'interruttore per rivelarli](../../screenshots/secret-masking.webp)

## Protezioni prima che tu faccia danni

| Protezione | Quando |
|---|---|
| **File di segreti** | Quando committi qualcosa che sembra una credenziale — con un *Ignora e smetti di tracciare* in un clic |
| **File grande** | Quando committi un blob fuori misura (soglia in Impostazioni → Sicurezza) |
| **Rumore di build** | Committare `xcuserdata/`, `DerivedData/` o un `.DS_Store` — con lo stesso *Ignora e smetti di tracciare* in un clic |
| **Branch protetto** | Quando committi direttamente su `main`/`master`, o ci fai un force push |
| **Segreti tracciati** | Quando fai push di un repository che *traccia* un file di segreti — avvisato una volta per sessione |

## L'AppImage e i percorsi che le sopravvivono

Un'AppImage gira da una cartella sotto `/tmp` (`/tmp/.mount_…`) che esiste solo
mentre l'app è aperta, cambia nome a ogni avvio e si trova in una directory in
cui ogni utente locale può scrivere. Fino alla 4.37.1, l'AppImage poteva
scrivere un percorso dentro quella cartella in due posti che le sopravvivono: il
link `gitcito` nel `PATH` ([CLI](cli.md)) e l'impostazione
`diff.<name>.textconv` di un repository ([attributi](attributes.md)). Una volta
chiusa l'app, un altro utente sulla stessa macchina poteva ricreare la cartella
con un programma suo, che il tuo `gitcito` o `git diff` successivo avrebbe
eseguito.

Ora Gitcito rifiuta entrambe le cose sotto un'AppImage, avvisa all'avvio di un
link `gitcito` obsoleto (con un comando della palette per rimuoverlo) e segnala
un convertitore obsoleto nella finestra degli attributi con un pulsante
**Rimuovi**. Vede solo il repository che hai aperto; per trovare convertitori
obsoleti altrove, esegui `git config --get-regexp 'diff\..*\.textconv'` in ogni
repository (e con `--global`) e rimuovi ogni voce sotto `/tmp/.mount_`. Una
macchina con un solo utente non è esposta, ma le voci obsolete restano peso
morto.

## Il portachiavi di sistema

I token e le voci della [cassaforte](vault.md) sono cifrati con il portachiavi
del tuo sistema operativo (`safeStorage` di Electron), mai con una chiave dentro
il file delle impostazioni.

**Niente tocca il portachiavi finché non lo dici tu.** Prima ancora che possa
comparire la finestra di autorizzazione del sistema, Gitcito spiega cosa sta per
essere conservato, cosa non può fare (un'applicazione rilegge solo ed
esclusivamente la voce che ha creato lei — le tue altre password sono
irraggiungibili) e che dire di no va benissimo: in quel caso i token vivono in
memoria solo per la sessione, la cassaforte resta chiusa, e puoi attivarlo più
avanti in **Impostazioni → Sicurezza → Portachiavi di sistema**.

Un'installazione appena fatta effettua **zero** chiamate al portachiavi finché
non c'è davvero qualcosa da conservare.

Finché è disattivato, il campo del token in Integrazioni lo segnala — *Conservato solo finché non chiudi Gitcito: il portachiavi di sistema è disattivato.* — con un pulsante **Attiva** accanto. Attivarlo, da lì o da qui, salva anche i token già inseriti in questa sessione, quindi non serve incollarli di nuovo.

Un token che **rimuovi** mentre il portachiavi è disattivato sparisce subito —
non viene più inviato con niente —, ma solo **per questa sessione**: l'archivio
cifrato non si può scrivere mentre il portachiavi è disattivato, e la
cancellazione è tenuta in memoria, mai in un file. Riattiva il portachiavi prima
di uscire e la copia salvata viene eliminata allora; esci prima e il vecchio
token torna all'avvio successivo. Fino ad allora l'avviso resta visibile per
questo motivo. Per eliminare definitivamente un token salvato in un solo passo,
svuotalo con il portachiavi attivo.

Un campo vuoto cancella solo ciò che Gitcito ti ha mostrato. Con il portachiavi
disattivato fin dall'inizio, i token salvati non vengono mai decifrati né
mostrati — i campi sono vuoti —, quindi viene rimosso solo un token che scrivi lì
e poi svuoti di nuovo; quello salvato sotto è ancora lì una volta attivato il
portachiavi.

Se la finestra si ricarica o si blocca mentre la spiegazione del portachiavi è
sullo schermo, la domanda conta come senza risposta — non come un no — e viene
posta di nuovo la prossima volta che serve salvare un token. Niente resta in
attesa di una domanda a cui nessuno può più rispondere: le impostazioni si
caricano di nuovo normalmente.

### Linux senza portachiavi

Su Linux il portachiavi è un servizio di segreti — GNOME Keyring o KWallet.
Quando non ne è in esecuzione nessuno, il sistema «cifra» lo stesso, ma con una
password fissa, uguale su ogni macchina: i token e le chiavi sono rimescolati,
non protetti. Impostazioni → Sicurezza lo dice sotto lo stato del
portachiavi — *Nessun portachiavi è in esecuzione…* — così la parola
*portachiavi* non indica mai una protezione che non c'è.

Perché niente di nuovo finisca in un archivio che chiunque potrebbe
decifrare, un token che digiti mentre non c'è un portachiavi in esecuzione
viene tenuto **solo fino alla chiusura dell'app**. Il campo del token lo dice —
*Salvato solo fino alla chiusura di Gitcito: nessun portachiavi è in
esecuzione…* — senza un pulsante per riprovare, perché riprovare non serve;
serve solo un portachiavi. Importare un file di impostazioni con credenziali lo
dice allo stesso modo prima di importarle. I token salvati prima restano leggibili — non ne
perdi mai l'accesso — e cancellarne o sostituirne uno rimuove comunque il
vecchio valore dal disco. Due limiti: la chiave dell'IA generale non viene
spostata nel suo spazio condiviso (ogni profilo continua a leggere la propria),
e la cassaforte continua a salvare nell'archiviazione di base, perché non ha una
modalità solo sessione. Installa o sblocca un portachiavi e riavvia Gitcito per
tornare a salvare nuovi token.

### Quando i token salvati non si possono leggere

Se chiudi la richiesta del portachiavi di sistema, il portachiavi è bloccato o
l'archivio dei token è stato scritto da un'altra copia di Gitcito (una build di
sviluppo, una rifirmata), Gitcito **non può leggere i tuoi token salvati — e li
lascia intatti**. Impostazioni → Sicurezza dice *Gitcito non ha potuto leggere i
tuoi token salvati*, e un token che scrivi nel frattempo è tenuto solo per la
sessione (lo dice anche il campo). Non viene mai scritto sopra l'archivio che
non è riuscito a leggere: sostituirebbe ogni token salvato con quello appena
scritto.

| Pulsante | Cosa fa |
|--------|--------------|
| **Riprova** | Rilegge l'archivio — ora il sistema potrebbe chiedere il portachiavi. Appena è leggibile, i token scritti nel frattempo si aggiungono. |
| **Crea un nuovo archivio di token** | Chiede prima. Gitcito smette di aspettare il vecchio archivio e ne inizia uno nuovo con i soli token di questa sessione. Il vecchio file resta accanto come backup per 30 giorni, poi viene eliminato. Per un archivio perso per sempre, non per una richiesta che hai chiuso. |

## Importare le impostazioni

**Impostazioni → Importa / Esporta** sposta impostazioni, profili e temi da una
macchina all'altra. L'esportazione predefinita **non contiene token né chiavi
API**, e importare un file del genere non tocca mai quelli che hai salvato — un
token vuoto nel file significa «non è in questo file», non «cancella il mio».

### Scegliere cosa esportare

Un backup e un file per un collega non sono lo stesso file. Un backup vuole
tutto; un file per un altro computer non dovrebbe contenere cartelle che lì non
esistono; un file per il team non dovrebbe contenere né i tuoi account né i tuoi
percorsi. Per questo **Esporta le impostazioni** apre una finestra con le stesse
quattro parti offerte dall'importazione (la tabella più sotto), ciascuna con la
sua dimensione su questo computer, e scrive solo quelle che spunti. Una parte
lasciata fuori non è affatto nel file — importarlo in seguito lascia quella
parte dell'altra macchina esattamente com'è.

![Impostazioni → Dati → Esporta: «Un altro computer» scelto, la nota verde che dice che il file non contiene alcun percorso di questa macchina, e il manifesto di ciò che entra](../../screenshots/settings-export.webp)

Tre scorciatoie sopra le parti spuntano le combinazioni abituali. Cambiare una
casella a mano illumina la scorciatoia corrispondente, o nessuna:

| Scorciatoia | Parti | Per |
|----------|-------|-----|
| **Backup completo** | Tutte e quattro | Ripristinare questo computer, o una sua copia — lo stesso file che Esporta scriveva prima di avere le parti |
| **Un altro computer** | Profili e account, Preferenze dell'app | La tua identità e i tuoi gusti su una macchina nuova, senza le cartelle e i programmi di questa |
| **Per il team** | Preferenze dell'app | Un tema, delle scorciatoie e una configurazione del grafo condivisi — niente di personale, nessun percorso |

Sotto le parti, una nota dice se il file nomina cartelle o programmi di questo
computer: ambra con **Repository** o **Programmi** spuntati (l'importazione su
un'altra macchina traduce quei percorsi o lascia fuori quelli che non trova),
verde senza. **Profili e account** senza **Programmi** lascia fuori anche il
percorso delle CLI di IA, che sono salvate con i profili ma nominano binari di
questa macchina.

**Credenziali solo con i Profili, e solo se lo chiedi.** Token e chiavi API
appartengono ai profili, quindi **Includi chiavi API, token e i segreti della
cassaforte** è disponibile solo con **Profili e account** spuntato; togli la
spunta alla parte e l'opzione viene cancellata con essa. Con le credenziali
spuntate, la finestra consiglia **Proteggi con una password** (più sotto), ed
esportarle senza cifratura chiede conferma un'altra volta.

Un riquadro in fondo elenca cosa conterrà il file prima che tu prema
**Esporta…**: quanti profili (con o senza credenziali), immagini dei profili,
preferenze, percorsi di repository e programmi, se entrano le note e i wiki dei
repository e la cassaforte, quali parti restano fuori e se il file è cifrato.
Cosa viaggia con quale parte:

| Extra | Va con | Condizione |
|-------|-----------|-----------|
| Immagini dei profili | Profili e account | Immagini scelte come immagine |
| Segreti della cassaforte | Profili e account | Solo con l'opzione delle credenziali |
| Note e wiki dei repository | Repository e workspace | Sempre con la parte |

Limiti: le parti sono l'unità intera — non si possono scegliere singoli
profili, singoli repository o singole preferenze. **Programmi** senza
**Profili** porta il terminale, l'editor e le app predefinite, ma non i percorsi
delle CLI di IA (vivono dentro i profili). Il manifesto conta le voci; non
mostra i percorsi stessi. E un file senza una parte non può restituirla:
ripristinare un file **Per il team** ripristina solo le preferenze.

### Scegliere cosa importare

Un file di impostazioni contiene due tipi di cose: quello che segue *te*
(profili, tema, scorciatoie) e quello che ha senso solo sulla macchina che l'ha
scritto (le cartelle dove vivono i tuoi repository, il percorso del tuo
terminale). Applicare tutto su un computer nuovo riempie la barra laterale di
schede che non puntano a nulla. Così, dopo che hai scelto il file (e digitato
la sua password, se ne ha una), una finestra chiede quali parti portare. Non
viene applicato nulla finché non premi **Importa**; **Annulla** lascia tutto
com'era.

![Impostazioni → Dati → Importa: quattro parti, i repository non spuntati perché nessuna delle loro cartelle esiste qui, e la traduzione dei percorsi aperta](../../screenshots/settings-import.webp)

| Parte | Cosa contiene |
|------|-----------------|
| **Profili e account** | Profili, identità Git, collegamenti delle integrazioni, le impostazioni generali dell'IA e le immagini dei profili — e le credenziali e la [cassaforte](vault.md), quando il file le contiene |
| **Preferenze dell'app** | Tema, lingua, scorciatoie, layout, i colori del grafo e delle icone |
| **Repository e workspace** | Schede, workspace, preferiti, soprannomi, immagini delle schede, quale profilo usa ogni repository, cartelle scansionate, e le note e i wiki di ogni repository |
| **Programmi di questo computer** | Terminale, editor esterno, app predefinite e il percorso delle CLI dell'IA |

Ogni parte mostra quante voci il file ha per lei. Una parte lasciata senza
spunta resta esattamente com'è su questa macchina.

**I profili si uniscono ai tuoi.** Un file da un altro computer raramente ha
tutti i profili che ha questo — un account aggiunto sul portatile Linux, un
profilo cliente che esiste solo sul Mac. Per questo **Profili e account**
aggiunge i profili del file ai tuoi invece di sostituire l'elenco. Prima
dell'importazione, la parte elenca ogni profilo e cosa gli succederà:

| Etichetta | Significato |
|-----|---------|
| **Aggiorna** | Il profilo è in entrambi: identità, IA e immagine del file sostituiscono le tue, e i suoi server si aggiungono ai tuoi |
| **Nuovo** | Ce l'ha solo il file: aggiunto dopo i tuoi |
| **Resta** | Ce l'ha solo questo computer: lasciato esattamente com'è |

Due profili sono «lo stesso» quando condividono un id — il primo profilo di ogni
installazione lo condivide. Quando nessun id corrisponde, conta il nome (senza
badare a maiuscole e spazi attorno), e il profilo mantiene **l'id di questo
computer**: i repository legati a lui, il profilo attivo, le sue credenziali
salvate e la sua immagine restano collegati. Il profilo attivo non cambia, e nemmeno l'**IA generale**:
il motore e il modello con cui risponde questo computer restano i suoi.

**Sostituisci tutti** c'è ancora, per un backup che vuoi riavere esattamente
com'era: restano solo i profili del file, e quelli che ha solo questo computer
sono elencati barrati come **Rimosso**. Premere **Importa** chiede allora
un'altra volta, nominandoli — se ne vanno con le loro credenziali salvate e la
loro immagine, e non si può annullare. Con **Sostituisci tutti** il profilo
attivo del file diventa quello attivo, e l'IA generale del file sostituisce
quella di questo computer.

Limiti: la corrispondenza è solo per id o per nome esatto — un profilo
rinominato da una parte conta come nuovo, e ti ritrovi con entrambi. Un profilo
abbinato prende i campi del file, con tre eccezioni perché non si perda nulla
che abbia solo questo computer: i suoi server GitHub Enterprise, GitLab e
Bitbucket vengono **aggiunti** ai tuoi (su un server che hanno entrambi vince la
voce del file); un token che il file porta vuoto mantiene il tuo — ma solo per
la stessa istanza, così un token non viene mai mandato a un altro Forgejo, a un
altro emittente GitLab o a un'altra organizzazione Azure; e gli accessi presi
dal credential helper di questa macchina restano di questa macchina.

**Le scelte predefinite sono un'ipotesi basata sul tuo disco.** Prima di
mostrare la finestra, Gitcito controlla se le cartelle dei repository nel file
esistono qui. Se non ne esiste nessuna, il file viene da un altro computer:
**Repository** e **Programmi** partono senza spunta, ognuno con il motivo — i
percorsi dei programmi sono elencati, così vedi che appartengono a un'altra
macchina. Se esistono, è lo stesso computer (un backup ripristinato, per
esempio), tutto parte spuntato e una nota verde lo dice. Un file senza alcun
repository viene giudicato dai percorsi dei suoi programmi: **Programmi** parte
spuntato solo quando esistono tutti qui.

Quando il controllo stesso fallisce, non si indovina nulla: **Repository** e
**Programmi** partono senza spunta e senza verdetto, un pulsante **Verifica di
nuovo** interroga di nuovo il disco, e **Repository** non si può importare
finché un controllo non riesce. Le altre parti sì.

**Tradurre i percorsi.** Spunta **Repository** su un file le cui cartelle
mancano e si apre un riquadro **Traduci percorsi**. A sinistra, la cartella che
i repository del file hanno in comune (`/home/you/code`); a destra, dove si
trova quella cartella su questo computer, precompilata a partire dalla tua
cartella home (`/Users/you/code`). Entrambe sono modificabili — l'ipotesi può
essere sbagliata, e quando Gitcito non trova una cartella comune le lascia
vuote perché tu le scriva. Una barra conta, mentre scrivi, quanti repository
ora hanno una cartella qui, con alcuni di loro elencati — in verde i trovati,
in rosso quelli che ancora mancano. Lo scambio si porta dietro il soprannome,
l'immagine della scheda e il profilo del repository, e le sue note, i wiki e le
voci della cassaforte, così non c'è niente da reimpostare a mano.

Il piè di pagina lo riassume — *Importa 3 parti su 4 · 31 cartelle* (contano
anche le radici di scansione e l'ultima cartella di clone, per questo dice
cartelle e non repository) — e **Importa** resta disattivato finché non è
spuntata almeno una parte.

**Importa resta disattivato anche quando una traduzione non trova nulla.** Con
**Repository** spuntato e nessuna cartella trovata sotto il nuovo prefisso,
importare lascerebbe vuoti i tuoi repository; correggi i percorsi o togli la
spunta alla parte.

Limiti della traduzione:

- È **un prefisso scambiato con un altro**. I repository che nel file stanno
  sotto un'altra cartella, o che qui sono organizzati diversamente, non vengono
  trovati; non c'è una corrispondenza per singolo repository.
- Con una traduzione attiva, **vengono importati solo i repository che a quel
  punto hanno una cartella**. Gli altri restano fuori — non aggiunti come schede
  rotte — e la finestra ti dice quanti.
- I programmi non vengono mai tradotti: `/usr/bin/code` non ha un equivalente
  affidabile su un altro sistema. Lascia quella parte senza spunta e sceglili
  nelle Impostazioni.
- Svuotare uno dei due prefissi importa i percorsi così come sono nel file.

**Durante l'importazione** la finestra non si può chiudere. Se fallisce un
passaggio successivo — le note dei repository, la cassaforte, le immagini del
profilo — la finestra resta aperta, nomina il passaggio, e **Continua
l'importazione** riprende da lì senza riscrivere i passaggi precedenti.

### Credenziali nel file

Un file esportato con l'opzione spuntata contiene credenziali. Unire i profili
le **aggiunge** sempre: quelle del file vengono archiviate sotto il profilo
corrispondente, sostituendo quelle dello stesso account, e tutte le altre
credenziali salvate restano — cancellarle contraddirebbe il mantenere i tuoi
profili. Con i profili su **Sostituisci tutti**, un file del genere mostra anche
la scelta, subito sotto **Profili e account**:

| Scelta | Le tue credenziali salvate |
|--------|------------------------|
| **Aggiungi alle mie** | Quelle del file vengono aggiunte, sostituendo quelle dello stesso account; tutte le altre restano |
| **Sostituisci tutto** | Diventano esattamente quelle del file — ogni token e chiave API salvati che il file non ha vengono cancellati |

La scelta vale insieme ai profili: con **Profili e account** senza spunta, nessuna
credenziale viene importata o rimossa. Un file esportato senza l'opzione non ne
ha da offrire, qualunque cosa spunti. **Sostituisci tutto** chiede un'altra
volta quando premi **Importa**, avvisando che ogni token e chiave API salvati che
il file non ha verranno cancellati; **Annulla** lì lascia la finestra com'era.

**Sostituisci tutto richiede il portachiavi.** Con il portachiavi disattivato o
non disponibile, i vecchi token resterebbero nell'archivio cifrato e
tornerebbero al prossimo avvio, quindi Gitcito si rifiuta: lo dice, e non viene
importato nulla. Lo stesso vale finché i token salvati non si possono leggere
(vedi sopra): tornerebbero appena fosse possibile. **Aggiungi alle mie** funziona ancora, e
tiene i token del file per la sessione.

**Il limite:** le credenziali appartengono a un profilo. Un profilo che
l'importazione rimuove si porta via i suoi token salvati, qualunque cosa tu
scelga.

### Proteggere un'esportazione con una password

Un'esportazione con le credenziali spuntate vale quanto i token stessi per
chiunque trovi il file — una cartella sincronizzata, una chiavetta USB
dimenticata, un allegato. **Proteggi con una password**, nella finestra di
esportazione, cifra il file con lo stesso cifrario della [condivisione
sicura](secure-share.md) (una chiave derivata con scrypt e AES-256-GCM), così
niente di ciò che contiene — nemmeno se porta credenziali — si può leggere senza
la password.

È facoltativa, con o senza la spunta delle credenziali, e la password non ha
lunghezza minima. La scrivi due volte e spunti che capisci che non si può
recuperare; importare il file la chiede — in una finestra nelle Impostazioni,
dentro il passo di benvenuto al primo avvio — e una sbagliata la richiede di
nuovo.

![Impostazioni → Dati → Esporta: un file protetto da password, con l'avviso di nessun recupero confermato](../../screenshots/settings-export-password.webp)

| | Senza password | Con password |
|---|---|---|
| **Chi può leggerlo** | Chiunque abbia il file | Solo chi ha la password |
| **Un byte modificato** | Letto così com'è | Rifiutato, come una password sbagliata |
| **Si apre in** | Qualsiasi versione | Le versioni che conoscono il formato cifrato |

**Non c'è recupero.** La password non è conservata da nessuna parte — né nel
file né su questa macchina — e non c'è un server a cui chiedere. Dimenticala e
il file è perso; esporta di nuovo da una macchina che ha ancora le
impostazioni.

Limiti: una versione più vecchia non può aprire un'esportazione cifrata, e non
lo sa neanche — dice che le impostazioni sono state importate e non cambia
nulla. Importa un file protetto con una versione che chiede la sua password. Una
password corta resta debole contro chi ha il file e il tempo per indovinare; la
chiave scrypt rende ogni tentativo lento, non impossibile. La password protegge
il file, non l'app in esecuzione: le credenziali vengono decifrate in memoria
mentre si raccolgono per l'esportazione, come è sempre stato.

## Il file delle impostazioni

Il file delle impostazioni e l'archivio cifrato dei token vengono scritti per
intero: in un file nuovo accanto, leggibile solo dal proprietario, poi
sostituito, così un crash o due salvataggi simultanei non lasciano mai mezzo
file. Se il file delle impostazioni è un link simbolico altrove (un repository
di dotfiles), la scrittura va alla destinazione del link e il link resta.
Gitcito non sostituisce mai il link. Uno che punta a un file che ancora non
esiste viene scritto attraverso, creando quel file — purché la sua cartella
esista. Quando manca anche la cartella, il salvataggio invece fallisce, con un
solo messaggio che lo dice: il link e ciò a cui punta restano intatti, e le
modifiche fatte nel frattempo durano solo finché Gitcito si chiude. Ripristina
la cartella, o fai puntare il link a qualcosa che esiste, e il salvataggio
successivo va a buon fine.

I token in chiaro che una versione più vecchia ha lasciato nel file delle
impostazioni non vengono mai persi da un salvataggio: restano nel file finché
Gitcito non li carica nell'archivio cifrato (aprire le Impostazioni lo fa), a
meno che tu non ne cancelli uno.

Solo due cose lo scrivono: un salvataggio delle tue impostazioni, e Gitcito
quando le carica (all'avvio, o quando si aprono le Impostazioni) — che è quando
un vecchio token in chiaro passa nell'archivio cifrato, o l'indirizzo di un
server con una password dentro viene ripulito. Una consultazione che nessuno ha
chiesto — un fetch che risolve il suo token, una chiamata di IA che cerca la sua
chiave, un'immagine del profilo — legge soltanto, quindi non può mai finire
sopra un salvataggio. Un salvataggio viene anche rifiutato finché le
impostazioni non sono state caricate almeno una volta: prima di allora, l'app
ha solo i valori predefiniti.

**Il costo su una vecchia installazione** che ha ancora token in chiaro nel suo
file delle impostazioni: finché le Impostazioni non vengono aperte una volta (o
l'app non si riavvia e li carica), ogni consultazione che ha bisogno di un token
decifra di nuovo l'archivio, e le immagini dei profili che hanno bisogno di un
token salvato aspettano. Una consultazione non sposta niente, quindi un token
che cancelli nel frattempo resta cancellato.

Un file che esiste ma non si può interpretare (una modifica a mano finita male,
un disco danneggiato) non viene **mai** sostituito dai valori predefiniti:
Gitcito dice che il file è danneggiato e non va avanti — nessuna scorciatoia né
comando di menu può salvarci sopra da quella schermata.

![La schermata di avvio per un file delle impostazioni danneggiato, con Riprova e Sposta da parte il file danneggiato e ricomincia da zero](../../screenshots/settings-damaged.webp)

Puoi correggere `gitcito-settings.json` nella sua cartella dei dati e premere
**Riprova**, oppure premere **Sposta da parte il file danneggiato e ricomincia
da zero**: il file viene rinominato in `gitcito-settings.json.corrupt-<date>`
(mai eliminato, così puoi ancora recuperarne qualcosa), una copia dell'archivio
cifrato dei token viene tenuta accanto, e Gitcito parte come al primo avvio, con
una nota che dice dove è finito il file. Per un file delle impostazioni
collegato con un link simbolico viene rinominata la destinazione del link, così
la copia danneggiata resta nei tuoi dotfiles, accanto al nuovo file delle
impostazioni che il primo salvataggio scrive poi attraverso il link. La copia
viene fatta per prima: se non si può scrivere, non si sposta niente, e la
schermata lo dice e mostra la cartella dei dati da controllare, perché
ripartire da zero senza la copia lascerebbe che il primo token salvato elimini i
token dei vecchi profili. Risolvi ciò che impedisce di scrivere nella cartella
(permessi, un disco pieno) e premi **Riprova**.

Se il file si guasta mentre Gitcito è in esecuzione (modificato a mano sotto di
lui), i salvataggi si fermano e Gitcito lo dice una volta: le impostazioni non
si possono salvare fino al riavvio, e le modifiche fatte nel frattempo vanno
perse.

Un file che c'è ma per un momento non si può *leggere* — un altro programma, come
un antivirus, lo tiene aperto — viene riprovato per circa due secondi. Se
fallisce ancora, o il caricamento fallisce per qualsiasi altro motivo, Gitcito
dice che non è riuscito ad avviarsi, che il file non è stato modificato, e
offre **Riprova**; non dice che il file è danneggiato.

### Limiti noti

Richiedono condizioni insolite, e sono elencati perché nessuno ne resti
sorpreso:

- **Un'installazione molto vecchia con token ancora nel file delle
  impostazioni.** Se il portachiavi viene disattivato dopo che i token salvati
  sono stati sbloccati, o rifiutato mentre una chiave di IA è ancora salvata nel
  vecchio formato in chiaro, quella copia in chiaro può andare persa al
  salvataggio successivo e il token sparisce dopo un riavvio. Apri le
  Impostazioni una volta con il portachiavi attivo dopo l'aggiornamento da una
  build del genere, e i token passano nell'archivio cifrato per sempre.
- **Un salvataggio e un ricaricamento fallito che si incrociano nella stessa
  finestra.** Un token scritto in un salvataggio che supera un ricaricamento poi
  fallito non si può cancellare da quella finestra finché le Impostazioni non
  si ricaricano; riapri le Impostazioni e cancellalo.
- **Un file delle impostazioni con link simbolico la cui cartella manca.**
  L'archivio dei token viene scritto prima che il file delle impostazioni
  fallisca, quindi i due restano disallineati finché la cartella non torna.
  Ripristinala (monta il disco, clona i dotfiles) e salva di nuovo.

## Il token di un profilo mentre Git è in esecuzione

Quando un [profilo](profiles.md) autentica un clone, fetch, pull o push con il
suo token, il token non finisce in nessuno dei posti dove un altro programma
potrebbe leggerlo: non in `.git/config`, non sulla riga di comando (ogni utente
locale può leggere l'elenco dei processi), e non nell'**ambiente** del comando
git — che ereditano ogni hook, filtro e processo LFS avviato da git, insieme a
ogni pacchetto npm eseguito da uno script husky o lefthook.

Invece, per ogni operazione Gitcito apre un proprio endpoint privato — un socket
in una cartella in cui può entrare solo il tuo utente (una named pipe con un
nome casuale su Windows) — e registra un credential helper per quel solo server.
Quando git chiede un accesso, l'helper si collega, dimostra di appartenere a
questa operazione con un codice casuale creato solo per lei, dice per quale host
e repository chiede git, e riceve l'accesso. L'endpoint risponde a ogni
richiesta dell'operazione — git può chiedere più di una volta, per LFS, dopo un
redirect, per ogni processo che avvia — e viene chiuso ed eliminato quando git
termina. Un hook che stampa il suo ambiente trova il codice, non il token.

Cosa ancora non può fare:

- **Un hook può ancora chiedere, mentre l'operazione è in corso.** Quel codice è
  nell'ambiente di git, perché l'helper è un programma che git avvia e git dà a
  ogni programma che avvia lo stesso ambiente. Un hook scritto per parlare il
  protocollo dell'helper può usare il codice per chiedere l'accesso finché git
  non termina — è esattamente così che l'hook `pre-push` di git-lfs ne ottiene
  uno. È un'apertura molto più piccola di un token lasciato in una variabile —
  niente lo legge per sbaglio, un dump o un crash report mostra solo un codice
  inutile una volta terminato git —, ma è un'apertura.
- **Risponde solo per il server per cui è stato aperto.** L'endpoint rifiuta
  qualsiasi altro host, una richiesta `http` in chiaro, un percorso fuori dalla
  base del server e un server annidato sotto di essa (un Data Center su
  `/bitbucket` accanto a un GitLab alla radice) — anche con il codice giusto. Un
  push verso più URL riceve un endpoint per server, ciascuno con solo l'accesso
  di quel server. Sotto un server con un altro annidato dentro, viene rifiutato
  anche un percorso che il proxy del server annidato potrebbe instradare verso
  di sé: qualsiasi `;` al suo interno (Tomcat scarta i `;params`), un segmento
  che finisce con un punto, e il nome della base annidata con maiuscole diverse
  o come prefisso (`/Bitbucket/`, `/bitbucketx/`) — così anche un gruppo sul
  server esterno il cui nome inizia con il percorso del server annidato non
  ottiene il suo token.
- **Un'esclusione non sopravvive a un redirect dal lato del server.** Il
  controllo riguarda il percorso su cui chiede git. Se il server esterno stesso
  reindirizza una richiesta nel percorso del server annidato, o un proxy la
  riscrive lì dopo che git ha inviato il suo accesso, nessun client può vederlo.
- **Un accesso ereditato tramite `git -c` viene messo da parte.** Un credential
  helper (o un `include` che potrebbe aggiungerne uno) passato in
  `GIT_CONFIG_PARAMETERS` — l'app avviata da un alias di git, o da un altro git —
  viene rimosso per l'operazione, così non gli viene mai offerto il token del
  profilo da salvare, né gli si chiede a nome di nessuno. Ogni altra
  impostazione `-c` ereditata viene mantenuta.
- **L'indirizzo di un server va scritto come lo legge git.** Gitcito nomina il
  server secondo le regole standard degli URL, git secondo le sue: un nome
  internazionalizzato (`bücher.example`), una forma numerica abbreviata
  (`127.1`, `0x7f.0.0.1`), un indirizzo IPv6 compresso o mappato, o un carattere
  codificato nell'host sono un server diverso per ciascuno. Con un profilo di
  mezzo, un indirizzo così viene rifiutato con un messaggio invece di essere
  lasciato all'accesso della macchina. Le maiuscole e una porta predefinita
  esplicita (`:443`) vanno bene.
- **Git precedente alla 2.26** abbinava una voce di credenziali solo
  all'indirizzo esatto, non a tutto ciò che sta sotto la base di un server.
  Chiedendo a nome di nessuno, l'app disattiva allora gli helper per l'intero
  host per quel solo comando; accedere con un token richiede comunque git 2.31.
- **Non eseguire hook di cui non ti fidi**, anche con un profilo collegato. Un
  repository appena clonato può portare hook tramite strumenti come husky, che li
  installano con `npm install`; git esegue quello che c'è in `.git/hooks`, da
  Gitcito come da un terminale, e un hook può fare molto di peggio che leggere un
  token.
- **Restringi la portata del token.** Un token che può scrivere solo nei
  repository su cui lavori vale molto meno per chiunque se ne impossessi.
- **I remote SSH non sono interessati** — non c'è nessun token di mezzo;
  risponde invece l'[agente SSH](ssh-keys.md).

## Condividere in sicurezza

La [condivisione sicura](secure-share.md) esporta impostazioni, voci della
cassaforte o intere aree di lavoro come **bundle cifrato** — i segreti vengono
inclusi solo ed esclusivamente quando spunti la casella.

## Segnalare un problema

**Segnala un problema** su un errore apre una issue di GitHub precompilata — e
aprirla invia già il testo a GitHub, prima che tu scelga di pubblicarla. Per
questo il messaggio viene ripulito prima: vengono sostituiti una credenziale
scritta in un URL, i token, la tua cartella home (e con essa il tuo nome
utente), i server privati e i percorsi dei repository, il nome del profilo a cui
è legato un repository, gli indirizzi e-mail e IP. Gli host pubblici come
`github.com` restano, così come i nomi dei file e il messaggio di git stesso.

**Il limite:** un nome di server isolato in una frase viene riconosciuto dalla
sua forma — con punti, in minuscolo. Un host di una sola parola (`gitserver`)
viene riconosciuto solo nei messaggi che scrive Gitcito stesso, e un server
sotto un dominio di primo livello che si scrive come un'estensione di file
(`.sh`, `.md`) viene mantenuto come nome di file. Rileggi comunque la issue
prima di pubblicarla: la pulizia riconosce forme note, non tutto ciò che è
privato.

## Cosa resta sul disco

Il file delle impostazioni, il registro delle operazioni, la cache degli avatar e
l'archivio cifrato dei token sono leggibili solo dal tuo account (su macOS e
Linux). All'indirizzo di un server salvato con un `user:password@` o un
`?token=` — da un'importazione o da una versione più vecchia — viene tolta
quella parte quando viene letto, importato o salvato. La cache degli avatar dei
commit non salva indirizzi e-mail, solo hash con un sale diverso per ogni
installazione.

Ognuno di questi file viene scritto per intero: in un file nuovo accanto, poi
sostituito, così un crash o due salvataggi simultanei non lasciano mai mezzo
file — che Gitcito dovrebbe altrimenti trattare come illeggibile. Un backup
dell'archivio dei token viene eliminato prima del tempo solo quando ogni token
che contiene è anche nell'archivio attuale; ogni altro backup viene tenuto per
30 giorni.

## Pacchetti Linux: la sandbox e AppArmor

La sandbox di Chromium ha bisogno degli user namespace non privilegiati. Ubuntu
24.04 e successivi li negano a qualsiasi programma senza un profilo AppArmor che
li consenta, e i due pacchetti Linux lo gestiscono in modo diverso:

| Pacchetto | Cosa succede |
|---------|--------------|
| `.deb` | Installa `/etc/apparmor.d/gitcito`, un profilo per `/opt/GitHuttBr/gitcito` che consente gli user namespace. L'app gira nella sandbox. |
| AppImage | Non ha un profilo. Il suo launcher prova `unshare -Ur true`, e se fallisce avvia l'app con `--no-sandbox` — su Ubuntu 24.04+, succede a ogni avvio. Gitcito stampa un avviso nel suo output di console quando accade. |

Per eseguire l'AppImage nella sandbox, installa invece il `.deb`, oppure dai
all'AppImage un suo profilo AppArmor che consenta `userns` (o, per tutta la
macchina, `sysctl kernel.apparmor_restrict_unprivileged_userns=0`, che
disattiva la restrizione per tutto).

**Il limite del profilo del `.deb`.** È `flags=(unconfined)` con `userns`
consentito, e si aggancia al percorso dell'eseguibile. Lo stesso eseguibile gira
anche come semplice Node quando viene avviato con `ELECTRON_RUN_AS_NODE=1` — è
così che funzionano il comando `gitcito`, il convertitore di diff incluso e il
credential helper di Gitcito, quindi quell'interruttore non si può disattivare
senza romperli. Nel complesso significa che qualsiasi programma locale può usare
l'eseguibile di Gitcito come un interprete Node autorizzato a creare user
namespace — lo stesso tipo di falla degli aggiramenti noti della restrizione di
Ubuntu tramite altri programmi con un profilo. Non dà a nessuno più dei diritti
del proprio account; indebolisce uno strato di hardening del kernel che Ubuntu
aggiunge sopra. AppArmor non sa distinguere le due modalità di uno stesso
eseguibile, quindi un profilo più stretto non è possibile finché la CLI lo
condivide; un binario ausiliario separato per la CLI è nella roadmap. Gli
amministratori che preferiscono farne a meno possono aggiungere una regola di
divieto in `/etc/apparmor.d/local/gitcito`, a costo della sandbox.

**Vedi anche:** [Cassaforte](vault.md) · [Condivisione sicura](secure-share.md)
