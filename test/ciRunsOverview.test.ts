import { describe, expect, it } from 'vitest'
import type { CiRun, CiRunJob, CiRunStep } from '../src/shared/types'
import {
  RECENT_RUNS,
  getDurationPhrase,
  getFailedJob,
  getPassRateTone,
  getQuickFilterCounts,
  getRunProgress,
  getRunSquare,
  getSlowestJob,
  getWorkflowKey,
  getWorkflowSummaries,
  runMatchesQuickFilter
} from '../src/renderer/src/lib/ciRunsOverview'
import { pullRequestFromRef } from '../src/main/ciRuns'
import { githubRun } from '../src/main/ciRunsGithub'
import { gitlabRun } from '../src/main/ciRunsGitlab'

const NOW = 10_000_000
const min = 60_000

let seq = 0
const run = (over: Partial<CiRun> = {}): CiRun => ({
  id: String(++seq),
  name: 'CI',
  title: 'Add login form',
  branch: 'main',
  sha: 'abcdef1234567',
  event: 'push',
  actor: 'sam',
  phase: 'completed',
  outcome: 'success',
  createdAt: NOW - 10 * min,
  startedAt: NOW - 10 * min,
  finishedAt: NOW - 6 * min,
  url: 'https://example.com/run',
  workflowId: '7',
  ...over
})

const step = (phase: CiRunStep['phase']): CiRunStep => ({ name: 's', phase, outcome: phase === 'completed' ? 'success' : null })

const job = (over: Partial<CiRunJob> = {}): CiRunJob => ({
  id: String(++seq),
  name: 'lint',
  phase: 'completed',
  outcome: 'success',
  startedAt: NOW - 5 * min,
  finishedAt: NOW - 4 * min,
  url: '',
  steps: [],
  hasLog: true,
  ...over
})

describe('CI runs overview — squares and tones', () => {
  it('draws a run as one of four squares', () => {
    expect(getRunSquare({ phase: 'running', outcome: null })).toBe('running')
    expect(getRunSquare({ phase: 'queued', outcome: null })).toBe('running')
    expect(getRunSquare({ phase: 'completed', outcome: 'success' })).toBe('passed')
    expect(getRunSquare({ phase: 'completed', outcome: 'failure' })).toBe('failed')
    expect(getRunSquare({ phase: 'completed', outcome: 'cancelled' })).toBe('cancelled')
    expect(getRunSquare({ phase: 'completed', outcome: 'skipped' })).toBe('cancelled')
  })

  it('colours a pass rate by how healthy it is', () => {
    expect(getPassRateTone(100)).toBe('good')
    expect(getPassRateTone(90)).toBe('good')
    expect(getPassRateTone(80)).toBe('warn')
    expect(getPassRateTone(50)).toBe('bad')
  })
})

describe('CI runs overview — workflow summaries', () => {
  it('groups by definition, newest workflow first, squares oldest first', () => {
    const runs = [
      run({ phase: 'running', outcome: null, finishedAt: undefined, event: 'pull_request' }),
      run({ outcome: 'failure', event: 'pull_request' }),
      run({ name: 'Release', workflowId: '9', event: 'release' }),
      run({ event: 'push' }),
      run({ event: 'pull_request' })
    ]
    const [ci, release] = getWorkflowSummaries(runs, {}, NOW)
    expect(ci.key).toBe('7')
    expect(ci.name).toBe('CI')
    expect(ci.triggers).toEqual(['pull_request', 'push'])
    expect(ci.recent).toEqual(['passed', 'passed', 'failed', 'running'])
    // Two of the three finished runs passed; the running one does not count.
    expect(ci.passRate).toBe(67)
    expect(ci.passed).toBe(2)
    expect(ci.failed).toBe(1)
    expect(ci.averageMs).toBe(4 * min)
    expect(release.key).toBe('9')
    expect(release.passRate).toBe(100)
    expect(release.note).toEqual({ kind: 'ago', at: NOW - 6 * min })
  })

  it('keeps only the last ten runs on the card', () => {
    const runs = Array.from({ length: 14 }, () => run())
    const [ci] = getWorkflowSummaries(runs, {}, NOW)
    expect(ci.recent).toHaveLength(RECENT_RUNS)
  })

  it('counts a cancelled run as not passing', () => {
    const runs = [run({ outcome: 'cancelled' }), run({ outcome: 'failure' }), run(), run()]
    const [w] = getWorkflowSummaries(runs, {}, NOW)
    expect(w.passRate).toBe(50)
    expect(w.note).toEqual({ kind: 'cancelled' })
  })

  it('says the last run failed when nothing better is known', () => {
    const [w] = getWorkflowSummaries([run({ outcome: 'failure' }), run()], {}, NOW)
    expect(w.note).toEqual({ kind: 'failed' })
  })

  it('names the slowest job once the jobs of a finished run are held', () => {
    const r = run()
    const jobs = [job({ name: 'lint' }), job({ name: 'test (node 20)', startedAt: NOW - 9 * min, finishedAt: NOW - 4 * min })]
    const [w] = getWorkflowSummaries([r], { [r.id]: jobs }, NOW)
    expect(w.note).toEqual({ kind: 'slowest', job: 'test (node 20)' })
  })

  it('has no pass rate or average before anything finished', () => {
    const [w] = getWorkflowSummaries([run({ phase: 'queued', outcome: null, startedAt: undefined, finishedAt: undefined })], {}, NOW)
    expect(w.passRate).toBeNull()
    expect(w.averageMs).toBeNull()
    expect(w.note).toBeNull()
  })

  it('falls back to the name when the host gives no definition id', () => {
    expect(getWorkflowKey({ workflowId: undefined, name: 'build' })).toBe('build')
    expect(getWorkflowKey({ workflowId: '3', name: 'build' })).toBe('3')
  })

  it('ignores a running job when picking the slowest', () => {
    expect(getSlowestJob([job({ phase: 'running', outcome: null, finishedAt: undefined })], NOW)).toBeNull()
  })
})

describe('CI runs overview — quick filters', () => {
  const runs = [
    run({ outcome: 'failure' }),
    run({ phase: 'running', outcome: null }),
    run({ phase: 'queued', outcome: null }),
    run()
  ]
  it('counts failed and still-moving runs', () => {
    expect(getQuickFilterCounts(runs)).toEqual({ failed: 1, running: 2 })
  })
  it('matches every run without a filter', () => {
    expect(runs.filter((r) => runMatchesQuickFilter(r, null))).toHaveLength(4)
    expect(runs.filter((r) => runMatchesQuickFilter(r, 'failed'))).toHaveLength(1)
  })
})

describe('CI runs overview — progress and failed job', () => {
  it('reads the step the running job is on', () => {
    const jobs = [
      job(),
      job({ phase: 'running', outcome: null, steps: [step('completed'), step('completed'), step('running'), step('queued'), step('queued')] })
    ]
    expect(getRunProgress(jobs)).toEqual({ unit: 'step', current: 3, total: 5 })
  })

  it('counts jobs when the host reports no steps', () => {
    const jobs = [job(), job({ phase: 'running', outcome: null }), job({ phase: 'queued', outcome: null })]
    expect(getRunProgress(jobs)).toEqual({ unit: 'job', current: 2, total: 3 })
  })

  it('has no progress before a job starts', () => {
    expect(getRunProgress([job({ phase: 'queued', outcome: null })])).toBeNull()
    expect(getRunProgress([])).toBeNull()
  })

  it('picks the first failed job with a log', () => {
    const noLog = job({ outcome: 'failure', hasLog: false })
    const withLog = job({ outcome: 'failure', name: 'test' })
    expect(getFailedJob([job(), noLog, withLog])?.name).toBe('test')
    expect(getFailedJob([job()])).toBeNull()
  })

  it('says a whole minute without its seconds', () => {
    expect(getDurationPhrase(8 * min)).toEqual({ key: 'ciRuns.durationMinutesOnly', vars: { m: '8' } })
    expect(getDurationPhrase(4 * min + 24_000)).toEqual({ key: 'prChecks.durationMinutes', vars: { m: '4', s: '24' } })
    expect(getDurationPhrase(58_000)).toEqual({ key: 'prChecks.durationSeconds', vars: { s: '58' } })
  })
})

describe('CI runs — the pull request a run belongs to', () => {
  it('reads GitLab merge request and Azure PR refs', () => {
    expect(pullRequestFromRef('refs/merge-requests/52/head')).toBe(52)
    expect(pullRequestFromRef('refs/merge-requests/7/train')).toBe(7)
    expect(pullRequestFromRef('refs/pull/31/merge')).toBe(31)
    expect(pullRequestFromRef('main')).toBeUndefined()
    expect(pullRequestFromRef('refs/heads/feature/x')).toBeUndefined()
    expect(pullRequestFromRef(null)).toBeUndefined()
  })

  it('carries the number through the GitHub and GitLab mappings', () => {
    const gh = githubRun({
      id: 1,
      head_sha: 'abc',
      created_at: '2026-01-01T00:00:00Z',
      html_url: 'https://example.com/run/1',
      pull_requests: [{ number: 52 }]
    })
    expect(gh.pullRequest).toBe(52)
    expect(githubRun({ id: 2, head_sha: 'abc', created_at: '2026-01-01T00:00:00Z', html_url: '', pull_requests: [] }).pullRequest).toBeUndefined()
    const gl = gitlabRun({
      id: 3,
      ref: 'refs/merge-requests/12/head',
      sha: 'abc',
      status: 'success',
      created_at: '2026-01-01T00:00:00Z',
      web_url: ''
    })
    expect(gl.pullRequest).toBe(12)
  })
})
