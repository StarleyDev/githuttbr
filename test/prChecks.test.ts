import { describe, expect, it } from 'vitest'
import type { PrCheck } from '../src/shared/types'
import {
  getFailedTests,
  getPlainLogLines,
  getRepoRelativePath,
  isFailureLine
} from '../src/renderer/src/lib/testFailures'
import {
  formatCheckDuration,
  getCheckDurationMs,
  getCheckStatePhrase,
  getChecksSummary,
  getLogLines,
  getPlainLog,
  getRerunnableRuns,
  sortChecksByState
} from '../src/renderer/src/lib/prChecksView'
import { getGithubActionsJob, githubCheckRun } from '../src/main/ciRunsGithub'

const R = '\u001b[31m'
const G = '\u001b[32m'
const D = '\u001b[2m'
const X = '\u001b[0m'

// The default vitest reporter in CI: the "Failed Tests" section after the tree.
const VITEST_LOG = [
  '2026-11-20T10:02:11.1234567Z > catalog@1.4.0 test',
  '2026-11-20T10:02:11.1234567Z > vitest run',
  '',
  ` ${G}✓${X} src/index.test.ts (12 tests) 41ms`,
  ` ${R}❯${X} src/cache.test.ts (3 tests | 1 failed) 18ms`,
  `   ${R}×${X} cache > keeps the index between requests 4ms`,
  '',
  `${R}⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯${X}`,
  '',
  ` ${R}FAIL${X}  src/cache.test.ts > cache > keeps the index between requests`,
  `${R}AssertionError${X}: expected 2 to be 1 // Object.is equality`,
  '',
  `${G}- Expected${X}`,
  `${R}+ Received${X}`,
  '',
  ` ${D}❯${X} node_modules/@vitest/expect/dist/index.js:1:1`,
  ` ${D}❯${X} src/cache.test.ts:27:35`,
  '     25|   load()',
  '     26|   load()',
  '     27|   expect(calls).toBe(1)',
  '       |                 ^',
  '',
  `${R}⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯${X}`,
  '',
  ' Test Files  1 failed | 1 passed (2)',
  '      Tests  1 failed | 14 passed (15)'
].join('\n')

// A log cut short, or a reporter without the section: only the tree is left.
const VITEST_TREE_LOG = [
  `${D}Run npm test${X}`,
  '> vitest run',
  '',
  ` ${G}✓${X} src/index.test.ts (12 tests) 41ms`,
  ` ${R}✗${X} src/cache.test.ts (3 tests | 1 failed) 18ms`,
  `   ${R}× keeps the index between requests${X}`,
  '     AssertionError: expected 2 to be 1 // Object.is equality',
  `      ${D}❯ src/cache.test.ts:27:35${X}`,
  '',
  `${R}Error: Process completed with exit code 1.${X}`
].join('\n')

const JEST_LOG = [
  'FAIL src/cache.test.js',
  '  cache',
  '    ✓ loads the index (3 ms)',
  '    ✕ keeps the index between requests (5 ms)',
  '',
  '  ● cache › keeps the index between requests',
  '',
  '    expect(received).toBe(expected) // Object.is equality',
  '',
  '    Expected: 1',
  '    Received: 2',
  '',
  '      25 |   load()',
  '      26 |   load()',
  '    > 27 |   expect(calls).toBe(1)',
  '         |                 ^',
  '      28 | })',
  '',
  '      at Object.toBe (/home/runner/work/catalog/catalog/src/cache.test.js:27:17)',
  '      at Promise.then.completed (node_modules/jest-circus/build/utils.js:298:28)',
  '',
  '  ● Console',
  '',
  '    console.log',
  '      warming up',
  '',
  'PASS src/index.test.js',
  'Test Suites: 1 failed, 1 passed, 2 total',
  'Tests:       1 failed, 13 passed, 14 total'
].join('\n')

const PYTEST_LOG = [
  '============================= test session starts ==============================',
  'collected 9 items',
  '',
  'tests/test_cache.py .F.                                                  [ 33%]',
  'tests/test_index.py ......                                               [100%]',
  '',
  '=================================== FAILURES ===================================',
  '___________________________ TestCache.test_keeps_index ___________________________',
  '',
  'self = <tests.test_cache.TestCache object at 0x7f>',
  '',
  '    def test_keeps_index(self):',
  '        load()',
  '        load()',
  '>       assert calls() == 1',
  'E       assert 2 == 1',
  'E        +  where 2 = calls()',
  '',
  'tests/test_cache.py:27: AssertionError',
  '=========================== short test summary info ============================',
  'FAILED tests/test_cache.py::TestCache::test_keeps_index - assert 2 == 1',
  '========================= 1 failed, 8 passed in 0.12s =========================='
].join('\n')

describe('getFailedTests', () => {
  it('reads vitest’s Failed Tests section, skipping frames in node_modules', () => {
    expect(getFailedTests(VITEST_LOG)).toEqual([
      {
        name: 'cache > keeps the index between requests',
        error: 'AssertionError: expected 2 to be 1 // Object.is equality',
        file: 'src/cache.test.ts',
        line: 27
      }
    ])
  })

  it('falls back to vitest’s tree when the section is missing', () => {
    expect(getFailedTests(VITEST_TREE_LOG)).toEqual([
      {
        name: 'keeps the index between requests',
        error: 'AssertionError: expected 2 to be 1 // Object.is equality',
        file: 'src/cache.test.ts',
        line: 27
      }
    ])
  })

  it('reads jest’s ● blocks, ignoring the code frame and the console', () => {
    expect(getFailedTests(JEST_LOG)).toEqual([
      {
        name: 'cache › keeps the index between requests',
        error: 'expect(received).toBe(expected) // Object.is equality',
        file: '/home/runner/work/catalog/catalog/src/cache.test.js',
        line: 27
      }
    ])
  })

  it('reads pytest’s summary and the line from its FAILURES block', () => {
    expect(getFailedTests(PYTEST_LOG)).toEqual([
      { name: 'TestCache::test_keeps_index', error: 'assert 2 == 1', file: 'tests/test_cache.py', line: 27 }
    ])
  })

  it('reads a pytest log cut before its summary', () => {
    const cut = PYTEST_LOG.split('\n').slice(0, 19).join('\n')
    expect(getFailedTests(cut)).toEqual([
      { name: 'TestCache.test_keeps_index', error: 'assert 2 == 1', file: 'tests/test_cache.py', line: 27 }
    ])
  })

  it('finds nothing in a log that is not a test run', () => {
    expect(getFailedTests('npm ERR! code ELIFECYCLE\nError: Process completed with exit code 1.')).toEqual([])
    expect(getFailedTests('')).toEqual([])
  })

  it('lists a failure printed twice once', () => {
    const twice = `${VITEST_LOG}\n${VITEST_LOG}`
    expect(getFailedTests(twice)).toHaveLength(1)
  })
})

describe('getRepoRelativePath', () => {
  it('keeps a relative path and drops a leading ./', () => {
    expect(getRepoRelativePath('./src/a.ts')).toBe('src/a.ts')
  })

  it('places a runner path through the PR’s own files first', () => {
    expect(getRepoRelativePath('/builds/studio/web/catalog/src/a.ts', ['src/a.ts'])).toBe('src/a.ts')
  })

  it('strips the CI hosts’ checkout folders', () => {
    expect(getRepoRelativePath('/home/runner/work/catalog/catalog/src/a.ts')).toBe('src/a.ts')
    expect(getRepoRelativePath('D:\\a\\catalog\\catalog\\src\\a.ts')).toBe('src/a.ts')
    expect(getRepoRelativePath('/home/vsts/work/1/s/src/a.ts')).toBe('src/a.ts')
  })

  it('refuses a path it cannot place inside the repository', () => {
    expect(getRepoRelativePath('/opt/app/src/a.ts')).toBeNull()
    expect(getRepoRelativePath('../outside.ts')).toBeNull()
  })
})

describe('isFailureLine', () => {
  it('marks failure markers, not every line that mentions an error', () => {
    expect(isFailureLine(' ✗ src/cache.test.ts (3 tests | 1 failed)')).toBe(true)
    expect(isFailureLine('   × keeps the index')).toBe(true)
    expect(isFailureLine('  ● cache › keeps the index')).toBe(true)
    expect(isFailureLine('FAILED tests/test_cache.py::test_a - assert 2 == 1')).toBe(true)
    expect(isFailureLine('E       assert 2 == 1')).toBe(true)
    expect(isFailureLine('     AssertionError: expected 2 to be 1')).toBe(false)
    expect(isFailureLine('  ● Console')).toBe(false)
    expect(isFailureLine(' ✓ src/index.test.ts')).toBe(false)
  })
})

describe('getPlainLogLines', () => {
  it('drops colours, carriage returns and GitHub’s timestamps', () => {
    expect(getPlainLogLines(`2026-11-20T10:02:11.1234567Z ${R}red${X}\r\nnext`)).toEqual(['red', 'next'])
  })
})

const check = (over: Partial<PrCheck>): PrCheck => ({ name: 'ci', status: 'completed', conclusion: 'success', url: '', ...over })

describe('check durations', () => {
  it('measures only a finished check with both times', () => {
    expect(getCheckDurationMs(check({ startedAt: 1000, finishedAt: 73_000 }))).toBe(72_000)
    expect(getCheckDurationMs(check({ startedAt: 1000 }))).toBeNull()
    expect(getCheckDurationMs(check({ status: 'in_progress', startedAt: 1, finishedAt: 2 }))).toBeNull()
  })

  it('words a duration as seconds, minutes or hours', () => {
    expect(formatCheckDuration(36_000)).toEqual({ key: 'prChecks.durationSeconds', vars: { s: '36' } })
    expect(formatCheckDuration(72_000)).toEqual({ key: 'prChecks.durationMinutes', vars: { m: '1', s: '12' } })
    expect(formatCheckDuration(7_500_000)).toEqual({ key: 'prChecks.durationHours', vars: { h: '2', m: '5' } })
  })

  it('says how a check ended, with its time when it has one', () => {
    const failed = check({ conclusion: 'failure', startedAt: 0 + 1, finishedAt: 72_001 })
    expect(getCheckStatePhrase(failed)).toEqual({
      key: 'prChecks.failedIn',
      duration: { key: 'prChecks.durationMinutes', vars: { m: '1', s: '12' } }
    })
    expect(getCheckStatePhrase(check({})).key).toBe('ciRuns.stateSuccess')
    expect(getCheckStatePhrase(check({ status: 'queued', conclusion: null })).key).toBe('ciRuns.stateQueued')
    expect(getCheckStatePhrase(check({ conclusion: 'skipped' })).key).toBe('ciRuns.stateSkipped')
  })
})

describe('getChecksSummary', () => {
  const lint = check({ name: 'lint', startedAt: 1_000, finishedAt: 37_000, sha: 'a41c9e2f00' })
  const test = check({ name: 'test', conclusion: 'failure', startedAt: 1_000, finishedAt: 73_000, sha: 'a41c9e2f00', runId: '12' })

  it('leads with the failures, and adds the run times up', () => {
    expect(getChecksSummary([test, lint])).toEqual({
      state: 'fail',
      headline: { key: 'prChecks.summaryFailed', vars: { failed: '1', total: '2' } },
      shortSha: 'a41c9e2',
      finishedAt: 73_000,
      totalMs: 108_000,
      failed: 1
    })
  })

  it('says nothing about a finish while a check still runs', () => {
    const s = getChecksSummary([lint, check({ status: 'in_progress', conclusion: null })])
    expect(s.state).toBe('pending')
    expect(s.headline.key).toBe('prChecks.summaryRunning')
    expect(s.finishedAt).toBeNull()
  })

  it('reports a green set as passed, without times when the host gave none', () => {
    const s = getChecksSummary([check({}), check({})])
    expect(s.headline).toEqual({ key: 'prChecks.summaryPassed', vars: { passed: '2', total: '2' } })
    expect(s.totalMs).toBeNull()
    expect(s.shortSha).toBeNull()
  })

  it('re-runs each failed run once, and only those the host can re-run', () => {
    const other = check({ conclusion: 'failure', runId: '12' })
    const external = check({ conclusion: 'failure' })
    expect(getRerunnableRuns([test, other, external, lint])).toEqual(['12'])
    expect(getRerunnableRuns([lint])).toEqual([])
  })
})

describe('sortChecksByState', () => {
  it('puts failures first and keeps the host’s order otherwise', () => {
    const a = check({ name: 'a' })
    const b = check({ name: 'b', conclusion: 'failure' })
    const c = check({ name: 'c', status: 'in_progress', conclusion: null })
    const d = check({ name: 'd' })
    expect(sortChecksByState([a, b, c, d]).map((x) => x.name)).toEqual(['b', 'c', 'a', 'd'])
  })
})

describe('getLogLines', () => {
  it('numbers lines from the real start and keeps colour across a newline', () => {
    const lines = getLogLines(`${R}one\ntwo${X}\n × three\n`, 5)
    expect(lines.map((l) => l.n)).toEqual([5, 6, 7])
    expect(lines[1].spans).toEqual([{ text: 'two', style: { color: '#aa0000' } }])
    expect(lines.map((l) => l.failure)).toEqual([false, false, true])
  })

  it('copies the log without colour codes', () => {
    expect(getPlainLog(`${R}red${X}\nplain`)).toBe('red\nplain')
  })
})

describe('githubCheckRun', () => {
  it('reads an Actions job’s run, times and log', () => {
    expect(
      githubCheckRun({
        name: 'test',
        status: 'completed',
        conclusion: 'failure',
        html_url: 'https://github.com/studio/catalog/actions/runs/12/job/34',
        details_url: null,
        head_sha: 'a41c9e2',
        started_at: '2026-11-20T10:00:00Z',
        completed_at: '2026-11-20T10:01:12Z'
      })
    ).toEqual({
      name: 'test',
      status: 'completed',
      conclusion: 'failure',
      url: 'https://github.com/studio/catalog/actions/runs/12/job/34',
      hasLog: true,
      startedAt: Date.parse('2026-11-20T10:00:00Z'),
      finishedAt: Date.parse('2026-11-20T10:01:12Z'),
      sha: 'a41c9e2',
      runId: '12'
    })
  })

  it('leaves another app’s check without a run to re-run or a log to read', () => {
    const c = githubCheckRun({
      name: 'coverage',
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://coverage.example.org/studio/catalog/7',
      details_url: null
    })
    expect(c.runId).toBeUndefined()
    expect(c.hasLog).toBeUndefined()
  })

  it('names the job only from an Actions link', () => {
    expect(getGithubActionsJob('https://github.com/a/b/actions/runs/1/job/2?pr=7')).toEqual({ runId: '1', jobId: '2' })
    expect(getGithubActionsJob('https://github.com/a/b/actions/runs/1/job/2x')).toBeNull()
    expect(getGithubActionsJob(null)).toBeNull()
  })
})
