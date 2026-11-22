import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitService } from '../src/main/git'
import {
  classifyPushState,
  parsePushPorcelain,
  parseUpstreamTrack,
  pushRefspecs,
  pushResultsFrom,
  remoteMessages
} from '../src/shared/pushPorcelain'
import {
  canBatchPush,
  defaultPushRemote,
  filterPushStates,
  initialPushSelection,
  partitionBySecrets,
  tallyPushResults
} from '../src/renderer/src/lib/pushBranches'
import { isSecretFile } from '../src/shared/secretFiles'
import type { BranchPushState } from '../src/shared/types'

// Captured from git 2.56 against a local bare remote (see the git-backed tests below).
const NON_ATOMIC = [
  'To ../remote.git',
  '=\trefs/heads/uptodate:refs/heads/uptodate\t[up to date]',
  ' \trefs/heads/ahead:refs/heads/ahead\tdf49aaa..e066611',
  ' \trefs/heads/renamed:refs/heads/other-name\tdf49aaa..44ffa80',
  '*\trefs/heads/newone:refs/heads/newone\t[new branch]',
  '!\trefs/heads/diverged:refs/heads/diverged\t[rejected] (non-fast-forward)',
  'Done',
  ''
].join('\n')

const ATOMIC = [
  'To ../remote.git',
  '!\trefs/heads/ahead:refs/heads/ahead\t[rejected] (atomic push failed)',
  '!\trefs/heads/diverged:refs/heads/diverged\t[rejected] (non-fast-forward)',
  'Done'
].join('\n')

const HOOK = [
  'To ../remote.git',
  ' \trefs/heads/new2:refs/heads/new2\t0312500..5db826f',
  '!\trefs/heads/ahead:refs/heads/ahead\t[remote rejected] (hook declined)',
  'Done'
].join('\n')

describe('git push --porcelain parsing', () => {
  it('reads every ref line and ignores the rest', () => {
    const refs = parsePushPorcelain(NON_ATOMIC)
    expect(refs.map((r) => r.flag)).toEqual(['=', ' ', ' ', '*', '!'])
    expect(refs[2]).toMatchObject({ from: 'refs/heads/renamed', to: 'refs/heads/other-name' })
    expect(refs[4]).toMatchObject({ summary: '[rejected]', reason: 'non-fast-forward' })
  })

  it('lines results up with the targets, one status per branch', () => {
    const targets = [
      { branch: 'ahead', remoteBranch: 'ahead' },
      { branch: 'uptodate', remoteBranch: 'uptodate' },
      { branch: 'newone', remoteBranch: 'newone' },
      { branch: 'renamed', remoteBranch: 'other-name' },
      { branch: 'diverged', remoteBranch: 'diverged' },
      { branch: 'ghost', remoteBranch: 'ghost' }
    ]
    const res = pushResultsFrom(targets, parsePushPorcelain(NON_ATOMIC))
    expect(res.map((r) => [r.branch, r.status])).toEqual([
      ['ahead', 'pushed'],
      ['uptodate', 'upToDate'],
      ['newone', 'created'],
      ['renamed', 'pushed'],
      ['diverged', 'rejected'],
      ['ghost', 'notAttempted']
    ])
    expect(res[4]).toMatchObject({ rejection: 'nonFastForward', reason: 'non-fast-forward' })
  })

  it('tells an atomic casualty from the branch that caused it, and a hook refusal', () => {
    const atomic = pushResultsFrom(
      [
        { branch: 'ahead', remoteBranch: 'ahead' },
        { branch: 'diverged', remoteBranch: 'diverged' }
      ],
      parsePushPorcelain(ATOMIC)
    )
    expect(atomic.map((r) => r.rejection)).toEqual(['atomic', 'nonFastForward'])
    const hook = pushResultsFrom(
      [
        { branch: 'new2', remoteBranch: 'new2' },
        { branch: 'ahead', remoteBranch: 'ahead' }
      ],
      parsePushPorcelain(HOOK)
    )
    expect(hook[0].status).toBe('pushed')
    expect(hook[1]).toMatchObject({ status: 'rejected', rejection: 'remoteRejected', reason: 'hook declined' })
  })

  it('never builds a forcing refspec', () => {
    const specs = pushRefspecs([{ branch: 'a/b', remoteBranch: 'c' }])
    expect(specs).toEqual(['refs/heads/a/b:refs/heads/c'])
    expect(specs.some((s) => s.startsWith('+'))).toBe(false)
  })

  it('keeps what the server said', () => {
    const err = 'remote: error: GH006: Protected branch update failed for refs/heads/main.        \nerror: failed to push'
    expect(remoteMessages(err)).toEqual(['error: GH006: Protected branch update failed for refs/heads/main.'])
  })

  it('classifies tracking state', () => {
    expect(parseUpstreamTrack('[ahead 2, behind 1]')).toEqual({ ahead: 2, behind: 1, gone: false })
    expect(parseUpstreamTrack('[gone]').gone).toBe(true)
    expect(classifyPushState(0, 0, false)).toBe('new')
    expect(classifyPushState(2, 0, true)).toBe('ahead')
    expect(classifyPushState(0, 0, true)).toBe('upToDate')
    expect(classifyPushState(0, 3, true)).toBe('behind')
    expect(classifyPushState(1, 1, true)).toBe('diverged')
  })
})

describe('the push-branches dialog logic', () => {
  const st = (name: string, state: BranchPushState['state'], isCurrent = false): BranchPushState => ({
    name,
    sha: 'x',
    isCurrent,
    upstream: null,
    remoteBranch: name,
    remoteExists: state !== 'new',
    ahead: 0,
    behind: 0,
    state
  })
  const states = [st('a', 'ahead'), st('n', 'new'), st('u', 'upToDate'), st('b', 'behind'), st('d', 'diverged', true)]

  it('pre-ticks what has something to publish, and never what needs a force', () => {
    expect(initialPushSelection(states)).toEqual(['a', 'n'])
    expect(initialPushSelection(states, ['u', 'd', 'b'])).toEqual(['u'])
    expect(states.filter(canBatchPush).map((s) => s.name)).toEqual(['a', 'n', 'u'])
  })

  it('filters by name with the current branch first', () => {
    expect(filterPushStates(states, '').map((s) => s.name)[0]).toBe('d')
    expect(filterPushStates(states, 'A').map((s) => s.name)).toEqual(['a'])
  })

  it('holds back exactly the branches whose outgoing files look like secrets', () => {
    const { clean, flagged } = partitionBySecrets(
      ['a', 'b', 'c'],
      { a: ['src/x.ts'], b: ['config/.env', 'README.md'], c: [] },
      isSecretFile
    )
    expect(clean).toEqual(['a', 'c'])
    expect(flagged).toEqual([{ branch: 'b', files: ['config/.env'] }])
  })

  it('picks the remote and tallies results', () => {
    expect(defaultPushRemote(['fork', 'origin'], 'fork/main')).toBe('fork')
    expect(defaultPushRemote(['fork', 'origin'], null)).toBe('origin')
    expect(defaultPushRemote(['fork'], undefined)).toBe('fork')
    expect(
      tallyPushResults([
        { branch: 'a', remoteBranch: 'a', status: 'pushed', reason: '', upstreamSet: false },
        { branch: 'b', remoteBranch: 'b', status: 'rejected', reason: '', upstreamSet: false },
        { branch: 'c', remoteBranch: 'c', status: 'notAttempted', reason: '', upstreamSet: false }
      ])
    ).toEqual({ ok: 1, rejected: 1, notAttempted: 1 })
  })
})

// Real git: a local bare remote, and branches ahead / up to date / diverged /
// renamed upstream / never pushed. Every commit carries its own identity — the
// suite may run with no global one.
describe('pushing several branches in one go', () => {
  let dir: string
  let repo: string
  let remote: string
  const id = ['-c', 'user.name=T', '-c', 'user.email=t@example.com']
  const gitIn = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-C', cwd, ...id, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const git = (...args: string[]): string => gitIn(repo, ...args)
  const remoteSha = (branch: string): string =>
    execFileSync('git', ['-C', remote, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
      encoding: 'utf8'
    }).trim()
  const remoteHas = (branch: string): boolean => {
    try {
      return !!remoteSha(branch)
    } catch {
      return false
    }
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gitcito-pushbranches-'))
    repo = join(dir, 'repo')
    remote = join(dir, 'remote.git')
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
    execFileSync('git', ['init', '-q', '-b', 'main', repo])
    writeFileSync(join(repo, 'a.txt'), '1')
    git('add', '.')
    git('commit', '-qm', 'one')
    git('remote', 'add', 'origin', remote)
    for (const b of ['ahead', 'uptodate', 'diverged', 'renamed']) git('branch', b)
    git('push', '-q', '-u', 'origin', 'main', 'ahead', 'uptodate', 'diverged')
    git('push', '-q', 'origin', 'renamed:refs/heads/other-name')
    git('branch', '-q', '--set-upstream-to=origin/other-name', 'renamed')

    // Someone else moves `diverged` on the remote.
    const other = join(dir, 'other')
    execFileSync('git', ['clone', '-q', remote, other])
    gitIn(other, 'checkout', '-q', 'diverged')
    gitIn(other, 'commit', '-q', '--allow-empty', '-m', 'theirs')
    gitIn(other, 'push', '-q', 'origin', 'diverged')

    git('checkout', '-q', 'diverged')
    git('commit', '-q', '--allow-empty', '-m', 'ours')
    git('checkout', '-q', 'ahead')
    git('commit', '-q', '--allow-empty', '-m', 'a1')
    git('commit', '-q', '--allow-empty', '-m', 'a2')
    git('checkout', '-q', 'renamed')
    git('commit', '-q', '--allow-empty', '-m', 'r1')
    git('checkout', '-q', '-b', 'fresh')
    git('commit', '-q', '--allow-empty', '-m', 'f1')
    git('checkout', '-q', '-b', 'fresh2')
    git('commit', '-q', '--allow-empty', '-m', 'f2')
    git('checkout', '-q', 'main')
    git('fetch', '-q', 'origin')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('reads every branch state against the remote', async () => {
    const states = await gitService.branchPushStates(repo, 'origin')
    const by = Object.fromEntries(states.map((s) => [s.name, s]))
    expect(by.ahead).toMatchObject({ state: 'ahead', ahead: 2, behind: 0, remoteExists: true })
    expect(by.uptodate.state).toBe('upToDate')
    expect(by.main).toMatchObject({ state: 'upToDate', isCurrent: true })
    expect(by.diverged).toMatchObject({ state: 'diverged', ahead: 1, behind: 1 })
    expect(by.renamed).toMatchObject({ state: 'ahead', remoteBranch: 'other-name', upstream: 'origin/other-name' })
    expect(by.fresh).toMatchObject({ state: 'new', remoteExists: false, upstream: null })
  })

  it('compares an untracked branch with the remote branch of its name', async () => {
    git('branch', '--unset-upstream', 'uptodate')
    git('checkout', '-q', 'uptodate')
    git('commit', '-q', '--allow-empty', '-m', 'u1')
    git('checkout', '-q', 'main')
    const states = await gitService.branchPushStates(repo, 'origin')
    expect(states.find((s) => s.name === 'uptodate')).toMatchObject({ state: 'ahead', ahead: 1, upstream: null })
  })

  it('pushes three branches in one call, creates new ones and links their upstream, without a checkout', async () => {
    const res = await gitService.pushBranches(repo, 'origin', ['ahead', 'fresh', 'renamed', 'uptodate'], {
      setUpstream: true
    })
    const by = Object.fromEntries(res.results.map((r) => [r.branch, r]))
    expect(by.ahead.status).toBe('pushed')
    expect(by.fresh).toMatchObject({ status: 'created', upstreamSet: true })
    expect(by.renamed).toMatchObject({ status: 'pushed', remoteBranch: 'other-name', upstreamSet: false })
    expect(by.uptodate.status).toBe('upToDate')
    expect(remoteSha('ahead')).toBe(git('rev-parse', 'ahead'))
    expect(remoteSha('fresh')).toBe(git('rev-parse', 'fresh'))
    expect(remoteSha('other-name')).toBe(git('rev-parse', 'renamed'))
    expect(remoteHas('renamed')).toBe(false) // honoured the upstream's name
    expect(git('rev-parse', '--abbrev-ref', 'fresh@{u}')).toBe('origin/fresh')
    expect(git('symbolic-ref', '--short', 'HEAD')).toBe('main')
  })

  it('leaves upstream alone when asked not to set it', async () => {
    await gitService.pushBranches(repo, 'origin', ['fresh'], { setUpstream: false })
    expect(remoteHas('fresh')).toBe(true)
    expect(() => git('rev-parse', '--abbrev-ref', 'fresh@{u}')).toThrow()
  })

  it('reports a diverged branch as rejected without forcing, and still pushes the others', async () => {
    const theirs = remoteSha('diverged')
    const res = await gitService.pushBranches(repo, 'origin', ['diverged', 'ahead', 'fresh'], { setUpstream: true })
    const by = Object.fromEntries(res.results.map((r) => [r.branch, r]))
    expect(by.diverged).toMatchObject({ status: 'rejected', rejection: 'nonFastForward' })
    expect(by.ahead.status).toBe('pushed')
    expect(by.fresh.status).toBe('created')
    expect(remoteSha('diverged')).toBe(theirs) // not forced
    expect(remoteSha('ahead')).toBe(git('rev-parse', 'ahead'))
  })

  it('with atomic, pushes nothing when one branch is rejected', async () => {
    const before = remoteSha('ahead')
    const res = await gitService.pushBranches(repo, 'origin', ['ahead', 'fresh', 'diverged'], {
      setUpstream: true,
      atomic: true
    })
    expect(res.atomic).toBe(true)
    expect(res.results.every((r) => r.status === 'rejected')).toBe(true)
    expect(res.results.find((r) => r.branch === 'ahead')?.rejection).toBe('atomic')
    expect(remoteSha('ahead')).toBe(before)
    expect(remoteHas('fresh')).toBe(false)
    expect(res.results.some((r) => r.upstreamSet)).toBe(false)
  })

  it('reports a server-side hook refusal per branch, with what the server said', async () => {
    const hook = join(remote, 'hooks', 'update')
    writeFileSync(hook, '#!/bin/sh\n[ "$1" = refs/heads/ahead ] && { echo "ahead is protected" >&2; exit 1; }\nexit 0\n')
    chmodSync(hook, 0o755)
    const res = await gitService.pushBranches(repo, 'origin', ['ahead', 'fresh'], { setUpstream: true })
    const by = Object.fromEntries(res.results.map((r) => [r.branch, r]))
    expect(by.ahead).toMatchObject({ status: 'rejected', rejection: 'remoteRejected' })
    expect(by.fresh.status).toBe('created')
    expect(res.remoteMessages.join('\n')).toMatch(/ahead is protected/)
  })

  it('throws when the push never reaches the refs, and refuses bad input', async () => {
    await expect(gitService.pushBranches(repo, 'nowhere', ['ahead'], { setUpstream: false })).rejects.toThrow()
    await expect(gitService.pushBranches(repo, 'origin', ['nope'], { setUpstream: false })).rejects.toThrow(/No local branch/)
    await expect(gitService.pushBranches(repo, 'origin', ['--force'], { setUpstream: false })).rejects.toThrow()
    await expect(gitService.pushBranches(repo, '-f', ['ahead'], { setUpstream: false })).rejects.toThrow()
    await expect(gitService.pushBranches(repo, 'origin', [], { setUpstream: false })).rejects.toThrow()
  })

  it('lists the files each branch would publish, history included', async () => {
    git('checkout', '-q', 'fresh2')
    writeFileSync(join(repo, '.env'), 'TOKEN=1')
    git('add', '.env')
    git('commit', '-qm', 'oops')
    git('rm', '-q', '.env')
    git('commit', '-qm', 'remove it again')
    git('checkout', '-q', 'main')
    const files = await gitService.outgoingFiles(repo, 'origin', ['fresh2', 'uptodate', 'ahead'])
    expect(files.fresh2).toContain('.env') // deleted at the tip, still in the commits that go out
    expect(files.uptodate).toEqual([])
    expect(files.ahead).toEqual([]) // empty commits touch no files
    expect(partitionBySecrets(['fresh2', 'ahead'], files, isSecretFile).flagged.map((f) => f.branch)).toEqual(['fresh2'])
  })
})
