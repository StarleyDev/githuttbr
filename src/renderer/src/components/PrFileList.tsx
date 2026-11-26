import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import type { PrFile } from '../../../shared/types'
import { useSettingsStore } from '../stores/settings'
import { stepPath } from '../lib/fileNav'
import {
  buildFileTree,
  expandFolderAncestors,
  getFolderTotals,
  getVisibleTreeRows,
  type FileTreeNode,
  type FileTreeRow,
  type FolderTotals
} from '../lib/fileTree'
import { ViewToggle } from './CommitComposer'
import { useT, interp } from '../i18n'

type PrTreeNode = FileTreeNode<PrFile>

// Folders collapsed per pull request, kept in memory while the app runs: the
// Files tab unmounts on every tab switch, and coming back should not reopen
// every folder the reviewer had already folded away.
const collapsedByPr = new Map<string, Set<string>>()

function getStatusLetter(status: string): string {
  return status === 'added' ? 'A' : status === 'removed' ? 'D' : status === 'renamed' ? 'R' : 'M'
}

const NO_TOTALS: FolderTotals<PrFile> = { additions: 0, deletions: 0, files: [] }

const indentOf = (level: number): number => 4 + (level - 1) * 14

const FileRow = memo(function FileRow({
  file,
  label,
  level,
  isSelected,
  isViewed,
  onSelectFile,
  onSetFilesViewed
}: {
  file: PrFile
  label: string
  level: number
  isSelected: boolean
  isViewed: boolean
  onSelectFile: (filename: string) => void
  onSetFilesViewed: (filenames: string[], viewed: boolean) => void
}): React.JSX.Element {
  const t = useT()
  return (
    <div
      className={`prd-file prp-file-row ${isSelected ? 'selected' : ''} ${isViewed ? 'viewed' : ''}`}
      data-file-path={file.filename}
      role="treeitem"
      aria-level={level}
      aria-selected={isSelected}
      tabIndex={0}
      style={{ paddingInlineStart: indentOf(level) }}
      onClick={() => onSelectFile(file.filename)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelectFile(file.filename)
        }
      }}
    >
      <input
        type="checkbox"
        checked={isViewed}
        title={t('prPage.markViewed')}
        aria-label={t('prPage.markViewed')}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onSetFilesViewed([file.filename], !isViewed)}
      />
      <span className={`prd-file-status st-${file.status}`} title={file.status}>
        {getStatusLetter(file.status)}
      </span>
      <span className="prd-file-name" title={file.filename}>
        {label}
      </span>
      <span className="prd-file-stat">
        <span className="ins-add">+{file.additions}</span> <span className="ins-del">−{file.deletions}</span>
      </span>
    </div>
  )
})

const FolderRow = memo(function FolderRow({
  node,
  level,
  isCollapsed,
  totals,
  viewedCount,
  onToggleFolder,
  onSetFilesViewed
}: {
  node: PrTreeNode
  level: number
  isCollapsed: boolean
  totals: FolderTotals<PrFile>
  viewedCount: number
  onToggleFolder: (path: string, open?: boolean) => void
  onSetFilesViewed: (filenames: string[], viewed: boolean) => void
}): React.JSX.Element {
  const t = useT()
  const total = totals.files.length
  const allViewed = viewedCount === total
  // A partly viewed folder shows the mixed state; ticking it finishes the job.
  const checkRef = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) el.indeterminate = viewedCount > 0 && !allViewed
    },
    [viewedCount, allViewed]
  )
  return (
    <div
      className={`prd-file prp-file-row prp-folder-row ${allViewed ? 'viewed' : ''}`}
      role="treeitem"
      aria-level={level}
      aria-expanded={!isCollapsed}
      tabIndex={0}
      style={{ paddingInlineStart: indentOf(level) }}
      title={node.path}
      onClick={() => onToggleFolder(node.path)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggleFolder(node.path)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          // The tree pattern: Left folds, Right unfolds — the list's Up/Down
          // stay for moving between files.
          e.preventDefault()
          e.stopPropagation()
          onToggleFolder(node.path, e.key === 'ArrowRight')
        }
      }}
    >
      <input
        type="checkbox"
        ref={checkRef}
        checked={allViewed}
        title={interp(t('prPage.markFolderViewed'), { folder: node.name })}
        aria-label={interp(t('prPage.markFolderViewed'), { folder: node.name })}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onSetFilesViewed(totals.files.map((f) => f.filename), !allViewed)}
      />
      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
      <span className="prd-file-name prp-folder-name">{node.name}</span>
      <span className="prp-folder-viewed" title={interp(t('prPage.folderViewed'), { viewed: viewedCount, total })}>
        {viewedCount}/{total}
      </span>
      <span className="prd-file-stat">
        <span className="ins-add">+{totals.additions}</span> <span className="ins-del">−{totals.deletions}</span>
      </span>
    </div>
  )
})

/**
 * A pull request's changed files, as full paths or as a folder tree (the
 * app-wide `fileListView` setting). Its own component, memoized, so folding a
 * folder or switching the view re-renders this list and never the diff beside it.
 */
export const PrFileList = memo(function PrFileList({
  files,
  viewed,
  selected,
  prKey,
  onSelectFile,
  onSetFilesViewed
}: {
  files: PrFile[]
  viewed: Set<string>
  /** The filename whose diff is open. */
  selected: string
  /** Identifies the pull request, to remember its collapsed folders. */
  prKey: string
  onSelectFile: (filename: string) => void
  onSetFilesViewed: (filenames: string[], viewed: boolean) => void
}): React.JSX.Element {
  const t = useT()
  const view = useSettingsStore((s) => s.settings.fileListView ?? 'path')
  const listRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => collapsedByPr.get(prKey) ?? new Set())
  useEffect(() => {
    collapsedByPr.set(prKey, collapsed)
  }, [prKey, collapsed])

  const tree = useMemo(() => (view === 'tree' ? buildFileTree(files, (f) => f.filename) : []), [view, files])
  const totals = useMemo(() => getFolderTotals(tree, (f) => f), [tree])
  const viewedByFolder = useMemo(() => {
    const out = new Map<string, number>()
    for (const [path, sum] of totals) out.set(path, sum.files.reduce((n, f) => n + (viewed.has(f.filename) ? 1 : 0), 0))
    return out
  }, [totals, viewed])
  const rows = useMemo<FileTreeRow<PrFile>[]>(
    () =>
      view === 'tree'
        ? getVisibleTreeRows(tree, collapsed)
        : files.map((f) => ({ node: { name: f.filename, path: f.filename, children: [], file: f }, level: 1 })),
    [view, tree, collapsed, files]
  )

  // A file selected while its folder is folded (arrow keys skip folded rows,
  // but the first file opens on its own) unfolds the way down to it.
  useEffect(() => {
    if (selected) setCollapsed((cur) => expandFolderAncestors(cur, selected))
  }, [selected])

  const toggleFolder = useCallback(
    (path: string, open?: boolean) =>
      setCollapsed((cur) => {
        const isOpen = !cur.has(path)
        if (open !== undefined && open === isOpen) return cur
        const next = new Set(cur)
        if (isOpen) next.add(path)
        else next.delete(path)
        return next
      }),
    []
  )

  // Up/Down (and j/k) walk the visible files like the other file lists do,
  // and take the focus along so Enter and Space act on the row in view.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
    const dir = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const order = rows.flatMap((r) => (r.node.file ? [r.node.file.filename] : []))
    const next = stepPath(order, selected, dir)
    if (!next) return
    onSelectFile(next)
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-file-path="${CSS.escape(next)}"]`)
      el?.focus({ preventScroll: true })
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  return (
    <div className="prp-file-list">
      <div className="prp-file-list-head">
        <span className="prd-section-title">
          {interp(t('prDetail.filesViewed'), { n: `${viewed.size}/${files.length}` })}
        </span>
        <ViewToggle />
      </div>
      <div role="tree" aria-label={t('prPage.filesTree')} ref={listRef} onKeyDown={onKeyDown}>
        {rows.map(({ node, level }) =>
          node.file ? (
            <FileRow
              key={`f-${node.path}`}
              file={node.file}
              label={view === 'tree' ? node.name : node.file.filename}
              level={level}
              isSelected={node.file.filename === selected}
              isViewed={viewed.has(node.file.filename)}
              onSelectFile={onSelectFile}
              onSetFilesViewed={onSetFilesViewed}
            />
          ) : (
            <FolderRow
              key={`d-${node.path}`}
              node={node}
              level={level}
              isCollapsed={collapsed.has(node.path)}
              totals={totals.get(node.path) ?? NO_TOTALS}
              viewedCount={viewedByFolder.get(node.path) ?? 0}
              onToggleFolder={toggleFolder}
              onSetFilesViewed={onSetFilesViewed}
            />
          )
        )}
      </div>
    </div>
  )
})
