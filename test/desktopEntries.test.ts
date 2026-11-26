import { describe, it, expect, afterEach } from 'vitest'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EDITOR_PRESETS, editorLaunch, presetFor } from '../src/shared/editors'
import {
  desktopEntryDirs,
  findDesktopEditors,
  isBundleOfProduct,
  getDesktopEntryCommand,
  parseDesktopEntry,
  splitDesktopExec,
  type DesktopFs
} from '../src/main/desktopEntries'
import { detectEditors } from '../src/main/editor'

// Finding an editor through Linux `.desktop` entries (an install outside PATH),
// and the Devin Desktop preset. Fictional paths throughout; nothing is run.

const devin = presetFor('devin')!

/** A fake filesystem: these files exist, these are executable. */
function fakeFs(files: Record<string, string>, executables: string[], onPath: string[] = []): DesktopFs {
  return {
    isOnPath: (name) => onPath.includes(name),
    listDir: (dir) =>
      Object.keys(files)
        .filter((f) => f.startsWith(`${dir}/`) && !f.slice(dir.length + 1).includes('/'))
        .map((f) => f.slice(dir.length + 1)),
    readText: (file) => files[file] ?? null,
    isExecutable: (file) => executables.includes(file)
  }
}

const entry = (name: string, exec: string): string =>
  `[Desktop Entry]\nName=${name}\nName[pt_BR]=Outro nome\nExec=${exec}\nType=Application\n\n[Desktop Action new-window]\nName=New Window\nExec=/elsewhere/x --new-window %F\n`

describe('desktop entries', () => {
  it('parses the main group only, the plain Name over its translations', () => {
    expect(parseDesktopEntry(entry('Devin Desktop', '/opt/tools/devin-app/devin-desktop %F'))).toEqual({
      name: 'Devin Desktop',
      exec: '/opt/tools/devin-app/devin-desktop %F',
      type: 'Application',
      hidden: false,
      noDisplay: false
    })
    expect(parseDesktopEntry('[Desktop Entry]\nName=No exec\n')).toBeNull()
  })

  it('splits Exec without a shell: field codes dropped, quotes and escapes kept as data', () => {
    expect(splitDesktopExec('/opt/a/devin-desktop %F')).toEqual(['/opt/a/devin-desktop'])
    expect(splitDesktopExec('"/opt/My Tools/devin-desktop" --unity-launch %U')).toEqual(['/opt/My Tools/devin-desktop', '--unity-launch'])
    expect(splitDesktopExec('"/opt/a \\"b\\"/x" 100%% %i %c')).toEqual(['/opt/a "b"/x', '100%'])
    expect(splitDesktopExec('/bin/sh -c "rm -rf ~; echo"')).toEqual(['/bin/sh', '-c', 'rm -rf ~; echo'])
  })

  it('prefers the CLI in bin/ beside the program, else the program itself', () => {
    const e = parseDesktopEntry(entry('Devin Desktop', '/opt/tools/devin-app/devin-desktop %F'))!
    const withCli = fakeFs({}, ['/opt/tools/devin-app/bin/devin-desktop', '/opt/tools/devin-app/devin-desktop'])
    expect(getDesktopEntryCommand(e, devin, withCli)).toBe('/opt/tools/devin-app/bin/devin-desktop')
    const noCli = fakeFs({}, ['/opt/tools/devin-app/devin-desktop'])
    expect(getDesktopEntryCommand(e, devin, noCli)).toBe('/opt/tools/devin-app/devin-desktop')
    expect(getDesktopEntryCommand(e, devin, fakeFs({}, []))).toBeNull()
  })

  it('never takes a plain `devin`, an entry that needs arguments, or a relative program', () => {
    const fs = fakeFs({}, ['/opt/agent/devin', '/usr/bin/flatpak', '/opt/a/devin-desktop'])
    expect(getDesktopEntryCommand(parseDesktopEntry(entry('Devin Desktop', '/opt/agent/devin %F'))!, devin, fs)).toBeNull()
    expect(getDesktopEntryCommand(parseDesktopEntry(entry('Devin', '/opt/agent/devin'))!, devin, fs)).toBeNull()
    expect(
      getDesktopEntryCommand(parseDesktopEntry(entry('Devin Desktop', '/usr/bin/flatpak run com.example.Devin %F'))!, devin, fs)
    ).toBeNull()
    expect(getDesktopEntryCommand(parseDesktopEntry(entry('Devin Desktop', 'devin-desktop %F'))!, devin, fs)).toBeNull()
    // Matched by program name even when the entry is called something else.
    expect(getDesktopEntryCommand(parseDesktopEntry(entry('My editor', '/opt/a/devin-desktop'))!, devin, fs)).toBe('/opt/a/devin-desktop')
  })

  it('skips a hidden, undisplayed or TryExec-failing entry', () => {
    const fs = fakeFs({}, ['/opt/a/devin-desktop', '/opt/a/check'], ['devin-desktop'])
    const base = '[Desktop Entry]\nName=Devin Desktop\nExec=/opt/a/devin-desktop %F\n'
    const cmd = (extra: string): string | null => getDesktopEntryCommand(parseDesktopEntry(base + extra)!, devin, fs)
    expect(cmd('')).toBe('/opt/a/devin-desktop')
    expect(cmd('Hidden=true\n')).toBeNull()
    expect(cmd('NoDisplay=true\n')).toBeNull()
    expect(cmd('TryExec=/opt/a/missing\n')).toBeNull()
    expect(cmd('TryExec=/opt/a/check\n')).toBe('/opt/a/devin-desktop')
    expect(cmd('TryExec=devin-desktop\n')).toBe('/opt/a/devin-desktop')
    expect(cmd('TryExec=not-installed\n')).toBeNull()
  })

  it('looks where XDG says, then Flatpak and Snap', () => {
    expect(desktopEntryDirs({}, '/home/ana')).toEqual([
      '/home/ana/.local/share/applications',
      '/usr/local/share/applications',
      '/usr/share/applications',
      '/home/ana/.local/share/flatpak/exports/share/applications',
      '/var/lib/flatpak/exports/share/applications',
      '/var/lib/snapd/desktop/applications'
    ])
    const dirs = desktopEntryDirs({ XDG_DATA_HOME: '/data/ana', XDG_DATA_DIRS: '/opt/share:relative:/usr/share' }, '/home/ana')
    expect(dirs.slice(0, 3)).toEqual(['/data/ana/applications', '/opt/share/applications', '/usr/share/applications'])
  })

  it('macOS: a bundle counts only when its product.json names the editor', () => {
    const fs = {
      readText: (f: string): string | null =>
        f === '/Applications/Devin.app/Contents/Resources/app/product.json'
          ? JSON.stringify({ applicationName: 'devin-desktop', nameShort: 'Devin' })
          : f === '/Applications/Other/Devin.app/Contents/Resources/app/product.json'
            ? JSON.stringify({ applicationName: 'something-else' })
            : null
    }
    expect(isBundleOfProduct('/Applications/Devin.app', 'devin-desktop', fs)).toBe(true)
    expect(isBundleOfProduct('/Applications/Other/Devin.app', 'devin-desktop', fs)).toBe(false)
    expect(isBundleOfProduct('/Applications/NoProduct/Devin.app', 'devin-desktop', fs)).toBe(false)
    expect(devin.macProduct).toBe('devin-desktop')
  })

  it('walks the menu folders, first match wins, other files ignored', () => {
    const fs = fakeFs(
      {
        '/home/ana/.local/share/applications/devin-desktop.desktop': entry('Devin Desktop', '/home/ana/apps/devin/devin-desktop %F'),
        '/home/ana/.local/share/applications/notes.txt': 'not an entry',
        '/usr/share/applications/devin-desktop.desktop': entry('Devin Desktop', '/usr/lib/devin/devin-desktop %F')
      },
      ['/home/ana/apps/devin/bin/devin-desktop', '/usr/lib/devin/devin-desktop']
    )
    const found = findDesktopEditors(EDITOR_PRESETS, ['/home/ana/.local/share/applications', '/usr/share/applications'], fs)
    expect(found.get('devin')).toBe('/home/ana/apps/devin/bin/devin-desktop')
    expect([...found.keys()]).toEqual(['devin'])
  })
})

describe('the Devin Desktop preset', () => {
  it('is a VS Code-family CLI: the same goto form, a folder by path, no bare `devin`', () => {
    const vscode = presetFor('vscode')!
    expect(devin).toMatchObject({ name: 'Devin Desktop', bins: ['devin-desktop'], fileArgs: vscode.fileArgs, folderArgs: vscode.folderArgs })
    expect(devin.bins).not.toContain('devin')
    expect(devin.macApps).toEqual(['Devin.app', 'Devin Desktop.app'])
    const plan = editorLaunch(
      { id: 'devin', name: 'Devin Desktop', command: '/opt/a/bin/devin-desktop', source: 'cli' },
      { path: '/work/app/src/a b.ts', line: 12, col: 3 }
    )
    expect(plan?.args).toEqual(['-g', '/work/app/src/a b.ts:12:3'])
  })
})

describe('detectEditors on this machine’s PATH', () => {
  const dirs: string[] = []
  const savedPath = process.env.PATH
  const savedHome = process.env.HOME
  afterEach(() => {
    process.env.PATH = savedPath
    process.env.HOME = savedHome
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })
  const binDir = (...names: string[]): string => {
    const dir = mkdtempSync(join(tmpdir(), 'githuttbr-bin-'))
    dirs.push(dir)
    for (const n of names) {
      writeFileSync(join(dir, n), '#!/bin/sh\nexit 0\n')
      chmodSync(join(dir, n), 0o755)
    }
    return dir
  }

  it.skipIf(process.platform === 'win32')('a plain `devin` on PATH is not the editor; `devin-desktop` is', () => {
    // An empty home: the machine's own menu entries stay out of the answer.
    process.env.HOME = binDir()
    const onlyAgent = binDir('devin')
    process.env.PATH = onlyAgent
    expect(detectEditors().find((e) => e.command === join(onlyAgent, 'devin'))).toBeUndefined()
    expect(detectEditors().some((e) => /[\\/]devin$/.test(e.command))).toBe(false)
    const both = binDir('devin', 'devin-desktop')
    process.env.PATH = both
    expect(detectEditors().find((e) => e.id === 'devin')).toMatchObject({ command: join(both, 'devin-desktop'), source: 'cli' })
  })
})
