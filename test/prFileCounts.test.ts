import { describe, expect, it } from 'vitest'
import type { PullRequest } from '../src/shared/types'
import type { PrListItem } from '../src/renderer/src/lib/prList'
import { AzureThrottle, azurePrFileCount, type Ado } from '../src/main/azurePr'
import {
  PR_FILE_COUNT_BATCH,
  PR_FILE_COUNT_CONCURRENCY,
  PrFileCountCache,
  getPrFileCounts,
  parsePrFileCountRequests
} from '../src/main/prFileCounts'
import {
  getPrFileCountKey,
  getPrFileCountRequests,
  toPrFileCountMap,
  withPrFileCounts
} from '../src/renderer/src/lib/prFileCounts'

// Azure DevOps lists pull requests without a size. The list page reads each
// drawn row's file count from the latest iteration's changes, and main keeps
// it by head commit so a refresh does not ask the host again.

const R = { org: 'example-org', project: 'My Project', repo: 'app' }
const A = 'a'.repeat(40)
const B = 'b'.repeat(40)

const pr = (id: number, extra: Partial<PullRequest> = {}): PullRequest => ({
  id,
  title: `PR ${id}`,
  author: 'ana',
  sourceBranch: 'feat/x',
  targetBranch: 'main',
  url: '',
  isDraft: false,
  ...extra
})
const item = (p: PullRequest, upstream?: string): PrListItem => ({
  pr: p,
  remoteUrl: 'https://example.test/o/r',
  ...(upstream ? { upstream } : {})
})

/** No real waiting: a throttle whose sleep only moves its own clock. */
const instantThrottle = (): AzureThrottle => {
  let now = 0
  return new AzureThrottle(
    async (ms) => {
      now += ms
    },
    () => now
  )
}

describe('Azure DevOps file count — from the latest iteration', () => {
  it('counts the files of the last iteration, folders left out, across pages', async () => {
    const urls: string[] = []
    const page1 = [
      { changeType: 'edit', item: { path: '/src/a.ts', gitObjectType: 'blob' } },
      { changeType: 'add', item: { path: '/src', gitObjectType: 'tree', isFolder: true } },
      { changeType: 'add', item: { path: '/src/b.ts', gitObjectType: 'blob' } }
    ]
    const page2 = [
      { changeType: 'delete', item: { path: '/docs', isFolder: true } },
      { changeType: 'rename', item: { path: '/src/c.ts', gitObjectType: 'blob' }, originalPath: '/src/old.ts' }
    ]
    const ado: Ado = async <T,>(url: string): Promise<T> => {
      urls.push(url)
      if (url.includes('/iterations?')) return { value: [{ id: 1 }, { id: 2 }, { id: 5 }] } as T
      if (url.includes('/iterations/5/changes')) {
        return (url.includes('$skip=2000') ? { changeEntries: page2 } : { changeEntries: page1, nextSkip: 2000, nextTop: 2000 }) as T
      }
      throw new Error(`unexpected ${url}`)
    }
    expect(await azurePrFileCount(ado, R, 42, instantThrottle())).toBe(3)
    expect(urls).toHaveLength(3)
    expect(urls[0]).toContain('/pullrequests/42/iterations?api-version=7.1')
    expect(urls[1]).toContain('/iterations/5/changes?$top=2000&api-version=7.1')
    expect(urls[2]).toContain('$skip=2000')
  })

  it('no iteration is no file', async () => {
    const ado: Ado = async <T,>(): Promise<T> => ({ value: [] }) as T
    expect(await azurePrFileCount(ado, R, 1, instantThrottle())).toBe(0)
  })

  it('a change list cut by the page cap gives no count — a partial one would read as the whole', async () => {
    const ado: Ado = async <T,>(url: string): Promise<T> =>
      (url.includes('/iterations?')
        ? { value: [{ id: 1 }] }
        : { changeEntries: [{ item: { path: '/x', gitObjectType: 'blob' } }], nextSkip: 1, nextTop: 2000 }) as T
    expect(await azurePrFileCount(ado, R, 1, instantThrottle())).toBeNull()
  })
})

describe('PR file counts in main — cache by head, a few at a time', () => {
  it('a warm cache asks the host nothing; a new head asks again', async () => {
    const cache = new PrFileCountCache()
    const reads: number[] = []
    const read = async (id: number): Promise<number> => {
      reads.push(id)
      return id * 10
    }
    expect(await getPrFileCounts(cache, 'org/p/r', [{ id: 1, headSha: A }, { id: 2, headSha: A }], read)).toEqual({
      1: 10,
      2: 20
    })
    expect(reads).toEqual([1, 2])
    // Re-opened page, same heads: from the cache.
    expect(await getPrFileCounts(cache, 'org/p/r', [{ id: 1, headSha: A }, { id: 2, headSha: A }], read)).toEqual({
      1: 10,
      2: 20
    })
    expect(reads).toEqual([1, 2])
    // Someone pushed to #2: only it is read again.
    await getPrFileCounts(cache, 'org/p/r', [{ id: 1, headSha: A }, { id: 2, headSha: B }], read)
    expect(reads).toEqual([1, 2, 2])
    // Another repository's #1 is another PR.
    await getPrFileCounts(cache, 'org/p/other', [{ id: 1, headSha: A }], read)
    expect(reads).toEqual([1, 2, 2, 1])
  })

  it('forgets the least recently used past its size', () => {
    const cache = new PrFileCountCache(2)
    cache.setCount('a', 1)
    cache.setCount('b', 2)
    expect(cache.getCount('a')).toBe(1) // a is now the most recent
    cache.setCount('c', 3)
    expect(cache.getCount('b')).toBeUndefined()
    expect(cache.getCount('a')).toBe(1)
    expect(cache.getCount('c')).toBe(3)
    expect(cache.size).toBe(2)
  })

  it(`reads at most ${PR_FILE_COUNT_CONCURRENCY} at once`, async () => {
    let running = 0
    let peak = 0
    const read = async (id: number): Promise<number> => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 1))
      running--
      return id
    }
    const reqs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, headSha: A }))
    const out = await getPrFileCounts(new PrFileCountCache(), 'r', reqs, read)
    expect(Object.keys(out)).toHaveLength(12)
    expect(peak).toBe(PR_FILE_COUNT_CONCURRENCY)
  })

  it('a failed or uncountable read is left out, and not cached', async () => {
    const cache = new PrFileCountCache()
    const read = async (id: number): Promise<number | null> => {
      if (id === 1) throw Object.assign(new Error('boom'), { status: 500 })
      return id === 2 ? null : 3
    }
    const reqs = [1, 2, 3].map((id) => ({ id, headSha: A }))
    expect(await getPrFileCounts(cache, 'r', reqs, read)).toEqual({ 3: 3 })
    expect(cache.size).toBe(1)
  })

  it('a refusal stops the reads still queued', async () => {
    const reads: number[] = []
    const read = async (id: number): Promise<number> => {
      reads.push(id)
      throw Object.assign(new Error('refused'), { status: 401 })
    }
    const reqs = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, headSha: A }))
    expect(await getPrFileCounts(new PrFileCountCache(), 'r', reqs, read)).toEqual({})
    // The workers already started finish their one read; none starts after.
    expect(reads.length).toBeLessThanOrEqual(PR_FILE_COUNT_CONCURRENCY)
  })

  it('takes only well-formed requests off the IPC boundary, deduplicated and bounded', () => {
    expect(parsePrFileCountRequests('nope')).toEqual([])
    expect(
      parsePrFileCountRequests([
        { id: 1, headSha: A.toUpperCase() },
        { id: 1, headSha: B },
        { id: -2, headSha: A },
        { id: 3, headSha: 'not a sha' },
        { id: 4 },
        null
      ])
    ).toEqual([{ id: 1, headSha: A }])
    const many = Array.from({ length: PR_FILE_COUNT_BATCH + 10 }, (_, i) => ({ id: i + 1, headSha: A }))
    expect(parsePrFileCountRequests(many)).toHaveLength(PR_FILE_COUNT_BATCH)
  })
})

describe('PR file counts on the list page', () => {
  it('asks for rows without a size, with a head, on this remote, once', () => {
    const items = [
      item(pr(1, { headSha: A })),
      item(pr(2, { headSha: A, changedFiles: 4 })),
      item(pr(3)),
      item(pr(4, { headSha: B }), 'upstream/app'),
      item(pr(5, { headSha: B }))
    ]
    expect(getPrFileCountRequests(items, new Set())).toEqual([
      { id: 1, headSha: A },
      { id: 5, headSha: B }
    ])
    expect(getPrFileCountRequests(items, new Set([getPrFileCountKey(1, A)]))).toEqual([{ id: 5, headSha: B }])
  })

  it('joins the answers by PR and head — a pushed PR does not take its old count', () => {
    const answer = toPrFileCountMap([{ id: 1, headSha: A }, { id: 2, headSha: A }], { 1: 7, 9: 3 })
    expect(answer).toEqual({ [getPrFileCountKey(1, A)]: 7 })
    const items = [item(pr(1, { headSha: A })), item(pr(2, { headSha: A }))]
    const merged = withPrFileCounts(items, answer)
    expect(merged[0].pr.changedFiles).toBe(7)
    expect(merged[1]).toBe(items[1])
    // #1 pushed since: its new head has no count yet.
    const pushed = [item(pr(1, { headSha: B }))]
    expect(withPrFileCounts(pushed, answer)).toBe(pushed)
  })

  it('hands the same list back when nothing joined', () => {
    const items = [item(pr(1, { headSha: A }))]
    expect(withPrFileCounts(items, {})).toBe(items)
  })
})
