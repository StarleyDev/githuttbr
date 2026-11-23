import { createHash } from 'node:crypto'
import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { apiToken } from './credentials'
import { peekActiveProfileAuth, peekBoundProfileAuth, type PeekedAuth } from './settings'
import { knownGithubEnterpriseInstances } from './gitlabInstances'
import { pickHostAuth } from '../shared/hostToken'
import { GITHUB_COM, githubEndpoints, githubInstanceOf } from '../shared/githubEnterprise'
import { githubAvatarSized, isGithubAvatarUrl } from '../shared/githubAvatar'
import {
  createGithubAvatarResolver,
  type AvatarCacheFile,
  type AvatarRequest,
  type AvatarTarget
} from './githubAvatarResolver'

/**
 * GitHub profile pictures for commit authors and for the active profile — the
 * Electron side of githubAvatarResolver.ts: IPC, the cache file, and which
 * token a request may carry.
 *
 * Tokens follow the rules every other hosting call follows (`profileAuth` in
 * hosting.ts): the profile a repository is bound to, else the active one; and
 * for GitHub, only the token filed for the remote's own server. They are
 * resolved here and never come from the renderer.
 *
 * And they are only *peeked*: a picture is drawn at start-up, on the Welcome
 * screen, before the user has done anything — so it must never be the thing
 * that brings up the keychain consent dialog or the OS keychain prompt. While
 * the stored tokens are still encrypted the answer is "unknown", not "none" —
 * even for a profile signed in through a machine login, since a stored PAT
 * would outrank it — and the renderer asks again once something the user did
 * has unlocked them. With no encrypted store to wait for, the plain settings
 * (machine-login links, session-only tokens) answer at once.
 */

const cachePath = (): string => join(app.getPath('userData'), 'github-avatars.json')

async function loadCache(): Promise<AvatarCacheFile> {
  const raw = await readFile(cachePath(), 'utf8').catch(() => null)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as { v?: number; entries?: unknown }
    if (parsed.v !== 1 || !parsed.entries || typeof parsed.entries !== 'object') return {}
    const out: AvatarCacheFile = {}
    for (const [k, e] of Object.entries(parsed.entries as Record<string, { url?: unknown; at?: unknown }>)) {
      if (!/^[0-9a-f]{64}$/.test(k) || typeof e?.at !== 'number') continue
      if (e.url !== null && typeof e.url !== 'string') continue
      out[k] = { url: e.url, at: e.at }
    }
    return out
  } catch {
    return {}
  }
}

function saveCache(entries: AvatarCacheFile): void {
  const file = cachePath()
  const tmp = `${file}.tmp`
  void mkdir(app.getPath('userData'), { recursive: true })
    .then(() => writeFile(tmp, JSON.stringify({ v: 1, entries })))
    .then(() => rename(tmp, file))
    .catch(() => undefined)
}

/**
 * The token for a repository's GitHub remote, or null — with the store locked
 * too, which the resolver answers as unknown and caches nothing for. Never
 * interactive: a picture is not worth a sign-in window.
 */
async function tokenForRemote(remoteUrl: string, repoPath: string | undefined): Promise<string | null> {
  const bound = repoPath ? await peekBoundProfileAuth('github', repoPath, remoteUrl) : undefined
  if (bound?.locked) return null
  let locked = false
  const input = await pickHostAuth({
    bound,
    active: async () => {
      const auth = await peekActiveProfileAuth('github', remoteUrl)
      locked = !!auth.locked
      return auth
    }
  })
  // A PAT outranks the link, so a locked one must not be stood in for by the link's account.
  if (locked) return null
  return (await apiToken(remoteUrl, input))?.token ?? null
}

const resolver = createGithubAvatarResolver({
  fetch: (url, init) => fetch(url, init),
  load: loadCache,
  save: saveCache
})

/** Requests off the IPC boundary, shaped or dropped. */
function asRequests(value: unknown): AvatarRequest[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v) => {
    const r = v as { email?: unknown; sha?: unknown } | null
    return typeof r?.email === 'string' ? [{ email: r.email, sha: typeof r.sha === 'string' ? r.sha : undefined }] : []
  })
}

/**
 * Pictures for a batch of authors of one repository. `remoteUrl` decides the
 * server, and so the token; one that is no GitHub the app knows gets nothing.
 */
export async function githubAvatarsFor(
  remoteUrl: string,
  repoPath: string | undefined,
  items: AvatarRequest[],
  size: number
): Promise<Record<string, string | null>> {
  const inst = githubInstanceOf(remoteUrl, knownGithubEnterpriseInstances())
  if (!inst) return {}
  const target: AvatarTarget = { base: inst.base, owner: inst.owner, repo: inst.repo }
  return resolver.resolve(target, items, size, () => tokenForRemote(remoteUrl, repoPath))
}

/**
 * The active profile's own GitHub picture: github.com first, then each
 * Enterprise Server the profile holds a token for. One `GET /user` per token
 * per session — the token's hash keys it, so connecting another account shows
 * the new picture without a restart.
 */
const profileCache = new Map<string, Promise<string | null>>()
export async function activeProfileGithubAvatar(size: number): Promise<string | null> {
  for (const base of [GITHUB_COM, ...knownGithubEnterpriseInstances()]) {
    const input = await peekActiveProfileAuth('github', undefined, base).catch((): PeekedAuth => ({}))
    // Still encrypted: no picture for now, and nothing remembered — asked again
    // once unlocked. Stop rather than move on: a later server's account is not
    // this one's, and the title bar would keep the wrong picture.
    if (input.locked) return null
    const auth = await apiToken(base, input).catch(() => null)
    if (!auth?.token) continue
    const key = createHash('sha256').update(`${base}\n${auth.token}`).digest('hex')
    let job = profileCache.get(key)
    if (!job) {
      const ep = githubEndpoints(base)
      job = fetch(`${ep.apiBase}/user`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${auth.token}` }
      })
        .then(async (res) => {
          if (!res.ok) return null
          const user = (await res.json()) as { avatar_url?: unknown }
          return isGithubAvatarUrl(user.avatar_url, ep.webBase) ? user.avatar_url : null
        })
        .catch(() => null)
      profileCache.set(key, job)
      // A failure is retried next session, not cached as "no picture" forever.
      void job.then((url) => {
        if (!url) profileCache.delete(key)
      })
    }
    const url = await job
    if (url) return githubAvatarSized(url, size)
  }
  return null
}

const asSize = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(460, Math.max(8, v)) : 64)

export function registerAvatarHandlers(): void {
  ipcMain.handle('avatars:github', (_e, remoteUrl: unknown, repoPath: unknown, items: unknown, size: unknown) =>
    typeof remoteUrl === 'string' && remoteUrl
      ? githubAvatarsFor(remoteUrl, typeof repoPath === 'string' && repoPath ? repoPath : undefined, asRequests(items), asSize(size))
      : {}
  )
  ipcMain.handle('avatars:profileGithub', (_e, size: unknown) => activeProfileGithubAvatar(asSize(size)))
}
