---
title: Ejecuciones de CI
category: Sincronizar y muchos repos
order: 59
summary: Sigue GitHub Actions, pipelines de GitLab, Azure Pipelines y Forgejo Actions desde la app — cada job, sus pasos y su log, con reejecutar y cancelar.
keywords: ejecuciones de ci ci runs actions workflow pipeline build github actions gitlab pipelines azure pipelines forgejo actions jobs pasos steps logs reejecutar rerun re-run cancelar cancel dispatch workflow_dispatch insignia badge estado status grafo graph
---

# Ejecuciones de CI

Hiciste push y ahora esperas: cambias al navegador, buscas el repositorio, abres
Actions, buscas tu ejecución, abres el job que se puso en rojo, bajas hasta el
final del log. **Ejecuciones de CI** pone ese ciclo junto al código. Una página
te dice cómo le ha ido últimamente a cada workflow, lista las ejecuciones del
remoto de la más nueva a la más antigua y abre una ejecución fallida directamente
en el test que se rompió — con el archivo y la línea, a un clic de tu editor. Los
botones para volver a ejecutarla o detenerla están en la tarjeta.

Habla con la API del propio host usando el token que ya le diste a GitHuttBr.
Nada se ejecuta en tu máquina — para eso, mira [CI local](local-ci.md).

![La página Ejecuciones de CI: una tarjeta por workflow con sus últimas ejecuciones, los filtros Fallaron y En curso, el progreso de una ejecución en curso y una ejecución fallida abierta en el test que se rompió y en sus jobs](../../screenshots/ci-runs.webp)

## Abrirla

**Herramientas → Ejecuciones de CI…**, o *Ejecuciones de CI* en la paleta de
comandos (⌘K). La página va en la pestaña del repositorio, como la wiki y los
insights, y lee el remoto llamado `origin` — o el primer remoto, cuando no hay
`origin`.

## Qué muestra la página

| Parte | Qué es |
|---|---|
| **Tarjetas de workflow** | Una tarjeta por workflow: qué lo dispara, su tasa de éxito en sus últimas 10 ejecuciones terminadas (verde desde el 90 %, ámbar desde el 70 %, rojo por debajo), esas ejecuciones como cuadrados de color — la más antigua a la izquierda, para que la más nueva quede junto a «ahora» —, su tiempo medio y, o bien su job más lento, o cómo fue su última ejecución. Un clic en una tarjeta lista solo las ejecuciones de ese workflow; otro clic las muestra todas |
| **Todas las ramas / Rama actual** | Todas las ejecuciones del remoto, o solo la rama que tienes en checkout |
| **Fallaron / En curso** | Filtros rápidos con el número de ejecuciones que dejaría cada uno. Cuentan lo que dejan los demás filtros, así que el número es lo que muestra un clic |
| **Filtro** | Reduce las ejecuciones cargadas por título, workflow, rama, autor, commit o evento |
| **Una tarjeta de ejecución** | El título del commit (o el nombre del workflow), luego la rama, el workflow y el número de ejecución, qué la inició (push, pull request, programada, manual…), quién la inició y el commit — un clic en el commit lo copia. Cuando la ejecución pertenece a una pull request, **PR #n** abre la página de esa pull request. A la derecha: en qué estado está, cuánto tardó y hace cuánto |
| **Una ejecución en curso** | *En curso · paso 3 de 5*, una barra de progreso y el tiempo transcurrido. El paso es el del job en curso; en un host sin pasos (GitLab, Forgejo) cuenta jobs en su lugar |
| **El test fallido** | Una ejecución fallida se abre sola, la más nueva primero, con el test que nombra su log: el job, el test, la primera línea del error y **ruta:línea** — haz clic en ella, o en *Abrir en el editor*, para llegar a esa línea. La misma lectura que la [pestaña Checks](hosting.md#la-pestaña-checks) de una pull request |
| **Jobs** | Debajo, cada job con su estado y su duración, agrupados por stage donde el host tiene stages (GitLab, Azure). *Ver pasos y log* abre los pasos de un job y el final de su log — en un job fallido está siempre ahí, en los demás aparece al pasar el ratón por el job |
| **Pasos** | Cada paso de un job, con su estado y su duración — GitHub, Azure y Forgejo los informan; GitLab no tiene pasos |
| **Log** | El final del log de un job terminado, con sus colores. Solo se descargan los últimos 512 KB — donde está el fallo — y la página avisa cuando se omitió el principio |

Mientras algo de la página está en cola o en curso, la lista vuelve a preguntar
al host cada 15 segundos, y con ella los jobs de la ejecución abierta y de cada
ejecución en curso — de ahí sale el número de paso; las duraciones avanzan cada
segundo. Cuando dos minutos de respuestas no traen nada nuevo — una ejecución
que espera la aprobación de un despliegue, por ejemplo —, baja a una vez por
minuto, y vuelve a acelerar en cuanto algo se mueve. Una lista donde todo ha
terminado no pregunta nada hasta que pulsas actualizar, y no se pregunta nada
mientras la ventana está oculta.

Una ejecución que el host envía sin título — cada pipeline de GitLab, un build
programado de Azure — se nombra por el asunto de su commit cuando el commit está
en el grafo, leído de tu repositorio local sin coste; si no, por su número.

## Reejecutar, cancelar, iniciar

| Botón | Aparece cuando | Qué pasa |
|---|---|---|
| **Reejecutar fallidos** | La ejecución falló o se canceló | Solo los jobs que no pasaron se ejecutan de nuevo |
| **Reejecutar** (↻) | La ejecución terminó, en GitHub — en la tarjeta al pasar el ratón | Todos los jobs se ejecutan de nuevo |
| **Abrir en el navegador** | Al pasar el ratón por una tarjeta | La ejecución en el sitio del host |
| **Cancelar** | La ejecución está en cola o en curso | Pregunta antes: los jobs en curso se interrumpen y su trabajo se pierde |
| **Ejecutar workflow** | El host permite iniciar uno a mano | Elige el workflow y una rama; arranca como si esa rama se hubiera subido, y aparece en la lista unos segundos después |

Lo que permite cada host:

| Host | Lista y jobs | Pasos | Log | Reejecutar todo | Reejecutar fallidos | Cancelar | Iniciar a mano |
|---|---|---|---|---|---|---|---|
| **GitHub** (y Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — el workflow necesita un disparador `workflow_dispatch` |
| **GitLab** (y autogestionado) | ✓ — pipelines, jobs por stage | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — ejecuta `.gitlab-ci.yml` en la rama |
| **Azure DevOps** | ✓ — builds, jobs por stage | ✓ (tareas) | ✓ | — | ✓ | ✓ | ✓ — cualquier definición de build del repositorio |
| **Forgejo / Gitea** | ✓ en servidores con la API de ejecuciones de Actions | ✓ | ✓ cuando el servidor lo entrega a un token | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Insignias en el grafo

La misma CI aparece como una pequeña insignia junto a cada commit en el grafo:
verde, roja o un reloj mientras se ejecuta. Pasa el ratón para ver los jobs; haz
clic para ir a la página del host. Las insignias salen de:

| Host | Fuente |
|---|---|
| GitHub | Los check runs del commit — cualquier CI que informe a GitHub, no solo Actions |
| GitLab | Los estados del commit, que incluyen cada job del pipeline. Un job manual (un despliegue, por ejemplo) no deja la insignia atascada en el reloj |
| Azure DevOps | Los 100 builds más recientes del repositorio, emparejados por commit |
| Forgejo / Gitea | El estado combinado del commit — Forgejo Actions y cualquier CI externa |
| Bitbucket Data Center | Los estados de build del commit |

Cada respuesta se recuerda — incluida «aquí no hay CI» — y a un commit solo se le
vuelve a preguntar cuando su respuesta puede haber cambiado: cada 45 segundos
mientras se ejecuta, cada 10 minutos una vez terminado, y cada vez con menos
frecuencia para un commit que nunca tuvo CI. Así un grafo concurrido se mantiene
dentro de la cuota por hora del host.

## Límites

- **Las tarjetas solo conocen las ejecuciones que listó la página.** Son las
  últimas 50 ejecuciones del filtro de rama vigente — un workflow que se ejecuta
  poco puede mostrar menos de diez cuadrados, y cambiar a la rama actual
  recalcula todas las tarjetas. El job más lento aparece en cuanto la página ha
  leído los jobs de alguna ejecución terminada (basta la ejecución fallida que
  abre); hasta entonces la tarjeta dice cómo fue la última ejecución.
- **El test fallido se lee del texto del log.** Se reconocen Vitest, Jest y
  pytest; cualquier otro runner, un error de build o un log cortado muestran solo
  la lista de jobs. Una ruta que el runner escribió fuera del checkout no se
  puede abrir.
- **PR #n depende de lo que diga el host.** GitHub indica la pull request solo
  para ejecuciones del mismo repositorio, no de un fork; GitLab lo indica en los
  pipelines de merge request y Azure en los builds de PR. Las ejecuciones de
  Forgejo no llevan enlace.
- **El log es el final, y solo cuando un job termina.** GitHub y Forgejo
  entregan el log de un job cuando ha terminado; mientras se ejecuta, la página
  muestra sus pasos avanzando, no su salida. GitLab y Azure sirven el log de un
  job en curso hasta ese momento — vuelve a abrirlo para leer más.
- **El token necesita acceso a la CI.** Un token de GitHub de grano fino
  necesita *Actions: read* para listar y *Actions: write* para reejecutar,
  cancelar o iniciar; uno clásico necesita `repo`. Un token de GitLab necesita
  `read_api` para listar y `api` para los botones. Un token de Azure necesita
  *Build: read* (y *Build: read & execute* para los botones); sin él, la página y
  las insignias se quedan vacías en lugar de fallar.
- **Las insignias de Azure solo llegan a 100 builds atrás.** Un commit más
  antiguo no tiene insignia, aunque la página Ejecuciones de CI siga listando su
  build.
- **La reejecución de Azure es «reintentar fallidos».** Funciona en pipelines
  YAML con stages; un pipeline clásico puede rechazarla, y la página muestra la
  respuesta del host.
- **Iniciar un workflow no pide sus entradas.** El host rechaza un workflow de
  GitHub o un pipeline de GitLab con entradas obligatorias sin valor por
  defecto, con su propio mensaje.
- **Forgejo es de solo lectura, y solo en servidores recientes.** Los servidores
  Forgejo y Gitea antiguos no tienen API para listar ejecuciones; la página dice
  que el host no está soportado, y las insignias del grafo siguen funcionando a
  través de los estados de commit. Un repositorio que el token no puede ver
  aparece como un error de acceso, no como «no soportado».
- **Bitbucket no tiene página de ejecuciones.** En Data Center, la CI es un
  sistema externo (Jenkins, Bamboo…) que solo informa un estado — ese estado es
  la insignia del grafo. Bitbucket Pipelines de bitbucket.org no está soportado.
- **Un solo remoto.** La página lee `origin`; las ejecuciones en el otro remoto
  de un fork no se listan.

**Ver también:** [CI local](local-ci.md) · [Hosting y pull requests](hosting.md)
