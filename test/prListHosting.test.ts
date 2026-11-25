import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings, type FinishedPullRequests, type PullRequest } from '../src/shared/types'

// What the pull requests page reads from main: the merged/closed list per host
// (its states and its `truncated` rule), the fields the rows map, and who "me"
// is. The real IPC handlers run against a fake fetch and a real settings file.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-pr-list-'))
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

const GITLAB = 'https://gitlab.example.corp'
const FORGEJO = 'https://git.example.corp'
const AZURE = 'https://dev.azure.com/acme/proj/_git/app'
const GITHUB = 'https://github.com/team/app.git'
const BB_CLOUD = 'https://bitbucket.org/team/app.git'
const BBS = 'https://bitbucket.example.corp'
/** A repository bound to a profile that holds no token for anything. */
const BOUND_TO_EMPTY = '/repos/bound-to-empty'

/** URL prefix → [status, body]. The first matching prefix answers. */
let routes: Array<[string, number, unknown]> = []
const calls: string[] = []
/** When set, the next request throws this instead of answering. */
let throwNext: Error | null = null

const call = (channel: string, remote: string): Promise<unknown> =>
  Promise.resolve(handlers.get(channel)!({}, '', remote, { github: 'gh-token', bitbucket: 'bb-token' }))

const ghRow = (n: number, merged: boolean): Record<string, unknown> => ({
  number: n,
  title: `PR ${n}`,
  html_url: `https://github.com/team/app/pull/${n}`,
  merged_at: merged ? '2026-11-01T00:00:00Z' : null,
  updated_at: '2026-11-02T00:00:00Z',
  user: { login: 'ana' },
  head: { ref: `f${n}`, sha: `s${n}` },
  base: { ref: 'main' }
})
const glRow = (n: number): Record<string, unknown> => ({
  iid: n,
  title: `MR ${n}`,
  source_branch: `f${n}`,
  target_branch: 'main',
  web_url: `${GITLAB}/team/app/-/merge_requests/${n}`,
  author: { username: 'ana' }
})

describe('pull requests page — main', () => {
  let hosting: typeof import('../src/main/hosting')

  beforeAll(async () => {
    writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
    writeFileSync(
      join(dir, 'githuttbr-settings.json'),
      JSON.stringify({
        ...defaultSettings(),
        onboardingCompleted: true,
        activeProfileId: 'work',
        profiles: [
          {
            ...defaultSettings().profiles[0],
            id: 'work',
            name: 'Work',
            githubToken: 'gh-token',
            gitlabServers: [{ url: GITLAB, token: 'gl-token' }],
            forgejoUrl: FORGEJO,
            forgejoToken: 'fj-token',
            forgejoTokenIssuer: FORGEJO,
            azureToken: 'az-token',
            azureOrg: 'acme',
            bitbucketToken: 'bb-token',
            bitbucketServers: [{ url: BBS, token: 'bbs-token', username: 'work' }]
          },
          { ...defaultSettings().profiles[0], id: 'empty', name: 'Empty' }
        ],
        repoProfiles: { [BOUND_TO_EMPTY]: 'empty' }
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings()
    hosting = await import('../src/main/hosting')
    hosting.registerHostingHandlers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        calls.push(url)
        if (throwNext) {
          const err = throwNext
          throwNext = null
          throw err
        }
        const hit = routes.find(([prefix]) => url.startsWith(prefix))
        const [, status, body] = hit ?? ['', 200, {}]
        return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
      })
    )
  })
  afterEach(() => {
    routes = []
    calls.length = 0
    hosting.forgetLogins()
  })
  afterAll(() => vi.unstubAllGlobals())

  describe('row mapping', () => {
    it('bitbucket.org: MERGED is merged; DECLINED and SUPERSEDED are closed; OPEN carries no state', () => {
      const row = (state: string): PullRequest =>
        hosting.mapBbCloudPull({
          id: 1,
          title: 'x',
          state: state as 'OPEN',
          author: { display_name: 'Ana', links: { avatar: { href: 'http://insecure/a.png' } } },
          source: { branch: { name: 'f' } },
          destination: { branch: { name: 'main' } },
          links: { html: { href: 'https://bitbucket.org/team/app/pull-requests/1' } }
        })
      expect(row('MERGED').state).toBe('merged')
      expect(row('DECLINED').state).toBe('closed')
      expect(row('SUPERSEDED').state).toBe('closed')
      expect(row('OPEN').state).toBeUndefined()
      // Only an https picture is kept.
      expect(row('OPEN').authorAvatar).toBeUndefined()
    })

    it('Azure: completed is merged, abandoned closed; a team asked to review is nobody awaiting', () => {
      const base = {
        pullRequestId: 7,
        title: 'x',
        isDraft: false,
        createdBy: { displayName: 'Ana Lima' },
        sourceRefName: 'refs/heads/f',
        targetRefName: 'refs/heads/main',
        creationDate: '2026-10-01T00:00:00Z'
      }
      const url = 'https://dev.azure.com/acme/proj'
      expect(hosting.mapAzListPull({ ...base, status: 'completed', closedDate: '2026-10-05T00:00:00Z' }, url, 'app')).toMatchObject({
        state: 'merged',
        updatedAt: '2026-10-05T00:00:00Z',
        sourceBranch: 'f'
      })
      expect(hosting.mapAzListPull({ ...base, status: 'abandoned' }, url, 'app').state).toBe('closed')
      expect(hosting.mapAzListPull({ ...base, status: 'active' }, url, 'app').state).toBeUndefined()
      const asked = hosting.mapAzListPull(
        {
          ...base,
          reviewers: [
            { displayName: '[proj]\\Reviewers', vote: 0, isContainer: true },
            { displayName: 'Bruno', vote: 10 },
            { displayName: 'Carla', vote: 0 }
          ]
        },
        url,
        'app'
      )
      expect(asked.requestedReviewers).toEqual(['Carla'])
      // The team's name is not a person to match "me" against.
      expect(hosting.markAwaitingYou([asked], '[proj]\\Reviewers')[0].awaitingYou).toBeUndefined()
      expect(hosting.markAwaitingYou([asked], 'carla')[0].awaitingYou).toBe(true)
    })

    it('Forgejo: a closed pull with `merged` is merged, without it closed', async () => {
      const { mapForgejoPull } = await import('../src/main/forgejo')
      const base = { number: 3, title: 'x', html_url: `${FORGEJO}/team/app/pulls/3`, user: { login: 'ana' } }
      expect(mapForgejoPull({ ...base, state: 'closed', merged: true }).state).toBe('merged')
      expect(mapForgejoPull({ ...base, state: 'closed', merged: false }).state).toBe('closed')
      expect(mapForgejoPull({ ...base, state: 'open' }).state).toBeUndefined()
    })
  })

  describe('merged and closed, and when the host had more', () => {
    it('GitHub: one closed list, split by merged_at; a full page of 100 is truncated', async () => {
      routes = [['https://api.github.com/repos/team/app/pulls?state=closed', 200, [ghRow(1, true), ghRow(2, false)]]]
      const res = (await call('hosting:listFinishedPRs', GITHUB)) as FinishedPullRequests
      expect(res.prs.map((p) => [p.id, p.state])).toEqual([
        [1, 'merged'],
        [2, 'closed']
      ])
      expect(res.truncated).toBe(false)
      expect(calls[0]).toContain('sort=updated&direction=desc&per_page=100')

      routes = [['https://api.github.com/repos/team/app/pulls?state=closed', 200, Array.from({ length: 100 }, (_, i) => ghRow(i + 1, i % 2 === 0))]]
      expect(((await call('hosting:listFinishedPRs', GITHUB)) as FinishedPullRequests).truncated).toBe(true)
    })

    it('GitLab: merged and closed read apart; either one full is truncated', async () => {
      routes = [
        [`${GITLAB}/api/v4/projects/team%2Fapp/merge_requests?state=merged`, 200, [glRow(1)]],
        [`${GITLAB}/api/v4/projects/team%2Fapp/merge_requests?state=closed`, 200, Array.from({ length: 100 }, (_, i) => glRow(i + 10))]
      ]
      const res = (await call('hosting:listFinishedPRs', `${GITLAB}/team/app.git`)) as FinishedPullRequests
      expect(res.prs[0]).toMatchObject({ id: 1, state: 'merged' })
      expect(res.prs.filter((p) => p.state === 'closed')).toHaveLength(100)
      expect(res.truncated).toBe(true)
    })

    it('bitbucket.org: a next page beyond the hundred is truncated; Bitbucket’s own links only', async () => {
      const row = (id: number, state: string): Record<string, unknown> => ({
        id,
        title: 'x',
        state,
        author: { display_name: 'Ana' },
        source: { branch: { name: 'f' } },
        destination: { branch: { name: 'main' } },
        links: { html: { href: `https://bitbucket.org/team/app/pull-requests/${id}` } }
      })
      routes = [
        [
          'https://api.bitbucket.org/2.0/repositories/team/app/pullrequests?state=MERGED',
          200,
          { values: [row(1, 'MERGED'), row(2, 'DECLINED')], next: 'https://evil.example/steal' }
        ]
      ]
      const res = (await call('hosting:listFinishedPRs', BB_CLOUD)) as FinishedPullRequests
      expect(res.prs.map((p) => p.state)).toEqual(['merged', 'closed'])
      // A next link elsewhere is never followed, and nothing is said to be missing.
      expect(calls.some((c) => c.startsWith('https://evil.example'))).toBe(false)
      expect(res.truncated).toBe(false)
    })

    it('Azure: completed and abandoned, closed in the last year', async () => {
      routes = [['https://dev.azure.com/acme/proj/_apis/git/repositories/app/pullrequests', 200, { value: [] }]]
      const res = (await call('hosting:listFinishedPRs', AZURE)) as FinishedPullRequests
      expect(res.truncated).toBe(false)
      expect(calls.some((c) => c.includes('searchCriteria.status=completed') && c.includes('queryTimeRangeType=closed'))).toBe(true)
      expect(calls.some((c) => c.includes('searchCriteria.status=abandoned') && c.includes('searchCriteria.minTime='))).toBe(true)
    })
  })

  describe('without an account', () => {
    it('Merged/Closed say there is no credential instead of answering an empty list', async () => {
      for (const remote of [`${GITLAB}/team/app.git`, `${FORGEJO}/team/app.git`, `${BBS}/scm/proj/app.git`, BB_CLOUD]) {
        const err = await Promise.resolve()
          .then(() => handlers.get('hosting:listFinishedPRs')!({}, BOUND_TO_EMPTY, remote, {}))
          .then(
            () => null,
            (e: Error) => e
          )
        expect(err?.message, remote).toContain('the profile "Empty" this repository is bound to')
      }
      expect(calls).toEqual([])
    })
  })

  describe('a token check never shows the token', () => {
    it('redacts a token undici echoed back in its error (a newline makes the header invalid)', async () => {
      const token = 'ghp_secret\nvalue'
      throwNext = new TypeError(`Headers.append: "Bearer ${token}" is an invalid header value.`)
      const r = (await handlers.get('hosting:whoAmI')!({}, 'github', token)) as { ok: boolean; failure?: { message: string } }
      expect(r.ok).toBe(false)
      expect(r.failure?.message).not.toContain('ghp_secret')
      expect(r.failure?.message).toContain('•••')
    })
  })

  describe('who "me" is', () => {
    it('Azure DevOps: the connection data’s display name', async () => {
      routes = [
        ['https://dev.azure.com/acme/_apis/connectionData', 200, { authenticatedUser: { providerDisplayName: 'Ana Lima' } }],
        ['https://dev.azure.com/acme/proj/_apis/git/repositories/app/pullrequests', 200, { value: [] }]
      ]
      const res = (await call('hosting:listPRs', AZURE)) as { me: string | null }
      expect(res.me).toBe('Ana Lima')
    })

    it('bitbucket.org: /2.0/user’s display name', async () => {
      routes = [
        ['https://api.bitbucket.org/2.0/user', 200, { display_name: 'Ana Lima' }],
        ['https://api.bitbucket.org/2.0/repositories/team/app/pullrequests', 200, { values: [] }]
      ]
      const res = (await call('hosting:listPRs', BB_CLOUD)) as { me: string | null }
      expect(res.me).toBe('Ana Lima')
    })

    it('a refusal (401/403) is remembered; a server error is asked again', async () => {
      const userCalls = (): number => calls.filter((c) => c === 'https://api.bitbucket.org/2.0/user').length
      routes = [
        ['https://api.bitbucket.org/2.0/user', 403, {}],
        ['https://api.bitbucket.org/2.0/repositories/team/app/pullrequests', 200, { values: [] }]
      ]
      expect(((await call('hosting:listPRs', BB_CLOUD)) as { me: string | null }).me).toBeNull()
      await call('hosting:listPRs', BB_CLOUD)
      expect(userCalls()).toBe(1)

      hosting.forgetLogins()
      calls.length = 0
      routes[0] = ['https://api.bitbucket.org/2.0/user', 503, {}]
      await call('hosting:listPRs', BB_CLOUD)
      await call('hosting:listPRs', BB_CLOUD)
      expect(userCalls()).toBe(2)
    })

    it('tells a refusal from a failure, whichever client threw', () => {
      expect(hosting.isAuthRefusal(Object.assign(new Error('x'), { status: 401 }))).toBe(true)
      expect(hosting.isAuthRefusal(Object.assign(new Error('x'), { status: 500 }))).toBe(false)
      expect(hosting.isAuthRefusal(new Error('fetch failed'))).toBe(false)
    })

    it('a real GitLab 401 is a refusal, by its status', async () => {
      routes = [[`${GITLAB}/api/v4/user`, 401, { message: '401 Unauthorized' }]]
      const err = await hosting.glJson(`${GITLAB}/api/v4/user`, { token: 'gl-token' }).then(
        () => null,
        (e: unknown) => e
      )
      expect(err).toMatchObject({ status: 401 })
      expect(hosting.isAuthRefusal(err)).toBe(true)
      routes = [[`${GITLAB}/api/v4/user`, 502, {}]]
      const down = await hosting.glJson(`${GITLAB}/api/v4/user`, { token: 'gl-token' }).catch((e: unknown) => e)
      expect(hosting.isAuthRefusal(down)).toBe(false)
    })
  })
})
