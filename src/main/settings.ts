import { app, ipcMain, dialog, safeStorage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { copyPrivateFile, writePrivateFile } from './privateFile'
import { defaultSettings, type AccountLink, type AppSettings, type RepoHost } from '../shared/types'
import { validAccountLink } from '../shared/hostToken'
import { profileForgejoBase, profileGitlabBase, instanceOf, tokenInstance, GITLAB_COM } from '../shared/gitlabInstance'
import { setKnownForgejoInstances, setKnownGitlabInstances } from './gitlabInstances'
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
  onKeychainEnabled,
  onSessionOnlyProbe
} from './keychain'

const settingsPath = (): string => join(app.getPath('userData'), 'gitcito-settings.json')
const secretsPath = (): string => join(app.getPath('userData'), 'gitcito-secrets.enc')

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
 * Every `settings:get` / `settings:unlock` reply gets a new generation, and the
 * renderer names the one its state was built from when it saves. Only a save
 * from the latest reply can clear credentials: a debounced save scheduled
 * before an unlock but landing after it carries the pre-unlock blanks, and
 * `servedSecrets` alone would read those as "the user cleared every token".
 */
let lastGeneration = 0

/** How a `settings:set` came about. An import never clears a credential the file does not carry. */
export interface SaveOptions {
  /** `merge` adds the file's credentials; `replace` (user-confirmed) makes them the only ones. */
  import?: 'merge' | 'replace'
}

function generationArg(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : -1
}

function saveOptionsArg(value: unknown): SaveOptions {
  const mode = value && typeof value === 'object' ? (value as { import?: unknown }).import : undefined
  return mode === 'merge' || mode === 'replace' ? { import: mode } : {}
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
    await copyPrivateFile(secretsPath(), `${secretsPath()}.bak`).catch(() => {})
    secretsUnreadable = false
  }
  const enc = safeStorage.encryptString(JSON.stringify(store))
  await writePrivateFile(secretsPath(), enc.toString('base64'))
}

/** The settings JSON, with whatever secrets are already in memory applied. */
export async function readSettings(): Promise<AppSettings> {
  const parsed = await readSettingsFile()
  if (!parsed) return defaultSettings()
  // Existing install without the key → treat as already onboarded.
  const settings: AppSettings = { ...defaultSettings(), onboardingCompleted: true, ...parsed }
  const out = withMigratedAI(applySecrets(settings, { ...(secretCache ?? {}), ...sessionSecrets }))
  setKnownGitlabInstances(out.profiles.map((p) => p.gitlabUrl))
  setKnownForgejoInstances(out.profiles.map((p) => p.forgejoUrl))
  return out
}

const READ_RETRIES = 4

/**
 * The parsed settings file, or null when there is none yet.
 *
 * A file that exists but does not parse is never answered with defaults: a
 * renderer hydrated from them would save them over the user's real settings.
 * Writes are atomic now, but an older build sharing the data folder still
 * writes in place, so a bad read is retried briefly before it becomes an error.
 */
async function readSettingsFile(): Promise<Partial<AppSettings> | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const parsed: unknown = JSON.parse(await readFile(settingsPath(), 'utf-8'))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('settings file is not an object')
      return parsed as Partial<AppSettings>
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      if (attempt >= READ_RETRIES) throw new Error(`Could not read ${settingsPath()}: ${(err as Error).message}`)
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1)))
    }
  }
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
  if (!(await ensureKeychain(reason))) return settings

  const stored = await loadSecrets()
  if (hasSettingsSecrets(settings)) {
    // Upgrade from a plaintext settings file: the values on disk win, since
    // they are what the user last saved. Rewrite the JSON without them.
    const ids = (settings.profiles ?? []).map((p) => p.id)
    const merged = pruneSecrets({ ...stored, ...extractSecrets(settings) }, ids)
    await saveSecrets(merged)
    await writePrivateFile(settingsPath(), JSON.stringify(stripSettingsSecrets(settings), null, 2))
    secretCache = merged
    return withMigratedAI(applySecrets(settings, merged))
  }
  secretCache = stored
  return withMigratedAI(applySecrets(settings, { ...stored, ...sessionSecrets }))
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
  expectedBase?: string
): Promise<{ token?: string; link?: AccountLink }> {
  const plain = await readSettings()
  const id = profileId ?? plain.activeProfileId
  const candidate = plain.profiles.find((p) => p.id === id) ?? (profileId ? undefined : plain.profiles[0])
  if (!candidate) return {}
  if (host === 'gitlab' || host === 'forgejo') {
    const base = tokenInstance(host, candidate[`${host}Url`])
    if (!base || (expectedBase && base !== expectedBase)) return {}
    if (remoteUrl && instanceOf(remoteUrl, [base])?.base !== base) return {}
  }
  const settings = await readSettingsWithSecrets('tokens')
  const profile = settings.profiles.find((p) => p.id === id) ?? (profileId ? undefined : settings.profiles[0])
  if (!profile) return {}
  if (host === 'gitlab' || host === 'forgejo') {
    const base = tokenInstance(host, profile[`${host}Url`])
    if (!base || (expectedBase && base !== expectedBase)) return {}
    if (remoteUrl) {
      const bases = [GITLAB_COM, ...settings.profiles.flatMap((p) =>
        [profileForgejoBase(p.forgejoUrl), profileGitlabBase(p.gitlabUrl)].filter((b): b is string => !!b)
      )]
      if (instanceOf(remoteUrl, bases)?.base !== base) return {}
    }
  }
  const link = validAccountLink(profile.links?.[host])
  const token = profile[TOKEN_FIELD[host]]?.trim() || undefined
  return { token, link }
}

/** The active profile's PAT and link for a host. */
export function activeProfileAuth(host: RepoHost, remoteUrl?: string, expectedBase?: string): Promise<{ token?: string; link?: AccountLink }> {
  return profileAuth(host, undefined, remoteUrl, expectedBase)
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

/** The GitLab instance a profile (the active one by default) is connected to. */
export async function profileGitlabInstance(profileId?: string): Promise<string> {
  const plain = await readSettings()
  const profile =
    (profileId ? plain.profiles.find((p) => p.id === profileId) : undefined) ??
    plain.profiles.find((p) => p.id === plain.activeProfileId) ??
    plain.profiles[0]
  return profileGitlabBase(profile?.gitlabUrl)
}

/**
 * Every profile's PAT and link for a host, with its name — for "is this account
 * already another profile's?", which has to see tokens the renderer may not
 * have decrypted (the onboarding wizard runs before any `settings:unlock`).
 */
export async function allProfileAuth(
  host: RepoHost
): Promise<Array<{ id: string; name: string; token?: string; link?: AccountLink; azureOrg?: string; gitlabUrl?: string; forgejoUrl?: string }>> {
  const settings = await readSettingsWithSecrets('tokens')
  return settings.profiles.map((p) => ({
    id: p.id,
    name: p.name,
    token: p[TOKEN_FIELD[host]]?.trim() || undefined,
    link: validAccountLink(p.links?.[host]),
    azureOrg: p.azureOrg?.trim() || undefined,
    gitlabUrl: p.gitlabUrl?.trim() || undefined,
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
): Promise<{ token?: string; link?: AccountLink } | undefined> {
  const plain = await readSettings()
  const boundId = plain.repoProfiles?.[repoPath]
  if (!boundId || !plain.profiles.some((p) => p.id === boundId)) return undefined
  return profileAuth(host, boundId, remoteUrl)
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
  secretCache = merged
  sessionSecrets = {}
}
onKeychainEnabled(persistSessionSecrets)

/** True while some token exists only in memory and would be lost on quit. */
export function hasSessionOnlySecrets(): boolean {
  return Object.keys(sessionSecrets).length > 0
}
onSessionOnlyProbe(hasSessionOnlySecrets)

/** `generation` is the reply the renderer's state was built from (-1: unknown). */
async function writeSettings(
  settings: AppSettings,
  generation = -1,
  options: SaveOptions = {}
): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  setKnownGitlabInstances(settings.profiles.map((p) => p.gitlabUrl))
  setKnownForgejoInstances(settings.profiles.map((p) => p.forgejoUrl))
  const secrets = extractSecrets(settings)
  const hasSecrets = Object.keys(secrets).length > 0
  const stripped = JSON.stringify(stripSettingsSecrets(settings), null, 2)

  // Whether a blank token in this save means "the user cleared it". Only for a
  // save built on the latest reply that actually carried the credentials — a
  // stale one (scheduled before an unlock) never had them to send back. An
  // import is never that: a file without a token is not a request to delete
  // it. Only an explicit "Replace all", with a file that carries credentials,
  // replaces the stored ones.
  const replacing = options.import === 'replace' && hasSecrets
  const authoritative = replacing || (!options.import && servedSecrets && generation === lastGeneration)
  // An import changes what the renderer holds without a new reply: its next
  // ordinary save must not be read as clears until it has reloaded.
  if (options.import) lastGeneration++

  // A credential-less save must not wipe the store unless it is authoritative.
  // Same while they are still encrypted on disk, and when the file exists but
  // this build could not decrypt it: our empty view of the store is not the
  // truth, and persisting it would erase the real one.
  if (!hasSecrets && (!authoritative || !secretCache || secretsUnreadable)) {
    await writePrivateFile(settingsPath(), stripped)
    return
  }

  // Saving a token is the moment worth asking about — and only then. A settings
  // write with nothing sensitive in it never goes near the keychain.
  const allowed = hasSecrets ? await ensureKeychain('tokens') : await canEncrypt()

  if (!allowed) {
    // Refused (or no keyring): hold the secrets in memory for this session and
    // keep them out of the file, rather than writing them in the clear.
    if (hasSecrets) sessionSecrets = mergeSecretStores(sessionSecrets, secrets)
    await writePrivateFile(settingsPath(), stripped)
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
  const base = authoritative ? {} : (secretCache ?? (await loadSecrets()))
  const merged = pruneSecrets(mergeSecretStores(base, secrets), ids)
  await saveSecrets(merged)
  secretCache = merged
  sessionSecrets = {}
  await writePrivateFile(settingsPath(), stripped)
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
  ipcMain.handle('settings:get', async () => {
    const settings = withForcedOnboarding(await readSettings())
    servedSecrets = hasSettingsSecrets(settings)
    return { settings, generation: ++lastGeneration }
  })
  ipcMain.handle('settings:set', (_e, settings: AppSettings, generation?: unknown, options?: unknown) => {
    if (settings.onboardingCompleted) forceOnboarding = false
    return writeSettings(settings, generationArg(generation), saveOptionsArg(options))
  })
  // Called when the user opens Settings: that is an explicit "show me my
  // credentials", so it is a fair moment to decrypt (and to ask, if needed).
  ipcMain.handle('settings:unlock', async () => {
    const settings = withForcedOnboarding(await readSettingsWithSecrets('settings'))
    servedSecrets = hasSettingsSecrets(settings)
    return { settings, generation: ++lastGeneration }
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
