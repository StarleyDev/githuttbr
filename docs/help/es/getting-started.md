---
title: Primeros pasos
category: Empieza aquí
order: 1
summary: Abre un repositorio, lee el grafo, haz tu primer commit.
keywords: intro primeros pasos abrir clonar clone pestañas tabs grafo graph commit empezar inicio
source: 173f891f9f1c5c53ea40cf344baf821e3188344d
---

# Primeros pasos

Gitcito abre una carpeta y te enseña su historial. No escribe nada en tu
repositorio hasta que se lo pidas.

![Un repositorio recién abierto, todavía sin commits](../../screenshots/empty-repo.webp)

## Abrir un repositorio

![Abrir repositorio: abrir, clonar o crear, y debajo los repositorios escaneados y los recientes](../../screenshots/open-repository.webp)

- **Arrastra una carpeta** sobre la ventana, o usa **Abrir repositorio** en la
  pantalla de bienvenida. El selector admite varias carpetas a la vez: haz
  ⌘-clic o Mayús-clic para seleccionarlas, y cada una se abre en su propia
  pestaña (o se une al grupo desde el que lo abriste). En una selección de
  varias, un repositorio que ya está abierto, o una carpeta que no es un
  repositorio Git, se omite y se nombra en un mensaje, para que las demás se
  abran igualmente. El selector de macOS no puede atenuar de antemano los
  repositorios abiertos: Electron no expone el gancho por carpeta del panel,
  así que la comprobación ocurre después de pulsar Abrir.
- **Repositorios escaneados**, debajo de los tres botones, lista todos los
  repositorios de las carpetas que le pediste a Gitcito que escanee — marca
  varios y ábrelos de una vez, o haz doble clic en uno. También es donde añades
  o quitas esas carpetas. Mira [Repositorios](repositories.md#repositorios-escaneados).
- **¿Pulsaste el que no era?** Clonar, Crear, Crear grupo y Repositorios
  escaneados, abiertos desde Abrir repositorio, tienen una flecha **Atrás** junto
  al título que vuelve a él.
- **Clona** uno desde una URL o directamente desde tu hosting — mira
  [clonar](cloning.md) para las opciones que hacen que un repositorio enorme se
  clone rápido.
- Desde un terminal, `gitcito .` abre la carpeta actual en la app que ya está
  en marcha — mira [la línea de comandos](cli.md).
- Una sola carpeta que todavía no es un repositorio Git también se abre, y te
  ofrece inicializarla.

## Los tres paneles

| Panel | Qué contiene |
|---|---|
| Izquierda | Ramas, remotos, etiquetas, stashes, worktrees — y la pestaña **Archivos** para el árbol de trabajo |
| Centro | El grafo de commits, y lo que selecciones en él |
| Derecha | El compositor de commits, o los detalles del commit seleccionado |

## Cómo encontrar todo lo demás

Dos caminos, y llevan a los mismos sitios:

- **`⌘K`** (`Ctrl+K`) — la paleta de comandos. Escribe lo que quieras; también
  salta a ramas, commits y archivos.
- **Herramientas** en la barra superior — el mismo conjunto, con ámbito de
  repositorio, en forma de menú, con la cola larga plegada en grupos para que
  siga siendo legible.

![El menú Herramientas: primero las herramientas frecuentes, el resto agrupado](../../screenshots/tools-menu.webp)

Cuando la ventana se estrecha, la barra de acciones deja de competir por el espacio: los botones que ya no caben se pliegan en un menú **Más** al final, en el mismo orden y conservando sus submenús. Ensancha la ventana y vuelven a salir.

Todo lo que se alcanza por un camino se alcanza por el otro, así que no hay
nada que solo encuentren los usuarios avanzados.

## Tu primer commit

1. Edita un archivo. Aparece bajo **Sin preparar**.
2. Prepáralo — el archivo entero, un hunk, o [líneas sueltas](staging.md).
3. Escribe un mensaje y pulsa **Commit**.

Todo lo demás en Gitcito es opcional.

