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

/** The first file after `current` not viewed yet, wrapping round to the top; null when every file is viewed. */
export function getNextUnviewedFile(
  order: readonly string[],
  viewed: ReadonlySet<string>,
  current: string
): string | null {
  const at = order.indexOf(current)
  for (let step = 1; step <= order.length; step++) {
    const name = order[(at + step + order.length) % order.length]
    if (!viewed.has(name)) return name
  }
  return null
}
