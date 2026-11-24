import { describe, expect, it, vi } from 'vitest'
import {
  CiRunsUnsupportedError,
  forgejoCiRuns,
  forgejoCommitCiLookup,
  forgejoJob,
  forgejoOutcome,
  forgejoPhase,
  forgejoRun
} from '../src/main/ciRunsForgejo'

const BASE = 'https://forge.example.com'

describe('forgejo CI runs mapping', () => {
  it('reads both the Gitea and the Forgejo status shapes', () => {
    expect(forgejoPhase('in_progress')).toBe('running')
    expect(forgejoPhase('waiting')).toBe('queued')
    // Gitea: completed + conclusion
    expect(forgejoOutcome('completed', 'failure')).toBe('failure')
    // Forgejo: the status is the outcome
    expect(forgejoOutcome('success', undefined)).toBe('success')
    expect(forgejoOutcome('cancelled', undefined)).toBe('cancelled')
    expect(forgejoOutcome('running', undefined)).toBeNull()
  })

  it('maps a Gitea-shaped run', () => {
    const run = forgejoRun({
      id: 5,
      display_title: 'fix: thing',
      run_number: 3,
      head_branch: 'main',
      head_sha: 'abc',
      event: 'push',
      actor: { login: 'sam' },
      status: 'completed',
      conclusion: 'success',
      path: '.forgejo/workflows/ci.yml@refs/heads/main',
      created_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:01:00Z',
      html_url: `${BASE}/acme/app/actions/runs/3`
    })
    expect(run).toMatchObject({ id: '5', name: 'ci.yml', title: 'fix: thing', number: 3, outcome: 'success', actor: 'sam' })
  })

  it('maps a Forgejo-shaped run', () => {
    const run = forgejoRun({
      id: 8,
      title: 'feat: x',
      index_in_repo: 9,
      prettyref: 'dev',
      commit_sha: 'def',
      trigger_user: { login: 'kim' },
      workflow_id: 'build.yml',
      status: 'failure',
      created: '2026-01-01T00:00:00Z',
      stopped: '2026-01-01T00:03:00Z'
    })
    expect(run).toMatchObject({ name: 'build.yml', title: 'feat: x', number: 9, branch: 'dev', sha: 'def', actor: 'kim', outcome: 'failure' })
    expect(run.finishedAt).toBe(Date.parse('2026-01-01T00:03:00Z'))
  })

  it('offers a job log only for a finished job on this instance', () => {
    const own = forgejoJob({ id: 1, status: 'completed', conclusion: 'success', html_url: `${BASE}/acme/app/actions/runs/3/jobs/0` }, BASE)
    expect(own.hasLog).toBe(true)
    const elsewhere = forgejoJob({ id: 2, status: 'completed', html_url: 'https://evil.example/acme/app/actions/runs/3/jobs/0' }, BASE)
    expect(elsewhere.hasLog).toBe(false)
    expect(forgejoJob({ id: 3, status: 'in_progress', html_url: `${BASE}/acme/app/actions/runs/3/jobs/1` }, BASE).hasLog).toBe(false)
  })
})

describe('forgejo CI runs adapter', () => {
  it('says unsupported when the server has no runs route but the repository reads fine', async () => {
    const json = vi.fn(async (url: string) => {
      if (url.includes('/actions/runs')) throw new Error('Forgejo API error (404)')
      return { full_name: 'acme/app' }
    })
    const a = forgejoCiRuns({ base: BASE, owner: 'acme', repo: 'app', json: json as never, logTail: async () => null })
    await expect(a.listRuns()).rejects.toBeInstanceOf(CiRunsUnsupportedError)
  })

  it('keeps a 404 an error when the token cannot see the repository at all', async () => {
    const json = vi.fn(async () => { throw new Error('Forgejo API error (404)') })
    const a = forgejoCiRuns({ base: BASE, owner: 'acme', repo: 'app', json: json as never, logTail: async () => null })
    const err = await a.listRuns().catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(CiRunsUnsupportedError)
    expect(String(err)).toContain('404')
  })

  it('passes other errors through', async () => {
    const json = vi.fn(async () => { throw new Error('Forgejo: token is not allowed') })
    const a = forgejoCiRuns({ base: BASE, owner: 'acme', repo: 'app', json: json as never, logTail: async () => null })
    await expect(a.listRuns()).rejects.not.toBeInstanceOf(CiRunsUnsupportedError)
  })

  it('reads a log through the job html_url, and is read-only', async () => {
    const json = vi.fn(async () => ({ jobs: [{ id: 77, status: 'completed', html_url: `${BASE}/acme/app/actions/runs/3/jobs/1` }] }))
    const logTail = vi.fn(async () => 'log')
    const a = forgejoCiRuns({ base: BASE, owner: 'acme', repo: 'app', json: json as never, logTail })
    expect(await a.getJobLog('3', '77')).toBe('log')
    expect(logTail).toHaveBeenCalledWith(`${BASE}/acme/app/actions/runs/3/jobs/1`)
    expect(a.capabilities).toEqual({ rerun: false, rerunFailed: false, cancel: false, dispatch: false })
    await expect(a.runAction('3', 'cancel')).rejects.toThrow()
    await expect(a.listJobs('3/../x')).rejects.toThrow()
  })

  it('shows a run with no jobs when the jobs route is missing', async () => {
    const json = vi.fn(async () => { throw new Error('Forgejo API error (404)') })
    const a = forgejoCiRuns({ base: BASE, owner: 'acme', repo: 'app', json: json as never, logTail: async () => null })
    expect(await a.listJobs('3')).toEqual([])
  })
})

describe('forgejo commit badge', () => {
  it('aggregates the combined status', async () => {
    const json = vi.fn(async () => ({ statuses: [{ context: 'ci', status: 'success' }, { context: 'lint', status: 'error' }] }))
    expect(await forgejoCommitCiLookup(json as never, `${BASE}/api/v1/repos/acme/app`, 'abcdef1')).toMatchObject({
      kind: 'found',
      status: { state: 'failure' }
    })
    expect(await forgejoCommitCiLookup((async () => ({ statuses: [] })) as never, 'x', 'abcdef1')).toEqual({ kind: 'none' })
  })
})
