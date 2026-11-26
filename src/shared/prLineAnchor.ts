import type { PrLineAnchor, PrLineSide } from './types'

/**
 * The rules every host agrees on for a line comment, kept in one place so main
 * (which posts it) and the renderer (which draws threads on lines) cannot
 * disagree: a deleted line lives in the old file, everything else in the new.
 */

/** The side a line belongs to: deleted lines are the old (left) side. */
export function getAnchorSide(anchor: Pick<PrLineAnchor, 'kind'>): PrLineSide {
  return anchor.kind === 'del' ? 'old' : 'new'
}

/** The one line number a single-sided host wants: the old line for a deletion, else the new one. */
export function getAnchorLine(anchor: PrLineAnchor): number {
  return (anchor.kind === 'del' ? anchor.oldLine : anchor.newLine) ?? 0
}

const isLine = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0

/**
 * Whether an anchor off the IPC boundary is one a host can be asked to post on:
 * a path, a known kind, and the numbers that kind carries. A context line has
 * both; an added line only the new, a deleted line only the old.
 */
export function isValidLineAnchor(value: unknown): value is PrLineAnchor {
  if (!value || typeof value !== 'object') return false
  const a = value as Record<string, unknown>
  if (typeof a.path !== 'string' || !a.path.trim()) return false
  if (a.oldPath !== undefined && (typeof a.oldPath !== 'string' || !a.oldPath.trim())) return false
  if (a.kind === 'add') return isLine(a.newLine) && a.oldLine == null
  if (a.kind === 'del') return isLine(a.oldLine) && a.newLine == null
  if (a.kind === 'ctx') return isLine(a.oldLine) && isLine(a.newLine)
  return false
}
