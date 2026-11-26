// The branch cleanup's rules, kept out of the dialog so they can be tested
// against plain data: which reasons a branch has, which rows are listed, which
// are ticked when the dialog opens, and what the confirm has to warn about.
//
// The main process reports facts (gone, merged, last commit, unique commits,
// squash-merged on request); everything that depends on a choice the user
// makes lives here.

import type {
  BranchCleanupCandidate,
  BranchDeleteRequest,
  BranchDeleteResult,
  BranchRestoreRequest
} from '../../../shared/types'

export type CleanupReason = 'gone' | 'merged' | 'squash' | 'stale'

export interface CleanupRow {
  branch: BranchCleanupCandidate
  reasons: CleanupReason[]
  /** The default-branch ref holding its content as a squash merge, once checked. */
  squashedInto: string | null
  /** Commits that would exist nowhere once the branch is gone — and not squash-merged either. */
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
export function getCleanupReasons(
  branch: BranchCleanupCandidate,
  staleCutoff: number,
  squashedInto: string | null = null
): CleanupReason[] {
  const reasons: CleanupReason[] = []
  if (branch.gone) reasons.push('gone')
  if (branch.merged) reasons.push('merged')
  else if (squashedInto && branch.uniqueCommits > 0) reasons.push('squash')
  if (branch.lastCommitAt > 0 && branch.lastCommitAt < staleCutoff) reasons.push('stale')
  return reasons
}

/** Whether deleting the branch loses commits nothing else holds, content included. */
export function isCleanupRisky(branch: BranchCleanupCandidate, squashedInto: string | null): boolean {
  return branch.uniqueCommits > 0 && !squashedInto
}

/**
 * Ticked on open: gone, merged or squash-merged, and nothing to lose. Stale
 * alone is only a date — never a reason to delete without looking. A branch
 * sitting exactly on the default branch's tip is merged in git's eyes, but it
 * is far more often one somebody just created and has not committed on yet.
 */
export function isCleanupRecommended(
  branch: BranchCleanupCandidate,
  reasons: CleanupReason[],
  squashedInto: string | null = null
): boolean {
  if (isCleanupRisky(branch, squashedInto)) return false
  if (branch.atMainTip && !branch.gone) return false
  return reasons.includes('gone') || reasons.includes('merged') || reasons.includes('squash')
}

const ORDER: Record<CleanupReason, number> = { gone: 0, merged: 1, squash: 2, stale: 3 }

/**
 * The rows the dialog lists: every gone or merged branch, plus stale ones when
 * the stale filter is on. Recommended rows first, then by name. `squashed`
 * holds what the opt-in squash check found, branch name → ref.
 */
export function getCleanupRows(
  candidates: BranchCleanupCandidate[],
  opts: { now: number; staleMonths: number; includeStale: boolean; squashed?: Map<string, string> }
): CleanupRow[] {
  const cutoff = getStaleCutoff(opts.now, opts.staleMonths)
  const rows: CleanupRow[] = []
  for (const branch of candidates) {
    const squashedInto = opts.squashed?.get(branch.name) ?? null
    const reasons = getCleanupReasons(branch, cutoff, squashedInto)
    const listed = reasons.some((r) => r !== 'stale') || (opts.includeStale && reasons.includes('stale'))
    if (!listed) continue
    rows.push({
      branch,
      reasons,
      squashedInto,
      risky: isCleanupRisky(branch, squashedInto),
      recommended: isCleanupRecommended(branch, reasons, squashedInto)
    })
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

/**
 * The rows a "select all" may tick. Never a risky one: losing commits that
 * exist nowhere else takes a tick of its own, row by row.
 */
export function getBulkSelectableRows(rows: CleanupRow[]): CleanupRow[] {
  return rows.filter((r) => !r.risky)
}

/** The gone branches with commits of their own: what a squash check can clear. */
export function getSquashCheckNames(rows: CleanupRow[]): string[] {
  return rows.filter((r) => r.branch.gone && r.risky).map((r) => r.branch.name)
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
 * What gets sent to the main process for the ticked rows still listed. A risky
 * row carries the commit count the confirm showed, which is all the main
 * process will let go; a squash-merged one asks it to check the squash again.
 */
export function getDeleteRequests(rows: CleanupRow[], selected: Set<string>): BranchDeleteRequest[] {
  return rows
    .filter((r) => selected.has(r.branch.name))
    .map((r) => ({
      name: r.branch.name,
      sha: r.branch.sha,
      acceptedUnique: r.risky ? r.branch.uniqueCommits : 0,
      ...(r.squashedInto ? { squashMerged: true } : {})
    }))
}

export interface CleanupConfirmSummary {
  count: number
  /** Branches whose commits exist only here, with how many. */
  risky: { name: string; commits: number; capped: boolean }[]
  /**
   * A floor on the commits lost: the largest single branch. Stacked branches
   * share commits, so adding the counts up would overstate it.
   */
  riskyCommitsAtLeast: number
  /** Some branch stopped counting at the cap. */
  riskyCapped: boolean
  /** Squash-merged branches: their content is in the default branch, their commits are not. */
  squashed: number
  /** Ticked rows the list is not showing right now (filtered out, or past the rendered rows). */
  hidden: number
}

/** What the confirm dialog has to say: how many go, and what is lost with them. */
export function getCleanupConfirmSummary(
  rows: CleanupRow[],
  selected: Set<string>,
  visible: Set<string>
): CleanupConfirmSummary {
  const chosen = rows.filter((r) => selected.has(r.branch.name))
  const risky = chosen
    .filter((r) => r.risky)
    .map((r) => ({ name: r.branch.name, commits: r.branch.uniqueCommits, capped: r.branch.uniqueCapped }))
  return {
    count: chosen.length,
    risky,
    riskyCommitsAtLeast: risky.reduce((n, r) => Math.max(n, r.commits), 0),
    riskyCapped: risky.some((r) => r.capped),
    squashed: chosen.filter((r) => r.squashedInto).length,
    hidden: chosen.filter((r) => !visible.has(r.branch.name)).length
  }
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

/**
 * The deleted branches with the commit each pointed at, as `git branch -D`
 * prints them — the undo lives in memory only, so this is the record a user
 * can recreate a branch from by hand. At most `limit` entries, plus how many
 * more there were.
 */
export function getDeletedShaList(
  results: BranchDeleteResult[],
  limit = 5
): { entries: { branch: string; sha: string }[]; more: number } {
  const deleted = results.filter((r) => r.status === 'deleted')
  return {
    entries: deleted.slice(0, limit).map((r) => ({ branch: r.name, sha: r.sha.slice(0, 7) })),
    more: Math.max(0, deleted.length - limit)
  }
}
