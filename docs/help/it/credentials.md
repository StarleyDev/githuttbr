---
title: Credential helper
category: Sicurezza
order: 73
summary: L'archivio password di git — il terzo — e perché https continua a chiedertele.
keywords: credential helper password https chiede di nuovo osxkeychain wincred manager libsecret store cache git-credentials testo in chiaro dimentica revocato token 401 verifica accesso quale account token nell’url del remote password incorporata rimuovilo dall’url token in remote url embedded password invalid username or token authentication failed set-url
source: a0a28af33433dfe90ae3dfb2e99a003c13ae5f36
---

# Credential helper

GitHuttBr ha a che fare con tre tipi diversi di segreto, e le persone danno per
scontato — non a torto — che siano una cosa sola:

| | Custodito da |
|---|---|
| Token API dell'host — PR, issue, controlli CI | GitHuttBr, nel tuo [portachiavi di sistema](security.md) |
| Trasporto `git@…` | La tua [chiave SSH](ssh-keys.md), tramite l'agente ssh di sistema |
| **Trasporto `https://`** | **Il credential helper di git** |

Il terzo non sembra una funzionalità a nessuno finché non si rompe, e allora
produce i due lamenti più comuni di git: *perché me lo chiede di nuovo?* e
*perché sta ancora mandando il token che ho revocato?*

`⌘K` → **Credential helper**.

![L'helper configurato, le regole per host e l'avviso sul file in chiaro](../../screenshots/credentials.webp)

## Cosa stai guardando

Ogni `credential.helper` configurato, nell'ambito da cui proviene — `system`,
`global`, poi questo repository. **Gli helper si impilano**: git li interroga uno
dopo l'altro, e uno a livello di repository non sostituisce quello globale.

Ognuno viene verificato contro la tua macchina:

| Contrassegno | Significa |
|------|-------|
| **pronto** | Il programma helper esiste e verrà eseguito |
| **non installato** | Configurato, ma il programma manca — ogni richiesta ricade sul digitare di nuovo la password |
| **password in un file in chiaro** | L'helper `store` (vedi sotto) |

**Regole per host specifici** elenca le sezioni `credential.<url>.*`. Battono
l'impostazione semplice per gli URL che intercettano, e di solito sono la
risposta a "perché proprio quell'host si comporta diversamente".

## Sceglierne uno

| Helper | Dove finisce la password |
|--------|------------------------|
| `osxkeychain` | Portachiavi macOS — cifrato, per utente |
| `manager` | Git Credential Manager (Windows, multipiattaforma) |
| `wincred` | Gestione credenziali di Windows |
| `libsecret` | Il servizio dei segreti su Linux (GNOME Keyring, KWallet) |
| `cache` | In memoria, per 15 minuti. Niente su disco |
| `store` | **Un file in chiaro nella tua home. Non cifrato** |

GitHuttBr propone ciò che è davvero installato su questa macchina, segna quello
adatto al tuo sistema operativo e disattiva il resto.

**L'ambito conta.** *Per ogni repository* scrive nella tua configurazione
globale, ed è quasi sempre ciò che vuoi; *solo per questo repository* è per il
repo strano che si autentica contro qualcos'altro.

## L'helper `store` e `~/.git-credentials`

`store` scrive righe `https://user:password@host` dentro `~/.git-credentials`, in
chiaro, senza cifratura di alcun tipo. Qualsiasi cosa giri con la tua utenza può
leggerlo: uno script, il postinstall di una dipendenza, qualunque cosa.

Se quel file esiste, questa pagina lo dice e conta le voci. Non le mostra mai —
il conteggio è tutto il punto, e leggerne il contenuto per mostrarlo sarebbe lo
stesso errore.

Se ne trovi uno e non era tua intenzione: scegli qui un helper vero, poi elimina
il file e autenticati di nuovo una volta.

## Dimenticare una credenziale salvata

Quando un token viene revocato o ruotato, l'helper continua a consegnare quello
vecchio e ogni push fallisce con un 401 che non nomina niente. **Dimentica**
chiede all'helper configurato di cancellare la propria voce per quell'host —
`git credential reject`, cioè la strada documentata da git stesso.

Nel farlo non si legge nulla: GitHuttBr non chiama mai `git credential fill`, il
comando che stamperebbe una password valida sullo standard output.

Il push successivo te la chiede una volta, e l'helper memorizza la nuova
risposta.

## Quale account usa un push

Ogni URL di push viene verificato separatamente. Uno scope di scrittura è solo una capacità del token. Non vengono verificati l’appartenenza al repository, le regole del branch né il permesso di modificare un determinato file. Le letture pubbliche possono riuscire senza credenziali.

![Verifica dell’accesso del remote](../../screenshots/remote-sign-in.webp)

Un push può autenticarsi in diversi modi: il token di un profilo, un accesso alla
GitHub CLI collegato a un profilo, l’helper di git stesso, una password dimenticata
nell’URL del remote o una chiave SSH. Quando viene rifiutato, prima devi sapere quale
di questi ha usato. Fai clic destro su un remote nella barra laterale e scegli
**Verifica accesso…** (o *Verifica accesso dei remoti* nella tavolozza dei comandi).
La verifica risolve la credenziale come farebbe un push, poi la chiede all’host:

| Mostra | Da dove viene |
|----------|--------------------|
| La fonte, e il [profilo](profiles.md) dietro | La stessa precedenza che applica un push — il profilo associato al repository, altrimenti quello attivo, altrimenti l’helper di git |
| L’account | La risposta dell’host stesso (`/user`), non ciò che è stato digitato nelle Impostazioni |
| Gli scope | L’intestazione `X-OAuth-Scopes` di GitHub; la descrizione che GitLab dà del proprio token |
| Cosa permettono | Gli scope di scrittura del token (`repo` su GitHub, `write_repository` su GitLab), e su GitHub se `.github/workflows` può cambiare |

Segnala anche una credenziale che l’host rifiuta (scaduta o revocata), un account
collegato che non ha più l’accesso, e una password salvata in chiaro nell’URL del
remote.

**Limiti.** Un token GitHub a grana fine non elenca i suoi permessi, quindi se può
fare push appare come sconosciuto finché un push non ci prova. Forgejo riporta
l’account ma non i permessi del token. Azure DevOps e Bitbucket sono mostrati solo con
fonte e profilo. I remote SSH non sono verificati, ma [Chiavi SSH](ssh-keys.md) elenca
ciò che tiene l’agente. La verifica interroga l’helper di git in silenzio: un helper
che avrebbe bisogno di una finestra di accesso conta come vuoto.

## Una password salvata nell’URL del remote

Un vecchio clone, o un URL incollato da una wiki, può portare la credenziale dentro
l’indirizzo: `https://user:token@git.example.test/team/app.git`. **Una password
nell’URL ha sempre la precedenza:** git la invia e non chiede a nessun helper — né al
token del [profilo](profiles.md) del repository, né alla GitHub CLI, né all’archivio di
git. Finché il token funziona, va bene, e GitHuttBr lo lascia stare: **non rimuove mai
una password da un URL senza chiedertelo.** Appena il token viene revocato o scade,
ogni fetch, pull e push di quel repository fallisce con *Invalid username or token* o
*Authentication failed*, mentre gli altri repository dello stesso profilo funzionano.
E il token sta in chiaro nel `.git/config` del repository.

![Rimuovere un token salvato dall’URL di un remote](../../screenshots/remote-url-token.webp)

GitHuttBr legge gli URL di fetch e di push di ogni remote e lo segnala in tre punti:

| Dove | Cosa vedi |
|-------|--------------|
| Un fetch, pull o push fallito | L’errore spiega che l’URL del remote contiene una password salvata, con **Rimuovilo dall’URL…** |
| La barra laterale | Una discreta icona a chiave nella riga del remote: il suo URL contiene una password che ha la precedenza sul token del profilo. La stessa azione è nel suo menu contestuale |
| **Verifica accesso…** | Il remote mostra la password come fonte, con lo stesso pulsante |

L’azione chiede prima. Toglie la password da ogni URL di quel remote — l’URL di fetch e
ogni URL di push che ne contiene una — e non scrive altro che `.git/config`. Cosa
succede dopo dipende da cos’altro può autenticarsi:

| Dopo la rimozione | Cosa usano fetch e push |
|---------------|-------------------------|
| Il profilo del repository ha un token o un account collegato per quell’host | Quel token — la conferma non dice altro |
| Nessun token di profilo, ma l’helper di git ha un accesso per l’host | L’accesso dell’helper |
| Nessuno dei due | Niente: fetch e push falliscono finché non aggiungi un token. La conferma lo dice prima e offre **Aggiungi prima un token**, che apre Impostazioni → Account collegati |

Quando è partita da un’operazione fallita, offre **Riprova**.

**Non c’è annullamento, di proposito.** Annullare riscriverebbe il segreto nel file in
chiaro, che è proprio ciò che l’azione esiste per evitare. Se il vecchio token potesse
ancora funzionare, revocalo sul server: è stato leggibile da qualsiasi cosa potesse
leggere la cartella del repository.

**Limiti.**

- Se ne va anche il nome utente (`https://git.example.test/…`), come quando esegui
  `git remote set-url` a mano; la conferma lo dice. Un server che ne ha bisogno
  nell’URL — un token Bitbucket Data Center senza nome utente nel profilo — richiede di
  rimetterlo con **Modifica il remote…**.
- Un nome utente da solo (`https://user@host/…`) non viene segnalato: git chiede
  ancora all’helper la password di quell’utente, quindi non c’è nulla di segreto
  salvato.
- Gli URL SSH non vengono toccati: `git@host:…` e `ssh://git@host/…` indicano il login
  che usa ssh, non una credenziale.
- Il prefisso di un helper remoto (`persistent-https::https://…`, `gcrypt::…`) viene
  mantenuto; l’URL che segue viene letto e ripulito come qualsiasi altro.
- **Gli URL ambigui non vengono proposti per la rimozione.** Quando i lettori non sono
  d’accordo su dove inizi l’host — una `@` dopo un `?` o un `#` nell’indirizzo, o una
  password con una `/` non codificata —, tagliare alla `@` sbagliata farebbe puntare il
  remote a un altro server. Un URL così viene mostrato solo oscurato, e l’icona a chiave
  apre **Modifica il remote…** perché tu lo corregga a mano.
- Viene letto e modificato solo `.git/config`. Un URL riscritto da una regola
  `url.<base>.insteadOf`, o un remote definito nella tua configurazione globale, non
  viene ispezionato — e rinominare un remote non copia mai nella configurazione del
  repository una password che una regola `insteadOf` aggiunge.
- La password non esce mai dal processo principale: gli URL dei remote arrivano alla
  finestra, al menu di copia dell’URL e alla finestra di modifica senza di essa.
  Salvare la finestra di modifica con l’URL che mostrava non cambia nulla e mantiene la
  password; **cambiare l’host o il percorso la elimina**, perché l’URL digitato viene
  scritto così com’è. Solo questa azione rimuove una password mantenendo l’indirizzo.

## Limiti da conoscere

- **Questo è l'archivio di git, non quello di GitHuttBr.** Cambiarlo cambia anche
  quello che fa il tuo terminale — che è esattamente il punto, e vale la pena
  saperlo prima di cambiarlo.
- **Gli helper a livello di sistema sono mostrati, non modificabili.** Vivono in
  una configurazione che solo un amministratore può scrivere.
- **GitHuttBr non può elencare cosa contiene un helper.** Nessuna API delle
  credenziali lo espone senza consegnare i segreti, quindi la finestra riporta la
  configurazione e cancella su richiesta, e nient'altro.
- **Un token dato a GitHuttBr è un'altra cosa.** Revocarne uno non tocca l'altro;
  per il lato portachiavi vedi [sicurezza](security.md).
- **Il token di un profilo resta fuori dall’ambiente degli hook del repository.** Un
  hook vede solo un codice per un endpoint privato, valido mentre gira quel comando
  git — abbastanza per un hook che chiede apposta, come fa git-lfs. Vedi
  [il token di un profilo mentre git è in esecuzione](security.md#il-token-di-un-profilo-mentre-git-è-in-esecuzione).

Vedi anche: [Sicurezza](security.md) · [Chiavi SSH](ssh-keys.md) ·
[Sincronizzare](syncing.md)
