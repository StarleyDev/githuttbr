import type { Profile, RemoteInfo } from '../../../shared/types'
import { GITHUB_COM, githubEndpoints, githubEnterpriseBases, githubInstanceOf } from '../../../shared/githubEnterprise'
import { forgejoInstanceOf, gitlabInstanceOf, normalizeGitlabUrl } from '../../../shared/gitlabInstance'
import { bitbucketServerBases, bitbucketServerRepoOf } from '../../../shared/bitbucketServer'

// PR tabs are saved to settings. Keep credentials and URL parameters out of that file.
export function prRemoteIdentity(raw: string): string {
  if (/^[\w.-]+@[\w.-]+:[^/]/.test(raw)) return raw
  try {
    const url = new URL(raw)
    if (!['https:', 'http:', 'ssh:', 'git:'].includes(url.protocol)) return ''
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return ''
  }
}

/**
 * The GitHub Enterprise Servers the profiles name, as canonical bases — what
 * every helper below takes as `enterprise`. Recognition only: which token a
 * server gets is decided in the main process.
 */
export function enterpriseBasesOf(profiles: ReadonlyArray<Pick<Profile, 'githubEnterprise'>>): string[] {
  return githubEnterpriseBases(profiles)
}

/** The Bitbucket Data Centers the profiles name, as canonical bases. Recognition only, as above. */
export function bitbucketServerBasesOf(profiles: ReadonlyArray<Pick<Profile, 'bitbucketServers'>>): string[] {
  return bitbucketServerBases(profiles)
}

/** True if a remote URL points at github.com or a configured GitHub Enterprise Server (SSH or HTTPS). */
export function isGitHubRemote(url: string | undefined | null, enterprise: readonly string[] = []): boolean {
  if (!url) return false
  return /github\.com[/:]/i.test(url) || githubInstanceOf(url, enterprise) !== null
}

/** Owner/repo — and the server's web base — for a GitHub remote (SSH or HTTPS). */
export function parseGitHubRemote(
  url: string | undefined | null,
  enterprise: readonly string[] = []
): { owner: string; repo: string; base: string } | null {
  if (!url) return null
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(url.trim())
  if (m) return { owner: m[1], repo: m[2].replace(/\.git$/i, ''), base: GITHUB_COM }
  const ghes = githubInstanceOf(url.trim(), enterprise)
  return ghes && ghes.base !== GITHUB_COM ? ghes : null
}

/** The repository's web page — `https://github.com/owner/repo` or its GHES equivalent — or undefined. */
export function githubWebUrl(url: string | undefined | null, enterprise: readonly string[] = []): string | undefined {
  const parsed = parseGitHubRemote(url, enterprise)
  return parsed ? `${githubEndpoints(parsed.base).webBase}/${parsed.owner}/${parsed.repo}` : undefined
}

/** Prefer origin when it is GitHub; otherwise the first parseable GitHub remote. */
export function githubRepoUrl(remotes: { name: string; url: string }[], enterprise: readonly string[] = []): string | undefined {
  const origin = remotes.find((r) => r.name === 'origin')
  if (origin && isGitHubRemote(origin.url, enterprise)) return githubWebUrl(origin.url, enterprise)
  const first = remotes.find((r) => isGitHubRemote(r.url, enterprise))
  return first ? githubWebUrl(first.url, enterprise) : undefined
}

/** GitHub remote used for web links — origin when it is GitHub, else the first GitHub remote. */
export function githubRemote(remotes: RemoteInfo[], enterprise: readonly string[] = []): RemoteInfo | null {
  const origin = remotes.find((r) => r.name === 'origin')
  if (origin && isGitHubRemote(origin.url, enterprise)) return origin
  return remotes.find((r) => isGitHubRemote(r.url, enterprise)) ?? null
}

/** Canonical commit URL on the remote's GitHub, or null when no GitHub remote can be normalised. */
export function githubCommitUrl(remotes: RemoteInfo[], sha: string, enterprise: readonly string[] = []): string | null {
  const full = sha.trim()
  if (!full) return null
  const remote = githubRemote(remotes, enterprise)
  const parsed = parseGitHubRemote(remote?.url, enterprise)
  if (!parsed) return null
  return `${githubEndpoints(parsed.base).webBase}/${parsed.owner}/${parsed.repo}/commit/${full}`
}

/** The release page of a tag on the remote's GitHub, or null for any other host. */
export function githubTagUrl(url: string | undefined | null, tag: string, enterprise: readonly string[] = []): string | null {
  const web = githubWebUrl(url, enterprise)
  return web ? `${web}/releases/tag/${tag}` : null
}

/** True if the repo's origin (or first) remote is hosted on GitHub — github.com or a configured GHES. */
export function repoIsGitHub(remotes: RemoteInfo[], enterprise: readonly string[] = []): boolean {
  const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
  return isGitHubRemote(origin?.url, enterprise)
}

/**
 * True when the repo's origin is on GitHub or on a Forgejo server some profile
 * names — the hosts whose issues, milestones and releases the sidebar lists.
 */
export function repoHasIssueTracker(
  remotes: RemoteInfo[],
  forgejoUrls: readonly (string | undefined)[],
  enterprise: readonly string[] = []
): boolean {
  const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
  if (!origin) return false
  if (isGitHubRemote(origin.url, enterprise)) return true
  const bases = forgejoUrls.map((u) => normalizeGitlabUrl(u)).filter((b): b is string => !!b)
  return !!forgejoInstanceOf(origin.url, bases)
}

/**
 * True if a remote's host has a rich PR detail/review surface: GitHub, or a
 * GitLab — gitlab.com or one of the self-managed `gitlabInstances` the
 * profiles list (their `gitlabServers`).
 */
export function isReviewableRemote(
  url: string | undefined | null,
  gitlabInstances: readonly string[] = [],
  forgejoInstances: readonly string[] = [],
  enterprise: readonly string[] = [],
  bitbucketServers: readonly string[] = []
): boolean {
  if (!url) return false
  if (bitbucketServerRepoOf(url, bitbucketServers)) return true
  if (/(?:^|[/@.])github\.com[/:]/i.test(url)) return true
  if (githubInstanceOf(url, enterprise)) return true
  // Azure DevOps, current and legacy addresses (https and ssh).
  if (/(?:^|[/@.])dev\.azure\.com[/:]|\.visualstudio\.com\//i.test(url)) return true
  const norm = (list: readonly string[]): string[] =>
    list.map((u) => normalizeGitlabUrl(u)).filter((u): u is string => !!u)
  return gitlabInstanceOf(url, norm(gitlabInstances)) !== null || forgejoInstanceOf(url, norm(forgejoInstances)) !== null
}

/** True if the repo's origin (or first) remote supports the PR detail modal. */
export function repoSupportsPrReview(
  remotes: RemoteInfo[],
  gitlabInstances: readonly string[] = [],
  forgejoInstances: readonly string[] = [],
  enterprise: readonly string[] = [],
  bitbucketServers: readonly string[] = []
): boolean {
  const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
  return isReviewableRemote(origin?.url, gitlabInstances, forgejoInstances, enterprise, bitbucketServers)
}

/**
 * The parent a GitHub fork checkout contributes to: the `upstream` remote, when
 * both it and origin are repositories on the same GitHub and they differ. Null for an
 * ordinary clone, so nothing changes there.
 */
export function forkUpstream(
  remotes: RemoteInfo[],
  enterprise: readonly string[] = []
): { upstream: RemoteInfo; fork: string; parent: string } | null {
  const origin = parseGitHubRemote(remotes.find((r) => r.name === 'origin')?.url, enterprise)
  const upstream = remotes.find((r) => r.name === 'upstream')
  const parent = parseGitHubRemote(upstream?.url, enterprise)
  // A fork lives on the same server as its parent.
  if (!origin || !upstream || !parent || origin.base !== parent.base) return null
  const fork = `${origin.owner}/${origin.repo}`
  const parentSlug = `${parent.owner}/${parent.repo}`
  if (fork.toLowerCase() === parentSlug.toLowerCase()) return null
  return { upstream, fork, parent: parentSlug }
}

/** The parent's open PRs that come from this fork — yours, not the parent's whole queue. */
export function prsFromFork<T extends { headRepo?: string }>(prs: T[], fork: string): T[] {
  const slug = fork.toLowerCase()
  return prs.filter((p) => p.headRepo?.toLowerCase() === slug)
}
