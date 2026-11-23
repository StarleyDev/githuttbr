/**
 * The name this build shows, and who it credits.
 *
 * GitHuttBr is built from Gitcito. Rather than rewrite "Gitcito" across the
 * sixteen dictionaries and the translated handbook — which would conflict with
 * every upstream update — the text stays as upstream writes it and is branded
 * at display time, through `brandText`. That covers the identifiers the fork
 * renamed too: the `gitcito` command, GITCITO_* variables, `.gitcito.json`,
 * `refs/gitcito/…`, `gitcito.*` config keys, `gitcito-*` file names and the
 * `.gitcito` bundle extension all read as their `githuttbr` names. Addresses
 * are never touched — a link to upstream Gitcito still has to work.
 */
export const PRODUCT_NAME = 'GitHuttBr'
export const AUTHOR_NAME = 'Starley - Mestre Jedi'
export const AUTHOR_URL = 'https://github.com/StarleyDev'

/**
 * Spans copied through unchanged: anything with a scheme (`https://…`), a bare
 * host path (`github.com/MyAppDesk/gitcito`, `myappdesk.github.io/gitcito`),
 * the upstream repository slug (`MyAppDesk/gitcito`) and email addresses. These
 * name upstream's real locations, so rewriting them would break the link.
 */
const PROTECTED = new RegExp(
  [
    String.raw`[a-z][a-z0-9+.\-]*:\/\/[^\s)<>"'\x60\]]+`,
    String.raw`\b(?:[a-z0-9\-]+\.)+(?:com|io|org|net|dev)\/[^\s)<>"'\x60\]]*`,
    String.raw`\bMyAppDesk\/[\w.\-]+`,
    String.raw`[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+`
  ].join('|'),
  'gi'
)

/** Applied in order to everything outside a protected span. */
const RULES: readonly [RegExp, string][] = [
  // The fork's own earlier spelling, still in some fork-written copy.
  [/Git HuttBr/g, PRODUCT_NAME],
  // The product as a word — also inside a path or file name, since the app's
  // folders and installer are named after it (~/Library/Logs/GitHuttBr,
  // GitHuttBr-Setup.exe). Not glued to a longer word, except a genitive s
  // ("Gitcitos eigene Lizenz"). A hyphen before it counts as glued only after
  // a Latin letter: Hebrew attaches prefixes that way (ב-Gitcito).
  [/(?<![A-Za-z0-9_]|[A-Za-z0-9_]-)Gitcito(s?)(?![A-Za-z0-9_])/g, `${PRODUCT_NAME}$1`],
  [/\bGITCITO(?=_)/g, 'GITHUTTBR'],
  // Stack metadata keys: branch.<name>.gitcitoparent / .gitcitobase.
  [/(?<=\.)gitcito(parent|base)\b/g, 'githuttbr$1'],
  // The lowercase identifier: the command, `.gitcito.json`, `.gitcito`
  // bundles, `gitcito.*` config keys, `refs/gitcito/`, `gitcito-ci`,
  // `gitcito-textconv`, `gitcito-settings.json`, /etc/apparmor.d/gitcito.
  [/(?<![A-Za-z0-9_]|[A-Za-z0-9_]-)gitcito(?![A-Za-z0-9_])/g, 'githuttbr'],
  [/(?<![\w/.\-])MyAppDesk(?![\w/\-])/g, AUTHOR_NAME]
]

function brandSpan(text: string): string {
  let out = text
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement)
  return out
}

export function brandText(text: string): string {
  let out = ''
  let last = 0
  for (const match of text.matchAll(PROTECTED)) {
    const at = match.index ?? 0
    out += brandSpan(text.slice(last, at)) + match[0]
    last = at + match[0].length
  }
  return out + brandSpan(text.slice(last))
}
