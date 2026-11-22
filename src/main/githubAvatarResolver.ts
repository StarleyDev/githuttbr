import { createHash } from 'node:crypto'
import { GITHUB_COM, githubEndpoints } from '../shared/githubEnterprise'
import { githubAvatarSized, githubNoreplyAvatarUrl, isGithubAvatarUrl } from '../shared/githubAvatar'

/**
 * Commit-author pictures from a GitHub or GitHub Enterprise Server API — the
 * part with no Electron in it, so the tests can drive it with a fake fetch.
 * main/avatars.ts wires it to IPC, the user-data folder and the profile tokens.
 *
 * A commit carries a name and an email, never an account. The account behind an
 * email is found the way the host itself does it when it draws a commit:
 *
 *   GET /repos/{owner}/{repo}/commits/{sha}        → `author.avatar_url`
 *   GET /repos/{owner}/{repo}/commits?author=EMAIL → the same, when the sha is
 *                                                    not on the server (unpushed)
 *
 * (docs.github.com, REST → Commits; `author` is a Simple User, or an empty
 * object when the email belongs to no account.) The search API would answer
 * the same question at 30 requests a minute instead of 5000 an hour.
 *
 * Every request goes to the repository's own server with that server's token —
 * `tokenFor` is passed per call by the caller, which resolves it for that
 * repository's server only.
 */

export interface AvatarTarget {
  /** `GITHUB_COM` or a GHES base, as the remote resolved. */
  base: string
  owner: string
  repo: string
}

export interface AvatarRequest {
  email: string
  /** A commit by that email in this repository, when the caller has one. */
  sha?: string
}

/** `url` null is a confirmed miss: the email belongs to no account on that server. */
export interface AvatarCacheEntry {
  url: string | null
  at: number
}

export type AvatarCacheFile = Record<string, AvatarCacheEntry>

export interface AvatarResolverDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  now?: () => number
  load?: () => Promise<AvatarCacheFile>
  save?: (entries: AvatarCacheFile) => void
  concurrency?: number
}

export const AVATAR_HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const AVATAR_MISS_TTL_MS = 24 * 60 * 60 * 1000
/** A refusal that is not a rate limit (SSO not authorised, no access): ask again later, not per author. */
const AVATAR_FORBIDDEN_PAUSE_MS = 10 * 60 * 1000
/** Secondary limits without a retry-after: the docs say at least a minute. */
const AVATAR_SECONDARY_PAUSE_MS = 60 * 1000
const CACHE_MAX_ENTRIES = 5000
const MAX_BATCH = 200

/**
 * The cache key: a hash of the server and the lowercased email. The persistent
 * cache lives on disk next to the settings, and a list of every author's
 * address is not something to leave lying in a file.
 */
export function avatarCacheKey(base: string, email: string): string {
  return createHash('sha256').update(`${base.toLowerCase()}\n${email.trim().toLowerCase()}`).digest('hex')
}

/** Whether a cached answer still stands: hits for a week, misses for a day. */
export function isAvatarEntryFresh(entry: AvatarCacheEntry | undefined, now: number): entry is AvatarCacheEntry {
  if (!entry) return false
  const age = now - entry.at
  return age >= 0 && age < (entry.url ? AVATAR_HIT_TTL_MS : AVATAR_MISS_TTL_MS)
}

/** The newest entries only, so the file stays small however many repositories pass through. */
export function pruneAvatarCache(entries: AvatarCacheFile, now: number, max = CACHE_MAX_ENTRIES): AvatarCacheFile {
  const live = Object.entries(entries).filter(([, e]) => isAvatarEntryFresh(e, now))
  live.sort((a, b) => b[1].at - a[1].at)
  return Object.fromEntries(live.slice(0, max))
}

/** How long to stay away after a refusal, or null when the response is not one. Per the rate-limit docs. */
export function avatarBackoffMs(res: Pick<Response, 'status' | 'headers'>, now: number): number | null {
  if (res.status === 401) return AVATAR_FORBIDDEN_PAUSE_MS
  if (res.status !== 403 && res.status !== 429) return null
  const remaining = res.headers.get('x-ratelimit-remaining')
  const reset = Number(res.headers.get('x-ratelimit-reset'))
  if (remaining === '0' && Number.isFinite(reset) && reset > 0) return Math.max(1000, reset * 1000 - now)
  const retryAfter = Number(res.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000
  return res.status === 429 ? AVATAR_SECONDARY_PAUSE_MS : AVATAR_FORBIDDEN_PAUSE_MS
}

const SHA = /^[0-9a-f]{7,64}$/i
const EMAIL = /^[^\s@]+@[^\s@]+$/

/** The token for the target's own server, or null when the profile has none there. Asked only on a cache miss. */
export type TokenFor = (target: AvatarTarget) => Promise<string | null>

export interface GithubAvatarResolver {
  /**
   * Avatar URLs by lowercased email. An email absent from the result is
   * *unknown* — no token, a pause, a network failure — and may be asked again;
   * `null` is a confirmed miss.
   */
  resolve(
    target: AvatarTarget,
    items: AvatarRequest[],
    size: number,
    tokenFor: TokenFor
  ): Promise<Record<string, string | null>>
  /** Until when a server is left alone, for tests and diagnostics. */
  pausedUntil(base: string): number
}

export function createGithubAvatarResolver(deps: AvatarResolverDeps): GithubAvatarResolver {
  const now = deps.now ?? Date.now
  const limit = Math.max(1, deps.concurrency ?? 4)
  const memory = new Map<string, AvatarCacheEntry>()
  const inflight = new Map<string, Promise<string | null | undefined>>()
  const paused = new Map<string, number>()
  let disk: Promise<AvatarCacheFile> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const loadDisk = (): Promise<AvatarCacheFile> =>
    (disk ??= (deps.load ? deps.load().catch(() => ({})) : Promise.resolve({})).then((f) => {
      for (const [k, e] of Object.entries(f)) {
        if (isAvatarEntryFresh(e, now())) memory.set(k, e)
      }
      return f
    }))

  // Coalesce writes: a graph resolves dozens of authors at once.
  const scheduleSave = (): void => {
    if (!deps.save || saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      deps.save!(pruneAvatarCache(Object.fromEntries(memory), now()))
    }, 500)
    saveTimer.unref?.()
  }

  const remember = (key: string, url: string | null): void => {
    memory.set(key, { url, at: now() })
    scheduleSave()
  }

  async function getJson(url: string, token: string, base: string): Promise<unknown> {
    const res = await deps.fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    const backoff = avatarBackoffMs(res, now())
    if (backoff !== null) {
      // Nothing cached: a refusal says nothing about the author.
      paused.set(base, now() + backoff)
      throw new Error('GitHub refused the avatar lookup')
    }
    // Not on the server (unpushed, or a fork's), or an empty repository.
    if (res.status === 404 || res.status === 422 || res.status === 409) return null
    if (!res.ok) throw new Error(`GitHub API error (${res.status})`)
    return res.json()
  }

  const avatarOf = (commit: unknown, webBase: string): string | null => {
    const author = (commit as { author?: { avatar_url?: unknown } } | null)?.author
    return author && isGithubAvatarUrl(author.avatar_url, webBase) ? author.avatar_url : null
  }

  async function lookUp(target: AvatarTarget, token: string, req: AvatarRequest): Promise<string | null> {
    const ep = githubEndpoints(target.base)
    const repoApi = `${ep.apiBase}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`
    if (req.sha && SHA.test(req.sha)) {
      const commit = await getJson(`${repoApi}/commits/${req.sha}`, token, target.base)
      // Found, with or without an account: that is the answer. Only a sha the
      // server does not have falls through to the search by email.
      if (commit) return avatarOf(commit, ep.webBase)
    }
    const list = await getJson(`${repoApi}/commits?author=${encodeURIComponent(req.email)}&per_page=1`, token, target.base)
    return Array.isArray(list) && list.length ? avatarOf(list[0], ep.webBase) : null
  }

  async function resolve(
    target: AvatarTarget,
    items: AvatarRequest[],
    size: number,
    tokenFor: TokenFor
  ): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {}
    // One request per author, the first sha seen for each.
    const wanted = new Map<string, AvatarRequest>()
    for (const it of items.slice(0, MAX_BATCH)) {
      const email = typeof it?.email === 'string' ? it.email.trim().toLowerCase() : ''
      if (!EMAIL.test(email) || wanted.has(email)) continue
      wanted.set(email, { email, sha: typeof it.sha === 'string' ? it.sha : undefined })
    }
    if (!wanted.size) return out

    await loadDisk()
    const todo: AvatarRequest[] = []
    for (const req of wanted.values()) {
      // A github.com noreply address names its account: no API call. Only on a
      // github.com repository — a GHES is never told about github.com accounts.
      const direct = target.base === GITHUB_COM ? githubNoreplyAvatarUrl(req.email, size) : null
      if (direct) {
        out[req.email] = direct
        continue
      }
      const hit = memory.get(avatarCacheKey(target.base, req.email))
      if (isAvatarEntryFresh(hit, now())) out[req.email] = hit.url ? githubAvatarSized(hit.url, size) : null
      else todo.push(req)
    }
    if (!todo.length || (paused.get(target.base) ?? 0) > now()) return out

    // No token, no API: an anonymous client gets 60 requests an hour, which a
    // single graph would spend in a scroll.
    const token = await tokenFor(target).catch(() => null)
    if (!token) return out

    let next = 0
    const worker = async (): Promise<void> => {
      while (next < todo.length) {
        const req = todo[next++]
        if ((paused.get(target.base) ?? 0) > now()) return
        const key = avatarCacheKey(target.base, req.email)
        let job = inflight.get(key)
        if (!job) {
          job = lookUp(target, token, req)
            .then((url) => {
              remember(key, url)
              return url
            })
            .catch(() => undefined)
            .finally(() => inflight.delete(key))
          inflight.set(key, job)
        }
        const url = await job
        if (url !== undefined) out[req.email] = url ? githubAvatarSized(url, size) : null
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, todo.length) }, worker))
    return out
  }

  return { resolve, pausedUntil: (base) => paused.get(base) ?? 0 }
}
