import { accessSync, constants, readdirSync, readFileSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, delimiter, dirname, isAbsolute, join } from 'path'
import type { EditorPreset } from '../shared/editors'

// Linux: finding an editor through the application menu's `.desktop` entries,
// for an install that is not on PATH (an archive unpacked into a folder of the
// user's choosing, say). Read-only: the files are parsed as text, `Exec=` is
// split without a shell, and nothing found here is ever run during detection.

/** The fields of a `[Desktop Entry]` group that detection reads. */
export interface DesktopEntry {
  name: string
  exec: string
  type: string
  /** `Hidden=true`: the entry is deleted, as far as the menu is concerned. */
  hidden: boolean
  /** `NoDisplay=true`: not meant to be shown or picked. */
  noDisplay: boolean
  /** `TryExec=`: a program that must exist for the entry to count. */
  tryExec?: string
}

/** The `[Desktop Entry]` group of a `.desktop` file; null when it has none or no `Exec=`. */
export function parseDesktopEntry(text: string): DesktopEntry | null {
  let inMain = false
  const fields: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('[')) {
      inMain = line === '[Desktop Entry]'
      continue
    }
    if (!inMain) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    // `Name[pt_BR]=` and the like are translations; the plain key is the one wanted.
    const key = line.slice(0, eq).trim()
    if (!(key in fields)) fields[key] = line.slice(eq + 1).trim()
  }
  if (!fields.Exec) return null
  return {
    name: fields.Name ?? '',
    exec: fields.Exec,
    type: fields.Type ?? 'Application',
    hidden: fields.Hidden === 'true',
    noDisplay: fields.NoDisplay === 'true',
    ...(fields.TryExec ? { tryExec: fields.TryExec } : {})
  }
}

/**
 * `Exec=` as an argv, the way the Desktop Entry spec describes it: arguments
 * split on spaces, double quotes group one, a backslash escapes inside them,
 * `%%` is a percent sign, and the field codes (`%f %F %u %U %i %c %k`, plus the
 * deprecated ones) are dropped — they stand for files the launcher would add.
 */
export function splitDesktopExec(exec: string): string[] {
  const out: string[] = []
  let cur = ''
  let started = false
  let quoted = false
  for (let i = 0; i < exec.length; i++) {
    const ch = exec[i]
    if (quoted) {
      if (ch === '\\' && i + 1 < exec.length) cur += exec[++i]
      else if (ch === '"') quoted = false
      else cur += ch
      continue
    }
    if (ch === '"') {
      quoted = true
      started = true
    } else if (ch === ' ' || ch === '\t') {
      if (started) out.push(cur)
      cur = ''
      started = false
    } else {
      cur += ch
      started = true
    }
  }
  if (started) out.push(cur)
  return out
    .map((arg) => arg.replace(/%%/g, '\u0000'))
    .filter((arg) => !/^%[a-zA-Z]$/.test(arg))
    .map((arg) => arg.replace(/%[a-zA-Z]/g, '').replace(/\u0000/g, '%'))
    .filter((arg) => arg !== '')
}

/** What the filesystem must answer for detection — real in the app, fake in tests. */
export interface DesktopFs {
  listDir: (dir: string) => string[]
  readText: (file: string) => string | null
  isExecutable: (file: string) => boolean
  /** Whether a bare program name is an executable on PATH (for `TryExec=`). */
  isOnPath: (name: string) => boolean
}

/**
 * The CLI an entry stands for, when it is one of `preset`'s: matched by name or
 * by program, the program an absolute path, and no other argument — an entry
 * that needs arguments to start the editor (`flatpak run …`) cannot be driven
 * as a plain CLI. The CLI beside the program (`<dir>/bin/<bin>`) wins over the
 * program itself, since only the CLI takes `-g path:line`.
 */
export function getDesktopEntryCommand(entry: DesktopEntry, preset: EditorPreset, fs: DesktopFs): string | null {
  const match = preset.desktop
  if (!match || entry.type !== 'Application' || entry.hidden || entry.noDisplay) return null
  // TryExec names a program that must be there, or the entry does not count (the spec's rule).
  if (entry.tryExec && !(isAbsolute(entry.tryExec) ? fs.isExecutable(entry.tryExec) : fs.isOnPath(entry.tryExec))) return null
  const argv = splitDesktopExec(entry.exec)
  if (argv.length !== 1 || !isAbsolute(argv[0])) return null
  const program = argv[0]
  const prog = basename(program)
  const named = match.names.includes(entry.name) || match.execs.includes(prog)
  // A name match whose program is not one of ours (another tool's binary) is not this editor.
  if (!named || (!match.execs.includes(prog) && !preset.bins.includes(prog))) return null
  if (match.cliDir) {
    for (const bin of preset.bins) {
      const cli = join(dirname(program), match.cliDir, bin)
      if (fs.isExecutable(cli)) return cli
    }
  }
  return fs.isExecutable(program) ? program : null
}

/**
 * Where the menu's entries live, by the XDG base-directory rules: the user's
 * own data folder first (`XDG_DATA_HOME`, else `~/.local/share`), then each of
 * `XDG_DATA_DIRS` (else `/usr/local/share:/usr/share`) — then Flatpak's and
 * Snap's exports, which a desktop may list there or not.
 */
export function desktopEntryDirs(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const dataHome = env.XDG_DATA_HOME && isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : join(home, '.local/share')
  const dataDirs = (env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter((d) => isAbsolute(d))
  const dirs = [
    join(dataHome, 'applications'),
    ...dataDirs.map((d) => join(d, 'applications')),
    join(dataHome, 'flatpak/exports/share/applications'),
    '/var/lib/flatpak/exports/share/applications',
    '/var/lib/snapd/desktop/applications'
  ]
  return [...new Set(dirs)]
}

/**
 * Whether a macOS bundle is the VS Code build a preset names: its
 * `Contents/Resources/app/product.json` says `applicationName`. A bundle with
 * the right file name but another product — another tool called "Devin" —
 * is not launched with `open -a` by mistake.
 */
export function isBundleOfProduct(bundle: string, applicationName: string, fs: Pick<DesktopFs, 'readText'>): boolean {
  const text = fs.readText(join(bundle, 'Contents/Resources/app/product.json'))
  if (!text) return false
  try {
    return (JSON.parse(text) as { applicationName?: unknown }).applicationName === applicationName
  } catch {
    return false
  }
}

/**
 * For each preset that can be found through the menu, the CLI its first
 * matching entry stands for. Every `.desktop` file is read at most once, and
 * only the top level of each folder (a few hundred small files at most).
 */
export function findDesktopEditors(
  presets: EditorPreset[],
  dirs: string[],
  fs: DesktopFs
): Map<EditorPreset['id'], string> {
  const found = new Map<EditorPreset['id'], string>()
  const wanted = presets.filter((p) => p.desktop)
  if (!wanted.length) return found
  for (const dir of dirs) {
    for (const file of fs.listDir(dir)) {
      if (!file.endsWith('.desktop')) continue
      const text = fs.readText(join(dir, file))
      const entry = text === null ? null : parseDesktopEntry(text)
      if (!entry) continue
      for (const preset of wanted) {
        if (found.has(preset.id)) continue
        const cli = getDesktopEntryCommand(entry, preset, fs)
        if (cli) found.set(preset.id, cli)
      }
    }
  }
  return found
}

/** A `.desktop` file is a few hundred bytes; anything past this is not one worth reading. */
const DESKTOP_FILE_MAX = 64 * 1024
/** A VS Code build's product.json lists its gallery and extensions: larger, still bounded. */
const PRODUCT_FILE_MAX = 4 * 1024 * 1024

function readTextUnder(file: string, max: number): string | null {
  try {
    const info = statSync(file)
    if (!info.isFile() || info.size > max) return null
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** Reads a bundle's product.json for isBundleOfProduct. */
export const nodeProductFs: Pick<DesktopFs, 'readText'> = { readText: (file) => readTextUnder(file, PRODUCT_FILE_MAX) }

/** The real filesystem, read-only and quiet: a missing folder or unreadable file is simply absent. */
export const nodeDesktopFs: DesktopFs = {
  listDir: (dir) => {
    try {
      return readdirSync(dir)
    } catch {
      return []
    }
  },
  readText: (file) => readTextUnder(file, DESKTOP_FILE_MAX),
  isExecutable: (file) => isExecutableFile(file),
  isOnPath: (name) =>
    !name.includes('/') &&
    (process.env.PATH || '')
      .split(delimiter)
      .filter((d) => isAbsolute(d))
      .some((d) => isExecutableFile(join(d, name)))
}

function isExecutableFile(file: string): boolean {
  try {
    if (!statSync(file).isFile()) return false
    accessSync(file, constants.X_OK)
    return true
  } catch {
    return false
  }
}
