import { AlertTriangle, Check, CircleSlash, GitMerge, Loader2, Radar, SquarePen } from 'lucide-react'
import type { CommitEditInfo, CommitEditPreview } from '../../../shared/types'
import { useT, interp } from '../i18n'
import { emojifyGitmoji } from '../../../shared/gitmoji'
import {
  buildCascadeRows,
  describeCascadeStep,
  describeEditedCommit,
  firstConflictFile,
  pickPushedBranch
} from '../lib/commitEditPanel'

// A git ref name, not copy — it reads the same in every language.
const HEAD_REF = 'HEAD'

/**
 * "What will happen" — the commit editor's side panel. The commits a rewrite
 * replays, newest first down to the edited one, each with its verdict once a
 * preview ran; the force-push warning when the commit is on a remote; how undo
 * gets the old chain back; and the two actions.
 */
export function CommitEditImpactPanel({
  info,
  subject,
  preview,
  messageChanged,
  changedFiles,
  upstream,
  canPreview,
  canApply,
  busy,
  onPreview,
  onApply
}: {
  info: CommitEditInfo | null
  /** The edited commit's original subject. */
  subject: string
  preview: CommitEditPreview | null
  messageChanged: boolean
  changedFiles: number
  /** The current branch's upstream (`origin/main`), preferred in the warning. */
  upstream: string | null
  canPreview: boolean
  canApply: boolean
  busy: boolean
  onPreview: () => void
  onApply: () => void
}): React.JSX.Element {
  const t = useT()
  const rows = buildCascadeRows(info?.above ?? [], preview)
  const hidden = info ? info.aboveTotal - info.above.length : 0
  const edited = describeEditedCommit(messageChanged, changedFiles)
  const pushedTo = info?.pushed ? pickPushedBranch(info.remoteBranches, upstream) : null
  const conflictFile = firstConflictFile(preview)
  const n = info?.aboveTotal ?? 0
  const [hashesBefore, hashesAfter = ''] = t(n > 0 ? 'commitEdit.newHashes' : 'commitEdit.newHashesNone').split('{undo}')

  return (
    <aside className="commitedit-impact" aria-labelledby="commitedit-impact-title">
      <h2 id="commitedit-impact-title" className="commitedit-impact-title">
        {t('commitEdit.impactTitle')}
      </h2>

      {info && info.ancestor && (
        <ol className="commitedit-chain">
          {rows.map((r, i) => {
            const line = describeCascadeStep(r.step)
            return (
              <li key={r.sha} className={`commitedit-chain-row ${r.step?.status ?? ''}`}>
                <span className="commitedit-chain-dot" aria-hidden="true" />
                <span className="commitedit-chain-text">
                  <span className="commitedit-chain-subject" title={r.subject}>
                    {r.merge && <GitMerge size={12} className="commitedit-chain-merge" aria-label={t('commitEdit.mergeStep')} />}
                    {emojifyGitmoji(r.subject)}
                  </span>
                  {line && r.step && (
                    <span className={`commitedit-chain-status ${r.step.status}`} title={r.step.files.join('\n')}>
                      {r.step.status === 'clean' ? (
                        <Check size={11} aria-hidden="true" />
                      ) : r.step.status === 'conflict' ? (
                        <AlertTriangle size={11} aria-hidden="true" />
                      ) : (
                        <CircleSlash size={11} aria-hidden="true" />
                      )}
                      {interp(t(line.key), line.vars)}
                    </span>
                  )}
                </span>
                {i === 0 && <span className="commitedit-chain-head">{HEAD_REF}</span>}
              </li>
            )
          })}
          {hidden > 0 && (
            <li className="commitedit-chain-row more">
              <span className="commitedit-chain-dot" aria-hidden="true" />
              <span className="commitedit-chain-text">{interp(t('commitEdit.moreAbove'), { n: hidden })}</span>
            </li>
          )}
          <li className="commitedit-chain-row self">
            <span className="commitedit-chain-dot" aria-hidden="true" />
            <span className="commitedit-chain-text">
              <strong className="commitedit-chain-subject" title={subject}>
                {emojifyGitmoji(subject)}
              </strong>
              <span className="commitedit-chain-status self">{interp(t(edited.key), edited.vars)}</span>
            </span>
            {rows.length === 0 && <span className="commitedit-chain-head">{HEAD_REF}</span>}
          </li>
        </ol>
      )}

      {info && info.ancestor && info.merges > 0 && (
        <div className="commitedit-note">
          <GitMerge size={13} aria-hidden="true" /> {interp(t('commitEdit.mergesInRange'), { n: info.merges })}
        </div>
      )}

      {info?.pushed && info.ancestor && (
        <div className="commitedit-note warn" role="note">
          <strong>
            {pushedTo
              ? interp(t('commitEdit.pushedTitle'), { branch: pushedTo.branch, remote: pushedTo.remote })
              : t('commitEdit.pushedTitleAny')}
          </strong>{' '}
          {t('commitEdit.pushedBody')}
        </div>
      )}

      {info?.ancestor && (
        <div className="commitedit-note">
          {interp(hashesBefore, { n })}
          <strong>{t('toolbar.undo')}</strong>
          {interp(hashesAfter, { n })}
        </div>
      )}

      <span className="commitedit-impact-spacer" />
      <button className="btn commitedit-impact-preview" onClick={onPreview} disabled={!canPreview}>
        {busy ? <Loader2 size={13} className="spin" /> : <Radar size={13} />}{' '}
        {preview ? t('commitEdit.previewAgain') : t('commitEdit.preview')}
      </button>
      <button className="btn primary commitedit-impact-apply" onClick={onApply} disabled={!canApply}>
        <SquarePen size={13} /> {t('commitEdit.apply')}
      </button>
      {preview?.newTip === null && (
        <p className="commitedit-impact-hint">
          {conflictFile ? interp(t('commitEdit.conflictLine'), { file: conflictFile }) : t('commitEdit.conflictHint')}
        </p>
      )}
    </aside>
  )
}
