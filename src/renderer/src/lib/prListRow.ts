import type { PullRequest } from '../../../shared/types'
import type { TranslationKey } from '../i18n'
import { awaitsMyReview, isMine, type PrListItem } from './prList'

/**
 * What one row of the pull requests page says beyond its title: which triage
 * section it sits in, whether it moved since your last visit, how big it is,
 * how many comments are new and where each reviewer stands. No React, no IPC —
 * the page renders these, the tests pin them. Anything the host did not say
 * comes back null or empty, so the row draws nothing instead of a zero.
 */

/** The page's three sections, in the order a reviewer works through them. */
export interface PrTriage {
  /** Someone asked for your review, and it is not your own. */
  awaiting: PrListItem[]
  /** You wrote it. */
  mine: PrListItem[]
  others: PrListItem[]
}

export function getPrTriage(items: readonly PrListItem[], me: string | null | undefined): PrTriage {
  const out: PrTriage = { awaiting: [], mine: [], others: [] }
  for (const it of items) {
    if (isMine(it.pr, me)) out.mine.push(it)
    else if (awaitsMyReview(it.pr, me)) out.awaiting.push(it)
    else out.others.push(it)
  }
  return out
}

/** Changed since the page was last left. A PR never opened has nothing "new":
 *  the same rule the PR page's timeline follows (see prVisits). */
export function hasPrNewActivity(pr: PullRequest, lastVisit: number | null): boolean {
  if (lastVisit === null || !pr.updatedAt) return false
  const at = Date.parse(pr.updatedAt)
  return Number.isFinite(at) && at > lastVisit
}

/** Comments written after the last visit by someone else; null when the list
 *  has no times to tell. */
export function getPrNewCommentCount(pr: PullRequest, lastVisit: number | null, me: string | null | undefined): number | null {
  if (!pr.recentComments) return null
  if (lastVisit === null) return 0
  const self = me?.toLowerCase()
  return pr.recentComments.filter((c) => {
    const at = Date.parse(c.at)
    return Number.isFinite(at) && at > lastVisit && (!self || c.author.toLowerCase() !== self)
  }).length
}

/** "3 comments", "2 new comments", or nothing — the second line's last part. */
export function getPrCommentLabel(
  pr: PullRequest,
  lastVisit: number | null,
  me: string | null | undefined
): { key: TranslationKey; n: number } | null {
  const fresh = getPrNewCommentCount(pr, lastVisit, me)
  if (fresh) return { key: fresh === 1 ? 'prList.newCommentsOne' : 'prList.newComments', n: fresh }
  const total = pr.commentCount
  if (!total) return null
  return { key: total === 1 ? 'prList.commentsOne' : 'prList.comments', n: total }
}

/** "+48 −12 · 4 files", when the host said all three. */
export function getPrSize(pr: PullRequest): { additions: number; deletions: number; files: number } | null {
  if (typeof pr.additions !== 'number' || typeof pr.deletions !== 'number' || typeof pr.changedFiles !== 'number') {
    return null
  }
  return { additions: pr.additions, deletions: pr.deletions, files: pr.changedFiles }
}

export type PrReviewTone = 'green' | 'red' | 'yellow' | 'muted'

/** One line of the review column, as a dictionary key — the caller words it. */
export interface PrReviewLine {
  key: TranslationKey
  vars: Record<string, string>
  tone: PrReviewTone
}

/** Lines a cell shows before folding the rest into "+N more". */
export const REVIEW_LINES_SHOWN = 2

/**
 * Where the reviews stand, one line per reviewer: verdicts given, then the
 * ones still asked — you first. "Ready to merge" replaces them all when the
 * host says the reviews are done and the checks did not fail. "No reviewers"
 * only when the host listed the verdicts and there are none, nor any asked;
 * a host that says nothing gets an empty column.
 */
export function getPrReviewLines(
  pr: PullRequest,
  me: string | null | undefined
): { lines: PrReviewLine[]; more: number } {
  if ((pr.state ?? 'open') !== 'open') return { lines: [], more: 0 }
  const lower = (s: string): string => s.toLowerCase()
  const self = me ? lower(me) : null
  const waitsOnMe = awaitsMyReview(pr, me)
  const asked = (pr.requestedReviewers ?? []).filter((r) => lower(r) !== self)
  if (pr.readyToMerge && pr.ci !== 'failure' && !waitsOnMe) {
    return { lines: [{ key: 'prList.reviewReady', vars: {}, tone: 'green' }], more: 0 }
  }
  // Asked again after a verdict: the request is what stands now.
  const askedNow = new Set(asked.map(lower))
  if (waitsOnMe && self) askedNow.add(self)
  const lines: PrReviewLine[] = []
  for (const r of pr.reviews ?? []) {
    if (askedNow.has(lower(r.login))) continue
    lines.push(
      r.verdict === 'approved'
        ? { key: 'prList.reviewApproved', vars: { name: r.login }, tone: 'green' }
        : { key: 'prList.reviewChanges', vars: { name: r.login }, tone: 'red' }
    )
  }
  // A change request is what holds a PR back: it reads first.
  lines.sort((a, b) => (a.tone === 'red' ? 0 : 1) - (b.tone === 'red' ? 0 : 1))
  if (waitsOnMe) lines.push({ key: 'prList.reviewWaitingYou', vars: {}, tone: 'yellow' })
  for (const name of asked) lines.push({ key: 'prList.reviewWaiting', vars: { name }, tone: 'muted' })
  if (!lines.length) {
    return pr.reviews ? { lines: [{ key: 'prList.reviewNone', vars: {}, tone: 'muted' }], more: 0 } : { lines: [], more: 0 }
  }
  // The yellow "you" line must never be the one folded away.
  if (lines.length > REVIEW_LINES_SHOWN && waitsOnMe) {
    const you = lines.findIndex((l) => l.key === 'prList.reviewWaitingYou')
    if (you >= REVIEW_LINES_SHOWN) lines.splice(REVIEW_LINES_SHOWN - 1, 0, ...lines.splice(you, 1))
  }
  return { lines: lines.slice(0, REVIEW_LINES_SHOWN), more: Math.max(0, lines.length - REVIEW_LINES_SHOWN) }
}

/** Open PRs whose head's checks failed — the "CI failing" chip's count. */
export function countCiFailing(prs: readonly PullRequest[]): number {
  return prs.filter((p) => p.ci === 'failure').length
}
