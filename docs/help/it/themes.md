---
title: Temi e aspetto
category: Personalizzazione
order: 100
summary: Temi integrati, chiari e scuri, più quelli personalizzati e quelli generati dall'AI, e icone colorate.
keywords: tema temi theme scuro chiaro aspetto colori dimensione del carattere grafo palette cercare impostazioni trovare search settings icona icone colori delle icone tinta monocromatico icon icons icon colors tint monochrome
---

# Temi e aspetto

Temi integrati — Gitcito, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast e Daltonic — ciascuno con una variante chiara e una scura.

![Il passaggio dal chiaro allo scuro](../../screenshots/clip-themes.webp)

- **Chiaro, scuro o segui il sistema operativo**, con cambio dal vivo.
- **Temi personalizzati**, e temi **generati dall'AI** a partire da un prompt.
- **Dimensione del carattere del codice** regolabile.
- **Colori delle icone** per la barra degli strumenti e le sezioni della barra
  laterale — vedi sotto.
- Uno **stile del grafo** a parte: palette delle corsie, stile degli angoli,
  densità delle righe e spessore delle linee, con un mini-grafo di anteprima dal
  vivo.

![Le impostazioni dei temi](../../screenshots/settings-themes.webp)

## Colori delle icone

Una fila di icone grigie rende simili Fetch, Push e Stash finché non se ne leggono
le etichette. **Colori delle icone**, sotto Aspetto nella scheda Tema, colora ogni
icona in base a ciò che fa, così l'occhio trova l'azione prima della parola:

| Ruolo | Icone | Colore del tema che prende |
|---|---|---|
| Ricevere | Fetch, Pull, Remoti, Worktree | lo slot ciano del tema |
| Inviare, concludere | Push, Attività, Issue, Release | verde |
| Ref | Branch, Locali, Tag, Pull request, Milestone, Sottomoduli | l'accento |
| Mettere da parte | Stash, Pop, Stash, Segnalibri, Fissati | lo slot arancione del tema |

Annulla, Ripeti, Strumenti e Impostazioni restano grigi: sono utilità, e lasciarli
neutri è ciò che fa risaltare quelli colorati.

Gli elenchi che raggruppano molte voci colorano un intero gruppo in una volta,
così un gruppo si legge come una famiglia:

- **Menu Strumenti** — il viaggio nel tempo (Reflog, Istantanee WIP, Macchina del
  tempo, Bisect) in arancione; gli strumenti dei branch (Absorb, i radar, la CI
  locale, i confronti) nell'accento; e un colore per gruppo: Ispeziona ciano,
  Branch e cronologia l'accento, File e patch verde, Repository arancione,
  Segreti e condivisione rosso.
- **Pagine delle Impostazioni** — Disposizione, Spazi di lavoro e IA nell'accento;
  Profilo e Ambiente verde; Integrazioni e Dati ciano; Temi arancione; Sicurezza
  rosso. Generali e Scorciatoie restano grigie.

| Opzione | Cosa vedi |
|---|---|
| **Monocromatico** | Tutte le icone grigie, come prima che esistesse questa opzione |
| **Tinta tenue** (predefinita) | Il colore mescolato al grigio; il colore pieno al passaggio del mouse |
| **Colore pieno** | Il colore stesso, su una piccola pastiglia della stessa tinta |

I colori vengono dal tema: un tema che ridipinge il suo verde o il suo accento
ridipinge con esso le icone, compresi i temi personalizzati e quelli generati
dall'AI.

Limiti: sono colorati solo i pulsanti principali della barra degli strumenti, le
intestazioni delle sezioni della barra laterale, il menu Strumenti e le pagine
delle Impostazioni; gli altri menu, le righe dentro una sezione e il grafo dei
commit no. Una riga di menu sotto il mouse mantiene il suo aspetto abituale,
icona compresa. Il colore non è mai l'unico indizio: ogni icona mantiene la sua
etichetta.

## Trovare un'impostazione

Le Impostazioni sono divise in molte pagine, e l'opzione che cerchi raramente sta dove
te la aspetti: sai che esiste, non in quale pagina. Il campo di ricerca
nell'intestazione delle Impostazioni, accanto al pulsante di chiusura, cerca in
tutte le pagine insieme.

![Ricerca di «terminal» nelle impostazioni](../../screenshots/settings-search.webp)

Mentre scrivi, la parte destra elenca le impostazioni corrispondenti,
raggruppate per pagina — ognuna con il nome, la descrizione di una riga e la
pagina in cui si trova. La barra laterale attenua le pagine senza risultati e
mostra un conteggio su quelle che ne hanno.

- Confronta il nome dell'impostazione, la descrizione e il nome della pagina.
  Maiuscole e accenti non contano, e ogni parola digitata deve comparire, quindi
  "font terminale" restringe alle impostazioni del font del terminale.
- Cerca nella lingua dell'interfaccia e in inglese allo stesso tempo: con l'app
  in italiano, digitare "token" o "font" trova comunque l'impostazione.
- Fai clic su un risultato, o premi **Invio** per il primo, per aprire la sua
  pagina (e la scheda giusta in Temi — Tema o Grafo), scorrere fino
  all'impostazione ed evidenziarla per un momento.
- **Esc** cancella la ricerca; un secondo **Esc** chiude le Impostazioni.

Cerca nei nomi e nelle descrizioni, non nei valori che hai impostato. Gli
elenchi di server per host in Integrazioni (GitHub Enterprise Server, GitLab
self-managed, Bitbucket Data Center) aprono la pagina Integrazioni; la scheda
dell'host la scegli tu. Le singole scorciatoie da tastiera non sono indicizzate
— la ricerca trova la pagina Scorciatoie, il cui editor le elenca.

## Layout

Barra laterale a sinistra o a destra, pannelli ridimensionabili ovunque, una
barra laterale richiudibile per quando il grafo si merita tutta la finestra, e
posizionamento del terminale per repository.

**Vedi anche:** [Il grafo dei commit](graph.md) · [Profili](profiles.md)
