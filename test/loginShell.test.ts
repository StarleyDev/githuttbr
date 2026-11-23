import { describe, it, expect, afterAll } from 'vitest'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listShells,
  loginArgs,
  machineProbe,
  parseEtcShells,
  pathProbeShell,
  pickSystemShell,
  resolvePosixShell,
  shellName,
  type ShellProbe
} from '../src/main/loginShell'

// Which shell the terminal, launch tasks and the PATH probe start on macOS/Linux.
// A valid SHELL wins — it is the shell the session runs, even when the account
// names another — then the account's login shell (getpwuid), then the OS default.

function probe(over: Partial<ShellProbe> & { exe?: string[] } = {}): ShellProbe & { warnings: string[] } {
  const exe = new Set(over.exe ?? ['/bin/zsh', '/bin/bash', '/bin/sh', '/opt/homebrew/bin/fish', '/usr/bin/fish'])
  const warnings: string[] = []
  return {
    platform: 'darwin',
    accountShell: () => null,
    envShell: undefined,
    isExecutable: (f) => exe.has(f),
    etcShells: () => ['/bin/zsh', '/bin/bash', '/bin/sh', '/usr/bin/fish'],
    ...over,
    warn: (m) => warnings.push(m),
    warnings
  }
}

describe('pickSystemShell — resolution order', () => {
  it('a valid SHELL wins over a different account shell (fish in passwd, zsh in use)', () => {
    expect(pickSystemShell(probe({ accountShell: () => '/usr/bin/fish', envShell: '/bin/zsh' }))).toBe('/bin/zsh')
  })

  it('keeps SHELL after a chsh until relogin — the Settings picker is the way to switch at once', () => {
    // chsh changed the account to fish; the running session's SHELL still says zsh.
    const p = probe({ accountShell: () => '/usr/bin/fish', envShell: '/bin/zsh' })
    expect(pickSystemShell(p)).toBe('/bin/zsh')
    expect(resolvePosixShell('/usr/bin/fish', p, pickSystemShell(p)).file).toBe('/usr/bin/fish')
  })

  it('falls back to the account shell when SHELL is missing or unusable', () => {
    expect(pickSystemShell(probe({ accountShell: () => '/usr/bin/fish' }))).toBe('/usr/bin/fish')
    expect(pickSystemShell(probe({ accountShell: () => '/usr/bin/fish', envShell: '' }))).toBe('/usr/bin/fish')
    expect(pickSystemShell(probe({ accountShell: () => '/usr/bin/fish', envShell: '/gone/zsh' }))).toBe('/usr/bin/fish')
    expect(pickSystemShell(probe({ accountShell: () => '/usr/bin/fish', envShell: 'zsh' }))).toBe('/usr/bin/fish')
    expect(pickSystemShell(probe({ accountShell: () => '/bin/bash', envShell: '/usr/sbin/nologin' }))).toBe('/bin/bash')
  })

  it('skips an unusable account shell too', () => {
    expect(pickSystemShell(probe({ accountShell: () => '/usr/sbin/nologin' }))).toBe('/bin/zsh')
    expect(pickSystemShell(probe({ platform: 'linux', accountShell: () => '/gone/fish' }))).toBe('/bin/bash')
  })

  it('uses the OS default when neither is usable: zsh on macOS, bash on Linux, then sh', () => {
    expect(pickSystemShell(probe())).toBe('/bin/zsh')
    expect(pickSystemShell(probe({ platform: 'linux' }))).toBe('/bin/bash')
    expect(pickSystemShell(probe({ platform: 'linux', exe: ['/bin/sh'] }))).toBe('/bin/sh')
    expect(pickSystemShell(probe({ envShell: '', accountShell: () => undefined, exe: ['/bin/sh'] }))).toBe('/bin/sh')
  })

  it('accepts an executable shell /etc/shells does not list, but logs it', () => {
    const p = probe({ accountShell: () => '/opt/homebrew/bin/fish' })
    expect(pickSystemShell(p)).toBe('/opt/homebrew/bin/fish')
    expect(p.warnings.join('\n')).toMatch(/does not list/)
  })

  it('does not require /etc/shells to exist', () => {
    const p = probe({ accountShell: () => '/opt/homebrew/bin/fish', etcShells: () => null })
    expect(pickSystemShell(p)).toBe('/opt/homebrew/bin/fish')
    expect(p.warnings).toEqual([])
  })

  it('keeps COMSPEC on Windows', () => {
    expect(pickSystemShell(probe({ platform: 'win32', envShell: 'C:\\Windows\\cmd.exe' }))).toBe('C:\\Windows\\cmd.exe')
    expect(pickSystemShell(probe({ platform: 'win32' }))).toBe('powershell.exe')
  })
})

describe('resolvePosixShell — the terminalShell setting on macOS/Linux', () => {
  const p = probe()

  it('treats empty, system and every Windows preset as the system shell', () => {
    for (const sel of [undefined, '', '  ', 'system', 'powershell', 'pwsh', 'cmd', 'gitbash', 'wsl']) {
      expect(resolvePosixShell(sel, p, '/bin/zsh')).toEqual({ file: '/bin/zsh', args: ['-l'] })
    }
  })

  it('uses an executable absolute path, as a login shell when it knows how', () => {
    expect(resolvePosixShell('/usr/bin/fish', p, '/bin/zsh')).toEqual({ file: '/usr/bin/fish', args: ['-l'] })
  })

  it('falls back to the system shell and names a missing or relative custom path', () => {
    expect(resolvePosixShell('/nope/fish', p, '/bin/zsh')).toEqual({ file: '/bin/zsh', args: ['-l'], missing: '/nope/fish' })
    expect(resolvePosixShell('fish', p, '/bin/zsh')).toEqual({ file: '/bin/zsh', args: ['-l'], missing: 'fish' })
  })
})

describe('loginArgs — -l only for shells known to take it', () => {
  it.each([
    ['/bin/sh', ['-l']], ['/bin/bash', ['-l']], ['/bin/zsh', ['-l']], ['/usr/bin/fish', ['-l']],
    ['/bin/ksh', ['-l']], ['/bin/tcsh', ['-l']], ['/usr/local/bin/bash-5.2', ['-l']], ['/usr/bin/nu', ['-l']],
    ['/usr/bin/elvish', []], ['/home/me/bin/my-shell', []]
  ])('%s', (file, args) => {
    expect(loginArgs(file)).toEqual(args)
  })

  it('normalizes names', () => {
    expect(shellName('-zsh')).toBe('zsh')
    expect(shellName('/opt/homebrew/bin/Bash')).toBe('bash')
  })
})

describe('pathProbeShell — the shell that reads the login PATH', () => {
  it('uses the user shell when it is POSIX or fish, else the POSIX fallback', () => {
    expect(pathProbeShell('/usr/bin/fish', '/bin/bash')).toBe('/usr/bin/fish')
    expect(pathProbeShell('/bin/zsh', '/bin/bash')).toBe('/bin/zsh')
    expect(pathProbeShell('/bin/tcsh', '/bin/zsh')).toBe('/bin/zsh')
    expect(pathProbeShell('/usr/bin/nu', '/bin/bash')).toBe('/bin/bash')
  })
})

describe('/etc/shells', () => {
  it('parses paths and drops comments', () => {
    expect(parseEtcShells('# List\n/bin/sh\n\n  /bin/zsh  # mine\nnot-a-path\n')).toEqual(['/bin/sh', '/bin/zsh'])
  })

  it('lists only usable interactive shells for the picker', () => {
    const p = probe({
      etcShells: () => ['/bin/zsh', '/usr/bin/git-shell', '/usr/sbin/nologin', '/bin/rbash', '/gone/ksh', '/usr/bin/fish'],
      exe: ['/bin/zsh', '/usr/bin/git-shell', '/usr/sbin/nologin', '/bin/rbash', '/usr/bin/fish']
    })
    expect(listShells(p)).toEqual(['/bin/zsh', '/usr/bin/fish'])
  })
})

// The real machine: a temp shell script stands in for a custom shell, run the way
// the terminal's basic mode spawns it, so the decision and the spawn agree.
describe.skipIf(process.platform === 'win32')('on this machine', () => {
  const dir = mkdtempSync(join(tmpdir(), 'githuttbr-shell-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const script = (name: string): string => {
    const file = join(dir, name)
    writeFileSync(file, '#!/bin/sh\necho "ran:$*"\n')
    chmodSync(file, 0o755)
    return file
  }

  it('spawns a custom login-capable shell with -l and an unknown one without args', () => {
    const fish = script('fish')
    const odd = script('my-shell')
    for (const [file, expected] of [[fish, 'ran:-l'], [odd, 'ran:']] as const) {
      const sh = resolvePosixShell(file, machineProbe(), '/bin/sh')
      expect(sh.file).toBe(file)
      expect(execFileSync(sh.file, sh.args, { encoding: 'utf8' }).trim()).toBe(expected)
    }
  })

  it('does not take a non-executable file as a shell', () => {
    const file = join(dir, 'zsh')
    writeFileSync(file, '#!/bin/sh\n')
    chmodSync(file, 0o644)
    expect(resolvePosixShell(file, machineProbe(), '/bin/sh').missing).toBe(file)
  })

  it('resolves the system shell to an executable — SHELL itself when it is one', () => {
    const sh = pickSystemShell(machineProbe())
    expect(sh.startsWith('/')).toBe(true)
    expect(() => execFileSync(sh, ['-c', 'exit 0'])).not.toThrow()
    const env = process.env['SHELL']
    if (env && env.startsWith('/') && machineProbe().isExecutable(env)) expect(sh).toBe(env)
  })
})
