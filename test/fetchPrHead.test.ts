import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitService } from '../src/main/git'
import { cloneFixture, cleanupFixtures } from './fixtures'

// A pull request from a fork: its branch is on no remote this clone knows, but
// the target repository mirrors its head under a well-known ref. The bare
// remote here plays the target: it holds `refs/pull/7/head` (GitHub, Forgejo)
// and `refs/merge-requests/8/head` (GitLab), and no branch for either.
describe('fetching a pull request head by number (fork PR commits)', () => {
  let repo: string
  let bare: string
  let forkSha: string
  let mrSha: string
  const extra: string[] = []
  const git = (...args: string[]): string =>
    execFileSync('git', ['-C', repo, '-c', 'user.name=T', '-c', 'user.email=t@example.com', ...args], {
      encoding: 'utf8'
    }).trim()
  const commitOnScratch = (file: string, subject: string): string => {
    git('checkout', '-q', '-b', `scratch-${file}`, 'main')
    writeFileSync(join(repo, file), `${subject}\n`)
    git('add', file)
    git('commit', '-qm', subject)
    const sha = git('rev-parse', 'HEAD')
    git('checkout', '-q', 'main')
    return sha
  }

  beforeEach(() => {
    repo = cloneFixture('pr-ready-branch')
    bare = mkdtempSync(join(tmpdir(), 'githuttbr-pr-head-remote-'))
    extra.push(bare)
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare])
    git('push', '-q', bare, 'main')
    forkSha = commitOnScratch('fork.txt', 'feat: from a fork')
    mrSha = commitOnScratch('mr.txt', 'feat: from a merge request')
    git('push', '-q', bare, `${forkSha}:refs/pull/7/head`)
    git('push', '-q', bare, `${mrSha}:refs/merge-requests/8/head`)
    // A tag on the remote, which the fetch must not bring along.
    execFileSync('git', ['-C', bare, 'tag', 'v9.9.9', forkSha])
    // The commits exist only on the remote now.
    git('branch', '-q', '-D', 'scratch-fork.txt', 'scratch-mr.txt')
    git('reflog', 'expire', '--expire=now', '--all')
    git('gc', '-q', '--prune=now')
    git('remote', 'add', 'upstream', bare)
  })

  afterAll(() => {
    cleanupFixtures()
    for (const dir of extra.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('fetches refs/pull/N/head into <remote>/pr/N: the commits become local', async () => {
    expect(await gitService.getLocalCommits(repo, [forkSha])).toEqual([])
    expect(await gitService.fetchPrHead(repo, 'upstream', 7)).toBe('upstream/pr/7')
    expect(git('rev-parse', 'refs/remotes/upstream/pr/7')).toBe(forkSha)
    expect(await gitService.getLocalCommits(repo, [forkSha])).toEqual([forkSha])
    // Only that ref: no branch of the remote, and no tag.
    expect(git('for-each-ref', '--format=%(refname)', 'refs/remotes/upstream')).toBe('refs/remotes/upstream/pr/7')
    expect(git('tag', '--list', 'v9.9.9')).toBe('')
  })

  it('finds GitLab’s merge-requests convention too', async () => {
    expect(await gitService.fetchPrHead(repo, 'upstream', 8)).toBe('upstream/pr/8')
    expect(git('rev-parse', 'refs/remotes/upstream/pr/8')).toBe(mrSha)
  })

  it('a force-pushed head moves the local ref along', async () => {
    await gitService.fetchPrHead(repo, 'upstream', 7)
    execFileSync('git', ['-C', bare, 'update-ref', 'refs/pull/7/head', mrSha])
    await gitService.fetchPrHead(repo, 'upstream', 7)
    expect(git('rev-parse', 'refs/remotes/upstream/pr/7')).toBe(mrSha)
  })

  it('null when the remote publishes no head for that number', async () => {
    expect(await gitService.fetchPrHead(repo, 'upstream', 99)).toBeNull()
    expect(git('for-each-ref', '--format=%(refname)', 'refs/remotes/upstream')).toBe('')
  })

  it('refuses a bad number or a remote that is not configured, before anything runs', async () => {
    await expect(gitService.fetchPrHead(repo, 'upstream', 0)).rejects.toThrow(/Refusing the pull request number/)
    await expect(gitService.fetchPrHead(repo, 'upstream', 1.5)).rejects.toThrow(/Refusing the pull request number/)
    await expect(gitService.fetchPrHead(repo, '--upload-pack=x', 7)).rejects.toThrow()
    await expect(gitService.fetchPrHead(repo, bare, 7)).rejects.toThrow(/not configured/)
    await expect(gitService.fetchPrHead(repo, 'nowhere', 7)).rejects.toThrow(/not configured/)
  })
})
