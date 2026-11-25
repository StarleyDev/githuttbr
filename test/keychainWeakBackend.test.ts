import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultAIConfig, defaultSettings, type AIConfig, type AppSettings, type Profile } from '../src/shared/types'
import type { SecretStore } from '../src/shared/secrets'
import { settingsIpc } from './settingsIpc'

// Linux with no secret service: safeStorage reports encryption available but
// "encrypts" with `basic_text`, a password fixed in Chromium's source. What the
// store already holds stays readable and removable; a token typed now is kept
// for the session only. Real handlers, a fake keyring whose backend is chosen
// per test, and the platform switched to show the rule is Linux's alone.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-weak-keychain-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { backend: 'basic_text' }

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => keyring.backend,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => {
      const s = b.toString()
      if (!s.startsWith('enc:')) throw new Error('not ours')
      return s.slice(4)
    }
  }
}))

const realPlatform = process.platform
const onPlatform = (platform: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

afterAll(() => {
  onPlatform(realPlatform)
  rmSync(dir, { recursive: true, force: true })
})

const settingsFile = (): string => join(dir, 'githuttbr-settings.json')
const storeFile = (): string => join(dir, 'githuttbr-secrets.enc')
const storeRaw = (): string => readFileSync(storeFile(), 'utf8')
const storeJson = (): SecretStore => JSON.parse(Buffer.from(storeRaw(), 'base64').toString().slice(4)) as SecretStore
const writeStore = (s: SecretStore): void =>
  writeFileSync(storeFile(), Buffer.from(`enc:${JSON.stringify(s)}`).toString('base64'))

const ipc = settingsIpc(handlers)
const call = (channel: string, ...args: unknown[]): Promise<unknown> => ipc({ sender: { id: 1 } }, channel, ...args)

const profile = (over: Partial<Profile> = {}): Profile => ({ ...defaultSettings().profiles[0], id: 'p', name: 'p', ...over })
const settingsWith = (p: Profile): AppSettings => ({ ...defaultSettings(), onboardingCompleted: true, profiles: [p], activeProfileId: 'p' })

/** A fresh main process over these files. */
async function start(opts: {
  consent?: 'granted' | 'declined'
  store?: SecretStore
  file?: object
}): Promise<typeof import('../src/main/settings')> {
  for (const f of ['githuttbr-settings.json', 'githuttbr-secrets.enc', 'githuttbr-keychain.json']) {
    rmSync(join(dir, f), { force: true })
  }
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: opts.consent ?? 'granted', explained: true }))
  writeFileSync(settingsFile(), JSON.stringify(opts.file ?? settingsWith(profile())))
  if (opts.store) writeStore(opts.store)
  return restart()
}

async function restart(): Promise<typeof import('../src/main/settings')> {
  vi.resetModules()
  handlers.clear()
  const mod = await import('../src/main/settings')
  const kc = await import('../src/main/keychain')
  mod.registerSettingsHandlers()
  kc.registerKeychainHandlers()
  await handlers.get('settings:get')!({ sender: { id: 99 } })
  return mod
}

const unlock = async (): Promise<Profile> => ((await call('settings:unlock')) as AppSettings).profiles[0]
const status = (): Promise<unknown> => call('keychain:status')

describe('a basic_text keychain on Linux', () => {
  beforeEach(() => {
    onPlatform('linux')
    keyring.backend = 'basic_text'
  })

  it('still reads what the store holds, and says it is weak', async () => {
    await start({ store: { p: { azureToken: 'OLD-AZ' } } })
    expect((await unlock()).azureToken).toBe('OLD-AZ')
    expect(await status()).toMatchObject({ consent: 'granted', available: true, weakBackend: true, sessionOnly: false })
  })

  it('keeps a new token for the session only, and reports it so', async () => {
    await start({ store: { p: { azureToken: 'OLD-AZ' } } })
    const before = storeRaw()
    const p = await unlock()
    await call('settings:set', settingsWith({ ...p, githubToken: 'NEW-GH' }))

    expect(storeRaw()).toBe(before)
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain('NEW-GH')
    expect(await status()).toMatchObject({ weakBackend: true, sessionOnly: true })
    const reread = await unlock()
    expect(reread.githubToken).toBe('NEW-GH')
    expect(reread.azureToken).toBe('OLD-AZ')

    // Gone after a restart; the stored one is not.
    await restart()
    const after = await unlock()
    expect(after.githubToken).toBe('')
    expect(after.azureToken).toBe('OLD-AZ')
  })

  it('creates no store for a first token', async () => {
    await start({})
    const p = await unlock()
    await call('settings:set', settingsWith({ ...p, githubToken: 'FIRST-GH' }))
    expect(existsSync(storeFile())).toBe(false)
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain('FIRST-GH')
    expect(await status()).toMatchObject({ sessionOnly: true })
    expect((await unlock()).githubToken).toBe('FIRST-GH')
  })

  it('removes a cleared token from the store', async () => {
    await start({ store: { p: { azureToken: 'OLD-AZ', githubToken: 'OLD-GH' } } })
    const p = await unlock()
    await call('settings:set', settingsWith({ ...p, azureToken: '' }))
    expect(storeJson()).toEqual({ p: { githubToken: 'OLD-GH' } })
    expect(await status()).toMatchObject({ sessionOnly: false })
    await restart()
    const after = await unlock()
    expect(after.azureToken).toBe('')
    expect(after.githubToken).toBe('OLD-GH')
  })

  it('removes a cleared token in the same save that brings a new one', async () => {
    await start({ store: { p: { azureToken: 'OLD-AZ' } } })
    const p = await unlock()
    await call('settings:set', settingsWith({ ...p, azureToken: '', githubToken: 'NEW-GH' }))
    expect(JSON.stringify(storeJson())).not.toContain('OLD-AZ')
    expect(JSON.stringify(storeJson())).not.toContain('NEW-GH')
    expect((await unlock()).githubToken).toBe('NEW-GH')
  })

  it('a replaced token leaves the store, and the new one stays in memory', async () => {
    await start({ store: { p: { azureToken: 'OLD-AZ', githubToken: 'OLD-GH' } } })
    const p = await unlock()
    await call('settings:set', settingsWith({ ...p, azureToken: 'NEW-AZ' }))
    const stored = JSON.stringify(storeJson())
    expect(stored).not.toContain('OLD-AZ')
    expect(stored).not.toContain('NEW-AZ')
    expect(storeJson().p?.githubToken).toBe('OLD-GH')
    expect((await unlock()).azureToken).toBe('NEW-AZ')
    expect(await status()).toMatchObject({ sessionOnly: true })
    // Never the replaced token after a restart.
    await restart()
    expect((await unlock()).azureToken).toBe('')
  })

  it('a save without tokens leaves the session token and the store alone', async () => {
    await start({ store: { p: { azureToken: 'OLD-AZ' } } })
    const p = await unlock()
    await call('settings:set', settingsWith({ ...p, githubToken: 'NEW-GH' }))
    const before = storeRaw()
    // A tab move from a window that was never served the tokens.
    await ipc({ sender: { id: 7 } }, 'settings:set', { ...settingsWith(profile()), sidebarWidth: 321 })
    expect(storeRaw()).toBe(before)
    expect((await unlock()).githubToken).toBe('NEW-GH')
  })

  it('turning the keychain on does not move session tokens into it', async () => {
    await start({ consent: 'declined' })
    const p = ((await call('settings:get')) as AppSettings).profiles[0]
    await call('settings:set', settingsWith({ ...p, azureToken: 'TYPED-WHILE-OFF' }))

    expect(await call('keychain:set', true)).toBe(true)
    expect(existsSync(storeFile())).toBe(false)
    expect(await status()).toMatchObject({ consent: 'granted', weakBackend: true, sessionOnly: true })
    expect((await unlock()).azureToken).toBe('TYPED-WHILE-OFF')
    expect(existsSync(storeFile())).toBe(false)
  })

  it('a token typed while off, over a stored one, reaches neither the store nor the restart', async () => {
    await start({ consent: 'declined', store: { p: { azureToken: 'OLD-AZ' } } })
    const p = ((await call('settings:get')) as AppSettings).profiles[0]
    await call('settings:set', settingsWith({ ...p, githubToken: 'TYPED-WHILE-OFF' }))
    expect(await call('keychain:set', true)).toBe(true)
    expect(JSON.stringify(storeJson())).not.toContain('TYPED-WHILE-OFF')
    const now = await unlock()
    expect(now.githubToken).toBe('TYPED-WHILE-OFF')
    expect(now.azureToken).toBe('OLD-AZ')
    expect(storeJson()).toEqual({ p: { azureToken: 'OLD-AZ' } })
  })

  it('does not settle the general AI into the store, and keeps its key readable', async () => {
    const anthropic = (): AIConfig => ({
      ...defaultAIConfig(),
      accounts: [{ id: 'anthropic', label: 'Anthropic', provider: 'anthropic', endpoint: '', apiKey: '', model: 'claude-x' }],
      defaultAccountId: 'anthropic'
    })
    const { ai: _ai, ...preGeneral } = { ...defaultSettings(), onboardingCompleted: true }
    void _ai
    const file = { ...preGeneral, profiles: [profile({ ai: anthropic() })], activeProfileId: 'p' }
    const mod = await start({ file, store: { p: { aiKeys: { anthropic: 'sk-p' } } } })
    const before = storeRaw()
    expect(await mod.activeProfileAiKey('anthropic')).toBe('sk-p')
    const unlocked = (await call('settings:unlock')) as AppSettings
    expect(unlocked.ai.accounts[0].apiKey).toBe('sk-p')
    expect(storeRaw()).toBe(before)
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain('sk-p')
    // Still there on the next start.
    const again = await restart()
    expect(await again.activeProfileAiKey('anthropic')).toBe('sk-p')
  })

  it('leaves plaintext tokens in the file rather than moving them into a weak store', async () => {
    const file = settingsWith(profile({ githubToken: 'PLAIN-GH' }))
    await start({ file, store: { p: { azureToken: 'OLD-AZ' } } })
    const before = storeRaw()
    const p = await unlock()
    expect(p.githubToken).toBe('PLAIN-GH')
    expect(p.azureToken).toBe('OLD-AZ')
    expect(storeRaw()).toBe(before)
    expect(readFileSync(settingsFile(), 'utf8')).toContain('PLAIN-GH')
  })
})

describe('the same token anywhere else', () => {
  it.each([
    ['linux', 'gnome_libsecret'],
    ['linux', 'kwallet5'],
    ['darwin', 'basic_text'],
    ['win32', 'basic_text']
  ] as const)('%s with %s writes it to the store', async (platform, backend) => {
    onPlatform(platform)
    keyring.backend = backend
    await start({ store: { p: { azureToken: 'OLD-AZ' } } })
    const p = await unlock()
    await call('settings:set', settingsWith({ ...p, githubToken: 'NEW-GH' }))
    expect(storeJson()).toEqual({ p: { azureToken: 'OLD-AZ', githubToken: 'NEW-GH' } })
    expect(await status()).toMatchObject({ weakBackend: false, sessionOnly: false })
  })
})
