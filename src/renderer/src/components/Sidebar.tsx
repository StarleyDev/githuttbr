import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { repoParentAndName } from '../lib/branchMenu'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  GitBranch,
  Cloud,
  Tag,
  Archive,
  GitPullRequest,
  GitPullRequestArrow,
  CircleDot,
  Milestone,
  Search,
  RefreshCw,
  Check,
  FolderGit2,
  Boxes,
  AlertTriangle,
  GripVertical,
  Laptop,
  Plus,
  Lock,
  ExternalLink,
  Sparkles,
  Rocket,
  Settings2,
  ArrowUpRight,
  FolderTree,
  FilePlus,
  FolderPlus,
  Play,
  ChevronDown,
  Star,
  History,
  Layers,
  ArrowDown,
  Ban,
  CheckSquare,
  Smartphone,
  Globe,
  Power,
  Bookmark as BookmarkIcon,
  Folder,
  FolderOpen,
  Eraser,
  Eye,
  List,
  KeyRound,
  LogIn,
  GitPullRequestCreate
} from 'lucide-react'
import { FileTree } from './FileTree'
import { FileSearchBar, EMPTY_FILTER, type FileFilter } from './FileSearchBar'
import { useRepoStore, repoActions, type RepoData } from '../stores/repo'
import { draggingRef, useUIStore, type MenuItem } from '../stores/ui'
import { refIntegrationItems } from '../lib/refMenuItems'
import { menuActionIcon } from '../lib/menuActionIcons'
import { repoWantsDevices, repoDevicePlatforms } from '../lib/launchDevices'
import { locateBookmark, bookmarkLabel, sortBookmarks, baseName } from '../lib/bookmarks'
import { useSettingsStore } from '../stores/settings'
import { useLaunchStore } from '../stores/launch'
import { gitApi, shellApi } from '../infrastructure/api'
import { groupPrStacks, stackRowStates, type StackRowState } from '../lib/prStacks'
import { ciIcon, ciTitle } from './CiIcon'
import { useT, interp, type TranslationKey } from '../i18n'
import {
  bitbucketServerBasesOf,
  enterpriseBasesOf,
  forkUpstream,
  githubTagUrl,
  repoHasIssueTracker,
  repoSupportsPrReview
} from '../lib/hosting'
import { folderOpenMenuItems } from '../lib/openWith'
import { remoteUnmatchedReason, serverRegistryOf, type UnmatchedRemoteReason } from '../../../shared/remoteProvider'
import { togglePin, selectPinned } from '../lib/pinnedBranches'
import { branchDropActions, encodeDropRef, BRANCH_DND_TYPE, type DropRef } from '../lib/branchDrop'
import { stepRange, claimRangeKeys, ownsRangeKeys, rangeKeysBlocked, domOrder } from '../lib/rangeSelect'
import { openBranchDropMenu } from '../lib/branchDropMenu'
import {
  isRepoOpenInTabs,
  prunableWorktreeCount,
  worktreeDisplayName,
  worktreeForBranch,
  worktreeTabName
} from '../lib/worktrees'
import { WorktreeStatusBadge } from './WorktreeStatusBadge'
import { HUGE_SECTION, openUnlessHuge } from '../lib/sidebarSections'
import {
  buildSearchIndex,
  canMoveSection,
  filterSearchIndex,
  mergeSectionOrder,
  moveSectionBefore,
  moveSectionBy,
  normalizeSidebarQuery,
  resolveSectionOpen,
  sectionCount,
  splitSectionsByMatches,
  totalMatches,
  type SearchFields,
  type SectionTally
} from '../lib/sidebarFilter'
import {
  buildPrefixTree,
  collapseFolderRun,
  collectLeaves,
  leafCount,
  type PrefixNode
} from '../lib/prefixTree'
import { TODO_STATUSES, sortTodos, subtaskProgress, todoStatus, todoSummary, topLevelTodos } from '../lib/todos'
import { TodoPriorityIcon } from './TodoPriorityIcon'
import { TodoStatusIcon, TODO_STATUS_LABEL } from './TodoStatusIcon'
import { canonicalRepoPath } from '../lib/repoAlias'
import { gitlabServerBases } from '../../../shared/gitlabInstance'
import { defaultSettings } from '../../../shared/types'
import type { IconTone } from '../lib/iconTone'
import type { BranchInfo, MergeRiskKind, ReleaseInfo, RemoteBranchInfo, StashInfo, TagInfo, WorktreeInfo, SubmoduleInfo, LaunchGroup, LaunchConfig, PullRequest, IssueInfo, MilestoneInfo, RemoteInfo, RepoTodo, RepoBookmark } from '../../../shared/types'

import { RemoteIcon } from './RemoteIcon'
import { NO_ITEMS } from '../lib/stableEmpty'

/** The Forgejo servers the profiles point at, read when a menu is built. */
const forgejoInstances = (): string[] =>
  useSettingsStore
    .getState()
    .settings.profiles.map((p) => p.forgejoUrl?.trim() ?? '')
    .filter(Boolean)

/** The GitHub Enterprise Servers the profiles name, read when a menu is built. */
const githubEnterprise = (): string[] => enterpriseBasesOf(useSettingsStore.getState().settings.profiles)

/** The self-managed GitLab servers the profiles list, read when a menu is built. */
const gitlabInstances = (): string[] => gitlabServerBases(useSettingsStore.getState().settings.profiles)

/** The Bitbucket Data Centers the profiles name, read when a menu is built. */
const bitbucketServers = (): string[] => bitbucketServerBasesOf(useSettingsStore.getState().settings.profiles)


// Keyboard activation for clickable non-button elements: Enter/Space runs the
// same onClick handler the mouse uses, so every row and icon is reachable.
const keyActivate = (e: React.KeyboardEvent): void => {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).click()
}

// What the one filter box matches in each section. Module-level so the
// search indexes below memoize on a stable function.
const LOCAL_FIELDS: SearchFields<BranchInfo> = (b) => [b.name]
const REMOTE_FIELDS: SearchFields<RemoteBranchInfo> = (b) => [b.fullName]
const TAG_FIELDS: SearchFields<TagInfo> = (tg) => [tg.name]
const RELEASE_FIELDS: SearchFields<ReleaseInfo> = (r) => [r.name, r.tag]
const STASH_FIELDS: SearchFields<StashInfo> = (s) => [s.message, s.branch, `stash@{${s.index}}`]
const WORKTREE_FIELDS: SearchFields<WorktreeInfo> = (w) => [w.path, w.branch]
const SUBMODULE_FIELDS: SearchFields<SubmoduleInfo> = (sm) => [sm.path, sm.name]
const PR_FIELDS: SearchFields<PullRequest> = (pr) => [`#${pr.id}`, pr.title, pr.sourceBranch, pr.author]
const ISSUE_FIELDS: SearchFields<IssueInfo> = (i) => [`#${i.number}`, i.title, i.author]
const MILESTONE_FIELDS: SearchFields<MilestoneInfo> = (m) => [m.title]
const BOOKMARK_FIELDS: SearchFields<RepoBookmark> = (b) => [bookmarkLabel(b), b.file]
const TODO_FIELDS: SearchFields<RepoTodo> = (td) => [td.title]

/**
 * One list narrowed by the sidebar filter. The lowercased index is built once
 * when a filter starts (and again only when the list itself changes), so a
 * keystroke is a substring scan; with no filter the list comes back as is,
 * keeping the identity every memo downstream depends on.
 */
function useSidebarFiltered<T>(items: T[], fields: SearchFields<T>, query: string): T[] {
  const filtering = query !== ''
  const index = useMemo(() => (filtering ? buildSearchIndex(items, fields) : null), [items, fields, filtering])
  return useMemo(() => (index ? filterSearchIndex(index, query) : items), [index, items, query])
}

type RefKind = 'folder' | 'branch' | 'remote' | 'tag'

/** Quiet glyph: folder vs branch vs remote vs tag. Shape only, no colour. */
function KindIcon({ kind, open }: { kind: RefKind; open?: boolean }): React.JSX.Element {
  const size = 12
  const glyph =
    kind === 'folder'
      ? open
        ? <FolderOpen size={size} />
        : <Folder size={size} />
      : kind === 'branch'
        ? <GitBranch size={size} />
        : kind === 'remote'
          ? <Cloud size={size} />
          : <Tag size={size} />
  return <span className="sb-ref-icon" aria-hidden="true">{glyph}</span>
}

/** Why the Pull requests section is empty for an unplaced remote — the https advice only fits ssh. */
const UNMATCHED_HINT: Record<UnmatchedRemoteReason, TranslationKey> = {
  ssh: 'sidebar.prsServerUnmatched',
  sharedBase: 'sidebar.prsServerSharedBase',
  other: 'sidebar.prsServerUnmatchedOther'
}

/** Collapsed runs (`dependabot/npm_and_yarn`) mute the empty prefixes so the
 *  last segment is the one the eye lands on. */
function folderTitle(display: string): React.ReactNode {
  const parts = display.split('/')
  if (parts.length === 1) return display
  return (
    <span className="sb-folder-path">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="sb-folder-slash">/</span>}
          <span className={i === parts.length - 1 ? 'sb-folder-leaf' : 'sb-folder-prefix'}>{p}</span>
        </Fragment>
      ))}
    </span>
  )
}

interface SectionProps {
  title: React.ReactNode
  icon: React.ReactNode
  /** The icon's role for Settings → Themes → Icon colours; none stays grey. */
  tone?: IconTone
  /** When set, shown instead of `icon` while the section is open. Prefix
   *  folders swap Folder → FolderOpen; top-level sections keep one glyph. */
  openIcon?: React.ReactNode
  /** Extra class on the section root — prefix folders use `sb-folder`. */
  className?: string
  count: number
  /** Shown in the count pill instead of `count` — "3 of 41" while filtering. */
  countLabel?: string
  /**
   * A thunk builds the body only when the section is open. JSX children are an
   * argument, so `{open && children}` still pays for constructing them — and on
   * a repository with thousands of remote branches that is thousands of
   * elements built on every Sidebar render, collapsed or not. Pass a function
   * for anything that maps over a ref list; plain nodes are fine for a handful.
   */
  children: React.ReactNode | (() => React.ReactNode)
  defaultOpen?: boolean
  actions?: React.ReactNode
  sectionId?: string
  dragging?: boolean
  dragOver?: boolean
  reorderHint?: string
  onReorderStart?: () => void
  onReorderOver?: (e: React.DragEvent) => void
  onReorderDrop?: () => void
  onReorderEnd?: () => void
  onHeaderContextMenu?: (e: React.MouseEvent) => void
  /** Keyboard reorder (Alt+↑/↓ on the focused header) — dragging alone is not accessible. */
  onMoveBy?: (delta: -1 | 1) => void
  nested?: boolean
  /** Nesting level (0 = top). Drives compounding left-indent so deep folders
   *  (feature/payments/…) read as children, not siblings. */
  depth?: number
  /** Controlled open state — set together with `onToggle` to persist the
   *  expand/collapse choice instead of keeping it in component state. */
  open?: boolean
  onToggle?: (open: boolean) => void
}

function Section({
  title,
  icon,
  tone,
  openIcon,
  className,
  count,
  countLabel,
  children,
  defaultOpen = true,
  actions,
  sectionId,
  dragging,
  dragOver,
  reorderHint,
  onReorderStart,
  onReorderOver,
  onReorderDrop,
  onReorderEnd,
  onHeaderContextMenu,
  onMoveBy,
  nested,
  depth = 0,
  open: openProp,
  onToggle
}: SectionProps): React.JSX.Element {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const open = openProp ?? localOpen
  const toggle = (): void => (onToggle ? onToggle(!open) : setLocalOpen(!open))
  const draggable = !!sectionId
  return (
    <div
      className={`sb-section ${nested ? 'nested' : ''} ${open ? 'is-open' : ''} ${dragging ? 'dragging' : ''} ${dragOver ? 'drag-over' : ''}${className ? ` ${className}` : ''}`}
      data-section={sectionId}
      style={depth > 0 ? ({ '--sb-indent': depth } as React.CSSProperties) : undefined}
      onDragOver={draggable ? onReorderOver : undefined}
      onDrop={
        draggable
          ? (e) => {
              e.preventDefault()
              onReorderDrop?.()
            }
          : undefined
      }
    >
      <div
        className="sb-header"
        data-tone={tone}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-keyshortcuts={onMoveBy ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
        draggable={draggable}
        onClick={toggle}
        onKeyDown={(e) => {
          if (onMoveBy && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault()
            e.stopPropagation()
            onMoveBy(e.key === 'ArrowUp' ? -1 : 1)
            return
          }
          keyActivate(e)
        }}
        onContextMenu={onHeaderContextMenu}
        onDragStart={draggable ? onReorderStart : undefined}
        onDragEnd={draggable ? onReorderEnd : undefined}
      >
        {draggable && (
          <span className="sb-grip" title={reorderHint} onClick={(e) => e.stopPropagation()}>
            <GripVertical size={12} />
          </span>
        )}
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} className="sb-arrow">
          <ChevronRight size={13} />
        </motion.span>
        {open && openIcon ? openIcon : icon}
        <span className="sb-title" title={typeof title === 'string' ? title : undefined}>
          {title}
        </span>
        {actions && <span className="sb-actions">{actions}</span>}
        <span className="sb-count">{countLabel ?? count}</span>
      </div>
      {nested ? (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={`sb-body${count > HUGE_SECTION ? ' is-huge' : ''}`}
            >
              {typeof children === 'function' ? children() : children}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        // A top-level body is a flex pane sharing the sidebar's height with its
        // open siblings, so it cannot animate to a content height: the pane is
        // sized by the container, not by what is in it. It fades in via CSS.
        open && (
          <div className={`sb-body${count > HUGE_SECTION ? ' is-huge' : ''}`}>
            {typeof children === 'function' ? children() : children}
          </div>
        )
      )}
    </div>
  )
}

export function Sidebar({ repo }: { repo: RepoData }): React.JSX.Element {
  const { openContextMenu, openModal, setFileView, toast } = useUIStore()
  const refreshPRs = useRepoStore((s) => s.refreshPRs)
  const refreshReleases = useRepoStore((s) => s.refreshReleases)
  const select = useRepoStore((s) => s.select)
  const requestScrollTo = useUIStore((s) => s.requestScrollTo)
  const baseSidebarOrder = useSettingsStore((s) => s.settings.sidebarOrder)
  const baseSidebarHidden = useSettingsStore((s) => s.settings.sidebarHidden)
  const repoLayout = useSettingsStore((s) => s.settings.repoLayouts?.[repo.path])
  // Sidebar section order/visibility is per-repository: a repo's own override
  // wins, otherwise the global defaults apply.
  const sidebarOrder = useMemo(() => repoLayout?.sidebarOrder ?? baseSidebarOrder, [repoLayout, baseSidebarOrder])
  const sidebarHidden = useMemo(() => repoLayout?.sidebarHidden ?? baseSidebarHidden, [repoLayout, baseSidebarHidden])
  const groupBranches = useSettingsStore((s) => s.settings.groupBranches)
  const profiles = useSettingsStore((s) => s.settings.profiles)
  // A remote on a configured server's hostname that no server claims (ssh to a
  // hostname two providers share) gets no PRs: say why rather than show "none".
  const prOriginUrl = (repo.remotes.find((r) => r.name === 'origin') ?? repo.remotes[0])?.url
  const prServerUnmatched = useMemo(
    () => (prOriginUrl ? remoteUnmatchedReason(prOriginUrl, serverRegistryOf(profiles)) : null),
    [prOriginUrl, profiles]
  )
  const updateRepoLayout = useSettingsStore((s) => s.updateRepoLayout)
  const openPageTab = useSettingsStore((s) => s.openPageTab)
  const openRepoTab = useSettingsStore((s) => s.openRepoTab)
  const aiEnabled = useSettingsStore((s) => s.activeAI().enabled !== false)
  const defaultOpenApp = useSettingsStore((s) => s.settings.defaultOpenApp)
  const editor = useSettingsStore((s) => s.settings.editor)
  // Todos are app state, not repository state: they live in settings keyed by
  // canonical path, so the same repo opened twice shows one list.
  const todosByRepo = useSettingsStore((s) => s.settings.repoTodos)
  const hideDoneTodos = useSettingsStore((s) => s.settings.todosHideDone)
  const manualTodoOrder = !!useSettingsStore((s) => s.settings.todosManualOrder)
  const todos = useMemo(
    () => todosByRepo?.[canonicalRepoPath(repo.path)] ?? [],
    [todosByRepo, repo.path]
  )
  const t = useT()
  const [filter, setFilter] = useState('')
  // The refresh cycle reads this to decide whether the file tree's badges are
  // worth a second `git status` walk, so it lives in the UI store, not here.
  const tab = useUIStore((s) => s.sidebarTab)
  const setTab = useUIStore((s) => s.setSidebarTab)

  // ...and because refreshes skip that slice while the tab is closed, fetch it
  // the moment it opens, or when the repo changes under an open one.
  useEffect(() => {
    if (tab !== 'files') return
    void useRepoStore.getState().refresh(repo.path, { only: ['treeStatus'] })
  }, [tab, repo.path])

  // ─── Launch configs (.vscode/launch.json) ───
  const enableLaunchJson = useSettingsStore((s) => s.settings.enableLaunchJson)
  const launchGroups = useLaunchStore((s) => s.groupsByRepo[repo.path] ?? NO_ITEMS)
  const discoverLaunch = useLaunchStore((s) => s.discover)
  const runLaunch = useLaunchStore((s) => s.run)
  useEffect(() => {
    if (enableLaunchJson) void discoverLaunch(repo.path)
  }, [repo.path, enableLaunchJson, discoverLaunch])
  const hasLaunch = enableLaunchJson && launchGroups.some((g) => g.configs.length > 0)

  // ─── Run target (which phone / simulator / desktop a config launches on) ───
  // VS Code's device picker belongs to the Flutter extension; the same choice
  // exists for React Native, Expo, Capacitor and xcodebuild, so the picker is
  // shown whenever any config in the repo can take a device at all.
  const deviceSnapshot = useLaunchStore((s) => s.devicesByRepo[repo.path])
  const devicesLoading = useLaunchStore((s) => s.devicesLoading[repo.path] === true)
  const selectedDevice = useLaunchStore((s) => s.deviceByRepo[repo.path]) ?? null
  const loadDevices = useLaunchStore((s) => s.loadDevices)
  const selectDevice = useLaunchStore((s) => s.selectDevice)
  const bootDevice = useLaunchStore((s) => s.bootDevice)
  const launchConfigs = useMemo(() => launchGroups.flatMap((g) => g.configs), [launchGroups])
  const launchScripts = useMemo(() => {
    const out: Record<string, string> = {}
    for (const g of launchGroups) Object.assign(out, g.scripts ?? {})
    return out
  }, [launchGroups])
  const wantsDevices = hasLaunch && repoWantsDevices(launchConfigs, launchScripts)
  useEffect(() => {
    if (!wantsDevices) return
    // Hydrate the remembered choice, then ask the SDK CLIs once per repo —
    // they are slow enough that doing it on the first click would feel broken.
    useLaunchStore.getState().deviceFor(repo.path)
    if (!useLaunchStore.getState().devicesByRepo[repo.path]) void loadDevices(repo.path)
  }, [repo.path, wantsDevices, loadDevices])

  const deviceIcon = (d: { platform: string }): React.JSX.Element =>
    d.platform === 'ios' || d.platform === 'android' ? (
      <Smartphone size={13} />
    ) : d.platform === 'web' ? (
      <Globe size={13} />
    ) : (
      <Laptop size={13} />
    )

  const openDeviceMenu = (x: number, y: number): void => {
    const platforms = repoDevicePlatforms(launchConfigs, launchScripts)
    const list = (deviceSnapshot?.devices ?? []).filter((d) => platforms.includes(d.platform))
    const items: MenuItem[] = [{ label: t('device.title'), disabled: true }]
    if (list.length === 0) {
      items.push({ label: devicesLoading ? t('device.scanning') : t('device.none'), disabled: true })
    }
    let coldHeader = false
    for (const d of list) {
      // Everything below this line has to be booted before it can take a run.
      if (!d.running && !coldHeader) {
        items.push({ separator: true }, { label: t('device.notRunning'), disabled: true })
        coldHeader = true
      }
      const selected = selectedDevice?.id === d.id
      items.push({
        label: d.detail ? `${d.name}  ·  ${d.detail}` : d.name,
        icon: selected ? <Check size={13} /> : d.running ? deviceIcon(d) : <Power size={13} />,
        title: d.running ? undefined : t('device.start'),
        onClick: () => (d.running ? selectDevice(repo.path, d) : void bootDevice(repo.path, d))
      })
    }
    items.push(
      { separator: true },
      {
        label: t('device.any'),
        icon: selectedDevice ? undefined : <Check size={13} />,
        title: t('device.anyTitle'),
        onClick: () => selectDevice(repo.path, null)
      },
      { label: t('device.refresh'), icon: <RefreshCw size={13} />, onClick: () => void loadDevices(repo.path) }
    )
    const missing = deviceSnapshot?.missing ?? []
    if (missing.length > 0) {
      items.push({
        label: interp(t('device.missing'), { tools: missing.join(', ') }),
        disabled: true,
        title: t('device.missingTitle')
      })
    }
    openContextMenu(x, y, items)
  }

  // Build the Run/Debug picker: root group first, deeper folders after a
  // divider; a lone deeper folder shows with no divider. Within a folder we
  // honour `presentation` — hidden configs are skipped and the rest are sorted
  // by `group` then `order` (then their original order), matching VS Code.
  const visibleConfigs = (g: LaunchGroup): LaunchConfig[] =>
    g.configs
      .filter((c) => !c.presentation?.hidden)
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const ga = a.c.presentation?.group ?? ''
        const gb = b.c.presentation?.group ?? ''
        if (ga !== gb) return ga < gb ? -1 : 1
        const oa = a.c.presentation?.order ?? Number.MAX_SAFE_INTEGER
        const ob = b.c.presentation?.order ?? Number.MAX_SAFE_INTEGER
        return oa - ob || a.i - b.i
      })
      .map(({ c }) => c)

  const openLaunchMenu = (x: number, y: number): void => {
    const groups = launchGroups
      .map((g) => ({ g, configs: visibleConfigs(g) }))
      .filter(({ configs }) => configs.length > 0)
    const showLabels = groups.length > 1
    const items: MenuItem[] = []
    groups.forEach(({ g, configs }, gi) => {
      if (gi > 0) items.push({ separator: true })
      if (showLabels) items.push({ label: g.label, disabled: true })
      let prevGroup: string | undefined
      configs.forEach((cfg, ci) => {
        // Draw a divider when the presentation group changes within a folder.
        const grp = cfg.presentation?.group
        if (ci > 0 && grp !== prevGroup) items.push({ separator: true })
        prevGroup = grp
        items.push({
          label: cfg.name,
          icon: <Play size={13} />,
          onClick: () => void runLaunch(repo.path, g, cfg)
        })
      })
    })
    openContextMenu(x, y, items)
  }
  const [fileFilter, setFileFilter] = useState<FileFilter>(EMPTY_FILTER)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  // Drag-a-branch-onto-another (merge / rebase gesture).
  // The dragged ref lives in the UI store, shared with the graph, and is read at
  // event time (`draggingRef()`) — a row rendered before the drag began would
  // otherwise still see "nothing dragged" and refuse the drop.
  const setDragRef = useUIStore((s) => s.setDraggingRef)
  const [dropBranch, setDropBranch] = useState<string | null>(null)
  const path = repo.path
  // Typing stays on the urgent path; the narrowing of every section trails it,
  // so a burst of keys over ten thousand refs never blocks the input.
  const f = normalizeSidebarQuery(useDeferredValue(filter))
  const filtering = f !== ''
  // Folds opened or closed while a filter is active. Kept out of the persisted
  // layout so clearing the box restores the arrangement the user had.
  const [filterOpen, setFilterOpen] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!filtering) setFilterOpen({})
  }, [filtering])

  // ─── Multi-select (Cmd/Ctrl-click toggle, Shift-click range) ───
  // One section "owns" the selection at a time; `kind` namespaces the ids.
  const [sel, setSel] = useState<{ kind: string; ids: string[] } | null>(null)
  /** Which pull-request stacks are expanded; collapsed is the point of them. */
  const [openPrStacks, setOpenPrStacks] = useState<Record<number, boolean>>({})
  const lastClick = useRef<{ kind: string; id: string } | null>(null)
  const isSel = (kind: string, id: string): boolean => sel?.kind === kind && sel.ids.includes(id)
  const clearSel = (): void => setSel(null)

  // Returns true when the click was a multi-select gesture (caller skips its
  // normal navigate/select action).
  // Visual row order for a kind, read from the DOM — with branch grouping on,
  // the flat id arrays diverge from what is rendered, and ranges must follow
  // the rows the user actually sees. Falls back to the flat order when the
  // rows are not mounted.
  const kbOrder = (kind: string, fallback: string[]): string[] => {
    const d = domOrder(document.querySelector('.sidebar'), `[data-kbkind="${kind}"]`, 'data-kbid')
    return d.length ? d : fallback
  }

  const onSelectClick = (kind: string, id: string, ordered: string[], e: React.MouseEvent): boolean => {
    claimRangeKeys(keyToken)
    if (e.metaKey || e.ctrlKey) {
      setSel((prev) =>
        !prev || prev.kind !== kind
          ? { kind, ids: [id] }
          : prev.ids.includes(id)
            ? { kind, ids: prev.ids.filter((x) => x !== id) }
            : { kind, ids: [...prev.ids, id] }
      )
      lastClick.current = { kind, id }
      return true
    }
    if (e.shiftKey && lastClick.current?.kind === kind) {
      const order = kbOrder(kind, ordered)
      const a = order.indexOf(lastClick.current.id)
      const b = order.indexOf(id)
      if (a !== -1 && b !== -1) {
        const range = order.slice(Math.min(a, b), Math.max(a, b) + 1)
        setSel((prev) => ({ kind, ids: Array.from(new Set([...(prev?.kind === kind ? prev.ids : []), ...range])) }))
        return true
      }
    }
    lastClick.current = { kind, id }
    clearSel()
    return false
  }

  // ─── Shift+↑/↓ grows the selection from the last clicked row ───
  // The anchor is the last plain click; `rangeEnd` is the moving end of the
  // range, so pressing the opposite arrow shrinks the range back, like a text
  // selection. Refs (not deps) keep the window listener subscribed once, and
  // the panel only reacts while it owns the keys (last panel clicked in).
  const keyToken = useRef(Symbol('sidebar')).current
  const selRef = useRef(sel)
  selRef.current = sel
  const orderedRef = useRef<Record<string, string[]>>({})
  const rangeEnd = useRef<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.shiftKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
      if (!ownsRangeKeys(keyToken) || rangeKeysBlocked(e.target)) return
      const anchor = lastClick.current
      if (!anchor) return
      // Continue from the previous range end only while its selection is live;
      // a fresh click cleared it, so the next press starts from the anchor.
      const live =
        selRef.current?.kind === anchor.kind && rangeEnd.current && selRef.current.ids.includes(rangeEnd.current)
      const step = stepRange(
        kbOrder(anchor.kind, orderedRef.current[anchor.kind] ?? []),
        anchor.id,
        live ? rangeEnd.current : null,
        e.key === 'ArrowDown' ? 1 : -1
      )
      if (!step) return
      e.preventDefault()
      rangeEnd.current = step.end
      setSel({ kind: anchor.kind, ids: step.ids })
      document
        .querySelector(`.sidebar [data-kbkind="${anchor.kind}"][data-kbid="${CSS.escape(step.end)}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyToken])

  // Picks the bulk menu when right-clicking inside a multi-selection, else the
  // single-item menu. `bulk` receives the selected ids (≥2).
  const ctxMenu = (
    e: React.MouseEvent,
    kind: string,
    id: string,
    single: () => MenuItem[],
    bulk: (ids: string[]) => MenuItem[]
  ): void => {
    e.preventDefault()
    const ids = isSel(kind, id) && sel && sel.ids.length > 1 ? sel.ids : null
    openContextMenu(e.clientX, e.clientY, ids ? bulk(ids) : single())
  }

  const localBulkMenu = (names: string[]): MenuItem[] => {
    const deletable = names.filter((n) => n !== repo.branches.current.trim())
    return [
      {
        ...menuActionIcon('push'),
        label: interp(t('sidebar.pushNBranches'), { n: names.length }),
        disabled: repo.remotes.length === 0,
        onClick: () => {
          openModal({ kind: 'push-branches', repoPath: path, preselect: names })
          clearSel()
        }
      },
      { separator: true },
      {
        ...menuActionIcon('delete'),
        label: interp(t('sidebar.deleteNBranches'), { n: deletable.length }),
        danger: true,
        disabled: deletable.length === 0,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.deleteBranchesTitle'),
            message: `${interp(t('sidebar.deleteBranchesMsg'), { n: deletable.length })}\n\n${deletable.join('\n')}`,
            danger: true,
            confirmLabel: t('sidebar.deleteBranchesConfirm'),
            onConfirm: () => {
              void repoActions.deleteBranches(path, deletable)
              clearSel()
            }
          })
      }
    ]
  }

  const remoteBulkMenu = (fullNames: string[]): MenuItem[] => {
    const items = fullNames
      .map((fn) => repo.branches.remotes.find((r) => r.fullName === fn))
      .filter((r): r is RemoteBranchInfo => !!r)
      .map((r) => ({ remote: r.remote, name: r.name }))
    return [
      {
        ...menuActionIcon('delete'),
        label: interp(t('sidebar.deleteNRemoteBranches'), { n: items.length }),
        danger: true,
        disabled: items.length === 0,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.deleteRemoteBranchesTitle'),
            message: `${interp(t('sidebar.deleteRemoteBranchesMsg'), { n: items.length })}\n\n${fullNames.join('\n')}`,
            danger: true,
            confirmLabel: t('sidebar.deleteRemoteBranchesConfirm'),
            onConfirm: () => {
              void repoActions.deleteRemoteBranches(path, items)
              clearSel()
            }
          })
      }
    ]
  }

  // Right-click on a branch folder header: delete everything the folder holds.
  // The current branch is silently excluded — git refuses to delete it anyway.
  const localFolderMenu = (folder: string, node: PrefixNode<BranchInfo>): MenuItem[] => {
    const deletable = collectLeaves(node)
      .map((b) => b.name)
      .filter((n) => n !== repo.branches.current.trim())
    const all = collectLeaves(node).map((b) => b.name)
    return [
      {
        ...menuActionIcon('push'),
        label: interp(t('sidebar.pushFolderBranches'), { folder, n: all.length }),
        disabled: repo.remotes.length === 0,
        onClick: () => openModal({ kind: 'push-branches', repoPath: path, preselect: all })
      },
      { separator: true },
      {
        ...menuActionIcon('delete'),
        label: interp(t('sidebar.deleteFolderBranches'), { folder, n: deletable.length }),
        danger: true,
        disabled: deletable.length === 0,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.deleteBranchesTitle'),
            message: `${interp(t('sidebar.deleteBranchesMsg'), { n: deletable.length })}\n\n${deletable.join('\n')}`,
            danger: true,
            confirmLabel: t('sidebar.deleteBranchesConfirm'),
            onConfirm: () => void repoActions.deleteBranches(path, deletable)
          })
      }
    ]
  }

  const remoteFolderMenu = (folder: string, node: PrefixNode<RemoteBranchInfo>): MenuItem[] => {
    const branches = collectLeaves(node)
    const items = branches.map((b) => ({ remote: b.remote, name: b.name }))
    return [
      {
        ...menuActionIcon('delete'),
        label: interp(t('sidebar.deleteFolderRemoteBranches'), { folder, n: items.length }),
        danger: true,
        disabled: items.length === 0,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.deleteRemoteBranchesTitle'),
            message: `${interp(t('sidebar.deleteRemoteBranchesMsg'), { n: items.length })}\n\n${branches.map((b) => b.fullName).join('\n')}`,
            danger: true,
            confirmLabel: t('sidebar.deleteRemoteBranchesConfirm'),
            onConfirm: () => void repoActions.deleteRemoteBranches(path, items)
          })
      }
    ]
  }

  const stashBulkMenu = (ids: string[]): MenuItem[] => {
    const indices = ids.map(Number)
    return [
      {
        ...menuActionIcon('delete'),
        label: interp(t('sidebar.dropNStashes'), { n: indices.length }),
        danger: true,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.dropStashesTitle'),
            message: interp(t('sidebar.dropStashesMsg'), { n: indices.length }),
            danger: true,
            confirmLabel: t('sidebar.dropStashesConfirm'),
            onConfirm: () => {
              void repoActions.stashDropMany(path, indices)
              clearSel()
            }
          })
      }
    ]
  }

  const tagBulkMenu = (names: string[]): MenuItem[] => [
    {
      ...menuActionIcon('delete'),
      label: interp(t('sidebar.deleteNTags'), { n: names.length }),
      danger: true,
      onClick: () =>
        openModal({
          kind: 'confirm',
          title: t('sidebar.deleteTagsTitle'),
          message: `${interp(t('sidebar.deleteTagsMsg'), { n: names.length })}\n\n${names.join('\n')}`,
          danger: true,
          confirmLabel: t('sidebar.deleteTagsConfirm'),
          onConfirm: () => {
            void repoActions.deleteTags(path, names)
            clearSel()
          }
        })
    }
  ]

  // Click a branch → select & scroll the graph to its tip commit.
  const goToBranch = (sha: string): void => {
    const commit = repo.commits.find((c) => c.hash.startsWith(sha) || sha.startsWith(c.hash))
    const hash = commit?.hash ?? sha
    select(path, { type: 'commit', hash })
    requestScrollTo(hash, path)
  }

  const locals = useSidebarFiltered(repo.branches.locals, LOCAL_FIELDS, f)
  // Starred branches surface in a dedicated group at the top of Local; the pin
  // list is per-repo (RepoLayout) and rows also stay in their normal spot below.
  const pinnedNames = useMemo(() => repoLayout?.pinnedBranches ?? [], [repoLayout])
  const pinnedLocals = useMemo(() => selectPinned(locals, pinnedNames, (b) => b.name), [locals, pinnedNames])
  const isPinned = (name: string): boolean => pinnedNames.includes(name)
  const togglePinBranch = (name: string): void =>
    updateRepoLayout(path, (l) => ({ ...l, pinnedBranches: togglePin(l.pinnedBranches ?? [], name) }))

  // Expand/collapse choices are per-repo and survive restarts: an explicit
  // toggle is recorded in RepoLayout and wins over the section's default.
  // Top-level sections default closed except Local: open panes share the
  // sidebar's height, so a fresh repo showing every section would be a stack
  // of slivers. Nested folders keep opening by default — they only cost rows.
  // While a filter is active a fold opens when it holds matches (unless that
  // is enough rows to stall the sidebar), and a toggle lasts only as long as
  // the filter does — see resolveSectionOpen.
  const sidebarExpanded = repoLayout?.sidebarExpanded
  const persistOpen = (
    key: string,
    defaultOpen = true,
    filterDefault = defaultOpen
  ): Pick<SectionProps, 'open' | 'onToggle'> => ({
    open: resolveSectionOpen({ key, persisted: sidebarExpanded, defaultOpen, filtering, session: filterOpen, filterDefault }),
    onToggle: (o: boolean) =>
      filtering
        ? setFilterOpen((prev) => ({ ...prev, [key]: o }))
        : updateRepoLayout(path, (l) => ({ ...l, sidebarExpanded: { ...(l.sidebarExpanded ?? {}), [key]: o } }))
  })
  const remotes = useSidebarFiltered(repo.branches.remotes, REMOTE_FIELDS, f)
  // Verdict from the last Conflict Radar scan, if any. `merged` branches get no
  // dot — a row of grey dots on everything already in main is just noise.
  const riskByRef = useMemo(() => {
    const m = new Map<string, MergeRiskKind>()
    for (const e of repo.mergeRisk?.entries ?? []) m.set(e.ref, e.status)
    return m
  }, [repo.mergeRisk])
  const riskDot = (ref: string): React.JSX.Element | null => {
    const status = riskByRef.get(ref)
    if (!status || status === 'merged') return null
    return <span className={`branch-risk ${status}`} title={t(`radar.status.${status}` as 'radar.status.clean')} />
  }
  // Local branches arranged into a folder tree by their "/"-separated prefix.
  const branchTree = useMemo(() => buildPrefixTree(locals, (b) => b.name), [locals])
  const tags = useSidebarFiltered(repo.branches.tags, TAG_FIELDS, f)
  const releases = useSidebarFiltered(repo.releases, RELEASE_FIELDS, f)
  const stashes = useSidebarFiltered(repo.stashes, STASH_FIELDS, f)
  const worktrees = useSidebarFiltered(repo.worktrees, WORKTREE_FIELDS, f)
  const submodules = useSidebarFiltered(repo.submodules, SUBMODULE_FIELDS, f)
  const prs = useSidebarFiltered(repo.prs, PR_FIELDS, f)
  const upstreamPrs = useSidebarFiltered(repo.upstreamPrs, PR_FIELDS, f)
  const issues = useSidebarFiltered(repo.issues, ISSUE_FIELDS, f)
  const openMilestones = useMemo(() => repo.milestones.filter((m) => m.state === 'open'), [repo.milestones])
  const milestones = useSidebarFiltered(openMilestones, MILESTONE_FIELDS, f)
  // Tag name → its release, so the Tags section can jump straight to a release.
  const releaseByTag = useMemo(() => {
    const map = new Map<string, (typeof repo.releases)[number]>()
    for (const r of repo.releases) if (r.tag && !map.has(r.tag)) map.set(r.tag, r)
    return map
  }, [repo.releases])

  const remoteGroups = useMemo(() => {
    const map = new Map<string, RemoteBranchInfo[]>()
    for (const r of remotes) {
      const arr = map.get(r.remote) ?? []
      arr.push(r)
      map.set(r.remote, arr)
    }
    return map
  }, [remotes])

  // Per-remote prefix trees, so each remote's branches fold the same way locals do.
  const remoteTrees = useMemo(() => {
    const m = new Map<string, PrefixNode<RemoteBranchInfo>>()
    for (const [name, brs] of remoteGroups) m.set(name, buildPrefixTree(brs, (b) => b.name))
    return m
  }, [remoteGroups])

  // Tags folded by "/" namespace (release/*, nightly/*, monorepo pkg/v1.0…).
  const tagTree = useMemo(() => buildPrefixTree(tags, (tg) => tg.name), [tags])

  // Which remotes hold a branch with a given name → drives the presence icons.
  const branchPresence = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of repo.branches.remotes) {
      const arr = map.get(r.name) ?? []
      if (!arr.includes(r.remote)) arr.push(r.remote)
      map.set(r.name, arr)
    }
    return map
  }, [repo.branches.remotes])

  const remoteUrl = (name: string): string | undefined => repo.remotes.find((r) => r.name === name)?.url

  // The hosting-platform web URL for a tag (GitHub release page / Azure tag
  // view). Used by both the tag context menu and the hover-to-open cloud icon.
  const tagWebLink = (tagName: string): string | null => {
    const url = repo.remotes[0]?.url
    if (!url) return null
    const gh = githubTagUrl(url, tagName, githubEnterprise())
    if (gh) return gh
    const az = /dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+?)(\.git)?$/.exec(url)
    if (az) return `https://dev.azure.com/${az[1]}/${az[2]}/_git/${az[3]}?version=GT${tagName}`
    return null
  }

  // Small icon strip: a laptop for "on this computer" plus one icon per remote
  // that has the same branch, collapsing extras into a "+N" badge.
  const Presence = ({ remoteNames, local = true }: { remoteNames: string[]; local?: boolean }): React.JSX.Element => {
    const shown = remoteNames.slice(0, 2)
    const extra = remoteNames.length - shown.length
    const title = remoteNames.length
      ? [...(local ? [t('sidebar.thisComputer')] : []), ...remoteNames].join(', ')
      : t('sidebar.localOnly')
    return (
      <span className="sb-presence" title={title}>
        {local && <Laptop size={11} className="presence-local" />}
        {shown.map((rm) => (
          <span key={rm} className="presence-remote">
            <RemoteIcon url={remoteUrl(rm)} size={11} />
          </span>
        ))}
        {extra > 0 && <span className="presence-more">+{extra}</span>}
      </span>
    )
  }

  const createTagAtHead = (): void => openModal({ kind: 'create-tag', repoPath: path, at: 'HEAD' })

  const tagMenu = (tag: TagInfo): MenuItem[] => {
    const remoteName = repo.remotes[0]?.name ?? 'origin'
    const currentBranch = repo.branches.current.trim()
    const isPushed = repo.remoteTagNames.includes(tag.name)
    const webUrl = tagWebLink(tag.name)
    const release = releaseByTag.get(tag.name)
    return [
      ...(release
        ? [
            {
              ...menuActionIcon('goToRelease'),
              label: interp(t('sidebar.goToRelease'), { name: release.name || release.tag || tag.name }),
              onClick: () => openPageTab({ type: 'release', release, repoPath: path })
            } satisfies MenuItem,
            { separator: true } satisfies MenuItem
          ]
        : []),
      { ...menuActionIcon('checkout'), label: interp(t('sidebar.checkoutTag'), { tag: tag.name }), onClick: () => void repoActions.checkout(path, tag.name) },
      { separator: true },
      {
        ...menuActionIcon('rebase'),
        label: interp(t('sidebar.rebaseOnTag'), { branch: currentBranch, tag: tag.name }),
        disabled: !currentBranch,
        onClick: () => void repoActions.rebase(path, tag.name)
      },
      {
        ...menuActionIcon('reset'),
        label: interp(t('sidebar.resetToTagSoft'), { branch: currentBranch }),
        disabled: !currentBranch,
        onClick: () => void repoActions.reset(path, tag.name, 'soft')
      },
      {
        ...menuActionIcon('reset'),
        label: interp(t('sidebar.resetToTagMixed'), { branch: currentBranch }),
        disabled: !currentBranch,
        onClick: () => void repoActions.reset(path, tag.name, 'mixed')
      },
      {
        ...menuActionIcon('reset'),
        label: interp(t('sidebar.resetToTagHard'), { branch: currentBranch }),
        danger: true,
        disabled: !currentBranch,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.hardResetTitle'),
            message: interp(t('sidebar.hardResetMsg'), { ref: tag.name }),
            danger: true,
            confirmLabel: t('sidebar.hardResetConfirm'),
            onConfirm: () => void repoActions.reset(path, tag.name, 'hard')
          })
      },
      { separator: true },
      { ...menuActionIcon('copy'), label: t('sidebar.copyTagName'), onClick: () => void navigator.clipboard.writeText(tag.name) },
      ...(webUrl
        ? [
            { ...menuActionIcon('openOnHost'), label: interp(t('sidebar.openTagOnWeb'), { tag: tag.name, remote: remoteName }), onClick: () => void shellApi.openExternal(webUrl) } satisfies MenuItem,
            { ...menuActionIcon('copyLink'), label: interp(t('sidebar.copyTagLink'), { tag: tag.name, remote: remoteName }), onClick: () => void navigator.clipboard.writeText(webUrl) } satisfies MenuItem
          ]
        : []),
      { ...menuActionIcon('createTag'), label: t('sidebar.createTagHere'), onClick: createTagAtHead },
      { separator: true },
      ...(repo.remotes.length && !isPushed
        ? [{ ...menuActionIcon('push'), label: interp(t('sidebar.pushTag'), { tag: tag.name, remote: remoteName }), onClick: () => void repoActions.pushTag(path, tag.name, remoteName) } satisfies MenuItem]
        : []),
      ...(repo.remotes.length && isPushed
        ? [{
            ...menuActionIcon('delete'),
            label: t('sidebar.deleteRemoteTag'),
            danger: true,
            onClick: () =>
              openModal({
                kind: 'confirm',
                title: t('sidebar.deleteRemoteTag'),
                message: interp(t('sidebar.deleteRemoteTagMsg'), { tag: tag.name, remote: remoteName }),
                danger: true,
                confirmLabel: t('sidebar.deleteRemoteTagConfirm'),
                onConfirm: () => void repoActions.deleteRemoteTag(path, tag.name, remoteName)
              })
          } satisfies MenuItem]
        : []),
      {
        ...menuActionIcon('delete'),
        label: t('sidebar.deleteTagLocal'),
        danger: true,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.deleteTagLocal'),
            message: interp(t('sidebar.deleteTagLocalMsg'), { tag: tag.name }),
            danger: true,
            confirmLabel: t('sidebar.deleteTagLocalConfirm'),
            onConfirm: () => void repoActions.deleteTag(path, tag.name)
          })
      }
    ]
  }

  // Dropped branch `source` onto `target`: offer merge / rebase.
  /** Drag props shared by every ref row: branches, remote branches and tags can
   *  all be dragged, and a local branch row can also be dropped on. */
  const refDrag = (ref: DropRef): React.HTMLAttributes<HTMLDivElement> & { draggable: true } => ({
    draggable: true,
    onDragStart: (e) => {
      setDragRef(ref)
      // 'move', not 'link': Wayland's drag-and-drop has only copy, move and ask.
      // A 'link' drag maps to no action there, so the compositor shows the
      // no-drop cursor over every target — though the drop still arrives.
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData(BRANCH_DND_TYPE, encodeDropRef(ref))
      e.dataTransfer.setData('text/plain', ref.name)
    },
    onDragEnd: () => {
      setDragRef(null)
      setDropBranch(null)
    }
  })

  /** Drop props for a local branch row — the only kind git can merge into. */
  const refDrop = (target: DropRef): React.HTMLAttributes<HTMLDivElement> => ({
    onDragOver: (e) => {
      const dragRef = draggingRef()
      if (!dragRef || !branchDropActions(dragRef, target).length) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dropBranch !== target.name) setDropBranch(target.name)
    },
    onDragLeave: () => dropBranch === target.name && setDropBranch(null),
    onDrop: (e) => {
      e.preventDefault()
      const source = draggingRef()
      setDragRef(null)
      setDropBranch(null)
      if (source) void openBranchDropMenu(path, source, target, e.clientX, e.clientY)
    }
  })

  // The family's main worktree — `path` itself may be a linked worktree, and
  // grouping/labels key on the root, not on whoever was asked.
  const worktreeRootPath = repo.worktrees.find((w) => w.isMain)?.path ?? path

  // Create a worktree for `branch` in a sibling folder and open it as a tab.
  const openInWorktree = async (branch: string): Promise<void> => {
    const segs = path.split(/[/\\]/).filter(Boolean)
    const repoName = segs[segs.length - 1]
    const parent = path.slice(0, path.length - repoName.length - 1)
    const dir = `${parent}/${repoName}--${branch.replace(/[^\w.-]+/g, '-')}`
    const ok = await repoActions.worktreeAdd(path, dir, branch, false)
    if (ok)
      useSettingsStore
        .getState()
        .openWorktreeRepo({ path: dir, name: `${repoName} · ${branch}` }, worktreeRootPath)
  }

  /** Open an existing worktree as its own repo tab — the sibling of
   *  openInWorktree, which creates one first. */
  const openWorktreeTab = (w: WorktreeInfo): void =>
    useSettingsStore
      .getState()
      .openWorktreeRepo({ path: w.path, name: worktreeTabName(worktreeRootPath, w) }, worktreeRootPath)

  // Shared by the context menu and the row's hover actions, so the two can
  // never wire a branch to different git paths.
  const checkoutBranch = (b: BranchInfo): void => void repoActions.checkout(path, b.name)
  const createPrFromBranch = (b: BranchInfo): void => openModal({ kind: 'create-pr', repoPath: path, source: b.name })
  const checkoutLabel = (b: BranchInfo): string =>
    interp(t(worktreeForBranch(repo.worktrees, b.name) ? 'sidebar.goToWorktree' : 'sidebar.checkoutBranch'), {
      branch: b.name
    })

  const localMenu = (b: BranchInfo): MenuItem[] => [
    ...(worktreeForBranch(repo.worktrees, b.name)
      ? [{ ...menuActionIcon('checkout'), label: checkoutLabel(b), onClick: () => checkoutBranch(b) }]
      : [
          { ...menuActionIcon('checkout'), label: checkoutLabel(b), disabled: b.isCurrent, onClick: () => checkoutBranch(b) },
          { ...menuActionIcon('worktree'), label: interp(t('sidebar.openInWorktree'), { branch: b.name }), onClick: () => void openInWorktree(b.name) }
        ]),
    // Merge / merge with options / rebase / compare — the same block the graph's
    // ref badges render, from one place so the two cannot drift apart.
    ...refIntegrationItems(path, b.name, repo.branches.current),
    {
      // Scan every branch against *this* one, i.e. "what would break if I land
      // things on top of it".
      ...menuActionIcon('conflictRadar'),
      label: t('radar.open'),
      onClick: () => openModal({ kind: 'conflict-radar', repoPath: path, base: b.name })
    },
    {
      // Rebased or amended? The reflog still knows where this branch was.
      ...menuActionIcon('rangeDiff'),
      label: t('rangeDiff.open'),
      onClick: () => openModal({ kind: 'range-diff', repoPath: path, branch: b.name })
    },
    { separator: true },
    {
      ...menuActionIcon('renameBranch'),
      label: t('sidebar.renameBranch'),
      onClick: () =>
        openModal({
          kind: 'input',
          title: t('sidebar.renameBranchTitle'),
          label: t('sidebar.renameBranchLabel'),
          initial: b.name,
          submitLabel: t('sidebar.renameBranchSubmit'),
          onSubmit: (name) => void repoActions.renameBranch(path, b.name, name)
        })
    },
    ...(b.upstream
      ? [
          {
            ...menuActionIcon('renameWithRemote'),
            label: t('sidebar.renameWithRemote'),
            onClick: (): void =>
              openModal({
                kind: 'input',
                title: t('sidebar.renameWithRemoteTitle'),
                label: t('sidebar.renameBranchLabel'),
                initial: b.name,
                submitLabel: t('sidebar.renameBranchSubmit'),
                onSubmit: (name) => {
                  const remote = (b.upstream ?? '').split('/')[0]
                  if (name.trim() && remote) void repoActions.renameBranchRemote(path, b.name, name.trim(), remote)
                }
              })
          }
        ]
      : []),
    // Named, and wired to *this* branch — pushing the checked-out one from a
    // menu you opened on another branch is a trap, not a shortcut.
    { ...menuActionIcon('push'), label: interp(t('branch.pushNamed'), { branch: b.name }), onClick: () => void repoActions.push(path, false, false, b.name) },
    {
      ...menuActionIcon('pull'),
      label: interp(t('branch.pullNamed'), { branch: b.name }),
      disabled: !b.upstream,
      onClick: () =>
        void (b.isCurrent ? repoActions.pull(path, 'default') : repoActions.pullBranch(path, b.name))
    },
    {
      ...menuActionIcon('createPr'),
      label: t('sidebar.createPRFromBranch'),
      onClick: () => createPrFromBranch(b)
    },
    { separator: true },
    {
      ...menuActionIcon(isPinned(b.name) ? 'unpin' : 'pin'),
      label: isPinned(b.name) ? t('sidebar.unpinBranch') : t('sidebar.pinBranch'),
      onClick: () => togglePinBranch(b.name)
    },
    { ...menuActionIcon('copy'), label: t('sidebar.copyBranchName'), onClick: () => void navigator.clipboard.writeText(b.name) },
    {
      ...menuActionIcon('delete'),
      label: t('sidebar.deleteBranch'),
      danger: true,
      disabled: b.isCurrent,
      onClick: () =>
        openModal({
          kind: 'confirm',
          title: t('sidebar.deleteBranchTitle'),
          message: interp(t('sidebar.deleteBranchMsg'), { name: b.name }),
          danger: true,
          confirmLabel: t('sidebar.deleteBranchConfirm'),
          onConfirm: () => void repoActions.deleteBranch(path, b.name, b.sha)
        })
    }
  ]

  const remoteMenu = (b: RemoteBranchInfo): MenuItem[] => [
    {
      ...menuActionIcon('checkout'),
      label: t('sidebar.checkoutAsLocal'),
      onClick: () => void repoActions.checkoutRemote(path, b.fullName, b.name, b.remote)
    },
    ...refIntegrationItems(path, b.fullName, repo.branches.current),
    {
      // The tracking ref's reflog records every forced fetch, so this answers
      // "what did they change when they force-pushed?".
      ...menuActionIcon('rangeDiff'),
      label: t('rangeDiff.open'),
      onClick: () => openModal({ kind: 'range-diff', repoPath: path, branch: b.fullName })
    },
    { separator: true },
    { ...menuActionIcon('copy'), label: t('sidebar.copyBranchName'), onClick: () => void navigator.clipboard.writeText(b.fullName) },
    {
      ...menuActionIcon('delete'),
      label: t('sidebar.deleteRemoteBranch'),
      danger: true,
      onClick: () =>
        openModal({
          kind: 'confirm',
          title: t('sidebar.deleteRemoteBranchTitle'),
          message: interp(t('sidebar.deleteRemoteBranchMsg'), { branch: b.name, remote: b.remote }),
          danger: true,
          confirmLabel: t('sidebar.deleteRemoteBranchConfirm'),
          onConfirm: () => void repoActions.deleteRemoteBranch(path, b.remote, b.name)
        })
    }
  ]

  const renameStash = (s: StashInfo): void =>
    openModal({
      kind: 'input',
      title: t('sidebar.renameStash'),
      label: t('sidebar.newStashMessage'),
      initial: s.message,
      submitLabel: t('common.rename'),
      onSubmit: (message) => {
        const m = message.trim()
        if (m && m !== s.message) void repoActions.renameStash(path, s.index, m)
      }
    })

  const stashMenu = (s: StashInfo): MenuItem[] => [
    { ...menuActionIcon('stashPop'), label: t('sidebar.popStash'), onClick: () => void repoActions.stashPop(path, s.index) },
    { ...menuActionIcon('stashApply'), label: t('sidebar.applyStash'), onClick: () => void repoActions.stashApply(path, s.index) },
    { separator: true },
    { ...menuActionIcon('renameStash'), label: t('sidebar.renameStash'), onClick: () => renameStash(s) },
    { ...menuActionIcon('copy'), label: t('sidebar.copyStashMsg'), onClick: () => void navigator.clipboard.writeText(s.message) },
    { separator: true },
    {
      ...menuActionIcon('delete'),
      label: t('sidebar.dropStash'),
      danger: true,
      onClick: () =>
        openModal({
          kind: 'confirm',
          title: t('sidebar.dropStashTitle'),
          message: interp(t('sidebar.dropStashMsg'), { message: s.message }),
          danger: true,
          confirmLabel: t('sidebar.dropStashConfirm'),
          onConfirm: () => void repoActions.stashDrop(path, s.index)
        })
    }
  ]

  /** Ask git what removing `w` would destroy, then pick the dialog: a plain
   *  confirm (with undo) when it is clean, an explicit "discard" otherwise. */
  const confirmRemoveWorktree = async (w: WorktreeInfo): Promise<void> => {
    const status = await gitApi.getWorktreeStatus(path, w.path).catch(() => null)
    if (status && status.changes > 0) {
      openModal({
        kind: 'confirm',
        title: t('worktree.removeDirtyTitle'),
        message: interp(t('worktree.removeDirtyMsg'), { path: w.path, count: status.changes }),
        danger: true,
        confirmLabel: t('worktree.removeDirtyConfirm'),
        onConfirm: () => void repoActions.worktreeRemove(path, w, true)
      })
      return
    }
    openModal({
      kind: 'confirm',
      title: t('sidebar.removeWorktree'),
      // A detached HEAD has no branch to keep; its commits survive only in the
      // worktree's own reflog, which removal deletes.
      message: interp(t(w.branch ? 'worktree.removeCleanMsg' : 'worktree.removeDetachedMsg'), {
        path: w.path,
        name: worktreeDisplayName(w)
      }),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => void repoActions.worktreeRemove(path, w)
    })
  }

  const confirmPruneWorktrees = (): void => {
    const count = prunableWorktreeCount(repo.worktrees)
    openModal({
      kind: 'confirm',
      title: t('worktree.prune'),
      message: interp(t('worktree.pruneMsg'), { count }),
      confirmLabel: t('worktree.pruneConfirm'),
      onConfirm: () => void repoActions.worktreePrune(path, count)
    })
  }

  const worktreeMenu = (w: WorktreeInfo): MenuItem[] => {
    const name = worktreeDisplayName(w)
    // A missing folder can only be reconnected or forgotten; everything else
    // would fail against a path that is not there.
    if (w.prunable)
      return [
        {
          label: t('worktree.repair'),
          onClick: () =>
            openModal({
              kind: 'input',
              title: t('worktree.repair'),
              label: interp(t('worktree.repairLabel'), { name }),
              initial: w.path,
              submitLabel: t('worktree.repairSubmit'),
              onSubmit: (dir) => {
                if (dir.trim()) void repoActions.worktreeRepair(path, dir.trim())
              }
            })
        },
        { label: t('sidebar.copyPath'), onClick: () => void navigator.clipboard.writeText(w.path) },
        { separator: true },
        {
          label: t('worktree.prune'),
          disabled: w.locked,
          title: w.locked ? t('worktree.lockedHint') : undefined,
          onClick: confirmPruneWorktrees
        }
      ]
    const { settings } = useSettingsStore.getState()
    const openInTab = isRepoOpenInTabs([settings.tabs, ...(settings.workspaces ?? []).map((ws) => ws.tabs)], w.path)
    const moveBlocked = w.locked ? t('worktree.lockedHint') : openInTab ? t('worktree.moveOpenTab') : undefined
    return [
      { label: t('sidebar.openWorktree'), disabled: w.isCurrent, onClick: () => openWorktreeTab(w) },
      { label: t('sidebar.revealWorktree'), onClick: () => void shellApi.revealInFolder(w.path) },
      { label: t('sidebar.copyPath'), onClick: () => void navigator.clipboard.writeText(w.path) },
      { separator: true },
      // The main worktree is the repository itself: git cannot lock or move it.
      ...(w.isMain
        ? []
        : [
            w.locked
              ? { label: t('worktree.unlock'), onClick: () => void repoActions.worktreeUnlock(path, w) }
              : {
                  label: t('worktree.lock'),
                  onClick: () =>
                    openModal({
                      kind: 'input',
                      title: t('worktree.lock'),
                      label: t('worktree.lockReasonLabel'),
                      placeholder: t('worktree.lockReasonPlaceholder'),
                      submitLabel: t('worktree.lock'),
                      allowEmpty: true,
                      onSubmit: (reason) => void repoActions.worktreeLock(path, w.path, reason.trim() || undefined)
                    })
                },
            {
              label: t('worktree.move'),
              disabled: !!moveBlocked || w.isCurrent,
              title: moveBlocked,
              onClick: () =>
                openModal({
                  kind: 'input',
                  title: t('worktree.move'),
                  label: interp(t('worktree.moveLabel'), { name }),
                  initial: w.path,
                  submitLabel: t('worktree.moveSubmit'),
                  onSubmit: (dir) => {
                    const to = dir.trim()
                    if (to && to !== w.path) void repoActions.worktreeMove(path, w.path, to)
                  }
                })
            } satisfies MenuItem,
            { separator: true }
          ]),
      {
        label: t('sidebar.removeWorktree'),
        danger: true,
        disabled: w.isMain || w.isCurrent || w.locked,
        title: w.locked ? t('worktree.lockedHint') : undefined,
        onClick: () => void confirmRemoveWorktree(w)
      }
    ]
  }

  const addWorktree = (): void => {
    const { parent, repoName } = repoParentAndName(path)
    // Follow the repo's own convention: when worktrees already live under a
    // sibling "<repo>.worktrees" folder, keep suggesting inside it (branch
    // slashes become nested dirs, e.g. ui/redesign). Otherwise the
    // openInWorktree sibling "<repo>--<branch>" shape.
    const wtParent = `${parent}/${repoName}.worktrees`
    const nested = repo.worktrees.some((w) => w.path.replace(/\\/g, '/').startsWith(`${wtParent}/`))
    openModal({
      kind: 'add-worktree',
      path,
      rootPath: worktreeRootPath,
      repoName,
      current: repo.branches.current,
      locals: repo.branches.locals.map((b) => ({ name: b.name, isCurrent: b.isCurrent })),
      busyBranches: [
        repo.branches.current,
        ...repo.worktrees.map((w) => w.branch).filter((b): b is string => Boolean(b))
      ],
      worktreePaths: repo.worktrees.map((w) => w.path),
      suggestDir: nested
        ? (b) => `${wtParent}/${b}`
        : (b) => `${parent}/${repoName}--${b.replace(/[^\w.-]+/g, '-')}`
    })
  }

  const addRemote = (): void =>
    openModal({
      kind: 'addRemote',
      path,
      defaultName: repo.remotes.length === 0 ? 'origin' : '',
      existingNames: repo.remotes.map((r) => r.name),
      matchName: path.split(/[/\\]/).filter(Boolean).pop()
    })

  // Turn a git remote URL into a browsable web URL (best effort, https hosts only).
  const webUrl = (url?: string): string | undefined => {
    if (!url) return undefined
    const m = /^(?:git@|https?:\/\/(?:[^@/]+@)?)([^:/]+)[:/](.+?)(?:\.git)?\/?$/.exec(url.trim())
    return m ? `https://${m[1]}/${m[2]}` : url.startsWith('http') ? url : undefined
  }

  const remoteMgmtMenu = (remoteName: string, url?: string): MenuItem[] => {
    const web = webUrl(url)
    const info = repo.remotes.find((r) => r.name === remoteName)
    // An ambiguous URL is never rewritten automatically (shared/remoteUrlCredentials.ts).
    const savedPassword = info?.urlCredentials === 'password' && !info.urlCredentialsAmbiguous
    return [
      { label: t('sidebar.addRemote'), onClick: () => addRemote() },
      { label: interp(t('sidebar.fetchRemote'), { remote: remoteName }), onClick: () => void repoActions.fetchRemote(path, remoteName) },
      // The remote's own row is the obvious place to ask "send this branch
      // there" — the toolbar's push only ever means the upstream.
      {
        label: interp(t('sidebar.pushToRemote'), { remote: remoteName }),
        onClick: () => void repoActions.pushToRemotes(path, [remoteName])
      },
      {
        label: interp(t('sidebar.pushTagsToRemote'), { remote: remoteName }),
        onClick: () => void repoActions.pushAllTags(path, remoteName)
      },
      { label: t('remoteAuth.menu'), onClick: () => openModal({ kind: 'remoteAuth', path, remote: remoteName }) },
      ...(savedPassword
        ? [
            {
              label: t('urlCred.removeAction'),
              icon: <KeyRound size={13} />,
              onClick: (): void => repoActions.confirmRemoveRemoteUrlCredentials(path, remoteName)
            }
          ]
        : []),
      {
        label: interp(t('sidebar.editRemote'), { remote: remoteName }),
        onClick: () =>
          openModal({
            kind: 'editRemote',
            path,
            name: remoteName,
            url: url ?? ''
          })
      },
      { separator: true },
      ...(web ? [{ label: t('sidebar.openOnWeb'), onClick: (): void => void shellApi.openExternal(web) }] : []),
      ...(url ? [{ label: t('sidebar.copyRemoteUrl'), onClick: (): void => void navigator.clipboard.writeText(url) }] : []),
      { separator: true },
      {
        label: t('sidebar.removeRemote'),
        danger: true,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.removeRemote'),
            message: interp(t('sidebar.removeRemoteMsg'), { remote: remoteName }),
            danger: true,
            confirmLabel: t('sidebar.removeRemote'),
            onConfirm: () => void repoActions.removeRemote(path, remoteName)
          })
      }
    ]
  }


  const submoduleMenu = (sm: SubmoduleInfo): MenuItem[] => {
    const absPath = `${path.replace(/\/+$/, '')}/${sm.path}`
    const web = webUrl(sm.url)
    const initialized = sm.status !== 'uninitialized'
    return [
      { label: t('sidebar.updateSubmodule'), onClick: () => void repoActions.submoduleUpdate(path, sm.path) },
      { label: t('sidebar.syncSubmodule'), onClick: () => void repoActions.submoduleSync(path, sm.path) },
      { separator: true },
      {
        label: t('sidebar.openSubmodule'),
        disabled: !initialized,
        onClick: () => openRepoTab({ path: absPath, name: sm.path.split('/').pop() ?? sm.path })
      },
      { label: t('sidebar.editSubmodule'), onClick: () => editSubmodule(sm) },
      { label: t('sidebar.revealWorktree'), onClick: () => void shellApi.revealInFolder(absPath) },
      { separator: true },
      { label: t('sidebar.copyPath'), onClick: () => void navigator.clipboard.writeText(absPath) },
      ...(sm.url ? [{ label: t('sidebar.copySubmoduleUrl'), onClick: (): void => void navigator.clipboard.writeText(sm.url) }] : []),
      ...(web ? [{ label: t('sidebar.openOnWeb'), onClick: (): void => void shellApi.openExternal(web) }] : []),
      { separator: true },
      {
        label: t('sidebar.removeSubmodule'),
        danger: true,
        onClick: () =>
          openModal({
            kind: 'confirm',
            title: t('sidebar.removeSubmodule'),
            message: interp(t('sidebar.removeSubmoduleMsg'), { path: sm.path }),
            danger: true,
            confirmLabel: t('common.delete'),
            onConfirm: () => void repoActions.submoduleRemove(path, sm.path)
          })
      }
    ]
  }

  const editSubmodule = (sm: SubmoduleInfo): void =>
    openModal({
      kind: 'input',
      title: `${t('sidebar.editSubmodule')} · ${sm.path}`,
      label: t('sidebar.submoduleUrlLabel'),
      placeholder: t('sidebar.editSubmodulePlaceholder'),
      initial: sm.url,
      submitLabel: t('common.save'),
      onSubmit: (value) => {
        const url = value.trim()
        if (!url || url === sm.url) return
        void repoActions.submoduleSetUrl(path, sm.name, url)
      }
    })

  const addSubmodule = (): void =>
    openModal({
      kind: 'input',
      title: t('sidebar.addSubmodule'),
      label: t('sidebar.addSubmoduleLabel'),
      placeholder: t('sidebar.addSubmodulePlaceholder'),
      submitLabel: t('common.add'),
      onSubmit: (value) => {
        const parts = value.trim().split(/\s+/)
        const url = parts[0]
        const dir = parts[1]
        if (!url || !dir) return
        void repoActions.submoduleAdd(path, url, dir)
      }
    })


  // Hosting items (PRs, issues, milestones, releases) share a shape: open the
  // in-app detail view, open on the web, copy the link. Origin is the remote
  // every detail view is keyed to, matching the click handlers above.
  const hostOrigin = (): RemoteInfo | undefined => repo.remotes.find((r) => r.name === 'origin') ?? repo.remotes[0]

  // A fork's PRs on its parent live on `upstream`; every other PR on origin.
  const prMenu = (pr: PullRequest, remote?: RemoteInfo): MenuItem[] => {
    const origin = remote ?? hostOrigin()
    return [
      ...(repoSupportsPrReview(repo.remotes, gitlabInstances(), forgejoInstances(), githubEnterprise(), bitbucketServers()) && origin
        ? [
            {
              label: t('sidebar.openDetails'),
              onClick: (): void =>
                openPageTab({ type: 'pr', repoPath: path, remoteUrl: origin.url, number: pr.id, title: pr.title })
            } satisfies MenuItem,
            {
              label: t('sidebar.openPrInNewTab'),
              onClick: (): void =>
                openPageTab(
                  { type: 'pr', repoPath: path, remoteUrl: origin.url, number: pr.id, title: pr.title },
                  { ownTab: true }
                )
            } satisfies MenuItem
          ]
        : []),
      {
        label: t('prPreview.open'),
        onClick: () =>
          openModal({ kind: 'pr-preview', repoPath: path, number: pr.id, remote: origin?.name, branch: pr.sourceBranch })
      },
      ...(aiEnabled && pr.sourceBranch && pr.targetBranch
        ? [
            {
              label: t('sidebar.aiPrReview'),
              onClick: (): void =>
                openModal({
                  kind: 'ai-pr-review',
                  repoPath: path,
                  prTitle: pr.title,
                  sourceBranch: pr.sourceBranch,
                  targetBranch: pr.targetBranch
                })
            } satisfies MenuItem
          ]
        : []),
      { separator: true },
      { label: t('common.openInBrowser'), onClick: () => void shellApi.openExternal(pr.url) },
      { label: t('sidebar.copyLink'), onClick: () => void navigator.clipboard.writeText(pr.url) },
      { label: t('sidebar.copyTitle'), onClick: () => void navigator.clipboard.writeText(pr.title) },
      ...(pr.sourceBranch
        ? [{ label: t('sidebar.copyBranchName'), onClick: (): void => void navigator.clipboard.writeText(pr.sourceBranch) }]
        : [])
    ]
  }

  const issueMenu = (issue: IssueInfo): MenuItem[] => {
    const origin = hostOrigin()
    return [
      ...(origin
        ? [
            {
              label: t('sidebar.openDetails'),
              onClick: (): void => openPageTab({ type: 'issue', issue, repoPath: path, remoteUrl: origin.url })
            } satisfies MenuItem
          ]
        : []),
      { separator: true },
      { label: t('common.openInBrowser'), onClick: () => void shellApi.openExternal(issue.url) },
      { label: t('sidebar.copyLink'), onClick: () => void navigator.clipboard.writeText(issue.url) },
      { label: t('sidebar.copyTitle'), onClick: () => void navigator.clipboard.writeText(issue.title) }
    ]
  }

  const milestoneMenu = (m: MilestoneInfo): MenuItem[] => {
    const origin = hostOrigin()
    return [
      ...(origin
        ? [
            {
              label: t('sidebar.openDetails'),
              onClick: (): void => openPageTab({ type: 'milestone', milestone: m, repoPath: path, remoteUrl: origin.url })
            } satisfies MenuItem
          ]
        : []),
      { separator: true },
      { label: t('common.openInBrowser'), onClick: () => void shellApi.openExternal(m.url) },
      { label: t('sidebar.copyLink'), onClick: () => void navigator.clipboard.writeText(m.url) },
      { label: t('sidebar.copyTitle'), onClick: () => void navigator.clipboard.writeText(m.title) }
    ]
  }

  const releaseMenu = (rel: ReleaseInfo): MenuItem[] => [
    { label: t('sidebar.openDetails'), onClick: () => openPageTab({ type: 'release', release: rel, repoPath: path }) },
    { separator: true },
    { label: t('sidebar.openOnWeb'), onClick: () => void shellApi.openExternal(rel.url) },
    { label: t('sidebar.copyLink'), onClick: () => void navigator.clipboard.writeText(rel.url) },
    ...(rel.tag
      ? [{ label: t('sidebar.copyTagName'), onClick: (): void => void navigator.clipboard.writeText(rel.tag!) }]
      : [])
  ]

  const promptCreateRoot = (isDir: boolean): void =>
    openModal({
      kind: 'input',
      title: isDir ? t('sidebar.newFolderRoot') : t('sidebar.newFilesRoot'),
      label: t('sidebar.atRepoRoot'),
      placeholder: isDir ? 'components' : 'index.ts',
      submitLabel: t('common.create'),
      onSubmit: (name) => {
        const clean = name.trim().replace(/^\/+|\/+$/g, '')
        if (!clean) return
        void repoActions.fsCreate(path, clean, isDir)
      }
    })

  // Open Folder | Open with <App> (if configured) | Open With… — same three
  // options offered on repo tabs and the bottom status bar path.
  const repoOpenMenu = (): MenuItem[] =>
    folderOpenMenuItems(
      repo.path,
      defaultOpenApp,
      {
        openFolder: t('sidebar.openFolder'),
        openWithDefault: (name) => interp(t('sidebar.openWithApp'), { name }),
        openWith: t('sidebar.openFolderWith'),
        copyPath: t('sidebar.copyFolderPath')
      },
      editor
    )

  const sectionLabels: Record<string, string> = {
    local: t('sidebar.local'),
    remotes: t('sidebar.remotes'),
    prs: t('sidebar.pullRequests'),
    issues: t('sidebar.issues'),
    milestones: t('sidebar.milestones'),
    tags: t('sidebar.tags'),
    releases: t('sidebar.releases'),
    stashes: t('sidebar.stashes'),
    todos: t('sidebar.todos'),
    bookmarks: t('sidebar.bookmarks'),
    worktrees: t('sidebar.worktrees'),
    submodules: t('sidebar.submodules')
  }

  const toggleSection = (id: string): void =>
    updateRepoLayout(repo.path, (l) => {
      const hidden = l.sidebarHidden ?? baseSidebarHidden
      return {
        ...l,
        sidebarHidden: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]
      }
    })

  // Both gestures write the same per-repository `sidebarOrder`, reconciled
  // with the sections that exist first, so a section added after the order was
  // saved can be moved like any other.
  const reorder = (from: string, to: string): void => {
    if (from === to) return
    updateRepoLayout(repo.path, (l) => ({
      ...l,
      sidebarOrder: moveSectionBefore(mergeSectionOrder(l.sidebarOrder ?? baseSidebarOrder, order), from, to)
    }))
  }
  const moveBy = (id: string, delta: -1 | 1): void => {
    updateRepoLayout(repo.path, (l) => ({
      ...l,
      sidebarOrder: moveSectionBy(mergeSectionOrder(l.sidebarOrder ?? baseSidebarOrder, order), id, delta, shown)
    }))
    // The header is re-inserted at its new place and can lose focus on the
    // way; put it back so Alt+↑ can be pressed again.
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`.sidebar [data-section="${CSS.escape(id)}"] > .sb-header`)?.focus()
    )
  }
  /** Move up / Move down — the header menu's keyboard-and-mouse twin of dragging. */
  const moveItems = (id: string): MenuItem[] => [
    { label: t('sidebar.moveSectionUp'), disabled: !canMoveSection(shown, id, -1), onClick: () => moveBy(id, -1) },
    { label: t('sidebar.moveSectionDown'), disabled: !canMoveSection(shown, id, 1), onClick: () => moveBy(id, 1) }
  ]
  const openHeaderMenu = (e: React.MouseEvent, items: MenuItem[]): void => {
    e.preventDefault()
    // From the keyboard (Menu key, Shift+F10) there is no pointer: anchor the
    // menu to the header instead of the window's corner.
    let { clientX: x, clientY: y } = e
    if (x === 0 && y === 0) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      x = r.left
      y = r.bottom
    }
    openContextMenu(x, y, items)
  }

  const dragProps = (id: string): Partial<SectionProps> => ({
    sectionId: id,
    countLabel: countLabel(id),
    onMoveBy: (delta) => moveBy(id, delta),
    onHeaderContextMenu: (e) => openHeaderMenu(e, moveItems(id)),
    dragging: dragId === id,
    dragOver: overId === id && dragId !== null && dragId !== id,
    reorderHint: t('sidebar.reorderHint'),
    onReorderStart: () => setDragId(id),
    onReorderOver: (e) => {
      e.preventDefault()
      if (dragId && dragId !== id) setOverId(id)
    },
    onReorderDrop: () => {
      if (dragId) reorder(dragId, id)
      setDragId(null)
      setOverId(null)
    },
    onReorderEnd: () => {
      setDragId(null)
      setOverId(null)
    }
  })

  const localIds = locals.map((b) => b.name)
  const remoteIds = remotes.map((b) => b.fullName)
  const tagIds = tags.map((t) => t.name)
  const stashIds = stashes.map((s) => String(s.index))
  orderedRef.current = { local: localIds, remote: remoteIds, tag: tagIds, stash: stashIds }

  // One row in the local-branches list. `label` is the displayed text (the last
  // path segment when nested inside a folder, the full name when flat).
  const branchItem = (b: BranchInfo, label: string): React.JSX.Element => (
    <div
      key={b.name}
      data-kbkind="local"
      data-kbid={b.name}
      className={`sb-item ${b.isCurrent ? 'current' : ''} ${isSel('local', b.name) ? 'multi-sel' : ''} ${dropBranch === b.name ? 'branch-drop-over' : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={keyActivate}
      {...refDrag({ name: b.name, kind: 'local' })}
      {...refDrop({ name: b.name, kind: 'local' })}
      onClick={(e) => {
        if (!onSelectClick('local', b.name, localIds, e)) goToBranch(b.sha)
      }}
      onDoubleClick={() => !b.isCurrent && void repoActions.checkout(path, b.name)}
      onContextMenu={(e) => ctxMenu(e, 'local', b.name, () => localMenu(b), localBulkMenu)}
      title={`${b.name}${b.upstream ? ` → ${b.upstream}` : ''}`}
    >
      {b.isCurrent && <Check size={12} className="sb-current-mark" />}
      <KindIcon kind="branch" />
      <span className="sb-name">{label}</span>
      {b.ahead > 0 && <span className="badge ahead">↑{b.ahead}</span>}
      {b.behind > 0 && <span className="badge behind">↓{b.behind}</span>}
      {riskDot(b.name)}
      <Presence remoteNames={branchPresence.get(b.name) ?? []} />
      <span
        className={`sb-pin-action ${isPinned(b.name) ? 'pinned' : ''}`}
        title={isPinned(b.name) ? t('sidebar.unpinBranch') : t('sidebar.pinBranch')}
        onClick={(e) => {
          e.stopPropagation()
          togglePinBranch(b.name)
        }}
      >
        <Star size={11} fill={isPinned(b.name) ? 'currentColor' : 'none'} />
      </span>
      {/* Revealed on hover and keyboard focus; the same handlers as the menu. */}
      <span className="sb-quick">
        {!b.isCurrent && (
          <span
            className="icon-btn sb-quick-btn"
            role="button"
            tabIndex={0}
            aria-label={checkoutLabel(b)}
            title={checkoutLabel(b)}
            onKeyDown={keyActivate}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              checkoutBranch(b)
            }}
          >
            <LogIn size={11} />
          </span>
        )}
        <span
          className="icon-btn sb-quick-btn"
          role="button"
          tabIndex={0}
          aria-label={t('sidebar.createPRFromBranch')}
          title={t('sidebar.createPRFromBranch')}
          onKeyDown={keyActivate}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            createPrFromBranch(b)
          }}
        >
          <GitPullRequestCreate size={11} />
        </span>
      </span>
    </div>
  )

  // Recursively render a branch folder node. Single-child *folder* runs collapse
  // into one "a/b" header; a lone leaf under a prefix is still a folder, so
  // `release/1.2.3` does not look like a branch named with a slash.
  const renderBranchNode = (
    node: PrefixNode<BranchInfo>,
    prefix: string,
    depth: number,
    ancestor = ''
  ): React.JSX.Element => {
    const { node: cur, display } = collapseFolderRun(node, prefix)
    if (cur.children.size === 0 && cur.item) {
      return branchItem(cur.item, display)
    }
    // Full "/"-path from the section root: unlike `display` it cannot collide
    // across nesting levels, so it can key persisted state and name the folder.
    const fullPath = ancestor ? `${ancestor}/${display}` : display
    const leaves = leafCount(cur)
    return (
      <Section
        key={`grp:${fullPath}`}
        className="sb-folder"
        nested
        depth={depth}
        title={folderTitle(display)}
        icon={<KindIcon kind="folder" />}
        openIcon={<KindIcon kind="folder" open />}
        count={leaves}
        {...persistOpen(`grp:${fullPath}`, openUnlessHuge(leaves))}
        onHeaderContextMenu={(e) => {
          e.preventDefault()
          openContextMenu(e.clientX, e.clientY, localFolderMenu(fullPath, cur))
        }}
      >
        {() => (
          <>
            {cur.item && branchItem(cur.item, cur.seg)}
            {[...cur.children.values()].map((c) => renderBranchNode(c, '', depth + 1, fullPath))}
          </>
        )}
      </Section>
    )
  }

  // One row in a remote's branch list. `label` mirrors branchItem's contract.
  const remoteItem = (b: RemoteBranchInfo, label: string): React.JSX.Element => (
    <div
      key={b.fullName}
      data-kbkind="remote"
      data-kbid={b.fullName}
      className={`sb-item ${isSel('remote', b.fullName) ? 'multi-sel' : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={keyActivate}
      {...refDrag({ name: b.fullName, kind: 'remote' })}
      onClick={(e) => void onSelectClick('remote', b.fullName, remoteIds, e)}
      onDoubleClick={() => void repoActions.checkoutRemote(path, b.fullName, b.name, b.remote)}
      onContextMenu={(e) => ctxMenu(e, 'remote', b.fullName, () => remoteMenu(b), remoteBulkMenu)}
      title={b.fullName}
    >
      <KindIcon kind="remote" />
      <span className="sb-name">{label}</span>
      {repo.forcedUpdates[b.fullName] && (
        <span
          className="sb-forced"
          title={t('rangeDiff.forcedTitle')}
          onClick={(e) => {
            e.stopPropagation()
            openModal({
              kind: 'range-diff',
              repoPath: path,
              branch: b.fullName,
              initialOld: repo.forcedUpdates[b.fullName].oldSha
            })
          }}
        >
          <History size={11} />
        </span>
      )}
      {riskDot(b.fullName)}
    </div>
  )

  const renderRemoteNode = (
    node: PrefixNode<RemoteBranchInfo>,
    prefix: string,
    depth: number,
    remoteName: string,
    ancestor = ''
  ): React.JSX.Element => {
    const { node: cur, display } = collapseFolderRun(node, prefix)
    if (cur.children.size === 0 && cur.item) {
      return remoteItem(cur.item, display)
    }
    const fullPath = ancestor ? `${ancestor}/${display}` : display
    const leaves = leafCount(cur)
    return (
      <Section
        key={`rgrp:${remoteName}/${fullPath}`}
        className="sb-folder"
        nested
        depth={depth}
        title={folderTitle(display)}
        icon={<KindIcon kind="folder" />}
        openIcon={<KindIcon kind="folder" open />}
        count={leaves}
        {...persistOpen(`rgrp:${remoteName}/${fullPath}`, openUnlessHuge(leaves))}
        onHeaderContextMenu={(e) => {
          e.preventDefault()
          openContextMenu(e.clientX, e.clientY, remoteFolderMenu(`${remoteName}/${fullPath}`, cur))
        }}
      >
        {() => (
          <>
            {cur.item && remoteItem(cur.item, cur.seg)}
            {[...cur.children.values()].map((c) => renderRemoteNode(c, '', depth + 1, remoteName, fullPath))}
          </>
        )}
      </Section>
    )
  }

  // One tag row. `label` follows the same last-segment-when-nested contract.
  const tagItem = (tag: TagInfo, label: string): React.JSX.Element => {
    const isPushed = repo.remoteTagNames.includes(tag.name)
    const release = releaseByTag.get(tag.name)
    const tagLink = repo.remotes.length ? tagWebLink(tag.name) : null
    return (
      <div
        key={tag.name}
        data-kbkind="tag"
        data-kbid={tag.name}
        className={`sb-item ${isSel('tag', tag.name) ? 'multi-sel' : ''}`}
        role="button"
        tabIndex={0}
        onKeyDown={keyActivate}
        {...refDrag({ name: tag.name, kind: 'tag' })}
        onClick={(e) => {
          if (!onSelectClick('tag', tag.name, tagIds, e)) goToBranch(tag.sha)
        }}
        onContextMenu={(e) => ctxMenu(e, 'tag', tag.name, () => tagMenu(tag), tagBulkMenu)}
        title={`${tag.name}${release ? ` · ${t('sidebar.releaseSuffix')}` : ''}${repo.remotes.length ? (isPushed ? ` · ${t('ref.pushed')}` : ` · ${t('ref.localOnly')}`) : ''}`}
      >
        <KindIcon kind="tag" />
        <span className="sb-name">{label}</span>
        {release && (
          <span
            className="sb-tag-action"
            title={interp(t('sidebar.goToRelease'), { name: release.name || release.tag || tag.name })}
            onClick={(e) => {
              e.stopPropagation()
              openPageTab({ type: 'release', release, repoPath: path })
            }}
          >
            <Rocket size={10} className="sb-release-badge icon-base" />
            <ArrowUpRight size={11} className="icon-hover" />
          </span>
        )}
        {repo.remotes.length > 0 &&
          (tagLink && isPushed ? (
            <span
              className="sb-tag-action sb-tag-cloud pushed"
              title={interp(t('sidebar.openTagOnRemote'), { name: tag.name })}
              onClick={(e) => {
                e.stopPropagation()
                void shellApi.openExternal(tagLink)
              }}
            >
              <Cloud size={10} className="icon-base" />
              <ArrowUpRight size={11} className="icon-hover" />
            </span>
          ) : (
            <Cloud size={10} className={`sb-tag-cloud ${isPushed ? 'pushed' : 'unpushed'}`} />
          ))}
      </div>
    )
  }

  const renderTagNode = (
    node: PrefixNode<TagInfo>,
    prefix: string,
    depth: number,
    ancestor = ''
  ): React.JSX.Element => {
    const { node: cur, display } = collapseFolderRun(node, prefix)
    if (cur.children.size === 0 && cur.item) {
      return tagItem(cur.item, display)
    }
    const fullPath = ancestor ? `${ancestor}/${display}` : display
    const leaves = leafCount(cur)
    return (
      <Section
        key={`tgrp:${fullPath}`}
        className="sb-folder"
        nested
        depth={depth}
        title={folderTitle(display)}
        icon={<KindIcon kind="folder" />}
        openIcon={<KindIcon kind="folder" open />}
        count={leaves}
        {...persistOpen(`tgrp:${fullPath}`, openUnlessHuge(leaves))}
      >
        {() => (
          <>
            {cur.item && tagItem(cur.item, cur.seg)}
            {[...cur.children.values()].map((c) => renderTagNode(c, '', depth + 1, fullPath))}
          </>
        )}
      </Section>
    )
  }

  /** What a non-ready level of a stack is called. */
  const PR_ROW_STATE_KEY: Record<Exclude<StackRowState, 'ready'>, TranslationKey> = {
    merged: 'pr.merged',
    closed: 'pr.closed',
    blocked: 'pr.blockedDownstack'
  }

  /** One pull request row — shared by the flat list and by a stack's body. */
  const prRow = (pr: PullRequest, rowState?: StackRowState, remote?: RemoteInfo): React.JSX.Element => (
        <div
          key={remote ? `${remote.name}-${pr.id}` : pr.id}
          className="sb-item pr"
          role="button"
          tabIndex={0}
          onKeyDown={keyActivate}
          onClick={() => {
            // Rich PR detail exists for GitHub and GitLab; other hosts open in browser.
            if (!repoSupportsPrReview(repo.remotes, gitlabInstances(), forgejoInstances(), githubEnterprise(), bitbucketServers())) {
              void window.api.openExternal(pr.url)
              return
            }
            const origin = remote ?? repo.remotes.find((r) => r.name === 'origin') ?? repo.remotes[0]
            if (origin) openPageTab({ type: 'pr', repoPath: path, remoteUrl: origin.url, number: pr.id, title: pr.title })
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            openContextMenu(e.clientX, e.clientY, prMenu(pr, remote))
          }}
          title={pr.title}
        >
          <GitPullRequest
            size={12}
            className={
              rowState === 'merged' || rowState === 'closed' ? `pr-${rowState}` : pr.isDraft ? 'pr-draft' : 'pr-open'
            }
          />
          <span className="sb-name">
            #{pr.id} {pr.title}
          </span>
          {/* The checks on the head, read with the list. Hover for the counts;
              the row is too narrow to spell them out. */}
          {pr.ci && (
            <span className="sb-pr-ci" title={ciTitle(pr.ci, pr.ciCounts, t)}>
              {ciIcon(pr.ci, 11)}
            </span>
          )}
          {/* A word like "Blocked downstack" does not fit a sidebar row without
              evicting the title, so the state is a glyph with the words on
              hover — closed and merged are already legible from the icon. */}
          {rowState === 'blocked' && (
            <span className="sb-pr-flag blocked" title={t('pr.blockedDownstack')}>
              <Ban size={11} />
            </span>
          )}
          {/* You are a pending reviewer here — the one thing in the list that is yours to do. */}
          {pr.awaitingYou && (
            <span className="sb-pr-flag awaiting" title={t('pr.awaitingYourReview')} aria-label={t('pr.awaitingYourReview')}>
              <Eye size={11} />
            </span>
          )}
          {/* Unlike the detail view, previewing works on every host — the PR
              head is a plain ref, so there is no provider check here. */}
          <span
            className="icon-btn sb-pr-preview"
            role="button"
            tabIndex={0}
            aria-label={t('prPreview.open')}
            onKeyDown={keyActivate}
            title={t('prPreview.open')}
            onClick={(e) => {
              e.stopPropagation()
              const origin = remote ?? repo.remotes.find((r) => r.name === 'origin') ?? repo.remotes[0]
              openModal({
                kind: 'pr-preview',
                repoPath: path,
                number: pr.id,
                remote: origin?.name,
                branch: pr.sourceBranch
              })
            }}
          >
            <GitPullRequestArrow size={11} />
          </span>
          {aiEnabled && pr.sourceBranch && pr.targetBranch && (
            <span
              className="icon-btn sb-ai-review"
              role="button"
              tabIndex={0}
              aria-label={t('sidebar.aiPrReview')}
              onKeyDown={keyActivate}
              title={t('sidebar.aiPrReview')}
              onClick={(e) => {
                e.stopPropagation()
                openModal({
                  kind: 'ai-pr-review',
                  repoPath: path,
                  prTitle: pr.title,
                  sourceBranch: pr.sourceBranch!,
                  targetBranch: pr.targetBranch!
                })
              }}
            >
              <Sparkles size={11} />
            </span>
          )}
          <span
            className="icon-btn sb-pr-open"
            role="button"
            tabIndex={0}
            aria-label={t('common.openInBrowser')}
            onKeyDown={keyActivate}
            title={t('common.openInBrowser')}
            onClick={(e) => {
              e.stopPropagation()
              void window.api.openExternal(pr.url)
            }}
          >
            <ExternalLink size={11} />
          </span>
        </div>
  )

  // ─── Bookmarks ───
  // Remembered places in the code. The stored line is a starting guess: the
  // snippet is what actually finds it again once the file has moved on.
  const bookmarksByRepo = useSettingsStore((s) => s.settings.repoBookmarks)
  const bookmarks = useMemo(
    () => sortBookmarks(bookmarksByRepo?.[canonicalRepoPath(repo.path)] ?? []),
    [bookmarksByRepo, repo.path]
  )
  const patchBookmark = useSettingsStore((s) => s.patchBookmark)
  const deleteBookmark = useSettingsStore((s) => s.deleteBookmark)

  const openBookmark = async (bookmark: RepoBookmark): Promise<void> => {
    const text = await gitApi.fileContent(repo.path, bookmark.file).catch(() => null)
    // No file, no relocation — open where it was last seen and say so.
    if (text == null) {
      toast('error', interp(t('bookmarks.gone'), { file: bookmark.file }))
      return
    }
    const found = locateBookmark(bookmark, text.split('\n'))
    if (found.state === 'moved') {
      // Heal the entry, so the next open starts from where it actually is.
      patchBookmark(repo.path, bookmark.id, { line: found.line })
      toast('info', interp(t('bookmarks.moved'), { line: String(found.line) }))
    } else if (found.state === 'lost') {
      toast('info', t('bookmarks.lost'))
    }
    setFileView({ repoPath: repo.path, file: bookmark.file, source: { type: 'tree' }, mode: 'file', line: found.line })
  }

  const bookmarkMenu = (bookmark: RepoBookmark): MenuItem[] => [
    { label: t('bookmarks.open'), icon: <BookmarkIcon size={13} />, onClick: () => void openBookmark(bookmark) },
    {
      label: t('bookmarks.editNote'),
      onClick: () =>
        openModal({
          kind: 'input',
          title: t('bookmarks.editNote'),
          label: t('bookmarks.note'),
          initial: bookmark.note ?? '',
          allowEmpty: true,
          onSubmit: (v) => patchBookmark(repo.path, bookmark.id, { note: v.trim() || undefined })
        })
    },
    { separator: true },
    { label: t('bookmarks.remove'), danger: true, onClick: () => deleteBookmark(repo.path, bookmark.id) }
  ]

  // ─── Todos ───
  // The done pile is hidden here, not deleted — the counts below still read
  // from the full list so the badge does not lie about what exists.
  // Subtasks stay inside the modal: the sidebar is a glance, and a nested tree
  // there would cost more height than the section is worth.
  // Memoised: the filter rebuilds its search index whenever this array changes identity.
  const sortedTodos = useMemo(
    () =>
      hideDoneTodos
        ? sortTodos(topLevelTodos(todos), manualTodoOrder).filter((td) => !td.done)
        : sortTodos(topLevelTodos(todos), manualTodoOrder),
    [todos, manualTodoOrder, hideDoneTodos]
  )
  const todoCounts = todoSummary(todos)
  const PRIORITY_LABEL: Record<RepoTodo['priority'], TranslationKey> = {
    high: 'todos.priorityHigh',
    normal: 'todos.priorityNormal',
    low: 'todos.priorityLow'
  }

  const todoMenu = (td: RepoTodo): MenuItem[] => {
    const settings = useSettingsStore.getState()
    return [
      { label: t('todos.openDetail'), onClick: () => openModal({ kind: 'todos', repoPath: path, focusId: td.id }) },
      { label: td.done ? t('todos.markOpen') : t('todos.markDone'), onClick: () => settings.toggleTodo(path, td.id) },
      { separator: true },
      {
        label: t('todos.status'),
        submenu: TODO_STATUSES.map((st) => ({
          label: `${todoStatus(td) === st ? '✓ ' : '   '}${t(TODO_STATUS_LABEL[st])}`,
          onClick: () => settings.setTodoStatus(path, td.id, st)
        }))
      },
      {
        label: t('todos.priority'),
        submenu: (['high', 'normal', 'low'] as const).map((p) => ({
          label: `${td.priority === p ? '✓ ' : '   '}${t(PRIORITY_LABEL[p])}`,
          onClick: () => settings.patchTodo(path, td.id, { priority: p })
        }))
      },
      ...(td.done
        ? []
        : [
            { separator: true },
            { label: t('todos.moveUp'), onClick: () => settings.moveTodo(path, td.id, -1) },
            { label: t('todos.moveDown'), onClick: () => settings.moveTodo(path, td.id, 1) }
          ]),
      { separator: true },
      { label: t('todos.delete'), danger: true, onClick: () => settings.deleteTodo(path, td.id) }
    ]
  }

  const todoItem = (td: RepoTodo): React.JSX.Element => (
    <div
      key={td.id}
      className={`sb-item sb-todo ${td.done ? 'done' : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={keyActivate}
      onClick={() => openModal({ kind: 'todos', repoPath: path, focusId: td.id })}
      onContextMenu={(e) => {
        e.preventDefault()
        openContextMenu(e.clientX, e.clientY, todoMenu(td))
      }}
      title={td.notes ? `${td.title}\n\n${td.notes}` : td.title}
    >
      <input
        type="checkbox"
        className="sb-todo-box"
        checked={td.done}
        aria-label={td.done ? t('todos.markOpen') : t('todos.markDone')}
        title={td.done ? t('todos.markOpen') : t('todos.markDone')}
        onClick={(e) => e.stopPropagation()}
        onChange={() => useSettingsStore.getState().toggleTodo(path, td.id)}
      />
      <TodoStatusIcon status={todoStatus(td)} size={12} />
      <span className="sb-name">{td.title}</span>
      {subtaskProgress(todos, td.id).total > 0 && (
        <span className="sb-todo-sub" title={t('todos.subtasks')}>
          {interp(t('todos.subtaskCount'), subtaskProgress(todos, td.id))}
        </span>
      )}
      {!td.done && td.priority !== 'normal' && <TodoPriorityIcon priority={td.priority} size={12} />}
    </div>
  )

  const filteredTodos = useSidebarFiltered(sortedTodos, TODO_FIELDS, f)
  const filteredBookmarks = useSidebarFiltered(bookmarks, BOOKMARK_FIELDS, f)

  // What each header counts. Remotes counts remotes when idle (how many places
  // you push to) and remote branches while filtering (what the filter found).
  const tallies: Record<string, SectionTally> = {
    local: { matched: locals.length, total: repo.branches.locals.length },
    remotes: filtering
      ? { matched: remotes.length, total: repo.branches.remotes.length }
      : { matched: repo.remotes.length, total: repo.remotes.length },
    prs: { matched: prs.length + upstreamPrs.length, total: repo.prs.length + repo.upstreamPrs.length },
    issues: { matched: issues.length, total: repo.issues.length },
    milestones: { matched: milestones.length, total: openMilestones.length },
    tags: { matched: tags.length, total: repo.branches.tags.length },
    releases: { matched: releases.length, total: repo.releases.length },
    todos: filtering
      ? { matched: filteredTodos.length, total: sortedTodos.length }
      : { matched: todoCounts.open, total: todoCounts.open },
    bookmarks: { matched: filteredBookmarks.length, total: bookmarks.length },
    stashes: { matched: stashes.length, total: repo.stashes.length },
    worktrees: { matched: worktrees.length, total: repo.worktrees.length },
    submodules: { matched: submodules.length, total: repo.submodules.length }
  }
  function countLabel(id: string): string | undefined {
    const tally = tallies[id]
    if (!tally) return undefined
    const c = sectionCount(tally, filtering)
    return c.kind === 'plain' ? String(c.n) : interp(t('sidebar.countOf'), { n: c.n, total: c.total })
  }

  const sections: Record<string, React.JSX.Element> = {
    local: (
      <Section
        title={t('sidebar.local')}
        icon={<GitBranch size={13} />}
        tone="ref"
        count={locals.length}
        {...dragProps('local')}
        {...persistOpen('local', openUnlessHuge(locals.length))}
        onHeaderContextMenu={(e) =>
          openHeaderMenu(e, [
            {
              label: t('push.branches'),
              disabled: repo.remotes.length === 0,
              onClick: () => openModal({ kind: 'push-branches', repoPath: path })
            },
            { separator: true },
            ...moveItems('local')
          ])
        }
        actions={
          <span
            className="icon-btn"
            role="button"
            tabIndex={0}
            aria-label={t('sidebar.createBranch')}
            onKeyDown={keyActivate}
            title={t('sidebar.createBranch')}
            onClick={(e) => {
              e.stopPropagation()
              openModal({ kind: 'create-branch', path, currentBranch: repo.branches.current })
            }}
          >
            <Plus size={11} />
          </span>
        }
      >
        {() => (
          <>
            {pinnedLocals.length > 0 && (
              <Section nested depth={1} title={t('sidebar.pinned')} icon={<Star size={13} />} tone="shelf" count={pinnedLocals.length} {...persistOpen('pinned')}>
                {() => pinnedLocals.map((b) => branchItem(b, b.name))}
              </Section>
            )}
            {groupBranches
              ? [...branchTree.children.values()].map((c) => renderBranchNode(c, '', 1))
              : locals.map((b) => branchItem(b, b.name))}
          </>
        )}
      </Section>
    ),
    remotes: (
      <Section
        title={t('sidebar.remotes')}
        icon={<Cloud size={13} />}
        tone="incoming"
        count={tallies.remotes.matched}
        {...dragProps('remotes')}
        {...persistOpen('remotes', false, openUnlessHuge(remotes.length))}
        actions={
          <span
            className="icon-btn"
            role="button"
            tabIndex={0}
            aria-label={t('sidebar.addRemote')}
            onKeyDown={keyActivate}
            title={t('sidebar.addRemote')}
            onClick={(e) => {
              e.stopPropagation()
              addRemote()
            }}
          >
            +
          </span>
        }
      >
        {() => (
          <>
            {repo.remotes.length === 0 && <div className="sb-empty">{t('sidebar.noRemotes')}</div>}
            {repo.remotes.map((remote) => {
          const branches = remoteGroups.get(remote.name) ?? []
          // A remote the filter found nothing in is noise in a result list.
          if (filtering && branches.length === 0) return null
          return (
            <Section
              key={remote.name}
              nested
              depth={1}
              title={remote.name}
              icon={<RemoteIcon url={remote.url} />}
              count={branches.length}
              {...persistOpen(
                `remote:${remote.name}`,
                openUnlessHuge(branches.length, remote.name === 'origin'),
                openUnlessHuge(branches.length)
              )}
              onHeaderContextMenu={(e) => {
                e.preventDefault()
                openContextMenu(e.clientX, e.clientY, remoteMgmtMenu(remote.name, remote.url))
              }}
              actions={remote.urlCredentials === 'password' || webUrl(remote.url) ? (
                <>
                  {remote.urlCredentials === 'password' && (
                    // Quiet but visible: a password in the URL beats the profile's token.
                    <span
                      className="icon-btn remote-url-cred"
                      role="button"
                      tabIndex={0}
                      aria-label={interp(t(remote.urlCredentialsAmbiguous ? 'urlCred.chipAmbiguous' : 'urlCred.chipTitle'), { remote: remote.name })}
                      onKeyDown={keyActivate}
                      title={interp(t(remote.urlCredentialsAmbiguous ? 'urlCred.chipAmbiguous' : 'urlCred.chipTitle'), { remote: remote.name })}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (remote.urlCredentialsAmbiguous) {
                          openModal({ kind: 'editRemote', path, name: remote.name, url: remote.url })
                        } else repoActions.confirmRemoveRemoteUrlCredentials(path, remote.name)
                      }}
                    >
                      <KeyRound size={12} />
                    </span>
                  )}
                  {webUrl(remote.url) && (
                    <span
                      className="icon-btn"
                      role="button"
                      tabIndex={0}
                      aria-label={interp(t('sidebar.openRemoteOnWeb'), { name: remote.name })}
                      onKeyDown={keyActivate}
                      title={interp(t('sidebar.openRemoteOnWeb'), { name: remote.name })}
                      onClick={(e) => {
                        e.stopPropagation()
                        void shellApi.openExternal(webUrl(remote.url)!)
                      }}
                    >
                      <ExternalLink size={12} />
                    </span>
                  )}
                </>
              ) : undefined}
            >
              {() => (
                <>
                  {branches.length === 0 && <div className="sb-empty">{t('sidebar.noBranches')}</div>}
                  {groupBranches
                    ? [...(remoteTrees.get(remote.name)?.children.values() ?? [])].map((c) =>
                        renderRemoteNode(c, '', 2, remote.name)
                      )
                    : branches.map((b) => remoteItem(b, b.name))}
                </>
              )}
            </Section>
          )
            })}
          </>
        )}
      </Section>
    ),
    prs: (
      <Section
        title={t('sidebar.pullRequests')}
        icon={<GitPullRequest size={13} />}
        tone="ref"
        count={tallies.prs.matched}
        {...dragProps('prs')}
        {...persistOpen('prs', false, true)}
        actions={
          <>
            {/* The whole list, filterable, as a page — the sidebar's rows say too little to triage nineteen. */}
            <span
              className="icon-btn"
              role="button"
              tabIndex={0}
              aria-label={t('prList.seeAll')}
              onKeyDown={keyActivate}
              title={t('prList.seeAll')}
              onClick={(e) => {
                e.stopPropagation()
                openPageTab({ type: 'pull-requests', repoPath: path })
              }}
            >
              <List size={12} />
            </span>
            <span
              className="icon-btn"
              role="button"
              tabIndex={0}
              aria-label={t('sidebar.createPRFromBranch')}
              onKeyDown={keyActivate}
              title={t('sidebar.createPRFromBranch')}
              onClick={(e) => {
                e.stopPropagation()
                openModal({ kind: 'create-pr', repoPath: path })
              }}
            >
              <Plus size={12} />
            </span>
            <span
              className="icon-btn"
              role="button"
              tabIndex={0}
              aria-label={t('sidebar.fetchPRs')}
              onKeyDown={keyActivate}
              title={t('sidebar.fetchPRs')}
              onClick={(e) => {
                e.stopPropagation()
                void refreshPRs(path)
              }}
            >
              <RefreshCw size={12} />
            </span>
          </>
        }
      >
        {repo.prs.length === 0 && repo.upstreamPrs.length === 0 && (
          <div className="sb-empty">
            {!repo.prProvider && prServerUnmatched ? t(UNMATCHED_HINT[prServerUnmatched]) : t('sidebar.noPRs')}
          </div>
        )}
        {groupPrStacks(prs).map((group) =>
          group.kind === 'single' ? (
            prRow(group.pr)
          ) : (
            // A chain is one piece of work: it collapses to a single row rather
            // than spending four lines of the sidebar saying so four times.
            <div key={`stack-${group.prs[0].id}`} className="sb-pr-stack">
              <div
                className="sb-item pr-stack-head"
                role="button"
                tabIndex={0}
                onKeyDown={keyActivate}
                onClick={() => setOpenPrStacks((o) => ({ ...o, [group.prs[0].id]: !o[group.prs[0].id] }))}
                title={group.prs.map((p) => `#${p.id} ${p.title}`).join('\n')}
              >
                {openPrStacks[group.prs[0].id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Layers size={12} className="pr-open" />
                <span className="sb-name">
                  {group.number
                    ? interp(t('sidebar.stackNumbered'), { n: group.number })
                    : interp(t('sidebar.stackOf'), { n: group.prs.length })}
                </span>
                <span className="sb-pr-stack-base">{group.base}</span>
                <span className="sb-count">{group.prs.length}</span>
              </div>
              {openPrStacks[group.prs[0].id] && (
                // A continuous rail, the way GitHub draws it: the line is the
                // connector, so the rows stay one line each and no arrow has to
                // be squeezed between them.
                <div className="sb-pr-stack-body">
                  {(() => {
                    const states = stackRowStates(group.prs)
                    return group.prs.map((pr) => prRow(pr, states.get(pr.id)))
                  })()}
                  <div className="sb-pr-stack-foot" title={interp(t('stack.mergesInto'), { target: group.base })}>
                    <span className="sb-pr-stack-dot" />
                    <span className="sb-pr-stack-chip">{group.base}</span>
                  </div>
                </div>
              )}
            </div>
          )
        )}
        {(() => {
          const fork = forkUpstream(repo.remotes, githubEnterprise())
          if (!fork || upstreamPrs.length === 0) return null
          return (
            <>
              <div className="sb-pr-upstream-head" title={interp(t('sidebar.upstreamPRsTitle'), { repo: fork.parent })}>
                {interp(t('sidebar.upstreamPRs'), { repo: fork.parent })}
              </div>
              {upstreamPrs.map((pr) => prRow(pr, undefined, fork.upstream))}
            </>
          )
        })()}
      </Section>
    ),
    issues: (
      <Section
        title={t('sidebar.issues')}
        icon={<CircleDot size={13} />}
        tone="outgoing"
        count={issues.length}
        {...dragProps('issues')}
        {...persistOpen('issues', false, true)}
        actions={
          <>
            {(() => {
              const origin = repo.remotes.find((r) => r.name === 'origin') ?? repo.remotes[0]
              return origin ? (
                <span
                  className="icon-btn"
                  role="button"
                  tabIndex={0}
                  aria-label={t('sidebar.newIssue')}
                  onKeyDown={keyActivate}
                  title={t('sidebar.newIssue')}
                  onClick={(e) => {
                    e.stopPropagation()
                    openModal({ kind: 'create-issue', repoPath: path, remoteUrl: origin.url })
                  }}
                >
                  <Plus size={13} />
                </span>
              ) : null
            })()}
            <span
              className="icon-btn"
              role="button"
              tabIndex={0}
              aria-label={t('sidebar.issues')}
              onKeyDown={keyActivate}
              title={t('sidebar.issues')}
              onClick={(e) => {
                e.stopPropagation()
                void useRepoStore.getState().refreshIssues(path)
              }}
            >
              <RefreshCw size={12} />
            </span>
          </>
        }
      >
        {repo.issues.length === 0 && <div className="sb-empty">{t('sidebar.noIssues')}</div>}
        {issues.map((issue) => (
          <div
            key={issue.number}
            className="sb-item pr"
            role="button"
            tabIndex={0}
            onKeyDown={keyActivate}
            onClick={() => {
              const origin = repo.remotes.find((r) => r.name === 'origin') ?? repo.remotes[0]
              if (origin)
                useSettingsStore.getState().openPageTab({ type: 'issue', issue, repoPath: path, remoteUrl: origin.url })
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              openContextMenu(e.clientX, e.clientY, issueMenu(issue))
            }}
            title={issue.title}
          >
            <CircleDot size={12} className="pr-open" />
            <span className="sb-name">
              #{issue.number} {issue.title}
            </span>
            <span
              className="icon-btn sb-pr-open"
              role="button"
              tabIndex={0}
              aria-label={t('common.openInBrowser')}
              onKeyDown={keyActivate}
              title={t('common.openInBrowser')}
              onClick={(e) => {
                e.stopPropagation()
                void window.api.openExternal(issue.url)
              }}
            >
              <ExternalLink size={11} />
            </span>
          </div>
        ))}
      </Section>
    ),
    milestones: (
      <Section
        title={t('sidebar.milestones')}
        icon={<Milestone size={13} />}
        tone="ref"
        count={milestones.length}
        {...dragProps('milestones')}
        {...persistOpen('milestones', false, true)}
        actions={
          <span
            className="icon-btn"
            role="button"
            tabIndex={0}
            aria-label={t('sidebar.milestones')}
            onKeyDown={keyActivate}
            title={t('sidebar.milestones')}
            onClick={(e) => {
              e.stopPropagation()
              void useRepoStore.getState().refreshMilestones(path)
            }}
          >
            <RefreshCw size={12} />
          </span>
        }
      >
        {milestones.length === 0 && <div className="sb-empty">{t('sidebar.noMilestones')}</div>}
        {milestones.map((m) => {
          const total = m.openIssues + m.closedIssues
          const pct = total > 0 ? Math.round((m.closedIssues / total) * 100) : 0
          return (
            <div
              key={m.number}
              className="sb-item milestone"
              role="button"
              tabIndex={0}
              onKeyDown={keyActivate}
              onClick={() => {
                const origin = repo.remotes.find((r) => r.name === 'origin') ?? repo.remotes[0]
                if (origin)
                  useSettingsStore
                    .getState()
                    .openPageTab({ type: 'milestone', milestone: m, repoPath: path, remoteUrl: origin.url })
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                openContextMenu(e.clientX, e.clientY, milestoneMenu(m))
              }}
              title={`${m.title}${m.dueOn ? ` · due ${new Date(m.dueOn).toLocaleDateString()}` : ''}`}
            >
              <Milestone size={12} className={m.state === 'closed' ? 'pr-draft' : 'pr-open'} />
              <span className="sb-name">{m.title}</span>
              <span className="sb-milestone-pct">{pct}%</span>
              <span
                className="icon-btn sb-pr-open"
                role="button"
                tabIndex={0}
                aria-label={t('common.openInBrowser')}
                onKeyDown={keyActivate}
                title={t('common.openInBrowser')}
                onClick={(e) => {
                  e.stopPropagation()
                  void window.api.openExternal(m.url)
                }}
              >
                <ExternalLink size={11} />
              </span>
            </div>
          )
        })}
      </Section>
    ),
    tags: (
      <Section
        title={t('sidebar.tags')}
        icon={<Tag size={13} />}
        tone="ref"
        count={tags.length}
        {...dragProps('tags')}
        {...persistOpen('tags', false, openUnlessHuge(tags.length))}
        actions={
          <span
            className="icon-btn"
            role="button"
            tabIndex={0}
            aria-label={t('sidebar.createTag')}
            onKeyDown={keyActivate}
            title={t('sidebar.createTag')}
            onClick={(e) => {
              e.stopPropagation()
              createTagAtHead()
            }}
          >
            <Plus size={12} />
          </span>
        }
      >
        {() => (
          <>
            {tags.length === 0 && <div className="sb-empty">{t('sidebar.noTags')}</div>}
            {groupBranches
              ? [...tagTree.children.values()].map((c) => renderTagNode(c, '', 1))
              : tags.map((tag) => tagItem(tag, tag.name))}
          </>
        )}
      </Section>
    ),
    releases: (() => {
      const origin = repo.remotes.find((r) => r.name === 'origin') ?? repo.remotes[0]
      const base = webUrl(origin?.url)
      const releasesUrl = base ? `${base}/releases` : undefined
      return (
        <Section
          title={t('sidebar.releases')}
          icon={<Rocket size={13} />}
          tone="outgoing"
          count={releases.length}
          {...dragProps('releases')}
          {...persistOpen('releases', false, true)}
          actions={
            <>
              {releasesUrl && (
                <span
                  className="icon-btn"
                  role="button"
                  tabIndex={0}
                  aria-label={t('sidebar.openReleases')}
                  onKeyDown={keyActivate}
                  title={t('sidebar.openReleases')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void shellApi.openExternal(releasesUrl)
                  }}
                >
                  <ExternalLink size={12} />
                </span>
              )}
              <span
                className="icon-btn"
                role="button"
                tabIndex={0}
                aria-label={t('sidebar.fetchReleases')}
                onKeyDown={keyActivate}
                title={t('sidebar.fetchReleases')}
                onClick={(e) => {
                  e.stopPropagation()
                  void refreshReleases(path)
                }}
              >
                <RefreshCw size={12} />
              </span>
            </>
          }
        >
          {releases.length === 0 && <div className="sb-empty">{t('sidebar.noReleases')}</div>}
          {releases.map((rel: ReleaseInfo) => {
            const label = rel.name || rel.tag || `#${rel.id}`
            return (
              <div
                key={rel.id}
                className="sb-item release"
                role="button"
                tabIndex={0}
                onKeyDown={keyActivate}
                onClick={() => openPageTab({ type: 'release', release: rel, repoPath: path })}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openContextMenu(e.clientX, e.clientY, releaseMenu(rel))
                }}
                title={label}
              >
                <Rocket size={11} className="sb-release-icon" />
                <span className="sb-name">{label}</span>
                {rel.draft && <span className="badge release-draft">{t('sidebar.draftBadge')}</span>}
                {rel.prerelease && <span className="badge release-pre">{t('sidebar.preBadge')}</span>}
                <span
                  className="icon-btn"
                  role="button"
                  tabIndex={0}
                  aria-label={t('sidebar.openOnWeb')}
                  onKeyDown={keyActivate}
                  title={t('sidebar.openOnWeb')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void shellApi.openExternal(rel.url)
                  }}
                >
                  <ExternalLink size={11} />
                </span>
              </div>
            )
          })}
        </Section>
      )
    })(),
    todos: (
      <Section
        title={t('sidebar.todos')}
        icon={<CheckSquare size={13} />}
        tone="outgoing"
        count={tallies.todos.matched}
        {...dragProps('todos')}
        {...persistOpen('todos', false, true)}
        actions={
          <span
            className="icon-btn"
            role="button"
            tabIndex={0}
            aria-label={t('todos.openList')}
            onKeyDown={keyActivate}
            title={t('todos.openList')}
            onClick={(e) => {
              e.stopPropagation()
              openModal({ kind: 'todos', repoPath: path })
            }}
          >
            <ExternalLink size={11} />
          </span>
        }
      >
        {() => (
          <>
            {filteredTodos.length === 0 && <div className="sb-empty">{t('sidebar.noTodos')}</div>}
            {filteredTodos.map(todoItem)}
          </>
        )}
      </Section>
    ),
    bookmarks: (
      <Section
        title={t('sidebar.bookmarks')}
        icon={<BookmarkIcon size={13} />}
        tone="shelf"
        count={filteredBookmarks.length}
        {...dragProps('bookmarks')}
        {...persistOpen('bookmarks', false, true)}
      >
        {filteredBookmarks.length === 0 && <div className="sb-empty">{t('sidebar.noBookmarks')}</div>}
        {filteredBookmarks.map((b) => (
          <div
            key={b.id}
            className="sb-item"
            role="button"
            tabIndex={0}
            onKeyDown={keyActivate}
            onClick={() => void openBookmark(b)}
            onContextMenu={(e) => {
              e.preventDefault()
              openContextMenu(e.clientX, e.clientY, bookmarkMenu(b))
            }}
            title={`${b.file}:${b.line}`}
          >
            <span className="sb-name sb-bookmark">
              <span className="sb-bookmark-label">{bookmarkLabel(b)}</span>
              <span className="sb-bookmark-where">
                {baseName(b.file)}:{b.line}
              </span>
            </span>
          </div>
        ))}
      </Section>
    ),
    stashes: (
      <Section
        title={t('sidebar.stashes')}
        icon={<Archive size={13} />}
        tone="shelf"
        count={stashes.length}
        {...dragProps('stashes')}
        {...persistOpen('stashes', false, true)}
      >
        {stashes.length === 0 && <div className="sb-empty">{t('sidebar.noStashes')}</div>}
        {stashes.map((s) => (
          <div
            key={s.index}
            data-kbkind="stash"
            data-kbid={String(s.index)}
            className={`sb-item ${repo.selected?.type === 'stash' && repo.selected.sha === s.sha ? 'current' : ''} ${isSel('stash', String(s.index)) ? 'multi-sel' : ''}`}
            role="button"
            tabIndex={0}
            onKeyDown={keyActivate}
            onClick={(e) => {
              if (!onSelectClick('stash', String(s.index), stashIds, e))
                select(path, { type: 'stash', index: s.index, sha: s.sha })
            }}
            onContextMenu={(e) => ctxMenu(e, 'stash', String(s.index), () => stashMenu(s), stashBulkMenu)}
            title={s.message}
          >
            <span className="sb-name sb-stash-name">
              <span className="sb-stash-message">{s.message}</span>
              {s.branch && <span className="sb-stash-branch">{s.branch}</span>}
            </span>
          </div>
        ))}
      </Section>
    ),
    worktrees: (
      <Section
        title={t('sidebar.worktrees')}
        icon={<FolderGit2 size={13} />}
        tone="incoming"
        count={worktrees.length}
        {...dragProps('worktrees')}
        {...persistOpen('worktrees', false, true)}
        actions={
          <>
            {prunableWorktreeCount(repo.worktrees) > 0 && (
              <span
                className="icon-btn"
                role="button"
                tabIndex={0}
                aria-label={t('worktree.prune')}
                onKeyDown={keyActivate}
                title={t('worktree.prune')}
                onClick={(e) => {
                  e.stopPropagation()
                  confirmPruneWorktrees()
                }}
              >
                <Eraser size={12} />
              </span>
            )}
            <span
              className="icon-btn"
              role="button"
              tabIndex={0}
              aria-label={t('sidebar.addWorktree')}
              onKeyDown={keyActivate}
              title={t('sidebar.addWorktree')}
              onClick={(e) => {
                e.stopPropagation()
                addWorktree()
              }}
            >
              +
            </span>
          </>
        }
      >
        {worktrees.length === 0 && <div className="sb-empty">{t('sidebar.noWorktrees')}</div>}
        {worktrees.map((w) => (
          <div
            key={w.path}
            className={`sb-item ${w.isCurrent ? 'current' : ''} ${w.prunable ? 'worktree-missing' : ''}`}
            onDoubleClick={() => !w.isCurrent && !w.prunable && openWorktreeTab(w)}
            onContextMenu={(e) => {
              e.preventDefault()
              openContextMenu(e.clientX, e.clientY, worktreeMenu(w))
            }}
            title={w.prunable ? interp(t('worktree.missingHint'), { path: w.path }) : w.path}
          >
            <span className="sb-name">{worktreeDisplayName(w)}</span>
            {w.locked && (
              <span
                className="text-2"
                title={w.lockReason ? interp(t('worktree.lockedReason'), { reason: w.lockReason }) : t('worktree.lockedNoReason')}
              >
                <Lock size={11} />
              </span>
            )}
            {w.prunable ? (
              <span className="badge missing">{t('worktree.missing')}</span>
            ) : (
              // The current checkout's state is already the repo's own status panel.
              !w.isCurrent && <WorktreeStatusBadge repoPath={path} worktree={w} />
            )}
            {w.isMain && <span className="badge">{t('sidebar.worktreeMainBadge')}</span>}
          </div>
        ))}
      </Section>
    ),
    submodules: (
      <Section
        title={t('sidebar.submodules')}
        icon={<Boxes size={13} />}
        tone="ref"
        count={submodules.length}
        {...dragProps('submodules')}
        {...persistOpen('submodules', false, true)}
        actions={
          <>
            {repo.submodules.length > 0 && (
              <span
                className="icon-btn"
                role="button"
                tabIndex={0}
                aria-label={t('sidebar.updateAllSubmodules')}
                onKeyDown={keyActivate}
                title={t('sidebar.updateAllSubmodules')}
                onClick={(e) => {
                  e.stopPropagation()
                  void repoActions.submoduleUpdate(path)
                }}
              >
                <RefreshCw size={11} />
              </span>
            )}
            <span
              className="icon-btn"
              role="button"
              tabIndex={0}
              aria-label={t('sidebar.addSubmodule')}
              onKeyDown={keyActivate}
              title={t('sidebar.addSubmodule')}
              onClick={(e) => {
                e.stopPropagation()
                addSubmodule()
              }}
            >
              <Plus size={11} />
            </span>
          </>
        }
      >
        {submodules.length === 0 && <div className="sb-empty">{t('sidebar.noSubmodules')}</div>}
        {submodules.map((sm) => {
          const statusIcon =
            sm.status === 'initialized' ? (
              <Check size={13} className="sb-sm-icon ok" />
            ) : sm.status === 'modified' ? (
              <RefreshCw size={12} className="sb-sm-icon sync" />
            ) : sm.status === 'conflict' ? (
              <AlertTriangle size={12} className="sb-sm-icon conflict" />
            ) : (
              <AlertTriangle size={12} className="sb-sm-icon warn" />
            )
          const statusTip =
            sm.status === 'initialized'
              ? `${t('sidebar.submoduleInSync')} ${repo.name}`
              : sm.status === 'modified'
                ? `${t('sidebar.submoduleOutOfSync')} ${repo.name}`
                : sm.status === 'conflict'
                  ? t('sidebar.submoduleConflictTip')
                  : t('sidebar.submoduleNeedsInit')
          return (
            <div
              key={sm.path}
              className="sb-item sb-submodule"
              onDoubleClick={() => void shellApi.revealInFolder(`${path.replace(/\/+$/, '')}/${sm.path}`)}
              onContextMenu={(e) => {
                e.preventDefault()
                openContextMenu(e.clientX, e.clientY, submoduleMenu(sm))
              }}
              title={`${sm.path}${sm.url ? ` → ${sm.url}` : ''}\n${statusTip}${sm.sha ? `\n${sm.sha.slice(0, 10)}` : ''}`}
            >
              <span className="sb-sm-status" title={statusTip}>
                {statusIcon}
              </span>
              <Boxes size={12} className="sb-sm-glyph text-2" />
              <span className="sb-name">{sm.path}</span>
              {sm.describe && <span className="sb-sub-ref text-2">{sm.describe}</span>}
              {sm.ahead > 0 && <span className="badge ahead">↑{sm.ahead}</span>}
              {sm.behind > 0 && <span className="badge behind">↓{sm.behind}</span>}
              {sm.status === 'uninitialized' && <span className="badge">{t('sidebar.submoduleUninit')}</span>}
            </div>
          )
        })}
      </Section>
    )
  }

  // Issues, Milestones & Releases are listed for GitHub and Forgejo; hide them for other hosts.
  if (!repoHasIssueTracker(repo.remotes, profiles.map((p) => p.forgejoUrl), enterpriseBasesOf(profiles))) {
    delete sections.issues
    delete sections.milestones
    delete sections.releases
  }

  const order = mergeSectionOrder(sidebarOrder, Object.keys(sections))
  const visibleOrder = order.filter((id) => !sidebarHidden.includes(id))
  // While filtering, a section with nothing to show folds into one line at the
  // bottom instead of spending a header row on "0 of 41".
  const { shown, empty: emptySections } = splitSectionsByMatches(visibleOrder, tallies, filtering)
  const resultCount = totalMatches(visibleOrder, tallies)

  const openSectionsMenu = (x: number, y: number): void => {
    const items: MenuItem[] = order.map((id) => ({
      label: `${sidebarHidden.includes(id) ? '   ' : '✓ '}${sectionLabels[id] ?? id}`,
      onClick: () => toggleSection(id)
    }))
    if (sidebarHidden.length) {
      items.push({ separator: true }, { label: t('sidebar.showAllSections'), onClick: () => updateRepoLayout(repo.path, (l) => ({ ...l, sidebarHidden: [] })) })
    }
    // Section visibility is per-repo by default; these two bridge to the
    // global `sidebarHidden` so a preference survives new repos/worktrees
    // instead of being re-set everywhere.
    items.push({ separator: true }, {
      label: t('sidebar.applySectionsToAll'),
      onClick: () =>
        useSettingsStore.getState().update((s) => ({ ...s, sidebarHidden: [...sidebarHidden] }))
    })
    if (repoLayout?.sidebarHidden) {
      items.push({
        label: t('sidebar.useGlobalSections'),
        onClick: () => updateRepoLayout(repo.path, (l) => ({ ...l, sidebarHidden: undefined }))
      })
    }
    items.push({ separator: true }, {
      label: t('sidebar.resetPanel'),
      onClick: () => {
        const sd = defaultSettings()
        updateRepoLayout(repo.path, (l) => ({ ...l, sidebarOrder: sd.sidebarOrder, sidebarHidden: sd.sidebarHidden }))
      }
    })
    openContextMenu(x, y, items)
  }

  return (
    <aside className="sidebar">
      {/* The row is a container query context: below a threshold the labels drop
          and the tabs become icons only, so a narrow sidebar never clips them. */}
      <div className="sb-tabs">
        <div className={`sb-tabs-row ${hasLaunch ? 'has-launch' : ''} ${wantsDevices ? 'has-device' : ''}`}>
          <button
            className={`sb-tab ${tab === 'git' ? 'active' : ''}`}
            title={t('sidebar.tabGit')}
            onClick={() => setTab('git')}
          >
            <GitBranch size={13} /> <span className="sb-tab-text">{t('sidebar.tabGit')}</span>
          </button>
          <button
            className={`sb-tab ${tab === 'files' ? 'active' : ''}`}
            title={t('sidebar.files')}
            onClick={() => setTab('files')}
          >
            <FolderTree size={13} /> <span className="sb-tab-text">{t('sidebar.files')}</span>
          </button>
          {hasLaunch && (
            <button
              className="sb-tab sb-tab-launch"
              title={t('sidebar.launchTitle')}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                openLaunchMenu(r.left, r.bottom)
              }}
            >
              <Play size={13} /> <span className="sb-tab-text">{t('sidebar.launch')}</span>
              <ChevronDown size={12} className="sb-tab-launch-caret" />
            </button>
          )}
          {wantsDevices && (
            <button
              className="sb-tab sb-tab-device"
              title={
                selectedDevice
                  ? interp(t('device.currentTitle'), { name: selectedDevice.name })
                  : t('device.anyTitle')
              }
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                openDeviceMenu(r.left, r.bottom)
              }}
            >
              {selectedDevice ? deviceIcon(selectedDevice) : <Smartphone size={13} />}
              <span className="sb-tab-text">{selectedDevice ? selectedDevice.name : t('device.any')}</span>
              <ChevronDown size={12} className="sb-tab-launch-caret" />
            </button>
          )}
        </div>
      </div>

      {tab === 'git' ? (
        <>
          <div className="sb-filter-row">
            <div className="sb-filter">
              <Search size={13} />
              <input
                placeholder={t('sidebar.filter')}
                aria-label={t('sidebar.filter')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && filter) {
                    e.preventDefault()
                    e.stopPropagation()
                    setFilter('')
                  }
                }}
              />
            </div>
            <span
              className="icon-btn sb-sections-btn"
              role="button"
              tabIndex={0}
              aria-label={t('sidebar.sections')}
              onKeyDown={keyActivate}
              title={t('sidebar.sections')}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                openSectionsMenu(r.right, r.bottom)
              }}
            >
              <Settings2 size={13} />
            </span>
          </div>

          {filtering && (
            <div className="sb-filter-status" role="status" aria-live="polite">
              <span className="sb-filter-results">
                {resultCount === 1 ? t('sidebar.filterResultOne') : interp(t('sidebar.filterResults'), { n: resultCount })}
              </span>
              <span className="sb-filter-hint">{t('sidebar.filterHint')}</span>
            </div>
          )}

          <div className="sb-panes">
            {shown.map((id) => (
              <Fragment key={id}>{sections[id]}</Fragment>
            ))}
          </div>
          {emptySections.length > 0 && (
            <ul className="sb-nomatch" aria-label={t('sidebar.noMatchSections')}>
              {emptySections.map((id) => (
                <li key={id} className="sb-nomatch-item">
                  <ChevronRight size={11} />
                  <span>{sectionLabels[id] ?? id}</span>
                  <span className="sb-count">0</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="sb-files-toolbar">
            <span
              className="sb-files-label"
              title={repo.path}
              onContextMenu={(e) => {
                e.preventDefault()
                openContextMenu(e.clientX, e.clientY, repoOpenMenu())
              }}
            >
              {repo.name}
            </span>
            <span className="sb-files-actions">
              <span
                className="icon-btn"
                role="button"
                tabIndex={0}
                aria-label={t('sidebar.newFilesRoot')}
                onKeyDown={keyActivate}
                title={t('sidebar.newFilesRoot')}
                onClick={() => promptCreateRoot(false)}
              >
                <FilePlus size={13} />
              </span>
              <span
                className="icon-btn"
                role="button"
                tabIndex={0}
                aria-label={t('sidebar.newFolderRoot')}
                onKeyDown={keyActivate}
                title={t('sidebar.newFolderRoot')}
                onClick={() => promptCreateRoot(true)}
              >
                <FolderPlus size={13} />
              </span>
              <span
                className="icon-btn"
                role="button"
                tabIndex={0}
                aria-label={t('sidebar.openFolder')}
                onKeyDown={keyActivate}
                title={t('sidebar.openFolder')}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  openContextMenu(r.right, r.bottom, repoOpenMenu())
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openContextMenu(e.clientX, e.clientY, repoOpenMenu())
                }}
              >
                <ExternalLink size={13} />
              </span>
            </span>
          </div>
          <div className="sb-files-search">
            <FileSearchBar value={fileFilter} onChange={setFileFilter} />
          </div>
          <div className="sb-scroll">
            <FileTree repo={repo} filter={fileFilter} />
          </div>
        </>
      )}
    </aside>
  )
}
