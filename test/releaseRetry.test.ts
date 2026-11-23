import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './helpers'
// @ts-expect-error — a plain .mjs script, untyped on purpose
import { retryDecision, formatDecision, MAC_BUILD_RE, MAC_REPORT_RE } from '../scripts/release-retry.mjs'

let nextId = 100
const job = (name: string, conclusion: string | null, steps: Array<string | null> = []) => ({
  id: nextId++,
  name,
  conclusion,
  steps: steps.map((c) => ({ conclusion: c }))
})

const ok = (name: string) => job(name, 'success', ['success', 'success'])
const neverStarted = (name = 'mac / build (macos-26)') => job(name, 'cancelled')
const done = { status: 'completed', run_attempt: 1 }

describe('release retry decision', () => {
  it('re-runs only the macOS job when it never got a runner', () => {
    const mac = neverStarted()
    const d = retryDecision(
      { jobs: [ok('draft'), ok('release (ubuntu-latest)'), ok('release (windows-latest)'), mac, ok('publish'), ok('mac / report')] },
      { run: done, attempt: 1, maxAttempts: 3 }
    )
    expect(d).toEqual({ action: 'rerun-job', jobId: mac.id })
    expect(formatDecision(d)).toBe(`rerun-job ${mac.id}`)
  })

  // A maintainer pressed Cancel while Linux/Windows were building and publish
  // was waiting. The run concludes 'cancelled' and this fires: only macOS may
  // come back, never publish — that would make a bad draft public.
  it('after a cancel by hand with publish queued, re-runs macOS alone and reports the rest', () => {
    const mac = neverStarted()
    const d = retryDecision(
      {
        jobs: [
          ok('draft'),
          job('release (ubuntu-latest)', 'cancelled', ['success', 'cancelled']),
          neverStarted('release (windows-latest)'),
          mac,
          neverStarted('publish'),
          job('mac / report', 'success', ['success'])
        ]
      },
      { run: done, attempt: 1 }
    )
    expect(d).toEqual({ action: 'rerun-job', jobId: mac.id, unstarted: ['release (windows-latest)', 'publish'] })
    expect(formatDecision(d)).toBe(`rerun-job ${mac.id}`)
  })

  it('after a cancel by hand, re-runs nothing when macOS was already built', () => {
    const d = retryDecision(
      { jobs: [ok('draft'), neverStarted('release (windows-latest)'), ok('mac / build (macos-26)'), ok('mac / report'), neverStarted('publish')] },
      { run: done, attempt: 1 }
    )
    expect(d).toEqual({ action: 'stop', reason: 'macOS already built', unstarted: ['release (windows-latest)', 'publish'] })
    expect(formatDecision(d)).toBe('stop: macOS already built')
  })

  it('never re-runs a Linux or Windows job that never started; it is reported instead', () => {
    const d = retryDecision(
      {
        jobs: [
          ok('draft'),
          neverStarted('release (ubuntu-latest)'),
          neverStarted('release (windows-latest)'),
          job('publish', 'skipped'),
          ok('mac / build (macos-26)'),
          ok('mac / report')
        ]
      },
      { run: done, attempt: 1 }
    )
    expect(d.action).toBe('stop')
    expect(d.unstarted).toEqual(['release (ubuntu-latest)', 'release (windows-latest)'])
  })

  it('never re-runs the draft job, even when macOS was skipped behind it', () => {
    const d = retryDecision({ jobs: [neverStarted('draft'), job('mac / build (macos-26)', 'skipped'), job('mac / report', 'skipped')] }, {
      run: done,
      attempt: 1
    })
    expect(d).toEqual({ action: 'stop', reason: 'macOS build skipped', unstarted: ['draft'] })
  })

  it('re-runs the report alone when the build landed but the report never ran', () => {
    const report = neverStarted('mac / report')
    const d = retryDecision({ jobs: [ok('mac / build (macos-26)'), report] }, { run: done, attempt: 1 })
    expect(d).toEqual({ action: 'rerun-job', jobId: report.id })
  })

  it('leaves a real build failure alone', () => {
    const d = retryDecision({ jobs: [job('mac / build (macos-26)', 'failure', ['success', 'failure'])] }, { run: done, attempt: 1 })
    expect(d.action).toBe('stop')
    expect(d.reason).toContain('macos-26')
  })

  it('still re-runs a never-started macOS job next to a real Windows failure, by id', () => {
    const mac = neverStarted()
    const d = retryDecision({ jobs: [job('release (windows-latest)', 'failure', ['success', 'failure']), mac] }, { run: done, attempt: 1 })
    expect(d).toEqual({ action: 'rerun-job', jobId: mac.id })
  })

  it('stops when the attempts are used up, still naming what never started', () => {
    const d = retryDecision({ jobs: [neverStarted()] }, { run: { status: 'completed', run_attempt: 3 }, attempt: 3, maxAttempts: 3 })
    expect(d).toEqual({ action: 'stop', reason: '3 of 3 attempts used' })
    const e = retryDecision({ jobs: [neverStarted(), neverStarted('publish')] }, { run: { status: 'completed', run_attempt: 3 }, attempt: 3 })
    expect(e).toEqual({ action: 'stop', reason: '3 of 3 attempts used', unstarted: ['publish'] })
  })

  // The v4.39.0 failure mode: the event is stale. A re-run request on a run
  // that is already going again (someone pressed the button, or another
  // trigger got there first) is refused by the API.
  it('does not ask for a re-run when the run is going again or a newer attempt exists', () => {
    const jobs = { jobs: [neverStarted()] }
    expect(retryDecision(jobs, { run: { status: 'queued', run_attempt: 2 }, attempt: 1 })).toEqual({
      action: 'stop',
      reason: 'the run is running again'
    })
    expect(retryDecision(jobs, { run: { status: 'completed', run_attempt: 2 }, attempt: 1 })).toEqual({
      action: 'stop',
      reason: 'attempt 2 already exists'
    })
  })

  it('counts skipped steps as not run, and needs a failure to act', () => {
    const j = job('mac / build (macos-26)', 'failure', ['skipped', null])
    expect(retryDecision({ jobs: [j] }, { run: done, attempt: 1 })).toEqual({ action: 'rerun-job', jobId: j.id })
    expect(retryDecision({ jobs: [ok('mac / build')] }).action).toBe('stop')
    expect(retryDecision({})).toEqual({ action: 'stop', reason: 'no macOS job in this run' })
  })

  it('never falls back to re-running the whole run', () => {
    expect(retryDecision({ jobs: [{ name: 'mac / build (macos-26)', conclusion: 'cancelled', steps: [] }] })).toEqual({
      action: 'stop',
      reason: 'mac / build (macos-26) has no job id'
    })
    const wf = readFileSync(join(ROOT, '.github/workflows/release-retry.yml'), 'utf8')
    expect(wf).not.toContain('rerun-failed')
    expect(wf).toContain('/actions/jobs/${verdict#rerun-job }/rerun')
  })
})

// The decision finds the macOS jobs by the names GitHub gives a reusable
// workflow's jobs: "<caller job id> / <job name>". Renaming either side
// silently stops the retry, so pin both.
describe('macOS job names', () => {
  type Wf = { jobs: Record<string, { name?: string; uses?: string }> }
  const load = (f: string) => yaml.load(readFileSync(join(ROOT, '.github/workflows', f), 'utf8')) as Wf

  it('match what Release and release-mac.yml produce', () => {
    const release = load('release.yml')
    expect(release.jobs.mac.uses).toBe('./.github/workflows/release-mac.yml')
    expect(release.jobs.mac.name).toBeUndefined()
    const mac = load('release-mac.yml')
    expect(mac.jobs.build.name).toBe('build (${{ inputs.runner }})')
    expect(mac.jobs.report.name).toBeUndefined()
    expect(MAC_BUILD_RE.test('mac / build (macos-26)')).toBe(true)
    expect(MAC_REPORT_RE.test('mac / report')).toBe(true)
    for (const other of ['draft', 'publish', 'release (ubuntu-latest)', 'release (windows-latest)']) {
      expect(MAC_BUILD_RE.test(other) || MAC_REPORT_RE.test(other)).toBe(false)
    }
  })
})
