import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  GITHUB_COM,
  GITHUB_COM_ENDPOINTS,
  githubAuthFor,
  githubBaseOfRemote,
  githubEndpoints,
  githubEnterpriseBases,
  githubEnterpriseUrlProblem,
  githubInstanceOf,
  normalizeGithubEnterpriseUrl,
  resolveGithubHost
} from '../src/shared/githubEnterprise'
import { applySecrets, extractSecrets, hasSettingsSecrets, stripSettingsSecrets } from '../src/shared/secrets'
import { defaultProfile, defaultSettings, type Profile } from '../src/shared/types'
import {
  githubCommitUrl,
  githubTagUrl,
  isGitHubRemote,
  isReviewableRemote,
  repoHasIssueTracker
} from '../src/renderer/src/lib/hosting'

// GitHub Enterprise Server: one resolver for every GitHub URL, and a token that
// only ever reaches the server it was saved for. The call-site tests run the
// real IPC handlers against a fake fetch and a real settings file.

const dir = mkdtempSync(join(tmpdir(), 'gitcito-ghes-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()
const opened: string[] = []

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: { openExternal: (url: string) => opened.push(url) },
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

const GHES = 'https://github.example.corp'
const GHES_B = 'https://ghe.other.example:8443'
const COM_TOKEN = 'com-token'
const GHES_TOKEN = 'ghes-token'
const GHES_B_TOKEN = 'ghes-b-token'

describe('normalizeGithubEnterpriseUrl', () => {
  it('accepts a bare host or an https address, and canonicalises case and trailing slash', () => {
    expect(normalizeGithubEnterpriseUrl('GitHub.Example.Corp')).toBe(GHES)
    expect(normalizeGithubEnterpriseUrl('https://github.example.corp/')).toBe(GHES)
    expect(normalizeGithubEnterpriseUrl('ghe.other.example:8443')).toBe(GHES_B)
  })

  it('allows private addresses: most Enterprise Servers live on internal networks', () => {
    expect(normalizeGithubEnterpriseUrl('10.0.0.5')).toBe('https://10.0.0.5')
    expect(normalizeGithubEnterpriseUrl('ghe.internal')).toBe('https://ghe.internal')
  })

  it('refuses http, paths, credentials and github.com — each for its own reason', () => {
    expect(githubEnterpriseUrlProblem('http://github.example.corp')).toBe('http')
    expect(githubEnterpriseUrlProblem('ftp://github.example.corp')).toBe('invalid')
    expect(githubEnterpriseUrlProblem('github.example.corp/api/v3')).toBe('path')
    expect(githubEnterpriseUrlProblem('https://github.example.corp/?x=1')).toBe('path')
    expect(githubEnterpriseUrlProblem('https://me:secret@github.example.corp')).toBe('credentials')
    expect(githubEnterpriseUrlProblem('me@github.example.corp')).toBe('credentials')
    expect(githubEnterpriseUrlProblem('github.com')).toBe('githubCom')
    expect(githubEnterpriseUrlProblem('api.github.com')).toBe('githubCom')
    expect(githubEnterpriseUrlProblem('acme.ghe.com')).toBe('gheCom')
    expect(githubEnterpriseUrlProblem('')).toBe('invalid')
    expect(normalizeGithubEnterpriseUrl('http://github.example.corp')).toBeNull()
  })
})

describe('githubEndpoints — the one place GitHub URLs come from', () => {
  it('maps github.com (or nothing) to the public API', () => {
    expect(githubEndpoints()).toEqual(GITHUB_COM_ENDPOINTS)
    expect(githubEndpoints(GITHUB_COM)).toEqual({
      apiBase: 'https://api.github.com',
      graphqlUrl: 'https://api.github.com/graphql',
      webBase: 'https://github.com',
      enterprise: false
    })
  })

  it('maps a GHES to /api/v3, /api/graphql and its own web root', () => {
    expect(githubEndpoints(GHES)).toEqual({
      apiBase: `${GHES}/api/v3`,
      graphqlUrl: `${GHES}/api/graphql`,
      webBase: GHES,
      enterprise: true
    })
  })

  it('keeps the port of a server on a non-standard one', () => {
    expect(githubEndpoints(GHES_B).apiBase).toBe('https://ghe.other.example:8443/api/v3')
  })

  it('throws on a malformed base instead of falling back to api.github.com', () => {
    expect(() => githubEndpoints('http://github.example.corp')).toThrow()
    expect(() => githubEndpoints('https://github.example.corp/sub')).toThrow()
  })
})

describe('resolveGithubHost / githubBaseOfRemote', () => {
  const known = [GHES, GHES_B]
  it('resolves github.com and configured servers, case-insensitively', () => {
    expect(resolveGithubHost('GitHub.com', known)).toBe(GITHUB_COM_ENDPOINTS)
    expect(resolveGithubHost('GITHUB.EXAMPLE.CORP', known)?.apiBase).toBe(`${GHES}/api/v3`)
    expect(resolveGithubHost('ghe.other.example:8443', known)?.webBase).toBe(GHES_B)
  })

  it('knows no unknown host — it is never "probably GitHub"', () => {
    expect(resolveGithubHost('git.example.org', known)).toBeNull()
    expect(githubBaseOfRemote('https://git.example.org/o/r.git', known)).toBeNull()
    expect(githubBaseOfRemote('https://notgithub.com/o/r.git', known)).toBeNull()
  })

  it('tells servers apart by port over https, and by hostname over ssh', () => {
    expect(githubBaseOfRemote('https://ghe.other.example:8443/o/r.git', known)).toBe(GHES_B)
    // Same machine, default port: a different server as far as a token is concerned.
    expect(githubBaseOfRemote('https://ghe.other.example/o/r.git', known)).toBeNull()
    expect(githubBaseOfRemote('ssh://git@ghe.other.example:2222/o/r.git', known)).toBe(GHES_B)
    expect(githubBaseOfRemote('git@github.example.corp:o/r.git', known)).toBe(GHES)
    expect(githubBaseOfRemote('git@github.com:o/r.git', known)).toBe(GITHUB_COM)
  })

  it('never matches a GHES over plain http', () => {
    expect(githubBaseOfRemote('http://github.example.corp/o/r.git', known)).toBeNull()
  })

  it('parses owner/repo on either kind of server', () => {
    expect(githubInstanceOf('https://github.example.corp/Team/App.git', known)).toEqual({ base: GHES, owner: 'Team', repo: 'App' })
    expect(githubInstanceOf('git@github.com:octo/app.git', known)).toEqual({ base: GITHUB_COM, owner: 'octo', repo: 'app' })
    expect(githubInstanceOf('https://github.example.corp/a/b/c', known)).toBeNull()
  })
})

const profileWith = (over: Partial<Profile>): Profile => ({ ...defaultProfile(), ...over })

describe('token isolation', () => {
  const p = profileWith({
    githubToken: COM_TOKEN,
    links: { github: { source: 'gh', login: 'me' } },
    githubEnterprise: [
      { url: 'github.example.corp', token: GHES_TOKEN },
      { url: GHES_B, token: GHES_B_TOKEN }
    ]
  })

  it('github.com gets the github.com token and link, nothing else', () => {
    expect(githubAuthFor(p, GITHUB_COM)).toEqual({ token: COM_TOKEN, link: { source: 'gh', login: 'me' } })
  })

  it('each server gets only its own token, and never a github.com link', () => {
    expect(githubAuthFor(p, GHES)).toEqual({ token: GHES_TOKEN })
    expect(githubAuthFor(p, GHES_B)).toEqual({ token: GHES_B_TOKEN })
  })

  it('an unconfigured server gets nothing — not the github.com token', () => {
    expect(githubAuthFor(p, 'https://unknown.example')).toEqual({})
    expect(githubAuthFor(p, 'not a url')).toEqual({})
  })

  it('collects the configured bases across profiles, de-duplicated', () => {
    expect(githubEnterpriseBases([p, profileWith({ githubEnterprise: [{ url: 'GITHUB.example.corp/', token: '' }] })])).toEqual([GHES, GHES_B])
  })
})

describe('GHES tokens in the encrypted store', () => {
  it('are filed under their server and stripped from the plain settings', () => {
    const settings = { ...defaultSettings(), profiles: [profileWith({ id: 'p', githubEnterprise: [{ url: GHES, token: GHES_TOKEN }] })] }
    expect(hasSettingsSecrets(settings)).toBe(true)
    const store = extractSecrets(settings)
    expect(store.p.githubEnterpriseTokens).toEqual({ [GHES]: GHES_TOKEN })
    const plain = stripSettingsSecrets(settings)
    expect(plain.profiles[0].githubEnterprise).toEqual([{ url: GHES, token: '' }])
    expect(JSON.stringify(plain)).not.toContain(GHES_TOKEN)
    expect(applySecrets(plain, store).profiles[0].githubEnterprise?.[0].token).toBe(GHES_TOKEN)
  })

  it('never restore a token onto a different server', () => {
    const settings = { ...defaultSettings(), profiles: [profileWith({ id: 'p', githubEnterprise: [{ url: GHES, token: GHES_TOKEN }] })] }
    const store = extractSecrets(settings)
    const moved = { ...settings, profiles: [profileWith({ id: 'p', githubEnterprise: [{ url: GHES_B, token: '' }] })] }
    expect(applySecrets(moved, store).profiles[0].githubEnterprise?.[0].token).toBe('')
  })
})

describe('renderer recognition', () => {
  const known = [GHES]
  const remotes = [{ name: 'origin', url: 'git@github.example.corp:team/app.git' }] as never

  it('treats a configured server as GitHub, and only when configured', () => {
    expect(isGitHubRemote('https://github.example.corp/team/app.git', known)).toBe(true)
    expect(isGitHubRemote('https://github.example.corp/team/app.git')).toBe(false)
    expect(isReviewableRemote('https://github.example.corp/team/app.git', [], [], known)).toBe(true)
    expect(repoHasIssueTracker(remotes, [], known)).toBe(true)
  })

  it('builds web links on the server, not on github.com', () => {
    expect(githubCommitUrl(remotes, 'abc123', known)).toBe(`${GHES}/team/app/commit/abc123`)
    expect(githubTagUrl('https://github.example.corp/team/app.git', 'v1', known)).toBe(`${GHES}/team/app/releases/tag/v1`)
    expect(githubTagUrl('https://github.com/octo/app.git', 'v1')).toBe('https://github.com/octo/app/releases/tag/v1')
  })
})

// ─── Call sites, through the real IPC handlers ──────────────────────────────

interface Call {
  url: string
  auth: string | null
}
const calls: Call[] = []

function fakeGithub(url: string): unknown {
  const u = new URL(url)
  const path = u.pathname.replace(/^\/api\/v3/, '')
  if (u.pathname.endsWith('/graphql')) {
    return { data: { repository: { issue: { closedByPullRequestsReferences: { nodes: [] }, projectItems: { nodes: [] } } } } }
  }
  if (/\/pulls$/.test(path) && u.searchParams.get('state') === 'open') {
    return [
      {
        number: 1,
        title: 'Change',
        draft: false,
        html_url: `${u.origin}/team/app/pull/1`,
        user: { login: 'dev' },
        head: { ref: 'feature', sha: 'abc' },
        base: { ref: 'main' }
      }
    ]
  }
  if (/\/check-runs$/.test(path)) return { check_runs: [] }
  if (/\/pulls\/1$/.test(path)) return { head: { sha: 'abc' } }
  if (/\/issues\/5$/.test(path)) {
    return { number: 5, title: 'Bug', body: '', user: { login: 'dev' }, state: 'open', html_url: '', created_at: '', labels: [], assignees: [], milestone: null }
  }
  if (path === '/user') return { id: 1, login: 'me', name: null, avatar_url: '', html_url: '' }
  if (/\/issues(\/5\/comments)?$/.test(path) || path === '/user/repos' || path === '/user/orgs') return []
  return {}
}

describe('every formerly hardcoded call site uses the resolver', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    const base = defaultSettings()
    writeFileSync(
      join(dir, 'gitcito-settings.json'),
      JSON.stringify({
        ...base,
        onboardingCompleted: true,
        profiles: [
          {
            ...base.profiles[0],
            githubToken: COM_TOKEN,
            githubEnterprise: [
              { url: GHES, token: GHES_TOKEN },
              { url: GHES_B, token: GHES_B_TOKEN }
            ]
          }
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
        calls.push({ url, auth: headers['Authorization'] ?? null })
        return new Response(JSON.stringify(fakeGithub(url)), { status: 200, headers: { 'content-type': 'application/json' } })
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
  // A repository-scoped call's first argument is the repository; '' is none (the active profile).
  const UNBOUND = ''
  const REMOTE = 'https://github.example.corp/team/app.git'
  // What the renderer sends: the github.com token, always. It must never reach the server.
  const tokens = { github: COM_TOKEN }

  const expectOnlyGhes = (): void => {
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) {
      expect(c.url.startsWith(`${GHES}/api/`)).toBe(true)
      expect(c.auth).toBe(`Bearer ${GHES_TOKEN}`)
    }
  }

  it('pull requests and their checks', async () => {
    const res = (await call('hosting:listPRs', UNBOUND, REMOTE, tokens)) as { provider: string; prs: unknown[] }
    expect(res.provider).toBe('github')
    expect(res.prs).toHaveLength(1)
    expectOnlyGhes()
    expect(calls.some((c) => c.url === `${GHES}/api/v3/repos/team/app/pulls?state=open&per_page=30`)).toBe(true)
    expect(calls.some((c) => c.url.startsWith(`${GHES}/api/v3/repos/team/app/commits/abc/check-runs`))).toBe(true)
  })

  it('pull request checks', async () => {
    await call('hosting:prChecks', UNBOUND, REMOTE, tokens, 1)
    expectOnlyGhes()
    expect(calls.map((c) => c.url)).toContain(`${GHES}/api/v3/repos/team/app/pulls/1`)
  })

  it('issues', async () => {
    await call('hosting:listIssues', UNBOUND, REMOTE, tokens)
    expectOnlyGhes()
    expect(calls[0].url).toBe(`${GHES}/api/v3/repos/team/app/issues?state=open&per_page=50`)
  })

  it('issue detail, including the GraphQL linked-PRs query', async () => {
    await call('hosting:issueDetail', UNBOUND, REMOTE, tokens, 5)
    expectOnlyGhes()
    expect(calls.filter((c) => c.url === `${GHES}/api/graphql`).length).toBe(2) // linked PRs + project fields
  })

  it('a second server gets its own token, not the first one’s', async () => {
    await call('hosting:listIssues', UNBOUND, 'git@ghe.other.example:team/app.git', tokens)
    expect(calls[0].url).toBe('https://ghe.other.example:8443/api/v3/repos/team/app/issues?state=open&per_page=50')
    expect(calls[0].auth).toBe(`Bearer ${GHES_B_TOKEN}`)
  })

  it('the compare link opens on the server', async () => {
    await call('hosting:openCreatePR', REMOTE, 'feature', 'main')
    expect(opened.pop()).toBe(`${GHES}/team/app/compare/main...feature?expand=1`)
  })

  it('github.com is unchanged: public API, github.com token', async () => {
    await call('hosting:listIssues', UNBOUND, 'https://github.com/octo/app.git', tokens)
    expect(calls[0].url).toBe('https://api.github.com/repos/octo/app/issues?state=open&per_page=50')
    expect(calls[0].auth).toBe(`Bearer ${COM_TOKEN}`)
  })

  it('a provider-level call names the server explicitly, and an unknown one is refused', async () => {
    await call('hosting:listRepos', 'github', '', GHES)
    expect(calls[0].url.startsWith(`${GHES}/api/v3/user/repos`)).toBe(true)
    expect(calls[0].auth).toBe(`Bearer ${GHES_TOKEN}`)
    calls.length = 0
    await expect(call('hosting:listRepos', 'github', COM_TOKEN, 'https://evil.example')).rejects.toThrow(/not saved/)
    expect(calls).toHaveLength(0)
  })

  // The onboarding wizard keeps its profile to itself until it finishes, so a
  // server added there is unknown to main when its row checks the token.
  describe('checking a token against a server no profile has saved yet', () => {
    const NEW = 'https://ghe.new.example'
    const TYPED = 'typed-token'
    const SAVED = [COM_TOKEN, GHES_TOKEN, GHES_B_TOKEN]

    it('asks that server, with exactly the token the call carries', async () => {
      await call('hosting:whoAmI', 'github', ` ${TYPED} `, 'GHE.New.Example/', false)
      expect(calls.map((c) => c.url)).toContain(`${NEW}/api/v3/user`)
      for (const c of calls) {
        expect(c.url.startsWith(`${NEW}/api/v3/`)).toBe(true)
        expect(c.auth).toBe(`Bearer ${TYPED}`)
      }
    })

    it('without a token of its own it is refused, and nothing is sent', async () => {
      await expect(call('hosting:whoAmI', 'github', '', NEW, true)).rejects.toThrow(/not saved/)
      await expect(call('hosting:whoAmI', 'github', '   ', NEW, false, { source: 'gh', login: 'me' })).rejects.toThrow(
        /not saved/
      )
      expect(calls).toHaveLength(0)
    })

    it('a link or sign-in request alongside the token changes nothing: only that token goes', async () => {
      await call('hosting:whoAmI', 'github', TYPED, NEW, true, { source: 'gh', login: 'me' })
      expect(calls.length).toBeGreaterThan(0)
      for (const c of calls) expect(c.auth).toBe(`Bearer ${TYPED}`)
    })

    it('an address Settings would refuse is refused here too', async () => {
      for (const bad of ['http://ghe.new.example', 'https://me:pw@ghe.new.example', 'https://ghe.new.example/x', 'https://x.ghe.com']) {
        await expect(call('hosting:whoAmI', 'github', TYPED, bad, false)).rejects.toThrow(/not saved/)
      }
      expect(calls).toHaveLength(0)
    })

    it('only the explicit check is opened up: listing repositories there is still refused', async () => {
      await expect(call('hosting:listRepos', 'github', TYPED, NEW)).rejects.toThrow(/not saved/)
      expect(calls).toHaveLength(0)
    })

    it('no saved token ever reaches the new server', async () => {
      await call('hosting:whoAmI', 'github', TYPED, NEW, false).catch(() => undefined)
      await call('hosting:whoAmI', 'github', '', NEW, true).catch(() => undefined)
      for (const c of calls) for (const t of SAVED) expect(c.auth).not.toContain(t)
    })

    // Main cannot tell a token just typed from a saved one the renderer holds:
    // one the app already has — any profile, provider or server — stays home.
    it('a token the app already holds is not sent to the new server', async () => {
      const { HELD_TOKEN_TO_UNSAVED_SERVER } = await import('../src/main/hosting')
      for (const saved of SAVED) {
        await expect(call('hosting:whoAmI', 'github', ` ${saved} `, NEW, false)).rejects.toThrow(HELD_TOKEN_TO_UNSAVED_SERVER)
      }
      expect(calls).toHaveLength(0)
    })

    it('a saved server still resolves the normal way', async () => {
      await call('hosting:whoAmI', 'github', GHES_TOKEN, GHES, false)
      expectOnlyGhes()
    })
  })

  // Fetch, push and clone resolve through the same profile rule as the API.
  it('the profile resolves each server its own token, and nothing for an unknown host', async () => {
    const { activeProfileAuth } = await import('../src/main/settings')
    expect(await activeProfileAuth('github', 'https://github.example.corp/team/app.git')).toEqual({ token: GHES_TOKEN })
    expect(await activeProfileAuth('github', 'git@ghe.other.example:team/app.git')).toEqual({ token: GHES_B_TOKEN })
    expect((await activeProfileAuth('github', 'https://github.com/octo/app.git')).token).toBe(COM_TOKEN)
    expect(await activeProfileAuth('github', 'https://ghe.other.example/team/app.git')).toEqual({})
  })

  it('a clone from a server never carries the github.com token the renderer sent', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const env = JSON.stringify(await cloneCredentialEnv('https://github.example.corp/team/app.git', 'github', COM_TOKEN))
    expect(env).toContain(GHES_TOKEN)
    expect(env).not.toContain(COM_TOKEN)
  })
})
