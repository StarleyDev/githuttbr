import type { CiRun, CiRunJob } from '../../../shared/types'
import { ciElapsedMs } from './ciRuns'
import { formatCheckDuration, type Phrase } from './prChecksView'

// The overview above the CI runs list — one card per workflow, the quick
// filters, a running run's progress — computed from the runs the page already
// listed. No extra request: a workflow's history is the slice of the list it
// owns, which is the last 50 runs at most.

/** How many of a workflow's runs its card draws as squares. */
export const RECENT_RUNS = 10

/** A run as one square on a workflow card. */
export type RunSquare = 'passed' | 'failed' | 'running' | 'cancelled'

export function getRunSquare(run: Pick<CiRun, 'phase' | 'outcome'>): RunSquare {
  if (run.phase !== 'completed') return 'running'
  if (run.outcome === 'success') return 'passed'
  if (run.outcome === 'failure') return 'failed'
  return 'cancelled'
}

/** Which colour a pass rate reads in: all but one in ten passing is healthy, under seven is not. */
export type PassRateTone = 'good' | 'warn' | 'bad'

export function getPassRateTone(rate: number): PassRateTone {
  if (rate >= 90) return 'good'
  if (rate >= 70) return 'warn'
  return 'bad'
}

/** What a card says after its average: the slowest job when known, else how the last run went. */
export type WorkflowNote =
  | { kind: 'slowest'; job: string }
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  | { kind: 'ago'; at: number }

export interface WorkflowSummary {
  /** What the card filters by: the definition's id, else its name. */
  key: string
  /** Empty when the host names none (a GitLab pipeline without `workflow:name`). */
  name: string
  /** The events that started its runs, most frequent first. */
  triggers: string[]
  /** Percent of its finished runs among the recent ones that passed; null when none finished. */
  passRate: number | null
  /** Oldest first, so the newest run sits at the right end, next to "now". */
  recent: RunSquare[]
  passed: number
  failed: number
  /** The average time of its finished runs, null when none has times. */
  averageMs: number | null
  note: WorkflowNote | null
}

/** The key a run is grouped and filtered under. */
export function getWorkflowKey(run: Pick<CiRun, 'workflowId' | 'name'>): string {
  return run.workflowId ?? run.name
}

/** The job that took longest, among the jobs of one run. Null when none has times. */
export function getSlowestJob(jobs: readonly CiRunJob[], now: number): string | null {
  let best: { name: string; ms: number } | null = null
  for (const job of jobs) {
    if (job.phase !== 'completed') continue
    const ms = ciElapsedMs(job, now)
    if (ms !== null && (!best || ms > best.ms)) best = { name: job.name, ms }
  }
  return best?.name ?? null
}

/**
 * One summary per workflow, the most recently run first. `runs` is the list as
 * the host answered it, newest first; `jobsByRun` holds whatever jobs the page
 * already fetched, from which a card can name its slowest job.
 */
export function getWorkflowSummaries(
  runs: readonly CiRun[],
  jobsByRun: Readonly<Record<string, readonly CiRunJob[]>>,
  now: number
): WorkflowSummary[] {
  const groups = new Map<string, CiRun[]>()
  for (const run of runs) {
    const key = getWorkflowKey(run)
    const list = groups.get(key)
    if (list) list.push(run)
    else groups.set(key, [run])
  }

  return [...groups.entries()].map(([key, all]) => {
    const recent = all.slice(0, RECENT_RUNS)
    const squares = recent.map(getRunSquare)
    const finished = recent.filter((r) => r.phase === 'completed')
    const passed = squares.filter((s) => s === 'passed').length
    const failed = squares.filter((s) => s === 'failed').length

    const counts = new Map<string, number>()
    for (const r of all) if (r.event) counts.set(r.event, (counts.get(r.event) ?? 0) + 1)
    const triggers = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([event]) => event)

    const times = finished.map((r) => ciElapsedMs(r, now)).filter((ms): ms is number => ms !== null)
    const averageMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null

    return {
      key,
      name: all[0].name,
      triggers,
      passRate: finished.length ? Math.round((passed / finished.length) * 100) : null,
      recent: squares.reverse(),
      passed,
      failed,
      averageMs,
      note: getWorkflowNote(recent, jobsByRun, now)
    }
  })
}

function getWorkflowNote(
  recent: readonly CiRun[],
  jobsByRun: Readonly<Record<string, readonly CiRunJob[]>>,
  now: number
): WorkflowNote | null {
  // The newest finished run whose jobs the page holds speaks for the workflow.
  for (const run of recent) {
    const jobs = jobsByRun[run.id]
    if (run.phase !== 'completed' || !jobs) continue
    const job = getSlowestJob(jobs, now)
    if (job) return { kind: 'slowest', job }
  }
  const last = recent.find((r) => r.phase === 'completed')
  if (!last) return null
  if (last.outcome === 'cancelled') return { kind: 'cancelled' }
  if (last.outcome === 'failure') return { kind: 'failed' }
  return { kind: 'ago', at: last.finishedAt ?? last.createdAt }
}

/** The quick filters next to the branch switch. */
export type QuickFilter = 'failed' | 'running'

export function runMatchesQuickFilter(run: Pick<CiRun, 'phase' | 'outcome'>, filter: QuickFilter | null): boolean {
  if (filter === 'failed') return run.phase === 'completed' && run.outcome === 'failure'
  if (filter === 'running') return run.phase !== 'completed'
  return true
}

export function getQuickFilterCounts(runs: readonly Pick<CiRun, 'phase' | 'outcome'>[]): Record<QuickFilter, number> {
  return {
    failed: runs.filter((r) => runMatchesQuickFilter(r, 'failed')).length,
    running: runs.filter((r) => runMatchesQuickFilter(r, 'running')).length
  }
}

/**
 * How far a running run has got: the step the running job is on, out of its
 * steps — or, for a host that reports no steps (GitLab, Forgejo), the job out
 * of the run's jobs. Null before any job has started.
 */
export interface RunProgress {
  unit: 'step' | 'job'
  current: number
  total: number
}

export function getRunProgress(jobs: readonly CiRunJob[]): RunProgress | null {
  const job = jobs.find((j) => j.phase === 'running')
  if (job && job.steps.length > 0) {
    const at = job.steps.findIndex((s) => s.phase !== 'completed')
    return { unit: 'step', current: at === -1 ? job.steps.length : at + 1, total: job.steps.length }
  }
  if (!job || jobs.length === 0) return null
  const done = jobs.filter((j) => j.phase === 'completed').length
  return { unit: 'job', current: Math.min(done + 1, jobs.length), total: jobs.length }
}

/** The job whose log names the failed tests: the first failed one the app can read. */
export function getFailedJob(jobs: readonly CiRunJob[]): CiRunJob | null {
  return jobs.find((j) => j.outcome === 'failure' && j.hasLog) ?? null
}

/** A duration in words, as the Checks tab says it — "4 min 24 s" — with a whole minute left whole: "8 min". */
export function getDurationPhrase(ms: number): Phrase {
  const total = Math.round(ms / 1000)
  if (total >= 60 && total < 3600 && total % 60 === 0) {
    return { key: 'ciRuns.durationMinutesOnly', vars: { m: String(total / 60) } }
  }
  return formatCheckDuration(ms)
}
