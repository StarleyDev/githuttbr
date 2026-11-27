import { useEffect, useMemo, useState } from 'react'
import { gitApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { repoActions, useRepoStore } from '../stores/repo'
import { interp, useT } from '../i18n'
import { conflictKindKey, changedLineCount } from '../lib/conflictWorkspace'
import { parseDiff } from '../lib/diff'
import { unifiedDiff } from '../../../shared/lineDiff'
import type { ConflictCommit, ConflictFileInfo, ConflictVersions } from '../../../shared/types'
import { interpNodes } from './ConflictWorkspace'
import { TimeAgoLabel } from './PrConversationTimeline'

/**
 * A conflict with no text to merge: one side deleted the file the other
 * changed, or both renamed it to different names. The three panes would show
 * one empty side, so this says who did what and offers the decisions that
 * actually exist — keep it, delete it, pick a name.
 */
export function ConflictPathCard({
  repoPath,
  info,
  onResolved
}: {
  repoPath: string
  info: ConflictFileInfo
  onResolved: (path: string) => void
}): React.JSX.Element {
  const t = useT()
  const openModal = useUIStore((s) => s.openModal)
  const recordConflictChoices = useUIStore((s) => s.recordConflictChoices)
  const ctx = useRepoStore((s) => s.repos[repoPath]?.conflictContext ?? null)
  const [versions, setVersions] = useState<ConflictVersions | null>(null)
  const [history, setHistory] = useState<ConflictCommit[]>([])
  const [showDiff, setShowDiff] = useState(false)
  const [busy, setBusy] = useState(false)
  const { path, kind } = info

  useEffect(() => {
    let cancelled = false
    void gitApi.conflictVersions(repoPath, path).then((v) => !cancelled && setVersions(v)).catch(() => undefined)
    void gitApi.conflictCommits(repoPath, path).then((h) => !cancelled && setHistory(h)).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [repoPath, path])

  const oursName = ctx?.target || 'HEAD'
  const theirsName = ctx?.source || t('conflictWs.incoming')
  // Which side still has the file: the one that changed it (deleted) or added it.
  const keeper: 'ours' | 'theirs' =
    kind === 'deleted-by-us' || kind === 'added-by-them' ? 'theirs' : 'ours'
  const lastOn = (side: 'ours' | 'theirs'): ConflictCommit | undefined => history.find((c) => c.side === side)

  const diff = useMemo(() => {
    if (!versions) return null
    const kept = keeper === 'ours' ? versions.ours : versions.theirs
    if (kept === null) return null
    return unifiedDiff(versions.base ?? '', kept)
  }, [versions, keeper])
  const changed = changedLineCount(diff)

  const resolve = async (label: string, keep: string[], drop: string[], side: 'ours' | 'theirs'): Promise<void> => {
    setBusy(true)
    try {
      const ok = await repoActions.conflictResolvePaths(repoPath, label, keep, drop)
      if (ok) {
        recordConflictChoices(repoPath, path, { ours: side === 'ours' ? 1 : 0, theirs: side === 'theirs' ? 1 : 0, both: 0, edited: 0 })
        onResolved(path)
      }
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = (): void => {
    const changer = keeper === 'ours' ? oursName : theirsName
    openModal({
      kind: 'confirm',
      danger: true,
      title: interp(t('conflictWs.deleteTitle'), { file: path }),
      message: interp(t('conflictWs.deleteMessage'), { file: path, side: changer }),
      confirmLabel: t('conflictWs.deleteFile'),
      onConfirm: () =>
        void resolve(interp(t('conflictWs.actDeleted'), { file: path }), [], [path], keeper === 'ours' ? 'theirs' : 'ours')
    })
  }

  const sideBox = (side: 'ours' | 'theirs', did: string): React.JSX.Element => {
    const c = lastOn(side) ?? (side === 'ours' ? ctx?.ours : ctx?.theirs)
    return (
      <div className={`cpc-side ${side}`}>
        <b>{side === 'ours' ? t('conflictWs.yours') : t('conflictWs.incoming')}</b>
        <div className="cpc-side-meta">
          <span>
            {did}
            {c?.author && <span className="cw-sep">{c.author}</span>}
            {c?.date && (
              <span className="cw-sep">
                <TimeAgoLabel iso={c.date} />
              </span>
            )}
          </span>
          {c?.subject && <q>{c.subject}</q>}
        </div>
      </div>
    )
  }

  const chip = (name: string, side: 'src' | 'tgt'): React.JSX.Element => <b className={`cpc-ref ${side}`}>{name}</b>

  if (kind === 'renamed-both') {
    const to = info.renamedTo
    return (
      <div className="cw-body cw-body-card">
        <section className="cpc-card warn">
          <span className="cpc-eyebrow">{t(conflictKindKey(kind))}</span>
          <b className="cpc-title">{path}</b>
          {to ? (
            <>
              <p className="cpc-text">
                {interpNodes(t('conflictWs.renamedBody'), {
                  ours: chip(oursName, 'tgt'),
                  oursName: <code>{to.ours}</code>,
                  theirs: chip(theirsName, 'src'),
                  theirsName: <code>{to.theirs}</code>
                })}
              </p>
              <div className="cpc-sides">
                {sideBox('ours', interp(t('conflictWs.renamedTo'), { name: to.ours }))}
                {sideBox('theirs', interp(t('conflictWs.renamedTo'), { name: to.theirs }))}
              </div>
              <div className="cpc-actions">
                <button
                  className="cpc-btn ours"
                  disabled={busy}
                  onClick={() =>
                    void resolve(interp(t('conflictWs.actKeptName'), { name: to.ours }), [to.ours], [path, to.theirs], 'ours')
                  }
                >
                  {interp(t('conflictWs.keepName'), { name: to.ours })}
                </button>
                <button
                  className="cpc-btn theirs"
                  disabled={busy}
                  onClick={() =>
                    void resolve(interp(t('conflictWs.actKeptName'), { name: to.theirs }), [to.theirs], [path, to.ours], 'theirs')
                  }
                >
                  {interp(t('conflictWs.keepName'), { name: to.theirs })}
                </button>
                <button
                  className="cpc-btn"
                  disabled={busy}
                  onClick={() =>
                    void resolve(interp(t('conflictWs.actKeptBoth'), { ours: to.ours, theirs: to.theirs }), [to.ours, to.theirs], [path], 'ours')
                  }
                >
                  {t('conflictWs.keepBothNames')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="cpc-text">{t('conflictWs.renamedUnpaired')}</p>
              <div className="cpc-actions">
                <button
                  className="cpc-btn danger"
                  disabled={busy}
                  onClick={() => void resolve(interp(t('conflictWs.actDeleted'), { file: path }), [], [path], 'ours')}
                >
                  {t('conflictWs.acceptRemoval')}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    )
  }

  const deleted = kind === 'deleted-by-us' || kind === 'deleted-by-them'
  const keeperName = keeper === 'ours' ? oursName : theirsName
  const otherName = keeper === 'ours' ? theirsName : oursName
  const otherSide = keeper === 'ours' ? 'theirs' : 'ours'

  return (
    <div className="cw-body cw-body-card">
      <section className="cpc-card warn">
        <span className="cpc-eyebrow">{t(conflictKindKey(kind))}</span>
        <b className="cpc-title">{path}</b>
        <p className="cpc-text">
          {deleted
            ? interpNodes(t(changed === 1 ? 'conflictWs.deletedBodyOne' : 'conflictWs.deletedBody'), {
                deleter: chip(otherName, otherSide === 'ours' ? 'tgt' : 'src'),
                changer: chip(keeperName, keeper === 'ours' ? 'tgt' : 'src'),
                n: changed
              })
            : interpNodes(t('conflictWs.addedOneBody'), { side: chip(keeperName, keeper === 'ours' ? 'tgt' : 'src') })}
        </p>
        {deleted && (
          <div className="cpc-sides">
            {sideBox('ours', keeper === 'ours' ? t('conflictWs.didChange') : t('conflictWs.didDelete'))}
            {sideBox('theirs', keeper === 'theirs' ? t('conflictWs.didChange') : t('conflictWs.didDelete'))}
          </div>
        )}
        <div className="cpc-actions">
          <button
            className="cpc-btn ours"
            disabled={busy}
            onClick={() => void resolve(interp(t('conflictWs.actKept'), { file: path }), [path], [], keeper)}
          >
            {keeper === 'ours' ? t('conflictWs.keepWithYours') : t('conflictWs.keepWithTheirs')}
          </button>
          <button className="cpc-btn danger" disabled={busy} onClick={confirmDelete}>
            {t('conflictWs.deleteFile')}
          </button>
          {diff !== null && diff !== '' && (
            <button className="cpc-btn" onClick={() => setShowDiff((v) => !v)} aria-expanded={showDiff}>
              {showDiff
                ? t('conflictWs.hideChanges')
                : keeper === 'ours'
                  ? t('conflictWs.seeYourChanges')
                  : t('conflictWs.seeTheirChanges')}
            </button>
          )}
        </div>
        {showDiff && diff && (
          <pre className="cpc-diff">
            {parseDiff(diff).map((l, i) => (
              <div key={i} className={`cpc-diff-line ${l.kind}`}>
                {l.text || ' '}
              </div>
            ))}
          </pre>
        )}
      </section>
    </div>
  )
}
