import type { Profile } from '../../../shared/types'

type TokenFields = Pick<
  Profile,
  | 'githubToken'
  | 'azureToken'
  | 'gitlabToken'
  | 'bitbucketToken'
  | 'forgejoToken'
  | 'githubEnterprise'
  | 'gitlabServers'
  | 'bitbucketServers'
>

const has = (token: string | undefined): boolean => !!token?.trim()

/**
 * Whether a profile holds a token for any hosting service — the cloud ones and
 * every self-hosted server (GitHub Enterprise, GitLab, Bitbucket Data Center).
 * One rule, so a profile that only talks to its own server is not treated as
 * having no account.
 */
export function profileHasHostingToken(profile: Partial<TokenFields>): boolean {
  return (
    has(profile.githubToken) ||
    has(profile.azureToken) ||
    has(profile.gitlabToken) ||
    has(profile.bitbucketToken) ||
    has(profile.forgejoToken) ||
    !!profile.githubEnterprise?.some((s) => has(s.token)) ||
    !!profile.gitlabServers?.some((s) => has(s.token)) ||
    !!profile.bitbucketServers?.some((s) => has(s.token))
  )
}
