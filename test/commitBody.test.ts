import { describe, expect, it } from 'vitest'
import {
  isCoAuthorTrailer,
  reflowCommitBody,
  splitCommitBody
} from '../src/renderer/src/lib/commitBody'

describe('the description below a commit subject', () => {
  it('has none for a one-line message', () => {
    expect(splitCommitBody('chore: bump deps\n')).toEqual({ text: '', trailers: [] })
  })

  it('keeps the description and lifts the trailers out', () => {
    const body = splitCommitBody(
      'feat: use coverages\n\nThe mapper reads products[i].coverages.\nCards hide empty benefits.\n\nCo-authored-by: Alex Example <alex@example.com>\nRefs: CMS-124\n'
    )
    expect(body.text).toBe('The mapper reads products[i].coverages.\nCards hide empty benefits.')
    expect(body.trailers).toEqual([
      { key: 'Co-authored-by', value: 'Alex Example <alex@example.com>' },
      { key: 'Refs', value: 'CMS-124' }
    ])
  })

  it('keeps a closing sentence with a colon as text', () => {
    // A one-line description shaped like a trailer stays the description…
    const body = splitCommitBody('fix: retry\n\nWhy: clients saw duplicates, and this stops it')
    expect(body).toEqual({ text: 'Why: clients saw duplicates, and this stops it', trailers: [] })
    // …and so does a paragraph of prose.
    const prose = splitCommitBody('fix: retry\n\nWhy it matters: duplicates.\nAnd it stops them.')
    expect(prose.trailers).toEqual([])
    expect(prose.text).toBe('Why it matters: duplicates.\nAnd it stops them.')
  })

  it('reads a message whose second line is not blank, and Windows line ends', () => {
    expect(splitCommitBody('fix: a\nsecond line\r\nthird').text).toBe('second line\nthird')
  })

  it('a message that is only trailers has no description', () => {
    expect(splitCommitBody('chore: x\n\nSigned-off-by: Sam Example <sam@example.com>')).toEqual({
      text: '',
      trailers: [{ key: 'Signed-off-by', value: 'Sam Example <sam@example.com>' }]
    })
  })
})

describe('trailer chips', () => {
  it('knows a co-author trailer, in any case', () => {
    expect(isCoAuthorTrailer({ key: 'Co-Authored-By', value: 'x' })).toBe(true)
    expect(isCoAuthorTrailer({ key: 'Refs', value: 'x' })).toBe(false)
  })
})

describe('a hand-wrapped description in a narrow panel', () => {
  it('joins the lines of a paragraph, keeping paragraphs apart', () => {
    expect(reflowCommitBody('What: the greeting kept the name only\nin memory, so a reconnect lost it.\n\nWhy: duplicates.')).toBe(
      'What: the greeting kept the name only in memory, so a reconnect lost it.\n\nWhy: duplicates.'
    )
  })

  it('keeps list items, indented code and quotes on their own lines', () => {
    const text = 'How:\n- save the name;\n- read it back.\n\n    npm test\n    npm run build\n> quoted\n> twice'
    expect(reflowCommitBody(text)).toBe(text)
  })
})
