import { describe, expect, it } from 'vitest'
import {
  buildSearchIndex,
  canMoveSection,
  filterSearchIndex,
  matchesSidebarQuery,
  mergeSectionOrder,
  moveSectionBefore,
  moveSectionBy,
  normalizeSidebarQuery,
  resolveSectionOpen,
  sectionCount,
  splitSectionsByMatches,
  totalMatches
} from '../src/renderer/src/lib/sidebarFilter'

describe('sidebar filter matching', () => {
  const branches = [{ name: 'main' }, { name: 'feature/Login' }, { name: 'fix/logout' }, { name: 'release/1.2' }]
  const index = buildSearchIndex(branches, (b) => [b.name])

  it('normalizes the query', () => {
    expect(normalizeSidebarQuery('  LoG ')).toBe('log')
    expect(normalizeSidebarQuery('   ')).toBe('')
  })

  it('matches case-insensitively by substring', () => {
    expect(filterSearchIndex(index, 'log').map((b) => b.name)).toEqual(['feature/Login', 'fix/logout'])
  })

  it('returns the original array identity when not filtering', () => {
    expect(filterSearchIndex(index, '')).toBe(branches)
  })

  it('finds nothing for an unmatched query', () => {
    expect(filterSearchIndex(index, 'zzz')).toEqual([])
  })

  it('matches any of several fields, but never across the seam between them', () => {
    const prs = [{ id: 12, title: 'Add search', source: 'feat/search' }]
    const prIndex = buildSearchIndex(prs, (p) => [`#${p.id}`, p.title, p.source])
    expect(filterSearchIndex(prIndex, '#12')).toHaveLength(1)
    expect(filterSearchIndex(prIndex, 'feat/sea')).toHaveLength(1)
    // "search" + "feat" joined would only match if fields were concatenated.
    expect(filterSearchIndex(prIndex, 'searchfeat')).toHaveLength(0)
  })

  it('skips null and undefined fields', () => {
    const stashes = [{ message: 'WIP', branch: null as string | null }]
    const idx = buildSearchIndex(stashes, (s) => [s.message, s.branch])
    expect(filterSearchIndex(idx, 'null')).toHaveLength(0)
    expect(matchesSidebarQuery('null', 'WIP', null, undefined)).toBe(false)
    expect(matchesSidebarQuery('wip', 'WIP', null)).toBe(true)
    expect(matchesSidebarQuery('', 'anything')).toBe(true)
  })

  it('scans ten thousand refs quickly once indexed', () => {
    const many = Array.from({ length: 12000 }, (_, i) => ({ name: `feature/team-${i % 40}/ticket-${i}` }))
    const big = buildSearchIndex(many, (b) => [b.name])
    const start = performance.now()
    for (const q of ['t', 'ti', 'tic', 'ticket-1', 'ticket-11', 'ticket-119']) filterSearchIndex(big, q)
    expect(performance.now() - start).toBeLessThan(250)
    expect(filterSearchIndex(big, 'ticket-11999')).toHaveLength(1)
  })
})

describe('sidebar section counts', () => {
  it('shows the plain total when idle and matched-of-total while filtering', () => {
    expect(sectionCount({ matched: 3, total: 41 }, false)).toEqual({ kind: 'plain', n: 41 })
    expect(sectionCount({ matched: 3, total: 41 }, true)).toEqual({ kind: 'of', n: 3, total: 41 })
  })

  const tallies = {
    local: { matched: 3, total: 41 },
    remotes: { matched: 0, total: 120 },
    tags: { matched: 2, total: 9 },
    stashes: { matched: 0, total: 0 }
  }

  it('folds zero-match sections out of the list only while filtering', () => {
    const order = ['local', 'remotes', 'tags', 'stashes']
    expect(splitSectionsByMatches(order, tallies, true)).toEqual({
      shown: ['local', 'tags'],
      empty: ['remotes', 'stashes']
    })
    expect(splitSectionsByMatches(order, tallies, false)).toEqual({ shown: order, empty: [] })
  })

  it('treats a section without a tally as empty', () => {
    expect(splitSectionsByMatches(['local', 'mystery'], tallies, true).empty).toEqual(['mystery'])
  })

  it('sums the results across the visible sections', () => {
    expect(totalMatches(['local', 'remotes', 'tags'], tallies)).toBe(5)
    expect(totalMatches(['tags'], tallies)).toBe(2)
    expect(totalMatches([], tallies)).toBe(0)
  })
})

describe('sidebar section order', () => {
  it('merges a saved order with the sections that exist now', () => {
    expect(mergeSectionOrder(['tags', 'local', 'gone'], ['local', 'remotes', 'tags'])).toEqual([
      'tags',
      'local',
      'remotes'
    ])
  })

  it('falls back to the available order when nothing is saved, and drops duplicates', () => {
    expect(mergeSectionOrder(undefined, ['a', 'b'])).toEqual(['a', 'b'])
    expect(mergeSectionOrder(['b', 'b', 'a'], ['a', 'b'])).toEqual(['b', 'a'])
  })

  it('drops a dragged section before its target', () => {
    expect(moveSectionBefore(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
    expect(moveSectionBefore(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c'])
    expect(moveSectionBefore(['a', 'b', 'c'], 'a', 'missing')).toEqual(['b', 'c', 'a'])
    expect(moveSectionBefore(['a', 'b'], 'a', 'a')).toEqual(['a', 'b'])
    expect(moveSectionBefore(['a', 'b'], 'x', 'a')).toEqual(['a', 'b'])
  })

  it('moves one step up or down with the keyboard', () => {
    expect(moveSectionBy(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveSectionBy(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op at either end', () => {
    expect(moveSectionBy(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveSectionBy(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
    expect(canMoveSection(['a', 'b', 'c'], 'a', -1)).toBe(false)
    expect(canMoveSection(['a', 'b', 'c'], 'c', 1)).toBe(false)
    expect(canMoveSection(['a', 'b', 'c'], 'b', 1)).toBe(true)
    expect(canMoveSection(['a', 'b'], 'x', 1)).toBe(false)
  })

  it('steps past hidden sections, which keep their slots', () => {
    // `b` is hidden: moving `c` up lands it before `a`, the visible neighbour.
    const order = ['a', 'b', 'c', 'd']
    const visible = ['a', 'c', 'd']
    expect(moveSectionBy(order, 'c', -1, visible)).toEqual(['c', 'a', 'b', 'd'])
    expect(moveSectionBy(order, 'a', 1, visible)).toEqual(['b', 'c', 'a', 'd'])
  })
})

describe('sidebar section open state', () => {
  const base = { key: 'tags', defaultOpen: false, session: {}, filterDefault: true }

  it('uses the persisted choice, then the default, when idle', () => {
    expect(resolveSectionOpen({ ...base, persisted: { tags: true }, filtering: false })).toBe(true)
    expect(resolveSectionOpen({ ...base, persisted: {}, filtering: false })).toBe(false)
    expect(resolveSectionOpen({ ...base, persisted: undefined, filtering: false })).toBe(false)
  })

  it('ignores the persisted layout while filtering', () => {
    expect(resolveSectionOpen({ ...base, persisted: { tags: false }, filtering: true })).toBe(true)
    expect(
      resolveSectionOpen({ ...base, persisted: { tags: true }, filtering: true, filterDefault: false })
    ).toBe(false)
  })

  it('honours a toggle made during the filter', () => {
    expect(resolveSectionOpen({ ...base, persisted: {}, filtering: true, session: { tags: false } })).toBe(false)
    // ...and forgets it once the filter is gone.
    expect(resolveSectionOpen({ ...base, persisted: {}, filtering: false, session: { tags: true } })).toBe(false)
  })
})
