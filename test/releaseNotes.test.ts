import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './helpers'
// @ts-expect-error — a plain .mjs script, no type declarations
import { buildReleaseNotes, changelogSection, compareVersions, parseNotice } from '../scripts/release-notes.mjs'

const changelog = [
  '## [4.60.0](https://example.test/compare/v4.59.1...v4.60.0) (2026-12-01)',
  '',
  '### Features',
  '',
  '* a thing ([aaaaaaa](https://example.test/commit/a))',
  '  - One item.',
  '',
  '## [4.59.1](https://example.test/compare/v4.59.0...v4.59.1) (2026-11-26)',
  '',
  '* an older thing ([bbbbbbb](https://example.test/commit/b))',
  ''
].join('\n')

const notice = parseNotice('---\nfrom: 4.59.0\nuntil: 4.65.0\n---\n> Heads-up.\n', 'n.md')

describe('release notes', () => {
  it('compares versions numerically, ignoring a pre-release suffix', () => {
    expect(compareVersions('4.10.0', '4.9.9')).toBeGreaterThan(0)
    expect(compareVersions('v4.26.0-huttbr.1', '4.26.0')).toBe(0)
  })

  it('takes only the version section, without blank lines', () => {
    expect(changelogSection(changelog, '4.60.0')).toEqual([
      '### Features',
      '* a thing ([aaaaaaa](https://example.test/commit/a))',
      '  - One item.'
    ])
  })

  it('puts a notice on top for every version in its range, and only there', () => {
    expect(buildReleaseNotes('4.60.0', changelog, [notice])).toMatch(/^> Heads-up\.\n\n### Features/)
    expect(buildReleaseNotes('4.59.0', changelog, [notice])).toMatch(/^> Heads-up\./)
    expect(buildReleaseNotes('4.65.0', changelog, [notice])).not.toContain('Heads-up')
    expect(buildReleaseNotes('4.58.0', changelog, [notice])).not.toContain('Heads-up')
  })

  it('refuses a notice without a from/until range', () => {
    expect(() => parseNotice('> no front matter', 'x.md')).toThrow(/front matter/)
    expect(() => parseNotice('---\nfrom: 4.59.0\n---\nbody', 'x.md')).toThrow(/from and until/)
  })

  it('every notice in the repository parses', () => {
    const dir = join(ROOT, '.github/release-notices')
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      expect(() => parseNotice(readFileSync(join(dir, f), 'utf8'), f)).not.toThrow()
    }
  })
})
