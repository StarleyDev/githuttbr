// Decides what to re-run after a Release run ends badly. Only the macOS jobs
// are ever re-run automatically, and only when they never started a step — the
// mark of a job no runner picked up (GitHub's macOS queue runs dry now and
// then). A real build failure ran steps and is never retried, so this cannot
// loop on a broken build.
//
// Why only macOS: this also fires on a run that concluded 'cancelled', and a
// maintainer cancels a run by hand to stop it. Re-running `publish` (or
// `rerun-failed-jobs` on the whole run, which includes it) after that could
// make a bad draft public. The macOS job only uploads assets to the release
// and never publishes, so re-running it after a manual cancel is harmless.
// Linux, Windows, draft and publish are left to a person.
//
// Usage: node scripts/release-retry.mjs <jobs.json> <run.json> <event-attempt> <max-attempts>
//   jobs.json — `gh api …/runs/ID/attempts/N/jobs`
//   run.json  — `gh api …/runs/ID`, read *now*, not from the event payload
// Prints one line: `rerun-job <id>` or `stop: <reason>`.

import { readFileSync } from 'node:fs'

const BAD = new Set(['failure', 'cancelled', 'timed_out', 'startup_failure'])

// Jobs of a reusable workflow are named "<caller job id> / <job name>": the
// Release job `mac` calls release-mac.yml, whose jobs are `build (<runner>)`
// and `report`. test/releaseRetry.test.ts pins those names to the workflows.
export const MAC_BUILD_RE = /^mac \/ build\b/
export const MAC_REPORT_RE = /^mac \/ report$/

/**
 * @typedef {{ id?: number; name: string; conclusion: string | null; steps?: Array<{ conclusion: string | null }> }} Job
 * @typedef {{ status?: string; run_attempt?: number }} Run
 * @typedef {({ action: 'rerun-job'; jobId: number } | { action: 'stop'; reason: string }) & { unstarted?: string[] }} Decision
 */

/** @param {Job} j */
const ranSteps = (j) => (j.steps ?? []).some((s) => s.conclusion && s.conclusion !== 'skipped')
/** @param {Job} j */
const isMac = (j) => MAC_BUILD_RE.test(j.name) || MAC_REPORT_RE.test(j.name)

/**
 * @param {{ jobs?: Job[] }} payload jobs of the attempt that just completed
 * @param {{ run?: Run; attempt?: number; maxAttempts?: number }} [ctx]
 * @returns {Decision}
 */
export function retryDecision(payload, ctx = {}) {
  const { run, attempt, maxAttempts = 3 } = ctx
  // The event is a snapshot. By the time this runs a person may have pressed
  // "Re-run" already, and a second re-run request on a run that is going again
  // is refused by the API — which is what turned the step red once.
  if (run && run.status && run.status !== 'completed') return { action: 'stop', reason: 'the run is running again' }
  if (run && attempt && run.run_attempt && run.run_attempt !== attempt) {
    return { action: 'stop', reason: `attempt ${run.run_attempt} already exists` }
  }

  const jobs = payload.jobs ?? []
  // Never-started jobs that are not macOS are reported, never re-run: a
  // Linux or Windows job left in the queue (or a run cancelled by hand) is
  // for a person to look at, since re-running it leads on to `publish`.
  const unstarted = jobs.filter((j) => !isMac(j) && BAD.has(j.conclusion ?? '') && !ranSteps(j)).map((j) => j.name)
  /** @param {Decision} d @returns {Decision} */
  const withUnstarted = (d) => (unstarted.length ? { ...d, unstarted } : d)
  /** @param {string} reason */
  const stop = (reason) => withUnstarted({ action: 'stop', reason })
  /** @param {number} jobId */
  const rerun = (jobId) => withUnstarted({ action: 'rerun-job', jobId })
  if (attempt && attempt >= maxAttempts) return stop(`${attempt} of ${maxAttempts} attempts used`)

  const build = jobs.find((j) => MAC_BUILD_RE.test(j.name))
  const report = jobs.find((j) => MAC_REPORT_RE.test(j.name))
  if (!build) return stop('no macOS job in this run')
  if (build.conclusion === 'success') {
    // The build landed but its report never ran (the run was cancelled
    // around it): re-run the report alone so the issue gets closed.
    if (report && BAD.has(report.conclusion ?? '') && !ranSteps(report) && typeof report.id === 'number') {
      return rerun(report.id)
    }
    return stop('macOS already built')
  }
  if (!BAD.has(build.conclusion ?? '')) return stop(`macOS build ${build.conclusion ?? 'has no conclusion'}`)
  if (ranSteps(build)) return stop(`a real failure in ${build.name}`)
  // Re-running a job by id re-runs it and its dependents (the report), never
  // the jobs that passed and never `publish`, which does not depend on it.
  if (typeof build.id !== 'number') return stop(`${build.name} has no job id`)
  return rerun(build.id)
}

/** @param {Decision} d */
export function formatDecision(d) {
  if (d.action === 'rerun-job') return `rerun-job ${d.jobId}`
  return `stop: ${d.reason}`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [jobsFile, runFile, attempt, max] = process.argv.slice(2)
  const read = (f) => (f ? JSON.parse(readFileSync(f, 'utf8') || '{}') : {})
  const d = retryDecision(read(jobsFile), {
    run: read(runFile),
    attempt: Number(attempt) || undefined,
    maxAttempts: Number(max) || 3
  })
  console.log(formatDecision(d))
  // On stderr, so the verdict line on stdout stays one line for the workflow.
  if (d.unstarted?.length) console.error(`unstarted: ${d.unstarted.join(', ')}`)
}
