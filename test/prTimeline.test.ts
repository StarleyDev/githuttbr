import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrCommit, PrDetail, PrReviewThread } from '../src/shared/types'

vi.mock('../src/renderer/src/infrastructure/api', () => ({
  settingsApi: { set: vi.fn(async () => undefined) },
  reposApi: {}
}))

import {
  buildPrTimeline,
  countOpenThreads,
  filterPrTimeline,
  getHunkLines,
  getPrPersonRoles,
  groupPrCommitPushes
} from '../src/renderer/src/lib/prTimeline'
import {
  getLastVisit,
  getPrVisitKey,
  getVisitFrom,
  recordVisit,
  splitByLastVisit,
  withVisit
} from '../src/renderer/src/lib/prVisits'
import { getReviewThreadResolution, type GithubGraphqlPost } from '../src/main/githubGraphql'
import { useSettingsStore } from '../src/renderer/src/stores/settings'

const commit = (sha: string, author: string, at: string): PrCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject: `commit ${sha}`,
  authorName: author,
  authoredAt: at
})

const thread = (rootId: number, at: string, resolved?: boolean): PrReviewThread => ({
  path: 'src/a.ts',
  line: 4,
  diffHunk: '',
  rootId,
  comments: [{ id: rootId, author: 'kalani', body: 'hm', createdAt: at }],
  ...(resolved === undefined ? {} : { resolved })
})

const pr = (over: Partial<PrDetail> = {}): PrDetail => ({
  number: 42,
  title: 'Add search',
  body: 'desc',
  author: 'sam',
  source: 'search',
  target: 'main',
  draft: false,
  state: 'open',
  merged: false,
  mergeable: true,
  url: 'https://example.test/pr/42',
  createdAt: '2026-11-01T10:00:00Z',
  comments: [],
  reviews: [],
  reviewThreads: [],
  ...over
})

describe('groupPrCommitPushes', () => {
  it('groups consecutive commits by one author within the gap, and splits on author or pause', () => {
    const pushes = groupPrCommitPushes([
      commit('a1', 'sam', '2026-11-01T10:00:00Z'),
      commit('a2', 'sam', '2026-11-01T10:40:00Z'),
      commit('b1', 'alex', '2026-11-01T10:50:00Z'),
      commit('a3', 'sam', '2026-11-01T11:00:00Z'),
      commit('a4', 'sam', '2026-11-01T14:00:00Z')
    ])
    expect(pushes.map((p) => [p.author, p.commits.map((c) => c.sha)])).toEqual([
      ['sam', ['a1', 'a2']],
      ['alex', ['b1']],
      ['sam', ['a3']],
      ['sam', ['a4']]
    ])
    // A group is placed at its last commit.
    expect(pushes[0].at).toBe(Date.parse('2026-11-01T10:40:00Z'))
  })

  it('prefers the host login over the commit name', () => {
    const c = { ...commit('a1', 'Sam R', '2026-11-01T10:00:00Z'), authorLogin: 'sam' }
    expect(groupPrCommitPushes([c])[0].author).toBe('sam')
  })
})

describe('buildPrTimeline', () => {
  const detail = pr({
    comments: [
      { author: 'alex', body: 'nice', createdAt: '2026-11-03T10:00:00Z', handle: { id: 1, kind: 'conversation' } }
    ],
    reviewThreads: [thread(7, '2026-11-02T10:00:00Z', false), thread(8, '2026-11-04T10:00:00Z', true)],
    reviews: [
      { author: 'kalani', state: 'CHANGES_REQUESTED', submittedAt: '2026-11-02T11:00:00Z', body: 'cap it' },
      // An empty "commented" review is the envelope of line comments: no entry.
      { author: 'kalani', state: 'COMMENTED', submittedAt: '2026-11-02T10:00:00Z' },
      // No date (Azure votes): sidebar only.
      { author: 'alex', state: 'APPROVED' },
      { author: 'alex', state: 'APPROVED', submittedAt: '2026-11-05T10:00:00Z' }
    ]
  })
  const items = buildPrTimeline(detail, [commit('c1', 'sam', '2026-11-01T12:00:00Z')])

  it('puts the description first and the rest in time order', () => {
    expect(items.map((i) => i.kind)).toEqual(['description', 'push', 'thread', 'review', 'comment', 'thread', 'review'])
  })

  it('filters by kind, and the open-threads chip keeps only open threads', () => {
    expect(filterPrTimeline(items, 'comments').map((i) => i.kind)).toEqual([
      'description',
      'thread',
      'comment',
      'thread'
    ])
    expect(filterPrTimeline(items, 'reviews').map((i) => i.kind)).toEqual(['thread', 'review', 'thread', 'review'])
    expect(filterPrTimeline(items, 'commits').map((i) => i.kind)).toEqual(['push'])
    expect(filterPrTimeline(items, 'all', true).map((i) => i.id)).toEqual(['t:7'])
    expect(countOpenThreads(detail.reviewThreads)).toBe(1)
  })

  it('counts a thread of unknown state as neither open nor resolved', () => {
    expect(countOpenThreads([thread(1, '2026-11-01T00:00:00Z')])).toBe(0)
  })
})

describe('getPrPersonRoles', () => {
  it('names the author and anyone who reviewed or was asked to', () => {
    const detail = pr({
      reviews: [{ author: 'kalani', state: 'COMMENTED' }],
      requestedReviewers: [{ login: 'alex' }, { login: 'org/team', team: true }]
    })
    expect(getPrPersonRoles(detail, 'sam')).toEqual({ author: true, reviewer: false })
    expect(getPrPersonRoles(detail, 'kalani')).toEqual({ author: false, reviewer: true })
    expect(getPrPersonRoles(detail, 'alex')).toEqual({ author: false, reviewer: true })
    expect(getPrPersonRoles(detail, 'org/team')).toEqual({ author: false, reviewer: false })
    expect(getPrPersonRoles(detail, 'robin')).toEqual({ author: false, reviewer: false })
  })
})

describe('getHunkLines', () => {
  it('numbers each line on its own side and keeps the last ones', () => {
    const hunk = [
      '@@ -38,4 +38,4 @@ export',
      ' const a = 1',
      '',
      ' export function search(q) {',
      '-  return all()',
      '+  return find(q)'
    ].join('\n')
    expect(getHunkLines(hunk, 3)).toEqual([
      { kind: 'ctx', line: 40, text: 'export function search(q) {' },
      { kind: 'del', line: 41, text: '  return all()' },
      { kind: 'add', line: 41, text: '  return find(q)' }
    ])
  })

  it('is empty for a host that sends no hunk, and skips the no-newline marker', () => {
    expect(getHunkLines('')).toEqual([])
    expect(getHunkLines('@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n')).toEqual([
      { kind: 'del', line: 1, text: 'a' },
      { kind: 'add', line: 1, text: 'b' }
    ])
  })
})

describe('prVisits', () => {
  beforeAll(() => useSettingsStore.setState({ loaded: true }))

  it('keys a pull request by the remote identity, not its spelling', () => {
    expect(getPrVisitKey('git@github.com:Example/Repo.git', 4)).toBe(
      getPrVisitKey('https://github.com/example/repo', 4)
    )
    expect(getPrVisitKey('https://github.com/example/repo.git', 4)).not.toBe(
      getPrVisitKey('https://github.com/example/repo.git', 5)
    )
  })

  it('splits items at the last visit; a first visit has nothing new', () => {
    const items = [{ at: 1 }, { at: 5 }, { at: 9 }]
    expect(splitByLastVisit(items, 5)).toEqual({ seen: [{ at: 1 }, { at: 5 }], fresh: [{ at: 9 }] })
    expect(splitByLastVisit(items, null)).toEqual({ seen: items, fresh: [] })
  })

  it('keeps only the most recent visits and ignores unreadable ones', () => {
    const map = withVisit({ a: 1, b: 3, c: 2 }, 'd', 4, 3)
    expect(Object.keys(map).sort()).toEqual(['b', 'c', 'd'])
    expect(getVisitFrom({ a: Number.NaN }, 'a')).toBeNull()
    expect(getVisitFrom(undefined, 'a')).toBeNull()
  })

  it('records and reads a visit through the settings store', () => {
    const key = getPrVisitKey('https://github.com/example/repo.git', 9)
    expect(getLastVisit(key)).toBeNull()
    recordVisit(key, 1234)
    expect(getLastVisit(key)).toBe(1234)
    expect(useSettingsStore.getState().settings.prVisits?.[key]).toBe(1234)
  })
})

describe('getReviewThreadResolution', () => {
  it('maps each thread by its first comment id, across pages', async () => {
    const pages = [
      {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: true, endCursor: 'x' },
              nodes: [
                { isResolved: true, comments: { nodes: [{ databaseId: 11 }] } },
                { isResolved: false, comments: { nodes: [] } }
              ]
            }
          }
        }
      },
      {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: false },
              nodes: [{ isResolved: false, comments: { nodes: [{ databaseId: 12 }] } }]
            }
          }
        }
      }
    ]
    const asked: unknown[] = []
    const post = (async (_q: string, vars: Record<string, unknown>) => {
      asked.push(vars.after)
      return pages.shift()
    }) as GithubGraphqlPost
    const map = await getReviewThreadResolution(post, 'example', 'repo', 42)
    expect([...map]).toEqual([
      [11, true],
      [12, false]
    ])
    expect(asked).toEqual([null, 'x'])
  })
})
