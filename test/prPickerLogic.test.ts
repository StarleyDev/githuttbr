import { describe, it, expect } from 'vitest'
import { cleanPrMeta, labelColor, picks, prMetaSupport, sortLabels, uniqueById, withoutSelf } from '../src/shared/prMeta'
import {
  createPickerCache,
  filterPicker,
  freeEntry,
  freeLabelCandidate,
  labelItem,
  personItem,
  PICKER_ROWS,
  pickerCacheKey,
  pickerKey,
  type PickerKeyState,
  picksToSend,
  shownFields,
  tokenFingerprint
} from '../src/renderer/src/lib/prPicker'
import {
  azureReviewerIds,
  bbsReviewerIds,
  bitbucketReviewerIds,
  collectPickerOptions,
  createWithoutRejectedReviewers,
  gitlabMetaBody,
  gitlabMetaMissing,
  PrCreateError,
  rejectsReviewers,
  reviewersMissing
} from '../src/main/prMeta'
import type { PrPickerOptions } from '../src/shared/types'

// The pure half of reviewers / assignees / labels on a new pull request: the
// provider table, the normalisations, and the dialog's filter and cache.

describe('prMetaSupport — which host takes which field', () => {
  it('matches the table in the handbook', () => {
    const row = (p: Parameters<typeof prMetaSupport>[0]): string => {
      const s = prMetaSupport(p)
      return [s.reviewers, s.assignees, s.labels].map((b) => (b ? 'y' : '-')).join('')
    }
    expect(row('github')).toBe('yyy')
    expect(row('gitlab')).toBe('yyy')
    expect(row('azure')).toBe('y-y')
    expect(row('bitbucket')).toBe('y--')
    expect(row('forgejo')).toBe('---')
    expect(row(null)).toBe('---')
  })
})

describe('normalising what hosts send and what the renderer sends', () => {
  it('colours: GitHub’s bare hex and GitLab’s #hex, anything else dropped', () => {
    expect(labelColor('D73A4A')).toBe('#d73a4a')
    expect(labelColor('#00ff00')).toBe('#00ff00')
    expect(labelColor('red')).toBeUndefined()
    expect(labelColor(42)).toBeUndefined()
  })

  it('drops the signed-in account by id or login, ignoring case', () => {
    const people = [
      { id: 'Me', login: 'Me' },
      { id: '{x}', login: 'me2' },
      { id: '7', login: 'ME' }
    ]
    expect(withoutSelf(people, 'me').map((p) => p.id)).toEqual(['{x}'])
    expect(withoutSelf(people, null)).toBe(people)
  })

  it('dedupes by id keeping the first, and sorts labels by name', () => {
    expect(uniqueById([{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'a', n: 3 }]).map((x) => x.n)).toEqual([1, 2])
    expect(sortLabels([{ id: 'b', name: 'b' }, { id: 'A', name: 'A' }]).map((l) => l.name)).toEqual(['A', 'b'])
  })

  it('picks: strings only, trimmed, once each — nothing at all becomes undefined', () => {
    expect(picks([' a ', 'a', '', 3, 'b'])).toEqual(['a', 'b'])
    expect(picks([])).toBeUndefined()
    expect(picks('a')).toBeUndefined()
  })

  it('cleanPrMeta drops empty fields so a create without picks is unchanged', () => {
    const base = { title: 'T', body: '', source: 's', target: 't', draft: false }
    expect(cleanPrMeta({ ...base, reviewers: [], assignees: [' '], labels: undefined })).toEqual(base)
    expect(cleanPrMeta({ ...base, labels: ['bug'] })).toEqual({ ...base, labels: ['bug'] })
  })
})

describe('provider mapping', () => {
  const opts = { title: 'T', body: '', source: 's', target: 't', draft: false }

  it('GitLab: numeric ids only, labels comma-joined, nothing when nothing was picked', () => {
    expect(gitlabMetaBody(opts)).toEqual({})
    expect(gitlabMetaBody({ ...opts, reviewers: ['7', 'x'], assignees: ['0'], labels: ['a', 'b'] })).toEqual({
      reviewer_ids: [7],
      labels: 'a,b'
    })
  })

  it('GitLab: a pick missing from the created merge request is named', () => {
    const want = { ...opts, reviewers: ['7'], assignees: ['8'], labels: ['bug'] }
    expect(gitlabMetaMissing(want, { reviewers: [{ id: 7 }], assignees: [{ id: 8 }], labels: ['bug'] })).toEqual([])
    expect(gitlabMetaMissing(want, {})).toEqual(['reviewers', 'assignees', 'labels'])
    expect(gitlabMetaMissing(opts, {})).toEqual([])
  })

  it('reviewersMissing compares identities, not counts — a host-added default reviewer hides nothing', () => {
    expect(reviewersMissing({ ...opts, reviewers: ['a', 'b'] }, ['a'])).toEqual(['reviewers'])
    expect(reviewersMissing({ ...opts, reviewers: ['a', 'b'] }, ['a', 'default'])).toEqual(['reviewers'])
    expect(reviewersMissing({ ...opts, reviewers: ['a'] }, ['A', 'default'])).toEqual([])
    expect(reviewersMissing(opts, [])).toEqual([])
  })

  it('reviewer identities per host', () => {
    expect(bitbucketReviewerIds([{ uuid: '{a}' }, {}, null])).toEqual(['{a}'])
    expect(bbsReviewerIds([{ user: { name: 'Ana', slug: 'ana' } }, { user: {} }])).toEqual(['Ana', 'ana'])
    expect(azureReviewerIds([{ id: 'x' }, { id: 3 }])).toEqual(['x'])
    expect(bitbucketReviewerIds(undefined)).toEqual([])
  })

  it('rejectsReviewers: only a 400/409 that does not blame another field', () => {
    expect(rejectsReviewers(new PrCreateError('x', 400))).toBe(true)
    expect(rejectsReviewers(new PrCreateError('x', 409))).toBe(true)
    expect(rejectsReviewers(new PrCreateError('x', 400, ['reviewers']))).toBe(true)
    expect(rejectsReviewers(new PrCreateError('x', 400, ['source']))).toBe(false)
    expect(rejectsReviewers({ status: 409, exceptions: ['com.atlassian.bitbucket.pull.DuplicatePullRequestException'] })).toBe(false)
    expect(rejectsReviewers({ status: 409, exceptions: ['com.atlassian.bitbucket.pull.InvalidPullRequestReviewersException'] })).toBe(true)
    for (const status of [401, 403, 404, 422, 500]) expect(rejectsReviewers(new PrCreateError('x', status))).toBe(false)
    expect(rejectsReviewers(new TypeError('fetch failed'))).toBe(false)
  })

  it('createWithoutRejectedReviewers: one retry without reviewers, never without a reason', async () => {
    const sent: unknown[] = []
    const refuse = async (o: typeof opts): Promise<number> => {
      sent.push(o.reviewers)
      if (o.reviewers) throw new PrCreateError('bad reviewer', 400)
      return 7
    }
    expect(await createWithoutRejectedReviewers({ ...opts, reviewers: ['x'] }, refuse)).toEqual({ result: 7, dropped: true })
    expect(sent).toEqual([['x'], undefined])
    sent.length = 0
    // No reviewers picked: the failure is the create's own, thrown as is.
    await expect(
      createWithoutRejectedReviewers(opts, async () => {
        throw new PrCreateError('bad', 400)
      })
    ).rejects.toThrow('bad')
    let n = 0
    await expect(
      createWithoutRejectedReviewers({ ...opts, reviewers: ['x'] }, async () => {
        n++
        throw new PrCreateError('auth', 401)
      })
    ).rejects.toThrow('auth')
    expect(n).toBe(1)
  })

  it('collectPickerOptions: one failing list does not take the others down', async () => {
    const o = await collectPickerOptions(
      { reviewers: true, assignees: false, labels: true },
      {
        reviewers: async () => [{ id: 'a', login: 'a' }],
        assignees: async () => [{ id: 'never', login: 'never' }],
        labels: async () => {
          throw new Error('403')
        }
      }
    )
    expect(o.reviewers).toHaveLength(1)
    expect(o.assignees).toEqual([]) // unsupported: never read
    expect(o.failed).toEqual(['labels'])
  })
})

describe('the dialog’s picker', () => {
  const people = [
    personItem({ id: '1', login: 'asilva', name: 'Ana Silva', avatarUrl: 'https://a.example/1' }),
    personItem({ id: '2', login: 'bob', name: 'bob' }),
    personItem({ id: '3', login: 'carla', name: 'Carla Ana' })
  ]

  it('rows: a name equal to the login is not repeated; labels keep their colour', () => {
    expect(people[1]).toEqual({ id: '2', primary: 'bob' })
    expect(labelItem({ id: 'bug', name: 'bug', color: '#ff0000' })).toEqual({ id: 'bug', primary: 'bug', color: '#ff0000' })
  })

  it('filters on login and name, every word, logins starting with the query first', () => {
    expect(filterPicker(people, 'ana sil', []).map((i) => i.id)).toEqual(['1'])
    expect(filterPicker(people, 'ANA', []).map((i) => i.id)).toEqual(['1', '3'])
    expect(filterPicker(people, 'carla', []).map((i) => i.id)).toEqual(['3'])
    expect(filterPicker(people, 'a', ['1']).map((i) => i.id)).toEqual(['3'])
  })

  it('leaves out what is picked, and caps the rows drawn', () => {
    expect(filterPicker(people, '', ['2']).map((i) => i.id)).toEqual(['1', '3'])
    const many = Array.from({ length: 300 }, (_, i) => personItem({ id: String(i), login: `u${i}` }))
    expect(filterPicker(many, '', [])).toHaveLength(PICKER_ROWS)
    expect(filterPicker(many, 'u299', []).map((i) => i.id)).toEqual(['299'])
  })

  it('offers a typed free label only when it is new', () => {
    const labels = [labelItem({ id: 'bug', name: 'bug' })]
    expect(freeLabelCandidate(' docs ', labels, [])).toBe('docs')
    expect(freeLabelCandidate('BUG', labels, [])).toBeNull()
    expect(freeLabelCandidate('docs', labels, ['Docs'])).toBeNull()
    expect(freeLabelCandidate('a,b', labels, [])).toBeNull()
    expect(freeLabelCandidate('  ', labels, [])).toBeNull()
  })

  const options = (over: Partial<PrPickerOptions> = {}): PrPickerOptions => ({
    supports: { reviewers: true, assignees: false, labels: true },
    reviewers: [],
    assignees: [],
    labels: [],
    failed: [],
    ...over
  })

  it('shows supported fields only, and never sends a pick for a hidden one', () => {
    expect(shownFields(null)).toEqual([])
    expect(shownFields(options())).toEqual(['reviewers', 'labels'])
    expect(picksToSend(options(), { reviewers: ['a'], assignees: ['b'], labels: [] })).toEqual({ reviewers: ['a'] })
    expect(picksToSend(null, { reviewers: ['a'], assignees: [], labels: [] })).toEqual({})
  })

  it('caches per key for a few minutes, and forgets a failed read', async () => {
    let now = 0
    const cache = createPickerCache(() => now)
    let loads = 0
    const ok = async (): Promise<PrPickerOptions> => (loads++, options())
    await cache.get('k', ok)
    await cache.get('k', ok)
    expect(loads).toBe(1)
    now = 6 * 60_000
    await cache.get('k', ok)
    expect(loads).toBe(2)

    const bad = async (): Promise<PrPickerOptions> => (loads++, options({ failed: ['labels'] }))
    await cache.get('b', bad)
    await Promise.resolve()
    await cache.get('b', bad)
    expect(loads).toBe(4)

    await expect(cache.get('c', async () => Promise.reject(new Error('x')))).rejects.toThrow('x')
    await Promise.resolve()
    await cache.get('c', ok)
    expect(loads).toBe(5)
  })
})

describe('pickerKey — the picker field’s keys', () => {
  const base: PickerKeyState = { key: 'Enter', composing: false, open: true, cursor: 0, rowCount: 3, text: '', picked: 0 }

  it('Enter with the list closed opens it and adds nothing', () => {
    expect(pickerKey({ ...base, open: false })).toEqual({ kind: 'open' })
  })
  it('Enter with the list open adds the row under the cursor, or nothing when there is none', () => {
    expect(pickerKey({ ...base, cursor: 2 })).toEqual({ kind: 'add', row: 2 })
    expect(pickerKey({ ...base, rowCount: 0 })).toEqual({ kind: 'none' })
  })
  it('during an IME composition no key picks, moves or removes', () => {
    for (const key of ['Enter', 'ArrowDown', 'ArrowUp', 'Backspace', 'Escape']) {
      expect(pickerKey({ ...base, key, composing: true, picked: 2 })).toEqual({ kind: 'none' })
    }
  })
  it('arrows open a closed list, then move within the rows', () => {
    expect(pickerKey({ ...base, key: 'ArrowDown', open: false })).toEqual({ kind: 'open' })
    expect(pickerKey({ ...base, key: 'ArrowDown', cursor: 2 })).toEqual({ kind: 'move', cursor: 2 })
    expect(pickerKey({ ...base, key: 'ArrowUp', cursor: 0 })).toEqual({ kind: 'move', cursor: 0 })
    expect(pickerKey({ ...base, key: 'ArrowDown', cursor: 0 })).toEqual({ kind: 'move', cursor: 1 })
  })
  it('Backspace on an empty field drops the last pick; Escape closes an open list', () => {
    expect(pickerKey({ ...base, key: 'Backspace', picked: 1 })).toEqual({ kind: 'removeLast' })
    expect(pickerKey({ ...base, key: 'Backspace', picked: 1, text: 'a' })).toEqual({ kind: 'none' })
    expect(pickerKey({ ...base, key: 'Escape' })).toEqual({ kind: 'close' })
    expect(pickerKey({ ...base, key: 'Escape', open: false })).toEqual({ kind: 'none' })
  })
})

describe('freeEntry — what a typed entry can stand for', () => {
  const o = (extra: Partial<PrPickerOptions>): PrPickerOptions => ({
    supports: { reviewers: true, assignees: true, labels: true },
    reviewers: [],
    assignees: [],
    labels: [],
    failed: [],
    ...extra
  })
  it('labels on a host that creates them, always', () => {
    expect(freeEntry(o({ freeLabels: true }), 'labels')).toBe(true)
    expect(freeEntry(o({}), 'labels')).toBe(false)
  })
  it('people only where the id is the login, and only when the list failed', () => {
    expect(freeEntry(o({ freePeople: true }), 'reviewers')).toBe(false)
    expect(freeEntry(o({ freePeople: true, failed: ['reviewers'] }), 'reviewers')).toBe(true)
    expect(freeEntry(o({ freePeople: true, failed: ['reviewers'] }), 'assignees')).toBe(false)
    expect(freeEntry(o({ failed: ['reviewers'] }), 'reviewers')).toBe(false)
    expect(freeEntry(null, 'labels')).toBe(false)
  })
})

describe('pickerCacheKey — one entry per account, never the token', () => {
  const tokens = { github: 'ghp_secret_token_1' }
  it('changes with the profile and with the token, and holds neither token', () => {
    const k = pickerCacheKey('/r', 'https://github.com/a/b', ['work', undefined], tokens)
    expect(k).not.toContain('ghp_secret')
    expect(pickerCacheKey('/r', 'https://github.com/a/b', ['personal', undefined], tokens)).not.toBe(k)
    expect(pickerCacheKey('/r', 'https://github.com/a/b', ['work', 'personal'], tokens)).not.toBe(k)
    expect(pickerCacheKey('/r', 'https://github.com/a/b', ['work', undefined], { github: 'ghp_secret_token_2' })).not.toBe(k)
    expect(pickerCacheKey('/r', 'https://github.com/a/b', ['work', undefined], { ...tokens })).toBe(k)
  })
  it('the fingerprint is short and stable', () => {
    expect(tokenFingerprint({ a: 'x', b: undefined })).toMatch(/^[0-9a-f]{8}$/)
    expect(tokenFingerprint({ b: undefined, a: 'x' })).toBe(tokenFingerprint({ a: 'x', b: undefined }))
  })
})
