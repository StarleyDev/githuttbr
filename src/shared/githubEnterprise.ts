import { PRODUCT_NAME } from './brand'
import { instanceOf } from './gitlabInstance'
import { ambiguousRemotePath } from './remotePath'
// A cycle (the resolver names github.com by GITHUB_COM): both sides only call
// each other's functions, never at import time.
import { resolveRemoteProvider, type ServerRegistry } from './remoteProvider'
import { serverDisplayAddress } from './serverAddress'
import type { AccountLink, GithubEnterpriseHost, Profile } from './types'

export type { GithubEnterpriseHost }

/**
 * Where a GitHub lives: github.com, or a GitHub Enterprise Server a profile
 * names. This module is the one place that knows the shape of either — every
 * REST, GraphQL and web URL the app builds for GitHub comes from
 * `githubEndpoints`.
 *
 * GHES serves the same API under its own host (docs.github.com, "Getting
 * started with the REST API" and "Forming calls with GraphQL" for GHES):
 *
 *   REST     https://HOSTNAME/api/v3
 *   GraphQL  https://HOSTNAME/api/graphql
 *   web      https://HOSTNAME
 *
 * It is also the security boundary for those tokens: a GHES token is filed
 * under its server's base URL and is only ever handed out for that base.
 */

export const GITHUB_COM = 'https://github.com'

export interface GithubEndpoints {
  /** REST root, without a trailing slash: `https://api.github.com` or `https://h/api/v3`. */
  apiBase: string
  graphqlUrl: string
  /** Browser root: `https://github.com` or `https://h`. */
  webBase: string
  /** True for a GitHub Enterprise Server. */
  enterprise: boolean
}

export const GITHUB_COM_ENDPOINTS: GithubEndpoints = Object.freeze({
  apiBase: 'https://api.github.com',
  graphqlUrl: 'https://api.github.com/graphql',
  webBase: GITHUB_COM,
  enterprise: false
})

/**
 * The github.com hosts a remote or an API call names, exactly: the web and git
 * host, the REST API, gists (`https://gist.github.com/<id>.git` is a remote) and
 * ssh over port 443 (`ssh://git@ssh.github.com:443/o/r.git`). A list, not a
 * suffix: any other `*.github.com` — the ones nobody here needs, and any that
 * might one day serve someone else's content — is never handed the github.com
 * token. Avatars (`avatars.githubusercontent.com`) are fetched without one.
 */
const GITHUB_COM_HOSTS: ReadonlySet<string> = new Set(['github.com', 'api.github.com', 'gist.github.com', 'ssh.github.com'])

/** One of the github.com hosts above — the check before the github.com token goes anywhere. */
export function isGithubComHost(hostname: string): boolean {
  return GITHUB_COM_HOSTS.has(hostname.toLowerCase())
}

/** Anything under github.com — broader on purpose: what Settings refuses as an Enterprise Server address. */
function isUnderGithubCom(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'github.com' || h.endsWith('.github.com')
}

/** Why a typed-in server address was refused — each has its own message in Settings. */
export type GithubEnterpriseUrlProblem = 'invalid' | 'http' | 'path' | 'credentials' | 'githubCom' | 'gheCom'

/**
 * Check a typed-in GHES address. A bare host gets https. Refused:
 * - anything but https — the token would cross the network in clear text;
 * - a path, query or fragment — GHES lives at the root of its host, and a path
 *   would make `/api/v3` land somewhere else;
 * - a user name or password — the token has its own field, and a URL is shown,
 *   logged and copied far more freely than a secret;
 * - github.com — it is configured on its own, and its API is not at `/api/v3`;
 * - `*.ghe.com` (Enterprise Cloud with data residency), for the same reason.
 *
 * Private and internal addresses are deliberately allowed: that is where most
 * Enterprise Servers live.
 */
export function githubEnterpriseUrlProblem(raw: string | undefined): GithubEnterpriseUrlProblem | null {
  const s = raw?.trim()
  if (!s) return 'invalid'
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s)
  let u: URL
  try {
    u = new URL(hasScheme ? s : `https://${s}`)
  } catch {
    return 'invalid'
  }
  if (u.protocol !== 'https:') return u.protocol === 'http:' ? 'http' : 'invalid'
  if (!u.hostname) return 'invalid'
  if (u.username || u.password) return 'credentials'
  if ((u.pathname && u.pathname !== '/') || u.search || u.hash) return 'path'
  if (isUnderGithubCom(u.hostname)) return 'githubCom'
  // Enterprise Cloud with data residency serves its API at `api.<name>.ghe.com`,
  // not `/api/v3`: accepting it would send requests to an address that is not its API.
  if (/(^|\.)ghe\.com$/i.test(u.hostname)) return 'gheCom'
  return null
}

/** A GHES address in canonical form (`https://host[:port]`, lower case), or null when it is refused. */
export function normalizeGithubEnterpriseUrl(raw: string | undefined): string | null {
  if (githubEnterpriseUrlProblem(raw)) return null
  const s = raw!.trim()
  const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`)
  return `https://${u.host.toLowerCase()}`
}

/**
 * The endpoints of a GitHub, by its web base. Absent or github.com → the
 * public API. Anything else must be a valid GHES base, or this throws: a
 * malformed base silently mapped to api.github.com would send that server's
 * token to a third party.
 */
export function githubEndpoints(base?: string | null): GithubEndpoints {
  if (!base || base.toLowerCase() === GITHUB_COM) return GITHUB_COM_ENDPOINTS
  const norm = normalizeGithubEnterpriseUrl(base)
  // Never the raw base in the message: it may carry a credential.
  if (!norm) throw new Error(`Not a GitHub Enterprise Server address: ${serverDisplayAddress(base)}`)
  return { apiBase: `${norm}/api/v3`, graphqlUrl: `${norm}/api/graphql`, webBase: norm, enterprise: true }
}

/**
 * The base of the configured GHES at `host`, any case. Over https the port is
 * part of the server's identity (`h:8443` is not `h`); over ssh the port is the
 * ssh daemon's, so only the hostname is compared — as `instanceOf` does.
 */
export function githubEnterpriseBaseOfHost(
  host: string,
  enterprise: readonly string[],
  scheme: 'https' | 'ssh' = 'https'
): string | null {
  const h = host.toLowerCase()
  for (const base of enterprise) {
    const u = new URL(base)
    if ((scheme === 'https' ? u.host : u.hostname) === h) return base
  }
  return null
}

/**
 * Endpoints for the GitHub at a host, or null when the host is no GitHub the
 * app knows. github.com (its listed hosts, `isGithubComHost`) always resolves; a GHES only when
 * configured — an unknown host never is "probably GitHub".
 */
export function resolveGithubHost(host: string, enterprise: readonly string[]): GithubEndpoints | null {
  if (isGithubComHost(host.replace(/:\d+$/, ''))) return GITHUB_COM_ENDPOINTS
  const base = githubEnterpriseBaseOfHost(host, enterprise)
  return base ? githubEndpoints(base) : null
}

/**
 * Which GitHub's credentials a remote may receive, by host alone: the GHES base
 * when its host is a configured server, `GITHUB_COM` for github.com, else null
 * — an unknown host gets nothing, not the github.com token.
 *
 * Decided by `resolveRemoteProvider`, so it can never disagree with the
 * resolver about a remote (`https://github.com\@evil.com/o` is no GitHub to
 * either). Main passes `reg`, every configured server: a GHES hostname another
 * provider shares is then placed as the resolver places it.
 */
export function githubBaseOfRemote(
  remoteUrl: string,
  enterprise: readonly string[],
  reg?: ServerRegistry
): string | null {
  const r = resolveRemoteProvider(remoteUrl, reg ?? githubOnly(enterprise))
  return r?.provider === 'github' && r.base ? r.base : null
}

/** A registry with only the given GHES bases, for a caller that knows no other server. */
const githubOnly = (enterprise: readonly string[]): ServerRegistry => ({
  gitlab: [],
  forgejo: [],
  githubEnterprise: enterprise,
  bitbucketServer: []
})

/**
 * Which GitHub a remote is on, and its owner/repo — https or ssh. `base` is
 * `GITHUB_COM` or the GHES base. Null for any other host, or a path that is not
 * exactly `owner/repo` — and whenever `resolveRemoteProvider` does not place
 * the remote on that same GitHub (`https://github.com:x@evil.com/o` is on
 * evil.com).
 */
export function githubInstanceOf(
  remoteUrl: string,
  enterprise: readonly string[],
  reg?: ServerRegistry
): { base: string; owner: string; repo: string } | null {
  const resolved = resolveRemoteProvider(remoteUrl, reg ?? githubOnly(enterprise))
  if (resolved?.provider !== 'github' || !resolved.base) return null
  const ghes = instanceOf(remoteUrl, enterprise)
  if (ghes) {
    const parts = ghes.path.split('/')
    return parts.length === 2 && ghes.base === resolved.base ? { base: ghes.base, owner: parts[0], repo: parts[1] } : null
  }
  if (resolved.base !== GITHUB_COM) return null
  const m = /^(?:[\w.-]+@)?((?:[\w-]+\.)*github\.com)[:/](.+)$/i.exec(remoteUrl.replace(/^[a-z]+:\/\//i, ''))
  // The owner and repo are spliced into API paths: none that could walk out of them.
  if (!m || !isGithubComHost(m[1]) || ambiguousRemotePath(remoteUrl)) return null
  const path = m[2].replace(/\.git$/, '').replace(/\/+$/, '').split('/')
  return path.length === 2 && path[0] && path[1] ? { base: GITHUB_COM, owner: path[0], repo: path[1] } : null
}

/** Every configured GHES base across the profiles, de-duplicated. Recognition only — not authorisation. */
export function githubEnterpriseBases(profiles: ReadonlyArray<Pick<Profile, 'githubEnterprise'>>): string[] {
  const out = new Set<string>()
  for (const p of profiles) {
    for (const h of p.githubEnterprise ?? []) {
      const base = normalizeGithubEnterpriseUrl(h.url)
      if (base) out.add(base)
    }
  }
  return [...out]
}

/**
 * What one profile may send to the GitHub at `base`. github.com gets the
 * profile's GitHub token and its link to a machine login; a GHES gets only the
 * token filed under that exact base — never the github.com one, never another
 * server's, and never a link (links name github.com accounts).
 */
export function githubAuthFor(
  profile: Pick<Profile, 'githubToken' | 'githubEnterprise' | 'links'>,
  base: string
): { token?: string; link?: AccountLink } {
  if (base === GITHUB_COM) return { token: profile.githubToken?.trim() || undefined, link: profile.links?.github }
  const target = normalizeGithubEnterpriseUrl(base)
  if (!target) return {}
  const entry = (profile.githubEnterprise ?? []).find((h) => normalizeGithubEnterpriseUrl(h.url) === target)
  return entry ? { token: entry.token?.trim() || undefined } : {}
}

/**
 * Where to create a token on a server, pre-filled. GHES serves the same page as
 * github.com. `repo` covers pull requests, issues, checks and pushing.
 */
export function githubTokenUrl(base?: string): string {
  return `${githubEndpoints(base).webBase}/settings/tokens/new?scopes=repo&description=${encodeURIComponent(PRODUCT_NAME)}`
}
