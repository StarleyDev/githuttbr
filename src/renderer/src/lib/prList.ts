import type { HostingProvider, PullRequest, RemoteInfo } from '../../../shared/types'
import type { TranslationKey } from '../i18n'
import { forkUpstream, prRemoteIdentity } from './hosting'

/**
 * The pull requests page's logic: which tab a PR sits in, what the filters
 * keep, who "you" are, and where ‹ › lead. No React, no IPC — the page and the
 * PR detail header both read it, and the tests pin it.
 */

export type PrListTab = 'open' | 'drafts' | 'merged' | 'closed'

export const PR_LIST_TABS: PrListTab[] = ['open', 'drafts', 'merged', 'closed']

/** Stands for the signed-in account in the author and reviewer filters. A
 *  login never contains `@`, so it cannot collide with a real one. */
export const ME = '@me'

export interface PrListFilters {
  /** Words that must all appear in the title, description, author, number or a branch. */
  query: string
  /** '' for anyone, ME, or a login as the host names it. */
  author: string
  /** '' for anyone, ME ("review requested from me"), or a requested reviewer. */
  reviewer: string
  /** '' for every target branch. */
  target: string
  /** Only PRs whose head's checks failed. */
  ciFailing: boolean
}

export const EMPTY_FILTERS: PrListFilters = Object.freeze({
  query: '',
  author: '',
  reviewer: '',
  target: '',
  ciFailing: false
})

/** A PR as the list shows it: the remote it lives on travels with it, since a
 *  fork's own PRs on its parent share the page with origin's. */
export interface PrListItem {
  pr: PullRequest
  remoteUrl: string
  /** The parent repository (`owner/repo`) when the PR lives on a fork's upstream. */
  upstream?: string
}

/**
 * The page's rows from what the repository store holds: origin's PRs, then —
 * in a fork checkout — your PRs on the parent, each carrying the remote its
 * detail page has to ask. Remotes go through prRemoteIdentity, as an opened PR
 * page's do, so a row and its page compare equal.
 */
export function prListItems(
  prs: PullRequest[],
  upstreamPrs: PullRequest[],
  remotes: RemoteInfo[],
  enterprise: readonly string[] = []
): PrListItem[] {
  const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
  if (!origin) return []
  const own = prs.map((pr) => ({ pr, remoteUrl: prRemoteIdentity(origin.url) }))
  const fork = forkUpstream(remotes, enterprise)
  if (!fork || !upstreamPrs.length) return own
  const parent = prRemoteIdentity(fork.upstream.url)
  return [...own, ...upstreamPrs.map((pr) => ({ pr, remoteUrl: parent, upstream: fork.parent }))]
}

/** Where a PR belongs. Drafts are open PRs too: they count in both tabs. */
export function prInTab(pr: PullRequest, tab: PrListTab): boolean {
  const state = pr.state ?? 'open'
  if (tab === 'open') return state === 'open'
  if (tab === 'drafts') return state === 'open' && pr.isDraft
  return state === tab
}

const same = (a: string | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** The signed-in account wrote it. */
export function isMine(pr: PullRequest, me: string | null | undefined): boolean {
  return same(pr.author, me)
}

/** Your review is asked for: main's own mark, or your name among the requested. */
export function awaitsMyReview(pr: PullRequest, me: string | null | undefined): boolean {
  return !!pr.awaitingYou || (!!me && (pr.requestedReviewers ?? []).some((r) => same(r, me)))
}

/** The search's words, lowercased; `#482` searches for the number. */
export function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

/** Every word has to be somewhere: in the text, or — for a number — be the number. */
export function matchesQuery(pr: PullRequest, query: string): boolean {
  const terms = queryTerms(query)
  if (!terms.length) return true
  const hay = [pr.title, pr.body ?? '', pr.author, pr.sourceBranch, pr.targetBranch].join('\n').toLowerCase()
  return terms.every((term) => {
    const num = /^#?(\d+)$/.exec(term)
    if (num && Number(num[1]) === pr.id) return true
    // `#12` is a number, not text: it would otherwise match "#123" in a description.
    if (term.startsWith('#') && num) return false
    return hay.includes(term)
  })
}

/** A piece of text split where the search's words are, for <mark>. */
export interface TextPart {
  text: string
  hit: boolean
}

export function highlightParts(text: string, query: string): TextPart[] {
  const terms = queryTerms(query).filter((t) => !/^#\d+$/.test(t))
  if (!terms.length || !text) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const marked = new Array<boolean>(text.length).fill(false)
  for (const term of terms) {
    let at = lower.indexOf(term)
    while (at >= 0) {
      for (let i = at; i < at + term.length; i++) marked[i] = true
      at = lower.indexOf(term, at + term.length)
    }
  }
  const parts: TextPart[] = []
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1]
    if (last && last.hit === marked[i]) last.text += text[i]
    else parts.push({ text: text[i], hit: marked[i] })
  }
  return parts
}

/** Whether a PR passes every filter. */
export function matchesFilters(pr: PullRequest, f: PrListFilters, me: string | null | undefined): boolean {
  if (!matchesQuery(pr, f.query)) return false
  if (f.author === ME ? !isMine(pr, me) : f.author && !same(pr.author, f.author)) return false
  if (f.reviewer === ME) {
    if (!awaitsMyReview(pr, me)) return false
  } else if (f.reviewer && !(pr.requestedReviewers ?? []).some((r) => same(r, f.reviewer))) return false
  if (f.target && pr.targetBranch !== f.target) return false
  if (f.ciFailing && pr.ci !== 'failure') return false
  return true
}

/** The rows a tab shows, in the order the hosts gave them, most recent first
 *  where there is a time — the order ‹ › will walk. */
export function filterPrList(items: PrListItem[], tab: PrListTab, f: PrListFilters, me: string | null | undefined): PrListItem[] {
  const kept = items.filter((it) => prInTab(it.pr, tab) && matchesFilters(it.pr, f, me))
  // A stable sort: hosts without a time keep their own order.
  return kept
    .map((it, i) => ({ it, i, at: it.pr.updatedAt ? Date.parse(it.pr.updatedAt) : NaN }))
    .sort((a, b) => (Number.isNaN(a.at) || Number.isNaN(b.at) ? a.i - b.i : b.at - a.at || a.i - b.i))
    .map((x) => x.it)
}

/** The page size of the open list on the hosts that read only one page (see
 *  main's listPullRequestsOf). Azure DevOps, Data Center and Forgejo read all. */
export const OPEN_PAGE = 30

/** The open list may be cut short: a one-page host answered a full page. */
export function openListCapped(
  provider: HostingProvider,
  remoteUrl: string | undefined,
  prs: PullRequest[]
): boolean {
  const onePage =
    provider === 'github' || provider === 'gitlab' || (provider === 'bitbucket' && /bitbucket\.org[:/]/i.test(remoteUrl ?? ''))
  return onePage && prs.filter((p) => (p.state ?? 'open') === 'open').length >= OPEN_PAGE
}

/** How many PRs each tab holds. A tab not read yet (merged/closed) is null. */
export function tabCounts(open: PullRequest[], finished: PullRequest[] | null): Record<PrListTab, number | null> {
  return {
    open: open.filter((p) => prInTab(p, 'open')).length,
    drafts: open.filter((p) => prInTab(p, 'drafts')).length,
    merged: finished ? finished.filter((p) => prInTab(p, 'merged')).length : null,
    closed: finished ? finished.filter((p) => prInTab(p, 'closed')).length : null
  }
}

export interface Tally {
  value: string
  count: number
}

/** Values with how many PRs carry each, most first, then by name. */
function tally(values: string[]): Tally[] {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/** The author picker: everyone who wrote one of these, the signed-in account
 *  left out — it is the "Me" entry at the top instead. */
export function authorOptions(prs: PullRequest[], me: string | null | undefined): Tally[] {
  return tally(prs.map((p) => p.author)).filter((a) => !same(a.value, me))
}

export function reviewerOptions(prs: PullRequest[], me: string | null | undefined): Tally[] {
  return tally(prs.flatMap((p) => p.requestedReviewers ?? [])).filter((a) => !same(a.value, me))
}

export function targetOptions(prs: PullRequest[]): Tally[] {
  return tally(prs.map((p) => p.targetBranch))
}

export function hasActiveFilters(f: PrListFilters): boolean {
  return !!(f.query.trim() || f.author || f.reviewer || f.target || f.ciFailing)
}

/** The filters in words, as dictionary keys — `search "pix"`, `author: Me`. */
export function filterSummary(f: PrListFilters): { key: TranslationKey; vars: Record<string, string> }[] {
  const out: { key: TranslationKey; vars: Record<string, string> }[] = []
  if (f.query.trim()) out.push({ key: 'prList.sumSearch', vars: { query: f.query.trim() } })
  if (f.author === ME) out.push({ key: 'prList.sumAuthorMe', vars: {} })
  else if (f.author) out.push({ key: 'prList.sumAuthor', vars: { name: f.author } })
  if (f.reviewer === ME) out.push({ key: 'prList.sumReviewMe', vars: {} })
  else if (f.reviewer) out.push({ key: 'prList.sumReviewer', vars: { name: f.reviewer } })
  if (f.target) out.push({ key: 'prList.sumTarget', vars: { branch: f.target } })
  if (f.ciFailing) out.push({ key: 'prList.sumCiFailing', vars: {} })
  return out
}

/** The filters that apply here. One the page cannot show is dropped rather
 *  than left to empty the list with no visible way out: "me" while the account
 *  is unknown, and "CI failing" on Merged/Closed, whose checks are not read
 *  (its chip is hidden there). */
export function effectiveFilters(f: PrListFilters, me: string | null | undefined, tab: PrListTab = 'open'): PrListFilters {
  const dropCi = f.ciFailing && (tab === 'merged' || tab === 'closed')
  const dropMe = !me && (f.author === ME || f.reviewer === ME)
  if (!dropCi && !dropMe) return f
  return {
    ...f,
    ...(dropMe ? { author: f.author === ME ? '' : f.author, reviewer: f.reviewer === ME ? '' : f.reviewer } : {}),
    ...(dropCi ? { ciFailing: false } : {})
  }
}

// ── ‹ › in the PR detail header ─────────────────────────────────────────────

/** One stop on the walk: enough to open the PR and to name it in a tooltip. */
export interface PrNavEntry {
  number: number
  title: string
  remoteUrl: string
}

export interface PrNavPosition {
  /** Zero-based. */
  index: number
  total: number
  prev: PrNavEntry | null
  next: PrNavEntry | null
}

/** Where a PR sits in a walk, or null when it is not on it. No wrap-around:
 *  the last one says it is the last. */
export function prNavPosition(entries: PrNavEntry[], number: number, remoteUrl: string): PrNavPosition | null {
  const index = entries.findIndex((e) => e.number === number && e.remoteUrl === remoteUrl)
  if (index < 0) return null
  return {
    index,
    total: entries.length,
    prev: index > 0 ? entries[index - 1] : null,
    next: index < entries.length - 1 ? entries[index + 1] : null
  }
}

/** The filtered list a PR was opened from, frozen at that click. */
export interface PrListNav {
  entries: PrNavEntry[]
  filters: PrListFilters
  tab: PrListTab
}

/** The open PRs in the list page's default order (no filters, the Open tab). */
export function defaultNavEntries(items: PrListItem[]): PrNavEntry[] {
  return filterPrList(items, 'open', EMPTY_FILTERS, null).map((it) => ({
    number: it.pr.id,
    title: it.pr.title,
    remoteUrl: it.remoteUrl
  }))
}

/**
 * The walk a PR page follows. Opened from the list page (`via: 'list'`) and
 * still on the list it was opened from: that list, in its order. Anything
 * else — the sidebar, a notification, a restart that forgot the list — walks
 * the repository's open PRs in the list page's default order. `position` is
 * null when the PR is on neither (a merged level of a stack, say): no arrows.
 */
export function resolvePrNav(
  page: { number: number; remoteUrl: string; via?: 'list' },
  listNav: PrListNav | undefined,
  openItems: PrListItem[]
): { entries: PrNavEntry[]; fromList: PrListNav | null; position: PrNavPosition | null } {
  if (page.via === 'list' && listNav) {
    const position = prNavPosition(listNav.entries, page.number, page.remoteUrl)
    if (position) return { entries: listNav.entries, fromList: listNav, position }
  }
  const entries = defaultNavEntries(openItems)
  return { entries, fromList: null, position: prNavPosition(entries, page.number, page.remoteUrl) }
}
