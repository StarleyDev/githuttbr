import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings, type PrFile, type PrUpdateList } from '../src/shared/types'

// A pull request's updates, per host: the URLs each one is asked, how its
// record maps onto PrUpdate, force pushes, and truncation — plus the host
// compare behind "View changes in this update". The real IPC handlers run
// against a fake fetch and a real settings file.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-pr-updates-'))
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

const GITHUB = 'https://github.com/team/app.git'
const GITLAB = 'https://gitlab.example.corp'
const FORGEJO = 'https://git.example.corp'
const AZURE = 'https://dev.azure.com/acme/proj/_git/app'
const BB_CLOUD = 'https://bitbucket.org/team/app.git'
const BBS = 'https://bitbucket.example.corp'

type Answer = { status?: number; body: unknown; headers?: Record<string, string> }
/** [URL prefix, answer]. The longest matching prefix answers; anything else is 200 {}. */
let routes: Array<[string, Answer]> = []
const asked: string[] = []
const posted: string[] = []

const updates = (remote: string): Promise<PrUpdateList> =>
  Promise.resolve().then(() => handlers.get('hosting:prListUpdates')!({}, '', remote, {}, 7) as Promise<PrUpdateList>)
const updateFiles = (remote: string, from: unknown, to: unknown): Promise<PrFile[] | null> =>
  Promise.resolve().then(() => handlers.get('hosting:prUpdateFiles')!({}, '', remote, {}, 7, from, to) as Promise<PrFile[] | null>)

const sha = (tag: string): string => tag.padEnd(40, '0')
const tags = (l: PrUpdateList, i: number): string[] => l.updates[i].added.map((c) => c.sha.slice(0, 2))

describe('a pull request’s updates — main', () => {
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
          }
        ]
      })
    )
    const { readSettings } = await import('../src/main/settings')
    await readSettings()
    const hosting = await import('../src/main/hosting')
    hosting.registerHostingHandlers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input)
        asked.push(url)
        if (typeof init?.body === 'string') posted.push(init.body)
        const hit = routes.filter(([prefix]) => url.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0]
        const a = hit?.[1] ?? { body: {} }
        return new Response(JSON.stringify(a.body), {
          status: a.status ?? 200,
          headers: { 'content-type': 'application/json', ...a.headers }
        })
      })
    )
  })
  afterEach(() => {
    routes = []
    asked.length = 0
    posted.length = 0
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    rmSync(dir, { recursive: true, force: true })
  })

  describe('Azure DevOps', () => {
    const BASE = 'https://dev.azure.com/acme/proj/_apis/git/repositories/app/pullrequests/7'
    const ref = (tag: string, parents: string[] = []): Record<string, unknown> => ({
      commitId: sha(tag),
      comment: `Subject ${tag}`,
      author: { name: 'Ana', date: '2026-11-01T10:00:00Z' },
      parents: parents.map(sha)
    })

    it('one iteration per push: pusher, reason, heads, and each commit in the first iteration listing it', async () => {
      routes = [
        [
          `${BASE}/iterations?includeCommits=true`,
          {
            body: {
              value: [
                // Out of order on purpose: sorted by id.
                {
                  id: 2,
                  reason: 'push',
                  createdDate: '2026-11-02T10:00:00Z',
                  push: { pushedBy: { displayName: 'Bruno Lima' } },
                  sourceRefCommit: { commitId: sha('b2') },
                  commits: [ref('b2', ['a1']), ref('a1')]
                },
                {
                  id: 1,
                  reason: 'create',
                  createdDate: '2026-11-01T10:00:00Z',
                  author: { displayName: 'Ana Souza' },
                  sourceRefCommit: { commitId: sha('a1') },
                  commonRefCommit: { commitId: sha('ba') },
                  commits: [ref('a1')]
                },
                {
                  id: 3,
                  reason: 'forcePush',
                  createdDate: '2026-11-03T10:00:00Z',
                  sourceRefCommit: { commitId: sha('c3') },
                  commits: [ref('c3', ['a1'])],
                  hasMoreCommits: true
                }
              ]
            }
          }
        ],
        [`${BASE}/iterations/3/commits`, { body: { value: [ref('c3', ['a1']), ref('a1')] } }]
      ]
      const l = await updates(AZURE)
      expect(asked[0]).toBe(`${BASE}/iterations?includeCommits=true&api-version=7.1`)
      expect(asked).toContain(`${BASE}/iterations/3/commits?top=500&api-version=7.1`)
      expect(l.grouping).toBe('native')
      expect(l.updates.map((u) => [u.index, u.kind, u.id, u.iteration])).toEqual([
        [1, 'opened', '1', 1],
        [2, 'push', '2', 2],
        [3, 'rewrite', '3', 3]
      ])
      expect(l.updates[0]).toMatchObject({ pusher: 'Ana Souza', headSha: sha('a1'), fromSha: sha('ba') })
      expect(l.updates[1]).toMatchObject({ pusher: 'Bruno Lima', fromSha: sha('a1'), headSha: sha('b2') })
      expect(tags(l, 0)).toEqual(['a1'])
      expect(tags(l, 1)).toEqual(['b2'])
      expect(tags(l, 2)).toEqual(['c3'])
      expect(l.updates[2].commitsTruncated).toBeUndefined()
      expect(l.truncated).toBe(false)
    })

    it('an update’s own changes: $compareTo the previous iteration, each file diffed between the two heads', async () => {
      routes = [
        [
          `${BASE}/iterations/3/changes`,
          { body: { changeEntries: [{ changeType: 'edit', item: { path: '/src/app.ts' } }] } }
        ],
        [
          'https://dev.azure.com/acme/proj/_apis/git/repositories/app/items?path=%2Fsrc%2Fapp.ts&versionDescriptor.version=' + sha('b2'),
          { body: { content: 'one\n' } }
        ],
        [
          'https://dev.azure.com/acme/proj/_apis/git/repositories/app/items?path=%2Fsrc%2Fapp.ts&versionDescriptor.version=' + sha('c3'),
          { body: { content: 'two\n' } }
        ]
      ]
      const files = await updateFiles(AZURE, { sha: sha('b2'), iteration: 2 }, { sha: sha('c3'), iteration: 3 })
      expect(asked[0]).toBe(`${BASE}/iterations/3/changes?$top=2000&$compareTo=2&api-version=7.1`)
      expect(files).toHaveLength(1)
      expect(files![0]).toMatchObject({ filename: 'src/app.ts', status: 'modified', additions: 1, deletions: 1 })
    })

    it('without the iterations, Azure cannot compare: null, and nothing asked', async () => {
      expect(await updateFiles(AZURE, { sha: sha('b2') }, { sha: sha('c3') })).toBeNull()
      expect(asked).toEqual([])
    })
  })

  describe('GitLab', () => {
    const MR = `${GITLAB}/api/v4/projects/team%2Fapp/merge_requests/7`
    const commit = (tag: string, parents: string[]): Record<string, unknown> => ({
      id: sha(tag),
      message: `Subject ${tag}`,
      author_name: 'Ana',
      authored_date: '2026-11-01T10:00:00Z',
      parent_ids: parents.map(sha)
    })

    it('versions give the heads, the MR’s commits the graph; a dropped head is read through its own version', async () => {
      routes = [
        [
          `${MR}/versions?per_page=100&page=1`,
          {
            body: [
              // Newest first, as GitLab lists them.
              { id: 13, head_commit_sha: sha('x9'), base_commit_sha: sha('ba'), created_at: '2026-11-03T10:00:00Z' },
              { id: 12, head_commit_sha: sha('b2'), base_commit_sha: sha('ba'), created_at: '2026-11-02T10:00:00Z' },
              { id: 11, head_commit_sha: sha('a1'), base_commit_sha: sha('ba'), created_at: '2026-11-01T10:00:00Z' }
            ]
          }
        ],
        // b2 was amended away: the MR now has a1 → x9.
        [`${MR}/commits?per_page=100&page=1`, { body: [commit('x9', ['a1']), commit('a1', ['ba'])] }],
        [`${MR}/versions/12`, { body: { commits: [commit('b2', ['a1']), commit('a1', ['ba'])] } }]
      ]
      const l = await updates(`${GITLAB}/team/app.git`)
      expect(asked).toContain(`${MR}/versions/12`)
      expect(asked.filter((u) => u.includes('/versions/'))).toHaveLength(1)
      expect(l.updates.map((u) => [u.id, u.kind])).toEqual([
        ['11', 'opened'],
        ['12', 'push'],
        ['13', 'rewrite']
      ])
      expect(l.updates[0].fromSha).toBe(sha('ba'))
      expect(tags(l, 1)).toEqual(['b2'])
      expect(tags(l, 2)).toEqual(['x9'])
      expect(l.updates[2].removed.map((c) => c.sha)).toEqual([sha('b2')])
      expect(l.truncated).toBe(false)
    })

    it('compares the two trees directly (straight)', async () => {
      routes = [
        [
          `${GITLAB}/api/v4/projects/team%2Fapp/repository/compare`,
          { body: { diffs: [{ old_path: 'a.ts', new_path: 'a.ts', new_file: false, renamed_file: false, deleted_file: false, diff: '@@ -1 +1 @@\n-a\n+b\n' }] } }
        ]
      ]
      const files = await updateFiles(`${GITLAB}/team/app.git`, { sha: sha('a1') }, { sha: sha('b2') })
      expect(asked[0]).toBe(`${GITLAB}/api/v4/projects/team%2Fapp/repository/compare?from=${sha('a1')}&to=${sha('b2')}&straight=true`)
      expect(files).toEqual([{ filename: 'a.ts', status: 'modified', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-a\n+b\n' }])
    })
  })

  describe('Bitbucket Data Center', () => {
    const PR = `${BBS}/rest/api/latest/projects/PROJ/repos/app/pull-requests/7`
    const c = (tag: string, parent?: string): Record<string, unknown> => ({
      id: sha(tag),
      message: `Subject ${tag}`,
      author: { name: 'ana', displayName: 'Ana Souza' },
      authorTimestamp: 1762000000000,
      ...(parent ? { parents: [{ id: sha(parent) }] } : {})
    })

    it('OPENED plus the RESCOPEs that moved the source; a target-only rescope is no push', async () => {
      routes = [
        [
          `${PR}/activities`,
          {
            body: {
              isLastPage: true,
              values: [
                {
                  id: 40,
                  action: 'RESCOPED',
                  createdDate: 1762300000000,
                  user: { name: 'ana', displayName: 'Ana Souza' },
                  fromHash: sha('x9'),
                  previousFromHash: sha('b2'),
                  added: { commits: [c('x9', 'a1')], total: 1 },
                  removed: { commits: [c('b2', 'a1')], total: 3 }
                },
                // The target moved: same source head.
                { id: 35, action: 'RESCOPED', createdDate: 1762250000000, fromHash: sha('b2'), previousFromHash: sha('b2') },
                {
                  id: 30,
                  action: 'RESCOPED',
                  createdDate: 1762200000000,
                  user: { name: 'bruno', displayName: 'Bruno Lima' },
                  fromHash: sha('b2'),
                  previousFromHash: sha('a1'),
                  added: { commits: [c('b2', 'a1')], total: 1 },
                  removed: { commits: [], total: 0 }
                },
                { id: 10, action: 'COMMENTED', createdDate: 1762150000000 },
                { id: 1, action: 'OPENED', createdDate: 1762100000000, user: { name: 'ana', displayName: 'Ana Souza' } }
              ]
            }
          }
        ],
        [`${PR}/commits`, { body: { isLastPage: true, values: [c('x9', 'a1'), c('a1')] } }]
      ]
      const l = await updates(`${BBS}/scm/proj/app.git`)
      expect(asked).toContain(`${PR}/activities?start=0&limit=100`)
      expect(l.updates.map((u) => [u.id, u.kind, u.pusher])).toEqual([
        ['activity:1', 'opened', 'Ana Souza'],
        ['activity:30', 'push', 'Bruno Lima'],
        ['activity:40', 'rewrite', 'Ana Souza']
      ])
      // The opening: a1, still listed, and never added by a rescope; its head is the first push's "before".
      expect(tags(l, 0)).toEqual(['a1'])
      expect(l.updates[0].headSha).toBe(sha('a1'))
      expect(l.updates[2]).toMatchObject({ fromSha: sha('b2'), headSha: sha('x9'), commitsTruncated: true })
      expect(l.updates[2].removed.map((x) => x.sha)).toEqual([sha('b2')])
      expect(l.truncated).toBe(false)
    })

    it('a capped activity walk is reported as truncated', async () => {
      // Every page says there is another: the ten-page cap, not the server, ends the walk.
      routes = Array.from({ length: 10 }, (_, i): [string, Answer] => [
        `${PR}/activities?start=${i * 100}&limit=100`,
        { body: { isLastPage: false, nextPageStart: (i + 1) * 100, values: [] } }
      ])
      const l = await updates(`${BBS}/scm/proj/app.git`)
      expect(l.updates[0].kind).toBe('opened')
      expect(asked.filter((u) => u.includes('/activities'))).toHaveLength(10)
      expect(l.truncated).toBe(true)
    })

    it('compares with the new head as `from`, as the server reads it', async () => {
      routes = [[`${BBS}/rest/api/latest/projects/PROJ/repos/app/compare/diff`, { body: { diffs: [] } }]]
      expect(await updateFiles(`${BBS}/scm/proj/app.git`, { sha: sha('a1') }, { sha: sha('b2') })).toEqual([])
      expect(asked[0]).toBe(`${BBS}/rest/api/latest/projects/PROJ/repos/app/compare/diff?from=${sha('b2')}&to=${sha('a1')}&contextLines=3`)
    })
  })

  describe('GitHub', () => {
    const GRAPHQL = 'https://api.github.com/graphql'
    const node = (tag: string, at: string): Record<string, unknown> => ({
      __typename: 'PullRequestCommit',
      commit: {
        oid: sha(tag),
        message: `Subject ${tag}`,
        committedDate: at,
        authoredDate: at,
        parents: { nodes: [] },
        author: { name: 'Ana', user: { login: 'ana', avatarUrl: 'https://avatars.example.com/ana' } }
      }
    })
    const answer = (nodes: unknown[], hasNextPage = false): Answer => ({
      body: {
        data: {
          repository: {
            pullRequest: {
              createdAt: '2026-11-01T10:00:00Z',
              author: { login: 'ana' },
              timelineItems: { pageInfo: { hasNextPage, endCursor: hasNextPage ? 'c1' : null }, nodes }
            }
          }
        }
      }
    })

    it('one GraphQL read of commits and force pushes, grouped approximately', async () => {
      routes = [
        [
          GRAPHQL,
          answer([
            node('a1', '2026-11-01T09:00:00Z'),
            node('b2', '2026-11-02T09:00:00Z'),
            {
              __typename: 'HeadRefForcePushedEvent',
              createdAt: '2026-11-03T10:00:00Z',
              actor: { login: 'bruno' },
              beforeCommit: { oid: sha('b2') },
              afterCommit: { oid: sha('r5') }
            }
          ])
        ]
      ]
      const l = await updates(GITHUB)
      expect(asked).toEqual([GRAPHQL])
      expect(posted[0]).toContain('HEAD_REF_FORCE_PUSHED_EVENT')
      expect(JSON.parse(posted[0]).variables).toEqual({ owner: 'team', repo: 'app', number: 7, after: null })
      expect(l.grouping).toBe('approximate')
      expect(l.updates.map((u) => u.kind)).toEqual(['opened', 'push', 'rewrite'])
      expect(l.updates[2]).toMatchObject({ pusher: 'bruno', fromSha: sha('b2'), headSha: sha('r5'), added: [] })
      expect(l.truncated).toBe(false)
    })

    it('stops after five pages and says so', async () => {
      routes = [[GRAPHQL, answer([node('a1', '2026-11-01T09:00:00Z')], true)]]
      const l = await updates(GITHUB)
      expect(asked).toHaveLength(5)
      expect(l.truncated).toBe(true)
    })

    it('compares through the compare API, three dots', async () => {
      routes = [
        [
          'https://api.github.com/repos/team/app/compare/',
          { body: { files: [{ filename: 'b.ts', status: 'renamed', additions: 0, deletions: 0, previous_filename: 'a.ts' }] } }
        ]
      ]
      const files = await updateFiles(GITHUB, { sha: sha('a1') }, { sha: sha('b2') })
      expect(asked[0]).toBe(`https://api.github.com/repos/team/app/compare/${sha('a1')}...${sha('b2')}?per_page=1&page=1`)
      expect(files).toEqual([{ filename: 'b.ts', status: 'renamed', additions: 0, deletions: 0, previousFilename: 'a.ts' }])
    })

    it('refuses anything but a full commit id before it reaches a URL', async () => {
      await expect(updateFiles(GITHUB, { sha: 'main' }, { sha: sha('b2') })).rejects.toThrow(/full commit id/)
      await expect(updateFiles(GITHUB, { sha: sha('a1') }, { sha: `${sha('b2')}/../x` })).rejects.toThrow(/full commit id/)
      expect(asked).toEqual([])
    })
  })

  describe('Forgejo', () => {
    const REPO = `${FORGEJO}/api/v1/repos/team/app`
    const fjCommit = (tag: string, parents: string[]): Record<string, unknown> => ({
      sha: sha(tag),
      commit: { message: `Subject ${tag}`, author: { name: 'Ana', date: '2026-11-01T10:00:00Z' } },
      parents: parents.map((p) => ({ sha: sha(p) }))
    })

    it('pull_push comments: what they add, a force push’s heads, and the opening from the rest', async () => {
      routes = [
        [`${REPO}/pulls/7`, { body: { created_at: '2026-11-01T10:00:00Z', user: { login: 'ana' } } }],
        [`${REPO}/pulls/7/commits`, { body: [fjCommit('a1', []), fjCommit('b2', ['a1'])], headers: { 'x-total-count': '2' } }],
        [
          `${REPO}/issues/7/timeline`,
          {
            body: [
              { id: 3, type: 'comment', body: 'Looks good', created_at: '2026-11-01T12:00:00Z' },
              {
                id: 5,
                type: 'pull_push',
                body: JSON.stringify({ is_force_push: false, commit_ids: [sha('b2')] }),
                created_at: '2026-11-02T10:00:00Z',
                user: { login: 'bruno' }
              },
              {
                id: 8,
                type: 'pull_push',
                body: JSON.stringify({ is_force_push: true, commit_ids: [sha('b2'), sha('c3')] }),
                created_at: '2026-11-03T10:00:00Z',
                user: { login: 'bruno' }
              }
            ],
            headers: { 'x-total-count': '3' }
          }
        ]
      ]
      const l = await updates(`${FORGEJO}/team/app.git`)
      expect(asked).toContain(`${REPO}/issues/7/timeline?limit=50&page=1`)
      expect(l.grouping).toBe('native')
      expect(l.updates.map((u) => [u.id, u.kind, u.pusher])).toEqual([
        ['opened', 'opened', 'ana'],
        ['comment:5', 'push', 'bruno'],
        ['comment:8', 'rewrite', 'bruno']
      ])
      expect(tags(l, 0)).toEqual(['a1'])
      expect(tags(l, 1)).toEqual(['b2'])
      expect(l.updates[2]).toMatchObject({ fromSha: sha('b2'), headSha: sha('c3') })
    })

    it('a server without the timeline gets one update, marked single', async () => {
      routes = [
        [`${REPO}/pulls/7`, { body: { created_at: '2026-11-01T10:00:00Z' } }],
        [`${REPO}/pulls/7/commits`, { body: [fjCommit('a1', [])], headers: { 'x-total-count': '1' } }],
        [`${REPO}/issues/7/timeline`, { status: 404, body: { message: 'Not Found' } }]
      ]
      const l = await updates(`${FORGEJO}/team/app.git`)
      expect(l.grouping).toBe('single')
      expect(l.updates).toHaveLength(1)
      expect(tags(l, 0)).toEqual(['a1'])
    })

    it('has no two-commit diff in its API: null, and nothing asked', async () => {
      expect(await updateFiles(`${FORGEJO}/team/app.git`, { sha: sha('a1') }, { sha: sha('b2') })).toBeNull()
      expect(asked).toEqual([])
    })
  })

  it('bitbucket.org: unsupported, without a request', async () => {
    expect(await updates(BB_CLOUD)).toEqual({ updates: [], truncated: false, grouping: 'unsupported' })
    expect(await updateFiles(BB_CLOUD, { sha: sha('a1') }, { sha: sha('b2') })).toBeNull()
    expect(asked).toEqual([])
  })
})
