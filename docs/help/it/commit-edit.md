---
title: Modifica qualsiasi commit
category: Branch e chirurgia
order: 46
summary: Riscrivi i file o il messaggio di un commit storico sul posto — con la cascata in anteprima prima.
keywords: modifica commit edit riscrivi rewrite storia history amend passato reword correggi refuso typo cascata cascade replay rebase sul posto chirurgia confronta con l’originale aggiungi file cosa succederà modifiche non applicate compare with original add file what will happen unapplied changes
source: 2860ac7978e6b9b1b8a469abadf313971d0140c6
---

# Modifica qualsiasi commit

Il refuso sta in un commit di tre settimane fa. La soluzione classica è un rebase
interattivo: fermarsi al commit, modificare, continuare, pregare. La soluzione di
GitHuttBr è: clic destro sul commit, **Modifica questo commit**, cambia il testo,
fatto. Il pulsante a forma di penna nel pannello dei dettagli del commit apre
lo stesso editor.

![Modifica di un commit storico](../../screenshots/commit-edit.webp)

## Cosa fa

Scegli un commit qualsiasi che sia un antenato di `HEAD` — storia lineare o no.
L'editor si apre nel pannello centrale, al posto del grafo dei commit — dove si
aprono il risolutore dei conflitti e il visualizzatore di file — e occupa tutta
la larghezza e l'altezza della finestra. **Esc** o la **×** nella sua
intestazione lo chiudono. Le tue modifiche sopravvivono al passaggio a un'altra
scheda di repository e ritorno, e chiudere con modifiche non applicate chiede
prima conferma.

L'intestazione nomina il commit — hash breve, oggetto, autore ed età — e, appena
hai cambiato qualcosa, una pillola gialla conta le **modifiche non applicate**:
una per il messaggio, una per ogni file che hai modificato.

### La scheda del messaggio

Il messaggio ha gli stessi strumenti del [compositore di commit](committing.md):
il pulsante **tipo ▾** prima del riepilogo, il riepilogo con il contatore di
lunghezza (*56/72*) e la descrizione sotto, la riga dello stile dietro la
freccia (ambito, chiave del ticket, stile del commit), il selettore di gitmoji, i
coautori, la generazione con l'IA dal diff del commit stesso e i suggerimenti
del linter. Il messaggio del commit viene diviso al caricamento — la prima riga
diventa il riepilogo, il resto la descrizione — e riunito con una riga vuota
quando riscrivi. Trasformare un vecchio `add retry` in `fix: add retry` è una
scelta dal pulsante del tipo.

Appena il messaggio differisce dall'originale, la scheda viene segnata come
**modificato**, il vecchio oggetto resta visibile sotto la descrizione come
*prima: …*, e **Torna all’originale** rimette sia il riepilogo sia la
descrizione.

### La scheda dei file

I file del commit sono elencati con la loro lettera di stato; un punto segna
ognuno di quelli che hai cambiato. Scegli un file per modificarlo com'era in quel
commit; le righe che cambi o aggiungi si colorano mentre scrivi, così la tua
modifica resta sotto gli occhi. L'interruttore sopra l'editor passa da **Modifica** a **Confronta con
l’originale**, che mostra il diff del file da ciò che contiene il commit al tuo
testo modificato — la stessa vista diff usata nel resto dell'app.

**Aggiungi file** apre un file che il commit non ha toccato, dallo snapshot del
commit stesso: digita parte del suo percorso e sceglilo. Appena lo modifichi, il
commit riscritto cambia anche quel file. Nell'elenco è segnato con un **+**.

![Confronto di un file modificato con l'originale del commit](../../screenshots/commit-edit-compare.webp)

### Cosa succederà

Il pannello accanto alle schede — sotto di esse in una finestra stretta — mostra
la catena che una riscrittura tocca: ogni commit sopra quello modificato, da
`HEAD` in giù, e in fondo il commit modificato stesso con ciò che cambia in esso.

1. **Anteprima della cascata** riapplica ogni commit sopra quello modificato
   *in memoria* (una catena di cherry-pick via `merge-tree` — nessun checkout,
   nessun working tree, nessun ref). Ogni commit della catena dice poi se **si
   riapplica senza conflitti** o ha un **conflitto** in un file indicato, così
   sai **prima che qualcosa si muova** se la modifica si propaga pulita o
   collide con un cambiamento successivo. Dopo ogni ulteriore modifica i
   verdetti si azzerano; **Anteprima di nuovo** la riesegue.
2. **Riscrivi la cronologia** lo fa per davvero: la stessa catena viene
   costruita con i comandi di plumbing, poi il branch si sposta con
   `reset --keep` — le tue modifiche non committate vengono portate con te,
   oppure il reset si interrompe e non è successo nulla. Prima viene preso uno
   [snapshot di guardia](recovery.md), e **Annulla** ripristina la vecchia
   catena.

Quando il commit è già su un remote, una nota gialla nomina il branch remoto e
dice cosa significa: il prossimo push dovrà essere forzato. Un'altra nota dice
quanti commit ricevono un hash nuovo.

Autore e date di ogni commit riapplicato sono preservati; cambiano solo gli
hash — è questo che significa riscrivere la storia.

## I merge nell'intervallo

![Modifica di un commit sotto due merge — la cascata li riapplica](../../screenshots/commit-edit-merges.webp)

Un merge tra il commit e `HEAD` non disabilita più la modifica. La cascata
riapplica un merge riportando il suo **risultato registrato** — l'albero che il
merge ha davvero committato, risoluzioni dei conflitti comprese — sul genitore
riscritto, così le risoluzioni fatte a mano sopravvivono alla riscrittura parola
per parola. Niente rerere, niente nuovo merge, niente working tree: lo stesso
plumbing in memoria del resto della cascata, e i puntatori a entrambi i genitori
sono preservati. Un branch laterale che contiene anch'esso il commit modificato
viene riscritto e ripuntato; uno che non lo contiene mantiene la sua identità
intatta. Una nota nel pannello laterale dice quanti merge contiene
l'intervallo, e i commit di merge mostrano un'icona di merge nella catena.

L'avvertenza onesta: un merge riapplicato vale quanto il suo risultato
registrato. Se la tua modifica collide con righe che il merge stesso ha risolto,
l'anteprima diventa rossa esattamente come qualsiasi altro passo in conflitto —
niente viene indovinato.

## Quando la cascata va in conflitto

Un commit successivo ha toccato le stesse righe che stai modificando. L'anteprima
marca quel commit con il file in conflitto, i commit sopra come non riapplicati,
e **Riscrivi la cronologia** resta disattivato — niente resta applicato a metà,
mai. A differenza di un rebase, l'editor non si ferma a metà strada per farti
risolvere il conflitto: o modifichi in un altro modo, o affronti il conflitto di
petto con un [rebase interattivo](rebase.md).

## Limiti

- **Il commit deve essere un antenato di `HEAD`.** Un commit su un branch
  laterale non ancora sottoposto a merge non ha alcun percorso fino al tuo
  branch attuale su cui essere riapplicato.
- I file binari e i file oltre 2 MB vengono mostrati ma non sono modificabili.
- Un commit già presente su un remote può essere modificato, ma il prossimo push
  dovrà essere un **force push** — l'editor ti avvisa prima che tu ti ci
  impegni.
- I file eliminati nel commit non si possono modificare (non c'è contenuto da
  modificare).
- **Aggiungi file** raggiunge i file che esistono già nello snapshot del
  commit; non può creare un file del tutto nuovo, eliminarne uno o toccare un
  link simbolico o un submodule.

**Vedi anche:** [Rebase interattivo](rebase.md) · [Recupero e il reflog](recovery.md) · [Absorb](absorb.md)
