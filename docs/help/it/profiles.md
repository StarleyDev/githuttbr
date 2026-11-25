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

Le Impostazioni dividono le loro pagine in due. **Questo profilo** raccoglie le
pagine che cambiano con il profilo — **Profilo** e **Integrazioni**. **App**
raccoglie tutto il resto, che vale in qualsiasi profilo e lo dice in cima alla
pagina.

Le due pagine del profilo si aprono con una barra: *Modifica del profilo* e un
selettore. Il selettore sceglie quale profilo stai **modificando**; non cambia
quello che l'app sta **usando**. Quando sono diversi, una fascia ambra lo dice —
*Stai modificando Lavoro. L'app sta usando Personale* — con **Usa questo profilo**
per passare all'altro. È il momento in cui è più facile collegare un account al
profilo sbagliato, per questo la pagina Integrazioni nomina il profilo anche su
ogni scheda e sul pulsante stesso: **Collega al profilo Lavoro**, e la conferma lo
ripete. Nuovo ed elimina sono nella stessa barra; eliminare chiede prima.

![Modifica del profilo Lavoro mentre l'app ne usa un altro: la fascia ambra e il pulsante di collegamento che nomina Lavoro](../../screenshots/settings-profile-band.webp)

## L'IA è condivisa

Un profilo non ha bisogno di un'IA propria: una sola [IA generale](ai.md#una-sola-ia-per-tutti-i-profili)
serve tutti i profili, e un profilo sceglie la propria solo quando deve. Ciò che
un profilo conserva sempre è come l'IA scrive per lui — lo stile dei commit, le
istruzioni personalizzate e il resto delle *Preferenze di scrittura dell'IA*.

## Ogni profilo, i suoi account

Oltre a un token, un profilo può **collegare** un accesso già presente sulla
macchina — dal credential helper di git o da GitHub CLI — in Impostazioni →
Integrazioni. Un collegamento appartiene a un solo profilo: un nuovo profilo
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
