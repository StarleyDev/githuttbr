/**
 * The settings file's format, and the rule that lets an older build write it
 * without losing what a newer build put there.
 *
 * Going back to an earlier version is only safe when that version keeps the
 * settings it does not know: a key a newer build added has to survive an older
 * build's save, untouched, so it is still there after updating again. This
 * module is that promise, in one place for main (which writes the file) and the
 * renderer (which builds what is saved).
 *
 * The rule for secrets: a build never writes a credential into the settings
 * file — tokens and keys live in the keychain store (`main/keychain.ts`). So an
 * unknown key that looks like a credential is never carried: an older build
 * drops it rather than keep a newer build's secret in plain text. A future
 * build adding a credential field must store it in the keychain, as every
 * existing one does; if it did not, an older build would delete it on save.
 */
import type { AppSettings, Profile } from './types'
import { isNewerVersion } from './version'

/**
 * Bumped by a change that adds settings keys an earlier build would not know.
 * Add a row to `SETTINGS_FORMATS` with the keys and the last version released
 * before it (the `version` in package.json while you write it).
 */
export const SETTINGS_FORMAT = 1

export interface SettingsFormatRow {
  format: number
  /** The last released version that does not have this format: every version newer than it does. */
  introducedAfter: string
  /** Top-level keys this format added. A version before it keeps them without using them. */
  keys: string[]
}

/** Format 1 is where unknown keys started being kept; its keys are every earlier one. */
export const SETTINGS_FORMATS: readonly SettingsFormatRow[] = [{ format: 1, introducedAfter: '4.50.0', keys: [] }]

/**
 * Every top-level key this build knows. A mapped type, so adding a field to
 * `AppSettings` without listing it here fails the typecheck — a key missing
 * here would be treated as a newer build's.
 */
const KNOWN_SETTINGS: { [K in keyof Required<AppSettings>]: true } = {
  profiles: true,
  activeProfileId: true,
  repoProfiles: true,
  repoAliases: true,
  repoImages: true,
  tabRepoLabel: true,
  tabs: true,
  activeTabId: true,
  workspaces: true,
  activeWorkspaceId: true,
  recentRepos: true,
  repoScanRoots: true,
  favouriteRepos: true,
  repoSectionColors: true,
  pullMode: true,
  appThemeId: true,
  codeThemeId: true,
  themeMode: true,
  codeFontSize: true,
  iconColors: true,
  customAppThemes: true,
  customCodeThemes: true,
  language: true,
  initialCommitCount: true,
  loadMoreCount: true,
  autoLoadOnScroll: true,
  relativeDates: true,
  commitAvatars: true,
  githubAvatars: true,
  avatarMotion: true,
  fileListView: true,
  groupBranches: true,
  graphColumns: true,
  graphColumnOrder: true,
  graphStyle: true,
  customGraphPalettes: true,
  repoLayouts: true,
  repoTodos: true,
  repoBookmarks: true,
  analyzerMode: true,
  todosHideDone: true,
  todosManualOrder: true,
  autoFetchMinutes: true,
  desktopNotifications: true,
  confirmForcePush: true,
  mergeCommit: true,
  sidebarOrder: true,
  sidebarHidden: true,
  onboardingCompleted: true,
  aiAccountsNoticeSeen: true,
  ai: true,
  aiSecretsFrom: true,
  autoOpenChangelog: true,
  wipSnapshotMinutes: true,
  snapshotGuard: true,
  localCiEnabled: true,
  codegraphIndexWorktrees: true,
  worktreeAutoGroup: true,
  worktreeShortLabels: true,
  worktreeCopyIgnored: true,
  maskSecrets: true,
  showChangeGutter: true,
  showMinimap: true,
  enableLaunchJson: true,
  shortcuts: true,
  largeFileKb: true,
  warnOnClose: true,
  terminalPlacement: true,
  terminalCenterApplied: true,
  openTerminalOnRepoOpen: true,
  terminalThemeId: true,
  terminalFontSize: true,
  terminalFontFamily: true,
  terminalShell: true,
  terminalPoshTheme: true,
  tabSizing: true,
  sidebarSide: true,
  rightPanelFullHeight: true,
  lastClonePath: true,
  defaultOpenApp: true,
  editor: true,
  lastSeenVersion: true,
  skippedUpdateVersion: true,
  settingsFormat: true,
  versionRollback: true
}

/** The same, for a profile: a newer build may add a field to every profile. */
const KNOWN_PROFILE: { [K in keyof Required<Profile>]: true } = {
  id: true,
  name: true,
  gitName: true,
  gitEmail: true,
  githubToken: true,
  githubEnterprise: true,
  azureToken: true,
  azureOrg: true,
  gitlabToken: true,
  gitlabTokenIssuer: true,
  forgejoTokenIssuer: true,
  gitlabServers: true,
  gitlabUrl: true,
  bitbucketToken: true,
  bitbucketServers: true,
  forgejoToken: true,
  forgejoUrl: true,
  links: true,
  avatar: true,
  avatarRepoHintDismissed: true,
  ownAI: true,
  ai: true
}

export const KNOWN_SETTINGS_KEYS: ReadonlySet<string> = new Set(Object.keys(KNOWN_SETTINGS))
const KNOWN_PROFILE_KEYS: ReadonlySet<string> = new Set(Object.keys(KNOWN_PROFILE))

/**
 * A key named like a credential. Deliberately wide: losing an unknown
 * preference costs a re-tick, keeping a secret in plain text costs the secret.
 */
const SECRET_SHAPED = /token|secret|passw(?:or)?d|passphrase|api[-_]?key|private[-_]?key|credential|bearer|cookie/i

export function isSecretShapedKey(key: string): boolean {
  return SECRET_SHAPED.test(key)
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** A value with every credential-shaped key removed, at any depth. */
export function withoutSecretShaped(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecretShaped)
  if (!isPlainObject(value)) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (!isSecretShapedKey(k)) out[k] = withoutSecretShaped(v)
  }
  return out
}

/** The keys of a settings object this build does not know. */
export function unknownSettingsKeys(settings: object): string[] {
  return Object.keys(settings).filter((k) => !KNOWN_SETTINGS_KEYS.has(k))
}

/** A profile's unknown fields cleaned of credentials; the known ones as they are. */
function cleanProfile(profile: unknown): unknown {
  if (!isPlainObject(profile)) return profile
  let out: Record<string, unknown> | null = null
  for (const [k, v] of Object.entries(profile)) {
    if (KNOWN_PROFILE_KEYS.has(k)) continue
    out ??= { ...profile }
    if (isSecretShapedKey(k)) delete out[k]
    else out[k] = withoutSecretShaped(v)
  }
  return out ?? profile
}

/**
 * What a save writes, given what it was built from (`outgoing`) and the file as
 * it is on disk (`onDisk`, or null):
 *
 * - a key on disk this build does not know, and the save does not carry, is
 *   written back unchanged — a renderer that never received it (an import, a
 *   window loaded before) cannot drop it;
 * - an unknown key, carried or kept, is cleaned of anything credential-shaped,
 *   and dropped outright when its own name is;
 * - a profile's unknown fields get the same cleaning;
 * - the file is stamped with this build's `SETTINGS_FORMAT`.
 *
 * Known keys are never touched: their secrets are main's business
 * (`stripSettingsSecrets`), not this function's.
 */
export function withUnknownKeys<T extends object>(outgoing: T, onDisk: Record<string, unknown> | null): T {
  const out: Record<string, unknown> = { ...(outgoing as Record<string, unknown>) }
  if (onDisk) {
    for (const key of unknownSettingsKeys(onDisk)) {
      if (!(key in out)) out[key] = onDisk[key]
    }
  }
  for (const key of unknownSettingsKeys(out)) {
    if (isSecretShapedKey(key)) delete out[key]
    else out[key] = withoutSecretShaped(out[key])
  }
  if (Array.isArray(out.profiles)) out.profiles = out.profiles.map(cleanProfile)
  out.settingsFormat = SETTINGS_FORMAT
  return out as T
}

/**
 * Keys present in `settings` that `targetVersion` does not know, as far as this
 * build can tell: those added by a format introduced after it. Empty when the
 * target is this format or newer — and for every target while format 1 is the
 * only one, since a version before it is refused outright (see `shared/rollback.ts`).
 */
export function keysUnknownTo(targetVersion: string, settings: object): string[] {
  const present = new Set(Object.keys(settings))
  const keys: string[] = []
  for (const row of SETTINGS_FORMATS) {
    if (isNewerVersion(targetVersion, row.introducedAfter)) continue
    for (const k of row.keys) if (present.has(k)) keys.push(k)
  }
  return keys
}

/**
 * Keys a restore keeps as they are now, and a comparison ignores: what is open
 * (tabs, workspaces and their tabs, recent folders) and the app's own
 * bookkeeping. Restoring a copy should bring preferences back, not reopen the
 * tabs of a week ago or replay a version switch.
 */
export const SESSION_KEYS: readonly string[] = [
  'tabs',
  'activeTabId',
  'workspaces',
  'activeWorkspaceId',
  'recentRepos',
  'lastClonePath',
  'lastSeenVersion',
  'skippedUpdateVersion',
  'versionRollback',
  'settingsFormat',
  'terminalCenterApplied',
  'aiAccountsNoticeSeen'
]

const SESSION = new Set(SESSION_KEYS)

/**
 * The top-level keys whose value differs between a backup and the settings now,
 * session keys aside. A key only `now` has is not counted: a newer build adds
 * its defaults on first start, and that is not a change the user made.
 */
export function changedSettingsKeys(backup: Record<string, unknown>, now: Record<string, unknown>): string[] {
  const changed: string[] = []
  for (const key of Object.keys(backup)) {
    if (SESSION.has(key)) continue
    if (JSON.stringify(backup[key]) !== JSON.stringify(now[key])) changed.push(key)
  }
  return changed.sort()
}

/** A backup to restore over the settings now: its values, with the session keys kept from `now`. */
export function restoredSettings(
  backup: Record<string, unknown>,
  now: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(backup)) if (!SESSION.has(k)) out[k] = v
  for (const k of SESSION_KEYS) if (k in now) out[k] = now[k]
  return out
}
