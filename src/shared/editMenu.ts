/**
 * The right-click menu for text: Cut, Copy, Paste, Select all.
 *
 * Electron draws no context menu of its own, so without this a right-click in
 * a comment box does nothing and there is no way to paste with the mouse. Like
 * the application menu (`shared/menu.ts`), the labels are resolved by the
 * renderer — the dictionaries live there — and pushed to the main process,
 * which keeps the latest set and builds the menu on each right-click.
 *
 * Custom React menus (diff lines, the graph, the sidebar) and the terminal call
 * `preventDefault` on `contextmenu`; Chromium then never raises the
 * `context-menu` event, so this menu cannot stack on top of theirs.
 */

export interface EditMenuLabels {
  cut: string
  copy: string
  paste: string
  selectAll: string
}

/**
 * Used until the renderer has sent its translated set — the window can be
 * right-clicked before the first render has finished.
 */
export const EDIT_MENU_FALLBACK_LABELS: EditMenuLabels = {
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'Select all'
}

/** The slice of Electron's `ContextMenuParams` the menu depends on. */
export interface EditMenuParams {
  isEditable: boolean
  selectionText: string
  editFlags: { canCut: boolean; canCopy: boolean; canPaste: boolean; canSelectAll: boolean }
  /** The spellchecker's replacements for the word under the cursor, when it is misspelled. */
  dictionarySuggestions?: string[]
}

export type EditMenuItem =
  | { role: 'cut' | 'copy' | 'paste' | 'selectAll'; label: string; enabled: boolean }
  /** Replace the misspelled word with this one (`replaceMisspelling`). */
  | { suggestion: string }
  | { separator: true }

/** More than a handful of suggestions buries Cut/Copy/Paste. */
const MAX_SUGGESTIONS = 5
/** A label is a word or two; anything longer is not a label set worth showing. */
const MAX_LABEL_LENGTH = 64

/**
 * The items for one right-click, or an empty list when there is nothing to
 * offer (a click on plain UI with no selection).
 */
export function buildEditMenuItems(params: EditMenuParams, labels: EditMenuLabels): EditMenuItem[] {
  const f = params.editFlags
  if (params.isEditable) {
    const words = (params.dictionarySuggestions ?? []).filter((w) => w.length > 0).slice(0, MAX_SUGGESTIONS)
    return [
      ...words.map((suggestion): EditMenuItem => ({ suggestion })),
      ...(words.length ? [{ separator: true } as const] : []),
      { role: 'cut', label: labels.cut, enabled: f.canCut },
      { role: 'copy', label: labels.copy, enabled: f.canCopy },
      { role: 'paste', label: labels.paste, enabled: f.canPaste },
      { role: 'selectAll', label: labels.selectAll, enabled: f.canSelectAll }
    ]
  }
  if (params.selectionText.length > 0) return [{ role: 'copy', label: labels.copy, enabled: true }]
  return []
}

/**
 * Accept a label set from the bridge only when every field is a non-empty
 * string; anything else keeps whatever was there before. Each label is capped
 * at 64 characters, so a bad set cannot stretch the menu across the screen.
 */
export function parseEditMenuLabels(value: unknown): EditMenuLabels | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const ok = (x: unknown): x is string => typeof x === 'string' && x.length > 0
  if (!ok(v.cut) || !ok(v.copy) || !ok(v.paste) || !ok(v.selectAll)) return null
  const cap = (x: string): string => x.slice(0, MAX_LABEL_LENGTH)
  return { cut: cap(v.cut), copy: cap(v.copy), paste: cap(v.paste), selectAll: cap(v.selectAll) }
}
