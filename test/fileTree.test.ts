import { describe, it, expect } from 'vitest'
import {
  buildFileTree,
  collectTreeFiles,
  expandFolderAncestors,
  getFolderTotals,
  getNextTreeFileIndex,
  getParentRowIndex,
  getVisibleTreeRows,
  saveCollapsedFolders,
  type FileTreeNode
} from '../src/renderer/src/lib/fileTree'
import { visiblePaths } from '../src/renderer/src/lib/fileNav'

interface F {
  path: string
  additions: number
  deletions: number
}
const f = (path: string, additions = 1, deletions = 0): F => ({ path, additions, deletions })
const FILES: F[] = [
  f('src/main/git.ts', 10, 2),
  f('src/main/ipc/pr.ts', 4, 1),
  f('src/renderer/src/components/PrFileList.tsx', 120, 0),
  f('README.md', 1, 1),
  f('docs/help/pull-requests.md', 6, 3),
  f('docs/help/pt-BR/pull-requests.md', 6, 3)
]
const shape = (nodes: FileTreeNode<F>[]): unknown[] =>
  nodes.map((n) => (n.file ? n.name : { [n.name]: shape(n.children) }))

describe('buildFileTree', () => {
  it('sorts folders before files and compresses single-child folder chains', () => {
    const tree = buildFileTree(FILES, (x) => x.path)
    expect(shape(tree)).toEqual([
      { 'docs/help': [{ 'pt-BR': ['pull-requests.md'] }, 'pull-requests.md'] },
      { src: [{ main: [{ ipc: ['pr.ts'] }, 'git.ts'] }, { 'renderer/src/components': ['PrFileList.tsx'] }] },
      'README.md'
    ])
  })

  it('gives a compressed folder the path of its deepest segment', () => {
    const tree = buildFileTree(FILES, (x) => x.path)
    expect(tree[0].path).toBe('docs/help')
    const renderer = tree[1].children[1]
    expect(renderer.name).toBe('renderer/src/components')
    expect(renderer.path).toBe('src/renderer/src/components')
  })

  it('keeps a lone file under its folder instead of folding it into the name', () => {
    const tree = buildFileTree([f('a/b/c.ts')], (x) => x.path)
    expect(shape(tree)).toEqual([{ 'a/b': ['c.ts'] }])
  })

  it('tells a file from a folder of the same name', () => {
    // `lib` is a file in one commit and a folder in a rename's other side.
    const tree = buildFileTree([f('lib'), f('lib/x.ts')], (x) => x.path)
    expect(shape(tree)).toEqual([{ lib: ['x.ts'] }, 'lib'])
  })

  it('builds thousands of files in one folder without a quadratic search', () => {
    const many = Array.from({ length: 20000 }, (_, i) => f(`pkg/gen/file${i}.ts`))
    const started = performance.now()
    const tree = buildFileTree(many, (x) => x.path)
    expect(tree[0].children).toHaveLength(20000)
    expect(performance.now() - started).toBeLessThan(2000)
  })

  it('feeds the keyboard order the file lists already use', () => {
    const tree = buildFileTree(FILES, (x) => x.path)
    expect(visiblePaths(tree, new Set(['src/main']))).toEqual([
      'docs/help/pt-BR/pull-requests.md',
      'docs/help/pull-requests.md',
      'src/renderer/src/components/PrFileList.tsx',
      'README.md'
    ])
  })
})

describe('getVisibleTreeRows', () => {
  it('lists folders and files with their level, hiding what a collapsed folder holds', () => {
    const tree = buildFileTree(FILES, (x) => x.path)
    const rows = getVisibleTreeRows(tree, new Set(['src']))
    expect(rows.map((r) => [r.node.name, r.level])).toEqual([
      ['docs/help', 1],
      ['pt-BR', 2],
      ['pull-requests.md', 3],
      ['pull-requests.md', 2],
      ['src', 1],
      ['README.md', 1]
    ])
  })
})

describe('getFolderTotals', () => {
  it('sums line counts and lists the files under every folder', () => {
    const tree = buildFileTree(FILES, (x) => x.path)
    const totals = getFolderTotals(tree, (x) => x)
    expect(totals.get('src')).toMatchObject({ additions: 134, deletions: 3 })
    expect(totals.get('src')?.files.map((x) => x.path)).toEqual([
      'src/main/ipc/pr.ts',
      'src/main/git.ts',
      'src/renderer/src/components/PrFileList.tsx'
    ])
    expect(totals.get('src/main/ipc')).toMatchObject({ additions: 4, deletions: 1 })
    expect(totals.get('docs/help')?.files).toHaveLength(2)
    // Files are not folders.
    expect(totals.has('README.md')).toBe(false)
  })

  it('agrees with collectTreeFiles', () => {
    const tree = buildFileTree(FILES, (x) => x.path)
    expect(getFolderTotals(tree, (x) => x).get('src')?.files).toEqual(collectTreeFiles(tree[1]))
  })
})

describe('expandFolderAncestors', () => {
  it('opens every collapsed folder above the file and leaves the others', () => {
    const collapsed = new Set(['src', 'src/main', 'docs/help'])
    expect([...expandFolderAncestors(collapsed, 'src/main/git.ts')]).toEqual(['docs/help'])
  })

  it('returns the same set when nothing above the file is collapsed', () => {
    const collapsed = new Set(['docs/help'])
    expect(expandFolderAncestors(collapsed, 'src/main/git.ts')).toBe(collapsed)
  })

  it('does not treat a name prefix as a parent folder', () => {
    const collapsed = new Set(['src/ma'])
    expect(expandFolderAncestors(collapsed, 'src/main/git.ts')).toBe(collapsed)
  })
})

describe('tree keyboard steps', () => {
  // docs/help(0) pt-BR(1) pull-requests.md(2) pull-requests.md(3) src(4, folded) README.md(5)
  const rows = getVisibleTreeRows(buildFileTree(FILES, (x) => x.path), new Set(['src']))

  it('steps from a folder into its first file, skipping folders on the way', () => {
    expect(getNextTreeFileIndex(rows, 0, 1)).toBe(2)
    expect(getNextTreeFileIndex(rows, 3, 1)).toBe(5)
    expect(getNextTreeFileIndex(rows, 4, -1)).toBe(3)
    expect(getNextTreeFileIndex(rows, 2, -1)).toBe(-1)
    expect(getNextTreeFileIndex(rows, 5, 1)).toBe(-1)
  })

  it('enters at the top or the bottom with no anchor', () => {
    expect(getNextTreeFileIndex(rows, -1, 1)).toBe(2)
    expect(getNextTreeFileIndex(rows, -1, -1)).toBe(5)
  })

  it('climbs from a row to the folder holding it', () => {
    expect(getParentRowIndex(rows, 2)).toBe(1)
    expect(getParentRowIndex(rows, 3)).toBe(0)
    expect(getParentRowIndex(rows, 1)).toBe(0)
    expect(getParentRowIndex(rows, 5)).toBe(-1)
  })
})

describe('saveCollapsedFolders', () => {
  it('forgets an empty set and keeps only the newest entries', () => {
    const memory = new Map<string, Set<string>>()
    saveCollapsedFolders(memory, 'pr1', new Set(['src']), 2)
    saveCollapsedFolders(memory, 'pr2', new Set(['docs']), 2)
    // Saving pr1 again makes it the newest, so pr2 is the one dropped next.
    saveCollapsedFolders(memory, 'pr1', new Set(['src', 'lib']), 2)
    saveCollapsedFolders(memory, 'pr3', new Set(['a']), 2)
    expect([...memory.keys()]).toEqual(['pr1', 'pr3'])
    saveCollapsedFolders(memory, 'pr3', new Set(), 2)
    expect([...memory.keys()]).toEqual(['pr1'])
  })
})
