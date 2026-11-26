import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings, type PrCommitList } from '../src/shared/types'

// A pull request's commits, per host: the URL each one is asked, how far it
// pages, how its answer maps onto PrCommit, and that the tab always gets them
// oldest first. The real IPC handler runs against a fake fetch and a real
// settings file.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-pr-commits-'))
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

/** [URL prefix, answer]. The longest matching prefix answers; anything else is 200 {}. */
type Answer = { status?: number; body: unknown; headers?: Record<string, string> }
let routes: Array<[string, Answer]> = []
const asked: string[] = []

const list = (remote: string): Promise<PrCommitList> =>
  Promise.resolve().then(() => handlers.get('hosting:prListCommits')!({}, '', remote, {}, 7) as Promise<PrCommitList>)

/** Full 40-hex shas from a short tag, so the shapes are the hosts' own. */
const sha = (tag: string): string => tag.padEnd(40, '0')
const subjects = (l: PrCommitList): string[] => l.commits.map((c) => c.subject)

describe('a pull request’s commits — main', () => {
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
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        asked.push(url)
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
  })
  afterAll(() => vi.unstubAllGlobals())

  describe('GitHub', () => {
    const URL = 'https://api.github.com/repos/team/app/pulls/7/commits'
    const gh = (tag: string, parents: string[], extra: Record<string, unknown> = {}): Record<string, unknown> => ({
      sha: sha(tag),
      commit: { message: `Subject ${tag}\n\nBody of ${tag}.\n`, author: { name: `Ana ${tag}`, date: '2026-11-02T10:00:00Z' } },
      author: { login: 'ana', avatar_url: 'https://avatars.example.com/ana' },
      parents: parents.map((p) => ({ sha: sha(p) })),
      ...extra
    })

    it('one page of 100: subject, body, author, login, avatar and parents mapped, oldest first', async () => {
      routes = [[URL, { body: [gh('a1', ['f0']), gh('b2', ['a1', 'e9'], { author: null })] }]]
      const l = await list(GITHUB)
      expect(asked).toEqual([`${URL}?per_page=100&page=1`])
      expect(l.truncated).toBe(false)
      expect(l.commits[0]).toEqual({
        sha: sha('a1'),
        shortSha: sha('a1').slice(0, 7),
        subject: 'Subject a1',
        body: 'Body of a1.',
        authorName: 'Ana a1',
        authorLogin: 'ana',
        authorAvatar: 'https://avatars.example.com/ana',
        authoredAt: '2026-11-02T10:00:00Z',
        parents: 1
      })
      // A commit whose email matched no account has no login; a merge has two parents.
      expect(l.commits[1]).toMatchObject({ authorName: 'Ana b2', parents: 2 })
      expect(l.commits[1].authorLogin).toBeUndefined()
    })

    const fullPages = (total: number): Array<[string, Answer]> => {
      const page = (n: number, from: number): Record<string, unknown>[] =>
        Array.from({ length: n }, (_, i) => gh(`c${from + i}`, from + i ? [`c${from + i - 1}`] : []))
      return [
        [`${URL}?per_page=100&page=1`, { body: page(100, 0) }],
        [`${URL}?per_page=100&page=2`, { body: page(100, 100) }],
        [`${URL}?per_page=100&page=3`, { body: page(50, 200) }],
        ['https://api.github.com/repos/team/app/pulls/7', { body: { commits: total } }]
      ]
    }

    it('pages to GitHub’s 250; the PR’s own count says whether there are more', async () => {
      routes = fullPages(312)
      const l = await list(GITHUB)
      expect(asked).toHaveLength(4)
      expect(asked[3]).toBe('https://api.github.com/repos/team/app/pulls/7')
      expect(l.commits).toHaveLength(250)
      expect(l).toMatchObject({ truncated: true, kept: 'oldest' })
      expect(l.commits[0].subject).toBe('Subject c0')
    })

    it('a pull request of exactly 250 commits is not truncated', async () => {
      routes = fullPages(250)
      expect((await list(GITHUB)).truncated).toBe(false)
    })

    it('under 250 the count is not asked', async () => {
      routes = [[URL, { body: [gh('a1', ['f0'])] }]]
      await list(GITHUB)
      expect(asked).toEqual([`${URL}?per_page=100&page=1`])
    })
  })

  describe('GitLab', () => {
    const URL = `${GITLAB}/api/v4/projects/team%2Fapp/merge_requests/7/commits`
    it('newest first from the host, oldest first to the tab', async () => {
      routes = [
        [
          URL,
          {
            body: [
              { id: sha('b2'), title: 'second', message: 'second\n', author_name: 'Sam', authored_date: '2026-11-03T09:00:00+02:00', parent_ids: [sha('a1')] },
              { id: sha('a1'), title: 'first', message: 'first\n\nwhy', author_name: 'Sam', authored_date: '2026-11-02T09:00:00+02:00', parent_ids: [sha('f0')] }
            ]
          }
        ]
      ]
      const l = await list(`${GITLAB}/team/app.git`)
      expect(asked).toEqual([`${URL}?per_page=100&page=1`])
      expect(subjects(l)).toEqual(['first', 'second'])
      expect(l.commits[0]).toMatchObject({ body: 'why', authorName: 'Sam', parents: 1 })
      expect(l.commits[0].authorLogin).toBeUndefined()
    })

    it('past the cap is truncated: three pages of 100, the 250 most recent kept', async () => {
      const page = (from: number): Record<string, unknown>[] =>
        Array.from({ length: 100 }, (_, i) => ({ id: sha(`d${from + i}`), message: `m${from + i}`, author_name: 'Sam', authored_date: '2026-11-02T09:00:00Z' }))
      routes = [
        [`${URL}?per_page=100&page=1`, { body: page(0) }],
        [`${URL}?per_page=100&page=2`, { body: page(100) }],
        [`${URL}?per_page=100&page=3`, { body: page(200) }]
      ]
      const l = await list(`${GITLAB}/team/app.git`)
      expect(asked).toHaveLength(3)
      expect(l.commits).toHaveLength(250)
      // GitLab lists newest first, so the cap kept the most recent — d0 is the newest.
      expect(l).toMatchObject({ truncated: true, kept: 'newest' })
      expect(l.commits[249].subject).toBe('m0')
    })
  })

  describe('Azure DevOps', () => {
    const URL = 'https://dev.azure.com/acme/proj/_apis/git/repositories/app/pullrequests/7/commits'
    it('one request for one more than the cap; newest first becomes oldest first', async () => {
      routes = [
        [
          URL,
          {
            body: {
              count: 2,
              value: [
                { commitId: sha('b2'), comment: 'Second', author: { name: 'Lee', date: '2026-11-04T08:00:00Z' } },
                { commitId: sha('a1'), comment: 'First\n\nBody', author: { name: 'Lee', date: '2026-11-03T08:00:00Z' } }
              ]
            }
          }
        ]
      ]
      const l = await list(AZURE)
      expect(asked).toEqual([`${URL}?$top=251&api-version=7.1`])
      expect(subjects(l)).toEqual(['First', 'Second'])
      expect(l.commits[0]).toMatchObject({ body: 'Body', authorName: 'Lee' })
      // Azure's listing names no parents.
      expect(l.commits[0].parents).toBeUndefined()
      expect(l.truncated).toBe(false)
    })

    const az = (tag: string): Record<string, unknown> => ({ commitId: sha(tag), comment: tag, author: { name: 'Lee', date: '2026-11-03T08:00:00Z' } })

    it('follows x-ms-continuationtoken, with the same $top, until it stops', async () => {
      const first = `${URL}?$top=251&api-version=7.1`
      const second = `${first}&continuationToken=next%2B1`
      routes = [
        [first, { body: { value: [az('c3'), az('b2')] }, headers: { 'x-ms-continuationtoken': 'next+1' } }],
        [second, { body: { value: [az('a1')] } }]
      ]
      const l = await list(AZURE)
      expect(asked).toEqual([first, second])
      expect(subjects(l)).toEqual(['a1', 'b2', 'c3'])
      expect(l.truncated).toBe(false)
    })

    it('a page of exactly 100 with no token, under the $top asked, reads as a cap: truncated', async () => {
      routes = [[URL, { body: { value: Array.from({ length: 100 }, (_, i) => az(`e${i}`)) } }]]
      const l = await list(AZURE)
      expect(l.commits).toHaveLength(100)
      expect(l).toMatchObject({ truncated: true, kept: 'newest' })
    })

    it('a token still there at the cap is truncated', async () => {
      routes = [
        [
          URL,
          { body: { value: Array.from({ length: 251 }, (_, i) => az(`f${i}`)) }, headers: { 'x-ms-continuationtoken': 'more' } }
        ]
      ]
      const l = await list(AZURE)
      expect(asked).toHaveLength(1)
      expect(l.commits).toHaveLength(250)
      expect(l.truncated).toBe(true)
    })
  })

  describe('Forgejo', () => {
    const URL = `${FORGEJO}/api/v1/repos/team/app/pulls/7/commits?verification=false&files=false`
    const fj = (tag: string, parent: string): Record<string, unknown> => ({
      sha: sha(tag),
      commit: { message: `Do ${tag}`, author: { name: 'Kai', date: '2026-11-05T12:00:00Z' } },
      author: { login: 'kai', avatar_url: 'https://git.example.corp/avatars/kai' },
      parents: [{ sha: sha(parent) }]
    })

    it('verification and files off; X-Total-Count ends the walk; the parents settle the order', async () => {
      routes = [
        [`${URL}&limit=50&page=1`, { body: [fj('c3', 'b2'), fj('b2', 'a1')], headers: { 'x-total-count': '3' } }],
        [`${URL}&limit=50&page=2`, { body: [fj('a1', 'f0')], headers: { 'x-total-count': '3' } }]
      ]
      const l = await list(`${FORGEJO}/team/app.git`)
      expect(asked).toEqual([`${URL}&limit=50&page=1`, `${URL}&limit=50&page=2`])
      // Listed newest first here, so the parents turn it around.
      expect(subjects(l)).toEqual(['Do a1', 'Do b2', 'Do c3'])
      expect(l.commits[0]).toMatchObject({ authorLogin: 'kai', authorAvatar: 'https://git.example.corp/avatars/kai' })
      expect(l.truncated).toBe(false)
    })
  })

  describe('Bitbucket Data Center', () => {
    const URL = `${BBS}/rest/api/latest/projects/PROJ/repos/app/pull-requests/7/commits`
    it('paged by start/limit, millisecond timestamps, newest first turned around', async () => {
      routes = [
        [
          `${URL}?start=0`,
          {
            body: {
              values: [
                { id: sha('b2'), message: 'Second', author: { name: 'jo', displayName: 'Jo Doe', slug: 'jo' }, authorTimestamp: Date.UTC(2026, 10, 6), parents: [{ id: sha('a1') }] }
              ],
              isLastPage: false,
              nextPageStart: 1
            }
          }
        ],
        [
          `${URL}?start=1`,
          {
            body: {
              values: [{ id: sha('a1'), message: 'First', author: { name: 'jo' }, authorTimestamp: Date.UTC(2026, 10, 5), parents: [{ id: sha('f0') }] }],
              isLastPage: true
            }
          }
        ]
      ]
      const l = await list(`${BBS}/scm/proj/app.git`)
      expect(asked).toEqual([`${URL}?start=0&limit=50`, `${URL}?start=1&limit=50`])
      expect(subjects(l)).toEqual(['First', 'Second'])
      expect(l.commits[1]).toMatchObject({ authorName: 'Jo Doe', authorLogin: 'jo', authoredAt: '2026-11-06T00:00:00.000Z' })
      expect(l.truncated).toBe(false)
    })
  })

  describe('bitbucket.org', () => {
    const URL = 'https://api.bitbucket.org/2.0/repositories/team/app/pullrequests/7/commits?pagelen=50'
    const bb = (tag: string, parent: string): Record<string, unknown> => ({
      hash: sha(tag),
      message: `Change ${tag}\n`,
      date: '2026-11-07T10:00:00+00:00',
      author: { raw: 'Rui Lima <rui@example.com>' },
      parents: [{ hash: sha(parent) }]
    })

    it('follows `next` on the API only; the name is taken from `raw` without the email', async () => {
      const next = 'https://api.bitbucket.org/2.0/repositories/team/app/pullrequests/7/commits?pagelen=50&page=2'
      routes = [
        [URL, { body: { values: [bb('b2', 'a1')], next } }],
        [next, { body: { values: [bb('a1', 'f0')], next: 'https://elsewhere.example.com/steal' } }]
      ]
      const l = await list(BB_CLOUD)
      expect(asked).toEqual([URL, next])
      expect(subjects(l)).toEqual(['Change a1', 'Change b2'])
      expect(l.commits[0].authorName).toBe('Rui Lima')
      // A `next` off the API is not followed, and nothing says the list ended: truncated.
      expect(l.truncated).toBe(true)
    })

    it('a redirect is followed only while it stays on api.bitbucket.org', async () => {
      const moved = 'https://api.bitbucket.org/2.0/repositories/team/app/commits?include=x&exclude=y'
      routes = [
        [URL, { status: 302, body: {}, headers: { location: moved } }],
        [moved, { body: { values: [bb('a1', 'f0')] } }]
      ]
      expect(subjects(await list(BB_CLOUD))).toEqual(['Change a1'])
      routes = [[URL, { status: 302, body: {}, headers: { location: 'https://elsewhere.example.com/x' } }]]
      await expect(list(BB_CLOUD)).rejects.toThrow(/302/)
      expect(asked.some((u) => u.startsWith('https://elsewhere'))).toBe(false)
    })
  })

  describe('a message is a subject and a body', () => {
    it('CRLF, blank lines and a message with no body', async () => {
      const { splitCommitMessage } = await import('../src/shared/prCommits')
      expect(splitCommitMessage('Fix it\r\n\r\nBecause.\r\n')).toEqual({ subject: 'Fix it', body: 'Because.' })
      expect(splitCommitMessage('Only a subject\n')).toEqual({ subject: 'Only a subject' })
      expect(splitCommitMessage(undefined)).toEqual({ subject: '' })
    })

    it('a tie in what the parents say falls back to the documented order', async () => {
      const { isListedNewestFirst } = await import('../src/shared/prCommits')
      // b's parent a comes before it, d's parent c after it: one vote each way.
      const tie = [{ sha: 'a' }, { sha: 'b', parentShas: ['a'] }, { sha: 'd', parentShas: ['c'] }, { sha: 'c' }]
      expect(isListedNewestFirst(tie, true)).toBe(true)
      expect(isListedNewestFirst(tie, false)).toBe(false)
    })

    it('a merge commit: its second parent off the list does not sway the order', async () => {
      const { orderOldestFirst, finishPrCommits } = await import('../src/shared/prCommits')
      // Newest first: the merge m (parents b and x, x not in the PR), then b, then a.
      const listed = [
        { sha: 'm', parentShas: ['b', 'x'] },
        { sha: 'b', parentShas: ['a'] },
        { sha: 'a', parentShas: ['root'] }
      ]
      expect(orderOldestFirst(listed, false).map((c) => c.sha)).toEqual(['a', 'b', 'm'])
      const l = finishPrCommits(
        listed.map((c) => ({ ...c, message: c.sha, authorName: 'Ana', authoredAt: '2026-11-01T00:00:00Z' })),
        false,
        false
      )
      expect(l.commits.map((c) => [c.subject, c.parents])).toEqual([
        ['a', 1],
        ['b', 1],
        ['m', 2]
      ])
      expect(l.kept).toBe('newest')
    })

    it('without parents the host’s documented order decides; a non-https avatar is dropped', async () => {
      const { orderOldestFirst, toPrCommit } = await import('../src/shared/prCommits')
      const two = [{ sha: 'b' }, { sha: 'a' }]
      expect(orderOldestFirst(two, true).map((c) => c.sha)).toEqual(['a', 'b'])
      expect(orderOldestFirst(two, false).map((c) => c.sha)).toEqual(['b', 'a'])
      // Parents beat the documented order when they say otherwise.
      expect(orderOldestFirst([{ sha: 'a' }, { sha: 'b', parentShas: ['a'] }], true).map((c) => c.sha)).toEqual(['a', 'b'])
      const c = toPrCommit({ sha: sha('a1'), message: 'x', authorName: '', authorLogin: 'ana', authorAvatar: 'http://plain/ana', authoredAt: 0 })
      expect(c.authorName).toBe('ana')
      expect(c.authorAvatar).toBeUndefined()
      expect(c.authoredAt).toBe('1970-01-01T00:00:00.000Z')
    })
  })
})
