/**
 * The one-time move from the pre-4.39 "Gitcito" userData folder.
 *
 * 4.39 renamed the app inside as well as on the label: the userData folder and
 * the OS keychain entry ("GitHuttBr Safe Storage") both follow the new name.
 * The settings JSON is plain data and survives the move — profiles, workspaces,
 * tabs, preferences. The encrypted token store, the vault and the keychain
 * consent do not: they were sealed with the old keychain entry, which the new
 * name cannot open, so they are left where they are and the user is told how
 * to bring the tokens back (an export made with tokens, or typing them again).
 *
 * Conservative on purpose: it copies, never moves or deletes; it runs only when
 * the new folder has no settings yet; and the copy carries no credential, not
 * even a plaintext token an older build or a keyring-less Linux left in the
 * file. No Electron here — the paths are passed in — so it is tested directly
 * (test/legacyMigration.test.ts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../shared/types'
import { stripSettingsSecrets } from '../shared/secrets'
import { FILE_PREFIX, LEGACY_APP_NAME, LEGACY_SETTINGS_FILE, SETTINGS_FILE } from './appIdentity'

/** Written next to the copied settings; says a notice is still owed. */
export const MIGRATION_MARKER = `${FILE_PREFIX}migration.json`

interface MigrationMarker {
  from: string
  at: number
  noticePending: boolean
}

export type LegacyMigrationResult = 'migrated' | 'has-settings' | 'no-legacy' | 'unreadable'

/**
 * Copies the old settings into `newDir`, without credentials, when `newDir`
 * has none and `legacyDir` does. Never throws: a failure leaves the app to
 * start on defaults, exactly as a fresh install would.
 */
export function migrateLegacySettings(newDir: string, legacyDir: string, now = Date.now()): LegacyMigrationResult {
  try {
    if (existsSync(join(newDir, SETTINGS_FILE))) return 'has-settings'
    const legacyFile = join(legacyDir, LEGACY_SETTINGS_FILE)
    if (!existsSync(legacyFile)) return 'no-legacy'
    const parsed: unknown = JSON.parse(readFileSync(legacyFile, 'utf-8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'unreadable'
    const clean = stripSettingsSecrets(parsed as AppSettings)
    mkdirSync(newDir, { recursive: true, mode: 0o700 })
    // `wx`: if another start-up got here first, its copy stands.
    writeFileSync(join(newDir, SETTINGS_FILE), JSON.stringify(clean, null, 2), { mode: 0o600, flag: 'wx' })
    const marker: MigrationMarker = { from: LEGACY_APP_NAME, at: now, noticePending: true }
    writeFileSync(join(newDir, MIGRATION_MARKER), JSON.stringify(marker, null, 2), { mode: 0o600 })
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
