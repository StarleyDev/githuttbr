import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, GitPullRequest, Loader2, Plus, RefreshCw } from 'lucide-react'
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
import { countCiFailing, getPrTriage } from '../lib/prListRow'
import { withPrFileCounts } from '../lib/prFileCounts'
import { bitbucketServerBasesOf, enterpriseBasesOf, prRemoteIdentity, repoSupportsPrReview } from '../lib/hosting'
import { NO_ITEMS } from '../lib/stableEmpty'
import { readableError } from '../lib/gitErrorHint'
import { PageHead } from './PageHead'
import { PrListRow } from './PrListRow'
import { usePrFileCounts } from './usePrFileCounts'

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
export function PullRequestsPage({
  repoPath,
  fromMission = false
}: {
  repoPath: string
  /** Opened from Mission Control: the page offers the way back. */
  fromMission?: boolean
}): React.JSX.Element {
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
  // Subscribed, so a row's "new" dot clears the moment its PR page is left.
  const visits = useSettingsStore((s) => s.settings.prVisits)
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
  // A list read for another origin (the remote was changed since) is not this
  // one's: everything below reads `finishedHere`, never the raw entry.
  const originId = origin ? prRemoteIdentity(origin.url) : ''
  const finishedHere = finished && originId && finished.remoteUrl === originId ? finished : undefined
  const finishedItems = useMemo<PrListItem[]>(
    () => (finishedHere?.data ? finishedHere.data.prs.map((pr) => ({ pr, remoteUrl: originId })) : []),
    [finishedHere, originId]
  )

  // The checks of heads the list came without (GitLab, Azure DevOps, Forgejo
  // carry none), asked through the cache the graph's badges use. Tied to the
  // list they were read for: a new list — Refresh, or the periodic PR refresh —
  // starts over, so a "running" head is asked again (main's cache keeps that
  // cheap). A head the host said nothing about is simply not shown: "no checks"
  // and "rate-limited" look the same from here, so neither is remembered.
  // The badges themselves outlive a refresh: what the last list showed stays
  // until the new answer for that head arrives, so nothing flashes.
  const [ci, setCi] = useState<{ of: PullRequest[]; map: Record<string, CiStatus> }>({ of: NO_ITEMS, map: {} })
  const asked = useRef<{ of: PullRequest[]; shas: Set<string>; answered: Set<string> }>({
    of: NO_ITEMS,
    shas: new Set(),
    answered: new Set()
  })
  const ciMap = ci.map
  useEffect(() => {
    // GitHub and Bitbucket Data Center lists already carry their checks.
    if (!origin || (provider !== 'gitlab' && provider !== 'azure' && provider !== 'forgejo')) return
    if (asked.current.of !== prs) asked.current = { of: prs, shas: new Set(), answered: new Set() }
    const round = asked.current
    const shas = [
      ...new Set(
        openItems
          .filter((it) => !it.upstream && !it.pr.ci && it.pr.headSha && !round.shas.has(it.pr.headSha))
          .map((it) => it.pr.headSha as string)
      )
    ]
    if (!shas.length) return
    for (const sha of shas) round.shas.add(sha)
    const inList = new Set(openItems.map((it) => it.pr.headSha).filter((sha): sha is string => !!sha))
    let alive = true
    void (async () => {
      // Main answers at most CI_BATCH heads per call; more would be dropped unasked.
      for (let i = 0; i < shas.length && alive; i += CI_BATCH) {
        const found = await hostingApi
          .ciStatuses(repoPath, origin.url, shas.slice(i, i + CI_BATCH), githubToken ?? '')
          .catch(() => ({}) as Record<string, CiStatus>)
        if (!alive || !Object.keys(found).length) continue
        for (const sha of Object.keys(found)) round.answered.add(sha)
        setCi((cur) => {
          // A new list keeps the old badges of heads still in it, and drops the rest.
          const kept =
            cur.of === prs ? cur.map : Object.fromEntries(Object.entries(cur.map).filter(([sha]) => inList.has(sha)))
          return { of: prs, map: { ...kept, ...found } }
        })
      }
    })()
    return () => {
      alive = false
      // Unmounted or re-run mid-way: what was not answered may be asked again.
      for (const sha of shas) if (!round.answered.has(sha)) round.shas.delete(sha)
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
  const missing = !finishedHere
  useEffect(() => {
    if (finishedTab && repoLoaded) void loadFinished(repoPath)
    // `missing`: a merge dropped the list (forgetFinished) while this tab was open.
  }, [finishedTab, repoLoaded, repoPath, loadFinished, originId, missing])

  const items = finishedTab ? finishedItems : withCi
  const inTab = useMemo(() => items.filter((it) => prInTab(it.pr, tab)), [items, tab])
  const filters = useMemo(() => effectiveFilters(view.filters, me, view.tab), [view.filters, me, view.tab])
  const filtered = useMemo(() => filterPrList(items, tab, filters, me), [items, tab, filters, me])
  // Azure DevOps lists no size: the drawn rows' file counts are read from here
  // alone (never with the sidebar's refresh) and joined in as they arrive.
  // Open and draft rows only: size is what a reviewer weighs, and a full merged or
  // closed list would cost hundreds of host calls the first time it opens.
  const azure = provider === 'azure' && !finishedTab
  const fileCounts = usePrFileCounts(repoPath, origin?.url, azure, filtered)
  const rows = useMemo(() => withPrFileCounts(filtered, fileCounts), [filtered, fileCounts])
  const counts = useMemo(
    () => tabCounts(openItems.map((it) => it.pr), finishedHere?.data ? finishedHere.data.prs : null),
    [openItems, finishedHere]
  )
  // GitHub, GitLab and bitbucket.org lists stop at their first page: a full one may hide more.
  const openCapped = useMemo(() => openListCapped(provider, origin?.url, prs), [provider, origin, prs])
  const tabPrs = useMemo(() => inTab.map((it) => it.pr), [inTab])
  const authors = useMemo(() => authorOptions(tabPrs, me), [tabPrs, me])
  const reviewers = useMemo(() => reviewerOptions(tabPrs, me), [tabPrs, me])
  const targets = useMemo(() => targetOptions(tabPrs), [tabPrs])
  const mine = useMemo(() => tabPrs.filter((p) => isMine(p, me)).length, [tabPrs, me])
  const awaiting = useMemo(() => tabPrs.filter((p) => awaitsMyReview(p, me)).length, [tabPrs, me])
  const ciFailing = useMemo(() => countCiFailing(tabPrs), [tabPrs])

  // Open and Drafts are triaged — what waits on you, yours, the rest; Merged and
  // Closed are history, one list. ‹ › walk the rows in the order they are drawn.
  const triage = useMemo(() => (finishedTab ? null : getPrTriage(rows, me)), [finishedTab, rows, me])
  const ordered = useMemo(
    () => (triage ? [...triage.awaiting, ...triage.mine, ...triage.others] : rows),
    [triage, rows]
  )
  const [othersOpen, setOthersOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

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
        entries: ordered.map((r) => ({ number: r.pr.id, title: r.pr.title, remoteUrl: r.remoteUrl })),
        filters,
        tab
      },
      fromMission ? 'mission' : undefined
    )
  }

  const active = hasActiveFilters(filters)
  const summary = filterSummary(filters)
    .map((p) => interp(t(p.key), p.vars))
    .join(', ')
  const repoName = repoPath.split(/[\\/]/).pop() ?? repoPath
  // The pickers that live behind "More filters": lit while one of them narrows the list.
  const morePicked = (!!filters.author && filters.author !== ME) || (!!filters.reviewer && filters.reviewer !== ME) || !!filters.target

  // Tabs and filters need a remote to list from: same gate as the list below.
  const ready = repoLoaded && !!origin

  const renderCard = (list: PrListItem[]): React.JSX.Element => (
    <ul className="prl-card" aria-label={t('prList.title')}>
      {list.map((it) => (
        <li key={`${it.remoteUrl}#${it.pr.id}`}>
          <PrListRow item={it} query={filters.query} me={me} now={now} visits={visits} onOpen={() => open(it)} />
        </li>
      ))}
    </ul>
  )

  // "Others" folds away while there is something more pressing above it; a
  // search or a filter shows everything it kept.
  const triaged = !!triage && (triage.awaiting.length > 0 || triage.mine.length > 0)
  const othersShown = !triaged || active || othersOpen

  return (
    <div className="changelog-page prl-page">
      <div className="changelog-inner">
        <PageHead>
          {fromMission && (
            <button className="prl-back" onClick={() => useUIStore.getState().setMissionOpen(true)}>
              <span aria-hidden="true">←</span> {t('prList.backToMission')}
            </button>
          )}
          <header className="prl-header">
            <GitPullRequest size={22} className="prl-header-icon" />
            <div className="prl-header-title">
              <h1>{t('prList.title')}</h1>
              <span className="prl-header-sub">
                {/* i18n-ignore repository and product names are data */}
                {provider ? `${repoName} · ${PROVIDER_NAME[provider]}` : repoName}
              </span>
            </div>
            <span className="prl-header-gap" />
            <button className="prl-btn" onClick={refresh} title={t('prList.refresh')}>
              {finishedHere?.status === 'loading' && <RefreshCw size={12} className="spin" />}
              {t('prList.refresh')}
            </button>
            <button className="prl-btn primary" onClick={() => openModal({ kind: 'create-pr', repoPath })}>
              <Plus size={13} /> {t('prList.newPr')}
            </button>
          </header>
          {ready && (
            <div className="prl-controls">
              <div className="prl-seg" role="tablist" aria-label={t('prList.title')}>
                {PR_LIST_TABS.map((id) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={`prl-seg-btn ${tab === id ? 'active' : ''}`}
                    onClick={() => setTab(repoPath, id)}
                  >
                    {t(TAB_KEY[id])}
                    {counts[id] !== null && (
                      <span className="prl-seg-count">
                        {counts[id]}
                        {((id === 'merged' || id === 'closed') && finishedHere?.data?.truncated) || (id === 'open' && openCapped)
                          ? '+'
                          : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <label className="prl-search">
                <span className="prl-sr">{t('prList.search')}</span>
                <input
                  type="search"
                  value={view.filters.query}
                  placeholder={t('prList.searchFull')}
                  onChange={(e) => setFilters(repoPath, { query: e.target.value })}
                />
              </label>
              {me && (
                <button
                  className={`prl-chip prl-chip-awaiting ${filters.reviewer === ME ? 'active' : ''}`}
                  aria-pressed={filters.reviewer === ME}
                  onClick={() => setFilters(repoPath, { reviewer: filters.reviewer === ME ? '' : ME })}
                >
                  {t('prList.chipAwaiting')} <span className="prl-chip-count">{awaiting}</span>
                </button>
              )}
              {me && (
                <button
                  className={`prl-chip ${filters.author === ME ? 'active' : ''}`}
                  aria-pressed={filters.author === ME}
                  onClick={() => setFilters(repoPath, { author: filters.author === ME ? '' : ME })}
                >
                  {t('prList.chipMine')} <span className="prl-chip-count">{mine}</span>
                </button>
              )}
              {!finishedTab && (
                <button
                  className={`prl-chip ${filters.ciFailing ? 'active' : ''}`}
                  aria-pressed={filters.ciFailing}
                  onClick={() => setFilters(repoPath, { ciFailing: !filters.ciFailing })}
                >
                  {t('prList.chipCiFailing')} <span className="prl-chip-count">{ciFailing}</span>
                </button>
              )}
              <div className="prl-more">
                <button
                  className={`prl-chip ${morePicked || moreOpen ? 'active' : ''}`}
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  {t('prList.moreFilters')} <ChevronDown size={12} />
                </button>
                {moreOpen && (
                  <MoreFilters onClose={() => setMoreOpen(false)}>
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
                  </MoreFilters>
                )}
              </div>
            </div>
          )}
        </PageHead>

        {!repoLoaded ? (
          <div className="ci-runs-empty">
            <Loader2 size={15} className="spin" /> {t('common.loading')}
          </div>
        ) : !origin ? (
          <p className="ci-runs-empty">{t('prList.noRemote')}</p>
        ) : (
          <>
            {active && (
              <div className="prl-status" aria-live="polite">
                {interp(t('prList.shownOf'), { n: rows.length, total: inTab.length })}
                {summary && <> · {summary}</>}
                {' · '}
                <button className="prp-link" onClick={() => clearFilters(repoPath)}>
                  {t('prList.clearFilters')}
                </button>
              </div>
            )}

            {finishedTab && finishedHere?.status === 'error' && (
              <div className="ci-runs-error">
                {readableError(finishedHere.error, t, interp)}{' '}
                <button className="prp-link" onClick={() => void loadFinished(repoPath, true)}>
                  {t('prList.retry')}
                </button>
              </div>
            )}
            {finishedTab && finishedHere?.data?.truncated && (
              <p className="prl-note">{interp(t('prList.truncated'), { n: finishedHere.data.prs.length })}</p>
            )}

            {finishedTab && !finishedHere?.data && finishedHere?.status !== 'error' ? (
              <div className="ci-runs-empty">
                <Loader2 size={15} className="spin" /> {t('prList.loadingFinished')}
              </div>
            ) : rows.length === 0 ? (
              <p className="ci-runs-empty">
                {active ? t('prList.noMatches') : !finishedTab && !provider ? t('prList.noHost') : t('prList.empty')}
              </p>
            ) : triage && triaged ? (
              <div className="prl-sections">
                {triage.awaiting.length > 0 && (
                  <section>
                    <h2 className="prl-section prl-section-awaiting">
                      {interp(t('prList.sectionAwaiting'), { n: triage.awaiting.length })}
                    </h2>
                    {renderCard(triage.awaiting)}
                  </section>
                )}
                {triage.mine.length > 0 && (
                  <section>
                    <h2 className="prl-section">{interp(t('prList.sectionMine'), { n: triage.mine.length })}</h2>
                    {renderCard(triage.mine)}
                  </section>
                )}
                {triage.others.length > 0 && (
                  <section>
                    <h2 className="prl-section">
                      {interp(t('prList.sectionOthers'), { n: triage.others.length })}
                      {!active && (
                        <button className="prl-section-toggle" aria-expanded={othersShown} onClick={() => setOthersOpen((v) => !v)}>
                          {othersShown ? t('prList.sectionHide') : t('prList.sectionShow')}
                        </button>
                      )}
                    </h2>
                    {othersShown && renderCard(triage.others)}
                  </section>
                )}
              </div>
            ) : (
              <div className="prl-sections">{renderCard(ordered)}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** The author, reviewer and target pickers, under "More filters". Closes on
 *  Escape or a click anywhere else. */
function MoreFilters({ onClose, children }: { onClose: () => void; children: React.ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const box = ref.current
      // The toggle button sits beside the panel: its own click closes it.
      if (box && !box.parentElement?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div ref={ref} className="prl-more-panel">
      {children}
    </div>
  )
}

/** How many heads one ciStatuses call answers — main reads no more per call. */
const CI_BATCH = 40
