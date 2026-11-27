import type { AppSettings } from '../../../shared/types'
import type { EditorSetting } from '../../../shared/editors'
import type { MenuItem } from '../stores/ui'
import { shellApi } from '../infrastructure/api'
import { editorMenuItems } from './editorOpen'
import { menuActionIcon } from './menuActionIcons'

export type DefaultOpenApp = AppSettings['defaultOpenApp']

/** Builds the "Open in <Editor>" + "Open with <App>" + "Open With…" menu items
 *  shared by the file tree, repo tabs and status bar. `path` may be a file or a
 *  folder — the editor, `shellApi.openWithApp` and the native picker all accept
 *  either. */
export function openWithMenuItems(
  path: string,
  defaultApp: DefaultOpenApp,
  labels: { openWithDefault: (name: string) => string; openWith: string },
  editor?: EditorSetting,
  opts?: { isDir?: boolean }
): MenuItem[] {
  const items: MenuItem[] = editorMenuItems(editor, { path, isDir: opts?.isDir })
  if (defaultApp?.path) {
    items.push({
      label: labels.openWithDefault(defaultApp.name),
      onClick: () => void shellApi.openWithApp(path, defaultApp.path)
    })
  }
  items.push({ label: labels.openWith, onClick: () => void shellApi.openWithPicker(path) })
  return items
}

/** Full folder-scope menu: Open Folder, Open with <App> (if set), Open With…,
 *  Copy folder path. Used by repo tabs, the group-repo menu, the Files header
 *  and the status bar. */
export function folderOpenMenuItems(
  path: string,
  defaultApp: DefaultOpenApp,
  labels: {
    openFolder: string
    openWithDefault: (name: string) => string
    openWith: string
    copyPath: string
  },
  editor?: EditorSetting
): MenuItem[] {
  // Every row carries an icon here: both callers (the status bar path and the
  // sidebar's repository header) are menus of their own, not mixed lists.
  // openWithMenuItems lists the editor entries first, then the apps.
  const editorCount = editorMenuItems(editor, { path, isDir: true }).length
  const openWith = openWithMenuItems(path, defaultApp, labels, editor, { isDir: true }).map(
    (item, i): MenuItem => ({ ...menuActionIcon(i < editorCount ? 'openEditor' : 'openWith'), ...item })
  )
  return [
    { ...menuActionIcon('reveal'), label: labels.openFolder, onClick: () => void shellApi.openPath(path) },
    ...openWith,
    { separator: true },
    { ...menuActionIcon('copy'), label: labels.copyPath, onClick: () => void navigator.clipboard.writeText(path) }
  ]
}
