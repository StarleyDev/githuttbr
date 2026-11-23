import { describe, expect, it } from 'vitest'
import { awaitingSeenKey, newlyAwaitingReview, notifiesReviewRequests } from '../src/renderer/src/lib/reviewNotify'
import { effectiveProfileId, type RepoProfileSettings } from '../src/renderer/src/lib/repoProfile'
import type { PullRequest } from '../src/shared/types'

const pr = (id: number, awaitingYou = false): PullRequest =>
  ({ id, title: `PR ${id}`, author: 'x', sourceBranch: '', targetBranch: '', url: '', isDraft: false, awaitingYou }) as PullRequest

describe('newlyAwaitingReview', () => {
  it('only remembers on the first look, so a backlog is not announced', () => {
    const first = newlyAwaitingReview(undefined, [pr(1, true), pr(2)])
    expect(first.fresh).toEqual([])
    expect([...first.seen]).toEqual([1])
  })

  it('announces a PR that starts waiting, once', () => {
    const a = newlyAwaitingReview(new Set([1]), [pr(1, true), pr(3, true), pr(4)])
    expect(a.fresh.map((p) => p.id)).toEqual([3])
    const b = newlyAwaitingReview(a.seen, [pr(1, true), pr(3, true)])
    expect(b.fresh).toEqual([])
  })

  it('announces again when a request comes back after being answered', () => {
    const answered = newlyAwaitingReview(new Set([5]), [pr(5)])
    expect(answered.fresh).toEqual([])
    expect(newlyAwaitingReview(answered.seen, [pr(5, true)]).fresh.map((p) => p.id)).toEqual([5])
  })

  it('leaves GitHub to its own inbox', () => {
    expect(notifiesReviewRequests('github')).toBe(false)
    expect(notifiesReviewRequests('gitlab')).toBe(true)
    expect(notifiesReviewRequests('forgejo')).toBe(true)
    expect(notifiesReviewRequests(null)).toBe(false)
  })
})

describe('awaitingSeenKey — a profile switch', () => {
  it('starts the other profile from a first look, so its backlog is not announced', () => {
    const seen = new Map<string, Set<number>>()
    const look = (profile: string, prs: PullRequest[]): PullRequest[] => {
      const key = awaitingSeenKey(profile, '/repo')
      const r = newlyAwaitingReview(seen.get(key), prs)
      seen.set(key, r.seen)
      return r.fresh
    }
    expect(look('personal', [pr(1, true)])).toEqual([]) // first look primes
    // Switching to the work account: its pending reviews are old news, not new requests.
    expect(look('work', [pr(7, true), pr(8, true)])).toEqual([])
    // Back to personal, where #2 is genuinely new.
    expect(look('personal', [pr(1, true), pr(2, true)]).map((p) => p.id)).toEqual([2])
    expect(awaitingSeenKey('a', '/r')).not.toBe(awaitingSeenKey('b', '/r'))
  })
})

describe('review notices for a repository bound to a profile', () => {
  const settings = (active: string): RepoProfileSettings => ({
    activeProfileId: active,
    profiles: [{ id: 'work' }, { id: 'personal' }],
    repoProfiles: { '/bound': 'personal' }
  })
  const seen = new Map<string, Set<number>>()
  // What refreshPRs does: the list is fetched as the repository's account, and
  // remembered under it.
  const look = (active: string, path: string, prs: PullRequest[]): PullRequest[] => {
    const key = awaitingSeenKey(effectiveProfileId(settings(active), path), path)
    const r = newlyAwaitingReview(seen.get(key), prs)
    seen.set(key, r.seen)
    return r.fresh
  }

  it('switching the active profile does not re-announce what the bound account still has waiting', () => {
    expect(look('work', '/bound', [pr(1, true), pr(2, true)])).toEqual([]) // first look primes
    expect(look('personal', '/bound', [pr(1, true), pr(2, true)])).toEqual([])
    expect(look('work', '/bound', [pr(1, true), pr(2, true), pr(3, true)]).map((p) => p.id)).toEqual([3])
  })

  it('an unbound repository still follows the active profile', () => {
    expect(effectiveProfileId(settings('work'), '/free')).toBe('work')
    expect(effectiveProfileId(settings('personal'), '/free')).toBe('personal')
    // A binding to a deleted profile counts as none.
    expect(effectiveProfileId({ ...settings('work'), repoProfiles: { '/bound': 'gone' } }, '/bound')).toBe('work')
  })
})
