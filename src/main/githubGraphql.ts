import { HttpStatusError } from './httpStatusError'
import type { PrListComment, PrListReview } from '../shared/types'

/**
 * GitHub's GraphQL API, for the few things REST cannot do: reply in a review
 * thread whose first comment is gone, and read many references in one request.
 * The endpoint comes from shared/githubEnterprise.ts (`/api/graphql` on GHES).
 */

/** One error GraphQL reported beside (or instead of) the data. */
export interface GithubGraphqlError {
  message?: unknown
  /** `NOT_FOUND`, `RATE_LIMITED`, `INSUFFICIENT_SCOPES`, … */
  type?: unknown
  path?: unknown
}

/** A whole GraphQL answer: what came back, and what went wrong on the way. */
export interface GithubGraphqlAnswer<T> {
  data: T | null
  errors: GithubGraphqlError[]
  /** The answer spent the last of the rate limit (`x-ratelimit-remaining: 0`): ask nothing more. */
  exhausted: boolean
}

/** One GraphQL request, answered in full — partial data and errors side by side. */
export type GithubGraphqlRawPost = <T>(query: string, variables: Record<string, unknown>) => Promise<GithubGraphqlAnswer<T>>

/** One GraphQL request: the query and its variables in, the `data` out. */
export type GithubGraphqlPost = <T>(query: string, variables: Record<string, unknown>) => Promise<T>

/**
 * A raw poster bound to one endpoint and token. Only the HTTP layer throws: a
 * refusal keeps its status, and a spent rate limit its `rateLimited`, as
 * ghError does for REST. Errors in the body come back with the data.
 */
export function createGithubGraphqlRawPost(graphqlUrl: string, token: string): GithubGraphqlRawPost {
  return async <T>(query: string, variables: Record<string, unknown>): Promise<GithubGraphqlAnswer<T>> => {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
    if (!res.ok) {
      const throttled =
        (res.status === 403 || res.status === 429) &&
        (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after'))
      throw new HttpStatusError(`GitHub GraphQL error (${res.status})`, res.status, throttled)
    }
    const json = (await res.json().catch(() => null)) as { data?: unknown; errors?: unknown } | null
    const errors = Array.isArray(json?.errors) ? (json.errors as GithubGraphqlError[]) : []
    return {
      data: (json?.data ?? null) as T | null,
      // A secondary limit can come back as a 200 whose error only says so in words.
      errors: errors.map((e) => (isRateLimitWords(e) ? { ...e, type: 'RATE_LIMITED' } : e)),
      exhausted: res.headers.get('x-ratelimit-remaining') === '0'
    }
  }
}

const isRateLimitWords = (e: GithubGraphqlError): boolean =>
  e.type !== 'RATE_LIMITED' && typeof e.message === 'string' && /\brate limit/i.test(e.message)

/** The first error as something to throw: a spent limit keeps `rateLimited`. */
export function githubGraphqlFailure(err: GithubGraphqlError): Error {
  const message = `GitHub: ${typeof err.message === 'string' ? err.message : 'GraphQL error'}`
  // GraphQL reports a spent limit in the body, under a 200.
  if (err.type === 'RATE_LIMITED') return new HttpStatusError(message, 403, true)
  return new Error(message)
}

/**
 * A strict poster: GraphQL answers 200 with `errors` for a bad query, a
 * missing scope or an unknown node, and any of them fails the call here, so a
 * caller never mistakes half an answer for a whole one.
 */
export function createGithubGraphqlPost(graphqlUrl: string, token: string): GithubGraphqlPost {
  const raw = createGithubGraphqlRawPost(graphqlUrl, token)
  return async <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
    const answer = await raw<T>(query, variables)
    if (answer.errors[0]) throw githubGraphqlFailure(answer.errors[0])
    if (answer.data == null) throw new Error('GitHub GraphQL: empty answer')
    return answer.data
  }
}

// ── Replying in a review thread ──────────────────────────────────────────────

/**
 * A PR's review threads with the node ids of their comments. A page of 100
 * threads × 100 comments stays far under GitHub's node limit.
 */
const REVIEW_THREADS_QUERY = `query($owner:String!,$repo:String!,$number:Int!,$after:String){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      reviewThreads(first:100,after:$after){
        pageInfo{ hasNextPage endCursor }
        nodes{ id viewerCanReply comments(first:100){ nodes{ id } } }
      }
    }
  }
}`

const REPLY_MUTATION = `mutation($thread:ID!,$body:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$thread,body:$body}){ comment{ id state } }
}`

interface ThreadsPage {
  repository?: {
    pullRequest?: {
      reviewThreads?: {
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
        nodes?: Array<{ id?: string; viewerCanReply?: boolean; comments?: { nodes?: Array<{ id?: string } | null> } } | null>
      }
    } | null
  } | null
}

/** Pages read at most: 2,000 threads is past any PR a person reviews. */
const MAX_THREAD_PAGES = 20

/** A review thread found by one of its comments. */
export interface FoundReviewThread {
  id: string
  /** GitHub lets this account reply in it (a locked conversation, a missing permission: no). */
  viewerCanReply: boolean
}

/**
 * The review thread holding a comment, by the comment's node id (REST's
 * `node_id`). No REST endpoint names threads, and no comment field points at
 * its thread: the PR's threads are listed and searched. Null when no thread
 * holds it.
 */
export async function findReviewThread(
  post: GithubGraphqlPost,
  owner: string,
  repo: string,
  number: number,
  commentNodeId: string
): Promise<FoundReviewThread | null> {
  let after: string | null = null
  for (let page = 0; page < MAX_THREAD_PAGES; page++) {
    const data: ThreadsPage = await post<ThreadsPage>(REVIEW_THREADS_QUERY, { owner, repo, number, after })
    const conn = data.repository?.pullRequest?.reviewThreads
    if (!conn) return null
    for (const th of conn.nodes ?? []) {
      if (th?.id && th.comments?.nodes?.some((c) => c?.id === commentNodeId)) return { id: th.id, viewerCanReply: th.viewerCanReply === true }
    }
    if (!conn.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) return null
    after = conn.pageInfo.endCursor
  }
  return null
}

/**
 * Post a reply in a review thread, by the thread's node id. With no review
 * named, GitHub may file the reply under the viewer's pending review, where
 * nobody else sees it until that review is submitted: `pending` says so.
 */
export async function addReviewThreadReply(
  post: GithubGraphqlPost,
  threadId: string,
  body: string
): Promise<{ pending: boolean }> {
  const data = await post<{ addPullRequestReviewThreadReply?: { comment?: { id?: string; state?: string } | null } | null }>(
    REPLY_MUTATION,
    { thread: threadId, body }
  )
  const comment = data.addPullRequestReviewThreadReply?.comment
  if (!comment?.id) throw new Error('GitHub did not create the reply.')
  return { pending: comment.state === 'PENDING' }
}

// ── Which review threads are resolved ────────────────────────────────────────

/** REST has no resolved flag: each thread's state, keyed by its first comment's REST id. */
const THREAD_RESOLUTION_QUERY = `query($owner:String!,$repo:String!,$number:Int!,$after:String){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      reviewThreads(first:100,after:$after){
        pageInfo{ hasNextPage endCursor }
        nodes{ isResolved comments(first:1){ nodes{ databaseId } } }
      }
    }
  }
}`

interface ResolutionPage {
  repository?: {
    pullRequest?: {
      reviewThreads?: {
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
        nodes?: Array<{ isResolved?: boolean; comments?: { nodes?: Array<{ databaseId?: number | null } | null> } } | null>
      }
    } | null
  } | null
}

/**
 * Whether each review thread of a pull request is resolved, by the REST id of
 * its first comment — the id the REST read keys its threads on. A thread whose
 * first comment was deleted is keyed by the first one left, so the caller looks
 * up both. A thread missing from the answer stays unknown to the caller.
 */
export async function getReviewThreadResolution(
  post: GithubGraphqlPost,
  owner: string,
  repo: string,
  number: number
): Promise<Map<number, boolean>> {
  const out = new Map<number, boolean>()
  let after: string | null = null
  for (let page = 0; page < MAX_THREAD_PAGES; page++) {
    const data: ResolutionPage = await post<ResolutionPage>(THREAD_RESOLUTION_QUERY, { owner, repo, number, after })
    const conn = data.repository?.pullRequest?.reviewThreads
    if (!conn) break
    for (const th of conn.nodes ?? []) {
      const first = th?.comments?.nodes?.[0]?.databaseId
      if (typeof first === 'number' && typeof th?.isResolved === 'boolean') out.set(first, th.isResolved)
    }
    if (!conn.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) break
    after = conn.pageInfo.endCursor
  }
  return out
}

// ── What the pull request list shows beyond REST ─────────────────────────────

/** The fields a list row reads, per pull request. */
const PR_LIST_EXTRAS_FIELDS = `number additions deletions changedFiles reviewDecision
  comments(last:50){ totalCount nodes{ createdAt author{ login } } }
  latestReviews(first:20){ nodes{ state author{ login } } }`

interface PrListExtrasNode {
  number?: number
  additions?: number
  deletions?: number
  changedFiles?: number
  reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  comments?: { totalCount?: number; nodes?: Array<{ createdAt?: string; author?: { login?: string } | null } | null> }
  latestReviews?: { nodes?: Array<{ state?: string; author?: { login?: string } | null } | null> }
}

/** One row's size, conversation and reviews — what REST's list leaves out. */
export interface PrListExtras {
  additions: number
  deletions: number
  changedFiles: number
  commentCount: number
  recentComments: PrListComment[]
  reviews: PrListReview[]
  readyToMerge: boolean
}

/**
 * Size, comment count and each reviewer's verdict for many pull requests in
 * ONE request: an aliased `pullRequest(number:)` per row, so the answer covers
 * exactly the rows the REST list returned (stack members included) — never one
 * request per row. A row GitHub could not answer is simply missing.
 */
export async function getPullRequestListExtras(
  post: GithubGraphqlRawPost,
  owner: string,
  repo: string,
  numbers: readonly number[]
): Promise<Map<number, PrListExtras>> {
  const out = new Map<number, PrListExtras>()
  const wanted = [...new Set(numbers.filter((n) => Number.isInteger(n) && n > 0))]
  if (!wanted.length) return out
  const fields = wanted.map((n) => `pr${n}: pullRequest(number:${n}){ ${PR_LIST_EXTRAS_FIELDS} }`).join('\n')
  const query = `query($owner:String!,$repo:String!){ repository(owner:$owner,name:$repo){ ${fields} } }`
  const answer = await post<{ repository?: Record<string, PrListExtrasNode | null> | null }>(query, { owner, repo })
  for (const node of Object.values(answer.data?.repository ?? {})) {
    if (!node || typeof node.number !== 'number') continue
    const reviews: PrListReview[] = []
    for (const r of node.latestReviews?.nodes ?? []) {
      const login = r?.author?.login
      if (!login) continue
      if (r.state === 'APPROVED') reviews.push({ login, verdict: 'approved' })
      else if (r.state === 'CHANGES_REQUESTED') reviews.push({ login, verdict: 'changes' })
    }
    out.set(node.number, {
      additions: node.additions ?? 0,
      deletions: node.deletions ?? 0,
      changedFiles: node.changedFiles ?? 0,
      commentCount: node.comments?.totalCount ?? 0,
      recentComments: (node.comments?.nodes ?? []).flatMap((c) =>
        c?.createdAt ? [{ at: c.createdAt, author: c.author?.login ?? '' }] : []
      ),
      reviews,
      readyToMerge: node.reviewDecision === 'APPROVED'
    })
  }
  return out
}
