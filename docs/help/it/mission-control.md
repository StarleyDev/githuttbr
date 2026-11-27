---
title: Mission control
category: Sincronizzazione e più repo
order: 51
summary: Ogni repository dell'area di lavoro su una sola schermata, i peggiori per primi.
keywords: mission control cruscotto dashboard tutti i repo panoramica stato sporco non pubblicati indietro area di lavoro workspace pull request ci release tag intervallo di aggiornamento refresh interval
---

# Mission control

Venti repository, e la domanda è sempre la stessa: quale ha bisogno di me?

Mission control risponde. Ogni repository dell'**area di lavoro attiva** su una
sola schermata, ordinato in base a chi ha davvero bisogno di te:

1. **Bloccato** — un rebase o un merge lasciato a metà, conflitti, un repo che
   non si riesce proprio a leggere.
2. **Da sincronizzare** — prima i commit da recuperare, poi quelli da pubblicare.
3. **In corso** — lavoro non committato, file non tracciati.
4. **Pulito** — quelli tranquilli, in fondo, dove è giusto che stiano.

![Ogni repository su una sola schermata, i peggiori per primi](../../screenshots/mission-control.webp)

## Cosa ti dice una riga

Ogni riga si legge da sinistra a destra, e le colonne sono allineate lungo tutta
la lista, così i conteggi si confrontano come in una tabella:

| Colonna | Cosa mostra |
|---|---|
| **Repository** | Nome, gruppo, il branch e il suo upstream — oppure **senza upstream** in ambra: un branch così non viene mai pushato per sbaglio, ma non si sincronizza nemmeno |
| **Ultimo commit** | Oggetto e autore: cosa stava facendo il repository, senza aprirlo |
| **Locale** | Conflitti · ↓ da scaricare · ↑ da pushare · in stage · modificati · non tracciati · stash. Passa il mouse per sapere cosa conta ognuno |
| **Hosting** | Le pull request aperte, con quelle in attesa della **tua** revisione in ambra, e la CI di HEAD. Clicca il numero per aprire la pagina **Pull request** di quel repository, o **CI** per aprirne le esecuzioni |
| **Release** | Il tag più recente raggiunto da HEAD, e quanti commit sono venuti dopo — **aggiornato** se nessuno. Il numero è colorato in base a quanto è indietro una release: grigio fino a 5 commit, giallo fino a 20, rosso oltre, in quattro fasce che puoi cambiare — colori personalizzati compresi — in [**Impostazioni → Temi → Colori della nota di release**](themes.md#colori-della-nota-di-release) |
| **Attività** | Uno sparkline dei commit di 14 giorni, e quanti sono |
| **Tempo** | Da quanto c’è stato l’ultimo commit, e l’ultimo **fetch** |

Passa il mouse sull’icona di stato per vedere perché la riga è lì —
"2 da pushare · 1 senza commit".

L’età del fetch c’è perché leggere questa pagina non fa mai fetch: il conteggio
"da scaricare" è fresco quanto l’ultimo fetch. Quando un branch con upstream non fa
fetch da un giorno o più, o mai, l’età diventa ambra — fai fetch prima di fidarti
di uno 0. L’ora la legge git stesso, quindi conta anche un `git fetch` da terminale.

![Impostazioni → Git e sincronizzazione: l’aggiornamento di Mission Control accanto al fetch automatico](../../screenshots/settings-git-sync.webp)

In una finestra stretta tutte le colonne restano, e la tabella scorre di lato
dentro la sua cornice.

**Apri**, in fondo a una riga, mostra il repository stesso — il suo grafo — anche
quando la sua scheda mostrava per ultima la lista di pull request aperta dal
numero di PR.

Espandi una riga (con il chevron, o con <kbd>spazio</kbd>) per vedere esattamente
quali commit aspettano di essere pubblicati e quali file sono sporchi.

## Lavorare sull'elenco

- Le pillole di stato in cima sono **filtri** — clicca "3 bloccati" per vedere
  solo quelli. **N PR aperte** e **N CI in errore** filtrano allo stesso modo, e
  così anche **N PR in attesa della tua revisione** nella riga sotto.
- Ordina per **urgenza**, **nome** o **attività**.
- **Spunta più repo** per recuperarli, o fai pull solo su quelli indietro (il
  pulsante li conta per te).
- **Fetch dei N non aggiornati** compare quando alcuni branch con upstream non fanno
  fetch da un giorno o più, e fa fetch solo di quelli — quelli il cui "da scaricare" può essere sbagliato.
- Si aggiorna da solo ogni 30 secondi finché resta aperto — puoi cambiarlo in
  **Impostazioni → Git e sincronizzazione → Aggiornamento di Mission Control**,
  almeno 30 secondi. A pagina chiusa non gira nulla.

| Tasto | Azione |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> oppure <kbd>j</kbd> <kbd>k</kbd> | Scorri l'elenco |
| <kbd>Enter</kbd> | Apri quel repository |
| <kbd>f</kbd> / <kbd>p</kbd> | Fetch / pull su quel repo |
| <kbd>spazio</kbd> | Espandilo |
| <kbd>/</kbd> | Salta al filtro |

## È una vista, non una scheda

L'indicatore accanto al nome dell'area di lavoro la apre e la chiude; cliccando
una scheda qualsiasi torni al tuo lavoro. Non aggiunge mai una scheda propria, e
appartiene all'area di lavoro in cui sei — cambia area di lavoro e ottieni il
cruscotto di quell'area.

La parte git è **locale**: pochi comandi git per repository, nessun fetch. La
colonna **Hosting** è l’unica parte che parla con un host. Chiede all’host di
ogni repository le sue pull request aperte e la CI di HEAD, con il profilo di
quel repository, e in silenzio: un host senza token o collegamento per quel
profilo semplicemente non mostra nulla, e non si apre mai una finestra di
accesso. Un repository già aperto in una scheda non costa alcuna chiamata,
perché la barra laterale ha già le sue pull request.

Limiti, per leggere bene i numeri:

- Gli host vengono interpellati **al massimo ogni 5 minuti** per repository
  (prima se HEAD si sposta o un’esecuzione di CI è ancora in corso), qualunque
  sia l’intervallo di aggiornamento — la quota API di un host è condivisa con il
  resto dell’app. **Aggiorna** chiede di nuovo subito.
- Un numero mostra **30+** quando la prima pagina dell’host è tornata piena; la
  pagina della lista le ha tutte.
- La colonna release è il tag più recente **raggiungibile da HEAD**, non il tag
  più recente del repository. Un tag creato su un commit che HEAD ha già compare
  entro due minuti.

Il fetch è sempre qualcosa che hai chiesto tu.

**Vedi anche:** [Aree di lavoro e schede](workspaces.md) · [Aree di lavoro, schede e gruppi](workspaces.md)
