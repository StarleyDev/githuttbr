import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs script, untyped on purpose
import { retryDecision, formatDecision } from '../scripts/release-retry.mjs'

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

  it('re-runs every failed job in one call when several never started', () => {
    const d = retryDecision({ jobs: [neverStarted('release (windows-latest)'), neverStarted(), job('publish', 'skipped')] }, {
      run: done,
      attempt: 1
    })
    expect(d).toEqual({ action: 'rerun-failed' })
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

  it('stops on a real failure plus several never-started jobs (re-run-failed would repeat the failure)', () => {
    const d = retryDecision(
      { jobs: [job('release (windows-latest)', 'failure', ['failure']), neverStarted(), neverStarted('release (ubuntu-latest)')] },
      { run: done, attempt: 1 }
    )
    expect(d.action).toBe('stop')
  })

  it('stops when the attempts are used up', () => {
    const d = retryDecision({ jobs: [neverStarted()] }, { run: { status: 'completed', run_attempt: 3 }, attempt: 3, maxAttempts: 3 })
    expect(d).toEqual({ action: 'stop', reason: '3 of 3 attempts used' })
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
    expect(retryDecision({})).toEqual({ action: 'stop', reason: 'no failed job' })
  })

  it('falls back to re-run-failed when the payload carries no job id', () => {
    expect(retryDecision({ jobs: [{ name: 'mac', conclusion: 'cancelled', steps: [] }] })).toEqual({ action: 'rerun-failed' })
  })
})
