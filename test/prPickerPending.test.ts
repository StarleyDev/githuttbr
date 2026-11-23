import { describe, it, expect } from 'vitest'
import { prMetaSupport } from '../src/shared/prMeta'
import { freeLabelCandidate, NO_PICKS, picksForAccount, typedEntry, withPendingText } from '../src/renderer/src/lib/prPicker'
import { rejectsReviewers } from '../src/main/prMeta'
import { explainGitError } from '../src/renderer/src/lib/gitErrorHint'
import type { PrPickerOptions } from '../src/shared/types'

// What the create-PR dialog sends beyond the chips: text typed but never
// confirmed with Enter, a login typed with its `@`, and picks made under an
// account that is no longer the one in use.

const github = (over: Partial<PrPickerOptions> = {}): PrPickerOptions => ({
  supports: prMetaSupport('github'),
  freeLabels: true,
  freePeople: true,
  reviewers: [{ id: 'ana', login: 'ana' }],
  assignees: [{ id: 'ana', login: 'ana' }],
  labels: [{ id: 'bug', name: 'bug' }],
  failed: [],
  ...over
})

describe('withPendingText', () => {
  it('adds a free label typed but not confirmed', () => {
    const out = withPendingText(github(), { ...NO_PICKS }, { labels: '  needs docs ' })
    expect(out.labels).toEqual(['needs docs'])
  })

  it('maps typed text to the listed row it names, ignoring case and a leading @', () => {
    const out = withPendingText(github(), { ...NO_PICKS }, { reviewers: '@ANA', labels: 'BUG' })
    expect(out.reviewers).toEqual(['ana'])
    expect(out.labels).toEqual(['bug'])
  })

  it('adds a typed login on a people field whose list failed (free entry)', () => {
    const out = withPendingText(github({ failed: ['assignees'], assignees: [] }), { ...NO_PICKS }, { assignees: '@bob' })
    expect(out.assignees).toEqual(['bob'])
  })

  it('ignores text a list-only field cannot take, and never duplicates a pick', () => {
    // A loaded GitHub list is everyone who can be picked: an unknown login adds nothing.
    const out = withPendingText(github(), { ...NO_PICKS, labels: ['bug'] }, { reviewers: 'stranger', labels: 'Bug' })
    expect(out.reviewers).toEqual([])
    expect(out.labels).toEqual(['bug'])
  })

  it('a field the host does not support is never filled', () => {
    const azure: PrPickerOptions = { supports: prMetaSupport('azure'), freeLabels: true, reviewers: [], assignees: [], labels: [], failed: [] }
    expect(withPendingText(azure, { ...NO_PICKS }, { assignees: 'bob' }).assignees).toEqual([])
    expect(withPendingText(null, { ...NO_PICKS }, { labels: 'x' }).labels).toEqual([])
  })
})

describe('typed logins', () => {
  it('drops a leading @ from a person, never from a label', () => {
    expect(typedEntry(' @ana ', 'person')).toBe('ana')
    expect(typedEntry('@team', 'label')).toBe('@team')
    expect(freeLabelCandidate('@bob', [], [], 'person')).toBe('bob')
    expect(freeLabelCandidate('@', [], [], 'person')).toBeNull()
  })
})

describe('picksForAccount', () => {
  const picked = { reviewers: ['ana'], assignees: [], labels: ['bug'] }
  it('keeps the picks on the first load and on the same account', () => {
    expect(picksForAccount(null, 'k1', picked)).toBe(picked)
    expect(picksForAccount('k1', 'k1', picked)).toBe(picked)
  })
  it('starts over when the account (profile or token) changes', () => {
    expect(picksForAccount('k1', 'k2', picked)).toEqual(NO_PICKS)
  })
})

describe('rejectsReviewers: Data Center 404s', () => {
  it('a 404 naming NoSuchUserException is a refused reviewer', () => {
    expect(rejectsReviewers({ status: 404, exceptions: ['com.atlassian.bitbucket.user.NoSuchUserException'] })).toBe(true)
  })
  it('a bare 404, or one about the repository, is not', () => {
    expect(rejectsReviewers({ status: 404 })).toBe(false)
    expect(rejectsReviewers({ status: 404, exceptions: ['com.atlassian.bitbucket.repository.NoSuchRepositoryException'] })).toBe(false)
  })
  it('auth and server failures still are not, whatever they name', () => {
    for (const status of [401, 403, 500, 503]) {
      expect(rejectsReviewers({ status, exceptions: ['com.atlassian.bitbucket.user.NoSuchUserException'] })).toBe(false)
    }
  })
})

describe('the Data Center address error is translated', () => {
  it('maps BBS_BAD_REMOTE to its key', async () => {
    const { BBS_BAD_REMOTE } = await import('../src/main/hosting')
    expect(explainGitError(`Error invoking remote method 'hosting:createPR': Error: ${BBS_BAD_REMOTE}`)).toEqual({
      key: 'gitError.bbsBadRemote'
    })
  })
})
