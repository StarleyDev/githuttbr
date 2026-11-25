import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs release script, untyped on purpose
import { findHiddenMerges } from '../scripts/check-release-merges.mjs'

// The release guard: a merge the first-parent changelog would drop.

const line = (hash: string, parents: string, subject: string): string => `${hash}\t${parents}\t${subject}`

describe('findHiddenMerges', () => {
  it('flags a merge whose subject is not a conventional commit', () => {
    const log = [
      line('a1', 'p1', 'feat(ci): follow CI runs'),
      line('b2', 'p1 p2', "Merge branch 'feat/pr-review-footer'"),
      line('c3', 'p1 p2', 'feat(pr): keep the review actions fixed')
    ].join('\n')
    expect(findHiddenMerges(log).map((m: { hash: string }) => m.hash)).toEqual(['b2'])
  })

  it('leaves ordinary commits alone, conventional or not', () => {
    const log = [line('a1', 'p1', 'wip'), line('b2', 'p1', 'chore: release v1.0.0')].join('\n')
    expect(findHiddenMerges(log)).toEqual([])
  })
})
