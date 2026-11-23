import { describe, it, expect, vi } from 'vitest'
import {
  githubAvatarSized,
  githubNoreplyAvatarUrl,
  isGithubAvatarUrl,
  parseGithubNoreply
} from '../src/shared/githubAvatar'
import {
  AVATAR_HIT_TTL_MS,
  AVATAR_MISS_TTL_MS,
  AVATAR_REPO_MISS_TTL_MS,
  avatarBackoffMs,
  avatarCacheKey,
  createGithubAvatarResolver,
  pruneAvatarCache,
  type AvatarCacheFile,
  type AvatarTarget
} from '../src/main/githubAvatarResolver'
import { GITHUB_COM } from '../src/shared/githubEnterprise'
import { avatarSources, githubAccountFingerprint } from '../src/renderer/src/lib/avatar'
import { AVATAR_UNKNOWN_RETRY_MS, createAvatarBatcher, type AvatarBatchItem } from '../src/renderer/src/lib/avatarBatch'

describe('github noreply addresses', () => {
  it('maps the ID+login form straight to the avatar CDN', () => {
    expect(parseGithubNoreply('12345+Octo-Cat@users.noreply.github.com')).toEqual({ id: 12345, login: 'octo-cat' })
    expect(githubNoreplyAvatarUrl('12345+octocat@users.noreply.github.com', 40)).toBe(
      'https://avatars.githubusercontent.com/u/12345?s=40'
    )
  })

  it('maps the old login-only form through github.com/<login>.png', () => {
    expect(parseGithubNoreply(' OctoCat@Users.Noreply.GitHub.com ')).toEqual({ login: 'octocat' })
    expect(githubNoreplyAvatarUrl('octocat@users.noreply.github.com', 32)).toBe('https://github.com/octocat.png?size=32')
  })

  it('never guesses for an Enterprise Server or a look-alike domain', () => {
    expect(parseGithubNoreply('1+me@users.noreply.ghe.example.com')).toBeNull()
    expect(parseGithubNoreply('1+me@noreply.github.com')).toBeNull()
    expect(parseGithubNoreply('1+me@users.noreply.github.com.evil.test')).toBeNull()
    expect(parseGithubNoreply('me@gmail.com')).toBeNull()
  })

  it('refuses garbage', () => {
    for (const bad of ['', '@users.noreply.github.com', '0+me@users.noreply.github.com', 'x+me@users.noreply.github.com',
      '12+@users.noreply.github.com', '12+-me@users.noreply.github.com', 'a/b@users.noreply.github.com',
      '12+me+you@users.noreply.github.com', `${'a'.repeat(40)}@users.noreply.github.com`, '99999999999999999+me@users.noreply.github.com']) {
      expect(parseGithubNoreply(bad), bad).toBeNull()
    }
    expect(parseGithubNoreply(undefined)).toBeNull()
  })

  it('accepts avatar URLs only from the GitHub that answered', () => {
    expect(isGithubAvatarUrl('https://avatars.githubusercontent.com/u/1?v=4', GITHUB_COM)).toBe(true)
    expect(isGithubAvatarUrl('https://evil.test/u/1', GITHUB_COM)).toBe(false)
    expect(isGithubAvatarUrl('http://avatars.githubusercontent.com/u/1', GITHUB_COM)).toBe(false)
    expect(isGithubAvatarUrl('https://ghe.corp/avatars/u/1', 'https://ghe.corp')).toBe(true)
    expect(isGithubAvatarUrl('https://avatars.ghe.corp/u/1', 'https://ghe.corp')).toBe(true)
    expect(isGithubAvatarUrl('https://avatars.githubusercontent.com/u/1', 'https://ghe.corp')).toBe(false)
    expect(isGithubAvatarUrl('https://user:pw@ghe.corp/avatars/u/1', 'https://ghe.corp')).toBe(false)
  })

  it('asks for a size and keeps the version GitHub put there', () => {
    expect(githubAvatarSized('https://avatars.githubusercontent.com/u/1?v=4', 48)).toBe(
      'https://avatars.githubusercontent.com/u/1?v=4&s=48'
    )
  })
})

const GH: AvatarTarget = { base: GITHUB_COM, owner: 'acme', repo: 'app' }
const GHES: AvatarTarget = { base: 'https://ghe.corp', owner: 'acme', repo: 'app' }

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

const commitBy = (avatar: string | null): unknown => ({ sha: 'abc', author: avatar ? { login: 'x', id: 1, avatar_url: avatar } : {} })

describe('github avatar resolver', () => {
  it('never calls the API without a token, and caches nothing for it', async () => {
    const fetch = vi.fn()
    const r = createGithubAvatarResolver({ fetch })
    const out = await r.resolve(GH, [{ email: 'a@x.test', sha: 'abcdef1' }], 40, async () => null)
    expect(out).toEqual({})
    expect(fetch).not.toHaveBeenCalled()
  })

  it('answers noreply addresses on github.com without any request or token', async () => {
    const fetch = vi.fn()
    const tokenFor = vi.fn(async () => 'tok')
    const r = createGithubAvatarResolver({ fetch })
    const out = await r.resolve(GH, [{ email: '7+me@users.noreply.github.com' }], 40, tokenFor)
    expect(out).toEqual({ '7+me@users.noreply.github.com': 'https://avatars.githubusercontent.com/u/7?s=40' })
    expect(fetch).not.toHaveBeenCalled()
    expect(tokenFor).not.toHaveBeenCalled()
  })

  it('dedupes by email and asks the commit endpoint once per author', async () => {
    const fetch = vi.fn(async (url: string) => {
      expect(url).toMatch(/^https:\/\/api\.github\.com\/repos\/acme\/app\/commits\/[0-9a-f]+$/)
      return json(commitBy('https://avatars.githubusercontent.com/u/9?v=4'))
    })
    const r = createGithubAvatarResolver({ fetch })
    const out = await r.resolve(
      GH,
      [
        { email: 'Dev@Example.com', sha: 'aaaaaaa' },
        { email: 'dev@example.com', sha: 'bbbbbbb' },
        { email: 'other@example.com', sha: 'ccccccc' }
      ],
      40,
      async () => 'tok'
    )
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toContain('/commits/aaaaaaa')
    expect(out['dev@example.com']).toBe('https://avatars.githubusercontent.com/u/9?v=4&s=40')
  })

  it('falls back to the list-by-email endpoint when the sha is not on the server', async () => {
    const urls: string[] = []
    const fetch = vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes('/commits/')) return json({ message: 'No commit found' }, 422)
      return json([commitBy('https://avatars.githubusercontent.com/u/3?v=4')])
    })
    const r = createGithubAvatarResolver({ fetch })
    const out = await r.resolve(GH, [{ email: 'me@gmail.com', sha: 'deadbee' }], 20, async () => 'tok')
    expect(urls[1]).toBe('https://api.github.com/repos/acme/app/commits?author=me%40gmail.com&per_page=1')
    expect(out['me@gmail.com']).toBe('https://avatars.githubusercontent.com/u/3?v=4&s=20')
  })

  it('records a commit whose email belongs to no account as a miss, without a second request', async () => {
    const fetch = vi.fn(async () => json(commitBy(null)))
    const r = createGithubAvatarResolver({ fetch })
    const out = await r.resolve(GH, [{ email: 'nobody@x.test', sha: 'abcdef1' }], 20, async () => 'tok')
    expect(out).toEqual({ 'nobody@x.test': null })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps each server to its own API and its own token', async () => {
    const seen: { url: string; auth: string }[] = []
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: (init?.headers as Record<string, string>).Authorization })
      const ghes = url.startsWith('https://ghe.corp/')
      return json(commitBy(ghes ? 'https://ghe.corp/avatars/u/5' : 'https://avatars.githubusercontent.com/u/5'))
    })
    const tokenFor = async (t: AvatarTarget): Promise<string> => (t.base === GITHUB_COM ? 'dotcom-token' : 'ghes-token')
    const r = createGithubAvatarResolver({ fetch })
    await r.resolve(GH, [{ email: 'a@x.test', sha: 'abcdef1' }], 20, tokenFor)
    const ghes = await r.resolve(GHES, [{ email: 'a@x.test', sha: 'abcdef1' }], 20, tokenFor)
    expect(seen).toEqual([
      { url: 'https://api.github.com/repos/acme/app/commits/abcdef1', auth: 'Bearer dotcom-token' },
      { url: 'https://ghe.corp/api/v3/repos/acme/app/commits/abcdef1', auth: 'Bearer ghes-token' }
    ])
    // Same email, different server: a separate cache entry, never the github.com answer.
    expect(ghes['a@x.test']).toBe('https://ghe.corp/avatars/u/5?s=20')
  })

  it('never sends a GHES repository’s noreply-looking authors to github.com', async () => {
    const fetch = vi.fn(async (url: string) => {
      expect(url.startsWith('https://ghe.corp/api/v3/')).toBe(true)
      return json(commitBy(null))
    })
    const r = createGithubAvatarResolver({ fetch })
    await r.resolve(GHES, [{ email: '7+me@users.noreply.github.com', sha: 'abcdef1' }], 20, async () => 'ghes-token')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('drops an avatar URL pointing anywhere but the answering GitHub', async () => {
    const fetch = vi.fn(async () => json(commitBy('https://tracker.evil.test/p.png')))
    const r = createGithubAvatarResolver({ fetch })
    const out = await r.resolve(GH, [{ email: 'a@x.test', sha: 'abcdef1' }], 20, async () => 'tok')
    expect(out).toEqual({ 'a@x.test': null })
  })

  it('stops on a primary rate limit until the reset, caching nothing for the refused authors', async () => {
    let clock = 1_000_000
    const reset = Math.floor(clock / 1000) + 120
    const fetch = vi.fn(async () =>
      json({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) })
    )
    const r = createGithubAvatarResolver({ fetch, now: () => clock, concurrency: 1 })
    const items = ['a', 'b', 'c'].map((n) => ({ email: `${n}@x.test`, sha: 'abcdef1' }))
    const out = await r.resolve(GH, items, 20, async () => 'tok')
    expect(out).toEqual({})
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(r.pausedUntil(GITHUB_COM)).toBe(reset * 1000)
    // Still paused: no request at all.
    await r.resolve(GH, items, 20, async () => 'tok')
    expect(fetch).toHaveBeenCalledTimes(1)
    // After the reset the same authors are asked again — nothing was cached as a miss.
    clock = reset * 1000 + 1
    fetch.mockImplementation(async () => json(commitBy(null)))
    await r.resolve(GH, items, 20, async () => 'tok')
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('reads the back-off from the response the way the rate-limit docs say', () => {
    const res = (status: number, h: Record<string, string> = {}): Response => new Response(null, { status, headers: h })
    expect(avatarBackoffMs(res(200), 0)).toBeNull()
    expect(avatarBackoffMs(res(404), 0)).toBeNull()
    expect(avatarBackoffMs(res(429, { 'retry-after': '30' }), 0)).toBe(30_000)
    expect(avatarBackoffMs(res(429), 0)).toBe(60_000)
    expect(avatarBackoffMs(res(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '100' }), 40_000)).toBe(60_000)
    // A plain 403 (SSO, no access) pauses too: it would repeat for every author.
    expect(avatarBackoffMs(res(403), 0)).toBeGreaterThan(0)
  })

  it('serves fresh cache entries from disk and refreshes stale ones, by TTL', async () => {
    const now = 10 * AVATAR_HIT_TTL_MS
    const disk: AvatarCacheFile = {
      [avatarCacheKey(GITHUB_COM, 'hit@x.test')]: { url: 'https://avatars.githubusercontent.com/u/1?v=4', at: now - AVATAR_HIT_TTL_MS + 1000 },
      [avatarCacheKey(GITHUB_COM, 'miss@x.test')]: { url: null, at: now - 1000 },
      [avatarCacheKey(GITHUB_COM, 'stale-miss@x.test')]: { url: null, at: now - AVATAR_MISS_TTL_MS - 1 }
    }
    const fetch = vi.fn(async () => json(commitBy('https://avatars.githubusercontent.com/u/2?v=4')))
    const r = createGithubAvatarResolver({ fetch, now: () => now, load: async () => disk })
    const out = await r.resolve(
      GH,
      ['hit', 'miss', 'stale-miss'].map((n) => ({ email: `${n}@x.test`, sha: 'abcdef1' })),
      20,
      async () => 'tok'
    )
    expect(out['hit@x.test']).toBe('https://avatars.githubusercontent.com/u/1?v=4&s=20')
    expect(out['miss@x.test']).toBeNull()
    expect(out['stale-miss@x.test']).toBe('https://avatars.githubusercontent.com/u/2?v=4&s=20')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keys the persistent cache by a hash — no email reaches the file', async () => {
    vi.useFakeTimers()
    try {
      let saved: AvatarCacheFile | null = null
      const fetch = vi.fn(async () => json(commitBy('https://avatars.githubusercontent.com/u/2?v=4')))
      const r = createGithubAvatarResolver({ fetch, save: (e) => (saved = e) })
      await r.resolve(GH, [{ email: 'secret.person@corp.test', sha: 'abcdef1' }], 20, async () => 'tok')
      await vi.advanceTimersByTimeAsync(1000)
      expect(saved).not.toBeNull()
      const text = JSON.stringify(saved)
      expect(text).not.toContain('secret.person')
      expect(Object.keys(saved!)).toEqual([avatarCacheKey(GITHUB_COM, 'secret.person@corp.test')])
    } finally {
      vi.useRealTimers()
    }
  })

  it('prunes expired entries and caps the file', () => {
    const now = AVATAR_HIT_TTL_MS * 3
    const entries: AvatarCacheFile = {
      old: { url: 'u', at: now - AVATAR_HIT_TTL_MS - 1 },
      a: { url: 'u', at: now - 3 },
      b: { url: null, at: now - 1 },
      c: { url: 'u', at: now - 2 }
    }
    expect(Object.keys(pruneAvatarCache(entries, now, 2))).toEqual(['b', 'c'])
  })

  it('caps concurrency', async () => {
    let active = 0
    let peak = 0
    const fetch = vi.fn(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return json(commitBy(null))
    })
    const r = createGithubAvatarResolver({ fetch, concurrency: 3 })
    const items = Array.from({ length: 12 }, (_, i) => ({ email: `p${i}@x.test`, sha: 'abcdef1' }))
    await r.resolve(GH, items, 20, async () => 'tok')
    expect(fetch).toHaveBeenCalledTimes(12)
    expect(peak).toBe(3)
  })

  it('treats a 404 on the commit as "cannot see this repository": nothing cached, the repository left alone', async () => {
    vi.useFakeTimers()
    try {
      let saved: AvatarCacheFile | null = null
      const urls: string[] = []
      const fetch = vi.fn(async (url: string) => {
        urls.push(url)
        if (url.includes('/acme/private/')) return json({ message: 'Not Found' }, 404)
        return json(commitBy('https://avatars.githubusercontent.com/u/5?v=4'))
      })
      const r = createGithubAvatarResolver({ fetch, save: (e) => (saved = e) })
      const PRIVATE: AvatarTarget = { ...GH, repo: 'private' }
      expect(await r.resolve(PRIVATE, [{ email: 'dev@corp.test', sha: 'abcdef1' }], 20, async () => 'tok')).toEqual({})
      // No list-by-email after it: that would only 404 too.
      expect(urls).toHaveLength(1)
      expect(r.hiddenUntil(PRIVATE)).toBeGreaterThan(Date.now())
      // The repository is not asked again for a while, for any author.
      expect(await r.resolve(PRIVATE, [{ email: 'other@corp.test', sha: 'abcdef1' }], 20, async () => 'tok')).toEqual({})
      expect(urls).toHaveLength(1)
      // The same author in a repository the token can see still gets a picture.
      const out = await r.resolve(GH, [{ email: 'dev@corp.test', sha: 'abcdef1' }], 20, async () => 'tok')
      expect(out['dev@corp.test']).toBe('https://avatars.githubusercontent.com/u/5?v=4&s=20')
      await vi.advanceTimersByTimeAsync(1000)
      // And the only thing on disk is that hit — the 404 wrote no miss.
      expect(saved).toEqual({ [avatarCacheKey(GITHUB_COM, 'dev@corp.test')]: expect.objectContaining({ url: expect.any(String) }) })
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats a 404 on the list-by-email the same way', async () => {
    const fetch = vi.fn(async () => json({ message: 'Not Found' }, 404))
    const r = createGithubAvatarResolver({ fetch })
    expect(await r.resolve(GH, [{ email: 'dev@corp.test' }], 20, async () => 'tok')).toEqual({})
    expect(r.hiddenUntil(GH)).toBeGreaterThan(0)
    // A later batch is not answered "none" from a cache it never wrote.
    expect(await r.resolve(GH, [{ email: 'dev@corp.test' }], 20, async () => 'tok')).toEqual({})
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('caches a server-wide miss only when a 200 proved it — a commit by that email with no account', async () => {
    const fetch = vi.fn(async () => json(commitBy(null)))
    const r = createGithubAvatarResolver({ fetch })
    expect(await r.resolve(GH, [{ email: 'ghost@x.test', sha: 'abcdef1' }], 20, async () => 'tok')).toEqual({ 'ghost@x.test': null })
    // Another repository on the same server: the account question is settled.
    expect(await r.resolve({ ...GH, repo: 'other' }, [{ email: 'ghost@x.test', sha: 'abcdef1' }], 20, async () => 'tok')).toEqual({ 'ghost@x.test': null })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('takes an empty list by that email as "not yet" for this repository only: unknown, held back, then asked again', async () => {
    vi.useFakeTimers()
    try {
      let saved: AvatarCacheFile | null = null
      let clock = 1_000_000
      let pushed = false
      const fetch = vi.fn(async (url: string) => {
        if (url.includes('/commits/')) return json({ message: 'No commit found' }, 422)
        return url.includes('/acme/app/') && !pushed ? json([]) : json([commitBy('https://avatars.githubusercontent.com/u/3?v=4')])
      })
      const r = createGithubAvatarResolver({ fetch, now: () => clock, save: (e) => (saved = e) })
      const ITEM = [{ email: 'dev@x.test', sha: 'abcdef1' }]
      // Unknown, not a miss: the renderer would keep a miss for the session.
      expect(await r.resolve(GH, ITEM, 20, async () => 'tok')).toEqual({})
      // Asked again in the same repository soon after: held back, no request.
      expect(await r.resolve(GH, ITEM, 20, async () => 'tok')).toEqual({})
      expect(fetch).toHaveBeenCalledTimes(2)
      // The same author's commits elsewhere on the server still find the account.
      const out = await r.resolve({ ...GH, repo: 'lib' }, ITEM, 20, async () => 'tok')
      expect(out['dev@x.test']).toBe('https://avatars.githubusercontent.com/u/3?v=4&s=20')
      await vi.advanceTimersByTimeAsync(1000)
      // Nothing server-wide was written as "no account".
      expect(Object.values(saved ?? {}).every((e) => e.url !== null)).toBe(true)

      // A fresh resolver (no server-wide hit cached): the hold-back expires and the push is seen.
      const r2 = createGithubAvatarResolver({ fetch, now: () => clock })
      const before = fetch.mock.calls.length
      expect(await r2.resolve(GH, ITEM, 20, async () => 'tok')).toEqual({})
      pushed = true
      clock += AVATAR_REPO_MISS_TTL_MS - 1
      expect(await r2.resolve(GH, ITEM, 20, async () => 'tok')).toEqual({})
      // Two calls for the first ask (commit, then list), none while held back.
      expect(fetch.mock.calls.length).toBe(before + 2)
      clock += 2
      expect(await r2.resolve(GH, ITEM, 20, async () => 'tok')).toEqual({
        'dev@x.test': 'https://avatars.githubusercontent.com/u/3?v=4&s=20'
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves an empty repository (409) alone for a while: unknown, no miss, no request per author', async () => {
    const fetch = vi.fn(async () => json({ message: 'Git Repository is empty.' }, 409))
    const r = createGithubAvatarResolver({ fetch })
    expect(await r.resolve(GH, [{ email: 'a@x.test', sha: 'abcdef1' }], 20, async () => 'tok')).toEqual({})
    expect(r.hiddenUntil(GH)).toBeGreaterThan(Date.now())
    expect(await r.resolve(GH, [{ email: 'b@x.test', sha: 'abcdef1' }], 20, async () => 'tok')).toEqual({})
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('treats a network failure as unknown, not as a miss', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    const r = createGithubAvatarResolver({ fetch })
    expect(await r.resolve(GH, [{ email: 'a@x.test', sha: 'abcdef1' }], 20, async () => 'tok')).toEqual({})
  })
})

describe('avatar source order', () => {
  const base = { email: 'me@gmail.com', lookups: true, github: true, githubLookup: true, noreply: false }
  it('tries Gravatar, then GitHub', () => {
    expect(avatarSources(base)).toEqual(['gravatar', 'github'])
  })
  it('skips GitHub when off or when there is nothing to ask', () => {
    expect(avatarSources({ ...base, github: false })).toEqual(['gravatar'])
    expect(avatarSources({ ...base, githubLookup: false })).toEqual(['gravatar'])
  })
  it('goes straight to GitHub for a noreply address, even with no repository', () => {
    expect(avatarSources({ ...base, noreply: true, githubLookup: false })).toEqual(['github'])
  })
  it('looks nothing up with Show avatars off', () => {
    expect(avatarSources({ ...base, lookups: false })).toEqual([])
    expect(avatarSources({ ...base, email: undefined })).toEqual([])
  })
})

describe('profile picture cache key', () => {
  const base = { githubToken: '', githubEnterprise: [], links: {} }

  it('changes when the account does — a new token, a GHES token, a different link', () => {
    const none = githubAccountFingerprint(base)
    const a = githubAccountFingerprint({ ...base, githubToken: 'tok-a' })
    const b = githubAccountFingerprint({ ...base, githubToken: 'tok-b' })
    const ghes = githubAccountFingerprint({ ...base, githubEnterprise: [{ url: 'https://ghe.corp', token: 't' }] })
    const gh = githubAccountFingerprint({ ...base, links: { github: { source: 'gh', login: 'octo' } } })
    const other = githubAccountFingerprint({ ...base, links: { github: { source: 'gh', login: 'other' } } })
    expect(new Set([none, a, b, ghes, gh, other]).size).toBe(6)
  })

  it('changes when locked tokens arrive on unlock, and stays put otherwise', () => {
    // Hydrated before unlock: the renderer holds no tokens yet.
    const locked = githubAccountFingerprint({ ...base, links: { github: { source: 'git', login: 'me' } } })
    const unlocked = githubAccountFingerprint({ ...base, githubToken: 'pat', links: { github: { source: 'git', login: 'me' } } })
    expect(unlocked).not.toBe(locked)
    expect(githubAccountFingerprint({ ...base, githubToken: ' pat ', links: { github: { source: 'git', login: 'me' } } })).toBe(unlocked)
  })

  it('never spells the token out', () => {
    expect(githubAccountFingerprint({ ...base, githubToken: 'ghp_supersecret' })).not.toContain('supersecret')
    expect(githubAccountFingerprint(undefined)).toBe('')
  })
})

describe('avatar batcher', () => {
  it('sends one batch per repository, deduped, and remembers answers but not unknowns', async () => {
    vi.useFakeTimers()
    try {
      const sent: AvatarBatchItem[][] = []
      let clock = 0
      const b = createAvatarBatcher(
        async (_scope, items) => {
          sent.push(items)
          return { 'a@x.test': 'https://avatars.githubusercontent.com/u/1', 'b@x.test': null }
        },
        50,
        () => clock
      )
      const scope = { remoteUrl: 'https://github.com/acme/app.git', repoPath: '/r', size: 32 }
      const p = [b.request(scope, 'A@x.test', 'aaaaaaa'), b.request(scope, 'a@x.test', 'bbbbbbb'), b.request(scope, 'b@x.test'), b.request(scope, 'c@x.test')]
      await vi.advanceTimersByTimeAsync(60)
      expect(await Promise.all(p)).toEqual(['https://avatars.githubusercontent.com/u/1', 'https://avatars.githubusercontent.com/u/1', null, null])
      expect(sent).toEqual([[{ email: 'a@x.test', sha: 'aaaaaaa' }, { email: 'b@x.test', sha: undefined }, { email: 'c@x.test', sha: undefined }]])
      // Known answers come from memory; the unknown one is held back for a while, then asked again.
      const again = [b.request(scope, 'a@x.test'), b.request(scope, 'b@x.test'), b.request(scope, 'c@x.test')]
      await vi.advanceTimersByTimeAsync(60)
      await Promise.all(again)
      expect(sent).toHaveLength(1)
      clock += AVATAR_UNKNOWN_RETRY_MS + 1
      const later = b.request(scope, 'c@x.test')
      await vi.advanceTimersByTimeAsync(60)
      await later
      expect(sent[1]).toEqual([{ email: 'c@x.test', sha: undefined }])
    } finally {
      vi.useRealTimers()
    }
  })

  it('asks a held-back "unknown" again at once after the tokens unlock', async () => {
    vi.useFakeTimers()
    try {
      let answer: Record<string, string | null> = {}
      const sent: AvatarBatchItem[][] = []
      const b = createAvatarBatcher(async (_scope, items) => {
        sent.push(items)
        return answer
      }, 50, () => 0)
      const scope = { remoteUrl: 'https://github.com/acme/app.git', repoPath: '/r', size: 32 }
      const first = b.request(scope, 'c@x.test')
      await vi.advanceTimersByTimeAsync(60)
      expect(await first).toBeNull()
      // Locked: held back, no second batch.
      void b.request(scope, 'c@x.test')
      await vi.advanceTimersByTimeAsync(60)
      expect(sent).toHaveLength(1)
      answer = { 'c@x.test': 'https://avatars.githubusercontent.com/u/3' }
      b.forgetUnknown()
      const again = b.request(scope, 'c@x.test')
      await vi.advanceTimersByTimeAsync(60)
      expect(await again).toBe('https://avatars.githubusercontent.com/u/3')
      expect(sent).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores an "unknown" that was in flight across an unlock, and tells the caller to ask again', async () => {
    vi.useFakeTimers()
    try {
      const sent: AvatarBatchItem[][] = []
      let release: (v: Record<string, string | null>) => void = () => undefined
      let answer: Record<string, string | null> | null = null
      const b = createAvatarBatcher((_scope, items) => {
        sent.push(items)
        return answer ? Promise.resolve(answer) : new Promise((r) => (release = r))
      }, 50, () => 0)
      const scope = { remoteUrl: 'https://github.com/acme/app.git', repoPath: '/r', size: 32 }
      const askedAt = b.generation()
      const first = b.request(scope, 'c@x.test')
      await vi.advanceTimersByTimeAsync(60)
      // The batch is in main, answered while the store was locked — and the unlock lands before it returns.
      b.forgetUnknown()
      release({})
      expect(await first).toBeNull()
      // The caller sees the generation moved, so its null is not the final word.
      expect(b.generation()).not.toBe(askedAt)
      // And the stale "unknown" was not held back: the retry reaches main now.
      answer = { 'c@x.test': 'https://avatars.githubusercontent.com/u/3' }
      const again = b.request(scope, 'c@x.test')
      await vi.advanceTimersByTimeAsync(60)
      expect(await again).toBe('https://avatars.githubusercontent.com/u/3')
      expect(sent).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
