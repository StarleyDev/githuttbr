import type { AccountLink, BitbucketServerHost, BitbucketServerTokenKind, Profile } from './types'

export type { BitbucketServerHost }

/**
 * Bitbucket Data Center (and Bitbucket Server, its end-of-life predecessor with
 * the same REST API). This module is the one place that knows where such a
 * server's API, web pages and clone URLs live, and the security boundary for
 * its tokens: a token is filed under its server's canonical base URL and only
 * ever handed out for that base.
 *
 * Unlike GitHub Enterprise Server, a Data Center may run under a context path
 * (`https://host/bitbucket`), so the base is `https://host[:port][/context]`
 * and every URL below is built on it:
 *
 *   REST          {base}/rest/api/latest/...   (same resources as /rest/api/1.0)
 *   build status  {base}/rest/build-status/latest/...
 *   web           {base}/projects/{KEY}/repos/{slug}
 *   https clone   {base}/scm/{key}/{slug}.git
 *   ssh clone     ssh://git@host:7999/{key}/{slug}.git   (no context path)
 *
 * Reference: developer.atlassian.com/server/bitbucket/rest/ (the 10.2 OpenAPI
 * document, `servers: http://{baseurl}/rest`).
 */

export const BITBUCKET_CLOUD = 'https://bitbucket.org'

/** bitbucket.org itself, or one of its subdomains (`api.bitbucket.org`). */
export function isBitbucketCloudHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'bitbucket.org' || h.endsWith('.bitbucket.org')
}

/** Why a typed-in server address was refused — each has its own message in Settings. */
export type BitbucketServerUrlProblem = 'invalid' | 'http' | 'path' | 'credentials' | 'cloud'

// A context path is a servlet context: plain segments, nothing that could walk
// out of it or smuggle a query in.
const SEGMENT = /^[A-Za-z0-9._~-]+$/
// Segments that only appear *below* the base. A pasted repository or REST URL
// would otherwise be taken as a context path, and every request would 404.
const BELOW_BASE = new Set(['rest', 'scm', 'projects', 'users', 'plugins', 'dashboard', 'login', 'browse'])

function parseTyped(raw: string): URL | null {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
  try {
    return new URL(hasScheme ? raw : `https://${raw}`)
  } catch {
    return null
  }
}

/**
 * Check a typed-in Data Center address. A bare host gets https. Refused:
 * - anything but https — the token would cross the network in clear text;
 * - a query or fragment, or a path that is not a plain context path
 *   (`/bitbucket` is fine; `/projects/X`, `/rest/api`, `..` are not);
 * - a user name or password — the token has its own field;
 * - bitbucket.org — Bitbucket Cloud is configured on its own, with another API.
 *
 * Private and internal addresses are allowed: that is where these servers live.
 */
export function bitbucketServerUrlProblem(raw: string | undefined): BitbucketServerUrlProblem | null {
  const s = raw?.trim()
  if (!s) return 'invalid'
  const u = parseTyped(s)
  if (!u) return 'invalid'
  if (u.protocol !== 'https:') return u.protocol === 'http:' ? 'http' : 'invalid'
  if (!u.hostname) return 'invalid'
  if (u.username || u.password) return 'credentials'
  if (u.search || u.hash || s.includes('?') || s.includes('#')) return 'path'
  const segments = u.pathname.split('/').filter(Boolean)
  // `new URL` resolves `..` away; the raw text still says it was there.
  if (/(^|\/)\.\.?(\/|$)/.test(s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''))) return 'path'
  for (const seg of segments) {
    if (!SEGMENT.test(seg) || seg === '.' || seg === '..') return 'path'
    if (BELOW_BASE.has(seg.toLowerCase())) return 'path'
  }
  if (isBitbucketCloudHost(u.hostname)) return 'cloud'
  return null
}

/**
 * A Data Center address in canonical form — `https://host[:port][/context]`,
 * host in lower case, the context path as typed (servlet paths are
 * case-sensitive) without a trailing slash — or null when it is refused.
 */
export function normalizeBitbucketServerUrl(raw: string | undefined): string | null {
  if (bitbucketServerUrlProblem(raw)) return null
  const u = parseTyped(raw!.trim())!
  const path = u.pathname.replace(/\/+$/, '')
  return `https://${u.host.toLowerCase()}${path}`
}

export interface BitbucketServerEndpoints {
  /** `{base}/rest/api/latest` — the core REST API (`latest` is the alias the current docs use; it is 1.0). */
  apiBase: string
  /** `{base}/rest/build-status/latest` — commit build statuses. */
  buildStatusBase: string
  /** The browser root, `{base}`. */
  webBase: string
}

/** The endpoints of a server by its base. Throws on anything that is not a valid base. */
export function bitbucketServerEndpoints(base: string): BitbucketServerEndpoints {
  const norm = normalizeBitbucketServerUrl(base)
  if (!norm) throw new Error(`Not a Bitbucket Data Center address: ${base}`)
  return { apiBase: `${norm}/rest/api/latest`, buildStatusBase: `${norm}/rest/build-status/latest`, webBase: norm }
}

/** One repository on a Data Center, as a remote names it. */
export interface BitbucketServerRepo {
  /** The server's canonical base. */
  base: string
  /** The project key as REST takes it: upper case (`PROJ`), or `~user` for a personal repository. */
  projectKey: string
  repoSlug: string
  /** Set for a personal repository: the owner's user slug. */
  user?: string
}

interface RemoteParts {
  scheme: 'https' | 'ssh'
  /** `host[:port]` for https, the bare hostname for ssh. */
  host: string
  path: string
}

function remoteParts(url: string): RemoteParts | null {
  const s = url.trim()
  // scp-like `git@host:KEY/repo.git` — ssh on the default port.
  const scp = /^[\w.-]+@([\w.-]+):(?!\/\/)(.+)$/.exec(s)
  if (scp) return { scheme: 'ssh', host: scp[1].toLowerCase(), path: '/' + scp[2] }
  try {
    const u = new URL(s)
    if (!u.hostname) return null
    // Only https is ever sent a token; plain http is never matched to a server.
    if (u.protocol === 'https:') return { scheme: 'https', host: u.host.toLowerCase(), path: decodeURIComponent(u.pathname) }
    if (u.protocol === 'ssh:') return { scheme: 'ssh', host: u.hostname.toLowerCase(), path: decodeURIComponent(u.pathname) }
  } catch {
    /* not a URL */
  }
  return null
}

/** `KEY/repo(.git)` or `~user/repo(.git)` → its parts, or null for any other shape. */
function repoPath(rest: string, base: string): BitbucketServerRepo | null {
  const parts = rest.replace(/\/+$/, '').replace(/\.git$/i, '').split('/').filter(Boolean)
  if (parts.length !== 2) return null
  const [key, slug] = parts
  if (!SEGMENT.test(slug)) return null
  if (key.startsWith('~')) {
    const user = key.slice(1)
    if (!user || !SEGMENT.test(user)) return null
    return { base, projectKey: `~${user}`, repoSlug: slug, user }
  }
  if (!/^[A-Za-z0-9_]+$/.test(key)) return null
  // Clone URLs carry the key in lower case; it is upper case everywhere else.
  return { base, projectKey: key.toUpperCase(), repoSlug: slug }
}

/**
 * Which configured Data Center a remote is on, and its project and repository.
 * Over https the host and port must equal the server's and the path must sit
 * under its context path's `/scm/`; over ssh (which has no context path, and
 * usually its own port — 7999 by default) only the hostname is compared. Null
 * for any other host, plain http, or a path of another shape.
 */
export function bitbucketServerRepoOf(remoteUrl: string, bases: readonly string[]): BitbucketServerRepo | null {
  const r = remoteParts(remoteUrl)
  if (!r) return null
  // Longest base first: `h/bitbucket` must win over `h` for a remote under it.
  const sorted = [...bases].sort((a, b) => b.length - a.length)
  for (const base of sorted) {
    let u: URL
    try {
      u = new URL(base)
    } catch {
      continue
    }
    if (r.scheme === 'https') {
      if (u.host !== r.host) continue
      const prefix = `${u.pathname.replace(/\/+$/, '')}/scm/`
      if (!r.path.startsWith(prefix)) continue
      return repoPath(r.path.slice(prefix.length), base)
    }
    if (u.hostname !== r.host) continue
    return repoPath(r.path.replace(/^\/+/, ''), base)
  }
  return null
}

/**
 * Which Bitbucket's credentials a remote may receive, by host alone: the Data
 * Center base when the remote is on a configured server, `BITBUCKET_CLOUD` for
 * bitbucket.org, else null — an unknown host gets neither token.
 */
export function bitbucketBaseOfRemote(remoteUrl: string, bases: readonly string[]): string | null {
  const dc = bitbucketServerRepoOf(remoteUrl, bases)
  if (dc) return dc.base
  const r = remoteParts(remoteUrl)
  const hostname = r ? r.host.replace(/:\d+$/, '') : null
  return hostname && isBitbucketCloudHost(hostname) ? BITBUCKET_CLOUD : null
}

/** Every configured Data Center base across the profiles, de-duplicated. Recognition only — not authorisation. */
export function bitbucketServerBases(profiles: ReadonlyArray<Pick<Profile, 'bitbucketServers'>>): string[] {
  const out = new Set<string>()
  for (const p of profiles) {
    for (const h of p.bitbucketServers ?? []) {
      const base = normalizeBitbucketServerUrl(h.url)
      if (base) out.add(base)
    }
  }
  return [...out]
}

/**
 * What one profile may send to the Bitbucket at `base`. bitbucket.org gets the
 * profile's Cloud token and its link; a Data Center gets only the token filed
 * under that exact base (plus the user name git should send with it) — never
 * the Cloud token, never another server's, and never a link.
 */
export function bitbucketAuthFor(
  profile: Pick<Profile, 'bitbucketToken' | 'bitbucketServers' | 'links'>,
  base: string
): { token?: string; link?: AccountLink; username?: string; tokenKind?: BitbucketServerTokenKind } {
  if (base === BITBUCKET_CLOUD) return { token: profile.bitbucketToken?.trim() || undefined, link: profile.links?.bitbucket }
  const target = normalizeBitbucketServerUrl(base)
  if (!target) return {}
  const entry = (profile.bitbucketServers ?? []).find((h) => normalizeBitbucketServerUrl(h.url) === target)
  if (!entry) return {}
  const token = entry.token?.trim() || undefined
  const username = bitbucketServerEntryUsername(entry)
  // Only an explicit, known kind travels; anything else is "not set".
  const kind = token && (entry.tokenKind === 'personal' || entry.tokenKind === 'project') ? entry.tokenKind : undefined
  return { ...(token ? { token } : {}), ...(token && username ? { username } : {}), ...(kind ? { tokenKind: kind } : {}) }
}

/**
 * A saved address that does not normalise, made safe to show: any
 * `user:password@` is dropped (an import or a hand-edited file can carry one),
 * leaving host and path. Everything up to the *last* `@` after the scheme goes,
 * not only a userinfo a URL parser recognises: a password holding a `/` ends
 * the authority early (`https://u:pa/ss@host` parses as host `u`), so the
 * secret would otherwise survive as "path".
 */
export function bitbucketServerDisplayAddress(url: string): string {
  const noScheme = url.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const at = noScheme.lastIndexOf('@')
  const rest = at < 0 ? noScheme : noScheme.slice(at + 1)
  try {
    const u = new URL(`https://${rest}`)
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    return rest
  }
}

/** The fixed name Basic auth takes with a project or repository token. */
export const BBS_PROJECT_TOKEN_USERNAME = 'x-token-auth'

/**
 * The user name a server entry fixes for git, or undefined when it leaves the
 * choice to the remote URL. Only an explicit *project or repository* kind fixes
 * `x-token-auth` — Atlassian, "HTTP access tokens"
 * (confluence.atlassian.com/bitbucketserver/http-access-tokens-939515499.html):
 * "when using basic auth with project or repository tokens, you must set the
 * username to x-token-auth", so the copying user's name that Bitbucket writes
 * into its clone URLs must never replace it. Otherwise the Settings name.
 */
export function bitbucketServerEntryUsername(entry: Pick<BitbucketServerHost, 'username' | 'tokenKind'>): string | undefined {
  if (entry.tokenKind === 'project') return BBS_PROJECT_TOKEN_USERNAME
  return entry.username?.trim() || undefined
}

/**
 * The user name git sends with a Data Center HTTP access token, or null when
 * there is none it could rightly send.
 *
 * - `project`: always `x-token-auth` (see `bitbucketServerEntryUsername`).
 * - `personal`: the Settings name, else the remote URL's — never `x-token-auth`,
 *   which a personal token is refused with; with neither, nothing is sent.
 * - not set (the default, and every entry saved before the choice existed): the
 *   Settings name, else the remote URL's, else `x-token-auth`.
 */
export function bitbucketServerGitUsername(
  username: string | undefined,
  urlUsername?: string,
  kind?: BitbucketServerTokenKind
): string | null {
  if (kind === 'project') return BBS_PROJECT_TOKEN_USERNAME
  const name = username?.trim() || urlUsername?.trim()
  if (name) return name
  return kind === 'personal' ? null : BBS_PROJECT_TOKEN_USERNAME
}

// ─── Web links ──────────────────────────────────────────────────────────────
// The pages Bitbucket Data Center itself links to; built here so every link
// the app opens lands under the server's own base and context path.

const enc = encodeURIComponent
const headRef = (branch: string): string => enc(`refs/heads/${branch}`)

/** The repository's page: `/projects/KEY/repos/slug`, or `/users/name/repos/slug` for a personal one. */
export function bitbucketServerRepoUrl(r: BitbucketServerRepo): string {
  const web = bitbucketServerEndpoints(r.base).webBase
  return r.user ? `${web}/users/${enc(r.user)}/repos/${enc(r.repoSlug)}` : `${web}/projects/${enc(r.projectKey)}/repos/${enc(r.repoSlug)}`
}

export function bitbucketServerCommitUrl(r: BitbucketServerRepo, sha: string): string {
  return `${bitbucketServerRepoUrl(r)}/commits/${enc(sha)}`
}

export function bitbucketServerBranchUrl(r: BitbucketServerRepo, branch: string): string {
  return `${bitbucketServerRepoUrl(r)}/browse?at=${headRef(branch)}`
}

export function bitbucketServerPullRequestUrl(r: BitbucketServerRepo, id: number): string {
  return `${bitbucketServerRepoUrl(r)}/pull-requests/${id}`
}

export function bitbucketServerCompareUrl(r: BitbucketServerRepo, source: string, target: string): string {
  return `${bitbucketServerRepoUrl(r)}/compare/commits?sourceBranch=${headRef(source)}&targetBranch=${headRef(target)}`
}

/** The "create pull request" page with both branches chosen. */
export function bitbucketServerCreatePrUrl(r: BitbucketServerRepo, source: string, target: string): string {
  return `${bitbucketServerRepoUrl(r)}/pull-requests?create&sourceBranch=${headRef(source)}&targetBranch=${headRef(target)}`
}

/** Where a user makes an HTTP access token: their account's token page. */
export function bitbucketServerTokenUrl(base: string): string {
  return `${bitbucketServerEndpoints(base).webBase}/plugins/servlet/access-tokens/manage`
}
