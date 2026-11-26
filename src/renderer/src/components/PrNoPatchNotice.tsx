import { useCallback, useEffect, useMemo, useState } from 'react'
import { DownloadCloud, Loader2, RotateCw } from 'lucide-react'
import type { PrFile } from '../../../shared/types'
import { hostingApi } from '../infrastructure/api'
import { repoActions, useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'
import { remoteForPrUrl } from '../lib/prBranchGo'
import { canFetchPrHead } from '../lib/prCommits'
import { getNoPatchNotice } from '../lib/prNoPatch'
import { readableError } from '../lib/gitErrorHint'
import { guessLanguage } from '../lib/highlight'
import { isSecretFile } from '../lib/secrets'
import { DiffViewer } from './DiffViewer'
import { useT, interp } from '../i18n'

/**
 * What the Files tab shows for a pull request file with no diff: the true
 * reason (binary, too large, not read yet, failed, left out by the host, only
 * renamed) and, where something can be done, the button for it — read it now,
 * try again, or fetch the pull request so this clone can diff it. A file read
 * here is handed to the page (`onFileDiffRead`), which takes it into its list
 * when it is of the revision the list shows — then the normal viewer draws it,
 * line comments included. Otherwise (an update's own diff) it is drawn here.
 */

/** Files read on demand, by head and path — opening a file twice reads it once. */
const loaded = new Map<string, PrFile>()
const LOADED_MAX = 200
const keyOf = (f: PrFile): string => `${f.diffSource?.headSha ?? ''}:${f.diffSource?.baseSha ?? ''}:${f.filename}`

function rememberLoaded(key: string, file: PrFile): void {
  if (loaded.size >= LOADED_MAX) loaded.delete(loaded.keys().next().value as string)
  loaded.set(key, file)
}

export function PrNoPatchNotice({
  file,
  repoPath,
  onFileDiffRead,
  onFetched
}: {
  file: PrFile
  repoPath: string
  /** A read with a patch, for the page to take into its list. */
  onFileDiffRead?: (read: PrFile) => void
  /** The PR's commits are here now: the page reads its list again, from this clone. */
  onFetched?: () => void
}): React.JSX.Element {
  const t = useT()
  const toast = useUIStore((s) => s.toast)
  const profile = useSettingsStore((s) => s.activeProfile())
  const maskSecrets = useSettingsStore((s) => s.settings.maskSecrets)
  // The same tokens the page sends; main resolves the profile's own either way.
  const tokens = useMemo(
    () => ({
      github: profile.githubToken || undefined,
      gitlab: profile.gitlabToken || undefined,
      forgejo: profile.forgejoToken || undefined,
      azure: profile.azureToken || undefined
    }),
    [profile.githubToken, profile.gitlabToken, profile.forgejoToken, profile.azureToken]
  )
  const [shown, setShown] = useState<PrFile>(() => loaded.get(keyOf(file)) ?? file)
  const [busy, setBusy] = useState(false)
  const notice = getNoPatchNotice(shown)
  const source = shown.diffSource

  const readFileDiff = useCallback(async (): Promise<void> => {
    if (!source) return
    setBusy(true)
    try {
      const read = await hostingApi.prFileDiff(repoPath, source.remoteUrl, tokens, {
        file: { filename: file.filename, status: file.status, ...(file.previousFilename ? { previousFilename: file.previousFilename } : {}) },
        source
      })
      if (read.patch) {
        rememberLoaded(keyOf(file), read)
        onFileDiffRead?.(read)
      }
      setShown(read)
    } catch (err) {
      setShown((s) => ({ ...s, noPatchReason: 'failed', noPatchError: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }, [repoPath, tokens, file, source, onFileDiffRead])

  // A file the list did not read yet is read when it is opened; one read before goes straight to the page.
  const autoLoad = notice.autoLoad
  useEffect(() => {
    if (shown.patch) onFileDiffRead?.(shown)
    else if (autoLoad) void readFileDiff()
    // Once per file: a failure shows its button rather than trying in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.filename])

  // The same fetch as the Updates tab: the two commits by id, then a fork's PR head.
  const fetchPrCommits = async (): Promise<void> => {
    if (!source) return
    if (!useRepoStore.getState().repos[repoPath]) await useRepoStore.getState().ensure(repoPath)
    const remote = remoteForPrUrl(useRepoStore.getState().repos[repoPath]?.remotes ?? [], source.remoteUrl)
    if (!remote) {
      toast('info', interp(t('prPage.commitNoRemote'), { url: source.remoteUrl }))
      return
    }
    setBusy(true)
    let fetched = false
    try {
      fetched = await repoActions.fetchPrUpdateCommits(repoPath, remote, [source.baseSha, source.headSha])
      if (!fetched && canFetchPrHead(source.remoteUrl)) fetched = await repoActions.fetchPrHead(repoPath, remote, source.number)
    } finally {
      setBusy(false)
    }
    // With the commits here the whole list is read again from this clone; without a page to do it, this file.
    if (fetched && onFetched) onFetched()
    else await readFileDiff()
  }

  if (shown.patch) {
    return (
      <DiffViewer
        diff={shown.patch}
        file={shown.filename}
        lang={guessLanguage(shown.filename)}
        maskValues={maskSecrets && isSecretFile(shown.filename)}
        repoPath={repoPath}
      />
    )
  }

  const icon = busy ? <Loader2 size={13} className="spin" aria-hidden="true" /> : null
  return (
    <div className="prp-no-patch-notice" role="status">
      <p>{busy && notice.action === 'load' ? t('prPage.noPatchLoading') : t(notice.messageKey)}</p>
      {shown.noPatchReason === 'failed' && shown.noPatchError && (
        <p className="prp-side-note">{readableError(shown.noPatchError, t, interp)}</p>
      )}
      {notice.action === 'load' && (
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => void readFileDiff()}>
          {icon ?? <DownloadCloud size={13} aria-hidden="true" />} {t('prPage.noPatchLoad')}
        </button>
      )}
      {notice.action === 'retry' && (
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => void readFileDiff()}>
          {icon ?? <RotateCw size={13} aria-hidden="true" />} {t('prPage.noPatchRetry')}
        </button>
      )}
      {notice.action === 'fetch' && (
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => void fetchPrCommits()}>
          {icon ?? <DownloadCloud size={13} aria-hidden="true" />} {t('prPage.noPatchFetch')}
        </button>
      )}
    </div>
  )
}
