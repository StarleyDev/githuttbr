import { summariseChecks } from './ciSummary'
import { splitUnifiedDiff } from './forgejo'
import {
  bitbucketServerEndpoints,
  bitbucketServerPullRequestUrl,
  type BitbucketServerRepo
} from '../shared/bitbucketServer'
import type {
  CiJob,
  CiState,
  CiStatus,
  ConnectedAccount,
  CreatePrOpts,
  CreatePrResult,
  PrCheck,
  PrComment,
  PrDetail,
  PrFile,
  PrMergeMethod,
  PrReview,
  PrReviewComment,
  PrReviewEvent,
  PrReviewThread,
  PullRequest
} from '../shared/types'

/**
 * Bitbucket Data Center's REST API, on the server's own base. Every function
 * takes the repository (which carries its base) and a token explicitly: the
 * caller has already checked that the token is the one filed for that base
 * (settings.profileAuth → bitbucketAuthFor).
 *
 * Endpoints, from the Bitbucket Data Center REST reference
 * (developer.atlassian.com/server/bitbucket/rest/, OpenAPI 10.2):
 *   GET  /rest/api/latest/projects/{key}/repos/{slug}/pull-requests            getPage
 *   POST /rest/api/latest/projects/{key}/repos/{slug}/pull-requests            create
 *   GET  …/pull-requests/{id}                                                  get
 *   GET  …/pull-requests/{id}/activities                                       getActivities
 *   GET  …/pull-requests/{id}/changes                                          streamChanges
 *   GET  …/pull-requests/{id}.diff                                             raw diff (text/plain)
 *   POST …/pull-requests/{id}/comments                                         createComment
 *   PUT  …/pull-requests/{id}/participants/{userSlug}                          updateStatus
 *   POST …/pull-requests/{id}/approve                                          approve (deprecated, fallback)
 *   GET  …/pull-requests/{id}/merge                                            canMerge
 *   POST …/pull-requests/{id}/merge?version=N                                  merge
 *   GET  /rest/api/latest/projects/{key}/repos/{slug}/settings/pull-requests   merge strategies
 *   GET  /rest/api/latest/application-properties  (+ X-AUSERNAME header)       who the token is
 *   GET  /rest/api/latest/users?filter=…                                       getUsers (name → slug)
 *   POST /rest/build-status/latest/commits/stats                               build stats, many commits
 *   GET  /rest/build-status/latest/commits/{sha}                               build statuses of a commit
 * Auth: `Authorization: Bearer <HTTP access token>` (Atlassian, "HTTP access tokens").
 */

/** A failed Data Center request, with its status so a caller can degrade quietly. */
export class BitbucketServerError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message ? `Bitbucket Data Center: ${message}` : `Bitbucket Data Center API error (${status})`)
    this.status = status
  }
}

/** A list page, as every paged Data Center resource returns it. */
export interface BbsPage<T> {
  values: T[]
  isLastPage?: boolean
  nextPageStart?: number | null
  start?: number
  size?: number
  limit?: number
}

async function bbsResponse(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    // A redirect would carry the request somewhere the token was not saved for.
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string>)
    }
  })
  if (!res.ok) {
    // Errors come as `{ errors: [{ message }] }`.
    const d = (await res.json().catch(() => null)) as { errors?: Array<{ message?: unknown }> } | null
    const msg = (d?.errors ?? [])
      .map((e) => (typeof e?.message === 'string' ? e.message.trim() : ''))
      .filter(Boolean)
      .join('; ')
    throw new BitbucketServerError(res.status, msg)
  }
  return res
}

export async function bbsJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const text = await (await bbsResponse(url, token, init)).text()
  return (text ? JSON.parse(text) : undefined) as T
}

/**
 * Walk a paged resource: `start` is the cursor the previous page's
 * `nextPageStart` names, and `isLastPage` ends it. Capped, so a runaway list
 * (or a server that never says "last") cannot spin.
 */
export async function bbsPages<T>(url: string, token: string, limit = 50, maxPages = 20): Promise<T[]> {
  const out: T[] = []
  let start = 0
  for (let page = 0; page < maxPages; page++) {
    const sep = url.includes('?') ? '&' : '?'
    const data = await bbsJson<BbsPage<T>>(`${url}${sep}start=${start}&limit=${limit}`, token)
    out.push(...(data?.values ?? []))
    if (!data || data.isLastPage !== false || typeof data.nextPageStart !== 'number' || data.nextPageStart <= start) break
    start = data.nextPageStart
  }
  return out
}

const enc = encodeURIComponent

/** The REST root of one repository. */
export function bbsRepoApi(r: BitbucketServerRepo): string {
  return `${bitbucketServerEndpoints(r.base).apiBase}/projects/${enc(r.projectKey)}/repos/${enc(r.repoSlug)}`
}

// ─── Shapes we read ─────────────────────────────────────────────────────────

interface BbsUser {
  name?: string
  slug?: string
  displayName?: string
  emailAddress?: string
}

interface BbsRef {
  id?: string
  displayId?: string
  latestCommit?: string
  repository?: { slug?: string; project?: { key?: string } }
}

interface BbsParticipant {
  user?: BbsUser
  role?: 'AUTHOR' | 'REVIEWER' | 'PARTICIPANT'
  approved?: boolean
  status?: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED'
}

export interface BbsPull {
  id: number
  version?: number
  title: string
  description?: string
  state?: 'OPEN' | 'MERGED' | 'DECLINED'
  open?: boolean
  draft?: boolean
  createdDate?: number
  updatedDate?: number
  closedDate?: number
  author?: BbsParticipant
  fromRef?: BbsRef
  toRef?: BbsRef
  reviewers?: BbsParticipant[]
  participants?: BbsParticipant[]
  links?: { self?: Array<{ href?: string }> }
}

interface BbsComment {
  id: number
  text?: string
  author?: BbsUser
  createdDate?: number
  comments?: BbsComment[]
}

interface BbsActivity {
  id: number
  action: string
  createdDate?: number
  user?: BbsUser
  commentAction?: string
  comment?: BbsComment
  commentAnchor?: { path?: string; line?: number; srcPath?: string }
}

interface BbsMergeability {
  /** Not in the 10.2 schema, but in every documented example and older references. */
  canMerge?: boolean
  conflicted?: boolean
  outcome?: 'CLEAN' | 'CONFLICTED' | 'UNKNOWN'
  vetoes?: Array<{ summaryMessage?: string; detailedMessage?: string }>
}

interface BbsBuildStatus {
  key?: string
  name?: string
  state?: 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS' | 'CANCELLED' | 'UNKNOWN'
  url?: string
}

interface BbsBuildStats {
  successful?: number
  failed?: number
  inProgress?: number
  cancelled?: number
  unknown?: number
}

// ─── Pure mapping (tested) ──────────────────────────────────────────────────

const iso = (ms: number | undefined): string | undefined => (typeof ms === 'number' ? new Date(ms).toISOString() : undefined)
const who = (u: BbsUser | undefined): string => u?.name || u?.slug || u?.displayName || 'unknown'

/** The repository a ref lives in, `KEY/slug`. */
const refRepo = (r: BbsRef | undefined): string | undefined =>
  r?.repository?.slug && r.repository.project?.key ? `${r.repository.project.key}/${r.repository.slug}` : undefined

/** Reviewers who have not answered yet — `UNAPPROVED` is "no verdict", not "rejected". */
function pendingReviewers(pr: BbsPull): BbsParticipant[] {
  return (pr.reviewers ?? []).filter((r) => (r.status ?? (r.approved ? 'APPROVED' : 'UNAPPROVED')) === 'UNAPPROVED')
}

export function mapBbsPull(pr: BbsPull, repo: BitbucketServerRepo): PullRequest {
  const head = refRepo(pr.fromRef)
  const base = refRepo(pr.toRef)
  return {
    id: pr.id,
    title: pr.title,
    author: who(pr.author?.user),
    sourceBranch: pr.fromRef?.displayId ?? '',
    targetBranch: pr.toRef?.displayId ?? '',
    url: pr.links?.self?.[0]?.href ?? bitbucketServerPullRequestUrl(repo, pr.id),
    isDraft: !!pr.draft,
    state: pr.state === 'MERGED' ? 'merged' : pr.state === 'DECLINED' ? 'closed' : 'open',
    ...(pr.fromRef?.latestCommit ? { headSha: pr.fromRef.latestCommit } : {}),
    ...(head && head !== base ? { headRepo: head } : {}),
    requestedReviewers: pendingReviewers(pr).map((r) => who(r.user))
  }
}

/** A Data Center build state, in the app's terms. */
export function bbsCiState(state: BbsBuildStatus['state']): CiState {
  if (state === 'SUCCESSFUL') return 'success'
  if (state === 'FAILED') return 'failure'
  if (state === 'INPROGRESS') return 'pending'
  return 'neutral' // CANCELLED, UNKNOWN
}

/** The same build as a PR check row (GitHub's status/conclusion vocabulary). */
export function bbsBuildToCheck(b: BbsBuildStatus): PrCheck {
  const conclusion =
    b.state === 'SUCCESSFUL' ? 'success' : b.state === 'FAILED' ? 'failure' : b.state === 'CANCELLED' ? 'cancelled' : b.state === 'INPROGRESS' ? null : 'neutral'
  return {
    name: b.name || b.key || 'build',
    status: b.state === 'INPROGRESS' ? 'in_progress' : 'completed',
    conclusion,
    url: b.url ?? ''
  }
}

/** One commit's builds rolled up the way the graph shows GitHub's checks. */
export function bbsCiStatus(builds: BbsBuildStatus[]): CiStatus | null {
  if (!builds.length) return null
  const jobs: CiJob[] = builds.map((b) => ({ name: b.name || b.key || 'build', state: bbsCiState(b.state), ...(b.url ? { url: b.url } : {}) }))
  const state: CiState = jobs.some((j) => j.state === 'failure')
    ? 'failure'
    : jobs.some((j) => j.state === 'pending')
      ? 'pending'
      : jobs.every((j) => j.state === 'neutral')
        ? 'neutral'
        : 'success'
  return { state, jobs }
}

/** Whether a stats entry says the commit has any build at all. */
const hasBuilds = (s: BbsBuildStats | undefined): boolean =>
  !!s && (s.successful ?? 0) + (s.failed ?? 0) + (s.inProgress ?? 0) + (s.cancelled ?? 0) + (s.unknown ?? 0) > 0

/** A comment and its replies, oldest first, flattened. */
function flatten(c: BbsComment): BbsComment[] {
  return [c, ...(c.comments ?? []).flatMap(flatten)]
}

const toComment = (c: BbsComment): PrReviewComment => ({
  id: c.id,
  author: who(c.author),
  body: c.text ?? '',
  createdAt: iso(c.createdDate) ?? ''
})

/** Activities → the conversation, the line threads and the review verdicts. */
export function mapBbsActivities(activities: BbsActivity[]): { comments: PrComment[]; reviewThreads: PrReviewThread[] } {
  const comments: PrComment[] = []
  const reviewThreads: PrReviewThread[] = []
  // Newest first from the server; the page reads oldest first.
  const ordered = [...activities].sort((a, b) => (a.createdDate ?? 0) - (b.createdDate ?? 0))
  for (const a of ordered) {
    if (a.action !== 'COMMENTED' || !a.comment || (a.commentAction && a.commentAction !== 'ADDED')) continue
    const all = flatten(a.comment)
    if (a.commentAnchor?.path) {
      reviewThreads.push({
        path: a.commentAnchor.path,
        line: typeof a.commentAnchor.line === 'number' ? a.commentAnchor.line : null,
        diffHunk: '',
        rootId: a.comment.id,
        comments: all.map(toComment)
      })
    } else {
      for (const c of all) comments.push({ author: who(c.author), body: c.text ?? '', createdAt: iso(c.createdDate) ?? '' })
    }
  }
  return { comments, reviewThreads }
}

export function mapBbsReviews(pr: BbsPull): PrReview[] {
  const out: PrReview[] = []
  for (const r of [...(pr.reviewers ?? []), ...(pr.participants ?? [])]) {
    const status = r.status ?? (r.approved ? 'APPROVED' : 'UNAPPROVED')
    if (status === 'APPROVED') out.push({ author: who(r.user), state: 'APPROVED' })
    else if (status === 'NEEDS_WORK') out.push({ author: who(r.user), state: 'CHANGES_REQUESTED' })
  }
  return out
}

const isConflicted = (m: BbsMergeability): boolean => !!m.conflicted || m.outcome === 'CONFLICTED'

/**
 * Whether the branches merge cleanly — the `mergeable` the PR page reads as
 * "has conflicts" when false. Only a real conflict says false: a merge-check
 * veto is not a conflict, and travels as `bbsMergeBlockers` instead. Unknown
 * (null) when the server could not say.
 */
export function bbsCanMerge(m: BbsMergeability | null | undefined): boolean | null {
  if (!m) return null
  if (isConflicted(m)) return false
  if (m.outcome === 'UNKNOWN') return null
  return typeof m.canMerge === 'boolean' || m.outcome === 'CLEAN' ? true : null
}

/** The merge checks that veto the merge, in the server's own words. */
export function bbsMergeBlockers(m: BbsMergeability | null | undefined): string[] {
  return (m?.vetoes ?? []).map((v) => [v.summaryMessage, v.detailedMessage].filter(Boolean).join(' — ')).filter(Boolean)
}

/** Why the server refuses to merge, in its own words (merge checks speak for themselves). */
export function bbsMergeRefusal(m: BbsMergeability): string | null {
  const reasons = bbsMergeBlockers(m)
  if (isConflicted(m)) reasons.unshift('the pull request has conflicts that must be resolved first')
  if (reasons.length) return reasons.join('; ')
  return m.canMerge === false ? 'the server does not allow this merge yet' : null
}

/**
 * The server's merge strategy for the app's merge method, among the ones the
 * repository enables: plain merge → `no-ff` (else `ff`), squash → `squash`
 * (else `squash-ff-only`), rebase → `rebase-no-ff` (else `rebase-ff-only`).
 * Undefined when the settings are unknown — the server then uses its default.
 */
export function bbsStrategyFor(method: PrMergeMethod, enabled: string[] | null): string | undefined | null {
  const wanted: Record<PrMergeMethod, string[]> = {
    merge: ['no-ff', 'ff'],
    squash: ['squash', 'squash-ff-only'],
    rebase: ['rebase-no-ff', 'rebase-ff-only']
  }
  if (!enabled) return method === 'merge' ? undefined : wanted[method][0]
  // null: the repository allows none of this family.
  return wanted[method].find((id) => enabled.includes(id)) ?? null
}

const PR_STATUS: Record<'APPROVE' | 'REQUEST_CHANGES', 'APPROVED' | 'NEEDS_WORK'> = {
  APPROVE: 'APPROVED',
  REQUEST_CHANGES: 'NEEDS_WORK'
}

// ─── Calls ──────────────────────────────────────────────────────────────────

export async function listBbsPulls(repo: BitbucketServerRepo, token: string): Promise<PullRequest[]> {
  const pulls = await bbsPages<BbsPull>(`${bbsRepoApi(repo)}/pull-requests?state=OPEN&order=NEWEST`, token, 50, 4)
  const prs = pulls.map((p) => mapBbsPull(p, repo))
  // The checks on each head, the way the GitHub list carries them.
  const ci = await bbsCiStatuses(repo, token, prs.map((p) => p.headSha).filter((s): s is string => !!s)).catch(
    () => ({}) as Record<string, CiStatus>
  )
  for (const pr of prs) {
    const status = pr.headSha ? ci[pr.headSha] : undefined
    if (!status) continue
    pr.ci = status.state
    pr.ciSummary = summariseChecks(status)
  }
  return prs
}

async function mergeability(repo: BitbucketServerRepo, token: string, id: number): Promise<BbsMergeability | null> {
  return bbsJson<BbsMergeability>(`${bbsRepoApi(repo)}/pull-requests/${id}/merge`, token).catch(() => null)
}

export async function bbsPullDetail(repo: BitbucketServerRepo, token: string, id: number): Promise<PrDetail> {
  const r = bbsRepoApi(repo)
  const pr = await bbsJson<BbsPull>(`${r}/pull-requests/${id}`, token)
  const open = pr.state === 'OPEN' || (pr.state === undefined && pr.open !== false)
  const [activities, merge] = await Promise.all([
    bbsPages<BbsActivity>(`${r}/pull-requests/${id}/activities`, token, 100, 5).catch(() => [] as BbsActivity[]),
    open ? mergeability(repo, token, id) : Promise.resolve(null)
  ])
  const { comments, reviewThreads } = mapBbsActivities(activities)
  const head = refRepo(pr.fromRef)
  const base = refRepo(pr.toRef)
  const merged = pr.state === 'MERGED'
  const mergedBy = merged ? activities.find((a) => a.action === 'MERGED')?.user : undefined
  return {
    number: pr.id,
    title: pr.title,
    body: pr.description ?? '',
    author: who(pr.author?.user),
    source: pr.fromRef?.displayId ?? '',
    target: pr.toRef?.displayId ?? '',
    draft: !!pr.draft,
    state: open ? 'open' : 'closed',
    merged,
    mergeable: open ? bbsCanMerge(merge) : null,
    ...(open && bbsMergeBlockers(merge).length ? { mergeBlockers: bbsMergeBlockers(merge) } : {}),
    url: pr.links?.self?.[0]?.href ?? bitbucketServerPullRequestUrl(repo, pr.id),
    comments,
    reviews: mapBbsReviews(pr),
    reviewThreads,
    createdAt: iso(pr.createdDate),
    updatedAt: iso(pr.updatedDate),
    closedAt: open ? null : (iso(pr.closedDate) ?? null),
    mergedAt: merged ? (iso(pr.closedDate) ?? null) : null,
    mergedBy: mergedBy ? who(mergedBy) : null,
    requestedReviewers: pendingReviewers(pr).map((p) => ({ login: who(p.user) })),
    sourceRepo: head && base && head !== base ? head : null
  }
}

interface BbsChange {
  type?: 'ADD' | 'COPY' | 'DELETE' | 'MODIFY' | 'MOVE' | 'UNKNOWN'
  path?: { toString?: string; components?: string[] }
  srcPath?: { toString?: string; components?: string[] }
}

const pathOf = (p: BbsChange['path']): string => (p?.components?.length ? p.components.join('/') : typeof p?.toString === 'string' ? p.toString : '')

/** `/changes` is the authoritative file list; the raw `.diff` supplies each file's hunks. */
export function mergeBbsChanges(changes: BbsChange[], diffFiles: PrFile[]): PrFile[] {
  if (!changes.length) return diffFiles
  const byName = new Map(diffFiles.map((f) => [f.filename, f]))
  return changes.map((c) => {
    const filename = pathOf(c.path)
    const status = c.type === 'ADD' ? 'added' : c.type === 'DELETE' ? 'removed' : c.type === 'MOVE' ? 'renamed' : 'modified'
    const d = byName.get(filename)
    const previous = c.type === 'MOVE' ? pathOf(c.srcPath) : ''
    return {
      filename,
      status,
      additions: d?.additions ?? 0,
      deletions: d?.deletions ?? 0,
      ...(d?.patch ? { patch: d.patch } : {}),
      ...(previous ? { previousFilename: previous } : {})
    }
  })
}

export async function bbsPullFiles(repo: BitbucketServerRepo, token: string, id: number): Promise<PrFile[]> {
  const r = bbsRepoApi(repo)
  const [changes, raw] = await Promise.all([
    bbsPages<BbsChange>(`${r}/pull-requests/${id}/changes`, token, 500, 10).catch(() => [] as BbsChange[]),
    bbsResponse(`${r}/pull-requests/${id}.diff`, token, { headers: { Accept: 'text/plain' } })
      .then((res) => res.text())
      .catch(() => '')
  ])
  return mergeBbsChanges(changes, raw ? splitUnifiedDiff(raw) : [])
}

/** Build statuses of a commit, newest first. Empty when the server has no build-status resource. */
async function commitBuilds(repo: BitbucketServerRepo, token: string, sha: string): Promise<BbsBuildStatus[]> {
  const url = `${bitbucketServerEndpoints(repo.base).buildStatusBase}/commits/${enc(sha)}`
  return bbsPages<BbsBuildStatus>(url, token, 100, 2)
}

export async function bbsPullChecks(repo: BitbucketServerRepo, token: string, id: number): Promise<PrCheck[]> {
  const pr = await bbsJson<BbsPull>(`${bbsRepoApi(repo)}/pull-requests/${id}`, token)
  const sha = pr.fromRef?.latestCommit
  if (!sha) return []
  return (await commitBuilds(repo, token, sha).catch(() => [])).map(bbsBuildToCheck)
}

/** Commits per `stats` request — a graph page's worth. */
const STATS_BATCH = 40

/**
 * Build status for many commits: one `stats` request per 40 commits says which
 * have builds at all, then only those are read in full — a graph page of 40
 * commits with three builds costs four requests, not forty. The PR list (up to
 * 200 heads) takes several stats requests, so every row gets its CI.
 */
export async function bbsCiStatuses(repo: BitbucketServerRepo, token: string, shas: string[]): Promise<Record<string, CiStatus>> {
  // Capped at the PR list's own ceiling (4 pages of 50), so no caller can fan out unbounded.
  const wanted = [...new Set(shas)].slice(0, 200)
  if (!wanted.length) return {}
  const withBuilds: string[] = []
  for (let i = 0; i < wanted.length; i += STATS_BATCH) {
    const batch = wanted.slice(i, i + STATS_BATCH)
    const stats = await bbsJson<Record<string, BbsBuildStats>>(
      `${bitbucketServerEndpoints(repo.base).buildStatusBase}/commits/stats`,
      token,
      { method: 'POST', body: JSON.stringify(batch) }
    )
    withBuilds.push(...batch.filter((sha) => hasBuilds(stats?.[sha])))
  }
  const out: Record<string, CiStatus> = {}
  const queue = [...withBuilds]
  const work = async (): Promise<void> => {
    while (queue.length) {
      const sha = queue.shift()!
      const status = bbsCiStatus(await commitBuilds(repo, token, sha).catch(() => []))
      if (status) out[sha] = status
    }
  }
  await Promise.all(Array.from({ length: 4 }, work))
  return out
}

export async function bbsComment(repo: BitbucketServerRepo, token: string, id: number, text: string, parentId?: number): Promise<void> {
  await bbsJson(`${bbsRepoApi(repo)}/pull-requests/${id}/comments`, token, {
    method: 'POST',
    body: JSON.stringify(parentId !== undefined ? { text, parent: { id: parentId } } : { text })
  })
}

/**
 * Who a token signs in as. The REST API has no "current user" resource; every
 * response names the authenticated user in its `X-AUSERNAME` header, so the
 * cheapest resource is asked and the header read (the approach Atlassian's own
 * engineers recommend on the developer community). Null when the server does
 * not say — an anonymous answer.
 */
export async function bbsWhoAmI(base: string, token: string): Promise<{ name: string; slug?: string; displayName?: string } | null> {
  const api = bitbucketServerEndpoints(base).apiBase
  const res = await bbsResponse(`${api}/application-properties`, token)
  const name = res.headers.get('x-ausername')?.trim()
  if (!name) return null
  const user = await bbsUserByName(api, name, token)
  return { name, ...(user?.slug ? { slug: user.slug } : {}), ...(user?.displayName ? { displayName: user.displayName } : {}) }
}

/**
 * The user record for a user *name*. `/users/{userSlug}` takes a slug, which
 * "may not be the user's username, always use the user.slug property" (REST
 * reference, GET /users/{userSlug}) — an email-style name `jdoe@corp.com` has
 * the slug `jdoe_corp.com`. So the name is looked up through `GET /users?filter=`
 * (users whose name, display name or email *contain* it) and matched exactly.
 */
async function bbsUserByName(api: string, name: string, token: string): Promise<BbsUser | null> {
  const users = await bbsPages<BbsUser>(`${api}/users?filter=${enc(name)}`, token, 25, 2).catch(() => [] as BbsUser[])
  // User names compare case-insensitively on the server; an exact match wins.
  return users.find((u) => u.name === name) ?? users.find((u) => u.name?.toLowerCase() === name.toLowerCase()) ?? null
}

/** Settings → Integrations: the account behind a server's token. */
export async function describeBbsAccount(base: string, token: string): Promise<ConnectedAccount> {
  const me = await bbsWhoAmI(base, token)
  if (!me) throw new BitbucketServerError(401, 'the server did not recognise this token — check that it is valid and not expired')
  const web = bitbucketServerEndpoints(base).webBase
  return {
    login: me.name,
    ...(me.displayName && me.displayName !== me.name ? { name: me.displayName } : {}),
    // No slug, no link: a page built from the user name would 404 for an email-style one.
    ...(me.slug ? { profileUrl: `${web}/users/${enc(me.slug)}` } : {})
  }
}

/**
 * The slug of the token's user for `participants/{userSlug}`: from the user
 * search, else from the pull request's own reviewers and participants (who
 * carry both name and slug), else the name itself — equal to the slug for
 * every plain user name.
 */
async function reviewerSlug(repo: BitbucketServerRepo, token: string, id: number, me: { name: string; slug?: string }): Promise<string> {
  if (me.slug) return me.slug
  const pr = await bbsJson<BbsPull>(`${bbsRepoApi(repo)}/pull-requests/${id}`, token).catch(() => null)
  const people = [...(pr?.reviewers ?? []), ...(pr?.participants ?? [])].map((p) => p.user)
  const match = people.find((u) => u?.name === me.name) ?? people.find((u) => u?.name?.toLowerCase() === me.name.toLowerCase())
  return match?.slug || me.name
}

export async function bbsReview(
  repo: BitbucketServerRepo,
  token: string,
  id: number,
  event: PrReviewEvent,
  body: string
): Promise<void> {
  if (event === 'COMMENT') {
    if (!body.trim()) throw new BitbucketServerError(400, 'a comment needs some text')
    await bbsComment(repo, token, id, body)
    return
  }
  // The verdict first, the comment after: a status that fails leaves nothing
  // behind, so a retry cannot post the same comment twice.
  const status = PR_STATUS[event]
  const me = await bbsWhoAmI(repo.base, token).catch(() => null)
  if (me) {
    const slug = await reviewerSlug(repo, token, id, me)
    await bbsJson(`${bbsRepoApi(repo)}/pull-requests/${id}/participants/${enc(slug)}`, token, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
  } else {
    // No user to name: the older, deprecated resource approves as the caller.
    if (status !== 'APPROVED') throw new BitbucketServerError(400, 'the server did not say who this token is, so changes cannot be requested')
    await bbsJson(`${bbsRepoApi(repo)}/pull-requests/${id}/approve`, token, { method: 'POST' })
  }
  if (body.trim()) await bbsComment(repo, token, id, body)
}

export async function bbsMerge(repo: BitbucketServerRepo, token: string, id: number, method: PrMergeMethod): Promise<void> {
  const r = bbsRepoApi(repo)
  const pr = await bbsJson<BbsPull>(`${r}/pull-requests/${id}`, token)
  // The merge checks first: a veto is the server's answer, in its words.
  const check = await mergeability(repo, token, id)
  if (check) {
    const refusal = bbsMergeRefusal(check)
    if (refusal) throw new BitbucketServerError(409, `cannot merge — ${refusal}`)
  }
  const settings = await bbsJson<{ mergeConfig?: { strategies?: Array<{ id?: string; enabled?: boolean }> } }>(
    `${r}/settings/pull-requests`,
    token
  ).catch(() => null)
  const strategies = settings?.mergeConfig?.strategies
  const enabled = strategies ? strategies.filter((s) => s.enabled && s.id).map((s) => s.id!) : null
  const strategyId = bbsStrategyFor(method, enabled)
  if (strategyId === null) throw new BitbucketServerError(400, `this repository does not allow ${method} merges`)
  await bbsJson(`${r}/pull-requests/${id}/merge?version=${pr.version ?? 0}`, token, {
    method: 'POST',
    body: JSON.stringify({ version: pr.version ?? 0, ...(strategyId ? { strategyId } : {}) })
  })
}

export async function createBbsPull(repo: BitbucketServerRepo, token: string, opts: CreatePrOpts): Promise<CreatePrResult> {
  const ref = (branch: string): Record<string, unknown> => ({
    id: `refs/heads/${branch}`,
    repository: { slug: repo.repoSlug, project: { key: repo.projectKey } }
  })
  const pr = await bbsJson<BbsPull>(`${bbsRepoApi(repo)}/pull-requests`, token, {
    method: 'POST',
    body: JSON.stringify({
      title: opts.title,
      description: opts.body,
      fromRef: ref(opts.source),
      toRef: ref(opts.target),
      // Drafts arrived in 8.18; an older server is only told about one when asked for.
      ...(opts.draft ? { draft: true } : {})
    })
  })
  return { url: pr.links?.self?.[0]?.href ?? bitbucketServerPullRequestUrl(repo, pr.id), number: pr.id }
}
