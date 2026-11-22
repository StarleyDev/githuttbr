/**
 * GitHub as an avatar source — the pure half, shared by both processes.
 *
 * A github.com noreply address names its account outright, so its picture needs
 * no API call at all (docs.github.com, "Email addresses reference" → "Your
 * noreply email address"):
 *
 *   ID+USERNAME@users.noreply.github.com   accounts since July 2017
 *   USERNAME@users.noreply.github.com      older accounts that kept the old form
 *
 * The first maps straight onto the avatar CDN by id. The second only names a
 * login, and `github.com/<login>.png` is the one URL that turns a login into a
 * picture: it answers 302 to `avatars.githubusercontent.com/u/<id>`, or 404 for
 * an unknown login, which the `<img>` treats like any other miss.
 *
 * GitHub Enterprise Server documents no noreply shape and serves avatars from a
 * host that depends on its subdomain-isolation setting, so a GHES address is
 * never guessed here — the API resolver (main/githubAvatarResolver.ts) asks the
 * server itself.
 */

const NOREPLY_DOMAIN = 'users.noreply.github.com'

/** GitHub logins: alphanumerics and single inner hyphens, at most 39 characters. */
const LOGIN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i

export interface GithubNoreply {
  /** Present for the ID+USERNAME form only. */
  id?: number
  login: string
}

/** The account a github.com noreply address names, or null for any other address. */
export function parseGithubNoreply(email: string | undefined): GithubNoreply | null {
  const norm = email?.trim().toLowerCase()
  if (!norm) return null
  const at = norm.lastIndexOf('@')
  if (at <= 0 || norm.slice(at + 1) !== NOREPLY_DOMAIN) return null
  const local = norm.slice(0, at)
  const plus = local.indexOf('+')
  if (plus === -1) return LOGIN.test(local) ? { login: local } : null
  const idPart = local.slice(0, plus)
  const login = local.slice(plus + 1)
  if (!/^[1-9]\d{0,15}$/.test(idPart) || !LOGIN.test(login)) return null
  const id = Number(idPart)
  return Number.isSafeInteger(id) ? { id, login } : null
}

/** The picture URL for a github.com noreply address, or null when it is not one. */
export function githubNoreplyAvatarUrl(email: string | undefined, size: number): string | null {
  const who = parseGithubNoreply(email)
  if (!who) return null
  const s = Math.max(1, Math.min(460, Math.round(size)))
  return who.id
    ? `https://avatars.githubusercontent.com/u/${who.id}?s=${s}`
    : `https://github.com/${encodeURIComponent(who.login)}.png?size=${s}`
}

/**
 * Whether an `avatar_url` an API answered with may be drawn: https, no
 * credentials or odd port, and served by the GitHub that answered — the CDN for
 * github.com, the server itself or one of its subdomains for a GHES (whose
 * `avatars.<host>` is the subdomain-isolation layout). Anything else is dropped
 * rather than rendered, so a hostile server cannot make the app load from a
 * third party.
 */
export function isGithubAvatarUrl(value: unknown, webBase: string): value is string {
  if (typeof value !== 'string') return false
  let url: URL
  let base: URL
  try {
    url = new URL(value)
    base = new URL(webBase)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  if (base.hostname.toLowerCase() === 'github.com') return !url.port && host === 'avatars.githubusercontent.com'
  const server = base.hostname.toLowerCase()
  if (host === server) return url.port === base.port
  return !url.port && host.endsWith(`.${server}`)
}

/** `avatar_url` with a size asked for; GitHub reads `s`, and keeps its own `v`. */
export function githubAvatarSized(url: string, size: number): string {
  const u = new URL(url)
  u.searchParams.set('s', String(Math.max(1, Math.min(460, Math.round(size)))))
  return u.toString()
}
