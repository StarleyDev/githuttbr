import { describe, it, expect } from 'vitest'
import { decodeFileBytes } from '../src/shared/prFileText'
import { canReadDiffAgain, countPatchLines, diffFileVersions, withNoPatchReasons } from '../src/shared/prFileDiff'
import { getNoPatchNotice, hasKnownLineCounts } from '../src/renderer/src/lib/prNoPatch'
import type { PrFile } from '../src/shared/types'

// Pure decisions behind a pull request file with no diff: is it text, why is
// there no patch, and what does the notice say and offer.

const bytes = (...b: number[]): Uint8Array => new Uint8Array(b)
const text = (s: string): { kind: 'text'; text: string } => ({ kind: 'text', text: s })

describe('decodeFileBytes — text or binary, from the bytes', () => {
  it('reads UTF-8, with and without a BOM', () => {
    expect(decodeFileBytes(new TextEncoder().encode('ação\n'))).toEqual(text('ação\n'))
    expect(decodeFileBytes(bytes(0xef, 0xbb, 0xbf, 0x68, 0x69))).toEqual(text('hi'))
  })

  it('reads UTF-16 by its BOM, either byte order', () => {
    expect(decodeFileBytes(bytes(0xff, 0xfe, 0x68, 0x00, 0x69, 0x00))).toEqual(text('hi'))
    expect(decodeFileBytes(bytes(0xfe, 0xff, 0x00, 0x68, 0x00, 0x69))).toEqual(text('hi'))
  })

  it('reads BOM-less UTF-16 despite its NUL bytes', () => {
    expect(decodeFileBytes(new Uint8Array(Buffer.from('plain ascii text\n', 'utf16le')))).toEqual(text('plain ascii text\n'))
  })

  it('calls NUL-laden data binary', () => {
    expect(decodeFileBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x10)).kind).toBe('binary')
  })

  it('reads invalid UTF-8 with few control bytes as a single-byte legacy file', () => {
    expect(decodeFileBytes(new Uint8Array(Buffer.from('café olé\n', 'latin1')))).toEqual(text('café olé\n'))
  })

  it('calls invalid UTF-8 full of control bytes binary', () => {
    expect(decodeFileBytes(bytes(0xff, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0xfe, 0x10)).kind).toBe('binary')
  })

  it('an empty file is empty text', () => {
    expect(decodeFileBytes(new Uint8Array())).toEqual(text(''))
  })
})

describe('diffFileVersions — the patch, or the reason there is none', () => {
  it('diffs two texts and counts the lines', () => {
    const r = diffFileVersions(text('a\nb\n'), text('a\nc\n'))
    expect(r.patch).toMatch(/^@@ /)
    expect(r).toMatchObject({ additions: 1, deletions: 1 })
    expect(r.noPatchReason).toBeUndefined()
  })

  it('binary on either side is binary; the same content is noChanges', () => {
    expect(diffFileVersions({ kind: 'binary' }, text('x')).noPatchReason).toBe('binary')
    expect(diffFileVersions(text('same\n'), text('same\n')).noPatchReason).toBe('noChanges')
  })

  it('a rewrite too big for the line diff is tooLarge, not binary', () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join('\n')
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`).join('\n')
    expect(diffFileVersions(text(a), text(b)).noPatchReason).toBe('tooLarge')
  })

  it('counts a patch', () => {
    expect(countPatchLines('@@ -1 +1,2 @@\n-a\n+b\n+c')).toEqual({ additions: 2, deletions: 1 })
  })
})

describe('withNoPatchReasons — every file without a patch says why', () => {
  const source = { remoteUrl: 'https://example.test/acme/widgets', number: 4, baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40) }
  const files: PrFile[] = [
    { filename: 'a.ts', status: 'modified', additions: 1, deletions: 0, patch: '@@ -0,0 +1 @@\n+x' },
    { filename: 'b.png', status: 'modified', additions: 0, deletions: 0, noPatchReason: 'binary' },
    { filename: 'c.lock', status: 'modified', additions: 900, deletions: 20 },
    { filename: 'd.ts', status: 'modified', additions: 0, deletions: 0, noPatchReason: 'notLoaded' }
  ]

  it('keeps a patched file, keeps a set reason, fills the rest with the fallback, and says where to read again', () => {
    const [a, b, c, d] = withNoPatchReasons(files, 'hostOmitted', source)
    expect(a).toBe(files[0])
    expect(b).toEqual({ ...files[1] })
    expect(c).toMatchObject({ noPatchReason: 'hostOmitted', diffSource: source })
    expect(d).toMatchObject({ noPatchReason: 'notLoaded', diffSource: source })
  })

  it('a rename with no line counted is a pure rename, not a diff left out', () => {
    const [r] = withNoPatchReasons([{ filename: 'b.ts', status: 'renamed', additions: 0, deletions: 0, previousFilename: 'a.ts' }], 'hostOmitted', source)
    expect(r.noPatchReason).toBe('noChanges')
    expect(r.diffSource).toBeUndefined()
  })

  it('no source, no diffSource', () => {
    expect(withNoPatchReasons(files, 'hostOmitted', null).some((f) => f.diffSource)).toBe(false)
  })

  it('only notLoaded, failed and hostOmitted are worth reading again', () => {
    expect(['notLoaded', 'failed', 'hostOmitted'].every((r) => canReadDiffAgain(r as never))).toBe(true)
    expect(['binary', 'tooLarge', 'noChanges'].some((r) => canReadDiffAgain(r as never))).toBe(false)
  })
})

describe('the notice and the counts', () => {
  const source = { remoteUrl: 'https://example.test/acme/widgets', number: 4, baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40) }

  it('maps each reason to its message and action', () => {
    expect(getNoPatchNotice({ noPatchReason: 'binary' })).toEqual({ messageKey: 'prPage.noPatchBinary', action: null, autoLoad: false })
    expect(getNoPatchNotice({ noPatchReason: 'notLoaded', diffSource: source })).toMatchObject({ action: 'load', autoLoad: true })
    expect(getNoPatchNotice({ noPatchReason: 'failed', diffSource: source }).action).toBe('retry')
    expect(getNoPatchNotice({ noPatchReason: 'hostOmitted', diffSource: source }).action).toBe('fetch')
    expect(getNoPatchNotice({ noPatchReason: 'noChanges' }).messageKey).toBe('prPage.noPatchNoChanges')
  })

  it('offers nothing without a place to read from, and reads an old reason-less file as hostOmitted', () => {
    expect(getNoPatchNotice({ noPatchReason: 'failed' })).toMatchObject({ action: null, autoLoad: false })
    expect(getNoPatchNotice({}).messageKey).toBe('prPage.noPatchHostOmitted')
  })

  it('counts are known with a patch or a host count, unknown at 0/0 with no patch', () => {
    expect(hasKnownLineCounts({ patch: '@@', additions: 0, deletions: 0 })).toBe(true)
    expect(hasKnownLineCounts({ additions: 12, deletions: 0 })).toBe(true)
    expect(hasKnownLineCounts({ additions: 0, deletions: 0 })).toBe(false)
  })
})
