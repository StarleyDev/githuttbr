---
title: Página de pull requests
category: Sincronizar y muchos repos
order: 57
summary: Todas las pull requests de un repositorio en una página — por estado, filtradas por autor, revisor, destino y CI —, ‹ › para recorrer la lista filtrada desde dentro de una PR, sus commits y comentarios en una línea de su diff.
keywords: pull requests lista página merge requests pr mr filtro autor revisor mías esperando mi revisión piden mi revisión ci fallando rama de destino borradores fusionadas cerradas búsqueda triaje anterior siguiente alt flecha navegación checkout ir a la rama de origen destino copiar nombre de la rama fetch comentario de línea comentario en línea comentario de revisión comentario en el diff comentar línea pestaña archivos revisión de código line comment pestaña commits lista de commits commits de la pr historial de commits abrir commit copiar sha traer la rama de la pr editor markdown barra de formato vista previa mención commits tab commit list open commit copy sha markdown editor toolbar preview mention árbol de archivos árbol de carpetas vista de árbol vista de rutas archivos vistos marcar carpeta como vista editar eliminar borrar editado errata file tree viewed files edit delete edited typo referencia título tarjeta al pasar el ratón work item AB# número de issue tooltip reference title hover card issue number
source: 729c0829d4ded79d157edea6c162fa638d7b41e0
---

# Página de pull requests

Un repositorio con mucho movimiento tiene veinte pull requests abiertas a la
vez. La barra lateral las lista, pero una línea por PR dice poco: de quién es
cada una, cuáles esperan por ti, cuáles se pusieron en rojo. Averiguarlo
significaba abrir cada una, leerla, volver, abrir la siguiente. La **página de
pull requests** responde esas preguntas en una sola pantalla y, una vez que abres
una pull request, **‹ ›** te llevan a la siguiente de la misma lista sin volver
atrás.

![La página de pull requests buscando «pix»: las coincidencias resaltadas, las tuyas marcadas con «tú», una CI fallando y un borrador](../../screenshots/pull-requests.webp)

## Abrirla

- El **icono de lista** en la cabecera **PULL REQUESTS** de la barra lateral
  (*Ver todas las pull requests*).
- *Pull requests…* en la paleta de comandos (⌘K), o **Herramientas → Pull
  requests…**.

Como la wiki y las [ejecuciones de CI](ci-runs.md), la página va en la pestaña
del repositorio.

## Pestañas

| Pestaña | Qué contiene |
|---|---|
| **Abiertas** | Todas las pull requests abiertas, borradores incluidos |
| **Borradores** | Solo las abiertas marcadas como borrador |
| **Fusionadas** | Pull requests fusionadas, leídas cuando abres la pestaña por primera vez |
| **Cerradas** | Cerradas sin fusionar (rechazadas, abandonadas), leídas junto con Fusionadas |

Los contadores junto a Abiertas y Borradores salen de la lista que la barra
lateral ya tiene. Fusionadas y Cerradas se piden solo cuando abres una de ellas,
y una vez por sesión; **Actualizar** las pide de nuevo.

## Filtros

| Filtro | Conserva |
|---|---|
| **Buscar** | Pull requests cuyo título, descripción, ramas o número contienen todas las palabras escritas. `#482` o `482` encuentra ese número; las coincidencias se resaltan en el título |
| **Autor** | Un autor — cada uno con cuántas tiene en esta pestaña. **Yo** va primero |
| **Revisor** | Un revisor solicitado, o **Piden mi revisión** |
| **Rama de destino** | Pull requests hacia esa rama |
| **Mías** | Un atajo para *Autor: Yo* |
| **Esperando mi revisión** | Un atajo para *Revisor: piden mi revisión* |
| **CI fallando** | Pull requests cuyos checks del head fallaron |

La línea bajo los filtros dice cuántas pull requests de la pestaña se muestran y
qué filtros están activos, con **quitar filtros** para quitarlos todos.

Los filtros se mantienen por repositorio **mientras la app está abierta** — sal
de la página, vuelve, y siguen como los dejaste. No se guardan entre reinicios a
propósito: un filtro «mías, CI fallando» que volviera en silencio una semana
después ocultaría pull requests que no pediste ocultar.

### Quién soy «yo»

«Yo» es la cuenta con la que las llamadas de este repositorio se identifican en
el host — el perfil al que el repositorio está [vinculado](profiles.md), o si no
el activo — preguntado al propio host. Cuando el token no puede decir de quién es
(sin scope de usuario), o no hay token, **Yo**, **Mías** y **Esperando mi
revisión** no se ofrecen.

## La lista

| Columna | Qué muestra |
|---|---|
| **#** | El número, con un icono de abierta, borrador, fusionada o cerrada |
| **Título** | El título, una insignia de *borrador* y a quién se le sigue pidiendo revisión — en el color de acento cuando eres tú |
| **Autor** | La foto del host cuando la da, si no la inicial, y **tú** en las tuyas |
| **Ramas** | Origen → destino |
| **Checks** | Los checks del head resumidos — `6/6`, `1 con fallos`, `2 en curso`; pasa el ratón para ver los números |
| **Actualizada** | Hace cuánto cambió por última vez; pasa el ratón para ver la fecha |

Las filas se ordenan por la actividad más reciente. Un clic abre la página propia
de la pull request ([Hosting y pull requests](hosting.md)). En un host sin esa
página, la fila abre la pull request en el navegador.

En un [checkout de un fork](hosting.md#tus-pull-requests-en-el-repositorio-original-de-un-fork), también se listan tus pull
requests en el repositorio original, marcadas *en owner/repo*.

## Recorrer la lista desde una pull request

![Una pull request abierta desde la lista filtrada: ‹ 1 de 4 › y los filtros de los que vino](../../screenshots/pull-request-nav.webp)

Una pull request abierta desde la página muestra una franja sobre su título:

- **← Pull requests** vuelve a la lista, con los filtros como los dejaste.
- **‹ k de n ›** pasa a la pull request anterior o siguiente de la lista desde la
  que la abriste — la lista filtrada, en su orden, tal como estaba cuando hiciste
  clic. Los tooltips nombran la pull request a la que lleva cada flecha.
- **Alt+← / Alt+→** hacen lo mismo desde el teclado. Se pueden reasignar en
  **Ajustes → Atajos**. Se hacen a un lado mientras el cursor está en un campo de
  texto (donde Option+← avanza por palabras) y mientras el terminal tiene el
  foco.

Moverse reemplaza la página en su sitio, así que recorrer diez pull requests no
deja diez iconos en la pestaña; abrir otra fila desde la lista también la
reemplaza.

Una pull request abierta **desde cualquier otro sitio** — la barra lateral, una
notificación — recorre las pull requests abiertas del repositorio en el orden
predeterminado de la página (Abiertas, sin filtros). Una que tampoco está en esa
lista, como un nivel fusionado de un stack, muestra solo el camino de vuelta a la
lista.

## Ir a la rama de una pull request

Para trabajar en una pull request necesitas su rama en checkout — y en un
repositorio con miles de ramas, encontrarla por nombre en la lista de ramas es la
parte lenta. En la página de una pull request, el campo **Ramas** lo hace por ti:

- **El nombre de la rama es un enlace.** Un clic hace checkout de esa rama y te
  lleva al grafo del repositorio, a la punta de la rama. La página de la pull
  request sigue abierta en la pestaña.
- **Una rama que solo existe en el servidor** se trae primero — esa rama, no el
  remoto entero — y se hace checkout como rama local que la sigue. Una rama que ya
  tienes en local se cambia tal como está — no se actualiza, así que haz pull
  cuando quieras los últimos commits de la pull request.
- **La rama en la que ya estás** aparece marcada como *actual*. No se hace
  checkout de nada.
- **El botón de copiar** junto a cada nombre lo pone en el portapapeles.
- **Deshacer** (⌘Z) vuelve a la rama en la que estabas y borra la rama local que
  creó el checkout — salvo que hayas hecho commit en ella desde entonces, en cuyo
  caso se deja tal cual.

La cabecera tiene los mismos dos pasos como botones: **Ir a la rama de origen** e
**Ir a la rama de destino**. Funcionan también con la rama en la que ya estás —
simplemente te llevan al repositorio. Con los [colores de los iconos](themes.md#colores-de-los-iconos) activados, cada botón de la cabecera tiene el suyo: actualizar azul, revisión con IA violeta, vista previa turquesa, rama de origen verde, rama de destino naranja (abrir en el navegador sigue gris).

No se consulta nada hasta que haces clic: abrir una pull request no lee ni trae
ninguna rama.

Lo que no hace:

- **La rama de origen de un fork** vive en otro repositorio, así que no tiene
  enlace (el botón de copiar se queda). **Previsualizar pull request en local…**,
  ofrecido justo debajo, es la forma de ejecutarla aquí. La rama de destino sigue
  enlazada.
- **Sin remoto que coincida.** La rama se busca en el remoto cuya URL es el
  repositorio de la pull request. Cuando ningún remoto configurado apunta ahí, el
  enlace no hace nada y su tooltip dice por qué.
- **Una rama borrada.** Una pull request fusionada a menudo se llevó su rama
  consigo; el fetch dice entonces que la rama ya no existe en el remoto, y te
  quedas en la pull request.
- **Cambios locales.** Hacer checkout no es destructivo, así que no hay
  confirmación — y git rechaza el checkout cuando tus cambios sin commit se
  sobrescribirían. El error dice qué archivos; haz commit o stash de ellos y
  vuelve a hacer clic.
- **Esta ventana.** El checkout ocurre en el árbol de trabajo de este
  repositorio. Cuando la rama ya está en checkout en otro
  [worktree](worktrees.md), se abre en su lugar la pestaña de ese worktree.

## Commits

La barra lateral decía cuántos commits tiene una pull request, nunca cuáles.
Revisar un commit cada vez — como se supone que se leen la mayoría de las pull
requests — te mandaba al navegador. La pestaña **Commits**, entre Conversación y
Archivos, los lista:

- **Los más antiguos primero**, en el orden en que se aplican, agrupados bajo el
  día en que se escribieron. Un commit rebasado fuera del orden de fechas empieza
  un día propio en lugar de moverse.
- Cada fila tiene la foto del autor (cuando el host la da), el asunto, el autor,
  hace cuánto y el SHA corto. Una insignia **merge** marca un commit con dos
  padres, cuando el host lo indica.
- **▸** junto a un commit con algo más que el asunto muestra el resto de su
  mensaje.
- **Copiar** pone el SHA completo en el portapapeles; **Abrir en el navegador**
  abre el commit en el host — dentro de la pull request cuando el host tiene esa
  página (GitHub, GitLab, Bitbucket Data Center), si no en la página de commits
  del repositorio.

![La pestaña Commits: los commits de una pull request agrupados por día, uno con su mensaje completo abierto](../../screenshots/pr-commits.webp)

**Haz clic en una fila** — o llega a ella con Tab y pulsa Enter — para abrir el
commit en la app, como lo haría un clic en el grafo: la vista del repositorio,
ese commit seleccionado, sus detalles abiertos. Eso funciona cuando este clon
**tiene** el commit. Cuando no, la fila lo dice en lugar de fallar en silencio, y
ofrece:

- **Traer la rama del PR para verlo** — el mismo fetch de una sola rama que
  [ir a la rama](#ir-a-la-rama-de-una-pull-request), sin el checkout. Si el commit llegó con ella, se
  abre; si no (un force push lo reescribió desde entonces), el aviso lo dice.
- **Abrir en el navegador**, para cuando traer la rama no es una opción.

La lista se lee la primera vez que abres la pestaña, no con la página, y de nuevo
con cada **Actualizar**. Hasta que llega, el número de la pestaña es el que el
host dio para la pull request. Las pull requests fusionadas y cerradas listan sus
commits igual.

Lo que no hace:

- **Como mucho 250 commits.** El propio GitHub no lista más de 250 para una pull
  request; la app se detiene en el mismo número en todos los hosts, y dice *el
  host tiene más* cuando es así, con un enlace a la pull request en el host. Qué
  250 son depende del orden en que el host los lista — la app se queda con los
  primeros listados, y la línea sobre la lista dice cuáles:

  | Host | Una pull request más larga muestra |
  |---|---|
  | GitHub | Los **primeros** 250 (el límite del propio GitHub) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | Los **250 más recientes** |
  | Forgejo | El extremo que el servidor liste primero; su orden no está documentado |
- **La rama de un fork** no se puede traer desde aquí — vive en otro repositorio —,
  así que un commit que solo está en el fork ofrece únicamente el navegador.
  **Previsualizar pull request en local…** es la forma de traerlo.
- **Una rama borrada.** Una pull request fusionada a menudo se llevó su rama: el
  fetch lo dice. bitbucket.org no lista ningún commit en cuanto la rama de origen
  desaparece.
- **Fusiones squash.** Los commits de una pull request fusionada con squash nunca
  llegaron a la rama de destino, así que tras borrar su rama solo están en el host.
- **Los autores** se nombran como los nombran sus commits. GitLab, Azure DevOps y
  Bitbucket Data Center no dan foto sin un inicio de sesión que una imagen no puede
  enviar, así que esas filas muestran la inicial.
- **Los mensajes largos en Azure DevOps** pueden salir recortados: la lista de Azure
  trunca el mensaje de un commit, y la app muestra lo que envía.
- Las pull requests de **bitbucket.org** se abren en el navegador — la app aún no
  tiene página para ellas —, así que ahí no se llega a esta pestaña, aunque la app
  puede leer la lista.

## Leer los archivos

Una pull request de doscientos archivos es difícil de leer como doscientas rutas
completas. La lista de la pestaña **Archivos** tiene el mismo selector **Ruta /
Árbol** que el panel de commit, y la elección es la misma en toda la app. En
**Árbol**, los archivos quedan bajo sus carpetas (una cadena como `src/main/ipc` es
una sola fila), y cada carpeta muestra su **+/−** sumado y cuántos de sus archivos
están vistos (*3/5*). La casilla de una carpeta marca como vistos todos los archivos
de dentro, o los desmarca todos; las marcas se guardan solo en este equipo, nunca se
envían al host. Una marca recuerda la versión del diff del archivo: cuando un push
cambia un archivo visto, vuelve a aparecer como no visto, con un punto amarillo
(*Cambió desde que lo viste*). Un archivo sin diff (binario, demasiado grande) se
compara solo por su estado y sus recuentos de líneas. Un archivo con conversaciones de revisión muestra a su lado un número en un bocadillo (las carpetas suman los suyos), para que los que tienen comentarios destaquen en una lista larga; las conversaciones obsoletas también cuentan. Haz clic en una carpeta, o
pulsa ←/→ sobre ella, para plegarla; ↑/↓ (o j/k) recorren los archivos en pantalla y
abren cada diff. Las carpetas plegadas se recuerdan por pull request hasta que se
cierra la app, y un archivo abierto dentro de una despliega el camino hasta él. El
árbol se ordena por nombre, no en el orden en que el host lista los archivos.

![La pestaña Archivos en vista de árbol: carpetas con sus cambios sumados y recuentos de vistos, una plegada](../../screenshots/pr-files-tree.webp)

## Comentar una línea

Aquí ya se podía responder a un hilo de revisión, pero no empezar uno, así que una
revisión de verdad seguía mandándote al navegador. En la pestaña **Archivos** de una
pull request, cualquier línea del diff admite un comentario propio:

- **Pasa el ratón por una línea** y pulsa el **+** que aparece sobre su número, o
  **haz clic en la propia línea** (un clic que termina una selección de texto, o un
  doble clic que selecciona una palabra, no cuenta: eso es leer). El menú del botón
  derecho — o la tecla de menú contextual del teclado — también tiene *Comentar en
  la línea N*.
- Se abre un cuadro **bajo esa línea**. Escribe y luego **Comentar** — o
  ⌘/Ctrl+Enter. **Cancelar** lo cierra; **Esc** también, preguntando antes si ya
  escribiste algo. En ambos casos el foco vuelve a esa línea.
- Si sale bien, el hilo nuevo aparece **bajo su línea**, y en los hilos de revisión
  de la pestaña Conversación, donde lo verán los demás.

![Un comentario escribiéndose bajo una línea cambiada, con un hilo anterior bajo su propia línea](../../screenshots/pr-line-comment.webp)

El lado en que queda el comentario depende de la línea:

| Línea | Anclado a |
|---|---|
| **Añadida** (verde) | La versión nueva del archivo, en su número nuevo |
| **Borrada** (roja) | La versión antigua, en su número antiguo |
| **Sin cambios** | La versión nueva (a GitLab se le envían ambos números, como exige) |

Los hilos existentes también se dibujan bajo sus líneas, con su cuadro de respuesta
donde el host deja a la app responder dentro de un hilo (Forgejo no). Un hilo solo
se dibuja en una línea cuando el host dice que aún pertenece al diff mostrado; lo
demás se queda en la pestaña Conversación, en vez de en una línea adivinada:

| Host | Un hilo escrito antes del último push |
|---|---|
| GitHub | Obsoleto cuando su línea cambió: solo Conversación |
| GitLab | Escrito sobre un head anterior: solo Conversación |
| Azure DevOps | Azure lo sigue hasta donde está ahora su línea |
| Bitbucket Data Center | Huérfano cuando su línea ya no está: solo Conversación |
| Forgejo | Forgejo no indica que un comentario esté obsoleto, así que se dibuja en el número de línea guardado — tras un push esa línea puede contener ahora otro código |

Un comentario en una línea fuera de los hunks mostrados está solo en la pestaña
Conversación, en todos los hosts.

Un comentario escrito y no enviado cuenta como texto sin enviar: **‹ ›** y Alt+flechas
preguntan antes de dejarlo, como con el cuadro de comentario principal. Mirar otro
archivo lo conserva; para empezar uno en otra línea, publica o cancela el primero.

Lo que no hace:

- **Una línea, publicada al momento.** No hay rangos de líneas, ni revisión
  pendiente en la que juntar comentarios para enviarlos después, ni cambios
  sugeridos. Cada comentario se publica en cuanto lo envías, como hilo propio (en
  Forgejo, como una revisión que contiene ese único comentario, ya que Forgejo no
  tiene una llamada para un comentario suelto).
- **El diff que estás mirando.** La pestaña Archivos recuerda en qué commit (en Azure
  DevOps, en qué iteración) se leyó su diff, y el comentario se envía contra ese.
  Cuando la pull request ha avanzado desde entonces — un push, una nueva base de
  merge —, el comentario no se publica en la línea que ahora tenga ese número: se
  rechaza con *la pull request cambió desde que se cargó este diff*, y
  **Actualizar** muestra el diff nuevo. En GitHub, en cambio, el comentario se
  publica contra el commit que leíste, y GitHub lo marca como obsoleto si esa línea
  cambió. Una línea que el host siga sin aceptar se rechaza por estar fuera del diff.
- **Rechazado.** Sin permiso para comentar (un token de solo lectura, una cuenta a
  la que el repositorio no deja comentar), el host lo rechaza y el mensaje dice que
  ese es el motivo.
- Las pull requests de **bitbucket.org** se abren en el navegador — la app aún no
  tiene página para ellas —, así que ahí un comentario de línea se sigue haciendo en
  la web.
- **Un archivo sin diff** (binario, o demasiado grande para que el host lo incluya)
  no tiene líneas que comentar.

## Escribir comentarios

Cada cuadro de la página — el comentario de abajo, una respuesta dentro de un
hilo, un comentario en una línea — es el mismo editor de Markdown: pestañas
**Escribir / Vista previa**, una barra de formato con los atajos de GitHub, listas
que continúan con Enter y autocompletado con **@** / **#** a partir de las
personas y pull requests que ya están en pantalla. Un cuadro de respuesta muestra
sus herramientas en cuanto haces clic en él, y envía con ⌘/Ctrl+Enter, ya que
Enter ahora empieza una línea nueva. [Escribir comentarios](writing-comments.md)
tiene los detalles y los límites.

## Editar y eliminar tus comentarios

Una errata en un comentario ya enviado, o una observación que ya no aplica, antes
obligaba a ir al navegador. Tus propios comentarios tienen ahora **Editar** (el
lápiz) y **Eliminar** (la papelera) al final de su cabecera: comentarios de la
conversación, comentarios de hilos de revisión y respuestas, en las pestañas
Conversación y Archivos. La página de la issue también los tiene, para sus
comentarios en GitHub y Forgejo.

![Tu propio comentario, marcado como editado, con Editar y Eliminar al final de su cabecera](../../screenshots/comment-editor.webp)

Qué es «tuyo» lo decide la propia página, que pregunta al host, cada vez que carga,
con qué cuenta se identifican las llamadas de este repositorio (su perfil vinculado,
no el que esté activo). La mayoría de los hosts nombran a un autor por su login,
comparado sin distinguir mayúsculas. Azure DevOps nombra a los autores por nombre
visible, que dos personas pueden compartir, así que ahí el id del autor del
comentario debe coincidir con el id de la cuenta; si falta cualquiera de los dos, ningún
comentario muestra las acciones. Cuando la app no puede saber quién eres (un token
sin scope de usuario, o el host no respondió), tampoco las muestra ningún
comentario; **Actualizar** vuelve a preguntar. El host sigue decidiendo: a una cuenta
a la que no deja cambiar un comentario se le rechaza, y el mensaje lo dice.

- **Editar** abre el comentario en su sitio, en el mismo editor de Markdown, con su
  texto tal como se escribió. **Guardar** (o ⌘/Ctrl+Enter) lo envía; **Cancelar** o
  **Esc** lo cierra, preguntando antes si cambiaste algo. Solo se quitan las líneas
  en blanco alrededor del texto: el código sangrado y un salto de línea final de dos
  espacios se quedan como se escribieron. El texto nuevo aparece al instante y la
  página vuelve a leer la pull request. En la página de la pull request, una edición
  sin guardar cuenta como texto sin enviar: **‹ ›** preguntan antes de dejarla. La
  página de la issue no tiene esas flechas, y allí nada pregunta antes de que se
  cierre su pestaña.
- **Eliminar** siempre pregunta antes, y la pregunta dice qué pasa: el servidor
  elimina el comentario para todos, y no se puede deshacer. No hay entrada de
  deshacer, ya que nada puede recuperarlo.

Eliminar el **primer comentario de un hilo** que tiene respuestas (un hilo de
revisión, o un comentario de la conversación que otros respondieron) varía según el
host, y la confirmación dice cómo. Dos de estos casos no están documentados por el
host, y se dice:

| Host | Primer comentario de un hilo con respuestas |
|---|---|
| GitHub | Las respuestas deberían quedarse; la documentación de GitHub no lo dice. Responder a ese hilo desde la app ya no es posible: sus respuestas apuntan a un comentario que ya no existe, y la API no acepta respuestas a una respuesta. El hilo ofrece entonces **Responder en GitHub** |
| GitLab | Solo se va esa nota; el hilo y sus respuestas se quedan |
| Azure DevOps | Debería marcarse como eliminado y ocultarse, conservando el hilo y sus respuestas; la documentación de Azure no lo dice |
| Bitbucket Data Center | Rechazado: Data Center no elimina un comentario que tiene respuestas. Elimina primero las respuestas, o edítalo en su lugar |

Algunos hosts marcan un comentario como **editado**. Solo Azure DevOps guarda una
fecha para el texto en sí; en GitHub, Bitbucket Data Center y Forgejo la app compara
cuándo se creó el comentario y cuándo se actualizó por última vez, así que ahí la
marca es una aproximación (cualquier otra cosa que toque el comentario puede
ponerla). La fecha de GitLab también cambia cuando se resuelve un hilo, así que no se
usa.

Lo que no hace:

- **Los comentarios de revisión de Forgejo** (comentarios en una línea) no se pueden
  editar a través de su API, y solo algunas versiones pueden eliminarlos, así que no
  muestran ninguna de las dos acciones: cámbialos en la web. Los comentarios de la
  conversación funcionan como en los demás hosts.
- **Alguien lo cambió mientras tanto.** Bitbucket Data Center comprueba la versión
  del comentario: una edición o eliminación de un comentario que cambió desde que se
  cargó la página se rechaza, y **Actualizar** muestra el actual. Los demás hosts se
  quedan con la última escritura.
- **No encontrado**: cuando el host no encuentra el comentario, el mensaje dice que
  puede haberse eliminado, o que esta cuenta no puede verlo, y la página vuelve a
  leer la pull request. Una edición abierta sobre un comentario que ya no existe se
  descarta.
- Las pull requests de **bitbucket.org** se abren en el navegador, así que aún no hay
  página donde editar sus comentarios, aunque la app pueda hacer la llamada.
- **La descripción** de la pull request y los resúmenes de sus revisiones no son
  comentarios, y no se editan aquí.

## De qué trata un `#123` o `AB#123`

Un commit que dice *fixes AB#4821* o un comentario que dice *ver #312* te da un
número, no de qué se trataba. Averiguarlo significaba abrirlo. Ahora, **señalar una
referencia** — o llegar a ella con Tab — abre una pequeña tarjeta con lo que el host
dice de ella:

- un icono de su tipo, y la referencia tal como está escrita;
- su **título**;
- su **estado** (abierta, cerrada, fusionada — en Azure DevOps, el estado propio del
  work item, como *Active* o *Resolved*);
- en Azure DevOps, el **tipo de work item** (Bug, User Story, Task…).

![La tarjeta sobre una referencia a un work item en un comentario: su tipo, título y estado](../../screenshots/reference-card.webp)

Las tarjetas están en la página de la pull request (descripción, comentarios, hilos
de revisión y el mensaje completo de un commit en la pestaña **Commits**), en la
página de la issue y en el asunto del panel de detalles del commit. En la pestaña
**Commits** en Azure DevOps, cada work item del asunto de un commit (`AB#123`, o
`#123`, el mismo elemento allí) muestra además su título al lado, en gris. En Azure
DevOps, `!123` enlaza a esa pull request, sin tarjeta.

| Referencia | Host | Se lee de |
|---|---|---|
| `AB#123`, y `#123` en un repositorio de Azure | Azure DevOps | Work items, hasta 200 en una petición |
| `#123` | GitHub, GitHub Enterprise Server | Issues (que también responde por las pull requests), una petición por cada una, de una en una |
| `#123` / `!123` | GitLab | Issues / merge requests, una petición por tipo |
| `#123` | Forgejo | Issues (también pull requests), una petición por cada una, de dos en dos |

Un `#123` solo cuenta como palabra propia: `org/repo#123` (otro repositorio),
`&#39;`, un color como `#123abc` y el `#issuecomment-…` de un enlace se dejan como
están.

No se pregunta nada hasta que se abre una tarjeta. Entonces la referencia en la que
estás y las más cercanas de la página que aún no se conocen van en una sola llamada,
así que la siguiente tarjeta suele ser instantánea. Las respuestas se guardan en
memoria mientras la app está abierta, nunca en disco, durante cinco minutos; después
se siguen mostrando y se vuelven a leer al pasar el ratón de nuevo. Se guardan por
perfil: la llamada se hace como el perfil al que el repositorio está
[vinculado](profiles.md), y otro perfil puede ver otros elementos.

Lo que cuesta:

- **GitHub y Forgejo** no pueden leer varias issues en una petición, así que cada
  tarjeta cuesta una. Pasar el ratón pide como mucho **10** — la que señalas y sus
  vecinas — y en GitHub una tras otra, como GitHub pide a las apps. La primera
  respuesta que dice *más despacio* (un 429 o un 403) detiene el resto, y esas
  referencias no se vuelven a pedir durante cinco minutos.
- **Azure DevOps** lee hasta 200 work items en una petición, y GitLab una petición
  por tipo, así que ahí va toda la página de una vez.

Lo que no hace:

- **Bitbucket** no tiene tarjeta: la app no lee issues allí, y el enlace abre el
  navegador como antes.
- **No encontrada, o sin acceso.** Una issue borrada, un work item de un proyecto que
  esta cuenta no puede ver, o un token de Azure sin el scope *Work Items (Read)* se
  ven igual: la tarjeta lo dice, y el enlace sigue funcionando. Un host que limita
  peticiones, no responde o no tiene cuenta en este perfil tiene su propio mensaje.
- **`AB#123` fuera de Azure DevOps** — en un repositorio de GitHub conectado a Azure
  Boards — no se enlaza, así que no tiene tarjeta: la app no sabe a qué organización
  pertenece.
- **El estado fusionada en GitHub Enterprise Servers antiguos** que no envían cuándo
  se fusionó una pull request: se ve como cerrada.
- Las filas de commits **del grafo** no muestran tarjetas.

## Límites

- **Las pull requests abiertas son la lista de la barra lateral.** GitHub, GitLab
  y bitbucket.org leen las primeras 30; un repositorio con más muestra solo esas,
  y el contador de Abiertas dice **30+**. Azure DevOps, Bitbucket Data Center y
  Forgejo las leen todas.
- **Fusionadas y cerradas tienen tope**, y la pestaña muestra **+** cuando el host
  tiene más (su web las lista todas):

  | Host | Qué se lee |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | Las 100 actualizadas más recientemente, fusionadas y cerradas **juntas** |
  | GitLab | Las 100 actualizadas más recientemente de cada una |
  | Bitbucket Data Center | 100 de cada una en el orden *newest* del servidor — su API no dice si eso significa abiertas o actualizadas |
  | Azure DevOps | 100 de cada una entre las que terminaron en el **último año**; su API no indica orden, así que pasado el centenar cuáles entran lo decide el servidor |

  Sus checks no se leen — la CI de una pull request terminada no decide nada, y
  costaría una petición por fila — así que **CI fallando** no se aplica en esas
  pestañas (su chip se oculta ahí).
- **Sin cuenta**: sin un token que llegue al host, Fusionadas y Cerradas lo dicen
  en lugar de mostrar una lista vacía (GitHub aún puede leer un repositorio
  público).
- **Checks**: GitHub y Bitbucket Data Center los traen en la lista. A GitLab,
  Azure DevOps y Forgejo se les pregunta una vez por head al abrir la página, a
  través de la misma caché que las insignias de CI del grafo. bitbucket.org no
  tiene.
- **Revisores**: GitHub, GitLab, Forgejo, Bitbucket Data Center y Azure DevOps
  nombran a quién se le sigue pidiendo (Azure: una persona que no ha votado; un
  equipo queda fuera). La lista de bitbucket.org no lo dice, así que ahí el filtro
  de Revisor está vacío.
- **La búsqueda en la descripción** funciona donde la lista del host trae la
  descripción; bitbucket.org puede omitirla, y entonces solo se buscan títulos,
  ramas y números.
- **«Yo» en bitbucket.org y Azure DevOps** se compara por nombre visible, ya que
  así es como sus listas nombran a un autor.
- **Actualizada en Azure DevOps** es cuando se abrió (o cerró) la pull request:
  su lista no tiene hora de última actividad.
- El recorrido se recuerda mientras la app está abierta; tras un reinicio, una
  pull request abierta desde la lista recorre en su lugar las pull requests
  abiertas.
