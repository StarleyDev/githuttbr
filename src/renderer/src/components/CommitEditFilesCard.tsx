import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { FileEntry } from '../../../shared/types'
import { unifiedDiff } from '../../../shared/lineDiff'
import type { CommitEditFileDraft } from '../stores/ui'
import { gitApi } from '../infrastructure/api'
import { useT } from '../i18n'
import { guessLanguage } from '../lib/highlight'
import { filterEditableFiles } from '../lib/commitEditPanel'
import { CodeEditor } from './CodeEditor'
import { DiffViewer } from './DiffViewer'

type EditorMode = 'edit' | 'compare'

/** Whether an open file's buffer differs from what the commit holds. */
export function isFileDraftChanged(d: CommitEditFileDraft | undefined): boolean {
  return Boolean(d && !d.binary && !d.tooLarge && !d.missing && d.draft !== d.original)
}

/**
 * "Files of the commit" — the commit's files, the editor, the Edit / Compare
 * with original switch and "Add file", which opens a file of the commit's
 * snapshot the commit itself did not touch: once edited, the rewritten commit
 * changes it too.
 */
export function CommitEditFilesCard({
  repoPath,
  sha,
  files,
  added,
  drafts,
  selFile,
  editable,
  onSelectFile,
  onChangeDraft
}: {
  repoPath: string
  sha: string
  /** The files the commit changes, null until they have loaded. */
  files: FileEntry[] | null
  /** Files of the snapshot opened through "Add file", in the order they were added. */
  added: string[]
  drafts: Record<string, CommitEditFileDraft>
  selFile: string
  editable: boolean
  onSelectFile: (f: FileEntry) => void
  onChangeDraft: (path: string, draft: string) => void
}): React.JSX.Element {
  const t = useT()
  const [mode, setMode] = useState<EditorMode>('edit')
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [snapshot, setSnapshot] = useState<string[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // The snapshot's file list is only fetched once someone asks to add a file.
  useEffect(() => {
    if (!adding || snapshot) return
    let live = true
    gitApi
      .commitEditableFiles(repoPath, sha)
      .then((list) => live && setSnapshot(list))
      .catch(() => live && setSnapshot([]))
    return () => {
      live = false
    }
  }, [adding, snapshot, repoPath, sha])

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const listed = useMemo(() => new Set([...(files ?? []).map((f) => f.path), ...added]), [files, added])
  const matches = useMemo(
    () => (snapshot ? filterEditableFiles(snapshot, query, listed) : []),
    [snapshot, query, listed]
  )

  const addFile = (path: string): void => {
    setAdding(false)
    setQuery('')
    setMode('edit')
    onSelectFile({ path, status: 'M' })
  }

  const sel = drafts[selFile]
  // Hunks only, the shape the diff viewer reads for a host that sends no patch.
  const diff = useMemo(
    () => (mode === 'compare' && sel && !sel.binary && !sel.missing ? unifiedDiff(sel.original, sel.draft) : ''),
    [mode, sel]
  )

  const rows: { path: string; status: string; extra: boolean }[] = [
    ...(files ?? []).map((f) => ({ path: f.path, status: f.status, extra: false })),
    ...added.map((path) => ({ path, status: '+', extra: true }))
  ]

  return (
    <section className="commitedit-card commitedit-files-card">
      <header className="commitedit-card-head">
        <span>{t('commitEdit.filesCard')}</span>
        <span className="commitedit-card-spacer" />
        <span className="commitedit-seg" role="group" aria-label={t('commitEdit.filesCard')}>
          <button
            type="button"
            className={mode === 'edit' ? 'active' : ''}
            aria-pressed={mode === 'edit'}
            onClick={() => setMode('edit')}
          >
            {t('commitEdit.modeEdit')}
          </button>
          <button
            type="button"
            className={mode === 'compare' ? 'active' : ''}
            aria-pressed={mode === 'compare'}
            onClick={() => setMode('compare')}
          >
            {t('commitEdit.modeCompare')}
          </button>
        </span>
        <button
          type="button"
          className="commitedit-link"
          title={t('commitEdit.addFileTitle')}
          onClick={() => setAdding((a) => !a)}
          disabled={!editable}
        >
          <Plus size={12} aria-hidden="true" /> {t('commitEdit.addFile')}
        </button>
      </header>

      {adding && (
        <div className="commitedit-addfile">
          <input
            ref={inputRef}
            className="commitedit-addfile-input"
            value={query}
            placeholder={t('commitEdit.addFilePlaceholder')}
            aria-label={t('commitEdit.addFilePlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                // The view's own Escape closes the editor; here it only closes the search.
                e.preventDefault()
                setAdding(false)
              } else if (e.key === 'Enter' && matches[0]) addFile(matches[0])
            }}
          />
          <div className="commitedit-addfile-list">
            {snapshot === null ? null : matches.length === 0 ? (
              <p className="settings-hint commitedit-empty">{t('commitEdit.addFileNone')}</p>
            ) : (
              matches.map((path) => (
                <button key={path} type="button" className="commitedit-addfile-item" onClick={() => addFile(path)}>
                  {path}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="commitedit-split">
        <nav className="commitedit-files">
          {rows.map((r) => (
            <div
              key={r.path}
              className={`snapshot-file-row ${selFile === r.path ? 'active' : ''}`}
              onClick={() => onSelectFile({ path: r.path, status: r.extra ? 'M' : (r.status as FileEntry['status']) })}
            >
              <span
                className={`snapshot-file-status st-${r.extra ? 'extra' : r.status.toLowerCase()}`}
                title={r.extra ? t('commitEdit.addedFile') : undefined}
              >
                {r.status}
              </span>
              <span className="snapshot-file-path">{r.path}</span>
              {isFileDraftChanged(drafts[r.path]) && <span className="commitedit-dot" title={t('commitEdit.modified')} />}
            </div>
          ))}
        </nav>
        <div className="commitedit-editor">
          {!sel ? (
            <p className="settings-hint commitedit-empty">{t('commitEdit.selectFile')}</p>
          ) : sel.missing ? (
            <p className="settings-hint commitedit-empty">{t('commitEdit.notEditable')}</p>
          ) : sel.binary ? (
            <p className="settings-hint commitedit-empty">{t('commitEdit.binary')}</p>
          ) : sel.tooLarge ? (
            <p className="settings-hint commitedit-empty">{t('commitEdit.tooLarge')}</p>
          ) : mode === 'compare' ? (
            diff === null ? (
              <p className="settings-hint commitedit-empty">{t('commitEdit.compareTooLarge')}</p>
            ) : diff === '' ? (
              <p className="settings-hint commitedit-empty">{t('commitEdit.compareNoChanges')}</p>
            ) : (
              <div className="commitedit-compare">
                <DiffViewer diff={diff} file={selFile} lang={guessLanguage(selFile)} repoPath={repoPath} />
              </div>
            )
          ) : (
            // Keyed by file so each opens scrolled to its top, not where the last one was.
            <CodeEditor
              key={selFile}
              value={sel.draft}
              onChange={(next) => onChangeDraft(selFile, next)}
              lang={guessLanguage(selFile)}
              lineNumbers
              label={selFile}
              disabled={!editable}
            />
          )}
        </div>
      </div>
    </section>
  )
}
