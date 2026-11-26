---
title: Clonar
category: Empieza aquí
order: 2
summary: Clona desde una URL o directamente desde tu hosting — y estrecha lo que se descarga cuando el repositorio es enorme.
keywords: clonar clone segundo plano background cancelar abortar varios múltiples lote muchos repositorios seleccionar todo shallow superficial depth profundidad partial parcial filter blob none single branch rama submodules submódulos recursive ls-remote selector de ramas unshallow monorepo
source: 3d8942b1073ef47bd000c7887afb5ea8cdebcdd7
---

# Clonar

**Nuevo repositorio → Clonar**, o `⌘K` → *Clonar*. Pega una URL, o inicia sesión
en GitHub, GitLab, Bitbucket o Azure DevOps y elige entre tus propios
repositorios — el token del [perfil](profiles.md) elegido se usa para el clon y
después se descarta, nunca se escribe en `.git/config`.

Elige una carpeta padre y un nombre; la línea bajo los campos muestra exactamente
dónde va a aterrizar el repositorio. Una carpeta que ya existe se rechaza en
lugar de fusionarse con ella.

## Varios repositorios a la vez

Preparar un equipo nuevo, o descargar todos los servicios de un equipo, antes
obligaba a abrir este diálogo una vez por repositorio. En una pestaña de
hosting, marca la casilla de cada repositorio que quieras, o pulsa
**Seleccionar todos los mostrados** para llevarte todo lo que coincide con el
filtro. Hacer clic en una fila (no en su casilla) sigue eligiendo solo esa.

Con más de uno marcado, el diálogo los clona todos en la misma carpeta padre,
cada uno en una carpeta con el nombre del repositorio. Las rutas se listan antes
de empezar. Si dos se llaman igual (`org-a/app` y `org-b/app`), ambos llevan el
propietario en el nombre de la carpeta (`org-a-app`, `org-b-app`) en lugar de
pelearse por una sola.

![La pestaña de GitHub del diálogo de clonado con tres repositorios marcados, las carpetas donde aterrizarán listadas bajo la carpeta padre y un botón Clonar 3 repositorios](../../screenshots/clone-multi-select.webp)

El lote va directo a la bandeja de la esquina. Se ejecutan tres clones a la vez
y el resto espera como *En cola*; cada uno tiene su propio botón de cancelar.
Cada repositorio se abre en una pestaña en cuanto termina.

Límites:
- **Rama a la que cambiar** se oculta en un lote: un nombre de rama no significa
  nada entre repositorios distintos, así que cada uno recibe su rama
  predeterminada. Las demás opciones de Avanzado (parcial, superficial, una sola
  rama, submódulos) se aplican a todos.
- La selección múltiple solo funciona en las pestañas de hosting. La pestaña URL
  admite una sola URL.
- Un fallo no detiene a los demás. Un repositorio cuya carpeta ya existe falla
  con su propio error y el resto sigue adelante.

## Avanzado — estrechar el clon

Todo lo que hay bajo **Avanzado** está desactivado por defecto: no lo toques y
obtienes un clon normal y completo. Se gana su sitio en los repositorios donde
"completo" significa veinte minutos y varios gigabytes.

![El diálogo de clonado con Avanzado abierto: parcial, superficial, una sola rama, submódulos y un selector de ramas](../../screenshots/clone-advanced.webp)

| Opción | Qué hace git | Qué cuesta |
|--------|---------------|---------------|
| **Clon parcial** | `--filter=blob:none` | Todo el historial, sin contenido de archivos. Los blobs llegan bajo demanda, así que abrir un archivo antiguo necesita red. |
| **Clon superficial** | `--depth=N` | Solo existen los N commits más recientes. Blame, log, bisect y range-diff se detienen en el corte. |
| **Solo una rama** | `--single-branch` | Las demás ramas se quedan en el remoto hasta que las traigas con fetch. |
| **Clonar submódulos** | `--recurse-submodules` | Cada submódulo también se saca a disco — más tiempo ahora, ningún directorio ausente después. |
| **Rama a la que cambiar** | `--branch <name>` | Empieza en esa rama en lugar de en la predeterminada del remoto. |

**Parcial antes que superficial.** Un clon parcial conserva todos los commits —
el historial sigue siendo consultable, y solo el contenido de los archivos se
descarga de forma perezosa. Un clon superficial descarta historial de verdad:
`git log` termina en el corte y blame no puede ver más allá. Si estás clonando un
monorepo para trabajar en él, el parcial suele ser el que quieres.

Lo superficial se puede deshacer: `git fetch --unshallow` en la
[terminal](terminal.md) rellena el historial de vuelta.

### Elegir la rama

Escribe un nombre de rama, o pulsa **Listar ramas** para preguntarle al remoto
qué tiene (`git ls-remote --heads`) y elegir de un desplegable. Eso es un único
viaje de ida y vuelta por la red, hecho solo cuando pulsas el botón — no se
consulta nada mientras escribes.

Si el listado falla — una URL privada todavía sin token, una errata, sin red — el
campo se queda como una caja de texto normal y el propio clon informa del error
real.

### Dos notas sobre las opciones

- **`--depth` implica `--single-branch`.** Con un clon superficial, dejar *Solo
  una rama* sin marcar es lo que pide de vuelta las demás ramas
  (`--no-single-branch`), y por eso cambia la pista que hay debajo.
- **Clonar una carpeta local** normalmente ignora `--depth` por completo, porque
  git enlaza en duro el almacén de objetos en lugar de descargarlo. GitHuttBr clona
  a través de una URL `file://` cuando pides una copia superficial de un
  repositorio local, así que la profundidad que pediste es la profundidad que
  obtienes.

## Progreso, segundo plano y cancelación

La barra informa de lo que informa git: contando, comprimiendo, recibiendo,
resolviendo, sacando a disco. Una etapa que no puede informar de un total muestra
una barra indeterminada en lugar de un porcentaje falso.

Un clon grande tarda minutos, y un clic despistado fuera del diálogo antes te
costaba todo ese tiempo. Ahora cerrar el diálogo — **Ejecutar en segundo plano**,
`Esc`, la ✕ o un clic fuera — solo lo oculta: el clon sigue y pasa a una pequeña
tarjeta en la esquina inferior con la misma barra de progreso. Mientras tanto
puedes empezar otro clon; cada uno tiene su propia tarjeta.

![La bandeja de clones en la esquina inferior: tres clones recibiendo, resolviendo y contando, un cuarto en cola, cada uno con su propio botón de cancelar](../../screenshots/clone-tray.webp)

¿Elegiste el repositorio equivocado? **Cancelar clon** en el diálogo, o la ✕ de
su tarjeta, detiene git y borra la carpeta a medio escribir. No se toca nada más:
la carpeta no existía antes de empezar el clon, y eso se comprueba de antemano.
Un clon cancelado no se puede reanudar; volver a lanzarlo empieza desde cero.

Cuando termina, el nuevo repositorio se abre en una pestaña, anclado al perfil
con el que clonaste, esté o no el diálogo todavía abierto.

Los clones se ejecutan dentro de la app, así que salir de GitHuttBr los detiene.
La salida no espera a la limpieza, de modo que la carpeta a medio escribir puede
quedarse ahí: bórrala antes de volver a clonar en ese sitio, porque el diálogo
rechaza una carpeta que ya existe.
