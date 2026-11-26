import type { PrImageContent } from '../../../shared/prImage'

/**
 * The images a pull request page has already read, so going back to a file —
 * or a refresh of the page — does not read it again, from git or, worse, from
 * the host. Keyed by commit and path (a commit's file never changes), least
 * recently used first out, and bounded by the bytes of the data URLs it holds
 * (one screenshot can weigh more than a hundred icons) as well as by entries.
 * Two asks for the same image while the first is still out share one read.
 */
export interface PrImageCache {
  getImage: (sha: string, path: string) => PrImageContent | undefined
  setImage: (sha: string, path: string, content: PrImageContent) => void
  /** The cached image, else one read shared by every caller until it lands. */
  loadImage: (sha: string, path: string, read: () => Promise<PrImageContent>) => Promise<PrImageContent>
  /** Bytes held, for the bound. */
  getSize: () => number
}

/** The default bound: about 40 MB of data URLs. */
export const PR_IMAGE_CACHE_BYTES = 40 * 1024 * 1024

/** What one entry weighs: its data URL (ASCII, one byte a character), or a token amount otherwise. */
function weigh(content: PrImageContent): number {
  return content.status === 'ok' ? content.dataUrl.length : 64
}

export function createPrImageCache(maxEntries = 60, maxBytes = PR_IMAGE_CACHE_BYTES): PrImageCache {
  const map = new Map<string, PrImageContent>()
  const inflight = new Map<string, Promise<PrImageContent>>()
  let size = 0
  const keyOf = (sha: string, path: string): string => `${sha}\u0000${path}`
  const cache: PrImageCache = {
    getImage: (sha, path) => {
      const key = keyOf(sha, path)
      const hit = map.get(key)
      if (hit === undefined) return undefined
      // Touch: re-inserting moves it to the newest end.
      map.delete(key)
      map.set(key, hit)
      return hit
    },
    setImage: (sha, path, content) => {
      // "Missing" is not remembered: a fetch of the branch can make it present.
      if (content.status === 'missing') return
      const key = keyOf(sha, path)
      const old = map.get(key)
      if (old) {
        size -= weigh(old)
        map.delete(key)
      }
      // An image larger than the whole bound is shown, never kept.
      if (weigh(content) > maxBytes) return
      map.set(key, content)
      size += weigh(content)
      for (const [k, v] of map) {
        if (map.size <= maxEntries && size <= maxBytes) break
        map.delete(k)
        size -= weigh(v)
      }
    },
    loadImage: (sha, path, read) => {
      const hit = cache.getImage(sha, path)
      if (hit) return Promise.resolve(hit)
      const key = keyOf(sha, path)
      const pending = inflight.get(key)
      if (pending) return pending
      const run = read()
        .then((content) => {
          cache.setImage(sha, path, content)
          return content
        })
        .finally(() => inflight.delete(key))
      inflight.set(key, run)
      return run
    },
    getSize: () => size
  }
  return cache
}
