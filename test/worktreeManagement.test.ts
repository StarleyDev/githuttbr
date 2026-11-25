import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitService } from '../src/main/git'
import { repoPath } from './helpers'

// Each test gets its own throwaway repository: worktree operations rewrite
// `.git/worktrees/`, which would leak between tests sharing a fixture.
describe('worktree management', () => {
  let dir: string
  let repo: string
  const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
  const find = async (path: string): Promise<Awaited<ReturnType<typeof gitService.worktrees>>[number]> => {
    const w = (await gitService.worktrees(repo)).find((x) => x.path === path)
    if (!w) throw new Error(`no worktree at ${path}`)
    return w
  }

  beforeEach(() => {
    // realpath: macOS tmpdir is /var, a symlink, but git reports /private/var.
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'githuttbr-wt-')))
    repo = join(dir, 'repo')
    execFileSync('git', ['init', '-q', '-b', 'main', repo])
    git(repo, 'config', 'user.name', 'T')
    git(repo, 'config', 'user.email', 't@example.com')
    writeFileSync(join(repo, 'a.txt'), 'a\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'one')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('locks with a reason, shows it, and unlocks', async () => {
    const wt = join(dir, 'feat')
    await gitService.worktreeAdd(repo, wt, 'feat', true)
    await gitService.worktreeLock(repo, wt, 'on a usb drive')
    expect(await find(wt)).toMatchObject({ locked: true, lockReason: 'on a usb drive' })
    await gitService.worktreeUnlock(repo, wt)
    expect(await find(wt)).toMatchObject({ locked: false, lockReason: null })
  })

  it('worktreeRoot names the main checkout only for a linked worktree, symlinks included', async () => {
    const wt = join(dir, 'feat')
    await gitService.worktreeAdd(repo, wt, 'feat', true)
    expect(await gitService.worktreeRoot(wt)).toBe(repo)
    // The repository itself is its own root, answered as the path asked —
    // opened through a symlink it must not look like a worktree of its real path.
    expect(await gitService.worktreeRoot(repo)).toBe(repo)
    const link = join(dir, 'linked-repo')
    symlinkSync(repo, link, 'dir')
    expect(await gitService.worktreeRoot(link)).toBe(link)
    const plain = join(dir, 'not-a-repo')
    mkdirSync(plain)
    expect(await gitService.worktreeRoot(plain)).toBeNull()
  })

  it('worktreeRoot of a submodule worktree is the submodule, and a bare repository has none', async () => {
    // Submodule: its git dir lives in the superproject's .git/modules.
    const sup = join(dir, 'sup')
    execFileSync('git', ['init', '-q', '-b', 'main', sup])
    git(sup, 'config', 'user.name', 'T')
    git(sup, 'config', 'user.email', 't@example.com')
    git(sup, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', repo, 'sm')
    git(sup, 'commit', '-q', '-m', 'sm')
    const sm = join(sup, 'sm')
    expect(await gitService.worktreeRoot(sm)).toBe(sm)
    const smWt = join(dir, 'sm-feat')
    git(sm, 'worktree', 'add', '-q', '-b', 'sm-feat', smWt)
    expect(await gitService.worktreeRoot(smWt)).toBe(sm)
    // Bare: no main checkout to open, so no root at all.
    const bare = join(dir, 'bare.git')
    execFileSync('git', ['clone', '-q', '--bare', repo, bare])
    const bareWt = join(dir, 'bare-wt')
    git(bare, 'worktree', 'add', '-q', '-b', 'bare-feat', bareWt)
    expect(await gitService.worktreeRoot(bareWt)).toBeNull()
  })

  it('marks a deleted folder as prunable and forgets it on prune, sparing locked ones', async () => {
    const gone = join(dir, 'gone')
    const kept = join(dir, 'kept')
    await gitService.worktreeAdd(repo, gone, 'gone', true)
    await gitService.worktreeAdd(repo, kept, 'kept', true)
    await gitService.worktreeLock(repo, kept)
    rmSync(gone, { recursive: true, force: true })
    rmSync(kept, { recursive: true, force: true })

    expect((await find(gone)).prunable).toBe(true)
    expect(await gitService.worktreePrune(repo)).toBe(1)
    const paths = (await gitService.worktrees(repo)).map((w) => w.path)
    expect(paths).not.toContain(gone)
    expect(paths).toContain(kept)
  })

  it('reports uncommitted changes and unpushed commits, and null for a missing folder', async () => {
    const wt = join(dir, 'feat')
    await gitService.worktreeAdd(repo, wt, 'feat', true)
    expect(await gitService.getWorktreeStatus(repo, wt)).toEqual({ changes: 0, ahead: 0, behind: 0, upstream: null })

    writeFileSync(join(wt, 'a.txt'), 'changed\n')
    writeFileSync(join(wt, 'new.txt'), 'new\n')
    git(wt, 'branch', '--set-upstream-to', 'main')
    git(wt, 'commit', '-q', '-am', 'two')
    expect(await gitService.getWorktreeStatus(repo, wt)).toEqual({ changes: 1, ahead: 1, behind: 0, upstream: 'main' })

    expect(await gitService.getWorktreeStatus(repo, join(dir, 'nope'))).toBeNull()
  })

  it('refuses to remove a worktree with changes unless forced', async () => {
    const wt = join(dir, 'feat')
    await gitService.worktreeAdd(repo, wt, 'feat', true)
    writeFileSync(join(wt, 'a.txt'), 'changed\n')
    await expect(gitService.worktreeRemove(repo, wt, false)).rejects.toThrow()
    expect(existsSync(wt)).toBe(true)
    await gitService.worktreeRemove(repo, wt, true)
    expect(existsSync(wt)).toBe(false)
  })

  it('moves a worktree and keeps its .git pointer relative', async () => {
    const from = join(dir, 'feat')
    const to = join(dir, 'moved', 'feat')
    await gitService.worktreeAdd(repo, from, 'feat', true)
    await gitService.worktreeMove(repo, from, to)
    expect(existsSync(from)).toBe(false)
    expect(await find(to)).toMatchObject({ branch: 'feat', prunable: false })
    expect(readFileSync(join(to, '.git'), 'utf8')).toMatch(/^gitdir: \.\./)
    expect(git(to, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feat')
  })

  it('refuses to move onto an existing folder', async () => {
    const from = join(dir, 'feat')
    await gitService.worktreeAdd(repo, from, 'feat', true)
    await expect(gitService.worktreeMove(repo, from, repo)).rejects.toThrow(/already exists/)
  })

  it('repairs a worktree whose folder was moved by hand', async () => {
    const from = join(dir, 'feat')
    const to = join(dir, 'elsewhere')
    await gitService.worktreeAdd(repo, from, 'feat', true)
    renameSync(from, to)
    expect((await find(from)).prunable).toBe(true)

    await gitService.worktreeRepair(repo, to)
    expect(await find(to)).toMatchObject({ branch: 'feat', prunable: false })
    expect(git(to, 'status', '--porcelain')).toBe('')
  })

  it('refuses to repair from a folder that is not a worktree', async () => {
    await expect(gitService.worktreeRepair(repo, dir)).rejects.toThrow(/Not a worktree/)
  })
})

// Read-only against the generated playground: the scenario the screenshot and
// the handbook rely on really does produce each state.
describe('worktree-care playground', () => {
  const R = repoPath('worktree-care')

  it('reports a locked worktree with its reason and a missing one as prunable', async () => {
    const trees = await gitService.worktrees(R)
    const byBranch = new Map(trees.map((w) => [w.branch, w]))
    expect(byBranch.get('release/2.x')).toMatchObject({ locked: true, lockReason: 'on the external SSD', prunable: false })
    expect(byBranch.get('spike/old-idea')).toMatchObject({ prunable: true })
    expect(byBranch.get('main')).toMatchObject({ isMain: true, prunable: false })
  })

  it('counts the uncommitted files and the commits ahead in the work-in-progress worktree', async () => {
    const search = (await gitService.worktrees(R)).find((w) => w.branch === 'feature/search')
    expect(search).toBeDefined()
    expect(await gitService.getWorktreeStatus(R, search!.path)).toEqual({ changes: 3, ahead: 2, behind: 0, upstream: 'main' })
  })
})
