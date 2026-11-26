import type { HostingProvider, ReferenceQuery, ReferenceSummary } from '../../../shared/types'
import { remoteWebUrl } from './autolink'
import { AB_REF, HASH_REF } from './referencePattern'
import { azureOrgOf } from './workItem'

/**
 * The `#12`, `!12` and `AB#12` references in commit and comment text: which
 * host reads them, and the in-memory cache of what it said. Pure: no React,
 * no IPC — components/ReferenceLink.tsx does the asking.
 */

/** One reference's cache key within a scope: `AB#12`, `#12`, `!12`. */
export const getReferenceKey = (q: ReferenceQuery): string => `${q.sigil}${q.id}`

/** Where the host is, as far as reading references goes. */
export interface ReferenceHost {
  /** Azure DevOps: `#12` is a work item, the same one as `AB#12`. */
  azure: boolean
  /** GitLab: `!12` is a merge request. */
  gitlab: boolean
  /** GitHub or GitHub Enterprise Server: one GraphQL request reads a page of references. */
  github: boolean
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
    gitlab: provider === 'gitlab' || (!provider && host.includes('gitlab')),
    github: provider === 'github' || (!provider && host.includes('github'))
  }
}

/** A piece of a line: plain text, or a work item mention (`id` set). */
export interface WorkItemSegment {
  text: string
  id?: number
}

const WORK_ITEM = new RegExp(`${AB_REF}|${HASH_REF}`, 'g')

/**
 * An Azure DevOps line split around its work item mentions — `AB#12`, and `#12`,
 * which in an Azure repository is the same work item (autolink links it so) —
 * for a list that shows each title beside its mention.
 */
export function splitWorkItemMentions(text: string): WorkItemSegment[] {
  const out: WorkItemSegment[] = []
  let last = 0
  for (const m of text.matchAll(WORK_ITEM)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: text.slice(last, at) })
    out.push({ text: m[0], id: Number(m[1] ?? m[2]) })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** "Could not read" for each query — what a failed request, or an id the answer left out, caches. */
export function unavailableSummaries(
  queries: readonly ReferenceQuery[],
  reason: NonNullable<ReferenceSummary['reason']> = 'unreachable'
): ReferenceSummary[] {
  return queries.map((q) => ({ sigil: q.sigil, id: q.id, available: false, reason }))
}

/** An answer is fresh this long. */
export const REFERENCE_TTL_MS = 5 * 60_000
/** "Not found" or "not reached" is asked again sooner, so a fixed permission or network shows. */
export const REFERENCE_UNAVAILABLE_TTL_MS = 60_000
/** A throttled host is left alone for as long as a good answer is kept. */
export const REFERENCE_RATE_LIMITED_TTL_MS = 5 * 60_000
/**
 * Most references one hover asks for, on a host that reads them one request
 * each (Forgejo; GitHub when GraphQL fails): the one hovered and its
 * neighbours on screen.
 */
export const REFERENCE_REQUEST_MAX = 10
/** Azure's batch read takes 200 work items in one request. */
export const AZURE_REQUEST_MAX = 200
/**
 * GitHub reads fifty in one GraphQL request (main/referenceSummaries.ts). Should
 * GraphQL fail, REST reads only the first ten — nearest first — and the rest
 * are asked again later.
 */
export const GITHUB_REQUEST_MAX = 50

/** Most references one request asks this host for. */
export function getReferenceRequestMax(host: ReferenceHost): number {
  if (host.azure) return AZURE_REQUEST_MAX
  if (host.github) return GITHUB_REQUEST_MAX
  return REFERENCE_REQUEST_MAX
}
/** Entries kept before the oldest are dropped. */
const CACHE_MAX = 2000

const ttlOf = (s: ReferenceSummary): number =>
  s.available ? REFERENCE_TTL_MS : s.reason === 'rateLimited' ? REFERENCE_RATE_LIMITED_TTL_MS : REFERENCE_UNAVAILABLE_TTL_MS

/**
 * Per scope (repository, remote and the profile that reads it), per reference:
 * the summary and when it was read. An expired answer is still served — a
 * title does not vanish from a list after five minutes — but reads as stale,
 * so the next hover or prefetch asks again (stale-while-revalidate).
 */
export class ReferenceCache {
  private readonly entries = new Map<string, { summary: ReferenceSummary; at: number }>()

  constructor(private readonly now: () => number = Date.now) {}

  private key(scope: string, q: ReferenceQuery): string {
    return `${scope}\n${getReferenceKey(q)}`
  }

  /** The last answer, fresh or not; undefined when it was never read. */
  getSummary(scope: string, q: ReferenceQuery): ReferenceSummary | undefined {
    return this.entries.get(this.key(scope, q))?.summary
  }

  /** Whether the last answer is still within its TTL — false when there is none. */
  isFresh(scope: string, q: ReferenceQuery): boolean {
    const e = this.entries.get(this.key(scope, q))
    return !!e && this.now() - e.at < ttlOf(e.summary)
  }

  saveSummaries(scope: string, summaries: readonly ReferenceSummary[]): void {
    const at = this.now()
    for (const s of summaries) {
      const key = this.key(scope, s)
      // Re-inserted, so the size cap drops the least recently read first.
      this.entries.delete(key)
      this.entries.set(key, { summary: s, at })
    }
    // Map order is insertion order: the first keys are the oldest.
    while (this.entries.size > CACHE_MAX) this.entries.delete(this.entries.keys().next().value as string)
  }
}

/**
 * What one request should ask for: the reference in front of the user first,
 * then the others on the page with no fresh answer, skipping those already on
 * their way, up to `max`.
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

/**
 * The visible references nearest the one hovered — those registered just
 * before and after it, in page order — so a capped batch reads what the eye
 * goes to next rather than whatever mounted first.
 */
export function orderByNearness<T>(items: readonly T[], index: number): T[] {
  if (index < 0) return [...items]
  const out: T[] = []
  for (let d = 1; out.length < items.length - 1 && (index - d >= 0 || index + d < items.length); d++) {
    if (index + d < items.length) out.push(items[index + d])
    if (index - d >= 0) out.push(items[index - d])
  }
  return out
}
