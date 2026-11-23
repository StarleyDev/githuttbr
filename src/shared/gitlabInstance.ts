import { PRODUCT_NAME } from './brand'
import { ambiguousRemotePath } from './remotePath'
/**
 * GitLab instances: gitlab.com plus the self-managed ones profiles point at.
 *
 * A self-managed GitLab lives at a host of its owner's choosing, sometimes under
 * a path (`https://example.com/gitlab`). An instance is kept as its normalized
 * base URL — https, no trailing slash, no credentials — and a remote belongs to
 * it when the host matches and, for https, the path sits under the base.
 *
 * This is also the security boundary for GitLab tokens: a token is issued by
 * one instance and may only ever be sent to that one — gitlab.com's to
 * gitlab.com, each server's to its own base (`gitlabAuthFor`).
 */

import type { AccountLink, GitlabServer, Profile } from './types'

export const GITLAB_COM = 'https://gitlab.com'

/**
 * A typed-in instance URL in canonical form, or null when it is not one.
 * A bare host gets https. Plain http is refused: the token would cross the
 * network in clear text.
 */
export function normalizeInstanceUrl(raw: string | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  let u: URL
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || !u.hostname) return null
  const path = u.pathname.replace(/\/+$/, '')
  return `https://${u.host.toLowerCase()}${path}`
}

export function tokenInstance(provider: 'gitlab' | 'forgejo', address?: string): string | null {
  if (provider === 'gitlab' && !address?.trim()) return GITLAB_COM
  return normalizeInstanceUrl(address)
}

/** Tokens from versions before self-managed hosting could only belong to gitlab.com. */
export function tokenMatchesInstance(provider: 'gitlab' | 'forgejo', address?: string, issuer?: string): boolean {
  const base = tokenInstance(provider, address)
  return !!base && base === (issuer ?? (provider === 'gitlab' ? GITLAB_COM : undefined))
}

/** A Forgejo address edit: a token or link issued by the old address does not follow it. */
export function editInstance(profile: Profile, provider: 'forgejo', address: string): Partial<Profile> {
  if (tokenInstance(provider, profile.forgejoUrl) === tokenInstance(provider, address)) return { forgejoUrl: address }
  const links = { ...profile.links }
  delete links[provider]
  return { forgejoUrl: address, forgejoToken: '', forgejoTokenIssuer: undefined, links }
}

/** Kept for readability at GitLab call sites. */
export const normalizeGitlabUrl = normalizeInstanceUrl

// ─── Self-managed GitLab servers ────────────────────────────────────────────
// A profile has gitlab.com (its `gitlabToken`) plus any number of self-managed
// servers, each with a token of its own — the GitHub Enterprise model.

/** Why a typed-in server address was refused — each has its own message in Settings. */
export type GitlabServerUrlProblem = 'invalid' | 'http' | 'credentials' | 'query' | 'gitlabCom'

/** gitlab.com as typed into Settings — what is refused as a self-managed address. */
function isGitlabComAddress(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'gitlab.com' || h === 'www.gitlab.com'
}

/**
 * The gitlab.com hosts a remote names, exactly: the web, API and git host, and
 * ssh over port 443 (`ssh://git@altssh.gitlab.com:443/g/r.git`). A list, not a
 * suffix: any other `*.gitlab.com` is never handed the gitlab.com token.
 */
const GITLAB_COM_HOSTS: ReadonlySet<string> = new Set(['gitlab.com', 'altssh.gitlab.com'])

/** One of the gitlab.com hosts above — the check before the gitlab.com token goes anywhere. */
export function isGitlabComHost(hostname: string): boolean {
  return GITLAB_COM_HOSTS.has(hostname.toLowerCase())
}

/**
 * Check a typed-in self-managed GitLab address. A bare host gets https. A path
 * is allowed — GitLab can be served under a relative URL root
 * (`https://example.com/gitlab`) — but refused are:
 * - anything but https — the token would cross the network in clear text;
 * - a user name or password — the token has its own field, and a URL is shown
 *   and copied far more freely than a secret;
 * - a query or fragment — it would end up inside every API URL;
 * - gitlab.com — it has its own token, configured above the list.
 */
export function gitlabServerUrlProblem(raw: string | undefined): GitlabServerUrlProblem | null {
  const s = raw?.trim()
  if (!s) return 'invalid'
  let u: URL
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return 'invalid'
  }
  if (u.protocol !== 'https:') return u.protocol === 'http:' ? 'http' : 'invalid'
  if (!u.hostname) return 'invalid'
  if (u.username || u.password) return 'credentials'
  if (u.search || u.hash) return 'query'
  if (isGitlabComAddress(u.hostname)) return 'gitlabCom'
  return null
}

/** A server address in canonical form (`https://host[:port][/path]`), or null when it is refused. */
export function normalizeGitlabServerUrl(raw: string | undefined): string | null {
  return gitlabServerUrlProblem(raw) ? null : normalizeInstanceUrl(raw)
}

/**
 * Every configured server base across the profiles, de-duplicated — recognition
 * only, not authorisation. Read leniently (`normalizeInstanceUrl`), as the
 * one-instance model did, so a migrated address keeps working.
 */
export function gitlabServerBases(profiles: ReadonlyArray<Pick<Profile, 'gitlabServers'>>): string[] {
  const out = new Set<string>()
  for (const p of profiles) {
    for (const s of p.gitlabServers ?? []) {
      const base = normalizeInstanceUrl(s.url)
      if (base && base !== GITLAB_COM) out.add(base)
    }
  }
  return [...out]
}

/** gitlab.com's token of a profile, or '' when the stored one was issued elsewhere. */
export function gitlabComToken(profile: Pick<Profile, 'gitlabToken' | 'gitlabTokenIssuer'>): string {
  return tokenMatchesInstance('gitlab', undefined, profile.gitlabTokenIssuer) ? (profile.gitlabToken ?? '') : ''
}

/**
 * What one profile may send to the GitLab at `base`. gitlab.com gets the
 * profile's GitLab token and link; a server gets only what is filed under that
 * exact base — never the gitlab.com token, never another server's.
 */
export function gitlabAuthFor(
  profile: Pick<Profile, 'gitlabToken' | 'gitlabTokenIssuer' | 'gitlabServers' | 'links'>,
  base: string
): { token?: string; link?: AccountLink } {
  if (base === GITLAB_COM) return { token: gitlabComToken(profile).trim() || undefined, link: profile.links?.gitlab }
  const target = normalizeInstanceUrl(base)
  if (!target || target === GITLAB_COM) return {}
  const entry = (profile.gitlabServers ?? []).find((s) => normalizeInstanceUrl(s.url) === target)
  return entry ? { token: entry.token?.trim() || undefined, link: entry.link } : {}
}

/**
 * The GitLab a picker opens on: gitlab.com when the profile is connected there,
 * else its first server — so a profile migrated from one self-managed instance
 * still lands where it used to — else gitlab.com.
 */
export function preferredGitlabBase(
  profile: Pick<Profile, 'gitlabToken' | 'gitlabTokenIssuer' | 'gitlabServers' | 'links'>
): string {
  const com = gitlabAuthFor(profile, GITLAB_COM)
  if (com.token || com.link) return GITLAB_COM
  return gitlabServerBases([profile])[0] ?? GITLAB_COM
}

type GitlabFields = Pick<Profile, 'gitlabToken' | 'gitlabTokenIssuer' | 'gitlabServers' | 'gitlabUrl' | 'links'>

/**
 * Bring a one-instance profile (`gitlabUrl` + one token) to the list model.
 * Lossless and idempotent: a self-managed `gitlabUrl` becomes a server entry
 * that takes the token it issued and the machine-login link that went with it;
 * gitlab.com, an empty or an unreadable address only drop the field.
 *
 * A token never moves to an instance other than its issuer. One with no issuer
 * next to a self-managed address could be either — the old code never sent it
 * anywhere — so it is dropped rather than guessed to be gitlab.com's.
 */
export function migrateGitlabProfile<T extends GitlabFields>(profile: T): T {
  if (!('gitlabUrl' in profile)) return profile
  const { gitlabUrl, ...rest } = profile
  const out = { ...rest } as T
  const base = normalizeInstanceUrl(gitlabUrl)
  const issuer = profile.gitlabTokenIssuer
  if (!base || base === GITLAB_COM) {
    if (issuer && issuer !== GITLAB_COM) {
      out.gitlabToken = ''
      delete out.gitlabTokenIssuer
    }
    return out
  }
  const servers: GitlabServer[] = [...(profile.gitlabServers ?? [])]
  let i = servers.findIndex((s) => normalizeInstanceUrl(s.url) === base)
  if (i < 0) i = servers.push({ url: base, token: '' }) - 1
  const entry = { ...servers[i] }
  if (profile.gitlabToken?.trim() && issuer === base && !entry.token) entry.token = profile.gitlabToken
  // The one GitLab link of a one-instance profile named an account on that instance.
  if (profile.links?.gitlab) {
    const links = { ...profile.links }
    if (!entry.link) entry.link = links.gitlab
    delete links.gitlab
    out.links = links
  }
  servers[i] = entry
  out.gitlabServers = servers
  if (issuer !== GITLAB_COM) {
    out.gitlabToken = ''
    delete out.gitlabTokenIssuer
  }
  return out
}

/** The whole settings object, every profile migrated. */
export function migrateGitlabSettings<S extends { profiles: Profile[] }>(settings: S): S {
  if (!(settings.profiles ?? []).some((p) => 'gitlabUrl' in p)) return settings
  return { ...settings, profiles: settings.profiles.map((p) => migrateGitlabProfile(p)) }
}

/** Host and path of a remote URL, https or ssh (`git@host:path`, `ssh://git@host[:port]/path`). */
function remoteParts(url: string): { scheme: 'https' | 'ssh'; host: string; path: string } | null {
  // Matched on the path as written: one a proxy could decode into another
  // server's (`/gitlab%2F..%2Fother/`) belongs to no instance here.
  if (ambiguousRemotePath(url)) return null
  const scp = /^[\w.-]+@([\w.-]+):(?!\/\/)(.+)$/.exec(url)
  if (scp) return { scheme: 'ssh', host: scp[1].toLowerCase(), path: scp[2].replace(/^\/+/, '') }
  try {
    const u = new URL(url)
    const scheme = u.protocol === 'https:' ? 'https' : u.protocol === 'ssh:' ? 'ssh' : null
    if (!scheme) return null
    return { scheme, host: (scheme === 'https' ? u.host : u.hostname).toLowerCase(), path: u.pathname.replace(/^\/+/, '') }
  } catch {
    return null
  }
}

/**
 * Which of `bases` a remote belongs to, and the project path inside it
 * (`group/sub/repo`, `.git` dropped). Provider-neutral: GitLab and Forgejo
 * instances are matched the same way.
 *
 * Over ssh the instance's base path does not appear in the remote (the ssh
 * server serves projects at the root), so only the host is compared.
 */
export function instanceOf(remoteUrl: string, bases: readonly string[]): { base: string; path: string } | null {
  const r = remoteParts(remoteUrl)
  if (!r) return null
  // Longest base first: `example.com/gitlab` must win over `example.com`.
  const sorted = [...new Set(bases)].sort((a, b) => b.length - a.length)
  for (const base of sorted) {
    const b = new URL(base)
    if ((r.scheme === 'https' ? b.host : b.hostname).toLowerCase() !== r.host) continue
    let path = r.path
    if (r.scheme === 'https') {
      const prefix = b.pathname.replace(/^\/+/, '')
      if (prefix) {
        if (!path.startsWith(`${prefix}/`)) continue
        path = path.slice(prefix.length + 1)
      }
    }
    path = path.replace(/\.git$/, '').replace(/\/+$/, '')
    if (!path.includes('/')) continue
    // Matched encoded; handed out as the project path the API is asked about.
    // Safe to decode now: no escape left can add a separator or a dot segment.
    return { base, path: decodeURIComponent(path) }
  }
  return null
}

/** `instanceOf` with gitlab.com always known. */
export function gitlabInstanceOf(
  remoteUrl: string,
  instances: readonly string[]
): { base: string; path: string } | null {
  return instanceOf(remoteUrl, [GITLAB_COM, ...instances])
}

/** Whether a remote sits on the given instance — the check before a token is sent. */
export function remoteIsOnGitlab(remoteUrl: string, base: string): boolean {
  return gitlabInstanceOf(remoteUrl, [base])?.base === base
}

/**
 * Where to create a token on gitlab.com or a server, pre-filled. `api` covers
 * merge requests (create, approve, merge); `write_repository` is what a push
 * over https needs — a read-only token would connect fine and then fail on the
 * first push. Current GitLab serves the page at `/-/user_settings/…`; the old
 * `/-/profile/…` address redirects there.
 */
export function gitlabTokenUrl(base?: string): string {
  const root = normalizeInstanceUrl(base) ?? GITLAB_COM
  return `${root}/-/user_settings/personal_access_tokens?name=${encodeURIComponent(PRODUCT_NAME)}&scopes=api,write_repository`
}

// ─── Forgejo / Gitea ────────────────────────────────────────────────────────
// Always at an address of its owner's choosing (codeberg.org is just a public
// one), so unlike GitLab there is no default instance.

/** The Forgejo instance a profile's token belongs to, or null when it names none. */
export function profileForgejoBase(forgejoUrl: string | undefined): string | null {
  return normalizeInstanceUrl(forgejoUrl)
}

/** Which configured Forgejo a remote is on, and its `owner/repo`. */
export function forgejoInstanceOf(remoteUrl: string, instances: readonly string[]): { base: string; path: string } | null {
  const hit = instanceOf(remoteUrl, instances)
  // Forgejo repositories are exactly owner/repo — no subgroups.
  return hit && hit.path.split('/').length === 2 ? hit : null
}

/** Whether a remote sits on the given Forgejo — the check before its token is sent. */
export function remoteIsOnForgejo(remoteUrl: string, base: string | null): boolean {
  return !!base && forgejoInstanceOf(remoteUrl, [base])?.base === base
}

/** Where to create a token on a Forgejo instance. */
export function forgejoTokenUrl(forgejoUrl: string | undefined): string | null {
  const base = profileForgejoBase(forgejoUrl)
  return base ? `${base}/user/settings/applications` : null
}
