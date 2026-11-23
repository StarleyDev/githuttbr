/** What the app knows about a repository the moment it becomes the active one. */
export interface TerminalAutoOpenInput {
  /** The active repository, or null when a page, a group landing or nothing is showing. */
  repoPath: string | null
  /** `openTerminalOnRepoOpen` from settings. */
  enabled: boolean
  /** Whether the repository has finished its first load and is a git repository on disk. */
  ready: boolean
}

/**
 * Whether the active repository's terminal should open now. Each repository
 * gets one automatic open per session — `claimed` is the session's record —
 * so closing the terminal sticks across tab switches until the next launch.
 *
 * A repository still loading is not claimed yet: it may turn out to be a
 * missing folder or not a git repository, where no terminal pane exists. A
 * repository first seen while the setting is off is claimed all the same;
 * switching the setting on later applies to the repositories opened after it.
 */
export function claimTerminalAutoOpen(claimed: Set<string>, input: TerminalAutoOpenInput): boolean {
  const { repoPath, enabled, ready } = input
  if (!repoPath || !ready || claimed.has(repoPath)) return false
  claimed.add(repoPath)
  return enabled
}

/**
 * The one-time 4.40 move of the terminal to the center. Earlier builds saved
 * every setting, so most installs carry an explicit 'bottom' that is really
 * just the old default; the product now defaults to 'center' and moves those
 * once. After that the marker is set and whatever the user picks stays put.
 */
export function applyTerminalCenterDefault<
  T extends { terminalPlacement: 'bottom' | 'center' | 'right'; terminalCenterApplied?: boolean }
>(settings: T): T {
  if (settings.terminalCenterApplied) return settings
  return {
    ...settings,
    terminalPlacement: settings.terminalPlacement === 'bottom' ? 'center' : settings.terminalPlacement,
    terminalCenterApplied: true
  }
}
