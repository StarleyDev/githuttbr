import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCheck, FileDiff, History, Info, Loader2, Upload } from 'lucide-react'
import type { PrCommit, PrUpdate, PrUpdateList } from '../../../shared/types'
import { hostingApi } from '../infrastructure/api'
import {
  getNewestSeenMark,
  getNewUpdateIds,
  getUpdateCompare,
  getUpdatesNewestFirst,
  getUpdatesSeenKey,
  getUpdateNumbering,
  getUpdateTitle,
  parseUpdatesSeenMark,
  type UpdateCompare,
  type UpdateNumbering,
  type UpdatesSeenMark
} from '../lib/prUpdates'
import { readableError } from '../lib/gitErrorHint'
import { useT, interp } from '../i18n'

type Tokens = Parameters<typeof hostingApi.prListUpdates>[2]

/**
 * A pull request's updates, read with the page — the tab's "1 new" needs them
 * before the tab is opened — and again on every `reload`.
 */
export function usePrUpdates(
  repoPath: string,
  remoteUrl: string,
  tokens: Tokens,
  number: number,
  reload: number
): { list: PrUpdateList | null; error: string | null } {
  const [list, setList] = useState<PrUpdateList | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setError(null)
    hostingApi
      .prListUpdates(repoPath, remoteUrl, tokens, number)
      .then((l) => live && setList(l))
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [repoPath, remoteUrl, tokens, number, reload])
  return { list, error }
}

function readSeenMark(key: string): UpdatesSeenMark | null {
  try {
    return parseUpdatesSeenMark(localStorage.getItem(key))
  } catch {
    return null
  }
}

function saveSeenMark(key: string, mark: UpdatesSeenMark): void {
  try {
    localStorage.setItem(key, JSON.stringify(mark))
  } catch {
    // Storage full or blocked: the badges come back next visit, nothing worse.
  }
}

export interface PrUpdatesSeen {
  /** Updates unseen as storage has it — the tab's "1 new". */
  unseen: Set<string>
  /** Updates the list badges as new: unseen when the tab was opened, plus any since. */
  shownNew: Set<string>
  /** Store the newest update as seen and clear the badges. */
  markSeen: () => void
}

/**
 * "New since your last visit", per pull request. Opening the tab marks every
 * listed update seen — the badges stay until the tab is left, so the user sees
 * what was new — and a refresh while it is open badges what came in, for the
 * "Mark as seen" button. Loading the page alone stores nothing.
 */
export function usePrUpdatesSeen(remoteUrl: string, number: number, list: PrUpdateList | null, viewing: boolean): PrUpdatesSeen {
  const key = getUpdatesSeenKey(remoteUrl, number)
  const [seen, setSeen] = useState<UpdatesSeenMark | null>(() => readSeenMark(key))
  useEffect(() => setSeen(readSeenMark(key)), [key])
  const [snapshot, setSnapshot] = useState<Set<string>>(() => new Set())
  const markedThisVisit = useRef(false)
  const updates = list?.updates
  const unseen = useMemo(() => getNewUpdateIds(updates ?? [], seen), [updates, seen])

  const markSeen = useCallback((): void => {
    const mark = updates ? getNewestSeenMark(updates) : null
    if (!mark) return
    saveSeenMark(key, mark)
    setSeen(mark)
    setSnapshot(new Set())
  }, [key, updates])

  useEffect(() => {
    if (!viewing) {
      markedThisVisit.current = false
      setSnapshot(new Set())
      return
    }
    if (markedThisVisit.current || !updates) return
    markedThisVisit.current = true
    setSnapshot(unseen)
    const mark = getNewestSeenMark(updates)
    if (mark) {
      saveSeenMark(key, mark)
      setSeen(mark)
    }
    // Only the opening of the tab marks; `unseen` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing, updates, key])

  const shownNew = useMemo(() => new Set([...snapshot, ...unseen]), [snapshot, unseen])
  return { unseen, shownNew, markSeen }
}

const fmtDate = (iso: string): string => {
  const at = Date.parse(iso)
  return Number.isNaN(at) ? '' : new Date(at).toLocaleString()
}

/**
 * The Updates tab: each push to the pull request, newest first — when, by
 * whom, the commits it added (and removed, where the host says) — with a way
 * to see what that push alone changed.
 */
export function PrUpdatesSection({
  list,
  error,
  seen,
  onViewChanges
}: {
  list: PrUpdateList | null
  error: string | null
  seen: PrUpdatesSeen
  onViewChanges: (update: PrUpdate, compare: UpdateCompare, numbering: UpdateNumbering) => void
}): React.JSX.Element {
  const t = useT()
  const ordered = useMemo(() => getUpdatesNewestFirst(list?.updates ?? []), [list])
  const numbering = useMemo(() => getUpdateNumbering(list?.updates ?? [], list?.startCut), [list])

  if (error) return <div className="prd-error">{readableError(error, t, interp)}</div>
  if (!list) {
    return (
      <div className="prd-empty">
        <Loader2 size={15} className="spin" /> {t('prDetail.loading')}
      </div>
    )
  }
  if (list.grouping === 'unsupported') return <p className="prp-muted prp-pad">{t('prUpdates.unsupported')}</p>
  if (!ordered.length) return <p className="prp-muted prp-pad">{t('prUpdates.none')}</p>

  const newCount = seen.shownNew.size
  return (
    <div className="prp-updates">
      {(list.grouping === 'approximate' || list.grouping === 'single') && (
        <p className="prp-side-note prp-updates-note">
          <Info size={12} aria-hidden="true" /> {t(list.grouping === 'approximate' ? 'prUpdates.approximate' : 'prUpdates.single')}
        </p>
      )}
      {list.truncated && (
        <p className="prp-side-note prp-updates-note">{t(list.startCut ? 'prUpdates.startCut' : 'prUpdates.truncated')}</p>
      )}
      {newCount > 0 && (
        <div className="prp-updates-bar" role="status">
          <span>{interp(t('prUpdates.newCount'), { n: String(newCount) })}</span>
          <button type="button" className="btn ghost tiny" onClick={seen.markSeen}>
            <CheckCheck size={12} aria-hidden="true" /> {t('prUpdates.markSeen')}
          </button>
        </div>
      )}
      <ol className="prp-update-list" aria-label={t('prUpdates.listLabel')}>
        {ordered.map((u) => (
          <PrUpdateItem key={u.id} update={u} numbering={numbering} isNew={seen.shownNew.has(u.id)} onViewChanges={onViewChanges} />
        ))}
      </ol>
    </div>
  )
}

function PrUpdateItem({
  update: u,
  numbering,
  isNew,
  onViewChanges
}: {
  update: PrUpdate
  numbering: UpdateNumbering
  isNew: boolean
  onViewChanges: (update: PrUpdate, compare: UpdateCompare, numbering: UpdateNumbering) => void
}): React.JSX.Element {
  const t = useT()
  const title = getUpdateTitle(u, numbering)
  const compare = getUpdateCompare(u)
  const date = fmtDate(u.createdAt)
  const headingId = `prp-update-${u.index}`
  return (
    <li className={`prp-update ${isNew ? 'is-new' : ''}`} aria-labelledby={headingId}>
      <div className="prp-update-head">
        <span className="prp-update-icon" aria-hidden="true">
          {u.kind === 'rewrite' ? <History size={14} /> : <Upload size={14} />}
        </span>
        <h3 id={headingId} className="prp-update-title">
          {interp(t(title.key), title.vars)}
        </h3>
        {u.kind === 'rewrite' && (
          <span className="prp-update-badge is-rewrite" title={t('prUpdates.rewrittenTitle')}>
            {t('prUpdates.rewritten')}
          </span>
        )}
        {u.retarget && (
          <span className="prp-update-badge" title={t('prUpdates.retargetedTitle')}>
            {t('prUpdates.retargeted')}
          </span>
        )}
        {isNew && (
          <span className="prp-update-badge is-new" aria-label={t('prUpdates.newAria')} title={t('prUpdates.newAria')}>
            {t('prUpdates.new')}
          </span>
        )}
        <span className="prp-update-meta">
          {date && <time dateTime={u.createdAt}>{date}</time>}
          {u.pusher && <span>{interp(t('prUpdates.pushedBy'), { name: u.pusher })}</span>}
        </span>
        {compare && (
          <button type="button" className="btn ghost tiny prp-update-view" onClick={() => onViewChanges(u, compare, numbering)}>
            <FileDiff size={12} aria-hidden="true" /> {t('prUpdates.viewChanges')}
          </button>
        )}
      </div>
      <UpdateCommits label={t('prUpdates.added')} commits={u.added} />
      {u.removed.length > 0 && <UpdateCommits label={t('prUpdates.removed')} commits={u.removed} removed />}
      {!u.added.length && !u.removed.length && (
        <p className="prp-side-note prp-update-empty">
          {t(u.kind === 'rewrite' ? 'prUpdates.noCommitsRewrite' : 'prUpdates.noCommits')}
        </p>
      )}
      {u.commitsTruncated && <p className="prp-side-note prp-update-empty">{t('prUpdates.commitsTruncated')}</p>}
    </li>
  )
}

function UpdateCommits({ label, commits, removed }: { label: string; commits: PrCommit[]; removed?: boolean }): React.JSX.Element | null {
  if (!commits.length) return null
  return (
    <div className={`prp-update-commits ${removed ? 'is-removed' : ''}`}>
      <div className="prp-update-commits-label">{label}</div>
      <ul className="prp-update-commit-list" aria-label={label}>
        {commits.map((c) => (
          <li key={c.sha} className="prp-update-commit">
            <code className="prp-commit-sha" title={c.sha}>
              {c.shortSha}
            </code>
            {c.subject ? (
              <span className="prp-update-commit-subject" title={c.subject}>
                {c.subject}
              </span>
            ) : null}
            {c.authorName && c.authorName !== '?' && <span className="prp-update-commit-author">{c.authorName}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
