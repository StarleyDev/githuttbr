import { HttpStatusError } from './httpStatusError'
import { encodePathSegments, isLfsPointer, PR_IMAGE_MAX_BYTES, type PrImageContent } from '../shared/prImage'

// One file of a pull request at one commit, straight from the host — for the
// Files tab's image preview when this clone lacks the commit. Each host's raw
// file endpoint, the size cap, and a data URL out. The token stays in main:
// only the bytes, labelled with the image's own MIME type, cross to the renderer.

/** Each host's raw file URL at a commit. The path is percent-encoded per segment
 *  (GitLab: whole, slashes included, as its API requires). */
export const hostFileUrls = {
  /** GitHub / GHES: the contents API (`api` is the repository's REST root). */
  githubContents: (api: string, path: string, sha: string): string =>
    `${api}/contents/${encodePathSegments(path)}?ref=${sha}`,
  /** GitHub / GHES: one blob by its own id — files past the contents API's 1 MB. */
  githubBlob: (api: string, blobSha: string): string => `${api}/git/blobs/${blobSha}`,
  /** GitLab: `projectApi` is `/api/v4/projects/:id`. `lfs=true` serves an LFS object, not its pointer. */
  gitlabRaw: (projectApi: string, path: string, sha: string): string =>
    `${projectApi}/repository/files/${encodeURIComponent(path)}/raw?ref=${sha}&lfs=true`,
  /** Azure DevOps: Items - Get, by commit; `resolveLfs` for an LFS pointer. */
  azureItem: (repoApi: string, path: string, sha: string): string =>
    `${repoApi}/items?path=${encodeURIComponent(`/${path}`)}&versionDescriptor.version=${sha}` +
    '&versionDescriptor.versionType=commit&resolveLfs=true&api-version=7.1',
  /** Forgejo: `/media/` serves the LFS object when the file is one, the blob otherwise. */
  forgejoMedia: (repoApi: string, path: string, sha: string): string =>
    `${repoApi}/media/${encodePathSegments(path)}?ref=${sha}`,
  /** Bitbucket Data Center: the raw content at a commit (`repoApi` ends in `/repos/<slug>`). */
  bitbucketServerRaw: (repoApi: string, path: string, sha: string): string =>
    `${repoApi}/raw/${encodePathSegments(path)}?at=${sha}`
}

/**
 * A response body, read until it passes `cap` bytes and no further — a
 * Content-Length over the cap is refused before a byte is read, and a server
 * that sends none (or lies) is cut off as soon as the count passes it.
 */
export async function readCappedBody(
  res: Response,
  cap: number
): Promise<{ bytes: Buffer } | { tooLarge: number }> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > cap) {
    await res.body?.cancel().catch(() => undefined)
    return { tooLarge: declared }
  }
  if (!res.body) return { bytes: Buffer.alloc(0) }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > cap) {
      await reader.cancel().catch(() => undefined)
      return { tooLarge: total }
    }
    chunks.push(value)
  }
  return { bytes: Buffer.concat(chunks) }
}

/** Bytes as the data URL the image preview draws — the same shape the commit view sends. */
export function toDataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`
}

/** A redirect's target, when it may be followed once without credentials: https only. */
export function getRedirectTarget(res: Response, from: string): string | null {
  if (res.status < 300 || res.status > 399) return null
  const location = res.headers.get('location')
  if (!location) return null
  try {
    const target = new URL(location, from)
    return target.protocol === 'https:' ? target.href : null
  } catch {
    return null
  }
}

/**
 * GET with the credential on the first request only. An LFS object (GitLab's
 * `lfs=true`, Forgejo's `/media/`) is often served from object storage behind
 * a redirect: that one hop is followed, to https only, and without any
 * credential header — the storage URL is presigned, and the token was
 * issued for the host, not for whoever it redirects to.
 */
export async function fetchFollowingOnce(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, redirect: 'manual' })
  const target = getRedirectTarget(res, url)
  if (!target) return res
  await res.body?.cancel().catch(() => undefined)
  // Every header but Accept stays behind: Authorization, GitLab's PRIVATE-TOKEN, any other credential.
  const accept = ((init.headers ?? {}) as Record<string, string>).Accept
  return fetch(target, { headers: accept ? { Accept: accept } : {}, redirect: 'error' })
}

/**
 * GET one file's bytes. 404 is "no such file at that commit" — missing, not an
 * error. Any other refusal throws with its status. An HTML answer to a raw
 * request is a sign-in page (Azure answers a bad credential with 203 and one),
 * never an image, so it is refused as a credential problem. A Git LFS pointer
 * — a host that did not resolve LFS — is "lfs", not a broken picture.
 */
export async function fetchFileBytes(
  url: string,
  init: RequestInit,
  mime: string,
  host: string,
  cap = PR_IMAGE_MAX_BYTES
): Promise<PrImageContent> {
  // `redirect: 'manual'` asks for the one credential-less hop; anything else is fetch's own.
  const res = init.redirect === 'manual' ? await fetchFollowingOnce(url, init) : await fetch(url, init)
  if (res.status === 404) {
    await res.body?.cancel().catch(() => undefined)
    return { status: 'missing' }
  }
  if (!res.ok || res.status === 203 || (res.headers.get('content-type') ?? '').includes('text/html')) {
    await res.body?.cancel().catch(() => undefined)
    const status = res.ok ? 401 : res.status
    throw new HttpStatusError(`${host} refused the file (${status}).`, status)
  }
  const body = await readCappedBody(res, cap)
  if ('tooLarge' in body) return { status: 'tooLarge', size: body.tooLarge }
  if (isLfsPointer(body.bytes)) return { status: 'lfs' }
  return { status: 'ok', dataUrl: toDataUrl(mime, body.bytes) }
}

/** What GitHub's contents API answers with the object media type. */
interface GhContentObject {
  type?: string
  size?: number
  sha?: string
  content?: string
  encoding?: string
}

/**
 * One file from GitHub or GHES at a commit. The contents API (object media
 * type) first: it names the size and the blob id before any bytes move, and
 * carries files up to 1 MB inline as base64. A larger file comes back with
 * `encoding: "none"` and no content; its bytes then come from the git blobs
 * API by that id, as raw (which serves blobs up to 100 MB).
 */
export async function fetchGithubFile(
  api: string,
  token: string,
  path: string,
  sha: string,
  mime: string,
  cap = PR_IMAGE_MAX_BYTES
): Promise<PrImageContent> {
  const auth = { Authorization: `Bearer ${token}` }
  // The API itself may redirect (a renamed repository) — to the same API host,
  // and fetch drops the credential on any cross-origin hop.
  const res = await fetch(hostFileUrls.githubContents(api, path, sha), {
    headers: { ...auth, Accept: 'application/vnd.github.object+json' },
    redirect: 'follow'
  })
  if (res.status === 404) {
    await res.body?.cancel().catch(() => undefined)
    return { status: 'missing' }
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined)
    throw new HttpStatusError(`GitHub refused the file (${res.status}).`, res.status)
  }
  const obj = (await res.json().catch(() => null)) as GhContentObject | null
  if (!obj || obj.type !== 'file') return { status: 'missing' }
  if (typeof obj.size === 'number' && obj.size > cap) return { status: 'tooLarge', size: obj.size }
  if (obj.encoding === 'base64' && typeof obj.content === 'string' && obj.content) {
    const bytes = Buffer.from(obj.content.replace(/\s+/g, ''), 'base64')
    // GitHub's API serves an LFS file's pointer, not the object: say so, rather
    // than draw a broken image. Its media host wants another credential dance.
    if (isLfsPointer(bytes)) return { status: 'lfs' }
    return { status: 'ok', dataUrl: toDataUrl(mime, bytes) }
  }
  // An empty file has no content to inline either — nothing to fetch for it.
  if (obj.size === 0) return { status: 'ok', dataUrl: toDataUrl(mime, Buffer.alloc(0)) }
  if (!obj.sha || !/^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(obj.sha)) return { status: 'missing' }
  return fetchFileBytes(
    hostFileUrls.githubBlob(api, obj.sha),
    { headers: { ...auth, Accept: 'application/vnd.github.raw+json' }, redirect: 'manual' },
    mime,
    'GitHub',
    cap
  )
}
