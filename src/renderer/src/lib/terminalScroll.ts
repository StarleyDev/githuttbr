// Pure decisions behind the terminal's scroll handling (terminalRegistry.ts),
// kept here so they can be tested without a DOM or a live xterm.

/** How long after the last gesture event the user still owns the viewport. */
export const GESTURE_WINDOW_MS = 500
/**
 * Retries of a deferred resync before giving up. A scrollbar drag that ends
 * outside the window can leave the drag flag set with no pointerup to clear
 * it; the cap stops the retry loop from polling forever in that case.
 */
export const RESYNC_MAX_RETRIES = 50

export interface ResyncInput {
  /** The host is attached and has a height. */
  visible: boolean
  bufferType: 'normal' | 'alternate'
  scrollbarDrag: boolean
  msSinceGesture: number
  anchorKind: 'bottom' | 'line'
  /** Deferred attempts already made for this resync. */
  retries: number
}

export type ResyncPlan =
  | { action: 'skip' }
  | { action: 'defer'; delayMs: number }
  | { action: 'restore'; to: 'bottom' | 'line' }

/**
 * What the post-resize viewport resync should do. Skips a hidden host and the
 * alternate screen (no scrollback: ydisp is 0 on both sides). Defers while a
 * gesture owns the viewport — it moves the scrollable element and the buffer
 * adopts its row, so the two are in step and the anchor is the gesture's —
 * and retries once the hand lets go, up to RESYNC_MAX_RETRIES. Otherwise
 * restores the anchor's kind.
 */
export function planViewportResync(input: ResyncInput): ResyncPlan {
  if (!input.visible || input.bufferType !== 'normal') return { action: 'skip' }
  const gestureLeft = GESTURE_WINDOW_MS - input.msSinceGesture
  if (input.scrollbarDrag || gestureLeft > 0) {
    if (input.retries >= RESYNC_MAX_RETRIES) return { action: 'skip' }
    return { action: 'defer', delayMs: Math.max(20, gestureLeft) }
  }
  return { action: 'restore', to: input.anchorKind }
}

/**
 * Whether a fit needs the resync at all: only a change of size reflows the
 * buffer, and a reattach may have left the element's offset behind while the
 * host was hidden. A fit that changed nothing leaves both positions in step.
 */
export function fitNeedsResync(
  before: { cols: number; rows: number },
  after: { cols: number; rows: number },
  reattached: boolean
): boolean {
  return reattached || before.cols !== after.cols || before.rows !== after.rows
}
