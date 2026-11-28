import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, Play, RefreshCw, Workflow } from 'lucide-react'
import type { CiRun, CiRunAction, CiRunJob, CiRunList, CiWorkflow } from '../../../shared/types'
import { hostingApi, shellApi } from '../infrastructure/api'
import { useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { PageHead } from './PageHead'
import { interp, t as translateNow, useT } from '../i18n'
import {
  ciDot,
  ciElapsedMs,
  ciPollDelayMs,
  ciJobStateKey,
  ciStateKey,
  groupJobsByStage,
  hasActiveRuns,
  runActions,
  runHeadline,
  runMatches,
  runMetaName,
  runsSignature
} from '../lib/ciRuns'
import {
  getDurationPhrase,
  getFailedJob,
  getPassRateTone,
  getQuickFilterCounts,
  getRunProgress,
  getWorkflowKey,
  getWorkflowSummaries,
  runMatchesQuickFilter,
  type QuickFilter,
  type WorkflowSummary
} from '../lib/ciRunsOverview'
import { getFailedTests } from '../lib/testFailures'
import { timeAgo } from '../lib/timeAgo'
import { CheckLogPanel } from './CheckLogPanel'
import { FailedTests } from './PrChecksSection'

type Tokens = { github?: string; gitlab?: string; forgejo?: string; azure?: string }

/** A duration as the page writes it: "4 min 24 s". */
function sayDuration(ms: number): string {
  const p = getDurationPhrase(ms)
  return interp(translateNow(p.key), p.vars)
}

/**
 * The repository's CI runs — GitHub Actions, GitLab pipelines, Azure Pipelines
 * builds, Forgejo Actions — on one page: a card per workflow with its recent
 * history, then what ran, how it ended, each job and its log, and re-run /
 * cancel / start where the host allows it.
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
  const [workflowFilter, setWorkflowFilter] = useState<string | null>(null)
  const [quickFilter, setQuickFilter] = useState<QuickFilter | null>(null)
  const [openRun, setOpenRun] = useState<string | null>(null)
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // Bumped after an action and on every poll, so the jobs the page holds reload with the list.
  const [jobsTick, setJobsTick] = useState(0)
  const [jobsByRun, setJobsByRun] = useState<Record<string, CiRunJob[]>>({})
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({})

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

  // The newest failed run opens on its own the first time the list arrives:
  // which test broke is what someone opens this page for.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (!list || autoOpened.current) return
    autoOpened.current = true
    const failed = list.runs.find((r) => r.phase === 'completed' && r.outcome === 'failure')
    if (failed) setOpenRun((cur) => cur ?? failed.id)
  }, [list])

  // Jobs are asked only for the open run and for running runs — a running run's
  // card shows which step it is on. Everything else stays one request: the list.
  const jobsWanted = useMemo(() => {
    const ids = new Set((list?.runs ?? []).filter((r) => r.phase !== 'completed').map((r) => r.id))
    if (openRun) ids.add(openRun)
    return [...ids].sort().join(',')
  }, [list, openRun])
  const jobsAskedAt = useRef<Record<string, number>>({})
  useEffect(() => {
    if (!remoteUrl || !jobsWanted) return
    for (const id of jobsWanted.split(',')) {
      // Once per tick: opening another run must not ask again for the ones already held.
      if (jobsAskedAt.current[id] === jobsTick) continue
      jobsAskedAt.current[id] = jobsTick
      hostingApi
        .ciRunJobs(repoPath, remoteUrl, tokens, id)
        .then((jobs) => {
          setJobsByRun((m) => ({ ...m, [id]: jobs }))
          setJobErrors((m) => {
            if (!(id in m)) return m
            const next = { ...m }
            delete next[id]
            return next
          })
        })
        .catch((err) => setJobErrors((m) => ({ ...m, [id]: err instanceof Error ? err.message : String(err) })))
    }
  }, [jobsWanted, jobsTick, repoPath, remoteUrl, tokens])

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

  const workflows = useMemo(() => getWorkflowSummaries(list?.runs ?? [], jobsByRun, now), [list, jobsByRun, now])
  // The quick filters count what the other filters leave, so each number is what a click shows.
  const narrowed = useMemo(
    () =>
      (list?.runs ?? []).filter(
        (r) =>
          (workflowFilter === null || getWorkflowKey(r) === workflowFilter) &&
          runMatches(r, query, runHeadline(r, subjectOf))
      ),
    [list, query, subjectOf, workflowFilter]
  )
  const quickCounts = useMemo(() => getQuickFilterCounts(narrowed), [narrowed])
  const runs = useMemo(() => narrowed.filter((r) => runMatchesQuickFilter(r, quickFilter)), [narrowed, quickFilter])
  const filtering = !!query.trim() || workflowFilter !== null || quickFilter !== null
  // The controls only make sense once there is a host to ask: same gate as the list below.
  const ready = repoLoaded && !!remoteUrl && !(list && !list.supported)

  const openPullRequest = (run: CiRun): void => {
    if (!remoteUrl || run.pullRequest == null) return
    useSettingsStore.getState().openPageTab({
      type: 'pr',
      repoPath,
      remoteUrl,
      number: run.pullRequest,
      title: runHeadline(run, subjectOf)
    })
  }

  return (
    <div className="changelog-page ci-runs-page">
      <div className="changelog-inner">
        <PageHead>
          <header className="ci-runs-header">
            <Workflow size={22} className="ci-runs-icon" aria-hidden="true" />
            <div className="ci-runs-heading">
              <h1>{t('ciRuns.title')}</h1>
              <span className="ci-runs-subtitle">{t('ciRuns.subtitle')}</span>
            </div>
            <span className="ci-runs-spacer" />
            {ready && (
              <button className="btn ghost small" onClick={() => void loadRuns()} disabled={loading} title={t('ciRuns.refresh')}>
                <RefreshCw size={13} className={loading ? 'spin' : undefined} />
              </button>
            )}
            {ready && list?.capabilities.dispatch && (
              <button className="ci-runs-btn" onClick={() => setDispatchOpen((v) => !v)} aria-expanded={dispatchOpen}>
                {t('ciRuns.runWorkflow')}
              </button>
            )}
          </header>
        </PageHead>

        {!repoLoaded ? (
          <div className="ci-runs-empty">
            <Loader2 size={15} className="spin" /> {t('common.loading')}
          </div>
        ) : !remoteUrl ? (
          <p className="ci-runs-empty">{t('ciRuns.noRemote')}</p>
        ) : list && !list.supported ? (
          <p className="ci-runs-empty">{t('ciRuns.unsupported')}</p>
        ) : (
          <div className="ci-runs-body">
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

            {workflows.length > 0 && (
              <WorkflowCards
                workflows={workflows}
                selected={workflowFilter}
                now={now}
                onSelect={(key) => setWorkflowFilter((cur) => (cur === key ? null : key))}
              />
            )}

            <div className="ci-runs-controls">
              <span className="ci-seg" role="group">
                <button className={`ci-seg-btn ${!onlyBranch ? 'active' : ''}`} aria-pressed={!onlyBranch} onClick={() => setOnlyBranch(false)}>
                  {t('ciRuns.allBranches')}
                </button>
                <button
                  className={`ci-seg-btn ${onlyBranch ? 'active' : ''}`}
                  aria-pressed={onlyBranch}
                  onClick={() => setOnlyBranch(true)}
                  disabled={!currentBranch}
                >
                  {currentBranch || t('ciRuns.currentBranch')}
                </button>
              </span>
              <span className="ci-quick">
                <button
                  className={`ci-quick-chip fail ${quickFilter === 'failed' ? 'active' : ''}`}
                  aria-pressed={quickFilter === 'failed'}
                  disabled={quickCounts.failed === 0 && quickFilter !== 'failed'}
                  onClick={() => setQuickFilter((f) => (f === 'failed' ? null : 'failed'))}
                >
                  {interp(t('ciRuns.quickFailed'), { count: String(quickCounts.failed) })}
                </button>
                <button
                  className={`ci-quick-chip running ${quickFilter === 'running' ? 'active' : ''}`}
                  aria-pressed={quickFilter === 'running'}
                  disabled={quickCounts.running === 0 && quickFilter !== 'running'}
                  onClick={() => setQuickFilter((f) => (f === 'running' ? null : 'running'))}
                >
                  {interp(t('ciRuns.quickRunning'), { count: String(quickCounts.running) })}
                </button>
              </span>
              <input
                className="ci-runs-filter"
                value={query}
                placeholder={t('ciRuns.filter')}
                aria-label={t('ciRuns.filter')}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

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
              <p className="ci-runs-empty">{filtering ? t('ciRuns.noMatches') : t('ciRuns.empty')}</p>
            ) : (
              <ul className="ci-runs-list">
                {runs.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    headline={runHeadline(run, subjectOf)}
                    now={now}
                    open={openRun === run.id}
                    onToggle={() => setOpenRun(openRun === run.id ? null : run.id)}
                    actions={list ? runActions(run, list.capabilities) : { rerun: false, rerunFailed: false, cancel: false }}
                    onAction={(action) => (action === 'cancel' ? confirmCancel(run) : void runAction(run, action))}
                    onOpenPullRequest={() => openPullRequest(run)}
                    jobs={jobsByRun[run.id]}
                    jobsError={jobErrors[run.id] ?? null}
                    repoPath={repoPath}
                    remoteUrl={remoteUrl}
                    tokens={tokens}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** One card per workflow: its triggers, pass rate, last runs as squares, and how long it takes. */
function WorkflowCards({
  workflows,
  selected,
  now,
  onSelect
}: {
  workflows: WorkflowSummary[]
  selected: string | null
  now: number
  onSelect: (key: string) => void
}): React.JSX.Element {
  const t = useT()
  return (
    <div className="ci-wf-grid" role="group" aria-label={t('ciRuns.workflows')}>
      {workflows.map((w) => {
        const name = w.name || t('ciRuns.unnamedWorkflow')
        const note = w.note
        const noteText = !note
          ? null
          : note.kind === 'slowest'
            ? interp(t('ciRuns.slowestJob'), { job: note.job })
            : note.kind === 'cancelled'
              ? t('ciRuns.lastRunCancelled')
              : note.kind === 'failed'
                ? t('ciRuns.lastRunFailed')
                : (() => {
                    const ago = timeAgo(note.at, now)
                    return ago ? interp(t('ciRuns.lastRunAgo'), { ago: interp(t(ago.key), { n: ago.n }) }) : null
                  })()
        const foot = [w.averageMs !== null ? interp(t('ciRuns.averageTime'), { duration: sayDuration(w.averageMs) }) : null, noteText]
          .filter(Boolean)
          .join(' · ')
        return (
          <button
            key={w.key}
            className={`ci-wf-card ${selected === w.key ? 'active' : ''}`}
            aria-pressed={selected === w.key}
            title={interp(t('ciRuns.filterByWorkflow'), { workflow: name })}
            onClick={() => onSelect(w.key)}
          >
            <span className="ci-wf-top">
              <b className="ci-wf-name">{name}</b>
              {w.triggers.length > 0 && <span className="ci-wf-triggers">{w.triggers.join(' · ')}</span>}
              <span className="ci-runs-spacer" />
              {w.passRate !== null && (
                <span className={`ci-wf-rate ${getPassRateTone(w.passRate)}`}>
                  {interp(t('ciRuns.passRate'), { rate: String(w.passRate) })}
                </span>
              )}
            </span>
            <span
              className="ci-wf-squares"
              role="img"
              aria-label={interp(t('ciRuns.recentRuns'), {
                count: String(w.recent.length),
                passed: String(w.passed),
                failed: String(w.failed)
              })}
            >
              {w.recent.map((square, i) => (
                <span key={i} className={`ci-wf-square ${square}`} />
              ))}
            </span>
            {foot && <span className="ci-wf-foot">{foot}</span>}
          </button>
        )
      })}
    </div>
  )
}

function RunCard({
  run,
  headline,
  now,
  open,
  onToggle,
  actions,
  onAction,
  onOpenPullRequest,
  jobs,
  jobsError,
  repoPath,
  remoteUrl,
  tokens
}: {
  run: CiRun
  headline: string
  now: number
  open: boolean
  onToggle: () => void
  actions: { rerun: boolean; rerunFailed: boolean; cancel: boolean }
  onAction: (action: CiRunAction) => void
  onOpenPullRequest: () => void
  jobs: CiRunJob[] | undefined
  jobsError: string | null
  repoPath: string
  remoteUrl: string
  tokens: Tokens
}): React.JSX.Element {
  const t = useT()
  const dot = ciDot(run.phase, run.outcome)
  const elapsed = ciElapsedMs(run, now)
  const ago = timeAgo(run.createdAt, now)
  const metaName = runMetaName(run, headline)
  // "CI #147": the workflow and its run number read as one name.
  const workflowLabel = [metaName, run.number != null ? `#${run.number}` : null].filter(Boolean).join(' ')
  const progress = run.phase === 'running' && jobs ? getRunProgress(jobs) : null
  const stateLine = [
    t(ciStateKey(run.phase, run.outcome)),
    elapsed !== null ? sayDuration(elapsed) : null,
    ago && run.phase === 'completed' ? interp(t(ago.key), { n: ago.n }) : null
  ]
    .filter(Boolean)
    .join(' · ')

  const copySha = (): void => {
    void navigator.clipboard.writeText(run.sha).then(() => useUIStore.getState().toast('success', t('ciRuns.shaCopied')))
  }

  // The whole header opens the run, except the links and buttons inside it.
  const onHeadClick = (e: React.MouseEvent<HTMLElement>): void => {
    if ((e.target as HTMLElement).closest('button, a, input')) return
    onToggle()
  }

  return (
    <li className={`ci-run ${dot}${open ? ' open' : ''}`}>
      <header className="ci-run-head" onClick={onHeadClick}>
        <span className={`ci-run-dot ${dot}`} aria-hidden="true" />
        <span className="ci-run-info">
          <button className="ci-run-title" onClick={onToggle} aria-expanded={open}>
            {headline}
          </button>
          <span className="ci-run-meta">
            {run.branch && <span className="mono">{run.branch}</span>}
            {workflowLabel && <span>{workflowLabel}</span>}
            {run.event && <span>{run.event}</span>}
            {run.actor && <span>{run.actor}</span>}
            {open && run.sha && (
              <span>
                <button className="ci-run-link mono" title={t('ciRuns.copySha')} onClick={copySha}>
                  {run.sha.slice(0, 7)}
                </button>
              </span>
            )}
            {run.pullRequest != null && (
              <span>
                <button
                  className="ci-run-link"
                  title={interp(t('ciRuns.openPullRequest'), { number: String(run.pullRequest) })}
                  onClick={onOpenPullRequest}
                >
                  {interp(t('ciRuns.pullRequest'), { number: String(run.pullRequest) })}
                </button>
              </span>
            )}
          </span>
        </span>
        <span className="ci-runs-spacer" />
        {progress ? (
          <span className="ci-run-progress">
            {interp(t(progress.unit === 'step' ? 'ciRuns.runningStep' : 'ciRuns.runningJob'), {
              current: String(progress.current),
              total: String(progress.total)
            })}
            <span className="ci-run-bar" aria-hidden="true">
              <span style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
            </span>
            {elapsed !== null && sayDuration(elapsed)}
          </span>
        ) : (
          <span className={`ci-run-state ${dot}`}>{stateLine}</span>
        )}
        {actions.rerunFailed && (
          <button className="ci-runs-btn" title={t('ciRuns.rerunFailed')} onClick={() => onAction('rerun-failed')}>
            {t('ciRuns.rerunFailedShort')}
          </button>
        )}
        {actions.cancel && (
          <button className="ci-runs-btn" title={t('ciRuns.cancel')} onClick={() => onAction('cancel')}>
            {t('ciRuns.cancelShort')}
          </button>
        )}
        {/* Run everything again and the host's page: one hover away, so the card reads as drawn. */}
        <span className="ci-run-more">
          {actions.rerun && (
            <button className="btn ghost small" title={t('ciRuns.rerun')} onClick={() => onAction('rerun')}>
              <RefreshCw size={13} />
            </button>
          )}
          {run.url && (
            <button className="btn ghost small" title={t('common.openInBrowser')} onClick={() => void shellApi.openExternal(run.url)}>
              <ExternalLink size={13} />
            </button>
          )}
        </span>
      </header>
      {open && (
        <RunBody run={run} jobs={jobs} jobsError={jobsError} now={now} repoPath={repoPath} remoteUrl={remoteUrl} tokens={tokens} />
      )}
    </li>
  )
}

function RunBody({
  run,
  jobs,
  jobsError,
  now,
  repoPath,
  remoteUrl,
  tokens
}: {
  run: CiRun
  jobs: CiRunJob[] | undefined
  jobsError: string | null
  now: number
  repoPath: string
  remoteUrl: string
  tokens: Tokens
}): React.JSX.Element {
  const t = useT()
  if (jobsError && !jobs) return <div className="ci-run-body ci-runs-error">{jobsError}</div>
  if (!jobs) {
    return (
      <div className="ci-run-body prp-muted">
        <Loader2 size={13} className="spin" /> {t('common.loading')}
      </div>
    )
  }
  if (jobs.length === 0) return <div className="ci-run-body prp-muted">{t('ciRuns.noJobs')}</div>
  const failedJob = run.outcome === 'failure' ? getFailedJob(jobs) : null

  return (
    <>
      {failedJob && (
        <FailedJobTests key={failedJob.id} runId={run.id} job={failedJob} repoPath={repoPath} remoteUrl={remoteUrl} tokens={tokens} />
      )}
      <div className="ci-run-body">
        {groupJobsByStage(jobs).map((group) => (
          <section key={group.stage || '-'} className="ci-stage">
            {group.stage && <div className="ci-stage-name">{group.stage}</div>}
            {group.jobs.map((job) => (
              <JobRow key={job.id} job={job} runId={run.id} now={now} repoPath={repoPath} remoteUrl={remoteUrl} tokens={tokens} />
            ))}
          </section>
        ))}
      </div>
    </>
  )
}

/** The tests the failed job's log names, as the PR's Checks tab shows them. Nothing when the log names none. */
function FailedJobTests({
  runId,
  job,
  repoPath,
  remoteUrl,
  tokens
}: {
  runId: string
  job: CiRunJob
  repoPath: string
  remoteUrl: string
  tokens: Tokens
}): React.JSX.Element | null {
  const t = useT()
  const [log, setLog] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    hostingApi
      .ciJobLog(repoPath, remoteUrl, tokens, runId, job.id)
      .then((text) => live && setLog(text))
      // A log the host will not hand over leaves the job list to speak for itself.
      .catch(() => live && setLog(null))
    return () => {
      live = false
    }
  }, [repoPath, remoteUrl, tokens, runId, job.id])
  const failures = useMemo(() => (log ? getFailedTests(log) : []), [log])
  if (failures.length === 0) return null
  return (
    <FailedTests
      failures={failures}
      repoPath={repoPath}
      prFiles={null}
      onShowFile={() => undefined}
      heading={(tests) => interp(t('ciRuns.jobTestsFailed'), { job: job.name, tests })}
    />
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
  const [showDetail, setShowDetail] = useState(false)
  const elapsed = ciElapsedMs(job, now)
  const dot = ciDot(job.phase, job.outcome)
  // Stable across renders: a new function would make the panel fetch the log again.
  const jobId = job.id
  const loadLog = useCallback(
    () => hostingApi.ciJobLog(repoPath, remoteUrl, tokens, runId, jobId),
    [repoPath, remoteUrl, tokens, runId, jobId]
  )
  const hasDetail = job.steps.length > 0 || job.hasLog || !!job.url
  const stateLine = [t(ciJobStateKey(job.phase, job.outcome)), elapsed !== null ? sayDuration(elapsed) : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={`ci-job ${dot}`}>
      <div className="ci-job-line">
        <span className={`ci-job-dot ${dot}`} aria-hidden="true" />
        <span className="ci-job-name">{job.name}</span>
        <span className="ci-runs-spacer" />
        {hasDetail && (
          <button className="ci-job-view" aria-expanded={showDetail} onClick={() => setShowDetail((v) => !v)}>
            {showDetail ? t('ciRuns.hideStepsAndLog') : t('ciRuns.viewStepsAndLog')}
          </button>
        )}
        <span className={`ci-job-state ${dot}`}>{stateLine}</span>
      </div>
      {showDetail && (
        <div className="ci-job-detail">
          {job.steps.length > 0 && (
            <ol className="ci-steps">
              {job.steps.map((step, i) => {
                const stepElapsed = ciElapsedMs(step, now)
                return (
                  <li key={i} className="ci-step">
                    <span className={`prd-check-dot ${ciDot(step.phase, step.outcome)}`} />
                    <span className="ci-step-name">{step.name}</span>
                    <span className="prd-check-state">
                      {t(ciStateKey(step.phase, step.outcome))}
                      {stepElapsed !== null && <span className="ci-run-time">{sayDuration(stepElapsed)}</span>}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
          {job.url && (
            <button className="pck-link" onClick={() => void shellApi.openExternal(job.url)}>
              <ExternalLink size={11} /> {t('common.openInBrowser')}
            </button>
          )}
          {job.hasLog && <CheckLogPanel repoPath={repoPath} remoteUrl={remoteUrl} tokens={tokens} url={job.url} loadLog={loadLog} />}
        </div>
      )}
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
