import { describe, it, expect, vi, afterAll } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import type { SecretStore } from '../src/shared/secrets'

// Three ways v4.37.1 lost a user's saved tokens without anyone asking: a
// tokenless import with Settings unlocked, a debounced save from before an
// unlock landing after it, and a half-written settings file read as "no
// settings". Real handlers, a fake keyring.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-settings-hotfix-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
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

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const settingsFile = (): string => join(dir, 'gitcito-settings.json')
const storeFile = (): string => join(dir, 'gitcito-secrets.enc')
const storeJson = (): SecretStore =>
  JSON.parse(Buffer.from(readFileSync(storeFile(), 'utf8'), 'base64').toString().replace(/^enc:/, '')) as SecretStore
const writeStore = (s: SecretStore): void =>
  writeFileSync(storeFile(), Buffer.from(`enc:${JSON.stringify(s)}`).toString('base64'))

type Reply = { settings: AppSettings; generation: number }
const raw = (channel: string, ...args: unknown[]): Promise<unknown> =>
  Promise.resolve(handlers.get(channel)!({ sender: { id: 1 } }, ...args))
/** A get/unlock reply as the renderer keeps it: the settings and the generation they came with. */
async function reply(channel: 'settings:get' | 'settings:unlock'): Promise<Reply> {
  const out = (await raw(channel)) as Reply | AppSettings
  // v4.37.1 answered with the bare settings; it had no generation to give.
  return 'generation' in out ? out : { settings: out, generation: 0 }
}
const save = (settings: AppSettings, generation: number, options?: unknown): Promise<unknown> =>
  raw('settings:set', settings, generation, options)

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultSettings().profiles[0], id: 'p', ...over })
const settingsWith = (profile: Profile, extra: Partial<AppSettings> = {}): AppSettings => ({
  ...defaultSettings(),
  onboardingCompleted: true,
  profiles: [profile],
  ...extra
})

/** A fresh main process over a store holding a GitHub and an Azure token. */
async function storedTokens(): Promise<void> {
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true, recursive: true })
  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
  writeStore({ p: { githubToken: 'ghp_old', azureToken: 'az_old' } })
  writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith({}))))
  vi.resetModules()
  handlers.clear()
  const mod = await import('../src/main/settings')
  mod.registerSettingsHandlers()
}

describe('importing a settings file', () => {
  it('without credentials (the default export) keeps every saved token, Settings unlocked', async () => {
    await storedTokens()
    const unlocked = await reply('settings:unlock')
    expect(unlocked.settings.profiles[0].githubToken).toBe('ghp_old')
    // The renderer spreads the file over its state: the file's profile has no tokens.
    const imported = settingsWith(profileWith({ name: 'Imported' }))
    await save(imported, unlocked.generation, { import: 'merge' })
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
    expect((await reply('settings:get')).settings.profiles[0].name).toBe('Imported')
  })

  it('with credentials, "Add to mine" adds them and keeps the rest', async () => {
    await storedTokens()
    const unlocked = await reply('settings:unlock')
    await save(settingsWith(profileWith({ githubToken: 'ghp_file' })), unlocked.generation, { import: 'merge' })
    expect(storeJson().p).toEqual({ githubToken: 'ghp_file', azureToken: 'az_old' })
  })

  it('with credentials, "Replace all" makes them the only ones', async () => {
    await storedTokens()
    const unlocked = await reply('settings:unlock')
    await save(settingsWith(profileWith({ githubToken: 'ghp_file' })), unlocked.generation, { import: 'replace' })
    expect(storeJson().p).toEqual({ githubToken: 'ghp_file' })
  })

  it('"Replace all" with a file that carries no credentials clears nothing', async () => {
    await storedTokens()
    const unlocked = await reply('settings:unlock')
    await save(settingsWith(profileWith({})), unlocked.generation, { import: 'replace' })
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
  })

  it('the next ordinary save, before the renderer reloads, clears nothing either', async () => {
    await storedTokens()
    const unlocked = await reply('settings:unlock')
    const imported = settingsWith(profileWith({}))
    await save(imported, unlocked.generation, { import: 'merge' })
    await save({ ...imported, language: 'de' }, unlocked.generation)
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
  })
})

describe('a debounced save racing an unlock', () => {
  it('a save built from the reply before the unlock keeps every token', async () => {
    await storedTokens()
    const before = await reply('settings:get')
    expect(before.settings.profiles[0].githubToken).toBeFalsy()
    await reply('settings:unlock')
    // Scheduled before the unlock, fired after it: blank tokens, old generation.
    await save({ ...before.settings, language: 'de' }, before.generation)
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
  })

  it('a save without a generation (an older caller) clears nothing', async () => {
    await storedTokens()
    const unlocked = await reply('settings:unlock')
    await raw('settings:set', settingsWith(profileWith({})))
    expect(unlocked.settings.profiles[0].azureToken).toBe('az_old')
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
  })

  it('a save built from the unlock itself still clears what the user cleared', async () => {
    await storedTokens()
    const unlocked = await reply('settings:unlock')
    const p = unlocked.settings.profiles[0]
    await save({ ...unlocked.settings, profiles: [{ ...p, githubToken: '' }] }, unlocked.generation)
    expect(storeJson().p).toEqual({ azureToken: 'az_old' })
  })
})

describe('the settings file on disk', () => {
  it('missing reads as defaults', async () => {
    await storedTokens()
    rmSync(settingsFile())
    expect((await reply('settings:get')).settings.onboardingCompleted).toBe(defaultSettings().onboardingCompleted)
  })

  it('present but unparseable is an error, never defaults, and is left untouched', async () => {
    await storedTokens()
    writeFileSync(settingsFile(), '{"profiles": [')
    expect(await raw('settings:get')).toEqual({ error: 'parse' })
    expect(readFileSync(settingsFile(), 'utf8')).toBe('{"profiles": [')
  })

  it('reads during a stream of saves never answer defaults', async () => {
    await storedTokens()
    // Big enough that an in-place write is visibly half-done for a moment.
    const recentRepos = Array.from({ length: 4000 }, (_, i) => ({ path: `/repos/r${i}`, name: `repo-${i}` }))
    const big = settingsWith(profileWith({ name: 'Marker' }), { recentRepos } as Partial<AppSettings>)
    const { generation } = await reply('settings:get')
    await save(big, generation)
    let defaults = 0
    let reads = 0
    const end = Date.now() + 1500
    const writer = (async () => {
      let i = 0
      while (Date.now() < end) await save({ ...big, language: i++ % 2 ? 'de' : 'en' }, generation)
    })()
    const reader = (async () => {
      while (Date.now() < end) {
        reads++
        try {
          const s = (await reply('settings:get')).settings
          if (s.profiles[0]?.name !== 'Marker') defaults++
        } catch {
          // Retried and still unreadable: an error, which is not defaults.
        }
      }
    })()
    await Promise.all([writer, reader])
    expect(reads).toBeGreaterThan(20)
    expect(defaults).toBe(0)
  })

  it('concurrent saves never leave a corrupt file, and it is owner-only', async () => {
    await storedTokens()
    const { generation } = await reply('settings:get')
    let corrupt = 0
    for (let r = 0; r < 40; r++) {
      const long = settingsWith(profileWith({ name: 'L'.repeat(200000) }))
      const short = settingsWith(profileWith({ name: 'S' }))
      await Promise.all([save(long, generation), save(short, generation), save(long, generation)])
      try {
        JSON.parse(readFileSync(settingsFile(), 'utf8'))
      } catch {
        corrupt++
      }
    }
    expect(corrupt).toBe(0)
    if (process.platform !== 'win32') expect(statSync(settingsFile()).mode & 0o777).toBe(0o600)
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
    expect(existsSync(settingsFile())).toBe(true)
  })
})
