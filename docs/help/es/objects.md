---
title: Explorador de objetos
category: Repositorio e historial
order: 16
summary: Recorre la capa que hay debajo del grafo — commits, árboles, blobs, tags y las refs que los apuntan. Aquí nada cambia nada.
keywords: objetos objects object explorador explorer blob árbol tree commit tag etiqueta ref plumbing cat-file ls-tree sha1 internals interioridades base de datos database rev-parse HEAD^{tree} loose packed suelto empaquetado
---

# Explorador de objetos

Git tiene fama de complicado. Casi toda esa fama viene de no haber visto nunca
el modelo: **cuatro tipos de objeto, y punteros**. En cuanto puedes hacer clic
en un commit, aterrizar en su árbol y descubrir que tu archivo *es* un blob al
que un árbol le puso el nombre, la porcelana deja de ser magia.

`⌘K` → **Explorador de objetos**. Nada de esta página puede cambiar un solo
byte — todas las llamadas que hay detrás son de lectura.

![El commit al que apunta main: la ruta desde la rama, a qué apunta y dónde está un commit en el modelo](../../screenshots/objects.webp)

## Los cuatro objetos

| Objeto | Es | Sabe |
|--------|----|-------|
| **blob** | El *contenido* de un archivo | Nada. Ni su nombre, ni su ruta, ni su historial |
| **tree** | Un listado de directorio | Nombres, modos y el sha de cada blob o árbol hijo |
| **commit** | Una instantánea | Su árbol, sus padres, autor, committer, mensaje |
| **tag** | Una etiqueta anotada | El objeto que apunta, quién la creó, un mensaje |

La sorpresa para casi todo el mundo es la primera fila. **Un blob no tiene
nombre.** Dos archivos con contenido idéntico en cualquier punto de tu historial
son el mismo blob, almacenado una sola vez. El nombre vive en el árbol que lo
apunta — por eso git rastrea contenido en lugar de archivos, y por eso los
renombrados se detectan en lugar de registrarse.

Una **ref** — `refs/heads/main`, `refs/tags/v1.0`, `HEAD` — no es más que un
archivo que contiene un sha. En eso consiste entero lo de "crear ramas es
barato".

## Recorrer

![Del commit a src/: primero las carpetas, cada modo explicado](../../screenshots/objects-tree.webp)

La columna de la izquierda lista todas las refs, agrupadas como las agrupa git:
HEAD (con `→ main` cuando está en una rama), Ramas, Etiquetas y Remotas, cada
grupo con su recuento. Remotas empieza plegado. El marcador cuadrado es una ref
a un commit; el redondo verde, una etiqueta **anotada**. El filtro estrecha
todos los grupos a la vez. Haz clic en una ref para llegar al objeto que nombra;
esa fila queda resaltada mientras recorres desde ella.

A partir de ahí, todo es una puerta:

- Un **commit** muestra a qué **apunta** — su árbol raíz, con cuántos elementos
  tiene, y cada padre, con su asunto — y luego autor y committer (*el mismo que
  el autor* cuando coinciden) y el mensaje.
- Un **árbol** es una tabla de nombre, modo, objeto y tamaño, primero las
  carpetas. Cada modo se explica: *archivo*, *ejecutable*, *carpeta*, *enlace
  simbólico*, *submódulo*. Una carpeta dice cuántos elementos tiene; un enlace,
  adónde apunta.
- Un **blob** muestra su texto con números de línea (solo el principio, si es
  grande), o dice claramente que es binario. Si llegas por un árbol, una barra
  dice cómo se llama ahí — *Llamado src/app.ts en el commit 07c6f3d, modo
  100644 (archivo normal)* — con un enlace al historial del archivo.
- Una **etiqueta anotada** apunta al objeto que nombra y registra quién la creó.

![Un blob, el nombre que le dio su árbol y dónde está en el modelo](../../screenshots/objects-blob.webp)

### La ruta

La franja bajo la caja de revisión es la **ruta** recorrida:
`rama main → commit 07c6f3d → raíz → src/ → app.ts`. El árbol de un commit es
la **raíz**; un archivo o carpeta toma el nombre de la fila en la que hiciste
clic. Haz clic en cualquier elemento para volver a él. Escribir una revisión,
elegir una ref o uno de los ejemplos junto a **Abrir** empieza una ruta nueva.

**Atrás** y **Adelante** recorren todo lo que abriste, como en un navegador:
después de volver, Adelante regresa, hasta que abras algo nuevo desde ahí. La
caja de revisión sigue el recorrido, así que `main:src/app.ts` siempre está ahí
para copiar.

### Colores

Cada tipo conserva un color allí donde aparece — insignia, elemento de la ruta,
tarjeta, fila: commit en el color de acento del tema, árbol en su amarillo, blob
en azul, etiqueta y ref en verde. Bajo la cabecera del objeto, una frase dice
qué *es* ese tipo.

### Dónde estás en el modelo

La franja al pie del panel es la cadena de git — **ref → commit → tree →
blob**, con **tag** entre ref y commit en una etiqueta anotada — y el tipo en
pantalla queda resaltado como *estás aquí*.

## Escribir una revisión

La caja acepta cualquier cosa que acepte `git rev-parse`, que es donde esto
deja de ser un navegador y empieza a ser una forma de aprender:

| Escribe esto | Para obtener |
|-----------|--------|
| `HEAD` | El commit actual |
| `HEAD~3` | Tres commits atrás |
| `HEAD^{tree}` | El árbol de ese commit, pelado |
| `HEAD:src/app.ts` | El blob de esa ruta, directamente |
| `v1.0^{}` | A qué apunta una etiqueta anotada, en vez del objeto de etiqueta |
| `a1b2c3d` | Cualquier objeto, por sha — las abreviaturas valen |

Los dígitos de modo en el listado de un árbol merecen conocerse: `100644` un
archivo, `100755` ejecutable, `040000` un subárbol, `120000` un enlace
simbólico, `160000` un gitlink de submódulo — y ese último es todo lo que
guarda un submódulo.

## Límites que conviene conocer

- **Es de solo lectura, a propósito.** Aquí no hay nada con lo que escribir.
  Fabricar objetos a mano es un ejercicio de `git hash-object`, y su sitio es un
  terminal.
- **Los blobs grandes se truncan** a partir de los primeros 200 KB — suficiente
  para ver qué son, no tanto como para colgar la ventana.
- **Los tamaños son el tamaño del contenido del objeto** tal como lo reporta
  `git cat-file -s`, no lo que ocupa en disco después de empaquetarlo. Para eso,
  mira [mantenimiento](maintenance.md).
- **Los objetos inalcanzables siguen siendo objetos.** Pega un sha del informe
  de colgantes de `git fsck` y se abre, que suele ser la vía más rápida para ver
  qué contenía un commit perdido antes de decidir si lo recuperas.
- **Una fila de submódulo no se abre.** Su gitlink nombra un commit de otro
  repositorio, que este no tiene.
- **Los recuentos y destinos de enlace tienen un techo.** Un árbol con más de
  300 subcarpetas las lista sin recuento, y solo los 50 primeros enlaces
  simbólicos muestran su destino.
- **La ruta termina con el diálogo.** Ciérralo y el siguiente vuelve a empezar
  por la rama de HEAD.

Ver también: [El grafo](graph.md) · [Mantenimiento del repositorio](maintenance.md) ·
[Recuperación](recovery.md)
