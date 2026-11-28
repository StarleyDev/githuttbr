import type { PrComment, PrCommit, PrDetail, PrReview, PrReviewThread } from '../../../shared/types'
import { isWrittenByViewer, type CommentViewer } from './commentEdit'

/**
 * The Conversation tab as one timeline: what goes on it, in which order, and
 * what each filter keeps. No React — components/PrConversationTimeline.tsx
 * draws it.
 */

/** One entry on the timeline. `at` is ms since the epoch — what it is ordered by. */
export type PrTimelineItem =
  | { kind: 'description'; id: string; at: number }
  | { kind: 'comment'; id: string; at: number; comment: PrComment }
  | { kind: 'thread'; id: string; at: number; thread: PrReviewThread }
  | { kind: 'review'; id: string; at: number; review: PrReview }
  | { kind: 'push'; id: string; at: number; author: string; commits: PrCommit[] }

export type PrTimelineFilter = 'all' | 'comments' | 'reviews' | 'commits'

/** One "pushed N commits" entry. */
export interface PrCommitPush {
  author: string
  /** The last commit's date: when the group was, at the earliest, pushed. */
  at: number
  commits: PrCommit[]
}

/** Commits further apart than this are taken as separate pushes. */
export const PUSH_GAP_MS = 60 * 60 * 1000

const parseTime = (iso: string | null | undefined): number => {
  const at = iso ? Date.parse(iso) : NaN
  return Number.isFinite(at) ? at : 0
}

/**
 * The commit list grouped into pushes. No host says when a commit was pushed
 * (GitHub keeps no record of a plain push; the Updates tab reconstructs it from
 * a separate read), so the rule works from the commit list alone: commits in
 * branch order by the same author, each authored within `PUSH_GAP_MS` of the
 * one before it, are one push. Another author, or a pause of over an hour,
 * starts the next. A rebase that rewrote the dates moves them; it is an
 * approximation of who added what, and when, not the host's record.
 */
export function groupPrCommitPushes(commits: readonly PrCommit[], gapMs = PUSH_GAP_MS): PrCommitPush[] {
  const out: PrCommitPush[] = []
  let prevAt = 0
  for (const c of commits) {
    const author = c.authorLogin || c.authorName
    const at = parseTime(c.authoredAt)
    const last = out[out.length - 1]
    if (last && last.author === author && Math.abs(at - prevAt) <= gapMs) {
      last.commits.push(c)
      last.at = Math.max(last.at, at)
    } else out.push({ author, at, commits: [c] })
    prevAt = at
  }
  return out
}

/**
 * Whether a review is an event worth a line of its own. A decision always is;
 * a plain "commented" review only with text — GitHub files every batch of line
 * comments (and every reply in a thread) under an empty one, which would
 * repeat each thread. A dismissed or pending review is not a verdict, and one
 * without a date has no place in time (the sidebar still shows it).
 */
function isReviewEvent(r: PrReview): boolean {
  if (!r.submittedAt) return false
  if (r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED') return true
  return r.state === 'COMMENTED' && !!r.body?.trim()
}

/**
 * Everything on the Conversation tab in time order: the description first,
 * then comments, inline threads (at their first comment), review events and
 * pushes. Equal times keep the order they are listed in here.
 */
export function buildPrTimeline(
  pr: Pick<PrDetail, 'createdAt' | 'comments' | 'reviewThreads' | 'reviews'>,
  commits: readonly PrCommit[] | null
): PrTimelineItem[] {
  const items: PrTimelineItem[] = []
  pr.comments.forEach((comment, i) =>
    items.push({
      kind: 'comment',
      id: `c:${comment.handle?.threadId ?? ''}:${comment.handle?.id ?? i}`,
      at: parseTime(comment.createdAt),
      comment
    })
  )
  for (const thread of pr.reviewThreads)
    items.push({ kind: 'thread', id: `t:${thread.rootId}`, at: parseTime(thread.comments[0]?.createdAt), thread })
  pr.reviews.forEach((review, i) => {
    if (isReviewEvent(review)) items.push({ kind: 'review', id: `r:${i}`, at: parseTime(review.submittedAt), review })
  })
  for (const p of groupPrCommitPushes(commits ?? []))
    items.push({ kind: 'push', id: `p:${p.commits[0].sha}`, at: p.at, author: p.author, commits: p.commits })
  // Array.prototype.sort is stable: equal times keep the order above.
  items.sort((a, b) => a.at - b.at)
  return [{ kind: 'description', id: 'description', at: parseTime(pr.createdAt) }, ...items]
}

/** Who wrote a timeline entry; a thread is its first comment's, a push its committer's. */
function getEntryAuthor(it: PrTimelineItem, prAuthor: string): { author: string; authorId?: string; authorUniqueName?: string } {
  switch (it.kind) {
    case 'comment':
      return it.comment
    case 'thread':
      return it.thread.comments[0] ?? { author: '' }
    case 'review':
      return it.review
    case 'push':
      return { author: it.author }
    default:
      return { author: prAuthor }
  }
}

/**
 * "New since your last visit" on the Conversation tab, over the entries shown.
 *
 * - `seen` / `fresh`: where the divider goes — before the first entry after the
 *   visit that someone else wrote. Entries keep their places: your own reply
 *   after it stays under the divider, it just does not move it.
 * - `freshCount`: what the summary says — entries after the visit not written
 *   by you, plus threads that began earlier but got a reply from someone else
 *   since. Such a thread stays where it began; only the count sees the reply.
 *
 * No last visit (a first look) is "nothing new", as in lib/prVisits.ts.
 */
export function splitPrTimelineByVisit(
  items: readonly PrTimelineItem[],
  lastVisit: number | null,
  who: CommentViewer & { author: string }
): { seen: PrTimelineItem[]; fresh: PrTimelineItem[]; freshCount: number } {
  if (lastVisit === null) return { seen: [...items], fresh: [], freshCount: 0 }
  const others = (entry: { author: string; authorId?: string; authorUniqueName?: string }): boolean =>
    !isWrittenByViewer(entry, who)
  const isNewByOthers = (it: PrTimelineItem): boolean => it.at > lastVisit && others(getEntryAuthor(it, who.author))
  const firstFresh = items.findIndex(isNewByOthers)
  const cut = firstFresh < 0 ? items.length : firstFresh
  let freshCount = 0
  for (const it of items) {
    if (isNewByOthers(it)) freshCount++
    else if (
      it.kind === 'thread' &&
      it.thread.comments.some((c) => parseTime(c.createdAt) > lastVisit && others(c))
    )
      freshCount++
  }
  return { seen: items.slice(0, cut), fresh: items.slice(cut), freshCount }
}

/** A thread the host says is still open. Unknown (no `resolved`) is not open. */
export const isOpenThread = (th: PrReviewThread): boolean => th.resolved === false

export function countOpenThreads(threads: readonly PrReviewThread[]): number {
  return threads.filter(isOpenThread).length
}

/**
 * What one filter keeps. Comments are the written conversation (the
 * description included); Reviews the verdicts and the line threads written as
 * part of a review; Commits the pushes. `openOnly` — the "N open threads"
 * chip — keeps only open threads, whatever the filter.
 */
export function filterPrTimeline(
  items: readonly PrTimelineItem[],
  filter: PrTimelineFilter,
  openOnly = false
): PrTimelineItem[] {
  if (openOnly) return items.filter((it) => it.kind === 'thread' && isOpenThread(it.thread))
  switch (filter) {
    case 'comments':
      return items.filter((it) => it.kind === 'description' || it.kind === 'comment' || it.kind === 'thread')
    case 'reviews':
      return items.filter((it) => it.kind === 'review' || it.kind === 'thread')
    case 'commits':
      return items.filter((it) => it.kind === 'push')
    default:
      return [...items]
  }
}

/** The pills next to a name: the PR's author, and anyone who reviewed or was asked to. */
export interface PrPersonRoles {
  author: boolean
  reviewer: boolean
}

export function getPrPersonRoles(
  pr: Pick<PrDetail, 'author' | 'reviews' | 'requestedReviewers'>,
  login: string
): PrPersonRoles {
  const author = login === pr.author
  const reviewer =
    !author &&
    (pr.reviews.some((r) => r.author === login) ||
      (pr.requestedReviewers ?? []).some((p) => !p.team && p.login === login))
  return { author, reviewer }
}

/** One line of a thread's diff snippet: its kind, its number on its side, its text without the +/-. */
export interface HunkLine {
  kind: 'add' | 'del' | 'ctx'
  line: number | null
  text: string
}

/**
 * The last `max` lines of a thread's `diffHunk` — the ones just above and on
 * the commented line, which is where GitHub ends the hunk — each numbered on
 * its own side (a removed line in the old file, the others in the new). Empty
 * for a host that sends no hunk.
 */
export function getHunkLines(diffHunk: string, max = 4): HunkLine[] {
  if (!diffHunk.trim()) return []
  const rows = diffHunk.replace(/\r\n/g, '\n').split('\n')
  const head = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(rows[0] ?? '')
  let oldNo = head ? Number(head[1]) : null
  let newNo = head ? Number(head[2]) : null
  const out: HunkLine[] = []
  for (const row of head ? rows.slice(1) : rows) {
    // "\ No newline at end of file" belongs to the line before it.
    if (row.startsWith('\\')) continue
    const sign = row[0]
    const text = row.slice(1)
    if (sign === '+') {
      out.push({ kind: 'add', line: newNo, text })
      if (newNo !== null) newNo++
    } else if (sign === '-') {
      out.push({ kind: 'del', line: oldNo, text })
      if (oldNo !== null) oldNo++
    } else {
      out.push({ kind: 'ctx', line: newNo, text: sign === ' ' ? text : row })
      if (oldNo !== null) oldNo++
      if (newNo !== null) newNo++
    }
  }
  // A trailing newline in the hunk is not a line of the file.
  while (out.length && out[out.length - 1].kind === 'ctx' && out[out.length - 1].text === '') out.pop()
  return out.slice(-max)
}
