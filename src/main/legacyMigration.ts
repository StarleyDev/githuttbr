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
 * overwrites a file the new folder already has; it runs until everything has
 * been copied once, and never after — the marker it leaves is authoritative,
 * so resetting the new folder's settings later does not drag the old ones
 * back; and the copy carries no credential,
 * not even a plaintext token an older build or a keyring-less Linux left in
 * the settings file. No Electron here — the paths are passed in — so it is
 * tested directly (test/legacyMigration.test.ts).
 */
import {
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import type { AppSettings } from '../shared/types'
import { stripSettingsSecrets } from '../shared/secrets'
import { FILE_PREFIX, LEGACY_APP_NAME, LEGACY_FILE_PREFIX, LEGACY_SETTINGS_FILE, SETTINGS_FILE } from './appIdentity'

/** Written once the migration has been decided; while it exists the migration never runs again. */
export const MIGRATION_MARKER = `${FILE_PREFIX}migration.json`

/**
 * Present while a copy is under way. A start-up that finds it resumes the copy,
 * rather than taking the settings an interrupted attempt already wrote for "a
 * folder already in use" — which would settle the question with half the data
 * left behind.
 */
export const MIGRATION_PENDING = `${FILE_PREFIX}migration.pending`

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

export type LegacyMigrationResult =
  | 'migrated'
  | 'already-migrated'
  | 'has-settings'
  | 'no-legacy'
  | 'unreadable'
  /** A copy failed: no marker, so the next start retries whatever is still missing. */
  | 'incomplete'

/** One item: copied now, nothing to do (absent, or already there), or an error worth a retry. */
type CopyOutcome = 'copied' | 'skipped' | 'failed'

function writeMarker(dir: string, noticePending: boolean, now: number): void {
  const marker: MigrationMarker = { from: LEGACY_APP_NAME, at: now, noticePending }
  writeFileSync(join(dir, MIGRATION_MARKER), JSON.stringify(marker, null, 2), { mode: 0o600 })
}

function errCode(err: unknown): string {
  return (err as NodeJS.ErrnoException | null)?.code ?? ''
}

/**
 * The settings, without credentials. 'unreadable' for a file that is not
 * settings JSON: a retry cannot fix that, so it does not hold the marker back.
 */
function copySettings(newDir: string, legacyDir: string): CopyOutcome | 'unreadable' {
  const legacyFile = join(legacyDir, LEGACY_SETTINGS_FILE)
  if (!existsSync(legacyFile)) return 'skipped'
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(legacyFile, 'utf-8'))
  } catch (err) {
    return err instanceof SyntaxError ? 'unreadable' : 'failed'
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'unreadable'
  try {
    const clean = stripSettingsSecrets(parsed as AppSettings)
    // `wx`: if another start-up (or an interrupted attempt) got here first, its copy stands.
    writeFileSync(join(newDir, SETTINGS_FILE), JSON.stringify(clean, null, 2), { mode: 0o600, flag: 'wx' })
    return 'copied'
  } catch (err) {
    return errCode(err) === 'EEXIST' ? 'skipped' : 'failed'
  }
}

/** One file, never over an existing one. */
function copyIfAbsent(from: string, to: string): CopyOutcome {
  try {
    if (!existsSync(from)) return 'skipped'
    copyFileSync(from, to, constants.COPYFILE_EXCL)
    return 'copied'
  } catch (err) {
    return errCode(err) === 'EEXIST' ? 'skipped' : 'failed'
  }
}

/** A folder, recursively, keeping whatever the destination already has. */
function mergeDirIfAbsent(from: string, to: string): CopyOutcome {
  try {
    if (!existsSync(from)) return 'skipped'
    cpSync(from, to, { recursive: true, force: false, errorOnExist: false })
    return 'copied'
  } catch {
    return 'failed'
  }
}

/**
 * `Local Storage` is a LevelDB database: merging two of them file by file
 * would corrupt both, so it is copied only into a folder that has none — and
 * whole or not at all. The copy lands in a sibling first and is renamed into
 * place, so one that dies half way leaves no half database for Chromium to
 * open, nor a folder that would make the retry think it was already done.
 */
function copyDirWhole(from: string, to: string): CopyOutcome {
  if (!existsSync(from) || existsSync(to)) return 'skipped'
  const partial = `${to}.migrating`
  try {
    // Only ever ours: what an earlier attempt left when it died mid-copy.
    rmSync(partial, { recursive: true, force: true })
    cpSync(from, partial, { recursive: true, force: false, errorOnExist: true })
    renameSync(partial, to)
    return 'copied'
  } catch {
    try {
      rmSync(partial, { recursive: true, force: true })
    } catch {
      // The next attempt removes it before it copies.
    }
    return 'failed'
  }
}

/**
 * Copies the old user data into `newDir` — settings without credentials, the
 * plain-data files, profile pictures and `Local Storage`. Never throws: a
 * failure leaves the app to start on defaults, exactly as a fresh install
 * would. The marker is written only once every copy has succeeded; a failed
 * one is logged and retried at the next start, which never overwrites what the
 * earlier attempt (or the app since) put in the new folder.
 */
export function migrateLegacyData(newDir: string, legacyDir: string, now = Date.now()): LegacyMigrationResult {
  try {
    if (existsSync(join(newDir, MIGRATION_MARKER))) return 'already-migrated'
    const pending = join(newDir, MIGRATION_PENDING)
    const resuming = existsSync(pending)
    if (!resuming && existsSync(join(newDir, SETTINGS_FILE))) {
      // A folder already in use: settle the question for good, without a notice.
      writeMarker(newDir, false, now)
      return 'has-settings'
    }
    if (!existsSync(legacyDir)) {
      if (resuming) rmSync(pending, { force: true })
      return 'no-legacy'
    }
    mkdirSync(newDir, { recursive: true, mode: 0o700 })
    writeFileSync(pending, '', { mode: 0o600 })

    const settings = copySettings(newDir, legacyDir)
    const outcomes: CopyOutcome[] = [settings === 'unreadable' ? 'skipped' : settings]
    for (const name of CARRIED_FILES) {
      outcomes.push(copyIfAbsent(join(legacyDir, LEGACY_FILE_PREFIX + name), join(newDir, FILE_PREFIX + name)))
    }
    outcomes.push(mergeDirIfAbsent(join(legacyDir, AVATARS_DIR), join(newDir, AVATARS_DIR)))
    outcomes.push(copyDirWhole(join(legacyDir, LOCAL_STORAGE_DIR), join(newDir, LOCAL_STORAGE_DIR)))

    if (outcomes.includes('failed')) {
      console.warn('[migration] copying the 4.38 data was incomplete; it is retried at the next start')
      return 'incomplete'
    }
    if (!resuming && !outcomes.includes('copied')) {
      rmSync(pending, { force: true })
      return settings === 'unreadable' ? 'unreadable' : 'no-legacy'
    }
    writeMarker(newDir, true, now)
    rmSync(pending, { force: true })
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
