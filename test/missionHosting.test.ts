import { describe, expect, it } from 'vitest'
import type { PullRequest } from '../src/shared/types'
import { parseDescribeLong, primaryRemoteUrl } from '../src/shared/gitDescribe'
import {
  HOSTING_TTL_MS,
  hostingDue,
  hostingTotals,
  missionRefreshMs,
  normalizeReleaseTiers,
  releaseNote,
  releaseTone,
  summarizePrs,
  type HostingSummary
} from '../src/renderer/src/lib/missionControl'

const pr = (over: Partial<PullRequest> = {}): PullRequest => ({
  id: 1,
  title: 'feat: a change',
  author: 'Playground',
  sourceBranch: 'feat/x',
  targetBranch: 'main',
  url: 'https://example.invalid/pr/1',
  isDraft: false,
  ...over
})

const summary = (over: Partial<HostingSummary> = {}): HostingSummary => ({
  hasHost: true,
  open: 0,
  capped: false,
  awaiting: 0,
  ci: null,
  sha: 'abc',
  at: 0,
  ...over
})

describe('git describe --long', () => {
  it('reads the tag and the commits after it, dashes in the tag included', () => {
    expect(parseDescribeLong('v1.4.0-9-gabc1234\n')).toEqual({ tag: 'v1.4.0', since: 9 })
    expect(parseDescribeLong('release-2024-01-0-g0123abc')).toEqual({ tag: 'release-2024-01', since: 0 })
  })

  it('is null when no tag was found', () => {
    expect(parseDescribeLong('')).toBeNull()
    expect(parseDescribeLong('fatal: No names found, cannot describe anything.')).toBeNull()
  })
})

describe('the remote hosting data comes from', () => {
  it('prefers origin, else the first remote listed', () => {
    const out = 'remote.upstream.url https://example.invalid/up.git\nremote.origin.url git@example.invalid:me/repo.git\n'
    expect(primaryRemoteUrl(out)).toBe('git@example.invalid:me/repo.git')
    expect(primaryRemoteUrl('remote.fork.url https://example.invalid/fork.git\n')).toBe('https://example.invalid/fork.git')
    expect(primaryRemoteUrl('')).toBeNull()
  })
})

describe('Mission Control refresh interval', () => {
  it('is 30 s by default and never below it', () => {
    expect(missionRefreshMs(undefined)).toBe(30_000)
    expect(missionRefreshMs(5)).toBe(30_000)
    expect(missionRefreshMs(90)).toBe(90_000)
    expect(missionRefreshMs(99_999)).toBe(3_600_000)
  })
})

describe('when the hosting column asks the host again', () => {
  const now = 10 * 60_000

  it('asks for a repository never asked, and when HEAD moved', () => {
    expect(hostingDue(undefined, 'abc', now, 30_000)).toBe(true)
    expect(hostingDue(summary({ at: now }), 'def', now, 30_000)).toBe(true)
  })

  it('waits out the TTL otherwise — or the refresh interval, when that is longer', () => {
    expect(hostingDue(summary({ at: now - 60_000 }), 'abc', now, 30_000)).toBe(false)
    expect(hostingDue(summary({ at: now - HOSTING_TTL_MS }), 'abc', now, 30_000)).toBe(true)
    expect(hostingDue(summary({ at: now - HOSTING_TTL_MS }), 'abc', now, 2 * HOSTING_TTL_MS)).toBe(false)
  })

  it('looks at a running CI again after a minute', () => {
    expect(hostingDue(summary({ at: now - 30_000, ci: 'pending' }), 'abc', now, 30_000)).toBe(false)
    expect(hostingDue(summary({ at: now - 60_000, ci: 'pending' }), 'abc', now, 30_000)).toBe(true)
  })
})

describe('pull request counts', () => {
  it('counts open ones and those awaiting your review, and says when the page was full', () => {
    const prs = [pr({ awaitingYou: true }), pr({ id: 2 }), pr({ id: 3, state: 'merged', awaitingYou: true })]
    expect(summarizePrs(prs)).toEqual({ open: 2, capped: false, awaiting: 1 })
    expect(summarizePrs(Array.from({ length: 30 }, (_, i) => pr({ id: i }))).capped).toBe(true)
  })

  it('totals the header pills over every repository', () => {
    const totals = hostingTotals([summary({ open: 3, awaiting: 1, ci: 'failure' }), summary({ open: 2, ci: 'success' })])
    expect(totals).toEqual({ prs: 5, awaiting: 1, ciFailing: 1 })
  })
})

describe('the release column', () => {
  it('says no tags, up to date, or how many commits since', () => {
    expect(releaseNote(null)).toEqual({ key: 'mission.release.none' })
    expect(releaseNote({ tag: 'v1', since: 0 })).toEqual({ key: 'mission.release.current' })
    expect(releaseNote({ tag: 'v1', since: 9 })).toEqual({ key: 'mission.release.since', n: 9 })
  })
})

describe('release note colours', () => {
  const tiers = normalizeReleaseTiers(undefined)

  it('starts quiet, turns yellow past 5 commits and red past 20, the range past 50 red too', () => {
    expect(tiers).toEqual({ limits: [5, 20, 50], tones: ['muted', 'yellow', 'red', 'red'] })
    const at = (since: number): string => releaseTone({ tag: 'v1', since }, tiers)
    expect([at(0), at(5), at(6), at(20), at(21), at(50), at(51)]).toEqual([
      'muted',
      'muted',
      'yellow',
      'yellow',
      'red',
      'red',
      'red'
    ])
    expect(releaseTone(null, tiers)).toBe('muted')
  })

  it('takes a fourth colour for the last range', () => {
    const four = normalizeReleaseTiers({ limits: [5, 20, 50], tones: ['muted', 'yellow', 'red', 'purple'] })
    expect(releaseTone({ tag: 'v1', since: 51 }, four)).toBe('purple')
  })

  it('repairs what a hand-edited file may hold', () => {
    const fixed = normalizeReleaseTiers({ limits: [30, 10, -2.4], tones: ['green', 'nope', 'purple'] })
    expect(fixed).toEqual({ limits: [30, 30, 30], tones: ['green', 'yellow', 'purple', 'red'] })
  })

  it('keeps a custom #rrggbb colour and drops anything else that is not a tone', () => {
    const custom = normalizeReleaseTiers({ limits: [5, 20, 50], tones: ['#12ab9F', '#xyz', 'muted', 'red'] })
    expect(custom.tones).toEqual(['#12ab9F', 'yellow', 'muted', 'red'])
    expect(releaseTone({ tag: 'v1', since: 1 }, custom)).toBe('#12ab9F')
  })

  it('still reads the first shape, its last tone kept for the ranges above', () => {
    const old = normalizeReleaseTiers({ warnAfter: 3, alertAfter: 10, tones: ['muted', 'accent', 'purple'] })
    expect(old).toEqual({ limits: [3, 10, 50], tones: ['muted', 'accent', 'purple', 'purple'] })
  })
})
