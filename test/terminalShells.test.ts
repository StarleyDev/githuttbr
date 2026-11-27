import { describe, expect, it } from 'vitest'
import { terminalShellChoices } from '../src/renderer/src/lib/terminalShells'

const posix = { system: '/bin/zsh', shells: ['/bin/bash', '/bin/zsh', '/usr/bin/fish', '/usr/local/bin/bash'] }

describe('the shells a new terminal can open with', () => {
  it('lists the system default first, then every shell, the default marked', () => {
    const choices = terminalShellChoices('linux', '', posix)
    expect(choices.map((c) => c.value)).toEqual(['system', '/bin/bash', '/bin/zsh', '/usr/bin/fish', '/usr/local/bin/bash'])
    expect(choices.filter((c) => c.isDefault).map((c) => c.value)).toEqual(['system'])
  })

  it('names a shell by its file, with the path only when two share the name', () => {
    const choices = terminalShellChoices('darwin', 'system', posix)
    expect(choices.find((c) => c.value === '/usr/bin/fish')).toEqual({ value: '/usr/bin/fish', label: 'fish', isDefault: false })
    expect(choices.find((c) => c.value === '/bin/bash')?.detail).toBe('/bin/bash')
  })

  it('marks the shell chosen in Settings, and keeps a custom one /etc/shells does not list', () => {
    expect(terminalShellChoices('linux', '/usr/bin/fish', posix).find((c) => c.isDefault)?.value).toBe('/usr/bin/fish')
    const custom = terminalShellChoices('linux', '/opt/nu/bin/nu', posix)
    expect(custom.at(-1)).toEqual({ value: '/opt/nu/bin/nu', label: 'nu', detail: '/opt/nu/bin/nu', isDefault: true })
  })

  it('reads a Windows preset carried over from another machine as the system shell', () => {
    expect(terminalShellChoices('linux', 'powershell', posix)[0]).toMatchObject({ value: 'system', isDefault: true })
  })

  it('offers the Windows presets on Windows, PowerShell by default', () => {
    const choices = terminalShellChoices('win32', '', null)
    expect(choices.map((c) => c.value)).toEqual(['powershell', 'pwsh', 'cmd', 'gitbash', 'wsl'])
    expect(choices.find((c) => c.isDefault)?.value).toBe('powershell')
    expect(terminalShellChoices('win32', 'gitbash', null).find((c) => c.isDefault)?.value).toBe('gitbash')
  })
})
