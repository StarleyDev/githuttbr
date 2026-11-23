/**
 * The one-time move from the pre-4.39 "Gitcito" userData folder.
 *
 * 4.39 renamed the app inside as well as on the label: the userData folder and
 * the OS keychain entry ("GitHuttBr Safe Storage") both follow the new name.
 * Plain data survives the move — the settings JSON (profiles, workspaces,
 * tabs, preferences), the repository list, the per-repo info and wikis, the
 * operation log, local usage stats, profile pictures, and Chromium's
 * `Local Storage` folder, where the renderer keeps its layout and toggles. The
 * encrypted token store, the vault and the keychain consent do not: they were
 * sealed with the old keychain entry, which the new name cannot open, so they
 * are left where they are and the user is told how to bring the tokens back
 * (an export made with tokens, or typing them again). Caches are not copied
 * either; they rebuild themselves.
 *
 * Conservative on purpose: it copies, never moves or deletes; it never
 * overwrites a file the new folder already has; it runs at most once — the
 * marker it leaves is authoritative, so resetting the new folder's settings
 * later does not drag the old ones back; and the copy carries no credential,
 * not even a plaintext token an older build or a keyring-less Linux left in
 * the settings file. No Electron here — the paths are passed in — so it is
 * tested directly (test/legacyMigration.test.ts).
 */
import { constants, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../shared/types'
import { stripSettingsSecrets } from '../shared/secrets'
import { FILE_PREFIX, LEGACY_APP_NAME, LEGACY_FILE_PREFIX, LEGACY_SETTINGS_FILE, SETTINGS_FILE } from './appIdentity'

/** Written once the migration has been decided; while it exists the migration never runs again. */
export const MIGRATION_MARKER = `${FILE_PREFIX}migration.json`

/**
 * Plain-data files carried over under the new prefix. Deliberately a list, not
 * "every gitcito-* file": `secrets.enc`, `vault.enc` and `keychain.json` must
 * never follow (sealed with the old keychain entry, or consent given to it),
 * and the caches (`models.json`, the avatar and release caches) refill alone.
 */
export const CARRIED_FILES = ['info.json', 'wiki.json', 'repos.json', 'log.json', 'analytics.json'] as const

/** Folders carried over as they are: profile pictures, and the renderer's localStorage. */
export const AVATARS_DIR = 'avatars'
export const LOCAL_STORAGE_DIR = 'Local Storage'

interface MigrationMarker {
  from: string
  at: number
  noticePending: boolean
}

export type LegacyMigrationResult = 'migrated' | 'already-migrated' | 'has-settings' | 'no-legacy' | 'unreadable'

function writeMarker(dir: string, noticePending: boolean, now: number): void {
  const marker: MigrationMarker = { from: LEGACY_APP_NAME, at: now, noticePending }
  writeFileSync(join(dir, MIGRATION_MARKER), JSON.stringify(marker, null, 2), { mode: 0o600 })
}

/** The settings, without credentials; false when there are none to copy or they cannot be read. */
function copySettings(newDir: string, legacyDir: string): boolean {
  try {
    const legacyFile = join(legacyDir, LEGACY_SETTINGS_FILE)
    if (!existsSync(legacyFile)) return false
    const parsed: unknown = JSON.parse(readFileSync(legacyFile, 'utf-8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    const clean = stripSettingsSecrets(parsed as AppSettings)
    // `wx`: if another start-up got here first, its copy stands.
    writeFileSync(join(newDir, SETTINGS_FILE), JSON.stringify(clean, null, 2), { mode: 0o600, flag: 'wx' })
    return true
  } catch {
    return false
  }
}

/** One file, never over an existing one. */
function copyIfAbsent(from: string, to: string): boolean {
  try {
    if (!existsSync(from)) return false
    copyFileSync(from, to, constants.COPYFILE_EXCL)
    return true
  } catch {
    return false
  }
}

/**
 * A folder, recursively, keeping whatever the destination already has.
 * `Local Storage` is a LevelDB database: merging two of them file by file
 * would corrupt both, so `wholeOnly` copies it only into a folder that has none.
 */
function copyDirIfAbsent(from: string, to: string, wholeOnly: boolean): boolean {
  try {
    if (!existsSync(from)) return false
    if (wholeOnly && existsSync(to)) return false
    cpSync(from, to, { recursive: true, force: false, errorOnExist: false })
    return true
  } catch {
    return false
  }
}

/**
 * Copies the old user data into `newDir` — settings without credentials, the
 * plain-data files, profile pictures and `Local Storage` — once. Never throws:
 * a failure leaves the app to start on defaults, exactly as a fresh install
 * would.
 */
export function migrateLegacyData(newDir: string, legacyDir: string, now = Date.now()): LegacyMigrationResult {
  try {
    if (existsSync(join(newDir, MIGRATION_MARKER))) return 'already-migrated'
    if (existsSync(join(newDir, SETTINGS_FILE))) {
      // A folder already in use: settle the question for good, without a notice.
      writeMarker(newDir, false, now)
      return 'has-settings'
    }
    if (!existsSync(legacyDir)) return 'no-legacy'
    mkdirSync(newDir, { recursive: true, mode: 0o700 })

    const settings = copySettings(newDir, legacyDir)
    let copied = settings ? 1 : 0
    for (const name of CARRIED_FILES) {
      if (copyIfAbsent(join(legacyDir, LEGACY_FILE_PREFIX + name), join(newDir, FILE_PREFIX + name))) copied++
    }
    if (copyDirIfAbsent(join(legacyDir, AVATARS_DIR), join(newDir, AVATARS_DIR), false)) copied++
    if (copyDirIfAbsent(join(legacyDir, LOCAL_STORAGE_DIR), join(newDir, LOCAL_STORAGE_DIR), true)) copied++

    if (copied === 0) return existsSync(join(legacyDir, LEGACY_SETTINGS_FILE)) ? 'unreadable' : 'no-legacy'
    writeMarker(newDir, true, now)
    return 'migrated'
  } catch {
    return 'unreadable'
  }
}

/**
 * The notice the migration owes, once: true the first time it is asked after a
 * migration, false ever after (the marker is rewritten before answering, so a
 * second window cannot show it again).
 */
export function takeMigrationNotice(dir: string): boolean {
  const file = join(dir, MIGRATION_MARKER)
  try {
    const marker = JSON.parse(readFileSync(file, 'utf-8')) as Partial<MigrationMarker>
    if (marker.noticePending !== true) return false
    writeFileSync(file, JSON.stringify({ ...marker, noticePending: false }, null, 2), { mode: 0o600 })
    return true
  } catch {
    return false
  }
}
