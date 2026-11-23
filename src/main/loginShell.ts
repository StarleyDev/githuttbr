import { accessSync, constants, readFileSync, realpathSync, statSync } from 'fs'
import { userInfo } from 'os'
import { basename, dirname, isAbsolute, join } from 'path'

/**
 * Which shell the terminal, launch tasks and the PATH probe run on macOS/Linux.
 *
 * A valid `$SHELL` wins: it is the shell the user's session actually runs, and
 * people do keep an account shell they never use (fish in passwd, zsh in
 * SHELL). When SHELL is missing or unusable — a GUI app can start without it —
 * the account database (`getpwuid`, Directory Services on macOS) is next. A
 * `chsh` therefore shows after a relogin, or at once through the Settings picker.
 */

/** Everything the decision reads from the machine — injected so tests can fake it. */
export interface ShellProbe {
  platform: NodeJS.Platform
  /** The account's login shell (`os.userInfo().shell`); null when unknown. */
  accountShell: () => string | null | undefined
  envShell: string | undefined
  isExecutable: (file: string) => boolean
  /** Entries of /etc/shells, or null when the file does not exist. */
  etcShells: () => string[] | null
  warn: (message: string) => void
}

/** Settings values that name a Windows shell — meaningless on macOS/Linux. */
export const WINDOWS_SHELL_PRESETS: readonly string[] = ['powershell', 'pwsh', 'cmd', 'gitbash', 'wsl']

// Shells that understand `-l` (login). A wrong flag makes the shell refuse to
// start, so an unknown custom shell gets no arguments at all.
const LOGIN_CAPABLE = new Set([
  'sh', 'bash', 'zsh', 'ksh', 'mksh', 'oksh', 'pdksh', 'dash', 'ash', 'yash', 'fish', 'tcsh', 'csh', 'nu', 'xonsh'
])

// Shells whose `-c` speaks POSIX sh — the launch command lines (`a && exec b`,
// `( … )` subshells) and the PATH probe are written in that syntax.
const POSIX_SYNTAX = new Set(['sh', 'bash', 'zsh', 'ksh', 'mksh', 'oksh', 'pdksh', 'dash', 'ash', 'yash'])

// /etc/shells lists these, but none is a shell anyone wants a terminal in.
const NOT_INTERACTIVE = new Set([
  'nologin', 'false', 'true', 'git-shell', 'rbash', 'scponly', 'systemd-home-fallback-shell', 'sync'
])

/** `zsh` for `/opt/homebrew/bin/zsh`, `bash` for `bash-5.2` or `-bash`. */
export function shellName(file: string): string {
  return basename(file).replace(/^-/, '').replace(/[-.\d]+$/, '').toLowerCase()
}

/** Arguments that make `file` a login shell, so ~/.zprofile, ~/.bash_profile and
 *  ~/.config/fish's login sections run — where version managers live. */
export function loginArgs(file: string): string[] {
  return LOGIN_CAPABLE.has(shellName(file)) ? ['-l'] : []
}

export function isPosixSyntax(file: string): boolean {
  return POSIX_SYNTAX.has(shellName(file))
}

export function isFish(file: string): boolean {
  return shellName(file) === 'fish'
}

/** Parse /etc/shells: absolute paths, comments and blanks dropped. */
export function parseEtcShells(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter((l) => l.startsWith('/'))
}

/** A path usable as a terminal shell, or null with the reason logged. Not being
 *  in /etc/shells is only logged: Homebrew shells are often missing from it. */
function validate(file: string | null | undefined, probe: ShellProbe, source: string): string | null {
  const f = file?.trim()
  if (!f) return null
  if (!isAbsolute(f) || NOT_INTERACTIVE.has(shellName(f)) || !probe.isExecutable(f)) {
    probe.warn(`Ignoring ${source} shell ${f}: not an executable interactive shell`)
    return null
  }
  const listed = probe.etcShells()
  if (listed && !listed.includes(f)) probe.warn(`Using ${source} shell ${f}, which /etc/shells does not list`)
  return f
}

/** The resolution order, pure: SHELL → account shell → the OS default → /bin/sh. */
export function pickSystemShell(probe: ShellProbe): string {
  if (probe.platform === 'win32') return probe.envShell || 'powershell.exe'
  const found = validate(probe.envShell, probe, 'SHELL') ?? validate(probe.accountShell(), probe, 'account')
  if (found) return found
  const fallback = probe.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
  return probe.isExecutable(fallback) ? fallback : '/bin/sh'
}

function executable(file: string): boolean {
  try {
    if (!statSync(file).isFile()) return false
    accessSync(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function readEtcShells(): string[] | null {
  try {
    return parseEtcShells(readFileSync('/etc/shells', 'utf8'))
  } catch {
    return null
  }
}

const warned = new Set<string>()

/** The real machine. Warnings go to the log once each — the probe runs per terminal. */
export function machineProbe(): ShellProbe {
  return {
    platform: process.platform,
    accountShell: () => {
      try {
        return userInfo().shell
      } catch {
        // No passwd entry (some containers): fall through to the OS default.
        return null
      }
    },
    envShell: process.platform === 'win32' ? process.env['COMSPEC'] : process.env['SHELL'],
    isExecutable: executable,
    etcShells: readEtcShells,
    warn: (m) => {
      if (warned.has(m)) return
      warned.add(m)
      console.warn(m)
    }
  }
}

let cached: string | null = null

/**
 * The user's shell. Cached, but `refresh` re-reads it — a new terminal asks
 * for that (a stat or two), so a shell installed or removed meanwhile, or an
 * account shell changed while SHELL is unusable, shows in the next terminal.
 */
export function systemShell(refresh = false): string {
  if (refresh || cached === null) cached = pickSystemShell(machineProbe())
  return cached
}

/** A shell whose `-c` takes POSIX syntax: the user's when it is one (bash,
 *  zsh…), else the OS default — a fish or nu user's launch tasks still run. */
export function posixShell(refresh = false): string {
  const sys = systemShell(refresh)
  if (isPosixSyntax(sys)) return sys
  const fallback = process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
  return executable(fallback) ? fallback : '/bin/sh'
}

/**
 * How a launch task's sh-syntax command line is started. In the user's own
 * POSIX shell it is a login shell, so version managers in ~/.zprofile load.
 * When it stands in for fish or nu it is not: a login bash runs /etc/profile,
 * which on Debian/Ubuntu resets PATH, and the stand-in never reads the user's
 * own config anyway — keeping the PATH the app already probed from that shell
 * is the only way the task finds the same tools.
 */
export function launchArgs(system: string, commandLine: string): string[] {
  return isPosixSyntax(system) ? ['-lic', commandLine] : ['-ic', commandLine]
}

/** The shell that reads the login PATH: the user's when it is POSIX or fish (the
 *  probe has a script for each); tcsh cannot combine `-l` with `-c`, and nu or
 *  xonsh speak neither, so those fall back to the POSIX shell. */
export function pathProbeShell(system: string, posix: string): string {
  return isPosixSyntax(system) || isFish(system) ? system : posix
}

export interface ResolvedShell {
  file: string
  args: string[]
  /** The configured custom shell that could not be used, so the caller can say so. */
  missing?: string
}

/**
 * The `terminalShell` setting on macOS/Linux. '' / 'system' / any Windows
 * preset (the stored default is 'powershell') → the system shell; an absolute
 * path → that executable, or the system shell plus `missing` when it is not one.
 */
export function resolvePosixShell(setting: string | undefined, probe: ShellProbe, system: string): ResolvedShell {
  const sel = setting?.trim() ?? ''
  const sys = { file: system, args: loginArgs(system) }
  if (!sel || sel === 'system' || WINDOWS_SHELL_PRESETS.includes(sel)) return sys
  if (!isAbsolute(sel) || !probe.isExecutable(sel)) return { ...sys, missing: sel }
  return { file: sel, args: loginArgs(sel) }
}

/**
 * The /etc/shells entries a terminal can use, for the settings picker: present,
 * executable, interactive, and one per real location — Arch lists both
 * /bin/bash and /usr/bin/bash, which are the same file through a symlinked dir.
 * Only the directory is resolved, so /bin/sh (a link to bash) stays its own entry.
 */
export function listShells(probe: ShellProbe = machineProbe()): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const file of probe.etcShells() ?? []) {
    if (NOT_INTERACTIVE.has(shellName(file)) || !probe.isExecutable(file)) continue
    let key = file
    try {
      key = join(realpathSync(dirname(file)), basename(file))
    } catch {
      /* keep the path as written */
    }
    if (seen.has(key)) continue
    seen.add(key)
    out.push(file)
  }
  return out
}
