import type { CiRun, CiRunAction, CiRunCapabilities, CiRunJob, CiWorkflow } from '../shared/types'

// The CI runs page talks to one of these per host. Each adapter is handed its
// requests already authenticated (as azurePr.ts is), so none of them imports
// hosting — and each can be tested with a fake fetch.

export interface CiRunsAdapter {
  capabilities: CiRunCapabilities
  /** Newest first. `branch` narrows to one branch; absent means all. */
  listRuns(branch?: string): Promise<CiRun[]>
  listJobs(runId: string): Promise<CiRunJob[]>
  /** The end of a job's log, or null when the host will not give it to the app. */
  getJobLog(runId: string, jobId: string): Promise<string | null>
  runAction(runId: string, action: CiRunAction): Promise<void>
  listWorkflows(): Promise<CiWorkflow[]>
  /** Start `workflowId` on `ref` (a branch name). */
  dispatchWorkflow(workflowId: string, ref: string): Promise<void>
}

/** How much of a job log the page shows: the end, where a failure is. */
export const CI_LOG_TAIL_BYTES = 512 * 1024

/** How many runs a page load asks for. One request on every host. */
export const CI_RUNS_PAGE = 50

export const NO_CI_CAPABILITIES: CiRunCapabilities = { rerun: false, rerunFailed: false, cancel: false, dispatch: false }

/** An ISO date (or null) as epoch milliseconds, undefined when absent or unparsable. */
export function isoToMs(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const ms = Date.parse(iso)
  // Azure answers "0001-01-01T00:00:00" for a time that has not happened yet.
  return Number.isFinite(ms) && ms > 0 ? ms : undefined
}

/** `refs/heads/main` → `main`; anything else as it is. */
export function shortBranch(ref: string | null | undefined): string | null {
  if (!ref) return null
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
}

/**
 * The pull / merge request a run's ref names: GitLab's merge request pipelines
 * run on `refs/merge-requests/<iid>/head` (or `/merge`, `/train`), Azure's PR
 * builds on `refs/pull/<id>/merge`. Undefined for a branch or a tag.
 */
export function pullRequestFromRef(ref: string | null | undefined): number | undefined {
  const m = /^refs\/(?:merge-requests|pull)\/(\d+)\//.exec(ref ?? '')
  return m ? Number(m[1]) : undefined
}
