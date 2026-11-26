import type { HostingProvider, ReferenceQuery, ReferenceSigil, ReferenceSummary } from '../../../shared/types'
import { remoteWebUrl } from './autolink'
import { azureOrgOf } from './workItem'

/**
 * The `#12`, `!12` and `AB#12` references in commit and comment text, and the
 * in-memory cache of what their hosts say about them. Pure: no React, no IPC —
 * components/ReferenceLink.tsx does the asking.
 */

/** One reference's cache key within a repository: `AB#12`, `#12`, `!12`. */
export const getReferenceKey = (q: ReferenceQuery): string => `${q.sigil}${q.id}`

/** Where the host is, as far as reading references goes. */
export interface ReferenceHost {
  /** Azure DevOps: `#12` is a work item, the same one as `AB#12`. */
  azure: boolean
  /** GitLab: `!12` is a merge request. */
  gitlab: boolean
}

/**
 * The host of a remote, for references — or null where none has a card:
 * Bitbucket has no issue API the app reads, and an unknown remote nothing to ask.
 * `provider` is what the PR list found, when it has run; the URL decides otherwise.
 */
export function getReferenceHost(remoteUrl: string | undefined, provider: HostingProvider | undefined): ReferenceHost | null {
  const web = remoteWebUrl(remoteUrl)
  if (!web) return null
  let host = ''
  try {
    host = new URL(web).hostname.toLowerCase()
  } catch {
    return null
  }
  if (provider === 'bitbucket' || (!provider && host.includes('bitbucket'))) return null
  return {
    azure: provider === 'azure' || !!azureOrgOf(web),
    gitlab: provider === 'gitlab' || (!provider && host.includes('gitlab'))
  }
}

// `AB#` first, so its `#12` is not read on its own; `!` only after a non-word.
const REFERENCE = /(\bAB#(\d+))|(\B!(\d+))|(#(\d+))/g

/**
 * The references in `text`, in order, without repeats. On Azure a bare `#12` is
 * asked as `AB#12` (the same work item, one cache entry); `!12` counts only on
 * GitLab.
 */
export function extractReferences(text: string, host: ReferenceHost): ReferenceQuery[] {
  const out: ReferenceQuery[] = []
  const seen = new Set<string>()
  const add = (sigil: ReferenceSigil, raw: string): void => {
    const id = Number(raw)
    if (!Number.isSafeInteger(id) || id <= 0) return
    const q = { sigil, id }
    const key = getReferenceKey(q)
    if (seen.has(key)) return
    seen.add(key)
    out.push(q)
  }
  for (const m of text.matchAll(REFERENCE)) {
    if (m[2]) add('AB#', m[2])
    else if (m[4]) {
      if (host.gitlab) add('!', m[4])
    } else if (m[6]) add(host.azure ? 'AB#' : '#', m[6])
  }
  return out
}

/** A piece of a line: plain text, or an `AB#12` written as such (`id` set). */
export interface WorkItemSegment {
  text: string
  id?: number
}

/**
 * A line split around its `AB#12` mentions — for a list that shows a work
 * item's title beside it. Only the explicit `AB#` form: a bare `#12` there is
 * as likely to be "Merged PR 12" as a work item.
 */
export function splitWorkItemMentions(text: string): WorkItemSegment[] {
  const out: WorkItemSegment[] = []
  let last = 0
  for (const m of text.matchAll(/\bAB#(\d+)/g)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: text.slice(last, at) })
    out.push({ text: m[0], id: Number(m[1]) })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** "Not there" for each query — what a failed request, or an id the answer left out, caches. */
export function unavailableSummaries(queries: readonly ReferenceQuery[]): ReferenceSummary[] {
  return queries.map((q) => ({ sigil: q.sigil, id: q.id, available: false }))
}

/** A cached answer is kept this long; a "not there" one for less, so a fix shows soon. */
export const REFERENCE_TTL_MS = 5 * 60_000
export const REFERENCE_UNAVAILABLE_TTL_MS = 60_000
/** Most references one hover asks for. Hosts without a batch read cost one request each. */
export const REFERENCE_REQUEST_MAX = 50
/** Azure's batch read takes 200 work items in one request. */
export const AZURE_REQUEST_MAX = 200

/** Per repository, per reference: the summary and when it was read. */
export class ReferenceCache {
  private readonly entries = new Map<string, { summary: ReferenceSummary; at: number }>()

  constructor(private readonly now: () => number = Date.now) {}

  private key(scope: string, q: ReferenceQuery): string {
    return `${scope}\n${getReferenceKey(q)}`
  }

  /** The summary, while it is fresh; undefined once it has expired or was never read. */
  getSummary(scope: string, q: ReferenceQuery): ReferenceSummary | undefined {
    const e = this.entries.get(this.key(scope, q))
    if (!e) return undefined
    const ttl = e.summary.available ? REFERENCE_TTL_MS : REFERENCE_UNAVAILABLE_TTL_MS
    if (this.now() - e.at >= ttl) {
      this.entries.delete(this.key(scope, q))
      return undefined
    }
    return e.summary
  }

  saveSummaries(scope: string, summaries: readonly ReferenceSummary[]): void {
    const at = this.now()
    for (const s of summaries) this.entries.set(this.key(scope, s), { summary: s, at })
  }

  /** Forget everything — for tests, and a profile switch. */
  clearSummaries(): void {
    this.entries.clear()
  }
}

/**
 * What one request should ask for: the reference in front of the user first,
 * then the others on the page the cache has no fresh answer for, skipping those
 * already on their way, up to `max`.
 */
export function pickReferenceBatch(
  first: ReferenceQuery | null,
  visible: Iterable<ReferenceQuery>,
  isKnown: (q: ReferenceQuery) => boolean,
  max = REFERENCE_REQUEST_MAX
): ReferenceQuery[] {
  const out: ReferenceQuery[] = []
  const seen = new Set<string>()
  for (const q of first ? [first, ...visible] : visible) {
    if (out.length >= max) break
    const key = getReferenceKey(q)
    if (seen.has(key)) continue
    seen.add(key)
    if (!isKnown(q)) out.push(q)
  }
  return out
}
