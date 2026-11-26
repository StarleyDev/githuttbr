import type { PrCommentHandle } from './types'

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0

/** A handle the renderer sent is the shape main expects: it builds a URL from it. */
export function isValidCommentHandle(v: unknown): v is PrCommentHandle {
  if (!v || typeof v !== 'object') return false
  const h = v as Record<string, unknown>
  if (!isId(h.id)) return false
  if (h.kind !== 'conversation' && h.kind !== 'review') return false
  if (h.threadId !== undefined && !isId(h.threadId)) return false
  if (h.version !== undefined && !(typeof h.version === 'number' && Number.isInteger(h.version) && h.version >= 0)) return false
  return true
}

/**
 * Whether a comment was changed after it was posted, from the two dates its
 * host keeps. A second of slack: some hosts stamp the two a moment apart on
 * creation. An unreadable date says nothing.
 */
export function isEditedAfter(created: string | number | null | undefined, updated: string | number | null | undefined): boolean {
  if (created == null || updated == null) return false
  const a = new Date(created).getTime()
  const b = new Date(updated).getTime()
  return Number.isFinite(a) && Number.isFinite(b) && b - a > 1000
}
