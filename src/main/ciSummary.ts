import type { CiCounts, CiStatus } from '../shared/types'

/**
 * A head commit's checks counted per outcome, for the PR list's one-line
 * summary — "3 passed · 1 failing". Counts, not words: main has no language, so
 * the renderer spells them out (`lib/ciCounts.ts`). One function for every
 * host, so GitHub and Bitbucket Data Center rows read alike.
 */
export function countChecks(status: CiStatus): CiCounts {
  const out: CiCounts = { passed: 0, failed: 0, pending: 0, skipped: 0, cancelled: 0, unknown: 0 }
  for (const j of status.jobs) {
    if (j.state === 'success') out.passed++
    else if (j.state === 'failure') out.failed++
    else if (j.state === 'pending') out.pending++
    else if (j.neutralAs === 'cancelled') out.cancelled++
    else if (j.neutralAs === 'unknown') out.unknown++
    else out.skipped++
  }
  return out
}
