/**
 * Paths an AppImage build must never write into a file that outlives it.
 *
 * An AppImage runs from a FUSE mount the runtime creates per launch —
 * `/tmp/.mount_<name><random>/` — or, with `--appimage-extract-and-run`, from
 * `/tmp/appimage_extracted_<hash>/`. `process.resourcesPath` lives under it.
 * The directory is gone the moment the app quits, its name changes every launch,
 * and it sits in world-writable, sticky /tmp: once it has vanished, any other
 * local user may create it again with a script of their own at the same path.
 *
 * So a path under it written into `~/.local/bin` (the CLI symlink) or into a
 * repository's `.git/config` (`diff.<name>.textconv`) is a loaded gun pointed
 * at the next `githuttbr` or `git diff`. These helpers decide when a path is that
 * kind of path. Pure — no Electron, no filesystem — so the decisions are tested
 * on their own (test/appImagePaths.test.ts).
 */

type Env = Record<string, string | undefined>

/** Directory names the AppImage runtimes give the app's root. */
const EPHEMERAL_SEGMENT = /(^|[\\/])(\.mount_[^\\/]*|appimage_extracted_[^\\/]*)([\\/]|$)/

function within(path: string, root: string): boolean {
  const base = root.replace(/[\\/]+$/, '')
  return base !== '' && (path === base || path.startsWith(`${base}/`))
}

/** True when this process was started from an AppImage (the runtime sets `APPIMAGE`). */
export function runningFromAppImage(env: Env = process.env): boolean {
  return !!env['APPIMAGE']
}

/**
 * True when `path` lies inside an AppImage's per-launch root — this one's
 * (`APPDIR`) or any other: a stale path from an earlier launch names a mount
 * that no longer exists, which is precisely the dangerous case.
 */
export function isEphemeralAppPath(path: string, env: Env = process.env): boolean {
  if (!path) return false
  if (runningFromAppImage(env) && env['APPDIR'] && within(path, env['APPDIR'])) return true
  return EPHEMERAL_SEGMENT.test(path)
}

/**
 * Why a path inside the app (a bundled shim) may not be written into a file
 * that outlives this process, or null when it may. Under an AppImage the whole
 * app root is ephemeral, so `resourcesRoot` is refused even when its name does
 * not look like a mount (an extracted or custom-runtime AppImage).
 */
export function persistBlocker(path: string, resourcesRoot: string, env: Env = process.env): 'appimage' | null {
  if (isEphemeralAppPath(path, env)) return 'appimage'
  if (runningFromAppImage(env) && resourcesRoot && within(path, resourcesRoot)) return 'appimage'
  return null
}

/** The program a `textconv` command line runs: a quoted path, or the first word. */
export function textconvProgram(textconv: string): string {
  const m = /^"([^"]+)"|^'([^']+)'|^(\S+)/.exec(textconv.trim())
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : ''
}

/** A mount or extraction dir named anywhere on a command line, not only as a whole path. */
const EPHEMERAL_ANYWHERE = /(^|[^\w.-])(\.mount_|appimage_extracted_)/

/** A glob character right before a mount or extraction name: `/tmp/[.]mount_x`, `/tmp/?mount_x`. */
const GLOBBED_EPHEMERAL = /[?*[\]](mount_|appimage_extracted_)/
const GLOB_CHARS = /[?*[]/

/**
 * True when the line names a glob inside the temp directory, or a glob right
 * before a mount name. The shell expands a glob before git runs the command,
 * so `/tmp/.moun?_X/…` or a `*` under /tmp reaches the mount without ever
 * spelling its name. Nothing a real converter is configured with globs into
 * /tmp, so treating any such word as ephemeral costs no false alarms.
 */
function globsIntoTemp(line: string, env: Env): boolean {
  if (GLOBBED_EPHEMERAL.test(line)) return true
  const roots = ['/tmp', env['TMPDIR'] ?? ''].map((r) => r.replace(/[\\/]+$/, '')).filter((r) => r !== '')
  return line
    .split(/[\s=;&|()`<>]+/)
    .some((word) => GLOB_CHARS.test(word) && roots.some((root) => within(word, root)))
}

/**
 * True when a configured textconv reaches into an AppImage mount anywhere on
 * its line. Git runs textconv through a shell, so the program is not the only
 * word that executes: `env /tmp/.mount_x/…`, `FOO=1 "/tmp/.mount_x/…"` and
 * `sh -c '/tmp/.mount_x/…'` all run the mount. Quotes and backslashes are
 * dropped first (the shell would), and any occurrence counts — a false alarm
 * costs a Remove click, a miss runs someone else's script on the next diff.
 * Under an AppImage, this launch's APPDIR and `resourcesRoot` count too.
 */
export function isEphemeralTextconv(textconv: string, env: Env = process.env, resourcesRoot = ''): boolean {
  if (isEphemeralAppPath(textconvProgram(textconv), env)) return true
  const line = textconv.replace(/["'\\]/g, '')
  const slashed = textconv.replace(/["']/g, '').replace(/\\/g, '/')
  if (EPHEMERAL_ANYWHERE.test(line) || EPHEMERAL_ANYWHERE.test(slashed)) return true
  if (globsIntoTemp(slashed, env)) return true
  if (!runningFromAppImage(env)) return false
  return [env['APPDIR'] ?? '', resourcesRoot].some((root) => {
    const base = root.replace(/[\\/]+$/, '')
    return base !== '' && (line.includes(base) || slashed.includes(base))
  })
}
