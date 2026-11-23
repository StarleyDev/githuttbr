/**
 * Pure decisions behind "Install 'githuttbr' command in PATH" — kept apart from
 * cli.ts (which needs Electron) so they are tested on their own
 * (test/cliInstall.test.ts).
 */
import type { CliInstallRefusal } from '../shared/cli'
import { isEphemeralAppPath } from './appImagePaths'

type Env = Record<string, string | undefined>

/**
 * One POSIX shell word, whatever the input: single-quoted, with each `'`
 * closed, escaped and reopened. Inside single quotes nothing is special — not
 * `$`, not a backtick, not a space — which is the property a root shell needs.
 */
export function posixQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** An AppleScript string literal: only `\` and `"` are special inside one. */
export function appleScriptString(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`
}

/** The `osascript -e` program that runs `command` as root behind the macOS
 *  authorization dialog. */
export function privilegedScript(command: string): string {
  return `do shell script ${appleScriptString(command)} with administrator privileges`
}

/** The root command that links the shim into a PATH directory. Every path is
 *  quoted: the bundle is "Git HuttBr.app", and a root shell splitting on its
 *  space is the least of what an unquoted path can do. */
export function privilegedLinkCommand(dir: string, shim: string, link: string): string {
  return `mkdir -p ${posixQuote(dir)} && ln -sf ${posixQuote(shim)} ${posixQuote(link)}`
}

export function privilegedUnlinkCommand(link: string): string {
  return `rm -f ${posixQuote(link)}`
}

/**
 * Why the shim at `shim` must not be linked into PATH, or null when it may.
 * Windows has no symlink-into-PATH convention. An AppImage's shim lives in a
 * per-launch /tmp mount: a link to it dangles once the app quits, and the next
 * `githuttbr` would run whatever another local user puts at that path.
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

/** A `githuttbr` symlink whose target lies in an AppImage mount — one an earlier
 *  AppImage build installed. Dangling, or worse, someone else's. */
export function isStaleCliTarget(target: string): boolean {
  // Judged on the name alone, never on whether it exists: a live target is
  // the attack, not the all-clear.
  return isEphemeralAppPath(target, {})
}
