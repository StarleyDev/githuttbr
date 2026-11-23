import { describe, it, expect, vi, afterAll, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile } from '../src/shared/types'
import type { SecretStore } from '../src/shared/secrets'

// The second and third v4.37.2 reviews: a consent question that could block
// settings forever, keychain-off clears, and generations that went stale.
// Real handlers, a fake keyring, and a seam in front of fs reads.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-settings-review2-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

const seams = vi.hoisted(() => ({
  /** Returns text to answer a read with, throws to fail it, or undefined for the real file. */
  readFile: null as null | ((path: string) => Promise<string | undefined>),
  windows: [] as unknown[]
}))

vi.mock('fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('fs/promises')>()
  const readFile = (async (...args: Parameters<typeof real.readFile>) => {
    const over = seams.readFile ? await seams.readFile(String(args[0])) : undefined
    return over !== undefined ? over : real.readFile(...args)
  }) as typeof real.readFile
  return { ...real, default: { ...real, readFile }, readFile }
})

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => seams.windows },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString().replace(/^enc:/, '')
  }
}))

afterAll(() => rmSync(dir, { recursive: true, force: true }))
afterEach(() => {
  seams.readFile = null
  seams.windows = []
})

const settingsFile = (): string => join(dir, 'gitcito-settings.json')
const storeFile = (): string => join(dir, 'gitcito-secrets.enc')
const consentFile = (): string => join(dir, 'gitcito-keychain.json')
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
const settingsWith = (profile: Profile): AppSettings => ({
  ...defaultSettings(),
  onboardingCompleted: true,
  profiles: [profile]
})

/** Settles to 'timeout' if `p` has not settled within `ms`: a hang fails the test instead of the run. */
const within = <T,>(p: Promise<T>, ms = 3000): Promise<T | 'timeout'> =>
  Promise.race([p, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))])
const tick = (ms = 50): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** A new main process over whatever files are in `dir` now. */
async function boot(): Promise<void> {
  vi.resetModules()
  handlers.clear()
  const settings = await import('../src/main/settings')
  const keychain = await import('../src/main/keychain')
  settings.registerSettingsHandlers()
  keychain.registerKeychainHandlers()
}

async function fresh(opts: { consent?: 'granted' | 'declined'; store?: SecretStore | null } = {}): Promise<void> {
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true, recursive: true })
  if (opts.consent) writeFileSync(consentFile(), JSON.stringify({ consent: opts.consent, explained: true }))
  const store = opts.store === undefined ? { p: { githubToken: 'ghp_old', azureToken: 'az_old' } } : opts.store
  if (store) writeStore(store)
  writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith({ name: 'Mine' }))))
  await boot()
}

/** A window the consent question can be shown in, and whose page can go away. */
function fakeWindow(): { win: EventEmitter; contents: EventEmitter & { send: ReturnType<typeof vi.fn> } } {
  const contents = Object.assign(new EventEmitter(), { send: vi.fn() })
  const win = Object.assign(new EventEmitter(), { webContents: contents, isDestroyed: () => false })
  seams.windows = [win]
  return { win, contents }
}

describe('a consent question whose page went away', () => {
  const pageGone: Array<[string, unknown[]]> = [
    ['did-start-navigation', [{ isMainFrame: true, isSameDocument: false }]],
    ['render-process-gone', []],
    ['destroyed', []]
  ]
  for (const [event, args] of pageGone) {
    it(`settles on '${event}', so the next renderer's settings:get is answered`, async () => {
      await fresh({ store: null })
      const { contents } = fakeWindow()
      const r = await reply('settings:get')
      // A token save asks — and the settings queue waits behind the question.
      const saving = save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_new' })), r.generation)
      await tick()
      expect(contents.send).toHaveBeenCalledWith('keychain:ask', expect.anything())
      contents.emit(event, ...args)
      const next = await within(raw('settings:get'))
      expect(next).not.toBe('timeout')
      expect((next as Reply).settings.profiles[0].name).toBe('Mine')
      expect(await within(saving)).toBeUndefined()
      // Nobody answered: not recorded as a refusal, so it is asked again next time.
      expect(existsSync(consentFile()) ? JSON.parse(readFileSync(consentFile(), 'utf8')).consent : 'unset').toBe('unset')
    })
  }

  it('an answer after the page reloaded does not settle a later question', async () => {
    await fresh({ store: null })
    const { contents } = fakeWindow()
    const r = await reply('settings:get')
    const first = save(settingsWith(profileWith({ name: 'Mine', githubToken: 'a' })), r.generation)
    await tick()
    contents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false })
    await first
    const second = save(settingsWith(profileWith({ name: 'Mine', githubToken: 'b' })), r.generation)
    await tick()
    // The old page's listeners are gone: a second reload event is this question's own.
    expect(contents.listenerCount('did-start-navigation')).toBe(1)
    await raw('keychain:answer', true)
    expect(await within(second)).toBeUndefined()
    expect(storeJson().p).toEqual({ githubToken: 'b' })
  })

  it('a subframe or in-page navigation leaves the question open', async () => {
    await fresh({ store: null })
    const { contents } = fakeWindow()
    const r = await reply('settings:get')
    const saving = save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_a' })), r.generation)
    await tick()
    // The PDF preview's <iframe> loading (Electron reports it as both), and a route change in the page.
    contents.emit('did-start-loading')
    contents.emit('did-start-navigation', { isMainFrame: false, isSameDocument: false })
    contents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true })
    expect(await within(saving, 200)).toBe('timeout')
    await raw('keychain:answer', true)
    expect(await within(saving)).toBeUndefined()
    expect(storeJson().p).toEqual({ githubToken: 'ghp_a' })
  })
})

describe('a token cleared while the keychain was off', () => {
  async function clearWhileOff(): Promise<void> {
    await fresh({ consent: 'declined' })
    let r = await reply('settings:get')
    await save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_new' })), r.generation)
    r = await reply('settings:get')
    await save(settingsWith(profileWith({ name: 'Mine' })), r.generation)
    // Nothing about the clear reaches the settings file.
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8'))).not.toHaveProperty('pendingSecretClears')
  }

  it('stays cleared for the session, and the store loses it when the keychain is turned on', async () => {
    await clearWhileOff()
    expect((await reply('settings:unlock')).settings.profiles[0].githubToken).toBeFalsy()
    // Still in the store until the keychain can be written.
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
    await raw('keychain:set', true)
    expect(storeJson().p).toEqual({ azureToken: 'az_old' })
    await boot()
    expect((await reply('settings:unlock')).settings.profiles[0].githubToken).toBeFalsy()
  })

  it('comes back after a restart if the keychain was never turned on: the documented limit', async () => {
    await clearWhileOff()
    writeFileSync(consentFile(), JSON.stringify({ consent: 'granted', explained: true }))
    await boot()
    expect((await reply('settings:unlock')).settings.profiles[0].githubToken).toBe('ghp_old')
  })

  it('a pendingSecretClears list left by a pre-release build is never obeyed, and a save drops it', async () => {
    await fresh({ consent: 'granted' })
    const stale = { ...settingsWith(profileWith({ name: 'Mine' })), pendingSecretClears: ['p\u0000githubToken'] }
    writeFileSync(settingsFile(), JSON.stringify(stale))
    await boot()
    const u = await reply('settings:unlock')
    expect(u.settings).not.toHaveProperty('pendingSecretClears')
    expect(u.settings.profiles[0].githubToken).toBe('ghp_old')
    await save({ ...u.settings, language: 'de' }, u.generation)
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8'))).not.toHaveProperty('pendingSecretClears')
  })

  it('a save from the renderer cannot write a list of clears either', async () => {
    await fresh({ consent: 'granted' })
    const r = await reply('settings:get')
    const forged = { ...r.settings, pendingSecretClears: ['p\u0000azureToken'] } as unknown as AppSettings
    await save(forged, r.generation)
    expect(JSON.parse(readFileSync(settingsFile(), 'utf8'))).not.toHaveProperty('pendingSecretClears')
    await boot()
    expect((await reply('settings:unlock')).settings.profiles[0].azureToken).toBe('az_old')
  })
})

describe('readers outside the settings queue', () => {
  /** Every file in the data folder, by name, with its bytes. */
  const snapshot = (): Record<string, string> =>
    Object.fromEntries(readdirSync(dir).sort().map((f) => [f, readFileSync(join(dir, f), 'utf8')]))

  it('never write: not after a keychain-off clear, not with a stale clear list, not for a plaintext file', async () => {
    // A clear owed to the store, held in this session.
    await fresh({ consent: 'declined' })
    let r = await reply('settings:get')
    await save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_new' })), r.generation)
    r = await reply('settings:get')
    await save(settingsWith(profileWith({ name: 'Mine' })), r.generation)
    let mod = await import('../src/main/settings')
    let before = snapshot()
    await mod.activeProfileAuth('github')
    await mod.allProfileAuth('github')
    await mod.activeProfileAiKey()
    expect(snapshot()).toEqual(before)

    // A stale clear list and a plaintext token in the file, keychain on.
    await fresh({ consent: 'granted' })
    const plain = { ...settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_plain' })), pendingSecretClears: ['p\u0000azureToken'] }
    writeFileSync(settingsFile(), JSON.stringify(plain))
    await boot()
    mod = await import('../src/main/settings')
    before = snapshot()
    expect((await mod.activeProfileAuth('github')).token).toBe('ghp_plain')
    expect((await mod.allProfileAuth('github'))[0].token).toBe('ghp_plain')
    await mod.activeProfileAiKey()
    expect(snapshot()).toEqual(before)
    // The queued unlock is what moves the plaintext token into the store.
    await reply('settings:unlock')
    expect(storeJson().p).toMatchObject({ githubToken: 'ghp_plain' })
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain('ghp_plain')
  })
})

describe('turning the keychain on while a reply is being built', () => {
  it('a get arriving while the move is queued is still current: its clears count', async () => {
    await fresh({ consent: 'declined' })
    const r = await reply('settings:get')
    await save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_new' })), r.generation)
    // Hold the queue on a settings read, so the move queues behind it.
    let release: () => void = () => undefined
    const held = new Promise<void>((res) => (release = res))
    seams.readFile = async (path) => {
      if (path === settingsFile()) await held
      return undefined
    }
    const blocking = raw('settings:get')
    const enabling = raw('keychain:set', true)
    await tick(100)
    const unlocking = reply('settings:unlock')
    seams.readFile = null
    release()
    await Promise.all([blocking, enabling])
    const u = await unlocking
    expect(u.settings.profiles[0].githubToken).toBe('ghp_new')
    // The user clears it in the Settings this reply opened.
    await save(settingsWith(profileWith({ name: 'Mine', azureToken: 'az_old' })), u.generation)
    expect(storeJson().p).toEqual({ azureToken: 'az_old' })
  })
})

describe('moving a damaged settings file aside', () => {
  it('refuses, says so, and leaves the file where it is, when the secrets cannot be copied', async () => {
    await fresh({ consent: 'granted' })
    writeFileSync(settingsFile(), '{"profiles": [')
    expect(await raw('settings:get')).toEqual({ error: 'parse' })
    seams.readFile = async (path) => {
      if (path === storeFile()) throw Object.assign(new Error('EIO: i/o error'), { code: 'EIO' })
      return undefined
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(await raw('settings:moveAside')).toEqual({ refused: 'secrets-copy', dir })
    } finally {
      warn.mockRestore()
    }
    expect(readFileSync(settingsFile(), 'utf8')).toBe('{"profiles": [')
    expect(readdirSync(dir).filter((f) => f.includes('.corrupt-'))).toEqual([])
  })
})

describe('a fresh install with the keychain on', () => {
  it('a token saved and then cleared in the same session is cleared', async () => {
    await fresh({ consent: 'granted', store: null })
    const u = await reply('settings:unlock')
    await save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_a' })), u.generation)
    expect(storeJson().p).toEqual({ githubToken: 'ghp_a' })
    await save(settingsWith(profileWith({ name: 'Mine' })), u.generation)
    expect(storeJson().p ?? {}).toEqual({})
  })

  it('the same when consent is first given by that save', async () => {
    await fresh({ store: null })
    fakeWindow()
    const r = await reply('settings:get')
    const saving = save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_a' })), r.generation)
    await tick()
    await raw('keychain:answer', true)
    await saving
    expect(storeJson().p).toEqual({ githubToken: 'ghp_a' })
    await save(settingsWith(profileWith({ name: 'Mine' })), r.generation)
    expect(storeJson().p ?? {}).toEqual({})
  })
})

describe('reading the settings file', () => {
  it('a half-written file after a long busy spell still gets its parse retries', async () => {
    await fresh({ consent: 'granted' })
    let calls = 0
    seams.readFile = async (path) => {
      if (path !== settingsFile()) return undefined
      calls++
      if (calls <= 5) throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' })
      if (calls === 6) return '{"profiles": ['
      return undefined
    }
    const r = (await raw('settings:get')) as Reply
    expect(r.settings?.profiles[0].name).toBe('Mine')
  })
})
