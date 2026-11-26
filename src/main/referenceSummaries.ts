import type { ReferenceQuery, ReferenceSigil, ReferenceSummary } from '../shared/types'
import { mapAzureWorkItems } from './azurePr'

/**
 * Titles for the `#12`, `!12` and `AB#12` references in commit messages and
 * comments — what the hover card on such a link shows. Every function takes a
 * `get` that already carries the repository's credential (hosting.ts builds it
 * from the profile the repository is bound to), so nothing here sees a token.
 *
 * A reference the host does not have, or will not show this account, comes back
 * `available: false` with a reason: one deleted issue must not cost the other cards.
 */

export type JsonGet = <T>(url: string) => Promise<T>

/** Most references one call answers. Azure's batch read takes 200 ids at once. */
export const REFERENCE_BATCH_MAX = 200
/**
 * Hosts with no batch read are asked one item at a time, this many at once.
 * GitHub asks integrators to make requests serially, not concurrently (its
 * secondary rate limits), so it gets one; Forgejo, a self-hosted server, two.
 */
export const GITHUB_CONCURRENCY = 1
export const FORGEJO_CONCURRENCY = 2

const SIGILS: readonly ReferenceSigil[] = ['#', '!', 'AB#']

type Reason = NonNullable<ReferenceSummary['reason']>

/** The IPC argument, checked: known sigils, positive ids, no repeats, capped. */
export function normalizeReferenceQueries(raw: unknown): ReferenceQuery[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: ReferenceQuery[] = []
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue
    const { sigil, id } = q as { sigil?: unknown; id?: unknown }
    if (!SIGILS.includes(sigil as ReferenceSigil) || typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) continue
    const key = `${sigil}${id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ sigil: sigil as ReferenceSigil, id })
    if (out.length >= REFERENCE_BATCH_MAX) break
  }
  return out
}

export const unavailableReference = (q: ReferenceQuery, reason: Reason): ReferenceSummary => ({
  sigil: q.sigil,
  id: q.id,
  available: false,
  reason
})

/** The HTTP status an error from ghJson / glJson / fjJson / adoJson carries, if any. */
function statusOf(err: unknown): number | undefined {
  const s = (err as { status?: unknown } | null)?.status
  return typeof s === 'number' ? s : undefined
}

/**
 * What a failed read means. 404/410: no such item (or hidden from this account,
 * which hosts answer the same way). 401/403 on a whole-list read: this account
 * may not read it. 429, or GitHub's throttling 403: rate limited. Anything else
 * (offline, a 5xx): unreachable.
 */
function reasonOf(err: unknown): Reason {
  const status = statusOf(err)
  if (status === 429 || (err as { rateLimited?: unknown } | null)?.rateLimited === true) return 'rateLimited'
  if (status === 404 || status === 410 || status === 401 || status === 403) return 'notFound'
  return 'unreachable'
}

/**
 * Read `queries` one at a time, at most `limit` at once, keeping their order.
 * The first 403 or 429 stops the walk: that is how GitHub says "slow down", and
 * every request after it would only dig the hole deeper. What was not asked
 * takes that answer's reason.
 */
async function readEach(
  queries: readonly ReferenceQuery[],
  limit: number,
  read: (q: ReferenceQuery) => Promise<ReferenceSummary>
): Promise<ReferenceSummary[]> {
  const out = new Array<ReferenceSummary | undefined>(queries.length)
  let next = 0
  let stop: Reason | null = null
  const worker = async (): Promise<void> => {
    while (next < queries.length && !stop) {
      const i = next++
      try {
        out[i] = await read(queries[i])
      } catch (err) {
        const status = statusOf(err)
        const reason = reasonOf(err)
        out[i] = unavailableReference(queries[i], reason)
        if (status === 403 || status === 429 || reason === 'rateLimited') stop = reason
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, queries.length) }, worker))
  return queries.map((q, i) => out[i] ?? unavailableReference(q, stop ?? 'unreachable'))
}

// ── Azure Boards ────────────────────────────────────────────────────────────

const AZ_FIELDS = 'System.Title,System.WorkItemType,System.State'

/**
 * Work items, 200 per request. `errorPolicy=omit` answers null in place of an
 * id that does not exist or this token may not read, instead of failing the
 * whole batch. On an Azure repository `#12` and `AB#12` are the same item.
 */
export async function azureReferenceSummaries(
  get: JsonGet,
  org: string,
  queries: readonly ReferenceQuery[]
): Promise<ReferenceSummary[]> {
  const ids = [...new Set(queries.filter((q) => q.sigil !== '!').map((q) => q.id))]
  const found = new Map<number, ReferenceSummary>()
  const failed = new Map<number, Reason>()
  for (let i = 0; i < ids.length; i += REFERENCE_BATCH_MAX) {
    const chunk = ids.slice(i, i + REFERENCE_BATCH_MAX)
    let res: { value?: Array<{ id: number; fields?: Record<string, unknown> } | null> }
    try {
      res = await get(
        `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workitems?ids=${chunk.join(',')}` +
          `&fields=${AZ_FIELDS}&errorPolicy=omit&api-version=7.1`
      )
    } catch (err) {
      // A token without Work Items (Read) is refused here: no card can be read.
      for (const id of chunk) failed.set(id, reasonOf(err))
      continue
    }
    const items = (res?.value ?? []).filter((w): w is { id: number; fields?: Record<string, unknown> } => !!w)
    const present = new Set(items.map((w) => w.id))
    for (const w of mapAzureWorkItems(org, chunk, items)) {
      if (!present.has(w.id)) continue
      found.set(w.id, {
        sigil: 'AB#',
        id: w.id,
        available: true,
        kind: 'workItem',
        title: w.title,
        ...(w.state ? { stateName: w.state } : {}),
        ...(w.type ? { workItemType: w.type } : {})
      })
    }
  }
  return queries.map((q) => {
    if (q.sigil === '!') return unavailableReference(q, 'unreachable')
    const hit = found.get(q.id)
    return hit ? { ...hit, sigil: q.sigil } : unavailableReference(q, failed.get(q.id) ?? 'notFound')
  })
}

// ── GitHub and GitHub Enterprise Server ─────────────────────────────────────

interface GhIssue {
  number: number
  title: string
  state: string
  pull_request?: { merged_at?: string | null } | null
}

/**
 * `#12` through the issues API, which answers for pull requests too (with a
 * `pull_request` member). GitHub has no REST batch read of issues by number,
 * so each is one request, made one after another. An older Enterprise Server
 * that leaves `merged_at` out shows a merged pull request as closed.
 */
export async function githubReferenceSummaries(
  get: JsonGet,
  repoApi: string,
  queries: readonly ReferenceQuery[]
): Promise<ReferenceSummary[]> {
  const asked = queries.filter((q) => q.sigil === '#')
  const read = await readEach(asked, GITHUB_CONCURRENCY, async (q) => {
    const issue = await get<GhIssue>(`${repoApi}/issues/${q.id}`)
    if (!issue || typeof issue.title !== 'string') return unavailableReference(q, 'notFound')
    const pr = !!issue.pull_request
    return {
      ...q,
      available: true,
      kind: pr ? 'pr' : 'issue',
      title: issue.title,
      state: pr && issue.pull_request?.merged_at ? 'merged' : issue.state === 'closed' ? 'closed' : 'open'
    }
  })
  return byQuery(queries, read)
}

/** `results` (for some of `queries`) back in the order of all of them; the rest unreachable. */
function byQuery(queries: readonly ReferenceQuery[], results: readonly ReferenceSummary[]): ReferenceSummary[] {
  const map = new Map(results.map((r) => [`${r.sigil}${r.id}`, r]))
  return queries.map((q) => map.get(`${q.sigil}${q.id}`) ?? unavailableReference(q, 'unreachable'))
}

// ── GitLab ──────────────────────────────────────────────────────────────────

interface GlItem {
  iid: number
  title: string
  state: string
}

const GL_PAGE = 100

const glState = (s: string): ReferenceSummary['state'] => (s === 'merged' ? 'merged' : s === 'closed' ? 'closed' : 'open')

/**
 * `#12` is an issue and `!12` a merge request; both list endpoints filter by
 * `iids[]`, so each kind is one request however many are asked. The issues
 * list returns every state by default; merge requests are asked `state=all`.
 */
export async function gitlabReferenceSummaries(
  get: JsonGet,
  projectApi: string,
  queries: readonly ReferenceQuery[]
): Promise<ReferenceSummary[]> {
  const read = async (path: string, sigil: ReferenceSigil, extra: string): Promise<Map<number, GlItem | Reason>> => {
    const iids = queries.filter((q) => q.sigil === sigil).map((q) => q.id)
    const out = new Map<number, GlItem | Reason>()
    // A page holds at most 100: ask in pages of that many ids, so none is cut off.
    for (let i = 0; i < iids.length; i += GL_PAGE) {
      const page = iids.slice(i, i + GL_PAGE)
      const qs = page.map((n) => `iids[]=${n}`).join('&')
      try {
        const items = await get<GlItem[]>(`${projectApi}/${path}?${qs}${extra}&per_page=${GL_PAGE}`)
        for (const it of Array.isArray(items) ? items : []) out.set(it.iid, it)
      } catch (err) {
        for (const n of page) out.set(n, reasonOf(err))
      }
    }
    return out
  }
  const [issues, mrs] = await Promise.all([read('issues', '#', ''), read('merge_requests', '!', '&state=all')])
  return queries.map((q) => {
    const it = q.sigil === '#' ? issues.get(q.id) : q.sigil === '!' ? mrs.get(q.id) : 'unreachable'
    if (!it) return unavailableReference(q, 'notFound')
    if (typeof it === 'string') return unavailableReference(q, it)
    return { ...q, available: true, kind: q.sigil === '!' ? 'mr' : 'issue', title: it.title, state: glState(it.state) }
  })
}

// ── Forgejo / Gitea ─────────────────────────────────────────────────────────

interface FjIssue {
  number: number
  title: string
  state: string
  pull_request?: { merged?: boolean } | null
}

/** `#12` through the issues endpoint, which also answers for pull requests. One request each. */
export async function forgejoReferenceSummaries(
  get: JsonGet,
  repoApi: string,
  queries: readonly ReferenceQuery[]
): Promise<ReferenceSummary[]> {
  const asked = queries.filter((q) => q.sigil === '#')
  const read = await readEach(asked, FORGEJO_CONCURRENCY, async (q) => {
    const issue = await get<FjIssue>(`${repoApi}/issues/${q.id}`)
    if (!issue || typeof issue.title !== 'string') return unavailableReference(q, 'notFound')
    const pr = !!issue.pull_request
    return {
      ...q,
      available: true,
      kind: pr ? 'pr' : 'issue',
      title: issue.title,
      state: pr && issue.pull_request?.merged ? 'merged' : issue.state === 'closed' ? 'closed' : 'open'
    }
  })
  return byQuery(queries, read)
}
