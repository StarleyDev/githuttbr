---
title: Limpieza de ramas
category: Ramas y cirugía
order: 47
summary: Borra las ramas locales cuyo trabajo ya está en otro sitio — upstreams eliminados, ramas fusionadas — en un solo paso que se puede deshacer.
keywords: limpiar limpieza prune borrar eliminar quitar ramas locales eliminada fusionada squash inactiva muertas viejas pull request ordenar lista de ramas clean up cleanup delete remove gone merged stale tidy branch list
source: 701f92f45b9e4dcda7dc560cb20128442fd2da0d
---

# Limpieza de ramas

Cada pull request que sacas deja atrás una rama local. La PR se fusiona, el servidor
borra su rama, y la local se queda — para siempre. Tras unos cientos de revisiones,
la lista de ramas es casi toda ramas muertas, y encontrar las vivas obliga a pasar
por delante de todas.

La limpieza de ramas lista las ramas locales cuyo trabajo ya está a salvo en otro
sitio, marca las que no tienen nada que perder y las borra en un solo paso que
puedes deshacer. «En otro sitio» significa las ramas de seguimiento remoto según tu
último fetch, y la rama por defecto.

![El diálogo de limpieza: ramas eliminadas, fusionadas y fusionadas con squash marcadas, y el trabajo que solo existe aquí apartado](../../screenshots/branch-cleanup.webp)

## Cómo funciona

1. Herramientas → **Limpiar ramas locales…** (o <kbd>⌘K</kbd>).
2. Pulsa primero **Fetch y prune** si el último fetch es antiguo. Hasta que no se
   haga un fetch con prune, una rama que el servidor borró aún parece viva aquí.
3. Si tu equipo fusiona las pull requests con squash, pulsa **Comprobar merges con
   squash** (ver abajo).
4. Revisa las marcas y luego **Eliminar**. Una sola confirmación dice cuántas ramas
   se van y nombra cada una que tiene commits que no están en ningún otro sitio.

El borrado es una operación con una sola entrada de deshacer: **Deshacer** vuelve a
crear cada rama borrada en el commit exacto al que apuntaba, con su upstream
(`branch.<name>.remote` y `.merge`) restaurado. Si desde entonces ha aparecido una
rama con el mismo nombre en otro commit — la misma PR sacada de nuevo —, deshacer la
deja en paz y recupera la borrada a su lado, como `<name>-restored-<short sha>`, y
lo dice.

El mensaje de éxito y la entrada de deshacer listan cada rama con el commit al que
apuntaba (`feature/x (was abc1234)`), como lo imprime `git branch -D`: el historial
de deshacer solo vive mientras la app está abierta, y esa línea basta para recrear
una rama a mano.

## Por qué aparece una rama

| Etiqueta | Significa |
|---|---|
| **Eliminada** | La rama sigue un upstream que el servidor ha borrado — la huella habitual de una pull request fusionada. |
| **Fusionada** | Todos sus commits ya están en la rama por defecto. El tooltip nombra la copia que los contiene — `main (local, not pushed)` cuando solo la tuya local los tiene. |
| **Squash** | Encontrada por **Comprobar merges con squash**: su contenido está en la rama por defecto, sus commits individuales no. |
| **Inactiva** | Sin commits durante el número de meses que elijas (3 por defecto). Solo aparece si marcas **Mostrar también ramas inactivas**. |
| **N commits existen solo aquí** | Commits que no están en ninguna rama de seguimiento remoto ni en la rama por defecto. Borrar la rama los borra. |
| **Sin commits aún** | Apunta exactamente a la punta de la rama por defecto — probablemente creada y nunca usada. |

«Fusionada» se mide contra la copia remota de la rama por defecto (`origin/main`), y
también contra la tuya local — un `main` local que nadie actualizó en un mes no
puede ocultar las fusiones de desde entonces.

## Merges con squash

Un merge con squash pone los cambios de una pull request en `main` como un solo
commit nuevo; los commits propios de la rama nunca llegan. Para git, esa rama parece
trabajo abandonado: **Eliminada**, con *N commits existen solo aquí*.

Cuando aparecen ramas eliminadas con commits propios, **Comprobar merges con
squash** hace otra pregunta: ¿fusionar esta rama en `main` cambiaría algo? Ejecuta
un `git merge-tree` en memoria para todas — sin checkout, sin índice —, y una rama
cuya fusión deja el árbol de `main` exactamente igual recibe la etiqueta **Squash**
y se marca como una fusionada. La confirmación dice que su contenido está en `main`
y sus commits no.

La comprobación se repite, bajo el bloqueo, en el momento del borrado: una rama que
ya no la supera se rechaza, no se borra.

## Qué viene marcado, y qué nunca

Marcadas al abrir el diálogo: las ramas **eliminadas o fusionadas** sin **commits
propios** — más las fusionadas con squash una vez comprobadas. **Seleccionar
eliminadas + fusionadas** recupera esa selección.

Nunca marcada por ti, y nunca alcanzada por **Seleccionar todos los visibles**: una
rama con commits que solo existen aquí. Márcala fila por fila; la confirmación se
pone entonces roja y la lista con su número de commits. Las ramas solo inactivas y
una que está en la punta de la rama por defecto tampoco se marcan. Cuando la
selección incluye filas que la lista no muestra — ocultas por el filtro, o más allá
de las primeras 400 —, la confirmación dice cuántas.

El borrado acepta, por rama, exactamente el número de commits únicos que mostró la
confirmación. Si para entonces una rama tiene más — o, al **Rehacer**, ha ganado
alguno desde que se deshizo (por ejemplo porque un prune quitó la copia remota) —,
se rechaza y se conserva, y rehacer lo informa en vez de dar éxito.

Nunca aparecen, y el borrado las rechaza aunque se pida:

- la rama actual;
- una rama sacada en cualquier worktree, o en medio de un rebase en uno;
- la rama por defecto;
- las [ramas protegidas](repo-settings.md), incluidos patrones como `release/*` de
  la [configuración del repositorio](repo-config.md).

Nada cambia en el remoto. Esto solo borra ramas locales.

## Límites

- **Los merges con squash son invisibles para git** hasta que compruebas. Sin
  **Comprobar merges con squash**, una rama fusionada con squash aparece como
  **Eliminada** con *N commits existen solo aquí*, y no se marca.
- **La comprobación de squash puede fallar.** Responde a «¿este contenido ya está
  en `main`?». Si `main` volvió a cambiar las mismas líneas, o el squash se editó al
  fusionar, el merge cambiaría algo, y la rama queda sin marcar. Nunca dice que sí
  por error de una forma que pierda contenido: el contenido está en `main` por
  definición. Como el [radar de conflictos](conflict-radar.md), escribe objetos de
  árbol sueltos que limpia `git gc`.
- **Un remoto sin fetch está desactualizado.** «Eliminada» sale del último fetch.
  Sin **Fetch y prune**, una rama borrada en el servidor hace una hora aún parece
  viva, y una fusión reciente aún no está en `origin/main`.
- **Inactiva es solo una fecha.** Tres meses tranquilos no dicen nada de si el
  trabajo está a salvo, por eso las filas inactivas nunca se marcan.
- **«En otro sitio» son las referencias de seguimiento remoto del último fetch**,
  no el servidor ahora mismo — y no las etiquetas. Un commit que solo sostiene una
  etiqueta cuenta como único, y uno que está en la rama remota de otra persona no.
- El recuento de commits únicos se detiene en 500 y muestra *500+*. El total de la
  confirmación es un mínimo — *al menos N* — porque las ramas apiladas comparten
  commits.
- Deshacer restaura la rama y su upstream, no su reflog ni otros ajustes
  `branch.<name>.*`.
- El diálogo muestra las primeras 400 filas de una lista larga; el filtro encuentra
  el resto. **Seleccionar eliminadas + fusionadas** se aplica a todas las filas,
  visibles o no.

**Ver también:** [Ramas, remotos y la barra lateral](branching.md) · [Traer, hacer pull y hacer push](syncing.md) · [Página de pull requests](pull-requests.md)
