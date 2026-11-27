import { describe, expect, it } from 'vitest'
import { titleForDraft, withoutDraftMarker } from '../src/main/prDraftTitle'

describe('a draft read from the title (GitLab, Forgejo)', () => {
  it('marks a title as a draft with the host\'s own marker', () => {
    expect(titleForDraft('Add search', true, 'Draft:')).toBe('Draft: Add search')
    expect(titleForDraft('Add search', true, 'WIP:')).toBe('WIP: Add search')
  })

  it('never marks a title twice', () => {
    expect(titleForDraft('Draft: Add search', true, 'Draft:')).toBe('Draft: Add search')
    expect(titleForDraft('[WIP] Add search', true, 'WIP:')).toBe('WIP: Add search')
  })

  it('takes every spelling off when the pull request is ready', () => {
    for (const title of ['Draft: Add search', 'draft:Add search', '[Draft] Add search', '(WIP) Add search', 'WIP: Draft: Add search']) {
      expect(titleForDraft(title, false, 'Draft:'), title).toBe('Add search')
    }
  })

  it('leaves a title with the word elsewhere alone', () => {
    expect(withoutDraftMarker('Fix the draft editor')).toBe('Fix the draft editor')
    expect(withoutDraftMarker('Remove WIP: banner')).toBe('Remove WIP: banner')
  })
})
