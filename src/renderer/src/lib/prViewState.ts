import type { PrLineAnchor } from '../../../shared/types'
import { hasUnsavedEdit, isEditChanged, type CommentEditDraft } from './commentEdit'

// Where a pull request page was, for the app session: the tab, the file, the
// scroll positions and every unsent text. The app renders only the active page,
// so leaving a PR for the repository view (or another tab) unmounts it; this is
// what it comes back to. In memory only — nothing here reaches the disk.
//
// Plain objects, not a store: the page writes into them as the reader types
// and scrolls (through refs, no re-render), and reads them once when it mounts.

/** A text that lost its place — its comment deleted, its thread or file gone. */
export interface OrphanDraft {
  id: string
  kind: 'reply' | 'edit' | 'line'
  text: string
  /** The file and line a line comment was written on. */
  path?: string
  line?: number | null
}

export interface PrViewState {
  section: string
  /** The page body's scrollTop, per section. */
  scroll: Record<string, number>
  /** Files tab: the file open on the right, and how far down the file list and its diff were. */
  selectedFile: string | null
  fileListScroll: number
  diffScroll: { file: string; top: number } | null
  /** Files tab showing one update's own diff instead of the whole PR's (an UpdateDiffView). */
  updateView: unknown
  /** The comment box under the conversation. */
  comment: string
  /** Reply drafts by thread root id. */
  replyDrafts: Record<string, string>
  /** Edits of your own comments, by comment key. */
  editDrafts: Record<string, CommentEditDraft>
  /** The line comment being written, and its text (a ref the composer writes). */
  lineDraft: { anchor: PrLineAnchor } | null
  lineText: { current: string }
  /** Texts whose place is gone, shown as a notice until copied or dismissed. */
  orphans: OrphanDraft[]
}

/** How many pull requests keep their place. */
export const PR_VIEW_STATES_KEPT = 50

export function getPrViewKey(repoPath: string, remoteUrl: string, number: number): string {
  return JSON.stringify([repoPath, remoteUrl, number])
}

export function createPrViewState(): PrViewState {
  return {
    section: 'conversation',
    scroll: {},
    selectedFile: null,
    fileListScroll: 0,
    diffScroll: null,
    updateView: null,
    comment: '',
    replyDrafts: {},
    editDrafts: {},
    lineDraft: null,
    lineText: { current: '' },
    orphans: []
  }
}

/** Whether a page state holds text nobody sent, in any of its boxes. */
export function hasUnsentDrafts(s: PrViewState): boolean {
  return (
    !!s.comment.trim() ||
    Object.values(s.replyDrafts).some((r) => r.trim()) ||
    !!s.lineText.current.trim() ||
    hasUnsavedEdit(s.editDrafts) ||
    s.orphans.length > 0
  )
}

/**
 * The states, least recently used first. Past the cap the oldest goes — but
 * one holding unsent text only when every state does: a draft is never the
 * first thing dropped.
 */
export function createPrViewStates(max = PR_VIEW_STATES_KEPT): {
  getViewState: (key: string) => PrViewState | undefined
  getOrCreateViewState: (key: string) => PrViewState
  hasViewState: (key: string, state: PrViewState) => boolean
  removeViewState: (key: string) => void
  getViewKeys: () => string[]
} {
  const map = new Map<string, PrViewState>()
  const touch = (key: string, s: PrViewState): void => {
    map.delete(key)
    map.set(key, s)
  }
  // `keep`: the one just asked for — the page about to write into it — never goes.
  const trim = (keep: string): void => {
    while (map.size > max) {
      let victim: string | undefined
      let oldest: string | undefined
      for (const [k, s] of map) {
        if (k === keep) continue
        oldest ??= k
        if (!hasUnsentDrafts(s)) {
          victim = k
          break
        }
      }
      const gone = victim ?? oldest
      if (gone === undefined) return
      map.delete(gone)
    }
  }
  return {
    getViewState: (key) => {
      const s = map.get(key)
      if (s) touch(key, s)
      return s
    },
    getOrCreateViewState: (key) => {
      const s = map.get(key) ?? createPrViewState()
      touch(key, s)
      trim(key)
      return s
    },
    hasViewState: (key, state) => map.get(key) === state,
    removeViewState: (key) => void map.delete(key),
    getViewKeys: () => [...map.keys()]
  }
}

/** The app session's states. */
export const prViewStates = createPrViewStates()

/** A saved scrollTop that still fits: content that got shorter scrolls to its end, not past it. */
export function clampScrollTop(saved: number, scrollHeight: number, clientHeight: number): number {
  return Math.max(0, Math.min(saved, scrollHeight - clientHeight))
}

/**
 * Move the drafts whose place is gone into `orphans`, so a refresh never drops
 * them silently: a reply to a thread that is not there any more, an edit of a
 * comment that was deleted (only one that changed something), a line comment
 * on a file the diff no longer lists. Each `alive` set is skipped when null —
 * that part of the page has not loaded, and absence proves nothing yet.
 */
export function collectOrphanDrafts(
  s: PrViewState,
  alive: { threadIds: Set<string> | null; commentKeys: Set<string> | null; filePaths: Set<string> | null }
): boolean {
  let moved = false
  if (alive.threadIds) {
    for (const [id, text] of Object.entries(s.replyDrafts)) {
      if (alive.threadIds.has(id)) continue
      delete s.replyDrafts[id]
      if (text.trim()) {
        s.orphans.push({ id: `reply:${id}`, kind: 'reply', text })
        moved = true
      }
    }
  }
  if (alive.commentKeys) {
    for (const [key, draft] of Object.entries(s.editDrafts)) {
      if (alive.commentKeys.has(key)) continue
      delete s.editDrafts[key]
      if (isEditChanged(draft)) {
        s.orphans.push({ id: `edit:${key}`, kind: 'edit', text: draft.text })
        moved = true
      }
    }
  }
  if (alive.filePaths && s.lineDraft && !alive.filePaths.has(s.lineDraft.anchor.path)) {
    const { anchor } = s.lineDraft
    if (s.lineText.current.trim()) {
      s.orphans.push({
        id: `line:${anchor.path}:${anchor.oldLine}:${anchor.newLine}`,
        kind: 'line',
        text: s.lineText.current,
        path: anchor.path,
        line: anchor.newLine ?? anchor.oldLine
      })
      moved = true
    }
    s.lineDraft = null
    s.lineText.current = ''
  }
  return moved
}

/**
 * Which PR pages a tab list holds, and how many PR slots: a slot is one page
 * (a tab of its own or a chip on a repository tab). ‹ › and the list's
 * "replace" swap the PR in a slot — the slot count holds — while a close
 * removes the slot. Only the second discards a state.
 */
export function getOpenPrPages(
  tabs: ReadonlyArray<{ kind: string; page?: unknown; pages?: unknown[] }>
): { keys: Set<string>; slots: number } {
  const keys = new Set<string>()
  let slots = 0
  for (const tab of tabs) {
    const pages = tab.kind === 'page' ? [tab.page] : (tab.pages ?? [])
    for (const p of pages) {
      const page = p as { type?: string; repoPath?: string; remoteUrl?: string; number?: number } | undefined
      if (page?.type !== 'pr' || typeof page.repoPath !== 'string' || typeof page.remoteUrl !== 'string') continue
      slots++
      keys.add(getPrViewKey(page.repoPath, page.remoteUrl, Number(page.number)))
    }
  }
  return { keys, slots }
}

/**
 * The states a tab-list change discards: PRs no longer open, when a slot went
 * away. One still holding unsent text stays (a bulk close asked nobody) —
 * it is there again when the PR is reopened; a single close asks first and
 * removes it itself.
 */
export function getClosedPrViewKeys(
  before: { keys: Set<string>; slots: number },
  after: { keys: Set<string>; slots: number },
  hasDrafts: (key: string) => boolean
): string[] {
  if (after.slots >= before.slots) return []
  return [...before.keys].filter((k) => !after.keys.has(k) && !hasDrafts(k))
}
