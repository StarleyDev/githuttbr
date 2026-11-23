import { describe, it, expect } from 'vitest'
import { explainGitError, readableError, withoutIpcPrefix } from '../src/renderer/src/lib/gitErrorHint'

const IPC = "Error invoking remote method 'git': Error: "

describe('explainGitError', () => {
  it('names the workflow file and tells an OAuth login apart from a personal access token', () => {
    const oauth =
      IPC +
      'To https://github.com/o/r.git\n ! [remote rejected] main -> main (refusing to allow an OAuth App to ' +
      'create or update workflow `.github/workflows/build.yml` without `workflow` scope)'
    expect(explainGitError(oauth)).toEqual({
      key: 'gitError.workflowScopeOAuth',
      vars: { file: '.github/workflows/build.yml' }
    })
    const pat = oauth.replace('an OAuth App', 'a Personal Access Token')
    expect(explainGitError(pat)?.key).toBe('gitError.workflowScopeToken')
  })

  it('names the oversized file when GitHub reports it, and falls back when it does not', () => {
    const named =
      'remote: error: File assets/video.mp4 is 142.31 MB; this exceeds GitHub\'s file size limit of 100.00 MB\n' +
      'remote: error: GH001: Large files detected.'
    expect(explainGitError(named)).toEqual({ key: 'gitError.fileTooLarge', vars: { file: 'assets/video.mp4' } })
    expect(explainGitError('remote: error: GH001: Large files detected.')).toEqual({ key: 'gitError.fileTooLargeAny' })
  })

  it('recognises a protected-branch rejection', () => {
    expect(explainGitError('remote: error: GH006: Protected branch update failed for refs/heads/main.')?.key).toBe(
      'gitError.protectedBranch'
    )
  })

  it('reports the host, not the full URL, when git has no credential', () => {
    const msg = "fatal: could not read Username for 'https://dev.example.com/org/repo': terminal prompts disabled"
    expect(explainGitError(msg)).toEqual({ key: 'gitError.noCredential', vars: { host: 'dev.example.com' } })
    expect(explainGitError("fatal: Authentication failed for 'https://git.example.org/x.git/'")?.vars).toEqual({
      host: 'git.example.org'
    })
  })

  it('recognises permission, missing-repository and SSH key errors', () => {
    expect(explainGitError('remote: Permission to o/r.git denied to someone.')?.key).toBe('gitError.permissionDenied')
    expect(explainGitError('remote: Repository not found.')?.key).toBe('gitError.repoNotFound')
    expect(explainGitError('git@github.com: Permission denied (publickey).')?.key).toBe('gitError.sshKey')
  })

  it('returns null for errors it does not know, including those a dialog already handles', () => {
    expect(explainGitError('fatal: something unexpected')).toBeNull()
    expect(explainGitError(' ! [rejected] main -> main (non-fast-forward)')).toBeNull()
    expect(explainGitError("fatal: Unable to create '/r/.git/index.lock': File exists.")).toBeNull()
  })
})

describe('withoutIpcPrefix', () => {
  it("strips Electron's IPC wrapper and leaves other text alone", () => {
    expect(withoutIpcPrefix(IPC + 'fatal: boom')).toBe('fatal: boom')
    expect(withoutIpcPrefix("Error invoking remote method 'git': fatal: boom")).toBe('fatal: boom')
    expect(withoutIpcPrefix('fatal: boom')).toBe('fatal: boom')
  })
})

describe('token scope errors', () => {
  it('names the scope a Forgejo/Gitea token lacks', () => {
    const msg =
      "Error invoking remote method 'hosting:whoAmI': Error: Forgejo: token does not have at least one of required scope(s): [read:user]"
    expect(explainGitError(msg)).toEqual({ key: 'gitError.tokenScope', vars: { scopes: 'read:user' } })
  })

  it("recognises GitLab's insufficient_scope", () => {
    expect(explainGitError('GitLab: insufficient_scope')?.key).toBe('gitError.tokenScopeAny')
  })
})

describe('readableError', () => {
  const t = (k: string): string => `<${k}>`
  const interp = (s: string, v: Record<string, string>): string => `${s}${JSON.stringify(v)}`
  it('explains what it recognises and unwraps the rest', () => {
    expect(readableError('remote: Repository not found.', t, interp)).toBe('<gitError.repoNotFound>{}')
    expect(readableError("Error invoking remote method 'git': Error: fatal: boom", t, interp)).toBe('fatal: boom')
  })

  // Thrown in main as BBS_USER_NOT_FOUND, which has no language; translated here.
  it('translates the Data Center "user not found" review error', async () => {
    const { BBS_USER_NOT_FOUND, BitbucketServerError } = await import('../src/main/bitbucketServer')
    const msg = "Error invoking remote method 'hosting:prReview': Error: " + new BitbucketServerError(404, BBS_USER_NOT_FOUND).message
    expect(explainGitError(msg)).toEqual({ key: 'gitError.bbsUserNotFound' })
  })
})

describe('a missing credential on a repository bound to a profile', () => {
  // Thrown in main by noCredential, which has no language; the hint renders it.
  it('names the bound profile, and the hint translates it with provider, profile and host', async () => {
    const { boundNoCredentialMessage } = await import('../src/main/hosting')
    const msg = "Error invoking remote method 'hosting:prDetail': Error: " + boundNoCredentialMessage('github', 'Work', 'github.com')
    expect(msg).toContain('the profile "Work" this repository is bound to')
    expect(explainGitError(msg)).toEqual({
      key: 'gitError.boundProfileNoCredential',
      vars: { provider: 'GitHub', profile: 'Work', host: 'github.com' }
    })
    const server = boundNoCredentialMessage('gitlab', 'Side "project"', 'gitlab.example.corp:8443')
    expect(explainGitError(server)?.vars).toEqual({ provider: 'GitLab', profile: 'Side "project"', host: 'gitlab.example.corp:8443' })
  })

  // An scp-style ssh remote is no URL: main used to fall back to the provider
  // name, and the old `[^\s]+?` capture then missed the whole message.
  it('still matches when the host value has a space in it', async () => {
    const { boundNoCredentialMessage } = await import('../src/main/hosting')
    expect(explainGitError(boundNoCredentialMessage('Azure DevOps', 'Work', 'Azure DevOps'))).toEqual({
      key: 'gitError.boundProfileNoCredential',
      vars: { provider: 'Azure DevOps', profile: 'Work', host: 'Azure DevOps' }
    })
  })

  it('names the ssh host of an Azure remote', async () => {
    const { boundNoCredentialMessage } = await import('../src/main/hosting')
    const msg = IPC + boundNoCredentialMessage('azure', 'Work', 'ssh.dev.azure.com')
    expect(explainGitError(msg)?.vars).toEqual({ provider: 'Azure DevOps', profile: 'Work', host: 'ssh.dev.azure.com' })
  })
})

describe('merge refusals carry a code, not English, into the translated sentence', () => {
  const err = async (text: string): Promise<string> => {
    const { BitbucketServerError } = await import('../src/main/bitbucketServer')
    return "Error invoking remote method 'hosting:prMerge': Error: " + new BitbucketServerError(409, text).message
  }

  it('gives conflicts and a silent refusal their own keys, with no main-side English in them', async () => {
    const m = await import('../src/main/bitbucketServer')
    const conflicts = m.bbsMergeRefusal({ canMerge: false, conflicted: true, vetoes: [] })!
    expect(explainGitError(await err(m.bbsCannotMergeMessage(conflicts)))).toEqual({ key: 'gitError.bbsMergeConflicts' })
    const silent = m.bbsMergeRefusal({ canMerge: false, conflicted: false, vetoes: [] })!
    expect(explainGitError(await err(m.bbsCannotMergeMessage(silent)))).toEqual({ key: 'gitError.bbsMergeNotAllowed' })
  })

  it("keeps only the server's words beside conflicts — its ';' included — and drops main's sentence", async () => {
    const m = await import('../src/main/bitbucketServer')
    const both = m.bbsMergeRefusal({
      canMerge: false,
      outcome: 'CONFLICTED',
      vetoes: [{ summaryMessage: 'Needs 2 approvals' }, { summaryMessage: 'Builds; all green', detailedMessage: 'CI is red' }]
    })!
    const hint = explainGitError(await err(m.bbsCannotMergeMessage(both)))
    expect(hint).toEqual({
      key: 'gitError.bbsMergeConflictsVetoed',
      vars: { reason: 'Needs 2 approvals; Builds; all green — CI is red' }
    })
    expect(hint?.vars?.reason).not.toContain(m.BBS_MERGE_CONFLICTS)
  })

  it("main's fixed sentences hold no ';', which is what separates them from the server's words", async () => {
    const m = await import('../src/main/bitbucketServer')
    expect(m.BBS_MERGE_CONFLICTS).not.toContain(';')
    expect(m.BBS_MERGE_NOT_ALLOWED).not.toContain(';')
  })
})

describe('the no-credential messages built in main', () => {
  const HOSTING = "Error invoking remote method 'hosting:listPRs': Error: "

  it('translates each GitHub CLI state, keeping the host', async () => {
    const { githubCredentialMessage } = await import('../src/main/hosting')
    const cases = [
      ['missing', 'gitError.githubNoCredentialGhMissing'],
      ['signed-out', 'gitError.githubNoCredentialGhSignedOut'],
      ['unknown', 'gitError.githubNoCredentialGhUnknown'],
      ['authenticated', 'gitError.githubNoCredentialGhSignedIn']
    ] as const
    for (const [status, key] of cases) {
      expect(explainGitError(HOSTING + githubCredentialMessage(status, 'github.com'))).toEqual({ key, vars: { host: 'github.com' } })
    }
  })

  it("leaves githubRepoError's private-repository message alone rather than drop its lead", async () => {
    const { githubCredentialMessage } = await import('../src/main/hosting')
    const msg = `GitHub cannot see acme/secret without signing in — it is probably private. ${githubCredentialMessage('missing')}`
    expect(explainGitError(HOSTING + msg)).toBeNull()
  })

  it('translates the other providers, with and without a host, and never as a GitHub CLI state', async () => {
    const { noLinkedAccountMessage } = await import('../src/main/hosting')
    expect(explainGitError(HOSTING + noLinkedAccountMessage('gitlab', 'gitlab.corp.example:8443'))).toEqual({
      key: 'gitError.noLinkedAccount',
      vars: { provider: 'GitLab', host: 'gitlab.corp.example:8443' }
    })
    expect(explainGitError(HOSTING + noLinkedAccountMessage('Azure DevOps', ''))).toEqual({
      key: 'gitError.noLinkedAccountAnyHost',
      vars: { provider: 'Azure DevOps' }
    })
    // Unwrapped too: the hint reads the message wherever it surfaces.
    expect(explainGitError(noLinkedAccountMessage('Forgejo', 'git.example.org'))?.vars).toEqual({
      provider: 'Forgejo',
      host: 'git.example.org'
    })
  })
})

describe('server-address and token messages built in main', () => {
  const HOSTING = "Error invoking remote method 'hosting:listRepos': Error: "

  it('translates each "not saved in any profile" message', async () => {
    const { GHES_NOT_SAVED, BBS_NOT_SAVED, GITLAB_NOT_SAVED } = await import('../src/main/hosting')
    expect(explainGitError(HOSTING + GHES_NOT_SAVED)).toEqual({ key: 'gitError.ghesNotSaved' })
    expect(explainGitError(HOSTING + BBS_NOT_SAVED)).toEqual({ key: 'gitError.bbsNotSaved' })
    expect(explainGitError(HOSTING + GITLAB_NOT_SAVED)).toEqual({ key: 'gitError.gitlabNotSaved' })
  })

  it('names the server a token is missing for', async () => {
    const { ghesNoTokenMessage, bbsNoTokenMessage } = await import('../src/main/hosting')
    expect(explainGitError(HOSTING + ghesNoTokenMessage('ghe.corp.example:8443'))).toEqual({
      key: 'gitError.ghesNoToken',
      vars: { host: 'ghe.corp.example:8443' }
    })
    expect(explainGitError(HOSTING + bbsNoTokenMessage('bitbucket.corp.example'))).toEqual({
      key: 'gitError.bbsNoToken',
      vars: { host: 'bitbucket.corp.example' }
    })
  })

  it('translates the Data Center browse refusal and the not-a-Data-Center error', async () => {
    const { BBS_NO_BROWSE, NOT_BBS_REPO } = await import('../src/main/hosting')
    expect(explainGitError(HOSTING + BBS_NO_BROWSE)).toEqual({ key: 'gitError.bbsNoBrowse' })
    expect(explainGitError(HOSTING + NOT_BBS_REPO)).toEqual({ key: 'gitError.notBbsRepo' })
  })

  it('translates the refusal to send a held token to an unsaved server', async () => {
    const { HELD_TOKEN_TO_UNSAVED_SERVER } = await import('../src/main/hosting')
    expect(explainGitError(HOSTING + HELD_TOKEN_TO_UNSAVED_SERVER)).toEqual({ key: 'gitError.heldTokenUnsavedServer' })
  })
})

describe('Bitbucket Data Center errors raised in main', () => {
  const err = async (status: number, text: string): Promise<string> => {
    const { BitbucketServerError } = await import('../src/main/bitbucketServer')
    return "Error invoking remote method 'hosting:prReview': Error: " + new BitbucketServerError(status, text).message
  }

  it('translates the fixed messages', async () => {
    const m = await import('../src/main/bitbucketServer')
    expect(explainGitError(await err(401, m.BBS_TOKEN_UNRECOGNISED))).toEqual({ key: 'gitError.bbsTokenUnrecognised' })
    expect(explainGitError(await err(400, m.BBS_COMMENT_EMPTY))).toEqual({ key: 'gitError.bbsCommentEmpty' })
    expect(explainGitError(await err(400, m.BBS_NO_IDENTITY))).toEqual({ key: 'gitError.bbsNoIdentity' })
  })

  it("passes the server's merge veto through, and names a disallowed merge method", async () => {
    const m = await import('../src/main/bitbucketServer')
    const veto = { summaryMessage: 'Needs 2 approvals' }
    const vetoed = m.bbsMergeRefusal({ canMerge: false, conflicted: false, vetoes: [veto] })!
    expect(explainGitError(await err(409, m.bbsCannotMergeMessage(vetoed)))).toEqual({
      key: 'gitError.bbsCannotMerge',
      vars: { reason: 'Needs 2 approvals' }
    })
    expect(explainGitError(await err(400, m.bbsMethodNotAllowedMessage('squash')))).toEqual({
      key: 'gitError.bbsMethodNotAllowed',
      vars: { method: 'squash' }
    })
  })
})
