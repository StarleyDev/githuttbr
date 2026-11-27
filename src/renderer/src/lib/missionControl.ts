import type { CiState, ConflictOpKind, PullRequest, ReleaseNoteTiers, ReleaseTone, ReleaseToneName, RepoPulse } from '../../../shared/types'
import { DEFAULT_RELEASE_TIERS, RELEASE_TIER_COUNT, RELEASE_TONES, isCustomReleaseTone } from '../../../shared/types'
import type { TranslationKey } from '../i18n'

/**
 * Ranking for Mission Control: what deserves your attention first across every
 * open repository.
 *
 * The order is deliberate rather than alphabetical — a repo stuck mid-rebase is
 * an emergency, unpushed work is a reminder, and a clean repo is just noise at
 * the bottom of the list.
 */
export type PulseLevel = 'blocked' | 'action' | 'pending' | 'clean'

export interface PulseVerdict {
  level: PulseLevel
  /** Higher sorts first. */
  score: number
  /** Why it is up there, as dictionary keys — the caller renders them, so they
   *  follow a language switch and the ranking stays testable against stable keys. */
  reasons: PulseReason[]
}

/** One reason a repo ranks where it does. `n` fills `{n}`. */
export interface PulseReason {
  key: TranslationKey
  n?: number
}

/** One sentence per operation rather than an interpolated noun — the same keys
 *  the repo's mood line uses, since "a merge" and "a rebase" decline differently. */
const OP_REASON: Record<ConflictOpKind, TranslationKey> = {
  merge: 'mood.opMerge',
  rebase: 'mood.opRebase',
  'cherry-pick': 'mood.opCherryPick',
  revert: 'mood.opRevert'
}

/** The operation's short name, for the row's badge. */
export const OP_LABEL: Record<ConflictOpKind, TranslationKey> = {
  merge: 'conflict.opMerge',
  rebase: 'conflict.opRebase',
  'cherry-pick': 'conflict.opCherryPick',
  revert: 'conflict.opRevert'
}

export function pulseVerdict(p: RepoPulse): PulseVerdict {
  const reasons: PulseReason[] = []
  let score = 0
  let level: PulseLevel = 'clean'

  if (p.error) {
    return { level: 'blocked', score: 1000, reasons: [{ key: 'mission.reason.unreadable' }] }
  }
  if (p.operation) {
    score += 500
    level = 'blocked'
    reasons.push({ key: OP_REASON[p.operation] })
  }
  if (p.conflicted) {
    score += 400 + p.conflicted
    level = 'blocked'
    reasons.push({ key: 'mission.reason.conflicted', n: p.conflicted })
  }
  if (p.behind) {
    score += 100 + Math.min(p.behind, 50)
    if (level === 'clean') level = 'action'
    reasons.push({ key: 'mission.reason.behind', n: p.behind })
  }
  if (p.ahead) {
    score += 60 + Math.min(p.ahead, 50)
    if (level === 'clean') level = 'action'
    reasons.push({ key: 'mission.reason.ahead', n: p.ahead })
  }
  const dirty = p.staged + p.unstaged
  if (dirty) {
    score += 30 + Math.min(dirty, 30)
    if (level === 'clean') level = 'pending'
    reasons.push({ key: 'mission.reason.uncommitted', n: dirty })
  }
  if (p.untracked) {
    score += 5
    if (level === 'clean') level = 'pending'
    reasons.push({ key: 'mission.reason.untracked', n: p.untracked })
  }
  if (p.stashes) {
    score += 3
    reasons.push({ key: 'mission.reason.stashed', n: p.stashes })
  }
  // A branch with no upstream can never be pushed by mistake — worth a nudge,
  // but only once everything louder has been dealt with.
  if (!p.upstream && p.branch) {
    score += 2
    reasons.push({ key: 'mission.reason.noUpstream' })
  }
  return { level, score, reasons }
}

/** Most urgent first; ties broken by the most recently active repo. */
export function sortPulses(pulses: RepoPulse[]): RepoPulse[] {
  return [...pulses].sort((a, b) => {
    const d = pulseVerdict(b).score - pulseVerdict(a).score
    if (d !== 0) return d
    if (b.lastCommitAt !== a.lastCommitAt) return b.lastCommitAt - a.lastCommitAt
    return a.name.localeCompare(b.name)
  })
}

/** Sort orders the dashboard offers. */
export type PulseSort = 'urgency' | 'name' | 'activity'

/** Sum of a repo's recent commits — the "activity" ordering and sparkline total. */
export function activityTotal(p: RepoPulse): number {
  return (p.activity ?? []).reduce((a, b) => a + b, 0)
}

/** Apply the chosen ordering. Urgency is the default and the point of the page. */
export function orderPulses(pulses: RepoPulse[], sort: PulseSort): RepoPulse[] {
  if (sort === 'name') return [...pulses].sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'activity') {
    return [...pulses].sort(
      (a, b) => activityTotal(b) - activityTotal(a) || b.lastCommitAt - a.lastCommitAt || a.name.localeCompare(b.name)
    )
  }
  return sortPulses(pulses)
}

/**
 * Everything the toolbar can act on in bulk: repos that are behind can be
 * pulled, repos with an upstream can be fetched.
 */
export function bulkTargets(pulses: RepoPulse[]): { fetchable: string[]; pullable: string[] } {
  return {
    fetchable: pulses.filter((p) => !p.error).map((p) => p.path),
    pullable: pulses.filter((p) => !p.error && p.upstream && p.behind > 0).map((p) => p.path)
  }
}

/** Points for a sparkline path, normalised into a `width`×`height` box. */
export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? width / (values.length - 1) : 0
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(' ')
}

/** Counts for the header: how many repos sit at each level. */
export function pulseTotals(pulses: RepoPulse[]): Record<PulseLevel, number> {
  const totals: Record<PulseLevel, number> = { blocked: 0, action: 0, pending: 0, clean: 0 }
  for (const p of pulses) totals[pulseVerdict(p).level]++
  return totals
}

/** Past this, a fetch is old enough that the behind count may be lying. */
export const FETCH_STALE_MS = 24 * 3600 * 1000

/**
 * Whether the row should warn that its "to pull" count is stale. Reading the
 * dashboard never fetches, so a repo last fetched a week ago shows 0 behind
 * no matter what landed upstream since. Only a branch that tracks something
 * can be stale; one that never fetched is the most stale of all.
 */
export function isFetchStale(p: RepoPulse, now: number): boolean {
  if (!p.upstream || p.error) return false
  return p.lastFetchAt === null || now - p.lastFetchAt >= FETCH_STALE_MS
}

/** The repos whose behind count may be lying — what "Fetch stale" fetches. */
export function staleFetchTargets(pulses: RepoPulse[], now: number): string[] {
  return pulses.filter((p) => isFetchStale(p, now)).map((p) => p.path)
}

// ── Refresh cadence and the hosting column ──────────────────────────────────

/** The shortest refresh Settings allows — below it the dashboard is all git. */
export const MISSION_REFRESH_MIN_S = 30
const MISSION_REFRESH_MAX_S = 3600

/** The refresh interval in ms from Settings' seconds, clamped to 30 s–1 h. */
export function missionRefreshMs(seconds: number | undefined): number {
  const s = Number.isFinite(seconds) ? Math.round(seconds as number) : MISSION_REFRESH_MIN_S
  return Math.min(MISSION_REFRESH_MAX_S, Math.max(MISSION_REFRESH_MIN_S, s)) * 1000
}

/**
 * How long a repository's pull requests and CI stay good before the host is
 * asked again. Each is one API call per repository; at the 30 s refresh a
 * twenty-repository workspace would spend half of GitHub's hourly allowance.
 */
export const HOSTING_TTL_MS = 5 * 60_000
/** A running CI is looked at again sooner, so a finished run does not sit on the clock. */
const HOSTING_PENDING_MS = 60_000

/** What the hosting column shows for one repository. */
export interface HostingSummary {
  /** The host answered for pull requests; false hides the column's PR part. */
  hasHost: boolean
  /** Open pull requests; `capped` when the host's first page came back full. */
  open: number
  capped: boolean
  /** Of those, how many ask for your review. */
  awaiting: number
  /** HEAD's CI, null when the host reports none. */
  ci: CiState | null
  /** The HEAD the CI was asked for, and when. */
  sha: string | null
  at: number
}

/** The host's first page of pull requests: GitHub's holds 30. */
const PR_PAGE = 30

export function summarizePrs(prs: PullRequest[]): Pick<HostingSummary, 'open' | 'capped' | 'awaiting'> {
  const open = prs.filter((p) => (p.state ?? 'open') === 'open')
  return { open: open.length, capped: prs.length >= PR_PAGE, awaiting: open.filter((p) => p.awaitingYou).length }
}

/**
 * Whether to ask the host again: never asked, HEAD moved (its CI is another
 * run), a run still going, or the TTL passed — never sooner than the refresh
 * interval itself, which may be set longer than the TTL.
 */
export function hostingDue(
  entry: HostingSummary | undefined,
  headSha: string | null | undefined,
  now: number,
  refreshMs: number
): boolean {
  if (!entry) return true
  if ((headSha ?? null) !== entry.sha) return true
  if (entry.ci === 'pending' && now - entry.at >= HOSTING_PENDING_MS) return true
  return now - entry.at >= Math.max(HOSTING_TTL_MS, refreshMs)
}

/** Header counts over every repository the host answered for. */
export function hostingTotals(summaries: HostingSummary[]): { prs: number; awaiting: number; ciFailing: number } {
  return {
    prs: summaries.reduce((n, s) => n + s.open, 0),
    awaiting: summaries.reduce((n, s) => n + s.awaiting, 0),
    ciFailing: summaries.filter((s) => s.ci === 'failure').length
  }
}

/** The release column's second line. */
export function releaseNote(release: RepoPulse['release']): { key: TranslationKey; n?: number } {
  if (!release) return { key: 'mission.release.none' }
  if (release.since === 0) return { key: 'mission.release.current' }
  return { key: 'mission.release.since', n: release.since }
}

/**
 * The ranges as Settings holds them, made usable: whole non-negative limits
 * that never go down, and a known tone in every slot — an imported or
 * hand-edited file can carry anything. The first shape (`warnAfter`,
 * `alertAfter`, three tones) still reads, its last tone carried into the new
 * range.
 */
export function normalizeReleaseTiers(raw: unknown): ReleaseNoteTiers {
  const src = (raw ?? {}) as Partial<ReleaseNoteTiers> & { warnAfter?: unknown; alertAfter?: unknown }
  const legacy = !Array.isArray(src.limits) && (src.warnAfter !== undefined || src.alertAfter !== undefined)
  const rawLimits: unknown[] = legacy ? [src.warnAfter, src.alertAfter] : Array.isArray(src.limits) ? src.limits : []
  const rawTones: unknown[] = Array.isArray(src.tones) ? src.tones : []
  const limits: number[] = []
  for (let i = 0; i < RELEASE_TIER_COUNT - 1; i++) {
    const n = rawLimits[i]
    const value = typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : DEFAULT_RELEASE_TIERS.limits[i]
    limits.push(Math.max(value, limits[i - 1] ?? 0))
  }
  const tones: ReleaseTone[] = []
  for (let i = 0; i < RELEASE_TIER_COUNT; i++) {
    // A legacy file had three tones: its "above" one stays above.
    const t = legacy && i === RELEASE_TIER_COUNT - 1 ? rawTones[rawTones.length - 1] : rawTones[i]
    const known =
      typeof t === 'string' && (RELEASE_TONES.includes(t as ReleaseToneName) || isCustomReleaseTone(t))
    tones.push(known ? (t as ReleaseTone) : DEFAULT_RELEASE_TIERS.tones[i])
  }
  return { limits, tones }
}

/** The colour of a release note: the first range its commit count fits in. */
export function releaseTone(release: RepoPulse['release'], tiers: ReleaseNoteTiers): ReleaseTone {
  if (!release) return 'muted'
  const i = tiers.limits.findIndex((limit) => release.since <= limit)
  return tiers.tones[i === -1 ? tiers.tones.length - 1 : i]
}
