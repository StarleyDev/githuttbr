/**
 * The changed-file counts the pull request list page shows for hosts whose
 * list carries none (Azure DevOps): one count costs a couple of host calls per
 * PR, so they are read only from that page, a few at a time, and kept here by
 * the PR's head commit — re-opening the page or refreshing it asks the host
 * again only for a PR someone pushed to.
 */

import type { PrFileCountRequest } from '../shared/types'

/** The most rows one call may ask about — a page asks in batches, never the whole history at once. */
export const PR_FILE_COUNT_BATCH = 50
/** Counts read from the host at the same time. */
export const PR_FILE_COUNT_CONCURRENCY = 4
/** Counts remembered across pages — every open PR and a year of finished ones of a few repositories. */
export const PR_FILE_COUNT_CACHE_SIZE = 500

/** Head commits are hex; anything else off the IPC boundary is not a key worth keeping. */
const SHA = /^[0-9a-f]{7,64}$/i

/** The requests from the renderer that are well formed, deduplicated, at most PR_FILE_COUNT_BATCH. */
export function parsePrFileCountRequests(value: unknown): PrFileCountRequest[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  const out: PrFileCountRequest[] = []
  for (const v of value) {
    const { id, headSha } = (v ?? {}) as { id?: unknown; headSha?: unknown }
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || seen.has(id)) continue
    if (typeof headSha !== 'string' || !SHA.test(headSha)) continue
    seen.add(id)
    out.push({ id, headSha: headSha.toLowerCase() })
    if (out.length >= PR_FILE_COUNT_BATCH) break
  }
  return out
}

/**
 * Counts by `repo + PR + head`, the least recently used dropped past `max`. A
 * push changes the head and so the key: the old entry is never read again and
 * ages out.
 */
export class PrFileCountCache {
  private readonly entries = new Map<string, number>()
  constructor(private readonly max = PR_FILE_COUNT_CACHE_SIZE) {}

  static keyOf(repo: string, req: PrFileCountRequest): string {
    return `${repo}\n${req.id}\n${req.headSha}`
  }

  getCount(key: string): number | undefined {
    const n = this.entries.get(key)
    if (n === undefined) return undefined
    // Re-inserted: a Map keeps insertion order, so the front is the least recently used.
    this.entries.delete(key)
    this.entries.set(key, n)
    return n
  }

  setCount(key: string, n: number): void {
    this.entries.delete(key)
    this.entries.set(key, n)
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value as string)
  }

  get size(): number {
    return this.entries.size
  }
}

/**
 * The count of each requested PR: from the cache, else read with `readCount`,
 * PR_FILE_COUNT_CONCURRENCY at a time. A PR whose read failed, or that the host
 * could not count, is absent from the answer — the cell stays blank. A refusal
 * (401/403) stops the reads still queued: the next ones would be refused too.
 */
export async function getPrFileCounts(
  cache: PrFileCountCache,
  repo: string,
  requests: readonly PrFileCountRequest[],
  readCount: (id: number) => Promise<number | null>
): Promise<Record<number, number>> {
  const out: Record<number, number> = {}
  const missing: PrFileCountRequest[] = []
  for (const req of requests) {
    const n = cache.getCount(PrFileCountCache.keyOf(repo, req))
    if (n === undefined) missing.push(req)
    else out[req.id] = n
  }
  let next = 0
  let refused = false
  const worker = async (): Promise<void> => {
    while (next < missing.length && !refused) {
      const req = missing[next++]
      try {
        const n = await readCount(req.id)
        if (n === null) continue
        cache.setCount(PrFileCountCache.keyOf(repo, req), n)
        out[req.id] = n
      } catch (err) {
        const status = (err as { status?: unknown } | null)?.status
        if (status === 401 || status === 403) refused = true
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PR_FILE_COUNT_CONCURRENCY, missing.length) }, worker))
  return out
}
