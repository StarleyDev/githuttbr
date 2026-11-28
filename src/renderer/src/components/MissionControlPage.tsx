import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  ArrowUpFromLine,
  Archive,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Download,
  FileCheck,
  FileEdit,
  FilePlus,
  Gauge,
  GitPullRequest,
  Loader2,
  Tag
} from 'lucide-react'
import type { CiState, PullRequest, RepoDetail, RepoPulse } from '../../../shared/types'
import { isCustomReleaseTone, tabRepos } from '../../../shared/types'
import { gitApi, hostingApi } from '../infrastructure/api'
import { useSettingsStore } from '../stores/settings'
import { useRepoStore, repoActions } from '../stores/repo'
import { useUIStore } from '../stores/ui'
import {
  activityTotal,
  bulkTargets,
  hostingDue,
  hostingTotals,
  isFetchStale,
  missionRefreshMs,
  normalizeReleaseTiers,
  releaseNote,
  releaseTone,
  summarizePrs,
  type HostingSummary,
  OP_LABEL,
  staleFetchTargets,
  orderPulses,
  pulseTotals,
  pulseVerdict,
  sparklinePoints,
  type PulseLevel,
  type PulseReason,
  type PulseSort
} from '../lib/missionControl'
import { timeAgo } from '../lib/timeAgo'
import { useT, interp, type TranslationKey } from '../i18n'
import { emojifyGitmoji } from '../../../shared/gitmoji'
import { effectiveProfileId } from '../lib/repoProfile'

/**
 * Hosting answers kept across visits: reopening the page inside the TTL asks
 * no host. Module-level, so it lives as long as the window, not the page.
 */
const hostingCache = new Map<string, HostingSummary>()

/** Keyed by the account asking too: another profile may see other pull requests. */
function hostingKey(path: string): string {
  return `${effectiveProfileId(useSettingsStore.getState().settings, path)}\n${path}`
}

/** The cached answers for these repositories, as the active profiles see them. */
function hostingView(paths: string[]): Record<string, HostingSummary> {
  const out: Record<string, HostingSummary> = {}
  for (const path of paths) {
    const hit = hostingCache.get(hostingKey(path))
    if (hit) out[path] = hit
  }
  return out
}

/** At most this many repositories ask their host at once. */
const HOSTING_CONCURRENCY = 4

/**
 * One repository's pull requests and HEAD's CI. A repository already open in
 * a tab has both in the store, kept fresh by the sidebar, so it costs nothing;
 * another asks its host as the repository's profile — silently: a background
 * credential lookup never raises a sign-in window. A host that does not answer
 * is remembered as such, so it is not asked again until the TTL passes.
 */
async function fetchHosting(p: RepoPulse): Promise<HostingSummary> {
  const sha = p.headSha ?? null
  const base: HostingSummary = { hasHost: false, open: 0, capped: false, awaiting: 0, ci: null, sha, at: Date.now() }
  if (!p.remoteUrl) return base
  const { settings } = useSettingsStore.getState()
  const profileId = effectiveProfileId(settings, p.path)
  const profile = settings.profiles.find((x) => x.id === profileId) ?? useSettingsStore.getState().activeProfile()
  const loaded = useRepoStore.getState().repos[p.path]

  let prs: PullRequest[] | null = loaded?.prProvider ? loaded.prs : null
  if (!prs) {
    prs = await hostingApi
      .listPRs(p.path, p.remoteUrl, {
        github: profile.githubToken || undefined,
        azure: profile.azureToken || undefined,
        gitlab: profile.gitlabToken || undefined,
        bitbucket: profile.bitbucketToken || undefined,
        forgejo: profile.forgejoToken || undefined
      })
      // No provider: a remote on disk or an unknown host — there is nothing to count.
      .then((r) => (r.provider ? r.prs : null))
      .catch(() => null)
  }

  let ci: CiState | null = null
  if (sha && prs) {
    const known = loaded?.ciStatuses?.[sha]
    if (known && known.state !== 'pending') ci = known.state
    else {
      const fresh = await hostingApi.ciStatuses(p.path, p.remoteUrl, [sha], profile.githubToken ?? '').catch(() => null)
      ci = fresh?.[sha]?.state ?? null
    }
  }
  return prs ? { ...base, hasHost: true, ...summarizePrs(prs), ci } : { ...base, ci }
}

interface Row {
  path: string
  /** Group tab this repo belongs to, when it isn't a standalone tab. */
  group: string | null
  tabId: string
}

type Translate = (key: TranslationKey) => string

/** "3h ago", in the active language; null when there is no timestamp. */
function agoLabel(t: Translate, at: number | null): string | null {
  const ago = timeAgo(at, Date.now())
  return ago ? interp(t(ago.key), { n: String(ago.n) }) : null
}

/** A row's reasons as one line — the level icon's tooltip. */
function reasonsLabel(t: Translate, reasons: PulseReason[]): string {
  if (!reasons.length) return t('mission.reason.clean')
  return reasons.map((r) => interp(t(r.key), { n: String(r.n ?? '') })).join(' · ')
}

const LEVEL_ICON: Record<PulseLevel, typeof CircleCheck> = {
  blocked: AlertTriangle,
  action: ArrowUpFromLine,
  pending: FileEdit,
  clean: CircleCheck
}

const SORTS: PulseSort[] = ['urgency', 'name', 'activity']

/** Which bulk button a running fetch or pull belongs to (see `run`). */
type BulkBusy = '*all' | '*stale' | '*selFetch' | '*selPull'

/** A fortnight of commits as a tiny line — drawn inline, so it costs no library. */
function Sparkline({ values }: { values: number[] }): React.JSX.Element | null {
  const points = sparklinePoints(values, 54, 14)
  if (!points) return null
  return (
    <svg className="mc-spark" viewBox="0 0 54 14" width={54} height={14} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  )
}

const CI_ICON: Record<CiState, typeof CircleCheck> = {
  success: CircleCheck,
  failure: CircleX,
  pending: CircleDot,
  neutral: CircleDashed
}

function CiIcon({ state }: { state: CiState }): React.JSX.Element {
  const Icon = CI_ICON[state]
  return <Icon size={11} />
}

interface Badge {
  cls: string
  Icon: typeof CircleCheck
  n: number
  /** Tooltip, with `{n}` — the bare number says how many, this says of what. */
  title: TranslationKey
  /** A working-tree count reads as words ("3 modified"), as drawn; sync and
   *  conflicts keep their arrow or warning icon. */
  short?: CountKey
}

/** Keys that carry a `.one` variant beside them. */
type CountKey =
  | 'mission.short.staged'
  | 'mission.short.modified'
  | 'mission.short.untracked'
  | 'mission.short.stashes'
  | 'mission.blocked'
  | 'mission.clean'
  | 'mission.repos'

/** A count in words: the `.one` key for 1, the plain one otherwise — the dictionaries have no plural rules. */
function countLabel(t: Translate, key: CountKey, n: number): string {
  return interp(t(n === 1 ? (`${key}.one` as TranslationKey) : key), { n: String(n) })
}

/**
 * The row's counts, in a fixed order so a column of rows reads like a table:
 * what blocks, then sync, then the working tree, then the extras.
 */
function rowBadges(p: RepoPulse): Badge[] {
  const all: Badge[] = [
    { cls: 'blocked', Icon: AlertTriangle, n: p.conflicted, title: 'mission.badge.conflicted' },
    { cls: 'behind', Icon: ArrowDownToLine, n: p.behind, title: 'mission.badge.behind' },
    { cls: 'ahead', Icon: ArrowUpFromLine, n: p.ahead, title: 'mission.badge.ahead' },
    { cls: 'staged', Icon: FileCheck, n: p.staged, title: 'mission.badge.staged', short: 'mission.short.staged' },
    { cls: 'dirty', Icon: FileEdit, n: p.unstaged, title: 'mission.badge.modified', short: 'mission.short.modified' },
    { cls: 'untracked', Icon: FilePlus, n: p.untracked, title: 'mission.badge.untracked', short: 'mission.short.untracked' },
    { cls: 'stash', Icon: Archive, n: p.stashes, title: 'mission.badge.stashes', short: 'mission.short.stashes' }
  ]
  return all.filter((b) => b.n > 0)
}

/**
 * Mission Control — every repository of the active workspace at a glance,
 * ordered by what needs you: something stuck mid-rebase first, then work to
 * pull or push, then dirty trees, then the quiet ones.
 *
 * The git side is local only (a handful of git calls per repo, no fetch).
 * The hosting column asks each repository's host for its open pull requests
 * and HEAD's CI, at most every five minutes and silently; fetching is always
 * an explicit act. Nothing here runs while the page is closed.
 */
export function MissionControlPage(): React.JSX.Element {
  const tabs = useSettingsStore((s) => s.settings.tabs)
  // Tabs belong to the active workspace, so this dashboard is inherently
  // per-workspace: switching workspaces swaps the whole tab strip, this view
  // included. Naming it makes that obvious rather than implicit.
  const workspace = useSettingsStore(
    (s) => (s.settings.workspaces ?? []).find((w) => w.id === s.settings.activeWorkspaceId)?.name ?? ''
  )
  const refreshSeconds = useSettingsStore((s) => s.settings.missionRefreshSeconds)
  const refreshMs = missionRefreshMs(refreshSeconds)
  const rawTiers = useSettingsStore((s) => s.settings.missionReleaseTiers)
  const tiers = useMemo(() => normalizeReleaseTiers(rawTiers), [rawTiers])
  const toast = useUIStore((s) => s.toast)
  const t = useT()

  const [pulses, setPulses] = useState<Record<string, RepoPulse>>({})
  const [details, setDetails] = useState<Record<string, RepoDetail>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [level, setLevel] = useState<PulseLevel | null>(null)
  const [hostFilter, setHostFilter] = useState<'prs' | 'ci' | 'review' | null>(null)
  const [hosting, setHosting] = useState<Record<string, HostingSummary>>({})
  const hostingBusy = useRef(false)
  // A Refresh clicked while a pass is running: run once more when it ends.
  const hostingAgain = useRef<RepoPulse[] | null>(null)
  const [sort, setSort] = useState<PulseSort>('urgency')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)
  const [refreshedAt, setRefreshedAt] = useState(0)
  const filterRef = useRef<HTMLInputElement>(null)

  // Every repository across standalone tabs and groups, de-duplicated: the same
  // folder opened twice is still one repository.
  const rows = useMemo<Row[]>(() => {
    const seen = new Set<string>()
    const out: Row[] = []
    for (const tab of tabs) {
      if (tab.kind === 'page') continue
      for (const r of tabRepos(tab)) {
        if (seen.has(r.path)) continue
        seen.add(r.path)
        out.push({ path: r.path, group: tab.kind === 'group' ? tab.name : null, tabId: tab.id })
      }
    }
    return out
  }, [tabs])

  // Only the repositories whose answer is due; one pass at a time, so a slow
  // host never stacks a second round of calls behind the first.
  const refreshHosting = useCallback(
    async (list: RepoPulse[], force: boolean): Promise<void> => {
      if (hostingBusy.current) {
        if (force) hostingAgain.current = list
        return
      }
      hostingBusy.current = true
      let batch: RepoPulse[] | null = list
      let forced = force
      try {
        while (batch) {
          const paths = batch.map((p) => p.path)
          setHosting(hostingView(paths))
          const now = Date.now()
          const due = batch.filter(
            (p) =>
              !p.error &&
              p.remoteUrl &&
              (forced || hostingDue(hostingCache.get(hostingKey(p.path)), p.headSha, now, refreshMs))
          )
          let next = 0
          const worker = async (): Promise<void> => {
            while (next < due.length) {
              const p = due[next++]
              hostingCache.set(hostingKey(p.path), await fetchHosting(p))
              setHosting(hostingView(paths))
            }
          }
          await Promise.all(Array.from({ length: Math.min(HOSTING_CONCURRENCY, due.length) }, worker))
          batch = hostingAgain.current
          hostingAgain.current = null
          forced = true
        }
      } finally {
        hostingBusy.current = false
      }
    },
    [refreshMs]
  )

  const refresh = useCallback(
    async (opts: { silent?: boolean; force?: boolean } = {}) => {
      if (!opts.silent) setLoading(true)
      const results = await Promise.all(
        rows.map((r) =>
          gitApi.repoPulse(r.path).catch(
            (err): RepoPulse => ({
              path: r.path,
              name: r.path.split('/').pop() ?? r.path,
              branch: '',
              upstream: null,
              ahead: 0,
              behind: 0,
              staged: 0,
              unstaged: 0,
              untracked: 0,
              conflicted: 0,
              stashes: 0,
              lastCommitAt: 0,
              lastCommit: null,
              lastFetchAt: null,
              operation: null,
              activity: [],
              error: err instanceof Error ? err.message : String(err)
            })
          )
        )
      )
      setPulses(Object.fromEntries(results.map((p) => [p.path, p])))
      setRefreshedAt(Date.now())
      setLoading(false)
      void refreshHosting(results, opts.force === true)
    },
    [rows, refreshHosting]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Keep it live while it is on screen: a dashboard that goes stale while you
  // work in another window is worse than no dashboard. The page unmounts when
  // closed, and the timer with it — nothing polls in the background.
  useEffect(() => {
    const id = setInterval(() => void refresh({ silent: true }), refreshMs)
    return () => clearInterval(id)
  }, [refresh, refreshMs])

  const ordered = useMemo(() => {
    const list = rows.map((r) => pulses[r.path]).filter(Boolean)
    const q = filter.trim().toLowerCase()
    const matched = list.filter((p) => {
      if (level && pulseVerdict(p).level !== level) return false
      const h = hosting[p.path]
      if (hostFilter === 'prs' && !(h && h.open > 0)) return false
      if (hostFilter === 'ci' && h?.ci !== 'failure') return false
      if (hostFilter === 'review' && !(h && h.awaiting > 0)) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) || p.branch.toLowerCase().includes(q)
    })
    return orderPulses(matched, sort)
  }, [rows, pulses, filter, level, hostFilter, hosting, sort])

  const totals = useMemo(() => pulseTotals(Object.values(pulses)), [pulses])
  const hostTotals = useMemo(
    () => hostingTotals(rows.map((r) => hosting[r.path]).filter((h): h is HostingSummary => !!h)),
    [rows, hosting]
  )
  const toggleHostFilter = (kind: 'prs' | 'ci' | 'review'): void => setHostFilter((cur) => (cur === kind ? null : kind))
  const openRepoPage = (repoPath: string, type: 'pull-requests' | 'ci-runs'): void =>
    useSettingsStore.getState().openPageTab({ type, repoPath })
  const grand = useMemo(() => {
    const all = Object.values(pulses)
    return {
      ahead: all.reduce((n, p) => n + p.ahead, 0),
      behind: all.reduce((n, p) => n + p.behind, 0),
      dirty: all.filter((p) => p.staged + p.unstaged + p.untracked > 0).length,
      commits: all.reduce((n, p) => n + activityTotal(p), 0)
    }
  }, [pulses])

  // The repository itself — its graph — not a page parked on its tab: the PR
  // chip may have left the pull request list open there.
  const open = useCallback((path: string): void => useSettingsStore.getState().showRepoView(path), [])

  const run = useCallback(
    // `busyKey` names the button that started a bulk run, so the spinner lands on it and not on
    // every bulk button at once; a single row is keyed by its op and path, so its fetch and its
    // pull each spin their own button.
    async (paths: string[], op: 'fetch' | 'pull', busyKey?: BulkBusy): Promise<void> => {
      if (!paths.length) return
      setBusy(busyKey ?? (paths.length === 1 ? `${op}:${paths[0]}` : '*'))
      try {
        if (paths.length > 1) {
          await repoActions.batch(paths, op)
        } else {
          // A repo listed here may never have been opened this session.
          await useRepoStore.getState().ensure(paths[0])
          if (op === 'fetch') await repoActions.fetchAll(paths[0])
          else await repoActions.pull(paths[0], 'default')
        }
        await refresh({ silent: true })
      } catch (err) {
        toast('error', err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(null)
      }
    },
    [refresh, toast]
  )

  const toggleExpanded = useCallback(
    (path: string): void => {
      setExpanded((cur) => {
        const next = cur === path ? null : path
        // Detail is fetched only for the row actually opened, and kept after.
        if (next && !details[next]) {
          void gitApi
            .repoDetail(next)
            .then((d) => setDetails((prev) => ({ ...prev, [next]: d })))
            .catch(() => undefined)
        }
        return next
      })
    },
    [details]
  )

  const toggleSelected = (path: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  // ── Keyboard: walk the list, act on the focused row ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (e.key === '/' && !typing) {
        e.preventDefault()
        filterRef.current?.focus()
        return
      }
      if (typing) return
      const row = ordered[cursor]
      if (e.key === 'ArrowDown' || e.key === 'j') setCursor((c) => Math.min(ordered.length - 1, c + 1))
      else if (e.key === 'ArrowUp' || e.key === 'k') setCursor((c) => Math.max(0, c - 1))
      else if (e.key === 'Enter' && row) open(row.path)
      else if (e.key === 'f' && row) void run([row.path], 'fetch')
      else if (e.key === 'p' && row) void run([row.path], 'pull')
      else if (e.key === ' ' && row) toggleExpanded(row.path)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ordered, cursor, open, run, toggleExpanded])

  useEffect(() => {
    if (cursor > ordered.length - 1) setCursor(Math.max(0, ordered.length - 1))
  }, [ordered.length, cursor])

  const bulk = useMemo(() => bulkTargets(ordered.filter((p) => selected.has(p.path))), [ordered, selected])
  // Over the visible rows, like "Fetch all": a filter narrows what both act on.
  // Recomputed with every refresh, which is when a fetch age can cross the line.
  const stale = useMemo(() => staleFetchTargets(ordered, Date.now()), [ordered])

  const levelChip = (kind: PulseLevel, label: string | CountKey): React.JSX.Element | null =>
    totals[kind] === 0 && kind !== 'clean' ? null : (
      <button
        className={`mc-pill ${kind} ${level === kind ? 'on' : ''}`}
        onClick={() => setLevel((cur) => (cur === kind ? null : kind))}
      >
        {label.startsWith('mission.')
          ? countLabel(t, label as CountKey, totals[kind])
          : interp(label, { n: String(totals[kind]) })}
      </button>
    )

  return (
    <div className="mc-root">
      <div className="mc-header">
        <Gauge size={18} className="mc-title-icon" />
        <h2>{t('mission.title')}</h2>
        {workspace && <span className="mc-workspace">{workspace}</span>}
        <span className="mc-repos">{countLabel(t, 'mission.repos', rows.length)}</span>
        <span className="mc-summary">
          {levelChip('blocked', 'mission.blocked')}
          {levelChip('action', t('mission.action'))}
          {levelChip('pending', t('mission.pending'))}
          {levelChip('clean', 'mission.clean')}
          {(hostTotals.prs > 0 || hostTotals.ciFailing > 0) && <span className="mc-summary-sep" aria-hidden="true" />}
          {hostTotals.prs > 0 && (
            <button className={`mc-pill prs ${hostFilter === 'prs' ? 'on' : ''}`} onClick={() => toggleHostFilter('prs')}>
              <GitPullRequest size={11} /> {interp(t('mission.prsOpen'), { n: String(hostTotals.prs) })}
            </button>
          )}
          {hostTotals.ciFailing > 0 && (
            <button className={`mc-pill blocked ${hostFilter === 'ci' ? 'on' : ''}`} onClick={() => toggleHostFilter('ci')}>
              <CircleX size={11} /> {interp(t('mission.ciFailing'), { n: String(hostTotals.ciFailing) })}
            </button>
          )}
        </span>
        <input
          ref={filterRef}
          className="modal-input mc-filter"
          value={filter}
          placeholder={t('mission.filter')}
          spellCheck={false}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setFilter('')
              e.currentTarget.blur()
            }
          }}
        />
        <div className="mc-sorts">
          {SORTS.map((s) => (
            <button key={s} className={`mc-sort ${sort === s ? 'active' : ''}`} onClick={() => setSort(s)}>
              {t(`mission.sort.${s}` as 'mission.sort.urgency')}
            </button>
          ))}
        </div>
        <button
          className="btn ghost small"
          disabled={busy !== null}
          onClick={() => void run(bulkTargets(ordered).fetchable, 'fetch', '*all')}
        >
          {busy === '*all' && <Loader2 size={13} className="spin" />} {t('mission.fetchAll')}
        </button>
        {stale.length > 0 && (
          <button
            className="btn ghost small mc-fetch-stale"
            disabled={busy !== null}
            title={t('mission.fetchStaleHint')}
            onClick={() => void run(stale, 'fetch', '*stale')}
          >
            {busy === '*stale' && <Loader2 size={13} className="spin" />}{' '}
            {interp(t('mission.fetchStaleButton'), { n: String(stale.length) })}
          </button>
        )}
        <button className="btn ghost small" disabled={loading} onClick={() => void refresh({ force: true })}>
          {loading && <Loader2 size={13} className="spin" />} {t('mission.refresh')}
        </button>
      </div>

      <div className="mc-stats">
        <span className="mc-stat">
          <ArrowUpFromLine size={11} /> {interp(t('mission.totalAhead'), { n: String(grand.ahead) })}
        </span>
        <span className="mc-stat">
          <ArrowDownToLine size={11} /> {interp(t('mission.totalBehind'), { n: String(grand.behind) })}
        </span>
        <span className="mc-stat">
          {interp(t('mission.totalDirty'), { n: String(grand.dirty) })}
        </span>
        <span className="mc-stat">
          {interp(t('mission.totalCommits'), { n: String(grand.commits) })}
        </span>
        {hostTotals.awaiting > 0 && (
          <button
            className={`mc-stat mc-stat-review ${hostFilter === 'review' ? 'on' : ''}`}
            onClick={() => toggleHostFilter('review')}
          >
            <GitPullRequest size={11} /> {interp(t('mission.awaitingReview'), { n: String(hostTotals.awaiting) })}
          </button>
        )}
        <span className="mc-stat mc-stat-right">
          {refreshedAt ? interp(t('mission.updated'), { t: agoLabel(t, refreshedAt) ?? '' }) : ''}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="mc-bulk">
          <span className="mc-bulk-count">{interp(t('mission.selected'), { n: String(selected.size) })}</span>
          <button className="btn ghost small" disabled={busy !== null} onClick={() => void run(bulk.fetchable, 'fetch', '*selFetch')}>
            {busy === '*selFetch' ? <Loader2 size={12} className="spin" /> : <Download size={12} />}{' '}
            {t('mission.fetchSelected')}
          </button>
          <button
            className="btn ghost small"
            disabled={busy !== null || bulk.pullable.length === 0}
            onClick={() => void run(bulk.pullable, 'pull', '*selPull')}
          >
            {busy === '*selPull' ? <Loader2 size={12} className="spin" /> : <ArrowDownToLine size={12} />}{' '}
            {interp(t('mission.pullSelected'), { n: String(bulk.pullable.length) })}
          </button>
          <button className="btn ghost small" onClick={() => setSelected(new Set())}>
            {t('mission.clearSelection')}
          </button>
        </div>
      )}

      {loading && ordered.length === 0 ? (
        <div className="mc-loading">
          <Loader2 size={22} className="spin" />
        </div>
      ) : ordered.length === 0 ? (
        <div className="mc-empty">{filter.trim() || level || hostFilter ? t('mission.noMatch') : t('mission.empty')}</div>
      ) : (
        <div className="mc-list">
          <div className="mc-row mc-head">
            <span />
            <span />
            <span />
            <span>{t('mission.col.repo')}</span>
            <span className="mc-commit">{t('mission.col.commit')}</span>
            <span>{t('mission.col.local')}</span>
            <span>{t('mission.col.hosting')}</span>
            <span className="mc-release">{t('mission.col.release')}</span>
            <span>{t('mission.col.activity')}</span>
            <span className="mc-head-when">{t('mission.col.when')}</span>
            <span />
          </div>
          {ordered.map((p, i) => {
            const verdict = pulseVerdict(p)
            const Icon = LEVEL_ICON[verdict.level]
            const row = rows.find((r) => r.path === p.path)
            const host = hosting[p.path]
            const note = releaseNote(p.release ?? null)
            const tone = releaseTone(p.release ?? null, tiers)
            const isOpen = expanded === p.path
            const detail = details[p.path]
            const fetchStale = isFetchStale(p, Date.now())
            const badges = rowBadges(p)
            return (
              <div key={p.path} className={`mc-row-wrap ${i === cursor ? 'cursor' : ''}`}>
                <div
                  className={`mc-row ${verdict.level}`}
                  onClick={() => setCursor(i)}
                  onDoubleClick={() => open(p.path)}
                >
                  <input
                    type="checkbox"
                    className="mc-check"
                    checked={selected.has(p.path)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelected(p.path)}
                  />
                  <button
                    className="mc-expand"
                    title={t('mission.details')}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpanded(p.path)
                    }}
                  >
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <span className={`mc-level ${verdict.level}`} title={reasonsLabel(t, verdict.reasons)}>
                    <Icon size={16} />
                  </span>
                  <div className="mc-ident">
                    <span className="mc-line">
                      <span className="mc-name" title={p.path}>
                        {p.name}
                      </span>
                      {row?.group && <span className="mc-group">{row.group}</span>}
                    </span>
                    <span className="mc-where">
                      <span className="mc-branch">{p.branch || t('mission.detached')}</span>
                      {p.upstream ? (
                        <span className="mc-upstream">→ {p.upstream}</span>
                      ) : (
                        p.branch && (
                          <span className="mc-noupstream">· {t('mission.noUpstream')}</span>
                        )
                      )}
                    </span>
                  </div>

                  {p.error ? (
                    <span className="mc-error" title={p.error}>
                      {p.error}
                    </span>
                  ) : (
                    <>
                      {/* What the repo was last doing: the column that used to be empty space. */}
                      <div className="mc-commit">
                        {p.lastCommit ? (
                          <>
                            <span className="mc-subject" title={emojifyGitmoji(p.lastCommit.subject)}>
                              {emojifyGitmoji(p.lastCommit.subject)}
                            </span>
                            <span className="mc-author">{p.lastCommit.author}</span>
                          </>
                        ) : (
                          <span className="mc-author">{t('mission.noCommits')}</span>
                        )}
                      </div>
                      <div className="mc-badges">
                        {p.operation && <span className="mc-badge blocked">{t(OP_LABEL[p.operation])}</span>}
                        {badges.map((b) => (
                          <span key={b.cls} className={`mc-badge ${b.cls}`} title={interp(t(b.title), { n: String(b.n) })}>
                            {b.short ? (
                              countLabel(t, b.short, b.n)
                            ) : (
                              <>
                                <b.Icon size={11} /> {b.n}
                              </>
                            )}
                          </span>
                        ))}
                      </div>
                      <div className="mc-hosting">
                        {host?.hasHost &&
                          (host.open > 0 ? (
                            <button
                              className="mc-pr-chip"
                              title={interp(t('mission.prChip'), { n: String(host.open) })}
                              onClick={(e) => {
                                e.stopPropagation()
                                useSettingsStore.getState().openPageTab({ type: 'pull-requests', repoPath: p.path, from: 'mission' })
                              }}
                            >
                              <GitPullRequest size={11} />
                              {host.capped ? `${host.open}+` : host.open}
                              {host.awaiting > 0 && (
                                <span
                                  className="mc-pr-awaiting"
                                  title={interp(t('mission.awaitingReview'), { n: String(host.awaiting) })}
                                >
                                  {host.awaiting}
                                </span>
                              )}
                              <ArrowUpRight size={10} className="mc-go" />
                            </button>
                          ) : (
                            <span className="mc-muted">{t('mission.noPrs')}</span>
                          ))}
                        {host?.ci && (
                          <button
                            className={`mc-ci ${host.ci}`}
                            title={t(`mission.ci.${host.ci}` as 'mission.ci.success')}
                            onClick={(e) => {
                              e.stopPropagation()
                              openRepoPage(p.path, 'ci-runs')
                            }}
                          >
                            <CiIcon state={host.ci} />
                            {/* i18n-ignore product acronym */}
                            CI
                          </button>
                        )}
                      </div>
                      <div
                        className="mc-release"
                        title={p.release ? interp(t('mission.release.title'), { tag: p.release.tag }) : undefined}
                      >
                        {p.release && (
                          <span className="mc-tag">
                            <Tag size={11} /> <span>{p.release.tag}</span>
                          </span>
                        )}
                        <span
                          className="mc-release-note"
                          data-tone={isCustomReleaseTone(tone) ? 'custom' : tone}
                          style={isCustomReleaseTone(tone) ? { color: tone } : undefined}
                        >
                          {interp(t(note.key), { n: String(note.n ?? '') })}
                        </span>
                      </div>
                    </>
                  )}

                  <span className={`mc-activity ${verdict.level}`} title={t('mission.activity')}>
                    <Sparkline values={p.activity} />
                    <span className="mc-activity-n">
                      {interp(t('mission.commits14d'), { n: String(activityTotal(p)) })}
                    </span>
                  </span>
                  <span className="mc-times">
                    <span className="mc-age" title={t('mission.lastCommit')}>
                      {agoLabel(t, p.lastCommitAt * 1000) ?? '—'}
                    </span>
                    {p.upstream && !p.error && (
                      <span
                        className={`mc-fetched ${fetchStale ? 'stale' : ''}`}
                        title={fetchStale ? t('mission.fetchStale') : undefined}
                      >
                        {p.lastFetchAt
                          ? interp(t('mission.fetched'), { t: agoLabel(t, p.lastFetchAt) ?? '' })
                          : t('mission.neverFetched')}
                      </span>
                    )}
                  </span>
                  <div className="mc-actions">
                    <button
                      className="mc-icon-btn"
                      title={t('mission.fetch')}
                      aria-label={t('mission.fetch')}
                      disabled={busy !== null}
                      onClick={(e) => {
                        e.stopPropagation()
                        void run([p.path], 'fetch')
                      }}
                    >
                      {busy === `fetch:${p.path}` ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
                    </button>
                    <button
                      className="mc-icon-btn"
                      disabled={busy !== null || !p.upstream}
                      title={t('mission.pull')}
                      aria-label={t('mission.pull')}
                      onClick={(e) => {
                        e.stopPropagation()
                        void run([p.path], 'pull')
                      }}
                    >
                      {busy === `pull:${p.path}` ? <Loader2 size={12} className="spin" /> : <ArrowDownToLine size={12} />}
                    </button>
                    <button
                      className="mc-open"
                      onClick={(e) => {
                        e.stopPropagation()
                        open(p.path)
                      }}
                    >
                      {t('mission.open.row')}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mc-detail">
                    {!detail ? (
                      <Loader2 size={14} className="spin" />
                    ) : detail.files.length === 0 && detail.commits.length === 0 ? (
                      <span className="mc-detail-empty">{t('mission.nothingPending')}</span>
                    ) : (
                      <>
                        {detail.commits.length > 0 && (
                          <div className="mc-detail-col">
                            <span className="mc-detail-title">{t('mission.unpushed')}</span>
                            {detail.commits.map((c) => (
                              <div key={c.hash} className="mc-detail-item">
                                <code>{c.hash}</code>
                                <span title={emojifyGitmoji(c.subject)}>{emojifyGitmoji(c.subject)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {detail.files.length > 0 && (
                          <div className="mc-detail-col">
                            <span className="mc-detail-title">{t('mission.working')}</span>
                            {detail.files.map((f) => (
                              <div key={f.path} className="mc-detail-item">
                                <code className={`mc-status ${f.status}`}>{f.status}</code>
                                <span title={f.path}>{f.path}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
