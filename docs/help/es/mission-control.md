---
title: Centro de control
category: Sincronizar y muchos repos
order: 51
summary: Todos los repositorios del espacio de trabajo en una pantalla, el peor primero.
keywords: centro de control mission control panel dashboard todos los repos resumen estado sucio dirty sin publicar unpushed detrás behind espacio de trabajo workspace pull requests ci versión etiqueta intervalo de actualización release tag refresh interval
---

# Centro de control

Veinte repositorios, y la pregunta siempre es la misma: ¿cuál me necesita?

El centro de control la responde. Todos los repositorios del **espacio de
trabajo activo** en una pantalla, ordenados por lo que de verdad te reclama:

1. **Bloqueados** — un rebase o un merge a medias, conflictos, un repositorio
   que ni siquiera se puede leer.
2. **Por sincronizar** — commits que traer, y luego commits que publicar.
3. **En curso** — trabajo sin commitear, archivos sin seguimiento.
4. **Limpios** — los tranquilos, abajo del todo, que es donde les toca.

![Todos los repositorios en una pantalla, el peor primero](../../screenshots/mission-control.webp)

## Qué te dice una fila

Cada fila se lee de izquierda a derecha, y las columnas se alinean a lo largo de
la lista, así que los recuentos se comparan como en una tabla:

| Columna | Qué muestra |
|---|---|
| **Repositorio** | Nombre, grupo, la rama y su upstream — o **sin upstream** en ámbar: esa rama nunca se sube por error, pero tampoco se sincroniza |
| **Último commit** | Asunto y autor: lo último que hizo el repositorio, sin abrirlo |
| **Local** | Conflictos · ↓ por bajar · ↑ por subir · preparados · modificados · sin seguimiento · stashes. Pasa el ratón para ver qué cuenta cada uno |
| **Alojamiento** | Los pull requests abiertos, con los que esperan **tu** revisión en ámbar, y el CI de HEAD. Haz clic en el número para abrir la página **Pull requests** de ese repositorio, o en **CI** para abrir sus ejecuciones |
| **Versión** | La etiqueta más reciente que alcanza HEAD, y cuántos commits llegaron después — **al día** si no hay ninguno. El número se colorea según cuánto se ha quedado atrás una versión: gris hasta 5 commits, amarillo hasta 20, rojo a partir de ahí, en cuatro rangos que puedes cambiar — colores personalizados incluidos — en [**Ajustes → Temas → Colores de la nota de versión**](themes.md#colores-de-la-nota-de-versión) |
| **Actividad** | Un sparkline de commits de 14 días, y cuántos son |
| **Tiempo** | Cuánto hace del último commit y del último **fetch** |

Pasa el ratón por el icono de estado para ver por qué la fila está ahí —
"2 por subir · 1 sin commit".

La edad del fetch está porque leer esta página nunca hace fetch: el recuento "por
bajar" es tan reciente como el último fetch. Si una rama con upstream lleva un día
o más sin fetch, o nunca lo hizo, la edad se pone ámbar — haz fetch antes de fiarte
de un 0. La hora sale del propio git, así que un `git fetch` en la terminal también
cuenta.

![Ajustes → Git y sincronización: la actualización de Mission Control junto al fetch automático](../../screenshots/settings-git-sync.webp)

En una ventana estrecha todas las columnas se quedan, y la tabla se desplaza de
lado dentro de su marco.

**Abrir**, al final de una fila, muestra el propio repositorio — su grafo —
aunque su pestaña mostrara por última vez la lista de pull requests que abrió el
número de PR.

Despliega una fila (el chevrón, o <kbd>espacio</kbd>) para ver exactamente qué
commits esperan a ser publicados y qué archivos están sucios.

## Trabajar la lista

- Las píldoras de estado de arriba son **filtros** — haz clic en «3 bloqueados»
  para ver solo esos. **N PR abiertos** y **N CI fallando** filtran igual, y
  también **N PR esperando tu revisión** en la línea de abajo.
- Ordena por **urgencia**, **nombre** o **actividad**.
- **Marca varios repositorios** para hacerles fetch, o pull solo de los que van
  por detrás (el botón te los cuenta).
- **Fetch en N desactualizados** aparece cuando hay ramas con upstream sin fetch
  desde hace un día o más, y solo hace fetch en esas — las que pueden tener mal el "por bajar".
- Se refresca solo cada 30 segundos mientras está abierto — cámbialo en
  **Ajustes → Git y sincronización → Actualización de Mission Control**, 30
  segundos como mínimo. Con la página cerrada no se ejecuta nada.

| Tecla | Acción |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> o <kbd>j</kbd> <kbd>k</kbd> | Recorrer la lista |
| <kbd>Enter</kbd> | Abrir ese repositorio |
| <kbd>f</kbd> / <kbd>p</kbd> | Hacerle fetch / pull |
| <kbd>espacio</kbd> | Desplegarlo |
| <kbd>/</kbd> | Saltar al filtro |

## Es una vista, no una pestaña

El indicador junto al nombre del espacio de trabajo lo abre y lo cierra; hacer
clic en cualquier pestaña te devuelve a tu trabajo. Nunca añade una pestaña
propia, y pertenece al espacio en el que estás — cambia de espacio y obtienes el
panel de ese espacio.

La parte de git es **local**: unos pocos comandos de git por repositorio, sin
fetch. La columna **Alojamiento** es la única parte que habla con un host. Pide
al host de cada repositorio sus pull requests abiertos y el CI de HEAD, con el
perfil de ese repositorio, y en silencio: un host sin token ni vínculo para ese
perfil simplemente no muestra nada, y nunca se abre una ventana de inicio de
sesión. Un repositorio ya abierto en una pestaña no cuesta ninguna llamada,
porque la barra lateral ya tiene sus pull requests.

Límites, para leer bien los números:

- A los hosts se les pregunta **como mucho cada 5 minutos** por repositorio
  (antes si HEAD se mueve o una ejecución de CI sigue en curso), sea cual sea el
  intervalo de actualización — la cuota de API de un host se comparte con el
  resto de la app. **Actualizar** vuelve a preguntar ahora.
- Un número muestra **30+** cuando la primera página del host llegó llena; la
  página de la lista los tiene todos.
- La columna de versión es la etiqueta más reciente **alcanzable desde HEAD**, no
  la más reciente del repositorio. Una etiqueta creada en un commit que HEAD ya
  tiene aparece en menos de dos minutos.

El fetch siempre es algo que has pedido tú.

**Ver también:** [Espacios de trabajo y pestañas](workspaces.md) · [Espacios de trabajo, pestañas y grupos](workspaces.md)
