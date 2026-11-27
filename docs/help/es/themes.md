---
title: Temas y apariencia
category: Hazlo tuyo
order: 100
summary: Temas incluidos, claro y oscuro, más los personalizados y los generados por IA, y los iconos de colores.
keywords: tema temas theme themes oscuro claro dark light apariencia colores fuente tamano grafo graph paleta palette buscar ajustes encontrar preferencia search settings icono iconos colores de los iconos tinte monocromo icon icons icon colors tint monochrome
---

# Temas y apariencia

Temas incluidos — GitHuttBr, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast y Daltonic — cada uno con su variante clara y su variante
oscura.

![Cambiando de claro a oscuro](../../screenshots/clip-themes.webp)

- **Claro, oscuro o seguir al sistema**, con el cambio en vivo.
- **Temas personalizados**, y otros **generados por IA** a partir de un prompt.
- **Tamaño de la fuente del código** ajustable.
- **Colores de los iconos** para la barra de herramientas y las secciones de la barra
  lateral — ver más abajo.
- El **aspecto del grafo** — paleta de carriles, esquinas, densidad de filas y grosor, con una vista previa en vivo — tiene página propia, **Ajustes → Grafo**: consulta [el grafo de commits](graph.md).

![Ajustes de temas](../../screenshots/settings-themes.webp)

## Colores de los iconos

Una fila de iconos grises hace que Fetch, Push y Stash se parezcan hasta que lees
sus etiquetas. **Colores de los iconos**, en Apariencia de la pestaña Tema,
colorea cada icono según lo que hace, para que la vista encuentre la acción antes
que la palabra:

| Papel | Iconos | Color del tema que toma |
|---|---|---|
| Recibir | Fetch, Pull, Remotos, Worktrees | la ranura cian del tema |
| Enviar, terminar | Push, Tareas, Incidencias, Releases | verde |
| Referencias | Rama, Locales, Etiquetas, Pull requests, Hitos, Submódulos | el acento |
| Apartar | Stash, Pop, Stashes, Marcadores, Fijadas | la ranura naranja del tema |

Deshacer, Rehacer, Herramientas y Ajustes se quedan en gris: son utilidades, y
dejarlas sin color es lo que hace destacar a las que sí lo tienen.

Las listas que agrupan muchas entradas colorean un grupo entero a la vez, para
que un grupo se lea como una familia:

- **Menú Herramientas** — el viaje en el tiempo (Reflog, Instantáneas, Máquina
  del tiempo, Bisect) en naranja; las herramientas de ramas (Absorb, los radares,
  CI local, las comparaciones) en el acento; y un color por grupo: Inspeccionar
  cian, Ramas e historial el acento, Archivos y parches verde, Repositorio
  naranja, Secretos y compartir rojo.
- **Páginas de Ajustes** — Diseño y terminal, Espacios y IA en el color de acento; Perfil e identidad, Analizadores de código y Entorno en verde; Cuentas conectadas, Git y sincronización y Datos y copia de seguridad en cian; Temas y Grafo en naranja; Seguridad y confirmaciones en rojo. General, Atajos y Acerca de quedan en gris.

Una fila de botones con icono y sin etiqueta hace lo contrario — cada botón recibe
su propio color, para poder distinguirlos. En la [página de pull
requests](pull-requests.md), los botones de la cabecera se ven así: actualizar
azul, revisión con IA el color de acento, previsualizar en local turquesa, ir a la
rama de origen verde e ir a la rama de destino naranja (abrir en el navegador sigue
gris), y en tus propios comentarios **Editar** toma el acento y **Eliminar** el
rojo — allí y en la página de la issue. El azul y el turquesa son mezclas de los
colores del tema, así que también lo siguen.

| Opción | Qué ves |
|---|---|
| **Monocromo** | Todos los iconos grises, como antes de que existiera esta opción |
| **Tono suave** (predeterminado) | El color mezclado con el gris; el color entero al pasar el ratón |
| **Color pleno** | El propio color, sobre una pequeña pastilla del mismo tono |

Los colores salen del tema: un tema que repinta su verde o su acento repinta los
iconos con él, incluidos los temas personalizados y los generados por IA.

Límites: solo se colorean los botones principales de la barra de herramientas,
las cabeceras de las secciones de la barra lateral, el menú Herramientas, las
páginas de Ajustes y los botones de las páginas de pull request e issue; los demás
menús, las filas dentro de una sección y el grafo de commits no. Una fila de menú
bajo el ratón conserva su aspecto habitual, icono incluido. El color nunca es la
única pista: cada icono conserva su etiqueta.

## Cómo se organizan los Ajustes

El menú lateral agrupa las páginas por tema:

| Grupo | Páginas |
|---|---|
| **Tú** | Perfil e identidad · Cuentas conectadas · IA — las dos primeras editan el perfil nombrado en el encabezado ([perfiles](profiles.md)) |
| **Apariencia** | Temas · Grafo · Diseño y terminal |
| **Comportamiento** | General · Git y sincronización · Seguridad y confirmaciones · Analizadores de código |
| **Sistema** | Espacios · Atajos · Entorno · Datos y copia de seguridad · Acerca de |

General guarda solo lo que es de la app en conjunto — Idioma, Las pestañas de repositorio muestran, Notificaciones de escritorio, Abrir novedades tras actualizar, Avisar al cerrar. Lo demás que tenía se fue a la página a la que pertenece, y la nota de la propia página lleva allí:

| Opción | Ahora en |
|---|---|
| Commits iniciales cargados, Commits por “cargar más”, Cargar más al hacer scroll, Fechas relativas, Mostrar avatares, Usar fotos de perfil de GitHub | **Grafo** — con Paleta de carriles, Esquinas de línea, Densidad de filas, Estilo de nodo, Enfoque del grafo, Diseño de stashes, Grosor de línea, que eran la pestaña Grafo de Temas |
| Auto-fetch cada (minutos), Crear siempre un commit de merge, Recordar resoluciones de conflictos, Herramientas externas de diff y merge, Editor externo, App por defecto para "Abrir con" | **Git y sincronización** |
| Confirmar antes de force push | **Seguridad y confirmaciones** |
| Analizadores de código, launch.json | **Analizadores de código** |
| Visor de archivos, Animar el avatar del perfil, Ocultar tareas completadas, Agrupar refs por prefijo | **Diseño y terminal** |

Integraciones ahora es **Cuentas conectadas** y Datos es **Datos y copia de seguridad**. Nada cambió en lo que hace cada opción, y los ajustes guardados siguen como están. Un enlace que abre una página por su nombre antiguo sigue llegando a la correcta.

## Encontrar un ajuste

Ajustes se reparte en muchas páginas, y la opción que buscas casi nunca está donde
esperarías: sabes que existe, no en qué página está. El campo de búsqueda en la
cabecera de Ajustes, junto al botón de cerrar, busca en todas las páginas a la
vez.

![Buscando «terminal» en los ajustes](../../screenshots/settings-search.webp)

Mientras escribes, el lado derecho lista los ajustes que coinciden, agrupados
por página — cada uno con su nombre, su descripción de una línea y la página en
la que está. La barra lateral atenúa las páginas sin coincidencias y muestra un
recuento en las que sí tienen.

- Compara el nombre del ajuste, su descripción y el nombre de la página — también la página donde estaba antes de reagrupar el menú, así que "general fetch" sigue encontrando la obtención automática en Git y sincronización, e "integrations" encuentra Cuentas conectadas. Se ignoran mayúsculas y acentos, y cada palabra escrita tiene que aparecer, así que "terminal font" se reduce a los ajustes de fuente del terminal.
- Busca en el idioma de la interfaz y en inglés a la vez: con la app en
  español, escribir "token" o "font" sigue encontrando el ajuste.
- Haz clic en un resultado, o pulsa **Enter** para el primero, para abrir su página, desplazarte hasta el ajuste y resaltarlo un momento.
- **Esc** borra la búsqueda; un segundo **Esc** cierra Ajustes.

Busca en nombres y descripciones, no en los valores que hayas puesto. Las
listas de servidores por host de Integraciones (GitHub Enterprise Server,
GitLab autogestionado, Bitbucket Data Center) abren la página Integraciones; la
pestaña del host la eliges tú. Los atajos de teclado individuales no están
indexados — la búsqueda encuentra la página Atajos, cuyo editor los lista.

## Disposición

Barra lateral a la izquierda o a la derecha, paneles redimensionables por todas
partes, una barra lateral plegable para cuando el grafo se merece la ventana
entera, y colocación de la terminal por repositorio.

La misma página, **Ajustes → Diseño y terminal**, guarda también los extras de la barra de título y la barra lateral — **Animar el avatar del perfil**, **Ocultar tareas completadas**, **Agrupar refs por prefijo** — y el margen de cambios y el minimapa del visor de archivos.

**Ver también:** [El grafo de commits](graph.md) · [Perfiles](profiles.md)
