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
  // A host named outside a URL: git, curl and ssh say which one they could not
  // reach, and so does the refusal to send an AI key over http.
  out = out.replace(
    /\b(resolve host:?|resolve hostname|connect to host|Failed to connect to|send the API key to)(\s+)([a-z0-9][\w.-]*(?::\d+)?)/gi,
    (_m, lead: string, gap: string, host: string) => `${lead}${gap}${isPublicHost(host) ? host : '<host>'}`
  )
  // scp-style git remotes: git@host:owner/repo.git
  out = out.replace(/\b[\w.-]+@([\w.-]+):[\w./~-]+/g, (_m, host: string) =>
    isPublicHost(host) ? `git@${host}:…` : 'git@<host>:…'
  )
  // `git@` is the SSH user every host shares, not a person — and the remotes
  // above were already reduced to it.
  out = out.replace(/(?<![\w.+-])(?!git@)[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, '<email>')
  // The home folder names the user: keep the path from there on.
  out = out.replace(/\/home\/[^/\s'"]+/g, '~').replace(/\/Users\/[^/\s'"]+/g, '~')
  out = out.replace(/\b[A-Za-z]:\\Users\\[^\\\s'"]+/g, '~')
  // Any profile name that is quoted, whatever message it came in.
  out = out.replace(/\bprofile "[^"\n]*"/gi, 'profile "<profile>"')
  out = out.replace(/\b(10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})\b/g, '<lan-ip>')
  out = out.replace(/(?<![\w.])\d{1,3}(\.\d{1,3}){3}(?![\w.])/g, '<ip>')
  // Last, anything else shaped like a host name, wherever it stands: a private
  // server is a private server in any sentence (see looksLikeHost).
  out = out.replace(HOSTNAME, (m: string) => (looksLikeHost(m) && !isPublicHost(m) ? '<host>' : m))
  return out
}

/** Where a host and a profile name sit in each message main builds (hosting.ts). */
type Part = string | 'host' | 'profile'
const MESSAGE_SHAPES: [RegExp, Part[]][] = [
  // ghesNoTokenMessage, bbsNoTokenMessage
  [/(No token for the GitHub Enterprise Server )(.+?)( is saved in this profile\.)/g, ['', 'host', '']],
  [/(No HTTP access token for the Bitbucket Data Center )(.+?)( is saved in this profile\.)/g, ['', 'host', '']],
  // boundNoCredentialMessage
  [
    /(account is linked to the profile ")(.*?)(" this repository is bound to, for )(.+?)(\. Switch to that profile)/g,
    ['', 'profile', '', 'host', '']
  ],
  // githubCredentialMessage, noLinkedAccountMessage
  [/(account is linked to this profile for )(.+?)(\. (?:GitHub CLI|Checking the GitHub CLI|Sign in from))/g, ['', 'host', '']]
]

/** Provider names stand where a host could not be read: nothing private. */
const PROVIDER_WORDS = new Set(['github', 'gitlab', 'bitbucket', 'azure', 'azure devops', 'forgejo'])

function redactPart(kind: Part, value: string): string {
  if (kind === 'profile') return '<profile>'
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
 * Whether a dotted name is a host rather than code or a file: `litellm.Error`
 * and `AsyncCompletions.create` are identifiers (a capitalised or camel-case
 * label — host names are written in lower case by every normaliser here and by
 * git itself), `package.json` is a file.
 */
function looksLikeHost(token: string): boolean {
  const name = token.replace(/:\d+$/, '')
  const labels = name.split('.')
  if (labels.some((l) => /[a-z][A-Z]|^[A-Z][a-z]/.test(l))) return false
  return !FILE_EXTENSIONS.has(labels[labels.length - 1].toLowerCase())
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
