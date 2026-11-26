import { describe, expect, it } from 'vitest'
import {
  azureReferenceSummaries,
  forgejoReferenceSummaries,
  githubReferenceSummaries,
  gitlabReferenceSummaries,
  normalizeReferenceQueries,
  REFERENCE_BATCH_MAX
} from '../src/main/referenceSummaries'
import type { JsonGet } from '../src/main/referenceSummaries'
import type { ReferenceQuery } from '../src/shared/types'

/**
 * A fake host: `answer(url)` returns the body for a URL, or a status to refuse
 * it with. Every URL asked is recorded, so a test can see what was batched.
 */
function fakeHost(answer: (url: URL) => unknown | { status: number }): { get: JsonGet; urls: URL[] } {
  const urls: URL[] = []
  const fetchFake = async (url: string): Promise<Response> => {
    const u = new URL(url)
    urls.push(u)
    const body = answer(u)
    if (body && typeof body === 'object' && 'status' in body && typeof body.status === 'number') {
      return new Response('{"message":"no"}', { status: body.status })
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const get: JsonGet = async <T>(url: string): Promise<T> => {
    const res = await fetchFake(url)
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
    return (await res.json()) as T
  }
  return { get, urls }
}

const qs = (...items: Array<[ReferenceQuery['sigil'], number]>): ReferenceQuery[] => items.map(([sigil, id]) => ({ sigil, id }))

describe('reference summaries: the IPC argument', () => {
  it('keeps known sigils and positive integer ids, once each', () => {
    expect(
      normalizeReferenceQueries([
        { sigil: '#', id: 1 },
        { sigil: '#', id: 1 },
        { sigil: 'AB#', id: 2 },
        { sigil: '!', id: 3 },
        { sigil: '$', id: 4 },
        { sigil: '#', id: -5 },
        { sigil: '#', id: 1.5 },
        { sigil: '#', id: '6' },
        null,
        'junk'
      ])
    ).toEqual(qs(['#', 1], ['AB#', 2], ['!', 3]))
    expect(normalizeReferenceQueries('not a list')).toEqual([])
  })

  it('caps one call at the batch maximum', () => {
    const many = Array.from({ length: REFERENCE_BATCH_MAX + 20 }, (_, i) => ({ sigil: '#', id: i + 1 }))
    expect(normalizeReferenceQueries(many)).toHaveLength(REFERENCE_BATCH_MAX)
  })
})

describe('reference summaries: Azure Boards', () => {
  const item = (id: number, title: string, type: string, state: string): unknown => ({
    id,
    fields: { 'System.Title': title, 'System.WorkItemType': type, 'System.State': state }
  })

  it('reads every work item in one batch request, with omit for the ones it cannot see', async () => {
    const host = fakeHost(() => ({ value: [item(12, 'Export the ledger', 'User Story', 'Active'), null] }))
    const out = await azureReferenceSummaries(host.get, 'example-org', qs(['AB#', 12], ['AB#', 99]))
    expect(host.urls).toHaveLength(1)
    const u = host.urls[0]
    expect(u.origin + u.pathname).toBe('https://dev.azure.com/example-org/_apis/wit/workitems')
    expect(u.searchParams.get('ids')).toBe('12,99')
    expect(u.searchParams.get('errorPolicy')).toBe('omit')
    expect(u.searchParams.get('fields')).toBe('System.Title,System.WorkItemType,System.State')
    expect(out).toEqual([
      {
        sigil: 'AB#',
        id: 12,
        available: true,
        kind: 'workItem',
        title: 'Export the ledger',
        stateName: 'Active',
        workItemType: 'User Story'
      },
      { sigil: 'AB#', id: 99, available: false, reason: 'notFound' }
    ])
  })

  it('treats `#12` as the same work item, asks for it once, and never reads a `!`', async () => {
    const host = fakeHost(() => ({ value: [item(12, 'Fix rounding', 'Bug', 'New')] }))
    const out = await azureReferenceSummaries(host.get, 'example-org', qs(['#', 12], ['AB#', 12], ['!', 12]))
    expect(host.urls[0].searchParams.get('ids')).toBe('12')
    expect(out.map((s) => [s.sigil, s.available, s.title])).toEqual([
      ['#', true, 'Fix rounding'],
      ['AB#', true, 'Fix rounding'],
      ['!', false, undefined]
    ])
  })

  it('splits more than 200 ids into requests of 200', async () => {
    const host = fakeHost((u) => ({
      value: (u.searchParams.get('ids') ?? '').split(',').map((id) => item(Number(id), `Item ${id}`, 'Task', 'Done'))
    }))
    const ids = Array.from({ length: 250 }, (_, i): [ReferenceQuery['sigil'], number] => ['AB#', i + 1])
    const out = await azureReferenceSummaries(host.get, 'example-org', qs(...ids))
    expect(host.urls.map((u) => (u.searchParams.get('ids') ?? '').split(',').length)).toEqual([200, 50])
    expect(out.every((s) => s.available)).toBe(true)
  })

  it('answers "unavailable" when the token may not read work items at all', async () => {
    const host = fakeHost(() => ({ status: 401 }))
    const out = await azureReferenceSummaries(host.get, 'example-org', qs(['AB#', 1]))
    expect(out).toEqual([{ sigil: 'AB#', id: 1, available: false, reason: 'notFound' }])
  })
})

describe('reference summaries: GitHub', () => {
  const API = 'https://api.github.com/repos/team/app'

  it('reads each number through the issues API, telling issues from pull requests', async () => {
    const host = fakeHost((u) => {
      const n = Number(u.pathname.split('/').pop())
      if (n === 1) return { number: 1, title: 'Crash on empty repo', state: 'open' }
      if (n === 2) return { number: 2, title: 'Add range-diff', state: 'closed', pull_request: { merged_at: '2026-01-02T00:00:00Z' } }
      if (n === 3) return { number: 3, title: 'Abandoned idea', state: 'closed', pull_request: { merged_at: null } }
      if (n === 4) return { status: 404 }
      return { status: 403 }
    })
    const out = await githubReferenceSummaries(host.get, API, qs(['#', 1], ['#', 2], ['#', 3], ['#', 4], ['#', 5]))
    expect(host.urls.map((u) => u.pathname).sort()).toEqual(
      [1, 2, 3, 4, 5].map((n) => `/repos/team/app/issues/${n}`)
    )
    expect(out).toEqual([
      { sigil: '#', id: 1, available: true, kind: 'issue', title: 'Crash on empty repo', state: 'open' },
      { sigil: '#', id: 2, available: true, kind: 'pr', title: 'Add range-diff', state: 'merged' },
      { sigil: '#', id: 3, available: true, kind: 'pr', title: 'Abandoned idea', state: 'closed' },
      { sigil: '#', id: 4, available: false, reason: 'notFound' },
      { sigil: '#', id: 5, available: false, reason: 'notFound' }
    ])
  })

  it('asks one at a time, and stops at the first 429: the rest are rate limited, not asked', async () => {
    let inFlight = 0
    let most = 0
    const urls: string[] = []
    const get: JsonGet = async <T>(url: string): Promise<T> => {
      urls.push(url)
      inFlight++
      most = Math.max(most, inFlight)
      await new Promise((r) => setTimeout(r, 2))
      inFlight--
      if (url.endsWith('/issues/2')) throw Object.assign(new Error('slow down'), { status: 429 })
      return { number: 1, title: 'One', state: 'open' } as T
    }
    const out = await githubReferenceSummaries(get, API, qs(['#', 1], ['#', 2], ['#', 3], ['#', 4]))
    expect(most).toBe(1)
    expect(urls.map((u) => u.split('/').pop())).toEqual(['1', '2'])
    expect(out.map((s) => [s.id, s.available, s.reason])).toEqual([
      [1, true, undefined],
      [2, false, 'rateLimited'],
      [3, false, 'rateLimited'],
      [4, false, 'rateLimited']
    ])
  })

  it('reads GitHub’s throttling 403 (rateLimited flag) as rate limited, and stops', async () => {
    const get: JsonGet = async () => {
      throw Object.assign(new Error('rate limit'), { status: 403, rateLimited: true })
    }
    const out = await githubReferenceSummaries(get, API, qs(['#', 1], ['#', 2]))
    expect(out.map((s) => s.reason)).toEqual(['rateLimited', 'rateLimited'])
  })

  it('asks nothing for a sigil GitHub does not have', async () => {
    const host = fakeHost(() => ({}))
    const out = await githubReferenceSummaries(host.get, API, qs(['!', 3], ['AB#', 4]))
    expect(host.urls).toHaveLength(0)
    expect(out.every((s) => !s.available)).toBe(true)
  })
})

describe('reference summaries: GitLab', () => {
  const API = 'https://gitlab.example.corp/api/v4/projects/team%2Fapp'

  it('batches issues and merge requests by iids[], one request each', async () => {
    const host = fakeHost((u) => {
      const iids = u.searchParams.getAll('iids[]').map(Number)
      if (u.pathname.endsWith('/issues')) {
        return iids.filter((n) => n !== 8).map((iid) => ({ iid, title: `Issue ${iid}`, state: iid === 7 ? 'closed' : 'opened' }))
      }
      return iids.map((iid) => ({ iid, title: `MR ${iid}`, state: 'merged' }))
    })
    const out = await gitlabReferenceSummaries(host.get, API, qs(['#', 7], ['#', 8], ['!', 3], ['#', 9]))
    expect(host.urls).toHaveLength(2)
    const issues = host.urls.find((u) => u.pathname.endsWith('/issues'))!
    const mrs = host.urls.find((u) => u.pathname.endsWith('/merge_requests'))!
    expect(issues.pathname).toBe('/api/v4/projects/team%2Fapp/issues')
    expect(issues.searchParams.getAll('iids[]')).toEqual(['7', '8', '9'])
    expect(issues.searchParams.get('state')).toBeNull()
    expect(mrs.searchParams.getAll('iids[]')).toEqual(['3'])
    expect(out).toEqual([
      { sigil: '#', id: 7, available: true, kind: 'issue', title: 'Issue 7', state: 'closed' },
      { sigil: '#', id: 8, available: false, reason: 'notFound' },
      { sigil: '!', id: 3, available: true, kind: 'mr', title: 'MR 3', state: 'merged' },
      { sigil: '#', id: 9, available: true, kind: 'issue', title: 'Issue 9', state: 'open' }
    ])
  })

  it('pages more than 100 ids, and a refused list leaves only its own kind unavailable', async () => {
    const host = fakeHost((u) => {
      if (u.pathname.endsWith('/merge_requests')) return { status: 403 }
      return u.searchParams.getAll('iids[]').map((iid) => ({ iid: Number(iid), title: 'x', state: 'opened' }))
    })
    const ids = Array.from({ length: 120 }, (_, i): [ReferenceQuery['sigil'], number] => ['#', i + 1])
    const out = await gitlabReferenceSummaries(host.get, API, qs(...ids, ['!', 1]))
    const issuePages = host.urls.filter((u) => u.pathname.endsWith('/issues'))
    expect(issuePages.map((u) => u.searchParams.getAll('iids[]').length)).toEqual([100, 20])
    expect(out.filter((s) => s.sigil === '#').every((s) => s.available)).toBe(true)
    expect(out.find((s) => s.sigil === '!')).toEqual({ sigil: '!', id: 1, available: false, reason: 'notFound' })
  })
})

describe('reference summaries: Forgejo concurrency', () => {
  it('has at most two requests in flight', async () => {
    let inFlight = 0
    let most = 0
    const get: JsonGet = async <T>(): Promise<T> => {
      inFlight++
      most = Math.max(most, inFlight)
      await new Promise((r) => setTimeout(r, 2))
      inFlight--
      return { number: 1, title: 'x', state: 'open' } as T
    }
    const ids = Array.from({ length: 6 }, (_, i): [ReferenceQuery['sigil'], number] => ['#', i + 1])
    const out = await forgejoReferenceSummaries(get, 'https://git.example.corp/api/v1/repos/team/app', qs(...ids))
    expect(most).toBe(2)
    expect(out.every((s) => s.available)).toBe(true)
  })

  it('says "unreachable" when the server cannot be reached', async () => {
    const get: JsonGet = async () => {
      throw new TypeError('fetch failed')
    }
    const out = await forgejoReferenceSummaries(get, 'https://git.example.corp/api/v1/repos/team/app', qs(['#', 1]))
    expect(out).toEqual([{ sigil: '#', id: 1, available: false, reason: 'unreachable' }])
  })
})

describe('reference summaries: Forgejo', () => {
  const API = 'https://git.example.corp/api/v1/repos/team/app'

  it('reads each number through the issues endpoint, pull requests included', async () => {
    const host = fakeHost((u) => {
      const n = Number(u.pathname.split('/').pop())
      if (n === 1) return { number: 1, title: 'Docs typo', state: 'closed' }
      if (n === 2) return { number: 2, title: 'Faster graph', state: 'closed', pull_request: { merged: true } }
      return { status: 404 }
    })
    const out = await forgejoReferenceSummaries(host.get, API, qs(['#', 1], ['#', 2], ['#', 3]))
    expect(host.urls.map((u) => u.pathname).sort()).toEqual(['/api/v1/repos/team/app/issues/1', '/api/v1/repos/team/app/issues/2', '/api/v1/repos/team/app/issues/3'])
    expect(out).toEqual([
      { sigil: '#', id: 1, available: true, kind: 'issue', title: 'Docs typo', state: 'closed' },
      { sigil: '#', id: 2, available: true, kind: 'pr', title: 'Faster graph', state: 'merged' },
      { sigil: '#', id: 3, available: false, reason: 'notFound' }
    ])
  })
})
