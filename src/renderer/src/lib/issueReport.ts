import { withoutIpcPrefix } from './gitErrorHint'
import { APP_ISSUES_NEW_URL } from '../../../shared/appRepo'
import { redactSecrets, redactUrlUserinfo } from '../../../shared/redact'

const ISSUES_NEW_URL = APP_ISSUES_NEW_URL

/** Hosts anyone can see: naming them in a report gives nothing away. */
const PUBLIC_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'gitlab.com',
  'bitbucket.org',
  'api.bitbucket.org',
  'dev.azure.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.groq.com',
  'api.mistral.ai',
  'generativelanguage.googleapis.com'
])

const isPublicHost = (host: string): boolean => PUBLIC_HOSTS.has(host.toLowerCase().replace(/:\d+$/, ''))

/**
 * AI key shapes, beyond the host token shapes `redactSecrets` already knows
 * (GitHub, GitLab, Atlassian, Bitbucket Data Center, Groq). Too loose for the
 * op log, where `sk-…` could be a branch name; here a lost word is cheap.
 */
const TOKENS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  // A credential after its scheme word has a digit somewhere; prose such as
  // "a token authentication" does not, and git's hint stays readable.
  /\b(Bearer|Basic|token)\s+(?=[A-Za-z._~+/=-]*\d)[A-Za-z0-9._~+/=-]{12,}/gi
]

/**
 * A credential by the name it is given — a query parameter, a header, a
 * config line: `access_token=…`, `x-access-token: …`, `api_key: "…"`. The
 * name stays (it says what failed); the value goes when it holds a digit or is
 * long, so "password: required" still reads.
 */
const NAMED_SECRET =
  /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|private[_-]?token|x-access-token|x-api-key|api[_-]?key|client[_-]?secret|secret[_-]?key|password|passwd)(["']?\s*[:=]\s*["']?)(?!<redacted>)(?=[^\s"'&,;<>]*\d|[^\s"'&,;<>]{16})[^\s"'&,;<>]{6,}/gi

/**
 * An IPv6 literal: bracketed as in a URL or bare as curl and Node print it,
 * with an optional zone (`fe80::1%eth0`). The candidates are checked in
 * `isIpv6`, so a clock time or a `Foo::bar` path is not one.
 */
const IPV6 = /\[([0-9a-f:]+)(%[\w.-]+)?\]|(?<![\w:.])([0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7})(%[\w.-]+)?(?![\w:])/gi

/** Compressed (`::`) or all eight groups, and a digit somewhere — never `12:30:45` or `a::b`. */
function isIpv6(candidate: string): boolean {
  if (!/\d/.test(candidate)) return false
  if (candidate.includes('::')) return !candidate.includes(':::')
  return candidate.split(':').length === 8
}

/**
 * What an error message may carry that is not the reader's business: a
 * credential in a URL, a token, the home folder (and so the user name), a
 * private server, its repositories, an e-mail or a LAN address. Opening the
 * pre-filled issue already sends the text to GitHub in the URL — before the
 * user decides to post it — so it is stripped here, not left to them.
 */
export function redactForReport(text: string): string {
  let out = text
  // Credentials written into a URL, before anything else reads the URL.
  out = redactSecrets(redactUrlUserinfo(out, ''), '<redacted>')
  for (const re of TOKENS) out = out.replace(re, '<redacted>')
  out = out.replace(NAMED_SECRET, '$1$2<redacted>')
  // URLs: a public host stays (it helps the diagnosis), a private one does not;
  // the path names repositories and organisations either way.
  out = out.replace(/\b([a-z][a-z0-9+.-]*):\/\/([a-z0-9[][^/\s?#'"`<>)]*)([^\s'"`<>)]*)/gi, (_m, scheme: string, host: string, rest: string) => {
    const shownHost = isPublicHost(host) ? host : '<host>'
    return `${scheme}://${shownHost}${rest && rest !== '/' ? '/…' : ''}`
  })
  // The messages main builds name a server and a profile by position, in any
  // form — a single-label host, one with a port, a profile name with spaces —
  // which no general pattern below could recognise. Their wording is a
  // contract with gitErrorHint, so it is fixed.
  for (const [re, parts] of MESSAGE_SHAPES) {
    out = out.replace(re, (...m: string[]) => parts.map((part, i) => redactPart(part, m[i + 1])).join(''))
  }
  // An IPv6 address names a machine as surely as a host name, and the host
  // rule below would read only its first group.
  out = out.replace(IPV6, (m: string, inBrackets?: string, _zone?: string, bare?: string) =>
    isIpv6(inBrackets ?? bare ?? '') ? '<ip>' : m
  )
  // A host named outside a URL: git, curl and ssh say which one they could not
  // reach, Node's resolver which one it could not find, and so does the
  // refusal to send an AI key over http. By position, so a single-label host
  // (`buildbox`) and an internationalised one go too.
  out = out.replace(
    /\b(resolve host:?|resolve hostname|connect to host|Failed to connect to|send the API key to|ENOTFOUND|EAI_AGAIN|EAI_NONAME)(\s+)([\p{L}\p{N}][\p{L}\p{N}_.-]*(?::\d+)?)/giu,
    (_m, lead: string, gap: string, host: string) => `${lead}${gap}${isPublicHost(host) ? host : '<host>'}`
  )
  // scp-style git remotes: git@host:owner/repo.git
  out = out.replace(/\b[\w.-]+@([\w.-]+):[\w./~-]+/g, (_m, host: string) =>
    isPublicHost(host) ? `git@${host}:…` : 'git@<host>:…'
  )
  // `git@` is the SSH user every host shares, not a person — and the remotes
  // above were already reduced to it.
  out = out.replace(/(?<![\w.+-])(?!git@)[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, '<email>')
  // `user@host` with a single-label host — ssh's `jane@buildbox`: both halves
  // are private. `HEAD@{1}` and `pkg@1.2.3` do not start the host with a letter.
  out = out.replace(/(?<![\w.+-])([\w.+-]+)@([A-Za-z][A-Za-z0-9-]*)(?![\w@:{/-]|\.[\w-])/g, (_m, user: string) =>
    user === 'git' ? 'git@<host>' : '<user>@<host>'
  )
  // The home folder names the user: keep the path from there on. A name with
  // spaces (`/Users/Jane Doe/`) counts only when a separator follows it, so
  // `/home/jane: not found` keeps its message. Windows first: its forward-slash
  // form holds `/Users/` too.
  out = out.replace(HOME_WINDOWS, '~').replace(HOME_POSIX, '~')
  // Any profile name that is quoted, in any quote style, whatever message it came in.
  out = out.replace(/\bprofile (["'“‘«„])[^"'”’»“\n]*(["'”’»“])/gi, 'profile $1<profile>$2')
  out = out.replace(/\b(10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})\b/g, '<lan-ip>')
  out = out.replace(/(?<![\w.])\d{1,3}(\.\d{1,3}){3}(?![\w.])/g, '<ip>')
  // Last, anything else shaped like a host name, wherever it stands: a private
  // server is a private server in any sentence (see looksLikeHost).
  out = out.replace(HOSTNAME, (m: string) => (looksLikeHost(m) && !isPublicHost(m) ? '<host>' : m))
  return out
}

const HOME_WINDOWS = /\b[A-Za-z]:[\\/]Users[\\/](?:[^\\/\s'"`:]+(?: [^\\/\s'"`:]+){1,3}(?=[\\/])|[^\\/\s'"`:]+)/g
const HOME_POSIX = /\/(?:home|Users)\/(?:[^/\s'"`:]+(?: [^/\s'"`:]+){1,3}(?=\/)|[^/\s'"`:]+)/g

/** Where a host, a profile or an organisation name sits in each message main builds (hosting.ts). */
type Part = string | 'host' | 'profile' | 'org'
const MESSAGE_SHAPES: [RegExp, Part[]][] = [
  // ghesNoTokenMessage, bbsNoTokenMessage
  [/(No token for the GitHub Enterprise Server )(.+?)( is saved in this profile\.)/g, ['', 'host', '']],
  [/(No HTTP access token for the Bitbucket Data Center )(.+?)( is saved in this profile\.)/g, ['', 'host', '']],
  // gitCredentialEnv.ts nonCanonicalHostMessage
  [/(Refusing to use a profile's account for ")(.+?)(": git could read)/g, ['', 'host', '']],
  // boundNoCredentialMessage
  [
    /(account is linked to the profile ")(.*?)(" this repository is bound to, for )(.+?)(\. Switch to that profile)/g,
    ['', 'profile', '', 'host', '']
  ],
  // githubCredentialMessage, noLinkedAccountMessage
  [/(account is linked to this profile for )(.+?)(\. (?:GitHub CLI|Checking the GitHub CLI|Sign in from))/g, ['', 'host', '']],
  // azureAuthError: the organisation is the company's name
  [/(has access to the ")(.*?)(" organization)/g, ['', 'org', '']],
  [/(Azure DevOps organization ")(.*?)(" was not found)/g, ['', 'org', '']]
]

/** Provider names stand where a host could not be read: nothing private. */
const PROVIDER_WORDS = new Set(['github', 'gitlab', 'bitbucket', 'azure', 'azure devops', 'forgejo'])

function redactPart(kind: Part, value: string): string {
  if (kind === 'profile') return '<profile>'
  if (kind === 'org') return '<org>'
  if (kind === 'host') return isPublicHost(value) || PROVIDER_WORDS.has(value.toLowerCase()) ? value : '<host>'
  return value
}

/**
 * A dotted name, with an optional port. It does not start inside a word or a
 * path (`src/main/git.ts` is a file, not a host) and runs to the end of the
 * name, so a match is never half a token.
 */
const HOSTNAME =
  /(?<![\w@/\\.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9](?::\d{1,5})?(?![\w-]|\.[a-z0-9])/gi

/**
 * File names a message mentions (`package.json`, `index.lock`, `vite.config.ts`)
 * look like host names too, and losing them costs the diagnosis. The price is
 * that a server under a TLD of the same spelling (`.sh`, `.md`, `.rs`, `.py`)
 * is kept: the known message shapes above still catch those by position.
 */
const FILE_EXTENSIONS = new Set(
  (
    'json md mdx ts tsx mts cts js jsx mjs cjs txt lock yml yaml toml xml html htm css scss less png jpg jpeg gif ' +
    'svg webp ico pdf zip gz tgz tar bz2 xz sh bash zsh fish ps1 bat cmd py rb go rs java kt kts c h cc cpp hpp cs ' +
    'swift php pl lua sql log ini cfg conf env patch diff orig rej bak enc tmp pack idx rev keep exe dll so dylib ' +
    'node wasm asar map vue svelte plist dmg deb rpm appimage msi pem pub crt csr gpg asc sig gitignore ' +
    'gitattributes gitmodules mailmap editorconfig'
  ).split(' ')
)

/**
 * Top-level labels that end a host and no identifier: a name written in mixed
 * case (`ghe.Acme.corp`, `Gitlab.Internal.Example`) is still a host when it
 * ends in one. Short on purpose — `.app`, `.test` and `.is` end method
 * names (`Electron.App`, `Pattern.test`, `Object.is`) too.
 */
const MIXED_CASE_TLDS = new Set(
  'com net org edu gov io co biz info corp internal intranet lan local localdomain example invalid cloud'.split(' ')
)

/**
 * Whether a dotted name is a host rather than code or a file: `litellm.Error`
 * and `AsyncCompletions.create` are identifiers (a camel-case label, or a
 * capitalised one not ending in a host's top-level label — host names are
 * mostly written in lower case, by every normaliser here and by git itself),
 * `package.json` is a file.
 */
function looksLikeHost(token: string): boolean {
  const name = token.replace(/:\d+$/, '')
  const labels = name.split('.')
  const tld = labels[labels.length - 1].toLowerCase()
  if (labels.some((l) => /[a-z][A-Z]/.test(l))) return false
  if (labels.some((l) => /^[A-Z][a-z]/.test(l))) return MIXED_CASE_TLDS.has(tld)
  return !FILE_EXTENSIONS.has(tld)
}

/** The title for a reported error: its first line, without the IPC wrapper that
 *  would otherwise use up the room before the actual problem. */
export function issueTitle(message: string): string {
  const firstLine = withoutIpcPrefix(redactForReport(message).split('\n')[0]).trim()
  return firstLine.length > 120 ? `${firstLine.slice(0, 119)}…` : firstLine
}

/** Pre-fills a GitHub issue with the failing error message, so a bug report
 *  takes one click instead of the user retyping what they just saw. The body
 *  keeps the whole message, wrapper included — it names the failing call —
 *  with private details removed first (see redactForReport). */
export function reportIssueUrl(message: string): string {
  const body = `**Error**\n\n\`\`\`\n${redactForReport(message)}\n\`\`\`\n`
  const params = new URLSearchParams({ title: issueTitle(message), body })
  return `${ISSUES_NEW_URL}?${params.toString()}`
}
