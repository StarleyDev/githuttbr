import { app, ipcMain } from 'electron'
import { join } from 'path'
import { readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'node:crypto'
import type { VaultEntry, VaultListResult, VaultExport, VaultExportReply, VaultImportReply } from '../shared/types'
import type { BundleVaultEntry } from './secureBundle'
import { adoptExistingConsent, canUseKeychain, ensureKeychain, isKeychainWeak, openSecret, sealSecret } from './keychain'
import { copyPrivateFile, writePrivateFile } from './privateFile'

// A small local secrets store, encrypted at rest with the OS keychain via
// Electron safeStorage. Two scopes: per-repo entries (keyed by repo path) and a
// global set referenceable from any repo. Never synced, never leaves this box.

type Scope = 'repo' | 'global'

interface VaultData {
  repos: Record<string, VaultEntry[]>
  global: VaultEntry[]
}

const filePath = (): string => join(app.getPath('userData'), 'githuttbr-vault.enc')
const empty = (): VaultData => ({ repos: {}, global: [] })
const closed = (): VaultListResult => ({ available: false, repo: [], global: [] })
const unreadableResult = (): VaultListResult => ({ available: true, unreadable: true, repo: [], global: [] })

/**
 * A vault file exists but this session cannot read it — the keychain was
 * locked or access denied, a different app identity wrote it (dev vs
 * packaged), or the file is damaged. Distinct from "no vault": nothing derived
 * from our empty view of it is ever written over it — a save would leave a
 * vault holding only the entry just typed. Writes are refused (`save`) until
 * it reads again, or until the user chooses to start a new one, keeping the
 * old file as a backup (`replaceUnreadableVault`). The same rule as the
 * token store's `secretsUnreadable` in settings.ts.
 */
let vaultUnreadable = false

/** A vault write refused because the vault on disk could not be read. */
export class VaultUnreadableError extends Error {
  constructor() {
    super('The vault could not be read; it was left untouched.')
    this.name = 'VaultUnreadableError'
  }
}

/**
 * The vault could not be opened at all: the keychain is off, its question was
 * turned away ("not now"), or it did not answer in time (keychain.ts). Distinct
 * from unreadable — the file may be perfectly fine — but just as fatal to an
 * export or an import, which would otherwise carry or merge nothing, silently.
 */
export class VaultUnavailableError extends Error {
  constructor() {
    super('The vault could not be opened: the OS keychain is unavailable.')
    this.name = 'VaultUnavailableError'
  }
}

/**
 * Vault reads and writes run one at a time: each write derives the next vault
 * from the one it read, and two interleaved (an upsert and an import) lost one
 * of them. A read may write too, when it re-encrypts (`load`).
 */
let vaultChain: Promise<unknown> = Promise.resolve()
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = vaultChain.then(fn, fn)
  vaultChain = run.catch(() => undefined)
  return run
}

/** Runs inside `exclusive`. */
async function load(): Promise<VaultData> {
  let data: VaultData
  let reEncrypt: boolean
  try {
    const b64 = await readFile(filePath(), 'utf-8')
    const { plain, reseal } = await openSecret(Buffer.from(b64, 'base64'))
    data = { ...empty(), ...(JSON.parse(plain) as VaultData) }
    vaultUnreadable = false
    reEncrypt = reseal
  } catch {
    // Missing is an empty vault; present but unreadable is not (`vaultUnreadable`).
    vaultUnreadable = existsSync(filePath())
    return empty()
  }
  // Read with a key it should not stay on (`openSecret`'s `reseal`): written
  // back under the key in use. Not into a weak store, which would only re-seal it with the fixed
  // password — nor when the seal comes back `v10` anyway (`sealSecret` refuses
  // it, as for the token store). A failure leaves the readable file as it was.
  if (reEncrypt && !(await isKeychainWeak())) {
    await writeVault(data, { allowWeak: false }).catch((err) =>
      console.warn('[vault] not re-encrypted, retrying on next read:', (err as Error).message)
    )
  }
  return data
}

/** Runs inside `exclusive`. Never over a vault this session could not read. */
async function save(data: VaultData): Promise<void> {
  if (vaultUnreadable) throw new VaultUnreadableError()
  await writeVault(data)
}

async function writeVault(data: VaultData, opts: { allowWeak?: boolean } = {}): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  // `allowWeak` by default: on Linux without a keyring the vault still saves to
  // the fixed-password store, because it has no session-only mode (see the
  // handbook's security page). Sealing through `sealSecret` still tells the
  // token store the session is weak.
  const enc = await sealSecret(JSON.stringify(data), { allowWeak: opts.allowWeak ?? true })
  await writePrivateFile(filePath(), enc.toString('base64'))
}

/** A backup name no earlier backup has: one is never written over another. */
function backupTarget(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = `${filePath()}.bak-${stamp}`
  let target = base
  for (let n = 2; existsSync(target); n++) target = `${base}-${n}`
  return target
}

/**
 * The user chose to start a new vault over one this session cannot read (the
 * Vault page). The old file is kept beside it under a name of its own —
 * readable again by whatever could read it, and never deleted by GitHuttBr —
 * and the new vault starts empty.
 */
async function replaceUnreadableVault(): Promise<boolean> {
  if (!(await ensureKeychain('vault'))) return false
  return exclusive(async () => {
    // Read again: it may have become readable since the page said otherwise.
    await load()
    if (!vaultUnreadable || !existsSync(filePath())) return false
    await copyPrivateFile(filePath(), backupTarget())
    await writeVault(empty())
    vaultUnreadable = false
    return true
  })
}

function bucket(data: VaultData, scope: Scope, repoPath: string): VaultEntry[] {
  if (scope === 'global') return data.global
  return (data.repos[repoPath] ??= [])
}

function listed(data: VaultData, repoPath: string): VaultListResult {
  if (vaultUnreadable) return unreadableResult()
  return { available: true, repo: data.repos[repoPath] ?? [], global: data.global }
}

async function list(repoPath: string): Promise<VaultListResult> {
  // A vault file from before the consent gate means the OS prompt was already
  // answered once; don't make its owner do it again.
  await adoptExistingConsent([filePath()])
  // Opening the vault is an explicit ask for the thing the keychain protects,
  // so this is the right moment to explain and request access.
  // `onDisk`: whether closing it hides an existing vault, or there is none to hide.
  if (!(await ensureKeychain('vault'))) return { ...closed(), onDisk: existsSync(filePath()) }
  return exclusive(async () => listed(await load(), repoPath))
}

/**
 * Applies `change` to the vault and saves it — or, when the vault on disk
 * could not be read, changes nothing and says so (`unreadable`), for the page
 * to show.
 */
async function changeVault(repoPath: string, change: (data: VaultData) => void): Promise<VaultListResult> {
  if (!(await ensureKeychain('vault'))) return closed()
  return exclusive(async () => {
    const data = await load()
    if (vaultUnreadable) return unreadableResult()
    change(data)
    await save(data)
    return listed(data, repoPath)
  })
}

function upsert(scope: Scope, repoPath: string, entry: VaultEntry): Promise<VaultListResult> {
  return changeVault(repoPath, (data) => {
    const arr = bucket(data, scope, repoPath)
    const now = Date.now()
    if (entry.id) {
      const i = arr.findIndex((e) => e.id === entry.id)
      if (i >= 0) arr[i] = { ...entry, updatedAt: now }
      else arr.push({ ...entry, updatedAt: now })
    } else {
      arr.push({ ...entry, id: randomUUID(), updatedAt: now })
    }
  })
}

function remove(scope: Scope, repoPath: string, id: string): Promise<VaultListResult> {
  return changeVault(repoPath, (data) => {
    const arr = bucket(data, scope, repoPath)
    const i = arr.findIndex((e) => e.id === id)
    if (i >= 0) arr.splice(i, 1)
  })
}

/** Merge one entry list into another, incoming entries overriding by id. */
function mergeEntries(base: VaultEntry[], incoming: VaultEntry[]): VaultEntry[] {
  const byId = new Map(base.map((e) => [e.id, e]))
  for (const e of incoming) if (e.id) byId.set(e.id, e)
  return [...byId.values()]
}

/** Whole vault, for backup/transfer. `unreadable` when the vault could not be
 *  read, `unavailable` when it exists but the keychain cannot open it: either
 *  way the answer is empty, and must not stand in for the vault in a backup.
 *  No vault on disk and no keychain is simply an empty vault. */
async function exportAll(): Promise<VaultExportReply> {
  if (!(await ensureKeychain('vault'))) {
    return existsSync(filePath()) ? { repos: {}, global: [], unavailable: true } : { repos: {}, global: [] }
  }
  return exclusive(async () => {
    const data = await load()
    if (vaultUnreadable) return { repos: {}, global: [], unreadable: true }
    return { repos: data.repos, global: data.global }
  })
}

/** Whether an incoming vault carries any entry at all. */
function hasEntries(incoming: VaultExport): boolean {
  return (incoming.global?.length ?? 0) > 0 || Object.values(incoming.repos ?? {}).some((e) => e.length > 0)
}

/** Merge an imported vault into the local one (incoming wins per id). Answers
 *  `unavailable` when there is something to merge and the keychain cannot take
 *  it, `unreadable` when the local vault could not be read — merging nothing
 *  either way. A reply rather than a rejection, so the renderer can tell it
 *  from a failure and say which. */
async function importAll(incoming: VaultExport): Promise<VaultImportReply> {
  if (!incoming || !hasEntries(incoming)) return {}
  if (!(await ensureKeychain('vault'))) return { unavailable: true }
  return exclusive(async () => {
    const data = await load()
    if (vaultUnreadable) return { unreadable: true }
    data.global = mergeEntries(data.global, incoming.global ?? [])
    for (const [path, entries] of Object.entries(incoming.repos ?? {})) {
      data.repos[path] = mergeEntries(data.repos[path] ?? [], entries)
    }
    await save(data)
    return {}
  })
}

/** Global vault secrets as portable bundle entries (no id/updatedAt). Empty
 *  when there is no vault. Used by secure-share to pack a vault section.
 *  Rejects — `VaultUnavailableError` when a vault exists but the keychain
 *  cannot open it, `VaultUnreadableError` when it could not be read — so a
 *  bundle asked to carry the vault never silently carries nothing. */
export async function exportGlobalEntries(): Promise<BundleVaultEntry[]> {
  if (!(await canUseKeychain())) {
    if (existsSync(filePath())) throw new VaultUnavailableError()
    return []
  }
  return exclusive(async () => {
    const data = await load()
    if (vaultUnreadable) throw new VaultUnreadableError()
    return data.global.map((e) => ({ key: e.key, value: e.value, ...(e.note ? { note: e.note } : {}) }))
  })
}

/**
 * Whether entries could be merged into the vault now — asked the way the
 * import would ask: consent adopted, the keychain requested. Run before
 * anything else of a bundle is written, so the vault step cannot be the first
 * to find out after the files already landed. `unavailable`: the keychain
 * cannot take them (whether or not a vault exists, they would be dropped);
 * `unreadable`: the vault on disk could not be read.
 */
export async function checkVaultWritable(): Promise<'ok' | 'unavailable' | 'unreadable'> {
  await adoptExistingConsent([filePath()])
  if (!(await ensureKeychain('vault'))) return 'unavailable'
  if (!existsSync(filePath())) return 'ok'
  return exclusive(async () => {
    await load()
    return vaultUnreadable ? 'unreadable' : 'ok'
  })
}

/** Merge bundle vault entries into the global vault, matching by key (incoming
 *  value/note win). Returns how many were written. Rejects
 *  (`VaultUnavailableError`) when the keychain cannot take them, and
 *  (`VaultUnreadableError`) when the local vault could not be read. */
export async function importGlobalEntries(entries: BundleVaultEntry[]): Promise<number> {
  if (entries.length === 0) return 0
  if (!(await ensureKeychain('vault'))) throw new VaultUnavailableError()
  return exclusive(async () => {
    const data = await load()
    const now = Date.now()
    for (const inc of entries) {
      const existing = data.global.find((e) => e.key === inc.key)
      if (existing) {
        existing.value = inc.value
        existing.note = inc.note ?? existing.note
        existing.updatedAt = now
      } else {
        data.global.push({ id: randomUUID(), key: inc.key, value: inc.value, note: inc.note, updatedAt: now })
      }
    }
    await save(data)
    return entries.length
  })
}

export function registerVaultHandlers(): void {
  ipcMain.handle('vault:list', (_e, repoPath: string) => list(repoPath))
  ipcMain.handle('vault:upsert', (_e, scope: Scope, repoPath: string, entry: VaultEntry) =>
    upsert(scope, repoPath, entry)
  )
  ipcMain.handle('vault:remove', (_e, scope: Scope, repoPath: string, id: string) => remove(scope, repoPath, id))
  ipcMain.handle('vault:exportAll', () => exportAll())
  ipcMain.handle('vault:importAll', (_e, data: VaultExport) => importAll(data))
  ipcMain.handle('vault:replaceUnreadable', () => replaceUnreadableVault())
}
