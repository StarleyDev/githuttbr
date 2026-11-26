---
title: Scrivere commenti
category: Sincronizzazione e più repo
order: 57.5
summary: L’editor Markdown dietro ogni riquadro di commento — Scrivi / Anteprima, una barra di formattazione con le scorciatoie di GitHub, elenchi che continuano con Invio e completamento di @menzioni / #riferimenti.
keywords: editor markdown riquadro di commento barra degli strumenti grassetto corsivo codice link citazione titolo elenco puntato numerato elenco di attività checklist anteprima scrivi scorciatoia menzione chiocciola riferimento cancelletto numero della issue completamento automatico risposta descrizione della pull request corpo della issue markdown editor comment box toolbar mention reference autocomplete reply
source: cc7673de22ce745f04a0341c4d263219c432b693
---

# Scrivere commenti

Un commento inviato a GitHub è Markdown, e una semplice casella di testo ti lascia
scrivere a mano ogni `**` e `- [ ]`, per poi scoprire nel browser se la tabella è
venuta bene. Ogni riquadro dell’app che scrive su un host è ora lo stesso editor,
con gli strumenti che ha il riquadro di commento di GitHub stesso:

- il riquadro di commento di una pull request, le risposte nei suoi thread e i suoi
  commenti di riga ([Pagina delle pull request](pull-requests.md));
- il riquadro di commento di una issue;
- la descrizione di una nuova pull request e il corpo di una nuova issue
  ([Hosting e pull request](hosting.md)).

![Il riquadro di commento di una pull request, con la barra di formattazione e l’elenco delle persone da menzionare aperto su «@al»](../../screenshots/comment-editor.webp)

## Scrivi e Anteprima

**Anteprima** mostra il testo come verrà visualizzato, disegnato dallo stesso
renderer Markdown del resto dell’app. È di sola lettura; **Scrivi** riporta il
campo con il testo e il cursore dove li avevi lasciati, quindi ⌘/Ctrl+Z annulla
ancora ciò che avevi scritto prima di guardare.

Le schede sono un elenco di schede: con una a fuoco, ← e → passano dall’una
all’altra.

## La barra degli strumenti

| Strumento | Scorciatoia | Cosa fa |
|---|---|---|
| **Titolo** | — | Un menu con H1, H2 e H3 per le righe selezionate; scegliere il livello che una riga ha già lo toglie |
| **Grassetto** | ⌘/Ctrl+B | `**testo**` |
| **Corsivo** | ⌘/Ctrl+I | `_testo_` |
| **Codice** | ⌘/Ctrl+E | `` `codice` `` dentro una riga; un blocco delimitato da ```` ``` ```` quando la selezione copre più righe |
| **Link** | ⌘/Ctrl+K | `[testo](url)` — un URL selezionato diventa l’indirizzo, altro testo l’etichetta |
| **Citazione** | — | `> ` su ogni riga selezionata |
| **Elenco puntato** | ⌘/Ctrl+Shift+8 | `- ` su ogni riga selezionata |
| **Elenco numerato** | ⌘/Ctrl+Shift+7 | `1. `, `2. `… su ogni riga selezionata |
| **Elenco di attività** | — | `- [ ] ` su ogni riga selezionata |

Ogni strumento si attiva e disattiva: applicato a un testo che l’ha già, lo toglie.
Senza selezione, grassetto, corsivo, codice e link inseriscono un testo segnaposto
e lo selezionano, pronto da sovrascrivere. Uno strumento di elenco sostituisce un
elenco di un altro tipo invece di sovrapporsi.

Le modifiche passano per l’editing proprio del campo di testo, quindi **⌘/Ctrl+Z
annulla uno strumento** esattamente come una parola scritta, e ripeti lo riporta.

La barra è un’unica fermata per Tab; ← → si spostano tra i suoi pulsanti, e ↓ apre
il menu dei titoli. Dentro un riquadro di commento, ⌘/Ctrl+K crea un link invece di
aprire la palette dei comandi. Su Mac le scorciatoie usano solo ⌘, quindi Ctrl+B,
Ctrl+E e Ctrl+K continuano a fare ciò che ne fanno i campi di testo di macOS. Con un
layout di tastiera le cui lettere non sono latine, le scorciatoie seguono i tasti
fisici B, I, E e K.

## Elenchi

**Invio** alla fine di una voce di elenco inizia la successiva — lo stesso punto
elenco, il numero successivo, un `- [ ]` vuoto per un’attività — con lo stesso
rientro. Invio su una voce senza nulla dopo il suo marcatore chiude l’elenco e
toglie il marcatore. Maiusc+Invio è un semplice a capo.

## Menzioni e riferimenti

Scrivere **@** apre un breve elenco di persone, che si restringe mentre scrivi;
**#** elenca pull request e issue per numero e titolo (`#42`, o `#ricerca` per una
parola del titolo). ↑ ↓ scelgono, Invio o Tab inseriscono, Esc chiude l’elenco —
solo l’elenco, non il riquadro né la finestra di dialogo intorno.

L’elenco viene da ciò che l’app ha già, senza chiedere di nuovo all’host:

| Riquadro | @ propone | # propone |
|---|---|---|
| Pull request | Il suo autore, i revisori, gli assegnatari e chiunque abbia commentato | Le pull request e le issue aperte del repository, come caricate nella barra laterale |
| Issue | Il suo autore, gli assegnatari e chi ha commentato | Lo stesso |
| Nuova pull request | Le persone che leggono i suoi selettori di revisore e assegnatario, e gli autori delle pull request caricate | Lo stesso |
| Nuova issue | Gli autori delle pull request e delle issue caricate | Lo stesso |

Una **@** o un **#** dentro una parola (un indirizzo email), il `#` di un titolo e
tutto ciò che sta dentro il codice restano come sono.

## Inviare

⌘/Ctrl+Invio invia da ogni riquadro: un commento a una pull request o a una issue,
una risposta in un thread, un commento di riga e la descrizione di una nuova issue.
Funziona anche dalle schede, dalla barra e dall’anteprima, non solo dal campo. Esc
annulla un commento di riga, dagli stessi punti. Una **risposta in un thread** era
prima un campo di una riga inviato con Invio; ora è una piccola casella di testo,
quindi Invio è una nuova riga (o la voce di elenco successiva) e ⌘/Ctrl+Invio
invia. Un riquadro di risposta mostra schede e strumenti appena ci fai clic dentro,
così una conversazione lunga non si riempie di barre sotto ogni thread.

## Il promemoria

**Markdown supportato**, sotto ogni riquadro, apre un promemoria sul posto: ogni
formato, cosa scrivere per ottenerlo e la sua scorciatoia. Esc o un clic altrove lo
chiude. Nulla di ciò che stai scrivendo si sposta.

In fondo, **Apri la guida completa** apre questa pagina. Il manuale è una scheda a
sé, quindi andarci lascia la pagina in cui sta il riquadro, e il testo non inviato
andrebbe perso: quando ce n’è — in questo riquadro o in qualsiasi altro della
pagina della pull request —, l’app chiede prima. Nelle finestre di nuova pull
request e nuova issue il promemoria non ha quel link, perché il manuale si
aprirebbe dietro la finestra.

## Limiti

- **Niente allegati.** Trascinare un file o incollare un’immagine nel riquadro non
  la carica: GitHub non ha un’API pubblica per gli allegati dei commenti, quindi
  non c’è dove mettere il file. Caricalo sul sito e incolla il link.
- **Solo chi e cosa è già caricato.** @ non cerca tra gli utenti dell’host, e # non
  cerca tra tutte le issue — una persona che non ha preso parte alla conversazione,
  o una issue chiusa che la barra laterale non ha letto, non viene proposta. Puoi
  comunque scrivere per intero il nome o il numero.
- **Niente modifiche suggerite, risposte salvate o selettore di emoji.**
- **L’anteprima è il renderer dell’app.** Mostra il Markdown come lo disegna l’app;
  la resa dell’host può differire nei dettagli (estensioni proprie di GitHub,
  menzioni trasformate in link).
- **L’anteprima è il disegno dell’app, non quello dell’host.** Nelle pagine di pull
  request e di issue, l’anteprima disegna il testo come il commento pubblicato sarà
  mostrato nell’app ([come vengono mostrati i commenti](pull-requests.md#come-vengono-mostrati-i-commenti)):
  lo stesso profilo rigoroso, gli a capo mantenuti, e un’immagine di un altro sito che
  aspetta un clic. Su GitHub il commento pubblicato è poi disegnato da GitHub, quindi
  un’estensione che l’app non conosce può apparire diversa. Le finestre di nuova pull
  request e nuova issue usano l’anteprima Markdown abituale dell’app.
- Le scorciatoie sono fisse: non sono nelle impostazioni delle scorciatoie e non
  seguono una riassegnazione fatta lì.
