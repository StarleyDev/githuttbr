import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitService } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'

// A pull request's branch that exists only on the server: the remote `review`
// has `feature/review-me`, which this clone has never fetched.
describe('fetching one branch of a remote (PR branch links)', () => {
  let repo: string
  let bare: string
  let remoteSha: string
  const extra: string[] = []
  const git = (...args: string[]): string =>
    execFileSync('git', ['-C', repo, '-c', 'user.name=T', '-c', 'user.email=t@example.com', ...args], {
      encoding: 'utf8'
    }).trim()

  beforeEach(() => {
    repo = cloneFixture('pr-ready-branch')
    bare = mkdtempSync(join(tmpdir(), 'githuttbr-review-remote-'))
    extra.push(bare)
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare])
    git('push', '-q', bare, 'main')
    // Publish a branch on the remote, then forget it locally.
    git('checkout', '-q', '-b', 'scratch', 'main')
    writeFileSync(join(repo, 'review.txt'), 'only on the remote\n')
    git('add', 'review.txt')
    git('commit', '-qm', 'feat: only on the remote')
    remoteSha = git('rev-parse', 'HEAD')
    git('push', '-q', bare, 'scratch:refs/heads/feature/review-me')
    git('checkout', '-q', 'main')
    git('branch', '-q', '-D', 'scratch')
    git('remote', 'add', 'review', bare)
  })

  afterAll(() => {
    cleanupFixtures()
    for (const dir of extra.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('fetches the branch, and checkoutRemote then makes a local tracking branch', async () => {
    expect(() => git('rev-parse', '--verify', '-q', 'refs/remotes/review/feature/review-me')).toThrow()

    expect(await gitService.fetchRemoteBranch(repo, 'review', 'feature/review-me')).toBe(true)
    expect(git('rev-parse', 'refs/remotes/review/feature/review-me')).toBe(remoteSha)
    // One branch, not the remote's whole namespace: main was not fetched.
    expect(git('for-each-ref', '--format=%(refname)', 'refs/remotes/review')).toBe('refs/remotes/review/feature/review-me')

    const res = await gitService.checkoutRemote(repo, 'review/feature/review-me', 'feature/review-me')
    expect(res.createdAt).toBe(remoteSha)
    expect(git('symbolic-ref', '--short', 'HEAD')).toBe('feature/review-me')
    expect(git('rev-parse', 'HEAD')).toBe(remoteSha)
    expect(git('rev-parse', '--abbrev-ref', 'feature/review-me@{u}')).toBe('review/feature/review-me')
  })

  it('undo deletes the branch the checkout created, but only while it has not moved', async () => {
    await gitService.fetchRemoteBranch(repo, 'review', 'feature/review-me')
    const { createdAt } = await gitService.checkoutRemote(repo, 'review/feature/review-me', 'feature/review-me')
    expect(createdAt).toBeTruthy()

    // A commit made on it since is the user's work: refused, branch kept.
    git('commit', '-q', '--allow-empty', '-m', 'work on the PR')
    git('checkout', '-q', 'main')
    expect(await gitService.deleteBranchIfAt(repo, 'feature/review-me', createdAt!)).toBe(false)
    expect(git('branch', '--list', 'feature/review-me')).toContain('feature/review-me')

    // Back at the tip it was created at: deleted, tracking config with it.
    git('branch', '-f', 'feature/review-me', createdAt!)
    expect(await gitService.deleteBranchIfAt(repo, 'feature/review-me', createdAt!)).toBe(true)
    expect(git('branch', '--list', 'feature/review-me')).toBe('')
    expect(() => git('config', '--get', 'branch.feature/review-me.remote')).toThrow()
    // An existing branch is not "created": no createdAt, nothing for undo to delete.
    git('branch', 'feature/review-me', createdAt!)
    const again = await gitService.checkoutRemote(repo, 'review/feature/review-me', 'feature/review-me')
    expect(again.createdAt).toBeUndefined()
  })

  it('returns false when the remote has no such branch', async () => {
    expect(await gitService.fetchRemoteBranch(repo, 'review', 'feature/merged-and-deleted')).toBe(false)
    expect(git('for-each-ref', 'refs/remotes/review')).toBe('')
  })

  it('refuses a remote that is not configured', async () => {
    await expect(gitService.fetchRemoteBranch(repo, 'nowhere', 'main')).rejects.toThrow(/not configured/)
    await expect(gitService.fetchRemoteBranch(repo, '--upload-pack=touch x', 'main')).rejects.toThrow()
  })

  it('refuses hostile branch names without running git', async () => {
    // A repository path that does not exist: any git call would fail with
    // git's own error, so the refusal message proves nothing was spawned.
    const nowhere = join(tmpdir(), 'githuttbr-no-such-repo-for-sure')
    const hostile = [
      '',
      '-oops',
      '--upload-pack=touch pwned',
      '+refs/heads/main',
      'main:refs/heads/elsewhere',
      'feature/a b',
      'feature/a\nb',
      'a..b',
      '@{-1}',
      'HEAD',
      'refs/heads/x.lock',
      'trailing/',
      'star*'
    ]
    for (const name of hostile) {
      await expect(gitService.fetchRemoteBranch(nowhere, 'review', name), JSON.stringify(name)).rejects.toThrow(
        /Refusing the branch name/
      )
    }
  })

  it('lets git have the last word on names the quick check allows', async () => {
    await expect(gitService.fetchRemoteBranch(repo, 'review', 'feature/.hidden')).rejects.toThrow(/git does not accept/)
    expect(git('for-each-ref', 'refs/remotes/review')).toBe('')
  })
})
