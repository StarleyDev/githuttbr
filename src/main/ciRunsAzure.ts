import type { CiJob, CiRun, CiRunJob, CiRunOutcome, CiRunPhase, CiRunStep, CiState, CiWorkflow } from '../shared/types'
import type { Ado, AdoText } from './azurePr'
import { CI_LOG_TAIL_BYTES, CI_RUNS_PAGE, isoToMs, pullRequestFromRef, shortBranch, type CiRunsAdapter } from './ciRuns'
import type { CiLookup } from './ciCache'
import { aggregateCiState } from './ciStatusState'

// Azure Pipelines builds → the timeline's jobs, under their stage, with the
// tasks as steps. Build reads need the *Build* scope, which a git-only token
// does not have: every read goes through `optional`, so a refusal there is
// "cannot read builds", not "this credential is revoked".

export interface AzureCiDeps {
  org: string
  project: string
  /** The repository's name as the remote spells it. */
  repoName: string
  /** Requests that may retry with a fresh borrowed credential. */
  ado: Ado
  /** Requests that need a scope the token may not have; never retried. */
  optional: Ado
  text: AdoText
}

interface AzBuild {
  id: number
  buildNumber?: string
  definition?: { id: number; name: string }
  sourceBranch?: string
  sourceVersion?: string
  reason?: string
  requestedFor?: { displayName?: string }
  status?: string
  result?: string
  queueTime?: string
  startTime?: string
  finishTime?: string
  _links?: { web?: { href?: string } }
  triggerInfo?: Record<string, string>
}

export interface AzRecord {
  id: string
  parentId?: string | null
  type?: string
  name?: string
  state?: string
  result?: string | null
  order?: number
  startTime?: string | null
  finishTime?: string | null
  log?: { id?: number } | null
}

const V = 'api-version=7.1'

/** A build's or timeline record's status → phase. */
export function azurePhase(status: string | undefined): CiRunPhase {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'inProgress':
    case 'cancelling':
      return 'running'
    default:
      // notStarted, postponed, pending (timeline)
      return 'queued'
  }
}

/** A build's or timeline record's result → outcome. Null while unfinished. */
export function azureOutcome(status: string | undefined, result: string | null | undefined): CiRunOutcome | null {
  if (azurePhase(status) !== 'completed') return null
  switch (result) {
    case 'succeeded':
    case 'succeededWithIssues':
      return 'success'
    case 'failed':
    case 'partiallySucceeded':
      return 'failure'
    case 'canceled':
    case 'abandoned':
      return 'cancelled'
    case 'skipped':
      return 'skipped'
    default:
      return 'unknown'
  }
}

export function azureRun(b: AzBuild): CiRun {
  const phase = azurePhase(b.status)
  return {
    id: String(b.id),
    name: b.definition?.name ?? '',
    title: b.triggerInfo?.['ci.message'] ?? '',
    branch: shortBranch(b.sourceBranch),
    sha: b.sourceVersion ?? '',
    event: b.reason ?? null,
    actor: b.requestedFor?.displayName ?? null,
    phase,
    outcome: azureOutcome(b.status, b.result),
    createdAt: isoToMs(b.queueTime) ?? 0,
    startedAt: isoToMs(b.startTime),
    finishedAt: phase === 'completed' ? isoToMs(b.finishTime) : undefined,
    url: b._links?.web?.href ?? '',
    workflowId: b.definition ? String(b.definition.id) : undefined,
    pullRequest: pullRequestFromRef(b.sourceBranch)
  }
}

/**
 * A timeline as jobs. A job's stage is found by walking up: Job → Phase → Stage
 * (a classic, stage-less pipeline has none). Its steps are the Task records
 * directly under it, in their order.
 */
export function azureJobs(records: readonly AzRecord[], buildUrl: string): CiRunJob[] {
  const byId = new Map(records.map((r) => [r.id, r]))
  const stageOf = (r: AzRecord): string | undefined => {
    let cur = r.parentId ? byId.get(r.parentId) : undefined
    // A few levels at most; the bound keeps a malformed cycle from spinning.
    for (let i = 0; cur && i < 5; i++) {
      if (cur.type === 'Stage') return cur.name
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return undefined
  }
  const byOrder = (a: AzRecord, b: AzRecord): number => (a.order ?? 0) - (b.order ?? 0)
  return records
    .filter((r) => r.type === 'Job')
    .sort(byOrder)
    .map((job) => {
      const steps: CiRunStep[] = records
        .filter((r) => r.type === 'Task' && r.parentId === job.id)
        .sort(byOrder)
        .map((task) => ({
          name: task.name ?? '',
          phase: azurePhase(task.state),
          outcome: azureOutcome(task.state, task.result),
          startedAt: isoToMs(task.startTime),
          finishedAt: isoToMs(task.finishTime)
        }))
      return {
        id: job.id,
        name: job.name ?? '',
        stage: stageOf(job),
        phase: azurePhase(job.state),
        outcome: azureOutcome(job.state, job.result),
        startedAt: isoToMs(job.startTime),
        finishedAt: isoToMs(job.finishTime),
        url: buildUrl,
        steps,
        hasLog: typeof job.log?.id === 'number'
      }
    })
}

function buildId(id: string): string {
  if (!/^\d+$/.test(id)) throw new Error(`Not a build id: ${id}`)
  return id
}

function recordId(id: string): string {
  if (!/^[0-9a-f-]+$/i.test(id)) throw new Error(`Not a timeline record id: ${id}`)
  return id
}

function projectApi(deps: Pick<AzureCiDeps, 'org' | 'project'>): string {
  return `https://dev.azure.com/${encodeURIComponent(deps.org)}/${encodeURIComponent(deps.project)}/_apis`
}

/** The repository's GUID, which the build API filters by — asked once per adapter. */
function repositoryIdOf(deps: AzureCiDeps): () => Promise<string> {
  let pending: Promise<string> | null = null
  return () => {
    pending ??= deps
      .optional<{ id: string }>(`${projectApi(deps)}/git/repositories/${encodeURIComponent(deps.repoName)}?${V}`)
      .then((r) => r.id)
      // A failure is not remembered: the next call asks again.
      .catch((e) => {
        pending = null
        throw e
      })
    return pending
  }
}

export function azureCiRuns(deps: AzureCiDeps): CiRunsAdapter {
  const { optional, ado, text } = deps
  const apis = projectApi(deps)
  const repositoryId = repositoryIdOf(deps)
  const timeline = (runId: string): Promise<{ records?: AzRecord[] }> =>
    optional<{ records?: AzRecord[] }>(`${apis}/build/builds/${buildId(runId)}/timeline?${V}`)

  return {
    capabilities: { rerun: false, rerunFailed: true, cancel: true, dispatch: true },

    async listRuns(branch) {
      const q = new URLSearchParams({
        repositoryId: await repositoryId(),
        repositoryType: 'TfsGit',
        $top: String(CI_RUNS_PAGE),
        queryOrder: 'queueTimeDescending'
      })
      if (branch) q.set('branchName', `refs/heads/${branch}`)
      const data = await optional<{ value?: AzBuild[] }>(`${apis}/build/builds?${q}&${V}`)
      return (data.value ?? []).map(azureRun)
    },

    async listJobs(runId) {
      const [tl, build] = await Promise.all([
        timeline(runId),
        optional<AzBuild>(`${apis}/build/builds/${buildId(runId)}?${V}`).catch(() => null)
      ])
      return azureJobs(tl?.records ?? [], build?._links?.web?.href ?? '')
    },

    async getJobLog(runId, jobId) {
      // The job id is the timeline record's GUID; its log id is read again from
      // the timeline rather than packed into the id, so ids stay what Azure calls them.
      const id = recordId(jobId)
      const record = ((await timeline(runId)).records ?? []).find((r) => r.id === id)
      const logId = record?.log?.id
      if (typeof logId !== 'number') return null
      return text(`${apis}/build/builds/${buildId(runId)}/logs/${logId}?${V}`, CI_LOG_TAIL_BYTES)
    },

    async runAction(runId, action) {
      if (action === 'rerun') throw new Error('Azure Pipelines can only retry the failed jobs of a build.')
      const url =
        action === 'rerun-failed'
          ? `${apis}/build/builds/${buildId(runId)}?retry=true&${V}`
          : `${apis}/build/builds/${buildId(runId)}?${V}`
      const body = action === 'rerun-failed' ? '{}' : JSON.stringify({ status: 'cancelling' })
      await ado(url, { method: 'PATCH', body })
    },

    async listWorkflows() {
      const q = new URLSearchParams({ repositoryId: await repositoryId(), repositoryType: 'TfsGit' })
      const data = await optional<{ value?: Array<{ id: number; name: string; path?: string }> }>(
        `${apis}/build/definitions?${q}&${V}`
      )
      return (data.value ?? []).map((d): CiWorkflow => ({ id: String(d.id), name: d.name, path: d.path }))
    },

    async dispatchWorkflow(workflowId, ref) {
      await ado(`${apis}/build/builds?${V}`, {
        method: 'POST',
        body: JSON.stringify({ definition: { id: Number(buildId(workflowId)) }, sourceBranch: `refs/heads/${ref}` })
      })
    }
  }
}

/** A build → one badge job, named after its pipeline. */
export function azureBuildJob(b: AzBuild): CiJob {
  const outcome = azureOutcome(b.status, b.result)
  let state: CiState
  if (outcome === null) state = 'pending'
  else if (outcome === 'success') state = 'success'
  else if (outcome === 'failure') state = 'failure'
  else state = 'neutral'
  return {
    name: b.definition?.name ?? String(b.id),
    state,
    ...(b._links?.web?.href ? { url: b._links.web.href } : {}),
    ...(outcome === 'cancelled' ? { neutralAs: 'cancelled' as const } : outcome === 'unknown' ? { neutralAs: 'unknown' as const } : {})
  }
}

/** How many recent builds the badge index covers. */
export const AZURE_BADGE_BUILDS = 100

/**
 * Badges for many commits from ONE request: the build API cannot filter by
 * commit, so the repository's recent builds are read once and indexed by
 * `sourceVersion`. The returned lookup answers each sha from that index; a
 * commit older than the window simply has no badge.
 */
export function azureCiLookupBatch(deps: Pick<AzureCiDeps, 'org' | 'project' | 'repoName' | 'optional'>): (sha: string) => Promise<CiLookup> {
  const repositoryId = repositoryIdOf({ ...deps, ado: deps.optional, text: async () => null })
  let index: Promise<Map<string, AzBuild[]>> | null = null
  const load = async (): Promise<Map<string, AzBuild[]>> => {
    const q = new URLSearchParams({
      repositoryId: await repositoryId(),
      repositoryType: 'TfsGit',
      $top: String(AZURE_BADGE_BUILDS),
      queryOrder: 'queueTimeDescending'
    })
    const data = await deps.optional<{ value?: AzBuild[] }>(`${projectApi(deps)}/build/builds?${q}&${V}`)
    const map = new Map<string, AzBuild[]>()
    for (const b of data.value ?? []) {
      const sha = (b.sourceVersion ?? '').toLowerCase()
      if (!sha) continue
      const list = map.get(sha) ?? []
      // Newest first: a re-run of the same pipeline replaces the older build.
      if (!list.some((x) => x.definition?.id === b.definition?.id)) list.push(b)
      map.set(sha, list)
    }
    return map
  }
  return async (sha) => {
    try {
      index ??= load()
      const builds = (await index).get(sha.toLowerCase())
      if (!builds?.length) return { kind: 'none' }
      const jobs = builds.map(azureBuildJob)
      return { kind: 'found', status: { state: aggregateCiState(jobs), jobs } }
    } catch {
      return { kind: 'failed' }
    }
  }
}
