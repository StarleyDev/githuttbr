import type {
  PrCheck,
  PrUpdateKind,
  PrUpdateList,
  PrComment,
  PrCommentHandle,
  PrCommitList,
  PrDetail,
  PrFile,
  PrDiffRevision,
  PrLineAnchor,
  PrMergeMethod,
  PrReview,
  PrReviewEvent,
  PrReviewThread,
  PrWorkItem
} from '../shared/types'
import { decodeFileBytes, type FileBytesVerdict } from '../shared/prFileText'
import { diffFileVersions } from '../shared/prFileDiff'
import { getAnchorLine, getAnchorSide, LINE_COMMENT_STALE } from '../shared/prLineAnchor'
import { finishPrCommits, PR_COMMITS_MAX, type RawPrCommit } from '../shared/prCommits'
import { finishPrUpdates, keepFirstListing, toUpdateCommits, type PrUpdateDraft } from '../shared/prUpdates'
import { isEditedAfter } from '../shared/prCommentHandle'

/**
 * Azure DevOps pull requests on the PR page. Every call goes through `ado`,
 * which hosting.ts builds from adoJson + the credential retry — so this module
 * never sees how auth works, and nothing here imports hosting.
 *
 * One gap the other hosts do not have: Azure lists a PR's changed files but
 * sends no patch. Each file's two versions are fetched as bytes and diffed
 * here (shared/prFileDiff.ts); a binary or huge file links to the host
 * instead. The Files tab asks this clone first (prLocalFiles.ts).
 */

export type Ado = <T>(url: string, init?: RequestInit) => Promise<T>
/** A plain-text read (a build log), keeping at most the last `max` bytes. Null
 *  when the server will not give it — no permission, or a sign-in page. */
export type AdoText = (url: string, max: number) => Promise<string | null>
/** One page of a list Azure continues by header: its body and `x-ms-continuationtoken`. */
export type AdoPage = <T>(url: string) => Promise<{ body: T; continuation: string | null }>

export interface AzureRepo {
  org: string
  project: string
  repo: string
}

const V = 'api-version=7.1'
const repoApi = (r: AzureRepo): string =>
  `https://dev.azure.com/${encodeURIComponent(r.org)}/${encodeURIComponent(r.project)}/_apis/git/repositories/${encodeURIComponent(r.repo)}`
/** A repository's REST root in its organization — what a file read hangs off. */
export const azureRepoApi = repoApi
const branchOf = (ref: string | undefined): string => (ref ?? '').replace(/^refs\/heads\//, '')

interface AzIdentity {
  id?: string
  displayName?: string
  uniqueName?: string
  isContainer?: boolean
}

interface AzReviewer extends AzIdentity {
  vote?: number
}

interface AzPr {
  pullRequestId: number
  title: string
  description?: string
  status: 'active' | 'completed' | 'abandoned' | string
  isDraft?: boolean
  createdBy?: AzIdentity
  creationDate?: string
  closedDate?: string
  closedBy?: AzIdentity
  sourceRefName?: string
  targetRefName?: string
  mergeStatus?: string
  reviewers?: AzReviewer[]
  labels?: Array<{ name: string; active?: boolean }>
  lastMergeSourceCommit?: { commitId: string }
  repository?: { project?: { id?: string } }
  /** Set when the source branch lives in a fork of this repository. */
  forkSource?: { name?: string; repository?: { id?: string; name?: string; project?: { name?: string } } }
}

interface AzComment {
  id: number
  content?: string
  author?: AzIdentity
  publishedDate?: string
  /** When the text last changed; `lastUpdatedDate` also moves for a like. */
  lastContentUpdatedDate?: string
  commentType?: string
  isDeleted?: boolean
}

/** A comment as the page shows it: its thread and id, to edit or delete it in place. */
function mapAzureComment(th: AzThread, c: AzComment, kind: 'conversation' | 'review'): PrComment {
  return {
    author: nameOf(c.author),
    body: c.content ?? '',
    createdAt: c.publishedDate ?? '',
    handle: { id: c.id, kind, threadId: th.id },
    // Display names repeat; the identity id is what tells two "Ana Souza" apart.
    ...(c.author?.id ? { authorId: c.author.id } : {}),
    // The account name, unique per user: a second way to know the comment is yours.
    ...(c.author?.uniqueName ? { authorUniqueName: c.author.uniqueName } : {}),
    ...(isEditedAfter(c.publishedDate, c.lastContentUpdatedDate) ? { edited: true } : {})
  }
}

interface AzThread {
  id: number
  isDeleted?: boolean
  comments?: AzComment[]
  threadContext?: {
    filePath?: string
    rightFileStart?: { line?: number }
    leftFileStart?: { line?: number }
  } | null
}

const nameOf = (who: AzIdentity | undefined): string => who?.displayName || who?.uniqueName || 'unknown'

/** Azure's numeric vote → the page's review state; 0 (no vote) is not a review. */
export function azureVoteState(vote: number | undefined): PrReview['state'] | null {
  if (vote === 10 || vote === 5) return 'APPROVED' // approved, approved with suggestions
  if (vote === -10 || vote === -5) return 'CHANGES_REQUESTED' // rejected, waiting for author
  return null
}

const MERGEABLE: Record<string, boolean> = { succeeded: true, conflicts: false, failure: false, rejectedByPolicy: false }

/** The fork a pull request's source branch lives in, named `project/repo` when Azure says. */
export function azureForkSource(pr: Pick<AzPr, 'forkSource'>): string | null {
  const repo = pr.forkSource?.repository
  if (!pr.forkSource) return null
  if (repo?.name) return repo.project?.name ? `${repo.project.name}/${repo.name}` : repo.name
  return repo?.id ?? pr.forkSource.name ?? 'fork'
}

export function mapAzurePr(r: AzureRepo, pr: AzPr, threads: AzThread[]): PrDetail {
  const comments: PrDetail['comments'] = []
  const reviewThreads: PrReviewThread[] = []
  for (const th of threads) {
    if (th.isDeleted) continue
    // System notes ("X voted", "updated the source branch") are not conversation.
    const notes = (th.comments ?? []).filter((c) => !c.isDeleted && c.commentType !== 'system' && c.content?.trim())
    if (!notes.length) continue
    const ctx = th.threadContext
    if (ctx?.filePath) {
      reviewThreads.push({
        path: ctx.filePath.replace(/^\//, ''),
        line: ctx.rightFileStart?.line ?? ctx.leftFileStart?.line ?? null,
        diffHunk: '',
        rootId: th.id,
        comments: notes.map((c) => ({ id: c.id, ...mapAzureComment(th, c, 'review') })),
        ...(ctx.rightFileStart?.line ? { side: 'new' as const } : ctx.leftFileStart?.line ? { side: 'old' as const } : {})
      })
    } else {
      // A conversation thread's first comment, with others after it, is one that was answered.
      notes.forEach((c, i) =>
        comments.push({ ...mapAzureComment(th, c, 'conversation'), ...(i === 0 && notes.length > 1 ? { hasReplies: true } : {}) })
      )
    }
  }
  comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const reviewers = pr.reviewers ?? []
  const completed = pr.status === 'completed'
  return {
    number: pr.pullRequestId,
    title: pr.title,
    body: pr.description ?? '',
    author: nameOf(pr.createdBy),
    source: branchOf(pr.sourceRefName),
    target: branchOf(pr.targetRefName),
    draft: !!pr.isDraft,
    state: pr.status === 'active' ? 'open' : 'closed',
    merged: completed,
    mergeable: pr.mergeStatus && pr.mergeStatus in MERGEABLE ? MERGEABLE[pr.mergeStatus] : null,
    url: `https://dev.azure.com/${encodeURIComponent(r.org)}/${encodeURIComponent(r.project)}/_git/${encodeURIComponent(r.repo)}/pullrequest/${pr.pullRequestId}`,
    comments,
    reviews: reviewers.flatMap((rv) => {
      const state = azureVoteState(rv.vote)
      return state ? [{ author: nameOf(rv), state }] : []
    }),
    reviewThreads,
    createdAt: pr.creationDate,
    closedAt: pr.closedDate ?? null,
    mergedAt: completed ? (pr.closedDate ?? null) : null,
    mergedBy: completed ? (pr.closedBy ? nameOf(pr.closedBy) : null) : null,
    requestedReviewers: reviewers
      .filter((rv) => !rv.vote)
      .map((rv) => ({ login: nameOf(rv), ...(rv.isContainer ? { team: true } : {}) })),
    labels: (pr.labels ?? []).filter((l) => l.active !== false).map((l) => ({ name: l.name })),
    sourceRepo: azureForkSource(pr)
  }
}

/** `optional` runs the calls that need a scope the token may lack (Work Items):
 *  a refusal there must not be mistaken for a revoked credential. */
export async function azurePrDetail(ado: Ado, r: AzureRepo, id: number, optional: Ado = ado): Promise<PrDetail> {
  const base = `${repoApi(r)}/pullrequests/${id}`
  // Threads read against the last iteration: Azure then tracks each one across
  // the pushes since it was written, so its line is where it is today — the
  // line the Files tab draws it on, which shows that same iteration.
  const threadsNow = async (): Promise<{ value?: AzThread[] }> => {
    const last = await azurePrRevision(ado, r, id).catch(() => null)
    const tracked = last?.iteration !== undefined ? `$iteration=${last.iteration}&$baseIteration=0&` : ''
    return ado<{ value?: AzThread[] }>(`${base}/threads?${tracked}${V}`)
  }
  const [pr, threads, workItems] = await Promise.all([
    ado<AzPr>(`${base}?${V}`),
    threadsNow().catch(() => ({ value: [] as AzThread[] })),
    // A token without Work Items (Read) cannot list them: the row is left out, the PR still opens.
    azurePrWorkItems(optional, r, id).catch(() => undefined)
  ])
  return { ...mapAzurePr(r, pr, threads.value ?? []), ...(workItems ? { workItems } : {}) }
}

interface AzWorkItem {
  id: number
  fields?: Record<string, unknown>
}

/** Where a work item opens in the browser. */
export const azureWorkItemUrl = (org: string, id: number): string =>
  `https://dev.azure.com/${encodeURIComponent(org)}/_workitems/edit/${id}`

/** Work items as the batch endpoint returns them, in the order the PR links them. */
export function mapAzureWorkItems(org: string, ids: readonly number[], items: readonly AzWorkItem[]): PrWorkItem[] {
  const byId = new Map(items.map((w) => [w.id, w]))
  return ids.map((id) => {
    const f = byId.get(id)?.fields ?? {}
    const str = (k: string): string | undefined => (typeof f[k] === 'string' ? (f[k] as string) : undefined)
    const type = str('System.WorkItemType')
    const state = str('System.State')
    return {
      id,
      title: str('System.Title') ?? '',
      ...(type ? { type } : {}),
      ...(state ? { state } : {}),
      url: azureWorkItemUrl(org, id)
    }
  })
}

/** The PR's linked work items: their ids, then title, type and state in one batch read. */
export async function azurePrWorkItems(ado: Ado, r: AzureRepo, id: number): Promise<PrWorkItem[]> {
  const refs = await ado<{ value?: Array<{ id: string | number }> }>(`${repoApi(r)}/pullrequests/${id}/workitems?${V}`)
  // The batch endpoint takes at most 200 ids; a PR linking more is not a real case.
  const ids = [...new Set((refs.value ?? []).map((w) => Number(w.id)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200)
  if (!ids.length) return []
  const items = await ado<{ value?: AzWorkItem[] }>(
    `https://dev.azure.com/${encodeURIComponent(r.org)}/_apis/wit/workitems?ids=${ids.join(',')}` +
      `&fields=System.Title,System.WorkItemType,System.State&errorPolicy=omit&${V}`
  )
  // errorPolicy=omit puts null in the place of an item this token cannot see.
  return mapAzureWorkItems(r.org, ids, (items.value ?? []).filter((w): w is AzWorkItem => !!w))
}

/** The policy type Azure gives a branch's build validation. */
const BUILD_POLICY = '0609b952-1397-4640-95ec-e00a01b2c241'

interface AzPolicyEvaluation {
  status?: string
  configuration?: {
    isBlocking?: boolean
    type?: { id?: string }
    settings?: { displayName?: string | null; buildDefinitionId?: number }
  }
  context?: { buildId?: number; buildDefinitionName?: string; isExpired?: boolean }
}

/** Where a build opens in the browser — and the link the log reader recognises. */
export const azureBuildUrl = (org: string, project: string, buildId: number): string =>
  `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_build/results?buildId=${buildId}`

/**
 * The build a check links to, when it is an Azure Pipelines run in this PR's own
 * organization: `dev.azure.com/<org>/<project>/_build/results?buildId=N`, or the
 * older `<org>.visualstudio.com/<project>/…`. Anything else — an external CI,
 * another organization, a look-alike host — is null, and no token goes to it.
 */
export function azureBuildRef(org: string, link: string): { project: string; buildId: number } | null {
  let u: URL
  let parts: string[]
  try {
    u = new URL(link)
    parts = u.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase()
  let rest: string[]
  if (host === 'dev.azure.com') {
    if ((parts[0] ?? '').toLowerCase() !== org.toLowerCase()) return null
    rest = parts.slice(1)
  } else if (host === `${org.toLowerCase()}.visualstudio.com`) {
    rest = parts[0]?.toLowerCase() === 'defaultcollection' ? parts.slice(1) : parts
  } else return null
  const buildId = Number(u.searchParams.get('buildId'))
  if (rest.length !== 3 || rest[1] !== '_build' || rest[2] !== 'results' || !Number.isInteger(buildId) || buildId <= 0) {
    return null
  }
  // The project is decoded, and encodeURIComponent leaves dots alone: a `..`
  // here would walk the API URL the token is sent to out of this organization.
  if (rest[0] === '.' || rest[0] === '..' || /[/\\]/.test(rest[0])) return null
  return { project: rest[0], buildId }
}

function statusCheck(r: AzureRepo, s: { state?: string; description?: string; context?: { name?: string; genre?: string }; targetUrl?: string }): PrCheck {
  const name = [s.context?.genre, s.context?.name].filter(Boolean).join('/') || s.description || 'status'
  const pending = !s.state || s.state === 'pending' || s.state === 'notSet'
  const url = s.targetUrl ?? ''
  return {
    name,
    status: pending ? 'in_progress' : 'completed',
    conclusion: pending ? null : s.state === 'succeeded' ? 'success' : s.state === 'notApplicable' ? 'neutral' : 'failure',
    url,
    ...(azureBuildRef(r.org, url) ? { hasLog: true } : {})
  }
}

/**
 * A branch's build validation as a check. Azure records it as a policy
 * evaluation, not as a PR status, so a PR whose only CI is the required
 * pipeline used to show no check at all. `notApplicable` (the policy does not
 * cover this PR's files) is left out, like GitHub leaves out a skipped workflow.
 */
export function mapAzureBuildPolicies(r: AzureRepo, evaluations: readonly AzPolicyEvaluation[]): PrCheck[] {
  return evaluations
    .filter((e) => e.configuration?.type?.id === BUILD_POLICY && e.status !== 'notApplicable')
    .map((e) => {
      const buildId = e.context?.buildId
      const name =
        e.configuration?.settings?.displayName ||
        e.context?.buildDefinitionName ||
        `Build ${e.configuration?.settings?.buildDefinitionId ?? ''}`.trim()
      const st = e.status ?? 'queued'
      const done = st === 'approved' || st === 'rejected' || st === 'broken'
      // An expired build passed once but no longer counts — say so rather than show green.
      const conclusion = !done ? null : st === 'approved' && !e.context?.isExpired ? 'success' : st === 'approved' ? 'neutral' : 'failure'
      return {
        name,
        status: done ? 'completed' : st === 'queued' ? 'queued' : 'in_progress',
        conclusion,
        url: buildId ? azureBuildUrl(r.org, r.project, buildId) : '',
        ...(buildId ? { hasLog: true } : {})
      }
    })
}

/** PR statuses (external CI and pipelines that post one) and build-validation
 *  policies. Policies go through `optional`: reading them may need more scope. */
export async function azurePrChecks(ado: Ado, r: AzureRepo, id: number, optional: Ado = ado): Promise<PrCheck[]> {
  const [st, pr] = await Promise.all([
    ado<{ value?: Array<{ state?: string; description?: string; context?: { name?: string; genre?: string }; targetUrl?: string }> }>(
      `${repoApi(r)}/pullrequests/${id}/statuses?${V}`
    ).catch(() => ({ value: [] })),
    ado<AzPr>(`${repoApi(r)}/pullrequests/${id}?${V}`).catch(() => null)
  ])
  const statuses = (st.value ?? []).map((s) => statusCheck(r, s))
  // Policies are listed by the project's id, which only the PR carries.
  const projectId = pr?.repository?.project?.id
  const ev = projectId
    ? await optional<{ value?: AzPolicyEvaluation[] }>(
        `https://dev.azure.com/${encodeURIComponent(r.org)}/${encodeURIComponent(r.project)}/_apis/policy/evaluations` +
          `?artifactId=${encodeURIComponent(`vstfs:///CodeReview/CodeReviewId/${projectId}/${id}`)}&api-version=7.1-preview.1`
      ).catch(() => ({ value: [] as AzPolicyEvaluation[] }))
    : { value: [] as AzPolicyEvaluation[] }
  const builds = mapAzureBuildPolicies(r, ev.value ?? [])
  // A pipeline that also posts a status would show twice; keep the policy row.
  const seen = new Set(builds.map((b) => b.url.toLowerCase()).filter(Boolean))
  return [...builds, ...statuses.filter((check) => {
    const ref = azureBuildRef(r.org, check.url)
    const url = ref ? azureBuildUrl(r.org, ref.project, ref.buildId) : check.url
    return !url || !seen.has(url.toLowerCase())
  })]
}

interface AzTimelineRecord {
  type?: string
  name?: string
  result?: string | null
  order?: number
  log?: { id?: number } | null
}

/**
 * Which logs of a build to show, in order: the tasks that failed — where the
 * reason is — or, when nothing failed, each job's whole log. At most `max`.
 */
export function pickBuildLogs(records: readonly AzTimelineRecord[], max = 3): { name: string; logId: number }[] {
  const withLog = records
    .filter((r): r is AzTimelineRecord & { log: { id: number } } => typeof r.log?.id === 'number')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const failed = withLog.filter((r) => r.type === 'Task' && r.result === 'failed')
  const pick = failed.length ? failed : withLog.filter((r) => r.type === 'Job')
  return pick.slice(0, max).map((r) => ({ name: r.name ?? '', logId: r.log.id }))
}

/** How much of a build's log the page shows, across every part read: the end, where a failure is. */
const LOG_TAIL_BYTES = 512 * 1024

/**
 * The log of an Azure Pipelines build a check links to, or null when the link
 * is not one of this organization's builds or the token cannot read builds
 * (*Build: Read*). Several failed tasks are shown one after another, each under
 * its name, sharing the same budget.
 */
export async function azureBuildLog(ado: Ado, text: AdoText, r: AzureRepo, link: string): Promise<string | null> {
  const ref = azureBuildRef(r.org, link)
  if (!ref) return null
  const build = `https://dev.azure.com/${encodeURIComponent(r.org)}/${encodeURIComponent(ref.project)}/_apis/build/builds/${ref.buildId}`
  // Normalised as fetch will send it, the URL must still be this organization's.
  if (!new URL(build).pathname.startsWith(`/${encodeURIComponent(r.org)}/`)) return null
  const timeline = await ado<{ records?: AzTimelineRecord[] }>(`${build}/timeline?${V}`).catch(() => null)
  const parts = pickBuildLogs(timeline?.records ?? [])
  if (!parts.length) return null
  const per = Math.floor(LOG_TAIL_BYTES / parts.length)
  const logs = await Promise.all(parts.map((p) => text(`${build}/logs/${p.logId}?${V}`, per).catch(() => null)))
  const shown = parts.flatMap((p, i) => (logs[i] === null ? [] : [parts.length > 1 ? `── ${p.name} ──\n${logs[i]}` : (logs[i] as string)]))
  return shown.length ? shown.join('\n') : null
}

/** Files fetched and diffed at most this many at a time — Azure rate-limits bursts. */
const FILE_CONCURRENCY = 3
/**
 * Files diffed while the list loads; the rest are `notLoaded` and read when one
 * is opened (`azureFileDiff`). There is no cap on the files listed or diffed:
 * a PR of 279 files used to stop at 200 and show the last 79 as "binary".
 * The Files tab reads this clone first (prLocalFiles.ts) — this is the fallback.
 */
export const AZURE_EAGER_FILES = 100
/** A version bigger than this is not diffed here (`tooLarge`): the page links to Azure. */
export const AZURE_MAX_FILE_BYTES = 4 << 20

/**
 * A file's raw bytes at a commit — the items API asked with
 * `Accept: application/octet-stream`. The JSON form decodes the content as
 * text on Azure's side and flags what it cannot as binary, which a non-ASCII
 * or UTF-16 text file then was. `tooLarge` when it is over `max` bytes.
 */
export type AdoBytes = (url: string, max: number) => Promise<Uint8Array | 'tooLarge'>

/** Statuses a throttled or briefly unwell Azure answers with: worth one more try. */
const RETRY_STATUSES = new Set([429, 502, 503, 504])
const RETRY_ATTEMPTS = 4
/** No single wait longer than this, whatever Retry-After says. */
const RETRY_MAX_WAIT_MS = 20_000
/** All of one list's eager reads share this much time; the files left after it are `notLoaded`. */
export const AZURE_FILES_DEADLINE_MS = 60_000

/** A `Retry-After` header — seconds, or an HTTP date — as milliseconds from `now`. Null when absent or unreadable. */
export function parseRetryAfter(header: string | null | undefined, now = Date.now()): number | null {
  if (!header) return null
  const s = header.trim()
  if (/^\d+$/.test(s)) return Number(s) * 1000
  const at = Date.parse(s)
  return Number.isNaN(at) ? null : Math.max(0, at - now)
}

const sleepFor = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * What every worker reading one pull request's files shares: a circuit
 * breaker — one 429 holds them all until its Retry-After, instead of three
 * workers each hammering a server that said "slow down" — and the clock.
 */
export class AzureThrottle {
  private pausedUntil = 0
  constructor(
    readonly sleep: (ms: number) => Promise<void> = sleepFor,
    readonly now: () => number = Date.now
  ) {}

  /** Wait out a pause another worker's throttle set. */
  async waitTurn(): Promise<void> {
    for (let wait = this.pausedUntil - this.now(); wait > 0; wait = this.pausedUntil - this.now()) await this.sleep(wait)
  }

  /** Hold every worker for `ms`. */
  pause(ms: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + Math.min(ms, RETRY_MAX_WAIT_MS))
  }
}

/**
 * Run an Azure call, trying again on a throttle (429) or a passing outage
 * (502–504): after the server's `Retry-After` when it sends one, else after a
 * doubling backoff — through `throttle`, so the wait holds every worker
 * sharing it. The last failure is rethrown — never turned into "no diff".
 */
export async function withThrottleRetry<T>(run: () => Promise<T>, throttle: AzureThrottle = new AzureThrottle()): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    await throttle.waitTurn()
    try {
      return await run()
    } catch (err) {
      const e = err as { status?: number; retryAfterMs?: number | null }
      if (attempt >= RETRY_ATTEMPTS || typeof e.status !== 'number' || !RETRY_STATUSES.has(e.status)) throw err
      throttle.pause(e.retryAfterMs ?? 500 * 2 ** (attempt - 1))
    }
  }
}

interface AzChange {
  changeType?: string
  item?: { path?: string; gitObjectType?: string; isFolder?: boolean }
  originalPath?: string
  /** What keeps a thread on its line across later pushes. */
  changeTrackingId?: number
}

export function azureChangeStatus(changeType: string | undefined): string {
  const t = (changeType ?? '').toLowerCase()
  if (t.includes('add')) return 'added'
  if (t.includes('delete')) return 'removed'
  if (t.includes('rename')) return 'renamed'
  return 'modified'
}

type AzIterationChanges = { changeEntries?: AzChange[]; nextSkip?: number; nextTop?: number }

/** Pages of 2000 read at most — a pull request of 20,000 files is past reviewing in an app. */
const AZURE_CHANGE_PAGES = 10

/** Every change of an iteration (Azure pages them past 2000 with `nextSkip`/`nextTop`), and whether the cap cut it. */
async function getAzureIterationChanges(
  ado: Ado,
  pageUrl: (skip: number) => string,
  throttle: AzureThrottle
): Promise<{ changes: AzChange[]; truncated: boolean }> {
  const changes: AzChange[] = []
  let skip = 0
  for (let page = 0; page < AZURE_CHANGE_PAGES; page++) {
    const url = pageUrl(skip)
    const res = await withThrottleRetry(() => ado<AzIterationChanges>(url), throttle)
    changes.push(...(res.changeEntries ?? []))
    if (!res.nextTop || !res.nextSkip) return { changes, truncated: false }
    skip = res.nextSkip
  }
  return { changes, truncated: true }
}

export async function azurePrFiles(
  ado: Ado,
  bytes: AdoBytes,
  r: AzureRepo,
  id: number,
  throttle: AzureThrottle = new AzureThrottle()
): Promise<{ files: PrFile[]; truncated: boolean }> {
  const base = `${repoApi(r)}/pullrequests/${id}`
  const its = await withThrottleRetry(
    () =>
      ado<{ value?: Array<{ id: number; sourceRefCommit?: { commitId: string }; commonRefCommit?: { commitId: string } }> }>(
        `${base}/iterations?${V}`
      ),
    throttle
  )
  const last = (its.value ?? [])[(its.value ?? []).length - 1]
  if (!last) return { files: [], truncated: false }
  const { changes, truncated } = await getAzureIterationChanges(
    ado,
    (skip) => `${base}/iterations/${last.id}/changes?$top=2000${skip ? `&$skip=${skip}` : ''}&${V}`,
    throttle
  )
  const files = await diffAzureChanges(bytes, r, changes, last.commonRefCommit?.commitId, last.sourceRefCommit?.commitId, throttle)
  return { files, truncated }
}

/**
 * The changes between two iterations of a pull request — what one push did —
 * as `$compareTo` lists them, each file diffed between the two iterations'
 * source commits. Azure sends no patch, as for the whole PR.
 */
export async function azurePrIterationFiles(
  ado: Ado,
  bytes: AdoBytes,
  r: AzureRepo,
  id: number,
  from: { iteration: number; sha: string },
  to: { iteration: number; sha: string }
): Promise<PrFile[]> {
  const throttle = new AzureThrottle()
  const base = `${repoApi(r)}/pullrequests/${id}/iterations/${to.iteration}/changes`
  const { changes } = await getAzureIterationChanges(
    ado,
    (skip) => `${base}?$top=2000${skip ? `&$skip=${skip}` : ''}&$compareTo=${from.iteration}&${V}`,
    throttle
  )
  return diffAzureChanges(bytes, r, changes, from.sha, to.sha, throttle)
}

/** A file's bytes at a commit, raw — see AdoBytes. */
function getAzureItemBytes(
  bytes: AdoBytes,
  r: AzureRepo,
  path: string,
  commit: string,
  throttle: AzureThrottle
): Promise<Uint8Array | 'tooLarge'> {
  const url =
    `${repoApi(r)}/items?path=${encodeURIComponent(path)}&versionDescriptor.version=${encodeURIComponent(commit)}` +
    `&versionDescriptor.versionType=commit&download=false&${V}`
  return withThrottleRetry(() => bytes(url, AZURE_MAX_FILE_BYTES), throttle)
}

/** A changed file as the list shows it before its diff is read. */
function toAzurePrFile(c: AzChange): PrFile {
  const path = c.item!.path!
  const status = azureChangeStatus(c.changeType)
  return {
    filename: path.replace(/^\//, ''),
    status,
    additions: 0,
    deletions: 0,
    ...(status === 'renamed' && c.originalPath ? { previousFilename: c.originalPath.replace(/^\//, '') } : {})
  }
}

/**
 * One file's diff between `before` and `after`, from its raw bytes: text or
 * binary is decided here (decodeFileBytes), not by Azure. A read that still
 * fails after its retries is `failed` with the reason — never "binary".
 */
export async function azureFileDiff(
  bytes: AdoBytes,
  r: AzureRepo,
  file: Pick<PrFile, 'filename' | 'status' | 'previousFilename'>,
  before: string | undefined,
  after: string | undefined,
  throttle: AzureThrottle = new AzureThrottle()
): Promise<PrFile> {
  const shown: PrFile = {
    filename: file.filename,
    status: file.status,
    additions: 0,
    deletions: 0,
    ...(file.previousFilename ? { previousFilename: file.previousFilename } : {})
  }
  if (!before || !after) return { ...shown, noPatchReason: 'failed', noPatchError: 'Azure DevOps named no commit for this version.' }
  const EMPTY: FileBytesVerdict = { kind: 'text', text: '' }
  try {
    const [old, now] = await Promise.all([
      file.status === 'added' ? null : getAzureItemBytes(bytes, r, `/${file.previousFilename ?? file.filename}`, before, throttle),
      file.status === 'removed' ? null : getAzureItemBytes(bytes, r, `/${file.filename}`, after, throttle)
    ])
    if (old === 'tooLarge' || now === 'tooLarge') return { ...shown, noPatchReason: 'tooLarge' }
    return { ...shown, ...diffFileVersions(old ? decodeFileBytes(old) : EMPTY, now ? decodeFileBytes(now) : EMPTY) }
  } catch (err) {
    return { ...shown, noPatchReason: 'failed', noPatchError: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Each changed file diffed between its version at `before` and at `after` —
 * the first AZURE_EAGER_FILES now, a few at a time, within one shared
 * AZURE_FILES_DEADLINE_MS; the others `notLoaded`, read when one is opened.
 */
async function diffAzureChanges(
  bytes: AdoBytes,
  r: AzureRepo,
  changeEntries: AzChange[],
  before: string | undefined,
  after: string | undefined,
  throttle: AzureThrottle
): Promise<PrFile[]> {
  const entries = changeEntries.filter((c) => c.item?.path && !c.item.isFolder && c.item.gitObjectType !== 'tree')
  const files: PrFile[] = entries.map((c) => ({ ...toAzurePrFile(c), noPatchReason: 'notLoaded' as const }))
  const eager = Math.min(AZURE_EAGER_FILES, files.length)
  const deadline = throttle.now() + AZURE_FILES_DEADLINE_MS
  let next = 0
  const worker = async (): Promise<void> => {
    // Past the deadline the file stays `notLoaded`: a slow Azure costs the list a minute, not ten.
    while (next < eager && throttle.now() < deadline) {
      const i = next++
      files[i] = await azureFileDiff(bytes, r, files[i], before, after, throttle)
    }
  }
  await Promise.all(Array.from({ length: Math.min(FILE_CONCURRENCY, eager) }, worker))
  return files
}

export async function azureComment(ado: Ado, r: AzureRepo, id: number, body: string): Promise<void> {
  await ado(`${repoApi(r)}/pullrequests/${id}/threads?${V}`, {
    method: 'POST',
    // status 1 = active; commentType 1 = text.
    body: JSON.stringify({ comments: [{ parentCommentId: 0, content: body, commentType: 1 }], status: 1 })
  })
}

type AzIteration = { id: number; sourceRefCommit?: { commitId: string }; commonRefCommit?: { commitId: string } }

/** The PR's last iteration — what the Files tab shows — as a revision; null without one. */
export async function azurePrRevision(ado: Ado, r: AzureRepo, id: number): Promise<PrDiffRevision | null> {
  const its = await ado<{ value?: AzIteration[] }>(`${repoApi(r)}/pullrequests/${id}/iterations?${V}`)
  const last = (its.value ?? [])[(its.value ?? []).length - 1]
  if (!last) return null
  return {
    headSha: last.sourceRefCommit?.commitId ?? '',
    ...(last.commonRefCommit?.commitId ? { baseSha: last.commonRefCommit.commitId } : {}),
    iteration: last.id
  }
}

/**
 * Start a thread on one line of the PR's diff. The Files tab shows the merge
 * base against the last iteration, which Azure calls comparing that iteration
 * with itself; the change's tracking id is what keeps the thread on its line
 * when the branch moves on — sent when the iteration lists the file.
 */
export async function azureCommentOnLine(
  ado: Ado,
  r: AzureRepo,
  id: number,
  anchor: PrLineAnchor,
  body: string,
  read: PrDiffRevision | null
): Promise<void> {
  const base = `${repoApi(r)}/pullrequests/${id}`
  const its = await ado<{ value?: Array<{ id: number }> }>(`${base}/iterations?${V}`)
  const last = (its.value ?? [])[(its.value ?? []).length - 1]
  // A push since the diff loaded made a new iteration: its line numbers may not be these.
  if (read?.iteration !== undefined && last && read.iteration !== last.id) throw new Error(LINE_COMMENT_STALE)
  const filePath = `/${anchor.path.replace(/^\//, '')}`
  let changeTrackingId: number | undefined
  if (last) {
    const changes = await ado<{ changeEntries?: AzChange[] }>(`${base}/iterations/${last.id}/changes?$top=2000&${V}`).catch(
      () => ({ changeEntries: [] as AzChange[] })
    )
    changeTrackingId = (changes.changeEntries ?? []).find((c) => c.item?.path === filePath)?.changeTrackingId
  }
  const at = { line: getAnchorLine(anchor), offset: 1 }
  const side = getAnchorSide(anchor) === 'old' ? 'left' : 'right'
  await ado(`${base}/threads?${V}`, {
    method: 'POST',
    body: JSON.stringify({
      comments: [{ parentCommentId: 0, content: body, commentType: 1 }],
      status: 1,
      threadContext: { filePath, [`${side}FileStart`]: at, [`${side}FileEnd`]: at },
      ...(last
        ? {
            pullRequestThreadContext: {
              ...(changeTrackingId !== undefined ? { changeTrackingId } : {}),
              iterationContext: { firstComparingIteration: last.id, secondComparingIteration: last.id }
            }
          }
        : {})
    })
  })
}

export async function azureReply(ado: Ado, r: AzureRepo, id: number, threadId: number, body: string): Promise<void> {
  await ado(`${repoApi(r)}/pullrequests/${id}/threads/${threadId}/comments?${V}`, {
    method: 'POST',
    body: JSON.stringify({ content: body, parentCommentId: 1, commentType: 1 })
  })
}

const commentUrl = (r: AzureRepo, id: number, handle: PrCommentHandle): string => {
  if (!handle.threadId) throw new Error('An Azure DevOps comment is reached through its thread, and none was given.')
  return `${repoApi(r)}/pullrequests/${id}/threads/${handle.threadId}/comments/${handle.id}?${V}`
}

/** Replace a comment's text (Pull Request Thread Comments - Update). */
export async function azureEditComment(ado: Ado, r: AzureRepo, id: number, handle: PrCommentHandle, body: string): Promise<void> {
  await ado(commentUrl(r, id, handle), { method: 'PATCH', body: JSON.stringify({ content: body }) })
}

/**
 * Delete a comment (Pull Request Thread Comments - Delete). Azure marks it
 * `isDeleted` rather than removing it: the thread and its replies stay, and
 * the page hides the deleted comment.
 */
export async function azureDeleteComment(ado: Ado, r: AzureRepo, id: number, handle: PrCommentHandle): Promise<void> {
  await ado(commentUrl(r, id, handle), { method: 'DELETE' })
}

/** Approve = 10; request changes = -5 ("waiting for author"), which is what it asks for. */
const VOTE: Record<Exclude<PrReviewEvent, 'COMMENT'>, number> = { APPROVE: 10, REQUEST_CHANGES: -5 }

export async function azureReview(ado: Ado, r: AzureRepo, id: number, event: PrReviewEvent, body: string): Promise<void> {
  if (event !== 'COMMENT') {
    // A vote is cast as the signed-in identity, whose id the org's connection data names.
    const me = await ado<{ authenticatedUser?: { id?: string } }>(
      `https://dev.azure.com/${encodeURIComponent(r.org)}/_apis/connectionData`
    )
    const myId = me.authenticatedUser?.id
    if (!myId) throw new Error('Azure DevOps did not say who this credential is.')
    await ado(`${repoApi(r)}/pullrequests/${id}/reviewers/${myId}?${V}`, {
      method: 'PUT',
      body: JSON.stringify({ vote: VOTE[event] })
    })
  }
  if (body.trim()) await azureComment(ado, r, id, body)
}

const STRATEGY: Record<PrMergeMethod, string> = { merge: 'noFastForward', squash: 'squash', rebase: 'rebase' }

export async function azureMerge(ado: Ado, r: AzureRepo, id: number, method: PrMergeMethod): Promise<void> {
  const pr = await ado<AzPr>(`${repoApi(r)}/pullrequests/${id}?${V}`)
  // Completing names the source commit it saw, so a push in between is not merged unseen.
  await ado(`${repoApi(r)}/pullrequests/${id}?${V}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'completed',
      lastMergeSourceCommit: pr.lastMergeSourceCommit,
      completionOptions: { mergeStrategy: STRATEGY[method] }
    })
  })
}

/** An Azure Boards work item's title, type and state — for a branch named after it. */
export async function azureWorkItem(
  ado: Ado,
  org: string,
  id: number
): Promise<{ id: number; title: string; type: string; state?: string }> {
  const wi = await ado<{ id: number; fields?: Record<string, unknown> }>(
    `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workitems/${id}?fields=System.Title,System.WorkItemType,System.State&${V}`
  )
  const f = wi.fields ?? {}
  return {
    id: wi.id,
    title: typeof f['System.Title'] === 'string' ? f['System.Title'] : '',
    type: typeof f['System.WorkItemType'] === 'string' ? f['System.WorkItemType'] : '',
    ...(typeof f['System.State'] === 'string' ? { state: f['System.State'] } : {})
  }
}

interface AzCommitRef {
  commitId?: string
  comment?: string
  author?: { name?: string; date?: string }
  parents?: string[]
}

/** Commits asked for per page: one past the cap, so a list that goes on shows it. */
const COMMITS_TOP = PR_COMMITS_MAX + 1

/**
 * The commits of a pull request. Azure pages this list by a header,
 * `x-ms-continuationtoken`, followed up to the cap. A server that serves
 * fewer than `$top` per page and sends no token is not trusted to have
 * ended: a page of exactly 100, 200… under the size asked for is read as a
 * cap, and the list as truncated. `comment` can be cut short by Azure
 * (`commentTruncated`); the body then ends early.
 */
export async function azurePrCommits(page: AdoPage, r: AzureRepo, id: number): Promise<PrCommitList> {
  const base = `${repoApi(r)}/pullrequests/${id}/commits?$top=${COMMITS_TOP}&${V}`
  const refs: AzCommitRef[] = []
  let token: string | null = null
  let capped = false
  for (let n = 0; n < 10 && refs.length <= PR_COMMITS_MAX; n++) {
    const url: string = token ? `${base}&continuationToken=${encodeURIComponent(token)}` : base
    const res: { body: { value?: AzCommitRef[] } | AzCommitRef[] | undefined; continuation: string | null } = await page(url)
    const { body, continuation } = res
    const items = Array.isArray(body) ? body : (body?.value ?? [])
    refs.push(...items)
    token = continuation || null
    if (!token) {
      capped = items.length > 0 && items.length < COMMITS_TOP && items.length % 100 === 0
      break
    }
  }
  const known = refs.filter((c) => typeof c.commitId === 'string')
  // Azure lists newest first, as the web page does.
  return finishPrCommits(
    known.map((c) => ({
      sha: c.commitId!,
      message: c.comment,
      authorName: c.author?.name,
      authoredAt: c.author?.date,
      parentShas: Array.isArray(c.parents) ? c.parents : null
    })),
    true,
    !!token || capped
  )
}

interface AzIterationFull {
  id?: number
  createdDate?: string
  reason?: string
  author?: AzIdentity
  push?: { pushedBy?: AzIdentity }
  sourceRefCommit?: { commitId?: string }
  commonRefCommit?: { commitId?: string }
  commits?: AzCommitRef[]
  hasMoreCommits?: boolean
}

/** Iterations whose cut-short commit list is read again on its own, at most. */
const ITERATION_COMMIT_READS = 20
/** The most commits one iteration's own list is asked for (Azure's batch limit). */
const ITERATION_COMMITS_TOP = 500

const toRawCommit = (c: AzCommitRef): RawPrCommit => ({
  sha: c.commitId!,
  message: c.comment,
  authorName: c.author?.name,
  authoredAt: c.author?.date,
  parentShas: Array.isArray(c.parents) ? c.parents : null
})

/**
 * A pull request's updates, as Azure DevOps records them: one iteration per
 * push, with who pushed, when, the source commit and why (`create`, `push`,
 * `forcePush`, `rebase`…). The iterations come with their commits in one call;
 * one whose list Azure cut short (`hasMoreCommits`) is read on its own. Whether
 * an iteration lists only its push or the whole branch is not documented, so a
 * commit counts in the first iteration that lists it; removed commits are not
 * reported — a force push or rebase is marked instead.
 */
export async function azurePrUpdates(ado: Ado, r: AzureRepo, id: number): Promise<PrUpdateList> {
  const base = `${repoApi(r)}/pullrequests/${id}`
  const res = await ado<{ value?: AzIterationFull[] } | AzIterationFull[]>(`${base}/iterations?includeCommits=true&${V}`)
  const iterations = (Array.isArray(res) ? res : (res?.value ?? []))
    .filter((it): it is AzIterationFull & { id: number } => typeof it.id === 'number')
    .sort((a, b) => a.id - b.id)
  let reads = 0
  const lists = await Promise.all(
    iterations.map(async (it) => {
      let refs = it.commits ?? []
      let short = !!it.hasMoreCommits
      if (short && reads < ITERATION_COMMIT_READS) {
        reads++
        const more = await ado<{ value?: AzCommitRef[] } | AzCommitRef[]>(
          `${base}/iterations/${it.id}/commits?top=${ITERATION_COMMITS_TOP}&${V}`
        ).catch(() => null)
        const items = Array.isArray(more) ? more : more?.value
        if (items) {
          refs = items
          short = items.length >= ITERATION_COMMITS_TOP
        }
      }
      // Azure lists newest first, as the web page does; the parents settle it when they disagree.
      return { short, commits: toUpdateCommits(refs.filter((c) => typeof c.commitId === 'string').map(toRawCommit), true) }
    })
  )
  const own = keepFirstListing(lists.map((l) => l.commits))
  const drafts: PrUpdateDraft[] = iterations.map((it, i) => {
    const reason = (it.reason ?? '').toLowerCase()
    const kind: PrUpdateKind = i === 0 || reason === 'create' ? 'opened' : reason === 'forcepush' || reason === 'rebase' ? 'rewrite' : 'push'
    const pusher = it.push?.pushedBy?.displayName || it.author?.displayName
    const head = it.sourceRefCommit?.commitId
    const mergeBase = it.commonRefCommit?.commitId
    return {
      id: String(it.id),
      iteration: it.id,
      kind,
      createdAt: it.createdDate ?? '',
      ...(pusher ? { pusher } : {}),
      ...(head ? { headSha: head } : {}),
      ...(i === 0 && mergeBase ? { fromSha: mergeBase } : {}),
      added: own[i],
      ...(lists[i].short ? { commitsTruncated: true } : {}),
      ...(reason === 'retarget' ? { retarget: true } : {})
    }
  })
  const { updates, truncated } = finishPrUpdates(drafts)
  return { updates, truncated, grouping: 'native', startCut: false }
}
