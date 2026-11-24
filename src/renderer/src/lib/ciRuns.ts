import type { CiRun, CiRunCapabilities, CiRunJob, CiRunOutcome, CiRunPhase } from '../../../shared/types'
import type { TranslationKey } from '../i18n'

// The CI runs page's logic, kept out of the component so it is testable
// without a DOM: what a run is called, which state it shows, what it allows.

/** The dot colour classes the PR checks already use. */
export type CiDot = 'pass' | 'fail' | 'pending' | 'neutral'

export function ciDot(phase: CiRunPhase, outcome: CiRunOutcome | null): CiDot {
  if (phase !== 'completed') return 'pending'
  if (outcome === 'success') return 'pass'
  if (outcome === 'failure') return 'fail'
  return 'neutral'
}

/** The label for where a run, job or step stands. */
export function ciStateKey(phase: CiRunPhase, outcome: CiRunOutcome | null): TranslationKey {
  if (phase === 'queued') return 'ciRuns.stateQueued'
  if (phase === 'running') return 'ciRuns.stateRunning'
  switch (outcome) {
    case 'success':
      return 'ciRuns.stateSuccess'
    case 'failure':
      return 'ciRuns.stateFailure'
    case 'cancelled':
      return 'ciRuns.stateCancelled'
    case 'skipped':
      return 'ciRuns.stateSkipped'
    case 'manual':
      return 'ciRuns.stateManual'
    default:
      return 'ciRuns.stateUnknown'
  }
}

/** Something on the page is still moving: worth asking the host again soon. */
export function hasActiveRuns(runs: readonly CiRun[]): boolean {
  return runs.some((r) => r.phase !== 'completed')
}

/**
 * How long a run or job took, or has been going: from start (or creation) to
 * finish (or now). Null when it has not started.
 */
export function ciElapsedMs(
  item: { phase: CiRunPhase; startedAt?: number; finishedAt?: number; createdAt?: number },
  now: number
): number | null {
  const start = item.startedAt ?? (item.phase === 'queued' ? undefined : item.createdAt)
  if (!start) return null
  const end = item.phase === 'completed' ? (item.finishedAt ?? null) : now
  if (end === null) return null
  return Math.max(0, end - start)
}

/** `1:05`, `12:40`, `1:02:03` — digits and colons read the same in every language. */
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Which buttons a run gets: what the host allows, narrowed by where the run is. */
export function runActions(
  run: Pick<CiRun, 'phase' | 'outcome'>,
  caps: CiRunCapabilities
): { rerun: boolean; rerunFailed: boolean; cancel: boolean } {
  const done = run.phase === 'completed'
  return {
    rerun: caps.rerun && done,
    rerunFailed: caps.rerunFailed && done && (run.outcome === 'failure' || run.outcome === 'cancelled'),
    cancel: caps.cancel && !done
  }
}

export interface JobGroup {
  /** Empty when the host has no stages: one unnamed group. */
  stage: string
  jobs: CiRunJob[]
}

/** Jobs grouped by stage, in the order the stages first appear. */
export function groupJobsByStage(jobs: readonly CiRunJob[]): JobGroup[] {
  const groups: JobGroup[] = []
  const byStage = new Map<string, JobGroup>()
  for (const job of jobs) {
    const stage = job.stage ?? ''
    let group = byStage.get(stage)
    if (!group) {
      group = { stage, jobs: [] }
      byStage.set(stage, group)
      groups.push(group)
    }
    group.jobs.push(job)
  }
  return groups
}

/**
 * What a run row is called: the host's title, else the commit's subject as the
 * local repository knows it (GitLab's pipeline list carries no title, nor does
 * a scheduled Azure build), else the workflow's name, else its number.
 */
export function runHeadline(
  run: Pick<CiRun, 'title' | 'name' | 'number' | 'id' | 'sha'>,
  subjectOf?: (sha: string) => string | undefined
): string {
  return run.title || subjectOf?.(run.sha) || run.name || `#${run.number ?? run.id}`
}

/** The workflow's name for the meta line — left out when the headline already says it. */
export function runMetaName(run: Pick<CiRun, 'name'>, headline: string): string | null {
  return run.name && run.name !== headline ? run.name : null
}

/** Polls in a row that changed nothing before the page slows down. */
export const CI_POLL_PATIENCE = 8
export const CI_POLL_FAST_MS = 15_000
export const CI_POLL_SLOW_MS = 60_000

/**
 * How long to wait before asking the host again. A run waiting hours for a
 * deployment approval would otherwise be polled every 15 seconds the whole
 * time; once the list has stopped changing for a couple of minutes, once a
 * minute is enough.
 */
export function ciPollDelayMs(unchangedPolls: number): number {
  return unchangedPolls >= CI_POLL_PATIENCE ? CI_POLL_SLOW_MS : CI_POLL_FAST_MS
}

/** What a poll compares to tell "something moved" from "same as before". */
export function runsSignature(runs: readonly Pick<CiRun, 'id' | 'phase' | 'outcome'>[]): string {
  return runs.map((r) => `${r.id}:${r.phase}:${r.outcome ?? ''}`).join('|')
}

/** A run matching the filter box: title (or the headline shown for it), workflow, branch, actor or commit. */
export function runMatches(run: CiRun, query: string, headline = ''): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [run.title, headline, run.name, run.branch ?? '', run.actor ?? '', run.sha, run.event ?? '']
    .some((field) => field.toLowerCase().includes(q))
}
