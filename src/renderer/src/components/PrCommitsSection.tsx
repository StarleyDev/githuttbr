import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, DownloadCloud, ExternalLink, GitCompareArrows, Loader2, X } from 'lucide-react'
import type { CiStatus, PrCommit, PrCommitList, PrCommitStats, PrDetail, ReferenceQuery } from '../../../shared/types'
import { autolink, remoteWebUrl, type AutolinkOptions } from '../lib/autolink'
import { splitByLastVisit } from '../lib/prVisits'
import { splitWorkItemMentions } from '../lib/references'
import { getReferenceAutolinkOptions, ReferenceInlineTitle, usePrefetchReferences, useReferenceHost } from './ReferenceLink'
import { gitApi, hostingApi, shellApi } from '../infrastructure/api'
import { HostUserAvatar as Avatar } from './HostUserAvatar'
import { useUIStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { repoActions, useRepoStore } from '../stores/repo'
import { remoteForPrUrl } from '../lib/prBranchGo'
import { canFetchPrHead, getPrCommitWebUrl, groupCommitsByDay } from '../lib/prCommits'
import { timeAgo } from '../lib/timeAgo'
import { readableError } from '../lib/gitErrorHint'
import { getCommitSubjectParts, getCommitTypeTone, getCompareEnds, getPrCommitSummary } from '../lib/prCommitSummary'
import { openBranchCompare } from '../lib/branchCompare'
import { useT, interp, type TranslationKey } from '../i18n'

type Tokens = Parameters<typeof hostingApi.prListCommits>[2]

/**
 * A pull request's commits, read the first time the tab opens and again on
 * every `reload` after that — the page's refresh. Until the tab has been
 * opened nothing is asked of the host.
 */
export function usePrCommits(
  repoPath: string,
  remoteUrl: string,
  tokens: Tokens,
  number: number,
  active: boolean,
  reload: number
): { list: PrCommitList | null; error: string | null } {
  const [opened, setOpened] = useState(active)
  const [list, setList] = useState<PrCommitList | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (active) setOpened(true)
  }, [active])
  useEffect(() => {
    if (!opened) return
    let live = true
    setError(null)
    hostingApi
      .prListCommits(repoPath, remoteUrl, tokens, number)
      .then((l) => live && setList(l))
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      live = false
    }
  }, [opened, repoPath, remoteUrl, tokens, number, reload])
  return { list, error }
}

const fmtDay = (day: string): string => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })

/** How many commits one ciStatuses call answers — main reads no more per call. */
const CI_BATCH = 40

const CI_TITLE: Record<CiStatus['state'], TranslationKey> = {
  success: 'prCommits.ciSuccess',
  failure: 'prCommits.ciFailure',
  pending: 'prCommits.ciPending',
  neutral: 'prCommits.ciNeutral'
}

/**
 * The Commits tab: a summary line (count, authors, size, Conventional Commit
 * types), then the pull request's commits oldest first, grouped by the day they
 * were authored. A row opens its commit in the repository's view when this
 * clone has it, and offers to fetch the pull request's branch when it does not.
 */
export function PrCommitsSection({
  repoPath,
  remoteUrl,
  pr,
  list,
  error,
  lastVisit
}: {
  repoPath: string
  remoteUrl: string
  pr: PrDetail
  list: PrCommitList | null
  error: string | null
  /** When you last left this pull request (lib/prVisits), null on a first visit. */
  lastVisit: number | null
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const githubToken = useSettingsStore((s) => s.activeProfile().githubToken)
  // Which of the listed commits this clone has; null while it is being asked.
  const [local, setLocal] = useState<Set<string> | null>(null)
  // What each local commit changed, read from git once the local set is known.
  const [stats, setStats] = useState<Record<string, PrCommitStats>>({})
  const [ci, setCi] = useState<Record<string, CiStatus>>({})
  const [fetching, setFetching] = useState(false)
  // "Compare two commits": the rows grow a checkbox until two are picked.
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  // "3m ago" moves on while the tab stays open.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])
  const shas = useMemo(() => list?.commits.map((c) => c.sha) ?? [], [list])

  const readLocal = useCallback(
    (): Promise<Set<string>> =>
      gitApi
        .getLocalCommits(repoPath, shas)
        .then((found) => new Set(found))
        .catch(() => new Set<string>()),
    [repoPath, shas]
  )
  useEffect(() => {
    let live = true
    setLocal(null)
    void readLocal().then((found) => live && setLocal(found))
    return () => {
      live = false
    }
  }, [readLocal])

  // The numbers come from this clone, never the host: one git read for every
  // local commit, nothing for the ones not fetched yet.
  useEffect(() => {
    if (!local?.size) return
    let live = true
    void gitApi
      .getCommitStats(repoPath, [...local])
      .then((found) => live && setStats(found))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [repoPath, local])

  // CI per commit, quietly: no credential is no dots. The newest commits only —
  // one call's worth — since a long pull request would otherwise cost a host
  // request per commit, and CI usually ran on the pushed heads anyway.
  useEffect(() => {
    const recent = shas.slice(-CI_BATCH)
    if (!recent.length) return
    let live = true
    void hostingApi
      .ciStatuses(repoPath, remoteUrl, recent, githubToken ?? '')
      .catch(() => ({}) as Record<string, CiStatus>)
      .then((found) => live && setCi(found))
    return () => {
      live = false
    }
  }, [repoPath, remoteUrl, shas, githubToken])

  const groups = useMemo(() => groupCommitsByDay(list?.commits ?? []), [list])
  // The first commit made after your last visit, where the "new" divider goes —
  // the same rule as the Conversation tab, so both tabs agree on what is new.
  const firstFreshSha = useMemo(() => {
    const items = (list?.commits ?? []).map((c) => ({ at: Date.parse(c.authoredAt) || 0, sha: c.sha }))
    return splitByLastVisit(items, lastVisit).fresh[0]?.sha ?? null
  }, [list, lastVisit])
  const newDivider = (
    <div className="prt-new-divider prc-new-divider" role="separator">
      <span>{t('prTimeline.newDivider')}</span>
    </div>
  )
  const summary = useMemo(() => getPrCommitSummary(list?.commits ?? []), [list])

  // On Azure every work item in a subject (`AB#12`, or `#12`: the same item there) is read
  // up front, in one batch request, so its title can sit beside it. Elsewhere a title costs a
  // request per reference, so it waits for a hover on the commit's body.
  const refHost = useReferenceHost()
  const azure = !!refHost?.azure
  const subjectWorkItems = useMemo<ReferenceQuery[]>(
    () =>
      azure
        ? (list?.commits ?? []).flatMap((c) =>
            splitWorkItemMentions(c.subject).flatMap((s) => (s.id ? [{ sigil: 'AB#' as const, id: s.id }] : []))
          )
        : [],
    [azure, list]
  )
  usePrefetchReferences(subjectWorkItems)
  const web = remoteWebUrl(remoteUrl)
  const linkOptions = getReferenceAutolinkOptions(refHost)

  const openCommit = async (c: PrCommit): Promise<void> => {
    const here = local ?? (await readLocal())
    if (here.has(c.sha)) await repoActions.showCommitInRepo(repoPath, c.sha)
    else toast('info', interp(t('prPage.commitNotHereTitle'), { sha: c.shortSha }))
  }

  // Fetch the source branch, so every row can open. A fork's branch is not on
  // any remote here: the pull request's head is fetched instead, from the ref
  // the target repository mirrors it under.
  const fetchCommits = async (c: PrCommit): Promise<void> => {
    if (!useRepoStore.getState().repos[repoPath]) await useRepoStore.getState().ensure(repoPath)
    const remote = remoteForPrUrl(useRepoStore.getState().repos[repoPath]?.remotes ?? [], remoteUrl)
    if (!remote) {
      toast('info', interp(t('prPage.commitNoRemote'), { url: remoteUrl }))
      return
    }
    setFetching(true)
    try {
      const fetched = pr.sourceRepo
        ? await repoActions.fetchPrHead(repoPath, remote, pr.number)
        : await repoActions.fetchPrBranch(repoPath, remote, pr.source)
      if (!fetched) return
      const found = await readLocal()
      setLocal(found)
      if (!found.has(c.sha)) toast('info', pr.sourceRepo ? t('prPage.commitStillMissingFork') : t('prPage.commitStillMissing'))
    } finally {
      setFetching(false)
    }
  }

  // Two commits of the pull request, compared in the repository's view: the
  // older one is the base, so the diff reads in the order they were made.
  const togglePicked = async (sha: string): Promise<void> => {
    const next = picked.includes(sha) ? picked.filter((s) => s !== sha) : [...picked, sha].slice(-2)
    setPicked(next)
    const ends = list ? getCompareEnds(list.commits, next) : null
    if (!ends) return
    setPicking(false)
    setPicked([])
    if (!useRepoStore.getState().repos[repoPath]) await useRepoStore.getState().ensure(repoPath)
    useSettingsStore.getState().showRepoView(repoPath)
    openBranchCompare({ repoPath, branchA: ends.tip, branchB: ends.base })
  }
  const localCount = local ? shas.filter((s) => local.has(s)).length : 0

  if (error) return <div className="prd-error">{readableError(error, t, interp)}</div>
  if (!list) {
    return (
      <div className="prd-empty">
        <Loader2 size={15} className="spin" /> {t('prDetail.loading')}
      </div>
    )
  }
  if (!list.commits.length) return <p className="prp-muted prp-pad">{t('prPage.noCommits')}</p>

  return (
    <div className="prp-commit-tab prc-tab">
      {list.truncated && (
        <p className="prp-side-note prp-commit-cap">
          {/* Which end the host listed first is the end that was kept. */}
          {interp(t(list.kept === 'newest' ? 'prPage.commitsTruncatedNewest' : 'prPage.commitsTruncatedOldest'), {
            n: String(list.commits.length)
          })}{' '}
          <button type="button" className="prp-link" onClick={() => void shellApi.openExternal(pr.url)}>
            {t('common.openInBrowser')}
          </button>
        </p>
      )}
      <div className="prc-summary">
        <span className="prc-summary-counts">
          <span>
            {interp(t(summary.commits === 1 ? 'prCommits.countOne' : 'prCommits.count'), { n: summary.commits })}
          </span>
          <span>
            {interp(t(summary.authors === 1 ? 'prCommits.authorsOne' : 'prCommits.authors'), { n: summary.authors })}
          </span>
          {pr.additions !== undefined && pr.deletions !== undefined && (
            <span>
              <span className="ins-add">+{pr.additions}</span> <span className="ins-del">−{pr.deletions}</span>
            </span>
          )}
        </span>
        {summary.types.length > 0 && (
          <span className="prc-summary-types">
            {summary.types.map(({ type, count }) => (
              <span
                key={type}
                className={`prc-type-chip prc-tone-${getCommitTypeTone(type)}`}
                title={interp(t('prCommits.typeCountTitle'), { type, n: count })}
              >
                {type} {count}
              </span>
            ))}
          </span>
        )}
        <span className="prc-summary-gap" />
        {list.commits.length > 1 &&
          (picking ? (
            <span className="prc-compare-picking" role="status">
              {t('prCommits.compareHint')}
              <button
                type="button"
                className="prc-btn"
                onClick={() => {
                  setPicking(false)
                  setPicked([])
                }}
              >
                <X size={12} aria-hidden="true" /> {t('common.cancel')}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="prc-btn"
              disabled={localCount < 2}
              title={localCount < 2 ? t('prCommits.compareNeedsLocal') : t('prCommits.compareTitle')}
              onClick={() => setPicking(true)}
            >
              <GitCompareArrows size={12} aria-hidden="true" /> {t('prCommits.compare')}
            </button>
          ))}
      </div>
      {groups.map((g, i) => (
        <section key={`${g.day}-${i}`} className="prp-commit-day">
          {g.commits[0]?.sha === firstFreshSha && newDivider}
          <h3 className="prc-day-title">{g.day ? fmtDay(g.day) : t('prPage.commitsNoDate')}</h3>
          <ul className="prc-list">
            {g.commits.map((c, j) => (
              <Fragment key={c.sha}>
              {j > 0 && c.sha === firstFreshSha && <li className="prc-new-row">{newDivider}</li>}
              <PrCommitRow
                commit={c}
                prUrl={pr.url}
                web={web}
                linkOptions={linkOptions}
                titlesInline={azure}
                now={now}
                isLocal={local ? local.has(c.sha) : null}
                stats={stats[c.sha.toLowerCase()]}
                ci={ci[c.sha]}
                inFork={!!pr.sourceRepo}
                canFetch={!pr.sourceRepo || canFetchPrHead(remoteUrl)}
                fetching={fetching}
                picking={picking}
                isPicked={picked.includes(c.sha)}
                onPick={() => void togglePicked(c.sha)}
                onOpen={() => void openCommit(c)}
                onFetch={() => void fetchCommits(c)}
                onCopy={(sha) =>
                  navigator.clipboard.writeText(sha).then(
                    () => toast('success', t('prPage.commitShaCopied')),
                    () => toast('error', t('prPage.commitCopyFailed'))
                  )
                }
              />
              </Fragment>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PrCommitRow({
  commit: c,
  prUrl,
  web: repoWeb,
  linkOptions,
  titlesInline,
  now,
  isLocal,
  stats,
  ci,
  inFork,
  canFetch,
  fetching,
  picking,
  isPicked,
  onPick,
  onOpen,
  onFetch,
  onCopy
}: {
  commit: PrCommit
  prUrl: string
  /** The repository's web address, for the body's `#12` links. */
  web: string | undefined
  linkOptions: AutolinkOptions
  /** Show a work item's title beside it in the subject (Azure: read in one batch). */
  titlesInline: boolean
  now: number
  /** Null while it is not known yet. */
  isLocal: boolean | null
  /** What it changed; absent until read, for a merge, or for a commit not here. */
  stats: PrCommitStats | undefined
  ci: CiStatus | undefined
  /** The branch lives in a fork: the pull request's head is fetched instead of the branch. */
  inFork: boolean
  /** Something can be fetched here: false for a fork on a host that mirrors no head. */
  canFetch: boolean
  fetching: boolean
  /** Picking two commits to compare: a checkbox leads the row. */
  picking: boolean
  isPicked: boolean
  onPick: () => void
  onOpen: () => void
  onFetch: () => void
  onCopy: (sha: string) => Promise<void>
}): React.JSX.Element {
  const t = useT()
  const web = getPrCommitWebUrl(prUrl, c.sha)
  const at = Date.parse(c.authoredAt)
  const ago = Number.isNaN(at) ? null : timeAgo(at, now)
  const parts = getCommitSubjectParts(c.subject)
  const missing = isLocal === false
  const subjectText = !c.subject ? c.shortSha : titlesInline ? <SubjectWithTitles subject={parts.rest} /> : parts.rest
  return (
    <li className={`prc-commit ${missing ? 'is-remote' : ''}`}>
      <div className="prc-row">
        {picking && (
          <input
            type="checkbox"
            className="prc-pick"
            checked={isPicked}
            disabled={missing}
            aria-label={interp(t('prCommits.comparePick'), { sha: c.shortSha })}
            onChange={onPick}
          />
        )}
        <button
          type="button"
          className="prc-open"
          // While picking, the whole row picks — a missing commit cannot be compared.
          onClick={picking ? (missing ? undefined : onPick) : onOpen}
          title={missing ? interp(t('prPage.commitNotHereTitle'), { sha: c.shortSha }) : interp(t('prPage.commitOpenTitle'), { sha: c.shortSha })}
        >
          <Avatar login={c.authorLogin ?? c.authorName} url={c.authorAvatar} size={20} />
          <span className="prc-text">
            <span className="prc-subject">
              {parts.type && (
                <>
                  <span className={`prc-type prc-tone-${getCommitTypeTone(parts.type)}`}>
                    {parts.type}
                    {parts.breaking ? '!' : ''}
                  </span>{' '}
                </>
              )}
              {parts.scope && <span className="prc-scope">{parts.scope}: </span>}
              {subjectText}
            </span>
            <span className="prc-meta">
              <span>{c.authorName}</span>
              {ago && <span title={new Date(at).toLocaleString()}>{interp(t(ago.key), { n: ago.n })}</span>}
              {missing ? (
                <span>{t('prCommits.notHereYet')}</span>
              ) : (
                stats && (
                  <>
                    <span>
                      <span className="ins-add">+{stats.additions}</span> <span className="ins-del">−{stats.deletions}</span>
                    </span>
                    <span>{interp(t(stats.files === 1 ? 'prCommits.filesOne' : 'prCommits.files'), { n: stats.files })}</span>
                  </>
                )
              )}
              {c.parents !== undefined && c.parents > 1 && <span className="prp-commit-badge">{t('prPage.commitMergeBadge')}</span>}
            </span>
          </span>
        </button>
        {ci && (
          <span className={`prc-ci is-${ci.state}`} title={t(CI_TITLE[ci.state])}>
            <span aria-hidden="true">●</span> {t('prCommits.ciLabel')}
          </span>
        )}
        <code className="prc-sha">{c.shortSha}</code>
        <span className="prc-tools">
          <button type="button" className="icon-btn" title={t('prPage.commitCopySha')} aria-label={t('prPage.commitCopySha')} onClick={() => void onCopy(c.sha)}>
            <Copy size={12} />
          </button>
          {web && (
            <button
              type="button"
              className="icon-btn"
              title={t('common.openInBrowser')}
              aria-label={t('common.openInBrowser')}
              onClick={() => void shellApi.openExternal(web)}
            >
              <ExternalLink size={12} />
            </button>
          )}
        </span>
        {!missing ? (
          <button
            type="button"
            className="prc-btn"
            aria-label={interp(t('prCommits.viewDiffTitle'), { sha: c.shortSha })}
            title={interp(t('prCommits.viewDiffTitle'), { sha: c.shortSha })}
            onClick={onOpen}
          >
            {t('prCommits.viewDiff')}
          </button>
        ) : canFetch ? (
          <button
            type="button"
            className="prc-btn is-accent"
            title={inFork ? t('prPage.commitInFork') : t('prPage.commitNotHere')}
            disabled={fetching}
            onClick={onFetch}
          >
            {fetching ? <Loader2 size={12} className="spin" aria-hidden="true" /> : <DownloadCloud size={12} aria-hidden="true" />}{' '}
            {inFork ? t('prPage.commitFetchPrHead') : t('prCommits.fetchBranch')}
          </button>
        ) : (
          web && (
            <button
              type="button"
              className="prc-btn"
              title={t('prPage.commitInForkNoHead')}
              onClick={() => void shellApi.openExternal(web)}
            >
              <ExternalLink size={12} aria-hidden="true" /> {t('common.openInBrowser')}
            </button>
          )
        )}
      </div>
      {c.body && <p className="prc-body">{autolink(c.body, repoWeb, undefined, linkOptions)}</p>}
    </li>
  )
}

/** A commit subject with each work item's title, muted, beside it once known. */
function SubjectWithTitles({ subject }: { subject: string }): React.JSX.Element {
  return (
    <>
      {splitWorkItemMentions(subject).map((s, i) =>
        s.id ? (
          <span key={i}>
            {s.text}
            <ReferenceInlineTitle q={{ sigil: 'AB#', id: s.id }} />
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  )
}
