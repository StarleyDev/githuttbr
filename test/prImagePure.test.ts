import { describe, it, expect } from 'vitest'
import {
  encodePathSegments,
  getImageMime,
  getImageSides,
  isFullCommitSha,
  isLfsPointer,
  isPreviewableImage,
  isSafeRepoFilePath
} from '../src/shared/prImage'
import { createPrImageCache } from '../src/renderer/src/lib/prImageCache'

// The pull request image preview's pure logic: which files are images, which
// file each side of the comparison reads, what may reach git or a URL, and the
// page's bounded cache.

describe('pull request image preview — which files, which sides, what is kept', () => {
  it('detects the previewed image types by extension, case-insensitively, and nothing else', () => {
    for (const p of ['a.png', 'b/C.JPG', 'x.jpeg', 'y.gif', 'z.webp', 'w.bmp', 'favicon.ico', 'p.avif', 'logo.svg']) {
      expect(isPreviewableImage(p), p).toBe(true)
    }
    for (const p of ['a.pdf', 'png', 'dir.png/readme', 'x.png.txt', 'Makefile', '.env', 'a.tiff']) {
      expect(isPreviewableImage(p), p).toBe(false)
    }
    expect(getImageMime('logo.svg')).toBe('image/svg+xml')
    expect(getImageMime('icon.ICO')).toBe('image/x-icon')
  })

  it('reads the right file on each side: added, removed, modified, renamed', () => {
    const c = { baseSha: 'b'.repeat(40), headSha: 'h'.repeat(40) }
    const B = c.baseSha
    const H = c.headSha
    expect(getImageSides({ filename: 'a.png', status: 'added' }, c)).toEqual({ before: null, after: { sha: H, path: 'a.png' } })
    expect(getImageSides({ filename: 'a.png', status: 'removed' }, c)).toEqual({ before: { sha: B, path: 'a.png' }, after: null })
    expect(getImageSides({ filename: 'a.png', status: 'modified' }, c)).toEqual({
      before: { sha: B, path: 'a.png' },
      after: { sha: H, path: 'a.png' }
    })
    expect(getImageSides({ filename: 'new/a.png', status: 'renamed', previousFilename: 'old/a.png' }, c)).toEqual({
      before: { sha: B, path: 'old/a.png' },
      after: { sha: H, path: 'new/a.png' }
    })
    // No base named: no "before", rather than a guess.
    expect(getImageSides({ filename: 'a.png', status: 'modified' }, { baseSha: null, headSha: H }).before).toBeNull()
  })

  it('lets only full ids and contained paths through, and encodes a path per segment', () => {
    expect(isFullCommitSha('a'.repeat(40))).toBe(true)
    expect(isFullCommitSha('a'.repeat(64))).toBe(true)
    expect(isFullCommitSha('HEAD')).toBe(false)
    expect(isFullCommitSha('a'.repeat(12))).toBe(false)
    for (const ok of ['a.png', 'assets/ícone novo 🎨.png', 'a b/c.png']) expect(isSafeRepoFilePath(ok), ok).toBe(true)
    for (const bad of ['', '/abs.png', '../x.png', 'a/../x.png', 'a//b.png', './a.png', 'a\\b.png', 'a\nb.png', 'a/']) {
      expect(isSafeRepoFilePath(bad), JSON.stringify(bad)).toBe(false)
    }
    expect(encodePathSegments('a b/ç#?.png')).toBe('a%20b/%C3%A7%23%3F.png')
  })

  it('tells a Git LFS pointer from an image', () => {
    const enc = (s: string): Uint8Array => new TextEncoder().encode(s)
    expect(isLfsPointer(enc('version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 9\n'))).toBe(true)
    expect(isLfsPointer(enc('version https://git-lfs.github.com/spec/v1' + 'x'.repeat(2000)))).toBe(false)
    expect(isLfsPointer(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
  })

  it('the image cache: one read for two asks in flight, and a byte bound', async () => {
    const cache = createPrImageCache()
    let reads = 0
    const read = async (): Promise<{ status: 'ok'; dataUrl: string }> => {
      reads++
      return { status: 'ok', dataUrl: 'data:image/png;base64,AA' }
    }
    const [a, b] = await Promise.all([cache.loadImage('s', 'a.png', read), cache.loadImage('s', 'a.png', read)])
    expect(a).toEqual(b)
    expect(reads).toBe(1)
    await cache.loadImage('s', 'a.png', read)
    expect(reads).toBe(1)
    // A failed read is not remembered: the next ask reads again.
    const failing = createPrImageCache()
    await expect(failing.loadImage('s', 'x.png', () => Promise.reject(new Error('offline')))).rejects.toThrow()
    expect(await failing.loadImage('s', 'x.png', read)).toMatchObject({ status: 'ok' })
  })

  it('the image cache: hits by commit and path, forgets the oldest past either bound, never keeps "missing"', () => {
    const ok = (n: number): { status: 'ok'; dataUrl: string } => ({ status: 'ok', dataUrl: 'x'.repeat(n) })
    const cache = createPrImageCache(2, 100)
    cache.setImage('s1', 'a.png', ok(10))
    cache.setImage('s1', 'b.png', ok(10))
    expect(cache.getImage('s1', 'a.png')).toEqual(ok(10)) // touched: b is now the oldest
    cache.setImage('s2', 'a.png', ok(10))
    expect(cache.getImage('s1', 'b.png')).toBeUndefined()
    expect(cache.getImage('s1', 'a.png')).toBeDefined()
    // By size: one large entry pushes out the rest.
    cache.setImage('s3', 'big.png', ok(95))
    expect(cache.getSize()).toBeLessThanOrEqual(100)
    expect(cache.getImage('s3', 'big.png')).toBeDefined()
    // Larger than the whole bound: shown, never kept.
    cache.setImage('s4', 'huge.png', ok(500))
    expect(cache.getImage('s4', 'huge.png')).toBeUndefined()
    cache.setImage('s5', 'gone.png', { status: 'missing' })
    expect(cache.getImage('s5', 'gone.png')).toBeUndefined()
  })
})
