---
title: Esploratore di oggetti
category: Repository e cronologia
order: 16
summary: Percorri lo strato sotto il grafo — commit, tree, blob, tag e i ref che li puntano. Qui niente cambia niente.
keywords: oggetti objects esploratore blob tree commit tag ref plumbing cat-file ls-tree sha1 interni database rev-parse HEAD^{tree} loose packed
---

# Esploratore di oggetti

Git ha la fama di essere complicato. Quasi tutta questa fama nasce dal non vedere
mai il modello: **quattro tipi di oggetto, e puntatori**. Una volta che riesci a
cliccare un commit, atterrare sul suo tree e scoprire che il tuo file *è* un blob
a cui un tree ha dato un nome, la porcellana smette di essere magia.

`⌘K` → **Esploratore di oggetti**. Niente in questa pagina può cambiare un byte —
ogni chiamata dietro di essa è una lettura.

![Il commit a cui punta main: il percorso dal branch, a cosa punta e dove sta un commit nel modello](../../screenshots/objects.webp)

## I quattro oggetti

| Oggetto | È | Sa |
|--------|----|-------|
| **blob** | Il *contenuto* di un file | Niente. Non il suo nome, non il suo percorso, non la sua storia |
| **tree** | L'elenco di una directory | Nomi, modi, e lo sha di ogni blob o tree figlio |
| **commit** | Una singola istantanea | Il suo tree, i suoi genitori, autore, committer, messaggio |
| **tag** | Un tag annotato | L'oggetto che punta, chi l'ha creato, un messaggio |

La sorpresa, per quasi tutti, è la prima riga. **Un blob non ha nome.** Due file
con contenuto identico ovunque nella tua storia sono lo stesso blob, memorizzato
una volta sola. Il nome vive nel tree che lo punta — ed è per questo che git
traccia contenuti e non file, e per questo che le rinomine vengono rilevate
invece che registrate.

Un **ref** — `refs/heads/main`, `refs/tags/v1.0`, `HEAD` — è solo un file che
contiene uno sha. È tutto qui il "creare branch costa niente".

## Camminare

![Dal commit fino a src/: prima le cartelle, ogni modalità spiegata](../../screenshots/objects-tree.webp)

La colonna di sinistra elenca ogni ref, raggruppati come li raggruppa git: HEAD
(con `→ main` quando è su un branch), Branch, Tag e Remoti, ciascuno con il suo
conteggio. Remoti parte chiuso. Il segno quadrato è un ref a un commit; quello
tondo verde, un tag **annotato**. Il filtro restringe tutti i gruppi insieme.
Fai clic su un ref per arrivare all’oggetto che nomina; quella riga resta
evidenziata mentre cammini da lì.

Da lì in poi tutto è una porta:

- Un **commit** mostra a cosa **punta** — il suo albero radice, con quante voci
  contiene, e ogni genitore, con il suo oggetto — poi autore e committer (*lo
  stesso dell’autore* quando coincidono) e il messaggio.
- Un **albero** è una tabella di nome, modalità, oggetto e dimensione, prima le
  cartelle. Ogni modalità è scritta per esteso: *file*, *eseguibile*, *cartella*,
  *link simbolico*, *sottomodulo*. Una cartella dice quante voci contiene; un
  link, dove punta.
- Un **blob** mostra il testo con i numeri di riga (solo l’inizio, se è grande),
  o dice chiaramente che è binario. Raggiunto tramite un albero, una barra dice
  come si chiama lì — *Chiamato src/app.ts nel commit 07c6f3d, modalità 100644
  (file normale)* — con un link alla cronologia del file.
- Un **tag annotato** punta all’oggetto che nomina e registra chi l’ha creato.

![Un blob, il nome che gli ha dato il suo albero e dove sta nel modello](../../screenshots/objects-blob.webp)

### Il percorso

La fascia sotto la casella della revisione è il **percorso** fatto:
`branch main → commit 07c6f3d → radice → src/ → app.ts`. L’albero di un commit è
la **radice**; un file o una cartella prende il nome della riga cliccata. Fai
clic su un elemento qualsiasi per tornarci. Scrivere una revisione, scegliere un
ref o uno degli esempi accanto ad **Apri** inizia un nuovo percorso.

**Indietro** e **Avanti** scorrono tutto ciò che hai aperto, come in un browser:
dopo essere tornato indietro, Avanti riporta avanti, finché non apri qualcosa di
nuovo da lì. La casella della revisione segue il cammino, quindi `main:src/app.ts`
è sempre lì da copiare.

### Colori

Ogni tipo mantiene un colore ovunque compaia — badge, elemento del percorso,
scheda, riga: commit nel colore d’accento del tema, albero nel suo giallo, blob
in blu, tag e ref in verde. Sotto l’intestazione dell’oggetto, una frase dice
cosa *è* quel tipo.

### Dove sei nel modello

La fascia in fondo al pannello è la catena di git — **ref → commit → tree →
blob**, con **tag** tra ref e commit su un tag annotato — e il tipo mostrato è
evidenziato come *sei qui*.

## Scrivere una revisione

La casella accetta tutto ciò che accetta `git rev-parse`, ed è qui che questa
smette di essere una vista e diventa un modo per imparare:

| Scrivi questo | Per ottenere |
|-----------|--------|
| `HEAD` | Il commit corrente |
| `HEAD~3` | Tre commit indietro |
| `HEAD^{tree}` | Il tree di quel commit, sbucciato |
| `HEAD:src/app.ts` | Il blob di quel percorso, direttamente |
| `v1.0^{}` | Ciò che un tag annotato punta, invece dell'oggetto tag |
| `a1b2c3d` | Qualsiasi oggetto, per sha — le abbreviazioni funzionano |

Vale la pena conoscere le cifre dei modi in un elenco di tree: `100644` un file,
`100755` eseguibile, `040000` un sottoalbero, `120000` un link simbolico,
`160000` un gitlink di sottomodulo — e quest'ultimo è tutto ciò che un
sottomodulo memorizza.

## Limiti da conoscere

- **In sola lettura, apposta.** Qui non c'è niente con cui scrivere. Costruire
  oggetti a mano è un esercizio di `git hash-object`, e appartiene a un
  terminale.
- **I blob grandi vengono troncati** dopo i primi 200 KB — abbastanza per vedere
  di cosa si tratta, non abbastanza da bloccare la finestra.
- **Le dimensioni sono quelle del contenuto dell'oggetto** come le riporta
  `git cat-file -s`, non quello che costa su disco dopo l'impacchettamento. Per
  quello, vedi [manutenzione](maintenance.md).
- **Gli oggetti irraggiungibili restano oggetti.** Incolla uno sha da un report
  di oggetti penzolanti di `git fsck` e si apre, che spesso è il modo più rapido
  per vedere cosa conteneva un commit perduto prima di decidere se recuperarlo.
- **Una riga di sottomodulo non si apre.** Il suo gitlink nomina un commit di un
  altro repository, che questo non ha.
- **Conteggi e destinazioni dei link hanno un tetto.** Un albero con più di 300
  sottocartelle le elenca senza conteggio, e solo i primi 50 link simbolici
  mostrano la destinazione.
- **Il percorso finisce con la finestra.** Chiudila e la prossima riparte dal
  branch di HEAD.

Vedi anche: [Il grafo](graph.md) · [Manutenzione del repository](maintenance.md) ·
[Recupero](recovery.md)
