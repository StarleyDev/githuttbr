import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, GitCompare, Loader2, X } from 'lucide-react'
import type { BranchCompareResult, GraphCommit, HostingAccess } from '../../../shared/types'
import { gitApi, hostingApi } from '../infrastructure/api'
import { useUIStore, type CompareMode, type CompareViewState } from '../stores/ui'
import { useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { DiffViewer } from './DiffViewer'
import { RefPicker, type RefOption } from './RefPicker'
import { useT, t as tNow, interp } from '../i18n'
import { emojifyGitmoji } from '../../../shared/gitmoji'
import { guessLanguage } from '../lib/highlight'
import { splitDiffByFile } from '../lib/diffFiles'

function timeAgo(unix: number): string {
  const d = Date.now() / 1000 - unix
  if (d < 60) return tNow('time.justNow')
  if (d < 3600) return interp(tNow('time.minutesAgo'), { n: Math.floor(d / 60) })
  if (d < 86400) return interp(tNow('time.hoursAgo'), { n: Math.floor(d / 3600) })
  return interp(tNow('time.daysAgo'), { n: Math.floor(d / 86400) })
}

/** Typing a ref waits this long before comparing, so a half-typed name does not
 *  spawn git and flash "No differences" on every keystroke. */
const REF_TYPING_DELAY_MS = 300

/**
 * Compare any two refs — formerly the `BranchComparison` modal.
 *
 * The app selects only which repository the comparison belongs to; the view
 * reads its own state here. Every click and keystroke in it writes to the
 * store, and selecting the whole object in App re-rendered the entire app.
 */
export function BranchCompareView({ repoPath }: { repoPath: string }): React.JSX.Element | null {
  const view = useUIStore((s) => (s.compareView?.repoPath === repoPath ? s.compareView : null))
  return view ? <CompareContent view={view} /> : null
}

function CompareContent({ view }: { view: CompareViewState }): React.JSX.Element {
  const { repoPath, branchA: a, branchB: b, mode } = view
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const setCompareView = useUIStore((s) => s.setCompareView)
  const updateCompareView = useUIStore((s) => s.updateCompareView)
  const repo = useRepoStore((s) => s.repos[repoPath])
  const profile = useSettingsStore((s) => s.activeProfile())

  const [result, setResult] = useState<BranchCompareResult | null>(null)
  const [loading, setLoading] = useState(true)
  // Diffs of single commits, fetched on first pick; keyed by hash. A commit's
  // diff never changes, so the cache outlives ref changes and refreshes.
  const [commitDiffs, setCommitDiffs] = useState<Record<string, string>>({})
  // A failed fetch, so the pane says why instead of spinning; picking the
  // commit again retries.
  const [commitErrors, setCommitErrors] = useState<Record<string, string>>({})

  const update = useCallback(
    (patch: Partial<Omit<CompareViewState, 'repoPath'>>) => updateCompareView(repoPath, patch),
    [repoPath, updateCompareView]
  )
  const close = useCallback(() => setCompareView(null), [setCompareView])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // A dialog on top (Create PR) owns Escape; an open ref picker stops it
      // itself, and the diff's find box marks it handled when Escape closes it.
      if (e.key === 'Escape' && !e.defaultPrevented && !useUIStore.getState().modal) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const origin = repo?.remotes.find((r) => r.name === 'origin') ?? repo?.remotes[0]
  const originUrl = origin?.url
  // Main decides whether Create PR has a credential behind it: the renderer's
  // profile carries no tokens until Settings is unlocked, and never links. The
  // profile is a dependency so an unlock or a profile switch asks again.
  const [access, setAccess] = useState<HostingAccess | null>(null)
  useEffect(() => {
    if (!originUrl) {
      setAccess('no')
      return
    }
    let live = true
    hostingApi
      .canAct(repoPath, originUrl)
      .then((r) => live && setAccess(r))
      // A failed ask is not a "no": the action reports its own failure.
      .catch(() => live && setAccess('unknown'))
    return () => {
      live = false
    }
  }, [repoPath, originUrl, profile])

  // Every ref the user can pick from (free-typing a raw SHA also works, since
  // compareBranches just passes the strings to git).
  const refOptions = useMemo<RefOption[]>(() => {
    const out: RefOption[] = []
    for (const l of repo?.branches.locals ?? []) out.push({ value: l.name, kind: 'local' })
    for (const r of repo?.branches.remotes ?? []) out.push({ value: r.fullName, kind: 'remote' })
    for (const tg of repo?.branches.tags ?? []) out.push({ value: tg.name, kind: 'tag' })
    return out
  }, [repo?.branches])

  // A refresh that moved any ref (fetch, pull, commit, checkout) replaces the
  // branches slice; comparing again then keeps the view current.
  const branches = repo?.branches
  // The first comparison runs at once; later ones (typing, a refresh) wait a
  // beat, which also folds a burst of keystrokes into one run.
  const firstRun = useRef(true)
  useEffect(() => {
    if (!a.trim() || !b.trim()) return
    let live = true
    const run = (): void => {
      setLoading(true)
      gitApi
        .compareBranches(repoPath, a.trim(), b.trim())
        .then((r) => live && setResult(r))
        .catch((err) => live && toast('error', err instanceof Error ? err.message : String(err)))
        .finally(() => live && setLoading(false))
    }
    const timer = setTimeout(run, firstRun.current ? 0 : REF_TYPING_DELAY_MS)
    firstRun.current = false
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [repoPath, a, b, branches, toast])

  // In 'commit' mode an unpicked commit means the first one unique to A (or to
  // B when A has none), so the mode is never empty while either side has one.
  const ahead = result?.aheadCommits ?? []
  const behind = result?.behindCommits ?? []
  const commit =
    mode === 'commit' ? [...ahead, ...behind].find((c) => c.hash === view.commit) ?? ahead[0] ?? behind[0] : undefined

  useEffect(() => {
    if (!commit || commitDiffs[commit.hash] !== undefined || commitErrors[commit.hash] !== undefined) return
    let live = true
    const { hash } = commit
    gitApi
      .commitDiff(repoPath, hash)
      .then((d) => live && setCommitDiffs((m) => ({ ...m, [hash]: d })))
      .catch((err) => live && setCommitErrors((m) => ({ ...m, [hash]: err instanceof Error ? err.message : String(err) })))
    return () => {
      live = false
    }
  }, [repoPath, commit, commitDiffs, commitErrors])

  const commitError = mode === 'commit' && commit ? commitErrors[commit.hash] : undefined
  const diff = mode === 'all' ? result?.diff : commit ? commitDiffs[commit.hash] : ''
  const files = useMemo(() => splitDiffByFile(diff ?? ''), [diff])
  const file = files.find((f) => f.path === view.file) ?? files[0]

  const setRefs = (next: { branchA?: string; branchB?: string }): void => update({ ...next, commit: '', file: '' })
  const setMode = (next: CompareMode): void => update({ mode: next, file: '' })
  // A click on a commit shows that commit, whichever mode was on: that keeps
  // "all changes" one click away from any single commit, and back.
  const pickCommit = (c: GraphCommit): void => {
    // Picking a commit whose diff failed tries it again.
    if (commitErrors[c.hash] !== undefined) {
      setCommitErrors(({ [c.hash]: _failed, ...rest }) => rest)
    }
    update({ mode: 'commit', commit: c.hash, file: '' })
  }

  const openPR = (): void => {
    if (!origin) {
      toast('error', t('compare.noRemote'))
      return
    }
    // One commit → use its subject; otherwise fall back to the branch name.
    const defaultTitle = ahead.length === 1 ? ahead[0].subject : a
    const defaultBody = ahead.map((c) => `- ${c.subject}`).join('\n')
    useUIStore.getState().openModal({
      kind: 'create-pr',
      repoPath,
      remoteUrl: origin.url,
      source: a,
      target: b,
      defaultTitle,
      defaultBody
    })
  }

  // 'unknown' (the store is still locked) offers it: clicking unlocks, as any hosting action does.
  const canCreatePr = access === 'yes' || access === 'unknown'

  const commitList = (list: GraphCommit[], side: 'ahead' | 'behind', from: string, notIn: string): React.JSX.Element => (
    <div className="compare-group">
      <div className="compare-group-title" title={interp(t('compare.onlyIn'), { a: from, b: notIn })}>
        <span className={`bc-badge ${side}`}>{list.length}</span>
        <span className="compare-group-label">{interp(t('compare.onlyIn'), { a: from, b: notIn })}</span>
      </div>
      {list.length === 0 ? (
        <div className="bc-empty">{t('compare.noUnique')}</div>
      ) : (
        list.map((c) => (
          <button
            key={c.hash}
            type="button"
            className={`compare-commit ${commit?.hash === c.hash ? 'active' : ''}`}
            onClick={() => pickCommit(c)}
          >
            <code className="bc-sha">{c.hash.slice(0, 7)}</code>
            <span className="bc-msg" title={emojifyGitmoji(c.subject)}>
              {emojifyGitmoji(c.subject)}
            </span>
            <span className="bc-date">{timeAgo(c.date)}</span>
          </button>
        ))
      )}
    </div>
  )

  return (
    <div className="file-viewer compare-view">
      <div className="fv-header compare-header">
        <span className="compare-title">
          <GitCompare size={15} aria-hidden="true" />
          <strong>{t('compare.title')}</strong>
        </span>
        <span className="bc-labels">
          <RefPicker
            className="bc-ref-input"
            value={a}
            options={refOptions}
            placeholder={t('compare.refPlaceholder')}
            onChange={(v) => setRefs({ branchA: v })}
          />
          <button
            className="btn ghost icon-only bc-swap"
            title={t('compare.swapTitle')}
            onClick={() => setRefs({ branchA: b, branchB: a })}
          >
            <ArrowLeftRight size={13} />
          </button>
          <RefPicker
            className="bc-ref-input"
            value={b}
            options={refOptions}
            placeholder={t('compare.refPlaceholder')}
            onChange={(v) => setRefs({ branchB: v })}
          />
        </span>
        {canCreatePr && (
          <button className="btn primary small" onClick={openPR}>
            {t('compare.createPr')}
          </button>
        )}
        <button className="icon-btn" title={t('common.close')} onClick={close}>
          <X size={15} />
        </button>
      </div>

      {loading && !result ? (
        <div className="bc-loading">
          <Loader2 size={20} className="spin" />
        </div>
      ) : result ? (
        <div className="compare-body">
          <aside className="compare-side">
            <div className="compare-modes" role="group" aria-label={t('compare.modeLabel')}>
              <button
                type="button"
                className={`compare-mode ${mode === 'all' ? 'active' : ''}`}
                aria-pressed={mode === 'all'}
                onClick={() => setMode('all')}
              >
                {t('compare.modeAll')}
              </button>
              <button
                type="button"
                className={`compare-mode ${mode === 'commit' ? 'active' : ''}`}
                aria-pressed={mode === 'commit'}
                onClick={() => setMode('commit')}
              >
                {t('compare.modeCommit')}
              </button>
            </div>

            <div className="compare-commits">
              {commitList(ahead, 'ahead', a, b)}
              {commitList(behind, 'behind', b, a)}
            </div>

            <div className="compare-files">
              <div className="compare-files-title">
                <span>{t('compare.files')}</span>
                <span className="compare-files-count">{files.length}</span>
                {loading && <Loader2 size={12} className="spin" />}
              </div>
              <div className="compare-files-caption" title={mode === 'all' ? undefined : commit?.subject}>
                {mode === 'all'
                  ? interp(t('compare.combinedDiff'), { b, a })
                  : commit
                    ? `${commit.hash.slice(0, 7)} ${emojifyGitmoji(commit.subject)}`
                    : t('compare.noUnique')}
              </div>
              <div className="compare-files-list">
                {files.map((f) => (
                  <button
                    type="button"
                    key={f.path}
                    className={`snapshot-file-row compare-file ${file?.path === f.path ? 'active' : ''}`}
                    title={f.oldPath ? `${f.path}\n${interp(t('compare.renamedFrom'), { path: f.oldPath })}` : f.path}
                    onClick={() => update({ file: f.path })}
                  >
                    <span className={`snapshot-file-status st-${f.status.toLowerCase()}`}>{f.status}</span>
                    <span className="snapshot-file-path">{f.path}</span>
                    {!f.binary && (
                      <span className="compare-file-stat">
                        <span className="add">+{f.additions}</span> <span className="del">−{f.deletions}</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="compare-diff">
            {commitError !== undefined ? (
              <div className="bc-empty compare-error">{commitError}</div>
            ) : diff === undefined ? (
              <div className="bc-loading">
                <Loader2 size={20} className="spin" />
              </div>
            ) : !file ? (
              <div className="bc-empty">{mode === 'commit' && !commit ? t('compare.noUnique') : t('compare.noDiff')}</div>
            ) : (
              <>
                <div className="compare-diff-path">
                  <span className="compare-diff-file">{file.path}</span>
                  {file.oldPath && (
                    <span className="compare-diff-from">{interp(t('compare.renamedFrom'), { path: file.oldPath })}</span>
                  )}
                </div>
                {file.binary ? (
                  <div className="bc-empty">{t('compare.binary')}</div>
                ) : (
                  // Keyed by file so each opens scrolled to its top, not where the last one was.
                  <div className="compare-diff-scroll" key={`${mode}:${commit?.hash ?? ''}:${file.path}`}>
                    <DiffViewer diff={file.patch} file={file.path} lang={guessLanguage(file.path)} repoPath={repoPath} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
