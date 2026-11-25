import { useEffect, useState } from 'react'
import { FolderGit2, GitFork } from 'lucide-react'
import { gitApi } from '../infrastructure/api'
import { useSettingsStore } from '../stores/settings'
import { lookupRepoImage, tabLabelParts } from '../lib/repoImage'
import type { TabStatus } from '../lib/tabClose'
import { canonicalRepoName, repoDisplayName } from '../lib/repoAlias'
import { interp, useT } from '../i18n'
import { useWorktreeRoot } from './worktreeRoot'

// One read per repository and path for the life of the window: every tab strip
// re-render would otherwise ship the image across IPC again. The settings
// modal passes `fresh` so a replaced file shows up without a restart.
const cache = new Map<string, Promise<string | null>>()
const refreshed = new Set<(key: string) => void>()

const cacheKey = (repoPath: string, file: string): string => `${repoPath}\n${file}`

export function loadRepoImage(repoPath: string, file: string, fresh = false): Promise<string | null> {
  const key = cacheKey(repoPath, file)
  if (fresh) cache.delete(key)
  let hit = cache.get(key)
  if (!hit) {
    hit = gitApi.repoImage(repoPath, file).catch(() => null)
    cache.set(key, hit)
    // Tabs already showing this key re-read it, so fixing a broken path by
    // adding the file is visible without touching the setting.
    if (fresh) void hit.then(() => refreshed.forEach((fn) => fn(key)))
  }
  return hit
}

/** The data URL of a repository's configured tab image; null while loading,
 *  when none is set, or when the path is broken. */
export function useRepoImage(repoPath: string | undefined): string | null {
  const file = useSettingsStore((s) => (repoPath ? lookupRepoImage(repoPath, s.settings.repoImages) : undefined))
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    if (!repoPath || !file) return
    let live = true
    const key = cacheKey(repoPath, file)
    const read = (): void => void loadRepoImage(repoPath, file).then((u) => live && setUrl(u))
    const onRefresh = (k: string): void => {
      if (k === key) read()
    }
    read()
    refreshed.add(onRefresh)
    return () => {
      live = false
      refreshed.delete(onRefresh)
    }
  }, [repoPath, file])
  return url
}

/** Icon-and-name of a repository tab, following the "repository tabs show"
 *  setting. The name moves into the image's tooltip when it is hidden. Owns the
 *  working-tree dot too: beside the name it trails the label, but on an
 *  image-only tab it sits on the image's corner so the tab stays icon-sized.
 *  A linked worktree swaps the folder icon for a fork — a tab that is "the
 *  repository" and one that is a second checkout of it otherwise look alike. */
export function RepoTabLabel({
  repoPath,
  name,
  className,
  title,
  status,
  statusTitle,
  worktreeRoot
}: {
  repoPath: string | undefined
  name: string
  /** The ref's stored main-worktree folder, when it has one. */
  worktreeRoot?: string
  className: string
  title?: string
  status?: TabStatus
  statusTitle?: string
}): React.JSX.Element {
  const t = useT()
  const mode = useSettingsStore((s) => s.settings.tabRepoLabel)
  const aliases = useSettingsStore((s) => s.settings.repoAliases)
  const mainRoot = useWorktreeRoot(repoPath, worktreeRoot)
  // The main repository by the name its own tab shows (an alias wins).
  const worktreeOf = mainRoot
    ? interp(t('titlebar.worktreeOf'), { repo: repoDisplayName(mainRoot, aliases, canonicalRepoName(mainRoot)) })
    : undefined
  const worktreeTitle = worktreeOf ? `${worktreeOf}\n${repoPath ?? ''}` : undefined
  const url = useRepoImage(repoPath)
  const show = tabLabelParts(mode, url !== null)
  const solo = show.image && !show.name && url !== null
  const dot = status ? (
    <span className={`tab-status tab-status-${status} ${solo ? 'stacked' : ''}`} title={statusTitle} />
  ) : null
  return (
    <>
      {show.image && url ? (
        <span className="tab-repo-image-wrap">
          <img
            className={`tab-repo-image ${solo ? 'solo' : ''}`}
            src={url}
            alt={show.name ? '' : worktreeOf ? `${name} — ${worktreeOf}` : name}
            title={show.name ? undefined : (title ?? worktreeTitle ?? name)}
            draggable={false}
          />
          {mainRoot && <GitFork size={9} className="tab-worktree-badge" aria-hidden="true" />}
          {solo && dot}
        </span>
      ) : mainRoot ? (
        <GitFork size={13} className="tab-worktree-icon" role="img" aria-label={worktreeOf} />
      ) : (
        <FolderGit2 size={13} />
      )}
      {show.name && (
        <span className={className} title={title ?? worktreeTitle}>
          {name}
        </span>
      )}
      {!solo && dot}
    </>
  )
}
