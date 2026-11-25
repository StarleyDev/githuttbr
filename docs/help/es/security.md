---
title: Seguridad y secretos
category: Seguridad
order: 70
summary: Enmascarado, guardas, el llavero — y lo que Gitcito se niega a hacer.
keywords: seguridad security secretos secrets enmascarar masking llavero keychain safeStorage tokens rama protegida protected branch archivo grande large file guarda privacidad
---

# Seguridad y secretos

Gitcito **no tiene backend**. Las únicas llamadas de red van a tu hosting de Git
y, si lo activas, a tu proveedor de IA.

![Ajustes de seguridad](../../screenshots/settings-security.webp)

## Enmascarado de secretos

Los valores de `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` y
compañía se pintan como `KEY=••••••` en las vistas de diff, archivo y blame,
para que compartir pantalla o hacer una captura no los filtre.
El material de firma de Apple cuenta: `*.mobileprovision`,
`*.provisionprofile`, `*.p12` y las claves `*.p8` de App Store Connect. Un
`*.cer` no — un certificado es público por diseño.

Es **solo visual**: nunca cambia el archivo y nunca cambia lo que preparas. Un
botón con forma de ojo los revela por vista. `.env.example`, `.sample` y
`.template` se tratan como plantillas, no como secretos.

![Un .env pintado con todos los valores enmascarados, y el botón para revelarlos](../../screenshots/secret-masking.webp)

## Guardas antes de que hagas daño

| Guarda | Cuándo |
|---|---|
| **Archivo de secretos** | Al commitear algo que parece una credencial — con un *Ignorar y dejar de seguir* de un clic |
| **Archivo grande** | Al commitear un blob desmesurado (el umbral está en Ajustes → Seguridad) |
| **Ruido de compilación** | Al commitear `xcuserdata/`, `DerivedData/` o un `.DS_Store` — con el mismo *Ignorar y dejar de seguir* de un clic |
| **Rama protegida** | Al commitear directamente a `main`/`master`, o al hacerle force push |
| **Secretos con seguimiento** | Al publicar un repositorio que *sigue* un archivo de secretos — se avisa una vez por sesión |

## El llavero del sistema

Los tokens y las entradas de la [caja fuerte](vault.md) se cifran con el llavero
de tu sistema operativo (`safeStorage` de Electron), nunca con una clave metida
en el archivo de ajustes.

**Nada toca el llavero hasta que tú lo dices.** Antes de que pueda aparecer el
diálogo de permisos del propio sistema, Gitcito te explica qué se va a guardar,
qué no puede hacer (una app solo puede releer la entrada que ella misma creó —
tus otras contraseñas quedan fuera de su alcance), y que decir que no está bien:
los tokens viven entonces en memoria solo durante la sesión, la caja fuerte se
queda cerrada, y puedes activarlo más tarde en **Ajustes → Seguridad → Llavero
del sistema**.

Una instalación recién hecha hace **cero** llamadas al llavero hasta que algo
necesita guardarse de verdad.

Mientras esté desactivado, el campo del token en Integraciones lo indica — *Se guarda solo hasta que cierres Gitcito: el llavero del sistema está desactivado.* — con un botón **Activar** al lado. Activarlo, desde allí o desde aquí, también guarda los tokens que ya escribiste en esta sesión, así que no hay que pegarlos de nuevo.

### Linux sin llavero

En Linux el llavero es un servicio de secretos — GNOME Keyring o KWallet. Cuando
no hay ninguno en ejecución, el sistema sigue «cifrando», pero con una contraseña
fija que es la misma en todas las máquinas: los tokens y las claves quedan
ofuscados, no protegidos. Ajustes → Seguridad lo indica bajo el estado del
llavero — *No hay ningún llavero en ejecución…* — para que la palabra *llavero*
nunca prometa una protección que no existe.

Para que nada nuevo acabe en un almacén que cualquiera podría descifrar, un
token que escribas mientras no hay ningún llavero en ejecución se guarda **solo
hasta que cierres la app**. El campo del token lo indica — *Guardado solo hasta
que cierres Gitcito: no hay ningún llavero en ejecución…* — sin botón de
reintentar, porque reintentar no sirve; solo un llavero lo arregla. Los tokens
guardados antes siguen siendo legibles — nunca pierdes el acceso a ellos — y
borrar o sustituir uno sigue eliminando el valor antiguo del disco. Dos límites:
la clave de la IA general no se mueve a su espacio compartido (cada perfil sigue
leyendo la suya), y la caja fuerte sigue guardando en el almacenamiento básico,
porque no tiene modo solo de sesión. Instala o desbloquea un llavero y reinicia
Gitcito para volver a guardar tokens nuevos.

## Importar ajustes

**Ajustes → Importar / Exportar** lleva ajustes, perfiles y temas de una máquina
a otra. La exportación por defecto **no lleva tokens ni claves de API**, e
importar un archivo así nunca toca los que tienes guardados — un token en blanco
en el archivo significa «no está en este archivo», no «borra el mío».

### Elegir qué importar

Un archivo de ajustes guarda dos tipos de cosas: lo que te sigue *a ti*
(perfiles, tema, atajos) y lo que solo tiene sentido en la máquina que lo
escribió (las carpetas donde viven tus repositorios, la ruta de tu terminal).
Aplicarlo todo en un equipo nuevo llena la barra lateral de pestañas que no
apuntan a nada. Por eso, después de elegir el archivo (y escribir su contraseña,
si tiene), un diálogo pregunta qué partes traer. No se aplica nada hasta que
pulsas **Importar**; **Cancelar** lo deja todo como estaba.

![Ajustes → Datos → Importar: cuatro partes, los repositorios desmarcados porque ninguna de sus carpetas existe aquí, y la traducción de rutas abierta](../../screenshots/settings-import.webp)

| Parte | Qué lleva |
|------|-----------------|
| **Perfiles y cuentas** | Perfiles, identidad de Git, enlaces de integraciones, los ajustes generales de IA y las imágenes de perfil — y las credenciales y la [caja fuerte](vault.md), cuando el archivo las tiene |
| **Preferencias de la app** | Tema, idioma, atajos, disposición, los colores del grafo y de los iconos |
| **Repositorios y espacios de trabajo** | Pestañas, espacios de trabajo, favoritos, apodos, imágenes de pestaña, qué perfil usa cada repositorio, carpetas escaneadas, y las notas y wikis de cada repositorio |
| **Programas de este equipo** | Terminal, editor externo, apps predeterminadas y la ruta de las CLI de IA |

Cada parte muestra cuántas entradas tiene el archivo para ella. Una parte que
dejas desmarcada se queda exactamente como está en esta máquina.

**Los perfiles se combinan con los tuyos.** Un archivo de otro equipo rara vez
tiene todos los perfiles que tiene este — una cuenta añadida en el portátil con
Linux, un perfil de cliente que solo existe en el Mac. Por eso **Perfiles y
cuentas** añade los perfiles del archivo a los tuyos en vez de sustituir la
lista. Antes de importar, la parte lista cada perfil y lo que le va a pasar:

| Etiqueta | Significado |
|-----|---------|
| **Actualiza** | El perfil está en los dos: la identidad, la IA y la imagen del archivo sustituyen a las tuyas, y sus servidores se añaden a los tuyos |
| **Nuevo** | Solo lo tiene el archivo: se añade después de los tuyos |
| **Se mantiene** | Solo lo tiene este equipo: se queda exactamente como está |

Dos perfiles son «el mismo» cuando comparten un id — el primer perfil de cada
instalación lo comparte. Cuando ningún id coincide, cuenta el nombre (sin
distinguir mayúsculas ni espacios alrededor), y el perfil conserva **el id de
este equipo**: los repositorios vinculados a él, el perfil activo, sus
credenciales guardadas y su imagen siguen enlazados. El perfil activo no cambia.

**Reemplazar todos** sigue ahí, para una copia de seguridad que quieres
recuperar tal como estaba: solo quedan los perfiles del archivo, y los que solo
tiene este equipo aparecen tachados como **Eliminado**. Al pulsar **Importar**
se pregunta una vez más, nombrándolos — se van con sus credenciales guardadas y
su imagen, y eso no se puede deshacer. Con **Reemplazar todos**, el perfil activo
del archivo pasa a ser el activo.

Límites: la coincidencia es solo por id o por nombre exacto — un perfil
renombrado en un lado cuenta como nuevo, y acabas con los dos. Un perfil
coincidente toma los campos del archivo, con tres excepciones para que no se
pierda nada que solo tenga este equipo: sus servidores de GitHub Enterprise,
GitLab y Bitbucket se **añaden** a los tuyos (en un servidor que tienen los dos
gana la entrada del archivo); un token que el archivo trae en blanco conserva el
tuyo — pero solo para la misma instancia, así que un token nunca se envía a otro
Forgejo, a otro emisor de GitLab ni a otra organización de Azure; y los inicios
de sesión tomados del gestor de credenciales de esta máquina siguen siendo de
esta máquina.

**Las opciones por defecto son una suposición a partir de tu disco.** Antes de
mostrar el diálogo, Gitcito comprueba si las carpetas de repositorios del
archivo existen aquí. Si no existe ninguna, el archivo viene de otro equipo:
**Repositorios** y **Programas** empiezan desmarcados, cada uno con el motivo —
las rutas de los programas aparecen listadas, para que veas que son de otro
sitio. Si existen, es el mismo equipo (una copia de seguridad restaurada, por
ejemplo), todo empieza marcado y una nota verde lo dice. Un archivo sin ningún
repositorio se juzga por las rutas de sus programas: **Programas** empieza
marcado solo cuando todas existen aquí.

Cuando la propia comprobación falla, no se supone nada: **Repositorios** y
**Programas** empiezan desmarcados sin veredicto, un botón **Comprobar de
nuevo** vuelve a preguntar al disco, y **Repositorios** no se puede importar
hasta que una comprobación salga bien. Las demás partes sí.

**Traducir rutas.** Marca **Repositorios** en un archivo cuyas carpetas faltan y
se abre un recuadro **Traducir rutas**. A la izquierda, la carpeta que los
repositorios del archivo tienen en común (`/home/you/code`); a la derecha, dónde
está esa carpeta en este equipo, rellenada a partir de tu carpeta personal
(`/Users/you/code`). Las dos se pueden editar — la suposición puede fallar, y
cuando Gitcito no encuentra ninguna carpeta común deja las dos vacías para que
las escribas. Una barra cuenta, mientras escribes, cuántos repositorios tienen
ya una carpeta aquí, con algunos de ellos listados — en verde los encontrados,
en rojo los que siguen faltando. El cambio se lleva consigo el apodo, la imagen
de pestaña y el perfil del repositorio, y sus notas, wikis y entradas de la caja
fuerte, para que no haya que configurar nada otra vez a mano.

El pie lo resume — *Importar 3 de 4 partes · 31 carpetas* (las raíces de
escaneo y la última carpeta de clonado también cuentan, por eso dice carpetas y
no repositorios) — e **Importar** sigue desactivado hasta que haya al menos una
parte marcada.

**Importar también sigue desactivado cuando una traducción no encuentra nada.**
Con **Repositorios** marcado y ni una sola carpeta encontrada bajo el nuevo
prefijo, importar dejaría tus repositorios vacíos; corrige las rutas o desmarca
la parte.

Límites de la traducción:

- Es **un prefijo cambiado por otro**. Los repositorios que en el archivo están
  bajo otra carpeta, o que aquí se organizan de otra forma, no se encuentran; no
  hay correspondencia por repositorio.
- Con una traducción en vigor, **solo se importan los repositorios que entonces
  tienen carpeta**. El resto se deja fuera — no se añade como pestañas rotas — y
  el diálogo te dice cuántos.
- Los programas nunca se traducen: `/usr/bin/code` no tiene un equivalente
  fiable en otro sistema. Deja esa parte desmarcada y elígelos en Ajustes.
- Vaciar cualquiera de los dos prefijos importa las rutas tal como están en el
  archivo.

**Mientras importa**, el diálogo no se puede cerrar. Si falla un paso posterior
— las notas de los repositorios, la caja fuerte, las imágenes de perfil — el
diálogo sigue abierto, nombra el paso, y **Continuar importación** retoma desde
ahí sin volver a escribir los pasos anteriores.

### Credenciales en el archivo

Un archivo exportado con la casilla marcada lleva credenciales. Combinar
perfiles siempre las **añade**: las del archivo se guardan bajo el perfil
coincidente, sustituyendo las de la misma cuenta, y todas las demás credenciales
guardadas se quedan — borrarlas contradiría conservar tus perfiles. Con los
perfiles en **Reemplazar todos**, un archivo así muestra además la elección,
justo debajo de **Perfiles y cuentas**:

| Opción | Tus credenciales guardadas |
|--------|------------------------|
| **Añadir a las mías** | Se añaden las del archivo, sustituyendo las de la misma cuenta; todas las demás se conservan |
| **Reemplazar todo** | Pasan a ser exactamente las del archivo — se borra cada token y clave de API guardados que el archivo no tenga |

La elección se aplica junto con los perfiles: con **Perfiles y cuentas**
desmarcado, no se importa ni se elimina ninguna credencial. Un archivo
exportado sin la casilla no tiene ninguna que ofrecer, marques lo que marques.
**Reemplazar todo** pregunta una vez más al pulsar **Importar**, avisando de que
se borrará cada token y clave de API guardados que el archivo no tenga;
**Cancelar** ahí deja el diálogo como estaba.

**Reemplazar todo necesita el llavero.** Con el llavero desactivado o no
disponible, los tokens antiguos seguirían en el almacén cifrado y volverían en
el siguiente arranque, así que Gitcito se niega: lo dice, y no se importa nada.
Lo mismo ocurre mientras no se pueden leer los tokens guardados: volverían en
cuanto se pudieran leer. **Añadir a las mías** sigue funcionando, y conserva los
tokens del archivo durante la sesión.

**El límite:** las credenciales pertenecen a un perfil. Un perfil que la
importación elimina se lleva sus tokens guardados, elijas lo que elijas.

## Compartir sin riesgo

[Compartir seguro](secure-share.md) exporta ajustes, entradas de la caja fuerte
o espacios de trabajo enteros como un **paquete cifrado** — los secretos solo se
incluyen si marcas la casilla.

**Ver también:** [Caja fuerte](vault.md) · [Compartir seguro](secure-share.md)
