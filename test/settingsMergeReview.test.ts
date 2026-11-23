import { describe, it, expect, vi, afterAll, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultSettings, type AppSettings, type Profile, type SettingsReplyWire } from '../src/shared/types'
import type { SecretStore } from '../src/shared/secrets'

// The review of the v4.37.2 → 4.38 forward-merge: a failed or overtaken
// settings reply that left a renderer's clears ignored, a consent question put
// to a page that could not show it, background readers meeting a plaintext
// settings file, and a symlinked settings file moved aside. Real main-process
// handlers, the real renderer store wired to them, a fake keyring.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-settings-merge-'))

const seams = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  /** Returns text to answer a read with, throws to fail it, or undefined for the real file. */
  readFile: null as null | ((path: string) => Promise<string | undefined>),
  windows: [] as unknown[],
  /** The renderer page the store's calls come from. */
  page: { id: 1, on: () => undefined, once: () => undefined } as unknown
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
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => seams.handlers.set(channel, fn),
    on: () => undefined
  },
  dialog: {},
  shell: {},
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => seams.windows },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString().replace(/^enc:/, '')
  }
}))

// The renderer store talks to the real handlers above, as preload + api.ts would.
vi.mock('../src/renderer/src/infrastructure/api', () => {
  class SettingsLoadError extends Error {
    constructor(readonly kind: string) {
      super(`settings could not be loaded (${kind})`)
    }
  }
  class SettingsSaveRefused extends Error {
    constructor(readonly reason: string) {
      super(`settings save refused (${reason})`)
    }
  }
  const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
    Promise.resolve(seams.handlers.get(channel)!({ sender: seams.page }, ...args))
  const reply = async (channel: string): Promise<unknown> => {
    const out = (await invoke(channel)) as SettingsReplyWire
    if ('error' in out) throw new SettingsLoadError(out.error)
    return out
  }
  return {
    settingsApi: {
      get: () => reply('settings:get'),
      unlock: () => reply('settings:unlock'),
      set: async (s: unknown, generation: number, options?: unknown) => {
        const out = (await invoke('settings:set', s, generation, options)) as { refused?: string } | undefined
        if (out?.refused) throw new SettingsSaveRefused(out.refused)
      }
    },
    reposApi: {},
    gitApi: {},
    SettingsLoadError,
    SettingsSaveRefused
  }
})

import { useSettingsStore } from '../src/renderer/src/stores/settings'

afterAll(() => rmSync(dir, { recursive: true, force: true }))
afterEach(() => {
  seams.readFile = null
  seams.windows = []
  seams.page = { id: 1, on: () => undefined, once: () => undefined }
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
  Promise.resolve(seams.handlers.get(channel)!({ sender: seams.page }, ...args))
const save = (settings: AppSettings, generation: number): Promise<unknown> => raw('settings:set', settings, generation)

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultSettings().profiles[0], id: 'p', ...over })
const settingsWith = (profile: Profile): AppSettings => ({
  ...defaultSettings(),
  onboardingCompleted: true,
  profiles: [profile]
})

const within = <T,>(p: Promise<T>, ms = 3000): Promise<T | 'timeout'> =>
  Promise.race([p, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))])
const tick = (ms = 50): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** A new main process over whatever files are in `dir` now, and a renderer that has loaded nothing. */
async function boot(): Promise<void> {
  vi.resetModules()
  seams.handlers.clear()
  const settings = await import('../src/main/settings')
  const keychain = await import('../src/main/keychain')
  settings.registerSettingsHandlers()
  keychain.registerKeychainHandlers()
  useSettingsStore.setState({ loaded: false, secretsGeneration: 0, unlocked: false })
}

async function fresh(opts: { consent?: 'granted' | 'declined'; store?: SecretStore | null; profile?: Partial<Profile> } = {}): Promise<void> {
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true, recursive: true })
  if (opts.consent) writeFileSync(consentFile(), JSON.stringify({ consent: opts.consent, explained: true }))
  const store = opts.store === undefined ? { p: { githubToken: 'ghp_old', azureToken: 'az_old' } } : opts.store
  if (store) writeStore(store)
  writeFileSync(settingsFile(), JSON.stringify(settingsWith(profileWith({ name: 'Mine', ...opts.profile }))))
  await boot()
}

/** The store's own profile with the GitHub token removed — what clearing the field in Settings sends. */
async function clearGithubTokenInStore(): Promise<void> {
  const store = useSettingsStore.getState()
  store.update((s) => ({ ...s, profiles: s.profiles.map((p) => ({ ...p, githubToken: undefined })) }))
  await store.flush()
}

const silenced = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  try {
    return await fn()
  } finally {
    warn.mockRestore()
  }
}

describe('a settings reply that failed or was overtaken', () => {
  it('a failed unlock leaves the renderer able to clear what the last one showed it', async () => {
    await fresh({ consent: 'granted' })
    await useSettingsStore.getState().load({ unlock: true })
    expect(useSettingsStore.getState().settings.profiles[0].githubToken).toBe('ghp_old')
    // Opening Settings again while the file cannot be read: the reply is an error.
    seams.readFile = async (path) => {
      if (path === settingsFile()) throw Object.assign(new Error('EIO: i/o error'), { code: 'EIO' })
      return undefined
    }
    await silenced(() => expect(useSettingsStore.getState().load({ unlock: true })).rejects.toMatchObject({ kind: 'io' }))
    seams.readFile = null
    // The state on screen is the earlier reply's; the user clears the token in it.
    await clearGithubTokenInStore()
    expect(storeJson().p).toEqual({ azureToken: 'az_old' })
  })

  it('two overlapping loads: the renderer keeps the newer reply, and a clear afterwards counts', async () => {
    // A token typed this session (keychain off), so both a get and an unlock carry it.
    await fresh({ consent: 'declined' })
    await useSettingsStore.getState().load()
    useSettingsStore.getState().update((s) => ({
      ...s,
      profiles: s.profiles.map((p) => ({ ...p, githubToken: 'ghp_typed' }))
    }))
    await useSettingsStore.getState().flush()
    // The unlock arrives first but its first read is slow; the get arriving
    // after it is answered first, with the newer generation.
    let first = true
    seams.readFile = async (path) => {
      if (path === settingsFile() && first) {
        first = false
        await tick(200)
      }
      return undefined
    }
    const unlocking = useSettingsStore.getState().load({ unlock: true })
    const getting = useSettingsStore.getState().load()
    await Promise.all([unlocking, getting])
    seams.readFile = null
    expect(useSettingsStore.getState().settings.profiles[0].githubToken).toBe('ghp_typed')
    await clearGithubTokenInStore()
    const after = (await raw('settings:get')) as Reply
    expect(after.settings.profiles[0].githubToken).toBeFalsy()
  })

  /**
   * Request `a` is answered after request `b` has arrived, and `b` then fails:
   * the renderer holds `a`'s reply, at the generation `b`'s arrival stamped
   * onto the view it held before `a`. `a` reads the settings file `aReads`
   * times, `b` arrives while its read number `at` is held up, and every read
   * after `a`'s fails.
   */
  async function servedThenNewerFails(
    a: 'settings:get' | 'settings:unlock',
    b: 'settings:get' | 'settings:unlock',
    aReads: number,
    at: number
  ): Promise<Reply> {
    let reads = 0
    seams.readFile = async (path) => {
      if (path !== settingsFile()) return undefined
      const n = ++reads
      if (n === at) await tick(50)
      if (n <= aReads) return undefined
      await tick(200)
      throw Object.assign(new Error('EIO: i/o error'), { code: 'EIO' })
    }
    const first = raw(a) as Promise<Reply>
    await vi.waitFor(() => expect(reads).toBe(at))
    const second = raw(b) as Promise<SettingsReplyWire>
    const r = await first
    await silenced(async () => expect(await second).toEqual({ error: 'io' }))
    seams.readFile = null
    return r
  }

  it('a plain get served, then a newer load failing: blanks from that reply clear nothing', async () => {
    await fresh({ consent: 'granted' })
    // Settings opened earlier: the renderer was shown the stored tokens.
    await raw('settings:unlock')
    const r = await servedThenNewerFails('settings:get', 'settings:unlock', 1, 1)
    expect(r.settings.profiles[0].githubToken).toBeFalsy()
    // The plain reply's blanks are not clears: it never showed those tokens.
    await save({ ...r.settings, language: 'de' }, r.generation)
    expect(storeJson().p).toEqual({ githubToken: 'ghp_old', azureToken: 'az_old' })
  })

  it('an unlock served, then a newer load failing: a clear from that reply still counts', async () => {
    await fresh({ consent: 'granted' })
    await raw('settings:get')
    // One read before the queue, two inside it: the get, arriving once it is inside, queues behind it.
    const r = await servedThenNewerFails('settings:unlock', 'settings:get', 3, 2)
    expect(r.settings.profiles[0].githubToken).toBe('ghp_old')
    const cleared = { ...r.settings, profiles: r.settings.profiles.map((p) => ({ ...p, githubToken: undefined })) }
    await save(cleared, r.generation)
    expect(storeJson().p).toEqual({ azureToken: 'az_old' })
  })
})

/** A window whose page can be loading, reloading, or past its boot spinner. */
function fakeWindow(): { contents: EventEmitter & { id: number; send: ReturnType<typeof vi.fn>; loading: boolean } } {
  const contents = Object.assign(new EventEmitter(), {
    id: 1,
    send: vi.fn(),
    loading: false,
    isLoadingMainFrame: () => contents.loading
  })
  const win = Object.assign(new EventEmitter(), { webContents: contents, isDestroyed: () => false })
  seams.windows = [win]
  seams.page = contents
  return { contents }
}

describe('a consent question the page could not show', () => {
  it('a save reaching the question after the page started reloading settles at once; the new page loads', async () => {
    await fresh({ store: null })
    const { contents } = fakeWindow()
    const r = (await raw('settings:get')) as Reply
    // The reload starts before the save queued by the old page asks.
    contents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false })
    contents.loading = true
    const saving = save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_new' })), r.generation)
    expect(await within(saving)).toBeUndefined()
    expect(contents.send).not.toHaveBeenCalledWith('keychain:ask', expect.anything())
    const next = await within(raw('settings:get'))
    expect(next).not.toBe('timeout')
    expect((next as Reply).settings.profiles[0].name).toBe('Mine')
    // Nobody answered: not recorded, asked again once a page can show it.
    expect(existsSync(consentFile())).toBe(false)
  })

  it('a page whose settings have not loaded since it navigated is not asked', async () => {
    await fresh({ store: null })
    const { contents } = fakeWindow()
    const r = (await raw('settings:get')) as Reply
    // Navigated (loading finished), but its own settings:get has not been answered yet.
    contents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false })
    const saving = save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_new' })), r.generation)
    expect(await within(saving)).toBeUndefined()
    expect(contents.send).not.toHaveBeenCalledWith('keychain:ask', expect.anything())
    // Once it has, the next token save asks it.
    const r2 = (await raw('settings:get')) as Reply
    const asking = save(settingsWith(profileWith({ name: 'Mine', githubToken: 'ghp_b' })), r2.generation)
    await tick()
    expect(contents.send).toHaveBeenCalledWith('keychain:ask', expect.anything())
    await raw('keychain:answer', true)
    expect(await within(asking)).toBeUndefined()
    expect(storeJson().p).toEqual({ githubToken: 'ghp_b' })
  })
})

describe('a background reader meeting plaintext tokens beside an encrypted store', () => {
  const snapshot = (): Record<string, string> =>
    Object.fromEntries(readdirSync(dir).sort().map((f) => [f, readFileSync(join(dir, f), 'utf8')]))

  it('answers from the plaintext view for that call only: installs nothing, writes nothing', async () => {
    await fresh({ consent: 'granted', store: { p: { azureToken: 'az_old' } }, profile: { githubToken: 'ghp_plain' } })
    const { contents } = fakeWindow()
    const mod = await import('../src/main/settings')
    const before = snapshot()
    expect((await mod.activeProfileAuth('github')).token).toBe('ghp_plain')
    expect((await mod.activeProfileAuth('azure')).token).toBe('az_old')
    // Nothing installed: no unlock announced, and a peek at a stored-only token
    // still reads "locked" until Settings is opened (the documented cost on
    // such installs). The plaintext one is in the plain view a peek reads.
    expect(contents.send).not.toHaveBeenCalledWith('secrets:unlocked')
    expect((await mod.peekActiveProfileAuth('azure')).locked).toBe(true)
    expect((await mod.peekActiveProfileAuth('github')).token).toBe('ghp_plain')
    expect(snapshot()).toEqual(before)
  })

  it('a token cleared before the queued unlock does not come back', async () => {
    await fresh({ consent: 'granted', store: { p: { azureToken: 'az_old' } }, profile: { githubToken: 'ghp_plain' } })
    const mod = await import('../src/main/settings')
    expect((await mod.activeProfileAuth('github')).token).toBe('ghp_plain')
    await useSettingsStore.getState().load()
    expect(useSettingsStore.getState().settings.profiles[0].githubToken).toBe('ghp_plain')
    await clearGithubTokenInStore()
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain('ghp_plain')
    await useSettingsStore.getState().load({ unlock: true })
    expect(useSettingsStore.getState().settings.profiles[0].githubToken).toBeFalsy()
    expect(storeJson().p).toEqual({ azureToken: 'az_old' })
    expect((await mod.activeProfileAuth('github')).token).toBeFalsy()
  })

  it('the queued unlock still moves the plaintext tokens into the store', async () => {
    await fresh({ consent: 'granted', store: { p: { azureToken: 'az_old' } }, profile: { githubToken: 'ghp_plain' } })
    const mod = await import('../src/main/settings')
    await mod.activeProfileAuth('github')
    await useSettingsStore.getState().load({ unlock: true })
    expect(readFileSync(settingsFile(), 'utf8')).not.toContain('ghp_plain')
    expect(storeJson().p).toEqual({ azureToken: 'az_old', githubToken: 'ghp_plain' })
  })
})

describe('moving a symlinked damaged settings file aside', () => {
  it('moves the target and says where; the first save replaces the dangling link', async () => {
    await fresh({ consent: 'granted' })
    const dotfiles = mkdtempSync(join(tmpdir(), 'gitcito-dotfiles-'))
    try {
      const real = join(realpathSync(dotfiles), 'gitcito.json')
      writeFileSync(real, '{"profiles": [')
      rmSync(settingsFile())
      symlinkSync(real, settingsFile())
      await silenced(async () => expect(await raw('settings:get')).toEqual({ error: 'parse' }))
      const moved = (await raw('settings:moveAside')) as string
      // Beside the target, not the link: the full path is what the boot screen shows.
      expect(moved.startsWith(`${real}.corrupt-`)).toBe(true)
      expect(readFileSync(moved, 'utf8')).toBe('{"profiles": [')
      expect(existsSync(real)).toBe(false)
      // Fresh start: defaults, and the first save lands as a regular file in
      // the data folder — a dangling link is not followed.
      const r = (await raw('settings:get')) as Reply
      await save({ ...r.settings, language: 'de' }, r.generation)
      expect(lstatSync(settingsFile()).isSymbolicLink()).toBe(false)
      expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).language).toBe('de')
      expect(existsSync(real)).toBe(false)
    } finally {
      rmSync(dotfiles, { recursive: true, force: true })
    }
  })
})
