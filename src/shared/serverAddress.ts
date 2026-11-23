/**
 * Server addresses as the user typed them — a GitHub Enterprise Server, a
 * GitLab, a Bitbucket Data Center, a Forgejo — are plain settings: they sit in
 * the settings JSON, travel in exports and get quoted in error messages. A
 * `user:password@` or a `?access_token=` in one is a credential in all of
 * those places, so both helpers here cut it out.
 *
 * Everything up to the *last* `@` after the scheme goes, not only a userinfo a
 * URL parser recognises: a password holding a `/` ends the authority early
 * (`https://u:pa/ss@host` parses as host `u`), so the secret would otherwise
 * survive as "path". An `@` later in a path or query costs part of the address
 * — the safe direction to err in, and no valid server base has one there.
 */

const SCHEME = /^([a-z][a-z0-9+.-]*:\/\/)?([\s\S]*)$/i

/**
 * The address with any userinfo, query and fragment removed, scheme kept as
 * typed — what is safe to store. Unchanged (same string) when there was
 * nothing to remove, so a clean value is never rewritten.
 */
export function serverUrlWithoutSecrets(raw: string): string {
  if (!/[@?#]/.test(raw)) return raw
  const [, scheme = '', body = ''] = SCHEME.exec(raw.trim()) ?? []
  const at = body.lastIndexOf('@')
  const rest = (at < 0 ? body : body.slice(at + 1)).replace(/[?#][\s\S]*$/, '')
  return `${scheme}${rest}`
}

/**
 * An address made safe to show: host and path only, scheme and any
 * credential dropped. For one that does not normalise, too — an import or a
 * hand-edited file can carry anything.
 */
export function serverDisplayAddress(url: string): string {
  const noScheme = url.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const at = noScheme.lastIndexOf('@')
  const rest = at < 0 ? noScheme : noScheme.slice(at + 1)
  try {
    const u = new URL(`https://${rest}`)
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    // Not a URL (a port out of range, a space in the host): still never more
    // than host and path — a query or fragment can carry a token too.
    return rest.replace(/[?#][\s\S]*$/, '')
  }
}
