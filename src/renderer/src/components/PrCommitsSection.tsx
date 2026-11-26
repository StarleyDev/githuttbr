import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, DownloadCloud, ExternalLink, GitCommitHorizontal, Loader2 } from 'lucide-react'
import type { PrCommit, PrCommitList, PrDetail } from '../../../shared/types'
import { gitApi, hostingApi, shellApi } from '../infrastructure/api'
import { HostUserAvatar as Avatar } from './HostUserAvatar'
import { useUIStore } from '../stores/ui'
import { repoActions, useRepoStore } from '../stores/repo'
import { remoteForPrUrl } from '../lib/prBranchGo'
import { getPrCommitWebUrl, groupCommitsByDay } from '../lib/prCommits'
import { timeAgo } from '../lib/timeAgo'
import { readableError } from '../lib/gitErrorHint'
import { useT, interp } from '../i18n'

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

/**
 * The Commits tab: the pull request's commits oldest first, grouped by the
 * day they were authored. A row opens its commit in the repository's view
 * when this clone has it; otherwise it says why not, and offers to fetch the
 * pull request's branch, or the host.
 */
export function PrCommitsSection({
  repoPath,
  remoteUrl,
  pr,
  list,
  error
}: {
  repoPath: string
  remoteUrl: string
  pr: PrDetail
  list: PrCommitList | null
  error: string | null
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  // Which of the listed commits this clone has; null while it is being asked.
  const [local, setLocal] = useState<Set<string> | null>(null)
  // The commit whose "not here" notice is open, by sha.
  const [missing, setMissing] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
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

  const groups = useMemo(() => groupCommitsByDay(list?.commits ?? []), [list])

  const openCommit = async (c: PrCommit): Promise<void> => {
    const here = local ?? (await readLocal())
    if (here.has(c.sha)) {
      setMissing(null)
      await repoActions.showCommitInRepo(repoPath, c.sha)
    } else setMissing(c.sha)
  }

  // Fetch the source branch, then open the commit if it came with it. A fork's
  // branch is not on any remote here; the notice offers only the host then.
  const fetchAndOpen = async (c: PrCommit): Promise<void> => {
    if (!useRepoStore.getState().repos[repoPath]) await useRepoStore.getState().ensure(repoPath)
    const remote = remoteForPrUrl(useRepoStore.getState().repos[repoPath]?.remotes ?? [], remoteUrl)
    if (!remote) {
      toast('info', interp(t('prPage.commitNoRemote'), { url: remoteUrl }))
      return
    }
    setFetching(true)
    try {
      if (!(await repoActions.fetchPrBranch(repoPath, remote, pr.source))) return
      const found = await readLocal()
      setLocal(found)
      if (found.has(c.sha)) {
        setMissing(null)
        await repoActions.showCommitInRepo(repoPath, c.sha)
      } else toast('info', t('prPage.commitStillMissing'))
    } finally {
      setFetching(false)
    }
  }

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
    <div className="prp-commit-tab">
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
      {groups.map((g, i) => (
        <section key={`${g.day}-${i}`} className="prp-commit-day">
          <h3 className="prp-commit-day-title">
            <GitCommitHorizontal size={14} />
            {g.day ? interp(t('prPage.commitsOn'), { date: fmtDay(g.day) }) : t('prPage.commitsNoDate')}
          </h3>
          <ul className="prp-commit-list">
            {g.commits.map((c) => (
              <PrCommitRow
                key={c.sha}
                commit={c}
                prUrl={pr.url}
                now={now}
                isLocal={local ? local.has(c.sha) : null}
                showMissing={missing === c.sha}
                canFetch={!pr.sourceRepo}
                fetching={fetching}
                onOpen={() => void openCommit(c)}
                onFetch={() => void fetchAndOpen(c)}
                onCopy={(sha) =>
                  navigator.clipboard.writeText(sha).then(
                    () => toast('success', t('prPage.commitShaCopied')),
                    () => toast('error', t('prPage.commitCopyFailed'))
                  )
                }
              />
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
  now,
  isLocal,
  showMissing,
  canFetch,
  fetching,
  onOpen,
  onFetch,
  onCopy
}: {
  commit: PrCommit
  prUrl: string
  now: number
  /** Null while it is not known yet. */
  isLocal: boolean | null
  showMissing: boolean
  /** The branch can be fetched from here — not a fork's. */
  canFetch: boolean
  fetching: boolean
  onOpen: () => void
  onFetch: () => void
  onCopy: (sha: string) => Promise<void>
}): React.JSX.Element {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const web = getPrCommitWebUrl(prUrl, c.sha)
  const at = Date.parse(c.authoredAt)
  const ago = Number.isNaN(at) ? null : timeAgo(at, now)
  const copySha = (): void => void onCopy(c.sha)
  return (
    <li className={`prp-commit ${isLocal === false ? 'is-remote' : ''}`}>
      <div className="prp-commit-row">
        <button
          type="button"
          className="prp-commit-open"
          onClick={onOpen}
          title={isLocal === false ? interp(t('prPage.commitNotHereTitle'), { sha: c.shortSha }) : interp(t('prPage.commitOpenTitle'), { sha: c.shortSha })}
        >
          <Avatar login={c.authorLogin ?? c.authorName} url={c.authorAvatar} size={20} />
          <span className="prp-commit-text">
            <span className="prp-commit-subject">{c.subject || c.shortSha}</span>
            <span className="prp-commit-meta">
              <strong>{c.authorName}</strong>
              {ago && <span title={new Date(at).toLocaleString()}>{interp(t(ago.key), { n: ago.n })}</span>}
              {c.parents !== undefined && c.parents > 1 && <span className="prp-commit-badge">{t('prPage.commitMergeBadge')}</span>}
            </span>
          </span>
        </button>
        {c.body && (
          <button
            type="button"
            className="icon-btn prp-commit-more"
            aria-expanded={expanded}
            title={expanded ? t('prPage.commitShowLess') : t('prPage.commitShowMore')}
            aria-label={expanded ? t('prPage.commitShowLess') : t('prPage.commitShowMore')}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        )}
        <code className="prp-commit-sha">{c.shortSha}</code>
        <button type="button" className="icon-btn" title={t('prPage.commitCopySha')} aria-label={t('prPage.commitCopySha')} onClick={copySha}>
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
      </div>
      {expanded && c.body && <pre className="prp-commit-body">{c.body}</pre>}
      {showMissing && (
        <div className="prp-commit-missing" role="status">
          <span>{canFetch ? t('prPage.commitNotHere') : t('prPage.commitInFork')}</span>
          {canFetch && (
            <button type="button" className="btn ghost tiny" onClick={onFetch} disabled={fetching}>
              {fetching ? <Loader2 size={12} className="spin" /> : <DownloadCloud size={12} />} {t('prPage.commitFetchBranch')}
            </button>
          )}
          {web && (
            <button type="button" className="btn ghost tiny" onClick={() => void shellApi.openExternal(web)}>
              <ExternalLink size={12} /> {t('common.openInBrowser')}
            </button>
          )}
        </div>
      )}
    </li>
  )
}
