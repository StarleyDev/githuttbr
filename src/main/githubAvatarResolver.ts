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

/**
 * `url` null is a confirmed miss: a 200 showed a commit by that email whose
 * author is no account on that server. Nothing short of that is ever written as
 * one — a 404 may be a private repository the token cannot see, and an empty
 * list by that email only says the author has no commit in *that* repository.
 */
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
  /** This install's secret salt for the cache keys (see avatarCacheKey); none in tests that do not care. */
  salt?: () => Promise<string>
  concurrency?: number
}

export const AVATAR_HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const AVATAR_MISS_TTL_MS = 24 * 60 * 60 * 1000
/** A refusal that is not a rate limit (SSO not authorised, no access): ask again later, not per author. */
const AVATAR_FORBIDDEN_PAUSE_MS = 10 * 60 * 1000
/** A 404 for the repository itself — private and out of the token's reach, or gone — or a 409, empty. */
export const AVATAR_HIDDEN_REPO_PAUSE_MS = 10 * 60 * 1000
/**
 * "No commit by this email in this repository yet" — true only until the next
 * push, so it holds the lookup back briefly and is never handed out as a miss.
 */
export const AVATAR_REPO_MISS_TTL_MS = 10 * 60 * 1000
/** Secondary limits without a retry-after: the docs say at least a minute. */
const AVATAR_SECONDARY_PAUSE_MS = 60 * 1000
const CACHE_MAX_ENTRIES = 5000
const MAX_BATCH = 200

/**
 * The cache key: a hash of the server and the lowercased email. The persistent
 * cache lives on disk next to the settings, and a list of every author's
 * address is not something to leave lying in a file.
 *
 * Salted per install: an unsalted hash of an address is the address to anyone
 * holding a list of candidates (a company directory), who could then tell
 * which colleagues' commits this machine has been looking at.
 *
 * The key hides the email, not the account: a hit's value is the picture's
 * URL, and GitHub's (`avatars.githubusercontent.com/u/<id>`) carries the
 * account's numeric id — public, and one API call from its login. So the file
 * still says which GitHub accounts were looked up, just not by which address.
 * The URL is what draws the picture offline; storing less would mean asking
 * again. The file is owner-only (writePrivateFile), and the handbook says so
 * (docs/help/avatars.md).
 */
export function avatarCacheKey(base: string, email: string, salt = ''): string {
  const subject = `${base.toLowerCase()}\n${email.trim().toLowerCase()}`
  return createHash('sha256').update(salt ? `${salt}\n${subject}` : subject).digest('hex')
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
  /** Until when one repository is left alone after a 404, for tests and diagnostics. */
  hiddenUntil(target: AvatarTarget): number
}

export function createGithubAvatarResolver(deps: AvatarResolverDeps): GithubAvatarResolver {
  const now = deps.now ?? Date.now
  const limit = Math.max(1, deps.concurrency ?? 4)
  const memory = new Map<string, AvatarCacheEntry>()
  const inflight = new Map<string, Promise<string | null | undefined>>()
  const paused = new Map<string, number>()
  const hidden = new Map<string, number>()
  /**
   * "No commit by this email in this repository", by repository and author.
   * Memory only, for AVATAR_REPO_MISS_TTL_MS, and answered as unknown rather
   * than as a miss: the author's next push changes it, and the same author may
   * have commits — and a linked account — in the next repository.
   */
  const repoMisses = new Map<string, number>()
  let disk: Promise<AvatarCacheFile> | null = null
  let salt = ''
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  // The salt comes with the file: every key is computed after both are in.
  const loadDisk = (): Promise<AvatarCacheFile> =>
    (disk ??= Promise.all([
      deps.load ? deps.load().catch(() => ({})) : Promise.resolve({}),
      deps.salt ? deps.salt().catch(() => '') : Promise.resolve('')
    ]).then(([f, s]) => {
      salt = s
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
      // The per-repository misses live in memory only: pruned on the same beat.
      for (const [k, at] of repoMisses) if (now() - at >= AVATAR_REPO_MISS_TTL_MS) repoMisses.delete(k)
      deps.save!(pruneAvatarCache(Object.fromEntries(memory), now()))
    }, 500)
    saveTimer.unref?.()
  }

  const remember = (key: string, url: string | null): void => {
    memory.set(key, { url, at: now() })
    scheduleSave()
  }

  /** Whether a per-repository miss still holds; an expired one is dropped as it is read. */
  const repoMissFresh = (k: string): boolean => {
    const at = repoMisses.get(k)
    if (at === undefined) return false
    if (now() - at < AVATAR_REPO_MISS_TTL_MS) return true
    repoMisses.delete(k)
    return false
  }

  const repoKey = (t: AvatarTarget): string => `${t.base.toLowerCase()}\n${t.owner.toLowerCase()}/${t.repo.toLowerCase()}`
  // A repository this token cannot see is left alone for a while — per
  // repository, since the same server's other repositories may be fine.
  const hideRepo = (t: AvatarTarget): undefined => {
    hidden.set(repoKey(t), now() + AVATAR_HIDDEN_REPO_PAUSE_MS)
    return undefined
  }

  type Answer = { status: 'ok'; body: unknown } | { status: 'absent' } | { status: 'hidden' }

  /**
   * One API call, sorted by what it can prove. `hidden` is a 404: GitHub
   * answers that both for a repository that is not there and for a private one
   * the token cannot see (or whose SSO it is not authorised for) — so it says
   * nothing about any author. A 409 (the repository is empty) is the same for
   * our purpose: no author can be found there until something is pushed, so
   * asking again per author every couple of minutes only spends quota.
   * `absent` is a sha the server does not have (422). A refusal throws, after
   * pausing the server.
   */
  async function getJson(url: string, token: string, base: string): Promise<Answer> {
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
    if (res.status === 404 || res.status === 409) return { status: 'hidden' }
    if (res.status === 422) return { status: 'absent' }
    if (!res.ok) throw new Error(`GitHub API error (${res.status})`)
    return { status: 'ok', body: await res.json() }
  }

  const avatarOf = (commit: unknown, webBase: string): string | null => {
    const author = (commit as { author?: { avatar_url?: unknown } } | null)?.author
    return author && isGithubAvatarUrl(author.avatar_url, webBase) ? author.avatar_url : null
  }

  /** A lookup's answer; `repoOnly` when it holds for this repository alone. */
  type Found = { url: string | null; repoOnly?: true }

  /**
   * The picture, `null` for a miss a 200 proved, `undefined` for unknown —
   * which is never written to any cache. A commit whose author is no account
   * proves it server-wide; an empty list by that email only for this
   * repository.
   */
  async function lookUp(target: AvatarTarget, token: string, req: AvatarRequest): Promise<Found | undefined> {
    const ep = githubEndpoints(target.base)
    const repoApi = `${ep.apiBase}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`
    if (req.sha && SHA.test(req.sha)) {
      const commit = await getJson(`${repoApi}/commits/${req.sha}`, token, target.base)
      // Found, with or without an account: that is the answer. Only a sha the
      // server does not have falls through to the search by email.
      if (commit.status === 'ok') return { url: avatarOf(commit.body, ep.webBase) }
      if (commit.status === 'hidden') return hideRepo(target)
    }
    const byEmail = `${repoApi}/commits?author=${encodeURIComponent(req.email)}&per_page=1`
    const list = await getJson(byEmail, token, target.base)
    if (list.status === 'hidden') return hideRepo(target)
    if (list.status !== 'ok' || !Array.isArray(list.body)) return undefined
    return list.body.length ? { url: avatarOf(list.body[0], ep.webBase) } : { url: null, repoOnly: true }
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
      const key = avatarCacheKey(target.base, req.email, salt)
      const hit = memory.get(key)
      if (isAvatarEntryFresh(hit, now())) out[req.email] = hit.url ? githubAvatarSized(hit.url, size) : null
      else if (!repoMissFresh(`${repoKey(target)}\n${key}`)) todo.push(req)
    }
    if (!todo.length || (paused.get(target.base) ?? 0) > now() || (hidden.get(repoKey(target)) ?? 0) > now()) return out

    // No token, no API: an anonymous client gets 60 requests an hour, which a
    // single graph would spend in a scroll.
    const token = await tokenFor(target).catch(() => null)
    if (!token) return out

    let next = 0
    const worker = async (): Promise<void> => {
      while (next < todo.length) {
        const req = todo[next++]
        if ((paused.get(target.base) ?? 0) > now() || (hidden.get(repoKey(target)) ?? 0) > now()) return
        const key = avatarCacheKey(target.base, req.email, salt)
        // In flight per repository: one repository's "cannot see it" is not another's answer.
        const flight = `${repoKey(target)}\n${key}`
        let job = inflight.get(flight)
        if (!job) {
          job = lookUp(target, token, req)
            .then((found) => {
              if (!found) return undefined
              if (found.repoOnly) {
                repoMisses.set(flight, now())
                return undefined
              }
              remember(key, found.url)
              return found.url
            })
            .catch(() => undefined)
            .finally(() => inflight.delete(flight))
          inflight.set(flight, job)
        }
        const url = await job
        if (url !== undefined) out[req.email] = url ? githubAvatarSized(url, size) : null
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, todo.length) }, worker))
    return out
  }

  return { resolve, pausedUntil: (base) => paused.get(base) ?? 0, hiddenUntil: (t) => hidden.get(repoKey(t)) ?? 0 }
}
