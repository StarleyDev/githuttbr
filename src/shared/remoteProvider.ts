import type { RepoHost } from './types'
import { BITBUCKET_CLOUD, isBitbucketCloudHost } from './bitbucketServer'
import { GITHUB_COM, isGithubComHost } from './githubEnterprise'
import { GITLAB_COM } from './gitlabInstance'

/**
 * Every self-hosted server the profiles configure, by provider. Recognition
 * only: which token a remote may receive is still decided per profile.
 */
export interface ServerRegistry {
  gitlab: readonly string[]
  forgejo: readonly string[]
  githubEnterprise: readonly string[]
  bitbucketServer: readonly string[]
}

export interface ResolvedRemote {
  provider: RepoHost
  /** The server the remote sits on: a cloud's fixed base, or the configured
   *  base it matched. Absent when only the hostname told the provider — such a
   *  remote is recognised, but no server's token belongs to it. */
  base?: string
}

/** The Data Center ssh daemon's default port — the one thing an ssh remote says about which server it is. */
export const BITBUCKET_SERVER_SSH_PORT = 7999

interface Parts {
  scheme: 'https' | 'ssh' | 'other'
  /** `host[:port]` for https; the bare hostname otherwise. */
  host: string
  hostname: string
  port: number | null
  /** Leading `/` kept, percent-decoded. */
  path: string
}

function partsOf(url: string): Parts | null {
  // scp-style ssh, `[user@]host:path` — never a `scheme://` URL.
  const scp = url.includes('://') ? null : /^(?:[\w.-]+@)?([\w.-]+):(.+)$/.exec(url)
  if (scp) {
    const hostname = scp[1].toLowerCase()
    return { scheme: 'ssh', host: hostname, hostname, port: null, path: '/' + scp[2].replace(/^\/+/, '') }
  }
  try {
    const u = new URL(url)
    if (!u.hostname) return null
    const hostname = u.hostname.toLowerCase()
    let path = u.pathname
    try {
      path = decodeURIComponent(path)
    } catch {
      /* keep it encoded */
    }
    const port = u.port ? Number(u.port) : null
    if (u.protocol === 'https:') return { scheme: 'https', host: u.host.toLowerCase(), hostname, port, path }
    if (u.protocol === 'ssh:' || u.protocol === 'git+ssh:') return { scheme: 'ssh', host: hostname, hostname, port, path }
    return { scheme: 'other', host: hostname, hostname, port, path }
  } catch {
    return null
  }
}

interface Candidate {
  provider: RepoHost
  base: string
  host: string
  hostname: string
  /** The base's context path, no trailing slash ('' at the root). */
  prefix: string
}

function candidatesOf(reg: ServerRegistry): Candidate[] {
  const out: Candidate[] = []
  const add = (provider: RepoHost, bases: readonly string[]): void => {
    for (const base of new Set(bases)) {
      try {
        const u = new URL(base)
        const prefix = u.pathname.replace(/\/+$/, '')
        out.push({ provider, base, host: u.host.toLowerCase(), hostname: u.hostname.toLowerCase(), prefix })
      } catch {
        /* not a base — skip it */
      }
    }
  }
  add('gitlab', reg.gitlab)
  add('forgejo', reg.forgejo)
  add('github', reg.githubEnterprise)
  add('bitbucket', reg.bitbucketServer)
  return out
}

/** The one provider every candidate shares, or null when they disagree (or there are none). */
function soleProvider(list: Candidate[]): RepoHost | null {
  const providers = new Set(list.map((c) => c.provider))
  return providers.size === 1 ? list[0].provider : null
}

/** Longest context path first: `host/gitlab` must win over `host`. */
const byPrefix = (a: Candidate, b: Candidate): number => b.prefix.length - a.prefix.length

/**
 * Which provider — and which server — a remote URL belongs to. The single
 * answer every provider-from-URL decision in main uses, so that a token, an
 * auth scheme and an API client can never disagree about a remote.
 *
 * 1. A cloud host (github.com, gitlab.com, bitbucket.org, Azure DevOps) by its
 *    hostname.
 * 2. https: the configured server whose FULL base — host, port and context
 *    path — the remote sits under, across GitLab, Forgejo, GitHub Enterprise
 *    and Data Center together, longest context path first. Two providers
 *    claiming the very same base is a misconfiguration: unknown.
 * 3. ssh carries neither the web port nor the context path, only a hostname
 *    and the ssh daemon's port: port 7999 (Data Center's default) with a Data
 *    Center on that hostname → Data Center; otherwise the provider when exactly
 *    one provider has servers on that hostname; several → unknown.
 * 4. Anything else (http, git://, an https remote at a port or path no base
 *    covers): by hostname only, when exactly one provider has servers there —
 *    with no base, so no server's token is offered.
 *
 * Unknown is null, never a guess: a remote of unknown provider gets no token.
 */
export function resolveRemoteProvider(url: string, reg: ServerRegistry): ResolvedRemote | null {
  const r = partsOf(url.trim())
  if (!r) return null
  const h = r.hostname
  if (isGithubComHost(h)) return { provider: 'github', base: GITHUB_COM }
  if (h === 'dev.azure.com' || h === 'ssh.dev.azure.com' || h.endsWith('.visualstudio.com')) return { provider: 'azure' }
  if (h === 'gitlab.com' || h.endsWith('.gitlab.com')) return { provider: 'gitlab', base: GITLAB_COM }
  if (isBitbucketCloudHost(h)) return { provider: 'bitbucket', base: BITBUCKET_CLOUD }

  const all = candidatesOf(reg)
  const onHostname = all.filter((c) => c.hostname === h)
  if (onHostname.length === 0) return null

  if (r.scheme === 'https') {
    const under = all
      .filter((c) => c.host === r.host && (c.prefix === '' || r.path === c.prefix || r.path.startsWith(`${c.prefix}/`)))
      .sort(byPrefix)
    if (under.length > 0) {
      const top = under.filter((c) => c.prefix.length === under[0].prefix.length)
      const provider = soleProvider(top)
      return provider ? { provider, base: top[0].base } : null
    }
  }

  if (r.scheme === 'ssh') {
    const dc = onHostname.filter((c) => c.provider === 'bitbucket').sort(byPrefix)
    if (r.port === BITBUCKET_SERVER_SSH_PORT && dc.length > 0) return { provider: 'bitbucket', base: dc[0].base }
    const provider = soleProvider(onHostname)
    // One provider on the host: its longest base, as every server matcher picks.
    return provider ? { provider, base: [...onHostname].sort(byPrefix)[0].base } : null
  }

  const provider = soleProvider(onHostname)
  return provider ? { provider } : null
}

/**
 * The https address of the same repository, for asking git's credential helper
 * or the GitHub CLI about an ssh remote — `git@host:o/r.git` and
 * `ssh://git@host:22/o/r.git` become `https://host/o/r.git` (the ssh port says
 * nothing about the web one). An https URL comes back as it is; anything else
 * (http, git://, a local path) is null.
 */
export function httpsFormOf(url: string): string | null {
  const r = partsOf(url.trim())
  if (!r) return null
  if (r.scheme === 'https') return url.trim()
  if (r.scheme !== 'ssh') return null
  return `https://${r.hostname}${r.path.split('/').map(encodeURIComponent).join('/')}`
}
