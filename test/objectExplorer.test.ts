import { describe, expect, it } from 'vitest'
import { formatIdentDate, isSameIdent, parseGitIdent } from '../src/renderer/src/lib/gitIdent'
import {
  EMPTY_HISTORY,
  canGoBack,
  canGoForward,
  findRefForRev,
  getCurrentStep,
  getCurrentTrail,
  getModeMeaning,
  goBack,
  goForward,
  goToStep,
  parsePathRev,
  sortTreeEntries,
  startTrail,
  stepInto
} from '../src/renderer/src/lib/objectTrail'

const REFS = ['HEAD', 'refs/heads/main', 'refs/heads/hotfix/x', 'refs/tags/v1.0.0', 'refs/remotes/origin/main']

describe('git identity lines', () => {
  it('reads name, email, epoch and offset', () => {
    const ident = parseGitIdent('Ada Lovelace <ada@example.com> 1764264060 -0300')
    expect(ident).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      epoch: 1764264060,
      tz: '-0300',
      offsetMinutes: -180
    })
    expect(parseGitIdent('Bob <b@example.com> 0 +0530')?.offsetMinutes).toBe(330)
  })

  it('refuses a line that is not an identity', () => {
    expect(parseGitIdent('')).toBeNull()
    expect(parseGitIdent('no email here 123 +0000')).toBeNull()
  })

  it('keeps an empty name or email, which git allows', () => {
    expect(parseGitIdent('<> 1 +0000')).toMatchObject({ name: '', email: '' })
  })

  it('formats the wall clock the author saw, with the offset beside it', () => {
    // 2026-11-27 17:21 UTC is 14:21 at -03:00.
    const ident = parseGitIdent('A <a@example.com> 1795800060 -0300')!
    const { date, zone } = formatIdentDate(ident, 'en-US')
    expect(zone).toBe('−03:00')
    expect(date).toContain('2026')
    expect(date).toMatch(/02:21|2:21|14:21/)
    expect(formatIdentDate(parseGitIdent('A <a@example.com> 0 +0545')!, 'en').zone).toBe('+05:45')
  })

  it('treats the same person at the same moment as the same identity', () => {
    const a = parseGitIdent('A <a@example.com> 10 +0000')
    expect(isSameIdent(a, parseGitIdent('A <a@example.com> 10 +0000'))).toBe(true)
    expect(isSameIdent(a, parseGitIdent('A <a@example.com> 11 +0000'))).toBe(false)
    expect(isSameIdent(a, null)).toBe(false)
  })
})

describe('object explorer refs and revisions', () => {
  it('finds the ref a revision names, in git order', () => {
    expect(findRefForRev('main', REFS)).toBe('refs/heads/main')
    expect(findRefForRev('v1.0.0', REFS)).toBe('refs/tags/v1.0.0')
    expect(findRefForRev('origin/main', REFS)).toBe('refs/remotes/origin/main')
    expect(findRefForRev('refs/heads/main', REFS)).toBe('refs/heads/main')
    expect(findRefForRev('HEAD', REFS)).toBe('HEAD')
    expect(findRefForRev('HEAD~1', REFS)).toBeNull()
    expect(findRefForRev('abc1234', REFS)).toBeNull()
  })

  it('splits a path revision into its commit and path', () => {
    expect(parsePathRev('HEAD:src/app.ts')).toEqual({ commit: 'HEAD', path: 'src/app.ts' })
    expect(parsePathRev('main:src/')).toEqual({ commit: 'main', path: 'src' })
    expect(parsePathRev('HEAD^{tree}')).toBeNull()
    expect(parsePathRev(':staged.txt')).toBeNull()
    expect(parsePathRev('HEAD:')).toBeNull()
  })

  it('names each mode and puts folders first', () => {
    expect(['100644', '100755', '040000', '120000', '160000', '1'].map(getModeMeaning)).toEqual([
      'file',
      'executable',
      'folder',
      'symlink',
      'submodule',
      'unknown'
    ])
    const sorted = sortTreeEntries([
      { kind: 'blob' as const, name: 'a' },
      { kind: 'tree' as const, name: 'b' },
      { kind: 'commit' as const, name: 'c' },
      { kind: 'tree' as const, name: 'd' }
    ])
    expect(sorted.map((e) => e.name)).toEqual(['b', 'd', 'a', 'c'])
  })
})

describe('object explorer trail and history', () => {
  const commit = { sha: 'c1', kind: 'commit' as const }
  const root = { sha: 't0', kind: 'tree' as const }
  const src = { sha: 't1', kind: 'tree' as const }
  const app = { sha: 'b1', kind: 'blob' as const }

  const walk = (): typeof EMPTY_HISTORY => {
    let h = startTrail(EMPTY_HISTORY, 'main', commit, REFS)
    h = stepInto(h, root, { via: 'tree' })
    h = stepInto(h, src, { via: 'entry', name: 'src', mode: '040000' })
    return stepInto(h, app, { via: 'entry', name: 'app.ts', mode: '100644' })
  }

  it('starts from the ref a revision names', () => {
    const h = startTrail(EMPTY_HISTORY, 'main', commit, REFS)
    expect(getCurrentTrail(h)?.origin).toEqual({ ref: 'refs/heads/main', role: 'branch', name: 'main' })
    expect(getCurrentTrail(startTrail(EMPTY_HISTORY, 'HEAD~1', commit, REFS))?.origin).toBeNull()
  })

  it('marks a commit tree as the root and gives children their names and paths', () => {
    const steps = getCurrentTrail(walk())!.steps
    expect(steps[1]).toMatchObject({ root: true, path: '', commit: 'c1', rev: 'main^{tree}' })
    expect(steps[2]).toMatchObject({ name: 'src', path: 'src', commit: 'c1', rev: 'main:src' })
    expect(steps[3]).toMatchObject({ name: 'app.ts', mode: '100644', path: 'src/app.ts', rev: 'main:src/app.ts' })
  })

  it('a parent commit is named by its sha, and a tree reached from it by that', () => {
    let h = startTrail(EMPTY_HISTORY, 'main', commit, REFS)
    h = stepInto(h, { sha: 'c0', kind: 'commit' }, { via: 'parent' })
    h = stepInto(h, root, { via: 'tree' })
    expect(getCurrentStep(h)).toMatchObject({ rev: 'c0^{tree}', commit: 'c0', root: true })
  })

  it('goes back and forward, and forward is lost after a new move', () => {
    let h = walk()
    expect(canGoForward(h)).toBe(false)
    h = goBack(goBack(h))
    expect(getCurrentStep(h)?.sha).toBe('t0')
    expect(canGoForward(h)).toBe(true)
    h = goForward(h)
    expect(getCurrentStep(h)?.sha).toBe('t1')
    h = stepInto(goBack(h), { sha: 'b9', kind: 'blob' }, { via: 'entry', name: 'README', mode: '100644' })
    expect(canGoForward(h)).toBe(false)
    expect(getCurrentTrail(h)!.steps.map((s) => s.sha)).toEqual(['c1', 't0', 'b9'])
  })

  it('clicking a chip goes back to it and drops what was past it', () => {
    let h = goToStep(walk(), 1)
    expect(getCurrentTrail(h)!.steps.map((s) => s.sha)).toEqual(['c1', 't0'])
    expect(getCurrentTrail(h)!.origin?.name).toBe('main')
    expect(canGoForward(h)).toBe(false)
    // …and Back returns to where the click was made.
    h = goBack(h)
    expect(getCurrentStep(h)?.sha).toBe('b1')
    // The current chip is not a move.
    expect(goToStep(h, 3)).toBe(h)
  })

  it('a typed revision starts a new trail, but Back still reaches the old one', () => {
    let h = startTrail(walk(), 'HEAD:src/app.ts', app, REFS)
    expect(getCurrentTrail(h)).toEqual({
      origin: null,
      steps: [
        {
          sha: 'b1',
          kind: 'blob',
          rev: 'HEAD:src/app.ts',
          path: 'src/app.ts',
          name: 'app.ts',
          commit: 'HEAD',
          commitRev: 'HEAD'
        }
      ]
    })
    expect(canGoBack(h)).toBe(true)
    h = goBack(h)
    expect(getCurrentTrail(h)!.steps).toHaveLength(4)
  })
})
