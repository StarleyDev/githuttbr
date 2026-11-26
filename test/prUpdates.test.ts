import { describe, it, expect } from 'vitest'
import type { PrCommit, PrUpdate } from '../src/shared/types'
import type { RawPrCommit } from '../src/shared/prCommits'
import {
  finishPrUpdates,
  groupForgejoPushes,
  groupGithubTimeline,
  groupUpdatesByHeads,
  keepFirstListing,
  PR_UPDATES_MAX,
  reachableCommits,
  singleUpdate,
  toUpdateCommits,
  type PrUpdateDraft
} from '../src/shared/prUpdates'
import {
  getNewestSeenMark,
  getNewUpdateIds,
  getUpdateCompare,
  getUpdateNumbering,
  getUpdatesNewestFirst,
  getUpdatesSeenKey,
  getUpdateTitle,
  parseUpdatesSeenMark
} from '../src/renderer/src/lib/prUpdates'
import { bbsDiffsToFiles } from '../src/main/bitbucketServer'
import { parseForgejoPushBody } from '../src/main/forgejo'

// The Updates tab's pure rules: how each host's record becomes numbered
// updates, what "new since your last visit" means, and what an update's own
// diff compares. No IO; the hosts' own requests are in prUpdatesHosts.test.ts.

const sha = (tag: string): string => tag.padEnd(40, '0')
const raw = (tag: string, parents: string[] = [], extra: Partial<RawPrCommit> = {}): RawPrCommit => ({
  sha: sha(tag),
  message: `Subject ${tag}`,
  authorName: 'Ana',
  authoredAt: '2026-11-01T10:00:00Z',
  parentShas: parents.map(sha),
  ...extra
})
const shas = (list: PrCommit[]): string[] => list.map((c) => c.shortSha.slice(0, 2))

describe('finishPrUpdates', () => {
  const draft = (id: string, head?: string, extra: Partial<PrUpdateDraft> = {}): PrUpdateDraft => ({
    id,
    kind: 'push',
    createdAt: '',
    ...(head ? { headSha: sha(head) } : {}),
    added: [],
    ...extra
  })

  it('numbers oldest first and compares each update with the previous head', () => {
    const { updates, truncated } = finishPrUpdates([draft('a', 'a1', { kind: 'opened' }), draft('b', 'b2'), draft('c', 'c3')])
    expect(updates.map((u) => u.index)).toEqual([1, 2, 3])
    expect(updates[0].fromSha).toBeUndefined()
    expect(updates[1].fromSha).toBe(sha('a1'))
    expect(updates[2].fromSha).toBe(sha('b2'))
    expect(updates[2].removed).toEqual([])
    expect(truncated).toBe(false)
  })

  it('a start cut by the host is no opening, and the list says so', () => {
    const { updates, truncated, startCut } = finishPrUpdates([draft('a', 'a1', { kind: 'opened' }), draft('b', 'b2')], true)
    expect(updates[0].kind).toBe('push')
    expect(truncated).toBe(true)
    expect(startCut).toBe(true)
  })

  it('keeps a base the host named (a force push’s own “before”)', () => {
    const { updates } = finishPrUpdates([draft('a', 'a1'), draft('b', 'b2', { fromSha: sha('ff') })])
    expect(updates[1].fromSha).toBe(sha('ff'))
  })

  it('keeps the newest past the cap, numbered as they were', () => {
    const many = Array.from({ length: PR_UPDATES_MAX + 5 }, (_, i) => draft(`u${i}`, `h${i}`))
    const { updates, truncated } = finishPrUpdates(many)
    expect(truncated).toBe(true)
    expect(updates).toHaveLength(PR_UPDATES_MAX)
    expect(updates[0].index).toBe(6)
    expect(updates[updates.length - 1].index).toBe(PR_UPDATES_MAX + 5)
  })
})

describe('keepFirstListing (Azure: lists that may or may not repeat earlier commits)', () => {
  const c = (tag: string): PrCommit => toUpdateCommits([raw(tag)], false)[0]
  it('counts a commit in the first list that names it, whichever way the host lists', () => {
    const own = keepFirstListing([[c('a1')], [c('a1'), c('b2')], [c('c3')]])
    expect(own.map(shas)).toEqual([['a1'], ['b2'], ['c3']])
  })
})

describe('groupUpdatesByHeads (GitLab diff versions)', () => {
  const graph = (list: RawPrCommit[]): Map<string, RawPrCommit> => new Map(list.map((r) => [r.sha, r]))

  it('walks parents within the PR only', () => {
    const g = graph([raw('a1', ['base']), raw('b2', ['a1'])])
    expect(reachableCommits(sha('b2'), g).map((s) => s.slice(0, 2))).toEqual(['b2', 'a1'])
  })

  it('a plain push adds what the new head reaches and the old did not', () => {
    const g = graph([raw('a1', ['base']), raw('b2', ['a1']), raw('c3', ['b2'])])
    const drafts = groupUpdatesByHeads(
      [
        { id: '1', createdAt: '2026-11-01T10:00:00Z', headSha: sha('a1'), baseSha: sha('base') },
        { id: '2', createdAt: '2026-11-02T10:00:00Z', headSha: sha('c3') }
      ],
      g
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'push'])
    expect(drafts[0].fromSha).toBe(sha('base'))
    expect(shas(drafts[0].added)).toEqual(['a1'])
    expect(shas(drafts[1].added)).toEqual(['b2', 'c3'])
    expect(drafts[1].removed).toEqual([])
  })

  it('a force push that drops a commit is a rewrite, and says what it removed', () => {
    // v1: a1 → b2. v2: a1 → x9 (b2 amended away).
    const g = graph([raw('a1', ['base']), raw('b2', ['a1']), raw('x9', ['a1'])])
    const drafts = groupUpdatesByHeads(
      [
        { id: '1', createdAt: '', headSha: sha('b2') },
        { id: '2', createdAt: '', headSha: sha('x9') }
      ],
      g
    )
    expect(drafts[1].kind).toBe('rewrite')
    expect(shas(drafts[1].added)).toEqual(['x9'])
    expect(shas(drafts[1].removed!)).toEqual(['b2'])
  })
})

describe('groupGithubTimeline (approximate)', () => {
  const opened = { at: '2026-11-01T10:00:00Z', author: 'ana' }
  const commit = (tag: string, at: string, parents: string[] = []): { type: 'commit'; commit: RawPrCommit; committedAt: string } => ({
    type: 'commit',
    commit: raw(tag, parents),
    committedAt: at
  })

  it('commits from before the opening are the opening; later ones a push', () => {
    const drafts = groupGithubTimeline(
      [
        commit('a1', '2026-11-01T09:00:00Z', ['ba']),
        commit('b2', '2026-11-01T09:05:00Z', ['a1']),
        commit('c3', '2026-11-03T08:00:00Z', ['b2'])
      ],
      opened
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'push'])
    expect(drafts[0].pusher).toBe('ana')
    expect(shas(drafts[0].added)).toEqual(['a1', 'b2'])
    expect(drafts[0].headSha).toBe(sha('b2'))
    expect(shas(drafts[1].added)).toEqual(['c3'])
    expect(drafts[1].createdAt).toBe('2026-11-03T08:00:00Z')
  })

  it('one push of two chained commits minutes apart is one update', () => {
    const drafts = groupGithubTimeline(
      [
        commit('a1', '2026-11-01T09:00:00Z', ['ba']),
        commit('b2', '2026-11-02T14:00:00Z', ['a1']),
        commit('c3', '2026-11-02T14:04:00Z', ['b2'])
      ],
      opened
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'push'])
    expect(shas(drafts[1].added)).toEqual(['b2', 'c3'])
    // Dated by its last commit: the push came after it.
    expect(drafts[1].createdAt).toBe('2026-11-02T14:04:00Z')
  })

  it('two pushes two hours apart are two updates', () => {
    const drafts = groupGithubTimeline(
      [
        commit('a1', '2026-11-01T09:00:00Z', ['ba']),
        commit('b2', '2026-11-02T14:00:00Z', ['a1']),
        commit('c3', '2026-11-02T16:00:00Z', ['b2'])
      ],
      opened
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'push', 'push'])
    expect(drafts.map((d) => d.headSha)).toEqual([sha('a1'), sha('b2'), sha('c3')])
  })

  it('a commit that does not chain on the one before starts an update', () => {
    const drafts = groupGithubTimeline(
      [
        commit('a1', '2026-11-01T09:00:00Z', ['ba']),
        commit('b2', '2026-11-02T14:00:00Z', ['a1']),
        commit('c3', '2026-11-02T14:02:00Z', ['zz'])
      ],
      opened
    )
    expect(drafts.map((d) => shas(d.added))).toEqual([['a1'], ['b2'], ['c3']])
  })

  it('a force push starts a rewrite with its actor, its after-head and its before-head', () => {
    const drafts = groupGithubTimeline(
      [
        commit('a1', '2026-11-01T09:00:00Z'),
        { type: 'forcePush', at: '2026-11-02T12:00:00Z', actor: 'bruno', beforeSha: sha('a1'), afterSha: sha('r5') },
        commit('r5', '2026-11-02T11:59:00Z')
      ],
      opened
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'rewrite'])
    expect(drafts[1]).toMatchObject({ pusher: 'bruno', headSha: sha('r5'), fromSha: sha('a1') })
    expect(shas(drafts[1].added)).toEqual(['r5'])
    // Ids follow the heads, so the "seen" mark survives a re-read.
    expect(drafts[1].id).toBe(`rewrite:${sha('r5')}`)
  })

  it('a rebase whose commits the timeline lists before its force push is one rewrite, not a push too', () => {
    const drafts = groupGithubTimeline(
      [
        commit('a1', '2026-11-01T09:00:00Z', ['ba']),
        // The rebased copies, committed just before the force push and listed before it.
        commit('r4', '2026-11-04T11:58:00Z', ['nb']),
        commit('r5', '2026-11-04T11:59:00Z', ['r4']),
        { type: 'forcePush', at: '2026-11-04T12:00:00Z', actor: 'ana', beforeSha: sha('a1'), afterSha: sha('r5') }
      ],
      opened
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'rewrite'])
    expect(shas(drafts[1].added)).toEqual(['r4', 'r5'])
    expect(drafts[1].headSha).toBe(sha('r5'))
  })

  it('an opening whose commits were all rewritten still stands, with an id of its own', () => {
    const drafts = groupGithubTimeline([{ type: 'forcePush', at: '2026-11-02T12:00:00Z' }], opened)
    expect(drafts[0].added).toEqual([])
    expect(drafts[0].id).toMatch(/^opened:0:/)
  })
})

describe('Forgejo push comments', () => {
  it('parses a push body, keeping only full commit ids', () => {
    expect(parseForgejoPushBody(JSON.stringify({ is_force_push: false, commit_ids: [sha('a1'), 'HEAD~1'] }))).toEqual({
      force: false,
      commitIds: [sha('a1')]
    })
    expect(parseForgejoPushBody(JSON.stringify({ is_force_push: true, commit_ids: [sha('a1'), sha('b2')] }))?.force).toBe(true)
    expect(parseForgejoPushBody('not json')).toBeNull()
    expect(parseForgejoPushBody(JSON.stringify({ text: 'x' }))).toBeNull()
  })

  const openedAt = { at: '2026-11-01T10:00:00Z', author: 'ana' }

  it('a push lists its commits oldest first, as the server writes them; a force push its heads', () => {
    const commits = [raw('a1', ['base']), raw('b2', ['a1']), raw('c3', ['b2'])]
    const drafts = groupForgejoPushes(
      [
        { id: 'comment:7', at: '2026-11-02T10:00:00Z', pusher: 'ana', force: false, commitIds: [sha('b2'), sha('c3')] },
        { id: 'comment:9', at: '2026-11-03T10:00:00Z', pusher: 'ana', force: true, commitIds: [sha('c3'), sha('d4')] }
      ],
      openedAt,
      commits
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'push', 'rewrite'])
    expect(shas(drafts[1].added)).toEqual(['b2', 'c3'])
    expect(drafts[1].headSha).toBe(sha('c3'))
    expect(drafts[2]).toMatchObject({ fromSha: sha('c3'), headSha: sha('d4'), added: [] })
  })

  it('the push comment written with the pull request is the opening: no empty Update 1, and Update 2 has a base', () => {
    const commits = [raw('a1', ['base']), raw('b2', ['a1']), raw('c3', ['b2'])]
    const drafts = groupForgejoPushes(
      [
        { id: 'comment:2', at: '2026-11-01T10:00:02Z', pusher: 'ana', force: false, commitIds: [sha('a1'), sha('b2')] },
        { id: 'comment:7', at: '2026-11-02T10:00:00Z', pusher: 'ana', force: false, commitIds: [sha('c3')] }
      ],
      openedAt,
      commits
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'push'])
    expect(shas(drafts[0].added)).toEqual(['a1', 'b2'])
    expect(drafts[0].headSha).toBe(sha('b2'))
    const { updates } = finishPrUpdates(drafts)
    expect(updates[1].fromSha).toBe(sha('b2'))
  })

  it('a push long after the opening is not the opening’s', () => {
    const drafts = groupForgejoPushes(
      [{ id: 'comment:7', at: '2026-11-01T10:05:00Z', force: false, commitIds: [sha('b2')] }],
      openedAt,
      [raw('a1', ['base']), raw('b2', ['a1'])]
    )
    expect(drafts.map((d) => shas(d.added))).toEqual([['a1'], ['b2']])
  })

  it('after a force push the rebased commits are not the opening’s, and the rewrite lists none', () => {
    // The branch now holds only the rebased r4, r5; nothing says what the opening had.
    const drafts = groupForgejoPushes(
      [{ id: 'comment:9', at: '2026-11-03T10:00:00Z', force: true, commitIds: [sha('a1'), sha('r5')] }],
      openedAt,
      [raw('r4', ['nb']), raw('r5', ['r4'])]
    )
    expect(drafts.map((d) => d.kind)).toEqual(['opened', 'rewrite'])
    expect(drafts[0].added).toEqual([])
    expect(drafts[1]).toMatchObject({ fromSha: sha('a1'), headSha: sha('r5'), added: [] })
  })

  it('a timeline cut before its start has no opening', () => {
    const drafts = groupForgejoPushes(
      [{ id: 'comment:70', at: '2026-11-02T10:00:00Z', force: false, commitIds: [sha('c3')] }],
      openedAt,
      [raw('c3')],
      true
    )
    expect(drafts.map((d) => d.kind)).toEqual(['push'])
  })

  it('a server without pushes on record gets one update with every commit', () => {
    const drafts = singleUpdate([raw('a1'), raw('b2')], { at: '2026-11-01T10:00:00Z' })
    expect(drafts).toHaveLength(1)
    expect(shas(drafts[0].added)).toEqual(['a1', 'b2'])
  })
})

describe('bbsDiffsToFiles (Data Center compare)', () => {
  it('draws the structured diff as unified hunks', () => {
    const files = bbsDiffsToFiles([
      {
        source: { toString: 'src/app.ts' },
        destination: { toString: 'src/app.ts' },
        hunks: [
          {
            sourceLine: 1,
            sourceSpan: 2,
            destinationLine: 1,
            destinationSpan: 2,
            segments: [
              { type: 'CONTEXT', lines: [{ line: 'const a = 1' }] },
              { type: 'REMOVED', lines: [{ line: 'const b = 2' }] },
              { type: 'ADDED', lines: [{ line: 'const b = 3' }] }
            ]
          }
        ]
      },
      { source: null, destination: { toString: 'NEW.md' }, hunks: [] },
      { source: { toString: 'old.txt' }, destination: { toString: 'new.txt' }, hunks: [] }
    ])
    expect(files[0]).toEqual({
      filename: 'src/app.ts',
      status: 'modified',
      additions: 1,
      deletions: 1,
      patch: '@@ -1,2 +1,2 @@\n const a = 1\n-const b = 2\n+const b = 3'
    })
    expect(files[1]).toMatchObject({ filename: 'NEW.md', status: 'added' })
    expect(files[2]).toMatchObject({ filename: 'new.txt', status: 'renamed', previousFilename: 'old.txt' })
  })
})

describe('new since your last visit', () => {
  const update = (id: string, index: number, at: string, extra: Partial<PrUpdate> = {}): PrUpdate => ({
    id,
    index,
    kind: index === 1 ? 'opened' : 'push',
    createdAt: at,
    added: [],
    removed: [],
    ...extra
  })
  const list = [
    update('1', 1, '2026-11-01T10:00:00Z'),
    update('2', 2, '2026-11-02T10:00:00Z'),
    update('3', 3, '2026-11-03T10:00:00Z')
  ]

  it('has its own storage key per repository and pull request', () => {
    expect(getUpdatesSeenKey('https://git.example.corp/team/app.git', 4)).toBe(
      'githuttbr-pr-updates-seen:https://git.example.corp/team/app.git#4'
    )
  })

  it('nothing is new on a first visit', () => {
    expect(getNewUpdateIds(list, null).size).toBe(0)
  })

  it('what follows the seen update is new', () => {
    expect([...getNewUpdateIds(list, { id: '1', at: '2026-11-01T10:00:00Z' })]).toEqual(['2', '3'])
    expect(getNewUpdateIds(list, { id: '3', at: '' }).size).toBe(0)
  })

  it('a seen update no longer listed (GitHub regrouped) falls back to its date', () => {
    expect([...getNewUpdateIds(list, { id: 'gone', at: '2026-11-02T12:00:00Z' })]).toEqual(['3'])
    expect(getNewUpdateIds(list, { id: 'gone', at: 'not a date' }).size).toBe(0)
  })

  it('the mark is the newest update, and reads back only when well formed', () => {
    const mark = getNewestSeenMark(list)
    expect(mark).toEqual({ id: '3', at: '2026-11-03T10:00:00Z' })
    expect(parseUpdatesSeenMark(JSON.stringify(mark))).toEqual(mark)
    expect(parseUpdatesSeenMark('{"id":7}')).toBeNull()
    expect(parseUpdatesSeenMark('nope')).toBeNull()
    expect(parseUpdatesSeenMark(null)).toBeNull()
    expect(getNewestSeenMark([])).toBeNull()
  })

  it('lists newest first and names the opening apart', () => {
    expect(getUpdatesNewestFirst(list).map((u) => u.id)).toEqual(['3', '2', '1'])
    const numbering = getUpdateNumbering(list, false)
    expect(getUpdateTitle(list[0], numbering)).toEqual({ key: 'prUpdates.titleOpened', vars: { n: '1' } })
    expect(getUpdateTitle(list[2], numbering)).toEqual({ key: 'prUpdates.title', vars: { n: '3' } })
  })

  it('a list cut before its opening counts back from the latest', () => {
    const numbering = getUpdateNumbering(list, true)
    expect(getUpdateTitle(list[2], numbering)).toEqual({ key: 'prUpdates.titleLatest', vars: {} })
    expect(getUpdateTitle(list[0], numbering)).toEqual({ key: 'prUpdates.titleBefore', vars: { n: '2' } })
  })
})

describe('getUpdateCompare', () => {
  const u = (extra: Partial<PrUpdate>): PrUpdate => ({ id: 'x', index: 2, kind: 'push', createdAt: '', added: [], removed: [], ...extra })

  it('compares the previous head with this one', () => {
    expect(getUpdateCompare(u({ fromSha: sha('a1'), headSha: sha('b2') }))).toEqual({
      from: { sha: sha('a1') },
      to: { sha: sha('b2') },
      previousIndex: 1
    })
  })

  it('Azure: by iteration too, and the first against iteration 0 — the merge base', () => {
    expect(getUpdateCompare(u({ fromSha: sha('a1'), headSha: sha('b2'), iteration: 4, index: 4 }))).toMatchObject({
      from: { iteration: 3 },
      to: { iteration: 4 },
      previousIndex: 3
    })
    expect(getUpdateCompare(u({ fromSha: sha('ba'), headSha: sha('a1'), iteration: 1, index: 1, kind: 'opened' }))).toMatchObject({
      from: { iteration: 0 },
      previousIndex: null
    })
  })

  it('nothing to compare without both ends, or when they are the same', () => {
    expect(getUpdateCompare(u({ headSha: sha('b2') }))).toBeNull()
    expect(getUpdateCompare(u({ fromSha: sha('a1') }))).toBeNull()
    expect(getUpdateCompare(u({ fromSha: sha('a1'), headSha: sha('a1') }))).toBeNull()
  })
})
