import { describe, expect, it } from 'vitest'
import type { PageContent, PullRequest } from '../src/shared/types'
import {
  EMPTY_FILTERS,
  ME,
  authorOptions,
  awaitsMyReview,
  defaultNavEntries,
  effectiveFilters,
  filterPrList,
  filterSummary,
  hasActiveFilters,
  highlightParts,
  isMine,
  matchesQuery,
  prInTab,
  prListItems,
  prNavPosition,
  resolvePrNav,
  reviewerOptions,
  tabCounts,
  targetOptions,
  type PrListFilters,
  type PrListItem
} from '../src/renderer/src/lib/prList'
import { planReplace } from '../src/renderer/src/lib/tabPages'
import { formatCombo, comboFromEvent } from '../src/renderer/src/lib/shortcuts'

const ORIGIN = 'https://github.com/team/app.git'

const pr = (id: number, over: Partial<PullRequest> = {}): PullRequest => ({
  id,
  title: `Change ${id}`,
  author: 'ana',
  sourceBranch: `feat/${id}`,
  targetBranch: 'main',
  url: `https://github.com/team/app/pull/${id}`,
  isDraft: false,
  ...over
})
const item = (p: PullRequest): PrListItem => ({ pr: p, remoteUrl: ORIGIN })
const filters = (over: Partial<PrListFilters>): PrListFilters => ({ ...EMPTY_FILTERS, ...over })

describe('pull request list — tabs', () => {
  it('counts a draft as open too, and merged/closed apart', () => {
    const open = [pr(1), pr(2, { isDraft: true }), pr(3)]
    expect(prInTab(open[1], 'open')).toBe(true)
    expect(prInTab(open[1], 'drafts')).toBe(true)
    expect(prInTab(open[0], 'drafts')).toBe(false)
    expect(tabCounts(open, null)).toEqual({ open: 3, drafts: 1, merged: null, closed: null })
    const finished = [pr(4, { state: 'merged' }), pr(5, { state: 'closed' }), pr(6, { state: 'merged' })]
    expect(tabCounts(open, finished)).toEqual({ open: 3, drafts: 1, merged: 2, closed: 1 })
    // A draft that was closed is closed, not a draft.
    expect(prInTab(pr(7, { state: 'closed', isDraft: true }), 'drafts')).toBe(false)
  })
})

describe('pull request list — search', () => {
  const p = pr(482, {
    title: 'Pagamento via Pix com QR dinâmico',
    body: 'Adds the dynamic QR flow',
    sourceBranch: 'feat/pix-qr',
    targetBranch: 'release/sprint-42'
  })

  it('matches title, description, branches and the number; every word must match', () => {
    expect(matchesQuery(p, 'pix')).toBe(true)
    expect(matchesQuery(p, 'PIX qr')).toBe(true)
    expect(matchesQuery(p, 'dynamic')).toBe(true) // description
    expect(matchesQuery(p, 'sprint-42')).toBe(true) // target branch
    expect(matchesQuery(p, '#482')).toBe(true)
    expect(matchesQuery(p, '482')).toBe(true)
    expect(matchesQuery(p, 'pix boleto')).toBe(false)
    expect(matchesQuery(p, '')).toBe(true)
  })

  it('reads "#12" as a number, never as text inside "#123"', () => {
    expect(matchesQuery(pr(12), '#12')).toBe(true)
    expect(matchesQuery(pr(5, { body: 'follow-up of #123' }), '#12')).toBe(false)
  })

  it('splits a title where the search words are, case kept', () => {
    expect(highlightParts('Estorno parcial de Pix', 'pix')).toEqual([
      { text: 'Estorno parcial de ', hit: false },
      { text: 'Pix', hit: true }
    ])
    expect(highlightParts('abc', '')).toEqual([{ text: 'abc', hit: false }])
    // A number search marks nothing in the title.
    expect(highlightParts('Fix #12', '#12')).toEqual([{ text: 'Fix #12', hit: false }])
  })
})

describe('pull request list — who is "me"', () => {
  it('matches the signed-in login case-insensitively, and nobody when it is unknown', () => {
    expect(isMine(pr(1, { author: 'Octocat' }), 'octocat')).toBe(true)
    expect(isMine(pr(1, { author: 'octocat' }), null)).toBe(false)
  })

  it('awaits my review when main marked it or my login is among the requested', () => {
    expect(awaitsMyReview(pr(1, { awaitingYou: true }), null)).toBe(true)
    expect(awaitsMyReview(pr(1, { requestedReviewers: ['bruno', 'OctoCat'] }), 'octocat')).toBe(true)
    expect(awaitsMyReview(pr(1, { requestedReviewers: ['bruno'] }), 'octocat')).toBe(false)
  })

  it('drops a "me" filter when the account is unknown, rather than show an empty list', () => {
    const f = filters({ author: ME, reviewer: ME, query: 'x' })
    expect(effectiveFilters(f, null)).toEqual(filters({ query: 'x' }))
    expect(effectiveFilters(f, 'octocat')).toBe(f)
  })
})

describe('pull request list — filters', () => {
  const items = [
    item(pr(1, { author: 'octocat', targetBranch: 'main', ci: 'success' })),
    item(pr(2, { author: 'ana', targetBranch: 'release/42', ci: 'failure', requestedReviewers: ['octocat'] })),
    item(pr(3, { author: 'ana', targetBranch: 'main', requestedReviewers: ['bruno'] })),
    item(pr(4, { author: 'bruno', targetBranch: 'main', isDraft: true }))
  ]
  const ids = (f: Partial<PrListFilters>, tab: 'open' | 'drafts' = 'open'): number[] =>
    filterPrList(items, tab, filters(f), 'octocat').map((it) => it.pr.id)

  it('keeps what every filter allows', () => {
    expect(ids({})).toEqual([1, 2, 3, 4])
    expect(ids({ author: ME })).toEqual([1])
    expect(ids({ author: 'ana' })).toEqual([2, 3])
    expect(ids({ reviewer: ME })).toEqual([2])
    expect(ids({ reviewer: 'bruno' })).toEqual([3])
    expect(ids({ target: 'main' })).toEqual([1, 3, 4])
    expect(ids({ ciFailing: true })).toEqual([2])
    expect(ids({ author: 'ana', target: 'main' })).toEqual([3])
    expect(ids({}, 'drafts')).toEqual([4])
  })

  it('orders by the latest activity where the host gave one, keeping its order otherwise', () => {
    const dated = [
      item(pr(1, { updatedAt: '2026-01-01T00:00:00Z' })),
      item(pr(2, { updatedAt: '2026-03-01T00:00:00Z' })),
      item(pr(3, { updatedAt: '2026-02-01T00:00:00Z' }))
    ]
    expect(filterPrList(dated, 'open', EMPTY_FILTERS, null).map((it) => it.pr.id)).toEqual([2, 3, 1])
    expect(filterPrList(items, 'open', EMPTY_FILTERS, null).map((it) => it.pr.id)).toEqual([1, 2, 3, 4])
  })

  it('offers authors, reviewers and targets with counts — me left for the "Me" entry', () => {
    const prs = items.map((it) => it.pr)
    expect(authorOptions(prs, 'octocat')).toEqual([
      { value: 'ana', count: 2 },
      { value: 'bruno', count: 1 }
    ])
    expect(reviewerOptions(prs, 'octocat')).toEqual([{ value: 'bruno', count: 1 }])
    expect(targetOptions(prs)).toEqual([
      { value: 'main', count: 3 },
      { value: 'release/42', count: 1 }
    ])
    // Unknown "me": everybody is listed by name.
    expect(authorOptions(prs, null).map((a) => a.value)).toEqual(['ana', 'bruno', 'octocat'])
  })

  it('says which filters are on, as keys', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters(filters({ query: '  ' }))).toBe(false)
    expect(filterSummary(filters({ query: 'pix', author: ME, ciFailing: true }))).toEqual([
      { key: 'prList.sumSearch', vars: { query: 'pix' } },
      { key: 'prList.sumAuthorMe', vars: {} },
      { key: 'prList.sumCiFailing', vars: {} }
    ])
  })
})

describe('pull request list — rows from the repository store', () => {
  it('carries origin, then a fork’s own PRs on its parent with the parent’s remote', () => {
    const remotes = [
      { name: 'origin', url: 'https://user:secret@github.com/me/app.git' },
      { name: 'upstream', url: 'https://github.com/team/app.git' }
    ]
    const rows = prListItems([pr(1)], [pr(9)], remotes)
    expect(rows.map((r) => [r.pr.id, r.remoteUrl, r.upstream])).toEqual([
      [1, 'https://github.com/me/app.git', undefined],
      [9, 'https://github.com/team/app.git', 'team/app']
    ])
    expect(prListItems([pr(1)], [], [])).toEqual([])
  })
})

describe('pull request detail — ‹ ›', () => {
  const entries = [1, 2, 3].map((n) => ({ number: n, title: `Change ${n}`, remoteUrl: ORIGIN }))

  it('knows its place, with no wrap-around', () => {
    expect(prNavPosition(entries, 2, ORIGIN)).toEqual({ index: 1, total: 3, prev: entries[0], next: entries[2] })
    expect(prNavPosition(entries, 1, ORIGIN)?.prev).toBeNull()
    expect(prNavPosition(entries, 3, ORIGIN)?.next).toBeNull()
    expect(prNavPosition(entries, 4, ORIGIN)).toBeNull()
    // Same number, other remote (a fork's parent): not the same PR.
    expect(prNavPosition(entries, 2, 'https://github.com/other/app.git')).toBeNull()
  })

  it('walks the list it was opened from; anything else walks the open PRs', () => {
    const open = [item(pr(5)), item(pr(6, { isDraft: true })), item(pr(7, { state: 'merged' }))]
    const listNav = { entries: entries.slice(0, 2), filters: filters({ author: ME }), tab: 'open' as const }
    const fromList = resolvePrNav({ number: 2, remoteUrl: ORIGIN, via: 'list' }, listNav, open)
    expect(fromList.fromList).toBe(listNav)
    expect(fromList.position).toMatchObject({ index: 1, total: 2 })

    // Opened from the sidebar: the open PRs, drafts included, merged left out.
    expect(defaultNavEntries(open).map((e) => e.number)).toEqual([5, 6])
    const elsewhere = resolvePrNav({ number: 6, remoteUrl: ORIGIN }, listNav, open)
    expect(elsewhere.fromList).toBeNull()
    expect(elsewhere.position).toMatchObject({ index: 1, total: 2 })

    // From the list, but no longer on it (another list was opened since): the open PRs.
    expect(resolvePrNav({ number: 5, remoteUrl: ORIGIN, via: 'list' }, listNav, open).fromList).toBeNull()
    // On no walk at all: no arrows.
    expect(resolvePrNav({ number: 7, remoteUrl: ORIGIN }, undefined, open).position).toBeNull()
  })

  it('swaps the PR page in place, and never keeps the same PR twice', () => {
    const page = (n: number): PageContent => ({ type: 'pr', repoPath: '/r', remoteUrl: ORIGIN, number: n, title: '' })
    const wiki: PageContent = { type: 'wiki', repoPath: '/r' }
    expect(planReplace([wiki, page(1)], 1, page(1), page(2))).toEqual({ pages: [wiki, page(2)], activePage: 1 })
    // #2 already open: #1 goes, and #2 is the one shown.
    expect(planReplace([page(2), wiki, page(1)], 2, page(1), page(2))).toEqual({ pages: [page(2), wiki], activePage: 0 })
    expect(planReplace([page(1), wiki, page(2)], 1, page(1), page(2))).toEqual({ pages: [wiki, page(2)], activePage: 0 })
    expect(planReplace([wiki], 0, page(1), page(2))).toBeNull()
  })

  it('binds Alt+← / Alt+→, shown as arrows', () => {
    const ev = { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true, metaKey: false, ctrlKey: false, shiftKey: false } as KeyboardEvent
    expect(comboFromEvent(ev)).toBe('alt+ArrowLeft')
    expect(formatCombo('alt+ArrowRight')).toMatch(/→$/)
  })
})
