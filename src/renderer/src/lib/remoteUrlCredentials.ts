import { redactUrlUserinfo } from '../../../shared/redact'
import type { RemoteUrlCredentials } from '../../../shared/types'
import type { TranslationKey } from '../i18n'

/**
 * A network operation refused for its credential — the replies git and the
 * hosts give when the password or token it sent is wrong, revoked or missing.
 * The same family `gitErrorHint` explains (`gitError.noCredential`,
 * `gitError.permissionDenied`, the bound-profile message), plus the hosts' own
 * "invalid username or token" lines that come before git's.
 */
const AUTH_FAILURE =
  /Authentication failed for|Invalid username or (?:password|token)|could not read (?:Username|Password)|returned error: 40[13]|HTTP Basic: Access denied|account is linked to the profile/i

export function isAuthFailureMessage(message: string): boolean {
  return AUTH_FAILURE.test(message)
}

/** The URL git names in its failure line, if any: `… for '<url>'` or `unable to access '<url>'`. */
function failingUrl(message: string): string | null {
  const m = /(?:failed for|unable to access|could not read (?:Username|Password) for) '([^']+)'/i.exec(message)
  return m ? m[1] : null
}

/** Compare URLs by what they point at: no userinfo, case, trailing slash or `.git`. */
function sameRepoUrl(a: string, b: string): boolean {
  const norm = (u: string): string =>
    redactUrlUserinfo(u, '')
      .toLowerCase()
      .replace(/\/+$/, '')
      .replace(/\.git$/, '')
  return norm(a) === norm(b)
}

/**
 * Which remote to blame for an authentication failure: the one whose URL holds
 * a password, because git sends that and ignores every credential helper —
 * the profile's token included. Null when the failure is not about a
 * credential, or no remote holding a password can be tied to it.
 *
 * Git names the URL it failed on; with it, only a remote with a password in
 * that very URL counts. Without it (a host that answers in its own words),
 * `remote` — when the caller knows which remote it used — or else the single
 * remote with a password in the repository, if there is exactly one.
 */
export function remoteToBlameForAuthFailure(
  message: string,
  creds: RemoteUrlCredentials[],
  remote?: string
): string | null {
  if (!isAuthFailureMessage(message)) return null
  const withPassword = creds.filter((c) => c.kind === 'password')
  if (!withPassword.length) return null
  const url = failingUrl(message)
  if (url) {
    const hit = withPassword.find((c) => c.urls.some((u) => u.kind === 'password' && sameRepoUrl(u.url, url)))
    return hit ? hit.remote : null
  }
  if (remote) return withPassword.some((c) => c.remote === remote) ? remote : null
  return withPassword.length === 1 ? withPassword[0].remote : null
}

/** The host of a clean `scheme://host[:port]/…` URL — the part a profile's token is saved for. */
function hostOfCleanUrl(url: string): string | null {
  return /^(?:[A-Za-z0-9+.-]+::)?[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#\\@]+)/.exec(url)?.[1] ?? null
}

export interface RemovalConfirmLine {
  key: TranslationKey
  vars?: Record<string, string>
}

/**
 * What the removal's confirmation says, in order, and whether it offers to add
 * a token first. A password in the URL is what signs in today; without a
 * profile token (or a helper answer) for its host, removing it leaves fetch and
 * push failing — so that comes first, with the way out next to Remove.
 */
export function removalConfirmPlan(
  creds: RemoteUrlCredentials[],
  remote: string,
  hasCredential: boolean
): { lines: RemovalConfirmLine[]; addTokenFirst: boolean } {
  const url = creds.find((c) => c.remote === remote)?.urls.find((u) => u.kind === 'password' && !u.ambiguous)?.url
  const host = (url && hostOfCleanUrl(url)) || remote
  const lines: RemovalConfirmLine[] = [
    { key: 'urlCred.confirmMessage', vars: { remote } },
    { key: 'urlCred.confirmUsername' },
    { key: 'urlCred.confirmNoUndo' },
    { key: 'urlCred.confirmRevoke' }
  ]
  if (!hasCredential) lines.unshift({ key: 'urlCred.noProfileToken', vars: { host } })
  return { lines, addTokenFirst: !hasCredential }
}
