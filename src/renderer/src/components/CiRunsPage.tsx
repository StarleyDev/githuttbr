import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Ban,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Workflow
} from 'lucide-react'
import type { CiRun, CiRunAction, CiRunJob, CiRunList, CiWorkflow } from '../../../shared/types'
import { hostingApi, shellApi } from '../infrastructure/api'
import { useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { interp, t as translateNow, useT } from '../i18n'
import {
  ciDot,
  ciElapsedMs,
  ciPollDelayMs,
  ciStateKey,
  formatElapsed,
  groupJobsByStage,
  hasActiveRuns,
  runActions,
  runHeadline,
  runMatches,
  runMetaName,
  runsSignature
} from '../lib/ciRuns'
import { timeAgo } from '../lib/timeAgo'
import { CheckLogPanel } from './CheckLogPanel'

type Tokens = { github?: string; gitlab?: string; forgejo?: string; azure?: string }

/**
 * The repository's CI runs — GitHub Actions, GitLab pipelines, Azure Pipelines
 * builds, Forgejo Actions — on one page: what ran, how it ended, each job and
 * its log, and re-run / cancel / start where the host allows it.
 */
export function CiRunsPage({ repoPath }: { repoPath: string }): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const openModal = useUIStore((s) => s.openModal)
  const profile = useSettingsStore((s) => s.activeProfile())
  const repoLoaded = useRepoStore((s) => !!s.repos[repoPath])
  const remotes = useRepoStore((s) => s.repos[repoPath]?.remotes)
  const commits = useRepoStore((s) => s.repos[repoPath]?.commits)
  const currentBranch = useRepoStore((s) => s.repos[repoPath]?.branches.current) ?? ''
  const remoteUrl = useMemo(
    () => (remotes?.find((r) => r.name === 'origin') ?? remotes?.[0])?.url ?? null,
    [remotes]
  )
  const tokens = useMemo<Tokens>(
    () => ({
      github: profile.githubToken || undefined,
      gitlab: profile.gitlabToken || undefined,
      forgejo: profile.forgejoToken || undefined,
      azure: profile.azureToken || undefined
    }),
    [profile.githubToken, profile.gitlabToken, profile.forgejoToken, profile.azureToken]
  )

  const [list, setList] = useState<CiRunList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [onlyBranch, setOnlyBranch] = useState(false)
  const [query, setQuery] = useState('')
  const [openRun, setOpenRun] = useState<string | null>(null)
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // Bumped after an action so the open run's jobs reload with the list.
  const [jobsTick, setJobsTick] = useState(0)

  const branch = onlyBranch && currentBranch ? currentBranch : undefined

  // The commit subjects the graph already loaded: GitLab's runs come without a title.
  const subjectOf = useMemo(() => {
    const bySha = new Map((commits ?? []).map((c) => [c.hash, c.subject]))
    return (sha: string): string | undefined => bySha.get(sha)
  }, [commits])

  // How many polls in a row came back unchanged — the poll slows down after a few.
  const unchangedPolls = useRef(0)
  const lastSignature = useRef('')

  const loadRuns = useCallback(async (): Promise<void> => {
    if (!remoteUrl) return
    setLoading(true)
    try {
      const next = await hostingApi.ciRuns(repoPath, remoteUrl, tokens, branch)
      const signature = runsSignature(next.runs)
      unchangedPolls.current = signature === lastSignature.current ? unchangedPolls.current + 1 : 0
      lastSignature.current = signature
      setList(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setNow(Date.now())
    }
  }, [repoPath, remoteUrl, tokens, branch])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  // Poll only while something is moving and someone is looking; a settled list
  // costs no requests, which matters against GitHub's hourly allowance. Each
  // wait is chosen after the previous answer, so a list that stopped changing
  // (a run waiting on an approval) is asked once a minute, not every 15 s.
  const active = !!list && hasActiveRuns(list.runs)
  useEffect(() => {
    if (!active) return
    let live = true
    let timer = 0
    const scheduleNextPoll = (): void => {
      timer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible') {
          await loadRuns()
          setJobsTick((n) => n + 1)
        }
        if (live) scheduleNextPoll()
      }, ciPollDelayMs(unchangedPolls.current))
    }
    scheduleNextPoll()
    // The elapsed time of a running job moves every second even between polls.
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      live = false
      window.clearTimeout(timer)
      window.clearInterval(clock)
    }
  }, [active, loadRuns])

  const runAction = async (run: CiRun, action: CiRunAction): Promise<void> => {
    if (!remoteUrl) return
    try {
      await hostingApi.ciRunAction(repoPath, remoteUrl, tokens, run.id, action)
      toast('success', t(action === 'cancel' ? 'ciRuns.cancelled' : 'ciRuns.rerunStarted'))
      await loadRuns()
      setJobsTick((n) => n + 1)
    } catch (err) {
      toast('error', interp(t('ciRuns.actionFailed'), { error: err instanceof Error ? err.message : String(err) }))
    }
  }

  // Stopping a run throws away the work in progress — say so before doing it.
  const confirmCancel = (run: CiRun): void =>
    openModal({
      kind: 'confirm',
      title: t('ciRuns.cancelTitle'),
      message: interp(t('ciRuns.cancelMessage'), { run: runHeadline(run, subjectOf) }),
      danger: true,
      confirmLabel: t('ciRuns.cancel'),
      onConfirm: () => void runAction(run, 'cancel')
    })

  const runs = useMemo(
    () => (list?.runs ?? []).filter((r) => runMatches(r, query, runHeadline(r, subjectOf))),
    [list, query, subjectOf]
  )

  return (
    <div className="changelog-page ci-runs-page">
      <div className="changelog-inner">
        <header className="changelog-header">
          <div className="changelog-title">
            <Workflow size={20} />
            <div>
              <h1>{t('ciRuns.title')}</h1>
              <span className="settings-hint">{t('ciRuns.subtitle')}</span>
            </div>
          </div>
        </header>

        {!repoLoaded ? (
          <div className="ci-runs-empty">
            <Loader2 size={15} className="spin" /> {t('common.loading')}
          </div>
        ) : !remoteUrl ? (
          <p className="ci-runs-empty">{t('ciRuns.noRemote')}</p>
        ) : list && !list.supported ? (
          <p className="ci-runs-empty">{t('ciRuns.unsupported')}</p>
        ) : (
          <>
            <div className="ci-runs-toolbar">
              <div className="codesearch-tabs" style={{ margin: 0 }}>
                <button className={`codesearch-tab ${!onlyBranch ? 'active' : ''}`} onClick={() => setOnlyBranch(false)}>
                  {t('ciRuns.allBranches')}
                </button>
                <button
                  className={`codesearch-tab ${onlyBranch ? 'active' : ''}`}
                  onClick={() => setOnlyBranch(true)}
                  disabled={!currentBranch}
                >
                  <GitBranch size={12} /> {currentBranch || t('ciRuns.currentBranch')}
                </button>
              </div>
              <input
                className="ci-runs-filter"
                value={query}
                placeholder={t('ciRuns.filter')}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button className="btn ghost small" onClick={() => void loadRuns()} disabled={loading} title={t('ciRuns.refresh')}>
                <RefreshCw size={13} className={loading ? 'spin' : undefined} />
              </button>
              {list?.capabilities.dispatch && (
                <button className="btn small" onClick={() => setDispatchOpen((v) => !v)} aria-expanded={dispatchOpen}>
                  <Play size={13} /> {t('ciRuns.runWorkflow')}
                </button>
              )}
            </div>

            {dispatchOpen && list?.capabilities.dispatch && (
              <DispatchForm
                repoPath={repoPath}
                remoteUrl={remoteUrl}
                tokens={tokens}
                defaultRef={currentBranch}
                onDone={() => {
                  setDispatchOpen(false)
                  // A dispatched run shows up a moment later, not in the same answer.
                  window.setTimeout(() => void loadRuns(), 3000)
                }}
              />
            )}

            {error && (
              <div className="ci-runs-error">
                {error}{' '}
                <button className="prp-link" onClick={() => void loadRuns()}>
                  {t('ciRuns.retry')}
                </button>
              </div>
            )}

            {!list && !error ? (
              <div className="ci-runs-empty">
                <Loader2 size={15} className="spin" /> {t('common.loading')}
              </div>
            ) : list && runs.length === 0 && !error ? (
              <p className="ci-runs-empty">{query.trim() ? t('ciRuns.noMatches') : t('ciRuns.empty')}</p>
            ) : (
              <ul className="ci-runs-list">
                {runs.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    headline={runHeadline(run, subjectOf)}
                    now={now}
                    open={openRun === run.id}
                    onToggle={() => setOpenRun(openRun === run.id ? null : run.id)}
                    actions={list ? runActions(run, list.capabilities) : { rerun: false, rerunFailed: false, cancel: false }}
                    onAction={(action) => (action === 'cancel' ? confirmCancel(run) : void runAction(run, action))}
                    repoPath={repoPath}
                    remoteUrl={remoteUrl}
                    tokens={tokens}
                    jobsTick={jobsTick}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RunRow({
  run,
  headline,
  now,
  open,
  onToggle,
  actions,
  onAction,
  repoPath,
  remoteUrl,
  tokens,
  jobsTick
}: {
  run: CiRun
  headline: string
  now: number
  open: boolean
  onToggle: () => void
  actions: { rerun: boolean; rerunFailed: boolean; cancel: boolean }
  onAction: (action: CiRunAction) => void
  repoPath: string
  remoteUrl: string
  tokens: Tokens
  jobsTick: number
}): React.JSX.Element {
  const t = useT()
  const elapsed = ciElapsedMs(run, now)
  const ago = timeAgo(run.createdAt, now)
  const meta = [
    runMetaName(run, headline),
    run.number != null ? `#${run.number}` : null,
    run.event,
    run.actor
  ].filter((part): part is string => !!part)

  return (
    <li className={`ci-run${open ? ' open' : ''}`}>
      <div className="ci-run-head">
        <button className="ci-run-toggle" onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className={`prd-check-dot ${ciDot(run.phase, run.outcome)}`} />
          <span className="ci-run-info">
            <strong>{headline}</strong>
            <span className="ci-run-meta">
              {run.branch && (
                <span className="ci-run-branch">
                  <GitBranch size={11} /> {run.branch}
                </span>
              )}
              {meta.map((part, i) => (
                <span key={i}>{part}</span>
              ))}
              <code>{run.sha.slice(0, 7)}</code>
            </span>
          </span>
          <span className="ci-run-state">
            {t(ciStateKey(run.phase, run.outcome))}
            {elapsed !== null && <span className="ci-run-time">{formatElapsed(elapsed)}</span>}
            {ago && <span className="ci-run-ago">{interp(t(ago.key), { n: ago.n })}</span>}
          </span>
        </button>
        <span className="ci-run-actions">
          {actions.rerunFailed && (
            <button className="btn ghost small" title={t('ciRuns.rerunFailed')} onClick={() => onAction('rerun-failed')}>
              <RotateCcw size={13} /> {t('ciRuns.rerunFailedShort')}
            </button>
          )}
          {actions.rerun && (
            <button className="btn ghost small" title={t('ciRuns.rerun')} onClick={() => onAction('rerun')}>
              <RefreshCw size={13} />
            </button>
          )}
          {actions.cancel && (
            <button className="btn ghost small" title={t('ciRuns.cancel')} onClick={() => onAction('cancel')}>
              <Ban size={13} />
            </button>
          )}
          {run.url && (
            <button className="btn ghost small" title={t('common.openInBrowser')} onClick={() => void shellApi.openExternal(run.url)}>
              <ExternalLink size={13} />
            </button>
          )}
        </span>
      </div>
      {open && <RunJobs run={run} now={now} repoPath={repoPath} remoteUrl={remoteUrl} tokens={tokens} tick={jobsTick} />}
    </li>
  )
}

function RunJobs({
  run,
  now,
  repoPath,
  remoteUrl,
  tokens,
  tick
}: {
  run: CiRun
  now: number
  repoPath: string
  remoteUrl: string
  tokens: Tokens
  tick: number
}): React.JSX.Element {
  const t = useT()
  const [jobs, setJobs] = useState<CiRunJob[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    hostingApi
      .ciRunJobs(repoPath, remoteUrl, tokens, run.id)
      .then((j) => {
        if (!live) return
        setJobs(j)
        setError(null)
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [repoPath, remoteUrl, tokens, run.id, tick])

  if (error && !jobs) return <div className="ci-run-jobs ci-runs-error">{error}</div>
  if (!jobs) {
    return (
      <div className="ci-run-jobs prp-muted">
        <Loader2 size={13} className="spin" /> {t('common.loading')}
      </div>
    )
  }
  if (jobs.length === 0) return <div className="ci-run-jobs prp-muted">{t('ciRuns.noJobs')}</div>

  return (
    <div className="ci-run-jobs">
      {groupJobsByStage(jobs).map((group) => (
        <section key={group.stage || '-'} className="ci-stage">
          {group.stage && <div className="ci-stage-name">{group.stage}</div>}
          {group.jobs.map((job) => (
            <JobRow key={job.id} job={job} runId={run.id} now={now} repoPath={repoPath} remoteUrl={remoteUrl} tokens={tokens} />
          ))}
        </section>
      ))}
    </div>
  )
}

function JobRow({
  job,
  runId,
  now,
  repoPath,
  remoteUrl,
  tokens
}: {
  job: CiRunJob
  runId: string
  now: number
  repoPath: string
  remoteUrl: string
  tokens: Tokens
}): React.JSX.Element {
  const t = useT()
  const [showSteps, setShowSteps] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const elapsed = ciElapsedMs(job, now)
  // Stable across renders: a new function would make the panel fetch the log again.
  const jobId = job.id
  const loadLog = useCallback(
    () => hostingApi.ciJobLog(repoPath, remoteUrl, tokens, runId, jobId),
    [repoPath, remoteUrl, tokens, runId, jobId]
  )
  // A job that fails while its steps are hidden opens them: the failing step is the news.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (!autoOpened.current && job.outcome === 'failure' && job.steps.length > 0) {
      autoOpened.current = true
      setShowSteps(true)
    }
  }, [job.outcome, job.steps.length])

  return (
    <div className="ci-job">
      <div className="prd-check">
        {job.steps.length > 0 ? (
          <button className="ci-job-toggle" onClick={() => setShowSteps((v) => !v)} aria-expanded={showSteps} title={t('ciRuns.steps')}>
            {showSteps ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="ci-job-toggle-space" />
        )}
        <span className={`prd-check-dot ${ciDot(job.phase, job.outcome)}`} />
        <span className="prd-check-name">{job.name}</span>
        <span className="prd-check-state">
          {t(ciStateKey(job.phase, job.outcome))}
          {elapsed !== null && <span className="ci-run-time">{formatElapsed(elapsed)}</span>}
        </span>
        {job.hasLog && (
          <button
            className="prd-check-logs"
            title={showLog ? t('prPage.hideLog') : t('prPage.showLog')}
            aria-expanded={showLog}
            onClick={() => setShowLog((v) => !v)}
          >
            <ScrollText size={12} />
          </button>
        )}
        {job.url && (
          <button className="prd-check-logs" title={t('common.openInBrowser')} onClick={() => void shellApi.openExternal(job.url)}>
            <ExternalLink size={12} />
          </button>
        )}
      </div>
      {showSteps && (
        <ol className="ci-steps">
          {job.steps.map((step, i) => {
            const stepElapsed = ciElapsedMs(step, now)
            return (
              <li key={i} className="ci-step">
                <span className={`prd-check-dot ${ciDot(step.phase, step.outcome)}`} />
                <span className="ci-step-name">{step.name}</span>
                <span className="prd-check-state">
                  {t(ciStateKey(step.phase, step.outcome))}
                  {stepElapsed !== null && <span className="ci-run-time">{formatElapsed(stepElapsed)}</span>}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {showLog && <CheckLogPanel repoPath={repoPath} remoteUrl={remoteUrl} tokens={tokens} url={job.url} loadLog={loadLog} />}
    </div>
  )
}

function DispatchForm({
  repoPath,
  remoteUrl,
  tokens,
  defaultRef,
  onDone
}: {
  repoPath: string
  remoteUrl: string
  tokens: Tokens
  defaultRef: string
  onDone: () => void
}): React.JSX.Element {
  const t = useT()
  const [workflows, setWorkflows] = useState<CiWorkflow[] | null>(null)
  const [workflowId, setWorkflowId] = useState('')
  const [ref, setRef] = useState(defaultRef)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    hostingApi
      .ciWorkflows(repoPath, remoteUrl, tokens)
      .then((list) => {
        if (!live) return
        setWorkflows(list)
        setWorkflowId((cur) => cur || list[0]?.id || '')
      })
      .catch((err) => {
        if (!live) return
        setWorkflows([])
        // The non-reactive t and the store's toast: `useT()` hands out a new
        // function every render, and as a dependency here it re-ran this fetch
        // after every answer — a request loop for as long as the form was open.
        useUIStore
          .getState()
          .toast('error', interp(translateNow('ciRuns.actionFailed'), { error: err instanceof Error ? err.message : String(err) }))
      })
    return () => {
      live = false
    }
  }, [repoPath, remoteUrl, tokens])

  const startWorkflow = async (): Promise<void> => {
    const toast = useUIStore.getState().toast
    setBusy(true)
    try {
      await hostingApi.ciDispatch(repoPath, remoteUrl, tokens, workflowId, ref.trim())
      toast('success', interp(t('ciRuns.dispatched'), { ref: ref.trim() }))
      onDone()
    } catch (err) {
      toast('error', interp(t('ciRuns.actionFailed'), { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ci-dispatch">
      <p className="settings-hint">{t('ciRuns.dispatchHint')}</p>
      <div className="ci-dispatch-row">
        <label>
          {t('ciRuns.workflow')}
          <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} disabled={!workflows?.length}>
            {(workflows ?? []).map((w) => (
              <option key={w.id} value={w.id} title={w.path}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('ciRuns.branch')}
          <input value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>
        <button className="btn primary small" onClick={() => void startWorkflow()} disabled={busy || !workflowId || !ref.trim()}>
          {busy ? <Loader2 size={13} className="spin" /> : <Play size={13} />} {t('ciRuns.start')}
        </button>
      </div>
      {workflows !== null && workflows.length === 0 && <p className="prp-muted">{t('ciRuns.noWorkflows')}</p>}
    </div>
  )
}
