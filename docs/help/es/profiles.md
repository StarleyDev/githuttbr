---
title: Perfiles
category: Hazlo tuyo
order: 101
summary: Identidades y tokens separados para el trabajo y para todo lo demás.
keywords: perfil perfiles profile identidad identity git user email tokens cuentas accounts cambiar switch
---

# Perfiles

Un perfil agrupa una **identidad de Git** (nombre y correo) con sus **tokens de
integración**. Cambia de perfil y cambian los dos a la vez — los commits llevan
la autoría correcta y las llamadas a la API usan la cuenta adecuada.

Útil cuando la misma máquina lleva repositorios de trabajo y personales, o
cuando tienes dos cuentas de GitHub.

![Un perfil: la identidad de git a un lado, sus tokens de integración al otro](../../screenshots/settings-profiles.webp)

## Editar un perfil, usar un perfil

Dos páginas de los Ajustes cambian con el perfil — **Perfil e identidad** y **Cuentas conectadas**, arriba del grupo **Tú**, cuyo encabezado nombra el perfil que editan. Todas las demás valen en cualquier perfil y lo dicen arriba.

**Perfil e identidad** empieza con la tarjeta del perfil: su imagen, su nombre (editable ahí mismo), *en uso* cuando la app lo usa, el selector y **Nuevo perfil**. **Cuentas conectadas** empieza con el mismo selector en una barra, *Editando el perfil*. El selector elige qué perfil estás **editando**; no cambia el que la app está **usando**. Cuando difieren, una franja ámbar lo dice, con **Usar este perfil** para cambiar. Es el momento en que más fácil se vincula una cuenta al perfil equivocado, así que Cuentas conectadas también nombra el perfil en cada tarjeta y en el propio botón, y la confirmación lo repite. Borrar un perfil está en el mismo sitio, y pregunta antes.

Debajo de la tarjeta vienen la identidad de git y la firma de commits. Cuando hay un repositorio abierto que hace commits como otra persona — su configuración de git nombra otro autor —, una línea lo dice, con **Aplicar identidad al repositorio actual**; cuando coinciden no hay nada que aplicar y la línea no aparece. Después vienen la imagen del perfil, un resumen de sus **cuentas conectadas** — una línea por host con *Conectada*, *Token caducado o con error*, *No se pudo contactar* o *No conectada*, y **Conectar** o **Renovar**, que abren Cuentas conectadas en ese host — y qué IA usa el perfil.

El resumen comprueba en silencio, sin ventana de inicio de sesión, cada vez que se abre la página o cambia un token; nunca consulta periódicamente. Lo que encuentra es lo que usa el menú lateral: **Cuentas conectadas** muestra un pequeño contador de aviso cuando un token fue rechazado o falló, y solo para comprobaciones que los Ajustes ya hicieron. Un host al que no se pudo llegar no cuenta — el token puede estar bien.

![Editando el perfil Trabajo mientras la app usa otro: la franja ámbar y el botón de vincular que nombra a Trabajo](../../screenshots/settings-profile-band.webp)

## La IA es compartida

Un perfil no necesita su propia IA: una [IA
general](ai.md#una-ia-para-todos-los-perfiles) sirve a todos los perfiles, y un
perfil opta por la suya solo cuando hace falta. La elección abarca todo: un
perfil en la IA general también escribe como esté configurada la IA general —
estilo de commit, reglas extra para commits, chat del repositorio. Un perfil
que necesita otro estilo recibe su propia IA, una copia de la general que luego
puede cambiar. Todo se edita en la página **IA**; la página Perfil solo dice qué
IA usa el perfil y enlaza allí.

## Cada perfil, sus propias cuentas

Además de un token, un perfil puede **vincular** un inicio de sesión que ya esté
en el equipo — del credential helper de git o de GitHub CLI — en Ajustes → Cuentas conectadas. Un vínculo pertenece a un solo perfil: un perfil nuevo empieza
desconectado, y se rechaza una cuenta que otro perfil ya tiene, así que dos
perfiles pueden tener dos cuentas de GitHub (o de Azure DevOps) a la vez. Ver
[Hosting](hosting.md).

## Vinculación por repositorio

Un repositorio se puede **vincular a un perfil**, de modo que un fetch en segundo
plano sobre él siempre se autentique con la cuenta correcta — incluso mientras
estás mirando un repositorio que pertenece a la otra.

Los tokens viven en el [llavero del sistema](security.md), nunca en el fichero de
ajustes.

**Ver también:** [Seguridad y secretos](security.md) · [Hosting](hosting.md)
