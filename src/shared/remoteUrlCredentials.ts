/**
 * What a remote URL carries in its userinfo (`scheme://user:password@host/…`),
 * read the way git reads it — as a string, not through WHATWG `URL`, which
 * lower-cases hosts, re-encodes paths and refuses forms git accepts. The
 * rewrites below must keep every other byte of the URL as it was written.
 *
 * A password in a remote URL wins over every credential helper, including the
 * one the app injects for the repository's profile: once that token is
 * revoked, every fetch and push fails while repositories next to it work. And
 * it sits in plain text in `.git/config`. A username alone is harmless — git
 * asks the helper for that user's password.
 *
 * Pure, shared by main (detection, the fix, what the renderer may see) and the
 * tests. Nothing here returns the userinfo itself.
 */

import type { RemoteUrlCredentialUrl, RemoteUrlCredentials, UrlCredentialKind } from './types'
import { redactUrlUserinfo } from './redact'

export type { UrlCredentialKind }

export interface UrlUserinfo {
  /** Null when the URL carries nothing in its userinfo, or cannot (scp-like, a path). */
  kind: UrlCredentialKind | null
  /**
   * A password is there, but where the host starts depends on who reads the
   * URL: an `@` after a `?` or `#` in the authority, or a password holding an
   * unencoded `/`. Cutting at the wrong `@` would move the remote to another
   * host, so such a URL is never rewritten automatically — only redacted for
   * display, greedily.
   */
  ambiguous: boolean
  /** The URL the fix writes: no userinfo at all — except over ssh, where the
   *  user name is how ssh logs in, so only a password goes. Equal to the input
   *  when `kind` is null or the reading is ambiguous: never show it then. */
  clean: string
  /** The URL with the password removed — what is safe to show or send to the
   *  renderer. Equal to the input when there is no password. */
  withoutPassword: string
  /**
   * For a password that can be removed: a `git config` value pattern (POSIX
   * ERE) matching this URL whatever its userinfo holds — built from the parts
   * around the userinfo only, so the secret never reaches an argument list.
   */
  valuePattern?: string
}

/** `text` with every POSIX ERE metacharacter escaped. */
function ereEscape(text: string): string {
  return text.replace(/[\\^$.|?*+()[\]{}]/g, '\\$&')
}

/** A remote helper's prefix (`gcrypt::`, `persistent-https::`): kept as written, the URL after it read. */
const TRANSPORT = /^[A-Za-z0-9+.-]+::/

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//

/** ssh transports, where `user@` is how one logs in rather than a credential. */
const SSH_SCHEMES = new Set(['ssh', 'git+ssh', 'ssh+git'])

/**
 * A `…:secret/…@` userinfo — a password holding an unencoded `/`, possibly
 * after a user name with an unencoded `@` (`me@corp.example:ab/cd@host/`). Git
 * and curl end the authority at that `/`, so they read another host; the
 * secret is still in `.git/config`. A port (`host:8080/…@…`) has only digits
 * after its `:` and is not one.
 */
const PASSWORD_WITH_SLASH = /^[^/?#\\]*:(?!\d*[/?#\\])[^/?#\\@]*\/[^@]*@/

/** `host`, `host:port`, `[v6]` or `[v6]:port` — nothing a password could be. */
const HOST_PORT = /^(?:\[[^\]]*\]|[^:[\]]*)(?::\d*)?$/

const unchanged = (url: string): UrlUserinfo => ({ kind: null, ambiguous: false, clean: url, withoutPassword: url })

/** A password is there but the host is not certain: report it, redact greedily, rewrite nothing. */
const ambiguousPassword = (url: string): UrlUserinfo => ({
  kind: 'password',
  ambiguous: true,
  clean: url,
  withoutPassword: redactUrlUserinfo(url, '***')
})

/** Read the userinfo of `url`. */
export function readUrlUserinfo(url: string): UrlUserinfo {
  const transport = TRANSPORT.exec(url)?.[0] ?? ''
  const address = url.slice(transport.length)
  const scheme = SCHEME.exec(address)
  // scp-like `user@host:path` and local paths have no userinfo to speak of.
  if (!scheme) return unchanged(url)
  const prefix = transport + scheme[0]
  const body = address.slice(scheme[0].length)

  // Everything before the first `/`. The path is never read for a userinfo.
  const slash = body.indexOf('/')
  const head = slash < 0 ? body : body.slice(0, slash)
  // The authority ends at the first `?`, `#` or `\` too, as git and curl end it.
  // A bracketed IPv6 host holds none of those, and its colons are no password.
  const end = head.search(/[?#\\]/)
  const authority = end < 0 ? head : head.slice(0, end)
  if (end >= 0 && head.slice(end).includes('@')) {
    // An `@` past a `?` or `#`: readers disagree on where the host starts.
    return /:[^@]+@/.test(head) ? ambiguousPassword(url) : unchanged(url)
  }
  // A host that reads as one — `name[:port]` or a bracketed IPv6 `[…][:port]` —
  // after the userinfo settles it; an `@` further on is the path's. Otherwise a
  // `:` before the first `/` with an `@` past it is a password with a slash in it.
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1)
  if (!HOST_PORT.test(hostPort) && PASSWORD_WITH_SLASH.test(body)) return ambiguousPassword(url)

  const at = authority.lastIndexOf('@')
  if (at < 0) return unchanged(url)
  const userinfo = body.slice(0, at)
  const rest = body.slice(at + 1)
  const colon = userinfo.indexOf(':')
  const user = colon < 0 ? userinfo : userinfo.slice(0, colon)
  const password = colon < 0 ? '' : userinfo.slice(colon + 1)
  const ssh = SSH_SCHEMES.has(scheme[1].toLowerCase())
  const withUser = user ? `${prefix}${user}@${rest}` : `${prefix}${rest}`

  if (password) {
    return {
      kind: 'password',
      ambiguous: false,
      clean: ssh ? withUser : `${prefix}${rest}`,
      withoutPassword: withUser,
      // Any `user:secret@` in front of this very address, and nothing else.
      valuePattern: `^${ereEscape(prefix)}[^/]*:[^/]*@${ereEscape(rest)}$`
    }
  }
  // `user:@host` holds an empty password: nothing secret, the same as `user@`.
  if (user && !ssh) return { kind: 'username', ambiguous: false, clean: `${prefix}${rest}`, withoutPassword: url }
  return unchanged(url)
}

/** `url` with any password removed — greedily when the reading is ambiguous. */
export function urlWithoutPassword(url: string): string {
  return readUrlUserinfo(url).withoutPassword
}

/** The worse of two readings: a password outranks a user name. */
export function worseCredentialKind(
  a: UrlCredentialKind | null | undefined,
  b: UrlCredentialKind | null | undefined
): UrlCredentialKind | null {
  if (a === 'password' || b === 'password') return 'password'
  return a ?? b ?? null
}

/** A remote's URLs as `.git/config` spells them, in file order. */
export interface ConfiguredRemoteUrls {
  /** `remote.<name>.url` — git fetches from the first, and pushes to all when there is no pushurl. */
  fetch: string[]
  /** `remote.<name>.pushurl` */
  push: string[]
}

/**
 * `git config -z --get-regexp '^remote\..*\.(url|pushurl)$'` → URLs per remote,
 * in the order the config lists them. `-z` ends each entry with NUL and puts a
 * newline between key and value, so a value cannot break the parse. A remote's
 * name may itself hold dots (`remote.team.mirror.url`): the variable is the
 * part after the last one.
 */
export function parseRemoteUrlConfig(out: string): Map<string, ConfiguredRemoteUrls> {
  const remotes = new Map<string, ConfiguredRemoteUrls>()
  for (const entry of out.split('\0')) {
    const nl = entry.indexOf('\n')
    if (nl < 0) continue
    const key = entry.slice(0, nl)
    const value = entry.slice(nl + 1)
    const dot = key.lastIndexOf('.')
    if (!key.startsWith('remote.') || dot <= 'remote.'.length) continue
    const variable = key.slice(dot + 1).toLowerCase()
    if (variable !== 'url' && variable !== 'pushurl') continue
    const name = key.slice('remote.'.length, dot)
    const urls = remotes.get(name) ?? { fetch: [], push: [] }
    ;(variable === 'url' ? urls.fetch : urls.push).push(value)
    remotes.set(name, urls)
  }
  return remotes
}

/**
 * The remotes whose URLs carry a user name or a password, each URL in a form
 * safe to show. Remotes with nothing in their URLs are left out.
 */
export function remoteUrlCredentialsFrom(config: Map<string, ConfiguredRemoteUrls>): RemoteUrlCredentials[] {
  const out: RemoteUrlCredentials[] = []
  for (const [remote, { fetch, push }] of config) {
    const urls: RemoteUrlCredentialUrl[] = []
    for (const [role, list] of [['fetch', fetch], ['push', push]] as const) {
      for (const raw of list) {
        const r = readUrlUserinfo(raw)
        if (!r.kind) continue
        // An ambiguous `clean` is the raw URL: only its greedy redaction may leave.
        urls.push(r.ambiguous ? { role, kind: r.kind, url: r.withoutPassword, ambiguous: true } : { role, kind: r.kind, url: r.clean })
      }
    }
    if (!urls.length) continue
    const kind = urls.reduce<UrlCredentialKind | null>((k, u) => worseCredentialKind(k, u.kind), null) ?? 'username'
    const removable = kind === 'password' && !urls.some((u) => u.ambiguous)
    out.push({ remote, kind, removable, urls })
  }
  return out
}

/** Whether any of `urls` holds a password whose host cannot be told for certain. */
export function hasAmbiguousPassword(urls: string[]): boolean {
  return urls.some((u) => readUrlUserinfo(u).ambiguous)
}

/**
 * The `git config --replace-all <key> <value> <pattern>` steps that take every
 * password out of `urls`: one per distinct address, each matching only the
 * values that hold a password in front of it. Each step rewrites its lines in
 * place, so the other URLs and their order survive whichever step fails, and
 * neither the old value nor the secret is ever named. Empty when there is no
 * password; an ambiguous value is skipped — callers refuse those first.
 */
export function passwordRewrites(urls: string[]): Array<{ pattern: string; value: string }> {
  const steps = new Map<string, string>()
  for (const u of urls) {
    const r = readUrlUserinfo(u)
    if (r.kind === 'password' && !r.ambiguous && r.valuePattern) steps.set(r.valuePattern, r.clean)
  }
  return [...steps].map(([pattern, value]) => ({ pattern, value }))
}
