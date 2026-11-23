import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitService, gitMethodIsRead } from '../src/main/git'
import { prBaseHint, prBaseRemote } from '../src/renderer/src/lib/prBase'
import { cloneFixture, cleanupFixtures } from './fixtures'

// The Create PR prefill, measured the way the host measures a PR: against the
// remote's copy of the target. The scenario that broke it: a feature branch
// pulled `origin main` (a merge) while the local `main` stayed behind, and the
// prefill then listed every upstream commit plus the merge.
const FEATURE = 'feat/awesome-feature'
const OWN = [
  'docs: readme',
  'docs: document awesome feature',
  'feat: wire awesome() into app',
  'feat: add awesome() helper'
]

describe('prComparison — what a new pull request contains', () => {
  let dir: string
  let work: string
  let remote: string
  let other: string
  const run = (repo: string, ...args: string[]): string =>
    execFileSync('git', ['-C', repo, '-c', 'user.name=T', '-c', 'user.email=t@example.com', ...args], {
      encoding: 'utf8'
    }).trim()
  const git = (...args: string[]): string => run(work, ...args)
  const subjects = (cs: { subject: string }[]): string[] => cs.map((c) => c.subject)

  /** Someone else pushes a commit to `branch` on the remote. */
  const upstreamCommit = (branch: string, file: string, subject: string): void => {
    run(other, 'fetch', '-q', 'origin')
    run(other, 'checkout', '-q', '-B', branch, `origin/${branch}`)
    writeFileSync(join(other, file), `${subject}\n`)
    run(other, 'add', '.')
    run(other, 'commit', '-qm', subject)
    run(other, 'push', '-q', 'origin', branch)
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'githuttbr-prcmp-'))
    work = cloneFixture('pr-ready-branch')
    remote = join(dir, 'remote.git')
    other = join(dir, 'other')
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
    git('remote', 'set-url', 'origin', remote)
    git('branch', 'develop', 'main')
    git('push', '-q', 'origin', 'main', 'develop', FEATURE)
    execFileSync('git', ['clone', '-q', remote, other])
    git('checkout', '-q', FEATURE)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    cleanupFixtures()
  })

  it('lists only the branch’s own commits after `git pull origin main` merged upstream work in', async () => {
    upstreamCommit('main', 'upstream.txt', 'upstream: someone else’s change')
    const staleMain = git('rev-parse', 'main')
    git('pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main')
    expect(git('rev-parse', 'main')).toBe(staleMain) // the local main never moved

    const cmp = await gitService.prComparison(work, FEATURE, 'main', 'origin')
    expect(cmp.base).toBe('refs/remotes/origin/main')
    expect(cmp.baseIsRemote).toBe(true)
    expect(subjects(cmp.commits)).toEqual(OWN)
    expect(cmp.diff).toContain('feature.js')
    expect(cmp.diff).toContain('AWESOME.md')
    expect(cmp.diff).not.toContain('upstream.txt')
  })

  it('leaves compareBranches as it was: the local branch, merges included', async () => {
    upstreamCommit('main', 'upstream.txt', 'upstream: someone else’s change')
    git('pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main')

    const cmp = await gitService.compareBranches(work, FEATURE, 'main')
    const ahead = subjects(cmp.aheadCommits)
    expect(ahead).toContain('upstream: someone else’s change')
    expect(ahead.some((s) => s.startsWith('Merge branch'))).toBe(true)
    expect(ahead).toEqual(expect.arrayContaining(OWN))
    expect(cmp.diff).toContain('upstream.txt')
  })

  it('works the same for a target other than main', async () => {
    upstreamCommit('develop', 'dev.txt', 'dev: integration work')
    git('pull', '-q', '--no-rebase', '--no-edit', 'origin', 'develop')

    const cmp = await gitService.prComparison(work, FEATURE, 'develop', 'origin')
    expect(cmp.base).toBe('refs/remotes/origin/develop')
    expect(subjects(cmp.commits)).toEqual(OWN)
    expect(cmp.diff).not.toContain('dev.txt')
  })

  it('refreshes the remote base, so a pull that happened elsewhere is accounted for', async () => {
    upstreamCommit('main', 'upstream.txt', 'upstream: first')
    git('pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main')
    upstreamCommit('main', 'later.txt', 'upstream: second')

    expect(await gitService.refreshPrBase(work, 'origin', 'main')).toBe(true)
    expect(git('rev-parse', 'origin/main')).toBe(run(remote, 'rev-parse', 'main'))
    const cmp = await gitService.prComparison(work, FEATURE, 'main', 'origin')
    expect(subjects(cmp.commits)).toEqual(OWN)
    expect(cmp.diff).not.toContain('later.txt')
  })

  it('falls back to the local target when the remote has no such branch', async () => {
    git('branch', 'release', 'main')
    expect(await gitService.refreshPrBase(work, 'origin', 'release')).toBe(false)

    const cmp = await gitService.prComparison(work, FEATURE, 'release', 'origin')
    expect(cmp.base).toBe('release')
    expect(cmp.baseIsRemote).toBe(false)
    expect(subjects(cmp.commits)).toEqual(OWN)
    expect(prBaseHint(cmp.baseIsRemote, false)).toBe('createPR.baseLocal')
  })

  it('uses the last fetched remote base when the remote cannot be reached, and says so', async () => {
    upstreamCommit('main', 'upstream.txt', 'upstream: someone else’s change')
    git('pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main')
    git('remote', 'set-url', 'origin', join(dir, 'gone.git'))

    const refreshed = await gitService.refreshPrBase(work, 'origin', 'main')
    expect(refreshed).toBe(false)
    const cmp = await gitService.prComparison(work, FEATURE, 'main', 'origin')
    expect(cmp.baseIsRemote).toBe(true)
    expect(subjects(cmp.commits)).toEqual(OWN)
    expect(prBaseHint(cmp.baseIsRemote, refreshed)).toBe('createPR.baseStale')
  })

  it('refuses refs that git would read as options', async () => {
    await expect(gitService.prComparison(work, '--all', 'main', 'origin')).rejects.toThrow()
    expect(await gitService.refreshPrBase(work, 'origin', '--upload-pack=x')).toBe(false)
  })

  it('classifies the comparison as a read and the refresh as a write', () => {
    expect(gitMethodIsRead('prComparison')).toBe(true)
    expect(gitMethodIsRead('refreshPrBase')).toBe(false)
  })
})

describe('prBaseRemote / prBaseHint', () => {
  const remotes = [
    { name: 'origin', url: 'https://example.com/me/app.git' },
    { name: 'upstream', url: 'https://example.com/org/app.git' },
    { name: 'team/fork', url: 'https://example.com/team/app.git' }
  ]

  it('picks the remote the PR is opened on, then the upstream’s, then origin', () => {
    expect(prBaseRemote(remotes, 'https://example.com/org/app.git', 'origin/feature')).toBe('upstream')
    expect(prBaseRemote(remotes, 'https://elsewhere/app.git', 'team/fork/feature')).toBe('team/fork')
    expect(prBaseRemote(remotes, '', 'upstream/x')).toBe('upstream')
    expect(prBaseRemote(remotes, '', null)).toBe('origin')
    expect(prBaseRemote([], '', 'nowhere/x')).toBe('origin')
  })

  it('says nothing in the normal case', () => {
    expect(prBaseHint(true, true)).toBeNull()
    expect(prBaseHint(true, false)).toBe('createPR.baseStale')
    expect(prBaseHint(false, true)).toBe('createPR.baseLocal')
  })
})
