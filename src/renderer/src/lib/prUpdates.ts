import type { PrUpdate, PrUpdateEnd } from '../../../shared/types'
import type { TranslationKey } from '../i18n'

/**
 * The Updates tab's rules, without React or storage: which updates are new
 * since the last visit, what an update is called, and what "the changes in
 * this update" compare.
 */

/** The newest update the user has seen on a pull request: its id, and its date
 *  for when a host renumbers (GitHub's grouping is rebuilt on every read). */
export interface UpdatesSeenMark {
  id: string
  at: string
}

/**
 * The storage key of the mark — one per repo + PR. Its own key: no other data
 * shares it (the Files tab's viewed ticks live under `githuttbr-pr-viewed-marks:`).
 */
export function getUpdatesSeenKey(remoteUrl: string, number: number): string {
  return `githuttbr-pr-updates-seen:${remoteUrl}#${number}`
}

/** A mark from storage; anything unreadable is no mark at all. */
export function parseUpdatesSeenMark(raw: string | null): UpdatesSeenMark | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as { id?: unknown; at?: unknown }
    if (!d || typeof d.id !== 'string' || !d.id) return null
    return { id: d.id, at: typeof d.at === 'string' ? d.at : '' }
  } catch {
    return null
  }
}

/** The mark for having seen every update listed; null for an empty list. */
export function getNewestSeenMark(updates: readonly PrUpdate[]): UpdatesSeenMark | null {
  const last = updates[updates.length - 1]
  return last ? { id: last.id, at: last.createdAt } : null
}

/**
 * The updates newer than the one seen last. None without a mark: a first visit
 * has nothing to compare with. When the seen update is no longer listed (a
 * host that rebuilds its grouping, or a list capped past it), its date decides.
 */
export function getNewUpdateIds(updates: readonly PrUpdate[], seen: UpdatesSeenMark | null): Set<string> {
  if (!seen) return new Set()
  const at = updates.findIndex((u) => u.id === seen.id)
  if (at >= 0) return new Set(updates.slice(at + 1).map((u) => u.id))
  const since = Date.parse(seen.at)
  if (Number.isNaN(since)) return new Set()
  return new Set(updates.filter((u) => Date.parse(u.createdAt) > since).map((u) => u.id))
}

/** How the list counts: its newest update's number, and whether the start was cut off. */
export interface UpdateNumbering {
  newest: number
  startCut: boolean
}

export function getUpdateNumbering(updates: readonly PrUpdate[], startCut: boolean | undefined): UpdateNumbering {
  return { newest: updates[updates.length - 1]?.index ?? 0, startCut: !!startCut }
}

/**
 * The key and number of an update's heading. The opening push has its own
 * wording. When the host's record was cut before the opening, the numbers are
 * not the host's: the heading counts back from the latest instead.
 */
export function getUpdateTitle(
  update: Pick<PrUpdate, 'index' | 'kind'>,
  numbering: UpdateNumbering
): { key: TranslationKey; vars: Record<string, string> } {
  if (numbering.startCut) {
    const back = numbering.newest - update.index
    return back <= 0 ? { key: 'prUpdates.titleLatest', vars: {} } : { key: 'prUpdates.titleBefore', vars: { n: String(back) } }
  }
  return { key: update.kind === 'opened' ? 'prUpdates.titleOpened' : 'prUpdates.title', vars: { n: String(update.index) } }
}

/** What "View changes in this update" shows: the two ends, and what the older one is. */
export interface UpdateCompare {
  from: PrUpdateEnd
  to: PrUpdateEnd
  /** The update the changes run from; null when it is the merge base (the opening). */
  previousIndex: number | null
}

/**
 * The comparison for one update: from what it was pushed over to its head.
 * Null when either end is unknown — the host did not say — and the button is
 * not offered. Azure compares by iteration too: the previous one, or 0, which
 * it reads as the merge base.
 */
export function getUpdateCompare(update: PrUpdate): UpdateCompare | null {
  if (!update.headSha || !update.fromSha || update.headSha === update.fromSha) return null
  // The opening is compared with its merge base; any other update with the one before it.
  const isFirst = update.kind === 'opened'
  // Azure numbers its iterations 1, 2, 3…: the previous one is one less.
  const fromIteration = update.iteration !== undefined ? (isFirst ? 0 : update.iteration - 1) : undefined
  return {
    from: { sha: update.fromSha, ...(fromIteration !== undefined ? { iteration: fromIteration } : {}) },
    to: { sha: update.headSha, ...(update.iteration !== undefined ? { iteration: update.iteration } : {}) },
    previousIndex: isFirst ? null : update.index - 1
  }
}

/** The updates as the tab lists them: newest first. */
export function getUpdatesNewestFirst(updates: readonly PrUpdate[]): PrUpdate[] {
  return [...updates].reverse()
}
