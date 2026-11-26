/** The folder tree behind every "Tree" file list (commit files, WIP, stashes,
 *  a pull request's files). Kept free of React so the shape can be unit-tested
 *  and shared: each list differs only in what a leaf carries. */

export interface FileTreeNode<T> {
  /** The label shown — a compressed folder run reads `src/main`. */
  name: string
  /** Full path; for a compressed folder, the path of its deepest segment. */
  path: string
  children: FileTreeNode<T>[]
  /** Set on leaves — folders have none. */
  file?: T
}

/** Fold flat paths into a sorted folder tree: folders before files, each by
 *  name, and single-child folder chains compressed into one row (`a/b/c`),
 *  stopping before a file so a lone file still sits under its folder. */
export function buildFileTree<T>(items: T[], pathOf: (item: T) => string): FileTreeNode<T>[] {
  const root: FileTreeNode<T> = { name: '', path: '', children: [] }
  // Indexed by kind + full path: a linear search per segment would make a
  // PR with thousands of files in one folder quadratic.
  const index = new Map<string, FileTreeNode<T>>()
  for (const item of items) {
    const parts = pathOf(item).split('/')
    let node = root
    let acc = ''
    for (let i = 0; i < parts.length; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]
      const isLeaf = i === parts.length - 1
      const key = `${isLeaf ? 'f' : 'd'}:${acc}`
      let child = index.get(key)
      if (!child) {
        child = { name: parts[i], path: acc, children: [], file: isLeaf ? item : undefined }
        index.set(key, child)
        node.children.push(child)
      }
      node = child
    }
  }
  const compress = (node: FileTreeNode<T>): FileTreeNode<T> => {
    while (!node.file && node.children.length === 1 && !node.children[0].file) {
      const only = node.children[0]
      node = { ...only, name: node.name ? `${node.name}/${only.name}` : only.name }
    }
    return { ...node, children: node.children.map(compress) }
  }
  const sortNodes = (nodes: FileTreeNode<T>[]): FileTreeNode<T>[] =>
    [...nodes]
      .sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name))
      .map((n) => ({ ...n, children: sortNodes(n.children) }))
  return sortNodes(root.children.map(compress))
}

/** Every file under a node, in tree order — the scope of a folder-wide action. */
export function collectTreeFiles<T>(node: FileTreeNode<T>, out: T[] = []): T[] {
  if (node.file !== undefined) out.push(node.file)
  for (const c of node.children) collectTreeFiles(c, out)
  return out
}

export interface FileTreeRow<T> {
  node: FileTreeNode<T>
  /** 1-based, as `aria-level` wants it. */
  level: number
}

/** The rows on screen, top to bottom: a collapsed folder shows, its subtree
 *  does not. A flat array lets a long list render rows that memoize one by one. */
export function getVisibleTreeRows<T>(
  nodes: FileTreeNode<T>[],
  collapsed: Set<string>,
  level = 1,
  out: FileTreeRow<T>[] = []
): FileTreeRow<T>[] {
  for (const node of nodes) {
    out.push({ node, level })
    if (!node.file && !collapsed.has(node.path)) getVisibleTreeRows(node.children, collapsed, level + 1, out)
  }
  return out
}

/** The collapsed set with every folder holding `filePath` opened, so a file
 *  selected from elsewhere is on screen. Returns the same set when nothing was
 *  collapsed above it, so a state setter can bail out without a re-render. */
export function expandFolderAncestors(collapsed: Set<string>, filePath: string): Set<string> {
  let next: Set<string> | null = null
  for (const folder of collapsed) {
    if (filePath.startsWith(`${folder}/`)) {
      next ??= new Set(collapsed)
      next.delete(folder)
    }
  }
  return next ?? collapsed
}

export interface FolderTotals<T> {
  additions: number
  deletions: number
  /** Every file under the folder, in tree order. */
  files: T[]
}

/** Each folder's summed line counts and the files under it, keyed by folder
 *  path — one pass over the tree, so a folder row never walks its subtree. */
export function getFolderTotals<T>(
  nodes: FileTreeNode<T>[],
  linesOf: (file: T) => { additions: number; deletions: number }
): Map<string, FolderTotals<T>> {
  const out = new Map<string, FolderTotals<T>>()
  const walk = (node: FileTreeNode<T>): FolderTotals<T> => {
    if (node.file !== undefined) {
      const { additions, deletions } = linesOf(node.file)
      return { additions, deletions, files: [node.file] }
    }
    const sum: FolderTotals<T> = { additions: 0, deletions: 0, files: [] }
    for (const child of node.children) {
      const c = walk(child)
      sum.additions += c.additions
      sum.deletions += c.deletions
      for (const f of c.files) sum.files.push(f)
    }
    out.set(node.path, sum)
    return sum
  }
  for (const n of nodes) walk(n)
  return out
}

/** The index of the next file row after `from` in direction `dir`, skipping
 *  folders; -1 when there is none. `from` may be a folder row (↓ from a folder
 *  enters its first file), or -1 for no anchor: Down enters at the top and Up
 *  at the bottom, like `stepPath`. */
export function getNextTreeFileIndex<T>(rows: FileTreeRow<T>[], from: number, dir: 1 | -1): number {
  let i = from === -1 ? (dir === 1 ? 0 : rows.length - 1) : from + dir
  for (; i >= 0 && i < rows.length; i += dir) if (rows[i].node.file !== undefined) return i
  return -1
}

/** The index of the folder row holding row `index` — the nearest row above it
 *  one level up — or -1 at the top level. */
export function getParentRowIndex<T>(rows: FileTreeRow<T>[], index: number): number {
  const level = rows[index]?.level ?? 1
  for (let i = index - 1; i >= 0; i--) if (rows[i].level === level - 1) return i
  return -1
}

/** Remember a list's collapsed folders under `key` in an in-memory map: an
 *  empty set is forgotten, a saved one becomes the newest, and past `cap`
 *  entries the oldest goes, so a long session does not hoard every PR seen. */
export function saveCollapsedFolders(
  memory: Map<string, Set<string>>,
  key: string,
  collapsed: Set<string>,
  cap: number
): void {
  memory.delete(key)
  if (collapsed.size === 0) return
  memory.set(key, collapsed)
  while (memory.size > cap) {
    const oldest = memory.keys().next().value
    if (oldest === undefined) break
    memory.delete(oldest)
  }
}
