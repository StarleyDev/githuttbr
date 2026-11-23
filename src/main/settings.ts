import { app, BrowserWindow, ipcMain, dialog, safeStorage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir, copyFile, rm } from 'fs/promises'
import { defaultSettings, type AccountLink, type AppSettings, type BitbucketServerTokenKind, type RepoHost } from '../shared/types'
import { validAccountLink } from '../shared/hostToken'
import {
  profileForgejoBase,
  tokenInstance,
  GITLAB_COM,
  gitlabAuthFor,
  gitlabServerBases,
  migrateGitlabSettings
} from '../shared/gitlabInstance'
import { setKnownForgejoInstances, setKnownGithubEnterpriseInstances, setKnownGitlabInstances } from './gitlabInstances'
import { GITHUB_COM, githubAuthFor, githubEnterpriseBases } from '../shared/githubEnterprise'
import { BITBUCKET_CLOUD, bitbucketAuthFor, bitbucketServerBases } from '../shared/bitbucketServer'
import { setKnownBitbucketServerInstances } from './bitbucketServerInstances'
import { resolveRemoteProvider, type ResolvedRemote } from '../shared/remoteProvider'
import {
  applySecrets,
  extractSecrets,
  hasSettingsSecrets,
  mergeSecretStores,
  pruneSecrets,
  stripSettingsSecrets,
  type SecretStore
} from '../shared/secrets'
import { accountFor, migrateAIConfig } from '../shared/aiAccounts'
import {
  adoptExistingConsent,
  canUseKeychain,
  ensureKeychain,
  getConsent,
  getConsentState,
  onKeychainDeclined,
  onKeychainEnabled,
  onSessionOnlyProbe
} from './keychain'

const settingsPath = (): string => join(app.getPath('userData'), 'gitcito-settings.json')
const secretsPath = (): string => join(app.getPath('userData'), 'gitcito-secrets.enc')
/**
 * A plain list of which token slots the encrypted store held, written by
 * builds that used it to let a locked peek fall back to a machine login. It
 * could go stale (an older build rewriting the store, a failed write) and it
 * named every GitHub Enterprise and GitLab server ever configured, including
 * removed ones — so it is no longer written, and a leftover copy is deleted.
 */
const legacySecretsIndexPath = (): string => join(app.getPath('userData'), 'gitcito-secrets.index.json')

export async function removeLegacySecretsIndex(): Promise<void> {
  await rm(legacySecretsIndexPath(), { force: true }).catch(() => undefined)
}

// Profile tokens and the AI API key used to sit in the settings JSON in plain
// text. They now live in a separate file encrypted with the OS keychain, the
// same mechanism the vault uses. Reads hydrate them back onto the profiles, so
// nothing downstream — renderer, export, git auth — sees a difference.
// Where the OS offers no encryption (a Linux box with no keyring), settings
// keep working exactly as before rather than losing the user's credentials.

/**
 * Tokens the user typed while the keychain was unavailable or refused. They
 * stay in this process only: the app keeps working for the session, and the
 * settings file on disk never gains a plaintext token behind the user's back.
 */
let sessionSecrets: SecretStore = {}

/**
 * Decrypted secrets for this run, or null while they are still on disk.
 *
 * Nothing hydrates them at start-up: reading the encrypted file means calling
 * safeStorage, and on macOS that pops the system keychain dialog before the
 * window has even painted — exactly the unexplained prompt this whole gate
 * exists to prevent. They are decrypted on the first operation that genuinely
 * needs a token (a push, a PR listing, opening Settings) instead.
 */
let secretCache: SecretStore | null = null

async function canEncrypt(): Promise<boolean> {
  // Never triggers an OS prompt: it only reports a consent already given.
  return canUseKeychain()
}

/**
 * An encrypted file exists on disk but this build's safeStorage key cannot read
 * it — a different app identity wrote it (dev vs packaged, or a re-signed
 * build). Distinct from "no secrets": overwriting that file with our empty view
 * of it would destroy tokens another build can still decrypt.
 */
let secretsUnreadable = false

/**
 * Whether the settings the renderer last loaded included the stored secrets.
 *
 * A renderer hydrated before any unlock persists a credential-less copy of the
 * settings on every mutation (a tab move, a repo opened). If a background
 * operation — a fetch resolving its token, an AI call resolving its key — has
 * unlocked the store in the meantime, treating such a save as "the user
 * cleared everything" overwrites the encrypted store with nothing. Only once
 * the renderer was actually served the secrets is an empty save a deletion.
 */
let servedSecrets = false

/**
 * A real unlock attempt this session found the keyring unusable: consent was
 * granted and explained, and `isEncryptionAvailable` said no (a Linux desktop
 * without Secret Service). The stored tokens are out of reach until the
 * keychain is turned on, so a peek stops waiting for them. Set only by
 * `readSettingsWithSecrets` — never by a peek, which must not touch
 * safeStorage at all, and never on the no-window path, which settles nothing.
 */
let keyringUnavailable = false
onKeychainEnabled(async () => {
  keyringUnavailable = false
})

/**
 * What a peek may read just changed (see peekView): the secrets were decrypted
 * for the first time this session, or the store went out of reach (declined,
 * or no keyring). Tell the windows, so pictures that were left "unknown" while
 * the store was locked ask again now instead of waiting out their retry. The
 * channel keeps its first name; the renderer treats both the same way.
 */
function announceUnlocked(): void {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('secrets:unlocked')
    }
  } catch {
    // No windows to tell (tests, shutdown).
  }
}

/** Installs the decrypted store for the session, and says so the first time. */
function setSecretCache(store: SecretStore): void {
  const first = !secretCache
  secretCache = store
  if (first) announceUnlocked()
}

async function loadSecrets(): Promise<SecretStore> {
  try {
    const b64 = await readFile(secretsPath(), 'utf-8')
    const store = JSON.parse(safeStorage.decryptString(Buffer.from(b64, 'base64'))) as SecretStore
    secretsUnreadable = false
    return store
  } catch {
    secretsUnreadable = existsSync(secretsPath())
    return {}
  }
}

async function saveSecrets(store: SecretStore): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  if (secretsUnreadable) {
    // Keep the copy we could not decrypt: the build identity that wrote it can
    // still read it, and this write would otherwise be the point of no return.
    await copyFile(secretsPath(), `${secretsPath()}.bak`).catch(() => {})
    secretsUnreadable = false
  }
  const enc = safeStorage.encryptString(JSON.stringify(store))
  await writeFile(secretsPath(), enc.toString('base64'), 'utf-8')
}

/** The settings JSON, with whatever secrets are already in memory applied. */
export async function readSettings(): Promise<AppSettings> {
  let settings: AppSettings
  try {
    const raw = await readFile(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    // Existing install without the key → treat as already onboarded.
    // A one-instance GitLab profile becomes a server list here, on every read —
    // the file is also written by imports and older builds (see withMigratedAI).
    settings = migrateGitlabSettings({ ...defaultSettings(), onboardingCompleted: true, ...parsed })
  } catch {
    return defaultSettings()
  }
  const out = withMigratedAI(applySecrets(settings, { ...(secretCache ?? {}), ...sessionSecrets }))
  setKnownGitlabInstances(gitlabServerBases(out.profiles))
  setKnownForgejoInstances(out.profiles.map((p) => p.forgejoUrl))
  setKnownGithubEnterpriseInstances(githubEnterpriseBases(out.profiles))
  setKnownBitbucketServerInstances(bitbucketServerBases(out.profiles))
  return out
}

/**
 * Brings every profile's AI config forward to the account model.
 *
 * Runs on read rather than as a one-shot upgrade step: the settings file is
 * also written by imports and by older builds sharing the same user data
 * directory, so "migrate whenever we read" is the only version that stays true.
 */
function withMigratedAI(settings: AppSettings): AppSettings {
  return {
    ...settings,
    profiles: (settings.profiles ?? []).map((p) => ({ ...p, ai: migrateAIConfig(p.ai) }))
  }
}

/**
 * Same, but decrypts the stored secrets first — asking for keychain access if
 * that has not been settled yet. Only call this from something the user just
 * did (opening Settings, a network git operation), never from start-up.
 */
async function readSettingsWithSecrets(reason: 'tokens' | 'settings' = 'tokens'): Promise<AppSettings> {
  const settings = await readSettings()
  if (secretCache) return settings
  // Git may already authenticate through its own helper or SSH. With no app
  // secrets to decrypt or migrate, touching Safe Storage only causes a needless prompt.
  if (!existsSync(secretsPath()) && !hasSettingsSecrets(settings)) return settings

  // An install that already has an encrypted secrets file predates the consent
  // gate — its owner answered the OS prompt long ago, so they are not asked to
  // decide again, only shown the explanation once.
  await adoptExistingConsent([secretsPath()])
  if (!(await ensureKeychain(reason))) {
    // Granted and explained after the attempt means safeStorage itself said no.
    // Unset or unexplained means no window was there to ask: nothing settled.
    const after = await getConsentState()
    if (after.consent === 'granted' && after.explained && !keyringUnavailable) {
      keyringUnavailable = true
      announceUnlocked()
    }
    return settings
  }

  const stored = await loadSecrets()
  if (hasSettingsSecrets(settings)) {
    // Upgrade from a plaintext settings file: the values on disk win, since
    // they are what the user last saved. Rewrite the JSON without them.
    const ids = (settings.profiles ?? []).map((p) => p.id)
    const merged = pruneSecrets({ ...stored, ...extractSecrets(settings) }, ids)
    await saveSecrets(merged)
    await writeFile(settingsPath(), JSON.stringify(stripSettingsSecrets(settings), null, 2), 'utf-8')
    setSecretCache(merged)
    return withMigratedAI(applySecrets(settings, merged))
  }
  setSecretCache(stored)
  return withMigratedAI(applySecrets(settings, { ...stored, ...sessionSecrets }))
}

/**
 * What a peek — a lookup nobody asked for — may read without decrypting:
 *
 * - `unlocked`: something the user did already decrypted the store this
 *   session, so the full settings are in memory (a PAT outranks a link).
 * - `plain`: there is no encrypted store to wait for this session — none on
 *   disk, consent declined, or an unlock attempt already found no usable
 *   keyring (`keyringUnavailable`). The plain settings, with session-only
 *   tokens and machine-login links, are then the whole truth.
 * - `locked`: anything else, consent granted but never explained included. The
 *   store may hold a token; a peek cannot know whether a PAT is in there, so it
 *   must not let a link stand in.
 *
 * Never calls safeStorage, not even `isEncryptionAvailable`: on macOS the first
 * real safeStorage call is what brings up the keychain prompt (see keychain.ts).
 */
async function peekView(): Promise<'unlocked' | 'plain' | 'locked'> {
  if (secretCache) return 'unlocked'
  if (!existsSync(secretsPath())) return 'plain'
  if ((await getConsent()) === 'declined' || keyringUnavailable) return 'plain'
  return 'locked'
}

const TOKEN_FIELD: Record<RepoHost, 'githubToken' | 'gitlabToken' | 'bitbucketToken' | 'azureToken' | 'forgejoToken'> = {
  github: 'githubToken',
  gitlab: 'gitlabToken',
  bitbucket: 'bitbucketToken',
  forgejo: 'forgejoToken',
  azure: 'azureToken'
}

/**
 * What one profile brings to a host's API: its PAT and its link to a machine
 * login (git's credential helper or the GitHub CLI). The link is plain settings,
 * but the PAT outranks it, so the secrets are always read — through the same
 * consent gate as `readSettingsWithSecrets`, which skips the keychain entirely when
 * no secrets file exists.
 */
async function profileAuth(
  host: RepoHost,
  profileId: string | undefined,
  remoteUrl?: string,
  expectedBase?: string,
  peek = false
): Promise<PeekedAuth> {
  const plain = await readSettings()
  const id = profileId ?? plain.activeProfileId
  const candidate = plain.profiles.find((p) => p.id === id) ?? (profileId !== undefined ? undefined : plain.profiles[0])
  if (!candidate) return {}
  // Which provider and server the remote is on, decided once across every
  // configured server list (`resolveRemoteProvider`). A remote that is another
  // provider's — a Data Center beside a GitLab on the same hostname — or whose
  // server cannot be told (ssh to a hostname two providers share) gets nothing.
  const onRemote = remoteUrl ? remoteServerOf(remoteUrl, plain.profiles) : null
  if (onRemote && onRemote.provider !== host) return {}
  if (remoteUrl && host !== 'azure' && !onRemote?.base) return {}
  const serverOfRemote = onRemote?.base
  // GitHub: github.com or one Enterprise Server, decided by the remote's host
  // (or the base a provider-level call names). Each gets only its own token.
  let githubBase: string | null = null
  if (host === 'github') {
    githubBase = expectedBase ?? (remoteUrl ? (serverOfRemote ?? null) : GITHUB_COM)
    if (!githubBase || (serverOfRemote && githubBase !== serverOfRemote)) return {}
    if (githubBase !== GITHUB_COM && !githubEnterpriseBases([candidate]).includes(githubBase)) return {}
  }
  // GitLab: gitlab.com or one of the profile's servers, decided by which known
  // instance the remote sits on (longest base first, so `host/gitlab` beats
  // `host`). Forgejo bases take part in the match too: a remote on a Forgejo
  // at the same host must not count as that host's GitLab.
  let gitlabBase: string | null = null
  if (host === 'gitlab') {
    gitlabBase = remoteUrl ? (serverOfRemote ?? null) : (expectedBase ?? GITLAB_COM)
    if (!gitlabBase || (expectedBase && gitlabBase !== expectedBase)) return {}
    if (gitlabBase !== GITLAB_COM && !gitlabServerBases([candidate]).includes(gitlabBase)) return {}
  }
  // Bitbucket: bitbucket.org or one Data Center, the same way — by the remote's
  // host and context path, or the base a provider-level call names.
  let bitbucketBase: string | null = null
  if (host === 'bitbucket') {
    bitbucketBase = expectedBase ?? (remoteUrl ? (serverOfRemote ?? null) : BITBUCKET_CLOUD)
    if (!bitbucketBase || (serverOfRemote && bitbucketBase !== serverOfRemote)) return {}
    if (bitbucketBase !== BITBUCKET_CLOUD && !bitbucketServerBases([candidate]).includes(bitbucketBase)) return {}
  }
  if (host === 'forgejo') {
    const base = tokenInstance(host, candidate.forgejoUrl)
    if (!base || (expectedBase && base !== expectedBase)) return {}
    if (remoteUrl && serverOfRemote !== base) return {}
  }
  // A peek never decrypts (see peekView).
  const view = peek ? await peekView() : 'unlocked'
  const settings = view === 'unlocked' ? await readSettingsWithSecrets('tokens') : plain
  const profile = settings.profiles.find((p) => p.id === id) ?? (profileId !== undefined ? undefined : settings.profiles[0])
  if (!profile) return {}
  const auth = authFrom(settings, profile, host, remoteUrl, expectedBase, githubBase, gitlabBase, bitbucketBase)
  // Checked after the plain-settings gates, so "locked" never stands in for "no such server".
  // A token already in the plain view — typed this session, or not yet migrated
  // off disk — wins over the stored one on unlock, so it is the answer either way.
  if (view === 'locked' && auth && !auth.token) return { locked: true }
  return auth ?? {}
}

/** `profileAuth`'s answer from settings already read, or null when the remote is not this profile's. */
function authFrom(
  settings: AppSettings,
  profile: AppSettings['profiles'][number],
  host: RepoHost,
  remoteUrl: string | undefined,
  expectedBase: string | undefined,
  githubBase: string | null,
  gitlabBase: string | null,
  bitbucketBase: string | null
): { token?: string; link?: AccountLink; username?: string; tokenKind?: BitbucketServerTokenKind } | null {
  if (host === 'forgejo') {
    const base = tokenInstance(host, profile.forgejoUrl)
    if (!base || (expectedBase && base !== expectedBase)) return null
    if (remoteUrl) {
      const on = remoteServerOf(remoteUrl, settings.profiles)
      if (on?.provider !== 'forgejo' || on.base !== base) return null
    }
  }
  if (host === 'gitlab' && gitlabBase) {
    // Re-checked on the decrypted settings: they are the ones the token comes from.
    if (remoteUrl && gitlabBaseOfRemote(remoteUrl, settings.profiles) !== gitlabBase) return null
    const auth = gitlabAuthFor(profile, gitlabBase)
    return { token: auth.token, link: validAccountLink(auth.link) }
  }
  if (host === 'github' && githubBase) {
    const auth = githubAuthFor(profile, githubBase)
    return { token: auth.token, link: validAccountLink(auth.link) }
  }
  if (host === 'bitbucket' && bitbucketBase) {
    const auth = bitbucketAuthFor(profile, bitbucketBase)
    const link = validAccountLink(auth.link)
    return {
      ...(auth.token ? { token: auth.token } : {}),
      ...(link ? { link } : {}),
      ...(auth.username ? { username: auth.username } : {}),
      ...(auth.tokenKind ? { tokenKind: auth.tokenKind } : {})
    }
  }
  const link = validAccountLink(profile.links?.[host])
  const token = profile[TOKEN_FIELD[host]]?.trim() || undefined
  return { token, link }
}

/**
 * Which provider and server a remote is on, across every server the profiles
 * configure — the same rule `parseRemoteUrl` and the git network calls use,
 * here over the settings being read rather than the synchronous registries.
 */
function remoteServerOf(remoteUrl: string, profiles: AppSettings['profiles']): ResolvedRemote | null {
  return resolveRemoteProvider(remoteUrl, {
    gitlab: gitlabServerBases(profiles),
    forgejo: profiles.map((p) => profileForgejoBase(p.forgejoUrl)).filter((b): b is string => !!b),
    githubEnterprise: githubEnterpriseBases(profiles),
    bitbucketServer: bitbucketServerBases(profiles)
  })
}

/**
 * The GitLab whose credentials a remote may receive: gitlab.com, or a server
 * some profile names — null for any other host, or one another provider's
 * server claims (a Forgejo or a Data Center at the same hostname).
 */
function gitlabBaseOfRemote(remoteUrl: string, profiles: AppSettings['profiles']): string | null {
  const on = remoteServerOf(remoteUrl, profiles)
  return on?.provider === 'gitlab' ? (on.base ?? null) : null
}

/** The active profile's PAT and link for a host. */
export function activeProfileAuth(
  host: RepoHost,
  remoteUrl?: string,
  expectedBase?: string
): Promise<{ token?: string; link?: AccountLink; username?: string; tokenKind?: BitbucketServerTokenKind }> {
  return profileAuth(host, undefined, remoteUrl, expectedBase)
}

/** Credentials as a peek sees them: `locked` when the tokens are still encrypted and were left that way. */
export interface PeekedAuth {
  token?: string
  link?: AccountLink
  username?: string
  tokenKind?: BitbucketServerTokenKind
  locked?: true
}

/**
 * `activeProfileAuth` for lookups nobody asked for — a picture in the title
 * bar, a commit author's avatar. It never decrypts: while the store is still
 * locked it answers `{ locked: true }`, so the caller treats the answer as
 * unknown and asks again after something the user did has unlocked it. With no
 * store to wait for (see peekView) it answers from the plain settings — a
 * machine-login link or a session-only token — right away.
 */
export function peekActiveProfileAuth(host: RepoHost, remoteUrl?: string, expectedBase?: string): Promise<PeekedAuth> {
  return profileAuth(host, undefined, remoteUrl, expectedBase, true)
}

/**
 * One named profile's PAT and link for a host — the clone dialog's pick. An
 * empty id or one no profile has gets nothing, never the active profile's or
 * the first one's. `expectedBase` is the server a provider-level call (the
 * dialog's repository list) names, as for `activeProfileAuth`.
 */
export function namedProfileAuth(
  host: RepoHost,
  profileId: string,
  remoteUrl?: string,
  expectedBase?: string
): Promise<{ token?: string; link?: AccountLink; username?: string; tokenKind?: BitbucketServerTokenKind }> {
  if (!profileId.trim()) return Promise.resolve({})
  return profileAuth(host, profileId, remoteUrl, expectedBase)
}

/**
 * A profile id off the IPC boundary, normalised once for every call that takes
 * one (clone, the branch list, the repository and account lists, create): a
 * string names a profile — an empty or unknown one names nobody, and gets
 * nothing; anything else means "no profile named", which is the active one.
 */
export function asProfileIdArg(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** Whether some profile has this id — an empty or unknown one names nobody. */
export async function isProfileId(profileId: unknown): Promise<boolean> {
  if (typeof profileId !== 'string' || !profileId.trim()) return false
  return (await readSettings()).profiles.some((p) => p.id === profileId)
}

/** The Forgejo instance of exactly this profile, or null — never another profile's for an unknown id. */
export async function namedProfileForgejoInstance(profileId: string): Promise<string | null> {
  if (!profileId.trim()) return null
  const profile = (await readSettings()).profiles.find((p) => p.id === profileId)
  return profileForgejoBase(profile?.forgejoUrl)
}

/** The Forgejo instance a profile (the active one by default) points at, or null. */
export async function profileForgejoInstance(profileId?: string): Promise<string | null> {
  const plain = await readSettings()
  const profile =
    (profileId ? plain.profiles.find((p) => p.id === profileId) : undefined) ??
    plain.profiles.find((p) => p.id === plain.activeProfileId) ??
    plain.profiles[0]
  return profileForgejoBase(profile?.forgejoUrl)
}

/**
 * Every profile's PAT and link for a host, with its name — for "is this account
 * already another profile's?", which has to see tokens the renderer may not
 * have decrypted (the onboarding wizard runs before any `settings:unlock`).
 */
export async function allProfileAuth(
  host: RepoHost
): Promise<Array<{ id: string; name: string; token?: string; link?: AccountLink; azureOrg?: string; forgejoUrl?: string }>> {
  const settings = await readSettingsWithSecrets('tokens')
  return settings.profiles.map((p) => ({
    id: p.id,
    name: p.name,
    // GitLab: gitlab.com's credentials — the only GitLab a sign-in links.
    token: (host === 'gitlab' ? gitlabAuthFor(p, GITLAB_COM).token : p[TOKEN_FIELD[host]])?.trim() || undefined,
    link: validAccountLink(p.links?.[host]),
    azureOrg: p.azureOrg?.trim() || undefined,
    forgejoUrl: p.forgejoUrl?.trim() || undefined
  }))
}

/**
 * The PAT and link of the profile a repository is explicitly bound to.
 * Undefined when the repository is not bound (or its profile was deleted), so
 * "bound, with nothing configured" stays distinct from "not bound".
 */
export async function boundProfileAuth(
  host: RepoHost,
  repoPath: string,
  remoteUrl?: string
): Promise<{ token?: string; link?: AccountLink; username?: string; tokenKind?: BitbucketServerTokenKind } | undefined> {
  const plain = await readSettings()
  const boundId = plain.repoProfiles?.[repoPath]
  if (!boundId || !plain.profiles.some((p) => p.id === boundId)) return undefined
  return profileAuth(host, boundId, remoteUrl)
}

/** The name of the profile a repository is explicitly bound to, or undefined when it is not bound. */
export async function boundProfileName(repoPath: string): Promise<string | undefined> {
  const plain = await readSettings()
  const boundId = plain.repoProfiles?.[repoPath]
  return boundId ? plain.profiles.find((p) => p.id === boundId)?.name : undefined
}

/** `boundProfileAuth` that never decrypts — see `peekActiveProfileAuth`. */
export async function peekBoundProfileAuth(
  host: RepoHost,
  repoPath: string,
  remoteUrl?: string
): Promise<PeekedAuth | undefined> {
  const plain = await readSettings()
  const boundId = plain.repoProfiles?.[repoPath]
  if (!boundId || !plain.profiles.some((p) => p.id === boundId)) return undefined
  return profileAuth(host, boundId, remoteUrl, undefined, true)
}

/**
 * The API key for one AI account of the active profile, or undefined when none
 * is configured.
 *
 * The renderer only ever sees these keys after the user opens Settings (that is
 * the one call that unlocks). Every other AI action starts from a store that
 * was hydrated with `settings:get`, whose keys are still encrypted on disk — so
 * the main process resolves them here instead, exactly like `profileAuth`
 * does for git. Without this, AI features fail on every fresh launch until
 * Settings has been opened once.
 *
 * `accountId` comes from the resolved config the renderer sent, so a feature
 * pointed at a second account authenticates with *that* account's key rather
 * than whichever one happens to be the default.
 */
export async function activeProfileAiKey(accountId?: string): Promise<string | undefined> {
  // Nothing stored means nothing to decrypt: never ask for keychain access to
  // discover that the user has no key.
  if (!secretCache && !existsSync(secretsPath())) return undefined
  const settings = await readSettingsWithSecrets('tokens')
  const profile = settings.profiles.find((p) => p.id === settings.activeProfileId) ?? settings.profiles[0]
  if (!profile?.ai) return undefined
  const account = accountId
    ? profile.ai.accounts?.find((a) => a.id === accountId)
    : accountFor(profile.ai)
  const key = account?.apiKey ?? profile.ai.apiKey
  return key && key.trim() ? key.trim() : undefined
}

/**
 * Move the tokens held in memory into the encrypted store. They are there
 * because they were typed while the keychain was off; without this, turning it
 * on changed nothing until some other setting happened to be saved, and
 * quitting before that lost them again.
 */
async function persistSessionSecrets(): Promise<void> {
  if (Object.keys(sessionSecrets).length === 0) return
  const ids = (await readSettings()).profiles.map((p) => p.id)
  const stored = secretCache ?? (await loadSecrets())
  const merged = pruneSecrets(mergeSecretStores(stored, sessionSecrets), ids)
  await saveSecrets(merged)
  setSecretCache(merged)
  sessionSecrets = {}
}
onKeychainEnabled(persistSessionSecrets)
onKeychainDeclined(announceUnlocked)

/** True while some token exists only in memory and would be lost on quit. */
export function hasSessionOnlySecrets(): boolean {
  return Object.keys(sessionSecrets).length > 0
}
onSessionOnlyProbe(hasSessionOnlySecrets)

async function writeSettings(incoming: AppSettings): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  // An import or an older renderer may still send the one-instance shape.
  const settings = migrateGitlabSettings(incoming)
  setKnownGitlabInstances(gitlabServerBases(settings.profiles))
  setKnownForgejoInstances(settings.profiles.map((p) => p.forgejoUrl))
  setKnownGithubEnterpriseInstances(githubEnterpriseBases(settings.profiles))
  setKnownBitbucketServerInstances(bitbucketServerBases(settings.profiles))
  const secrets = extractSecrets(settings)
  const hasSecrets = Object.keys(secrets).length > 0
  const stripped = JSON.stringify(stripSettingsSecrets(settings), null, 2)

  // A credential-less save must not wipe the store unless the renderer was
  // actually holding the credentials (`servedSecrets`) — otherwise it simply
  // never had them to send back. Same while they are still encrypted on disk,
  // and when the file exists but this build could not decrypt it: our empty
  // view of the store is not the truth, and persisting it would erase the
  // real one.
  if (!hasSecrets && (!servedSecrets || !secretCache || secretsUnreadable)) {
    await writeFile(settingsPath(), stripped, 'utf-8')
    return
  }

  // Saving a token is the moment worth asking about — and only then. A settings
  // write with nothing sensitive in it never goes near the keychain.
  const allowed = hasSecrets ? await ensureKeychain('tokens') : await canEncrypt()

  if (!allowed) {
    // Refused (or no keyring): hold the secrets in memory for this session and
    // keep them out of the file, rather than writing them in the clear.
    if (hasSecrets) sessionSecrets = mergeSecretStores(sessionSecrets, secrets)
    await writeFile(settingsPath(), stripped, 'utf-8')
    return
  }
  // Secrets first: if the keychain write fails, the JSON on disk still holds the
  // previous values instead of being stripped with nowhere to read them from.
  //
  // A renderer that was served the secrets is authoritative: clearing a token
  // in the UI removes it here too, and so does deleting a profile. One that
  // never saw them can only add — its save is overlaid on the stored values,
  // so the credentials it was never given survive.
  const ids = (settings.profiles ?? []).map((p) => p.id)
  const base = servedSecrets ? {} : (secretCache ?? (await loadSecrets()))
  const merged = pruneSecrets(mergeSecretStores(base, secrets), ids)
  await saveSecrets(merged)
  setSecretCache(merged)
  sessionSecrets = {}
  await writeFile(settingsPath(), stripped, 'utf-8')
}

// Dev aid: launching with GITCITO_FORCE_ONBOARDING=1 re-runs the first-run
// wizard without touching the settings file. The flag holds until the wizard
// itself saves its completion (consuming it per read breaks under StrictMode's
// double hydration), so a reload before finishing shows the wizard again.
let forceOnboarding = process.env['GITCITO_FORCE_ONBOARDING'] === '1'

function withForcedOnboarding(settings: AppSettings): AppSettings {
  return forceOnboarding ? { ...settings, onboardingCompleted: false } : settings
}

export function registerSettingsHandlers(): void {
  void removeLegacySecretsIndex()
  ipcMain.handle('settings:get', async () => {
    const settings = withForcedOnboarding(await readSettings())
    servedSecrets = hasSettingsSecrets(settings)
    return settings
  })
  ipcMain.handle('settings:set', (_e, settings: AppSettings) => {
    if (settings.onboardingCompleted) forceOnboarding = false
    return writeSettings(settings)
  })
  // Called when the user opens Settings: that is an explicit "show me my
  // credentials", so it is a fair moment to decrypt (and to ask, if needed).
  ipcMain.handle('settings:unlock', async () => {
    const settings = withForcedOnboarding(await readSettingsWithSecrets('settings'))
    servedSecrets = hasSettingsSecrets(settings)
    return settings
  })

  ipcMain.handle('settings:importFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Settings',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return null
    try {
      const raw = await readFile(filePaths[0], 'utf-8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  })

  ipcMain.handle('settings:exportFile', async (_e, data: unknown) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Settings',
      defaultPath: 'gitcito-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return false
    try {
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch {
      return false
    }
  })
}
