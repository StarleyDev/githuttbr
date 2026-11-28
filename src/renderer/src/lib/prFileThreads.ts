import type { PrReviewThread } from '../../../shared/types'

/**
 * How many review conversations sit on each file of a pull request, keyed by
 * path. Outdated ones count too: they are still about that file, even when the
 * Files tab can no longer place them on a line.
 */
export function getThreadCountsByPath(threads: readonly PrReviewThread[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const th of threads) {
    if (!th.path) continue
    counts.set(th.path, (counts.get(th.path) ?? 0) + 1)
  }
  return counts
}
