import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitService } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'
import { countUniqueCommits, parseBranchTrackingConfig, parseRevListParents } from '../src/shared/branchCleanup'
import {
  filterCleanupRows,
  getBulkSelectableRows,
  getCleanupConfirmSummary,
  getDeletedShaList,
  getSquashCheckNames,
  getCleanupReasons,
  getCleanupRows,
  getDefaultCleanupSelection,
  getDeleteRequests,
  getRestoreRequests,
  getStaleCutoff,
  isCleanupRecommended,
  tallyDeleteResults
} from '../src/renderer/src/lib/branchCleanup'
import type { BranchCleanupCandidate, BranchCleanupScan, BranchDeleteResult } from '../src/shared/types'

// Linked worktrees live outside the fixture copies, so they are removed here.
const worktreeDirs: string[] = []
afterAll(() => {
  cleanupFixtures()
  for (const dir of worktreeDirs.splice(0)) rmSync(dir, { recursive: true, acceptedUnique: 99 })
})

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()

const DAY = 24 * 3600 * 1000
const NOW = Date.UTC(2026, 10, 25)

const candidate = (over: Partial<BranchCleanupCandidate>): BranchCleanupCandidate => ({
  name: 'feature/x',
  sha: 'a'.repeat(40),
  upstream: null,
  gone: false,
  merged: false,
  mergedInto: null,
  atMainTip: false,
  lastCommitAt: NOW - DAY,
  uniqueCommits: 0,
  uniqueCapped: false,
  ...over
})

describe('unique-commit counting', () => {
  // c3 → c2 → c1 is unique; c1's parent p0 is on a remote, so it is not in the set.
  const graph = parseRevListParents(['c3 c2', 'c2 c1', 'c1 p0', 'm2 c2 x9', ''].join('\n'))

  it('counts only the commits inside the unique set', () => {
    expect(countUniqueCommits(graph, 'c3')).toEqual({ count: 3, capped: false })
    expect(countUniqueCommits(graph, 'c1')).toEqual({ count: 1, capped: false })
  })

  it('counts a merge commit and both sides once', () => {
    expect(countUniqueCommits(graph, 'm2')).toEqual({ count: 3, capped: false })
  })

  it('is zero for a tip every remote or the default branch already reaches', () => {
    expect(countUniqueCommits(graph, 'p0')).toEqual({ count: 0, capped: false })
  })

  it('stops at the cap and says so', () => {
    expect(countUniqueCommits(graph, 'c3', 2)).toEqual({ count: 2, capped: true })
  })

  it('reads branch tracking config, branch names with dots and slashes included', () => {
    const cfg = parseBranchTrackingConfig(
      [
        'branch.pr/1.2-fix.remote origin',
        'branch.pr/1.2-fix.merge refs/heads/pr/1.2-fix',
        'branch.solo.remote .',
        'branch.solo.rebase true'
      ].join('\n')
    )
    expect(cfg.get('pr/1.2-fix')).toEqual({ remote: 'origin', merge: 'refs/heads/pr/1.2-fix' })
    expect(cfg.get('solo')).toEqual({ remote: '.' })
  })
})

describe('cleanup classification', () => {
  const cutoff = getStaleCutoff(NOW, 3)

  it('measures stale in calendar months', () => {
    expect(new Date(cutoff).toISOString().slice(0, 10)).toBe('2026-08-25')
    expect(getCleanupReasons(candidate({ lastCommitAt: cutoff - DAY }), cutoff)).toEqual(['stale'])
    expect(getCleanupReasons(candidate({ lastCommitAt: cutoff + DAY }), cutoff)).toEqual([])
  })

  it('lists the reasons in a fixed order', () => {
    const b = candidate({ gone: true, merged: true, lastCommitAt: cutoff - DAY })
    expect(getCleanupReasons(b, cutoff)).toEqual(['gone', 'merged', 'stale'])
  })

  it('recommends gone or merged with nothing to lose, and nothing else', () => {
    expect(isCleanupRecommended(candidate({ gone: true }), ['gone'])).toBe(true)
    expect(isCleanupRecommended(candidate({ merged: true }), ['merged'])).toBe(true)
    // Work that exists only here is never ticked for the user.
    expect(isCleanupRecommended(candidate({ gone: true, uniqueCommits: 2 }), ['gone'])).toBe(false)
    // Stale is only a date.
    expect(isCleanupRecommended(candidate({}), ['stale'])).toBe(false)
    // Sitting on main's tip: just created, not merged work.
    expect(isCleanupRecommended(candidate({ merged: true, atMainTip: true }), ['merged'])).toBe(false)
    // …unless the server deleted its upstream, which says the PR is done.
    expect(isCleanupRecommended(candidate({ merged: true, gone: true, atMainTip: true }), ['gone', 'merged'])).toBe(
      true
    )
  })

  const candidates = [
    candidate({ name: 'b-merged', merged: true }),
    candidate({ name: 'a-gone-unique', gone: true, uniqueCommits: 3 }),
    candidate({ name: 'c-stale', lastCommitAt: cutoff - DAY, uniqueCommits: 1 }),
    candidate({ name: 'd-active' }),
    candidate({ name: 'a-gone', gone: true })
  ]

  it('lists gone and merged rows, stale ones only on request, recommended first', () => {
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: false })
    expect(rows.map((r) => r.branch.name)).toEqual(['a-gone', 'b-merged', 'a-gone-unique'])
    const withStale = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: true })
    expect(withStale.map((r) => r.branch.name)).toEqual(['a-gone', 'b-merged', 'a-gone-unique', 'c-stale'])
  })

  it('pre-selects only the recommended rows', () => {
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: true })
    expect([...getDefaultCleanupSelection(rows)].sort()).toEqual(['a-gone', 'b-merged'])
  })

  it('accepts exactly the unique commits each ticked row showed, only for rows still listed', () => {
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: false })
    const req = getDeleteRequests(rows, new Set(['a-gone', 'a-gone-unique', 'c-stale']))
    expect(req).toEqual([
      { name: 'a-gone', sha: 'a'.repeat(40), acceptedUnique: 0 },
      { name: 'a-gone-unique', sha: 'a'.repeat(40), acceptedUnique: 3 }
    ])
  })

  it('never lets select-all reach a risky row', () => {
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: true })
    expect(getBulkSelectableRows(rows).map((r) => r.branch.name)).toEqual(['a-gone', 'b-merged'])
  })

  it('tells the confirm what is lost, as a floor, and what the list is hiding', () => {
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: true })
    const s = getCleanupConfirmSummary(rows, new Set(['a-gone', 'a-gone-unique', 'c-stale']), new Set(['a-gone']))
    expect(s.count).toBe(3)
    expect(s.risky.map((r) => r.name)).toEqual(['a-gone-unique', 'c-stale'])
    // Stacked branches share commits: the largest branch is all that is certain.
    expect(s.riskyCommitsAtLeast).toBe(3)
    expect(s.riskyCapped).toBe(false)
    expect(s.hidden).toBe(2)
  })

  it('treats a squash-merged gone branch as merged once checked', () => {
    const squashed = new Map([['a-gone-unique', 'origin/main']])
    expect(getSquashCheckNames(getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: true }))).toEqual([
      'a-gone-unique'
    ])
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: false, squashed })
    const row = rows.find((r) => r.branch.name === 'a-gone-unique')!
    expect(row).toMatchObject({ reasons: ['gone', 'squash'], risky: false, recommended: true, squashedInto: 'origin/main' })
    expect(getBulkSelectableRows(rows).map((r) => r.branch.name)).toContain('a-gone-unique')
    expect(getDeleteRequests(rows, new Set(['a-gone-unique']))).toEqual([
      { name: 'a-gone-unique', sha: 'a'.repeat(40), acceptedUnique: 0, squashMerged: true }
    ])
    const s = getCleanupConfirmSummary(rows, new Set(['a-gone-unique']), new Set(['a-gone-unique']))
    expect(s).toMatchObject({ squashed: 1, risky: [], hidden: 0 })
  })

  it('lists deleted branches with their short sha, capped', () => {
    const results: BranchDeleteResult[] = ['a', 'b', 'c'].map((n, i) => ({
      name: n,
      sha: String(i + 1).repeat(40),
      status: 'deleted'
    }))
    expect(getDeletedShaList(results, 2)).toEqual({
      entries: [
        { branch: 'a', sha: '1111111' },
        { branch: 'b', sha: '2222222' }
      ],
      more: 1
    })
  })

  it('filters by every word of the query', () => {
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: true })
    expect(filterCleanupRows(rows, 'GONE uniq').map((r) => r.branch.name)).toEqual(['a-gone-unique'])
    expect(filterCleanupRows(rows, '  ')).toHaveLength(rows.length)
  })

  it('restores only what was deleted, with its tracking config', () => {
    const results: BranchDeleteResult[] = [
      { name: 'a', sha: '1'.repeat(40), status: 'deleted', upstreamRemote: 'origin', upstreamMerge: 'refs/heads/a' },
      { name: 'b', sha: '2'.repeat(40), status: 'deleted' },
      { name: 'c', sha: '3'.repeat(40), status: 'refused', refusal: 'moved' }
    ]
    expect(getRestoreRequests(results)).toEqual([
      { name: 'a', sha: '1'.repeat(40), upstreamRemote: 'origin', upstreamMerge: 'refs/heads/a' },
      { name: 'b', sha: '2'.repeat(40) }
    ])
    expect(tallyDeleteResults(results)).toEqual({ deleted: 2, refused: 1, failed: 0 })
  })
})

describe('branch cleanup against real git (branch-cleanup playground)', () => {
  /** The fixture's origin is a shared bare repo: every test owns a copy of it too. */
  const isolatedClone = (): { repo: string; origin: string } => {
    const repo = cloneFixture('branch-cleanup')
    const origin = cloneFixture('branch-cleanup-origin.git')
    git(repo, 'remote', 'set-url', 'origin', origin)
    return { repo, origin }
  }
  const byName = (scan: BranchCleanupScan): Map<string, BranchCleanupCandidate> =>
    new Map(scan.candidates.map((c) => [c.name, c]))

  it('reports gone, merged, squash-merged, unpushed and stale branches', async () => {
    const { repo } = isolatedClone()
    const scan = await gitService.getBranchCleanupCandidates(repo)
    expect(scan.mainBranch).toBe('main')
    expect(scan.mainRef).toBe('origin/main')
    expect(scan.lastFetchAt).not.toBeNull()
    const c = byName(scan)
    expect(c.get('pr/1412-login-timeout')).toMatchObject({ gone: true, merged: true, uniqueCommits: 0 })
    expect(c.get('pr/1420-retry-banner')).toMatchObject({ gone: true, merged: true, uniqueCommits: 0 })
    // A squash merge is invisible to git: the branch reads as gone with its own commits.
    expect(c.get('pr/1398-dark-mode')).toMatchObject({ gone: true, merged: false, uniqueCommits: 2 })
    expect(c.get('wip/export-csv')).toMatchObject({ gone: true, merged: false, uniqueCommits: 2 })
    expect(c.get('feature/local-merge')).toMatchObject({ gone: false, merged: true, uniqueCommits: 0 })
    expect(c.get('feature/active-work')).toMatchObject({ gone: false, merged: false, uniqueCommits: 0 })
    expect(c.get('spike/graphql-idea')?.lastCommitAt).toBe(Date.parse('2024-03-04T10:00:00Z'))
    // The current/default branch and the protected release branch are never candidates.
    expect(c.has('main')).toBe(false)
    expect(c.has('release/1.0')).toBe(false)
    expect(scan.excluded).toEqual(
      expect.arrayContaining([
        { name: 'main', reason: 'current' },
        { name: 'release/1.0', reason: 'protected' }
      ])
    )
  })

  it('pre-selects the merged PR branches and the local merge, nothing with unique work', async () => {
    const { repo } = isolatedClone()
    const scan = await gitService.getBranchCleanupCandidates(repo)
    const rows = getCleanupRows(scan.candidates, { now: Date.now(), staleMonths: 3, includeStale: false })
    expect([...getDefaultCleanupSelection(rows)].sort()).toEqual([
      'feature/local-merge',
      'pr/1412-login-timeout',
      'pr/1420-retry-banner'
    ])
  })

  it('sees a branch go once the server deletes it and a fetch prunes it', async () => {
    const { repo, origin } = isolatedClone()
    expect(byName(await gitService.getBranchCleanupCandidates(repo)).get('feature/active-work')?.gone).toBe(false)
    git(origin, 'branch', '-D', 'feature/active-work')
    // Before the prune, the stale remote-tracking ref still says it exists.
    expect(byName(await gitService.getBranchCleanupCandidates(repo)).get('feature/active-work')?.gone).toBe(false)
    git(repo, 'fetch', '-q', '--prune', 'origin')
    const after = byName(await gitService.getBranchCleanupCandidates(repo)).get('feature/active-work')
    // Gone, and its one commit now exists nowhere but here: not merged, so not safe.
    expect(after).toMatchObject({ gone: true, merged: false, uniqueCommits: 1 })
  })

  it('excludes the current branch and branches checked out in a worktree', async () => {
    const { repo } = isolatedClone()
    git(repo, 'checkout', '-q', 'pr/1412-login-timeout')
    const wtRoot = mkdtempSync(join(tmpdir(), 'githuttbr-cleanup-wt-'))
    worktreeDirs.push(wtRoot)
    const wt = join(wtRoot, 'wt')
    git(repo, 'worktree', 'add', '-q', wt, 'feature/local-merge')
    const scan = await gitService.getBranchCleanupCandidates(repo)
    expect(scan.excluded).toEqual(
      expect.arrayContaining([
        { name: 'pr/1412-login-timeout', reason: 'current' },
        { name: 'feature/local-merge', reason: 'worktree' },
        { name: 'main', reason: 'default' }
      ])
    )
    const c = byName(scan)
    expect(c.has('pr/1412-login-timeout')).toBe(false)
    expect(c.has('feature/local-merge')).toBe(false)

    // The write refuses them even when asked directly.
    const sha = (b: string): string => git(repo, 'rev-parse', b)
    const res = await gitService.deleteLocalBranches(repo, [
      { name: 'pr/1412-login-timeout', sha: sha('pr/1412-login-timeout'), acceptedUnique: 99 },
      { name: 'feature/local-merge', sha: sha('feature/local-merge'), acceptedUnique: 99 },
      { name: 'main', sha: sha('main'), acceptedUnique: 99 },
      { name: 'release/1.0', sha: sha('release/1.0'), acceptedUnique: 99 }
    ])
    expect(res.map((r) => [r.name, r.status, r.refusal])).toEqual([
      ['pr/1412-login-timeout', 'refused', 'current'],
      ['feature/local-merge', 'refused', 'worktree'],
      ['main', 'refused', 'default'],
      ['release/1.0', 'refused', 'protected']
    ])
    for (const b of ['pr/1412-login-timeout', 'feature/local-merge', 'main', 'release/1.0']) {
      expect(sha(b)).toMatch(/^[0-9a-f]{40}$/)
    }
  })

  it('deletes merged branches, refuses unique work unless forced, and refuses a moved or missing branch', async () => {
    const { repo } = isolatedClone()
    const scan = byName(await gitService.getBranchCleanupCandidates(repo))
    const at = (n: string): string => scan.get(n)!.sha
    const res = await gitService.deleteLocalBranches(repo, [
      { name: 'pr/1412-login-timeout', sha: at('pr/1412-login-timeout'), acceptedUnique: 0 },
      { name: 'feature/local-merge', sha: at('feature/local-merge'), acceptedUnique: 0 },
      { name: 'pr/1398-dark-mode', sha: at('pr/1398-dark-mode'), acceptedUnique: 0 },
      { name: 'wip/export-csv', sha: at('wip/export-csv'), acceptedUnique: 2 },
      { name: 'pr/1420-retry-banner', sha: at('pr/1412-login-timeout'), acceptedUnique: 0 },
      { name: 'no/such-branch', sha: at('pr/1412-login-timeout'), acceptedUnique: 99 }
    ])
    expect(res.map((r) => [r.name, r.status, r.refusal])).toEqual([
      ['pr/1412-login-timeout', 'deleted', undefined],
      ['feature/local-merge', 'deleted', undefined],
      ['pr/1398-dark-mode', 'refused', 'unique'],
      ['wip/export-csv', 'deleted', undefined],
      ['pr/1420-retry-banner', 'refused', 'moved'],
      ['no/such-branch', 'refused', 'missing']
    ])
    const left = git(repo, 'for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads').split('\n')
    expect(left).not.toContain('pr/1412-login-timeout')
    expect(left).not.toContain('wip/export-csv')
    expect(left).toContain('pr/1398-dark-mode')
    expect(left).toContain('pr/1420-retry-banner')
    // The tracking config was captured before the delete, for the undo.
    expect(res[0]).toMatchObject({ upstreamRemote: 'origin', upstreamMerge: 'refs/heads/pr/1412-login-timeout' })
    expect(res[1].upstreamRemote).toBeUndefined()
  })

  it('undo recreates every deleted branch at its sha, with its upstream', async () => {
    const { repo } = isolatedClone()
    const scan = byName(await gitService.getBranchCleanupCandidates(repo))
    const names = ['pr/1412-login-timeout', 'wip/export-csv', 'feature/local-merge']
    const before = new Map(names.map((n) => [n, scan.get(n)!.sha]))
    const res = await gitService.deleteLocalBranches(
      repo,
      names.map((n) => ({ name: n, sha: before.get(n)!, acceptedUnique: scan.get(n)!.uniqueCommits }))
    )
    expect(res.every((r) => r.status === 'deleted')).toBe(true)
    expect(() => git(repo, 'config', '--get', 'branch.wip/export-csv.remote')).toThrow()

    const restored = await gitService.restoreLocalBranches(repo, getRestoreRequests(res))
    expect(restored.map((r) => r.status)).toEqual(['restored', 'restored', 'restored'])
    for (const n of names) expect(git(repo, 'rev-parse', n)).toBe(before.get(n))
    expect(git(repo, 'config', '--get', 'branch.wip/export-csv.remote')).toBe('origin')
    expect(git(repo, 'config', '--get', 'branch.wip/export-csv.merge')).toBe('refs/heads/wip/export-csv')
    expect(git(repo, 'for-each-ref', '--format=%(upstream:short) %(upstream:track)', 'refs/heads/wip/export-csv')).toBe(
      'origin/wip/export-csv [gone]'
    )
    expect(() => git(repo, 'config', '--get', 'branch.feature/local-merge.remote')).toThrow()
    // Back as candidates, exactly as before.
    expect(byName(await gitService.getBranchCleanupCandidates(repo)).get('wip/export-csv')).toMatchObject({
      gone: true,
      uniqueCommits: 2
    })

    // A second undo finds them in place and leaves them alone.
    const again = await gitService.restoreLocalBranches(repo, getRestoreRequests(res))
    expect(again.map((r) => r.status)).toEqual(['exists', 'exists', 'exists'])
  })

  it('refuses a branch holding more unique commits than the user accepted', async () => {
    const { repo } = isolatedClone()
    const at = git(repo, 'rev-parse', 'wip/export-csv')
    // The confirm showed 1 commit; there are 2. The redo case: a branch that
    // was safe when deleted, undone, and whose remote copy was pruned since.
    const res = await gitService.deleteLocalBranches(repo, [{ name: 'wip/export-csv', sha: at, acceptedUnique: 1 }])
    expect(res[0]).toMatchObject({ status: 'refused', refusal: 'unique' })
    expect(git(repo, 'rev-parse', 'wip/export-csv')).toBe(at)
  })

  it('restores beside a branch that took the name since, and reports it', async () => {
    const { repo } = isolatedClone()
    const old = git(repo, 'rev-parse', 'wip/export-csv')
    const res = await gitService.deleteLocalBranches(repo, [{ name: 'wip/export-csv', sha: old, acceptedUnique: 2 }])
    expect(res[0].status).toBe('deleted')
    // The PR checkout recreates the name at another commit.
    git(repo, 'branch', 'wip/export-csv', 'main')
    const restored = await gitService.restoreLocalBranches(repo, getRestoreRequests(res))
    const as = `wip/export-csv-restored-${old.slice(0, 7)}`
    expect(restored).toEqual([{ name: 'wip/export-csv', status: 'restoredAs', restoredAs: as }])
    expect(git(repo, 'rev-parse', as)).toBe(old)
    expect(git(repo, 'rev-parse', 'wip/export-csv')).toBe(git(repo, 'rev-parse', 'main'))
    expect(git(repo, 'config', '--get', `branch.${as}.merge`)).toBe('refs/heads/wip/export-csv')
  })

  it('excludes, and refuses to delete, a branch a rebase is replaying', async () => {
    const { repo } = isolatedClone()
    const at = git(repo, 'rev-parse', 'feature/active-work')
    // `--exec false` stops the rebase after its first pick: HEAD detached, the branch not current.
    expect(() =>
      execFileSync('git', ['-C', repo, 'rebase', '--exec', 'false', 'main', 'feature/active-work'], { stdio: 'ignore' })
    ).toThrow()
    const scan = await gitService.getBranchCleanupCandidates(repo)
    expect(scan.excluded).toContainEqual({ name: 'feature/active-work', reason: 'rebasing' })
    const res = await gitService.deleteLocalBranches(repo, [{ name: 'feature/active-work', sha: at, acceptedUnique: 99 }])
    expect(res[0]).toMatchObject({ status: 'refused', refusal: 'rebasing' })
  })

  it('names the local default branch when only it holds the merge', async () => {
    const { repo } = isolatedClone()
    git(repo, 'merge', '-q', '--no-ff', '-m', 'merge active work', 'feature/active-work')
    const c = byName(await gitService.getBranchCleanupCandidates(repo)).get('feature/active-work')
    expect(c).toMatchObject({ merged: true, mergedInto: 'main' })
    expect(byName(await gitService.getBranchCleanupCandidates(repo)).get('pr/1412-login-timeout')?.mergedInto).toBe(
      'origin/main'
    )
  })

  describe('squash merges', () => {
    const shaOf = (repo: string, ref: string): string => git(repo, 'rev-parse', ref)

    it('finds a squash-merged branch and leaves an unmerged one alone', async () => {
      const { repo } = isolatedClone()
      const res = await gitService.getSquashMergedBranches(repo, ['pr/1398-dark-mode', 'wip/export-csv', 'no/such'])
      expect(res).toEqual([
        { name: 'pr/1398-dark-mode', squashedInto: 'origin/main' },
        { name: 'wip/export-csv', squashedInto: null },
        { name: 'no/such', squashedInto: null }
      ])
    })

    it('still finds it after main moved on past the squash', async () => {
      const { repo } = isolatedClone()
      // Another commit lands on the server's main after the squash.
      git(repo, 'checkout', '-q', '-b', 'tmp-next', 'origin/main')
      git(repo, 'commit', '-q', '--allow-empty', '-m', 'chore: next release')
      writeFileSync(join(repo, 'CHANGELOG.md'), '# Changelog\n\n- dark mode\n')
      git(repo, 'add', 'CHANGELOG.md')
      git(repo, 'commit', '-q', '-m', 'docs: changelog')
      git(repo, 'update-ref', 'refs/remotes/origin/main', 'tmp-next')
      git(repo, 'checkout', '-q', 'main')
      const [res] = await gitService.getSquashMergedBranches(repo, ['pr/1398-dark-mode'])
      expect(res.squashedInto).toBe('origin/main')
    })

    it('does not call a branch squash-merged once it has a commit main lacks', async () => {
      const { repo } = isolatedClone()
      git(repo, 'checkout', '-q', 'pr/1398-dark-mode')
      execFileSync('git', ['-C', repo, 'commit', '-q', '--allow-empty', '-m', 'theme: one more tweak'])
      writeFileSync(join(repo, 'src', 'theme.ts'), 'export const theme = "high contrast"\n')
      git(repo, 'commit', '-qam', 'theme: high contrast')
      git(repo, 'checkout', '-q', 'main')
      const [res] = await gitService.getSquashMergedBranches(repo, ['pr/1398-dark-mode'])
      expect(res.squashedInto).toBeNull()
    })

    it('deletes on a squash acceptance only while the squash still holds', async () => {
      const { repo } = isolatedClone()
      const dark = shaOf(repo, 'pr/1398-dark-mode')
      const csv = shaOf(repo, 'wip/export-csv')
      // A squash acceptance for a branch that is not squash-merged is refused.
      const refused = await gitService.deleteLocalBranches(repo, [
        { name: 'wip/export-csv', sha: csv, acceptedUnique: 0, squashMerged: true }
      ])
      expect(refused[0]).toMatchObject({ status: 'refused', refusal: 'squashChanged' })

      // The server's main rewound to before the squash: the content is no longer there.
      const squashed = shaOf(repo, 'origin/main')
      git(repo, 'update-ref', 'refs/remotes/origin/main', 'origin/main~2')
      git(repo, 'checkout', '-q', '--detach')
      git(repo, 'branch', '-f', 'main', 'origin/main')
      git(repo, 'checkout', '-q', 'main')
      const gone = await gitService.deleteLocalBranches(repo, [
        { name: 'pr/1398-dark-mode', sha: dark, acceptedUnique: 0, squashMerged: true }
      ])
      expect(gone[0]).toMatchObject({ status: 'refused', refusal: 'squashChanged' })
      expect(shaOf(repo, 'pr/1398-dark-mode')).toBe(dark)

      // Back to the squashed main: now it goes.
      git(repo, 'update-ref', 'refs/remotes/origin/main', squashed)
      const ok = await gitService.deleteLocalBranches(repo, [
        { name: 'pr/1398-dark-mode', sha: dark, acceptedUnique: 0, squashMerged: true }
      ])
      expect(ok[0].status).toBe('deleted')
    })
  })

  it('refuses to restore an option-looking name or a non-sha', async () => {
    const { repo } = isolatedClone()
    const sha = git(repo, 'rev-parse', 'main')
    const res = await gitService.restoreLocalBranches(repo, [
      { name: '--force', sha },
      { name: 'ok-name', sha: 'HEAD~1' }
    ])
    expect(res.map((r) => r.status)).toEqual(['failed', 'failed'])
  })
})
