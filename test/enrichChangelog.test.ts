import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain .mjs script, no type declarations
import { bodyItems, enrichChangelog } from '../scripts/enrich-changelog.mjs'

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)

const changelog = [
  '## [2.1.0](https://example.test/compare/v2.0.0...v2.1.0) (2026-01-02)',
  '',
  '### Features',
  '',
  `* **pr:** a new tab ([aaaaaaa](https://example.test/commit/${SHA_A}))`,
  '',
  '## [2.0.0](https://example.test/compare/v1.0.0...v2.0.0) (2026-01-01)',
  '',
  '### Features',
  '',
  `* **ui:** an older thing ([bbbbbbb](https://example.test/commit/${SHA_B}))`,
  ''
].join('\n')

const bodies: Record<string, string> = {
  [SHA_A]: [
    '- The tab lists every push, newest first, with its',
    '  date and author.',
    '- A New badge marks what arrived since your last visit.',
    '',
    'Co-Authored-By: Someone <someone@example.test>'
  ].join('\n'),
  [SHA_B]: '- Older item one.\n- Older item two.\n'
}

describe('enrich-changelog', () => {
  it('joins wrapped items and drops trailers', () => {
    expect(bodyItems(bodies[SHA_A])).toEqual([
      'The tab lists every push, newest first, with its date and author.',
      'A New badge marks what arrived since your last visit.'
    ])
  })

  it('keeps a wrapped line that reads like a trailer inside its item', () => {
    expect(bodyItems('- It has no undo on\n  purpose: undoing would write it back.\n')).toEqual([
      'It has no undo on purpose: undoing would write it back.'
    ])
  })

  it('ignores prose paragraphs and keeps only "- " items', () => {
    expect(bodyItems('Some prose about why.\n\n- One item.\n')).toEqual(['One item.'])
  })

  it('keeps GitHub from linking a hash-number as an issue', () => {
    const [item] = bodyItems('- Fixes the case in #12.')
    expect(item).not.toMatch(/#\d/)
    expect(item.replace(/⁠/g, '')).toBe('Fixes the case in #12.')
  })

  it('enriches only the newest version by default', () => {
    const out = enrichChangelog(changelog, (sha: string) => bodies[sha])
    expect(out).toContain('  - The tab lists every push, newest first, with its date and author.')
    expect(out).not.toContain('  - Older item one.')
  })

  it('enriches every version with all, and is idempotent', () => {
    const once = enrichChangelog(changelog, (sha: string) => bodies[sha], { all: true })
    expect(once).toContain('  - Older item two.')
    const twice = enrichChangelog(once, (sha: string) => bodies[sha], { all: true })
    expect(twice).toBe(once)
  })

  it('leaves an entry alone when its commit cannot be read', () => {
    const out = enrichChangelog(
      changelog,
      () => {
        throw new Error('unknown revision')
      },
      { all: true }
    )
    expect(out).toBe(changelog)
  })
})
