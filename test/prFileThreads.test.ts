import { describe, expect, it } from 'vitest'
import type { PrReviewThread } from '../src/shared/types'
import { getThreadCountsByPath, sumThreadCounts } from '../src/renderer/src/lib/prFileThreads'

const thread = (path: string, line: number | null = 1): PrReviewThread => ({
  path,
  line,
  diffHunk: '',
  rootId: `${path}:${line}`,
  comments: []
})

describe('review conversations per file', () => {
  it('counts each conversation on its file, outdated ones included', () => {
    const counts = getThreadCountsByPath([
      thread('src/a.ts', 3),
      thread('src/a.ts', 9),
      thread('src/a.ts', null),
      thread('docs/b.md')
    ])
    expect(counts.get('src/a.ts')).toBe(3)
    expect(counts.get('docs/b.md')).toBe(1)
    expect(counts.has('src/c.ts')).toBe(false)
  })

  it('skips a conversation with no path', () => {
    expect(getThreadCountsByPath([thread('')]).size).toBe(0)
  })

  it('adds up a folder from its files', () => {
    const counts = getThreadCountsByPath([thread('src/a.ts'), thread('src/a.ts'), thread('src/b.ts')])
    expect(sumThreadCounts(counts, ['src/a.ts', 'src/b.ts', 'src/c.ts'])).toBe(3)
    expect(sumThreadCounts(counts, [])).toBe(0)
  })
})
