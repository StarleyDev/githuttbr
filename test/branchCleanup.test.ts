import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitService } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'
import { countUniqueCommits, parseBranchTrackingConfig, parseRevListParents } from '../src/shared/branchCleanup'
import {
  filterCleanupRows,
  getCleanupConfirmSummary,
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
  for (const dir of worktreeDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
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

  it('forces exactly the rows with unique commits, and only the ones still listed', () => {
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: false })
    const req = getDeleteRequests(rows, new Set(['a-gone', 'a-gone-unique', 'c-stale']))
    expect(req.map((r) => [r.name, r.force])).toEqual([
      ['a-gone', false],
      ['a-gone-unique', true]
    ])
  })

  it('tells the confirm what is lost', () => {
    const rows = getCleanupRows(candidates, { now: NOW, staleMonths: 3, includeStale: true })
    const s = getCleanupConfirmSummary(rows, new Set(['a-gone', 'a-gone-unique', 'c-stale']))
    expect(s.count).toBe(3)
    expect(s.risky.map((r) => r.name)).toEqual(['a-gone-unique', 'c-stale'])
    expect(s.riskyCommits).toBe(4)
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
      { name: 'pr/1412-login-timeout', sha: sha('pr/1412-login-timeout'), force: true },
      { name: 'feature/local-merge', sha: sha('feature/local-merge'), force: true },
      { name: 'main', sha: sha('main'), force: true },
      { name: 'release/1.0', sha: sha('release/1.0'), force: true }
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
      { name: 'pr/1412-login-timeout', sha: at('pr/1412-login-timeout'), force: false },
      { name: 'feature/local-merge', sha: at('feature/local-merge'), force: false },
      { name: 'pr/1398-dark-mode', sha: at('pr/1398-dark-mode'), force: false },
      { name: 'wip/export-csv', sha: at('wip/export-csv'), force: true },
      { name: 'pr/1420-retry-banner', sha: at('pr/1412-login-timeout'), force: false },
      { name: 'no/such-branch', sha: at('pr/1412-login-timeout'), force: true }
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
      names.map((n) => ({ name: n, sha: before.get(n)!, force: true }))
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
