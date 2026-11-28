// The PR list page's changed-file counts for Azure DevOps, whose list carries
// no size: which rows to ask main about, and how the answers join the rows.
// Counts are keyed by PR and head commit, so a push never shows the count of
// the commits before it.
import type { PrFileCountRequest } from '../../../shared/types'
import type { PrListItem } from './prList'

/** The key a count is kept under, in the page and in main's cache. */
export const getPrFileCountKey = (id: number, headSha: string): string => `${id}:${headSha.toLowerCase()}`

/**
 * The rows still without a size that can be asked about: on the repository's
 * own remote (an upstream row is another repository), with a head commit, not
 * asked already (`asked` holds keys). In the order given — the order drawn.
 */
export function getPrFileCountRequests(items: readonly PrListItem[], asked: ReadonlySet<string>): PrFileCountRequest[] {
  const out: PrFileCountRequest[] = []
  const seen = new Set<string>()
  for (const { pr, upstream } of items) {
    if (upstream || !pr.headSha || typeof pr.changedFiles === 'number') continue
    const key = getPrFileCountKey(pr.id, pr.headSha)
    if (asked.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push({ id: pr.id, headSha: pr.headSha })
  }
  return out
}

/** Main's answer (count by id) as page keys, for the requests it answered. */
export function toPrFileCountMap(
  requests: readonly PrFileCountRequest[],
  answer: Record<number, number>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const req of requests) {
    const n = answer[req.id]
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0) out[getPrFileCountKey(req.id, req.headSha)] = n
  }
  return out
}

/**
 * The rows with their counts in. A row without one is handed back as it came —
 * the same object — and the list itself when no row changed, so the memos
 * downstream do not see a new list for nothing.
 */
export function withPrFileCounts(items: PrListItem[], counts: Record<string, number>): PrListItem[] {
  let changed = false
  const out = items.map((it) => {
    const { pr } = it
    if (it.upstream || !pr.headSha || typeof pr.changedFiles === 'number') return it
    const n = counts[getPrFileCountKey(pr.id, pr.headSha)]
    if (n === undefined) return it
    changed = true
    return { ...it, pr: { ...pr, changedFiles: n } }
  })
  return changed ? out : items
}
