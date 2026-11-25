import type { PageContent, TabState } from '../../../shared/types'

/**
 * Deciding whether a page rides on a repository's tab or takes one of its own.
 *
 * A page that belongs to a repository — DevTools, the wiki, insights — is shown
 * as an icon on that repository's tab instead of claiming a top-level one. When
 * there is no such tab (the repo is only open inside a group, or is not open at
 * all) the page falls back to a tab of its own: opening something must always
 * open something.
 */

/** Page kinds that ride on their repository's tab. Everything else stands alone.
 *  A pull request rides too — on the repo's tab, or its chip inside a group —
 *  unless it is explicitly opened in a tab of its own. */
export const ATTACHED_PAGES = new Set(['devtools', 'wiki', 'insights', 'ci-runs', 'pr', 'pull-requests'])

/** Two attached pages are "the same" when they address the same thing: one wiki
 *  per repo, one DevTools per launch session. */
export function samePage(a: PageContent, b: PageContent): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'devtools' && b.type === 'devtools') return a.launchId === b.launchId
  // Several pull requests can be open on one repository: each is its own page.
  if (a.type === 'pr' && b.type === 'pr') return a.number === b.number && a.remoteUrl === b.remoteUrl
  return 'repoPath' in a && 'repoPath' in b ? a.repoPath === b.repoPath : true
}

export interface AttachPlan {
  tabId: string
  /** The tab's page list with this page added or replaced in place. */
  pages: PageContent[]
  /** Index of the page to show. */
  index: number
  /** For a group tab: the repository whose chip must be the selected one, or
   *  its icons would be hidden the moment they appeared. */
  activeRepoPath?: string
}

/**
 * Where `page` should attach, or null when it should open as its own tab.
 * The active tab wins when it holds the repository, so opening DevTools from a
 * repo you are looking at does not jump you to a different tab of the same repo.
 */
export function planAttach(tabs: TabState[], activeTabId: string | null, page: PageContent): AttachPlan | null {
  if (!ATTACHED_PAGES.has(page.type) || !('repoPath' in page)) return null
  // A group tab holds repositories just as much as a repo tab does — most
  // people keep their repos filed in groups, and a page that skipped them would
  // land in a tab of its own, far from the repository it belongs to.
  const holds = (tab: TabState): boolean =>
    (tab.kind === 'repo' || tab.kind === 'group') && tab.repos.some((r) => r.path === page.repoPath)
  const active = tabs.find((t) => t.id === activeTabId)
  const host = active && holds(active) ? active : tabs.find(holds)
  if (!host || (host.kind !== 'repo' && host.kind !== 'group')) return null

  const pages = host.pages ?? []
  const existing = pages.findIndex((p) => samePage(p, page))
  // Re-opening replaces in place: a DevTools address changes between runs, and
  // the icon should follow it rather than multiply.
  const next = existing >= 0 ? pages.map((p, i) => (i === existing ? page : p)) : [...pages, page]
  return {
    tabId: host.id,
    pages: next,
    index: existing >= 0 ? existing : next.length - 1,
    ...(host.kind === 'group' ? { activeRepoPath: page.repoPath } : {})
  }
}

/** Closing one page: the list without it, and what to show afterwards. */
export function planClose(
  pages: PageContent[],
  activePage: number | null | undefined,
  index: number
): { pages: PageContent[]; activePage: number | null } {
  const next = pages.filter((_, i) => i !== index)
  if (!next.length) return { pages: next, activePage: null }
  // Closing what you were looking at drops you back on the repository, not on
  // whichever neighbour happens to shift into its place.
  if (activePage == null || activePage === index) return { pages: next, activePage: null }
  return { pages: next, activePage: activePage > index ? activePage - 1 : activePage }
}

/** The pages on a tab that belong to one repository, with their real indices —
 *  a group's list is flat, but each chip only shows its own. */
export function pagesForRepo(
  pages: PageContent[] | undefined,
  repoPath: string
): { page: PageContent; index: number }[] {
  return (pages ?? [])
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => 'repoPath' in page && page.repoPath === repoPath)
}

/**
 * One page swapped for another where it stands — the PR detail's ‹ › moving to
 * the next pull request without leaving a trail of PR icons. If the new page is
 * already open on the same tab, the old one closes and the existing one shows,
 * so the same PR is never on a tab twice. Null when `from` is not on this list.
 */
export function planReplace(
  pages: PageContent[],
  activePage: number | null | undefined,
  from: PageContent,
  to: PageContent
): { pages: PageContent[]; activePage: number | null } | null {
  const at = pages.findIndex((p) => samePage(p, from))
  if (at < 0) return null
  const dup = pages.findIndex((p, i) => i !== at && samePage(p, to))
  if (dup < 0) return { pages: pages.map((p, i) => (i === at ? to : p)), activePage: activePage === at ? at : (activePage ?? null) }
  const next = pages.filter((_, i) => i !== at).map((p) => (samePage(p, to) ? to : p))
  const shift = (i: number): number => (i > at ? i - 1 : i)
  // The one being looked at moves on to the PR it was replaced by.
  return { pages: next, activePage: activePage === at ? shift(dup) : activePage == null ? null : shift(activePage) }
}
