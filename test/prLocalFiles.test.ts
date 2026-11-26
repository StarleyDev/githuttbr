import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitMethodIsRead, gitService, RANGE_FILE_LINE_CAP } from '../src/main/git'
import { comparableRemoteUrl, ensureCommitsFrom, findRemoteForUrl, readPrFilesFromClone } from '../src/main/prLocalFiles'

// The Files tab reads a pull request from this clone first: `git diff` from
// the merge base to the head, every file, no cap. The repo is built here — a
// target branch that moved on after the PR branched, and a PR touching 279
// files (the size of the one whose files 201–279 used to show "binary").

const dirs: string[] = []
const tmp = (prefix: string): string => {
  const d = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(d)
  return d
}
const gitIn =
  (repo: string) =>
  (...args: string[]): string =>
    execFileSync('git', ['-C', repo, '-c', 'user.name=Ana Example', '-c', 'user.email=ana@example.com', ...args], {
      encoding: 'utf8',
      maxBuffer: 64 << 20
    }).trim()

const PR_FILES = 279

describe('reading a pull request’s files from this clone', () => {
  let repo: string
  let git: (...args: string[]) => string
  let target: string
  let head: string
  let branchPoint: string

  beforeAll(() => {
    repo = tmp('githuttbr-pr-local-')
    execFileSync('git', ['init', '-q', '-b', 'main', repo])
    git = gitIn(repo)
    mkdirSync(join(repo, 'src'))
    for (let i = 1; i <= PR_FILES; i++) writeFileSync(join(repo, 'src', `mod${i}.ts`), `export const v${i} = ${i}\n`)
    writeFileSync(join(repo, 'big.txt'), '')
    writeFileSync(join(repo, 'notes-utf16.txt'), Buffer.from('﻿hello\nworld\n', 'utf16le'))
    git('add', '-A')
    git('commit', '-qm', 'chore: start')
    branchPoint = git('rev-parse', 'HEAD')

    git('checkout', '-q', '-b', 'feature')
    for (let i = 1; i <= PR_FILES; i++) writeFileSync(join(repo, 'src', `mod${i}.ts`), `export const v${i} = ${i * 10}\n`)
    // One generated file far past the cap: listed with its counts, not diffed.
    writeFileSync(join(repo, 'big.txt'), Array.from({ length: RANGE_FILE_LINE_CAP + 5 }, (_, i) => `line ${i}`).join('\n') + '\n')
    // UTF-16 is binary to git, text to a reviewer.
    writeFileSync(join(repo, 'notes-utf16.txt'), Buffer.from('﻿hello\nthere\n', 'utf16le'))
    git('add', '-A')
    git('commit', '-qm', 'feat: change every module')
    head = git('rev-parse', 'HEAD')

    // The target moves on after the branch point: its change is not the PR's.
    git('checkout', '-q', 'main')
    writeFileSync(join(repo, 'TARGET_ONLY.md'), 'landed on main later\n')
    git('add', '-A')
    git('commit', '-qm', 'docs: later on main')
    target = git('rev-parse', 'HEAD')
  })

  afterAll(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  it('getMergeBase is a read and finds where the branch left', async () => {
    expect(gitMethodIsRead('getMergeBase')).toBe(true)
    expect(await gitService.getMergeBase(repo, target, head)).toBe(branchPoint)
    await expect(gitService.getMergeBase(repo, 'main', head)).rejects.toThrow(/full commit ids/)
  })

  it('diffs every one of 279 files from the merge base, in one read, the target’s own change left out', async () => {
    const res = await readPrFilesFromClone(repo, 'https://example.test/acme/widgets.git', {
      base: target,
      head,
      baseIsMergeBase: false
    })
    expect(res?.mergeBase).toBe(branchPoint)
    const files = res!.files
    expect(files.some((f) => f.filename === 'TARGET_ONLY.md')).toBe(false)
    const mods = files.filter((f) => f.filename.startsWith('src/mod'))
    expect(mods).toHaveLength(PR_FILES)
    // Every text file has its patch: none is "binary", none is left without a diff.
    expect(mods.every((f) => f.patch && f.additions === 1 && f.deletions === 1 && !f.noPatchReason)).toBe(true)
    expect(mods.find((f) => f.filename === 'src/mod279.ts')?.patch).toContain('+export const v279 = 2790')
  })

  it('lists an over-cap file with its counts and tooLarge, without holding up the rest', async () => {
    const res = await readPrFilesFromClone(repo, '', { base: branchPoint, head, baseIsMergeBase: true })
    const big = res!.files.find((f) => f.filename === 'big.txt')
    expect(big).toMatchObject({ noPatchReason: 'tooLarge', additions: RANGE_FILE_LINE_CAP + 5, status: 'modified' })
    expect(big?.patch).toBeUndefined()
    expect(res!.files.filter((f) => f.patch).length).toBeGreaterThanOrEqual(PR_FILES)
  })

  it('reads a UTF-16 file git calls binary as the text it is', async () => {
    const res = await readPrFilesFromClone(repo, '', { base: branchPoint, head, baseIsMergeBase: true })
    const notes = res!.files.find((f) => f.filename === 'notes-utf16.txt')
    expect(notes?.patch).toContain('+there')
    expect(notes?.patch).toContain('-world')
    expect(notes?.noPatchReason).toBeUndefined()
  })

  it('reads one file on its own with `paths`', async () => {
    const one = await gitService.getCommitRangeFiles(repo, branchPoint, head, ['src/mod7.ts'])
    expect(one.map((f) => f.filename)).toEqual(['src/mod7.ts'])
    await expect(gitService.getCommitRangeFiles(repo, branchPoint, head, ['a\0b'])).rejects.toThrow(/paths/)
  })

  it('is null — the host is asked instead — when the commits are not here and no remote matches', async () => {
    const missing = 'f'.repeat(40)
    expect(await readPrFilesFromClone(repo, 'https://example.test/acme/widgets.git', { base: missing, head, baseIsMergeBase: true })).toBeNull()
  })

  it('fetches missing commits by id from the pull request’s remote, then diffs here', async () => {
    const bare = tmp('githuttbr-pr-local-remote-')
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare])
    execFileSync('git', ['-C', bare, 'config', 'uploadpack.allowAnySHA1InWant', 'true'])
    git('push', '-q', bare, 'main', 'feature')
    const clone = tmp('githuttbr-pr-local-clone-')
    execFileSync('git', ['clone', '-q', '--no-local', '--single-branch', '-b', 'main', bare, clone])
    expect(await gitService.getLocalCommits(clone, [head])).toEqual([])
    expect(await ensureCommitsFrom(clone, async () => 'origin', [target, head])).toBe(true)
    const res = await readPrFilesFromClone(clone, '', { base: target, head, baseIsMergeBase: false })
    expect(res?.files.filter((f) => f.filename.startsWith('src/mod') && f.patch)).toHaveLength(PR_FILES)
  })

  it('matches the remote by URL, not by user or .git', () => {
    expect(comparableRemoteUrl('https://ana@example.test/acme/widgets.git')).toBe('https://example.test/acme/widgets')
    const remotes = [
      { name: 'upstream', url: 'https://example.test/other/widgets.git' },
      { name: 'origin', url: 'https://ana@example.test/acme/widgets.git' }
    ]
    expect(findRemoteForUrl(remotes, 'https://example.test/acme/widgets')).toBe('origin')
    expect(findRemoteForUrl(remotes, 'https://example.test/none/here')).toBeNull()
  })
})
