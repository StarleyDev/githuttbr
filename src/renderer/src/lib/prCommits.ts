import type { PrCommit } from '../../../shared/types'

/** Commits authored on one calendar day, in the order the list had them. */
export interface PrCommitDay {
  /** `YYYY-MM-DD` in the viewer's time zone; empty for commits without a date. */
  day: string
  commits: PrCommit[]
}

/** The local calendar day of an ISO date, or '' when it does not parse. */
export function getLocalDayKey(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/**
 * The Commits tab's day groups. A run of commits on the same day is one group;
 * a commit rebased in out of date order starts a new group rather than being
 * moved, so the list keeps the host's order — the order they apply in.
 */
export function groupCommitsByDay(commits: readonly PrCommit[]): PrCommitDay[] {
  const out: PrCommitDay[] = []
  for (const c of commits) {
    const day = getLocalDayKey(c.authoredAt)
    const last = out[out.length - 1]
    if (last && last.day === day) last.commits.push(c)
    else out.push({ day, commits: [c] })
  }
  return out
}

/**
 * Where a pull request's commit opens on its host, from the pull request's own
 * page: inside the pull request where the host has such a page, else the
 * repository's commit page. Null for a page shape not recognised.
 */
export function getPrCommitWebUrl(prUrl: string, sha: string): string | null {
  if (!/^[0-9a-f]{7,64}$/i.test(sha)) return null
  let u: URL
  try {
    u = new URL(prUrl)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const path = u.pathname.replace(/\/+$/, '')
  const at = (p: string): string => `${u.origin}${p}`
  let m: RegExpExecArray | null
  // GitLab: …/-/merge_requests/7 → the merge request's diff at that commit.
  if ((m = /^(.*\/-\/merge_requests\/\d+)(?:\/.*)?$/.exec(path))) return at(`${m[1]}/diffs?commit_id=${sha}`)
  // Azure DevOps: …/_git/repo/pullrequest/7 → the repository's commit.
  if ((m = /^(.*\/_git\/[^/]+)\/pullrequest\/\d+$/i.exec(path))) return at(`${m[1]}/commit/${sha}`)
  // Bitbucket Data Center: …/projects/P/repos/r/pull-requests/7[/overview] → inside the pull request.
  if ((m = /^(.*\/projects\/[^/]+\/repos\/[^/]+\/pull-requests\/\d+)(?:\/[a-z]+)?$/i.exec(path))) return at(`${m[1]}/commits/${sha}`)
  // bitbucket.org: /ws/repo/pull-requests/7 → the repository's commit.
  if ((m = /^(\/[^/]+\/[^/]+)\/pull-requests\/\d+(?:\/.*)?$/.exec(path))) return at(`${m[1]}/commits/${sha}`)
  // GitHub and GHES: …/pull/7 → the commit inside the pull request.
  if ((m = /^(.*\/pull\/\d+)(?:\/.*)?$/.exec(path))) return at(`${m[1]}/commits/${sha}`)
  // Forgejo / Gitea: …/pulls/7 → the repository's commit.
  if ((m = /^(.*)\/pulls\/\d+(?:\/.*)?$/.exec(path))) return at(`${m[1]}/commit/${sha}`)
  return null
}
