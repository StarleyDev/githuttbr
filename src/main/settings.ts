import { app, BrowserWindow, ipcMain, dialog, safeStorage, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { basename, join } from 'path'
import { existsSync } from 'fs'
import { readFile, readdir, mkdir, realpath, rename, rm, stat } from 'fs/promises'
import { copyPrivateFile, updatePrivateFile, writePrivateFile } from './privateFile'
import {
  defaultSettings,
  type AccountLink,
  type AppSettings,
  type BitbucketServerTokenKind,
  type MoveAsideReply,
  type RepoHost,
  type SecretsState,
  type SettingsErrorKind,
  type SettingsRefusal,
  type SettingsReplyWire,
  type SettingsSaveOptions
} from '../shared/types'
import { validAccountLink } from '../shared/hostToken'
import {
  tokenInstance,
  GITLAB_COM,
  gitlabAuthFor,
  gitlabServerBases,
  profileForgejoBase,
  migrateGitlabSettings
} from '../shared/gitlabInstance'
import { setKnownForgejoInstances, setKnownGithubEnterpriseInstances, setKnownGitlabInstances } from './gitlabInstances'
import { GITHUB_COM, githubAuthFor, githubEnterpriseBases } from '../shared/githubEnterprise'
import { BITBUCKET_CLOUD, bitbucketAuthFor, bitbucketServerBases } from '../shared/bitbucketServer'
import { setKnownBitbucketServerInstances } from './bitbucketServerInstances'
import { resolveRemoteProvider, serverRegistryOf, type ResolvedRemote } from '../shared/remoteProvider'
import {
  applySecrets,
  carriesHeldSecret,
  clearedSlots,
  extractSecrets,
  hasSettingsSecrets,
  isSubsetStore,
  mergeSecretStores,
  pruneSecrets,
  saveOver,
  scrubServerUrls,
  secretValues,
  secretView,
  stripSettingsSecrets,
  withoutSlots,
  type SecretStore,
  type SecretView
} from '../shared/secrets'
import { accountFor, migrateAIConfig } from '../shared/aiAccounts'
import {
  adoptExistingConsent,
  canUseKeychain,
  ensureKeychain,
  getConsent,
  getConsentState,
  noteSettingsServed,
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
 * Which credentials each renderer (by webContents id) holds, slot by slot with
 * the value it holds: what it was last served, or what it last sent. A token
 * missing from a save is a clear only where the sender held that slot with the
 * value stored now (`saveOver`) — any other renderer, or the same one after
 * another window changed the token, would erase what it never had.
 *
 * One map for both stores, the encrypted one and `sessionSecrets`: it records
 * what the renderer holds, not where that came from.
 */
const holdings = new Map<number, { view: SecretView; generation: number }>()
const NOTHING_HELD: SecretView = new Map()

/**
 * Every `settings:get` / `settings:unlock` reply gets a new generation, and a
 * save names the one its state was built from. The holdings are recorded when
 * main replies, but the renderer applies the reply later (after normalising it,
 * after loading a dictionary) — a debounced save of the state from *before* an
 * unlock could land in between and read as "the user cleared every token it was
 * just handed". A save from an older generation clears nothing.
 *
 * Zero is "never served": a window that only ever saved holds what it sent.
 */
let lastGeneration = 0

/**
 * Credentials cleared while the keychain could not be written (turned off, or
 * no keyring) after the store was decrypted: applied in memory at once, and to
 * the encrypted file the next time it can be written. Without them a clear
 * made while the keychain was off came back as the stored value once it was on.
 */
let pendingClears: SecretView = new Map()

/**
 * Store reads and writes run one at a time: each derives the next store from
 * the current one (`saveOver`), and two interleaved — a save and a background
 * unlock installing what it read — lost one of them.
 */
let secretsChain: Promise<unknown> = Promise.resolve()
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = secretsChain.then(fn, fn)
  secretsChain = run.catch(() => undefined)
  return run
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

/**
 * The cache holds tokens the encrypted file does not: a background read
 * installed it from a plaintext settings file without writing (see
 * `readWithSecrets`). The first save that can write the store does — a save
 * strips the settings file, and those tokens would otherwise be left in memory only.
 */
let cacheUnwritten = false

/** The stored tokens with a plaintext settings file's over them — the file wins, it is what the user last saved. */
function plaintextMerged(stored: SecretStore, settings: AppSettings): SecretStore {
  const profiles = settings.profiles ?? []
  return pruneSecrets(
    mergeSecretStores(stored, extractSecrets(settings)),
    profiles.map((p) => p.id),
    profiles
  )
}

async function canEncrypt(): Promise<boolean> {
  // Never triggers an OS prompt: it only reports a consent already given.
  return canUseKeychain()
}

/**
 * An encrypted file exists on disk but this session could not read it — the
 * keychain prompt was dismissed, the keyring is locked, a different app identity
 * wrote it (dev vs packaged, a re-signed build), or the file is damaged.
 * Distinct from "no secrets": nothing derived from our empty view of it is ever
 * written over it. Tokens typed meanwhile stay session-only, Settings says so,
 * and the store is read again when the user asks (opening Settings, "Try
 * again", turning the keychain on) — or replaced, keeping a backup, only when
 * they choose that (`settings:replaceUnreadableStore`).
 */
let secretsUnreadable = false

// A renderer hydrated before any unlock persists a credential-less copy of the
// settings on every mutation (a tab move, a repo opened). If a background
// operation — a fetch resolving its token, an AI call resolving its key — has
// unlocked the store in the meantime, treating such a save as "the user
// cleared everything" overwrites the encrypted store with nothing. Only what a
// renderer actually holds (`holdings`) can it clear.

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

/**
 * The encrypted store as on disk: `{}` when there is none, null when one exists
 * and this session cannot read it (`secretsUnreadable`). Unreadable is never
 * empty. Once a read failed, only an `explicit` one — the user opening Settings
 * or turning the keychain on — tries again: a fetch every few seconds must not
 * keep knocking on a keychain the user just turned away.
 */
async function loadSecrets(explicit: boolean): Promise<SecretStore | null> {
  if (secretsUnreadable && !explicit) return null
  let b64: string
  try {
    b64 = await readFile(secretsPath(), 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      secretsUnreadable = false
      return {}
    }
    return markUnreadable()
  }
  try {
    const parsed: unknown = JSON.parse(safeStorage.decryptString(Buffer.from(b64, 'base64')))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return markUnreadable()
    secretsUnreadable = false
    return parsed as SecretStore
  } catch {
    return markUnreadable()
  }
}

function markUnreadable(): null {
  if (!secretsUnreadable) {
    secretsUnreadable = true
    // A peek stops waiting for a store it cannot have (see peekView).
    announceUnlocked()
  }
  return null
}

const BACKUP_PREFIX = 'gitcito-secrets.enc.bak'
const backupPath = (): string => `${secretsPath()}.bak`

/** How long a backup that is not already part of the store is kept. */
const BACKUP_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Writes the store — never over one this session could not read (see `secretsUnreadable`). */
async function saveSecrets(store: SecretStore): Promise<void> {
  if (secretsUnreadable) throw new Error('The token store could not be read; it was left untouched.')
  await mkdir(app.getPath('userData'), { recursive: true })
  const enc = safeStorage.encryptString(JSON.stringify(store))
  await writePrivateFile(secretsPath(), enc.toString('base64'))
  cacheUnwritten = false
  await retireBackups(store)
}

/**
 * A backup is old tokens — some revoked, some removed in Settings on purpose —
 * and it outlives every clear, so it does not stay forever. But it goes early
 * only when nothing is lost with it: when this build can read it and every
 * token in it is in the store just written. Any other backup — another build's,
 * or one holding tokens the store does not — is kept for a while, then goes.
 * Never called by the write that makes a backup.
 */
async function retireBackups(written: SecretStore): Promise<void> {
  const dir = app.getPath('userData')
  const names = await readdir(dir).catch(() => [] as string[])
  for (const name of names) {
    if (!name.startsWith(BACKUP_PREFIX)) continue
    const path = join(dir, name)
    let covered = false
    try {
      const parsed: unknown = JSON.parse(safeStorage.decryptString(Buffer.from(await readFile(path, 'utf-8'), 'base64')))
      covered = !!parsed && typeof parsed === 'object' && isSubsetStore(parsed as SecretStore, written)
    } catch {
      // Another build's — or not a store at all.
    }
    const old = await stat(path)
      .then((s) => Date.now() - s.mtimeMs > BACKUP_MAX_AGE_MS)
      .catch(() => false)
    if (covered || old) await rm(path, { force: true }).catch(() => undefined)
  }
}

/**
 * Why the settings file could not be read — never "no settings". `kind` crosses
 * IPC to pick what the boot screen says: only `parse` is a damaged file.
 */
export class SettingsReadError extends Error {
  constructor(
    readonly kind: SettingsErrorKind,
    message: string
  ) {
    super(message)
    this.name = 'SettingsReadError'
  }
}

/** A save main would not write at all. Answered to the renderer, never thrown across IPC. */
class SettingsRefused extends Error {
  constructor(readonly reason: SettingsRefusal) {
    super(reason)
  }
}

/**
 * Whether a get/unlock has answered in this process. Until then a renderer
 * holds nothing but defaults, and a save from it would write them over the
 * user's file.
 */
let settingsServed = false

/** True from a parse failure until the file next reads cleanly: no save may land on it meanwhile. */
let settingsBroken = false

// Writes are atomic now (privateFile.ts), so a half-written file should never
// be seen; a few quick retries still cover a writer that is not this process
// (an older build, a sync tool) before the file is declared unreadable.
const SHORT_DELAYS = [25, 50, 75, 100]
// An antivirus or backup scan can hold the file for longer: about 2 s in all.
const BUSY_DELAYS = [50, 100, 200, 300, 400, 450, 500]
const BUSY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES'])

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** The settings file parsed, or null when there is none. Throws `SettingsReadError` when it exists and cannot be read. */
async function readSettingsFile(): Promise<{ raw: string; parsed: Partial<AppSettings> } | null> {
  // Separate budgets: a scan holding the file for a while must not use up the
  // retries a half-written file gets once it can be read.
  let ioAttempt = 0
  let parseAttempt = 0
  for (;;) {
    let raw: string
    try {
      raw = await readFile(settingsPath(), 'utf-8')
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
    let why = 'not a settings object'
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        settingsBroken = false
        return { raw, parsed: parsed as Partial<AppSettings> }
      }
    } catch (err) {
      why = (err as Error).message
    }
    if (parseAttempt >= SHORT_DELAYS.length) {
      settingsBroken = true
      throw new SettingsReadError('parse', `Could not parse ${settingsPath()} (${why}). It was left untouched.`)
    }
    await sleep(SHORT_DELAYS[parseAttempt++])
  }
}

/**
 * Slot ids a v4.37.2 pre-release kept in the settings file. Never acted on:
 * dropped on read and on write, so the next save removes them. Clears made with
 * the keychain off are held in memory only (`pendingClears`).
 */
const STALE_PENDING_CLEARS = 'pendingSecretClears'

function withoutStaleKeys<T extends object>(settings: T): T {
  if (!(STALE_PENDING_CLEARS in settings)) return settings
  const out: Record<string, unknown> = { ...settings }
  delete out[STALE_PENDING_CLEARS]
  return out as T
}

/** The settings file as written: no secrets, and nothing main once kept there for itself. */
function settingsFileJson(settings: AppSettings): string {
  return JSON.stringify(withoutStaleKeys(stripSettingsSecrets(settings)), null, 2)
}

/**
 * Rewrites the settings file from a read, unless it changed since: a rewrite
 * derived from an earlier read must not land over a save made in between.
 */
async function rewriteIfUnchanged(raw: string, next: string): Promise<boolean> {
  // Many reads of the same file at once (a busy start-up) each see the same
  // dirty contents: one rewrite is enough, the rest would only re-read it.
  if (rewriting?.raw === raw && rewriting.next === next) return false
  const mine = { raw, next }
  rewriting = mine
  try {
    return await updatePrivateFile(settingsPath(), (current) => (current === raw ? next : null)).catch(() => false)
  } finally {
    if (rewriting === mine) rewriting = null
  }
}
let rewriting: { raw: string; next: string } | null = null

/**
 * Who is reading. Only the queued `settings:get` / `settings:unlock` may write
 * what a read finds worth fixing on disk (a credential in a server address, a
 * plaintext token, clears waiting for the store): every other reader — a fetch
 * resolving its token, an AI call, the avatar peek — runs outside the settings
 * queue and is read-only, so nothing it does can land beside a save in flight.
 */
type ReadMode = 'background' | 'queued'

/** The settings as stored, without any credential applied — and the file's contents as they now are. */
async function readStoredSettings(mode: ReadMode = 'background'): Promise<{ settings: AppSettings; raw: string | null }> {
  const file = await readSettingsFile()
  const read = file ? await fromFile(file.raw, file.parsed, mode) : null
  const settings = read?.settings ?? defaultSettings()
  setKnownGitlabInstances(gitlabServerBases(settings.profiles))
  setKnownForgejoInstances(settings.profiles.map((p) => p.forgejoUrl))
  setKnownGithubEnterpriseInstances(githubEnterpriseBases(settings.profiles))
  setKnownBitbucketServerInstances(bitbucketServerBases(settings.profiles))
  return { settings, raw: read?.raw ?? null }
}

async function fromFile(
  raw: string,
  parsed: Partial<AppSettings>,
  mode: ReadMode
): Promise<{ settings: AppSettings; raw: string }> {
  // Left by a pre-release build, not a setting: never shown, never exported, never obeyed.
  const known = withoutStaleKeys(parsed)
  // A server address carrying a credential (an import, an older build, a
  // hand edit) is cleaned on the way in — and on disk, once, by a queued read.
  const clean = scrubServerUrls(known)
  let now = raw
  if (mode === 'queued' && clean !== parsed) {
    const next = JSON.stringify(clean, null, 2)
    if (await rewriteIfUnchanged(raw, next)) now = next
  }
  // Existing install without the key → treat as already onboarded.
  // A one-instance GitLab profile becomes a server list here, on every read —
  // the file is also written by imports and older builds (see withMigratedAI).
  return { settings: migrateGitlabSettings({ ...defaultSettings(), onboardingCompleted: true, ...clean }), raw: now }
}

/**
 * The settings JSON as stored, with the session-only tokens applied — never the
 * decrypted store: that reaches a renderer only from `settings:unlock`, and
 * main's own lookups through `readSettingsWithSecrets`.
 *
 * No file is the defaults; a file that exists but cannot be read throws
 * (`SettingsReadError`). Answering defaults for it once made a renderer save
 * them over the real settings, and pruned the tokens of every profile the
 * defaults do not have. Read-only on disk (see `ReadMode`).
 */
export async function readSettings(): Promise<AppSettings> {
  return (await readPlain()).settings
}

/** `readSettings`, with exactly the credentials it applied — what a renderer is then given. */
async function readPlain(mode: ReadMode = 'background'): Promise<{ settings: AppSettings; applied: SecretStore }> {
  const { settings } = await readStoredSettings(mode)
  const applied = sessionSecrets
  return { settings: withMigratedAI(applySecrets(settings, applied)), applied }
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
 * The decrypted store with this session's typed tokens over it — slot by slot:
 * a spread by profile let one typed token hide every stored one beside it.
 */
function inMemorySecrets(): SecretStore {
  return secretCache ? mergeSecretStores(secretCache, sessionSecrets) : sessionSecrets
}

/**
 * Same, but decrypts the stored secrets first — asking for keychain access if
 * that has not been settled yet. Only call this from something the user just
 * did (opening Settings, a network git operation), never from start-up.
 *
 * Read-only on disk: git and AI calls reach it outside the settings queue.
 */
async function readSettingsWithSecrets(reason: 'tokens' | 'settings' = 'tokens'): Promise<AppSettings> {
  return (await readWithSecrets(reason)).settings
}

/**
 * `readSettingsWithSecrets`, with exactly the credentials it applied. Only the
 * `queued` read — `settings:unlock` — writes what it finds: a plaintext token
 * file moved into the store, tokens and clears that waited for the store.
 */
async function readWithSecrets(
  reason: 'tokens' | 'settings',
  mode: ReadMode = 'background'
): Promise<{ settings: AppSettings; applied: SecretStore }> {
  const plain = await readPlain()
  if (secretCache && mode === 'background') {
    const applied = inMemorySecrets()
    return { settings: withMigratedAI(applySecrets(plain.settings, applied)), applied }
  }
  if (!secretCache) {
    // Git may already authenticate through its own helper or SSH. With no app
    // secrets to decrypt or migrate, touching Safe Storage only causes a needless prompt.
    if (!existsSync(secretsPath()) && !hasSettingsSecrets(plain.settings)) {
      if (mode === 'background') return plain
      // Keychain already usable and no store yet: the store is known to be
      // empty, and this session holds all of it. Re-checked in the queue: a
      // save may have created the store meanwhile.
      const known = await canEncrypt()
      return exclusive(async () => {
        if (known && !secretCache && !existsSync(secretsPath())) setSecretCache({})
        return readPlain(mode)
      })
    }

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
      return mode === 'queued' ? exclusive(() => readPlain(mode)) : plain
    }
  }

  return exclusive(async () => {
    // Another call may have installed it while this one waited.
    if (!secretCache) {
      // Opening Settings is the user asking: it reads the store again even after a failure.
      const stored = await loadSecrets(reason === 'settings')
      // Unreadable: answer with what this session has, and install nothing —
      // an empty cache would read as "unlocked, no tokens", and the next save
      // would write that over the real store.
      if (!stored) return readPlain(mode)
      const { settings, raw } = await readStoredSettings(mode)
      if (hasSettingsSecrets(settings)) {
        // Upgrade from a plaintext settings file: the values on disk win, since
        // they are what the user last saved.
        const merged = plaintextMerged(stored, settings)
        if (mode === 'background') {
          // Installed in memory only — a background reader never writes — so
          // the next git or AI call does not decrypt again, and a peek sees
          // the store unlocked. The move itself waits for a queued unlock.
          setSecretCache(merged)
          cacheUnwritten = true
        } else {
          // Rewrite the JSON without them.
          await saveSecrets(merged)
          if (raw !== null) await rewriteIfUnchanged(raw, settingsFileJson(settings))
          setSecretCache(merged)
        }
      } else {
        setSecretCache(stored)
      }
    } else if (mode === 'queued') {
      // Installed by a background read from a plaintext file (or a file an
      // older build wrote tokens into since): the move into the store is this read's.
      const { settings, raw } = await readStoredSettings(mode)
      if (hasSettingsSecrets(settings) && (await canEncrypt())) {
        const merged = plaintextMerged(secretCache, settings)
        await saveSecrets(merged)
        if (raw !== null) await rewriteIfUnchanged(raw, settingsFileJson(settings))
        setSecretCache(merged)
      }
    }
    // Tokens typed while the store was out of reach, and clears made while it
    // could not be written, go in now that it is readable — from the queued
    // unlock only. A failed write keeps them in memory, as before: this read still answers.
    if (mode === 'queued') await persistPendingLocked().catch(() => undefined)
    const after = await readPlain(mode)
    const applied = inMemorySecrets()
    return { settings: withMigratedAI(applySecrets(after.settings, applied)), applied }
  })
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
  // An unreadable store is out of reach too: waiting for it would wait forever.
  if ((await getConsent()) === 'declined' || keyringUnavailable || secretsUnreadable) return 'plain'
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
  // Azure DevOps has no configured servers, so no base: it is placed by its
  // hostname alone, and a remote that is not on one gets nothing.
  if (remoteUrl && (host === 'azure' ? onRemote?.provider !== 'azure' : !onRemote?.base)) return {}
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
  return resolveRemoteProvider(remoteUrl, serverRegistryOf(profiles))
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
 * `namedProfileAuth` that never decrypts — see `peekActiveProfileAuth`. For a
 * lookup that names its profile because the active one on disk may lag the
 * renderer: a profile switch is written only after the settings debounce.
 */
export function peekNamedProfileAuth(
  host: RepoHost,
  profileId: string,
  remoteUrl?: string,
  expectedBase?: string
): Promise<PeekedAuth> {
  if (!profileId.trim()) return Promise.resolve({})
  return profileAuth(host, profileId, remoteUrl, expectedBase, true)
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
 * Move what is held in memory into the encrypted store: tokens typed while the
 * keychain was off (or the store unreadable), and clears made while it could
 * not be written (`pendingClears`). Without this, turning it on changed nothing
 * until some other setting happened to be saved, and quitting before that lost
 * them again. Runs inside `exclusive`.
 */
async function persistPendingLocked(): Promise<void> {
  if (Object.keys(sessionSecrets).length === 0 && pendingClears.size === 0) return
  if (!(await canEncrypt())) return
  const stored = secretCache ?? (await loadSecrets(true))
  // Still unreadable: they stay where they are, and Settings keeps saying so.
  if (!stored) return
  const { profiles } = await readSettings()
  const ids = profiles.map((p) => p.id)
  const merged = pruneSecrets(mergeSecretStores(withoutSlots(stored, pendingClears), sessionSecrets), ids, profiles)
  await saveSecrets(merged)
  setSecretCache(merged)
  sessionSecrets = {}
  pendingClears = new Map()
}

function persistSessionSecrets(): Promise<void> {
  return exclusive(persistPendingLocked)
}
onKeychainEnabled(persistSessionSecrets)
onKeychainDeclined(announceUnlocked)

/**
 * Whether `value` carries a credential this app already holds — for any
 * profile, provider or server: in the session, in the plain file (not yet
 * migrated), or in the encrypted store *if it is already decrypted*. A locked
 * store is not unlocked to answer, so a token only in there is not recognised;
 * the callers use this to refuse, never to allow.
 *
 * "Carries", not "equals": a held token padded with spaces, invisible
 * characters or anything else around it is still that token on the wire
 * (`carriesHeldSecret`).
 */
export async function isHeldSecret(value: string): Promise<boolean> {
  if (!value.trim()) return false
  const candidates = [
    ...secretValues(sessionSecrets),
    ...secretValues(secretCache ?? {}),
    ...secretValues(extractSecrets(await readSettings()))
  ]
  return carriesHeldSecret(value, candidates)
}

/** True while some token exists only in memory and would be lost on quit. */
export function hasSessionOnlySecrets(): boolean {
  return Object.keys(sessionSecrets).length > 0 || pendingClears.size > 0
}
onSessionOnlyProbe(hasSessionOnlySecrets)

/**
 * The store is decrypted but cannot be written now (the keychain was turned
 * off, or the keyring went away): the change still applies to what this
 * session uses, and its clears wait for the store to be writable again.
 */
function applyInMemory(next: SecretStore): void {
  if (!secretCache) return
  const cleared = clearedSlots(secretCache, next)
  if (cleared.size > 0) pendingClears = new Map([...pendingClears, ...cleared])
  setSecretCache(next)
}

async function writeSettings(
  incoming: AppSettings,
  sender: number,
  arrived: { generation: number; current: number },
  options: SettingsSaveOptions
): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  // An import or an older renderer may still send the one-instance shape — or
  // a server address with a credential in it, which the plain file must not keep.
  const settings = migrateGitlabSettings(scrubServerUrls(incoming))
  setKnownGitlabInstances(gitlabServerBases(settings.profiles))
  setKnownForgejoInstances(settings.profiles.map((p) => p.forgejoUrl))
  setKnownGithubEnterpriseInstances(githubEnterpriseBases(settings.profiles))
  setKnownBitbucketServerInstances(bitbucketServerBases(settings.profiles))
  const secrets = extractSecrets(settings)
  const hasSecrets = Object.keys(secrets).length > 0
  const stripped = settingsFileJson(settings)
  const profiles = settings.profiles ?? []
  const ids = profiles.map((p) => p.id)
  // A token the save carries is the new one; one it leaves blank is cleared
  // only where this sender held it with the value stored now (`saveOver`) —
  // clearing a token in the UI, deleting a profile. Anything it was never
  // given survives. Either way a server the profile no longer lists takes its
  // token along: it would otherwise come back with the URL.
  //
  // What it held counts only for a save built from the latest reply it was
  // given (`lastGeneration`). An import is never trusted that way: a file
  // without tokens — the default export — is not "clear them all". Only one
  // that carries credentials, with the user's explicit "replace", stands for
  // the whole store.
  //
  // "Latest" is decided on arrival (`arrived`): a save sent before a get/unlock
  // still counts once that has arrived, and one built on an older reply never
  // does. What it held is read now: an earlier save from it may have changed
  // that, and no newer reply can have been recorded before this save ran (they
  // queue behind it).
  const entry = holdings.get(sender)
  const current = arrived.current
  const fresh = arrived.generation === current
  const replacing = options.import === 'replace' && hasSecrets
  const seenFor = (store: SecretStore): SecretView =>
    replacing ? secretView(store) : options.import || !fresh ? NOTHING_HELD : (entry?.view ?? NOTHING_HELD)
  const over = (store: SecretStore): SecretStore => pruneSecrets(saveOver(store, secrets, seenFor(store)), ids, profiles)
  // Afterwards the sender holds exactly what it sent: whatever was kept beside
  // it is still not its to clear. A save from an older generation leaves the
  // record alone — the reply it has not applied yet is what it is about to hold.
  // Nor does any save once a newer get/unlock from it has arrived.
  const holds = (): void => {
    if (!fresh && !options.import) return
    if ((holdings.get(sender)?.generation ?? 0) !== current) return
    holdings.set(sender, { view: secretView(secrets), generation: current })
  }

  if (!hasSecrets) {
    // Nothing sensitive in it: never goes near the keychain prompt. The
    // session-only tokens follow the save (they are applied on every read);
    // the decrypted store too, when there is one. While still encrypted on
    // disk, or unreadable, our empty view of it is not the truth, and
    // persisting it would erase the real one.
    sessionSecrets = over(sessionSecrets)
    if (secretCache) {
      const next = over(secretCache)
      const changed = JSON.stringify(next) !== JSON.stringify(secretCache)
      // Clears still waiting for the store are written by the first save that can.
      if (changed || pendingClears.size > 0 || cacheUnwritten) {
        if (await canEncrypt()) {
          await saveSecrets(next)
          setSecretCache(next)
          pendingClears = new Map()
        } else if (changed) {
          applyInMemory(next)
        }
      }
    }
    await writePrivateFile(settingsPath(), stripped)
    holds()
    return
  }

  // Saving a token is the moment worth asking about — and only then.
  if (!(await ensureKeychain('tokens'))) {
    // "Replace all" cannot be honoured in memory: the encrypted store would
    // hand the old tokens back on the next launch. Refused before anything is written.
    if (replacing) throw new SettingsRefused('keychain-required')
    // Refused (or no keyring): hold the secrets in memory for this session and
    // keep them out of the file, rather than writing them in the clear. A
    // store already decrypted follows in memory, so a clear made now holds.
    sessionSecrets = over(sessionSecrets)
    if (secretCache) applyInMemory(over(secretCache))
    await writePrivateFile(settingsPath(), stripped)
    holds()
    return
  }
  const stored = secretCache ?? (await loadSecrets(false))
  if (!stored) {
    // Nor over a store this session cannot read: its tokens would come back the
    // moment it can be read again.
    if (replacing) throw new SettingsRefused('store-unreadable')
    // A store exists that this session cannot read. Writing ours would replace
    // every token in it with this save's: keep them for the session instead,
    // and let Settings say why (`settings:secretsState`).
    sessionSecrets = over(sessionSecrets)
    await writePrivateFile(settingsPath(), stripped)
    holds()
    return
  }
  // Secrets first: if the keychain write fails, the JSON on disk still holds the
  // previous values instead of being stripped with nowhere to read them from.
  const merged = over(mergeSecretStores(withoutSlots(stored, pendingClears), sessionSecrets))
  await saveSecrets(merged)
  setSecretCache(merged)
  sessionSecrets = {}
  pendingClears = new Map()
  await writePrivateFile(settingsPath(), stripped)
  holds()
}

/**
 * The user chose to start a new token store over one this session cannot read
 * (Settings → Security). The old file is kept beside it as a backup — readable
 * again by whatever could read it, removed after a while (`retireBackups`) —
 * and what this session holds becomes the new store.
 */
async function replaceUnreadableStore(): Promise<boolean> {
  return exclusive(async () => {
    if (!secretsUnreadable || !existsSync(secretsPath())) return false
    if (!(await canEncrypt())) return false
    // A backup already there is someone's tokens too: never written over.
    const target = existsSync(backupPath()) ? `${backupPath()}-${Date.now()}` : backupPath()
    await copyPrivateFile(secretsPath(), target)
    const { profiles } = await readSettings()
    const fresh = pruneSecrets(
      sessionSecrets,
      profiles.map((p) => p.id),
      profiles
    )
    // Written without retiring backups: the one just made must outlive this call.
    const enc = safeStorage.encryptString(JSON.stringify(fresh))
    await writePrivateFile(secretsPath(), enc.toString('base64'))
    secretsUnreadable = false
    setSecretCache(fresh)
    sessionSecrets = {}
    pendingClears = new Map()
    return true
  })
}

/**
 * Renames an unparseable settings file aside — never deletes it — so the app
 * can start fresh. Null unless the file really does not parse; a refusal when
 * the tokens cannot be copied aside first, which the boot screen must explain —
 * read as null, it retried, found the file still damaged, and looked stuck.
 * Runs inside `exclusive`.
 */
async function moveSettingsAside(): Promise<MoveAsideReply> {
  try {
    await readSettingsFile()
    return null
  } catch (err) {
    if (!(err instanceof SettingsReadError) || err.kind !== 'parse') return null
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  // A settings file symlinked into a dotfiles repository: the damaged file is
  // the link's target, so that is what moves. The link stays, and the fresh
  // start is written through it (`writePrivateFile`) instead of over it.
  const damaged = await realpath(settingsPath())
  const target = `${damaged}.corrupt-${stamp}`
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
  await rename(damaged, target)
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

/** The renderer an IPC call came from; -1 when the event names none. */
function senderOf(e: Partial<Pick<IpcMainInvokeEvent, 'sender'>> | undefined): number {
  return e?.sender?.id ?? -1
}

const watchedRenderers = new WeakSet<WebContents>()

/**
 * A get/unlock arriving: its generation is taken now, before anything is read.
 * A save sent after this point but built on an older reply can no longer clear
 * anything (`writeSettings` compares on arrival). A reload or a crash starts a renderer over with nothing (it can
 * save before it has read the settings again), so from then on it holds
 * neither the stored nor the session secrets, and its blanks are not clears
 * until it is served them anew.
 */
function arrive(e: Partial<Pick<IpcMainInvokeEvent, 'sender'>> | undefined): Arrival {
  const generation = ++lastGeneration
  // The view stays until the reply replaces it: a save that arrived before
  // this request still runs on what its sender held then.
  const sender = senderOf(e)
  const before = holdings.get(sender)
  holdings.set(sender, { view: before?.view ?? NOTHING_HELD, generation })
  forgetOnReload(e)
  return { generation, before }
}

/** A get/unlock taken on arrival: its generation, and what its sender held before it. */
interface Arrival {
  generation: number
  before: { view: SecretView; generation: number } | undefined
}

/**
 * The newest reply each renderer was actually given. A renderer applies the
 * newest reply it receives and ignores an older one answered after it, so this
 * is what it holds once a newer request has failed (see `unserved`).
 */
const lastServed = new Map<number, { view: SecretView; generation: number }>()

/** Records what a renderer was just served — unless a newer get/unlock from it arrived meanwhile. */
function served(e: Partial<Pick<IpcMainInvokeEvent, 'sender'>> | undefined, generation: number, applied: SecretStore): void {
  settingsServed = true
  const sender = senderOf(e)
  const view = secretView(applied)
  if ((lastServed.get(sender)?.generation ?? 0) < generation) lastServed.set(sender, { view, generation })
  if (holdings.get(sender)?.generation === generation) holdings.set(sender, { view, generation })
}

/**
 * A get/unlock that failed: its renderer applied nothing and still saves with
 * the generation it had. Left on the generation taken on arrival, every later
 * save from it read as stale, and every clear it made was dropped without a
 * word. Back to what it holds — the newest reply it was given, or what it held
 * before — unless a newer request from it has arrived since.
 */
function unserved(e: Partial<Pick<IpcMainInvokeEvent, 'sender'>> | undefined, arrival: Arrival): void {
  const sender = senderOf(e)
  if (holdings.get(sender)?.generation !== arrival.generation) return
  const given = lastServed.get(sender)
  const back = given && given.generation > (arrival.before?.generation ?? 0) ? given : arrival.before
  if (back) holdings.set(sender, back)
  else holdings.delete(sender)
}

/** Answers a get/unlock: the settings and their generation, or why they could not be read — never defaults for a bad file. */
async function serve(
  e: Partial<Pick<IpcMainInvokeEvent, 'sender'>> | undefined,
  arrival: Arrival,
  read: () => Promise<{ settings: AppSettings; applied: SecretStore }>
): Promise<SettingsReplyWire> {
  const { generation } = arrival
  try {
    const { settings, applied } = await read()
    served(e, generation, applied)
    noteSettingsServed(e?.sender)
    return { settings: withForcedOnboarding(settings), generation }
  } catch (err) {
    console.warn('[settings] could not be read:', (err as Error).message)
    unserved(e, arrival)
    return { error: err instanceof SettingsReadError ? err.kind : 'other' }
  }
}

/** Once per renderer: drop what it holds when it reloads, crashes or closes. */
function forgetOnReload(e: Partial<Pick<IpcMainInvokeEvent, 'sender'>> | undefined): void {
  const wc = e?.sender
  if (!wc || typeof wc.on !== 'function' || watchedRenderers.has(wc)) return
  watchedRenderers.add(wc)
  const id = wc.id
  const forget = (): void => {
    holdings.delete(id)
    lastServed.delete(id)
  }
  wc.on('did-navigate', forget)
  wc.on('render-process-gone', forget)
  wc.once('destroyed', forget)
}

/** Off the IPC boundary: a generation is a non-negative integer, anything else names none. */
function generationArg(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function saveOptionsArg(value: unknown): SettingsSaveOptions {
  const mode = value && typeof value === 'object' ? (value as { import?: unknown }).import : undefined
  return mode === 'merge' || mode === 'replace' ? { import: mode } : {}
}

export function registerSettingsHandlers(): void {
  void removeLegacySecretsIndex()
  // Plain: whatever else unlocked the store this session (a push resolving its
  // token, an AI call), a renderer gets the decrypted tokens only by asking for
  // them — `settings:unlock`, which Settings calls when it opens. The tokens
  // typed this session are applied either way: they are already the renderer's.
  // Queued behind saves, and the one plain read allowed to fix the file on disk.
  ipcMain.handle('settings:get', (e): Promise<SettingsReplyWire> => {
    const arrival = arrive(e)
    return exclusive(() => serve(e, arrival, () => readPlain('queued')))
  })
  ipcMain.handle(
    'settings:set',
    (e, settings: AppSettings, generation?: unknown, options?: unknown): Promise<{ refused: SettingsRefusal } | undefined> => {
      // A save can make its renderer a holder (it typed the tokens): watch it too.
      forgetOnReload(e)
      const sender = senderOf(e)
      // Whether it was built on its sender's latest reply is decided on arrival.
      const arrived = { generation: generationArg(generation), current: holdings.get(sender)?.generation ?? 0 }
      const opts = saveOptionsArg(options)
      return exclusive(async () => {
        // Nothing a renderer holds is the user's yet, or the file on disk is
        // one that could not be parsed: writing would replace it with defaults.
        if (!settingsServed || settingsBroken) return { refused: 'not-loaded' as const }
        if (settings.onboardingCompleted) forceOnboarding = false
        try {
          await writeSettings(settings, sender, arrived, opts)
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
  ipcMain.handle('settings:unlock', (e): Promise<SettingsReplyWire> => {
    const arrival = arrive(e)
    return serve(e, arrival, () => readWithSecrets('settings', 'queued'))
  })
  ipcMain.handle('settings:secretsState', (): SecretsState => ({ unreadable: secretsUnreadable }))
  ipcMain.handle('settings:replaceUnreadableStore', () => replaceUnreadableStore())
  // Only from the boot screen, for a file that does not parse: renamed, never deleted.
  ipcMain.handle('settings:moveAside', (): Promise<MoveAsideReply> => exclusive(moveSettingsAside))

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
      // Owner-only: an export may carry the tokens, when the user opted in.
      await writePrivateFile(filePath, JSON.stringify(data, null, 2))
      return true
    } catch {
      return false
    }
  })
}
