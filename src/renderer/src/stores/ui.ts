import type { IconTone } from '../lib/iconTone'
import { create } from 'zustand'
import { explainGitError } from '../lib/gitErrorHint'
import type { DropRef } from '../lib/branchDrop'
import type { ReactNode } from 'react'
import type {
  AppSettings,
  CiState,
  DivergedStrategy,
  KeychainReason,
  RepoRef,
  ResetStrategy,
  SettingsBundle
} from '../../../shared/types'
import type { WorktreeGroupPlan } from '../lib/worktrees'
import type { SettingsPageId } from '../lib/settingsSearch'
import type { WorkspaceCandidate } from '../lib/workspacePlan'
import { touchMru } from '../lib/repoSwitcher'

export type CiFilter = 'all' | CiState

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
  /** Repository the message came from — lets an error toast offer "Fix with AI". */
  repoPath?: string
  /** One next step, drawn as a link under the message. `label` is already translated. */
  action?: ToastAction
  /** What the error means here, already translated — read in place of the generic
   *  explanation, with git's own text moved to the details. */
  explanation?: string
}

export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastOpts {
  repoPath?: string
  action?: ToastAction
  explanation?: string
}

export interface MenuItem {
  label?: string
  icon?: ReactNode
  danger?: boolean
  separator?: boolean
  disabled?: boolean
  /** Native tooltip — used for disabled-state explanations. */
  title?: string
  onClick?: () => void
  /** Nested items — renders a flyout submenu on hover instead of a click action. */
  submenu?: MenuItem[]
  /** The icon's role for Settings → Themes → Icon colours; none stays grey. */
  tone?: IconTone
  /** Draws the row as Finder-style colour dots instead of a label: one click picks a colour. */
  swatches?: MenuSwatches
}

export interface MenuSwatches {
  colors: string[]
  /** Ringed as the one in use. */
  current?: string
  /** Names the row for screen readers. */
  label: string
  /** Names each dot, for its tooltip and screen readers. */
  nameOf: (color: string) => string
  onPick: (color: string) => void
}

export interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

/** The modal kinds that can also be stacked over another modal (see `dialog`). */
export type DialogSpec = Extract<
  ModalSpec,
  | { kind: 'confirm' }
  | { kind: 'input' }
  | { kind: 'settings-import' }
  | { kind: 'settings-export' }
  | { kind: 'version-rollback' }
>

/** Whether a modal spec is a question that can be stacked over another modal.
 *  The import and export dialogs are too: they are asked from Settings → Data,
 *  and opening them in the modal slot would close Settings under them. */
export function isDialogSpec(modal: ModalSpec): modal is DialogSpec {
  return (
    modal.kind === 'confirm' ||
    modal.kind === 'input' ||
    modal.kind === 'settings-import' ||
    modal.kind === 'settings-export' ||
    modal.kind === 'version-rollback'
  )
}

/** Where a dialog opened from Open repository goes back to: that window, for
 *  the same group. A mis-click on Clone or Create should not mean closing and
 *  reopening it. */
export interface LauncherBackTarget {
  groupId?: string
}

export type ModalSpec =
  | {
      kind: 'input'
      title: string
      label: string
      placeholder?: string
      initial?: string
      submitLabel?: string
      allowEmpty?: boolean
      /** A password: masked, never autocompleted, and passed on untrimmed. */
      secret?: boolean
      /** Shown under the field — why the last answer was refused (a wrong password). */
      error?: string
      onSubmit: (value: string) => void
      /** Runs when the dialog closes without a submit: Cancel, Esc, ✕, a click outside. */
      onCancel?: () => void
    }
  | {
      /** One `${input:id}` prompt from a launch.json `inputs` array: a real
       *  picker for `pickString`, a (maskable) text field for `promptString`. */
      kind: 'launch-input'
      input: import('../../../shared/types').LaunchInput
      /** 1-based position in the run's input sequence, for "n of m". */
      step: number
      total: number
      onSubmit: (value: string) => void
    }
  | {
      kind: 'confirm'
      title: string
      message: string
      danger?: boolean
      confirmLabel?: string
      /** The way out that does nothing. "Cancel" unless the question needs another word. */
      cancelLabel?: string
      autoFocusConfirm?: boolean
      onConfirm: () => void
      /** Runs when the dialog closes any other way: Cancel, Esc, ✕, or another dialog replacing it. */
      onCancel?: () => void
      secondaryLabel?: string
      secondaryDanger?: boolean
      onSecondary?: () => void
    }
  | {
      /** The submit screen: the plan, the progress, and the links it produced. */
      kind: 'stack-submit'
      repoPath: string
      /** Which stack — the modal can be showing one you are not standing on. */
      leaf?: string
      create: number
      retarget: number
      /** "branch → base" per level that changes, top level first. */
      lines: string[]
    }
  | { kind: 'remoteAuth'; path: string; remote?: string }
  | {
      kind: 'addRemote'
      path: string
      defaultName: string
      existingNames: string[]
      matchName?: string
      /** Sync action that opened this — add remote, then finish that action. */
      resume?: 'push' | 'pull' | 'fetch'
    }
  | {
      kind: 'editRemote'
      path: string
      name: string
      url: string
      pushUrl?: string
    }
  | {
      kind: 'add-worktree'
      path: string
      /** Main-worktree path of the family — `path` itself may be a linked
       *  worktree, so callers resolve it from `worktrees[].isMain`. */
      rootPath: string
      repoName: string
      /** Currently checked-out branch — the default base. */
      current: string
      locals: { name: string; isCurrent: boolean }[]
      /** Branches already checked out in some worktree — cannot be reused. */
      busyBranches: string[]
      /** Registered worktree folders — used to warn when one is picked again. */
      worktreePaths: string[]
      /** Suggested folder for a branch — follows the repo's existing convention. */
      suggestDir: (branch: string) => string
    }
  | {
      kind: 'diverged-checkout'
      localName: string
      fullName: string
      ahead: number
      behind: number
      onResolve: (strategy: DivergedStrategy, backup: boolean) => void
    }
  | {
      // Asked for a remote branch whose local counterpart is ahead: checking
      // out would hand back local work, so the user picks which side wins.
      kind: 'ahead-checkout'
      localName: string
      fullName: string
      ahead: number
      onKeepLocal: () => void
      onReset: (strategy: ResetStrategy, backup: boolean) => void
    }
  | { kind: 'clone'; onClone: (repo: { path: string; name: string }) => void; back?: LauncherBackTarget }
  | { kind: 'create-branch'; path: string; currentBranch?: string; description?: string; initialName?: string }
  | { kind: 'work-item-branch'; path: string; remoteUrl: string }
  /** `themeTab: 'graph'` with `page: 'themes'` still opens the Graph page, as it did the Graph tab. */
  | { kind: 'settings'; page?: SettingsPageId; themeTab?: 'theme' | 'graph' }
  | { kind: 'launcher'; groupId?: string }
  /** A picked, unlocked settings export: choose its parts before applying. */
  | { kind: 'settings-import'; settings: Partial<AppSettings>; bundle: SettingsBundle | null }
  /** Choose the parts of this machine's settings an export file carries. */
  | { kind: 'settings-export' }
  /** Settings → About → Previous versions: the confirmation before going back to `target`. */
  | {
      kind: 'version-rollback'
      target: string
      current: string
      kindOfInstall: import('../../../shared/types').RollbackSupport['kind']
    }
  /** The repositories the scanned folders hold, to open — or, with `groupId`,
   *  to add to that group. Also where the scanned folders are managed. */
  /** `from: 'launcher'` when opened from Open repository: it offers a way back
   *  there, and returns there after adding to a group. */
  | { kind: 'scanned-repos'; groupId?: string; from?: 'launcher' }
  | { kind: 'create-repo'; onCreate: (repo: { path: string; name: string }) => void; back?: LauncherBackTarget }
  | { kind: 'ai-config-wizard'; repoPath: string; repoName: string }
  | { kind: 'interactive-rebase'; repoPath: string; base: string; baseSubject: string }
  | { kind: 'conflict-radar'; repoPath: string; base?: string }
  | { kind: 'teammate-radar'; repoPath: string }
  | {
      kind: 'reset-to-commit'
      repoPath: string
      sha: string
      shortSha: string
      branch: string
      dirty: boolean
      onReset: (mode: 'soft' | 'mixed' | 'hard') => void
    }
  | { kind: 'local-ci'; repoPath: string; rev?: string }
  /** Name a new group and pick its colour in one go. */
  | { kind: 'new-group'; onCreate: (name: string, color: string) => void; back?: LauncherBackTarget }
  /** Offer to group an opening worktree with its family: the root's standalone
   *  tab ('convert' — asks for a group name) or the group the family already
   *  lives in ('add' — just confirms). */
  | {
      kind: 'worktree-group'
      repo: RepoRef
      plan: WorktreeGroupPlan
      onResolve: (choice: 'group' | 'separate', name: string) => void
    }
  | { kind: 'keychain-consent'; reason: KeychainReason; adopted?: boolean }
  | { kind: 'range-diff'; repoPath: string; branch: string; initialOld?: string }
  | { kind: 'absorb'; repoPath: string }
  | { kind: 'branch-cleanup'; repoPath: string }
  | { kind: 'time-machine'; repoPath: string }
  | { kind: 'timelapse'; repoPath: string }
  | { kind: 'ai-pr-review'; repoPath: string; prTitle: string; sourceBranch: string; targetBranch: string; diff?: string }
  /** The colour picker. Deliberately knows nothing about what it is colouring:
   *  it is used by group tabs, folders and Repositories-page sections alike.
   *  `tabId` is optional so a page-local colour can reuse the same modal. */
  | { kind: 'group-color'; tabId?: string; current?: string; onSelect: (color: string) => void }
  /** Pick which scanned folders become workspaces. The plan is computed before
   *  the modal opens, so this only chooses from it — nothing is created until
   *  the confirm, and cancelling leaves the scan's indexing in place. */
  | {
      kind: 'scan-workspaces'
      root: string
      candidates: WorkspaceCandidate[]
      onConfirm: (chosen: WorkspaceCandidate[]) => void
    }
  | { kind: 'reflog'; repoPath: string }
  | { kind: 'code-search'; repoPath: string; query?: string }
  | { kind: 'stack'; repoPath: string }
  | { kind: 'gitflow'; repoPath: string }
  | { kind: 'history-purge'; repoPath: string; initialPath?: string }
  | { kind: 'subtree'; repoPath: string }
  | { kind: 'clean'; repoPath: string }
  | { kind: 'export'; repoPath: string; tab?: 'bundle' | 'archive' }
  | { kind: 'maintenance'; repoPath: string }
  | { kind: 'merge-options'; repoPath: string; source?: string }
  /** Push several local branches in one go; `preselect` is a sidebar selection. */
  | { kind: 'push-branches'; repoPath: string; preselect?: string[] }
  | { kind: 'objects'; repoPath: string; rev?: string }
  | { kind: 'attributes'; repoPath: string }
  | { kind: 'credentials'; repoPath: string }
  | { kind: 'replace'; repoPath: string; commit?: string }
  | { kind: 'changelog-gen'; repoPath: string }
  | { kind: 'snapshots'; repoPath: string }
  | { kind: 'todos'; repoPath: string; focusId?: string }
  | { kind: 'stash-partial'; repoPath: string }
  | { kind: 'create-tag'; repoPath: string; hash?: string; at?: string }
  | { kind: 'cheatsheet' }
  // `githuttbr --wait <file>` — a `git commit`/`git rebase -i` is blocked on this
  // dialog, so closing it by any route must answer git (see CliEditModal).
  | { kind: 'cli-edit'; file: string; sentinel: string; content: string }
  | { kind: 'ai-accounts-notice' }
  | { kind: 'create-issue'; repoPath: string; remoteUrl: string }
  | { kind: 'repo-settings'; repoPath: string; tab?: 'general' | 'config' | 'info' | 'vault' | 'analytics' | 'insights' | 'history' | 'logs' }
  | { kind: 'secure-share'; repoPath: string; initialMode?: 'export' | 'import' }
  | { kind: 'secure-workspace'; initialMode?: 'export' | 'import' }
  | { kind: 'bisect'; repoPath: string }
  | { kind: 'hooks'; repoPath: string }
  | { kind: 'lfs'; repoPath: string }
  | { kind: 'sparse'; repoPath: string }
  | { kind: 'ignore'; repoPath: string; targetPath: string; isFolder: boolean }
  | { kind: 'pr-preview'; repoPath: string; number?: number; remote?: string; branch?: string }
  | {
      kind: 'create-pr'
      repoPath: string
      remoteUrl?: string
      source?: string
      target?: string
      defaultTitle?: string
      defaultBody?: string
    }

export type FileViewSource =
  | { type: 'wip'; staged: boolean; untracked: boolean }
  // `deleted`: the change removed the file, so the views show it as it was before.
  | { type: 'commit'; hash: string; deleted?: boolean }
  | { type: 'stash'; sha: string; untracked: boolean; deleted?: boolean }
  // A plain working-tree file opened from the project tree. Read from disk
  // (no git ref) and editable in place.
  | { type: 'tree' }

export type FileViewMode = 'preview' | 'diff' | 'file' | 'blame' | 'history'

export interface FileViewState {
  repoPath: string
  file: string
  source: FileViewSource
  mode: FileViewMode
  /** Line to scroll to and flash once the file is rendered (search results). */
  line?: number
  /** Bumped by `setFileView` per request, so re-opening the same line re-scrolls. */
  revealSeq?: number
}

export interface ConflictViewState {
  repoPath: string
  file: string
}

/** One file in the commit editor: its content at the commit, and the draft. */
export interface CommitEditFileDraft {
  original: string
  draft: string
  binary: boolean
  tooLarge: boolean
  missing: boolean
}

/** The commit editor's work in progress. Kept in the store rather than in the
 *  component because switching repository tabs unmounts the centre pane — and
 *  that must not throw an edit away. */
export interface CommitEditDraft {
  /** null until the commit's own message has loaded. */
  message: string | null
  files: Record<string, CommitEditFileDraft>
  selFile: string
  dirty: boolean
}

/** Editing a past commit, open in the centre pane in place of the graph. */
export interface CommitEditViewState {
  repoPath: string
  sha: string
  subject: string
  draft?: CommitEditDraft
}

/** How the branch comparison lists changes: everything at once, or one commit. */
export type CompareMode = 'all' | 'commit'

/** Comparing two refs, open in the centre pane in place of the graph. Every
 *  choice lives here, not in the component, so switching repository tabs (which
 *  unmounts the pane) comes back to the same commit and file. */
export interface CompareViewState {
  repoPath: string
  /** The ref being compared… */
  branchA: string
  /** …against this base. */
  branchB: string
  mode: CompareMode
  /** The commit shown in 'commit' mode; '' picks the first one. */
  commit: string
  /** The file picked in the list; '' picks the first one. */
  file: string
}

/** Active content-search term, mirrored from the commit panel so the center
 *  file/diff view can highlight matches. null = nothing to highlight. */
export interface FileSearchState {
  query: string
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
}

export interface PanelLayout {
  sidebarWidth: number
  panelWidth: number
  terminalHeight: number
  /** Height of the Problems dock at the bottom of the centre column. */
  problemsHeight: number
  /** Width of the terminal pane when docked as a right-hand column. */
  terminalWidth: number
  terminalListWidth: number
  terminalListCollapsed: boolean
  composerUnstagedRatio: number
  /** Conflict editor: share of the width taken by the left (ours) side. */
  conflictSideRatio: number
  /** Conflict editor: share of the height taken by the two side panes. */
  conflictFilesRatio: number
  composerConflictedCollapsed: boolean
  composerUnstagedCollapsed: boolean
  composerStagedCollapsed: boolean
}

const LAYOUT_KEY = 'githuttbr-layout'
const SIDEBAR_KEY = 'githuttbr-sidebar-collapsed'
const DEFAULT_LAYOUT: PanelLayout = {
  sidebarWidth: 264,
  panelWidth: 420,
  terminalHeight: 260,
  problemsHeight: 240,
  terminalWidth: 480,
  terminalListWidth: 220,
  terminalListCollapsed: false,
  composerUnstagedRatio: 0.5,
  conflictSideRatio: 0.5,
  conflictFilesRatio: 0.55,
  composerConflictedCollapsed: false,
  composerUnstagedCollapsed: false,
  composerStagedCollapsed: false
}

function loadLayout(): PanelLayout {
  try {
    return { ...DEFAULT_LAYOUT, ...(JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') as Partial<PanelLayout>) }
  } catch {
    return DEFAULT_LAYOUT
  }
}

interface UIState {
  contextMenu: ContextMenuState | null
  modal: ModalSpec | null
  /** A confirm or a name prompt drawn *over* the open modal, which stays
   *  mounted underneath. For a question asked from inside a modal — Settings
   *  deleting a profile — where `openModal` would replace the very screen the
   *  user is working in, and every bit of its state with it. */
  dialog: DialogSpec | null
  /** While set, Esc, a backdrop click and ✕ do not close the modal or the
   *  stacked dialog — for one in the middle of a write it must see through
   *  (the settings import). The dialog closes itself when it is done. */
  closeLocked: boolean
  toasts: Toast[]
  /** Cmd/Ctrl+K command palette — fuzzy jump to branches, commits, files, actions. */
  commandPaletteOpen: boolean
  /** Cmd/Ctrl+J repository switcher. */
  repoSwitcherOpen: boolean
  /** Open repositories, most recently shown first — session-only, for the switcher. */
  repoMru: string[]
  /** A search the switcher hands to the Repositories page; it takes it once. */
  repositoriesQuery: string | null
  /**
   * Mission control is showing. It is a view, not a tab: the title-bar button
   * swaps the whole workspace body for the dashboard and swaps it back, so no
   * extra tab is ever created for it.
   */
  missionOpen: boolean
  /** Unread GitHub notification count for the toolbar bell badge. */
  githubUnread: number
  /** Terminal-pane visibility, per repo path. App opens it the first time a
   *  repo becomes active in a session (`openTerminalOnRepoOpen`); after that,
   *  switching tabs restores whatever the user left. In-memory only — resets to
   *  all-closed on cold start. */
  terminalOpenByRepo: Record<string, boolean>
  /** Which repos have the Problems dock open. */
  problemsOpenByRepo: Record<string, boolean>
  /** Left sidebar (branches/files) collapsed. Global workspace preference —
   *  hides the sidebar column so the graph gets the full width. */
  sidebarCollapsed: boolean
  /** Which sidebar tab is showing. Lives here rather than in the component
   *  because the refresh cycle reads it: the file tree's per-path badges cost a
   *  second full `git status` walk, and nothing displays them until this is
   *  'files'. */
  sidebarTab: 'git' | 'files'
  setSidebarTab: (tab: 'git' | 'files') => void
  /** Chat shares the contextual right panel with commit/stash details. */
  chatPanelOpen: boolean
  rightPanelTab: 'details' | 'chat'
  /** A composer draft handed to the chat panel from elsewhere (an error
   *  toast's "Fix with AI"). The panel consumes it once, for its own repo. */
  chatPrompt: { repoPath: string; text: string } | null
  graphFilter: string
  ciFilter: CiFilter
  authorFilter: string | null
  /** Dim commits that didn't touch this path (file/folder). null = off. */
  pathFilter: string | null
  busy: string | null
  /** The repository being loaded because the user just switched to it (see
   *  `trackRepoSwitch`), for the toolbar's loading signal. Background refreshes
   *  never set it. */
  repoSwitching: string | null
  /** The ref being dragged, wherever the drag started. One for the whole
   *  window, because a drop target cannot read the drag's payload until the
   *  drop — and a sidebar row and a graph badge are different components. */
  draggingRef: DropRef | null
  /** A graph commit being dragged — branch badges offer cherry-pick / move onto themselves. */
  draggingCommit: string | null
  /** Which toolbar operation is in flight, so the spinner can render on the
   *  relevant tool button instead of a layout-shifting label on the right. */
  busyOp: 'push' | 'pull' | 'fetch' | null
  /** Count of mutating git ops queued or running. > 0 gates the UI: action
   *  buttons and mutating keyboard shortcuts are disabled until it drops to 0,
   *  so the user can't fire a second action before the first has settled. */
  inflight: number
  /** Prefill the commit composer (amend from HEAD, or restore after undo). */
  composerIntent: { path: string; summary: string; description: string; amend: boolean } | null
  fileView: FileViewState | null
  conflictView: ConflictViewState | null
  commitEditView: CommitEditViewState | null
  compareView: CompareViewState | null
  /** File whose "why this conflicts" strip is open. Lives here rather than in
   *  the resolver so a background refresh, which remounts it, does not close it. */
  conflictWhy: string | null
  fileSearch: FileSearchState | null
  scrollToHash: string | null
  layout: PanelLayout
  /** True while the in-app file editor holds unsaved changes — drives the
   *  discard guard before navigating away. */
  editorDirty: boolean
  /** RepoCosmos 3D visualization easter egg — a fullscreen overlay mounted
   *  as a sibling to the modal stack, since it must cover the modal that
   *  triggered it. null = closed. */
  cosmos: { repoPath: string } | null

  openContextMenu(x: number, y: number, items: MenuItem[]): void
  closeContextMenu(): void
  openModal(modal: ModalSpec): void
  closeModal(): void
  openDialog(dialog: DialogSpec): void
  closeDialog(): void
  setCloseLocked(locked: boolean): void
  setCommandPalette(open: boolean): void
  setMissionOpen(open: boolean): void
  toggleCommandPalette(): void
  setRepoSwitcher(open: boolean): void
  touchRepoMru(path: string): void
  setRepositoriesQuery(query: string | null): void
  setGithubUnread(n: number): void
  toast(kind: Toast['kind'], message: string, opts?: ToastOpts): void
  dismissToast(id: number): void
  toggleTerminal(repoPath: string): void
  toggleProblems(repoPath: string): void
  setProblemsOpen(repoPath: string, open: boolean): void
  setTerminalOpen(repoPath: string, open: boolean): void
  toggleSidebar(): void
  setSidebarCollapsed(collapsed: boolean): void
  openChatPanel(): void
  /** Open the chat panel with a prefilled composer draft for one repository. */
  openChatPanelWith(repoPath: string, text: string): void
  consumeChatPrompt(): void
  closeChatPanel(): void
  showDetailsPanel(): void
  setGraphFilter(filter: string): void
  setCiFilter(filter: CiFilter): void
  setAuthorFilter(author: string | null): void
  setPathFilter(path: string | null): void
  setBusy(label: string | null, op?: 'push' | 'pull' | 'fetch' | null): void
  setRepoSwitching(path: string | null): void
  setDraggingRef(ref: DropRef | null): void
  setDraggingCommit(hash: string | null): void
  beginInflight(): void
  endInflight(): void
  requestComposerIntent(intent: { path: string; summary: string; description: string; amend: boolean }): void
  consumeComposerIntent(): void
  setFileView(view: FileViewState | null): void
  setEditorDirty(dirty: boolean): void
  setConflictView(view: ConflictViewState | null): void
  setCommitEditView(view: CommitEditViewState | null): void
  /** Store the open commit editor's draft; ignored if that editor was closed meanwhile. */
  saveCommitEditDraft(repoPath: string, sha: string, draft: CommitEditDraft): void
  setCompareView(view: CompareViewState | null): void
  /** Change the open comparison; ignored if it was closed or belongs to another repository. */
  updateCompareView(repoPath: string, patch: Partial<Omit<CompareViewState, 'repoPath'>>): void
  setConflictWhy(file: string | null): void
  setFileSearch(search: FileSearchState | null): void
  /** Scroll the graph to a commit. With `repoPath`, a branch comparison open in
   *  that repository closes first: it covers the graph, so the jump would land
   *  out of sight. */
  requestScrollTo(hash: string | null, repoPath?: string): void
  setLayout(partial: Partial<PanelLayout>): void
  /** Reset all persisted panel sizes (widths/heights/collapse) to defaults. */
  resetLayout(): void
  openCosmos(repoPath: string): void
  closeCosmos(): void
}

let toastId = 0
let revealSeq = 0

export const useUIStore = create<UIState>((set, get) => ({
  contextMenu: null,
  modal: null,
  dialog: null,
  closeLocked: false,
  toasts: [],
  commandPaletteOpen: false,
  repoSwitcherOpen: false,
  repoMru: [],
  repositoriesQuery: null,
  missionOpen: false,
  githubUnread: 0,
  terminalOpenByRepo: {},
  problemsOpenByRepo: {},
  sidebarCollapsed: (() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })(),
  chatPanelOpen: false,
  rightPanelTab: 'details',
  chatPrompt: null,
  graphFilter: '',
  ciFilter: 'all',
  authorFilter: null,
  pathFilter: null,
  busy: null,
  repoSwitching: null,
  draggingRef: null,
  draggingCommit: null,
  busyOp: null,
  inflight: 0,
  composerIntent: null,
  fileView: null,
  conflictView: null,
  commitEditView: null,
  compareView: null,
  conflictWhy: null,
  fileSearch: null,
  scrollToHash: null,
  layout: loadLayout(),
  editorDirty: false,
  cosmos: null,

  openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
  closeContextMenu: () => set({ contextMenu: null }),
  // A dialog belongs to the modal it was asked over: it goes when that one does.
  //
  // A question (a confirm, a one-line input) asked while a modal is open goes
  // OVER it, wherever it was asked from. Opened in the modal slot it replaced
  // the modal: deleting an AI account closed Settings, and the handlers that
  // reload a list or clear a selection after "Yes" (credentials, hooks, todos,
  // attributes…) ran against a modal that was already gone — Cancel lost it
  // too. Callers that mean to close the modal after the answer already call
  // closeModal() themselves, which still closes both.
  openModal: (modal) => set((s) => (s.modal && isDialogSpec(modal) ? { dialog: modal } : { modal, dialog: null })),
  closeModal: () => set({ modal: null, dialog: null }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  setCloseLocked: (closeLocked) => set({ closeLocked }),
  setCommandPalette: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setMissionOpen: (missionOpen) => set({ missionOpen }),
  toggleCommandPalette: () => set({ commandPaletteOpen: !get().commandPaletteOpen }),
  setRepoSwitcher: (repoSwitcherOpen) => set({ repoSwitcherOpen }),
  setRepositoriesQuery: (repositoriesQuery) => set({ repositoriesQuery }),
  touchRepoMru: (path) => {
    const next = touchMru(get().repoMru, path)
    if (next !== get().repoMru) set({ repoMru: next })
  },
  setGithubUnread: (githubUnread) => set({ githubUnread }),

  toast: (kind, message, opts) => {
    const id = ++toastId
    const extra = {
      ...(opts?.repoPath ? { repoPath: opts.repoPath } : {}),
      ...(opts?.action ? { action: opts.action } : {}),
      ...(opts?.explanation ? { explanation: opts.explanation } : {})
    }
    set({ toasts: [...get().toasts, { id, kind, message, ...extra }] })
    // An explained error carries a next step to read and act on: it stays longer.
    // So does a toast with a button — it has to stay long enough to be reached.
    const ms = kind === 'error' ? (opts?.explanation || explainGitError(message) ? 15000 : 7000) : opts?.action ? 8000 : 3500
    setTimeout(() => get().dismissToast(id), ms)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  toggleTerminal: (repoPath) =>
    set((s) => ({ terminalOpenByRepo: { ...s.terminalOpenByRepo, [repoPath]: !s.terminalOpenByRepo[repoPath] } })),
  setTerminalOpen: (repoPath, open) =>
    set((s) => ({ terminalOpenByRepo: { ...s.terminalOpenByRepo, [repoPath]: open } })),
  toggleProblems: (repoPath) =>
    set((s) => ({ problemsOpenByRepo: { ...s.problemsOpenByRepo, [repoPath]: !s.problemsOpenByRepo[repoPath] } })),
  setProblemsOpen: (repoPath, open) =>
    set((s) => ({ problemsOpenByRepo: { ...s.problemsOpenByRepo, [repoPath]: open } })),
  sidebarTab: 'git',
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  toggleSidebar: () => get().setSidebarCollapsed(!get().sidebarCollapsed),
  setSidebarCollapsed: (sidebarCollapsed) => {
    set({ sidebarCollapsed })
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0')
    } catch {
      /* ignore quota errors */
    }
  },
  openChatPanel: () => set({ chatPanelOpen: true, rightPanelTab: 'chat' }),
  openChatPanelWith: (repoPath, text) =>
    set({ chatPanelOpen: true, rightPanelTab: 'chat', chatPrompt: { repoPath, text } }),
  consumeChatPrompt: () => set({ chatPrompt: null }),
  closeChatPanel: () => set({ chatPanelOpen: false, rightPanelTab: 'details' }),
  showDetailsPanel: () => set({ rightPanelTab: 'details' }),
  setGraphFilter: (graphFilter) => set({ graphFilter }),
  setCiFilter: (ciFilter) => set({ ciFilter }),
  setAuthorFilter: (authorFilter) => set({ authorFilter }),
  setPathFilter: (pathFilter) => set({ pathFilter }),
  setBusy: (busy, op = null) => set({ busy, busyOp: op }),
  setRepoSwitching: (repoSwitching) => set({ repoSwitching }),
  setDraggingRef: (draggingRef) => set({ draggingRef }),
  setDraggingCommit: (draggingCommit) => set({ draggingCommit }),
  beginInflight: () => set((s) => ({ inflight: s.inflight + 1 })),
  endInflight: () => set((s) => ({ inflight: Math.max(0, s.inflight - 1) })),
  requestComposerIntent: (composerIntent) => set({ composerIntent }),
  consumeComposerIntent: () => set({ composerIntent: null }),
  setFileView: (fileView) =>
    set((s) => ({
      // Stamp each line-targeted open so clicking the same search hit twice
      // scrolls again instead of being deduped away by identical state.
      fileView: fileView?.line != null ? { ...fileView, revealSeq: ++revealSeq } : fileView,
      // The comparison sits above the file viewer and holds no work: a file
      // opened in its repository leaves it, or the file would open out of sight.
      ...(fileView && s.compareView?.repoPath === fileView.repoPath ? { compareView: null } : {})
    })),
  setEditorDirty: (editorDirty) => set({ editorDirty }),
  setConflictView: (conflictView) => set({ conflictView }),
  setCommitEditView: (commitEditView) => set({ commitEditView }),
  saveCommitEditDraft: (repoPath, sha, draft) =>
    set((s) =>
      s.commitEditView && s.commitEditView.repoPath === repoPath && s.commitEditView.sha === sha
        ? { commitEditView: { ...s.commitEditView, draft } }
        : {}
    ),
  setCompareView: (compareView) => set({ compareView }),
  updateCompareView: (repoPath, patch) =>
    set((s) => (s.compareView && s.compareView.repoPath === repoPath ? { compareView: { ...s.compareView, ...patch } } : {})),
  setConflictWhy: (conflictWhy) => set({ conflictWhy }),
  setFileSearch: (fileSearch) => set({ fileSearch }),
  requestScrollTo: (scrollToHash, repoPath) =>
    set((s) => ({
      scrollToHash,
      ...(scrollToHash && repoPath && s.compareView?.repoPath === repoPath ? { compareView: null } : {})
    })),
  setLayout: (partial) => {
    const layout = { ...get().layout, ...partial }
    set({ layout })
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
    } catch {
      /* ignore quota errors */
    }
  },
  resetLayout: () => {
    set({ layout: DEFAULT_LAYOUT })
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(DEFAULT_LAYOUT))
    } catch {
      /* ignore quota errors */
    }
  },
  openCosmos: (repoPath) => set({ cosmos: { repoPath } }),
  closeCosmos: () => set({ cosmos: null })
}))

/** The ref being dragged right now, read at event time — see `draggingRef` in the store. */
export function draggingRef(): DropRef | null {
  return useUIStore.getState().draggingRef
}

/** The commit being dragged right now, read at event time like `draggingRef`. */
export function draggingCommit(): string | null {
  return useUIStore.getState().draggingCommit
}
