---
title: Pagina delle pull request
category: Sincronizzazione e più repo
order: 57
summary: Tutte le pull request di un repository in una pagina — per stato, filtrate per autore, revisore, destinazione e CI —, ‹ › per scorrere la lista filtrata da dentro una PR, e commenti su una riga del suo diff.
keywords: pull request lista pagina merge request pr mr filtro autore revisore mie in attesa della mia revisione revisione chiesta ci fallita branch di destinazione bozze unite chiuse ricerca triage precedente successiva alt freccia navigazione checkout vai al branch di origine destinazione copia nome del branch fetch commento di riga commento inline commento di revisione commento sul diff commenta riga scheda file revisione del codice line comment
source: d1deab4d48f6f6327673e61daecb55ede0889881
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
sei già — semplicemente ti portano al repository.

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

Un commento scritto e non inviato conta come testo non inviato: **‹ ›** e Alt+frecce
chiedono prima di lasciarlo, come per il riquadro del commento principale. Guardare
un altro file lo conserva; per iniziarne uno su un’altra riga, pubblica o annulla il
primo.

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
