import { describe, expect, it, vi } from 'vitest'
import { azureCiLookupBatch, azureCiRuns, azureJobs, azureOutcome, azurePhase, azureRun, type AzRecord } from '../src/main/ciRunsAzure'

const APIS = 'https://dev.azure.com/acme/Web/_apis'
const GUID = '0f1e2d3c-aaaa-bbbb-cccc-111122223333'

describe('azure CI runs mapping', () => {
  it('maps status and result', () => {
    expect(azurePhase('notStarted')).toBe('queued')
    expect(azurePhase('cancelling')).toBe('running')
    expect(azureOutcome('inProgress', null)).toBeNull()
    expect(azureOutcome('completed', 'succeededWithIssues')).toBe('success')
    expect(azureOutcome('completed', 'partiallySucceeded')).toBe('failure')
    expect(azureOutcome('completed', 'abandoned')).toBe('cancelled')
  })

  it('maps a build', () => {
    const run = azureRun({
      id: 42,
      definition: { id: 3, name: 'web-ci' },
      sourceBranch: 'refs/heads/main',
      sourceVersion: 'abc',
      reason: 'individualCI',
      requestedFor: { displayName: 'Sam' },
      status: 'completed',
      result: 'failed',
      queueTime: '2026-01-01T00:00:00Z',
      finishTime: '2026-01-01T00:05:00Z',
      _links: { web: { href: 'https://dev.azure.com/acme/Web/_build/results?buildId=42' } },
      triggerInfo: { 'ci.message': 'fix: thing' }
    })
    expect(run).toMatchObject({ id: '42', name: 'web-ci', title: 'fix: thing', branch: 'main', outcome: 'failure', workflowId: '3', actor: 'Sam' })
  })

  it('groups jobs under their stage and lists tasks as steps in order', () => {
    const records: AzRecord[] = [
      { id: 's1', type: 'Stage', name: 'Build' },
      { id: 'p1', parentId: 's1', type: 'Phase', name: 'phase' },
      { id: 'j1', parentId: 'p1', type: 'Job', name: 'Linux', state: 'completed', result: 'failed', log: { id: 7 }, order: 1 },
      { id: 't2', parentId: 'j1', type: 'Task', name: 'Test', state: 'completed', result: 'failed', order: 2 },
      { id: 't1', parentId: 'j1', type: 'Task', name: 'Checkout', state: 'completed', result: 'succeeded', order: 1 },
      { id: 'j2', type: 'Job', name: 'Classic', state: 'pending', order: 2 }
    ]
    const jobs = azureJobs(records, 'web')
    expect(jobs.map((j) => j.name)).toEqual(['Linux', 'Classic'])
    expect(jobs[0]).toMatchObject({ stage: 'Build', hasLog: true, outcome: 'failure' })
    expect(jobs[0].steps.map((s) => s.name)).toEqual(['Checkout', 'Test'])
    expect(jobs[1]).toMatchObject({ stage: undefined, hasLog: false, phase: 'queued' })
  })
})

describe('azure CI runs adapter', () => {
  const make = (records: AzRecord[] = []) => {
    const optional = vi.fn(async (url: string) => {
      if (url.includes('/git/repositories/')) return { id: GUID }
      if (url.includes('/timeline')) return { records }
      if (url.includes('/build/builds?')) return { value: [] }
      if (url.includes('/build/definitions')) return { value: [{ id: 3, name: 'web-ci', path: '\\' }] }
      return {}
    })
    const ado = vi.fn(async () => ({}))
    const text = vi.fn(async () => 'log text')
    const a = azureCiRuns({ org: 'acme', project: 'Web', repoName: 'app', ado: ado as never, optional: optional as never, text })
    return { a, optional, ado, text }
  }

  it('asks for the repository id once', async () => {
    const { a, optional } = make()
    await a.listRuns()
    await a.listRuns('main')
    await a.listWorkflows()
    expect(optional.mock.calls.filter((c) => String(c[0]).includes('/git/repositories/'))).toHaveLength(1)
    const listCall = optional.mock.calls.find((c) => String(c[0]).includes('branchName='))
    expect(listCall?.[0]).toContain(`repositoryId=${GUID}`)
    expect(listCall?.[0]).toContain('branchName=refs%2Fheads%2Fmain')
  })

  it('reads a job log through its timeline record', async () => {
    const { a, text } = make([{ id: GUID, type: 'Job', log: { id: 12 } }])
    expect(await a.getJobLog('42', GUID)).toBe('log text')
    expect(text.mock.calls[0][0]).toBe(`${APIS}/build/builds/42/logs/12?api-version=7.1`)
  })

  it('refuses crafted ids', async () => {
    const { a } = make()
    await expect(a.getJobLog('42/../1', GUID)).rejects.toThrow()
    await expect(a.getJobLog('42', 'x/../y')).rejects.toThrow()
    await expect(a.runAction('1?x', 'cancel')).rejects.toThrow()
  })

  it('retries failed jobs, cancels, and queues a build', async () => {
    const { a, ado } = make()
    await a.runAction('42', 'rerun-failed')
    await a.runAction('42', 'cancel')
    await a.dispatchWorkflow('3', 'main')
    await expect(a.runAction('42', 'rerun')).rejects.toThrow()
    const calls = ado.mock.calls as unknown as Array<[string, RequestInit]>
    expect(calls[0][0]).toBe(`${APIS}/build/builds/42?retry=true&api-version=7.1`)
    expect(calls[1][1].body).toBe('{"status":"cancelling"}')
    expect(JSON.parse(String(calls[2][1].body))).toEqual({ definition: { id: 3 }, sourceBranch: 'refs/heads/main' })
  })
})

describe('azure commit badges', () => {
  it('answers many shas from one builds request', async () => {
    const optional = vi.fn(async (url: string) => {
      if (url.includes('/git/repositories/')) return { id: GUID }
      return {
        value: [
          { id: 3, definition: { id: 1, name: 'ci' }, sourceVersion: 'AAA', status: 'inProgress' },
          { id: 2, definition: { id: 1, name: 'ci' }, sourceVersion: 'aaa', status: 'completed', result: 'failed' },
          { id: 1, definition: { id: 2, name: 'lint' }, sourceVersion: 'aaa', status: 'completed', result: 'succeeded' },
          { id: 0, definition: { id: 1, name: 'ci' }, sourceVersion: 'bbb', status: 'completed', result: 'canceled' }
        ]
      }
    })
    const lookup = azureCiLookupBatch({ org: 'acme', project: 'Web', repoName: 'app', optional: optional as never })
    const [a, b, c] = await Promise.all([lookup('aaa'), lookup('bbb'), lookup('ccc')])
    expect(optional.mock.calls.filter((call) => String(call[0]).includes('/build/builds?'))).toHaveLength(1)
    // The newest build of each pipeline wins: ci is running, so the commit is pending.
    expect(a).toMatchObject({ kind: 'found', status: { state: 'pending' } })
    if (a.kind === 'found') expect(a.status.jobs.map((j) => j.name)).toEqual(['ci', 'lint'])
    expect(b).toMatchObject({ kind: 'found', status: { state: 'neutral', jobs: [{ neutralAs: 'cancelled' }] } })
    expect(c).toEqual({ kind: 'none' })
  })

  it('fails quietly when builds cannot be read', async () => {
    const lookup = azureCiLookupBatch({
      org: 'acme',
      project: 'Web',
      repoName: 'app',
      optional: (async () => { throw new Error('403') }) as never
    })
    expect(await lookup('aaa')).toEqual({ kind: 'failed' })
  })
})
