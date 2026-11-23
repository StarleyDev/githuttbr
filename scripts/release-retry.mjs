// Decides what to re-run after a Release run ends badly. Only jobs that never
// started a step are retried — the mark of a job no runner picked up (GitHub's
// macOS queue runs dry now and then). A real build failure ran steps and is
// never retried, so this cannot loop on a broken build.
//
// Usage: node scripts/release-retry.mjs <jobs.json> <run.json> <event-attempt> <max-attempts>
//   jobs.json — `gh api …/runs/ID/attempts/N/jobs`
//   run.json  — `gh api …/runs/ID`, read *now*, not from the event payload
// Prints one line: `rerun-failed`, `rerun-job <id>` or `stop: <reason>`.

import { readFileSync } from 'node:fs'

const BAD = new Set(['failure', 'cancelled', 'timed_out', 'startup_failure'])

/**
 * @typedef {{ id?: number; name: string; conclusion: string | null; steps?: Array<{ conclusion: string | null }> }} Job
 * @typedef {{ status?: string; run_attempt?: number }} Run
 * @typedef {{ action: 'rerun-failed' } | { action: 'rerun-job'; jobId: number } | { action: 'stop'; reason: string }} Decision
 */

/** @param {Job} j */
const ranSteps = (j) => (j.steps ?? []).some((s) => s.conclusion && s.conclusion !== 'skipped')

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
  if (attempt && attempt >= maxAttempts) return { action: 'stop', reason: `${attempt} of ${maxAttempts} attempts used` }

  const jobs = payload.jobs ?? []
  const bad = jobs.filter((j) => BAD.has(j.conclusion ?? ''))
  if (!bad.length) return { action: 'stop', reason: 'no failed job' }
  const never = bad.filter((j) => !ranSteps(j))
  const real = bad.filter(ranSteps)
  if (!never.length) return { action: 'stop', reason: `a real failure in ${real.map((j) => j.name).join(', ')}` }
  // Re-run-failed would also repeat the real failure; a single job re-run does
  // not, and the never-started job (macOS, as a rule) can still reach the draft.
  if (real.length) {
    const only = never.length === 1 ? never[0] : null
    if (only && typeof only.id === 'number') return { action: 'rerun-job', jobId: only.id }
    return { action: 'stop', reason: `a real failure in ${real.map((j) => j.name).join(', ')}` }
  }
  // One never-started job is re-run by id: exactly that job and its dependents,
  // never the ones that already passed.
  if (never.length === 1 && typeof never[0].id === 'number') return { action: 'rerun-job', jobId: never[0].id }
  return { action: 'rerun-failed' }
}

/** @param {Decision} d */
export function formatDecision(d) {
  if (d.action === 'rerun-job') return `rerun-job ${d.jobId}`
  if (d.action === 'rerun-failed') return 'rerun-failed'
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
}
