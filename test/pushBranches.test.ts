import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { gitService } from '../src/main/git'
import {
  classifyPushState,
  duplicateDestinations,
  parsePushPorcelain,
  parseUpstreamTrack,
  pushRefspecs,
  pushResultsFrom,
  remoteMessages
} from '../src/shared/pushPorcelain'
import {
  canBatchPush,
  chosenPushTargets,
  defaultPushRemote,
  filterPushStates,
  initialPushSelection,
  partitionBySecrets,
  pushDestinationClashes,
  seedPushSelection,
  tallyPushResults,
  upstreamPushDecision
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
    state,
    upstreamTarget: null
  })
  const states = [st('a', 'ahead'), st('n', 'new'), st('u', 'upToDate'), st('b', 'behind'), st('d', 'diverged', true)]

  it('pre-ticks what has something to publish, and never what needs a force', () => {
    expect(initialPushSelection(states)).toEqual(['a', 'n'])
    expect(initialPushSelection(states, ['u', 'd', 'b'])).toEqual(['u'])
    expect(states.filter(canBatchPush).map((s) => s.name)).toEqual(['a', 'n', 'u'])
  })

  // `git checkout -b feature origin/main`: new under its own name, ahead of main.
  const fromMain = (name: string, isRemoteDefault = false): BranchPushState => ({
    ...st(name, 'new'),
    upstream: 'origin/main',
    upstreamTarget: { remoteBranch: 'main', remoteExists: true, ahead: 1, behind: 0, state: 'ahead', isRemoteDefault }
  })

  it('never pre-ticks a branch that tracks a branch of another name', () => {
    const rows = [...states, fromMain('feature')]
    expect(initialPushSelection(rows)).toEqual(['a', 'n'])
    expect(initialPushSelection(rows, ['feature', 'a'])).toEqual(['a'])
  })

  it('judges a row against the destination chosen for it', () => {
    const behindUp: BranchPushState = {
      ...fromMain('f'),
      upstreamTarget: { remoteBranch: 'main', remoteExists: true, ahead: 1, behind: 2, state: 'diverged', isRemoteDefault: false }
    }
    expect(canBatchPush(behindUp)).toBe(true) // its own name is new
    expect(canBatchPush(behindUp, true)).toBe(false) // main has moved on
    const rows = [fromMain('feature'), st('a', 'ahead')]
    expect(chosenPushTargets(rows, new Set(['feature', 'a']), new Set())).toEqual([
      { branch: 'feature', remoteBranch: 'feature' },
      { branch: 'a', remoteBranch: 'a' }
    ])
    expect(chosenPushTargets(rows, new Set(['feature']), new Set(['feature']))).toEqual([
      { branch: 'feature', remoteBranch: 'main' }
    ])
  })

  it('refuses two branches onto one remote branch, naming both', () => {
    const rows = [fromMain('f1'), fromMain('f2'), st('main', 'upToDate')]
    const both = chosenPushTargets(rows, new Set(['f1', 'f2']), new Set(['f1', 'f2']))
    expect(pushDestinationClashes(both)).toEqual([{ remoteBranch: 'main', branches: ['f1', 'f2'] }])
    // Onto a branch that is itself being pushed under its own name.
    const onto = chosenPushTargets(rows, new Set(['f1', 'main']), new Set(['f1']))
    expect(pushDestinationClashes(onto)).toEqual([{ remoteBranch: 'main', branches: ['f1', 'main'] }])
    expect(pushDestinationClashes(chosenPushTargets(rows, new Set(['f1', 'f2']), new Set()))).toEqual([])
    expect(duplicateDestinations([{ branch: 'x', remoteBranch: 'x' }])).toEqual([])
  })

  it('asks before pushing to another name, and warns harder for protected or default branches', () => {
    const none = (): boolean => false
    const own = [{ branch: 'feature', remoteBranch: 'feature' }]
    const redirected = [{ branch: 'feature', remoteBranch: 'main' }]
    expect(upstreamPushDecision([fromMain('feature')], own, none).kind).toBe('none')
    const plain = upstreamPushDecision([{ ...fromMain('feature'), upstreamTarget: { ...fromMain('feature').upstreamTarget!, remoteBranch: 'dev' } }], [{ branch: 'feature', remoteBranch: 'dev' }], none)
    expect(plain).toEqual({ kind: 'confirm', redirects: [{ branch: 'feature', remoteBranch: 'dev', sensitive: false }] })
    expect(upstreamPushDecision([fromMain('feature')], redirected, (b) => b === 'main').kind).toBe('confirmSensitive')
    expect(upstreamPushDecision([fromMain('feature', true)], redirected, none).kind).toBe('confirmSensitive')
  })

  it('seeds the ticks only from states read against the remote now chosen', () => {
    // origin: `a` is ahead. upstream: `a` is up to date and `n` is new.
    const onOrigin = { remote: 'origin', states: [st('a', 'ahead'), st('n', 'upToDate')] }
    const onUpstream = { remote: 'upstream', states: [st('a', 'upToDate'), st('n', 'new')] }
    expect(seedPushSelection(onOrigin, 'origin', null)).toEqual(['a'])
    expect(seedPushSelection(onOrigin, 'origin', 'origin')).toBeNull() // already seeded: the ticks are the user's
    // Switched to upstream, origin's states still in hand: no seed, and seededFor stays put.
    expect(seedPushSelection(onOrigin, 'upstream', 'origin')).toBeNull()
    // Upstream's own states arrive: they seed.
    expect(seedPushSelection(onUpstream, 'upstream', 'origin')).toEqual(['n'])
    expect(seedPushSelection(null, 'upstream', 'origin')).toBeNull()
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
    // Its own name, not the upstream's: the remote has no `renamed`, so it is new there.
    expect(by.renamed).toMatchObject({ state: 'new', remoteBranch: 'renamed', upstream: 'origin/other-name' })
    expect(by.renamed.upstreamTarget).toMatchObject({ remoteBranch: 'other-name', state: 'ahead', ahead: 1, behind: 0 })
    expect(by.ahead.upstreamTarget).toBeNull()
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
    const otherBefore = remoteSha('other-name')
    const res = await gitService.pushBranches(repo, 'origin', ['ahead', 'fresh', 'renamed', 'uptodate'], {
      setUpstream: true
    })
    const by = Object.fromEntries(res.results.map((r) => [r.branch, r]))
    expect(by.ahead.status).toBe('pushed')
    expect(by.fresh).toMatchObject({ status: 'created', upstreamSet: true })
    // Under its own name, and its existing upstream is left as it was.
    expect(by.renamed).toMatchObject({ status: 'created', remoteBranch: 'renamed', upstreamSet: false })
    expect(by.uptodate.status).toBe('upToDate')
    expect(remoteSha('ahead')).toBe(git('rev-parse', 'ahead'))
    expect(remoteSha('fresh')).toBe(git('rev-parse', 'fresh'))
    expect(remoteSha('renamed')).toBe(git('rev-parse', 'renamed'))
    expect(remoteSha('other-name')).toBe(otherBefore)
    expect(git('rev-parse', '--abbrev-ref', 'fresh@{u}')).toBe('origin/fresh')
    expect(git('symbolic-ref', '--short', 'HEAD')).toBe('main')
  })

  it('pushes to the upstream\'s other name only when asked to', async () => {
    const res = await gitService.pushBranches(repo, 'origin', ['renamed'], { setUpstream: true, toUpstream: ['renamed'] })
    expect(res.results[0]).toMatchObject({ status: 'pushed', remoteBranch: 'other-name' })
    expect(remoteSha('other-name')).toBe(git('rev-parse', 'renamed'))
    expect(remoteHas('renamed')).toBe(false)
    // Not for a branch whose upstream has its own name, or none.
    await expect(
      gitService.pushBranches(repo, 'origin', ['ahead'], { setUpstream: false, toUpstream: ['ahead'] })
    ).rejects.toThrow(/does not track a differently named branch/)
  })

  describe('a branch created from origin/main', () => {
    // `git checkout -b feature origin/main` — git's default autoSetupMerge makes
    // it track origin/main. A push of it must never fast-forward main unasked.
    beforeEach(() => {
      git('checkout', '-q', '-b', 'feature', 'origin/main')
      git('commit', '-q', '--allow-empty', '-m', 'unreviewed')
      git('checkout', '-q', '-b', 'feature2', 'origin/main')
      git('commit', '-q', '--allow-empty', '-m', 'also unreviewed')
      git('checkout', '-q', 'main')
      git('remote', 'set-head', 'origin', 'main')
    })

    it('shows it as new under its own name, ahead of main as the alternative, and does not tick it', async () => {
      expect(git('rev-parse', '--abbrev-ref', 'feature@{u}')).toBe('origin/main')
      const states = await gitService.branchPushStates(repo, 'origin')
      const feature = states.find((s) => s.name === 'feature')!
      expect(feature).toMatchObject({ remoteBranch: 'feature', remoteExists: false, state: 'new', ahead: 0 })
      expect(feature.upstreamTarget).toEqual({
        remoteBranch: 'main',
        remoteExists: true,
        ahead: 1,
        behind: 0,
        state: 'ahead',
        isRemoteDefault: true
      })
      expect(initialPushSelection(states)).not.toContain('feature')
      expect(initialPushSelection(states)).toContain('fresh')
    })

    it('pushed with the defaults, creates feature on the remote and leaves main untouched', async () => {
      const mainBefore = remoteSha('main')
      const res = await gitService.pushBranches(repo, 'origin', ['feature', 'feature2'], { setUpstream: true })
      expect(res.results.map((r) => [r.branch, r.remoteBranch, r.status])).toEqual([
        ['feature', 'feature', 'created'],
        ['feature2', 'feature2', 'created']
      ])
      expect(remoteSha('main')).toBe(mainBefore)
      expect(remoteSha('feature')).toBe(git('rev-parse', 'feature'))
      expect(git('rev-parse', '--abbrev-ref', 'feature@{u}')).toBe('origin/main') // not re-pointed
    })

    it('refuses two branches onto main before running git, naming both', async () => {
      const mainBefore = remoteSha('main')
      await expect(
        gitService.pushBranches(repo, 'origin', ['feature', 'feature2'], {
          setUpstream: false,
          toUpstream: ['feature', 'feature2']
        })
      ).rejects.toThrow(/feature and feature2 would all push to origin\/main/)
      expect(remoteSha('main')).toBe(mainBefore)
    })

    it('with the explicit choice, needs the strong confirm and then fast-forwards main', async () => {
      const states = await gitService.branchPushStates(repo, 'origin')
      const targets = chosenPushTargets(states, new Set(['feature']), new Set(['feature']))
      expect(targets).toEqual([{ branch: 'feature', remoteBranch: 'main' }])
      expect(upstreamPushDecision(states, targets, () => false).kind).toBe('confirmSensitive')
      await gitService.pushBranches(repo, 'origin', ['feature'], { setUpstream: false, toUpstream: ['feature'] })
      expect(remoteSha('main')).toBe(git('rev-parse', 'feature'))
    })
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
