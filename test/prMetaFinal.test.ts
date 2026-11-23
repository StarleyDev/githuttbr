import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings, type CreatePrResult, type PrPickerOptions } from '../src/shared/types'

// Reviewers, assignees and labels — the edges: a post-create call never costs a
// saved login, a Data Center remote never reaches bitbucket.org, typed logins
// lose their `@`, and a list read only in part says so. Real IPC handlers, a
// fake fetch, a borrowed git credential (no token in Settings).

const dir = mkdtempSync(join(tmpdir(), 'gitcito-pr-meta-final-'))
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

/** The tokens the credential helper hands out, in order; the last one repeats. */
let minted: string[] = ['borrowed-pat']
let mintCount = 0
const forgetCredential = vi.fn(async () => undefined)
vi.mock('../src/main/credentials', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/main/credentials')>()
  return {
    ...real,
    apiToken: vi.fn(async () => {
      const token = minted[Math.min(mintCount++, minted.length - 1)]
      return { token, source: 'git', login: 'ana', cred: { protocol: 'https', host: 'example', username: 'ana', password: token } }
    }),
    forgetCredential
  }
})

const BBS = 'https://bitbucket.example.corp'
const REMOTE = {
  github: 'https://github.com/team/app.git',
  azure: 'https://dev.azure.com/acme/proj/_git/app',
  bitbucket: 'https://bitbucket.org/ws/app.git',
  bbs: `${BBS}/scm/proj/app.git`,
  // On the Data Center's server, but not a path any of its repositories has.
  bbsBadPath: `${BBS}/scm/only-one-segment.git`
}

interface Call {
  method: string
  url: string
  auth?: string
  body?: unknown
}
const calls: Call[] = []
type Reply = Response | Record<string, unknown> | unknown[] | undefined
let route: (c: Call, url: URL) => Reply = () => undefined
const json = (data: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })

const BASE = { title: 'T', body: 'B', source: 'feature', target: 'main', draft: false }
const call = <R>(channel: string, remote: string, ...args: unknown[]): Promise<R> =>
  Promise.resolve(handlers.get(channel)!({}, '', remote, {}, ...args)) as Promise<R>
const options = (remote: string): Promise<PrPickerOptions> => call('hosting:prPickerOptions', remote)
const create = (remote: string, extra: Record<string, unknown> = {}): Promise<CreatePrResult> =>
  call('hosting:createPR', remote, { ...BASE, ...extra })
/** The PAT inside an Azure Basic header. */
const azToken = (auth?: string): string => Buffer.from((auth ?? '').replace(/^Basic /, ''), 'base64').toString().slice(1)

beforeAll(async () => {
  writeFileSync(join(dir, 'gitcito-keychain.json'), JSON.stringify({ consent: 'declined', explained: true }))
  const base = defaultSettings()
  writeFileSync(
    join(dir, 'gitcito-settings.json'),
    JSON.stringify({
      ...base,
      onboardingCompleted: true,
      profiles: [{ ...base.profiles[0], bitbucketServers: [{ url: BBS, token: 'tok-bbs', username: 'me' }] }]
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
      const headers = (init?.headers ?? {}) as Record<string, string>
      const c: Call = {
        method: init?.method ?? 'GET',
        url,
        ...(headers.Authorization ? { auth: headers.Authorization } : {}),
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {})
      }
      calls.push(c)
      const r = route(c, new URL(url))
      return r instanceof Response ? r : json(r ?? {})
    })
  )
})
beforeEach(() => {
  forgetCredential.mockClear()
  minted = ['borrowed-pat']
  mintCount = 0
})
afterEach(() => {
  calls.length = 0
  route = () => undefined
})
afterAll(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

describe('Azure DevOps: only the create may evict a borrowed credential', () => {
  const REPO = 'https://dev.azure.com/acme/proj/_apis/git/repositories/app'

  it('a label refused with 403 forgets nothing, keeps the PR, and names labels', async () => {
    route = (c, u) => {
      if (c.method === 'POST' && u.pathname.endsWith('/pullrequests')) return { pullRequestId: 5 }
      if (u.pathname.endsWith('/labels')) return json({ message: 'TF401289: no Create tag definition permission' }, 403)
      return undefined
    }
    const res = await create(REMOTE.azure, { labels: ['bug'] })
    expect(res.number).toBe(5)
    expect(res.metaFailed).toEqual(['labels'])
    expect(forgetCredential).not.toHaveBeenCalled()
    // The Pull Request Labels resource is a preview API, asked for as one.
    expect(calls.filter((c) => c.url.includes('/labels')).map((c) => c.url)).toEqual([
      `${REPO}/pullRequests/5/labels?api-version=7.1-preview.1`
    ])
  })

  it('after a 401 re-mint, the retry without reviewers and the labels use the new token; one eviction', async () => {
    minted = ['old-pat', 'new-pat']
    route = (c, u) => {
      if (c.method === 'POST' && u.pathname.endsWith('/pullrequests')) {
        if (azToken(c.auth) !== 'new-pat') return json({ message: 'expired' }, 401)
        if ((c.body as { reviewers?: unknown }).reviewers) return json({ message: 'TF401181: identity cannot be a reviewer' }, 400)
        return { pullRequestId: 6 }
      }
      return undefined
    }
    const res = await create(REMOTE.azure, { reviewers: ['id-1'], labels: ['bug'] })
    expect(res.number).toBe(6)
    expect(res.metaFailed).toEqual(['reviewers'])
    expect(forgetCredential).toHaveBeenCalledTimes(1)
    const posts = calls.filter((c) => c.method === 'POST').map((c) => [azToken(c.auth), c.url.includes('/labels') ? 'label' : 'create'])
    expect(posts).toEqual([
      ['old-pat', 'create'],
      ['new-pat', 'create'],
      ['new-pat', 'create'],
      ['new-pat', 'label']
    ])
  })
})

describe('Bitbucket Data Center: an unreadable remote never reaches bitbucket.org', () => {
  it('create and picker fail with the Data Center address error, and send nothing', async () => {
    const { BBS_BAD_REMOTE } = await import('../src/main/hosting')
    await expect(create(REMOTE.bbsBadPath, { reviewers: ['ana'] })).rejects.toThrow(BBS_BAD_REMOTE)
    await expect(options(REMOTE.bbsBadPath)).rejects.toThrow(BBS_BAD_REMOTE)
    expect(calls).toEqual([])
  })

  it('the PR list sends nothing for it either', async () => {
    const res = await call<{ prs: unknown[] }>('hosting:listPRs', REMOTE.bbsBadPath)
    expect(res.prs).toEqual([])
    expect(calls.some((c) => c.url.includes('bitbucket.org'))).toBe(false)
  })
})

describe('GitHub: typed logins and assignees GitHub skipped', () => {
  const API = 'https://api.github.com/repos/team/app'

  it('a leading @ is dropped from reviewers and assignees', async () => {
    route = (c, u) => {
      if (c.method === 'POST' && u.pathname.endsWith('/pulls')) return { number: 12, html_url: 'https://github.com/team/app/pull/12' }
      if (u.pathname.endsWith('/assignees')) return { assignees: [{ login: 'Bob' }, { login: 'carl' }] }
      return undefined
    }
    const res = await create(REMOTE.github, { reviewers: ['@ana'], assignees: ['@bob', 'carl'] })
    expect(res.metaFailed).toBeUndefined()
    const sent = Object.fromEntries(calls.slice(1).map((c) => [c.url, c.body]))
    expect(sent[`${API}/pulls/12/requested_reviewers`]).toEqual({ reviewers: ['ana'] })
    expect(sent[`${API}/issues/12/assignees`]).toEqual({ assignees: ['bob', 'carl'] })
  })

  it('an assignee missing from GitHub’s answer is reported', async () => {
    route = (c, u) => {
      if (c.method === 'POST' && u.pathname.endsWith('/pulls')) return { number: 12, html_url: 'https://github.com/team/app/pull/12' }
      if (u.pathname.endsWith('/assignees')) return { assignees: [{ login: 'bob' }] }
      return undefined
    }
    const res = await create(REMOTE.github, { assignees: ['bob', 'ghost'] })
    expect(res.number).toBe(12)
    expect(res.metaFailed).toEqual(['assignees'])
  })
})

describe('partial lists say so', () => {
  it('Data Center: a user list cut at the page cap is flagged partial', async () => {
    route = (_c, u) => {
      if (u.pathname.endsWith('/application-properties')) return json({ version: '8.19.0' }, 200, { 'X-AUSERNAME': 'me' })
      if (u.pathname.endsWith('/users') && u.searchParams.get('permission.1') === 'REPO_READ') {
        const start = Number(u.searchParams.get('start'))
        return { values: [{ name: `u${start}` }], isLastPage: false, nextPageStart: start + 1 }
      }
      return undefined
    }
    const o = await options(REMOTE.bbs)
    expect(o.failed).toEqual([])
    expect(o.reviewers).toHaveLength(10)
    expect(o.partial).toEqual(['reviewers'])
  })

  it('Data Center: a list the server ended is not flagged', async () => {
    route = (_c, u) => (u.pathname.endsWith('/users') ? { values: [{ name: 'ana' }], isLastPage: true } : undefined)
    const o = await options(REMOTE.bbs)
    expect(o.partial).toBeUndefined()
  })

  it('bitbucket.org: default reviewers stand in for members, flagged partial', async () => {
    route = (_c, u) => {
      if (u.pathname === '/2.0/workspaces/ws/members') return json({ error: { message: 'forbidden' } }, 403)
      if (u.pathname.endsWith('/default-reviewers')) return { values: [{ uuid: '{a}', nickname: 'ana' }] }
      return undefined
    }
    const o = await options(REMOTE.bitbucket)
    expect(o.reviewers.map((p) => p.id)).toEqual(['{a}'])
    expect(o.partial).toEqual(['reviewers'])
    expect(o.failed).toEqual([])
  })

  it('bitbucket.org: no members and no default reviewers is a failed list', async () => {
    route = (_c, u) => {
      if (u.pathname === '/2.0/workspaces/ws/members') return json({ error: { message: 'forbidden' } }, 403)
      if (u.pathname.endsWith('/default-reviewers')) return { values: [] }
      return undefined
    }
    const o = await options(REMOTE.bitbucket)
    expect(o.failed).toEqual(['reviewers'])
  })
})

describe('Data Center: a typed reviewer it has no user for', () => {
  const posts = (): Call[] => calls.filter((c) => c.method === 'POST')

  it('a 404 NoSuchUserException costs the reviewers, not the PR', async () => {
    route = (c) => {
      if (c.method !== 'POST') return undefined
      if ((c.body as { reviewers?: unknown }).reviewers) {
        return json(
          { errors: [{ message: 'User ghost does not exist', exceptionName: 'com.atlassian.bitbucket.user.NoSuchUserException' }] },
          404
        )
      }
      return { id: 9, title: 'T' }
    }
    const res = await create(REMOTE.bbs, { reviewers: ['ghost'] })
    expect(res.number).toBe(9)
    expect(res.metaFailed).toEqual(['reviewers'])
    expect(posts()).toHaveLength(2)
  })

  it('a 404 for the repository itself is not retried', async () => {
    route = (c) =>
      c.method === 'POST'
        ? json({ errors: [{ message: 'no repo', exceptionName: 'com.atlassian.bitbucket.repository.NoSuchRepositoryException' }] }, 404)
        : undefined
    await expect(create(REMOTE.bbs, { reviewers: ['ana'] })).rejects.toThrow(/no repo/)
    expect(posts()).toHaveLength(1)
  })
})
