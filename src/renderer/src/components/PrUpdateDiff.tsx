import { useCallback, useEffect, useState } from 'react'
import { DownloadCloud, Loader2, MessageSquareOff, Undo2 } from 'lucide-react'
import type { PrDetail, PrFile, PrUpdate } from '../../../shared/types'
import { gitApi, hostingApi } from '../infrastructure/api'
import { repoActions, useRepoStore } from '../stores/repo'
import { useUIStore } from '../stores/ui'
import { remoteForPrUrl } from '../lib/prBranchGo'
import { canFetchPrHead } from '../lib/prCommits'
import type { UpdateCompare } from '../lib/prUpdates'
import { readableError } from '../lib/gitErrorHint'
import { useT, interp } from '../i18n'

type Tokens = Parameters<typeof hostingApi.prUpdateFiles>[2]

/** The update whose own changes the Files tab shows instead of the whole PR's. */
export interface UpdateDiffView {
  update: PrUpdate
  compare: UpdateCompare
}

export type UpdateDiffState =
  | { status: 'loading' }
  | { status: 'ready'; files: PrFile[] }
  /** Neither this clone nor the host could diff the two commits. */
  | { status: 'missing'; error?: string }

/**
 * The files one update changed. This clone first — `git diff` between the two
 * heads is fast and asks nothing of the host — and the host's compare when a
 * head is not here. `retry` reads again, after a fetch brought the commits.
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
    const read = async (): Promise<UpdateDiffState> => {
      const here = await gitApi.getLocalCommits(repoPath, [from.sha, to.sha]).catch(() => [] as string[])
      if (here.length === 2) {
        const local = await gitApi.getCommitRangeFiles(repoPath, from.sha, to.sha).catch(() => null)
        if (local) return { status: 'ready', files: local }
      }
      try {
        const files = await hostingApi.prUpdateFiles(repoPath, remoteUrl, tokens, number, from, to)
        return files ? { status: 'ready', files } : { status: 'missing' }
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
  const { update, compare } = view
  const heading =
    compare.previousIndex === null
      ? interp(t('prUpdates.bannerVsBase'), { n: String(update.index) })
      : interp(t('prUpdates.bannerVsPrevious'), { n: String(update.index), prev: String(compare.previousIndex) })
  const inFork = !!pr.sourceRepo
  const canFetch = !inFork || canFetchPrHead(remoteUrl)

  // The same fetch as the Commits tab's: the branch, or a fork's PR head.
  const fetchCommits = async (): Promise<void> => {
    if (!useRepoStore.getState().repos[repoPath]) await useRepoStore.getState().ensure(repoPath)
    const remote = remoteForPrUrl(useRepoStore.getState().repos[repoPath]?.remotes ?? [], remoteUrl)
    if (!remote) {
      toast('info', interp(t('prPage.commitNoRemote'), { url: remoteUrl }))
      return
    }
    setFetching(true)
    try {
      const fetched = inFork
        ? await repoActions.fetchPrHead(repoPath, remote, pr.number)
        : await repoActions.fetchPrBranch(repoPath, remote, pr.source)
      if (fetched) onRetry()
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
