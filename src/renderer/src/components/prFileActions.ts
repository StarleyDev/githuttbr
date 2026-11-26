import { gitApi, shellApi } from '../infrastructure/api'
import { useRepoStore } from '../stores/repo'
import { useSettingsStore } from '../stores/settings'
import { useUIStore, type MenuItem } from '../stores/ui'
import { openWithMenuItems } from '../lib/openWith'
import { t, interp } from '../i18n'

// What a pull request's Files tab can do with one of its paths, beyond reading
// the diff: copy it, and — when the file is in this clone's working tree — open
// it in the editor or show it in the file manager. Shared by the diff header's
// menu and the file list's right click, so the two always offer the same thing.

/** A row of the PR's file list, or the file open in the diff. */
export interface PrPathTarget {
  path: string
  isDir: boolean
  /** A renamed file's old path. */
  oldPath?: string
  /** added | modified | removed | renamed. */
  status?: string
}

const abs = (repoRoot: string, rel: string): string => `${repoRoot.replace(/\/+$/, '')}/${rel}`
const parentOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

/** Copy a repository-relative path, with the app's "copied" toast. */
export function copyPrPath(path: string): void {
  void navigator.clipboard.writeText(path)
  useUIStore.getState().toast('success', t('prFiles.pathCopied'))
}

/**
 * The menu for one path. The working tree is asked first, so "Open" and
 * "Reveal" are only live for what exists here; the reason is the disabled
 * entry's tooltip. The checked-out branch is not necessarily the pull
 * request's: then each opening entry says it opens the working copy.
 */
export async function getPrPathMenuItems(repoPath: string, target: PrPathTarget, prSource: string): Promise<MenuItem[]> {
  const folder = target.isDir ? target.path : parentOf(target.path)
  const items: MenuItem[] = []
  if (!target.isDir) {
    items.push({ label: t('fileTree.copyPath'), onClick: () => copyPrPath(target.path) })
    if (target.oldPath && target.oldPath !== target.path) {
      items.push({ label: t('prFiles.copyOldPath'), onClick: () => copyPrPath(target.oldPath!) })
    }
  }
  if (folder) items.push({ label: t('common.copyFolderPath'), onClick: () => copyPrPath(folder) })

  const asked = !target.isDir && folder ? [target.path, folder] : [target.path]
  const kinds = await gitApi.getWorkTreePathKinds(repoPath, asked).catch(() => [] as Array<'file' | 'dir' | null>)
  const kind = kinds[0] ?? null
  const folderKind = target.isDir ? kind : folder ? (kinds[1] ?? null) : 'dir'
  const exists = target.isDir ? kind === 'dir' : kind === 'file'

  const branch = useRepoStore.getState().repos[repoPath]?.branches.current ?? ''
  const elsewhere = !!branch && !!prSource && branch !== prSource
  const note = elsewhere ? interp(t('prFiles.workingCopyNote'), { branch }) : undefined
  // The note rides on the tooltip, and once more as a toast when something opens.
  const withNote = (run: () => void) => (): void => {
    run()
    if (note) useUIStore.getState().toast('info', note)
  }

  items.push({ separator: true })
  if (exists) {
    const { defaultOpenApp, editor } = useSettingsStore.getState().settings
    const full = abs(repoPath, target.path)
    const open = openWithMenuItems(
      full,
      defaultOpenApp,
      {
        openWithDefault: (name) => interp(t('fileTree.openWithApp'), { name }),
        openWith: t('fileTree.openWith')
      },
      editor,
      { isDir: target.isDir }
    )
    for (const it of open) items.push({ ...it, title: note, onClick: it.onClick && withNote(it.onClick) })
    items.push({ label: t(shellApi.revealLabelKey), title: note, onClick: withNote(() => void shellApi.revealInFolder(full)) })
  } else {
    const reason = target.status === 'removed' ? t('prFiles.deletedInPr') : interp(t('prFiles.notInWorkTree'), { branch: branch || '—' })
    items.push({ label: t('prFiles.openInEditor'), disabled: true, title: reason })
    items.push({ label: t(shellApi.revealLabelKey), disabled: true, title: reason })
    if (!target.isDir && folder && folderKind === 'dir') {
      items.push({ label: t('prFiles.revealFolder'), title: note, onClick: withNote(() => void shellApi.openPath(abs(repoPath, folder))) })
    }
  }
  return items
}

/** Open that menu at a point — a right click, or under the header's button. */
export function openPrPathMenu(x: number, y: number, repoPath: string, target: PrPathTarget, prSource: string): void {
  void getPrPathMenuItems(repoPath, target, prSource).then((items) => useUIStore.getState().openContextMenu(x, y, items))
}
