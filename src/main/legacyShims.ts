/**
 * The one setting outside the app that still names a converter this app no
 * longer ships.
 *
 * Builds up to 4.38 shipped their converter as `gitcito-textconv` and wrote its
 * absolute path into `diff.<name>.textconv` (in a repository's config, and
 * sometimes the global one). 4.39 renamed it `githuttbr-textconv`. Those entries
 * are repointed at the current converter, but only when the path is this
 * app's own install: upstream Gitcito ships a converter under the same file
 * name and writes the same kind of entry, and that one is never touched, not
 * even flagged. Ours is recognised by the install directory, which was always
 * named after this app ("Git HuttBr", "GitHuttBr", "githuttbr", or the
 * `.app` bundle) and never after Gitcito. Pure: everything is decided from
 * strings, so the decisions are tested on their own (test/legacyShims.test.ts).
 */

/** The bundled converter's file name before 4.39 (with or without a Windows extension). */
const OLD_TEXTCONV = /^gitcito-textconv(\.(cmd|bat|exe))?$/i

/** A directory of this app's own install, in any of the spellings it has had,
 *  escaped (`Git\ HuttBr`) or not, on either separator. */
const OWN_INSTALL_DIR = /(^|[\\/])git(\\? )?huttbr(\.app)?[\\/]/i

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
 * True when a `textconv` command runs this app's own pre-4.39 converter: the
 * old file name inside a directory of this app's install. Deliberately not
 * "the path is gone": that also fires on MSYS paths (`/c/Program Files/…`) and
 * escaped Windows paths this process cannot resolve, and a false "stale"
 * invites the user to delete a converter that works. Upstream Gitcito's
 * converter, which has the same file name, is never a match.
 */
export function isStaleTextconv(textconv: string): boolean {
  const parsed = splitProgram(textconv)
  return !!parsed && OLD_TEXTCONV.test(programName(parsed.program)) && OWN_INSTALL_DIR.test(parsed.program)
}

/**
 * The same command line with its pre-rename converter swapped for `current`
 * (quoted, as the app writes it) and every argument after it kept; null when
 * the line does not run the old converter or `current` cannot be quoted safely.
 */
export function repointLegacyTextconv(textconv: string, current: string): string | null {
  if (!current || current.includes('"') || !isStaleTextconv(textconv)) return null
  if (OLD_TEXTCONV.test(programName(current))) return null
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
