import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BrushCleaning, CloudDownload, Loader2, Search, Trash2 } from 'lucide-react'
import type { BranchCleanupScan } from '../../../shared/types'
import { gitApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { useRepoStore, repoActions } from '../stores/repo'
import { NumberField } from './NumberField'
import { timeAgo } from '../lib/timeAgo'
import {
  DEFAULT_STALE_MONTHS,
  filterCleanupRows,
  getCleanupConfirmSummary,
  getCleanupRows,
  getDefaultCleanupSelection,
  getDeleteRequests,
  type CleanupReason,
  type CleanupRow
} from '../lib/branchCleanup'
import { useT, interp, type TranslationKey } from '../i18n'

const REASON_KEY: Record<CleanupReason, TranslationKey> = {
  gone: 'branchCleanup.reasonGone',
  merged: 'branchCleanup.reasonMerged',
  stale: 'branchCleanup.reasonStale'
}

/** Past this many rows the list stops rendering: a filter finds the rest faster than a scrollbar. */
const ROW_LIMIT = 400
/** The confirm names at most this many branches with commits of their own. */
const CONFIRM_NAMES = 12

/**
 * "Clean up local branches…": the branches whose work already lives somewhere
 * else — the server deleted their upstream after the PR merged, or the
 * default branch contains them — listed with why, ticked when nothing would
 * be lost, and deleted in one undoable operation.
 */
export function BranchCleanupModal({ repoPath }: { repoPath: string }): React.JSX.Element {
  const t = useT()
  const closeModal = useUIStore((s) => s.closeModal)
  const openModal = useUIStore((s) => s.openModal)
  const hasRemote = useRepoStore((s) => (s.repos[repoPath]?.remotes.length ?? 0) > 0)

  const [scan, setScan] = useState<BranchCleanupScan | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [includeStale, setIncludeStale] = useState(false)
  const [staleMonths, setStaleMonths] = useState(DEFAULT_STALE_MONTHS)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'fetch' | 'delete' | null>(null)
  // The time a scan landed — "stale" and "last fetch" are measured from it, so
  // the list does not reshuffle while it is open.
  const [now, setNow] = useState(() => Date.now())

  const readScan = useCallback((): void => {
    setLoadError(null)
    gitApi.getBranchCleanupCandidates(repoPath).then(
      (s) => {
        setNow(Date.now())
        setScan(s)
      },
      (err: unknown) => setLoadError(err instanceof Error ? err.message : String(err))
    )
  }, [repoPath])

  useEffect(() => readScan(), [readScan])

  const rows = useMemo(
    () => (scan ? getCleanupRows(scan.candidates, { now, staleMonths, includeStale }) : []),
    [scan, now, staleMonths, includeStale]
  )
  // The ticks follow each new scan: what was recommended before a fetch may be gone now.
  useEffect(() => {
    if (scan) setSelected(getDefaultCleanupSelection(getCleanupRows(scan.candidates, { now, staleMonths, includeStale: false })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan])

  const shown = useMemo(() => filterCleanupRows(rows, query), [rows, query])
  const rendered = shown.slice(0, ROW_LIMIT)
  const requests = getDeleteRequests(rows, selected)
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.branch.name))
  const mainRef = scan?.mainRef ?? ''

  const toggle = (name: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const toggleShown = (): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const r of shown) {
        if (allShownSelected) next.delete(r.branch.name)
        else next.add(r.branch.name)
      }
      return next
    })

  const fetchAndPrune = async (): Promise<void> => {
    setBusy('fetch')
    try {
      await repoActions.fetchAll(repoPath)
    } finally {
      setBusy(null)
      readScan()
    }
  }

  const runDelete = async (): Promise<void> => {
    setBusy('delete')
    try {
      const results = await repoActions.deleteLocalBranches(repoPath, requests)
      if (results && results.some((r) => r.status === 'deleted')) closeModal()
      else readScan()
    } finally {
      setBusy(null)
    }
  }

  const confirmDelete = (): void => {
    if (!requests.length || busy) return
    const summary = getCleanupConfirmSummary(rows, selected)
    let message = t('branchCleanup.confirmMessage')
    if (summary.risky.length) {
      const names = summary.risky.slice(0, CONFIRM_NAMES).map((r) =>
        interp(t('branchCleanup.confirmRiskyLine'), { branch: r.name, commits: r.capped ? `${r.commits}+` : r.commits })
      )
      if (summary.risky.length > CONFIRM_NAMES) {
        names.push(interp(t('branchCleanup.confirmMore'), { count: summary.risky.length - CONFIRM_NAMES }))
      }
      message += `\n\n${interp(t('branchCleanup.confirmRisky'), { commits: summary.riskyCommits })}\n${names.join('\n')}`
    }
    openModal({
      kind: 'confirm',
      danger: summary.risky.length > 0,
      title:
        summary.count === 1
          ? t('branchCleanup.confirmTitleOne')
          : interp(t('branchCleanup.confirmTitle'), { count: summary.count }),
      message,
      confirmLabel: summary.risky.length ? t('branchCleanup.confirmRiskyOk') : t('branchCleanup.confirmOk'),
      onConfirm: () => void runDelete()
    })
  }

  const ago = (at: number | null): string => {
    const a = timeAgo(at, now)
    return a ? interp(t(a.key), { n: a.n }) : ''
  }

  const chips = (row: CleanupRow): React.JSX.Element[] => {
    const b = row.branch
    const out = row.reasons.map((reason) => {
      const title =
        reason === 'gone'
          ? interp(t('branchCleanup.reasonGoneTitle'), { upstream: b.upstream ?? '' })
          : reason === 'merged'
            ? interp(t('branchCleanup.reasonMergedTitle'), { ref: mainRef })
            : interp(t('branchCleanup.reasonStaleTitle'), { months: staleMonths })
      return (
        <span key={reason} className={`badge cleanup-chip cleanup-${reason}`} title={title}>
          {t(REASON_KEY[reason])}
        </span>
      )
    })
    if (b.atMainTip && !b.gone) {
      out.push(
        <span key="tip" className="badge cleanup-chip cleanup-tip" title={interp(t('branchCleanup.atMainTipTitle'), { ref: mainRef })}>
          {t('branchCleanup.atMainTip')}
        </span>
      )
    }
    if (row.risky) {
      const label = b.uniqueCapped
        ? interp(t('branchCleanup.uniqueCapped'), { count: b.uniqueCommits })
        : b.uniqueCommits === 1
          ? t('branchCleanup.uniqueOne')
          : interp(t('branchCleanup.uniqueMany'), { count: b.uniqueCommits })
      out.push(
        <span key="unique" className="badge cleanup-chip cleanup-unique" title={interp(t('branchCleanup.uniqueTitle'), { ref: mainRef })}>
          <AlertTriangle size={10} aria-hidden="true" />
          {label}
        </span>
      )
    }
    return out
  }

  return (
    <div className="branch-cleanup-modal">
      <h3>
        <BrushCleaning size={17} style={{ verticalAlign: '-3px', marginInlineEnd: 6 }} />
        {t('branchCleanup.title')}
      </h3>
      <p className="settings-hint">{t('branchCleanup.intro')}</p>

      {hasRemote && (
        <div className="branch-cleanup-fetch">
          <span className="branch-cleanup-fetch-text">
            {scan?.lastFetchAt
              ? interp(t('branchCleanup.lastFetch'), { when: ago(scan.lastFetchAt) })
              : scan
                ? t('branchCleanup.neverFetched')
                : ''}
            <span className="modal-hint">{t('branchCleanup.fetchHint')}</span>
          </span>
          <button className="btn ghost branch-cleanup-fetch-btn" type="button" disabled={!!busy} onClick={() => void fetchAndPrune()}>
            {busy === 'fetch' ? <Loader2 size={13} className="spin" /> : <CloudDownload size={13} />}
            {t('branchCleanup.fetchPrune')}
          </button>
        </div>
      )}

      {scan && (
        <p className="modal-hint branch-cleanup-main">
          {scan.mainRef ? interp(t('branchCleanup.measuredAgainst'), { ref: scan.mainRef }) : t('branchCleanup.noMain')}
        </p>
      )}

      <div className="branch-cleanup-stale">
        <label className="clone-partial">
          <input
            type="checkbox"
            className="branch-cleanup-include-stale"
            checked={includeStale}
            disabled={!!busy}
            onChange={(e) => setIncludeStale(e.target.checked)}
          />
          <span>
            {t('branchCleanup.includeStale')}
            <span className="modal-hint">{t('branchCleanup.staleHint')}</span>
          </span>
        </label>
        <NumberField
          value={staleMonths}
          onChange={setStaleMonths}
          min={1}
          max={120}
          className="branch-cleanup-months"
          ariaLabel={t('branchCleanup.staleMonths')}
          title={t('branchCleanup.staleMonths')}
        />
      </div>

      <div className="repo-search">
        <Search size={13} />
        <input
          value={query}
          placeholder={t('branchCleanup.filter')}
          aria-label={t('branchCleanup.filter')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="repo-select-bar">
        <span className="branch-cleanup-select-actions">
          <button
            className="link-btn"
            type="button"
            disabled={!rows.length || !!busy}
            onClick={() => setSelected(getDefaultCleanupSelection(rows))}
          >
            {t('branchCleanup.selectRecommended')}
          </button>
          <button className="link-btn" type="button" disabled={!shown.length || !!busy} onClick={toggleShown}>
            {allShownSelected ? t('clone.selectNone') : t('clone.selectAll')}
          </button>
        </span>
        <span className="repo-select-count branch-cleanup-count">
          {interp(t('clone.selectedCount'), { count: requests.length })}
        </span>
      </div>

      <div className="repo-list branch-cleanup-list">
        {!scan && !loadError && (
          <div className="repo-list-state">
            <Loader2 size={16} className="spin" /> {t('branchCleanup.loading')}
          </div>
        )}
        {loadError && <div className="repo-list-state danger">{loadError}</div>}
        {scan && rows.length === 0 && <div className="repo-list-state">{t('branchCleanup.empty')}</div>}
        {rendered.map((row) => {
          const b = row.branch
          const on = selected.has(b.name)
          return (
            <label
              key={b.name}
              className={`repo-row branch-cleanup-row ${on ? 'selected' : ''} ${row.risky ? 'risky' : ''}`}
              data-branch={b.name}
              data-reasons={row.reasons.join(' ')}
            >
              <input
                type="checkbox"
                className="repo-row-check"
                checked={on}
                disabled={!!busy}
                aria-label={interp(t('branchCleanup.toggle'), { branch: b.name })}
                onChange={() => toggle(b.name)}
              />
              <span className="repo-row-name" title={b.name}>
                {b.name}
              </span>
              <span className="branch-cleanup-chips">{chips(row)}</span>
              <span
                className="branch-cleanup-age"
                title={interp(t('branchCleanup.lastCommitTitle'), { date: new Date(b.lastCommitAt).toLocaleString() })}
              >
                {ago(b.lastCommitAt)}
              </span>
            </label>
          )
        })}
      </div>
      {shown.length > ROW_LIMIT && (
        <p className="modal-hint">{interp(t('branchCleanup.truncated'), { shown: ROW_LIMIT, count: shown.length })}</p>
      )}

      {scan && scan.excluded.length > 0 && (
        <p className="modal-hint branch-cleanup-excluded" title={scan.excluded.map((e) => e.name).join('\n')}>
          {interp(t('branchCleanup.excludedNote'), { count: scan.excluded.length })}
        </p>
      )}

      <div className="modal-actions">
        <button className="btn ghost" type="button" onClick={closeModal}>
          {t('common.cancel')}
        </button>
        <button
          className="btn danger branch-cleanup-submit"
          type="button"
          disabled={!requests.length || !!busy}
          onClick={confirmDelete}
        >
          {busy === 'delete' ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
          {requests.length === 1 ? t('branchCleanup.deleteOne') : interp(t('branchCleanup.deleteMany'), { count: requests.length })}
        </button>
      </div>
    </div>
  )
}
