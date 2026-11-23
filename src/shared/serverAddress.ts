/**
 * Server addresses as the user typed them — a GitHub Enterprise Server, a
 * GitLab, a Bitbucket Data Center, a Forgejo — are plain settings: they sit in
 * the settings JSON, travel in exports and get quoted in error messages. A
 * `user:password@` or a `?access_token=` in one is a credential in all of
 * those places, so both helpers here cut it out.
 *
 * The query and fragment go first: an `@` in them (`/sign_in?next=a@evil`) is
 * not a userinfo, and reading it as one would swap the host for whatever
 * follows it. What is left loses everything up to its *last* `@`, not only a
 * userinfo a URL parser recognises: a password holding a `/` ends the
 * authority early (`https://u:pa/ss@host` parses as host `u`), so the secret
 * would otherwise survive as "path". An `@` that only comes after a `/`
 * counts as that case when the part before the `/` reads `user:secret`
 * (`USERINFO_SLASH`); a plain `host/path@x` keeps its host.
 */

const SCHEME = /^([a-z][a-z0-9+.-]*:\/\/)?([\s\S]*)$/i

/**
 * A `user:…` before the first `/` — the shape of a password with a `/` in it.
 * `host:port/x@y` reads the same, and loses its host: the safe way round, as
 * no secret is kept and the foreign host left over is no server anyone saved
 * a token for.
 */
const USERINFO_SLASH = /^[^/@]*:[^/@]*\//

/** Where the host starts in `body` (scheme, query and fragment already gone): past the userinfo's `@`. */
function hostStart(body: string): number {
  const slash = body.indexOf('/')
  const authority = slash < 0 ? body : body.slice(0, slash)
  if (authority.includes('@') || USERINFO_SLASH.test(body)) return body.lastIndexOf('@') + 1
  return 0
}

/** `rest` without a query or fragment. */
const withoutQuery = (rest: string): string => rest.replace(/[?#][\s\S]*$/, '')

/**
 * The address with any userinfo, query and fragment removed, scheme kept as
 * typed — what is safe to store. Unchanged (same string) when there was
 * nothing to remove, so a clean value is never rewritten. Empty when no host
 * is left (`https://u@`, `https://?x`): there is no address to keep, and `''`
 * is refused by every validator, where `https://` would reach `new URL` and
 * throw. Empty rather than null, because the result is stored straight back
 * into a `url: string` field.
 */
export function serverUrlWithoutSecrets(raw: string): string {
  if (!/[@?#]/.test(raw)) return raw
  const [, scheme = '', body = ''] = SCHEME.exec(raw.trim()) ?? []
  const path = withoutQuery(body)
  const rest = path.slice(hostStart(path))
  if (!rest.replace(/[/:][\s\S]*$/, '').trim()) return ''
  return `${scheme}${rest}`
}

/**
 * An address made safe to show: host and path only, scheme and any
 * credential dropped. For one that does not normalise, too — an import or a
 * hand-edited file can carry anything.
 */
export function serverDisplayAddress(url: string): string {
  const noScheme = withoutQuery(url.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''))
  const rest = noScheme.slice(hostStart(noScheme))
  try {
    const u = new URL(`https://${rest}`)
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    // Not a URL (a port out of range, a space in the host): still never more
    // than host and path — the query and fragment are already gone.
    return rest
  }
}
