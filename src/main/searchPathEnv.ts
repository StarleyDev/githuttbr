/**
 * Strip search-path entries that resolve against the current directory.
 *
 * Every git Gitcito runs has its cwd set to a repository — a repository the
 * user may have just cloned from a stranger. An empty entry in a colon list
 * (`a::b`, a leading or trailing `:`) means "the current directory" to the
 * dynamic loader and to `execvp`, and so does `.` or any relative path. With
 * one of those in `LD_LIBRARY_PATH`, a `libz.so.1` committed to that repository
 * is loaded into git: code execution from a clone.
 *
 * That is not hypothetical. electron-builder 24's AppImage launcher exports
 * `LD_LIBRARY_PATH="${APPDIR}/usr/lib:${LD_LIBRARY_PATH}"`, which leaves a
 * trailing empty entry whenever the variable was unset — the common case. The
 * launcher is outside our code, so the main process repairs the environment
 * before anything can spawn, and every child (simple-git, execFile, the pty)
 * inherits the repaired `process.env`. electron-builder 26.15+ fixed its
 * launcher (GHSA-7g7r-gx96-252g); this stays, because the variable can arrive
 * broken from the user's shell or a desktop launcher too.
 *
 * Policy:
 * - Empty entries and `.` are always removed. They are never what anyone meant
 *   for a process whose cwd is an arbitrary repository.
 * - Other relative entries are removed only inside an AppImage (`APPIMAGE` set),
 *   where the launcher, not the user, shaped the variable. Elsewhere a relative
 *   entry was put there deliberately, and is left alone.
 * - `LD_PRELOAD` lists libraries, not directories: an empty token is ignored by
 *   the loader and a bare name (`libfoo.so`) is looked up through the library
 *   search path, not the cwd. Only a token with a slash that is not absolute
 *   (`./x.so`, `lib/x.so`) reads from the cwd, so that is the only kind removed
 *   (under the same AppImage rule); bare names keep their meaning.
 *
 * A variable that ends up with no entries is deleted rather than set to `''`.
 * Windows is skipped: its PATH is `;`-separated and the loader rules differ.
 */

/** Colon-separated directory lists the loader or `execvp` consults. */
const DIR_LISTS = ['LD_LIBRARY_PATH', 'PATH', 'XDG_DATA_DIRS'] as const

export interface SanitizeOptions {
  /** Also drop relative entries (default: whether `APPIMAGE` is set in `env`). */
  dropRelative?: boolean
  /** Defaults to `process.platform`; `win32` is a no-op. */
  platform?: NodeJS.Platform
}

/** One colon-list value with cwd-relative directory entries removed. */
export function sanitizeDirList(value: string, dropRelative: boolean): string {
  return value
    .split(':')
    .filter((entry) => entry !== '' && entry !== '.' && (!dropRelative || entry.startsWith('/')))
    .join(':')
}

/**
 * `LD_PRELOAD` (space or colon separated) with cwd-relative library paths
 * removed, or the value unchanged when there are none. Empty tokens are not
 * worth a rewrite: the loader already skips them.
 */
export function sanitizePreload(value: string, dropRelative: boolean): string {
  const tokens = value.split(/[ :]/).filter(Boolean)
  const kept = tokens.filter((entry) => !dropRelative || !entry.includes('/') || entry.startsWith('/'))
  return kept.length === tokens.length ? value : kept.join(':')
}

/**
 * Repair `env` in place. Returns the names of the variables it changed, so the
 * caller can log what was done without logging values.
 */
export function sanitizeSearchPathEnv(env: NodeJS.ProcessEnv, opts: SanitizeOptions = {}): string[] {
  if ((opts.platform ?? process.platform) === 'win32') return []
  const dropRelative = opts.dropRelative ?? !!env['APPIMAGE']
  const changed: string[] = []
  const apply = (key: string, clean: (value: string) => string): void => {
    const value = env[key]
    if (value === undefined) return
    const next = clean(value)
    if (next === value) return
    if (next) env[key] = next
    else delete env[key]
    changed.push(key)
  }
  for (const key of DIR_LISTS) apply(key, (v) => sanitizeDirList(v, dropRelative))
  apply('LD_PRELOAD', (v) => sanitizePreload(v, dropRelative))
  return changed
}
