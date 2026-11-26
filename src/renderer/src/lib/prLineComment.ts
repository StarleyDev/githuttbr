import type { PrFile, PrLineAnchor, PrReviewThread } from '../../../shared/types'
import { getAnchorLine, getAnchorSide } from '../../../shared/prLineAnchor'
import type { DiffLine } from './diff'

/**
 * Lines of a PR file's diff ↔ the review threads on them. The diff is parsed by
 * `parseDiff` (lib/diff.ts), the same parse the viewer draws, so an index here
 * is an index there.
 */

/** Where a comment on this diff line is anchored — null for a hunk header or a meta line. */
export function getLineAnchor(line: DiffLine, file: Pick<PrFile, 'filename' | 'previousFilename'>): PrLineAnchor | null {
  if (line.kind !== 'add' && line.kind !== 'del' && line.kind !== 'ctx') return null
  // A line without the number its kind needs came from a patch that did not parse.
  if (line.kind !== 'add' && line.oldNo == null) return null
  if (line.kind !== 'del' && line.newNo == null) return null
  return {
    path: file.filename,
    ...(file.previousFilename && file.previousFilename !== file.filename ? { oldPath: file.previousFilename } : {}),
    kind: line.kind,
    oldLine: line.kind === 'add' ? null : line.oldNo,
    newLine: line.kind === 'del' ? null : line.newNo
  }
}

/**
 * The threads drawn under each line of one file's diff, by line index. A thread
 * is placed only when its host said which side its line counts on: on the old
 * side it matches a deleted or unchanged line by its old number, on the new
 * side an added or unchanged line by its new number.
 * A thread on a line outside the hunks shown (or outdated) is left out — it is
 * still in the Conversation tab.
 */
export function getThreadsByLine(
  threads: PrReviewThread[],
  file: Pick<PrFile, 'filename'>,
  lines: DiffLine[]
): Map<number, PrReviewThread[]> {
  const out = new Map<number, PrReviewThread[]>()
  const onFile = threads.filter((th) => th.path === file.filename && th.side && th.line != null)
  if (onFile.length === 0) return out
  const oldAt = new Map<number, number>()
  const newAt = new Map<number, number>()
  lines.forEach((l, i) => {
    // A context line is in both files: a host may anchor a thread on it by its old number.
    if ((l.kind === 'del' || l.kind === 'ctx') && l.oldNo != null) oldAt.set(l.oldNo, i)
    if ((l.kind === 'add' || l.kind === 'ctx') && l.newNo != null) newAt.set(l.newNo, i)
  })
  for (const th of onFile) {
    const idx = (th.side === 'old' ? oldAt : newAt).get(th.line as number)
    if (idx === undefined) continue
    out.set(idx, [...(out.get(idx) ?? []), th])
  }
  return out
}

/** Whether two anchors point at the same line of the same file. */
export function isSameAnchor(a: PrLineAnchor, b: PrLineAnchor): boolean {
  return a.path === b.path && getAnchorSide(a) === getAnchorSide(b) && getAnchorLine(a) === getAnchorLine(b)
}
