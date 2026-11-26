import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, CircleDot, Folder, FolderOpen, MessageSquare } from 'lucide-react'
import type { PrFile } from '../../../shared/types'
import { useSettingsStore } from '../stores/settings'
import {
  buildFileTree,
  expandFolderAncestors,
  getFolderTotals,
  getNextTreeFileIndex,
  getParentRowIndex,
  getVisibleTreeRows,
  saveCollapsedFolders,
  type FileTreeNode,
  type FileTreeRow,
  type FolderTotals
} from '../lib/fileTree'
import { ViewToggle } from './CommitComposer'
import { useT, interp } from '../i18n'
import { sumThreadCounts } from '../lib/prFileThreads'

type PrTreeNode = FileTreeNode<PrFile>

// Folders collapsed per pull request, kept in memory while the app runs: the
// Files tab unmounts on every tab switch, and coming back should not reopen
// every folder the reviewer had already folded away. Capped, see saveCollapsedFolders.
const collapsedByPr = new Map<string, Set<string>>()
const COLLAPSED_PRS_KEPT = 50

/** The review conversations on a file or folder, as a small speech-bubble count. */
function ThreadBadge({ count }: { count: number }): React.JSX.Element | null {
  const t = useT()
  if (count <= 0) return null
  const label = interp(t('prPage.fileThreads'), { n: count })
  return (
    <span className="prp-file-threads" title={label} aria-label={label}>
      <MessageSquare size={10} aria-hidden="true" />
      {count}
    </span>
  )
}

function getStatusLetter(status: string): string {
  return status === 'added' ? 'A' : status === 'removed' ? 'D' : status === 'renamed' ? 'R' : 'M'
}

const NO_TOTALS: FolderTotals<PrFile> = { additions: 0, deletions: 0, files: [] }

const indentOf = (level: number): number => 4 + (level - 1) * 14

const FileRow = memo(function FileRow({
  file,
  label,
  level,
  index,
  isSelected,
  isViewed,
  isChanged,
  threadCount,
  onSelectFile,
  onSetFilesViewed
}: {
  file: PrFile
  label: string
  level: number
  index: number
  isSelected: boolean
  isViewed: boolean
  /** Ticked once, then changed by a push: not viewed any more. */
  isChanged: boolean
  /** Review conversations on this file. */
  threadCount: number
  onSelectFile: (filename: string) => void
  onSetFilesViewed: (filenames: string[], viewed: boolean) => void
}): React.JSX.Element {
  const t = useT()
  return (
    <div
      className={`prd-file prp-file-row ${isSelected ? 'selected' : ''} ${isViewed ? 'viewed' : ''}`}
      data-file-path={file.filename}
      data-row-index={index}
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
      {isChanged && (
        <span
          className="prp-file-changed"
          title={t('prPage.changedSinceViewed')}
          aria-label={t('prPage.changedSinceViewed')}
        >
          <CircleDot size={10} aria-hidden="true" />
        </span>
      )}
      <ThreadBadge count={threadCount} />
      <span className="prd-file-stat">
        <span className="ins-add">+{file.additions}</span> <span className="ins-del">−{file.deletions}</span>
      </span>
    </div>
  )
})

const FolderRow = memo(function FolderRow({
  node,
  level,
  index,
  isCollapsed,
  totals,
  viewedCount,
  threadCount,
  onToggleFolder,
  onSetFilesViewed
}: {
  node: PrTreeNode
  level: number
  index: number
  isCollapsed: boolean
  totals: FolderTotals<PrFile>
  viewedCount: number
  /** Review conversations across the folder's files. */
  threadCount: number
  onToggleFolder: (path: string) => void
  onSetFilesViewed: (filenames: string[], viewed: boolean) => void
}): React.JSX.Element {
  const t = useT()
  const total = totals.files.length
  const allViewed = viewedCount === total
  const checkLabel = interp(t(allViewed ? 'prPage.unmarkFolderViewed' : 'prPage.markFolderViewed'), {
    folder: node.name
  })
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
      data-folder-path={node.path}
      data-row-index={index}
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
        }
      }}
    >
      <input
        type="checkbox"
        ref={checkRef}
        checked={allViewed}
        title={checkLabel}
        aria-label={checkLabel}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onSetFilesViewed(totals.files.map((f) => f.filename), !allViewed)}
      />
      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
      <span className="prd-file-name prp-folder-name">{node.name}</span>
      <span
        className="prp-folder-viewed"
        title={interp(t('prPage.folderViewed'), { viewed: viewedCount, total })}
      >
        {viewedCount}/{total}
      </span>
      <ThreadBadge count={threadCount} />
      <span className="prd-file-stat">
        <span className="ins-add">+{totals.additions}</span>{' '}
        <span className="ins-del">−{totals.deletions}</span>
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
  changedSinceViewed,
  threadCounts,
  selected,
  prKey,
  onSelectFile,
  onSetFilesViewed,
  onRowContextMenu,
  initialScroll = 0,
  onListScroll
}: {
  files: PrFile[]
  viewed: Set<string>
  /** Ticked once, changed by a push since. */
  changedSinceViewed: Set<string>
  /** Review conversations per file path (getThreadCountsByPath). */
  threadCounts: ReadonlyMap<string, number>
  /** The filename whose diff is open. */
  selected: string
  /** Identifies the pull request, to remember its collapsed folders. */
  prKey: string
  onSelectFile: (filename: string) => void
  onSetFilesViewed: (filenames: string[], viewed: boolean) => void
  /** A right click on a file or folder row: its path, and whether it is a folder. */
  onRowContextMenu?: (x: number, y: number, row: { path: string; isDir: boolean }) => void
  /** Where the list was scrolled when the page was last left (lib/prViewState.ts). */
  initialScroll?: number
  onListScroll?: (top: number) => void
}): React.JSX.Element {
  const t = useT()
  const view = useSettingsStore((s) => s.settings.fileListView ?? 'path')
  const listRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Back where it was: once, after the rows are drawn; a shorter list clamps.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || initialScroll <= 0) return
    requestAnimationFrame(() => {
      el.scrollTop = Math.max(0, Math.min(initialScroll, el.scrollHeight - el.clientHeight))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => collapsedByPr.get(prKey) ?? new Set())
  useEffect(() => {
    saveCollapsedFolders(collapsedByPr, prKey, collapsed, COLLAPSED_PRS_KEPT)
  }, [prKey, collapsed])

  const tree = useMemo(() => (view === 'tree' ? buildFileTree(files, (f) => f.filename) : []), [view, files])
  const totals = useMemo(() => getFolderTotals(tree, (f) => f), [tree])
  const viewedByFolder = useMemo(() => {
    const out = new Map<string, number>()
    for (const [path, sum] of totals) {
      out.set(path, sum.files.reduce((n, f) => n + (viewed.has(f.filename) ? 1 : 0), 0))
    }
    return out
  }, [totals, viewed])
  const threadsByFolder = useMemo(() => {
    const out = new Map<string, number>()
    for (const [path, sum] of totals) out.set(path, sumThreadCounts(threadCounts, sum.files.map((f) => f.filename)))
    return out
  }, [totals, threadCounts])
  const rows = useMemo<FileTreeRow<PrFile>[]>(
    () =>
      view === 'tree'
        ? getVisibleTreeRows(tree, collapsed)
        : files.map((f) => ({
            node: { name: f.filename, path: f.filename, children: [], file: f },
            level: 1
          })),
    [view, tree, collapsed, files]
  )

  // A file selected while its folder is folded (arrow keys skip folded rows,
  // but the first file opens on its own) unfolds the way down to it.
  useEffect(() => {
    if (selected) setCollapsed((cur) => expandFolderAncestors(cur, selected))
  }, [selected])

  const toggleFolder = useCallback(
    (path: string) =>
      setCollapsed((cur) => {
        const next = new Set(cur)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      }),
    []
  )
  // Only files count, and only those still in the pull request.
  const viewedCount = useMemo(
    () => files.reduce((n, f) => n + (viewed.has(f.filename) ? 1 : 0), 0),
    [files, viewed]
  )

  const focusRow = (index: number): void => {
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
      el?.focus({ preventScroll: true })
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  // The tree pattern, shaped like the other file lists: Up/Down (and j/k) walk
  // the visible files from the focused row — a folder or a file's checkbox
  // included — opening each and taking the focus along; Left folds a folder or
  // climbs to the parent, Right unfolds.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const target = e.target as HTMLElement
    const typing =
      target.tagName === 'TEXTAREA' ||
      (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox')
    if (typing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
    const rowEl = target.closest<HTMLElement>('[data-row-index]')
    const at = rowEl
      ? Number(rowEl.dataset.rowIndex)
      : rows.findIndex((r) => r.node.file?.filename === selected)
    const row = rows[at]
    const dir = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0
    if (dir) {
      e.preventDefault()
      const next = getNextTreeFileIndex(rows, at, dir)
      const file = rows[next]?.node.file
      if (!file) return
      onSelectFile(file.filename)
      focusRow(next)
    } else if (e.key === 'ArrowLeft' && row) {
      e.preventDefault()
      if (!row.node.file && !collapsed.has(row.node.path)) toggleFolder(row.node.path)
      else {
        const parent = getParentRowIndex(rows, at)
        if (parent >= 0) focusRow(parent)
      }
    } else if (e.key === 'ArrowRight' && row && !row.node.file && collapsed.has(row.node.path)) {
      e.preventDefault()
      toggleFolder(row.node.path)
    }
  }

  return (
    <div
      className="prp-file-list"
      ref={scrollRef}
      onScroll={onListScroll ? (e) => onListScroll(e.currentTarget.scrollTop) : undefined}
      onContextMenu={
        onRowContextMenu
          ? (e) => {
              const row = (e.target as HTMLElement).closest<HTMLElement>('[data-file-path], [data-folder-path]')
              if (!row) return
              e.preventDefault()
              const file = row.dataset.filePath
              onRowContextMenu(e.clientX, e.clientY, { path: file ?? row.dataset.folderPath ?? '', isDir: file === undefined })
            }
          : undefined
      }
    >
      <div className="prp-file-list-head">
        <span className="prd-section-title">
          {interp(t('prDetail.filesViewed'), { n: `${viewedCount}/${files.length}` })}
        </span>
        <ViewToggle />
      </div>
      <div role="tree" aria-label={t('prPage.filesTree')} ref={listRef} onKeyDown={onKeyDown}>
        {rows.map(({ node, level }, index) =>
          node.file ? (
            <FileRow
              key={`f-${node.path}`}
              file={node.file}
              label={view === 'tree' ? node.name : node.file.filename}
              level={level}
              index={index}
              isSelected={node.file.filename === selected}
              isViewed={viewed.has(node.file.filename)}
              isChanged={changedSinceViewed.has(node.file.filename)}
              threadCount={threadCounts.get(node.file.filename) ?? 0}
              onSelectFile={onSelectFile}
              onSetFilesViewed={onSetFilesViewed}
            />
          ) : (
            <FolderRow
              key={`d-${node.path}`}
              node={node}
              level={level}
              index={index}
              isCollapsed={collapsed.has(node.path)}
              totals={totals.get(node.path) ?? NO_TOTALS}
              viewedCount={viewedByFolder.get(node.path) ?? 0}
              threadCount={threadsByFolder.get(node.path) ?? 0}
              onToggleFolder={toggleFolder}
              onSetFilesViewed={onSetFilesViewed}
            />
          )
        )}
      </div>
    </div>
  )
})
