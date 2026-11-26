// Which addresses may leave the app, and which may replace the window. The
// renderer shows text from hosts and repositories — PR comments, READMEs, wiki
// pages, release notes — so a link in it is someone else's link. Pure, so both
// sides share one rule and the tests pin it.

/** The only schemes handed to the OS to open: a browser page or a mail draft. */
const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

/**
 * Whether `url` may be handed to the OS (`shell.openExternal`). Absolute
 * http(s) and mailto only: `file:`, `smb:`, custom app schemes and
 * protocol-relative `//host` would run or mount something on the machine.
 */
export function isAllowedExternalUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url || url.startsWith('//')) return false
  try {
    const parsed = new URL(url)
    if (!EXTERNAL_SCHEMES.has(parsed.protocol)) return false
    if (parsed.protocol === 'mailto:') return true
    // Spelled out as scheme://host: the URL parser reads `http:foo` as http://foo/.
    return /^https?:\/\/[^/]/i.test(url) && !!parsed.hostname
  } catch {
    return false
  }
}

/** The scheme alone, for a log line — never the address, which may carry a token or a path. */
export function getUrlScheme(url: unknown): string {
  if (typeof url !== 'string') return '(not a string)'
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url)
  return m ? `${m[1].toLowerCase()}:` : '(no scheme)'
}

/**
 * Whether a navigation of the main window stays on the app itself: the dev
 * server's origin, or — packaged — the very index.html it was loaded from.
 * Anything else would replace the app with a page that inherits its preload.
 */
export function isAppNavigation(url: string, appUrl: string): boolean {
  try {
    const to = new URL(url)
    const app = new URL(appUrl)
    if (app.protocol === 'file:') return to.protocol === 'file:' && to.pathname === app.pathname
    return to.origin === app.origin
  } catch {
    return false
  }
}

export type LinkClickAction = 'external' | 'in-page' | 'block'

/**
 * What a click on an `<a href>` in the renderer should do: open outside
 * (http, https, mailto), stay with the page (`#fragment`, which the page's own
 * handler may use), or nothing at all — a relative link in rendered Markdown
 * (`docs/setup.md`, `../x`) would otherwise navigate the whole window away.
 */
export function getLinkClickAction(href: string): LinkClickAction {
  if (href.startsWith('#')) return 'in-page'
  return isAllowedExternalUrl(href) ? 'external' : 'block'
}
