import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitMethodIsRead, gitService } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'

// "View changes in this update" compares the update's two heads here. When
// this clone lacks one, it is fetched by its id from the pull request's
// remote — a head a force push replaced is on no branch any more. The bare
// remote plays the host: one head on a branch, one rewritten away.
describe('fetching an update’s heads by commit id', () => {
  let repo: string
  let bare: string
  let before: string
  let after: string
  const extra: string[] = []
  const git = (...args: string[]): string =>
    execFileSync('git', ['-C', repo, '-c', 'user.name=T', '-c', 'user.email=t@example.com', ...args], { encoding: 'utf8' }).trim()

  beforeEach(() => {
    repo = cloneFixture('pr-ready-branch')
    bare = mkdtempSync(join(tmpdir(), 'githuttbr-update-heads-remote-'))
    extra.push(bare)
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare])
    git('push', '-q', bare, 'main')
    // Update 1's head, then a force push that replaced it: only `after` is on a branch.
    git('checkout', '-q', '-b', 'feature', 'main')
    writeFileSync(join(repo, 'feature.txt'), 'first\n')
    git('add', 'feature.txt')
    git('commit', '-qm', 'feat: first try')
    before = git('rev-parse', 'HEAD')
    git('push', '-q', bare, 'feature')
    writeFileSync(join(repo, 'feature.txt'), 'second\n')
    git('commit', '-q', '-a', '--amend', '-m', 'feat: second try')
    after = git('rev-parse', 'HEAD')
    git('push', '-q', '-f', bare, 'feature')
    // Neither commit is here any more.
    git('checkout', '-q', 'main')
    git('branch', '-q', '-D', 'feature')
    git('reflog', 'expire', '--expire=now', '--all')
    git('gc', '-q', '--prune=now')
    git('remote', 'add', 'upstream', bare)
  })

  afterAll(() => {
    cleanupFixtures()
    for (const dir of extra.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('is a write: it brings objects in', () => {
    expect(gitMethodIsRead('fetchCommitsById')).toBe(false)
  })

  it('fetches both heads by id — the rewritten one too, where the server serves it — and the diff runs here', async () => {
    // GitHub-like: any commit by id. A plain git server needs this switched on.
    execFileSync('git', ['-C', bare, 'config', 'uploadpack.allowAnySHA1InWant', 'true'])
    expect(await gitService.getLocalCommits(repo, [before, after])).toEqual([])
    expect(await gitService.fetchCommitsById(repo, 'upstream', [before, after])).toBe(true)
    expect((await gitService.getLocalCommits(repo, [before, after])).sort()).toEqual([before, after].sort())
    const files = await gitService.getCommitRangeFiles(repo, before, after)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ filename: 'feature.txt', status: 'modified', additions: 1, deletions: 1 })
    // No ref, no tag, no remote-tracking branch came with it.
    expect(git('for-each-ref', '--format=%(refname)', 'refs/remotes/upstream')).toBe('')
  })

  it('false, not an error, when the server will not serve a commit', async () => {
    execFileSync('git', ['-C', bare, 'config', 'uploadpack.allowAnySHA1InWant', 'false'])
    execFileSync('git', ['-C', bare, 'config', 'uploadpack.allowReachableSHA1InWant', 'false'])
    expect(await gitService.fetchCommitsById(repo, 'upstream', [before, 'f'.repeat(40)])).toBe(false)
  })

  it('refuses anything but full ids and a configured remote, before anything runs', async () => {
    await expect(gitService.fetchCommitsById(repo, 'upstream', ['main'])).rejects.toThrow(/full ids/)
    await expect(gitService.fetchCommitsById(repo, 'upstream', [`--upload-pack=x${'0'.repeat(30)}`])).rejects.toThrow(/full ids/)
    await expect(gitService.fetchCommitsById(repo, 'upstream', [])).rejects.toThrow(/full ids/)
    await expect(gitService.fetchCommitsById(repo, bare, [after])).rejects.toThrow(/not configured/)
    await expect(gitService.fetchCommitsById(repo, '--upload-pack=x', [after])).rejects.toThrow()
  })
})
