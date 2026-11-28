import { describe, expect, it } from 'vitest'
import { getChangedLines } from '../src/renderer/src/lib/changedLines'

const lines = (...xs: string[]): string => xs.join('\n')

describe('the lines an edit changed', () => {
  it('marks nothing when the text is the same', () => {
    expect([...getChangedLines(lines('a', 'b'), lines('a', 'b'))]).toEqual([])
  })

  it('marks an edited line and added lines, by their place in the draft', () => {
    const original = lines('# BugShop', '', '## Quick Bisect', 'run tests')
    const draft = lines('# BugShop', '', '## Quick Bisect', 'git bisect start', 'git bisect bad', 'run tests')
    expect([...getChangedLines(original, draft)]).toEqual([3, 4])
    expect([...getChangedLines(lines('a', 'b', 'c'), lines('a', 'B', 'c'))]).toEqual([1])
  })

  it('marks nothing for a pure deletion — there is no line left to tint', () => {
    expect([...getChangedLines(lines('a', 'b', 'c'), lines('a', 'c'))]).toEqual([])
  })

  it('keeps unchanged lines between two edits unmarked', () => {
    expect([...getChangedLines(lines('a', 'b', 'c', 'd'), lines('A', 'b', 'c', 'D'))]).toEqual([0, 3])
  })

  it('marks the whole middle when it is too large to match line by line', () => {
    const big = Array.from({ length: 600 }, (_, i) => `line ${i}`)
    const edited = big.map((l, i) => (i % 2 ? `${l}!` : l))
    const changed = getChangedLines(big.join('\n'), edited.join('\n'))
    expect(changed.has(1)).toBe(true)
    expect(changed.size).toBeGreaterThan(500)
  })
})
