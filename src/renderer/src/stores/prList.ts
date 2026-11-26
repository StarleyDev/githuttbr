// The pull requests page's session state, per repository: which tab and which
// filters, the merged/closed list once read, and the walk the PR detail's ‹ ›
// follow. Deliberately not saved to settings: a triage filter ("mine, CI
// failing") from last week, restored silently, would hide PRs nobody asked to
// hide. It lives as long as the app runs.
import { create } from 'zustand'
import type { FinishedPullRequests, PageContent } from '../../../shared/types'
import { hostingApi } from '../infrastructure/api'
import {
  EMPTY_FILTERS,
  prListItems,
  resolvePrNav,
  type PrListFilters,
  type PrListNav,
  type PrListTab,
  type PrNavEntry
} from '../lib/prList'
import { enterpriseBasesOf, prRemoteIdentity } from '../lib/hosting'
import { useRepoStore } from './repo'
import { useSettingsStore } from './settings'

export interface PrListView {
  tab: PrListTab
  filters: PrListFilters
}

export const DEFAULT_VIEW: PrListView = Object.freeze({ tab: 'open', filters: EMPTY_FILTERS })

export type FinishedLoad =
  | { status: 'loading'; remoteUrl: string; data?: FinishedPullRequests }
  | { status: 'ready'; remoteUrl: string; data: FinishedPullRequests }
  | { status: 'error'; remoteUrl: string; error: string; data?: FinishedPullRequests }

interface PrListState {
  views: Record<string, PrListView>
  navs: Record<string, PrListNav>
  finished: Record<string, FinishedLoad>
  setTab(repoPath: string, tab: PrListTab): void
  setFilters(repoPath: string, patch: Partial<PrListFilters>): void
  clearFilters(repoPath: string): void
  rememberNav(repoPath: string, nav: PrListNav): void
  /** Read the merged and closed PRs; `force` asks again even when they are in. */
  loadFinished(repoPath: string, force?: boolean): Promise<void>
}

const viewOf = (s: PrListState, repoPath: string): PrListView => s.views[repoPath] ?? DEFAULT_VIEW

export const usePrListStore = create<PrListState>((set, get) => ({
  views: {},
  navs: {},
  finished: {},

  setTab: (repoPath, tab) => set((s) => ({ views: { ...s.views, [repoPath]: { ...viewOf(s, repoPath), tab } } })),

  setFilters: (repoPath, patch) =>
    set((s) => {
      const view = viewOf(s, repoPath)
      return { views: { ...s.views, [repoPath]: { ...view, filters: { ...view.filters, ...patch } } } }
    }),

  clearFilters: (repoPath) =>
    set((s) => ({ views: { ...s.views, [repoPath]: { ...viewOf(s, repoPath), filters: EMPTY_FILTERS } } })),

  rememberNav: (repoPath, nav) => set((s) => ({ navs: { ...s.navs, [repoPath]: nav } })),

  loadFinished: async (repoPath, force) => {
    const repo = useRepoStore.getState().repos[repoPath]
    const origin = repo?.remotes.find((r) => r.name === 'origin') ?? repo?.remotes[0]
    if (!origin) return
    const remoteUrl = prRemoteIdentity(origin.url)
    const cur = get().finished[repoPath]
    if (cur && cur.remoteUrl === remoteUrl && (cur.status === 'loading' || (cur.status === 'ready' && !force))) return
    const keep = cur?.remoteUrl === remoteUrl ? cur.data : undefined
    const loading: FinishedLoad = { status: 'loading', remoteUrl, data: keep }
    set((s) => ({ finished: { ...s.finished, [repoPath]: loading } }))
    // Only the request that is still the current one may write its answer: a
    // forgetFinished (a merge) or a newer load in between wins.
    const current = (): boolean => get().finished[repoPath] === loading
    const profile = useSettingsStore.getState().activeProfile()
    try {
      const data = await hostingApi.listFinishedPRs(repoPath, origin.url, {
        github: profile.githubToken || undefined,
        azure: profile.azureToken || undefined,
        gitlab: profile.gitlabToken || undefined,
        bitbucket: profile.bitbucketToken || undefined,
        forgejo: profile.forgejoToken || undefined
      })
      if (!current()) return
      set((s) => ({ finished: { ...s.finished, [repoPath]: { status: 'ready', remoteUrl, data } } }))
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      if (!current()) return
      set((s) => ({ finished: { ...s.finished, [repoPath]: { status: 'error', remoteUrl, error, data: keep } } }))
    }
  }
}))

type PrPage = Extract<PageContent, { type: 'pr' }>

/** The walk a PR page follows right now — see resolvePrNav. */
export function currentPrNav(page: PrPage): ReturnType<typeof resolvePrNav> {
  const repo = useRepoStore.getState().repos[page.repoPath]
  const enterprise = enterpriseBasesOf(useSettingsStore.getState().settings.profiles)
  const items = repo ? prListItems(repo.prs, repo.upstreamPrs, repo.remotes, enterprise) : []
  return resolvePrNav(page, usePrListStore.getState().navs[page.repoPath], items)
}

/** Open a PR from the list page: the walk is remembered, and the PR replaces
 *  the one the list opened before rather than adding an icon per click. */
export function openPrFromList(repoPath: string, entry: PrNavEntry, nav: PrListNav): void {
  usePrListStore.getState().rememberNav(repoPath, nav)
  const page: PrPage = { type: 'pr', repoPath, remoteUrl: entry.remoteUrl, number: entry.number, title: entry.title, via: 'list' }
  const settings = useSettingsStore.getState()
  const previous = findListPrPage(repoPath)
  if (previous) settings.replaceOpenPage(previous, page)
  settings.openPageTab(page)
}

/** A PR page this repository's list opened earlier, if one is still open. */
function findListPrPage(repoPath: string): PrPage | null {
  for (const tab of useSettingsStore.getState().settings.tabs) {
    const pages = tab.kind === 'page' ? [tab.page] : (tab.pages ?? [])
    for (const p of pages) if (p.type === 'pr' && p.via === 'list' && p.repoPath === repoPath) return p
  }
  return null
}

/** Move the PR page one step along its walk. False when there is no step. */
export function stepPr(page: PrPage, dir: -1 | 1): boolean {
  const pos = currentPrNav(page).position
  const target = pos ? (dir < 0 ? pos.prev : pos.next) : null
  if (!target) return false
  const go = (): void => {
    // The page remounts on the new PR: its strip takes the focus back (PrNavBar).
    pendingFocus = dir
    useSettingsStore.getState().replaceOpenPage(page, {
      ...page,
      remoteUrl: target.remoteUrl,
      number: target.number,
      title: target.title
    })
  }
  // Moving on unmounts the page, but its unsent text stays with this PR
  // (lib/prViewState.ts) and is back in its boxes on the way back: no question.
  go()
  return true
}

/** Which arrow moved us, so the new page's strip can put the focus back on it. */
let pendingFocus: -1 | 1 | null = null
export function takePendingFocus(): -1 | 1 | null {
  const dir = pendingFocus
  pendingFocus = null
  return dir
}

/** Merged or closed lists are stale once a PR is merged or closed from the app. */
export function forgetFinished(repoPath: string): void {
  usePrListStore.setState((s) => {
    if (!s.finished[repoPath]) return s
    const finished = { ...s.finished }
    delete finished[repoPath]
    return { finished }
  })
}

/** The PR page the active tab is showing, if any — for Alt+← / Alt+→. */
export function activePrPage(): PrPage | null {
  const st = useSettingsStore.getState().settings
  const tab = st.tabs.find((t) => t.id === st.activeTabId)
  if (!tab) return null
  const page = tab.kind === 'page' ? tab.page : tab.activePage != null ? tab.pages?.[tab.activePage] : undefined
  return page?.type === 'pr' ? page : null
}
