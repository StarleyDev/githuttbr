import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { ipcMain } from 'electron'
import { openExternalUrl } from './externalLinks'
import {
  apiToken,
  forgetCredential,
  type ApiAuth,
  githubCliAuthStatus,
  isJwt,
  knownServers,
  resolveRemote,
  type GitCredential,
  type GitHubCliAuthStatus
} from './credentials'
import { atServer, HttpStatusError } from './httpStatusError'
import { titleForDraft } from './prDraftTitle'
import { addReviewThreadReply, createGithubGraphqlPost, createGithubGraphqlRawPost, findReviewThread } from './githubGraphql'
import {
  getAnchorLine,
  getAnchorSide,
  isSameRevision,
  isValidLineAnchor,
  LINE_COMMENT_STALE,
  validRevision
} from '../shared/prLineAnchor'
import { tokenCheckFailure, type TokenCheckResult } from '../shared/tokenCheck'
import { finishPrCommits, PR_COMMITS_MAX, type RawPrCommit } from '../shared/prCommits'
import { finishPrUpdates, groupGithubTimeline, groupUpdatesByHeads, type GithubTimelineItem } from '../shared/prUpdates'
import { isEditedAfter, isValidCommentHandle, stripOuterNewlines } from '../shared/prCommentHandle'
import { countChecks } from './ciSummary'
import { NO_CI_CAPABILITIES, isoToMs, type CiRunsAdapter } from './ciRuns'
import { getGithubActionsJob, githubCheckRun, githubCiRuns, type GhCheckRun } from './ciRunsGithub'
import { gitlabCiRuns, gitlabCommitCiLookup } from './ciRunsGitlab'
import { azureCiLookupBatch, azureCiRuns } from './ciRunsAzure'
import { forgejoCiRuns, forgejoCommitCiLookup } from './ciRunsForgejo'
import {
  activeProfileAuth,
  allProfileAuth,
  asProfileIdArg,
  boundProfileAuth,
  boundProfileName,
  isHeldSecret,
  isProfileId,
  namedProfileAuth,
  namedProfileForgejoInstance,
  peekActiveProfileAuth,
  peekBoundProfileAuth,
  profileForgejoInstance,
  type PeekedAuth
} from './settings'
import {
  createForgejoPull,
  createForgejoRepo,
  forgejoComment,
  forgejoCommentOnLine,
  forgejoDeleteComment,
  forgejoEditComment,
  forgejoPullDiffCommits,
  forgejoPullRevision,
  forgejoRepoApi,
  forgejoMerge,
  forgejoSetPullState,
  forgejoSetPullDraft,
  forgejoPullChecks,
  forgejoJobLog,
  readTail,
  forgejoPullDetail,
  forgejoPullFiles,
  forgejoPullCommits,
  forgejoPullUpdates,
  forgejoReview,
  describeForgejoAccount,
  fjJson,
  forgejoCompareUrl,
  listForgejoOwners,
  listForgejoPulls,
  listForgejoClosedPulls,
  listForgejoRepos,
  listForgejoIssues,
  forgejoIssueDetail,
  setForgejoIssueState,
  createForgejoIssue,
  listForgejoMilestones,
  forgejoMilestoneIssues,
  listForgejoReleases,
  listForgejoNotifications,
  markForgejoNotificationRead,
  markAllForgejoNotificationsRead,
  FORGEJO_NOTIFICATION
} from './forgejo'
import { knownForgejoInstances, knownGithubEnterpriseInstances, knownGitlabInstances } from './gitlabInstances'
import {
  GITHUB_COM,
  GITHUB_COM_ENDPOINTS,
  githubBaseOfRemote,
  githubEndpoints,
  normalizeGithubEnterpriseUrl,
  type GithubEndpoints
} from '../shared/githubEnterprise'
import {
  GITLAB_COM,
  forgejoInstanceOf,
  instanceOf,
  normalizeGitlabServerUrl,
  normalizeGitlabUrl,
  profileForgejoBase,
  tokenMatchesInstance
} from '../shared/gitlabInstance'
import { linkHoldsAccount, pickHostAuth, validAccountLink, type HostAuthInput } from '../shared/hostToken'
import {
  BITBUCKET_CLOUD,
  bitbucketBaseOfRemote,
  bitbucketServerCreatePrUrl,
  bitbucketServerRepoOf,
  normalizeBitbucketServerUrl,
  type BitbucketServerRepo
} from '../shared/bitbucketServer'
import { knownBitbucketServerInstances } from './bitbucketServerInstances'
import { fetchFileBytes, fetchGithubFile, hostFileUrls } from './prFileContent'
import {
  getImageMime,
  isFullCommitSha,
  isSafeRepoFilePath,
  type PrDiffCommits,
  type PrImageContent
} from '../shared/prImage'
import {
  bbsPullCommits,
  bbsPullUpdates,
  bbsCompareFiles,
  bbsCiStatuses,
  bbsComment,
  bbsCommentOnLine,
  bbsDeleteComment,
  bbsEditComment,
  bbsPullRevision,
  bbsPullDiffCommits,
  bbsRepoApi,
  bbsMerge,
  bbsSetPullState,
  bbsSetPullDraft,
  bbsPullChecks,
  bbsPullDetail,
  bbsPullFiles,
  bbsReview,
  bbsPickerOptions,
  bbsWhoAmI,
  createBbsPull,
  describeBbsAccount,
  listBbsPulls,
  listBbsPullsIn
} from './bitbucketServer'
import { noreplyEmail } from '../shared/profileAvatar'
import { cleanPrMeta, prMetaSupport } from '../shared/prMeta'
import {
  applyAzureLabels,
  applyGithubPrMeta,
  azureMetaBody,
  azurePickerOptions,
  azureReviewerIds,
  bitbucketCloudJson,
  bitbucketMetaBody,
  bitbucketPickerOptions,
  bitbucketReviewerIds,
  createWithoutRejectedReviewers,
  githubPickerOptions,
  gitlabMetaBody,
  gitlabMetaMissing,
  gitlabPickerOptions,
  PrCreateError,
  reviewersMissing
} from './prMeta'
import { mergeStackSection } from '../shared/stackPr'
import {
  type CiCacheEntry,
  type CiLookup,
  isCiEntryFresh,
  mentionsRateLimit,
  nextCiEntry,
  rateLimitPauseUntil,
  rememberCiEntry
} from './ciCache'
import type {
  FinishedPullRequests,
  CiJob,
  CiRunAction,
  CiRunList,
  CiState,
  CiStatus,
  AccountLink,
  ConnectedAccount,
  CreateRepoOpts,
  CreatePrOpts,
  CreatePrResult,
  GitHubNotification,
  HostingAccess,
  HostingProvider,
  PullRequest,
  PrComment,
  PrCommentHandle,
  PrDetail,
  PrReview,
  PrReviewThread,
  PrLineAnchor,
  PrDiffRevision,
  PrFileList,
  PrCommitList,
  PrUpdateEnd,
  PrUpdateFiles,
  PrUpdateList,
  PrCheck,
  PrFile,
  PrFileDiffRequest,
  PrFileDiffSource,
  IssueInfo,
  IssueDetail,
  LinkedPr,
  LinkedPrsStatus,
  MilestoneInfo,
  ProjectFieldGroup,
  PrReviewEvent,
  PrMergeMethod,
  PrMetaField,
  PrPickerOptions,
  ReferenceQuery,
  ReferenceSummary,
  ReleaseInfo,
  RemoteOwner,
  RemoteRepo,
  RepoHost,
  GithubStackInfo
} from '../shared/types'
import {
  azurePrCommits,
  azureComment,
  azureMerge,
  azureSetPullState,
  azureSetPullDraft,
  azurePrChecks,
  azureBuildLog,
  azurePrDetail,
  azureFileDiff,
  azurePrFiles,
  azurePrIterationFiles,
  azurePrUpdates,
  parseRetryAfter,
  azureReply,
  azureCommentOnLine,
  azureDeleteComment,
  azureEditComment,
  azurePrRevision,
  azureRepoApi,
  azureReview,
  azureWorkItem,
  type Ado,
  type AdoBytes,
  type AdoPage,
  type AdoText,
  type AzureRepo
} from './azurePr'
import { ensurePrCommits, getLocalMergeBase, readPrFileFromClone, readPrFilesFromClone, type PrFetchMode } from './prLocalFiles'
import { withNoPatchReasons } from '../shared/prFileDiff'
import {
  azureReferenceSummaries,
  forgejoReferenceSummaries,
  githubReferenceSummaries,
  gitlabReferenceSummaries,
  normalizeReferenceQueries,
  unavailableReference
} from './referenceSummaries'

interface ParsedRemote {
  provider: Exclude<HostingProvider, null>
  owner: string // github owner / azure organization
  project: string // azure project ('' for github)
  repo: string
  /** GitLab: the instance's base URL — gitlab.com or a self-managed one.
   *  GitHub: a GitHub Enterprise Server's base; absent for github.com.
   *  Bitbucket: a Data Center's base (context path included); absent for
   *  bitbucket.org. `owner` is then the project key (`PROJ`, or `~user`). */
  base?: string
}

export function parseRemoteUrl(url: string): ParsedRemote | null {
  // Match the authority separately so a provider name inside a project path cannot select it.
  const scp = /^(?:[\w.-]+@)?([\w.-]+):([^/].*)$/.exec(url)
  let target: string
  if (scp) {
    target = scp[1].toLowerCase() + '/' + scp[2]
  } else {
    try {
      const parsed = new URL(url)
      if (!['https:', 'http:', 'ssh:', 'git:'].includes(parsed.protocol)) return null
      target = parsed.hostname.toLowerCase() + parsed.pathname
    } catch {
      return null
    }
  }
  let m = /^(?:[\w-]+\.)*github\.com\/([^/]+)\/([^/]+?)(\.git)?$/.exec(target)
  if (m) return { provider: 'github', owner: m[1], project: '', repo: m[2] }

  // A self-hosted server, or gitlab.com: which one is decided once, across every
  // configured server list together (`resolveRemoteProvider`) — a Data Center
  // beside a GitLab on one hostname must never be read as that GitLab.
  const resolved = resolveRemote(url)
  const base = resolved?.base
  if (base && resolved.provider === 'github' && base !== GITHUB_COM) {
    // A GitHub Enterprise Server a profile names: GitHub's API at its own host.
    const ghes = instanceOf(url, [base])
    if (!ghes || ghes.path.split('/').length !== 2) return null
    const [owner, repo] = ghes.path.split('/')
    return { provider: 'github', owner, project: '', repo, base }
  }
  if (base && resolved.provider === 'gitlab') {
    // GitLab: namespace may be multi-level (group/subgroup/repo) — owner holds the
    // full namespace path, repo the last segment.
    const gl = instanceOf(url, [base])
    if (!gl) return null
    const i = gl.path.lastIndexOf('/')
    return { provider: 'gitlab', owner: gl.path.slice(0, i), project: '', repo: gl.path.slice(i + 1), base }
  }
  if (base && resolved.provider === 'forgejo') {
    // A Forgejo/Gitea instance a profile points at — always self-chosen, never guessed.
    const fj = forgejoInstanceOf(url, [base])
    if (!fj) return null
    const [owner, repo] = fj.path.split('/')
    return { provider: 'forgejo', owner, project: '', repo, base }
  }
  if (base && resolved.provider === 'bitbucket' && base !== BITBUCKET_CLOUD) {
    // A Bitbucket Data Center a profile names: its own API, projects instead of workspaces.
    const bbs = bitbucketServerRepoOf(url, [base])
    return bbs ? { provider: 'bitbucket', owner: bbs.projectKey, project: '', repo: bbs.repoSlug, base } : null
  }

  m = /^dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+?)(\.git)?$/.exec(target)
  if (m) return { provider: 'azure', owner: m[1], project: decodeURIComponent(m[2]), repo: decodeURIComponent(m[3]) }

  m = /^ssh\.dev\.azure\.com[/:]v3\/([^/]+)\/([^/]+)\/(.+?)(\.git)?$/.exec(target)
  if (m) return { provider: 'azure', owner: m[1], project: m[2], repo: m[3] }

  m = /^([^/@:]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/]+?)(\.git)?$/.exec(target)
  if (m) return { provider: 'azure', owner: m[1], project: decodeURIComponent(m[2]), repo: decodeURIComponent(m[3]) }

  m = /^(?:[\w-]+\.)*bitbucket\.org[/:]([^/]+)\/(.+?)(?:\.git)?$/.exec(target)
  if (m) return { provider: 'bitbucket', owner: m[1], project: '', repo: m[2] }

  return null
}

/** Bitbucket auth: an "app password" is stored as user:password → Basic; a raw
 *  access token → Bearer. */
function bitbucketAuth(token: string): string {
  return token.includes(':') ? `Basic ${Buffer.from(token).toString('base64')}` : `Bearer ${token}`
}

/**
 * GitLab auth. A token typed into Settings keeps using the `PRIVATE-TOKEN`
 * header it has always used; a credential borrowed from git is an OAuth access
 * token, which GitLab only accepts as a bearer token.
 */
function gitlabAuth(auth: { token: string; cred?: GitCredential }): Record<string, string> {
  return auth.cred ? { Authorization: `Bearer ${auth.token}` } : { 'PRIVATE-TOKEN': auth.token }
}

/**
 * Bitbucket auth from either source. A borrowed credential arrives already split
 * into username and password, which is exactly the Basic pair Bitbucket wants.
 */
function bitbucketAuthFor(auth: { token: string; cred?: GitCredential }): string {
  if (auth.cred?.username) {
    return `Basic ${Buffer.from(`${auth.cred.username}:${auth.cred.password}`).toString('base64')}`
  }
  return bitbucketAuth(auth.token)
}

/**
 * Azure DevOps auth. A PAT goes in as Basic with an empty username — the scheme
 * the docs describe. An Entra ID access token (what Git Credential Manager hands
 * out, and what PATs are being replaced by) is a JWT and must be sent as Bearer.
 */
export function azureAuth(token: string): string {
  return isJwt(token) ? `Bearer ${token}` : `Basic ${Buffer.from(`:${token}`).toString('base64')}`
}

/**
 * Call the Azure DevOps REST API.
 *
 * Azure DevOps does not answer an unauthenticated API request with 401. It
 * replies **203 Non-Authoritative Information** carrying an HTML sign-in page,
 * which `res.ok` accepts, so a bad or expired PAT used to surface as
 * `Unexpected token '<'` from JSON.parse rather than as an auth error. Anything
 * that is not JSON is therefore treated as a rejected credential here.
 */
export async function adoJson<T>(url: string, token: string, init?: RequestInit, onHeaders?: (h: Headers) => void): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: azureAuth(token),
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string>)
    }
  })
  // Some lists page by a header (x-ms-continuationtoken), not by the body.
  if (res.ok) onHeaders?.(res.headers)

  const body = await res.text()
  if (!res.ok) {
    // The API returns {message} on real errors; fall back to the status.
    let message = ''
    try {
      message = (JSON.parse(body) as { message?: string }).message ?? ''
    } catch {
      /* not JSON — keep the status-only message */
    }
    throw new AzureAuthError(res.status, message, parseRetryAfter(res.headers.get('retry-after')))
  }
  // A sign-in page (203 + HTML), or an empty body from a 204.
  const trimmed = body.trim()
  if (!trimmed) return undefined as T
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) throw new AzureAuthError(401, '')
  try {
    return JSON.parse(trimmed) as T
  } catch {
    throw new AzureAuthError(res.status, '')
  }
}

/** An Azure DevOps failure carrying the status, so callers can retry or re-auth. */
class AzureAuthError extends Error {
  status: number
  /** How long a throttled (429) or unavailable (503) server asked to be left alone. */
  retryAfterMs: number | null
  constructor(status: number, message: string, retryAfterMs: number | null = null) {
    super(message ? `Azure DevOps: ${message}` : azureAuthError(status))
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * An Azure DevOps file's raw bytes (asked with `Accept: application/octet-stream`), read up to `max`:
 * past it, `tooLarge` and the rest of the body is not read. A refusal throws
 * an AzureAuthError carrying its status and Retry-After, so the caller can
 * retry a throttle; a sign-in page (HTML) is a 401 like adoJson's.
 */
export async function adoBytes(url: string, token: string, max: number): Promise<Uint8Array | 'tooLarge'> {
  const res = await fetch(url, {
    redirect: 'error',
    headers: { Authorization: azureAuth(token), Accept: 'application/octet-stream' }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = ''
    try {
      message = (JSON.parse(body) as { message?: string }).message ?? ''
    } catch {
      /* not JSON — the status says it */
    }
    throw new AzureAuthError(res.status, message, parseRetryAfter(res.headers.get('retry-after')))
  }
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new AzureAuthError(401, '')
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) {
    await res.body?.cancel().catch(() => undefined)
    return 'tooLarge'
  }
  if (!res.body) return new Uint8Array()
  const parts: Uint8Array[] = []
  let size = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > max) {
      await reader.cancel().catch(() => undefined)
      return 'tooLarge'
    }
    parts.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Whether a failure means "this credential is no good" rather than "this request was". */
function isAuthFailure(err: unknown): boolean {
  return err instanceof AzureAuthError && (err.status === 401 || err.status === 403)
}

/** The four provider token slots the renderer passes down. */
export type HostTokens = { github?: string; azure?: string; gitlab?: string; bitbucket?: string; forgejo?: string }

/**
 * The repository a hosting call acts for, set once per IPC call by
 * `handleForRepo` and read by `profileAuth`. A scope rather than a parameter:
 * every helper under a handler (ghRepoOf, glProjectOf, azRepoOf, fjRepoOf,
 * bbsRepoOf, forgejoRemote, the CI lookups) reaches `profileAuth` without each
 * having to pass the path on — and a helper that forgot to is exactly how PR
 * detail, review and merge used to run as the active profile instead of the
 * one the repository is bound to.
 */
const hostingRepo = new AsyncLocalStorage<string | undefined>()

/**
 * The profile credentials for a hosting call — precedence in `pickHostAuth`.
 * Resolved here rather than trusted from the renderer: its settings carry no
 * tokens until Settings is opened, it never sends links, and it only knows the
 * *active* profile, not the one a background tab's repository is bound to.
 */
async function profileAuth(provider: RepoHost, sent: string | undefined, remoteUrl?: string): Promise<HostAuthInput> {
  const repoPath = hostingRepo.getStore()
  // An IPC token alone carries no issuing instance. Resolve scoped tokens in main.
  // The renderer's GitHub token is github.com's: a remote on an Enterprise
  // Server (or one whose host cannot be told) resolves its own in main instead.
  const githubElsewhere =
    provider === 'github' && !!remoteUrl && githubBaseOfRemote(remoteUrl, knownGithubEnterpriseInstances(), knownServers()) !== GITHUB_COM
  // Bitbucket the same: the renderer's token is bitbucket.org's.
  const bitbucketElsewhere =
    provider === 'bitbucket' && !!remoteUrl && bitbucketBaseOfRemote(remoteUrl, knownBitbucketServerInstances(), knownServers()) !== BITBUCKET_CLOUD
  return pickHostAuth({
    sent: provider === 'gitlab' || provider === 'forgejo' || githubElsewhere || bitbucketElsewhere ? undefined : sent,
    bound: repoPath ? await boundProfileAuth(provider, repoPath, remoteUrl) : undefined,
    active: () => activeProfileAuth(provider, remoteUrl)
  })
}

/** `apiToken` for a repository's remote, with the profile resolution above. */
async function remoteApiToken(
  remoteUrl: string,
  provider: RepoHost,
  sent: string | undefined
): Promise<ApiAuth | null> {
  return apiToken(remoteUrl, await profileAuth(provider, sent, remoteUrl))
}

/** A repo path off the IPC boundary — only ever a lookup key into `repoProfiles`. */
function asRepoPath(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

/**
 * The token to use for a remote: the one configured in Settings, else whatever
 * git's credential helper already holds for that URL. Returns the borrowed
 * credential alongside it so an auth failure can evict it.
 */
async function tokenForRemote(
  remoteUrl: string,
  provider: Exclude<HostingProvider, null>,
  tokens: HostTokens
): Promise<ApiAuth | null> {
  return remoteApiToken(remoteUrl, provider, tokens[provider])
}

/**
 * Run an Azure DevOps request, and if a *borrowed* credential is rejected, drop
 * it from the helper and try once more with a freshly minted one. A credential
 * the user typed in themselves is never retried — it is simply wrong, and
 * silently re-asking would hide that.
 */
async function withAzureRetry<T>(
  remoteUrl: string,
  auth: ApiAuth,
  run: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await run(auth.token)
  } catch (err) {
    if (!auth.cred || !isAuthFailure(err)) throw err
    await forgetCredential(remoteUrl, auth.cred)
    // Ask again for the same account: the profile's link names it.
    const fresh = await apiToken(remoteUrl, { link: { source: 'git', login: auth.cred.username } })
    if (!fresh) throw err
    return run(fresh.token)
  }
}

/**
 * The evicting retry of `withAzureRetry`, for a pull-request create — the one
 * call allowed to evict — kept as state across that create's attempts:
 * - a second attempt (the retry without refused reviewers) runs with the
 *   token the first one ended on, not the one it started with, so a re-minted
 *   credential is used rather than the evicted one;
 * - it evicts at most once, whatever the attempts;
 * - `token()` is what the create actually succeeded with, for the calls that
 *   follow it (labels), which go out plain and never evict.
 */
function azureCreateSession(remoteUrl: string, auth: ApiAuth): { create: Ado; token: () => string } {
  let current = auth
  let evicted = false
  const create: Ado = async (url, init) => {
    try {
      return await adoJson(url, current.token, init)
    } catch (err) {
      if (evicted || !current.cred || !isAuthFailure(err)) throw err
      evicted = true
      await forgetCredential(remoteUrl, current.cred)
      const fresh = await apiToken(remoteUrl, { link: { source: 'git', login: current.cred.username } })
      if (!fresh) throw err
      current = fresh
      return adoJson(url, current.token, init)
    }
  }
  return { create, token: () => current.token }
}

/**
 * The URL a provider's credential is filed under when there is no repository in
 * hand (Settings, the clone browser). Azure DevOps keys per organization, since
 * each one needs its own token.
 */
export function providerBaseUrl(provider: RepoHost, org?: string): string {
  switch (provider) {
    case 'github':
      return githubBaseFromOrg(org)
    case 'gitlab':
      return gitlabBaseFromOrg(org)
    case 'bitbucket':
      return bitbucketBaseFromOrg(org)
    case 'azure':
      return `https://dev.azure.com/${encodeURIComponent(org?.trim() ?? '')}`
    case 'forgejo':
      return forgejoBaseFromOrg(org)
  }
}

/**
 * GitHub's `org` is the base of an Enterprise Server, sent by Settings and the
 * clone browser. Like GitLab's, it is honoured only when a profile names that
 * server: anything else would let any string decide where a token goes.
 * Absent → github.com; unknown → an error, never a fallback to github.com.
 */
function githubBaseFromOrg(org: string | undefined): string {
  if (!org?.trim() || org.trim().toLowerCase() === GITHUB_COM) return GITHUB_COM
  const base = normalizeGithubEnterpriseUrl(org)
  if (base && knownGithubEnterpriseInstances().includes(base)) return base
  throw new Error(GHES_NOT_SAVED)
}

// The "not saved", "no token" and "not supported" messages below are English
// with a fixed shape: main has no language, and gitErrorHint translates each
// one by its wording — a change here needs the matching rule changed there.
export const GHES_NOT_SAVED =
  'This GitHub Enterprise Server is not saved in any profile yet (it must be https). Add it in Settings → Integrations → GitHub, then try again.'
export const BBS_NOT_SAVED =
  'This Bitbucket Data Center is not saved in any profile yet (it must be https). Add it in Settings → Integrations → Bitbucket, then try again.'
export const GITLAB_NOT_SAVED =
  'This GitLab address is not saved in any profile yet (it must be https). Save it in Settings → Integrations, then try again.'
export const NOT_BBS_REPO = 'Not a Bitbucket Data Center repository.'
export const BBS_BAD_REMOTE =
  'Could not read this Bitbucket Data Center repository address. It should look like <server>/scm/PROJECT/repo.git.'
export const HELD_TOKEN_TO_UNSAVED_SERVER =
  'This token is already saved for another account or server, so it is not sent to a server no profile has saved yet. Use the token this server issued.'

export const ghesNoTokenMessage = (host: string): string =>
  `No token for the GitHub Enterprise Server ${host} is saved in this profile. Add one in Settings → Integrations → GitHub → GitHub Enterprise Server.`
export const bbsNoTokenMessage = (host: string): string =>
  `No HTTP access token for the Bitbucket Data Center ${host} is saved in this profile. Add one in Settings → Integrations → Bitbucket → Bitbucket Data Center.`

/**
 * The base of a server a token is being *checked* against before any profile
 * names it — a GHES, GitLab or Bitbucket Data Center row added in the onboarding wizard, which keeps
 * the profile to itself until it finishes. Null unless all of these hold:
 * - the server is not already known (a known one resolves the normal way);
 * - the call carries a token of its own — the one the user just typed;
 * - the address passes the same validation Settings applies (https, no
 *   credentials, not github.com / gitlab.com).
 * The caller then sends that token and nothing else: no profile lookup, no
 * link, no credential helper — so no saved secret can be steered to the host.
 * Only `hosting:whoAmI` uses this; every other provider-level call still
 * refuses an unknown server.
 */
export function unsavedServerBase(provider: RepoHost, org: string | undefined, token: string): string | null {
  if (!token.trim() || !org?.trim()) return null
  if (provider === 'github') {
    const base = normalizeGithubEnterpriseUrl(org)
    return base && !knownGithubEnterpriseInstances().includes(base) ? base : null
  }
  if (provider === 'gitlab') {
    const base = normalizeGitlabServerUrl(org)
    return base && !knownGitlabInstances().includes(base) ? base : null
  }
  if (provider === 'bitbucket') {
    const base = normalizeBitbucketServerUrl(org)
    return base && !knownBitbucketServerInstances().includes(base) ? base : null
  }
  return null
}

/**
 * Bitbucket's `org` is a Data Center's base, sent by its Settings row. Honoured
 * only when a profile names that server; absent → bitbucket.org; anything else
 * is an error, never a fallback to bitbucket.org.
 */
function bitbucketBaseFromOrg(org: string | undefined): string {
  if (!org?.trim() || org.trim().toLowerCase() === BITBUCKET_CLOUD) return BITBUCKET_CLOUD
  const base = normalizeBitbucketServerUrl(org)
  if (base && knownBitbucketServerInstances().includes(base)) return base
  throw new Error(BBS_NOT_SAVED)
}

/** The Data Center repository a remote is on, or null for bitbucket.org and every other host. */
function bbsRepoOfRemote(remoteUrl: string): BitbucketServerRepo | null {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed || parsed.provider !== 'bitbucket' || !parsed.base) return null
  return bitbucketServerRepoOf(remoteUrl, [parsed.base])
}

const isBbs = (remoteUrl: string): boolean => bbsRepoOfRemote(remoteUrl) !== null

/** Whether a remote's server is a Data Center a profile names — whether or not its path parses. */
function onDataCenter(remoteUrl: string): boolean {
  const r = resolveRemote(remoteUrl)
  return r?.provider === 'bitbucket' && !!r.base && r.base !== BITBUCKET_CLOUD
}

/**
 * Fail closed on a Data Center remote whose path is not one of its
 * repositories: such a remote must never reach a bitbucket.org code path,
 * which would send the Data Center's token to api.bitbucket.org. Called where
 * an entry point would otherwise fall through to bitbucket.org, and before
 * every bitbucket.org request that a repository remote leads to.
 */
function refuseUnreadableDataCenter(remoteUrl: string): void {
  if (onDataCenter(remoteUrl) && !isBbs(remoteUrl)) throw new Error(BBS_BAD_REMOTE)
}

/** A Data Center remote and the token its profile filed for that server, or an error saying what is missing. */
async function bbsRepoOf(remoteUrl: string): Promise<{ repo: BitbucketServerRepo; token: string }> {
  const repo = bbsRepoOfRemote(remoteUrl)
  if (!repo) throw new Error(NOT_BBS_REPO)
  const auth = await remoteApiToken(remoteUrl, 'bitbucket', undefined)
  if (!auth) throw await noCredential('Bitbucket', remoteUrl)
  return { repo, token: auth.token }
}

/** The endpoints of a parsed GitHub remote — github.com, or its Enterprise Server. */
const ghEndpointsOf = (parsed: ParsedRemote): GithubEndpoints => githubEndpoints(parsed.base)

/**
 * Forgejo's `org` is the instance URL of the profile in use. Like GitLab's, it
 * is honoured only when a profile is configured for it — and there is no public
 * default to fall back to.
 */
function forgejoBaseFromOrg(org: string | undefined): string {
  const base = normalizeGitlabUrl(org)
  if (base && knownForgejoInstances().includes(base)) return base
  throw new Error('No Forgejo address is saved in this profile (it must be https). Add it in Settings → Integrations → Forgejo.')
}

/**
 * The credential for a provider outside any repository. Same precedence as
 * `tokenForRemote`: what the user configured, else what git already holds.
 *
 * `profileId` is the profile the clone dialog's picker names: the list it
 * shows, the clone and the binding of the new repository all use that one
 * profile. An empty id or one no profile has gets nothing — not the active
 * profile's credential, nor the token the renderer sent alongside it. Absent
 * (Settings, notifications): the active profile, as before.
 */
async function tokenForProvider(
  provider: RepoHost,
  token: string,
  org?: string,
  profileId?: string
): Promise<(ApiAuth & { base: string }) | null> {
  if (profileId !== undefined && !(await isProfileId(profileId))) return null
  const base = await providerBase(provider, org, profileId)
  const profile = (expectedBase?: string): ReturnType<typeof activeProfileAuth> =>
    profileId !== undefined
      ? namedProfileAuth(provider, profileId, undefined, expectedBase)
      : activeProfileAuth(provider, undefined, expectedBase)
  // A server's token is resolved here and only for its own base; the renderer's
  // token is github.com's, bitbucket.org's or Azure's — the picked profile's.
  const input = provider === 'gitlab' || provider === 'forgejo' || (provider === 'github' && base !== GITHUB_COM) ||
    (provider === 'bitbucket' && base !== BITBUCKET_CLOUD)
    ? await profile(base)
    : await pickHostAuth({ sent: token, active: () => profile() })
  const auth = await apiToken(base, input)
  return auth ? { ...auth, base } : null
}

/**
 * For GitLab, `org` carries the instance URL of the profile being used. It
 * arrives from the renderer, so it is honoured only when it names an instance a
 * profile is configured for: anything else would let any string decide where a
 * token is sent. Absent → gitlab.com; unknown → an error, never a fallback.
 */
function gitlabBaseFromOrg(org: string | undefined): string {
  if (!org?.trim()) return GITLAB_COM
  const base = normalizeGitlabUrl(org)
  if (base === GITLAB_COM || (base && knownGitlabInstances().includes(base))) return base
  // Fail closed: falling back to gitlab.com here would hand a self-managed
  // instance's token to a third party.
  throw new Error(GITLAB_NOT_SAVED)
}

/**
 * `providerBaseUrl`, with Forgejo resolved to the instance of the profile in
 * use — the one `profileId` names, else the active one. GitLab without an
 * `org` is gitlab.com: a self-managed server is always named by its base
 * (Settings and the clone browser send it).
 */
async function providerBase(provider: RepoHost, org?: string, profileId?: string): Promise<string> {
  if (provider === 'forgejo' && !org) {
    const base = profileId !== undefined ? await namedProfileForgejoInstance(profileId) : await profileForgejoInstance()
    if (!base) return forgejoBaseFromOrg(undefined) // throws: nothing configured
    return base
  }
  return providerBaseUrl(provider, org)
}

/** The GitLab REST root of an instance. */
const glApi = (base: string | undefined): string => `${base ?? GITLAB_COM}/api/v4`

/**
 * Actionable GitHub setup text for the exact local CLI state we observed. A
 * profile only uses a machine login it has *linked*, so every route ends at
 * Settings → Integrations — `gh auth setup-git` alone no longer connects anything.
 * English with a fixed shape per state: gitErrorHint translates each one by the
 * sentence that follows the lead (`gitError.githubNoCredential*`).
 */
export function githubCredentialMessage(status: GitHubCliAuthStatus, host = 'github.com'): string {
  const lead = `No GitHub account is linked to this profile for ${host}.`
  if (status === 'missing') {
    return `${lead} GitHub CLI (gh) is not installed: add a personal access token in Settings → Integrations, or install gh, run \`gh auth login\` and sign in there.`
  }
  if (status === 'signed-out') {
    return `${lead} GitHub CLI (gh) is installed but not authenticated: run \`gh auth login\`, then sign in from Settings → Integrations, or add a personal access token there.`
  }
  if (status === 'unknown') {
    return `${lead} Checking the GitHub CLI (gh) timed out — it may be offline. Sign in from Settings → Integrations, or add a personal access token there.`
  }
  return `${lead} GitHub CLI (gh) is signed in: sign in from Settings → Integrations to link that account to this profile, or add a personal access token there.`
}

/** A clear "no credential at all" message naming the setup step that failed. */
async function noCredential(provider: string, remoteUrl?: string): Promise<Error> {
  const host = (() => {
    if (!remoteUrl) return ''
    // An scp-style ssh remote (`git@host:path`) is no URL, but it names a host all the same.
    const scp = /^(?:[\w.-]+@)?([\w.-]+):(?!\/\/)/.exec(remoteUrl)
    if (scp) return scp[1]
    try {
      return new URL(remoteUrl).host
    } catch {
      return ''
    }
  })()
  // A repository bound to a profile only ever uses that profile, so "this
  // profile" would point at the active one — say which. English with a fixed
  // shape: main has no language, and the renderer's gitErrorHint translates it.
  const repoPath = hostingRepo.getStore()
  const bound = repoPath ? await boundProfileName(repoPath) : undefined
  if (bound) return new Error(boundNoCredentialMessage(provider, bound, host || provider))
  if (provider.toLowerCase() === 'github' && host && remoteUrl && githubBaseOfRemote(remoteUrl, knownGithubEnterpriseInstances(), knownServers()) !== GITHUB_COM) {
    return new Error(ghesNoTokenMessage(host))
  }
  if (provider.toLowerCase() === 'github') {
    return new Error(githubCredentialMessage(await githubCliAuthStatus(), host || 'github.com'))
  }
  if (provider.toLowerCase() === 'bitbucket' && host && remoteUrl && bitbucketBaseOfRemote(remoteUrl, knownBitbucketServerInstances(), knownServers()) !== BITBUCKET_CLOUD) {
    return new Error(bbsNoTokenMessage(host))
  }
  return new Error(noLinkedAccountMessage(provider, host))
}

/**
 * The no-credential message for any provider but GitHub (which names its CLI's
 * state, `githubCredentialMessage`). A contract with `gitErrorHint`
 * (`gitError.noLinkedAccount`, `gitError.noLinkedAccountAnyHost`).
 */
export function noLinkedAccountMessage(provider: string, host: string): string {
  const name = PROVIDER_NAMES[provider.toLowerCase()] ?? provider
  return (
    `No ${name} account is linked to this profile${host ? ` for ${host}` : ''}. ` +
    "Sign in from Settings → Integrations to link a login git's credential helper holds, or add a token there."
  )
}

/**
 * The no-credential message for a repository bound to a profile. Its shape is a
 * contract with `gitErrorHint` (`gitError.boundProfileNoCredential`), which
 * renders it in the reader's language.
 */
export function boundNoCredentialMessage(provider: string, profile: string, host: string): string {
  const name = PROVIDER_NAMES[provider.toLowerCase()] ?? provider
  return (
    `No ${name} account is linked to the profile "${profile}" this repository is bound to, for ${host}. ` +
    'Switch to that profile and sign in from Settings → Integrations, or add a token there.'
  )
}

const PROVIDER_NAMES: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  azure: 'Azure DevOps',
  forgejo: 'Forgejo'
}

/** What GitHub said about a failed request, beyond the status code. */
export interface GithubFailure {
  message?: string
  rateLimited?: boolean
}

/** Read GitHub's own reason from a failed response — body `message` and the rate-limit header. */
async function githubFailure(res: Response): Promise<GithubFailure> {
  const rateLimited = (res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0'
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim() : undefined
  return { message: message || undefined, rateLimited }
}

/**
 * A failed read of one GitHub repository. GitHub answers 404, not 403, for a
 * private repository the caller cannot see, so a bare "404" sent people looking
 * for a typo when the fix was a credential.
 */
export async function githubRepoError(
  status: number,
  slug: string,
  authed: boolean,
  remoteUrl: string,
  why: GithubFailure = {}
): Promise<Error> {
  if (why.rateLimited) {
    return new Error(
      `GitHub API rate limit reached (${status})${authed ? '' : ' — unauthenticated requests get 60 an hour; add a token in Settings → Integrations to raise it'}.`
    )
  }
  // A 403 on a repository the token can clone is almost always a permission the
  // token lacks or an organization policy — GitHub says which, so pass it on.
  if (status !== 404) return new Error(`GitHub API error (${status})${why.message ? `: ${why.message}` : ''}`)
  if (!authed) {
    const setup = (await noCredential('github', remoteUrl)).message
    return new Error(`GitHub cannot see ${slug} without signing in — it is probably private. ${setup}`)
  }
  return new Error(
    `GitHub cannot find ${slug} (404). Either the repository is private and your credential has no access to it — for a fine-grained token, add this repository to it — or it was renamed or deleted: check the remote URL.`
  )
}

/** Mark the PRs that wait on `login`'s review. Logins compare case-insensitively, as hosts treat them. */
export function markAwaitingYou(prs: PullRequest[], login: string | null): PullRequest[] {
  if (!login) return prs
  const me = login.toLowerCase()
  return prs.map((p) => (p.requestedReviewers?.some((r) => r.toLowerCase() === me) ? { ...p, awaitingYou: true } : p))
}

/** Who a token signs in as, per host — remembered for a while, keyed by a hash of the token (never the token). */
const loginCache = new Map<string, { login: string | null; id: string | null; uniqueName: string | null; at: number }>()
const LOGIN_TTL_MS = 10 * 60_000

async function myLogin(parsed: ParsedRemote, token: string, auth: ApiAuth): Promise<string | null> {
  return (await myAccount(parsed, token, auth))?.login ?? null
}

/**
 * Who a token signs in as: the login the host names authors by and, where that
 * is a display name two people can share (Azure DevOps, bitbucket.org), the
 * account's own id — what "your comment" must be matched on there.
 */
async function myAccount(
  parsed: ParsedRemote,
  token: string,
  auth: ApiAuth
): Promise<{ login: string | null; id: string | null; uniqueName: string | null } | null> {
  const key = `${parsed.provider}|${parsed.base ?? ''}|${createHash('sha256').update(token).digest('hex').slice(0, 16)}`
  const hit = loginCache.get(key)
  if (hit && Date.now() - hit.at < LOGIN_TTL_MS) return { login: hit.login, id: hit.id, uniqueName: hit.uniqueName }
  let login: string | null = null
  let id: string | null = null
  let uniqueName: string | null = null
  // Only the host's own "no" is worth remembering: a token without user scope
  // stays that way. A network error or a 5xx is asked again next time.
  let refused = false
  try {
    if (parsed.provider === 'github') login = (await ghJson<{ login: string }>(`${ghEndpointsOf(parsed).apiBase}/user`, token)).login
    else if (parsed.provider === 'gitlab') login = (await glJson<{ username: string }>(`${glApi(parsed.base)}/user`, auth)).username
    else if (parsed.provider === 'forgejo' && parsed.base) login = (await fjJson<{ login: string }>(`${parsed.base}/api/v1/user`, token)).login
    else if (parsed.provider === 'bitbucket' && parsed.base) login = (await bbsWhoAmI(parsed.base, token))?.name ?? null
    // bitbucket.org and Azure DevOps name a PR's author by display name, so
    // "you" is the display name too — the only thing the list can be matched on.
    else if (parsed.provider === 'bitbucket') {
      const res = await fetch('https://api.bitbucket.org/2.0/user', { headers: { Authorization: bitbucketAuthFor(auth) } })
      if (res.ok) {
        const me = (await res.json()) as { display_name?: string | null; uuid?: string | null }
        login = me.display_name ?? null
        id = me.uuid ?? null
      } else refused = res.status === 401 || res.status === 403
      if (!res.ok && !refused) return null
    } else if (parsed.provider === 'azure') {
      const me = await adoJson<{
        authenticatedUser?: { id?: string; providerDisplayName?: string; properties?: { Account?: { $value?: unknown } } }
      }>(`https://dev.azure.com/${encodeURIComponent(parsed.owner)}/_apis/connectionData`, token)
      login = me.authenticatedUser?.providerDisplayName ?? null
      // The identity id: what a comment's `author.id` (an IdentityRef) names.
      id = me.authenticatedUser?.id ?? null
      // The account name (an email or UPN) — what a comment's `author.uniqueName`
      // carries. A second key for "yours", should the two ids ever differ.
      const account = me.authenticatedUser?.properties?.Account?.$value
      uniqueName = typeof account === 'string' && account.trim() ? account.trim() : null
    }
  } catch (err) {
    // A token without user scope cannot say who it is: no marks, no error.
    refused = isAuthRefusal(err)
    if (!refused) return null
  }
  loginCache.set(key, { login, id, uniqueName, at: Date.now() })
  return { login, id, uniqueName }
}

/** A 401/403 from the host. Every client myLogin uses sets `status` on what it throws. */
export function isAuthRefusal(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status
  return status === 401 || status === 403
}

/** Forget who the tokens are — for tests, which reuse one module across cases. */
export function forgetLogins(): void {
  loginCache.clear()
}

/**
 * The open PRs of a remote, with the ones waiting on your review marked, and
 * who "you" are on that host — the account this repository's calls run as, so
 * the PR list's "Me" is the bound profile's, not whichever profile is active.
 * Null when the token cannot say (no user scope) or there is no token.
 */
async function listPullRequests(
  remoteUrl: string,
  tokens: HostTokens
): Promise<{ provider: HostingProvider; prs: PullRequest[]; me: string | null }> {
  const result = await listPullRequestsOf(remoteUrl, tokens)
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed) return { ...result, me: null }
  const auth = await tokenForRemote(remoteUrl, parsed.provider, tokens).catch(() => null)
  if (!auth) return { ...result, me: null }
  const me = await myLogin(parsed, auth.token, auth)
  return { ...result, prs: markAwaitingYou(result.prs, me), me }
}

async function listPullRequestsOf(
  remoteUrl: string,
  tokens: HostTokens
): Promise<{ provider: HostingProvider; prs: PullRequest[] }> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed) return { provider: null, prs: [] }
  const auth = await tokenForRemote(remoteUrl, parsed.provider, tokens)

  // GitLab merge requests
  if (parsed.provider === 'gitlab') {
    if (!auth) return { provider: 'gitlab', prs: [] }
    const pid = encodeURIComponent(`${parsed.owner}/${parsed.repo}`)
    const res = await fetch(
      `${glApi(parsed.base)}/projects/${pid}/merge_requests?state=opened&per_page=30`,
      { redirect: 'error', headers: gitlabAuth(auth) }
    )
    if (!res.ok) throw new Error(`GitLab API error (${res.status})`)
    const data = (await res.json()) as Array<{
      iid: number
      title: string
      author: { username: string }
      source_branch: string
      target_branch: string
      web_url: string
      draft?: boolean
      work_in_progress?: boolean
      reviewers?: Array<{ username: string }>
    } & GlListFields>
    return {
      provider: 'gitlab',
      prs: data.map((p) => ({
        id: p.iid,
        title: p.title,
        author: p.author?.username ?? 'unknown',
        sourceBranch: p.source_branch,
        targetBranch: p.target_branch,
        url: p.web_url,
        isDraft: !!(p.draft || p.work_in_progress),
        requestedReviewers: (p.reviewers ?? []).map((r) => r.username),
        ...glListExtras(p)
      }))
    }
  }

  if (parsed.provider === 'forgejo') {
    if (!auth || !parsed.base) return { provider: 'forgejo', prs: [] }
    return { provider: 'forgejo', prs: await listForgejoPulls(parsed.base, parsed.owner, parsed.repo, auth.token) }
  }

  // Bitbucket Data Center pull requests
  const bbsRepo = parsed.provider === 'bitbucket' && parsed.base ? bitbucketServerRepoOf(remoteUrl, [parsed.base]) : null
  if (bbsRepo) {
    if (!auth) return { provider: 'bitbucket', prs: [] }
    return { provider: 'bitbucket', prs: await listBbsPulls(bbsRepo, auth.token) }
  }

  // Bitbucket pull requests
  if (parsed.provider === 'bitbucket') {
    refuseUnreadableDataCenter(remoteUrl)
    if (!auth) return { provider: 'bitbucket', prs: [] }
    const res = await fetch(
      `https://api.bitbucket.org/2.0/repositories/${parsed.owner}/${parsed.repo}/pullrequests?state=OPEN&pagelen=30`,
      { headers: { Authorization: bitbucketAuthFor(auth) } }
    )
    if (!res.ok) throw new Error(`Bitbucket API error (${res.status})`)
    const data = (await res.json()) as { values: BbCloudPull[] }
    return { provider: 'bitbucket', prs: data.values.map(mapBbCloudPull) }
  }

  if (parsed.provider === 'github') {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
    if (auth) headers['Authorization'] = `Bearer ${auth.token}`
    const ep = ghEndpointsOf(parsed)
    const res = await fetch(`${ep.apiBase}/repos/${parsed.owner}/${parsed.repo}/pulls?state=open&per_page=30`, {
      headers
    })
    if (!res.ok) {
      const slug = `${parsed.owner}/${parsed.repo}`
      throw await githubRepoError(res.status, slug, !!auth, remoteUrl, await githubFailure(res))
    }
    const data = (await res.json()) as Array<{
      number: number
      title: string
      draft: boolean
      html_url: string
      user: { login: string }
      head: { ref: string; sha: string; repo?: { full_name: string } | null }
      base: { ref: string }
      // Present once GitHub's stacked pull requests are in play; absent on a
      // server without them, which is the same as "this one is on its own".
      stack?: { number: number } | null
      requested_reviewers?: Array<{ login: string }>
    } & GhListFields>
    const prs: PullRequest[] = data.map((p) => ({
      id: p.number,
      title: p.title,
      author: p.user.login,
      sourceBranch: p.head.ref,
      targetBranch: p.base.ref,
      url: p.html_url,
      isDraft: p.draft,
      stackNumber: p.stack?.number,
      state: 'open',
      headSha: p.head.sha,
      headRepo: p.head.repo?.full_name,
      requestedReviewers: (p.requested_reviewers ?? []).map((u) => u.login),
      ...ghListExtras(p)
    }))
    if (!auth) return { provider: 'github', prs }

    // A stack is only legible if the levels that are already closed or merged
    // are in the list too, and `state=open` hides exactly those. GitHub knows
    // the membership, so ask it — once per stack, not once per level.
    const stackNumbers = [...new Set(prs.map((p) => p.stackNumber).filter((n): n is number => n !== undefined))]
    const known = new Set(prs.map((p) => p.id))
    for (const stackNumber of stackNumbers) {
      const members = await ghJson<{ pull_requests?: GithubStackMember[] }>(
        `${ep.apiBase}/repos/${parsed.owner}/${parsed.repo}/stacks/${stackNumber}`,
        auth.token
      ).catch(() => null)
      for (const m of members?.pull_requests ?? []) {
        if (!m?.number || known.has(m.number)) continue
        known.add(m.number)
        prs.push({
          id: m.number,
          title: m.title ?? `#${m.number}`,
          author: m.user?.login ?? '',
          sourceBranch: m.head?.ref ?? '',
          targetBranch: m.base?.ref ?? '',
          url: m.html_url ?? `${ep.webBase}/${parsed.owner}/${parsed.repo}/pull/${m.number}`,
          isDraft: m.draft ?? false,
          stackNumber,
          state: m.merged_at ? 'merged' : m.state === 'closed' ? 'closed' : 'open',
          headSha: m.head?.sha
        })
      }
    }

    // The checks on each head, in the same batched shape the graph already
    // uses — one request per pull request, only when the list is refreshed.
    const shas = prs.map((p) => p.headSha).filter((sha): sha is string => !!sha)
    const ci = await fetchCiStatuses(remoteUrl, shas, auth.token).catch(() => ({}) as Record<string, CiStatus>)
    for (const pr of prs) {
      const status = pr.headSha ? ci[pr.headSha] : undefined
      if (!status) continue
      pr.ci = status.state
      pr.ciCounts = countChecks(status)
    }
    return { provider: 'github', prs }
  }

  // Azure DevOps
  if (!auth) throw await noCredential('Azure DevOps', remoteUrl)
  const base = `https://dev.azure.com/${parsed.owner}/${encodeURIComponent(parsed.project)}`
  // Unpaged, the API stops at about a hundred; $top/$skip walk the rest.
  const prs = await withAzureRetry(remoteUrl, auth, (token) =>
    allPages((page) =>
      adoJson<{ value: AzListPull[] }>(
        `${base}/_apis/git/repositories/${encodeURIComponent(parsed.repo)}/pullrequests` +
          `?searchCriteria.status=active&$top=100&$skip=${(page - 1) * 100}&api-version=7.1`,
        token
      ).then((d) => d.value)
    )
  )
  return { provider: 'azure', prs: prs.map((p) => mapAzListPull(p, base, parsed.repo)) }
}

// ── List rows, shared by the open list and the merged/closed one ────────────

/** What the PR list page reads beyond the sidebar's fields, per host. */
type GhListFields = { updated_at?: string; body?: string | null; user: { login: string; avatar_url?: string } }
type GlListFields = { updated_at?: string; description?: string | null; sha?: string; author: { username: string; avatar_url?: string } }

/** An https picture only: anything else is never handed to an <img>. */
const httpsOnly = (url: string | undefined | null): string | undefined =>
  url && /^https:\/\//i.test(url) ? url : undefined

function ghListExtras(p: GhListFields): Partial<PullRequest> {
  return {
    ...(p.updated_at ? { updatedAt: p.updated_at } : {}),
    ...(p.body ? { body: p.body } : {}),
    ...(httpsOnly(p.user.avatar_url) ? { authorAvatar: httpsOnly(p.user.avatar_url) } : {})
  }
}

function glListExtras(p: GlListFields): Partial<PullRequest> {
  return {
    ...(p.updated_at ? { updatedAt: p.updated_at } : {}),
    ...(p.description ? { body: p.description } : {}),
    ...(p.sha ? { headSha: p.sha } : {}),
    ...(httpsOnly(p.author?.avatar_url) ? { authorAvatar: httpsOnly(p.author.avatar_url) } : {})
  }
}

interface BbCloudPull {
  id: number
  title: string
  state?: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED'
  draft?: boolean
  description?: string
  updated_on?: string
  author: { display_name: string; links?: { avatar?: { href?: string } } }
  source: { branch: { name: string } }
  destination: { branch: { name: string } }
  links: { html: { href: string } }
}

export function mapBbCloudPull(p: BbCloudPull): PullRequest {
  return {
    id: p.id,
    title: p.title,
    author: p.author?.display_name ?? 'unknown',
    sourceBranch: p.source?.branch?.name ?? '',
    targetBranch: p.destination?.branch?.name ?? '',
    url: p.links.html.href,
    isDraft: !!p.draft,
    ...(p.state === 'MERGED' ? { state: 'merged' } : p.state === 'DECLINED' || p.state === 'SUPERSEDED' ? { state: 'closed' } : {}),
    ...(p.updated_on ? { updatedAt: p.updated_on } : {}),
    ...(p.description ? { body: p.description } : {}),
    ...(httpsOnly(p.author?.links?.avatar?.href) ? { authorAvatar: httpsOnly(p.author.links?.avatar?.href) } : {})
  }
}

interface AzListPull {
  pullRequestId: number
  title: string
  isDraft: boolean
  status?: 'active' | 'abandoned' | 'completed'
  description?: string
  creationDate?: string
  closedDate?: string
  createdBy: { displayName: string }
  sourceRefName: string
  targetRefName: string
  lastMergeSourceCommit?: { commitId?: string }
  reviewers?: Array<{ displayName?: string; vote?: number; isContainer?: boolean }>
}

export function mapAzListPull(p: AzListPull, base: string, repo: string): PullRequest {
  // No vote yet is "still asked to review"; a team (container) is not a person.
  const pending = (p.reviewers ?? []).filter((r) => !r.isContainer && !r.vote && r.displayName)
  // Azure's list has no last-activity time: closed when it ended, else opened.
  const at = p.closedDate || p.creationDate
  return {
    id: p.pullRequestId,
    title: p.title,
    author: p.createdBy.displayName,
    sourceBranch: p.sourceRefName.replace('refs/heads/', ''),
    targetBranch: p.targetRefName.replace('refs/heads/', ''),
    url: `${base}/_git/${encodeURIComponent(repo)}/pullrequest/${p.pullRequestId}`,
    isDraft: p.isDraft,
    ...(p.status === 'completed' ? { state: 'merged' } : p.status === 'abandoned' ? { state: 'closed' } : {}),
    ...(p.lastMergeSourceCommit?.commitId ? { headSha: p.lastMergeSourceCommit.commitId } : {}),
    ...(at ? { updatedAt: at } : {}),
    ...(p.description ? { body: p.description } : {}),
    ...(pending.length ? { requestedReviewers: pending.map((r) => r.displayName as string) } : {})
  }
}

/** How many merged/closed PRs the list page reads — per state where the host splits them. */
export const FINISHED_PR_LIMIT = 100

/**
 * The merged and closed pull requests of a remote, the most recently active
 * first — read only when the list page opens those tabs. Bounded: no host is
 * walked past FINISHED_PR_LIMIT per state, and `truncated` says so. No checks
 * are read for them: a finished PR's CI no longer decides anything, and it
 * would cost a request per row.
 */
async function listFinishedPullRequests(remoteUrl: string, tokens: HostTokens): Promise<FinishedPullRequests> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed) return { provider: null, prs: [], truncated: false }
  const auth = await tokenForRemote(remoteUrl, parsed.provider, tokens)
  const none = { provider: parsed.provider, prs: [], truncated: false }
  const N = FINISHED_PR_LIMIT

  if (parsed.provider === 'gitlab') {
    if (!auth) throw await noCredential('GitLab', remoteUrl)
    const pid = encodeURIComponent(`${parsed.owner}/${parsed.repo}`)
    type GlRow = { iid: number; title: string; source_branch: string; target_branch: string; web_url: string; draft?: boolean } & GlListFields
    const read = async (state: 'merged' | 'closed'): Promise<PullRequest[]> => {
      const data = await glJson<GlRow[]>(
        `${glApi(parsed.base)}/projects/${pid}/merge_requests?state=${state}&order_by=updated_at&sort=desc&per_page=${N}`,
        auth
      )
      return data.map((p) => ({
        id: p.iid,
        title: p.title,
        author: p.author?.username ?? 'unknown',
        sourceBranch: p.source_branch,
        targetBranch: p.target_branch,
        url: p.web_url,
        isDraft: !!p.draft,
        state,
        ...glListExtras(p)
      }))
    }
    const [merged, closed] = await Promise.all([read('merged'), read('closed')])
    return { provider: 'gitlab', prs: [...merged, ...closed], truncated: merged.length >= N || closed.length >= N }
  }

  if (parsed.provider === 'forgejo') {
    if (!parsed.base) return none
    if (!auth) throw await noCredential('Forgejo', remoteUrl)
    const prs = await listForgejoClosedPulls(parsed.base, parsed.owner, parsed.repo, auth.token, N)
    return { provider: 'forgejo', prs, truncated: prs.length >= N }
  }

  const bbsRepo = parsed.provider === 'bitbucket' && parsed.base ? bitbucketServerRepoOf(remoteUrl, [parsed.base]) : null
  if (bbsRepo) {
    if (!auth) throw await noCredential('Bitbucket', remoteUrl)
    const [merged, closed] = await Promise.all([
      listBbsPullsIn(bbsRepo, auth.token, 'MERGED', N),
      listBbsPullsIn(bbsRepo, auth.token, 'DECLINED', N)
    ])
    return { provider: 'bitbucket', prs: [...merged, ...closed], truncated: merged.length >= N || closed.length >= N }
  }

  if (parsed.provider === 'bitbucket') {
    refuseUnreadableDataCenter(remoteUrl)
    if (!auth) throw await noCredential('Bitbucket', remoteUrl)
    // Bitbucket caps a page at 50: two pages make the hundred.
    const url =
      `https://api.bitbucket.org/2.0/repositories/${parsed.owner}/${parsed.repo}/pullrequests` +
      `?state=MERGED&state=DECLINED&state=SUPERSEDED&sort=-updated_on&pagelen=50`
    const rows: BbCloudPull[] = []
    let next: string | undefined = url
    while (next && rows.length < N) {
      const res = await fetch(next, { headers: { Authorization: bitbucketAuthFor(auth) } })
      if (!res.ok) throw new Error(`Bitbucket API error (${res.status})`)
      const page = (await res.json()) as { values?: BbCloudPull[]; next?: string }
      rows.push(...(page.values ?? []))
      // Only ever follow Bitbucket's own next link.
      next = page.next?.startsWith('https://api.bitbucket.org/') ? page.next : undefined
    }
    return { provider: 'bitbucket', prs: rows.slice(0, N).map(mapBbCloudPull), truncated: !!next || rows.length > N }
  }

  if (parsed.provider === 'github') {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
    if (auth) headers['Authorization'] = `Bearer ${auth.token}`
    const ep = ghEndpointsOf(parsed)
    // `closed` is merged and closed alike; `merged_at` tells them apart.
    const res = await fetch(
      `${ep.apiBase}/repos/${parsed.owner}/${parsed.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${N}`,
      { headers }
    )
    if (!res.ok) {
      throw await githubRepoError(res.status, `${parsed.owner}/${parsed.repo}`, !!auth, remoteUrl, await githubFailure(res))
    }
    type GhRow = {
      number: number
      title: string
      draft?: boolean
      html_url: string
      merged_at?: string | null
      head: { ref: string; sha?: string; repo?: { full_name: string } | null }
      base: { ref: string }
    } & GhListFields
    const data = (await res.json()) as GhRow[]
    const prs: PullRequest[] = data.map((p) => ({
      id: p.number,
      title: p.title,
      author: p.user.login,
      sourceBranch: p.head.ref,
      targetBranch: p.base.ref,
      url: p.html_url,
      isDraft: !!p.draft,
      state: p.merged_at ? 'merged' : 'closed',
      ...(p.head.sha ? { headSha: p.head.sha } : {}),
      ...(p.head.repo?.full_name ? { headRepo: p.head.repo.full_name } : {}),
      ...ghListExtras(p)
    }))
    return { provider: 'github', prs, truncated: data.length >= N }
  }

  // Azure DevOps: completed is merged, abandoned is closed. Its API names no
  // order for the answer, so the window is what can be asked for: the ones
  // that ended in the last year (by close date). Past a hundred in that year,
  // which hundred is the server's choice — the handbook says so.
  if (!auth) throw await noCredential('Azure DevOps', remoteUrl)
  const base = `https://dev.azure.com/${parsed.owner}/${encodeURIComponent(parsed.project)}`
  const since = new Date(Date.now() - 365 * 24 * 3600_000).toISOString()
  const read = (status: 'completed' | 'abandoned'): Promise<AzListPull[]> =>
    withAzureRetry(remoteUrl, auth, (token) =>
      adoJson<{ value: AzListPull[] }>(
        `${base}/_apis/git/repositories/${encodeURIComponent(parsed.repo)}/pullrequests` +
          `?searchCriteria.status=${status}&searchCriteria.queryTimeRangeType=closed` +
          `&searchCriteria.minTime=${encodeURIComponent(since)}&$top=${N}&api-version=7.1`,
        token
      ).then((d) => d.value ?? [])
    )
  const [merged, closed] = await Promise.all([read('completed'), read('abandoned')])
  return {
    provider: 'azure',
    prs: [...merged, ...closed].map((p) => mapAzListPull(p, base, parsed.repo)),
    truncated: merged.length >= N || closed.length >= N
  }
}

/**
 * A Forgejo remote's instance, owner/repo and token — through remoteApiToken,
 * so only the profile owning that instance's token is used. Null when the
 * remote is not on a Forgejo server or no credential reaches it.
 */
async function forgejoRemote(
  remoteUrl: string
): Promise<{ base: string; owner: string; repo: string; token: string } | null> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed || parsed.provider !== 'forgejo' || !parsed.base) return null
  const auth = await remoteApiToken(remoteUrl, 'forgejo', undefined)
  return auth ? { base: parsed.base, owner: parsed.owner, repo: parsed.repo, token: auth.token } : null
}

/** forgejoRemote for an action the user asked for: no credential is an error, not an empty list. */
async function forgejoRemoteOrThrow(remoteUrl: string): Promise<{ base: string; owner: string; repo: string; token: string }> {
  const f = await forgejoRemote(remoteUrl)
  if (!f) throw await noCredential('Forgejo', remoteUrl)
  return f
}

const isForgejo = (remoteUrl: string): boolean => parseRemoteUrl(remoteUrl)?.provider === 'forgejo'

async function listReleases(
  remoteUrl: string,
  tokens: { github?: string }
): Promise<{ provider: HostingProvider; releases: ReleaseInfo[] }> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (parsed?.provider === 'forgejo') {
    const f = await forgejoRemote(remoteUrl)
    return { provider: 'forgejo', releases: f ? await listForgejoReleases(f.base, f.owner, f.repo, f.token) : [] }
  }
  // Azure DevOps "releases" are pipelines, and GitLab's are not wired: GitHub and Forgejo only.
  if (!parsed || parsed.provider !== 'github') return { provider: parsed?.provider ?? null, releases: [] }

  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  const auth = await remoteApiToken(remoteUrl, 'github', tokens.github)
  if (auth) headers['Authorization'] = `Bearer ${auth.token}`
  const res = await fetch(`${ghEndpointsOf(parsed).apiBase}/repos/${parsed.owner}/${parsed.repo}/releases?per_page=50`, {
    headers
  })
  if (!res.ok) {
    const slug = `${parsed.owner}/${parsed.repo}`
    throw await githubRepoError(res.status, slug, !!auth, remoteUrl, await githubFailure(res))
  }
  const data = (await res.json()) as Array<{
    id: number
    tag_name: string | null
    name: string | null
    body: string | null
    draft: boolean
    prerelease: boolean
    published_at: string | null
    html_url: string
  }>
  return {
    provider: 'github',
    releases: data.map((r) => ({
      id: r.id,
      tag: r.tag_name || null,
      name: r.name,
      body: r.body,
      publishedAt: r.published_at,
      url: r.html_url,
      prerelease: r.prerelease,
      draft: r.draft
    }))
  }
}

function createPullRequestUrl(remoteUrl: string, source: string, target: string): string | null {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed) return null
  if (parsed.provider === 'github') {
    return `${ghEndpointsOf(parsed).webBase}/${parsed.owner}/${parsed.repo}/compare/${target}...${source}?expand=1`
  }
  if (parsed.provider === 'forgejo' && parsed.base) {
    return forgejoCompareUrl(parsed.base, parsed.owner, parsed.repo, target, source)
  }
  if (parsed.provider === 'gitlab') {
    return `${parsed.base ?? GITLAB_COM}/${parsed.owner}/${parsed.repo}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(source)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(target)}`
  }
  const bbsRepo = bbsRepoOfRemote(remoteUrl)
  if (bbsRepo) return bitbucketServerCreatePrUrl(bbsRepo, source, target)
  if (onDataCenter(remoteUrl)) return null
  if (parsed.provider === 'bitbucket') {
    return `https://bitbucket.org/${parsed.owner}/${parsed.repo}/pull-requests/new?source=${encodeURIComponent(source)}&dest=${encodeURIComponent(target)}`
  }
  return `https://dev.azure.com/${parsed.owner}/${encodeURIComponent(parsed.project)}/_git/${encodeURIComponent(
    parsed.repo
  )}/pullrequestcreate?sourceRef=${encodeURIComponent(source)}&targetRef=${encodeURIComponent(target)}`
}

/**
 * Create a pull/merge request. GitHub is fully supported; Azure DevOps too.
 * (GitLab/Bitbucket creation is tracked separately under hosting verification —
 * their remotes aren't parsed by parseRemoteUrl yet.)
 */
/** GitHub's error envelope: a headline plus, on a 422, one entry per problem. */
interface GithubErrorBody {
  message?: string
  errors?: { resource?: string; field?: string; code?: string; message?: string }[]
}

/**
 * A GitHub API failure, said in words.
 *
 * The headline for a rejected PR is always "Validation Failed", and the entry
 * that explains it usually carries no `message` at all — only a `field` and a
 * `code`, which the user cannot be expected to read. So the two that actually
 * happen get spelled out with the branch names in them, and anything else
 * degrades to `field: code` rather than being dropped, which is how the
 * useless headline used to be all that survived.
 */
function githubErrorMessage(detail: GithubErrorBody | null, status: number, opts: CreatePrOpts): string {
  const parts = (detail?.errors ?? []).map((e) => {
    if (e.message) return e.message
    if (e.field === 'head') {
      // The commonest cause by far: the branch was never pushed, so as far as
      // GitHub is concerned there is nothing to open a pull request from.
      return `the branch "${opts.source}" is not on the remote — push it first`
    }
    if (e.field === 'base') return `the base branch "${opts.target}" is not on the remote`
    return [e.field, e.code].filter(Boolean).join(': ')
  })
  const listed = parts.filter(Boolean).join('; ')
  if (listed && detail?.message) return `${detail.message} — ${listed}`
  return listed || detail?.message || `API error (${status})`
}

async function createPullRequest(
  remoteUrl: string,
  tokens: HostTokens,
  sent: CreatePrOpts
): Promise<CreatePrResult> {
  // Picks off the IPC boundary: string lists or nothing, so an empty pick sends today's request.
  const opts = cleanPrMeta(sent)
  refuseUnreadableDataCenter(remoteUrl)
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed) throw new Error('Unrecognized remote — PR creation supports GitHub, GitLab, Forgejo, Bitbucket and Azure DevOps.')
  const auth = await tokenForRemote(remoteUrl, parsed.provider, tokens)

  if (parsed.provider === 'forgejo') {
    if (!auth || !parsed.base) throw await noCredential('Forgejo', remoteUrl)
    return createForgejoPull(parsed.base, parsed.owner, parsed.repo, auth.token, opts)
  }

  // GitLab merge request
  if (parsed.provider === 'gitlab') {
    if (!auth) throw await noCredential('GitLab', remoteUrl)
    const pid = encodeURIComponent(`${parsed.owner}/${parsed.repo}`)
    const res = await fetch(`${glApi(parsed.base)}/projects/${pid}/merge_requests`, {
      method: 'POST',
      redirect: 'error',
      headers: { ...gitlabAuth(auth), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_branch: opts.source,
        target_branch: opts.target,
        title: opts.draft ? `Draft: ${opts.title}` : opts.title,
        description: opts.body,
        ...gitlabMetaBody(opts)
      })
    })
    if (!res.ok) {
      const d = (await res.json().catch(() => null)) as { message?: unknown } | null
      throw new Error(`GitLab: ${typeof d?.message === 'string' ? d.message : `API error (${res.status})`}`)
    }
    const d = (await res.json()) as Parameters<typeof gitlabMetaMissing>[1] & { iid: number; web_url: string }
    const metaFailed = gitlabMetaMissing(opts, d)
    return { url: d.web_url, number: d.iid, ...(metaFailed.length ? { metaFailed } : {}) }
  }

  // Bitbucket Data Center pull request
  const bbsRepo = bbsRepoOfRemote(remoteUrl)
  if (bbsRepo) {
    if (!auth) throw await noCredential('Bitbucket', remoteUrl)
    return createBbsPull(bbsRepo, auth.token, opts)
  }

  // Bitbucket pull request
  if (parsed.provider === 'bitbucket') {
    refuseUnreadableDataCenter(remoteUrl)
    if (!auth) throw await noCredential('Bitbucket', remoteUrl)
    // A reviewer bitbucket.org refuses (the author, someone without access) costs the reviewers, not the PR.
    const { result: d, dropped } = await createWithoutRejectedReviewers(opts, async (o) => {
      const res = await fetch(
        `https://api.bitbucket.org/2.0/repositories/${parsed.owner}/${parsed.repo}/pullrequests`,
        {
          method: 'POST',
          headers: { Authorization: bitbucketAuthFor(auth), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: o.title,
            description: o.body,
            source: { branch: { name: o.source } },
            destination: { branch: { name: o.target } },
            ...bitbucketMetaBody(o)
          })
        }
      )
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: unknown } } | null
        const fields = e?.error?.fields && typeof e.error.fields === 'object' ? Object.keys(e.error.fields) : []
        throw new PrCreateError(`Bitbucket: ${e?.error?.message || `API error (${res.status})`}`, res.status, fields)
      }
      return (await res.json()) as { id: number; links: { html: { href: string } }; reviewers?: unknown }
    })
    const metaFailed: PrMetaField[] = dropped ? ['reviewers'] : reviewersMissing(opts, bitbucketReviewerIds(d.reviewers))
    return { url: d.links.html.href, number: d.id, ...(metaFailed.length ? { metaFailed } : {}) }
  }

  if (parsed.provider === 'github') {
    if (!auth) throw await noCredential('GitHub', remoteUrl)
    const repoApi = `${ghEndpointsOf(parsed).apiBase}/repos/${parsed.owner}/${parsed.repo}`
    const res = await fetch(`${repoApi}/pulls`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: opts.title,
        head: opts.source,
        base: opts.target,
        body: opts.body,
        draft: opts.draft
      })
    })
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as GithubErrorBody | null
      throw new Error(`GitHub: ${githubErrorMessage(detail, res.status, opts)}`)
    }
    const d = (await res.json()) as { html_url: string; number: number }
    // The PR exists from here on: a pick GitHub refuses is reported, never thrown.
    const metaFailed = await applyGithubPrMeta(repoApi, d.number, opts, (u, i) => ghJson(u, auth.token, i))
    return { url: d.html_url, number: d.number, ...(metaFailed.length ? { metaFailed } : {}) }
  }

  // Azure DevOps
  if (!auth) throw await noCredential('Azure DevOps', remoteUrl)
  const base = `https://dev.azure.com/${parsed.owner}/${encodeURIComponent(parsed.project)}`
  const repoApi = `${base}/_apis/git/repositories/${encodeURIComponent(parsed.repo)}`
  // Only the create may evict a borrowed credential; the labels after it go out
  // plain, with the token the create succeeded with (see azureCreateSession).
  const session = azureCreateSession(remoteUrl, auth)
  // A reviewer Azure refuses (a 400 naming an identity it cannot add) costs the reviewers, not the PR.
  const { result: d, dropped } = await createWithoutRejectedReviewers(opts, (o) =>
    session.create<{ pullRequestId: number; reviewers?: unknown }>(`${repoApi}/pullrequests?api-version=7.1`, {
      method: 'POST',
      body: JSON.stringify({
        sourceRefName: `refs/heads/${o.source}`,
        targetRefName: `refs/heads/${o.target}`,
        title: o.title,
        description: o.body,
        isDraft: o.draft,
        ...azureMetaBody(o)
      })
    })
  )
  const metaFailed: PrMetaField[] = [
    // Azure answers with the reviewers it kept; an answer without the list is not read as a refusal.
    ...(dropped ? (['reviewers'] as const) : Array.isArray(d.reviewers) ? reviewersMissing(opts, azureReviewerIds(d.reviewers)) : []),
    ...(await applyAzureLabels(repoApi, d.pullRequestId, opts.labels, (url, init) => adoJson(url, session.token(), init)))
  ]
  return {
    url: `${base}/_git/${encodeURIComponent(parsed.repo)}/pullrequest/${d.pullRequestId}`,
    number: d.pullRequestId,
    ...(metaFailed.length ? { metaFailed } : {})
  }
}

/**
 * What the create dialog can offer for this remote: which of reviewers,
 * assignees and labels the host takes, and the choices for each. A list the
 * token cannot read is reported in `failed` rather than thrown, so the dialog
 * still opens the PR; only a missing credential throws, as createPR would.
 *
 * Every read here is a plain one on every host: no retry that evicts a
 * borrowed credential. Opening a dialog must never cost the user a saved login.
 */
async function prPickerOptions(remoteUrl: string, tokens: HostTokens): Promise<PrPickerOptions> {
  refuseUnreadableDataCenter(remoteUrl)
  const parsed = parseRemoteUrl(remoteUrl)
  const supports = prMetaSupport(parsed?.provider ?? null)
  if (!parsed || !Object.values(supports).some(Boolean)) return { supports, reviewers: [], assignees: [], labels: [], failed: [] }
  const auth = await tokenForRemote(remoteUrl, parsed.provider, tokens)
  const bbsRepo = bbsRepoOfRemote(remoteUrl)
  if (parsed.provider === 'github') {
    if (!auth) throw await noCredential('GitHub', remoteUrl)
    const ep = ghEndpointsOf(parsed)
    return githubPickerOptions(`${ep.apiBase}/repos/${parsed.owner}/${parsed.repo}`, ep.apiBase, (u, i) => ghJson(u, auth.token, i))
  }
  if (parsed.provider === 'gitlab') {
    if (!auth) throw await noCredential('GitLab', remoteUrl)
    const pid = encodeURIComponent(`${parsed.owner}/${parsed.repo}`)
    return gitlabPickerOptions(`${glApi(parsed.base)}/projects/${pid}`, (u, i) => glJson(u, auth, i))
  }
  if (bbsRepo) {
    if (!auth) throw await noCredential('Bitbucket', remoteUrl)
    return bbsPickerOptions(bbsRepo, auth.token)
  }
  if (parsed.provider === 'bitbucket') {
    refuseUnreadableDataCenter(remoteUrl)
    if (!auth) throw await noCredential('Bitbucket', remoteUrl)
    return bitbucketPickerOptions(parsed.owner, parsed.repo, bitbucketCloudJson(bitbucketAuthFor(auth)))
  }
  if (!auth) throw await noCredential('Azure DevOps', remoteUrl)
  // A plain read, never withAzureRetry: a token without the Project and Team
  // read scope answers 401 here, and that must cost only the list — not evict
  // the git credential the user's pushes and the create itself rely on.
  return azurePickerOptions(parsed.owner, parsed.project, (url, init) => adoJson(url, auth.token, init))
}

/** Resolve a GitHub remote to {owner, repo} or throw (these B2 ops are GitHub-only for now). */
async function ghRepoOf(
  remoteUrl: string,
  token?: string
): Promise<{ owner: string; repo: string; token: string; ep: GithubEndpoints; api: string }> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed || parsed.provider !== 'github') {
    throw new Error('This action currently supports GitHub repositories only.')
  }
  const auth = await remoteApiToken(remoteUrl, 'github', token)
  if (!auth) throw await noCredential('GitHub', remoteUrl)
  const ep = ghEndpointsOf(parsed)
  // `api` is the repository's REST root on its own server — github.com or GHES.
  return { owner: parsed.owner, repo: parsed.repo, token: auth.token, ep, api: `${ep.apiBase}/repos/${parsed.owner}/${parsed.repo}` }
}

// ── GitLab merge request review ─────────────────────────────────────────────
// Mirrors the GitHub review surface below, normalised into the shared PR types
// so the renderer never has to branch on provider vocabulary.

/** GitLab counterpart to ghJson — one place for auth headers and error extraction. */
export async function glJson<T>(
  url: string,
  auth: { token: string; cred?: GitCredential },
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    redirect: 'error',
    headers: {
      ...gitlabAuth(auth),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string>)
    }
  })
  if (!res.ok) {
    // GitLab errors carry {message} (string or array) or {error}.
    const d = (await res.json().catch(() => null)) as { message?: unknown; error?: unknown } | null
    const raw = d?.message ?? d?.error
    const msg = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join('; ') : ''
    // The status rides on the error, so a 401/403 is told from a 5xx without reading words.
    throw new HttpStatusError(msg ? `GitLab: ${msg}` : `GitLab API error (${res.status})`, res.status)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Resolve a GitLab remote to its project API base + credential, or throw. */
async function glProjectOf(
  remoteUrl: string,
  token?: string
): Promise<{ base: string; auth: { token: string; cred?: GitCredential } }> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed || parsed.provider !== 'gitlab') throw new Error('Not a GitLab repository.')
  const auth = await remoteApiToken(remoteUrl, 'gitlab', token)
  if (!auth) throw await noCredential('GitLab', remoteUrl)
  const pid = encodeURIComponent(`${parsed.owner}/${parsed.repo}`)
  return { base: `${glApi(parsed.base)}/projects/${pid}`, auth }
}

/** The user shape GitLab embeds in MRs, notes and approvals. */
interface GlUser {
  username: string
  avatar_url?: string | null
}

interface GlNote {
  id: number
  system: boolean
  author: GlUser | null
  body: string
  created_at: string
  position?: {
    new_path?: string | null
    old_path?: string | null
    new_line?: number | null
    old_line?: number | null
    /** The MR head the note was written against. */
    head_sha?: string | null
  } | null
}

/**
 * The repository a GitHub pull request's head lives in, when that is not the
 * base repository — or null. A deleted fork reports `head.repo` as null, but
 * its `head.label` (`owner:branch`) still names the owner, which is enough to
 * know the branch is not here.
 */
export function githubForkSource(
  head: { label?: string; repo?: { full_name: string } | null },
  base: { repo?: { full_name: string } | null },
  baseOwner: string
): string | null {
  const baseRepo = base.repo?.full_name
  const headRepo = head.repo?.full_name
  if (headRepo) return baseRepo && headRepo !== baseRepo ? headRepo : null
  const colon = head.label?.indexOf(':') ?? -1
  const headOwner = colon > 0 ? head.label!.slice(0, colon) : ''
  const owner = baseRepo?.split('/')[0] || baseOwner
  return headOwner && headOwner.toLowerCase() !== owner.toLowerCase() ? headOwner : null
}

/** True when a GitLab merge request comes from another project (a fork). */
export function isGitlabForkMr(mr: { source_project_id?: number; project_id?: number }): boolean {
  return mr.source_project_id !== undefined && mr.project_id !== undefined && mr.source_project_id !== mr.project_id
}

async function glMergeRequestDetail(remoteUrl: string, token: string | undefined, number: number): Promise<PrDetail> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  const mrUrl = `${base}/merge_requests/${number}`
  const [mr, discussions, approvals, commits] = await Promise.all([
    glJson<{
      iid: number
      title: string
      description: string | null
      author: GlUser | null
      source_branch: string
      target_branch: string
      draft?: boolean
      work_in_progress?: boolean
      state: string
      merge_status?: string
      web_url: string
      created_at: string
      updated_at: string
      closed_at: string | null
      merged_at: string | null
      merged_by: GlUser | null
      assignees?: GlUser[]
      reviewers?: GlUser[]
      labels?: Array<{ name: string; color?: string } | string>
      milestone: { title: string } | null
      /** A string, and "1000+" past GitLab's cap. */
      changes_count?: string | null
      source_project_id?: number
      project_id?: number
      diff_refs?: { head_sha?: string } | null
    }>(`${mrUrl}?with_labels_details=true`, auth),
    allPages((page) =>
      glJson<Array<{ id: string; notes: GlNote[] }>>(`${mrUrl}/discussions?per_page=100&page=${page}`, auth)
    ).catch(() => [] as Array<{ id: string; notes: GlNote[] }>),
    glJson<{ approved_by?: Array<{ user: GlUser | null }> }>(`${mrUrl}/approvals`, auth).catch(() => ({
      approved_by: []
    })),
    // Only the count is shown; one page of 100 is enough to say "100+".
    glJson<unknown[]>(`${mrUrl}/commits?per_page=100`, auth).catch(() => null)
  ])

  const avatars: Record<string, string> = {}
  const seen = (u: GlUser | null | undefined): void => {
    if (u?.username && u.avatar_url) avatars[u.username] = u.avatar_url
  }
  ;[mr.author, mr.merged_by, ...(mr.assignees ?? []), ...(mr.reviewers ?? [])].forEach(seen)
  for (const d of discussions) d.notes.forEach((n) => seen(n.author))
  ;(approvals.approved_by ?? []).forEach((a) => seen(a.user))
  const approvedBy = new Set((approvals.approved_by ?? []).map((a) => a.user?.username).filter(Boolean))

  // Discussions hold both kinds of comment: a note with a position is an inline
  // review thread, one without is plain conversation. System notes are noise.
  const comments: PrDetail['comments'] = []
  const reviewThreads: PrReviewThread[] = []
  for (const d of discussions) {
    const notes = d.notes.filter((n) => !n.system)
    if (notes.length === 0) continue
    const pos = notes[0].position
    if (pos) {
      reviewThreads.push({
        path: pos.new_path || pos.old_path || '',
        line: pos.new_line ?? pos.old_line ?? null,
        // GitLab notes carry a file position but not the surrounding hunk.
        diffHunk: '',
        rootId: d.id,
        // An unchanged line carries both numbers; it is drawn on the new side.
        // Only on the current diff: a note written against an older head counts
        // its line in that version, so it stays in the conversation.
        ...(pos.head_sha && pos.head_sha === mr.diff_refs?.head_sha
          ? pos.new_line != null
            ? { side: 'new' as const }
            : pos.old_line != null
              ? { side: 'old' as const }
              : {}
          : {}),
        // One notes endpoint edits and deletes both kinds. No "edited" mark: a
        // note's updated_at also moves when its thread is resolved.
        comments: notes.map((n) => ({
          id: n.id,
          author: n.author?.username ?? 'unknown',
          body: n.body,
          createdAt: n.created_at,
          handle: { id: n.id, kind: 'review' as const }
        }))
      })
    } else {
      notes.forEach((n, i) =>
        comments.push({
          author: n.author?.username ?? 'unknown',
          body: n.body,
          createdAt: n.created_at,
          handle: { id: n.id, kind: 'conversation' },
          // A discussion's first note, with replies after it.
          ...(i === 0 && notes.length > 1 ? { hasReplies: true } : {})
        })
      )
    }
  }
  comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  // A fork's path costs one more request, made only for a fork. Unreadable (a
  // private fork) leaves the project's id, which still says "not this one".
  const sourceRepo = isGitlabForkMr(mr)
    ? await glJson<{ path_with_namespace?: string }>(
        `${base.replace(/\/projects\/[^/]+$/, '/projects')}/${mr.source_project_id}`,
        auth
      )
        .then((p) => p.path_with_namespace || `projects/${mr.source_project_id}`)
        .catch(() => `projects/${mr.source_project_id}`)
    : null

  const changed = Number.parseInt(mr.changes_count ?? '', 10)
  return {
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    closedAt: mr.closed_at,
    mergedAt: mr.merged_at,
    mergedBy: mr.merged_by?.username ?? null,
    assignees: (mr.assignees ?? []).map((u) => ({ login: u.username })),
    // GitLab keeps reviewers listed after they approve; only the ones still to
    // answer are "requested" — the approvals say who already did.
    requestedReviewers: (mr.reviewers ?? [])
      .filter((u) => !approvedBy.has(u.username))
      .map((u) => ({ login: u.username })),
    labels: (mr.labels ?? []).map((l) =>
      typeof l === 'string' ? { name: l } : { name: l.name, ...(l.color ? { color: l.color } : {}) }
    ),
    milestone: mr.milestone?.title ?? null,
    ...(Number.isFinite(changed) ? { changedFiles: changed } : {}),
    ...(commits ? { commits: commits.length, ...(commits.length >= 100 ? { commitsCapped: true } : {}) } : {}),
    sourceRepo,
    avatars,
    number: mr.iid,
    title: mr.title,
    body: mr.description ?? '',
    author: mr.author?.username ?? 'unknown',
    source: mr.source_branch,
    target: mr.target_branch,
    draft: !!(mr.draft || mr.work_in_progress),
    state: mr.state === 'opened' ? 'open' : 'closed',
    merged: mr.state === 'merged',
    mergeable: mr.merge_status === 'can_be_merged' ? true : mr.merge_status === 'cannot_be_merged' ? false : null,
    url: mr.web_url,
    comments,
    reviews: (approvals.approved_by ?? []).map((a) => ({
      author: a.user?.username ?? 'unknown',
      state: 'APPROVED' as const
    })),
    reviewThreads
  }
}

/** GitLab job status → the check-run vocabulary the renderer already renders. */
/** A GitLab job's id from its page link, `…/-/jobs/<id>`. */
export function getGitlabJobId(url: string | null | undefined): string | null {
  return /\/-\/jobs\/(\d+)(?:[/?#]|$)/.exec(url ?? '')?.[1] ?? null
}

/** Statuses whose job never ran, so there is no trace to read (as ciRunsGitlab's). */
const GL_NO_TRACE = new Set(['created', 'pending', 'manual', 'skipped', 'scheduled', 'waiting_for_resource', 'preparing', 'running'])

export function glJobToCheck(
  job: { name: string; status: string; web_url?: string | null; started_at?: string | null; finished_at?: string | null },
  pipeline?: { id: number; sha?: string }
): PrCheck {
  const map: Record<string, { status: string; conclusion: string | null }> = {
    created: { status: 'queued', conclusion: null },
    pending: { status: 'queued', conclusion: null },
    waiting_for_resource: { status: 'queued', conclusion: null },
    preparing: { status: 'queued', conclusion: null },
    scheduled: { status: 'queued', conclusion: null },
    running: { status: 'in_progress', conclusion: null },
    success: { status: 'completed', conclusion: 'success' },
    failed: { status: 'completed', conclusion: 'failure' },
    canceled: { status: 'completed', conclusion: 'cancelled' },
    canceling: { status: 'completed', conclusion: 'cancelled' },
    skipped: { status: 'completed', conclusion: 'skipped' },
    manual: { status: 'completed', conclusion: 'action_required' }
  }
  const m = map[job.status] ?? { status: 'completed', conclusion: 'neutral' }
  const startedAt = isoToMs(job.started_at)
  const finishedAt = m.status === 'completed' ? isoToMs(job.finished_at) : undefined
  return {
    name: job.name,
    status: m.status,
    conclusion: m.conclusion,
    url: job.web_url || '',
    ...(getGitlabJobId(job.web_url) && !GL_NO_TRACE.has(job.status) ? { hasLog: true } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(pipeline?.sha ? { sha: pipeline.sha } : {}),
    // GitLab retries a pipeline's failed jobs (the CI runs page's "re-run failed").
    ...(pipeline ? { runId: String(pipeline.id) } : {})
  }
}

async function glMergeRequestChecks(remoteUrl: string, token: string | undefined, number: number): Promise<PrCheck[]> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  // Pipelines come newest-first; the head pipeline's jobs are the checks.
  const pipelines = await glJson<Array<{ id: number; sha?: string }>>(
    `${base}/merge_requests/${number}/pipelines?per_page=1`,
    auth
  ).catch(() => [] as Array<{ id: number; sha?: string }>)
  if (pipelines.length === 0) return []
  type GlCheckJob = Parameters<typeof glJobToCheck>[0]
  const jobs = await glJson<GlCheckJob[]>(`${base}/pipelines/${pipelines[0].id}/jobs?per_page=100`, auth).catch(
    () => [] as GlCheckJob[]
  )
  return jobs.map((j) => glJobToCheck(j, pipelines[0]))
}

/** Count added/removed lines in a unified diff body (file headers excluded). */
export function diffLineCounts(diff: string): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++
  }
  return { additions, deletions }
}

/** One file of a GitLab diff — a merge request's, or a compare's. */
type GlDiff = {
  old_path: string
  new_path: string
  new_file: boolean
  renamed_file: boolean
  deleted_file: boolean
  diff: string
  /** Over the instance's diff limits: GitLab sends no diff and sets this. */
  too_large?: boolean
}

function glDiffToFile(d: GlDiff): PrFile {
  // GitLab sends an empty diff for files over its limits, and a hunk-less
  // "Binary files … differ" for binaries: neither is a patch to draw.
  const hasHunk = /^@@ /m.test(d.diff || '')
  const reason = hasHunk ? null : /^Binary files .* differ$/m.test(d.diff || '') ? 'binary' : d.too_large ? 'hostOmitted' : null
  return {
    filename: d.new_path || d.old_path,
    status: d.new_file ? 'added' : d.deleted_file ? 'removed' : d.renamed_file ? 'renamed' : 'modified',
    ...diffLineCounts(hasHunk ? d.diff : ''),
    ...(hasHunk ? { patch: d.diff } : {}),
    ...(reason ? { noPatchReason: reason } : {}),
    ...(d.renamed_file && d.old_path !== d.new_path ? { previousFilename: d.old_path } : {})
  }
}

async function glMergeRequestFiles(remoteUrl: string, token: string | undefined, number: number): Promise<PrFile[]> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  const diffs = await allPages((page) =>
    glJson<GlDiff[]>(`${base}/merge_requests/${number}/diffs?per_page=100&page=${page}`, auth)
  ).catch(() => [] as GlDiff[])
  return diffs.map(glDiffToFile)
}

async function glReplyReviewComment(
  remoteUrl: string,
  token: string | undefined,
  number: number,
  discussionId: string,
  body: string
): Promise<void> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  await glJson(`${base}/merge_requests/${number}/discussions/${encodeURIComponent(discussionId)}/notes`, auth, {
    method: 'POST',
    body: JSON.stringify({ body })
  })
}

async function glCommentOnMr(remoteUrl: string, token: string | undefined, number: number, body: string): Promise<void> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  await glJson(`${base}/merge_requests/${number}/notes`, auth, { method: 'POST', body: JSON.stringify({ body }) })
}

async function glReviewMr(
  remoteUrl: string,
  token: string | undefined,
  number: number,
  event: PrReviewEvent,
  body: string
): Promise<void> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  // GitLab has no single "submit review" call: approval is its own endpoint,
  // and requesting changes is an unapproval plus a comment.
  if (event === 'APPROVE') {
    await glJson(`${base}/merge_requests/${number}/approve`, auth, { method: 'POST' })
  } else if (event === 'REQUEST_CHANGES') {
    // A 404 here just means "you had not approved" — nothing worth surfacing.
    await glJson(`${base}/merge_requests/${number}/unapprove`, auth, { method: 'POST' }).catch(() => undefined)
  }
  if (body) {
    await glJson(`${base}/merge_requests/${number}/notes`, auth, { method: 'POST', body: JSON.stringify({ body }) })
  }
}

async function glMergeMr(
  remoteUrl: string,
  token: string | undefined,
  number: number,
  method: PrMergeMethod
): Promise<void> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  // GitLab picks merge-commit vs fast-forward from the project settings; the
  // API only takes a squash flag. The renderer hides "rebase" for GitLab.
  await glJson(`${base}/merge_requests/${number}/merge`, auth, {
    method: 'PUT',
    body: JSON.stringify({ squash: method === 'squash' })
  })
}

async function glSetMrState(
  remoteUrl: string,
  token: string | undefined,
  number: number,
  state: 'open' | 'closed'
): Promise<void> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  await glJson(`${base}/merge_requests/${number}`, auth, {
    method: 'PUT',
    body: JSON.stringify({ state_event: state === 'closed' ? 'close' : 'reopen' })
  })
}

/** Moves a merge request to draft or back: GitLab reads a "Draft:" title as a draft. */
async function glSetMrDraft(remoteUrl: string, token: string | undefined, number: number, draft: boolean): Promise<void> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  const mr = await glJson<{ title: string }>(`${base}/merge_requests/${number}`, auth)
  await glJson(`${base}/merge_requests/${number}`, auth, {
    method: 'PUT',
    body: JSON.stringify({ title: titleForDraft(mr.title, draft, 'Draft:') })
  })
}

/**
 * Every page of a list endpoint, 100 at a time — the most GitHub and GitLab
 * serve per page, whatever `per_page` asks for. Capped so a pathological PR
 * cannot loop for ever (GitHub stops listing a PR's files at 3000 anyway).
 */
export async function allPages<T>(fetchPage: (page: number) => Promise<T[]>, maxPages = 30): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchPage(page)
    out.push(...items)
    if (items.length < 100) break
  }
  return out
}

/** The user shape GitHub embeds in PRs, comments and reviews. */
interface GhUser {
  login: string
  avatar_url?: string
}

/**
 * An Azure DevOps remote, and an `ado` caller for it: the profile's credential
 * (remoteApiToken) with the same retry-on-revoked-helper-credential the list
 * uses, so azurePr.ts needs to know nothing about auth.
 */
async function azRepoOf(
  remoteUrl: string,
  sent: string | undefined
): Promise<{ ado: Ado; adoPage: AdoPage; optional: Ado; text: AdoText; bytes: AdoBytes; repo: AzureRepo; token: string }> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed || parsed.provider !== 'azure') throw new Error('Not an Azure DevOps repository.')
  const auth = await remoteApiToken(remoteUrl, 'azure', sent)
  if (!auth) throw await noCredential('Azure DevOps', remoteUrl)
  const ado: Ado = (url, init) => withAzureRetry(remoteUrl, auth, (token) => adoJson(url, token, init))
  // The same call and retry as `ado`, handing back the continuation header too.
  const adoPage: AdoPage = (url) =>
    withAzureRetry(remoteUrl, auth, async (token) => {
      let continuation: string | null = null
      const body = await adoJson<never>(url, token, undefined, (h) => (continuation = h.get('x-ms-continuationtoken')))
      return { body, continuation }
    })
  // Calls that need a scope the token may not have (Work Items, Build) skip the
  // retry: a 401/403 there means "not allowed to read this", not "revoked", and
  // the retry would drop a working git credential from the helper over it.
  const optional: Ado = (url, init) => adoJson(url, auth.token, init)
  const text: AdoText = (url, max) => adoTail(url, auth.token, max)
  // A file's bytes are read with the same token and credential retry as `ado`.
  const bytes: AdoBytes = (url, max) => withAzureRetry(remoteUrl, auth, (token) => adoBytes(url, token, max))
  // The token itself only keys the CI badge cache (by fingerprint); nothing else reads it here.
  return {
    ado,
    adoPage,
    optional,
    text,
    bytes,
    token: auth.token,
    repo: { org: parsed.owner, project: parsed.project, repo: parsed.repo }
  }
}

/**
 * A plain-text Azure DevOps resource (a build log), keeping only its last `max`
 * bytes as it streams in — a pipeline that prints hundreds of megabytes never
 * sits in memory whole. Null when it is refused or answered with a sign-in page.
 */
export async function adoTail(url: string, token: string, max: number): Promise<string | null> {
  const res = await fetch(url, {
    redirect: 'error',
    headers: { Authorization: azureAuth(token), Accept: 'text/plain' }
  }).catch(() => null)
  if (!res || !res.ok || !res.body || (res.headers.get('content-type') ?? '').includes('text/html')) return null
  return readTail(res, max)
}

/** Resolve a Forgejo remote to its instance, owner/repo and token — through
 *  remoteApiToken, so only the profile owning that instance's token is used. */
async function fjRepoOf(
  remoteUrl: string,
  sent: string | undefined
): Promise<{ base: string; owner: string; repo: string; token: string }> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (!parsed || parsed.provider !== 'forgejo' || !parsed.base) throw new Error('Not a Forgejo repository.')
  const auth = await remoteApiToken(remoteUrl, 'forgejo', sent)
  if (!auth) throw await noCredential('Forgejo', remoteUrl)
  return { base: parsed.base, owner: parsed.owner, repo: parsed.repo, token: auth.token }
}

/** A conversation comment on a GitHub issue or PR. */
interface GhIssueComment {
  id: number
  user: GhUser | null
  body: string
  /** Present when asked for with GH_FULL_BODY. */
  body_html?: string
  created_at: string
  updated_at?: string
}

/**
 * Ask GitHub for `body_html` beside `body`: its own rendering, with mentions and
 * references linked, third-party images behind its camo proxy and private
 * attachments signed — none of which a local Markdown render can reproduce. The
 * renderer sanitizes it like any other comment (lib/remoteContent.ts).
 */
const GH_FULL_BODY: RequestInit = { headers: { Accept: 'application/vnd.github.full+json' } }

/** GitHub keeps no "edited" flag: an `updated_at` past `created_at` is the sign. */
export function mapGhIssueComment(c: GhIssueComment): PrComment {
  return {
    author: c.user?.login ?? 'unknown',
    body: c.body,
    ...(c.body_html ? { bodyHtml: c.body_html } : {}),
    createdAt: c.created_at,
    handle: { id: c.id, kind: 'conversation' },
    ...(isEditedAfter(c.created_at, c.updated_at) ? { edited: true } : {})
  }
}

/** An inline review comment on a GitHub PR. */
interface GhReviewComment {
  id: number
  user: GhUser | null
  body: string
  body_html?: string
  created_at: string
  updated_at?: string
  path: string
  line: number | null
  original_line: number | null
  diff_hunk: string
  in_reply_to_id?: number
  /** LEFT (the old file) or RIGHT (the new one), for `line`. */
  side?: 'LEFT' | 'RIGHT' | null
}

async function pullRequestDetail(
  remoteUrl: string,
  tokens: HostTokens,
  number: number
): Promise<PrDetail> {
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return glMergeRequestDetail(remoteUrl, tokens.gitlab, number)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsPullDetail(b.repo, b.token, number)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoPullDetail(f.base, f.owner, f.repo, f.token, number)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azurePrDetail(a.ado, a.repo, number, a.optional)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  const [pr, comments, reviews, reviewComments] = await Promise.all([
    ghJson<{
      number: number
      title: string
      body: string | null
      body_html?: string | null
      user: GhUser
      head: { ref: string; label?: string; repo: { full_name: string } | null }
      base: { ref: string; repo: { full_name: string } | null }
      draft: boolean
      state: string
      merged: boolean
      mergeable: boolean | null
      html_url: string
      created_at: string
      updated_at: string
      closed_at: string | null
      merged_at: string | null
      merged_by: GhUser | null
      assignees?: GhUser[]
      requested_reviewers?: GhUser[]
      requested_teams?: Array<{ slug: string }>
      labels?: Array<{ name: string; color?: string }>
      milestone: { title: string } | null
      additions?: number
      deletions?: number
      changed_files?: number
      commits?: number
    }>(`${api}/pulls/${number}`, token, GH_FULL_BODY),
    // Every page: a long discussion used to stop at its first 100 comments.
    allPages((page) =>
      ghJson<GhIssueComment[]>(
        `${api}/issues/${number}/comments?per_page=100&page=${page}`,
        token,
        GH_FULL_BODY
      )
    ),
    allPages((page) =>
      ghJson<Array<{ user: GhUser | null; state: string }>>(`${api}/pulls/${number}/reviews?per_page=100&page=${page}`, token)
    ),
    allPages((page) =>
      ghJson<GhReviewComment[]>(`${api}/pulls/${number}/comments?per_page=100&page=${page}`, token, GH_FULL_BODY)
    ).catch(() => [] as GhReviewComment[])
  ])

  // Group inline review comments into threads. Replies (in_reply_to_id) attach to
  // their root; roots are keyed by their own id. Ordered by first comment.
  const threadById = new Map<number, PrReviewThread>()
  const sortedRC = [...reviewComments].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const rc of sortedRC) {
    const rootId = rc.in_reply_to_id ?? rc.id
    const comment = {
      id: rc.id,
      author: rc.user?.login ?? 'unknown',
      body: rc.body,
      ...(rc.body_html ? { bodyHtml: rc.body_html } : {}),
      createdAt: rc.created_at,
      handle: { id: rc.id, kind: 'review' as const },
      ...(isEditedAfter(rc.created_at, rc.updated_at) ? { edited: true } : {})
    }
    const existing = threadById.get(rootId)
    if (existing) existing.comments.push(comment)
    else
      threadById.set(rootId, {
        path: rc.path,
        line: rc.line ?? rc.original_line,
        diffHunk: rc.diff_hunk,
        rootId,
        comments: [comment],
        // An outdated comment has no `line` on the current diff — its
        // original_line counts in a commit the Files tab is not showing.
        ...(rc.line != null && rc.side ? { side: rc.side === 'LEFT' ? ('old' as const) : ('new' as const) } : {})
      })
  }
  const reviewThreads = [...threadById.values()]

  // Every user object the API handed back carries its avatar: collect them once
  // so the page can draw a face next to any login without asking again.
  const avatars: Record<string, string> = {}
  const seen = (u: GhUser | null | undefined): void => {
    if (u?.login && u.avatar_url) avatars[u.login] = u.avatar_url
  }
  ;[pr.user, pr.merged_by, ...(pr.assignees ?? []), ...(pr.requested_reviewers ?? [])].forEach(seen)
  comments.forEach((c) => seen(c.user))
  reviews.forEach((r) => seen(r.user))
  reviewComments.forEach((c) => seen(c.user))

  return {
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    closedAt: pr.closed_at,
    mergedAt: pr.merged_at,
    mergedBy: pr.merged_by?.login ?? null,
    assignees: (pr.assignees ?? []).map((u) => ({ login: u.login })),
    requestedReviewers: [
      ...(pr.requested_reviewers ?? []).map((u) => ({ login: u.login })),
      ...(pr.requested_teams ?? []).map((tm) => ({ login: `${owner}/${tm.slug}`, team: true }))
    ],
    labels: (pr.labels ?? []).map((l) => ({ name: l.name, ...(l.color ? { color: l.color } : {}) })),
    milestone: pr.milestone?.title ?? null,
    ...(pr.additions !== undefined ? { additions: pr.additions } : {}),
    ...(pr.deletions !== undefined ? { deletions: pr.deletions } : {}),
    ...(pr.changed_files !== undefined ? { changedFiles: pr.changed_files } : {}),
    ...(pr.commits !== undefined ? { commits: pr.commits } : {}),
    // A fork's head lives in another repository, even once the fork is deleted.
    sourceRepo: githubForkSource(pr.head, pr.base, owner),
    avatars,
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    ...(pr.body_html ? { bodyHtml: pr.body_html } : {}),
    author: pr.user.login,
    source: pr.head.ref,
    target: pr.base.ref,
    draft: pr.draft,
    state: pr.state === 'closed' ? 'closed' : 'open',
    merged: pr.merged,
    mergeable: pr.mergeable,
    url: pr.html_url,
    comments: comments.map(mapGhIssueComment),
    reviews: reviews
      .filter((r) => r.state !== 'PENDING')
      .map((r) => ({ author: r.user?.login ?? 'unknown', state: r.state as PrReview['state'] })),
    reviewThreads
  }
}

/**
 * A check's log, read by the app — Forgejo Actions jobs on the PR's own server.
 * Null when it cannot be read here; the page then offers the browser.
 */
async function pullRequestCheckLog(remoteUrl: string, tokens: HostTokens, url: string): Promise<string | null> {
  if (typeof url !== 'string') return null
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azureBuildLog(a.optional, a.text, a.repo, url)
  }
  // GitHub Actions and GitLab jobs: the link names the job, and the CI runs page's
  // adapter reads its log — only the numeric id travels, never the link itself.
  const provider = parseRemoteUrl(remoteUrl)?.provider
  if (provider === 'github') {
    const job = getGithubActionsJob(url)
    const adapter = job ? await ciRunsAdapterFor(remoteUrl, tokens) : null
    return job && adapter ? adapter.getJobLog(job.runId, job.jobId) : null
  }
  if (provider === 'gitlab') {
    const jobId = getGitlabJobId(url)
    const adapter = jobId ? await ciRunsAdapterFor(remoteUrl, tokens) : null
    return jobId && adapter ? adapter.getJobLog('', jobId) : null
  }
  if (provider !== 'forgejo') return null
  const f = await fjRepoOf(remoteUrl, tokens.forgejo)
  return forgejoJobLog(f.base, f.token, url)
}

/** CI checks on a PR's head commit (GitHub check-runs / GitLab pipeline jobs). */
async function pullRequestChecks(
  remoteUrl: string,
  tokens: HostTokens,
  number: number
): Promise<PrCheck[]> {
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return glMergeRequestChecks(remoteUrl, tokens.gitlab, number)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsPullChecks(b.repo, b.token, number)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoPullChecks(f.base, f.owner, f.repo, f.token, number)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azurePrChecks(a.ado, a.repo, number, a.optional)
  }
  const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
  const pr = await ghJson<{ head: { sha: string } }>(`${api}/pulls/${number}`, token)
  const data = await ghJson<{ check_runs: GhCheckRun[] }>(`${api}/commits/${pr.head.sha}/check-runs?per_page=100`, token).catch(
    () => ({ check_runs: [] as GhCheckRun[] })
  )
  return data.check_runs.map((c) => githubCheckRun({ ...c, head_sha: c.head_sha ?? pr.head.sha }))
}

/**
 * The revision a pull request is at, as its Files tab would read it: head (and
 * merge base) commits, or Azure's last iteration. Null on a host without one.
 */
async function pullRequestRevision(remoteUrl: string, tokens: HostTokens, number: number): Promise<PrDiffRevision | null> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (parsed?.provider === 'gitlab') {
    const { base, auth } = await glProjectOf(remoteUrl, tokens.gitlab)
    const mr = await glJson<{ diff_refs?: { base_sha?: string; head_sha?: string } | null }>(`${base}/merge_requests/${number}`, auth)
    const refs = mr.diff_refs
    return refs?.head_sha ? { headSha: refs.head_sha, ...(refs.base_sha ? { baseSha: refs.base_sha } : {}) } : null
  }
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsPullRevision(b.repo, b.token, number)
  }
  if (parsed?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoPullRevision(f.base, f.owner, f.repo, f.token, number)
  }
  if (parsed?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azurePrRevision(a.ado, a.repo, number)
  }
  if (parsed?.provider !== 'github') return null
  const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
  const pr = await ghJson<{ head?: { sha?: string } }>(`${api}/pulls/${number}`, token)
  return pr.head?.sha ? { headSha: pr.head.sha } : null
}

/**
 * The two commits a pull request's diff compares, as its host names them —
 * one helper for the Files tab and the image preview. A revision already read
 * (pullRequestRevision) is reused instead of asking again:
 * - GitLab (`diff_refs.base_sha`), Forgejo (`merge_base`), Azure
 *   (`commonRefCommit`) name the merge base: `mergeBase`;
 * - Data Center: the changes resource's `fromHash`/`toHash` — the end that is
 *   not the head is the base of the diff its line comments anchor to
 *   (`mergeBase`); without them, the target's tip (`targetTip`);
 * - GitHub names the target's tip only (`base.sha`): `targetTip`, resolved by
 *   resolvePrMergeBase.
 */
async function pullRequestDiffCommits(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  revision?: PrDiffRevision | null
): Promise<PrDiffCommits | null> {
  if (revision?.headSha && revision.baseSha) return { headSha: revision.headSha, baseSha: revision.baseSha, baseKind: 'mergeBase' }
  const parsed = parseRemoteUrl(remoteUrl)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsPullDiffCommits(b.repo, b.token, number)
  }
  if (parsed?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoPullDiffCommits(f.base, f.owner, f.repo, f.token, number)
  }
  if (parsed?.provider === 'github') {
    const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
    const pr = await ghJson<{ head?: { sha?: string }; base?: { sha?: string } }>(`${api}/pulls/${number}`, token)
    return pr.head?.sha ? { headSha: pr.head.sha, baseSha: pr.base?.sha ?? null, baseKind: 'targetTip' } : null
  }
  const rev = revision ?? (await pullRequestRevision(remoteUrl, tokens, number))
  if (!rev?.headSha) return null
  return { headSha: rev.headSha, baseSha: rev.baseSha ?? null, baseKind: rev.baseSha ? 'mergeBase' : 'targetTip' }
}

/**
 * A `targetTip` base turned into the merge base: from this clone when it has
 * both commits (free, exact), else — on GitHub — the compare API's
 * `merge_base_commit`. When neither can say, the tip stays, marked as such
 * (the image preview then notes its "before" is approximate).
 */
async function resolvePrMergeBase(
  repoPath: string | undefined,
  remoteUrl: string,
  tokens: HostTokens,
  commits: PrDiffCommits
): Promise<PrDiffCommits> {
  const tip = commits.baseSha
  if (commits.baseKind === 'mergeBase' || !tip) return commits
  const local = repoPath ? await getLocalMergeBase(repoPath, tip, commits.headSha) : null
  if (local) return { ...commits, baseSha: local, baseKind: 'mergeBase' }
  if (parseRemoteUrl(remoteUrl)?.provider === 'github') {
    const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
    // One commit per page: the merge base is all this needs, not the commit list.
    const cmp = await ghJson<{ merge_base_commit?: { sha?: string } }>(
      `${api}/compare/${tip}...${commits.headSha}?per_page=1&page=1`,
      token
    ).catch(() => null)
    const mergeBase = cmp?.merge_base_commit?.sha
    if (mergeBase) return { ...commits, baseSha: mergeBase, baseKind: 'mergeBase' }
  }
  return commits
}

/**
 * One file's bytes at one commit, from the host — the image preview's fallback
 * when this clone lacks the commit. Only full commit ids, paths that cannot
 * climb out of the repository, and image types we preview reach a URL. The
 * token never leaves main; the renderer gets a data URL, or "too large", or
 * "missing". bitbucket.org has no pull request page, so no reader here.
 */
async function pullRequestFileContent(
  remoteUrl: string,
  tokens: HostTokens,
  sha: unknown,
  path: unknown
): Promise<PrImageContent> {
  if (!isFullCommitSha(sha)) throw new Error('A file is read at a full commit id.')
  if (!isSafeRepoFilePath(path)) throw new Error('Not a file path inside the repository.')
  const mime = getImageMime(path)
  if (!mime) throw new Error('Only image files are read here.')
  const parsed = parseRemoteUrl(remoteUrl)
  if (parsed?.provider === 'gitlab') {
    const { base, auth } = await glProjectOf(remoteUrl, tokens.gitlab)
    // `manual`: an LFS object may sit behind one redirect to object storage, followed without the token.
    return fetchFileBytes(hostFileUrls.gitlabRaw(base, path, sha), { redirect: 'manual', headers: gitlabAuth(auth) }, mime, 'GitLab')
  }
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return fetchFileBytes(
      hostFileUrls.bitbucketServerRaw(bbsRepoApi(b.repo), path, sha),
      { redirect: 'error', headers: { Authorization: `Bearer ${b.token}` } },
      mime,
      'Bitbucket Data Center'
    )
  }
  if (parsed?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return fetchFileBytes(
      hostFileUrls.forgejoMedia(forgejoRepoApi(f.base, f.owner, f.repo), path, sha),
      { redirect: 'manual', headers: { Authorization: `token ${f.token}` } },
      mime,
      'Forgejo'
    )
  }
  if (parsed?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return fetchFileBytes(
      hostFileUrls.azureItem(azureRepoApi(a.repo), path, sha),
      { redirect: 'error', headers: { Authorization: azureAuth(a.token), Accept: 'application/octet-stream' } },
      mime,
      'Azure DevOps'
    )
  }
  if (parsed?.provider === 'github') {
    const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
    return fetchGithubFile(api, token, path, sha, mime)
  }
  throw new Error('This host cannot serve a pull request file here.')
}

/** A fetch mode off the IPC boundary; anything else is `none` — never fetch by surprise. */
function parseFetchMode(value: unknown): PrFetchMode {
  return value === 'once' || value === 'refresh' ? value : 'none'
}

/**
 * The changed files, the revision they were read at, and the two commits
 * they compare.
 *
 * This clone first (prLocalFiles.ts): `git diff` from the merge base to the
 * head is exact and complete on every host, and the line numbers are the ones
 * the host's own diff has — the same two commits — so line comments anchor
 * where they should. Missing commits are fetched by id, as `fetchMode` allows:
 * once per session on the page's first load, again on Refresh, never on the
 * reload after a comment (`onFetching` drives the tab's hint). Only when that
 * fails is the host's API asked, and every file it leaves without a patch says
 * why (`noPatchReason`) and, where it can be read again, from where (`diffSource`).
 *
 * The revision is read before and after the files: when the two differ, a
 * push landed in between and nobody can say which one the diff shows — null
 * then, and a line comment checks the head when it is posted instead.
 */
async function pullRequestFileList(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  fetchMode: PrFetchMode = 'none',
  onFetching?: (fetching: boolean) => void
): Promise<PrFileList> {
  const repoPath = hostingRepo.getStore()
  const revision = (): Promise<PrDiffRevision | null> => pullRequestRevision(remoteUrl, tokens, number).catch(() => null)
  const before = await revision()
  const named = before?.headSha ? await pullRequestDiffCommits(remoteUrl, tokens, number, before).catch(() => null) : null
  // The two commits, here — fetched by id when the mode allows — before the merge base is resolved from them.
  if (named?.baseSha && repoPath) await ensurePrCommits(repoPath, remoteUrl, [named.baseSha, named.headSha], fetchMode, onFetching)
  const commits = named ? await resolvePrMergeBase(repoPath, remoteUrl, tokens, named).catch(() => named) : null
  const local = commits && repoPath ? await readPrFilesFromClone(repoPath, commits) : null
  const source: PrFileDiffSource | null =
    commits?.baseSha ? { remoteUrl, number, baseSha: local?.mergeBase ?? commits.baseSha, headSha: commits.headSha } : null
  let files: PrFile[]
  let truncated = false
  if (local) files = withNoPatchReasons(local.files, 'noChanges', source)
  else {
    const listed = await pullRequestFiles(remoteUrl, tokens, number)
    files = withNoPatchReasons(listed.files, 'hostOmitted', source)
    truncated = listed.truncated
  }
  const after = before ? await revision() : null
  const same = !!before && !!after && isSameRevision(before, after) && (!commits || commits.headSha === after.headSha)
  return { files, revision: same ? after : null, commits, ...(truncated ? { truncated: true } : {}) }
}

/** A PR file request off the IPC boundary, or an error when it is not one. */
function parseFileDiffRequest(value: unknown): PrFileDiffRequest {
  const v = value as { file?: Record<string, unknown>; source?: Record<string, unknown> } | null
  const f = v?.file
  const s = v?.source
  const ok =
    !!f &&
    !!s &&
    typeof f.filename === 'string' &&
    f.filename !== '' &&
    !f.filename.includes('\0') &&
    ['added', 'modified', 'removed', 'renamed', 'copied', 'changed'].includes(f.status as string) &&
    (f.previousFilename === undefined || (typeof f.previousFilename === 'string' && !f.previousFilename.includes('\0'))) &&
    typeof s.remoteUrl === 'string' &&
    Number.isSafeInteger(s.number) &&
    isFullSha(s.baseSha) &&
    isFullSha(s.headSha)
  if (!ok) throw new Error('Refusing that file request.')
  return {
    file: {
      filename: f.filename as string,
      status: f.status as string,
      ...(typeof f.previousFilename === 'string' && f.previousFilename ? { previousFilename: f.previousFilename } : {})
    },
    source: {
      remoteUrl: s.remoteUrl as string,
      number: s.number as number,
      baseSha: s.baseSha as string,
      headSha: s.headSha as string,
      ...(s.straight === true ? { straight: true } : {})
    }
  }
}

/**
 * One pull request file's diff, read on demand: a file the list left
 * `notLoaded`, one that `failed`, one the host's API omitted. This clone first
 * (its commits are fetched by the notice's own button, never here), then, on
 * Azure DevOps, the file's two versions from the API. Always answers with the
 * file and where it was read from (`diffSource`, which the page matches to its
 * revision before it takes the file in); with no patch, its reason says why.
 */
async function pullRequestFileDiff(remoteUrl: string, tokens: HostTokens, request: unknown): Promise<PrFile> {
  const { file, source } = parseFileDiffRequest(request)
  // The request names its pull request; it is read for this one only.
  if (source.remoteUrl !== remoteUrl) throw new Error('Refusing that file request.')
  const repoPath = hostingRepo.getStore()
  const paths = file.previousFilename && file.previousFilename !== file.filename ? [file.filename, file.previousFilename] : [file.filename]
  const ends = { base: source.baseSha, head: source.headSha, straight: !!source.straight }
  const local = repoPath ? await readPrFileFromClone(repoPath, ends, paths) : null
  if (local) return { ...withNoPatchReasons([local], 'noChanges', source)[0], diffSource: source }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    const read = await azureFileDiff(a.bytes, a.repo, file, source.baseSha, source.headSha)
    return { ...withNoPatchReasons([read], 'failed', source)[0], diffSource: source }
  }
  // Other hosts send a PR's diff whole or not at all: without the commits here, nothing more to read.
  return { ...file, additions: 0, deletions: 0, noPatchReason: 'hostOmitted', diffSource: source }
}

/** GitHub's `pulls/{n}/files` lists at most this many (30 pages of 100). */
const GITHUB_PR_FILES_MAX = 3000

/**
 * Changed files in a PR from the host's API (for the file-by-file review
 * checklist), and whether the host stopped short of the whole list.
 */
async function pullRequestFiles(
  remoteUrl: string,
  tokens: HostTokens,
  number: number
): Promise<{ files: PrFile[]; truncated: boolean }> {
  const whole = (files: PrFile[]): { files: PrFile[]; truncated: boolean } => ({ files, truncated: false })
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return whole(await glMergeRequestFiles(remoteUrl, tokens.gitlab, number))
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return whole(await bbsPullFiles(b.repo, b.token, number))
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return whole(await forgejoPullFiles(f.base, f.owner, f.repo, f.token, number))
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azurePrFiles(a.ado, a.bytes, a.repo, number)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  type GhFile = {
    filename: string
    status: string
    additions: number
    deletions: number
    /** Omitted by GitHub for binaries and for very large diffs. */
    patch?: string
    previous_filename?: string
  }
  // per_page above 100 is silently capped: a 150-file PR used to list 100.
  const data = await allPages((page) =>
    ghJson<GhFile[]>(`${api}/pulls/${number}/files?per_page=100&page=${page}`, token)
  ).catch(() => [] as GhFile[])
  const files = data.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    ...(f.patch ? { patch: f.patch } : {}),
    ...(f.previous_filename ? { previousFilename: f.previous_filename } : {})
  }))
  return { files, truncated: files.length >= GITHUB_PR_FILES_MAX }
}

/**
 * bitbucket.org's commits of a pull request. The endpoint has been seen to
 * answer with a redirect to the repository's `/commits` listing; that one is
 * followed only while it stays on the API the credential is for — never with
 * `redirect: 'follow'`, which would carry it wherever the server points.
 * "Chronological" says the reference, without saying which way; the parents
 * settle it. Empty when the source branch is gone (the reference says so).
 */
async function bbCloudPullCommits(owner: string, repo: string, auth: ApiAuth, number: number): Promise<PrCommitList> {
  type BbCommit = {
    hash?: string
    message?: string
    date?: string
    author?: { raw?: string; user?: { display_name?: string; nickname?: string; links?: { avatar?: { href?: string } } } }
    parents?: Array<{ hash?: string }>
  }
  const API = 'https://api.bitbucket.org/'
  const get = async (url: string, hops = 0): Promise<{ values?: BbCommit[]; next?: string }> => {
    const res = await fetch(url, { redirect: 'manual', headers: { Authorization: bitbucketAuthFor(auth), Accept: 'application/json' } })
    if (res.status >= 300 && res.status < 400) {
      const to = res.headers.get('location')
      const next = to ? new URL(to, url).toString() : ''
      if (hops < 2 && next.startsWith(API)) return get(next, hops + 1)
      throw new HttpStatusError(`Bitbucket API error (${res.status})`, res.status)
    }
    if (!res.ok) {
      const e = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new HttpStatusError(e?.error?.message ? `Bitbucket: ${e.error.message}` : `Bitbucket API error (${res.status})`, res.status)
    }
    return (await res.json()) as { values?: BbCommit[]; next?: string }
  }
  const out: BbCommit[] = []
  let url: string | undefined =
    `${API}2.0/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests/${number}/commits?pagelen=50`
  // A `next` off the API is not followed, but it still says the list goes on.
  let more = false
  for (let page = 0; url && page < 6 && out.length <= PR_COMMITS_MAX; page++) {
    const d = await get(url)
    out.push(...(d.values ?? []))
    more = typeof d.next === 'string'
    url = more && d.next!.startsWith(API) ? d.next : undefined
  }
  const raws: RawPrCommit[] = out
    .filter((c) => typeof c.hash === 'string')
    .map((c) => ({
      sha: c.hash!,
      message: c.message,
      // `raw` is "Name <email>"; only the name is shown.
      authorName: c.author?.user?.display_name || c.author?.raw?.replace(/\s*<[^>]*>\s*$/, ''),
      authorLogin: c.author?.user?.nickname,
      authorAvatar: c.author?.user?.links?.avatar?.href,
      authoredAt: c.date,
      parentShas: c.parents ? c.parents.flatMap((p) => (p.hash ? [p.hash] : [])) : null
    }))
  return finishPrCommits(raws, true, more)
}

/**
 * A pull request's commits for its Commits tab, oldest first. Each host is
 * asked once per page, capped at PR_COMMITS_MAX; `truncated` says the host
 * has more. bitbucket.org has no PR page in the app yet — it is served here
 * all the same, like line comments, for when it does.
 */
async function pullRequestCommitList(remoteUrl: string, tokens: HostTokens, number: number): Promise<PrCommitList> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (parsed?.provider === 'gitlab') {
    const { base, auth } = await glProjectOf(remoteUrl, tokens.gitlab)
    type GlCommit = { id?: string; message?: string; author_name?: string; authored_date?: string; parent_ids?: string[] }
    // Three pages of 100 reach past the cap: a list that stops there is told
    // apart from one that goes on.
    const list = await allPages((page) => glJson<GlCommit[]>(`${base}/merge_requests/${number}/commits?per_page=100&page=${page}`, auth), 3)
    return finishPrCommits(
      list
        .filter((c) => typeof c.id === 'string')
        .map((c) => ({
          sha: c.id!,
          message: c.message,
          authorName: c.author_name,
          authoredAt: c.authored_date,
          parentShas: Array.isArray(c.parent_ids) ? c.parent_ids : null
        })),
      // Newest first, as in the reference's example.
      true,
      false
    )
  }
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsPullCommits(b.repo, b.token, number)
  }
  if (parsed?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoPullCommits(f.base, f.owner, f.repo, f.token, number)
  }
  if (parsed?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azurePrCommits(a.adoPage, a.repo, number)
  }
  if (parsed?.provider === 'bitbucket') {
    refuseUnreadableDataCenter(remoteUrl)
    const auth = await tokenForRemote(remoteUrl, 'bitbucket', tokens)
    if (!auth) throw await noCredential('Bitbucket', remoteUrl)
    return bbCloudPullCommits(parsed.owner, parsed.repo, auth, number)
  }
  const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
  type GhCommit = {
    sha?: string
    commit?: { message?: string; author?: { name?: string; date?: string } | null }
    author?: GhUser | null
    parents?: Array<{ sha?: string }>
  }
  // GitHub lists at most 250 commits of a pull request, oldest first: three
  // pages of 100 are all there is. A full 250 may mean more, so only then is
  // the pull request's own count asked — a PR of exactly 250 is not truncated.
  const list = await allPages((page) => ghJson<GhCommit[]>(`${api}/pulls/${number}/commits?per_page=100&page=${page}`, token), 3)
  const more =
    list.length >= PR_COMMITS_MAX &&
    (await ghJson<{ commits?: number }>(`${api}/pulls/${number}`, token).then(
      (pr) => typeof pr.commits !== 'number' || pr.commits > list.length,
      () => true
    ))
  return finishPrCommits(
    list
      .filter((c) => typeof c.sha === 'string')
      .map((c) => ({
        sha: c.sha!,
        message: c.commit?.message,
        authorName: c.commit?.author?.name,
        authorLogin: c.author?.login,
        authorAvatar: c.author?.avatar_url,
        authoredAt: c.commit?.author?.date,
        parentShas: c.parents ? c.parents.flatMap((p) => (p.sha ? [p.sha] : [])) : null
      })),
    false,
    more
  )
}

// ── Pull request updates (the Updates tab) ──────────────────────────────────

/** A full commit id: anything else could name a ref, or read as an option. */
const isFullSha = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(s)

/** How many GitLab diff versions past the MR's current commits are read for their own commits. */
const GITLAB_VERSION_READS = 10

/**
 * The commits of GitLab diff versions already read, by project, MR and version.
 * A version never changes once written, so it is read once a session. Capped.
 */
const glVersionCommits = new Map<string, unknown[]>()
const GITLAB_VERSION_CACHE_MAX = 200

/**
 * GitLab's diff versions — one per push, newest first — give each update's
 * head; the commits come from the MR's commit list, walked from each head.
 * A head that list no longer reaches (rewritten since) is read through its
 * own version, which carries that version's commits, for a few of them.
 * Versions name no pusher.
 */
async function glMergeRequestUpdates(remoteUrl: string, token: string | undefined, number: number): Promise<PrUpdateList> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  type GlVersion = { id?: number; head_commit_sha?: string; base_commit_sha?: string; created_at?: string }
  type GlCommit = { id?: string; message?: string; author_name?: string; authored_date?: string; parent_ids?: string[] }
  const toRaw = (c: GlCommit): RawPrCommit => ({
    sha: c.id!,
    message: c.message,
    authorName: c.author_name,
    authoredAt: c.authored_date,
    parentShas: Array.isArray(c.parent_ids) ? c.parent_ids : null
  })
  // Three pages of 100 each, as the Commits tab reads: a full third page is read as more.
  const [versions, commits] = await Promise.all([
    allPages((page) => glJson<GlVersion[]>(`${base}/merge_requests/${number}/versions?per_page=100&page=${page}`, auth), 3),
    allPages((page) => glJson<GlCommit[]>(`${base}/merge_requests/${number}/commits?per_page=100&page=${page}`, auth), 3)
  ])
  const graph = new Map<string, RawPrCommit>()
  for (const c of commits) if (typeof c.id === 'string') graph.set(c.id, toRaw(c))
  const heads = versions
    .filter((v): v is GlVersion & { id: number; head_commit_sha: string } => typeof v.id === 'number' && typeof v.head_commit_sha === 'string')
    .sort((a, b) => a.id - b.id)
  const missing = heads.filter((v) => !graph.has(v.head_commit_sha)).slice(-GITLAB_VERSION_READS)
  await Promise.all(
    missing.map(async (v) => {
      const key = `${base}|${number}|${v.id}`
      let list = glVersionCommits.get(key) as GlCommit[] | undefined
      if (!list) {
        const detail = await glJson<{ commits?: GlCommit[] }>(`${base}/merge_requests/${number}/versions/${v.id}`, auth).catch(() => null)
        if (detail) {
          list = detail.commits ?? []
          if (glVersionCommits.size >= GITLAB_VERSION_CACHE_MAX) glVersionCommits.delete(glVersionCommits.keys().next().value!)
          glVersionCommits.set(key, list)
        }
      }
      for (const c of list ?? []) if (typeof c.id === 'string' && !graph.has(c.id)) graph.set(c.id, toRaw(c))
    })
  )
  // Newest first: three full pages kept the latest 300 and lost the opening.
  const startCut = versions.length >= 300
  const drafts = groupUpdatesByHeads(
    heads.map((v) => ({
      id: String(v.id),
      createdAt: v.created_at ?? '',
      headSha: v.head_commit_sha,
      // The first version listed is compared with its merge base only when it is the opening.
      ...(v.base_commit_sha && !startCut ? { baseSha: v.base_commit_sha } : {})
    })),
    graph
  )
  const done = finishPrUpdates(drafts, startCut)
  return { updates: done.updates, truncated: done.truncated || commits.length >= 300, grouping: 'native', startCut }
}

/** How many pages of 100 timeline items GitHub is asked for. */
const GITHUB_TIMELINE_PAGES = 5

/**
 * GitHub has no record of a plain push, so updates are rebuilt from the pull
 * request's timeline: its commits and its force pushes (GraphQL — the REST
 * timeline's commits carry no date of their own beyond the commit's, and its
 * force pushes no before/after heads). See groupGithubTimeline for how.
 */
async function ghPullRequestUpdates(remoteUrl: string, tokens: HostTokens, number: number): Promise<PrUpdateList> {
  const { owner, repo, token, ep } = await ghRepoOf(remoteUrl, tokens.github)
  const post = createGithubGraphqlPost(ep.graphqlUrl, token)
  type Node =
    | { __typename: 'PullRequestCommit'; commit?: GhGqlCommit | null }
    | {
        __typename: 'HeadRefForcePushedEvent'
        createdAt?: string
        actor?: { login?: string } | null
        beforeCommit?: { oid?: string } | null
        afterCommit?: { oid?: string } | null
      }
  type GhGqlCommit = {
    oid?: string
    message?: string
    committedDate?: string
    authoredDate?: string
    parents?: { nodes?: Array<{ oid?: string }> } | null
    author?: { name?: string; user?: { login?: string; avatarUrl?: string } | null } | null
  }
  type Answer = {
    repository?: {
      pullRequest?: {
        createdAt?: string
        author?: { login?: string } | null
        timelineItems?: { pageInfo?: { hasPreviousPage?: boolean; startCursor?: string | null }; nodes?: Node[] }
      } | null
    } | null
  }
  const query = `query($owner: String!, $repo: String!, $number: Int!, $before: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      createdAt
      author { login }
      timelineItems(last: 100, before: $before, itemTypes: [PULL_REQUEST_COMMIT, HEAD_REF_FORCE_PUSHED_EVENT]) {
        pageInfo { hasPreviousPage startCursor }
        nodes {
          __typename
          ... on PullRequestCommit {
            commit {
              oid message committedDate authoredDate
              parents(first: 2) { nodes { oid } }
              author { name user { login avatarUrl } }
            }
          }
          ... on HeadRefForcePushedEvent {
            createdAt
            actor { login }
            beforeCommit { oid }
            afterCommit { oid }
          }
        }
      }
    }
  }
}`
  // Read from the newest end, a page of 100 at a time: past the cap, the
  // latest pushes are what matter — the opening is what goes.
  const pages: GithubTimelineItem[][] = []
  let opened = { at: '' } as { at: string; author?: string }
  let before: string | null = null
  let more = false
  for (let page = 0; page < GITHUB_TIMELINE_PAGES; page++) {
    const items: GithubTimelineItem[] = []
    pages.unshift(items)
    const data: Answer = await post<Answer>(query, { owner, repo, number, before })
    const pr = data.repository?.pullRequest
    if (!pr) throw new HttpStatusError(`GitHub: pull request ${number} not found.`, 404)
    if (page === 0) opened = { at: pr.createdAt ?? '', ...(pr.author?.login ? { author: pr.author.login } : {}) }
    for (const n of pr.timelineItems?.nodes ?? []) {
      if (n.__typename === 'PullRequestCommit') {
        const c = n.commit
        if (!c?.oid) continue
        items.push({
          type: 'commit',
          committedAt: c.committedDate ?? '',
          commit: {
            sha: c.oid,
            message: c.message,
            authorName: c.author?.name,
            authorLogin: c.author?.user?.login,
            authorAvatar: c.author?.user?.avatarUrl,
            authoredAt: c.authoredDate,
            parentShas: c.parents?.nodes ? c.parents.nodes.flatMap((p) => (p.oid ? [p.oid] : [])) : null
          }
        })
      } else if (n.__typename === 'HeadRefForcePushedEvent') {
        items.push({
          type: 'forcePush',
          at: n.createdAt ?? '',
          ...(n.actor?.login ? { actor: n.actor.login } : {}),
          ...(n.beforeCommit?.oid ? { beforeSha: n.beforeCommit.oid } : {}),
          ...(n.afterCommit?.oid ? { afterSha: n.afterCommit.oid } : {})
        })
      }
    }
    const info = pr.timelineItems?.pageInfo
    more = !!info?.hasPreviousPage && !!info.startCursor
    if (!more) break
    before = info!.startCursor!
  }
  const done = finishPrUpdates(groupGithubTimeline(pages.flat(), opened, more), more)
  return { updates: done.updates, truncated: done.truncated, grouping: 'approximate', startCut: more }
}

/**
 * A pull request's updates — its pushes — for the Updates tab, oldest first.
 * Each host reads its own record of them (see the per-host functions);
 * bitbucket.org has no PR page in the app, and answers "unsupported".
 */
async function pullRequestUpdateList(remoteUrl: string, tokens: HostTokens, number: number): Promise<PrUpdateList> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (parsed?.provider === 'gitlab') return glMergeRequestUpdates(remoteUrl, tokens.gitlab, number)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsPullUpdates(b.repo, b.token, number)
  }
  if (parsed?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoPullUpdates(f.base, f.owner, f.repo, f.token, number)
  }
  if (parsed?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azurePrUpdates(a.ado, a.repo, number)
  }
  if (parsed?.provider === 'github') return ghPullRequestUpdates(remoteUrl, tokens, number)
  return { updates: [], truncated: false, grouping: 'unsupported' }
}

/** One end of an update's comparison, as the renderer sent it — checked before it reaches a URL. */
function validUpdateEnd(end: unknown): PrUpdateEnd {
  const e = end as { sha?: unknown; iteration?: unknown } | null
  if (!e || !isFullSha(e.sha)) throw new Error('An update is compared by its full commit id.')
  const iteration = typeof e.iteration === 'number' && Number.isSafeInteger(e.iteration) && e.iteration >= 0 ? e.iteration : undefined
  return { sha: e.sha, ...(iteration !== undefined ? { iteration } : {}) }
}

/**
 * The changes one update made — `from`'s tree against `to`'s — from the host,
 * for when this clone lacks either commit (the renderer diffs locally when it
 * has both). Null when the host has no way to say: Forgejo's API has no
 * two-commit diff, and bitbucket.org no PR page; the tab offers to fetch the
 * branch instead. GitHub's and Data Center's compares diff from the merge base
 * of the two (`fromMergeBase`): after a rewrite, what the push removed is not
 * shown — the renderer fetches both heads and diffs locally first, and says so
 * when it could not.
 */
async function pullRequestUpdateFiles(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  fromEnd: unknown,
  toEnd: unknown
): Promise<PrUpdateFiles | null> {
  const from = validUpdateEnd(fromEnd)
  const to = validUpdateEnd(toEnd)
  const res = await getHostUpdateFiles(remoteUrl, tokens, number, from, to)
  if (!res) return null
  // A file the host left out can be read again between the same two commits —
  // only when the list itself is between them, not from their merge base.
  const source = res.fromMergeBase ? null : { remoteUrl, number, baseSha: from.sha, headSha: to.sha, straight: true }
  return { ...res, files: withNoPatchReasons(res.files, 'hostOmitted', source) }
}

async function getHostUpdateFiles(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  from: PrUpdateEnd,
  to: PrUpdateEnd
): Promise<PrUpdateFiles | null> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (parsed?.provider === 'gitlab') {
    const { base, auth } = await glProjectOf(remoteUrl, tokens.gitlab)
    // `straight`: the two trees, from..to — not from the merge base, which after a rebase is elsewhere.
    const res = await glJson<{ diffs?: GlDiff[] }>(`${base}/repository/compare?from=${from.sha}&to=${to.sha}&straight=true`, auth)
    return { files: (res?.diffs ?? []).map(glDiffToFile), fromMergeBase: false }
  }
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return { files: await bbsCompareFiles(b.repo, b.token, from.sha, to.sha), fromMergeBase: true }
  }
  if (parsed?.provider === 'azure') {
    if (from.iteration === undefined || to.iteration === undefined) return null
    const a = await azRepoOf(remoteUrl, tokens.azure)
    const files = await azurePrIterationFiles(
      a.ado,
      a.bytes,
      a.repo,
      number,
      { iteration: from.iteration, sha: from.sha },
      { iteration: to.iteration, sha: to.sha }
    )
    return { files, fromMergeBase: false }
  }
  if (parsed?.provider === 'github') {
    const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
    type GhFile = { filename: string; status: string; additions: number; deletions: number; patch?: string; previous_filename?: string }
    // The file list comes whole (up to 300 files) with the first page; one commit per page keeps the rest small.
    const res = await ghJson<{ files?: GhFile[] }>(`${api}/compare/${from.sha}...${to.sha}?per_page=1&page=1`, token)
    const files = (res.files ?? []).map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      ...(f.patch ? { patch: f.patch } : {}),
      ...(f.previous_filename ? { previousFilename: f.previous_filename } : {})
    }))
    return { files, fromMergeBase: true }
  }
  return null
}

/** Reply to an inline review thread (POST a comment in reply to `inReplyTo`). */
async function replyReviewComment(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  inReplyTo: number | string,
  body: string
): Promise<void> {
  // GitHub threads reply to a numeric comment id; GitLab to a discussion id string.
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    // The page hides the reply box for Forgejo; this guards any other caller.
    throw new Error('Forgejo has no API to reply inside a line thread — reply on the host.')
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azureReply(a.ado, a.repo, number, Number(inReplyTo), body)
  }
  if (isBbs(remoteUrl)) {
    // A thread's root comment id: the reply nests under it, as the web UI does.
    const b = await bbsRepoOf(remoteUrl)
    return bbsComment(b.repo, b.token, number, body, Number(inReplyTo))
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') {
    return glReplyReviewComment(remoteUrl, tokens.gitlab, number, String(inReplyTo), body)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  await ghJson(`${api}/pulls/${number}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({ body, in_reply_to: inReplyTo })
  })
}

/**
 * GitHub: reply in a review thread whose first comment was deleted. REST
 * replies name the root comment, which is gone; GraphQL replies name the
 * thread. The thread is found through a comment still in it — its REST
 * `node_id` is the GraphQL comment id. Any failure is thrown: the page then
 * offers the host's own page instead. `pending`: GitHub filed the reply under
 * the viewer's pending review, unseen until that review is submitted.
 */
async function replyReviewThread(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  commentId: number,
  body: string
): Promise<{ pending: boolean }> {
  if (!Number.isSafeInteger(commentId) || commentId <= 0) throw new Error('Not a review comment id.')
  if (typeof body !== 'string' || !body.trim()) throw new Error('An empty reply.')
  const { owner, repo, token, ep, api } = await ghRepoOf(remoteUrl, tokens.github)
  const comment = await ghJson<{ node_id?: string }>(`${api}/pulls/comments/${commentId}`, token)
  if (!comment.node_id) throw new Error('GitHub did not name the comment.')
  const post = createGithubGraphqlPost(ep.graphqlUrl, token)
  const thread = await findReviewThread(post, owner, repo, number, comment.node_id)
  if (!thread) throw new Error('GitHub did not find the review thread.')
  if (!thread.viewerCanReply) throw new Error('GitHub does not let this account reply in this thread.')
  return addReviewThreadReply(post, thread.id, body)
}

/**
 * Why a line comment failed, in words the renderer recognises
 * (lib/gitErrorHint.ts): `refused` when the host turned the account down,
 * `outsideDiff` when it would not anchor a comment to that line — which is what
 * a 422 (GitHub), a 400 (GitLab, Forgejo, Bitbucket) or a 409 (Data Center)
 * means here, since everything else in the request is the app's own. The
 * host's words follow, for the toast's details. Anything else passes unchanged.
 */
export function lineCommentFailure(err: unknown): unknown {
  const status = err && typeof err === 'object' && 'status' in err ? Number((err as { status: unknown }).status) : NaN
  // A spent rate limit is a 403 too, and it says when to try again: kept as it is.
  if (err && typeof err === 'object' && (err as { rateLimited?: unknown }).rateLimited === true) return err
  const words = err instanceof Error ? err.message : String(err)
  if (status === 401 || status === 403) return new HttpStatusError(`Line comment [refused]: ${words}`, status)
  if (status === 400 || status === 409 || status === 422) return new HttpStatusError(`Line comment [outsideDiff]: ${words}`, status)
  return err
}

/** bitbucket.org: an inline comment, `to` a line of the new file or `from` one of the old. */
async function bbCloudCommentOnLine(
  owner: string,
  repo: string,
  auth: ApiAuth,
  number: number,
  anchor: PrLineAnchor,
  body: string
): Promise<void> {
  const res = await fetch(
    `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests/${number}/comments`,
    {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: bitbucketAuthFor(auth), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { raw: body },
        inline: { path: anchor.path, [getAnchorSide(anchor) === 'old' ? 'from' : 'to']: getAnchorLine(anchor) }
      })
    }
  )
  if (!res.ok) {
    const e = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new HttpStatusError(e?.error?.message ? `Bitbucket: ${e.error.message}` : `Bitbucket API error (${res.status})`, res.status)
  }
}

/** GitLab: a new discussion positioned on the line, against the MR's current diff refs. */
async function glCommentOnLine(
  remoteUrl: string,
  token: string | undefined,
  number: number,
  anchor: PrLineAnchor,
  body: string,
  read: PrDiffRevision | null
): Promise<void> {
  const { base, auth } = await glProjectOf(remoteUrl, token)
  const mrUrl = `${base}/merge_requests/${number}`
  const mr = await glJson<{ diff_refs?: { base_sha?: string; head_sha?: string; start_sha?: string } | null }>(mrUrl, auth)
  const refs = mr.diff_refs
  if (!refs?.base_sha || !refs.head_sha || !refs.start_sha) {
    throw new Error('GitLab did not say which commits this merge request compares — refresh it and try again.')
  }
  // The position names today's refs: they must be the ones the diff was read at.
  if (read && !isSameRevision(read, { headSha: refs.head_sha, baseSha: refs.base_sha })) throw new Error(LINE_COMMENT_STALE)
  // An added line has only new_line, a removed one only old_line, and an
  // unchanged line both — GitLab rejects a context line given just one.
  const lines = {
    ...(anchor.kind !== 'del' ? { new_line: anchor.newLine } : {}),
    ...(anchor.kind !== 'add' ? { old_line: anchor.oldLine } : {})
  }
  await glJson(`${mrUrl}/discussions`, auth, {
    method: 'POST',
    body: JSON.stringify({
      body,
      position: {
        position_type: 'text',
        base_sha: refs.base_sha,
        start_sha: refs.start_sha,
        head_sha: refs.head_sha,
        old_path: anchor.oldPath ?? anchor.path,
        new_path: anchor.path,
        ...lines
      }
    })
  })
}

/**
 * Start a review thread on one line of a pull request's diff, posted at once
 * (no pending review). Each host anchors it its own way; the anchor is the
 * same everywhere — a deleted line is the old side, the rest the new.
 */
async function commentOnPrLine(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  anchor: unknown,
  body: unknown,
  read: PrDiffRevision | null = null
): Promise<void> {
  if (!isValidLineAnchor(anchor)) throw new Error('A line comment needs a file and a line of its diff.')
  if (typeof body !== 'string' || !body.trim()) throw new Error('A line comment needs some text.')
  const text = body.trim()
  try {
    if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return await glCommentOnLine(remoteUrl, tokens.gitlab, number, anchor, text, read)
    // Data Center and Forgejo anchor to the PR as it is now: refused when that is
    // no longer the revision the line was read at.
    const refuseMoved = async (): Promise<void> => {
      const now = read ? await pullRequestRevision(remoteUrl, tokens, number) : null
      if (read && now && !isSameRevision(read, now)) throw new Error(LINE_COMMENT_STALE)
    }
    if (isBbs(remoteUrl)) {
      const b = await bbsRepoOf(remoteUrl)
      await refuseMoved()
      return await bbsCommentOnLine(b.repo, b.token, number, anchor, text)
    }
    const parsed = parseRemoteUrl(remoteUrl)
    if (parsed?.provider === 'forgejo') {
      const f = await fjRepoOf(remoteUrl, tokens.forgejo)
      await refuseMoved()
      return await forgejoCommentOnLine(f.base, f.owner, f.repo, f.token, number, anchor, text, read)
    }
    if (parsed?.provider === 'azure') {
      const a = await azRepoOf(remoteUrl, tokens.azure)
      return await azureCommentOnLine(a.ado, a.repo, number, anchor, text, read)
    }
    if (parsed?.provider === 'bitbucket') {
      refuseUnreadableDataCenter(remoteUrl)
      const auth = await tokenForRemote(remoteUrl, 'bitbucket', tokens)
      if (!auth) throw await noCredential('Bitbucket', remoteUrl)
      return await bbCloudCommentOnLine(parsed.owner, parsed.repo, auth, number, anchor, text)
    }
    const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
    // The comment names the commit its line was read at, so GitHub places it in
    // that version — and marks it outdated if the line has changed since. Only
    // when the diff's commit is unknown is the head asked for now.
    const commitId = read?.headSha ?? (await ghJson<{ head: { sha: string } }>(`${api}/pulls/${number}`, token)).head.sha
    await ghJson(`${api}/pulls/${number}/comments`, token, {
      method: 'POST',
      body: JSON.stringify({
        body: text,
        commit_id: commitId,
        path: anchor.path,
        line: getAnchorLine(anchor),
        side: getAnchorSide(anchor) === 'old' ? 'LEFT' : 'RIGHT'
      })
    })
  } catch (err) {
    throw lineCommentFailure(err)
  }
}

/**
 * Why an edit or a delete of a comment failed, in words the renderer
 * recognises (lib/gitErrorHint.ts): `refused` for a 401 (the account turned
 * down; on Data Center, also "not allowed"), `notAllowed` for a 403 (not yours,
 * or no permission), `gone` for a 404 (deleted meanwhile), `changed` for a 409
 * (edited meanwhile: Data Center's version check). A Data Center delete's 409
 * may also mean the comment has replies, which that server will not delete:
 * `conflict` says both. The host's words follow, for the toast's details.
 */
export function commentChangeFailure(err: unknown, opts: { deleting: boolean; dataCenter: boolean }): unknown {
  const status = err && typeof err === 'object' && 'status' in err ? Number((err as { status: unknown }).status) : NaN
  // A spent rate limit is a 403 too, and it says when to try again: kept as it is.
  if (err && typeof err === 'object' && (err as { rateLimited?: unknown }).rateLimited === true) return err
  const words = err instanceof Error ? err.message : String(err)
  const tag =
    status === 401
      ? 'refused'
      : status === 403
        ? 'notAllowed'
        : status === 404
          ? 'gone'
          : status === 409
            ? opts.deleting && opts.dataCenter
              ? 'conflict'
              : 'changed'
            : null
  return tag ? new HttpStatusError(`Comment change [${tag}]: ${words}`, status) : err
}

/** bitbucket.org: PUT or DELETE one pull request comment. */
async function bbCloudChangeComment(
  owner: string,
  repo: string,
  auth: ApiAuth,
  number: number,
  handle: PrCommentHandle,
  body: string | null
): Promise<void> {
  const res = await fetch(
    `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests/${number}/comments/${handle.id}`,
    {
      method: body === null ? 'DELETE' : 'PUT',
      redirect: 'error',
      headers: { Authorization: bitbucketAuthFor(auth), ...(body === null ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === null ? {} : { body: JSON.stringify({ content: { raw: body } }) })
    }
  )
  if (!res.ok) {
    const e = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new HttpStatusError(e?.error?.message ? `Bitbucket: ${e.error.message}` : `Bitbucket API error (${res.status})`, res.status)
  }
}

/**
 * Edit (`body` set) or delete (`body` null) one comment of a pull request,
 * reached through the handle its host's mapper gave it. The host decides who
 * may: this only routes the call, and names the refusal (commentChangeFailure).
 */
async function changePrComment(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  handle: unknown,
  body: string | null
): Promise<void> {
  if (!Number.isInteger(number) || number <= 0) throw new Error('A pull request number is a positive integer.')
  if (!isValidCommentHandle(handle)) throw new Error('This comment cannot be changed from here.')
  const dataCenter = isBbs(remoteUrl)
  try {
    const parsed = parseRemoteUrl(remoteUrl)
    if (parsed?.provider === 'gitlab') {
      // Conversation and review notes alike: the notes endpoint takes either.
      const { base, auth } = await glProjectOf(remoteUrl, tokens.gitlab)
      const url = `${base}/merge_requests/${number}/notes/${handle.id}`
      await glJson(url, auth, body === null ? { method: 'DELETE' } : { method: 'PUT', body: JSON.stringify({ body }) })
      return
    }
    if (dataCenter) {
      const b = await bbsRepoOf(remoteUrl)
      return body === null
        ? await bbsDeleteComment(b.repo, b.token, number, handle)
        : await bbsEditComment(b.repo, b.token, number, handle, body)
    }
    if (parsed?.provider === 'forgejo') {
      const f = await fjRepoOf(remoteUrl, tokens.forgejo)
      return body === null
        ? await forgejoDeleteComment(f.base, f.owner, f.repo, f.token, handle)
        : await forgejoEditComment(f.base, f.owner, f.repo, f.token, handle, body)
    }
    if (parsed?.provider === 'azure') {
      // `optional`: a 403 here means "not your comment", not a revoked
      // credential, and must not evict a working one from the helper.
      const a = await azRepoOf(remoteUrl, tokens.azure)
      return body === null
        ? await azureDeleteComment(a.optional, a.repo, number, handle)
        : await azureEditComment(a.optional, a.repo, number, handle, body)
    }
    if (parsed?.provider === 'bitbucket') {
      refuseUnreadableDataCenter(remoteUrl)
      const auth = await tokenForRemote(remoteUrl, 'bitbucket', tokens)
      if (!auth) throw await noCredential('Bitbucket', remoteUrl)
      return await bbCloudChangeComment(parsed.owner, parsed.repo, auth, number, handle, body)
    }
    const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
    // Conversation comments belong to the issue side of the API, review comments to the pull side.
    const url = `${api}/${handle.kind === 'review' ? 'pulls' : 'issues'}/comments/${handle.id}`
    await ghSend(url, token, body === null ? { method: 'DELETE' } : { method: 'PATCH', body: JSON.stringify({ body }) })
  } catch (err) {
    throw commentChangeFailure(err, { deleting: body === null, dataCenter })
  }
}

async function editPrComment(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  handle: unknown,
  body: unknown
): Promise<void> {
  if (typeof body !== 'string' || !body.trim()) throw new Error('An edited comment needs some text.')
  // Only the blank lines around it go: indented code and a trailing two-space break are Markdown.
  return changePrComment(remoteUrl, tokens, number, handle, stripOuterNewlines(body))
}

async function deletePrComment(remoteUrl: string, tokens: HostTokens, number: number, handle: unknown): Promise<void> {
  return changePrComment(remoteUrl, tokens, number, handle, null)
}

/**
 * Who this repository's calls sign in as, for the PR and issue pages' "your
 * comment". Never fails the page: null when the token cannot say.
 */
/** Who the page's viewer is, as `PrDetail.viewer*` carries it. */
export interface PageViewer {
  viewer: string | null
  viewerId: string | null
  viewerUniqueName: string | null
  viewerById: boolean
}

const NO_VIEWER: PageViewer = { viewer: null, viewerId: null, viewerUniqueName: null, viewerById: false }

/**
 * A detail read with its viewer. Both settle before the call answers: a failed
 * read must not leave the viewer's request running past it, under a profile
 * scope already left. Exported for tests.
 */
export async function withViewer<T extends object>(remoteUrl: string, tokens: HostTokens, read: Promise<T>): Promise<T & PageViewer> {
  const [detail, viewer] = await Promise.allSettled([read, viewerOf(remoteUrl, tokens)])
  if (detail.status === 'rejected') throw detail.reason
  return { ...detail.value, ...(viewer.status === 'fulfilled' ? viewer.value : NO_VIEWER) }
}

/**
 * Who this repository's calls sign in as, for the PR and issue pages' "your
 * comment". Azure DevOps and bitbucket.org name authors by display name, which
 * two people can share: there "yours" is matched on the account id only
 * (`viewerById`). Never fails the page: nobody, when the token cannot say.
 */
async function viewerOf(remoteUrl: string, tokens: HostTokens): Promise<PageViewer> {
  try {
    const parsed = parseRemoteUrl(remoteUrl)
    if (!parsed) return NO_VIEWER
    const viewerById = parsed.provider === 'azure' || (parsed.provider === 'bitbucket' && !parsed.base)
    const auth = await tokenForRemote(remoteUrl, parsed.provider, tokens)
    const me = auth ? await myAccount(parsed, auth.token, auth) : null
    return { viewer: me?.login ?? null, viewerId: me?.id ?? null, viewerUniqueName: me?.uniqueName ?? null, viewerById }
  } catch {
    return NO_VIEWER
  }
}

async function commentOnPr(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  body: string
): Promise<void> {
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return glCommentOnMr(remoteUrl, tokens.gitlab, number, body)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsComment(b.repo, b.token, number, body)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoComment(f.base, f.owner, f.repo, f.token, number, body)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azureComment(a.ado, a.repo, number, body)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  await ghJson(`${api}/issues/${number}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({ body })
  })
}

async function reviewPr(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  event: PrReviewEvent,
  body: string
): Promise<void> {
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return glReviewMr(remoteUrl, tokens.gitlab, number, event, body)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsReview(b.repo, b.token, number, event, body)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoReview(f.base, f.owner, f.repo, f.token, number, event, body)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azureReview(a.ado, a.repo, number, event, body)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  await ghJson(`${api}/pulls/${number}/reviews`, token, {
    method: 'POST',
    body: JSON.stringify({ event, body: body || undefined })
  })
}

async function mergePr(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  method: PrMergeMethod
): Promise<void> {
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return glMergeMr(remoteUrl, tokens.gitlab, number, method)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsMerge(b.repo, b.token, number, method)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoMerge(f.base, f.owner, f.repo, f.token, number, method)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azureMerge(a.ado, a.repo, number, method)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  await ghJson(`${api}/pulls/${number}/merge`, token, {
    method: 'PUT',
    body: JSON.stringify({ merge_method: method })
  })
}

/**
 * Closes a pull request without merging it, or reopens a closed one. Nothing
 * else changes: the branch, its commits and the conversation stay, so a close
 * is undone by a reopen. The host refuses it for someone without the right
 * (not the author nor a maintainer) and its words reach the user.
 */
async function setPullRequestState(
  remoteUrl: string,
  tokens: HostTokens,
  number: number,
  state: 'open' | 'closed'
): Promise<void> {
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return glSetMrState(remoteUrl, tokens.gitlab, number, state)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsSetPullState(b.repo, b.token, number, state)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoSetPullState(f.base, f.owner, f.repo, f.token, number, state)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azureSetPullState(a.ado, a.repo, number, state)
  }
  const { token, api } = await ghRepoOf(remoteUrl, tokens.github)
  await ghJson(`${api}/pulls/${number}`, token, { method: 'PATCH', body: JSON.stringify({ state }) })
}

const CONVERT_TO_DRAFT = `mutation($id:ID!){ convertPullRequestToDraft(input:{pullRequestId:$id}){ pullRequest{ isDraft } } }`
const MARK_READY = `mutation($id:ID!){ markPullRequestReadyForReview(input:{pullRequestId:$id}){ pullRequest{ isDraft } } }`

/**
 * Moves a pull request back to draft — not ready, reviewers not asked yet —
 * or marks a draft ready for review. Reversible either way, like a close.
 * GitHub's REST API cannot flip it, so this one goes through GraphQL.
 */
async function setPullRequestDraft(remoteUrl: string, tokens: HostTokens, number: number, draft: boolean): Promise<void> {
  if (parseRemoteUrl(remoteUrl)?.provider === 'gitlab') return glSetMrDraft(remoteUrl, tokens.gitlab, number, draft)
  if (isBbs(remoteUrl)) {
    const b = await bbsRepoOf(remoteUrl)
    return bbsSetPullDraft(b.repo, b.token, number, draft)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'forgejo') {
    const f = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoSetPullDraft(f.base, f.owner, f.repo, f.token, number, draft)
  }
  if (parseRemoteUrl(remoteUrl)?.provider === 'azure') {
    const a = await azRepoOf(remoteUrl, tokens.azure)
    return azureSetPullDraft(a.ado, a.repo, number, draft)
  }
  const { token, ep, api } = await ghRepoOf(remoteUrl, tokens.github)
  const pr = await ghJson<{ node_id?: string }>(`${api}/pulls/${number}`, token)
  if (!pr.node_id) throw new Error('GitHub did not name the pull request.')
  const post = createGithubGraphqlPost(ep.graphqlUrl, token)
  await post(draft ? CONVERT_TO_DRAFT : MARK_READY, { id: pr.node_id })
}

async function listIssues(
  remoteUrl: string,
  tokens: { github?: string }
): Promise<{ provider: HostingProvider; issues: IssueInfo[] }> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (parsed?.provider === 'forgejo') {
    const f = await forgejoRemote(remoteUrl)
    return { provider: 'forgejo', issues: f ? await listForgejoIssues(f.base, f.owner, f.repo, f.token) : [] }
  }
  if (!parsed || parsed.provider !== 'github') return { provider: parsed?.provider ?? null, issues: [] }
  const auth = await remoteApiToken(remoteUrl, 'github', tokens.github)
  if (!auth) return { provider: 'github', issues: [] }
  const data = await ghJson<
    Array<{
      number: number
      title: string
      user: { login: string } | null
      state: string
      html_url: string
      comments: number
      pull_request?: unknown
    }>
  >(`${ghEndpointsOf(parsed).apiBase}/repos/${parsed.owner}/${parsed.repo}/issues?state=open&per_page=50`, auth.token)
  return {
    provider: 'github',
    // The issues endpoint also returns PRs — filter them out.
    issues: data
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        author: i.user?.login ?? 'unknown',
        state: i.state === 'closed' ? 'closed' : 'open',
        url: i.html_url,
        comments: i.comments
      }))
  }
}

async function listMilestones(
  remoteUrl: string,
  tokens: { github?: string }
): Promise<{ provider: HostingProvider; milestones: MilestoneInfo[] }> {
  const parsed = parseRemoteUrl(remoteUrl)
  if (parsed?.provider === 'forgejo') {
    const f = await forgejoRemote(remoteUrl)
    return { provider: 'forgejo', milestones: f ? await listForgejoMilestones(f.base, f.owner, f.repo, f.token) : [] }
  }
  if (!parsed || parsed.provider !== 'github') return { provider: parsed?.provider ?? null, milestones: [] }
  const auth = await remoteApiToken(remoteUrl, 'github', tokens.github)
  if (!auth) return { provider: 'github', milestones: [] }
  const data = await ghJson<
    Array<{
      number: number
      title: string
      description: string | null
      state: string
      due_on: string | null
      open_issues: number
      closed_issues: number
      html_url: string
    }>
  >(`${ghEndpointsOf(parsed).apiBase}/repos/${parsed.owner}/${parsed.repo}/milestones?state=all&per_page=50`, auth.token)
  return {
    provider: 'github',
    milestones: data.map((m) => ({
      number: m.number,
      title: m.title,
      description: m.description ?? '',
      state: m.state === 'closed' ? 'closed' : 'open',
      dueOn: m.due_on,
      openIssues: m.open_issues,
      closedIssues: m.closed_issues,
      url: m.html_url
    }))
  }
}

/**
 * Projects v2 custom fields for an issue (Priority, Start/Target date, Effort, …).
 * GraphQL-only and requires the token's `read:project` scope — best-effort, so any
 * error (missing scope, no project) yields an empty list rather than failing.
 */
async function fetchProjectFields(
  graphqlUrl: string,
  owner: string,
  repo: string,
  number: number,
  token: string
): Promise<ProjectFieldGroup[]> {
  const query = `query($owner:String!,$repo:String!,$number:Int!){
    repository(owner:$owner,name:$repo){
      issue(number:$number){
        projectItems(first:10){ nodes{
          project{ title }
          fieldValues(first:30){ nodes{
            __typename
            ... on ProjectV2ItemFieldTextValue { text field{ ... on ProjectV2FieldCommon { name } } }
            ... on ProjectV2ItemFieldNumberValue { number field{ ... on ProjectV2FieldCommon { name } } }
            ... on ProjectV2ItemFieldDateValue { date field{ ... on ProjectV2FieldCommon { name } } }
            ... on ProjectV2ItemFieldSingleSelectValue { name field{ ... on ProjectV2FieldCommon { name } } }
            ... on ProjectV2ItemFieldIterationValue { title field{ ... on ProjectV2FieldCommon { name } } }
          } }
        } }
      }
    }
  }`
  try {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { owner, repo, number } })
    })
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: {
        repository?: {
          issue?: {
            projectItems?: {
              nodes?: Array<{
                project?: { title?: string }
                fieldValues?: {
                  nodes?: Array<Record<string, unknown> & { field?: { name?: string } }>
                }
              }>
            }
          }
        }
      }
    }
    const items = json.data?.repository?.issue?.projectItems?.nodes ?? []
    const groups: ProjectFieldGroup[] = []
    for (const item of items) {
      const fields: { name: string; value: string }[] = []
      for (const fv of item.fieldValues?.nodes ?? []) {
        const name = fv.field?.name
        if (!name) continue // skip non-custom values (no field name)
        const value =
          (fv.text as string) ??
          (fv.name as string) ??
          (fv.title as string) ??
          (fv.date as string) ??
          (typeof fv.number === 'number' ? String(fv.number) : undefined)
        if (value != null && value !== '') fields.push({ name, value })
      }
      if (fields.length) groups.push({ project: item.project?.title ?? 'Project', fields })
    }
    return groups
  } catch {
    return []
  }
}

/**
 * The pull requests that close an issue. The timeline's `cross-referenced` events
 * this replaces listed every PR that merely *mentioned* the issue — "see #12",
 * a revert, a fork's PR — had no merged state, stopped at one page, and keyed by
 * number so two repos' #7 collided. `closedByPullRequestsReferences` is GitHub's
 * own "Development" list: closing keywords plus manual links, nothing else.
 * `includeClosedPrs` is needed to keep merged ones, which are what closed a closed issue.
 */
export const GH_CLOSING_PRS_QUERY = `query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    issue(number:$number){
      closedByPullRequestsReferences(first:50,includeClosedPrs:true){
        nodes{ number title url state merged isDraft repository{ nameWithOwner } }
      }
    }
  }
}`

const PR_STATE_ORDER: Record<LinkedPr['state'], number> = { open: 0, merged: 1, closed: 2 }

/**
 * Parse a `GH_CLOSING_PRS_QUERY` response. Pure, and deliberately forgiving: a
 * missing scope, a rate limit or a schema surprise must cost the section, never
 * the issue page, so anything unexpected is `unavailable` rather than a throw.
 */
export function parseClosingPrs(
  json: unknown,
  owner: string,
  repo: string
): { prs: LinkedPr[]; status: Exclude<LinkedPrsStatus, 'unsupported'> } {
  const unavailable = { prs: [], status: 'unavailable' as const }
  if (!json || typeof json !== 'object') return unavailable
  const body = json as {
    data?: { repository?: { issue?: { closedByPullRequestsReferences?: { nodes?: unknown } | null } | null } | null } | null
  }
  // GraphQL can answer 200 with `errors` and partial data — trust the connection if it
  // came back, otherwise the errors (INSUFFICIENT_SCOPES, NOT_FOUND, …) explain why not.
  const conn = body.data?.repository?.issue?.closedByPullRequestsReferences
  if (!conn || !Array.isArray(conn.nodes)) return unavailable
  const here = `${owner}/${repo}`.toLowerCase()
  const seen = new Set<string>()
  const prs: LinkedPr[] = []
  for (const raw of conn.nodes as unknown[]) {
    if (!raw || typeof raw !== 'object') continue
    const n = raw as {
      number?: unknown
      title?: unknown
      url?: unknown
      state?: unknown
      merged?: unknown
      isDraft?: unknown
      repository?: { nameWithOwner?: unknown } | null
    }
    if (typeof n.number !== 'number' || typeof n.url !== 'string' || seen.has(n.url)) continue
    seen.add(n.url)
    const prRepo = typeof n.repository?.nameWithOwner === 'string' ? n.repository.nameWithOwner : here
    prs.push({
      number: n.number,
      title: typeof n.title === 'string' ? n.title : '',
      url: n.url,
      state: n.merged === true || n.state === 'MERGED' ? 'merged' : n.state === 'OPEN' ? 'open' : 'closed',
      draft: n.isDraft === true,
      repo: prRepo,
      otherRepo: prRepo.toLowerCase() !== here
    })
  }
  // Open first: that is the work still in flight. Array.sort is stable, so GitHub's order holds within a state.
  prs.sort((a, b) => PR_STATE_ORDER[a.state] - PR_STATE_ORDER[b.state])
  return { prs, status: 'ok' }
}

async function fetchClosingPrs(
  graphqlUrl: string,
  owner: string,
  repo: string,
  number: number,
  token: string
): Promise<{ prs: LinkedPr[]; status: Exclude<LinkedPrsStatus, 'unsupported'> }> {
  try {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: GH_CLOSING_PRS_QUERY, variables: { owner, repo, number } })
    })
    if (!res.ok) return { prs: [], status: 'unavailable' }
    return parseClosingPrs(await res.json(), owner, repo)
  } catch {
    return { prs: [], status: 'unavailable' }
  }
}

/**
 * Titles for the references in a repository's commit and comment text, routed
 * to the host the remote is on, as the profile the repository is bound to. A
 * host with no API for it (Bitbucket), no credential, or a refusal answers
 * every reference "unavailable" — the hover card says so; nothing is thrown.
 */
async function referenceSummaries(
  remoteUrl: string,
  tokens: HostTokens,
  queries: ReferenceQuery[]
): Promise<ReferenceSummary[]> {
  if (!queries.length) return []
  try {
    const provider = parseRemoteUrl(remoteUrl)?.provider
    if (provider === 'azure') {
      // A plain read (`optional`): Work Items is a scope a code token may lack.
      const a = await azRepoOf(remoteUrl, tokens.azure)
      return await azureReferenceSummaries(a.optional, a.repo.org, queries)
    }
    if (provider === 'github') {
      const { owner, repo, token, ep, api } = await ghRepoOf(remoteUrl, tokens.github)
      // GraphQL reads a page of references in one request; REST is the fallback.
      const graphql = { post: createGithubGraphqlRawPost(ep.graphqlUrl, token), owner, repo }
      return await githubReferenceSummaries((url) => ghJson(url, token), api, queries, graphql)
    }
    if (provider === 'gitlab') {
      const { base, auth } = await glProjectOf(remoteUrl, tokens.gitlab)
      return await gitlabReferenceSummaries((url) => glJson(url, auth), base, queries)
    }
    if (provider === 'forgejo') {
      const f = await fjRepoOf(remoteUrl, tokens.forgejo)
      const api = `${f.base}/api/v1/repos/${encodeURIComponent(f.owner)}/${encodeURIComponent(f.repo)}`
      return await forgejoReferenceSummaries((url) => fjJson(url, f.token), api, queries)
    }
  } catch {
    /* no credential, or the host not reached: every card says it could not be read */
  }
  return queries.map((q) => unavailableReference(q, 'unreachable'))
}

async function issueDetail(
  remoteUrl: string,
  tokens: { github?: string },
  number: number
): Promise<IssueDetail> {
  if (isForgejo(remoteUrl)) {
    const f = await forgejoRemoteOrThrow(remoteUrl)
    return forgejoIssueDetail(f.base, f.owner, f.repo, f.token, number)
  }
  const { owner, repo, token, api, ep } = await ghRepoOf(remoteUrl, tokens.github)
  const [issue, comments, closing, projectFields] = await Promise.all([
    ghJson<{
      number: number
      title: string
      body: string | null
      body_html?: string | null
      user: { login: string } | null
      state: string
      html_url: string
      created_at: string
      labels: Array<{ name: string } | string>
      assignees: Array<{ login: string }> | null
      milestone: { title: string } | null
    }>(`${api}/issues/${number}`, token, GH_FULL_BODY),
    ghJson<GhIssueComment[]>(
      `${api}/issues/${number}/comments?per_page=100`,
      token,
      GH_FULL_BODY
    ),
    fetchClosingPrs(ep.graphqlUrl, owner, repo, number, token),
    fetchProjectFields(ep.graphqlUrl, owner, repo, number, token)
  ])

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? '',
    ...(issue.body_html ? { bodyHtml: issue.body_html } : {}),
    author: issue.user?.login ?? 'unknown',
    state: issue.state === 'closed' ? 'closed' : 'open',
    url: issue.html_url,
    labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name)),
    assignees: (issue.assignees ?? []).map((a) => a.login),
    milestone: issue.milestone?.title ?? null,
    createdAt: issue.created_at,
    comments: comments.map(mapGhIssueComment),
    linkedPrs: closing.prs,
    linkedPrsStatus: closing.status,
    projectFields
  }
}

/** Issues belonging to a milestone (open + closed). GitHub and Forgejo. */
async function milestoneIssues(
  remoteUrl: string,
  tokens: { github?: string },
  number: number
): Promise<IssueInfo[]> {
  if (isForgejo(remoteUrl)) {
    const f = await forgejoRemoteOrThrow(remoteUrl)
    return forgejoMilestoneIssues(f.base, f.owner, f.repo, f.token, number)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  const data = await ghJson<
    Array<{
      number: number
      title: string
      user: { login: string } | null
      state: string
      html_url: string
      comments: number
      pull_request?: unknown
    }>
  >(`${api}/issues?milestone=${number}&state=all&per_page=100`, token)
  return data
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      author: i.user?.login ?? 'unknown',
      state: i.state === 'closed' ? 'closed' : 'open',
      url: i.html_url,
      comments: i.comments
    }))
}

async function setIssueState(
  remoteUrl: string,
  tokens: { github?: string },
  number: number,
  state: 'open' | 'closed'
): Promise<void> {
  if (isForgejo(remoteUrl)) {
    const f = await forgejoRemoteOrThrow(remoteUrl)
    return setForgejoIssueState(f.base, f.owner, f.repo, f.token, number, state)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  await ghJson(`${api}/issues/${number}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ state })
  })
}

/** Create a new issue on GitHub or Forgejo. Returns its number + web URL. */
async function createIssue(
  remoteUrl: string,
  tokens: { github?: string },
  opts: { title: string; body?: string }
): Promise<{ number: number; url: string }> {
  if (isForgejo(remoteUrl)) {
    const f = await forgejoRemoteOrThrow(remoteUrl)
    return createForgejoIssue(f.base, f.owner, f.repo, f.token, opts)
  }
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  const d = await ghJson<{ number: number; html_url: string }>(
    `${api}/issues`,
    token,
    { method: 'POST', body: JSON.stringify({ title: opts.title, body: opts.body || '' }) }
  )
  return { number: d.number, url: d.html_url }
}

/**
 * Which of these head branches have a MERGED pull request (GitHub only)?
 * This is how squash-merged stack bottoms get detected: the squashed patch
 * leaves no ancestry a local git can follow, but the host knows the PR landed.
 * One request per branch, filtered server-side by head ref.
 */
async function mergedPrHeads(remoteUrl: string, tokens: { github?: string }, branches: string[]): Promise<string[]> {
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  const merged: string[] = []
  for (const branch of branches) {
    const prs = await ghJson<Array<{ merged_at: string | null }>>(
      `${api}/pulls?state=closed&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=5`,
      token
    ).catch(() => [])
    if (prs.some((p) => p.merged_at)) merged.push(branch)
  }
  return merged
}

/**
 * Mutate an open PR (GitHub only): retarget its base, retitle, or maintain the
 * marked stack-navigation section in its body. `stackSection` merges into the
 * live body server-side (one GET) so a user's own description edits survive.
 */
async function updatePullRequest(
  remoteUrl: string,
  tokens: { github?: string },
  number: number,
  patch: { base?: string; title?: string; stackSection?: string }
): Promise<void> {
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)
  const body: { base?: string; title?: string; body?: string } = {}
  if (patch.base) body.base = patch.base
  if (patch.title) body.title = patch.title
  if (patch.stackSection !== undefined) {
    const current = await ghJson<{ body: string | null }>(`${api}/pulls/${number}`, token)
    body.body = mergeStackSection(current.body ?? '', patch.stackSection)
  }
  if (!Object.keys(body).length) return
  await ghJson(`${api}/pulls/${number}`, token, { method: 'PATCH', body: JSON.stringify(body) })
}

/**
 * Register the chain as a **native GitHub stack**, and report what it is now.
 *
 * Chaining the bases is what makes a stack reviewable anywhere — GitLab,
 * Bitbucket and Azure have nothing else. GitHub, since its stacked pull
 * requests preview, also has a stack of its own: a real object that draws the
 * chain in the PR UI, rebases the levels above server-side, and lands the whole
 * thing from one merge. That is worth having, and it is one call on top of the
 * PRs we already opened.
 *
 * `numbers` arrive bottom → top, the order the API wants. A repository that is
 * not in the preview answers 404/403 for the endpoint; that is not a failure of
 * the submit, so it returns null and the chained PRs stand on their own.
 */
async function ensureGithubStack(
  remoteUrl: string,
  tokens: { github?: string },
  numbers: number[]
): Promise<GithubStackInfo | null> {
  if (numbers.length < 2) return null // one PR is not a stack
  const { owner, repo, token, api } = await ghRepoOf(remoteUrl, tokens.github)

  // Whatever stack these PRs are already in, if any: the bottom one decides,
  // because a stack is extended upward.
  const bottom = await ghJson<{ stack: { number: number } | null }>(`${api}/pulls/${numbers[0]}`, token).catch(
    () => null
  )
  // The field is absent entirely on a server without the feature — treat that
  // the same as "no stack" and let the POST below decide.
  const existing = bottom?.stack?.number ?? null

  try {
    if (existing === null) {
      const created = await ghJson<{ number: number; html_url?: string }>(`${api}/stacks`, token, {
        method: 'POST',
        body: JSON.stringify({ pull_requests: numbers })
      })
      return { number: created.number, url: created.html_url, added: numbers.length }
    }
    // Extend: only the levels the stack does not already carry, still bottom → top.
    const current = await ghJson<{ pull_requests?: { number: number }[] }>(`${api}/stacks/${existing}`, token)
    const have = new Set((current.pull_requests ?? []).map((p) => p.number))
    const missing = numbers.filter((n) => !have.has(n))
    if (missing.length) {
      await ghJson(`${api}/stacks/${existing}/add`, token, {
        method: 'POST',
        body: JSON.stringify({ pull_requests: missing })
      })
    }
    return { number: existing, added: missing.length }
  } catch {
    // Not enrolled in the preview, or the token cannot manage stacks. The PRs
    // are already chained and navigable; say nothing rather than fail the run.
    return null
  }
}

/** Browsing and creating repositories is Bitbucket Cloud's only; a Data Center token never goes to bitbucket.org. */
export const BBS_NO_BROWSE = 'Browsing and creating repositories is not supported for Bitbucket Data Center yet — clone by URL instead.'

async function listRepositories(
  provider: RepoHost,
  token: string,
  org?: string,
  profileId?: string
): Promise<RemoteRepo[]> {
  const auth = await tokenForProvider(provider, token, org, profileId)
  if (!auth) throw await noCredential(provider, await providerBase(provider, org, profileId))

  if (provider === 'github') {
    const res = await fetch(
      `${githubEndpoints(auth.base).apiBase}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
      { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${auth.token}` } }
    )
    if (!res.ok) throw new Error(`GitHub API error (${res.status})`)
    const data = (await res.json()) as Array<{
      full_name: string
      clone_url: string
      private: boolean
      description: string | null
      owner: { avatar_url: string } | null
    }>
    return data.map((r) => ({
      name: r.full_name,
      url: r.clone_url,
      private: r.private,
      description: r.description ?? undefined,
      avatarUrl: r.owner?.avatar_url
    }))
  }

  if (provider === 'gitlab') {
    const res = await fetch(
      `${glApi(auth.base)}/projects?membership=true&per_page=100&order_by=last_activity_at&simple=true`,
      { redirect: 'error', headers: gitlabAuth(auth) }
    )
    if (!res.ok) throw new Error(`GitLab API error (${res.status})`)
    const data = (await res.json()) as Array<{
      path_with_namespace: string
      http_url_to_repo: string
      visibility: string
      description: string | null
      avatar_url: string | null
      namespace?: { avatar_url: string | null }
    }>
    return data.map((r) => ({
      name: r.path_with_namespace,
      url: r.http_url_to_repo,
      private: r.visibility !== 'public',
      description: r.description ?? undefined,
      avatarUrl: r.avatar_url ?? r.namespace?.avatar_url ?? undefined
    }))
  }

  if (provider === 'forgejo') return listForgejoRepos(auth.base, auth.token)

  if (provider === 'bitbucket') {
    if (auth.base !== BITBUCKET_CLOUD) throw new Error(BBS_NO_BROWSE)
    const res = await fetch('https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100&sort=-updated_on', {
      headers: { Authorization: bitbucketAuthFor(auth) }
    })
    if (!res.ok) throw new Error(`Bitbucket API error (${res.status})`)
    const data = (await res.json()) as {
      values: Array<{
        full_name: string
        is_private: boolean
        description: string
        links: { clone: Array<{ name: string; href: string }>; avatar?: { href: string } }
      }>
    }
    return data.values.map((r) => ({
      name: r.full_name,
      url: r.links.clone.find((c) => c.name === 'https')?.href ?? r.links.clone[0]?.href ?? '',
      private: r.is_private,
      description: r.description || undefined,
      avatarUrl: r.links.avatar?.href
    }))
  }

  // Azure DevOps — lists every repo across all projects in the organization.
  if (!org?.trim()) throw new Error('Enter your Azure DevOps organization.')
  const base = providerBaseUrl('azure', org)
  const data = await withAzureRetry(base, auth, (t) =>
    adoJson<{ value: Array<{ name: string; remoteUrl: string; project: { name: string } }> }>(
      `${base}/_apis/git/repositories?api-version=7.1`,
      t
    )
  )
  return data.value.map((r) => ({ name: `${r.project.name}/${r.name}`, url: r.remoteUrl }))
}

async function ghJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string>)
    }
  })
  if (!res.ok) throw await ghError(res)
  return res.json() as Promise<T>
}

/** GitHub's refusal as an Error: its own message, or when the rate limit resets. */
async function ghError(res: Response): Promise<Error> {
  const msg = (await res.json().catch(() => null)) as { message?: string } | null
  // Surface when the rate limit resets so the user knows how long to wait.
  // A spent primary limit says `remaining: 0`; a secondary one says only `retry-after`.
  const throttled =
    (res.status === 403 || res.status === 429) &&
    (res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after'))
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    const reset = res.headers.get('x-ratelimit-reset')
    if (remaining === '0' && reset) {
      const at = new Date(+reset * 1000).toLocaleTimeString()
      return new HttpStatusError(`GitHub rate limit exceeded — resets at ${at}.`, res.status, true)
    }
  }
  return new HttpStatusError(
    msg?.message ? `GitHub: ${msg.message}` : `GitHub API error (${res.status})`,
    res.status,
    throttled
  )
}

/** Accounts a new repo can be created under: the authenticated user plus their orgs/groups. */
async function listOwners(provider: RepoHost, token: string, org?: string, profileId?: string): Promise<RemoteOwner[]> {
  const auth = await tokenForProvider(provider, token, org, profileId)
  if (!auth) throw await noCredential(provider, await providerBase(provider, org, profileId))

  if (provider === 'github') {
    const api = githubEndpoints(auth.base).apiBase
    const user = await ghJson<{ login: string; avatar_url: string }>(`${api}/user`, auth.token)
    const orgs = await ghJson<Array<{ login: string; avatar_url: string }>>(
      `${api}/user/orgs?per_page=100`,
      auth.token
    )
    return [
      { id: user.login, login: user.login, avatarUrl: user.avatar_url, type: 'user' },
      ...orgs.map((o) => ({ id: o.login, login: o.login, avatarUrl: o.avatar_url, type: 'org' as const }))
    ]
  }

  if (provider === 'gitlab') {
    // glJson checks the status: a revoked token used to come back as a 401 body
    // and fail later as "groups.map is not a function".
    const user = await glJson<{ id: number; username: string; avatar_url: string | null; namespace_id?: number }>(
      `${glApi(auth.base)}/user`,
      auth
    )
    const groups = await glJson<Array<{ id: number; full_path: string; avatar_url: string | null }>>(
      `${glApi(auth.base)}/groups?min_access_level=30&per_page=100`,
      auth
    )
    return [
      { id: String(user.id), login: user.username, avatarUrl: user.avatar_url ?? undefined, type: 'user' },
      ...groups.map((g) => ({
        id: String(g.id),
        login: g.full_path,
        avatarUrl: g.avatar_url ?? undefined,
        type: 'org' as const
      }))
    ]
  }

  if (provider === 'forgejo') return listForgejoOwners(auth.base, auth.token)

  if (provider === 'bitbucket') {
    if (auth.base !== BITBUCKET_CLOUD) throw new Error(BBS_NO_BROWSE)
    const wsRes = await fetch('https://api.bitbucket.org/2.0/workspaces?pagelen=100', {
      headers: { Authorization: bitbucketAuthFor(auth) }
    })
    if (!wsRes.ok) throw new Error(`Bitbucket API error (${wsRes.status})`)
    const data = (await wsRes.json()) as {
      values: Array<{ slug: string; name: string; links?: { avatar?: { href: string } } }>
    }
    return data.values.map((w) => ({
      id: w.slug,
      login: w.slug,
      avatarUrl: w.links?.avatar?.href,
      type: 'org' as const
    }))
  }

  // Azure DevOps — projects under the given organization act as "owners" for new repos.
  if (!org?.trim()) throw new Error('Enter your Azure DevOps organization.')
  const base = providerBaseUrl('azure', org)
  const data = await withAzureRetry(base, auth, (t) =>
    adoJson<{ value: Array<{ id: string; name: string }> }>(`${base}/_apis/projects?api-version=7.1`, t)
  )
  return data.value.map((p) => ({ id: p.id, login: p.name, type: 'org' as const }))
}

/** Build a human-readable message for Azure DevOps auth failures, which are otherwise opaque. */
function azureAuthError(status: number, org?: string): string {
  if (status === 401 || status === 403) {
    return org
      ? `Azure DevOps rejected the credential (${status}). Check that it is valid and not expired, that it has access to the "${org}" organization, and that the organization name is spelled correctly.`
      : `Azure DevOps rejected the credential (${status}). Check that it is valid, not expired, and has at least User Profile (read) or Code (read) scope — or set an organization so it can be checked against that org directly.`
  }
  if (status === 404 && org) {
    return `Azure DevOps organization "${org}" was not found (404). Double-check the organization name.`
  }
  return `Azure DevOps API error (${status})`
}

/**
 * Settings → Integrations' check of a token: the account, or why there is none —
 * a refusal, a server that could not be reached, or anything else — as a typed
 * result. Electron hands a thrown error to the renderer as its message alone,
 * which would leave the renderer guessing from English.
 */
async function checkToken(
  provider: RepoHost,
  token: string,
  org?: string,
  interactive = false,
  link?: AccountLink,
  issuer?: string
): Promise<TokenCheckResult> {
  try {
    return { ok: true, account: await fetchConnectedAccount(provider, token, org, interactive, link, issuer) }
  } catch (err) {
    const failure = tokenCheckFailure(err)
    // The message goes to the renderer and on screen: a token undici echoed back
    // (an invalid header value names it) must not be in it.
    const secret = token?.trim()
    return { ok: false, failure: secret ? { ...failure, message: failure.message.split(secret).join('•••') } : failure }
  }
}

/** Resolve the authenticated user behind a stored token, for display in Settings → Integrations. */
async function fetchConnectedAccount(
  provider: RepoHost,
  token: string,
  org?: string,
  interactive = false,
  link?: AccountLink,
  issuer?: string
): Promise<ConnectedAccount | null> {
  // Nothing on this profile and no sign-in asked for: simply not connected. A
  // login elsewhere on the machine is not this profile's until it is linked.
  if (!token.trim() && !link && !interactive) return null
  const unsaved = unsavedServerBase(provider, org, token)
  if (unsaved) {
    // Exactly the token this call carries — never one looked up — see unsavedServerBase.
    // Main cannot tell a token just typed from a saved one the renderer holds
    // and sent here, so one the app already has is not sent to a new host.
    if (await isHeldSecret(token)) throw new Error(HELD_TOKEN_TO_UNSAVED_SERVER)
    if (provider === 'bitbucket') {
      return { source: 'token', ...(await describeBbsAccount(unsaved, token.trim()).catch(atServer(unsaved))) }
    }
    return describeAccount(provider, { token: token.trim(), source: 'token' }, unsaved).catch(atServer(unsaved))
  }
  // Only an explicit "sign in" may open the helper's login window. Merely opening
  // the Settings page must not prompt for four providers at once.
  // GitLab: the instance of the profile being edited, which the renderer sends as `org`.
  const base = provider === 'gitlab' || provider === 'forgejo' ? providerBaseUrl(provider, org) : await providerBase(provider, org)
  // Links name github.com accounts: an Enterprise Server is only ever asked with its own token.
  if (provider === 'github' && base !== GITHUB_COM) {
    if (!token.trim()) return null
    link = undefined
    interactive = false
  }
  // A Data Center likewise: its own token, sent only to the base it was saved under.
  if (provider === 'bitbucket' && base !== BITBUCKET_CLOUD) {
    if (!token.trim()) return null
    return { source: 'token', ...(await describeBbsAccount(base, token.trim()).catch(atServer(base))) }
  }
  if ((provider === 'gitlab' || provider === 'forgejo') && token && !tokenMatchesInstance(provider, base, issuer)) return null
  const auth = await apiToken(base, { token, link }, { interactive })
  if (!auth) throw await noCredential(provider, base)
  const account = await describeAccount(
    provider,
    auth,
    provider === 'gitlab' || provider === 'forgejo' || provider === 'github' ? base : org
  ).catch(atServer(base))
  if (link || auth.source === 'token') return account
  // A sign-in found a machine login: hand back the link for the profile to keep.
  // gh is asked by account name, which is the GitHub login; git by the username
  // the helper filed the credential under.
  const login = auth.source === 'gh' ? account.login : auth.login || account.login
  // A helper's username is whatever it filed; one that could not be asked for
  // again safely is not linked (the account still shows, so the PAT route is open).
  const found = validAccountLink({ source: auth.source, login })
  return found ? { ...account, link: found } : account
}

/**
 * The name of another profile that already holds the account a sign-in found —
 * by its link, or by the account its own PAT signs in as — else null. Run here,
 * not in the renderer, because only the main process can read every profile's
 * token. A token that no longer resolves holds nobody.
 */
async function accountOwner(
  provider: RepoHost,
  login: string,
  found: AccountLink,
  exceptProfileId: string
): Promise<string | null> {
  // Accounts are per instance: the same username on two Forgejo servers is two
  // different people. GitLab's sign-in only ever links a gitlab.com account
  // (servers use their own tokens), so its profiles are compared on gitlab.com.
  const instance = provider === 'forgejo' ? await profileForgejoInstance(exceptProfileId) : undefined
  const others = (await allProfileAuth(provider)).filter(
    (p) => p.id !== exceptProfileId && (instance === undefined || profileForgejoBase(p.forgejoUrl) === instance)
  )
  const linked = others.find((p) => linkHoldsAccount(p.link, login, found))
  if (linked) return linked.name
  for (const p of others) {
    if (!p.token) continue
    // GitLab: gitlab.com explicitly — allProfileAuth hands out gitlab.com's tokens only.
    const org =
      provider === 'azure'
        ? p.azureOrg
        : provider === 'gitlab'
          ? GITLAB_COM
          : provider === 'forgejo'
            ? (profileForgejoBase(p.forgejoUrl) ?? undefined)
            : undefined
    if (provider === 'forgejo' && !org) continue
    if (provider === 'azure' && !org) continue
    const account = await describeAccount(provider, { token: p.token, source: 'token' }, org).catch(() => null)
    if (account && account.login.toLowerCase() === login.toLowerCase()) return p.name
  }
  return null
}

/** The account behind a resolved credential, for Settings → Integrations. */
async function describeAccount(provider: RepoHost, auth: ApiAuth, org?: string): Promise<ConnectedAccount> {

  if (provider === 'github') {
    // `org` is the server's base here — github.com or a GHES (fetchConnectedAccount).
    const ep = githubEndpoints(org)
    const user = await ghJson<{ id: number; login: string; name: string | null; avatar_url: string; html_url: string }>(
      `${ep.apiBase}/user`,
      auth.token
    )
    const orgs = await ghJson<Array<{ login: string; avatar_url: string }>>(
      `${ep.apiBase}/user/orgs?per_page=100`,
      auth.token
    ).catch(() => [])
    return {
      source: auth.source,
      login: user.login,
      name: user.name ?? undefined,
      avatarUrl: user.avatar_url,
      // The users.noreply.github.com address is github.com's: a GHES has its own, if any.
      noreplyEmail: ep.enterprise ? undefined : (noreplyEmail('github', user.id, user.login) ?? undefined),
      profileUrl: user.html_url,
      orgs: orgs.map((o) => ({ login: o.login, avatarUrl: o.avatar_url, url: `${ep.webBase}/${o.login}` }))
    }
  }

  if (provider === 'gitlab') {
    const headers = gitlabAuth(auth)
    // `org` is already a resolved base (fetchConnectedAccount, accountOwner): resolving it
    // again would refuse a server that is being checked before it is saved.
    const api = glApi(org)
    const userRes = await fetch(`${api}/user`, { headers, redirect: 'error' })
    if (!userRes.ok) throw new HttpStatusError(`GitLab API error (${userRes.status})`, userRes.status)
    const user = (await userRes.json()) as {
      id: number
      username: string
      name: string | null
      avatar_url: string | null
      web_url: string
    }
    const groupsRes = await fetch(`${api}/groups?min_access_level=10&per_page=100`, { headers, redirect: 'error' })
    const groups = groupsRes.ok
      ? ((await groupsRes.json()) as Array<{ full_path: string; avatar_url: string | null; web_url: string }>)
      : []
    return {
      source: auth.source,
      login: user.username,
      name: user.name ?? undefined,
      avatarUrl: user.avatar_url ?? undefined,
      noreplyEmail: noreplyEmail('gitlab', user.id, user.username) ?? undefined,
      profileUrl: user.web_url,
      orgs: groups.map((g) => ({ login: g.full_path, avatarUrl: g.avatar_url ?? undefined, url: g.web_url }))
    }
  }

  if (provider === 'forgejo') {
    return { source: auth.source, ...(await describeForgejoAccount(await providerBase(provider, org), auth.token)) }
  }

  if (provider === 'bitbucket') {
    const bbAuth = bitbucketAuthFor(auth)
    const userRes = await fetch('https://api.bitbucket.org/2.0/user', { headers: { Authorization: bbAuth } })
    if (!userRes.ok) throw new HttpStatusError(`Bitbucket API error (${userRes.status})`, userRes.status)
    const user = (await userRes.json()) as {
      username: string
      display_name: string | null
      links?: { avatar?: { href: string }; html?: { href: string } }
    }
    const wsRes = await fetch('https://api.bitbucket.org/2.0/workspaces?pagelen=100', {
      headers: { Authorization: bbAuth }
    })
    const workspaces = wsRes.ok
      ? (
          (await wsRes.json()) as {
            values: Array<{ slug: string; name: string; links?: { avatar?: { href: string }; html?: { href: string } } }>
          }
        ).values
      : []
    return {
      source: auth.source,
      login: user.username,
      name: user.display_name ?? undefined,
      avatarUrl: user.links?.avatar?.href,
      profileUrl: user.links?.html?.href,
      orgs: workspaces.map((w) => ({
        login: w.slug,
        avatarUrl: w.links?.avatar?.href,
        url: w.links?.html?.href ?? `https://bitbucket.org/${w.slug}`
      }))
    }
  }

  // Azure DevOps — prefer an organization-scoped check. The global profile service
  // (app.vssps.visualstudio.com) returns 401 for Entra/guest accounts even with a valid
  // org-scoped PAT, so when we know the organization we validate against connectionData,
  // which works with a plain Code-scoped PAT and reflects the token's real access.
  const orgName = org?.trim()
  if (orgName) {
    const base = providerBaseUrl('azure', orgName)
    const data = await withAzureRetry(base, auth, (t) =>
      adoJson<{
        authenticatedUser?: {
          providerDisplayName?: string
          properties?: { Account?: { $value?: string } }
        }
      }>(`${base}/_apis/connectionData?api-version=7.1-preview`, t)
    ).catch((err) => {
      throw err instanceof AzureAuthError ? new HttpStatusError(azureAuthError(err.status, orgName), err.status) : err
    })
    const user = data.authenticatedUser
    const email = user?.properties?.Account?.$value
    const displayName = user?.providerDisplayName
    return {
      source: auth.source,
      login: email ?? displayName ?? orgName,
      name: displayName,
      orgs: [{ login: orgName, url: `https://dev.azure.com/${encodeURIComponent(orgName)}` }]
    }
  }

  // No organization provided — fall back to the global profile service (best effort).
  const profile = await adoJson<{ displayName: string; emailAddress?: string; id: string }>(
    'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
    auth.token
  ).catch((err) => {
    throw err instanceof AzureAuthError ? new HttpStatusError(azureAuthError(err.status), err.status) : err
  })
  return {
    source: auth.source,
    login: profile.emailAddress ?? profile.displayName,
    name: profile.displayName
  }
}

/** Create a new repository on the host and return its clone URL. */
async function createRepository(
  provider: RepoHost,
  token: string,
  opts: CreateRepoOpts,
  org?: string,
  profileId?: string
): Promise<RemoteRepo> {
  if (!opts.name.trim()) throw new Error('Repository name is required.')
  const auth = await tokenForProvider(provider, token, org, profileId)
  if (!auth) throw await noCredential(provider, await providerBase(provider, org, profileId))

  if (provider === 'github') {
    const url =
      opts.ownerType === 'org'
        ? `${githubEndpoints(auth.base).apiBase}/orgs/${encodeURIComponent(opts.owner)}/repos`
        : `${githubEndpoints(auth.base).apiBase}/user/repos`
    const repo = await ghJson<{ full_name: string; clone_url: string; private: boolean }>(url, auth.token, {
      method: 'POST',
      body: JSON.stringify({ name: opts.name, description: opts.description || undefined, private: opts.private })
    })
    return { name: repo.full_name, url: repo.clone_url, private: repo.private }
  }

  if (provider === 'gitlab') {
    const res = await fetch(`${glApi(auth.base)}/projects`, {
      method: 'POST',
      redirect: 'error',
      headers: { ...gitlabAuth(auth), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: opts.name,
        description: opts.description || undefined,
        visibility: opts.private ? 'private' : 'public',
        namespace_id: opts.ownerId ? Number(opts.ownerId) : undefined
      })
    })
    if (!res.ok) {
      const msg = (await res.json().catch(() => null)) as { message?: unknown } | null
      throw new Error(`GitLab: ${msg?.message ? JSON.stringify(msg.message) : res.status}`)
    }
    const repo = (await res.json()) as { path_with_namespace: string; http_url_to_repo: string; visibility: string }
    return { name: repo.path_with_namespace, url: repo.http_url_to_repo, private: repo.visibility !== 'public' }
  }

  if (provider === 'forgejo') return createForgejoRepo(auth.base, auth.token, opts)

  if (provider === 'bitbucket') {
    if (auth.base !== BITBUCKET_CLOUD) throw new Error(BBS_NO_BROWSE)
    const slug = opts.name.trim().toLowerCase().replace(/\s+/g, '-')
    const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${opts.owner}/${slug}`, {
      method: 'POST',
      headers: { Authorization: bitbucketAuthFor(auth), 'Content-Type': 'application/json' },
      body: JSON.stringify({ scm: 'git', is_private: opts.private, description: opts.description || undefined })
    })
    if (!res.ok) throw new Error(`Bitbucket API error (${res.status})`)
    const repo = (await res.json()) as {
      full_name: string
      is_private: boolean
      links: { clone: Array<{ name: string; href: string }> }
    }
    return {
      name: repo.full_name,
      url: repo.links.clone.find((c) => c.name === 'https')?.href ?? repo.links.clone[0]?.href ?? '',
      private: repo.is_private
    }
  }

  // Azure DevOps — create a repo inside a project of the organization.
  if (!org?.trim()) throw new Error('Enter your Azure DevOps organization.')
  if (!opts.project?.trim()) throw new Error('Select an Azure DevOps project.')
  const base = providerBaseUrl('azure', org)
  const repo = await withAzureRetry(base, auth, (t) =>
    adoJson<{ name: string; remoteUrl: string; project: { name: string } }>(
      `${base}/${encodeURIComponent(opts.project!)}/_apis/git/repositories?api-version=7.1`,
      t,
      { method: 'POST', body: JSON.stringify({ name: opts.name, project: { id: opts.owner } }) }
    )
  )
  return { name: `${repo.project.name}/${repo.name}`, url: repo.remoteUrl }
}

function ghCiState(conclusion: string | null, status: string): CiState {
  if (status !== 'completed') return 'pending'
  if (conclusion === 'success') return 'success'
  if (conclusion === 'neutral' || conclusion === 'skipped') return 'neutral'
  return 'failure'
}

/** The shape of a stack member, as much of it as we rely on. */
interface GithubStackMember {
  number: number
  title?: string
  html_url?: string
  draft?: boolean
  state?: string
  merged_at?: string | null
  user?: { login: string }
  head?: { ref: string; sha: string }
  base?: { ref: string }
}

// Answers depend on what a credential can see, so each one keeps its own; a
// profile per repo or a per-remote credential helper means several in turn.
// Keyed by a fingerprint so the map never holds the token itself.
interface CiAccount {
  cache: Map<string, CiCacheEntry>
  inFlight: Map<string, Promise<void>>
  pausedUntil: number
}
const ciAccounts = new Map<string, CiAccount>()
// A refreshed CLI token is a new credential; the old ones' answers go. Eight:
// GitHub, GitLab, Azure and Forgejo each hold one, and a second profile on any
// of them would otherwise evict another's answers on every repository switch.
const CI_MAX_ACCOUNTS = 8
// Few at a time: a burst of 40 trips GitHub's secondary limit, and a limit
// answer halts the rest of the batch instead of 40 doomed requests.
const CI_LOOKUP_CONCURRENCY = 6

function ciAccountFor(token: string): CiAccount {
  const id = createHash('sha256').update(token).digest('hex').slice(0, 16)
  const account = ciAccounts.get(id) ?? { cache: new Map(), inFlight: new Map(), pausedUntil: 0 }
  ciAccounts.delete(id)
  ciAccounts.set(id, account)
  for (const oldest of ciAccounts.keys()) {
    if (ciAccounts.size <= CI_MAX_ACCOUNTS) break
    ciAccounts.delete(oldest)
  }
  return account
}

async function lookUpCiStatus(
  apiBase: string,
  owner: string,
  repo: string,
  sha: string,
  token: string,
  account: CiAccount
): Promise<CiLookup> {
  try {
    const res = await fetch(`${apiBase}/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` }
    })
    const limited = (res.status === 403 || res.status === 429) && mentionsRateLimit(await res.text())
    const pause = rateLimitPauseUntil(
      {
        status: res.status,
        limited,
        remaining: res.headers.get('x-ratelimit-remaining'),
        reset: res.headers.get('x-ratelimit-reset'),
        retryAfter: res.headers.get('retry-after')
      },
      Date.now()
    )
    if (pause !== null) account.pausedUntil = Math.max(account.pausedUntil, pause)
    if (!res.ok) return { kind: 'failed' }
    const data = (await res.json()) as {
      check_runs: Array<{ name: string; status: string; conclusion: string | null; html_url: string }>
    }
    const runs = data.check_runs ?? []
    if (!runs.length) return { kind: 'none' }
    const jobs: CiJob[] = runs.map((r) => ({
      name: r.name,
      state: ghCiState(r.conclusion, r.status),
      url: r.html_url
    }))
    const overallState: CiState = jobs.some((j) => j.state === 'failure')
      ? 'failure'
      : jobs.some((j) => j.state === 'pending')
        ? 'pending'
        : jobs.every((j) => j.state === 'neutral')
          ? 'neutral'
          : 'success'
    return { kind: 'found', status: { state: overallState, jobs } }
  } catch {
    return { kind: 'failed' }
  }
}

export async function fetchCiStatuses(
  remoteUrl: string,
  shas: string[],
  token: string
): Promise<Record<string, CiStatus>> {
  const parsed = parseRemoteUrl(remoteUrl)
  // A Data Center's build statuses, quietly: no token or no build-status resource is "no badges".
  const bbsRepo = bbsRepoOfRemote(remoteUrl)
  if (bbsRepo) {
    const bbsAuth = await remoteApiToken(remoteUrl, 'bitbucket', undefined).catch(() => null)
    return bbsAuth ? bbsCiStatuses(bbsRepo, bbsAuth.token, shas).catch(() => ({})) : {}
  }
  if (!parsed) return {}
  // Every host below is quiet the same way: no credential is "no badges", never an error.
  if (parsed.provider === 'gitlab') {
    const gl = await glProjectOf(remoteUrl, undefined).catch(() => null)
    if (!gl) return {}
    return cachedCiStatuses(gl.auth.token, `gitlab|${gl.base}`, shas, (sha) =>
      gitlabCommitCiLookup((url, init) => glJson(url, gl.auth, init), gl.base, sha)
    )
  }
  if (parsed.provider === 'forgejo') {
    const fj = await fjRepoOf(remoteUrl, undefined).catch(() => null)
    if (!fj) return {}
    const repoApi = `${fj.base}/api/v1/repos/${encodeURIComponent(fj.owner)}/${encodeURIComponent(fj.repo)}`
    return cachedCiStatuses(fj.token, `forgejo|${repoApi}`, shas, (sha) =>
      forgejoCommitCiLookup((url, init) => fjJson(url, fj.token, init), repoApi, sha)
    )
  }
  if (parsed.provider === 'azure') {
    const az = await azRepoOf(remoteUrl, undefined).catch(() => null)
    if (!az) return {}
    // One build listing answers every commit of this call; a new one per call keeps it fresh.
    const lookup = azureCiLookupBatch({ org: az.repo.org, project: az.repo.project, repoName: az.repo.repo, optional: az.optional })
    const scope = `azure|${az.repo.org}/${az.repo.project}/${az.repo.repo}`
    return cachedCiStatuses(az.token, scope, shas, lookup)
  }
  if (parsed.provider !== 'github') return {}
  const auth = await remoteApiToken(remoteUrl, 'github', token)
  if (!auth) return {}
  const apiBase = ghEndpointsOf(parsed).apiBase
  // The server is part of the key: the same owner/repo on github.com and on a GHES are two repositories.
  return cachedCiStatuses(auth.token, `${parsed.base ?? ''}|${parsed.owner}/${parsed.repo}`, shas, (sha, account) =>
    lookUpCiStatus(apiBase, parsed.owner, parsed.repo, sha, auth.token, account)
  )
}

/**
 * The badges for `shas`, asking the host only about the commits whose last
 * answer has gone stale (see ciCache.ts). `scope` names the repository on its
 * server; the account — one per credential — holds the answers, the requests
 * in flight and any rate-limit pause. Shared by every host so each one gets the
 * same backoff for commits without CI. Exported for tests.
 */
export async function cachedCiStatuses(
  token: string,
  scope: string,
  shas: string[],
  lookup: (sha: string, account: CiAccount) => Promise<CiLookup>
): Promise<Record<string, CiStatus>> {
  const account = ciAccountFor(token)
  const keyOf = (sha: string): string => `${scope}@${sha}`

  const wanted = [...new Set(shas.slice(0, 40))]
  const now = Date.now()
  const due = wanted.filter((sha) => !isCiEntryFresh(account.cache.get(keyOf(sha)), now))
  // Lookups another call already has queued are awaited, not repeated. Every
  // key this call will look up is claimed before the first request goes out.
  const sharedLookups = due.map((sha) => account.inFlight.get(keyOf(sha))).filter((p) => p !== undefined)
  const claimed = due
    .filter((sha) => !account.inFlight.has(keyOf(sha)))
    .map((sha) => {
      let settle: () => void = () => {}
      const settled = new Promise<void>((resolve) => (settle = resolve))
      account.inFlight.set(keyOf(sha), settled)
      return { sha, key: keyOf(sha), settle }
    })
  const release = (job: (typeof claimed)[number]): void => {
    account.inFlight.delete(job.key)
    job.settle()
  }
  const queue = [...claimed]
  const work = async (): Promise<void> => {
    // A limit answer stops the batch; what we knew stays as it was.
    while (queue.length && Date.now() >= account.pausedUntil) {
      const job = queue.shift()!
      try {
        const answer = await lookup(job.sha, account).catch((): CiLookup => ({ kind: 'failed' }))
        rememberCiEntry(account.cache, job.key, nextCiEntry(account.cache.get(job.key), answer, Date.now()))
      } finally {
        release(job)
      }
    }
  }
  await Promise.all(Array.from({ length: CI_LOOKUP_CONCURRENCY }, work))
  // Skipped for a pause: let anyone waiting on them go.
  queue.forEach(release)
  await Promise.all(sharedLookups)

  const result: Record<string, CiStatus> = {}
  for (const sha of wanted) {
    const entry = account.cache.get(keyOf(sha))
    if (entry?.lookup.kind === 'found') result[sha] = entry.lookup.status
  }
  return result
}

/** The active profile's Forgejo server and its token, or null when it has none. Silent: this backs a poll. */
async function forgejoInbox(): Promise<{ base: string; token: string } | null> {
  const auth = await tokenForProvider('forgejo', '').catch(() => null)
  return auth ? { base: auth.base, token: auth.token } : null
}

/** GitHub's inbox and the active profile's Forgejo server's, newest first. */
async function listNotifications(token: string, all = false): Promise<GitHubNotification[]> {
  const [gh, fj] = await Promise.all([
    listGithubNotifications(token, all),
    forgejoInbox().then((f) => (f ? listForgejoNotifications(f.base, f.token, all) : []))
      // One host failing must not empty the other's list.
      .catch(() => [] as GitHubNotification[])
  ])
  return fj.length ? [...gh, ...fj].sort((a, b) => b.updatedAt - a.updatedAt) : gh
}

/**
 * GitHub notifications for the authenticated user, across every repo the token
 * can see. Token-level (no remote needed). `all=false` ⇒ unread only.
 */
async function listGithubNotifications(token: string, all: boolean): Promise<GitHubNotification[]> {
  // Same precedence as every other call: a typed token, else the credential
  // git's helper already holds for github.com. Silent (this backs a poll).
  const auth = await tokenForProvider('github', token)
  if (!auth) return []
  token = auth.token
  const data = await ghJson<
    Array<{
      id: string
      reason: string
      unread: boolean
      updated_at: string
      subject: { title: string; url: string | null; type: string }
      repository: { full_name: string; html_url: string }
    }>
  >(`${GITHUB_COM_ENDPOINTS.apiBase}/notifications?all=${all ? 'true' : 'false'}&per_page=50`, token)

  return data.map((n) => {
    // subject.url is an API url (…/repos/o/r/issues/5 or …/pulls/5). Derive the
    // trailing number and a browser URL — note PRs use the singular /pull/.
    const tail = n.subject.url?.split('/').pop() ?? ''
    const number = /^\d+$/.test(tail) ? Number(tail) : null
    let url = n.repository.html_url
    if (number != null) {
      if (n.subject.type === 'PullRequest') url = `${n.repository.html_url}/pull/${number}`
      else if (n.subject.type === 'Issue') url = `${n.repository.html_url}/issues/${number}`
    } else if (n.subject.type === 'Release') {
      url = `${n.repository.html_url}/releases`
    }
    return {
      id: n.id,
      reason: n.reason,
      title: n.subject.title,
      type: n.subject.type,
      repoFullName: n.repository.full_name,
      repoUrl: n.repository.html_url,
      number,
      unread: n.unread,
      updatedAt: Math.floor(new Date(n.updated_at).getTime() / 1000),
      url
    }
  })
}

async function markNotificationRead(token: string, id: string): Promise<void> {
  if (id.startsWith(FORGEJO_NOTIFICATION)) {
    const f = await forgejoInbox()
    if (f) await markForgejoNotificationRead(f.base, f.token, id).catch(() => {})
    return
  }
  const auth = await tokenForProvider('github', token)
  if (!auth) return
  await ghJson<unknown>(`${GITHUB_COM_ENDPOINTS.apiBase}/notifications/threads/${id}`, auth.token, { method: 'PATCH' }).catch(() => {
    /* already read / gone — non-fatal */
  })
}

async function markAllNotificationsRead(token: string): Promise<void> {
  const f = await forgejoInbox()
  if (f) await markAllForgejoNotificationsRead(f.base, f.token).catch(() => {})
  const auth = await tokenForProvider('github', token)
  if (!auth) return
  token = auth.token
  // The PUT /notifications endpoint returns 202 with an empty body; ghJson would
  // choke parsing JSON, so call fetch directly.
  await fetch(`${GITHUB_COM_ENDPOINTS.apiBase}/notifications`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ read: true })
  }).catch(() => {
    /* non-fatal */
  })
}

/**
 * Register an SSH public key on the user's GitHub account. The only place the
 * host token and the SSH world meet: the token is what authorises adding a key
 * the transport will then use. Only the public half is ever sent.
 */
export async function uploadSshKey(token: string, title: string, publicKey: string): Promise<{ id: number }> {
  return ghJson<{ id: number }>(`${GITHUB_COM_ENDPOINTS.apiBase}/user/keys`, token, {
    method: 'POST',
    body: JSON.stringify({ title, key: publicKey.trim() })
  })
}

/**
 * Whether a hosting action on this remote has a credential to run as — the
 * profile the repository is bound to, else the active one, by the same
 * precedence `profileAuth` applies. Asked by the renderer before it offers an
 * action (Create PR in the branch comparison): its own settings carry no tokens
 * until Settings is unlocked and never carry links, so it cannot tell itself.
 *
 * A peek, never a decrypt and never a prompt: a store still locked, with a
 * token that may be in it, answers 'unknown' — the caller offers the action,
 * and clicking it unlocks the store as every hosting call does. A link counts
 * as a credential without asking its helper: that ask can prompt, and the
 * action reports a helper that holds nothing in its own words.
 */
export async function hostingAccess(repoPath: string | undefined, remoteUrl: string): Promise<HostingAccess> {
  const parsed = typeof remoteUrl === 'string' ? parseRemoteUrl(remoteUrl) : null
  if (!parsed) return 'no'
  const answer = (auth: PeekedAuth): HostingAccess =>
    auth.locked ? 'unknown' : auth.token?.trim() || validAccountLink(auth.link) ? 'yes' : 'no'
  const bound = repoPath ? await peekBoundProfileAuth(parsed.provider, repoPath, remoteUrl) : undefined
  if (bound) return answer(bound)
  return answer(await peekActiveProfileAuth(parsed.provider, remoteUrl))
}

// ── CI runs ─────────────────────────────────────────────────────────────────
// The runs page's adapter for a remote. Each host's adapter lives in its own
// ciRuns*.ts and is handed authenticated requests from here, so none of them
// knows how a token is found.

/**
 * A GitHub job log. The endpoint answers with a redirect to a signed download on
 * another host; the token must not follow it there, so the redirect is read and
 * the download fetched without it.
 */
async function githubLogTail(url: string, token: string, max: number): Promise<string | null> {
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` }
  }).catch(() => null)
  if (!res) return null
  const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
  const body = location ? await fetch(location).catch(() => null) : res
  if (!body || !body.ok) return null
  return readTail(body, max)
}

/** A GitHub request answered with no body worth reading (201/202/204). */
async function ghSend(url: string, token: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    }
  })
  if (!res.ok) throw await ghError(res)
}

/** The runs adapter for a remote, or null when its host has no CI runs API this app speaks. */
async function ciRunsAdapterFor(remoteUrl: string, tokens: HostTokens): Promise<CiRunsAdapter | null> {
  const provider = parseRemoteUrl(remoteUrl)?.provider
  if (provider === 'github') {
    const { api, token } = await ghRepoOf(remoteUrl, tokens.github)
    return githubCiRuns({
      api,
      json: (url, init) => ghJson(url, token, init),
      sendRequest: (url, init) => ghSend(url, token, init),
      logTail: (url, max) => githubLogTail(url, token, max)
    })
  }
  if (provider === 'gitlab') {
    const { base, auth } = await glProjectOf(remoteUrl, tokens.gitlab)
    return gitlabCiRuns({
      base,
      json: (url, init) => glJson(url, auth, init),
      sendRequest: async (url, init) => {
        await glJson<unknown>(url, auth, init)
      },
      text: (url, max) => gitlabTextTail(url, auth, max)
    })
  }
  if (provider === 'azure') {
    const { ado, optional, text, repo } = await azRepoOf(remoteUrl, tokens.azure)
    return azureCiRuns({ org: repo.org, project: repo.project, repoName: repo.repo, ado, optional, text })
  }
  if (provider === 'forgejo') {
    const { base, owner, repo, token } = await fjRepoOf(remoteUrl, tokens.forgejo)
    return forgejoCiRuns({
      base,
      owner,
      repo,
      json: (url, init) => fjJson(url, token, init),
      logTail: (target) => forgejoJobLog(base, token, target)
    })
  }
  return null
}

/** A GitLab job trace, keeping only its last `max` bytes as it streams. Null when refused. */
async function gitlabTextTail(url: string, auth: { token: string; cred?: GitCredential }, max: number): Promise<string | null> {
  const res = await fetch(url, { redirect: 'error', headers: { ...gitlabAuth(auth), Accept: 'text/plain' } }).catch(() => null)
  if (!res || !res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return null
  return readTail(res, max)
}

/** Throws when the remote has no runs API: every call below needs one. */
async function requireCiRuns(remoteUrl: string, tokens: HostTokens): Promise<CiRunsAdapter> {
  const adapter = await ciRunsAdapterFor(remoteUrl, tokens)
  if (!adapter) throw new Error('This remote has no CI runs the app can read.')
  return adapter
}

async function listCiRuns(remoteUrl: string, tokens: HostTokens, branch?: string): Promise<CiRunList> {
  const adapter = await ciRunsAdapterFor(remoteUrl, tokens)
  if (!adapter) return { supported: false, runs: [], capabilities: NO_CI_CAPABILITIES }
  const wanted = typeof branch === 'string' && branch ? branch : undefined
  try {
    return { supported: true, runs: await adapter.listRuns(wanted), capabilities: adapter.capabilities }
  } catch (e) {
    // A server too old for the runs API is "not supported", not an error to toast.
    if ((e as { unsupported?: boolean }).unsupported) return { supported: false, runs: [], capabilities: NO_CI_CAPABILITIES }
    throw e
  }
}

const CI_RUN_ACTIONS: readonly CiRunAction[] = ['rerun', 'rerun-failed', 'cancel']

/**
 * Register a handler for a call that acts on one repository's remote. Its first
 * IPC argument is that repository's path — the same convention as the git
 * channel — and the whole call, every helper under it included, runs as the
 * profile the repository is bound to (`hostingRepo`). An unbound repository, or
 * no path, falls back to the active profile.
 */
function handleForRepo<A extends unknown[]>(channel: string, run: (...args: A) => unknown): void {
  ipcMain.handle(channel, (_e, repoPath: unknown, ...args: unknown[]) =>
    hostingRepo.run(asRepoPath(repoPath), () => run(...(args as A)))
  )
}

export function registerHostingHandlers(): void {
  // Provider-level: no repository yet. `profileId` is the clone (or add-remote)
  // dialog's picked profile; absent → the active one.
  ipcMain.handle('hosting:listRepos', (_e, provider: RepoHost, token: string, org?: string, profileId?: unknown) =>
    listRepositories(provider, token, org, asProfileIdArg(profileId))
  )
  ipcMain.handle('hosting:listOwners', (_e, provider: RepoHost, token: string, org?: string, profileId?: unknown) =>
    listOwners(provider, token, org, asProfileIdArg(profileId))
  )
  ipcMain.handle(
    'hosting:accountOwner',
    (_e, provider: RepoHost, login: unknown, found: unknown, exceptProfileId: unknown) => {
      const link = validAccountLink(found)
      if (!link || typeof login !== 'string' || typeof exceptProfileId !== 'string') return null
      return accountOwner(provider, login, link, exceptProfileId)
    }
  )
  ipcMain.handle(
    'hosting:whoAmI',
    (_e, provider: RepoHost, token: string, org?: string, interactive?: boolean, link?: unknown, issuer?: string) =>
      checkToken(provider, token, org, interactive, validAccountLink(link), issuer)
  )
  ipcMain.handle(
    'hosting:createRepo',
    (_e, provider: RepoHost, token: string, opts: CreateRepoOpts, org?: string, profileId?: unknown) =>
      createRepository(provider, token, opts, org, asProfileIdArg(profileId))
  )
  // No credential: a browser page.
  ipcMain.handle('hosting:openCreatePR', (_e, remoteUrl: string, source: string, target: string) => {
    const url = createPullRequestUrl(remoteUrl, source, target)
    if (url) openExternalUrl(url, 'hosting:openCreatePR')
    return url != null
  })
  // The account's own inbox: the active profile's.
  ipcMain.handle('hosting:listNotifications', (_e, token: string, all?: boolean) =>
    listNotifications(token, all)
  )
  ipcMain.handle('hosting:markNotificationRead', (_e, token: string, id: string) =>
    markNotificationRead(token, id)
  )
  ipcMain.handle('hosting:markAllNotificationsRead', (_e, token: string) =>
    markAllNotificationsRead(token)
  )
  ipcMain.handle('hosting:uploadSshKey', (_e, token: string, title: string, publicKey: string) =>
    uploadSshKey(token, title, publicKey)
  )

  // Repository-scoped: first argument is the repository path (see handleForRepo).
  ipcMain.handle('hosting:canAct', (_e, repoPath: unknown, remoteUrl: unknown) =>
    typeof remoteUrl === 'string' ? hostingAccess(asRepoPath(repoPath), remoteUrl) : 'no'
  )
  handleForRepo('hosting:listPRs', (remoteUrl: string, tokens: HostTokens) =>
    listPullRequests(remoteUrl, tokens)
  )
  handleForRepo('hosting:listFinishedPRs', (remoteUrl: string, tokens: HostTokens) =>
    listFinishedPullRequests(remoteUrl, tokens)
  )
  handleForRepo('hosting:listReleases', (remoteUrl: string, tokens: { github?: string }) =>
    listReleases(remoteUrl, tokens)
  )
  handleForRepo('hosting:ciStatuses', (remoteUrl: string, shas: string[], token: string) =>
    fetchCiStatuses(remoteUrl, shas, token)
  )
  handleForRepo('hosting:createPR', (remoteUrl: string, tokens: HostTokens, opts: CreatePrOpts) =>
    createPullRequest(remoteUrl, tokens, opts)
  )
  handleForRepo('hosting:prPickerOptions', (remoteUrl: string, tokens: HostTokens) =>
    prPickerOptions(remoteUrl, tokens)
  )
  // With who "you" are on the host, so the page knows which comments are yours.
  handleForRepo('hosting:prDetail', (remoteUrl: string, tokens: HostTokens, number: number) =>
    withViewer(remoteUrl, tokens, pullRequestDetail(remoteUrl, tokens, number))
  )
  // An Azure Boards work item, in the organization of the repository's Azure remote.
  handleForRepo('hosting:workItem', async (remoteUrl: string, tokens: HostTokens, id: number) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('A work item number is a positive integer.')
    const a = await azRepoOf(remoteUrl, tokens.azure)
    // Work Items is a scope a code token may lack: a refusal is shown, never retried.
    return azureWorkItem(a.optional, a.repo.org, id)
  })
  // The hover card on `#12` / `!12` / `AB#12`: one batch of the references on screen.
  handleForRepo('hosting:getReferenceSummaries', (remoteUrl: string, tokens: HostTokens, queries: unknown) =>
    referenceSummaries(remoteUrl, tokens, normalizeReferenceQueries(queries))
  )
  handleForRepo('hosting:prComment', (remoteUrl: string, tokens: HostTokens, number: number, body: string) =>
    commentOnPr(remoteUrl, tokens, number, body)
  )
  handleForRepo(
    'hosting:prReplyReviewComment',
    (remoteUrl: string, tokens: HostTokens, number: number, inReplyTo: number | string, body: string) =>
      replyReviewComment(remoteUrl, tokens, number, inReplyTo, body)
  )
  handleForRepo(
    'hosting:prReplyReviewThread',
    (remoteUrl: string, tokens: HostTokens, number: number, commentId: number, body: string) =>
      replyReviewThread(remoteUrl, tokens, number, commentId, body)
  )
  handleForRepo(
    'hosting:prCommentOnLine',
    (remoteUrl: string, tokens: HostTokens, number: number, anchor: unknown, body: unknown, revision: unknown) =>
      commentOnPrLine(remoteUrl, tokens, number, anchor, body, validRevision(revision))
  )
  handleForRepo(
    'hosting:prEditComment',
    (remoteUrl: string, tokens: HostTokens, number: number, handle: unknown, body: unknown) =>
      editPrComment(remoteUrl, tokens, number, handle, body)
  )
  handleForRepo('hosting:prDeleteComment', (remoteUrl: string, tokens: HostTokens, number: number, handle: unknown) =>
    deletePrComment(remoteUrl, tokens, number, handle)
  )
  // Not handleForRepo: the list tells its window when it starts and ends a fetch of the PR's commits.
  ipcMain.handle(
    'hosting:prFiles',
    (e, repoPath: unknown, remoteUrl: string, tokens: HostTokens, number: number, fetchMode?: unknown) => {
      const sender = (e as { sender?: Electron.WebContents } | undefined)?.sender
      const onFetching = (fetching: boolean): void => {
        if (sender && !sender.isDestroyed()) sender.send('hosting:prFilesFetching', { repoPath, remoteUrl, number, fetching })
      }
      return hostingRepo.run(asRepoPath(repoPath), () =>
        pullRequestFileList(remoteUrl, tokens, number, parseFetchMode(fetchMode), onFetching)
      )
    }
  )
  handleForRepo('hosting:prFileDiff', (remoteUrl: string, tokens: HostTokens, request: unknown) =>
    pullRequestFileDiff(remoteUrl, tokens, request)
  )
  handleForRepo('hosting:prListCommits', (remoteUrl: string, tokens: HostTokens, number: number) =>
    pullRequestCommitList(remoteUrl, tokens, number)
  )
  handleForRepo('hosting:prListUpdates', (remoteUrl: string, tokens: HostTokens, number: number) =>
    pullRequestUpdateList(remoteUrl, tokens, number)
  )
  handleForRepo(
    'hosting:prUpdateFiles',
    (remoteUrl: string, tokens: HostTokens, number: number, from: unknown, to: unknown) =>
      pullRequestUpdateFiles(remoteUrl, tokens, number, from, to)
  )
  // The image preview's own ask, for when the file list could not name the commits.
  handleForRepo('hosting:prDiffCommits', async (remoteUrl: string, tokens: HostTokens, number: number) => {
    const named = await pullRequestDiffCommits(remoteUrl, tokens, number)
    return named ? resolvePrMergeBase(hostingRepo.getStore(), remoteUrl, tokens, named) : null
  })
  handleForRepo('hosting:prFileContent', (remoteUrl: string, tokens: HostTokens, sha: unknown, path: unknown) =>
    pullRequestFileContent(remoteUrl, tokens, sha, path)
  )
  handleForRepo('hosting:prCheckLog', (remoteUrl: string, tokens: HostTokens, url: string) =>
    pullRequestCheckLog(remoteUrl, tokens, url)
  )
  handleForRepo('hosting:ciRuns', (remoteUrl: string, tokens: HostTokens, branch?: string) =>
    listCiRuns(remoteUrl, tokens, branch)
  )
  handleForRepo('hosting:ciRunJobs', async (remoteUrl: string, tokens: HostTokens, runId: string) =>
    (await requireCiRuns(remoteUrl, tokens)).listJobs(String(runId))
  )
  handleForRepo('hosting:ciJobLog', async (remoteUrl: string, tokens: HostTokens, runId: string, jobId: string) =>
    (await requireCiRuns(remoteUrl, tokens)).getJobLog(String(runId), String(jobId))
  )
  handleForRepo('hosting:ciRunAction', async (remoteUrl: string, tokens: HostTokens, runId: string, action: CiRunAction) => {
    if (!CI_RUN_ACTIONS.includes(action)) throw new Error(`Unknown CI run action: ${String(action)}`)
    const adapter = await requireCiRuns(remoteUrl, tokens)
    await adapter.runAction(String(runId), action)
  })
  handleForRepo('hosting:ciWorkflows', async (remoteUrl: string, tokens: HostTokens) =>
    (await requireCiRuns(remoteUrl, tokens)).listWorkflows()
  )
  handleForRepo('hosting:ciDispatch', async (remoteUrl: string, tokens: HostTokens, workflowId: string, ref: string) => {
    if (typeof ref !== 'string' || !ref.trim()) throw new Error('A branch is required to start a workflow.')
    await (await requireCiRuns(remoteUrl, tokens)).dispatchWorkflow(String(workflowId), ref.trim())
  })
  handleForRepo('hosting:prChecks', (remoteUrl: string, tokens: HostTokens, number: number) =>
    pullRequestChecks(remoteUrl, tokens, number)
  )
  handleForRepo(
    'hosting:prReview',
    (remoteUrl: string, tokens: HostTokens, number: number, event: PrReviewEvent, body: string) =>
      reviewPr(remoteUrl, tokens, number, event, body)
  )
  handleForRepo(
    'hosting:prSetState',
    (remoteUrl: string, tokens: HostTokens, number: number, state: unknown) => {
      if (state !== 'open' && state !== 'closed') throw new Error('Invalid pull request state.')
      return setPullRequestState(remoteUrl, tokens, number, state)
    }
  )
  handleForRepo('hosting:prSetDraft', (remoteUrl: string, tokens: HostTokens, number: number, draft: unknown) => {
    if (typeof draft !== 'boolean') throw new Error('Invalid draft flag.')
    return setPullRequestDraft(remoteUrl, tokens, number, draft)
  })
  handleForRepo('hosting:prMerge', (remoteUrl: string, tokens: HostTokens, number: number, method: PrMergeMethod) =>
    mergePr(remoteUrl, tokens, number, method)
  )
  handleForRepo('hosting:mergedPrHeads', (remoteUrl: string, tokens: { github?: string }, branches: string[]) =>
    mergedPrHeads(remoteUrl, tokens, branches)
  )
  handleForRepo('hosting:ensureStack', (remoteUrl: string, tokens: { github?: string }, numbers: number[]) =>
    ensureGithubStack(remoteUrl, tokens, numbers)
  )
  handleForRepo(
    'hosting:updatePR',
    (
      remoteUrl: string,
      tokens: { github?: string },
      number: number,
      patch: { base?: string; title?: string; stackSection?: string }
    ) => updatePullRequest(remoteUrl, tokens, number, patch)
  )
  handleForRepo('hosting:listIssues', (remoteUrl: string, tokens: { github?: string }) =>
    listIssues(remoteUrl, tokens)
  )
  handleForRepo('hosting:listMilestones', (remoteUrl: string, tokens: { github?: string }) =>
    listMilestones(remoteUrl, tokens)
  )
  handleForRepo('hosting:milestoneIssues', (remoteUrl: string, tokens: { github?: string }, number: number) =>
    milestoneIssues(remoteUrl, tokens, number)
  )
  handleForRepo('hosting:issueDetail', (remoteUrl: string, tokens: { github?: string }, number: number) =>
    withViewer(remoteUrl, tokens, issueDetail(remoteUrl, tokens, number))
  )
  handleForRepo(
    'hosting:setIssueState',
    (remoteUrl: string, tokens: { github?: string }, number: number, state: 'open' | 'closed') =>
      setIssueState(remoteUrl, tokens, number, state)
  )
  handleForRepo(
    'hosting:createIssue',
    (remoteUrl: string, tokens: { github?: string }, opts: { title: string; body?: string }) =>
      createIssue(remoteUrl, tokens, opts)
  )
}
