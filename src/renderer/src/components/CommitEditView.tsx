import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleSlash, SquarePen, X } from 'lucide-react'
import type { CommitEditInfo, CommitEditPreview, FileEntry } from '../../../shared/types'
import { gitApi } from '../infrastructure/api'
import { useUIStore, type CommitEditDraft, type CommitEditFileDraft, type CommitEditViewState } from '../stores/ui'
import { repoActions, useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { t as tNow, useT, interp } from '../i18n'
import { emojifyGitmoji } from '../../../shared/gitmoji'
import { timeAgo } from '../lib/timeAgo'
import { countUnappliedChanges, describeUnappliedChanges } from '../lib/commitEditPanel'
import { CommitAIGenerate } from './CommitAIGenerate'
import { CommitEditFilesCard, isFileDraftChanged } from './CommitEditFilesCard'
import { CommitEditImpactPanel } from './CommitEditImpactPanel'
import { CommitMessageEditor, SUMMARY_MAX_LENGTH } from './CommitMessageEditor'
import { joinCommitMessage, splitCommitMessage } from '../lib/commitMessage'
import { useCommitGeneration } from './useCommitGeneration'

type CommitEditTarget = Pick<CommitEditViewState, 'repoPath' | 'sha' | 'subject'>
type MessageParts = { summary: string; description: string }

const NO_SCOPES: readonly string[] = []

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
  // null until the commit's own file list is in.
  const [files, setFiles] = useState<FileEntry[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, CommitEditFileDraft>>(saved?.files ?? {})
  const [selFile, setSelFile] = useState(saved?.selFile ?? '')
  // Summary and description, edited apart like in the composer; null until the
  // commit's own message (or a restored draft) is in.
  const [parts, setParts] = useState<MessageParts | null>(() =>
    saved?.parts ?? null
  )
  const [preview, setPreview] = useState<CommitEditPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)
  const branch = useRepoStore((s) => s.repos[repoPath]?.branches.current ?? '')
  const upstream = useRepoStore(
    (s) => s.repos[repoPath]?.branches.locals.find((b) => b.isCurrent)?.upstream ?? null
  )
  const scopes = useRepoStore((s) => s.repos[repoPath]?.config?.config?.commit?.scopes) ?? NO_SCOPES

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const [i, f] = await Promise.all([gitApi.commitEditInfo(repoPath, sha), gitApi.commitFiles(repoPath, sha)])
        if (!live) return
        setInfo(i)
        setParts((p) => p ?? splitCommitMessage(i.message))
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
      if (isFileDraftChanged(d)) out[path] = d.draft
    }
    return out
  }, [drafts])
  const changedFiles = Object.keys(edits).length

  // Files opened through "Add file": every draft the commit's own list lacks.
  // Derived rather than stored, so a restored draft brings them back too.
  const added = useMemo(() => {
    if (!files) return []
    const own = new Set(files.map((f) => f.path))
    return Object.keys(drafts).filter((path) => !own.has(path))
  }, [files, drafts])

  const summary = parts?.summary ?? ''
  const description = parts?.description ?? ''
  // The message the rewrite uses: summary, blank line, body.
  const message = parts ? joinCommitMessage(parts.summary, parts.description) : null
  const text = message ?? ''
  // Compared in the same normal form, so opening a commit whose message has
  // stray blank lines or CRLFs does not count as an edit.
  const loaded = useMemo(() => (info ? splitCommitMessage(info.message) : null), [info])
  const original = loaded ? joinCommitMessage(loaded.summary, loaded.description) : ''
  // An old commit may carry a subject past the composer's cap: it stays editable whole.
  const summaryMaxLength = Math.max(SUMMARY_MAX_LENGTH, loaded?.summary.length ?? 0)
  const messageChanged = info !== null && message !== null && message !== original
  // Before `info` arrives, a restored draft is the only judge of dirtiness.
  const dirty = changedFiles > 0 || messageChanged || (info === null && Boolean(saved?.dirty))
  // Ancestry is the only hard requirement — merges in the range are replayed
  // with their recorded resolutions.
  const editable = Boolean(info?.ancestor)

  // Mirror the work in progress into the store, so a tab switch (which
  // unmounts this view) and the "open another commit" guard both see it.
  useEffect(() => {
    saveCommitEditDraft(repoPath, sha, { parts, files: drafts, selFile, dirty })
  }, [repoPath, sha, parts, drafts, selFile, dirty, saveCommitEditDraft])

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
  const setMessageParts = (next: MessageParts): void => {
    setParts(next)
    setPreview(null)
  }
  const restoreOriginalMessage = (): void => {
    if (loaded) setMessageParts({ summary: loaded.summary, description: loaded.description })
  }
  const setSummary = (next: string): void => setMessageParts({ summary: next, description })
  const setDescription = (next: string): void => setMessageParts({ summary, description: next })

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
  const generation = useCommitGeneration({
    repoPath,
    branch,
    diff: async () => {
      const diff = await gitApi.commitDiff(repoPath, sha)
      if (!diff.trim()) toast('info', t('commitPanel.nothingToSummarize'))
      return diff
    },
    current: { summary, description },
    apply: (draft) => setMessageParts({ summary: draft.summary, description: draft.description })
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

  const unapplied = describeUnappliedChanges(countUnappliedChanges(messageChanged, changedFiles))
  const age = info ? timeAgo(Date.parse(info.authorDate), Date.now()) : null
  const [beforeLabel, beforeRest = ''] = t('commitEdit.before').split('{subject}')
  const showAIRow = aiEnabled || messageChanged

  return (
    <div className="file-viewer commitedit-view">
      <div className="fv-header commitedit-header">
        <span className="commitedit-title">
          <SquarePen size={16} aria-hidden="true" />
          <h1 className="commitedit-heading">{t('commitEdit.title')}</h1>
          <span className="commitedit-sha">{sha.slice(0, 7)}</span>
          <span className="commitedit-subject" title={subject}>
            {emojifyGitmoji(subject)}
          </span>
          {info && (
            <span className="commitedit-byline">
              {interp(t('commitEdit.byline'), {
                author: info.authorName,
                age: age ? interp(t(age.key), { n: age.n }) : ''
              })}
            </span>
          )}
        </span>
        {dirty && info && <span className="commitedit-pill">{interp(t(unapplied.key), unapplied.vars)}</span>}
        <button className="icon-btn" title={t('common.close')} aria-label={t('common.close')} onClick={closeCommitEdit}>
          <X size={15} />
        </button>
      </div>

      {info && !info.ancestor && (
        <div className="commitedit-banner error commitedit-notlinear">
          <CircleSlash size={13} /> {t('commitEdit.notLinear')}
        </div>
      )}

      <div className="commitedit-body">
        <div className="commitedit-main">
          <section className="commitedit-card commitedit-message-card">
            <header className="commitedit-card-head">
              <label htmlFor="commitedit-summary">{t('commitEdit.messageCard')}</label>
              {messageChanged && <span className="commitedit-edited">{t('commitEdit.edited')}</span>}
              <span className="commitedit-card-spacer" />
              {messageChanged && (
                <button type="button" className="commitedit-link" onClick={restoreOriginalMessage} disabled={!editable}>
                  {t('commitEdit.backToOriginal')}
                </button>
              )}
            </header>
            <div className="commitedit-message">
              {/* Keyed on the load: the ticket field reads its key from the summary
                  once, when it mounts, and the summary only arrives with the commit. */}
              <CommitMessageEditor
                key={parts ? 'loaded' : 'loading'}
                repoPath={repoPath}
                branch={branch}
                scopes={scopes}
                summary={summary}
                description={description}
                setSummary={setSummary}
                setDescription={setDescription}
                disabled={!editable}
                readOnly={generation.state.phase === 'generating'}
                summaryId="commitedit-summary"
                summaryMaxLength={summaryMaxLength}
                afterDescription={
                  showAIRow && (
                    <div className="commitedit-ai-row">
                      {aiEnabled && <CommitAIGenerate gen={generation} disabled={!editable} />}
                      <span className="commitedit-card-spacer" />
                      {messageChanged && loaded && (
                        <span className="commitedit-before" title={loaded.summary}>
                          {beforeLabel}
                          <span className="commitedit-before-subject">{emojifyGitmoji(loaded.summary)}</span>
                          {beforeRest}
                        </span>
                      )}
                    </div>
                  )
                }
              />
            </div>
          </section>

          <CommitEditFilesCard
            repoPath={repoPath}
            sha={sha}
            files={files}
            added={added}
            drafts={drafts}
            selFile={selFile}
            editable={editable}
            onSelectFile={(f) => void selectFile(f)}
            onChangeDraft={setDraft}
          />
        </div>

        <CommitEditImpactPanel
          info={info}
          subject={loaded?.summary || subject}
          preview={preview}
          messageChanged={messageChanged}
          changedFiles={changedFiles}
          upstream={upstream}
          canPreview={editable && dirty && !busy}
          canApply={editable && dirty && !busy && !(preview !== null && preview.newTip === null)}
          busy={busy}
          onPreview={() => void runPreview()}
          onApply={apply}
        />
      </div>
    </div>
  )
}
