import { countChecks } from './ciSummary'
import { bbsReviewerIds, collectPickerOptions, createWithoutRejectedReviewers, PICKER_MAX_PAGES, reviewersMissing } from './prMeta'
import { prMetaSupport, uniqueById, withoutSelf } from '../shared/prMeta'
import { splitUnifiedDiff } from './forgejo'
import { getAnchorLine, getAnchorSide } from '../shared/prLineAnchor'
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
  PrMetaField,
  PrPickerOptions,
  PrPickerPerson,
  PrReview,
  PrReviewComment,
  PrReviewEvent,
  PrReviewThread,
  PullRequest,
  PrLineAnchor
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
 *   GET  /rest/api/latest/users?permission.1=REPO_READ&…                       getUsers (who may review)
 *   POST /rest/build-status/latest/commits/stats                               build stats, many commits
 *   GET  /rest/build-status/latest/commits/{sha}                               build statuses of a commit
 * Auth: `Authorization: Bearer <HTTP access token>` (Atlassian, "HTTP access tokens").
 */

/** A failed Data Center request, with its status so a caller can degrade quietly. */
export class BitbucketServerError extends Error {
  status: number
  /** The `exceptionName` of each error, when the server named one — how a reviewer refusal is told apart. */
  exceptions: string[]
  constructor(status: number, message: string, exceptions: string[] = []) {
    super(message ? `Bitbucket Data Center: ${message}` : `Bitbucket Data Center API error (${status})`)
    this.status = status
    this.exceptions = exceptions
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
    const d = (await res.json().catch(() => null)) as { errors?: Array<{ message?: unknown; exceptionName?: unknown }> } | null
    const msg = (d?.errors ?? [])
      .map((e) => (typeof e?.message === 'string' ? e.message.trim() : ''))
      .filter(Boolean)
      .join('; ')
    const exceptions = (d?.errors ?? []).flatMap((e) => (typeof e?.exceptionName === 'string' ? [e.exceptionName] : []))
    throw new BitbucketServerError(res.status, msg, exceptions)
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
 * (or a server that never says "last") cannot spin — and `partial` is told
 * when the cap, not the server, ended the walk, so a caller can say so.
 */
export async function bbsPages<T>(
  url: string,
  token: string,
  limit = 50,
  maxPages = 20,
  partial?: () => void
): Promise<T[]> {
  const out: T[] = []
  let start = 0
  for (let page = 0; page < maxPages; page++) {
    const sep = url.includes('?') ? '&' : '?'
    const data = await bbsJson<BbsPage<T>>(`${url}${sep}start=${start}&limit=${limit}`, token)
    out.push(...(data?.values ?? []))
    if (!data || data.isLastPage !== false || typeof data.nextPageStart !== 'number' || data.nextPageStart <= start) return out
    start = data.nextPageStart
  }
  partial?.()
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
  commentAnchor?: { path?: string; line?: number; srcPath?: string; fileType?: 'FROM' | 'TO'; orphaned?: boolean }
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
    requestedReviewers: pendingReviewers(pr).map((r) => who(r.user)),
    ...(pr.updatedDate ? { updatedAt: new Date(pr.updatedDate).toISOString() } : {}),
    ...(pr.description ? { body: pr.description } : {})
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
  const jobs: CiJob[] = builds.map((b) => ({
    name: b.name || b.key || 'build',
    state: bbsCiState(b.state),
    ...(b.url ? { url: b.url } : {}),
    // Neutral, but not skipped: a cancelled build, or one whose state the server does not know.
    ...(b.state === 'CANCELLED' ? { neutralAs: 'cancelled' as const } : b.state === 'UNKNOWN' || !b.state ? { neutralAs: 'unknown' as const } : {})
  }))
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
        comments: all.map(toComment),
        // FROM is the old file (a removed line), TO the new one. An orphaned
        // anchor no longer matches the diff, so it is not drawn on a line.
        ...(a.commentAnchor.orphaned || typeof a.commentAnchor.line !== 'number'
          ? {}
          : a.commentAnchor.fileType === 'FROM'
            ? { side: 'old' as const }
            : a.commentAnchor.fileType === 'TO'
              ? { side: 'new' as const }
              : {})
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
  // `canMerge: false` alone says nothing about conflicts — only `true` or a CLEAN outcome does.
  return m.canMerge === true || m.outcome === 'CLEAN' ? true : null
}

/**
 * The server refuses the merge but names neither a conflict nor a merge check —
 * `canMerge: false` with no vetoes. The PR page then disables Merge with a
 * generic reason instead of letting the click fail.
 */
export function bbsMergeRefusedSilently(m: BbsMergeability | null | undefined): boolean {
  return !!m && m.canMerge === false && !isConflicted(m) && !bbsMergeBlockers(m).length
}

/** The merge checks that veto the merge, in the server's own words. */
export function bbsMergeBlockers(m: BbsMergeability | null | undefined): string[] {
  return (m?.vetoes ?? []).map((v) => [v.summaryMessage, v.detailedMessage].filter(Boolean).join(' — ')).filter(Boolean)
}

/**
 * Why a merge is refused, as a stable code the renderer translates, plus the
 * server's own veto texts — merge checks speak for themselves, so those are
 * never reworded. `conflictsVetoed`: conflicts *and* at least one veto.
 */
export type BbsMergeRefusalCode = 'conflicts' | 'conflictsVetoed' | 'vetoed' | 'notAllowed'
export interface BbsMergeRefusal {
  code: BbsMergeRefusalCode
  vetoes: string[]
}

export function bbsMergeRefusal(m: BbsMergeability): BbsMergeRefusal | null {
  const vetoes = bbsMergeBlockers(m)
  if (isConflicted(m)) return { code: vetoes.length ? 'conflictsVetoed' : 'conflicts', vetoes }
  if (vetoes.length) return { code: 'vetoed', vetoes }
  return m.canMerge === false ? { code: 'notAllowed', vetoes: [] } : null
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
    pr.ciCounts = countChecks(status)
  }
  return prs
}

/** Merged or declined pull requests, newest first, up to `limit` — no build statuses. */
export async function listBbsPullsIn(
  repo: BitbucketServerRepo,
  token: string,
  state: 'MERGED' | 'DECLINED',
  limit: number
): Promise<PullRequest[]> {
  const pulls = await bbsPages<BbsPull>(`${bbsRepoApi(repo)}/pull-requests?state=${state}&order=NEWEST`, token, 50, Math.ceil(limit / 50))
  return pulls.slice(0, limit).map((p) => mapBbsPull(p, repo))
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
    ...(open && bbsMergeRefusedSilently(merge) ? { mergeRefused: true } : {}),
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
 * Commits read in full per call. The stats requests are cheap and cover all
 * 200 heads; each full read is one more request, so a list where every head
 * has builds would otherwise cost 200. The first 50 — the newest pull
 * requests, in the list's own order — get their CI; the rest show none.
 */
export const BBS_CI_FULL_READS = 50

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
  const batches: string[][] = []
  for (let i = 0; i < wanted.length; i += STATS_BATCH) batches.push(wanted.slice(i, i + STATS_BATCH))
  // At most five batches, so all of them at once. One that fails costs only
  // its own rows their CI, not every row's.
  const found = await Promise.all(
    batches.map((batch) =>
      bbsJson<Record<string, BbsBuildStats>>(`${bitbucketServerEndpoints(repo.base).buildStatusBase}/commits/stats`, token, {
        method: 'POST',
        body: JSON.stringify(batch)
      })
        .then((stats) => batch.filter((sha) => hasBuilds(stats?.[sha])))
        .catch(() => [] as string[])
    )
  )
  const withBuilds = found.flat().slice(0, BBS_CI_FULL_READS)
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

const LINE_TYPE: Record<PrLineAnchor['kind'], 'ADDED' | 'REMOVED' | 'CONTEXT'> = { add: 'ADDED', del: 'REMOVED', ctx: 'CONTEXT' }

/**
 * A comment on one line of the pull request's effective diff (the one its
 * Diff tab shows). A removed line counts in the source file (FROM), added and
 * context lines in the destination (TO); `srcPath` names a renamed file's old path.
 */
export async function bbsCommentOnLine(
  repo: BitbucketServerRepo,
  token: string,
  id: number,
  anchor: PrLineAnchor,
  text: string
): Promise<void> {
  await bbsJson(`${bbsRepoApi(repo)}/pull-requests/${id}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({
      text,
      anchor: {
        path: anchor.path,
        ...(anchor.oldPath ? { srcPath: anchor.oldPath } : {}),
        line: getAnchorLine(anchor),
        lineType: LINE_TYPE[anchor.kind],
        fileType: getAnchorSide(anchor) === 'old' ? 'FROM' : 'TO',
        diffType: 'EFFECTIVE'
      }
    })
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
  // A search that misses (too many "contains" matches, or no permission to
  // search): a plain name is tried as a slug — one more request, only then.
  // Not assumed to be one: the REST reference only says a slug "may not be the
  // user's username" and never how it is derived (its case, for one), so the
  // server's answer is what is used, never the guess.
  const user = (await bbsUserByName(api, name, token)) ?? (PLAIN_SLUG.test(name) ? await bbsUserBySlug(api, name, token) : null)
  return { name, ...(user?.slug ? { slug: user.slug } : {}), ...(user?.displayName ? { displayName: user.displayName } : {}) }
}

/** A user name made only of slug-safe characters — the only kind worth trying as a slug. */
const PLAIN_SLUG = /^[A-Za-z0-9._-]+$/

/** `GET /users/{userSlug}`, kept only when the record it returns is that user. */
async function bbsUserBySlug(api: string, name: string, token: string): Promise<BbsUser | null> {
  const user = await bbsJson<BbsUser>(`${api}/users/${enc(name)}`, token).catch(() => null)
  return user?.slug && user.name?.toLowerCase() === name.toLowerCase() ? user : null
}

/**
 * The user record for a user *name*. `/users/{userSlug}` takes a slug, which
 * "may not be the user's username, always use the user.slug property" (REST
 * reference, GET /users/{userSlug}) — an email-style name `jdoe@corp.com` has
 * the slug `jdoe_corp.com`. So the name is looked up through `GET /users?filter=`
 * (users whose name, display name or email *contain* it) and matched exactly.
 */
async function bbsUserByName(api: string, name: string, token: string): Promise<BbsUser | null> {
  // Pages of 100, read only until the exact name turns up: a short name such as
  // `al` matches every Alice and Alan, and the wanted one may be pages in.
  let start = 0
  let ci: BbsUser | null = null
  for (let page = 0; page < 4; page++) {
    const data = await bbsJson<BbsPage<BbsUser>>(`${api}/users?filter=${enc(name)}&start=${start}&limit=100`, token).catch(() => null)
    const users = data?.values ?? []
    // User names compare case-insensitively on the server; an exact match wins.
    const exact = users.find((u) => u.name === name)
    if (exact) return exact
    ci ??= users.find((u) => u.name?.toLowerCase() === name.toLowerCase()) ?? null
    if (!data || data.isLastPage !== false || typeof data.nextPageStart !== 'number' || data.nextPageStart <= start) break
    start = data.nextPageStart
  }
  return ci
}

/** Settings → Integrations: the account behind a server's token. */
export async function describeBbsAccount(base: string, token: string): Promise<ConnectedAccount> {
  const me = await bbsWhoAmI(base, token)
  if (!me) throw new BitbucketServerError(401, BBS_TOKEN_UNRECOGNISED)
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
 * carry both name and slug), else a plain name as its own slug. Null for a
 * name that cannot be one (`jdoe@corp.com`): sending it would only 404.
 */
async function reviewerSlug(
  repo: BitbucketServerRepo,
  token: string,
  id: number,
  me: { name: string; slug?: string }
): Promise<string | null> {
  if (me.slug) return me.slug
  const pr = await bbsJson<BbsPull>(`${bbsRepoApi(repo)}/pull-requests/${id}`, token).catch(() => null)
  const people = [...(pr?.reviewers ?? []), ...(pr?.participants ?? [])].map((p) => p.user)
  const match = people.find((u) => u?.name === me.name) ?? people.find((u) => u?.name?.toLowerCase() === me.name.toLowerCase())
  return match?.slug || (PLAIN_SLUG.test(me.name) ? me.name : null)
}

/** The message the renderer recognises and translates (`gitError.bbsUserNotFound`). */
export const BBS_USER_NOT_FOUND = 'could not find your user on the server'
// Like BBS_USER_NOT_FOUND: English with a fixed shape, translated by gitErrorHint.
export const BBS_TOKEN_UNRECOGNISED = 'the server did not recognise this token — check that it is valid and not expired'
export const BBS_COMMENT_EMPTY = 'a comment needs some text'
export const BBS_NO_IDENTITY = 'the server did not say who this token is, so changes cannot be requested'
// The merge refusal's English, for a reader of the raw text. The renderer goes
// by the `[code]` alone and keeps only the server's veto words: neither
// sentence below may contain a ';', which is what separates them from those.
export const BBS_MERGE_CONFLICTS = 'the pull request has conflicts that must be resolved first'
export const BBS_MERGE_NOT_ALLOWED = 'the server does not allow this merge yet'

/** `cannot merge [code] — …`: the code is the contract with gitErrorHint, the vetoes the server's words. */
export function bbsCannotMergeMessage(refusal: BbsMergeRefusal): string {
  const vetoes = refusal.vetoes.join('; ')
  const detail =
    refusal.code === 'conflicts'
      ? BBS_MERGE_CONFLICTS
      : refusal.code === 'conflictsVetoed'
        ? `${BBS_MERGE_CONFLICTS}; ${vetoes}`
        : refusal.code === 'vetoed'
          ? vetoes
          : BBS_MERGE_NOT_ALLOWED
  return `cannot merge [${refusal.code}] — ${detail}`
}
export const bbsMethodNotAllowedMessage = (method: string): string => `this repository does not allow ${method} merges`

export async function bbsReview(
  repo: BitbucketServerRepo,
  token: string,
  id: number,
  event: PrReviewEvent,
  body: string
): Promise<void> {
  if (event === 'COMMENT') {
    if (!body.trim()) throw new BitbucketServerError(400, BBS_COMMENT_EMPTY)
    await bbsComment(repo, token, id, body)
    return
  }
  // The verdict first, the comment after: a status that fails leaves nothing
  // behind, so a retry cannot post the same comment twice.
  const status = PR_STATUS[event]
  const me = await bbsWhoAmI(repo.base, token).catch(() => null)
  const slug = me ? await reviewerSlug(repo, token, id, me) : null
  if (slug) {
    await bbsJson(`${bbsRepoApi(repo)}/pull-requests/${id}/participants/${enc(slug)}`, token, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
  } else if (me) {
    // A user with no slug to be found: approving needs none — the deprecated
    // `POST …/approve` (still in the 10.2 reference) approves as the caller.
    // Requesting changes has no such resource.
    if (status !== 'APPROVED') throw new BitbucketServerError(404, BBS_USER_NOT_FOUND)
    await bbsJson(`${bbsRepoApi(repo)}/pull-requests/${id}/approve`, token, { method: 'POST' })
  } else {
    // No user to name: the older, deprecated resource approves as the caller.
    if (status !== 'APPROVED') throw new BitbucketServerError(400, BBS_NO_IDENTITY)
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
    if (refusal) throw new BitbucketServerError(409, bbsCannotMergeMessage(refusal))
  }
  const settings = await bbsJson<{ mergeConfig?: { strategies?: Array<{ id?: string; enabled?: boolean }> } }>(
    `${r}/settings/pull-requests`,
    token
  ).catch(() => null)
  const strategies = settings?.mergeConfig?.strategies
  const enabled = strategies ? strategies.filter((s) => s.enabled && s.id).map((s) => s.id!) : null
  const strategyId = bbsStrategyFor(method, enabled)
  if (strategyId === null) throw new BitbucketServerError(400, bbsMethodNotAllowedMessage(method))
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
  // A reviewer the server refuses (InvalidPullRequestReviewersException, a 409)
  // costs the reviewers, not the pull request.
  const { result: pr, dropped } = await createWithoutRejectedReviewers(opts, (o) =>
    bbsJson<BbsPull>(`${bbsRepoApi(repo)}/pull-requests`, token, {
      method: 'POST',
      body: JSON.stringify({
        title: o.title,
        description: o.body,
        fromRef: ref(o.source),
        toRef: ref(o.target),
        // Drafts arrived in 8.18; an older server is only told about one when asked for.
        ...(o.draft ? { draft: true } : {}),
        // Reviewers by user name, the shape the create resource documents.
        ...(o.reviewers?.length ? { reviewers: o.reviewers.map((name) => ({ user: { name } })) } : {})
      })
    })
  )
  const metaFailed: PrMetaField[] = dropped ? ['reviewers'] : reviewersMissing(opts, bbsReviewerIds(pr.reviewers))
  return {
    url: pr.links?.self?.[0]?.href ?? bitbucketServerPullRequestUrl(repo, pr.id),
    number: pr.id,
    ...(metaFailed.length ? { metaFailed } : {})
  }
}

/**
 * Reviewers for a new pull request: the users who can read this repository —
 * a reviewer needs at least that — less the signed-in account, which Data
 * Center refuses as a reviewer of its own pull request. No assignees or labels:
 * Data Center pull requests have neither.
 */
export async function bbsPickerOptions(repo: BitbucketServerRepo, token: string): Promise<PrPickerOptions> {
  const api = bitbucketServerEndpoints(repo.base).apiBase
  const filter = `permission.1=REPO_READ&permission.1.projectKey=${enc(repo.projectKey)}&permission.1.repositorySlug=${enc(repo.repoSlug)}`
  return collectPickerOptions(
    prMetaSupport('bitbucket'),
    {
      reviewers: async (partial) => {
        const [users, me] = await Promise.all([
          bbsPages<BbsUser>(`${api}/users?${filter}`, token, 100, PICKER_MAX_PAGES, partial),
          bbsWhoAmI(repo.base, token).catch(() => null)
        ])
        const people = users.flatMap((u): PrPickerPerson[] =>
          u.name ? [{ id: u.name, login: u.name, ...(u.displayName ? { name: u.displayName } : {}) }] : []
        )
        return withoutSelf(uniqueById(people), me?.name)
      }
    },
    // A reviewer is a user name, so one can be typed when the list could not be read.
    { people: true }
  )
}
