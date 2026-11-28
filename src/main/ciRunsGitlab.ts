import type { CiJob, CiRun, CiRunJob, CiRunOutcome, CiRunPhase, CiState } from '../shared/types'
import { CI_LOG_TAIL_BYTES, CI_RUNS_PAGE, isoToMs, pullRequestFromRef, type CiRunsAdapter } from './ciRuns'
import type { CiLookup } from './ciCache'
import { aggregateCiState } from './ciStatusState'

// GitLab pipelines → jobs, grouped by stage. GitLab reports no steps inside a
// job, and "run again" exists only as "retry the failed jobs" — so `rerun` is
// off and `rerunFailed` on.

export interface GitlabCiDeps {
  /** `https://<host>/api/v4/projects/<url-encoded path>`. */
  base: string
  /** A JSON GET/POST with the token; throws with GitLab's message on an error. */
  json: <T>(url: string, init?: RequestInit) => Promise<T>
  /** A request whose answer is not read. */
  sendRequest: (url: string, init: RequestInit) => Promise<void>
  /** The end of a plain-text resource (a job trace), or null when refused. */
  text: (url: string, max: number) => Promise<string | null>
}

interface GlPipeline {
  id: number
  iid?: number
  name?: string | null
  ref?: string | null
  sha: string
  source?: string | null
  status: string
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  updated_at?: string | null
  web_url: string
}

interface GlJob {
  id: number
  name: string
  stage?: string | null
  status: string
  started_at?: string | null
  finished_at?: string | null
  web_url?: string | null
}

const QUEUED = new Set(['created', 'pending', 'waiting_for_resource', 'preparing', 'scheduled', 'waiting_for_callback'])

/** GitLab's pipeline/job status → phase. A manual job is waiting on a person, not the runner: it counts as settled. */
export function gitlabPhase(status: string): CiRunPhase {
  if (status === 'running' || status === 'canceling') return 'running'
  if (QUEUED.has(status)) return 'queued'
  return 'completed'
}

/** GitLab's status → outcome. Null while it is not settled. */
export function gitlabOutcome(status: string): CiRunOutcome | null {
  switch (status) {
    case 'success':
      return 'success'
    case 'failed':
      return 'failure'
    case 'canceled':
      return 'cancelled'
    case 'skipped':
      return 'skipped'
    case 'manual':
      return 'manual'
    default:
      return gitlabPhase(status) === 'completed' ? 'unknown' : null
  }
}

export function gitlabRun(p: GlPipeline): CiRun {
  const phase = gitlabPhase(p.status)
  return {
    id: String(p.id),
    // The list carries no commit subject and asking per pipeline would be 50
    // requests; the page falls back to the pipeline number when this is empty.
    name: p.name ?? '',
    title: '',
    number: p.iid,
    branch: p.ref ?? null,
    sha: p.sha,
    event: p.source ?? null,
    actor: null,
    phase,
    outcome: gitlabOutcome(p.status),
    createdAt: isoToMs(p.created_at) ?? 0,
    startedAt: isoToMs(p.started_at),
    finishedAt: phase === 'completed' ? (isoToMs(p.finished_at) ?? isoToMs(p.updated_at)) : undefined,
    url: p.web_url,
    pullRequest: pullRequestFromRef(p.ref)
  }
}

/** Statuses whose job never ran, so there is no trace to read. */
const NO_TRACE = new Set(['created', 'pending', 'manual', 'skipped', 'scheduled', 'waiting_for_resource'])

export function gitlabJob(j: GlJob): CiRunJob {
  return {
    id: String(j.id),
    name: j.name,
    stage: j.stage ?? undefined,
    phase: gitlabPhase(j.status),
    outcome: gitlabOutcome(j.status),
    startedAt: isoToMs(j.started_at),
    finishedAt: isoToMs(j.finished_at),
    url: j.web_url ?? '',
    steps: [],
    hasLog: !NO_TRACE.has(j.status)
  }
}

/**
 * A job trace as plain text: GitLab writes ANSI colours and collapsible
 * `section_start:<time>:<name>` / `section_end:…` markers into it, which a
 * terminal hides and a text view would show raw.
 */
export function cleanGitlabTrace(trace: string): string {
  return (
    trace
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
      .replace(/section_(?:start|end):\d+:[A-Za-z0-9_.-]+(?:\[[^\]]*\])?\r?/g, '')
      .replace(/\r\n/g, '\n')
  )
}

function numericId(id: string): string {
  if (!/^\d+$/.test(id)) throw new Error(`Not a pipeline or job id: ${id}`)
  return id
}

export function gitlabCiRuns(deps: GitlabCiDeps): CiRunsAdapter {
  const { base, json, sendRequest, text } = deps
  return {
    capabilities: { rerun: false, rerunFailed: true, cancel: true, dispatch: true },

    async listRuns(branch) {
      const q = new URLSearchParams({ per_page: String(CI_RUNS_PAGE) })
      if (branch) q.set('ref', branch)
      const pipelines = await json<GlPipeline[]>(`${base}/pipelines?${q}`)
      return (pipelines ?? []).map(gitlabRun)
    },

    async listJobs(runId) {
      const jobs = await json<GlJob[]>(`${base}/pipelines/${numericId(runId)}/jobs?per_page=100`)
      return (jobs ?? []).map(gitlabJob)
    },

    async getJobLog(_runId, jobId) {
      const trace = await text(`${base}/jobs/${numericId(jobId)}/trace`, CI_LOG_TAIL_BYTES)
      return trace === null ? null : cleanGitlabTrace(trace)
    },

    async runAction(runId, action) {
      if (action === 'rerun') throw new Error('GitLab can only retry the failed jobs of a pipeline.')
      const path = action === 'rerun-failed' ? 'retry' : 'cancel'
      await sendRequest(`${base}/pipelines/${numericId(runId)}/${path}`, { method: 'POST' })
    },

    async listWorkflows() {
      // One pipeline definition per project: the CI file itself.
      return [{ id: 'pipeline', name: '.gitlab-ci.yml', path: '.gitlab-ci.yml' }]
    },

    async dispatchWorkflow(_workflowId, ref) {
      await sendRequest(`${base}/pipeline?ref=${encodeURIComponent(ref)}`, { method: 'POST' })
    }
  }
}

/** Commit statuses that mean the job is on its way: only these keep a badge on the clock. */
const BADGE_PENDING = new Set(['pending', 'running', 'preparing', 'waiting_for_resource', 'scheduled', 'canceling'])

/**
 * A GitLab commit status → the badge vocabulary. A `manual` job waits on a
 * person and a `created` one in a finished pipeline will never run: both are
 * neutral, or a green pipeline with a manual deploy would read as running —
 * and be asked about again every 45 seconds — forever.
 */
export function gitlabCommitJob(s: { name: string; status: string; target_url?: string | null }): CiJob {
  let state: CiState
  if (s.status === 'success') state = 'success'
  else if (s.status === 'failed') state = 'failure'
  else if (BADGE_PENDING.has(s.status)) state = 'pending'
  else state = 'neutral'
  return {
    name: s.name,
    state,
    ...(s.target_url ? { url: s.target_url } : {}),
    ...(s.status === 'canceled' ? { neutralAs: 'cancelled' as const } : {})
  }
}

/** One commit's badge: its statuses, which include every pipeline job run on it. */
export async function gitlabCommitCiLookup(
  json: <T>(url: string, init?: RequestInit) => Promise<T>,
  base: string,
  sha: string
): Promise<CiLookup> {
  if (!/^[0-9a-f]{7,64}$/i.test(sha)) return { kind: 'failed' }
  try {
    const statuses = await json<Array<{ name: string; status: string; target_url?: string | null }>>(
      `${base}/repository/commits/${sha}/statuses?per_page=100`
    )
    if (!statuses?.length) return { kind: 'none' }
    const jobs = statuses.map(gitlabCommitJob)
    return { kind: 'found', status: { state: aggregateCiState(jobs), jobs } }
  } catch {
    return { kind: 'failed' }
  }
}
