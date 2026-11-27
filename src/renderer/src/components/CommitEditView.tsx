import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, CircleSlash, GitMerge, Loader2, Radar, SquarePen, Upload, X } from 'lucide-react'
import type { CommitEditInfo, CommitEditPreview, FileEntry } from '../../../shared/types'
import { gitApi } from '../infrastructure/api'
import { useUIStore, type CommitEditDraft, type CommitEditFileDraft, type CommitEditViewState } from '../stores/ui'
import { repoActions, useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { t as tNow, useT, interp } from '../i18n'
import { emojifyGitmoji } from '../../../shared/gitmoji'
import { guessLanguage } from '../lib/highlight'
import { CodeEditor } from './CodeEditor'
import { CommitAIGenerate } from './CommitAIGenerate'
import { useCommitGeneration } from './useCommitGeneration'

type CommitEditTarget = Pick<CommitEditViewState, 'repoPath' | 'sha' | 'subject'>

/** Ask before an action throws away the open editor's unapplied edits. */
function confirmDiscardCommitEdit(sha: string, onDiscard: () => void): void {
  useUIStore.getState().openModal({
    kind: 'confirm',
    title: tNow('commitEdit.discardTitle'),
    message: interp(tNow('commitEdit.discardConfirm'), { sha: sha.slice(0, 7) }),
    confirmLabel: tNow('commitEdit.discard'),
    danger: true,
    onConfirm: onDiscard
  })
}

/**
 * Open the commit editor in the centre pane. Opening another commit while the
 * current one has unapplied edits asks first; reopening the same commit keeps
 * the draft.
 */
export function openCommitEdit(target: CommitEditTarget): void {
  const ui = useUIStore.getState()
  const open = ui.commitEditView
  const same = open && open.repoPath === target.repoPath && open.sha === target.sha
  if (same) return
  if (open?.draft?.dirty) {
    confirmDiscardCommitEdit(open.sha, () => useUIStore.getState().setCommitEditView(target))
    return
  }
  ui.setCommitEditView(target)
}

/** Edit a past commit's files or message in place — formerly `CommitEditModal`. */
export function CommitEditView({ repoPath, sha }: { repoPath: string; sha: string }): React.JSX.Element {
  const t = useT()
  const subject = useUIStore((s) => (s.commitEditView?.sha === sha ? s.commitEditView.subject : ''))
  const toast = useUIStore((s) => s.toast)
  const openModal = useUIStore((s) => s.openModal)
  const setCommitEditView = useUIStore((s) => s.setCommitEditView)
  const saveCommitEditDraft = useUIStore((s) => s.saveCommitEditDraft)

  // A draft left by an earlier mount (the user switched tabs and came back)
  // wins over what the commit itself holds. Read once: the store copy is
  // written on every keystroke, and subscribing to it would re-render on each.
  const [saved] = useState<CommitEditDraft | undefined>(() => {
    const open = useUIStore.getState().commitEditView
    return open && open.repoPath === repoPath && open.sha === sha ? open.draft : undefined
  })
  const [info, setInfo] = useState<CommitEditInfo | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [drafts, setDrafts] = useState<Record<string, CommitEditFileDraft>>(saved?.files ?? {})
  const [selFile, setSelFile] = useState(saved?.selFile ?? '')
  const [message, setMessage] = useState<string | null>(saved?.message ?? null)
  const [preview, setPreview] = useState<CommitEditPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)
  const branch = useRepoStore((s) => s.repos[repoPath]?.branches.current ?? '')

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const [i, f] = await Promise.all([gitApi.commitEditInfo(repoPath, sha), gitApi.commitFiles(repoPath, sha)])
        if (!live) return
        setInfo(i)
        setMessage((m) => m ?? i.message)
        setFiles(f)
      } catch (err) {
        toast('error', err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      live = false
    }
  }, [repoPath, sha, toast])

  const selectFile = async (f: FileEntry): Promise<void> => {
    setSelFile(f.path)
    if (drafts[f.path]) return
    if (f.status === 'D') {
      setDrafts((d) => ({ ...d, [f.path]: { original: '', draft: '', binary: false, tooLarge: false, missing: true } }))
      return
    }
    const blob = await gitApi.blobAtCommit(repoPath, sha, f.path).catch(() => null)
    setDrafts((d) => ({
      ...d,
      [f.path]: {
        original: blob?.content ?? '',
        draft: blob?.content ?? '',
        binary: blob?.binary ?? false,
        tooLarge: blob ? blob.content === null && !blob.binary : false,
        missing: blob === null
      }
    }))
  }

  const edits = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [path, d] of Object.entries(drafts)) {
      if (!d.binary && !d.tooLarge && !d.missing && d.draft !== d.original) out[path] = d.draft
    }
    return out
  }, [drafts])

  const text = message ?? ''
  const messageChanged = info !== null && message !== null && message.trim() !== info.message.trim()
  // Before `info` arrives, a restored draft is the only judge of dirtiness.
  const dirty = Object.keys(edits).length > 0 || messageChanged || (info === null && Boolean(saved?.dirty))
  // Ancestry is the only hard requirement — merges in the range are replayed
  // with their recorded resolutions.
  const editable = Boolean(info?.ancestor)

  // Mirror the work in progress into the store, so a tab switch (which
  // unmounts this view) and the "open another commit" guard both see it.
  useEffect(() => {
    saveCommitEditDraft(repoPath, sha, { message, files: drafts, selFile, dirty })
  }, [repoPath, sha, message, drafts, selFile, dirty, saveCommitEditDraft])

  // Read by the Escape handler, which is registered once.
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  const closeCommitEdit = useCallback((): void => {
    if (dirtyRef.current) confirmDiscardCommitEdit(sha, () => setCommitEditView(null))
    else setCommitEditView(null)
  }, [sha, setCommitEditView])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // A dialog on top (the apply or discard confirm) owns Escape, and so does
      // anything that already handled this press (a menu, a find box).
      if (e.key === 'Escape' && !e.defaultPrevented && !useUIStore.getState().modal) closeCommitEdit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeCommitEdit])

  // Any change invalidates the last forecast.
  const setDraft = (path: string, draft: string): void => {
    setDrafts((d) => ({ ...d, [path]: { ...d[path], draft } }))
    setPreview(null)
  }

  const runPreview = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      setPreview(await gitApi.commitEditPreview(repoPath, sha, edits, text))
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [repoPath, sha, edits, text, toast])

  // AI message from the commit's own diff — works for any commit, not just HEAD.
  // The message is one field here, so it travels as the draft's summary.
  const generation = useCommitGeneration({
    repoPath,
    branch,
    diff: async () => {
      const diff = await gitApi.commitDiff(repoPath, sha)
      if (!diff.trim()) toast('info', t('commitPanel.nothingToSummarize'))
      return diff
    },
    current: { summary: text, description: '' },
    apply: (draft) => {
      const next = draft.description ? `${draft.summary}\n\n${draft.description}` : draft.summary
      setMessage(next)
      setPreview(null)
      return { summary: next, description: '' }
    }
  })

  const apply = (): void => {
    openModal({
      kind: 'confirm',
      title: t('commitEdit.applyTitle'),
      message: interp(info?.pushed ? t('commitEdit.applyConfirmPushed') : t('commitEdit.applyConfirm'), {
        sha: sha.slice(0, 7),
        n: info?.descendants ?? 0
      }),
      confirmLabel: t('commitEdit.apply'),
      onConfirm: () => {
        void repoActions.commitEditApply(repoPath, sha, edits, text).then((ok) => {
          if (ok) setCommitEditView(null)
        })
      }
    })
  }

  const sel = drafts[selFile]

  return (
    <div className="file-viewer commitedit-view">
      <div className="fv-header">
        <span className="commitedit-title">
          <SquarePen size={15} aria-hidden="true" />
          <strong>{t('commitEdit.title')}</strong>
          <span className="commitedit-sha">{sha.slice(0, 7)}</span>
          <span className="commitedit-subject" title={subject}>
            {emojifyGitmoji(subject)}
          </span>
        </span>
        <button className="icon-btn" title={t('common.close')} onClick={closeCommitEdit}>
          <X size={15} />
        </button>
      </div>

      <div className="commitedit">
        <p className="settings-hint">{t('commitEdit.intro')}</p>

        {info && !info.ancestor && (
          <div className="commitedit-banner error">
            <CircleSlash size={13} /> {t('commitEdit.notLinear')}
          </div>
        )}
        {info && info.ancestor && info.merges > 0 && (
          <div className="commitedit-banner">
            <GitMerge size={13} /> {interp(t('commitEdit.mergesInRange'), { n: info.merges })}
          </div>
        )}
        {info?.pushed && info.ancestor && (
          <div className="commitedit-banner warn">
            <Upload size={13} /> {t('commitEdit.pushedWarning')}
          </div>
        )}

        <div className="commitedit-label-row">
          <label className="commitedit-label" htmlFor="commitedit-message">
            {t('commitEdit.message')}
          </label>
        </div>
        <textarea
          id="commitedit-message"
          className="commitedit-message"
          value={text}
          disabled={!editable}
          rows={3}
          onChange={(e) => {
            setMessage(e.target.value)
            setPreview(null)
          }}
        />
        {aiEnabled && <CommitAIGenerate gen={generation} disabled={!editable} />}

        <div className="commitedit-split">
          <div className="commitedit-files">
            {files.map((f) => {
              const d = drafts[f.path]
              const changed = d && !d.binary && !d.missing && d.draft !== d.original
              return (
                <div
                  key={f.path}
                  className={`snapshot-file-row ${selFile === f.path ? 'active' : ''}`}
                  onClick={() => void selectFile(f)}
                >
                  <span className={`snapshot-file-status st-${f.status.toLowerCase()}`}>{f.status}</span>
                  <span className="snapshot-file-path">{f.path}</span>
                  {changed && <span className="commitedit-dot" title={t('commitEdit.modified')} />}
                </div>
              )
            })}
          </div>
          <div className="commitedit-editor">
            {!sel ? (
              <p className="settings-hint commitedit-empty">{t('commitEdit.selectFile')}</p>
            ) : sel.missing ? (
              <p className="settings-hint commitedit-empty">{t('commitEdit.notEditable')}</p>
            ) : sel.binary ? (
              <p className="settings-hint commitedit-empty">{t('commitEdit.binary')}</p>
            ) : sel.tooLarge ? (
              <p className="settings-hint commitedit-empty">{t('commitEdit.tooLarge')}</p>
            ) : (
              // Keyed by file so each opens scrolled to its top, not where the last one was.
              <CodeEditor
                key={selFile}
                value={sel.draft}
                onChange={(next) => setDraft(selFile, next)}
                lang={guessLanguage(selFile)}
                lineNumbers
                label={selFile}
                disabled={!editable}
              />
            )}
          </div>
        </div>

        <div className="commitedit-cascade">
          <div className="commitedit-cascade-head">
            <button className="btn ghost small" onClick={() => void runPreview()} disabled={!editable || !dirty || busy}>
              {busy ? <Loader2 size={13} className="spin" /> : <Radar size={13} />} {t('commitEdit.preview')}
            </button>
            {info && info.ancestor && (
              <span className="settings-hint">{interp(t('commitEdit.descendants'), { n: info.descendants })}</span>
            )}
            <button
              className="btn primary small"
              style={{ marginLeft: 'auto' }}
              onClick={apply}
              disabled={!editable || !dirty || busy || (preview !== null && preview.newTip === null)}
            >
              <SquarePen size={13} /> {t('commitEdit.apply')}
            </button>
          </div>
          {preview && (
            <div className="commitedit-steps">
              {preview.steps.length === 0 && <p className="settings-hint">{t('commitEdit.noDescendants')}</p>}
              {preview.steps.map((s) => (
                <div key={s.sha} className={`commitedit-step ${s.status}`}>
                  {s.status === 'clean' ? (
                    <Check size={12} />
                  ) : s.status === 'conflict' ? (
                    <AlertTriangle size={12} />
                  ) : (
                    <CircleSlash size={12} />
                  )}
                  {s.merge && <GitMerge size={12} className="commitedit-step-merge" aria-hidden="true" />}
                  <span className="commitedit-step-subject">{emojifyGitmoji(s.subject)}</span>
                  {s.status === 'conflict' && (
                    <span className="commitedit-step-files" title={s.files.join('\n')}>
                      {interp(t('radar.conflictFiles'), { n: String(s.files.length) })}
                    </span>
                  )}
                </div>
              ))}
              {preview.newTip === null && <p className="commitedit-banner error">{t('commitEdit.conflictHint')}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
