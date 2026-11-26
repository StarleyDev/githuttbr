// The branch cleanup's rules, kept out of the dialog so they can be tested
// against plain data: which reasons a branch has, which rows are listed, which
// are ticked when the dialog opens, and what the confirm has to warn about.
//
// The main process reports facts (gone, merged, last commit, unique commits);
// everything that depends on a choice the user makes lives here.

import type {
  BranchCleanupCandidate,
  BranchDeleteRequest,
  BranchDeleteResult,
  BranchRestoreRequest
} from '../../../shared/types'

export type CleanupReason = 'gone' | 'merged' | 'stale'

export interface CleanupRow {
  branch: BranchCleanupCandidate
  reasons: CleanupReason[]
  /** Commits that would exist nowhere once the branch is gone. */
  risky: boolean
  /** Ticked when the dialog opens. */
  recommended: boolean
}

export const DEFAULT_STALE_MONTHS = 3

/** The newest commit date that still counts as stale, `months` calendar months before `now`. */
export function getStaleCutoff(now: number, months: number): number {
  const d = new Date(now)
  d.setMonth(d.getMonth() - Math.max(1, Math.floor(months)))
  return d.getTime()
}

/** The reasons a branch is a cleanup candidate, in display order. */
export function getCleanupReasons(branch: BranchCleanupCandidate, staleCutoff: number): CleanupReason[] {
  const reasons: CleanupReason[] = []
  if (branch.gone) reasons.push('gone')
  if (branch.merged) reasons.push('merged')
  if (branch.lastCommitAt > 0 && branch.lastCommitAt < staleCutoff) reasons.push('stale')
  return reasons
}

/**
 * Ticked on open: gone or merged, and nothing to lose. Stale alone is only a
 * date — never a reason to delete without looking. A branch sitting exactly on
 * the default branch's tip is merged in git's eyes, but it is far more often
 * one somebody just created and has not committed on yet.
 */
export function isCleanupRecommended(branch: BranchCleanupCandidate, reasons: CleanupReason[]): boolean {
  if (branch.uniqueCommits > 0) return false
  if (branch.atMainTip && !branch.gone) return false
  return reasons.includes('gone') || reasons.includes('merged')
}

const ORDER: Record<CleanupReason, number> = { gone: 0, merged: 1, stale: 2 }

/**
 * The rows the dialog lists: every gone or merged branch, plus stale ones when
 * the stale filter is on. Recommended rows first, then by name.
 */
export function getCleanupRows(
  candidates: BranchCleanupCandidate[],
  opts: { now: number; staleMonths: number; includeStale: boolean }
): CleanupRow[] {
  const cutoff = getStaleCutoff(opts.now, opts.staleMonths)
  const rows: CleanupRow[] = []
  for (const branch of candidates) {
    const reasons = getCleanupReasons(branch, cutoff)
    const listed = reasons.some((r) => r !== 'stale') || (opts.includeStale && reasons.includes('stale'))
    if (!listed) continue
    rows.push({ branch, reasons, risky: branch.uniqueCommits > 0, recommended: isCleanupRecommended(branch, reasons) })
  }
  return rows.sort(
    (a, b) =>
      Number(b.recommended) - Number(a.recommended) ||
      ORDER[a.reasons[0]] - ORDER[b.reasons[0]] ||
      a.branch.name.localeCompare(b.branch.name)
  )
}

/** The ticks the dialog opens with. */
export function getDefaultCleanupSelection(rows: CleanupRow[]): Set<string> {
  return new Set(rows.filter((r) => r.recommended).map((r) => r.branch.name))
}

/** Rows whose name contains every word of the query, case-insensitive. */
export function filterCleanupRows(rows: CleanupRow[], query: string): CleanupRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return rows
  return rows.filter((r) => {
    const name = r.branch.name.toLowerCase()
    return words.every((w) => name.includes(w))
  })
}

/**
 * What gets sent to the main process for the ticked rows still listed. A row
 * with commits of its own is forced, because ticking it and passing the
 * stronger confirm is the explicit choice the main process asks for.
 */
export function getDeleteRequests(rows: CleanupRow[], selected: Set<string>): BranchDeleteRequest[] {
  return rows
    .filter((r) => selected.has(r.branch.name))
    .map((r) => ({ name: r.branch.name, sha: r.branch.sha, force: r.risky }))
}

export interface CleanupConfirmSummary {
  count: number
  /** Branches whose commits exist only here, with how many. */
  risky: { name: string; commits: number; capped: boolean }[]
  riskyCommits: number
}

/** What the confirm dialog has to say: how many go, and what is lost with them. */
export function getCleanupConfirmSummary(rows: CleanupRow[], selected: Set<string>): CleanupConfirmSummary {
  const chosen = rows.filter((r) => selected.has(r.branch.name))
  const risky = chosen
    .filter((r) => r.risky)
    .map((r) => ({ name: r.branch.name, commits: r.branch.uniqueCommits, capped: r.branch.uniqueCapped }))
  return { count: chosen.length, risky, riskyCommits: risky.reduce((n, r) => n + r.commits, 0) }
}

/** Every deleted branch, as the undo has to recreate it. */
export function getRestoreRequests(results: BranchDeleteResult[]): BranchRestoreRequest[] {
  return results
    .filter((r) => r.status === 'deleted')
    .map((r) => ({
      name: r.name,
      sha: r.sha,
      ...(r.upstreamRemote ? { upstreamRemote: r.upstreamRemote } : {}),
      ...(r.upstreamMerge ? { upstreamMerge: r.upstreamMerge } : {})
    }))
}

/** How a cleanup came out, for the toast. */
export function tallyDeleteResults(results: BranchDeleteResult[]): { deleted: number; refused: number; failed: number } {
  let deleted = 0
  let refused = 0
  let failed = 0
  for (const r of results) {
    if (r.status === 'deleted') deleted++
    else if (r.status === 'refused') refused++
    else failed++
  }
  return { deleted, refused, failed }
}
