import type { PrImageContent } from '../../../shared/prImage'

/**
 * The images a pull request page has already read, so going back to a file
 * does not read it again — from git or, worse, from the host. Keyed by commit
 * and path (a commit's file never changes), least recently used first out, and
 * bounded twice: by entries and by the characters of the data URLs it holds,
 * since one screenshot can weigh more than a hundred icons.
 */
export interface PrImageCache {
  getImage: (sha: string, path: string) => PrImageContent | undefined
  setImage: (sha: string, path: string, content: PrImageContent) => void
  /** Characters held, for the bound. */
  getSize: () => number
}

/** What one entry weighs: its data URL, or a token amount for "too large". */
function weigh(content: PrImageContent): number {
  return content.status === 'ok' ? content.dataUrl.length : 64
}

export function createPrImageCache(maxEntries = 60, maxChars = 96 * 1024 * 1024): PrImageCache {
  const map = new Map<string, PrImageContent>()
  let size = 0
  const keyOf = (sha: string, path: string): string => `${sha}\u0000${path}`
  return {
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
      if (weigh(content) > maxChars) return
      map.set(key, content)
      size += weigh(content)
      for (const [k, v] of map) {
        if (map.size <= maxEntries && size <= maxChars) break
        map.delete(k)
        size -= weigh(v)
      }
    },
    getSize: () => size
  }
}
