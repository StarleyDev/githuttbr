/**
 * The names the operating system knows this app by — distinct from the name it
 * shows (`PRODUCT_NAME` in shared/brand.ts), which is free to change.
 *
 * Electron derives the settings folder and the OS keychain entry that encrypts
 * tokens ("<name> Safe Storage") from the app name, so these are pinned here
 * rather than read from the display name: renaming the product must never move
 * the settings or orphan the keychain entry again. Pure — no Electron — so the
 * CLI's headless half (cliEntry.ts) can use it too.
 */
import { join } from 'path'

/**
 * The package identity (`build.appId` in package.json): the macOS bundle id,
 * the Windows NSIS uninstall GUID and the updater's notion of "the same app".
 * The reverse-DNS form of git.huttbr.com. Up to 4.58 it was the identity
 * inherited from the app GitHuttBr was derived from, which made an install
 * replace (or collide with) a real install of that app; build/installer.nsh
 * removes such an old GitHuttBr install on Windows, and nothing else reads the
 * old value.
 */
export const BUNDLE_ID = 'com.huttbr.git'

/** `app.setName` for packaged builds: the userData folder and the keychain entry. */
export const APP_NAME = 'GitHuttBr'
/** Dev builds: a separate userData folder, its own single-instance lock. */
export const DEV_USER_DATA_DIR = 'githuttbr-dev'
/** Every file the app keeps in userData starts with this. */
export const FILE_PREFIX = 'githuttbr-'

export const SETTINGS_FILE = `${FILE_PREFIX}settings.json`

type Env = Record<string, string | undefined>

/** Electron's appData for this platform, computed without Electron (the CLI runs as plain Node). */
export function appDataDir(home: string, platform: NodeJS.Platform = process.platform, env: Env = process.env): string {
  if (platform === 'darwin') return join(home, 'Library', 'Application Support')
  if (platform === 'win32') return env['APPDATA'] ?? join(home, 'AppData', 'Roaming')
  return env['XDG_CONFIG_HOME'] ?? join(home, '.config')
}
