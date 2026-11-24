import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, unlinkSync, renameSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitService } from '../src/main/git'
import { splitDiffByFile, unquoteGitPath } from '../src/renderer/src/lib/diffFiles'

// The opener reads the dictionaries; only the open/close rules are under test.
vi.mock('../src/renderer/src/i18n', () => ({ t: (key: string) => key }))

import { useUIStore } from '../src/renderer/src/stores/ui'
import { openBranchCompare } from '../src/renderer/src/lib/branchCompare'

describe('splitDiffByFile', () => {
  it('reads status, paths and line counts per file', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      'index 1111111..2222222 100644',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,3 +1,3 @@',
      ' keep',
      // A removed line that itself starts with "-- " must not read as a header.
      '--- not a header',
      '+++ not a header either',
      ' keep',
      'diff --git a/new.txt b/new.txt',
      'new file mode 100644',
      'index 0000000..3333333',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1 @@',
      '+hello',
      'diff --git a/gone.txt b/gone.txt',
      'deleted file mode 100644',
      'index 4444444..0000000',
      '--- a/gone.txt',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-a',
      '-b',
      ''
    ].join('\n')
    const files = splitDiffByFile(diff)
    expect(files.map((f) => [f.path, f.status, f.additions, f.deletions])).toEqual([
      ['src/app.ts', 'M', 1, 1],
      ['new.txt', 'A', 1, 0],
      ['gone.txt', 'D', 0, 2]
    ])
    // Each patch is that file's slice only, so the viewer draws one file.
    expect(files[1].patch.startsWith('diff --git a/new.txt b/new.txt')).toBe(true)
    expect(files[1].patch).not.toContain('gone.txt')
  })

  it('keeps a pure rename and a binary change, which have no hunks', () => {
    const diff = [
      'diff --git a/old name.md b/new name.md',
      'similarity index 100%',
      'rename from old name.md',
      'rename to new name.md',
      'diff --git a/logo.png b/logo.png',
      'index 5555555..6666666 100644',
      'Binary files a/logo.png and b/logo.png differ'
    ].join('\n')
    expect(splitDiffByFile(diff)).toMatchObject([
      { path: 'new name.md', oldPath: 'old name.md', status: 'R', binary: false, additions: 0, deletions: 0 },
      { path: 'logo.png', status: 'M', binary: true }
    ])
  })

  it('undoes git’s quoting of non-ASCII paths', () => {
    expect(unquoteGitPath('"caf\\303\\251.txt"')).toBe('café.txt')
    expect(unquoteGitPath('"tab\\there"')).toBe('tab\there')
    expect(unquoteGitPath('plain.txt')).toBe('plain.txt')
  })

  it('names a file with spaces from its header when no ---/+++ line does', () => {
    const diff = [
      'diff --git a/my logo.png b/my logo.png',
      'new file mode 100644',
      'index 0000000..7777777',
      'Binary files /dev/null and b/my logo.png differ',
      'diff --git a/run me.sh b/run me.sh',
      'old mode 100644',
      'new mode 100755'
    ].join('\n')
    expect(splitDiffByFile(diff)).toMatchObject([
      { path: 'my logo.png', status: 'A', binary: true },
      { path: 'run me.sh', status: 'M', binary: false, additions: 0, deletions: 0 }
    ])
  })

  it('returns nothing for an empty diff', () => {
    expect(splitDiffByFile('')).toEqual([])
  })
})

// Real git: the diff compareBranches hands the view, split back into files.
describe('compareBranches output, split by file', () => {
  let dir: string
  const git = (...args: string[]): string =>
    execFileSync('git', ['-C', dir, '-c', 'user.name=T', '-c', 'user.email=t@example.com', ...args], {
      encoding: 'utf8'
    }).trim()

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'githuttbr-compare-'))
    git('init', '-q', '-b', 'main')
    writeFileSync(join(dir, 'keep.txt'), 'one\ntwo\nthree\n')
    writeFileSync(join(dir, 'drop.txt'), 'bye\n')
    writeFileSync(join(dir, 'move me.txt'), 'same content, long enough to be found as a rename\n')
    git('add', '.')
    git('commit', '-qm', 'base')
    git('checkout', '-qb', 'feature')
    writeFileSync(join(dir, 'keep.txt'), 'one\n2\nthree\n')
    git('commit', '-qam', 'feat: edit keep')
    writeFileSync(join(dir, 'café.txt'), 'new\n')
    unlinkSync(join(dir, 'drop.txt'))
    renameSync(join(dir, 'move me.txt'), join(dir, 'moved here.txt'))
    writeFileSync(join(dir, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255]))
    git('add', '-A')
    git('commit', '-qm', 'feat: add, drop, move, binary')
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('lists every changed file once, with the right status', async () => {
    const r = await gitService.compareBranches(dir, 'feature', 'main')
    expect(r.aheadCommits.map((c) => c.subject)).toEqual(['feat: add, drop, move, binary', 'feat: edit keep'])
    const byPath = Object.fromEntries(splitDiffByFile(r.diff).map((f) => [f.path, f]))
    expect(Object.keys(byPath).sort()).toEqual(['blob.bin', 'café.txt', 'drop.txt', 'keep.txt', 'moved here.txt'])
    expect(byPath['keep.txt']).toMatchObject({ status: 'M', additions: 1, deletions: 1 })
    expect(byPath['café.txt']).toMatchObject({ status: 'A', additions: 1 })
    expect(byPath['drop.txt']).toMatchObject({ status: 'D', deletions: 1 })
    expect(byPath['moved here.txt']).toMatchObject({ status: 'R', oldPath: 'move me.txt' })
    expect(byPath['blob.bin']).toMatchObject({ status: 'A', binary: true })
  })

  it('splits a single commit’s diff the same way', async () => {
    const [last] = (await gitService.compareBranches(dir, 'feature', 'main')).aheadCommits
    const files = splitDiffByFile(await gitService.commitDiff(dir, last.hash))
    expect(files.map((f) => f.path).sort()).toEqual(['blob.bin', 'café.txt', 'drop.txt', 'moved here.txt'])
  })
})

describe('openBranchCompare', () => {
  const target = { repoPath: '/repo', branchA: 'feature', branchB: 'main' }

  beforeEach(() => {
    useUIStore.setState({ compareView: null, commitEditView: null, conflictView: null, modal: null, toasts: [] })
  })

  it('opens in the centre pane on all changes and closes the dialog it came from', () => {
    useUIStore.setState({ modal: { kind: 'conflict-radar', repoPath: '/repo' } })
    openBranchCompare(target)
    const s = useUIStore.getState()
    expect(s.modal).toBeNull()
    expect(s.compareView).toEqual({ ...target, mode: 'all', commit: '', file: '' })
  })

  it('refuses while the commit editor is open in that repository, which would hide it', () => {
    useUIStore.setState({ commitEditView: { repoPath: '/repo', sha: 'a'.repeat(40), subject: 'x' } })
    openBranchCompare(target)
    expect(useUIStore.getState().compareView).toBeNull()
    expect(useUIStore.getState().toasts.at(-1)?.message).toBe('compare.closeEditorFirst')
  })

  it('opens when the editor belongs to another repository', () => {
    useUIStore.setState({ commitEditView: { repoPath: '/other', sha: 'a'.repeat(40), subject: 'x' } })
    openBranchCompare(target)
    expect(useUIStore.getState().compareView?.repoPath).toBe('/repo')
  })

  it('gives way to a file opened in the same repository, which would open out of sight', () => {
    openBranchCompare(target)
    useUIStore.getState().setFileView({ repoPath: '/other', file: 'a.ts', source: { type: 'tree' }, mode: 'file' })
    expect(useUIStore.getState().compareView).not.toBeNull()
    useUIStore.getState().setFileView({ repoPath: '/repo', file: 'a.ts', source: { type: 'tree' }, mode: 'file' })
    expect(useUIStore.getState().compareView).toBeNull()
  })

  it('gives way to a jump to a commit in the graph it covers', () => {
    openBranchCompare(target)
    // No repository named (an internal reset): nothing to close.
    useUIStore.getState().requestScrollTo('abc')
    expect(useUIStore.getState().compareView).not.toBeNull()
    useUIStore.getState().requestScrollTo('abc', '/other')
    expect(useUIStore.getState().compareView).not.toBeNull()
    useUIStore.getState().requestScrollTo(null, '/repo')
    expect(useUIStore.getState().compareView).not.toBeNull()
    useUIStore.getState().requestScrollTo('abc', '/repo')
    expect(useUIStore.getState().compareView).toBeNull()
    expect(useUIStore.getState().scrollToHash).toBe('abc')
  })

  it('updates only the comparison of that repository', () => {
    openBranchCompare(target)
    useUIStore.getState().updateCompareView('/other', { mode: 'commit' })
    expect(useUIStore.getState().compareView?.mode).toBe('all')
    useUIStore.getState().updateCompareView('/repo', { mode: 'commit', commit: 'abc' })
    expect(useUIStore.getState().compareView).toMatchObject({ mode: 'commit', commit: 'abc' })
  })
})
