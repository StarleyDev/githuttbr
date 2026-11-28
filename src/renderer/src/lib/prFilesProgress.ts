import type { PrFile } from '../../../shared/types'
import { buildFileTree, getVisibleTreeRows } from './fileTree'

/** Which files the Files tab lists: every one, those not viewed yet, or those with review conversations. */
export type PrFileFilter = 'all' | 'unviewed' | 'commented'

export function filterPrFiles(
  files: PrFile[],
  filter: PrFileFilter,
  viewed: ReadonlySet<string>,
  threadCounts: ReadonlyMap<string, number>
): PrFile[] {
  if (filter === 'unviewed') return files.filter((f) => !viewed.has(f.filename))
  if (filter === 'commented') return files.filter((f) => (threadCounts.get(f.filename) ?? 0) > 0)
  return files
}

/**
 * The files in the order the list draws them: the host's order as paths, or
 * the tree's order (folders first, as the tree sorts them) — so "next" means
 * the next row down, whatever the view. Folded folders count: the walk opens them.
 */
export function getPrFileOrder(files: PrFile[], view: 'path' | 'tree'): string[] {
  if (view !== 'tree') return files.map((f) => f.filename)
  const rows = getVisibleTreeRows(buildFileTree(files, (f) => f.filename), new Set<string>())
  return rows.flatMap((r) => (r.node.file ? [r.node.file.filename] : []))
}

/**
 * The nearest file not viewed yet after `current` (direction 1) or before it
 * (direction -1), wrapping round the list; null when every other file is viewed.
 */
export function getUnviewedFile(
  order: readonly string[],
  viewed: ReadonlySet<string>,
  current: string,
  direction: 1 | -1
): string | null {
  const at = order.indexOf(current)
  // Not in the list (filtered out): start just outside it, so step 1 lands on an end.
  const from = at === -1 ? (direction === 1 ? -1 : order.length) : at
  for (let step = 1; step <= order.length; step++) {
    const name = order[(((from + direction * step) % order.length) + order.length) % order.length]
    if (name !== current && !viewed.has(name)) return name
  }
  return null
}

/** The first file after `current` not viewed yet, wrapping round to the top; null when every file is viewed. */
export function getNextUnviewedFile(
  order: readonly string[],
  viewed: ReadonlySet<string>,
  current: string
): string | null {
  return getUnviewedFile(order, viewed, current, 1)
}
