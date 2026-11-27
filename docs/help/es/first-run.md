---
title: Primer arranque
category: Empieza aquí
order: 2
summary: El asistente del primer arranque — identidad de Git, cuentas de alojamiento, IA, apariencia — y lo que guarda cada paso.
keywords: onboarding primer arranque primera vez asistente configuración bienvenida importar ajustes identidad git cuentas ia suscripción clave api ollama lm studio claude code codex omitir first run
source: 5b5992d94b164ac6b9b101283ec044ba376b88de
---

# Primer arranque

La primera vez que se abre GitHuttBr, un asistente breve pregunta lo poco que cambia su comportamiento desde el primer commit: quién eres en Git, dónde se alojan tus repositorios, si quieres usar IA y qué aspecto prefieres. Cada paso puede quedar vacío, y todo lo que define se puede cambiar después en **Ajustes**.

![El paso de IA: un CLI de suscripción encontrado en este equipo y probado](../../screenshots/onboarding-ai.webp)

## La pantalla de bienvenida

Antes de los pasos, la pantalla de bienvenida ofrece **importar un archivo de ajustes** de otro equipo. Un archivo con claves y tokens los pierde salvo que marques la casilla para conservarlos, y una exportación protegida con contraseña la pide ahí mismo. Importar aplica el archivo y cierra el asistente — consulta [Seguridad y secretos](security.md) para saber qué contiene una exportación.

## Los pasos

La columna izquierda lista los pasos. Una marca verde señala un paso completado, un guion uno que pasaste sin completar, y la fila resaltada es donde estás.

| Paso | Qué define | Dónde cambiarlo después |
|---|---|---|
| Identidad de Git | El nombre del perfil, y el nombre y el email de tus commits | Ajustes → Perfil e identidad |
| Cuentas | Tokens de GitHub, GitLab, Azure DevOps, Bitbucket, Forgejo y servidores propios, y la app de **Abrir con…** | Ajustes → Cuentas conectadas; la app en Ajustes → Git y sincronización |
| Inteligencia artificial | Una cuenta de IA, puesta en uso | Ajustes → IA |
| Apariencia | Tema y modo claro, oscuro o automático | Ajustes → Temas |
| Listo | Nada nuevo — un resumen de lo configurado | — |

**Omitir por ahora** cierra el asistente en cualquier paso y conserva lo que ya escribiste.

## El paso de IA

La IA es opcional. Elige una de las tres tarjetas, u **Omitir, sin IA**:

| Tarjeta | Qué usa | Qué necesita |
|---|---|---|
| Mi suscripción | Claude Code o Codex, con sesión iniciada con tu plan | El CLI instalado y con sesión iniciada |
| Clave de API | OpenAI, Anthropic, Gemini, Groq, OpenRouter o Mistral | Una clave del proveedor |
| En mi ordenador | Ollama o LM Studio, en local — nada sale del equipo | El servidor iniciado |

Cuando Claude Code o Codex se encuentra en este equipo, la tarjeta de suscripción dice cuál y su versión, y elegir la tarjeta lo prueba: un prompt corto y luego **Probado: respondió en N s. Listo para usar.** Si no se encuentra ninguno, o el CLI no tiene sesión iniciada, la tarjeta muestra la misma configuración de conexión que [Ajustes → IA](ai.md).

Para una clave de API o un servidor local, **Continuar** prueba la conexión listando los modelos del proveedor y solo guarda una cuenta que respondió.

Lo que guarda el paso es una cuenta de IA normal, escrita como la escriben los Ajustes y puesta **En uso**: abre Ajustes → IA y ahí está, lista para renombrarla, usarla solo en algunas funciones o borrarla. Varias cuentas, un modelo por función y cómo escribe la IA se configuran ahí, no en el asistente.

## Límites

- **La prueba de la suscripción cuesta un prompt.** Cuenta para el uso de tu plan, como cualquier petición. Solo se ejecuta al elegir la tarjeta o pulsar **Probar de nuevo**.
- **Solo se detectan Claude Code y Codex.** Gemini CLI y Devin responden como cuentas de CLI normales, que añades en Ajustes → IA.
- **Un servidor local debe estar ya en marcha.** El asistente no inicia Ollama ni LM Studio, ni descarga modelos.
- **El asistente se ejecuta una vez.** Al cerrarse, todo lo que definió vive en Ajustes; no hay forma de volver a abrirlo.
