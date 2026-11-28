/**
 * Which lines of `draft` differ from `original` — the edit-commit editor tints
 * them, so what you changed stays visible while you keep typing.
 *
 * The common head and tail are dropped first (an edit usually touches a few
 * lines in the middle). The rest is matched line by line with an LCS; when
 * that middle is too big to match on every keystroke, all of it is marked —
 * a broader tint is better than a frozen editor.
 */

/** Above this many cells (middle lines × middle lines) the LCS is skipped. */
const LCS_CELLS_MAX = 250_000

export function getChangedLines(original: string, draft: string): Set<number> {
  const changed = new Set<number>()
  if (original === draft) return changed
  const a = original.split('\n')
  const b = draft.split('\n')

  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++

  const midA = a.slice(head, a.length - tail)
  const midB = b.slice(head, b.length - tail)
  if (midB.length === 0) return changed // only deletions: nothing left to tint

  if (midA.length * midB.length > LCS_CELLS_MAX) {
    for (let i = 0; i < midB.length; i++) changed.add(head + i)
    return changed
  }

  // LCS table from the end, so the walk below goes forward.
  const n = midA.length
  const m = midB.length
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  let i = 0
  let j = 0
  while (j < m) {
    if (i < n && midA[i] === midB[j]) {
      i++
      j++
    } else if (i < n && lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++
    } else {
      changed.add(head + j)
      j++
    }
  }
  return changed
}
