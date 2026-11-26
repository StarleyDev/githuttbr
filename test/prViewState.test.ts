import { describe, it, expect } from 'vitest'
import {
  clampScrollTop,
  collectOrphanDrafts,
  createPrViewStates,
  getClosedPrViewKeys,
  getOpenPrPages,
  getPrViewKey,
  hasUnsentDrafts
} from '../src/renderer/src/lib/prViewState'

// A pull request page's remembered place for the app session: one state per
// repository + remote + number, least recently used out (drafts last), a saved
// scroll that still fits, drafts whose place is gone kept as notices, and the
// tab-list rule that tells a close from a ‹ › swap.

const prPage = (number: number, repoPath = '/repos/app', remoteUrl = 'https://example.test/team/app'): Record<string, unknown> => ({
  type: 'pr',
  repoPath,
  remoteUrl,
  number,
  title: `PR ${number}`
})

describe('PR view state', () => {
  it('keys by repository, remote and number', () => {
    expect(getPrViewKey('/a', 'r', 1)).not.toBe(getPrViewKey('/a', 'r', 2))
    expect(getPrViewKey('/a', 'r', 1)).not.toBe(getPrViewKey('/b', 'r', 1))
    expect(getPrViewKey('/a', 'r', 1)).not.toBe(getPrViewKey('/a', 's', 1))
    const states = createPrViewStates()
    const one = states.getOrCreateViewState(getPrViewKey('/a', 'r', 1))
    one.section = 'files'
    expect(states.getOrCreateViewState(getPrViewKey('/a', 'r', 1))).toBe(one)
    expect(states.getOrCreateViewState(getPrViewKey('/a', 'r', 2)).section).toBe('conversation')
  })

  it('drops the least recently used past the cap, and one with unsent text only last', () => {
    const states = createPrViewStates(3)
    states.getOrCreateViewState('a').comment = 'half a review'
    states.getOrCreateViewState('b')
    states.getOrCreateViewState('c')
    states.getOrCreateViewState('d') // a is the oldest, but holds a draft: b goes
    expect(states.getViewKeys()).toEqual(['a', 'c', 'd'])
    states.getViewState('c') // touched
    states.getOrCreateViewState('e')
    expect(states.getViewKeys()).toEqual(['a', 'c', 'e'])
    // Every one holding text: the oldest goes after all.
    for (const k of ['c', 'e']) states.getViewState(k)!.comment = 'x'
    states.getOrCreateViewState('f').comment = 'y'
    expect(states.getViewKeys()).toEqual(['c', 'e', 'f'])
  })

  it('a removed state is no longer the one a mounted page writes into', () => {
    const states = createPrViewStates()
    const s = states.getOrCreateViewState('k')
    states.removeViewState('k')
    expect(states.hasViewState('k', s)).toBe(false)
    expect(states.getOrCreateViewState('k')).not.toBe(s)
  })

  it('clamps a saved scroll to content that got shorter', () => {
    expect(clampScrollTop(900, 1000, 400)).toBe(600)
    expect(clampScrollTop(200, 1000, 400)).toBe(200)
    expect(clampScrollTop(300, 200, 400)).toBe(0)
  })

  it('sees unsent text in every box', () => {
    const s = createPrViewStates().getOrCreateViewState('k')
    expect(hasUnsentDrafts(s)).toBe(false)
    s.replyDrafts.t1 = '  '
    expect(hasUnsentDrafts(s)).toBe(false)
    s.lineText.current = 'nit'
    expect(hasUnsentDrafts(s)).toBe(true)
    s.lineText.current = ''
    s.editDrafts.c1 = { text: 'same', original: 'same' }
    expect(hasUnsentDrafts(s)).toBe(false)
    s.editDrafts.c1 = { text: 'changed', original: 'same' }
    expect(hasUnsentDrafts(s)).toBe(true)
  })

  it('keeps a draft whose place is gone as a notice, never dropping it', () => {
    const s = createPrViewStates().getOrCreateViewState('k')
    s.replyDrafts = { t1: 'still here', t2: 'thread gone', t3: '' }
    s.editDrafts = { c1: { text: 'new words', original: 'old' }, c2: { text: 'same', original: 'same' } }
    s.lineDraft = { anchor: { path: 'src/gone.ts', kind: 'add', oldLine: null, newLine: 12 } }
    s.lineText.current = 'rename this'
    // Not loaded yet: nothing moves.
    expect(collectOrphanDrafts(s, { threadIds: null, commentKeys: null, filePaths: null })).toBe(false)
    expect(
      collectOrphanDrafts(s, { threadIds: new Set(['t1']), commentKeys: new Set(), filePaths: new Set(['src/kept.ts']) })
    ).toBe(true)
    expect(s.replyDrafts).toEqual({ t1: 'still here' })
    expect(s.editDrafts).toEqual({})
    expect(s.lineDraft).toBeNull()
    expect(s.orphans.map((o) => [o.kind, o.text])).toEqual([
      ['reply', 'thread gone'],
      ['edit', 'new words'],
      ['line', 'rename this']
    ])
    expect(s.orphans[2]).toMatchObject({ path: 'src/gone.ts', line: 12 })
    // A line draft on a file still listed stays where it is (the diff shows it above the lines).
    s.lineDraft = { anchor: { path: 'src/kept.ts', kind: 'del', oldLine: 3, newLine: null } }
    s.lineText.current = 'why?'
    collectOrphanDrafts(s, { threadIds: null, commentKeys: null, filePaths: new Set(['src/kept.ts']) })
    expect(s.lineDraft).not.toBeNull()
  })

  it('a close discards a PR’s state; ‹ › swapping the PR in its slot keeps both', () => {
    const tabs = (...pages: Array<Record<string, unknown>>): Array<{ kind: string; pages?: unknown[]; page?: unknown }> => [
      { kind: 'repo', pages },
      { kind: 'page', page: { type: 'changelog' } }
    ]
    const k = (n: number): string => getPrViewKey('/repos/app', 'https://example.test/team/app', n)
    const none = (): boolean => false
    const two = getOpenPrPages(tabs(prPage(1), prPage(2)))
    expect(two.slots).toBe(2)
    // ‹ ›: PR 2 becomes PR 3 in the same slot.
    expect(getClosedPrViewKeys(two, getOpenPrPages(tabs(prPage(1), prPage(3))), none)).toEqual([])
    // ✕ on PR 2.
    expect(getClosedPrViewKeys(two, getOpenPrPages(tabs(prPage(1))), none)).toEqual([k(2)])
    // A bulk close of a PR holding unsent text keeps it, for when the PR is reopened.
    expect(getClosedPrViewKeys(two, getOpenPrPages([]), (key) => key === k(1))).toEqual([k(2)])
    // A page tab of its own counts the same.
    expect(getOpenPrPages([{ kind: 'page', page: prPage(9) }]).keys.has(k(9))).toBe(true)
  })
})
