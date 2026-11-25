import { useEffect, useMemo, useRef, useState } from 'react'
import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft, Loader2, Plus, RefreshCw } from 'lucide-react'
import type { CiStatus, HostingProvider, PullRequest } from '../../../shared/types'
import { countChecks } from '../../../shared/ciSummary'
import { gitlabServerBases } from '../../../shared/gitlabInstance'
import { hostingApi, shellApi } from '../infrastructure/api'
import { useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { DEFAULT_VIEW, openPrFromList, usePrListStore } from '../stores/prList'
import { interp, useT, type TranslationKey } from '../i18n'
import {
  ME,
  authorOptions,
  awaitsMyReview,
  effectiveFilters,
  filterPrList,
  filterSummary,
  hasActiveFilters,
  openListCapped,
  highlightParts,
  isMine,
  prInTab,
  prListItems,
  reviewerOptions,
  tabCounts,
  targetOptions,
  PR_LIST_TABS,
  type PrListItem,
  type PrListTab
} from '../lib/prList'
import { bitbucketServerBasesOf, enterpriseBasesOf, prRemoteIdentity, repoSupportsPrReview } from '../lib/hosting'
import { NO_ITEMS } from '../lib/stableEmpty'
import { timeAgo } from '../lib/timeAgo'
import { readableError } from '../lib/gitErrorHint'
import { ciIcon, ciTitle } from './CiIcon'
import { HostUserAvatar } from './HostUserAvatar'

const TAB_KEY: Record<PrListTab, TranslationKey> = {
  open: 'prList.tabOpen',
  drafts: 'prList.tabDrafts',
  merged: 'prList.tabMerged',
  closed: 'prList.tabClosed'
}

// Product names: the same in every language.
const PROVIDER_NAME: Record<Exclude<HostingProvider, null>, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  azure: 'Azure DevOps',
  forgejo: 'Forgejo'
}

/**
 * Every pull request of a repository on one page: by state, filtered by who
 * wrote it, who has to review it, where it goes and whether its CI failed —
 * the question "which of these nineteen is mine, and which wait on me" answered
 * without opening each one. A row opens the PR's own page, whose ‹ › walk this
 * filtered list.
 */
export function PullRequestsPage({ repoPath }: { repoPath: string }): React.JSX.Element {
  const t = useT()
  const openModal = useUIStore((s) => s.openModal)
  const repoLoaded = useRepoStore((s) => !!s.repos[repoPath])
  const remotes = useRepoStore((s) => s.repos[repoPath]?.remotes) ?? NO_ITEMS
  const prs = useRepoStore((s) => s.repos[repoPath]?.prs) ?? NO_ITEMS
  const upstreamPrs = useRepoStore((s) => s.repos[repoPath]?.upstreamPrs) ?? NO_ITEMS
  const provider = useRepoStore((s) => s.repos[repoPath]?.prProvider ?? null)
  const me = useRepoStore((s) => s.repos[repoPath]?.prViewer ?? null)
  const refreshPRs = useRepoStore((s) => s.refreshPRs)
  const profiles = useSettingsStore((s) => s.settings.profiles)
  const githubToken = useSettingsStore((s) => s.activeProfile().githubToken)
  const view = usePrListStore((s) => s.views[repoPath]) ?? DEFAULT_VIEW
  const finished = usePrListStore((s) => s.finished[repoPath])
  const { setTab, setFilters, clearFilters, loadFinished } = usePrListStore.getState()

  const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
  const enterprise = useMemo(() => enterpriseBasesOf(profiles), [profiles])
  // Rich PR pages exist for these hosts; anywhere else a row opens the browser.
  const reviewable = useMemo(
    () =>
      repoSupportsPrReview(
        remotes,
        gitlabServerBases(profiles),
        profiles.map((p) => p.forgejoUrl?.trim() ?? '').filter(Boolean),
        enterprise,
        bitbucketServerBasesOf(profiles)
      ),
    [remotes, profiles, enterprise]
  )

  const openItems = useMemo(() => prListItems(prs, upstreamPrs, remotes, enterprise), [prs, upstreamPrs, remotes, enterprise])
  const finishedItems = useMemo<PrListItem[]>(
    () => {
      // A list read for another origin (the remote was changed since) is not this one's.
      const remoteUrl = origin ? prRemoteIdentity(origin.url) : ''
      if (!finished?.data || !origin || finished.remoteUrl !== remoteUrl) return []
      return finished.data.prs.map((pr) => ({ pr, remoteUrl }))
    },
    [finished, origin]
  )

  // The checks of heads the list came without (GitLab, Azure DevOps, Forgejo
  // carry none), asked through the cache the graph's badges use. Tied to the
  // list they were read for: a new list — Refresh, or the periodic PR refresh —
  // starts over, so a "running" head is asked again (main's cache keeps that
  // cheap). A head the host said nothing about is simply not shown: "no checks"
  // and "rate-limited" look the same from here, so neither is remembered.
  const [ci, setCi] = useState<{ of: PullRequest[]; map: Record<string, CiStatus> }>({ of: NO_ITEMS, map: {} })
  const asked = useRef<{ of: PullRequest[]; shas: Set<string> }>({ of: NO_ITEMS, shas: new Set() })
  const ciMap = ci.of === prs ? ci.map : NO_CI_MAP
  const ciMapRef = useRef(ciMap)
  ciMapRef.current = ciMap
  useEffect(() => {
    // GitHub and Bitbucket Data Center lists already carry their checks.
    if (!origin || (provider !== 'gitlab' && provider !== 'azure' && provider !== 'forgejo')) return
    if (asked.current.of !== prs) asked.current = { of: prs, shas: new Set() }
    const seen = asked.current.shas
    const shas = [
      ...new Set(
        openItems
          .filter((it) => !it.upstream && !it.pr.ci && it.pr.headSha && !seen.has(it.pr.headSha))
          .map((it) => it.pr.headSha as string)
      )
    ]
    if (!shas.length) return
    for (const sha of shas) seen.add(sha)
    let alive = true
    void (async () => {
      // Main answers at most CI_BATCH heads per call; more would be dropped unasked.
      for (let i = 0; i < shas.length && alive; i += CI_BATCH) {
        const found = await hostingApi
          .ciStatuses(repoPath, origin.url, shas.slice(i, i + CI_BATCH), githubToken ?? '')
          .catch(() => ({}) as Record<string, CiStatus>)
        if (!alive || !Object.keys(found).length) continue
        setCi((cur) => ({ of: prs, map: { ...(cur.of === prs ? cur.map : {}), ...found } }))
      }
    })()
    return () => {
      alive = false
      // Unmounted or re-run mid-way: what was not answered may be asked again.
      if (asked.current.of === prs) for (const sha of shas) if (!(sha in ciMapRef.current)) seen.delete(sha)
    }
  }, [openItems, origin, repoPath, githubToken, provider, prs])
  const withCi = useMemo<PrListItem[]>(
    () =>
      openItems.map((it) => {
        const status = it.pr.headSha && !it.pr.ci ? ciMap[it.pr.headSha] : undefined
        if (!status) return it
        return { ...it, pr: { ...it.pr, ci: status.state, ciCounts: countChecks(status) } }
      }),
    [openItems, ciMap]
  )

  const tab = view.tab
  const finishedTab = tab === 'merged' || tab === 'closed'
  useEffect(() => {
    if (finishedTab && repoLoaded) void loadFinished(repoPath)
  }, [finishedTab, repoLoaded, repoPath, loadFinished])

  const items = finishedTab ? finishedItems : withCi
  const inTab = useMemo(() => items.filter((it) => prInTab(it.pr, tab)), [items, tab])
  const filters = useMemo(() => effectiveFilters(view.filters, me, view.tab), [view.filters, me, view.tab])
  const rows = useMemo(() => filterPrList(items, tab, filters, me), [items, tab, filters, me])
  const counts = useMemo(
    () => tabCounts(openItems.map((it) => it.pr), finished?.data ? finished.data.prs : null),
    [openItems, finished]
  )
  // GitHub, GitLab and bitbucket.org lists stop at their first page: a full one may hide more.
  const openCapped = useMemo(() => openListCapped(provider, origin?.url, prs), [provider, origin, prs])
  const tabPrs = useMemo(() => inTab.map((it) => it.pr), [inTab])
  const authors = useMemo(() => authorOptions(tabPrs, me), [tabPrs, me])
  const reviewers = useMemo(() => reviewerOptions(tabPrs, me), [tabPrs, me])
  const targets = useMemo(() => targetOptions(tabPrs), [tabPrs])
  const mine = useMemo(() => tabPrs.filter((p) => isMine(p, me)).length, [tabPrs, me])
  const awaiting = useMemo(() => tabPrs.filter((p) => awaitsMyReview(p, me)).length, [tabPrs, me])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const refresh = (): void => {
    void refreshPRs(repoPath)
    if (finishedTab) void loadFinished(repoPath, true)
  }

  const open = (it: PrListItem): void => {
    if (!reviewable && !it.upstream) {
      void shellApi.openExternal(it.pr.url)
      return
    }
    openPrFromList(
      repoPath,
      { number: it.pr.id, title: it.pr.title, remoteUrl: it.remoteUrl },
      {
        entries: rows.map((r) => ({ number: r.pr.id, title: r.pr.title, remoteUrl: r.remoteUrl })),
        filters,
        tab
      }
    )
  }

  const active = hasActiveFilters(filters)
  const summary = filterSummary(filters)
    .map((p) => interp(t(p.key), p.vars))
    .join(', ')
  const repoName = repoPath.split(/[\\/]/).pop() ?? repoPath

  return (
    <div className="changelog-page prl-page">
      <div className="changelog-inner">
        <header className="prl-header">
          <div className="changelog-title">
            <GitPullRequest size={20} />
            <div>
              <h1>{t('prList.title')}</h1>
              <span className="settings-hint">
                {/* i18n-ignore repository and product names are data */}
                {provider ? `${repoName} · ${PROVIDER_NAME[provider]}` : repoName}
              </span>
            </div>
          </div>
          <div className="prl-header-actions">
            <button className="btn ghost small" onClick={refresh} title={t('prList.refresh')}>
              <RefreshCw size={13} className={finished?.status === 'loading' ? 'spin' : undefined} /> {t('prList.refresh')}
            </button>
            <button className="btn small" onClick={() => openModal({ kind: 'create-pr', repoPath })}>
              <Plus size={13} /> {t('prList.newPr')}
            </button>
          </div>
        </header>

        {!repoLoaded ? (
          <div className="ci-runs-empty">
            <Loader2 size={15} className="spin" /> {t('common.loading')}
          </div>
        ) : !origin ? (
          <p className="ci-runs-empty">{t('prList.noRemote')}</p>
        ) : (
          <>
            <nav className="prl-tabs" role="tablist" aria-label={t('prList.title')}>
              {PR_LIST_TABS.map((id) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={`prl-tab ${tab === id ? 'active' : ''}`}
                  onClick={() => setTab(repoPath, id)}
                >
                  {t(TAB_KEY[id])}
                  {counts[id] !== null && (
                    <span className="prl-tab-count">
                      {counts[id]}
                      {((id === 'merged' || id === 'closed') && finished?.data?.truncated) || (id === 'open' && openCapped)
                        ? '+'
                        : ''}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="prl-filters">
              <label className="prl-field prl-field-search">
                {t('prList.search')}
                <input
                  type="search"
                  value={view.filters.query}
                  placeholder={t('prList.searchPlaceholder')}
                  onChange={(e) => setFilters(repoPath, { query: e.target.value })}
                />
              </label>
              <label className="prl-field">
                {t('prList.author')}
                <select value={filters.author} onChange={(e) => setFilters(repoPath, { author: e.target.value })}>
                  <option value="">{t('prList.allAuthors')}</option>
                  {me && <option value={ME}>{interp(t('prList.meOption'), { name: me, n: mine })}</option>}
                  {authors.map((a) => (
                    <option key={a.value} value={a.value}>
                      {interp(t('prList.withCount'), { name: a.value, n: a.count })}
                    </option>
                  ))}
                  {/* A pick the current tab has nobody for stays selectable, or the select would lie. */}
                  {filters.author && filters.author !== ME && !authors.some((a) => a.value === filters.author) && (
                    <option value={filters.author}>{filters.author}</option>
                  )}
                </select>
              </label>
              <label className="prl-field">
                {t('prList.reviewer')}
                <select value={filters.reviewer} onChange={(e) => setFilters(repoPath, { reviewer: e.target.value })}>
                  <option value="">{t('prList.anyReviewer')}</option>
                  {me && <option value={ME}>{interp(t('prList.reviewMeOption'), { n: awaiting })}</option>}
                  {reviewers.map((a) => (
                    <option key={a.value} value={a.value}>
                      {interp(t('prList.withCount'), { name: a.value, n: a.count })}
                    </option>
                  ))}
                  {filters.reviewer && filters.reviewer !== ME && !reviewers.some((a) => a.value === filters.reviewer) && (
                    <option value={filters.reviewer}>{filters.reviewer}</option>
                  )}
                </select>
              </label>
              <label className="prl-field">
                {t('prList.target')}
                <select value={filters.target} onChange={(e) => setFilters(repoPath, { target: e.target.value })}>
                  <option value="">{t('prList.allTargets')}</option>
                  {targets.map((a) => (
                    <option key={a.value} value={a.value}>
                      {interp(t('prList.withCount'), { name: a.value, n: a.count })}
                    </option>
                  ))}
                  {filters.target && !targets.some((a) => a.value === filters.target) && (
                    <option value={filters.target}>{filters.target}</option>
                  )}
                </select>
              </label>
              <div className="prl-chips">
                {me && (
                  <button
                    className={`prl-chip ${filters.author === ME ? 'active' : ''}`}
                    aria-pressed={filters.author === ME}
                    onClick={() => setFilters(repoPath, { author: filters.author === ME ? '' : ME })}
                  >
                    {t('prList.chipMine')}
                  </button>
                )}
                {me && (
                  <button
                    className={`prl-chip ${filters.reviewer === ME ? 'active' : ''}`}
                    aria-pressed={filters.reviewer === ME}
                    onClick={() => setFilters(repoPath, { reviewer: filters.reviewer === ME ? '' : ME })}
                  >
                    {t('prList.chipAwaiting')}
                  </button>
                )}
                {!finishedTab && (
                  <button
                    className={`prl-chip ${filters.ciFailing ? 'active' : ''}`}
                    aria-pressed={filters.ciFailing}
                    onClick={() => setFilters(repoPath, { ciFailing: !filters.ciFailing })}
                  >
                    {t('prList.chipCiFailing')}
                  </button>
                )}
              </div>
            </div>

            <div className="prl-status" aria-live="polite">
              {active
                ? interp(t('prList.shownOf'), { n: rows.length, total: inTab.length })
                : interp(t('prList.shownAll'), { n: inTab.length })}
              {active && summary && <> · {summary}</>}
              {active && (
                <>
                  {' · '}
                  <button className="prp-link" onClick={() => clearFilters(repoPath)}>
                    {t('prList.clearFilters')}
                  </button>
                </>
              )}
            </div>

            {finishedTab && finished?.status === 'error' && (
              <div className="ci-runs-error">
                {readableError(finished.error, t, interp)}{' '}
                <button className="prp-link" onClick={() => void loadFinished(repoPath, true)}>
                  {t('prList.retry')}
                </button>
              </div>
            )}
            {finishedTab && finished?.data?.truncated && (
              <p className="prl-note">{interp(t('prList.truncated'), { n: finished.data.prs.length })}</p>
            )}

            {finishedTab && !finished?.data && finished?.status !== 'error' ? (
              <div className="ci-runs-empty">
                <Loader2 size={15} className="spin" /> {t('prList.loadingFinished')}
              </div>
            ) : rows.length === 0 ? (
              <p className="ci-runs-empty">
                {active ? t('prList.noMatches') : !finishedTab && !provider ? t('prList.noHost') : t('prList.empty')}
              </p>
            ) : (
              <div className="prl-table">
                {/* The column names are for the eye; each row's button names its PR. */}
                <div className="prl-row prl-head" aria-hidden="true">
                  <span>{t('prList.colNumber')}</span>
                  <span>{t('prList.colTitle')}</span>
                  <span>{t('prList.colAuthor')}</span>
                  <span>{t('prList.colBranches')}</span>
                  <span>{t('prList.colChecks')}</span>
                  <span>{t('prList.colUpdated')}</span>
                </div>
                <ul className="prl-list" aria-label={t('prList.title')}>
                  {rows.map((it) => (
                    <li key={`${it.remoteUrl}#${it.pr.id}`}>
                      <PrRow item={it} query={filters.query} me={me} now={now} onOpen={() => open(it)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {rows.length > 0 && reviewable && <p className="prl-note">{t('prList.hint')}</p>}
          </>
        )}
      </div>
    </div>
  )
}

/** How many heads one ciStatuses call answers — main reads no more per call. */
const CI_BATCH = 40
const NO_CI_MAP: Record<string, CiStatus> = Object.freeze({}) as Record<string, CiStatus>

function PrRow({
  item,
  query,
  me,
  now,
  onOpen
}: {
  item: PrListItem
  query: string
  me: string | null
  now: number
  onOpen: () => void
}): React.JSX.Element {
  const t = useT()
  const { pr } = item
  const mine = isMine(pr, me)
  const ago = pr.updatedAt ? timeAgo(Date.parse(pr.updatedAt), now) : null
  const waiting = pr.requestedReviewers ?? []
  return (
    <button className="prl-row" onClick={onOpen} title={`#${pr.id} ${pr.title}`}>
      <span className="prl-num">
        <StateIcon pr={pr} />#{pr.id}
      </span>
      <span className="prl-title">
        <span className="prl-title-text">
          {highlightParts(pr.title, query).map((part, i) => (part.hit ? <mark key={i} className="search-hit">{part.text}</mark> : part.text))}
          {pr.isDraft && (pr.state ?? 'open') === 'open' && <span className="prl-badge">{t('prList.draft')}</span>}
          {item.upstream && <span className="prl-badge">{interp(t('prList.onUpstream'), { repo: item.upstream })}</span>}
        </span>
        {waiting.length > 0 && (pr.state ?? 'open') === 'open' && (
          <span className={`prl-sub ${awaitsMyReview(pr, me) ? 'prl-sub-you' : ''}`}>
            {interp(t('prList.reviewRequested'), { names: waiting.join(', ') })}
          </span>
        )}
      </span>
      <span className="prl-author">
        <HostUserAvatar login={pr.author} url={pr.authorAvatar} size={20} />
        <span className="prl-author-name">{pr.author}</span>
        {mine && <span className="prl-you">{t('prList.you')}</span>}
      </span>
      <span className="prl-branches" title={`${pr.sourceBranch} → ${pr.targetBranch}`}>
        {/* i18n-ignore branch names around an arrow */}
        {`${pr.sourceBranch} → ${pr.targetBranch}`}
      </span>
      <span className="prl-ci" title={pr.ci ? ciTitle(pr.ci, pr.ciCounts, t) : undefined}>
        {pr.ci ? (
          <>
            {ciIcon(pr.ci, 13)}
            <CiShort pr={pr} />
          </>
        ) : (
          <span className="prl-muted">—</span>
        )}
      </span>
      <span className="prl-updated" title={pr.updatedAt ? new Date(pr.updatedAt).toLocaleString() : undefined}>
        {ago ? interp(t(ago.key), { n: ago.n }) : '—'}
      </span>
    </button>
  )
}

/** "6/6", "1 failed", "2 running" — the head's checks in a column's width. */
function CiShort({ pr }: { pr: PullRequest }): React.JSX.Element | null {
  const t = useT()
  const c = pr.ciCounts
  if (!c) return null
  // Skipped and cancelled checks are not owed: 4 of 6 with 2 skipped is all green.
  const total = c.passed + c.failed + c.pending + c.unknown
  if (pr.ci === 'failure') return <span className="ci-failure">{interp(t('ci.countFailed'), { n: c.failed })}</span>
  if (pr.ci === 'pending') return <span>{interp(t('ci.countPending'), { n: c.pending })}</span>
  return <span>{interp(t('prList.ciPassed'), { n: c.passed, total })}</span>
}

function StateIcon({ pr }: { pr: PullRequest }): React.JSX.Element {
  if (pr.state === 'merged') return <GitMerge size={13} className="prl-state merged" />
  if (pr.state === 'closed') return <GitPullRequestClosed size={13} className="prl-state closed" />
  if (pr.isDraft) return <GitPullRequestDraft size={13} className="prl-state draft" />
  return <GitPullRequest size={13} className="prl-state open" />
}
