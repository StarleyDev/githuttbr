---
title: Primo avvio
category: Per iniziare
order: 2
summary: La procedura guidata del primo avvio — identità Git, account di hosting, AI, aspetto — e cosa salva ogni passo.
keywords: onboarding primo avvio procedura guidata configurazione benvenuto importa impostazioni identità git account ai abbonamento chiave api ollama lm studio claude code codex salta first run
source: 5b5992d94b164ac6b9b101283ec044ba376b88de
---

# Primo avvio

Al primo avvio GitHuttBr chiede, con una breve procedura guidata, le poche cose che ne cambiano il comportamento dal primo commit: chi sei in Git, dove sono ospitati i tuoi repository, se usare l’AI e che aspetto deve avere. Ogni passo può restare vuoto, e tutto ciò che imposta si cambia più tardi in **Impostazioni**.

![Il passo AI: una CLI in abbonamento trovata su questo computer e testata](../../screenshots/onboarding-ai.webp)

## La schermata di benvenuto

Prima dei passi, la schermata di benvenuto propone di **importare un file di impostazioni** da un altro computer. Chiavi e token del file vengono rimossi, a meno che tu non spunti la casella per tenerli, e un’esportazione protetta da password la chiede lì stesso. L’importazione applica il file e chiude la procedura — vedi [Sicurezza e segreti](security.md) per cosa contiene un’esportazione.

## I passi

La colonna di sinistra elenca i passi. Un segno di spunta verde indica un passo compilato, un trattino uno superato senza compilarlo, e la riga evidenziata è quella in cui ti trovi.

| Passo | Cosa imposta | Dove cambiarlo poi |
|---|---|---|
| Identità Git | Il nome del profilo, e nome ed email dei tuoi commit | Impostazioni → Profilo |
| Account | Token per GitHub, GitLab, Azure DevOps, Bitbucket, Forgejo e server self-hosted, e l’app di **Apri con…** | Impostazioni → Integrazioni; l’app in Impostazioni → Generali |
| Intelligenza artificiale | Un account AI, messo in uso | Impostazioni → AI |
| Aspetto | Tema e modalità chiara, scura o automatica | Impostazioni → Temi |
| Fatto | Niente di nuovo — un riepilogo di ciò che è stato impostato | — |

**Salta per ora** chiude la procedura in qualsiasi passo e conserva ciò che hai inserito.

## Il passo AI

L’AI è facoltativa. Scegli una delle tre schede, oppure **Salta, senza AI**:

| Scheda | Cosa usa | Cosa serve |
|---|---|---|
| Il mio abbonamento | Claude Code o Codex, con accesso tramite il tuo piano | La CLI installata e con accesso eseguito |
| Chiave API | OpenAI, Anthropic, Gemini, Groq, OpenRouter o Mistral | Una chiave del provider |
| Sul mio computer | Ollama o LM Studio, in locale — nulla lascia la macchina | Il server avviato |

Quando su questo computer c’è Claude Code o Codex, la scheda dell’abbonamento dice quale e la versione, e sceglierla lo testa: un prompt breve, poi **Testato: ha risposto in N s. Pronto all’uso.** Se non se ne trova nessuno, o la CLI non ha l’accesso, la scheda mostra la stessa configurazione di [Impostazioni → AI](ai.md).

Per una chiave API o un server locale, **Continua** prova la connessione elencando i modelli del provider e salva solo un account che ha risposto.

Il passo salva un normale account AI, scritto come lo scrivono le Impostazioni e messo **In uso**: apri Impostazioni → AI e lo trovi lì, pronto da rinominare, usare solo per alcune funzioni o eliminare. Più account, un modello per funzione e come scrive l’AI si impostano lì, non nella procedura.

## Limiti

- **Il test dell’abbonamento costa un prompt.** Conta sul tuo piano come ogni richiesta. Parte solo quando scegli la scheda o premi **Prova di nuovo**.
- **Vengono rilevati solo Claude Code e Codex.** Gemini CLI e Devin rispondono come normali account CLI, da aggiungere in Impostazioni → AI.
- **Un server locale deve essere già in esecuzione.** La procedura non avvia Ollama né LM Studio e non scarica modelli.
- **La procedura parte una volta sola.** Dopo la chiusura, tutto ciò che ha impostato vive nelle Impostazioni; non si può riaprire.
