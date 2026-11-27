import type {
  AIConfig,
  AppSettings,
  InfoExport,
  PageContent,
  Profile,
  RepoFolder,
  RepoRef,
  SettingsBundle,
  TabState,
  VaultExport,
  Workspace
} from '../../../shared/types'
import { scrubServerUrls } from '../../../shared/secrets'
import { normalizeGithubEnterpriseUrl } from '../../../shared/githubEnterprise'
import { normalizeGitlabServerUrl } from '../../../shared/gitlabInstance'
import { normalizeBitbucketServerUrl } from '../../../shared/bitbucketServer'
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
  // The builds up to 4.38 wrote the marker they inherited, and the 4.39
  // upgrade guide had users carry their tokens over in exactly such a file. An
  // import is a file the user picked, so it still restores, handed on under the
  // current marker only.
  const oldMarker = raw.__gitcito === 'settings-export' // upstream-name: this app's own exports up to 4.38
  if (raw.__githuttbr === 'settings-export' || oldMarker) {
    if (!isObject(raw.settings)) return null
    const settings = scrubServerUrls(raw.settings as Partial<AppSettings>)
    const rest: Record<string, unknown> = { ...raw }
    delete rest.__gitcito // upstream-name: drop the old marker so downstream sees one
    const bundle = { ...rest, __githuttbr: 'settings-export', settings } as unknown as SettingsBundle
    return { settings, bundle }
  }
  // Any other app's export marker: not this app's file, and not bare settings.
  if (Object.entries(raw).some(([k, v]) => k.startsWith('__') && v === 'settings-export')) return null
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
  aiBehaviourShared: 'profiles',
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
  // This install's own record of itself: never taken from a file (`pickParts`
  // drops them); classed here only so the map stays complete.
  settingsFormat: 'machine',
  versionRollback: 'machine',
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
  commentImagesFromOtherSites: 'prefs',
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
  const out: Record<string, unknown> = {}
  if (IMPORT_PARTS.every((p) => parts.includes(p))) Object.assign(out, incoming)
  else {
    for (const [key, value] of Object.entries(incoming)) {
      if (parts.some((p) => isPart(key, p))) out[key] = value
    }
  }
  // Another install's rollback would hide this one's updates and show its banner;
  // the format is stamped by main on every save.
  delete out.versionRollback
  delete out.settingsFormat
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
  /** Whether the file carries anything for each part. A file exported with
   *  only some parts (the export dialog's presets) lacks the others: offering
   *  them would be a checkbox that imports nothing. */
  present: Record<ImportPart, boolean>
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

  const present = Object.fromEntries(IMPORT_PARTS.map((part) => [part, false])) as Record<ImportPart, boolean>
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined && Object.prototype.hasOwnProperty.call(PART_OF_KEY, key)) {
      present[PART_OF_KEY[key as keyof AppSettings]] = true
    }
  }
  // AI program paths live inside the profiles, not under a 'machine' key.
  if (machinePaths.length > 0) present.machine = true

  return { profileCount: incoming.profiles?.length ?? 0, prefCount, repoPaths, machinePaths, present }
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

// ── Merging the 'profiles' part into this machine's ──
//
// The file's profiles are another machine's list. Replacing ours with it loses
// a profile that only exists here (accounts added on one computer, a work
// profile only the other has), so the dialog merges by default. Profile ids
// are random per machine except the first ('default'), so a profile the user
// made on both sides matches by name when no id does — and then keeps OUR id:
// repository bindings, the active profile, the keychain entries and the
// picture on this machine are all filed under it.

/** How the 'profiles' part lands: added to ours, or standing for the whole list. */
export type ProfileImportMode = 'merge' | 'replace'

/** What importing does to one profile, for the dialog to list. */
export type ProfileRowAction = 'update' | 'new' | 'keep' | 'remove'

export interface ProfileMergeRow {
  /** The id the profile has after the import (ours for a matched one). */
  id: string
  name: string
  action: ProfileRowAction
}

export interface ProfileMergePlan {
  /** The file's profiles first, in its order; then ours it does not have. */
  rows: ProfileMergeRow[]
  /** File id → our id, only where a name match made them differ. */
  idMap: Record<string, string>
  /** Our profile ids the import removes ('replace' only). */
  removedIds: string[]
}

type ProfileLike = Pick<Profile, 'id' | 'name'>

/** The first profile of every install (`defaultProfile()` in shared/types). */
const DEFAULT_PROFILE_ID = 'default'

const nameKey = (name: unknown): string => (typeof name === 'string' ? name.trim().toLowerCase() : '')

/** The file's profiles with a usable id, one per id — a hand-edited file with
 *  a repeated id would otherwise have two profiles fight over one keychain entry. */
function uniqueIncoming<P extends ProfileLike>(incoming: readonly P[] | undefined): P[] {
  const seen = new Set<string>()
  const out: P[] = []
  for (const p of incoming ?? []) {
    if (!p || typeof p.id !== 'string' || !p.id || seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

/**
 * Pair the file's profiles with ours, one-to-one: by id first, then — among
 * those left on both sides — by name, trimmed and case-insensitive. A random
 * id shared by both sides is the same profile even when renamed on one. Not
 * `default`: every install's first profile has that id, named whatever its
 * owner typed, so two `default`s pair by id only when their names agree.
 * Returns file id → our id for every pair.
 */
export function matchProfiles(current: readonly ProfileLike[], incoming: readonly ProfileLike[]): Map<string, string> {
  const theirs = uniqueIncoming(incoming)
  const byId = new Map(current.map((p) => [p.id, p]))
  const pairs = new Map<string, string>()
  const taken = new Set<string>()
  const pair = (fileId: string, ourId: string): void => {
    pairs.set(fileId, ourId)
    taken.add(ourId)
  }
  for (const p of theirs) {
    const mine = byId.get(p.id)
    if (!mine) continue
    const a = nameKey(p.name)
    const b = nameKey(mine.name)
    if (p.id !== DEFAULT_PROFILE_ID || !a || !b || a === b) pair(p.id, p.id)
  }
  for (const p of theirs) {
    if (pairs.has(p.id)) continue
    const key = nameKey(p.name)
    if (!key) continue
    const mine = current.find((c) => !taken.has(c.id) && nameKey(c.name) === key)
    if (mine) pair(p.id, mine.id)
  }
  return pairs
}

/** What an import of `incoming` would do to `current`, row by row. */
export function planProfileMerge(
  current: readonly ProfileLike[],
  incoming: readonly ProfileLike[],
  mode: ProfileImportMode = 'merge'
): ProfileMergePlan {
  const pairs = matchProfiles(current, incoming)
  const theirs = uniqueIncoming(incoming)
  const idMap: Record<string, string> = {}
  const rows: ProfileMergeRow[] = []
  // A new profile whose id one of ours already has (two different `default`s)
  // needs its own: deterministic, so the dialog's plan and the store's agree.
  const used = new Set([...current.map((p) => p.id), ...theirs.map((p) => p.id)])
  const freshId = (id: string): string => {
    let n = 1
    let next = `${id}-imported`
    while (used.has(next)) next = `${id}-imported-${++n}`
    used.add(next)
    return next
  }
  const ours = new Set(current.map((p) => p.id))
  for (const p of theirs) {
    const mine = pairs.get(p.id)
    if (mine && mine !== p.id) idMap[p.id] = mine
    if (!mine && ours.has(p.id)) idMap[p.id] = freshId(p.id)
    rows.push({ id: mine ?? idMap[p.id] ?? p.id, name: p.name, action: mine ? 'update' : 'new' })
  }
  const matched = new Set(pairs.values())
  const removedIds: string[] = []
  for (const p of current) {
    if (matched.has(p.id)) continue
    rows.push({ id: p.id, name: p.name, action: mode === 'merge' ? 'keep' : 'remove' })
    if (mode === 'replace') removedIds.push(p.id)
  }
  return { rows, idMap, removedIds }
}

/**
 * Under 'replace', a matched profile takes the file's copy whole: the servers
 * and AI accounts only ours has go — and main prunes their saved tokens and
 * keys. Names of our profiles that would lose any, so the dialog can say so
 * before it happens (a replace that removes no profile still deletes these).
 */
export function profilesLosingOnReplace(
  current: readonly Profile[],
  incoming: readonly Profile[],
  idMap: Readonly<Record<string, string>>
): string[] {
  const names: string[] = []
  for (const theirs of uniqueIncoming(incoming)) {
    const id = hasKey(idMap, theirs.id) ? idMap[theirs.id] : theirs.id
    const ours = current.find((p) => p.id === id)
    if (!ours) continue
    const lost = (
      mine: { url: string }[] | undefined,
      file: { url: string }[] | undefined,
      normalize: (raw: string | undefined) => string | null
    ): boolean => {
      const key = (u: string): string => normalize(u) ?? u.trim().toLowerCase()
      const kept = new Set((file ?? []).map((h) => key(h.url)))
      return (mine ?? []).some((h) => !kept.has(key(h.url)))
    }
    const fileAccounts = new Set((theirs.ai?.accounts ?? []).map((a) => a.id))
    if (
      lost(ours.githubEnterprise, theirs.githubEnterprise, normalizeGithubEnterpriseUrl) ||
      lost(ours.gitlabServers, theirs.gitlabServers, normalizeGitlabServerUrl) ||
      lost(ours.bitbucketServers, theirs.bitbucketServers, normalizeBitbucketServerUrl) ||
      (ours.ai?.accounts ?? []).some((a) => !fileAccounts.has(a.id))
    ) {
      names.push(ours.name || ours.id)
    }
  }
  return names
}

// Own keys only: a profile id like `constructor` must not read the prototype.
const hasKey = (record: object, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key)

/** `id` through the map, unchanged when it has no entry. */
const mapId = (idMap: Readonly<Record<string, string>>, id: string): string => (hasKey(idMap, id) ? idMap[id] : id)

/**
 * A record keyed by profile id (the bundle's pictures) with the file's ids
 * moved to ours. An entry already under our id wins over a moved one.
 */
export function remapProfileKeyed<V>(
  record: Record<string, V> | undefined,
  idMap: Readonly<Record<string, string>>
): Record<string, V> | undefined {
  if (!record) return record
  const out: Record<string, V> = {}
  for (const [id, value] of Object.entries(record)) if (!hasKey(idMap, id)) out[id] = value
  for (const [id, value] of Object.entries(record)) {
    if (!hasKey(idMap, id) || hasKey(out, idMap[id])) continue
    out[idMap[id]] = value
  }
  return out
}

/**
 * The chosen keys with every reference to a file profile id moved to ours:
 * the profiles themselves, the active profile, the keychain seed
 * (`aiSecretsFrom`) and the repository bindings. Credentials ride on the
 * profiles and main files them by the id it is sent (`extractSecrets`), so
 * moving the id here is what puts a name-matched profile's tokens and keys
 * under our entry instead of a stray one. Pure.
 */
export function remapProfileIds(
  chosen: Partial<AppSettings>,
  idMap: Readonly<Record<string, string>>
): Partial<AppSettings> {
  if (Object.keys(idMap).length === 0) return chosen
  const out: Partial<AppSettings> = { ...chosen }
  if (chosen.profiles) out.profiles = chosen.profiles.map((p) => (p && hasKey(idMap, p.id) ? { ...p, id: idMap[p.id] } : p))
  if (chosen.activeProfileId) out.activeProfileId = mapId(idMap, chosen.activeProfileId)
  if (chosen.aiSecretsFrom) out.aiSecretsFrom = mapId(idMap, chosen.aiSecretsFrom)
  if (chosen.repoProfiles) {
    out.repoProfiles = Object.fromEntries(Object.entries(chosen.repoProfiles).map(([path, id]) => [path, mapId(idMap, id)]))
  }
  return out
}

/** Servers of one kind from both sides, keyed by URL: the file's entry wins on
 *  the same server, ours stays when the file does not list it. */
function unionServers<T extends { url: string; token: string }>(
  ours: T[] | undefined,
  theirs: T[] | undefined,
  normalize: (raw: string | undefined) => string | null
): T[] | undefined {
  if (!ours?.length) return theirs
  if (!theirs?.length) return ours
  // The same canonical form main files the token under: `ghe.corp` and
  // `https://ghe.corp/` are one server, not two.
  const key = (u: string): string => normalize(u) ?? u.trim().replace(/\/+$/, '').toLowerCase()
  const byUrl = new Map(ours.map((h) => [key(h.url), h]))
  const fromFile = new Set(theirs.map((h) => key(h.url)))
  // Same server, file exported without credentials: keep the token we hold for it.
  const merged = theirs.map((h) => {
    const mine = byUrl.get(key(h.url))
    return !h.token && mine?.token ? { ...h, token: mine.token } : h
  })
  return [...merged, ...ours.filter((h) => !fromFile.has(key(h.url)))]
}

/**
 * A matched profile's AI under 'merge': the file's settings, plus the accounts
 * only this machine has — dropping one would orphan its key in the keychain
 * with no way back to it from the UI.
 */
function mergeAIAccounts(ours: AIConfig | undefined, theirs: AIConfig | undefined): AIConfig {
  if (!theirs) return ours as AIConfig
  if (!ours?.accounts?.length) return theirs
  const fromFile = new Set((theirs.accounts ?? []).map((a) => a.id))
  const onlyHere = ours.accounts.filter((a) => !fromFile.has(a.id))
  return onlyHere.length ? { ...theirs, accounts: [...(theirs.accounts ?? []), ...onlyHere] } : theirs
}

const SCALAR_TOKENS = ['githubToken', 'azureToken', 'gitlabToken', 'bitbucketToken', 'forgejoToken'] as const

/**
 * A matched profile under 'merge': the file's data over ours, field by field.
 * Taking the file's copy whole would drop a server only this machine has — and
 * `pruneSecrets` would then delete its token. So server lists are a union, a
 * token the file carries blank (exported without credentials) keeps ours, and
 * the machine's own logins (`links`) stay ours — they name this computer's
 * credential helper, not the other one's.
 */
export function mergeProfileFields(ours: Profile, theirs: Profile): Profile {
  const merged: Profile = {
    ...theirs,
    githubEnterprise: unionServers(ours.githubEnterprise, theirs.githubEnterprise, normalizeGithubEnterpriseUrl),
    gitlabServers: unionServers(ours.gitlabServers, theirs.gitlabServers, normalizeGitlabServerUrl),
    bitbucketServers: unionServers(ours.bitbucketServers, theirs.bitbucketServers, normalizeBitbucketServerUrl),
    links: ours.links || theirs.links ? { ...theirs.links, ...ours.links } : undefined,
    ai: mergeAIAccounts(ours.ai, theirs.ai)
  }
  // A token is only worth keeping for the instance it was issued for: our
  // Forgejo token must never ride along to a different Forgejo URL, nor our
  // GitLab token to another issuer. (Main also refuses a mismatched issuer when
  // it restores a held token — `tokenMatchesInstance`.) An Azure PAT with a
  // different organization is left blank here so the profile shows what the
  // file says; main may still restore the held PAT, which only ever goes to
  // dev.azure.com.
  const sameTarget: Record<(typeof SCALAR_TOKENS)[number], boolean> = {
    githubToken: true,
    bitbucketToken: true,
    azureToken: (ours.azureOrg ?? '') === (theirs.azureOrg ?? ''),
    gitlabToken: (ours.gitlabTokenIssuer ?? '') === (theirs.gitlabTokenIssuer ?? ''),
    forgejoToken:
      (ours.forgejoUrl ?? '') === (theirs.forgejoUrl ?? '') &&
      (ours.forgejoTokenIssuer ?? '') === (theirs.forgejoTokenIssuer ?? '')
  }
  for (const k of SCALAR_TOKENS) {
    if (!merged[k] && ours[k] && sameTarget[k]) merged[k] = ours[k]
  }
  // Never add an optional key the profile did not have on either side.
  for (const k of ['githubEnterprise', 'gitlabServers', 'bitbucketServers', 'links'] as const) {
    if (merged[k] === undefined) delete merged[k]
  }
  return merged
}

/**
 * The profile list after an import, with `incoming` already on our ids
 * (`remapProfileIds`). 'merge': ours in our order, each one the file also has
 * replaced by the file's copy, then the file's new ones. 'replace': exactly
 * the file's list.
 */
export function mergeProfiles(current: Profile[], incoming: Profile[], mode: ProfileImportMode): Profile[] {
  const theirs = uniqueIncoming(incoming)
  if (mode === 'replace') return theirs
  const byId = new Map(theirs.map((p) => [p.id, p]))
  const kept = current.map((p) => {
    const match = byId.get(p.id)
    return match ? mergeProfileFields(p, match) : p
  })
  const ours = new Set(current.map((p) => p.id))
  return [...kept, ...theirs.filter((p) => !ours.has(p.id))]
}

/**
 * Which profile is active after the import. 'merge' keeps ours when it is
 * still there — merging should not change who this machine commits as —
 * else the file's, else the first. 'replace' lets the file decide, as a
 * restore always did: the file's when it is in the list, else ours, else the first.
 */
export function activeProfileAfterImport(
  profiles: readonly ProfileLike[],
  ours: string,
  theirs: string | undefined,
  mode: ProfileImportMode
): string {
  const has = (id: string | undefined): id is string => !!id && profiles.some((p) => p.id === id)
  const order = mode === 'merge' ? [ours, theirs] : [theirs, ours]
  return order.find(has) ?? profiles[0]?.id ?? ours
}

/**
 * The 'profiles' part of `chosen` (already on our ids) applied to `current`:
 * the `profiles` and `activeProfileId` keys to write over it.
 */
export function mergeProfilePart(
  current: AppSettings,
  chosen: Partial<AppSettings>,
  mode: ProfileImportMode
): Partial<AppSettings> {
  if (!chosen.profiles) return {}
  const profiles = mergeProfiles(current.profiles, chosen.profiles, mode)
  return {
    profiles,
    activeProfileId: activeProfileAfterImport(profiles, current.activeProfileId, chosen.activeProfileId, mode)
  }
}
