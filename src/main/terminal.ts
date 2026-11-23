import { ipcMain, WebContents } from 'electron'
import { spawn, ChildProcess, execFile } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { makeBatchedSender } from './ptyBatch'
import { shellCwd } from './packageScripts'
import { readCompletions, type CompletionKind } from './termCompletions'
import { listShells, machineProbe, resolvePosixShell, systemShell, type ResolvedShell } from './loginShell'

interface TermSession {
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
  /** Name of the foreground process running in the pty (e.g. zsh, claude, vim). */
  procName(): string
  /** The shell's pid, to find its current directory (absent in basic mode). */
  pid?: number
  /** Where the session started — the fallback when the current dir is unknown. */
  startCwd: string
}

let nextId = 1
const sessions = new Map<number, TermSession>()

/**
 * Maps the `terminalShell` setting to an executable + args. Windows: a preset
 * id, 'system' (COMSPEC) or a custom exe path. macOS/Linux: the system shell
 * ($SHELL, else the account's; see loginShell.ts) or an absolute path, started as a *login* shell —
 * without `-l` zsh/bash skip ~/.zprofile and ~/.bash_profile, which is where
 * version managers and `brew shellenv` put themselves on PATH, and a tool that
 * works in Terminal.app fails here with `command not found`.
 */
function resolveShell(sel?: string): ResolvedShell {
  // Re-read per terminal (cheap): what is installed can change while the app runs.
  const system = systemShell(true)
  if (process.platform !== 'win32') return resolvePosixShell(sel, machineProbe(), system)
  switch (sel) {
    case 'powershell':
      return { file: 'powershell.exe', args: ['-NoLogo'] }
    case 'pwsh':
      return { file: 'pwsh.exe', args: ['-NoLogo'] }
    case 'cmd':
      return { file: 'cmd.exe', args: [] }
    case 'gitbash':
      return { file: 'C:\\Program Files\\Git\\bin\\bash.exe', args: ['-i', '-l'] }
    case 'wsl':
      return { file: 'wsl.exe', args: [] }
    case 'system':
      return { file: system, args: [] }
    default:
      // ''/undefined → system default; anything else is a custom exe path. A
      // POSIX path ('/usr/bin/zsh') came from settings made on macOS/Linux.
      if (!sel?.trim() || sel.trim().startsWith('/')) return { file: system, args: [] }
      return { file: sel.trim(), args: [] }
  }
}

/** Custom shells that could not be started, by terminal id, until the renderer
 *  asks — it prints the translated notice. Each missing path is reported once. */
const shellNotices = new Map<number, { missing: string; used: string }>()
const noticedPaths = new Set<string>()

function noteFallback(id: number, sh: ResolvedShell): void {
  if (!sh.missing || noticedPaths.has(sh.missing)) return
  noticedPaths.add(sh.missing)
  shellNotices.set(id, { missing: sh.missing, used: sh.file })
}

function createPty(
  wc: WebContents,
  id: number,
  cwd: string,
  cols: number,
  rows: number,
  sh: ResolvedShell,
  poshTheme?: string
): TermSession | null {
  try {
    interface PtyProcess {
      write(data: string): void
      resize(cols: number, rows: number): void
      kill(): void
      onData(cb: (data: string) => void): void
      onExit(cb: () => void): void
      /** node-pty getter: title of the current foreground process. */
      readonly process: string
      /** The shell's process id. */
      readonly pid: number
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pty = require('node-pty') as {
      spawn(file: string, args: string[], opts: Record<string, unknown>): PtyProcess
    }
    // Oh My Posh honors $env:POSH_THEME at `oh-my-posh init` — inject the
    // configured theme so a bare name resolves under %POSH_THEMES_PATH%.
    const theme = poshTheme?.trim()
    const poshEnv =
      theme &&
      (theme.includes('\\') || theme.includes('/') || /\.(json|yaml|yml)$/.test(theme)
        ? theme
        : process.env.POSH_THEMES_PATH
          ? `${process.env.POSH_THEMES_PATH}\\${theme}.omp.json`
          : theme)
    const p = pty.spawn(sh.file, sh.args, {
      name: 'xterm-256color',
      cwd,
      cols,
      rows,
      // TERM is often unset when the app is launched from Finder/Dock.
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        // What runs inside (tmux, `$SHELL -c`, editors) starts the shell this
        // terminal actually runs, not the app's inherited one.
        ...(process.platform !== 'win32' ? { SHELL: sh.file } : {}),
        ...(poshEnv ? { POSH_THEME: poshEnv } : {})
      } as Record<string, string>
    })
    // Batch raw chunks into ~frame-sized IPC messages — a repaint storm
    // otherwise becomes hundreds of dispatches/sec of renderer jank.
    const send = makeBatchedSender(wc, `term:data:${id}`)
    p.onData((d) => send.push(d))
    p.onExit(() => {
      send.dispose() // deliver buffered output before the exit event
      sessions.delete(id)
      if (!wc.isDestroyed()) wc.send(`term:exit:${id}`)
    })
    return {
      write: (d) => {
        try {
          p.write(d)
        } catch {
          /* session dying or already dead */
        }
      },
      resize: (c, r) => {
        // The pty's fd can go invalid between the exit event and this call
        // (or after a sleep/wake cycle) — node-pty's resize throws ENOTTY
        // synchronously in that case, which would otherwise crash main.
        if (c <= 0 || r <= 0) return
        try {
          p.resize(c, r)
        } catch {
          // ignore — the session is dying or already dead
        }
      },
      kill: () => {
        try {
          p.kill()
        } catch {
          /* already gone */
        }
      },
      procName: () => {
        try {
          return p.process
        } catch {
          return ''
        }
      },
      pid: p.pid,
      startCwd: cwd
    }
  } catch {
    return null
  }
}

function createFallback(wc: WebContents, id: number, cwd: string, sh: ResolvedShell): TermSession {
  const child: ChildProcess = spawn(sh.file, sh.args, {
    cwd,
    env: { ...process.env, TERM: 'dumb', ...(process.platform !== 'win32' ? { SHELL: sh.file } : {}) }
  })
  const send = (text: string): void => {
    if (!wc.isDestroyed()) wc.send(`term:data:${id}`, text)
  }
  const sendChunk = (d: Buffer): void => send(d.toString().replace(/(?<!\r)\n/g, '\r\n'))
  child.stdout?.on('data', sendChunk)
  child.stderr?.on('data', sendChunk)
  // Typing after the shell exited writes into a closed pipe (EPIPE).
  child.stdin?.on('error', () => undefined)
  child.on('exit', () => {
    sessions.delete(id)
    if (!wc.isDestroyed()) wc.send(`term:exit:${id}`)
  })

  send(`\x1b[90m(basic shell mode — node-pty unavailable; run "npm rebuild node-pty" for a full terminal)\x1b[0m\r\n`)
  send(`\x1b[36m${cwd}\x1b[0m $ `)

  // Minimal line editor: echo locally, send full lines to the shell's stdin.
  let buffer = ''
  return {
    write: (d) => {
      for (const ch of d) {
        if (ch === '\r' || ch === '\n') {
          send('\r\n')
          child.stdin?.write(buffer + '\n')
          buffer = ''
        } else if (ch === '\x7f' || ch === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1)
            send('\b \b')
          }
        } else if (ch === '\x03') {
          buffer = ''
          send('^C\r\n$ ')
        } else if (ch >= ' ' || ch === '\t') {
          buffer += ch
          send(ch)
        }
      }
    },
    resize: () => undefined,
    kill: () => child.kill(),
    procName: () => sh.file.split(/[\\/]/).pop() || '',
    startCwd: cwd
  }
}

/** Directory holding `*.omp.json` theme files. POSH_THEMES_PATH is set by the
 *  installer/scoop; winget and scoop installs land in well-known places. */
function poshThemeDir(): string | null {
  if (process.platform !== 'win32') return null
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const candidates = [
    process.env.POSH_THEMES_PATH,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'oh-my-posh', 'themes') : null,
    home ? join(home, 'scoop', 'apps', 'oh-my-posh', 'current', 'themes') : null
  ].filter((d): d is string => !!d)
  return candidates.find((d) => { try { return existsSync(d) } catch { return false } }) ?? null
}

function findPoshExe(): string | null {
  if (process.platform !== 'win32') return null
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const candidates = [
    process.env.POSH_EXE,
    home ? join(home, 'scoop', 'shims', 'oh-my-posh.exe') : null,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'oh-my-posh', 'bin', 'oh-my-posh.exe') : null,
    'oh-my-posh.exe', // PATH
    'oh-my-posh'
  ].filter((p): p is string => !!p)
  for (const p of candidates) {
    try {
      if (p.includes('\\') || p.includes('/')) {
        if (existsSync(p)) return p
      } else {
        return p // bare name: let spawn resolve it via PATH; failure is caught
      }
    } catch { /* keep looking */ }
  }
  return null
}

/** Resolve a `terminalPoshTheme` value to a config path: bare names look up the
 *  themes dir, anything with a path separator / .json ext is used as given. */
function poshThemePath(theme: string): string | null {
  const t = theme.trim()
  if (!t) return null
  if (/[/\\]|\.json$/i.test(t)) return t
  const dir = poshThemeDir()
  return dir ? join(dir, `${t}.omp.json`) : null
}

export function registerTerminalHandlers(): void {
  ipcMain.handle('term:create', (e, cwd: string, cols: number, rows: number, shell?: string, poshTheme?: string) => {
    const id = nextId++
    const sh = resolveShell(shell)
    const session = createPty(e.sender, id, cwd, cols, rows, sh, poshTheme) ?? createFallback(e.sender, id, cwd, sh)
    sessions.set(id, session)
    noteFallback(id, sh)
    return id
  })
  // Asked once per terminal, right after create: the custom shell it fell back from.
  ipcMain.handle('term:shell-notice', (_e, id: number) => {
    const notice = shellNotices.get(id) ?? null
    shellNotices.delete(id)
    return notice
  })
  // The settings picker (macOS/Linux): the detected shell and the usable /etc/shells entries.
  ipcMain.handle('term:shells', () =>
    process.platform === 'win32'
      ? { system: '', shells: [] as string[] }
      : { system: systemShell(true), shells: listShells() }
  )
  ipcMain.handle('term:process', (_e, id: number) => sessions.get(id)?.procName() ?? '')
  // What the terminal's suggestion list offers after `npm run`, `make`,
  // `git checkout`…, read from the shell's current directory.
  const KINDS: readonly CompletionKind[] = ['scripts', 'composer', 'make', 'branches']
  ipcMain.handle('term:completions', async (_e, id: number, kind: unknown) => {
    const s = sessions.get(id)
    if (!s || !KINDS.includes(kind as CompletionKind)) return null
    return readCompletions(kind as CompletionKind, (await shellCwd(s.pid)) ?? s.startCwd)
  })
  ipcMain.handle('term:posh-themes', () => {
    const dir = poshThemeDir()
    if (!dir) return { dir: null, exe: null, themes: [] as string[] }
    try {
      const themes = readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.omp.json'))
        .map((f) => f.slice(0, -'.omp.json'.length))
        .sort((a, b) => a.localeCompare(b))
      return { dir, exe: findPoshExe(), themes }
    } catch {
      return { dir, exe: findPoshExe(), themes: [] as string[] }
    }
  })
  ipcMain.handle('term:posh-preview', (_e, theme: string) => new Promise<string | null>((resolve) => {
    const exe = findPoshExe()
    const config = poshThemePath(theme)
    if (!exe || !config) return resolve(null)
    // `print primary` renders the prompt to stdout as ANSI escapes — the same
    // bytes the shell would emit, so the settings preview is pixel-honest.
    execFile(exe, ['print', 'primary', '--config', config, '--shell', 'pwsh'],
      { timeout: 5000, windowsHide: true, maxBuffer: 64 * 1024 },
      (err, stdout) => resolve(err ? null : stdout))
  }))
  ipcMain.on('term:input', (_e, id: number, data: string) => sessions.get(id)?.write(data))
  ipcMain.on('term:resize', (_e, id: number, cols: number, rows: number) => sessions.get(id)?.resize(cols, rows))
  ipcMain.on('term:kill', (_e, id: number) => {
    sessions.get(id)?.kill()
    sessions.delete(id)
  })
}
