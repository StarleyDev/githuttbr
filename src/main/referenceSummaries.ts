import type { ReferenceQuery, ReferenceSigil, ReferenceSummary } from '../shared/types'
import { mapAzureWorkItems } from './azurePr'

/**
 * Titles for the `#12`, `!12` and `AB#12` references in commit messages and
 * comments — what the hover card on such a link shows. Every function takes a
 * `get` that already carries the repository's credential (hosting.ts builds it
 * from the profile the repository is bound to), so nothing here sees a token.
 *
 * A reference the host does not have, or will not show this account, comes back
 * `available: false`: one deleted issue must not cost the other cards.
 */

export type JsonGet = <T>(url: string) => Promise<T>

/** Most references one call answers. Azure's batch read takes 200 ids at once. */
export const REFERENCE_BATCH_MAX = 200
/** Hosts with no batch read are asked one item at a time, this many at once. */
const PER_ITEM_CONCURRENCY = 6

const SIGILS: readonly ReferenceSigil[] = ['#', '!', 'AB#']

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

export const unavailableReference = (q: ReferenceQuery): ReferenceSummary => ({ sigil: q.sigil, id: q.id, available: false })

/** Run `fn` over `items`, at most `limit` at a time, keeping their order. */
async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
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
  for (let i = 0; i < ids.length; i += REFERENCE_BATCH_MAX) {
    const chunk = ids.slice(i, i + REFERENCE_BATCH_MAX)
    const res = await get<{ value?: Array<{ id: number; fields?: Record<string, unknown> } | null> }>(
      `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workitems?ids=${chunk.join(',')}` +
        `&fields=${AZ_FIELDS}&errorPolicy=omit&api-version=7.1`
    ).catch(() => null)
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
    const hit = q.sigil === '!' ? undefined : found.get(q.id)
    return hit ? { ...hit, sigil: q.sigil } : unavailableReference(q)
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
 * so each is one request — the renderer asks only for what is on screen.
 */
export async function githubReferenceSummaries(
  get: JsonGet,
  repoApi: string,
  queries: readonly ReferenceQuery[]
): Promise<ReferenceSummary[]> {
  return mapLimited(queries, PER_ITEM_CONCURRENCY, async (q) => {
    if (q.sigil !== '#') return unavailableReference(q)
    const issue = await get<GhIssue>(`${repoApi}/issues/${q.id}`).catch(() => null)
    if (!issue || typeof issue.title !== 'string') return unavailableReference(q)
    const pr = !!issue.pull_request
    return {
      ...q,
      available: true,
      kind: pr ? 'pr' : 'issue',
      title: issue.title,
      state: pr && issue.pull_request?.merged_at ? 'merged' : issue.state === 'closed' ? 'closed' : 'open'
    }
  })
}

// ── GitLab ──────────────────────────────────────────────────────────────────

interface GlItem {
  iid: number
  title: string
  state: string
}

const GL_PAGE = 100

const glState =(s: string): ReferenceSummary['state'] => (s === 'merged' ? 'merged' : s === 'closed' ? 'closed' : 'open')

/**
 * `#12` is an issue and `!12` a merge request; both list endpoints filter by
 * `iids[]`, so each kind is one request however many are asked.
 */
export async function gitlabReferenceSummaries(
  get: JsonGet,
  projectApi: string,
  queries: readonly ReferenceQuery[]
): Promise<ReferenceSummary[]> {
  const read = async (path: string, sigil: ReferenceSigil): Promise<Map<number, GlItem>> => {
    const iids = queries.filter((q) => q.sigil === sigil).map((q) => q.id)
    const out = new Map<number, GlItem>()
    // A page holds at most 100: ask in pages of that many ids, so none is cut off.
    for (let i = 0; i < iids.length; i += GL_PAGE) {
      const qs = iids
        .slice(i, i + GL_PAGE)
        .map((n) => `iids[]=${n}`)
        .join('&')
      const items = await get<GlItem[]>(`${projectApi}/${path}?${qs}&state=all&per_page=${GL_PAGE}`).catch(() => [])
      for (const it of Array.isArray(items) ? items : []) out.set(it.iid, it)
    }
    return out
  }
  const [issues, mrs] = await Promise.all([read('issues', '#'), read('merge_requests', '!')])
  return queries.map((q) => {
    const it = q.sigil === '#' ? issues.get(q.id) : q.sigil === '!' ? mrs.get(q.id) : undefined
    if (!it) return unavailableReference(q)
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
  return mapLimited(queries, PER_ITEM_CONCURRENCY, async (q) => {
    if (q.sigil !== '#') return unavailableReference(q)
    const issue = await get<FjIssue>(`${repoApi}/issues/${q.id}`).catch(() => null)
    if (!issue || typeof issue.title !== 'string') return unavailableReference(q)
    const pr = !!issue.pull_request
    return {
      ...q,
      available: true,
      kind: pr ? 'pr' : 'issue',
      title: issue.title,
      state: pr && issue.pull_request?.merged ? 'merged' : issue.state === 'closed' ? 'closed' : 'open'
    }
  })
}
