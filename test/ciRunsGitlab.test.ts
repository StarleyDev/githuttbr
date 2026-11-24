import { describe, expect, it, vi } from 'vitest'
import {
  cleanGitlabTrace,
  gitlabCiRuns,
  gitlabCommitCiLookup,
  gitlabJob,
  gitlabOutcome,
  gitlabPhase,
  gitlabRun
} from '../src/main/ciRunsGitlab'

const BASE = 'https://gitlab.example.com/api/v4/projects/acme%2Fapp'

describe('gitlab CI runs mapping', () => {
  it('maps statuses to phase and outcome', () => {
    expect(gitlabPhase('running')).toBe('running')
    expect(gitlabPhase('waiting_for_resource')).toBe('queued')
    expect(gitlabPhase('manual')).toBe('completed')
    expect(gitlabOutcome('manual')).toBe('manual')
    expect(gitlabOutcome('failed')).toBe('failure')
    expect(gitlabOutcome('canceled')).toBe('cancelled')
    expect(gitlabOutcome('pending')).toBeNull()
    expect(gitlabOutcome('something-new')).toBe('unknown')
  })

  it('maps a pipeline', () => {
    const run = gitlabRun({
      id: 100,
      iid: 4,
      ref: 'main',
      sha: 'abc',
      source: 'push',
      status: 'success',
      created_at: '2026-01-01T00:00:00Z',
      finished_at: '2026-01-01T00:02:00Z',
      web_url: 'https://gitlab.example.com/acme/app/-/pipelines/100'
    })
    expect(run).toMatchObject({ id: '100', number: 4, name: '', event: 'push', phase: 'completed', outcome: 'success' })
    expect(run.finishedAt).toBe(Date.parse('2026-01-01T00:02:00Z'))
  })

  it('maps a job with its stage and no steps; no trace before it ran', () => {
    const job = gitlabJob({ id: 9, name: 'lint', stage: 'test', status: 'failed' })
    expect(job).toMatchObject({ stage: 'test', steps: [], hasLog: true, outcome: 'failure' })
    expect(gitlabJob({ id: 10, name: 'deploy', status: 'manual' }).hasLog).toBe(false)
  })

  it('cleans ANSI colours and section markers from a trace', () => {
    const raw =
      '\x1b[0Ksection_start:1700000000:prepare_script\r\x1b[0K\x1b[36;1mPreparing\x1b[0;m\n' +
      'ok\r\n\x1b[0Ksection_end:1700000001:prepare_script\r\x1b[0K\n'
    expect(cleanGitlabTrace(raw)).toBe('Preparing\nok\n\n')
  })
})

describe('gitlab CI runs adapter', () => {
  const make = () => {
    const json = vi.fn(async () => [] as unknown)
    const send = vi.fn(async () => {})
    const text = vi.fn(async () => '\x1b[31mboom\x1b[0m')
    return { a: gitlabCiRuns({ base: BASE, json: json as never, sendRequest: send, text }), json, send, text }
  }

  it('retries the failed jobs and cancels; refuses a full re-run', async () => {
    const { a, send } = make()
    await a.runAction('5', 'rerun-failed')
    await a.runAction('5', 'cancel')
    await expect(a.runAction('5', 'rerun')).rejects.toThrow()
    expect(send.mock.calls.map((c) => c[0])).toEqual([`${BASE}/pipelines/5/retry`, `${BASE}/pipelines/5/cancel`])
  })

  it('starts a pipeline on a branch', async () => {
    const { a, send } = make()
    await a.dispatchWorkflow('pipeline', 'feat/x')
    expect(send.mock.calls[0][0]).toBe(`${BASE}/pipeline?ref=feat%2Fx`)
  })

  it('reads a cleaned trace and refuses a crafted id', async () => {
    const { a, text } = make()
    expect(await a.getJobLog('1', '9')).toBe('boom')
    expect(text.mock.calls[0][0]).toBe(`${BASE}/jobs/9/trace`)
    await expect(a.getJobLog('1', '9/../../x')).rejects.toThrow()
  })

  it('filters runs by ref', async () => {
    const { a, json } = make()
    await a.listRuns('main')
    expect((json.mock.calls[0] as unknown[])[0]).toContain('ref=main')
  })
})

describe('gitlab commit badge', () => {
  it('aggregates statuses', async () => {
    const json = vi.fn(async () => [
      { name: 'build', status: 'success', target_url: 'u1' },
      { name: 'test', status: 'running' },
      { name: 'old', status: 'canceled' }
    ])
    const r = await gitlabCommitCiLookup(json as never, BASE, 'abcdef1')
    expect(r.kind).toBe('found')
    if (r.kind !== 'found') return
    expect(r.status.state).toBe('pending')
    expect(r.status.jobs[2]).toMatchObject({ state: 'neutral', neutralAs: 'cancelled' })
  })

  it('settles a green pipeline whose deploy waits for a manual start', async () => {
    const json = vi.fn(async () => [
      { name: 'build', status: 'success' },
      { name: 'test', status: 'success' },
      { name: 'deploy', status: 'manual' },
      { name: 'never-reached', status: 'created' }
    ])
    const r = await gitlabCommitCiLookup(json as never, BASE, 'abcdef1')
    expect(r.kind === 'found' && r.status.state).toBe('success')
  })

  it('none when empty, failed on an error or a bad sha', async () => {
    expect(await gitlabCommitCiLookup((async () => []) as never, BASE, 'abcdef1')).toEqual({ kind: 'none' })
    expect(
      await gitlabCommitCiLookup((async () => { throw new Error('x') }) as never, BASE, 'abcdef1')
    ).toEqual({ kind: 'failed' })
    expect(await gitlabCommitCiLookup((async () => []) as never, BASE, '../x')).toEqual({ kind: 'failed' })
  })
})
