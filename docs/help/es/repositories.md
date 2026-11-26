---
title: Repositorios
category: Sincronizar y muchos repos
order: 52
summary: Todos los repositorios que GitHuttBr conoce, abiertos o no, en una lista buscable.
keywords: repositorios registro todos los repos favoritos destacados recientes escanear carpeta explorar buscar abrir gestionar gestión de repositorios color sección tinte resaltar espacios de trabajo desde carpetas árbol generar importación masiva repositories registry favourites starred recent scan folder workspaces
source: 6a9c51bf47eebb0f97be71324460cd15c50b0855
---

# Repositorios

El [centro de control](mission-control.md) responde "¿cuál de mis repositorios
abiertos me necesita?". Solo conoce las pestañas del espacio de trabajo activo.
Repositorios responde otra pregunta: **¿dónde está ese repo, y está abierto
en algún sitio?** Cubre todo lo que GitHuttBr ha visto alguna vez: cada espacio
de trabajo, cada pestaña, y lo que encuentre al escanear las carpetas que le
señales.

![La página Repositorios: secciones de color para repositorios abiertos,
favoritos, recientes y de espacios de trabajo, cada fila con nombre, dueño,
rama y estado de trabajo](../../screenshots/repositories.webp)

## Las secciones

Un repositorio puede aparecer en **más de una sección**. A propósito: cada
sección es una respuesta completa a su propia pregunta, no un trozo de una
lista única.

| Sección | Qué hay en ella |
|---|---|
| Repositorios abiertos | Cada pestaña del espacio de trabajo activo ahora mismo |
| Favoritos | Repositorios con estrella, en todos los espacios de trabajo |
| Repositorios recientes | Todo lo que has abierto, lo más nuevo primero. **Sin tope**, a diferencia de la lista de 8 entradas del lanzador |
| Una por espacio de trabajo guardado | Las pestañas de ese espacio, para saltar a otro sin cambiarte a él antes |
| Todos los repositorios | Cada repositorio que el registro conoce, abierto o no |

La barra sobre la lista es una sola tira: **Contraer todo** y **Expandir todo**,
luego un campo de búsqueda que ocupa el resto del ancho, y el interruptor del
resumen WIP.

La búsqueda filtra filas en todas las secciones a la vez, y **oculta las
secciones que no coinciden** para que los resultados no queden enterrados bajo
un muro de encabezados vacíos. Coincide el nombre del repositorio, su alias, su
dueño o cualquier trozo de su ruta. Si no coincide nada en ningún sitio, la
página lo dice en vez de quedarse en blanco.

Con el recuadro vacío se muestran todas las secciones, aunque no tengan nada:
"Favoritos 0" te dice que la sección existe y está vacía, y eso conviene
saber. Solo estorba cuando ya estás buscando.

### Colores de sección

Las secciones llegan **ya coloreadas**. Cada encabezado recibe su propio tinte
de la paleta estándar, incluido un espacio de trabajo nuevo en el momento en
que aparece. El punto es orientarte, no decorar: con una sección por proyecto
y cinco secciones fijas encima, una lista larga deja de decirte dónde estás, y
un tinte hace reconocible un encabezado antes de leerlo.

Para cambiar uno, usa el **⋮** de su encabezado: **Cambiar color…** abre el
mismo [selector de color](workspaces.md) que usan las pestañas de grupo y las
carpetas, diez muestras fijas más un valor hex libre. **Restablecer color**
aparece cuando has anulado una sección, y la devuelve a su valor por defecto.

Tres cosas que conviene saber:

- La asignación es **estable, no aleatoria**. Las mismas secciones reciben los
  mismos colores en cada arranque, y añadir un espacio de trabajo nunca
  recolorea las de arriba. Solo se guardan los colores que cambias.
- El color es **local a esta página**. Teñir aquí la sección de un espacio no
  dice nada de ese espacio en el resto de GitHuttBr. El color de su pestaña es
  otro ajuste.
- El color se **mezcla** a un porcentaje bajo de la superficie en vez de
  aplicarse a plena potencia, así que un tinte saturado sigue siendo un fondo
  legible en temas claros y oscuros. Un color muy pálido se verá casi neutro.

Con más de diez secciones la paleta se repite, así que dos encabezados pueden
compartir tinte.

## Qué hace que un repositorio sea conocido

Aquí hay una fila cuando GitHuttBr lo ha **abierto** en algún momento, o lo ha
encontrado bajo una **carpeta de escaneo**. Nada se indexa solo por existir en
disco en un sitio del que nunca le hablaste.

Abrir esta página también indexa lo que tienes **abierto en una pestaña**, y
así los repositorios restaurados al arrancar reciben una fila sin que tengas
que reabrirlos. Solo cubre pestañas abiertas, y ocurre en la primera visita de
cada sesión, no una sola vez para siempre. Un repositorio que **Olvidas**
sigue olvidado salvo que lo abras otra vez.

Las carpetas de escaneo se configuran en Ajustes → Datos, o en el diálogo
**Repositorios escaneados** de más abajo:

- **Profundidad** es cuántos niveles de directorio baja el escaneo bajo la raíz
  (por defecto 3, tope 10).
- El escaneo **se detiene en un repositorio**. Un checkout empaquetado o un
  submódulo dentro de un repo no se indexa como fila propia.
- Nunca entra en directorios que empiezan por punto, y se salta `node_modules`
  y carpetas de dependencias parecidas.
- **Sigue las carpetas enlazadas con symlinks**, y recorre cada carpeta real
  una sola vez — un enlace que vuelve hacia arriba en el árbol no puede crear un
  bucle, y dos enlaces a un mismo repositorio lo listan una vez. Un repositorio
  encontrado a través de un enlace se lista por su **ruta real**, así que es la
  misma entrada (y la misma pestaña) que cuando lo abres desde el selector.
- **Solo lee nombres de carpeta**: encontrar un directorio `.git` es lo que
  convierte algo en repositorio aquí. Nombre, dueño y rama salen de archivos
  dentro de `.git` (`HEAD`, la config), nunca ejecutando `git`.
- Se ejecuta **cuando lo pides**: al añadir una carpeta, con **Escanear ahora**
  o al abrir el diálogo Repositorios escaneados. Un repositorio clonado más tarde
  en una carpeta de escaneo aparece en la siguiente de esas ocasiones, o en
  cuanto lo abres.
- El resultado nombra **cada repositorio encontrado y cuántos eran nuevos**. Un
  segundo escaneo de las mismas carpetas los vuelve a nombrar todos, con «0
  nuevos» — ya estaban en esta página.
- Una carpeta solo se puede añadir **una vez**. Elegir una que ya está en la
  lista lo dice y no cambia nada; una barra final o, en Windows, otras
  mayúsculas siguen siendo la misma carpeta.

## Repositorios escaneados

Esta página responde a «¿dónde está ese repositorio?» entre todo lo que GitHuttBr
conoce. Cuando solo quieres **abrir** algo de tus carpetas de proyectos, la
ventana **Abrir repositorio** — y la pantalla de bienvenida — tiene un camino
más corto: **Repositorios escaneados**.

![El diálogo Repositorios escaneados: las carpetas escaneadas contraídas arriba, un filtro y luego
 los repositorios de la carpeta con una casilla y su rama, dos marcados y el botón Abrir contándolos](../../screenshots/scanned-repos.webp)

- Los repositorios se **agrupan por carpeta escaneada**, ordenados por nombre,
  con un filtro por nombre o ruta.
- **Marca varios** y pulsa **Abrir**, o haz **doble clic** en uno. Desde un
  grupo — su lanzador, o la página con la que se abre un grupo nuevo — el botón
  dice **Añadir al grupo**, y vuelves a donde estabas.
- Abierto desde **Abrir repositorio**, el diálogo tiene una flecha **Atrás**
  junto al título — igual que **Clonar** y **Crear** — para que un clic
  equivocado vuelva a Abrir repositorio sin cerrar nada.
- Un repositorio que ya está abierto en una pestaña — o que ya está en ese
  grupo — aparece en la lista pero atenuado, para que la cuenta de la carpeta
  siga cuadrando.
- Abrir el diálogo **vuelve a escanear las carpetas** primero, así que un clon
  recién hecho ya está ahí sin pasar por Ajustes.
- **Carpetas escaneadas**, arriba, es el mismo editor que en Ajustes: añade una
  carpeta, quita una, cambia su profundidad. Empieza desplegado cuando aún no hay
  ninguna carpeta, porque una lista vacía sería si no un callejón sin salida.

Sus límites: un repositorio bajo dos carpetas que se solapan aparece una sola
vez, bajo la carpeta más profunda. Una carpeta que ha desaparecido desde
entonces se omite — no se puede abrir. Quitar una carpeta escaneada oculta aquí
sus repositorios, pero no los **Olvida** en esta página.

## Filas

Las filas van en columnas: estrella, nombre (respeta el alias si lo has
renombrado), dueño (sacado de la URL del remoto origin), chip de rama, resumen
WIP y acciones. Las columnas las **comparte toda la página**, no se dimensionan
por sección, así que un nombre en la última sección alinea bajo el de la
primera y la lista se lee como tabla, no como pila.

Las acciones del final se muestran en reposo, no al pasar el ratón: **abrir en
una pestaña**, y un **⋮** que abre el mismo [menú contextual del
repositorio](repo-menu.md) que un clic derecho. Ese menú es el de todo
GitHuttBr, ampliado con dos entradas propias de esta página:

| Acción | Qué hace |
|---|---|
| Estrella / quitar estrella | Añade o quita el repositorio de Favoritos |
| Ubicar… | Reapunta una carpeta movida o renombrada. El alias, el perfil vinculado, la estrella y cualquier pestaña que lo muestre se conservan. Si el destino ya tenía sus propios ajustes, **gana el destino** |
| Olvidar | Quita la entrada de esta lista. **Nunca toca la carpeta en disco** |

Un repositorio cuya carpeta ya no existe se muestra como **ausente**, con
**Ubicar…** y **Olvidar** en línea en lugar de las acciones habituales.

### Cuando falta la carpeta de una pestaña abierta

Las pestañas se restauran al arrancar a partir de las rutas que tenían cuando
cerraste. Si desde entonces una carpeta se ha movido, se ha borrado o está en un
disco que no está conectado, cada lectura que GitHuttBr hacía sobre ella fallaba
con su propio aviso de error. Ahora se comprueba primero la carpeta, y la
pestaña muestra **No se encontró la carpeta del repositorio** con la ruta
guardada en lugar del espacio de trabajo habitual:

![Una pestaña restaurada cuya carpeta falta: la tarjeta No se encontró la
carpeta del repositorio con la ruta guardada y sus botones Ubicar… y Reintentar](../../screenshots/missing-repository.webp)

| Botón | Qué hace |
|---|---|
| Ubicar… | Elige la nueva ubicación de la carpeta. Tiene que ser un repositorio Git; la pestaña, el alias, el perfil vinculado y la estrella pasan a ella |
| Reintentar | Vuelve a comprobar la misma ruta — para un disco o una carpeta de red que ha vuelto |

La pestaña se **conserva** hasta que la reconectas o la cierras tú: que falte un
disco externo suele ser temporal, y perder la pestaña por ello sería peor que un
marcador discreto. Mientras falta la carpeta, el fetch automático en segundo
plano se la salta.

Límites: GitHuttBr no busca adónde fue una carpeta — Ubicar… te lo pregunta. Una
carpeta que existe pero ya no es un repositorio muestra en su lugar el aviso
habitual **No es un repositorio Git**.

La estrella es un interruptor de favorito, no una casilla de selección masiva.
El trabajo por lotes aquí es por sección, no por selección. Véase más abajo.

## Convertir un árbol de carpetas en espacios de trabajo

Tu carpeta de código ya codifica el agrupado que quieres. Si `~/Code` tiene
`client-a`, `client-b` y `personal`, esos son contextos entre los que cambias,
y un [espacio de trabajo](workspaces.md) es exactamente eso, con su propia
tira de pestañas.

**Añadir carpeta de escaneo…** ofrece construirlos. Tras indexar lo
encontrado, un diálogo lista las carpetas **directamente dentro** de la que
elegiste, con cuántos repositorios tiene cada una. Marca las que quieras. Cada
una se convierte en un espacio de trabajo con **una pestaña por repositorio**.

| Fila | Significado |
|---|---|
| Un nombre de carpeta y un recuento | Marcada por defecto. Se convierte en espacio de trabajo |
| "{n} nuevos, se fusionan en …" | Ya existe un espacio para esta carpeta. Solo se añaden los repositorios nuevos |
| "Ya está en un espacio de trabajo" | Nada que hacer, en gris en vez de oculto |
| El nombre de la raíz | Repositorios sueltos en la carpeta que elegiste, no en una subcarpeta. Desmarcada por defecto |

Un repositorio se archiva bajo la **primera carpeta bajo la raíz**, por
profundo que esté: `~/Code/client-a/nested/app` va a `client-a`. Las carpetas
sin repositorios no se ofrecen.

**No se crea nada hasta que confirmas**, y cancelar deja el indexado del
escaneo en su sitio. Los repositorios quedan conocidos de cualquier modo, que
es lo que hacía este botón antes.

### Escanear de nuevo más tarde

Se puede repetir sin miedo. Un segundo escaneo **añade y nunca quita**:

- Los repositorios nuevos se añaden al espacio de trabajo que corresponde.
- Los que moviste, renombraste o quitaste a mano se quedan como los dejaste.
- Un espacio que **renombraste** sigue reconociéndose. GitHuttBr recuerda la
  carpeta de la que salió, así que fusiona en vez de crear un duplicado.
- Un repositorio borrado del disco conserva su pestaña y se muestra ausente.

Los espacios generados son espacios normales. Renómbralos, reordénalos,
recolórealos o bórralos como cualquier otro. Nada de ellos sigue siendo
especial.

## Cerrar todo lo que está abierto

El encabezado de **Repositorios abiertos** lleva un botón de cierre.
**Cerrar repositorio** cuando hay uno abierto, **Cerrar todas las pestañas**
cuando hay varios. Está desactivado si no hay nada abierto.

Cierra las pestañas que contienen repositorios y **deja en paz las pestañas de
página**, así que la página Repositorios en la que estás no se cierra sola. No
se toca nada en disco, y no se hace commit, stash ni se descarta nada. Una
pestaña es solo una vista.

Cerrar varios pregunta primero, y dice cuántos. Cerrar uno solo no: es un
error barato, y se deshace con el atajo habitual de reabrir la pestaña
cerrada. Las pestañas cerradas van a la misma pila de diez que usa un cierre
suelto, y se reabren en el orden en que estaban en la tira. Si cierras más de
diez a la vez, no se pueden recuperar todas.

## Fetch y pull de una sección entera

Cada encabezado de sección lleva un botón de **fetch** y un botón partido de
**pull**. Actúan sobre cada repositorio de esa sección, y se saltan los cuya
carpeta está **ausente**. Los repositorios no tienen que estar abiertos. Una
sección de repos que no has abierto en esta sesión funciona igual.

Ambos corren **en serie**, no en paralelo, así que una sección de cuarenta
repositorios no lanza cuarenta procesos git a la vez. La barra de estado
muestra qué repositorio se está trabajando y en qué punto del lote vas, y el
lote entero termina con **un** aviso, no uno por repositorio. Si algunos
fallan, el aviso dice cuántos salieron bien y cuántos no. La pasada no se
detiene en el primer fallo.

La flecha junto a **pull** elige qué significa hacer pull:

| Modo | Qué hace |
|---|---|
| Pull (avance rápido si es posible) | El valor por defecto de Git. Hace fast-forward cuando puede, merge cuando no |
| Pull (solo avance rápido) | Rechaza en vez de crear un commit de merge |
| Pull (rebase) | Reescribe tus commits locales encima del upstream |

Esa elección es una **preferencia global única**, no una por sección: describe
cómo haces pull, y cambiarla desde la flecha de una sección la cambia en
todas. Cada pull **de varios repositorios** la respeta: los botones de sección
aquí, el fetch/pull de una [pestaña de grupo](workspaces.md) y el pull masivo
del [centro de control](mission-control.md). El pull de un **solo**
repositorio desde la barra no se ve afectado, porque ese menú ya te pregunta
qué tipo de pull quieres.

## La barra de acciones

**Abrir carpeta…**, **Clonar…** y **Añadir carpeta de escaneo…**. Tres formas
de meter un repositorio en el registro de GitHuttBr, desde la misma página en
la que buscas uno que ya está.

## Resumen WIP

Una casilla opcional. Encendida, cada fila **desplegada** ejecuta un `git
status` de verdad y muestra trabajo sin commitear y estado de sync. Apagada,
las filas no cuestan más que leer archivos dentro de `.git`.

Es opcional a propósito: un resumen cuesta unos cinco procesos git por
repositorio, en lotes de ocho, para que un registro grande no atasque la
interfaz. Encenderlo es un "mira todo lo que puedo ver ahora", no un coste
permanente.

## Límites

- **Nada en esta página se refresca con un temporizador.** Reabre la página, o
  apaga y enciende el resumen WIP, para ver el estado actual.
- **El resumen WIP solo cubre las secciones desplegadas.** Una sección
  contraída no muestra estado, esté la casilla marcada o no.
- **Un repositorio solo es conocido cuando lo has abierto, o has escaneado
  una carpeta que lo contiene.** Desde aquí no se busca en el sistema de
  archivos.
- **Crear espacios de trabajo no se deshace en un solo paso.** Cancelar el
  diálogo no crea nada, pero un plan que confirmaste y luego lamentas se
  deshace borrando los espacios a mano.
- **Solo un nivel de profundidad.** Las carpetas por debajo del primer nivel
  se aplastan en la tira de pestañas del espacio: `client-a/nested/app` se
  convierte en una pestaña de `client-a`, no en una carpeta dentro.
- **"Escanear ahora" de Ajustes no ofrece esto.** Reescanéa todas las raíces
  configuradas de una vez, donde un diálogo por carpeta no tiene sentido, y
  solo indexa.
- **Cerrar todas reabre una pestaña cada vez, hasta diez.** Cerrar más de
  diez repositorios de golpe significa que los más antiguos no se pueden
  reabrir desde la pila, aunque siguen todos en **Repositorios recientes**.
- **El pull no se filtra por los que van detrás.** Hace pull de cada
  repositorio de la sección, porque saber cuáles van detrás implicaría hacer
  fetch primero. Hacer pull de un repositorio al día es un no-op, así que
  esto cuesta tiempo, no seguridad.
- **Un fetch o pull de sección no se deshace desde la pila de deshacer.** El
  fetch no cambia lo que ya tenías. Un pull que hace merge o rebase se
  revierte por repositorio desde la historia de ese repositorio, no desde
  aquí.
- **Los colores de sección son cosméticos.** No filtran, ordenan, agrupan ni
  sincronizan en ningún sitio, y el color de la sección de un espacio no es
  el color de ese espacio.
- **Olvidar quita la entrada de la lista, nunca del disco.** Y es duradero:
  los escaneos posteriores de su carpeta se la saltan, incluido el que ejecuta
  el diálogo Repositorios escaneados al abrirse. Lo que la devuelve es volver a
  abrir el repositorio.

**Ver también:** [Centro de control](mission-control.md) · [Espacios de trabajo, pestañas y grupos](workspaces.md)
