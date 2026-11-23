import type { TranslationKey } from '../i18n'

/**
 * Turn a raw git / host error into what it means and what to do about it.
 *
 * Errors reach a toast verbatim — git's English, wrapped in Electron's
 * "Error invoking remote method 'git': Error:" — which leaves the reader to
 * decode it, usually in a terminal. The common, well-understood ones get a
 * translated explanation with the next step; the raw text stays available as
 * the toast's details, and is still what "copy" and "report issue" use.
 *
 * Returns a dictionary key plus its values, never a string: the caller renders
 * it in the current language, and the matching stays testable on stable keys.
 * Null when nothing here recognises the error — the raw text is then shown.
 *
 * Not covered on purpose, because a dialog already handles them: a push
 * rejected as non-fast-forward (offers pull-and-retry) and a stale `.lock`
 * file (offers to remove it).
 */
export interface GitErrorHint {
  key: TranslationKey
  vars?: Record<string, string>
}

interface Rule {
  test: RegExp
  hint: (m: RegExpMatchArray) => GitErrorHint
}

const RULES: Rule[] = [
  {
    // GitHub refuses workflow edits from a credential without the workflow scope.
    // Which kind of credential it names decides the fix.
    test: /refusing to allow an? (OAuth App|Personal Access Token|GitHub App)[^`]*`([^`]+)` without `?workflow`? (?:scope|permission)/i,
    hint: (m) => ({
      key: /personal access token/i.test(m[1]) ? 'gitError.workflowScopeToken' : 'gitError.workflowScopeOAuth',
      vars: { file: m[2] }
    })
  },
  {
    test: /GH001: Large files detected|exceeds GitHub's file size limit/i,
    hint: (m) => {
      const file = /File (\S+) is [\d.]+ ?MB/i.exec(m.input ?? '')?.[1]
      return file ? { key: 'gitError.fileTooLarge', vars: { file } } : { key: 'gitError.fileTooLargeAny' }
    }
  },
  {
    test: /GH006: Protected branch update failed|protected branch hook declined|pre-receive hook declined.*protected/i,
    hint: () => ({ key: 'gitError.protectedBranch' })
  },
  {
    test: /could not read (?:Username|Password) for '([^']+)'|Authentication failed for '([^']+)'/i,
    hint: (m) => ({ key: 'gitError.noCredential', vars: { host: hostOf(m[1] ?? m[2] ?? '') } })
  },
  {
    test: /Permission to \S+ denied to|The requested URL returned error: 403/i,
    hint: () => ({ key: 'gitError.permissionDenied' })
  },
  {
    test: /remote: Repository not found|repository '[^']+' not found/i,
    hint: () => ({ key: 'gitError.repoNotFound' })
  },
  {
    test: /Permission denied \(publickey/i,
    hint: () => ({ key: 'gitError.sshKey' })
  },
  {
    // Forgejo / Gitea name the scope a token lacks; the fix is a new token,
    // because neither lets you change an existing token's scopes.
    test: /token does not have at least one of required scope\(s\): \[([^\]]+)\]/i,
    hint: (m) => ({ key: 'gitError.tokenScope', vars: { scopes: m[1] } })
  },
  {
    // GitLab's OAuth-style refusal for a token with too few scopes.
    test: /insufficient_scope/i,
    hint: () => ({ key: 'gitError.tokenScopeAny' })
  },
  {
    // gitCredentialEnv.ts nonCanonicalHostMessage — main has no language.
    test: /Refusing to use a profile's account for "(.+?)": git could read that server address as another server/,
    hint: (m) => ({ key: 'gitError.nonCanonicalHost', vars: { host: m[1] } })
  },
  {
    // hosting.ts boundNoCredentialMessage — main has no language.
    // The host is lazy up to the fixed sentence that follows, so a value with a
    // space in it (a provider name, when no host could be read) still matches.
    test: /No (.+?) account is linked to the profile "(.*)" this repository is bound to, for (.+?)\. Switch to that profile/,
    hint: (m) => ({ key: 'gitError.boundProfileNoCredential', vars: { provider: m[1], profile: m[2], host: m[3] } })
  },
  {
    // hosting.ts githubCredentialMessage: one sentence per GitHub CLI state
    // after a fixed lead. Not inside githubRepoError's "cannot see … private"
    // message, whose own lead the hint would otherwise drop.
    test: /(?<!probably private\. )No GitHub account is linked to this profile for (.+?)\. (GitHub CLI \(gh\) is not installed|GitHub CLI \(gh\) is installed but not authenticated|Checking the GitHub CLI \(gh\) timed out|GitHub CLI \(gh\) is signed in)/,
    hint: (m) => ({ key: GITHUB_CLI_STATE_KEYS[m[2]], vars: { host: m[1] } })
  },
  {
    // hosting.ts noLinkedAccountMessage — every other provider; the host is optional.
    test: /No (.+?) account is linked to this profile(?: for (.+?))?\. Sign in from Settings → Integrations to link a login/,
    hint: (m): GitErrorHint =>
      m[2]
        ? { key: 'gitError.noLinkedAccount', vars: { provider: m[1], host: m[2] } }
        : { key: 'gitError.noLinkedAccountAnyHost', vars: { provider: m[1] } }
  },
  {
    // bitbucketServer.ts BBS_USER_NOT_FOUND — main has no language.
    test: /Bitbucket Data Center: could not find your user on the server/,
    hint: () => ({ key: 'gitError.bbsUserNotFound' })
  },
  // hosting.ts — a server address no profile names, and a missing token for one
  // that does. Main has no language; each rule mirrors one message there.
  {
    test: /This GitHub Enterprise Server is not saved in any profile yet/,
    hint: () => ({ key: 'gitError.ghesNotSaved' })
  },
  {
    test: /This Bitbucket Data Center is not saved in any profile yet/,
    hint: () => ({ key: 'gitError.bbsNotSaved' })
  },
  {
    test: /This GitLab address is not saved in any profile yet/,
    hint: () => ({ key: 'gitError.gitlabNotSaved' })
  },
  {
    test: /No token for the GitHub Enterprise Server (.+?) is saved in this profile\./,
    hint: (m) => ({ key: 'gitError.ghesNoToken', vars: { host: m[1] } })
  },
  {
    test: /No HTTP access token for the Bitbucket Data Center (.+?) is saved in this profile\./,
    hint: (m) => ({ key: 'gitError.bbsNoToken', vars: { host: m[1] } })
  },
  {
    // hosting.ts HELD_TOKEN_TO_UNSAVED_SERVER
    test: /This token is already saved for another account or server, so it is not sent to a server no profile has saved yet/,
    hint: () => ({ key: 'gitError.heldTokenUnsavedServer' })
  },
  {
    test: /Browsing and creating repositories is not supported for Bitbucket Data Center yet/,
    hint: () => ({ key: 'gitError.bbsNoBrowse' })
  },
  {
    test: /Not a Bitbucket Data Center repository\./,
    hint: () => ({ key: 'gitError.notBbsRepo' })
  },
  // bitbucketServer.ts — BitbucketServerError, which prefixes "Bitbucket Data Center: ".
  {
    test: /Bitbucket Data Center: the server did not recognise this token/,
    hint: () => ({ key: 'gitError.bbsTokenUnrecognised' })
  },
  {
    test: /Bitbucket Data Center: a comment needs some text/,
    hint: () => ({ key: 'gitError.bbsCommentEmpty' })
  },
  {
    test: /Bitbucket Data Center: the server did not say who this token is/,
    hint: () => ({ key: 'gitError.bbsNoIdentity' })
  },
  {
    // bitbucketServer.ts bbsCannotMergeMessage: the code picks the sentence, and
    // only the server's own veto words are passed through — after main's fixed
    // conflicts sentence (which holds no ';') for `conflictsVetoed`.
    test: /Bitbucket Data Center: cannot merge \[(\w+)\] — ([\s\S]+)$/,
    hint: (m) => {
      const detail = m[2].trim()
      if (m[1] === 'conflicts') return { key: 'gitError.bbsMergeConflicts' }
      if (m[1] === 'notAllowed') return { key: 'gitError.bbsMergeNotAllowed' }
      if (m[1] === 'conflictsVetoed') {
        const reason = detail.slice(detail.indexOf('; ') + 2)
        return { key: 'gitError.bbsMergeConflictsVetoed', vars: { reason } }
      }
      return { key: 'gitError.bbsCannotMerge', vars: { reason: detail } }
    }
  },
  {
    test: /Bitbucket Data Center: this repository does not allow (\w+) merges/,
    hint: (m) => ({ key: 'gitError.bbsMethodNotAllowed', vars: { method: m[1] } })
  }
]

const GITHUB_CLI_STATE_KEYS: Record<string, TranslationKey> = {
  'GitHub CLI (gh) is not installed': 'gitError.githubNoCredentialGhMissing',
  'GitHub CLI (gh) is installed but not authenticated': 'gitError.githubNoCredentialGhSignedOut',
  'Checking the GitHub CLI (gh) timed out': 'gitError.githubNoCredentialGhUnknown',
  'GitHub CLI (gh) is signed in': 'gitError.githubNoCredentialGhSignedIn'
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Electron wraps every error thrown by a main-process handler in this prefix. */
const IPC_PREFIX = /^Error invoking remote method '[^']*': (?:\w*Error: )?/

/** The error without Electron's IPC wrapper — what the reader actually needs. */
export function withoutIpcPrefix(message: string): string {
  return message.replace(IPC_PREFIX, '')
}

/**
 * What to show for an error, in the current language: the explanation when one
 * matches, else git's text without Electron's wrapper. Pure — `t` and `interp`
 * come from the caller, so this stays usable outside React.
 */
export function readableError(
  message: string,
  t: (key: TranslationKey) => string,
  interp: (s: string, vars: Record<string, string>) => string
): string {
  const hint = explainGitError(message)
  return hint ? interp(t(hint.key), hint.vars ?? {}) : withoutIpcPrefix(message)
}

export function explainGitError(message: string): GitErrorHint | null {
  for (const rule of RULES) {
    const m = rule.test.exec(message)
    if (m) return rule.hint(m)
  }
  return null
}
