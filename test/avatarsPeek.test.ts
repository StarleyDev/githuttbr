import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { secretSlot, secretSlots, type SecretStore } from '../src/shared/secrets'
import { defaultSettings, type AppSettings } from '../src/shared/types'

// What an avatar may use while the encrypted store is still locked. It never
// decrypts — but "locked" must not swallow credentials that are not in the
// store at all: a machine-login link, or a token typed this session while the
// keychain could not be used. Real IPC handlers and settings files, a fake
// keyring that counts, and a stand-in for the machine login itself.
let dir = ''
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { decrypts: 0, asked: 0, available: true }
const machineLogins: { url: string; login?: string }[] = []
const sent: string[] = []

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        once: () => undefined,
        webContents: { send: (channel: string) => sent.push(channel) && channel === 'keychain:ask' && keyring.asked++ }
      }
    ]
  },
  safeStorage: {
    isEncryptionAvailable: () => keyring.available,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => {
      keyring.decrypts++
      return b.toString().replace(/^enc:/, '')
    }
  }
}))

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
const calls: { url: string; auth: string | null }[] = []
const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))

function setUp(o: { secrets: SecretStore; index: boolean; profile?: Partial<AppSettings['profiles'][number]> }): AppSettings {
  dir = mkdtempSync(join(tmpdir(), 'gitcito-avatars-peek-'))
  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
  const base = defaultSettings()
  const profile = { ...base.profiles[0], ...o.profile }
  const settings = { ...base, onboardingCompleted: true, profiles: [profile] }
  const store = Object.fromEntries(Object.entries(o.secrets).map(([, v]) => [profile.id, v]))
  writeFileSync(join(dir, 'gitcito-secrets.enc'), Buffer.from(`enc:${JSON.stringify(store)}`).toString('base64'))
  if (o.index) writeFileSync(join(dir, 'gitcito-secrets.index.json'), JSON.stringify(secretSlots(store)))
  writeFileSync(join(dir, 'gitcito-settings.json'), JSON.stringify(settings))
  return settings
}

async function boot(): Promise<void> {
  vi.resetModules()
  handlers.clear()
  const { readSettings, registerSettingsHandlers } = await import('../src/main/settings')
  await readSettings()
  const { registerAvatarHandlers } = await import('../src/main/avatars')
  registerSettingsHandlers()
  registerAvatarHandlers()
}

const dirs: string[] = []
beforeEach(() => {
  if (dir) dirs.push(dir)
  keyring.decrypts = 0
  keyring.asked = 0
  keyring.available = true
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

const LINK = { source: 'git' as const, login: 'octo' }

describe('avatar peeks with the store still locked', () => {
  it('uses a machine-login link when the store holds no GitHub PAT for the profile — only, say, an AI key', async () => {
    setUp({ secrets: { p: { aiKeys: { acct: 'sk-ai-key' } } }, index: true, profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({
      'dev@corp.test': 'https://avatars.githubusercontent.com/u/7?v=4&s=40'
    })
    expect(await call('avatars:profileGithub', 64)).toBe('https://avatars.githubusercontent.com/u/42?v=4&s=64')
    expect(machineLogins.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.auth).toBe('Bearer helper-token')
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
  })

  it('stays "unknown" when the store does hold a GitHub PAT: the link must not stand in for it', async () => {
    setUp({ secrets: { p: { githubToken: 'ghp_stored' } }, index: true, profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    expect(await call('avatars:profileGithub', 64)).toBeNull()
    expect(calls).toEqual([])
    expect(machineLogins).toEqual([])
    expect(keyring.decrypts).toBe(0)
  })

  it('stays "unknown" for a store written before the index existed, and writes the index on unlock', async () => {
    setUp({ secrets: { p: { aiKeys: { acct: 'sk-ai-key' } } }, index: false, profile: { links: { github: LINK } } })
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    expect(keyring.decrypts).toBe(0)
    expect(sent).not.toContain('secrets:unlocked')
    await call('settings:unlock')
    // The window hears of it, so pictures left "unknown" ask again now.
    expect(sent.filter((c) => c === 'secrets:unlocked')).toHaveLength(1)
    await call('settings:unlock')
    expect(sent.filter((c) => c === 'secrets:unlocked')).toHaveLength(1)
    // The next launch can peek: boot again over the same folder, still locked.
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({
      'dev@corp.test': 'https://avatars.githubusercontent.com/u/7?v=4&s=40'
    })
    expect(keyring.decrypts).toBe(1)
  })

  it('uses session-only tokens once an unlock found the keyring unavailable, without asking again', async () => {
    const settings = setUp({ secrets: { p: { githubToken: 'ghp_unreachable' } }, index: true })
    keyring.available = false
    await boot()
    // Something the user did tried to unlock; the keyring is not there this session.
    await call('settings:unlock')
    // A token typed now lives in memory only.
    await call('settings:set', { ...settings, profiles: [{ ...settings.profiles[0], githubToken: 'ghp_session' }] })
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({
      'dev@corp.test': 'https://avatars.githubusercontent.com/u/7?v=4&s=40'
    })
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.auth).toBe('Bearer ghp_session')
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
    expect(sent).not.toContain('secrets:unlocked')
  })

  it('falls back to the machine login once an unlock found the keyring unavailable', async () => {
    setUp({ secrets: { p: { githubToken: 'ghp_unreachable' } }, index: true, profile: { links: { github: LINK } } })
    keyring.available = false
    await boot()
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({})
    await call('settings:unlock')
    expect(await call('avatars:github', REMOTE, '/repos/any', ITEMS, 40)).toEqual({
      'dev@corp.test': 'https://avatars.githubusercontent.com/u/7?v=4&s=40'
    })
    for (const c of calls) expect(c.auth).toBe('Bearer helper-token')
    expect(keyring.decrypts).toBe(0)
  })
})

describe('stored-slot index', () => {
  it('names each stored host token by field or server, never its value, and matches the lookup slot', () => {
    const slots = secretSlots({
      p: {
        githubToken: 'ghp_x',
        aiKeys: { a: 'sk' },
        githubEnterpriseTokens: { 'https://ghe.corp': 't' },
        gitlabServerTokens: { 'https://gl.corp': 't' }
      },
      q: { aiApiKey: 'sk' }
    })
    expect(slots).toEqual({ p: ['githubToken', 'githubEnterprise:https://ghe.corp', 'gitlabServer:https://gl.corp'], q: [] })
    expect(JSON.stringify(slots)).not.toMatch(/ghp_x|sk/)
    expect(secretSlot('githubToken', 'https://github.com')).toBe('githubToken')
    expect(secretSlot('githubToken', 'https://ghe.corp')).toBe('githubEnterprise:https://ghe.corp')
    expect(secretSlot('gitlabToken', 'https://gitlab.com')).toBe('gitlabToken')
    expect(secretSlot('gitlabToken', 'https://gl.corp')).toBe('gitlabServer:https://gl.corp')
    expect(secretSlot('forgejoToken')).toBe('forgejoToken')
  })
})
