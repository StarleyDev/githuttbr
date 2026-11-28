import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, GitMerge, X } from 'lucide-react'
import { gitApi } from '../infrastructure/api'
import { useUIStore, type ConflictViewState } from '../stores/ui'
import { repoActions, useRepoStore } from '../stores/repo'
import { interp, useT, type TranslationKey } from '../i18n'
import {
  conflictKindKey,
  conflictProgress,
  conflictSessionKey,
  lineByLine,
  nextOpenFile,
  stripEntries
} from '../lib/conflictWorkspace'
import type { ConflictOpKind, ConflictOverview } from '../../../shared/types'
import { ConflictResolver } from './ConflictResolver'
import { ConflictPathCard } from './ConflictPathCard'
import { ConflictDoneCard } from './ConflictDoneCard'

/**
 * A translated sentence with React nodes in its placeholders — a ref as a chip,
 * a count in bold — so each locale keeps its own word order.
 */
export function interpNodes(template: string, vars: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1]
    return <Fragment key={i}>{name && name in vars ? vars[name] : part}</Fragment>
  })
}

const OP_KEYS: Record<ConflictOpKind, TranslationKey> = {
  merge: 'conflictWs.opMerge',
  rebase: 'conflictWs.opRebase',
  'cherry-pick': 'conflictWs.opCherryPick',
  revert: 'conflictWs.opRevert'
}
const CONTINUE_KEYS: Record<ConflictOpKind, TranslationKey> = {
  merge: 'conflictWs.continueMerge',
  rebase: 'conflictWs.continueRebase',
  'cherry-pick': 'conflictWs.continueCherryPick',
  revert: 'conflictWs.continueRevert'
}
const ABORT_TITLE_KEYS: Record<ConflictOpKind, TranslationKey> = {
  merge: 'conflictWs.abortTitleMerge',
  rebase: 'conflictWs.abortTitleRebase',
  'cherry-pick': 'conflictWs.abortTitleCherryPick',
  revert: 'conflictWs.abortTitleRevert'
}

/**
 * The whole conflicted step on one screen: what is being merged into what and
 * how far along it is, one chip per conflicted file, and the file at hand —
 * the three-pane editor for text, a card for a file deleted or renamed, and the
 * finish line once nothing is left.
 */
export function ConflictWorkspace({ view }: { view: ConflictViewState }): React.JSX.Element {
  const t = useT()
  const { repoPath, file } = view
  const setConflictView = useUIStore((s) => s.setConflictView)
  const openModal = useUIStore((s) => s.openModal)
  const trackConflictFiles = useUIStore((s) => s.trackConflictFiles)
  const session = useUIStore((s) => s.conflictSessions[repoPath])
  const ctx = useRepoStore((s) => s.repos[repoPath]?.conflictContext ?? null)
  const mergeState = useRepoStore((s) => s.repos[repoPath]?.mergeState ?? null)
  const conflicted = useRepoStore((s) => s.repos[repoPath]?.status?.conflicted)
  // The paths as one string: a refresh may hand back a new array, and only a
  // change of membership is worth asking git again.
  const conflictedKey = useMemo(() => (conflicted ?? []).map((f) => f.path).join('\n'), [conflicted])
  const [overview, setOverview] = useState<ConflictOverview | null>(null)
  const sessionKey = conflictSessionKey(mergeState, ctx?.theirs?.sha)

  useEffect(() => {
    let cancelled = false
    void gitApi
      .conflictOverview(repoPath)
      .then((o) => {
        if (cancelled) return
        setOverview(o)
        trackConflictFiles(repoPath, sessionKey, o.files, o.listed)
      })
      .catch(() => !cancelled && setOverview({ files: [], listed: [] }))
    return () => {
      cancelled = true
    }
  }, [repoPath, conflictedKey, sessionKey, trackConflictFiles])

  const entries = useMemo(() => stripEntries(session, overview?.files ?? []), [session, overview])
  const progress = conflictProgress(entries)
  const openCount = overview?.files.filter((f) => !f.renameOf).length ?? 0
  const allDone = overview !== null && openCount === 0
  // A rename/rename half opens its original's card: that is where it is settled.
  const info = overview?.files.find((f) => f.path === file)
  const current = info?.renameOf ? overview?.files.find((f) => f.path === info.renameOf) : info

  // Once a file is resolved, move on to the next one as soon as the overview
  // shows it gone — rather than closing on the user mid-operation.
  const advanceFrom = useRef<string | null>(null)
  useEffect(() => {
    const from = advanceFrom.current
    if (!from || !overview || overview.files.some((f) => f.path === from)) return
    advanceFrom.current = null
    const next = nextOpenFile(entries, from)
    if (next && next !== from) setConflictView({ repoPath, file: next })
  }, [overview, entries, repoPath, setConflictView])

  // Nothing in progress and nothing conflicted: the step finished (or was
  // aborted) somewhere — the composer, a terminal. There is nothing to show.
  useEffect(() => {
    if (allDone && !mergeState) setConflictView(null)
  }, [allDone, mergeState, setConflictView])

  const goTo = (path: string): void => setConflictView({ repoPath, file: path })
  const nextFile = nextOpenFile(entries, current?.path ?? file)
  const onResolved = (path: string): void => {
    advanceFrom.current = path
  }

  const abort = (): void => {
    if (!mergeState) return
    openModal({
      kind: 'confirm',
      danger: true,
      title: t(ABORT_TITLE_KEYS[mergeState]),
      message: interp(t('conflictWs.abortMessage'), { target: ctx?.target || 'HEAD' }),
      confirmLabel: t('conflict.abort'),
      onConfirm: () => {
        void repoActions.conflictAbort(repoPath, mergeState).then((ok) => ok && setConflictView(null))
      }
    })
  }

  const pct = progress.total > 0 ? Math.round((progress.resolved / progress.total) * 100) : 0

  return (
    <div className="file-viewer conflict-workspace">
      <div className="cw-opbar">
        <GitMerge size={16} className="cw-opbar-icon" />
        <span className="cw-op">
          {mergeState && ctx?.source && ctx?.target
            ? interpNodes(t(OP_KEYS[mergeState]), {
                source: <span className="conflict-ref src">{ctx.source}</span>,
                target: <span className="conflict-ref tgt">{ctx.target}</span>
              })
            : t('conflictWs.opNone')}
        </span>
        {progress.total > 0 && (
          <span className="cw-progress">
            <span>
              {interpNodes(t('conflictWs.progress'), {
                files: (
                  <b>
                    {interp(t('conflictWs.progressFiles'), { done: progress.resolved, total: progress.total })}
                  </b>
                )
              })}
            </span>
            <span className="cw-bar" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span>
              {progress.left === 1
                ? t('conflictWs.conflictsLeftOne')
                : interp(t('conflictWs.conflictsLeft'), { n: progress.left })}
            </span>
          </span>
        )}
        <span className="cw-spacer" />
        {mergeState && (
          <>
            <button className="btn ghost small" onClick={abort}>
              {t('conflict.abort')}
            </button>
            <button
              className="btn primary small"
              disabled={!allDone}
              title={allDone ? undefined : t('conflict.resolveFirst')}
              onClick={() => void repoActions.conflictContinue(repoPath, mergeState)}
            >
              {t(CONTINUE_KEYS[mergeState])}
            </button>
          </>
        )}
        <button className="icon-btn" title={t('common.close')} onClick={() => setConflictView(null)}>
          <X size={15} />
        </button>
      </div>

      {entries.length > 0 && (
        <nav className="cw-strip" aria-label={t('conflictWs.files')}>
          {entries.map((e) =>
            e.state === 'resolved' ? (
              <span key={e.path} className="cw-chip resolved" title={e.path}>
                <Check size={12} /> {e.path.split('/').pop()}
              </span>
            ) : (
              <button
                key={e.path}
                className={`cw-chip ${e.path === current?.path ? 'current' : ''}`}
                aria-current={e.path === current?.path ? 'true' : undefined}
                title={e.path}
                onClick={() => goTo(e.path)}
              >
                {e.path.split('/').pop()}
                {e.info && lineByLine(e.info.kind) ? (
                  e.info.conflicts > 0 && (
                    <span className="cw-count" title={interp(t('conflictWs.chipCount'), { n: e.info.conflicts })}>
                      {e.info.conflicts}
                    </span>
                  )
                ) : (
                  e.info && <span className="cw-kind">{t(conflictKindKey(e.info.kind))}</span>
                )}
              </button>
            )
          )}
          <span className="cw-spacer" />
          {nextFile && nextFile !== current?.path && (
            <button className="cw-next" onClick={() => goTo(nextFile)}>
              {t('conflictWs.nextFile')}
            </button>
          )}
        </nav>
      )}

      {allDone && mergeState ? (
        <ConflictDoneCard
          repoPath={repoPath}
          kind={mergeState}
          files={progress.total}
          choices={session?.choices ?? {}}
          onReview={() => {
            useRepoStore.getState().select(repoPath, { type: 'wip' })
            setConflictView(null)
          }}
        />
      ) : current && !lineByLine(current.kind) ? (
        <ConflictPathCard key={current.path} repoPath={repoPath} info={current} onResolved={onResolved} />
      ) : (
        <ConflictResolver key={file} view={view} info={current ?? null} onResolved={onResolved} />
      )}
    </div>
  )
}
