import type {
  AIConfig,
  AppSettings,
  InfoExport,
  PageContent,
  RepoFolder,
  RepoRef,
  SettingsBundle,
  TabState,
  VaultExport,
  Workspace
} from '../../../shared/types'
import { scrubServerUrls } from '../../../shared/secrets'
import { isEncryptedSettingsExport } from '../../../shared/settingsEncryption'
import { canonicalRepoPath } from './repoAlias'
import { pruneFolders } from './repoFolders'

export interface ParsedSettingsImport {
  settings: Partial<AppSettings>
  /** The full export when the file is one; null for an older bare-settings file. */
  bundle: SettingsBundle | null
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Read an export file in either shape. Exports are a `SettingsBundle` today and
 *  were a bare `AppSettings` before — spreading a bundle straight into settings
 *  applies nothing but junk keys, which is how onboarding's import silently did
 *  nothing. Returns null for anything that is not a settings object at all.
 *
 *  A server address carrying a `user:password@` or a query is cleaned here
 *  (`scrubServerUrls`): Settings would refuse it typed, and the addresses stay
 *  in the plain settings file. */
export function parseSettingsImport(raw: unknown): ParsedSettingsImport | null {
  if (!isObject(raw)) return null
  // Still sealed: the caller decrypts first. Read as bare settings it would
  // import nothing and report success.
  if (isEncryptedSettingsExport(raw)) return null
  // `__gitcito` is the marker upstream Gitcito, and this fork up to 4.38, wrote.
  // A backup made before the rename has to restore — tokens and vault included.
  if (raw.__githuttbr === 'settings-export' || raw.__gitcito === 'settings-export') {
    if (!isObject(raw.settings)) return null
    const settings = scrubServerUrls(raw.settings as Partial<AppSettings>)
    const rest: Record<string, unknown> = { ...raw }
    delete rest.__gitcito
    const bundle = { ...rest, __githuttbr: 'settings-export', settings } as unknown as SettingsBundle
    return { settings, bundle }
  }
  return { settings: scrubServerUrls(raw as Partial<AppSettings>), bundle: null }
}

// ─── Selective import ──────────────────────────────────────────────────────────
//
// An export is one machine's settings. Moved to another machine, some of it is
// taste (themes, columns) that travels fine, and some names folders and
// programs that only exist where it was written. The import dialog lets the
// user pick parts, and for the repositories part, swap the old home for the new
// one and keep only the repositories that exist here. Everything below is pure;
// the store applies it (`importSettings`) and main only answers existence.

/** A slice of the settings the import dialog offers on its own. */
export type ImportPart = 'profiles' | 'prefs' | 'repos' | 'machine'

export const IMPORT_PARTS: readonly ImportPart[] = ['profiles', 'prefs', 'repos', 'machine']

// Typed as a full Record so a key added to AppSettings without a part here is a
// compile error — an unclassified key would otherwise ride along with whatever
// part the user did not pick, or never be imported at all.
const PART_OF_KEY: Record<keyof AppSettings, ImportPart> = {
  // Who the user is and which accounts answer.
  profiles: 'profiles',
  activeProfileId: 'profiles',
  ai: 'profiles',
  aiSecretsFrom: 'profiles',
  // Repositories: every path, and every map keyed by one.
  repoProfiles: 'repos',
  repoAliases: 'repos',
  repoImages: 'repos',
  tabs: 'repos',
  activeTabId: 'repos',
  workspaces: 'repos',
  activeWorkspaceId: 'repos',
  recentRepos: 'repos',
  repoScanRoots: 'repos',
  favouriteRepos: 'repos',
  repoSectionColors: 'repos',
  repoLayouts: 'repos',
  repoTodos: 'repos',
  repoBookmarks: 'repos',
  lastClonePath: 'repos',
  // Programs on this computer: an executable path from another OS launches nothing.
  terminalShell: 'machine',
  terminalPoshTheme: 'machine',
  defaultOpenApp: 'machine',
  editor: 'machine',
  // Taste and behaviour — the same on any computer.
  tabRepoLabel: 'prefs',
  pullMode: 'prefs',
  appThemeId: 'prefs',
  codeThemeId: 'prefs',
  themeMode: 'prefs',
  codeFontSize: 'prefs',
  iconColors: 'prefs',
  customAppThemes: 'prefs',
  customCodeThemes: 'prefs',
  language: 'prefs',
  initialCommitCount: 'prefs',
  loadMoreCount: 'prefs',
  autoLoadOnScroll: 'prefs',
  relativeDates: 'prefs',
  commitAvatars: 'prefs',
  githubAvatars: 'prefs',
  avatarMotion: 'prefs',
  fileListView: 'prefs',
  groupBranches: 'prefs',
  graphColumns: 'prefs',
  graphColumnOrder: 'prefs',
  graphStyle: 'prefs',
  customGraphPalettes: 'prefs',
  analyzerMode: 'prefs',
  todosHideDone: 'prefs',
  todosManualOrder: 'prefs',
  autoFetchMinutes: 'prefs',
  desktopNotifications: 'prefs',
  confirmForcePush: 'prefs',
  mergeCommit: 'prefs',
  sidebarOrder: 'prefs',
  sidebarHidden: 'prefs',
  onboardingCompleted: 'prefs',
  aiAccountsNoticeSeen: 'prefs',
  autoOpenChangelog: 'prefs',
  wipSnapshotMinutes: 'prefs',
  snapshotGuard: 'prefs',
  localCiEnabled: 'prefs',
  codegraphIndexWorktrees: 'prefs',
  worktreeAutoGroup: 'prefs',
  worktreeShortLabels: 'prefs',
  worktreeCopyIgnored: 'prefs',
  maskSecrets: 'prefs',
  showChangeGutter: 'prefs',
  showMinimap: 'prefs',
  enableLaunchJson: 'prefs',
  shortcuts: 'prefs',
  largeFileKb: 'prefs',
  warnOnClose: 'prefs',
  terminalPlacement: 'prefs',
  terminalCenterApplied: 'prefs',
  openTerminalOnRepoOpen: 'prefs',
  terminalThemeId: 'prefs',
  terminalFontSize: 'prefs',
  terminalFontFamily: 'prefs',
  tabSizing: 'prefs',
  sidebarSide: 'prefs',
  rightPanelFullHeight: 'prefs',
  lastSeenVersion: 'prefs',
  skippedUpdateVersion: 'prefs'
}

/** Which part every AppSettings key belongs to. */
export function partOfKey(key: keyof AppSettings): ImportPart {
  return PART_OF_KEY[key]
}

/** Every classified key, for callers (and tests) that walk them. */
export const IMPORT_KEYS = Object.keys(PART_OF_KEY) as (keyof AppSettings)[]

const isPart = (key: string, part: ImportPart): boolean =>
  Object.prototype.hasOwnProperty.call(PART_OF_KEY, key) && PART_OF_KEY[key as keyof AppSettings] === part

// ── Paths ──

const WIN_DRIVE = /^[A-Za-z]:(?:[\\/]|$)/

function isWindowsPath(path: string): boolean {
  return WIN_DRIVE.test(path) || path.startsWith('\\\\')
}

const slashes = (path: string): string => path.replace(/\\/g, '/')

/** Drop trailing separators, but never turn a root (`/`, `C:/`) into nothing. */
function trimTrailing(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  if (!trimmed) return path ? path[0] : path
  return /^[A-Za-z]:$/.test(trimmed) ? `${trimmed}${path[trimmed.length] ?? ''}` : trimmed
}

/** The separator a path is written with: a Windows path keeps backslashes
 *  unless it was typed with forward slashes. */
function separatorOf(path: string): '/' | '\\' {
  if (path.includes('\\')) return '\\'
  return isWindowsPath(path) && !path.includes('/') ? '\\' : '/'
}

/**
 * `path` with `from` swapped for `to` when it starts with it (on a path-segment
 * boundary), else unchanged. Separators normalised to the target's style.
 *
 * A Windows `from` matches case-insensitively, as the filesystem does. The
 * boundary check is what keeps `/home/dev/Work` from matching
 * `/home/dev/Workspace2`.
 */
export function remapPath(path: string, from: string, to: string): string {
  if (!from || !path) return path
  const source = trimTrailing(slashes(from))
  const subject = slashes(path)
  const fold = isWindowsPath(from)
  const head = subject.slice(0, source.length)
  if ((fold ? head.toLowerCase() : head) !== (fold ? source.toLowerCase() : source)) return path
  const rest = subject.slice(source.length)
  if (rest && !rest.startsWith('/') && !source.endsWith('/')) return path
  const target = trimTrailing(to)
  const sep = separatorOf(to || path)
  const tail = rest.replace(/^\/+/, '')
  if (!tail) return target
  const joined = tail.replace(/\//g, sep)
  return /[\\/]$/.test(target) ? `${target}${joined}` : `${target}${sep}${joined}`
}

// The home folder a path sits under, by the conventions of each OS. Matched on
// forward slashes; the capture is the home itself.
const HOME_PATTERNS: RegExp[] = [/^(\/home\/[^/]+)(?:\/|$)/, /^(\/Users\/[^/]+)(?:\/|$)/, /^([A-Za-z]:\/Users\/[^/]+)(?:\/|$)/i]

function segmentsOf(path: string): string[] {
  return slashes(path).split('/').filter((s, i) => s !== '' || i === 0)
}

/** The home folder `path` sits under (forward slashes), or null. */
function homeOf(path: string): string | null {
  const flat = slashes(path)
  for (const re of HOME_PATTERNS) {
    const m = re.exec(flat)
    if (m) return m[1]
  }
  return null
}

/**
 * A prefix swap that would make the file's paths this machine's: the deepest
 * directory shared by `paths`, with its home part (/home/<u>, /Users/<u>,
 * C:\Users\<u>) replaced by `home`. Null when no home-like prefix is found.
 *
 * Only paths under a home count, and only those under the most common home:
 * one worktree in /tmp or a repository on D:\ must not shrink the shared
 * prefix to nothing and hide the translation for all the others. Those paths
 * are simply left as they are by the remap.
 *
 * Returned even when `from` and `to` come out equal (a file from this same
 * machine): the dialog can show "nothing to translate" rather than guess.
 */
export function suggestRemap(paths: string[], home: string): { from: string; to: string } | null {
  if (!home) return null
  const byHome = new Map<string, string[]>()
  for (const p of paths) {
    if (typeof p !== 'string' || !p.trim()) continue
    const h = homeOf(p)
    if (!h) continue
    // Windows homes compare case-insensitively, as the filesystem does.
    const key = isWindowsPath(p) ? h.toLowerCase() : h
    byHome.set(key, [...(byHome.get(key) ?? []), p])
  }
  // Most paths wins; a tie keeps the home met first.
  let usable: string[] = []
  for (const list of byHome.values()) if (list.length > usable.length) usable = list
  if (!usable.length) return null
  const fold = isWindowsPath(usable[0])
  const split = usable.map(segmentsOf)
  const common: string[] = []
  for (let i = 0; ; i++) {
    const seg = split[0][i]
    if (seg === undefined) break
    const same = split.every((s) => s[i] !== undefined && (fold ? s[i].toLowerCase() === seg.toLowerCase() : s[i] === seg))
    if (!same) break
    common.push(seg)
  }
  const shared = common.join('/')
  const homePart = homeOf(shared)
  if (!homePart) return null
  const from = fold && separatorOf(usable[0]) === '\\' ? shared.replace(/\//g, '\\') : shared
  const to = remapPath(shared, homePart, trimTrailing(home))
  return { from, to }
}

// ── The 'repos' part ──

/** Path-keyed maps whose keys are `canonicalRepoPath` (forward slashes,
 *  lower-case drive). A key translated onto Windows has to stay canonical, or
 *  the lookups (`todosFor`, `repoImageFor`) miss it. */
const CANONICAL_RECORDS = ['repoAliases', 'repoImages', 'repoTodos', 'repoBookmarks'] as const
/** Path-keyed maps keyed by the path as the tab holds it. */
const RAW_RECORDS = ['repoProfiles', 'repoLayouts'] as const
type PathRecordKey = (typeof CANONICAL_RECORDS)[number] | (typeof RAW_RECORDS)[number]

function mapRecordKeys<V>(
  record: Record<string, V> | undefined,
  fn: (key: string) => string | null
): Record<string, V> | undefined {
  if (!record) return record
  const out: Record<string, V> = {}
  for (const [key, value] of Object.entries(record)) {
    const next = fn(key)
    // Two old keys landing on one new key: the first wins, like a repath does.
    if (next !== null && !(next in out)) out[next] = value
  }
  return out
}

function mapPathRecords(
  incoming: Partial<AppSettings>,
  fn: (key: string, canonical: boolean) => string | null
): Partial<AppSettings> {
  const out: Partial<AppSettings> = { ...incoming }
  const assign = <K extends PathRecordKey>(key: K, canonical: boolean): void => {
    if (incoming[key] === undefined) return
    out[key] = mapRecordKeys(incoming[key] as Record<string, unknown>, (k) => fn(k, canonical)) as AppSettings[K]
  }
  for (const key of CANONICAL_RECORDS) assign(key, true)
  for (const key of RAW_RECORDS) assign(key, false)
  return out
}

function mapFolderPaths(folder: RepoFolder, fn: (path: string) => string): RepoFolder {
  return {
    ...folder,
    paths: [...new Set((folder.paths ?? []).map(fn))],
    folders: (folder.folders ?? []).map((f) => mapFolderPaths(f, fn))
  }
}

function remapPage(page: PageContent, fn: (path: string) => string): PageContent {
  return 'repoPath' in page && typeof page.repoPath === 'string' ? { ...page, repoPath: fn(page.repoPath) } : page
}

function remapRef(ref: RepoRef, fn: (path: string) => string): RepoRef {
  return { ...ref, path: fn(ref.path), ...(ref.worktreeRoot ? { worktreeRoot: fn(ref.worktreeRoot) } : {}) }
}

function remapTabs(tabs: TabState[], fn: (path: string) => string): TabState[] {
  return tabs.map((tab) => {
    if (tab.kind === 'page') return { ...tab, page: remapPage(tab.page, fn) }
    const base = {
      ...tab,
      repos: tab.repos.map((r) => remapRef(r, fn)),
      activeRepoPath: tab.activeRepoPath === null ? null : fn(tab.activeRepoPath),
      ...(tab.pages ? { pages: tab.pages.map((p) => remapPage(p, fn)) } : {})
    }
    return tab.kind === 'group' && tab.folders
      ? { ...base, kind: 'group' as const, folders: tab.folders.map((f) => mapFolderPaths(f, fn)) }
      : base
  })
}

/** Rewrite every path value AND every path-keyed record key of the 'repos'
 *  part (and InfoExport keys) from `from` to `to`. Pure. */
export function remapRepoPaths(incoming: Partial<AppSettings>, from: string, to: string): Partial<AppSettings> {
  if (!from) return incoming
  const fn = (path: string): string => remapPath(path, from, to)
  const out = mapPathRecords(incoming, (key, canonical) => {
    const next = fn(key)
    return canonical && next !== key ? canonicalRepoPath(next) : next
  })
  if (incoming.tabs) out.tabs = remapTabs(incoming.tabs, fn)
  if (incoming.workspaces) {
    out.workspaces = incoming.workspaces.map((w) => ({
      ...w,
      tabs: remapTabs(w.tabs ?? [], fn),
      ...(w.sourcePath ? { sourcePath: fn(w.sourcePath) } : {})
    }))
  }
  if (incoming.recentRepos) out.recentRepos = incoming.recentRepos.map((r) => remapRef(r, fn))
  if (incoming.repoScanRoots) out.repoScanRoots = incoming.repoScanRoots.map((r) => ({ ...r, path: fn(r.path) }))
  if (incoming.favouriteRepos) out.favouriteRepos = [...new Set(incoming.favouriteRepos.map(fn))]
  if (incoming.lastClonePath) out.lastClonePath = fn(incoming.lastClonePath)
  return out
}

/** Keep the tab's pages that still have their repository, and the page that
 *  was showing if it survived. */
function keepPages(
  pages: PageContent[] | undefined,
  activePage: number | null | undefined,
  has: (path: string) => boolean
): { pages?: PageContent[]; activePage?: number | null } {
  if (!pages) return {}
  const showing = typeof activePage === 'number' ? pages[activePage] : undefined
  const kept = pages.filter((p) => !('repoPath' in p) || has(p.repoPath))
  const index = showing ? kept.indexOf(showing) : -1
  return { pages: kept, activePage: index >= 0 ? index : null }
}

function dropMissingFromTabs(tabs: TabState[], has: (path: string) => boolean): TabState[] {
  const out: TabState[] = []
  for (const tab of tabs) {
    if (tab.kind === 'page') {
      if (!('repoPath' in tab.page) || has(tab.page.repoPath)) out.push(tab)
      continue
    }
    const repos = tab.repos.filter((r) => has(r.path))
    // A tab of repositories none of which exist here would open as an error.
    if (!repos.length) continue
    const activeRepoPath =
      tab.activeRepoPath && repos.some((r) => r.path === tab.activeRepoPath) ? tab.activeRepoPath : repos[0].path
    const pages = 'pages' in tab ? keepPages(tab.pages, tab.activePage, has) : {}
    if (tab.kind === 'group') {
      out.push({ ...tab, repos, activeRepoPath, ...pages, ...(tab.folders ? { folders: pruneFolders(tab.folders, repos) } : {}) })
    } else {
      out.push({ ...tab, repos, activeRepoPath, ...pages })
    }
  }
  return out
}

/** The tab that was active when it survived, else the first one left. */
const keepActiveTab = (tabs: TabState[], active: string | null | undefined): string | null =>
  active && tabs.some((t) => t.id === active) ? active : (tabs[0]?.id ?? null)

/** A membership test that ignores separator style, trailing slashes and drive
 *  case — the forms one folder can be written in. */
function existenceTest(existing: Iterable<string>): (path: string) => boolean {
  const known = new Set([...existing].map(canonicalRepoPath))
  return (path) => known.has(canonicalRepoPath(path))
}

/**
 * Drop, from the 'repos' part, every repository whose path is not in
 * `existing`: tab repo refs (and tabs left empty), workspace contents, recents,
 * favourites, scan roots, and every path-keyed record entry. Pure.
 *
 * `lastClonePath` goes too when its folder is missing — it only pre-fills the
 * clone dialog. A workspace's `sourcePath` and a ref's `worktreeRoot` are
 * metadata, never opened, so they stay.
 */
export function dropMissingRepos(incoming: Partial<AppSettings>, existing: ReadonlySet<string>): Partial<AppSettings> {
  const has = existenceTest(existing)
  const out = mapPathRecords(incoming, (key) => (has(key) ? key : null))
  if (incoming.tabs) {
    out.tabs = dropMissingFromTabs(incoming.tabs, has)
    if ('activeTabId' in incoming) out.activeTabId = keepActiveTab(out.tabs, incoming.activeTabId)
  }
  if (incoming.workspaces) {
    out.workspaces = incoming.workspaces.map((w) => {
      const tabs = dropMissingFromTabs(w.tabs ?? [], has)
      return { ...w, tabs, activeTabId: keepActiveTab(tabs, w.activeTabId) }
    })
  }
  if (incoming.recentRepos) out.recentRepos = incoming.recentRepos.filter((r) => has(r.path))
  if (incoming.repoScanRoots) out.repoScanRoots = incoming.repoScanRoots.filter((r) => has(r.path))
  if (incoming.favouriteRepos) out.favouriteRepos = incoming.favouriteRepos.filter(has)
  if (incoming.lastClonePath && !has(incoming.lastClonePath)) delete out.lastClonePath
  return out
}

/**
 * Only the keys of the chosen parts.
 *
 * With every part chosen the file goes through whole, unknown keys included —
 * an older export's legacy fields are the normalizer's to migrate, exactly as
 * before parts existed. A partial pick drops keys no part claims.
 */
export function pickParts(incoming: Partial<AppSettings>, parts: readonly ImportPart[]): Partial<AppSettings> {
  if (IMPORT_PARTS.every((p) => parts.includes(p))) return { ...incoming }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (parts.some((p) => isPart(key, p))) out[key] = value
  }
  return out as Partial<AppSettings>
}

// ── Summary ──

export interface ImportSummary {
  profileCount: number
  /** Number of AppSettings keys in 'prefs' present in the file. */
  prefCount: number
  /** Every distinct repository/folder path the 'repos' part holds (deduped). */
  repoPaths: string[]
  /** The machine-specific values present (shell path, editor path, open-app
   *  path, AI cliPath/cliCwd…), human-readable, deduped. */
  machinePaths: string[]
}

function collectTabPaths(tabs: TabState[] | undefined, add: (path: string) => void): void {
  for (const tab of tabs ?? []) {
    if (tab.kind === 'page') {
      if ('repoPath' in tab.page) add(tab.page.repoPath)
      continue
    }
    for (const r of tab.repos ?? []) add(r.path)
    for (const p of tab.pages ?? []) if ('repoPath' in p) add(p.repoPath)
  }
}

const looksLikePath = (value: string): boolean => /[\\/]/.test(value)

function aiConfigs(incoming: Partial<AppSettings>): AIConfig[] {
  const list: AIConfig[] = []
  if (incoming.ai) list.push(incoming.ai)
  for (const p of incoming.profiles ?? []) if (p?.ai) list.push(p.ai)
  return list
}

/**
 * What the file holds, per part — for the dialog to describe before anything
 * is applied.
 *
 * `repoPaths` is what an existence check needs: repositories (tabs, pages,
 * recents, favourites, every path-keyed map), scan roots and the last clone
 * folder. A ref's `worktreeRoot` and a workspace's `sourcePath` are metadata
 * and left out. A preset shell name (`pwsh`) is not a path and is not listed.
 */
export function summarizeImport(incoming: Partial<AppSettings>): ImportSummary {
  const repoPaths: string[] = []
  const seenRepo = new Set<string>()
  const addRepo = (path: string | undefined | null): void => {
    if (typeof path !== 'string' || !path.trim()) return
    const key = canonicalRepoPath(path)
    if (seenRepo.has(key)) return
    seenRepo.add(key)
    repoPaths.push(path)
  }
  collectTabPaths(incoming.tabs, addRepo)
  for (const w of incoming.workspaces ?? []) collectTabPaths(w.tabs, addRepo)
  for (const r of incoming.recentRepos ?? []) addRepo(r.path)
  for (const p of incoming.favouriteRepos ?? []) addRepo(p)
  for (const key of [...RAW_RECORDS, ...CANONICAL_RECORDS]) for (const p of Object.keys(incoming[key] ?? {})) addRepo(p)
  for (const r of incoming.repoScanRoots ?? []) addRepo(r.path)
  addRepo(incoming.lastClonePath)

  const machinePaths: string[] = []
  const addMachine = (value: string | undefined): void => {
    const v = value?.trim()
    if (v && !machinePaths.includes(v)) machinePaths.push(v)
  }
  if (incoming.terminalShell && looksLikePath(incoming.terminalShell)) addMachine(incoming.terminalShell)
  if (incoming.terminalPoshTheme && looksLikePath(incoming.terminalPoshTheme)) addMachine(incoming.terminalPoshTheme)
  addMachine(incoming.defaultOpenApp?.path)
  addMachine(incoming.editor?.command)
  for (const ai of aiConfigs(incoming)) {
    addMachine(ai.cliPath)
    addMachine(ai.cliCwd)
    for (const account of ai.accounts ?? []) addMachine(account?.cliPath)
  }

  let prefCount = 0
  for (const [key, value] of Object.entries(incoming)) if (value !== undefined && isPart(key, 'prefs')) prefCount++

  return { profileCount: incoming.profiles?.length ?? 0, prefCount, repoPaths, machinePaths }
}

// ── AI CLI paths: 'machine' values living inside the 'profiles' part ──

/**
 * `target` with each account's `cliPath` taken from `source`'s account of the
 * same id. `dropUnmatched`: an account `source` does not have loses its path
 * (the file's path names a binary on another machine); otherwise it keeps it.
 * The top-level `cliPath` mirrors the default account and is rebuilt by
 * `resolveAI` on normalize, so only `cliCwd` is carried at that level.
 */
function overlayCliPaths(target: AIConfig, source: AIConfig | undefined, dropUnmatched: boolean): AIConfig {
  const byId = new Map((source?.accounts ?? []).map((a) => [a.id, a]))
  const accounts = (target.accounts ?? []).map((account) => {
    const match = byId.get(account.id)
    if (!match && !dropUnmatched) return account
    const next = { ...account }
    if (match?.cliPath) next.cliPath = match.cliPath
    else delete next.cliPath
    return next
  })
  const out: AIConfig = { ...target, accounts }
  const cwd = source ? source.cliCwd : dropUnmatched ? undefined : target.cliCwd
  if (cwd) out.cliCwd = cwd
  else delete out.cliCwd
  return out
}

/**
 * For an import of 'profiles' without 'machine': the file's AI accounts with
 * this machine's CLI paths (`cliPath` per account id, `cliCwd`), for the
 * general AI and each profile matched by id. An account this machine does not
 * have gets no path — the binary is found on PATH, not at the other OS's path.
 * Returns only the `ai`/`profiles` keys `chosen` carries.
 */
export function keepMachineAIPaths(chosen: Partial<AppSettings>, current: AppSettings): Partial<AppSettings> {
  const out: Partial<AppSettings> = {}
  if (chosen.ai) out.ai = overlayCliPaths(chosen.ai, current.ai, true)
  if (chosen.profiles) {
    const mine = new Map(current.profiles.map((p) => [p.id, p]))
    out.profiles = chosen.profiles.map((p) => (p.ai ? { ...p, ai: overlayCliPaths(p.ai, mine.get(p.id)?.ai, true) } : p))
  }
  return out
}

/**
 * For an import of 'machine' without 'profiles': this machine's AI accounts
 * with the file's CLI paths for the accounts both share (by id). Accounts the
 * file does not know keep their own path.
 */
export function takeMachineAIPaths(current: AppSettings, incoming: Partial<AppSettings>): Partial<AppSettings> {
  if (!incoming.ai && !incoming.profiles) return {}
  const theirs = new Map((incoming.profiles ?? []).map((p) => [p.id, p]))
  return {
    ai: incoming.ai ? overlayCliPaths(current.ai, incoming.ai, false) : current.ai,
    profiles: current.profiles.map((p) => {
      const other = theirs.get(p.id)?.ai
      return other ? { ...p, ai: overlayCliPaths(p.ai, other, false) } : p
    })
  }
}

// ── Bundle extras ──

/** Which bundle extras a pick covers: `info` is per-repository data keyed by
 *  path ('repos'); the vault and the profile pictures go with 'profiles'. */
export function bundleExtrasFor(parts: readonly ImportPart[]): { info: boolean; vault: boolean; avatars: boolean } {
  const profiles = parts.includes('profiles')
  return { info: parts.includes('repos'), vault: profiles, avatars: profiles }
}

function remapRepoKeyed<E>(
  repos: Record<string, E[]> | undefined,
  from: string,
  to: string,
  existing: Iterable<string> | undefined
): Record<string, E[]> {
  const has = existing ? existenceTest(existing) : (): boolean => true
  // The empty key is not a repository (the vault files nothing there today,
  // but a path-less key must never be dropped as "missing").
  return mapRecordKeys(repos ?? {}, (key) => {
    if (!key) return key
    const next = remapPath(key, from, to)
    return has(next) ? next : null
  }) ?? {}
}

/** The info store's per-repository entries with their path keys translated,
 *  and — when `existing` (a Set or an array) is given — only those whose
 *  folder exists here. */
export function remapInfoExport(
  info: InfoExport,
  from: string,
  to: string,
  existing?: Iterable<string>
): InfoExport {
  return { ...info, repos: remapRepoKeyed(info.repos, from, to, existing) }
}

/** The vault's per-repository secrets with their path keys translated. Never
 *  filtered: a secret filed under a repository this machine does not have is
 *  harmless, and becomes useful the day that repository is cloned here. The
 *  global entries are not tied to a path and pass through. */
export function remapVaultExport(vault: VaultExport, from: string, to: string): VaultExport {
  return { ...vault, repos: remapRepoKeyed(vault.repos, from, to, undefined) }
}

/** Every repository path the bundle's extras are keyed by (info and vault),
 *  deduped against each other — for the dialog to add to its existence check,
 *  since a repository can have info without appearing anywhere in settings. */
export function bundleRepoPaths(bundle: Pick<SettingsBundle, 'info' | 'vault'> | null | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const key of [...Object.keys(bundle?.info?.repos ?? {}), ...Object.keys(bundle?.vault?.repos ?? {})]) {
    if (!key.trim()) continue
    const canon = canonicalRepoPath(key)
    if (seen.has(canon)) continue
    seen.add(canon)
    out.push(key)
  }
  return out
}

// ── Merging the 'repos' part into this machine's ──

const PATH_RECORDS = [...CANONICAL_RECORDS, ...RAW_RECORDS] as const

/** Union of two lists, `first`'s entries first, one per canonical key. */
function unionBy<T>(first: T[] | undefined, second: T[] | undefined, key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of [...(first ?? []), ...(second ?? [])]) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/** What makes two tabs "the same" across machines, whose ids are random: the
 *  set of repositories a repo/group tab holds, or the page a page tab shows. */
function tabIdentity(tab: TabState): string {
  if (tab.kind === 'page') return `page:${JSON.stringify(tab.page)}`
  return `repos:${tab.repos.map((r) => canonicalRepoPath(r.path)).sort().join('\n')}`
}

/** `ours` plus the tabs of `theirs` not already there — by id, else by identity. */
function addMissingTabs(ours: TabState[], theirs: TabState[]): TabState[] {
  const ids = new Set(ours.map((t) => t.id))
  const identities = new Set(ours.map(tabIdentity))
  const out = [...ours]
  for (const tab of theirs) {
    if (ids.has(tab.id) || identities.has(tabIdentity(tab))) continue
    ids.add(tab.id)
    identities.add(tabIdentity(tab))
    out.push(tab)
  }
  return out
}

/**
 * The 'repos' part of `chosen` merged into `current`, never replacing it — an
 * import adds the file's repositories to this machine's, it does not wipe the
 * ones that only exist here. Returns only the keys to write over `current`.
 *
 * - Path-keyed maps: ours, with the file's entry winning per repository.
 * - Favourites, recents, scan roots: union, the file's first, one per path.
 * - Section colours: ours, with the file's winning per section.
 * - Tabs: a file workspace with our id (the shared `default`) adds the tabs we
 *   do not have to ours; a workspace we do not have is added whole, unless it
 *   has no tabs left. A pre-workspaces file's `tabs` go into our active
 *   workspace. Our active workspace and tab stay active.
 * - `lastClonePath`: the file's when it has one (after `dropMissingRepos`,
 *   only if it exists here), else ours.
 */
export function mergeRepoPart(current: AppSettings, chosen: Partial<AppSettings>): Partial<AppSettings> {
  const out: Partial<AppSettings> = {}
  const mergeRecord = <K extends PathRecordKey>(key: K): void => {
    if (chosen[key] === undefined) return
    out[key] = { ...(current[key] ?? {}), ...chosen[key] } as AppSettings[K]
  }
  for (const key of PATH_RECORDS) mergeRecord(key)
  if (chosen.repoSectionColors) out.repoSectionColors = { ...(current.repoSectionColors ?? {}), ...chosen.repoSectionColors }
  if (chosen.favouriteRepos) out.favouriteRepos = unionBy(chosen.favouriteRepos, current.favouriteRepos, canonicalRepoPath)
  if (chosen.recentRepos) out.recentRepos = unionBy(chosen.recentRepos, current.recentRepos, (r) => canonicalRepoPath(r.path))
  if (chosen.repoScanRoots) out.repoScanRoots = unionBy(chosen.repoScanRoots, current.repoScanRoots, (r) => canonicalRepoPath(r.path))
  if (chosen.lastClonePath) out.lastClonePath = chosen.lastClonePath

  if (chosen.workspaces || chosen.tabs) {
    // Our active workspace as the live strip has it: `tabs` is the fresher copy.
    let workspaces: Workspace[] = current.workspaces.map((w) =>
      w.id === current.activeWorkspaceId ? { ...w, tabs: current.tabs, activeTabId: current.activeTabId } : w
    )
    const theirs: Workspace[] = chosen.workspaces
      ? chosen.workspaces
      : [{ id: current.activeWorkspaceId, name: '', tabs: chosen.tabs ?? [], activeTabId: null }]
    for (const ws of theirs) {
      const mine = workspaces.find((w) => w.id === ws.id)
      if (mine) {
        const tabs = addMissingTabs(mine.tabs ?? [], ws.tabs ?? [])
        workspaces = workspaces.map((w) =>
          w.id === ws.id ? { ...w, tabs, activeTabId: keepActiveTab(tabs, w.activeTabId) } : w
        )
      } else if (ws.tabs?.length) {
        workspaces = [...workspaces, ws]
      }
    }
    // With no tab of our own anywhere (a fresh install, onboarding), there is
    // nothing of ours to keep in front: open on the file's workspace, as a
    // restore did before the merge.
    const fresh = current.workspaces.every((w) => !w.tabs?.length) && !current.tabs.length
    const wantedId = fresh && chosen.activeWorkspaceId ? chosen.activeWorkspaceId : current.activeWorkspaceId
    const active = workspaces.find((w) => w.id === wantedId) ?? workspaces[0]
    out.workspaces = workspaces
    out.activeWorkspaceId = active?.id ?? current.activeWorkspaceId
    out.tabs = active?.tabs ?? current.tabs
    out.activeTabId = active?.activeTabId ?? null
  }
  return out
}
