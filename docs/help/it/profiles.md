---
title: Profili
category: Personalizzazione
order: 101
summary: Identità e token separati per il lavoro e per tutto il resto.
keywords: profilo profili identità git user email token account cambia
---

# Profili

Un profilo mette insieme un'**identità Git** (nome ed email) con i suoi **token
di integrazione**. Cambi profilo e cambiano entrambi insieme — i commit sono
attribuiti correttamente e le chiamate API usano l'account giusto.

Utile quando la stessa macchina gestisce repository di lavoro e personali, o
quando hai due account GitHub.

![Un profilo: da un lato l'identità git, dall'altro i suoi token di integrazione](../../screenshots/settings-profiles.webp)

## Modificare un profilo, usare un profilo

Due pagine delle Impostazioni cambiano con il profilo — **Profilo e identità** e **Account collegati**, in cima al gruppo **Tu**, la cui intestazione nomina il profilo che modificano. Tutte le altre valgono in qualsiasi profilo e lo dicono in alto.

**Profilo e identità** si apre con la scheda del profilo: immagine, nome (modificabile sul posto), *in uso* quando l’app lo usa, il selettore e **Nuovo profilo**. **Account collegati** si apre con lo stesso selettore in una barra, *Modifica del profilo*. Il selettore sceglie quale profilo stai **modificando**; non cambia quello che l’app sta **usando**. Quando differiscono, una fascia ambra lo dice, con **Usa questo profilo** per passare. È il momento in cui è più facile collegare un account al profilo sbagliato, quindi Account collegati nomina il profilo anche su ogni scheda e sul pulsante stesso, e la conferma lo ripete. L’eliminazione di un profilo è nello stesso punto, e chiede prima.

Sotto la scheda vengono l’identità git e la firma dei commit. Quando un repository aperto fa commit come qualcun altro — la sua configurazione git nomina un altro autore —, una riga lo dice, con **Applica l’identità al repository corrente**; quando coincidono non c’è nulla da applicare e la riga non compare. Poi vengono l’immagine del profilo, un riepilogo dei suoi **account collegati** — una riga per host con *Collegato*, *Token scaduto o in errore*, *Non raggiungibile* o *Non collegato*, e **Collega** o **Rinnova**, che aprono Account collegati su quell’host — e quale IA usa il profilo.

Il riepilogo controlla in silenzio, senza finestra di accesso, ogni volta che la pagina si apre o un token cambia; non interroga mai a intervalli. Ciò che trova è anche ciò che usa il menu laterale: **Account collegati** mostra un piccolo contatore di avviso quando un token è stato rifiutato o è fallito, e solo per i controlli che le Impostazioni hanno già fatto. Un host non raggiungibile non conta — il token potrebbe essere valido.

![Modifica del profilo Lavoro mentre l'app ne usa un altro: la fascia ambra e il pulsante di collegamento che nomina Lavoro](../../screenshots/settings-profile-band.webp)

## L'IA è condivisa

Un profilo non ha bisogno di un'IA propria: una sola [IA
generale](ai.md#una-sola-ia-per-tutti-i-profili) serve tutti i profili, e un
profilo sceglie la propria solo quando deve. La scelta vale per tutto: un
profilo sull'IA generale scrive anche come è impostata l'IA generale — stile dei
commit, regole extra per i commit, chat del repository. Un profilo che ha
bisogno di un altro stile riceve un'IA propria, una copia di quella generale che
può poi cambiare. Tutto si modifica nella pagina **AI**; la pagina Profilo dice
solo quale IA usa il profilo e porta lì.

## Ogni profilo, i suoi account

Oltre a un token, un profilo può **collegare** un accesso già presente sulla
macchina — dal credential helper di git o da GitHub CLI — in Impostazioni → Account collegati. Un collegamento appartiene a un solo profilo: un nuovo profilo
parte disconnesso, e un account che un altro profilo ha già viene rifiutato,
così due profili possono avere due account GitHub (o Azure DevOps) affiancati.
Vedi [Hosting](hosting.md).

## Legame per repository

Un repository può essere **legato a un profilo**, così un fetch in background su
di lui si autentica sempre con l'account giusto — anche mentre stai guardando un
repository che appartiene all'altro.

I token vivono nel [portachiavi del tuo sistema operativo](security.md), mai nel
file delle impostazioni.

**Vedi anche:** [Sicurezza e segreti](security.md) · [Hosting](hosting.md)
