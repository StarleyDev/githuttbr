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

export type { UrlCredentialKind }

export interface UrlUserinfo {
  /** Null when the URL carries nothing in its userinfo, or cannot (scp-like, a path). */
  kind: UrlCredentialKind | null
  /** The URL the fix writes: no userinfo at all — except over ssh, where the
   *  user name is how ssh logs in, so only a password goes. Equal to the input
   *  when `kind` is null. */
  clean: string
  /** The URL with only the password removed — what is safe to show or send to
   *  the renderer. Equal to the input when there is no password. */
  withoutPassword: string
}

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//

/** ssh transports, where `user@` is how one logs in rather than a credential. */
const SSH_SCHEMES = new Set(['ssh', 'git+ssh', 'ssh+git'])

/**
 * A `user:secret/…@` authority — a password holding an unencoded `/`. Git ends
 * the authority at that `/` and reads no userinfo, so the request fails on a
 * nonsense host; the secret is still in `.git/config` in plain text, so it is
 * reported. A port (`host:8080/…@…`) has only digits after the `:` and is not.
 */
const PASSWORD_WITH_SLASH = /^[^/@:]*:(?!\d*\/)[^/@]*\/[^@]*@/

function unchanged(url: string): UrlUserinfo {
  return { kind: null, clean: url, withoutPassword: url }
}

/** Read the userinfo of `url`. */
export function readUrlUserinfo(url: string): UrlUserinfo {
  const scheme = SCHEME.exec(url)
  // scp-like `user@host:path` and local paths have no userinfo to speak of.
  if (!scheme) return unchanged(url)
  const prefix = scheme[0]
  const body = url.slice(prefix.length)
  const slash = body.indexOf('/')
  const authority = slash < 0 ? body : body.slice(0, slash)

  let at = authority.lastIndexOf('@')
  if (at < 0) {
    // The match ends on the first `@` past the slash: the one closing the userinfo.
    const slashed = PASSWORD_WITH_SLASH.exec(body)
    if (!slashed) return unchanged(url)
    at = slashed[0].length - 1
  }

  const userinfo = body.slice(0, at)
  const rest = body.slice(at + 1)
  const colon = userinfo.indexOf(':')
  const user = colon < 0 ? userinfo : userinfo.slice(0, colon)
  const password = colon < 0 ? '' : userinfo.slice(colon + 1)
  const ssh = SSH_SCHEMES.has(scheme[1].toLowerCase())
  const withUser = user ? `${prefix}${user}@${rest}` : `${prefix}${rest}`

  if (password) {
    return { kind: 'password', clean: ssh ? withUser : `${prefix}${rest}`, withoutPassword: withUser }
  }
  // `user:@host` holds an empty password: nothing secret, the same as `user@`.
  if (user && !ssh) return { kind: 'username', clean: `${prefix}${rest}`, withoutPassword: url }
  return unchanged(url)
}

/** `url` with any password removed and everything else as written. */
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
 * The remotes whose URLs carry a user name or a password, each URL in its
 * clean form. Remotes with nothing in their URLs are left out.
 */
export function remoteUrlCredentialsFrom(config: Map<string, ConfiguredRemoteUrls>): RemoteUrlCredentials[] {
  const out: RemoteUrlCredentials[] = []
  for (const [remote, { fetch, push }] of config) {
    const urls: RemoteUrlCredentialUrl[] = []
    for (const [role, list] of [['fetch', fetch], ['push', push]] as const) {
      for (const raw of list) {
        const { kind, clean } = readUrlUserinfo(raw)
        if (kind) urls.push({ role, kind, url: clean })
      }
    }
    if (!urls.length) continue
    const kind = urls.reduce<UrlCredentialKind | null>((k, u) => worseCredentialKind(k, u.kind), null) ?? 'username'
    out.push({ remote, kind, urls })
  }
  return out
}

/**
 * The `git config` values to write so `urls` carries no password: each value
 * with a password replaced by its clean form, the others kept as written.
 * Null when nothing in `urls` has a password — there is nothing to rewrite.
 */
export function urlsWithoutPasswords(urls: string[]): string[] | null {
  let changed = false
  const next = urls.map((u) => {
    const r = readUrlUserinfo(u)
    if (r.kind !== 'password') return u
    changed = true
    return r.clean
  })
  return changed ? next : null
}
