/**
 * Settings outside the app that still name a shim the rename took away.
 *
 * 4.38 wrote absolute paths to its bundled converter (`…/cli/gitcito-textconv`)
 * into `diff.<name>.textconv`, and `editor install` set `core.editor` and
 * `sequence.editor` to `gitcito --wait`. 4.39 ships `githuttbr-textconv` and a
 * `githuttbr` command, so those settings now fail at the next `git diff` or
 * `git commit`. Nothing rewrites them behind the user's back — they live in a
 * repository's or the user's git config — but they are recognised here so the
 * diff-driver list and `githuttbr doctor` can say so and name the fix. Pure: the
 * filesystem check is passed in, so the decisions are tested on their own.
 */
import { basename, isAbsolute, win32 } from 'path'
import { textconvProgram } from './appImagePaths'

/** The bundled converter's file name before 4.39 (with or without a Windows extension). */
const LEGACY_TEXTCONV = /^gitcito-textconv(\.(cmd|bat|exe))?$/i

/**
 * True when a `textconv` command runs the pre-rename converter, or an absolute
 * path that is no longer there — git fails the diff either way.
 */
export function isStaleTextconv(textconv: string, exists: (path: string) => boolean): boolean {
  const program = textconvProgram(textconv)
  if (!program) return false
  if (LEGACY_TEXTCONV.test(basename(program)) || LEGACY_TEXTCONV.test(win32.basename(program))) return true
  return (isAbsolute(program) || win32.isAbsolute(program)) && !exists(program)
}

/** The git editor settings `editor install` writes. */
export const EDITOR_KEYS = ['core.editor', 'sequence.editor'] as const

/** What `githuttbr editor install` writes, and what a stale setting should become. */
export const EDITOR_VALUE = 'githuttbr --wait'

/** True when an editor setting runs the pre-rename `gitcito` command (bare or by path) with `--wait`. */
export function isLegacyEditor(value: string): boolean {
  return /(^|[\s"'/\\])gitcito(\.(cmd|bat|exe))?["']?\s+--wait(\s|$)/i.test(value.trim())
}

/** The one command that repairs a stale editor setting, at the scope it was found in. */
export function editorFixCommand(key: string, scope: 'global' | 'local'): string {
  return `git config --${scope} ${key} "${EDITOR_VALUE}"`
}
