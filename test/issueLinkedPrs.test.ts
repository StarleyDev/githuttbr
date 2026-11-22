import { describe, expect, it } from 'vitest'
import { GH_CLOSING_PRS_QUERY, parseClosingPrs } from '../src/main/hosting'

// Responses shaped like GitHub's GraphQL answer to GH_CLOSING_PRS_QUERY
// (Issue.closedByPullRequestsReferences → PullRequestConnection, nodes: [PullRequest]).
function response(nodes: unknown[] | null): unknown {
  return { data: { repository: { issue: { closedByPullRequestsReferences: nodes === null ? null : { nodes } } } } }
}

function pr(over: Record<string, unknown>): Record<string, unknown> {
  return {
    number: 1,
    title: 'Fix it',
    url: 'https://github.com/octo/app/pull/1',
    state: 'OPEN',
    merged: false,
    isDraft: false,
    repository: { nameWithOwner: 'octo/app' },
    ...over
  }
}

describe('parseClosingPrs', () => {
  it('asks for closed PRs too, or a closed issue would show nothing', () => {
    expect(GH_CLOSING_PRS_QUERY).toMatch(/closedByPullRequestsReferences\(first:\d+,includeClosedPrs:true\)/)
  })

  it('an issue with no closing PRs is "ok" and empty, not unavailable', () => {
    expect(parseClosingPrs(response([]), 'octo', 'app')).toEqual({ prs: [], status: 'ok' })
  })

  it('maps several PRs and orders open, merged, closed', () => {
    const { prs, status } = parseClosingPrs(
      response([
        pr({ number: 3, url: 'https://github.com/octo/app/pull/3', state: 'CLOSED' }),
        pr({ number: 2, url: 'https://github.com/octo/app/pull/2', state: 'MERGED', merged: true }),
        pr({ number: 4, url: 'https://github.com/octo/app/pull/4', isDraft: true, title: 'WIP' })
      ]),
      'octo',
      'app'
    )
    expect(status).toBe('ok')
    expect(prs).toEqual([
      { number: 4, title: 'WIP', url: 'https://github.com/octo/app/pull/4', state: 'open', draft: true, repo: 'octo/app', otherRepo: false },
      { number: 2, title: 'Fix it', url: 'https://github.com/octo/app/pull/2', state: 'merged', draft: false, repo: 'octo/app', otherRepo: false },
      { number: 3, title: 'Fix it', url: 'https://github.com/octo/app/pull/3', state: 'closed', draft: false, repo: 'octo/app', otherRepo: false }
    ])
  })

  it('a closed, unmerged PR is "closed", not "merged"', () => {
    const { prs } = parseClosingPrs(response([pr({ state: 'CLOSED', merged: false })]), 'octo', 'app')
    expect(prs[0].state).toBe('closed')
  })

  it('flags a PR from another repository and keeps same numbers from two repos apart', () => {
    const { prs } = parseClosingPrs(
      response([
        pr({ number: 7, url: 'https://github.com/octo/app/pull/7' }),
        pr({ number: 7, url: 'https://github.com/other/lib/pull/7', repository: { nameWithOwner: 'other/lib' } })
      ]),
      'Octo', // owner/name compare case-insensitively, as GitHub does
      'App'
    )
    expect(prs.map((p) => [p.repo, p.number, p.otherRepo])).toEqual([
      ['octo/app', 7, false],
      ['other/lib', 7, true]
    ])
  })

  it('skips null and malformed nodes, and duplicate URLs', () => {
    const { prs, status } = parseClosingPrs(
      response([null, pr({}), { title: 'no number' }, pr({}), 'junk']),
      'octo',
      'app'
    )
    expect(status).toBe('ok')
    expect(prs).toHaveLength(1)
  })

  it('an insufficient-scope error degrades to unavailable, never a throw', () => {
    const scopeError = {
      data: { repository: null },
      errors: [
        {
          type: 'INSUFFICIENT_SCOPES',
          path: ['repository'],
          message: "Your token has not been granted the required scopes to execute this query."
        }
      ]
    }
    expect(parseClosingPrs(scopeError, 'octo', 'app')).toEqual({ prs: [], status: 'unavailable' })
  })

  it('other error shapes also degrade to unavailable', () => {
    const notFound = { data: { repository: { issue: null } }, errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }] }
    for (const body of [notFound, { message: 'Bad credentials' }, { errors: [{ message: 'boom' }] }, null, 'x', response(null)]) {
      expect(parseClosingPrs(body, 'octo', 'app')).toEqual({ prs: [], status: 'unavailable' })
    }
  })

  it('trusts partial data that came back alongside an unrelated error', () => {
    const partial = { ...(response([pr({})]) as object), errors: [{ message: 'something else' }] }
    expect(parseClosingPrs(partial, 'octo', 'app').prs).toHaveLength(1)
  })
})
