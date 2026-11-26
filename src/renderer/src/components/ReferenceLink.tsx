import { createContext, memo, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Bug, CircleCheck, CircleDot, ClipboardList, GitMerge, GitPullRequest, GitPullRequestClosed, Loader2 } from 'lucide-react'
import type { ReferenceQuery, ReferenceSummary } from '../../../shared/types'
import { hostingApi } from '../infrastructure/api'
import { useSettingsStore } from '../stores/settings'
import { useT, type TranslationKey } from '../i18n'
import type { AutolinkOptions, ReferenceLinkParts } from '../lib/autolink'
import {
  AZURE_REQUEST_MAX,
  getReferenceKey,
  pickReferenceBatch,
  REFERENCE_REQUEST_MAX,
  ReferenceCache,
  unavailableSummaries,
  type ReferenceHost
} from '../lib/references'

/**
 * The hover card on a `#12` / `!12` / `AB#12` link: what the reference is, its
 * title and its state. Nothing is asked until a card is opened — by pointer or
 * by keyboard focus — and then every reference on the page that is not in the
 * cache rides along in the same request, so moving to the next one is instant.
 *
 * Typing stays cheap: a link is memoized on its own props, registers itself on
 * mount only, and re-renders when its own summary arrives — never on a
 * keystroke in the composer above it.
 */

interface Scope {
  repoPath: string
  remoteUrl: string
  /** Cache key for the repository: path and remote. */
  key: string
  host: ReferenceHost
}

const ScopeContext = createContext<Scope | null>(null)

/** The repository whose references the links below it read. Without one, links are plain. */
export function ReferenceScope({
  repoPath,
  remoteUrl,
  host,
  children
}: {
  repoPath: string
  remoteUrl: string | undefined
  /** Null: a host with no cards (lib/references getReferenceHost) — links stay plain. */
  host: ReferenceHost | null
  children: React.ReactNode
}): React.JSX.Element {
  const on = !!host
  const azure = !!host?.azure
  const gitlab = !!host?.gitlab
  const value = useMemo(
    () => (remoteUrl && on ? { repoPath, remoteUrl, key: `${repoPath}\n${remoteUrl}`, host: { azure, gitlab } } : null),
    [repoPath, remoteUrl, on, azure, gitlab]
  )
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

// ── The module's store: cache, requests on their way, links on screen ────────

const cache = new ReferenceCache()
const inflight = new Set<string>()
/** Per scope, every reference a mounted link shows, with how many links show it. */
const visible = new Map<string, Map<string, { q: ReferenceQuery; n: number }>>()
const listeners = new Set<() => void>()
const notify = (): void => {
  for (const l of listeners) l()
}
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const flightKey = (scope: Scope, q: ReferenceQuery): string => `${scope.key}\n${getReferenceKey(q)}`

function registerVisible(scope: Scope, q: ReferenceQuery): () => void {
  const map = visible.get(scope.key) ?? new Map<string, { q: ReferenceQuery; n: number }>()
  visible.set(scope.key, map)
  const key = getReferenceKey(q)
  const e = map.get(key)
  if (e) e.n++
  else map.set(key, { q, n: 1 })
  return () => {
    const cur = map.get(key)
    if (!cur) return
    if (--cur.n <= 0) map.delete(key)
    if (!map.size) visible.delete(scope.key)
  }
}

/**
 * Ask the host about `first` and every other reference on screen it has no
 * fresh answer for — one request. A failure caches "unavailable" briefly
 * rather than asking again on every hover.
 */
function requestSummaries(scope: Scope, first: ReferenceQuery | null, also: readonly ReferenceQuery[] = []): void {
  const onScreen = [...also, ...[...(visible.get(scope.key)?.values() ?? [])].map((e) => e.q)]
  // Azure reads up to 200 work items in one request; other hosts pay one request per reference.
  const max = scope.host.azure ? AZURE_REQUEST_MAX : REFERENCE_REQUEST_MAX
  const batch = pickReferenceBatch(first, onScreen, (q) => !!cache.getSummary(scope.key, q) || inflight.has(flightKey(scope, q)), max)
  if (!batch.length) return
  for (const q of batch) inflight.add(flightKey(scope, q))
  notify()
  const p = useSettingsStore.getState().activeProfile()
  const tokens = {
    github: p.githubToken || undefined,
    gitlab: p.gitlabToken || undefined,
    forgejo: p.forgejoToken || undefined,
    azure: p.azureToken || undefined
  }
  void hostingApi
    .getReferenceSummaries(scope.repoPath, scope.remoteUrl, tokens, batch)
    .catch(() => unavailableSummaries(batch))
    .then((summaries) => {
      // Whatever the answer left out counts as unavailable, so no card spins forever.
      const got = new Set(summaries.map(getReferenceKey))
      cache.saveSummaries(scope.key, [...summaries, ...unavailableSummaries(batch.filter((q) => !got.has(getReferenceKey(q))))])
      for (const q of batch) inflight.delete(flightKey(scope, q))
      notify()
    })
}

/** Read these references now, in one request — for a list that shows titles inline. */
export function usePrefetchReferences(queries: readonly ReferenceQuery[]): void {
  const scope = useContext(ScopeContext)
  const key = queries.map(getReferenceKey).join(',')
  useEffect(() => {
    if (scope && queries.length) requestSummaries(scope, null, queries)
    // `key` stands for the list's contents: a new array with the same ids asks nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, key])
}

const LOADING = 'loading'
const NONE = 'none'

/**
 * The cached summary of one reference, and whether a request for it is on its
 * way. The snapshot is this reference's own entry (or a sentinel), so a link
 * re-renders when its own answer arrives, not when any other one does.
 */
function useReferenceSummary(scope: Scope | null, q: ReferenceQuery): { summary?: ReferenceSummary; loading: boolean } {
  const snap = useSyncExternalStore(subscribe, () =>
    !scope ? NONE : (cache.getSummary(scope.key, q) ?? (inflight.has(flightKey(scope, q)) ? LOADING : NONE))
  )
  return typeof snap === 'string' ? { loading: snap === LOADING } : { summary: snap, loading: false }
}

// ── Rendering ────────────────────────────────────────────────────────────────

const OPEN_DELAY_MS = 300
const CLOSE_DELAY_MS = 150
const CARD_WIDTH = 320

// An issue's state and a PR's are separate keys: several languages inflect them differently.
const PR_STATE_KEY: Record<NonNullable<ReferenceSummary['state']>, TranslationKey> = {
  open: 'prPage.stateOpen',
  closed: 'prPage.stateClosed',
  merged: 'prDetail.merged'
}
const ISSUE_STATE_KEY: Record<NonNullable<ReferenceSummary['state']>, TranslationKey> = {
  open: 'issue.open',
  closed: 'issue.closed',
  merged: 'prDetail.merged'
}
const KIND_KEY: Record<NonNullable<ReferenceSummary['kind']>, TranslationKey> = {
  issue: 'ref.kindIssue',
  pr: 'ref.kindPr',
  mr: 'ref.kindMr',
  workItem: 'ref.kindWorkItem'
}

function KindIcon({ s }: { s: ReferenceSummary }): React.JSX.Element {
  if (s.kind === 'workItem') return /bug/i.test(s.workItemType ?? '') ? <Bug size={14} /> : <ClipboardList size={14} />
  if (s.kind === 'pr' || s.kind === 'mr') {
    if (s.state === 'merged') return <GitMerge size={14} />
    return s.state === 'closed' ? <GitPullRequestClosed size={14} /> : <GitPullRequest size={14} />
  }
  return s.state === 'closed' ? <CircleCheck size={14} /> : <CircleDot size={14} />
}

/** The card's body: loading, unavailable, or the reference itself. */
function ReferenceCardBody({ label, summary, loading }: { label: string; summary?: ReferenceSummary; loading: boolean }): React.JSX.Element {
  const t = useT()
  if (!summary) {
    return (
      <span className="ref-card-row">
        <Loader2 size={13} className={loading ? 'spin' : undefined} /> <span className="ref-card-num">{label}</span>{' '}
        <span className="ref-card-muted">{t('common.loading')}</span>
      </span>
    )
  }
  if (!summary.available) {
    return (
      <span className="ref-card-row">
        <span className="ref-card-num">{label}</span> <span className="ref-card-muted">{t('ref.unavailable')}</span>
      </span>
    )
  }
  const state = summary.state
    ? t((summary.kind === 'issue' ? ISSUE_STATE_KEY : PR_STATE_KEY)[summary.state])
    : summary.stateName
  return (
    <>
      <span className="ref-card-row">
        <span className={`ref-card-icon ref-state-${summary.state ?? 'neutral'}`}>
          <KindIcon s={summary} />
        </span>
        <span className="ref-card-num">{label}</span>
        <span className="ref-card-muted">{summary.workItemType ?? (summary.kind ? t(KIND_KEY[summary.kind]) : '')}</span>
      </span>
      <span className="ref-card-title">{summary.title}</span>
      {state && <span className={`ref-card-state ref-state-${summary.state ?? 'neutral'}`}>{state}</span>}
    </>
  )
}

/** A reference link with its hover card. Plain `<a>` outside a ReferenceScope. */
const ReferenceLink = memo(function ReferenceLink({
  sigil,
  refId,
  href,
  text
}: {
  sigil: ReferenceQuery['sigil']
  refId: number
  href: string
  text: string
}): React.JSX.Element {
  const scope = useContext(ScopeContext)
  // Primitive props, so the memo holds across autolink's fresh output on every render.
  const q = useMemo(() => ({ sigil, id: refId }), [sigil, refId])
  const id = useId()
  const anchor = useRef<HTMLAnchorElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const { summary, loading } = useReferenceSummary(scope, q)

  useEffect(() => (scope ? registerVisible(scope, q) : undefined), [scope, q])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  // Placed from the link's box when opened; a scroll moves the link, so it closes the card.
  useLayoutEffect(() => {
    if (!open || !anchor.current) return
    const r = anchor.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left, window.innerWidth - CARD_WIDTH - 8))
    setPos({ left, top: r.bottom + 6 })
    const close = (): void => setOpen(false)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [open])

  if (!scope) return <a href={href}>{text}</a>

  const later = (fn: () => void, ms: number): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(fn, ms)
  }
  const show = (): void => {
    setOpen(true)
    requestSummaries(scope, q)
  }
  const hide = (): void => setOpen(false)

  return (
    <>
      <a
        ref={anchor}
        href={href}
        className="ref-link"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => later(show, OPEN_DELAY_MS)}
        onMouseLeave={() => later(hide, CLOSE_DELAY_MS)}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation()
            hide()
          }
        }}
      >
        {text}
      </a>
      {open &&
        pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="ref-card"
            style={{ left: pos.left, top: pos.top, width: CARD_WIDTH }}
            // The pointer may cross onto the card without it closing under it.
            onMouseEnter={() => timer.current && clearTimeout(timer.current)}
            onMouseLeave={() => later(hide, CLOSE_DELAY_MS)}
          >
            <ReferenceCardBody label={text} summary={summary} loading={loading} />
          </span>,
          document.body
        )}
    </>
  )
})

/** autolink's `renderReference`: every reference link gets its hover card. */
export function renderReferenceLink(q: ReferenceQuery, link: ReferenceLinkParts): React.ReactNode {
  return <ReferenceLink key={link.key} sigil={q.sigil} refId={q.id} href={link.href} text={link.text} />
}

const WITH_CARDS: AutolinkOptions = { renderReference: renderReferenceLink }
const WITH_CARDS_GITLAB: AutolinkOptions = { gitlab: true, renderReference: renderReferenceLink }

/** autolink options that give reference links their card — one constant per host kind, so memos hold. */
export function getReferenceAutolinkOptions(host: ReferenceHost | null): AutolinkOptions {
  return host?.gitlab ? WITH_CARDS_GITLAB : WITH_CARDS
}

/** The host of the scope above, or null outside one (or on a host with no cards). */
export function useReferenceHost(): ReferenceHost | null {
  return useContext(ScopeContext)?.host ?? null
}

/** A reference's title, muted, once it is known — nothing while it is not. */
export function ReferenceInlineTitle({ q }: { q: ReferenceQuery }): React.JSX.Element | null {
  const scope = useContext(ScopeContext)
  const { summary } = useReferenceSummary(scope, q)
  if (!summary?.available || !summary.title) return null
  return <span className="ref-inline-title">{summary.title}</span>
}
