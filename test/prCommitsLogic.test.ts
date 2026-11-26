import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { getLocalDayKey, getPrCommitWebUrl, groupCommitsByDay } from '../src/renderer/src/lib/prCommits'
import { gitService, gitMethodIsRead } from '../src/main/git'
import { repoPath } from './helpers'
import type { PrCommit } from '../src/shared/types'

// The Commits tab's pure parts — day groups and host links — and the one git
// read behind it: which of a pull request's commits this clone has.

const commit = (sha: string, authoredAt: string): PrCommit => ({ sha, shortSha: sha.slice(0, 7), subject: sha, authorName: 'Ana', authoredAt })
/** A local wall-clock time as an ISO string, so the day is the same in every time zone the suite runs in. */
const local = (y: number, m: number, d: number, h: number): string => new Date(y, m - 1, d, h).toISOString()

describe('the Commits tab — grouping by day', () => {
  it('a run of commits on one local day is one group, in the list’s order', () => {
    const groups = groupCommitsByDay([
      commit('a', local(2026, 11, 2, 9)),
      commit('b', local(2026, 11, 2, 23)),
      commit('c', local(2026, 11, 3, 1))
    ])
    expect(groups.map((g) => [g.day, g.commits.map((c) => c.sha)])).toEqual([
      ['2026-11-02', ['a', 'b']],
      ['2026-11-03', ['c']]
    ])
  })

  it('a commit out of date order starts a group of its own instead of moving', () => {
    const groups = groupCommitsByDay([commit('a', local(2026, 11, 4, 9)), commit('b', local(2026, 11, 2, 9)), commit('c', local(2026, 11, 4, 10))])
    expect(groups.map((g) => g.day)).toEqual(['2026-11-04', '2026-11-02', '2026-11-04'])
  })

  it('a date that does not parse groups under the empty day', () => {
    expect(getLocalDayKey('')).toBe('')
    expect(groupCommitsByDay([commit('a', 'not a date')])[0].day).toBe('')
    expect(groupCommitsByDay([])).toEqual([])
  })
})

describe('the Commits tab — a commit’s page on its host', () => {
  const SHA = 'abc1234def5678abc1234def5678abc1234def56'
  it.each([
    ['https://github.com/team/app/pull/7', `https://github.com/team/app/pull/7/commits/${SHA}`],
    ['https://ghe.example.corp/team/app/pull/7/files', `https://ghe.example.corp/team/app/pull/7/commits/${SHA}`],
    ['https://gitlab.example.corp/group/sub/app/-/merge_requests/7', `https://gitlab.example.corp/group/sub/app/-/merge_requests/7/diffs?commit_id=${SHA}`],
    ['https://dev.azure.com/acme/proj/_git/app/pullrequest/7', `https://dev.azure.com/acme/proj/_git/app/commit/${SHA}`],
    [
      'https://bitbucket.example.corp/bitbucket/projects/PROJ/repos/app/pull-requests/7/overview',
      `https://bitbucket.example.corp/bitbucket/projects/PROJ/repos/app/pull-requests/7/commits/${SHA}`
    ],
    ['https://bitbucket.org/team/app/pull-requests/7', `https://bitbucket.org/team/app/commits/${SHA}`],
    ['https://git.example.corp/team/app/pulls/7', `https://git.example.corp/team/app/commit/${SHA}`]
  ])('%s', (pr, want) => {
    expect(getPrCommitWebUrl(pr, SHA)).toBe(want)
  })

  it('nothing for a page it does not know, a non-web scheme, or a sha that is not one', () => {
    expect(getPrCommitWebUrl('https://example.com/somewhere', SHA)).toBeNull()
    expect(getPrCommitWebUrl('file:///team/app/pull/7', SHA)).toBeNull()
    expect(getPrCommitWebUrl('not a url', SHA)).toBeNull()
    expect(getPrCommitWebUrl('https://github.com/team/app/pull/7', '../../evil')).toBeNull()
  })
})

describe('which of a pull request’s commits this clone has', () => {
  const R = repoPath('merge-conflict')

  it('is a read, and answers only for full shas the repository holds as commits', async () => {
    expect(gitMethodIsRead('getLocalCommits')).toBe(true)
    const [head] = await gitService.log(R, 1)
    const absent = 'f'.repeat(40)
    const found = await gitService.getLocalCommits(R, [head.hash, absent, head.hash.slice(0, 7), 'HEAD', '--all', 42])
    expect(found).toEqual([head.hash])
    expect(await gitService.getLocalCommits(R, 'nope')).toEqual([])
  })

  it('a tree id is not a commit', async () => {
    const tree = execFileSync('git', ['-C', R, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim()
    expect(await gitService.getLocalCommits(R, [tree])).toEqual([])
  })
})
