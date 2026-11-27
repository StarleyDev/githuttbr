import { createElement, type ReactNode } from 'react'
import {
  AppWindow,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpFromDot,
  ArrowUpFromLine,
  Cherry,
  Code,
  Combine,
  Copy,
  CopyX,
  Delete,
  Eraser,
  ExternalLink,
  FastForward,
  FileOutput,
  FilePenLine,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  FolderTree,
  GitBranch,
  GitBranchPlus,
  GitCommitHorizontal,
  GitCompare,
  GitFork,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  History,
  Import,
  LayoutGrid,
  Link,
  ListOrdered,
  ListTree,
  ListX,
  LocateFixed,
  MoveRight,
  Pencil,
  PencilLine,
  Pin,
  PinOff,
  Play,
  Radar,
  Rocket,
  RotateCcw,
  SlidersHorizontal,
  SquareDashed,
  SquarePen,
  SquareTerminal,
  Star,
  StarOff,
  Tag,
  TextCursorInput,
  Trash2,
  Undo2,
  Wrench,
  X,
  type LucideIcon
} from 'lucide-react'
import type { IconTone } from './iconTone'

/**
 * The icon and tone of each action the commit and ref menus offer — the graph's
 * commit, stash and ref-badge menus, the sidebar's branch, tag and stash rows,
 * the branch picker, the drag-and-drop menus, and every repository menu (tabs,
 * group chips, the Repositories page, the launcher, the repository picker).
 *
 * One table so the same action looks the same wherever it is offered, and a
 * colour means one family of actions in every menu:
 *
 * - `ref` — move between or rewrite refs: checkout, branch/tag here, merge,
 *   rebase, cherry-pick, revert, compare, rename, worktree — and, for a
 *   repository, naming it and filing it into a group, folder or workspace.
 * - `outgoing` — what leaves the machine: push, pull requests, releases, the host.
 * - `incoming` — what comes from a remote: pull, fast-forward.
 * - `shelf` — set aside or noted: stashes, pins, favourites, copies, commit messages.
 * - `guard` — destructive or closing: reset, delete, drop, remove, close. Rows
 *   that already had `danger` keep it, which
 *   paints the icon red with the label.
 * - `preview` — look without changing anything: history, the radar, local CI,
 *   and opening a repository in the terminal, file manager or editor.
 */
export type MenuActionId =
  | 'checkout'
  | 'checkoutDetached'
  | 'createBranch'
  | 'createTag'
  | 'merge'
  | 'mergeOptions'
  | 'rebase'
  | 'interactiveRebase'
  | 'cherryPick'
  | 'revert'
  | 'compare'
  | 'renameBranch'
  | 'renameWithRemote'
  | 'worktree'
  | 'fixup'
  | 'squash'
  | 'push'
  | 'createPr'
  | 'pushAndCreatePr'
  | 'openOnHost'
  | 'goToRelease'
  | 'exportPatch'
  | 'pull'
  | 'fastForward'
  | 'stashApply'
  | 'stashPop'
  | 'renameStash'
  | 'pin'
  | 'unpin'
  | 'copy'
  | 'copyLink'
  | 'amend'
  | 'editMessage'
  | 'clearSelection'
  | 'reset'
  | 'undoCommit'
  | 'moveBranch'
  | 'delete'
  | 'rangeDiff'
  | 'conflictRadar'
  | 'runLocalCi'
  | 'alias'
  | 'removeAlias'
  | 'showWorktrees'
  | 'openMainRepo'
  | 'openTerminal'
  | 'reveal'
  | 'openEditor'
  | 'openWith'
  | 'favourite'
  | 'unfavourite'
  | 'locate'
  | 'addToGroup'
  | 'newGroup'
  | 'newFolder'
  | 'moveToFolder'
  | 'moveToWorkspace'
  | 'eject'
  | 'removeFromList'
  | 'closeTab'
  | 'closeOtherTabs'

export const MENU_ACTION_ICONS: Record<MenuActionId, { Icon: LucideIcon; tone: IconTone }> = {
  checkout: { Icon: GitBranch, tone: 'ref' },
  checkoutDetached: { Icon: GitCommitHorizontal, tone: 'ref' },
  createBranch: { Icon: GitBranchPlus, tone: 'ref' },
  createTag: { Icon: Tag, tone: 'ref' },
  merge: { Icon: GitMerge, tone: 'ref' },
  mergeOptions: { Icon: SlidersHorizontal, tone: 'ref' },
  rebase: { Icon: GitFork, tone: 'ref' },
  interactiveRebase: { Icon: ListOrdered, tone: 'ref' },
  cherryPick: { Icon: Cherry, tone: 'ref' },
  revert: { Icon: Undo2, tone: 'ref' },
  compare: { Icon: GitCompare, tone: 'ref' },
  renameBranch: { Icon: Pencil, tone: 'ref' },
  renameWithRemote: { Icon: PencilLine, tone: 'ref' },
  worktree: { Icon: FolderGit2, tone: 'ref' },
  fixup: { Icon: Wrench, tone: 'ref' },
  squash: { Icon: Combine, tone: 'ref' },
  push: { Icon: ArrowUpFromLine, tone: 'outgoing' },
  createPr: { Icon: GitPullRequest, tone: 'outgoing' },
  pushAndCreatePr: { Icon: GitPullRequestArrow, tone: 'outgoing' },
  openOnHost: { Icon: ExternalLink, tone: 'outgoing' },
  goToRelease: { Icon: Rocket, tone: 'outgoing' },
  exportPatch: { Icon: FileOutput, tone: 'outgoing' },
  pull: { Icon: ArrowDownToLine, tone: 'incoming' },
  fastForward: { Icon: FastForward, tone: 'incoming' },
  stashApply: { Icon: Import, tone: 'shelf' },
  stashPop: { Icon: ArchiveRestore, tone: 'shelf' },
  renameStash: { Icon: Pencil, tone: 'shelf' },
  pin: { Icon: Pin, tone: 'shelf' },
  unpin: { Icon: PinOff, tone: 'shelf' },
  copy: { Icon: Copy, tone: 'shelf' },
  copyLink: { Icon: Link, tone: 'shelf' },
  amend: { Icon: FilePenLine, tone: 'shelf' },
  editMessage: { Icon: SquarePen, tone: 'shelf' },
  clearSelection: { Icon: SquareDashed, tone: 'shelf' },
  reset: { Icon: RotateCcw, tone: 'guard' },
  undoCommit: { Icon: Delete, tone: 'guard' },
  moveBranch: { Icon: MoveRight, tone: 'guard' },
  delete: { Icon: Trash2, tone: 'guard' },
  rangeDiff: { Icon: History, tone: 'preview' },
  conflictRadar: { Icon: Radar, tone: 'preview' },
  runLocalCi: { Icon: Play, tone: 'preview' },
  alias: { Icon: TextCursorInput, tone: 'ref' },
  removeAlias: { Icon: Eraser, tone: 'ref' },
  showWorktrees: { Icon: ListTree, tone: 'preview' },
  openMainRepo: { Icon: FolderOpen, tone: 'preview' },
  openTerminal: { Icon: SquareTerminal, tone: 'preview' },
  reveal: { Icon: FolderSearch, tone: 'preview' },
  openEditor: { Icon: Code, tone: 'preview' },
  openWith: { Icon: AppWindow, tone: 'preview' },
  favourite: { Icon: Star, tone: 'shelf' },
  unfavourite: { Icon: StarOff, tone: 'shelf' },
  locate: { Icon: LocateFixed, tone: 'ref' },
  addToGroup: { Icon: FolderTree, tone: 'ref' },
  newGroup: { Icon: FolderPlus, tone: 'ref' },
  newFolder: { Icon: FolderPlus, tone: 'ref' },
  moveToFolder: { Icon: Folder, tone: 'ref' },
  moveToWorkspace: { Icon: LayoutGrid, tone: 'ref' },
  eject: { Icon: ArrowUpFromDot, tone: 'ref' },
  removeFromList: { Icon: ListX, tone: 'guard' },
  closeTab: { Icon: X, tone: 'guard' },
  closeOtherTabs: { Icon: CopyX, tone: 'guard' }
}

/** The `icon` and `tone` of a menu row for `id`, to spread into a `MenuItem`.
 *  Size 15, as the Tools menu draws them: the swatch rows are indented to
 *  line up with labels after a 15px icon. */
export function menuActionIcon(id: MenuActionId): { icon: ReactNode; tone: IconTone } {
  const { Icon, tone } = MENU_ACTION_ICONS[id]
  return { icon: createElement(Icon, { size: 15 }), tone }
}
