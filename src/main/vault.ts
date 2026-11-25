import { app, ipcMain, safeStorage } from 'electron'
import { join } from 'path'
import { readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'node:crypto'
import type { VaultEntry, VaultListResult, VaultExport } from '../shared/types'
import type { BundleVaultEntry } from './secureBundle'
import { adoptExistingConsent, canUseKeychain, ensureKeychain, isKeychainWeak, sealSecret } from './keychain'
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
    const { result: plain, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(b64, 'base64'))
    data = { ...empty(), ...(JSON.parse(plain) as VaultData) }
    vaultUnreadable = false
    reEncrypt = shouldReEncrypt === true
  } catch {
    // Missing is an empty vault; present but unreadable is not (`vaultUnreadable`).
    vaultUnreadable = existsSync(filePath())
    return empty()
  }
  // Read with a key safeStorage is retiring: written back under the current
  // one. Not into a weak store, which would only re-seal it with the fixed
  // password. A failure leaves the readable file as it was.
  if (reEncrypt && !(await isKeychainWeak())) {
    await writeVault(data).catch((err) =>
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

async function writeVault(data: VaultData): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  // `allowWeak`: on Linux without a keyring the vault still saves to the
  // fixed-password store, because it has no session-only mode (see the
  // handbook's security page). Sealing through `sealSecret` still tells the
  // token store the session is weak.
  const enc = await sealSecret(JSON.stringify(data), { allowWeak: true })
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
 * readable again by whatever could read it, and never deleted by Gitcito —
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
  if (!(await ensureKeychain('vault'))) return closed()
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

/** Whole vault, for backup/transfer. Empty when OS encryption is unavailable. */
async function exportAll(): Promise<VaultExport> {
  if (!(await ensureKeychain('vault'))) return { repos: {}, global: [] }
  return exclusive(async () => {
    const data = await load()
    return { repos: data.repos, global: data.global }
  })
}

/** Merge an imported vault into the local one (incoming wins per id). No-op if
 *  OS encryption is unavailable (we can't safely persist secrets). Rejects
 *  (`VaultUnreadableError`) when the local vault could not be read: the import
 *  step fails visibly instead of replacing it. */
async function importAll(incoming: VaultExport): Promise<void> {
  if (!incoming || !(await ensureKeychain('vault'))) return
  await exclusive(async () => {
    const data = await load()
    data.global = mergeEntries(data.global, incoming.global ?? [])
    for (const [path, entries] of Object.entries(incoming.repos ?? {})) {
      data.repos[path] = mergeEntries(data.repos[path] ?? [], entries)
    }
    await save(data)
  })
}

/** Global vault secrets as portable bundle entries (no id/updatedAt). Empty when
 *  OS encryption is unavailable. Used by secure-share to pack a vault section. */
export async function exportGlobalEntries(): Promise<BundleVaultEntry[]> {
  if (!(await canUseKeychain())) return []
  return exclusive(async () => {
    const data = await load()
    return data.global.map((e) => ({ key: e.key, value: e.value, ...(e.note ? { note: e.note } : {}) }))
  })
}

/** Whether the vault on disk exists and cannot be read now. Never asks for consent. */
export async function isVaultUnreadable(): Promise<boolean> {
  if (!existsSync(filePath()) || !(await canUseKeychain())) return false
  return exclusive(async () => {
    await load()
    return vaultUnreadable
  })
}

/** Merge bundle vault entries into the global vault, matching by key (incoming
 *  value/note win). Returns how many were written; 0 if encryption unavailable.
 *  Rejects (`VaultUnreadableError`) when the local vault could not be read. */
export async function importGlobalEntries(entries: BundleVaultEntry[]): Promise<number> {
  if (entries.length === 0 || !(await ensureKeychain('vault'))) return 0
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
