/**
 * The decisions behind a version switch's lifecycle in the updater, pure so
 * they can be tested without electron-updater (`test/rollbackDecisions.test.ts`).
 *
 * The one that matters most: electron-updater checks a cancellation token only
 * while bytes are moving. A cancel that lands after the last byte still lets it
 * rename the file and register it to install on quit — and the older version
 * would then replace the app silently, with no rollback record behind it. So
 * any download that lands for a switch no longer running is "abandoned":
 * installing on quit stays off until a normal update replaces it.
 */

/** Who a finished download belongs to. */
export type DownloadOwner =
  /** The switch in progress. */
  | 'rollback'
  /** A switch cancelled (or ended) while its transfer was still settling. */
  | 'abandoned'
  /** The normal update. */
  | 'update'

export interface DownloadLanded {
  /** Where the event goes: the switch's state, nowhere, or the update banner. */
  route: 'rollback' | 'drop' | 'update'
  /** The new value of "an abandoned download is on disk", or null to leave it. */
  abandoned: boolean | null
  autoInstallOnAppQuit: boolean
}

export function downloadLanded(owner: DownloadOwner): DownloadLanded {
  // The switch's own download: installed only by `rollback:install`, once recorded.
  if (owner === 'rollback') return { route: 'rollback', abandoned: null, autoInstallOnAppQuit: false }
  if (owner === 'abandoned') return { route: 'drop', abandoned: true, autoInstallOnAppQuit: false }
  // A normal update replaces whatever was staged before it: installing on quit is safe again.
  return { route: 'update', abandoned: false, autoInstallOnAppQuit: true }
}

/** Ending a switch: a finished download left behind is abandoned; one cut short leaves nothing. */
export function switchEnded(
  status: 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error',
  abandonedBefore: boolean
): { abandoned: boolean; autoInstallOnAppQuit: boolean } {
  const abandoned = abandonedBefore || status === 'downloaded'
  return { abandoned, autoInstallOnAppQuit: !abandoned }
}

/**
 * A cancel: while a transfer may still be settling (`checking` covers the
 * settings copy and the feed check too), its trailing events are drained and
 * the normal feed is checked once it settles; otherwise at once.
 */
export function cancelPlan(status: 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error'): {
  drain: boolean
  recheckNow: boolean
} {
  const inFlight = status === 'checking' || status === 'downloading'
  return { drain: inFlight, recheckNow: !inFlight }
}
