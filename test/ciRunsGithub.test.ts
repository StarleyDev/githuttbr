import { describe, expect, it, vi } from 'vitest'
import { githubCiRuns, githubJob, githubOutcome, githubPhase, githubRun } from '../src/main/ciRunsGithub'

const API = 'https://api.github.com/repos/acme/app'

function fakeDeps(answers: Record<string, unknown> = {}) {
  const json = vi.fn(async (url: string) => {
    const key = Object.keys(answers).find((k) => url.includes(k))
    if (!key) throw new Error(`unexpected ${url}`)
    return answers[key]
  })
  const send = vi.fn(async () => {})
  const logTail = vi.fn(async () => 'log')
  return { deps: { api: API, json: json as never, sendRequest: send, logTail }, json, send, logTail }
}

describe('github CI runs mapping', () => {
  it('maps statuses to phases', () => {
    expect(githubPhase('completed')).toBe('completed')
    expect(githubPhase('in_progress')).toBe('running')
    expect(githubPhase('waiting')).toBe('queued')
    expect(githubPhase(null)).toBe('queued')
  })

  it('maps conclusions to outcomes, null while unfinished', () => {
    expect(githubOutcome('in_progress', null)).toBeNull()
    expect(githubOutcome('completed', 'success')).toBe('success')
    expect(githubOutcome('completed', 'timed_out')).toBe('failure')
    expect(githubOutcome('completed', 'startup_failure')).toBe('failure')
    expect(githubOutcome('completed', 'cancelled')).toBe('cancelled')
    expect(githubOutcome('completed', 'neutral')).toBe('skipped')
    expect(githubOutcome('completed', 'action_required')).toBe('manual')
    expect(githubOutcome('completed', 'stale')).toBe('unknown')
  })

  it('maps a run', () => {
    const run = githubRun({
      id: 7,
      name: 'CI',
      display_title: 'fix: thing',
      run_number: 12,
      head_branch: 'main',
      head_sha: 'abc',
      event: 'push',
      actor: { login: 'sam' },
      status: 'completed',
      conclusion: 'failure',
      created_at: '2026-01-01T00:00:00Z',
      run_started_at: '2026-01-01T00:00:05Z',
      updated_at: '2026-01-01T00:01:00Z',
      html_url: 'https://github.com/acme/app/actions/runs/7',
      workflow_id: 99
    })
    expect(run).toMatchObject({
      id: '7',
      title: 'fix: thing',
      number: 12,
      phase: 'completed',
      outcome: 'failure',
      actor: 'sam',
      workflowId: '99'
    })
    expect(run.finishedAt).toBe(Date.parse('2026-01-01T00:01:00Z'))
  })

  it('a running run has no finish time', () => {
    const run = githubRun({
      id: 1,
      head_sha: 'x',
      status: 'in_progress',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:01:00Z',
      html_url: ''
    })
    expect(run.finishedAt).toBeUndefined()
    expect(run.outcome).toBeNull()
  })

  it('maps a job with steps; the log exists only once finished', () => {
    const job = githubJob({
      id: 5,
      name: 'build',
      status: 'completed',
      conclusion: 'success',
      steps: [{ name: 'checkout', status: 'completed', conclusion: 'success' }]
    })
    expect(job.steps).toHaveLength(1)
    expect(job.hasLog).toBe(true)
    expect(githubJob({ id: 6, name: 'x', status: 'in_progress', conclusion: null }).hasLog).toBe(false)
  })
})

describe('github CI runs adapter', () => {
  it('lists runs for a branch', async () => {
    const { deps, json } = fakeDeps({ '/actions/runs?': { workflow_runs: [] } })
    await githubCiRuns(deps).listRuns('feat/x')
    expect(json.mock.calls[0][0]).toContain('branch=feat%2Fx')
  })

  it('refuses an id that is not a number', async () => {
    const { deps, send } = fakeDeps()
    const a = githubCiRuns(deps)
    await expect(a.runAction('1/../x', 'cancel')).rejects.toThrow()
    await expect(a.listJobs('1/../x')).rejects.toThrow()
    expect(() => a.getJobLog('1', '../x')).toThrow()
    expect(send).not.toHaveBeenCalled()
  })

  it('posts each action to its route', async () => {
    const { deps, send } = fakeDeps()
    const a = githubCiRuns(deps)
    await a.runAction('3', 'rerun')
    await a.runAction('3', 'rerun-failed')
    await a.runAction('3', 'cancel')
    expect(send.mock.calls.map((c) => c[0])).toEqual([
      `${API}/actions/runs/3/rerun`,
      `${API}/actions/runs/3/rerun-failed-jobs`,
      `${API}/actions/runs/3/cancel`
    ])
  })

  it('lists only active workflows', async () => {
    const { deps } = fakeDeps({
      '/actions/workflows': {
        workflows: [
          { id: 1, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' },
          { id: 2, name: 'Old', state: 'disabled_manually' }
        ]
      }
    })
    expect(await githubCiRuns(deps).listWorkflows()).toEqual([{ id: '1', name: 'CI', path: '.github/workflows/ci.yml' }])
  })
})
