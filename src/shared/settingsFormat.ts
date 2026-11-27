/**
 * The settings file's format, and the rule that lets an older build write it
 * without losing what a newer build put there.
 *
 * Going back to an earlier version is only safe when that version keeps the
 * settings it does not know: a key a newer build added has to survive an older
 * build's save, untouched, so it is still there after updating again. This
 * module is that promise, in one place for main (which writes the file) and the
 * renderer (which builds what is saved). It covers top-level keys and a
 * profile's own fields; a field a newer build adds deeper inside a known
 * object (a theme, an AI account) lives or dies with that object's own code.
 *
 * The rule for secrets: a build never writes a credential into the settings
 * file — tokens and keys live in the keychain store (`main/keychain.ts`). So an
 * unknown key that holds something credential-shaped (`holdsSecret`) is never
 * carried: an older build drops the whole key rather than keep a newer build's
 * secret in plain text, or keep half an object it cannot vouch for. A future
 * build adding a credential field must store it in the keychain, as every
 * existing one does; if it did not, an older build would delete it on save.
 *
 * Retiring a key needs care too: a newer build that stops writing a key leaves
 * it on disk, and since it no longer knows it, it would carry it forever. Keep
 * a retired key listed here and delete it explicitly (as main does with
 * `pendingSecretClears`) — a removal list, not just a deleted line.
 */
import type { AppSettings, Profile } from './types'
import { isNewerVersion } from './version'
import { serverUrlWithoutSecrets } from './serverAddress'

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
  iconPalette: true,
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
  aiBehaviourShared: true,
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
  commentImagesFromOtherSites: true,
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
 * A key named like a credential: anchored to the end of the name, so
 * `githubToken`, `clientSecret` and `sessionCookie` match while `tokenColors`
 * or `cookieConsent` do not. A plural matches too (`maxTokens`), which is why
 * only a non-empty string under such a name counts (`holdsSecret`):
 * `maxTokens: 4096` and `password: true` are kept. An enum-like string under
 * such a name (`auth: 'oauth'`) does drop its key — accepted: conservative.
 */
const SECRET_SHAPED =
  /(?:token|secret|passw(?:or)?d|passphrase|api[-_]?key|private[-_]?key|access[-_]?key|signing[-_]?key|ssh[-_]?key|credentials?|bearer|cookie|jwt|auth|(?:^|[-_])pat|Pat|PAT)s?$/i
const PAT_ONLY = /pat$/i

export function isSecretShapedKey(key: string): boolean {
  // `pat` only as its own word (`githubPat`, `pat`, `repo_pat`) — never `compat`.
  if (PAT_ONLY.test(key) && !/(?:^|[-_])pat$|Pat$|PAT$/.test(key)) return false
  return SECRET_SHAPED.test(key)
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Query parameter names that carry a credential besides the credential-shaped ones. */
const SECRET_PARAMS = /^(?:key|sig|signature|code|x-amz-[a-z-]+|access_token|id_token)$/i

/**
 * An address carrying a credential: a user or password before the host, or a
 * query parameter whose *name* is a credential's (`?token=`, `?api_key=`,
 * `?sig=`). A fragment, or an ordinary query (`?ref=docs`), is not one.
 */
function isCredentialUrl(value: string): boolean {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    // Unparseable: only a userinfo-looking part counts.
    return /^[a-z][a-z0-9+.-]*:\/\/[^/?#\s]*@/i.test(value)
  }
  if (url.username || url.password) return true
  for (const name of url.searchParams.keys()) {
    if (isSecretShapedKey(name) || SECRET_PARAMS.test(name)) return true
  }
  return false
}

/**
 * Whether a value, under the name `key`, holds anything credential-shaped: a
 * non-empty string under a credential name, or an address with a credential
 * in it — at any depth.
 */
export function holdsSecret(key: string, value: unknown): boolean {
  if (typeof value === 'string') return (isSecretShapedKey(key) && value.trim() !== '') || isCredentialUrl(value)
  if (Array.isArray(value)) return value.some((v) => holdsSecret(key, v))
  if (isPlainObject(value)) return Object.entries(value).some(([k, v]) => holdsSecret(k, v))
  return false
}

/** The keys of a settings object this build does not know. */
export function unknownSettingsKeys(settings: object): string[] {
  return Object.keys(settings).filter((k) => !KNOWN_SETTINGS_KEYS.has(k))
}

/** A profile without the unknown fields that hold a secret; everything else as it is. */
function cleanProfile(profile: unknown): unknown {
  if (!isPlainObject(profile)) return profile
  let out: Record<string, unknown> | null = null
  for (const [k, v] of Object.entries(profile)) {
    if (KNOWN_PROFILE_KEYS.has(k) || !holdsSecret(k, v)) continue
    out ??= { ...profile }
    delete out[k]
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
 * - an unknown key, carried or kept, that holds a secret (`holdsSecret`) is
 *   dropped whole; any other is written exactly as it was;
 * - a profile's unknown fields get the same rule;
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
    if (holdsSecret(key, out[key])) delete out[key]
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
 * Lists of ids an older build filters to the ids it knows, as the graph
 * columns and the sidebar sections do: an entry only one side has is not the
 * user's change there, only the order of the ones both know is.
 */
const ID_ORDER_LISTS = new Set(['graphColumnOrder', 'sidebarOrder', 'sidebarHidden'])

/**
 * Whether the settings now still say what the backup said, as far as a user
 * could have changed it. Key order is ignored, and so is a field only `now`
 * has — an older build rewrites a profile over its own defaults, which is not
 * the user's doing. A field or list entry only the backup has *is* a change:
 * an older build keeps every key it does not know, so one gone was removed
 * (a shortcut, an alias, a favourite). Lists of plain values compare as sets
 * of entries, in order; `orderOnly` lists only by the entries both know.
 */
function sameSetting(backup: unknown, now: unknown, orderOnly = false): boolean {
  if (Array.isArray(backup) && Array.isArray(now)) {
    const plain = (x: unknown): boolean => x === null || typeof x !== 'object'
    if (backup.every(plain) && now.every(plain)) {
      const inBackup = new Set(backup)
      const inNow = new Set(now)
      if (!orderOnly && backup.some((x) => !inNow.has(x))) return false
      const a = backup.filter((x) => inNow.has(x))
      const b = now.filter((x) => inBackup.has(x))
      return orderOnly ? a.every((x, i) => x === b[i]) : a.length === now.length && a.every((x, i) => x === b[i])
    }
    return backup.length === now.length && backup.every((x, i) => sameSetting(x, now[i]))
  }
  if (isPlainObject(backup) && isPlainObject(now)) {
    return Object.keys(backup).every((k) => k in now && sameSetting(backup[k], now[k]))
  }
  return backup === now
}

/**
 * The top-level keys whose value differs between a backup and the settings now
 * (`sameSetting`), session keys aside. A key only `now` has is not counted: a
 * newer build adds its defaults on first start, and that is not a change the
 * user made. A key only the backup has is. Both sides must come without credentials (`stripSettingsSecrets`):
 * a token is never a setting that "changed".
 *
 * What it cannot tell: a value the older version did not recognise in a key it
 * knows (a newer theme id) and reset to its default reads as a change.
 */
export function changedSettingsKeys(backup: Record<string, unknown>, now: Record<string, unknown>): string[] {
  const changed: string[] = []
  for (const key of Object.keys(backup)) {
    if (SESSION.has(key)) continue
    // Gone altogether counts: nothing this build or an older one does removes a key.
    if (!(key in now) || !sameSetting(backup[key], now[key], ID_ORDER_LISTS.has(key))) changed.push(key)
  }
  return changed.sort()
}

/** A profile's server lists, matched by address. */
const SERVER_LISTS = ['githubEnterprise', 'gitlabServers', 'bitbucketServers'] as const

/** A server address as two spellings of the same server compare: no credential, case or trailing slash. */
function serverKey(url: unknown): string {
  return typeof url === 'string' ? serverUrlWithoutSecrets(url.trim()).replace(/\/+$/, '').toLowerCase() : ''
}

/** `copy`'s list with the entries only `now` has appended, matched by `keyOf`. */
function withAdded(copy: unknown, now: unknown, keyOf: (x: Record<string, unknown>) => unknown): unknown {
  const mine = Array.isArray(copy) ? copy : []
  const theirs = Array.isArray(now) ? now : []
  const known = new Set(mine.filter(isPlainObject).map(keyOf))
  const added = theirs.filter((x) => isPlainObject(x) && !known.has(keyOf(x)))
  return added.length ? [...mine, ...added] : copy
}

/** An AI config from the copy, keeping the accounts created since (their keys are filed by account id). */
function withAddedAccounts(copy: unknown, now: unknown): unknown {
  if (!isPlainObject(copy) || !isPlainObject(now)) return copy
  const accounts = withAdded(copy.accounts, now.accounts, (a) => a.id)
  return accounts === copy.accounts ? copy : { ...copy, accounts }
}

/**
 * A copy's profiles over today's: the copy's values win for every profile it
 * has, but a profile, a server or an AI account created since is kept — their
 * tokens and keys are filed under them in the keychain store, and the next
 * save would prune a token whose owner is gone, for good.
 */
function mergedProfiles(copy: unknown, now: unknown): unknown {
  if (!Array.isArray(now)) return copy
  // A copy without profiles (hand-edited, partial) restores none: today's stay.
  if (!Array.isArray(copy)) return now
  const nowById = new Map(now.filter(isPlainObject).map((p) => [p.id, p]))
  const out = copy.map((p) => {
    if (!isPlainObject(p)) return p
    const current = nowById.get(p.id)
    if (!current) return p
    const merged: Record<string, unknown> = { ...p }
    for (const list of SERVER_LISTS) {
      const kept = withAdded(p[list], current[list], (h) => serverKey(h.url))
      if (kept !== p[list] && Array.isArray(kept)) merged[list] = kept
    }
    const ai = withAddedAccounts(p.ai, current.ai)
    if (ai !== p.ai) merged.ai = ai
    return merged
  })
  const ids = new Set(copy.filter(isPlainObject).map((p) => p.id))
  return [...out, ...now.filter((p) => isPlainObject(p) && !ids.has(p.id))]
}

/**
 * A backup to restore over the settings now: its values, with the session keys
 * kept from `now`, and the profiles and servers added since kept too (`mergedProfiles`).
 */
export function restoredSettings(
  backup: Record<string, unknown>,
  now: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(backup)) if (!SESSION.has(k)) out[k] = v
  for (const k of SESSION_KEYS) if (k in now) out[k] = now[k]
  if ('profiles' in out || 'profiles' in now) out.profiles = mergedProfiles(out.profiles, now.profiles)
  // The general AI's accounts created since keep their keys, as a profile's do.
  if ('ai' in out) out.ai = withAddedAccounts(out.ai, now.ai)
  // The profile in use must still exist; one created since may be it.
  const ids = Array.isArray(out.profiles) ? out.profiles.filter(isPlainObject).map((p) => p.id) : []
  if (!ids.includes(out.activeProfileId) && ids.includes(now.activeProfileId)) out.activeProfileId = now.activeProfileId
  return out
}
