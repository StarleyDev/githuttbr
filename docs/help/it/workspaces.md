---
title: Aree di lavoro, schede e gruppi
category: Per iniziare
order: 3
summary: Tanti repository senza affogare: schede, gruppi, cartelle e aree di lavoro.
keywords: area di lavoro workspace schede tabs gruppi cartelle più repo organizza cambia layout vai al repository selettore dimensione delle schede go to repository switcher tab sizing
source: 586a4f8276c9ee0949d40b012b298df48e7b696f
---

# Aree di lavoro, schede e gruppi

Tre livelli, dal più lasco al più stretto.

## Schede

Un repository, una scheda. Usa <kbd>⌘T</kbd> / <kbd>Ctrl+T</kbd> per aprire il
selettore della nuova scheda e <kbd>⌘W</kbd> / <kbd>Ctrl+W</kbd> per chiudere
quella attiva. Puoi anche trascinarle per riordinarle, chiuderle con il clic
centrale, o premere <kbd>⌘⇧T</kbd> per riaprire l'ultima che hai chiuso. Clic
destro su una scheda di repository (o su una pillola dentro un
[gruppo](#gruppi)) per il [menu contestuale del repository](repo-menu.md) —
alias, worktree, GitHub, terminale, mostra, editor e, in fondo, **Chiudi questo
repository** e **Chiudi le altre** (una pillola in un gruppo offre invece la
rimozione). Chiudi
l'ultima scheda e <kbd>⌘W</kbd> chiude invece la finestra. Un punto sulla scheda
significa lavoro non committato; uno diverso significa conflitti.

Se compare un avviso di chiusura, <kbd>Escape</kbd> annulla sempre.
<kbd>Enter</kbd> conferma solo quando la scheda è pulita — quando ci sono
modifiche non committate o conflitti, l'avviso ti costringe deliberatamente a
cercare il pulsante, così una pressione di tasto a vuoto dopo <kbd>⌘W</kbd> non
può chiudere lavoro che avevi ancora fra le mani.

### Dimensione delle schede

Per impostazione predefinita (**Impostazioni → Disposizione → Dimensione delle
schede → Adatta**) le schede si comportano come quelle di un browser: quando la
striscia resta senza spazio si restringono in modo uguale fino a una larghezza
minima, e scorrono solo quando anche quel minimo è raggiunto. **Fissa** riporta il
comportamento classico — ogni scheda mantiene la larghezza del suo contenuto e la
striscia scorre appena non ci stanno tutte.

### Andare a un repository

Con dieci o più repository aperti, trovarne uno nella striscia vuol dire
scorrere, <kbd>⌘1</kbd>–<kbd>⌘9</kbd> si fermano alla nona scheda, e la [tavolozza
dei comandi](search.md) mescola i repository aperti a tutte le azioni. Premi
<kbd>⌘J</kbd> / <kbd>Ctrl+J</kbd> (o **Vista → Vai al repository…**) e scrivi
qualche lettera del nome, della cartella o del branch, poi <kbd>Invio</kbd>.

![Il selettore dei repository, i più usati di recente per primi](../../screenshots/repo-switcher.webp)

L’elenco contiene solo i repository aperti, compresi quelli nei gruppi, nell’ordine
in cui li hai guardati l’ultima volta. Quello che hai appena lasciato è in cima,
quindi <kbd>⌘J</kbd> <kbd>Invio</kbd> ti riporta lì. Ogni riga porta ciò che mostra
la sua scheda: il branch, il punto di lavoro non committato o di conflitto, il
gruppo in cui sta e il suo tasto <kbd>⌘1</kbd>–<kbd>⌘9</kbd> quando ce l’ha. Il
repository sullo schermo è in fondo, attenuato. Dietro il selettore non si scurisce
nulla; un clic fuori o <kbd>Esc</kbd> lo chiude.

Quando nulla di aperto corrisponde, l’ultima riga, **Cerca in tutti i
repository**, porta la ricerca alla pagina [Repository](repositories.md). La
scorciatoia si può riassegnare in **Impostazioni → Scorciatoie**.

*Limiti:* l’ordine è ricordato solo per questa sessione, quindi dopo un riavvio
parte dall’ordine delle schede. Un repository aperto in due schede compare una volta
sola, alla sua prima scheda. I repository di altri [workspace](#aree-di-lavoro) non sono
elencati — cambia prima workspace, o usa la pagina Repository.

## Gruppi

Raccogli repository affini in una **scheda di gruppo** con un nome e un colore.
Dentro un gruppo ottieni una seconda riga con una pillola per repository, e il
gruppo stesso può fare **Fetch su tutti** o **Pull su tutti** in un colpo solo.

Per iniziarne uno, clic destro su una scheda di repository → *Nuovo gruppo…*: la
scheda diventa un gruppo con quel repository, nello stesso posto. Una volta che un
gruppo esiste, lo stesso menu dice *Aggiungi a un gruppo →*, con i gruppi aperti.
Trascinare una scheda di repository su una pillola di gruppo fa lo stesso.

*Nuovo gruppo…* chiede insieme un nome e un colore. Il colore parte da uno che
nessun gruppo aperto porta ancora, scelto a caso, così i gruppi non cominciano tutti
uguali.

![La finestra Nuovo gruppo, con nome e colore scelti insieme](../../screenshots/new-group-dialog.webp)

Per ricolorare un gruppo, clic destro su di esso: i dieci colori sono nel menu come
una fila di pallini, con un anello intorno a quello attuale, e un clic lo applica.
*Colore personalizzato…* sotto la fila apre un selettore per qualsiasi altro colore.
Le cartelle e le sezioni della pagina Repository usano la stessa fila.

![Il menu contestuale di un gruppo: la fila dei colori, Colore personalizzato…, Separa gruppo e Chiudi il gruppo](../../screenshots/group-color-menu.webp)

Per sciogliere un gruppo, clic destro su di esso → **Separa gruppo**. Ogni
repository diventa una scheda normale dove stava il gruppo, mantenendo le pagine che
aveva aperte. **Chiudi il gruppo** chiude invece il gruppo e tutti i suoi repository.
Le cartelle non sopravvivono a una separazione: esistono solo dentro un gruppo.

![Una scheda di gruppo con diversi repository](../../screenshots/repo-groups.webp)

I gruppi possono contenere **cartelle, annidate a qualsiasi profondità**: clic
destro sul gruppo → *Nuova cartella…*, poi trascina i repository su una pillola
di cartella. Ogni cartella prende un colore, si richiude in una pillola con il
conteggio, riassume i punti di stato di tutto ciò che contiene, e può fare fetch
o pull sull'intero sottoalbero.

![Le cartelle nella striscia di schede del gruppo, ciascuna una pillola con il conteggio — Internal annidata dentro Services](../../screenshots/nested-folders.webp)

> Le cartelle servono solo a organizzare. Eliminarne una solleva i suoi
> repository al livello superiore — non chiude mai un repository.

Per aggiungere un repository che il gruppo non contiene ancora, fai clic sul **+** accanto al nome del gruppo. Mostra la pagina del gruppo — aprire una cartella, clonare, creare o scegliere un repository recente — anche quando uno dei suoi repository è aperto; un clic su un chip ti riporta lì.

## Le pagine che appartengono a un repository

Alcune pagine non stanno da sole: il [wiki](repo-wiki.md) di un repository, i
suoi [insight](insights.md), i [dev tool](devtools.md) che una sessione di
avvio ha annunciato. Non occupano una scheda — compaiono come piccoli chip sul
repository stesso: un’icona e una parola che dice quale pagina è (*CI*, *PR*,
*Wiki*, *#482* per una pull request, il tag di una release). Il nome completo è nel
tooltip, e un tag o un titolo lungo viene accorciato con i puntini di sospensione.

- **Clicca un’icona** per mostrare quella pagina. **Clicca di nuovo — o clicca
  il nome del repository** — per tornare al repository. Finché una pagina è
  aperta, il nome prende il cursore a mano e una pastiglia al passaggio: è la
  via del ritorno.
- **Passa sopra un’icona** per la ✕ che chiude solo quella pagina.
- Dentro un **gruppo**, le icone stanno sulla targhetta del repository a cui
  appartengono, e solo finché quel repository è quello selezionato. Scegliere
  un altro repo del gruppo mostra *quel* repository, non lo strumento del
  vicino.
- Riaprire la stessa pagina accende l’icona che c’è già, invece di aggiungerne
  una seconda.

Un repository non aperto da nessuna parte non ha un’icona da portare: una sua
pagina apre allora una scheda propria — aprire deve sempre aprire qualcosa.

## Aree di lavoro

Un'area di lavoro è un'**intera striscia di schede salvata**. Cambiarla scambia
tutte le schede in una volta: `Lavoro` e `Personale` smettono di pestarsi i
piedi.

Il nome dell'area di lavoro sta in alto a sinistra, accanto al marchio Gitcito.
Cliccalo per cambiare, creare, rinominare, riordinare o eliminare. Accanto c'è
l'indicatore che apre [Mission control](mission-control.md) per l'area di lavoro
in cui sei.

**Vedi anche:** [Mission control](mission-control.md) · [La riga di comando](cli.md)
