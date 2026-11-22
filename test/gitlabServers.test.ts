import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  GITLAB_COM,
  gitlabAuthFor,
  gitlabServerBases,
  gitlabServerUrlProblem,
  gitlabTokenUrl,
  migrateGitlabProfile,
  normalizeGitlabServerUrl,
  preferredGitlabBase
} from '../src/shared/gitlabInstance'
import {
  applySecrets,
  extractSecrets,
  hasSettingsSecrets,
  mergeSecretStores,
  migrateGitlabSecrets,
  stripSettingsSecrets
} from '../src/shared/secrets'
import { defaultProfile, defaultSettings, type Profile } from '../src/shared/types'
import { PRODUCT_NAME } from '../src/shared/brand'

// Self-managed GitLab as a list of servers per profile, each with its own
// token — gitlab.com keeps the profile's `gitlabToken`. The call-site tests run
// the real IPC handlers against a fake fetch and a real settings file; the
// migration from the one-instance shape (and its encrypted store) is in
// gitlabMigration.test.ts.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-glsrv-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: { openExternal: () => undefined },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error('stubbed')
    },
    decryptString: () => {
      throw new Error('stubbed')
    }
  }
}))

const A = 'https://gitlab.example.corp'
const B = 'https://git.example.org/gitlab' // served under a relative URL root
const D = 'https://code.example.net' // another profile's server
const COM_TOKEN = 'glpat-com'
const A_TOKEN = 'glpat-server-a'
const B_TOKEN = 'glpat-server-b'
const D_TOKEN = 'glpat-server-d'
const RENDERER_TOKEN = 'glpat-what-the-renderer-sent'
const ALL_TOKENS = [COM_TOKEN, A_TOKEN, B_TOKEN, D_TOKEN, RENDERER_TOKEN]

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultProfile(), ...over })

describe('server addresses', () => {
  it('accepts a bare host, a port and a relative URL root, canonicalised', () => {
    expect(normalizeGitlabServerUrl('GitLab.Example.Corp/')).toBe(A)
    expect(normalizeGitlabServerUrl('https://git.example.org/gitlab/')).toBe(B)
    expect(normalizeGitlabServerUrl('git.example.org:8443')).toBe('https://git.example.org:8443')
    expect(normalizeGitlabServerUrl('10.0.0.5')).toBe('https://10.0.0.5')
  })

  it('refuses http, credentials, a query and gitlab.com — each for its own reason', () => {
    expect(gitlabServerUrlProblem('http://gitlab.example.corp')).toBe('http')
    expect(gitlabServerUrlProblem('ftp://gitlab.example.corp')).toBe('invalid')
    expect(gitlabServerUrlProblem('https://me:secret@gitlab.example.corp')).toBe('credentials')
    expect(gitlabServerUrlProblem('me@gitlab.example.corp')).toBe('credentials')
    expect(gitlabServerUrlProblem('https://gitlab.example.corp/?x=1')).toBe('query')
    expect(gitlabServerUrlProblem('https://gitlab.example.corp/#top')).toBe('query')
    expect(gitlabServerUrlProblem('gitlab.com')).toBe('gitlabCom')
    expect(gitlabServerUrlProblem('https://www.gitlab.com')).toBe('gitlabCom')
    expect(gitlabServerUrlProblem('')).toBe('invalid')
    expect(normalizeGitlabServerUrl('http://gitlab.example.corp')).toBeNull()
  })

  it('links to the token page of the server itself, under its path', () => {
    expect(gitlabTokenUrl(B)).toBe(
      `https://git.example.org/gitlab/-/user_settings/personal_access_tokens?name=${encodeURIComponent(PRODUCT_NAME)}&scopes=api,write_repository`
    )
    expect(gitlabTokenUrl().startsWith('https://gitlab.com/-/user_settings/personal_access_tokens?')).toBe(true)
  })
})

describe('gitlabAuthFor — what each GitLab may receive', () => {
  const p = profileWith({
    gitlabToken: COM_TOKEN,
    gitlabTokenIssuer: GITLAB_COM,
    links: { gitlab: { source: 'git', login: 'com-user' } },
    gitlabServers: [
      { url: A, token: A_TOKEN },
      { url: B, token: B_TOKEN, link: { source: 'git', login: 'b-user' } }
    ]
  })

  it('gitlab.com gets the profile token and link, a server only its own', () => {
    expect(gitlabAuthFor(p, GITLAB_COM)).toEqual({ token: COM_TOKEN, link: { source: 'git', login: 'com-user' } })
    expect(gitlabAuthFor(p, A)).toEqual({ token: A_TOKEN })
    expect(gitlabAuthFor(p, B)).toEqual({ token: B_TOKEN, link: { source: 'git', login: 'b-user' } })
  })

  it('an unconfigured server, or the same host under another path, gets nothing', () => {
    expect(gitlabAuthFor(p, D)).toEqual({})
    expect(gitlabAuthFor(p, 'https://git.example.org')).toEqual({})
    expect(gitlabAuthFor(p, 'not a url')).toEqual({})
  })

  it('a gitlab.com token issued elsewhere is never handed out', () => {
    expect(gitlabAuthFor({ ...p, gitlabTokenIssuer: A }, GITLAB_COM).token).toBeUndefined()
  })

  it('collects the bases across profiles, de-duplicated, never gitlab.com', () => {
    const q = profileWith({ gitlabServers: [{ url: 'GITLAB.example.corp/', token: '' }, { url: D, token: '' }] })
    expect(gitlabServerBases([p, q])).toEqual([A, B, D])
  })

  it('a picker opens on gitlab.com when connected there, else on the first server', () => {
    expect(preferredGitlabBase(p)).toBe(GITLAB_COM)
    expect(preferredGitlabBase({ ...p, gitlabToken: '', links: {} })).toBe(A)
    expect(preferredGitlabBase(defaultProfile())).toBe(GITLAB_COM)
  })
})

describe('server tokens in the encrypted store', () => {
  const settings = {
    ...defaultSettings(),
    profiles: [profileWith({ id: 'p', gitlabToken: COM_TOKEN, gitlabTokenIssuer: GITLAB_COM, gitlabServers: [{ url: A, token: A_TOKEN }, { url: B, token: B_TOKEN }] })]
  }

  it('are filed under their server and stripped from the plain settings', () => {
    expect(hasSettingsSecrets({ ...settings, profiles: [profileWith({ gitlabServers: [{ url: A, token: A_TOKEN }] })] })).toBe(true)
    const store = extractSecrets(settings)
    expect(store.p.gitlabServerTokens).toEqual({ [A]: A_TOKEN, [B]: B_TOKEN })
    expect(store.p.gitlabToken).toBe(COM_TOKEN)
    const plain = stripSettingsSecrets(settings)
    expect(plain.profiles[0].gitlabServers).toEqual([{ url: A, token: '' }, { url: B, token: '' }])
    for (const t of [COM_TOKEN, A_TOKEN, B_TOKEN]) expect(JSON.stringify(plain)).not.toContain(t)
    const restored = applySecrets(plain, store).profiles[0]
    expect(restored.gitlabServers).toEqual([{ url: A, token: A_TOKEN }, { url: B, token: B_TOKEN }])
    expect(restored.gitlabToken).toBe(COM_TOKEN)
  })

  it('never restore a token onto a different server', () => {
    const store = extractSecrets(settings)
    const moved = { ...settings, profiles: [profileWith({ id: 'p', gitlabServers: [{ url: D, token: '' }, { url: 'https://git.example.org', token: '' }] })] }
    expect(applySecrets(moved, store).profiles[0].gitlabServers?.map((s) => s.token)).toEqual(['', ''])
  })

  it('a save from a renderer that never had the tokens keeps them', () => {
    const stored = extractSecrets(settings)
    const merged = mergeSecretStores(stored, { p: { githubToken: 'ghp' } })
    expect(merged.p.gitlabServerTokens).toEqual({ [A]: A_TOKEN, [B]: B_TOKEN })
  })
})

// ─── Call sites, through the real IPC handlers ──────────────────────────────

interface Call {
  url: string
  token: string | null
}
const calls: Call[] = []

function fakeGitlab(url: string): unknown {
  const u = new URL(url)
  if (u.pathname.endsWith('/api/v4/user')) return { username: 'me', name: 'Me', avatar_url: '', web_url: '' }
  return []
}

describe('each GitLab gets only its own token', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    const base = defaultSettings()
    writeFileSync(
      join(dir, 'gitcito-settings.json'),
      JSON.stringify({
        ...base,
        onboardingCompleted: true,
        activeProfileId: 'work',
        profiles: [
          {
            ...base.profiles[0],
            id: 'work',
            gitlabToken: COM_TOKEN,
            gitlabTokenIssuer: GITLAB_COM,
            gitlabServers: [
              { url: A, token: A_TOKEN },
              { url: B, token: B_TOKEN }
            ]
          },
          // Another profile's server: recognised as GitLab, never this profile's to sign in to.
          { ...base.profiles[0], id: 'other', gitlabServers: [{ url: D, token: D_TOKEN }] }
        ]
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings() // fills the known-server registry, as the app's first read does
    const { registerHostingHandlers } = await import('../src/main/hosting')
    registerHostingHandlers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        const headers = (init?.headers ?? {}) as Record<string, string>
        calls.push({ url, token: headers['PRIVATE-TOKEN'] ?? headers['Authorization'] ?? null })
        return new Response(JSON.stringify(fakeGitlab(url)), { status: 200, headers: { 'content-type': 'application/json' } })
      })
    )
  })
  afterEach(() => {
    calls.length = 0
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    rmSync(dir, { recursive: true, force: true })
  })

  const call = (channel: string, ...args: unknown[]): Promise<unknown> => Promise.resolve(handlers.get(channel)!({}, ...args))
  // What the renderer sends: whatever is in its gitlab slot. Main must ignore it.
  const tokens = { gitlab: RENDERER_TOKEN }

  const expectOnly = (base: string, token: string): void => {
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) {
      expect(c.url.startsWith(`${base}/api/v4/`)).toBe(true)
      expect(c.token).toBe(token)
    }
  }

  it('server A: its API, its token', async () => {
    const res = (await call('hosting:listPRs', `${A}/team/app.git`, tokens)) as { provider: string }
    expect(res.provider).toBe('gitlab')
    expectOnly(A, A_TOKEN)
    expect(calls[0].url).toBe(`${A}/api/v4/projects/team%2Fapp/merge_requests?state=opened&per_page=30`)
  })

  it('server B under a path: the API under that path, its token — over https and ssh', async () => {
    await call('hosting:listPRs', 'https://git.example.org/gitlab/team/sub/app.git', tokens)
    expectOnly(B, B_TOKEN)
    expect(calls[0].url).toBe(`${B}/api/v4/projects/team%2Fsub%2Fapp/merge_requests?state=opened&per_page=30`)
    calls.length = 0
    await call('hosting:listPRs', 'git@git.example.org:team/app.git', tokens)
    expectOnly(B, B_TOKEN)
  })

  it('gitlab.com: the public API, the gitlab.com token', async () => {
    await call('hosting:listPRs', 'https://gitlab.com/team/app.git', tokens)
    expectOnly(GITLAB_COM, COM_TOKEN)
  })

  it('another profile’s server and an unknown host get no token at all', async () => {
    await call('hosting:listPRs', `${D}/team/app.git`, tokens)
    await call('hosting:listPRs', 'https://gitlab.unknown.example/team/app.git', tokens)
    // The same host as B, outside its path, is not B.
    await call('hosting:listPRs', 'https://git.example.org/team/app.git', tokens)
    for (const c of calls) expect(ALL_TOKENS).not.toContain(c.token)
  })

  it('provider-level calls name the server, and an unknown one is refused', async () => {
    await call('hosting:listRepos', 'gitlab', RENDERER_TOKEN, A)
    expectOnly(A, A_TOKEN)
    calls.length = 0
    await call('hosting:listRepos', 'gitlab', RENDERER_TOKEN)
    expectOnly(GITLAB_COM, COM_TOKEN)
    calls.length = 0
    await expect(call('hosting:listRepos', 'gitlab', RENDERER_TOKEN, 'https://evil.example')).rejects.toThrow(/not saved/)
    // Another profile's server is known, but the active profile holds nothing for it.
    await call('hosting:listRepos', 'gitlab', RENDERER_TOKEN, D).catch(() => undefined)
    for (const c of calls) expect(ALL_TOKENS).not.toContain(c.token)
  })

  it('a row in Settings asks its own server with its own token', async () => {
    const who = (await call('hosting:whoAmI', 'gitlab', A_TOKEN, A, false, undefined, A)) as { login: string }
    expect(who.login).toBe('me')
    expectOnly(A, A_TOKEN)
  })

  // Fetch, push and clone resolve through the same profile rule as the API.
  it('the profile resolves each server its own token, and nothing elsewhere', async () => {
    const { activeProfileAuth } = await import('../src/main/settings')
    expect((await activeProfileAuth('gitlab', `${A}/team/app.git`)).token).toBe(A_TOKEN)
    expect((await activeProfileAuth('gitlab', 'git@git.example.org:team/app.git')).token).toBe(B_TOKEN)
    expect((await activeProfileAuth('gitlab', 'https://gitlab.com/team/app.git')).token).toBe(COM_TOKEN)
    expect(await activeProfileAuth('gitlab', `${D}/team/app.git`)).toEqual({})
    expect(await activeProfileAuth('gitlab', 'https://git.example.org/team/app.git')).toEqual({})
    // A provider-level call that names one server cannot be steered to another by its remote.
    expect(await activeProfileAuth('gitlab', `${A}/team/app.git`, B)).toEqual({})
  })

  it('push and fetch credentials follow the remote’s server', async () => {
    const { profileCredentialForUrl } = await import('../src/main/remoteAuthCheck')
    expect((await profileCredentialForUrl('/repo', `${A}/team/app.git`)).credential?.token).toBe(A_TOKEN)
    expect((await profileCredentialForUrl('/repo', `${B}/team/app.git`)).credential?.token).toBe(B_TOKEN)
    expect((await profileCredentialForUrl('/repo', 'https://gitlab.com/team/app.git')).credential?.token).toBe(COM_TOKEN)
    const other = await profileCredentialForUrl('/repo', `${D}/team/app.git`)
    expect(ALL_TOKENS).not.toContain(other.credential?.token)
  })

  it('a clone carries the server’s token, never the one the renderer sent', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const envA = JSON.stringify(await cloneCredentialEnv(`${A}/team/app.git`, 'gitlab', RENDERER_TOKEN))
    expect(envA).toContain(A_TOKEN)
    for (const t of [COM_TOKEN, B_TOKEN, D_TOKEN, RENDERER_TOKEN]) expect(envA).not.toContain(t)
    // A renderer that was never unlocked sends nothing: the server's token is still found.
    expect(JSON.stringify(await cloneCredentialEnv(`${B}/team/app.git`, 'gitlab', ''))).toContain(B_TOKEN)
    const envCom = JSON.stringify(await cloneCredentialEnv('https://gitlab.com/team/app.git', 'gitlab', RENDERER_TOKEN))
    expect(envCom).toContain(COM_TOKEN)
    expect(envCom).not.toContain(A_TOKEN)
    expect(await cloneCredentialEnv(`${D}/team/app.git`, 'gitlab', RENDERER_TOKEN)).toBeNull()
  })
})

describe('migrateGitlabProfile on its own', () => {
  it('is idempotent', () => {
    const once = migrateGitlabProfile(profileWith({ gitlabUrl: A, gitlabToken: A_TOKEN, gitlabTokenIssuer: A }))
    expect(migrateGitlabProfile(once)).toBe(once)
  })
  it('migrateGitlabSecrets leaves a gitlab.com store alone', () => {
    const store = { p: { gitlabToken: COM_TOKEN, gitlabTokenIssuer: GITLAB_COM } }
    expect(migrateGitlabSecrets(store)).toBe(store)
  })
})
