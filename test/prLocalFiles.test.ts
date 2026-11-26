import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchCommitsByIdQuietly, gitMethodIsRead, gitService, RANGE_FILE_LINE_CAP, withRepoLock } from '../src/main/git'
import {
  clearPrFetchAttempts,
  comparableRemoteUrl,
  ensureCommitsFrom,
  findRemoteForUrl,
  getLocalMergeBase,
  readPrFileFromClone,
  readPrFilesFromClone
} from '../src/main/prLocalFiles'
import { DiffChunkSplitter } from '../src/main/diffStream'

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
  const merged = (): { headSha: string; baseSha: string; baseKind: 'mergeBase' } => ({ headSha: head, baseSha: branchPoint, baseKind: 'mergeBase' })

  beforeAll(() => {
    repo = tmp('githuttbr-pr-local-')
    execFileSync('git', ['init', '-q', '-b', 'main', repo])
    git = gitIn(repo)
    mkdirSync(join(repo, 'src'))
    for (let i = 1; i <= PR_FILES; i++) writeFileSync(join(repo, 'src', `mod${i}.ts`), `export const v${i} = ${i}\n`)
    writeFileSync(join(repo, 'big.txt'), '')
    writeFileSync(join(repo, 'notes-utf16.txt'), Buffer.from('﻿hello\nworld\n', 'utf16le'))
    writeFileSync(join(repo, 'legacy.txt'), Buffer.from('ação antiga\n', 'latin1'))
    git('add', '-A')
    git('commit', '-qm', 'chore: start')
    branchPoint = git('rev-parse', 'HEAD')

    git('checkout', '-q', '-b', 'feature')
    for (let i = 1; i <= PR_FILES; i++) writeFileSync(join(repo, 'src', `mod${i}.ts`), `export const v${i} = ${i * 10}\n`)
    // One generated file far past the cap: listed with its counts, not diffed.
    writeFileSync(join(repo, 'big.txt'), Array.from({ length: RANGE_FILE_LINE_CAP + 5 }, (_, i) => `line ${i}`).join('\n') + '\n')
    // UTF-16 is binary to git, text to a reviewer.
    writeFileSync(join(repo, 'notes-utf16.txt'), Buffer.from('﻿hello\nthere\n', 'utf16le'))
    // Latin-1: decoded per file as Windows-1252, not as broken UTF-8.
    writeFileSync(join(repo, 'legacy.txt'), Buffer.from('ação nova\n', 'latin1'))
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

  beforeEach(() => clearPrFetchAttempts())

  afterAll(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  it('getMergeBase is a read and finds where the branch left; the target tip resolves to it locally', async () => {
    expect(gitMethodIsRead('getMergeBase')).toBe(true)
    expect(await gitService.getMergeBase(repo, target, head)).toBe(branchPoint)
    expect(await getLocalMergeBase(repo, target, head)).toBe(branchPoint)
    await expect(gitService.getMergeBase(repo, 'main', head)).rejects.toThrow(/full commit ids/)
  })

  it('diffs every one of 279 files from the merge base, in one read, the target’s own change left out', async () => {
    const res = await readPrFilesFromClone(repo, merged())
    expect(res?.mergeBase).toBe(branchPoint)
    const files = res!.files
    expect(files.some((f) => f.filename === 'TARGET_ONLY.md')).toBe(false)
    const mods = files.filter((f) => f.filename.startsWith('src/mod'))
    expect(mods).toHaveLength(PR_FILES)
    // Every text file has its patch: none is "binary", none is left without a diff.
    expect(mods.every((f) => f.patch && f.additions === 1 && f.deletions === 1 && !f.noPatchReason)).toBe(true)
    expect(mods.find((f) => f.filename === 'src/mod279.ts')?.patch).toContain('+export const v279 = 2790')
  })

  it('does not read a target tip as if it were the merge base', async () => {
    expect(await readPrFilesFromClone(repo, { headSha: head, baseSha: target, baseKind: 'targetTip' })).toBeNull()
  })

  it('lists an over-cap file with its counts and tooLarge, without holding up the rest', async () => {
    const big = (await readPrFilesFromClone(repo, merged()))!.files.find((f) => f.filename === 'big.txt')
    expect(big).toMatchObject({ noPatchReason: 'tooLarge', additions: RANGE_FILE_LINE_CAP + 5, status: 'modified' })
    expect(big?.patch).toBeUndefined()
  })

  it('reads a UTF-16 file git calls binary as the text it is', async () => {
    const notes = (await readPrFilesFromClone(repo, merged()))!.files.find((f) => f.filename === 'notes-utf16.txt')
    expect(notes?.patch).toContain('+there')
    expect(notes?.patch).toContain('-world')
    expect(notes?.noPatchReason).toBeUndefined()
  })

  it('decodes a Latin-1 file’s patch as Windows-1252, the other files untouched', async () => {
    const files = (await readPrFilesFromClone(repo, merged()))!.files
    expect(files.find((f) => f.filename === 'legacy.txt')?.patch).toContain('+ação nova')
    expect(files.find((f) => f.filename === 'src/mod1.ts')?.patch).toContain('+export const v1 = 10')
  })

  it('reads one file on its own with `paths`, from the merge base of a target tip', async () => {
    const one = await gitService.getCommitRangeFiles(repo, branchPoint, head, ['src/mod7.ts'])
    expect(one.map((f) => f.filename)).toEqual(['src/mod7.ts'])
    const read = await readPrFileFromClone(repo, { base: target, head, straight: false }, ['src/mod7.ts'])
    expect(read?.patch).toContain('+export const v7 = 70')
    await expect(gitService.getCommitRangeFiles(repo, branchPoint, head, ['a\0b'])).rejects.toThrow(/paths/)
  })

  it('withRepoLock refuses to take the same repository’s lock inside itself', async () => {
    await expect(
      withRepoLock(repo, 'getLocalCommits', () => withRepoLock(repo, 'getLocalCommits', async () => 1))
    ).rejects.toThrow(/re-entrant/)
  })

  describe('fetching the commits that are missing', () => {
    let bare: string
    let clone: string
    const remoteNamed = async (): Promise<string> => 'origin'

    beforeEach(() => {
      bare = tmp('githuttbr-pr-local-remote-')
      execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare])
      execFileSync('git', ['-C', bare, 'config', 'uploadpack.allowAnySHA1InWant', 'true'])
      git('push', '-q', bare, 'main', 'feature')
      clone = tmp('githuttbr-pr-local-clone-')
      execFileSync('git', ['clone', '-q', '--no-local', '--single-branch', '-b', 'main', bare, clone])
      rmSync(join(clone, '.git', 'FETCH_HEAD'), { force: true })
    })

    it('fetches them by id on the first load, then diffs here — without writing FETCH_HEAD', async () => {
      expect(await gitService.getLocalCommits(clone, [head])).toEqual([])
      expect(await ensureCommitsFrom(clone, remoteNamed, [target, head], 'once')).toBe(true)
      // "Fetched 2 min ago" reads FETCH_HEAD's time: a fetch nobody clicked must not move it.
      expect(existsSync(join(clone, '.git', 'FETCH_HEAD'))).toBe(false)
      const base = await getLocalMergeBase(clone, target, head)
      const res = await readPrFilesFromClone(clone, { headSha: head, baseSha: base!, baseKind: 'mergeBase' })
      expect(res?.files.filter((f) => f.filename.startsWith('src/mod') && f.patch)).toHaveLength(PR_FILES)
    })

    it('never fetches on a reload (`none`)', async () => {
      expect(await ensureCommitsFrom(clone, remoteNamed, [target, head], 'none')).toBe(false)
      expect(await gitService.getLocalCommits(clone, [head])).toEqual([])
    })

    it('tries once per session: a failed attempt is not repeated on the next load, only on Refresh', async () => {
      // The server is gone for the first loads, back for the Refresh.
      execFileSync('git', ['-C', clone, 'remote', 'set-url', 'origin', join(bare, 'gone')])
      let asked = 0
      const counting = async (): Promise<string> => {
        asked++
        return 'origin'
      }
      expect(await ensureCommitsFrom(clone, counting, [target, head], 'once')).toBe(false)
      expect(await ensureCommitsFrom(clone, counting, [target, head], 'once')).toBe(false)
      expect(asked).toBe(1)
      execFileSync('git', ['-C', clone, 'remote', 'set-url', 'origin', bare])
      expect(await ensureCommitsFrom(clone, counting, [target, head], 'refresh')).toBe(true)
      expect(asked).toBe(2)
    })

    it('two loads at once share one fetch', async () => {
      let asked = 0
      const counting = async (): Promise<string> => {
        asked++
        return 'origin'
      }
      const [a, b] = await Promise.all([
        ensureCommitsFrom(clone, counting, [target, head], 'once'),
        ensureCommitsFrom(clone, counting, [head, target], 'refresh')
      ])
      expect([a, b]).toEqual([true, true])
      expect(asked).toBe(1)
    })

    it('the quiet fetch gives up at its timeout instead of hanging the page', async () => {
      expect(await fetchCommitsByIdQuietly(clone, 'origin', [head], 1)).toBe(false)
    })
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

describe('DiffChunkSplitter — a streamed diff cut per file, under a budget', () => {
  const file = (name: string, lines: number): string =>
    `diff --git a/${name} b/${name}\n--- a/${name}\n+++ b/${name}\n@@ -1 +1,${lines} @@\n${'+x\n'.repeat(lines)}`

  it('cuts at each `diff --git`, whatever the chunk boundaries', () => {
    const text = file('a.ts', 2) + file('b.ts', 3)
    const s = new DiffChunkSplitter({ fileMaxBytes: 1 << 20, headerBytes: 64, budgetBytes: 1 << 20, budgetLines: 1000 })
    // One byte at a time: a marker split across pushes must still be found.
    for (const b of Buffer.from(text)) s.push(new Uint8Array([b]))
    s.end()
    expect(s.chunks.map((c) => Buffer.from(c.bytes).toString())).toEqual([file('a.ts', 2), file('b.ts', 3)])
  })

  it('keeps only the head of a file over the per-file cap, marked oversized', () => {
    const s = new DiffChunkSplitter({ fileMaxBytes: 100, headerBytes: 40, budgetBytes: 1 << 20, budgetLines: 1e6 })
    s.push(Buffer.from(file('huge.min.js', 200) + file('small.ts', 1)))
    s.end()
    expect(s.chunks[0]).toMatchObject({ oversized: true })
    expect(s.chunks[0].bytes.length).toBe(40)
    expect(s.chunks[1].oversized).toBe(false)
  })

  it('stops once the line budget is spent, always keeping the first file', () => {
    const s = new DiffChunkSplitter({ fileMaxBytes: 1 << 20, headerBytes: 64, budgetBytes: 1 << 20, budgetLines: 20 })
    const more = s.push(Buffer.from(file('a.ts', 15) + file('b.ts', 15) + file('c.ts', 1)))
    expect(more).toBe(false)
    expect(s.stopped).toBe(true)
    expect(s.chunks).toHaveLength(1)
  })
})
