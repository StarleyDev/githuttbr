---
title: Ajustes por repositorio
category: Herramientas del espacio de trabajo
order: 94
summary: El nombre visible, el perfil, las ramas protegidas y la imagen de pestaña de un repositorio, además de sus reglas, su bóveda y su actividad.
keywords: ajustes del repo repo settings ramas protegidas protected branches imagen de la pestaña tab image icono logo analíticas analytics registro de operaciones operation log historial información engranaje gear nombre visible alias perfil quitar de la lista olvidar métricas configuración del proyecto
source: 6cd23a3db24f4869df7d1b881fb15155bd0a0a8b
---

# Ajustes por repositorio

El engranaje que hay junto a las herramientas de la barra abre los ajustes que
pertenecen a **este** repositorio, no a la aplicación.

![Ajustes por repositorio](../../screenshots/repo-settings.webp)

La cabecera dice qué repositorio estás a punto de cambiar: su nombre, su
carpeta, la rama actual, el remoto principal (`origin` cuando existe) con el
host donde vive, y algunos recuentos. El de ramas sale de la lista ya cargada.
El de la bóveda aparece solo después de abrir **Bóveda**, porque leer la bóveda
consulta el llavero del sistema, y abrir los ajustes no debería. No hay recuento
de commits: contar un historial largo es una llamada git aparte, y una cabecera
no la merece.

Las páginas están en una navegación lateral, en tres grupos:

| Grupo | Página | Qué contiene |
|---|---|---|
| Repositorio | **General** | Nombre visible, perfil, ramas protegidas, la imagen de la pestaña y Quitar de la lista |
| Repositorio | **Configuración del proyecto** | Las [reglas que trae este repositorio](repo-config.md) en `.githuttbr.json`, y el doctor que las comprueba |
| Repositorio | **Información** | Notas y campos libres sobre este repositorio, guardados localmente |
| Seguridad | **Bóveda** | Las entradas de la [bóveda](vault.md) de este repositorio |
| Actividad | **Analítica** | Lo que has hecho en GitHuttBr, contado localmente |
| Actividad | **Métricas** | El [panel del historial](insights.md) |
| Actividad | **Historial de operaciones** | Commits a lo largo del tiempo y quién los hizo, en los repositorios que has abierto |
| Actividad | **Registro** | El registro de operaciones: cada comando git que GitHuttBr ejecutó aquí, con su resultado |

El registro de operaciones es el sincero: cuando algo se comporta de forma rara,
muestra el comando exacto y el error exacto, para que un informe de fallo lleve
hechos en vez de adjetivos.

## General

Cada ajuste es una fila: lo que hace a la izquierda, el control a la derecha.
No se guarda nada hasta que pulsas **Guardar**.

| Fila | Qué hace | Dónde se guarda |
|---|---|---|
| **Nombre visible** | El nombre en pestañas y listas. La carpeta en disco nunca se renombra; vacío, se usa el nombre de la carpeta | Ajustes de GitHuttBr, en este equipo |
| **Perfil** | La identidad, los tokens y la IA a los que cambia este repositorio cuando su pestaña está activa. **Auto** sigue el perfil activo | Ajustes de GitHuttBr, en este equipo |
| **Ramas protegidas** | Avisa antes de hacer commit o force push directamente en estas ramas | El git config del repositorio |
| **Imagen de la pestaña** | Una imagen pequeña en la pestaña, más abajo | Ajustes de GitHuttBr, en este equipo |

Cuando el repositorio tiene un `.githuttbr.json`, un aviso arriba de General lo
indica y enlaza a **Configuración del proyecto**. Esas reglas viajan con el
repositorio a todos los que lo clonan; las filas bajo el aviso son solo tuyas.

**Quitar de la lista…** saca el repositorio de [Repositorios](repositories.md).
Pregunta antes, y la pregunta dice lo que no hace: la carpeta en disco no se
toca, y una pestaña abierta sigue abierta. Abrir el repositorio de nuevo lo
devuelve a la lista.

## Imagen de la pestaña

Con diez pestañas abiertas, los nombres que empiezan igual —`api`,
`api-gateway`, `api-docs`— cuesta distinguirlos. Una imagen pequeña en la
pestaña se encuentra antes que un texto.

En **General**, pulsa en el campo de la imagen. Lista las imágenes del propio
repositorio —PNG, JPEG, GIF, WebP, SVG, ICO, BMP y AVIF—, cada una con su
miniatura y primero las que se llaman como un logo o un icono. Escribe para
filtrar (`logo dark` encuentra `assets/logo-dark.png`), muévete con las flechas
y pulsa Intro para elegir; o escribe la ruta a mano. La ruta se guarda
**relativa a la raíz del repositorio**, así que la imagen sigue al repositorio
esté donde esté su carpeta.

Qué enseña la pestaña es una opción de toda la app, en **Ajustes → General →
Las pestañas de repositorio muestran**:

| Opción | La pestaña muestra |
|---|---|
| **Imagen y nombre** (por defecto) | La imagen en lugar del icono de carpeta, y el nombre |
| **Solo nombre** | El icono de carpeta y el nombre, como si no hubiera imagen |
| **Solo imagen** | Solo la imagen; el nombre pasa a su tooltip |

Límites que conviene saber:

- La lista recoge los archivos que git ve —versionados y sin versionar, no los
  ignorados— y como mucho 40 a la vez; escribe para llegar al resto. Una imagen
  ignorada se puede escribir a mano igualmente.
- Las imágenes de más de 1 MB, o las que no se pueden leer, salen atenuadas y no
  se pueden elegir: un icono de 20 píxeles no necesita más.
- Un repositorio **sin** imagen siempre muestra su nombre, elijas la opción que
  elijas: una pestaña vacía no habría forma de identificarla.
- Si la ruta está **rota** —el archivo se borró, se renombró, no es una imagen o
  es demasiado grande— la pestaña vuelve al nombre sin avisar, y esta pestaña de
  ajustes muestra un aviso bajo la ruta. Nada más se queja.
- La imagen se lee una vez por sesión. Si sustituyes el archivo con el mismo
  nombre, vuelve a abrir esta pestaña de ajustes para recargarla.
- El ajuste vive en la configuración de GitHuttBr de esta máquina, no en el
  repositorio, así que tus compañeros no lo heredan.

**Ver también:** [Seguridad y secretos](security.md) · [Métricas](insights.md)
