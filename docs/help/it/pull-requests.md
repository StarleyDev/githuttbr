---
title: Pagina delle pull request
category: Sincronizzazione e più repo
order: 57
summary: Tutte le pull request di un repository in una pagina — per stato, filtrate per autore, revisore, destinazione e CI —, ‹ › per scorrere la lista filtrata da dentro una PR, i suoi commit, i suoi aggiornamenti (ogni push, cosa ha cambiato, cosa c’è di nuovo dalla tua ultima visita) e commenti su una riga del suo diff.
keywords: pull request lista pagina merge request pr mr filtro autore revisore mie in attesa della mia revisione revisione chiesta ci fallita branch di destinazione bozze unite chiuse ricerca triage precedente successiva alt freccia navigazione checkout vai al branch di origine destinazione copia nome del branch fetch commento di riga commento inline commento di revisione commento sul diff commenta riga scheda file revisione del codice line comment scheda commit elenco dei commit commit della pr cronologia dei commit apri commit copia sha scarica il branch della pr editor markdown barra di formattazione anteprima menzione commits tab commit list open commit copy sha markdown editor toolbar preview mention albero dei file albero delle cartelle vista ad albero vista percorso file visti segna cartella come vista modifica elimina rimuovi modificato refuso file tree viewed files edit delete edited typo riferimento titolo scheda al passaggio work item AB# numero della issue tooltip reference title hover card issue number fork commit della pr refs/pull head commenti visualizzati immagini pixel traccianti immagine bloccata clic per caricare attività tabella blocco rendered comments images blocked image aggiornamenti iterazioni push force push rebase cronologia riscritta versioni del diff cosa è cambiato dall’ultima visita badge nuovo segna come visto confronta aggiornamento updates iterations history rewritten diff versions what changed since last visit new badge mark as seen compare update
source: ced0b909c8b775fb4c2a4d61bc521cd6cc6d2bcc
---

# Pagina delle pull request

Un repository movimentato ha venti pull request aperte nello stesso momento. La
barra laterale le elenca, ma una riga ciascuna dice poco: di chi è quale, quali
aspettano te, quali sono diventate rosse. Scoprirlo voleva dire aprirle una per
una, leggere, tornare indietro, aprire la successiva. La **pagina delle pull
request** risponde a queste domande in una sola schermata e, una volta aperta una
pull request, **‹ ›** ti portano alla successiva della stessa lista senza tornare
indietro.

![La pagina delle pull request con la ricerca «pix»: corrispondenze evidenziate, le tue segnate «tu», una CI fallita e una bozza](../../screenshots/pull-requests.webp)

## Aprirla

- L’**icona a elenco** nell’intestazione **PULL REQUEST** della barra laterale
  (*Vedi tutte le pull request*).
- *Pull request…* nella palette dei comandi (⌘K), oppure **Strumenti → Pull
  request…**.

Come la wiki e le [esecuzioni CI](ci-runs.md), la pagina sta nella scheda del
repository.

## Schede

| Scheda | Cosa contiene |
|---|---|
| **Aperte** | Tutte le pull request aperte, bozze comprese |
| **Bozze** | Solo quelle aperte segnate come bozza |
| **Unite** | Le pull request unite, lette la prima volta che apri la scheda |
| **Chiuse** | Chiuse senza unione (rifiutate, abbandonate), lette insieme alle Unite |

I conteggi accanto ad Aperte e Bozze vengono dalla lista che la barra laterale ha
già. Unite e Chiuse vengono chieste solo quando ne apri una, e una volta per
sessione; **Aggiorna** le richiede.

## Filtri

| Filtro | Tiene |
|---|---|
| **Cerca** | Le pull request il cui titolo, descrizione, branch o numero contengono ogni parola scritta. `#482` o `482` trova quel numero; le corrispondenze sono evidenziate nel titolo |
| **Autore** | Un autore — ciascuno con quante ne ha in questa scheda. **Io** è il primo |
| **Revisore** | Un revisore richiesto, oppure **Revisione chiesta a me** |
| **Branch di destinazione** | Le pull request verso quel branch |
| **Mie** | Una scorciatoia per *Autore: Io* |
| **In attesa della mia revisione** | Una scorciatoia per *Revisore: revisione chiesta a me* |
| **CI fallita** | Le pull request i cui controlli sull’head sono falliti |

La riga sotto i filtri dice quante pull request della scheda sono mostrate e quali
filtri sono attivi, con **azzera i filtri** per toglierli tutti.

I filtri restano per repository **finché l’app è in esecuzione** — esci dalla
pagina, torna, e sono come li hai lasciati. Di proposito non vengono salvati tra
un riavvio e l’altro: un filtro «mie, CI fallita» tornato in silenzio una
settimana dopo nasconderebbe pull request che non hai chiesto di nascondere.

### Chi sono «io»

«Io» è l’account con cui le chiamate di questo repository si autenticano
sull’host — il profilo a cui il repository è [associato](profiles.md), altrimenti
quello attivo — chiesto all’host stesso. Quando il token non sa dire di chi è
(nessuno scope utente), o non c’è un token, **Io**, **Mie** e **In attesa della
mia revisione** non vengono offerti.

## La lista

| Colonna | Cosa mostra |
|---|---|
| **#** | Il numero, con un’icona per aperta, bozza, unita o chiusa |
| **Titolo** | Il titolo, un badge *bozza* e chi deve ancora revisionare — nel colore d’accento quando sei tu |
| **Autore** | L’immagine dell’host quando la fornisce, altrimenti l’iniziale, e **tu** sulle tue |
| **Branch** | Origine → destinazione |
| **Controlli** | I controlli dell’head riassunti — `6/6`, `1 falliti`, `2 in corso`; passa sopra per i conteggi |
| **Aggiornata** | Quanto tempo fa è cambiata l’ultima volta; passa sopra per la data |

Le righe sono ordinate per attività più recente. Un clic apre la pagina propria
della pull request ([Hosting e pull request](hosting.md)). Su un host senza quella
pagina, la riga apre la pull request nel browser.

In un [checkout di un fork](hosting.md#le-tue-pull-request-sul-repository-dorigine-di-un-fork) vengono elencate anche le tue pull
request sul repository d’origine, segnate *su owner/repo*.

## Scorrere la lista da una pull request

![Una pull request aperta dalla lista filtrata: ‹ 1 di 4 › e i filtri da cui proviene](../../screenshots/pull-request-nav.webp)

Una pull request aperta dalla pagina mostra una striscia sopra il titolo:

- **← Pull request** torna alla lista, con i filtri come li hai lasciati.
- **‹ k di n ›** passa alla pull request precedente o successiva della lista da
  cui l’hai aperta — la lista filtrata, nel suo ordine, com’era al momento del
  clic. I tooltip indicano la pull request a cui porta ciascuna freccia.
- **Alt+← / Alt+→** fanno lo stesso da tastiera. Si possono riassegnare in
  **Impostazioni → Scorciatoie**. Si fanno da parte mentre il cursore è in un
  campo di testo (dove Option+← si sposta di parola) e mentre il terminale ha il
  focus.

Spostarsi sostituisce la pagina sul posto, quindi scorrere dieci pull request non
lascia dieci icone nella scheda; anche aprire un’altra riga dalla lista la
sostituisce.

Una pull request aperta **da qualsiasi altro punto** — la barra laterale, una
notifica — scorre le pull request aperte del repository nell’ordine predefinito
della pagina (Aperte, nessun filtro). Una che non è nemmeno in quella lista, come
un livello unito di uno stack, mostra solo la via di ritorno alla lista.

## Andare al branch di una pull request

Per lavorare su una pull request ti serve il suo branch in checkout — e in un
repository con migliaia di branch, trovarlo per nome nella lista dei branch è la
parte lenta. Sulla pagina di una pull request, il campo **Branch** lo fa per te:

- **Il nome del branch è un link.** Un clic fa il checkout di quel branch e ti
  porta al grafo del repository, sulla punta del branch. La pagina della pull
  request resta aperta nella scheda.
- **Un branch che esiste solo sul server** viene prima scaricato con un fetch —
  solo quel branch, non tutto il remote — e messo in checkout come branch locale
  che lo traccia. Un branch che hai già in locale viene attivato così com’è — non
  viene aggiornato, quindi fai pull quando vuoi gli ultimi commit della pull
  request.
- **Il branch su cui sei già** è segnato come *attuale*. Non viene fatto nessun
  checkout.
- **Il pulsante copia** accanto a ogni nome lo mette negli appunti.
- **Annulla** (⌘Z) torna al branch su cui eri ed elimina il branch locale creato
  dal checkout — a meno che tu non ci abbia fatto commit nel frattempo, nel qual
  caso viene lasciato com’è.

L’intestazione offre le stesse due mosse come pulsanti: **Vai al branch di
origine** e **Vai al branch di destinazione**. Funzionano anche sul branch su cui
sei già — semplicemente ti portano al repository. Con i [colori delle icone](themes.md#colori-delle-icone) attivi, ogni pulsante dell’intestazione ha il suo: aggiorna blu, revisione IA viola, anteprima turchese, branch di origine verde, branch di destinazione arancione (apri nel browser resta grigio).

Non viene consultato nulla finché non fai clic: aprire una pull request non legge
né scarica alcun branch.

Cosa non fa:

- **Il branch di origine di un fork** sta in un altro repository, quindi non ha
  link (il pulsante copia resta). **Prova la pull request in locale…**, offerto
  subito sotto, è il modo per eseguirla qui. Il branch di destinazione resta un
  link.
- **Nessun remote corrispondente.** Il branch viene cercato sul remote il cui URL
  è il repository della pull request. Quando nessun remote configurato punta lì, il
  link non fa nulla e il suo tooltip spiega perché.
- **Un branch eliminato.** Una pull request unita spesso si è portata via il suo
  branch; il fetch dice allora che il branch non esiste più sul remote, e resti
  sulla pull request.
- **Modifiche locali.** Il checkout non è distruttivo, quindi non c’è conferma — e
  git rifiuta il checkout quando le tue modifiche non committate verrebbero
  sovrascritte. L’errore indica quali file; fai commit o stash e fai di nuovo
  clic.
- **Questa finestra.** Il checkout avviene nella working tree di questo
  repository. Quando il branch è già in checkout in un altro
  [worktree](worktrees.md), si apre invece la scheda di quel worktree.

## Commit

La barra laterale diceva quanti commit ha una pull request, mai quali. Revisionare
un commit alla volta — come la maggior parte delle pull request è pensata per
essere letta — ti mandava nel browser. La scheda **Commit**, tra Conversazione e Aggiornamenti, li elenca:

- **Dal più vecchio**, nell’ordine in cui si applicano, raggruppati sotto il giorno
  in cui sono stati scritti. Un commit portato dentro con un rebase fuori
  dall’ordine delle date apre un giorno tutto suo invece di essere spostato.
- Ogni riga ha l’immagine dell’autore (dove l’host la fornisce), l’oggetto,
  l’autore, quanto tempo fa e lo SHA breve. Un badge **merge** segna un commit con
  due genitori, dove l’host lo dice.
- **▸** accanto a un commit che ha più dell’oggetto mostra il resto del messaggio.
- **Copia** mette lo SHA completo negli appunti; **Apri nel browser** apre il commit
  sull’host — dentro la pull request dove l’host ha una pagina del genere (GitHub,
  GitLab, Bitbucket Data Center), altrimenti sulla pagina del commit del
  repository.

![La scheda Commit: i commit di una pull request raggruppati per giorno, uno con il messaggio completo aperto](../../screenshots/pr-commits.webp)

**Fai clic su una riga** — o raggiungila con Tab e premi Invio — per aprire il
commit nell’app, come farebbe un clic nel grafo: la vista del repository, quel
commit selezionato, i suoi dettagli aperti. Funziona quando questo clone **ha** il
commit. Quando non ce l’ha, la riga lo dice invece di fallire in silenzio, e
offre:

- **Scarica il branch della PR per vederlo** — lo stesso fetch di un solo branch di
  [andare al branch](#andare-al-branch-di-una-pull-request), senza il checkout. Se il commit è arrivato con
  lui, si apre; se no (un force push l’ha riscritto nel frattempo), la notifica lo
  dice.
- **Recupera i commit della pull request**, su una pull request da un **fork**. Il
  suo branch sta in un altro repository, ma la maggior parte degli host rispecchia
  l’head di una pull request nel repository di destinazione sotto un ref proprio —
  `refs/pull/N/head` (GitHub, GitHub Enterprise Server, Forgejo),
  `refs/merge-requests/N/head` (GitLab), `refs/pull-requests/N/from` (Bitbucket Data
  Center). L’app scarica quel solo ref, senza tag, in un ref proprio,
  `refs/githuttbr/pr/<remote>/N`, e il commit si apre come qualsiasi altro: il grafo
  disegna quell’head come una corsia senza etichetta. Riscaricare sposta il ref
  sull’head com’è in quel momento. Se il force push nel frattempo ha lasciato fuori il
  commit, la notifica lo dice.
- **Apri nel browser**, per quando scaricare non è un’opzione.

L’elenco viene letto la prima volta che apri la scheda, non con la pagina, e di
nuovo a ogni **Aggiorna**. Finché non arriva, il conteggio della scheda è quello
che l’host ha dato per la pull request. Le pull request unite e chiuse elencano i
loro commit allo stesso modo.

Cosa non fa:

- **Al massimo 250 commit.** GitHub stesso non ne elenca più di 250 per una pull
  request; l’app si ferma allo stesso numero su ogni host, e dice *l’host ne ha
  altri* quando è così, con un link alla pull request sull’host. Quali 250 dipende
  dall’ordine in cui l’host li elenca — l’app tiene i primi elencati, e la riga
  sopra l’elenco dice quali:

  | Host | Una pull request più lunga mostra |
  |---|---|
  | GitHub | I **primi** 250 (il limite di GitHub stesso) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | I **250 più recenti** |
  | Forgejo | L’estremo che il server elenca per primo; il suo ordine non è documentato |
- **L’head di un fork dove l’host non lo rispecchia.** Azure DevOps pubblica solo un
  risultato di merge, mai l’head proprio di una pull request, e bitbucket.org nessuno
  dei due: lì la riga offre solo il browser. Su un altro host che si rivela non
  rispecchiarlo, il fetch lo dice. **Prova la pull request in locale…** porta qui il
  risultato di merge di Azure, se è quello che ti serve.
- **Gli head scaricati restano.** `refs/githuttbr/pr/…` non è un branch: niente da
  mettere in checkout né da pushare, un fetch con prune non lo tocca, e git ne tiene i
  commit. Niente lo rimuove nemmeno — né chiudere la pagina né la
  [pulizia dei branch](branch-cleanup.md). Per sbarazzartene, elimina i ref a mano:
  `git for-each-ref refs/githuttbr/pr` li elenca, e `git update-ref -d <ref>` ne
  elimina uno.
- **Un remote il cui nome contiene una `/`** non può essere una parte del nome di quel
  ref, quindi lì il fetch viene rifiutato.
- **Un branch eliminato.** Una pull request unita spesso si è portata via il suo
  branch: il fetch lo dice. bitbucket.org non elenca più alcun commit una volta
  sparito il branch di origine.
- **Merge squash.** I commit di una pull request unita con squash non hanno mai
  raggiunto il branch di destinazione, quindi dopo l’eliminazione del suo branch
  stanno solo sull’host.
- **Gli autori** sono nominati come li nominano i loro commit. GitLab, Azure DevOps
  e Bitbucket Data Center non danno immagini senza un accesso che un’immagine non
  può inviare, quindi quelle righe mostrano l’iniziale.
- **I messaggi lunghi su Azure DevOps** possono essere tagliati: l’elenco di Azure
  tronca il messaggio di un commit, e l’app mostra ciò che invia.
- Le pull request di **bitbucket.org** si aprono nel browser — l’app non ha ancora
  una pagina per loro —, quindi lì questa scheda non si raggiunge, anche se l’app
  sa leggere l’elenco.

## Aggiornamenti

Una pull request che hai revisionato lunedì giovedì è andata avanti. La scheda Commit
mostra dove si trova ora, non cosa è successo nel frattempo: quali commit sono
arrivati con quale push, se qualcuno ha fatto un force push e riscritto ciò che avevi
già letto, e com’è il codice *rispetto alla versione che hai visto*. La scheda
**Aggiornamenti**, tra Commit e File, risponde a questo — come fa la scheda Updates
di Azure DevOps.

Elenca ogni push nella pull request, **dal più recente**:

- **Aggiornamento 1 — apertura** è il push con cui la pull request è stata aperta;
  ogni push successivo prende il numero seguente.
- Ognuno mostra **quando**, **chi ha fatto il push** (dove l’host lo dice) e i
  **commit aggiunti** — SHA breve, oggetto, autore. Dove l’host riporta commit che un
  push ha tolto dal branch, sono elencati sotto **Commit rimossi**, barrati.
- Un force push o un rebase è segnato come **cronologia riscritta**: commit che avevi
  letto possono essere spariti, e quelli elencati possono essere nuove copie di
  lavoro vecchio. Su Azure DevOps, un push che ha spostato la pull request su un altro
  branch di destinazione è segnato come **destinazione cambiata**.

![La scheda Aggiornamenti: push dal più recente, un force push segnato «cronologia riscritta», uno segnato Nuovo](../../screenshots/pr-updates.webp)

### Cosa è cambiato in un aggiornamento

**Vedi le modifiche di questo aggiornamento** apre la scheda File solo su quel push:
il diff dall’head dell’aggiornamento precedente a questo — o, per l’Aggiornamento 1,
dal branch di destinazione su cui è stato aperto, dove l’host indica quel punto
(Azure DevOps, GitLab). Lo stesso albero dei file e lo stesso visualizzatore, con un
banner — *Modifiche di Aggiornamento 3 (rispetto a Aggiornamento 2)* — e **Mostra
tutte le modifiche** per tornare all’intera pull request.

![La scheda File con le modifiche di un aggiornamento, con il banner sopra l’albero dei file](../../screenshots/pr-update-diff.webp)

Il diff è sempre fatto **in questo clone** quando si può: `git diff` tra i due head,
esatto e senza chiedere all’host. Quando manca uno dei due head, l’app prima scarica
entrambi **tramite i loro id di commit** dal remote della pull request — non viene
scritto nessun branch, tag o ref; un head sostituito da un force push non sta più su
nessun branch, ma la maggior parte degli host lo serve ancora tramite id — e
confronta qui. Solo quando quel fetch fallisce si chiede all’host:

| Host | Il confronto dell’host |
|---|---|
| Azure DevOps | Le modifiche dell’iterazione con `$compareTo` — tra i due push |
| GitLab | Il confronto del repository, direttamente da un head all’altro |
| Bitbucket Data Center | Il confronto del repository — **dalla base comune** dei due head |
| GitHub | L’API di confronto (`base...head`) — **dalla base comune** dei due head |
| Forgejo / Gitea | Nessuno: la loro API non ha un diff tra due commit |

Dalla base comune, il diff di una riscrittura non è ciò che il push ha fatto: ciò che
ha rimosso non è mostrato, e le modifiche ricevute nel frattempo dal branch di
destinazione possono sembrare della pull request. Il banner lo dice — *Confrontato
dalla base comune: ciò che questo push ha rimosso non è mostrato.* — quando un
aggiornamento con cronologia riscritta è stato confrontato così. Quando nulla
funziona, il banner lo dice e propone di scaricare il branch (o, da un fork, l’head
della pull request) e confrontare qui.

I commenti di riga appartengono al diff dell’intera pull request, quindi non c’è
nessun **+** su una riga mentre è mostrato un solo aggiornamento; il banner lo dice.
Spuntare un file come visto funziona come sempre — segna il file nella pull request.

### Novità dalla tua ultima visita

Gli aggiornamenti pushati dall’ultima volta che hai aperto la scheda portano un badge
**Nuovo**, e la scheda stessa dice quanti sono: *Aggiornamenti 5 · 2 nuovi*. Aprire
la scheda li segna come visti (i badge restano finché ci sei sopra, così vedi quali
erano nuovi); quando **Aggiorna** ne porta altri con la scheda aperta, **Segna come
visto** li toglie. Aprire solo la pagina della pull request non segna nulla. La prima
volta che apri la scheda Aggiornamenti di una pull request, niente è nuovo — non c’è
una visita precedente con cui confrontare.

Gli aggiornamenti sono letti con la pagina, per quel conteggio, e di nuovo con
**Aggiorna** — non dopo ogni commento o revisione che pubblichi.

Ciò che è stato visto è tenuto solo su questo computer, per repository e pull
request, e non viene mai inviato all’host.

### Per host

| Host | Da dove vengono gli aggiornamenti | Chi ha fatto il push | Commit rimossi | Riscrittura rilevata |
|---|---|---|---|---|
| Azure DevOps | Le **iterazioni** della pull request — la registrazione di Azure di ogni push | Sì | No (non riportati) | Sì: `forcePush` / `rebase` |
| GitLab | Le **versioni del diff** della merge request; i commit di ogni versione ricavati dal suo head | No (le versioni non nominano nessuno) | Sì | Sì: un head precedente non più raggiungibile |
| Bitbucket Data Center | L’attività della pull request: **OPENED** e ogni **RESCOPED** che ha spostato il branch di origine | Sì | Sì, con i totali dell’host | Sì: un rescope che ha rimosso commit |
| GitHub | **Dedotti** dai commit e dai force push della timeline — vedi sotto | Solo i force push | No | Sì: un evento di force push |
| Forgejo / Gitea | Le voci **push** della timeline, la prima scritta con la pull request stessa | Sì | No | Sì: una voce di force push |
| bitbucket.org | Non disponibile | — | — | — |

**GitHub non registra un push normale** — solo i force push —, quindi gli
aggiornamenti sono **dedotti dagli orari dei commit**. Un aggiornamento è una serie di
commit che si basano l’uno sull’altro, tra un force push e l’altro; un commit che non
si basa sul precedente, o che arriva più di dieci minuti dopo, inizia il successivo.
Un commit fatto dopo l’apertura della pull request non può essere stato
nell’apertura. Così un push di commit fatti a un’ora di distanza appare **diviso** in
due, e due push a pochi minuti di distanza appaiono come **uno**; la scheda dice che
il raggruppamento è approssimativo. I nuovi commit di un rebase, che la timeline può
elencare subito prima del suo force push, contano per quel force push. Gli head prima
e dopo un force push sono esatti, quindi lo è anche il suo **Vedi le modifiche**.

### Limiti

- **Tetti.** Vengono elencati i 100 aggiornamenti più recenti. La timeline di GitHub è
  letta dal suo capo più recente, fino a 500 elementi; l’attività di Bitbucket Data
  Center (anch’essa dalla più recente) fino a 1.000; le versioni e i commit di GitLab
  fino a 300 ciascuno; la timeline di Forgejo fino a 500 voci, le più recenti se è più
  lunga. Quando un tetto taglia l’**apertura**, i numeri non sono più quelli
  dell’host: la scheda lo dice e conta all’indietro dall’ultimo (*Ultimo
  aggiornamento*, *Aggiornamento, 2 prima dell’ultimo*).
- **Azure DevOps** non riporta commit rimossi; al loro posto viene segnato un force
  push o un rebase. Un’iterazione la cui lista di commit Azure accorcia viene letta a
  parte (fino a 500 commit), e l’aggiornamento dice quando è ancora parziale.
- **GitLab** non nomina chi ha fatto il push. Una versione il cui head è stato
  riscritto viene letta a parte per trovarne i commit — per le dieci più recenti di
  queste versioni —, una volta per sessione: le versioni non cambiano mai.
- **Forgejo e Gitea** non elencano commit per un force push — solo i suoi due head,
  che è ciò che confronta **Vedi le modifiche** —, e dopo un force push niente dice
  cosa conteneva l’apertura, che resta quindi vuota a meno che il server non abbia
  registrato il push dell’apertura stessa. La loro API non ha un diff tra due commit,
  quindi quel confronto ha bisogno di entrambi i commit in questo clone. Un server
  senza l’API della timeline mostra tutti i commit in un solo aggiornamento.
- **Scaricare tramite id** richiede un host che serva un commit tramite il suo id.
  GitHub lo fa per qualsiasi commit che ha ancora; un altro host, o un semplice server
  git, può rifiutarne uno a cui non punta nessun branch — allora si usa il confronto
  dell’host. I commit scaricati restano in questo clone senza ref, e git li raccoglie
  col tempo.
- **Il confronto di Bitbucket Data Center** legge il diff strutturato del server e lo
  disegna come diff unificato; file molto grandi possono tornare troncati.
- Un head riscritto può essere **sparito dall’host** per sempre (Azure e GitLab lo
  tengono; altri possono raccoglierlo). Allora nessuna delle due parti può
  confrontare, e il banner lo dice.
- Le pull request di **bitbucket.org** si aprono nel browser e non hanno la scheda
  Aggiornamenti.

## Leggere i file

Una pull request di duecento file è difficile da leggere come duecento percorsi
completi. La lista della scheda **File** ha lo stesso selettore **Percorso / Albero**
del pannello di commit, e la scelta vale per tutta l’app. In **Albero** i file stanno
sotto le loro cartelle (una catena come `src/main/ipc` è una sola riga), e ogni
cartella mostra il suo **+/−** sommato e quanti dei suoi file sono visti (*3/5*). La
casella di una cartella segna come visti tutti i file al suo interno, o li toglie
tutti; i segni restano solo su questo computer, mai inviati all’host. Un segno
ricorda la versione del diff del file: quando un push cambia un file visto, torna non
visto, con un punto giallo (*Modificato da quando l’hai visto*). Un file senza diff
(binario, troppo grande) viene confrontato solo per stato e conteggi di righe. Un file con conversazioni di revisione mostra accanto un numero in un fumetto (le cartelle sommano i loro), così quelli con commenti spiccano in un elenco lungo; contano anche le conversazioni obsolete. Fai
clic su una cartella, o premi ←/→ su di essa, per chiuderla; ↑/↓ (o j/k) scorrono i
file sullo schermo e aprono ciascun diff. Le cartelle chiuse vengono ricordate per
pull request finché l’app resta aperta, e un file aperto dentro una di esse apre la
strada fino a lui. L’albero è ordinato per nome, non nell’ordine in cui l’host elenca
i file.

![La scheda File in vista ad albero: cartelle con le modifiche sommate e i conteggi dei visti, una chiusa](../../screenshots/pr-files-tree.webp)

**Immagini.** Un’immagine che la pull request aggiunge, rimuove o cambia (png, jpg,
gif, webp, bmp, ico, avif, svg) non ha un diff di testo da leggere, quindi la scheda
mostra l’immagine — la stessa vista di un commit: la nuova, la vecchia, o prima e dopo
affiancate e con un cursore. Un’immagine rinominata confronta il vecchio percorso alla
base con il nuovo all’head; nel diff di un singolo aggiornamento, i due head
dell’aggiornamento. I byte vengono da questo clone quando ha i commit, il che è gratis
e veloce, altrimenti dall’host con il profilo del repository. Limiti: un’immagine
oltre i 32 MB non viene mostrata in anteprima; i commenti di riga non si applicano a
un’immagine (un SVG mantiene il suo diff di testo, e i suoi commenti, sotto);
un’immagine conservata in **Git LFS** viene letta dall’host, perché un clone ha solo il
suo puntatore — GitLab, Azure DevOps e Forgejo lo risolvono, mentre l’API di GitHub dà
solo il puntatore, quindi lì la scheda ti manda all’host; dove l’host non indica la
base di merge (ripiega sulla punta del branch di destinazione), una nota dice che il
«prima» può includere modifiche successive sulla destinazione; e quando né il clone né
l’host possono dare i byte, la scheda lo dice e propone di scaricare il branch della
pull request o di aprirla sull’host.

![Un’immagine cambiata dalla pull request, prima e dopo affiancate](../../screenshots/pr-image-diff.webp)

**Percorsi e il tuo editor.** La barra sopra il diff ha un pulsante per copiare il
percorso del file e un menu **⋯**; il clic destro su un file o una cartella nella lista
apre lo stesso menu. Copia il percorso, il percorso precedente di un file rinominato o
quello della cartella; e apre il file nel tuo [editor](editor.md) (o in un’altra app)
o lo mostra nel file manager. Queste due azioni agiscono sulla **tua copia di lavoro**,
non sulla versione della pull request: sono attive solo per un file che vi esiste (un
file che la PR elimina, o uno che il tuo branch non ha, dice perché), e quando il
branch in checkout non è quello della PR, il menu dice quale branch apriresti.

**Tornare.** Lascia una pull request per il repository, un’altra scheda o la PR
successiva, e quando torni è come l’hai lasciata: la stessa scheda, lo stesso file
aperto, lo stesso scorrimento, e ogni testo che non avevi inviato — il commento, una
risposta, un commento di riga, una modifica. Questo dura finché non chiudi la pull
request o esci dall’app; è tenuto solo in memoria, per le 50 pull request più recenti
(oltre, il punto più vecchio viene lasciato andare, e l’eventuale testo passa alla
prossima pagina di pull request che apri). Chiudere una PR con testo non inviato chiede
prima. Se un aggiornamento trova che il posto di una bozza non c’è più — la
conversazione a cui rispondeva, il commento che modificava, il file su cui stava —, il
testo non va perso: aspetta in cima alla pagina di essere copiato o scartato.

### Da dove viene il diff

Una revisione vale quanto il diff che legge. L’API di un host non è una buona fonte per
questo: Azure DevOps non manda alcun diff, solo l’elenco dei file, e ognuno va
scaricato due volte e confrontato; GitHub si ferma a 3000 file e omette la patch di uno
grande; GitLab segna un diff grande come *troppo grande* e non manda nulla. Quindi la
scheda File legge **prima questo clone**, su ogni host:

1. Chiede all’host i due commit della pull request — dove inizia e il suo head. Azure
   DevOps, GitLab e Forgejo indicano la base di merge; Bitbucket Data Center indica la
   base del diff a cui si ancorano i suoi commenti di riga; GitHub indica solo il
   branch di destinazione, la cui base di merge con l’head viene allora calcolata qui
   (o, senza i commit, con il confronto di GitHub). L’anteprima delle immagini usa gli
   stessi due commit.
2. Quando entrambi sono qui, `git diff` tra loro dà ogni file, senza tetto al numero.
   Sono gli stessi due commit che confronta la pagina dell’host stesso, quindi un
   numero di riga qui è il numero di riga lì e un commento di riga finisce dove lo
   metti.
3. Quando non sono qui, vengono scaricati **tramite i loro id** dal remote della pull
   request — solo oggetti, nessun branch viene creato o spostato —, una volta, quando
   la pagina si apre (e di nuovo con Aggiorna), con *Recupero dei commit della pull
   request…* sopra l’elenco nel frattempo. Un server che non consegna un commit tramite
   id (alcuni Azure DevOps e server git semplici) viene saltato in silenzio.
4. Solo allora si usa l’API dell’host, e un file per cui non dà diff dice perché invece
   di fingersi vuoto (sotto).

Un file letto dopo — aperto quando *non era ancora caricato*, o dopo **Riprova** — si
unisce all’elenco come gli altri: lo stesso visualizzatore, e commenti di riga su di
esso.

Su Azure DevOps la via dell’API legge i primi cento file all’apertura della scheda,
tre alla volta ed entro un minuto in tutto, e il resto quando apri ciascuno. Una
richiesta limitata mette in pausa ogni lettura fino all’attesa chiesta dal server; una
che fallisce comunque lo dice, con il motivo. Se un file è testo si decide dai suoi
byte, non dal flag *binary* di Azure — che mette anche sui file UTF-16 e su certi
testi non ASCII. Quando l’host elenca meno file di quanti ne abbia la pull request
(GitHub si ferma a 3000), una riga sopra l’elenco lo dice.

### Quando un file non mostra diff

| Cosa dice | Perché | Cosa puoi fare |
|---|---|---|
| **Binario** | I suoi byte non sono testo: un’immagine, un archivio. UTF-16 e il vecchio testo a un byte vengono riconosciuti come testo. | Aprirlo sull’host. |
| **Troppo grande da mostrare** | Più di 20.000 righe cambiate o 8 MB di diff, o una versione oltre i 4 MB. Il suo **+/−** viene comunque contato quando il clone l’ha letto. | Aprirlo sull’host. |
| **Non ancora caricato** | Oltre quanto conserva una lettura (circa 150.000 righe di diff), o, dall’API di Azure DevOps, oltre i primi cento file o il minuto. | Si carica quando lo apri; **Carica il diff** se non è successo. |
| **Impossibile caricare** | La lettura è fallita — il motivo è mostrato sotto. | **Riprova**. |
| **L’host l’ha omesso** | L’API dell’host non ha mandato diff e questo clone non ha i commit della pull request. | **Recupera la pull request per vederla in locale** — i commit tramite id, o l’head della pull request di un fork —, poi il diff viene fatto qui. |
| **È cambiato solo il nome o il modo** | Una rinomina o un cambio di permessi: il contenuto è lo stesso. | Niente da revisionare nel contenuto. |
| **Codifica cambiata** | Lo stesso testo salvato in un altro modo: un byte order mark aggiunto o tolto, UTF-16 trasformato in UTF-8. | Verificare che il cambio sia voluto — ad alcuni strumenti importa. |

Nell’elenco, un file il cui diff non è stato letto — non ancora caricato, impossibile
caricare, omesso dall’host — mostra **—** invece di **+0 −0**, che si leggerebbe come
«non è cambiato nulla». Un file binario e una pura rinomina mostrano il loro vero
**+0 −0**, e quando l’host conta comunque le righe (GitHub lo fa, anche per una patch
che omette), i conteggi vengono mostrati.

## Commentare una riga

Qui si poteva già rispondere a un thread di revisione, ma non aprirne uno, quindi una
vera revisione ti mandava ancora nel browser. Nella scheda **File** di una pull
request, ogni riga del diff accetta un commento suo:

- **Passa sopra una riga** e premi il **+** che compare sul suo numero, oppure
  **fai clic sulla riga** stessa (un clic che chiude una selezione di testo, o un
  doppio clic che seleziona una parola, non conta: quello è leggere). Anche il menu
  del tasto destro — o il tasto del menu contestuale della tastiera — ha *Commenta la
  riga N*.
- Si apre un riquadro **sotto quella riga**. Scrivi, poi **Commenta** — oppure
  ⌘/Ctrl+Invio. **Annulla** lo chiude; anche **Esc**, chiedendo prima se hai già
  scritto qualcosa. In entrambi i casi il focus torna su quella riga.
- Se va a buon fine, il nuovo thread compare **sotto la sua riga**, e nei thread di
  revisione della scheda Conversazione, dove lo vedranno tutti gli altri.

![Un commento scritto sotto una riga modificata, con un thread precedente sotto la sua riga](../../screenshots/pr-line-comment.webp)

Il lato su cui finisce il commento segue la riga:

| Riga | Ancorato a |
|---|---|
| **Aggiunta** (verde) | La nuova versione del file, al suo nuovo numero |
| **Eliminata** (rossa) | La vecchia versione, al suo vecchio numero |
| **Invariata** | La nuova versione (a GitLab vengono inviati entrambi i numeri, come richiede) |

Anche i thread esistenti sono mostrati sotto le loro righe, con il riquadro di
risposta dove l’host permette all’app di rispondere dentro un thread (Forgejo no).
Un thread compare su una riga solo quando l’host dice che appartiene ancora al diff
mostrato; il resto rimane nella scheda Conversazione, invece che su una riga
indovinata:

| Host | Un thread scritto prima dell’ultimo push |
|---|---|
| GitHub | Obsoleto quando la sua riga è cambiata: solo Conversazione |
| GitLab | Scritto su un head precedente: solo Conversazione |
| Azure DevOps | Seguito da Azure fin dove si trova ora la sua riga |
| Bitbucket Data Center | Orfano quando la sua riga non c’è più: solo Conversazione |
| Forgejo | Forgejo non dice che un commento è obsoleto, quindi compare al numero di riga registrato — dopo un push quella riga può contenere altro codice |

Un commento su una riga fuori dagli hunk mostrati sta solo nella scheda
Conversazione, su ogni host.

Un commento scritto e non inviato resta con la pull request, come il testo del riquadro
di commento principale: **‹ ›**, Alt+frecce o un’altra scheda lo lasciano dov’è, e
torna sulla sua riga quando ritorni (vedi *Tornare* sopra). Guardare un altro file lo
conserva; per iniziarne uno su un’altra riga, pubblica o annulla il primo.

Cosa non fa:

- **Una riga, pubblicata subito.** Non ci sono intervalli di righe, né una revisione
  in sospeso in cui raccogliere commenti da inviare dopo, né modifiche suggerite.
  Ogni commento viene pubblicato nel momento in cui lo invii, come thread a sé (su
  Forgejo, come revisione che contiene solo quel commento, perché Forgejo non ha una
  chiamata per il commento singolo).
- **Il diff che stai guardando.** La scheda File ricorda a quale commit (su Azure
  DevOps, a quale iterazione) è stato letto il suo diff, e il commento viene inviato
  rispetto a quello. Quando nel frattempo la pull request è andata avanti — un push,
  una nuova base di merge —, il commento non viene pubblicato sulla riga che ora ha
  quel numero: viene rifiutato con *la pull request è cambiata da quando questo diff
  è stato caricato*, e **Aggiorna** mostra il nuovo diff. Su GitHub invece il
  commento viene pubblicato sul commit che hai letto, e GitHub lo segna come
  obsoleto se quella riga è cambiata. Una riga che l’host continua a non accettare
  viene rifiutata come fuori dal diff.
- **Rifiutato.** Senza permesso di commentare (un token in sola lettura, un account
  a cui il repository non permette di commentare), l’host lo rifiuta e il messaggio
  dice che il motivo è quello.
- Le pull request di **bitbucket.org** si aprono nel browser — l’app non ha ancora
  una pagina per loro —, quindi lì un commento di riga si fa ancora sul sito.
- **Un file senza diff** (binario, o troppo grande perché l’host lo includa) non ha
  righe da commentare.

## Scrivere commenti

Ogni riquadro della pagina — il commento in fondo, una risposta in un thread, un
commento su una riga — è lo stesso editor Markdown: schede **Scrivi / Anteprima**,
una barra di formattazione con le scorciatoie di GitHub, elenchi che continuano con
Invio e completamento con **@** / **#** dalle persone e dalle pull request già sullo
schermo. Un riquadro di risposta mostra i suoi strumenti appena ci fai clic dentro,
e invia con ⌘/Ctrl+Invio, perché ora Invio inizia una nuova riga.
[Scrivere commenti](writing-comments.md) ha i dettagli e i limiti.

## Come vengono mostrati i commenti

I commenti si scrivono in Markdown, quindi un commento mostrato come testo semplice è
pieno di `**`, `- [ ]` e recinti di codice. La descrizione, la conversazione e i
thread di revisione (nelle schede Conversazione e File) sono disegnati come Markdown:
titoli, elenchi ed elenchi di attività, tabelle, citazioni, blocchi di codice
evidenziati nel linguaggio che il recinto nomina, link e immagini. La pagina della
issue disegna il suo testo allo stesso modo. `#123`, `AB#123`, `!123` e `@user` nel
testo diventano ancora link, con la [scheda](#di-cosa-parla-un-123-o-un-ab123) dove ne avevano una.

![Un commento visualizzato: una tabella, un’immagine di un altro sito trattenuta dietro il suo segnaposto e un blocco di codice evidenziato](../../screenshots/pr-rendered-comment.webp)

Da dove viene il disegno:

| Host | Reso da |
|---|---|
| GitHub, GitHub Enterprise Server | GitHub stesso (`body_html`): menzioni e riferimenti sono collegati come sul sito, le immagini passano dal proxy immagini di GitHub e gli allegati privati portano il loro indirizzo firmato |
| GitLab, Forgejo, Azure DevOps, Bitbucket Data Center | L’app, dal Markdown del commento. Un link relativo punta dentro il repository; su GitLab, `/uploads/…` punta dentro il progetto, come fa GitLab |

Un commento è contenuto di altre persone, quindi ciò che può contenere è ristretto, e
più ristretto che per i tuoi file: un elenco esplicito di tag, link e immagini solo su
`https:`, `http:` o `mailto:`, niente script, frame, moduli, SVG né stili inline, e
link che non si aprono mai dentro l’app (vanno al tuo browser). Una casella in un
elenco di attività è mostrata, non cliccabile: spuntarla qui non cambierebbe nulla
sull’host.

**Le immagini di altri siti aspettano un clic.** Caricare un’immagine è una richiesta
che il sito dietro può osservare, con il tuo indirizzo IP e il momento in cui leggi il
commento — chiunque possa commentare può metterci un pixel tracciante. Quindi solo le
immagini dell’host stesso si caricano da sole: su github.com i suoi allegati,
`*.githubusercontent.com` (che include il suo proxy immagini) e le sue risorse; su
qualsiasi altro host, il suo indirizzo. Ogni altra immagine mostra *Immagine da
example.net — fai clic per caricarla*, e il clic carica quell’immagine.
**Impostazioni → Sicurezza → Carica le immagini di altri siti nei commenti** lo
disattiva; vedi [Sicurezza](security.md#immagini-nei-commenti).

**L’anteprima mostra ciò che verrà pubblicato.** In questa pagina e in quella della
issue, la scheda **Anteprima** di ogni riquadro di commento disegna il testo allo
stesso modo: lo stesso profilo, gli stessi a capo, le stesse immagini trattenute — un
link incollato a un’immagine esterna non la carica mentre scrivi. Le finestre di
nuova pull request e nuova issue mantengono l’anteprima Markdown abituale dell’app.

**Troppo lungo o troppo intricato è mostrato come testo.** Il Markdown viene reso
nella finestra dell’app, e alcuni testi costano molto più da rendere di quanto le loro
dimensioni facciano pensare. Un commento oltre i **32.000 caratteri**, o uno
costruito per bloccare il renderer (migliaia di `_` o `*` spaiati in un paragrafo, o
più di 32 livelli di `>` o di marcatori di elenco su una riga), è mostrato come testo
semplice con i link, sotto *Commento lungo mostrato come testo semplice.* o *Commento
mostrato come testo semplice: troppo complesso da visualizzare qui.* Un commento che
non si riesce comunque a rendere ripiega allo stesso modo, da solo: il resto della
pagina non viene toccato.

Cosa non fa:

- **La modifica mostra il testo così come è scritto.** **Modifica** apre ancora il
  Markdown, e una modifica salvata è disegnata dall’app finché la pagina non rilegge la
  pull request (su GitHub, poi da GitHub).
- **Gli allegati privati di GitHub scadono.** GitHub firma l’indirizzo di un’immagine
  privata per pochi minuti; una che non si carica più dopo che la pagina è rimasta
  aperta un po’ torna con **Aggiorna**.
- **Un’immagine relativa su GitHub** che l’app disegna da sé (una risposta inviata
  dall’app, prima che la pagina la rilegga) viene cercata sotto l’indirizzo del
  repository su github.com, che potrebbe non essere dove GitHub la metterebbe.
- **I video** in un commento GitHub appaiono come un link al file, non come un
  lettore.
- **Le estensioni solo di GitHub** che l’app disegna da sé (su altri host) mancano:
  niente scorciatoie emoji, niente diagrammi Mermaid, niente stile per gli avvisi, e
  le formule restano testo.
- **Il codice è evidenziato solo quando il recinto nomina il suo linguaggio.**
  Indovinare il linguaggio vorrebbe dire far passare ogni grammatica su ogni blocco
  della pagina.
- **I messaggi di commit** nella scheda Commit restano testo semplice: git non rende
  il Markdown, e nemmeno gli host.

## Modificare ed eliminare i tuoi commenti

Un refuso in un commento già inviato, o un’osservazione che non vale più, prima
voleva dire passare dal browser. I tuoi commenti hanno ora **Modifica** (la matita)
ed **Elimina** (il cestino) in fondo all’intestazione: commenti della conversazione,
commenti dei thread di revisione e risposte, nelle schede Conversazione e File. Anche
la pagina della issue li ha, per i suoi commenti su GitHub e Forgejo.

![Un tuo commento, segnato come modificato, con Modifica ed Elimina in fondo all’intestazione](../../screenshots/comment-editor.webp)

Che cosa è «tuo» lo decide la pagina stessa, che a ogni caricamento chiede all’host
con quale account si autenticano le chiamate di questo repository (il suo profilo
associato, non quello attivo al momento). La maggior parte degli host indica un
autore per login, confrontato senza badare a maiuscole e minuscole. Azure DevOps indica gli autori per nome visualizzato, che due persone possono
condividere, quindi lì non confronta mai i nomi: un commento è tuo quando l’id del suo
autore corrisponde all’id dell’account, **oppure** il nome univoco del suo autore (il
nome dell’account, di solito un indirizzo email) corrisponde a quello dell’account,
senza badare a maiuscole e minuscole. Ciascuno dei due appartiene a una sola persona;
il secondo copre un id dell’autore che non è quello riportato dalla connessione.
Quando nessuno dei due si può confrontare, nessun commento mostra le azioni. Quando l’app non sa dire chi sei (un token
senza scope utente, o l’host non ha risposto), non le mostra nessun commento;
**Aggiorna** chiede di nuovo. L’host decide comunque: un account a cui non permette di
cambiare un commento viene respinto, e il messaggio lo dice.

- **Modifica** apre il commento sul posto, nello stesso editor Markdown, con il suo
  testo così come è stato scritto. **Salva** (o ⌘/Ctrl+Invio) lo invia; **Annulla** o
  **Esc** lo chiude, chiedendo prima se hai cambiato qualcosa. Vengono tolte solo le
  righe vuote intorno al testo: il codice rientrato e un a capo finale di due spazi
  restano come scritti. Il nuovo testo compare subito e la pagina rilegge la pull
  request. Nella pagina della pull request, una modifica non salvata resta con la pull request
  quando vai avanti con **‹ ›** o cambi scheda, e chiudere la pull request chiede prima.
  La pagina della issue non tiene nulla: lì nulla chiede prima che la sua scheda si
  chiuda.
- **Elimina** chiede sempre prima, e la domanda dice cosa succede: il server rimuove
  il commento per tutti, e non si può annullare. Non c’è una voce di annullamento,
  perché niente può riportarlo indietro.

Eliminare il **primo commento di un thread** che ha risposte (un thread di revisione,
o un commento della conversazione a cui altri hanno risposto) cambia da host a host,
e la conferma dice come. Due di questi casi non sono documentati dall’host, e lo
dice:

| Host | Primo commento di un thread con risposte |
|---|---|
| GitHub | Le risposte dovrebbero restare; la documentazione di GitHub non lo dice. Il thread mantiene il suo riquadro di risposta: senza il primo commento, la risposta viene inviata al thread stesso tramite l’API GraphQL di GitHub, trovato attraverso una risposta che vi è ancora. Se questo fallisce (un Enterprise Server vecchio, un token che GraphQL rifiuta, un thread in cui GitHub dice che questo account non può rispondere), il thread offre invece **Rispondi su GitHub**. Se hai una revisione in corso su GitHub, GitHub può archiviare la risposta al suo interno: allora la notifica lo dice, e nessuno vede la risposta finché non invii quella revisione lì |
| GitLab | Se ne va solo quella nota; il thread e le sue risposte restano |
| Azure DevOps | Dovrebbe essere segnato come eliminato e nascosto, mantenendo il thread e le sue risposte; la documentazione di Azure non lo dice |
| Bitbucket Data Center | Rifiutato: Data Center non elimina un commento che ha risposte. Elimina prima le risposte, oppure modificalo |

Alcuni host segnano un commento come **modificato**. Solo Azure DevOps conserva una
data per il solo testo; su GitHub, Bitbucket Data Center e Forgejo l’app confronta
quando il commento è stato creato e aggiornato l’ultima volta, quindi lì il segno è
un’approssimazione (qualsiasi altra cosa tocchi il commento può impostarlo). Su GitLab
la data cambia anche quando un thread viene risolto, quindi non viene usata.

Cosa non fa:

- **I commenti di revisione di Forgejo** (commenti su una riga) non si possono
  modificare tramite la sua API, e solo alcune versioni possono eliminarne uno,
  quindi non mostrano nessuna delle due azioni: cambiali sul sito. I commenti della
  conversazione funzionano come altrove.
- **Qualcuno l’ha cambiato nel frattempo.** Bitbucket Data Center controlla la
  versione del commento: una modifica o un’eliminazione di un commento cambiato da
  quando la pagina è stata caricata viene rifiutata, e **Aggiorna** mostra quello
  attuale. Gli altri host tengono l’ultima scrittura.
- **Non trovato**: quando l’host non trova il commento, il messaggio dice che
  potrebbe essere stato eliminato, o che questo account non può vederlo, e la pagina
  rilegge la pull request. Una modifica aperta su un commento che non c’è più viene
  scartata.
- Le pull request di **bitbucket.org** si aprono nel browser, quindi non c’è ancora
  una pagina dove modificarne i commenti, anche se l’app sa fare la chiamata.
- **La descrizione** della pull request e i riepiloghi delle sue revisioni non sono
  commenti, e non si modificano qui.

## Di cosa parla un `#123` o un `AB#123`

Un commit che dice *fixes AB#4821* o un commento che dice *vedi #312* ti dà un
numero, non di cosa si trattava. Scoprirlo voleva dire aprirlo. Ora, **puntare un
riferimento** — o raggiungerlo con Tab — apre una piccola scheda con ciò che l’host
ne dice:

- un’icona per il suo tipo, e il riferimento così come è scritto;
- il suo **titolo**;
- il suo **stato** (aperta, chiusa, unita — su Azure DevOps, lo stato proprio del
  work item, come *Active* o *Resolved*);
- su Azure DevOps, il **tipo di work item** (Bug, User Story, Task…).

![La scheda su un riferimento a un work item in un commento: tipo, titolo e stato](../../screenshots/reference-card.webp)

Le schede ci sono nella pagina della pull request (descrizione, commenti, thread di
revisione e il messaggio completo di un commit nella scheda **Commit**), nella
pagina della issue e nell’oggetto del pannello dei dettagli del commit. Nella scheda
**Commit** su Azure DevOps, ogni work item nell’oggetto di un commit (`AB#123`, o
`#123`, lo stesso elemento lì) mostra anche il suo titolo accanto, in grigio. Su
Azure DevOps, `!123` porta a quella pull request, senza scheda.

| Riferimento | Host | Letto da |
|---|---|---|
| `AB#123`, e `#123` in un repository Azure | Azure DevOps | Work item, fino a 200 in una richiesta |
| `#123` | GitHub, GitHub Enterprise Server | Issue e pull request, fino a 50 in una richiesta GraphQL; una richiesta REST ciascuna quando GraphQL fallisce |
| `#123` / `!123` | GitLab | Issue / merge request, una richiesta per tipo |
| `#123` | Forgejo | Issue (anche pull request), una richiesta ciascuna, due alla volta |

Un `#123` conta solo come parola a sé: `org/repo#123` (un altro repository),
`&#39;`, un colore come `#123abc` e il `#issuecomment-…` di un link restano come
sono.

Non si chiede nulla finché una scheda non si apre. Allora il riferimento su cui sei
e quelli più vicini sulla pagina non ancora noti partono in una sola chiamata, così
la scheda successiva di solito è immediata. Le risposte restano in memoria finché
l’app è aperta, mai su disco, per cinque minuti; dopo continuano a essere mostrate e
vengono rilette al passaggio successivo. Sono tenute per profilo: la chiamata è
fatta come il profilo a cui il repository è [associato](profiles.md), e un altro
profilo può vedere altri elementi.

Quanto costa:

- **GitHub** ne legge fino a **50** in una richiesta, tramite la sua API GraphQL —
  quella su cui sei e le più vicine. Quando GraphQL fallisce per un motivo diverso da
  un limite di frequenza (un Enterprise Server vecchio, un token che rifiuta), l’app
  ripiega sull’API REST, che legge una issue per richiesta: allora vengono chieste solo
  le prime **10**, una dopo l’altra come GitHub chiede alle app; le altre restano
  sconosciute, e un passaggio successivo le chiederà.
- **Forgejo** non sa leggere più issue in una richiesta, quindi ogni scheda ne costa
  una: un passaggio ne chiede al massimo **10**, due alla volta.
- Su GitHub e Forgejo, la prima risposta che dice *rallenta* (un 429, un 403, l’errore
  di limite proprio di GraphQL, un limite secondario o una risposta che ha consumato
  l’ultima richiesta del limite) ferma il resto — GitHub allora non ripiega su REST — e
  quei riferimenti non vengono richiesti di nuovo per cinque minuti.
- **Azure DevOps** legge fino a 200 work item in una richiesta, e GitLab una
  richiesta per tipo, quindi lì parte tutta la pagina in una volta.

Cosa non fa:

- **Bitbucket** non ha scheda: l’app lì non legge issue, e il link apre il browser
  come prima.
- **Non trovato, o senza accesso.** Una issue eliminata, un work item in un progetto
  che questo account non può vedere, o un token Azure senza lo scope *Work Items
  (Read)* appaiono allo stesso modo: la scheda lo dice, e il link funziona comunque.
  Un host che limita le richieste, non raggiungibile o senza account in questo
  profilo ha un messaggio suo.
- **`AB#123` fuori da Azure DevOps** — in un repository GitHub collegato ad Azure
  Boards — non è un link, quindi non ha scheda: l’app non sa a quale organizzazione
  appartenga.
- **Lo stato unita sui GitHub Enterprise Server più vecchi** che non inviano quando
  una pull request è stata unita: appare chiusa.
- Le righe dei commit **del grafo** non mostrano schede.

## Limiti

- **Le pull request aperte sono la lista della barra laterale.** GitHub, GitLab e
  bitbucket.org leggono le prime 30; un repository con più pull request mostra
  solo quelle, e il conteggio di Aperte indica **30+**. Azure DevOps, Bitbucket
  Data Center e Forgejo le leggono tutte.
- **Unite e chiuse sono limitate**, e la scheda mostra **+** quando l’host ne ha
  di più (il suo sito le elenca tutte):

  | Host | Cosa viene letto |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | Le 100 aggiornate più di recente, unite e chiuse **insieme** |
  | GitLab | Le 100 aggiornate più di recente di ciascuna |
  | Bitbucket Data Center | 100 di ciascuna nell’ordine *newest* del server — la sua API non dice se si intende apertura o aggiornamento |
  | Azure DevOps | 100 di ciascuna tra quelle concluse nell’**ultimo anno**; la sua API non indica un ordine, quindi oltre il centinaio quali entrano lo sceglie il server |

  I loro controlli non vengono letti — la CI di una pull request conclusa non
  decide nulla, e costerebbe una richiesta per riga — quindi **CI fallita** non si
  applica a quelle schede (il suo chip lì è nascosto).
- **Nessun account**: senza un token che raggiunga l’host, Unite e Chiuse lo
  dicono invece di mostrare una lista vuota (GitHub può comunque leggere un
  repository pubblico).
- **Controlli**: GitHub e Bitbucket Data Center li includono nella lista. A
  GitLab, Azure DevOps e Forgejo vengono chiesti una volta per head all’apertura
  della pagina, attraverso la stessa cache dei badge CI del grafo. bitbucket.org
  non ne ha.
- **Revisori**: GitHub, GitLab, Forgejo, Bitbucket Data Center e Azure DevOps
  indicano chi è ancora richiesto (Azure: una persona che non ha votato; un team
  resta escluso). La lista di bitbucket.org non lo dice, quindi lì il filtro
  Revisore è vuoto.
- **La ricerca nella descrizione** funziona dove la lista dell’host include la
  descrizione; bitbucket.org può ometterla, e allora si cercano solo titoli,
  branch e numeri.
- **«Io» su bitbucket.org e Azure DevOps** viene confrontato per nome visualizzato,
  perché è così che le loro liste indicano un autore.
- **Aggiornata su Azure DevOps** è quando la pull request è stata aperta (o
  chiusa): la sua lista non ha un orario di ultima attività.
- Lo scorrimento viene ricordato finché l’app è in esecuzione; dopo un riavvio,
  una pull request aperta dalla lista scorre invece le pull request aperte.
- **Leggere i file può fare un fetch — una volta.** Quando i commit della pull request
  non sono in questo clone, la pagina li scarica tramite id dal suo remote all’apertura,
  e di nuovo con **Aggiorna** — mai dopo un commento, una revisione o un merge, e al
  massimo una volta per versione della pull request e sessione (un tentativo fallito
  aspetta Aggiorna). Scrive solo oggetti: nessun branch, e non `FETCH_HEAD`, quindi il
  «scaricato … fa» della barra degli strumenti non si muove. Si arrende dopo 20
  secondi, o quando il trasferimento striscia sotto 1 KB/s per 15, e non chiede mai una
  password: il prompt di git è disattivato e a Git Credential Manager viene detto di non
  aprire la sua finestra di accesso, quindi un remote che ne avrebbe bisogno ripiega
  sull’API. Un remote ssh usa le tue impostazioni ssh così come sono. Un clone shallow o
  parziale a cui mancano gli oggetti ripiega sull’API dell’host.
- **Oltre i tetti**, un file viene elencato con i suoi conteggi e senza diff: 20.000
  righe cambiate o 8 MB di diff letti dal clone, 4 MB per versione letta da Azure
  DevOps. Una lettura conserva circa 150.000 righe o 48 MB di diff; i file successivi
  sono **non ancora caricati** e vengono letti all’apertura.
- **I file UTF-16** che git chiama binari vengono riletti come testo, fino a 50 per
  pull request e 2 MB per versione; oltre appaiono come binari.
- **Le rinomine** vengono rilevate come le rileva `git diff -M` (50% di somiglianza
  per impostazione predefinita), il che può differire un po’ dall’abbinamento dell’host
  stesso.
- **Azure DevOps tramite l’API** legge i suoi primi cento file entro un minuto in
  tutto; i file rimasti allo scadere del minuto sono **non ancora caricati**. Una
  risposta limitata mette in pausa ogni lettura fino al Retry-After del server. Una pull
  request con più di 20.000 modifiche viene elencata fino a lì, e la scheda lo dice.
