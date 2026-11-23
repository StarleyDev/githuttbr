import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings, type CreatePrResult, type PrPickerOptions } from '../src/shared/types'

// Reviewers, assignees and labels on a new pull request, per host, through the
// real IPC handlers against a fake fetch and a real settings file: which
// endpoints the dialog's choices come from, what a create with picks sends,
// that a create with none sends exactly what it always did, and that a pick the
// host refuses is reported on a PR that still counts as created.

const dir = mkdtempSync(join(tmpdir(), 'githuttbr-pr-picker-'))
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

const GHES = 'https://github.example.corp'
const GITLAB = 'https://gitlab.example.corp'
const BBS = 'https://bitbucket.example.corp'
const T = { com: 'tok-github', ghes: 'tok-ghes', gitlab: 'tok-gitlab', bb: 'tok-bitbucket', bbs: 'tok-bbs', azure: 'tok-azure' }

const REMOTE = {
  github: 'https://github.com/team/app.git',
  ghes: `${GHES}/team/app.git`,
  gitlab: `${GITLAB}/group/sub/app.git`,
  azure: 'https://dev.azure.com/acme/My%20Project/_git/app',
  bitbucket: 'https://bitbucket.org/ws/app.git',
  bbs: `${BBS}/scm/proj/app.git`
}

interface Call {
  method: string
  url: string
  body?: unknown
}
const calls: Call[] = []

type Reply = Response | Record<string, unknown> | unknown[] | undefined
/** Per-test answers: the first matcher that answers wins; anything else gets `{}`. */
let route: (method: string, url: URL, body: unknown) => Reply = () => undefined

const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })

const BASE = { title: 'T', body: 'B', source: 'feature', target: 'main', draft: false }
const call = <R>(channel: string, remote: string, ...args: unknown[]): Promise<R> =>
  Promise.resolve(handlers.get(channel)!({}, '', remote, { github: T.com, bitbucket: T.bb, azure: T.azure }, ...args)) as Promise<R>
const options = (remote: string): Promise<PrPickerOptions> => call('hosting:prPickerOptions', remote)
const create = (remote: string, extra: Record<string, unknown> = {}): Promise<CreatePrResult> =>
  call('hosting:createPR', remote, { ...BASE, ...extra })

const users = (prefix: string, n: number, from = 0): Array<{ login: string; avatar_url: string }> =>
  Array.from({ length: n }, (_, i) => ({ login: `${prefix}${from + i}`, avatar_url: `https://avatars.example/${prefix}${from + i}` }))

beforeAll(async () => {
  writeFileSync(join(dir, 'githuttbr-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
  const base = defaultSettings()
  writeFileSync(
    join(dir, 'githuttbr-settings.json'),
    JSON.stringify({
      ...base,
      onboardingCompleted: true,
      profiles: [
        {
          ...base.profiles[0],
          githubToken: T.com,
          githubEnterprise: [{ url: GHES, token: T.ghes }],
          gitlabServers: [{ url: GITLAB, token: T.gitlab }],
          bitbucketToken: T.bb,
          bitbucketServers: [{ url: BBS, token: T.bbs, username: 'me' }],
          azureToken: T.azure,
          azureOrg: 'acme'
        }
      ]
    })
  )
  const { readSettings } = await import('../src/main/settings')
  await readSettings()
  const { registerHostingHandlers } = await import('../src/main/hosting')
  registerHostingHandlers()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ method, url, ...(body !== undefined ? { body } : {}) })
      const r = route(method, new URL(url), body)
      if (r instanceof Response) return r
      return json(r ?? {})
    })
  )
})
afterEach(() => {
  calls.length = 0
  route = () => undefined
})
afterAll(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

describe('GitHub', () => {
  const API = 'https://api.github.com/repos/team/app'
  const created = (): Reply => ({ number: 12, html_url: 'https://github.com/team/app/pull/12' })

  it('a create with no picks sends today’s request and nothing else', async () => {
    route = (m, u) => (m === 'POST' && u.pathname.endsWith('/pulls') ? created() : undefined)
    const res = await create(REMOTE.github, { reviewers: [], assignees: [' '], labels: [] })
    expect(res).toEqual({ number: 12, url: 'https://github.com/team/app/pull/12' })
    expect(calls).toEqual([{ method: 'POST', url: `${API}/pulls`, body: { title: 'T', head: 'feature', base: 'main', body: 'B', draft: false } }])
  })

  it('applies reviewers, assignees and labels after creating, each on its endpoint', async () => {
    route = (m, u) => (m === 'POST' && u.pathname.endsWith('/pulls') ? created() : undefined)
    const res = await create(REMOTE.github, { reviewers: ['ana', 'ana'], assignees: ['bob'], labels: ['bug', 'ui'] })
    expect(res.metaFailed).toBeUndefined()
    expect(calls[0].body).toEqual({ title: 'T', head: 'feature', base: 'main', body: 'B', draft: false })
    const rest = calls.slice(1).map((c) => [c.method, c.url, c.body])
    expect(rest).toEqual(
      expect.arrayContaining([
        ['POST', `${API}/pulls/12/requested_reviewers`, { reviewers: ['ana'] }],
        ['POST', `${API}/issues/12/assignees`, { assignees: ['bob'] }],
        ['POST', `${API}/issues/12/labels`, { labels: ['bug', 'ui'] }]
      ])
    )
    expect(rest).toHaveLength(3)
  })

  it('a refused pick still leaves a created PR, and names what failed', async () => {
    route = (m, u) => {
      if (m === 'POST' && u.pathname.endsWith('/pulls')) return created()
      if (u.pathname.endsWith('/requested_reviewers')) return json({ message: 'Review cannot be requested from pull request author.' }, 422)
      return undefined
    }
    const res = await create(REMOTE.github, { reviewers: ['me'], labels: ['bug'] })
    expect(res.number).toBe(12)
    expect(res.metaFailed).toEqual(['reviewers'])
  })

  it('reads every page of assignable users and labels, and leaves the author out of reviewers', async () => {
    route = (_m, u) => {
      const page = Number(u.searchParams.get('page'))
      if (u.pathname === '/user') return { login: 'me' }
      if (u.pathname.endsWith('/assignees')) return page === 1 ? [{ login: 'me' }, ...users('u', 99)] : users('u', 1, 99)
      if (u.pathname.endsWith('/labels')) return [{ name: 'ui', color: 'A2EEEF' }, { name: 'Bug', color: 'd73a4a' }, { name: 'x', color: 'nope' }]
      return undefined
    }
    const o = await options(REMOTE.github)
    expect(o.supports).toEqual({ reviewers: true, assignees: true, labels: true })
    expect(o.failed).toEqual([])
    expect(o.assignees).toHaveLength(101)
    expect(o.assignees[0]).toEqual({ id: 'me', login: 'me' })
    expect(o.assignees[1]).toEqual({ id: 'u0', login: 'u0', avatarUrl: 'https://avatars.example/u0' })
    expect(o.reviewers).toHaveLength(100)
    expect(o.reviewers.some((p) => p.login === 'me')).toBe(false)
    expect(o.labels).toEqual([
      { id: 'Bug', name: 'Bug', color: '#d73a4a' },
      { id: 'ui', name: 'ui', color: '#a2eeef' },
      { id: 'x', name: 'x' }
    ])
    // The people list is walked once, for both fields.
    expect(calls.filter((c) => c.url.includes('/assignees')).map((c) => c.url)).toEqual([
      `${API}/assignees?per_page=100&page=1`,
      `${API}/assignees?per_page=100&page=2`
    ])
  })

  it('a list the token may not read fails alone', async () => {
    route = (_m, u) => {
      if (u.pathname.endsWith('/labels')) return json({ message: 'Forbidden' }, 403)
      if (u.pathname.endsWith('/assignees')) return [{ login: 'ana' }]
      return undefined
    }
    const o = await options(REMOTE.github)
    expect(o.failed).toEqual(['labels'])
    expect(o.reviewers.map((p) => p.id)).toEqual(['ana'])
  })

  it('an Enterprise Server is asked on its own API, with its own token', async () => {
    route = (_m, u) => (u.pathname.endsWith('/assignees') ? [{ login: 'ana' }] : u.pathname.endsWith('/labels') ? [] : undefined)
    const o = await options(REMOTE.ghes)
    expect(o.assignees.map((p) => p.id)).toEqual(['ana'])
    for (const c of calls) expect(c.url.startsWith(`${GHES}/api/v3/`)).toBe(true)
  })
})

describe('GitLab (self-managed)', () => {
  const PROJECT = `${GITLAB}/api/v4/projects/${encodeURIComponent('group/sub/app')}`
  const mr = (extra: Record<string, unknown> = {}): Reply => ({ iid: 5, web_url: `${GITLAB}/group/sub/app/-/merge_requests/5`, ...extra })

  it('a create with no picks sends today’s body', async () => {
    route = (m) => (m === 'POST' ? mr() : undefined)
    const res = await create(REMOTE.gitlab)
    expect(res).toEqual({ number: 5, url: `${GITLAB}/group/sub/app/-/merge_requests/5` })
    expect(calls).toEqual([
      { method: 'POST', url: `${PROJECT}/merge_requests`, body: { source_branch: 'feature', target_branch: 'main', title: 'T', description: 'B' } }
    ])
  })

  it('sends reviewer_ids, assignee_ids and labels on the create itself', async () => {
    route = (m) =>
      m === 'POST' ? mr({ reviewers: [{ id: 7 }], assignees: [{ id: 8 }, { id: 9 }], labels: ['bug', 'ui'] }) : undefined
    const res = await create(REMOTE.gitlab, { reviewers: ['7'], assignees: ['8', '9'], labels: ['bug', 'ui'] })
    expect(res.metaFailed).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({
      source_branch: 'feature',
      target_branch: 'main',
      title: 'T',
      description: 'B',
      reviewer_ids: [7],
      assignee_ids: [8, 9],
      labels: 'bug,ui'
    })
  })

  it('a pick GitLab quietly dropped is reported', async () => {
    route = (m) => (m === 'POST' ? mr({ reviewers: [], assignees: [{ id: 8 }], labels: ['bug'] }) : undefined)
    const res = await create(REMOTE.gitlab, { reviewers: ['7'], assignees: ['8'], labels: ['bug'] })
    expect(res.number).toBe(5)
    expect(res.metaFailed).toEqual(['reviewers'])
  })

  it('reads every page of project members (active ones) and labels', async () => {
    route = (_m, u) => {
      const page = Number(u.searchParams.get('page'))
      if (u.pathname.endsWith('/members/all')) {
        const list = Array.from({ length: page === 1 ? 100 : 2 }, (_, i) => ({
          id: page * 1000 + i,
          username: `m${page}-${i}`,
          name: `Member ${i}`,
          state: i === 0 && page === 2 ? 'blocked' : 'active'
        }))
        return list
      }
      if (u.pathname.endsWith('/labels')) return [{ name: 'bug', color: '#FF0000' }]
      return undefined
    }
    const o = await options(REMOTE.gitlab)
    expect(o.supports).toEqual({ reviewers: true, assignees: true, labels: true })
    expect(o.reviewers).toHaveLength(101)
    expect(o.assignees).toHaveLength(101)
    expect(o.reviewers[0]).toEqual({ id: '1000', login: 'm1-0', name: 'Member 0' })
    expect(o.labels).toEqual([{ id: 'bug', name: 'bug', color: '#ff0000' }])
    expect(calls.filter((c) => c.url.includes('/members/all')).map((c) => c.url)).toEqual([
      `${PROJECT}/members/all?per_page=100&page=1`,
      `${PROJECT}/members/all?per_page=100&page=2`
    ])
    for (const c of calls) expect(c.url.startsWith(`${GITLAB}/api/v4/`)).toBe(true)
  })
})

describe('Azure DevOps', () => {
  const REPO = 'https://dev.azure.com/acme/My%20Project/_apis/git/repositories/app'
  const PROJECTS = 'https://dev.azure.com/acme/_apis/projects/My%20Project'

  it('a create with no picks sends today’s body and no label calls', async () => {
    route = (m) => (m === 'POST' ? { pullRequestId: 31 } : undefined)
    const res = await create(REMOTE.azure)
    expect(res).toEqual({ number: 31, url: 'https://dev.azure.com/acme/My%20Project/_git/app/pullrequest/31' })
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${REPO}/pullrequests?api-version=7.1`,
        body: { sourceRefName: 'refs/heads/feature', targetRefName: 'refs/heads/main', title: 'T', description: 'B', isDraft: false }
      }
    ])
  })

  it('reviewers ride on the create; labels follow, one call each', async () => {
    route = (m) => (m === 'POST' ? { pullRequestId: 31 } : undefined)
    const res = await create(REMOTE.azure, { reviewers: ['id-1', 'team-1'], labels: ['bug', 'needs docs'], assignees: ['ignored'] })
    expect(res.metaFailed).toBeUndefined()
    expect((calls[0].body as Record<string, unknown>).reviewers).toEqual([{ id: 'id-1' }, { id: 'team-1' }])
    expect(calls.slice(1)).toEqual([
      { method: 'POST', url: `${REPO}/pullRequests/31/labels?api-version=7.1-preview.1`, body: { name: 'bug' } },
      { method: 'POST', url: `${REPO}/pullRequests/31/labels?api-version=7.1-preview.1`, body: { name: 'needs docs' } }
    ])
  })

  it('a refused label is reported on a PR that exists', async () => {
    route = (m, u) => {
      if (u.pathname.endsWith('/labels')) return json({ message: 'nope' }, 400)
      return m === 'POST' ? { pullRequestId: 31 } : undefined
    }
    const res = await create(REMOTE.azure, { labels: ['bug'] })
    expect(res.number).toBe(31)
    expect(res.metaFailed).toEqual(['labels'])
  })

  it('offers the project’s teams and their members, free labels, and no assignees', async () => {
    route = (_m, u) => {
      if (u.pathname.endsWith('/teams')) return { value: [{ id: 'team-1', name: 'Core' }, { id: 'team-2', name: 'Docs' }] }
      if (u.pathname.endsWith('/teams/team-1/members')) {
        return { value: [{ identity: { id: 'id-1', displayName: 'Ana', uniqueName: 'ana@acme.example' } }] }
      }
      if (u.pathname.endsWith('/teams/team-2/members')) {
        return { value: [{ identity: { id: 'id-1', displayName: 'Ana', uniqueName: 'ana@acme.example' } }, { identity: { id: 'id-2', displayName: 'Bo' } }] }
      }
      return undefined
    }
    const o = await options(REMOTE.azure)
    expect(o.supports).toEqual({ reviewers: true, assignees: false, labels: true })
    expect(o.freeLabels).toBe(true)
    expect(o.assignees).toEqual([])
    expect(o.labels).toEqual([])
    expect(o.reviewers).toEqual([
      { id: 'team-1', login: 'Core' },
      { id: 'team-2', login: 'Docs' },
      { id: 'id-1', login: 'ana@acme.example', name: 'Ana' },
      { id: 'id-2', login: 'Bo', name: 'Bo' }
    ])
    expect(calls[0].url).toBe(`${PROJECTS}/teams?$top=100&$skip=0&api-version=7.1`)
  })
})

describe('bitbucket.org', () => {
  const API = 'https://api.bitbucket.org/2.0'
  const pr = (extra: Record<string, unknown> = {}): Reply => ({ id: 4, links: { html: { href: 'https://bitbucket.org/ws/app/pull-requests/4' } }, ...extra })

  it('a create with no picks sends today’s body', async () => {
    route = (m) => (m === 'POST' ? pr() : undefined)
    await create(REMOTE.bitbucket)
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${API}/repositories/ws/app/pullrequests`,
        body: { title: 'T', description: 'B', source: { branch: { name: 'feature' } }, destination: { branch: { name: 'main' } } }
      }
    ])
  })

  it('reviewers go on the create as uuids; a dropped one is reported', async () => {
    route = (m) => (m === 'POST' ? pr({ reviewers: [{ uuid: '{a}' }] }) : undefined)
    const ok = await create(REMOTE.bitbucket, { reviewers: ['{a}'], labels: ['ignored'] })
    expect((calls[0].body as Record<string, unknown>).reviewers).toEqual([{ uuid: '{a}' }])
    expect(ok.metaFailed).toBeUndefined()
    const short = await create(REMOTE.bitbucket, { reviewers: ['{a}', '{b}'] })
    expect(short.metaFailed).toEqual(['reviewers'])
  })

  it('offers workspace members across pages, without the signed-in account', async () => {
    route = (_m, u) => {
      if (u.pathname === '/2.0/user') return { uuid: '{me}' }
      if (u.pathname === '/2.0/workspaces/ws/members') {
        if (u.searchParams.get('page') === '2') return { values: [{ user: { uuid: '{b}', display_name: 'Bo', nickname: 'bo' } }], next: 'https://evil.example/2.0/next' }
        return {
          values: [{ user: { uuid: '{me}', nickname: 'me' } }, { user: { uuid: '{a}', display_name: 'Ana', nickname: 'ana', links: { avatar: { href: 'https://avatar.example/a' } } } }],
          next: `${API}/workspaces/ws/members?pagelen=100&page=2`
        }
      }
      return undefined
    }
    const o = await options(REMOTE.bitbucket)
    expect(o.supports).toEqual({ reviewers: true, assignees: false, labels: false })
    expect(o.reviewers).toEqual([
      { id: '{a}', login: 'ana', name: 'Ana', avatarUrl: 'https://avatar.example/a' },
      { id: '{b}', login: 'bo', name: 'Bo' }
    ])
    // A `next` off the API is never followed with the token.
    expect(calls.some((c) => c.url.includes('evil.example'))).toBe(false)
  })

  it('falls back to the default reviewers when members cannot be listed', async () => {
    route = (_m, u) => {
      if (u.pathname === '/2.0/workspaces/ws/members') return json({ error: { message: 'forbidden' } }, 403)
      if (u.pathname.endsWith('/default-reviewers')) return { values: [{ uuid: '{a}', nickname: 'ana' }] }
      return undefined
    }
    const o = await options(REMOTE.bitbucket)
    expect(o.failed).toEqual([])
    expect(o.reviewers.map((p) => p.id)).toEqual(['{a}'])
  })
})

describe('Bitbucket Data Center', () => {
  const API = `${BBS}/rest/api/latest`
  const pull = (extra: Record<string, unknown> = {}): Reply => ({ id: 9, title: 'T', ...extra })

  it('a create with no picks sends today’s body', async () => {
    route = (m) => (m === 'POST' ? pull() : undefined)
    await create(REMOTE.bbs)
    expect(Object.keys(calls[0].body as object)).toEqual(['title', 'description', 'fromRef', 'toRef'])
  })

  it('reviewers go on the create by user name; a dropped one is reported', async () => {
    route = (m) => (m === 'POST' ? pull({ reviewers: [{ user: { name: 'ana' } }] }) : undefined)
    const ok = await create(REMOTE.bbs, { reviewers: ['ana'] })
    expect((calls[0].body as Record<string, unknown>).reviewers).toEqual([{ user: { name: 'ana' } }])
    expect(ok.metaFailed).toBeUndefined()
    const short = await create(REMOTE.bbs, { reviewers: ['ana', 'ghost'] })
    expect(short.metaFailed).toEqual(['reviewers'])
    for (const c of calls) expect(c.url.startsWith(`${API}/`)).toBe(true)
  })

  it('offers the users who can read the repository, across pages, without the signed-in account', async () => {
    route = (_m, u) => {
      if (u.pathname.endsWith('/application-properties')) return json({ version: '8.19.0' }, 200, { 'X-AUSERNAME': 'me' })
      if (u.pathname.endsWith('/users') && u.searchParams.get('permission.1') === 'REPO_READ') {
        expect(u.searchParams.get('permission.1.projectKey')).toBe('PROJ')
        expect(u.searchParams.get('permission.1.repositorySlug')).toBe('app')
        if (u.searchParams.get('start') === '0') {
          return { values: [{ name: 'me' }, { name: 'ana', displayName: 'Ana' }], isLastPage: false, nextPageStart: 2 }
        }
        return { values: [{ name: 'bo' }], isLastPage: true }
      }
      if (u.pathname.endsWith('/users')) return { values: [{ name: 'me', slug: 'me' }], isLastPage: true }
      return undefined
    }
    const o = await options(REMOTE.bbs)
    expect(o.supports).toEqual({ reviewers: true, assignees: false, labels: false })
    expect(o.reviewers).toEqual([
      { id: 'ana', login: 'ana', name: 'Ana' },
      { id: 'bo', login: 'bo' }
    ])
    for (const c of calls) expect(c.url.startsWith(`${API}/`)).toBe(true)
  })
})

describe('a reviewer the host refuses costs the reviewers, never the pull request', () => {
  const posts = (): Call[] => calls.filter((c) => c.method === 'POST')

  describe('bitbucket.org', () => {
    const pr = { id: 4, links: { html: { href: 'https://bitbucket.org/ws/app/pull-requests/4' } } }
    it('a 400 over reviewers: created once more without them, and reported', async () => {
      route = (m, _u, body) => {
        if (m !== 'POST') return undefined
        return (body as Record<string, unknown>).reviewers
          ? json({ type: 'error', error: { message: 'Malformed reviewers list', fields: { reviewers: ['bad'] } } }, 400)
          : pr
      }
      const res = await create(REMOTE.bitbucket, { reviewers: ['{ghost}'] })
      expect(res).toEqual({ url: 'https://bitbucket.org/ws/app/pull-requests/4', number: 4, metaFailed: ['reviewers'] })
      expect(posts()).toHaveLength(2)
      expect((posts()[1].body as Record<string, unknown>).reviewers).toBeUndefined()
    })
    it('the success path sends one create', async () => {
      route = (m) => (m === 'POST' ? { ...pr, reviewers: [{ uuid: '{a}' }] } : undefined)
      const res = await create(REMOTE.bitbucket, { reviewers: ['{a}'] })
      expect(res.metaFailed).toBeUndefined()
      expect(posts()).toHaveLength(1)
    })
    it('a 400 about another field is not retried', async () => {
      route = (m) =>
        m === 'POST' ? json({ type: 'error', error: { message: 'bad branch', fields: { source: ['nope'] } } }, 400) : undefined
      await expect(create(REMOTE.bitbucket, { reviewers: ['{a}'] })).rejects.toThrow(/bad branch/)
      expect(posts()).toHaveLength(1)
    })
    it('a 401 is not retried', async () => {
      route = (m) => (m === 'POST' ? json({ type: 'error', error: { message: 'Unauthorized' } }, 401) : undefined)
      await expect(create(REMOTE.bitbucket, { reviewers: ['{a}'] })).rejects.toThrow(/Unauthorized/)
      expect(posts()).toHaveLength(1)
    })
    it('a host-added default reviewer does not hide a dropped pick', async () => {
      route = (m) => (m === 'POST' ? { ...pr, reviewers: [{ uuid: '{a}' }, { uuid: '{default}' }] } : undefined)
      expect((await create(REMOTE.bitbucket, { reviewers: ['{a}', '{b}'] })).metaFailed).toEqual(['reviewers'])
      expect((await create(REMOTE.bitbucket, { reviewers: ['{a}'] })).metaFailed).toBeUndefined()
    })
  })

  describe('Bitbucket Data Center', () => {
    const refusal = (exceptionName: string): Response =>
      json({ errors: [{ message: 'Errors encountered while adding some reviewers', exceptionName }] }, 409)
    it('InvalidPullRequestReviewersException: created once more without them, and reported', async () => {
      route = (m, _u, body) => {
        if (m !== 'POST') return undefined
        return (body as Record<string, unknown>).reviewers
          ? refusal('com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException')
          : { id: 9, title: 'T' }
      }
      const res = await create(REMOTE.bbs, { reviewers: ['ghost'] })
      expect(res.number).toBe(9)
      expect(res.metaFailed).toEqual(['reviewers'])
      expect(posts()).toHaveLength(2)
      expect(Object.keys(posts()[1].body as object)).toEqual(['title', 'description', 'fromRef', 'toRef'])
    })
    it('a duplicate pull request (also a 409) is not retried', async () => {
      route = (m) => (m === 'POST' ? refusal('com.atlassian.bitbucket.pull.DuplicatePullRequestException') : undefined)
      await expect(create(REMOTE.bbs, { reviewers: ['ana'] })).rejects.toThrow()
      expect(posts()).toHaveLength(1)
    })
    it('a 401 is not retried', async () => {
      route = (m) => (m === 'POST' ? json({ errors: [{ message: 'Authentication failed' }] }, 401) : undefined)
      await expect(create(REMOTE.bbs, { reviewers: ['ana'] })).rejects.toThrow(/Authentication failed/)
      expect(posts()).toHaveLength(1)
    })
    it('a reviewer the server added by default does not hide a dropped pick; a slug matches too', async () => {
      route = (m) =>
        m === 'POST' ? { id: 9, reviewers: [{ user: { name: 'Ana.Silva', slug: 'ana.silva' } }, { user: { name: 'lead' } }] } : undefined
      expect((await create(REMOTE.bbs, { reviewers: ['ana.silva', 'ghost'] })).metaFailed).toEqual(['reviewers'])
      expect((await create(REMOTE.bbs, { reviewers: ['ana.silva'] })).metaFailed).toBeUndefined()
    })
  })

  describe('Azure DevOps', () => {
    const creates = (): Call[] => posts().filter((c) => c.url.includes('/pullrequests?'))
    it('a 400 with reviewers: created once more without them, labels still applied', async () => {
      route = (m, u, body) => {
        if (u.pathname.endsWith('/labels')) return {}
        if (m !== 'POST') return undefined
        return (body as Record<string, unknown>).reviewers ? json({ message: 'TF401181: invalid reviewer' }, 400) : { pullRequestId: 31 }
      }
      const res = await create(REMOTE.azure, { reviewers: ['id-x'], labels: ['bug'] })
      expect(res.number).toBe(31)
      expect(res.metaFailed).toEqual(['reviewers'])
      expect(creates()).toHaveLength(2)
      expect((creates()[1].body as Record<string, unknown>).reviewers).toBeUndefined()
      expect(posts().filter((c) => c.url.includes('/labels'))).toHaveLength(1)
    })
    it('a 401 is not retried without reviewers', async () => {
      route = (m) => (m === 'POST' ? json({ message: 'no' }, 401) : undefined)
      await expect(create(REMOTE.azure, { reviewers: ['id-1'] })).rejects.toThrow()
      expect(creates()).toHaveLength(1)
    })
    it('a reviewer Azure answers without is reported, by id', async () => {
      route = (m) => (m === 'POST' ? { pullRequestId: 31, reviewers: [{ id: 'ID-1' }, { id: 'default-team' }] } : undefined)
      expect((await create(REMOTE.azure, { reviewers: ['id-1', 'id-2'] })).metaFailed).toEqual(['reviewers'])
      expect((await create(REMOTE.azure, { reviewers: ['id-1'] })).metaFailed).toBeUndefined()
    })
  })
})

describe('free entries and partial lists', () => {
  it('GitHub takes new labels and typed logins; GitLab new labels only', async () => {
    route = (_m, u) => (u.pathname.endsWith('/assignees') || u.pathname.endsWith('/labels') ? [] : undefined)
    const gh = await options(REMOTE.github)
    expect(gh.freeLabels).toBe(true)
    expect(gh.freePeople).toBe(true)
    route = () => []
    const gl = await options(REMOTE.gitlab)
    expect(gl.freeLabels).toBe(true)
    expect(gl.freePeople).toBeUndefined()
  })

  it('a GitHub list cut at the cap is flagged partial', async () => {
    route = (_m, u) =>
      u.pathname.endsWith('/assignees')
        ? users('u', 100, Number(u.searchParams.get('page')) * 100)
        : u.pathname.endsWith('/labels')
          ? []
          : undefined
    const o = await options(REMOTE.github)
    expect(o.partial).toEqual(['reviewers', 'assignees'])
  })

  it('Azure pages teams, and flags members it did not read', async () => {
    const team = (i: number): { id: string; name: string } => ({ id: `t${i}`, name: `Team ${i}` })
    route = (_m, u) => {
      if (u.pathname.endsWith('/teams')) {
        const skip = Number(u.searchParams.get('$skip'))
        return { value: skip === 0 ? Array.from({ length: 100 }, (_, i) => team(i)) : [team(100), team(101)] }
      }
      if (u.pathname.includes('/members')) return { value: [] }
      return undefined
    }
    const o = await options(REMOTE.azure)
    expect(o.failed).toEqual([])
    expect(o.partial).toEqual(['reviewers'])
    expect(o.reviewers).toHaveLength(102)
    expect(calls.filter((c) => c.url.includes('/teams?')).map((c) => new URL(c.url).searchParams.get('$skip'))).toEqual(['0', '100'])
  })

  it('a team whose members could not be read flags the list; a small project is not flagged', async () => {
    route = (_m, u) => {
      if (u.pathname.endsWith('/teams')) return { value: [{ id: 't1', name: 'One' }, { id: 't2', name: 'Two' }] }
      if (u.pathname.endsWith('/teams/t2/members')) return json({ message: 'no' }, 500)
      return { value: [] }
    }
    expect((await options(REMOTE.azure)).partial).toEqual(['reviewers'])
    route = (_m, u) => (u.pathname.endsWith('/teams') ? { value: [{ id: 't1', name: 'One' }] } : { value: [] })
    expect((await options(REMOTE.azure)).partial).toBeUndefined()
  })
})

describe('a host with no such fields', () => {
  it('answers with nothing supported and sends no request', async () => {
    const o = await options('https://example.org/team/app.git')
    expect(o.supports).toEqual({ reviewers: false, assignees: false, labels: false })
    expect(calls).toEqual([])
  })
})
