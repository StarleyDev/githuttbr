import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProfileSecrets } from '../src/shared/secrets'
import { defaultSettings, type AppSettings, type KeychainConsent } from '../src/shared/types'

// What an avatar may use before the encrypted store is unlocked. It never
// decrypts, and the rule has no index to go stale: with a store that may hold a
// PAT the answer is "unknown" (a PAT outranks a machine login, so the link must
// not stand in for it); with no store to wait for this session — none on disk,
// consent declined, or no usable keyring — the plain settings are the truth.
// Real IPC handlers and settings files, a fake keyring that counts, and a
// stand-in for the machine login itself.
let dir = ''
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { decrypts: 0, asked: 0, available: true, probes: 0 }
/** No window to ask in: the consent question then settles nothing. */
const windows = { none: false }
const machineLogins: { url: string; login?: string }[] = []
const sent: string[] = []

// The electron each boot sees, its userData fixed to that test's directory. Not a
// live read of `dir`: the avatar cache coalesces its writes on a 500 ms timer, and
// one still pending from the previous test's modules would otherwise resolve
// userData *now* and seed this test's fresh directory with that test's pictures.
const electronFor = (userData: string): Record<string, unknown> => ({
  app: { getPath: () => userData, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => windows.none ? [] : [
      {
        isDestroyed: () => false,
        once: () => undefined,
        webContents: { send: (channel: string) => sent.push(channel) && channel === 'keychain:ask' && keyring.asked++ }
      }
    ]
  },
  safeStorage: {
    isEncryptionAvailable: () => {
      keyring.probes++
      return keyring.available
    },
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => {
      keyring.decrypts++
      return b.toString().replace(/^enc:/, '')
    }
  }
})

// The machine login (git's credential helper / gh) is outside the app: answer for it here.
vi.mock('../src/main/credentials', () => ({
  apiToken: async (url: string, auth: { token?: string; link?: { login: string } }) => {
    if (auth.token) return { token: auth.token, source: 'token' }
    if (!auth.link) return null
    machineLogins.push({ url, login: auth.link.login })
    return { token: 'helper-token', source: 'git', login: auth.link.login }
  }
}))

const REMOTE = 'https://github.com/acme/app.git'
const ITEMS = [{ email: 'dev@corp.test', sha: 'abcdef1' }]
const FOUND = { 'dev@corp.test': 'https://avatars.githubusercontent.com/u/7?v=4&s=40' }
const PROFILE_PIC = 'https://avatars.githubusercontent.com/u/42?v=4&s=64'
const LINK = { source: 'git' as const, login: 'octo' }
const calls: { url: string; auth: string | null }[] = []
const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))

interface Setup {
  /** The encrypted store's content for the profile; omitted means no `gitcito-secrets.enc` at all. */
  secrets?: ProfileSecrets
  consent?: KeychainConsent
  /** Whether the user has seen the explainer; false is an install that predates it. */
  explained?: boolean
  profile?: Partial<AppSettings['profiles'][number]>
}

function setUp(o: Setup): AppSettings {
  dir = mkdtempSync(join(tmpdir(), 'gitcito-avatars-peek-'))
  if (o.consent !== 'unset') {
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: o.consent ?? 'granted', explained: o.explained ?? true }))
  }
  const base = defaultSettings()
  const profile = { ...base.profiles[0], ...o.profile }
  const settings = { ...base, onboardingCompleted: true, profiles: [profile] }
  if (o.secrets) {
    const store = { [profile.id]: o.secrets }
    writeFileSync(join(dir, 'gitcito-secrets.enc'), Buffer.from(`enc:${JSON.stringify(store)}`).toString('base64'))
  }
  writeFileSync(join(dir, 'gitcito-settings.json'), JSON.stringify(settings))
  return settings
}

async function boot(): Promise<void> {
  vi.resetModules()
  // vi.mock's factory result survives resetModules, so the binding is redone per boot.
  const userData = dir
  vi.doMock('electron', () => electronFor(userData))
  handlers.clear()
  const { readSettings, registerSettingsHandlers } = await import('../src/main/settings')
  await readSettings()
  const { registerAvatarHandlers } = await import('../src/main/avatars')
  const { registerKeychainHandlers } = await import('../src/main/keychain')
  registerSettingsHandlers()
  registerAvatarHandlers()
  registerKeychainHandlers()
}

const dirs: string[] = []
beforeEach(() => {
  if (dir) dirs.push(dir)
  keyring.decrypts = 0
  keyring.asked = 0
  keyring.probes = 0
  keyring.available = true
  windows.none = false
  calls.length = 0
  machineLogins.length = 0
  sent.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, auth: ((init?.headers ?? {}) as Record<string, string>).Authorization ?? null })
      const body = url.endsWith('/user')
        ? { avatar_url: 'https://avatars.githubusercontent.com/u/42?v=4' }
        : { sha: 'abcdef1', author: { login: 'dev', avatar_url: 'https://avatars.githubusercontent.com/u/7?v=4' } }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
  )
})
afterAll(() => {
  vi.unstubAllGlobals()
  for (const d of [...dirs, dir]) rmSync(d, { recursive: true, force: true })
})

describe('avatar peeks before the store is unlocked', () => {
  it('answers "unknown" with a locked store, even with a machine login: no decrypt, no prompt, no fetch', async () => {
    // The store holds only an AI key — but a peek cannot see that without decrypting.
    setUp({ secrets: { aiKeys: { acct: 'sk-ai-key' } }, profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    expect(await call('avatars:profileGithub', 'default', 64)).toBeNull()
    expect(calls).toEqual([])
    expect(machineLogins).toEqual([])
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
    // Not even "is there a keyring": on macOS the first safeStorage call is the prompt.
    expect(keyring.probes).toBe(0)
    expect(sent).not.toContain('secrets:unlocked')
  })

  it('treats consent granted but never explained as locked, without touching safeStorage', async () => {
    setUp({ secrets: { aiKeys: { acct: 'sk' } }, explained: false, profile: { links: { github: LINK } } })
    keyring.available = false
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    expect(keyring.probes).toBe(0)
    // An unlock with no window to ask in settles nothing: still locked, still no probe.
    windows.none = true
    await call('settings:unlock')
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    expect(keyring.probes).toBe(0)
    expect(sent).not.toContain('secrets:unlocked')
    expect(calls).toEqual([])
  })

  it('uses the plain view once an unlock found no keyring, and tells the windows', async () => {
    setUp({ secrets: { githubToken: 'ghp_unreachable' }, profile: { links: { github: LINK } } })
    keyring.available = false
    await boot()
    // A peek never asks safeStorage, so before any unlock it cannot know the keyring is missing.
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    expect(keyring.probes).toBe(0)
    await call('settings:unlock')
    // The pictures that fell past GitHub hear that the view changed.
    expect(sent.filter((c) => c === 'secrets:unlocked')).toHaveLength(1)
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual(FOUND)
    expect(await call('avatars:profileGithub', 'default', 64)).toBe(PROFILE_PIC)
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.auth).toBe('Bearer helper-token')
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
  })

  it('uses a session-only token when no keyring is available', async () => {
    const settings = setUp({ secrets: { githubToken: 'ghp_unreachable' } })
    keyring.available = false
    await boot()
    // A token typed now lives in memory only.
    await call('settings:set', { ...settings, profiles: [{ ...settings.profiles[0], githubToken: 'ghp_session' }] })
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual(FOUND)
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.auth).toBe('Bearer ghp_session')
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
  })

  it('uses the plain view when the keychain was declined', async () => {
    setUp({ secrets: { githubToken: 'ghp_never_read' }, consent: 'declined', profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual(FOUND)
    for (const c of calls) expect(c.auth).toBe('Bearer helper-token')
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
    // Declined never touches safeStorage, not even to ask whether it is there.
    expect(keyring.probes).toBe(0)
  })

  it('tells the windows when the consent dialog is declined, then uses the plain view', async () => {
    // An install from before the gate: consent is adopted unexplained, so the unlock asks first.
    setUp({ secrets: { githubToken: 'ghp_never_read' }, consent: 'unset', profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    const unlocking = call('settings:unlock')
    await vi.waitFor(() => expect(sent).toContain('keychain:ask'))
    expect(sent).not.toContain('secrets:unlocked')
    await call('keychain:answer', false)
    await unlocking
    expect(sent).toContain('secrets:unlocked')
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual(FOUND)
    for (const c of calls) expect(c.auth).toBe('Bearer helper-token')
    expect(keyring.decrypts).toBe(0)
  })

  it('tells the windows when Settings → Security turns the keychain off', async () => {
    setUp({ secrets: { githubToken: 'ghp_never_read' }, profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    await call('keychain:set', false)
    expect(sent).toContain('secrets:unlocked')
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual(FOUND)
  })

  it('uses the machine login when there is no encrypted store at all', async () => {
    setUp({ consent: 'unset', profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual(FOUND)
    expect(await call('avatars:profileGithub', 'default', 64)).toBe(PROFILE_PIC)
    for (const c of calls) expect(c.auth).toBe('Bearer helper-token')
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
    expect(keyring.probes).toBe(0)
  })

  it('once unlocked, a stored PAT outranks the machine login, and the windows hear of the unlock once', async () => {
    setUp({ secrets: { githubToken: 'ghp_stored' }, profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    await call('settings:unlock')
    await call('settings:unlock')
    expect(sent.filter((c) => c === 'secrets:unlocked')).toHaveLength(1)
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual(FOUND)
    expect(await call('avatars:profileGithub', 'default', 64)).toBe(PROFILE_PIC)
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.auth).toBe('Bearer ghp_stored')
    expect(machineLogins).toEqual([])
    expect(keyring.decrypts).toBe(1)
  })

  it('does not consult an Enterprise Server for the title-bar picture while github.com is locked', async () => {
    // A GHES token still in the clear in the settings file (not migrated yet): usable on its own,
    // but github.com comes first and its answer is unknown — so the title bar must not show GHES's account.
    setUp({
      secrets: { aiKeys: { acct: 'sk-ai-key' } },
      profile: { links: { github: LINK }, githubEnterprise: [{ url: 'https://ghe.corp.test', token: 'ghes_plain' }] }
    })
    await boot()
    expect(await call('avatars:profileGithub', 'default', 64)).toBeNull()
    expect(calls).toEqual([])
    expect(machineLogins).toEqual([])
    expect(keyring.decrypts).toBe(0)
  })
})

describe('the title-bar picture after a profile switch', () => {
  it('answers for the profile the renderer names, not the one still active on disk', async () => {
    // The renderer switched A → B; the 250 ms settings debounce has not written it yet,
    // so the file still says A. B's picture (or nothing) — never A's.
    dir = mkdtempSync(join(tmpdir(), 'gitcito-avatars-switch-'))
    const base = defaultSettings()
    // Session-only tokens (no keyring store on disk), so each account has its own.
    const a = { ...base.profiles[0], id: 'pa', name: 'A', githubToken: 'ghp_alice' }
    const b = { ...base.profiles[0], id: 'pb', name: 'B', githubToken: 'ghp_bob' }
    const c = { ...base.profiles[0], id: 'pc', name: 'C' }
    writeFileSync(
      join(dir, 'gitcito-settings.json'),
      JSON.stringify({ ...base, onboardingCompleted: true, profiles: [a, b, c], activeProfileId: 'pa' })
    )
    await boot()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const auth = ((init?.headers ?? {}) as Record<string, string>).Authorization ?? null
        calls.push({ url: String(input), auth })
        const login = auth?.replace('Bearer ghp_', '')
        return new Response(JSON.stringify({ avatar_url: `https://avatars.githubusercontent.com/u/${login}?v=4` }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )
    expect(await call('avatars:profileGithub', 'pa', 64)).toBe('https://avatars.githubusercontent.com/u/alice?v=4&s=64')
    expect(await call('avatars:profileGithub', 'pb', 64)).toBe('https://avatars.githubusercontent.com/u/bob?v=4&s=64')
    // A profile with no GitHub account gets nothing, never the active profile's picture.
    expect(await call('avatars:profileGithub', 'pc', 64)).toBeNull()
    // An empty, unknown or malformed id names nobody.
    expect(await call('avatars:profileGithub', '', 64)).toBeNull()
    expect(await call('avatars:profileGithub', 'nobody', 64)).toBeNull()
    expect(await call('avatars:profileGithub', 64)).toBeNull()
    expect(calls.map((c) => c.auth)).toEqual(['Bearer ghp_alice', 'Bearer ghp_bob'])
    expect(keyring.decrypts).toBe(0)
    expect(keyring.probes).toBe(0)
  })
})

describe('the old secrets index', () => {
  it('is deleted on startup — it named servers, including removed ones — and never written again', async () => {
    setUp({ secrets: { githubToken: 'ghp_stored' } })
    const index = join(dir, 'gitcito-secrets.index.json')
    writeFileSync(index, JSON.stringify({ p: ['githubToken', 'githubEnterprise:https://old-ghe.corp.test'] }))
    await boot()
    await vi.waitFor(() => expect(existsSync(index)).toBe(false))
    await call('settings:unlock')
    expect(existsSync(index)).toBe(false)
  })
})
