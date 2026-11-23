import { app, ipcMain, dialog, safeStorage } from 'electron'
import { basename, join } from 'path'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir, rename } from 'fs/promises'
import { copyPrivateFile, writePrivateFile } from './privateFile'
import {
  defaultSettings,
  type AccountLink,
  type AppSettings,
  type RepoHost,
  type SettingsErrorKind,
  type SettingsRefusal,
  type MoveAsideReply
} from '../shared/types'
import { validAccountLink } from '../shared/hostToken'
import { profileForgejoBase, profileGitlabBase, instanceOf, tokenInstance, GITLAB_COM } from '../shared/gitlabInstance'
import { setKnownForgejoInstances, setKnownGitlabInstances } from './gitlabInstances'
import {
  applySecrets,
  dropSecretSlots,
  extractSecrets,
  fromSecretSlots,
  hasSettingsSecrets,
  mergeSecretStores,
  secretSlots,
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
 * Credentials the user cleared while the keychain could not be written (see
 * `secretSlots`). The encrypted store still holds them; they are masked out of
 * every view and deleted from the store the moment it becomes writable.
 *
 * Held in memory only, on purpose: a quit before the keychain comes back
 * brings the cleared token back on the next launch. Persisting the clears
 * meant writing from readers that run outside the settings queue, and acting
 * on ids an older build could have left behind for a token saved since.
 */
const tombstones = new Set<string>()
/**
 * Slot ids a v4.37.2 pre-release kept in the settings file. Never acted on:
 * dropped on read and on write, so the next ordinary save removes them.
 */
const STALE_PENDING_CLEARS = 'pendingSecretClears'

/** The settings file as written: no secrets, and nothing main once kept there for itself. */
function settingsFileJson(settings: AppSettings): string {
  const out: Record<string, unknown> = { ...stripSettingsSecrets(settings) }
  delete out[STALE_PENDING_CLEARS]
  return JSON.stringify(out, null, 2)
}

/** A store read from disk, minus what the user cleared while it was out of reach. */
function adopt(store: SecretStore): SecretStore {
  return tombstones.size ? dropSecretSlots(store, tombstones) : store
}

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
 * The generation of the reply that carried the whole decrypted store, or -1.
 *
 * A renderer hydrated before any unlock persists a credential-less copy of the
 * settings on every mutation (a tab move, a repo opened). If a background
 * operation — a fetch resolving its token, an AI call resolving its key — has
 * unlocked the store in the meantime, treating such a save as "the user
 * cleared everything" overwrites the encrypted store with nothing. Only a reply
 * built with the store decrypted counts: one carrying just the session-only
 * tokens (keychain declined) still had stored ones it never saw.
 */
let servedGeneration = -1

/**
 * Every `settings:get` / `settings:unlock` reply gets a new generation, taken
 * the moment the request arrives, and the renderer names the one its state was
 * built from when it saves. Only a save from the latest reply can clear
 * credentials: a debounced save scheduled before an unlock but landing after it
 * carries the pre-unlock blanks. Bumped too whenever the store gains what the
 * last reply did not carry (`persistSessionSecrets`).
 */
let lastGeneration = 0

/**
 * Whether a get/unlock has answered in this process. Until then the renderer
 * holds nothing but defaults, and a save from it would write them over the
 * user's file.
 */
let settingsServed = false

/** True from a parse failure until the file next reads cleanly: no save may land on it meanwhile. */
let settingsBroken = false

/** Why the settings file could not be read; `kind` crosses IPC to pick what the boot screen says. */
export class SettingsReadError extends Error {
  constructor(
    readonly kind: SettingsErrorKind,
    message: string
  ) {
    super(message)
  }
}

/** A save main would not write at all. Answered to the renderer, never thrown across IPC. */
class SettingsRefused extends Error {
  constructor(readonly reason: SettingsRefusal) {
    super(reason)
  }
}

/**
 * Settings reads, writes and the session-secret move run one at a time, in
 * arrival order. Each reads and replaces `secretCache` / `sessionSecrets`
 * across awaits; interleaved, an unlock could serve the store as it was before
 * a clear still being written, and the renderer would save the token back.
 */
let settingsQueue: Promise<unknown> = Promise.resolve()
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = settingsQueue.then(fn, fn)
  settingsQueue = run.catch(() => undefined)
  return run
}

/** What a save may clear, decided when it arrives — never after an await. */
interface SaveAuthority {
  /** Built on the latest reply, which carried the whole store: blanks are clears. */
  store: boolean
  /** Built on the latest reply: it saw every session-only token, so blanks there are clears. */
  session: boolean
  /** The generation the save was built on. */
  generation: number
}

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
  // Left by a pre-release build, not a setting: never shown, never exported, never obeyed.
  delete (settings as unknown as Record<string, unknown>)[STALE_PENDING_CLEARS]
  const out = withMigratedAI(applySecrets(settings, mergeSecretStores(secretCache ?? {}, sessionSecrets)))
  setKnownGitlabInstances(out.profiles.map((p) => p.gitlabUrl))
  setKnownForgejoInstances(out.profiles.map((p) => p.forgejoUrl))
  return out
}

// A half-written file from an older build is whole again within a moment.
const SHORT_DELAYS = [25, 50, 75, 100]
// An antivirus or backup scan can hold the file for longer: about 2 s in all.
const BUSY_DELAYS = [50, 100, 200, 300, 400, 450, 500]
const BUSY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES'])

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * The parsed settings file, or null when there is none yet.
 *
 * A file that exists but does not parse is never answered with defaults: a
 * renderer hydrated from them would save them over the user's real settings.
 * Writes are atomic now, but an older build sharing the data folder still
 * writes in place, so a bad read is retried briefly before it becomes an error.
 */
async function readSettingsFile(): Promise<Partial<AppSettings> | null> {
  // Separate budgets: a scan holding the file for a while must not use up the
  // retries a half-written file gets once it can be read.
  let ioAttempt = 0
  let parseAttempt = 0
  for (;;) {
    let text: string
    try {
      text = await readFile(settingsPath(), 'utf-8')
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        settingsBroken = false
        return null
      }
      const delays = code && BUSY_CODES.has(code) ? BUSY_DELAYS : SHORT_DELAYS
      if (ioAttempt >= delays.length) {
        throw new SettingsReadError('io', `Could not read ${settingsPath()}: ${(err as Error).message}`)
      }
      await sleep(delays[ioAttempt++])
      continue
    }
    try {
      const parsed: unknown = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('settings file is not an object')
      settingsBroken = false
      return parsed as Partial<AppSettings>
    } catch (err) {
      if (parseAttempt >= SHORT_DELAYS.length) {
        settingsBroken = true
        throw new SettingsReadError('parse', `Could not parse ${settingsPath()}: ${(err as Error).message}`)
      }
      await sleep(SHORT_DELAYS[parseAttempt++])
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
 *
 * Read-only on disk: git and AI calls reach it outside the settings queue, and
 * a write from there could land over a `settings:set` still in flight. The one
 * write it knows — moving a plaintext token file into the store — happens only
 * when `migrate` is set, which only the queued `settings:unlock` does.
 */
async function readSettingsWithSecrets(reason: 'tokens' | 'settings' = 'tokens', migrate = false): Promise<AppSettings> {
  const settings = await readSettings()
  if (secretCache) return settings
  // Git may already authenticate through its own helper or SSH. With no app
  // secrets to decrypt or migrate, touching Safe Storage only causes a needless prompt.
  if (!existsSync(secretsPath()) && !hasSettingsSecrets(settings)) {
    // Keychain already usable and no store yet: the store is known to be
    // empty. Recorded, so this reply counts as having carried the whole store
    // and a token saved and then cleared in this session really is cleared.
    // Re-checked after the await: a queued save may have created the store meanwhile.
    if ((await canEncrypt()) && secretCache === null && !existsSync(secretsPath())) secretCache = {}
    return settings
  }

  // An install that already has an encrypted secrets file predates the consent
  // gate — its owner answered the OS prompt long ago, so they are not asked to
  // decide again, only shown the explanation once.
  await adoptExistingConsent([secretsPath()])
  if (!(await ensureKeychain(reason))) return settings

  const stored = adopt(await loadSecrets())
  if (hasSettingsSecrets(settings)) {
    // Upgrade from a plaintext settings file: the values on disk win, since
    // they are what the user last saved.
    const ids = (settings.profiles ?? []).map((p) => p.id)
    const merged = pruneSecrets({ ...stored, ...extractSecrets(settings) }, ids)
    if (!migrate) return withMigratedAI(applySecrets(settings, merged))
    // Rewrite the JSON without them.
    await saveSecrets(merged)
    tombstones.clear()
    await writePrivateFile(settingsPath(), settingsFileJson(settings))
    secretCache = merged
    return withMigratedAI(applySecrets(settings, merged))
  }
  // A queued save may have replaced the cache while the store was being read.
  secretCache ??= stored
  return withMigratedAI(applySecrets(settings, mergeSecretStores(secretCache, sessionSecrets)))
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
  if (Object.keys(sessionSecrets).length === 0 && tombstones.size === 0) return
  const ids = (await readSettings()).profiles.map((p) => p.id)
  const stored = secretCache ?? adopt(await loadSecrets())
  // The cleared slots go too: otherwise turning the keychain on wrote back
  // every token the user had deleted while it was off.
  const merged = pruneSecrets(dropSecretSlots(mergeSecretStores(stored, sessionSecrets), tombstones), ids)
  await saveSecrets(merged)
  secretCache = merged
  sessionSecrets = {}
  tombstones.clear()
}
onKeychainEnabled(() => {
  // The store is about to hold credentials the renderer's last reply may not
  // have carried: a save built on that reply must not read their absence as
  // clears. Bumped on arrival, like every other generation: bumped inside the
  // queue, it also outdated a get that arrived after it and was served after
  // the move, leaving the renderer unable to clear anything.
  if (Object.keys(sessionSecrets).length > 0 || tombstones.size > 0) lastGeneration++
  return serialized(persistSessionSecrets)
})

/** True while some token exists only in memory and would be lost on quit. */
export function hasSessionOnlySecrets(): boolean {
  return Object.keys(sessionSecrets).length > 0
}
onSessionOnlyProbe(hasSessionOnlySecrets)

/**
 * Keychain refused or unavailable: the credentials live in memory only. A save
 * built on the latest reply makes the in-memory view exactly what it sent — a
 * blank is a clear, recorded as a tombstone so the encrypted store loses it too
 * once it can be written. An older save can only add.
 */
function holdInSession(secrets: SecretStore, ids: string[], auth: SaveAuthority): void {
  const next = secretSlots(secrets)
  for (const slot of next.keys()) tombstones.delete(slot)
  if (!auth.session) {
    sessionSecrets = mergeSecretStores(sessionSecrets, secrets)
    return
  }
  const seen = secretSlots(mergeSecretStores(auth.store ? (secretCache ?? {}) : {}, sessionSecrets))
  const cleared = [...seen.keys()].filter((slot) => !next.has(slot))
  for (const slot of cleared) tombstones.add(slot)
  if (secretCache) secretCache = dropSecretSlots(secretCache, cleared)
  // Only what differs from the store is session-only; the rest is already safe.
  const cached = secretSlots(secretCache ?? {})
  sessionSecrets = pruneSecrets(
    fromSecretSlots(new Map([...next].filter(([slot, value]) => cached.get(slot) !== value))),
    ids
  )
}

async function writeSettings(settings: AppSettings, auth: SaveAuthority, options: SaveOptions = {}): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  setKnownGitlabInstances(settings.profiles.map((p) => p.gitlabUrl))
  setKnownForgejoInstances(settings.profiles.map((p) => p.forgejoUrl))
  const secrets = extractSecrets(settings)
  const hasSecrets = Object.keys(secrets).length > 0
  const ids = (settings.profiles ?? []).map((p) => p.id)

  // Whether a blank token in this save means "the user cleared it". Only for a
  // save built on the latest reply that actually carried the credentials — a
  // stale one (scheduled before an unlock) never had them to send back. An
  // import is never that: a file without a token is not a request to delete
  // it. Only an explicit "Replace all", with a file that carries credentials,
  // replaces the stored ones.
  const replacing = options.import === 'replace' && hasSecrets
  const authoritative = replacing || auth.store

  // Saving a token is the moment worth asking about — and only then. A settings
  // write with nothing sensitive in it never goes near the keychain.
  const allowed = hasSecrets ? await ensureKeychain('tokens') : await canEncrypt()

  if (!allowed) {
    // "Replace all" cannot be honoured in memory: the encrypted store would
    // hand the old tokens back on the next launch. Refuse before writing anything.
    if (replacing) throw new SettingsRefused('keychain-required')
    // Refused (or no keyring): hold the secrets in memory for this session and
    // keep them out of the file, rather than writing them in the clear.
    holdInSession(secrets, ids, auth)
    await writePrivateFile(settingsPath(), settingsFileJson(settings))
    return
  }

  // A credential-less save must not wipe the store unless it is authoritative.
  // Same while they are still encrypted on disk, and when the file exists but
  // this build could not decrypt it: our empty view of the store is not the
  // truth, and persisting it would erase the real one.
  if (!hasSecrets && (!authoritative || !secretCache || secretsUnreadable)) {
    await writePrivateFile(settingsPath(), settingsFileJson(settings))
    return
  }

  // Secrets first: if the keychain write fails, the JSON on disk still holds the
  // previous values instead of being stripped with nowhere to read them from.
  //
  // A renderer that was served the secrets is authoritative: clearing a token
  // in the UI removes it here too, and so does deleting a profile. One that
  // never saw them can only add — its save is overlaid on the stored values,
  // so the credentials it was never given survive.
  const base = authoritative
    ? {}
    : dropSecretSlots(mergeSecretStores(secretCache ?? adopt(await loadSecrets()), sessionSecrets), tombstones)
  // No store before this save, and the save is from the latest reply: the
  // renderer holds everything the new store will. Recorded like an unlock, or
  // clearing the token it just saved would be ignored for the rest of the session.
  const firstStore = secretCache === null && auth.session && !options.import && !existsSync(secretsPath())
  const merged = pruneSecrets(mergeSecretStores(base, secrets), ids)
  await saveSecrets(merged)
  secretCache = merged
  sessionSecrets = {}
  tombstones.clear()
  if (firstStore) servedGeneration = auth.generation
  await writePrivateFile(settingsPath(), settingsFileJson(settings))
}

/**
 * Renames an unparseable settings file aside — never deletes it — so the app
 * can start fresh. Null unless the file really does not parse; a refusal when
 * the tokens cannot be copied aside first, which the boot screen must explain —
 * read as null, it retried, found the file still damaged, and looked stuck.
 */
async function moveSettingsAside(): Promise<MoveAsideReply> {
  try {
    await readSettingsFile()
    return null
  } catch (err) {
    if (!(err instanceof SettingsReadError) || err.kind !== 'parse') return null
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = `${settingsPath()}.corrupt-${stamp}`
  // The stored tokens belong to the profiles in that file; a fresh start prunes
  // them on its first token save. Keep an (encrypted) copy beside it, first,
  // and refuse when it cannot be made: moving the file without it would let
  // onboarding delete every old profile's token.
  if (existsSync(secretsPath())) {
    try {
      await copyPrivateFile(secretsPath(), `${secretsPath()}.corrupt-${stamp}`)
    } catch (err) {
      console.warn('[settings] could not copy the secrets store aside:', (err as Error).message)
      return { refused: 'secrets-copy', dir: app.getPath('userData') }
    }
  }
  await rename(settingsPath(), target)
  settingsBroken = false
  return basename(target)
}

// Dev aid: launching with GITCITO_FORCE_ONBOARDING=1 re-runs the first-run
// wizard without touching the settings file. The flag holds until the wizard
// itself saves its completion (consuming it per read breaks under StrictMode's
// double hydration), so a reload before finishing shows the wizard again.
let forceOnboarding = process.env['GITCITO_FORCE_ONBOARDING'] === '1'

function withForcedOnboarding(settings: AppSettings): AppSettings {
  return forceOnboarding ? { ...settings, onboardingCompleted: false } : settings
}

/** What get/unlock answer: the settings and their generation, or why they could not be read. */
type SettingsReplyWire = { settings: AppSettings; generation: number } | { error: SettingsErrorKind }

function serveSettings(read: () => Promise<AppSettings>): Promise<SettingsReplyWire> {
  // Taken on arrival, before the snapshot is read: a save already on its way
  // was built on an older reply and can no longer clear anything.
  const generation = ++lastGeneration
  return serialized(async () => {
    try {
      const settings = withForcedOnboarding(await read())
      settingsServed = true
      servedGeneration = secretCache !== null ? generation : -1
      return { settings, generation }
    } catch (err) {
      return { error: err instanceof SettingsReadError ? err.kind : 'other' }
    }
  })
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => serveSettings(readSettings))
  ipcMain.handle(
    'settings:set',
    (_e, settings: AppSettings, generation?: unknown, options?: unknown): Promise<{ refused: SettingsRefusal } | undefined> => {
      const gen = generationArg(generation)
      const opts = saveOptionsArg(options)
      const current = gen === lastGeneration && !opts.import
      const auth: SaveAuthority = { store: current && gen === servedGeneration, session: current, generation: gen }
      // An import changes what the renderer holds without a new reply: its next
      // ordinary save must not be read as clears until it has reloaded.
      if (opts.import) lastGeneration++
      return serialized(async () => {
        // Nothing the renderer holds is the user's yet, or the file on disk is
        // one we could not read: writing would replace it with defaults.
        if (!settingsServed || settingsBroken) return { refused: 'not-loaded' }
        if (settings.onboardingCompleted) forceOnboarding = false
        try {
          await writeSettings(settings, auth, opts)
        } catch (err) {
          if (err instanceof SettingsRefused) return { refused: err.reason }
          throw err
        }
        return undefined
      })
    }
  )
  // Called when the user opens Settings: that is an explicit "show me my
  // credentials", so it is a fair moment to decrypt (and to ask, if needed).
  ipcMain.handle('settings:unlock', () => serveSettings(() => readSettingsWithSecrets('settings', true)))
  // Only from the boot screen, for a file that does not parse: renamed, never deleted.
  ipcMain.handle('settings:moveAside', () => serialized(moveSettingsAside))

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
