import { describe, it, expect, vi, afterAll, beforeEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import type { SecretStore } from '../src/shared/secrets'
import { MIGRATION_MARKER, migrateLegacySettings, takeMigrationNotice } from '../src/main/legacyMigration'
import { parseSettingsImport } from '../src/renderer/src/lib/settingsImport'

// 4.39 renamed the userData folder (Gitcito → GitHuttBr) and with it the
// keychain entry. The settings come along once, never the credentials; the
// tokens come back through a 4.38 export made with tokens.

const root = mkdtempSync(join(tmpdir(), 'githuttbr-legacy-migration-'))
const legacyDir = join(root, 'Gitcito')
const newDir = join(root, 'GitHuttBr')
afterAll(() => rmSync(root, { recursive: true, force: true }))

const handlers = new Map<string, (...args: unknown[]) => unknown>()
vi.mock('electron', () => ({
  app: { getPath: () => newDir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString().replace(/^enc:/, '')
  }
}))

const profile = (over: Partial<Profile> = {}): Profile => ({
  ...defaultSettings().profiles[0],
  id: 'p',
  name: 'Work',
  ...over
})
const legacySettings = (over: Partial<Profile> = {}): AppSettings => ({
  ...defaultSettings(),
  onboardingCompleted: true,
  language: 'pt-BR',
  profiles: [profile(over)]
})

function seedLegacy(settings: AppSettings = legacySettings()): void {
  mkdirSync(legacyDir, { recursive: true })
  writeFileSync(join(legacyDir, 'gitcito-settings.json'), JSON.stringify(settings))
  writeFileSync(join(legacyDir, 'gitcito-secrets.enc'), 'c2VhbGVkIHdpdGggdGhlIG9sZCBrZXljaGFpbg==')
  writeFileSync(join(legacyDir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
  writeFileSync(join(legacyDir, 'gitcito-vault.enc'), 'sealed')
}

const snapshot = (dir: string): Record<string, string> =>
  Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')]))

beforeEach(() => {
  rmSync(legacyDir, { recursive: true, force: true })
  rmSync(newDir, { recursive: true, force: true })
})

describe('migrateLegacySettings', () => {
  it('copies the settings once, leaves the old folder untouched and owes one notice', () => {
    seedLegacy()
    const before = snapshot(legacyDir)
    expect(migrateLegacySettings(newDir, legacyDir)).toBe('migrated')
    const copied = JSON.parse(readFileSync(join(newDir, 'githuttbr-settings.json'), 'utf8')) as AppSettings
    expect(copied.language).toBe('pt-BR')
    expect(copied.profiles[0].name).toBe('Work')
    expect(snapshot(legacyDir)).toEqual(before)

    // The second start finds its own settings and copies nothing.
    writeFileSync(join(newDir, 'githuttbr-settings.json'), JSON.stringify({ ...copied, language: 'de' }))
    expect(migrateLegacySettings(newDir, legacyDir)).toBe('has-settings')
    expect(JSON.parse(readFileSync(join(newDir, 'githuttbr-settings.json'), 'utf8')).language).toBe('de')

    expect(takeMigrationNotice(newDir)).toBe(true)
    expect(takeMigrationNotice(newDir)).toBe(false)
  })

  it('never copies the token store, the vault or the keychain consent', () => {
    seedLegacy()
    migrateLegacySettings(newDir, legacyDir)
    expect(readdirSync(newDir).sort()).toEqual(['githuttbr-migration.json', 'githuttbr-settings.json'])
  })

  it('strips plaintext tokens and AI keys an older build left in the settings file', () => {
    seedLegacy(
      legacySettings({
        githubToken: 'ghp_plain',
        azureToken: 'az_plain',
        githubEnterprise: [{ url: 'https://ghe.example.com', token: 'ghe_plain' }],
        ai: { ...defaultSettings().profiles[0].ai, apiKey: 'sk-plain', accounts: [] }
      } as Partial<Profile>)
    )
    migrateLegacySettings(newDir, legacyDir)
    const raw = readFileSync(join(newDir, 'githuttbr-settings.json'), 'utf8')
    for (const secret of ['ghp_plain', 'az_plain', 'ghe_plain', 'sk-plain']) expect(raw).not.toContain(secret)
    // The server stays; only its token goes.
    expect(raw).toContain('https://ghe.example.com')
  })

  it('does nothing when the new folder already has settings', () => {
    seedLegacy()
    mkdirSync(newDir, { recursive: true })
    writeFileSync(join(newDir, 'githuttbr-settings.json'), '{"language":"fr"}')
    expect(migrateLegacySettings(newDir, legacyDir)).toBe('has-settings')
    expect(readFileSync(join(newDir, 'githuttbr-settings.json'), 'utf8')).toBe('{"language":"fr"}')
    expect(existsSync(join(newDir, MIGRATION_MARKER))).toBe(false)
    expect(takeMigrationNotice(newDir)).toBe(false)
  })

  it('does nothing without an old install, or with an unreadable old file', () => {
    expect(migrateLegacySettings(newDir, legacyDir)).toBe('no-legacy')
    expect(existsSync(newDir)).toBe(false)
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(join(legacyDir, 'gitcito-settings.json'), '{ half written')
    expect(migrateLegacySettings(newDir, legacyDir)).toBe('unreadable')
    expect(existsSync(join(newDir, 'githuttbr-settings.json'))).toBe(false)
  })
})

describe('a 4.38 export with tokens, imported after the migration', () => {
  const storeJson = (): SecretStore =>
    JSON.parse(
      Buffer.from(readFileSync(join(newDir, 'githuttbr-secrets.enc'), 'utf8'), 'base64').toString().replace(/^enc:/, '')
    ) as SecretStore
  const raw = (channel: string, ...args: unknown[]): Promise<unknown> =>
    Promise.resolve(handlers.get(channel)!({ sender: { id: 1 } }, ...args))

  /** The file 4.38's Settings → Data → Export wrote, tokens ticked. */
  const export438 = {
    __gitcito: 'settings-export',
    version: 1,
    settings: legacySettings({ githubToken: 'ghp_backup', gitlabToken: '' })
  }

  async function migratedApp(): Promise<{ settings: AppSettings; generation: number }> {
    seedLegacy()
    migrateLegacySettings(newDir, legacyDir)
    // Saving a token asks for the keychain first; the user said yes.
    writeFileSync(join(newDir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
    vi.resetModules()
    handlers.clear()
    const mod = await import('../src/main/settings')
    mod.registerSettingsHandlers()
    return (await raw('settings:unlock')) as { settings: AppSettings; generation: number }
  }

  for (const mode of ['merge', 'replace'] as const) {
    it(`fills the new keychain-encrypted store ("${mode === 'merge' ? 'Add to mine' : 'Replace all'}")`, async () => {
      const unlocked = await migratedApp()
      expect(unlocked.settings.profiles[0].githubToken).toBe('')
      const parsed = parseSettingsImport(JSON.parse(JSON.stringify(export438)))
      expect(parsed?.bundle).not.toBeNull()
      await raw('settings:set', { ...unlocked.settings, ...parsed!.settings }, unlocked.generation, { import: mode })
      expect(storeJson().p?.githubToken).toBe('ghp_backup')
      // And never in plain text.
      expect(readFileSync(join(newDir, 'githuttbr-settings.json'), 'utf8')).not.toContain('ghp_backup')
    })
  }
})

describe('what a pre-4.39 AppImage left behind', () => {
  it('is still recognised by path, whatever the old command was called', async () => {
    const { isStaleCliTarget } = await import('../src/main/cliInstall')
    const { isEphemeralTextconv } = await import('../src/main/appImagePaths')
    expect(isStaleCliTarget('/tmp/.mount_GitcitXYZ/resources/cli/gitcito')).toBe(true)
    expect(isEphemeralTextconv('"/tmp/.mount_GitcitXYZ/resources/cli/gitcito-textconv"', {})).toBe(true)
    expect(isStaleCliTarget('/opt/Gitcito/resources/cli/gitcito')).toBe(false)
  })
})
