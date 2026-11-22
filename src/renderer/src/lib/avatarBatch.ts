/**
 * Coalesces avatar lookups into one request per repository. The graph mounts
 * hundreds of rows at once and each `<Avatar>` asks on its own; this turns that
 * into a batch per short window, one entry per author, and remembers what came
 * back for the session.
 *
 * No IPC here — `send` is injected (stores/githubAvatars.ts passes the real
 * one), which keeps the batching testable.
 */

export interface AvatarBatchItem {
  email: string
  sha?: string
}

export interface AvatarBatchScope {
  remoteUrl: string
  repoPath: string
  size: number
}

/** A batch's answer, by lowercased email: URL, `null` for a confirmed miss, absent for "unknown, ask later". */
export type AvatarBatchSend = (scope: AvatarBatchScope, items: AvatarBatchItem[]) => Promise<Record<string, string | null>>

export interface AvatarBatcher {
  request(scope: AvatarBatchScope, email: string, sha?: string): Promise<string | null>
}

interface PendingItem {
  sha?: string
  waiters: ((url: string | null) => void)[]
}

const MAX_BATCH = 100
/**
 * How long an "unknown" (no token, rate limit, offline) is not asked again.
 * Short, so a token entered mid-session shows pictures soon; long enough that
 * scrolling the graph back and forth does not re-send the same batch.
 */
export const AVATAR_UNKNOWN_RETRY_MS = 2 * 60 * 1000

export function createAvatarBatcher(
  send: AvatarBatchSend,
  delayMs = 60,
  now: () => number = Date.now
): AvatarBatcher {
  const known = new Map<string, string | null>()
  const unknownUntil = new Map<string, number>()
  const pending = new Map<string, { scope: AvatarBatchScope; items: Map<string, PendingItem> }>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const flush = (scopeKey: string): void => {
    const batch = pending.get(scopeKey)
    pending.delete(scopeKey)
    clearTimeout(timers.get(scopeKey))
    timers.delete(scopeKey)
    if (!batch) return
    const entries = [...batch.items.entries()]
    void send(batch.scope, entries.map(([email, v]) => ({ email, sha: v.sha })))
      .catch((): Record<string, string | null> => ({}))
      .then((res) => {
        for (const [email, v] of entries) {
          const url = res[email]
          // An answer is kept for the session; "unknown" only for a short while.
          if (url !== undefined) known.set(`${scopeKey}\n${email}`, url)
          else unknownUntil.set(`${scopeKey}\n${email}`, now() + AVATAR_UNKNOWN_RETRY_MS)
          for (const w of v.waiters) w(url ?? null)
        }
      })
  }

  return {
    request(scope, email, sha) {
      const norm = email.trim().toLowerCase()
      const scopeKey = `${scope.remoteUrl}\n${scope.repoPath}\n${scope.size}`
      const hit = known.get(`${scopeKey}\n${norm}`)
      if (hit !== undefined) return Promise.resolve(hit)
      if ((unknownUntil.get(`${scopeKey}\n${norm}`) ?? 0) > now()) return Promise.resolve(null)
      return new Promise((resolve) => {
        let batch = pending.get(scopeKey)
        if (!batch) {
          batch = { scope, items: new Map() }
          pending.set(scopeKey, batch)
          timers.set(scopeKey, setTimeout(() => flush(scopeKey), delayMs))
        }
        const item = batch.items.get(norm)
        if (item) {
          item.sha ??= sha
          item.waiters.push(resolve)
        } else batch.items.set(norm, { sha, waiters: [resolve] })
        if (batch.items.size >= MAX_BATCH) flush(scopeKey)
      })
    }
  }
}
