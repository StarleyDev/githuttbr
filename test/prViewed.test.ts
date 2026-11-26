import { describe, it, expect } from 'vitest'
import type { PrFile } from '../src/shared/types'
import {
  getFileFingerprint,
  getLegacyViewedKey,
  getViewedMarksKey,
  getViewedState,
  migrateLegacyViewed,
  parseViewedMarks,
  setViewedMarks
} from '../src/renderer/src/lib/prViewed'

const file = (filename: string, patch?: string, extra: Partial<PrFile> = {}): PrFile => ({
  filename,
  status: 'modified',
  additions: 1,
  deletions: 1,
  ...(patch !== undefined ? { patch } : {}),
  ...extra
})

describe('getFileFingerprint', () => {
  it('is the same for the same change and differs once the diff moves', () => {
    const a = file('src/a.ts', '@@ -1 +1 @@\n-old\n+new')
    expect(getFileFingerprint(a)).toBe(getFileFingerprint({ ...a }))
    expect(getFileFingerprint(a)).not.toBe(getFileFingerprint({ ...a, patch: '@@ -1 +1 @@\n-old\n+newer' }))
  })

  it('still tells a patchless file apart by status and counts', () => {
    const bin = file('logo.png', undefined, { additions: 0, deletions: 0 })
    expect(getFileFingerprint(bin)).not.toBe(getFileFingerprint({ ...bin, status: 'removed' }))
    expect(getFileFingerprint(bin)).not.toBe(getFileFingerprint({ ...bin, previousFilename: 'old.png' }))
  })
})

describe('viewed marks', () => {
  it('keeps marks under their own key, apart from the old path-only list', () => {
    const url = 'https://example.com/team/app.git'
    expect(getViewedMarksKey(url, 7)).not.toBe(getLegacyViewedKey(url, 7))
    expect(getLegacyViewedKey(url, 7)).toBe(`githuttbr-pr-viewed:${url}#7`)
  })

  it('un-views a file a push changed, and flags it', () => {
    const before = [file('a.ts', 'p1'), file('b.ts', 'p1')]
    const marks = setViewedMarks({}, before, true)
    const after = [file('a.ts', 'p1'), file('b.ts', 'p2'), file('c.ts', 'p1')]
    const state = getViewedState(marks, after)
    expect([...state.viewed]).toEqual(['a.ts'])
    expect([...state.changed]).toEqual(['b.ts'])
  })

  it('ignores marks of files no longer in the pull request', () => {
    const marks = setViewedMarks({}, [file('gone.ts', 'p')], true)
    const state = getViewedState(marks, [file('a.ts', 'p')])
    expect(state.viewed.size + state.changed.size).toBe(0)
  })

  it('unticks without touching other marks', () => {
    const files = [file('a.ts', 'p'), file('b.ts', 'p')]
    const marks = setViewedMarks(setViewedMarks({}, files, true), [files[0]], false)
    expect(Object.keys(marks)).toEqual(['b.ts'])
  })

  it('reads only well-formed marks back', () => {
    expect(parseViewedMarks(null)).toEqual({})
    expect(parseViewedMarks('not json')).toEqual({})
    expect(parseViewedMarks('["a.ts"]')).toEqual({})
    expect(parseViewedMarks('{"a.ts":"x","b.ts":3}')).toEqual({ 'a.ts': 'x' })
  })
})

describe('migrateLegacyViewed', () => {
  const files = [file('a.ts', 'p1'), file('b.ts', 'p1')]

  it('takes the old paths as viewed at the version shown now', () => {
    const marks = migrateLegacyViewed('["a.ts","gone.ts"]', files, {})
    expect(marks).toEqual({ 'a.ts': getFileFingerprint(files[0]) })
    expect([...getViewedState(marks, files).viewed]).toEqual(['a.ts'])
  })

  it('lets a mark already in the new format win', () => {
    const marks = migrateLegacyViewed('["a.ts"]', files, { 'a.ts': 'older' })
    expect(marks['a.ts']).toBe('older')
  })

  it('leaves the marks alone when the old list is unreadable', () => {
    const marks = { 'b.ts': 'x' }
    expect(migrateLegacyViewed('{', files, marks)).toBe(marks)
    expect(migrateLegacyViewed('{"a.ts":1}', files, marks)).toBe(marks)
    expect(migrateLegacyViewed(null, files, marks)).toEqual(marks)
  })
})
