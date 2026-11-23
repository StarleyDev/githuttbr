/**
 * Hand git one credential for one server, for one command, without writing it
 * anywhere.
 *
 * The profile's PAT (or linked login) used to be spliced into the remote URL in
 * `.git/config` for the duration of a fetch or push and put back afterwards: a
 * crash in between left it on disk, two operations raced for `config.lock`, and
 * a read (`ls-remote`) had to put the token in its argv instead — readable by
 * any local user in the process list.
 *
 * Instead, git's own config-from-environment (`GIT_CONFIG_COUNT`/`KEY`/`VALUE`,
 * git ≥ 2.31) registers a credential helper for this server only, after an
 * empty entry that clears any helper the user configured for it — so the
 * profile's account answers, not whichever login the machine holds, and the
 * token is never offered to the helper to `store`. The helper is a shell
 * one-liner that prints the pair from two environment variables, so the secret
 * is in neither the config nor an argument list.
 *
 * The `credential.<url>` part of every key is built from the origin and a
 * configured server base only, in a percent-encoded spelling with nothing git
 * could split or read as a value (`credentialContexts`) — never from the
 * repository path a remote names.
 */

export const GIT_USERNAME_VAR = 'GITCITO_GIT_USERNAME'
export const GIT_PASSWORD_VAR = 'GITCITO_GIT_PASSWORD'

// Answers `get` only; `store` and `erase` are no-ops, so nothing persists it.
const helperCommand = (usernameVar: string, passwordVar: string): string =>
  `!f() { test "$1" = get || exit 0; printf 'username=%s\\npassword=%s\\n' "$${usernameVar}" "$${passwordVar}"; }; f`

export interface BasicCredential {
  username: string
  password: string
}

/**
 * Which URLs a credential (or its absence) is registered for: a server, never
 * one repository. `host`: the whole origin. `{ prefix }`: every repository
 * under one server's base, such as a Data Center at `https://host/bitbucket` —
 * a redirect inside it, and git-lfs asking about `<repo>.git/info/lfs`, are
 * still covered. `exclude` lists the other servers configured on the same
 * origin; one nested under `prefix` (a Data Center at `/bitbucket` beside a
 * GitLab at the root) gets its own empty helper entry, so the root server's
 * token is not offered there. git matches a path-scoped `credential.<url>`
 * entry against the path it asks about, at a `/` boundary, and applies every
 * entry that matches, in order.
 */
export type CredentialScope = 'host' | { prefix: string; exclude?: readonly string[] }

// A hostname as WHATWG leaves it for https (lower case, IDNA applied), or an
// IPv6 literal, and an optional port. WHATWG accepts `= ! $ ' ;` in a host, and
// the host is part of the config key — so anything else is refused.
const SAFE_HOST = /^(?:[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.?|\[[0-9a-f:.]+\])(?::\d{1,5})?$/

/**
 * A URL path in the one spelling that is safe inside a config key: each
 * segment decoded, then every byte but RFC 3986's unreserved ones
 * percent-encoded. `=`, `'`, `!`, `$`, `;`, spaces and line breaks can then
 * never appear raw — the old `'key=value'` form of `GIT_CONFIG_PARAMETERS`
 * splits at the first `=`, so a raw one let a path pick the value of a key, a
 * `!command` helper included. Null for a malformed percent sequence.
 */
export function encodeConfigPath(pathname: string): string | null {
  const out: string[] = []
  for (const segment of pathname.replace(/\/+$/, '').split('/')) {
    let raw: string
    try {
      raw = decodeURIComponent(segment)
    } catch {
      return null
    }
    let enc = ''
    for (const byte of Buffer.from(raw, 'utf8')) {
      const c = String.fromCharCode(byte)
      enc += /[A-Za-z0-9\-._~]/.test(c) ? c : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
    }
    out.push(enc)
  }
  return out.join('/')
}

/** `scheme://host[:port]` and the encoded path of `raw`; null when either is unsafe. */
function strictParts(raw: string, protocols: readonly string[]): { origin: string; path: string } | null {
  // WHATWG drops tabs and line breaks silently: the URL git reads would differ.
  if (/[\0-\x1f\x7f]/.test(raw)) return null
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (!protocols.includes(u.protocol) || !SAFE_HOST.test(u.host)) return null
  const path = encodeConfigPath(u.pathname)
  return path === null ? null : { origin: `${u.protocol}//${u.host}`, path }
}

/** Whether `path` is `prefix` or sits under it, at a `/` boundary. */
const within = (path: string, prefix: string): boolean => !prefix || path === prefix || path.startsWith(`${prefix}/`)

/** A server base as a `credential.<url>` context: no user, query or fragment. */
function baseParts(base: string, protocols: readonly string[]): { origin: string; path: string } | null {
  try {
    const b = new URL(base)
    if (b.username || b.password || b.search || b.hash) return null
  } catch {
    return null
  }
  return strictParts(base, protocols)
}

/**
 * The `credential.<url>` contexts for `url` under `scope`: where the entry
 * goes, and the nested servers carved out of it. Null when the scope does not
 * cover `url`, or when anything that would land in a key cannot be spelled
 * safely. Only the origin and a configured base ever reach the key.
 */
export function credentialContexts(
  url: string,
  scope: CredentialScope,
  protocols: readonly string[] = ['https:']
): { context: string; exclude: string[] } | null {
  const target = strictParts(url, protocols)
  if (!target) return null
  if (scope === 'host') return { context: target.origin, exclude: [] }
  const base = baseParts(scope.prefix, protocols)
  if (!base || base.origin !== target.origin || !within(target.path, base.path)) return null
  const exclude = new Set<string>()
  for (const other of scope.exclude ?? []) {
    const o = baseParts(other, protocols)
    // Only a server nested under this base needs carving out; one beside it or
    // above it is outside this entry already.
    if (!o || o.origin !== base.origin || o.path === base.path || !within(o.path, base.path)) continue
    // The repository sits under the nested server: this base is not its own.
    if (within(target.path, o.path)) return null
    exclude.add(o.origin + o.path)
  }
  return { context: base.origin + base.path, exclude: [...exclude] }
}

/** Fails loudly instead of handing git a key it would split or misread. */
function assertSafeKey(key: string): string {
  if (!/^credential\.https?:\/\/[A-Za-z0-9\-._~%:/[\]]+\.(?:helper|useHttpPath)$/.test(key)) {
    throw new Error('Refusing an unsafe credential config key.')
  }
  return key
}

/** Where entries appended to `base`'s `GIT_CONFIG_COUNT` start. */
function countAt(base: NodeJS.ProcessEnv): number {
  const n = Number.parseInt(base.GIT_CONFIG_COUNT ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** `pairs` as `GIT_CONFIG_COUNT` entries after whatever `base` already passes that way. */
function countEntries(base: NodeJS.ProcessEnv, pairs: ReadonlyArray<[string, string]>): NodeJS.ProcessEnv {
  // Append to config the caller may already pass this way rather than replace it.
  const at = countAt(base)
  const env: NodeJS.ProcessEnv = { GIT_CONFIG_COUNT: String(at + pairs.length) }
  pairs.forEach(([k, v], i) => {
    env[`GIT_CONFIG_KEY_${at + i}`] = assertSafeKey(k)
    env[`GIT_CONFIG_VALUE_${at + i}`] = v
  })
  return env
}

/**
 * Clear git's helpers for `context`, and make git-lfs send the path when it
 * asks: without `useHttpPath` it asks with none, which a path-scoped entry does
 * not match — so the token was withheld from it, or another login answered.
 */
const blanked = (context: string): Array<[string, string]> => [
  [`credential.${context}.helper`, ''],
  [`credential.${context}.useHttpPath`, 'true']
]

/**
 * Environment additions that make git authenticate `url`'s server with `cred`.
 * Null when it cannot apply: not https, an unparseable or unsafe URL, a scope
 * that does not cover it, or a value with a line break (the credential
 * protocol is line-based; such a value would add fields of its own).
 */
export function gitCredentialEnv(
  url: string,
  cred: BasicCredential,
  base: NodeJS.ProcessEnv = process.env,
  scope: CredentialScope = 'host'
): NodeJS.ProcessEnv | null {
  const ctx = credentialContexts(url, scope)
  if (!ctx) return null
  if (/[\r\n\0]/.test(cred.username) || /[\r\n\0]/.test(cred.password) || !cred.password) return null

  // Stacked on another server's entries (a multi-URL push), each needs its own
  // secret variables, or the second would answer for the first.
  const at = countAt(base)
  const usernameVar = at ? `${GIT_USERNAME_VAR}_${at}` : GIT_USERNAME_VAR
  const passwordVar = at ? `${GIT_PASSWORD_VAR}_${at}` : GIT_PASSWORD_VAR
  const [reset, httpPath] = blanked(ctx.context)
  const env = countEntries(base, [
    reset,
    [`credential.${ctx.context}.helper`, helperCommand(usernameVar, passwordVar)],
    httpPath,
    ...ctx.exclude.flatMap(blanked)
  ])
  return { ...env, [usernameVar]: cred.username, [passwordVar]: cred.password }
}

/**
 * Environment additions that make git ask `url`'s server as nobody: an empty
 * `credential.<url>.helper` entry with no helper after it, so a credential
 * manager holding another account's login for that host is never consulted.
 * `GIT_ASKPASS` set but empty also skips `core.askPass` and `SSH_ASKPASS` (git
 * takes the first one *set*, and runs it only when non-empty), and with
 * terminal prompts off a server that wants a login fails at once. Null for a
 * URL with no credential step (ssh, a path), or one that cannot be spelled
 * safely.
 *
 * `configCount` (git ≥ 2.31) puts the entries in `GIT_CONFIG_COUNT`, whose keys
 * git never splits. Older git — the one a distribution ships (Ubuntu 20.04:
 * 2.25), where a version refusal would turn the clone of a public repository
 * into an error — gets them in `GIT_CONFIG_PARAMETERS`, which is what `git -c`
 * sets, in the `'key=value'` form every git reads. That form splits at the
 * first `=`, which is why the key is only ever built from the encoded
 * spelling, and checked before it is written.
 */
export function anonymousGitEnv(
  url: string,
  base: NodeJS.ProcessEnv = process.env,
  scope: CredentialScope = 'host',
  opts: { configCount?: boolean } = {}
): NodeJS.ProcessEnv | null {
  const ctx = credentialContexts(url, scope, ['https:', 'http:'])
  if (!ctx) return null
  // A nested server's requests match the base's own empty entry already.
  const pairs = blanked(ctx.context)
  const prompt = { GIT_ASKPASS: '', GIT_TERMINAL_PROMPT: '0' }
  if (opts.configCount) return { ...countEntries(base, pairs), ...prompt }
  const entries = pairs.map(([k, v]) => sqQuote(`${assertSafeKey(k)}=${v}`)).join(' ')
  const before = base.GIT_CONFIG_PARAMETERS?.trim()
  return { GIT_CONFIG_PARAMETERS: before ? `${before} ${entries}` : entries, ...prompt }
}

/** git's own quoting for `GIT_CONFIG_PARAMETERS` (`sq_quote_buf`): `'` becomes `'\''`. */
const sqQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

/**
 * Whether an environment from this module needs config-from-environment
 * (`GIT_CONFIG_COUNT`, git 2.31): a credential does; going anonymous only in
 * the form a caller picks after seeing a git that has it.
 */
export function needsConfigEnv(env: NodeJS.ProcessEnv): boolean {
  return env.GIT_CONFIG_COUNT !== undefined
}

/** Config-from-environment (`GIT_CONFIG_COUNT`) arrived in git 2.31. */
export const MIN_GIT_FOR_CREDENTIAL_ENV = '2.31'

/**
 * Whether the output of `git --version` names a git that understands
 * config-from-environment. An output that cannot be read counts as supported:
 * a wrong guess then surfaces as git's own error, not a false refusal.
 */
export function gitSupportsCredentialEnv(versionOutput: string): { ok: boolean; found?: string } {
  const m = /(\d+)\.(\d+)/.exec(versionOutput)
  if (!m) return { ok: true }
  const major = Number(m[1])
  const minor = Number(m[2])
  return { ok: major > 2 || (major === 2 && minor >= 31), found: m[0] }
}
