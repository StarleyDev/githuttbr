import { useEffect, useRef, useState } from 'react'
import { DownloadCloud, ExternalLink, Loader2 } from 'lucide-react'
import type { PrDetail, PrFile } from '../../../shared/types'
import { getImageSides, type PrDiffCommits, type PrImageContent, type PrImageSide } from '../../../shared/prImage'
import { gitApi, hostingApi, shellApi } from '../infrastructure/api'
import { useUIStore } from '../stores/ui'
import { canFetchPrHead } from '../lib/prCommits'
import { formatBytes } from '../lib/fileSize'
import { readableError } from '../lib/gitErrorHint'
import type { PrImageCache } from '../lib/prImageCache'
import { useT, interp } from '../i18n'
import { ImageDiff } from './ImageDiff'
import { fetchPrCommitsHere } from './PrUpdateDiff'

type Tokens = Parameters<typeof hostingApi.prFileContent>[2]

/** What a Files tab needs to preview its images: where to read them, and at which commits. */
export interface PrImageSource {
  repoPath: string
  remoteUrl: string
  tokens: Tokens
  pr: Pick<PrDetail, 'number' | 'url' | 'source' | 'sourceRepo'>
  /** The two commits the diff compares — the PR's merge base and head, or an update's two heads. */
  getCommits: () => Promise<PrDiffCommits | null>
  cache: PrImageCache
}

/** The page on the host that lists a pull request's files (GitHub's /files, GitLab's /diffs). */
export function getPrFilesUrl(prUrl: string): string {
  return `${prUrl}${prUrl.includes('/-/merge_requests/') ? '/diffs' : '/files'}`
}

type PreviewState =
  | { status: 'loading' }
  /** `approximate`: the "before" is the target branch's tip, not the merge base. */
  | { status: 'ready'; before: string | null; after: string | null; approximate: boolean }
  | { status: 'tooLarge'; size: number }
  | { status: 'lfs' }
  | { status: 'failed'; error?: string }

/**
 * One side of an image: from this clone when it has the commit — the same blob
 * read the commit view's image diff makes, no API cost — else from the host
 * with the repository's profile. Remembered for the page's life.
 */
function getImageContent(source: PrImageSource, side: PrImageSide): Promise<PrImageContent> {
  // Cached, or one read shared with anyone asking for it meanwhile.
  return source.cache.loadImage(side.sha, side.path, async () => {
    const here = await gitApi.getLocalCommits(source.repoPath, [side.sha]).catch(() => [] as string[])
    let content: PrImageContent = { status: 'missing' }
    if (here.length === 1) {
      content = await gitApi.getImageBlob(source.repoPath, side.sha, side.path).catch(() => content)
    }
    if (content.status === 'missing') {
      content = await hostingApi.prFileContent(source.repoPath, source.remoteUrl, source.tokens, side.sha, side.path)
    }
    return content
  })
}

/**
 * A pull request file that is an image, drawn the way the commit view draws
 * one (ImageDiff: the new image, the old one, or before and after side by side
 * and as a slider). Line comments do not apply, so there is no "+" here. When
 * neither this clone nor the host gives the bytes, the reader is offered the
 * branch fetch and the host's own page.
 */
export function PrImagePreview({ source, file }: { source: PrImageSource; file: PrFile }): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const [state, setState] = useState<PreviewState>({ status: 'loading' })
  const [tries, setTries] = useState(0)
  const [fetching, setFetching] = useState(false)
  // The file whose picture is on screen: a refresh of the same file keeps it
  // there while the (cached) read runs, instead of flashing "loading".
  const shownFor = useRef<string | null>(null)
  const fileKey = `${file.filename}\u0000${file.status}\u0000${file.previousFilename ?? ''}`

  useEffect(() => {
    let live = true
    if (shownFor.current !== fileKey) setState({ status: 'loading' })
    const read = async (): Promise<PreviewState> => {
      const commits = await source.getCommits()
      if (!commits) return { status: 'failed' }
      const sides = getImageSides(file, commits)
      const [before, after] = await Promise.all([
        sides.before ? getImageContent(source, sides.before) : null,
        sides.after ? getImageContent(source, sides.after) : null
      ])
      const big = [before, after].find((c) => c?.status === 'tooLarge')
      if (big && big.status === 'tooLarge') return { status: 'tooLarge', size: big.size }
      if (before?.status === 'lfs' || after?.status === 'lfs') return { status: 'lfs' }
      // Every side this file should have must be here: half a modified image misleads.
      if ((sides.before && before?.status !== 'ok') || (sides.after && after?.status !== 'ok')) return { status: 'failed' }
      const url = (c: PrImageContent | null): string | null => (c?.status === 'ok' ? c.dataUrl : null)
      return { status: 'ready', before: url(before), after: url(after), approximate: !!sides.before && !!commits.baseApproximate }
    }
    read()
      .catch((err: unknown): PreviewState => ({ status: 'failed', error: err instanceof Error ? err.message : String(err) }))
      .then((s) => {
        if (!live) return
        shownFor.current = fileKey
        setState(s)
      })
    return () => {
      live = false
    }
    // The file by value: a refresh hands over an equal object, which reads nothing again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, fileKey, tries])

  if (state.status === 'loading') {
    return (
      <div className="prd-empty">
        <Loader2 size={15} className="spin" /> {t('prDetail.loading')}
      </div>
    )
  }
  if (state.status === 'ready') {
    return (
      <>
        {state.approximate && <p className="prp-side-note prp-image-note">{t('prImage.baseApproximate')}</p>}
        <ImageDiff before={state.before} after={state.after} />
      </>
    )
  }

  const openOnHost = (
    <button className="btn ghost small" onClick={() => void shellApi.openExternal(getPrFilesUrl(source.pr.url))}>
      <ExternalLink size={13} /> {t('common.openInBrowser')}
    </button>
  )
  if (state.status === 'lfs') {
    return (
      <div className="prp-no-patch">
        <p>{t('prImage.lfs')}</p>
        {openOnHost}
      </div>
    )
  }
  if (state.status === 'tooLarge') {
    return (
      <div className="prp-no-patch">
        <p>{interp(t('prImage.tooLarge'), { size: formatBytes(state.size) })}</p>
        {openOnHost}
      </div>
    )
  }
  const inFork = !!source.pr.sourceRepo
  const canFetch = !inFork || canFetchPrHead(source.remoteUrl)
  const fetchCommits = async (): Promise<void> => {
    setFetching(true)
    try {
      if (await fetchPrCommitsHere(source.repoPath, source.remoteUrl, source.pr, toast)) setTries((n) => n + 1)
    } finally {
      setFetching(false)
    }
  }
  return (
    <div className="prp-no-patch">
      <p>
        {t('prImage.unavailable')}
        {state.error ? ` ${readableError(state.error, t, interp)}` : ''}
      </p>
      <div className="prp-image-actions">
        {canFetch && (
          <button type="button" className="btn ghost small" onClick={() => void fetchCommits()} disabled={fetching}>
            {fetching ? <Loader2 size={13} className="spin" /> : <DownloadCloud size={13} />}{' '}
            {inFork ? t('prPage.commitFetchPrHead') : t('prUpdates.fetchBranch')}
          </button>
        )}
        {openOnHost}
      </div>
    </div>
  )
}
