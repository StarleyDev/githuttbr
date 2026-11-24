import type { CiJob, CiRun, CiRunJob, CiRunOutcome, CiRunPhase, CiRunStep, CiState } from '../shared/types'
import { CI_RUNS_PAGE, NO_CI_CAPABILITIES, isoToMs, type CiRunsAdapter } from './ciRuns'
import type { CiLookup } from './ciCache'
import { aggregateCiState } from './ciStatusState'
import { forgejoJobLogUrl } from './forgejo'

// Forgejo / Gitea Actions, read-only. The runs API is recent and the two
// forks shape it differently: Gitea (1.24+) mirrors GitHub — status plus
// conclusion, `display_title`, `head_sha` — while Forgejo answers with its own
// ActionRun — one `status` that already says how it ended, `title`,
// `commit_sha`. Both shapes are read; a server with neither says so.

export interface ForgejoCiDeps {
  /** The instance's address, without `/api/v1`. */
  base: string
  owner: string
  repo: string
  /** A JSON GET with the token; throws on an error. */
  json: <T>(url: string, init?: RequestInit) => Promise<T>
  /** A job's log from its web address (forgejoJobLog), or null when refused. */
  logTail: (target: string) => Promise<string | null>
}

/** The server has no Actions runs API (an older Forgejo or Gitea, or Actions turned off). */
export class CiRunsUnsupportedError extends Error {
  readonly unsupported = true
  constructor(message = 'This server has no Actions runs API.') {
    super(message)
    this.name = 'CiRunsUnsupportedError'
  }
}

interface FjRun {
  id: number
  // Gitea
  display_title?: string
  run_number?: number
  head_branch?: string
  head_sha?: string
  actor?: { login?: string } | null
  trigger_actor?: { login?: string } | null
  conclusion?: string | null
  run_started_at?: string | null
  completed_at?: string | null
  path?: string
  // Forgejo
  title?: string
  index_in_repo?: number
  prettyref?: string
  commit_sha?: string
  trigger_user?: { login?: string } | null
  workflow_id?: string
  started?: string | null
  stopped?: string | null
  created?: string | null
  // Both
  event?: string
  status?: string
  created_at?: string | null
  html_url?: string
}

interface FjStep {
  name?: string
  status?: string
  conclusion?: string | null
  started_at?: string | null
  completed_at?: string | null
}

interface FjJob {
  id: number
  name?: string
  status?: string
  conclusion?: string | null
  started_at?: string | null
  completed_at?: string | null
  html_url?: string
  steps?: FjStep[]
}

/** Statuses that already say how a run ended (Forgejo's single field, or a Gitea conclusion). */
const ENDED: Record<string, CiRunOutcome> = {
  success: 'success',
  failure: 'failure',
  cancelled: 'cancelled',
  skipped: 'skipped',
  unknown: 'unknown'
}

/** Status (and Gitea's conclusion) → phase. */
export function forgejoPhase(status: string | undefined): CiRunPhase {
  switch (status) {
    case 'in_progress':
    case 'running':
      return 'running'
    case 'queued':
    case 'waiting':
    case 'blocked':
    case 'pending':
    case 'requested':
      return 'queued'
    default:
      return 'completed'
  }
}

/** Status + conclusion → outcome. Gitea finishes with `completed` and a conclusion; Forgejo with the outcome itself. */
export function forgejoOutcome(status: string | undefined, conclusion: string | null | undefined): CiRunOutcome | null {
  if (forgejoPhase(status) !== 'completed') return null
  const said = status === 'completed' ? conclusion : status
  return (said && ENDED[said]) || 'unknown'
}

/** `.forgejo/workflows/ci.yml@refs/heads/main` → `ci.yml`. */
function workflowName(path: string | undefined): string {
  if (!path) return ''
  return path.replace(/@.*$/, '').split('/').pop() ?? ''
}

function branchOf(ref: string | undefined): string | null {
  if (!ref) return null
  return ref.replace(/^refs\/heads\//, '')
}

export function forgejoRun(r: FjRun): CiRun {
  const phase = forgejoPhase(r.status)
  return {
    id: String(r.id),
    name: workflowName(r.path) || r.workflow_id || '',
    title: r.display_title ?? r.title ?? '',
    number: r.run_number ?? r.index_in_repo,
    branch: branchOf(r.head_branch ?? r.prettyref),
    sha: r.head_sha ?? r.commit_sha ?? '',
    event: r.event ?? null,
    actor: r.actor?.login ?? r.trigger_actor?.login ?? r.trigger_user?.login ?? null,
    phase,
    outcome: forgejoOutcome(r.status, r.conclusion),
    createdAt: isoToMs(r.created_at ?? r.created) ?? 0,
    startedAt: isoToMs(r.run_started_at ?? r.started),
    finishedAt: phase === 'completed' ? isoToMs(r.completed_at ?? r.stopped) : undefined,
    url: r.html_url ?? ''
  }
}

export function forgejoJob(j: FjJob, base: string): CiRunJob {
  const phase = forgejoPhase(j.status)
  const steps: CiRunStep[] = (j.steps ?? []).map((s) => ({
    name: s.name ?? '',
    phase: forgejoPhase(s.status),
    outcome: forgejoOutcome(s.status, s.conclusion),
    startedAt: isoToMs(s.started_at),
    finishedAt: isoToMs(s.completed_at)
  }))
  return {
    id: String(j.id),
    name: j.name ?? '',
    phase,
    outcome: forgejoOutcome(j.status, j.conclusion),
    startedAt: isoToMs(j.started_at),
    finishedAt: isoToMs(j.completed_at),
    url: j.html_url ?? '',
    steps,
    // The log is read from the job's web page address, and only one on this instance.
    hasLog: phase === 'completed' && !!forgejoJobLogUrl(base, j.html_url ?? '')
  }
}

/** A "no such route" answer: the fork or version has no runs API. */
function isMissingRoute(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /\(404\)|not found/i.test(msg)
}

function numericId(id: string): string {
  if (!/^\d+$/.test(id)) throw new Error(`Not a run or job id: ${id}`)
  return id
}

export function forgejoCiRuns(deps: ForgejoCiDeps): CiRunsAdapter {
  const { base, owner, repo, json, logTail } = deps
  const api = `${base}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  const listJobsRaw = async (runId: string): Promise<FjJob[]> => {
    try {
      const data = await json<{ jobs?: FjJob[] } | FjJob[]>(`${api}/actions/runs/${numericId(runId)}/jobs`)
      return Array.isArray(data) ? data : (data?.jobs ?? [])
    } catch (e) {
      // A server that lists runs but not their jobs shows the run with no jobs.
      if (isMissingRoute(e)) return []
      throw e
    }
  }

  return {
    capabilities: NO_CI_CAPABILITIES,

    async listRuns(branch) {
      const q = new URLSearchParams({ limit: String(CI_RUNS_PAGE) })
      if (branch) q.set('branch', branch)
      try {
        const data = await json<{ workflow_runs?: FjRun[] } | FjRun[]>(`${api}/actions/runs?${q}`)
        return (Array.isArray(data) ? data : (data?.workflow_runs ?? [])).map(forgejoRun)
      } catch (e) {
        if (!isMissingRoute(e)) throw e
        // A private repository the token cannot see answers 404 too. Only when
        // the repository itself reads fine is the missing route the server's.
        const repoReadable = await json<unknown>(api).then(
          () => true,
          () => false
        )
        if (repoReadable) throw new CiRunsUnsupportedError()
        throw e
      }
    },

    async listJobs(runId) {
      return (await listJobsRaw(runId)).map((j) => forgejoJob(j, base))
    },

    async getJobLog(runId, jobId) {
      // The web log route counts jobs by their position in the run, not by the
      // API id; the job's own `html_url` carries the right address, so it is
      // read again rather than built from the id.
      const job = (await listJobsRaw(runId)).find((j) => String(j.id) === numericId(jobId))
      return job?.html_url ? logTail(job.html_url) : null
    },

    async runAction() {
      throw new Error('Forgejo Actions runs are read-only here.')
    },

    async listWorkflows() {
      return []
    },

    async dispatchWorkflow() {
      throw new Error('Forgejo Actions runs are read-only here.')
    }
  }
}

/** A commit status → the badge vocabulary (same reading as forgejoPullChecks). */
export function forgejoCommitJob(s: { context: string; status: string; target_url?: string }): CiJob {
  let state: CiState
  if (s.status === 'pending') state = 'pending'
  else if (s.status === 'success') state = 'success'
  else if (s.status === 'warning') state = 'neutral'
  else state = 'failure'
  return { name: s.context, state, ...(s.target_url ? { url: s.target_url } : {}) }
}

/** One commit's badge from its combined status. `repoApi` is `<base>/api/v1/repos/<owner>/<repo>`. */
export async function forgejoCommitCiLookup(
  json: <T>(url: string, init?: RequestInit) => Promise<T>,
  repoApi: string,
  sha: string
): Promise<CiLookup> {
  if (!/^[0-9a-f]{7,64}$/i.test(sha)) return { kind: 'failed' }
  try {
    const st = await json<{ statuses?: Array<{ context: string; status: string; target_url?: string }> }>(
      `${repoApi}/commits/${sha}/status`
    )
    const statuses = st?.statuses ?? []
    if (!statuses.length) return { kind: 'none' }
    const jobs = statuses.map(forgejoCommitJob)
    return { kind: 'found', status: { state: aggregateCiState(jobs), jobs } }
  } catch {
    return { kind: 'failed' }
  }
}
