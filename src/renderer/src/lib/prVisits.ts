import { remoteWebUrl } from './autolink'
import { useSettingsStore } from '../stores/settings'

/**
 * "New since your last visit" for pull requests: when each PR page was last
 * left, and which items came after that.
 *
 * The API is four functions:
 *
 * - `getPrVisitKey(remoteUrl, number)` — the key of one pull request. The
 *   remote's identity, not its spelling: the ssh and https forms of one remote
 *   share a key.
 * - `getLastVisit(key)` — when that page was last left (ms), or null for a
 *   first visit. Read it once when the page opens and keep it: the marker must
 *   stay put while the user reads.
 * - `recordVisit(key, at)` — when the page is left or closed, not when it opens,
 *   so what was new stays marked for the whole visit.
 * - `splitByLastVisit(items, lastVisit)` — pure: the items up to the last visit
 *   and the ones after it, for any list of `{ at }` in time order.
 *
 * The times live in the settings file (`prVisits`), so they survive a restart;
 * the map keeps only the `PR_VISITS_KEPT` most recent pull requests.
 */

/** How many pull requests remember their last visit. */
export const PR_VISITS_KEPT = 300

export function getPrVisitKey(remoteUrl: string, number: number): string {
  return `${(remoteWebUrl(remoteUrl) ?? remoteUrl).toLowerCase()}#${number}`
}

/** The last visit of `key` in a visits map; null when there is none or it is unreadable. */
export function getVisitFrom(visits: Record<string, number> | undefined, key: string): number | null {
  const at = visits?.[key]
  return typeof at === 'number' && Number.isFinite(at) && at > 0 ? at : null
}

/** The map with `key` visited at `at`, the oldest entries dropped past `kept`. */
export function withVisit(
  visits: Record<string, number> | undefined,
  key: string,
  at: number,
  kept = PR_VISITS_KEPT
): Record<string, number> {
  const entries = Object.entries(visits ?? {}).filter(([k, v]) => k !== key && typeof v === 'number')
  entries.push([key, at])
  entries.sort((a, b) => b[1] - a[1])
  return Object.fromEntries(entries.slice(0, kept))
}

/**
 * Items up to the last visit (`seen`) and after it (`fresh`). No last visit —
 * the first time the page is opened — is "nothing new": everything is seen,
 * or a first look would mark the whole conversation as new.
 */
export function splitByLastVisit<T extends { at: number }>(
  items: readonly T[],
  lastVisit: number | null
): { seen: T[]; fresh: T[] } {
  if (lastVisit === null) return { seen: [...items], fresh: [] }
  const seen: T[] = []
  const fresh: T[] = []
  for (const item of items) (item.at > lastVisit ? fresh : seen).push(item)
  return { seen, fresh }
}

export function getLastVisit(key: string): number | null {
  return getVisitFrom(useSettingsStore.getState().settings.prVisits, key)
}

export function recordVisit(key: string, at: number): void {
  useSettingsStore.getState().update((s) => ({ ...s, prVisits: withVisit(s.prVisits, key, at) }))
}
