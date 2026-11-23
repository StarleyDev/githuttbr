import { describe, it, expect } from 'vitest'
import { cleanPrMeta, labelColor, picks, prMetaSupport, sortLabels, uniqueById, withoutSelf } from '../src/shared/prMeta'
import {
  createPickerCache,
  filterPicker,
  freeLabelCandidate,
  labelItem,
  personItem,
  PICKER_ROWS,
  picksToSend,
  shownFields
} from '../src/renderer/src/lib/prPicker'
import { collectPickerOptions, gitlabMetaBody, gitlabMetaMissing, reviewersMissing } from '../src/main/prMeta'
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

  it('Bitbucket: fewer reviewers back than asked for is a failure', () => {
    expect(reviewersMissing({ ...opts, reviewers: ['a', 'b'] }, [{}])).toEqual(['reviewers'])
    expect(reviewersMissing({ ...opts, reviewers: ['a'] }, [{}])).toEqual([])
    expect(reviewersMissing(opts, undefined)).toEqual([])
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
