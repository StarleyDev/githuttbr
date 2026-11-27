---
title: Temi e aspetto
category: Personalizzazione
order: 100
summary: Temi integrati, chiari e scuri, più quelli personalizzati e quelli generati dall'AI, e icone colorate.
keywords: tema temi theme scuro chiaro aspetto colori dimensione del carattere grafo palette cercare impostazioni trovare search settings icona icone colori delle icone tinta monocromatico icon icons icon colors tint monochrome
---

# Temi e aspetto

Temi integrati — GitHuttBr, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast e Daltonic — ciascuno con una variante chiara e una scura.

![Il passaggio dal chiaro allo scuro](../../screenshots/clip-themes.webp)

- **Chiaro, scuro o segui il sistema operativo**, con cambio dal vivo.
- **Temi personalizzati**, e temi **generati dall'AI** a partire da un prompt.
- **Dimensione del carattere del codice** regolabile.
- **Colori delle icone** per la barra degli strumenti e le sezioni della barra
  laterale — vedi sotto.
- L’**aspetto del grafo** — tavolozza delle corsie, angoli, densità delle righe e spessore, con un’anteprima dal vivo — ha una pagina sua, **Impostazioni → Grafo**: vedi [il grafo dei commit](graph.md).

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
- **Pagine delle Impostazioni** — Layout e terminale, Spazi di lavoro e AI nel colore d’accento; Profilo e identità, Analizzatori di codice e Ambiente in verde; Account collegati, Git e sincronizzazione e Dati e backup in ciano; Temi e Grafo in arancione; Sicurezza e conferme in rosso. Generali, Scorciatoie e Informazioni restano grigi.

Una fila di pulsanti con sola icona fa il contrario — ogni pulsante ha il suo colore,
così si distinguono. Nella [pagina delle pull request](pull-requests.md) i pulsanti
dell’intestazione sono: aggiorna blu, revisione IA il colore d’accento, anteprima in
locale turchese, vai al branch di origine verde e vai al branch di destinazione
arancione (apri nel browser resta grigio), e sui tuoi commenti **Modifica** prende
l’accento ed **Elimina** il rosso — lì e nella pagina della issue. Il blu e il
turchese sono miscele dei colori del tema, quindi lo seguono anch’essi.

| Opzione | Cosa vedi |
|---|---|
| **Monocromatico** | Tutte le icone grigie, come prima che esistesse questa opzione |
| **Tinta tenue** (predefinita) | Il colore mescolato al grigio; il colore pieno al passaggio del mouse |
| **Colore pieno** | Il colore stesso, su una piccola pastiglia della stessa tinta |

I colori vengono dal tema: un tema che ridipinge il suo verde o il suo accento
ridipinge con esso le icone, compresi i temi personalizzati e quelli generati
dall'AI.

Limiti: sono colorati solo i pulsanti principali della barra degli strumenti, le
intestazioni delle sezioni della barra laterale, il menu Strumenti, i menu contestuali di commit, branch e repository, le pagine delle
Impostazioni e i pulsanti delle pagine di pull request e issue; gli altri menu, le
righe dentro una sezione e il grafo dei commit no. Una riga di menu sotto il mouse
mantiene il suo aspetto abituale, icona compresa. Il colore non è mai l'unico
indizio: ogni icona mantiene la sua etichetta.

## Come sono organizzate le Impostazioni

Il menu laterale raggruppa le pagine per argomento:

| Gruppo | Pagine |
|---|---|
| **Tu** | Profilo e identità · Account collegati · AI — le prime due modificano il profilo nominato nell’intestazione ([profili](profiles.md)) |
| **Aspetto** | Temi · Grafo · Layout e terminale |
| **Comportamento** | Generali · Git e sincronizzazione · Sicurezza e conferme · Analizzatori di codice |
| **Sistema** | Spazi di lavoro · Scorciatoie · Ambiente · Dati e backup · Informazioni |

Generali tiene solo ciò che riguarda l’app nel suo insieme — Lingua, Le schede dei repository mostrano, Notifiche di sistema, Apri il changelog dopo gli aggiornamenti, Avvisa alla chiusura. Il resto è passato alla pagina a cui appartiene, e la nota della pagina porta lì:

| Opzione | Ora in |
|---|---|
| Commit caricati all’inizio, Commit per ogni “carica altri”, Carica altri commit scorrendo, Date relative, Mostra gli avatar, Usa le foto profilo di GitHub | **Grafo** — con Palette delle corsie, Angoli delle linee, Densità delle righe, Stile dei nodi, Focus del grafo, Disposizione degli stash, Spessore delle linee, che erano la scheda Grafo di Temi |
| Fetch automatico ogni (minuti), Crea sempre un commit di merge, Ricorda le risoluzioni dei conflitti, Strumenti esterni di diff e merge, Editor esterno, App predefinita per “Apri con” | **Git e sincronizzazione** |
| Chiedi conferma prima di un force push | **Sicurezza e conferme** |
| Analizzatori di codice, launch.json | **Analizzatori di codice** |
| Visualizzatore file, Anima l’avatar del profilo, Nascondi le attività completate, Raggruppa le ref per prefisso | **Layout e terminale** |

Integrazioni ora si chiama **Account collegati**, Dati è **Dati e backup**. Nulla è cambiato in ciò che fa ogni opzione, e le impostazioni salvate restano come sono. Un link che apre una pagina con il vecchio nome arriva comunque a quella giusta.

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

- Confronta il nome dell’impostazione, la sua descrizione e il nome della pagina — anche la pagina in cui stava prima che il menu fosse riorganizzato: "general fetch" trova ancora il fetch automatico in Git e sincronizzazione, e "integrations" trova Account collegati. Maiuscole e accenti sono ignorati, e ogni parola digitata deve comparire: "terminal font" si restringe alle impostazioni del font del terminale.
- Cerca nella lingua dell'interfaccia e in inglese allo stesso tempo: con l'app
  in italiano, digitare "token" o "font" trova comunque l'impostazione.
- Fai clic su un risultato, o premi **Invio** per il primo, per aprirne la pagina, scorrere fino all’impostazione ed evidenziarla per un attimo.
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

La stessa pagina, **Impostazioni → Layout e terminale**, contiene anche gli extra della barra del titolo e della barra laterale — **Anima l’avatar del profilo**, **Nascondi le attività completate**, **Raggruppa le ref per prefisso** — oltre al margine delle modifiche e alla minimappa del visualizzatore di file.

**Vedi anche:** [Il grafo dei commit](graph.md) · [Profili](profiles.md)
