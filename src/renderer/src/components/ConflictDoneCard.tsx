import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { gitApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { repoActions } from '../stores/repo'
import { interp, useT, type TranslationKey } from '../i18n'
import { sumChoices } from '../lib/conflictWorkspace'
import type { ConflictChoiceCounts } from '../lib/conflict'
import type { ConflictOpKind } from '../../../shared/types'

const FINISH_KEYS: Record<ConflictOpKind, TranslationKey> = {
  merge: 'conflictWs.finishMerge',
  rebase: 'conflictWs.continueRebase',
  'cherry-pick': 'conflictWs.finishCherryPick',
  revert: 'conflictWs.finishRevert'
}

/**
 * The finish line: every file of the step is settled. It sums up how the
 * conflicts were answered, lets the message be edited, and finishes the
 * operation from here — rather than sending the user to hunt for Continue.
 */
export function ConflictDoneCard({
  repoPath,
  kind,
  files,
  choices,
  onReview
}: {
  repoPath: string
  kind: ConflictOpKind
  files: number
  choices: Record<string, ConflictChoiceCounts>
  onReview: () => void
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const setConflictView = useUIStore((s) => s.setConflictView)
  const [message, setMessage] = useState<string | null>(null)
  const [original, setOriginal] = useState('')
  const [rerere, setRerere] = useState<{ enabled: boolean; was: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  // A rebase step commits with the replayed commit's own message.
  const hasMessage = kind !== 'rebase'

  useEffect(() => {
    let cancelled = false
    if (hasMessage)
      void gitApi
        .mergeMessage(repoPath)
        .then((m) => {
          if (cancelled) return
          setOriginal(m)
          setMessage(m)
        })
        .catch(() => !cancelled && setMessage(''))
    void gitApi
      .rerereStatus(repoPath)
      .then((s) => !cancelled && setRerere({ enabled: s.enabled, was: s.enabled }))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [repoPath, hasMessage])

  const sum = sumChoices(choices)

  const toggleRerere = (enabled: boolean): void => {
    setRerere((r) => (r ? { ...r, enabled } : r))
    void gitApi.setRerere(repoPath, { enabled }).catch((err) => {
      setRerere((r) => (r ? { ...r, enabled: !enabled } : r))
      toast('error', String(err))
    })
  }

  const finish = async (): Promise<void> => {
    setBusy(true)
    try {
      const edited = hasMessage && message !== null && message.trim() !== original.trim() ? message : undefined
      const ok = await repoActions.conflictContinue(repoPath, kind, edited)
      if (ok) setConflictView(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cw-body cw-body-card">
      <section className="cpc-card done">
        <span className="cdc-head">
          <span className="cdc-check" aria-hidden="true">
            <Check size={18} strokeWidth={2.6} />
          </span>
          <b className="cpc-title">{t('conflictWs.doneTitle')}</b>
        </span>
        <p className="cpc-text muted">
          {sum.total > 0
            ? interp(t('conflictWs.doneSummary'), {
                files,
                conflicts: sum.total,
                ours: sum.ours,
                theirs: sum.theirs,
                both: sum.both,
                edited: sum.edited
              })
            : interp(t('conflictWs.doneSummaryFiles'), { files })}
        </p>
        {hasMessage ? (
          <label className="cdc-field">
            {kind === 'merge' ? t('conflictWs.messageMerge') : t('conflictWs.messageCommit')}
            <textarea
              className="cdc-message"
              rows={Math.min(6, Math.max(1, (message ?? '').split('\n').length))}
              value={message ?? ''}
              disabled={message === null}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
        ) : (
          <p className="settings-hint">{t('conflictWs.rebaseMessageHint')}</p>
        )}
        {rerere && (
          <label className="cdc-rerere">
            <input type="checkbox" checked={rerere.enabled} onChange={(e) => toggleRerere(e.target.checked)} />
            {t('conflictWs.rerere')}
          </label>
        )}
        {rerere && rerere.enabled && !rerere.was && <p className="settings-hint">{t('conflictWs.rerereLate')}</p>}
        <div className="cpc-actions">
          <button className="btn primary" disabled={busy || (hasMessage && original.trim() !== '' && !message?.trim())} onClick={() => void finish()}>
            {t(FINISH_KEYS[kind])}
          </button>
          <button className="btn ghost" onClick={onReview}>
            {t('conflictWs.reviewAgain')}
          </button>
        </div>
      </section>
    </div>
  )
}
