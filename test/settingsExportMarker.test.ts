import { describe, it, expect, vi, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings } from '../src/shared/types'
import { parseSettingsImport } from '../src/renderer/src/lib/settingsImport'
import { bootLoaded, settingsIpc } from './settingsIpc'

// A settings export carries the `__githuttbr` marker, and has to restore
// everything, tokens first. The builds up to 4.38 wrote the marker they
// inherited, and those backups restore too; any other app's marker is refused.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-export-marker-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (s: string) => Buffer.from(`enc:${s}`),
    decryptStringAsync: async (b: Buffer) => ({ result: b.toString().slice(4), shouldReEncrypt: false })
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

/** What Settings → Data → Export writes with "include secrets" ticked. */
function exportWithSecrets(marker = '__githuttbr'): Record<string, unknown> {
  const base = defaultSettings()
  const settings: AppSettings = {
    ...base,
    onboardingCompleted: true,
    language: 'pt-BR',
    profiles: [{ ...base.profiles[0], id: 'work', name: 'Work', githubToken: 'ghp_from_438', gitlabToken: 'glpat-438' }]
  }
  return {
    [marker]: 'settings-export',
    version: 1,
    settings,
    info: { entries: [] },
    vault: { entries: [{ key: 'API_KEY', value: 'vault-secret-438' }] }
  }
}

describe('importing a settings export', () => {
  it('accepts the `__githuttbr` marker and keeps tokens, vault and info', () => {
    const parsed = parseSettingsImport(JSON.parse(JSON.stringify(exportWithSecrets())))
    expect(parsed).not.toBeNull()
    expect(parsed?.settings.language).toBe('pt-BR')
    expect(parsed?.settings.profiles?.[0].githubToken).toBe('ghp_from_438')
    expect(parsed?.settings.profiles?.[0].gitlabToken).toBe('glpat-438')
    expect(parsed?.bundle?.vault).toEqual({ entries: [{ key: 'API_KEY', value: 'vault-secret-438' }] })
    expect(parsed?.bundle?.info).toEqual({ entries: [] })
    expect(parsed?.bundle?.__githuttbr).toBe('settings-export')
  })

  it('accepts the 4.38 marker, handed on under the current one only', () => {
    const parsed = parseSettingsImport(JSON.parse(JSON.stringify(exportWithSecrets('__gitcito')))) // upstream-name: 4.38 export
    expect(parsed?.settings.profiles?.[0].githubToken).toBe('ghp_from_438')
    expect(parsed?.bundle?.__githuttbr).toBe('settings-export')
    expect(parsed?.bundle).not.toHaveProperty('__gitcito') // upstream-name: the old marker is dropped
  })

  it("refuses another app's marker instead of reading it as bare settings", () => {
    expect(parseSettingsImport(JSON.parse(JSON.stringify(exportWithSecrets('__otherapp'))))).toBeNull()
  })

  it('an export with tokens, saved through the real settings handlers, authenticates', async () => {
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
    vi.resetModules()
    handlers.clear()
    const mod = await import('../src/main/settings')
    mod.registerSettingsHandlers()
    await bootLoaded(handlers)
    const call = settingsIpc(handlers)

    const parsed = parseSettingsImport(JSON.parse(JSON.stringify(exportWithSecrets())))
    const from = { sender: { id: 1 } }
    await call(from, 'settings:get')
    // What the store's importSettings sends after the user confirms "replace".
    const incoming = { ...defaultSettings(), ...parsed!.settings, activeProfileId: 'work' }
    await call(from, 'settings:set', incoming, undefined, { import: 'replace' })

    const stored = (await call(from, 'settings:unlock')) as AppSettings
    expect(stored.profiles.find((p) => p.id === 'work')?.githubToken).toBe('ghp_from_438')
    expect(stored.profiles.find((p) => p.id === 'work')?.gitlabToken).toBe('glpat-438')
    expect((await mod.activeProfileAuth('github')).token).toBe('ghp_from_438')
  })
})
