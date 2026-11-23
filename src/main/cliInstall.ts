/**
 * Pure decisions behind "Install 'gitcito' command in PATH" — kept apart from
 * cli.ts (which needs Electron) so they are tested on their own
 * (test/cliInstall.test.ts).
 */
import type { CliInstallRefusal } from '../shared/cli'
import { isEphemeralAppPath } from './appImagePaths'

type Env = Record<string, string | undefined>

/**
 * Why the shim at `shim` must not be linked into PATH, or null when it may.
 * Windows has no symlink-into-PATH convention. An AppImage's shim lives in a
 * per-launch /tmp mount: a link to it dangles once the app quits, and the next
 * `gitcito` would run whatever another local user puts at that path.
 */
export function cliInstallRefusal(
  shim: string,
  platform: NodeJS.Platform,
  env: Env = process.env
): CliInstallRefusal | null {
  if (platform === 'win32') return 'windows'
  if (env['APPIMAGE'] || isEphemeralAppPath(shim, env)) return 'appimage'
  return null
}

/** A `gitcito` symlink whose target lies in an AppImage mount — one an earlier
 *  AppImage build installed. Dangling, or worse, someone else's. */
export function isStaleCliTarget(target: string): boolean {
  // Judged on the name alone, never on whether it exists: a live target is
  // the attack, not the all-clear.
  return isEphemeralAppPath(target, {})
}
