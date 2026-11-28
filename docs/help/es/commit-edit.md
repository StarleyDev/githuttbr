---
title: Edita cualquier commit
category: Ramas y cirugía
order: 46
summary: Reescribe los archivos o el mensaje de un commit histórico en el sitio — con la cascada previsualizada primero.
keywords: editar commit edit reescribir historia rewrite history amend pasado reword corregir errata typo cascada cascade replay rebase in place cirugía surgery comparar con el original añadir archivo qué va a pasar cambios sin aplicar compare with original add file what will happen unapplied changes
source: 2860ac7978e6b9b1b8a469abadf313971d0140c6
---

# Edita cualquier commit

La errata está en un commit de hace tres semanas. El arreglo habitual es un
rebase interactivo: parar en el commit, editar, continuar, rezar. El arreglo de
GitHuttBr es: clic derecho en el commit, **Editar este commit**, cambiar el
texto, listo. El botón del lápiz en el panel de detalles del commit abre el
mismo editor.

![Editando un commit histórico](../../screenshots/commit-edit.webp)

## Qué hace

Elige cualquier commit que sea ancestro de `HEAD` — con historia lineal o sin
ella. El editor se abre en el panel central, en lugar del grafo de commits —
donde se abren el resolvedor de conflictos y el visor de archivos — y ocupa todo
el ancho y el alto de la ventana. **Esc** o la **×** de su cabecera lo cierran.
Tus ediciones sobreviven a cambiar a otra pestaña de repositorio y volver, y
cerrar con cambios sin aplicar pide confirmación primero.

La cabecera identifica el commit — su hash corto, asunto, autor y antigüedad — y,
en cuanto cambias algo, una píldora amarilla cuenta los **cambios sin aplicar**:
uno por el mensaje y uno por cada archivo que editaste.

### La tarjeta del mensaje

El mensaje tiene las mismas herramientas que el [compositor de
commits](committing.md): el botón **tipo ▾** antes del resumen, el resumen con su
contador de longitud (*56/72*) y la descripción debajo, la fila de estilo tras
la flecha (ámbito, clave del ticket, estilo de commit), el selector de gitmoji,
los coautores, la generación con IA a partir del propio diff del commit y las
sugerencias del linter. El mensaje del commit se divide al cargarse — la primera
línea pasa al resumen, el resto a la descripción — y se vuelve a unir con una
línea en blanco al reescribir. Convertir un viejo `add retry` en
`fix: add retry` es elegir una opción del botón de tipo.

En cuanto el mensaje difiere del original, la tarjeta se marca como **editado**,
el asunto antiguo sigue visible bajo la descripción como *antes: …*, y **Volver
al original** restaura el resumen y la descripción.

### La tarjeta de archivos

Los archivos del commit aparecen con su letra de estado; un punto marca cada uno
que has cambiado. Elige un archivo para editarlo tal como estaba en ese commit.
El conmutador encima del editor alterna entre **Editar** y **Comparar con el
original**, que muestra el diff del archivo desde lo que contiene el commit hasta
tu texto editado — la misma vista de diff que usa el resto de la app.

**Añadir archivo** abre un archivo que el commit no tocó, desde la propia
instantánea del commit: escribe parte de su ruta y elígelo. En cuanto lo editas,
el commit reescrito cambia también ese archivo. Queda marcado con un **+** en la
lista.

![Comparando un archivo editado con el original del commit](../../screenshots/commit-edit-compare.webp)

### Qué va a pasar

El panel junto a las tarjetas — debajo de ellas en una ventana estrecha —
muestra la cadena que toca una reescritura: cada commit por encima del editado,
de `HEAD` hacia abajo, y el propio commit editado al final con lo que cambia en
él.

1. **Previsualizar cascada** reproduce cada commit por encima del editado
   *en memoria* (una cadena de cherry-picks con `merge-tree` — sin checkout,
   sin árbol de trabajo, sin refs). Cada commit de la cadena dice entonces si
   **se reaplica sin conflictos** o tiene un **conflicto** en un archivo
   concreto, así que sabes **antes de que nada se mueva** si la edición se
   propaga limpiamente o choca con un cambio posterior. Tras cualquier otra
   edición los veredictos se borran; **Previsualizar de nuevo** la vuelve a
   ejecutar.
2. **Reescribir historial** lo hace de verdad: la misma cadena se construye
   con plumbing y después la rama se mueve con `reset --keep` — tus cambios
   sin commitear se arrastran, o el reset aborta y no ha pasado nada. Antes se
   toma una [instantánea guardián](recovery.md), y **Deshacer** restaura la
   cadena antigua.

Cuando el commit ya está en un remoto, una nota amarilla nombra la rama remota y
explica lo que eso significa: el próximo push tendrá que ser forzado. Otra nota
dice cuántos commits reciben hashes nuevos.

La autoría y las fechas de cada commit reproducido se conservan; solo cambian
los hashes — eso es lo que significa reescribir la historia.

## Merges en el rango

![Editando un commit por debajo de dos merges — la cascada los reproduce](../../screenshots/commit-edit-merges.webp)

Un merge entre el commit y `HEAD` ya no desactiva la edición. La cascada
reproduce un merge reaplicando su **resultado registrado** — el árbol que el
merge realmente commiteó, resoluciones de conflictos incluidas — sobre el
padre reescrito, así que las resoluciones que alguien hizo a mano sobreviven
a la reescritura al pie de la letra. Sin rerere, sin volver a mergear, sin
worktree: el mismo plumbing en memoria que el resto de la cascada, y los dos
punteros a los padres se conservan. Una rama lateral que también contiene el
commit editado se reescribe y se reapunta; una que no lo contiene conserva su
identidad intacta. Una nota en el panel lateral dice cuántos merges lleva el
rango, y los commits de merge muestran un icono de merge en la cadena.

La advertencia honesta: un merge reproducido solo es tan bueno como su
resultado registrado. Si tu edición choca con líneas que el propio merge
resolvió, la previsualización se pone en rojo exactamente igual que cualquier
otro paso en conflicto — nada se adivina.

## Cuando la cascada da conflicto

Un commit posterior tocó las mismas líneas que estás editando. La
previsualización marca ese commit con el archivo en conflicto, los commits de
encima como no reaplicados, y **Reescribir historial** sigue desactivado — nada
queda aplicado a medias, nunca. A diferencia de un rebase, el editor no se
detiene a mitad de camino para que resuelvas el conflicto: o editas de otra
forma, o afrontas el conflicto de cara con un [rebase interactivo](rebase.md).

## Límites

- **El commit debe ser ancestro de `HEAD`.** Un commit en una rama lateral
  sin mergear no tiene camino hasta tu rama actual por el que reproducirse.
- Los archivos binarios y los que superan 2 MB se muestran pero no se pueden
  editar.
- Un commit que ya está en un remoto se puede editar, pero tu siguiente push
  tendrá que ser un **force push** — el editor avisa antes de que te
  comprometas a eso.
- Los archivos eliminados en el commit no se pueden editar (no hay contenido
  que editar).
- **Añadir archivo** alcanza archivos que ya existen en la instantánea del
  commit; no puede crear un archivo nuevo, borrar uno ni tocar un enlace
  simbólico o un submódulo.

**Ver también:** [Rebase interactivo](rebase.md) · [Recuperación y el reflog](recovery.md) · [Absorber](absorb.md)
