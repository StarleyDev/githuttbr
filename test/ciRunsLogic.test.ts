import { describe, expect, it } from 'vitest'
import type { CiRun, CiRunJob } from '../src/shared/types'
import {
  CI_POLL_FAST_MS,
  CI_POLL_PATIENCE,
  CI_POLL_SLOW_MS,
  ciDot,
  ciElapsedMs,
  ciPollDelayMs,
  ciStateKey,
  formatElapsed,
  groupJobsByStage,
  hasActiveRuns,
  runActions,
  runHeadline,
  runMatches,
  runMetaName,
  runsSignature
} from '../src/renderer/src/lib/ciRuns'

const run = (over: Partial<CiRun> = {}): CiRun => ({
  id: '1',
  name: 'CI',
  title: 'Add login form',
  branch: 'main',
  sha: 'abcdef1234567',
  event: 'push',
  actor: 'sam',
  phase: 'completed',
  outcome: 'success',
  createdAt: 1_000,
  url: 'https://example.com/run/1',
  ...over
})

const job = (id: string, stage?: string): CiRunJob => ({
  id,
  name: `job ${id}`,
  stage,
  phase: 'completed',
  outcome: 'success',
  url: '',
  steps: [],
  hasLog: false
})

const ALL = { rerun: true, rerunFailed: true, cancel: true, dispatch: true }

describe('ciDot / ciStateKey', () => {
  it('shows anything unfinished as pending, whatever the outcome says', () => {
    expect(ciDot('running', null)).toBe('pending')
    expect(ciDot('queued', 'failure')).toBe('pending')
    expect(ciStateKey('queued', null)).toBe('ciRuns.stateQueued')
    expect(ciStateKey('running', null)).toBe('ciRuns.stateRunning')
  })

  it('colours a finished run by its outcome, neutral for the rest', () => {
    expect(ciDot('completed', 'success')).toBe('pass')
    expect(ciDot('completed', 'failure')).toBe('fail')
    expect(ciDot('completed', 'cancelled')).toBe('neutral')
    expect(ciDot('completed', 'manual')).toBe('neutral')
    expect(ciStateKey('completed', 'manual')).toBe('ciRuns.stateManual')
    expect(ciStateKey('completed', null)).toBe('ciRuns.stateUnknown')
  })
})

describe('hasActiveRuns', () => {
  it('is true only while something has not finished', () => {
    expect(hasActiveRuns([run(), run({ id: '2' })])).toBe(false)
    expect(hasActiveRuns([run(), run({ id: '2', phase: 'queued', outcome: null })])).toBe(true)
    expect(hasActiveRuns([])).toBe(false)
  })
})

describe('ciElapsedMs / formatElapsed', () => {
  it('measures a finished run from start to finish', () => {
    expect(ciElapsedMs({ phase: 'completed', startedAt: 1_000, finishedAt: 66_000 }, 999_999)).toBe(65_000)
  })

  it('measures a running one up to now, from creation when the start is unknown', () => {
    expect(ciElapsedMs({ phase: 'running', createdAt: 10_000 }, 70_000)).toBe(60_000)
  })

  it('has nothing to say about a queued run, or a finished one without an end', () => {
    expect(ciElapsedMs({ phase: 'queued', createdAt: 10_000 }, 70_000)).toBeNull()
    expect(ciElapsedMs({ phase: 'completed', startedAt: 10_000 }, 70_000)).toBeNull()
  })

  it('never goes negative on a clock that moved back', () => {
    expect(ciElapsedMs({ phase: 'running', startedAt: 90_000 }, 70_000)).toBe(0)
  })

  it('formats as m:ss, and h:mm:ss past an hour', () => {
    expect(formatElapsed(5_000)).toBe('0:05')
    expect(formatElapsed(65_000)).toBe('1:05')
    expect(formatElapsed(3_723_000)).toBe('1:02:03')
  })
})

describe('runActions', () => {
  it('offers cancel only while running, re-run only once finished', () => {
    expect(runActions(run({ phase: 'running', outcome: null }), ALL)).toEqual({ rerun: false, rerunFailed: false, cancel: true })
    expect(runActions(run(), ALL)).toEqual({ rerun: true, rerunFailed: false, cancel: false })
  })

  it('offers re-run failed after a failure or a cancel', () => {
    expect(runActions(run({ outcome: 'failure' }), ALL).rerunFailed).toBe(true)
    expect(runActions(run({ outcome: 'cancelled' }), ALL).rerunFailed).toBe(true)
  })

  it('never offers what the host cannot do', () => {
    const none = { rerun: false, rerunFailed: false, cancel: false, dispatch: false }
    expect(runActions(run({ outcome: 'failure' }), none)).toEqual({ rerun: false, rerunFailed: false, cancel: false })
    expect(runActions(run({ phase: 'running', outcome: null }), none).cancel).toBe(false)
  })
})

describe('groupJobsByStage', () => {
  it('keeps stages in the order they first appear', () => {
    const groups = groupJobsByStage([job('1', 'build'), job('2', 'test'), job('3', 'build')])
    expect(groups.map((g) => [g.stage, g.jobs.map((j) => j.id)])).toEqual([
      ['build', ['1', '3']],
      ['test', ['2']]
    ])
  })

  it('puts jobs without a stage in one unnamed group', () => {
    expect(groupJobsByStage([job('1'), job('2')])).toEqual([{ stage: '', jobs: [job('1'), job('2')] }])
  })
})

describe('runHeadline / runMatches', () => {
  it('falls back from title to workflow name to number', () => {
    expect(runHeadline(run())).toBe('Add login form')
    expect(runHeadline(run({ title: '' }))).toBe('CI')
    expect(runHeadline(run({ title: '', name: '', number: 42 }))).toBe('#42')
    expect(runHeadline(run({ title: '', name: '' }))).toBe('#1')
  })

  it('matches title, workflow, branch, actor, commit and event, ignoring case', () => {
    expect(runMatches(run(), '')).toBe(true)
    expect(runMatches(run(), 'LOGIN')).toBe(true)
    expect(runMatches(run(), 'sam')).toBe(true)
    expect(runMatches(run(), 'abcdef1')).toBe(true)
    expect(runMatches(run(), 'push')).toBe(true)
    expect(runMatches(run(), 'deploy')).toBe(false)
  })

  it('does not trip over a run without branch or actor', () => {
    expect(runMatches(run({ branch: null, actor: null, event: null }), 'main')).toBe(false)
  })
})

describe('runHeadline with the local commit subject', () => {
  const subjects = new Map([['abcdef1234567', 'Validate email before sign-up']])
  const subjectOf = (sha: string): string | undefined => subjects.get(sha)

  it('names a title-less run (a GitLab pipeline) after its commit', () => {
    expect(runHeadline(run({ title: '', name: '', number: 7 }), subjectOf)).toBe('Validate email before sign-up')
  })

  it('keeps the host title first, and falls back past an unknown commit', () => {
    expect(runHeadline(run(), subjectOf)).toBe('Add login form')
    expect(runHeadline(run({ title: '', name: '', number: 7, sha: 'ffff' }), subjectOf)).toBe('#7')
  })

  it('lets the filter find a run by the subject it shows', () => {
    const r = run({ title: '' })
    expect(runMatches(r, 'validate')).toBe(false)
    expect(runMatches(r, 'validate', runHeadline(r, subjectOf))).toBe(true)
  })
})

describe('runMetaName', () => {
  it('leaves the workflow name out when the headline already is it', () => {
    expect(runMetaName(run({ name: 'Nightly' }), 'Nightly')).toBeNull()
    expect(runMetaName(run({ name: 'CI' }), 'Add login form')).toBe('CI')
    expect(runMetaName(run({ name: '' }), 'x')).toBeNull()
  })
})

describe('polling', () => {
  it('slows down once the list has stopped changing', () => {
    expect(ciPollDelayMs(0)).toBe(CI_POLL_FAST_MS)
    expect(ciPollDelayMs(CI_POLL_PATIENCE - 1)).toBe(CI_POLL_FAST_MS)
    expect(ciPollDelayMs(CI_POLL_PATIENCE)).toBe(CI_POLL_SLOW_MS)
  })

  it('notices a run that moved, and nothing else', () => {
    const before = runsSignature([run({ phase: 'running', outcome: null })])
    expect(runsSignature([run({ phase: 'running', outcome: null })])).toBe(before)
    expect(runsSignature([run()])).not.toBe(before)
    expect(runsSignature([run({ phase: 'running', outcome: null }), run({ id: '2' })])).not.toBe(before)
  })
})
