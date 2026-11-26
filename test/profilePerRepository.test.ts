import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { credentialEnvValues, revealCredentialEnv } from './helpers'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../src/shared/types'
import { blanksOnly } from './credentialConfig'

// One profile per repository action, end to end. Two profiles — Work (active)
// and Personal — hold tokens for the same github.com, Enterprise Server, GitLab
// server, Bitbucket Data Center, Forgejo and Azure DevOps organization. A
// repository bound to Personal must reach every host as Personal, whatever the
// renderer sent (it only knows the active profile); an unbound one as Work.
// And the clone dialog lists, clones and binds as the profile it has picked.
//
// The real IPC handlers run against a fake fetch and a real settings file; the
// assertion is on the credential each request carried.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-profile-per-repo-'))
const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => dir, isPackaged: false },
  ipcMain: { handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn), on: () => undefined },
  dialog: {},
  shell: { openExternal: () => undefined },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => false,
    encryptStringAsync: async () => {
      throw new Error('stubbed')
    },
    decryptStringAsync: async () => {
      throw new Error('stubbed')
    }
  }
}))

const GHES = 'https://github.example.corp'
const GITLAB = 'https://gitlab.example.corp'
const BBS = 'https://bitbucket.example.corp'
const FORGEJO = 'https://git.example.corp'

/** Each profile's token for each host — distinct, so a request names its account. */
const tokens = (who: string): Record<string, string> => ({
  com: `${who}-github-com`,
  ghes: `${who}-ghes`,
  gitlab: `${who}-gitlab-server`,
  bbs: `${who}-bbs`,
  forgejo: `${who}-forgejo`,
  azure: `${who}-azure`
})
const WORK = tokens('work')
const PERSONAL = tokens('personal')

const BOUND = '/repos/bound-to-personal'
const UNBOUND = '/repos/never-bound'
const BOUND_TO_EMPTY = '/repos/bound-to-empty'

interface Provider {
  name: string
  remote: string
  slot: keyof typeof WORK
  /** Calls this provider answers with at least one request. */
  ops: Array<[channel: string, ...args: unknown[]]>
}

const PR_OPS: Provider['ops'] = [
  ['hosting:prDetail', 1],
  ['hosting:prFiles', 1],
  ['hosting:prListCommits', 1],
  ['hosting:prChecks', 1],
  ['hosting:prComment', 1, 'Thanks!'],
  ['hosting:prCommentOnLine', 1, { path: 'src/app.ts', kind: 'add', oldLine: null, newLine: 3 }, 'Nit.'],
  // One handle every host accepts: Azure reads the thread, Data Center the version.
  ['hosting:prEditComment', 1, { id: 3, kind: 'conversation', threadId: 2, version: 0 }, 'Edited.'],
  ['hosting:prDeleteComment', 1, { id: 3, kind: 'conversation', threadId: 2, version: 0 }],
  ['hosting:prReview', 1, 'APPROVE', ''],
  ['hosting:prMerge', 1, 'merge'],
  ['hosting:listPRs'],
  ['hosting:listFinishedPRs']
]
const ISSUE_OPS: Provider['ops'] = [
  ['hosting:listIssues'],
  ['hosting:issueDetail', 5],
  ['hosting:setIssueState', 5, 'closed'],
  ['hosting:createIssue', { title: 'Bug' }],
  ['hosting:listMilestones']
]
// Reviewer / assignee / label choices for the create dialog — every host but Forgejo has some.
const PICKER: Provider['ops'][number] = ['hosting:prPickerOptions']
const GITHUB_ONLY: Provider['ops'] = [
  ['hosting:createPR', { title: 'T', body: '', source: 'feature', target: 'main', draft: false }],
  ['hosting:updatePR', 1, { base: 'main' }],
  // With picks: the reviewer / assignee / label calls after the create run as the same profile.
  ['hosting:createPR', { title: 'T', body: '', source: 'feature', target: 'main', draft: false, reviewers: ['ana'], labels: ['bug'] }],
  ['hosting:mergedPrHeads', ['feature']],
  ['hosting:listReleases'],
  ['hosting:milestoneIssues', 1]
]

const PROVIDERS: Provider[] = [
  {
    name: 'github.com',
    remote: 'https://github.com/team/app.git',
    slot: 'com',
    ops: [...PR_OPS, PICKER, ...ISSUE_OPS, ...GITHUB_ONLY, ['hosting:ciStatuses-github']]
  },
  {
    name: 'GitHub Enterprise Server',
    remote: `${GHES}/team/app.git`,
    slot: 'ghes',
    ops: [...PR_OPS, PICKER, ...ISSUE_OPS, ...GITHUB_ONLY, ['hosting:ciStatuses-github']]
  },
  { name: 'a GitLab server', remote: `${GITLAB}/team/app.git`, slot: 'gitlab', ops: [...PR_OPS, PICKER] },
  {
    name: 'a Bitbucket Data Center',
    remote: `${BBS}/scm/proj/app.git`,
    slot: 'bbs',
    ops: [...PR_OPS, PICKER, ['hosting:ciStatuses-github']]
  },
  { name: 'Forgejo', remote: `${FORGEJO}/team/app.git`, slot: 'forgejo', ops: [...PR_OPS, ...ISSUE_OPS, ['hosting:listReleases']] },
  {
    name: 'Azure DevOps',
    remote: 'https://dev.azure.com/acme/proj/_git/app',
    slot: 'azure',
    ops: [...PR_OPS, PICKER, ['hosting:workItem', 7]]
  }
]

interface Call {
  url: string
  /** Every header value, Basic credentials decoded, so a token is found however it was sent. */
  credentials: string
}
const calls: Call[] = []

function credentialsOf(headers: Record<string, string>): string {
  return Object.values(headers)
    .map((v) => {
      const basic = /^Basic (.+)$/.exec(v)
      return basic ? `${v} ${Buffer.from(basic[1], 'base64').toString()}` : v
    })
    .join('\n')
}

function profile(id: string, name: string, t: Record<string, string>): Record<string, unknown> {
  return {
    ...defaultSettings().profiles[0],
    id,
    name,
    githubToken: t.com,
    githubEnterprise: [{ url: GHES, token: t.ghes }],
    gitlabServers: [{ url: GITLAB, token: t.gitlab }],
    bitbucketServers: [{ url: BBS, token: t.bbs, username: id }],
    forgejoUrl: FORGEJO,
    forgejoToken: t.forgejo,
    forgejoTokenIssuer: FORGEJO,
    azureToken: t.azure,
    azureOrg: 'acme'
  }
}

let ciSha = 0

/** Run one call as the renderer would: the repository first, then the active profile's tokens. */
function invoke(repoPath: string, provider: Provider, [channel, ...args]: Provider['ops'][number]): Promise<unknown> {
  // What the renderer sends is always the active (Work) profile's tokens.
  const sent = { github: WORK.com, gitlab: WORK.gitlab, bitbucket: WORK.bbs, forgejo: WORK.forgejo, azure: WORK.azure }
  const run = (name: string, ...rest: unknown[]): Promise<unknown> =>
    Promise.resolve()
      .then(() => handlers.get(name)!({}, repoPath, provider.remote, ...rest))
      .catch(() => undefined) // the fake answers {} — what matters is who asked
  // A fresh commit each time: CI answers are cached per account, and a cached one sends nothing.
  if (channel === 'hosting:ciStatuses-github') return run('hosting:ciStatuses', [`c0ffee${++ciSha}`], WORK.com)
  return run(channel, sent, ...args)
}

describe('a repository’s hosting actions run as the profile it is bound to', () => {
  beforeAll(async () => {
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    writeFileSync(
      join(dir, 'githuttbr-settings.json'),
      JSON.stringify({
        ...defaultSettings(),
        onboardingCompleted: true,
        activeProfileId: 'work',
        profiles: [
          profile('work', 'Work', WORK),
          profile('personal', 'Personal', PERSONAL),
          { ...defaultSettings().profiles[0], id: 'empty', name: 'Empty' }
        ],
        repoProfiles: { [BOUND]: 'personal', [BOUND_TO_EMPTY]: 'empty' }
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings() // fills the known-server registries, as the app's first read does
    const { registerHostingHandlers } = await import('../src/main/hosting')
    registerHostingHandlers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        calls.push({ url: String(input), credentials: credentialsOf((init?.headers ?? {}) as Record<string, string>) })
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
      })
    )
  })
  afterEach(() => {
    calls.length = 0
  })
  afterAll(() => vi.unstubAllGlobals())

  for (const provider of PROVIDERS) {
    describe(provider.name, () => {
      for (const op of provider.ops) {
        const label = op[0].replace('hosting:', '').replace('-github', '')
        it(`${label}: a bound repository sends Personal’s token, never Work’s`, async () => {
          await invoke(BOUND, provider, op)
          expect(calls.length).toBeGreaterThan(0)
          for (const c of calls) {
            expect(c.credentials, c.url).toContain(PERSONAL[provider.slot])
            expect(c.credentials, c.url).not.toContain('work-')
          }
        })
        it(`${label}: an unbound repository sends the active profile’s (Work’s)`, async () => {
          await invoke(UNBOUND, provider, op)
          expect(calls.length).toBeGreaterThan(0)
          for (const c of calls) {
            expect(c.credentials, c.url).toContain(WORK[provider.slot])
            expect(c.credentials, c.url).not.toContain('personal-')
          }
        })
      }
    })
  }

  // The PR page's "you" (whose comments get Edit and Delete) is asked as the
  // bound profile too: never the active one's account.
  it('the PR page asks who "you" are as the bound profile', async () => {
    const { forgetLogins } = await import('../src/main/hosting')
    forgetLogins()
    const github = PROVIDERS[0]
    await invoke(BOUND, github, ['hosting:prDetail', 1])
    const who = calls.filter((c) => c.url === 'https://api.github.com/user')
    expect(who).toHaveLength(1)
    expect(who[0].credentials).toContain(PERSONAL.com)
    expect(who[0].credentials).not.toContain('work-')
  })

  // Bound to a profile with nothing for the host: nothing is sent, and the
  // error names that profile — "this profile" would point at the active one.
  it('a bound profile with no credential sends nothing and says which profile it is', async () => {
    for (const remote of ['https://gitlab.example.corp/team/app.git', `${GHES}/team/app.git`]) {
      const err = await Promise.resolve()
        .then(() => handlers.get('hosting:prDetail')!({}, BOUND_TO_EMPTY, remote, { github: WORK.com, gitlab: WORK.gitlab }, 1))
        .then(() => null, (e: Error) => e)
      expect(err?.message, remote).toContain('the profile "Empty" this repository is bound to')
    }
    expect(calls).toEqual([])
  })

  it('no repository at all (a malformed path) falls back to the active profile, not to a guess', async () => {
    const github = PROVIDERS[0]
    calls.length = 0
    await Promise.resolve(handlers.get('hosting:prDetail')!({}, 42, github.remote, { github: WORK.com }, 1)).catch(() => undefined)
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.credentials).toContain(WORK.com)
  })

  // Two repositories bound to different profiles, at once: the scope is per
  // call, so one in flight never lends its profile to the other.
  it('concurrent calls for two repositories each keep their own profile', async () => {
    const ghes = PROVIDERS[1]
    await Promise.all([invoke(BOUND, ghes, ['hosting:prDetail', 1]), invoke(UNBOUND, ghes, ['hosting:prDetail', 2])])
    const one = calls.filter((c) => /\/pulls\/1\b/.test(c.url))
    const two = calls.filter((c) => /\/pulls\/2\b/.test(c.url))
    expect(one.length).toBeGreaterThan(0)
    expect(two.length).toBeGreaterThan(0)
    for (const c of one) expect(c.credentials).toContain(PERSONAL.ghes)
    for (const c of two) expect(c.credentials).toContain(WORK.ghes)
  })
})

describe('the clone dialog lists, clones and binds as the profile it picked', () => {
  // Same settings as above; written again so this block stands on its own.
  beforeAll(async () => {
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    writeFileSync(
      join(dir, 'githuttbr-settings.json'),
      JSON.stringify({
        ...defaultSettings(),
        onboardingCompleted: true,
        activeProfileId: 'work',
        profiles: [profile('work', 'Work', WORK), profile('personal', 'Personal', PERSONAL)]
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings()
    const { registerHostingHandlers } = await import('../src/main/hosting')
    registerHostingHandlers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        calls.push({ url: String(input), credentials: credentialsOf((init?.headers ?? {}) as Record<string, string>) })
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
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

  const listRepos = (provider: string, token: string, org: string | undefined, profileId?: string): Promise<unknown> =>
    Promise.resolve(handlers.get('hosting:listRepos')!({}, provider, token, org, profileId))

  // For github.com, bitbucket.org and Azure the renderer sends the picked
  // profile's token; a server's token is resolved in main from the picked id.
  const LISTS: Array<{ name: string; provider: string; org?: string; slot: keyof typeof WORK }> = [
    { name: 'github.com', provider: 'github', slot: 'com' },
    { name: 'a GitHub Enterprise Server', provider: 'github', org: GHES, slot: 'ghes' },
    { name: 'a GitLab server', provider: 'gitlab', org: GITLAB, slot: 'gitlab' },
    { name: 'Forgejo', provider: 'forgejo', slot: 'forgejo' },
    { name: 'Azure DevOps', provider: 'azure', org: 'acme', slot: 'azure' }
  ]

  for (const l of LISTS) {
    it(`${l.name}: the repository list uses the picked profile`, async () => {
      await listRepos(l.provider, PERSONAL[l.slot], l.org, 'personal').catch(() => undefined)
      expect(calls.length).toBeGreaterThan(0)
      for (const c of calls) {
        expect(c.credentials, c.url).toContain(PERSONAL[l.slot])
        expect(c.credentials, c.url).not.toContain('work-')
      }
    })
  }

  it('the account list (create a repository) uses the picked profile too', async () => {
    await Promise.resolve(handlers.get('hosting:listOwners')!({}, 'gitlab', '', GITLAB, 'personal')).catch(() => undefined)
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.credentials).toContain(PERSONAL.gitlab)
  })

  // One rule at the IPC boundary: a string names a profile, anything else none.
  it('a non-string profile id means the active profile, as for the clone', async () => {
    for (const id of [null, 42, {}]) {
      await listRepos('gitlab', '', GITLAB, id as unknown as string).catch(() => undefined)
    }
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.credentials).toContain(WORK.gitlab)
  })

  it('no picked profile (Settings, an older caller) keeps the active one', async () => {
    await listRepos('gitlab', '', GITLAB).catch(() => undefined)
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.credentials).toContain(WORK.gitlab)
  })

  it('an empty or unknown profile id gets nothing — not the active profile, not the first, not the sent token', async () => {
    for (const id of ['', '   ', 'gone']) {
      for (const l of LISTS) {
        await expect(listRepos(l.provider, PERSONAL[l.slot], l.org, id)).rejects.toThrow()
      }
    }
    expect(calls).toEqual([])
  })

  it('the clone signs in as the picked profile on every provider tab, and as nobody for an unknown id', async () => {
    const { cloneCredentialEnv } = await import('../src/main/git')
    const cases: Array<{ url: string; host: string; slot: keyof typeof WORK; sent?: string }> = [
      { url: `${GHES}/team/app.git`, host: 'github', slot: 'ghes' },
      { url: `${GITLAB}/team/app.git`, host: 'gitlab', slot: 'gitlab' },
      { url: `${BBS}/scm/proj/app.git`, host: 'bitbucket', slot: 'bbs' },
      { url: `${FORGEJO}/team/app.git`, host: 'forgejo', slot: 'forgejo' },
      // github.com uses the renderer's token — the picked profile's.
      { url: 'https://github.com/team/app.git', host: 'github', slot: 'com', sent: PERSONAL.com }
    ]
    for (const c of cases) {
      const env = revealCredentialEnv(await cloneCredentialEnv(c.url, c.host, c.sent ?? WORK[c.slot], 'personal'))
      expect(env, c.url).toContain(PERSONAL[c.slot])
      expect(env, c.url).not.toContain('work-')
      for (const id of ['', 'gone']) {
        expectAnonymous(await cloneCredentialEnv(c.url, c.host, c.sent ?? WORK[c.slot], id), c.url, 'work-', 'personal-')
      }
    }
  })
})

/** Anonymous, not "nothing": the host's credential helpers are blanked, so the
 *  machine's credential manager cannot answer as another account. No token. */
function expectAnonymous(env: NodeJS.ProcessEnv | null, url: string, ...absent: string[]): void {
  expect(env, url).not.toBeNull()
  // As real git reads it, in whichever form the installed git takes.
  expect(blanksOnly(env, new URL(url).origin), url).toBe(true)
  expect(env!.GIT_ASKPASS, url).toBe('')
  for (const s of absent) expect(revealCredentialEnv(env), url).not.toContain(s)
}
