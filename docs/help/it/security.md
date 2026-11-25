---
title: Sicurezza e segreti
category: Sicurezza
order: 70
summary: Mascheramento, protezioni, il portachiavi — e cosa Gitcito si rifiuta di fare.
keywords: sicurezza segreti mascheramento portachiavi keychain safeStorage token branch protetto file grande protezione privacy
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
| **File di segreti** | Quando committi qualcosa che sembra una credenziale — con un *Ignora e togli dal tracciamento* in un clic |
| **File grande** | Quando committi un blob fuori misura (soglia in Impostazioni → Sicurezza) |
| **Rumore di build** | Committare `xcuserdata/`, `DerivedData/` o un `.DS_Store` — con lo stesso *Ignora e smetti di tracciare* in un clic |
| **Branch protetto** | Quando committi direttamente su `main`/`master`, o ci fai un force push |
| **Segreti tracciati** | Quando fai push di un repository che *traccia* un file di segreti — avvisato una volta per sessione |

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
serve solo un portachiavi. I token salvati prima restano leggibili — non ne
perdi mai l'accesso — e cancellarne o sostituirne uno rimuove comunque il
vecchio valore dal disco. Due limiti: la chiave dell'IA generale non viene
spostata nel suo spazio condiviso (ogni profilo continua a leggere la propria),
e la cassaforte continua a salvare nell'archiviazione di base, perché non ha una
modalità solo sessione. Installa o sblocca un portachiavi e riavvia Gitcito per
tornare a salvare nuovi token.

## Importare le impostazioni

**Impostazioni → Importa / Esporta** sposta impostazioni, profili e temi da una
macchina all'altra. L'esportazione predefinita **non contiene token né chiavi
API**, e importare un file del genere non tocca mai quelli che hai salvato — un
token vuoto nel file significa «non è in questo file», non «cancella il mio».

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
salvate e la sua immagine restano collegati. Il profilo attivo non cambia.

**Sostituisci tutti** c'è ancora, per un backup che vuoi riavere esattamente
com'era: restano solo i profili del file, e quelli che ha solo questo computer
sono elencati barrati come **Rimosso**. Premere **Importa** chiede allora
un'altra volta, nominandoli — se ne vanno con le loro credenziali salvate e la
loro immagine, e non si può annullare. Con **Sostituisci tutti** il profilo
attivo del file diventa quello attivo.

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
importato nulla. Lo stesso vale finché i token salvati non si possono leggere:
tornerebbero appena fosse possibile. **Aggiungi alle mie** funziona ancora, e
tiene i token del file per la sessione.

**Il limite:** le credenziali appartengono a un profilo. Un profilo che
l'importazione rimuove si porta via i suoi token salvati, qualunque cosa tu
scelga.

## Condividere in sicurezza

La [condivisione sicura](secure-share.md) esporta impostazioni, voci della
cassaforte o intere aree di lavoro come **bundle cifrato** — i segreti vengono
inclusi solo ed esclusivamente quando spunti la casella.

**Vedi anche:** [Cassaforte](vault.md) · [Condivisione sicura](secure-share.md)
