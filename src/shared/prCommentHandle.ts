import type { PrCommentHandle } from './types'

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0

/**
 * An edited comment's text as sent: the blank lines around it dropped, and
 * nothing else — leading spaces open an indented code block and two trailing
 * spaces are a line break, so trimming would change what the comment says.
 */
export function stripOuterNewlines(text: string): string {
  return text.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/(?:\r?\n[ \t]*)+$/, '')
}

/** A handle the renderer sent is the shape main expects: it builds a URL from it. */
export function isValidCommentHandle(v: unknown): v is PrCommentHandle {
  if (!v || typeof v !== 'object') return false
  const h = v as Record<string, unknown>
  if (!isId(h.id)) return false
  if (h.kind !== 'conversation' && h.kind !== 'review') return false
  if (h.threadId !== undefined && !isId(h.threadId)) return false
  if (h.version !== undefined && !(typeof h.version === 'number' && Number.isSafeInteger(h.version) && h.version >= 0)) return false
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
