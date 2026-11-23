import { describe, it, expect, vi, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import type { SecretStore } from '../src/shared/secrets'

// The v4.37.2 review: ways the settings hotfix could still overwrite the
// user's file or lose (or resurrect) a token. Real handlers, a fake keyring.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-settings-review-'))
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
async function reply(channel: 'settings:get' | 'settings:unlock'): Promise<Reply> {
  const out = (await raw(channel)) as Reply
  expect(out.settings).toBeTruthy()
  return out
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
async function fresh(consent: 'granted' | 'declined' = 'granted'): Promise<void> {
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true, recursive: true })
  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent, explained: true }))
  writeStore({ p: { githubToken: 'ghp_old', azureToken: 'az_old' } })
  writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith({ name: 'Mine' }))))
  vi.resetModules()
  handlers.clear()
  const settings = await import('../src/main/settings')
  const keychain = await import('../src/main/keychain')
  settings.registerSettingsHandlers()
  keychain.registerKeychainHandlers()
}

describe('a save main must refuse', () => {
  it('before any get in this process: nothing is written', async () => {
    await fresh()
    const before = readFileSync(settingsFile(), 'utf8')
    expect(await save(defaultSettings(), 0)).toEqual({ refused: 'not-loaded' })
    expect(readFileSync(settingsFile(), 'utf8')).toBe(before)
  })

  it('while the file is known unparseable, even after an earlier good read', async () => {
    await fresh()
    const { generation } = await reply('settings:get')
    writeFileSync(settingsFile(), '{"profiles": [')
    expect(await raw('settings:get')).toEqual({ error: 'parse' })
    expect(await save(defaultSettings(), generation)).toEqual({ refused: 'not-loaded' })
    expect(readFileSync(settingsFile(), 'utf8')).toBe('{"profiles": [')
  })
})

describe('why a load failed', () => {
  it('a file that does not parse is a parse error', async () => {
    await fresh()
    writeFileSync(settingsFile(), 'not json')
    expect(await raw('settings:get')).toEqual({ error: 'parse' })
    expect(await raw('settings:unlock')).toEqual({ error: 'parse' })
  })

  it('a file that cannot be read is an I/O error, not "damaged"', async () => {
    await fresh()
    rmSync(settingsFile())
    mkdirSync(settingsFile())
    expect(await raw('settings:get')).toEqual({ error: 'io' })
  })
})

describe('moving a damaged settings file aside', () => {
  it('renames it (never deletes), keeps a copy of the store, and lets the app start fresh', async () => {
    await fresh()
    writeFileSync(settingsFile(), '{"profiles": [')
    expect(await raw('settings:get')).toEqual({ error: 'parse' })
    const moved = (await raw('settings:moveAside')) as string
    // The full path, so the boot screen can say where it went.
    expect(moved.startsWith(join(realpathSync(dir), 'gitcito-settings.json.corrupt-'))).toBe(true)
    expect(readFileSync(moved, 'utf8')).toBe('{"profiles": [')
    expect(existsSync(settingsFile())).toBe(false)
    expect(readdirSync(dir).some((f) => f.startsWith('gitcito-secrets.enc.corrupt-'))).toBe(true)
    const { settings, generation } = await reply('settings:get')
    expect(settings.onboardingCompleted).toBe(defaultSettings().onboardingCompleted)
    expect(await save({ ...settings, language: 'de' }, generation)).toBeUndefined()
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).language).toBe('de')
  })

  it('refuses for a file that parses', async () => {
    await fresh()
    expect(await raw('settings:moveAside')).toBeNull()
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).profiles[0].name).toBe('Mine')
    expect(readdirSync(dir).filter((f) => f.includes('.corrupt-'))).toEqual([])
  })
})

describe('"Replace all" with the keychain declined', () => {
  it('is refused, and changes neither the file nor the tokens in use', async () => {
    await fresh('declined')
    const { generation } = await reply('settings:get')
    const before = readFileSync(settingsFile(), 'utf8')
    const imported = settingsWith(profileWith({ name: 'Imported', githubToken: 'ghp_file' }))
    expect(await save(imported, generation, { import: 'replace' })).toEqual({ refused: 'keychain-required' })
    expect(readFileSync(settingsFile(), 'utf8')).toBe(before)
    expect((await reply('settings:get')).settings.profiles[0].githubToken).toBeFalsy()
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
  })
})

describe('a clear racing an unlock', () => {
  it('a clear in flight when the unlock arrives stays cleared, and nothing writes it back', async () => {
    await fresh()
    const unlocked = await reply('settings:unlock')
    expect(unlocked.settings.profiles[0].githubToken).toBe('ghp_old')
    const cleared = settingsWith(profileWith({ name: 'Mine', githubToken: '', azureToken: 'az_old' }))
    // Not awaited: the unlock arrives while the clear is still being written.
    const clearing = save(cleared, unlocked.generation)
    const again = await reply('settings:unlock')
    await clearing
    expect(again.settings.profiles[0].githubToken).toBeFalsy()
    expect(storeJson().p).toEqual({ azureToken: 'az_old' })
    // The renderer saves what it was just served: still cleared.
    await save({ ...again.settings, language: 'de' }, again.generation)
    expect(storeJson().p).toEqual({ azureToken: 'az_old' })
  })

  it('a save sent after an unlock arrived, built on the reply before it, clears nothing', async () => {
    await fresh()
    const unlocked = await reply('settings:unlock')
    const unlocking = reply('settings:unlock')
    await save(settingsWith(profileWith({ name: 'Mine' })), unlocked.generation)
    await unlocking
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
  })
})

describe('tokens with the keychain off', () => {
  it('a cleared token is gone for the session, and stays gone once the keychain is turned on', async () => {
    await fresh('declined')
    let r = await reply('settings:get')
    await save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_new', bitbucketToken: 'bb' })), r.generation)
    r = await reply('settings:get')
    expect(r.settings.profiles[0]).toMatchObject({ githubToken: 'ghp_new', bitbucketToken: 'bb' })
    // The user clears both fields they can see.
    await save(settingsWith(profileWith({ name: 'Mine' })), r.generation)
    r = await reply('settings:get')
    expect(r.settings.profiles[0].githubToken).toBeFalsy()
    expect(r.settings.profiles[0].bitbucketToken).toBeFalsy()
    expect(await raw('keychain:set', true)).toBe(true)
    // 4.38's per-slot rule: the session's own tokens are gone and stay gone;
    // the stored ones this session never decrypted (keychain declined from
    // launch) were never the renderer's to clear, so the store keeps them —
    // bitbucket, typed and cleared, never reaches it.
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
  })

  it('a reply carrying only session tokens never lets a save wipe the stored ones', async () => {
    await fresh('declined')
    let r = await reply('settings:get')
    await save(settingsWith(profileWith({ name: 'Mine', bitbucketToken: 'bb' })), r.generation)
    r = await reply('settings:get')
    expect(r.settings.profiles[0].bitbucketToken).toBe('bb')
    expect(await raw('keychain:set', true)).toBe(true)
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old', bitbucketToken: 'bb' })
    // Built on the reply that only had the session token, sent after the move.
    await save({ ...r.settings, language: 'de' }, r.generation)
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old', bitbucketToken: 'bb' })
  })
})
