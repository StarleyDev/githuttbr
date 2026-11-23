import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractSecrets } from '../src/shared/secrets'
import { defaultSettings } from '../src/shared/types'

// A picture is drawn at start-up — the title bar on the Welcome screen — before
// the user has done anything. With tokens in the encrypted store, drawing it
// must never decrypt them: on macOS that is the keychain prompt out of nowhere.
// Real IPC handlers, a real settings file, a fake keyring that counts.
const dir = mkdtempSync(join(tmpdir(), 'gitcito-avatars-keychain-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const keyring = { decrypts: 0, asked: 0 }

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: {},
  // A window to ask in, so a consent question would be noticed rather than answered "no" silently.
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        once: () => undefined,
        webContents: { send: () => keyring.asked++ }
      }
    ]
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => {
      keyring.decrypts++
      return b.toString().replace(/^enc:/, '')
    }
  }
}))

const TOKEN = 'ghp_locked_token'
const BOUND_REPO = '/repos/bound'
const calls: { url: string; auth: string | null }[] = []
const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))

describe('avatars never unlock the keychain', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'granted', explained: true }))
    const base = defaultSettings()
    const profile = { ...base.profiles[0], githubToken: TOKEN }
    const withTokens = { ...base, onboardingCompleted: true, profiles: [profile] }
    writeFileSync(
      join(dir, 'gitcito-secrets.enc'),
      Buffer.from(`enc:${JSON.stringify(extractSecrets(withTokens))}`).toString('base64')
    )
    // The settings file holds no token: it lives only in the encrypted store.
    writeFileSync(
      join(dir, 'gitcito-settings.json'),
      JSON.stringify({ ...withTokens, profiles: [{ ...profile, githubToken: '' }], repoProfiles: { [BOUND_REPO]: profile.id } })
    )
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
    const { readSettings, registerSettingsHandlers } = await import('../src/main/settings')
    await readSettings()
    const { registerAvatarHandlers } = await import('../src/main/avatars')
    registerSettingsHandlers()
    registerAvatarHandlers()
  })
  afterEach(() => {
    calls.length = 0
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    rmSync(dir, { recursive: true, force: true })
  })

  const REMOTE = 'https://github.com/acme/app.git'
  const ITEMS = [{ email: 'dev@corp.test', sha: 'abcdef1' }]

  it('answers "unknown" while locked, without touching the keyring, asking, or calling the API', async () => {
    expect(await call('avatars:profileGithub', 64)).toBeNull()
    // Unknown is an absent key, not a `null` miss the renderer would keep.
    expect(await call('avatars:github', REMOTE, '/repos/unbound', ITEMS, 40)).toEqual({})
    expect(await call('avatars:github', REMOTE, BOUND_REPO, ITEMS, 40)).toEqual({})
    expect(keyring.decrypts).toBe(0)
    expect(keyring.asked).toBe(0)
    expect(calls).toEqual([])
  })

  it('resolves once something the user did unlocked the store, and nothing was cached as a miss meanwhile', async () => {
    await call('settings:unlock')
    expect(keyring.decrypts).toBe(1)
    expect(await call('avatars:profileGithub', 64)).toBe('https://avatars.githubusercontent.com/u/42?v=4&s=64')
    expect(await call('avatars:github', REMOTE, BOUND_REPO, ITEMS, 40)).toEqual({
      'dev@corp.test': 'https://avatars.githubusercontent.com/u/7?v=4&s=40'
    })
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.auth).toBe(`Bearer ${TOKEN}`)
    expect(keyring.decrypts).toBe(1)
  })
})
