import { describe, it, expect, vi, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings } from '../src/shared/types'
import { parseSettingsImport } from '../src/renderer/src/lib/settingsImport'
import { bootLoaded, settingsIpc } from './settingsIpc'

// A backup exported by 4.38 — before the rename — carries the `__gitcito`
// marker. Users move to the renamed build by exporting with secrets and
// importing, so that file has to restore everything, tokens first.

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

/** Exactly what Settings → Data → Export wrote in 4.38 with "include secrets" ticked. */
function export438(): Record<string, unknown> {
  const base = defaultSettings()
  const settings: AppSettings = {
    ...base,
    onboardingCompleted: true,
    language: 'pt-BR',
    profiles: [{ ...base.profiles[0], id: 'work', name: 'Work', githubToken: 'ghp_from_438', gitlabToken: 'glpat-438' }]
  }
  return {
    __gitcito: 'settings-export',
    version: 1,
    settings,
    info: { entries: [] },
    vault: { entries: [{ key: 'API_KEY', value: 'vault-secret-438' }] }
  }
}

describe('importing a settings export', () => {
  it('accepts the 4.38 `__gitcito` marker and keeps tokens, vault and info', () => {
    const parsed = parseSettingsImport(JSON.parse(JSON.stringify(export438())))
    expect(parsed).not.toBeNull()
    expect(parsed?.settings.language).toBe('pt-BR')
    expect(parsed?.settings.profiles?.[0].githubToken).toBe('ghp_from_438')
    expect(parsed?.settings.profiles?.[0].gitlabToken).toBe('glpat-438')
    expect(parsed?.bundle?.vault).toEqual({ entries: [{ key: 'API_KEY', value: 'vault-secret-438' }] })
    expect(parsed?.bundle?.info).toEqual({ entries: [] })
    // Handed on in the current shape, so nothing downstream sees two markers.
    expect(parsed?.bundle?.__githuttbr).toBe('settings-export')
    expect(parsed?.bundle).not.toHaveProperty('__gitcito')
  })

  it('accepts the current `__githuttbr` marker the same way', () => {
    const { __gitcito: _old, ...rest } = export438()
    void _old
    const parsed = parseSettingsImport({ ...rest, __githuttbr: 'settings-export' })
    expect(parsed?.bundle?.vault).toBeDefined()
    expect(parsed?.settings.profiles?.[0].githubToken).toBe('ghp_from_438')
  })

  it('a 4.38 export with tokens, saved through the real settings handlers, authenticates', async () => {
    // Keychain consent under both file names, so this holds on either side of
    // the userData rename.
    for (const name of ['gitcito-keychain.json', 'githuttbr-keychain.json']) {
      writeFileSync(join(dir, name), JSON.stringify({ consent: 'granted', explained: true }))
    }
    vi.resetModules()
    handlers.clear()
    const mod = await import('../src/main/settings')
    mod.registerSettingsHandlers()
    await bootLoaded(handlers)
    const call = settingsIpc(handlers)

    const parsed = parseSettingsImport(JSON.parse(JSON.stringify(export438())))
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
