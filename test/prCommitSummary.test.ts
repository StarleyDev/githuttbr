import { describe, it, expect } from 'vitest'
import type { PrCommit, PrFile } from '../src/shared/types'
import {
  getCommitSubjectParts,
  getCommitTypeTone,
  getCompareEnds,
  getPrCommitSummary
} from '../src/renderer/src/lib/prCommitSummary'
import { filterPrFiles, getNextUnviewedFile, getPrFileOrder } from '../src/renderer/src/lib/prFilesProgress'

// The pull request page's Commits summary and Files progress: pure parts.

const commit = (sha: string, subject: string, authorName = 'Sam Rivera', authorLogin?: string): PrCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  subject,
  authorName,
  ...(authorLogin ? { authorLogin } : {}),
  authoredAt: '2026-11-18T09:00:00Z'
})

describe('a commit subject’s Conventional Commit parts', () => {
  it('splits type, bare scope, breaking mark and the rest', () => {
    expect(getCommitSubjectParts('feat(search)!: list files')).toEqual({
      type: 'feat',
      scope: 'search',
      breaking: true,
      rest: 'list files'
    })
    expect(getCommitSubjectParts('fix: trim')).toEqual({ type: 'fix', scope: '', breaking: false, rest: 'trim' })
  })

  it('leaves any other subject whole, an unknown type included', () => {
    expect(getCommitSubjectParts('Merge branch main')).toEqual({ type: '', scope: '', breaking: false, rest: 'Merge branch main' })
    expect(getCommitSubjectParts('wip(x): y').type).toBe('')
  })

  it('gives the reviewer-facing types a tone and the rest a quiet one', () => {
    expect(getCommitTypeTone('feat')).toBe('green')
    expect(getCommitTypeTone('fix')).toBe('red')
    expect(getCommitTypeTone('test')).toBe('accent')
    expect(getCommitTypeTone('perf')).toBe('yellow')
    expect(getCommitTypeTone('docs')).toBe('neutral')
  })
})

describe('the Commits summary', () => {
  it('counts commits, distinct authors and each type in the composer’s order', () => {
    const s = getPrCommitSummary([
      commit('a', 'test(search): cover'),
      commit('b', 'feat(search): add', 'Sam Rivera', 'sam'),
      commit('c', 'fix: trim', 'Alex Chen'),
      commit('d', 'feat: more', 'sam rivera', 'SAM'),
      commit('e', 'Update README', 'alex chen')
    ])
    expect(s.commits).toBe(5)
    // "Sam Rivera" without a login is a name; with one, the account — two people
    // here, as the host would tell them apart. "Alex Chen" twice, case aside.
    expect(s.authors).toBe(3)
    expect(s.types).toEqual([
      { type: 'feat', count: 2 },
      { type: 'fix', count: 1 },
      { type: 'test', count: 1 }
    ])
  })
})

describe('the two commits picked for a comparison', () => {
  const list = [commit('a', 'x'), commit('b', 'y'), commit('c', 'z')]

  it('takes the one listed first as the base, whatever order they were picked in', () => {
    expect(getCompareEnds(list, ['c', 'a'])).toEqual({ base: 'a', tip: 'c' })
    expect(getCompareEnds(list, ['a', 'b'])).toEqual({ base: 'a', tip: 'b' })
  })

  it('is nothing until two commits of the list are picked', () => {
    expect(getCompareEnds(list, ['a'])).toBeNull()
    expect(getCompareEnds(list, ['a', 'gone'])).toBeNull()
    expect(getCompareEnds(list, ['a', 'a'])).toBeNull()
  })
})

const file = (filename: string): PrFile => ({ filename, status: 'modified', additions: 1, deletions: 1 })

describe('the Files tab filter and "next unviewed"', () => {
  const files = [file('src/b.ts'), file('README.md'), file('src/a.ts'), file('docs/guide.md')]

  it('keeps the files not viewed, or those with review conversations', () => {
    const viewed = new Set(['src/b.ts'])
    const threads = new Map([['README.md', 2], ['src/a.ts', 0]])
    expect(filterPrFiles(files, 'all', viewed, threads)).toBe(files)
    expect(filterPrFiles(files, 'unviewed', viewed, threads).map((f) => f.filename)).toEqual([
      'README.md',
      'src/a.ts',
      'docs/guide.md'
    ])
    expect(filterPrFiles(files, 'commented', viewed, threads).map((f) => f.filename)).toEqual(['README.md'])
  })

  it('walks the files in the order the list draws them', () => {
    expect(getPrFileOrder(files, 'path')).toEqual(['src/b.ts', 'README.md', 'src/a.ts', 'docs/guide.md'])
    // The tree draws folders first, each sorted: the walk follows it, not the host's order.
    expect(getPrFileOrder(files, 'tree')).toEqual(['docs/guide.md', 'src/a.ts', 'src/b.ts', 'README.md'])
  })

  it('finds the next file not viewed after the open one, wrapping round', () => {
    const order = ['a', 'b', 'c', 'd']
    expect(getNextUnviewedFile(order, new Set(['b']), 'a')).toBe('c')
    expect(getNextUnviewedFile(order, new Set(['d']), 'c')).toBe('a')
    expect(getNextUnviewedFile(order, new Set(), '')).toBe('a')
    expect(getNextUnviewedFile(order, new Set(['a', 'b', 'c', 'd']), 'a')).toBeNull()
  })
})
