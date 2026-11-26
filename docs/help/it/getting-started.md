---
title: Primi passi
category: Per iniziare
order: 1
summary: Apri un repository, leggi il grafo, fai il tuo primo commit.
keywords: introduzione primi passi apri clone schede tabs grafo graph commit
source: 8effe244fab76b263f38e31ac0912d8042c428c6
---

# Primi passi

GitHuttBr apre una cartella e ti mostra la sua storia. Nel tuo repository non viene
scritto niente finché non lo chiedi tu.

![Un repository appena aperto, ancora senza commit](../../screenshots/empty-repo.webp)

## Aprire un repository

![Apri un repository: apri, clona o crea, poi i repository scansionati e i recenti](../../screenshots/open-repository.webp)

- **Trascina una cartella** sulla finestra, oppure usa **Apri un repository**
  nella schermata di benvenuto. Il selettore accetta più cartelle insieme:
  selezionale con ⌘-clic o Maiusc-clic, e ognuna si apre nella sua scheda (o
  entra nel gruppo da cui l'hai aperto). In una selezione di più cartelle, un
  repository già aperto, o una cartella che non è un repository Git, viene
  saltato e nominato in un messaggio, così le altre si aprono comunque. Il
  selettore di macOS non può ingrigire in anticipo i repository aperti:
  Electron non espone l'hook per cartella del pannello, quindi il controllo
  avviene dopo il clic su Apri.
- **Repository scansionati**, sotto i tre pulsanti, elenca tutti i repository
  nelle cartelle che hai chiesto a GitHuttBr di scansionare — spuntane diversi e
  aprili in un colpo solo, oppure fai doppio clic su uno. È anche il posto dove
  aggiungi o togli quelle cartelle. Vedi [Repository](repositories.md#repository-scansionati).
- **Hai cliccato quello sbagliato?** Clona, Crea, Crea gruppo e Repository
  scansionati, aperti da Apri un repository, hanno una freccia **Indietro**
  accanto al titolo che riporta lì.
- **Clonane** uno da un URL o direttamente dal tuo host — vedi
  [clonare](cloning.md) per le opzioni che rendono rapido il clone di un
  repository enorme.
- Da terminale, `githuttbr .` apre la cartella corrente nell'app già in esecuzione
  — vedi [la riga di comando](cli.md).
- Una singola cartella che non è ancora un repository Git si apre lo stesso, e
  ti propone di inizializzarla.

## I tre pannelli

| Pannello | Cosa contiene |
|---|---|
| Sinistra | Branch, remote, tag, stash, worktree — e la scheda **File** per l'albero di lavoro |
| Centro | Il grafo dei commit, e qualunque cosa tu vi selezioni |
| Destra | Il compositore di commit, o i dettagli del commit selezionato |

## Trovare tutto il resto

Due strade, e portano negli stessi posti:

- **`⌘K`** (`Ctrl+K`) — la tavolozza dei comandi. Scrivi quello che vuoi; salta
  anche a branch, commit e file.
- **Strumenti** nella barra degli strumenti — lo stesso insieme legato al
  repository, ma come menu, con la coda lunga raccolta in gruppi perché resti
  leggibile.

![Il menu Strumenti: prima gli strumenti frequenti, il resto raggruppato](../../screenshots/tools-menu.webp)

Quando la finestra si restringe, la barra delle azioni smette di contendersi lo spazio: i pulsanti che non entrano più si ripiegano in un menu **Altro** in fondo, nell’ordine della barra e con i loro sottomenu. Allarga la finestra e tornano fuori.

Tutto ciò che è raggiungibile da una via lo è anche dall'altra, quindi non c'è
niente che solo gli utenti esperti riescono a trovare.

## Il tuo primo commit

1. Modifica un file. Compare sotto **Non in stage**.
2. Mettilo in stage — l'intero file, un hunk, o [singole righe](staging.md).
3. Scrivi un messaggio e premi **Commit**.

Tutto il resto in GitHuttBr è opzionale.

