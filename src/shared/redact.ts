/**
 * Credential redaction shared by main (op log, toasts, clone tray) and the
 * renderer (repo-chat results sent to a model, bug reports). One
 * implementation, so a fix to the URL rule cannot land in one place and miss
 * the others.
 */

/**
 * `scheme://<userinfo>@` where userinfo runs up to the LAST `@` before the
 * URL ends (whitespace, a quote, `<`, `>` or a backtick). Stopping at the first
 * `/` instead — the obvious URL grammar — leaks a token that itself holds a
 * `/`: Bitbucket Data Center HTTP access tokens are base64, and git echoes the
 * URL exactly as it was given, unencoded. Over-redacting a path that happens
 * to hold an `@` is the price, and the safe direction to err in.
 */
const URL_USERINFO = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s'"<>`]*@/gi

/** Token shapes the hosts issue, caught even when they appear outside a URL. */
const BARE_TOKENS: RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bgl(?:pat|dt|ptt|rt|cbt|oas|imt|ft|soat)-[A-Za-z0-9_-]{16,}/g,
  /\bATATT[A-Za-z0-9_=+/-]{20,}/g,
  /\bBBDC-[A-Za-z0-9_=+/-]{16,}/g
]

/** Bitbucket's token username, `x-token-auth:<token>`, in a credential line
 *  rather than a URL (the URL rule already covers that form). */
const TOKEN_AUTH_PAIR = /\b(x-token-auth:)[^\s'"<>`@]+/gi

/** Replace the userinfo of every URL in `text` with `replacement` — `''`
 *  drops it, `@` included, so `https://u:p@host` reads `https://host`. */
export function redactUrlUserinfo(text: string, replacement: string): string {
  return text.replace(URL_USERINFO, replacement ? `$1${replacement}@` : '$1')
}

/** Replace every credential in `text` — URL userinfo and the known bare
 *  token shapes — with `mask`. */
export function redactSecrets(text: string, mask = '***'): string {
  let out = redactUrlUserinfo(text, mask)
  for (const re of BARE_TOKENS) out = out.replace(re, mask)
  return out.replace(TOKEN_AUTH_PAIR, `$1${mask}`)
}
