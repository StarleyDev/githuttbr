import { describe, expect, it } from 'vitest'
import type { PullRequest } from '../src/shared/types'
import { matchesQuery, type PrListItem } from '../src/renderer/src/lib/prList'
import { getPullRequestListExtras, type GithubGraphqlRawPost } from '../src/main/githubGraphql'
import {
  countCiFailing,
  getPrCommentLabel,
  getPrNewCommentCount,
  getPrReviewLines,
  getPrSize,
  getPrTriage,
  hasPrNewActivity
} from '../src/renderer/src/lib/prListRow'

const pr = (id: number, extra: Partial<PullRequest> = {}): PullRequest => ({
  id,
  title: `PR ${id}`,
  author: 'ana',
  sourceBranch: 'feat/x',
  targetBranch: 'main',
  url: '',
  isDraft: false,
  state: 'open',
  ...extra
})
const item = (p: PullRequest): PrListItem => ({ pr: p, remoteUrl: 'https://example.test/o/r' })
const at = (ms: number): string => new Date(ms).toISOString()

describe('PR list rows: triage', () => {
  it('splits awaiting your review, yours and the others', () => {
    const rows = [
      item(pr(1, { requestedReviewers: ['you'] })),
      item(pr(2, { author: 'you', requestedReviewers: ['you'] })),
      item(pr(3, { awaitingYou: true })),
      item(pr(4))
    ]
    const t = getPrTriage(rows, 'you')
    expect(t.awaiting.map((r) => r.pr.id)).toEqual([1, 3])
    expect(t.mine.map((r) => r.pr.id)).toEqual([2])
    expect(t.others.map((r) => r.pr.id)).toEqual([4])
  })

  it('puts everything in others when the account is unknown', () => {
    const t = getPrTriage([item(pr(1, { requestedReviewers: ['you'] }))], null)
    expect(t.others).toHaveLength(1)
  })

  it('finds a PR by its author', () => {
    expect(matchesQuery(pr(1, { author: 'bruno' }), 'bru')).toBe(true)
  })
})

describe('PR list rows: since the last visit', () => {
  it('marks a PR updated after the last visit, never one not visited', () => {
    const p = pr(1, { updatedAt: at(2_000) })
    expect(hasPrNewActivity(p, 1_000)).toBe(true)
    expect(hasPrNewActivity(p, 3_000)).toBe(false)
    expect(hasPrNewActivity(p, null)).toBe(false)
    expect(hasPrNewActivity(pr(2), 1_000)).toBe(false)
  })

  it('counts the comments others wrote after the visit', () => {
    const p = pr(1, {
      commentCount: 4,
      recentComments: [
        { at: at(500), author: 'bruno' },
        { at: at(1_500), author: 'bruno' },
        { at: at(1_600), author: 'You' },
        { at: at(1_700), author: 'ana' }
      ]
    })
    expect(getPrNewCommentCount(p, 1_000, 'you')).toBe(2)
    expect(getPrNewCommentCount(p, null, 'you')).toBe(0)
    expect(getPrNewCommentCount(pr(2, { commentCount: 3 }), 1_000, 'you')).toBeNull()
    expect(getPrCommentLabel(p, 1_000, 'you')).toEqual({ key: 'prList.newComments', n: 2 })
    expect(getPrCommentLabel(p, 9_000, 'you')).toEqual({ key: 'prList.comments', n: 4 })
    expect(getPrCommentLabel(pr(3, { commentCount: 1 }), null, 'you')).toEqual({ key: 'prList.commentsOne', n: 1 })
    expect(getPrCommentLabel(pr(4, { commentCount: 0 }), null, 'you')).toBeNull()
    expect(getPrCommentLabel(pr(5), null, 'you')).toBeNull()
  })
})

describe('PR list rows: size and checks', () => {
  it('shows a size only when the host gave all of it', () => {
    expect(getPrSize(pr(1, { additions: 48, deletions: 0, changedFiles: 4 }))).toEqual({ additions: 48, deletions: 0, files: 4 })
    expect(getPrSize(pr(2, { additions: 48 }))).toBeNull()
  })

  it('counts the failing heads', () => {
    expect(countCiFailing([pr(1, { ci: 'failure' }), pr(2, { ci: 'success' }), pr(3)])).toBe(1)
  })
})

describe('PR list rows: the review column', () => {
  const keys = (p: PullRequest, me = 'you'): string[] => getPrReviewLines(p, me).lines.map((l) => l.key)

  it('lists each verdict, then who is still asked — you in yellow', () => {
    const p = pr(1, { reviews: [{ login: 'bruno', verdict: 'approved' }], requestedReviewers: ['you'] })
    const { lines } = getPrReviewLines(p, 'you')
    expect(lines).toEqual([
      { key: 'prList.reviewApproved', vars: { name: 'bruno' }, tone: 'green' },
      { key: 'prList.reviewWaitingYou', vars: {}, tone: 'yellow' }
    ])
  })

  it('reads a change request first', () => {
    const p = pr(1, {
      reviews: [
        { login: 'bruno', verdict: 'approved' },
        { login: 'ana', verdict: 'changes' }
      ]
    })
    expect(keys(p)).toEqual(['prList.reviewChanges', 'prList.reviewApproved'])
  })

  it('says ready to merge when the host does and the checks did not fail', () => {
    expect(keys(pr(1, { readyToMerge: true, ci: 'success', reviews: [] }))).toEqual(['prList.reviewReady'])
    expect(keys(pr(2, { readyToMerge: true, ci: 'failure', reviews: [{ login: 'ana', verdict: 'approved' }] }))).toEqual([
      'prList.reviewApproved'
    ])
  })

  it('says no reviewers only when the host listed the verdicts', () => {
    expect(keys(pr(1, { reviews: [] }))).toEqual(['prList.reviewNone'])
    expect(keys(pr(2))).toEqual([])
    expect(keys(pr(3, { state: 'merged', reviews: [] }))).toEqual([])
  })

  it('shows a re-requested reviewer as asked, not by the old verdict', () => {
    const p = pr(1, { reviews: [{ login: 'bruno', verdict: 'changes' }], requestedReviewers: ['bruno'] })
    expect(getPrReviewLines(p, 'you').lines).toEqual([{ key: 'prList.reviewWaiting', vars: { name: 'bruno' }, tone: 'muted' }])
  })

  it('folds the rest into "+N more" but never the line about you', () => {
    const p = pr(1, {
      reviews: [
        { login: 'a', verdict: 'approved' },
        { login: 'b', verdict: 'approved' },
        { login: 'c', verdict: 'approved' }
      ],
      requestedReviewers: ['you']
    })
    const r = getPrReviewLines(p, 'you')
    expect(r.lines.map((l) => l.key)).toEqual(['prList.reviewApproved', 'prList.reviewWaitingYou'])
    expect(r.more).toBe(2)
  })
})

describe('PR list extras from GitHub GraphQL', () => {
  it('asks once for every row and maps size, comments and verdicts', async () => {
    const queries: string[] = []
    const post = (async (query: string) => {
      queries.push(query)
      return {
        data: {
          repository: {
            pr7: {
              number: 7,
              additions: 48,
              deletions: 12,
              changedFiles: 4,
              reviewDecision: 'APPROVED',
              comments: { totalCount: 3, nodes: [{ createdAt: '2026-01-01T00:00:00Z', author: { login: 'ana' } }] },
              latestReviews: {
                nodes: [
                  { state: 'APPROVED', author: { login: 'bruno' } },
                  { state: 'CHANGES_REQUESTED', author: { login: 'ana' } },
                  { state: 'COMMENTED', author: { login: 'carla' } }
                ]
              }
            },
            pr8: null
          }
        },
        errors: [{ type: 'NOT_FOUND' }],
        exhausted: false
      }
    }) as unknown as GithubGraphqlRawPost
    const out = await getPullRequestListExtras(post, 'o', 'r', [7, 8, 7])
    expect(queries).toHaveLength(1)
    expect(queries[0].match(/pullRequest\(number:/g)).toHaveLength(2)
    expect(out.get(7)).toEqual({
      additions: 48,
      deletions: 12,
      changedFiles: 4,
      commentCount: 3,
      recentComments: [{ at: '2026-01-01T00:00:00Z', author: 'ana' }],
      reviews: [
        { login: 'bruno', verdict: 'approved' },
        { login: 'ana', verdict: 'changes' }
      ],
      readyToMerge: true
    })
    expect(out.has(8)).toBe(false)
  })
})
