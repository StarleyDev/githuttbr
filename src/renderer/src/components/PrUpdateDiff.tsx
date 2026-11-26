import { useCallback, useEffect, useState } from 'react'
import { DownloadCloud, Info, Loader2, MessageSquareOff, Undo2 } from 'lucide-react'
import type { PrDetail, PrFile, PrUpdate } from '../../../shared/types'
import { gitApi, hostingApi } from '../infrastructure/api'
import { repoActions, useRepoStore } from '../stores/repo'
import { useUIStore } from '../stores/ui'
import { remoteForPrUrl } from '../lib/prBranchGo'
import { canFetchPrHead } from '../lib/prCommits'
import { getUpdateTitle, type UpdateCompare, type UpdateNumbering } from '../lib/prUpdates'
import { readableError } from '../lib/gitErrorHint'
import { useT, interp, t } from '../i18n'

type Tokens = Parameters<typeof hostingApi.prUpdateFiles>[2]

/** The update whose own changes the Files tab shows instead of the whole PR's. */
export interface UpdateDiffView {
  update: PrUpdate
  compare: UpdateCompare
  numbering: UpdateNumbering
}

export type UpdateDiffState =
  | { status: 'loading' }
  /** `fromMergeBase`: the host diffed from the two heads' merge base, not between them. */
  | { status: 'ready'; files: PrFile[]; fromMergeBase: boolean }
  /** Neither this clone nor the host could diff the two commits. */
  | { status: 'missing'; error?: string }

/**
 * The files one update changed. This clone first — `git diff` between the two
 * heads is exact, fast, and asks nothing of the host. A head that is not here
 * is fetched by its id from the pull request's remote; only when that fails is
 * the host's compare used, which on GitHub and Data Center diffs from the
 * merge base. `retry` reads again, after the banner's branch fetch.
 */
export function usePrUpdateDiff(
  repoPath: string,
  remoteUrl: string,
  tokens: Tokens,
  number: number,
  view: UpdateDiffView | null
): { state: UpdateDiffState; retry: () => void } {
  const [state, setState] = useState<UpdateDiffState>({ status: 'loading' })
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (!view) return
    let live = true
    setState({ status: 'loading' })
    const { from, to } = view.compare
    const shas = [from.sha, to.sha]
    const diffHere = async (): Promise<PrFile[] | null> => {
      const here = await gitApi.getLocalCommits(repoPath, shas).catch(() => [] as string[])
      return here.length === 2 ? gitApi.getCommitRangeFiles(repoPath, from.sha, to.sha).catch(() => null) : null
    }
    const read = async (): Promise<UpdateDiffState> => {
      const local = await diffHere()
      if (local) return { status: 'ready', files: local, fromMergeBase: false }
      // Fetch the two heads by id from the PR's remote, then compare here.
      if (!useRepoStore.getState().repos[repoPath]) await useRepoStore.getState().ensure(repoPath).catch(() => undefined)
      const remote = remoteForPrUrl(useRepoStore.getState().repos[repoPath]?.remotes ?? [], remoteUrl)
      if (remote && (await repoActions.fetchPrUpdateCommits(repoPath, remote, shas))) {
        const fetched = await diffHere()
        if (fetched) return { status: 'ready', files: fetched, fromMergeBase: false }
      }
      try {
        const res = await hostingApi.prUpdateFiles(repoPath, remoteUrl, tokens, number, from, to)
        return res ? { status: 'ready', files: res.files, fromMergeBase: res.fromMergeBase } : { status: 'missing' }
      } catch (err) {
        return { status: 'missing', error: err instanceof Error ? err.message : String(err) }
      }
    }
    void read().then((s) => live && setState(s))
    return () => {
      live = false
    }
  }, [repoPath, remoteUrl, tokens, number, view, tries])
  const retry = useCallback(() => setTries((n) => n + 1), [])
  return { state, retry }
}

/**
 * The same fetch as the Commits tab's: the pull request's branch, or a fork's
 * PR head into `refs/githuttbr/pr/…`. True when it ran and brought the commits.
 * Shared by the update banner and the image preview's "fetch" offer.
 */
export async function fetchPrCommitsHere(
  repoPath: string,
  remoteUrl: string,
  pr: Pick<PrDetail, 'number' | 'source' | 'sourceRepo'>,
  toast: (kind: 'info', text: string) => void
): Promise<boolean> {
  if (!useRepoStore.getState().repos[repoPath]) await useRepoStore.getState().ensure(repoPath)
  const remote = remoteForPrUrl(useRepoStore.getState().repos[repoPath]?.remotes ?? [], remoteUrl)
  if (!remote) {
    toast('info', interp(t('prPage.commitNoRemote'), { url: remoteUrl }))
    return false
  }
  return pr.sourceRepo
    ? repoActions.fetchPrHead(repoPath, remote, pr.number)
    : repoActions.fetchPrBranch(repoPath, remote, pr.source)
}

/**
 * Above the Files tab while it shows one update: which update, against what,
 * the way back to the whole pull request — and, when the two heads could not
 * be compared, an offer to fetch the branch so this clone can.
 */
export function PrUpdateDiffBanner({
  repoPath,
  remoteUrl,
  pr,
  view,
  state,
  onRetry,
  onShowAll
}: {
  repoPath: string
  remoteUrl: string
  pr: PrDetail
  view: UpdateDiffView
  state: UpdateDiffState
  onRetry: () => void
  onShowAll: () => void
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const [fetching, setFetching] = useState(false)
  const { update, compare, numbering } = view
  const label = (u: { index: number; kind: PrUpdate['kind'] }): string => {
    const title = getUpdateTitle(u, numbering)
    return interp(t(title.key), title.vars)
  }
  const heading =
    compare.previousIndex === null
      ? interp(t('prUpdates.bannerVsBase'), { update: label({ index: update.index, kind: 'push' }) })
      : interp(t('prUpdates.bannerVsPrevious'), {
          update: label({ index: update.index, kind: 'push' }),
          prev: label({ index: compare.previousIndex, kind: 'push' })
        })
  const inFork = !!pr.sourceRepo
  const canFetch = !inFork || canFetchPrHead(remoteUrl)

  const fetchCommits = async (): Promise<void> => {
    setFetching(true)
    try {
      if (await fetchPrCommitsHere(repoPath, remoteUrl, pr, toast)) onRetry()
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="prp-update-banner" role="status">
      <div className="prp-update-banner-row">
        <strong>{heading}</strong>
        <button type="button" className="btn ghost tiny" onClick={onShowAll}>
          <Undo2 size={12} aria-hidden="true" /> {t('prUpdates.showAll')}
        </button>
      </div>
      <p className="prp-side-note prp-update-banner-note">
        <MessageSquareOff size={12} aria-hidden="true" /> {t('prUpdates.lineCommentsOff')}
      </p>
      {state.status === 'loading' && (
        <p className="prp-side-note">
          <Loader2 size={12} className="spin" aria-hidden="true" /> {t('prDetail.loading')}
        </p>
      )}
      {state.status === 'ready' && state.fromMergeBase && update.kind === 'rewrite' && (
        <p className="prp-side-note prp-update-banner-note">
          <Info size={12} aria-hidden="true" /> {t('prUpdates.mergeBaseNote')}
        </p>
      )}
      {state.status === 'ready' && state.files.length === 0 && <p className="prp-side-note">{t('prUpdates.diffEmpty')}</p>}
      {state.status === 'missing' && (
        <div className="prp-commit-missing prp-update-missing">
          <span>
            {t('prUpdates.diffMissing')}
            {state.error ? ` ${readableError(state.error, t, interp)}` : ''}
          </span>
          {canFetch && (
            <button type="button" className="btn ghost tiny" onClick={() => void fetchCommits()} disabled={fetching}>
              {fetching ? <Loader2 size={12} className="spin" /> : <DownloadCloud size={12} />}{' '}
              {inFork ? t('prPage.commitFetchPrHead') : t('prUpdates.fetchBranch')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
