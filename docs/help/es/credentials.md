---
title: Ayudante de credenciales
category: Seguridad
order: 73
summary: El almacén de contraseñas de git — el tercero — y por qué https te las vuelve a pedir.
keywords: credential helper ayudante credenciales contraseña password https vuelve a pedir osxkeychain wincred manager libsecret store cache git-credentials texto plano plaintext olvidar forget revocado token 401 comprobar inicio de sesión qué cuenta token en la url del remoto contraseña incrustada quitarlo de la url token in remote url embedded password invalid username or token authentication failed set-url
source: ec745a4eb35cb3d23b0af6a36d6a540b8254df62
---

# Ayudante de credenciales

GitHuttBr maneja tres tipos distintos de secreto, y es razonable que la gente
asuma que son uno solo:

| | Lo guarda |
|---|---|
| Tokens de API del hosting — PRs, issues, checks de CI | GitHuttBr, en tu [llavero del sistema](security.md) |
| Transporte `git@…` | Tu [clave SSH](ssh-keys.md), a través del agente ssh del sistema |
| **Transporte `https://`** | **El ayudante de credenciales del propio git** |

El tercero no le parece una funcionalidad a nadie hasta que falla, y entonces
produce las dos quejas más habituales de git: *¿por qué me lo vuelve a pedir?* y
*¿por qué sigue mandando el token que revoqué?*

`⌘K` → **Ayudante de credenciales**.

![El ayudante configurado, las reglas por host y el aviso de archivo en texto plano](../../screenshots/credentials.webp)

## Qué estás viendo

Cada `credential.helper` configurado, con el ámbito del que viene — `system`,
`global` y luego este repositorio. **Los ayudantes se apilan**: git pregunta a
cada uno por turno, y uno a nivel de repositorio no sustituye a uno global.

Cada uno se comprueba contra tu máquina:

| Marca | Significa |
|------|-------|
| **listo** | El programa del ayudante existe y se ejecutará |
| **no instalado** | Configurado, pero el programa no está — cada petición acaba en teclearla otra vez |
| **contraseñas en un archivo plano** | El ayudante `store` (mira abajo) |

**Reglas para hosts concretos** lista las secciones `credential.<url>.*`. Estas
ganan al ajuste llano para las URLs que encajan, y suelen ser la respuesta a
«por qué este host en concreto se comporta distinto».

## Elegir uno

| Ayudante | Dónde va la contraseña |
|--------|------------------------|
| `osxkeychain` | El llavero de macOS — cifrado, por usuario |
| `manager` | Git Credential Manager (Windows, multiplataforma) |
| `wincred` | El Administrador de credenciales de Windows |
| `libsecret` | El servicio de secretos de Linux (GNOME Keyring, KWallet) |
| `cache` | Memoria, durante 15 minutos. Nada en disco |
| `store` | **Un archivo plano en tu carpeta personal. Sin cifrar** |

GitHuttBr ofrece lo que de verdad está instalado en esta máquina, marca el que
encaja con tu sistema operativo y desactiva el resto.

**El ámbito importa.** *Para todos los repositorios* escribe en tu configuración
global, que es lo que casi siempre quieres; *solo para este repositorio* es para
ese repo raro que se autentica contra otra cosa.

## El ayudante `store` y `~/.git-credentials`

`store` escribe líneas `https://usuario:contraseña@host` en `~/.git-credentials`,
en texto plano, sin cifrado de ningún tipo. Cualquier cosa que se ejecute como
tú puede leerlo: un script, el postinstall de una dependencia, lo que sea.

Si ese archivo existe, esta página lo dice y cuenta las entradas. Nunca las
muestra — el recuento es justo el objetivo, y leer el contenido para enseñarlo
sería cometer el mismo error.

Si te encuentras uno y no era tu intención: elige aquí un ayudante de verdad,
luego borra el archivo y vuelve a autenticarte una vez.

## Olvidar una credencial guardada

Cuando un token se revoca o se rota, el ayudante sigue entregando el viejo y
cada push falla con un 401 que no nombra nada. **Olvidar** le pide al ayudante
configurado que borre su entrada para ese host — `git credential reject`, que es
la vía documentada del propio git.

Por el camino no se lee nada: GitHuttBr nunca llama a `git credential fill`, el
comando que imprimiría una contraseña viva por la salida estándar.

El siguiente push te pregunta una vez, y el ayudante guarda la nueva respuesta.

## Qué cuenta usa un push

Cada URL de push se comprueba por separado. Un scope de escritura es solo una capacidad del token. No se comprueban la pertenencia al repositorio, las reglas de rama ni el permiso para cambiar un archivo concreto. Las lecturas públicas pueden funcionar sin credencial.

![Comprobación del inicio de sesión del remoto](../../screenshots/remote-sign-in.webp)

Un push puede iniciar sesión de varias formas: el token de un perfil, un inicio de
sesión de la GitHub CLI vinculado a un perfil, el helper propio de git, una
contraseña olvidada en la URL del remoto o una clave SSH. Cuando se rechaza, primero
hay que saber cuál de ellas usó. Haz clic derecho en un remoto de la barra lateral y
elige **Comprobar inicio de sesión…** (o *Comprobar inicio de sesión de los remotos*
en la paleta de comandos). La comprobación resuelve la credencial igual que un push y
luego pregunta al host por ella:

| Muestra | De dónde sale |
|----------|--------------------|
| La fuente, y el [perfil](profiles.md) que hay detrás | La misma precedencia que aplica un push — el perfil vinculado al repositorio, si no el activo, si no el helper de git |
| La cuenta | La respuesta del propio host (`/user`), no lo que se escribió en Ajustes |
| Los scopes | La cabecera `X-OAuth-Scopes` de GitHub; la descripción que GitLab da de su propio token |
| Lo que permiten | Scopes de escritura del token (`repo` en GitHub, `write_repository` en GitLab), y en GitHub si `.github/workflows` puede cambiar |

También señala una credencial que el host rechaza (caducada o revocada), una cuenta
vinculada que ya no tiene sesión iniciada y una contraseña guardada en texto plano en
la URL del remoto.

**Límites.** Un token de GitHub de grano fino no lista sus permisos, así que si puede
hacer push aparece como desconocido hasta que un push lo intenta. Forgejo informa de
la cuenta pero no de los permisos del token. Azure DevOps y Bitbucket se muestran solo
con fuente y perfil. Los remotos SSH no se comprueban, pero [Claves SSH](ssh-keys.md)
lista lo que tiene el agente. La comprobación pregunta al helper de git en silencio:
un helper que necesitaría una ventana de inicio de sesión cuenta como vacío.

## Una contraseña guardada en la URL del remoto

Un clon antiguo, o una URL pegada desde una wiki, puede llevar su credencial dentro de
la dirección: `https://user:token@git.example.test/team/app.git`. **Una contraseña en
la URL siempre tiene prioridad:** git la envía y no pregunta a ningún helper — ni al
token del [perfil](profiles.md) del repositorio, ni a la GitHub CLI, ni al almacén
propio de git. Mientras el token funciona, no pasa nada, y GitHuttBr lo deja estar:
**nunca quita una contraseña de una URL sin preguntarte.** En cuanto el token se
revoca o caduca, cada fetch, pull y push de ese repositorio falla con *Invalid username
or token* o *Authentication failed*, mientras los demás repositorios del mismo perfil
funcionan. Y el token queda en texto plano en el `.git/config` del repositorio.

![Quitar un token guardado de la URL de un remoto](../../screenshots/remote-url-token.webp)

GitHuttBr lee las URL de fetch y de push de cada remoto y lo indica en tres sitios:

| Dónde | Qué ves |
|-------|--------------|
| Un fetch, pull o push fallido | El error explica que la URL del remoto contiene una contraseña guardada, con **Quitarlo de la URL…** |
| La barra lateral | Un discreto icono de llave en la fila del remoto: su URL contiene una contraseña que tiene prioridad sobre el token del perfil. La misma acción está en su menú contextual |
| **Comprobar inicio de sesión…** | El remoto muestra la contraseña como su fuente, con el mismo botón |

La acción pregunta antes. Quita la contraseña de todas las URL de ese remoto — la URL
de fetch y cada URL de push que la tenga — y no escribe nada salvo `.git/config`. Lo
que pasa después depende de qué más puede iniciar sesión:

| Después de quitarla | Qué usan fetch y push |
|---------------|-------------------------|
| El perfil del repositorio tiene un token o una cuenta vinculada para ese host | Ese token — la confirmación no dice nada más |
| Sin token de perfil, pero el helper propio de git tiene un inicio de sesión para el host | El inicio de sesión del helper |
| Ninguno de los dos | Nada: fetch y push fallan hasta que añadas un token. La confirmación lo dice antes y ofrece **Añadir antes un token**, que abre Ajustes → Integraciones |

Cuando se lanzó desde una operación fallida, ofrece **Reintentar**.

**No hay deshacer, a propósito.** Deshacer volvería a escribir el secreto en el
archivo en texto plano, que es justo lo que la acción existe para evitar. Si el token
antiguo aún pudiera funcionar, revócalo en el servidor: ha estado legible para
cualquier cosa que pudiera leer la carpeta del repositorio.

**Límites.**

- También se va el nombre de usuario (`https://git.example.test/…`), como cuando
  ejecutas `git remote set-url` a mano; la confirmación lo dice. Un servidor que lo
  necesita en la URL — un token de Bitbucket Data Center sin nombre de usuario en el
  perfil — necesita que lo vuelvas a añadir con **Editar el remoto…**.
- Un nombre de usuario solo (`https://user@host/…`) no se señala: git sigue pidiendo
  al helper la contraseña de ese usuario, así que no hay nada secreto guardado.
- Las URL SSH se dejan como están: `git@host:…` y `ssh://git@host/…` nombran el
  usuario que usa ssh, no una credencial.
- El prefijo de un helper remoto (`persistent-https::https://…`, `gcrypt::…`) se
  conserva; la URL que sigue se lee y se limpia como cualquier otra.
- **Las URL ambiguas no se ofrecen para quitar.** Cuando los lectores no coinciden en
  dónde empieza el host — una `@` después de un `?` o un `#` en la dirección, o una
  contraseña con una `/` sin codificar —, cortar en la `@` equivocada apuntaría el
  remoto a otro servidor. Una URL así solo se muestra censurada, y el icono de llave
  abre **Editar el remoto…** para que la corrijas a mano.
- Solo se lee y se cambia `.git/config`. Una URL reescrita por una regla
  `url.<base>.insteadOf`, o un remoto definido en tu configuración global, no se
  inspecciona — y renombrar un remoto nunca copia a la configuración del repositorio
  una contraseña que añade una regla `insteadOf`.
- La contraseña nunca sale del proceso principal: las URL de los remotos llegan a la
  ventana, al menú de copiar la URL y al diálogo de edición sin ella. Guardar el
  diálogo de edición con la URL que mostraba no cambia nada y conserva la contraseña;
  **cambiar el host o la ruta la descarta**, ya que la URL que escribiste se guarda tal
  cual. Solo esta acción quita una contraseña conservando la dirección.

## Límites que conviene conocer

- **Este es el almacén de git, no el de GitHuttBr.** Cambiarlo cambia también lo
  que hace tu terminal — que es justo la gracia, y conviene saberlo antes de
  tocarlo.
- **Los ayudantes de nivel de sistema se muestran, pero no se editan.** Viven en
  una configuración que solo un administrador puede escribir.
- **GitHuttBr no puede listar lo que guarda un ayudante.** Ninguna API de
  credenciales expone eso sin entregar los secretos, así que el diálogo informa
  de la configuración y borra cuando se lo pides, y nada más.
- **Un token que le diste a GitHuttBr es otra cosa.** Revocar uno no toca el otro;
  mira [seguridad](security.md) para la parte del llavero.
- **El token de un perfil queda fuera del entorno de los hooks del repositorio.** Un
  hook solo ve un código para un punto de acceso privado, válido mientras corre ese
  comando git — suficiente para un hook que pregunta a propósito, como hace git-lfs.
  Ver [el token de un perfil mientras corre git](security.md#el-token-de-un-perfil-mientras-git-se-ejecuta).

Ver también: [Seguridad](security.md) · [Claves SSH](ssh-keys.md) ·
[Sincronizar](syncing.md)
