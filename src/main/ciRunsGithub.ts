import type { CiRun, CiRunJob, CiRunOutcome, CiRunPhase, CiRunStep, CiWorkflow, PrCheck } from '../shared/types'
import { CI_LOG_TAIL_BYTES, CI_RUNS_PAGE, isoToMs, type CiRunsAdapter } from './ciRuns'

// GitHub Actions: runs → jobs → steps. Everything the page offers exists here,
// so this adapter is the reference the others are measured against.

export interface GithubCiDeps {
  /** `https://api.github.com/repos/<owner>/<repo>` — or the GHES equivalent. */
  api: string
  /** A JSON GET/POST with the token; throws with GitHub's message on an error. */
  json: <T>(url: string, init?: RequestInit) => Promise<T>
  /** A request whose answer has no body worth reading (201/202/204). */
  sendRequest: (url: string, init: RequestInit) => Promise<void>
  /** The end of a job's log: GitHub answers with a redirect to a signed download. */
  logTail: (url: string, max: number) => Promise<string | null>
}

interface GhRun {
  id: number
  name?: string | null
  display_title?: string | null
  run_number?: number
  head_branch?: string | null
  head_sha: string
  event?: string | null
  actor?: { login: string } | null
  status?: string | null
  conclusion?: string | null
  created_at: string
  run_started_at?: string | null
  updated_at?: string | null
  html_url: string
  workflow_id?: number
}

interface GhStep {
  name: string
  status: string
  conclusion: string | null
  started_at?: string | null
  completed_at?: string | null
}

interface GhJob {
  id: number
  name: string
  status: string
  conclusion: string | null
  started_at?: string | null
  completed_at?: string | null
  html_url?: string | null
  steps?: GhStep[]
}

/** GitHub's status → phase. `waiting`, `requested` and `pending` have not started. */
export function githubPhase(status: string | null | undefined): CiRunPhase {
  if (status === 'completed') return 'completed'
  if (status === 'in_progress') return 'running'
  return 'queued'
}

/** GitHub's conclusion → outcome. Null while unfinished. */
export function githubOutcome(status: string | null | undefined, conclusion: string | null | undefined): CiRunOutcome | null {
  if (status !== 'completed') return null
  switch (conclusion) {
    case 'success':
      return 'success'
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
      return 'failure'
    case 'cancelled':
      return 'cancelled'
    case 'skipped':
    case 'neutral':
      return 'skipped'
    case 'action_required':
      return 'manual'
    default:
      return 'unknown'
  }
}

export function githubRun(r: GhRun): CiRun {
  const phase = githubPhase(r.status)
  return {
    id: String(r.id),
    name: r.name || '',
    title: r.display_title || '',
    number: r.run_number,
    branch: r.head_branch ?? null,
    sha: r.head_sha,
    event: r.event ?? null,
    actor: r.actor?.login ?? null,
    phase,
    outcome: githubOutcome(r.status, r.conclusion),
    createdAt: isoToMs(r.created_at) ?? 0,
    startedAt: isoToMs(r.run_started_at),
    // `updated_at` is the last change; on a finished run that is when it ended.
    finishedAt: phase === 'completed' ? isoToMs(r.updated_at) : undefined,
    url: r.html_url,
    workflowId: r.workflow_id != null ? String(r.workflow_id) : undefined
  }
}

export function githubJob(j: GhJob): CiRunJob {
  const steps: CiRunStep[] = (j.steps ?? []).map((s) => ({
    name: s.name,
    phase: githubPhase(s.status),
    outcome: githubOutcome(s.status, s.conclusion),
    startedAt: isoToMs(s.started_at),
    finishedAt: isoToMs(s.completed_at)
  }))
  const phase = githubPhase(j.status)
  return {
    id: String(j.id),
    name: j.name,
    phase,
    outcome: githubOutcome(j.status, j.conclusion),
    startedAt: isoToMs(j.started_at),
    finishedAt: isoToMs(j.completed_at),
    url: j.html_url ?? '',
    steps,
    // The log exists once the job has finished; before that the endpoint 404s.
    hasLog: phase === 'completed'
  }
}

/** A check-run as `GET /commits/<sha>/check-runs` lists it. */
export interface GhCheckRun {
  name: string
  status: string
  conclusion: string | null
  html_url: string | null
  details_url: string | null
  head_sha?: string
  started_at?: string | null
  completed_at?: string | null
}

/**
 * The Actions run and job a check-run's link names — `…/actions/runs/<run>/job/<job>`.
 * An Actions check-run's id is its job's id, so the CI runs adapter can read its
 * log and re-run its run. Null for a check from any other app (no such link).
 */
export function getGithubActionsJob(url: string | null | undefined): { runId: string; jobId: string } | null {
  const m = /\/actions\/runs\/(\d+)\/job\/(\d+)(?:[/?#]|$)/.exec(url ?? '')
  return m ? { runId: m[1], jobId: m[2] } : null
}

export function githubCheckRun(c: GhCheckRun): PrCheck {
  const url = c.html_url || c.details_url || ''
  const job = getGithubActionsJob(url)
  const startedAt = isoToMs(c.started_at)
  const finishedAt = c.status === 'completed' ? isoToMs(c.completed_at) : undefined
  return {
    name: c.name,
    status: c.status,
    conclusion: c.conclusion,
    url,
    // The log endpoint 404s until the job has finished, as on the CI runs page.
    ...(job && c.status === 'completed' ? { hasLog: true } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(c.head_sha ? { sha: c.head_sha } : {}),
    ...(job ? { runId: job.runId } : {})
  }
}

/** Only plain numeric ids reach a URL: nothing from the renderer can add a path segment. */
function numericId(id: string): string {
  if (!/^\d+$/.test(id)) throw new Error(`Not a run or job id: ${id}`)
  return id
}

export function githubCiRuns(deps: GithubCiDeps): CiRunsAdapter {
  const { api, json, sendRequest, logTail } = deps
  return {
    capabilities: { rerun: true, rerunFailed: true, cancel: true, dispatch: true },

    async listRuns(branch) {
      const q = new URLSearchParams({ per_page: String(CI_RUNS_PAGE) })
      if (branch) q.set('branch', branch)
      const data = await json<{ workflow_runs?: GhRun[] }>(`${api}/actions/runs?${q}`)
      return (data.workflow_runs ?? []).map(githubRun)
    },

    async listJobs(runId) {
      // `latest`: a re-run's jobs, not every attempt's stacked together.
      const data = await json<{ jobs?: GhJob[] }>(`${api}/actions/runs/${numericId(runId)}/jobs?per_page=100&filter=latest`)
      return (data.jobs ?? []).map(githubJob)
    },

    getJobLog(_runId, jobId) {
      return logTail(`${api}/actions/jobs/${numericId(jobId)}/logs`, CI_LOG_TAIL_BYTES)
    },

    async runAction(runId, action) {
      const path = action === 'rerun' ? 'rerun' : action === 'rerun-failed' ? 'rerun-failed-jobs' : 'cancel'
      await sendRequest(`${api}/actions/runs/${numericId(runId)}/${path}`, { method: 'POST' })
    },

    async listWorkflows() {
      const data = await json<{ workflows?: Array<{ id: number; name: string; path?: string; state?: string }> }>(
        `${api}/actions/workflows?per_page=100`
      )
      // A disabled workflow cannot be started; listing it would only produce an error.
      return (data.workflows ?? [])
        .filter((w) => !w.state || w.state === 'active')
        .map((w): CiWorkflow => ({ id: String(w.id), name: w.name, path: w.path }))
    },

    async dispatchWorkflow(workflowId, ref) {
      // GitHub refuses (422) a workflow without a `workflow_dispatch` trigger, and
      // says so in its message — shown as it is rather than guessed in advance.
      await sendRequest(`${api}/actions/workflows/${numericId(workflowId)}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ ref })
      })
    }
  }
}
