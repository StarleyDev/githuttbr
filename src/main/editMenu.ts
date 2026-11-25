import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import {
  buildEditMenuItems,
  EDIT_MENU_FALLBACK_LABELS,
  parseEditMenuLabels,
  type EditMenuLabels
} from '../shared/editMenu'

/**
 * The native right-click menu for text fields and selected text. What it
 * offers is decided by `buildEditMenuItems` (shared, tested); this module only
 * keeps the renderer's latest translated labels and pops the menu.
 */

let labels: EditMenuLabels = EDIT_MENU_FALLBACK_LABELS

export function registerEditMenuHandlers(): void {
  ipcMain.handle('editMenu:setLabels', (_e, value: unknown) => {
    const parsed = parseEditMenuLabels(value)
    if (parsed) labels = parsed
  })

  // Every window, present and future. The embedded DevTools <webview> is left
  // alone: it is a third-party page with its own idea of a context menu.
  app.on('web-contents-created', (_e, contents) => {
    if (contents.getType() !== 'window') return
    contents.on('context-menu', (_event, params) => {
      const items = buildEditMenuItems(params, labels)
      if (items.length === 0) return
      // Roles run the edit natively, against whatever element was clicked.
      const menu = Menu.buildFromTemplate(items.map((i) => ({ role: i.role, label: i.label, enabled: i.enabled })))
      menu.popup({ window: BrowserWindow.fromWebContents(contents) ?? undefined })
    })
  })
}
