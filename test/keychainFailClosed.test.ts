import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import type { SecretStore } from '../src/shared/secrets'
import { settingsIpc } from './settingsIpc'

// The keychain fails closed. Verified on Electron 45.5 (Linux): the backend is
// known before any call (`basic_text`, or the keyring's name), async
// availability says yes even under `basic_text`, and ciphertext is tagged `v10`
// (the fixed password) or `v11` (the keyring's key). So an `unknown` backend
// and a `v10` ciphertext both count as weak; a hung availability check times
// out as "unavailable"; and a store read with a retiring key is re-sealed.
// A fake keyring whose backend, ciphertext tag and timing are chosen per test.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-keychain-closed-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = {
  backend: 'gnome_libsecret',
  prefix: 'v11',
  hang: false,
  availableCalls: 0
}
let releaseHang: ((ok: boolean) => void) | null = null

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: () => {
      keyring.availableCalls++
      if (!keyring.hang) return Promise.resolve(true)
      return new Promise<boolean>((resolve) => {
        releaseHang = resolve
      })
    },
    getSelectedStorageBackend: () => keyring.backend,
    encryptStringAsync: async (s: string) => Buffer.from(`${keyring.prefix}enc:${s}`),
    // `old` stands for a key safeStorage is retiring: readable, but asks to be re-sealed.
    decryptStringAsync: async (b: Buffer) => {
      const m = /^(v10|v11|old)enc:/.exec(b.toString())
      if (!m) throw new Error('not ours')
      return { result: b.toString().slice(m[0].length), shouldReEncrypt: m[1] === 'old' }
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
const storeText = (): string => Buffer.from(readFileSync(storeFile(), 'utf8'), 'base64').toString()
const storeJson = (): SecretStore => JSON.parse(storeText().slice('v11enc:'.length)) as SecretStore
const writeStore = (s: SecretStore, prefix = keyring.prefix, file = storeFile()): void =>
  writeFileSync(file, Buffer.from(`${prefix}enc:${JSON.stringify(s)}`).toString('base64'))

const ipc = settingsIpc(handlers)
const call = (channel: string, ...args: unknown[]): Promise<unknown> => ipc({ sender: { id: 1 } }, channel, ...args)

const profile = (over: Partial<Profile> = {}): Profile => ({ ...defaultSettings().profiles[0], id: 'p', name: 'p', ...over })
const settingsWith = (p: Profile): AppSettings => ({ ...defaultSettings(), onboardingCompleted: true, profiles: [p], activeProfileId: 'p' })

function reset(store?: SecretStore, storePrefix?: string): void {
  for (const f of ['githuttbr-settings.json', 'githuttbr-secrets.enc', 'githuttbr-secrets.enc.bak', 'githuttbr-keychain.json']) {
    rmSync(join(dir, f), { force: true })
  }
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
  writeFileSync(settingsFile(), JSON.stringify(settingsWith(profile())))
  if (store) writeStore(store, storePrefix)
}

async function keychain(): Promise<typeof import('../src/main/keychain')> {
  vi.resetModules()
  return import('../src/main/keychain')
}

/** A fresh main process with the settings and keychain handlers registered. */
async function start(store?: SecretStore, storePrefix?: string): Promise<void> {
  reset(store, storePrefix)
  vi.resetModules()
  handlers.clear()
  const mod = await import('../src/main/settings')
  const kc = await import('../src/main/keychain')
  mod.registerSettingsHandlers()
  kc.registerKeychainHandlers()
  await handlers.get('settings:get')!({ sender: { id: 99 } })
}

const unlock = async (): Promise<Profile> => ((await call('settings:unlock')) as AppSettings).profiles[0]
const status = (): Promise<unknown> => call('keychain:status')

beforeEach(() => {
  onPlatform('linux')
  keyring.backend = 'gnome_libsecret'
  keyring.prefix = 'v11'
  keyring.hang = false
  keyring.availableCalls = 0
  releaseHang = null
})

describe('which store counts as weak', () => {
  it('a real keyring with v11 ciphertext is not weak', async () => {
    reset()
    const kc = await keychain()
    expect(await kc.isKeychainWeak()).toBe(false)
  })

  it('an unknown backend on Linux is weak', async () => {
    reset()
    keyring.backend = 'unknown'
    const kc = await keychain()
    expect(await kc.isKeychainWeak()).toBe(true)
  })

  it('an unknown backend elsewhere is not: the rule is Linux’s alone', async () => {
    reset()
    onPlatform('darwin')
    keyring.backend = 'unknown'
    const kc = await keychain()
    expect(await kc.isKeychainWeak()).toBe(false)
  })

  it('a keyring that seals with the fixed password (v10) is weak, whatever the backend says', async () => {
    reset()
    keyring.prefix = 'v10'
    const kc = await keychain()
    expect(await kc.isKeychainWeak()).toBe(true)
  })

  it('sealSecret refuses a v10 ciphertext on Linux unless a weak store may take it', async () => {
    reset()
    keyring.prefix = 'v10'
    const kc = await keychain()
    await expect(kc.sealSecret('token')).rejects.toBeInstanceOf(kc.WeakKeychainError)
    expect((await kc.sealSecret('removal', { allowWeak: true })).toString()).toBe('v10enc:removal')
  })

  it('v10 means nothing on macOS or Windows: their ciphertext is tagged differently', async () => {
    for (const platform of ['darwin', 'win32'] as const) {
      reset()
      onPlatform(platform)
      keyring.prefix = 'v10'
      const kc = await keychain()
      expect((await kc.sealSecret('token')).toString()).toBe('v10enc:token')
      expect(await kc.isKeychainWeak()).toBe(false)
    }
  })
})

describe('a keyring that claims to be real but seals with the fixed password', () => {
  it('keeps a new token for the session only, and Settings says the store is weak', async () => {
    await start({ p: { azureToken: 'OLD-AZ' } }, 'v10')
    keyring.prefix = 'v10'
    const before = readFileSync(storeFile(), 'utf8')
    const p = await unlock()
    expect(p.azureToken).toBe('OLD-AZ')
    await call('settings:set', settingsWith({ ...p, githubToken: 'NEW-GH' }))

    expect(readFileSync(storeFile(), 'utf8')).toBe(before)
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain('NEW-GH')
    expect(await status()).toMatchObject({ weakBackend: true, sessionOnly: true })
    expect((await unlock()).githubToken).toBe('NEW-GH')
  })

  it('still removes a cleared token from the store', async () => {
    await start({ p: { azureToken: 'OLD-AZ', githubToken: 'OLD-GH' } }, 'v10')
    keyring.prefix = 'v10'
    const p = await unlock()
    await call('settings:set', settingsWith({ ...p, azureToken: '' }))
    expect(storeText()).not.toContain('OLD-AZ')
    expect(storeText()).toContain('OLD-GH')
  })
})

describe('a hung availability check', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Advances the fake clock until `promise` settles; real I/O gets its turns in between. */
  async function settle<T>(promise: Promise<T>): Promise<T> {
    let done = false
    void promise.finally(() => {
      done = true
    })
    for (let i = 0; i < 40 && !done; i++) {
      await new Promise((r) => setImmediate(r))
      await vi.advanceTimersByTimeAsync(1000)
    }
    return promise
  }

  it('answers "unavailable" after the timeout, asks D-Bus once, and takes a late answer next time', async () => {
    reset()
    const kc = await keychain()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    keyring.hang = true

    let answered = false
    const first = kc.canUseKeychain().finally(() => {
      answered = true
    })
    const second = kc.canUseKeychain()
    // The consent file is real I/O: wait until both are actually waiting on D-Bus.
    for (let i = 0; i < 100 && keyring.availableCalls === 0; i++) await new Promise((r) => setImmediate(r))
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r))
    await vi.advanceTimersByTimeAsync(kc.AVAILABILITY_TIMEOUT_MS - 1)
    expect(answered).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await first).toBe(false)
    expect(await settle(second)).toBe(false)
    expect(keyring.availableCalls).toBe(1)

    // The late answer arrives: it is the next caller's, and nothing else moved.
    releaseHang!(true)
    keyring.hang = false
    expect(await kc.canUseKeychain()).toBe(true)
  })

  it('does not hold the settings queue: a token save lands session-only, and the next read answers', async () => {
    await start()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    keyring.hang = true
    const p = ((await call('settings:get')) as AppSettings).profiles[0]
    await settle(call('settings:set', settingsWith({ ...p, githubToken: 'TYPED-WHILE-HUNG' })))

    expect(existsSync(storeFile())).toBe(false)
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain('TYPED-WHILE-HUNG')
    const reread = (await settle(call('settings:get'))) as AppSettings
    expect(reread.profiles[0].githubToken).toBe('TYPED-WHILE-HUNG')
  })
})

describe('a store read with a retiring key (shouldReEncrypt)', () => {
  it('is re-sealed with the current key on the next unlock', async () => {
    await start({ p: { azureToken: 'OLD-AZ' } }, 'old')
    expect((await unlock()).azureToken).toBe('OLD-AZ')
    expect(storeText().startsWith('v11enc:')).toBe(true)
    expect(storeJson()).toEqual({ p: { azureToken: 'OLD-AZ' } })
  })

  it('is left as it is when the store is weak', async () => {
    await start({ p: { azureToken: 'OLD-AZ' } }, 'old')
    keyring.backend = 'basic_text'
    const before = readFileSync(storeFile(), 'utf8')
    expect((await unlock()).azureToken).toBe('OLD-AZ')
    expect(readFileSync(storeFile(), 'utf8')).toBe(before)
  })

  it('never re-seals a backup', async () => {
    await start({ p: { azureToken: 'OLD-AZ' } }, 'old')
    const backup = join(dir, 'githuttbr-secrets.enc.bak')
    writeStore({ p: { azureToken: 'OLDER-AZ' } }, 'old', backup)
    const before = readFileSync(backup, 'utf8')
    await unlock()
    expect(readFileSync(backup, 'utf8')).toBe(before)
  })
})
