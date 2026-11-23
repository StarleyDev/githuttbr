/**
 * Settings outside the app that still name a shim the rename took away.
 *
 * 4.38 wrote absolute paths to its bundled converter (`…/cli/gitcito-textconv`)
 * into `diff.<name>.textconv`, and `editor install` set `core.editor` and
 * `sequence.editor` to `gitcito --wait`. 4.39 ships `githuttbr-textconv` and a
 * `githuttbr` command. The converter entries are ours by construction — only
 * the app ever wrote that file name — so they are repointed at the current
 * converter automatically (at start-up for the global config, on open for a
 * repository's), and a stub under the old name covers an install whose path
 * did not change. The editor settings are only recognised, so `githuttbr
 * doctor` can name the fix. Pure: everything is decided from strings, so the
 * decisions are tested on their own (test/legacyShims.test.ts).
 */

/** The bundled converter's file name before 4.39 (with or without a Windows extension). */
const LEGACY_TEXTCONV = /^gitcito-textconv(\.(cmd|bat|exe))?$/i

/**
 * The program word of a textconv command line. A quoted path keeps its
 * spaces; an unquoted one keeps backslash escapes (`/opt/Git\ HuttBr/…`) and
 * Windows separators exactly as written.
 */
const PROGRAM = /^\s*(?:"([^"]+)"|'([^']+)'|((?:\\.|[^\s\\])+\\?))/

function splitProgram(textconv: string): { program: string; rest: string } | null {
  const m = PROGRAM.exec(textconv)
  if (!m) return null
  return { program: m[1] ?? m[2] ?? m[3] ?? '', rest: textconv.slice(m[0].length).trimEnd() }
}

/** The last path segment, on either separator: the line may come from any platform's config. */
function programName(program: string): string {
  return program.split(/[\\/]/).pop() ?? ''
}

/**
 * True when a `textconv` command runs the pre-rename converter, in any
 * directory, quoted or not. Deliberately only that: "the absolute path is not
 * there" also fires on MSYS paths (`/c/Program Files/…`) and escaped Windows
 * paths this process cannot resolve, and a false "stale" invites the user to
 * delete a converter that works.
 */
export function isStaleTextconv(textconv: string): boolean {
  const parsed = splitProgram(textconv)
  return !!parsed && LEGACY_TEXTCONV.test(programName(parsed.program))
}

/**
 * The same command line with its pre-rename converter swapped for `current`
 * (quoted, as the app writes it) and every argument after it kept; null when
 * the line does not run the old converter or `current` cannot be quoted safely.
 */
export function repointLegacyTextconv(textconv: string, current: string): string | null {
  if (!current || current.includes('"') || !isStaleTextconv(textconv)) return null
  if (LEGACY_TEXTCONV.test(programName(current))) return null
  const parsed = splitProgram(textconv)
  return parsed ? `"${current}"${parsed.rest}` : null
}

/** One `diff.<name>.textconv` entry the repoint rewrote. */
export interface TextconvRepoint {
  name: string
  previous: string
  next: string
}

/**
 * Which `diff.<name>.textconv` entries of a `git config --get-regexp` listing
 * to rewrite, and to what. Nothing at all when `current` may not be persisted
 * (an AppImage's per-launch mount: the old entry keeps its stale badge
 * instead). Never an entry `ephemeral` flags either — it keeps its own badge
 * and Remove button, because an undo could not write it back.
 */
export function planTextconvRepoints(
  listing: string,
  current: string,
  opts: { blocked: boolean; ephemeral: (textconv: string) => boolean }
): TextconvRepoint[] {
  if (opts.blocked) return []
  const plan: TextconvRepoint[] = []
  for (const line of listing.split('\n')) {
    const space = line.indexOf(' ')
    if (space < 0) continue
    const name = /^diff\.(.+)\.textconv$/i.exec(line.slice(0, space))?.[1]
    const previous = line.slice(space + 1).trim()
    if (!name || !previous || opts.ephemeral(previous)) continue
    const next = repointLegacyTextconv(previous, current)
    if (next && next !== previous) plan.push({ name, previous, next })
  }
  return plan
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
