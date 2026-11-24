// Website chrome in es. Keys mirror en.mjs; anything missing falls back to English.
export const es = {
  'nav.handbook': 'Manual',
  'nav.roadmap': 'Hoja de ruta',
  'nav.github': 'GitHub',
  'nav.sponsor': 'Patrocinar',
  'nav.download': 'Descargar',

  'foot.license': 'Licencia Apache 2.0 · Hecho por <a href="https://github.com/StarleyDev">Starley - Mestre Jedi</a> con 💜',
  'foot.credit': 'Un fork de {upstream}, de MyAppDesk, bajo la licencia MIT.',
  'foot.source': 'Código fuente',
  'foot.roadmap': 'Hoja de ruta',
  'foot.reportIssue': 'Informar de un problema',
  'foot.sponsor': 'Patrocinar',

  'meta.title': 'GitHuttBr — todo git, a la vista',
  'meta.description':
    'Un cliente de Git enteramente vibe-coded. Gratis. Grafo, preparación línea a línea, rebase, worktrees, submódulos, LFS — y unas pocas cosas que no sabías que git podía hacer.',

  'hero.title': 'Todo git,<br /><em>a la vista</em>',
  'hero.lede':
    'Grafo, preparación línea a línea, rebase, worktrees, submódulos, LFS.<br />Lo de siempre, bien hecho — y unas pocas cosas que no sabías que git podía hacer.',
  'hero.download': 'Descargar para tu plataforma',
  'hero.source': 'Ver el código',
  'hero.terms': 'Gratis · Apache 2.0 · v{version}',
  'hero.graphAlt': 'El grafo de commits de GitHuttBr',

  'features.title': 'Unas pocas cosas que no sabías que git podía hacer',
  'features.sub':
    'Ninguna de ellas es la razón para usar GitHuttBr — la razón es la lista de arriba. Existen porque git ya sabe la respuesta; GitHuttBr simplemente se la pregunta.',

  'ordinary.title': 'Lo que incluye',
  'ordinary.sub':
    'Un cliente completo, no un subconjunto. Todo construido, documentado y en la app hoy — las cosas de siempre, que son la mayor parte de lo que de verdad es usar git.',
  'ordinary.graph': 'Grafo de commits con carriles de verdad, en ventana para historiales enormes',
  'ordinary.staging': 'Preparación hasta línea a línea',
  'ordinary.conflicts': 'Resolutor de conflictos a tres paneles que dice qué lado es cuál',
  'ordinary.rebase': 'Rebase interactivo arrastrando',
  'ordinary.stacks': 'Ramas apiladas con recolocación en cascada',
  'ordinary.recovery': 'Reflog, instantáneas de trabajo en curso, bisect guiado',
  'ordinary.prs': 'Pull requests en GitHub, GitLab, Bitbucket y Azure DevOps',
  'ordinary.terminal': 'Terminal integrado — un PTY de verdad',
  'ordinary.launch': 'Ejecutar y depurar directamente desde <code>.vscode/launch.json</code>',
  'ordinary.ai': 'IA opcional que cita las líneas que ha leído',
  'ordinary.themes': 'Temas incluidos, claro y oscuro, más los generados por IA',
  'ordinary.languages': 'Todo traducido, manual incluido — el árabe y el hebreo reflejan la interfaz',

  'download.title': 'Descargar',
  'download.sub':
    'Última versión: <strong>v{version}</strong>. Cada build se publica desde CI.',
  'download.cli':
    'O abre un repositorio desde tu terminal con <code>githuttbr .</code> — mira <a href="{cli}">la línea de comandos</a>.',
  'download.macNote': 'Apple silicon &amp; Intel',
  'download.winNote': 'Instalador (x64)',
  'download.linuxNote': 'AppImage · deb',
  'download.forOs': 'Descargar para {os}',

  'handbook.title': 'Un manual de {pages} páginas, dentro de la app',
  'handbook.sub': 'Cada función explicada — sin conexión en la app, y aquí mismo.',

  'sponsor.title': 'Patrocina GitHuttBr',
  'sponsor.body':
    'Gratis, Apache 2.0, sin backend, sin telemetría, nada que colocarte — así que no hay nada que comprar. El patrocinio paga el certificado de Apple Developer que necesitan las builds firmadas de macOS, el manual y las traducciones. Un informe de error vale exactamente lo mismo.',
  'sponsor.cta': 'Patrocinar en GitHub',

  'doc.titleSuffix': 'Manual de GitHuttBr',
  'doc.filter': 'Filtrar páginas…',
  'doc.filterLabel': 'Filtrar páginas',
  'doc.edit': 'Editar esta página en GitHub',
  'doc.improve': 'Mejorar esta traducción en GitHub',

  'feature.conflict-radar.title': 'Radar de conflictos',
  'feature.conflict-radar.body':
    'Ve qué ramas van a dar conflicto <strong>antes</strong> de fusionar ninguna. Las fusiones ocurren dentro de la base de datos de objetos — sin checkout, sin tocar el árbol de trabajo, nada que limpiar.',
  'feature.recovery.title': 'Instantáneas de trabajo en curso',
  'feature.recovery.body':
    'Todo tu árbol de trabajo — archivos sin seguimiento incluidos — en una instantánea periódica y <strong>justo antes de cada acción destructiva</strong>. Un descarte del que te arrepientes está a una restauración de distancia.',
  'feature.commit-edit.title': 'Edita cualquier commit',
  'feature.commit-edit.body':
    '¿La errata está tres semanas atrás? Edita el archivo <strong>dentro del commit antiguo</strong> — todo lo de encima se reproduce, y la cascada entera se previsualiza antes de que se mueva una sola ref.',
  'feature.ai.title': 'Trae tus propios modelos',
  'feature.ai.body':
    'Varias cuentas de IA a la vez — una clave de OpenAI para los mensajes de commit, Claude para el chat, un Ollama local para el resto. Las listas de modelos llegan en vivo de cada proveedor, y una CLI en la que ya has iniciado sesión sirve en lugar de una clave de API.',
  'feature.semantic-diff.title': 'Diff semántico',
  'feature.semantic-diff.body':
    '<code>startServer</code> → <code>bootServer</code>, en vez de un muro rojo y verde de 400 líneas. Análisis real con tree-sitter, no una expresión regular.',
  'feature.range-diff.title': 'Qué ha cambiado desde',
  'feature.range-diff.body':
    'Han hecho force-push a la rama que revisaste. Mira qué commits se reescribieron, se descartaron o se añadieron — las posiciones antiguas salen gratis del reflog.',
  'feature.repo-chat.title': 'Chat del repositorio',
  'feature.repo-chat.body':
    'Pregunta a este repositorio y recibe una respuesta que cita las líneas que leyó. Fija los archivos y commits que debe mirar: arrástralos desde el grafo, el árbol de archivos o cualquier lugar del disco.',
  'feature.absorb.title': 'Absorber',
  'feature.absorb.body':
    'Prepara tus arreglos de revisión y deja que blame lleve cada hunk al commit que lo introdujo, como un <code>fixup!</code>.',
  'feature.time-machine.title': 'Máquina del tiempo',
  'feature.time-machine.body':
    'Arrastra un deslizador y mira cómo cambia el repositorio: los archivos aparecen, se mueven, vuelven. HEAD no se mueve y tu trabajo sin commitear queda intacto.',
  'feature.timelapse.title': 'Timelapse',
  'feature.timelapse.body':
    'Reproduce la vida entera del repositorio como una animación — y expórtala como vídeo, grabado en la propia página, sin ningún codificador que instalar.',
  'feature.pr-preview.title': 'Previsualizar un pull request',
  'feature.pr-preview.body':
    'Ejecuta el PR de otra persona — forks incluidos — sin hacer ningún commit. Sin token de API, sin un segundo remoto: la head se descarga de la ref que el host ya publica, en GitHub, GitLab, Bitbucket, Azure DevOps o Gitea.',
  'feature.mission-control.title': 'Centro de control',
  'feature.mission-control.body':
    'Todos los repositorios del espacio de trabajo en una pantalla, ordenados por lo que te reclama: primero los bloqueados, luego los que hay que sincronizar, luego los sucios, luego los tranquilos.',
  'feature.attributes.title': 'Atributos de archivo, con interfaz',
  'feature.attributes.body':
    'El archivo más útil de git que nadie escribe. Los finales de línea resueltos de una vez para todos, un changelog que deja de dar conflictos, fixtures fuera de los tarballs de publicación — y diffs legibles para Word y PDF, cuando el conversor está instalado.',
  'feature.languages.title': 'Tu idioma, probablemente',
  'feature.languages.body':
    'No una traducción de adorno de los botones — toda la interfaz, explicaciones incluidas. El árabe y el hebreo reflejan la disposición, mientras que el grafo, los diffs, las rutas y el terminal siguen de izquierda a derecha, porque esa es la dirección en la que se lee el código.',
  'feature.security.title': 'Tus secretos siguen siendo tuyos',
  'feature.security.body':
    'Sin backend. Los tokens y las entradas de la caja fuerte se cifran con el llavero de tu sistema — y nada toca ese llavero hasta que se te ha dicho para qué y has dicho que sí.',
  'feature.cli.title': 'Una GUI de Git con una CLI de verdad',
  'feature.cli.body':
    '`githuttbr .` abre un repositorio, `githuttbr blame src/api.ts -l 84` lo abre en esa línea, y `githuttbr doctor` no abre ninguna ventana: comprueba lo que el repositorio exige y sale con un código que tu CI puede leer.',
  'feature.hosting.title': 'Pull requests en cualquier servidor',
  'feature.hosting.body':
    'Crea, revisa y fusiona en GitHub, GitLab, Bitbucket, Azure DevOps y Forgejo — también en los servidores de tu empresa: GitHub Enterprise, GitLab y Bitbucket Data Center — con revisores, asignados y etiquetas elegidos del propio repositorio.',

  // The landing page: stats, showcase, security, disclaimer, downloads.
  'nav.language': 'Idioma',
  'stat.platforms': 'plataformas — macOS, Windows y Linux',
  'stat.languages': 'idiomas, manual incluido',
  'stat.pages': 'páginas de manual dentro de la app',
  'stat.servers': 'servidores nuestros de por medio',
  'showcase.more': 'Leer la página del manual',
  'more.title': 'Y más — hecho, documentado y en la app hoy',
  'hosts.title': 'Funciona con tu servidor',
  'hosts.beta': 'beta',
  'ai.compatible': 'cualquier endpoint compatible',
  'sec.keychain.title': 'Pregunta antes de usar el llavero',
  'sec.keychain.body':
    'Los tokens se cifran con el llavero del sistema, y la app pregunta antes de tocarlo. Di que no y sigue funcionando.',
  'sec.server.title': 'Un token, un servidor',
  'sec.server.body':
    'Un token de github.com, Enterprise, GitLab o Data Center solo se envía al servidor para el que se guardó.',
  'sec.plain.title': 'git nunca ve el token en claro',
  'sec.plain.body':
    'Llega a git por un endpoint privado, uno por operación — ni <code>.git/config</code>, ni la línea de comandos, ni el entorno.',
  'sec.confirm.title': 'Lo destructivo siempre pide confirmación',
  'sec.confirm.body':
    'Force push, descartar, reset duro: la confirmación dice exactamente qué se pierde, y antes se toma una instantánea.',
  'themes.title': 'Temas, atajos, perfiles — y un capibara',
  'themes.body':
    'Temas claros y oscuros, también generados por IA. Un perfil por identidad, asignado por repositorio. Ejecuta y depura desde tu <code>launch.json</code> y mira lo que dicen <code>tsc</code>, ESLint o Clippy en un panel abajo.',
  'honest.title': 'Un aviso honesto',
  'honest.body':
    'GitHuttBr es joven. <strong>GitHub</strong> es el camino más probado. GitHub Enterprise Server, GitLab autogestionado y Bitbucket Data Center están en <strong>beta</strong>: probados contra servidores simulados, todavía no contra reales. Si se rompe: bueno, <em>en mi máquina funciona</em>. Issues y PRs bienvenidos. 💜',
  'download.yours': 'Tu sistema',
  'download.macHint':
    'Aún no está firmado: la primera vez, abre <strong>Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente</strong>. En un Mac, cada versión nueva se descarga a mano.',
  'download.autoUpdate': 'Se actualiza solo con cada nueva versión.'
}
