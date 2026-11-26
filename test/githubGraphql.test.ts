import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addReviewThreadReply,
  createGithubGraphqlPost,
  createGithubGraphqlRawPost,
  findReviewThread,
  type GithubGraphqlPost
} from '../src/main/githubGraphql'

// GitHub's GraphQL client against a fake fetch: what is sent, how errors in a
// 200 and a spent rate limit come back, and how a review thread is found
// through one of its comments across pages.

const GRAPHQL = 'https://ghe.example.corp/api/graphql'

const answerWith = (status: number, body: unknown, headers: Record<string, string> = {}): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } }))
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('GitHub GraphQL posters', () => {
  it('posts the query and variables with the token, to the endpoint it was given (GHES /api/graphql)', async () => {
    answerWith(200, { data: { viewer: { login: 'ana' } } })
    const post = createGithubGraphqlPost(GRAPHQL, 'tok')
    expect(await post<{ viewer: { login: string } }>('query{ viewer{ login } }', { a: 1 })).toEqual({ viewer: { login: 'ana' } })
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe(GRAPHQL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(String(init.body))).toEqual({ query: 'query{ viewer{ login } }', variables: { a: 1 } })
  })

  it('the strict poster fails on any error in a 200; the raw one hands back data and errors together', async () => {
    const body = { data: { repository: { i1: null } }, errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }] }
    answerWith(200, body)
    await expect(createGithubGraphqlPost(GRAPHQL, 'tok')('q', {})).rejects.toThrow(/^GitHub: Could not resolve/)
    answerWith(200, body)
    expect(await createGithubGraphqlRawPost(GRAPHQL, 'tok')('q', {})).toEqual({ data: body.data, errors: body.errors, exhausted: false })
  })

  it('a secondary limit said only in words, or the last request of the limit, reads as rate limited', async () => {
    answerWith(200, { errors: [{ message: 'You have exceeded a secondary rate limit. Please wait a few minutes.' }] })
    const words = await createGithubGraphqlRawPost(GRAPHQL, 'tok')('q', {})
    expect(words.errors[0].type).toBe('RATE_LIMITED')
    answerWith(200, { errors: [{ message: 'You have exceeded a secondary rate limit.' }] })
    await expect(createGithubGraphqlPost(GRAPHQL, 'tok')('q', {})).rejects.toMatchObject({ rateLimited: true })
    answerWith(200, { data: { ok: true } }, { 'x-ratelimit-remaining': '0' })
    expect((await createGithubGraphqlRawPost(GRAPHQL, 'tok')('q', {})).exhausted).toBe(true)
  })

  it('a spent rate limit is flagged, from the status or from the body', async () => {
    answerWith(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' })
    await expect(createGithubGraphqlRawPost(GRAPHQL, 'tok')('q', {})).rejects.toMatchObject({ status: 403, rateLimited: true })
    answerWith(200, { data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] })
    await expect(createGithubGraphqlPost(GRAPHQL, 'tok')('q', {})).rejects.toMatchObject({ rateLimited: true })
  })

  it('a plain refusal keeps its status, unflagged', async () => {
    answerWith(401, { message: 'Bad credentials' })
    await expect(createGithubGraphqlRawPost(GRAPHQL, 'tok')('q', {})).rejects.toMatchObject({ status: 401, rateLimited: false })
  })
})

describe('replying in a review thread', () => {
  /** Pages of threads, each `[threadId, commentIds]`. */
  const pagedThreads = (pages: Array<Array<[string, string[], boolean?]>>): { post: GithubGraphqlPost; asked: unknown[] } => {
    const asked: unknown[] = []
    const post = (async (_query: string, variables: Record<string, unknown>) => {
      asked.push(variables)
      const i = variables.after == null ? 0 : Number(String(variables.after).slice(1))
      return {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: i + 1 < pages.length, endCursor: `c${i + 1}` },
              nodes: pages[i].map(([id, comments, canReply = true]) => ({
                id,
                viewerCanReply: canReply,
                comments: { nodes: comments.map((c) => ({ id: c })) }
              }))
            }
          }
        }
      }
    }) as GithubGraphqlPost
    return { post, asked }
  }

  it('walks the pages until a thread holds the comment', async () => {
    const { post, asked } = pagedThreads([[['T1', ['C1']]], [['T2', ['C2', 'C3']]], [['T3', ['C4']]]])
    expect(await findReviewThread(post, 'team', 'app', 7, 'C3')).toEqual({ id: 'T2', viewerCanReply: true })
    expect(asked).toEqual([
      { owner: 'team', repo: 'app', number: 7, after: null },
      { owner: 'team', repo: 'app', number: 7, after: 'c1' }
    ])
  })

  it('null when no thread holds it, or the PR is not there', async () => {
    const { post } = pagedThreads([[['T1', ['C1']]]])
    expect(await findReviewThread(post, 'team', 'app', 7, 'C9')).toBeNull()
    const none = (async () => ({ repository: { pullRequest: null } })) as GithubGraphqlPost
    expect(await findReviewThread(none, 'team', 'app', 7, 'C1')).toBeNull()
  })

  it('says when GitHub will not let this account reply in the thread', async () => {
    const { post } = pagedThreads([[['T1', ['C1'], false]]])
    expect(await findReviewThread(post, 'team', 'app', 7, 'C1')).toEqual({ id: 'T1', viewerCanReply: false })
  })

  it('the reply names the thread and the text; no comment back is a failure', async () => {
    const sent: unknown[] = []
    const ok = (async (query: string, variables: Record<string, unknown>) => {
      sent.push({ query, variables })
      return { addPullRequestReviewThreadReply: { comment: { id: 'C9', state: 'SUBMITTED' } } }
    }) as GithubGraphqlPost
    expect(await addReviewThreadReply(ok, 'T2', 'Thanks!')).toEqual({ pending: false })
    expect(sent).toHaveLength(1)
    expect((sent[0] as { query: string }).query).toMatch(/addPullRequestReviewThreadReply\(input:\{pullRequestReviewThreadId:\$thread,body:\$body\}\)/)
    expect((sent[0] as { query: string }).query).toMatch(/comment\{ id state \}/)
    expect((sent[0] as { variables: unknown }).variables).toEqual({ thread: 'T2', body: 'Thanks!' })
    const empty = (async () => ({ addPullRequestReviewThreadReply: null })) as GithubGraphqlPost
    await expect(addReviewThreadReply(empty, 'T2', 'Thanks!')).rejects.toThrow(/did not create/)
  })

  it('a reply GitHub filed under the viewer’s pending review comes back pending', async () => {
    const pendingPost = (async () => ({ addPullRequestReviewThreadReply: { comment: { id: 'C9', state: 'PENDING' } } })) as GithubGraphqlPost
    expect(await addReviewThreadReply(pendingPost, 'T2', 'Thanks!')).toEqual({ pending: true })
  })
})
