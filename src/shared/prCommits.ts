import type { PrCommit, PrCommitList } from './types'

/**
 * Shaping a pull request's commits the same way whatever host listed them:
 * the message split into subject and body, oldest first, and capped.
 */

/** The most commits the Commits tab lists. GitHub itself stops at 250. */
export const PR_COMMITS_MAX = 250

/** A commit message as its first line and the rest. */
export function splitCommitMessage(message: string | null | undefined): { subject: string; body?: string } {
  const text = (message ?? '').replace(/\r\n/g, '\n')
  const nl = text.indexOf('\n')
  const subject = (nl < 0 ? text : text.slice(0, nl)).trim()
  const body = nl < 0 ? '' : text.slice(nl + 1).trim()
  return body ? { subject, body } : { subject }
}

/** What every host gives in some shape, before it becomes a PrCommit. */
export interface RawPrCommit {
  sha: string
  message: string | null | undefined
  authorName: string | null | undefined
  authorLogin?: string | null
  authorAvatar?: string | null
  authoredAt: string | number | null | undefined
  /** Parent shas, when the host lists them — also what tells its order apart. */
  parentShas?: string[] | null
}

function isoOf(at: RawPrCommit['authoredAt']): string {
  if (typeof at === 'number') return new Date(at).toISOString()
  return typeof at === 'string' ? at : ''
}

export function toPrCommit(raw: RawPrCommit): PrCommit {
  const login = raw.authorLogin?.trim()
  // Only an https picture: anything else would be fetched over plain http, or not at all.
  const avatar = raw.authorAvatar && /^https:\/\//i.test(raw.authorAvatar) ? raw.authorAvatar : undefined
  return {
    sha: raw.sha,
    shortSha: raw.sha.slice(0, 7),
    ...splitCommitMessage(raw.message),
    authorName: raw.authorName?.trim() || login || '?',
    ...(login ? { authorLogin: login } : {}),
    ...(avatar ? { authorAvatar: avatar } : {}),
    authoredAt: isoOf(raw.authoredAt),
    ...(raw.parentShas ? { parents: raw.parentShas.length } : {})
  }
}

/**
 * The commits oldest first. Hosts disagree — GitHub lists oldest first,
 * Data Center and GitLab newest first — and some do not document it. Where
 * parents are listed they settle it: in a newest-first list, some commit's
 * parent comes after it. `newestFirst` is the host's documented order, used
 * only when the parents cannot tell (no parents, or a single commit).
 */
export function orderOldestFirst<T extends { sha: string; parentShas?: string[] | null }>(list: T[], newestFirst: boolean): T[] {
  if (list.length < 2) return list
  const index = new Map(list.map((c, i) => [c.sha, i]))
  let before = 0
  let after = 0
  list.forEach((c, i) => {
    for (const p of c.parentShas ?? []) {
      const at = index.get(p)
      if (at === undefined) continue
      if (at < i) before++
      else after++
    }
  })
  const reverse = before || after ? after > before : newestFirst
  return reverse ? [...list].reverse() : list
}

/**
 * A host's list, in the order it was read, as the tab shows it: capped at
 * PR_COMMITS_MAX (the first ones read are kept), then oldest first.
 * `hostHasMore` is the host saying so — a cursor or total the app stopped short
 * of; reading past the cap says it too.
 */
export function finishPrCommits(raws: RawPrCommit[], newestFirst: boolean, hostHasMore: boolean): PrCommitList {
  const kept = raws.slice(0, PR_COMMITS_MAX)
  return {
    commits: orderOldestFirst(kept, newestFirst).map(toPrCommit),
    truncated: hostHasMore || raws.length > PR_COMMITS_MAX
  }
}
