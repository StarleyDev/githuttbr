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

Ajustes divide sus páginas en dos. **De este perfil** reúne las páginas que
cambian con el perfil — **Perfil** e **Integraciones**. **De la app** reúne todo
lo demás, que se aplica en cualquier perfil y lo dice al principio de la página.

Las dos páginas del perfil se abren con una barra: *Editando el perfil* y un
selector. El selector elige qué perfil estás **editando**; no cambia el que la
app está **usando**. Cuando no coinciden, una franja ámbar lo dice — *Estás
editando Trabajo. La app está usando Personal* — con **Usar este perfil** para
cambiar. Ese es el momento en que más fácil resulta vincular una cuenta al perfil
equivocado, así que la página de Integraciones también nombra el perfil en cada
tarjeta y en el propio botón: **Vincular al perfil Trabajo**, y la confirmación lo
repite. Nuevo y borrar están en la misma barra; borrar pregunta antes.

![Editando el perfil Trabajo mientras la app usa otro: la franja ámbar y el botón de vincular que nombra a Trabajo](../../screenshots/settings-profile-band.webp)

## La IA es compartida

Un perfil no necesita su propia IA: una [IA general](ai.md#una-ia-para-todos-los-perfiles)
sirve a todos los perfiles, y un perfil opta por la suya solo cuando hace falta.
Lo que un perfil siempre conserva es cómo escribe la IA para él — el estilo de
commit, las instrucciones personalizadas y el resto de *Preferencias de escritura
de la IA*.

## Cada perfil, sus propias cuentas

Además de un token, un perfil puede **vincular** un inicio de sesión que ya esté
en el equipo — del credential helper de git o de GitHub CLI — en Ajustes →
Integraciones. Un vínculo pertenece a un solo perfil: un perfil nuevo empieza
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
