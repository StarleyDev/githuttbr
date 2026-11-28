---
title: Escribir comentarios
category: Sincronizar y muchos repos
order: 57.5
summary: El editor de Markdown detrás de cada cuadro de comentario — Escribir / Vista previa, una barra de formato con los atajos de GitHub, listas que continúan con Enter y autocompletado de @menciones / #referencias.
keywords: editor markdown cuadro de comentario barra de herramientas negrita cursiva código enlace cita encabezado lista con viñetas numerada tareas checklist vista previa escribir atajo mención arroba referencia almohadilla número de issue autocompletar respuesta descripción de la pull request cuerpo de la issue markdown editor comment box toolbar mention reference autocomplete reply
source: cc7673de22ce745f04a0341c4d263219c432b693
---

# Escribir comentarios

Un comentario enviado a GitHub es Markdown, y un cuadro de texto pelado te deja
escribir a mano cada `**` y `- [ ]`, para luego descubrir en el navegador si la
tabla se vio bien. Todo cuadro de la app que escribe en un host es ahora el mismo
editor, con las herramientas que tiene el cuadro de comentario del propio GitHub:

- el cuadro de comentario de una pull request, sus respuestas en hilos y sus
  comentarios de línea ([Página de pull requests](pull-requests.md));
- el cuadro de comentario de una issue;
- la descripción de una pull request nueva y el cuerpo de una issue nueva
  ([Hosting y pull requests](hosting.md)).

![El cuadro de comentario de una pull request, con la barra de formato y la lista de personas para mencionar abierta en «@al»](../../screenshots/comment-editor.webp)

## Escribir y Vista previa

**Vista previa** muestra el texto como se verá, dibujado por el mismo renderizador
de Markdown que el resto de la app. Es de solo lectura; **Escribir** devuelve el
campo con el texto y el cursor donde los dejaste, así que ⌘/Ctrl+Z sigue
deshaciendo lo que escribiste antes de mirar.

Las pestañas son una lista de pestañas: con una enfocada, ← y → cambian entre
ellas.

## La barra de herramientas

| Herramienta | Atajo | Qué hace |
|---|---|---|
| **Encabezado** | — | Un menú con H1, H2 y H3 para las líneas seleccionadas; elegir el nivel que una línea ya tiene lo quita |
| **Negrita** | ⌘/Ctrl+B | `**texto**` |
| **Cursiva** | ⌘/Ctrl+I | `_texto_` |
| **Código** | ⌘/Ctrl+E | `` `código` `` dentro de una línea; un bloque cercado con ```` ``` ```` cuando la selección abarca varias líneas |
| **Enlace** | ⌘/Ctrl+K | `[texto](url)` — una URL seleccionada se vuelve la dirección, otro texto la etiqueta |
| **Cita** | — | `> ` en cada línea seleccionada |
| **Lista con viñetas** | ⌘/Ctrl+Shift+8 | `- ` en cada línea seleccionada |
| **Lista numerada** | ⌘/Ctrl+Shift+7 | `1. `, `2. `… en cada línea seleccionada |
| **Lista de tareas** | — | `- [ ] ` en cada línea seleccionada |

Cada herramienta se activa y desactiva: aplicada a un texto que ya la tiene, la
quita. Sin nada seleccionado, negrita, cursiva, código y enlace insertan un texto
de ejemplo y lo seleccionan, listo para escribir encima. Una herramienta de lista
sustituye una lista de otro tipo en lugar de apilarse sobre ella.

Las ediciones pasan por la edición propia del campo de texto, así que **⌘/Ctrl+Z
deshace una herramienta** igual que una palabra escrita, y rehacer la recupera.

La barra es una sola parada para Tab; ← → se mueven entre sus botones, y ↓ abre el
menú de encabezados. Dentro de un cuadro de comentario, ⌘/Ctrl+K crea un enlace en
lugar de abrir la paleta de comandos. En el Mac los atajos usan solo ⌘, así que
Ctrl+B, Ctrl+E y Ctrl+K siguen haciendo lo que hacen con ellos los campos de texto
de macOS. Con una distribución de teclado cuyas letras no son latinas, los atajos
siguen las teclas físicas B, I, E y K.

## Listas

**Enter** al final de un elemento de lista empieza el siguiente — la misma viñeta,
el número siguiente, un `- [ ]` vacío para una tarea — con la misma sangría. Enter
en un elemento sin nada tras su marcador termina la lista y quita el marcador.
Shift+Enter es un salto de línea normal.

## Menciones y referencias

Escribir **@** abre una lista corta de personas, que se reduce mientras escribes;
**#** lista pull requests e issues por número y título (`#42`, o `#búsqueda` para
una palabra del título). ↑ ↓ eligen, Enter o Tab insertan, Esc cierra la lista —
solo la lista, no el cuadro ni el diálogo que lo rodea.

La lista sale de lo que la app ya tiene, sin volver a preguntar al host:

| Cuadro | @ ofrece | # ofrece |
|---|---|---|
| Pull request | Su autor, revisores, asignados y todos los que comentaron | Las pull requests e issues abiertas del repositorio, tal como se cargaron en la barra lateral |
| Issue | Su autor, asignados y quienes comentaron | Lo mismo |
| Pull request nueva | Las personas que leen sus selectores de revisor y asignado, y los autores de las pull requests cargadas | Lo mismo |
| Issue nueva | Los autores de las pull requests e issues cargadas | Lo mismo |

Una **@** o **#** dentro de una palabra (una dirección de correo), el `#` de un
encabezado y todo lo que está dentro de código se dejan como están.

## Enviar

⌘/Ctrl+Enter envía desde cualquier cuadro: un comentario de pull request o de
issue, una respuesta en un hilo, un comentario de línea y la descripción de una
issue nueva. Funciona también desde las pestañas, la barra y la vista previa, no
solo desde el campo. Esc cancela un comentario de línea, desde los mismos sitios.
Una **respuesta en un hilo** es un
campo de una línea, para que una conversación larga no acumule una barra bajo
cada hilo: Enter envía, Shift+Enter añade una línea (el campo crece con ella, y
con un bloque pegado) y Esc descarta lo escrito, preguntando antes. No tiene
pestañas ni barra, pero los atajos de formato y el autocompletado de **@** /
**#** funcionan en él, y aparece un botón **Responder** en cuanto hay algo que
enviar.

## La chuleta

**Admite Markdown**, bajo cada cuadro, abre una chuleta en el sitio: cada formato,
qué escribir para obtenerlo y su atajo. Esc o un clic en otra parte la cierra. Nada
de lo que estás escribiendo se mueve.

Al pie, **Abrir la guía completa** abre esta página. El manual es una pestaña
propia, así que ir allí deja la página en la que está el cuadro, y el texto no
enviado se perdería: cuando lo hay — en este cuadro o en cualquier otro de la
página de la pull request —, la app pregunta antes. En los diálogos de pull request
nueva e issue nueva la chuleta no tiene ese enlace, ya que el manual se abriría
detrás del diálogo.

## Límites

- **Sin adjuntos.** Arrastrar un archivo o pegar una imagen en el cuadro no la
  sube: GitHub no tiene una API pública para adjuntos de comentarios, así que no
  hay dónde poner el archivo. Súbelo en la web y pega el enlace.
- **Solo quién y qué ya está cargado.** @ no busca entre los usuarios del host, y #
  no busca entre todas las issues — una persona que no ha participado en la
  conversación, o una issue cerrada que la barra lateral no leyó, no se ofrece.
  Aun así puedes escribir el nombre o el número completo.
- **Sin cambios sugeridos, respuestas guardadas ni selector de emojis.**
- **La vista previa es el renderizador de la app.** Muestra el Markdown como lo
  dibuja la app; el renderizado del host puede diferir en detalles (extensiones
  propias de GitHub, menciones convertidas en enlaces).
- **La vista previa es el dibujo de la app, no el del host.** En las páginas de pull
  request y de issue, la vista previa dibuja el texto como se mostrará en la app el
  comentario publicado ([cómo se muestran los comentarios](pull-requests.md#cómo-se-muestran-los-comentarios)):
  el mismo perfil estricto, los saltos de línea conservados, y una imagen de otro
  sitio esperando un clic. En GitHub, el comentario publicado lo dibuja luego GitHub,
  así que una extensión que la app no conoce puede verse distinta. Los diálogos de pull
  request nueva e issue nueva usan la vista previa de Markdown habitual de la app.
- Los atajos son fijos: no están en los ajustes de atajos y no siguen una
  reasignación hecha allí.
