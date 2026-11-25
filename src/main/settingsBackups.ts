import { app, ipcMain, shell } from 'electron'
import { join } from 'path'
import { mkdir, readdir, readFile, rm } from 'fs/promises'
import type { SettingsBackup } from '../shared/types'
import { backupFileName, backupsToPrune, parseBackupFileName, sortBackups } from '../shared/rollback'
import { changedSettingsKeys } from '../shared/settingsFormat'
import { writePrivateFile } from './privateFile'
import { readSettings, restoreSettingsFrom, settingsForBackup, settingsNow } from './settings'

/**
 * Copies of the settings file taken before every version switch — a rollback
 * or an update — so a switch that goes wrong costs nothing: Settings → About
 * lists them, restores one, or shows the folder. Copies never hold a
 * credential (`settingsForBackup`); tokens and keys stay in the keychain store,
 * which no version switch touches. The newest `BACKUPS_KEPT` are kept.
 */
const backupDir = (): string => join(app.getPath('userData'), 'settings-backups')

export async function listSettingsBackups(): Promise<SettingsBackup[]> {
  let names: string[]
  try {
    names = await readdir(backupDir())
  } catch {
    return []
  }
  return sortBackups(names.map(parseBackupFileName).filter((b): b is SettingsBackup => b !== null))
}

/**
 * A copy of the settings now, named after the running version, the one being
 * switched to and why. Null when there is nothing to copy (no file yet, or one
 * that does not parse — a broken file is moved aside elsewhere, never copied).
 * Never throws: a copy that could not be made must not block the switch it
 * protects, but the caller hears it as null.
 */
export async function backupSettings(target: string, reason: SettingsBackup['reason']): Promise<SettingsBackup | null> {
  try {
    const data = await settingsForBackup()
    if (!data) return null
    await mkdir(backupDir(), { recursive: true })
    const existing = await listSettingsBackups()
    // The same update downloaded twice (a re-check, a restart before installing)
    // is one switch: its newer copy replaces the older instead of using a slot.
    const version = app.getVersion()
    for (const b of existing) {
      if (reason === 'update' && b.reason === 'update' && b.version === version && b.target === target) {
        await rm(join(backupDir(), b.name), { force: true })
      }
    }
    const createdAt = new Date().toISOString()
    const name = backupFileName(version, target, reason, createdAt)
    // Owner-only and atomic, like the settings file itself.
    await writePrivateFile(join(backupDir(), name), JSON.stringify(data, null, 2))
    await pruneSettingsBackups()
    return { name, version, target, reason, createdAt }
  } catch (err) {
    console.warn('[settings-backups] could not copy the settings:', (err as Error).message)
    return null
  }
}

async function pruneSettingsBackups(): Promise<void> {
  // The copy a pending rollback points at is what "restore after updating" offers: kept however old.
  const protect = (await readSettings().catch(() => null))?.versionRollback?.backup
  for (const name of backupsToPrune(await listSettingsBackups(), undefined, protect)) {
    await rm(join(backupDir(), name), { force: true }).catch(() => undefined)
  }
}

/** A copy by name — only a name the folder's own pattern produces, so no path from IPC reaches the disk. */
async function readSettingsBackup(name: unknown): Promise<Record<string, unknown> | null> {
  if (typeof name !== 'string' || !parseBackupFileName(name)) return null
  try {
    const parsed: unknown = JSON.parse(await readFile(join(backupDir(), name), 'utf-8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export type RestoreBackupResult = 'ok' | 'missing' | 'not-loaded'

/** Restores a copy — after copying the settings as they are, so a restore is itself undoable. */
async function restoreSettingsBackup(name: unknown): Promise<RestoreBackupResult> {
  const copy = await readSettingsBackup(name)
  if (!copy) return 'missing'
  await backupSettings(app.getVersion(), 'restore')
  return restoreSettingsFrom(copy)
}

/** The settings keys changed since a copy was taken; null when the copy is gone. */
async function changedSinceBackup(name: unknown): Promise<string[] | null> {
  const copy = await readSettingsBackup(name)
  if (!copy) return null
  return changedSettingsKeys(copy, (await settingsNow()) ?? {})
}

export function registerSettingsBackupHandlers(): void {
  ipcMain.handle('settingsBackups:list', () => listSettingsBackups())
  ipcMain.handle('settingsBackups:restore', (_e, name: unknown) => restoreSettingsBackup(name))
  ipcMain.handle('settingsBackups:changedSince', (_e, name: unknown) => changedSinceBackup(name))
  ipcMain.handle('settingsBackups:reveal', async (_e, name: unknown) => {
    if (typeof name === 'string' && parseBackupFileName(name)) shell.showItemInFolder(join(backupDir(), name))
    else await shell.openPath(backupDir())
  })
}
